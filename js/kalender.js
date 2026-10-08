/* ============================================================
   Augustinerkirche Wien — kalender.js
   Kalender der Pfarre St. Augustin (pages/kalender.html).
   Sammelt alle Termine aus drei Quellen:
   - data/hochaemter.csv: Hochämter, Gottesdienste und Konzerte
   - data/runden.json:    Terminreihen der Runden (mit Uhrzeit und Ort)
   - data/termine.json:   eigene Termine wie Ausflüge, Feste, Vorträge
   Links ein Monatsblatt (Tage mit Terminen haben Punkte in der Farbe
   der Gruppe), rechts bzw. darunter die Termine des Monats nach Tagen.
   Aufruf mit ?monat=JJJJ-MM öffnet einen Monat direkt.
   Benötigt js/hochaemter-data.js.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const root = document.getElementById('cal');
  if (!HD || !root) return;

  const { esc, pad, MONTHS, WEEKDAYS } = HD;
  const base = root.dataset.base || '';

  /* Gruppen in der Reihenfolge der Filter */
  const GROUPS = [
    ['gottesdienst', 'Gottesdienste'],
    ['konzert', 'Konzerte'],
    ['runde', 'Runden'],
    ['veranstaltung', 'Veranstaltungen']
  ];
  const groupName = new Map(GROUPS);
  /* Eigene Termine: Art -> Gruppe (alles andere ist eine Veranstaltung) */
  const ART_GROUP = { Gottesdienst: 'gottesdienst', Konzert: 'konzert' };

  let items = [];
  let month = null;             /* {y, m} mit m = 0..11 */
  let filter = '';              /* '' = alle Gruppen */
  let showPast = false;         /* laufender Monat: vergangene Tage aufgeklappt? */

  const isoOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const todayIso = () => isoOf(new Date());
  const monthKey = ({ y, m }) => `${y}-${pad(m + 1)}`;

  /* ---------- Daten zusammenführen ---------- */
  function fromHochaemter(list) {
    return list.map((e) => {
      const konzert = /konzert|adventlicht/i.test(e.type);
      return {
        date: e.date, time: e.time, group: konzert ? 'konzert' : 'gottesdienst',
        title: e.type, sub: [e.piece, e.location !== 'Augustinerkirche' ? e.location : ''].filter(Boolean).join(', '),
        href: `${base}pages/hochamt.html?id=${encodeURIComponent(e.id)}`
      };
    });
  }

  function fromRunden(data) {
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

  function fromTermine(data) {
    return ((data && data.termine) || []).map((t) => {
      const date = HD.isoDate(t.datum);
      if (!date || !t.titel) return null;
      const bis = HD.isoDate(t.bis);
      const time = HD.isoTime(t.zeit);
      const ende = HD.isoTime(t.ende);
      return {
        date, time, ende, group: ART_GROUP[t.art] || 'veranstaltung',
        art: t.art || '', title: t.titel,
        sub: [bis && bis > date ? `bis ${shortDate(bis)}` : '', t.ort].filter(Boolean).join(', '),
        text: t.text || '', link: HD.safeUrl(t.link || '', base), bis
      };
    }).filter(Boolean);
  }

  async function getJSON(url) {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /* ---------- Darstellung ---------- */
  function shortDate(iso) {
    const dt = HD.dateFromIso(iso);
    return `${dt.getDate()}. ${MONTHS[dt.getMonth()]}`;
  }
  const inMonth = (it) => it.date.slice(0, 7) === monthKey(month);
  const visible = () => items.filter((it) => !filter || it.group === filter);

  function monthGrid() {
    const first = new Date(month.y, month.m, 1);
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;         /* Montag zuerst */
    const today = todayIso();
    const byDay = new Map();
    for (const it of visible().filter(inMonth)) {
      if (!byDay.has(it.date)) byDay.set(it.date, new Set());
      byDay.get(it.date).add(it.group);
    }
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-cell empty" aria-hidden="true"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${monthKey(month)}-${pad(d)}`;
      const groups = byDay.get(iso);
      const cls = `cal-cell${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}`;
      if (!groups) {
        cells += `<span class="${cls}"><span class="cal-num">${d}</span></span>`;
        continue;
      }
      const dots = GROUPS.filter(([g]) => groups.has(g)).map(([g]) => `<i class="cal-dot g-${g}"></i>`).join('');
      const wd = WEEKDAYS[new Date(month.y, month.m, d).getDay()];
      cells += `<button type="button" class="${cls} has" data-day="${iso}" aria-label="${wd}, ${d}. ${MONTHS[month.m]}: ${[...groups].map((g) => groupName.get(g)).join(', ')}">` +
        `<span class="cal-num">${d}</span><span class="cal-dots" aria-hidden="true">${dots}</span></button>`;
    }
    return '<div class="cal-week" aria-hidden="true"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>' +
      `<div class="cal-grid">${cells}</div>`;
  }

  function itemHTML(it, past) {
    const time = it.time ? `${it.time}${it.ende ? `–${it.ende}` : ''}` : '';
    const head = `<span class="cal-time${time ? '' : ' empty'}">${esc(time) || '&nbsp;'}</span>` +
      '<span class="cal-main">' +
        `<span class="cal-title">${esc(it.title)}</span>` +
        (it.sub ? `<span class="cal-sub">${esc(it.sub)}</span>` : '') +
      '</span>' +
      `<span class="cal-cat"><i class="cal-dot g-${it.group}"></i>${esc(it.art || groupName.get(it.group))}</span>`;
    const cls = `cal-item g-${it.group}${past ? ' past' : ''}`;
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

  function daysHTML(list, today) {
    const days = new Map();
    for (const it of list) {
      if (!days.has(it.date)) days.set(it.date, []);
      days.get(it.date).push(it);
    }
    return [...days].map(([iso, its]) => {
      const dt = HD.dateFromIso(iso);
      const past = iso < today;
      return `<section class="cal-day${past ? ' past' : ''}${iso === today ? ' today' : ''}" id="tag-${iso}" aria-labelledby="h-${iso}">` +
        `<h3 class="cal-date" id="h-${iso}"><span class="cal-d">${dt.getDate()}</span>` +
        `<span class="cal-wd">${WEEKDAYS[dt.getDay()]}${iso === today ? ', heute' : ''}<span class="cal-mo">${MONTHS[dt.getMonth()]}</span></span></h3>` +
        `<ul class="cal-items">${its.map((it) => itemHTML(it, past)).join('')}</ul></section>`;
    }).join('');
  }

  function listHTML() {
    const today = todayIso();
    const all = visible().filter(inMonth)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    if (!all.length) {
      const any = items.filter(inMonth).length;
      return `<p class="cal-empty">${any
        ? `Im ${MONTHS[month.m]} ${month.y} gibt es keine ${groupName.get(filter)}.`
        : `Für ${MONTHS[month.m]} ${month.y} sind noch keine Termine eingetragen.`}</p>`;
    }
    /* Laufender Monat: die Liste beginnt heute, Vergangenes auf Wunsch */
    const upcoming = all.filter((it) => it.date >= today);
    const list = showPast || !upcoming.length ? all : upcoming;
    const hidden = all.length - list.length;
    const more = hidden
      ? `<button type="button" class="cal-earlier" data-cal="frueher">${hidden === 1 ? 'Einen früheren Termin' : `${hidden} frühere Termine`} im ${MONTHS[month.m]} anzeigen</button>`
      : '';
    return more + daysHTML(list, today);
  }

  function filterHTML() {
    const counts = new Map(GROUPS.map(([g]) => [g, 0]));
    const inThis = items.filter(inMonth);
    for (const it of inThis) counts.set(it.group, counts.get(it.group) + 1);
    const btn = (g, label, n) =>
      `<button type="button" class="cal-filter${g ? ` g-${g}` : ''}" data-group="${g}" aria-pressed="${filter === g}">` +
        `${g ? `<i class="cal-dot g-${g}"></i>` : ''}${label}<span class="n">${n}</span></button>`;
    return btn('', 'Alle', inThis.length) +
      GROUPS.filter(([g]) => counts.get(g) || filter === g).map(([g, label]) => btn(g, label, counts.get(g))).join('');
  }

  function render(focusSel) {
    root.querySelector('.cal-title-m').textContent = `${MONTHS[month.m]} ${month.y}`;
    root.querySelector('.cal-month').innerHTML = monthGrid();
    root.querySelector('.cal-filters').innerHTML = filterHTML();
    root.querySelector('.cal-list').innerHTML = listHTML();
    const now = new Date();
    root.querySelector('[data-cal="heute"]').hidden = month.y === now.getFullYear() && month.m === now.getMonth();
    history.replaceState(null, '', `${location.pathname}?monat=${monthKey(month)}`);
    if (focusSel) {
      const el = root.querySelector(focusSel);
      if (el) el.focus();
    }
  }

  function shift(delta) {
    const dt = new Date(month.y, month.m + delta, 1);
    month = { y: dt.getFullYear(), m: dt.getMonth() };
    showPast = false;
    render();
  }

  function scrollToDay(iso) {
    let day = document.getElementById(`tag-${iso}`);
    /* Tag liegt im eingeklappten Teil des Monats: zuerst aufklappen */
    if (!day && !showPast) {
      showPast = true;
      root.querySelector('.cal-list').innerHTML = listHTML();
      day = document.getElementById(`tag-${iso}`);
    }
    if (!day) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    day.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    day.classList.remove('flash');
    void day.offsetWidth;
    day.classList.add('flash');
  }

  /* ---------- Start ---------- */
  async function init() {
    const q = new URLSearchParams(location.search).get('monat');
    const m = q && q.match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    month = m ? { y: Number(m[1]), m: Math.min(11, Math.max(0, Number(m[2]) - 1)) } : { y: now.getFullYear(), m: now.getMonth() };

    const [ha, rd, tm] = await Promise.all([
      HD.load(`${base}data/hochaemter.csv`).catch(() => []),
      getJSON(`${base}data/runden.json`),
      getJSON(`${base}data/termine.json`)
    ]);
    items = [...fromHochaemter(ha), ...fromRunden(rd), ...fromTermine(tm)];
    root.classList.add('ready');
    render();

    root.addEventListener('click', (ev) => {
      const nav = ev.target.closest('[data-cal]');
      if (nav) {
        const what = nav.dataset.cal;
        if (what === 'frueher') {
          showPast = true;
          root.querySelector('.cal-list').innerHTML = listHTML();
          const first = root.querySelector('.cal-day');
          if (first) first.querySelector('.cal-row').focus({ preventScroll: true });
        } else if (what === 'heute') {
          month = { y: now.getFullYear(), m: now.getMonth() };
          showPast = false;
          render('[data-cal="next"]');
        } else {
          shift(what === 'prev' ? -1 : 1);
        }
        return;
      }
      const f = ev.target.closest('.cal-filter');
      if (f) {
        filter = f.dataset.group;
        render(`.cal-filter[data-group="${filter}"]`);
        return;
      }
      const day = ev.target.closest('.cal-cell[data-day]');
      if (day) scrollToDay(day.dataset.day);
    });
  }

  init();
})();
