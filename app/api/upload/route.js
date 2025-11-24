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

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export async function POST(request) {
  try {
    // 1) 쿠키에서 uid_token 읽기 (여기가 에러 원인이던 부분)
    const cookieStore = cookies();                 // ✅ 반드시 변수로 받기
    const uidCookie = cookieStore.get("uid_token");
    const uidToken = uidCookie?.value ?? "";

    if (!TOKEN_REGEX.test(uidToken)) {
      return NextResponse.json(
        { ok: false, error: "Invalid uid_token cookie" },
        { status: 401 }
      );
    }

    // 2) formData 파싱
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { ok: false, error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const rawPath = formData.get("path");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "file is required" },
        { status: 400 }
      );
    }

    if (!rawPath || typeof rawPath !== "string") {
      return NextResponse.json(
        { ok: false, error: "path is required" },
        { status: 400 }
      );
    }

    // 3) path 정규화 및 검증
    const relativePath = normalizeRelativePath(rawPath);
    if (!relativePath) {
      return NextResponse.json(
        { ok: false, error: "Invalid path" },
        { status: 400 }
      );
    }

    // 4) MIME / 크기 체크
    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(contentType)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported content type: ${contentType}` },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "File too large (max 10MB)" },
        { status: 413 }
      );
    }

    // 5) 환경변수 읽기
    const bunnyHost = getEnv("BUNNY_STORAGE_HOST");
    const bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
    const accessKey = getEnv("BUNNY_ACCESS_KEY");
    const cdnBase = getEnv("BUNNY_CDN_BASE_URL");

    // 6) Bunny Storage로 업로드
    const uploadUrl = `https://${bunnyHost}/${bunnyZone}/${uidToken}/${relativePath}`;

    const bunnyResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: accessKey,
        "Content-Type": contentType,
      },
      body: fileBuffer,
    });

    if (!bunnyResponse.ok) {
      const errorText = await bunnyResponse.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `Bunny upload failed: ${
            errorText || bunnyResponse.statusText
          }`,
        },
        { status: 502 }
      );
    }

    // 7) 최종 CDN URL 반환
    const normalizedCdnBase = cdnBase.replace(/\/+$/, "");
    const cdnUrl = `${normalizedCdnBase}/${uidToken}/${relativePath}`;

    return NextResponse.json({ ok: true, cdnUrl });
  } catch (err) {
    console.error("Upload API error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
