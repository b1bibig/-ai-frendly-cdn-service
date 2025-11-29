-- Ensure uid_token values are unique
CREATE UNIQUE INDEX "users_uid_token_key" ON "users"("uid_token");
