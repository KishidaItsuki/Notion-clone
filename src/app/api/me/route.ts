import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { withUser } from "@/lib/server";

export const GET = withUser(async (_req, user) => {
  const pendingCount =
    user.role === "admin"
      ? (db
          .select({ c: sql<number>`count(*)` })
          .from(schema.users)
          .where(and(eq(schema.users.status, "pending")))
          .get()?.c ?? 0)
      : 0;
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    pendingCount,
  });
});
