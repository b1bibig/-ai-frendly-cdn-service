import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  calculateWalletStatus,
  billingMonthSelector,
  roundCurrency,
  getUserStorageGb,
} from "@/lib/billing/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.uidToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
    });

    const selector = billingMonthSelector(session.user.id, new Date());
    const billingMonth = await prisma.billingMonth.findUnique({
      where: {
        userId_year_month: {
          userId: selector.userId,
          year: selector.year,
          month: selector.month,
        },
      },
    });

    const currentGb = await getUserStorageGb(prisma, user.id, user.uidToken);
    const cdnGbThisMonth = billingMonth?.cdnBytes
      ? Number(billingMonth.cdnBytes) / 1024 / 1024 / 1024
      : 0;

    const walletStatus = calculateWalletStatus(user.walletBalanceUsd);

    return NextResponse.json({
      wallet: {
        balanceUsd: roundCurrency(user.walletBalanceUsd),
        status: walletStatus,
        lifetimeChargedUsd: roundCurrency(user.lifetimeChargedUsd),
      },
      usage: {
        storage: {
          currentGB: Number(currentGb.toFixed(2)),
          costThisMonthUsd: roundCurrency(billingMonth?.storageCostUsd ?? 0),
        },
        cdn: {
          gbThisMonth: Number(cdnGbThisMonth.toFixed(2)),
          bytesThisMonth: billingMonth?.cdnBytes ? Number(billingMonth.cdnBytes) : 0,
          hitsThisMonth: billingMonth?.cdnHits ? Number(billingMonth.cdnHits) : 0,
          costThisMonthUsd: roundCurrency(billingMonth?.cdnCostUsd ?? 0),
        },
        totalCostThisMonthUsd: roundCurrency(
          (billingMonth?.storageCostUsd ?? 0) + (billingMonth?.cdnCostUsd ?? 0)
        ),
      },
      lifetime: {
        storageCostUsd: roundCurrency(user.lifetimeStorageCostUsd),
        cdnCostUsd: roundCurrency(user.lifetimeCdnCostUsd),
      },
    });
  } catch (error) {
    console.error("Failed to load billing summary", error);
    return NextResponse.json({ ok: false, error: "Failed to load summary" }, { status: 500 });
  }
}
