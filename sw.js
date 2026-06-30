const CACHE = "waybook-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./reader.html",
  "./manifest.json",
  "./css/app.css",
  "./js/app.js",
  "./js/reader.js",
  "./data/catalog.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./books/skazki/ashik-kerib/book.json",
  "./books/skazki/ashik-kerib/meta.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
