import { clsx } from "clsx";
import { useId, useState, type ReactNode } from "react";

export type TabDef = { id: string; label: string; content: ReactNode };

type Props = {
  tabs: TabDef[];
  className?: string;
  defaultIndex?: number;
};

export function Tabs({ tabs, className, defaultIndex = 0 }: Props): ReactNode {
  const [i, setI] = useState(defaultIndex);
  const base = useId();
  return (
    <div className={className}>
      <ul className="ui-tabs" role="tablist">
        {tabs.map((t, idx) => (
          <li key={t.id} role="none">
            <button
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={i === idx}
              aria-controls={`${base}-panel-${t.id}`}
              onClick={() => setI(idx)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
      {tabs[i] ? (
        <div
          role="tabpanel"
          id={`${base}-panel-${tabs[i].id}`}
          aria-labelledby={`${base}-tab-${tabs[i].id}`}
        >
          {tabs[i].content}
        </div>
      ) : null}
    </div>
  );
}

export function TabPanel({ className, children }: { className?: string; children: ReactNode }): ReactNode {
  return <div className={clsx(className)}>{children}</div>;
}
