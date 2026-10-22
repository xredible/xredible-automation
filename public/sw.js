// Xredible service worker: lets the dashboard install as an app and shows a friendly page when offline.
// Pages and data always come from the network (nothing stale is cached).
const OFFLINE = "/offline.html"
const CACHE = "xd-offline-v1"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/app/icon-192.png"])))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})
