-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ClaimStatus" AS ENUM ('CLAIMED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "public"."GameFileKind" AS ENUM ('GAME_BUILD', 'COVER_IMAGE', 'SCREENSHOT', 'TRAILER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."GameStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."game_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "status" "public"."ClaimStatus" NOT NULL DEFAULT 'CLAIMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "game_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."game_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "kind" "public"."GameFileKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quarantine_path" TEXT,
    "scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "sha256" TEXT,
    "scanner_output" TEXT,
    "scanned_at" TIMESTAMP(3),
    "storage_path" TEXT,
    "review_note" TEXT,

    CONSTRAINT "game_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genre" TEXT,
    "status" "public"."GameStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cover_image_url" TEXT,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "display_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_claims_game_id_idx" ON "public"."game_claims"("game_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "game_claims_user_id_game_id_key" ON "public"."game_claims"("user_id" ASC, "game_id" ASC);

-- CreateIndex
CREATE INDEX "game_files_game_id_idx" ON "public"."game_files"("game_id" ASC);

-- CreateIndex
CREATE INDEX "games_creator_id_idx" ON "public"."games"("creator_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "public"."games"("slug" ASC);

-- CreateIndex
CREATE INDEX "games_status_idx" ON "public"."games"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_claim_id_key" ON "public"."reviews"("claim_id" ASC);

-- CreateIndex
CREATE INDEX "reviews_game_id_idx" ON "public"."reviews"("game_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_game_id_key" ON "public"."reviews"("user_id" ASC, "game_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username" ASC);

-- AddForeignKey
ALTER TABLE "public"."game_claims" ADD CONSTRAINT "game_claims_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."game_claims" ADD CONSTRAINT "game_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."game_files" ADD CONSTRAINT "game_files_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."games" ADD CONSTRAINT "games_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."game_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
