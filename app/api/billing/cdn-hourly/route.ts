import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CDN_RATE_PER_GB, bytesToGb, getOrCreateBillingMonth, nextAccountStatus } from "@/lib/billing";
import { fetchCdnSummaryLastHour } from "@/lib/bunny";

export const dynamic = "force-dynamic";

type UsageAccumulator = {
  bytes: number;
  hits: number;
};

export async function POST() {
  const analytics = await fetchCdnSummaryLastHour();
  if (!analytics.length) {
    return NextResponse.json({ ok: true, processed: [] });
  }

  const usageByToken = new Map<string, UsageAccumulator>();

  for (const entry of analytics) {
    const path = entry.Path || "";
    const bytes = entry.BytesSent ?? entry.Bytes ?? entry.SentBytes ?? 0;
    const hits = entry.RequestCount ?? entry.Hits ?? 0;
    const cleaned = path.replace(/^\/+/, "");
    if (!cleaned) continue;
    const [uidToken] = cleaned.split("/");
    if (!uidToken) continue;

    const acc = usageByToken.get(uidToken) || { bytes: 0, hits: 0 };
    acc.bytes += Number(bytes);
    acc.hits += Number(hits);
    usageByToken.set(uidToken, acc);
  }

  if (!usageByToken.size) {
    return NextResponse.json({ ok: true, processed: [] });
  }

  const users = await prisma.user.findMany({
    where: { uidToken: { in: Array.from(usageByToken.keys()) } },
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const processed: { userId: string; uidToken: string; deltaCost: number }[] = [];

  for (const user of users) {
    const usage = usageByToken.get(user.uidToken);
    if (!usage) continue;
    const deltaGb = bytesToGb(usage.bytes);
    const deltaCost = deltaGb * CDN_RATE_PER_GB;
    const newBalance = user.walletBalanceUsd - deltaCost;

    await prisma.$transaction(async (tx) => {
      const billingMonth = await getOrCreateBillingMonth(tx, user.id, year, month);
      const status = nextAccountStatus(newBalance, user.overdraftAt);

      await tx.billingMonth.update({
        where: { id: billingMonth.id },
        data: {
          cdnCostUsd: { increment: deltaCost },
          cdnBytes: { increment: BigInt(Math.round(usage.bytes)) },
          cdnHits: { increment: BigInt(Math.round(usage.hits)) },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          walletBalanceUsd: newBalance,
          lifetimeCdnCostUsd: { increment: deltaCost },
          accountStatus: status.accountStatus,
          overdraftAt: status.overdraftAt,
        },
      });
    });

    processed.push({ userId: user.id, uidToken: user.uidToken, deltaCost });
  }

  return NextResponse.json({ ok: true, processed });
}
