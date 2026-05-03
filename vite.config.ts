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
        runtimeCaching: [
          {
            /** SPA shell: serve cached HTML/entry immediately (fast offline reload), refresh in background when online. */
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pages",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
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
