/** Recharts / pie fill cycle (theme-friendly). */
export const CHART_SLICE_COLORS = [
  "var(--color-brand-primary)",
  "var(--color-positive)",
  "var(--color-warning)",
  "var(--color-negative)",
  "var(--color-pending)",
  "color-mix(in srgb, var(--color-brand-primary) 70%, var(--color-positive))",
  "color-mix(in srgb, var(--color-negative) 76%, var(--color-warning))",
  "var(--color-neutral)",
] as const;

export function pieColorAt(i: number): string {
  return CHART_SLICE_COLORS[i % CHART_SLICE_COLORS.length];
}
