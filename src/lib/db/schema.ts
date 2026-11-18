// テーブル定義はこのファイルだけに書く（唯一の正）。
// 変更したら `npm run db:generate` でマイグレーション（drizzle/ 配下の SQL）を作成し、Git にコミットする。
// アプリ起動時に未適用のマイグレーションが自動で実行される（src/lib/db/index.ts）。
import { sqliteTable, text, real, integer, index, uniqueIndex, primaryKey, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/** システム上の権限。admin はメンバー・ロール・ページ権限を管理でき、すべてのページを閲覧・編集できる */
export type UserRole = "admin" | "member";
/** ページに対するアクセスレベル（none < view < edit） */
export type AccessLevel = "none" | "view" | "edit";
/** pending: 承認待ち / approved: 利用可 / rejected: 却下 / disabled: 利用停止 */
export type UserStatus = "pending" | "approved" | "rejected" | "disabled";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** 旧バージョン（パスワード認証）との互換用。現在は使用しない */
  passwordHash: text("password_hash").notNull().default("").$defaultFn(() => ""),
  /** Google アカウントの固有ID（sub） */
  googleSub: text("google_sub"),
  avatarUrl: text("avatar_url"),
  role: text("role").$type<UserRole>().notNull().default("member"),
  status: text("status").$type<UserStatus>().notNull().default("pending"),
  approvedById: text("approved_by_id"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("users_google_sub_idx").on(t.googleSub)]);

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
    /** 親ページ（親を完全に削除すると子も削除） */
    parentId: text("parent_id").references((): AnySQLiteColumn => pages.id, { onDelete: "cascade" }),
    /** データベースの行の場合、所属するデータベース */
    databaseId: text("database_id").references((): AnySQLiteColumn => pages.id, { onDelete: "cascade" }),
    /** データベース: プロパティ定義（JSON配列） */
    properties: text("properties").notNull().default("[]"),
    /** データベース: 表示設定（JSON） */
    viewConfig: text("view_config").notNull().default("{}"),
    /** 行: プロパティ値（JSON {propId: value}） */
    values: text("values").notNull().default("{}"),
    /**
     * アクセス権限の設定
     * - null: 親ページ（行の場合はデータベース）の設定を引き継ぐ。最上位なら全員が編集可
     * - "none" | "view" | "edit": このページで個別に設定する。値は「全員」に与えるレベルで、
     *   ロールごとのレベルは page_permissions に保存する
     */
    access: text("access").$type<AccessLevel>(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    trashRootId: text("trash_root_id"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
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
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("favorites_user_page_idx").on(t.userId, t.pageId)],
);

/** 管理者が自由に作成するロール（部署・プロジェクトなど） */
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("gray"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** ユーザーとロールの対応（1人に複数のロールを付けられる） */
export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);

/** ページごとの、ロールに与えるアクセスレベル（pages.access が null 以外のページでのみ有効） */
export const pagePermissions = sqliteTable(
  "page_permissions",
  {
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    level: text("level").$type<Exclude<AccessLevel, "none">>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.roleId] }), index("page_permissions_role_idx").on(t.roleId)],
);

export type PageRow = typeof pages.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type UserRow = typeof users.$inferSelect;
