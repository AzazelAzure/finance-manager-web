import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }): ReactNode {
  return <div className={clsx("ui-skeleton", className)} style={style} role="status" aria-busy="true" />;
}
