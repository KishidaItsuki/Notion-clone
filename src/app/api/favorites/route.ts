import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPageOr404, newId, withUser } from "@/lib/server";

/** お気に入りの切り替え（ユーザーごと） */
export const POST = withUser(async (req, user) => {
  const { pageId, favorite } = (await req.json()) as { pageId: string; favorite: boolean };
  getPageOr404(pageId);
  const where = and(eq(schema.favorites.userId, user.id), eq(schema.favorites.pageId, pageId));
  if (favorite) {
    if (!db.select().from(schema.favorites).where(where).get()) {
      db.insert(schema.favorites).values({ id: newId(), userId: user.id, pageId, createdAt: new Date() }).run();
    }
  } else {
    db.delete(schema.favorites).where(where).run();
  }
  return NextResponse.json({ ok: true });
});
