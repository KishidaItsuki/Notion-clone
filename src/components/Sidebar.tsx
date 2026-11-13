"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronsLeft,
  Database,
  FilePlus,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  StarOff,
  Trash2,
  Users,
} from "lucide-react";
import {
  api,
  createPage,
  displayTitle,
  refreshTree,
  setFavorite,
  trashPage,
  updatePage,
  useMe,
  useTree,
} from "@/lib/client";
import type { TreeNode } from "@/lib/types";
import { MenuItem, PageIcon, Popover } from "./ui";
import { SearchModal } from "./SearchModal";
import { TrashModal } from "./TrashModal";
import { API, ROUTES } from "@/lib/routes";

type DropPos = "before" | "after" | "inside";

export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const { data } = useTree();
  const { data: me } = useMe();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const activeId = params?.id;
  const [searchOpen, setSearchOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [userMenu, setUserMenu] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setExpanded(JSON.parse(localStorage.getItem("nc_expanded") || "{}"));
    } catch {}
  }, []);
  const toggle = useCallback((id: string, open?: boolean) => {
    setExpanded((e) => {
      const next = { ...e, [id]: open ?? !e[id] };
      try {
        localStorage.setItem("nc_expanded", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K で検索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const byParent = useMemo(() => {
    const m = new Map<string | null, TreeNode[]>();
    for (const n of data?.tree ?? []) {
      const k = n.parentId ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position);
    return m;
  }, [data]);

  // 現在のページの祖先を自動で展開
  useEffect(() => {
    if (!activeId || !data) return;
    const map = new Map(data.tree.map((n) => [n.id, n]));
    let cur = map.get(activeId);
    while (cur?.parentId) {
      if (!expanded[cur.parentId]) toggle(cur.parentId, true);
      cur = map.get(cur.parentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, data]);

  const add = async (type: "page" | "database", parentId: string | null = null) => {
    const id = await createPage({ type, parentId, title: type === "database" ? "新しいデータベース" : "" });
    if (parentId) toggle(parentId, true);
    router.push(ROUTES.page(id));
  };

  const onDrop = async (dragId: string, target: TreeNode, pos: DropPos) => {
    if (dragId === target.id) return;
    if (pos === "inside") {
      const kids = byParent.get(target.id) ?? [];
      const position = (kids.at(-1)?.position ?? 0) + 1;
      try {
        await updatePage(dragId, { parentId: target.id, position });
        toggle(target.id, true);
      } catch (e) {
        alert((e as Error).message);
      }
    } else {
      const siblings = (byParent.get(target.parentId ?? null) ?? []).filter((s) => s.id !== dragId);
      const idx = siblings.findIndex((s) => s.id === target.id);
      const neighbor = pos === "before" ? siblings[idx - 1] : siblings[idx + 1];
      const position = neighbor
        ? (neighbor.position + target.position) / 2
        : target.position + (pos === "before" ? -1 : 1);
      try {
        await updatePage(dragId, { parentId: target.parentId, position });
      } catch (e) {
        alert((e as Error).message);
      }
    }
    refreshTree();
  };

  const logout = async () => {
    await api(API.authLogout, { method: "POST" });
    window.location.href = ROUTES.login;
  };

  const rootNodes = byParent.get(null) ?? [];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-sidebar text-sm text-ink/80">
      <div className="group flex items-center gap-2 px-3 py-2.5">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 hover:bg-hover"
          onClick={(e) => setUserMenu(e.currentTarget)}
        >
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-ink/80 text-[11px] font-bold text-white">
              {me?.name?.[0]?.toUpperCase() ?? "T"}
            </span>
          )}
          <span className="truncate font-medium text-ink">{me ? `${me.name} のチーム` : "TeamNotes"}</span>
        </button>
        <button
          onClick={onCollapse}
          title="サイドバーを閉じる"
          className="rounded p-1 text-muted opacity-0 hover:bg-hover group-hover:opacity-100"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>
      <Popover anchor={userMenu} onClose={() => setUserMenu(null)}>
        <div className="px-2 py-1.5 text-xs text-muted">{me?.email}</div>
        <MenuItem icon={<LogOut size={14} />} onClick={logout}>
          ログアウト
        </MenuItem>
      </Popover>

      <div className="px-2">
        <SideButton icon={<Search size={16} />} onClick={() => setSearchOpen(true)}>
          検索 <span className="ml-auto text-xs text-muted">⌘K</span>
        </SideButton>
        <SideButton icon={<FilePlus size={16} />} onClick={() => add("page")}>
          新規ページ
        </SideButton>
        {me?.role === "admin" && (
          <Link
            href={ROUTES.admin}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-hover ${
              pathname === ROUTES.admin ? "bg-hover font-medium text-ink" : ""
            }`}
          >
            <span className="text-muted">
              <Users size={16} />
            </span>
            メンバー管理
            {me.pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 text-xs text-white" title="承認待ち">
                {me.pendingCount}
              </span>
            )}
          </Link>
        )}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {!!data?.favorites.length && (
          <section className="mb-3">
            <SectionTitle>お気に入り</SectionTitle>
            {data.favorites.map((f) => (
              <Link
                key={f.id}
                href={ROUTES.page(f.id)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 hover:bg-hover ${
                  activeId === f.id ? "bg-hover font-medium text-ink" : ""
                }`}
              >
                <PageIcon icon={f.icon} type={f.type} className="w-5" />
                <span className="truncate">{displayTitle(f.title)}</span>
              </Link>
            ))}
          </section>
        )}

        <section>
          <div className="group flex items-center">
            <SectionTitle>ページ</SectionTitle>
            <button
              title="ページを追加"
              onClick={() => add("page")}
              className="ml-auto rounded p-0.5 text-muted opacity-0 hover:bg-hover group-hover:opacity-100"
            >
              <Plus size={14} />
            </button>
          </div>
          {rootNodes.map((n) => (
            <TreeItem
              key={n.id}
              node={n}
              depth={0}
              byParent={byParent}
              expanded={expanded}
              toggle={toggle}
              activeId={activeId}
              onAdd={(pid) => add("page", pid)}
              onDrop={onDrop}
              favorites={new Set(data?.favorites.map((f) => f.id))}
            />
          ))}
          {data && rootNodes.length === 0 && <p className="px-2 py-1 text-xs text-muted">ページがありません</p>}
          <SideButton icon={<Plus size={16} />} onClick={() => add("page")}>
            ページを追加
          </SideButton>
          <SideButton icon={<Database size={16} />} onClick={() => add("database")}>
            データベースを追加
          </SideButton>
        </section>
      </div>

      <div className="border-t border-line px-2 py-2">
        <SideButton icon={<Trash2 size={16} />} onClick={() => setTrashOpen(true)}>
          ゴミ箱
        </SideButton>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} />}
    </aside>
  );
}

function SideButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-hover">
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-xs font-medium text-muted">{children}</div>;
}

function TreeItem({
  node,
  depth,
  byParent,
  expanded,
  toggle,
  activeId,
  onAdd,
  onDrop,
  favorites,
}: {
  node: TreeNode;
  depth: number;
  byParent: Map<string | null, TreeNode[]>;
  expanded: Record<string, boolean>;
  toggle: (id: string, open?: boolean) => void;
  activeId?: string;
  onAdd: (parentId: string) => void;
  onDrop: (dragId: string, target: TreeNode, pos: DropPos) => void;
  favorites: Set<string>;
}) {
  const router = useRouter();
  const kids = byParent.get(node.id) ?? [];
  const open = !!expanded[node.id];
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [dropPos, setDropPos] = useState<DropPos | null>(null);
  const isFav = favorites.has(node.id);

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-page-id")) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    setDropPos(y < r.height * 0.25 ? "before" : y > r.height * 0.75 ? "after" : "inside");
  };

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-page-id", node.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropPos(null)}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("application/x-page-id");
          const pos = dropPos;
          setDropPos(null);
          if (id && pos) onDrop(id, node, pos);
        }}
        style={{ paddingLeft: 4 + depth * 14 }}
        className={`group relative flex items-center gap-0.5 rounded py-0.5 pr-1 hover:bg-hover ${
          activeId === node.id ? "bg-hover font-medium text-ink" : ""
        } ${dropPos === "inside" ? "bg-accent/15 ring-1 ring-accent/40" : ""}`}
      >
        {dropPos === "before" && <div className="absolute inset-x-1 top-0 h-0.5 bg-accent" />}
        {dropPos === "after" && <div className="absolute inset-x-1 bottom-0 h-0.5 bg-accent" />}
        <button
          onClick={() => toggle(node.id)}
          className="rounded p-0.5 text-muted hover:bg-black/5"
          aria-label={open ? "折りたたむ" : "展開"}
        >
          <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <Link href={ROUTES.page(node.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5">
          <PageIcon icon={node.icon} type={node.type} className="w-5" />
          <span className="truncate">{displayTitle(node.title)}</span>
        </Link>
        <button
          onClick={(e) => setMenu(e.currentTarget)}
          className="rounded p-0.5 text-muted opacity-0 hover:bg-black/5 group-hover:opacity-100"
          aria-label="メニュー"
        >
          <MoreHorizontal size={14} />
        </button>
        <button
          onClick={() => onAdd(node.id)}
          className="rounded p-0.5 text-muted opacity-0 hover:bg-black/5 group-hover:opacity-100"
          aria-label="子ページを追加"
        >
          <Plus size={14} />
        </button>
      </div>
      <Popover anchor={menu} onClose={() => setMenu(null)} width={200}>
        <MenuItem
          icon={isFav ? <StarOff size={14} /> : <Star size={14} />}
          onClick={() => {
            setMenu(null);
            setFavorite(node.id, !isFav);
          }}
        >
          {isFav ? "お気に入りから外す" : "お気に入りに追加"}
        </MenuItem>
        <MenuItem
          icon={<FilePlus size={14} />}
          onClick={() => {
            setMenu(null);
            onAdd(node.id);
          }}
        >
          子ページを追加
        </MenuItem>
        <MenuItem
          danger
          icon={<Trash2 size={14} />}
          onClick={async () => {
            setMenu(null);
            await trashPage(node.id);
            if (activeId === node.id) router.push(ROUTES.home);
          }}
        >
          ゴミ箱へ移動
        </MenuItem>
      </Popover>
      {open && (
        <div>
          {kids.length === 0 ? (
            <div style={{ paddingLeft: 26 + depth * 14 }} className="py-1 text-xs text-muted">
              {node.type === "database" ? "データベース" : "子ページはありません"}
            </div>
          ) : (
            kids.map((k) => (
              <TreeItem
                key={k.id}
                node={k}
                depth={depth + 1}
                byParent={byParent}
                expanded={expanded}
                toggle={toggle}
                activeId={activeId}
                onAdd={onAdd}
                onDrop={onDrop}
                favorites={favorites}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
