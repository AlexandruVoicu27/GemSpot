import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Gamepad2,
  MessageSquare,
  Play,
  Reply,
  Star,
  Trash2,
} from "lucide-react";
import {
  claimGame,
  getGame,
  getGameFileUrl,
  getReviewState,
  saveGameReview,
  saveCreatorReply,
  deleteGameReview,
} from "../api";



function displayReviewUser(review) {
  return (
    review.user?.display_name ||
    review.user?.username ||
    "Anonymous"
  );
}

// Supabase can return a one-to-one relationship as an object or a one-item array.
function getCreatorReply(review) {
  if (Array.isArray(review?.reply)) {
    return review.reply[0] || null;
  }

  return review?.reply || null;
}

function displayReplyCreator(reply) {
  const creator = Array.isArray(reply?.creator)
    ? reply.creator[0]
    : reply?.creator;

  return creator?.display_name || creator?.username || "Game creator";
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
  profile,
  onRequireAuth,
  onBack,
}) {
  const isAdmin = profile?.role === "ADMIN";
  const [game, setGame] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [existingReview, setExistingReview] = useState(null);
  // Stores a separate reply draft for each review.
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReviewAction, setActiveReviewAction] = useState(null);
  const [reviewActionError, setReviewActionError] = useState("");
  const [reviewActionNotice, setReviewActionNotice] = useState("");
  // Creators cannot review their own games.
  const [isCreator, setIsCreator] = useState(false);
  // Prevents the form from making decisions while account state is loading.
  const [isReviewStateLoading, setIsReviewStateLoading] = useState(false);
  // A validation error should not make the entire game page disappear.
  const [reviewError, setReviewError] = useState("");
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGetting, setIsGetting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reviewsRef = useRef(null);

  // The first render happens before the game request finishes.
  const screenshots = (game?.files || []).filter(
    (file) => file.kind === "SCREENSHOT" && Boolean(file.url)
  );


  useEffect(() => {
  let active = true;

  // Guests do not have private account state to load.
  if (!isAuthenticated) {
    setHasClaimed(false);
    setExistingReview(null);
    setIsCreator(false);
    setIsReviewStateLoading(false);
    return undefined;
  }
   // Reset state when navigating from one game to another.
  setHasClaimed(false);
  setExistingReview(null);
  setIsCreator(false);
  setRating(0);
  setReviewBody("");
  setReviewError("");
  setIsReviewStateLoading(true);

  getReviewState(slug)
    .then((state) => {
      // Ignore the result if the component was removed while loading.
      if (!active) {
        return;
      }

      setHasClaimed(Boolean(state.hasClaimed));
      setIsCreator(Boolean(state.isCreator));
      setExistingReview(state.review || null);

      // If the user already reviewed this game, load that review into
      // the form so pressing the button updates it instead of duplicating it.
      if (state.review) {
        setRating(state.review.rating);
        setReviewBody(state.review.body);
      }
    })
    .catch((stateError) => {
      if (active) {
        setReviewError(
          stateError.message || "Could not load your review status."
        );
      }
    })
    .finally(() => {
      if (active) {
        setIsReviewStateLoading(false);
      }
    });

  // Prevent an old request from updating a different page.
  return () => {
    active = false;
  };
}, [slug, isAuthenticated]);

async function handleDeleteReview(review) {
  const confirmed = window.confirm(
    `Delete ${displayReviewUser(review)}'s review permanently?`
  );

  if (!confirmed) return;

  setActiveReviewAction(review.id);
  setReviewActionError("");
  setReviewActionNotice("");

  try {
    await deleteGameReview(game.slug, review.id);

    // Remove the deleted review immediately from the page.
    setGame((currentGame) => ({
      ...currentGame,
      reviews: currentGame.reviews.filter(
        (currentReview) => currentReview.id !== review.id
      ),
    }));

    if (existingReview?.id === review.id) {
      setExistingReview(null);
    }

    setReviewActionNotice("Review deleted.");
  } catch (deleteError) {
    setReviewActionError(
      deleteError.message || "Could not delete the review."
    );
  } finally {
    setActiveReviewAction(null);
  }
}

