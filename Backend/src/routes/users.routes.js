const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");

const router = express.Router();

// Returns the public fields allowed on another creator's profile.
function getPublicProfileSelect() {
  return "id, username, display_name, bio, avatar_url";
}

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
    .select("id, title, slug, description, genre, status, created_at")
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