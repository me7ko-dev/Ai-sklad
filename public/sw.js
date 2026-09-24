// Service worker: позволява инсталиране на телефона и работа без интернет.
// Когато няма връзка, показва запазената страница „Без интернет“,
// от която записите се пазят на телефона.
const CACHE = "sklad-v2";
const OFFLINE_PAGE = "/bez-internet";
const OFFLINE_URL = "/offline.html";

// Запазва страницата „Без интернет“ и файловете, които ѝ трябват.
async function cacheOfflinePage() {
  const cache = await caches.open(CACHE);
  await cache.add(OFFLINE_URL).catch(() => {});
  const response = await fetch(OFFLINE_PAGE, { cache: "no-store" });
  if (!response.ok || response.redirected) return;
  const html = await response.clone().text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  await Promise.all(
    assets.map(async (url) => {
      if (await cache.match(url)) return;
      const asset = await fetch(url).catch(() => null);
      if (asset && asset.ok) await cache.put(url, asset);
    }),
  );
  await cache.put(OFFLINE_PAGE, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflinePage().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Приложението казва „обнови“ при всяко отваряне с интернет — така след нова версия
// запазената страница също е нова.
self.addEventListener("message", (event) => {
  if (event.data === "refresh-offline") event.waitUntil(cacheOfflinePage().catch(() => {}));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Файловете на Next.js никога не се променят (имената им съдържат отпечатък).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        if (url.pathname !== OFFLINE_PAGE && (await caches.match(OFFLINE_PAGE))) {
          return Response.redirect(OFFLINE_PAGE, 302);
        }
        return (await caches.match(OFFLINE_PAGE)) || (await caches.match(OFFLINE_URL)) || Response.error();
      }),
    );
  }
});
