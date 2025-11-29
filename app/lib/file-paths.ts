import type { PrismaClient } from "@prisma/client";

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

export function sanitizePathSegment(name: string) {
  const trimmed = assertString(name, "name");
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("name cannot contain slashes");
  }
  if (trimmed === "." || trimmed === ".." || trimmed.includes("..")) {
    throw new Error("name cannot contain '..'");
  }
  return trimmed;
}

export function normalizeDirectoryPath(input?: string | null) {
  if (!input || !input.trim() || input === "/") return "/";
  const asserted = assertString(input, "directory path");
  if (asserted.includes("..") || asserted.includes("\\")) {
    throw new Error("directory path cannot contain '..' or backslashes");
  }
  let normalized = asserted;
  normalized = normalized.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.endsWith("/") && normalized !== "/") {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized) {
    throw new Error("directory path cannot be empty");
  }
  return normalized;
}

export function normalizeFullPath(input: string) {
  const asserted = assertString(input, "path");
  if (asserted === "/") {
    throw new Error("path cannot be the root directory");
  }
  if (asserted.includes("..") || asserted.includes("\\")) {
    throw new Error("path cannot contain '..' or backslashes");
  }
  let normalized = asserted.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.endsWith("/") && normalized !== "/") {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function buildObjectPaths(parentPath: string, name: string) {
  const normalizedParent = normalizeDirectoryPath(parentPath);
  const cleanName = sanitizePathSegment(name);
  const fullPath =
    normalizedParent === "/" ? `/${cleanName}` : `${normalizedParent}/${cleanName}`;
  const relativePath = fullPath.slice(1);
  return { fullPath, relativePath, parentPath: normalizedParent, name: cleanName };
}

export async function ensureDirectoryChain(
  prisma: PrismaClient,
  ownerId: string,
  rootUid: string,
  parentPath: string
) {
  const normalizedParent = normalizeDirectoryPath(parentPath);
  if (normalizedParent === "/") return;

  const segments = normalizedParent.slice(1).split("/");
  let currentFullPath = "";

  for (const segment of segments) {
    const cleanSegment = sanitizePathSegment(segment);
    currentFullPath = `${currentFullPath}/${cleanSegment}`;
    const existing = await prisma.fileObject.findFirst({
      where: { ownerId, rootUid, fullPath: currentFullPath },
    });

    if (existing) {
      if (!existing.isDirectory) {
        throw new Error(`A file already exists at ${currentFullPath}`);
      }
      continue;
    }

    await prisma.fileObject.create({
      data: {
        ownerId,
        rootUid,
        fullPath: currentFullPath,
        relativePath: currentFullPath.slice(1),
        parentPath:
          currentFullPath === "" || currentFullPath === "/"
            ? "/"
            : normalizeDirectoryPath(currentFullPath.split("/").slice(0, -1).join("/")),
        name: cleanSegment,
        isDirectory: true,
      },
    });
  }
}
