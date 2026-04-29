import { clsx } from "clsx";
import { useMemo, useState, type ReactNode } from "react";
import { useBreakpoint } from "../../lib/breakpoints";
import { EmptyState } from "./EmptyState";

export type ColumnDef<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number;
  /** Card row label (mobile) */
  mobileLabel?: string;
};

type Props<Row> = {
  columns: Array<ColumnDef<Row>>;
  data: Row[];
  keyField: keyof Row;
  className?: string;
  emptyTitle?: string;
  mobileBreakpoint?: "md" | "sm";
};

function compare(a: string | number, b: string | number, dir: "asc" | "desc"): number {
  if (a < b) {
    return dir === "asc" ? -1 : 1;
  }
  if (a > b) {
    return dir === "asc" ? 1 : -1;
  }
  return 0;
}

export function DataTable<Row extends object>({
  columns,
  data,
  keyField,
  className,
  emptyTitle = "No rows",
  mobileBreakpoint = "md",
}: Props<Row>): ReactNode {
  const { atOrAboveMd } = useBreakpoint();
  const mobile = mobileBreakpoint === "md" ? !atOrAboveMd : false; /* simplify: use md for collapse */

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const showTable = !mobile;
  const sorted = useMemo(() => {
    if (!sortCol) {
      return data;
    }
    const col = columns.find((c) => c.id === sortCol);
    if (!col?.sortValue) {
      return data;
    }
    const copy = [...data].sort((a, b) => compare(col.sortValue!(a), col.sortValue!(b), sortDir));
    return copy;
  }, [data, sortCol, sortDir, columns]);

  const onHeader = (c: ColumnDef<Row>): void => {
    if (!c.sortValue) {
      return;
    }
    if (sortCol === c.id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(c.id);
      setSortDir("asc");
    }
  };

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description="No data to display for this view." />;
  }

  if (!showTable) {
    return (
      <div className={clsx("data-table--mobile", className)}>
        {sorted.map((row, rowIndex) => {
          const k = `${String(row[keyField] ?? "row")}-${rowIndex}`;
          return (
            <div key={k} className="data-table__m-row">
              {columns.map((c) => (
                <div key={c.id} className="data-table__m-cell">
                  <span className="muted">{c.mobileLabel ?? c.header}</span>
                  <span>{c.cell(row)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className={clsx("data-table", className)} role="grid">
        <thead className="data-table__thead">
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                role="columnheader"
                scope="col"
                aria-sort={sortCol === c.id ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                {c.sortValue ? (
                  <button type="button" className="data-table__row-btn" onClick={() => onHeader(c)}>
                    {c.header}
                    {sortCol === c.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, rowIndex) => {
            const k = `${String(row[keyField] ?? "row")}-${rowIndex}`;
            return (
              <tr key={k}>
                {columns.map((c) => (
                  <td key={c.id}>{c.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
