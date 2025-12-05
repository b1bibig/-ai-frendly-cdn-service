import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const amountUsd = Number(body?.amountUsd ?? 0);

  if (!Number.isFinite(amountUsd) || amountUsd < 3) {
    return NextResponse.json({ error: "Minimum charge is $3" }, { status: 400 });
  }

  const updated = await prisma
    .$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      const newBalance = user.walletBalanceUsd + amountUsd;
      return tx.user.update({
        where: { id: userId },
        data: {
          walletBalanceUsd: newBalance,
          lifetimeChargedUsd: { increment: amountUsd },
          accountStatus: newBalance >= 0 ? AccountStatus.ACTIVE : user.accountStatus,
          overdraftAt: newBalance >= 0 ? null : user.overdraftAt,
        },
      });
    })
    .catch((error) => {
      console.error(error);
      return null;
    });

  if (!updated) {
    return NextResponse.json({ error: "Failed to apply charge" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    wallet: {
      balanceUsd: updated.walletBalanceUsd,
      accountStatus: updated.accountStatus,
      lifetimeChargedUsd: updated.lifetimeChargedUsd,
    },
  });
}
