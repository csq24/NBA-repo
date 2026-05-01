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

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
