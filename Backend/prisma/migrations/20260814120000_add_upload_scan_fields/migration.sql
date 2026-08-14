-- Add secure upload lifecycle fields
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "storage_path" TEXT;
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "quarantine_path" TEXT;
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "scan_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "scanner_output" TEXT;
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "scanned_at" TIMESTAMP(3);
ALTER TABLE "game_files" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
CREATE INDEX IF NOT EXISTS "game_files_scan_status_idx" ON "game_files"("scan_status");
