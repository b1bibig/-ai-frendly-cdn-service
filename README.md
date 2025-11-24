# Bunny CDN Uploader

Next.js (App Router) single-repo app for uploading images to Bunny Storage and serving them via Bunny CDN.

## Flow
- `/login`: input 4-character `uidToken` -> stored as `uid_token` httpOnly cookie.
- `/`: enter relative path (after `/<uidToken>/`), pick file, upload via `POST /api/upload`.
- `/api/upload`: validates cookie + path, PUTs the file to Bunny Storage, returns CDN URL `https://g.zcxv.xyz/<uidToken>/<relativePath>`.

## Required environment (set in Vercel)
```
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=cdnserving
BUNNY_ACCESS_KEY=YOUR_STORAGE_API_PASSWORD
BUNNY_CDN_BASE_URL=https://g.zcxv.xyz
```

## URL rules
- `uidToken`: 4 alphanumeric characters.
- Upload path: `<uidToken>/<relativePath>`; `relativePath` must not contain `..`, backslashes, or leading/trailing `/`.
- Bunny upload target: `https://sg.storage.bunnycdn.com/cdnserving/<uidToken>/<relativePath>`.
- CDN access: `https://g.zcxv.xyz/<uidToken>/<relativePath>`.

## Local development
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Notes
- Cookies are `httpOnly`, `secure`, `sameSite=lax`, path `/` (`secure` is only enforced in production).
- Upload API uses relative fetch (`/api/upload`), sends PUT with `AccessKey`, limits to images, and caps size at 10MB.
- No origin-based URL building; Bunny URLs are built solely from the environment variables above.
