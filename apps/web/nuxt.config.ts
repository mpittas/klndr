import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  // @klndr/core and @klndr/api ship TypeScript source, so both Vite builds have to compile them. Nuxt
  // also feeds this list into Nitro's `externals.inline`, which is what makes the server bundle them.
  build: {
    transpile: ["@klndr/core", "@klndr/api"],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "",
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "",
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "",
    },
  },
  routeRules: {
    "/**": {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
        // Nuxt inlines its hydration payload, hence 'unsafe-inline' for scripts. Everything
        // else is limited to this origin plus what Firebase Auth / Firestore need.
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://apis.google.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: https://*.googleusercontent.com",
          "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com wss://*.firebaseio.com",
          "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
        // Keep the Google sign-in popup working while isolating the app.
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      },
    },
    "/api/**": { headers: { "Cache-Control": "no-store" } },
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  app: {
    head: {
      title: "klndr. · Daily Task Scheduler",
      // viewport-fit=cover lets the layout use the safe-area insets (notch, home indicator);
      // interactive-widget makes Android resize the page, not overlay it, when the keyboard opens.
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      meta: [
        // Colors the browser chrome to match the page background in each theme.
        { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
        { name: "theme-color", content: "#313338", media: "(prefers-color-scheme: dark)" },
        {
          name: "description",
          content:
            "Plan your day on a calendar, then drag activities like cleaning, workouts and project work onto an hour-by-hour timeline.",
        },
      ],
      script: [
        {
          // Apply the saved (or OS) theme before first paint to avoid a light/dark flash.
          innerHTML:
            "try{var t=localStorage.getItem('klndr-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          tagPosition: "head",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
        },
        {
          rel: "icon",
          href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'><rect width='32' height='32' rx='8' fill='%230f172a'/><rect x='6' y='8' width='20' height='18' rx='3' stroke='white' stroke-width='2'/><path d='M19 5v4M13 5v4M6 14h20M11 18h3M11 21h7' stroke='white' stroke-width='2' stroke-linecap='round'/></svg>",
        },
      ],
    },
  },
});
