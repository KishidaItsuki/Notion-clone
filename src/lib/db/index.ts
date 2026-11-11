import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// 起動時にテーブルを自動作成する（マイグレーションツール不要）
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_sub TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by_id TEXT,
  approved_at INTEGER,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'page',
  title TEXT NOT NULL DEFAULT '',
  icon TEXT,
  content TEXT NOT NULL DEFAULT '[]',
  plain_text TEXT NOT NULL DEFAULT '',
  position REAL NOT NULL DEFAULT 0,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  database_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  properties TEXT NOT NULL DEFAULT '[]',
  view_config TEXT NOT NULL DEFAULT '{}',
  "values" TEXT NOT NULL DEFAULT '{}',
  deleted_at INTEGER,
  trash_root_id TEXT,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_parent_idx ON pages(parent_id);
CREATE INDEX IF NOT EXISTS pages_database_idx ON pages(database_id);
CREATE INDEX IF NOT EXISTS pages_deleted_idx ON pages(deleted_at);
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_page_idx ON favorites(user_id, page_id);
`;

/** 旧バージョンのDBに不足している列を追加する（既存ユーザーは承認済みメンバーとして扱う） */
const USER_COLUMNS: [string, string][] = [
  ["google_sub", "TEXT"],
  ["avatar_url", "TEXT"],
  ["role", "TEXT NOT NULL DEFAULT 'member'"],
  ["status", "TEXT NOT NULL DEFAULT 'approved'"],
  ["approved_by_id", "TEXT"],
  ["approved_at", "INTEGER"],
  ["last_login_at", "INTEGER"],
];

function migrate(sqlite: Database.Database) {
  const cols = new Set((sqlite.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name));
  for (const [name, def] of USER_COLUMNS) {
    if (!cols.has(name)) sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
  }
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub)");
}

function createDb() {
  const file = path.resolve(process.env.DATABASE_PATH || "./data/app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(BOOTSTRAP_SQL);
  migrate(sqlite);
  return drizzle(sqlite, { schema });
}

// 開発時のホットリロードで接続が増えないようにグローバルに保持
const g = globalThis as unknown as { __db?: ReturnType<typeof createDb> };
export const db = g.__db ?? (g.__db = createDb());
export { schema };
