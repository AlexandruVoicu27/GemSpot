const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

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
        reviews(id, rating, body, created_at, updated_at, user:users(username, display_name))
      `
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
