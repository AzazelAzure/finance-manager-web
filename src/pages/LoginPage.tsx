import axios from "axios";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { setToken } from "../state/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("proctor");
  const [password, setPassword] = useState("finances");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await login(username, password);
      setToken(data.access);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (import.meta.env.DEV && axios.isAxiosError(err)) {
        const status = err.response?.status;
        const code = err.code;
        const body =
          typeof err.response?.data === "object" && err.response?.data !== null
            ? JSON.stringify(err.response.data).slice(0, 200)
            : String(err.response?.data ?? "");
        const bits = [
          status != null ? `HTTP ${status}` : null,
          code ? `code ${code}` : null,
          err.message ? err.message : null,
          body ? `body ${body}` : null,
        ].filter(Boolean);
        setError(
          bits.length
            ? `Login failed (${bits.join("; ")}). If there is no HTTP status, check CORS, API base URL, and network.`
            : "Login failed. Check credentials, CORS, and API base URL.",
        );
      } else {
        setError("Login failed. Check credentials or API connectivity.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card login-card">
      <h2>Login</h2>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </section>
  );
}
