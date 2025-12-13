import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bytesToGb, gaugeWalletStatus } from "@/lib/billing";
import { AccountStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, fileAggregate] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.fileObject.aggregate({
      where: {
        ownerId: session.user.id,
        rootUid: session?.user?.uidToken || undefined,
      },
      _sum: {
        size: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const billingMonth = await prisma.billingMonth.findUnique({
    where: {
      userId_year_month: {
        userId: user.id,
        year,
        month,
      },
    },
  });

  const currentGb = bytesToGb(fileAggregate._sum.size ?? 0);
  const cdnGbThisMonth = bytesToGb(billingMonth?.cdnBytes ?? 0);
  const storageCost = billingMonth?.storageCostUsd ?? 0;
  const cdnCost = billingMonth?.cdnCostUsd ?? 0;
  const hitsThisMonth = Number(billingMonth?.cdnHits ?? 0);
  const totalCostThisMonthUsd = storageCost + cdnCost;

  const computedStatus =
    user.accountStatus === AccountStatus.SUSPENDED
      ? "SUSPENDED"
      : gaugeWalletStatus(user.walletBalanceUsd);

  const response = {
    wallet: {
      balanceUsd: user.walletBalanceUsd,
      status: computedStatus,
      lifetimeChargedUsd: user.lifetimeChargedUsd,
      accountStatus: user.accountStatus,
    },
    usage: {
      storage: {
        currentGB: currentGb,
        costThisMonthUsd: storageCost,
        lifetimeCostUsd: user.lifetimeStorageCostUsd,
      },
      cdn: {
        gbThisMonth: cdnGbThisMonth,
        costThisMonthUsd: cdnCost,
        hitsThisMonth,
        lifetimeCostUsd: user.lifetimeCdnCostUsd,
      },
      totalCostThisMonthUsd,
    },
  };

  return NextResponse.json(response);
}
