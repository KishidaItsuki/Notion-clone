"use client";
import useSWR, { mutate } from "swr";
import type { Me, Member, PageDetail, TreeNode } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
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
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    const reason = (data as { reason?: string }).reason;
    window.location.href = reason === "disabled" || reason === "rejected" ? `/login?status=${reason}` : "/login";
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "エラーが発生しました", data);
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
  return useSWR<TreeData>("/api/pages", fetcher<TreeData>, { refreshInterval: POLL_MS });
}

export function usePage(id: string | null) {
  return useSWR<PageDetail>(id ? `/api/pages/${id}` : null, fetcher<PageDetail>, { refreshInterval: POLL_MS });
}

export function useMembers() {
  return useSWR<Member[]>("/api/members", fetcher<Member[]>);
}

export function useMe() {
  return useSWR<Me>("/api/me", fetcher<Me>, { refreshInterval: 30000 });
}

export const refreshTree = () => mutate("/api/pages");
export const refreshPage = (id: string) => mutate(`/api/pages/${id}`);

export async function createPage(opts: {
  parentId?: string | null;
  databaseId?: string | null;
  type?: "page" | "database";
  title?: string;
  values?: Record<string, unknown>;
}) {
  const { id } = await api<{ id: string }>("/api/pages", { body: opts });
  refreshTree();
  if (opts.parentId) refreshPage(opts.parentId);
  if (opts.databaseId) refreshPage(opts.databaseId);
  return id;
}

export async function updatePage(id: string, patch: Record<string, unknown>) {
  return api<{ ok: true; updatedAt: number }>(`/api/pages/${id}`, { method: "PATCH", body: patch });
}

export async function trashPage(id: string) {
  await api(`/api/pages/${id}`, { method: "DELETE" });
  refreshTree();
  mutate("/api/trash");
}

export async function setFavorite(pageId: string, favorite: boolean) {
  await api("/api/favorites", { body: { pageId, favorite } });
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
