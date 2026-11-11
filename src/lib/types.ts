// クライアント・サーバー共通の型

export type PropertyType = "text" | "number" | "select" | "date" | "checkbox" | "person" | "url";

export type SelectOption = { id: string; name: string; color: string };

export type Property = {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
};

export type ViewConfig = {
  view?: "table" | "board";
  groupBy?: string;
  sort?: { propId: string; dir: "asc" | "desc" } | null;
};

export type TreeNode = {
  id: string;
  type: "page" | "database";
  title: string;
  icon: string | null;
  parentId: string | null;
  position: number;
};

export type Member = { id: string; name: string; email: string; avatarUrl?: string | null };

export type Me = Member & { role: "admin" | "member"; pendingCount: number };

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  status: "pending" | "approved" | "rejected" | "disabled";
  fixedAdmin: boolean;
  approvedBy: string | null;
  approvedAt: number | null;
  lastLoginAt: number | null;
  createdAt: number;
};

export type RowRecord = {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  values: Record<string, unknown>;
  updatedAt: number;
};

export type PageDetail = {
  id: string;
  type: "page" | "database";
  title: string;
  icon: string | null;
  content: unknown[];
  parentId: string | null;
  databaseId: string | null;
  properties: Property[];
  viewConfig: ViewConfig;
  values: Record<string, unknown>;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  updatedBy: string | null;
  breadcrumbs: { id: string; title: string; icon: string | null; type: string }[];
  /** 行ページの場合: 所属データベースのプロパティ定義 */
  dbProperties?: Property[];
  /** データベースの場合: 行一覧 */
  rows?: RowRecord[];
  isFavorite: boolean;
};

export const OPTION_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: "テキスト",
  number: "数値",
  select: "セレクト",
  date: "日付",
  checkbox: "チェックボックス",
  person: "ユーザー",
  url: "URL",
};
