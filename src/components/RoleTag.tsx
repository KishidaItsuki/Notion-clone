"use client";
import type { Role } from "@/lib/types";

/** ロールの色付きラベル */
export function RoleTag({ role, small }: { role: Pick<Role, "name" | "color">; small?: boolean }) {
  return (
    <span
      className={`tag-${role.color} inline-flex max-w-full items-center truncate rounded ${
        small ? "px-1.5 text-[11px] leading-[18px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      {role.name}
    </span>
  );
}
