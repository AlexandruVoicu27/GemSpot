ALTER TABLE "review_replies"
ADD COLUMN "reviewer_id" UUID,
ADD COLUMN "reviewer_body" TEXT,
ADD COLUMN "reviewer_created_at" TIMESTAMPTZ,
ADD COLUMN "reviewer_updated_at" TIMESTAMPTZ;

ALTER TABLE "review_replies"
ADD CONSTRAINT "review_replies_reviewer_id_fkey"
FOREIGN KEY ("reviewer_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "review_replies"
ADD CONSTRAINT "review_replies_reviewer_body_length"
CHECK (
  "reviewer_body" IS NULL
  OR char_length(btrim("reviewer_body")) BETWEEN 2 AND 2000
);

CREATE INDEX "review_replies_reviewer_id_idx"
ON "review_replies"("reviewer_id");