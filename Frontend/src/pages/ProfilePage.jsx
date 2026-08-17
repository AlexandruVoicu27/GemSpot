import { CheckCircle2 } from "lucide-react";
import { getAvatarUrl, getDisplayName, getInitials } from "./profileHelpers";
// Displays the current user profile page.
export default function ProfilePage({
  accountLabel,
  user,
  profile,
  requireAccount,
  onEdit,
  onUpload,
  onReview,
  onAdmin,
  onProjects,
}) {
  const displayName = getDisplayName(accountLabel, user, profile);
  const email = user?.email || "";
  const avatarUrl = getAvatarUrl(user, profile);
  const canModerate = ["ADMIN", "MODERATOR"].includes(profile?.role);
  const isAdmin = profile?.role === "ADMIN";


  return (
    <>
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{getInitials(displayName)}</span>}
        </div>

        <div className="profile-copy">
          <span className="eyebrow">Creator profile</span>
          <h1>{displayName}</h1>
         <p className="profile-bio">
         {profile?.bio?.trim() || "No bio added yet."}
         </p>
        </div>

        <div className="profile-actions">
          <button onClick={onEdit}>Edit Profile</button>
          <button className="secondary" onClick={onUpload}>Upload Game</button>
          {canModerate && (
            <button className="website-settings-button" onClick={onReview}>
              Review uploads
            </button>
          )}
          {isAdmin && (
            <button className="admin-tools-button" onClick={onAdmin}>
              Admin management
            </button>
          )}
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        {["Overview", "Projects", "Reviews", "Activity", "Settings"].map((tab, index) => (
          <button
            className={index === 0 ? "selected" : ""}
            onClick={tab === "Projects" ? onProjects : tab === "Settings" ? onEdit : undefined}
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


          <section className="creator-card">
            <span className="eyebrow">Creator Console</span>
            <h2>Creator tools are coming next.</h2>
            <div className="console-actions">
              <button onClick={onUpload}>New Upload</button>
              <button
                onClick={canModerate ? onReview : () => requireAccount("Managing review requests")}
              >
                Review Queue
              </button>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}
