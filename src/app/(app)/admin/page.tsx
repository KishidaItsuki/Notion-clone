"use client";
import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Check, ShieldCheck, Tags, UserX, X } from "lucide-react";
import { api, useMe, useRoles } from "@/lib/client";
import type { AdminUser } from "@/lib/types";
import { Popover, formatDate } from "@/components/ui";
import { RoleTag } from "@/components/RoleTag";
import { RolesPanel } from "@/components/RolesPanel";
import { API } from "@/lib/routes";

const TABS = [
  { key: "pending", label: "承認待ち" },
  { key: "approved", label: "メンバー" },
  { key: "other", label: "却下・停止" },
  { key: "roles", label: "ロール" },
] as const;

const STATUS_LABEL: Record<AdminUser["status"], string> = {
  pending: "承認待ち",
  approved: "利用中",
  rejected: "却下",
  disabled: "利用停止",
};

export default function AdminPage() {
  const { data: me } = useMe();
  const { data: users, mutate } = useSWR<AdminUser[]>(me?.role === "admin" ? API.adminUsers : null, (u: string) =>
    api<AdminUser[]>(u),
  );
  const { data: roles } = useRoles(me?.role === "admin");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [error, setError] = useState("");
  const [rolePicker, setRolePicker] = useState<{ el: HTMLElement; user: AdminUser } | null>(null);

  const setUserRoles = async (u: AdminUser, roleIds: string[]) => {
    setError("");
    try {
      await api(API.adminUserRoles(u.id), { method: "PUT", body: { roleIds } });
      await mutate();
      globalMutate(API.adminRoles);
      globalMutate(API.me);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (me && me.role !== "admin") {
    return <div className="p-16 text-center text-muted">このページは管理者のみ利用できます。</div>;
  }

  const update = async (u: AdminUser, patch: Partial<Pick<AdminUser, "status" | "role">>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setError("");
    try {
      await api(API.adminUser(u.id), { method: "PATCH", body: patch });
      await mutate();
      globalMutate(API.me);
      globalMutate(API.members);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const list = (users ?? []).filter((u) =>
    tab === "other" ? u.status === "rejected" || u.status === "disabled" : u.status === tab,
  );
  const count = (k: string) =>
    k === "roles"
      ? (roles?.length ?? 0)
      : (users ?? []).filter((u) =>
          k === "other" ? u.status === "rejected" || u.status === "disabled" : u.status === k,
        ).length;

  const btn = "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium";

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:px-12">
      <h1 className="text-3xl font-bold">メンバー管理</h1>
      <p className="mt-2 text-sm text-muted">
        Googleでログインした人は「承認待ち」に表示されます。承認するとワークスペースを利用できるようになります。
        「ロール」タブで作成したロールをメンバーに付与すると、ページごとの閲覧・編集権限に使えます。
      </p>

      <div className="mt-8 flex gap-1 border-b border-line text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 ${
              tab === t.key ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span
              className={`ml-1.5 rounded-full px-1.5 text-xs ${
                t.key === "pending" && count(t.key) > 0 ? "bg-red-500 text-white" : "bg-hover text-muted"
              }`}
            >
              {count(t.key)}
            </span>
          </button>
        ))}
      </div>

      {tab === "roles" ? (
        <RolesPanel />
      ) : (
        <>
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <ul className="mt-2 divide-y divide-line">
            {list.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{u.name}</span>
                    {u.role === "admin" && (
                      <span className="rounded bg-ink/80 px-1.5 text-[11px] font-normal text-white">管理者</span>
                    )}
                    {u.id === me?.id && <span className="text-xs font-normal text-muted">（あなた）</span>}
                  </div>
                  <div className="truncate text-xs text-muted">{u.email}</div>
                  {u.roleIds.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.roleIds
                        .map((id) => roles?.find((r) => r.id === id))
                        .filter((r) => !!r)
                        .map((r) => (
                          <RoleTag key={r.id} role={r} small />
                        ))}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted">
                    {u.status === "pending"
                      ? `${formatDate(u.createdAt)} に申請`
                      : u.status === "approved"
                        ? `${u.approvedBy ? `${u.approvedBy} が承認 · ` : ""}最終ログイン ${u.lastLoginAt ? formatDate(u.lastLoginAt) : "なし"}`
                        : STATUS_LABEL[u.status]}
                  </div>
                </div>

                {u.status !== "rejected" && u.status !== "disabled" && (
                  <button
                    onClick={(e) => setRolePicker({ el: e.currentTarget, user: u })}
                    className={`${btn} ring-1 ring-line hover:bg-hover`}
                  >
                    <Tags size={13} /> ロール
                  </button>
                )}
                {u.fixedAdmin ? (
                  <span className="text-xs text-muted">.env で指定された管理者</span>
                ) : u.id === me?.id ? null : (
                  <div className="flex flex-wrap gap-1.5">
                    {u.status === "pending" && (
                      <>
                        <button
                          onClick={() => update(u, { status: "approved" })}
                          className={`${btn} bg-accent text-white hover:bg-[#0f6fcf]`}
                        >
                          <Check size={13} /> 承認
                        </button>
                        <button
                          onClick={() => update(u, { status: "rejected" })}
                          className={`${btn} ring-1 ring-line hover:bg-hover`}
                        >
                          <X size={13} /> 却下
                        </button>
                      </>
                    )}
                    {u.status === "approved" && (
                      <>
                        <button
                          onClick={() =>
                            update(
                              u,
                              { role: u.role === "admin" ? "member" : "admin" },
                              u.role === "admin" ? undefined : `${u.name} を管理者にしますか？`,
                            )
                          }
                          className={`${btn} ring-1 ring-line hover:bg-hover`}
                        >
                          <ShieldCheck size={13} /> {u.role === "admin" ? "管理者を解除" : "管理者にする"}
                        </button>
                        <button
                          onClick={() =>
                            update(
                              u,
                              { status: "disabled" },
                              `${u.name} を利用停止にしますか？すぐにログアウトされます。`,
                            )
                          }
                          className={`${btn} text-red-600 ring-1 ring-line hover:bg-red-50`}
                        >
                          <UserX size={13} /> 利用停止
                        </button>
                      </>
                    )}
                    {(u.status === "rejected" || u.status === "disabled") && (
                      <button
                        onClick={() => update(u, { status: "approved" })}
                        className={`${btn} ring-1 ring-line hover:bg-hover`}
                      >
                        <Check size={13} /> {u.status === "rejected" ? "承認する" : "利用を再開"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
            {users && list.length === 0 && (
              <li className="py-10 text-center text-sm text-muted">
                {tab === "pending" ? "承認待ちの申請はありません" : "該当するユーザーはいません"}
              </li>
            )}
          </ul>
        </>
      )}

      {rolePicker && (
        <Popover anchor={rolePicker.el} onClose={() => setRolePicker(null)} align="right" width={240}>
          <div className="px-2 py-1.5 text-xs text-muted">{rolePicker.user.name} のロール</div>
          {roles?.map((r) => {
            const checked = rolePicker.user.roleIds.includes(r.id);
            return (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? rolePicker.user.roleIds.filter((id) => id !== r.id)
                      : [...rolePicker.user.roleIds, r.id];
                    setRolePicker({ ...rolePicker, user: { ...rolePicker.user, roleIds: next } });
                    setUserRoles(rolePicker.user, next);
                  }}
                  className="h-4 w-4 accent-accent"
                />
                <RoleTag role={r} small />
              </label>
            );
          })}
          {roles?.length === 0 && (
            <button
              onClick={() => {
                setRolePicker(null);
                setTab("roles");
              }}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-accent hover:bg-hover"
            >
              ロールを作成する
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}

function Avatar({ user }: { user: { name: string; avatarUrl: string | null } }) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/70 text-sm text-white">
      {user.name[0]}
    </span>
  );
}
