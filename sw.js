/* Service Worker der Website (Wurzel, damit er alle Seiten abdeckt).
   - Seiten, Daten, Skripte: zuerst das Netz, damit immer der neueste Stand erscheint; ohne Netz die
     zuletzt gesehene Fassung, sonst offline.html
   - Bilder: aus dem Speicher, im Hintergrund erneuert
   - Verwaltung, Videos, Audio und Teilantworten bleiben ausserhalb
   Neue Fassung der Dateien in VORRAT: Namen von CACHE erhoehen. */
const CACHE = 'aug-v1';
const VORRAT = ['offline.html', 'css/style.css', 'assets/logo.png', 'assets/logo-gold.png'];
const root = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(VORRAT.map((p) => root + p))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const nurNetz = /\.(?:mp4|webm|mp3|m4a|ogg|wav|pdf)$/i;
const bild = /\.(?:webp|png|jpe?g|gif|svg|ico)$/i;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) return;
  if (!url.pathname.startsWith(root) || url.pathname.startsWith(root + 'admin/') || nurNetz.test(url.pathname) || url.pathname.endsWith('/sw.js')) return;

  if (bild.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const alt = await c.match(req);
      const neu = fetch(req).then((r) => {
        if (r.ok) c.put(req, r.clone());
        return r;
      }).catch(() => alt);
      return alt || neu;
    }));
    return;
  }

  e.respondWith(fetch(req).then((r) => {
    if (r.ok) {
      const kopie = r.clone();
      caches.open(CACHE).then((c) => c.put(req, kopie));
    }
    return r;
  }).catch(async () => {
    const c = await caches.open(CACHE);
    const alt = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (alt) return alt;
    if (req.mode === 'navigate') return c.match(root + 'offline.html');
    return Response.error();
  }));
});
