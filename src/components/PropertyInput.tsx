"use client";
import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { api, newClientId, refreshPage, useMembers } from "@/lib/client";
import { OPTION_COLORS, type Property, type SelectOption } from "@/lib/types";
import { Popover } from "./ui";
import { API } from "@/lib/routes";

/** セレクトの選択肢を追加し、データベースのプロパティ定義を更新 */
export async function addSelectOption(databaseId: string, properties: Property[], propId: string, name: string) {
  const prop = properties.find((p) => p.id === propId);
  const used = prop?.options?.length ?? 0;
  const option: SelectOption = { id: newClientId(), name, color: OPTION_COLORS[(used + 1) % OPTION_COLORS.length] };
  const next = properties.map((p) => (p.id === propId ? { ...p, options: [...(p.options ?? []), option] } : p));
  await api(API.page(databaseId), { method: "PATCH", body: { properties: next } });
  refreshPage(databaseId);
  return option;
}

export function Tag({ option }: { option?: SelectOption }) {
  if (!option) return null;
  return (
    <span className={`tag-${option.color} inline-block max-w-full truncate rounded px-1.5 py-px text-[13px] leading-5`}>
      {option.name}
    </span>
  );
}

export function PersonChip({ id }: { id?: unknown }) {
  const { data: members } = useMembers();
  const m = members?.find((x) => x.id === id);
  if (!m) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate">
      {m.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-full" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/70 text-[10px] text-white">
          {m.name[0]}
        </span>
      )}
      <span className="truncate">{m.name}</span>
    </span>
  );
}

export function formatDateValue(v: unknown) {
  if (typeof v !== "string" || !v) return "";
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

/** プロパティ値の表示（読み取り専用） */
export function PropertyDisplay({ prop, value }: { prop: Property; value: unknown }) {
  switch (prop.type) {
    case "select":
      return <Tag option={prop.options?.find((o) => o.id === value)} />;
    case "person":
      return <PersonChip id={value} />;
    case "checkbox":
      return value ? <Check size={14} /> : null;
    case "date":
      return <span>{formatDateValue(value)}</span>;
    default:
      return value === undefined || value === null || value === "" ? null : <span className="truncate">{String(value)}</span>;
  }
}

/** プロパティ値の編集セル */
export function PropertyInput({
  prop,
  value,
  onChange,
  databaseId,
  properties,
  readOnly,
}: {
  prop: Property;
  value: unknown;
  onChange: (v: unknown) => void;
  databaseId: string;
  properties: Property[];
  readOnly?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const cell = "flex min-h-[32px] w-full items-center px-2 text-sm";

  if (prop.type === "checkbox") {
    return (
      <div className={cell}>
        <input
          type="checkbox"
          disabled={readOnly}
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </div>
    );
  }

  if (prop.type === "text" || prop.type === "number" || prop.type === "url") {
    return <TextCell prop={prop} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  if (prop.type === "date") {
    return (
      <input
        type="date"
        disabled={readOnly}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${cell} bg-transparent outline-none hover:bg-hover`}
      />
    );
  }

  // select / person はポップオーバーで選ぶ
  return (
    <>
      <button
        disabled={readOnly}
        onClick={(e) => setAnchor(e.currentTarget)}
        className={`${cell} text-left hover:bg-hover disabled:hover:bg-transparent`}
      >
        <PropertyDisplay prop={prop} value={value} />
        {!value && !readOnly && <span className="text-ink/25">空</span>}
      </button>
      {anchor &&
        (prop.type === "select" ? (
          <SelectPicker
            anchor={anchor}
            onClose={() => setAnchor(null)}
            prop={prop}
            value={value}
            onChange={(v) => {
              onChange(v);
              setAnchor(null);
            }}
            onCreate={async (name) => {
              const opt = await addSelectOption(databaseId, properties, prop.id, name);
              onChange(opt.id);
              setAnchor(null);
            }}
          />
        ) : (
          <PersonPicker
            anchor={anchor}
            onClose={() => setAnchor(null)}
            value={value}
            onChange={(v) => {
              onChange(v);
              setAnchor(null);
            }}
          />
        ))}
    </>
  );
}

function TextCell({
  prop,
  value,
  onChange,
  readOnly,
}: {
  prop: Property;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const cur = value == null ? "" : String(value);
    if (draft === cur) return;
    if (prop.type === "number") onChange(draft === "" ? null : Number(draft));
    else onChange(draft === "" ? null : draft);
  };

  return (
    <div className="group relative flex w-full items-center">
      <input
        type={prop.type === "number" ? "number" : "text"}
        readOnly={readOnly}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur();
        }}
        className={`min-h-[32px] w-full bg-transparent px-2 text-sm outline-none hover:bg-hover focus:bg-white focus:ring-2 focus:ring-accent/30 ${
          prop.type === "number" ? "text-right" : ""
        } ${prop.type === "url" && !focused ? "text-accent underline" : ""}`}
      />
      {prop.type === "url" && draft && !focused && (
        <a
          href={/^https?:\/\//.test(draft) ? draft : `https://${draft}`}
          target="_blank"
          rel="noreferrer"
          className="absolute right-1 rounded bg-white p-1 text-muted opacity-0 shadow ring-1 ring-black/10 group-hover:opacity-100"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function SelectPicker({
  anchor,
  onClose,
  prop,
  value,
  onChange,
  onCreate,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  prop: Property;
  value: unknown;
  onChange: (v: unknown) => void;
  onCreate: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const options = (prop.options ?? []).filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
  const exact = prop.options?.some((o) => o.name === q.trim());
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            if (options[0] && (exact || !q.trim())) onChange(options[0].id);
            else if (q.trim()) onCreate(q.trim());
          }
        }}
        placeholder="選択肢を検索・作成"
        className="mb-1 w-full rounded border border-line bg-sidebar px-2 py-1 text-sm outline-none"
      />
      {value != null && (
        <button onClick={() => onChange(null)} className="w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-hover">
          クリア
        </button>
      )}
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-hover"
        >
          <Tag option={o} />
          {o.id === value && <Check size={14} className="text-muted" />}
        </button>
      ))}
      {q.trim() && !exact && (
        <button onClick={() => onCreate(q.trim())} className="w-full rounded px-2 py-1 text-left hover:bg-hover">
          作成: <span className="tag-gray rounded px-1.5">{q.trim()}</span>
        </button>
      )}
    </Popover>
  );
}

function PersonPicker({
  anchor,
  onClose,
  value,
  onChange,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { data: members } = useMembers();
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      {value != null && (
        <button onClick={() => onChange(null)} className="w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-hover">
          クリア
        </button>
      )}
      {members?.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-hover"
        >
          <PersonChip id={m.id} />
          {m.id === value && <Check size={14} className="text-muted" />}
        </button>
      ))}
    </Popover>
  );
}
