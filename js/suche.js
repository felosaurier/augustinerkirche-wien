/* ============================================================
   Augustinerkirche Wien — suche.js
   Suche ueber die Website (Knopf mit der Lupe in der Titelzeile, oder die Taste "/"):
   - Seiten: alle Links der Menues plus ein paar feste Seiten mit Stichwoertern
   - Neuigkeiten: data/news.csv (ohne Entwuerfe und noch nicht sichtbare)
   - Hochaemter und Konzerte: data/hochaemter.csv (kommende)
   Wird von js/main.js erst beim ersten Klick geladen. Benoetigt js/hochaemter-data.js
   (wird bei Bedarf nachgeladen).
   ============================================================ */
(function () {
  'use strict';

  const ROOT = new URL('..', document.currentScript.src).href;
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  let HD = window.HochamtData;
  let dialog = null;
  let input = null;
  let out = null;
  let index = null;     /* Seiten */
  let news = null;
  let events = null;

  const EXTRA = [
    ['Kontakt', 'pages/kontakt.html', 'telefon anrufen adresse anfahrt karte offnungszeiten pfarrkanzlei email mail'],
    ['Wochenkalender', 'pages/kalender.html#woche', 'termine woche messen gottesdienst heute'],
    ['Kalender (Monat)', 'pages/kalender.html', 'termine monat'],
    ['Archiv der Neuigkeiten', 'pages/archiv.html', 'meldungen berichte nachrichten'],
    ['Gottesdienste', 'pages/augustinerkirche.html#p-zeiten', 'messe heilige messe zeiten beichte liturgie'],
    ['Hochämter', 'pages/musik.html#p-hochaemter', 'sonntag 11 uhr konzert chor orchester messe'],
    ['Sakramente', 'pages/augustinerkirche.html#p-sakramente', 'taufe hochzeit trauung firmung erstkommunion'],
    ['Impressum', 'pages/impressum.html', 'rechtliches verantwortlich'],
    ['Datenschutz', 'pages/datenschutz.html', 'rechtliches daten cookies']
  ];

  function loadHD() {
    if (HD) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = `${ROOT}js/hochaemter-data.js`;
      sc.onload = () => { HD = window.HochamtData; HD ? resolve() : reject(new Error('HD')); };
      sc.onerror = reject;
      document.head.append(sc);
    });
  }

  function pageIndex() {
    const seen = new Map();
    const list = [];
    const add = (title, href, extra, group) => {
      if (!title || !href) return;
      const abs = new URL(href, location.href).href;
      if (!abs.startsWith(ROOT)) return;
      /* Seite schon aus dem Menue bekannt: nur die Stichwoerter ergaenzen */
      if (seen.has(abs)) {
        seen.get(abs).text += ` ${fold(`${title} ${extra || ''}`)}`;
        return;
      }
      const item = { title: title.replace(/\s+/g, ' ').trim(), url: abs, text: fold(`${title} ${extra || ''} ${group || ''}`), group: group || 'Seite' };
      seen.set(abs, item);
      list.push(item);
    };
    for (const a of document.querySelectorAll('nav .mega a[href], .nav-center a[href]')) {
      const grp = a.closest('.mega-group');
      const label = grp && grp.querySelector('.mega-group-label');
      add(a.textContent, a.getAttribute('href'), '', label ? label.textContent : 'Seite');
    }
    for (const [t, h, k] of EXTRA) add(t, ROOT + h, k, 'Seite');
    return list;
  }

  async function loadNews() {
    const res = await fetch(`${ROOT}data/news.csv`);
    if (!res.ok) return [];
    const rows = HD.parseCSV(HD.mailDecode(await res.text()));
    if (!rows.length) return [];
    const head = rows[0].map((c) => String(c).trim().toLowerCase());
    const col = (n) => head.lastIndexOf(n);
    const [iD, iT, iK, iC, iE, iA] = ['datum', 'titel', 'kurztext', 'kategorie', 'entwurf', 'ab'].map(col);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return rows.slice(1).map((r) => {
      const date = HD.isoDate((r[iD] || '').trim());
      const title = (r[iT] || '').trim();
      if (!date || !title) return null;
      if (/^ja$/i.test((r[iE] || '').trim())) return null;
      const ab = iA >= 0 ? HD.isoDate((r[iA] || '').trim()) : '';
      if (ab && ab > iso) return null;
      const teaser = (r[iK] || '').trim();
      return {
        title, date, teaser, url: `${ROOT}pages/archiv.html?news=${encodeURIComponent(`${date}-${HD.slug(title)}`)}`,
        text: fold(`${title} ${teaser} ${(r[iC] || '')}`)
      };
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  }

  async function loadEvents() {
    const res = await fetch(`${ROOT}data/hochaemter.csv`);
    if (!res.ok) return [];
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return HD.rowsToRaw(HD.parseCSV(await res.text())).map(HD.normalize).filter((e) => e && e.date >= iso)
      .sort(HD.byDateTime).map((e) => ({
        title: `${e.type}${e.piece && e.piece !== e.type ? `: ${e.piece}` : ''}`, date: e.date, time: e.time,
        url: `${ROOT}pages/hochamt.html?id=${encodeURIComponent(e.id)}`, text: fold(`${e.type} ${e.piece} ${e.composer || ''} ${e.date}`)
      }));
  }

  const fmt = (iso) => { const d = HD.dateFromIso(iso); return `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const words = (q) => fold(q).split(/\s+/).filter(Boolean);
  const hit = (item, w) => w.every((x) => item.text.includes(x));
  const rank = (item, w) => w.reduce((n, x) => n + (fold(item.title).includes(x) ? 1 : 0), 0);

  function render() {
    const w = words(input.value);
    if (!w.length) {
      out.innerHTML = '<p class="suche-hint">Tippen Sie einen Begriff, etwa „Taufe“, „Mozart“ oder „Öffnungszeiten“. Taste „/“ öffnet die Suche überall.</p>';
      return;
    }
    const pages = (index || []).filter((x) => hit(x, w)).sort((a, b) => rank(b, w) - rank(a, w)).slice(0, 8);
    const nws = (news || []).filter((x) => hit(x, w)).slice(0, 6);
    const evs = (events || []).filter((x) => hit(x, w)).slice(0, 6);
    const sec = (h, items, meta) => (items.length
      ? `<section class="suche-sec"><h3>${HD.esc(h)}</h3><ul>${items.map((x) =>
        `<li><a href="${HD.esc(x.url)}"><span class="suche-t">${HD.esc(x.title)}</span>${meta(x) ? `<span class="suche-m">${HD.esc(meta(x))}</span>` : ''}</a></li>`).join('')}</ul></section>` : '');
    const html = sec('Seiten', pages, (x) => x.group) + sec('Kommende Hochämter und Konzerte', evs, (x) => `${fmt(x.date)}, ${x.time}`) + sec('Neuigkeiten', nws, (x) => fmt(x.date));
    out.innerHTML = html || `<p class="suche-hint">Nichts gefunden für „${HD.esc(input.value.trim())}“. Versuchen Sie ein anderes Wort oder schreiben Sie uns über die <a href="${ROOT}pages/kontakt.html">Kontaktseite</a>.</p>`;
  }

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'suche-dlg';
    dialog.setAttribute('aria-label', 'Suche');
    dialog.innerHTML = '<form method="dialog" class="suche-head" role="search">' +
      '<input type="search" class="suche-input" placeholder="Suchen: Taufe, Mozart, Öffnungszeiten …" aria-label="Suchbegriff" autocomplete="off" enterkeyhint="search"/>' +
      '<button type="button" class="suche-close" aria-label="Suche schließen"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button></form>' +
      '<div class="suche-out" aria-live="polite"></div>';
    document.body.append(dialog);
    input = dialog.querySelector('.suche-input');
    out = dialog.querySelector('.suche-out');
    dialog.querySelector('.suche-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
    dialog.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const first = out.querySelector('a');
      if (first) location.href = first.href;
    });
    input.addEventListener('input', render);
    dialog.addEventListener('close', () => document.documentElement.classList.remove('nd-lock'));
  }

  async function open() {
    if (!dialog) build();
    dialog.showModal();
    document.documentElement.classList.add('nd-lock');
    input.focus();
    render();
    if (index) return;
    out.innerHTML = '<p class="suche-hint">Wird geladen …</p>';
    try {
      await loadHD();
      index = pageIndex();
      [news, events] = await Promise.all([loadNews().catch(() => []), loadEvents().catch(() => [])]);
    } catch {
      index = pageIndex();
      news = [];
      events = [];
    }
    render();
  }

  window.AugSuche = { open };
})();
