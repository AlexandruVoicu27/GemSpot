import { useEffect, useMemo, useState } from "react";
import { getManualReviewQueue, getUploadSettings, getUploadStatus, updateCloudmersiveScanning, uploadGame } from "./api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LockKeyhole,
  Power,
  RefreshCw,
  Save,
  Trash2,
  ShieldCheck,
  Upload,
} from "lucide-react";

function getDisplayName(accountLabel, user, profile) {
  return (
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    profile?.username ||
    user?.user_metadata?.username ||
    accountLabel
  );
}

function getAvatarUrl(user, profile) {
  return profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.avatarUrl || "";
}

function getInitials(value) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AdminScannerPanel({ profile }) {
  const role = profile?.role || "USER";
  const canViewScanner = role === "ADMIN";
  const canToggleScanner = role === "ADMIN";
  const [settings, setSettings] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadScannerState = async () => {
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

  useEffect(() => {
    if (canViewScanner) loadScannerState();
  }, [canViewScanner]);

  if (!canViewScanner) return null;

  const isEnabled = Boolean(settings?.cloudScanEnabled);

  const handleToggle = async () => {
    if (!canToggleScanner) return;

    setIsSaving(true);
    setNotice("");

    try {
      const updated = await updateCloudmersiveScanning(!isEnabled);
      setSettings(updated);
      setNotice(
        updated.cloudScanEnabled
          ? "Cloudmersive is ON. New uploads will be scanned automatically."
          : "Cloudmersive is OFF. New uploads will go to manual review."
      );
      const queueData = await getManualReviewQueue();
      setQueueCount(Array.isArray(queueData) ? queueData.length : 0);
    } catch (error) {
      setNotice(error.message || "Could not update scanner setting.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section id="website-settings" className="scanner-admin-card">
      <div className="section-mini">
        <ShieldCheck size={18} />
        <strong>Website Settings</strong>
      </div>

      <div className={"scanner-status " + (isEnabled ? "enabled" : "disabled")}>
        <span>{isLoading ? "Loading..." : isEnabled ? "Cloudmersive ON" : "Manual review mode"}</span>
        <small>{queueCount} uploads waiting for manual review</small>
      </div>

      <div className="scanner-admin-actions">
        {canToggleScanner && (
          <button type="button" onClick={handleToggle} disabled={isSaving || isLoading}>
            <Power size={16} />
            {isSaving ? "Saving..." : isEnabled ? "Turn scanner OFF" : "Turn scanner ON"}
          </button>
        )}
        <button type="button" className="secondary" onClick={loadScannerState} disabled={isLoading || isSaving}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {notice && <p className="scanner-admin-notice">{notice}</p>}
      {!canToggleScanner && <p className="scanner-admin-notice">Moderators can view this status. Only admins can change it.</p>}
    </section>
  );
}

export default function ProfilePage({ accountLabel, user, profile, requireAccount, onEdit, onUpload }) {
  const displayName = getDisplayName(accountLabel, user, profile);
  const email = user?.email || "";
  const avatarUrl = getAvatarUrl(user, profile);
  const isAdmin = profile?.role === "ADMIN";

  const openWebsiteSettings = () => {
    document.getElementById("website-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{getInitials(displayName)}</span>}
        </div>

        <div className="profile-copy">
          <span className="eyebrow">Creator profile</span>
          <h1>{displayName}</h1>
          <p>Your GemSpot profile is ready. Profile details will appear here once we connect creator data.</p>

        </div>

        <div className="profile-actions">
          <button onClick={onEdit}>Edit Profile</button>
          <button className="secondary" onClick={onUpload}>Upload Game</button>
          {isAdmin && (
            <button className="website-settings-button" onClick={openWebsiteSettings}>
              Website Settings
            </button>
          )}
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        {["Overview", "Projects", "Reviews", "Activity", "Settings"].map((tab, index) => (
          <button
            className={index === 0 ? "selected" : ""}
            onClick={tab === "Settings" ? onEdit : undefined}
            key={tab}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="profile-grid">
        <div className="feed-column">
          <div className="section-heading">
            <div><span className="eyebrow">Profile</span><h2>Overview</h2></div>
          </div>
          <section className="empty-profile-panel">
            <strong>No profile content yet.</strong>
            <span>Projects, reviews, collections, and activity will appear here once those systems are connected.</span>
          </section>
        </div>

        <aside className="side-rail">
          <section className="activity-card">
            <div className="section-mini"><CheckCircle2 size={18} /><strong>Account</strong></div>
            <div className="profile-info-list">
              <span>{displayName}</span>
              {email && <span>{email}</span>}
            </div>
          </section>

          <AdminScannerPanel profile={profile} />

          <section className="creator-card">
            <span className="eyebrow">Creator Console</span>
            <h2>Creator tools are coming next.</h2>
            <div className="console-actions">
              <button onClick={onUpload}>New Upload</button>
              <button onClick={() => requireAccount("Managing review requests")}>Review Queue</button>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

export function EditProfilePage({ accountLabel, user, profile, onBack, onSaved }) {
  const initialDisplayName = getDisplayName(accountLabel, user, profile);
  const initialAvatarUrl = getAvatarUrl(user, profile);
  const [form, setForm] = useState({
    username: profile?.username || user?.user_metadata?.username || "",
    displayName: initialDisplayName,
    bio: profile?.bio || user?.user_metadata?.bio || "",
    email: user?.email || "",
  });
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl);
  const [avatarData, setAvatarData] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const initials = useMemo(
    () => getInitials(form.displayName || form.username || accountLabel),
    [form.displayName, form.username, accountLabel]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setNotice("");
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotice("Avatar must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      setAvatarPreview(result);
      setAvatarData(result);
      setRemoveAvatar(false);
      setNotice("");
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice("");

    try {
      const updatedProfile = await onSaved({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        avatarData: avatarData || undefined,
        removeAvatar,
      });

      setAvatarPreview(updatedProfile?.avatar_url || "");
      setAvatarData("");
      setRemoveAvatar(false);
      setNotice("Profile saved successfully.");
    } catch (error) {
      setNotice(error.message || "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <section className="edit-profile-page">
      <div className="edit-page-heading">
        <div>
          <span className="eyebrow">Account settings</span>
          <h1>Edit profile</h1>
          <p>Keep your creator identity clear before you publish your next project.</p>
        </div>
        <button className="back-button" onClick={onBack}><ArrowLeft size={17} />Back to profile</button>
      </div>

      <div className="edit-profile-layout">
        <section className="edit-avatar-panel">
          <span className="eyebrow">Profile photo</span>
          <div className="edit-avatar-frame">
            {avatarPreview ? <img src={avatarPreview} alt="Profile preview" /> : <span>{initials}</span>}
          </div>
          <label className="upload-avatar-button">
            <ImagePlus size={17} />Change photo
            <input className="edit-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} />
          </label>
          <small>Use a square image for the cleanest avatar crop.</small>
        </section>

        <form className="edit-form-panel edit-profile-form" onSubmit={handleSubmit}>
          <div className="form-panel-heading">
            <div><span className="eyebrow">Public identity</span><h2>Your details</h2></div>
            <CheckCircle2 size={22} />
          </div>

          <label>Username<input name="username" value={form.username} onChange={handleChange} required /></label>
          <label>Display name<input name="displayName" value={form.displayName} onChange={handleChange} /></label>
          <label>
            Bio
            <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Tell players what you make." rows="4" />
          </label>
          <label>
            Email
            <span className="field-with-icon"><input name="email" value={form.email} readOnly /><LockKeyhole size={16} /></span>
          </label>

          {notice && <p className="edit-notice">{notice}</p>}

          <div className="edit-form-actions">
          <button className="save-button" type="submit" disabled={isSaving}>
          <Save size={17} />
          {isSaving ? "Saving..." : "Save changes"}
          </button>

        <button className="cancel-button" type="button" onClick={onBack}>Cancel</button>
          </div>
        </form>
      </div>

      <section className="edit-settings-panel">
        <div><span className="eyebrow">Account settings</span><h2>Security and access</h2></div>

        <div className="settings-row">
          <div><strong>Change password</strong><span>Password management will be connected to the auth flow.</span></div>
          <button type="button" onClick={() => setNotice("Password management is coming next.")}><LockKeyhole size={16} />Coming soon</button>
        </div>

        <div className="settings-row danger-row">
          <div><strong>Delete account</strong><span>This action will require a separate confirmation flow.</span></div>
          <button type="button" onClick={() => setNotice("Account deletion is not available yet.")}><Trash2 size={16} />Not available</button>
        </div>
      </section>
    </section>
  );
}


export function UploadPage({ onBack, profile }) {
  const [form, setForm] = useState({ title: "", description: "", genre: "", gameFile: null });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadId, setUploadId] = useState("");
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    if (!uploadId) return undefined;

    let active = true;
    const poll = async () => {
      try {
        const result = await getUploadStatus(uploadId);
        if (!active) return;
        setScanStatus(result.scan_status);
        if (["APPROVED", "REJECTED", "MANUAL_REVIEW", "SCAN_ERROR"].includes(result.scan_status)) {
          setNotice(
            result.scan_status === "APPROVED"
              ? "Scan passed. Your game is safely stored and ready for moderation."
              : result.scan_status === "MANUAL_REVIEW"
                ? "The automated scan found something that needs moderator review."
                : result.scan_status === "REJECTED"
                  ? "The upload was rejected and will not be published."
                  : "The scan could not complete, so the upload remains blocked."
          );
        }
      } catch (pollError) {
        if (active) setError(pollError.message);
      }
    };

    poll();
    const interval = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [uploadId]);

  const handleChange = (event) => {
    const { name, value, files, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : type === "checkbox" ? checked : value,
    }));
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.gameFile) {
      setError("Choose a game archive first.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadGame(form);
      setUploadId(result.file.id);
      setScanStatus(result.file.scan_status);
      setNotice(result.message);
      setForm({ title: "", description: "", genre: "", gameFile: null });
      event.target.reset();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };

  const statusLabel = scanStatus
    ? scanStatus.replaceAll("_", " ").toLowerCase()
    : "waiting to upload";

  return (
    <section className="upload-page">
      <div className="upload-page-heading">
        <div>
          <span className="eyebrow">Creator console</span>
          <h1>Upload a game safely.</h1>
          <p>Your archive is quarantined first, then scanned by Cloudmersive before it can be released.</p>
        </div>
        <button className="back-button" onClick={onBack}><ArrowLeft size={17} />Back</button>
      </div>

      <div className="upload-layout">
        <form className="edit-form-panel upload-form" onSubmit={handleSubmit}>
          <div className="form-panel-heading">
            <div><span className="eyebrow">New project</span><h2>Game details</h2></div>
            <Upload size={22} />
          </div>

          <label>Title<input name="title" value={form.title} onChange={handleChange} required maxLength="120" /></label>
          <label>Genre<input name="genre" value={form.genre} onChange={handleChange} maxLength="60" placeholder="Puzzle, platformer, horror..." /></label>
          <label>Description<textarea name="description" value={form.description} onChange={handleChange} rows="6" minLength="10" maxLength="4000" required /></label>
          <label className="archive-picker">
            Game archive
            <input name="gameFile" type="file" accept=".zip,.7z,.rar,.tar,.gz,.tgz" onChange={handleChange} required />
            <small>ZIP, 7Z, RAR, TAR, GZ, or TGZ. Maximum 250MB.</small>
          </label>
          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="edit-notice">{notice}</p>}

          <button className="save-button" type="submit" disabled={isUploading}>
            <Upload size={17} />{isUploading ? "Uploading..." : "Upload for scanning"}
          </button>
        </form>

        <aside className="upload-security-card">
          <span className="eyebrow">Security pipeline</span>
          <h2>{statusLabel}</h2>
          <div className="upload-status-list">
            <span><CheckCircle2 size={17} />Account required</span>
            <span><ShieldCheck size={17} />Quarantine storage</span>
            <span><ShieldCheck size={17} />Cloudmersive scan or manual queue</span>
            <span><ShieldCheck size={17} />Policy review gates</span>
            <span><Clock3 size={17} />Manual review if suspicious</span>
          </div>
          <p>Game archives are never executed by the web server. A scanner error blocks release.</p>
        </aside>
      </div>
    </section>
  );
}

