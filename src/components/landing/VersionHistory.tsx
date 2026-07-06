import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";

export function VersionHistory(): ReactNode {
  const locale = useLocale();
  
  const history = [
    {
      date: tr("history.v1_4.date", locale),
      title: tr("history.v1_4.title", locale),
      desc: tr("history.v1_4.desc", locale),
    },
    {
      date: tr("history.v1_3.date", locale),
      title: tr("history.v1_3.title", locale),
      desc: tr("history.v1_3.desc", locale),
    },
    {
      date: tr("history.v1_2.date", locale),
      title: tr("history.v1_2.title", locale),
      desc: tr("history.v1_2.desc", locale),
    },
    {
      date: tr("history.v1_1.date", locale),
      title: tr("history.v1_1.title", locale),
      desc: tr("history.v1_1.desc", locale),
    },
    {
      date: tr("history.v1_0.date", locale),
      title: tr("history.v1_0.title", locale),
      desc: tr("history.v1_0.desc", locale),
    }
  ];

  return (
    <section className="landing-section version-history" aria-labelledby="history-title">
      <h2 id="history-title">{tr("history.title", locale)}</h2>
      <p className="landing-note muted text-center">
        {tr("history.subtitle", locale)}
      </p>
      <div className="history-timeline">
        {history.map((item) => (
          <div className="history-item" key={item.title}>
            <div className="history-item__marker" aria-hidden></div>
            <Card className="history-item__content">
              <span className="history-item__date">{item.date}</span>
              <h3 className="history-item__title">{item.title}</h3>
              <p className="history-item__desc">{item.desc}</p>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
