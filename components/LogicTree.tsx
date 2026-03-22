"use client";

import { useRef, useState, useCallback, useEffect, type ReactElement } from "react";
import { type Theme } from "@/lib/themes";
import { type MindElixirData, type NodeObj } from "mind-elixir";

interface Props {
  data: MindElixirData;
  theme: Theme;
  onDataChange: (data: MindElixirData) => void;
}

interface EditState { id: string; value: string; }

// NodeObjにsummaryLabelを拡張
interface ExtNodeObj extends NodeObj {
  summaryLabel?: string;
  children: ExtNodeObj[];
}

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function findNode(root: ExtNodeObj, id: string): ExtNodeObj | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) { const r = findNode(c, id); if (r) return r; }
  return null;
}

function findParent(root: ExtNodeObj, id: string): ExtNodeObj | null {
  for (const c of root.children ?? []) {
    if (c.id === id) return root;
    const r = findParent(c, id);
    if (r) return r;
  }
  return null;
}

function removeNode(root: ExtNodeObj, id: string): boolean {
  const idx = (root.children ?? []).findIndex(c => c.id === id);
  if (idx !== -1) { root.children.splice(idx, 1); return true; }
  return (root.children ?? []).some(c => removeNode(c, id));
}

// ツリー上の全ノードIDを順番に取得（上→下、左→右）
function getAllIds(node: ExtNodeObj): string[] {
  return [node.id, ...(node.children ?? []).flatMap(getAllIds)];
}

