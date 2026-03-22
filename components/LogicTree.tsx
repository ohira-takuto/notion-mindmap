"use client";

import { useRef, useState, useCallback, useEffect, type ReactElement } from "react";
import { type Theme } from "@/lib/themes";
import { type MindElixirData, type NodeObj } from "mind-elixir";

interface SummaryRange {
  id: string;
  label: string;
  startIdx: number;
  endIdx: number;
  children: ExtNodeObj[]; // サマリーノードの子
}

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
interface SummarySelectMode { parentId: string; indices: Set<number>; }

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function findNode(root: ExtNodeObj, id: string): ExtNodeObj | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) { const r = findNode(c, id); if (r) return r; }
  // サマリーの子も探す
  for (const s of root.summaries ?? []) {
    for (const c of s.children ?? []) { const r = findNode(c, id); if (r) return r; }
  }
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

  // サマリーに子を追加
  const addChildToSummary = useCallback((parentNodeId: string, summaryId: string) => {
    const newId = `node-${Date.now()}`;
    const u = clone(data);
    const parent = findNode(u.nodeData as ExtNodeObj, parentNodeId);
    const s = parent?.summaries?.find(s => s.id === summaryId);
    if (s) s.children = [...(s.children ?? []), { id: newId, topic: "新しいノード", children: [] }];
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
    const u = clone(data);
    const parent = findParent(u.nodeData as ExtNodeObj, id);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === id);
      if (parent.summaries && idx !== -1) {
        parent.summaries = parent.summaries.filter(s => {
          if (idx < s.startIdx) { s.startIdx--; s.endIdx--; }
          else if (idx <= s.endIdx) { s.endIdx--; }
          return s.endIdx >= s.startIdx;
        });
      }
    }
    removeNode(u.nodeData as ExtNodeObj, id); commit(u);
    setSelectedId(null); setSummaryMode(null);
  }, [data, commit]);

  const startSummaryMode = useCallback(() => {
    if (!selectedId) return;
    const parent = findParent(root, selectedId);
    if (!parent) return;
    const idx = parent.children.findIndex(c => c.id === selectedId);
    setSummaryMode({ parentId: parent.id, indices: new Set([idx]) });
  }, [selectedId, root]);

  const toggleSummaryNode = useCallback((parentId: string, idx: number) => {
    if (!summaryMode || summaryMode.parentId !== parentId) return;
    const next = new Set(summaryMode.indices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSummaryMode({ ...summaryMode, indices: next });
  }, [summaryMode]);

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
      children: [],
    }];
    commit(u); setSummaryMode(null);
    setTimeout(() => setEditState({ id: `edit-summary-${summaryId}`, value: "まとめ" }), 50);
  }, [summaryMode, data, commit]);

  const deleteSummary = useCallback((parentId: string, summaryId: string) => {
    const u = clone(data); const parent = findNode(u.nodeData as ExtNodeObj, parentId);
    if (parent?.summaries) parent.summaries = parent.summaries.filter(s => s.id !== summaryId);
    commit(u); setSelectedId(null);
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
            if (isInSummaryMode && !isRoot) toggleSummaryNode(parentId!, childIdx);
            else setSelectedId(node.id);
          }}
          onDoubleClick={() => !summaryMode && setEditState({ id: node.id, value: node.topic })}
          style={{
            padding: isRoot ? "10px 20px" : "6px 14px",
            borderRadius: isRoot ? 10 : 6,
            background: isInSummarySelection ? theme.rootBg + "22" : isRoot ? theme.rootBg : theme.nodeBg,
            color: isRoot ? theme.rootText : theme.nodeText,
            border: `${isSelected || isInSummarySelection ? 2 : 1.5}px solid ${isInSummarySelection ? theme.rootBg : isSelected ? theme.rootBg : theme.border}`,
            cursor: isInSummaryMode && !isRoot ? "crosshair" : "pointer",
            fontSize: isRoot ? 15 : 13, fontWeight: isRoot ? 700 : 400,
            whiteSpace: "nowrap", userSelect: "none", outline: "none", transition: "all 0.15s",
            boxShadow: isInSummarySelection ? `0 0 0 3px ${theme.rootBg}33` : isSelected ? `0 0 0 3px ${theme.rootBg}33` : isRoot ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
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

        {isSelected && !isEditing && !summaryMode && (
          <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
            <Btn theme={theme} onClick={() => addChild(node.id)}>+子</Btn>
            {!isRoot && <Btn theme={theme} onClick={() => addSibling(node.id)}>+兄弟</Btn>}
            {/* 兄弟が2つ以上いる場合のみまとめを許可 */}
            {!isRoot && (() => { const p = findParent(root, node.id); return p && p.children.length >= 2; })() && (
              <Btn theme={theme} onClick={startSummaryMode} highlight>まとめ</Btn>
            )}
            {!isRoot && <Btn theme={theme} onClick={() => del(node.id)} danger>✕</Btn>}
          </div>
        )}

        {(node.children ?? []).length > 0 && (
          <ChildrenWithSummaries
            parent={node} depth={depth} theme={theme}
            editState={editState} setEditState={setEditState}
            summaryMode={summaryMode} selectedId={selectedId}
            renderNode={renderNode}
            updateSummaryLabel={updateSummaryLabel}
            deleteSummary={deleteSummary}
            addChildToSummary={addChildToSummary}
            onSelectSummary={setSelectedId}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", background: theme.bg }}
      onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
    >
      {summaryMode && (
        <div style={{
          position: "sticky", top: 0, zIndex: 50, width: "100%",
          background: theme.rootBg, color: theme.rootText,
          padding: "8px 16px", display: "flex", alignItems: "center", gap: 12,
          justifyContent: "center", fontSize: 13,
        }}>
          <span>まとめたいノードをクリック（{summaryMode.indices.size}個選択中）</span>
          <button onClick={createSummary} disabled={summaryMode.indices.size < 1}
            style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: "#fff", color: theme.rootBg, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
            まとめ確定
          </button>
          <button onClick={() => setSummaryMode(null)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12 }}>
            キャンセル (Esc)
          </button>
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

function ChildrenWithSummaries({ parent, depth, theme, editState, setEditState, summaryMode, selectedId, renderNode, updateSummaryLabel, deleteSummary, addChildToSummary, onSelectSummary }: {
  parent: ExtNodeObj; depth: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  summaryMode: SummarySelectMode | null; selectedId: string | null;
  renderNode: (n: ExtNodeObj, d: number, pid: string | null, idx: number) => ReactElement;
  updateSummaryLabel: (pid: string, sid: string, label: string) => void;
  deleteSummary: (pid: string, sid: string) => void;
  addChildToSummary: (pid: string, sid: string) => void;
  onSelectSummary: (id: string) => void;
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
          selectedId={selectedId}
          renderNode={renderNode} depth={depth}
          onUpdateLabel={label => updateSummaryLabel(parent.id, summary.id, label)}
          onDelete={() => deleteSummary(parent.id, summary.id)}
          onAddChild={() => addChildToSummary(parent.id, summary.id)}
          onSelect={onSelectSummary}
        />
      ))}
    </div>
  );
}

function SummaryBracket({ summary, childCount, theme, editState, setEditState, selectedId, renderNode, depth, onUpdateLabel, onDelete, onAddChild, onSelect }: {
  summary: SummaryRange; childCount: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  selectedId: string | null;
  renderNode: (n: ExtNodeObj, d: number, pid: string | null, idx: number) => ReactElement;
  depth: number;
  onUpdateLabel: (label: string) => void;
  onDelete: () => void;
  onAddChild: () => void;
  onSelect: (id: string) => void;
}) {
  const isEditingLabel = editState?.id === `edit-summary-${summary.id}`;
  const isSummarySelected = selectedId === `summary-sel-${summary.id}`;
  const children = (summary.children ?? []) as ExtNodeObj[];

  // ブラケット位置を比率で計算（0〜100）
  const total = Math.max(childCount - 1, 1);
  const lPct = childCount === 1 ? 10 : (summary.startIdx / total) * 80 + 10;
  const rPct = childCount === 1 ? 90 : (summary.endIdx / total) * 80 + 10;
  const mid = (lPct + rPct) / 2;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 0 }}>
      {/* 滑らかなU字ブラケット + 中央接続線 */}
      <svg
        width="100%" height="44"
        viewBox="0 0 100 44" preserveAspectRatio="none"
        style={{ overflow: "visible", display: "block" }}
      >
        {/* U字カーブ：lPctからrPctへ、中央が一番下 */}
        <path
          d={`M ${lPct},2 Q ${lPct},36 ${mid},36 Q ${rPct},36 ${rPct},2`}
          fill="none"
          stroke={theme.line}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* 中央からまとめノードへの接続線 */}
        <line
          x1={mid} y1="36" x2={mid} y2="44"
          stroke={theme.line} strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* まとめノード（角丸長方形） */}
      <div
        onClick={e => { e.stopPropagation(); onSelect(`summary-sel-${summary.id}`); }}
        onDoubleClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}
        style={{
          padding: "6px 18px",
          borderRadius: 8,
          background: isSummarySelected ? theme.rootBg + "18" : theme.bg,
          color: isSummarySelected ? theme.rootBg : theme.nodeText,
          border: `2px solid ${isSummarySelected ? theme.rootBg : theme.line}`,
          cursor: "pointer", userSelect: "none",
          fontSize: 13, fontWeight: 600,
          transition: "all 0.15s",
          boxShadow: isSummarySelected ? `0 0 0 3px ${theme.rootBg}22` : "none",
          whiteSpace: "nowrap",
        }}
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
            style={{ background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: "inherit", fontWeight: "inherit", minWidth: 60, width: Math.max((editState?.value.length ?? 1) * 9, 60) }}
          />
        ) : summary.label}
      </div>

      {/* 選択時アクション */}
      {isSummarySelected && (
        <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
          <Btn theme={theme} onClick={onAddChild}>+子ノード</Btn>
          <Btn theme={theme} onClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}>編集</Btn>
          <Btn theme={theme} onClick={onDelete} danger>削除</Btn>
        </div>
      )}

      {/* まとめの子ノード */}
      {children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 2, height: 16, background: theme.line }} />
          {children.length > 1 && (
            <div style={{ height: 2, background: theme.line, width: "calc(100% - 48px)", alignSelf: "center" }} />
          )}
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            {children.map((child, idx) => (
              <div key={child.id}>{renderNode(child as ExtNodeObj, depth + 2, `summary-children-${summary.id}`, idx)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ children, theme, onClick, danger, highlight }: { children: React.ReactNode; theme: Theme; onClick: () => void; danger?: boolean; highlight?: boolean }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
      padding: "2px 9px", borderRadius: 4,
      border: `1px solid ${danger ? "#ef4444" : highlight ? theme.rootBg : theme.border}`,
      background: highlight ? theme.rootBg + "22" : theme.surface,
      color: danger ? "#ef4444" : highlight ? theme.rootBg : theme.text,
      cursor: "pointer", fontSize: 10, transition: "all 0.15s",
    }}>{children}</button>
  );
}
