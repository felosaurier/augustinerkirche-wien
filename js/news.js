/* ============================================================
   Augustinerkirche Wien — news.js
   Neuigkeiten aus data/news.csv (Excel-Tabelle):
   - Startseite (#news-grid): die 6 neuesten Meldungen als Karten
   - Archiv (#news-archive): alle aelteren Meldungen, nach Jahren
   - Klick auf eine Meldung oeffnet ein Fenster mit allen Infos
   Aufruf mit ?news=ID oeffnet die Meldung direkt (teilbarer Link).
   Benoetigt js/hochaemter-data.js (CSV-Parser und Hilfen).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  if (!HD) return;

  const LATEST = 6;
  const KEYS = {
    datum: 'date', kategorie: 'cat', titel: 'title', kurztext: 'teaser', infos: 'infos',
    details: 'details', vorschaubild: 'thumb', plakat: 'poster', link: 'link', linktext: 'linktext'
  };
  const CLOSE_ICON = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';

  let base = '';        /* Pfad zur Website-Wurzel (data-base am Container) */
  let entries = [];
  let dialog = null;
  let lastTrigger = null;

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const { esc } = HD;
  /* Adresse aus der Tabelle: relative Pfade bekommen `base`, Unsicheres wird verworfen */
  const url = (u) => HD.safeUrl(u, base);
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
      return {
        id: `${iso}-${HD.slug(o.title)}`,
        iso, order,
        dateObj: HD.dateFromIso(iso),
        cat: o.cat || '', title: o.title, teaser: o.teaser || '',
        infos: splitPipe(o.infos).map(parseInfo),
        details: splitPipe(o.details),
        thumb: o.thumb || '', poster: o.poster || '', link: o.link || '', linktext: o.linktext || ''
      };
    }).filter(Boolean);
    /* Neueste zuerst; am selben Tag bleibt die Reihenfolge der Tabelle */
    return out.sort((a, b) => b.iso.localeCompare(a.iso) || a.order - b.order);
  }

  const longDate = (e) => `${e.dateObj.getDate()}. ${HD.MONTHS[e.dateObj.getMonth()]} ${e.dateObj.getFullYear()}`;
  const shortDate = (e) => `${e.dateObj.getDate()}. ${HD.MONTHS[e.dateObj.getMonth()]}`;
  const pageUrl = (id) => `${location.pathname}?news=${encodeURIComponent(id)}`;

  /* Vorschaubild: eigenes Bild, sonst das Plakat (oberer Ausschnitt), sonst das goldene Logo */
  function thumbHTML(e, cls) {
    const src = url(e.thumb || e.poster);
    if (src) {
      return `<img class="${cls}${e.poster ? '' : ' news-thumb-photo'}" src="${esc(src)}" alt="" width="640" height="480" loading="lazy" decoding="async"/>`;
    }
    return `<span class="news-noimg"><img src="${esc(base)}assets/logo-gold.png" alt="" width="64" height="64" loading="lazy" decoding="async"/></span>`;
  }

  /* ---------- Startseite: 6 Karten ---------- */
  function cardHTML(e) {
    return `<a class="news-card" href="${esc(pageUrl(e.id))}" data-id="${esc(e.id)}">` +
      `<div class="news-card-img">${thumbHTML(e, 'news-thumb')}` +
        (e.cat ? `<span class="news-card-cat">${esc(e.cat)}</span>` : '') +
      '</div>' +
      '<div class="news-card-body">' +
        `<div class="news-card-date">${esc(longDate(e))}</div>` +
        `<h3 class="news-card-title">${esc(e.title)}</h3>` +
        `<p class="news-card-text">${esc(e.teaser)}</p>` +
        '<span class="link-arr">Mehr erfahren</span>' +
      '</div></a>';
  }
  function renderLatest(el) {
    const latest = entries.slice(0, LATEST);
    el.innerHTML = latest.length ? latest.map(cardHTML).join('') : '<p class="s-text">Derzeit gibt es keine Meldungen.</p>';
    const more = qs('#news-more');
    if (more) more.hidden = entries.length <= LATEST;
  }

  /* ---------- Archiv: nach Jahren ---------- */
  function rowHTML(e) {
    return `<a class="news-row" href="${esc(pageUrl(e.id))}" data-id="${esc(e.id)}">` +
      `<div class="news-row-img">${thumbHTML(e, 'news-thumb')}</div>` +
      '<div class="news-row-main">' +
        `<div class="news-row-meta"><span>${esc(shortDate(e))}</span>${e.cat ? `<span class="news-row-cat">${esc(e.cat)}</span>` : ''}</div>` +
        `<h3 class="news-row-title">${esc(e.title)}</h3>` +
        `<p class="news-row-text">${esc(e.teaser)}</p>` +
      '</div>' +
      '<span class="news-row-go" aria-hidden="true">&rarr;</span></a>';
  }
  function renderArchive(el) {
    const older = entries.slice(LATEST);
    if (!older.length) {
      el.innerHTML = '<p class="s-text">Im Archiv befinden sich noch keine Meldungen. Sobald es mehr als sechs aktuelle Neuigkeiten gibt, wandern die älteren automatisch hierher.</p>';
      return;
    }
    /* Einmal nach Jahren gruppieren (Map behaelt die Einfuegereihenfolge) */
    const byYear = new Map();
    for (const e of older) {
      const y = e.dateObj.getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);

    el.innerHTML =
      '<div class="news-years" role="group" aria-label="Jahr wählen">' +
        years.map((y, i) =>
          `<button type="button" class="news-year${i === 0 ? ' active' : ''}" data-year="${y}" aria-pressed="${i === 0}">${y}<span class="news-year-n">${byYear.get(y).length}</span></button>`
        ).join('') +
      '</div>' +
      '<div class="news-rows" id="news-rows" aria-live="polite"></div>';

    const rows = qs('#news-rows', el);
    const show = (y) => { rows.innerHTML = byYear.get(y).map(rowHTML).join(''); };
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('.news-year');
      if (!b) return;
      for (const x of el.querySelectorAll('.news-year')) {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
      show(Number(b.dataset.year));
    });
    show(years[0]);
  }

  /* ---------- Fenster ---------- */
  /* E-Mail-Adressen im (bereits escapten) Text als mailto-Links; das Muster
     enthaelt weder < > noch Anfuehrungszeichen und kann kein HTML erzeugen. */
  function linkify(text) {
    return esc(text).replace(/([A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,})/g, '<a href="mailto:$1">$1</a>');
  }
  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'news-dialog';
    dialog.setAttribute('aria-labelledby', 'nd-title');
    dialog.innerHTML =
      `<button type="button" class="nd-close" aria-label="Schließen">${CLOSE_ICON}</button>` +
      '<div class="nd-layout"><div class="nd-media"></div><div class="nd-content"></div></div>';
    document.body.appendChild(dialog);
    /* Klick auf den abgedunkelten Hintergrund (das dialog-Element selbst) schliesst */
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) close(); });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('nd-lock');
      history.replaceState(null, '', location.pathname);
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
    qs('.nd-close', dialog).addEventListener('click', close);
  }
  function close() {
    if (dialog && dialog.open) dialog.close();
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

  function actionsHTML(e) {
    const link = url(e.link);
    if (!link) return '';
    const poster = url(e.poster);
    return '<div class="nd-actions">' +
      `<a class="btn btn-dark" href="${esc(link)}"${isExternal(link) ? ' target="_blank" rel="noopener"' : ''}>${esc(e.linktext || 'Mehr erfahren')}</a>` +
      (poster ? `<a class="btn btn-outline" href="${esc(poster)}" target="_blank" rel="noopener" data-lightbox>Plakat vergrößern</a>` : '') +
    '</div>';
  }

  function open(id, trigger) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    if (!dialog) buildDialog();
    lastTrigger = trigger || null;

    const media = qs('.nd-media', dialog);
    const content = qs('.nd-content', dialog);
    qs('.nd-layout', dialog).classList.toggle('nd-photo', !e.poster);
    media.innerHTML = mediaHTML(e);

    content.innerHTML =
      `<div class="nd-meta">${e.cat ? `<span class="nd-cat">${esc(e.cat)}</span>` : ''}<span class="nd-date">${esc(longDate(e))}</span></div>` +
      `<h2 class="nd-title" id="nd-title">${esc(e.title)}</h2>` +
      '<div class="divider-g"></div>' +
      `<p class="nd-teaser">${esc(e.teaser)}</p>` +
      (e.infos.length ? '<div class="nd-infos">' + e.infos.map((r) =>
        `<div class="nd-info"><div class="nd-info-label">${esc(r.label || 'Info')}</div><div class="nd-info-value">${linkify(r.value)}</div></div>`
      ).join('') + '</div>' : '') +
      (e.details.length ? `<div class="nd-details">${e.details.map((p) => `<p>${linkify(p)}</p>`).join('')}</div>` : '') +
      actionsHTML(e);

    content.scrollTop = 0;
    media.scrollTop = 0;
    document.documentElement.classList.add('nd-lock');
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, '', pageUrl(id));
  }

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
      entries = parse(await res.text());
    } catch {
      host.innerHTML = '<p class="s-text">Die Neuigkeiten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>';
      return;
    }
    if (grid) renderLatest(grid);
    if (archive) renderArchive(archive);
    const wanted = new URLSearchParams(location.search).get('news');
    if (wanted) open(wanted);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
