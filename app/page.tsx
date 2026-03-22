import { Suspense } from "react";
import MindMapWrapper from "@/components/MindMapWrapper";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ pageId?: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-950 text-white">読み込み中...</div>}>
      <MindMapWrapper searchParams={searchParams} />
    </Suspense>
  );
}
