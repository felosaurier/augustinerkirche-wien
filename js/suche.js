/* ============================================================
   Augustinerkirche Wien — suche.js
   Suche ueber die Website (Knopf mit der Lupe in der Titelzeile, oder die Taste "/"):
   - Seiten: alle Links der Menues plus ein paar feste Seiten mit Stichwoertern,
     Runden mit Titel und Kurztext aus data/runden.json (nicht der Text der Seiten)
   Reihenfolge der Treffer: Hochaemter, Neuigkeiten, Personen, Seiten, Predigten
   - Personen: data/personen.json (Patres, Leitung, Organisten …), data/pgr.json,
     data/pgr-aspersdorf.json, data/solisten.json
   - Predigten und Ansprachen: data/predigten/index.json und je Beitrag der Text (ohne Entwuerfe)
   - Neuigkeiten: data/news.csv (ohne Entwuerfe und noch nicht sichtbare)
   - Hochaemter und Konzerte: data/hochaemter.csv (kommende, auch nach Mitwirkenden)
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
  let index = null;     /* Seiten und Abschnitte */
  let people = null;
  let sermons = null;
  let news = null;
  let events = null;
  let seen = null;      /* Adresse -> Eintrag in index (Texte werden ergaenzt) */
  let loading = false;  /* Volltext wird noch geladen */

  const EXTRA = [
    ['Kontakt', 'pages/kontakt.html', 'telefon anrufen adresse anfahrt karte offnungszeiten pfarrkanzlei email mail'],
    ['Wochenkalender', 'pages/kalender.html#woche', 'termine woche messen gottesdienst heute'],
    ['Kalender (Monat)', 'pages/kalender.html', 'termine monat'],
    ['Archiv der Neuigkeiten', 'pages/archiv.html', 'meldungen berichte nachrichten'],
    ['Gottesdienste', 'pages/augustinerkirche.html#p-zeiten', 'messe heilige messe zeiten beichte liturgie'],
    ['Hochämter', 'pages/musik.html#p-hochaemter', 'sonntag 11 uhr konzert chor orchester messe'],
    ['Sakramente', 'pages/augustinerkirche.html#p-sakramente', 'taufe hochzeit trauung firmung erstkommunion'],
    /* Abschnitte, die nur in der Seitenleiste stehen (nicht im Menue) */
    ['Herzgruft', 'pages/augustinerkirche.html#p-herzgruft', 'loretokapelle habsburger herzen urnen'],
    ['Rundgang durch die Kirche', 'pages/augustinerkirche.html#p-rundgang', 'altare grabmal kunst'],
    ['Pfarrer', 'pages/augustinerkirche.html#p-pfarrer', 'pfarre'],
    ['Pfarrkanzlei', 'pages/augustinerkirche.html#p-kanzlei', 'kanzlei buero offnungszeiten anmeldung'],
    ['Pfarrgemeinderat', 'pages/augustinerkirche.html#p-pgr', 'pgr gremium'],
    ['Seelsorger', 'pages/augustinerkirche.html#p-seelsorger', 'priester patres seelsorge'],
    ['Solisten', 'pages/musik.html#p-solisten', 'sanger sopran alt tenor bass'],
    ['Orchester', 'pages/musik.html#p-orchester', 'musiker instrumente'],
    ['Kammerchor', 'pages/musik.html#p-kammerchor', 'chor singen'],
    ['Repertoire', 'pages/musik.html#p-repertoire', 'messen werke komponisten'],
    ['Orgeln', 'pages/musik.html#p-orgeln', 'rieger reil orgel'],
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

  const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /* Klartext aus den Dateien: ohne Formatierungszeichen */
  const plain = (s) => squash(HD.plainText(String(s || '')));
  /* Alle Texte eines Eintrags (auch verschachtelt), ohne Adressen von Bildern und Seiten */
  const strings = (v, skip = []) => (typeof v === 'string' ? (/^(assets|pages|data)\/|^https?:|^#/.test(v) ? [] : [plain(v)])
    : Array.isArray(v) ? v.flatMap((x) => strings(x, skip))
      : v && typeof v === 'object' ? Object.entries(v).filter(([k]) => !skip.includes(k)).flatMap(([, x]) => strings(x, skip)) : []);

  /* Eintrag anlegen oder (gleiche Adresse) um Text ergaenzen */
  function add(list, title, href, extra, group, body) {
    if (!title || !href) return;
    const abs = new URL(href, location.href).href;
    if (!abs.startsWith(ROOT)) return;
    const raw = squash(body);
    if (seen.has(abs)) {
      const it = seen.get(abs);
      it.text += ` ${fold(`${title} ${extra || ''} ${raw}`)}`;
      if (raw) it.raw = squash(`${it.raw} ${raw}`);
      return;
    }
    const item = { title: squash(title), url: abs, text: fold(`${title} ${extra || ''} ${group || ''} ${raw}`), raw, group: group || 'Seite' };
    seen.set(abs, item);
    list.push(item);
  }

  function pageIndex() {
    seen = new Map();
    const list = [];
    const add2 = (title, href, extra, group) => add(list, title, href, extra, group, '');
    for (const a of document.querySelectorAll('nav .mega a[href], .nav-center a[href]')) {
      const grp = a.closest('.mega-group');
      const label = grp && grp.querySelector('.mega-group-label');
      add2(a.textContent, a.getAttribute('href'), '', label ? label.textContent : 'Seite');
    }
    for (const [t, h, k] of EXTRA) add2(t, ROOT + h, k, 'Seite');
    return list;
  }

  /* Wo stehen die Personen-Gruppen aus data/personen.json? (Link und Seitenname) */
  const ANCHORS = new Map([
    ['mitbrueder', ['pages/augustiner.html#p-wien', 'Die Augustiner']],
    ['leitung', ['pages/musik.html#p-leitung', 'Kirchenmusik']],
    ['gastdirigenten', ['pages/musik.html#p-gastdirigenten', 'Kirchenmusik']],
    ['organisten', ['pages/musik.html#p-organisten', 'Kirchenmusik']],
    ['asp-leitung', ['pages/aspersdorf.html#p-leitung', 'Pfarre Aspersdorf']]
  ]);

  /* ---------- Runden, Personen, Predigten (Datendateien) ---------- */
  const json = (f) => HD.fetchJSON(`${ROOT}data/${f}`).catch(() => ({}));

  async function loadRunden(list) {
    const { runden } = await json('runden.json');
    for (const r of runden || []) {
      if (!r || !r.titel || r.sichtbar === false) continue;
      const href = r.seite ? ROOT + r.seite : `${ROOT}pages/runden/runde.html?id=${encodeURIComponent(r.id)}`;
      add(list, r.titel, href, r.kurztext || '', 'Runde', '');
    }
  }

  async function loadPeople() {
    const out = [];
    const person = (p, url, meta) => {
      if (!p || !p.name) return;
      const raw = strings(p, ['name', 'bild', 'bildtext', 'breite', 'hoehe', 'email', 'image', 'homepage', 'surname', 'deceased']).join(' ');
      out.push({ title: squash(p.name), url, group: meta, raw, text: fold(`${p.name} ${meta} ${raw}`) });
    };
    const [pers, pgr, asp, sol] = await Promise.all(['personen.json', 'pgr.json', 'pgr-aspersdorf.json', 'solisten.json'].map(json));
    for (const [g, xs] of Object.entries(pers || {})) {
      const [href, page] = ANCHORS.get(g) || ['pages/augustiner.html', ''];
      for (const p of Array.isArray(xs) ? xs : []) person(p, ROOT + href, [p.rolle, page].filter(Boolean).join(' · '));
    }
    for (const xs of [pgr.mitglieder, pgr.weitere]) {
      for (const p of xs || []) person(p, `${ROOT}pages/augustinerkirche.html#p-pgr`, ['Pfarrgemeinderat', p.rolle].filter(Boolean).join(' · '));
    }
    for (const [k, label] of [['mitglieder', 'Pfarrgemeinderat Aspersdorf'], ['vwr', 'Vermögensverwaltungsrat Aspersdorf']]) {
      for (const p of asp[k] || []) person(p, `${ROOT}pages/aspersdorf.html#p-leitung`, [label, p.rolle].filter(Boolean).join(' · '));
    }
    for (const p of Array.isArray(sol) ? sol : []) person(p, `${ROOT}pages/musik.html#p-solisten`, ['Solist', p.voice].filter(Boolean).join(' · '));
    return out;
  }

  /* Predigten: Uebersicht data/predigten/index.json, die Texte je Beitrag (alle parallel, nur hier
     in der Suche); fehlt die Uebersicht noch, die alte Sammeldatei */
  async function loadSermons() {
    let predigten;
    try {
      predigten = (await HD.fetchJSON(`${ROOT}data/predigten/index.json`)).predigten || [];
      await Promise.all(predigten.filter((p) => p && p.titel && !p.entwurf && /^[a-z0-9-]+$/.test(String(p.id || ''))).map(async (p) => {
        try { p.text = (await json(`predigten/${p.id}.json`)).text || ''; } catch { p.text = p.auszug || ''; }
      }));
    } catch {
      predigten = (await json('predigten.json')).predigten;
    }
    return (predigten || []).filter((p) => p && p.titel && !p.entwurf).map((p) => {
      const raw = plain(p.text);
      return { title: squash(p.titel), url: `${ROOT}pages/augustinerkirche.html#p-predigten`, date: p.datum || '', raw, text: fold(`${p.titel} ${raw}`) };
    });
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
        title, date, teaser, cat: iC >= 0 ? (r[iC] || '').trim() : '', url: `${ROOT}pages/archiv.html?news=${encodeURIComponent(`${date}-${HD.slug(title)}`)}`,
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
        url: `${ROOT}pages/hochamt.html?id=${encodeURIComponent(e.id)}`,
        /* auch nach Mitwirkenden: Zelebrant, Dirigent, Solisten, Orgel, Chor, Orchester */
        text: fold([e.type, e.piece, e.composer, e.date, e.celebrant, e.conductor, e.choir, e.orchestra,
          ...(e.soloists || []), ...(e.organist || [])].filter(Boolean).map((s) => HD.plainText(String(s))).join(' '))
      }));
  }

  /* Ausschnitt rund um das erste gefundene Wort im Text (wenn es nicht schon im Titel steht) */
  function excerpt(item, w) {
    if (!item.raw) return '';
    const t = fold(item.title);
    const key = w.find((x) => !t.includes(x));
    if (!key) return '';
    const at = fold(item.raw).indexOf(key);
    if (at < 0) return '';
    let a = Math.max(0, at - 50);
    let b = Math.min(item.raw.length, at + key.length + 90);
    if (a > 0) a = item.raw.indexOf(' ', a) + 1 || a;
    if (b < item.raw.length) b = item.raw.lastIndexOf(' ', b) > at ? item.raw.lastIndexOf(' ', b) : b;
    return `${a > 0 ? '… ' : ''}${item.raw.slice(a, b).trim()}${b < item.raw.length ? ' …' : ''}`;
  }

  const fmt = (iso) => { const d = HD.dateFromIso(iso); return `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const words = (q) => fold(q).split(/\s+/).filter(Boolean);
  const hit = (item, w) => w.every((x) => item.text.includes(x));
  const rank = (item, w) => w.reduce((n, x) => n + (fold(item.title).includes(x) ? 1 : 0), 0);

  function render() {
    const w = words(input.value);
    if (!w.length) {
      out.innerHTML = '<p class="suche-hint">Tippen Sie einen Begriff, etwa „Taufe“, „Mozart“ oder „Öffnungszeiten“.<span class="suche-taste"> Taste „/“ öffnet die Suche überall.</span></p>';
      return;
    }
    const find = (list, n) => (list || []).filter((x) => hit(x, w)).sort((a, b) => rank(b, w) - rank(a, w)).slice(0, n);
    const pages = find(index, 8);
    const pers = find(people, 6);
    const prd = find(sermons, 5);
    const nws = (news || []).filter((x) => hit(x, w)).slice(0, 6);
    const evs = (events || []).filter((x) => hit(x, w)).slice(0, 6);
    const sec = (h, items, meta) => (items.length
      ? `<section class="suche-sec"><h3>${HD.esc(h)}</h3><ul>${items.map((x) => {
        const m = meta(x);
        const ex = excerpt(x, w);
        return `<li><a href="${HD.esc(x.url)}"><span class="suche-t">${HD.esc(x.title)}</span>` +
          (m ? `<span class="suche-m">${HD.esc(m)}</span>` : '') +
          (ex ? `<span class="suche-x">${HD.esc(ex)}</span>` : '') + '</a></li>';
      }).join('')}</ul></section>` : '');
    const html = sec('Kommende Hochämter und Konzerte', evs, (x) => `${fmt(x.date)}, ${x.time}`) +
      sec('Neuigkeiten', nws, (x) => x.cat) +
      sec('Personen', pers, (x) => x.group) +
      sec('Seiten', pages, (x) => x.group) +
      sec('Predigten & Ansprachen', prd, (x) => (HD.isoDate(x.date) ? fmt(x.date) : ''));
    out.innerHTML = (html || `<p class="suche-hint">Nichts gefunden für „${HD.esc(input.value.trim())}“. Versuchen Sie ein anderes Wort oder schreiben Sie uns über die <a href="${ROOT}pages/kontakt.html">Kontaktseite</a>.</p>`) +
      (loading ? '<p class="suche-hint suche-more">Wird noch geladen …</p>' : '');
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
    } catch {
      out.innerHTML = '<p class="suche-hint">Die Suche konnte nicht geladen werden.</p>';
      return;
    }
    /* Zuerst Menue, Meldungen und Termine (schnell), dann der ganze Text der Seiten */
    const list = pageIndex();
    index = list;
    loading = true;
    [news, events] = await Promise.all([loadNews().catch(() => []), loadEvents().catch(() => [])]);
    render();
    [people, sermons] = await Promise.all([loadPeople().catch(() => []), loadSermons().catch(() => []), loadRunden(list).catch(() => {})]);
    loading = false;
    render();
  }

  window.AugSuche = { open };
})();
