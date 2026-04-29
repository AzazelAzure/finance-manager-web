import { clsx } from "clsx";
import { Skeleton } from "./Skeleton";
import type { ReactNode } from "react";

type Props = { label?: string; className?: string };

export function LoadingState({ label, className }: Props): ReactNode {
  return (
    <div className={clsx("ui-state", className)} role="status" aria-busy="true">
      {label ? <p className="muted-text">{label}</p> : null}
      <Skeleton style={{ width: "100%", height: "0.5rem" }} />
    </div>
  );
}
