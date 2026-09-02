const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");

const router = express.Router();

// Returns the public fields allowed on another creator's profile.
function getPublicProfileSelect() {
  return "id, username, display_name, bio, avatar_url";
}

function toCreatorCard(creator) {
  const games = [...(creator.games || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const ratings = games.flatMap((game) =>
    (game.reviews || [])
      .map((review) => Number(review.rating))
      .filter(Number.isFinite)
  );

  const ratingTotal = ratings.reduce((sum, rating) => sum + rating, 0);

  const genres = [
    ...new Set(
      games.flatMap((game) =>
        String(game.genre || "")
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean)
      )
    ),
  ].slice(0, 3);

  return {
    id: creator.id,
    username: creator.username,
    displayName: creator.display_name,
    bio: creator.bio,
    avatarUrl: creator.avatar_url,
    averageRating:
      ratings.length > 0
        ? Number((ratingTotal / ratings.length).toFixed(1))
        : null,
    reviewCount: ratings.length,
    publishedGames: games.length,
    genres,
    featuredGames: games.slice(0, 3).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      coverImage: game.cover_image_url || "",
    })),
  };
}

// Lists creators who have at least one published game.
router.get("/", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      games:games!inner(
        id,
        title,
        slug,
        genre,
        status,
        created_at,
        cover_image_url,
        reviews(id, rating)
      )
    `)
    .eq("games.status", "PUBLISHED")
    .order("username", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json((data || []).map(toCreatorCard));
});

function toCreatorCard(creator) {
  const games = [...(creator.games || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const ratings = games.flatMap((game) =>
    (game.reviews || [])
      .map((review) => Number(review.rating))
      .filter(Number.isFinite)
  );

  const ratingTotal = ratings.reduce((sum, rating) => sum + rating, 0);

  const genres = [
    ...new Set(
      games.flatMap((game) =>
        String(game.genre || "")
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean)
      )
    ),
  ].slice(0, 3);

  return {
    id: creator.id,
    username: creator.username,
    displayName: creator.display_name,
    bio: creator.bio,
    avatarUrl: creator.avatar_url,
    averageRating:
      ratings.length > 0
        ? Number((ratingTotal / ratings.length).toFixed(1))
        : null,
    reviewCount: ratings.length,
    publishedGames: games.length,
    genres,
    featuredGames: games.slice(0, 3).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      coverImage: game.cover_image_url || "",
    })),
  };
}

// Lists creators who have at least one published game.
router.get("/", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      games:games!inner(
        id,
        title,
        slug,
        genre,
        status,
        created_at,
        cover_image_url,
        reviews(id, rating)
      )
    `)
    .eq("games.status", "PUBLISHED")
    .order("username", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json((data || []).map(toCreatorCard));
});

// Loads one public creator profile and their published games.
router.get("/:username", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const username = String(req.params.username || "").trim();

  const profileResult = await supabaseAdmin
    .from("users")
    .select(getPublicProfileSelect())
    .ilike("username", username)
    .maybeSingle();

  if (profileResult.error) {
    return res.status(500).json({ error: profileResult.error.message });
  }

  if (!profileResult.data) {
    return res.status(404).json({ error: "Profile not found." });
  }

  const gamesResult = await supabaseAdmin
    .from("games")
    .select("id, title, slug, description, genre, status, created_at, cover_image_url")
    .eq("creator_id", profileResult.data.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  if (gamesResult.error) {
    return res.status(500).json({ error: gamesResult.error.message });
  }

  res.json({
    profile: profileResult.data,
    games: gamesResult.data || [],
  });
});

module.exports = router;