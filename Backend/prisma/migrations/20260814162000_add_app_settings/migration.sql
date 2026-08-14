CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB,
  "updated_by" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "app_settings" ("key", "value")
VALUES ('cloudmersive_scanning_enabled', 'true'::jsonb)
ON CONFLICT ("key") DO NOTHING;
