import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(request) {
  const adminToken = request.headers.get("x-admin-token");
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return unauthorized();
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || (!adminPassword && !adminPasswordHash)) {
    return NextResponse.json(
      { ok: false, error: "Admin credentials are not configured" },
      { status: 500 }
    );
  }

  const adminUser = { id: "admin", email: adminEmail, role: "admin" };
  const tokenPayload =
    (await authOptions.callbacks?.jwt?.({
      token: {},
      user: adminUser,
      account: { provider: "credentials", type: "credentials" },
      profile: null,
      trigger: "signIn",
    })) || {
      userId: adminUser.id,
      role: adminUser.role,
      sub: adminUser.id,
      email: adminUser.email,
    };

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "NEXTAUTH_SECRET is not configured" },
      { status: 500 }
    );
  }

  const maxAge = authOptions.session?.maxAge ?? 30 * 24 * 60 * 60; // default 30 days
  const sessionToken = await encode({
    token: tokenPayload,
    secret,
    maxAge,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("next-auth.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return response;
}
