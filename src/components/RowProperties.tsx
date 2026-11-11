"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { refreshPage, updatePage } from "@/lib/client";
import { PROPERTY_TYPE_LABELS, type Property } from "@/lib/types";
import { PropertyInput } from "./PropertyInput";

/** データベースの行をページとして開いたときのプロパティ一覧 */
export function RowProperties({
  rowId,
  databaseId,
  properties,
  values,
  readOnly,
  onChanged,
}: {
  rowId: string;
  databaseId: string;
  properties: Property[];
  values: Record<string, unknown>;
  readOnly?: boolean;
  onChanged: () => void;
}) {
  const change = async (propId: string, v: unknown) => {
    await updatePage(rowId, { valuesPatch: { [propId]: v } });
    onChanged();
    refreshPage(databaseId);
  };

  return (
    <div className="mt-4 space-y-0.5 border-b border-line pb-4">
      {properties.map((p) => (
        <div key={p.id} className="flex items-center">
          <div className="w-40 shrink-0 truncate px-2 py-1.5 text-sm text-muted" title={PROPERTY_TYPE_LABELS[p.type]}>
            {p.name}
          </div>
          <div className="min-w-0 flex-1 rounded">
            <PropertyInput
              prop={p}
              value={values[p.id]}
              onChange={(v) => change(p.id, v)}
              databaseId={databaseId}
              properties={properties}
              readOnly={readOnly}
            />
          </div>
        </div>
      ))}
      <Link
        href={`/p/${databaseId}`}
        className="mt-2 inline-flex items-center gap-1 px-2 text-xs text-muted hover:underline"
      >
        <ArrowUpRight size={12} /> データベースに戻る
      </Link>
    </div>
  );
}
