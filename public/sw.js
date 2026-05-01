/* global self, clients */
/**
 * Minimal service worker for installable PWA (Chrome, Edge, Samsung Internet).
 * Proxies requests to the network so Next.js stays dynamic; bump this file when
 * you need users to pick up a new worker version after caching changes.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Do not intercept Next.js chunks/CSS/fonts. Let those use the default fetch path so a SW
 * bug or stale worker cannot strip styling from the app (unstyled HTML + "Loading…" forever).
 * Still register a fetch listener so installability checks are satisfied for same-origin pages.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/sw.js" ||
    req.destination === "style" ||
    req.destination === "script" ||
    req.destination === "font"
  ) {
    return;
  }

  event.respondWith(fetch(req));
});
