const attempts = new Map<string, { count: number; blockedUntil?: number }>();

export function bumpAttempts(key: string, limit: number, blockMs: number) {
  const entry = attempts.get(key) ?? { count: 0 };
  const now = Date.now();
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { blocked: true, blockedMs: entry.blockedUntil - now };
  }

  entry.count += 1;
  if (entry.count >= limit) {
    entry.blockedUntil = now + blockMs;
  }
  attempts.set(key, entry);
  return { blocked: !!entry.blockedUntil && entry.blockedUntil > now, blockedMs: entry.blockedUntil ? entry.blockedUntil - now : 0 };
}

export function resetAttempts(key: string) {
  attempts.delete(key);
}