export default function LogicTree({ data, theme, onDataChange }: Props) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const root = data.nodeData as ExtNodeObj;

  useEffect(() => { if (editState && inputRef.current) inputRef.current.focus(); }, [editState]);

  const commit = useCallback((updated: MindElixirData) => onDataChange(updated), [onDataChange]);

  const updateTopic = useCallback((id: string, topic: string) => {
    const u = deepClone(data); const n = findNode(u.nodeData as ExtNodeObj, id); if (n) n.topic = topic; commit(u);
  }, [data, commit]);

  const addChild = useCallback((parentId: string) => {
    const newId = `node-${Date.now()}`;
    const u = deepClone(data); const p = findNode(u.nodeData as ExtNodeObj, parentId);
    if (p) { p.children = [...(p.children ?? []), { id: newId, topic: "新しいノード", children: [] }]; }
    commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
  }, [data, commit]);

  const addSibling = useCallback((siblingId: string) => {
    const newId = `node-${Date.now()}`;
    const u = deepClone(data); const parent = findParent(u.nodeData as ExtNodeObj, siblingId);
    if (!parent) return;
    const idx = parent.children.findIndex(c => c.id === siblingId);
    parent.children.splice(idx + 1, 0, { id: newId, topic: "新しいノード", children: [] });
    commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
  }, [data, commit]);

  const toggleSummary = useCallback((nodeId: string) => {
    const u = deepClone(data); const n = findNode(u.nodeData as ExtNodeObj, nodeId);
    if (!n) return;
    n.summaryLabel = n.summaryLabel ? undefined : "まとめ";
    commit(u);
  }, [data, commit]);

  const del = useCallback((id: string) => {
    const u = deepClone(data); removeNode(u.nodeData as ExtNodeObj, id); commit(u); setSelectedId(null);
  }, [data, commit]);

  // キーボードナビゲーション
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId || editState) return;
      const allIds = getAllIds(root);
      const cur = findNode(root, selectedId);
      const parent = findParent(root, selectedId);

      if (e.key === "Tab") {
        e.preventDefault(); addChild(selectedId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedId === root.id) addChild(selectedId);
        else addSibling(selectedId);
      } else if (e.key === "F2" || e.key === " ") {
        e.preventDefault(); setEditState({ id: selectedId, value: cur?.topic ?? "" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId !== root.id) { e.preventDefault(); del(selectedId); }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cur?.children?.length) { setSelectedId(cur.children[0].id); return; }
        const idx = allIds.indexOf(selectedId);
        if (idx < allIds.length - 1) setSelectedId(allIds[idx + 1]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = allIds.indexOf(selectedId);
        if (idx > 0) setSelectedId(allIds[idx - 1]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); if (parent) setSelectedId(parent.id);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (parent) {
          const siblings = parent.children;
          const idx = siblings.findIndex(c => c.id === selectedId);
          if (idx > 0) setSelectedId(siblings[idx - 1].id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editState, root, addChild, addSibling, del]);

  const renderNode = (node: ExtNodeObj, depth = 0): ReactElement => {
    const isRoot = depth === 0;
    const isEditing = editState?.id === node.id;
    const isSelected = selectedId === node.id;
    const children = (node.children ?? []) as ExtNodeObj[];
    const hasSummary = !!node.summaryLabel;

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* 上の接続線 */}
        {!isRoot && <div style={{ width: 2, height: 20, background: theme.line }} />}

        {/* ノード */}
        <div
          tabIndex={0}
          onClick={e => { e.stopPropagation(); setSelectedId(node.id); }}
          onDoubleClick={() => setEditState({ id: node.id, value: node.topic })}
          style={{
            padding: isRoot ? "10px 20px" : "6px 14px",
            borderRadius: isRoot ? 10 : 6,
            background: isRoot ? theme.rootBg : theme.nodeBg,
            color: isRoot ? theme.rootText : theme.nodeText,
            border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? theme.rootBg : theme.border}`,
            cursor: "pointer", fontSize: isRoot ? 15 : 13,
            fontWeight: isRoot ? 700 : 400, whiteSpace: "nowrap",
            boxShadow: isSelected ? `0 0 0 3px ${theme.rootBg}44` : isRoot ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
            userSelect: "none", outline: "none", transition: "all 0.15s",
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef} autoFocus value={editState!.value}
              onChange={e => setEditState({ ...editState!, value: e.target.value })}
              onBlur={() => { updateTopic(node.id, editState!.value); setEditState(null); }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Enter") { updateTopic(node.id, editState!.value); setEditState(null); }
                if (e.key === "Escape") setEditState(null);
                if (e.key === "Tab") { e.preventDefault(); updateTopic(node.id, editState!.value); setEditState(null); addChild(node.id); }
              }}
              style={{ background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: "inherit", fontWeight: "inherit", minWidth: 60, width: Math.max((editState?.value.length ?? 1) * 9, 60) }}
            />
          ) : node.topic}
        </div>

        {/* ボタン（選択時のみ） */}
        {isSelected && !isEditing && (
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <Btn theme={theme} onClick={() => addChild(node.id)} title="Tab">+子</Btn>
            {!isRoot && <Btn theme={theme} onClick={() => addSibling(node.id)} title="Enter">+兄弟</Btn>}
            <Btn theme={theme} onClick={() => toggleSummary(node.id)}>{hasSummary ? "まとめ削除" : "まとめ"}</Btn>
            {!isRoot && <Btn theme={theme} onClick={() => del(node.id)} danger>✕</Btn>}
          </div>
        )}

        {/* 子ノード群 */}
        {children.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 2, height: 16, background: theme.line }} />
            {/* 横線（子が複数） */}
            {children.length > 1 && (
              <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ height: 2, background: theme.line, width: "calc(100% - 48px)" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
              {children.map(child => renderNode(child, depth + 1))}
            </div>

            {/* サマリー括弧 */}
            {hasSummary && (
              <SummaryBracket label={node.summaryLabel!} theme={theme} />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px", background: theme.bg }}
      onClick={() => setSelectedId(null)}
    >
      <div style={{ display: "inline-flex" }}>
        {renderNode(root)}
      </div>
      <div style={{ position: "fixed", bottom: 12, right: 12, color: theme.textMuted, fontSize: 10 }}>
        Tab:子追加 Enter:兄弟追加 ↑↓←→:移動 F2:編集 Del:削除
      </div>
    </div>
  );
}

// サマリー括弧コンポーネント
function SummaryBracket({ label, theme }: { label: string; theme: Theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: 0 }}>
      {/* SVG括弧 */}
      <svg width="100%" height="28" style={{ overflow: "visible", display: "block" }}>
        <path
          d="M 8,2 Q 8,24 50%,24 Q calc(100% - 8px),24 calc(100% - 8px),2"
          fill="none" stroke={theme.line} strokeWidth={2}
          style={{ vectorEffect: "non-scaling-stroke" }}
        />
      </svg>
      {/* まとめノード */}
      <div style={{
        marginTop: 4, padding: "5px 16px",
        borderRadius: 20,
        background: theme.nodeBg,
        color: theme.nodeText,
        border: `1.5px solid ${theme.line}`,
        fontSize: 12, fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: `0 2px 8px ${theme.line}44`,
      }}>
        {label}
      </div>
    </div>
  );
}

function Btn({ children, theme, onClick, title, danger }: { children: React.ReactNode; theme: Theme; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title={title} style={{
      padding: "2px 8px", borderRadius: 4, border: `1px solid ${danger ? "#ef4444" : theme.border}`,
      background: theme.surface, color: danger ? "#ef4444" : theme.text,
      cursor: "pointer", fontSize: 10, transition: "all 0.15s",
    }}>{children}</button>
  );
}
