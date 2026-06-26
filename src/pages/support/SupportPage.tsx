import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppForm } from "../../components/Form/FormProvider";
import { SelectField } from "../../components/Form/SelectField";
import { TextField } from "../../components/Form/TextField";
import { TextAreaField } from "../../components/Form/TextAreaField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { SuccessState } from "../../components/ui/SuccessState";
import { TabPanel, Tabs } from "../../components/ui/Tabs";
import { getAppProfile } from "../../api/profile";
import { tr, useLocale } from "../../lib/i18n";
import { api } from "../../api/client";
import { readOptsFromQuery } from "../../offline/pwaReadBypass";

function parseApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (Array.isArray(data)) {
    return status ? `HTTP ${status}: ${data.join(" | ")}` : data.join(" | ");
  }
  if (data && typeof data === "object") {
    const parts = Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
    if (parts.length > 0) {
      return status ? `HTTP ${status}: ${parts.join(" | ")}` : parts.join(" | ");
    }
  }
  if (typeof data === "string" && data.trim()) {
    return status ? `HTTP ${status}: ${data}` : data;
  }
  return status ? `HTTP ${status}: Request rejected.` : error.message;
}

export function SupportPage(): ReactNode {
  const locale = useLocale();
  const [bugMessage, setBugMessage] = useState("");
  const [featureMessage, setFeatureMessage] = useState("");
  const [bugSuccess, setBugSuccess] = useState(false);
  const [featureSuccess, setFeatureSuccess] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", "settings"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });

  const featureRequestsEnabled = profileQuery.data?.feature_requests_enabled ?? false;

  const bugForm = useForm({
    resolver: zodResolver(
      z.object({
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        nature: z.string().min(1, tr("support.natureRequired", locale)).max(150, tr("support.natureRequired", locale)),
        comment: z.string().min(10, tr("support.commentRequired", locale)),
      })
    ),
    defaultValues: {
      severity: "MEDIUM" as const,
      nature: "",
      comment: "",
    },
  });

  const featureForm = useForm({
    resolver: zodResolver(
      z.object({
        nature: z.string().min(1, tr("support.natureRequired", locale)).max(150, tr("support.natureRequired", locale)),
        comment: z.string().min(10, tr("support.commentRequired", locale)),
      })
    ),
    defaultValues: {
      nature: "",
      comment: "",
    },
  });

  const bugMutation = useMutation({
    mutationFn: async (values: { severity: string; nature: string; comment: string }) => {
      const payload = {
        report_type: "BUG",
        severity: values.severity,
        nature: values.nature,
        comment: values.comment,
      };
      const res = await api.post("/finance/support/tickets/", payload);
      return res.data;
    },
    onSuccess: () => {
      setBugSuccess(true);
      setBugMessage(tr("support.successBug", locale));
      bugForm.reset();
    },
    onError: (error) => {
      setBugSuccess(false);
      setBugMessage(parseApiError(error));
    },
  });

  const featureMutation = useMutation({
    mutationFn: async (values: { nature: string; comment: string }) => {
      const payload = {
        report_type: "FEATURE",
        nature: values.nature,
        comment: values.comment,
      };
      const res = await api.post("/finance/support/tickets/", payload);
      return res.data;
    },
    onSuccess: () => {
      setFeatureSuccess(true);
      setFeatureMessage(tr("support.successFeature", locale));
      featureForm.reset();
    },
    onError: (error) => {
      setFeatureSuccess(false);
      setFeatureMessage(parseApiError(error));
    },
  });

  if (profileQuery.isLoading) {
    return <LoadingState label={tr("settings.loading", locale)} />;
  }

  if (profileQuery.isError) {
    return <ErrorState title={tr("settings.failed", locale)} onRetry={() => void profileQuery.refetch()} />;
  }

  return (
    <div className="stack">
      <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
        {tr("support.title", locale)}
      </h2>

      <Tabs
        tabs={[
          {
            id: "bug",
            label: tr("support.bugReport", locale),
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {bugMessage ? (
                  bugSuccess ? (
                    <SuccessState message={bugMessage} />
                  ) : (
                    <ErrorState title={tr("settings.couldNotSave", locale)} description={bugMessage} />
                  )
                ) : null}
                <Card>
                  <AppForm
                    form={bugForm}
                    onSubmit={(v) => {
                      setBugMessage("");
                      bugMutation.mutate(v);
                    }}
                    className="stack"
                  >
                    <SelectField
                      name="severity"
                      label={tr("support.severityLabel", locale)}
                      options={[
                        { value: "LOW", label: tr("support.severityLow", locale) },
                        { value: "MEDIUM", label: tr("support.severityMedium", locale) },
                        { value: "HIGH", label: tr("support.severityHigh", locale) },
                      ]}
                    />
                    <TextField name="nature" label={tr("support.natureLabel", locale)} />
                    <TextAreaField name="comment" label={tr("support.commentLabel", locale)} rows={5} />
                    <Button type="submit" disabled={bugMutation.isPending}>
                      {bugMutation.isPending ? tr("support.submitting", locale) : tr("support.submit", locale)}
                    </Button>
                  </AppForm>
                </Card>
              </TabPanel>
            ),
          },
          {
            id: "feature",
            label: tr("support.featureRequest", locale),
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {!featureRequestsEnabled ? (
                  <Card>
                    <p className="muted-text" style={{ margin: 0 }}>
                      {tr("support.gatedMessage", locale)}
                    </p>
                  </Card>
                ) : (
                  <>
                    {featureMessage ? (
                      featureSuccess ? (
                        <SuccessState message={featureMessage} />
                      ) : (
                        <ErrorState title={tr("settings.couldNotSave", locale)} description={featureMessage} />
                      )
                    ) : null}
                    <Card>
                      <AppForm
                        form={featureForm}
                        onSubmit={(v) => {
                          setFeatureMessage("");
                          featureMutation.mutate(v);
                        }}
                        className="stack"
                      >
                        <TextField name="nature" label={tr("support.natureLabel", locale)} />
                        <TextAreaField name="comment" label={tr("support.commentLabel", locale)} rows={5} />
                        <Button type="submit" disabled={featureMutation.isPending}>
                          {featureMutation.isPending ? tr("support.submitting", locale) : tr("support.submit", locale)}
                        </Button>
                      </AppForm>
                    </Card>
                  </>
                )}
              </TabPanel>
            ),
          },
        ]}
      />
    </div>
  );
}
