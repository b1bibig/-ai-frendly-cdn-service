export function normalizeRelativePath(input) {
  if (typeof input !== "string") {
    throw new Error("path must be a string");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("path cannot be empty");
  }

  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new Error("path cannot start or end with '/'");
  }

  if (trimmed.includes("..")) {
    throw new Error("path cannot contain '..'");
  }

  if (trimmed.includes("\\")) {
    throw new Error("path cannot contain backslashes");
  }

  const collapsed = trimmed.replace(/\/+/g, "/");
  const parts = collapsed.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("path cannot be empty");
  }

  return parts.join("/");
}
