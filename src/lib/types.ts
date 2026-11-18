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

export type AccessLevel = "none" | "view" | "edit";

export type TreeNode = {
  id: string;
  type: "page" | "database";
  title: string;
  icon: string | null;
  parentId: string | null;
  position: number;
  /** ログイン中のユーザーが編集できるか */
  canEdit: boolean;
  /** このページで個別に権限が設定されているか（鍵アイコンの表示用） */
  restricted: boolean;
};

export type Role = { id: string; name: string; description: string; color: string; memberCount: number };

/** ページのアクセス権限の設定（管理者向け） */
export type PagePermissionSettings = {
  /** null: 親の設定を引き継ぐ / それ以外: このページで設定（値は「全員」に与えるレベル） */
  access: AccessLevel | null;
  grants: { roleId: string; level: "view" | "edit" }[];
  /** 引き継いでいる場合の設定元（無ければ最上位まで設定なし＝全員が編集可） */
  inherited: { pageId: string; title: string; access: AccessLevel; grants: { roleId: string; level: "view" | "edit" }[] } | null;
};

export type Member = { id: string; name: string; email: string; avatarUrl?: string | null };

export type Me = Member & { role: "admin" | "member"; pendingCount: number; roleIds: string[] };

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  status: "pending" | "approved" | "rejected" | "disabled";
  fixedAdmin: boolean;
  roleIds: string[];
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
  /** ログイン中のユーザーの権限 */
  permission: {
    level: "view" | "edit";
    /** このページで個別に権限が設定されているか */
    restricted: boolean;
    /** 権限の設定元（このページ自身、または親）。どこにも設定が無ければ null */
    sourceId: string | null;
    /** 権限の設定を変更できるか（管理者のみ） */
    canManage: boolean;
  };
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
