import { CTASection } from "../components/landing/CTASection";
import { FeatureShowcase } from "../components/landing/FeatureShowcase";
import { Hero } from "../components/landing/Hero";
import "../components/landing/landing.css";
import { LivePreview } from "../components/landing/LivePreview";
import { Roadmap } from "../components/landing/Roadmap";
import { ValueProps } from "../components/landing/ValueProps";
import type { ReactNode } from "react";

export function LandingPage(): ReactNode {
  return (
    <div className="landing-page">
      <Hero />
      <ValueProps />
      <FeatureShowcase />
      <LivePreview />
      <Roadmap />
      <CTASection />
    </div>
  );
}
