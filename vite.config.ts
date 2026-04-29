import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vite injects `crossorigin` on built script/link tags, which forces CORS-mode fetches. Some TLS/proxy stacks omit ACAO on static files and the module fails to evaluate (white screen). Production assets are same-origin; strip for the SPA build only. */
function stripHtmlCrossorigin(): Plugin {
  return {
    name: 'strip-html-crossorigin',
    apply: 'build',
    transformIndexHtml(html) {
      return html
        .replace(/\s+crossorigin="anonymous"/g, '')
        .replace(/\s+crossorigin=""/g, '')
        .replace(/\s+crossorigin/g, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stripHtmlCrossorigin()],
  server: {
    // `allowedHosts` is required when the app is opened via a tunnel hostname
    // (Host header = jsdevtesting...); otherwise Vite rejects the request.
    host: true,
    allowedHosts: [
      'jsdevtesting.thehivemanager.com',
      'jsdevprodtest.thehivemanager.com',
      '.thehivemanager.com',
      'localhost',
      '127.0.0.1',
    ],
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: [
      'jsdevtesting.thehivemanager.com',
      'jsdevprodtest.thehivemanager.com',
      '.thehivemanager.com',
      'localhost',
      '127.0.0.1',
    ],
  },
})
