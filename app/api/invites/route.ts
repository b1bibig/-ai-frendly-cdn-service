import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { RESPONSE_ERROR, getClientHints, hashIp, recordAudit, requireRole } from "@/app/lib/auth";
import { UserRole } from "@prisma/client";

function parseIntOrDefault(value: string | null, fallback: number) {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const admin = await requireRole([UserRole.OWNER, UserRole.ADMIN], request);
  if (!admin) {
    return NextResponse.json(RESPONSE_ERROR("FORBIDDEN", "관리자 권한이 필요합니다."), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseIntOrDefault(searchParams.get("limit"), 50)));
  const includeExpired = searchParams.get("includeExpired") === "true";

  const invites = await prisma.inviteCode.findMany({
    where: includeExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { creator: true },
  });

  return NextResponse.json({ ok: true, invites });
}

export async function POST(request: NextRequest) {
  const admin = await requireRole([UserRole.OWNER, UserRole.ADMIN], request);
  if (!admin) {
    return NextResponse.json(RESPONSE_ERROR("FORBIDDEN", "관리자 권한이 필요합니다."), { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const code = body?.code?.trim() || Math.random().toString(36).slice(2, 10).toUpperCase();
  const maxUses = typeof body?.maxUses === "number" ? body.maxUses : 1;
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  const note = body?.note?.trim() || null;

  if (!code || code.length < 6 || code.length > 12) {
    return NextResponse.json(
      RESPONSE_ERROR("INVALID_CODE", "코드는 6~12자 영문/숫자로 입력해주세요."),
      { status: 400 }
    );
  }
  if (maxUses === 0 || Number.isNaN(maxUses)) {
    return NextResponse.json(RESPONSE_ERROR("INVALID_MAX_USES", "maxUses 값이 올바르지 않습니다."), { status: 400 });
  }

  try {
    const invite = await prisma.inviteCode.create({
      data: {
        code,
        creatorId: admin.id,
        maxUses,
        expiresAt,
        note,
      },
      include: { creator: true },
    });

    const { ip } = getClientHints(request);
    await recordAudit({
      type: "INVITE_CREATE",
      userId: admin.id,
      message: `code=${code}`,
      ipHash: hashIp(ip),
    });

    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    console.error(error);
    return NextResponse.json(RESPONSE_ERROR("INVITE_CREATE_FAILED", "초대 코드 생성에 실패했습니다."), {
      status: 500,
    });
  }
}
