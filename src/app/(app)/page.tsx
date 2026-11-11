"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Database, FilePlus } from "lucide-react";
import { api, createPage, displayTitle, useMe } from "@/lib/client";
import { PageIcon, formatDate } from "@/components/ui";

type Recent = { id: string; title: string; icon: string | null; type: string; updatedAt: number };

export default function Home() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: recent } = useSWR<Recent[]>("/api/search?q=", (u: string) => api<Recent[]>(u), {
    refreshInterval: 10000,
  });

  const add = async (type: "page" | "database") => {
    const id = await createPage({ type, title: type === "database" ? "新しいデータベース" : "" });
    router.push(`/p/${id}`);
  };

  const hour = new Date().getHours();
  const greet = hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-12">
      <h1 className="text-3xl font-bold">
        {greet}
        {me ? `、${me.name}さん` : ""}
      </h1>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => add("page")}
          className="flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm hover:bg-hover"
        >
          <FilePlus size={18} className="text-muted" /> 新規ページ
        </button>
        <button
          onClick={() => add("database")}
          className="flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm hover:bg-hover"
        >
          <Database size={18} className="text-muted" /> 新規データベース
        </button>
      </div>

      <h2 className="mb-3 mt-12 text-sm font-medium text-muted">最近更新されたページ</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {recent?.slice(0, 9).map((p) => (
          <Link
            key={p.id}
            href={`/p/${p.id}`}
            className="rounded-xl border border-line p-4 transition hover:shadow-sm hover:bg-hover"
          >
            <PageIcon icon={p.icon} type={p.type} className="text-2xl" />
            <div className="mt-2 truncate text-sm font-medium">{displayTitle(p.title)}</div>
            <div className="mt-1 text-xs text-muted">{formatDate(p.updatedAt)}</div>
          </Link>
        ))}
      </div>
      {recent?.length === 0 && <p className="text-sm text-muted">まだページがありません。</p>}
    </div>
  );
}
