import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // The app shell precaches; runtime data (Supabase) stays network-first
      // so bookings/scans are never stale. Media stays out of the precache to
      // keep installs light.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/hero-video.mov", "**/migrated-assets/**", "**/reports/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Same-origin images (logos, coach photos…) — cache after first view.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: "Suffolk Tennis",
        short_name: "Suffolk Tennis",
        description:
          "Suffolk Tennis Partnership — performance pathway, bookings and events for players, parents and coaches.",
        theme_color: "#0e1d39",
        background_color: "#0e1d39",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Parent Hub", url: "/parent-hub", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Scan tickets", url: "/admin/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy libraries split out so the initial route loads lean and the
          // chunks cache independently across deploys.
          maplibre: ["maplibre-gl"],
          stripe: ["@stripe/stripe-js", "@stripe/react-stripe-js"],
          vendor: ["react", "react-dom", "react-router-dom", "framer-motion"],
        },
      },
    },
  },
}));
