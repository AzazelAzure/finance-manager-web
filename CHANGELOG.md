# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixed

- **Session + landing CTA** — UI auth (`isAuthenticated`) and the axios `Authorization` header use **effective** access tokens: JWT `exp` is checked with clock skew, and expired JWTs are treated as no session (no `Authorization` sent) so the hero’s **Open app** only appears when a session is usable. **Recharts** dashboard charts use explicit `ResponsiveContainer` size and `min-width: 0` on flex columns to avoid width/height -1 measurement warnings.
- **React #185 (max update depth) on Open app / dashboard** — `SessionProvider` no longer runs a mount effect that called `clearSession` + `queryClient.clear()` when the stored JWT was expired (that cascaded with React Query and could blow the update depth). `useSyncExternalStore` now uses the same `getAccessSnapshot` for the server snapshot as for the client so CSR hydration stays consistent. Dashboard snapshot loading keys off `searchParams.toString()` with a stable `queryFn` so React Query does not see a new fetcher every render.
- **React #185 after login (dashboard)** — `useBreakpoint()` returned a **new object from `getBreakpointSnapshot` on every call**, so `useSyncExternalStore` treated the store as changed every render (infinite updates once `RecentTransactions` / `DataTable` mounted). Snapshots are now **referentially stable** when breakpoint flags are unchanged; server snapshot uses the same getter as the client. `SessionProvider` memoizes context value; axios 401 handler dedupes `clearSession` + `queryClient.clear()` when many requests fail together; login relies on `<Navigate>` after `setSession` (no redundant `navigate()`).

### Added

- **Dashboard parity (P3 / T05–T07, BP3 prep)** — `/app/dashboard` uses API-driven filters (URL is the source of truth; **Apply** refetches; same signature dedupes via React Query), flow / daily spend (with income line toggle) / category + tag pies (tag totals from `transactions_for_month`), KPI row (eight metrics including N/A for safe-to-spend), source balances, recent transactions (desktop table + mobile cards), profile strip from `GET /finance/appprofile/`, quick-add links. Chart slice / tag drillthrough navigates to `/app/transactions?fromDashboard=1&…` (placeholder shows URL hints). New API helpers: `fetchAppSnapshot`, profile + tag/category/source lookups. `GET /app/transactions/new?type=` placeholder route.

### Fixed

- **Cookie notice + login autofill (post-BP1)** — Consent UI now keys off `localStorage` (`fm_cookie_consent_v1`) so a broad `Domain=.thehivemanager.com` cookie no longer suppresses the banner in incognito; on HTTPS we also set a host-only `__Host-fm_cookie_consent` cookie when accepting. Login form uses `autocomplete="off"`, per-field `unlockOnFocus` (readOnly until first focus) to avoid load-time autofill, and copy clarifies browser password managers may still offer after focus.

### Added

- **Public surface (P2 / T03–T04)** — Marketing-style `/` with hero, value props, feature showcase (auto-rotate + cross-fade, reduced-motion safe), static live preview, roadmap, CTA; `LocalePicker` in `PublicShell` with `fm_locale` cookie; `lib/i18n.ts` stub. `/signup` with RHF + zod, `POST /finance/user/` then token login, redirect to `/app/dashboard`; `api/user.ts` create helper.
- **Foundations (parity sweep P1 / BP1 prep)** — `PublicShell` + `ProtectedShell` with Reflex-style navigation (sidebar ≥900px, mobile strip, lucide icons), `tokens.css` theme variables + self-hosted Inter, `src/lib/breakpoints.ts` + `useBreakpoint`, shared UI primitives (Card, Button, Modal, DataTable, ChartFrame, Form field helpers, state components), `CookieBanner` with `fm_cookie_consent` cookie, React Query defaults in `lib/queryClient.ts`, auth session keys `fm_access_token` / `fm_refresh_token` with 401 → refresh queue + retry via axios interceptors, routes `/` and `/app/*` with dashboard at `/app/dashboard`.
- **Docker** — multi-stage image (`Node 22` → `nginx:alpine`) for static SPA, `ARG VITE_API_BASE_URL` at build time, and `docker/nginx-spa.conf` for client-side routing. Integrated with the ecosystem `docker-compose` / blue-green `web-blue` + `web-green` services and the proxy `jsdev*` `server_name` blocks.
