"use client";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { RotateCcw, Trash2 } from "lucide-react";
import { api, displayTitle, refreshTree } from "@/lib/client";
import { Modal, PageIcon, formatDate } from "./ui";

type Item = { id: string; title: string; icon: string | null; type: string; deletedAt: number };

export function TrashModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data, mutate } = useSWR<Item[]>("/api/trash", (u: string) => api<Item[]>(u));

  const restore = async (id: string) => {
    await api(`/api/pages/${id}/restore`, { method: "POST" });
    mutate();
    refreshTree();
  };
  const destroy = async (item: Item) => {
    if (!confirm(`「${displayTitle(item.title)}」と配下のページを完全に削除します。元に戻せません。よろしいですか？`)) return;
    await api(`/api/pages/${item.id}?permanent=1`, { method: "DELETE" });
    mutate();
  };

  return (
    <Modal onClose={onClose}>
      <div className="border-b border-line px-4 py-3 font-medium">ゴミ箱</div>
      <div className="max-h-[55vh] overflow-y-auto p-1 scrollbar-thin">
        {data?.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">ゴミ箱は空です</p>}
        {data?.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-hover">
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => {
                onClose();
                router.push(`/p/${item.id}`);
              }}
            >
              <PageIcon icon={item.icon} type={item.type} className="w-5" />
              <span className="truncate text-sm">{displayTitle(item.title)}</span>
              <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(item.deletedAt)} に削除</span>
            </button>
            <button title="復元" onClick={() => restore(item.id)} className="rounded p-1 text-muted hover:bg-black/5">
              <RotateCcw size={15} />
            </button>
            <button title="完全に削除" onClick={() => destroy(item)} className="rounded p-1 text-muted hover:bg-black/5 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
