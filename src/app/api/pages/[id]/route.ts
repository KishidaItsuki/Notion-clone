import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/api-error";
import {
  HttpError,
  breadcrumbs,
  collectDescendantIds,
  extractPlainText,
  getPageOr404,
  parseJson,
  withUser,
} from "@/lib/server";
import type { PageDetail, Property, RowRecord, ViewConfig } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function userName(id: string | null) {
  if (!id) return null;
  return db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, id)).get()?.name ?? null;
}

export const GET = withUser<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);

  const detail: PageDetail = {
    id: p.id,
    type: p.type as PageDetail["type"],
    title: p.title,
    icon: p.icon,
    content: parseJson(p.content, []),
    parentId: p.parentId,
    databaseId: p.databaseId,
    properties: parseJson<Property[]>(p.properties, []),
    viewConfig: parseJson<ViewConfig>(p.viewConfig, {}),
    values: parseJson(p.values, {}),
    deletedAt: p.deletedAt ? p.deletedAt.getTime() : null,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
    createdBy: userName(p.createdById),
    updatedBy: userName(p.updatedById),
    breadcrumbs: breadcrumbs(p),
    isFavorite: !!db
      .select()
      .from(schema.favorites)
      .where(and(eq(schema.favorites.userId, user.id), eq(schema.favorites.pageId, p.id)))
      .get(),
  };

  if (p.databaseId) {
    const parentDb = db.select().from(schema.pages).where(eq(schema.pages.id, p.databaseId)).get();
    detail.dbProperties = parseJson<Property[]>(parentDb?.properties, []);
  }

  if (p.type === "database") {
    detail.rows = db
      .select()
      .from(schema.pages)
      .where(and(eq(schema.pages.databaseId, p.id), isNull(schema.pages.deletedAt)))
      .orderBy(asc(schema.pages.position))
      .all()
      .map(
        (r): RowRecord => ({
          id: r.id,
          title: r.title,
          icon: r.icon,
          position: r.position,
          values: parseJson(r.values, {}),
          updatedAt: r.updatedAt.getTime(),
        }),
      );
  }

  return NextResponse.json(detail);
});

export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    icon?: string | null;
    content?: unknown[];
    baseUpdatedAt?: number;
    force?: boolean;
    parentId?: string | null;
    position?: number;
    properties?: Property[];
    viewConfig?: ViewConfig;
    /** 行のプロパティ値の部分更新（他のセルの同時編集を上書きしないようマージ） */
    valuesPatch?: Record<string, unknown>;
  };

  const update: Partial<typeof schema.pages.$inferInsert> = {};

  if (typeof body.title === "string") update.title = body.title.slice(0, 500);
  if (body.icon !== undefined) update.icon = body.icon;

  if (Array.isArray(body.content)) {
    // 他のメンバーが先に本文を更新していたら競合として返す
    if (
      !body.force &&
      typeof body.baseUpdatedAt === "number" &&
      p.updatedAt.getTime() > body.baseUpdatedAt &&
      p.updatedById !== user.id
    ) {
      throw new HttpError(409, ERROR_MESSAGES.conflict, {
        reason: "conflict",
        updatedBy: userName(p.updatedById),
        updatedAt: p.updatedAt.getTime(),
      });
    }
    update.content = JSON.stringify(body.content);
    update.plainText = extractPlainText(body.content);
  }

  if (body.parentId !== undefined) {
    const newParent = body.parentId || null;
    if (newParent) {
      if (collectDescendantIds(p.id).includes(newParent)) {
        throw new HttpError(400, "自分自身や子孫ページの中には移動できません");
      }
      const parent = getPageOr404(newParent);
      if (parent.deletedAt) throw new HttpError(400, "移動先はゴミ箱にあります");
    }
    update.parentId = newParent;
  }
  if (typeof body.position === "number") update.position = body.position;
  if (Array.isArray(body.properties)) {
    if (p.type !== "database") throw new HttpError(400, "データベースではありません");
    update.properties = JSON.stringify(body.properties);
  }
  if (body.viewConfig) {
    update.viewConfig = JSON.stringify({ ...parseJson(p.viewConfig, {}), ...body.viewConfig });
  }
  if (body.valuesPatch) {
    const merged = { ...parseJson<Record<string, unknown>>(p.values, {}), ...body.valuesPatch };
    for (const k of Object.keys(merged)) if (merged[k] === null) delete merged[k];
    update.values = JSON.stringify(merged);
  }

  const now = new Date();
  update.updatedAt = now;
  update.updatedById = user.id;
  db.update(schema.pages).set(update).where(eq(schema.pages.id, id)).run();
  return NextResponse.json({ ok: true, updatedAt: now.getTime() });
});

/** 既定ではゴミ箱へ移動。?permanent=1 で完全削除（ゴミ箱内のみ） */
export const DELETE = withUser<Ctx>(async (req, _user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";

  if (permanent) {
    if (!p.deletedAt) throw new HttpError(400, "先にゴミ箱へ移動してください");
    const ids = db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.trashRootId, id))
      .all()
      .map((r) => r.id);
    db.transaction((tx) => {
      // 子から順に削除（外部キーの CASCADE でも消えるが明示的に）
      if (ids.length) tx.delete(schema.pages).where(inArray(schema.pages.id, ids)).run();
      tx.delete(schema.pages).where(eq(schema.pages.id, id)).run();
    });
    return NextResponse.json({ ok: true });
  }

  if (p.deletedAt) return NextResponse.json({ ok: true });
  const ids = collectDescendantIds(id);
  db.update(schema.pages)
    .set({ deletedAt: new Date(), trashRootId: id })
    .where(and(inArray(schema.pages.id, ids), isNull(schema.pages.deletedAt)))
    .run();
  return NextResponse.json({ ok: true });
});
