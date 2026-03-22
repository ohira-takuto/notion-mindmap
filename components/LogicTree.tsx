"use client";

import { useRef, useState, useCallback, useEffect, type ReactElement } from "react";
import { type Theme } from "@/lib/themes";
import { type MindElixirData, type NodeObj } from "mind-elixir";

interface SummaryRange {
  id: string;
  label: string;
  startIdx: number;
  endIdx: number;
  children: ExtNodeObj[];
  summaries?: SummaryRange[]; // ネストしたまとめ
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
interface SummarySelectMode {
  parentId: string;      // 通常: node id / サマリー内: summary id
  summaryId?: string;    // set when selecting within a summary's children
  indices: Set<number>;
}

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function findNode(root: ExtNodeObj, id: string): ExtNodeObj | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) { const r = findNode(c, id); if (r) return r; }
  for (const s of root.summaries ?? []) {
    for (const c of s.children ?? []) { const r = findNode(c, id); if (r) return r; }
  }
  return null;
}

// 通常のchildren内を再帰 + サマリーのchildren内も再帰
function findParent(root: ExtNodeObj, id: string): ExtNodeObj | null {
  for (const c of root.children ?? []) {
    if (c.id === id) return root;
    const r = findParent(c, id); if (r) return r;
  }
  for (const s of root.summaries ?? []) {
    for (const c of s.children ?? []) {
      const r = findParent(c, id); if (r) return r;
    }
  }
  return null;
}

// あるノードを直接の子として持つSummaryRangeを返す
function findContainerSummary(root: ExtNodeObj, id: string): SummaryRange | null {
  for (const s of root.summaries ?? []) {
    if (s.children.some(c => c.id === id)) return s;
    const inNested = findContainerInRange(s, id);
    if (inNested) return inNested;
    for (const c of s.children ?? []) {
      const r = findContainerSummary(c, id); if (r) return r;
    }
  }
  for (const c of root.children ?? []) {
    const r = findContainerSummary(c, id); if (r) return r;
  }
  return null;
}

function findContainerInRange(s: SummaryRange, id: string): SummaryRange | null {
  for (const ns of s.summaries ?? []) {
    if (ns.children.some(c => c.id === id)) return ns;
    const r = findContainerInRange(ns, id); if (r) return r;
  }
  return null;
}

function findSummaryById(root: ExtNodeObj, id: string): SummaryRange | null {
  for (const s of root.summaries ?? []) {
    if (s.id === id) return s;
    const n = findInRange(s, id); if (n) return n;
    for (const c of s.children ?? []) { const r = findSummaryById(c, id); if (r) return r; }
  }
  for (const c of root.children ?? []) { const r = findSummaryById(c, id); if (r) return r; }
  return null;
}

function findInRange(s: SummaryRange, id: string): SummaryRange | null {
  for (const ns of s.summaries ?? []) {
    if (ns.id === id) return ns;
    const r = findInRange(ns, id); if (r) return r;
  }
  return null;
}

function deleteSummaryById(root: ExtNodeObj, id: string): boolean {
  if (root.summaries) {
    const idx = root.summaries.findIndex(s => s.id === id);
    if (idx !== -1) { root.summaries.splice(idx, 1); return true; }
    for (const s of root.summaries) {
      if (deleteFromRange(s, id)) return true;
      for (const c of s.children ?? []) { if (deleteSummaryById(c, id)) return true; }
    }
  }
  for (const c of root.children ?? []) { if (deleteSummaryById(c, id)) return true; }
  return false;
}

function deleteFromRange(s: SummaryRange, id: string): boolean {
  if (s.summaries) {
    const idx = s.summaries.findIndex(ns => ns.id === id);
    if (idx !== -1) { s.summaries.splice(idx, 1); return true; }
    for (const ns of s.summaries) { if (deleteFromRange(ns, id)) return true; }
  }
  return false;
}

