const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");

const router = express.Router();

function getCreatorName(creator) {
  if (Array.isArray(creator)) {
    return creator[0]?.username || "Unknown creator";
  }

  return creator?.username || "Unknown creator";
}

function getGameMode(files = []) {
  const hasBrowserBuild = files.some((file) => file.kind === "GAME_BUILD");
  return hasBrowserBuild ? "Browser Play" : "Download";
}

function getAverageRating(reviews = []) {
  if (!reviews.length) {
    return "New";
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return (total / reviews.length).toFixed(1);
}

function toGameCard(game) {
  return {
    id: game.id,
    title: game.title,
    slug: game.slug,
    creator: getCreatorName(game.creator),
    tag: game.genre || "Indie",
    score: getAverageRating(game.reviews),
    plays: "0",
    reviews: game.reviews?.length || 0,
    mode: getGameMode(game.files),
    palette: "mint",
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
        creator:users(id, username),
        files:game_files(id, kind, file_name, url, size_bytes, created_at),
        reviews(id, rating, body, created_at, user:users(username))
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

module.exports = router;
