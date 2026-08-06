import { CheckCircle2 } from "lucide-react";

export default function ProfilePage({ accountLabel, user, profile, requireAccount }) {
  const displayName = profile?.username || user?.user_metadata?.username || accountLabel;
  const email = user?.email || "";

  return (
    <>
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          <span />
        </div>

        <div className="profile-copy">
          <span className="eyebrow">Creator profile</span>
          <h1>{displayName}</h1>
          <p>Your GemSpot profile is ready. Profile details will appear here once we connect creator data.</p>

          <div className="profile-meta">
            <span>
              <CheckCircle2 size={16} />
              Logged in
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <button onClick={() => requireAccount("Editing your profile")}>
            Edit Profile
          </button>
          <button className="secondary" onClick={() => requireAccount("Uploading a project")}>
            Upload Game
          </button>
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        {["Overview", "Projects", "Reviews", "Activity", "Settings"].map((tab, index) => (
          <button className={index === 0 ? "selected" : ""} key={tab}>
            {tab}
          </button>
        ))}
      </nav>

      <section className="profile-grid">
        <div className="feed-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Profile</span>
              <h2>Overview</h2>
            </div>
          </div>

          <section className="empty-profile-panel">
            <strong>No profile content yet.</strong>
            <span>
              Projects, reviews, collections, and activity will appear here once those systems are connected.
            </span>
          </section>
        </div>

        <aside className="side-rail">
          <section className="activity-card">
            <div className="section-mini">
              <CheckCircle2 size={18} />
              <strong>Account</strong>
            </div>

            <div className="profile-info-list">
              <span>{displayName}</span>
              {email && <span>{email}</span>}
            </div>
          </section>

          <section className="creator-card">
            <span className="eyebrow">Creator Console</span>
            <h2>Creator tools are coming next.</h2>

            <div className="console-actions">
              <button onClick={() => requireAccount("Uploading a project")}>
                New Upload
              </button>
              <button onClick={() => requireAccount("Managing review requests")}>
                Review Queue
              </button>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}