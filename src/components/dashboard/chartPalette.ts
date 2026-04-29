/** Recharts / pie fill cycle (theme-friendly). */
export const CHART_SLICE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#9333ea",
  "#0f766e",
  "#db2777",
  "#475569",
] as const;

export function pieColorAt(i: number): string {
  return CHART_SLICE_COLORS[i % CHART_SLICE_COLORS.length];
}
