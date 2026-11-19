
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true,
    // Forward API calls to the local FastAPI server during development:
    // /api/games -> http://localhost:8000/api/v1/games (same mapping as nginx.conf).
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/api(?!\/v1\/)/, "/api/v1"),
      },
    },
  },

  preview: {
    port: 4173,
    host: true,
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
