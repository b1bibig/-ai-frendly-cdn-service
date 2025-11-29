// app/api/db-health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"; // 중요: Prisma는 nodejs 런타임에서만!

export async function GET() {
  try {
    // 그냥 DB에 한 번 쿼리 날려보기
    const now = await prisma.$queryRaw`SELECT NOW()`;
    return NextResponse.json({ ok: true, now });
  } catch (err: any) {
    console.error("PRISMA DB ERROR:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
