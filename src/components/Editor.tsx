"use client";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { ja } from "@blocknote/core/locales";
import type { PartialBlock } from "@blocknote/core";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** 画像はデータURLとしてページ内に保存（大きな画像は外部ストレージ連携に置き換えてください） */
async function uploadFile(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    alert("3MB以下のファイルを選択してください");
    throw new Error("file too large");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Editor({
  initialContent,
  onChange,
  editable = true,
}: {
  initialContent: unknown[];
  onChange: (blocks: unknown[]) => void;
  editable?: boolean;
}) {
  const editor = useCreateBlockNote({
    initialContent: initialContent.length ? (initialContent as PartialBlock[]) : undefined,
    dictionary: {
      ...ja,
      placeholders: { ...ja.placeholders, default: "「/」でコマンドを入力…", emptyDocument: "「/」でコマンドを入力…" },
    },
    uploadFile,
  });

  return (
    <div className="nc-editor">
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={editable}
        onChange={() => onChange(editor.document as unknown[])}
      />
    </div>
  );
}
