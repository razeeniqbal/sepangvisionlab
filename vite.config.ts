import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Own port, so it never collides with other local projects on Vite's default 5173.
  server: { port: 5180, strictPort: true },
  preview: { port: 5181 },
});
