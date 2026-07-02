import { describe, expect, it } from "vitest";
import { profileTodayIso, isDueOnProfileToday } from "./profileDate";

describe("profileTodayIso", () => {
  it("uses profile timezone, not browser UTC date", () => {
    // 2026-07-01 22:00 UTC is already 2026-07-02 in Asia/Manila (UTC+8).
    const instant = new Date("2026-07-01T22:00:00.000Z");
    expect(profileTodayIso("UTC", instant)).toBe("2026-07-01");
    expect(profileTodayIso("Asia/Manila", instant)).toBe("2026-07-02");
  });

  it("resolves behind UTC when profile is behind browser calendar day", () => {
    // 2026-07-02 02:00 UTC is still 2026-07-01 in America/Los_Angeles (PDT).
    const instant = new Date("2026-07-02T02:00:00.000Z");
    expect(profileTodayIso("UTC", instant)).toBe("2026-07-02");
    expect(profileTodayIso("America/Los_Angeles", instant)).toBe("2026-07-01");
  });
});

describe("isDueOnProfileToday", () => {
  it("matches due date to profile today", () => {
    const instant = new Date("2026-07-01T22:00:00.000Z");
    expect(isDueOnProfileToday("2026-07-02", "Asia/Manila", instant)).toBe(true);
    expect(isDueOnProfileToday("2026-07-01", "Asia/Manila", instant)).toBe(false);
  });
});
