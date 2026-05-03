import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { createCategory, createSource, listCategories, listSourceNames } from "../../api/lookups";
import { updateAppProfile } from "../../api/profile";
import { createTransactions } from "../../api/transactions";
import { isOfflineQueued } from "../../api/types";
import { AppForm } from "../../components/Form/FormProvider";
import { SelectField } from "../../components/Form/SelectField";
import { TextField } from "../../components/Form/TextField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import {
  clearForceOnboardingNextLogin,
  earliestIncompleteOnboardingPath,
  getOnboardingProgress,
  setOnboardingProgress,
} from "../../state/onboarding";
import { tr, useLocale } from "../../lib/i18n";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";

type Step = 1 | 2 | 3 | 4;

const step1Schema = z.object({
  base_currency: z.string().length(3, "Use a 3-letter code"),
  timezone: z.string().min(1, "Timezone is required"),
  start_week: z.enum(["0", "1"]),
});
const step2Schema = z.object({
  source: z.string().min(1, "Source name is required"),
  acc_type: z.string().min(1, "Account type is required"),
  amount: z.string(),
  currency: z.string().length(3, "Use a 3-letter currency"),
});
const step3Schema = z.object({
  category: z.string().min(1, "Category name is required"),
});
const step4Schema = z.object({
  create_first_tx: z.boolean(),
  tx_amount: z.string(),
  tx_source: z.string(),
  tx_currency: z.string().length(3).optional(),
  tx_type: z.enum(["EXPENSE", "INCOME"]),
  tx_category: z.string(),
  tx_description: z.string(),
});

type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;
type Step3Form = z.infer<typeof step3Schema>;
type Step4Form = z.infer<typeof step4Schema>;

function parseApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (data && typeof data === "object") {
    const parts = Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
    if (parts.length > 0) return status ? `HTTP ${status}: ${parts.join(" | ")}` : parts.join(" | ");
  }
  return status ? `HTTP ${status}: Request rejected.` : error.message;
}

const STEP_LABELS: Record<Step, string> = {
  1: "Profile preferences",
  2: "First source",
  3: "First category",
  4: "Review",
};

function timezoneOptions(): Array<{ value: string; label: string }> {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  const preferred = "America/Chicago";
  const values = zones.includes(preferred) ? [preferred, ...zones.filter((z) => z !== preferred)] : [preferred, ...zones];
  return values.map((z) => ({ value: z, label: z }));
}

