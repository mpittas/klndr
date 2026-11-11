/**
 * The security headers every page of the web app is served with. One list, used by the Vercel build
 * (`scripts/build-vercel.mjs`) and by `vite preview`, so a local production preview behaves like the live
 * site. `firebase.json` cannot import code, so it carries a copy: keep it in step with this file.
 *
 * The Content-Security-Policy allows only what the app needs: its own files, Firebase Auth's sign-in
 * popup (the auth domain's iframe and Google's `apis.google.com` loader), Google and Apple sign-in frames,
 * and the Google APIs that Firebase Auth and Firestore talk to. Profile photos come from the sign-in
 * provider, so images may load from any https origin. Styles allow inline `style` attributes, which React
 * and the notes renderer set; scripts never run inline.
 */

/** The Firebase Auth domain the app signs in through (the `VITE_FIREBASE_AUTH_DOMAIN` value). */
export const DEFAULT_AUTH_DOMAIN = "klndr-app.firebaseapp.com";

/**
 * @param {{ authDomain?: string }} [options]
 * @returns {Record<string, string>}
 */
export function securityHeaders({ authDomain = DEFAULT_AUTH_DOMAIN } = {}) {
  const auth = `https://${authDomain}`;
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.googleapis.com https://apis.google.com ${auth}`,
    // 'self' covers the sign-in helper when it is proxied under this site's own `/__/auth/` (build-vercel.mjs).
    `frame-src 'self' ${auth} https://accounts.google.com https://appleid.apple.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    // Two years of HTTPS only, for this host and its subdomains.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    // Older browsers that ignore `frame-ancestors`: the app is never shown inside another site.
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()",
    // Keeps other sites' windows away from this one, but still lets the Google/Apple sign-in popups report back.
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}
