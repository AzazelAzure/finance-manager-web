export const SOURCE_ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CASH", "EWALLET", "INVESTMENT"] as const;

export type SourceAccountType = (typeof SOURCE_ACCOUNT_TYPES)[number];

export const SOURCE_ACCOUNT_TYPE_OPTIONS: Array<{ value: SourceAccountType; label: string }> = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "CASH", label: "Cash" },
  { value: "EWALLET", label: "E-wallet" },
  { value: "INVESTMENT", label: "Investment" },
];
