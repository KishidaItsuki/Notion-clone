import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { ERROR_MESSAGES, HttpError } from "./api-error";
import type { AccessLevel, UserRow } from "./db/schema";

/**
 * ページのアクセス権限の判定
 *
 * 1. 管理者（users.role = "admin"）は、すべてのページを編集できる
 * 2. ページの access が null なら、親（行ページならデータベース）の設定を引き継ぐ
 *    → 親をたどって最初に access が設定されているページ（設定元）を探す
 *    → 最上位まで設定が無ければ、全員が編集できる
 * 3. 設定元が見つかったら、次のうち一番強いレベルになる
 *    - 設定元の access（「全員」に与えるレベル）
 *    - ユーザーが持つロールごとに page_permissions で与えられたレベル
 */

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

export function maxLevel(a: AccessLevel, b: AccessLevel): AccessLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

export function atLeast(level: AccessLevel, required: AccessLevel) {
  return RANK[level] >= RANK[required];
}

type Node = { parentId: string | null; databaseId: string | null; access: AccessLevel | null };

export type AccessResolver = {
  /** ページに対するユーザーのアクセスレベル */
  level(pageId: string): AccessLevel;
  /** 権限の設定元のページ ID（どこにも設定が無ければ null） */
  sourceOf(pageId: string): string | null;
  isAdmin: boolean;
};

/**
 * 1 リクエストの中で使う判定器を作る。
 * ページの親子関係と権限設定をまとめて読み込み、結果をキャッシュする（数千ページ程度を想定）。
 */
export function createAccessResolver(user: Pick<UserRow, "id" | "role">): AccessResolver {
  const isAdmin = user.role === "admin";

  const nodes = new Map<string, Node>();
  for (const p of db
    .select({
      id: schema.pages.id,
      parentId: schema.pages.parentId,
      databaseId: schema.pages.databaseId,
      access: schema.pages.access,
    })
    .from(schema.pages)
    .all()) {
    nodes.set(p.id, p);
  }

  // ユーザーが持つロールに与えられた権限: pageId → 最も強いレベル
  const roleIds = db
    .select({ roleId: schema.userRoles.roleId })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, user.id))
    .all()
    .map((r) => r.roleId);
  const granted = new Map<string, AccessLevel>();
  if (roleIds.length) {
    for (const g of db
      .select()
      .from(schema.pagePermissions)
      .where(inArray(schema.pagePermissions.roleId, roleIds))
      .all()) {
      granted.set(g.pageId, maxLevel(granted.get(g.pageId) ?? "none", g.level));
    }
  }

  const sourceCache = new Map<string, string | null>();
  const sourceOf = (pageId: string): string | null => {
    if (sourceCache.has(pageId)) return sourceCache.get(pageId)!;
    const path: string[] = [];
    let cur: string | null = pageId;
    let found: string | null = null;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (sourceCache.has(cur)) {
        found = sourceCache.get(cur)!;
        break;
      }
      seen.add(cur);
      path.push(cur);
      const n = nodes.get(cur);
      if (!n) break;
      if (n.access !== null) {
        found = cur;
        break;
      }
      cur = n.parentId ?? n.databaseId;
    }
    for (const id of path) sourceCache.set(id, found);
    return found;
  };

  const level = (pageId: string): AccessLevel => {
    if (isAdmin) return "edit";
    if (!nodes.has(pageId)) return "none";
    const src = sourceOf(pageId);
    if (!src) return "edit"; // どこにも設定が無い → 全員が編集可
    return maxLevel(nodes.get(src)!.access ?? "none", granted.get(src) ?? "none");
  };

  return { level, sourceOf, isAdmin };
}

/** 必要なレベルが無ければ 403 を投げる */
export function requireAccess(resolver: AccessResolver, pageId: string, required: "view" | "edit") {
  const lv = resolver.level(pageId);
  if (!atLeast(lv, required)) {
    throw new HttpError(403, required === "edit" ? ERROR_MESSAGES.cannotEditPage : ERROR_MESSAGES.cannotViewPage);
  }
  return lv;
}
