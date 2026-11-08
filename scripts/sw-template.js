/* Public shell only: never store API requests, bearer tokens or auth callbacks. */
const CACHE = __CACHE_NAME__;
const ASSETS = __PRECACHE_ASSETS__;
const PRECACHE = new Set(ASSETS);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("structure-planner-planner-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    request.headers.has("authorization") ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/planner/api/") ||
    url.pathname.startsWith("/redirect") ||
    url.search
  )
    return;
  if (request.mode === "navigate" && url.pathname === "/planner/") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(CACHE)
          .then((cache) => cache.match("/planner/"))
          .then((response) => response || Response.error()),
      ),
    );
  } else if (PRECACHE.has(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(request))
        .then((response) => response || fetch(request)),
    );
  }
});
