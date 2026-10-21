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
   - data/wochenkalender.json: der gedruckte Wochenkalender, Tag für Tag (Tagesbezeichnung,
     Heilige und Gedenktage, Termine mit Zelebrant, Musik und Ort). Für die Tage, die dort
     stehen, gilt er statt des allgemeinen Wochenplans
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
    ['tagzeit', 'Tagzeitenliturgie'],
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
        href: `${base}pages/hochamt.html?id=${encodeURIComponent(e.id)}`, src: 'hochamt',
        d: { name: e.type, zelebrant: e.celebrant || '', musik: e.piece || '', ort: e.location || '', hinweis: '', art: konzert ? 'veranstaltung' : HOCHAMT.test(e.type) ? 'hochamt' : 'gottesdienst' }
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
            href: HD.safeUrl(r.seite, base), src: 'runde',
            d: { name: title, ort: b.ort || '', art: 'runde' }
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
        text: t.text || '', link: HD.safeUrl(t.link || '', base), bis, src: 'termin',
        d: { name: t.titel, ort: t.ort || '', art: ART_GROUP[String(t.art || '').trim().toLowerCase()] || 'veranstaltung' }
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
  /* Plan-Einträge: art "" = Gottesdienst, "veranstaltung" oder "ohne" (keine Kategorie, z. B. Kanzleistunden);
     "anschliessend" + "nach" = ohne Uhrzeit, im Anschluss an den Termin um "nach" (z. B. die Führung nach dem Hochamt) */
  const PLACE = /^(Augustinerkirche|Loretokapelle|Pfarrsaal|Augustinussaal|Augustiner-Stüberl|Klosterkapelle)\b/i;
  function planDetail(t) {
    const h = String(t.hinweis || '').replace(/,?\s*September bis Juni(, nicht in den Ferien)?/i, '').replace(/^[,\s]+|[,\s]+$/g, '');
    return PLACE.test(h) ? { ort: h, hinweis: '' } : { ort: '', hinweis: h };
  }
  function fromWochenplan(data, existing) {
    const out = [];
    const plan = ((data && data.termine) || []).filter((t) => (t.liturgie || t.art) && t.name && t.tag in DAY_IDX && (HD.isoTime(t.zeit) || (t.anschliessend && HD.isoTime(t.nach))));
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
        if (time && !t.art && taken.has(`${date} ${time}`)) continue;
        const note = /Augustinerkirche|^September bis Juni/i.test(t.hinweis || '') ? '' : t.hinweis || '';
        const group = t.art === 'ohne' ? 'ohne' : t.art === 'veranstaltung' ? 'veranstaltung' : t.art === 'tagzeit' || /^tagzeitenliturgie/i.test(t.name) ? 'tagzeit' : /hochamt/i.test(t.name) ? 'hochamt' : 'gottesdienst';
        out.push({
          date, time, group, title: t.name, sub: note, weekly: true, src: 'plan',
          d: { name: t.name, art: group === 'ohne' ? 'veranstaltung' : group, ...planDetail(t) },
          ...(!time ? { label: 'anschl.', sort: `${HD.isoTime(t.nach)}~` } : {})
        });
      }
    }
    return out;
  }
  /* Wochenkalender (data/wochenkalender.json): je Tag Tagesbezeichnung, Heilige und die Angaben zu den Terminen
     der Woche (Zelebrant, Musik, Ort). Ein Eintrag ersetzt den Termin des Kalenders um dieselbe Uhrzeit
     (bzw. "anschliessend" an dieselbe Uhrzeit), behält dessen Link, und gibt es dort keinen, kommt er neu dazu.
     "entfaellt": steht nicht im Wochenkalender (in der Verwaltung durchgestrichen). */
  const ART_GROUP_WK = { hochamt: 'hochamt', gottesdienst: 'gottesdienst', tagzeit: 'tagzeit', runde: 'runde', veranstaltung: 'veranstaltung' };
  const slotOf = (it) => `${it.date} ${it.time || it.sort || ''}`;
  function fromWochenkalender(data) {
    const items = [];
    const info = new Map();
    for (const day of (data && data.tage) || []) {
      const date = HD.isoDate(day.datum);
      if (!date) continue;
      const heilige = (day.heilige || []).map((h) => String(h).trim()).filter(Boolean);
      const tag = String(day.tag || '').trim();
      if (tag || heilige.length) info.set(date, { tag, heilige });
      for (const t of day.termine || []) {
        if (!t || !t.name) continue;
        const time = HD.isoTime(t.zeit);
        const group = ART_GROUP_WK[t.art] || (/hochamt/i.test(t.name) ? 'hochamt' : 'veranstaltung');
        const sub = [t.zelebrant ? `Z: ${t.zelebrant}` : '', t.musik ? `♫ ${t.musik}` : '', t.ort, t.hinweis]
          .map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
        items.push({
          date, time, group, title: t.zusatz ? `${t.name} (${t.zusatz})` : t.name, sub, src: 'wk', hidden: !!t.entfaellt,
          d: { name: t.name, zusatz: t.zusatz || '', zelebrant: t.zelebrant || '', musik: t.musik || '', ort: t.ort || '', hinweis: t.hinweis || '', art: group },
          ...(!time && t.anschliessend && HD.isoTime(t.nach) ? { label: 'anschl.', sort: `${HD.isoTime(t.nach)}~` } : {})
        });
      }
    }
    return { items, info };
  }
  /* Ausfälle: ohne Uhrzeit entfallen alle Gottesdienste des Tages */
  function applyAusfaelle(items, data) {
    for (const a of (data && data.entfaellt) || []) {
      const date = HD.isoDate(a.datum);
      if (!date) continue;
      const time = HD.isoTime(a.zeit);
      for (const it of items) {
        /* ohne Uhrzeit entfallen die Gottesdienste des Tages; Termine aus dem Wochenplan nur mit Uhrzeit */
        if (it.date === date && ((isMass(it.group) && (!time || it.time === time)) || (it.weekly && time && it.time === time))) {
          it.cancelled = true;
          it.why = String(a.grund || '');
        }
      }
    }
  }

  async function getJSON(url) {
    try {
      return await HD.fetchJSON(url);
    } catch {
      return null;
    }
  }

  /* Alle Termine, sortiert nach Tag und Uhrzeit (ohne Uhrzeit zuletzt); Monat und Woche
     auf derselben Seite laden nur einmal */
  const loaded = new Map();
  /* opts.all: auch die Termine, die im Wochenkalender entfallen (für die Verwaltung); sonst fehlen sie */
  function load(base = '', opts = {}) {
    if (!loaded.has(base)) loaded.set(base, collect(base));
    return loaded.get(base).then((all) => {
      dayInfo = all.info;
      return all.items.filter((it) => opts.all || !it.hidden).map((it) => ({ ...it }));
    });
  }
  /* nach einer Änderung in der Verwaltung neu einlesen */
  const refresh = (base = '') => { loaded.delete(base); };
  /* Tagesbezeichnung und Heilige des Wochenkalenders (nach load) */
  let dayInfo = new Map();
  async function collect(base) {
    const [ha, rd, tm, gd, wk] = await Promise.all([
      HD.load(`${base}data/hochaemter.csv`).catch(() => []),
      getJSON(`${base}data/runden.json`),
      getJSON(`${base}data/termine.json`),
      getJSON(`${base}data/gottesdienste.json`),
      getJSON(`${base}data/wochenkalender.json`)
    ]);
    const items = [...fromHochaemter(ha, base), ...fromRunden(rd, base), ...fromTermine(tm, base)];
    items.push(...fromWochenplan(gd, items));
    applyAusfaelle(items, gd);
    /* Wochenkalender: ersetzt den Termin des Kalenders am gleichen Platz und behält dessen Link */
    const wochen = fromWochenkalender(wk);
    for (const w of wochen.items) {
      const i = items.findIndex((it) => slotOf(it) === slotOf(w));
      if (i >= 0) {
        w.href = items[i].href || '';
        w.from = items[i].src;
        w.cancelled = items[i].cancelled;
        w.why = items[i].why;
        items.splice(i, 1);
      }
    }
    items.push(...wochen.items);
    items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return { items, info: wochen.info };
  }
  const sortKey = (it) => it.date + (it.sort || it.time || '99');

  /* ---------- Darstellung ---------- */
  /* Ab wann ein Termin des Tages als vorbei gilt (HH:MM, '' = erst mit dem Tag): mit Ende ab dem Ende,
     sonst ab dem Beginn; "anschl." erst, wenn der nächste Termin mit Uhrzeit danach begonnen hat */
  function endsAt(it, its) {
    if (it.time) return it.ende || it.time;
    if (!it.sort) return '';
    const after = it.sort.slice(0, 5);
    const next = its.find((x) => x.time && x.time > after);
    return next ? next.time : '';
  }
  const nowHM = (dt) => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const isPast = (iso, ends, today, now) => iso < today || (iso === today && !!ends && ends <= now);

  function itemHTML(it, past, base = '', ends = '') {
    const time = it.label || (it.time ? `${it.time}${it.ende ? `–${it.ende}` : ''}` : '');
    const head = `<span class="cal-time${time ? '' : ' empty'}">${esc(time) || '&nbsp;'}</span>` +
      '<span class="cal-main">' +
        `<span class="cal-title">${esc(it.title)}</span>` +
        (it.cancelled ? `<span class="cal-flag">Entfällt${it.why ? `: ${esc(it.why)}` : ''}</span>` : '') +
        (it.sub ? `<span class="cal-sub">${esc(it.sub)}</span>` : '') +
      '</span>' +
      (it.group === 'ohne' ? '' : `<span class="cal-cat"><i class="cal-dot g-${it.group}"></i>${esc(it.art || groupName.get(it.group))}</span>`);
    /* data-ends: damit watchPast den Termin verblassen lässt, solange die Seite offen ist */
    const li = `<li class="cal-item g-${it.group}${past ? ' past' : ''}${it.cancelled ? ' cancelled' : ''}"${ends ? ` data-ends="${ends}"` : ''}>`;
    if (it.href) return `${li}<a class="cal-row" href="${esc(it.href)}">${head}</a></li>`;
    if (it.text) {
      return `${li}<details class="cal-more"><summary class="cal-row">${head}</summary>` +
        `<div class="cal-text"><p>${HD.richText(it.text, base)}</p>` +
        (it.link ? `<p><a class="link-arr" href="${esc(it.link)}"${/^https?:/i.test(it.link) ? ' target="_blank" rel="noopener"' : ''}>Mehr erfahren</a></p>` : '') +
        '</div></details></li>';
    }
    if (it.link) {
      return `${li}<a class="cal-row" href="${esc(it.link)}"${/^https?:/i.test(it.link) ? ' target="_blank" rel="noopener"' : ''}>${head}</a></li>`;
    }
    return `${li}<div class="cal-row">${head}</div></li>`;
  }
  /* Ein Tag mit seinen Terminen; empty: Text, wenn es keine gibt (Wochenueberblick).
     Heute sind die Termine, deren Zeit vorbei ist, schon verblasst wie vergangene Tage */
  function dayHTML(iso, its, today, { base = '', empty = '', extraClass = '', id = `tag-${iso}` } = {}) {
    const dt = HD.dateFromIso(iso);
    const past = iso < today;
    const now = nowHM(new Date());
    const inf = dayInfo.get(iso);
    const infoHTML = inf ? `<p class="cal-liturgy">${[inf.tag, ...inf.heilige].filter(Boolean).map(HD.formatText).join(' · ')}</p>` : '';
    return `<section class="cal-day${past ? ' past' : ''}${iso === today ? ' today' : ''}${extraClass ? ` ${extraClass}` : ''}" id="${id}" data-date="${iso}" aria-labelledby="h-${id}">` +
      `<h3 class="cal-date" id="h-${id}"><span class="cal-d">${dt.getDate()}</span>` +
      `<span class="cal-wd">${WEEKDAYS[dt.getDay()]}${iso === today ? '<span class="cal-heute"><span class="visually-hidden">, </span>heute</span>' : ''}<span class="cal-mo">${MONTHS[dt.getMonth()]}</span></span></h3>` +
      '<div class="cal-body">' + infoHTML +
      (its.length ? `<ul class="cal-items">${its.map((it) => {
        const ends = endsAt(it, its);
        return itemHTML(it, isPast(iso, ends, today, now), base, ends);
      }).join('')}</ul>` : `<p class="cal-none">${esc(empty)}</p>`) +
      '</div></section>';
  }
  /* Solange die Seite offen ist: jede Minute (und beim Zurückkehren in den Tab) die Termine von heute
     verblassen lassen, deren Zeit vorbei ist; an einem neuen Tag zeichnet newDay die Liste neu */
  function watchPast(container, newDay) {
    let day = isoOf(new Date());
    const check = () => {
      const dt = new Date();
      const today = isoOf(dt);
      if (today !== day) {
        day = today;
        newDay();
        return;
      }
      const now = nowHM(dt);
      for (const li of container.querySelectorAll('.cal-day.today .cal-item[data-ends]')) {
        li.classList.toggle('past', isPast(today, li.dataset.ends, today, now));
      }
    };
    setInterval(check, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  w.KalenderDaten = { GROUPS, groupName, isMass, isoOf, shortDate, load, refresh, slotOf, itemHTML, dayHTML, watchPast };
})(window);
