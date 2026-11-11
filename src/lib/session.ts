// Edge(middleware) と Node の両方で使えるセッション処理（DBには触れない）
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nc_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30日

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16 || s === "change-me-to-a-long-random-string") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(".env の AUTH_SECRET を16文字以上のランダムな文字列に変更してください");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-please-change");
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = { uid: string; name: string; email: string };

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: String(payload.uid), name: String(payload.name), email: String(payload.email) };
  } catch {
    return null;
  }
}

/** 公開URL（リバースプロキシ配下でも正しいリダイレクト先を作るため APP_URL を優先） */
export function appUrl(req: Request) {
  const env = process.env.APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}`;
}

/** HTTPS でアクセスされた場合のみ Secure 属性を付ける（社内LANの http でも使えるように） */
export function cookieOptions(req: Request, maxAge = MAX_AGE) {
  const proto = appUrl(req).startsWith("https:") ? "https" : "http";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: proto === "https",
    path: "/",
    maxAge,
  };
}
