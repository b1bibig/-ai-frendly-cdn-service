import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  STORAGE_RATE_PER_GB_DAY,
  getOrCreateBillingMonth,
  nextAccountStatus,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

async function calculateStorageGb(userId: string, uidToken: string) {
  const aggregate = await prisma.fileObject.aggregate({
    where: { ownerId: userId, rootUid: uidToken, isDirectory: false },
    _sum: { size: true },
  });
  const bytes = aggregate._sum.size ?? 0;
  return Number(bytes) / 1024 / 1024 / 1024;
}

export async function POST() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const users = await prisma.user.findMany();
  const results: { userId: string; charged: number; gb: number }[] = [];

  for (const user of users) {
    const storageGb = await calculateStorageGb(user.id, user.uidToken);
    const dailyCost = storageGb * STORAGE_RATE_PER_GB_DAY;
    const newBalance = user.walletBalanceUsd - dailyCost;

    await prisma.$transaction(async (tx) => {
      const billingMonth = await getOrCreateBillingMonth(tx, user.id, year, month);
      const status = nextAccountStatus(newBalance, user.overdraftAt);

      await tx.billingMonth.update({
        where: { id: billingMonth.id },
        data: {
          storageCostUsd: { increment: dailyCost },
          storageGbDays: { increment: storageGb },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          walletBalanceUsd: newBalance,
          lifetimeStorageCostUsd: { increment: dailyCost },
          accountStatus: status.accountStatus,
          overdraftAt: status.overdraftAt,
        },
      });
    });

    results.push({ userId: user.id, charged: dailyCost, gb: storageGb });
  }

  return NextResponse.json({ ok: true, processed: results });
}
