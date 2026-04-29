# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- **Docker** — multi-stage image (`Node 22` → `nginx:alpine`) for static SPA, `ARG VITE_API_BASE_URL` at build time, and `docker/nginx-spa.conf` for client-side routing. Integrated with the ecosystem `docker-compose` / blue-green `web-blue` + `web-green` services and the proxy `jsdev*` `server_name` blocks.

### Fixed

- **Podman / Fedora** — final stage uses `docker.io/library/nginx:1.27-alpine` so builds succeed when `/etc/containers/registries.conf` has no `unqualified-search-registries` (short name `nginx:…` fails).
