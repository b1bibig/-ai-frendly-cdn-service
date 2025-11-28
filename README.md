# Bunny CDN Uploader (Invite-only)

Next.js (App Router) app with invite-only signup, email/password login, and Bunny Storage uploads served via Bunny CDN.

## Flows
- Signup: `/signup` → email, password (>=8), uidToken(4 chars), invite code → account created → automatic sign-in via NextAuth.
- Login: `/login` → email/password → NextAuth credentials sign-in.
- Upload: `/` → shows signed-in email + uidToken, path + file upload → `POST /api/upload` (NextAuth session required) → uploads to Bunny Storage and returns CDN URL `https://g.zcxv.xyz/<uidToken>/<relativePath>`.
- Logout: header button triggers NextAuth sign-out and redirects to `/login`.
- Invite issue: `POST /api/invites` with header `x-admin-token: <ADMIN_TOKEN>` returns a new invite code (optionally with `expiresAt` in body).

## API summary
- `POST /api/auth/signup` body `{ email, password, uidToken, inviteCode }`
- `POST /api/auth/[...nextauth]` (NextAuth handler for credentials and OAuth callbacks)
- `POST /api/upload` FormData `{ file, path }` (requires session cookie)
- `POST /api/invites` (admin only, header `x-admin-token`)

## Environment (Vercel)
```
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=cdnserving
BUNNY_ACCESS_KEY=YOUR_STORAGE_API_PASSWORD
BUNNY_CDN_BASE_URL=https://g.zcxv.xyz
ADMIN_TOKEN=YOUR_ADMIN_TOKEN
DATABASE_URL=<Vercel Postgres URL>
NEXTAUTH_SECRET=YOUR_LONG_RANDOM_SECRET
```

Where to put them:
- **Local dev**: create `.env.local` in the project root (same folder as `package.json`). Next.js loads it automatically; it is *not* read from your OS home directory.
- **Vercel**: add the keys in the Vercel dashboard under *Project Settings → Environment Variables*; redeploy so the server picks them up. You do not commit these values to git.

Never copy secrets into `next.config.ts` or client components—leave them server-only.

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
- Session cookie: httpOnly, sameSite=lax, secure in production, managed by NextAuth.

## Local dev
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Manual invite request helper
Use the bundled script to issue a test request against a deployed instance (e.g., Vercel). Provide the deployment URL and your admin token:

```bash
# ADMIN_TOKEN can be set via env var instead of --token
npm run request:invite -- --url https://<your-deployment> --token nfhsucjsd67gg
```

Optional: include an expiration timestamp (ISO string or any `Date`-parsable value):

```bash
npm run request:invite -- --url https://<your-deployment> --token nfhsucjsd67gg --expires-at "2025-12-31T15:00:00Z"
```

If the script reports a network error (e.g., `ENETUNREACH`, `ENOTFOUND`, `ECONNREFUSED`), verify that your environment can reach the deployment domain and that the deployment is live.

## Direct API request test (curl)
If you prefer not to use the helper script, you can hit the invite endpoint directly. Replace the URL with your deployment and keep the `x-admin-token` header value in sync with the token configured in Vercel:

```bash
curl -i -X POST https://<your-deployment>/api/invites \
  -H "x-admin-token: nfhsucjsd67gg" \
  -H "Content-Type: application/json" \
  -d '{"expiresAt": null}'
```

- A `200` response with JSON `{"ok":true,"code":...}` indicates success.
- A `401` means the provided token does not match `ADMIN_TOKEN` in the deployment.
- Network errors (e.g., `ENETUNREACH`) indicate connectivity issues from the client environment to the deployment; retry from a network that can reach the Vercel domain.

## Notes
- All fetches use relative URLs (`/api/...`); no origin/window-based API URLs.
- Uploads limited to images, capped at 10MB, and require an authenticated session.
