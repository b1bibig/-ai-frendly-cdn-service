import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  RESPONSE_ERROR,
  clearSessionCookie,
  createSession,
  getClientHints,
  hashIp,
  recordAudit,
  revokeSessionByToken,
  setSessionCookie,
  verifyPassword,
} from "@/app/lib/auth";
import { bumpAttempts, resetAttempts } from "@/app/lib/rate-limit";

const EMAIL_ERROR = RESPONSE_ERROR("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 잘못되었습니다.");

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase().trim() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json(RESPONSE_ERROR("BAD_REQUEST", "이메일과 비밀번호를 입력하세요."), { status: 400 });
  }

  const { ip } = getClientHints(request);
  const rateKey = `${ip ?? "unknown"}:${email}`;
  const rate = bumpAttempts(rateKey, 5, 5 * 60 * 1000);
  if (rate.blocked) {
    return NextResponse.json(
      RESPONSE_ERROR("TOO_MANY_ATTEMPTS", "로그인 시도가 잠시 차단되었습니다. 잠시 후 다시 시도하세요."),
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordAudit({ type: "LOGIN_FAIL", message: `Unknown email ${email}`, ipHash: hashIp(ip) });
    return NextResponse.json(EMAIL_ERROR, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordAudit({ type: "LOGIN_FAIL", userId: user.id, message: "Wrong password", ipHash: hashIp(ip) });
    return NextResponse.json(EMAIL_ERROR, { status: 401 });
  }

  resetAttempts(rateKey);

  const session = await createSession(user.id, request);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({ type: "LOGIN_SUCCESS", userId: user.id, ipHash: hashIp(ip) });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
    expiresAt: session.expiresAt,
  });
  setSessionCookie(response, session.token);
  return response;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("session_id")?.value;
  if (token) {
    await revokeSessionByToken(token);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
