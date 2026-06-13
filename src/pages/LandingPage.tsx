import { CTASection } from "../components/landing/CTASection";
import { FeatureShowcase } from "../components/landing/FeatureShowcase";
import { Hero } from "../components/landing/Hero";
import "../components/landing/landing.css";
import { LivePreview } from "../components/landing/LivePreview";
import { Roadmap } from "../components/landing/Roadmap";
import { ValueProps } from "../components/landing/ValueProps";
import { VersionHistory } from "../components/landing/VersionHistory";
import type { ReactNode } from "react";
import { tr, useLocale } from "../lib/i18n";
import { Helmet } from "react-helmet-async";

export function LandingPage(): ReactNode {
  const locale = useLocale();

  return (
    <main className="landing-page">
      <Helmet>
        <title>{tr("landing.seo.title", locale) || "Finance Manager | Secure, Offline-First Personal Finance"}</title>
        <meta name="description" content={tr("landing.seo.desc", locale) || "A private, local-first personal finance app. Track bills, budgets, and accounts with total clarity. No ads, no data selling, just your money under your control."} />
      </Helmet>
      <Hero />
      <ValueProps />
      <FeatureShowcase />
      <LivePreview />
      <Roadmap />
      <VersionHistory />
      <CTASection />
    </main>
  );
}
