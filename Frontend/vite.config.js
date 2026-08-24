import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    // Without strictPort, an occupied 8080 makes Vite silently start on the next
    // free port instead — and the backend's CORS origin and the verify-email link
    // are both pinned to 8080, so every API call would fail with a CORS error that
    // looks nothing like "wrong port". Fail loudly instead.
    strictPort: true,
  },
})
