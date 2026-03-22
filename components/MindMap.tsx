"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import MindElixir, { type MindElixirData, type MindElixirInstance, type NodeObj } from "mind-elixir";
import "mind-elixir/style.css";
import dynamic from "next/dynamic";
import { THEMES, type ThemeKey } from "@/lib/themes";

const LogicTree = dynamic(() => import("./LogicTree"), { ssr: false });

interface Props {
  pageId: string;
}

type LayoutMode = "mindmap" | "logictree";
type SaveStatus = "loading" | "ready" | "saving" | "saved" | "error";

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

// mind-elixirにテーマCSSを注入
function injectThemeCSS(themeKey: ThemeKey) {
  const t = THEMES[themeKey];
  const styleId = "me-theme-override";
  let el = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = styleId; document.head.appendChild(el); }
  el.textContent = `
    me-mind-map { background: ${t.bg} !important; }
    me-root > me-tpc { background: ${t.rootBg} !important; color: ${t.rootText} !important; border-color: ${t.rootBg} !important; }
    me-tpc { background: ${t.nodeBg} !important; color: ${t.nodeText} !important; border-color: ${t.border} !important; }
    .line { stroke: ${t.line} !important; }
    me-mind-map { background-color: ${t.bg} !important; }
  `;
}

export default function MindMap({ pageId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<MindElixirInstance | null>(null);
  const blockIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<SaveStatus>("loading");
  const [data, setData] = useState<MindElixirData>(DEFAULT_DATA);
  const [themeKey, setThemeKey] = useState<ThemeKey>("dark");
  const [layout, setLayout] = useState<LayoutMode>("mindmap");
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const theme = THEMES[themeKey];

  // Notionに保存
  const saveData = useCallback(async (d: MindElixirData) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, data: d, blockId: blockIdRef.current }),
      });
      const json = await res.json();
      if (json.blockId) blockIdRef.current = json.blockId;
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 2000);
    } catch {
      setStatus("error");
      setErrorMsg("保存失敗");
    }
  }, [pageId]);

  const scheduleSave = useCallback((d: MindElixirData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveData(d), 1500);
  }, [saveData]);

  // 初期データ取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/mindmap?pageId=${pageId}`);
        const json = await res.json();
        if (json.data) { setData(json.data); blockIdRef.current = json.blockId; }
      } catch { /* use default */ }
      setStatus("ready");
    })();
  }, [pageId]);

  // mind-elixir初期化（mindmapモード）
  useEffect(() => {
    if (layout !== "mindmap" || !containerRef.current || status === "loading") return;

    const me = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      draggable: true,
      editable: true,
      contextMenu: true,
      toolBar: true,
      keypress: true,
      mouseSelectionButton: 0,
    });
    me.init(data);
    meRef.current = me;
    injectThemeCSS(themeKey);

    me.bus.addListener("operation", () => {
      const updated = me.getData();
      setData(updated);
      scheduleSave(updated);
    });

    return () => { meRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, status === "loading"]);

  // テーマ変更時にCSS再注入
  useEffect(() => {
    if (layout === "mindmap") injectThemeCSS(themeKey);
  }, [themeKey, layout]);

  // LogicTreeのデータ変更ハンドラ
  const handleLogicTreeChange = useCallback((updated: MindElixirData) => {
    setData(updated);
    scheduleSave(updated);
  }, [scheduleSave]);

  const statusLabel: Record<SaveStatus, string> = {
    loading: "読み込み中...", ready: "編集可能", saving: "保存中...",
    saved: "保存済み ✓", error: `エラー: ${errorMsg}`,
  };
  const statusColor: Record<SaveStatus, string> = {
    loading: "#9ca3af", ready: "#4ade80", saving: "#facc15", saved: "#4ade80", error: "#f87171",
  };

  const iconStyle = (active: boolean) => ({
    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
    background: active ? theme.rootBg : theme.surface,
    color: active ? theme.rootText : theme.text,
    border: `1px solid ${theme.border}`,
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: theme.bg }}>
      {/* ツールバー */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
        background: theme.headerBg, borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ color: theme.text, fontSize: 13, fontWeight: 600, marginRight: 4 }}>Notion MindMap</span>

        {/* レイアウト切替 */}
        <button style={iconStyle(layout === "mindmap")} onClick={() => setLayout("mindmap")}>
          🧠 マインドマップ
        </button>
        <button style={iconStyle(layout === "logictree")} onClick={() => setLayout("logictree")}>
          🌲 ロジックツリー
        </button>

        {/* テーマ */}
        <div style={{ position: "relative" }}>
          <button
            style={iconStyle(showThemePanel)}
            onClick={() => setShowThemePanel(v => !v)}
          >
            🎨 {theme.label}
          </button>
          {showThemePanel && (
            <div style={{
              position: "absolute", top: "110%", left: 0, zIndex: 100,
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)", minWidth: 140,
            }}>
              {(Object.keys(THEMES) as ThemeKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => { setThemeKey(key); setShowThemePanel(false); }}
                  style={{
                    padding: "6px 12px", borderRadius: 6, border: `1px solid ${key === themeKey ? THEMES[key].rootBg : "transparent"}`,
                    background: key === themeKey ? THEMES[key].rootBg + "22" : "transparent",
                    color: theme.text, cursor: "pointer", fontSize: 12, textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: THEMES[key].rootBg, display: "inline-block" }} />
                  {THEMES[key].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ステータス */}
        <span style={{ marginLeft: "auto", color: statusColor[status], fontSize: 11 }}>
          {statusLabel[status]}
        </span>
      </div>

      {/* マップ本体 */}
      {layout === "mindmap" ? (
        <div ref={containerRef} style={{ flex: 1, width: "100%", minHeight: 0 }} />
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          {status !== "loading" && (
            <LogicTree data={data} theme={theme} onDataChange={handleLogicTreeChange} />
          )}
        </div>
      )}
    </div>
  );
}
