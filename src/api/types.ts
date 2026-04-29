export type LoginResponse = {
  access: string;
  refresh: string;
};

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

export type AppProfileResponse = {
  spend_accounts: string[];
  base_currency: string;
  timezone: string;
  start_of_week: number;
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
