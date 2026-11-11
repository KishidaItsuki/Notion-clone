import { NextResponse } from "next/server";
import { OAUTH_COOKIE, createAuthRequest, googleConfig } from "@/lib/google";
import { appUrl, cookieOptions } from "@/lib/session";

/** Google のログイン画面へリダイレクト */
export async function GET(req: Request) {
  const base = appUrl(req);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${base}/login?error=config`);
  const { url, cookie } = createAuthRequest(cfg.clientId, base);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, { ...cookieOptions(req, 600), path: "/api/auth/google" });
  return res;
}
