"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, RotateCcw, Smile, Star, Trash2 } from "lucide-react";
import {
  ApiError,
  api,
  displayTitle,
  refreshTree,
  setFavorite,
  trashPage,
  updatePage,
  usePage,
} from "@/lib/client";
import type { PageDetail } from "@/lib/types";
import { EmojiPicker, MenuItem, PageIcon, Popover, formatDate } from "./ui";
import { DatabaseView } from "./DatabaseView";
import { RowProperties } from "./RowProperties";
import { API, ROUTES } from "@/lib/routes";

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="px-[54px] text-muted">読み込み中…</div>,
});

export function PageView({ id }: { id: string }) {
  const { data, error, mutate } = usePage(id);

  if (error) {
    return <div className="p-16 text-center text-muted">{(error as Error).message}</div>;
  }
  if (!data) return <div className="p-16 text-center text-muted">読み込み中…</div>;
  return <PageBody page={data} mutate={mutate} />;
}

function PageBody({ page, mutate }: { page: PageDetail; mutate: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [iconMenu, setIconMenu] = useState<HTMLElement | null>(null);
  const [moreMenu, setMoreMenu] = useState<HTMLElement | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [conflict, setConflict] = useState<{ updatedBy: string | null } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [remotePending, setRemotePending] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState(page.content);

  const titleFocused = useRef(false);
  const baseUpdatedAt = useRef(page.updatedAt);
  const dirty = useRef(false);
  const pendingBlocks = useRef<unknown[] | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const readOnly = !!page.deletedAt;

  // 他メンバーの変更を取り込む（自分が未保存の編集をしていない時だけ）
  useEffect(() => {
    if (page.updatedAt > baseUpdatedAt.current && !dirty.current) {
      const editorFocused = !!document.activeElement?.closest(".nc-editor");
      if (editorFocused) {
        // カーソルを奪わないよう、編集中は通知だけ出す
        setRemotePending(page.updatedBy ?? "他のメンバー");
      } else {
        baseUpdatedAt.current = page.updatedAt;
        setRemotePending(null);
        if (JSON.stringify(page.content) !== JSON.stringify(editorContent)) {
          setEditorContent(page.content);
          setEditorKey((k) => k + 1);
        }
      }
    }
    if (!titleFocused.current) setTitle(page.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.updatedAt, page.title]);

  const saveContent = useCallback(
    async (force = false) => {
      const blocks = pendingBlocks.current;
      if (!blocks) return;
      setSaveState("saving");
      try {
        const r = await updatePage(page.id, { content: blocks, baseUpdatedAt: baseUpdatedAt.current, force });
        baseUpdatedAt.current = r.updatedAt;
        if (pendingBlocks.current === blocks) {
          pendingBlocks.current = null;
          dirty.current = false;
        }
        setConflict(null);
        setSaveState("saved");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setConflict({ updatedBy: (e.data?.updatedBy as string | undefined) ?? null });
          setSaveState("saved");
        } else {
          setSaveState("error");
        }
      }
    },
    [page.id],
  );

  // ページ離脱時に未保存の内容を保存
  useEffect(() => {
    const flush = () => {
      if (pendingBlocks.current) {
        navigator.sendBeacon?.(
          API.pageBeacon(page.id),
          new Blob([JSON.stringify({ content: pendingBlocks.current })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      clearTimeout(contentTimer.current);
      if (pendingBlocks.current && !conflictRef.current) saveContent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;

  const onEditorChange = (blocks: unknown[]) => {
    dirty.current = true;
    pendingBlocks.current = blocks;
    setSaveState("saving");
    clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => saveContent(), 700);
  };

  const onTitleChange = (v: string) => {
    setTitle(v);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      const r = await updatePage(page.id, { title: v });
      if (!dirty.current) baseUpdatedAt.current = r.updatedAt;
      refreshTree();
    }, 400);
  };

  const setIcon = async (icon: string | null) => {
    setIconMenu(null);
    await updatePage(page.id, { icon });
    mutate();
    refreshTree();
  };

  const reloadLatest = async () => {
    pendingBlocks.current = null;
    dirty.current = false;
    setConflict(null);
    setRemotePending(null);
    const fresh = await api<PageDetail>(API.page(page.id));
    baseUpdatedAt.current = fresh.updatedAt;
    setEditorContent(fresh.content);
    setEditorKey((k) => k + 1);
    mutate();
  };

  const restore = async () => {
    await api(API.pageRestore(page.id), { method: "POST" });
    mutate();
    refreshTree();
  };
  const destroy = async () => {
    if (!confirm("このページを完全に削除します。元に戻せません。")) return;
    await api(API.pagePermanentDelete(page.id), { method: "DELETE" });
    router.push(ROUTES.home);
  };

  const isDb = page.type === "database";

  return (
    <div className="min-h-full">
      {/* トップバー */}
      <div className="sticky top-0 z-10 flex h-11 items-center gap-2 bg-white/90 px-4 pl-10 text-sm backdrop-blur">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-ink/80">
          {page.breadcrumbs.map((c, i) => (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <span className="text-muted">/</span>}
              <Link href={ROUTES.page(c.id)} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-hover">
                <PageIcon icon={c.id === page.id ? page.icon : c.icon} type={c.type} />
                <span className="max-w-40 truncate">{displayTitle(c.id === page.id ? title : c.title)}</span>
              </Link>
            </span>
          ))}
        </nav>
        <span className="hidden text-xs text-muted sm:inline">
          {saveState === "saving"
            ? "保存中…"
            : saveState === "error"
              ? "保存に失敗しました"
              : page.updatedBy
                ? `${page.updatedBy} が ${formatDate(page.updatedAt)} に編集`
                : ""}
        </span>
        <button
          title={page.isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
          onClick={() => setFavorite(page.id, !page.isFavorite)}
          className="rounded p-1 hover:bg-hover"
        >
          <Star size={17} className={page.isFavorite ? "fill-yellow-400 text-yellow-500" : "text-muted"} />
        </button>
        <button title="その他の操作" onClick={(e) => setMoreMenu(e.currentTarget)} className="rounded p-1 text-muted hover:bg-hover">
          <MoreHorizontal size={18} />
        </button>
        <Popover anchor={moreMenu} onClose={() => setMoreMenu(null)} align="right" width={220}>
          <div className="px-2 py-1.5 text-xs text-muted">
            作成: {page.createdBy ?? "不明"}（{formatDate(page.createdAt)}）
          </div>
          {!readOnly && (
            <MenuItem
              danger
              icon={<Trash2 size={14} />}
              onClick={async () => {
                setMoreMenu(null);
                await trashPage(page.id);
                mutate();
              }}
            >
              ゴミ箱へ移動
            </MenuItem>
          )}
        </Popover>
      </div>

      {readOnly && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-red-500 px-4 py-2 text-sm text-white">
          このページはゴミ箱にあります。
          <button onClick={restore} className="flex items-center gap-1 rounded border border-white/60 px-2 py-0.5 hover:bg-white/10">
            <RotateCcw size={14} /> 復元
          </button>
          <button onClick={destroy} className="rounded border border-white/60 px-2 py-0.5 hover:bg-white/10">
            完全に削除
          </button>
        </div>
      )}

      {remotePending && !conflict && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-sky-50 px-4 py-1.5 text-sm text-sky-900">
          {remotePending} がこのページを更新しました。
          <button onClick={reloadLatest} className="rounded border border-sky-900/40 px-2 py-0.5 hover:bg-sky-100">
            最新版を表示
          </button>
        </div>
      )}

      {conflict && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          {conflict.updatedBy ?? "他のメンバー"} がこのページを更新しました。
          <button onClick={reloadLatest} className="rounded bg-amber-900 px-2 py-0.5 text-white">
            最新版を読み込む
          </button>
          <button onClick={() => saveContent(true)} className="rounded border border-amber-900/50 px-2 py-0.5">
            自分の変更で上書き
          </button>
        </div>
      )}

      <div className={`mx-auto ${isDb ? "max-w-none px-4 sm:px-24" : "max-w-[900px]"} pb-40 pt-16`}>
        {/* アイコン + タイトル */}
        <div className={`group ${isDb ? "" : "px-[54px]"}`}>
          {page.icon ? (
            <button
              onClick={(e) => !readOnly && setIconMenu(e.currentTarget)}
              className="mb-2 rounded-lg p-1 text-6xl leading-none hover:bg-hover"
            >
              {page.icon}
            </button>
          ) : (
            !readOnly && (
              <button
                onClick={(e) => setIconMenu(e.currentTarget)}
                className="mb-2 flex items-center gap-1 rounded px-1.5 py-1 text-sm text-muted opacity-0 hover:bg-hover group-hover:opacity-100"
              >
                <Smile size={15} /> アイコンを追加
              </button>
            )
          )}
          <Popover anchor={iconMenu} onClose={() => setIconMenu(null)} width={300}>
            <EmojiPicker onPick={setIcon} onRemove={page.icon ? () => setIcon(null) : undefined} />
          </Popover>
          <TitleInput
            value={title}
            readOnly={readOnly}
            onChange={onTitleChange}
            onFocus={() => (titleFocused.current = true)}
            onBlur={() => (titleFocused.current = false)}
            onEnter={() => {
              const el = document.querySelector<HTMLElement>(".nc-editor [contenteditable=true]");
              el?.focus();
            }}
          />
        </div>

        {page.databaseId && page.dbProperties && (
          <div className="px-[54px]">
            <RowProperties
              rowId={page.id}
              databaseId={page.databaseId}
              properties={page.dbProperties}
              values={page.values}
              readOnly={readOnly}
              onChanged={mutate}
            />
          </div>
        )}

        <div className="mt-4">
          {isDb ? (
            <DatabaseView page={page} readOnly={readOnly} />
          ) : (
            <Editor key={editorKey} initialContent={editorContent} onChange={onEditorChange} editable={!readOnly} />
          )}
        </div>
      </div>
    </div>
  );
}

function TitleInput({
  value,
  onChange,
  readOnly,
  onFocus,
  onBlur,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onEnter: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={readOnly}
      placeholder="無題"
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
      className="w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight outline-none placeholder:text-ink/20"
    />
  );
}
