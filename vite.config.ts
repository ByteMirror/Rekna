import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ignoredWatchRoots = [
  resolve(__dirname, "apps/desktop/build"),
  resolve(__dirname, "apps/desktop/dist"),
  resolve(__dirname, "tmp"),
].map((path) => path.replaceAll("\\", "/"));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/browser",
  resolve: {
    alias: {
      "@": resolve(__dirname, "apps/desktop/src/browser"),
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: (path) => {
        const normalizedPath = path.replaceAll("\\", "/");
        return ignoredWatchRoots.some(
          (root) =>
            normalizedPath === root || normalizedPath.startsWith(`${root}/`)
        );
      },
    },
  },
});
