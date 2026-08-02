const { createClient } = require("@supabase/supabase-js");

const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;

async function requireAuth(req, res, next) {
  if (!hasSupabaseConfig) {
    return res.status(500).json({ error: "Supabase authentication is not configured" });
  }

  // Frontendul trimite tokenul asa: Authorization: Bearer <access_token>.
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Scoatem tokenul din header si il verificam la Supabase.
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Rutele protejate pot folosi apoi req.user.
  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
}

module.exports = requireAuth;
