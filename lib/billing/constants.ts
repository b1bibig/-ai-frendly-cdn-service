export const STORAGE_RATE_PER_100GB_MONTH = 5; // 100GB / 5$
export const CDN_RATE_PER_100GB = 7; // 100GB / 7$

export const STORAGE_RATE_PER_GB_MONTH = STORAGE_RATE_PER_100GB_MONTH / 100; // 0.05
export const STORAGE_RATE_PER_GB_DAY = STORAGE_RATE_PER_GB_MONTH / 30; // ~0.001666...

export const CDN_RATE_PER_GB = CDN_RATE_PER_100GB / 100; // 0.07

export const OVERDRAFT_LIMIT = -1.0; // -1$ 까지 허용
export const DAILY_STORAGE_BILLING_HOUR = 4; // 로컬 기준 새벽 4시

export const BILLING_STATUS_THRESHOLDS = {
  active: 5,
  low: 1,
  critical: 0,
  overdraft: -1,
};
