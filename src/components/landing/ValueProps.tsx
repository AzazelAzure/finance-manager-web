import { Card } from "../ui/Card";
import type { ReactNode } from "react";

const PROPS: Array<{ title: string; text: string }> = [
  { title: "Clarity in one place", text: "Income, spend, and balances roll up to a single snapshot you can trust." },
  { title: "Bills, not surprises", text: "Track upcoming expenses and stay ahead of due dates and renewals." },
  { title: "Your data, your rules", text: "Tag, filter, and dig into sources and categories without the clutter." },
  { title: "Quick daily check-ins", text: "Open your dashboard, spot changes fast, and take action in a few clicks." },
];

export function ValueProps(): ReactNode {
  return (
    <section className="landing-section" aria-labelledby="value-props-title">
      <h2 id="value-props-title">Why people use Hive</h2>
      <div className="value-props">
        {PROPS.map((p) => (
          <Card className="value-prop" key={p.title}>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
