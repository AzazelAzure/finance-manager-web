import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppForm } from "../../components/Form/FormProvider";
import { SelectField } from "../../components/Form/SelectField";
import { TextField } from "../../components/Form/TextField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { SuccessState } from "../../components/ui/SuccessState";
import { TabPanel, Tabs } from "../../components/ui/Tabs";
import { listSourceNames, downloadCsvExport, downloadFullBackup, parseBlobApiError } from "../../api/lookups";
import { getAppProfile, updateAppProfile } from "../../api/profile";
import { isOfflineQueued } from "../../api/types";
import { deleteCurrentUser, getCurrentUserEmail, patchCurrentUserPassword } from "../../api/user";
import { getThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import { useSession } from "../../state/SessionContext";
import { clearOutbox, outboxDepth } from "../../offline/outbox";
import { readOptsFromQuery, requestPwaReadBypassAfterMutation } from "../../offline/pwaReadBypass";
import { preferOfflineCaches } from "../../offline/connectivity";
import { tr, useLocale } from "../../lib/i18n";
import { restartOnboardingWizard } from "../../state/onboarding";
import { HelpModeWrapper, useTour } from "../../components/tours/TourProvider";
import { PROFILE_TOUR_ID, buildProfileSteps } from "../../components/tours/ProfileTourSteps";
import { buildTimezoneOptions } from "../../lib/timezones";

const settingsSchema = z.object({
  spend_accounts_csv: z.string(),
  base_currency: z.string().min(3).max(3),
  timezone: z.string().min(1, "Timezone is required"),
  start_week: z.enum(["0", "1"]),
  theme: z.enum(["light", "dark", "system"]),
  sts_window_mode: z.enum(["calendar_month", "pay_cycle"]),
  pay_cycle_frequency: z.enum(["", "weekly", "biweekly", "semimonthly", "monthly"]),
  pay_cycle_anchor_date: z.string(),
}).superRefine((values, ctx) => {
  if (values.sts_window_mode !== "pay_cycle") {
    return;
  }
  if (!values.pay_cycle_frequency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pay_cycle_frequency"],
      message: "Pay-cycle frequency is required",
    });
  }
  if (!values.pay_cycle_anchor_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pay_cycle_anchor_date"],
      message: "Pay-cycle anchor date is required",
    });
  }
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

