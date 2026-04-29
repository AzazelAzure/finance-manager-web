import { livePreviewData } from "./livePreviewData";
import { KPI } from "../ui/KPI";
import { tr, useLocale } from "../../lib/i18n";
import type { ReactNode } from "react";

export function LivePreview(): ReactNode {
  const locale = useLocale();
  return (
    <section className="landing-section" aria-labelledby="live-preview-title">
      <h2 id="live-preview-title">{tr("preview.title", locale)}</h2>
      <p className="landing-note muted">
        {tr("preview.note", locale)}
      </p>
      <div
        className="live-preview"
        aria-label="Demo data"
        role="region"
      >
        <h3 className="sr-only">Demo data</h3>
        <div className="live-preview__kpis">
          {livePreviewData.kpi.map((k) => (
            <KPI key={k.label} label={k.label} value={k.value} />
          ))}
        </div>
        <div className="live-preview__layout">
          <div className="table-wrap" role="table" aria-label="Sample transactions">
            <table>
              <thead>
                <tr>
                  <th>{tr("preview.table.when", locale)}</th>
                  <th>{tr("preview.table.description", locale)}</th>
                  <th>{tr("preview.table.source", locale)}</th>
                  <th>{tr("preview.table.amount", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {livePreviewData.rows.map((r) => (
                  <tr key={`${r.when}-${r.what}`}>
                    <td>{r.when}</td>
                    <td>{r.what}</td>
                    <td>{r.source}</td>
                    <td>{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="live-preview__aside" aria-label="Sample source balances">
            <h4>{tr("preview.sourceBalances", locale)}</h4>
            <ul>
              {livePreviewData.balances.map((b) => (
                <li key={b.source}>
                  <span>{b.source}</span>
                  <b>{b.amount}</b>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
