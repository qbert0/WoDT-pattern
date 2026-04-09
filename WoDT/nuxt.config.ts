// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ]
    }
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  
  runtimeConfig: {
    dittoBaseUrl: process.env.NUXT_PUBLIC_DITTO_BASE_URL,
    dittoWsUrl: process.env.NUXT_PUBLIC_DITTO_WS_URL,
    dittoUsername: process.env.NUXT_PUBLIC_DITTO_USERNAME,
    dittoPassword: process.env.NUXT_PUBLIC_DITTO_PASSWORD,

    public: {
      appName: 'Smart Home Dashboard'
    }
  },
})
