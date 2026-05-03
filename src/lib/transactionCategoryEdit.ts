/**
 * When opening the transaction editor, the API may persist default category strings
 * (`expense` / `income` / `transfer` from tx_type) that are not real user categories.
 * If the user has no matching category row, leave the field empty to avoid "create category" friction.
 */

export type TxCategorySlice = {
  category?: string | null;
  tx_type?: string | null;
};

export function categoryInitialValueForEditor(tx: TxCategorySlice, userCategories: string[]): string {
  const raw = (tx.category ?? "").trim();
  if (!raw) {
    return "";
  }
  const lower = raw.toLowerCase();
  if (userCategories.some((c) => typeof c === "string" && c.trim().toLowerCase() === lower)) {
    return raw;
  }
  const tt = String(tx.tx_type ?? "").trim().toUpperCase();
  if ((tt === "XFER_IN" || tt === "XFER_OUT") && lower === "transfer") {
    return "";
  }
  if (tt === "EXPENSE" && lower === "expense") {
    return "";
  }
  if (tt === "INCOME" && lower === "income") {
    return "";
  }
  return raw;
}
