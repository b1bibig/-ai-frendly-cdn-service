import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { AccountStatus } from "@prisma/client";
import { roundCurrency } from "@/lib/billing/utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amountUsd = Number(body?.amountUsd ?? 0);
  if (!Number.isFinite(amountUsd) || amountUsd < 3) {
    return NextResponse.json({ ok: false, error: "Minimum charge is $3" }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const newBalance = roundCurrency(user.walletBalanceUsd + amountUsd);
      const shouldReactivate = newBalance >= 0;

      return tx.user.update({
        where: { id: userId },
        data: {
          walletBalanceUsd: newBalance,
          lifetimeChargedUsd: roundCurrency(user.lifetimeChargedUsd + amountUsd),
          accountStatus: shouldReactivate ? AccountStatus.ACTIVE : user.accountStatus,
          overdraftAt: shouldReactivate ? null : user.overdraftAt,
        },
      });
    });

    return NextResponse.json({ ok: true, walletBalanceUsd: updated.walletBalanceUsd });
  } catch (error) {
    console.error("Failed to charge wallet", error);
    return NextResponse.json({ ok: false, error: "Failed to charge wallet" }, { status: 500 });
  }
}
