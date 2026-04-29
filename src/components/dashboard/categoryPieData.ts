import { pieColorAt } from "./chartPalette";

const TOP = 7;
const TINY_SLICE_THRESHOLD = 0.04;

export type CategoryPieRow = {
  name: string;
  value: number;
  fill: string;
  isOther: boolean;
  percent: number;
  mergedNames?: string[];
};

export function buildCategoryPieData(expenseByCategory: Array<{ name: string; value: number }>): CategoryPieRow[] {
  if (!expenseByCategory.length) {
    return [];
  }
  const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((acc, row) => acc + row.value, 0);
  const tiny = sorted.filter((row) => (total > 0 ? row.value / total : 0) < TINY_SLICE_THRESHOLD);
  const nonTiny = sorted.filter((row) => (total > 0 ? row.value / total : 0) >= TINY_SLICE_THRESHOLD);

  if (nonTiny.length <= TOP && tiny.length === 0) {
    return sorted.map((s, i) => ({
      name: s.name,
      value: s.value,
      fill: pieColorAt(i),
      isOther: false,
      percent: total > 0 ? s.value / total : 0,
    }));
  }
  const head = nonTiny.slice(0, TOP);
  const tail = [...nonTiny.slice(TOP), ...tiny];
  const otherSum = tail.reduce((a, t) => a + t.value, 0);
  const result: CategoryPieRow[] = head.map((s, i) => ({
    name: s.name,
    value: s.value,
    fill: pieColorAt(i),
    isOther: false,
    percent: total > 0 ? s.value / total : 0,
  }));
  if (otherSum > 0) {
    result.push({
      name: "Other",
      value: otherSum,
      fill: pieColorAt(TOP),
      isOther: true,
      percent: total > 0 ? otherSum / total : 0,
      mergedNames: tail.map((row) => row.name),
    });
  }
  return result;
}
