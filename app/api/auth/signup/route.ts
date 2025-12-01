import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

async function getUniqueUidToken() {
  for (let i = 0; i < 10; i += 1) {
    let token = "";
    for (let j = 0; j < 4; j += 1) {
      token += TOKEN_ALPHANUM[Math.floor(Math.random() * TOKEN_ALPHANUM.length)];
    }
    const existing = await prisma.user.findUnique({ where: { uidToken: token } });
    if (!existing) return token;
  }
  throw new Error("Failed to generate unique uid token");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase?.()?.trim?.() ?? "";
  const password = body?.password ?? "";
  const inviteCode = body?.inviteCode?.trim?.() ?? "";

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: "Invite code is required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { code: inviteCode } });
  if (!invite) {
    return NextResponse.json({ ok: false, error: "Invalid invite code" }, { status: 400 });
  }
  if (invite.usedByUserId) {
    return NextResponse.json({ ok: false, error: "Invite code already used" }, { status: 400 });
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Invite code expired" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ ok: false, error: "Email already registered" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const uidToken = await getUniqueUidToken();
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          uidToken,
        },
        select: { id: true, email: true, uidToken: true },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { usedByUserId: created.id, usedAt: new Date() },
      });

      return created;
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, uidToken: user.uidToken },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}
