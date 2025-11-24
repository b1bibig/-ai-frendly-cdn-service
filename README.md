# Bunny CDN Uploader

Single-repo Next.js (App Router) app that lets users log in with a 4-character `uidToken`, upload images to Bunny Storage via server-side fetch, and access them from Bunny CDN.

## How it works
- `/login`: enter `uidToken` (4 alphanumeric). The API stores it in an `httpOnly` `uid_token` cookie.
- `/`: shows current `uidToken`, accepts a relative path (after `/<uidToken>/`), and uploads the selected file through `POST /api/upload`.
- `POST /api/upload`: validates the cookie + path, streams the file to Bunny Storage with `PUT`, and returns the CDN URL (`https://g.zcxv.xyz/<uidToken>/<relativePath>`).

## Required environment
Set these in Vercel (or `.env.local` for local dev):
```
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=cdnserving
BUNNY_ACCESS_KEY=YOUR_STORAGE_API_PASSWORD
BUNNY_CDN_BASE_URL=https://g.zcxv.xyz
```

## URL rules
- `uidToken`: 4 alphanumeric characters, stored as `uid_token` cookie.
- Upload path: `<uidToken>/<relativePath>` where `relativePath` has no `..`, no backslashes, and no leading/trailing `/`.
- Bunny upload target: `https://sg.storage.bunnycdn.com/cdnserving/<uidToken>/<relativePath>`.
- CDN access: `https://g.zcxv.xyz/<uidToken>/<relativePath>`.

## Local development
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Notes
- Cookies are `httpOnly`, `secure`, `sameSite=lax`, path `/` (for local HTTP dev you may need to run over HTTPS or relax `secure` if desired).
- Upload API uses `fetch` with `PUT` and `AccessKey` header; responses include the final CDN URL.
- Output is Vercel-ready; server runtime stays on Node.js with App Router API routes.
