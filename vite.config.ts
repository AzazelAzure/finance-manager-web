import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const clientBuild = JSON.stringify(
  process.env.VITE_CLIENT_BUILD?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    "dev",
);

// https://vite.dev/config/
export default defineConfig({
  define: {
    __FM_CLIENT_BUILD__: clientBuild,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png", "manifest.webmanifest"],
      manifest: false,
      strategies: "generateSW",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        /**
         * Do not register a separate Workbox route for `request.mode === "navigate"`.
         * generateSW already adds `NavigationRoute(createHandlerBoundToURL("/index.html"))`, which
         * serves the precached SPA shell when offline. A second navigate handler (e.g.
         * StaleWhileRevalidate) can match navigations and, on an empty cache after site-data reset,
         * try the network first and surface a hard document load failure (e.g. ERR_ADDRESS_UNREACHABLE)
         * before precache can satisfy the request.
         */
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: [
      "jsdevtesting.thehivemanager.com",
      "api-jsdevtesting.thehivemanager.com",
      ".thehivemanager.com",
      "localhost",
      "127.0.0.1",
    ],
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: [
      "jsdevtesting.thehivemanager.com",
      "api-jsdevtesting.thehivemanager.com",
      ".thehivemanager.com",
      "localhost",
      "127.0.0.1",
    ],
  },
})
