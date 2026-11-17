import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { unauthorized } from "@/lib/api-error";
import { API, ROUTES, isPublicPath } from "@/lib/routes";

// TODO フロントを返すかどうかのミドルウェアという理解でOK？
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = isPublicPath(pathname);
  // TODO ここの仕組み確認
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith(API.prefix + "/")) {
      return unauthorized("no_session");
    }
    const url = req.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (session && pathname === ROUTES.login) {
    return NextResponse.redirect(new URL(ROUTES.home, req.url));
  }
  return NextResponse.next();
}

// TODO これ何を設定してるの？
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
