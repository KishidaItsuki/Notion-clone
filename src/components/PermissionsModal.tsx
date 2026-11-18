"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Lock, Plus, X } from "lucide-react";
import { api, displayTitle, refreshPage, refreshTree, useRoles } from "@/lib/client";
import { API, ROUTES } from "@/lib/routes";
import type { AccessLevel, PagePermissionSettings } from "@/lib/types";
import { Modal } from "./ui";
import { RoleTag } from "./RoleTag";

type Grant = PagePermissionSettings["grants"][number];

const LEVEL_LABEL: Record<AccessLevel, string> = { none: "アクセスなし", view: "閲覧のみ", edit: "編集可" };

/** ページのアクセス権限の設定（管理者のみ） */
export function PermissionsModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { data: settings } = useSWR<PagePermissionSettings>(API.pagePermissions(pageId), (u: string) =>
    api<PagePermissionSettings>(u),
  );
  const { data: roles } = useRoles();

  const [mode, setMode] = useState<"inherit" | "custom">("inherit");
  const [everyone, setEveryone] = useState<AccessLevel>("none");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 読み込んだ設定を編集用の state に反映
  useEffect(() => {
    if (!settings) return;
    if (settings.access === null) {
      setMode("inherit");
      // 個別設定に切り替えたときの初期値として、引き継いでいる設定をコピーしておく
      setEveryone(settings.inherited?.access ?? "edit");
      setGrants(settings.inherited?.grants ?? []);
    } else {
      setMode("custom");
      setEveryone(settings.access);
      setGrants(settings.grants);
    }
  }, [settings]);

  const roleOf = (id: string) => roles?.find((r) => r.id === id);
  const unused = (roles ?? []).filter((r) => !grants.some((g) => g.roleId === r.id));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api(API.pagePermissions(pageId), {
        method: "PUT",
        body: mode === "inherit" ? { access: null, grants: [] } : { access: everyone, grants },
      });
      refreshPage(pageId);
      refreshTree();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const select = "rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-accent";

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <Lock size={16} className="text-muted" />
        <span className="font-medium">アクセス権限</span>
        <button onClick={onClose} className="ml-auto rounded p-1 text-muted hover:bg-hover" aria-label="閉じる">
          <X size={16} />
        </button>
      </div>

      {!settings || !roles ? (
        <p className="px-5 py-10 text-center text-sm text-muted">読み込み中…</p>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4 text-sm scrollbar-thin">
          <label className="flex cursor-pointer gap-2 rounded-lg p-2 hover:bg-hover">
            <input type="radio" checked={mode === "inherit"} onChange={() => setMode("inherit")} className="mt-1" />
            <div>
              <div className="font-medium">親ページの設定を引き継ぐ</div>
              <div className="mt-0.5 text-xs text-muted">
                {settings.inherited ? (
                  <>
                    「
                    <Link href={ROUTES.page(settings.inherited.pageId)} className="underline" onClick={onClose}>
                      {displayTitle(settings.inherited.title)}
                    </Link>
                    」の設定：全員は{LEVEL_LABEL[settings.inherited.access]}
                    {settings.inherited.grants.map((g) => (
                      <span key={g.roleId}>
                        、{roleOf(g.roleId)?.name ?? "（削除されたロール）"}は{LEVEL_LABEL[g.level]}
                      </span>
                    ))}
                  </>
                ) : (
                  "上位のページに設定が無いため、全員が閲覧・編集できます"
                )}
              </div>
            </div>
          </label>

          <label className="mt-1 flex cursor-pointer gap-2 rounded-lg p-2 hover:bg-hover">
            <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} className="mt-1" />
            <div>
              <div className="font-medium">このページで個別に設定する</div>
              <div className="mt-0.5 text-xs text-muted">子ページも、個別に設定しない限りこの設定を引き継ぎます</div>
            </div>
          </label>

          {mode === "custom" && (
            <div className="ml-6 mt-3 rounded-lg border border-line">
              <Row label={<span className="font-medium">全員（承認済みのメンバー）</span>}>
                <select
                  value={everyone}
                  onChange={(e) => setEveryone(e.target.value as AccessLevel)}
                  className={select}
                >
                  <option value="none">アクセスなし</option>
                  <option value="view">閲覧のみ</option>
                  <option value="edit">編集可</option>
                </select>
              </Row>

              {grants.map((g) => {
                const role = roleOf(g.roleId);
                return (
                  <Row
                    key={g.roleId}
                    label={role ? <RoleTag role={role} /> : <span className="text-muted">（削除されたロール）</span>}
                  >
                    <select
                      value={g.level}
                      onChange={(e) =>
                        setGrants(
                          grants.map((x) =>
                            x.roleId === g.roleId ? { ...x, level: e.target.value as Grant["level"] } : x,
                          ),
                        )
                      }
                      className={select}
                    >
                      <option value="view">閲覧のみ</option>
                      <option value="edit">編集可</option>
                    </select>
                    <button
                      onClick={() => setGrants(grants.filter((x) => x.roleId !== g.roleId))}
                      className="rounded p-1 text-muted hover:bg-hover"
                      aria-label="ロールを外す"
                    >
                      <X size={14} />
                    </button>
                  </Row>
                );
              })}

              <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                <Plus size={14} className="text-muted" />
                {unused.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) =>
                      e.target.value && setGrants([...grants, { roleId: e.target.value, level: "view" }])
                    }
                    className={`${select} flex-1`}
                  >
                    <option value="">ロールを追加…</option>
                    {unused.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted">
                    {roles.length === 0 ? (
                      <>
                        ロールがありません。
                        <Link href={ROUTES.admin} className="text-accent underline" onClick={onClose}>
                          メンバー管理
                        </Link>
                        の「ロール」タブで作成してください
                      </>
                    ) : (
                      "すべてのロールを追加済みです"
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
            <li>複数のロールを持つ人には、一番強い権限が適用されます（「全員」の設定より弱くはなりません）。</li>
            <li>管理者は、設定にかかわらずすべてのページを閲覧・編集できます。</li>
            {mode === "custom" && everyone === "none" && grants.length === 0 && (
              <li className="text-amber-700">この設定では、管理者以外は誰もこのページを見られなくなります。</li>
            )}
          </ul>

          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-line hover:bg-hover">
          キャンセル
        </button>
        <button
          onClick={save}
          disabled={saving || !settings}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0f6fcf] disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">{label}</div>
      {children}
    </div>
  );
}
