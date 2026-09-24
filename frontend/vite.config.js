import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ✅ Fix "This host is not allowed" when Vite is behind Nginx + a real domain
  server: {
    host: "0.0.0.0",           // important when running inside Docker
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1","ikarus-electric.com", "www.ikarus-electric.com","samehkhater.online", "www.samehkhater.online"],
  },
});
