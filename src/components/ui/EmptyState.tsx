import { clsx } from "clsx";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action, className }: Props): ReactNode {
  return (
    <div className={clsx("ui-state", className)} role="status">
      {title ? <h3 style={{ margin: "0 0 0.5rem" }}>{title}</h3> : null}
      {description ? <p className="muted-text">{description}</p> : null}
      {action}
    </div>
  );
}