export function SettingsProfilePage(): ReactNode {
  const locale = useLocale();
  const { startTour, isTourCompleted } = useTour();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useSession();
  const [settingsMessage, setSettingsMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [spendAccountsInput, setSpendAccountsInput] = useState("");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportBlocked, setExportBlocked] = useState(true);

  useEffect(() => {
    async function refreshExportBlocked() {
      const depth = await outboxDepth();
      const offline = preferOfflineCaches();
      setExportBlocked(offline || depth > 0);
    }
    void refreshExportBlocked();
    const onConnectivityChange = () => void refreshExportBlocked();
    window.addEventListener("online", onConnectivityChange);
    window.addEventListener("offline", onConnectivityChange);
    window.addEventListener("fm-offline-queued", onConnectivityChange);
    window.addEventListener("fm-api-reachable", onConnectivityChange);
    return () => {
      window.removeEventListener("online", onConnectivityChange);
      window.removeEventListener("offline", onConnectivityChange);
      window.removeEventListener("fm-offline-queued", onConnectivityChange);
      window.removeEventListener("fm-api-reachable", onConnectivityChange);
    };
  }, []);

  const profileQuery = useQuery({
    queryKey: ["profile", "settings"] as const,
    queryFn: (ctx) => getAppProfile(readOptsFromQuery(ctx)),
  });
  const userEmailQuery = useQuery({
    queryKey: ["profile", "email"] as const,
    queryFn: (ctx) => getCurrentUserEmail(readOptsFromQuery(ctx)),
  });
  const sourcesQuery = useQuery({
    queryKey: ["lookups", "sources"] as const,
    queryFn: (ctx) => listSourceNames(readOptsFromQuery(ctx)),
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
      sts_window_mode: "calendar_month",
      pay_cycle_frequency: "",
      pay_cycle_anchor_date: "",
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
      sts_window_mode: profileQuery.data.sts_window_mode ?? "calendar_month",
      pay_cycle_frequency: profileQuery.data.pay_cycle_frequency ?? "",
      pay_cycle_anchor_date: profileQuery.data.pay_cycle_anchor_date ?? "",
    });
  }, [profileQuery.data, settingsForm]);

  const settingsMutation = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const res = await updateAppProfile({
        spend_accounts: selectedSpendAccounts,
        base_currency: values.base_currency.toUpperCase(),
        timezone: values.timezone,
        start_week: Number(values.start_week),
        sts_window_mode: values.sts_window_mode,
        pay_cycle_frequency: values.sts_window_mode === "pay_cycle" ? values.pay_cycle_frequency || null : null,
        pay_cycle_anchor_date: values.sts_window_mode === "pay_cycle" ? values.pay_cycle_anchor_date || null : null,
      });
      setThemePreference(values.theme as ThemePreference);
      return res;
    },
    onSuccess: (res) => {
      setSettingsMessage(
        isOfflineQueued(res) ? tr("settings.savedOffline", locale) : tr("settings.saved", locale),
      );
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["profile"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
    },
    onError: (error) => setSettingsMessage(parseApiError(error)),
  });

  const resetToursMutation = useMutation({
    mutationFn: async () => {
      const res = await updateAppProfile({
        completed_tours: [],
      });
      return res;
    },
    onSuccess: (res) => {
      setSettingsMessage(
        isOfflineQueued(res) ? tr("settings.savedOffline", locale) : "Guided tours reset successfully",
      );
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["profile"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
    },
    onError: (error) => setSettingsMessage(parseApiError(error)),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordForm) => patchCurrentUserPassword(values.old_password, values.new_password),
    onSuccess: () => {
      setSecurityMessage(tr("settings.passwordUpdated", locale));
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
      void clearOutbox().catch(() => undefined);
      logout();
      navigate("/", { replace: true });
    },
    onError: (error) => setDeleteError(parseApiError(error)),
  });

  const anyLoading = profileQuery.isLoading || userEmailQuery.isLoading;
  const spendAccountsCsv = useWatch({ control: settingsForm.control, name: "spend_accounts_csv" }) ?? "";
  const stsWindowMode = useWatch({ control: settingsForm.control, name: "sts_window_mode" }) ?? "calendar_month";
  const selectedSpendAccounts = parseSpendAccounts(spendAccountsCsv);
  const sourceValues = (sourcesQuery.data ?? []).map((s) => s.source);
  const normalizedSourceValues = sourceValues.map((s) => s.trim().toLowerCase());

  function updateSelectedSpendAccounts(next: string[]): void {
    const deduped = Array.from(new Set(next.map((s) => s.trim().toLowerCase()).filter(Boolean)));
    settingsForm.setValue("spend_accounts_csv", deduped.join(", "), { shouldDirty: true });
  }

  function addSpendAccount(value: string): void {
    const normalized = value.trim().toLowerCase();
    if (!normalized || !normalizedSourceValues.includes(normalized) || selectedSpendAccounts.includes(normalized)) {
      return;
    }
    updateSelectedSpendAccounts([...selectedSpendAccounts, normalized]);
    setSpendAccountsInput("");
  }

  useEffect(() => {
    if (!profileQuery.isSuccess || isTourCompleted(PROFILE_TOUR_ID)) {
      return;
    }
    const timer = setTimeout(() => {
      startTour(PROFILE_TOUR_ID, buildProfileSteps(locale));
    }, 400);
    return () => clearTimeout(timer);
  }, [profileQuery.isSuccess, isTourCompleted, startTour, locale]);

  if (anyLoading && !profileQuery.data) {
    return <LoadingState label={tr("settings.loading", locale)} />;
  }
  if (profileQuery.isError) {
    return <ErrorState title={tr("settings.failed", locale)} onRetry={() => void profileQuery.refetch()} />;
  }

  const timezoneSelect = buildTimezoneOptions({ current: profileQuery.data?.timezone ?? "UTC" });

  return (
    <div className="stack">
      <div className="row-between" style={{ alignItems: "center", gap: 8 }}>
        <h2 id="profile-page-title" className="muted" style={{ margin: 0, fontSize: "var(--font-xl)" }}>
          {tr("settings.title", locale)}
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => startTour(PROFILE_TOUR_ID, buildProfileSteps(locale), true)}
        >
          {tr("tour.replayTour", locale)}
        </Button>
      </div>

      <Tabs
        idPrefix="profile"
        tabs={[
          {
            id: "settings",
            label: tr("settings.tab.settings", locale),
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {settingsMessage
                  ? settingsMessage === tr("settings.saved", locale)
                    ? <SuccessState message={settingsMessage} />
                    : <ErrorState title={tr("settings.couldNotSave", locale)} description={settingsMessage} />
                  : null}
                <HelpModeWrapper id="profile-settings-form" title={tr("guide.profile.settings.title", locale)} content={tr("guide.profile.settings.content", locale)}>
                <Card>
                  <AppForm
                    form={settingsForm}
                    onSubmit={(v) => {
                      setSettingsMessage("");
                      settingsMutation.mutate(v);
                    }}
                    className="stack"
                  >
                    <input type="hidden" {...settingsForm.register("spend_accounts_csv")} />
                    <div className="ui-field">
                      <span className="ui-label">{tr("form.label.spendAccounts", locale)}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {selectedSpendAccounts.length === 0 ? <span className="muted-text">No spend accounts selected</span> : null}
                        {selectedSpendAccounts.map((account) => (
                          <button
                            key={account}
                            type="button"
                            className="tx-badge"
                            onClick={() => updateSelectedSpendAccounts(selectedSpendAccounts.filter((s) => s !== account))}
                          >
                            {account} ×
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <input
                          className="ui-input"
                          list="settings-source-list"
                          value={spendAccountsInput}
                          onChange={(e) => setSpendAccountsInput(e.target.value)}
                          placeholder={tr("form.label.addSpendAccountPlaceholder", locale)}
                        />
                        <Button type="button" variant="secondary" onClick={() => addSpendAccount(spendAccountsInput)}>
                          Add
                        </Button>
                      </div>
                      <p className="muted-text" style={{ margin: "0.45rem 0 0" }}>
                        Available sources: {sourceValues.length > 0 ? sourceValues.join(", ") : "No sources found"}
                      </p>
                      <datalist id="settings-source-list">
                        {sourceValues.map((source) => (
                          <option key={source} value={source} />
                        ))}
                      </datalist>
                    </div>
                    <TextField name="base_currency" label={tr("form.label.baseCurrencyCode", locale)} />
                    <SelectField
                      name="start_week"
                      label={tr("form.label.startOfWeek", locale)}
                      options={[
                        { value: "0", label: "Sunday" },
                        { value: "1", label: "Monday" },
                      ]}
                    />
                    <SelectField name="timezone" label={tr("form.label.timezone", locale)} options={timezoneSelect} />
                    <SelectField
                      name="sts_window_mode"
                      label={tr("settings.payCycle.windowMode", locale)}
                      options={[
                        { value: "calendar_month", label: tr("settings.payCycle.calendarMonth", locale) },
                        { value: "pay_cycle", label: tr("settings.payCycle.payCycle", locale) },
                      ]}
                    />
                    {stsWindowMode === "pay_cycle" ? (
                      <>
                        <SelectField
                          name="pay_cycle_frequency"
                          label={tr("settings.payCycle.frequency", locale)}
                          options={[
                            { value: "", label: tr("settings.payCycle.selectFrequency", locale) },
                            { value: "weekly", label: tr("settings.payCycle.weekly", locale) },
                            { value: "biweekly", label: tr("settings.payCycle.biweekly", locale) },
                            { value: "semimonthly", label: tr("settings.payCycle.semimonthly", locale) },
                            { value: "monthly", label: tr("settings.payCycle.monthly", locale) },
                          ]}
                        />
                        <label className="ui-field">
                          <span className="ui-label">{tr("settings.payCycle.anchorDate", locale)}</span>
                          <input
                            className="ui-input"
                            type="date"
                            {...settingsForm.register("pay_cycle_anchor_date")}
                          />
                        </label>
                        <p className="muted-text" style={{ margin: 0 }}>
                          {tr("settings.payCycle.anchorHelp", locale)}
                        </p>
                      </>
                    ) : null}
                    <SelectField
                      name="theme"
                      label={tr("form.label.theme", locale)}
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
                </HelpModeWrapper>
                <HelpModeWrapper id="profile-reset-tours" title={tr("guide.profile.resetTours.title", locale)} content={tr("guide.profile.resetTours.content", locale)}>
                <Card>
                  <div className="stack" style={{ gap: 8 }}>
                    <h3 style={{ margin: 0 }}>App Experience</h3>
                    <p className="muted-text" style={{ margin: 0 }}>
                      Reset the guided walkthroughs so they appear again.
                    </p>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        setSettingsMessage("");
                        resetToursMutation.mutate();
                      }}
                      disabled={resetToursMutation.isPending}
                    >
                      {resetToursMutation.isPending ? "Resetting..." : "Reset guided tours"}
                    </Button>
                  </div>
                </Card>
                </HelpModeWrapper>
                <Card>
                  <div className="stack" style={{ gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{tr("onboarding.restartTitle", locale)}</h3>
                    <p className="muted-text" style={{ margin: 0 }}>
                      {tr("onboarding.restartHint", locale)}
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        restartOnboardingWizard();
                        navigate("/app/onboarding");
                      }}
                    >
                      {tr("onboarding.restart", locale)}
                    </Button>
                  </div>
                </Card>
              </TabPanel>
            ),
          },
          {
            id: "data",
            label: tr("settings.tab.data", locale),
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                <HelpModeWrapper id="profile-data-export" title={tr("guide.profile.data.title", locale)} content={tr("guide.profile.data.content", locale)}>
                  <Card>
                    <div className="stack" style={{ gap: 10 }}>
                      <h3 style={{ margin: 0 }}>{tr("data.export.heading", locale)}</h3>
                      {exportBlocked ? (
                        <p className="muted-text" style={{ margin: 0 }}>
                          {tr("data.export.offlineDisabled", locale)}
                        </p>
                      ) : null}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <label className="ui-field" style={{ minWidth: 140 }}>
                          <span className="ui-label">{tr("data.export.dateFrom", locale)}</span>
                          <input
                            className="ui-input"
                            type="date"
                            value={exportDateFrom}
                            onChange={(e) => setExportDateFrom(e.target.value)}
                            disabled={exportBlocked || csvDownloading || backupDownloading}
                          />
                        </label>
                        <label className="ui-field" style={{ minWidth: 140 }}>
                          <span className="ui-label">{tr("data.export.dateTo", locale)}</span>
                          <input
                            className="ui-input"
                            type="date"
                            value={exportDateTo}
                            onChange={(e) => setExportDateTo(e.target.value)}
                            disabled={exportBlocked || csvDownloading || backupDownloading}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Button
                          variant="secondary"
                          disabled={exportBlocked || csvDownloading || backupDownloading}
                          onClick={async () => {
                            setCsvDownloading(true);
                            setExportError("");
                            try {
                              await downloadCsvExport(exportDateFrom || undefined, exportDateTo || undefined);
                            } catch (error) {
                              setExportError(
                                error instanceof Error && !axios.isAxiosError(error)
                                  ? error.message
                                  : await parseBlobApiError(error),
                              );
                            } finally {
                              setCsvDownloading(false);
                            }
                          }}
                        >
                          {csvDownloading ? tr("data.export.csvDownloading", locale) : tr("data.export.downloadCsv", locale)}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={exportBlocked || csvDownloading || backupDownloading}
                          onClick={async () => {
                            setBackupDownloading(true);
                            setExportError("");
                            try {
                              await downloadFullBackup();
                            } catch (error) {
                              setExportError(
                                error instanceof Error && !axios.isAxiosError(error)
                                  ? error.message
                                  : await parseBlobApiError(error),
                              );
                            } finally {
                              setBackupDownloading(false);
                            }
                          }}
                        >
                          {backupDownloading
                            ? tr("data.export.backupDownloading", locale)
                            : tr("data.export.downloadBackup", locale)}
                        </Button>
                      </div>
                      {exportError ? <ErrorState title="Export failed" description={exportError} /> : null}
                    </div>
                  </Card>
                </HelpModeWrapper>
              </TabPanel>
            ),
          },
          {
            id: "security",
            label: tr("settings.tab.security", locale),
            content: (
              <TabPanel className="stack">
                <div style={{ marginTop: 12 }} />
                {securityMessage
                  ? securityMessage === tr("settings.passwordUpdated", locale)
                    ? <SuccessState message={securityMessage} />
                    : <ErrorState title={tr("settings.securityFailed", locale)} description={securityMessage} />
                  : null}
                <HelpModeWrapper id="profile-security-password" title={tr("guide.profile.security.title", locale)} content={tr("guide.profile.security.content", locale)}>
                <Card>
                  <AppForm
                    form={passwordForm}
                    onSubmit={(v) => {
                      setSecurityMessage("");
                      passwordMutation.mutate(v);
                    }}
                    className="stack"
                  >
                    <TextField name="old_password" label={tr("form.label.currentPassword", locale)} type="password" />
                    <TextField name="new_password" label={tr("form.label.newPassword", locale)} type="password" />
                    <TextField name="new_password_confirm" label={tr("form.label.confirmNewPassword", locale)} type="password" />
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
                </HelpModeWrapper>
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
