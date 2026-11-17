"use client";
import useSWR, { mutate } from "swr";
import type { Me, Member, PageDetail, TreeNode } from "./types";
import type { ApiErrorBody } from "./api-error";
import { API, loginUrl } from "./routes";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: ApiErrorBody) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith(API.authPrefix)) {
    const reason = (data as ApiErrorBody).reason;
    window.location.href = reason === "disabled" || reason === "rejected" ? loginUrl({ status: reason }) : loginUrl();
  }
  if (!res.ok) throw new ApiError(res.status, (data as ApiErrorBody).error ?? "エラーが発生しました", data as ApiErrorBody);
  return data as T;
}

const fetcher = <T,>(url: string) => api<T>(url);

/** チームの変更を拾うためのポーリング間隔 */
export const POLL_MS = 5000;

export type TreeData = {
  tree: TreeNode[];
  favorites: { id: string; title: string; icon: string | null; type: string }[];
};

export function useTree() {
  return useSWR<TreeData>(API.pages, fetcher<TreeData>, { refreshInterval: POLL_MS });
}

export function usePage(id: string | null) {
  return useSWR<PageDetail>(id ? API.page(id) : null, fetcher<PageDetail>, { refreshInterval: POLL_MS });
}

export function useMembers() {
  return useSWR<Member[]>(API.members, fetcher<Member[]>);
}

export function useMe() {
  return useSWR<Me>(API.me, fetcher<Me>, { refreshInterval: 30000 });
}

export const refreshTree = () => mutate(API.pages);
export const refreshPage = (id: string) => mutate(API.page(id));

export async function createPage(opts: {
  parentId?: string | null;
  databaseId?: string | null;
  type?: "page" | "database";
  title?: string;
  values?: Record<string, unknown>;
}) {
  const { id } = await api<{ id: string }>(API.pages, { body: opts });
  refreshTree();
  if (opts.parentId) refreshPage(opts.parentId);
  if (opts.databaseId) refreshPage(opts.databaseId);
  return id;
}

export async function updatePage(id: string, patch: Record<string, unknown>) {
  return api<{ ok: true; updatedAt: number }>(API.page(id), { method: "PATCH", body: patch });
}

export async function trashPage(id: string) {
  await api(API.page(id), { method: "DELETE" });
  refreshTree();
  mutate(API.trash);
}

export async function setFavorite(pageId: string, favorite: boolean) {
  await api(API.favorites, { body: { pageId, favorite } });
  refreshTree();
  refreshPage(pageId);
}

export function displayTitle(t: string | null | undefined, fallback = "無題") {
  return t && t.trim() ? t : fallback;
}

export function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
