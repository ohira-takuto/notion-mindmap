"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import MindElixir, { type MindElixirData, type MindElixirInstance } from "mind-elixir";
import "mind-elixir/style.css";

interface Props {
  pageId: string;
}

const DEFAULT_DATA: MindElixirData = {
  nodeData: {
    id: "root",
    topic: "メインテーマ",
    children: [
      { id: "1", topic: "トピック1", children: [] },
      { id: "2", topic: "トピック2", children: [] },
      { id: "3", topic: "トピック3", children: [] },
    ],
  },
};

export default function MindMap({ pageId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<MindElixirInstance | null>(null);
  const blockIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const saveData = useCallback(async (data: MindElixirData) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, data, blockId: blockIdRef.current }),
      });
      const json = await res.json();
      if (json.blockId) blockIdRef.current = json.blockId;
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 2000);
    } catch {
      setStatus("error");
      setErrorMsg("保存に失敗しました");
    }
  }, [pageId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      // データ取得
      let initialData = DEFAULT_DATA;
      try {
        const res = await fetch(`/api/mindmap?pageId=${pageId}`);
        const json = await res.json();
        if (json.data) {
          initialData = json.data;
          blockIdRef.current = json.blockId;
        }
      } catch {
        setErrorMsg("データの読み込みに失敗しました");
      }

      // mind-elixir 初期化
      const me = new MindElixir({
        el: containerRef.current!,
        direction: MindElixir.SIDE,
        draggable: true,
        editable: true,
        contextMenu: true,
        toolBar: true,
        keypress: true,
        mouseSelectionButton: 0,
      });

      me.init(initialData);
      meRef.current = me;
      setStatus("ready");

      // 変更時に自動保存（デバウンス 1.5秒）
      me.bus.addListener("operation", () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const data = me.getData();
          saveData(data);
        }, 1500);
      });
    };

    init();

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [pageId, saveData]);

  const statusLabel = {
    loading: "読み込み中...",
    ready: "編集可能",
    saving: "保存中...",
    saved: "保存済み ✓",
    error: `エラー: ${errorMsg}`,
  }[status];

  const statusColor = {
    loading: "text-gray-400",
    ready: "text-green-400",
    saving: "text-yellow-400",
    saved: "text-green-400",
    error: "text-red-400",
  }[status];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: "#030712" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#111827", borderBottom: "1px solid #374151", flexShrink: 0 }}>
        <span style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Notion MindMap</span>
        <span style={{ color: statusColor === "text-green-400" ? "#4ade80" : statusColor === "text-yellow-400" ? "#facc15" : statusColor === "text-red-400" ? "#f87171" : "#9ca3af", fontSize: "12px" }}>{statusLabel}</span>
      </div>

      {/* マインドマップ本体 */}
      <div ref={containerRef} style={{ flex: 1, width: "100%", minHeight: 0 }} />
    </div>
  );
}
