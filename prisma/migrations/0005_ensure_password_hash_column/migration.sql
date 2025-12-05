-- Ensure the password_hash column exists for Prisma mapping
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '';
