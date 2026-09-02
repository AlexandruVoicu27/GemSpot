import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Gamepad2,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react";
import { getCreators } from "../api";

const filters = ["Top rated", "Most reviewed", "Most games", "A–Z"];

function getCreatorName(creator) {
  return creator.displayName || creator.username || "Creator";
}

function getCreatorInitials(creator) {
  return getCreatorName(creator)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCount(value) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function CreatorsPage({ onOpenProfile }) {
  const [creators, setCreators] = useState([]);
  const [activeFilter, setActiveFilter] = useState("Top rated");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getCreators()
      .then((result) => {
        if (!active) return;

        setCreators(Array.isArray(result) ? result : []);
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load creators.");
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
  }, []);

  const visibleCreators = useMemo(() => {
    const sortedCreators = [...creators];

    if (activeFilter === "Most reviewed") {
      return sortedCreators.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    if (activeFilter === "Most games") {
      return sortedCreators.sort((a, b) => b.publishedGames - a.publishedGames);
    }

    if (activeFilter === "A–Z") {
      return sortedCreators.sort((a, b) =>
        getCreatorName(a).localeCompare(getCreatorName(b))
      );
    }

    return sortedCreators.sort(
      (a, b) => (b.averageRating || 0) - (a.averageRating || 0)
    );
  }, [activeFilter, creators]);

  return (
    <section className="creator-directory-page">
      <div className="section-heading creator-directory-heading">
        <div>
          <span className="eyebrow">Discover people</span>
          <h1>Creators</h1>
          <p>
            Find the people behind GemSpot’s games and explore everything
            they’ve published.
          </p>
        </div>

        <div
          className="filter-row"
          role="tablist"
          aria-label="Creator filters"
        >
          {filters.map((filter) => (
            <button
              className={activeFilter === filter ? "selected" : ""}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              key={filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="empty-state">Loading creators...</p>
      )}

      {!isLoading && error && (
        <p className="empty-state error-state">{error}</p>
      )}

      {!isLoading && !error && visibleCreators.length === 0 && (
        <div className="empty-profile-panel">
          <UserRound size={30} />
          <strong>No creators to show yet.</strong>
          <span>Creators will appear after publishing their first game.</span>
        </div>
      )}

      <div className="creator-list">
        {visibleCreators.map((creator) => (
          <article className="creator-profile-card" key={creator.id}>
            {/* Profile picture appears before the creator's name. */}
            <div className="creator-avatar-panel">
              <div className="creator-card-avatar">
                {creator.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt={`${getCreatorName(creator)} profile`}
                  />
                ) : (
                  <span>{getCreatorInitials(creator)}</span>
                )}
              </div>
            </div>

            <div className="creator-card-info">
              <div className="creator-card-heading">
                <span className="eyebrow">Creator profile</span>
                <h2>{getCreatorName(creator)}</h2>
                <p>@{creator.username}</p>
              </div>

              <p className="creator-card-bio">
                {creator.bio?.trim() ||
                  "This creator has not added a bio yet."}
              </p>

              {creator.genres.length > 0 && (
                <div className="genre-options creator-genres">
                  {creator.genres.map((genre) => (
                    <span className="genre-option" key={genre}>
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              <div className="game-stats creator-stats">
                <span>
                  <Star size={15} fill="currentColor" />
                  {creator.averageRating
                    ? `${creator.averageRating} average`
                    : "New"}
                </span>

                <span>
                  <Gamepad2 size={15} />
                  {creator.publishedGames}{" "}
                  {creator.publishedGames === 1 ? "game" : "games"}
                </span>

                <span>
                  <MessageSquare size={15} />
                  {formatCount(creator.reviewCount)}{" "}
                  {creator.reviewCount === 1 ? "review" : "reviews"}
                </span>
              </div>

              {creator.featuredGames.length > 0 && (
                <div className="creator-featured-games">
                  <span className="creator-featured-label">
                    Recent games
                  </span>

                  <div className="creator-game-covers">
                    {creator.featuredGames.map((game) => (
                      <div
                        className="creator-game-cover"
                        title={game.title}
                        key={game.id}
                      >
                        {game.coverImage ? (
                          <img src={game.coverImage} alt={game.title} />
                        ) : (
                          <Gamepad2 size={18} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="game-actions creator-card-actions">
                <button
                  type="button"
                  onClick={() => onOpenProfile(creator.username)}
                >
                  View profile
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}