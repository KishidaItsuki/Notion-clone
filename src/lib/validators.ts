// API の入力チェック（zod）で複数のファイルから使うもの
import { z } from "zod";
import { OPTION_COLORS } from "./types";

/** ロールの作成・変更 */
export const RoleBody = z.object({
  name: z.string().trim().min(1, "ロール名を入力してください").max(50, "ロール名は50文字以内にしてください"),
  description: z.string().trim().max(200).optional(),
  color: z.enum(OPTION_COLORS).optional(),
});
