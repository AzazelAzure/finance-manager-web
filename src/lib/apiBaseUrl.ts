/**
 * Production uses `VITE_API_BASE_URL` (usually https://api.thehivemanager.com).
 * On the staging *web* hostname, use `VITE_STAGING_API_BASE_URL` so the SPA talks to the
 * inactive color API (see proxy: api-jsdevtesting -> api-{inactive}).
 */
export function resolveApiBaseUrl(): string {
  const productionBase =
    import.meta.env.VITE_API_BASE_URL ?? "https://api.thehivemanager.com";
  const stagingBase = import.meta.env.VITE_STAGING_API_BASE_URL;
  if (typeof window === "undefined" || !stagingBase) {
    return productionBase;
  }
  if (window.location.hostname === "jsdevtesting.thehivemanager.com") {
    return stagingBase;
  }
  return productionBase;
}
