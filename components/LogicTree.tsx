"use client";

import { useRef, useState, useCallback, useEffect, type ReactElement } from "react";
import { type Theme } from "@/lib/themes";
import { type MindElixirData, type NodeObj } from "mind-elixir";

interface SummaryRange { id: string; label: string; startIdx: number; endIdx: number; }

interface ExtNodeObj extends NodeObj {
  summaries?: SummaryRange[];
  children: ExtNodeObj[];
}

interface Props {
  data: MindElixirData;
  theme: Theme;
  onDataChange: (data: MindElixirData) => void;
}

interface EditState { id: string; value: string; }
interface Selection { parentId: string; indices: number[]; } // 選択中の兄弟インデックス群

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function findNode(root: ExtNodeObj, id: string): ExtNodeObj | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) { const r = findNode(c, id); if (r) return r; }
  return null;
}
function findParent(root: ExtNodeObj, id: string): ExtNodeObj | null {
  for (const c of root.children ?? []) {
    if (c.id === id) return root;
    const r = findParent(c, id); if (r) return r;
  }
  return null;
}
function removeNode(root: ExtNodeObj, id: string): boolean {
  const idx = (root.children ?? []).findIndex(c => c.id === id);
  if (idx !== -1) { root.children.splice(idx, 1); return true; }
  return (root.children ?? []).some(c => removeNode(c, id));
}
function getAllIds(node: ExtNodeObj): string[] {
  return [node.id, ...(node.children ?? []).flatMap(getAllIds)];
}

