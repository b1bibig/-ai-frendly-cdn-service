import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildObjectPaths,
  ensureDirectoryChain,
  normalizeDirectoryPath,
  sanitizePathSegment,
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { ownerId, rootUid } = await requireSession();
    const parentPath = normalizeDirectoryPath((body as { parentPath?: string })?.parentPath ?? "/");
    const name = sanitizePathSegment((body as { name?: string })?.name ?? "");
    const paths = buildObjectPaths(parentPath, name);

    await ensureDirectoryChain(prisma, ownerId, rootUid, parentPath);

    const existing = await prisma.fileObject.findFirst({
      where: { ownerId, rootUid, fullPath: paths.fullPath },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "A file or folder already exists at that path" },
        { status: 409 }
      );
    }

    const directory = await prisma.fileObject.create({
      data: {
        ...paths,
        ownerId,
        rootUid,
        isDirectory: true,
      },
    });

    return NextResponse.json({ ok: true, directory });
  } catch (error: unknown) {
    const message = getErrorMessage(error) || "Failed to create";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
