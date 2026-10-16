// https://nuxt.com/docs/api/configuration/nuxt-config
import { CATEGORY_ICONS } from "./shared/utils/icons";

export default defineNuxtConfig({
  compatibilityDate: "2026-10-01",
  // Mode SPA: halaman dirender di browser, semua data dilindungi oleh API di server
  ssr: false,
  devtools: { enabled: false },
  modules: ["@nuxt/icon"],

  // Ikon MingCute dibundel ke aplikasi (tanpa ambil dari internet). Ikon kategori didaftarkan manual karena namanya dinamis dari database.
  icon: {
    serverBundle: { collections: ["mingcute"] },
    clientBundle: { scan: true, icons: Object.values(CATEGORY_ICONS) },
  },
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "Dompet Manis",
      htmlAttrs: { lang: "id" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#f7dce4" },
      ],
      link: [
        { rel: "icon", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" },
      ],
    },
  },

  // Diisi lewat environment variable: NUXT_DATABASE_URL (atau DATABASE_URL), NUXT_APP_TIMEZONE
  runtimeConfig: {
    databaseUrl: "",
    appTimezone: "Asia/Jakarta",
  },

  routeRules: {
    "/**": {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      },
    },
    "/api/**": { headers: { "Cache-Control": "no-store" } },
  },
});
