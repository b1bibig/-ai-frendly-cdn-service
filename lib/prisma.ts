// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Vercel Postgres + PgBouncer 트랜잭션 모드에서는 prepared statement 충돌이
// 발생할 수 있으므로(예: "prepared statement \"s1\" already exists"),
// Prisma 커넥션에서 pgbouncer=true & connection_limit=1 옵션을 강제한다.
// 이미 쿼리 파라미터가 있다면 & 로, 없다면 ? 로 붙인다.
const baseDbUrl = process.env.DATABASE_URL;
const pgBouncerParams = "pgbouncer=true&connection_limit=1";
const datasourceUrl = baseDbUrl
  ? baseDbUrl.includes("?")
    ? `${baseDbUrl}&${pgBouncerParams}`
    : `${baseDbUrl}?${pgBouncerParams}`
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"], // 필요하면 "query"도 추가 가능
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}