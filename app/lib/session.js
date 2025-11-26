import crypto from "crypto";

const SESSION_COOKIE = "session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET");
  return secret;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const encoded = base64url(payload);
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(encoded);
  const signature = base64url(hmac.digest());
  return `${encoded}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(encoded);
  const expected = base64url(hmac.digest());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    userId: user.id,
    email: user.email,
    uidToken: user.uid_token || user.uidToken,
    exp: now + SESSION_TTL_SECONDS,
  });
}

export function verifySessionToken(token) {
  return verify(token);
}

export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionTokenFromCookies(cookieStore) {
  return cookieStore.get(SESSION_COOKIE)?.value || "";
}
