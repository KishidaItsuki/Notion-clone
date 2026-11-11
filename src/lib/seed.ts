import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "./db";
import { newId } from "./server";

/** ページが1つもない場合に「はじめに」ページを作成 */
export function seedWelcomeIfEmpty(userId: string) {
  const count = db.select({ c: sql<number>`count(*)` }).from(schema.pages).get()?.c ?? 0;
  if (count > 0) return;
  const now = new Date();
  const p = (text: string, type = "paragraph", props: Record<string, unknown> = {}) => ({
    id: newId(),
    type,
    props,
    content: [{ type: "text", text, styles: {} }],
    children: [],
  });
  const content = [
    p("チームのワークスペースへようこそ！", "heading", { level: 2 }),
    p("ここはブロックエディタです。行頭で「/」を押すと見出し・リスト・ToDo・コードなどを挿入できます。"),
    p("サイドバーの「＋」で新しいページやデータベースを作成", "checkListItem", { checked: false }),
    p("ページを入れ子にして階層を作る", "checkListItem", { checked: false }),
    p("⌘K / Ctrl+K で検索", "checkListItem", { checked: false }),
    p("サイドバーの「メンバー管理」で参加申請を承認（管理者のみ）", "checkListItem", { checked: false }),
  ];
  db.insert(schema.pages)
    .values({
      id: newId(),
      type: "page",
      title: "はじめに",
      icon: "👋",
      content: JSON.stringify(content),
      plainText: "チームのワークスペースへようこそ",
      position: 1,
      createdById: userId,
      updatedById: userId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
