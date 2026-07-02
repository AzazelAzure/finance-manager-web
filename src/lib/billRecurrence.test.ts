import { describe, expect, it } from "vitest";
import { advanceBillDueDateIso, advanceSemimonthlyDueDate } from "./billRecurrence";

describe("advanceSemimonthlyDueDate", () => {
  it("alternates 1st and 15th", () => {
    expect(advanceSemimonthlyDueDate("2026-07-01")).toBe("2026-07-15");
    expect(advanceSemimonthlyDueDate("2026-07-15")).toBe("2026-08-01");
  });
});

describe("advanceBillDueDateIso", () => {
  it("advances monthly with day clamp", () => {
    expect(advanceBillDueDateIso("2026-01-31", { cadence: "monthly", custom_interval_days: null })).toBe(
      "2026-02-28",
    );
  });

  it("advances custom interval", () => {
    expect(
      advanceBillDueDateIso("2026-07-01", { cadence: "custom", custom_interval_days: 10 }),
    ).toBe("2026-07-11");
  });
});
