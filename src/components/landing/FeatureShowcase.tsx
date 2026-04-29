import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const TABS: Array<{ id: string; label: string; blurb: string }> = [
  { id: "dash", label: "Dashboard", blurb: "KPIs, flow charts, and source balances in one view." },
  { id: "tx", label: "Transactions", blurb: "Filter, tag, and drill in without leaving the table." },
  { id: "bills", label: "Bills", blurb: "Recurring, paid, and upcoming in a pipeline you can scan in seconds." },
  { id: "data", label: "Data hub", blurb: "Sources, categories, and tags stay tidy as your life changes." },
];

const ROTATE_MS = 6000;

export function FeatureShowcase(): ReactNode {
  const base = useId();
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const tref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pause) {
      if (tref.current) {
        clearInterval(tref.current);
        tref.current = null;
      }
      return;
    }
    tref.current = setInterval(() => {
      setI((x) => (x + 1) % TABS.length);
    }, ROTATE_MS);
    return () => {
      if (tref.current) {
        clearInterval(tref.current);
      }
    };
  }, [pause]);

  return (
    <section className="landing-section" aria-labelledby="showcase-title" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}>
      <h2 id="showcase-title">In the app</h2>
      <div
        className="showcase__tabs"
        role="tablist"
        aria-label="Product areas"
        onFocusCapture={() => setPause(true)}
        onBlurCapture={() => setPause(false)}
      >
        {TABS.map((t, idx) => (
          <button
            key={t.id}
            type="button"
            className="showcase__tab"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={i === idx}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => setI(idx)}
            aria-controls={`${base}-panel-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="showcase-fade" aria-live="polite">
        {TABS.map((t, idx) => (
          <div
            key={t.id}
            className={
              idx === i ? "showcase__panel-absolute showcase__panel-absolute--on" : "showcase__panel-absolute"
            }
            id={`${base}-panel-${t.id}`}
            role="tabpanel"
            tabIndex={i === idx ? 0 : -1}
            hidden={i !== idx}
            aria-labelledby={`${base}-tab-${t.id}`}
          >
            <p className="muted" style={{ margin: 0 }}>
              {t.blurb}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
