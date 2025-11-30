import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildObjectPaths,
  ensureDirectoryChain,
  normalizeDirectoryPath,
  normalizeFullPath,
} from "@/app/lib/file-paths";

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

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.uidToken) {
    throw new Error("Unauthorized: please log in");
  }
  return {
    ownerId: String(session.user.id),
    rootUid: String(session.user.uidToken),
  } as const;
}

async function moveStorageObject(
  baseUrl: string,
  accessKey: string,
  prefix: string,
  fromPath: string,
  toPath: string,
  fallbackContentType = "application/octet-stream",
  allowMissing = false
) {
  const sourceUrl = `${baseUrl}/${prefix}${fromPath}`;
  const destinationUrl = `${baseUrl}/${prefix}${toPath}`;

  const downloadResponse = await fetch(sourceUrl, {
    headers: { AccessKey: accessKey },
    cache: "no-store",
  });

  if (!downloadResponse.ok) {
    if (allowMissing && downloadResponse.status === 404) {
      return { ok: true as const };
    }
    const errorText = await downloadResponse.text().catch(() => "");
    return {
      ok: false as const,
      error: `Download failed: ${errorText || downloadResponse.statusText}`,
    };
  }

  const buffer = new Uint8Array(await downloadResponse.arrayBuffer());
  const contentType =
    downloadResponse.headers.get("content-type") || fallbackContentType;

  const uploadResponse = await fetch(destinationUrl, {
    method: "PUT",
    headers: {
      AccessKey: accessKey,
      "Content-Type": contentType,
    },
    body: buffer,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "");
    return {
      ok: false as const,
      error: `Upload failed: ${errorText || uploadResponse.statusText}`,
    };
  }

  await fetch(sourceUrl, {
    method: "DELETE",
    headers: { AccessKey: accessKey },
    cache: "no-store",
  }).catch(() => {});

  return { ok: true as const };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const { ownerId, rootUid } = await requireSession();
    const sources = Array.isArray((body as { sources?: unknown })?.sources)
      ? ((body as { sources: string[] }).sources ?? [])
      : [];
    const destinationDir = normalizeDirectoryPath(
      (body as { destinationDir?: string })?.destinationDir ?? "/"
    );

    if (sources.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files provided for move" },
        { status: 400 }
      );
    }

    const uniqueSources = Array.from(
      new Set(sources.map((source) => normalizeFullPath(source)))
    );

    const files = await prisma.fileObject.findMany({
      where: { ownerId, rootUid, fullPath: { in: uniqueSources } },
    });

    const missing = uniqueSources.filter(
      (path) => !files.find((file) => file.fullPath === path)
    );

    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Files not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    const bunnyHost = getEnv("BUNNY_STORAGE_HOST");
    const bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
    const bunnyKey = getEnv("BUNNY_ACCESS_KEY");
    const storageBaseUrl = `https://${bunnyHost}/${bunnyZone}`;

    const results: Array<{ path: string; ok: boolean; error?: string }> = [];

    for (const file of files) {
      if (file.isDirectory) {
        results.push({
          path: file.fullPath,
          ok: false,
          error: "폴더 이동은 아직 지원되지 않습니다.",
        });
        continue;
      }

      try {
        await ensureDirectoryChain(prisma, ownerId, rootUid, destinationDir);
      } catch (error: unknown) {
        results.push({
          path: file.fullPath,
          ok: false,
          error: getErrorMessage(error),
        });
        continue;
      }

      const targetPaths = buildObjectPaths(destinationDir, file.name);

      if (targetPaths.fullPath === file.fullPath) {
        results.push({
          path: file.fullPath,
          ok: false,
          error: "대상 폴더와 현재 폴더가 동일합니다.",
        });
        continue;
      }

      const conflict = await prisma.fileObject.findFirst({
        where: { ownerId, rootUid, fullPath: targetPaths.fullPath },
      });

      if (conflict) {
        results.push({
          path: file.fullPath,
          ok: false,
          error: "대상 폴더에 같은 이름의 항목이 있습니다.",
        });
        continue;
      }

      const moveResult = await moveStorageObject(
        storageBaseUrl,
        bunnyKey,
        rootUid,
        file.fullPath,
        targetPaths.fullPath
      );

      if (!moveResult.ok) {
        results.push({ path: file.fullPath, ok: false, error: moveResult.error });
        continue;
      }

      const thumbnailMove = await moveStorageObject(
        storageBaseUrl,
        bunnyKey,
        `${rootUid}_THNL`,
        file.fullPath,
        targetPaths.fullPath,
        "image/webp",
        true
      );

      if (!thumbnailMove.ok) {
        results.push({
          path: file.fullPath,
          ok: false,
          error: `썸네일 이동 실패: ${thumbnailMove.error}`,
        });
        continue;
      }

      await prisma.fileObject.update({
        where: { id: file.id },
        data: targetPaths,
      });

      results.push({ path: file.fullPath, ok: true });
    }

    const ok = results.every((result) => result.ok);

    return NextResponse.json({ ok, results });
  } catch (error: unknown) {
    const message = getErrorMessage(error) || "Move failed";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
