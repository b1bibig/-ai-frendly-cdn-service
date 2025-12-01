DO $$ BEGIN
  -- Ignore if type already exists
  IF to_regtype('"AccountStatus"') IS NOT NULL THEN
    NULL; -- already exists
  ELSE
    CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'OVERDRAFT', 'SUSPENDED');
  END IF;
END $$;

-- Add wallet/billing columns if missing
ALTER TABLE IF EXISTS "users"
  ADD COLUMN IF NOT EXISTS "wallet_balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_charged_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_storage_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lifetime_cdn_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "overdraft_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Billing months table (idempotent)
CREATE TABLE IF NOT EXISTS "billing_months" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS "billing_months_user_id_year_month_key" ON "billing_months"("user_id", "year", "month");
ALTER TABLE IF EXISTS "billing_months" ADD CONSTRAINT IF NOT EXISTS "billing_months_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FileObject owner to integer users
ALTER TABLE IF EXISTS "FileObject"
  ALTER COLUMN IF EXISTS "ownerId" TYPE INTEGER USING "ownerId"::integer;

ALTER TABLE IF EXISTS "FileObject" DROP CONSTRAINT IF EXISTS "FileObject_ownerId_fkey";
ALTER TABLE IF EXISTS "FileObject" ADD CONSTRAINT IF NOT EXISTS "FileObject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
