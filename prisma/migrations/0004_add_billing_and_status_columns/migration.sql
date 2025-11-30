-- Align users table with billing schema and add billing support tables

-- Drop existing foreign key to change types
ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_used_by_user_id_fkey";

-- Convert user id to text to match Prisma schema
ALTER TABLE "users"
  ALTER COLUMN "id" TYPE TEXT USING "id"::text,
  ALTER COLUMN "id" DROP DEFAULT;

-- Convert invite FK column to text to match users.id
ALTER TABLE "invites"
  ALTER COLUMN "used_by_user_id" TYPE TEXT USING "used_by_user_id"::text;

-- Ensure uid_token remains unique
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_uid_token_key') THEN
    CREATE UNIQUE INDEX "users_uid_token_key" ON "users"("uid_token");
  END IF;
END $$;

-- Add wallet and billing tracking columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "wallet_balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_charged_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_storage_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_cdn_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "account_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "overdraft_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recreate foreign key with updated types
ALTER TABLE "invites"
  ADD CONSTRAINT "invites_used_by_user_id_fkey"
  FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create billing_months table if missing
CREATE TABLE IF NOT EXISTS "billing_months" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "storage_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cdn_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "storage_gb_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cdn_bytes" BIGINT NOT NULL DEFAULT 0,
  "cdn_hits" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_months_user_id_year_month_key"
  ON "billing_months"("user_id", "year", "month");

ALTER TABLE "billing_months"
  ADD CONSTRAINT "billing_months_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
