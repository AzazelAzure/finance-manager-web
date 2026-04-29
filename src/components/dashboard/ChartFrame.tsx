import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";

type Props = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  ariaLabel: string;
  minHeight?: number;
};

export function ChartFrame({
  title,
  actions,
  children,
  className,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle = "No data for this range",
  emptyDescription,
  ariaLabel,
  minHeight = 240,
}: Props): ReactNode {
  return (
    <Card className={clsx("dashboard-card", className)} style={{ minHeight: minHeight + 80 }}>
      <div
        className="row-between"
        style={{ marginBottom: "0.5rem" }}
        role="group"
        aria-label={ariaLabel}
      >
        <h3 className="muted" style={{ margin: 0, fontSize: "var(--font-md)" }}>
          {title}
        </h3>
        {actions ? <div className="dashboard-card__actions">{actions}</div> : null}
      </div>
      <div
        className="chart-wrap"
        style={{ minHeight, position: "relative" }}
        aria-label={ariaLabel}
      >
        {isError ? <ErrorState title="Chart failed" onRetry={onRetry} description="Check network and try again." /> : null}
        {!isError && isLoading ? <Skeleton style={{ width: "100%", height: minHeight, minHeight }} /> : null}
        {!isError && !isLoading && isEmpty ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
        {!isError && !isLoading && !isEmpty ? children : null}
      </div>
    </Card>
  );
}
