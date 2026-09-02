const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");
const router = express.Router();



// Permanently deletes a review.
// Authentication proves the account and requireAdmin checks its database role.
router.delete(
  "/:slug/reviews/:reviewId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    if (!requireSupabaseConfig(res)) return;

    const gameResult = await getPublishedGame(req.params.slug);

    if (gameResult.error) {
      return res.status(500).json({
        error: "Could not load the game.",
      });
    }

    if (!gameResult.data) {
      return res.status(404).json({
        error: "Game not found.",
      });
    }

    // game_id prevents an ID belonging to a different game from being deleted.
    const deleteResult = await supabaseAdmin
      .from("reviews")
      .delete()
      .eq("id", req.params.reviewId)
      .eq("game_id", gameResult.data.id)
      .select("id")
      .maybeSingle();

    if (deleteResult.error) {
      return res.status(500).json({
        error: "Could not delete the review.",
      });
    }

    if (!deleteResult.data) {
      return res.status(404).json({
        error: "Review not found.",
      });
    }

    return res.json({
      message: "Review deleted.",
      reviewId: deleteResult.data.id,
    });
  }
);


// Creates or updates the game creator's reply.
// There can only be one reply per review because review_id is unique.
router.put(
  "/:slug/reviews/:reviewId/reply",
  requireAuth,
  async (req, res) => {
    if (!requireSupabaseConfig(res)) return;

    const body = String(req.body?.body || "").trim();

    if (body.length < 2 || body.length > 2000) {
      return res.status(400).json({
        error: "Reply must contain between 2 and 2000 characters.",
      });
    }

    const gameResult = await getPublishedGame(req.params.slug);

    if (gameResult.error) {
      return res.status(500).json({
        error: "Could not load the game.",
      });
    }

    if (!gameResult.data) {
      return res.status(404).json({
        error: "Game not found.",
      });
    }
    // Allows only the original review author to reply to the creator's response.
router.put(
  "/:slug/reviews/:reviewId/reply/follow-up",
  requireAuth,
  async (req, res) => {
    if (!requireSupabaseConfig(res)) return;

    const body = String(req.body?.body || "").trim();

    if (body.length < 2 || body.length > 2000) {
      return res.status(400).json({
        error: "Your reply must contain between 2 and 2000 characters.",
      });
    }

    const gameResult = await getPublishedGame(req.params.slug);

    if (gameResult.error) {
      return res.status(500).json({
        error: "Could not load the game.",
      });
    }

    if (!gameResult.data) {
      return res.status(404).json({
        error: "Game not found.",
      });
    }

    // Load the review and confirm that it belongs to this game.
    const reviewResult = await supabaseAdmin
      .from("reviews")
      .select("id, user_id")
      .eq("id", req.params.reviewId)
      .eq("game_id", gameResult.data.id)
      .maybeSingle();

    if (reviewResult.error) {
      return res.status(500).json({
        error: "Could not load the review.",
      });
    }

    if (!reviewResult.data) {
      return res.status(404).json({
        error: "Review not found.",
      });
    }

    // Security check: only the person who wrote the review can follow up.
    if (reviewResult.data.user_id !== req.user.id) {
      return res.status(403).json({
        error: "Only the original reviewer can reply to this response.",
      });
    }

    // A reviewer cannot follow up until the creator has responded.
    const creatorReplyResult = await supabaseAdmin
      .from("review_replies")
      .select("id, reviewer_created_at")
      .eq("review_id", reviewResult.data.id)
      .maybeSingle();

    if (creatorReplyResult.error) {
      return res.status(500).json({
        error: "Could not load the creator response.",
      });
    }

    if (!creatorReplyResult.data) {
      return res.status(400).json({
        error: "The creator has not responded to this review yet.",
      });
    }

    const now = new Date().toISOString();

    const updateResult = await supabaseAdmin
      .from("review_replies")
      .update({
        reviewer_id: req.user.id,
        reviewer_body: body,

        // Preserve the original creation date when editing.
        reviewer_created_at:
          creatorReplyResult.data.reviewer_created_at || now,

        reviewer_updated_at: now,
      })
      .eq("id", creatorReplyResult.data.id)
      .select(
        `
          id,
          body,
          created_at,
          updated_at,
          reviewer_id,
          reviewer_body,
          reviewer_created_at,
          reviewer_updated_at,
          creator:users!review_replies_creator_id_fkey(
            username,
            display_name
          )
        `
      )
      .single();

    if (updateResult.error) {
      return res.status(500).json({
        error: "Could not save your reply.",
      });
    }

    return res.json({
      message: "Reviewer follow-up saved.",
      reply: updateResult.data,
    });
  }
);

    // This is the real creator permission check.
    if (gameResult.data.creator_id !== req.user.id) {
      return res.status(403).json({
        error: "Only the game's creator can reply to its reviews.",
      });
    }

    // Confirm that the review belongs to this particular game.
    const reviewResult = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("id", req.params.reviewId)
      .eq("game_id", gameResult.data.id)
      .maybeSingle();

    if (reviewResult.error) {
      return res.status(500).json({
        error: "Could not load the review.",
      });
    }

    if (!reviewResult.data) {
      return res.status(404).json({
        error: "Review not found.",
      });
    }

    // Upsert means create the first time and update afterward.
    const replyResult = await supabaseAdmin
      .from("review_replies")
      .upsert(
        {
          review_id: reviewResult.data.id,
          creator_id: req.user.id,
          body,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "review_id",
        }
      )
        .select(
      `
        id,
        body,
        created_at,
        updated_at,
        reviewer_id,
        reviewer_body,
        reviewer_created_at,
        reviewer_updated_at,
        creator:users!review_replies_creator_id_fkey(
          username,
          display_name
        )
      `
    )
      .single();

    if (replyResult.error) {
      return res.status(500).json({
        error: "Could not save the creator reply.",
      });
    }

    return res.json({
      message: "Creator reply saved.",
      reply: replyResult.data,
    });
  }
);
function getCreatorName(creator) {
  if (Array.isArray(creator)) {
    return creator[0]?.username || "Unknown creator";
  }

  return creator?.username || "Unknown creator";
}

