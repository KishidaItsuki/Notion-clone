import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// マイグレーション（drizzle-kit generate で作った SQL）の置き場所
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
// drizzle が適用済みのマイグレーションを記録するテーブル
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * マイグレーション導入前のバージョンで作られた DB への対応（1回だけ実行される）。
 *
 * 旧バージョンは起動時に CREATE TABLE でテーブルを作っていたため、テーブルはあるのに
 * 「どのマイグレーションを適用したか」の記録がない。そのまま migrate() すると
 * 最初のマイグレーション（CREATE TABLE）が再実行されて失敗するので、
 * 最初のマイグレーションを「適用済み」として記録する。データには一切触れない。
 */
function baselineLegacyDatabase(sqlite: Database.Database) {
  const exists = (name: string) =>
    !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

  if (!exists("users") || exists(MIGRATIONS_TABLE)) return; // 新規 DB、または記録済み

  const [first] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  if (!first) return;

  sqlite.transaction(() => {
    // drizzle の migrate() が作るものと同じ形の記録テーブル
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    sqlite
      .prepare(`INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`)
      .run(first.hash, first.folderMillis);
  })();
  console.log("[db] 既存のデータベースを検出したため、初期マイグレーションを適用済みとして記録しました");
}

function createDb() {
  const file = path.resolve(process.env.DATABASE_PATH || "./data/app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  baselineLegacyDatabase(sqlite);
  // 未適用のマイグレーションを順番に適用（適用済みのものはスキップされる）
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsTable: MIGRATIONS_TABLE });
  return db;
}

// 開発時のホットリロードで接続が増えないようにグローバルに保持
const g = globalThis as unknown as { __db?: ReturnType<typeof createDb> };
export const db = g.__db ?? (g.__db = createDb());
export { schema };
