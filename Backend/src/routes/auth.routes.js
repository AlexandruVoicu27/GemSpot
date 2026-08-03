const express = require("express");
const { requireSupabaseConfig, supabase, supabaseAdmin } = require("../db");
const createRateLimit = require("../middleware/rateLimit");

const router = express.Router();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many login attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `login:${req.ip}:${email}`;
  },
});

const signupRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many signup attempts. Please try again later.",
  keyGenerator: (req) => `signup:${req.ip}`,
});

function normalizeUsername(username) {
  return String(username || "").trim();
}

function isValidUsername(username) {
  return usernamePattern.test(username);
}

async function upsertUserProfile(authUser, username) {
  if (!authUser?.id || !authUser?.email) {
    return null;
  }

  const normalizedUsername =
    normalizeUsername(username) ||
    authUser.user_metadata?.username?.trim() ||
    authUser.email.split("@")[0];

  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: authUser.email,
        username: normalizedUsername,
      },
      { onConflict: "id" }
    )
    .select("id, username, email, role, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

router.post("/signup", signupRateLimit, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { email, password, username } = req.body;
  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({
      error: "Username must be 3-24 characters and use only letters, numbers, or underscores.",
    });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingProfileError) {
    return res.status(500).json({ error: existingProfileError.message });
  }

  if (existingProfile) {
    return res.status(409).json({ error: "Username is already taken." });
  }

  // Supabase creeaza userul in Auth si trimite emailul de confirmare.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: normalizedUsername,
      },
      // Dupa confirmare, userul este trimis inapoi in frontend.
      emailRedirectTo: frontendUrl,
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  let profile = null;

  try {
    profile = await upsertUserProfile(data.user, normalizedUsername);
  } catch (profileError) {
    if (profileError.code === "23505") {
      return res.status(409).json({ error: "Username or email is already taken." });
    }

    return res.status(400).json({ error: profileError.message });
  }

  res.status(201).json({
    user: data.user,
    profile,
    session: data.session,
    needsEmailConfirmation: !data.session,
  });
});

router.post("/login", loginRateLimit, async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { email, password } = req.body;

  // Backendul verifica email/parola prin Supabase.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  let profile = null;

  try {
    profile = await upsertUserProfile(data.user);
  } catch (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  // Frontendul va salva access_token si il va trimite ca Bearer token.
  res.json({
    user: data.user,
    profile,
    session: data.session,
  });
});

router.post("/logout", (req, res) => {
  // Fara cookies, logout-ul real este stergerea tokenului din frontend.
  res.json({ ok: true });
});

module.exports = router;
