import { NextResponse } from "next/server";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { withUser } from "@/lib/server";

/** ゴミ箱: 削除操作の起点になったページのみを返す */
export const GET = withUser(async () => {
  const items = db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      icon: schema.pages.icon,
      type: schema.pages.type,
      deletedAt: schema.pages.deletedAt,
    })
    .from(schema.pages)
    .where(and(isNotNull(schema.pages.deletedAt), eq(schema.pages.trashRootId, schema.pages.id)))
    .orderBy(desc(schema.pages.deletedAt))
    .all()
    .map((i) => ({ ...i, deletedAt: i.deletedAt?.getTime() ?? null }));
  return NextResponse.json(items);
});
