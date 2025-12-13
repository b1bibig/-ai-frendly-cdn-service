import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const devToken = process.env.DEV_ADMIN_TOKEN;
  const provided = request.headers.get("x-dev-token");
  if (!devToken || !provided || provided !== devToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase?.()?.trim?.() ?? "";
  const amountUsd = Number(body?.amountUsd ?? 0);

  if (!email || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      walletBalanceUsd: { increment: amountUsd },
      lifetimeChargedUsd: { increment: amountUsd },
      accountStatus: { set: "ACTIVE" },
      overdraftAt: null,
    },
  }).catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    wallet: {
      balanceUsd: updated.walletBalanceUsd,
      lifetimeChargedUsd: updated.lifetimeChargedUsd,
      accountStatus: updated.accountStatus,
    },
  });
}
