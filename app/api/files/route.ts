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

export async function GET(request: Request) {
  try {
    const { ownerId, rootUid } = await requireSession();
    const dir = normalizeDirectoryPath(new URL(request.url).searchParams.get("dir"));
    const cdnBase = getEnv("BUNNY_CDN_BASE_URL").replace(/\/+$/, "");

    const files = await prisma.fileObject.findMany({
      where: { ownerId, rootUid, parentPath: dir },
      orderBy: [
        { isDirectory: "desc" },
        { name: "asc" },
      ],
    });

    const filesWithCdn = files.map((file) => ({
      ...file,
      cdnUrl: `${cdnBase}/${rootUid}/${file.relativePath}`,
      thumbnailUrl: file.isDirectory
        ? null
        : `${cdnBase}/${rootUid}_THNL/${file.relativePath}`,
    }));

    return NextResponse.json(filesWithCdn);
  } catch (error: unknown) {
    const message = getErrorMessage(error) || "Failed to load files";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { ownerId, rootUid } = await requireSession();
    const filePath = normalizeFullPath((body as { filePath?: string })?.filePath ?? "");

    const target = await prisma.fileObject.findFirst({
      where: { ownerId, rootUid, fullPath: filePath },
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });
    }

    if (target.isDirectory) {
      const child = await prisma.fileObject.findFirst({
        where: { ownerId, rootUid, parentPath: filePath },
      });
      if (child) {
        return NextResponse.json(
          { ok: false, error: "Directory is not empty" },
          { status: 400 }
        );
      }
    }

    if (!target.isDirectory) {
      const bunnyHost = getEnv("BUNNY_STORAGE_HOST");
      const bunnyZone = getEnv("BUNNY_STORAGE_ZONE");
      const bunnyKey = getEnv("BUNNY_ACCESS_KEY");

      const deleteUrl = `https://${bunnyHost}/${bunnyZone}/${rootUid}${filePath}`;
      const deleteThumbnailUrl = `https://${bunnyHost}/${bunnyZone}/${rootUid}_THNL${filePath}`;

      const deleteObject = async (url: string) => {
        const response = await fetch(url, {
          method: "DELETE",
          headers: { AccessKey: bunnyKey },
          cache: "no-store",
        });

        if (response.ok || response.status === 404) {
          return null;
        }

        const errorText = await response.text().catch(() => "");
        return `Bunny delete failed: ${errorText || response.statusText}`;
      };

      const [originalError, thumbnailError] = await Promise.all([
        deleteObject(deleteUrl),
        deleteObject(deleteThumbnailUrl),
      ]);

      if (originalError || thumbnailError) {
        return NextResponse.json(
          { ok: false, error: originalError || thumbnailError || "Delete failed" },
          { status: 502 }
        );
      }
    }

    try {
      await prisma.fileObject.delete({ where: { id: target.id } });
      return NextResponse.json({ ok: true });
    } catch (dbError: unknown) {
      if (!target.isDirectory) {
        const paths = buildObjectPaths(target.parentPath, target.name);
        await ensureDirectoryChain(prisma, ownerId, rootUid, paths.parentPath);
        await prisma.fileObject.create({
          data: {
            ...paths,
            id: target.id,
            ownerId,
            rootUid,
            isDirectory: false,
            size: target.size,
            mimeType: target.mimeType,
          },
        });
      }
      return NextResponse.json(
        { ok: false, error: getErrorMessage(dbError) || "Failed to delete from database" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error) || "Delete failed";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
