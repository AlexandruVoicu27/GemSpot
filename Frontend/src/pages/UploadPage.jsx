import { useEffect, useState } from "react";
import { getUploadStatus, uploadGame } from "../api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Upload,
} from "lucide-react";

const genres = [
  "Action",
  "Adventure",
  "Puzzle",
  "Horror",
  "Platformer",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Shooter",
  "Visual Novel",
];

// Displays the game upload form and scan status.
export default function UploadPage({ onBack }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    genre: "",
    gameFile: null,
    coverImage: null,
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadId, setUploadId] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);

  // Polls the backend until the uploaded game receives a scan result.
  useEffect(() => {
    if (!uploadId) return undefined;

    let active = true;

    // Requests the current scan status for the uploaded archive.
    const poll = async () => {
      try {
        const result = await getUploadStatus(uploadId);

        if (!active) return;

        setScanStatus(result.scan_status);

        if (
          ["APPROVED", "REJECTED", "MANUAL_REVIEW", "SCAN_ERROR"].includes(
            result.scan_status
          )
        ) {
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
        if (active) {
          setError(pollError.message || "Could not load the scan status.");
        }
      }
    };

    poll();

    const interval = window.setInterval(poll, 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [uploadId]);

  // Updates text fields and file fields in the upload form.
  const handleChange = (event) => {
    const { name, value, files, type } = event.target;

    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : type === "checkbox" ? event.target.checked : value,
    }));

    setError("");
    setNotice("");
  };

  // Adds or removes a genre and keeps the form's genre text synchronized.
  const toggleGenre = (genre) => {
    setSelectedGenres((currentGenres) => {
      const nextGenres = currentGenres.includes(genre)
        ? currentGenres.filter((item) => item !== genre)
        : [...currentGenres, genre];

      setForm((currentForm) => ({
        ...currentForm,
        genre: nextGenres.join(", "),
      }));

      return nextGenres;
    });

    setError("");
    setNotice("");
  };

  // Sends the archive and optional cover image to the backend.
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

      setForm({
        title: "",
        description: "",
        genre: "",
        gameFile: null,
        coverImage: null,
      });
      setSelectedGenres([]);
      event.target.reset();
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
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
        </div>

        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back
        </button>
      </div>

      <div className="upload-layout">
        <form className="edit-form-panel upload-form" onSubmit={handleSubmit}>
          <div className="form-panel-heading">
            <div>
              <span className="eyebrow">New project</span>
              <h2>Game details</h2>
            </div>
            <Upload size={22} />
          </div>

          <label>
            Title
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength="120"
            />
          </label>

          <fieldset className="genre-picker">
            <legend>Genre</legend>

            <div className="genre-options">
              {genres.map((genre) => (
                <button
                  className={
                    selectedGenres.includes(genre)
                      ? "genre-option selected"
                      : "genre-option"
                  }
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  key={genre}
                >
                  {genre}
                </button>
              ))}
            </div>

            <small>
              {selectedGenres.length > 0
                ? selectedGenres.join(", ")
                : "Select one or more genres."}
            </small>
          </fieldset>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="6"
              minLength="10"
              maxLength="4000"
              required
            />
          </label>

          <label className="cover-picker">
            Game cover
            <input
              name="coverImage"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleChange}
            />
            <small>Optional. PNG, JPG, or WebP. Maximum 5MB.</small>
          </label>

          <label className="archive-picker">
            Game archive
            <input
              name="gameFile"
              type="file"
              accept=".zip,.7z,.rar,.tar,.gz,.tgz"
              onChange={handleChange}
              required
            />
            <small>
              ZIP, 7Z, RAR, TAR, GZ, or TGZ. Maximum 1GB.
            </small>
          </label>

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="edit-notice">{notice}</p>}

          <button className="save-button" type="submit" disabled={isUploading}>
            <Upload size={17} />
            {isUploading ? "Uploading..." : "Upload for scanning"}
          </button>
        </form>

        <aside className="upload-security-card">
          <span className="eyebrow">Security pipeline</span>
          <h2>{statusLabel}</h2>

          <div className="upload-status-list">
            <span>
              <CheckCircle2 size={17} />
              Account required
            </span>
            <span>
              <ShieldCheck size={17} />
              Quarantine storage
            </span>
            <span>
              <ShieldCheck size={17} />
              Cloudmersive scan or manual queue
            </span>
            <span>
              <ShieldCheck size={17} />
              Policy review gates
            </span>
            <span>
              <Clock3 size={17} />
              Manual review if suspicious
            </span>
          </div>

          <p>
            Game archives are never executed by the web server. A scanner error
            blocks release.
          </p>
        </aside>
      </div>
    </section>
  );
}