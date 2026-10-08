const CACHE_NAME = "atsx-store-v2";
const APP_SHELL = [
  "./","./index.html","./login.html","./X.html","./order.html","./topup.html",
  "./transfer.html","./topup-history.html","./transfer-history.html",
  "./Accessories.html","./mlbb.html","./PUBG.html","./honor.html","./freefire.html",
  "./gogo.html","./tg.html","./mlbborpubg.html","./product-detail.html",
  "./customer-service.html","./app.jpg","./AtsX.jpg","./Wallet.jpg"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});
