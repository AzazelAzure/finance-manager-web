/**
 * Merge queued PATCH /finance/appprofile/ outbox rows into cached profile reads (FIFO).
 */

import type { AppProfileResponse, AppProfileUpdateRequest } from "../api/types";
import type { OutboxRow } from "./db";
import { listOutboxOrdered, parseOutboxBody } from "./outbox";

const PROFILE_PATH = /^\/finance\/appprofile\/?$/;

function normPath(url: string): string {
  const p = url.split("?")[0];
  return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
}

export function mergeProfileOutboxFifo(base: AppProfileResponse, rows: OutboxRow[]): AppProfileResponse {
  let next: AppProfileResponse = { ...base };
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    if (row.method.toUpperCase() !== "PATCH") {
      continue;
    }
    if (!PROFILE_PATH.test(normPath(row.url))) {
      continue;
    }
    const parsedBody = parseOutboxBody(row.body);
    if (!parsedBody || typeof parsedBody !== "object") {
      continue;
    }
    const p = parsedBody as AppProfileUpdateRequest;
    next = {
      ...next,
      ...(p.spend_accounts !== undefined ? { spend_accounts: [...p.spend_accounts] } : {}),
      ...(p.base_currency !== undefined ? { base_currency: String(p.base_currency).trim().toUpperCase() } : {}),
      ...(p.timezone !== undefined ? { timezone: String(p.timezone) } : {}),
      ...(p.start_week !== undefined ? { start_of_week: Number(p.start_week) } : {}),
      ...(p.completed_tours !== undefined ? { completed_tours: [...p.completed_tours] } : {}),
      ...(p.sts_window_mode !== undefined ? { sts_window_mode: p.sts_window_mode } : {}),
      ...(p.pay_cycle_frequency !== undefined ? { pay_cycle_frequency: p.pay_cycle_frequency } : {}),
      ...(p.pay_cycle_anchor_date !== undefined ? { pay_cycle_anchor_date: p.pay_cycle_anchor_date } : {}),
    };
  }
  return next;
}

/** Merge queued profile patches into a profile response (FIFO). */
export async function applyProfileOutboxToProfile(base: AppProfileResponse): Promise<AppProfileResponse> {
  const rows = await listOutboxOrdered();
  return mergeProfileOutboxFifo(base, rows);
}
