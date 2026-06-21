// Holy Warriors service worker — installable PWA + offline app shell.
const CACHE = "hw-shell-v9";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never cache writes
  const url = new URL(req.url);
  // Never intercept Supabase / cross-origin API calls — always go to network.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("/index.html", copy));
        return res;
      }).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Same-origin static assets: cache-first.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});

// Focus (or open) the app when a notification is tapped.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cls) => {
      for (const c of cls) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Web Push: show a notification even when the app/browser is closed.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Holy Warriors", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Holy Warriors";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png",
    data: { url: d.url || "/" }, tag: d.tag,
  }));
});
