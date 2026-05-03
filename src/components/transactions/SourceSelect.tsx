import type { ReactNode } from "react";
import type { SourceRow } from "../../api/types";

type Props = {
  id?: string;
  className?: string;
  value: string;
  sources: SourceRow[];
  /** When true, first option is empty (e.g. optional bill source). */
  allowEmpty?: boolean;
  emptyLabel: string;
  /** Shown when value is not in `sources` (e.g. legacy row) so the select stays controlled. */
  unknownSourceLabel?: string;
  onSourceChange: (source: string) => void;
};

export function SourceSelect({
  id,
  className = "ui-input",
  value,
  sources,
  allowEmpty = true,
  emptyLabel,
  unknownSourceLabel = "Other source",
  onSourceChange,
}: Props): ReactNode {
  const known = new Set(sources.map((r) => r.source));
  const trimmed = value.trim();
  const orphan = trimmed && !known.has(trimmed);

  return (
    <select
      id={id}
      className={className}
      value={orphan ? trimmed : trimmed && known.has(trimmed) ? trimmed : ""}
      onChange={(e) => onSourceChange(e.target.value)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {sources.map((row) => (
        <option key={row.source} value={row.source}>
          {row.source}
        </option>
      ))}
      {orphan ? (
        <option value={trimmed}>
          {trimmed} — {unknownSourceLabel}
        </option>
      ) : null}
    </select>
  );
}
