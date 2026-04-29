import { clsx } from "clsx";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ title, description, onRetry, className }: Props): ReactNode {
  return (
    <div className={clsx("ui-state", "ui-state--error", className)} role="alert">
      {title ? <h3 style={{ margin: "0 0 0.5rem" }}>{title}</h3> : null}
      {description ? <p className="muted-text">{description}</p> : null}
      {onRetry ? <button className="ui-btn ui-btn--secondary" onClick={onRetry} type="button">Retry</button> : null}
    </div>
  );
}