export function OnboardingPage({ step }: { step: Step }): ReactNode {
  const locale = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const progress = getOnboardingProgress();
  const expectedPath = earliestIncompleteOnboardingPath(progress);
  const currentPath = step === 1 ? "/app/onboarding" : step === 2 ? "/app/onboarding/sources" : step === 3 ? "/app/onboarding/categories" : "/app/onboarding/review";

  const sourcesQuery = useQuery({
    queryKey: ["lookups", "sources"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
    enabled: step === 4,
  });
  const categoriesQuery = useQuery({
    queryKey: ["lookups", "categories"] as const,
    queryFn: (ctx) => listCategories(readOptsFromQuery(ctx)),
    enabled: step === 4,
  });

  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { base_currency: "USD", timezone: "America/Chicago", start_week: "1" },
  });
  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { source: "", acc_type: "CHECKING", amount: "0.00", currency: "USD" },
  });
  const step3Form = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
    defaultValues: { category: "" },
  });
  const step4Form = useForm<Step4Form>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      create_first_tx: false,
      tx_amount: "0.00",
      tx_source: "",
      tx_currency: "USD",
      tx_type: "EXPENSE",
      tx_category: "",
      tx_description: "",
    },
  });
  const createFirstTx = useWatch({ control: step4Form.control, name: "create_first_tx" });

  useEffect(() => {
    if (step === 4) {
      const firstSource = sourcesQuery.data?.[0]?.source ?? "";
      const firstCategory = categoriesQuery.data?.[0] ?? "";
      if (firstSource) step4Form.setValue("tx_source", firstSource);
      if (firstCategory) step4Form.setValue("tx_category", firstCategory);
    }
  }, [categoriesQuery.data, sourcesQuery.data, step, step4Form]);

  const step1Mutation = useMutation({
    mutationFn: (values: Step1Form) =>
      updateAppProfile({
        spend_accounts: [],
        base_currency: values.base_currency.toUpperCase(),
        timezone: values.timezone,
        start_week: Number(values.start_week),
      }),
    onSuccess: () => {
      setOnboardingProgress({ profile_preferences_saved: true });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      navigate("/app/onboarding/sources");
    },
    onError: (err) => setError(parseApiError(err)),
  });

  const step2Mutation = useMutation({
    mutationFn: (values: Step2Form) =>
      createSource({
        source: values.source.trim(),
        acc_type: values.acc_type.toUpperCase(),
        amount: values.amount,
        currency: values.currency.toUpperCase(),
      }),
    onSuccess: () => {
      setOnboardingProgress({ source_added: true });
      void queryClient.invalidateQueries({ queryKey: ["lookups"] });
      navigate("/app/onboarding/categories");
    },
    onError: (err) => setError(parseApiError(err)),
  });

  const step3Mutation = useMutation({
    mutationFn: (values: Step3Form) => createCategory(values.category.trim()),
    onSuccess: () => {
      setOnboardingProgress({ category_added: true });
      void queryClient.invalidateQueries({ queryKey: ["lookups"] });
      navigate("/app/onboarding/review");
    },
    onError: (err) => setError(parseApiError(err)),
  });

  const step4Mutation = useMutation({
    mutationFn: async (values: Step4Form) => {
      if (!values.create_first_tx) return;
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        amount: values.tx_amount,
        source: values.tx_source,
        currency: (values.tx_currency || "USD").toUpperCase(),
        tx_type: values.tx_type,
        description: values.tx_description.trim(),
        ...(values.tx_category.trim() ? { category: values.tx_category.trim() } : {}),
      };
      const created = await createTransactions(payload);
      if (isOfflineQueued(created)) {
        return;
      }
    },
    onSuccess: () => {
      clearForceOnboardingNextLogin();
      setOnboardingProgress({
        profile_preferences_saved: true,
        source_added: true,
        category_added: true,
        onboarding_completed: true,
      });
      navigate("/app/dashboard");
    },
    onError: (err) => setError(parseApiError(err)),
  });

  const progressLabel = `Step ${step}/4 — ${STEP_LABELS[step]}`;
  const barWidth = `${step * 25}%`;
  const timezoneSelectOptions = timezoneOptions();

  if (expectedPath === "/app/dashboard") {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (step > 1 && expectedPath !== currentPath) {
    return <Navigate to={expectedPath} replace />;
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("onboarding.title", locale)}
        </h2>
        <span className="muted-text">{progressLabel}</span>
        <div style={{ height: 8, borderRadius: 999, background: "var(--border)" }}>
          <div style={{ width: barWidth, height: "100%", borderRadius: 999, background: "var(--brand)" }} />
        </div>
      </div>

      {error ? <ErrorState title={tr("onboarding.stepFailed", locale)} description={error} /> : null}

      {step === 1 ? (
        <Card>
          <AppForm
            form={step1Form}
            onSubmit={(v) => {
              setError("");
              step1Mutation.mutate(v);
            }}
            className="stack"
          >
            <TextField name="base_currency" label="Base currency" />
            <SelectField name="timezone" label="Timezone" options={timezoneSelectOptions} />
            <SelectField
              name="start_week"
              label="Start of week"
              options={[
                { value: "0", label: "Sunday" },
                { value: "1", label: "Monday" },
              ]}
            />
            <Button type="submit" disabled={step1Mutation.isPending}>
              {step1Mutation.isPending ? tr("common.saving", locale) : tr("common.continue", locale)}
            </Button>
          </AppForm>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <AppForm
            form={step2Form}
            onSubmit={(v) => {
              setError("");
              step2Mutation.mutate(v);
            }}
            className="stack"
          >
            <TextField name="source" label="Source name" />
            <SelectField
              name="acc_type"
              label="Account type"
              options={[
                { value: "CHECKING", label: "Checking" },
                { value: "SAVINGS", label: "Savings" },
                { value: "CASH", label: "Cash" },
                { value: "EWALLET", label: "E-wallet" },
                { value: "INVESTMENT", label: "Investment" },
              ]}
            />
            <TextField name="amount" label="Starting balance" />
            <TextField name="currency" label="Currency" />
            <Button type="submit" disabled={step2Mutation.isPending}>
              {step2Mutation.isPending ? tr("common.saving", locale) : tr("common.continue", locale)}
            </Button>
          </AppForm>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <AppForm
            form={step3Form}
            onSubmit={(v) => {
              setError("");
              step3Mutation.mutate(v);
            }}
            className="stack"
          >
            <TextField name="category" label="Category name" />
            <Button type="submit" disabled={step3Mutation.isPending}>
              {step3Mutation.isPending ? tr("common.saving", locale) : tr("common.continue", locale)}
            </Button>
          </AppForm>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <AppForm
            form={step4Form}
            onSubmit={(v) => {
              setError("");
              step4Mutation.mutate(v);
            }}
            className="stack"
          >
            <Button
              type="button"
              variant={createFirstTx ? "primary" : "secondary"}
              style={{ width: "100%", minHeight: 46 }}
              onClick={() => step4Form.setValue("create_first_tx", !createFirstTx)}
            >
              {createFirstTx ? tr("onboarding.createFirst.enabled", locale) : tr("onboarding.createFirst", locale)}
            </Button>
            {createFirstTx ? (
              <>
                <TextField name="tx_amount" label="Amount" />
                <SelectField
                  name="tx_source"
                  label="Source"
                  options={(sourcesQuery.data ?? []).map((s) => ({ value: s.source, label: s.source }))}
                />
                <TextField name="tx_currency" label="Currency" />
                <SelectField
                  name="tx_type"
                  label="Type"
                  options={[
                    { value: "EXPENSE", label: "Expense" },
                    { value: "INCOME", label: "Income" },
                  ]}
                />
                <SelectField
                  name="tx_category"
                  label="Category"
                  options={(categoriesQuery.data ?? []).map((c) => ({ value: c, label: c }))}
                />
                <TextField name="tx_description" label="Description (optional)" />
              </>
            ) : null}
            <Button type="submit" disabled={step4Mutation.isPending}>
              {step4Mutation.isPending ? tr("onboarding.finishing", locale) : tr("onboarding.finish", locale)}
            </Button>
          </AppForm>
        </Card>
      ) : null}

      <p className="muted-text" style={{ margin: 0 }}>
        <Link
          to="/app/dashboard"
          onClick={() => {
            clearForceOnboardingNextLogin();
            setOnboardingProgress({
              profile_preferences_saved: true,
              source_added: true,
              category_added: true,
              onboarding_completed: true,
            });
          }}
        >
          {tr("onboarding.skip", locale)}
        </Link>
      </p>
    </div>
  );
}
