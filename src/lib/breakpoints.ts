import { useSyncExternalStore } from "react";

/** Pixels, aligned with `tokens.css` `--bp-*` and Reflex `index.css`. */
export const BP = {
  sm: 640,
  md: 900,
  lg: 1200,
  xl: 1440,
} as const;

function isAtOrAbove(minWidth: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.innerWidth >= minWidth;
}

export function getBreakpointSnapshot(): {
  atOrAboveSm: boolean;
  atOrAboveMd: boolean;
  atOrAboveLg: boolean;
  atOrAboveXl: boolean;
} {
  return {
    atOrAboveSm: isAtOrAbove(BP.sm),
    atOrAboveMd: isAtOrAbove(BP.md),
    atOrAboveLg: isAtOrAbove(BP.lg),
    atOrAboveXl: isAtOrAbove(BP.xl),
  };
}

const serverSnap = {
  atOrAboveSm: false,
  atOrAboveMd: false,
  atOrAboveLg: false,
  atOrAboveXl: false,
};

/**
 * `atOrAboveMd` matches protected shell: sidebar (≥900px) vs horizontal strip (<900px).
 */
export function useBreakpoint(): {
  atOrAboveSm: boolean;
  atOrAboveMd: boolean;
  atOrAboveLg: boolean;
  atOrAboveXl: boolean;
} {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }
      const widths = Object.values(BP) as number[];
      const mqls = widths.map((w) => window.matchMedia(`(min-width: ${w}px)`));
      const cb = (): void => onChange();
      mqls.forEach((m) => m.addEventListener("change", cb));
      window.addEventListener("resize", cb);
      return () => {
        mqls.forEach((m) => m.removeEventListener("change", cb));
        window.removeEventListener("resize", cb);
      };
    },
    getBreakpointSnapshot,
    () => serverSnap,
  );
}
