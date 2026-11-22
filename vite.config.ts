import { defineConfig } from "vite";
export default defineConfig({
  root: "app",
  base: "/tool/",
  build: {
    outDir: "../dist/tool",
    emptyOutDir: false,
    rollupOptions: {
      output: { entryFileNames: "assets/tool.js", assetFileNames: "assets/tool.css" }
    }
  }
});