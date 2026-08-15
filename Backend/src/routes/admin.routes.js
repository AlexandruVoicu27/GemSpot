const express = require("express");
const { requireSupabaseConfig, supabaseAdmin } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Allows only authenticated administrators to use admin-management routes.
function requireAdmin(req, res, next) {
  if (req.user?.profile?.role !== "ADMIN") {
    return res.status(403).json({ error: "Administrator access required." });
  }

  next();
}

// Returns the build scan status used by the admin game list.
function getBuildStatus(files = []) {
  const build = files.find((file) => file.kind === "GAME_BUILD");
  return build?.scan_status || "PENDING";
}

// Lists active games for administrator management.
router.get("/games", requireAuth, requireAdmin, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("games")
    .select(
      `
        id,
        title,
        slug,
        status,
        created_at,
        creator:users(id, username, email),
        files:game_files(kind, scan_status)
      `
    )
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false });

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  res.json(
    (result.data || []).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      status: game.status,
      created_at: game.created_at,
      creator: Array.isArray(game.creator) ? game.creator[0] : game.creator,
      buildStatus: getBuildStatus(game.files),
    }))
  );
});

// Lists users so administrators can manage account access.
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("users")
    .select("id, username, email, display_name, role, is_banned, created_at")
    .order("created_at", { ascending: false });

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  res.json(result.data || []);
});

// Bans one user from authenticated application actions.
router.post("/users/:userId/ban", requireAuth, requireAdmin, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: "You cannot ban your own account." });
  }

  const result = await supabaseAdmin
    .from("users")
    .update({ is_banned: true })
    .eq("id", req.params.userId)
    .select("id, username, email, display_name, role, is_banned, created_at")
    .maybeSingle();

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  if (!result.data) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json(result.data);
});

// Removes a ban from one user.
router.post("/users/:userId/unban", requireAuth, requireAdmin, async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  const result = await supabaseAdmin
    .from("users")
    .update({ is_banned: false })
    .eq("id", req.params.userId)
    .select("id, username, email, display_name, role, is_banned, created_at")
    .maybeSingle();

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  if (!result.data) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json(result.data);
});

module.exports = router;