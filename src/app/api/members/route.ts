import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { withUser } from "@/lib/server";

/** 担当者の選択などに使う、承認済みメンバーの一覧 */
export const GET = withUser(async () => {
  const members = db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(eq(schema.users.status, "approved"))
    .orderBy(asc(schema.users.createdAt))
    .all();
  return NextResponse.json(members);
});
