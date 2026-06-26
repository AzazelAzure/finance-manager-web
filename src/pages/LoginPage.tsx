import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { login } from "../api/auth";
import { AppForm } from "../components/Form/FormProvider";
import { TextField } from "../components/Form/TextField";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { tr, useLocale } from "../lib/i18n";
import { setSession } from "../state/auth";
import { consumeForceOnboardingNextLogin } from "../state/onboarding";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage(): ReactNode {
  const locale = useLocale();
  const { isAuthenticated } = useSession();
  const location = useLocation();
  const rawFrom = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const safeFromPath = rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/app/dashboard";
  const [postLoginPath, setPostLoginPath] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  if (isAuthenticated) {
    return <Navigate to={postLoginPath ?? safeFromPath} replace />;
  }

  async function onValid(values: FormValues): Promise<void> {
    setFormError("");
    try {
      const data = await login(values.username, values.password);
      consumeForceOnboardingNextLogin();
      const nextPath = safeFromPath;
      setPostLoginPath(nextPath);
      setSession({ access: data.access, refresh: data.refresh });
    } catch (err) {
      if (import.meta.env.DEV && axios.isAxiosError(err)) {
        const status = err.response?.status;
        const code = err.code;
        const body =
          typeof err.response?.data === "object" && err.response?.data !== null
            ? JSON.stringify(err.response.data).slice(0, 200)
            : String(err.response?.data ?? "");
        const bits = [
          status != null ? `HTTP ${String(status)}` : null,
          code ? `code ${String(code)}` : null,
          err instanceof Error && err.message ? err.message : null,
          body ? `body ${body}` : null,
        ].filter(Boolean) as string[];
        setFormError(
          bits.length
            ? `Login failed (${bits.join("; ")}). If there is no HTTP status, check CORS, API base URL, and network.`
            : "Login failed. Check credentials, CORS, and API base URL.",
        );
        return;
      }
      setFormError("Login failed. Check credentials or API connectivity.");
    }
  }

  return (
    <section className="stack auth-shell auth-shell--login">
      <Helmet>
        <title>{tr("login.seo.title", locale) || "Sign In | Hive Financial Manager"}</title>
        <meta
          name="description"
          content={tr("login.seo.desc", locale) || "Log in to your Hive Financial Manager account."}
        />
        <link rel="canonical" href="https://thehivemanager.com/login" />
      </Helmet>
      <div className="auth-shell__intro">
        <div className="auth-shell__brand" aria-hidden>
          <img src="/favicon.png" alt="" className="auth-shell__mark" />
          <span>Hive</span>
        </div>
        <h1 className="auth-shell__title">{tr("login.title", locale)}</h1>
        <p className="auth-shell__trust">
          <ShieldCheck size={16} aria-hidden />
          {tr("login.trust", locale)}
        </p>
        <p className="muted-text auth-shell__subtitle">
          {tr("login.helper", locale)}
        </p>
      </div>
      <Card className="auth-card">
        <button type="button" className="auth-biometric" disabled aria-disabled="true">
          <Fingerprint size={18} aria-hidden />
          <span>{tr("login.biometricPlaceholder", locale)}</span>
        </button>
        <AppForm form={form} onSubmit={onValid} className="stack" id="login-form" autoComplete="off">
          <TextField name="username" label="Username" autoComplete="off" unlockOnFocus />
          <TextField name="password" label="Password" type="password" autoComplete="off" unlockOnFocus />
          {formError ? (
            <p className="error-text" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? tr("login.submitting", locale) : tr("login.submit", locale)}
          </Button>
        </AppForm>
        <p className="muted auth-shell__links">
          <Link to="/">Home</Link>
          {" · "}
          <Link to="/signup">{tr("hero.getStarted", locale)}</Link>
        </p>
      </Card>
    </section>
  );
}
