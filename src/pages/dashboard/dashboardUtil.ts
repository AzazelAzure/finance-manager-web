export function firstCurrency(
  sourceBalances: Array<{ currency: string }>,
  fallback = "USD",
): string {
  return sourceBalances[0]?.currency || fallback;
}
