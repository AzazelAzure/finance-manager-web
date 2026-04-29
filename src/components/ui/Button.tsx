import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "ui-btn",
  secondary: "ui-btn ui-btn--secondary",
  ghost: "ui-btn ui-btn--ghost",
};

export type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(variants[variant], className)} {...rest}>
      {children}
    </button>
  );
});
