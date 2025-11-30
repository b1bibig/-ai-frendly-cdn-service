import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildObjectPaths,
  ensureDirectoryChain,
  normalizeDirectoryPath,
} from "@/app/lib/file-paths";
import sharp from "sharp";

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.uidToken || !TOKEN_REGEX.test(session.user.uidToken)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: please log in" },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const currentDir = normalizeDirectoryPath(formData.get("currentDir")?.toString() ?? "/");

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

  const ownerId = String(session.user.id ?? "");
  const rootUid = session.user.uidToken;
  const paths = buildObjectPaths(currentDir, file.name);

  try {
    await ensureDirectoryChain(prisma, ownerId, rootUid, paths.parentPath);
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) || "Invalid path" }, { status: 400 });
  }

  const existing = await prisma.fileObject.findFirst({
    where: { ownerId, rootUid, fullPath: paths.fullPath },
  });

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "A file or folder already exists at that path" },
      { status: 409 }
    );
  }

  let bunnyHost: string;
  let bunnyZone: string;
  let bunnyKey: string;
  let cdnBase: string;
  const thumbnailPrefix = `${rootUid}_THNL`;

  try {
    bunnyHost = getEnv("BUNNY_STORAGE_HOST");
    bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
    bunnyKey = getEnv("BUNNY_ACCESS_KEY");
    cdnBase = getEnv("BUNNY_CDN_BASE_URL");
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 });
  }

  const uploadBaseUrl = `https://${bunnyHost}/${bunnyZone}`;
  const uploadUrl = `${uploadBaseUrl}/${rootUid}${paths.fullPath}`;
  const thumbnailUploadUrl = `${uploadBaseUrl}/${thumbnailPrefix}${paths.fullPath}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  let thumbnailBuffer: Buffer;
  try {
    thumbnailBuffer = await sharp(fileBuffer)
      .resize({ width: 320 })
      .webp()
      .toBuffer();
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) || "Failed to generate thumbnail" },
      { status: 500 }
    );
  }

  const bunnyResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: bunnyKey,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(fileBuffer),
    cache: "no-store",
  });

  const handleUploadError = async (
    response: Response,
    fallbackUrl?: string
  ): Promise<NextResponse | null> => {
    if (response.ok) return null;
    const errorText = await response.text().catch(() => "");

    if (fallbackUrl) {
      await fetch(fallbackUrl, {
        method: "DELETE",
        headers: { AccessKey: bunnyKey },
        cache: "no-store",
      }).catch(() => {});
    }

    return NextResponse.json(
      { ok: false, error: `Bunny upload failed: ${errorText || response.statusText}` },
      { status: 502 }
    );
  };

  const originalUploadError = await handleUploadError(bunnyResponse);
  if (originalUploadError) {
    return originalUploadError;
  }

  const thumbnailResponse = await fetch(thumbnailUploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: bunnyKey,
      "Content-Type": "image/webp",
    },
    body: new Uint8Array(thumbnailBuffer),
    cache: "no-store",
  });

  const thumbnailUploadError = await handleUploadError(thumbnailResponse, uploadUrl);
  if (thumbnailUploadError) {
    return thumbnailUploadError;
  }

  try {
    await prisma.fileObject.create({
      data: {
        ...paths,
        ownerId,
        rootUid,
        isDirectory: false,
        size: file.size,
        mimeType: file.type || null,
      },
    });
  } catch (error: unknown) {
    await Promise.all([
      fetch(uploadUrl, {
        method: "DELETE",
        headers: { AccessKey: bunnyKey },
        cache: "no-store",
      }),
      fetch(thumbnailUploadUrl, {
        method: "DELETE",
        headers: { AccessKey: bunnyKey },
        cache: "no-store",
      }),
    ]).catch(() => {});
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) || "Failed to save file record" },
      { status: 500 }
    );
  }

  const normalizedCdnBase = cdnBase.replace(/\/+$/, "");
  const cdnUrl = `${normalizedCdnBase}/${rootUid}/${paths.relativePath}`;
  const thumbnailCdnUrl = `${normalizedCdnBase}/${thumbnailPrefix}/${paths.relativePath}`;

  return NextResponse.json({
    ok: true,
    cdnUrl,
    thumbnailUrl: thumbnailCdnUrl,
    file: { ...paths, size: file.size, mimeType: file.type },
  });
}
