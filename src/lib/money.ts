/** Format a numeric amount for display; currency is an ISO code or label. */
export function formatMoney(value: string | number | null | undefined, currency = "USD", opts?: { naLabel?: string }): string {
  if (value === null || value === undefined || value === "") {
    return opts?.naLabel ?? "N/A";
  }
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) {
    return opts?.naLabel ?? "N/A";
  }
  return `${n.toFixed(2)} ${currency}`;
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isNaN(n) ? null : n;
}
