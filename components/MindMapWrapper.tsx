"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const MindMap = dynamic(() => import("./MindMap"), { ssr: false });

export default function MindMapWrapper({
  searchParams,
}: {
  searchParams: Promise<{ pageId?: string }>;
}) {
  const params = use(searchParams);
  const pageId = params.pageId;

  if (!pageId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white flex-col gap-4">
        <h1 className="text-2xl font-bold">Notion MindMap</h1>
        <p className="text-gray-400 text-sm">
          URLに <code className="bg-gray-800 px-2 py-1 rounded">?pageId=NOTION_PAGE_ID</code> を追加してください
        </p>
      </div>
    );
  }

  return <MindMap pageId={pageId} />;
}
