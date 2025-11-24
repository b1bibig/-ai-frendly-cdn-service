import { NextResponse } from "next/server";

const TOKEN_REGEX = /^[A-Za-z0-9]{4}$/;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const uidToken = body?.uidToken?.trim() ?? "";

  if (!TOKEN_REGEX.test(uidToken)) {
    return NextResponse.json(
      { ok: false, error: "uidToken must be 4 alphanumeric characters" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("uid_token", uidToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
