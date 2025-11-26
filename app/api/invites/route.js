import { NextResponse } from "next/server";
import { sql } from "@/app/lib/db";

const ADMIN_HEADER = "x-admin-token";

function generateCode(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(request) {
  const adminToken = request.headers.get(ADMIN_HEADER);
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
