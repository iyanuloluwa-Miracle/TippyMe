// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Disable heavy DevTools UI in production builds
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'vue-sonner/nuxt',
    ...(process.env.NODE_ENV === 'production' ? [] : ['@nuxt/eslint']),
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only secrets / config (Nitro owns /api — no Nest proxy).
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodbUri: process.env.MONGODB_URI || '',
    authSecret: process.env.AUTH_SECRET || '',
    otpHashPepper: process.env.OTP_HASH_PEPPER || '',
    // Empty default so Docker/build does not bake http://localhost into the image.
    // Runtime: set API_URL or NUXT_API_URL (https in production).
    apiUrl: process.env.API_URL || process.env.APP_URL || process.env.NUXT_API_URL || '',
    bachsApiKey: process.env.BACHS_API_KEY || '',
    bachsApiBaseUrl:
      process.env.BACHS_API_BASE_URL || 'https://sandbox-api.bachs.io',
    bachsWebhookSecret: process.env.BACHS_WEBHOOK_SECRET || '',
    bachsPlatformFeePercent: process.env.BACHS_PLATFORM_FEE_PERCENT || '5',
    resendApiKey: process.env.RESEND_API_KEY || '',
    // Empty default so Docker/Pxxl builds do not bake example.com into the image.
    // Runtime: set RESEND_FROM_EMAIL (preferred) or NUXT_RESEND_FROM_EMAIL.
    resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
    byteshipApiKey: process.env.BYTESHIP_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterApiBaseUrl:
      process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1',
    openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    logFormat: process.env.LOG_FORMAT || '',
    errorMonitoringDsn: process.env.ERROR_MONITORING_DSN || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    public: {
      // Empty → browser uses same-origin `/api` (Nitro handlers).
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000',
      // Empty → hide Continue with Google on login/signup.
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      sabilyticsSiteId: process.env.NUXT_PUBLIC_SABILYTICS_SITE_ID || '',
      sabilyticsDomain: process.env.NUXT_PUBLIC_SABILYTICS_DOMAIN || '',
      sabilyticsScriptUrl: process.env.NUXT_PUBLIC_SABILYTICS_SCRIPT_URL || '',
    },
  },

  app: {
    head: {
      title: 'TippyMe',
      meta: [
        {
          name: 'description',
          content:
            'One link for everyone who wants to support your work. TippyMe gives you a simple page to receive support and messages.',
        },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#9362ff' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@400;500;600;700;800&display=swap',
        },
      ],
      htmlAttrs: { lang: 'en' },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        ...(process.env.NODE_ENV === 'production'
          ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
          : {}),
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://www.sabilytics.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' https://www.sabilytics.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self' https://bachs.io https://*.bachs.io",
        ].join('; '),
      },
    },
    // Public support cards must be iframe-able on third-party sites.
    '/embed/**': {
      headers: {
        // Override site-wide DENY (empty clears clickjacking block for this path).
        'X-Frame-Options': '',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self'",
          "frame-ancestors *",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    },
  },
});
