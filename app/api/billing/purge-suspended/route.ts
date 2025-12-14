import { NextResponse } from "next/server";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function purgeUserStorage(uidToken: string) {
  // Placeholder for Bunny Storage purge. Replace with real API call later.
  console.warn(`Purging storage for uidToken=${uidToken}`);
}

export async function POST() {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.SUSPENDED,
      overdraftAt: { lte: cutoff },
    },
    select: { id: true, uidToken: true },
  });

  let purged = 0;
  for (const user of candidates) {
    try {
      await purgeUserStorage(user.uidToken);
      await prisma.$transaction(async (tx) => {
        await tx.fileObject.deleteMany({ where: { rootUid: user.uidToken } });
        await tx.user.update({
          where: { id: user.id },
          data: {
            // User remains suspended but metadata cleaned up.
            overdraftAt: cutoff,
          },
        });
      });
      purged += 1;
    } catch (error) {
      console.error(`Failed to purge user ${user.id}`, error);
    }
  }

  return NextResponse.json({ ok: true, purged });
}
