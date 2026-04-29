# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- **Foundations (parity sweep P1 / BP1 prep)** — `PublicShell` + `ProtectedShell` with Reflex-style navigation (sidebar ≥900px, mobile strip, lucide icons), `tokens.css` theme variables + self-hosted Inter, `src/lib/breakpoints.ts` + `useBreakpoint`, shared UI primitives (Card, Button, Modal, DataTable, ChartFrame, Form field helpers, state components), `CookieBanner` with `fm_cookie_consent` cookie, React Query defaults in `lib/queryClient.ts`, auth session keys `fm_access_token` / `fm_refresh_token` with 401 → refresh queue + retry via axios interceptors, routes `/` and `/app/*` with dashboard at `/app/dashboard`.
- **Docker** — multi-stage image (`Node 22` → `nginx:alpine`) for static SPA, `ARG VITE_API_BASE_URL` at build time, and `docker/nginx-spa.conf` for client-side routing. Integrated with the ecosystem `docker-compose` / blue-green `web-blue` + `web-green` services and the proxy `jsdev*` `server_name` blocks.
