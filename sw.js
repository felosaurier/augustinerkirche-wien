/* Service Worker der Website (Wurzel, damit er alle Seiten abdeckt).
   - Seiten, Daten, Skripte: zuerst das Netz, damit immer der neueste Stand erscheint; ohne Netz die
     zuletzt gesehene Fassung, sonst offline.html
   - Bilder: ebenfalls zuerst das Netz (beim Server nachgefragt, ob sich das Bild geaendert hat), ohne
     Netz das gespeicherte. Nie zuerst das gespeicherte zeigen: ein ersetztes oder geloeschtes und neu
     hochgeladenes Bild (z. B. Plakat mit gleichem Namen) erschiene sonst noch in der alten Fassung
   - Verwaltung, Videos, Audio und Teilantworten bleiben ausserhalb
   Neue Fassung der Dateien in VORRAT: Namen von CACHE erhoehen. */
const CACHE = 'aug-v3';
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
    /* cache: 'no-cache': auch der Zwischenspeicher des Browsers fragt beim Server nach (ETag), statt
       ein Bild bis zu einem Tag ungeprueft wiederzuverwenden */
    e.respondWith(caches.open(CACHE).then(async (c) => {
      try {
        const r = await fetch(req, { cache: 'no-cache' });
        if (r.ok) c.put(req, r.clone()).catch(() => {});
        /* geloeschtes Bild: auch die gespeicherte Fassung verwerfen */
        else if (r.status === 404 || r.status === 410) c.delete(req).catch(() => {});
        return r;
      } catch {
        return (await c.match(req)) || Response.error();
      }
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
