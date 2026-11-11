import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { HttpError, isConfiguredAdmin, withAdmin } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  status: z.enum(["approved", "rejected", "disabled", "pending"]).optional(),
  role: z.enum(["admin", "member"]).optional(),
});

/** 承認・却下・利用停止・管理者権限の変更 */
export const PATCH = withAdmin<Ctx>(async (req, me, { params }) => {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "入力が不正です");
  const { status, role } = parsed.data;

  const target = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!target) throw new HttpError(404, "ユーザーが見つかりません");
  if (target.id === me.id) throw new HttpError(400, "自分自身の権限や状態は変更できません");
  if (isConfiguredAdmin(target.email)) {
    throw new HttpError(400, "ADMIN_EMAILS で指定された管理者は画面から変更できません（.env を編集してください）");
  }

  // 承認済みの管理者が1人もいなくなる操作は禁止
  const losesAdmin = target.role === "admin" && target.status === "approved" && (role === "member" || (status && status !== "approved"));
  if (losesAdmin) {
    const others = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.role, "admin"), eq(schema.users.status, "approved"), ne(schema.users.id, target.id)))
      .all();
    if (others.length === 0) throw new HttpError(400, "管理者が1人もいなくなるため変更できません");
  }

  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (role) patch.role = role;
  if (status) {
    patch.status = status;
    if (status === "approved" && target.status !== "approved") {
      patch.approvedById = me.id;
      patch.approvedAt = new Date();
    }
  }
  if (Object.keys(patch).length) db.update(schema.users).set(patch).where(eq(schema.users.id, id)).run();
  return NextResponse.json({ ok: true });
});
