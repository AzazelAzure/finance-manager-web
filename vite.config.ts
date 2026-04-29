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

const defaultAllowedHosts = [
  'jsdevtesting.thehivemanager.com',
  'jsdevprodtest.thehivemanager.com',
  '.thehivemanager.com',
  'localhost',
  '127.0.0.1',
] as const

// Cloudflare → http://127.0.0.1:5173: Vite still runs the Host check (HTTPS-only skip applies when the *Vite* server uses TLS). vps-serve / tunnel: set FM_VITE_ALLOW_ALL_HOSTS=1 so dev works (Vite binds 127.0.0.1 only).
const allowAllHosts = process.env.FM_VITE_ALLOW_ALL_HOSTS === '1'
const devAllowedHosts = allowAllHosts ? (true as const) : [...defaultAllowedHosts]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stripHtmlCrossorigin()],
  server: {
    // `allowedHosts` is required when the app is opened via a tunnel hostname
    // (Host header = jsdevtesting...); otherwise Vite rejects the request.
    host: true,
    allowedHosts: devAllowedHosts,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: devAllowedHosts,
  },
})
