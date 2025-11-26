import { NextRequest, NextResponse } from "next/server";
import { normalizeRelativePath } from "@/app/lib/path-utils";
import { RESPONSE_ERROR, authenticateApiKey, getClientHints, getCurrentUser, hashIp, recordAudit } from "@/app/lib/auth";
import { UserRole } from "@prisma/client";

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

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

async function authenticate(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (user) return { user, via: "session" as const };

  const apiKey = request.headers.get("x-api-key") || request.nextUrl.searchParams.get("apiKey");
  if (apiKey) {
    const token = await authenticateApiKey(apiKey);
    if (token && token.user) return { user: token.user, via: "apiKey" as const, token };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json(RESPONSE_ERROR("UNAUTHORIZED", "로그인이 필요합니다."), { status: 401 });
  }
  if (auth.user.role === UserRole.READONLY) {
    return NextResponse.json(RESPONSE_ERROR("FORBIDDEN", "읽기 전용 계정입니다."), { status: 403 });
  }

  let relativePath: string;
  let file: File | null;

  try {
    const formData = await request.formData();
    relativePath = normalizeRelativePath(formData.get("path")?.toString() ?? "");
    file = formData.get("file") as File | null;
  } catch (error) {
    return NextResponse.json(RESPONSE_ERROR("BAD_REQUEST", "폼 데이터를 파싱할 수 없습니다."), { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json(RESPONSE_ERROR("FILE_REQUIRED", "파일을 선택하세요."), { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      RESPONSE_ERROR("FILE_TOO_LARGE", `파일이 너무 큽니다. 최대 ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`),
      { status: 413 }
    );
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(RESPONSE_ERROR("UNSUPPORTED_TYPE", "이미지 파일만 업로드할 수 있습니다."), { status: 415 });
  }

  let bunnyHost: string;
  let bunnyZone: string;
  let bunnyKey: string;
  let cdnBase: string;

  try {
    bunnyHost = getEnv("BUNNY_STORAGE_HOST");
    bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
    bunnyKey = getEnv("BUNNY_ACCESS_KEY");
    cdnBase = getEnv("BUNNY_CDN_BASE_URL");
  } catch (error: any) {
    return NextResponse.json(RESPONSE_ERROR("SERVER_MISCONFIGURED", error.message), { status: 500 });
  }

  const userPrefix = auth.user.id;
  const uploadUrl = `https://${bunnyHost}/${bunnyZone}/${userPrefix}/${relativePath}`;
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
      RESPONSE_ERROR("BUNNY_UPLOAD_FAILED", `Bunny upload failed: ${errorText || bunnyResponse.statusText}`),
      { status: 502 }
    );
  }

  const normalizedCdnBase = cdnBase.replace(/\/+$/, "");
  const cdnUrl = `${normalizedCdnBase}/${userPrefix}/${relativePath}`;

  const { ip } = getClientHints(request);
  await recordAudit({
    type: "UPLOAD",
    userId: auth.user.id,
    message: cdnUrl,
    ipHash: hashIp(ip),
  });

  return NextResponse.json({ ok: true, cdnUrl });
}
