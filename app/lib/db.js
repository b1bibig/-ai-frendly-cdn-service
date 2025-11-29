import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function sql(strings, ...values) {
  const rows = await prisma.$queryRaw(strings, ...values);
  return { rows };
}

export { prisma };
