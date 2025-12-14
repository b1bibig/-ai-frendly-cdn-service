import { AccountStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  BILLING_STATUS_THRESHOLDS,
  CDN_RATE_PER_GB,
  OVERDRAFT_LIMIT,
  STORAGE_RATE_PER_GB_DAY,
} from "./constants";

export type WalletStatus =
  | "ACTIVE"
  | "LOW"
  | "CRITICAL"
  | "OVERDRAFT"
  | "SUSPENDED";

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateWalletStatus(balanceUsd: number): WalletStatus {
  if (balanceUsd >= BILLING_STATUS_THRESHOLDS.active) return "ACTIVE";
  if (balanceUsd >= BILLING_STATUS_THRESHOLDS.low) return "LOW";
  if (balanceUsd >= BILLING_STATUS_THRESHOLDS.critical) return "CRITICAL";
  if (balanceUsd >= BILLING_STATUS_THRESHOLDS.overdraft) return "OVERDRAFT";
  return "SUSPENDED";
}

export function deriveAccountStatus(
  balance: number,
  previousStatus: AccountStatus,
  overdraftAt: Date | null
): { status: AccountStatus; overdraftAt: Date | null } {
  if (balance < OVERDRAFT_LIMIT) {
    return {
      status: AccountStatus.SUSPENDED,
      overdraftAt: overdraftAt ?? new Date(),
    };
  }

  if (balance < 0) {
    return {
      status: AccountStatus.OVERDRAFT,
      overdraftAt: overdraftAt ?? new Date(),
    };
  }

  return { status: AccountStatus.ACTIVE, overdraftAt: null };
}

export async function getUserStorageGb(
  prisma: PrismaClient,
  userId: string,
  uidToken: string
): Promise<number> {
  // Option A: sum from FileObject sizes
  const aggregate = await prisma.fileObject.aggregate({
    where: { ownerId: userId, rootUid: uidToken },
    _sum: { size: true },
  });

  const totalBytes = aggregate._sum.size ?? 0;
  if (!totalBytes) return 0;

  return totalBytes / 1024 / 1024 / 1024;
}

export function computeDailyStorageCost(currentGb: number): number {
  return roundCurrency(currentGb * STORAGE_RATE_PER_GB_DAY);
}

export function computeCdnCost(bytes: number): number {
  const gb = bytes / 1024 / 1024 / 1024;
  return roundCurrency(gb * CDN_RATE_PER_GB);
}

export function billingMonthSelector(userId: string, now: Date) {
  return {
    userId,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  } as const;
}

export function toBigIntSafe(value: Prisma.Decimal | number | bigint | null): bigint {
  if (value === null || value === undefined) return BigInt(0);
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  return BigInt(value.toString());
}
