/* ============================================================
   Augustinerkirche Wien — inhalte.js
   Zeichnet Bereiche, die in der Verwaltung gepflegt werden, aus
   den Datendateien:
   - data/gottesdienste.json: Liturgie-Zeiten und Wochenueberblick
     ([data-inhalt="liturgie"], [data-inhalt="woche"])
   - data/runden.json: Uebersicht der Runden ([data-inhalt="runden"])
     und die Seite einer Runde (<main data-runde="id">; leer = ?id=)
   - data/personen.json: Personenkarten ([data-personen="gruppe"])
   - data/kontakt.json: Kontaktleiste ([data-inhalt="kontakt"]) und
     Oeffnungszeiten der Pfarrkanzlei ([data-inhalt="kanzlei"])
   - data/repertoire.json: Repertoire des Chores mit Suche
     ([data-inhalt="repertoire"])
   Der Inhalt im HTML bleibt als Rueckfall stehen, falls eine Datei
   nicht geladen werden kann.
   Benoetigt js/hochaemter-data.js (Escaping, sichere Links, Freitext).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;
  const { esc, pad } = HD;

  /* Wurzel der Website (aus der Adresse dieses Skripts), damit Pfade aus
     den Datendateien auf jeder Unterseite stimmen */
  const ROOT = new URL('..', document.currentScript.src).href;
  const url = (p) => HD.safeUrl(p, ROOT);
  const rich = (s) => HD.richText(s, ROOT);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const cache = new Map();
  function load(name) {
    if (!cache.has(name)) {
      cache.set(name, fetch(`${ROOT}data/${name}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }));
    }
    return cache.get(name);
  }

  const DAYS = { so: 'Sonntag', mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag' };
  const DAY_ORDER = Object.keys(DAYS);
  const byDay = (a, b) => DAY_ORDER.indexOf(a.tag) - DAY_ORDER.indexOf(b.tag) || String(a.zeit).localeCompare(String(b.zeit));

  /* ---------- Gottesdienste ---------- */
  async function gottesdienste() {
    const lit = qsa('[data-inhalt="liturgie"]');
    const week = qsa('[data-inhalt="woche"]');
    if (!lit.length && !week.length) return;
    const list = (await load('gottesdienste.json')).termine.slice().sort(byDay);
    for (const el of lit) {
      el.innerHTML = list.filter((t) => t.liturgie).map((t) =>
        `<tr><td class="gd-day">${esc(DAYS[t.tag] || '')}</td><td class="gd-time">${esc(t.zeit)}</td>` +
        `<td><div class="gd-name">${t.hervorheben ? '<span class="gd-dot"></span>' : ''}${esc(t.name)}</div>` +
        (t.hinweis ? `<div class="gd-note">${esc(t.hinweis)}</div>` : '') + '</td></tr>'
      ).join('');
    }
    for (const el of week) {
      el.innerHTML = list.map((t) =>
        `<div class="week-row" data-day="${esc(t.tag)}"><div class="week-day">${esc(DAYS[t.tag] || '')}</div>` +
        `<div><div class="week-name">${esc(t.name)}</div>${t.hinweis ? `<div class="week-loc">${esc(t.hinweis)}</div>` : ''}</div>` +
        `<div class="week-time">${esc(t.zeit)}</div></div>`
      ).join('');
    }
    /* Gewaehlten Wochentag erneut anwenden */
    const active = document.querySelector('.week-filter-btn.active');
    if (active && week.length) active.click();
  }

  /* ---------- Runden ---------- */
  const rundeHref = (r) => url(r.link || r.seite || `pages/runden/runde.html?id=${encodeURIComponent(r.id)}`);

  async function rundenListe() {
    const hosts = qsa('[data-inhalt="runden"]');
    if (!hosts.length) return;
    const { runden } = await load('runden.json');
    for (const el of hosts) {
      el.innerHTML = runden.filter((r) => r.sichtbar !== false).map((r) =>
        `<a class="card" href="${esc(rundeHref(r))}" target="_blank" rel="noopener">` +
        `<div class="card-title">${esc(r.titel)}</div><div class="card-text">${esc(r.kurztext)}</div>` +
        '<span class="link-arr">Mehr erfahren (neues Fenster)</span></a>'
      ).join('');
    }
  }

  /* Titel mit Betonung: "Bibel" + <em>pur</em> */
  function titleHTML(title, accent) {
    const i = accent ? title.lastIndexOf(accent) : -1;
    if (i < 0) return esc(title);
    return esc(title.slice(0, i)) + `<em>${esc(accent)}</em>` + esc(title.slice(i + accent.length));
  }
  function chip(iso, today) {
    const dt = HD.dateFromIso(iso);
    const past = iso < today;
    return `<li${past ? ' class="vorbei" title="Bereits vorbei"' : ''}><span>${HD.WEEKDAYS_SHORT[dt.getDay()]}</span>${dt.getDate()}.${pad(dt.getMonth() + 1)}.</li>`;
  }
  function kontaktHTML(k) {
    const rows = [];
    if (k.email) rows.push(['E-Mail', HD.mailHTML(k.email)]);
    if (k.telefon) rows.push(['Telefon', `<a href="${esc(HD.telHref(k.telefon))}">${esc(k.telefon)}</a>`]);
    if (k.anschrift) rows.push(['Anschrift', esc(k.anschrift), ' kontakt-hours']);
    return '<div class="kontakt-card">' +
      `<div class="kontakt-title">${esc(k.titel || 'Kontakt')}</div>` +
      (k.text ? `<p class="kontakt-text">${esc(k.text)}</p>` : '') +
      `<div class="kontakt-rows">${rows.map(([l, v, cls]) =>
        `<div class="kontakt-row"><span class="kontakt-label">${l}</span><span class="kontakt-val${cls || ''}">${v}</span></div>`).join('')}</div></div>`;
  }
  function sideHTML(b) {
    const src = url(b.pfad);
    if (!src) return '';
    const size = b.breite && b.hoehe ? ` width="${b.breite}" height="${b.hoehe}"` : '';
    const img = `<img src="${esc(src)}" alt="${esc(b.alt || '')}"${size} loading="lazy" decoding="async"/>`;
    return b.art === 'plakat'
      ? `<aside class="runde-side"><a href="${esc(src)}" target="_blank" rel="noopener" title="Plakat in voller Größe öffnen" data-lightbox>${img}</a><div class="runde-side-cap">Plakat vergrößern</div></aside>`
      : `<aside class="runde-side runde-photo">${img}</aside>`;
  }

  async function rundeSeite() {
    const main = document.querySelector('main[data-runde]');
    if (!main) return;
    const id = main.dataset.runde || new URLSearchParams(location.search).get('id') || '';
    const { runden } = await load('runden.json');
    const r = runden.find((x) => x.id === id);
    const hero = main.querySelector('.page-hero .inner');
    const layout = main.querySelector('.runde-layout');
    const back = `<div class="runde-back"><a class="link-arr" href="${esc(url('pages/gottesdienste.html#p-runden'))}">Zurück zu Runden in St. Augustin</a></div>`;
    if (!r) {
      if (main.dataset.runde) return;   /* feste Seite: Inhalt aus dem HTML behalten */
      hero.innerHTML = '<div class="ph-tag">Runden in St. Augustin</div><h1 class="ph-title">Nicht gefunden</h1>';
      layout.className = 'runde-layout runde-single';
      layout.innerHTML = `<div class="runde-main"><p class="bio-p">Diese Runde gibt es nicht oder nicht mehr.</p>${back}</div>`;
      return;
    }
    const k = r.kopf || {};
    const title = k.titel || r.titel;
    document.title = `${title} — Augustinerkirche Wien`;
    hero.innerHTML = (k.zeile ? `<div class="ph-tag">${esc(k.zeile)}</div>` : '') +
      `<h1 class="ph-title">${titleHTML(title, k.betonung)}</h1>` +
      (k.untertitel ? `<p class="ph-sub">${esc(k.untertitel)}</p>` : '');

    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const para = (list) => (list || []).filter(Boolean).map((p) => `<p class="bio-p">${rich(p)}</p>`).join('');
    const s = r.schwerpunkt;
    const facts = (r.fakten || []).filter((f) => f.label || f.wert);
    const html = para(r.einleitung) +
      (s && (s.titel || s.text) ? '<div class="runde-lead">' +
        (s.label ? `<div class="runde-label">${esc(s.label)}</div>` : '') +
        (s.titel ? `<h2 class="runde-lead-title">${esc(s.titel)}</h2>` : '') +
        (s.text ? `<p>${rich(s.text)}</p>` : '') + '</div>' : '') +
      para(r.text) +
      (r.termine || []).filter((b) => b.daten && b.daten.length).map((b) =>
        `<div class="runde-block"><div class="runde-label">${esc(b.label || 'Termine')}</div>` +
        `<ul class="termin-chips">${b.daten.slice().sort().map((d) => chip(d, today)).join('')}</ul></div>`
      ).join('') +
      (facts.length ? `<div class="runde-facts">${facts.map((f) =>
        `<div class="runde-fact"><div class="runde-fact-label">${esc(f.label)}</div>` +
        `<div class="runde-fact-value">${rich(f.wert)}${f.zusatz ? `<br><small>${rich(f.zusatz)}</small>` : ''}</div></div>`
      ).join('')}</div>` : '') +
      (r.kontakt && (r.kontakt.email || r.kontakt.telefon || r.kontakt.anschrift) ? kontaktHTML(r.kontakt) : '') +
      back;
    const side = r.bild ? sideHTML(r.bild) : '';
    layout.className = `runde-layout${side ? '' : ' runde-single'}`;
    layout.innerHTML = `<div class="runde-main">${html}</div>${side}`;
  }

  /* ---------- Personen ---------- */
  async function personen() {
    const hosts = qsa('[data-personen]');
    if (!hosts.length) return;
    const data = await load('personen.json');
    for (const el of hosts) {
      const compact = el.dataset.kompakt !== undefined ? ' compact' : '';
      el.innerHTML = (data[el.dataset.personen] || []).map((p) => {
        const src = url(p.bild);
        const size = p.breite && p.hoehe ? ` width="${p.breite}" height="${p.hoehe}"` : '';
        return `<div class="person-card-wide${compact}${src ? '' : ' no-img'}">` +
          (src ? `<img src="${esc(src)}" alt="${esc(p.bildtext || p.name)}" loading="lazy"${size} decoding="async"/>` : '') +
          `<div class="person-body"><div class="person-name">${esc(p.name)}</div>` +
          (p.rolle ? `<div class="person-role">${esc(p.rolle)}</div>` : '') +
          (p.text || []).filter(Boolean).map((t) => `<p class="person-bio">${rich(t)}</p>`).join('') +
          '</div></div>';
      }).join('');
    }
  }

  /* ---------- Kontakt und Pfarrkanzlei ---------- */
  async function kontakt() {
    const strips = qsa('[data-inhalt="kontakt"]');
    const lines = qsa('[data-inhalt="kanzlei"]');
    if (!strips.length && !lines.length) return;
    const k = await load('kontakt.json');
    const hours = (k.kanzlei || []).filter((h) => h.tage || h.zeit);
    for (const el of strips) {
      el.innerHTML =
        `<div><div class="cs-label">Adresse</div><div class="cs-val">${esc(k.adresse)}<br>${esc(k.ort)}` +
          (k.eingang ? `<br><span class="cs-note">${esc(k.eingang)}</span>` : '') + '</div></div>' +
        `<div><div class="cs-label">Telefon</div><div class="cs-val">${(k.telefon || []).map((t) =>
          `<a href="${esc(HD.telHref(t.nummer))}">${esc(t.nummer)}</a>${t.bezeichnung ? ` <span class="cs-note">${esc(t.bezeichnung)}</span>` : ''}`).join('<br>')}</div></div>` +
        `<div><div class="cs-label">E-Mail</div><div class="cs-val">${HD.mailHTML(k.email)}</div></div>` +
        `<div><div class="cs-label">Pfarrkanzlei</div><div class="cs-val cs-hours">${hours.map((h) =>
          `<span>${esc(h.tage)}</span><span>${esc(h.zeit)}</span>`).join('')}</div></div>`;
    }
    for (const el of lines) {
      el.textContent = `Pfarrkanzlei: ${hours.map((h) => `${h.tage} ${h.zeit}`).join(' · ')}`;
    }
  }

  /* ---------- Repertoire des Chores ---------- */
  const collator = new Intl.Collator('de');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  async function repertoire() {
    const host = document.querySelector('[data-inhalt="repertoire"]');
    if (!host) return;
    const data = await load('repertoire.json');
    const intro = document.querySelector('[data-inhalt="repertoire-text"]');
    if (intro && data.einleitung) intro.textContent = data.einleitung;
    const list = (data.komponisten || []).filter((k) => k.name)
      .sort((a, b) => collator.compare(a.sortierung || a.name, b.sortierung || b.name) || collator.compare(a.name, b.name));
    const item = (k, works) =>
      `<div class="rep-item"><div class="rep-name">${esc(k.name)}</div>` +
      (k.lebensdaten ? `<span class="rep-years">${esc(k.lebensdaten)}</span>` : '') +
      `<ul class="rep-works">${works.map((w) =>
        `<li>${esc(w.titel)}${w.hinweis ? `<br><span class="rep-note">${esc(w.hinweis)}</span>` : ''}</li>`).join('')}</ul></div>`;

    const search = document.querySelector('[data-rep-suche]');
    const count = document.querySelector('[data-rep-anzahl]');
    function render() {
      const words = (search ? search.value : '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      let works = 0;
      const html = list.map((k) => {
        /* Treffer im Namen zeigt alle Werke, sonst nur die passenden */
        const nameHit = words.every((w) => `${k.name} ${k.lebensdaten}`.toLowerCase().includes(w));
        const hits = nameHit ? k.werke : k.werke.filter((w) => words.every((x) => `${k.name} ${w.titel} ${w.hinweis}`.toLowerCase().includes(x)));
        if (!hits.length) return '';
        works += hits.length;
        return item(k, hits);
      }).join('');
      host.innerHTML = html || '<p class="s-text rep-empty">Dazu ist nichts im Repertoire verzeichnet.</p>';
      const composers = host.querySelectorAll('.rep-item').length;
      if (count) count.textContent = `${plural(works, 'Werk', 'Werke')} von ${plural(composers, 'Komponist', 'Komponisten')}`;
    }
    if (search) {
      search.closest('[hidden]')?.removeAttribute('hidden');
      search.addEventListener('input', render);
    }
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    /* Jeder Bereich fuer sich: scheitert einer, bleibt dort der HTML-Inhalt */
    for (const fn of [gottesdienste, rundenListe, rundeSeite, personen, kontakt, repertoire]) {
      fn().catch(() => { /* Rueckfall: Inhalt aus dem HTML */ });
    }
  });
})();