async function handleSaveReply(review) {
  const existingReply = getCreatorReply(review);
  const body = (
    replyDrafts[review.id] ??
    existingReply?.body ??
    ""
  ).trim();

  if (body.length < 2) {
    setReviewActionError("Your creator response must be at least 2 characters.");
    return;
  }

  setActiveReviewAction(review.id);
  setReviewActionError("");
  setReviewActionNotice("");

  try {
    const result = await saveCreatorReply(
      game.slug,
      review.id,
      body
    );

    // Replace only the updated review's reply.
    setGame((currentGame) => ({
      ...currentGame,
      reviews: currentGame.reviews.map((currentReview) =>
        currentReview.id === review.id
          ? { ...currentReview, reply: result.reply }
          : currentReview
      ),
    }));

    // The saved response is displayed above, so reset the editor for fresh input.
    setReplyDrafts((currentDrafts) => ({
      ...currentDrafts,
      [review.id]: "",
    }));
    setReviewActionNotice(
      existingReply ? "Creator response updated." : "Creator response posted."
    );
  } catch (replyError) {
    setReviewActionError(
      replyError.message || "Could not save your reply."
    );
  } finally {
    setActiveReviewAction(null);
  }
}
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
      // Do not make an eligibility decision until the database check finishes.
    if (isReviewStateLoading) {
      setReviewError("Please wait while we check your account.");
      return;
    }
     if (isCreator) {
      setReviewError("You cannot review your own game.");
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
  // Save the backend response in a variable named result.
  const result = await saveGameReview(
    game.slug,
    rating,
    reviewBody.trim()
  );

  // The backend response contains the created or updated review.
  setExistingReview(result.review);

  // Reload the public information, including reviews and average rating.
  const refreshedGame = await getGame(game.slug);
  setGame(refreshedGame);

  setNotice(
    existingReview
      ? "Your review was updated."
      : "Your review was submitted."
  );
} catch (submitError) {
  setReviewError(
    submitError.message || "Could not save your review."
  );
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
          {screenshots.length > 0 && (
            <section className="game-screenshot-section">
              <p className="eyebrow">GAME MEDIA</p>
              <h2>Screenshots</h2>

              <div className="game-screenshot-gallery">
                {screenshots.map((screenshot) => (
                  <a
                    key={screenshot.id}
                    href={screenshot.url}
                    target="_blank"
                    rel="noreferrer"
                    className="game-screenshot-card"
                  >
                    <img
                      src={screenshot.url}
                      alt={`${game.title} screenshot`}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="game-review-layout">
            <section className="game-review-form-panel">
              <span className="eyebrow">Leave feedback</span>
              <h2>How was the game?</h2>
            <p>
              Get the game first, then tell the creator what worked and what
              could improve.
            </p>

            {isReviewStateLoading && (
              <p className="review-state-note">
                Checking your account's game access...
              </p>
            )}

            {!isReviewStateLoading && isCreator && (
              <p className="review-state-note">
                You created this game, so you cannot review it.
              </p>
            )}

            {!isReviewStateLoading &&
              isAuthenticated &&
              !isCreator &&
              hasClaimed &&
              !existingReview && (
                <p className="review-state-note success">
                  This game is on your account. You can leave a review.
                </p>
              )}

            {existingReview && (
              <p className="review-state-note success">
                Editing your existing review.
              </p>
            )}

            {reviewError && (
              <p className="review-form-error">
                {reviewError}
              </p>
            )}

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
                disabled={
                  !isAuthenticated ||
                  isReviewStateLoading ||
                  isCreator ||
                  !hasClaimed
                }
                onChange={(event) => {
                  setReviewBody(event.target.value);
                  setReviewError("");
                }}
                placeholder={
                  !isAuthenticated
                    ? "Log in to write a review."
                    : isCreator
                      ? "Creators cannot review their own games."
                      : !hasClaimed
                        ? "Get the game before writing a review."
                        : "What worked? What broke? Would you play it again?"
                }
              />

                  <button
                className="game-review-submit"
                type="submit"
                disabled={
                  isSubmitting ||
                  isReviewStateLoading ||
                  isCreator
                }
              >
                <MessageSquare size={17} />

                {isSubmitting
                  ? "Saving..."
                  : existingReview
                    ? "Update review"
                    : "Submit review"}
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

              {reviewActionError && (
                <p className="review-action-message error" role="alert">
                  {reviewActionError}
                </p>
              )}

              {reviewActionNotice && (
                <p className="review-action-message success" role="status">
                  {reviewActionNotice}
                </p>
              )}

              {reviews.length === 0 && (
                <p className="empty-state">
                  No reviews yet. Be the first to play it.
                </p>
              )}

              {reviews.map((review) => {
                const creatorReply = getCreatorReply(review);
                const replyDraft =
                  replyDrafts[review.id] ?? creatorReply?.body ?? "";
                const actionInProgress = activeReviewAction === review.id;

                return (
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

                    <p className="game-review-body">{review.body}</p>

                    {creatorReply && (
                      <aside className="creator-review-reply">
                        <div className="creator-review-reply-heading">
                          <span>
                            <Reply size={15} />
                            Creator response
                          </span>
                          <small>
                            {formatDate(
                              creatorReply.updated_at ||
                                creatorReply.created_at
                            )}
                          </small>
                        </div>
                        <strong>{displayReplyCreator(creatorReply)}</strong>
                        <p>{creatorReply.body}</p>
                      </aside>
                    )}

                    {isCreator && (
                      <form
                        className="creator-reply-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSaveReply(review);
                        }}
                      >
                        <label>
                          {creatorReply
                            ? "Edit your creator response"
                            : "Respond as the creator"}
                        </label>
                        <textarea
                          value={replyDraft}
                          maxLength={2000}
                          rows={3}
                          disabled={actionInProgress}
                          placeholder="Thank the player, answer their feedback, or share an update..."
                          onChange={(event) => {
                            setReplyDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [review.id]: event.target.value,
                            }));
                            setReviewActionError("");
                            setReviewActionNotice("");
                          }}
                        />
                        <div className="creator-reply-form-footer">
                          <small>{replyDraft.length}/2000</small>
                          <button
                            className="creator-reply-submit"
                            type="submit"
                            disabled={
                              actionInProgress ||
                              replyDraft.trim().length < 2
                            }
                          >
                            <Reply size={16} />
                            {actionInProgress
                              ? "Saving..."
                              : creatorReply
                                ? "Update response"
                                : "Post response"}
                          </button>
                        </div>
                      </form>
                    )}

                    {isAdmin && (
                      <div className="review-admin-controls">
                        <span>Administrator moderation</span>
                        <button
                          className="review-admin-delete"
                          type="button"
                          disabled={actionInProgress}
                          onClick={() => handleDeleteReview(review)}
                        >
                          <Trash2 size={16} />
                          {actionInProgress ? "Working..." : "Delete review"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          </section>
        </>
      )}
    </section>
  );
}