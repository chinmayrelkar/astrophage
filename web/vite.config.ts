import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/events": "http://127.0.0.1:3001",
      "/transcript": "http://127.0.0.1:3001",
      "/health": "http://127.0.0.1:3001",
      "/runs": "http://127.0.0.1:3001",
      "/task": "http://127.0.0.1:3001",
    },
  },
})
