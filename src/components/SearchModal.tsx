"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, displayTitle } from "@/lib/client";
import { Modal, PageIcon, formatDate } from "./ui";
import { API, ROUTES } from "@/lib/routes";

type Result = {
  id: string;
  title: string;
  icon: string | null;
  type: string;
  isRow: boolean;
  snippet: string;
  updatedAt: number;
};

export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      api<Result[]>(API.search(q)).then((r) => {
        setResults(r);
        setSel(0);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const go = (id: string) => {
    onClose();
    router.push(ROUTES.page(id));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[sel]) {
      go(results[sel].id);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Search size={18} className="text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="ページを検索…"
          className="flex-1 text-base outline-none"
        />
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-1 scrollbar-thin">
        {!q && <div className="px-3 py-1.5 text-xs text-muted">最近更新したページ</div>}
        {results.map((r, i) => (
          <button
            key={r.id}
            onMouseEnter={() => setSel(i)}
            onClick={() => go(r.id)}
            className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left ${i === sel ? "bg-hover" : ""}`}
          >
            <PageIcon icon={r.icon} type={r.type} className="mt-0.5 w-5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayTitle(r.title)}</div>
              {r.snippet && <div className="truncate text-xs text-muted">{r.snippet}</div>}
            </div>
            <span className="shrink-0 text-xs text-muted">{formatDate(r.updatedAt)}</span>
          </button>
        ))}
        {q && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">見つかりませんでした</p>}
      </div>
    </Modal>
  );
}
