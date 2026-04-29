# Multi-stage: Vite build -> nginx static (SPA) for docker-compose / blue-green.
# API URL is baked at build time (Vite); override with build-arg in compose.
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=https://api.thehivemanager.com
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Fully qualified for Podman hosts without unqualified-search registries (e.g. default Fedora).
FROM docker.io/library/nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
