"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mutate } from "swr";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Columns3,
  Plus,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { createPage, displayTitle, newClientId, trashPage, updatePage, useMembers } from "@/lib/client";
import {
  OPTION_COLORS,
  PROPERTY_TYPE_LABELS,
  type Member,
  type PageDetail,
  type Property,
  type PropertyType,
  type RowRecord,
  type ViewConfig,
} from "@/lib/types";
import { MenuItem, PageIcon, Popover } from "./ui";
import { PropertyDisplay, PropertyInput, Tag } from "./PropertyInput";
import { API, ROUTES } from "@/lib/routes";

export function DatabaseView({ page, readOnly }: { page: PageDetail; readOnly: boolean }) {
  const key = API.page(page.id);
  const properties = page.properties;
  const rows = page.rows ?? [];
  const view = page.viewConfig.view ?? "table";
  const sort = page.viewConfig.sort ?? null;
  const [filter, setFilter] = useState("");
  const { data: members } = useMembers();

  // --- 楽観的更新ヘルパー ---
  const optimistic = (fn: (d: PageDetail) => PageDetail) =>
    mutate<PageDetail>(key, (d) => (d ? fn(d) : d), { revalidate: false });

  const saveProperties = async (next: Property[]) => {
    optimistic((d) => ({ ...d, properties: next }));
    await updatePage(page.id, { properties: next });
    mutate(key);
  };
  const saveView = async (patch: ViewConfig) => {
    optimistic((d) => ({ ...d, viewConfig: { ...d.viewConfig, ...patch } }));
    await updatePage(page.id, { viewConfig: patch });
    mutate(key);
  };
  const patchRow = async (rowId: string, patch: { title?: string; values?: Record<string, unknown> }) => {
    optimistic((d) => ({
      ...d,
      rows: d.rows?.map((r) =>
        r.id === rowId
          ? { ...r, title: patch.title ?? r.title, values: { ...r.values, ...(patch.values ?? {}) } }
          : r,
      ),
    }));
    await updatePage(rowId, { title: patch.title, valuesPatch: patch.values });
    mutate(key);
  };
  const addRow = async (values: Record<string, unknown> = {}) => {
    await createPage({ databaseId: page.id, values });
    mutate(key);
  };
  const deleteRow = async (rowId: string) => {
    optimistic((d) => ({ ...d, rows: d.rows?.filter((r) => r.id !== rowId) }));
    await trashPage(rowId);
    mutate(key);
  };

  // --- フィルタ・並べ替え ---
  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        if (r.title.toLowerCase().includes(q)) return true;
        return properties.some((p) => valueText(p, r.values[p.id], members).toLowerCase().includes(q));
      });
    }
    if (sort) {
      const prop = properties.find((p) => p.id === sort.propId);
      const get = (r: RowRecord) => (sort.propId === "title" ? r.title : sortKey(prop, r.values[sort.propId], members));
      list = [...list].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        const empty = (v: unknown) => v === "" || v === null || v === undefined;
        if (empty(va) && !empty(vb)) return 1;
        if (!empty(va) && empty(vb)) return -1;
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ja");
        return sort.dir === "asc" ? c : -c;
      });
    }
    return list;
  }, [rows, filter, sort, properties, members]);

  return (
    <div>
      {/* ツールバー */}
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-line pb-1 text-sm">
        <ViewTab active={view === "table"} onClick={() => saveView({ view: "table" })} icon={<Table2 size={15} />}>
          テーブル
        </ViewTab>
        <ViewTab active={view === "board"} onClick={() => saveView({ view: "board" })} icon={<Columns3 size={15} />}>
          ボード
        </ViewTab>
        <div className="ml-auto flex items-center gap-1">
          {sort && (
            <button
              onClick={() => saveView({ sort: null })}
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
            >
              {sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {sort.propId === "title" ? "名前" : properties.find((p) => p.id === sort.propId)?.name}
              <X size={12} />
            </button>
          )}
          <div className="flex items-center gap-1 rounded px-2 py-1 hover:bg-hover">
            <Search size={14} className="text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="絞り込み"
              className="w-28 bg-transparent outline-none"
            />
          </div>
          {!readOnly && (
            <button onClick={() => addRow()} className="rounded bg-accent px-3 py-1 font-medium text-white hover:bg-[#0f6fcf]">
              新規
            </button>
          )}
        </div>
      </div>

      {view === "table" ? (
        <TableView
          databaseId={page.id}
          properties={properties}
          rows={visibleRows}
          sort={sort}
          readOnly={readOnly}
          onSaveProperties={saveProperties}
          onSort={(s) => saveView({ sort: s })}
          onPatchRow={patchRow}
          onAddRow={() => addRow()}
          onDeleteRow={deleteRow}
        />
      ) : (
        <BoardView
          properties={properties}
          rows={visibleRows}
          groupBy={page.viewConfig.groupBy}
          readOnly={readOnly}
          onGroupBy={(id) => saveView({ groupBy: id })}
          onSaveProperties={saveProperties}
          onPatchRow={patchRow}
          onAddRow={addRow}
        />
      )}
    </div>
  );
}

