"use client";
import { useState } from "react";
import { ChevronsRight } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-full overflow-hidden">
      {!collapsed && <Sidebar onCollapse={() => setCollapsed(true)} />}
      <main className="relative min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="サイドバーを開く"
            className="fixed left-2 top-2 z-20 rounded p-1 text-muted hover:bg-hover"
          >
            <ChevronsRight size={18} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
