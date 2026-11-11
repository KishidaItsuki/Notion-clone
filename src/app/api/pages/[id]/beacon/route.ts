import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { extractPlainText, getPageOr404, withUser } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

/** タブを閉じる直前の未保存内容を navigator.sendBeacon で受け取る */
export const POST = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);
  const body = (await req.json().catch(() => ({}))) as { content?: unknown[] };
  if (!Array.isArray(body.content) || p.deletedAt) return NextResponse.json({ ok: false });
  db.update(schema.pages)
    .set({
      content: JSON.stringify(body.content),
      plainText: extractPlainText(body.content),
      updatedAt: new Date(),
      updatedById: user.id,
    })
    .where(eq(schema.pages.id, id))
    .run();
  return NextResponse.json({ ok: true });
});