function getGameMode(files = []) {
  const hasDownloadableBuild = files.some((file) => file.kind === "GAME_BUILD");
  return hasDownloadableBuild ? "Download" : "Unavailable";
}

function getAverageRating(reviews = []) {
  if (!reviews.length) {
    return "New";
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return (total / reviews.length).toFixed(1);
}


// Returns the scan status of the game's uploaded build.
function getBuildStatus(files = []) {
  const build = files.find((file) => file.kind === "GAME_BUILD");
  return build?.scan_status || "PENDING";
}

function toGameCard(game) {
  return {
    id: game.id,
    title: game.title,
    slug: game.slug,
    creator: getCreatorName(game.creator),
    tag: game.genre || "Indie",
    coverImage: game.cover_image_url || "",
    score: getAverageRating(game.reviews),
    plays: "0",
    reviews: game.reviews?.length || 0,
    mode: getGameMode(game.files),
    palette: "mint",
  };
}


// Converts a creator-owned game into a Projects page card.
function toProjectCard(game) {
  return {
    ...toGameCard(game),
    status: game.status,
    buildStatus: getBuildStatus(game.files),
  };
}

router.get("/", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("games")
    .select(
      `
        id,
        title,
        slug,
        description,
        genre,
        status,
        created_at,
        cover_image_url,
        creator:users(username),
        files:game_files(kind),
        reviews(id, rating)
      `
    )
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data.map(toGameCard));
});


// Returns all games owned by the authenticated creator,
// including drafts waiting to be published.
router.get("/mine", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("games")
    .select(
      `
        id,
        title,
        slug,
        genre,
        status,
        created_at,
        cover_image_url,
        creator:users(username),
        files:game_files(kind, scan_status),
        reviews(id, rating)
      `
    )
    .eq("creator_id", req.user.id)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data.map(toProjectCard));
});

