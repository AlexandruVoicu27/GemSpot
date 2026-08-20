import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  LockKeyhole,
  Save,
  Trash2,
} from "lucide-react";
import { getAvatarUrl, getDisplayName, getInitials } from "./profileHelpers";
// Displays the profile editing form.
export default function EditProfilePage({ accountLabel, user, profile, onBack, onSaved }) {
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
