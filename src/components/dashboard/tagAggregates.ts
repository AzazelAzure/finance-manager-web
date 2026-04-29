import type { SnapshotTransactionRow } from "../../api/types";
import { buildCategoryPieData } from "./categoryPieData";

/** Sum expense amounts per tag (expense lines only) for tag pie. */
export function tagTotalsFromTransactions(txs: SnapshotTransactionRow[]): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.tx_type !== "EXPENSE") {
      continue;
    }
    const raw = t.amount;
    const amt = Math.abs(typeof raw === "string" ? Number(raw) : Number(raw));
    if (Number.isNaN(amt)) {
      continue;
    }
    const list = t.tags && t.tags.length > 0 ? t.tags : ["(untagged)"];
    for (const tag of list) {
      const k = tag?.trim() || "(untagged)";
      m.set(k, (m.get(k) ?? 0) + amt);
    }
  }
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function buildTagPieData(txs: SnapshotTransactionRow[]) {
  return buildCategoryPieData(tagTotalsFromTransactions(txs));
}

/** Top N tag names by frequency (any tx type; count tag appearances). */
export function topTagNamesFromTransactions(txs: SnapshotTransactionRow[], n = 8): string[] {
  const counts = new Map<string, number>();
  for (const t of txs) {
    const list = t.tags && t.tags.length > 0 ? t.tags : [];
    for (const tag of list) {
      const k = tag?.trim();
      if (!k) {
        continue;
      }
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([name, c]) => ({ name, c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, n)
    .map((x) => x.name);
}
