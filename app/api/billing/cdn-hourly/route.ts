import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  billingMonthSelector,
  computeCdnCost,
  deriveAccountStatus,
  roundCurrency,
  toBigIntSafe,
} from "@/lib/billing/utils";

interface CdnAnalyticsRow {
  uidToken: string;
  bytes: number;
  hits: number;
}

async function fetchCdnAnalytics(
  start: Date,
  end: Date
): Promise<CdnAnalyticsRow[]> {
  // Placeholder for Bunny Analytics integration. In production, replace this
  // with a real API call and map paths to uidToken prefixes.
  console.info("Fetching CDN analytics for window", { start, end });
  return [];
}

export async function POST() {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000);

  const analytics = await fetchCdnAnalytics(windowStart, windowEnd);
  const byUid = analytics.reduce<Record<string, { bytes: number; hits: number }>>(
    (acc, row) => {
      acc[row.uidToken] = {
        bytes: (acc[row.uidToken]?.bytes ?? 0) + row.bytes,
        hits: (acc[row.uidToken]?.hits ?? 0) + row.hits,
      };
      return acc;
    },
    {}
  );

  const users = await prisma.user.findMany({
    select: {
      id: true,
      uidToken: true,
      walletBalanceUsd: true,
      lifetimeCdnCostUsd: true,
      accountStatus: true,
      overdraftAt: true,
    },
  });

  let processed = 0;
  for (const user of users) {
    const metrics = byUid[user.uidToken];
    if (!metrics) continue;

    const deltaCost = computeCdnCost(metrics.bytes);
    const selector = billingMonthSelector(user.id, windowEnd);

    try {
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

        const newBalance = roundCurrency(user.walletBalanceUsd - deltaCost);
        const { status, overdraftAt } = deriveAccountStatus(
          newBalance,
          user.accountStatus,
          user.overdraftAt ?? null
        );

        await tx.user.update({
          where: { id: user.id },
          data: {
            walletBalanceUsd: newBalance,
            lifetimeCdnCostUsd: roundCurrency(user.lifetimeCdnCostUsd + deltaCost),
            accountStatus: status,
            overdraftAt,
          },
        });

        await tx.billingMonth.update({
          where: { id: billingMonth.id },
          data: {
            cdnCostUsd: roundCurrency(billingMonth.cdnCostUsd + deltaCost),
            cdnBytes: toBigIntSafe(billingMonth.cdnBytes) + BigInt(metrics.bytes),
            cdnHits: toBigIntSafe(billingMonth.cdnHits) + BigInt(metrics.hits),
          },
        });
      });
      processed += 1;
    } catch (error) {
      console.error(`CDN billing failed for user ${user.id}`, error);
    }
  }

  return NextResponse.json({ ok: true, processed, windowStart, windowEnd });
}
