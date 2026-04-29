import { FormProvider as RHFFormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { ReactNode } from "react";

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => void;
  className?: string;
  children: ReactNode;
  id?: string;
};

export function AppForm<T extends FieldValues>({ form, onSubmit, children, className, id }: Props<T>): ReactNode {
  return (
    <RHFFormProvider {...form}>
      <form id={id} className={className} onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {children}
      </form>
    </RHFFormProvider>
  );
}
