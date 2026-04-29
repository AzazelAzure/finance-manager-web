export type LoginResponse = {
  access: string;
  refresh: string;
};

export type SnapshotResponse = {
  flow_series: Array<{ label: string; incoming: number; outgoing: number; leaks: number }>;
  expense_by_category: Array<{ name: string; value: number }>;
  source_balances: Array<{ source: string; acc_type: string; amount: string; currency: string }>;
  daily_spend: Array<{ date: string; amount: number }>;
  daily_income: Array<{ date: string; amount: number }>;
  total_expenses_for_month: number;
  total_income_for_month: number;
  total_transfer_out_for_month: number;
  total_transfer_in_for_month: number;
  total_leaks_for_month: number;
  snapshot: {
    total_assets?: number;
    safe_to_spend?: number;
    total_remaining_expenses?: number;
    [key: string]: number | string | undefined;
  };
};
