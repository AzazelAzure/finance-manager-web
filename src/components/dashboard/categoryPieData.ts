import { pieColorAt } from "./chartPalette";

const TOP = 7;

export type CategoryPieRow = { name: string; value: number; fill: string; isOther: boolean };

export function buildCategoryPieData(expenseByCategory: Array<{ name: string; value: number }>): CategoryPieRow[] {
  if (!expenseByCategory.length) {
    return [];
  }
  const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value);
  if (sorted.length <= TOP) {
    return sorted.map((s, i) => ({ name: s.name, value: s.value, fill: pieColorAt(i), isOther: false }));
  }
  const head = sorted.slice(0, TOP);
  const tail = sorted.slice(TOP);
  const otherSum = tail.reduce((a, t) => a + t.value, 0);
  return [
    ...head.map((s, i) => ({ name: s.name, value: s.value, fill: pieColorAt(i), isOther: false })),
    { name: "Other", value: otherSum, fill: pieColorAt(TOP), isOther: true },
  ];
}
