-- Create tables to match the raw SQL queries used in the API routes
CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "uid_token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "invites" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "used_by_user_id" INTEGER,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

ALTER TABLE "invites"
  ADD CONSTRAINT "invites_used_by_user_id_fkey"
  FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
