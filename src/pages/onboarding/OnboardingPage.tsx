import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { createSource } from "../../api/lookups";
import { updateAppProfile } from "../../api/profile";
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
import { detectBrowserTimezone } from "../../lib/timezones";
import { SOURCE_ACCOUNT_TYPE_OPTIONS } from "../../lib/sourceAccountTypes";

type Step = 1 | 2 | 3 | 4;

const step1Schema = z.object({
  base_currency: z.string().length(3, "Use a 3-letter code"),
});
const step2Schema = z.object({
  source: z.string().min(1, "Source name is required"),
  acc_type: z.string().min(1, "Account type is required"),
  amount: z.string(),
  currency: z.string().length(3, "Use a 3-letter currency"),
});

type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;

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

const STEP_LABELS: Record<1 | 2, string> = {
  1: "Base currency",
  2: "First payment source",
};

export function OnboardingPage({ step }: { step: Step }): ReactNode {
  const locale = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const progress = getOnboardingProgress();
  const expectedPath = earliestIncompleteOnboardingPath(progress);
  const currentPath = step === 1 ? "/app/onboarding" : "/app/onboarding/sources";
  const activeStep: 1 | 2 = step === 1 ? 1 : 2;

  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { base_currency: "USD" },
  });
  const step2Form = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { source: "", acc_type: "CHECKING", amount: "0.00", currency: "USD" },
  });

  const step1Mutation = useMutation({
    mutationFn: (values: Step1Form) =>
      updateAppProfile({
        spend_accounts: [],
        base_currency: values.base_currency.toUpperCase(),
        timezone: detectBrowserTimezone(),
        start_week: 1,
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
      clearForceOnboardingNextLogin();
      setOnboardingProgress({
        profile_preferences_saved: true,
        source_added: true,
        onboarding_completed: true,
      });
      void queryClient.invalidateQueries({ queryKey: ["lookups"] });
      navigate("/app/dashboard");
    },
    onError: (err) => setError(parseApiError(err)),
  });

  const progressLabel = `Step ${activeStep}/2 — ${STEP_LABELS[activeStep]}`;
  const barWidth = `${activeStep * 50}%`;

  if (expectedPath === "/app/dashboard") {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (step > 2) {
    return <Navigate to={expectedPath} replace />;
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
            <TextField name="base_currency" label={tr("form.label.baseCurrency", locale)} autoFocus />
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
            <TextField name="source" label={tr("form.label.sourceName", locale)} autoFocus />
            <SelectField
              name="acc_type"
              label={tr("form.label.accountType", locale)}
              options={SOURCE_ACCOUNT_TYPE_OPTIONS}
            />
            <TextField name="amount" label={tr("form.label.startingBalance", locale)} />
            <TextField name="currency" label={tr("form.label.currency", locale)} />
            <Button type="submit" disabled={step2Mutation.isPending}>
              {step2Mutation.isPending ? tr("onboarding.finishing", locale) : tr("onboarding.finish", locale)}
            </Button>
          </AppForm>
        </Card>
      ) : null}

      {/* TODO: wizard-expansion — category + first-transaction steps (formerly steps 3–4) */}

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
