import { NextResponse } from "next/server";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteUserStorage } from "@/lib/bunny";

export const dynamic = "force-dynamic";

export async function POST() {
  const threshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const suspendedUsers = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.SUSPENDED,
      overdraftAt: {
        lte: threshold,
      },
    },
  });

  for (const user of suspendedUsers) {
    await deleteUserStorage(user.uidToken);
    await prisma.fileObject.deleteMany({
      where: { ownerId: user.id, rootUid: user.uidToken },
    });
  }

  return NextResponse.json({ ok: true, purged: suspendedUsers.length });
}
