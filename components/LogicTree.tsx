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

// まとめ選択モードの状態
interface SummarySelectMode {
  parentId: string;
  indices: Set<number>;
}

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

export default function LogicTree({ data, theme, onDataChange }: Props) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<SummarySelectMode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const root = data.nodeData as ExtNodeObj;

  useEffect(() => { if (editState && inputRef.current) inputRef.current.focus(); }, [editState]);

  const commit = useCallback((u: MindElixirData) => onDataChange(u), [onDataChange]);

  const updateTopic = useCallback((id: string, topic: string) => {
    const u = clone(data); const n = findNode(u.nodeData as ExtNodeObj, id);
    if (n) n.topic = topic; commit(u);
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
    setSelectedId(null); setSummaryMode(null);
  }, [data, commit]);

  // まとめ選択モードを開始（選択中ノードの親を対象に）
  const startSummaryMode = useCallback(() => {
    if (!selectedId) return;
    const parent = findParent(root, selectedId);
    if (!parent) return;
    const idx = parent.children.findIndex(c => c.id === selectedId);
    setSummaryMode({ parentId: parent.id, indices: new Set([idx]) });
  }, [selectedId, root]);

  // まとめ選択モードでノードをトグル
  const toggleSummaryNode = useCallback((parentId: string, idx: number) => {
    if (!summaryMode || summaryMode.parentId !== parentId) return;
    const next = new Set(summaryMode.indices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSummaryMode({ ...summaryMode, indices: next });
  }, [summaryMode]);

  // まとめ確定
  const createSummary = useCallback(() => {
    if (!summaryMode || summaryMode.indices.size === 0) return;
    const sorted = [...summaryMode.indices].sort((a, b) => a - b);
    const u = clone(data);
    const parent = findNode(u.nodeData as ExtNodeObj, summaryMode.parentId);
    if (!parent) return;
    const summaryId = `summary-${Date.now()}`;
    parent.summaries = [...(parent.summaries ?? []), {
      id: summaryId, label: "まとめ",
      startIdx: sorted[0], endIdx: sorted[sorted.length - 1],
    }];
    commit(u); setSummaryMode(null);
    setTimeout(() => setEditState({ id: `edit-summary-${summaryId}`, value: "まとめ" }), 50);
  }, [summaryMode, data, commit]);

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

  // キーボード
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSummaryMode(null); return; }
      if (!selectedId || editState) return;
      const cur = findNode(root, selectedId);
      const parent = findParent(root, selectedId);
      const siblings = parent?.children ?? [];
      const sibIdx = siblings.findIndex(c => c.id === selectedId);

      if (e.key === "Tab") { e.preventDefault(); addChild(selectedId); }
      else if (e.key === "Enter") { e.preventDefault(); if (selectedId === root.id) addChild(selectedId); else addSibling(selectedId); }
      else if (e.key === "F2") { e.preventDefault(); setEditState({ id: selectedId, value: cur?.topic ?? "" }); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== root.id) { e.preventDefault(); del(selectedId); }
      else if (e.key === "ArrowDown") { e.preventDefault(); if (cur?.children?.length) setSelectedId(cur.children[0].id); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (parent) setSelectedId(parent.id); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (parent && sibIdx > 0) setSelectedId(siblings[sibIdx - 1].id); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (parent && sibIdx < siblings.length - 1) setSelectedId(siblings[sibIdx + 1].id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editState, root, addChild, addSibling, del]);

  const renderNode = (node: ExtNodeObj, depth = 0, parentId: string | null = null, childIdx = 0): ReactElement => {
    const isRoot = depth === 0;
    const isEditing = editState?.id === node.id;
    const isSelected = selectedId === node.id;
    const isInSummaryMode = summaryMode?.parentId === parentId;
    const isInSummarySelection = isInSummaryMode && summaryMode!.indices.has(childIdx);

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {!isRoot && <div style={{ width: 2, height: 20, background: theme.line }} />}

        <div
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            if (isInSummaryMode && !isRoot) {
              toggleSummaryNode(parentId!, childIdx);
            } else {
              setSelectedId(node.id);
            }
          }}
          onDoubleClick={() => !summaryMode && setEditState({ id: node.id, value: node.topic })}
          style={{
            padding: isRoot ? "10px 20px" : "6px 14px",
            borderRadius: isRoot ? 10 : 6,
            background: isInSummarySelection
              ? theme.rootBg + "33"
              : isRoot ? theme.rootBg : theme.nodeBg,
            color: isRoot ? theme.rootText : theme.nodeText,
            border: `${isSelected || isInSummarySelection ? 2 : 1.5}px solid ${
              isInSummarySelection ? theme.rootBg
              : isSelected ? theme.rootBg
              : theme.border
            }`,
            cursor: isInSummaryMode && !isRoot ? "crosshair" : "pointer",
            fontSize: isRoot ? 15 : 13,
            fontWeight: isRoot ? 700 : 400,
            whiteSpace: "nowrap",
            boxShadow: isInSummarySelection
              ? `0 0 0 3px ${theme.rootBg}44`
              : isSelected ? `0 0 0 3px ${theme.rootBg}44`
              : isRoot ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
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

        {/* ボタン（選択時・サマリーモードでない時） */}
        {isSelected && !isEditing && !summaryMode && (
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <Btn theme={theme} onClick={() => addChild(node.id)}>+子</Btn>
            {!isRoot && <Btn theme={theme} onClick={() => addSibling(node.id)}>+兄弟</Btn>}
            {!isRoot && <Btn theme={theme} onClick={startSummaryMode} highlight>まとめ範囲を選択</Btn>}
            {!isRoot && <Btn theme={theme} onClick={() => del(node.id)} danger>✕</Btn>}
          </div>
        )}

        {/* 子ノード群 */}
        {(node.children ?? []).length > 0 && (
          <ChildrenWithSummaries
            parent={node} depth={depth} theme={theme}
            editState={editState} setEditState={setEditState}
            summaryMode={summaryMode}
            renderNode={renderNode}
            updateSummaryLabel={updateSummaryLabel}
            deleteSummary={deleteSummary}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", background: theme.bg }}
      onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); } }}
    >
      {/* まとめ選択モードのバナー */}
      {summaryMode && (
        <div style={{
          position: "sticky", top: 0, zIndex: 50, width: "100%",
          background: theme.rootBg, color: theme.rootText,
          padding: "8px 16px", display: "flex", alignItems: "center", gap: 12,
          justifyContent: "center", fontSize: 13,
        }}>
          <span>まとめたいノードをクリックして選択（{summaryMode.indices.size}個選択中）</span>
          <button
            onClick={createSummary}
            disabled={summaryMode.indices.size < 1}
            style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: "#fff", color: theme.rootBg, cursor: "pointer", fontWeight: 700, fontSize: 12 }}
          >まとめ確定</button>
          <button
            onClick={() => setSummaryMode(null)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12 }}
          >キャンセル (Esc)</button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ display: "inline-flex" }}>
          {renderNode(root)}
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 10, right: 12, color: theme.textMuted, fontSize: 10, lineHeight: 1.8 }}>
        Tab:子 Enter:兄弟 ↑:親 ↓:子 ←→:兄弟移動 F2:編集 Del:削除
      </div>
    </div>
  );
}

