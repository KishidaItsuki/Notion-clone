// API のエラー応答の共通形式。
// middleware（Edge ランタイム）からも使うため、DB など Node.js 専用のものは import しないこと。
import { NextResponse } from "next/server";

/** エラーの理由（画面側で分岐に使う機械向けのコード） */
export type ApiErrorReason =
  // 認証・承認
  | "no_session" // ログインしていない
  | "no_user" // ユーザーが存在しない
  | "pending" // 承認待ち
  | "rejected" // 却下
  | "disabled" // 利用停止
  // その他
  | "conflict"; // 他のメンバーが先に更新した

/**
 * すべての API エラーはこの形で返す。
 * - error: 画面にそのまま表示できる日本語メッセージ
 * - reason: 画面側で処理を分けたいときのコード（任意）
 * - それ以外の項目は reason ごとの追加情報（例: conflict の updatedBy）
 */
export type ApiErrorBody = {
  error: string;
  reason?: ApiErrorReason;
  [extra: string]: unknown;
};

export const ERROR_MESSAGES = {
  unauthorized: "ログインが必要です",
  forbidden: "この操作を行う権限がありません",
  adminOnly: "管理者のみ操作できます",
  notFound: "見つかりません",
  pageNotFound: "ページが見つかりません",
  badRequest: "入力が不正です",
  conflict: "他のメンバーがこのページを更新しました",
  server: "サーバーエラーが発生しました",
} as const;

/** エラー応答を作る */
export function apiError(status: number, error: string, extra?: Omit<ApiErrorBody, "error">) {
  return NextResponse.json<ApiErrorBody>({ ...extra, error }, { status });
}

/** 401 ログインが必要 */
export function unauthorized(reason?: ApiErrorReason) {
  return apiError(401, ERROR_MESSAGES.unauthorized, reason ? { reason } : undefined);
}

/** 500 サーバーエラー */
export function serverError() {
  return apiError(500, ERROR_MESSAGES.server);
}

/** ルートハンドラの中で throw すると、withUser がエラー応答に変換する */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Omit<ApiErrorBody, "error">,
  ) {
    super(message);
  }
}
