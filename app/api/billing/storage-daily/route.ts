import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  billingMonthSelector,
  computeDailyStorageCost,
  deriveAccountStatus,
  getUserStorageGb,
  roundCurrency,
} from "@/lib/billing/utils";

export async function POST() {
  const now = new Date();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      uidToken: true,
      walletBalanceUsd: true,
      lifetimeStorageCostUsd: true,
      accountStatus: true,
      overdraftAt: true,
    },
  });

  let processed = 0;
  for (const user of users) {
    try {
      const currentGb = await getUserStorageGb(prisma, user.id, user.uidToken);
      const dailyCost = computeDailyStorageCost(currentGb);
      const selector = billingMonthSelector(user.id, now);

      await prisma.$transaction(async (tx) => {
        const billingMonth = await tx.billingMonth.upsert({
          where: {
            userId_year_month: {
              userId: selector.userId,
              year: selector.year,
              month: selector.month,
            },
          },
          update: {},
          create: { ...selector },
        });

        const newBalance = roundCurrency(user.walletBalanceUsd - dailyCost);
        const { status, overdraftAt } = deriveAccountStatus(
          newBalance,
          user.accountStatus,
          user.overdraftAt ?? null
        );

        await tx.user.update({
          where: { id: user.id },
          data: {
            walletBalanceUsd: newBalance,
            lifetimeStorageCostUsd: roundCurrency(
              user.lifetimeStorageCostUsd + dailyCost
            ),
            accountStatus: status,
            overdraftAt,
          },
        });

        await tx.billingMonth.update({
          where: { id: billingMonth.id },
          data: {
            storageCostUsd: roundCurrency(
              billingMonth.storageCostUsd + dailyCost
            ),
            storageGbDays: billingMonth.storageGbDays + currentGb,
          },
        });
      });
      processed += 1;
    } catch (error) {
      console.error(`Storage billing failed for user ${user.id}`, error);
    }
  }

  return NextResponse.json({ ok: true, processed });
}
