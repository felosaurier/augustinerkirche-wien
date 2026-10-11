/* ============================================================
   Augustinerkirche Wien — kalender-daten.js
   Gemeinsame Termine fuer den Kalender (js/kalender.js) und den
   Wochenueberblick (js/woche.js). Sammelt alle Termine aus vier Quellen:
   - data/hochaemter.csv: Hochämter, Gottesdienste und Konzerte
   - data/runden.json:    Terminreihen der Runden (mit Uhrzeit und Ort)
   - data/termine.json:   eigene Termine wie Ausflüge, Feste, Vorträge
   - data/gottesdienste.json: der Wochenplan der regelmäßigen Messen (ab dem
     laufenden Monat bzw. der laufenden Woche ein Jahr voraus, ohne die, die es
     schon als Hochamt gibt; je Messe nur in den Monaten von/bis und nicht in den
     "ferien": [{name, von, bis, tage: ["di", "do", …]}], die Pause gilt nur an
     diesen Wochentagen) und "entfaellt": Tage, an denen ein Gottesdienst ausfällt
     (bleibt stehen, durchgestrichen und mit dem Hinweis "Entfällt")
   Dazu die Darstellung eines Termins und eines Tages (gleich in Kalender und Woche).
   Benötigt js/hochaemter-data.js.
   ============================================================ */
