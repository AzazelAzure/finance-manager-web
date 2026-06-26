import { clsx } from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

export type InputProps = {
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx("ui-input", className)} {...rest} />;
});
