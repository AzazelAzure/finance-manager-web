import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppForm } from "../../components/Form/FormProvider";
import { SelectField } from "../../components/Form/SelectField";
import { TextField } from "../../components/Form/TextField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { KPI } from "../../components/ui/KPI";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { SuccessState } from "../../components/ui/SuccessState";
import { TabPanel, Tabs } from "../../components/ui/Tabs";
import { listSourceNames } from "../../api/lookups";
import { getAppProfile, updateAppProfile } from "../../api/profile";
import { fetchAppSnapshot } from "../../api/snapshot";
import { deleteCurrentUser, getCurrentUserEmail, patchCurrentUserPassword } from "../../api/user";
import { formatMoney } from "../../lib/money";
import { getThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import { useSession } from "../../state/SessionContext";

const settingsSchema = z.object({
  spend_accounts_csv: z.string(),
  base_currency: z.string().min(3).max(3),
  timezone: z.string().min(1, "Timezone is required"),
  start_week: z.enum(["0", "1"]),
  theme: z.enum(["light", "dark", "system"]),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    new_password_confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    path: ["new_password_confirm"],
    message: "Passwords do not match",
  });

const deleteSchema = z.object({
  email_confirm: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

type SettingsForm = z.infer<typeof settingsSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type DeleteForm = z.infer<typeof deleteSchema>;

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

function parseSpendAccounts(csv: string): string[] {
  return csv
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);
}

function timezoneOptions(current: string): Array<{ value: string; label: string }> {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  const values = zones.includes(current) || !current ? zones : [current, ...zones];
  return values.map((z) => ({ value: z, label: z }));
}

export function SettingsProfilePage(): ReactNode {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useSession();
  const [settingsMessage, setSettingsMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", "settings"] as const,
    queryFn: getAppProfile,
  });
  const userEmailQuery = useQuery({
    queryKey: ["profile", "email"] as const,
    queryFn: getCurrentUserEmail,
  });
  const snapshotQuery = useQuery({
    queryKey: ["profile", "snapshot"] as const,
    queryFn: () => fetchAppSnapshot({ current_month: "1" }),
    placeholderData: keepPreviousData,
  });
  const sourcesQuery = useQuery({
    queryKey: ["lookups", "sources"] as const,
    queryFn: listSourceNames,
    placeholderData: keepPreviousData,
  });

  const settingsForm = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      spend_accounts_csv: "",
      base_currency: "USD",
      timezone: "UTC",
      start_week: "1",
      theme: getThemePreference(),
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      new_password_confirm: "",
    },
  });

  const deleteForm = useForm<DeleteForm>({
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      email_confirm: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    settingsForm.reset({
      spend_accounts_csv: profileQuery.data.spend_accounts.join(", "),
      base_currency: profileQuery.data.base_currency,
      timezone: profileQuery.data.timezone,
      start_week: String(profileQuery.data.start_of_week) as "0" | "1",
      theme: getThemePreference(),
    });
  }, [profileQuery.data, settingsForm]);

  const settingsMutation = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const spendAccounts = parseSpendAccounts(values.spend_accounts_csv);
      await updateAppProfile({
        spend_accounts: spendAccounts,
        base_currency: values.base_currency.toUpperCase(),
        timezone: values.timezone,
        start_week: Number(values.start_week),
      });
      setThemePreference(values.theme as ThemePreference);
    },
    onSuccess: () => {
      setSettingsMessage("Settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
    },
    onError: (error) => setSettingsMessage(parseApiError(error)),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordForm) => patchCurrentUserPassword(values.old_password, values.new_password),
    onSuccess: () => {
      setSecurityMessage("Password updated.");
      passwordForm.reset();
    },
    onError: (error) => setSecurityMessage(parseApiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (values: DeleteForm) => {
      const email = (userEmailQuery.data ?? "").trim().toLowerCase();
      if (values.email_confirm.trim().toLowerCase() !== email) {
        throw new Error("Email confirmation does not match the signed-in account.");
      }
      await deleteCurrentUser(values.password);
    },
    onSuccess: () => {
      setDeleteOpen(false);
      logout();
      navigate("/", { replace: true });
    },
    onError: (error) => setDeleteError(parseApiError(error)),
  });

  const overviewKpis = useMemo(() => {
    const snap = snapshotQuery.data?.snapshot;
    const currency = profileQuery.data?.base_currency ?? "USD";
    const val = (field: string): ReactNode => {
      const raw = snap?.[field];
      if (raw === null || raw === undefined) return "N/A";
      return formatMoney(raw, currency);
    };
    return [
      { label: "Total assets", value: val("total_assets") },
      { label: "Savings", value: val("total_savings") },
      { label: "Checking", value: val("total_checking") },
      { label: "Investment", value: val("total_investment") },
      { label: "Cash", value: val("total_cash") },
      { label: "E-wallet", value: val("total_ewallet") },
      { label: "Monthly spending", value: val("total_monthly_spending") },
      { label: "Remaining expenses", value: val("total_remaining_expenses") },
      { label: "Leaks", value: val("total_leaks") },
    ];
  }, [profileQuery.data?.base_currency, snapshotQuery.data?.snapshot]);

  const anyLoading = profileQuery.isLoading || snapshotQuery.isLoading || userEmailQuery.isLoading;
  if (anyLoading && !profileQuery.data) {
    return <LoadingState label="Loading profile settings..." />;
  }
  if (profileQuery.isError) {
    return <ErrorState title="Failed to load profile settings" onRetry={() => void profileQuery.refetch()} />;
  }

  const timezoneSelect = timezoneOptions(profileQuery.data?.timezone ?? "UTC");
  const sourceValues = (sourcesQuery.data ?? []).map((s) => s.source);

  return (
    <div className="stack">
      <h2 className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
        Profile and settings
      </h2>

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {snapshotQuery.isError ? (
                  <ErrorState title="Snapshot unavailable" onRetry={() => void snapshotQuery.refetch()} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    {overviewKpis.map((kpi) => (
                      <KPI key={kpi.label} label={kpi.label} value={kpi.value} />
                    ))}
                  </div>
                )}
              </TabPanel>
            ),
          },
          {
            id: "settings",
            label: "Settings",
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {settingsMessage
                  ? settingsMessage === "Settings saved."
                    ? <SuccessState message={settingsMessage} />
                    : <ErrorState title="Could not save settings" description={settingsMessage} />
                  : null}
                <Card>
                  <AppForm
                    form={settingsForm}
                    onSubmit={(v) => {
                      setSettingsMessage("");
                      settingsMutation.mutate(v);
                    }}
                    className="stack"
                  >
                    <TextField name="spend_accounts_csv" label="Spend accounts (comma-separated)" />
                    <p className="muted-text" style={{ margin: "-0.4rem 0 0" }}>
                      Available sources: {sourceValues.length > 0 ? sourceValues.join(", ") : "No sources found"}
                    </p>
                    <TextField name="base_currency" label="Base currency (3-letter code)" />
                    <SelectField
                      name="start_week"
                      label="Start of week"
                      options={[
                        { value: "0", label: "Sunday" },
                        { value: "1", label: "Monday" },
                      ]}
                    />
                    <SelectField name="timezone" label="Timezone" options={timezoneSelect} />
                    <SelectField
                      name="theme"
                      label="Theme"
                      options={[
                        { value: "system", label: "System" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                      ]}
                    />
                    <Button type="submit" disabled={settingsMutation.isPending}>
                      {settingsMutation.isPending ? "Saving..." : "Save settings"}
                    </Button>
                  </AppForm>
                </Card>
              </TabPanel>
            ),
          },
          {
            id: "security",
            label: "Security",
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {securityMessage
                  ? securityMessage === "Password updated."
                    ? <SuccessState message={securityMessage} />
                    : <ErrorState title="Security update failed" description={securityMessage} />
                  : null}
                <Card>
                  <AppForm
                    form={passwordForm}
                    onSubmit={(v) => {
                      setSecurityMessage("");
                      passwordMutation.mutate(v);
                    }}
                    className="stack"
                  >
                    <TextField name="old_password" label="Current password" type="password" />
                    <TextField name="new_password" label="New password" type="password" />
                    <TextField name="new_password_confirm" label="Confirm new password" type="password" />
                    <Button type="submit" disabled={passwordMutation.isPending}>
                      {passwordMutation.isPending ? "Updating..." : "Change password"}
                    </Button>
                  </AppForm>
                </Card>
                <Card>
                  <div className="stack" style={{ gap: 8 }}>
                    <h3 style={{ margin: 0 }}>Danger zone</h3>
                    <p className="muted-text" style={{ margin: 0 }}>
                      Delete account permanently. This cannot be undone.
                    </p>
                    <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                      Delete account
                    </Button>
                  </div>
                </Card>
              </TabPanel>
            ),
          },
        ]}
      />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <div className="stack" style={{ marginTop: 12 }}>
          {deleteError ? <ErrorState title="Delete failed" description={deleteError} /> : null}
          <p className="muted-text" style={{ margin: 0 }}>
            Type your account email and current password to confirm permanent deletion.
          </p>
          <AppForm
            form={deleteForm}
            onSubmit={(values) => {
              setDeleteError("");
              deleteMutation.mutate(values);
            }}
            className="stack"
          >
            <TextField name="email_confirm" label="Confirm email" type="email" />
            <TextField name="password" label="Current password" type="password" />
            <Button type="submit" variant="ghost" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Confirm delete"}
            </Button>
          </AppForm>
        </div>
      </Modal>
    </div>
  );
}
