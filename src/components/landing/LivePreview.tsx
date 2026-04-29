import { livePreviewData } from "./livePreviewData";
import { KPI } from "../ui/KPI";
import type { ReactNode } from "react";

export function LivePreview(): ReactNode {
  return (
    <section className="landing-section" aria-labelledby="live-preview-title">
      <h2 id="live-preview-title">Product preview</h2>
      <p className="landing-note muted">
        Numbers below are <strong>demo data</strong> showing how dashboard + ledger surfaces look in the current web app.
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
                  <th>When</th>
                  <th>Description</th>
                  <th>Source</th>
                  <th>Amount</th>
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
            <h4>Source balances</h4>
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
