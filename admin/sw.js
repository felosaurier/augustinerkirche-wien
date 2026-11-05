/* Service Worker der Verwaltung: dient nur dazu, dass sich die Verwaltung als App installieren laesst.
   Es wird bewusst nichts zwischengespeichert, damit immer der neueste Stand der Inhalte zu sehen ist. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
