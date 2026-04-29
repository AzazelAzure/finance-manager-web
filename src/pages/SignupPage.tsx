import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import type { ReactNode } from "react";

export function SignupPage(): ReactNode {
  return (
    <section className="stack" style={{ maxWidth: 480, margin: "0 auto", padding: "1rem 0" }}>
      <h1 style={{ fontSize: "var(--font-2xl)", margin: 0 }}>Create account</h1>
      <p className="muted-text">Full signup (react-hook-form and POST /finance/user/) lands in a later task.</p>
      <Card>
        <p>
          For now, <Link to="/login">return to sign in</Link> or <Link to="/">Back home</Link>.
        </p>
      </Card>
    </section>
  );
}
