/* ============================================================
   Augustinerkirche Wien — inhalte.js
   Zeichnet Bereiche, die in der Verwaltung gepflegt werden, aus
   den Datendateien:
   - data/gottesdienste.json: Liturgie-Zeiten und Wochenueberblick
     ([data-inhalt="liturgie"])
   - data/runden.json: Uebersicht der Runden ([data-inhalt="runden"])
     und die Seite einer Runde (<main data-runde="id">; leer = ?id=)
   - data/personen.json: Personenkarten ([data-personen="gruppe"])
   - data/kontakt.json: Kontaktleiste ([data-inhalt="kontakt"]) und
     Oeffnungszeiten der Pfarrkanzlei ([data-inhalt="kanzlei"])
   - data/repertoire.json: Repertoire des Chores mit Suche
     ([data-inhalt="repertoire"])
   - data/cds.json: CDs von St. Augustin mit Hörproben ([data-inhalt="cds"])
   - data/galerie.json: Galerie der Kirchenmusik mit Fotos, Videos und
     Aufnahmen ([data-inhalt="galerie"])
   - data/rundgang.json: Rundgang durch die Kirche ([data-inhalt="rundgang"])
   - data/pgr.json: Pfarrgemeinderat ([data-inhalt="pgr-mitglieder"],
     [data-inhalt="pgr-weitere"]); mit data-quelle="pgr-aspersdorf.json" auch
     Pfarrgemeinderat und Vermoegensverwaltungsrat von Aspersdorf ([data-inhalt="pgr-vwr"])
   - data/predigten.json: Predigten und Ansprachen ([data-inhalt="predigten"]),
     je Eintrag Datum, Titel, ein Foto und ein formatierter Text
   - data/aspersdorf-wochen.json: Wochenblaetter (PDF) der Pfarre Aspersdorf
     ([data-inhalt="asp-wochen"])
   - data/friedhof.json: Gebuehrentabellen des Pfarrfriedhofs Aspersdorf
     ([data-inhalt="friedhof"])
   - data/paten.json: Paten und Ehrenpaten der Kirchenmusik
     ([data-inhalt="paten"], [data-inhalt="ehrenpaten"]), Moeglichkeiten
     der Unterstuetzung ([data-inhalt="stufen"]) und PayPal-Link
     ([data-inhalt="paypal"], ohne Link bleibt der Platzhalter)
   - data/rechtliches.json: Impressum und Datenschutz
     ([data-inhalt="rechtliches"][data-seite="impressum|datenschutz"])
   Der Inhalt im HTML bleibt als Rueckfall stehen, falls eine Datei
   nicht geladen werden kann.
   Benoetigt js/hochaemter-data.js (Escaping, sichere Links, Freitext).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;
  const { esc, pad } = HD;
  /* Uebersetzung (js/thema.js); deutsche Seiten: der Text bleibt. Texte aus den Daten werden nur
     uebersetzt, wenn das Woerterbuch (js/sprache.js) sie kennt, sonst bleiben sie deutsch. */
  const T = window.AugT || ((s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));
  const LANG = T.lang || 'de';

  /* Wurzel der Website (aus der Adresse dieses Skripts), damit Pfade aus
     den Datendateien auf jeder Unterseite stimmen */
  const ROOT = new URL('..', document.currentScript.src).href;
  /* Vorschau in der Verwaltung: noch nicht gespeicherte Dateien kommen als blob:-Adressen */
  let previewing = false;
  const url = (p) => (previewing && /^blob:/.test(String(p)) ? String(p) : HD.safeUrl(p, ROOT));
  const rich = (s) => HD.richText(s, ROOT);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const cache = new Map();
  function load(name) {
    if (!cache.has(name)) {
      cache.set(name, HD.fetchJSON(`${ROOT}data/${name}`));
    }
    return cache.get(name);
  }

  const DAYS = Object.fromEntries(['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'].map((k, i) => [k, HD.WEEKDAYS[i]]));
  const DAY_ORDER = Object.keys(DAYS);
  const byDay = (a, b) => DAY_ORDER.indexOf(a.tag) - DAY_ORDER.indexOf(b.tag) || String(a.zeit).localeCompare(String(b.zeit));

  /* ---------- Gottesdienste ---------- */
  async function gottesdienste() {
    const lit = qsa('[data-inhalt="liturgie"]');
    if (!lit.length) return;
    const list = (await load('gottesdienste.json')).termine.slice().sort(byDay);
    for (const el of lit) {
      /* Mehrere Gottesdienste am selben Tag: der Wochentag steht nur in der ersten Zeile */
      el.innerHTML = list.filter((t) => t.liturgie).map((t, i, arr) => {
        const gleich = i > 0 && arr[i - 1].tag === t.tag;
        return `<tr${gleich ? ' class="gd-same"' : ''}><td class="gd-day">${gleich ? '' : esc(DAYS[t.tag] || '')}</td><td class="gd-time">${esc(HD.uhr(t.zeit))}</td>` +
        `<td><div class="gd-name">${t.hervorheben ? '<span class="gd-dot"></span>' : ''}${esc(T(t.name))}</div>` +
        (t.hinweis ? `<div class="gd-note">${esc(T(t.hinweis))}</div>` : '') + '</td></tr>';
      }).join('');
    }
  }

  /* ---------- Runden ---------- */
  const rundeHref = (r) => url(r.link || r.seite || `pages/runden/runde.html?id=${encodeURIComponent(r.id)}`);

  /* Naechster Termin einer Runde aus ihren Terminreihen (heute oder spaeter) */
  function nextDate(r) {
    const d = new Date();
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let best = null;
    for (const b of r.termine || []) {
      for (const iso of b.daten || []) {
        if (iso >= today && (!best || iso < best.iso)) best = { iso, zeit: HD.isoTime(b.zeit), name: b.name };
      }
    }
    return best;
  }
  function nextHTML(n) {
    if (!n) return '';
    const dt = HD.dateFromIso(n.iso);
    return '<p class="rk-next"><span class="rk-next-l">Nächster Termin</span>' +
      `${HD.WEEKDAYS[dt.getDay()]}, ${dt.getDate()}. ${HD.MONTHS[dt.getMonth()]}${n.zeit ? `, ${n.zeit} Uhr` : ''}</p>`;
  }
  /* Runden ohne eigenes Bild: der Reihe nach ein Foto aus der Augustinerkirche */
  const KIRCHE = ['interior-hero', 'kanzel', 'loretokapelle-a', 'seitenaltar', 'loretokapelle-b']
    .map((n) => ({ pfad: `assets/img/kirche/${n}.webp`, art: 'foto' }));
  /* Bild der Karte: Foto oder Plakat der Runde, sonst ein Kirchenfoto */
  function cardImg(b) {
    const src = b && url(b.pfad);
    if (!src) return '';
    return `<div class="rk-img${b.art === 'plakat' ? ' plakat' : ''}"><img src="${esc(src)}" alt="" width="${HD.num(b.breite, 800)}" height="${HD.num(b.hoehe, 600)}" loading="lazy" decoding="async"/></div>`;
  }

  /* Uebersicht der Runden als Kacheln mit Bild, Name und naechstem Termin; ein Klick fuehrt direkt zur Seite der Runde.
     Plakate stehen ganz im Bild, Fotos fuellen es. */
  async function rundenListe() {
    const hosts = qsa('[data-inhalt="runden"]');
    if (!hosts.length) return;
    const { runden } = await load('runden.json');
    const shown = runden.filter((r) => r.sichtbar !== false);
    for (const el of hosts) {
      let spare = 0;
      el.classList.remove('rk-grid');
      el.innerHTML = '<div class="rk-index">' + shown.map((r) => {
        const b = r.bild && r.bild.pfad ? r.bild : KIRCHE[spare++ % KIRCHE.length];
        const src = url(b.pfad);
        const n = nextDate(r);
        const dt = n && HD.dateFromIso(n.iso);
        return `<a class="rk-tile${b.art === 'plakat' ? ' plakat' : ''}" href="${esc(rundeHref(r))}">` +
          `<span class="rk-tile-img">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async"/>` : ''}</span>` +
          `<span class="rk-tile-body"><b>${esc(r.titel)}</b>` +
          (dt ? `<small>Nächster Termin: ${HD.WEEKDAYS_SHORT[dt.getDay()]}, ${dt.getDate()}. ${HD.MONTHS_SHORT[dt.getMonth()]}</small>` : '') +
          '</span></a>';
      }).join('') + '</div>';
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
      (k.text ? `<p class="kontakt-text">${rich(k.text)}</p>` : '') +
      `<div class="kontakt-rows">${rows.map(([l, v, cls]) =>
        `<div class="kontakt-row"><span class="kontakt-label">${l}</span><span class="kontakt-val${cls || ''}">${v}</span></div>`).join('')}</div></div>`;
  }
  function sideHTML(b) {
    const src = url(b.pfad);
    if (!src) return '';
    const size = b.breite && b.hoehe ? ` width="${HD.num(b.breite, 800)}" height="${HD.num(b.hoehe, 600)}"` : '';
    const img = `<img src="${esc(src)}" alt="${esc(b.alt || '')}"${size} loading="lazy" decoding="async"/>`;
    return b.art === 'plakat'
      ? `<aside class="runde-side"><a href="${esc(src)}" target="_blank" rel="noopener" title="Plakat in voller Größe öffnen" data-lightbox>${img}</a><div class="runde-side-cap">Plakat vergrößern</div></aside>`
      : `<aside class="runde-side runde-photo">${img}</aside>`;
  }

  async function rundeSeite() {
    const main = document.querySelector('main[data-runde]');
    if (!main) return;
    const id = main.dataset.runde || new URLSearchParams(location.search).get('id') || '';
    /* Ohne Kennung (alter Link "Alle Runden"): gleich zur Uebersicht der Runden */
    if (!id) {
      location.replace(url('pages/augustinerkirche.html#p-runden'));
      return;
    }
    const { runden } = await load('runden.json');
    const r = runden.find((x) => x.id === id);
    const hero = main.querySelector('.page-hero .inner');
    const layout = main.querySelector('.runde-layout');
    const backHref = esc(url('pages/augustinerkirche.html#p-runden'));
    const back = `<div class="runde-back"><a class="btn btn-outline" href="${backHref}">Zurück zu den Runden</a></div>`;
    const backTop = `<a class="hd-back" href="${backHref}"><span aria-hidden="true">&larr;</span> Zurück</a>`;
    if (!r) {
      if (main.dataset.runde) return;   /* feste Seite: Inhalt aus dem HTML behalten */
      hero.innerHTML = backTop + '<div class="ph-tag">Runden in St. Augustin</div><h1 class="ph-title">Nicht gefunden</h1>';
      layout.className = 'runde-layout runde-single';
      layout.innerHTML = `<div class="runde-main"><p class="bio-p">Diese Runde gibt es nicht oder nicht mehr.</p>${back}</div>`;
      return;
    }
    const k = r.kopf || {};
    const title = k.titel || r.titel;
    document.title = `${title} — Augustinerkirche Wien`;
    hero.innerHTML = backTop + (k.zeile ? `<div class="ph-tag">${esc(k.zeile)}</div>` : '') +
      `<h1 class="ph-title">${titleHTML(title, k.betonung)}</h1>` +
      (k.untertitel ? `<p class="ph-sub">${rich(k.untertitel)}</p>` : '');

    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const para = (list) => (list || []).filter(Boolean).map((p) => `<p class="bio-p">${rich(p)}</p>`).join('');
    const s = r.schwerpunkt;
    /* Leere Zeile = Abstand: teilt die Angaben in einzelne Bloecke */
    const factGroups = (r.fakten || []).reduce((groups, f) => {
      if (f.label || f.wert) groups[groups.length - 1].push(f);
      else if (groups[groups.length - 1].length) groups.push([]);
      return groups;
    }, [[]]).filter((g) => g.length);
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
      factGroups.map((facts) => `<div class="runde-facts">${facts.map((f) =>
        `<div class="runde-fact"><div class="runde-fact-label">${esc(f.label)}</div>` +
        `<div class="runde-fact-value">${rich(f.wert)}${f.zusatz ? `<br><small>${rich(f.zusatz)}</small>` : ''}</div></div>`
      ).join('')}</div>`).join('') +
      (r.kontakt && (r.kontakt.email || r.kontakt.telefon || r.kontakt.anschrift) ? kontaktHTML(r.kontakt) : '') +
      back;
    const side = r.bild ? sideHTML(r.bild) : '';
    layout.className = `runde-layout${side ? '' : ' runde-single'}`;
    layout.innerHTML = `<div class="runde-main">${html}</div>${side}`;
  }

  /* ---------- Fotos der Seiten (Verwaltung: Website → Fotos der Seiten) ----------
     <figure data-foto="schluessel"> oder <img data-foto="schluessel"> im HTML; data/fotos.json: {fotos: {schluessel: {bild, breite, hoehe, alt, bildtext}}}.
     Gleicher Schluessel an mehreren Stellen (z. B. Gruppenbild der Mitbrueder) = ein Foto fuer alle.
     Bildtext und Beschreibung nur auf den deutschen Seiten; die uebersetzten behalten ihre eigenen. */
  async function fotos() {
    const figs = qsa('[data-foto]');
    if (!figs.length) return;
    const map = ((await load('fotos.json')) || {}).fotos || {};
    for (const fig of figs) {
      const f = map[fig.dataset.foto];
      const src = f && typeof f.bild === 'string' && /^assets\/[^?#]+\.(webp|jpe?g|png)$/i.test(f.bild) ? url(f.bild) : '';
      if (!src) continue;
      const img = fig.tagName === 'IMG' ? fig : fig.querySelector('img');
      if (!img) continue;
      img.removeAttribute('srcset');
      img.src = src;
      if (f.breite && f.hoehe) {
        img.width = HD.num(f.breite, img.width);
        img.height = HD.num(f.hoehe, img.height);
      }
      const link = fig.closest('a[data-lightbox]') || fig.querySelector('a[data-lightbox]');
      if (link) link.href = src;
      if (LANG !== 'de') continue;
      if (f.alt) img.alt = f.alt;
      const cap = fig.querySelector('figcaption');
      if (cap && String(f.bildtext || '').trim()) cap.textContent = f.bildtext.trim();
    }
  }

  /* ---------- Fotos der Mitbrueder: ueberall aus der Verwaltung "Mitbrueder" ----------
     Nachname ohne Umlaute ("schloegl") als Schluessel; <img|figure data-mitbruder="schluessel"> im HTML
     und Personen anderer Gruppen (z. B. Leitung Aspersdorf) zeigen das Foto des Mitbruders. */
  const ohneUmlaut = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const nachname = (name) => ohneUmlaut(name).replace(/,.*$/, '').split(/\s+/).filter((w) => w && w !== 'osa' && !w.includes('.')).pop() || '';
  const mitbruderVon = (data, key) => ((data && data.mitbrueder) || []).find((m) => m && m.bild && nachname(m.name) === key) || null;
  async function mitbruderFotos() {
    const els = qsa('[data-mitbruder]');
    if (!els.length) return;
    const data = await load('personen.json');
    for (const el of els) {
      const m = mitbruderVon(data, el.dataset.mitbruder);
      const src = m ? url(m.bild) : '';
      if (!src) continue;
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!img) continue;
      img.removeAttribute('srcset');
      img.src = src;
      if (m.breite && m.hoehe) {
        img.width = HD.num(m.breite, img.width);
        img.height = HD.num(m.hoehe, img.height);
      }
      if (LANG === 'de') img.alt = m.bildtext || m.name;
      const link = el.closest('a[data-lightbox]') || el.querySelector('a[data-lightbox]');
      if (link) link.href = src;
    }
  }

  /* ---------- Personen ---------- */
  async function personen() {
    const hosts = qsa('[data-personen]');
    if (!hosts.length) return;
    const data = await load('personen.json');
    for (const el of hosts) {
      /* Gruppe fehlt in der Datei (z. B. noch nicht auf dem Server): Inhalt aus dem HTML bleibt */
      if (!(el.dataset.personen in data)) continue;
      const compact = el.dataset.kompakt !== undefined ? ' compact' : '';
      const gruppe = el.dataset.personen;
      /* Mitbrueder in anderen Gruppen (z. B. Leitung Aspersdorf): Foto aus "Mitbrueder" */
      const list = (data[gruppe] || []).map((p) => {
        const m = gruppe !== 'mitbrueder' && p && mitbruderVon(data, nachname(p.name));
        return m ? { ...p, bild: m.bild, breite: m.breite, hoehe: m.hoehe, bildtext: m.bildtext || p.bildtext } : p;
      });
      el.innerHTML = list.map((p, i) => {
        const src = url(p.bild);
        const size = p.breite && p.hoehe ? ` width="${HD.num(p.breite, 400)}" height="${HD.num(p.hoehe, 500)}"` : '';
        /* Mit Homepage ist der Name ein Link (neues Fenster), wie bei den Solisten */
        const home = /^https?:\/\//i.test(String(p.homepage || '').trim()) && HD.safeUrl(p.homepage.trim());
        return `<div class="person-card-wide${compact}${src ? '' : ' no-img'}" id="person-${esc(el.dataset.personen)}-${i + 1}">` +
          (src ? `<img src="${esc(src)}" alt="${esc(p.bildtext || p.name)}" loading="lazy"${size} decoding="async"/>` : '') +
          `<div class="person-body"><div class="person-name">${home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</div>` +
          (p.rolle ? `<div class="person-role">${esc(p.rolle)}</div>` : '') +
          (p.text || []).filter(Boolean).map((t) => `<p class="person-bio">${rich(t)}</p>`).join('') +
          '</div></div>';
      }).join('');
      /* Uebersicht vor der ersten Person (data-uebersicht), damit man nicht durch alle Karten scrollen muss */
      const alt = el.previousElementSibling;
      if (alt && alt.classList.contains('people-index')) alt.remove();
      if (el.dataset.uebersicht !== undefined && list.length > 1) {
        el.insertAdjacentHTML('beforebegin', '<div class="people-index" role="navigation" aria-label="Übersicht">' + list.map((p, i) => {
          const src = url(p.bild);
          return `<a href="#person-${esc(el.dataset.personen)}-${i + 1}">` +
            (src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async"/>` : '') +
            `<span><b>${esc(p.name)}</b>${p.rolle ? `<small>${esc(p.rolle)}</small>` : ''}</span></a>`;
        }).join('') + '</div>');
        /* Am Anfang nur die Vorschau: die Karte einer Person erscheint erst auf Klick (nochmal klicken schliesst sie) */
        const index = el.previousElementSibling;
        const links = [...index.children];
        const cards = [...el.children];
        const show = (i) => {
          cards.forEach((c, j) => { c.hidden = j !== i; });
          links.forEach((l, j) => {
            l.classList.toggle('active', j === i);
            l.setAttribute('aria-expanded', String(j === i));
          });
        };
        show(-1);
        links.forEach((l, i) => l.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (l.classList.contains('active')) {
            show(-1);
            return;
          }
          show(i);
          cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
        /* Adresse mit #person-…: gleich diese Karte zeigen */
        const wanted = cards.findIndex((c) => c.id === decodeURIComponent(location.hash.slice(1)));
        if (wanted >= 0) show(wanted);
      }
    }
  }

  /* ---------- Kontakt und Pfarrkanzlei ---------- */
  async function kontakt() {
    const strips = qsa('[data-inhalt="kontakt"]');
    const lines = qsa('[data-inhalt="kanzlei"]');
    const actions = qsa('[data-inhalt="kontakt-aktionen"]');
    if (!strips.length && !lines.length && !actions.length) return;
    const k = await load('kontakt.json');
    /* Leere Zeile = kleiner Abstand (nicht am Anfang oder Ende) */
    const all = k.kanzlei || [];
    const filled = (h) => h.tage || h.zeit;
    const first = all.findIndex(filled);
    const hours = first < 0 ? [] : all.slice(first, all.length - [...all].reverse().findIndex(filled))
      .filter((h, i, a) => filled(h) || filled(a[i - 1]));
    for (const el of strips) {
      el.innerHTML =
        `<div><div class="cs-label">${esc(T('Adresse'))}</div><div class="cs-val">` +
          /* Eingang der Kirche (Josefsplatz) zuerst, dann die Anschrift des Klosters und der Pfarrkanzlei */
          (k.eingang ? `<span class="cs-note">${esc(T(k.eingang))}</span><br>${esc(T('Kloster'))}: ` : '') +
          `${esc(k.adresse)}, ${esc(k.ort)}</div></div>` +
        `<div><div class="cs-label">${esc(T('Telefon'))}</div><div class="cs-val">${(k.telefon || []).map((t) =>
          `<a href="${esc(HD.telHref(t.nummer))}">${esc(t.nummer)}</a>${t.bezeichnung ? ` <span class="cs-note">${esc(T(t.bezeichnung))}</span>` : ''}`).join('<br>')}</div></div>` +
        `<div><div class="cs-label">${esc(T('E-Mail'))}</div><div class="cs-val">${HD.mailHTML(k.email)}</div></div>` +
        `<div><div class="cs-label">${esc(T('Pfarrkanzlei'))}</div><div class="cs-val cs-hours">${hours.map((h) => (filled(h)
          ? `<span>${esc(T(h.tage))}</span><span>${esc(T(h.zeit))}</span>` : '<span class="cs-gap" aria-hidden="true"></span>')).join('')}</div></div>`;
    }
    /* Grosse Knoepfe fuer das Handy: anrufen und die Route in der Karten-App planen */
    /* Route zur Kirche: der Eingang liegt am Josefsplatz */
    const ziel = encodeURIComponent(`Augustinerkirche, Josefsplatz, ${k.ort}`);
    const routeLinks = [
      ['Google Maps', `https://www.google.com/maps/dir/?api=1&destination=${ziel}`],
      [T('Apple Karten'), `https://maps.apple.com/?daddr=${ziel}&dirflg=d`],
      ['Waze', `https://waze.com/ul?q=${ziel}&navigate=yes`],
      ['OpenStreetMap', `https://www.openstreetmap.org/search?query=${ziel}`]
    ];
    for (const el of actions) {
      el.innerHTML = (k.telefon || []).filter((t) => t.nummer).map((t) =>
        `<a class="btn btn-gold" href="${esc(HD.telHref(t.nummer))}">${esc(t.bezeichnung ? T(`${t.bezeichnung} anrufen`) : T('Anrufen'))}<span class="kt-act-n">${esc(t.nummer)}</span></a>`).join('') +
        `<details class="kt-route"><summary class="btn btn-outline">${esc(T('Route planen'))}</summary><ul class="kt-route-list">` +
        routeLinks.map(([t, h]) => `<li><a href="${esc(h)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('') + '</ul></details>';
    }
    for (const el of lines) {
      el.textContent = `${T('Pfarrkanzlei')}: ${hours.filter(filled).map((h) => `${T(h.tage)} ${T(h.zeit)}`.trim()).join(' ')}`;
    }
  }

  /* ---------- Repertoire des Chores ---------- */
  const collator = new Intl.Collator('de');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /* ---------- CDs von St. Augustin ---------- */
  function cdHTML(c) {
    const cover = c.cover && url(c.cover.pfad);
    const samples = (c.hoerproben || []).filter((h) => h.datei && url(h.datei));
    return '<article class="cd">' +
      (cover ? `<img class="cd-cover" src="${esc(cover)}" alt="" width="${HD.num(c.cover.breite, 400)}" height="${HD.num(c.cover.hoehe, 400)}" loading="lazy" decoding="async"/>` : '') +
      '<div class="cd-body">' +
        `<h4 class="cd-title">${esc(c.titel)}</h4>` +
        (c.werke ? `<p class="cd-works">${rich(c.werke)}</p>` : '') +
        (c.mitwirkende || c.leitung ? `<p class="cd-cast">${rich(c.mitwirkende || '')}${c.leitung ? `<span>Leitung: ${esc(c.leitung)}</span>` : ''}</p>` : '') +
        (samples.length ? `<div class="cd-samples" role="group" aria-label="Hörproben">${samples.map((h) =>
          `<button type="button" class="cd-play" data-audio="${esc(url(h.datei))}" aria-pressed="false">${esc(h.titel || 'Hörprobe')}</button>`).join('')}</div>` : '') +
      '</div></article>';
  }
  async function cds() {
    const host = document.querySelector('[data-inhalt="cds"]');
    if (!host) return;
    const data = await load('cds.json');
    host.innerHTML = (data.gruppen || []).filter((g) => (g.cds || []).length).map((g) =>
      `<h3 class="cd-group">${esc(g.titel)}</h3><div class="cd-list">${g.cds.map(cdHTML).join('')}</div>`
    ).join('');
  }

  /* ---------- Galerie der Kirchenmusik ----------
     data/galerie.json: {alben: [{titel, datum, text, fotos: [{bild, alt, breite,
     hoehe}], videos: [{titel, url}], audio: [{titel, datei}]}]}. Fotos zum
     Durchblaettern (lightbox.js), Aufnahmen wie die Hoerproben der CDs
     (hoerproben.js), Videos von YouTube erst nach einem Klick (Datenschutz). */
  const GAL_SHOWN = 6;
  /* YouTube-Adresse (watch, youtu.be, shorts, embed, live) -> Video-Kennung */
  function youtubeId(u) {
    const m = String(u || '').trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/i);
    return m ? m[1] : '';
  }
  function albumHTML(a, n) {
    const fotos = (a.fotos || []).filter((f) => f.bild && url(f.bild));
    const videos = (a.videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
    const files = (a.videos || []).filter((v) => v && (/\.(mp4|webm)$/i.test(v.datei || '') || (previewing && /^blob:/.test(v.datei || ''))) && url(v.datei));
    const audio = (a.audio || []).filter((h) => h.datei && url(h.datei));
    const date = HD.isoDate(a.datum);
    const dt = date && HD.dateFromIso(date);
    const more = fotos.length - GAL_SHOWN;
    return '<article class="gal-album">' +
      `<h3 class="gal-title">${esc(a.titel)}</h3>` +
      (dt ? `<p class="gal-date">${dt.getDate()}. ${HD.MONTHS[dt.getMonth()]} ${dt.getFullYear()}</p>` : '') +
      (a.text ? `<p class="gal-text">${rich(a.text)}</p>` : '') +
      (fotos.length ? `<div class="gallery gal-photos">${fotos.map((f, i) => {
        const cap = HD.plainText(f.alt);
        const plus = i === GAL_SHOWN - 1 && more > 0 ? `<span class="gal-more" aria-hidden="true">+${more}</span>` : '';
        /* Im Gitter die kleine Fassung (900 px), die grosse erst in der Vergroesserung */
        const thumb = url(window.AugBild && window.AugBild.vorschau ? window.AugBild.vorschau(f.bild) : f.bild) || url(f.bild);
        return `<div class="g-item"${i >= GAL_SHOWN ? ' hidden' : ''}><a href="${esc(url(f.bild))}" data-lightbox data-gallery="galerie-${n}" data-thumb="${esc(thumb)}" data-caption="${esc(cap)}" title="${esc(cap || 'Foto vergrößern')}">` +
          `<img src="${esc(thumb)}" alt="${esc(cap || `Foto ${i + 1}: ${a.titel}`)}" width="${HD.num(f.breite, 900)}" height="${HD.num(f.hoehe, 600)}" loading="lazy" decoding="async"/>${plus}</a></div>`;
      }).join('')}</div>` : '') +
      (videos.length ? `<div class="gal-videos">${videos.map((v) =>
        `<div class="gal-video"><button type="button" class="gal-video-load" data-yt="${esc(v.id)}" data-title="${esc(v.titel || a.titel)}">` +
          `<span class="gal-video-play" aria-hidden="true"></span><span class="gal-video-title">${esc(v.titel || 'Video abspielen')}</span>` +
          '<span class="gal-video-note">Beim Abspielen wird das Video von YouTube geladen.</span></button></div>').join('')}</div>` : '') +
      (files.length ? `<div class="gal-videos">${files.map((v) =>
        `<figure class="gal-video gal-video-file"><video controls preload="metadata" playsinline src="${esc(url(v.datei))}#t=0.1" aria-label="${esc(v.titel || a.titel)}"></video>` +
        (v.titel ? `<figcaption class="gal-video-cap">${esc(v.titel)}</figcaption>` : '') + '</figure>').join('')}</div>` : '') +
      (audio.length ? `<div class="cd-samples gal-audio" role="group" aria-label="Aufnahmen">${audio.map((h) =>
        `<button type="button" class="cd-play" data-audio="${esc(url(h.datei))}" aria-pressed="false">${esc(h.titel || 'Aufnahme')}</button>`).join('')}</div>` : '') +
      '</article>';
  }
  async function galerie() {
    const host = document.querySelector('[data-inhalt="galerie"]');
    if (!host) return;
    /* "sichtbar": erst ab diesem Tag (JJJJ-MM-TT) */
    const d = new Date();
    const heute = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const alben = ((await load('galerie.json')).alben || []).filter((a) => a && a.titel && !(a.sichtbar && a.sichtbar > heute));
    if (!alben.length) return;
    /* Liste der kleinen Fassungen abwarten (hoechstens kurz) */
    if (window.AugBild) await Promise.race([window.AugBild.ready, new Promise((r) => setTimeout(r, 400))]);
    host.innerHTML = alben.map(albumHTML).join('');
    wireVideos(host);
  }
  /* Video erst auf Klick einbetten (youtube-nocookie, startet gleich) */
  function wireVideos(host) {
    host.addEventListener('click', (ev) => {
      const b = ev.target.closest('.gal-video-load');
      if (!b || !/^[\w-]{11}$/.test(b.dataset.yt)) return;
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`;
      f.title = b.dataset.title || 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      b.replaceWith(f);
    });
  }
  /* Vorschau eines Albums in der Verwaltung (admin/galerie.html) */
  window.AugGalerie = {
    preview(album, host) {
      previewing = true;
      host.innerHTML = albumHTML(album, 0);
      if (!host.dataset.wired) {
        host.dataset.wired = '1';
        wireVideos(host);
      }
    }
  };

  /* ---------- Rundgang durch die Kirche ---------- */
  async function rundgang() {
    const host = document.querySelector('[data-inhalt="rundgang"]');
    if (!host) return;
    const data = await load('rundgang.json');
    const list = (data.bilder || []).filter((b) => b.bild && url(b.bild));
    if (!list.length) return;
    const cls = (b) => (b.format === 'breit' ? ' g-breit' : b.format === 'hoch' ? ' g-hoch' : '');
    const pos = (b) => (HD.focusPos(b.ausschnitt) ? ` style="object-position:${HD.focusPos(b.ausschnitt)}"` : '');
    host.innerHTML = list.map((b) =>
      `<div class="g-item${cls(b)}"><a href="${esc(url(b.bild))}" data-lightbox title="${esc(T('Bild vergrößern'))}">` +
      `<img src="${esc(url(b.bild))}" alt="${esc(T(b.titel))}" loading="lazy" width="${HD.num(b.breite, 900)}" height="${HD.num(b.hoehe, 600)}" decoding="async"${pos(b)}/></a>` +
      (b.titel ? `<div class="g-cap">${esc(T(b.titel))}</div>` : '') + '</div>').join('');
  }

  /* ---------- Pfarrgemeinderat ---------- */
  function pgrItem(p) {
    const contact = [
      p.telefon ? `<a href="${esc(HD.telHref(p.telefon))}">${esc(p.telefon)}</a>` : '',
      p.email ? HD.mailHTML(p.email) : ''
    ].filter(Boolean).join(', ');
    const src = p.bild && url(p.bild);
    const photo = src ? `<img class="pgr-photo" src="${esc(src)}" alt="${esc(p.name)}" width="${HD.num(p.breite, 400)}" height="${HD.num(p.hoehe, 500)}" loading="lazy" decoding="async"/>` : '';
    return `<li class="pgr-item"><div class="pgr-person">${photo}<div>` +
      `<div class="pgr-name">${esc(p.name)}</div>` +
      (p.rolle ? `<div class="pgr-role">${esc(p.rolle)}</div>` : '') +
      (p.beruf ? `<div class="pgr-job">${esc(p.beruf)}</div>` : '') +
      '</div></div><div>' +
      `<ul class="pgr-tasks">${(p.aufgaben || []).map((t) => `<li>${rich(t)}</li>`).join('')}</ul>` +
      (contact ? `<div class="pgr-contact">${contact}</div>` : '') +
      '</div></li>';
  }
  async function pgr() {
    const hosts = qsa('[data-inhalt^="pgr-"]');
    if (!hosts.length) return;
    for (const el of hosts) {
      const data = await load(el.dataset.quelle || 'pgr.json');
      const list = data[el.dataset.inhalt.slice(4)] || [];
      el.innerHTML = list.map(pgrItem).join('');
    }
  }

  /* ---------- Aspersdorf: Wochenblaetter (PDF) ---------- */
  const longDate = (iso) => {
    const d = HD.dateFromIso(iso);
    return d ? `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
  };
  async function aspWochen() {
    const hosts = qsa('[data-inhalt="asp-wochen"]');
    if (!hosts.length) return;
    const data = await load('aspersdorf-wochen.json');
    const list = (data.wochen || []).filter((w) => w && url(w.datei))
      .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    const name = (w) => w.titel || (w.datum ? `Gottesdienste der Woche vom ${longDate(w.datum)}` : 'Wochenblatt');
    for (const el of hosts) {
      if (!list.length) {
        el.hidden = true;
        continue;
      }
      const [now, ...older] = list;
      el.innerHTML =
        '<div class="asp-woche-now">' +
          '<div class="asp-woche-icon" aria-hidden="true">PDF</div>' +
          `<div class="asp-woche-text"><div class="asp-woche-kicker">Aktuelles Wochenblatt</div><div class="asp-woche-titel">${esc(name(now))}</div></div>` +
          `<a class="btn btn-dark" href="${esc(url(now.datei))}" target="_blank" rel="noopener">Wochenblatt öffnen</a>` +
        '</div>' +
        (older.length
          ? `<details class="asp-woche-older"><summary>Frühere Wochen <span>${older.length}</span></summary><ul>` +
            older.map((w) => `<li><a href="${esc(url(w.datei))}" target="_blank" rel="noopener">${esc(name(w))}</a></li>`).join('') + '</ul></details>'
          : '');
      el.hidden = false;
    }
  }

  /* ---------- Predigten und Ansprachen ---------- */
  /* Predigten: data/predigten/index.json (Datum, Titel, Auszug, Foto, Nachweis) fuer die Liste,
     der volle Text je Beitrag in data/predigten/<id>.json, geladen erst beim Aufklappen.
     Fehlt die Uebersicht noch, gilt die alte Sammeldatei data/predigten.json. */
  async function sermonIndex() {
    try {
      return { list: (await load('predigten/index.json')).predigten || [], legacy: false };
    } catch {
      return { list: (await load('predigten.json')).predigten || [], legacy: true };
    }
  }
  async function sermonText(p, legacy) {
    if (legacy) return String(p.text || '');
    if (!/^[a-z0-9-]+$/.test(String(p.id || ''))) return '';
    return String((await load(`predigten/${p.id}.json`)).text || '');
  }
  const sermonHTML = (text) => String(text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => `<p>${rich(t)}</p>`).join('');
  async function predigten() {
    const hosts = qsa('[data-inhalt="predigten"]');
    if (!hosts.length) return;
    /* Reihenfolge der Datei (in der Verwaltung festgelegt), ohne Entwuerfe */
    const { list: all, legacy } = await sermonIndex();
    const list = all.filter((p) => p && p.titel && !p.entwurf);
    for (const el of hosts) {
      if (!list.length) continue;
      el.innerHTML = list.map((p, i) => {
        const src = p.bild && url(p.bild);
        const size = p.breite && p.hoehe ? ` width="${HD.num(p.breite, 800)}" height="${HD.num(p.hoehe, 600)}"` : '';
        const credit = p.nachweis ? ` data-credit="${esc(p.nachweis)}"` : '';
        /* Bildnachweis setzt main.js direkt unter das Bild */
        const fig = (cls) => `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(p.bildtext || p.titel)}"${size}${credit} loading="lazy" decoding="async"/></figure>`;
        const img = src ? fig('pd-img') : '';
        /* Aufgeklappt: Hochformat links vom Text (Text umfliesst es), Querformat oben */
        const hoch = p.breite && p.hoehe ? (Number(p.hoehe) > Number(p.breite) ? ' pd-hoch' : ' pd-quer') : '';
        const excerpt = legacy ? HD.plainText(String(p.text || '').split(/\n+/).join(' ')) : HD.plainText(p.auszug || '');
        return `<article class="pd-item${src ? ' has-img' : ''}${hoch}" id="pd-${i + 1}" data-i="${i}"><details>` +
          `<summary class="pd-sum">${img}` +
          '<span class="pd-body">' +
            (p.datum ? `<span class="pd-date">${esc(longDate(p.datum))}</span>` : '') +
            `<h2 class="pd-title">${esc(p.titel)}</h2>` +
            (excerpt ? `<span class="pd-excerpt">${esc(excerpt)}</span>` : '') +
            '<span class="pd-more"></span>' +
          '</span></summary>' +
          `<div class="pd-text">${src ? fig('pd-img-open') : ''}<div class="pd-paras" aria-live="polite">${legacy ? sermonHTML(p.text) : '<p class="pd-loading">Der Text wird geladen …</p>'}</div>` +
          '<button type="button" class="btn btn-outline pd-back" data-pd-back>&larr; Zurück zur Übersicht</button></div>' +
        '</details></article>';
      }).join('');
      /* Text erst beim Aufklappen holen (einmal) */
      const fill = async (item) => {
        const box = item.querySelector('.pd-paras');
        if (!box || box.dataset.ok) return;
        box.dataset.ok = '1';
        try {
          box.innerHTML = sermonHTML(await sermonText(list[Number(item.dataset.i)], legacy)) || '<p>Kein Text vorhanden.</p>';
        } catch {
          delete box.dataset.ok;
          box.innerHTML = '<p>Der Text konnte nicht geladen werden. Bitte später noch einmal versuchen.</p>';
        }
      };
      el.addEventListener('toggle', (ev) => {
        const det = ev.target;
        if (det.tagName === 'DETAILS' && det.open) fill(det.closest('.pd-item'));
      }, true);
      /* Format erkennen, wenn die Datei keine Masse nennt */
      for (const im of el.querySelectorAll('.pd-item:not(.pd-hoch):not(.pd-quer) .pd-img img')) {
        const set = () => im.closest('.pd-item').classList.add(im.naturalHeight > im.naturalWidth ? 'pd-hoch' : 'pd-quer');
        if (im.complete && im.naturalWidth) set(); else im.addEventListener('load', set, { once: true });
      }
      el.addEventListener('click', (ev) => {
        const back = ev.target.closest('[data-pd-back]');
        if (!back) return;
        const item = back.closest('.pd-item');
        item.querySelector('details').open = false;
        item.scrollIntoView({ block: 'start' });
      });
      const target = /^#pd-\d+$/.test(location.hash) && el.querySelector(location.hash + ' details');
      if (target) target.open = true;
    }
  }

  /* ---------- Aspersdorf: Friedhofsgebuehren ---------- */
  async function friedhof() {
    const hosts = qsa('[data-inhalt="friedhof"]');
    if (!hosts.length) return;
    const tabellen = ((await load('friedhof.json')).tabellen || []).filter((t) => t && t.titel);
    /* Ohne Eintraege in der Datei bleibt der Inhalt aus dem HTML */
    if (!tabellen.length) return;
    for (const el of hosts) {
      el.innerHTML = tabellen.map((t) =>
        '<section class="fee-block">' +
          (t.stand ? `<div class="s-label">${esc(t.stand)}</div>` : '') +
          `<h3 class="card-title fee-title">${esc(t.titel)}</h3>` +
          (t.einleitung ? `<p class="s-text fee-intro">${esc(t.einleitung)}</p>` : '') +
          '<table class="fee-table">' + (t.zeilen || []).map((z) => (String(z.betrag || '').trim()
            ? `<tr><td>${esc(z.text)}</td><td>${esc(z.betrag)}</td></tr>`
            : `<tr><th colspan="2">${esc(z.text)}</th></tr>`)).join('') + '</table>' +
          (t.hinweis ? `<p class="fee-note">${esc(t.hinweis)}</p>` : '') +
        '</section>').join('');
    }
  }

  /* ---------- Paten der Kirchenmusik ---------- */
  /* "A, B und C" */
  const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} und ${xs[xs.length - 1]}`);
  async function paten() {
    const list = document.querySelector('[data-inhalt="paten"]');
    const ehren = document.querySelector('[data-inhalt="ehrenpaten"]');
    const stufen = document.querySelector('[data-inhalt="stufen"]');
    const paypal = document.querySelector('[data-inhalt="paypal"]');
    if (!list && !ehren && !stufen && !paypal) return;
    const data = await load('paten.json');
    if (list) list.innerHTML = (data.paten || []).map((n) => `<li>${esc(n)}</li>`).join('');
    if (ehren) {
      const e = data.ehrenpaten || [];
      ehren.textContent = e.length ? ` ${e.length === 1 ? 'Ehrenpate ist' : 'Ehrenpaten sind'} ${andList(e)}.` : '';
    }
    /* Ohne "stufen" in der Datei bleiben die Karten aus dem HTML stehen, ebenso auf uebersetzten Seiten */
    if (stufen && LANG === 'de' && Array.isArray(data.stufen) && data.stufen.length) {
      stufen.innerHTML = data.stufen.map((s) =>
        `<div class="card"><div class="card-title">${esc(s.titel)}</div>` +
        (s.betrag ? `<div class="card-price">${esc(s.betrag)}</div>` : '') +
        (s.text ? `<div class="card-text">${rich(s.text)}</div>` : '') + '</div>').join('');
    }
    const link = paypal && /^https:\/\//i.test(data.paypal || '') ? url(data.paypal) : '';
    if (link) paypal.querySelector('a').href = link;
  }

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

  /* ---------- Impressum und Datenschutz ---------- */
  async function rechtliches() {
    const host = document.querySelector('[data-inhalt="rechtliches"]');
    if (!host) return;
    const page = (await load('rechtliches.json'))[host.dataset.seite];
    if (!page || !Array.isArray(page.abschnitte) || !page.abschnitte.length) return;
    const { toc, body } = HD.legalHTML(page, ROOT);
    const list = host.querySelector('.legal-toc ol');
    const content = host.querySelector('.legal');
    if (!list || !content) return;
    list.innerHTML = toc;
    content.innerHTML = body;
    for (const [key, el] of [['titel', qsa('[data-rechtliches="titel"]')], ['untertitel', qsa('[data-rechtliches="untertitel"]')]]) {
      if (page[key]) el.forEach((x) => { x.textContent = page[key]; });
    }
    /* Knopf "Cookie-Einstellungen": nur, wenn die Statistik eingerichtet ist (dann steht er auch in der Fusszeile) */
    if (document.querySelector('.f-links .cc-open')) host.querySelectorAll('.cc-open[hidden]').forEach((b) => { b.hidden = false; });
    /* Sprung auf einen Abschnitt (#cookies) nach dem Neuzeichnen */
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }
  /* Inhaltsverzeichnis: markiert den Abschnitt, der gerade gelesen wird */
  function legalToc() {
    const host = document.querySelector('.legal-layout');
    if (!host || !('IntersectionObserver' in window)) return;
    let obs = null;
    const watch = () => {
      if (obs) obs.disconnect();
      const links = new Map(Array.from(host.querySelectorAll('.legal-toc a'), (a) => [a.hash.slice(1), a]));
      const visible = new Set();
      obs = new IntersectionObserver((entries) => {
        for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
        const first = Array.from(host.querySelectorAll('.legal-sec')).find((s) => visible.has(s.id));
        if (!first) return;
        links.forEach((a, id) => { if (id === first.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      }, { rootMargin: '-15% 0px -70% 0px' });
      host.querySelectorAll('.legal-sec').forEach((s) => obs.observe(s));
    };
    watch();
    new MutationObserver(watch).observe(host.querySelector('.legal'), { childList: true });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    legalToc();
    /* Impressum zuerst: es enthaelt die Oeffnungszeiten der Pfarrkanzlei, die kontakt() danach eintraegt */
    await rechtliches().catch(() => { /* Rueckfall: Inhalt aus dem HTML */ });
    /* Jeder Bereich fuer sich: scheitert einer, bleibt dort der HTML-Inhalt */
    for (const fn of [gottesdienste, rundenListe, rundeSeite, personen, mitbruderFotos, fotos, kontakt, repertoire, paten, pgr, predigten, aspWochen, friedhof, cds, galerie, rundgang]) {
      fn().catch(() => { /* Rueckfall: Inhalt aus dem HTML */ });
    }
  });
})();
