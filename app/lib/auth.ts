import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { AuditLog, Session, User, UserRole } from "@prisma/client";

const SESSION_COOKIE = "session_id";
const SESSION_DAYS = 30;
const SESSION_TTL_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export const RESPONSE_ERROR = (code: string, message: string) => ({
  ok: false,
  error: { code, message },
});

export function hashIp(ip?: string | null) {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function randomToken(length = 48) {
  return crypto.randomBytes(length).toString("base64url");
}

export async function hashToken(token: string) {
  // Use bcrypt to hash tokens for storage
  return bcrypt.hash(token, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function getClientHints(req?: NextRequest) {
  const hdrs = req ? req.headers : headers();
  const ua = hdrs.get("user-agent") || undefined;
  const ip =
    (hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") ||
      undefined) ?? undefined;
  return { ua, ip };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function createSession(userId: string, req?: NextRequest) {
  const token = randomToken(32);
  const tokenHash = await hashToken(token);
  const { ua, ip } = getClientHints(req);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      userAgent: ua,
      ipHash: hashIp(ip),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getSessionRecord(token: string): Promise<(Session & { user: User }) | null> {
  const sessions = await prisma.session.findMany({
    where: { revokedAt: null },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const session of sessions) {
    const match = await bcrypt.compare(token, session.tokenHash);
    if (match) return session;
  }

  return null;
}

export async function getCurrentUser(req?: NextRequest) {
  const cookieStore = req ? req.cookies : cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getSessionRecord(token);
  if (!session) return null;
  if (session.expiresAt < new Date() || session.revokedAt) return null;

  return { ...session.user, session };
}

export async function revokeSessionByToken(rawToken: string) {
  const session = await getSessionRecord(rawToken);
  if (!session) return false;
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return true;
}

export async function requireAuth(req?: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return null;
  return user;
}

export function hasRole(user: User, role: UserRole | UserRole[]) {
  const allowed = Array.isArray(role) ? role : [role];
  return allowed.includes(user.role);
}

export async function requireRole(role: UserRole | UserRole[], req?: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return null;
  if (!hasRole(user, role)) return null;
  return user;
}

export async function recordAudit(entry: Partial<AuditLog>) {
  await prisma.auditLog.create({ data: { type: entry.type ?? "UNKNOWN", ...entry } });
}

export async function authenticateApiKey(rawToken: string | null) {
  if (!rawToken) return null;
  const tokens = await prisma.apiToken.findMany({
    where: { revokedAt: null },
    include: { user: true },
  });

  for (const token of tokens) {
    const match = await bcrypt.compare(rawToken, token.tokenHash);
    if (match) {
      await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
      return token;
    }
  }
  return null;
}
