import { describe, expect, it } from "vitest";
import { isApiReachabilityRecovery } from "./connectivity";

describe("isApiReachabilityRecovery", () => {
  it("is false when not ok", () => {
    expect(isApiReachabilityRecovery({ ok: false, previous: true })).toBe(false);
    expect(isApiReachabilityRecovery({ ok: false, previous: false })).toBe(false);
  });

  it("is false when ok but already known-good (routine success)", () => {
    expect(isApiReachabilityRecovery({ ok: true, previous: true })).toBe(false);
  });

  it("is true when ok and recovering from unreachable or unknown", () => {
    expect(isApiReachabilityRecovery({ ok: true, previous: false })).toBe(true);
    expect(isApiReachabilityRecovery({ ok: true, previous: null })).toBe(true);
  });

  it("is false for missing detail", () => {
    expect(isApiReachabilityRecovery(undefined)).toBe(false);
  });
});
