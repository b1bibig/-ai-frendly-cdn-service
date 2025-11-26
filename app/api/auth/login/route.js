import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/app/lib/db";
import { createSessionToken, setSessionCookie, clearSessionCookie } from "@/app/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase().trim() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, email, password_hash, uid_token
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  const user = rows?.[0];
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken(user);
  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, uidToken: user.uid_token },
  });
  setSessionCookie(response, token);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
