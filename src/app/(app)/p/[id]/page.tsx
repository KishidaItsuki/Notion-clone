"use client";
import { use } from "react";
import { PageView } from "@/components/PageView";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PageView key={id} id={id} />;
}
