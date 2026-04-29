import { clsx } from "clsx";
import { type ReactNode, useId, useState } from "react";
import { Button } from "../ui/Button";
import type { DashboardFilterDraft, PeriodPreset, TxTypeFilter } from "../../lib/dashboardQueryParams";

const periods: { id: PeriodPreset; label: string }[] = [
  { id: "current", label: "Current month" },
  { id: "last", label: "Last month" },
  { id: "week", label: "Previous week" },
  { id: "custom", label: "Custom range" },
];

const txOptions: { id: TxTypeFilter; label: string }[] = [
  { id: "", label: "All" },
  { id: "INCOME", label: "Income" },
  { id: "EXPENSE", label: "Expense" },
  { id: "XFER_IN", label: "Transfer in" },
  { id: "XFER_OUT", label: "Transfer out" },
];

type Props = {
  initialDraft: DashboardFilterDraft;
  onApply: (d: DashboardFilterDraft) => void;
  onRefresh: () => void;
  onReset: () => void;
  topTagNames: string[];
  allTagNames: string[];
  categoryNames: string[];
  sourceNames: string[];
  currencyOptions: string[];
  isRefetching: boolean;
};

export function FilterRow({
  initialDraft,
  onApply,
  onRefresh,
  onReset,
  topTagNames,
  allTagNames,
  categoryNames,
  sourceNames,
  currencyOptions,
  isRefetching,
}: Props): ReactNode {
  const [draft, setDraft] = useState(() => initialDraft);
  const baseId = useId();
  const customValid = draft.period !== "custom" || (Boolean(draft.startDate) && Boolean(draft.endDate));
  return (
    <div className="filter-row" role="region" aria-label="Dashboard filters (apply to reload data)">
      <div className="filter-row__group">
        <p className="filter-row__label" id={baseId + "p"}>
          Period
        </p>
        <div className="filter-chips" role="group" aria-labelledby={baseId + "p"}>
          {periods.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft((d) => ({ ...d, period: p.id }));
              }}
              aria-pressed={draft.period === p.id}
              className={clsx("filter-chip", draft.period !== p.id && "filter-chip--off")}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {draft.period === "custom" ? (
          <div className="filter-row__dates" style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="ui-field">
              <label className="ui-label" htmlFor={baseId + "sd"}>
                Start
              </label>
              <input
                id={baseId + "sd"}
                className="ui-input"
                type="date"
                value={draft.startDate}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, startDate: e.target.value }));
                }}
              />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor={baseId + "ed"}>
                End
              </label>
              <input
                id={baseId + "ed"}
                className="ui-input"
                type="date"
                value={draft.endDate}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, endDate: e.target.value }));
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="filter-row__group" style={{ marginTop: 12 }}>
        <p className="filter-row__label" id={baseId + "t"}>
          Type
        </p>
        <div className="filter-chips" role="group" aria-labelledby={baseId + "t"}>
          {txOptions.map((o) => (
            <Button
              key={o.id || "all"}
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft((d) => ({ ...d, txType: o.id }));
              }}
              aria-pressed={draft.txType === o.id}
              className={clsx("filter-chip", draft.txType !== o.id && o.id && "filter-chip--off")}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      {topTagNames.length > 0 ? (
        <div className="filter-row__group" style={{ marginTop: 12 }}>
          <p className="filter-row__label" id={baseId + "g"}>
            Top tags
          </p>
          <div className="filter-chips" role="group" aria-labelledby={baseId + "g"}>
            {topTagNames.map((t) => (
              <Button
                key={t}
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft((d) => ({ ...d, tagName: d.tagName === t ? "" : t }));
                }}
                aria-pressed={draft.tagName === t}
                className={clsx("filter-chip", draft.tagName !== t && "filter-chip--off")}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <details className="filter-advanced" style={{ marginTop: 12 }}>
        <summary className="filter-advanced__summary">Advanced filters</summary>
        <div
          className="filter-advanced__grid"
          style={{ display: "grid", gap: 8, marginTop: 8, maxWidth: 480 }}
        >
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "tag"}>
              Tag
            </label>
            <input
              id={baseId + "tag"}
              className="ui-input"
              value={draft.tagName}
              list={baseId + "taglist"}
              onChange={(e) => {
                setDraft((d) => ({ ...d, tagName: e.target.value }));
              }}
              autoComplete="off"
            />
            <datalist id={baseId + "taglist"}>
              {allTagNames.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "cat"}>
              Category
            </label>
            <select
              id={baseId + "cat"}
              className="ui-input"
              value={draft.category}
              onChange={(e) => {
                setDraft((d) => ({ ...d, category: e.target.value }));
              }}
            >
              <option value="">Any</option>
              {categoryNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "src"}>
              Source
            </label>
            <select
              id={baseId + "src"}
              className="ui-input"
              value={draft.source}
              onChange={(e) => {
                setDraft((d) => ({ ...d, source: e.target.value }));
              }}
            >
              <option value="">Any</option>
              {sourceNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "ccy"}>
              Currency
            </label>
            <select
              id={baseId + "ccy"}
              className="ui-input"
              value={draft.currency}
              onChange={(e) => {
                setDraft((d) => ({ ...d, currency: e.target.value }));
              }}
            >
              <option value="">Any</option>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div className="filter-row__actions" style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Button
          type="button"
          onClick={() => {
            onApply(draft);
          }}
          disabled={!customValid}
        >
          Apply
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefetching}
        >
          {isRefetching ? "Refreshing…" : "Refresh"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
