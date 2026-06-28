import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy API calls to the archive backend (server/) during development so the
  // browser talks to the same origin. In production set VITE_API_URL instead.
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
