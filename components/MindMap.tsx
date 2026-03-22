"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import MindElixir, { type MindElixirData, type MindElixirInstance } from "mind-elixir";
import "mind-elixir/style.css";
import dynamic from "next/dynamic";
import { THEMES, type ThemeKey } from "@/lib/themes";

const LogicTree = dynamic(() => import("./LogicTree"), { ssr: false });

interface Props { pageId: string; }
type LayoutMode = "mindmap" | "logictree";
type SaveStatus = "loading" | "ready" | "saving" | "saved" | "error";

const DEFAULT_DATA: MindElixirData = {
  nodeData: {
    id: "root", topic: "メインテーマ",
    children: [
      { id: "1", topic: "トピック1", children: [] },
      { id: "2", topic: "トピック2", children: [] },
      { id: "3", topic: "トピック3", children: [] },
    ],
  },
};

// mind-elixirのCSS変数をコンテナに適用
function applyMindElixirTheme(el: HTMLElement, themeKey: ThemeKey) {
  const t = THEMES[themeKey];
  el.style.background = t.bg;
  el.style.setProperty("--me-bg", t.bg);
  el.style.setProperty("--me-color", t.nodeText);
  el.style.setProperty("--me-border", t.border);
  el.style.setProperty("--me-line-color", t.line);

  // ノード色のCSS注入
  const styleId = "me-theme-override";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) { style = document.createElement("style"); style.id = styleId; document.head.appendChild(style); }
  style.textContent = `
    me-mind-map { background: ${t.bg} !important; background-color: ${t.bg} !important; }
    me-root > me-tpc { background: ${t.rootBg} !important; color: ${t.rootText} !important; border-color: ${t.rootBg} !important; }
    me-node > me-tpc, me-tpc { background: ${t.nodeBg} !important; color: ${t.nodeText} !important; border-color: ${t.border} !important; }
    .fne line, line.line { stroke: ${t.line} !important; }
    svg line { stroke: ${t.line} !important; }
  `;
}

export default function MindMap({ pageId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<MindElixirInstance | null>(null);
  const dataRef = useRef<MindElixirData>(DEFAULT_DATA); // mind-elixirが最新dataを保持するためのref
  const blockIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<SaveStatus>("loading");
  const [data, setData] = useState<MindElixirData>(DEFAULT_DATA);
  const [themeKey, setThemeKey] = useState<ThemeKey>("dark");
  const [layout, setLayout] = useState<LayoutMode>("mindmap");
  const [mindmapKey, setMindmapKey] = useState(0); // 強制再マウント用
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const theme = THEMES[themeKey];

  const saveData = useCallback(async (d: MindElixirData) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, data: d, blockId: blockIdRef.current }),
      });
      const json = await res.json();
      if (json.blockId) blockIdRef.current = json.blockId;
      setStatus("saved"); setTimeout(() => setStatus("ready"), 2000);
    } catch { setStatus("error"); setErrorMsg("保存失敗"); }
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
        if (json.data) { setData(json.data); dataRef.current = json.data; blockIdRef.current = json.blockId; }
      } catch { /* use default */ }
      setStatus("ready");
    })();
  }, [pageId]);

  // mind-elixir初期化（mindmapモード切替 or 強制再マウント時）
  useEffect(() => {
    if (layout !== "mindmap" || !containerRef.current || status === "loading") return;

    // コンテナをクリア（再マウント対応）
    containerRef.current.innerHTML = "";

    const me = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      draggable: true, editable: true,
      contextMenu: true, toolBar: true, keypress: true,
      mouseSelectionButton: 0,
    });
    me.init(dataRef.current); // 最新データで初期化
    meRef.current = me;
    applyMindElixirTheme(containerRef.current, themeKey);

    me.bus.addListener("operation", () => {
      const updated = me.getData();
      setData(updated); dataRef.current = updated;
      scheduleSave(updated);
    });

    return () => { meRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, mindmapKey, status === "loading"]);

  // テーマ変更時に再適用
  useEffect(() => {
    if (layout === "mindmap" && containerRef.current) {
      applyMindElixirTheme(containerRef.current, themeKey);
    }
  }, [themeKey, layout]);

  const handleLogicTreeChange = useCallback((updated: MindElixirData) => {
    setData(updated); dataRef.current = updated; scheduleSave(updated);
  }, [scheduleSave]);

  // レイアウト切替（mindmapに戻る時は強制再マウント）
  const switchLayout = useCallback((next: LayoutMode) => {
    if (next === "mindmap") setMindmapKey(k => k + 1);
    setLayout(next);
  }, []);

  const statusLabel: Record<SaveStatus, string> = {
    loading: "読み込み中...", ready: "編集可能", saving: "保存中...",
    saved: "保存済み ✓", error: `エラー: ${errorMsg}`,
  };
  const statusColor: Record<SaveStatus, string> = {
    loading: "#9ca3af", ready: "#4ade80", saving: "#facc15", saved: "#4ade80", error: "#f87171",
  };

  const btnStyle = (active: boolean) => ({
    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
    background: active ? theme.rootBg : theme.surface,
    color: active ? theme.rootText : theme.text,
    border: `1px solid ${theme.border}`, transition: "all 0.15s",
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

        <button style={btnStyle(layout === "mindmap")} onClick={() => switchLayout("mindmap")}>🧠 マインドマップ</button>
        <button style={btnStyle(layout === "logictree")} onClick={() => switchLayout("logictree")}>🌲 ロジックツリー</button>

        {/* テーマ選択 */}
        <div style={{ position: "relative" }}>
          <button style={btnStyle(showThemePanel)} onClick={() => setShowThemePanel(v => !v)}>
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
                <button key={key}
                  onClick={() => { setThemeKey(key); setShowThemePanel(false); }}
                  style={{
                    padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    border: `1px solid ${key === themeKey ? THEMES[key].rootBg : "transparent"}`,
                    background: key === themeKey ? THEMES[key].rootBg + "22" : "transparent",
                    color: theme.text,
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: THEMES[key].rootBg, display: "inline-block", flexShrink: 0 }} />
                  {THEMES[key].label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span style={{ marginLeft: "auto", color: statusColor[status], fontSize: 11 }}>{statusLabel[status]}</span>
      </div>

      {/* マップ本体 */}
      {layout === "mindmap" ? (
        <div
          key={mindmapKey}
          ref={containerRef}
          style={{ flex: 1, width: "100%", minHeight: 0, background: theme.bg }}
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {status !== "loading" && (
            <LogicTree data={data} theme={theme} onDataChange={handleLogicTreeChange} />
          )}
        </div>
      )}
    </div>
  );
}
