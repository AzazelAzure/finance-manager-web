/**
 * Merge allowlisted category / tag / source outbox rows into cached lookup reads (FIFO).
 */

import type { SourceRow } from "../api/types";
import type { OutboxRow } from "./db";
import { listOutboxOrdered, parseOutboxBody } from "./outbox";

const CAT_LIST = /^\/finance\/categories\/?$/;
const TAG_LIST = /^\/finance\/tags\/?$/;
const SRC_LIST = /^\/finance\/sources\/?$/;
const TX_LIST = /^\/finance\/transactions\/?$/;
const TX_DETAIL = /^\/finance\/transactions\/([^/]+)\/?$/;

function normPath(url: string): string {
  const p = url.split("?")[0];
  return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
}

function sortStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortSources(a: SourceRow, b: SourceRow): number {
  return a.source.localeCompare(b.source, undefined, { sensitivity: "base" });
}

function parseCategoryPostName(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("name" in body)) {
    return undefined;
  }
  const n = String((body as { name?: string }).name ?? "").trim();
  return n || undefined;
}

function parseCategoryPatchName(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("name" in body)) {
    return undefined;
  }
  const n = String((body as { name?: string }).name ?? "").trim();
  return n || undefined;
}

function parseSourcePayload(body: unknown): Partial<SourceRow> | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const o = body as Record<string, unknown>;
  const out: Partial<SourceRow> = {};
  if (typeof o.source === "string") {
    out.source = o.source.trim();
  }
  if (typeof o.acc_type === "string") {
    out.acc_type = o.acc_type.trim().toUpperCase();
  }
  if (o.amount != null) {
    out.amount = String(o.amount);
  }
  if (typeof o.currency === "string") {
    out.currency = o.currency.trim().toUpperCase();
  }
  return Object.keys(out).length ? out : undefined;
}

function extractStringsFromTxBody(rawBody: unknown, key: string): string[] {
  const body = parseOutboxBody(rawBody);
  if (!body || typeof body !== "object") {
    return [];
  }
  const arr = Array.isArray(body) ? body : [body];
  const out: string[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const v = (item as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) {
      out.push(v.trim());
    }
  }
  return out;
}

function extractTagsFromTxBody(rawBody: unknown): string[] {
  const body = parseOutboxBody(rawBody);
  if (!body || typeof body !== "object") {
    return [];
  }
  const arr = Array.isArray(body) ? body : [body];
  const out: string[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const v = (item as Record<string, unknown>).tags;
    if (Array.isArray(v)) {
      for (const t of v) {
        if (typeof t === "string" && t.trim()) out.push(t.trim());
      }
    }
  }
  return out;
}

function extractSourcesFromTxBody(rawBody: unknown): Array<{ source: string; currency: string }> {
  const body = parseOutboxBody(rawBody);
  if (!body || typeof body !== "object") {
    return [];
  }
  const arr = Array.isArray(body) ? body : [body];
  const out: Array<{ source: string; currency: string }> = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const s = (item as Record<string, unknown>).source;
    const c = (item as Record<string, unknown>).currency;
    if (typeof s === "string" && s.trim()) {
      out.push({
        source: s.trim(),
        currency: typeof c === "string" && c.trim() ? c.trim().toUpperCase() : "USD",
      });
    }
  }
  return out;
}

/** Pure FIFO merge for tests and callers that already have outbox rows. */
export function mergeCategoryOutboxFifo(list: string[], rows: OutboxRow[]): string[] {
  let next = [...list];
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    const method = row.method.toUpperCase();
    const norm = normPath(row.url);
    if (method === "POST" && CAT_LIST.test(norm)) {
      const name = parseCategoryPostName(row.body);
      if (name && !next.some((c) => c.trim().toLowerCase() === name.toLowerCase())) {
        next.push(name);
      }
      continue;
    }
    if ((method === "POST" && TX_LIST.test(norm)) || (method === "PATCH" && TX_DETAIL.test(norm))) {
      for (const name of extractStringsFromTxBody(row.body, "category")) {
        if (!next.some((c) => c.trim().toLowerCase() === name.toLowerCase())) {
          next.push(name);
        }
      }
    }
    const patchMatch = row.url.split("?")[0].match(/^\/finance\/categories\/([^/]+)\/?$/);
    if (method === "PATCH" && patchMatch) {
      const oldName = decodeURIComponent(patchMatch[1]);
      const newName = parseCategoryPatchName(row.body) ?? oldName;
      next = next.map((c) => (c.trim().toLowerCase() === oldName.trim().toLowerCase() ? newName : c));
      continue;
    }
    const delMatch = row.url.split("?")[0].match(/^\/finance\/categories\/([^/]+)\/?$/);
    if (method === "DELETE" && delMatch) {
      const name = decodeURIComponent(delMatch[1]);
      next = next.filter((c) => c.trim().toLowerCase() !== name.trim().toLowerCase());
    }
  }
  return [...next].sort(sortStrings);
}

/** Merge queued category mutators into a name list (FIFO). */
export async function applyCategoryOutboxToList(base: string[]): Promise<string[]> {
  const rows = await listOutboxOrdered();
  return mergeCategoryOutboxFifo(base, rows);
}

