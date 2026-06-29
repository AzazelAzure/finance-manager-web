import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "ui-btn",
  secondary: "ui-btn ui-btn--secondary",
  ghost: "ui-btn ui-btn--ghost",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "",
  compact: "ui-btn--compact",
};

export type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "compact";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "default", children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
});
