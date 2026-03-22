export type ThemeKey = "dark" | "eye-friendly" | "monochrome" | "ocean" | "warm";

export interface Theme {
  label: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  rootBg: string;
  rootText: string;
  nodeBg: string;
  nodeText: string;
  line: string;
  headerBg: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  "dark": {
    label: "ダーク",
    bg: "#030712",
    surface: "#111827",
    border: "#374151",
    text: "#f9fafb",
    textMuted: "#6b7280",
    rootBg: "#1d4ed8",
    rootText: "#fff",
    nodeBg: "#1f2937",
    nodeText: "#e5e7eb",
    line: "#4b5563",
    headerBg: "#111827",
  },
  "eye-friendly": {
    label: "目に優しい",
    bg: "#f0f4f0",
    surface: "#e8f0e8",
    border: "#a3c4a3",
    text: "#1a3a1a",
    textMuted: "#5a7a5a",
    rootBg: "#4a7c59",
    rootText: "#fff",
    nodeBg: "#d4e8d4",
    nodeText: "#1a3a1a",
    line: "#6aaa7a",
    headerBg: "#dceadc",
  },
  "monochrome": {
    label: "モノトーン",
    bg: "#ffffff",
    surface: "#f3f4f6",
    border: "#d1d5db",
    text: "#111827",
    textMuted: "#9ca3af",
    rootBg: "#111827",
    rootText: "#fff",
    nodeBg: "#f3f4f6",
    nodeText: "#111827",
    line: "#9ca3af",
    headerBg: "#f9fafb",
  },
  "ocean": {
    label: "オーシャン",
    bg: "#0f172a",
    surface: "#1e293b",
    border: "#334155",
    text: "#e2e8f0",
    textMuted: "#64748b",
    rootBg: "#0369a1",
    rootText: "#fff",
    nodeBg: "#1e3a5f",
    nodeText: "#bfdbfe",
    line: "#3b82f6",
    headerBg: "#1e293b",
  },
  "warm": {
    label: "ウォーム",
    bg: "#fdf6ec",
    surface: "#fef3c7",
    border: "#f59e0b",
    text: "#78350f",
    textMuted: "#b45309",
    rootBg: "#d97706",
    rootText: "#fff",
    nodeBg: "#fef3c7",
    nodeText: "#78350f",
    line: "#f59e0b",
    headerBg: "#fef3c7",
  },
};
