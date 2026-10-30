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
   - data/seite-<seite>.json: Kopf, Bereiche und Abschnitte einer Seite aus
     admin/seiten.html (<main data-pflege="<seite>">)
   - data/pgr.json: Pfarrgemeinderat ([data-inhalt="pgr-mitglieder"],
     [data-inhalt="pgr-weitere"])
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

  /* Wurzel der Website (aus der Adresse dieses Skripts), damit Pfade aus
     den Datendateien auf jeder Unterseite stimmen */
  const ROOT = new URL('..', document.currentScript.src).href;
  const url = (p) => HD.safeUrl(p, ROOT);
  const rich = (s) => HD.richText(s, ROOT);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const cache = new Map();
  function load(name) {
    if (!cache.has(name)) {
      cache.set(name, HD.fetchJSON(`${ROOT}data/${name}`));
    }
    return cache.get(name);
  }

  const DAYS = { so: 'Sonntag', mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag' };
  const DAY_ORDER = Object.keys(DAYS);
  const byDay = (a, b) => DAY_ORDER.indexOf(a.tag) - DAY_ORDER.indexOf(b.tag) || String(a.zeit).localeCompare(String(b.zeit));

  /* ---------- Gottesdienste ---------- */
  async function gottesdienste() {
    const lit = qsa('[data-inhalt="liturgie"]');
    if (!lit.length) return;
    const list = (await load('gottesdienste.json')).termine.slice().sort(byDay);
    for (const el of lit) {
      el.innerHTML = list.filter((t) => t.liturgie).map((t) =>
        `<tr><td class="gd-day">${esc(DAYS[t.tag] || '')}</td><td class="gd-time">${esc(t.zeit)}</td>` +
        `<td><div class="gd-name">${t.hervorheben ? '<span class="gd-dot"></span>' : ''}${esc(t.name)}</div>` +
        (t.hinweis ? `<div class="gd-note">${esc(t.hinweis)}</div>` : '') + '</td></tr>'
      ).join('');
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

  async function rundenListe() {
    const hosts = qsa('[data-inhalt="runden"]');
    if (!hosts.length) return;
    const { runden } = await load('runden.json');
    for (const el of hosts) {
      let spare = 0;
      el.innerHTML = runden.filter((r) => r.sichtbar !== false).map((r) =>
        `<a class="rk" href="${esc(rundeHref(r))}">${cardImg(r.bild && r.bild.pfad ? r.bild : KIRCHE[spare++ % KIRCHE.length])}` +
        '<div class="rk-body">' +
          `<h3 class="rk-title">${esc(r.titel)}</h3>` +
          (r.kurztext ? `<p class="rk-text">${HD.formatText(r.kurztext)}</p>` : '') +
          nextHTML(nextDate(r)) +
        '</div></a>'
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

  /* ---------- Personen ---------- */
  async function personen() {
    const hosts = qsa('[data-personen]');
    if (!hosts.length) return;
    const data = await load('personen.json');
    for (const el of hosts) {
      const compact = el.dataset.kompakt !== undefined ? ' compact' : '';
      el.innerHTML = (data[el.dataset.personen] || []).map((p) => {
        const src = url(p.bild);
        const size = p.breite && p.hoehe ? ` width="${HD.num(p.breite, 400)}" height="${HD.num(p.hoehe, 500)}"` : '';
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
    /* Leere Zeile = kleiner Abstand (nicht am Anfang oder Ende) */
    const all = k.kanzlei || [];
    const filled = (h) => h.tage || h.zeit;
    const first = all.findIndex(filled);
    const hours = first < 0 ? [] : all.slice(first, all.length - [...all].reverse().findIndex(filled))
      .filter((h, i, a) => filled(h) || filled(a[i - 1]));
    for (const el of strips) {
      el.innerHTML =
        `<div><div class="cs-label">Adresse</div><div class="cs-val">${esc(k.adresse)}<br>${esc(k.ort)}` +
          (k.eingang ? `<br><span class="cs-note">${esc(k.eingang)}</span>` : '') + '</div></div>' +
        `<div><div class="cs-label">Telefon</div><div class="cs-val">${(k.telefon || []).map((t) =>
          `<a href="${esc(HD.telHref(t.nummer))}">${esc(t.nummer)}</a>${t.bezeichnung ? ` <span class="cs-note">${esc(t.bezeichnung)}</span>` : ''}`).join('<br>')}</div></div>` +
        `<div><div class="cs-label">E-Mail</div><div class="cs-val">${HD.mailHTML(k.email)}</div></div>` +
        `<div><div class="cs-label">Pfarrkanzlei</div><div class="cs-val cs-hours">${hours.map((h) => (filled(h)
          ? `<span>${esc(h.tage)}</span><span>${esc(h.zeit)}</span>` : '<span class="cs-gap" aria-hidden="true"></span>')).join('')}</div></div>`;
    }
    for (const el of lines) {
      el.textContent = `Pfarrkanzlei: ${hours.filter(filled).map((h) => `${h.tage} ${h.zeit}`.trim()).join(' ')}`;
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
        return `<div class="g-item"${i >= GAL_SHOWN ? ' hidden' : ''}><a href="${esc(url(f.bild))}" data-lightbox data-gallery="galerie-${n}" data-caption="${esc(cap)}" title="${esc(cap || 'Foto vergrößern')}">` +
          `<img src="${esc(url(f.bild))}" alt="${esc(cap || `Foto ${i + 1}: ${a.titel}`)}" width="${HD.num(f.breite, 900)}" height="${HD.num(f.hoehe, 600)}" loading="lazy" decoding="async"/>${plus}</a></div>`;
      }).join('')}</div>` : '') +
      (videos.length ? `<div class="gal-videos">${videos.map((v) =>
        `<div class="gal-video"><button type="button" class="gal-video-load" data-yt="${esc(v.id)}" data-title="${esc(v.titel || a.titel)}">` +
          `<span class="gal-video-play" aria-hidden="true"></span><span class="gal-video-title">${esc(v.titel || 'Video abspielen')}</span>` +
          '<span class="gal-video-note">Beim Abspielen wird das Video von YouTube geladen.</span></button></div>').join('')}</div>` : '') +
      (audio.length ? `<div class="cd-samples gal-audio" role="group" aria-label="Aufnahmen">${audio.map((h) =>
        `<button type="button" class="cd-play" data-audio="${esc(url(h.datei))}" aria-pressed="false">${esc(h.titel || 'Aufnahme')}</button>`).join('')}</div>` : '') +
      '</article>';
  }
  async function galerie() {
    const host = document.querySelector('[data-inhalt="galerie"]');
    if (!host) return;
    const alben = ((await load('galerie.json')).alben || []).filter((a) => a && a.titel);
    if (!alben.length) return;
    host.innerHTML = alben.map(albumHTML).join('');
    /* Video erst auf Klick einbetten (youtube-nocookie, startet gleich) */
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
      `<div class="g-item${cls(b)}"><a href="${esc(url(b.bild))}" data-lightbox title="Bild vergrößern">` +
      `<img src="${esc(url(b.bild))}" alt="${esc(b.titel)}" loading="lazy" width="${HD.num(b.breite, 900)}" height="${HD.num(b.hoehe, 600)}" decoding="async"${pos(b)}/></a>` +
      (b.titel ? `<div class="g-cap">${esc(b.titel)}</div>` : '') + '</div>').join('');
  }

  /* ---------- Seiten aus der Verwaltung (admin/seiten.html) ----------
     <main data-pflege="augustiner"> liest data/seite-augustiner.json:
     {kopf, bereiche, abschnitte}
     - kopf: Titelbereich {zeile, titel, text, knoepfe: [{text, link}]}
     - bereiche: Teile der Seite unter dem Kopf, in dieser Reihenfolge:
       {art: 'inhalt', id, ueberschrift, unter, bloecke}, {art: 'teaser', …},
       {art: 'html', html} (frei), {art: 'leiste'} (die Leiste mit den Abschnitten) und {art: 'modul', key}
       (ein Teil, der anderswo gepflegt wird, z. B. Aktuelles; bleibt aus dem HTML)
     - abschnitte: Eintraege der linken Leiste {id, titel, gruppe, zeile, ueberschrift, bloecke}
     Bausteine siehe blockHTML; {art: 'modul', key} nimmt ein Element aus dem HTML.
     Fehlt die Datei, gilt das HTML. Mit ?vorschau=<seite> kommt der ungespeicherte
     Stand aus der Verwaltung (localStorage desselben Servers). */
  const PAGE_KEY = (document.querySelector('main[data-pflege]') || { dataset: {} }).dataset.pflege || '';
  const PREVIEW = PAGE_KEY && new URLSearchParams(location.search).get('vorschau') === PAGE_KEY;
  const ROOT_PATH = new URL(ROOT).pathname;
  /* Diese Seite relativ zur Wurzel, fuer [Text](#sprungmarke) im Text */
  const PAGE_REL = location.pathname.startsWith(ROOT_PATH) ? location.pathname.slice(ROOT_PATH.length) : '';
  /* Links auf Seiten der Website mit Pfad statt voller Adresse: so oeffnen sie im selben Tab.
     [Text](mailto:adresse?subject=Betreff) wird ein verschluesselter E-Mail-Link mit Betreff. */
  function richPage(s, opts) {
    const subj = [];
    const text = String(s ?? '').replace(/\]\(#/g, `](${PAGE_REL}#`).replace(/\[([^\]\n]+)\]\(mailto:([^)\s?]+)\?subject=([^)\n]+)\)/g, (m, t, addr, sub) => {
      subj.push([t, addr, sub]);
      return `\u0001${subj.length - 1}\u0001`;
    });
    return HD.richText(text, ROOT_PATH, opts).replace(/\u0001(\d+)\u0001/g, (m, i) => {
      const [t, addr, sub] = subj[+i];
      const html = HD.mailHTML(addr, sub);
      return t.trim() === addr ? html : html.replace(/>[^<]*<\/a>$/, `>${esc(t)}</a>`);
    });
  }
  const paras = (s) => String(s || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pageUrl = (link) => {
    const l = String(link || '').trim();
    if (/^#[\w-]+$/.test(l)) return l;
    return HD.safeUrl(l, ROOT_PATH);
  };
  const imgUrl = (p) => (PREVIEW && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(p || '') ? p : url(p));
  const linkAttrs = (href) => (/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '');

  /* Freier HTML-Baustein: nur unbedenkliche Elemente und Attribute */
  const HTML_TAGS = new Set(['A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CITE', 'CODE', 'DD', 'DIV', 'DL', 'DT', 'EM', 'FIGCAPTION', 'FIGURE', 'H2', 'H3', 'H4', 'HR', 'I', 'IMG', 'LI', 'MARK', 'OL', 'P', 'Q', 'S', 'SECTION', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TIME', 'TR', 'U', 'UL']);
  const HTML_ATTRS = new Set(['class', 'style', 'href', 'src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'target', 'rel', 'colspan', 'rowspan', 'id', 'data-mail', 'data-subject', 'data-lightbox', 'aria-label', 'aria-hidden', 'role']);
  function cleanHTML(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    const walk = (node) => {
      for (const el of Array.from(node.children)) {
        if (!HTML_TAGS.has(el.tagName)) {
          el.remove();
          continue;
        }
        for (const a of Array.from(el.attributes)) {
          const n = a.name.toLowerCase();
          if (!HTML_ATTRS.has(n)) el.removeAttribute(a.name);
          else if ((n === 'href' || n === 'src') && !/^#/.test(a.value) && !HD.safeUrl(a.value)) el.removeAttribute(a.name);
          else if (n === 'style' && /url\s*\(|expression|javascript:/i.test(a.value)) el.removeAttribute(a.name);
        }
        walk(el);
      }
    };
    walk(tpl.content);
    return tpl.innerHTML;
  }

  const rows = (list) => (Array.isArray(list) ? list.filter((r) => r && typeof r === 'object') : []);
  const lines = (list) => (Array.isArray(list) ? list.map((x) => String(x || '').trim()).filter(Boolean) : []);
  function cardHTML(k, stil) {
    const h = stil === 'intro' ? 'h2' : stil === 'drei' ? 'h3' : 'div';
    const kurzTag = stil === 'drei' || stil === 'intro' ? 'p' : 'div';
    const daten = rows(k.daten).filter((d) => d.begriff || d.wert);
    const links = rows(k.links).filter((l) => l.text && pageUrl(l.link));
    const knoepfe = rows(k.knoepfe).filter((l) => l.text && pageUrl(l.link));
    const ziel = k.ziel && pageUrl(k.ziel);
    const tag = ziel ? 'a' : 'div';
    return `<${tag} class="card"${ziel ? ` href="${esc(ziel)}"${linkAttrs(ziel)}` : ''}${/^[\w-]+$/.test(k.id || '') ? ` id="${esc(k.id)}"` : ''}>` +
      (k.titel ? `<${h} class="card-title">${esc(k.titel)}</${h}>` : '') +
      (k.kurz ? `<${kurzTag} class="card-text">${richPage(k.kurz)}</${kurzTag}>` : '') +
      paras(k.text).map((p) => `<p class="card-more">${richPage(p)}</p>`).join('') +
      (daten.length ? `<dl class="organ-facts">${daten.map((d) => `<div><dt>${esc(d.begriff)}</dt><dd>${richPage(d.wert)}</dd></div>`).join('')}</dl>` : '') +
      (k.kontakt ? `<p class="card-contact">${richPage(k.kontakt, ziel ? { links: false } : undefined)}</p>` : '') +
      (links.length && !ziel ? `<ul class="card-links">${links.map((l) => `<li><a class="link-arr" href="${esc(pageUrl(l.link))}"${linkAttrs(pageUrl(l.link))}>${esc(l.text)}</a></li>`).join('')}</ul>` : '') +
      (knoepfe.length && !ziel ? `<div class="card-actions">${knoepfe.map((l, i) => `<a class="btn ${i ? 'btn-outline' : 'btn-gold'}" href="${esc(pageUrl(l.link))}"${linkAttrs(pageUrl(l.link))}>${esc(l.text)}</a>`).join('')}</div>` : '') +
      (ziel && k.zieltext ? `<span class="link-arr">${esc(k.zieltext)}</span>` : '') +
      `</${tag}>`;
  }
  function factsHTML(f) {
    const punkte = lines(f && f.punkte);
    if (!punkte.length) return '';
    return `<div class="sakr-facts"><div class="sakr-facts-title">${esc((f && f.titel) || 'Gut zu wissen')}</div><ul>${punkte.map((p) => `<li>${richPage(p)}</li>`).join('')}</ul></div>`;
  }
  /* ctx.sakramente: die Sakrament-Bausteine desselben Abschnitts (fuer Nummer und Sprungleiste) */
  function blockHTML(b, ctx = {}) {
    switch (b.art) {
      case 'einleitung': return paras(b.text).map((p) => `<p class="s-text">${richPage(p)}</p>`).join('');
      case 'text': return paras(b.text).map((p) => `<p class="bio-p">${richPage(p)}</p>`).join('');
      case 'zwischentitel': return b.text ? `<h3 class="${b.stil === 'klein' ? 'card-title' : 'pane-sub'}">${esc(b.text)}</h3>` : '';
      case 'zeile': return b.text ? `<div class="s-label">${esc(b.text)}</div>` : '';
      case 'liste': {
        const items = lines(b.punkte);
        return items.length ? `<ul class="pgr-tasks pane-list">${items.map((p) => `<li>${richPage(p)}</li>`).join('')}</ul>` : '';
      }
      case 'bild': {
        const src = b.bild && imgUrl(b.bild);
        if (!src) return '';
        const w = HD.num(b.breite, 1200);
        const h = HD.num(b.hoehe, 800);
        const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${w}" height="${h}" loading="lazy" decoding="async"/>`;
        if (b.stil === 'breit') {
          return b.unterschrift
            ? `<figure class="pane-fig pane-wide">${img}<figcaption>${richPage(b.unterschrift)}</figcaption></figure>`
            : img.replace('<img ', '<img class="pane-wide-img" ');
        }
        if (b.stil === 'gruppe') {
          return `<figure class="mitbrueder-foto"><a href="${esc(src)}" data-lightbox title="Foto in voller Größe öffnen">${img}</a>` +
            (b.unterschrift ? `<figcaption>${richPage(b.unterschrift)}</figcaption>` : '') + '</figure>';
        }
        const cls = b.stil === 'rechts' ? ' side' : h > w ? ' hoch' : '';
        return `<figure class="pane-fig${cls}"><a href="${esc(src)}" data-lightbox title="Foto vergrößern">${img}</a>` +
          (b.unterschrift ? `<figcaption>${richPage(b.unterschrift)}</figcaption>` : '') + '</figure>';
      }
      case 'karten': {
        const cards = rows(b.karten).filter((k) => k.titel || k.kurz || k.text);
        if (!cards.length) return '';
        const cls = { zwei: 'cards-2 pane-cards', drei: 'cards-3 pane-cards', intro: 'cards-2 cards-intro' }[b.stil] || 'cards-stack pane-cards';
        return `<div class="${cls}">${cards.map((k) => cardHTML(k, b.stil)).join('')}</div>`;
      }
      case 'kontaktkarte': {
        const zeilen = rows(b.zeilen).filter((z) => z.label || z.wert);
        return '<div class="kontakt-card">' +
          (b.titel ? `<div class="kontakt-title">${esc(b.titel)}</div>` : '') +
          (b.text ? `<p class="kontakt-text">${richPage(b.text)}</p>` : '') +
          (zeilen.length ? `<div class="kontakt-rows">${zeilen.map((z) => `<div class="kontakt-row"><span class="kontakt-label">${esc(z.label)}</span><span class="kontakt-val${z.zeiten ? ' kontakt-hours' : ''}">${richPage(z.wert)}</span></div>`).join('')}</div>` : '') +
          '</div>';
      }
      case 'personen': {
        const ps = rows(b.personen).filter((p) => p.name);
        return ps.length ? `<ul class="pgr-list">${ps.map((p) => '<li class="pgr-item">' +
          `<div><div class="pgr-name">${esc(p.name)}</div>${p.rolle ? `<div class="pgr-role">${esc(p.rolle)}</div>` : ''}</div>` +
          `<div><ul class="pgr-tasks">${lines(p.aufgaben).map((a) => `<li>${richPage(a)}</li>`).join('')}</ul>` +
          (p.kontakt ? `<div class="pgr-contact">${richPage(p.kontakt)}</div>` : '') + '</div></li>').join('')}</ul>` : '';
      }
      case 'zeitleiste': {
        const es = rows(b.eintraege).filter((e) => e.jahr || e.text);
        return es.length ? `<div class="timeline">${es.map((e) => `<div class="timeline-item"><div class="timeline-year">${esc(e.jahr)}</div><div class="timeline-text">${richPage(e.text)}</div></div>`).join('')}</div>` : '';
      }
      case 'kennzahlen': {
        const fs = rows(b.zahlen).filter((f) => f.zahl || f.text);
        return fs.length ? `<div class="facts pane-facts-row">${fs.map((f) => `<div class="fact"><div class="fact-n">${esc(f.zahl)}</div><div class="fact-l">${esc(f.text)}</div></div>`).join('')}</div>` : '';
      }
      case 'daten': {
        const ds = rows(b.daten).filter((d) => d.begriff || d.wert);
        return ds.length ? `<dl class="organ-facts pane-facts">${ds.map((d) => `<div><dt>${esc(d.begriff)}</dt><dd>${richPage(d.wert)}</dd></div>`).join('')}</dl>` : '';
      }
      case 'gutzuwissen': return factsHTML(b);
      case 'links': {
        const ls = rows(b.links).filter((l) => l.text && pageUrl(l.link));
        const as = ls.map((l) => `<a class="link-arr" href="${esc(pageUrl(l.link))}"${linkAttrs(pageUrl(l.link))}>${esc(l.text)}</a>`);
        /* frei: ein einzelner Link ohne eigenen Absatz (wie im HTML gewachsen) */
        return b.stil === 'frei' && as.length === 1 ? as[0] : `<p class="bio-p pane-links">${as.join('')}</p>`;
      }
      case 'linkliste': {
        const ls = rows(b.links).filter((l) => l.text && pageUrl(l.link));
        return ls.length ? `<ul class="link-list">${ls.map((l) => `<li><a href="${esc(pageUrl(l.link))}"${linkAttrs(pageUrl(l.link))}>${esc(l.text)}</a>${l.hinweis ? `<span>${esc(l.hinweis)}</span>` : ''}</li>`).join('')}</ul>` : '';
      }
      case 'heilige': {
        const hs = rows(b.eintraege).filter((e) => e.name);
        return hs.length ? `<ul class="saint-list">${hs.map((e) => `<li><span class="saint-date">${esc(e.datum)}</span><span>${esc(e.name)}</span></li>`).join('')}</ul>` : '';
      }
      case 'tabelle': {
        const zs = rows(b.zeilen).filter((z) => lines(z.zellen).length);
        const cols = Math.max(1, ...zs.map((z) => (z.kopf ? 1 : z.zellen.length)));
        return zs.length ? `<table class="fee-table">${zs.map((z) => (z.kopf
          ? `<tr><th colspan="${cols}">${esc(z.zellen.join(' '))}</th></tr>`
          : `<tr>${z.zellen.map((c) => `<td>${richPage(c)}</td>`).join('')}</tr>`)).join('')}</table>` : '';
      }
      case 'sakrament': {
        const nr = HD.pad((ctx.sakramente || []).indexOf(b) + 1);
        return `<div class="sakr-sec"${/^[\w-]+$/.test(b.anker || '') ? ` id="${esc(b.anker)}"` : ''}>` +
          `<div class="sakr-sec-nr">${nr}</div><h3 class="sakr-sec-title">${esc(b.titel)}</h3>` +
          paras(b.text).map((p) => `<p class="bio-p">${richPage(p)}</p>`).join('') +
          factsHTML(b.fakten) + '</div>';
      }
      case 'sprungleiste': {
        const list = (ctx.sakramente || []).filter((s) => /^[\w-]+$/.test(s.anker || ''));
        if (!list.length) return '';
        const group = (hidden) => `<div class="sakr-track-group"${hidden ? ' aria-hidden="true"' : ''}>` + list.map((s, i) =>
          `<button type="button" class="sakr-chip" data-target="${esc(s.anker)}"${hidden ? ' tabindex="-1"' : ''}><span class="sakr-chip-nr">${HD.pad(i + 1)}</span><span class="sakr-chip-name">${esc(s.kurz || s.titel)}</span></button><span class="sakr-dot" aria-hidden="true"></span>`).join('') + '</div>';
        return `<div class="sakr-band sakr-band-inline" role="group" aria-label="${esc(b.titel || 'Zu den Sakramenten')} springen">` +
          `<div class="sakr-band-label">${esc(b.titel || 'Zu den Sakramenten')}</div>` +
          `<div class="sakr-marquee"><div class="sakr-track">${group(false)}${group(true)}</div></div></div>`;
      }
      case 'personenkarten': {
        const ps = rows(b.personen).filter((x) => x.name);
        return ps.length ? `<div class="people-stack">${ps.map((x) => {
          const src = x.bild && imgUrl(x.bild);
          return `<div class="person-card-wide${b.stil === 'kompakt' ? ' compact' : ''}">` +
            (src ? `<img src="${esc(src)}" alt="${esc(x.alt || x.name)}" loading="lazy" width="${HD.num(x.breite, 480)}" height="${HD.num(x.hoehe, 620)}" decoding="async"/>` : '') +
            `<div class="person-body"><div class="person-name">${esc(x.name)}</div>${x.rolle ? `<div class="person-role">${esc(x.rolle)}</div>` : ''}` +
            paras(x.text).map((t) => `<p class="person-bio">${richPage(t)}</p>`).join('') + '</div></div>';
        }).join('')}</div>` : '';
      }
      case 'orgeln': {
        const os = rows(b.orgeln).filter((o) => o.titel);
        return os.length ? `<div class="organ-grid">${os.map((o) => {
          const src = o.bild && imgUrl(o.bild);
          const ds = rows(o.daten).filter((d) => d.begriff || d.wert);
          return '<div class="organ-card">' +
            (src ? `<img class="organ-img" src="${esc(src)}" alt="${esc(o.alt || o.titel)}" loading="lazy" width="${HD.num(o.breite, 900)}" height="${HD.num(o.hoehe, 1200)}" decoding="async"/>` : '') +
            `<div class="organ-body"><h3 class="organ-title">${esc(o.titel)}</h3>` +
            (ds.length ? `<dl class="organ-facts">${ds.map((d) => `<div><dt>${esc(d.begriff)}</dt><dd>${richPage(d.wert)}</dd></div>`).join('')}</dl>` : '') +
            paras(o.text).map((t) => `<p class="organ-desc">${richPage(t)}</p>`).join('') + '</div></div>';
        }).join('')}</div>` : '';
      }
      case 'gottesdienstzeiten': {
        const zs = rows(b.zeiten).filter((z) => z.tag || z.name);
        return zs.length ? `<div class="pane-gd"><table class="gd-table">${zs.map((z) => `<tr><td class="gd-day">${esc(z.tag)}</td><td class="gd-time">${esc(z.zeit)}</td>` +
          `<td><div class="gd-name">${esc(z.name)}</div>${z.hinweis ? `<div class="gd-note">${richPage(z.hinweis)}</div>` : ''}</td></tr>`).join('')}</table></div>` : '';
      }
      case 'zitatkasten':
        return '<div class="patron-box">' + (b.zeile ? `<div class="s-label">${esc(b.zeile)}</div>` : '') +
          (b.name ? `<div class="patron-name">${esc(b.name)}</div>` : '') + (b.text ? `<div class="patron-text">${richPage(b.text)}</div>` : '') +
          (b.zitat ? `<blockquote class="patron-quote">${esc(b.zitat)}</blockquote>` : '') + '</div>';
      case 'programme': {
        const ps = rows(b.jahre).filter((j) => j.jahr);
        return ps.length ? `<ul class="prog-list">${ps.map((j) => `<li><span class="prog-year">${esc(j.jahr)}</span><span class="prog-links">` +
          rows(j.links).filter((l) => l.text && pageUrl(l.link)).map((l) => `<a href="${esc(pageUrl(l.link))}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join('') + '</span></li>').join('')}</ul>` : '';
      }
      case 'html': return cleanHTML(b.html);
      default: return '';
    }
  }

  /* Schluessel eines Elements aus dem HTML, das an seinem Platz bleibt (Modul):
     eigene ID, sonst die erste ID oder data-inhalt/data-personen darin */
  function modKey(el) {
    if (el.id) return `#${el.id}`;
    const d = el.querySelector('[id]');
    if (d) return `>#${d.id}`;
    const di = el.matches('[data-inhalt]') ? el : el.querySelector('[data-inhalt]');
    if (di) return `[data-inhalt=${di.dataset.inhalt}]`;
    const dp = el.matches('[data-personen]') ? el : el.querySelector('[data-personen]');
    if (dp) return `[data-personen=${dp.dataset.personen}]`;
    return `.${el.className.trim().split(/\s+/)[0]}`;
  }
  /* Bausteine eines Bereichs oder Abschnitts; own: die Elemente aus dem HTML */
  function fillBlocks(host, bloecke, own) {
    const list = rows(bloecke);
    const ctx = { sakramente: list.filter((b) => b.art === 'sakrament') };
    const used = new Set();
    for (const b of list) {
      if (b.art === 'modul' || b.art === 'fest') {
        const el = b.art === 'fest' ? own[b.nr] : own.find((e) => !used.has(e) && modKey(e) === b.key);
        if (el) {
          used.add(el);
          host.append(el);
        }
      } else {
        host.insertAdjacentHTML('beforeend', blockHTML(b, ctx));
      }
    }
  }

  function applyKopf(k) {
    if (!k || typeof k !== 'object') return;
    const main = document.querySelector('main[data-pflege]');
    const hero = main.querySelector(':scope > .hero .hero-content');
    const ph = main.querySelector(':scope > .page-hero');
    const set = (sel, html, root) => {
      const el = root && root.querySelector(sel);
      if (el && html !== null) el.innerHTML = html;
    };
    const titel = String(k.titel || '').split('\n').map((l) => richPage(l.trim(), { links: false })).join('<br>');
    if (hero) {
      set('.hero-eyebrow', esc(k.zeile || ''), hero);
      set('.hero-h1', titel, hero);
      set('.hero-sub', richPage(k.text || ''), hero);
      const acts = hero.querySelector('.hero-actions');
      const btns = rows(k.knoepfe).filter((l) => l.text && pageUrl(l.link));
      if (acts) acts.innerHTML = btns.map((l, i) => `<a class="btn ${i ? 'btn-outline-w' : 'btn-gold'}" href="${esc(pageUrl(l.link))}"${linkAttrs(pageUrl(l.link))}>${esc(l.text)}</a>`).join('');
    } else if (ph) {
      set('.ph-tag', esc(k.zeile || ''), ph);
      set('.ph-title', titel, ph);
      set('.ph-sub', richPage(k.text || ''), ph);
    }
  }

  function applyBereiche(list) {
    const main = document.querySelector('main[data-pflege]');
    const kids = Array.from(main.children);
    const head = kids.filter((el) => el.matches('.hero, .page-hero'));
    const own = kids.filter((el) => !head.includes(el));
    const used = new Set();
    const frag = document.createDocumentFragment();
    for (const b of list) {
      if (b.art === 'leiste' || b.art === 'modul') {
        const el = b.art === 'leiste' ? own.find((e) => e.querySelector('.with-sidebar')) : own.find((e) => !used.has(e) && modKey(e) === b.key);
        if (el) {
          used.add(el);
          frag.append(el);
        }
      } else if (b.art === 'html') {
        const tpl = document.createElement('template');
        tpl.innerHTML = cleanHTML(b.html);
        frag.append(tpl.content);
      } else if (b.art === 'teaser') {
        const sec = document.createElement('section');
        sec.className = 'herzgruft';
        const src = b.bild && imgUrl(b.bild);
        sec.innerHTML = '<div>' + (b.zeile ? `<div class="s-label">${esc(b.zeile)}</div>` : '') +
          (b.titel ? `<h2 class="s-title">${esc(b.titel)}</h2>` : '') +
          paras(b.text).map((p) => `<p class="s-text">${richPage(p)}</p>`).join('') +
          (b.linktext && pageUrl(b.link) ? `<a class="link-arr" href="${esc(pageUrl(b.link))}">${esc(b.linktext)}</a>` : '') +
          '</div><div class="herzgruft-img"></div>';
        if (src) sec.lastElementChild.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
        frag.append(sec);
      } else if (b.art === 'inhalt') {
        const sec = document.createElement('section');
        sec.className = 'section section-ruled';
        if (/^[\w-]+$/.test(b.id || '')) sec.id = b.id;
        const inner = document.createElement('div');
        inner.className = 'inner';
        if (b.ueberschrift) inner.innerHTML = `<div class="sec-head"><h2 class="s-title">${esc(b.ueberschrift)}${b.unter ? ` <span class="s-title-sub">${esc(b.unter)}</span>` : ''}</h2></div>`;
        fillBlocks(inner, b.bloecke, []);
        sec.append(inner);
        frag.append(sec);
      }
    }
    for (const el of own) if (!used.has(el)) el.remove();
    main.append(frag);
  }

  function applyAbschnitte(list) {
    const box = document.querySelector('main[data-pflege] .with-sidebar');
    const sidebar = box && box.querySelector('.sidebar');
    const area = sidebar && sidebar.nextElementSibling;
    if (!area || !list.length) return;
    const panes = new Map(Array.from(area.querySelectorAll(':scope > .tab-pane')).map((p) => [p.id, p]));
    const parts = new Map();
    for (const [id, p] of panes) parts.set(id, Array.from(p.children).filter((c) => !c.classList.contains('pane-steps')));
    const oldBtns = new Map(Array.from(sidebar.querySelectorAll('.sidebar-item[data-pane]')).map((b) => [b.dataset.pane, b]));
    const active = (area.querySelector(':scope > .tab-pane.active') || {}).id;

    const nav = sidebar.querySelector('.sidebar-list') || sidebar;
    nav.textContent = '';
    let group = null;
    list.forEach((a, i) => {
      const g = String(a.gruppe || '').trim();
      if (i === 0 || g !== group) {
        if (i > 0) nav.insertAdjacentHTML('beforeend', '<div class="sidebar-divider"></div>');
        if (g) nav.insertAdjacentHTML('beforeend', `<span class="sidebar-group-label">${esc(g)}</span>`);
        group = g;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sidebar-item';
      btn.dataset.pane = a.id;
      btn.textContent = String(a.titel || a.ueberschrift || a.id);
      btn.hidden = Boolean(oldBtns.get(a.id) && oldBtns.get(a.id).hidden);
      nav.append(btn);
    });

    const keep = new Set();
    for (const a of list) {
      let pane = panes.get(a.id);
      if (!pane) {
        pane = document.createElement('div');
        pane.className = 'tab-pane';
        pane.id = a.id;
      }
      const own = parts.get(a.id) || [];
      pane.textContent = '';
      if (a.zeile) pane.insertAdjacentHTML('beforeend', `<div class="s-label">${esc(a.zeile)}</div>`);
      if (a.ueberschrift) pane.insertAdjacentHTML('beforeend', `<h2 class="s-title">${esc(a.ueberschrift)}</h2>`);
      fillBlocks(pane, a.bloecke, own);
      area.append(pane);
      keep.add(a.id);
    }
    for (const [id, p] of panes) if (!keep.has(id)) p.remove();
    const show = keep.has(active) ? active : list[0].id;
    for (const p of area.querySelectorAll(':scope > .tab-pane')) p.classList.toggle('active', p.id === show);
    for (const b of nav.querySelectorAll('.sidebar-item')) b.classList.toggle('active', b.dataset.pane === show);
  }

  async function seite() {
    if (!/^[a-z-]+$/.test(PAGE_KEY)) return;
    let data = null;
    if (PREVIEW) {
      try {
        data = JSON.parse(localStorage.getItem(`aug-vorschau-${PAGE_KEY}`));
      } catch {
        data = null;
      }
      if (data) {
        document.body.insertAdjacentHTML('afterbegin', '<div class="preview-bar" role="status">Vorschau aus der Verwaltung: noch nicht gespeichert</div>');
      }
    }
    if (!data) {
      try {
        data = await load(`seite-${PAGE_KEY}.json`);
      } catch {
        return; /* noch nie gespeichert: das HTML gilt */
      }
    }
    if (!data || typeof data !== 'object') return;
    applyKopf(data.kopf);
    if (Array.isArray(data.bereiche) && data.bereiche.length) applyBereiche(rows(data.bereiche));
    const abschnitte = rows(data.abschnitte).filter((a) => /^[\w-]+$/.test(a.id || ''));
    if (abschnitte.length) applyAbschnitte(abschnitte);
    /* main.js: Leiste, Schritte, aktuellen Bereich und Sprungziel neu einrichten */
    document.dispatchEvent(new Event('aug:leiste'));
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
    const data = await load('pgr.json');
    for (const el of hosts) {
      const list = data[el.dataset.inhalt.slice(4)] || [];
      el.innerHTML = list.map(pgrItem).join('');
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
    /* Ohne "stufen" in der Datei bleiben die Karten aus dem HTML stehen */
    if (stufen && Array.isArray(data.stufen) && data.stufen.length) {
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
    for (const fn of [seite, gottesdienste, rundenListe, rundeSeite, personen, kontakt, repertoire, paten, pgr, cds, galerie, rundgang]) {
      fn().catch(() => { /* Rueckfall: Inhalt aus dem HTML */ });
    }
  });
})();
