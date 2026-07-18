/* ============================================================================
   Self-unregistering service worker.
   The cache-first SW was serving stale files during active development (edits
   "not showing", headshot hidden). This version removes itself and deletes all
   caches so the site ALWAYS loads fresh from the network. When the browser
   picks up this new sw.js it activates, wipes caches, unregisters, and reloads
   any open tabs. Re-introduce a proper caching SW before production if you want
   offline/PWA support again.
   ========================================================================== */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((c) => c.navigate(c.url));
      } catch (e) {}
    })()
  );
});

// No fetch handler → every request goes straight to the network (always fresh).
