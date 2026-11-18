"use client";
import { useState } from "react";
import { mutate as globalMutate } from "swr";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, useRoles } from "@/lib/client";
import { API } from "@/lib/routes";
import { OPTION_COLORS, type Role } from "@/lib/types";
import { RoleTag } from "./RoleTag";

const COLOR_LABEL: Record<(typeof OPTION_COLORS)[number], string> = {
  gray: "グレー",
  brown: "ブラウン",
  orange: "オレンジ",
  yellow: "イエロー",
  green: "グリーン",
  blue: "ブルー",
  purple: "パープル",
  pink: "ピンク",
  red: "レッド",
};

/** メンバー管理画面の「ロール」タブ：ロールの作成・変更・削除 */
export function RolesPanel() {
  const { data: roles, mutate } = useRoles();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await mutate();
      globalMutate(API.adminUsers);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      await api(API.adminRoles, { body: { name, color } });
      setName("");
    });
  };

  const remove = (r: Role) => {
    const note = r.memberCount ? `${r.memberCount} 人のメンバーから外れ、` : "";
    if (!confirm(`ロール「${r.name}」を削除しますか？\n${note}このロールを使ったページの権限設定からも外れます。`))
      return;
    run(() => api(API.adminRole(r.id), { method: "DELETE" }));
  };

  const input = "rounded-md border border-black/15 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <div className="mt-4">
      <p className="text-sm text-muted">
        部署やプロジェクトなどのロールを作成し、メンバーに付与します（1人に複数付けられます）。ページごとの閲覧・編集権限はロール単位で設定します。
      </p>

      <form onSubmit={create} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新しいロール名（例：人事部）"
          maxLength={50}
          className={`${input} min-w-0 flex-1`}
        />
        <ColorSelect value={color} onChange={setColor} className={input} />
        <button
          disabled={!name.trim()}
          className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0f6fcf] disabled:opacity-50"
        >
          <Plus size={14} /> 作成
        </button>
      </form>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-4 divide-y divide-line">
        {roles?.map((r) =>
          editing === r.id ? (
            <RoleEditRow
              key={r.id}
              role={r}
              inputClass={input}
              onCancel={() => setEditing(null)}
              onSave={(patch) =>
                run(async () => {
                  await api(API.adminRole(r.id), { method: "PATCH", body: patch });
                  setEditing(null);
                })
              }
            />
          ) : (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <RoleTag role={r} />
              <span className="text-xs text-muted">{r.memberCount} 人</span>
              {r.description && <span className="truncate text-xs text-muted">{r.description}</span>}
              <div className="ml-auto flex gap-1">
                <button
                  title="編集"
                  onClick={() => setEditing(r.id)}
                  className="rounded p-1.5 text-muted hover:bg-hover"
                >
                  <Pencil size={14} />
                </button>
                <button
                  title="削除"
                  onClick={() => remove(r)}
                  className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ),
        )}
        {roles?.length === 0 && <li className="py-10 text-center text-sm text-muted">ロールはまだありません</li>}
      </ul>
    </div>
  );
}

function RoleEditRow({
  role,
  inputClass,
  onSave,
  onCancel,
}: {
  role: Role;
  inputClass: string;
  onSave: (patch: { name: string; color: string; description: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [description, setDescription] = useState(role.description);
  return (
    <li className="flex flex-wrap items-center gap-2 py-3">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={`${inputClass} w-40`} />
      <ColorSelect value={color} onChange={setColor} className={inputClass} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="説明（任意）"
        maxLength={200}
        className={`${inputClass} min-w-0 flex-1`}
      />
      <button
        onClick={() => onSave({ name, color, description })}
        disabled={!name.trim()}
        className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        保存
      </button>
      <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-line hover:bg-hover">
        キャンセル
      </button>
    </li>
  );
}

function ColorSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  return (
    <select
      aria-label="色"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} bg-white`}
    >
      {OPTION_COLORS.map((c) => (
        <option key={c} value={c}>
          {COLOR_LABEL[c]}
        </option>
      ))}
    </select>
  );
}
