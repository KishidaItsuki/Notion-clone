import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { OAUTH_COOKIE, exchangeCode, googleConfig, type GoogleProfile } from "@/lib/google";
import { isConfiguredAdmin, newId } from "@/lib/server";
import { seedWelcomeIfEmpty } from "@/lib/seed";
import { SESSION_COOKIE, appUrl, cookieOptions, signSession } from "@/lib/session";
import { API, ROUTES, loginUrl, type LoginError, type LoginStatus } from "@/lib/routes";

export async function GET(req: Request) {
  const base = appUrl(req);
  const fail = (code: LoginError) => {
    const res = NextResponse.redirect(`${base}${loginUrl({ error: code })}`);
    res.cookies.delete({ name: OAUTH_COOKIE, path: API.authGoogle });
    return res;
  };

  const cfg = googleConfig();
  if (!cfg) return fail("config");

  const params = new URL(req.url).searchParams;
  if (params.get("error")) return fail("cancelled");
  const code = params.get("code");
  const state = params.get("state");

  const raw = (await cookies()).get(OAUTH_COOKIE)?.value;
  let saved: { state: string; nonce: string; verifier: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {}
  if (!code || !state || !saved || saved.state !== state) return fail("state");

  let profile: GoogleProfile;
  try {
    profile = await exchangeCode({ code, verifier: saved.verifier, nonce: saved.nonce, base, ...cfg });
  } catch (e) {
    console.error("Google login failed:", e);
    return fail("google");
  }

  const user = upsertUser(profile);
  if (!user) return fail("conflict");

  if (user.status !== "approved") {
    const res = NextResponse.redirect(`${base}${loginUrl({ status: user.status as LoginStatus })}`);
    res.cookies.delete({ name: OAUTH_COOKIE, path: API.authGoogle });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (user.role === "admin") seedWelcomeIfEmpty(user.id);
  const res = NextResponse.redirect(`${base}${ROUTES.home}`);
  res.cookies.delete({ name: OAUTH_COOKIE, path: API.authGoogle });
  res.cookies.set(
    SESSION_COOKIE,
    await signSession({ uid: user.id, name: user.name, email: user.email }),
    cookieOptions(req),
  );
  return res;
}

/** Google のプロフィールからユーザーを作成・更新。ADMIN_EMAILS のユーザーは常に承認済み管理者 */
function upsertUser(p: GoogleProfile) {
  const now = new Date();
  const admin = isConfiguredAdmin(p.email);
  let user =
    db.select().from(schema.users).where(eq(schema.users.googleSub, p.sub)).get() ??
    db.select().from(schema.users).where(eq(schema.users.email, p.email)).get();

  // 同じメールアドレスが別の Google アカウントに紐付いている
  if (user && user.googleSub && user.googleSub !== p.sub) return null;

  if (!user) {
    user = {
      id: newId(),
      email: p.email,
      name: p.name,
      passwordHash: "",
      googleSub: p.sub,
      avatarUrl: p.picture,
      role: admin ? "admin" : "member",
      status: admin ? "approved" : "pending",
      approvedById: null,
      approvedAt: admin ? now : null,
      lastLoginAt: null,
      createdAt: now,
    };
    db.insert(schema.users).values(user).run();
  } else {
    const patch: Partial<typeof schema.users.$inferInsert> = {
      googleSub: p.sub,
      email: p.email,
      name: p.name,
      avatarUrl: p.picture,
    };
    if (admin) {
      patch.role = "admin";
      if (user.status !== "approved") {
        patch.status = "approved";
        patch.approvedAt = now;
      }
    }
    db.update(schema.users).set(patch).where(eq(schema.users.id, user.id)).run();
    user = { ...user, ...patch } as typeof user;
  }

  if (user.status === "approved") {
    db.update(schema.users).set({ lastLoginAt: now }).where(eq(schema.users.id, user.id)).run();
  }
  return user;
}
