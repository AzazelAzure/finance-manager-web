import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import type { ReactNode } from "react";

export function LandingPage(): ReactNode {
  return (
    <section className="stack" style={{ padding: "1rem 0" }}>
      <div>
        <h1 style={{ fontSize: "var(--font-2xl)", margin: "0 0 0.5rem" }}>Hive personal finance</h1>
        <p className="muted-text">Marketing pages and a richer landing experience ship in the next task.</p>
      </div>
      <Card>
        <p>
          <Link to="/login">Log in</Link> or <Link to="/signup">Create an account</Link> to get started.
        </p>
      </Card>
    </section>
  );
}
