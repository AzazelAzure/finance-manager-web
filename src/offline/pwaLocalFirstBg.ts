/** Minimum age of a cached row before we schedule another PWA background network refresh (per cache id). */
export const PWA_BG_STALE_MS = 30_000;

const locks = new Map<string, Promise<void>>();

export function isPwaBackgroundStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt >= PWA_BG_STALE_MS;
}

/** Run `work` at most once per `cacheId` at a time; caller should gate with {@link isPwaBackgroundStale}. */
export function schedulePwaBackgroundWork(cacheId: string, work: () => Promise<void>): void {
  if (locks.has(cacheId)) {
    return;
  }
  const p = (async () => {
    try {
      await work();
    } finally {
      locks.delete(cacheId);
    }
  })();
  locks.set(cacheId, p);
  void p;
}
