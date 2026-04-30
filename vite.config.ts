import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `allowedHosts` is required when the app is opened via a tunnel hostname
    // (Host header = jsdevtesting...); otherwise Vite rejects the request.
    host: true,
    allowedHosts: [
      'jsdevtesting.thehivemanager.com',
      'api-jsdevtesting.thehivemanager.com',
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
      'api-jsdevtesting.thehivemanager.com',
      '.thehivemanager.com',
      'localhost',
      '127.0.0.1',
    ],
  },
})