// Returns published games claimed by this account but not yet reviewed.
router.get("/awaiting-review", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const [claimsResult, reviewsResult] = await Promise.all([
    supabaseAdmin
      .from("game_claims")
      .select(`
        id,
        created_at,
        status,
        game:games!inner(
          id,
          title,
          slug,
          genre,
          status,
          creator_id,
          cover_image_url,
          creator:users(username)
        )
      `)
      .eq("user_id", req.user.id)
      .eq("status", "CLAIMED")
      .eq("game.status", "PUBLISHED")
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("reviews")
      .select("game_id")
      .eq("user_id", req.user.id),
  ]);

  if (claimsResult.error || reviewsResult.error) {
    return res.status(500).json({
      error: "Could not load games awaiting your review.",
    });
  }

  const reviewedGameIds = new Set(
    (reviewsResult.data || []).map((review) => review.game_id)
  );

  const games = (claimsResult.data || [])
    .map((claim) => {
      const game = Array.isArray(claim.game)
        ? claim.game[0]
        : claim.game;

      if (
        !game ||
        game.status !== "PUBLISHED" ||
        game.creator_id === req.user.id ||
        reviewedGameIds.has(game.id)
      ) {
        return null;
      }

      return {
        claimId: claim.id,
        claimedAt: claim.created_at,
        id: game.id,
        title: game.title,
        slug: game.slug,
        genre: game.genre || "Indie",
        coverImage: game.cover_image_url || "",
        creator: getCreatorName(game.creator),
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  return res.json(games);
});

// Publishes one game owned by the authenticated creator.
// This changes only games.status and never changes game_files.
router.post("/:gameId/publish", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const result = await supabaseAdmin
    .from("games")
    .select(
      `
        id,
        creator_id,
        status,
        files:game_files(kind, scan_status)
      `
    )
    .eq("id", req.params.gameId)
    .maybeSingle();

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  if (!result.data) {
    return res.status(404).json({ error: "Game not found." });
  }

  if (result.data.creator_id !== req.user.id) {
    return res.status(403).json({
      error: "Only the game creator can publish this game.",
    });
  }

  if (result.data.status === "ARCHIVED") {
    return res.status(404).json({ error: "Game not found." });
  }

  const buildStatus = getBuildStatus(result.data.files);

  if (buildStatus !== "APPROVED") {
    return res.status(400).json({
      error: "The game build must be approved before publishing.",
    });
  }

  if (result.data.status === "PUBLISHED") {
    return res.json(result.data);
  }

  const updated = await supabaseAdmin
    .from("games")
    .update({ status: "PUBLISHED" })
    .eq("id", result.data.id)
    .select("id, status")
    .single();

  if (updated.error) {
    return res.status(500).json({ error: updated.error.message });
  }

  res.json(updated.data);
});


// Archives a game so it disappears without deleting its approved files.
// The creator can archive their own game; admins can archive any game.
router.delete("/:gameId", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const result = await supabaseAdmin
    .from("games")
    .select("id, creator_id, status")
    .eq("id", req.params.gameId)
    .maybeSingle();

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  if (!result.data) {
    return res.status(404).json({ error: "Game not found." });
  }

  const isOwner = result.data.creator_id === req.user.id;
  const isAdmin = req.user.profile?.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You cannot delete this game." });
  }

  const archived = await supabaseAdmin
    .from("games")
    .update({ status: "ARCHIVED" })
    .eq("id", result.data.id)
    .select("id, status")
    .single();

  if (archived.error) {
    return res.status(500).json({ error: archived.error.message });
  }

  res.json(archived.data);
});

// Returns one project to its creator for use on the project edit page.
// This must be registered at router level, not inside another route handler.
router.get("/:gameId/edit", requireAuth, async (req, res) => {
  try {
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select(`
        id,
        title,
        slug,
        description,
        genre,
        status,
        cover_image_url,
        files:game_files(
          id,
          kind,
          file_name,
          url,
          storage_path,
          size_bytes,
          created_at
        )
      `)
      .eq("id", req.params.gameId)
      .eq("creator_id", req.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!game) {
      return res.status(404).json({
        error: "Project not found or you do not own this project.",
      });
    }

    return res.json({
      id: game.id,
      title: game.title,
      slug: game.slug,
      description: game.description,
      status: game.status,
      coverImageUrl: game.cover_image_url,
      genres: String(game.genre || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),
      screenshots: (game.files || []).filter(
        (file) => file.kind === "SCREENSHOT"
      ),
    });
  } catch (error) {
    console.error("Could not load editable project:", error);

    return res.status(500).json({
      error: "Could not load the project.",
    });
  }
});

router.get("/:slug", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const query = supabaseAdmin
    .from("games")
    .select(
      `
        id,
        title,
        slug,
        description,
        genre,
        status,
        created_at,
        updated_at,
        cover_image_url,
        creator:users(id, username, display_name),
        files:game_files(id, kind, file_name, url, size_bytes, created_at),
        reviews(
          id,
          rating,
          body,
          created_at,
          updated_at,
          user:users(username, display_name),
           reply:review_replies(
            id,
            body,
            created_at,
            updated_at,
            reviewer_id,
            reviewer_body,
            reviewer_created_at,
            reviewer_updated_at,
            creator:users!review_replies_creator_id_fkey(
              username,
              display_name
            )
          )
        )      `
    );

  const { data, error } = await query.eq("slug", req.params.slug).maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.status !== "PUBLISHED") {
    return res.status(404).json({ error: "Game not found" });
  }

  res.json(data);
});

router.get("/:slug/reviews", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const gameQuery = supabaseAdmin
    .from("games")
    .select("id");

  const { data: game, error: gameError } = await gameQuery
    .eq("slug", req.params.slug)
    .maybeSingle();

  if (gameError) {
    return res.status(500).json({ error: gameError.message });
  }

  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, rating, body, created_at, user:users(username)")
    .eq("game_id", game.id)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});
function serializeReview(review) {
  const user = Array.isArray(review.user) ? review.user[0] : review.user;

  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    created_at: review.created_at,
    updated_at: review.updated_at,
    user: {
      username: user?.username || "Anonymous",
      display_name: user?.display_name || null,
    },
  };
}

