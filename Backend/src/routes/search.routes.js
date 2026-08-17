const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");

const router = express.Router();

// Removes characters that could break a PostgREST OR filter.
function sanitizeSearchTerm(value) {
  return String(value || "")
    .trim()
    .slice(0, 80)
    .replace(/[%,()]/g, " ");
}

// Converts a related creator record into the public search shape.
function toCreatorResult(creator) {
  const profile = Array.isArray(creator) ? creator[0] : creator;

  return {
    username: profile?.username || "Unknown creator",
    displayName: profile?.display_name || "",
  };
}

// Searches published games and public creator profiles.
router.get("/", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const searchTerm = sanitizeSearchTerm(req.query.q);

  if (!searchTerm) {
    return res.json({ games: [], creators: [] });
  }

  const pattern = "%" + searchTerm + "%";

  const [gamesResult, creatorsResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("id, title, slug, genre, creator:users(username, display_name)")
      .eq("status", "PUBLISHED")
      .or("title.ilike." + pattern + ",genre.ilike." + pattern)
      .order("created_at", { ascending: false })
      .limit(8),

    supabaseAdmin
      .from("users")
      .select("id, username, display_name, bio, avatar_url")
      .or("username.ilike." + pattern + ",display_name.ilike." + pattern)
      .order("username", { ascending: true })
      .limit(8),
  ]);

  if (gamesResult.error || creatorsResult.error) {
    return res.status(500).json({
      error: gamesResult.error?.message || creatorsResult.error.message,
    });
  }

  res.json({
    games: (gamesResult.data || []).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      genre: game.genre || "Indie",
      creator: toCreatorResult(game.creator),
    })),
    creators: creatorsResult.data || [],
  });
});

module.exports = router;