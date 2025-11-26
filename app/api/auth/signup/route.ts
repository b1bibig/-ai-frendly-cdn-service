import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  RESPONSE_ERROR,
  createSession,
  getClientHints,
  hashIp,
  hashPassword,
  recordAudit,
  setSessionCookie,
} from "@/app/lib/auth";
import { bumpAttempts, resetAttempts } from "@/app/lib/rate-limit";
import { UserRole } from "@prisma/client";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase().trim() ?? "";
  const password = body?.password ?? "";
  const passwordConfirm = body?.passwordConfirm ?? "";
  const inviteCode = body?.inviteCode?.trim() ?? "";
  const name = body?.name?.trim() || null;

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(RESPONSE_ERROR("INVALID_EMAIL", "이메일 형식이 올바르지 않습니다."), { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(RESPONSE_ERROR("WEAK_PASSWORD", "비밀번호는 8자 이상이어야 합니다."), { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json(RESPONSE_ERROR("PASSWORD_MISMATCH", "비밀번호가 일치하지 않습니다."), { status: 400 });
  }
  if (!inviteCode) {
    return NextResponse.json(RESPONSE_ERROR("INVALID_INVITE_CODE", "초대 코드가 유효하지 않습니다."), { status: 400 });
  }

  const { ip } = getClientHints(request);
  const rateKey = `${ip ?? "unknown"}:signup:${email}`;
  const rate = bumpAttempts(rateKey, 8, 10 * 60 * 1000);
  if (rate.blocked) {
    return NextResponse.json(
      RESPONSE_ERROR("TOO_MANY_ATTEMPTS", "회원가입 시도가 잠시 차단되었습니다."),
      { status: 429 }
    );
  }

  const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
  if (!invite) {
    return NextResponse.json(
      RESPONSE_ERROR("INVALID_INVITE_CODE", "초대 코드가 유효하지 않습니다."),
      { status: 400 }
    );
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json(
      RESPONSE_ERROR("INVITE_EXPIRED", "이미 사용되었거나 만료된 코드입니다."),
      { status: 400 }
    );
  }
  if (invite.maxUses !== -1 && invite.usedCount >= invite.maxUses) {
    return NextResponse.json(
      RESPONSE_ERROR("INVITE_MAXED", "이미 사용되었거나 만료된 코드입니다."),
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(RESPONSE_ERROR("EMAIL_EXISTS", "이미 등록된 이메일입니다."), { status: 409 });
  }

  const userCount = await prisma.user.count();
  const role = userCount === 0 ? UserRole.OWNER : UserRole.USER;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role,
        },
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: invite.usedCount + 1 },
      });

      await tx.auditLog.create({
        data: { type: "SIGNUP", userId: createdUser.id, message: `via invite ${invite.code}`, ipHash: hashIp(ip) },
      });

      return createdUser;
    });

    resetAttempts(rateKey);
    const session = await createSession(user.id, request);
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
    });
    setSessionCookie(response, session.token);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(RESPONSE_ERROR("SIGNUP_FAILED", "계정 생성에 실패했습니다."), { status: 500 });
  }
}
