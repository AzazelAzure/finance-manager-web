import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissSwUpdateBannerForBuild,
  FM_SW_DISMISSED_BUILD_KEY,
  shouldShowSwUpdateBanner,
} from "./swUpdateAck";

describe("swUpdateAck", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: () => null,
      get length() {
        return store.size;
      },
    } as Storage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns false without a controlling service worker", () => {
    vi.stubGlobal("navigator", { serviceWorker: undefined });
    expect(shouldShowSwUpdateBanner("build-a")).toBe(false);
  });

  it("returns false when dismissed build matches current", () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    dismissSwUpdateBannerForBuild("build-x");
    expect(shouldShowSwUpdateBanner("build-x")).toBe(false);
  });

  it("returns true when dismissed key is absent (same as never dismissed)", () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: { scriptURL: "http://x/sw.js" } } });
    expect(shouldShowSwUpdateBanner("new-build")).toBe(true);
  });
});