(function (w) {
  'use strict';

  const HD = w.HochamtData;
  if (!HD) return;
  const { esc, pad, MONTHS, WEEKDAYS } = HD;

  /* Gruppen in der Reihenfolge der Filter: Hochämter (mit Chor und Orchester) und
     die übrigen Gottesdienste (Heilige Messen u. a.) sind getrennt */
  const GROUPS = [
    ['hochamt', 'Hochämter'],
    ['gottesdienst', 'Gottesdienste'],
    ['konzert', 'Konzerte'],
    ['runde', 'Runden'],
    ['veranstaltung', 'Veranstaltungen']
  ];
  const groupName = new Map(GROUPS);
  /* Eigene Termine: Art -> Gruppe (alles andere ist eine Veranstaltung) */
  const ART_GROUP = { hochamt: 'hochamt', gottesdienst: 'gottesdienst', konzert: 'konzert' };
  /* Welche Anlässe der Hochamt-Liste ein Hochamt im engeren Sinn sind; alles andere
     (Begräbnis, Trauung, Karfreitagsliturgie, Messe vom Abendmahl …) zählt als Gottesdienst */
  const HOCHAMT = /hochamt|pontifikal|requiem|festmesse|christmette|osternacht/i;
  const isMass = (g) => g === 'hochamt' || g === 'gottesdienst';

  const isoOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  function shortDate(iso) {
    const dt = HD.dateFromIso(iso);
    return `${dt.getDate()}. ${MONTHS[dt.getMonth()]}`;
  }

  /* ---------- Daten zusammenführen ---------- */
  function fromHochaemter(list, base) {
    return list.map((e) => {
      const konzert = /konzert|adventlicht/i.test(e.type);
      return {
        date: e.date, time: e.time, group: konzert ? 'konzert' : HOCHAMT.test(e.type) ? 'hochamt' : 'gottesdienst',
        title: e.type, sub: [e.piece, e.location !== 'Augustinerkirche' ? e.location : ''].filter(Boolean).join(', '),
        href: `${base}pages/hochamt.html?id=${encodeURIComponent(e.id)}`
      };
    });
  }

  function fromRunden(data, base) {
    const out = [];
    for (const r of (data && data.runden) || []) {
      if (r.sichtbar === false) continue;
      for (const b of r.termine || []) {
        /* Bezeichnung im Kalender, sonst die Überschrift der Reihe ohne Saison */
        const title = b.name || String(b.label || r.titel).split(/\s+\d{4}|\s+·/)[0] || r.titel;
        for (const d of b.daten || []) {
          const date = HD.isoDate(d);
          if (!date) continue;
          out.push({
            date, time: HD.isoTime(b.zeit), group: 'runde', title,
            sub: [title.toLowerCase() !== r.titel.toLowerCase() ? r.titel : '', b.ort].filter(Boolean).join(', '),
            href: r.seite ? base + r.seite : ''
          });
        }
      }
    }
    return out;
  }

  function fromTermine(data, base) {
    return ((data && data.termine) || []).map((t) => {
      const date = HD.isoDate(t.datum);
      if (!date || !t.titel) return null;
      const bis = HD.isoDate(t.bis);
      const time = HD.isoTime(t.zeit);
      const ende = HD.isoTime(t.ende);
      return {
        date, time, ende, group: ART_GROUP[String(t.art || '').trim().toLowerCase()] || 'veranstaltung',
        art: t.art || '', title: t.titel,
        sub: [bis && bis > date ? `bis ${shortDate(bis)}` : '', t.ort].filter(Boolean).join(', '),
        text: t.text || '', link: HD.safeUrl(t.link || '', base), bis
      };
    }).filter(Boolean);
  }

  /* Regelmäßige Messen aus dem Wochenplan; nur echte Gottesdienste (liturgie), keine Proben.
     von/bis: Monate 1..12, auch über den Jahreswechsel (9 bis 6 = September bis Juni) */
  const DAY_IDX = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  const inSeason = (t, m) => {
    const von = Number(t.von);
    const bis = Number(t.bis);
    if (!von || !bis) return true;
    return von <= bis ? m >= von && m <= bis : m >= von || m <= bis;
  };
  function fromWochenplan(data, existing) {
    const out = [];
    const plan = ((data && data.termine) || []).filter((t) => t.liturgie && t.name && t.tag in DAY_IDX && HD.isoTime(t.zeit));
    if (!plan.length) return out;
    /* Was es schon gibt (z. B. das Hochamt am Sonntag), wird nicht doppelt gezeigt */
    const taken = new Set(existing.filter((it) => isMass(it.group)).map((it) => `${it.date} ${it.time}`));
    const ferien = ((data && data.ferien) || [])
      .map((f) => ({ von: HD.isoDate(f.von), bis: HD.isoDate(f.bis), tage: Array.isArray(f.tage) ? f.tage : Object.keys(DAY_IDX) }))
      .filter((f) => f.von && f.bis);
    /* Pause an diesem Tag? Sie gilt nur für die Wochentage, die bei ihr stehen */
    const inFerien = (iso, tag) => ferien.some((f) => iso >= f.von && iso <= f.bis && f.tage.includes(tag));
    const now = new Date();
    /* ab dem Monatsersten, mindestens aber ab dem Montag dieser Woche (Wochenueberblick) */
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    if (monday < start) start.setTime(monday.getTime());
    const end = new Date(now.getFullYear(), now.getMonth() + 13, 0);
    for (const d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const date = isoOf(d);
      for (const t of plan) {
        if (DAY_IDX[t.tag] !== d.getDay() || !inSeason(t, d.getMonth() + 1)) continue;
        if (inFerien(date, t.tag)) continue;
        const time = HD.isoTime(t.zeit);
        if (taken.has(`${date} ${time}`)) continue;
        const note = /Augustinerkirche|^September bis Juni/i.test(t.hinweis || '') ? '' : t.hinweis || '';
        out.push({ date, time, group: /hochamt/i.test(t.name) ? 'hochamt' : 'gottesdienst', title: t.name, sub: note });
      }
    }
    return out;
  }
  /* Ausfälle: ohne Uhrzeit entfallen alle Gottesdienste des Tages */
  function applyAusfaelle(items, data) {
    for (const a of (data && data.entfaellt) || []) {
      const date = HD.isoDate(a.datum);
      if (!date) continue;
      const time = HD.isoTime(a.zeit);
      for (const it of items) {
        if (isMass(it.group) && it.date === date && (!time || it.time === time)) {
          it.cancelled = true;
          it.why = String(a.grund || '');
        }
      }
    }
  }

  async function getJSON(url) {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /* Alle Termine, sortiert nach Tag und Uhrzeit (ohne Uhrzeit zuletzt); Monat und Woche
     auf derselben Seite laden nur einmal */
  const loaded = new Map();
  function load(base = '') {
    if (!loaded.has(base)) loaded.set(base, collect(base));
    return loaded.get(base).then((list) => list.map((it) => ({ ...it })));
  }
  async function collect(base) {
    const [ha, rd, tm, gd] = await Promise.all([
      HD.load(`${base}data/hochaemter.csv`).catch(() => []),
      getJSON(`${base}data/runden.json`),
      getJSON(`${base}data/termine.json`),
      getJSON(`${base}data/gottesdienste.json`)
    ]);
    const items = [...fromHochaemter(ha, base), ...fromRunden(rd, base), ...fromTermine(tm, base)];
    items.push(...fromWochenplan(gd, items));
    applyAusfaelle(items, gd);
    return items.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  }

  /* ---------- Darstellung ---------- */
  function itemHTML(it, past, base = '') {
    const time = it.time ? `${it.time}${it.ende ? `–${it.ende}` : ''}` : '';
    const head = `<span class="cal-time${time ? '' : ' empty'}">${esc(time) || '&nbsp;'}</span>` +
      '<span class="cal-main">' +
        `<span class="cal-title">${esc(it.title)}</span>` +
        (it.cancelled ? `<span class="cal-flag">Entfällt${it.why ? `: ${esc(it.why)}` : ''}</span>` : '') +
        (it.sub ? `<span class="cal-sub">${esc(it.sub)}</span>` : '') +
      '</span>' +
      `<span class="cal-cat"><i class="cal-dot g-${it.group}"></i>${esc(it.art || groupName.get(it.group))}</span>`;
    const cls = `cal-item g-${it.group}${past ? ' past' : ''}${it.cancelled ? ' cancelled' : ''}`;
    if (it.href) return `<li class="${cls}"><a class="cal-row" href="${esc(it.href)}">${head}</a></li>`;
    if (it.text) {
      return `<li class="${cls}"><details class="cal-more"><summary class="cal-row">${head}</summary>` +
        `<div class="cal-text"><p>${HD.richText(it.text, base)}</p>` +
        (it.link ? `<p><a class="link-arr" href="${esc(it.link)}"${/^https?:/i.test(it.link) ? ' target="_blank" rel="noopener"' : ''}>Mehr erfahren</a></p>` : '') +
        '</div></details></li>';
    }
    if (it.link) {
      return `<li class="${cls}"><a class="cal-row" href="${esc(it.link)}"${/^https?:/i.test(it.link) ? ' target="_blank" rel="noopener"' : ''}>${head}</a></li>`;
    }
    return `<li class="${cls}"><div class="cal-row">${head}</div></li>`;
  }
  /* Ein Tag mit seinen Terminen; empty: Text, wenn es keine gibt (Wochenueberblick) */
  function dayHTML(iso, its, today, { base = '', empty = '', extraClass = '', id = `tag-${iso}` } = {}) {
    const dt = HD.dateFromIso(iso);
    const past = iso < today;
    return `<section class="cal-day${past ? ' past' : ''}${iso === today ? ' today' : ''}${extraClass ? ` ${extraClass}` : ''}" id="${id}" aria-labelledby="h-${id}">` +
      `<h3 class="cal-date" id="h-${id}"><span class="cal-d">${dt.getDate()}</span>` +
      `<span class="cal-wd">${WEEKDAYS[dt.getDay()]}${iso === today ? ', heute' : ''}<span class="cal-mo">${MONTHS[dt.getMonth()]}</span></span></h3>` +
      (its.length ? `<ul class="cal-items">${its.map((it) => itemHTML(it, past, base)).join('')}</ul>` : `<p class="cal-none">${esc(empty)}</p>`) +
      '</section>';
  }

  w.KalenderDaten = { GROUPS, groupName, isMass, isoOf, shortDate, load, itemHTML, dayHTML };
})(window);
