
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true,
    // Forward API calls to the local FastAPI server during development.
    proxy: {
      "/api": "http://localhost:8000",
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
