/* ============================================================
   Augustinerkirche Wien — instagram.js
   Instagram-Bereich auf index.html.

   Architektur:
   - INSTAGRAM_API_ENDPOINT ist eine konfigurierbare Konstante.
     Sobald ein eigener Proxy/Serverless-Endpunkt (der das
     Instagram-Graph-API-Access-Token serverseitig haelt) zur
     Verfuegung steht, reicht es, die Konstante zu setzen.
     Wichtig: die Adresse dann auch in der Content-Security-Policy
     (connect-src) aller Seiten ergaenzen.
   - Ohne konfigurierten Endpunkt rendert das Modul einen
     redaktionell gepflegten Hinweis mit Verweis auf das Profil.
   - Ist ein Endpunkt konfiguriert, wird per fetch() mit Timeout
     (AbortController) geladen; bei Fehlschlag erscheint ein
     textbasierter Fehlerhinweis statt eines kaputten Layouts.
   - Beitraege werden ausschliesslich per DOM-API (textContent)
     aufgebaut, Adressen muessen https sein: fremde Daten koennen
     so kein HTML oder Skript einschleusen.
   ============================================================ */
(function () {
  'use strict';

  const INSTAGRAM_API_ENDPOINT = ''; // z. B. 'https://api.augustinerkirche.at/instagram/latest'
  const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/augustinerkirche/';
  const FETCH_TIMEOUT_MS = 6000;
  const POST_COUNT = 8;

  /* Nur https-Adressen aus der API uebernehmen, sonst '' */
  function httpsUrl(value) {
    try {
      const u = new URL(String(value || ''));
      return u.protocol === 'https:' ? u.href : '';
    } catch {
      return '';
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /* Inhalt ersetzen und dem Screenreader melden, dass das Laden beendet ist */
  function finish(grid, ...nodes) {
    grid.replaceChildren(...nodes);
    grid.setAttribute('aria-busy', 'false');
  }

  function renderSkeleton(grid, count) {
    const skeletons = Array.from({ length: count }, () => {
      const skel = el('div', 'insta-skel');
      skel.setAttribute('aria-hidden', 'true');
      return skel;
    });
    grid.replaceChildren(...skeletons);
    grid.setAttribute('aria-busy', 'true');
  }

  function renderFallback(grid) {
    const box = el('div', 'insta-fallback');
    const link = el('a', 'btn btn-dark', 'Zum Instagram-Profil');
    Object.assign(link, { href: INSTAGRAM_PROFILE_URL, target: '_blank', rel: 'noopener' });
    box.append(
      el('div', 'insta-fallback-title', 'Aktuelle Beiträge auf Instagram'),
      el('p', 'insta-fallback-text',
        'Die Live-Einbindung des Instagram-Feeds erfordert ein serverseitig verwaltetes Zugriffstoken. ' +
        'Bis ein eigener Proxy-Dienst eingerichtet ist, folgen Sie uns direkt auf Instagram.'),
      link
    );
    finish(grid, box);
  }

  function renderError(grid, message) {
    finish(grid, el('div', 'insta-error', message));
  }

  function renderPosts(grid, posts) {
    const cards = posts.slice(0, POST_COUNT).map((post) => {
      const caption = String(post.caption || '');
      const card = el('article', 'insta-card');

      const imageUrl = httpsUrl(post.imageUrl);
      if (imageUrl) {
        const img = el('img');
        Object.assign(img, { src: imageUrl, alt: caption || 'Beitrag von Augustinerkirche auf Instagram', loading: 'lazy' });
        card.append(img);
      }
      card.append(el('div', 'insta-cap', caption));

      /* Unsichtbarer Link ueber der ganzen Karte (siehe .insta-card a) */
      const link = el('a');
      Object.assign(link, { href: httpsUrl(post.permalink) || INSTAGRAM_PROFILE_URL, target: '_blank', rel: 'noopener' });
      link.setAttribute('aria-label', caption || 'Instagram-Beitrag öffnen');
      card.append(link);
      return card;
    });
    finish(grid, ...cards);
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadInstagramFeed(gridSelector) {
    const grid = document.querySelector(gridSelector);
    if (!grid) return;

    renderSkeleton(grid, POST_COUNT);

    if (!INSTAGRAM_API_ENDPOINT) {
      /* kurze Verzoegerung, damit der Platzhalter nicht nur aufblitzt */
      setTimeout(() => renderFallback(grid), 450);
      return;
    }

    try {
      const data = await fetchWithTimeout(INSTAGRAM_API_ENDPOINT, FETCH_TIMEOUT_MS);
      const posts = Array.isArray(data) ? data : data && data.posts;
      if (!Array.isArray(posts) || !posts.length) throw new Error('Leere Antwort');
      renderPosts(grid, posts);
    } catch (err) {
      const reason = err && err.name === 'AbortError'
        ? 'Die Instagram-Beiträge konnten nicht rechtzeitig geladen werden.'
        : 'Die Instagram-Beiträge sind derzeit nicht verfügbar.';
      renderError(grid, `${reason} Bitte besuchen Sie unser Profil direkt: ${INSTAGRAM_PROFILE_URL}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => loadInstagramFeed('#insta-grid'));
})();
