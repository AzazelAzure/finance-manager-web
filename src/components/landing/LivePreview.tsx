import { livePreviewData } from "./livePreviewData";
import { KPI } from "../ui/KPI";
import type { ReactNode } from "react";

export function LivePreview(): ReactNode {
  return (
    <section className="landing-section" aria-labelledby="live-preview-title">
      <h2 id="live-preview-title">Static preview</h2>
      <p className="muted" style={{ margin: "0 0 var(--space-3) 0" }}>
        Numbers below are <strong>demo data</strong> to illustrate the UI — not your account.
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
        <div className="table-wrap" role="table" aria-label="Sample transactions">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {livePreviewData.rows.map((r) => (
                <tr key={`${r.when}-${r.what}`}>
                  <td>{r.when}</td>
                  <td>{r.what}</td>
                  <td>{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
