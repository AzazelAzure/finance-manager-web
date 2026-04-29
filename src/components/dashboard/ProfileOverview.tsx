import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import type { AppProfileResponse } from "../../api/types";

type Props = { profile: AppProfileResponse | null | undefined; isError: boolean };

export function ProfileOverview({ profile, isError }: Props): ReactNode {
  if (isError || !profile) {
    return (
      <Card>
        <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
          Profile
        </h3>
        <p className="muted-text" style={{ margin: 0 }}>
          {isError ? "Profile settings could not be loaded." : "No profile data."}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <h3 className="muted" style={{ margin: "0 0 0.5rem" }}>
        Profile
      </h3>
      <ul className="profile-overview" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        <li>
          <strong>Base currency:</strong> {profile.base_currency}
        </li>
        <li>
          <strong>Timezone:</strong> {profile.timezone}
        </li>
        <li>
          <strong>Start of week (index):</strong> {profile.start_of_week}
        </li>
        <li>
          <strong>Spend accounts:</strong>{" "}
          {profile.spend_accounts?.length
            ? profile.spend_accounts.map((s) => (
                <span key={s} className="tx-badge" style={{ marginRight: 4 }}>
                  {s}
                </span>
              ))
            : "—"}
        </li>
      </ul>
      <div style={{ marginTop: "0.75rem" }}>
        <Link to="/app/settings/profile" className="ui-btn ui-btn--secondary" style={{ display: "inline-block" }}>
          Edit in settings
        </Link>
      </div>
    </Card>
  );
}
