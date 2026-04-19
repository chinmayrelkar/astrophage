import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/events": "http://gentoo.wholphin-vibes.ts.net:3001",
      "/transcript": "http://gentoo.wholphin-vibes.ts.net:3001",
      "/health": "http://gentoo.wholphin-vibes.ts.net:3001",
    },
  },
})
