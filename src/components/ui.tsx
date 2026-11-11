"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** クリック位置に出るシンプルなポップオーバーメニュー */
export function Popover({
  anchor,
  onClose,
  children,
  width = 240,
  align = "left",
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = r.bottom + 4;
    if (top > window.innerHeight - 200) top = Math.max(8, r.top - 4 - 260);
    setPos({ top, left });
  }, [anchor, width, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  if (!anchor || !pos) return null;
  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left, width }}
      className="fixed z-50 max-h-[60vh] overflow-auto rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-black/10 scrollbar-thin"
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover ${
        danger ? "text-red-600" : ""
      } ${active ? "bg-hover" : ""}`}
    >
      {icon && <span className="flex w-4 justify-center text-muted">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function Modal({ onClose, children, className = "" }: { onClose: () => void; children: React.ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className={`w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const EMOJIS =
  "📄 📝 📌 📎 📚 📖 🗂️ 📁 📅 🗓️ ✅ ☑️ 🎯 🚀 💡 🔥 ⭐ 🌟 💼 🏠 🧪 🛠️ ⚙️ 🔧 🧩 🎨 🎵 📷 🎬 🍀 🌱 🌈 ☀️ 🌙 ⚡ 💬 📣 🔔 🔒 🔑 💰 📈 📊 🧭 🗺️ ✈️ 🏁 🐛 🤖 👋 🙌 👀 ❤️ 😀 😎 🤔 🎉 🍣 ☕".split(
    " ",
  );

export function EmojiPicker({ onPick, onRemove }: { onPick: (e: string) => void; onRemove?: () => void }) {
  return (
    <div>
      <div className="grid grid-cols-8 gap-0.5 p-1">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => onPick(e)} className="rounded p-1 text-xl hover:bg-hover">
            {e}
          </button>
        ))}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="w-full rounded px-2 py-1.5 text-left text-muted hover:bg-hover">
          アイコンを削除
        </button>
      )}
    </div>
  );
}

export function PageIcon({ icon, type, className = "" }: { icon: string | null; type?: string; className?: string }) {
  return <span className={`inline-flex shrink-0 justify-center ${className}`}>{icon || (type === "database" ? "🗃️" : "📄")}</span>;
}

export function formatDate(ms: number) {
  return new Date(ms).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
