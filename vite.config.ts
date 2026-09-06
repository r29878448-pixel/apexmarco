// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Cloudflare Pages builds set CF_PAGES; that target needs the Pages layout
// (dist/_worker.js + static assets in dist), not the standalone worker layout.
const isCloudflarePages = process.env["CF_PAGES"] === "1" || !!process.env["CF_PAGES_BRANCH"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    ...(isCloudflarePages ? { preset: "cloudflare-pages", output: { dir: "dist" } } : {}),
    cloudflare: {
      // Cloudflare needs Node compatibility for the SSR worker, otherwise the
      // deployed site fails to render on the first request.
      nodeCompat: true,
    },
  },
});
