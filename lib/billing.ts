import { AccountStatus, BillingMonth, Prisma, PrismaClient } from "@prisma/client";

export const STORAGE_RATE_PER_100GB_MONTH = 5;
export const CDN_RATE_PER_100GB = 7;

export const STORAGE_RATE_PER_GB_MONTH = STORAGE_RATE_PER_100GB_MONTH / 100;
export const STORAGE_RATE_PER_GB_DAY = STORAGE_RATE_PER_GB_MONTH / 30;
export const CDN_RATE_PER_GB = CDN_RATE_PER_100GB / 100;

export const OVERDRAFT_LIMIT = -1;
export const DAILY_STORAGE_BILLING_HOUR = 4;

export type PrismaTxn = PrismaClient | Prisma.TransactionClient;

export function nextAccountStatus(balanceUsd: number, overdraftAt?: Date | null) {
  if (balanceUsd >= 0) {
    return { accountStatus: AccountStatus.ACTIVE, overdraftAt: null as Date | null };
  }
  if (balanceUsd >= OVERDRAFT_LIMIT) {
    return {
      accountStatus: AccountStatus.OVERDRAFT,
      overdraftAt: overdraftAt ?? new Date(),
    };
  }
  return {
    accountStatus: AccountStatus.SUSPENDED,
    overdraftAt: overdraftAt ?? new Date(),
  };
}

export function gaugeWalletStatus(balanceUsd: number):
  | "ACTIVE"
  | "LOW"
  | "CRITICAL"
  | "OVERDRAFT"
  | "SUSPENDED" {
  if (balanceUsd >= 5) return "ACTIVE";
  if (balanceUsd >= 1) return "LOW";
  if (balanceUsd >= 0) return "CRITICAL";
  if (balanceUsd >= OVERDRAFT_LIMIT) return "OVERDRAFT";
  return "SUSPENDED";
}

export async function getOrCreateBillingMonth(
  tx: PrismaTxn,
  userId: string,
  year: number,
  month: number
): Promise<BillingMonth> {
  return tx.billingMonth.upsert({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    update: {},
    create: {
      userId,
      year,
      month,
    },
  });
}

export const bytesToGb = (bytes: bigint | number | null | undefined) => {
  if (!bytes) return 0;
  return Number(bytes) / 1024 / 1024 / 1024;
};
