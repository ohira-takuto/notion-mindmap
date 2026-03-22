"use client";

import { useRef, useState, useCallback, type ReactElement } from "react";
import { type Theme } from "@/lib/themes";
import { type MindElixirData, type NodeObj } from "mind-elixir";

interface Props {
  data: MindElixirData;
  theme: Theme;
  onDataChange: (data: MindElixirData) => void;
}

interface EditState { id: string; value: string; }

// ノードIDに "__summary" サフィックスがついていたらサマリーノード
const isSummary = (id: string) => id.endsWith("__summary");

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function findAndUpdate(node: NodeObj, id: string, updater: (n: NodeObj) => void): boolean {
  if (node.id === id) { updater(node); return true; }
  return (node.children ?? []).some(c => findAndUpdate(c, id, updater));
}

function removeNode(node: NodeObj, id: string): boolean {
  if (!node.children) return false;
  const idx = node.children.findIndex(c => c.id === id);
  if (idx !== -1) { node.children.splice(idx, 1); return true; }
  return node.children.some(c => removeNode(c, id));
}

export default function LogicTree({ data, theme, onDataChange }: Props) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((updated: MindElixirData) => {
    onDataChange(updated);
  }, [onDataChange]);

  const updateTopic = useCallback((id: string, topic: string) => {
    const updated = deepClone(data);
    findAndUpdate(updated.nodeData, id, n => { n.topic = topic; });
    commit(updated);
  }, [data, commit]);

  const addChild = useCallback((parentId: string) => {
    const newId = `node-${Date.now()}`;
    const updated = deepClone(data);
    findAndUpdate(updated.nodeData, parentId, n => {
      n.children = [...(n.children ?? []), { id: newId, topic: "新しいノード", children: [] }];
    });
    commit(updated);
    setTimeout(() => setEditState({ id: newId, value: "新しいノード" }), 50);
  }, [data, commit]);

  const addSummary = useCallback((parentId: string) => {
    // 選択したノードの親の子リストにサマリーノードを追加
    const summaryId = `${parentId}__summary`;
    const updated = deepClone(data);
    // 親を見つけてサマリーを末尾に追加
    const addToParent = (node: NodeObj): boolean => {
      const children = node.children ?? [];
      const idx = children.findIndex(c => c.id === parentId);
      if (idx !== -1) {
        if (!children.find(c => c.id === summaryId)) {
          node.children = [...children, { id: summaryId, topic: "まとめ", children: [] }];
        }
        return true;
      }
      return children.some(c => addToParent(c));
    };
    if (!addToParent(updated.nodeData)) {
      // rootが選択されている場合、rootの子にサマリーを追加
      const root = updated.nodeData;
      if (!root.children?.find(c => c.id === summaryId)) {
        root.children = [...(root.children ?? []), { id: summaryId, topic: "まとめ", children: [] }];
      }
    }
    commit(updated);
    setTimeout(() => setEditState({ id: summaryId, value: "まとめ" }), 50);
  }, [data, commit]);

  const renderNode = (node: NodeObj, depth: number = 0, siblingCount: number = 1): ReactElement => {
    const isRoot = depth === 0;
    const isEditing = editState?.id === node.id;
    const isSelected = selectedId === node.id;
    const isSummaryNode = isSummary(node.id);
    const children = node.children ?? [];

    const nodeBg = isSummaryNode ? theme.line + "33" : isRoot ? theme.rootBg : theme.nodeBg;
    const nodeText = isRoot ? theme.rootText : theme.nodeText;
    const nodeBorder = isSummaryNode ? theme.line : isSelected ? theme.rootBg : theme.border;

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* 上の接続線 */}
        {!isRoot && <div style={{ width: 2, height: 20, background: theme.line }} />}

        {/* ノード本体 */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {isSummaryNode && (
            /* 括弧サマリーの装飾 */
            <div style={{
              position: "absolute", left: -18, top: "50%", transform: "translateY(-50%)",
              fontSize: 22, color: theme.line, fontWeight: 300, lineHeight: 1,
            }}>{"{{"}</div>
          )}

          <div
            onClick={() => setSelectedId(node.id)}
            onDoubleClick={() => setEditState({ id: node.id, value: node.topic })}
            onContextMenu={e => { e.preventDefault(); if (!isRoot) removeNode(deepClone(data).nodeData, node.id) && commit((() => { const u = deepClone(data); removeNode(u.nodeData, node.id); return u; })()); }}
            style={{
              padding: isRoot ? "10px 20px" : "6px 14px",
              borderRadius: isSummaryNode ? 20 : isRoot ? 10 : 6,
              background: nodeBg,
              color: nodeText,
              border: `${isSelected ? 2 : 1.5}px solid ${nodeBorder}`,
              cursor: "pointer",
              fontSize: isRoot ? 15 : 13,
              fontWeight: isRoot ? 700 : isSummaryNode ? 600 : 400,
              whiteSpace: "nowrap",
              boxShadow: isSelected ? `0 0 0 2px ${theme.rootBg}44` : isRoot ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
              userSelect: "none",
              fontStyle: isSummaryNode ? "italic" : "normal",
              transition: "all 0.15s",
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                autoFocus
                value={editState!.value}
                onChange={e => setEditState({ ...editState!, value: e.target.value })}
                onBlur={() => { updateTopic(node.id, editState!.value); setEditState(null); }}
                onKeyDown={e => {
                  if (e.key === "Enter") { updateTopic(node.id, editState!.value); setEditState(null); }
                  if (e.key === "Escape") setEditState(null);
                  if (e.key === "Tab") { e.preventDefault(); updateTopic(node.id, editState!.value); setEditState(null); addChild(node.id); }
                }}
                style={{ background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: "inherit", fontWeight: "inherit", minWidth: 60, width: Math.max(editState!.value.length * 9, 60) }}
              />
            ) : node.topic}
          </div>

          {/* アクションボタン */}
          {isSelected && (
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <button onClick={() => addChild(node.id)} title="子ノードを追加" style={{ ...btnStyle(theme), fontSize: 10 }}>+子</button>
              {!isSummaryNode && <button onClick={() => addSummary(node.id)} title="サマリーを追加" style={{ ...btnStyle(theme), fontSize: 10 }}>{}まとめ</button>}
              {!isRoot && (
                <button onClick={() => { const u = deepClone(data); removeNode(u.nodeData, node.id); commit(u); setSelectedId(null); }} title="削除" style={{ ...btnStyle(theme), fontSize: 10, color: "#f87171" }}>✕</button>
              )}
            </div>
          )}
        </div>

        {/* 子ノード群 */}
        {children.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 2, height: 16, background: theme.line }} />
            {children.length > 1 && (
              <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
                <div style={{ height: 2, background: theme.line, width: `calc(100% - 48px)` }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
              {children.map(child => renderNode(child as NodeObj, depth + 1, children.length))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px", background: theme.bg }}
      onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
    >
      <div style={{ display: "inline-flex" }}>
        {renderNode(data.nodeData as NodeObj)}
      </div>
    </div>
  );
}

const btnStyle = (theme: Theme) => ({
  padding: "2px 7px",
  borderRadius: 4,
  border: `1px solid ${theme.border}`,
  background: theme.surface,
  color: theme.text,
  cursor: "pointer",
  fontSize: 11,
  transition: "all 0.15s",
});
