import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import type { ReactNode } from "react";

export function CTASection(): ReactNode {
  return (
    <section className="landing-section" aria-labelledby="cta-title">
      <div className="cta-block" id="cta-title">
        <h2 className="cta-block__title muted">
          Ready to try it?
        </h2>
        <Link to="/signup" style={{ textDecoration: "none" }}>
          <Button type="button">Get started</Button>
        </Link>
      </div>
    </section>
  );
}
