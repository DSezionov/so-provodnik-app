import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from https://<user>.github.io/<repo>/
const BASE = "/so-provodnik-app/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the user taps «Обновить» in the banner (SPEC §5.7), so nothing reloads mid-use.
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Provodnik — Stay Out",
        short_name: "Provodnik",
        description: "Планировщик заданий Stay Out: маршрут и чек-лист по данным so-wiki.ru",
        lang: "ru",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#0f1115",
        theme_color: "#0f1115",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell + wiki data JSON are precached so everything works offline after the first visit.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json,webmanifest}"],
        // The full quests.json is several MB; Workbox silently skips files over 2 MB by default.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        // After «Обновить» the new worker takes over open tabs (incl. a first visit that had no worker yet),
        // which triggers the reload. It still activates only on the user's tap (registerType "prompt").
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
