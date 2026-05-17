const CACHE = "inboxd-v1"
const SHELL = ["/", "/sign-in", "/manifest.json", "/icon.svg"]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Never intercept auth or AI routes — must go to network
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/ai")) {
    return
  }

  // Network-first for API routes — return offline stub on failure
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "offline", messages: [] }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    )
    return
  }

  // Stale-while-revalidate for pages and static assets
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request)
      const networkFetch = fetch(e.request)
        .then((res) => {
          if (res.ok && e.request.method === "GET") cache.put(e.request, res.clone())
          return res
        })
        .catch(() => cached ?? new Response("Offline", { status: 503 }))
      return cached ?? networkFetch
    })
  )
})
