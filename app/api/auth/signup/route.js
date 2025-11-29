import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/app/lib/db";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateUidToken() {
  let token = "";
  for (let i = 0; i < 4; i += 1) {
    token += TOKEN_ALPHANUM[Math.floor(Math.random() * TOKEN_ALPHANUM.length)];
  }
  return token;
}

async function getUniqueUidToken() {
  for (let i = 0; i < 10; i += 1) {
    const token = generateUidToken();
    const existingToken = await sql`
      SELECT 1 FROM users WHERE uid_token = ${token} LIMIT 1
    `;
    if (!existingToken.rows?.[0]) return token;
  }
  throw new Error("Failed to generate unique uid token");
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase().trim() ?? "";
  const password = body?.password ?? "";
  const inviteCode = body?.inviteCode?.trim() ?? "";

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: "Invite code is required" }, { status: 400 });
  }

  const existingInvite = await sql`
    SELECT id, used_by_user_id, expires_at
    FROM invites
    WHERE code = ${inviteCode}
    LIMIT 1
  `;
  const invite = existingInvite.rows?.[0];
  if (!invite) {
    return NextResponse.json({ ok: false, error: "Invalid invite code" }, { status: 400 });
  }
  if (invite.used_by_user_id) {
    return NextResponse.json({ ok: false, error: "Invite code already used" }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Invite code expired" }, { status: 400 });
  }

  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existingUser.rows?.[0]) {
    return NextResponse.json({ ok: false, error: "Email already registered" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const uidToken = await getUniqueUidToken();
    const createUser = await sql`
      INSERT INTO users (email, password_hash, uid_token)
      VALUES (${email}, ${passwordHash}, ${uidToken})
      RETURNING id, email, uid_token
    `;
    const user = createUser.rows?.[0];

    await sql`
      UPDATE invites
      SET used_by_user_id = ${user.id}, used_at = NOW()
      WHERE id = ${invite.id}
    `;

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, uidToken: user.uid_token },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}
