import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/api-error";
import { HttpError, getPageOr404, withAdmin } from "@/lib/server";
import { createAccessResolver } from "@/lib/permissions";
import type { PagePermissionSettings } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function grantsOf(pageId: string) {
  return db
    .select({ roleId: schema.pagePermissions.roleId, level: schema.pagePermissions.level })
    .from(schema.pagePermissions)
    .where(eq(schema.pagePermissions.pageId, pageId))
    .all();
}

/** ページの権限設定を取得（管理者のみ） */
export const GET = withAdmin<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  const p = getPageOr404(id);

  let inherited: PagePermissionSettings["inherited"] = null;
  if (p.access === null) {
    const sourceId = createAccessResolver(user).sourceOf(id);
    if (sourceId) {
      const src = getPageOr404(sourceId);
      inherited = { pageId: src.id, title: src.title, access: src.access ?? "edit", grants: grantsOf(src.id) };
    }
  }

  const body: PagePermissionSettings = {
    access: p.access,
    grants: p.access === null ? [] : grantsOf(id),
    inherited,
  };
  return NextResponse.json(body);
});

const Body = z.object({
  access: z.enum(["none", "view", "edit"]).nullable(),
  grants: z
    .array(z.object({ roleId: z.string().min(1), level: z.enum(["view", "edit"]) }))
    .max(200)
    .default([]),
});

/** ページの権限設定を保存（管理者のみ）。access が null なら親の設定を引き継ぐ */
export const PUT = withAdmin<Ctx>(async (req, _user, { params }) => {
  const { id } = await params;
  getPageOr404(id);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, ERROR_MESSAGES.badRequest);
  const { access } = parsed.data;

  // 同じロールが重複していたら後のものを優先
  const grants = access === null ? [] : [...new Map(parsed.data.grants.map((g) => [g.roleId, g])).values()];
  if (grants.length) {
    const ids = grants.map((g) => g.roleId);
    const found = db.select({ id: schema.roles.id }).from(schema.roles).where(inArray(schema.roles.id, ids)).all();
    if (found.length !== ids.length) throw new HttpError(400, "存在しないロールが含まれています");
  }

  db.transaction((tx) => {
    tx.update(schema.pages).set({ access }).where(eq(schema.pages.id, id)).run();
    tx.delete(schema.pagePermissions).where(eq(schema.pagePermissions.pageId, id)).run();
    if (grants.length) {
      tx.insert(schema.pagePermissions)
        .values(grants.map((g) => ({ pageId: id, roleId: g.roleId, level: g.level })))
        .run();
    }
  });
  return NextResponse.json({ ok: true });
});
