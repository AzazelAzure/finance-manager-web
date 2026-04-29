import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { markForceOnboardingNextLogin } from "../state/onboarding";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

const schema = z
  .object({
    username: z.string().min(1, "Username is required").max(150, "Username is too long"),
    user_email: z.string().email("Valid email is required"),
    password: z.string().min(8, "At least 8 characters"),
    password_confirm: z.string().min(1, "Confirm your password"),
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
  const [postSignupPath, setPostSignupPath] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      user_email: "",
      password: "",
      password_confirm: "",
    },
  });

  if (isAuthenticated) {
    return <Navigate to={postSignupPath ?? "/app/dashboard"} replace />;
  }

  async function onValid(values: FormValues): Promise<void> {
    setFormError("");
    try {
      await createUser({
        username: values.username.trim(),
        user_email: values.user_email.trim(),
        password: values.password,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        const data = err.response.data as { detail?: string };
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
      setPostSignupPath("/app/onboarding");
      setSession({ access: data.access, refresh: data.refresh });
      markForceOnboardingNextLogin();
    } catch {
      setFormError("Account was created but sign-in failed. Try logging in manually.");
    }
  }

  return (
    <section className="stack auth-shell auth-shell--signup">
      <h1 className="auth-shell__title">{tr("signup.title", locale)}</h1>
      <p className="muted-text auth-shell__subtitle">
        {tr("signup.helper", locale)}
      </p>
      <Card className="auth-card">
        <AppForm form={form} onSubmit={onValid} className="stack" id="signup-form" autoComplete="off">
          <TextField name="username" label="Username" autoComplete="off" unlockOnFocus />
          <TextField name="user_email" label="Email" type="email" autoComplete="off" unlockOnFocus />
          <TextField name="password" label="Password" type="password" autoComplete="off" unlockOnFocus />
          <TextField
            name="password_confirm"
            label="Confirm password"
            type="password"
            autoComplete="off"
            unlockOnFocus
          />
          {formError ? (
            <p className="error-text" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
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
