import type { QueryFunctionContext } from "@tanstack/react-query";

/** After mutations, briefly force network reads so PWA cache-first does not mask fresh server data. */
const PWA_READ_BYPASS_MS = 8_000;

let bypassUntilMs = 0;

export function requestPwaReadBypassAfterMutation(): void {
  bypassUntilMs = Date.now() + PWA_READ_BYPASS_MS;
}

export type PwaReadBypassOpts = {
  forceNetwork?: boolean;
};

export function shouldBypassPwaDataCache(opts?: PwaReadBypassOpts): boolean {
  return Boolean(opts?.forceNetwork) || Date.now() < bypassUntilMs;
}

/** Map React Query `queryFn` context to PWA read opts (`meta.forceNetwork` from useQuery meta). */
export function readOptsFromQuery(ctx: QueryFunctionContext): PwaReadBypassOpts {
  const meta = ctx.meta as { forceNetwork?: boolean } | undefined;
  return { forceNetwork: Boolean(meta?.forceNetwork) };
}
