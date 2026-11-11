import { sqliteTable, text, real, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export type UserRole = "admin" | "member";
/** pending: 承認待ち / approved: 利用可 / rejected: 却下 / disabled: 利用停止 */
export type UserStatus = "pending" | "approved" | "rejected" | "disabled";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** 旧バージョン（パスワード認証）との互換用。現在は使用しない */
  passwordHash: text("password_hash").notNull().$defaultFn(() => ""),
  /** Google アカウントの固有ID（sub） */
  googleSub: text("google_sub"),
  avatarUrl: text("avatar_url"),
  role: text("role").$type<UserRole>().notNull().default("member"),
  status: text("status").$type<UserStatus>().notNull().default("pending"),
  approvedById: text("approved_by_id"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * ページ・データベース・データベースの行（レコード）をすべてこのテーブルで表現する。
 * - type = "page" | "database"
 * - databaseId が入っている行は「データベースのレコード」（サイドバーには出ない）
 */
export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().default("page"),
    title: text("title").notNull().default(""),
    icon: text("icon"),
    /** BlockNote のブロック配列（JSON文字列） */
    content: text("content").notNull().default("[]"),
    /** 検索用プレーンテキスト */
    plainText: text("plain_text").notNull().default(""),
    position: real("position").notNull().default(0),
    parentId: text("parent_id"),
    databaseId: text("database_id"),
    /** データベース: プロパティ定義（JSON配列） */
    properties: text("properties").notNull().default("[]"),
    /** データベース: 表示設定（JSON） */
    viewConfig: text("view_config").notNull().default("{}"),
    /** 行: プロパティ値（JSON {propId: value}） */
    values: text("values").notNull().default("{}"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    trashRootId: text("trash_root_id"),
    createdById: text("created_by_id"),
    updatedById: text("updated_by_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("pages_parent_idx").on(t.parentId),
    index("pages_database_idx").on(t.databaseId),
    index("pages_deleted_idx").on(t.deletedAt),
  ],
);

export const favorites = sqliteTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    pageId: text("page_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("favorites_user_page_idx").on(t.userId, t.pageId)],
);

export type PageRow = typeof pages.$inferSelect;
export type UserRow = typeof users.$inferSelect;
