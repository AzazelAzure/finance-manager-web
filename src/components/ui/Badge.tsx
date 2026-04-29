import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Badge({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return <span className={clsx("ui-badge", className)}>{children}</span>;
}
