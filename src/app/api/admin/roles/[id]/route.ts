import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/api-error";
import { HttpError, withAdmin } from "@/lib/server";
import { RoleBody } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

function getRoleOr404(id: string) {
  const r = db.select().from(schema.roles).where(eq(schema.roles.id, id)).get();
  if (!r) throw new HttpError(404, "ロールが見つかりません");
  return r;
}

/** ロールの名前・説明・色を変更 */
export const PATCH = withAdmin<Ctx>(async (req, _user, { params }) => {
  const { id } = await params;
  getRoleOr404(id);
  const parsed = RoleBody.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? ERROR_MESSAGES.badRequest);
  const patch = parsed.data;
  if (patch.name) {
    const dup = db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.name, patch.name), ne(schema.roles.id, id)))
      .get();
    if (dup) throw new HttpError(409, "同じ名前のロールがすでにあります");
  }
  if (Object.keys(patch).length) db.update(schema.roles).set(patch).where(eq(schema.roles.id, id)).run();
  return NextResponse.json({ ok: true });
});

/** ロールを削除（ユーザーへの付与とページの権限設定からも外れる） */
export const DELETE = withAdmin<Ctx>(async (_req, _user, { params }) => {
  const { id } = await params;
  getRoleOr404(id);
  db.delete(schema.roles).where(eq(schema.roles.id, id)).run(); // user_roles / page_permissions は CASCADE で削除
  return NextResponse.json({ ok: true });
});
