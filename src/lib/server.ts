import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, schema } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import type { PageRow } from "./db/schema";

export const newId = () => randomUUID();

/** セッションのユーザーと、無効な場合はその理由を返す */
export async function sessionUser() {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return { user: null, reason: "no_session" as const };
  const u = db.select().from(schema.users).where(eq(schema.users.id, s.uid)).get();
  if (!u) return { user: null, reason: "no_user" as const };
  // 承認済みのユーザーのみ有効（利用停止にすると即座にアクセスできなくなる）
  if (u.status !== "approved") return { user: null, reason: u.status };
  return { user: u, reason: null };
}

export async function currentUser() {
  return (await sessionUser()).user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** ルートハンドラ共通ラッパー: 認証済みユーザーを渡し、エラーをJSONに変換 */
export function withUser<C>(
  fn: (req: Request, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, ctx: C) => Promise<Response>,
) {
  return async (req: Request, ctx: C) => {
    try {
      const { user, reason } = await sessionUser();
      if (!user) {
        const res = NextResponse.json({ error: "ログインが必要です", reason }, { status: 401 });
        // 利用停止などで無効になったセッションは破棄する
        if (reason !== "no_session") res.cookies.delete(SESSION_COOKIE);
        return res;
      }
      return await fn(req, user, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
    }
  };
}

/** 管理者専用 API のラッパー */
export function withAdmin<C>(
  fn: (req: Request, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, ctx: C) => Promise<Response>,
) {
  return withUser<C>(async (req, user, ctx) => {
    if (user.role !== "admin") throw new HttpError(403, "管理者のみ操作できます");
    return fn(req, user, ctx);
  });
}

/** .env の ADMIN_EMAILS（カンマ区切り）に含まれるか */
export function isConfiguredAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function getPageOr404(id: string): PageRow {
  const p = db.select().from(schema.pages).where(eq(schema.pages.id, id)).get();
  if (!p) throw new HttpError(404, "ページが見つかりません");
  return p;
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** ページ配下（子ページ・データベースの行）のIDをすべて取得（自分自身を含む） */
export function collectDescendantIds(rootId: string): string[] {
  const result = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const kids = db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(
        // 子ページ or データベースの行
        inArray(schema.pages.parentId, frontier),
      )
      .all()
      .map((r) => r.id);
    const rows = db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(inArray(schema.pages.databaseId, frontier))
      .all()
      .map((r) => r.id);
    frontier = [...kids, ...rows].filter((id) => !result.includes(id));
    result.push(...frontier);
  }
  return result;
}

/** パンくずリスト */
export function breadcrumbs(p: PageRow) {
  const crumbs: { id: string; title: string; icon: string | null; type: string }[] = [];
  let cur: PageRow | undefined = p;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    crumbs.unshift({ id: cur.id, title: cur.title, icon: cur.icon, type: cur.type });
    const nextId: string | null = cur.parentId ?? cur.databaseId;
    cur = nextId ? db.select().from(schema.pages).where(eq(schema.pages.id, nextId)).get() : undefined;
  }
  return crumbs;
}

/** 兄弟の末尾の position を返す */
export function nextPosition(parentId: string | null, databaseId: string | null) {
  const where = databaseId
    ? eq(schema.pages.databaseId, databaseId)
    : parentId
      ? and(eq(schema.pages.parentId, parentId), isNull(schema.pages.databaseId))
      : and(isNull(schema.pages.parentId), isNull(schema.pages.databaseId));
  const rows = db.select({ position: schema.pages.position }).from(schema.pages).where(where).all();
  return rows.reduce((m, r) => Math.max(m, r.position), 0) + 1;
}

/** BlockNote のブロック配列から検索用テキストを抽出 */
export function extractPlainText(blocks: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (o.type === "text" && typeof o.text === "string") out.push(o.text);
      if (o.content) walk(o.content);
      if (o.children) walk(o.children);
      if (o.rows) walk(o.rows);
      if (o.cells) walk(o.cells);
    }
  };
  walk(blocks);
  return out.join(" ").slice(0, 20000);
}
