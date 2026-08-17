import { useEffect, useState } from "react";
import { getUploadStatus, uploadGame } from "../api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Upload,
} from "lucide-react";
// Displays the game upload form and scan status.
export default function UploadPage({ onBack, profile }) {
  const [form, setForm] = useState({ title: "", description: "", genre: "", gameFile: null });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadId, setUploadId] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
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
    setIsUploading(true);
    try {
      const result = await uploadGame(form);
      setUploadId(result.file.id);
      setScanStatus(result.file.scan_status);
      setNotice(result.message);
      setForm({ title: "", description: "", genre: "", gameFile: null });
      setSelectedGenres([]);
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
          <label>Description<textarea name="description" value={form.description} onChange={handleChange} rows="6" minLength="10" maxLength="4000" required /></label>
          <label className="archive-picker">
            Game archive
            <input name="gameFile" type="file" accept=".zip,.7z,.rar,.tar,.gz,.tgz" onChange={handleChange} required />
            <small>ZIP, 7Z, RAR, TAR, GZ, or TGZ. Maximum 1GB.</small>           
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
