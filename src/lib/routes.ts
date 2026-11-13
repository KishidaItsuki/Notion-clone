// 画面・API の URL を一元管理する。
// middleware（Edge ランタイム）・サーバー・ブラウザのどこからでも読み込めるよう、依存を持たせないこと。

/** ログイン画面に ?status= で渡す状態 */
export type LoginStatus = "pending" | "rejected" | "disabled";
/** ログイン画面に ?error= で渡すエラー */
export type LoginError = "config" | "cancelled" | "state" | "google" | "conflict";

/** 画面の URL */
export const ROUTES = {
  home: "/",
  login: "/login",
  admin: "/admin",
  page: (id: string) => `/p/${id}`,
} as const;

/** ログイン画面の URL（メッセージ付き） */
export function loginUrl(q?: { status?: LoginStatus; error?: LoginError }) {
  if (q?.status) return `${ROUTES.login}?status=${q.status}`;
  if (q?.error) return `${ROUTES.login}?error=${q.error}`;
  return ROUTES.login;
}

/** API の URL */
export const API = {
  prefix: "/api",

  // 認証
  authPrefix: "/api/auth",
  authGoogle: "/api/auth/google",
  authGoogleCallback: "/api/auth/google/callback",
  authLogout: "/api/auth/logout",

  // ページ
  pages: "/api/pages",
  page: (id: string) => `/api/pages/${id}`,
  pagePermanentDelete: (id: string) => `/api/pages/${id}?permanent=1`,
  pageRestore: (id: string) => `/api/pages/${id}/restore`,
  pageBeacon: (id: string) => `/api/pages/${id}/beacon`,

  search: (q: string) => `/api/search?q=${encodeURIComponent(q)}`,
  favorites: "/api/favorites",
  trash: "/api/trash",
  me: "/api/me",
  members: "/api/members",

  // 管理者
  adminUsers: "/api/admin/users",
  adminUser: (id: string) => `/api/admin/users/${id}`,
} as const;

/** 未ログインでもアクセスできるパス（前方一致） */
export const PUBLIC_PATH_PREFIXES: readonly string[] = [ROUTES.login, API.authPrefix];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
