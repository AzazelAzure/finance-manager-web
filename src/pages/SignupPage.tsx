import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";
import { createUser } from "../api/user";
import { login } from "../api/auth";
import { AppForm } from "../components/Form/FormProvider";
import { TextField } from "../components/Form/TextField";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { tr, useLocale } from "../lib/i18n";
import { setSession } from "../state/auth";
import {
  clearOnboardingProgress,
  markForceOnboardingNextLogin,
} from "../state/onboarding";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

const schema = z
  .object({
    username: z.string().min(1, "Username is required").max(150, "Username is too long"),
    user_email: z.string().email("Valid email is required"),
    password: z.string().min(8, "At least 8 characters"),
    password_confirm: z.string().min(1, "Confirm your password"),
    tos_accepted: z.boolean().refine((v) => v, { message: "You must accept the Terms of Service" }),
  })
  .refine((d) => d.password === d.password_confirm, {
    path: ["password_confirm"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function SignupPage(): ReactNode {
  const locale = useLocale();
  const { isAuthenticated } = useSession();
  const [formError, setFormError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      user_email: "",
      password: "",
      password_confirm: "",
      tos_accepted: false,
    },
  });
  const tosAccepted = form.watch("tos_accepted");

  if (isAuthenticated) {
    // Session updates synchronously via useSyncExternalStore; force flag is set before
    // setSession during signup success (see onValid).
    const next = "/app/dashboard";
    return <Navigate to={next} replace />;
  }

  async function onValid(values: FormValues): Promise<void> {
    setFormError("");
    try {
      await createUser({
        username: values.username.trim(),
        user_email: values.user_email.trim(),
        password: values.password,
        tos_version: "1.0",
        tos_accepted_at: new Date().toISOString(),
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        const data = err.response.data as {
          detail?: string;
          user_email?: string[];
          username?: string[];
        };
        const emailMsg = data.user_email?.[0];
        const userMsg = data.username?.[0];
        if (emailMsg) {
          setFormError(emailMsg);
          return;
        }
        if (userMsg) {
          setFormError(userMsg);
          return;
        }
        if (data?.detail?.toLowerCase().includes("exists")) {
          setFormError("That username or email is already in use. Try signing in or use a different email.");
          return;
        }
        setFormError("Could not create account. Check the form and try again.");
        return;
      }
      setFormError("Sign up failed. Check your network and try again.");
      return;
    }
    try {
      const data = await login(values.username.trim(), values.password);
      // Progress is keyed only in localStorage today; clear so a new account never inherits
      // another session's onboarding_completed from the same browser profile.
      clearOnboardingProgress();
      markForceOnboardingNextLogin();
      setSession({ access: data.access, refresh: data.refresh });
    } catch {
      setFormError("Account was created but sign-in failed. Try logging in manually.");
    }
  }

  return (
    <section className="stack auth-shell auth-shell--signup">
      <Helmet>
        <title>{tr("signup.seo.title", locale) || "Create Account | Hive Financial Manager"}</title>
        <meta
          name="description"
          content={tr("signup.seo.desc", locale) || "Create your free Hive Financial Manager account."}
        />
        <link rel="canonical" href="https://thehivemanager.com/signup" />
      </Helmet>
      <div className="auth-shell__intro">
        <div className="auth-shell__brand" aria-hidden>
          <img src="/favicon.png" alt="" className="auth-shell__mark" />
          <span>Hive</span>
        </div>
        <p className="auth-shell__step">{tr("signup.step", locale)}</p>
        <h1 className="auth-shell__title">{tr("signup.title", locale)}</h1>
        <p className="auth-shell__trust">
          <ShieldCheck size={16} aria-hidden />
          {tr("signup.trust", locale)}
        </p>
        <p className="muted-text auth-shell__subtitle">
          {tr("signup.helper", locale)}
        </p>
      </div>
      <Card className="auth-card">
        <button type="button" className="auth-biometric" disabled aria-disabled="true">
          <Fingerprint size={18} aria-hidden />
          <span>{tr("signup.biometricPlaceholder", locale)}</span>
        </button>
        <AppForm form={form} onSubmit={onValid} className="stack" id="signup-form" autoComplete="off">
          <TextField name="username" label="Username" autoComplete="off" autoFocus unlockOnFocus />
          <TextField name="user_email" label="Email" type="email" autoComplete="off" unlockOnFocus />
          <TextField name="password" label="Password" type="password" autoComplete="off" unlockOnFocus />
          <TextField
            name="password_confirm"
            label="Confirm password"
            type="password"
            autoComplete="off"
            unlockOnFocus
          />
          <div className="ui-field ui-field--row signup-tos-row">
            <input
              className="ui-check"
              type="checkbox"
              id="tos_accepted"
              aria-invalid={form.formState.errors.tos_accepted ? "true" : "false"}
              {...form.register("tos_accepted")}
            />
            <label className="ui-label signup-tos-row__label" htmlFor="tos_accepted">
              I agree to the <Link to="/terms">Terms of Service</Link> and{" "}
              <Link to="/privacy">Privacy Policy</Link>
            </label>
          </div>
          {form.formState.errors.tos_accepted ? (
            <p className="error-text" role="alert">
              {String(form.formState.errors.tos_accepted.message)}
            </p>
          ) : null}
          {formError ? (
            <p className="error-text" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting || !tosAccepted}>
            {form.formState.isSubmitting ? tr("signup.submitting", locale) : tr("signup.submit", locale)}
          </Button>
        </AppForm>
        <p className="muted auth-shell__links">
          {tr("signup.haveAccount", locale)} <Link to="/login">{tr("login.submit", locale)}</Link>
        </p>
        <p className="muted auth-shell__links auth-shell__links--compact">
          <Link to="/">{tr("signup.backHome", locale)}</Link>
        </p>
      </Card>
    </section>
  );
}
