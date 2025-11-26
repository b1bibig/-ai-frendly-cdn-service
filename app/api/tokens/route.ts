import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { RESPONSE_ERROR, getCurrentUser, hashToken, recordAudit } from "@/app/lib/auth";

function maskToken(token: string) {
  if (token.length <= 6) return token;
  return `${token.slice(0, 4)}...${token.slice(-2)}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(RESPONSE_ERROR("UNAUTHORIZED", "로그인이 필요합니다."), { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, tokens });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json(RESPONSE_ERROR("UNAUTHORIZED", "로그인이 필요합니다."), { status: 401 });

  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json(RESPONSE_ERROR("INVALID_NAME", "토큰 이름을 입력하세요."), { status: 400 });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const token = await prisma.apiToken.create({
    data: { userId: user.id, name, tokenHash },
  });

  await recordAudit({ type: "API_TOKEN_CREATE", userId: user.id, message: maskToken(rawToken) });
  return NextResponse.json({ ok: true, token, rawToken });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json(RESPONSE_ERROR("UNAUTHORIZED", "로그인이 필요합니다."), { status: 401 });

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json(RESPONSE_ERROR("INVALID_ID", "토큰 ID가 필요합니다."), { status: 400 });

  const token = await prisma.apiToken.findFirst({ where: { id, userId: user.id } });
  if (!token) return NextResponse.json(RESPONSE_ERROR("NOT_FOUND", "토큰을 찾을 수 없습니다."), { status: 404 });

  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  await recordAudit({ type: "API_TOKEN_REVOKE", userId: user.id, message: token.name });
  return NextResponse.json({ ok: true });
}
