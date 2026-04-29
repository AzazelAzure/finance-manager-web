import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }): ReactNode {
  return <div className={clsx("ui-card", className)}>{children}</div>;
}
