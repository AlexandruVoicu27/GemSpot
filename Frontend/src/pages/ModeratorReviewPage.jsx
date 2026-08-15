import { useEffect, useState } from "react";
import {
  downloadManualReviewFile,
  getManualReviewQueue,
  getUploadSettings,
  reviewUpload,
  updateCloudmersiveScanning,
} from "../api";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  Power,
  RefreshCw,
  XCircle,
} from "lucide-react";

// Converts a file size from bytes into a readable value such as MB or GB.
function formatBytes(bytes) {
  if (!bytes) return "Unknown size";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

// Displays and controls Cloudmersive/manual-review mode.
function ReviewSettingsPanel({ profile }) {
  const canViewSettings = ["ADMIN", "MODERATOR"].includes(profile?.role);
  const canToggleScanner = profile?.role === "ADMIN";
  const [settings, setSettings] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  // Loads the scanner state and manual-review count.
  const loadSettings = async () => {
    setIsLoading(true);
    setNotice("");

    try {
      const [settingsData, queueData] = await Promise.all([
        getUploadSettings(),
        getManualReviewQueue(),
      ]);

      setSettings(settingsData);
      setQueueCount(Array.isArray(queueData) ? queueData.length : 0);
    } catch (error) {
      setNotice(error.message || "Could not load scanner settings.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loads settings when the review page opens.
  useEffect(() => {
    if (canViewSettings) loadSettings();
  }, [canViewSettings]);

  // Changes Cloudmersive scanning on or off.
  const handleToggle = async () => {
    if (!canToggleScanner) return;

    setIsSaving(true);
    setNotice("");

    try {
      const updated = await updateCloudmersiveScanning(
        !Boolean(settings?.cloudScanEnabled)
      );

      setSettings(updated);
      setNotice(
        updated.cloudScanEnabled
          ? "Cloudmersive is ON. New uploads will be scanned automatically."
          : "Cloudmersive is OFF. New uploads will go to manual review."
      );

      const queueData = await getManualReviewQueue();
      setQueueCount(Array.isArray(queueData) ? queueData.length : 0);
    } catch (error) {
      setNotice(error.message || "Could not update scanner settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewSettings) return null;

  const isEnabled = Boolean(settings?.cloudScanEnabled);

  return (
    <section className="review-settings-panel">
      <div className="review-settings-heading">
        <div>
          <span className="eyebrow">Review controls</span>
          <h2>Upload scanning</h2>
        </div>

        <span className={isEnabled ? "scanner-mode on" : "scanner-mode off"}>
          {isEnabled ? "Cloudmersive ON" : "Manual review"}
        </span>
      </div>

      <p>
        Choose whether new uploads are scanned automatically or sent directly
        to the moderator review queue.
      </p>

      <div className="review-settings-row">
        <div>
          <strong>
            {isEnabled
              ? "Automatic scanning enabled"
              : "Manual review mode enabled"}
          </strong>
          <small>{queueCount} uploads waiting for review</small>
        </div>

        <button
          type="button"
          className={isEnabled ? "scanner-toggle on" : "scanner-toggle off"}
          role="switch"
          aria-checked={isEnabled}
          onClick={handleToggle}
          disabled={!canToggleScanner || isSaving || isLoading}
        >
          <span className="scanner-toggle-knob" />
          <span>{isSaving ? "Saving..." : isEnabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      <button
        type="button"
        className="review-settings-refresh"
        onClick={loadSettings}
        disabled={isLoading || isSaving}
      >
        <RefreshCw size={16} />
        Refresh
      </button>

      {!canToggleScanner && (
        <small className="review-settings-note">
          Moderators can view this status. Only admins can change it.
        </small>
      )}

      {notice && <p className="scanner-admin-notice">{notice}</p>}
    </section>
  );
}

// Displays the manual upload-review workspace for admins and moderators.
export default function ModeratorReviewPage({ onBack, profile }) {
  const [queue, setQueue] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const selectedUpload = queue.find((item) => item.id === selectedId);

  // Fetches the current manual-review queue from the backend.
  const loadQueue = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getManualReviewQueue();
      const uploads = Array.isArray(result) ? result : [];

      setQueue(uploads);
      setSelectedId((current) =>
        uploads.some((item) => item.id === current)
          ? current
          : uploads[0]?.id || ""
      );
    } catch (loadError) {
      setError(loadError.message || "Could not load the review queue.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loads the queue automatically when the review page opens.
  useEffect(() => {
    loadQueue();
  }, []);

  // Downloads the selected upload from the protected quarantine endpoint.
  const handleDownload = async () => {
    if (!selectedUpload) return;

    try {
      await downloadManualReviewFile(
        selectedUpload.id,
        selectedUpload.file_name
      );
      setNotice("Archive downloaded. Inspect it in an isolated environment.");
    } catch (downloadError) {
      setError(downloadError.message || "Could not download the archive.");
    }
  };

  // Sends the moderator's approve or reject decision to the backend.
  const handleDecision = async (decision) => {
    if (!selectedUpload) return;

    if (decision === "reject" && !note.trim()) {
      setError("Add a rejection reason before rejecting this upload.");
      return;
    }

    setIsActing(true);
    setError("");

    try {
      await reviewUpload(selectedUpload.id, decision, note.trim());

      setNotice(
        decision === "approve"
          ? "Upload approved and released to private game storage."
          : "Upload rejected."
      );

      setNote("");
      await loadQueue();
    } catch (reviewError) {
      setError(reviewError.message || "Could not complete the review.");
    } finally {
      setIsActing(false);
    }
  };

  // Renders the moderator review interface.
  return (
    <section className="moderator-review-page">
      <div className="review-page-heading">
        <div>
          <span className="eyebrow">Moderator workspace</span>
          <h1>Review game uploads.</h1>
          <p>
            Download the quarantined archive, inspect it manually, then approve
            or reject it.
          </p>
        </div>

        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back
        </button>
      </div>

      <ReviewSettingsPanel profile={profile} />

      <div className="review-workspace">
        <aside className="review-queue-panel">
          <div className="review-panel-heading">
            <div>
              <span className="eyebrow">Manual queue</span>
              <h2>{queue.length} uploads</h2>
            </div>

            <button
              className="review-refresh-button"
              onClick={loadQueue}
              disabled={isLoading}
              aria-label="Refresh review queue"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {queue.length === 0 && !isLoading && (
            <p className="empty-state">No uploads need manual review.</p>
          )}

          {queue.map((upload) => (
            <button
              className={
                selectedId === upload.id
                  ? "review-queue-item selected"
                  : "review-queue-item"
              }
              key={upload.id}
              onClick={() => {
                setSelectedId(upload.id);
                setNotice("");
                setError("");
              }}
            >
              <strong>{upload.game?.title || "Untitled game"}</strong>
              <span>{upload.file_name}</span>
              <small>{formatBytes(upload.size_bytes)}</small>
            </button>
          ))}
        </aside>

        <section className="review-detail-panel">
          {!selectedUpload ? (
            <div className="empty-review-state">
              <FileArchive size={42} />
              <h2>Select an upload</h2>
              <p>Choose an upload from the manual review queue.</p>
            </div>
          ) : (
            <>
              <div className="review-detail-heading">
                <div>
                  <span className="eyebrow">Game upload</span>
                  <h2>{selectedUpload.game?.title || "Untitled game"}</h2>
                  <p>{selectedUpload.file_name}</p>
                </div>

                <span className="review-status-badge">
                  {selectedUpload.scan_status}
                </span>
              </div>

              <div className="review-facts">
                <div>
                  <small>Archive size</small>
                  <strong>{formatBytes(selectedUpload.size_bytes)}</strong>
                </div>

                <div>
                  <small>Created</small>
                  <strong>
                    {new Date(selectedUpload.created_at).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="scanner-output">
                <span className="eyebrow">Scanner information</span>
                <pre>
                  {selectedUpload.scanner_output || "No scanner output available."}
                </pre>
              </div>

              <div className="review-manual-step">
                <FileArchive size={22} />
                <div>
                  <strong>Inspect the archive first-hand</strong>
                  <p>
                    Download the file and inspect its contents in a sandbox or
                    virtual machine. Do not execute unknown game files on the
                    production server.
                  </p>
                </div>
              </div>

              <button
                className="download-review-button"
                onClick={handleDownload}
              >
                <Download size={17} />
                Download quarantined archive
              </button>

              <label className="review-note-field">
                Review note
                <textarea
                  rows="5"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Explain why this upload is safe or why it should be rejected."
                />
              </label>

              {error && <p className="auth-error">{error}</p>}
              {notice && <p className="edit-notice">{notice}</p>}

              <div className="review-decision-actions">
                <button
                  className="approve-review-button"
                  disabled={isActing}
                  onClick={() => handleDecision("approve")}
                >
                  <CheckCircle2 size={17} />
                  Approve and release
                </button>

                <button
                  className="reject-review-button"
                  disabled={isActing}
                  onClick={() => handleDecision("reject")}
                >
                  <XCircle size={17} />
                  Reject upload
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}