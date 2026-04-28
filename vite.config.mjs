import { defineConfig } from "vite";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: path.resolve(process.cwd(), "src"),
  base: "./",
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: path.resolve(process.cwd(), "dist-renderer"),
    emptyOutDir: true,
  },
});