async function getPublishedGame(slug) {
  return supabaseAdmin
    .from("games")
    .select("id, slug, title, creator_id, status")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
}

// Records that the authenticated user got/played the game.
router.get("/:slug/review-state", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }
  // Only published games can be downloaded and reviewed.
  const gameResult = await getPublishedGame(req.params.slug);
  if (gameResult.error) {
    return res.status(500).json({
      error: "Could not load the game.",
    });
  }
if (!gameResult.data) {
    return res.status(404).json({
      error: "Game not found.",
    });
  }
    const game = gameResult.data;

    const [claimResult, reviewResult] = await Promise.all([
    supabaseAdmin
      .from("game_claims")
      .select("id, status, created_at, reviewed_at")
      .eq("user_id", req.user.id)
      .eq("game_id", game.id)
      .maybeSingle(),

    supabaseAdmin
      .from("reviews")
      .select("id, rating, body, created_at, updated_at")
      .eq("user_id", req.user.id)
      .eq("game_id", game.id)
      .maybeSingle(),
  ]);

  if (claimResult.error || reviewResult.error) {
    return res.status(500).json({
      error: "Could not load your review eligibility.",
    });
  }
  return res.json({
     // A review also proves a claim existed because reviews reference claims.
    hasClaimed: Boolean(claimResult.data || reviewResult.data),

    // The frontend uses this to disable the creator's review form.
    // The review submission endpoint must still enforce this rule too.
    isCreator: game.creator_id === req.user.id,

    // If this is not null, the frontend can load it for editing.
    review: reviewResult.data || null,
  });
});

router.post("/:slug/claim", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const gameResult = await getPublishedGame(req.params.slug);

  if (gameResult.error) {
    return res.status(500).json({ error: gameResult.error.message });
  }

  if (!gameResult.data) {
    return res.status(404).json({ error: "Game not found." });
  }

  const claimResult = await supabaseAdmin
    .from("game_claims")
    .upsert(
      {
        user_id: req.user.id,
        game_id: gameResult.data.id,
      },
      {
        onConflict: "user_id,game_id",
      }
    )
    .select("id, user_id, game_id, status, created_at, reviewed_at")
    .single();

  if (claimResult.error) {
    return res.status(500).json({ error: claimResult.error.message });
  }

  res.json({
    message: "Game claimed successfully.",
    claim: claimResult.data,
  });
});

// Creates or updates one review for a game.
router.post("/:slug/reviews", requireAuth, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const rating = Number(req.body?.rating);
  const body = String(req.body?.body || "").trim().slice(0, 4000);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      error: "Rating must be a whole number from 1 to 5.",
    });
  }

  if (body.length < 10) {
    return res.status(400).json({
      error: "Review must be at least 10 characters.",
    });
  }

  const gameResult = await getPublishedGame(req.params.slug);

  if (gameResult.error) {
    return res.status(500).json({ error: gameResult.error.message });
  }

  if (!gameResult.data) {
    return res.status(404).json({ error: "Game not found." });
  }

  if (gameResult.data.creator_id === req.user.id) {
    return res.status(403).json({
      error: "You cannot review your own game.",
    });
  }

  const claimResult = await supabaseAdmin
    .from("game_claims")
    .select("id")
    .eq("user_id", req.user.id)
    .eq("game_id", gameResult.data.id)
    .maybeSingle();

  if (claimResult.error) {
    return res.status(500).json({ error: claimResult.error.message });
  }

  if (!claimResult.data) {
    return res.status(409).json({
      error: "Get the game before submitting a review.",
      code: "GAME_NOT_CLAIMED",
    });
  }

  const existingReview = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("user_id", req.user.id)
    .eq("game_id", gameResult.data.id)
    .maybeSingle();

  if (existingReview.error) {
    return res.status(500).json({ error: existingReview.error.message });
  }

  let reviewResult;

  if (existingReview.data) {
    reviewResult = await supabaseAdmin
      .from("reviews")
      .update({
        rating,
        body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingReview.data.id)
      .select(
        "id, rating, body, created_at, updated_at, user:users(username, display_name)"
      )
      .single();
  } else {
    reviewResult = await supabaseAdmin
      .from("reviews")
      .insert({
        user_id: req.user.id,
        game_id: gameResult.data.id,
        claim_id: claimResult.data.id,
        rating,
        body,
      })
      .select(
        "id, rating, body, created_at, updated_at, user:users(username, display_name)"
      )
      .single();
  }

  if (reviewResult.error) {
    return res.status(500).json({ error: reviewResult.error.message });
  }

  await supabaseAdmin
    .from("game_claims")
    .update({
      status: "REVIEWED",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimResult.data.id);

  res.json({
    message: existingReview.data ? "Review updated." : "Review submitted.",
    review: serializeReview(reviewResult.data),
  });
});
module.exports = router;
