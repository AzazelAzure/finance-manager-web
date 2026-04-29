import { clsx } from "clsx";
import { type ReactNode, useId, useState } from "react";
import { Button } from "../ui/Button";
import type { DashboardFilterDraft, PeriodPreset, TxTypeFilter } from "../../lib/dashboardQueryParams";
import { tr, useLocale } from "../../lib/i18n";

const periods: { id: PeriodPreset }[] = [
  { id: "current" },
  { id: "last" },
  { id: "week" },
  { id: "custom" },
];

const txOptions: { id: TxTypeFilter }[] = [
  { id: "" },
  { id: "INCOME" },
  { id: "EXPENSE" },
  { id: "XFER_IN" },
  { id: "XFER_OUT" },
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
  const locale = useLocale();
  const [draft, setDraft] = useState(() => initialDraft);
  const baseId = useId();
  const customValid = draft.period !== "custom" || (Boolean(draft.startDate) && Boolean(draft.endDate));
  return (
    <div className="filter-row" role="region" aria-label={tr("dashboard.filters.aria", locale)}>
      <div className="filter-row__group">
        <p className="filter-row__label" id={baseId + "p"}>
          {tr("dashboard.filters.period", locale)}
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
              {tr(
                p.id === "current"
                  ? "dashboard.filters.period.current"
                  : p.id === "last"
                    ? "dashboard.filters.period.last"
                    : p.id === "week"
                      ? "dashboard.filters.period.week"
                      : "dashboard.filters.period.custom",
                locale,
              )}
            </Button>
          ))}
        </div>
        {draft.period === "custom" ? (
          <div className="filter-row__dates" style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="ui-field">
              <label className="ui-label" htmlFor={baseId + "sd"}>
                {tr("dashboard.filters.start", locale)}
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
                {tr("dashboard.filters.end", locale)}
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
          {tr("dashboard.filters.type", locale)}
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
              {tr(
                o.id === ""
                  ? "dashboard.filters.type.all"
                  : o.id === "INCOME"
                    ? "dashboard.filters.type.income"
                    : o.id === "EXPENSE"
                      ? "dashboard.filters.type.expense"
                      : o.id === "XFER_IN"
                        ? "dashboard.filters.type.xferIn"
                        : "dashboard.filters.type.xferOut",
                locale,
              )}
            </Button>
          ))}
        </div>
      </div>

      {topTagNames.length > 0 ? (
        <div className="filter-row__group" style={{ marginTop: 12 }}>
          <p className="filter-row__label" id={baseId + "g"}>
            {tr("dashboard.filters.topTags", locale)}
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
        <summary className="filter-advanced__summary">{tr("dashboard.filters.advanced", locale)}</summary>
        <div
          className="filter-advanced__grid"
          style={{ display: "grid", gap: 8, marginTop: 8, maxWidth: 480 }}
        >
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "tag"}>
              {tr("dashboard.filters.tag", locale)}
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
              {tr("dashboard.filters.category", locale)}
            </label>
            <select
              id={baseId + "cat"}
              className="ui-input"
              value={draft.category}
              onChange={(e) => {
                setDraft((d) => ({ ...d, category: e.target.value }));
              }}
            >
              <option value="">{tr("dashboard.filters.any", locale)}</option>
              {categoryNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "src"}>
              {tr("dashboard.filters.source", locale)}
            </label>
            <select
              id={baseId + "src"}
              className="ui-input"
              value={draft.source}
              onChange={(e) => {
                setDraft((d) => ({ ...d, source: e.target.value }));
              }}
            >
              <option value="">{tr("dashboard.filters.any", locale)}</option>
              {sourceNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor={baseId + "ccy"}>
              {tr("dashboard.filters.currency", locale)}
            </label>
            <select
              id={baseId + "ccy"}
              className="ui-input"
              value={draft.currency}
              onChange={(e) => {
                setDraft((d) => ({ ...d, currency: e.target.value }));
              }}
            >
              <option value="">{tr("dashboard.filters.any", locale)}</option>
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
          {tr("dashboard.filters.apply", locale)}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefetching}
        >
          {isRefetching ? tr("dashboard.filters.refreshing", locale) : tr("dashboard.filters.refresh", locale)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
        >
          {tr("dashboard.filters.reset", locale)}
        </Button>
      </div>
    </div>
  );
}
