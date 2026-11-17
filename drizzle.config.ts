import { defineConfig } from "drizzle-kit";

// drizzle-kit（マイグレーション生成ツール）の設定
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
