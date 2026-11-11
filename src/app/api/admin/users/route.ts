import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isConfiguredAdmin, withAdmin } from "@/lib/server";

/** メンバー一覧（承認待ちを含む全ユーザー） */
export const GET = withAdmin(async () => {
  const all = db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).all();
  const names = new Map(all.map((u) => [u.id, u.name]));
  return NextResponse.json(
    all.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      role: u.role,
      status: u.status,
      fixedAdmin: isConfiguredAdmin(u.email),
      approvedBy: u.approvedById ? (names.get(u.approvedById) ?? null) : null,
      approvedAt: u.approvedAt?.getTime() ?? null,
      lastLoginAt: u.lastLoginAt?.getTime() ?? null,
      createdAt: u.createdAt.getTime(),
    })),
  );
});
