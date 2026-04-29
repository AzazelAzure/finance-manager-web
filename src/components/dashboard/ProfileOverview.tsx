import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import type { AppProfileResponse } from "../../api/types";
import { tr, useLocale } from "../../lib/i18n";

type Props = { profile: AppProfileResponse | null | undefined; isError: boolean };

export function ProfileOverview({ profile, isError }: Props): ReactNode {
  const locale = useLocale();
  const startWeekLabel = profile?.start_of_week === 0 ? "Sunday" : "Monday";
  if (isError || !profile) {
    return (
      <Card>
        <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
          {tr("dashboard.profile.title", locale)}
        </h3>
        <p className="muted-text" style={{ margin: 0 }}>
          {isError ? tr("dashboard.profile.loadError", locale) : tr("dashboard.profile.empty", locale)}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
        {tr("dashboard.profile.title", locale)}
      </h3>
      <ul className="profile-overview" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        <li>
          <strong>{tr("dashboard.profile.baseCurrency", locale)}:</strong> {profile.base_currency}
        </li>
        <li>
          <strong>{tr("dashboard.profile.timezone", locale)}:</strong> {profile.timezone}
        </li>
        <li>
          <strong>{tr("dashboard.profile.startOfWeek", locale)}:</strong> {startWeekLabel}
        </li>
        <li>
          <strong>{tr("dashboard.profile.spendAccounts", locale)}:</strong>{" "}
          {profile.spend_accounts?.length
            ? profile.spend_accounts.map((s) => (
                <span key={s} className="tx-badge" style={{ marginRight: 4 }}>
                  {s}
                </span>
              ))
            : "—"}
        </li>
      </ul>
      <div className="profile-overview__action">
        <Link to="/app/settings/profile" className="ui-btn ui-btn--secondary">
          {tr("dashboard.profile.edit", locale)}
        </Link>
      </div>
    </Card>
  );
}
