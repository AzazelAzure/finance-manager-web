import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

export function Card({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}): ReactNode {
  return (
    <div className={clsx("ui-card", className)} style={style}>
      {children}
    </div>
  );
}
