-- Idempotent, type-safe billing setup that skips incompatible constraints
DO $$
DECLARE
  user_id_type text;
  billing_user_type text;
  has_billing boolean;
  fk_exists boolean;
BEGIN
  -- Capture the user id type (default to integer when missing)
  SELECT data_type INTO user_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF user_id_type IS NULL THEN
    user_id_type := 'integer';
  END IF;

  -- Ensure AccountStatus enum
  IF to_regtype('"AccountStatus"') IS NULL THEN
    CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'OVERDRAFT', 'SUSPENDED');
  END IF;

  -- Ensure user billing columns
  ALTER TABLE IF EXISTS "users"
    ADD COLUMN IF NOT EXISTS "wallet_balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lifetime_charged_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lifetime_storage_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lifetime_cdn_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "overdraft_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  -- Build billing_months table with a user_id type that matches users.id when possible
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'billing_months'
  ) INTO has_billing;

  IF NOT has_billing THEN
    EXECUTE format(
      'CREATE TABLE "billing_months" (
        id TEXT NOT NULL,
        user_id %s NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        storage_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        cdn_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        storage_gb_days DOUBLE PRECISION NOT NULL DEFAULT 0,
        cdn_bytes BIGINT NOT NULL DEFAULT 0,
        cdn_hits BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT billing_months_pkey PRIMARY KEY (id)
      );',
      user_id_type
    );
  END IF;

  -- Add missing columns on existing billing_months without altering incompatible types
  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'user_id';
  IF NOT FOUND THEN
    EXECUTE format('ALTER TABLE "billing_months" ADD COLUMN "user_id" %s NOT NULL DEFAULT 0;', user_id_type);
  END IF;

  -- Standard numeric columns
  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'year';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "year" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'month';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "month" INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'storage_cost_usd';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "storage_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'cdn_cost_usd';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "cdn_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'storage_gb_days';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "storage_gb_days" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'cdn_bytes';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "cdn_bytes" BIGINT NOT NULL DEFAULT 0;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'cdn_hits';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "cdn_hits" BIGINT NOT NULL DEFAULT 0;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'created_at';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'updated_at';
  IF NOT FOUND THEN
    ALTER TABLE "billing_months" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Unique index for monthly aggregation
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "billing_months_user_id_year_month_key" ON "billing_months"("user_id", "year", "month")';

  -- Add FK only when the types match
  SELECT data_type INTO billing_user_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'billing_months' AND column_name = 'user_id';

  IF billing_user_type = user_id_type THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'billing_months' AND constraint_name = 'billing_months_user_id_fkey'
    ) INTO fk_exists;

    IF NOT fk_exists THEN
      EXECUTE 'ALTER TABLE "billing_months" ADD CONSTRAINT "billing_months_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping billing_months_user_id_fkey because billing_months.user_id type % does not match users.id type %', billing_user_type, user_id_type;
  END IF;
END $$;
