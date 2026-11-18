import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/api-error";
import { HttpError, newId, withAdmin } from "@/lib/server";
import type { Role } from "@/lib/types";
import { RoleBody } from "@/lib/validators";

/** ロール一覧（メンバー数付き） */
export const GET = withAdmin(async () => {
  const roles: Role[] = db
    .select({
      id: schema.roles.id,
      name: schema.roles.name,
      description: schema.roles.description,
      color: schema.roles.color,
      memberCount: sql<number>`(SELECT count(*) FROM ${schema.userRoles} WHERE ${schema.userRoles.roleId} = ${schema.roles.id})`,
    })
    .from(schema.roles)
    .orderBy(asc(schema.roles.createdAt))
    .all();
  return NextResponse.json(roles);
});

/** ロールを作成 */
export const POST = withAdmin(async (req) => {
  const parsed = RoleBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? ERROR_MESSAGES.badRequest);
  const { name, description = "", color = "gray" } = parsed.data;
  if (db.select().from(schema.roles).where(eq(schema.roles.name, name)).get()) {
    throw new HttpError(409, "同じ名前のロールがすでにあります");
  }
  const role = { id: newId(), name, description, color, createdAt: new Date() };
  db.insert(schema.roles).values(role).run();
  return NextResponse.json({ id: role.id }, { status: 201 });
});
