import { resolve } from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static files for public_html/planner on Bluehost. The live preview build is unchanged.
export default defineConfig({
  base: "/planner/",
  publicDir: "bluehost-public",
  resolve: { tsconfigPaths: true },
  define: {
    "import.meta.env.VITE_BLUEHOST": JSON.stringify("1"),
  },
  plugins: [tailwindcss(), viteReact()],
  build: {
    outDir: "bluehost/planner",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "bluehost.html"),
    },
  },
});
