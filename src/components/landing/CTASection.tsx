import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

export function CTASection(): ReactNode {
  const locale = useLocale();
  return (
    <section className="landing-section" aria-labelledby="cta-title">
      <div className="cta-block" id="cta-title">
        <h2 className="cta-block__title muted">
          {tr("cta.title", locale)}
        </h2>
        <Link to="/signup" style={{ textDecoration: "none" }}>
          <Button type="button">{tr("hero.getStarted", locale)}</Button>
        </Link>
      </div>
    </section>
  );
}
