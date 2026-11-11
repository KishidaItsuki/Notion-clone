import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError, getPageOr404, newId, nextPosition, withUser } from "@/lib/server";
import type { Property, TreeNode } from "@/lib/types";

/** サイドバー用: ページツリーとお気に入り */
export const GET = withUser(async (_req, user) => {
  const tree = db
    .select({
      id: schema.pages.id,
      type: schema.pages.type,
      title: schema.pages.title,
      icon: schema.pages.icon,
      parentId: schema.pages.parentId,
      position: schema.pages.position,
    })
    .from(schema.pages)
    .where(and(isNull(schema.pages.deletedAt), isNull(schema.pages.databaseId)))
    .orderBy(asc(schema.pages.position))
    .all() as TreeNode[];

  const favorites = db
    .select({ id: schema.pages.id, title: schema.pages.title, icon: schema.pages.icon, type: schema.pages.type })
    .from(schema.favorites)
    .innerJoin(schema.pages, eq(schema.favorites.pageId, schema.pages.id))
    .where(and(eq(schema.favorites.userId, user.id), isNull(schema.pages.deletedAt)))
    .orderBy(asc(schema.favorites.createdAt))
    .all();

  return NextResponse.json({ tree, favorites });
});

/** ページ / データベース / データベースの行を作成 */
export const POST = withUser(async (req, user) => {
  const body = (await req.json().catch(() => ({}))) as {
    type?: "page" | "database";
    parentId?: string | null;
    databaseId?: string | null;
    title?: string;
    values?: Record<string, unknown>;
  };
  const type = body.type === "database" ? "database" : "page";
  const parentId = body.parentId || null;
  const databaseId = body.databaseId || null;

  if (parentId) {
    const parent = getPageOr404(parentId);
    if (parent.deletedAt) throw new HttpError(400, "親ページはゴミ箱にあります");
  }
  if (databaseId) {
    const dbPage = getPageOr404(databaseId);
    if (dbPage.type !== "database") throw new HttpError(400, "データベースではありません");
  }

  const now = new Date();
  let properties: Property[] = [];
  let viewConfig = {};
  if (type === "database") {
    const statusId = newId();
    properties = [
      {
        id: statusId,
        name: "ステータス",
        type: "select",
        options: [
          { id: newId(), name: "未着手", color: "gray" },
          { id: newId(), name: "進行中", color: "blue" },
          { id: newId(), name: "完了", color: "green" },
        ],
      },
      { id: newId(), name: "担当者", type: "person" },
      { id: newId(), name: "期日", type: "date" },
    ];
    viewConfig = { view: "table", groupBy: statusId };
  }

  const page = {
    id: newId(),
    type,
    title: body.title ?? "",
    parentId: databaseId ? null : parentId,
    databaseId,
    position: nextPosition(parentId, databaseId),
    properties: JSON.stringify(properties),
    viewConfig: JSON.stringify(viewConfig),
    values: JSON.stringify(body.values ?? {}),
    createdById: user.id,
    updatedById: user.id,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.pages).values(page).run();
  return NextResponse.json({ id: page.id }, { status: 201 });
});
