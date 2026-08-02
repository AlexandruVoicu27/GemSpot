const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        // Backendul nu pastreaza sesiuni Supabase in memorie.
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

function requireSupabaseConfig(res) {
  if (supabase) {
    return true;
  }

  res.status(500).json({ error: "Supabase authentication is not configured" });
  return false;
}

router.post("/signup", async (req, res) => {
  if (!requireSupabaseConfig(res)) {
    return;
  }

  const { email, password, username } = req.body;

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: "Username must have at least 3 characters" });
  }

  // Supabase creeaza userul in Auth si trimite emailul de confirmare.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
      },
      // Dupa confirmare, userul este trimis inapoi in frontend.
      emailRedirectTo: frontendUrl,
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({
    user: data.user,
    session: data.session,
    needsEmailConfirmation: !data.session,
  });
});

router.post("/login", async (req, res) => {
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

  // Frontendul va salva access_token si il va trimite ca Bearer token.
  res.json({
    user: data.user,
    session: data.session,
  });
});

router.post("/logout", (req, res) => {
  // Fara cookies, logout-ul real este stergerea tokenului din frontend.
  res.json({ ok: true });
});

module.exports = router;
