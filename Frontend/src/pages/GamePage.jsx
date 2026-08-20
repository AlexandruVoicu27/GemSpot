import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Gamepad2,
  MessageSquare,
  Play,
  Star,
} from "lucide-react";
import {
  claimGame,
  getGame,
  getGameFileUrl,
  saveGameReview,
} from "../api";

function displayReviewUser(review) {
  return (
    review.user?.display_name ||
    review.user?.username ||
    "Anonymous"
  );
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function GamePage({
  slug,
  focusReviews,
  isAuthenticated,
  onRequireAuth,
  onBack,
}) {
  const [game, setGame] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGetting, setIsGetting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reviewsRef = useRef(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError("");
    setNotice("");

    getGame(slug)
      .then((result) => {
        if (!active) return;

        setGame(result);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load this game.");
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
  }, [slug]);

  useEffect(() => {
    if (!isLoading && focusReviews && reviewsRef.current) {
      window.requestAnimationFrame(() => {
        reviewsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [isLoading, focusReviews]);

  const buildFile = game?.files?.find(
    (file) => file.kind === "GAME_BUILD"
  );

  const reviews = Array.isArray(game?.reviews) ? game.reviews : [];

  const averageRating = reviews.length
    ? (
        reviews.reduce((total, review) => total + review.rating, 0) /
        reviews.length
      ).toFixed(1)
    : "New";

  const handleGetGame = async () => {
    if (!isAuthenticated) {
      onRequireAuth("Getting a game");
      return;
    }

    if (!buildFile) {
      setError("This game does not have an available build yet.");
      return;
    }

    setIsGetting(true);
    setError("");
    setNotice("");

    const gameWindow = window.open(
      getGameFileUrl(buildFile.id),
      "_blank",
      "noopener,noreferrer"
    );

    try {
      await claimGame(game.slug);
      setHasClaimed(true);
      setNotice(
        "The game opened in a new tab. Come back here to leave your review."
      );

      if (!gameWindow) {
        setNotice("Allow pop-ups to open the game download.");
      }
    } catch (claimError) {
      gameWindow?.close();
      setError(claimError.message || "Could not get this game.");
    } finally {
      setIsGetting(false);
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      onRequireAuth("Writing a review");
      return;
    }

    if (!hasClaimed) {
      setError("Use “Get game & review” first.");
      return;
    }

    if (!rating) {
      setError("Choose a rating first.");
      return;
    }

    if (reviewBody.trim().length < 10) {
      setError("Your review must be at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      await saveGameReview(game.slug, rating, reviewBody.trim());

      const refreshedGame = await getGame(game.slug);
      setGame(refreshedGame);
      setNotice("Your review was saved.");
    } catch (submitError) {
      setError(submitError.message || "Could not save your review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="game-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to games
      </button>

      {isLoading && (
        <p className="empty-state">Loading game...</p>
      )}

      {error && (
        <p className="empty-state error-state">{error}</p>
      )}

      {!isLoading && !error && game && (
        <>
          <section className="game-page-hero">
            <div className="game-page-cover">
              {game.cover_image_url ? (
                <img src={game.cover_image_url} alt={game.title} />
              ) : (
                <Gamepad2 size={58} />
              )}
            </div>

            <div className="game-page-copy">
              <span className="eyebrow">
                {game.genre || "Indie game"}
              </span>

              <h1>{game.title}</h1>

              <p className="game-page-creator">
                by {game.creator?.username || "Unknown creator"}
              </p>

              <div className="game-page-stats">
                <span>
                  <Star size={16} fill="currentColor" />
                  {averageRating}
                </span>
                <span>
                  <MessageSquare size={16} />
                  {reviews.length} reviews
                </span>
                <span>
                  {buildFile ? <Download size={16} /> : <Play size={16} />}
                  {buildFile ? "Get build" : "Unavailable"}
                </span>
              </div>

              <p className="game-page-description">
                {game.description || "No description provided."}
              </p>

              <button
                className="game-primary-action"
                type="button"
                onClick={handleGetGame}
                disabled={isGetting}
              >
                {buildFile ? <Download size={18} /> : <Play size={18} />}
                {isGetting ? "Opening..." : "Get game & review"}
              </button>

              {notice && <p className="edit-notice">{notice}</p>}
            </div>
          </section>

          <section className="game-review-layout">
            <section className="game-review-form-panel">
              <span className="eyebrow">Leave feedback</span>
              <h2>How was the game?</h2>
              <p>
                Get the game first, then tell the creator what worked and what
                could improve.
              </p>

              <form onSubmit={handleSubmitReview}>
                <div className="game-rating-buttons" aria-label="Game rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Rate ${value} out of 5`}
                      className={value <= rating ? "selected" : ""}
                      onClick={() => {
                        if (!isAuthenticated) {
                          onRequireAuth("Rating a game");
                          return;
                        }

                        setRating(value);
                      }}
                    >
                      <Star size={21} fill="currentColor" />
                    </button>
                  ))}
                </div>

                <textarea
                  value={reviewBody}
                  disabled={!isAuthenticated}
                  onChange={(event) => setReviewBody(event.target.value)}
                  placeholder={
                    isAuthenticated
                      ? "What worked? What broke? Would you play it again?"
                      : "Log in to write a review."
                  }
                />

                <button
                  className="game-review-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  <MessageSquare size={17} />
                  {isSubmitting ? "Saving..." : "Submit review"}
                </button>
              </form>
            </section>

            <section
              className="game-reviews-panel"
              ref={reviewsRef}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Community feedback</span>
                  <h2>Reviews</h2>
                </div>
                <strong>{reviews.length}</strong>
              </div>

              {reviews.length === 0 && (
                <p className="empty-state">
                  No reviews yet. Be the first to play it.
                </p>
              )}

              {reviews.map((review) => (
                <article className="game-review-item" key={review.id}>
                  <div className="game-review-item-heading">
                    <strong>{displayReviewUser(review)}</strong>
                    <small>{formatDate(review.created_at)}</small>
                  </div>

                  <div className="game-review-stars">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        size={15}
                        fill={value <= review.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </div>

                  <p>{review.body}</p>
                </article>
              ))}
            </section>
          </section>
        </>
      )}
    </section>
  );
}