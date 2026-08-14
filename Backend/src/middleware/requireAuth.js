const { createSupabaseClient, hasSupabaseConfig, supabaseAdmin } = require("../db");

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
  const supabase = createSupabaseClient(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
.select(
  "id, username, email, display_name, bio, avatar_url, role, created_at, updated_at"
)    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  // Rutele protejate pot folosi apoi req.user.
  req.user = {
    id: user.id,
    email: user.email,
    profile,
  };

  next();
}

module.exports = requireAuth;
