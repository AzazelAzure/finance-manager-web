import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Tab = { id: string; label: string; blurb: string };

const TABS: Tab[] = [
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

  function renderPreview(tab: Tab): ReactNode {
    if (tab.id === "dash") {
      return (
        <div className="showcase-preview">
          <div className="showcase-preview__kpis">
            <span>Income +4,250</span>
            <span>Spend -2,180</span>
            <span>Safe to spend 890</span>
          </div>
          <div className="showcase-preview__bars" aria-hidden>
            <i style={{ height: "65%" }} />
            <i style={{ height: "42%" }} />
            <i style={{ height: "76%" }} />
            <i style={{ height: "38%" }} />
            <i style={{ height: "58%" }} />
            <i style={{ height: "49%" }} />
          </div>
        </div>
      );
    }
    if (tab.id === "tx") {
      return (
        <div className="showcase-preview">
          <div className="showcase-preview__chips">
            <span>Apr 2026</span>
            <span>Expense</span>
            <span>Groceries</span>
          </div>
          <ul className="showcase-preview__rows" aria-hidden>
            <li><b>Whole Foods</b><em>-84.20 USD</em></li>
            <li><b>Payroll</b><em>+2,000.00 USD</em></li>
            <li><b>Transfer to Savings</b><em>-300.00 USD</em></li>
          </ul>
        </div>
      );
    }
    if (tab.id === "bills") {
      return (
        <div className="showcase-preview">
          <ul className="showcase-preview__rows" aria-hidden>
            <li><b>Rent</b><em>Due in 3 days</em></li>
            <li><b>Internet</b><em>Auto-paid monthly</em></li>
            <li><b>Credit Card</b><em>Due next week</em></li>
          </ul>
          <div className="showcase-preview__progress" aria-hidden>
            <span style={{ width: "70%" }} />
          </div>
        </div>
      );
    }
    return (
      <div className="showcase-preview">
        <div className="showcase-preview__chips">
          <span>Sources</span>
          <span>Categories</span>
          <span>Tags</span>
        </div>
        <ul className="showcase-preview__rows" aria-hidden>
          <li><b>Checking</b><em>USD 2,500</em></li>
          <li><b>Dining Out</b><em>12 tx / month</em></li>
          <li><b>#travel</b><em>8 tagged entries</em></li>
        </ul>
      </div>
    );
  }

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
            {renderPreview(t)}
            <p className="showcase__panel-copy muted">
              {t.blurb}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
