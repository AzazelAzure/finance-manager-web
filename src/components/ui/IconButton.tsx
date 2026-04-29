import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Props = { "aria-label": string; children: ReactNode; className?: string } & ButtonHTMLAttributes<
  HTMLButtonElement
>;

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx("ui-icon-btn", className)} {...rest}>
      {children}
    </button>
  );
});
