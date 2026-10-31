/* ============================================================
   Augustinerkirche Wien — news.js
   Neuigkeiten aus data/news.csv (Excel-Tabelle):
   - Startseite und Hauptseiten (#news-grid, data-seite): die 4 neuesten Meldungen
     fuer diese Seite (Spalte "Seiten", leer = alle Seiten) als Karten;
     Meldungen mit abgelaufenem "Bis"-Datum ruecken nach unten und
     fuellen nur noch auf, wenn es weniger als 4 aktive gibt
   - Archiv (#news-archive): alle Meldungen, auch die der Startseite, nach Jahren
   - Klick auf eine Meldung oeffnet ein Fenster mit allen Infos
   - Fotos einer Meldung (data/news-fotos.json, z. B. ein Bericht) stehen im
     Fenster als Bildergalerie wie auf Facebook (bis zu 5 Kacheln, auf der
     letzten "+N"); ein Klick oeffnet sie gross zum Durchblaettern (lightbox.js).
     Ohne eigenes Bild zeigt die Karte das erste Foto.
   Aufruf mit ?news=ID oeffnet die Meldung direkt (teilbarer Link).
   Benoetigt js/hochaemter-data.js (CSV-Parser und Hilfen).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;

  const LATEST = 4;   /* gleiche Zahl wie NEWS_HOME in js/admin/admin.js */
  const KEYS = {
    datum: 'date', bis: 'until', kategorie: 'cat', titel: 'title', kurztext: 'teaser', infos: 'infos',
    details: 'details', vorschaubild: 'thumb', plakat: 'poster', link: 'link', linktext: 'linktext',
    weitererlink: 'link2', weitererlinktext: 'linktext2', bildausschnitt: 'focus', seiten: 'pages', bericht: 'report', entwurf: 'draft', ab: 'from'
  };
  const CLOSE_ICON = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';

  let base = '';        /* Pfad zur Website-Wurzel (data-base am Container) */
  let entries = [];
  let dialog = null;
  let lastTrigger = null;

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const { esc } = HD;
  let previewing = false;  /* Vorschau der Verwaltung: auch blob:-Adressen (frisch gewaehlte Bilder) */
  /* Adresse aus der Tabelle: relative Pfade bekommen `base`, Unsicheres wird verworfen */
  const url = (u) => (previewing && /^blob:/.test(String(u)) ? String(u) : HD.safeUrl(u, base));
  const isExternal = (u) => /^https?:/i.test(u);

  /* ---------- Daten ---------- */
  const splitPipe = (s) => String(s || '').split('|').map((x) => x.trim()).filter(Boolean);

  /* "Bezeichnung: Wert" -> {label, value}; ohne Doppelpunkt nur der Wert */
  function parseInfo(x) {
    const m = x.match(/^([^:]{1,60}):\s+(.+)$/);
    return m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: x };
  }

  function parse(text) {
    const out = HD.rowsToRaw(HD.parseCSV(text), KEYS).map((o, order) => {
      const iso = HD.isoDate(o.date);
      if (!iso || !o.title) return null;
      /* Entwurf oder noch nicht "Sichtbar ab": gibt es fuer Besucher nicht */
      const d0 = new Date();
      const today = `${d0.getFullYear()}-${HD.pad(d0.getMonth() + 1)}-${HD.pad(d0.getDate())}`;
      if (/^ja$/i.test(o.draft || '') || (HD.isoDate(o.from || '') && HD.isoDate(o.from) > today)) return null;
      return {
        id: `${iso}-${HD.slug(o.title)}`,
        iso, order,
        until: HD.newsUntil(iso, o.until),
        dateObj: HD.dateFromIso(iso),
        cat: o.cat || '', title: o.title, teaser: o.teaser || '',
        infos: splitPipe(o.infos).map(parseInfo),
        details: splitPipe(o.details),
        thumb: o.thumb || '', poster: o.poster || '', link: o.link || '', linktext: o.linktext || '',
        link2: o.link2 || '', linktext2: o.linktext2 || '',
        focus: /^\d{1,3}% \d{1,3}%$/.test(o.focus || '') ? o.focus : '',
        pages: o.pages || '',
        report: /^ja$/i.test(o.report || '') || /^bericht$/i.test(o.cat || ''),
        photos: []
      };
    }).filter(Boolean);
    /* Neueste zuerst; am selben Tag bleibt die Reihenfolge der Tabelle */
    return out.sort((a, b) => b.iso.localeCompare(a.iso) || a.order - b.order);
  }

  /* Startseite: zuerst die neuesten Meldungen, deren "Bis"-Datum
     (einschliesslich) noch nicht vorbei ist; ohne Datum gelten zwei
     Wochen ab dem Datum der Meldung (HD.newsUntil). Sind das weniger als 6, wird mit den neuesten abgelaufenen
     aufgefuellt, die dann unten stehen. Alles andere steht im Archiv. */
  function homeEntries(page) {
    const d = new Date();
    const today = `${d.getFullYear()}-${HD.pad(d.getMonth() + 1)}-${HD.pad(d.getDate())}`;
    const expired = (e) => e.until && e.until < today;
    const mine = entries.filter((e) => HD.newsOnPage(e.pages, page));
    const live = mine.filter((e) => !expired(e));
    const past = mine.filter(expired);
    return [...live, ...past].slice(0, LATEST);
  }

  /* Das Datum einer Meldung wird nirgends angezeigt; es bestimmt nur Reihenfolge, Jahr im Archiv und wie lange sie oben bleibt */
  const pageUrl = (id) => `${location.pathname}?news=${encodeURIComponent(id)}`;

  /* Vorschaubild: eigenes Bild, sonst das Plakat (oberer Ausschnitt), sonst das erste
     Foto der Galerie, sonst das goldene Logo */
  function thumbHTML(e, cls) {
    const klein = (p) => (window.AugBild && p ? window.AugBild.klein(p) : p);
    const own = url(klein(e.thumb || e.poster));
    const src = own || (e.photos[0] ? url(klein(e.photos[0].src)) : '');
    if (src) {
      const pos = own && e.focus ? ` style="object-position:${e.focus}"` : '';
      return `<img class="${cls}${own && e.poster ? '' : ' news-thumb-photo'}" src="${esc(src)}" alt="" width="640" height="480" loading="lazy" decoding="async"${pos}/>`;
    }
    return `<span class="news-noimg"><img src="${esc(base)}assets/logo-gold.png" alt="" width="64" height="64" loading="lazy" decoding="async"/></span>`;
  }
  const DOC = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>';
  const CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const photoCount = (n) => `${n} ${n === 1 ? 'Foto' : 'Fotos'}`;

  /* ---------- Startseite: 4 Karten ---------- */
  function cardHTML(e) {
    return `<a class="news-card" href="${esc(pageUrl(e.id))}" data-id="${esc(e.id)}">` +
      `<div class="news-card-img">${thumbHTML(e, 'news-thumb')}` +
        (e.cat || e.report ? `<span class="news-card-cat">${e.report ? DOC : ''}${esc(e.cat || 'Bericht')}</span>` : '') +
        (e.photos.length > 1 ? `<span class="news-card-photos">${CAMERA}${photoCount(e.photos.length)}</span>` : '') +
      '</div>' +
      '<div class="news-card-body">' +
        `<h3 class="news-card-title">${esc(e.title)}</h3>` +
        `<p class="news-card-text">${HD.formatText(e.teaser)}</p>` +
        '<span class="link-arr">Mehr erfahren</span>' +
      '</div></a>';
  }
  /* data-seite am Container: nur die Meldungen fuer diese Seite (Spalte "Seiten");
     auf den Hauptseiten (data-hide-empty) verschwindet der Bereich ohne Meldungen */
  function renderLatest(el) {
    const page = el.dataset.seite || '';
    const latest = homeEntries(page);
    const section = el.closest('section');
    if (!latest.length && el.hasAttribute('data-hide-empty') && section) {
      section.hidden = true;
      return;
    }
    el.innerHTML = latest.length ? latest.map(cardHTML).join('') : '<p class="s-text">Derzeit gibt es keine Meldungen.</p>';
    const more = qs('#news-more');
    if (more) more.hidden = entries.filter((e) => HD.newsOnPage(e.pages, page)).length <= latest.length;
  }

  /* ---------- Archiv: nach Jahren ---------- */
  function rowHTML(e) {
    return `<a class="news-row" href="${esc(pageUrl(e.id))}" data-id="${esc(e.id)}">` +
      `<div class="news-row-img">${thumbHTML(e, 'news-thumb')}</div>` +
      '<div class="news-row-main">' +
        (e.cat || e.photos.length > 1 ? '<div class="news-row-meta">' +
          (e.cat ? `<span class="news-row-cat">${esc(e.cat)}</span>` : '') +
          (e.photos.length > 1 ? `<span class="news-row-photos">${photoCount(e.photos.length)}</span>` : '') + '</div>' : '') +
        `<h3 class="news-row-title">${esc(e.title)}</h3>` +
        `<p class="news-row-text">${HD.formatText(e.teaser)}</p>` +
      '</div>' +
      '<span class="news-row-go" aria-hidden="true">&rarr;</span></a>';
  }
  function renderArchive(el) {
    /* Alle Meldungen, auch die auf der Startseite: so muss man nicht zurueck */
    if (!entries.length) {
      el.innerHTML = '<p class="s-text">Es gibt noch keine Meldungen.</p>';
      return;
    }
    const years = [...new Set(entries.map((e) => e.dateObj.getFullYear()))].sort((a, b) => b - a);
    const cats = [...new Set(entries.map((e) => e.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const hasReports = entries.some((e) => e.report);
    const opt = (v, t, n) => `<option value="${esc(v)}">${esc(t)}${n === undefined ? '' : ` (${n})`}</option>`;
    const countBy = (fn) => entries.reduce((m, e) => m.set(fn(e), (m.get(fn(e)) || 0) + 1), new Map());
    const catN = countBy((e) => e.cat);
    const yearN = countBy((e) => e.dateObj.getFullYear());
    const monthN = countBy((e) => e.dateObj.getMonth());
    const months = [...monthN.keys()].sort((a, b) => a - b);

    el.innerHTML =
      '<form class="news-filter" role="search" aria-label="Archiv filtern" onsubmit="return false">' +
        '<div class="news-filter-field news-filter-q"><label for="nf-q">Suche</label>' +
          '<input type="search" id="nf-q" class="news-filter-input" placeholder="Titel oder Text" autocomplete="off"/></div>' +
        '<div class="news-filter-field"><label for="nf-cat">Kategorie</label>' +
          `<select id="nf-cat" class="news-filter-input">${opt('', 'Alle Kategorien')}${cats.map((c) => opt(c, c, catN.get(c))).join('')}</select></div>` +
        '<div class="news-filter-field"><label for="nf-year">Jahr</label>' +
          `<select id="nf-year" class="news-filter-input">${opt('', 'Alle Jahre')}${years.map((y) => opt(y, y, yearN.get(y))).join('')}</select></div>` +
        '<div class="news-filter-field"><label for="nf-month">Monat</label>' +
          `<select id="nf-month" class="news-filter-input">${opt('', 'Alle Monate')}${months.map((m) => opt(m, HD.MONTHS[m], monthN.get(m))).join('')}</select></div>` +
        (hasReports ? '<label class="news-filter-check"><input type="checkbox" id="nf-report"/> Nur Berichte</label>' : '') +
        '<button type="button" class="news-filter-reset" id="nf-reset" hidden>Zurücksetzen</button>' +
      '</form>' +
      '<p class="news-filter-count" id="nf-count" aria-live="polite"></p>' +
      '<div class="news-rows" id="news-rows"></div>';

    const rows = qs('#news-rows', el);
    const q = qs('#nf-q', el), cat = qs('#nf-cat', el), year = qs('#nf-year', el), month = qs('#nf-month', el);
    const rep = qs('#nf-report', el), reset = qs('#nf-reset', el), count = qs('#nf-count', el);
    const fold = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const apply = () => {
      const words = fold(q.value).split(/\s+/).filter(Boolean);
      const list = entries.filter((e) =>
        (!cat.value || e.cat === cat.value) &&
        (!year.value || String(e.dateObj.getFullYear()) === year.value) &&
        (!month.value || String(e.dateObj.getMonth()) === month.value) &&
        (!rep || !rep.checked || e.report) &&
        (!words.length || words.every((w) => fold(`${e.title} ${e.teaser} ${e.cat}`).includes(w))));
      const filtered = !!(q.value || cat.value || year.value || month.value || (rep && rep.checked));
      reset.hidden = !filtered;
      count.textContent = filtered ? `${list.length} von ${entries.length} Meldungen` : '';
      if (!list.length) {
        rows.innerHTML = '<p class="s-text">Keine Meldung gefunden. Bitte die Filter ändern.</p>';
        return;
      }
      /* Nach Jahren gruppiert (die Liste ist schon neueste zuerst) */
      let html = '', last = null;
      for (const e of list) {
        const y = e.dateObj.getFullYear();
        if (y !== last) { html += `<h2 class="news-year-head">${y}</h2>`; last = y; }
        html += rowHTML(e);
      }
      rows.innerHTML = html;
    };
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
    reset.addEventListener('click', () => {
      q.value = ''; cat.value = ''; year.value = ''; month.value = '';
      if (rep) rep.checked = false;
      apply();
      q.focus();
    });
    apply();
  }

  /* ---------- Fenster ---------- */
  /* Text der Meldung: Formatierung (fett, kursiv …), Links und E-Mail-Adressen (HD.richText) */
  const linkify = (text) => HD.richText(text, base);
  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'news-dialog';
    dialog.setAttribute('aria-labelledby', 'nd-title');
    dialog.innerHTML =
      `<button type="button" class="nd-close" aria-label="Schließen">${CLOSE_ICON}</button>` +
      '<div class="nd-layout"><div class="nd-media"></div><div class="nd-content"></div></div>';
    document.body.appendChild(dialog);
    /* Klick auf den abgedunkelten Hintergrund (das dialog-Element selbst) schliesst */
    dialog.addEventListener('click', (ev) => {
      if (ev.target === dialog) close();
      const b = ev.target.closest('[data-share]');
      if (b) share(b);
    });
    dialog.addEventListener('close', () => {
      dialog.querySelectorAll('video').forEach((v) => v.pause());
      document.documentElement.classList.remove('nd-lock');
      if (!previewing) history.replaceState(null, '', location.pathname);
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
    qs('.nd-close', dialog).addEventListener('click', close);
  }
  /* Teilen: Menue des Geraets (Handy), sonst Link in die Zwischenablage */
  async function share(btn) {
    const e = entries.find((x) => x.id === btn.dataset.share);
    if (!e) return;
    const link = new URL(pageUrl(e.id), location.href).href;
    const note = btn.parentNode.querySelector('.nd-share-note');
    try {
      if (navigator.share) {
        await navigator.share({ title: e.title, text: e.teaser, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      note.textContent = 'Link kopiert.';
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      note.textContent = link;
    }
  }
  function close() {
    if (dialog && dialog.open) dialog.close();
  }

  /* Bildergalerie wie auf Facebook: 1 Foto gross, 2 nebeneinander, 3 und 4 mit
     einem grossen oben, ab 5 zwei oben und drei unten; auf der fuenften Kachel
     "+N" fuer die uebrigen. Alle Fotos sind Links derselben Galerie, so blaettert
     die Vergroesserung (lightbox.js) durch alle, auch die nicht gezeigten. */
  function galleryHTML(list, title) {
    if (!list.length) return '';
    const shown = Math.min(list.length, 5);
    return `<div class="nd-gallery g-${shown}" role="group" aria-label="${esc(`${photoCount(list.length)} zu „${title}“`)}">` +
      list.map((p, i) => {
        const src = url(p.src);
        if (!src) return '';
        const more = i === 4 && list.length > 5 ? `<span class="nd-g-more" aria-hidden="true">+${list.length - 5}</span>` : '';
        const label = HD.plainText(p.alt) || `Foto ${i + 1} von ${list.length}`;
        return `<a class="nd-g" href="${esc(src)}" data-lightbox data-gallery="news" data-caption="${esc(HD.plainText(p.alt))}"${i >= 5 ? ' hidden' : ''} title="${esc(label)}">` +
          `<img src="${esc(src)}" alt="${esc(label)}" loading="lazy" decoding="async" data-bn=""/>${more}</a>`;
      }).join('') + '</div>';
  }

  /* Eigene Videos der Meldung (MP4/WebM), geladen wird erst beim Abspielen */
  function videosHTML(list) {
    const playable = (s) => /\.(mp4|webm)$/i.test(s) || (previewing && /^blob:/.test(s));
    const items = list.filter((v) => v && playable(String(v.src)))
      .map((v) => ({ src: url(v.src), titel: HD.plainText(v.titel) })).filter((v) => v.src);
    if (!items.length) return '';
    return '<div class="nd-videos">' + items.map((v) =>
      `<figure class="nd-video"><video controls preload="metadata" playsinline src="${esc(v.src)}#t=0.1" aria-label="${esc(v.titel || 'Video')}"></video>` +
      (v.titel ? `<figcaption>${esc(v.titel)}</figcaption>` : '') + '</figure>').join('') + '</div>';
  }

  function mediaHTML(e) {
    const poster = url(e.poster);
    if (poster) {
      return `<a href="${esc(poster)}" target="_blank" rel="noopener" title="Plakat in voller Größe öffnen" data-lightbox>` +
        `<img src="${esc(poster)}" alt="Plakat: ${esc(e.title)}" decoding="async"/></a>`;
    }
    const thumb = url(e.thumb);
    if (thumb) return `<img src="${esc(thumb)}" alt="" decoding="async"/>`;
    return `<span class="news-noimg nd-noimg"><img src="${esc(base)}assets/logo-gold.png" alt="" width="96" height="96"/></span>`;
  }

  /* Schaltflaechen im Fenster: Ziel der Meldung, zweite Schaltflaeche
     (z. B. Kartenverkauf), Plakat */
  const button = (href, text, cls) =>
    `<a class="btn ${cls}" href="${esc(href)}"${isExternal(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(text)}</a>`;
  function actionsHTML(e) {
    const link = url(e.link);
    const link2 = url(e.link2);
    const poster = url(e.poster);
    if (!link && !link2 && !poster) return '';
    return '<div class="nd-actions">' +
      (link ? button(link, e.linktext || 'Mehr erfahren', 'btn-dark') : '') +
      (link2 ? button(link2, e.linktext2 || 'Mehr Informationen', 'btn-gold') : '') +
      (poster ? `<a class="btn btn-outline" href="${esc(poster)}" target="_blank" rel="noopener" data-lightbox>Plakat vergrößern</a>` : '') +
    '</div>';
  }

  function open(id, trigger) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    show(e, trigger);
    history.replaceState(null, '', pageUrl(id));
  }

  /* Fenster einer Meldung zeichnen und oeffnen (auch fuer die Vorschau der Verwaltung) */
  function show(e, trigger) {
    if (!dialog) buildDialog();
    lastTrigger = trigger || null;

    const media = qs('.nd-media', dialog);
    const content = qs('.nd-content', dialog);
    /* Mit Fotos und ohne Plakat (z. B. ein Bericht): eine Spalte, Text oben, Galerie darunter;
       ein eigenes Foto der Meldung steht dann als erstes in der Galerie */
    const single = e.photos.length > 0 && !e.poster;
    const gallery = single && e.thumb && !e.photos.some((p) => p.src === e.thumb)
      ? [{ src: e.thumb, alt: '' }, ...e.photos] : e.photos;
    qs('.nd-layout', dialog).classList.toggle('nd-photo', !e.poster);
    qs('.nd-layout', dialog).classList.toggle('nd-single', single);
    /* Mit Plakat: Fotos in der linken Spalte unter dem Plakat */
    media.innerHTML = single ? '' : `<div class="nd-media-in">${mediaHTML(e)}${galleryHTML(gallery, e.title)}</div>`;

    content.innerHTML =
      (e.cat || e.report ? '<div class="nd-meta">' +
        (e.report ? `<span class="nd-cat nd-report">${DOC}Bericht</span>` : '') +
        (e.cat && !(e.report && /^bericht$/i.test(e.cat)) ? `<span class="nd-cat">${esc(e.cat)}</span>` : '') + '</div>' : '') +
      `<h2 class="nd-title" id="nd-title">${esc(e.title)}</h2>` +
      `<p class="nd-teaser">${linkify(e.teaser)}</p>` +
      (e.infos.length ? '<div class="nd-infos">' + e.infos.map((r) =>
        `<div class="nd-info"><div class="nd-info-label">${esc(r.label || 'Info')}</div><div class="nd-info-value">${linkify(r.value)}</div></div>`
      ).join('') + '</div>' : '') +
      (e.details.length ? `<div class="nd-details">${e.details.map((p) => `<p>${linkify(p)}</p>`).join('')}</div>` : '') +
      (single ? galleryHTML(gallery, e.title) : '') +
      videosHTML(e.videos || []) +
      actionsHTML(e) +
      (previewing ? '' : `<div class="nd-share"><button type="button" class="nd-share-btn" data-share="${esc(e.id)}">${SHARE}Meldung teilen</button><span class="nd-share-note" role="status"></span></div>`);

    content.scrollTop = 0;
    media.scrollTop = 0;
    document.documentElement.classList.add('nd-lock');
    if (!dialog.open) dialog.showModal();
  }

  /* Vorschau in der Verwaltung (admin/neuigkeiten.html): Meldung mit dem Stand des
     Formulars, Bilder auch als noch nicht gespeicherte blob:-Adressen. Die Adresse
     der Seite bleibt dabei unveraendert. */
  window.AugNews = {
    preview(e, trigger) {
      base = '../';
      previewing = true;
      show({
        cat: '', teaser: '', infos: [], details: [], thumb: '', poster: '', link: '', linktext: '',
        link2: '', linktext2: '', focus: '', photos: [], ...e
      }, trigger);
      /* Links der Vorschau oeffnen in einem neuen Tab, damit das Formular erhalten bleibt */
      for (const a of dialog.querySelectorAll('.nd-content a[href]:not([data-lightbox]), .nd-media a[href]:not([data-lightbox])')) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    }
  };

  /* ---------- Start ---------- */
  async function init() {
    const grid = qs('#news-grid');
    const archive = qs('#news-archive');
    const host = grid || archive;
    if (!host) return;
    base = host.getAttribute('data-base') || '';

    /* Klicks auf Karten/Zeilen oeffnen das Fenster; mit Strg/Cmd/Umschalt
       bleibt das normale Verhalten (neuer Tab) erhalten. */
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-id].news-card,[data-id].news-row');
      if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      ev.preventDefault();
      open(a.dataset.id, a);
    });

    try {
      const res = await fetch(`${base}data/news.csv`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      entries = parse(HD.mailDecode(await res.text()));
      if (window.AugBild) await Promise.race([window.AugBild.ready, new Promise((r) => setTimeout(r, 400))]);
    } catch {
      host.innerHTML = '<p class="s-text">Die Neuigkeiten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>';
      return;
    }
    /* Fotos der Meldungen; fehlt die Datei, gibt es eben keine Galerie */
    try {
      const map = (await HD.fetchJSON(`${base}data/news-fotos.json`)).bilder || {};
      for (const e of entries) {
        e.photos = (Array.isArray(map[e.id]) ? map[e.id] : [])
          .filter((p) => p && typeof p.bild === 'string')
          .map((p) => ({ src: p.bild, alt: String(p.alt || '') }));
      }
    } catch {
      /* ohne Galerie weiter */
    }
    /* Videos der Meldungen; fehlt die Datei, gibt es eben keine */
    try {
      const vmap = (await HD.fetchJSON(`${base}data/news-videos.json`)).videos || {};
      for (const e of entries) {
        e.videos = (Array.isArray(vmap[e.id]) ? vmap[e.id] : [])
          .filter((v) => v && typeof v.datei === 'string')
          .map((v) => ({ src: v.datei, titel: String(v.titel || '') }));
      }
    } catch {
      /* ohne Videos weiter */
    }
    if (grid) renderLatest(grid);
    if (archive) renderArchive(archive);
    const wanted = new URLSearchParams(location.search).get('news');
    if (wanted) open(wanted);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
