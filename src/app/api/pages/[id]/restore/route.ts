import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError, getPageOr404, withUser } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>(async (_req, _user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);
  if (!p.deletedAt) throw new HttpError(400, "このページはゴミ箱にありません");

  // 親（またはデータベース）が既に無い・ゴミ箱にある場合はトップレベルへ戻す
  const parentKey = p.parentId ?? p.databaseId;
  const parent = parentKey ? db.select().from(schema.pages).where(eq(schema.pages.id, parentKey)).get() : null;
  const orphan = parentKey && (!parent || parent.deletedAt);

  db.transaction((tx) => {
    tx.update(schema.pages)
      .set({ deletedAt: null, trashRootId: null })
      .where(eq(schema.pages.trashRootId, id))
      .run();
    if (orphan) {
      tx.update(schema.pages).set({ parentId: null, databaseId: null }).where(eq(schema.pages.id, id)).run();
    }
  });
  return NextResponse.json({ ok: true });
});
