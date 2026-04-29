import { clsx } from "clsx";
import type { ReactNode } from "react";

type Props = { message: string; className?: string };

export function SuccessState({ message, className }: Props): ReactNode {
  return (
    <div className={clsx("ui-state", "ui-state--ok", className)} role="status">
      {message}
    </div>
  );
}
