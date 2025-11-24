import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeRelativePath } from "@/app/lib/path-utils";

const TOKEN_REGEX = /^[A-Za-z0-9]{4}$/;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);

export const runtime = "nodejs";

function getEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export async function POST(request) {
  const uidToken = cookies().get("uid_token")?.value ?? "";
  if (!TOKEN_REGEX.test(uidToken)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: set uidToken at /login" },
      { status: 401 }
    );
  }

  const originHeader = request.headers.get("origin") || request.headers.get("referer");
  if (originHeader) {
    try {
      const requestOrigin = new URL(originHeader).origin;
      const allowedOrigin = process.env.APP_ORIGIN || request.nextUrl.origin;
      if (requestOrigin !== allowedOrigin) {
        return NextResponse.json(
          { ok: false, error: "Forbidden: origin not allowed" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid origin header" },
        { status: 400 }
      );
    }
  }

  let relativePath;
  let file;

  try {
    const formData = await request.formData();
    relativePath = normalizeRelativePath(formData.get("path")?.toString() ?? "");
    file = formData.get("file");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "File is required" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB` },
      { status: 413 }
    );
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Only image uploads are allowed" },
      { status: 415 }
    );
  }

  let bunnyHost;
  let bunnyZone;
  let bunnyKey;
  let cdnBase;

  try {
    bunnyHost = getEnv("BUNNY_STORAGE_HOST");
    bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
    bunnyKey = getEnv("BUNNY_ACCESS_KEY");
    cdnBase = getEnv("BUNNY_CDN_BASE_URL");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const uploadUrl = `https://${bunnyHost}/${bunnyZone}/${uidToken}/${relativePath}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const bunnyResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: bunnyKey,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
    cache: "no-store",
  });

  if (!bunnyResponse.ok) {
    const errorText = await bunnyResponse.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Bunny upload failed: ${errorText || bunnyResponse.statusText}` },
      { status: 502 }
    );
  }

  const normalizedCdnBase = cdnBase.replace(/\/+$/, "");
  const cdnUrl = `${normalizedCdnBase}/${uidToken}/${relativePath}`;

  return NextResponse.json({ ok: true, cdnUrl });
}
