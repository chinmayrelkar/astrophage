import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/astrophage-api": {
        target: "http://127.0.0.1:3001",
        rewrite: (path) => path.replace(/^\/astrophage-api/, ""),
      },
    },
  },
})
