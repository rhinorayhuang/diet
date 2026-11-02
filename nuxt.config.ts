// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 自用 PWA：純前端渲染，server routes 仍在 Nitro 上執行
  ssr: false,

  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: '飲食記錄',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'theme-color', content: '#16a34a' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  runtimeConfig: {
    // 由 NUXT_ANTHROPIC_API_KEY 覆寫，只存在伺服器端
    anthropicApiKey: '',
  },

  supabase: {
    types: '~~/shared/types/database.types.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
    },
    // PRD 3.1：約 30 天免重新登入
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: true,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: '飲食記錄',
      short_name: '飲食記錄',
      lang: 'zh-TW',
      display: 'standalone',
      start_url: '/',
      theme_color: '#16a34a',
      background_color: '#ffffff',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
    },
  },
})