export default function LogicTree({ data, theme, onDataChange }: Props) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rangeSelection, setRangeSelection] = useState<Selection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const root = data.nodeData as ExtNodeObj;

  useEffect(() => { if (editState && inputRef.current) inputRef.current.focus(); }, [editState]);

  const commit = useCallback((u: MindElixirData) => onDataChange(u), [onDataChange]);

  const updateTopic = useCallback((id: string, topic: string) => {
    const u = clone(data); const n = findNode(u.nodeData as ExtNodeObj, id); if (n) n.topic = topic; commit(u);
  }, [data, commit]);

  const addChild = useCallback((parentId: string) => {
    const newId = `node-${Date.now()}`;
    const u = clone(data); const p = findNode(u.nodeData as ExtNodeObj, parentId);
    if (p) p.children = [...(p.children ?? []), { id: newId, topic: "新しいノード", children: [] }];
    commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
  }, [data, commit]);

  const addSibling = useCallback((siblingId: string) => {
    const newId = `node-${Date.now()}`;
    const u = clone(data); const parent = findParent(u.nodeData as ExtNodeObj, siblingId);
    if (!parent) return;
    const idx = parent.children.findIndex(c => c.id === siblingId);
    parent.children.splice(idx + 1, 0, { id: newId, topic: "新しいノード", children: [] });
    commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
  }, [data, commit]);

  const del = useCallback((id: string) => {
    const u = clone(data); removeNode(u.nodeData as ExtNodeObj, id); commit(u);
    setSelectedId(null); setRangeSelection(null);
  }, [data, commit]);

  // サマリー作成（範囲選択から）
  const createSummary = useCallback(() => {
    if (!rangeSelection || rangeSelection.indices.length < 1) return;
    const u = clone(data);
    const parent = findNode(u.nodeData as ExtNodeObj, rangeSelection.parentId);
    if (!parent) return;
    const sorted = [...rangeSelection.indices].sort((a, b) => a - b);
    const summaryId = `summary-${Date.now()}`;
    parent.summaries = [...(parent.summaries ?? []), {
      id: summaryId, label: "まとめ",
      startIdx: sorted[0], endIdx: sorted[sorted.length - 1],
    }];
    commit(u); setRangeSelection(null);
    setTimeout(() => setEditState({ id: `edit-summary-${summaryId}`, value: "まとめ" }), 50);
  }, [rangeSelection, data, commit]);

  const deleteSummary = useCallback((parentId: string, summaryId: string) => {
    const u = clone(data); const parent = findNode(u.nodeData as ExtNodeObj, parentId);
    if (parent?.summaries) parent.summaries = parent.summaries.filter(s => s.id !== summaryId);
    commit(u);
  }, [data, commit]);

  const updateSummaryLabel = useCallback((parentId: string, summaryId: string, label: string) => {
    const u = clone(data); const parent = findNode(u.nodeData as ExtNodeObj, parentId);
    const s = parent?.summaries?.find(s => s.id === summaryId); if (s) s.label = label;
    commit(u);
  }, [data, commit]);

  // ノードクリック（shift=範囲選択）
  const handleNodeClick = useCallback((nodeId: string, parentId: string | null, childIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && parentId) {
      if (rangeSelection && rangeSelection.parentId === parentId) {
        // 同じ親なら範囲を拡張
        setRangeSelection(prev => prev ? { ...prev, indices: [...new Set([...prev.indices, childIdx])] } : { parentId, indices: [childIdx] });
      } else {
        setRangeSelection({ parentId, indices: [childIdx] });
      }
      setSelectedId(nodeId);
    } else {
      setSelectedId(nodeId);
      setRangeSelection(null);
    }
  }, [rangeSelection]);

  // キーボードナビゲーション
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId || editState) return;
      const cur = findNode(root, selectedId);
      const parent = findParent(root, selectedId);
      const siblings = parent?.children ?? [];
      const sibIdx = siblings.findIndex(c => c.id === selectedId);

      if (e.key === "Tab") {
        e.preventDefault(); addChild(selectedId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedId === root.id) addChild(selectedId); else addSibling(selectedId);
      } else if (e.key === "F2") {
        e.preventDefault(); setEditState({ id: selectedId, value: cur?.topic ?? "" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId !== root.id) { e.preventDefault(); del(selectedId); }
      } else if (e.key === "ArrowDown") {
        // 子へ
        e.preventDefault();
        if (cur?.children?.length) setSelectedId(cur.children[0].id);
      } else if (e.key === "ArrowUp") {
        // 親へ
        e.preventDefault();
        if (parent) setSelectedId(parent.id);
      } else if (e.key === "ArrowLeft") {
        // 前の兄弟へ
        e.preventDefault();
        if (parent && sibIdx > 0) setSelectedId(siblings[sibIdx - 1].id);
      } else if (e.key === "ArrowRight") {
        // 次の兄弟へ
        e.preventDefault();
        if (parent && sibIdx < siblings.length - 1) setSelectedId(siblings[sibIdx + 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editState, root, addChild, addSibling, del]);

  const renderNode = (node: ExtNodeObj, depth = 0, parentId: string | null = null, childIdx = 0): ReactElement => {
    const isRoot = depth === 0;
    const isEditing = editState?.id === node.id;
    const isSelected = selectedId === node.id;
    const inRange = rangeSelection?.parentId === parentId && rangeSelection.indices.includes(childIdx);
    const children = (node.children ?? []) as ExtNodeObj[];

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* 上の接続線 */}
        {!isRoot && <div style={{ width: 2, height: 20, background: theme.line }} />}

        {/* ノード本体 */}
        <div
          tabIndex={0}
          onClick={e => handleNodeClick(node.id, parentId, childIdx, e)}
          onDoubleClick={() => setEditState({ id: node.id, value: node.topic })}
          style={{
            padding: isRoot ? "10px 20px" : "6px 14px",
            borderRadius: isRoot ? 10 : 6,
            background: isRoot ? theme.rootBg : theme.nodeBg,
            color: isRoot ? theme.rootText : theme.nodeText,
            border: `${isSelected || inRange ? 2 : 1.5}px solid ${inRange ? theme.line : isSelected ? theme.rootBg : theme.border}`,
            cursor: "pointer", fontSize: isRoot ? 15 : 13,
            fontWeight: isRoot ? 700 : 400, whiteSpace: "nowrap",
            boxShadow: isSelected ? `0 0 0 3px ${theme.rootBg}44` : inRange ? `0 0 0 2px ${theme.line}44` : isRoot ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
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

        {/* ボタン（選択時） */}
        {isSelected && !isEditing && (
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <Btn theme={theme} onClick={() => addChild(node.id)}>+子 (Tab)</Btn>
            {!isRoot && <Btn theme={theme} onClick={() => addSibling(node.id)}>+兄弟 (↵)</Btn>}
            {rangeSelection && rangeSelection.parentId === parentId && rangeSelection.indices.length > 0 && (
              <Btn theme={theme} onClick={createSummary} highlight>まとめ作成</Btn>
            )}
            {!isRoot && <Btn theme={theme} onClick={() => del(node.id)} danger>✕</Btn>}
          </div>
        )}

        {/* 子ノード群 + サマリー */}
        {children.length > 0 && (
          <ChildrenWithSummaries
            parent={node} children={children} depth={depth}
            theme={theme} editState={editState} setEditState={setEditState}
            renderNode={renderNode} updateSummaryLabel={updateSummaryLabel}
            deleteSummary={deleteSummary}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px", background: theme.bg }}
      onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setRangeSelection(null); } }}
    >
      <div style={{ display: "inline-flex" }}>
        {renderNode(root)}
      </div>
      {/* ヘルプ */}
      <div style={{ position: "fixed", bottom: 10, right: 12, color: theme.textMuted, fontSize: 10, lineHeight: 1.8 }}>
        Tab:子 Enter:兄弟 ↑:親 ↓:子 ←→:兄弟移動 F2:編集 Del:削除<br />
        Shift+クリック:範囲選択 → まとめ作成
      </div>
    </div>
  );
}

// 子ノードとサマリーブラケットをまとめてレンダリング
function ChildrenWithSummaries({ parent, children, depth, theme, editState, setEditState, renderNode, updateSummaryLabel, deleteSummary }: {
  parent: ExtNodeObj; children: ExtNodeObj[]; depth: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  renderNode: (node: ExtNodeObj, depth: number, parentId: string | null, childIdx: number) => ReactElement;
  updateSummaryLabel: (parentId: string, summaryId: string, label: string) => void;
  deleteSummary: (parentId: string, summaryId: string) => void;
}) {
  const summaries = parent.summaries ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 2, height: 16, background: theme.line }} />
      {children.length > 1 && (
        <div style={{ height: 2, background: theme.line, width: "calc(100% - 48px)", alignSelf: "center" }} />
      )}
      {/* 子ノード行 */}
      <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start", position: "relative" }}>
        {children.map((child, idx) => (
          <div key={child.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {renderNode(child, depth + 1, parent.id, idx)}
          </div>
        ))}
      </div>

      {/* サマリーブラケット群 */}
      {summaries.map(summary => (
        <SummaryBracket
          key={summary.id}
          summary={summary}
          childCount={children.length}
          theme={theme}
          editState={editState}
          setEditState={setEditState}
          onUpdateLabel={label => updateSummaryLabel(parent.id, summary.id, label)}
          onDelete={() => deleteSummary(parent.id, summary.id)}
        />
      ))}
    </div>
  );
}

