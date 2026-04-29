import { FormProvider as RHFFormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { ReactNode } from "react";

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => void;
  className?: string;
  children: ReactNode;
  id?: string;
  /** Default `off` to reduce browser password-manager autofill before first interaction. */
  autoComplete?: string;
};

export function AppForm<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  id,
  autoComplete = "off",
}: Props<T>): ReactNode {
  return (
    <RHFFormProvider {...form}>
      <form
        id={id}
        className={className}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        autoComplete={autoComplete}
      >
        {children}
      </form>
    </RHFFormProvider>
  );
}
