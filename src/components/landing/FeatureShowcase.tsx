import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { tr, useLocale } from "../../lib/i18n";

type Tab = { id: string; labelKey: string; blurbKey: string };

const TABS: Tab[] = [
  { id: "dash", labelKey: "showcase.tabs.dashboard", blurbKey: "showcase.dashboard.blurb" },
  { id: "tx", labelKey: "showcase.tabs.transactions", blurbKey: "showcase.transactions.blurb" },
  { id: "bills", labelKey: "showcase.tabs.bills", blurbKey: "showcase.bills.blurb" },
  { id: "data", labelKey: "showcase.tabs.dataHub", blurbKey: "showcase.dataHub.blurb" },
];

const ROTATE_MS = 6000;

export function FeatureShowcase(): ReactNode {
  const locale = useLocale();
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
          <ul className="showcase-preview__rows" aria-hidden>
            <li><b>Checking</b><em>2,540.00 USD</em></li>
            <li><b>Credit Card</b><em>-450.00 USD</em></li>
            <li><b>Savings</b><em>6,200.00 USD</em></li>
          </ul>
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
      <h2 id="showcase-title">{tr("showcase.title", locale)}</h2>
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
            {tr(t.labelKey, locale)}
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
              {tr(t.blurbKey, locale)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