function valueText(p: Property, v: unknown, members?: Member[]): string {
  if (v === null || v === undefined) return "";
  if (p.type === "select") return p.options?.find((o) => o.id === v)?.name ?? "";
  if (p.type === "person") return members?.find((m) => m.id === v)?.name ?? "";
  if (p.type === "checkbox") return v ? "✓" : "";
  return String(v);
}

function sortKey(p: Property | undefined, v: unknown, members?: Member[]): unknown {
  if (!p) return "";
  if (p.type === "number") return typeof v === "number" ? v : "";
  if (p.type === "checkbox") return v ? 1 : 0;
  if (p.type === "select") {
    const idx = p.options?.findIndex((o) => o.id === v) ?? -1;
    return idx < 0 ? "" : idx;
  }
  return valueText(p, v, members);
}

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-2 py-1 ${active ? "font-medium text-ink" : "text-muted hover:bg-hover"}`}
    >
      {icon}
      {children}
      {active && <span className="sr-only">（表示中）</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* テーブルビュー */
/* ------------------------------------------------------------------ */

function TableView({
  databaseId,
  properties,
  rows,
  sort,
  readOnly,
  onSaveProperties,
  onSort,
  onPatchRow,
  onAddRow,
  onDeleteRow,
}: {
  databaseId: string;
  properties: Property[];
  rows: RowRecord[];
  sort: ViewConfig["sort"];
  readOnly: boolean;
  onSaveProperties: (p: Property[]) => void;
  onSort: (s: ViewConfig["sort"]) => void;
  onPatchRow: (id: string, patch: { title?: string; values?: Record<string, unknown> }) => void;
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}) {
  const [headerMenu, setHeaderMenu] = useState<{ el: HTMLElement; propId: string } | null>(null);
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);

  const addProperty = (type: PropertyType) => {
    setAddMenu(null);
    const prop: Property = {
      id: newClientId(),
      name: PROPERTY_TYPE_LABELS[type],
      type,
      ...(type === "select" ? { options: [] } : {}),
    };
    onSaveProperties([...properties, prop]);
  };

  const th = "border-r border-line px-2 py-1.5 text-left text-[13px] font-normal text-muted";
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-line">
            <th className={`${th} w-[260px] min-w-[260px]`}>
              <button
                className="flex w-full items-center gap-1 rounded px-1 hover:bg-hover"
                onClick={(e) => setHeaderMenu({ el: e.currentTarget, propId: "title" })}
              >
                Aa 名前
              </button>
            </th>
            {properties.map((p) => (
              <th key={p.id} className={`${th} w-[180px] min-w-[180px]`}>
                <button
                  className="flex w-full items-center gap-1 truncate rounded px-1 hover:bg-hover"
                  onClick={(e) => setHeaderMenu({ el: e.currentTarget, propId: p.id })}
                >
                  {p.name}
                  {sort?.propId === p.id && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </button>
              </th>
            ))}
            <th className="w-10 px-1 text-left">
              {!readOnly && (
                <button
                  title="プロパティを追加"
                  onClick={(e) => setAddMenu(e.currentTarget)}
                  className="rounded p-1 text-muted hover:bg-hover"
                >
                  <Plus size={15} />
                </button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group border-b border-line hover:bg-black/[0.015]">
              <td className="border-r border-line p-0">
                <div className="flex items-center">
                  <PageIcon icon={r.icon} className="ml-2 w-5 text-sm" />
                  <TitleCell value={r.title} readOnly={readOnly} onChange={(title) => onPatchRow(r.id, { title })} />
                  <Link
                    href={ROUTES.page(r.id)}
                    className="mr-1 flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-muted opacity-0 ring-1 ring-line hover:bg-hover group-hover:opacity-100"
                  >
                    <ArrowUpRight size={12} />
                    開く
                  </Link>
                </div>
              </td>
              {properties.map((p) => (
                <td key={p.id} className="border-r border-line p-0">
                  <PropertyInput
                    prop={p}
                    value={r.values[p.id]}
                    onChange={(v) => onPatchRow(r.id, { values: { [p.id]: v } })}
                    databaseId={databaseId}
                    properties={properties}
                    readOnly={readOnly}
                  />
                </td>
              ))}
              <td className="px-1">
                {!readOnly && (
                  <button
                    title="行を削除"
                    onClick={() => onDeleteRow(r.id)}
                    className="rounded p-1 text-muted opacity-0 hover:bg-hover hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button onClick={onAddRow} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm text-muted hover:bg-hover">
          <Plus size={14} /> 新規
        </button>
      )}
      <div className="px-2 py-1 text-xs text-muted">{rows.length} 件</div>

      <Popover anchor={addMenu} onClose={() => setAddMenu(null)} width={200}>
        <div className="px-2 py-1 text-xs text-muted">プロパティの種類</div>
        {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => (
          <MenuItem key={t} onClick={() => addProperty(t)}>
            {PROPERTY_TYPE_LABELS[t]}
          </MenuItem>
        ))}
      </Popover>

      {headerMenu && (
        <PropertyMenu
          anchor={headerMenu.el}
          propId={headerMenu.propId}
          properties={properties}
          readOnly={readOnly}
          onClose={() => setHeaderMenu(null)}
          onSave={onSaveProperties}
          onSort={(dir) => {
            onSort({ propId: headerMenu.propId, dir });
            setHeaderMenu(null);
          }}
        />
      )}
    </div>
  );
}

function TitleCell({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  if (!focused && draft !== value) setDraft(value);
  return (
    <input
      value={draft}
      readOnly={readOnly}
      placeholder="無題"
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onChange(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur();
      }}
      className="min-h-[32px] min-w-0 flex-1 bg-transparent px-2 font-medium outline-none placeholder:font-normal placeholder:text-ink/25"
    />
  );
}

/** 列ヘッダーのメニュー: 名前変更・種類変更・選択肢編集・並べ替え・削除 */
function PropertyMenu({
  anchor,
  propId,
  properties,
  readOnly,
  onClose,
  onSave,
  onSort,
}: {
  anchor: HTMLElement;
  propId: string;
  properties: Property[];
  readOnly: boolean;
  onClose: () => void;
  onSave: (p: Property[]) => void;
  onSort: (dir: "asc" | "desc") => void;
}) {
  const prop = properties.find((p) => p.id === propId);
  const [name, setName] = useState(prop?.name ?? "");
  const update = (patch: Partial<Property>) =>
    onSave(properties.map((p) => (p.id === propId ? { ...p, ...patch } : p)));

  return (
    <Popover anchor={anchor} onClose={onClose} width={250}>
      {prop && !readOnly && (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== prop.name && update({ name: name.trim() })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur();
            }}
            className="mb-1 w-full rounded border border-line bg-sidebar px-2 py-1 outline-none"
          />
          <label className="flex items-center gap-2 px-2 py-1 text-muted">
            種類
            <select
              value={prop.type}
              onChange={(e) => {
                const type = e.target.value as PropertyType;
                update({ type, options: type === "select" ? (prop.options ?? []) : prop.options });
              }}
              className="ml-auto rounded border border-line bg-white px-1 py-0.5 text-ink"
            >
              {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {prop.type === "select" && (
            <div className="my-1 border-y border-line py-1">
              <div className="px-2 py-1 text-xs text-muted">選択肢</div>
              {(prop.options ?? []).map((o) => (
                <div key={o.id} className="flex items-center gap-1 px-2 py-0.5">
                  <Tag option={o} />
                  <select
                    aria-label="色"
                    value={o.color}
                    onChange={(e) =>
                      update({
                        options: prop.options?.map((x) => (x.id === o.id ? { ...x, color: e.target.value } : x)),
                      })
                    }
                    className="ml-auto rounded border border-line bg-white text-xs"
                  >
                    {OPTION_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    title="選択肢を削除"
                    onClick={() => update({ options: prop.options?.filter((x) => x.id !== o.id) })}
                    className="rounded p-0.5 text-muted hover:bg-hover"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <NewOptionInput
                onAdd={(n) =>
                  update({
                    options: [
                      ...(prop.options ?? []),
                      {
                        id: newClientId(),
                        name: n,
                        color: OPTION_COLORS[((prop.options?.length ?? 0) + 1) % OPTION_COLORS.length],
                      },
                    ],
                  })
                }
              />
            </div>
          )}
        </>
      )}
      <MenuItem icon={<ArrowUp size={14} />} onClick={() => onSort("asc")}>
        昇順で並べ替え
      </MenuItem>
      <MenuItem icon={<ArrowDown size={14} />} onClick={() => onSort("desc")}>
        降順で並べ替え
      </MenuItem>
      {prop && !readOnly && (
        <MenuItem
          danger
          icon={<Trash2 size={14} />}
          onClick={() => {
            if (!confirm(`プロパティ「${prop.name}」を削除しますか？`)) return;
            onSave(properties.filter((p) => p.id !== propId));
            onClose();
          }}
        >
          プロパティを削除
        </MenuItem>
      )}
    </Popover>
  );
}

function NewOptionInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing && v.trim()) {
          onAdd(v.trim());
          setV("");
        }
      }}
      placeholder="＋ 選択肢を追加（Enter）"
      className="mx-2 mt-1 w-[calc(100%-1rem)] rounded px-1 py-0.5 text-sm outline-none hover:bg-hover focus:bg-sidebar"
    />
  );
}

/* ------------------------------------------------------------------ */
/* ボード（カンバン）ビュー */
/* ------------------------------------------------------------------ */

const NONE = "__none__";

function BoardView({
  properties,
  rows,
  groupBy,
  readOnly,
  onGroupBy,
  onSaveProperties,
  onPatchRow,
  onAddRow,
}: {
  properties: Property[];
  rows: RowRecord[];
  groupBy?: string;
  readOnly: boolean;
  onGroupBy: (id: string) => void;
  onSaveProperties: (p: Property[]) => void;
  onPatchRow: (id: string, patch: { title?: string; values?: Record<string, unknown> }) => void;
  onAddRow: (values?: Record<string, unknown>) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selectProps = properties.filter((p) => p.type === "select");
  const group = selectProps.find((p) => p.id === groupBy) ?? selectProps[0];
  const [newCol, setNewCol] = useState("");

  if (!group) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        ボード表示にはセレクト型のプロパティが必要です。
        {!readOnly && (
          <button
            className="ml-2 text-accent hover:underline"
            onClick={() =>
              onSaveProperties([
                ...properties,
                { id: newClientId(), name: "ステータス", type: "select", options: [] },
              ])
            }
          >
            「ステータス」を追加
          </button>
        )}
      </div>
    );
  }

  const columns = [{ id: NONE, name: `${group.name}なし`, color: "gray" }, ...(group.options ?? [])];
  const grouped = new Map<string, RowRecord[]>(columns.map((c) => [c.id, []]));
  for (const r of rows) {
    const v = r.values[group.id];
    const k = typeof v === "string" && grouped.has(v) ? v : NONE;
    grouped.get(k)!.push(r);
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const rowId = String(e.active.id);
    const colId = String(e.over.id);
    const row = rows.find((r) => r.id === rowId);
    const current = (row?.values[group.id] as string | undefined) ?? NONE;
    if (current === colId) return;
    onPatchRow(rowId, { values: { [group.id]: colId === NONE ? null : colId } });
  };

  return (
    <div>
      {selectProps.length > 1 && (
        <div className="mb-2 flex items-center gap-2 text-sm text-muted">
          グループ:
          <select
            value={group.id}
            onChange={(e) => onGroupBy(e.target.value)}
            className="rounded border border-line bg-white px-1 py-0.5 text-ink"
          >
            {selectProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              id={col.id}
              title={col.id === NONE ? <span className="text-muted">{col.name}</span> : <Tag option={col} />}
              color={col.color}
              count={grouped.get(col.id)!.length}
              readOnly={readOnly}
              onAdd={() => onAddRow(col.id === NONE ? {} : { [group.id]: col.id })}
            >
              {grouped.get(col.id)!.map((r) => (
                <BoardCard key={r.id} row={r} properties={properties.filter((p) => p.id !== group.id)} readOnly={readOnly} />
              ))}
            </BoardColumn>
          ))}
          {!readOnly && (
            <div className="w-56 shrink-0">
              <input
                value={newCol}
                onChange={(e) => setNewCol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && newCol.trim()) {
                    onSaveProperties(
                      properties.map((p) =>
                        p.id === group.id
                          ? {
                              ...p,
                              options: [
                                ...(p.options ?? []),
                                {
                                  id: newClientId(),
                                  name: newCol.trim(),
                                  color: OPTION_COLORS[((p.options?.length ?? 0) + 1) % OPTION_COLORS.length],
                                },
                              ],
                            }
                          : p,
                      ),
                    );
                    setNewCol("");
                  }
                }}
                placeholder="＋ グループを追加"
                className="w-full rounded px-2 py-1 text-sm text-muted outline-none hover:bg-hover focus:bg-sidebar"
              />
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}

function BoardColumn({
  id,
  title,
  color,
  count,
  readOnly,
  onAdd,
  children,
}: {
  id: string;
  title: React.ReactNode;
  color: string;
  count: number;
  readOnly: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`board-col-${color} flex w-64 shrink-0 flex-col rounded-lg p-2 transition ${isOver ? "ring-2 ring-accent/40" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2 px-1 text-sm">
        {title}
        <span className="text-xs text-muted">{count}</span>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2">{children}</div>
      {!readOnly && (
        <button onClick={onAdd} className="mt-2 flex items-center gap-1 rounded px-1 py-1 text-sm text-muted hover:bg-hover">
          <Plus size={14} /> 新規
        </button>
      )}
    </div>
  );
}

function BoardCard({ row, properties, readOnly }: { row: RowRecord; properties: Property[]; readOnly: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id, disabled: readOnly });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const shown = properties.filter((p) => {
    const v = row.values[p.id];
    return v !== undefined && v !== null && v !== "" && v !== false;
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && router.push(ROUTES.page(row.id))}
      className={`cursor-pointer rounded-md bg-white p-2.5 text-sm shadow-sm ring-1 ring-black/10 hover:bg-[#fafafa] ${
        isDragging ? "z-50 rotate-1 opacity-90 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {row.icon && <PageIcon icon={row.icon} />}
        <span className={row.title ? "" : "text-ink/30"}>{displayTitle(row.title)}</span>
      </div>
      {shown.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-ink/70">
          {shown.map((p) => (
            <div key={p.id} className="flex min-w-0 items-center">
              <PropertyDisplay prop={p} value={row.values[p.id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
