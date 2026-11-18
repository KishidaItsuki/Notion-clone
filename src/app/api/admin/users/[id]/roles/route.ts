import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/api-error";
import { HttpError, withAdmin } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ roleIds: z.array(z.string().min(1)).max(100) });

/** ユーザーのロールをまとめて設定（送ったロールだけになる） */
export const PUT = withAdmin<Ctx>(async (req, _user, { params }) => {
  const { id } = await params;
  if (!db.select().from(schema.users).where(eq(schema.users.id, id)).get()) {
    throw new HttpError(404, "ユーザーが見つかりません");
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, ERROR_MESSAGES.badRequest);
  const roleIds = [...new Set(parsed.data.roleIds)];
  if (roleIds.length) {
    const found = db.select({ id: schema.roles.id }).from(schema.roles).where(inArray(schema.roles.id, roleIds)).all();
    if (found.length !== roleIds.length) throw new HttpError(400, "存在しないロールが含まれています");
  }
  db.transaction((tx) => {
    tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, id)).run();
    if (roleIds.length) tx.insert(schema.userRoles).values(roleIds.map((roleId) => ({ userId: id, roleId }))).run();
  });
  return NextResponse.json({ ok: true });
});