function parseTagPostNames(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("tags" in body)) {
    return [];
  }
  const t = (body as { tags?: unknown }).tags;
  if (!Array.isArray(t)) {
    return [];
  }
  return t.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function parseTagPatchMap(body: unknown): Array<{ from: string; to: string }> {
  if (!body || typeof body !== "object" || !("tags" in body)) {
    return [];
  }
  const tags = (body as { tags?: unknown }).tags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return [];
  }
  const out: Array<{ from: string; to: string }> = [];
  for (const [from, to] of Object.entries(tags as Record<string, unknown>)) {
    if (typeof to === "string" && to.trim()) {
      out.push({ from: from.trim(), to: to.trim() });
    }
  }
  return out;
}

function parseTagDeleteNames(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("tags" in body)) {
    return [];
  }
  const tags = (body as { tags?: unknown }).tags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return [];
  }
  const out: string[] = [];
  for (const [name, action] of Object.entries(tags as Record<string, unknown>)) {
    if (String(action).toLowerCase() === "delete" && name.trim()) {
      out.push(name.trim());
    }
  }
  return out;
}

export function mergeTagOutboxFifo(list: string[], rows: OutboxRow[]): string[] {
  let next = [...list];
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    const method = row.method.toUpperCase();
    const norm = normPath(row.url);
    if ((method === "POST" && TX_LIST.test(norm)) || (method === "PATCH" && TX_DETAIL.test(norm))) {
      for (const name of extractTagsFromTxBody(row.body)) {
        if (!next.some((t) => t.toLowerCase() === name.toLowerCase())) {
          next.push(name);
        }
      }
    }
    if (!TAG_LIST.test(norm)) {
      continue;
    }
    if (method === "POST") {
      for (const name of parseTagPostNames(row.body)) {
        if (!next.some((t) => t.toLowerCase() === name.toLowerCase())) {
          next.push(name);
        }
      }
    } else if (method === "PATCH") {
      for (const { from, to } of parseTagPatchMap(row.body)) {
        next = next.map((t) => (t.toLowerCase() === from.toLowerCase() ? to : t));
      }
    } else if (method === "DELETE") {
      for (const name of parseTagDeleteNames(row.body)) {
        next = next.filter((t) => t.toLowerCase() !== name.toLowerCase());
      }
    }
  }
  return [...next].sort(sortStrings);
}

/** Merge queued tag mutators into a tag name list (FIFO). */
export async function applyTagOutboxToList(base: string[]): Promise<string[]> {
  const rows = await listOutboxOrdered();
  return mergeTagOutboxFifo(base, rows);
}

function sourceKey(s: string): string {
  return s.trim().toLowerCase();
}

export function mergeSourceOutboxFifo(list: SourceRow[], rows: OutboxRow[]): SourceRow[] {
  const byKey = new Map<string, SourceRow>();
  for (const r of list) {
    const k = sourceKey(r.source);
    if (k && k !== "unknown") {
      byKey.set(k, { ...r });
    }
  }
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    const method = row.method.toUpperCase();
    const pathRaw = row.url.split("?")[0];
    const norm = pathRaw.endsWith("/") || pathRaw.length === 0 ? pathRaw : `${pathRaw}/`;
    if (method === "POST" && SRC_LIST.test(norm)) {
      const patch = parseSourcePayload(row.body);
      if (patch?.source) {
        const k = sourceKey(patch.source);
        if (k && k !== "unknown") {
          byKey.set(k, {
            source: patch.source.trim(),
            acc_type: (patch.acc_type ?? "CHECKING").toString(),
            amount: String(patch.amount ?? "0"),
            currency: (patch.currency ?? "USD").toString().toUpperCase(),
          });
        }
      }
      continue;
    }
    if ((method === "POST" && TX_LIST.test(norm)) || (method === "PATCH" && TX_DETAIL.test(norm))) {
      for (const { source, currency } of extractSourcesFromTxBody(row.body)) {
        const k = sourceKey(source);
        if (k && k !== "unknown" && !byKey.has(k)) {
          byKey.set(k, {
            source,
            acc_type: "CHECKING",
            amount: "0",
            currency,
          });
        }
      }
    }
    const m = pathRaw.match(/^\/finance\/sources\/([^/]+)\/?$/);
    if (method === "PATCH" && m) {
      const current = decodeURIComponent(m[1]);
      const ck = sourceKey(current);
      const prev = byKey.get(ck);
      const patch = parseSourcePayload(row.body);
      if (prev && patch) {
        const nextName = patch.source?.trim() ? patch.source.trim() : prev.source;
        const nk = sourceKey(nextName);
        byKey.delete(ck);
        byKey.set(nk, {
          source: nextName,
          acc_type: patch.acc_type != null ? String(patch.acc_type).toUpperCase() : prev.acc_type,
          amount: patch.amount != null ? String(patch.amount) : prev.amount,
          currency: patch.currency != null ? String(patch.currency).toUpperCase() : prev.currency,
        });
      }
      continue;
    }
    const dm = pathRaw.match(/^\/finance\/sources\/([^/]+)\/?$/);
    if (method === "DELETE" && dm) {
      const name = decodeURIComponent(dm[1]);
      byKey.delete(sourceKey(name));
    }
  }
  return [...byKey.values()].sort(sortSources);
}

/** Merge queued source mutators into a source row list (FIFO). */
export async function applySourceOutboxToList(base: SourceRow[]): Promise<SourceRow[]> {
  const rows = await listOutboxOrdered();
  return mergeSourceOutboxFifo(base, rows);
}
