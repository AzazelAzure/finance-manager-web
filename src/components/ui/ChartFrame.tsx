import { clsx } from "clsx";
import { type ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { Card } from "./Card";

type Props = {
  title?: string;
  loading?: boolean;
  isEmpty?: boolean;
  children: ReactNode;
  className?: string;
  emptyText?: string;
  heightRem?: number;
  "aria-label"?: string;
};

export function ChartFrame({
  title,
  loading,
  isEmpty,
  children,
  className,
  emptyText = "No data",
  heightRem = 16,
  "aria-label": aria,
}: Props): ReactNode {
  if (loading) {
    return (
      <Card className={className}>
        {title ? <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>{title}</h3> : null}
        <div
          className="ui-chart-frame ui-chart-frame--loading"
          style={{ minHeight: `${heightRem}rem` }}
        >
          <Skeleton style={{ width: "100%", minHeight: `${heightRem}rem` }} />
        </div>
      </Card>
    );
  }
  if (isEmpty) {
    return (
      <Card className={className}>
        {title ? <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>{title}</h3> : null}
        <div className="ui-chart-frame ui-chart-frame--empty" role="img" aria-label={aria ?? title ?? "Chart empty"}>
          <EmptyState title="No data" description={emptyText} />
        </div>
      </Card>
    );
  }
  return (
    <Card className={className}>
      {title ? <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>{title}</h3> : null}
      <div
        className={clsx("ui-chart-frame")}
        style={{ minHeight: `${heightRem}rem` }}
        role="img"
        aria-label={aria ?? title}
      >
        {children}
      </div>
    </Card>
  );
}
