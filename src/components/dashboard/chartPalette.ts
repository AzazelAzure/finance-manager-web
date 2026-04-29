/** Recharts / pie fill cycle (theme-friendly). */
export const CHART_SLICE_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--chart-outgoing)",
  "var(--chart-leak)",
  "var(--warn)",
  "var(--danger)",
  "#0ea5e9",
  "#c026d3",
] as const;

export function pieColorAt(i: number): string {
  return CHART_SLICE_COLORS[i % CHART_SLICE_COLORS.length];
}
