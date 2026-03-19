import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy para evitar CORS em dev — redireciona /api para o backend
    proxy: {
      "/api": "http://localhost:3333",
    },
  },
});
