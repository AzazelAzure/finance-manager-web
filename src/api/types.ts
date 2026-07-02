export type LoginResponse = {
  access: string;
  refresh: string;
};

import type { BillCadence } from "../lib/billCadence";

export type SnapshotTransactionRow = {
  tx_id: string;
  created_on: string;
  date?: string;
  description?: string;
  amount: string;
  source: string;
  currency: string;
  tags?: string[];
  tx_type: string;
  category?: string;
  bill?: string | null;
  auto_deducted?: boolean;
};

export type FinancialSnapshotFields = {
  safe_to_spend?: string | number;
  total_assets?: string | number;
  total_savings?: string | number;
  total_checking?: string | number;
  total_investment?: string | number;
  total_cash?: string | number;
  total_ewallet?: string | number;
  total_monthly_spending?: string | number;
  total_remaining_expenses?: string | number;
  total_leaks?: string | number;
  [key: string]: string | number | undefined;
};

export type SnapshotResponse = {
  flow_series: Array<{ label: string; incoming: number; outgoing: number; leaks: number }>;
  expense_by_category: Array<{ name: string; value: number }>;
  source_balances: Array<{ source: string; acc_type: string; amount: string; currency: string }>;
  daily_spend: Array<{ date: string; amount: number }>;
  daily_income: Array<{ date: string; amount: number }>;
  total_expenses_for_month: string | number;
  total_income_for_month: string | number;
  total_transfer_out_for_month: string | number;
  total_transfer_in_for_month: string | number;
  total_leaks_for_month: string | number;
  transactions_for_month: SnapshotTransactionRow[];
  snapshot: FinancialSnapshotFields | null;
};

export type BalanceHistoryRange = "7d" | "30d" | "90d" | "all";

export type BalanceHistoryPoint = {
  date: string;
  source: string;
  amount: string;
  currency: string;
};

export type BalanceHistoryResponse = {
  series: BalanceHistoryPoint[];
  base_currency: string;
};

export type AppProfileResponse = {
  spend_accounts: string[];
  base_currency: string;
  timezone: string;
  start_of_week: number;
  completed_tours?: string[];
  feature_requests_enabled?: boolean;
  sts_window_mode?: "calendar_month" | "pay_cycle";
  pay_cycle_frequency?: "weekly" | "biweekly" | "semimonthly" | "monthly" | null;
  pay_cycle_anchor_date?: string | null;
};

export type AppProfileUpdateRequest = {
  spend_accounts?: string[];
  base_currency?: string;
  timezone?: string;
  start_week?: number;
  completed_tours?: string[];
  sts_window_mode?: "calendar_month" | "pay_cycle";
  pay_cycle_frequency?: "weekly" | "biweekly" | "semimonthly" | "monthly" | null;
  pay_cycle_anchor_date?: string | null;
};

export type AppProfileUpdateResponse = {
  message: string;
  snapshot?: FinancialSnapshotFields | null;
};

export type UserEmailResponse = {
  email: string;
};

export type TagsListResponse = {
  tags: string[];
};

export type CategoryRow = { name: string };

export type SourceRow = {
  source: string;
  acc_type: string;
  currency: string;
  amount: string;
};

export type TxType = "INCOME" | "EXPENSE" | "XFER_IN" | "XFER_OUT" | string;

export type TransactionRecord = {
  tx_id: string;
  entry_id?: string;
  date: string;
  description: string;
  amount: string;
  source: string;
  currency: string;
  tags: string[];
  tx_type: TxType;
  category: string;
  bill?: string;
  auto_deducted?: boolean;
};

export type TransactionsListResponse = {
  transactions?: TransactionRecord[];
};

export type TransactionMutationResult = {
  accepted?: Array<Record<string, unknown>>;
  rejected?: Array<Record<string, unknown>>;
  updated?: Array<Record<string, unknown>>;
  snapshot?: Record<string, unknown>;
};

/** Offline outbox accepted the write locally (HTTP 202 shim from Axios adapter). */
export type OfflineQueuedResult = { offline_queued: true; idempotency_key?: string };

export function isOfflineQueued(x: unknown): x is OfflineQueuedResult {
  return Boolean(x && typeof x === "object" && "offline_queued" in x && (x as OfflineQueuedResult).offline_queued === true);
}

export type TransactionCreateRequest = {
  date: string;
  description?: string;
  amount: string | number;
  source: string;
  currency: string;
  tags?: string[];
  tx_type: TxType;
  category?: string;
  bill?: string;
  auto_deducted?: boolean;
};

export type TransactionPatchRequest = {
  date: string;
  description?: string;
  amount?: string | number;
  source?: string;
  currency?: string;
  tags?: string[];
  tx_type?: TxType;
  category?: string;
  bill?: string;
  auto_deducted?: boolean;
};

export type CalendarDailyRow = {
  date: string;
  amount?: number;
  heat_value?: number;
  heat_intensity?: number;
  tx_count?: number;
  net?: number;
  expense_only?: number;
  count?: number;
  [key: string]: string | number | undefined;
};

export type CalendarDueEventRow = {
  date: string;
  expense_name: string;
  amount: string | number;
  amount_base?: string | number;
  currency: string;
  paid_flag?: boolean;
  is_recurring?: boolean;
};

export type CalendarResponse = {
  start_date?: string;
  end_date?: string;
  display_currency_mode?: "base" | "original";
  heat_metric_mode?: "net" | "expense_only" | "count";
  daily?: CalendarDailyRow[];
  weekly?: Array<Record<string, unknown>>;
  monthly?: Array<Record<string, unknown>>;
  day_drill?: TransactionRecord[];
  due_events?: CalendarDueEventRow[];
  base_currency?: string;
  heat_max?: string | number;
};

export type VisualizationResponse = {
  start_date?: string;
  end_date?: string;
  flow_daily?: Array<{ date: string; income: number; expense: number; net?: number; tx_count?: number }>;
  tx_type_totals?: Array<{ tx_type: string; amount: number }>;
  top_expense_categories?: Array<{ category: string; amount: number }>;
};

export type UpcomingExpenseRecord = {
  name: string;
  amount: string;
  currency: string;
  due_date: string;
  paid_flag: boolean;
  recurring_flag: boolean;
  cadence: BillCadence;
  custom_interval_days: number | null;
  bill_class?: "rigid" | "volatile";
  planned_partial_amount?: string | null;
  cycle_residual_amount?: string | null;
  remainder_due_date?: string | null;
  source?: string;
  auto_deduct?: boolean;
  start_date?: string;
  end_date?: string;
};

export type UpcomingExpenseMutationPayload = {
  name: string;
  amount: string | number;
  currency: string;
  due_date: string;
  paid_flag?: boolean;
  recurring_flag?: boolean;
  is_recurring?: boolean;
  bill_class?: "rigid" | "volatile";
  cadence?: BillCadence;
  custom_interval_days?: number | null;
  planned_partial_amount?: string | number | null;
  cycle_residual_amount?: string | number | null;
  remainder_due_date?: string | null;
  source?: string;
  auto_deduct?: boolean;
  start_date?: string;
  end_date?: string;
};
