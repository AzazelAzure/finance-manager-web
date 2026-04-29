# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- **Docker** — multi-stage image (`Node 22` → `nginx:alpine`) for static SPA, `ARG VITE_API_BASE_URL` at build time, and `docker/nginx-spa.conf` for client-side routing. Integrated with the ecosystem `docker-compose` / blue-green `web-blue` + `web-green` services and the proxy `jsdev*` `server_name` blocks.

### Fixed

- **Podman / Fedora** — final stage uses `docker.io/library/nginx:1.27-alpine` so builds succeed when `/etc/containers/registries.conf` has no `unqualified-search-registries` (short name `nginx:…` fails).

- **White screen behind TLS/proxy** — production HTML no longer adds `crossorigin` on built `<script type="module">` / CSS (Vite default + CORS-mode fetch can fail if an edge omits `Access-Control-Allow-Origin` on static JS). Nginx SPA config adds `Access-Control-Allow-Origin: *` for `/assets/` and returns **204** for `GET /favicon.ico` to avoid a spurious 404.

- **Vite 403 “Blocked request… allowedHosts”** (tunnel to `:5173` / preview) — `scripts/vps-serve.sh` sets `FM_VITE_ALLOW_ALL_HOSTS=1` so dev/preview accept the Cloudflare `Host` header. Alternatively point the tunnel at the compose **proxy:8443** (static `web-*`) to avoid Vite on the public hostname.
