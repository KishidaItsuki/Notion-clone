import { NextResponse } from "next/server";
import { and, desc, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { withUser } from "@/lib/server";

/** タイトルと本文を対象にした検索。空クエリなら最近更新されたページ */
export const GET = withUser(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const escaped = q.replace(/[\\%_]/g, (c) => "\\" + c);
  const pattern = `%${escaped}%`;

  const rows = db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      icon: schema.pages.icon,
      type: schema.pages.type,
      plainText: schema.pages.plainText,
      databaseId: schema.pages.databaseId,
      updatedAt: schema.pages.updatedAt,
    })
    .from(schema.pages)
    .where(
      and(
        isNull(schema.pages.deletedAt),
        q
          ? or(
              sql`${schema.pages.title} LIKE ${pattern} ESCAPE '\\'`,
              sql`${schema.pages.plainText} LIKE ${pattern} ESCAPE '\\'`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(schema.pages.updatedAt))
    .limit(30)
    .all();

  const lower = q.toLowerCase();
  const results = rows.map((r) => {
    let snippet = "";
    if (q) {
      const idx = r.plainText.toLowerCase().indexOf(lower);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        snippet = (start > 0 ? "…" : "") + r.plainText.slice(start, idx + q.length + 50);
      }
    }
    return {
      id: r.id,
      title: r.title,
      icon: r.icon,
      type: r.type,
      isRow: !!r.databaseId,
      snippet,
      updatedAt: r.updatedAt.getTime(),
      titleMatch: q ? r.title.toLowerCase().includes(lower) : false,
    };
  });
  // タイトル一致を優先
  results.sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch));
  return NextResponse.json(results);
});
