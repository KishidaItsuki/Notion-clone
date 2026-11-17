import { NextResponse } from "next/server";
import { OAUTH_COOKIE, createAuthRequest, googleConfig } from "@/lib/google";
import { appUrl, cookieOptions } from "@/lib/session";
import { API, loginUrl } from "@/lib/routes";

/** Google のログイン画面へリダイレクト */
export async function GET(req: Request) {
  const base = appUrl(req);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${base}${loginUrl({ error: "config" })}`);
  const { url, cookie } = createAuthRequest(cfg.clientId, base);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, { ...cookieOptions(req, 600), path: API.authGoogle });
  return res;
}