function removeNode(root: ExtNodeObj, id: string): boolean {
  const idx = (root.children ?? []).findIndex(c => c.id === id);
  if (idx !== -1) { root.children.splice(idx, 1); return true; }
  if ((root.children ?? []).some(c => removeNode(c, id))) return true;
  for (const s of root.summaries ?? []) {
    if (removeFromRange(s, id)) return true;
  }
  return false;
}

function removeFromRange(s: SummaryRange, id: string): boolean {
  const idx = s.children.findIndex(c => c.id === id);
  if (idx !== -1) { s.children.splice(idx, 1); return true; }
  if (s.children.some(c => removeNode(c, id))) return true;
  for (const ns of s.summaries ?? []) {
    if (removeFromRange(ns, id)) return true;
  }
  return false;
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

  const addChildToSummary = useCallback((summaryId: string) => {
    const newId = `node-${Date.now()}`;
    const u = clone(data);
    const s = findSummaryById(u.nodeData as ExtNodeObj, summaryId);
    if (s) s.children = [...(s.children ?? []), { id: newId, topic: "新しいノード", children: [] }];
    commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
  }, [data, commit]);

  const addSibling = useCallback((siblingId: string) => {
    const newId = `node-${Date.now()}`;
    const u = clone(data);
    const uRoot = u.nodeData as ExtNodeObj;
    const parent = findParent(uRoot, siblingId);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === siblingId);
      parent.children.splice(idx + 1, 0, { id: newId, topic: "新しいノード", children: [] });
      commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
      return;
    }
    const container = findContainerSummary(uRoot, siblingId);
    if (container) {
      const idx = container.children.findIndex(c => c.id === siblingId);
      container.children.splice(idx + 1, 0, { id: newId, topic: "新しいノード", children: [] });
      commit(u); setTimeout(() => { setSelectedId(newId); setEditState({ id: newId, value: "新しいノード" }); }, 50);
    }
  }, [data, commit]);

  const del = useCallback((id: string) => {
    const u = clone(data);
    const uRoot = u.nodeData as ExtNodeObj;
    const parent = findParent(uRoot, id);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === id);
      if (idx !== -1 && parent.summaries) {
        parent.summaries = parent.summaries.filter(s => {
          if (idx < s.startIdx) { s.startIdx--; s.endIdx--; }
          else if (idx <= s.endIdx) { s.endIdx--; }
          return s.endIdx >= s.startIdx;
        });
      }
    } else {
      const container = findContainerSummary(uRoot, id);
      if (container?.summaries) {
        const idx = container.children.findIndex(c => c.id === id);
        if (idx !== -1) {
          container.summaries = container.summaries.filter(s => {
            if (idx < s.startIdx) { s.startIdx--; s.endIdx--; }
            else if (idx <= s.endIdx) { s.endIdx--; }
            return s.endIdx >= s.startIdx;
          });
        }
      }
    }
    removeNode(uRoot, id);
    commit(u); setSelectedId(null); setSummaryMode(null);
  }, [data, commit]);

  const startSummaryMode = useCallback(() => {
    if (!selectedId) return;
    const parent = findParent(root, selectedId);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === selectedId);
      setSummaryMode({ parentId: parent.id, indices: new Set([idx]) });
      return;
    }
    const container = findContainerSummary(root, selectedId);
    if (container) {
      const idx = container.children.findIndex(c => c.id === selectedId);
      setSummaryMode({ parentId: container.id, summaryId: container.id, indices: new Set([idx]) });
    }
  }, [selectedId, root]);

  const toggleSummaryNode = useCallback((parentId: string, idx: number) => {
    if (!summaryMode) return;
    const matches =
      (!summaryMode.summaryId && summaryMode.parentId === parentId) ||
      (summaryMode.summaryId && parentId === `summary-children-${summaryMode.summaryId}`);
    if (!matches) return;
    const next = new Set(summaryMode.indices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSummaryMode({ ...summaryMode, indices: next });
  }, [summaryMode]);

  const createSummary = useCallback(() => {
    if (!summaryMode || summaryMode.indices.size === 0) return;
    const sorted = [...summaryMode.indices].sort((a, b) => a - b);
    const u = clone(data);
    const newSummaryId = `summary-${Date.now()}`;
    const newSummary: SummaryRange = {
      id: newSummaryId, label: "まとめ",
      startIdx: sorted[0], endIdx: sorted[sorted.length - 1],
      children: [],
    };
    if (summaryMode.summaryId) {
      const s = findSummaryById(u.nodeData as ExtNodeObj, summaryMode.summaryId);
      if (s) s.summaries = [...(s.summaries ?? []), newSummary];
    } else {
      const parent = findNode(u.nodeData as ExtNodeObj, summaryMode.parentId);
      if (parent) parent.summaries = [...(parent.summaries ?? []), newSummary];
    }
    commit(u); setSummaryMode(null);
    setTimeout(() => setEditState({ id: `edit-summary-${newSummaryId}`, value: "まとめ" }), 50);
  }, [summaryMode, data, commit]);

  const deleteSummary = useCallback((summaryId: string) => {
    const u = clone(data);
    deleteSummaryById(u.nodeData as ExtNodeObj, summaryId);
    commit(u); setSelectedId(null);
  }, [data, commit]);

  const updateSummaryLabel = useCallback((summaryId: string, label: string) => {
    const u = clone(data);
    const s = findSummaryById(u.nodeData as ExtNodeObj, summaryId);
    if (s) s.label = label;
    commit(u);
  }, [data, commit]);

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
    const isInSummaryMode = summaryMode !== null && parentId !== null && (
      (!summaryMode.summaryId && summaryMode.parentId === parentId) ||
      (summaryMode.summaryId && parentId === `summary-children-${summaryMode.summaryId}`)
    );
    const isInSummarySelection = isInSummaryMode && summaryMode!.indices.has(childIdx);
    const canSummarize = !isRoot && (() => {
      const p = findParent(root, node.id);
      if (p) return p.children.length >= 2;
      const container = findContainerSummary(root, node.id);
      return (container?.children?.length ?? 0) >= 2;
    })();

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
            {canSummarize && <Btn theme={theme} onClick={startSummaryMode} highlight>まとめ</Btn>}
            {!isRoot && <Btn theme={theme} onClick={() => del(node.id)} danger>✕</Btn>}
          </div>
        )}

        {(node.children ?? []).length > 0 && (
          <ChildrenWithSummaries
            groupKey={node.id}
            children={node.children as ExtNodeObj[]}
            summaries={node.summaries ?? []}
            depth={depth} theme={theme}
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

function ChildrenWithSummaries({
  groupKey, children, summaries, depth, theme,
  editState, setEditState, summaryMode, selectedId,
  renderNode, updateSummaryLabel, deleteSummary, addChildToSummary, onSelectSummary,
}: {
  groupKey: string;
  children: ExtNodeObj[];
  summaries: SummaryRange[];
  depth: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  summaryMode: SummarySelectMode | null; selectedId: string | null;
  renderNode: (n: ExtNodeObj, d: number, pid: string | null, idx: number) => ReactElement;
  updateSummaryLabel: (sid: string, label: string) => void;
  deleteSummary: (sid: string) => void;
  addChildToSummary: (sid: string) => void;
  onSelectSummary: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 2, height: 16, background: theme.line }} />
      {children.length > 1 && (
        <div style={{ height: 2, background: theme.line, width: "calc(100% - 48px)", alignSelf: "center" }} />
      )}
      <div style={{ display: "flex", flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
        {children.map((child, idx) => (
          <div key={child.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {renderNode(child, depth + 1, groupKey, idx)}
          </div>
        ))}
      </div>
      {summaries.map(summary => (
        <SummaryBracket
          key={summary.id} summary={summary} childCount={children.length}
          theme={theme} editState={editState} setEditState={setEditState}
          selectedId={selectedId} renderNode={renderNode} depth={depth}
          onUpdateLabel={label => updateSummaryLabel(summary.id, label)}
          onDelete={() => deleteSummary(summary.id)}
          onAddChild={() => addChildToSummary(summary.id)}
          onSelect={onSelectSummary}
          updateSummaryLabel={updateSummaryLabel}
          deleteSummary={deleteSummary}
          addChildToSummary={addChildToSummary}
          summaryMode={summaryMode}
        />
      ))}
    </div>
  );
}

function SummaryBracket({
  summary, childCount, theme, editState, setEditState, selectedId,
  renderNode, depth, onUpdateLabel, onDelete, onAddChild, onSelect,
  updateSummaryLabel, deleteSummary, addChildToSummary, summaryMode,
}: {
  summary: SummaryRange; childCount: number; theme: Theme;
  editState: EditState | null; setEditState: (s: EditState | null) => void;
  selectedId: string | null;
  renderNode: (n: ExtNodeObj, d: number, pid: string | null, idx: number) => ReactElement;
  depth: number;
  onUpdateLabel: (label: string) => void;
  onDelete: () => void;
  onAddChild: () => void;
  onSelect: (id: string) => void;
  updateSummaryLabel: (sid: string, label: string) => void;
  deleteSummary: (sid: string) => void;
  addChildToSummary: (sid: string) => void;
  summaryMode: SummarySelectMode | null;
}) {
  const isEditingLabel = editState?.id === `edit-summary-${summary.id}`;
  const isSummarySelected = selectedId === `summary-sel-${summary.id}`;
  const children = (summary.children ?? []) as ExtNodeObj[];
  const total = Math.max(childCount - 1, 1);
  const lPct = childCount === 1 ? 10 : (summary.startIdx / total) * 80 + 10;
  const rPct = childCount === 1 ? 90 : (summary.endIdx / total) * 80 + 10;
  const mid = (lPct + rPct) / 2;
  const groupKey = `summary-children-${summary.id}`;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <svg width="100%" height="44" viewBox="0 0 100 44" preserveAspectRatio="none" style={{ overflow: "visible", display: "block" }}>
        <path d={`M ${lPct},2 Q ${lPct},36 ${mid},36 Q ${rPct},36 ${rPct},2`} fill="none" stroke={theme.line} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1={mid} y1="36" x2={mid} y2="44" stroke={theme.line} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
        <div style={{ flexShrink: 0, width: `${mid}%` }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "translateX(-50%)" }}>
          <div
            onClick={e => { e.stopPropagation(); onSelect(`summary-sel-${summary.id}`); }}
            onDoubleClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}
            style={{
              padding: "6px 18px", borderRadius: 8,
              background: isSummarySelected ? theme.rootBg + "18" : theme.bg,
              color: isSummarySelected ? theme.rootBg : theme.nodeText,
              border: `2px solid ${isSummarySelected ? theme.rootBg : theme.line}`,
              cursor: "pointer", userSelect: "none",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
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
          {isSummarySelected && (
            <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
              <Btn theme={theme} onClick={onAddChild}>+子ノード</Btn>
              <Btn theme={theme} onClick={() => setEditState({ id: `edit-summary-${summary.id}`, value: summary.label })}>編集</Btn>
              <Btn theme={theme} onClick={onDelete} danger>削除</Btn>
            </div>
          )}
          {children.length > 0 && (
            <ChildrenWithSummaries
              groupKey={groupKey}
              children={children}
              summaries={summary.summaries ?? []}
              depth={depth + 1} theme={theme}
              editState={editState} setEditState={setEditState}
              summaryMode={summaryMode} selectedId={selectedId}
              renderNode={renderNode}
              updateSummaryLabel={updateSummaryLabel}
              deleteSummary={deleteSummary}
              addChildToSummary={addChildToSummary}
              onSelectSummary={onSelect}
            />
          )}
        </div>
      </div>
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
