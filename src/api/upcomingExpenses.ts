import { api } from "./client";
import type { UpcomingExpenseMutationPayload, UpcomingExpenseRecord } from "./types";

type UpcomingExpenseListResponse =
  | UpcomingExpenseRecord[]
  | {
      expenses?: UpcomingExpenseRecord[];
      items?: UpcomingExpenseRecord[];
      results?: UpcomingExpenseRecord[];
    };

function normalizeUpcomingRow(row: Partial<UpcomingExpenseRecord>): UpcomingExpenseRecord {
  const isRecur = (row as { is_recurring?: boolean }).is_recurring;
  return {
    name: String(row.name ?? "").trim(),
    amount: String(row.amount ?? "0"),
    currency: String(row.currency ?? "USD").toUpperCase(),
    due_date: String(row.due_date ?? ""),
    paid_flag: Boolean(row.paid_flag),
    recurring_flag: Boolean(row.recurring_flag ?? isRecur),
    source: row.source ? String(row.source) : "",
    start_date: row.start_date ? String(row.start_date) : "",
    end_date: row.end_date ? String(row.end_date) : "",
  };
}

export async function listUpcomingExpenses(): Promise<UpcomingExpenseRecord[]> {
  const { data } = await api.get<UpcomingExpenseListResponse>("/finance/upcoming_expenses/");
  const rows = Array.isArray(data) ? data : data.expenses ?? data.items ?? data.results ?? [];
  return rows
    .map((row) => normalizeUpcomingRow(row))
    .filter((row) => Boolean(row.name));
}

export async function createUpcomingExpense(payload: UpcomingExpenseMutationPayload): Promise<UpcomingExpenseRecord> {
  const { data } = await api.post<UpcomingExpenseRecord>("/finance/upcoming_expenses/", payload);
  return normalizeUpcomingRow(data);
}

export async function updateUpcomingExpense(
  originalName: string,
  payload: Partial<UpcomingExpenseMutationPayload>,
): Promise<UpcomingExpenseRecord> {
  const safeName = encodeURIComponent(originalName);
  const { data } = await api.patch<UpcomingExpenseRecord>(`/finance/upcoming_expenses/${safeName}/`, payload);
  return normalizeUpcomingRow(data);
}

export async function deleteUpcomingExpense(name: string): Promise<void> {
  const safeName = encodeURIComponent(name);
  await api.delete(`/finance/upcoming_expenses/${safeName}/`);
}
