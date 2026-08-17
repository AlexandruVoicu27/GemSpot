import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, UserRound } from "lucide-react";
import { getPublicProfile } from "../api";

// Converts a public display name into a compact avatar fallback.
function getProfileInitials(profile) {
  const name = profile?.display_name || profile?.username || "Creator";

  return name
    .split(/s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Displays a creator profile that can be visited by other users.
export default function PublicProfilePage({ username, onBack }) {
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Loads one public profile and its published games.
  useEffect(() => {
    let active = true;

    getPublicProfile(username)
      .then((result) => {
        if (!active) return;

        setProfile(result.profile);
        setGames(Array.isArray(result.games) ? result.games : []);
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load this profile.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [username]);

  const displayName =
    profile?.display_name || profile?.username || "Creator";

  return (
    <section className="public-profile-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to games
      </button>

      {isLoading && (
        <p className="empty-state">Loading profile...</p>
      )}

      {error && (
        <p className="empty-state error-state">{error}</p>
      )}

      {!isLoading && !error && profile && (
        <>
          <section className="public-profile-hero">
            <div className="public-profile-avatar" aria-hidden="true">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{getProfileInitials(profile)}</span>
              )}
            </div>

            <div className="public-profile-copy">
              <span className="eyebrow">Creator profile</span>
              <h1>{displayName}</h1>
              <p className="public-profile-username">
                @{profile.username}
              </p>
              <p className="public-profile-bio">
                {profile.bio?.trim() || "This creator has not added a bio yet."}
              </p>
            </div>
          </section>

          <section className="public-profile-games">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Published work</span>
                <h2>{displayName}'s games</h2>
              </div>
              <Gamepad2 size={24} />
            </div>

            {games.length === 0 ? (
              <div className="empty-profile-panel">
                <UserRound size={30} />
                <strong>No published games yet.</strong>
                <span>This creator has not released a game on GemSpot.</span>
              </div>
            ) : (
              <div className="public-games-grid">
                {games.map((game) => (
                  <article className="public-game-card" key={game.id}>
                    <div className="public-game-card-icon">
                      <Gamepad2 size={30} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {game.genre || "Indie"}
                      </span>
                      <h3>{game.title}</h3>
                      <p>
                        {game.description || "No description provided."}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}