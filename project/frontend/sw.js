const CACHE_NAME = "streetbite-pos-v2";

// Add the new app.js file to the vault!
const ASSETS = ["./", "./index.html", "./app.js", "./Biryani.jpg"];

// 1. Install phase: Download and save the assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
});

// 2. Fetch phase: Intercept network requests
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }),
  );
});
