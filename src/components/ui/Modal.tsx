import { clsx } from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, title, onClose, children, className }: Props): ReactNode {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) {
      return;
    }
    const el = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    el?.focus();
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="ui-modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        ref={panelRef}
        className={clsx("ui-modal-panel", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="row-between" style={{ margin: 0 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: "var(--font-lg)" }}>{title}</h2>
          <Button type="button" variant="secondary" onClick={onClose} aria-label="Close dialog">
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
