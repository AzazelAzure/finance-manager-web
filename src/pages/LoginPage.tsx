import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "../api/auth";
import { AppForm } from "../components/Form/FormProvider";
import { TextField } from "../components/Form/TextField";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { setSession } from "../state/auth";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage(): ReactNode {
  const { isAuthenticated } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function onValid(values: FormValues): Promise<void> {
    setFormError("");
    try {
      const data = await login(values.username, values.password);
      setSession({ access: data.access, refresh: data.refresh });
      navigate("/app/dashboard", { replace: true });
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
    <section className="stack" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "var(--font-2xl)" }}>Log in</h1>
      <p className="muted-text" style={{ margin: 0 }}>
        Access your dashboard. No credentials are prefilled in production.
      </p>
      <Card>
        <AppForm form={form} onSubmit={onValid} className="stack">
          <TextField name="username" label="Username" autoComplete="username" />
          <TextField name="password" label="Password" type="password" autoComplete="current-password" />
          {formError ? (
            <p className="error-text" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </AppForm>
        <p className="muted" style={{ margin: "0.75rem 0 0" }}>
          <Link to="/">Home</Link>
          {" · "}
          <Link to="/signup">Sign up</Link>
        </p>
      </Card>
    </section>
  );
}
