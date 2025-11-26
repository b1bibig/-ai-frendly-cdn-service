# Bunny CDN Uploader (Invite-only)

Next.js (App Router) app with invite-only signup, email/password login, and Bunny Storage uploads served via Bunny CDN.

## Flows
- Signup: `/signup` → email, password (>=8), uidToken(4 chars), invite code → account created → session cookie set.
- Login: `/login` → email/password → session cookie set.
- Upload: `/` → shows signed-in email + uidToken, path + file upload → `POST /api/upload` → uploads to Bunny Storage and returns CDN URL `https://g.zcxv.xyz/<uidToken>/<relativePath>`.
- Logout: `/api/auth/login` (DELETE) clears session cookie.
- Invite issue: `POST /api/invites` with header `x-admin-token: <ADMIN_TOKEN>` returns a new invite code (optionally with `expiresAt` in body).

## API summary
- `POST /api/auth/signup` body `{ email, password, uidToken, inviteCode }`
- `POST /api/auth/login` body `{ email, password }`
- `DELETE /api/auth/login` (logout)
- `POST /api/upload` FormData `{ file, path }` (requires session cookie)
- `POST /api/invites` (admin only, header `x-admin-token`)

## Environment (Vercel)
```
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=cdnserving
BUNNY_ACCESS_KEY=YOUR_STORAGE_API_PASSWORD
BUNNY_CDN_BASE_URL=https://g.zcxv.xyz
SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
ADMIN_TOKEN=YOUR_ADMIN_TOKEN
DATABASE_URL=<Vercel Postgres URL>
```

## DB schema (Postgres)
Run these once (e.g., via Vercel Postgres SQL):
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  uid_token CHAR(4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  used_by_user_id UUID REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Rules
- `uidToken`: 4 alphanumeric characters.
- Upload path: `<uidToken>/<relativePath>`; `relativePath` must not contain `..`, backslashes, or leading/trailing `/`.
- Bunny upload target: `https://sg.storage.bunnycdn.com/cdnserving/<uidToken>/<relativePath>`.
- CDN URL returned: `https://g.zcxv.xyz/<uidToken>/<relativePath>`.
- Session cookie: httpOnly, sameSite=lax, secure in production, set at login/signup.

## Local dev
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Notes
- All fetches use relative URLs (`/api/...`); no origin/window-based API URLs.
- Uploads limited to images, capped at 10MB, and require an authenticated session.