function ChildrenWithSummaries({ parent, depth, theme, editState, setEditState, summaryMode, renderNode, updateSummaryLabel, deleteSummary }: {
  parent: ExtNodeObj; depth: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  summaryMode: SummarySelectMode | null;
  renderNode: (node: ExtNodeObj, depth: number, parentId: string | null, childIdx: number) => ReactElement;
  updateSummaryLabel: (parentId: string, summaryId: string, label: string) => void;
  deleteSummary: (parentId: string, summaryId: string) => void;
}) {
  const children = (parent.children ?? []) as ExtNodeObj[];
  const summaries = parent.summaries ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 2, height: 16, background: theme.line }} />
      {children.length > 1 && (
        <div style={{ height: 2, background: theme.line, width: "calc(100% - 48px)", alignSelf: "center" }} />
      )}
      <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
        {children.map((child, idx) => (
          <div key={child.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {renderNode(child, depth + 1, parent.id, idx)}
          </div>
        ))}
      </div>
      {summaries.map(summary => (
        <SummaryBracket
          key={summary.id} summary={summary} childCount={children.length}
          theme={theme} editState={editState} setEditState={setEditState}
          onUpdateLabel={label => updateSummaryLabel(parent.id, summary.id, label)}
          onDelete={() => deleteSummary(parent.id, summary.id)}
        />
      ))}
    </div>
  );
}

function SummaryBracket({ summary, childCount, theme, editState, setEditState, onUpdateLabel, onDelete }: {
  summary: SummaryRange; childCount: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  onUpdateLabel: (label: string) => void; onDelete: () => void;
}) {
  const { startIdx, endIdx } = summary;
  const leftPct = (startIdx / Math.max(childCount - 1, 1)) * 100;
  const rightPct = (endIdx / Math.max(childCount - 1, 1)) * 100;
  const isEditingLabel = editState?.id === `edit-summary-${summary.id}`;

  return (
    <div style={{ width: "100%", marginTop: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="100%" height="32" style={{ overflow: "visible", display: "block" }} viewBox="0 0 100 32" preserveAspectRatio="none">
        <path
          d={`M ${leftPct + 1},2 Q ${leftPct},28 50,28 Q ${rightPct},28 ${rightPct - 1},2`}
          fill="none" stroke={theme.line} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} onDoubleClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}>
        {isEditingLabel ? (
          <input
            autoFocus value={editState!.value}
            onChange={e => setEditState({ ...editState!, value: e.target.value })}
            onBlur={() => { onUpdateLabel(editState!.value); setEditState(null); }}
            onKeyDown={e => {
              if (e.key === "Enter") { onUpdateLabel(editState!.value); setEditState(null); }
              if (e.key === "Escape") setEditState(null);
            }}
            style={{ padding: "4px 12px", borderRadius: 20, border: `1.5px solid ${theme.line}`, background: theme.nodeBg, color: theme.nodeText, fontSize: 12, fontWeight: 600, outline: "none", minWidth: 60 }}
          />
        ) : (
          <div style={{ padding: "4px 14px", borderRadius: 20, background: theme.nodeBg, color: theme.nodeText, border: `1.5px solid ${theme.line}`, fontSize: 12, fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
            {summary.label}
          </div>
        )}
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 11, padding: "0 2px" }}>✕</button>
      </div>
    </div>
  );
}

function Btn({ children, theme, onClick, danger, highlight }: { children: React.ReactNode; theme: Theme; onClick: () => void; danger?: boolean; highlight?: boolean }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
      padding: "2px 8px", borderRadius: 4,
      border: `1px solid ${danger ? "#ef4444" : highlight ? theme.rootBg : theme.border}`,
      background: highlight ? theme.rootBg + "22" : theme.surface,
      color: danger ? "#ef4444" : highlight ? theme.rootBg : theme.text,
      cursor: "pointer", fontSize: 10, transition: "all 0.15s",
    }}>{children}</button>
  );
}
