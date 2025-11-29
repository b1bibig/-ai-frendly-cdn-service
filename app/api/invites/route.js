import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sql } from "@/app/lib/db";
import { authOptions } from "@/lib/auth";

const ADMIN_HEADER = "x-admin-token";

function generateCode(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }
  return session;
}

export async function POST(request) {
  if (request.headers.has(ADMIN_HEADER)) {
    console.warn("Ignoring client-supplied admin token header");
  }

  const session = await requireAdmin();
  if (!session) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const code = generateCode(12);

  await sql`
    INSERT INTO invites (code, expires_at)
    VALUES (${code}, ${expiresAt})
  `;

  return NextResponse.json({ ok: true, code });
}

export async function GET(request) {
  if (request.headers.has(ADMIN_HEADER)) {
    console.warn("Ignoring client-supplied admin token header");
  }

  const session = await requireAdmin();
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
  const includeExpired = searchParams.get("includeExpired") === "true";

  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 200)
    : 50;

  const invites = includeExpired
    ? await sql`
        SELECT code, expires_at, used_by_user_id, used_at, created_at
        FROM invites
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT code, expires_at, used_by_user_id, used_at, created_at
        FROM invites
        WHERE expires_at IS NULL OR expires_at >= NOW()
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return NextResponse.json({ ok: true, invites: invites.rows });
}
