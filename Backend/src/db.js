const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseClient(accessToken) {
  if (!hasSupabaseConfig) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

const supabase = createSupabaseClient();

const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : supabase;

function requireSupabaseConfig(res) {
  if (hasSupabaseConfig) {
    return true;
  }

  res.status(500).json({ error: "Supabase is not configured" });
  return false;
}

module.exports = {
  createSupabaseClient,
  hasSupabaseConfig,
  requireSupabaseConfig,
  supabase,
  supabaseAdmin,
};
