-- Supabase exposes public-schema tables through its Data API.
-- Keep direct client access closed; trusted backend requests use the service role.
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