// サマリーブラケットコンポーネント
function SummaryBracket({ summary, childCount, theme, editState, setEditState, onUpdateLabel, onDelete }: {
  summary: SummaryRange; childCount: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  onUpdateLabel: (label: string) => void; onDelete: () => void;
}) {
  const { startIdx, endIdx } = summary;
  const totalSpan = endIdx - startIdx + 1;
  const leftOffset = (startIdx / childCount) * 100;
  const rightOffset = ((childCount - 1 - endIdx) / childCount) * 100;
  const isEditingLabel = editState?.id === `edit-summary-${summary.id}`;

  return (
    <div style={{ width: "100%", position: "relative", marginTop: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* SVG括弧 */}
      <svg
        width="100%" height="32"
        style={{ overflow: "visible", display: "block" }}
        viewBox="0 0 100 32" preserveAspectRatio="none"
      >
        <path
          d={`M ${leftOffset + 2},2 Q ${leftOffset},28 50,28 Q ${100 - rightOffset},28 ${100 - rightOffset - 2},2`}
          fill="none" stroke={theme.line} strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* まとめラベル */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 4 }}
        onDoubleClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}
      >
        {isEditingLabel ? (
          <input
            autoFocus value={editState!.value}
            onChange={e => setEditState({ ...editState!, value: e.target.value })}
            onBlur={() => { onUpdateLabel(editState!.value); setEditState(null); }}
            onKeyDown={e => {
              if (e.key === "Enter") { onUpdateLabel(editState!.value); setEditState(null); }
              if (e.key === "Escape") setEditState(null);
            }}
            style={{
              padding: "4px 12px", borderRadius: 20, border: `1.5px solid ${theme.line}`,
              background: theme.nodeBg, color: theme.nodeText,
              fontSize: 12, fontWeight: 600, outline: "none", minWidth: 60,
            }}
          />
        ) : (
          <div style={{
            padding: "4px 14px", borderRadius: 20,
            background: theme.nodeBg, color: theme.nodeText,
            border: `1.5px solid ${theme.line}`, fontSize: 12, fontWeight: 600,
            cursor: "pointer", userSelect: "none",
            boxShadow: `0 2px 8px ${theme.line}33`,
          }}>
            {summary.label}
          </div>
        )}
        <button
          onClick={onDelete}
          style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 11, padding: "0 2px" }}
          title="サマリーを削除"
        >✕</button>
      </div>
    </div>
  );
}

function Btn({ children, theme, onClick, danger, highlight }: { children: React.ReactNode; theme: Theme; onClick: () => void; danger?: boolean; highlight?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        padding: "2px 8px", borderRadius: 4,
        border: `1px solid ${danger ? "#ef4444" : highlight ? theme.rootBg : theme.border}`,
        background: highlight ? theme.rootBg + "22" : theme.surface,
        color: danger ? "#ef4444" : highlight ? theme.rootBg : theme.text,
        cursor: "pointer", fontSize: 10, transition: "all 0.15s",
      }}
    >{children}</button>
  );
}
