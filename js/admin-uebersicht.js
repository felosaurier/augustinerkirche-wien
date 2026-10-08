/* ============================================================
   Augustinerkirche Wien — admin-uebersicht.js
   Startseite der Verwaltung (admin/uebersicht.html): Begruessung,
   je Bereich eine Kachel mit Stand und Schnellzugriff und eine Liste
   "Noch offen" (fehlende Angaben bei den naechsten Hochaemtern,
   Jahreswechsel).
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const SOON_DAYS = 42;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function loadAll() {
    const json = (path) => A.readText(path).then((t) => JSON.parse(t));
    const [ha, news, sol, acc, gd, rd, ps, rp] = await Promise.allSettled([
      A.readText('data/hochaemter.csv').then((t) => HD.rowsToRaw(HD.parseCSV(t)).map(HD.normalize).filter(Boolean).sort(HD.byDateTime)),
      A.readText('data/news.csv').then(A.parseNews),
      json('data/solisten.json'),
      A.readText(A.ACCOUNTS).then(A.parseAccounts),
      json('data/gottesdienste.json'),
      json('data/runden.json'),
      json('data/personen.json'),
      json('data/repertoire.json')
    ]);
    const val = (r) => (r.status === 'fulfilled' ? r.value : null);
    return {
      ha: val(ha), news: val(news), sol: val(sol), acc: val(acc), gd: val(gd),
      rd: val(rd) && val(rd).runden, ps: val(ps), rp: val(rp)
    };
  }

  function tile({ href, ico, title, stat, addHref, addLabel, addIcon = 'plus' }) {
    return '<article class="adm-tile">' +
      `<span class="adm-tile-ico">${icon(ico)}</span>` +
      `<div class="adm-tile-body"><h3 class="adm-tile-title"><a href="${href}">${title}</a></h3><div class="adm-tile-stat">${stat}</div></div>` +
      `<a class="adm-tile-add" href="${addHref}" aria-label="${addLabel}" title="${addLabel}">${icon(addIcon)}</a>` +
    '</article>';
  }

  function renderTiles({ ha, news, sol, acc, gd, rd, ps, rp }) {
    const { upcoming } = ha ? HD.splitByDate(ha) : { upcoming: [] };
    const none = '&nbsp;';

    $('ov-tiles').innerHTML = [
      tile({
        href: 'hochaemter.html', ico: 'calendar', title: 'Hochämter',
        stat: ha ? plural(upcoming.length, 'kommender Termin', 'kommende Termine') : none,
        addHref: 'hochaemter.html?neu=1', addLabel: 'Neues Hochamt'
      }),
      tile({
        href: 'neuigkeiten.html', ico: 'news', title: 'Neuigkeiten',
        stat: news ? `${plural(news.length, 'Meldung', 'Meldungen')}` : none,
        addHref: 'neuigkeiten.html?neu=1', addLabel: 'Neue Meldung'
      }),
      tile({
        href: 'gottesdienste.html', ico: 'clock', title: 'Gottesdienste',
        stat: gd ? plural((gd.termine || []).length, 'Termin pro Woche', 'Termine pro Woche') : none,
        addHref: 'gottesdienste.html?neu=1', addLabel: 'Neuer Termin'
      }),
      tile({
        href: 'runden.html', ico: 'users', title: 'Runden',
        stat: rd ? plural(rd.length, 'Runde', 'Runden') : none,
        addHref: 'runden.html?neu=1', addLabel: 'Neue Runde'
      }),
      tile({
        href: 'personen.html?bereich=musik', ico: 'user', title: 'Personen',
        stat: ps ? plural(Object.values(ps).reduce((n, l) => n + l.length, 0), 'Person', 'Personen') : none,
        addHref: 'personen.html?bereich=kloster', addLabel: 'Mitbrüder', addIcon: 'user'
      }),
      tile({
        href: 'solisten.html', ico: 'music', title: 'Solisten',
        stat: sol ? plural(sol.length, 'Solist', 'Solisten') : none,
        addHref: 'solisten.html?neu=1', addLabel: 'Neu'
      }),
      tile({
        href: 'repertoire.html', ico: 'book', title: 'Repertoire',
        stat: rp ? plural((rp.komponisten || []).reduce((n, k) => n + k.werke.length, 0), 'Werk', 'Werke') : none,
        addHref: 'repertoire.html?neu=1', addLabel: 'Komponist'
      }),
      A.isAdmin() ? tile({
        href: 'zugaenge.html', ico: 'key', title: 'Zugänge',
        stat: acc ? plural(acc.length, 'Zugang', 'Zugänge') : none,
        addHref: 'zugaenge.html?neu=1', addLabel: 'Neuer Zugang'
      }) : ''
    ].join('');
  }

  function renderTodo({ ha, sol, rd }) {
    const items = [];
    /* Meldungen ohne Enddatum sind kein Fehler: sie gelten zwei Wochen (HD.newsUntil) */
    /* Runden mit Terminen, die alle vorbei sind */
    for (const r of rd || []) {
      const all = (r.termine || []).flatMap((b) => b.daten || []);
      if (all.length && !all.some((d) => d >= A.isoToday())) {
        items.push({
          href: `runden.html?bearbeiten=${encodeURIComponent(r.id)}`, ico: 'calendar',
          title: r.titel, sub: 'Alle Termine sind vorbei. Neue Termine eintragen?', go: 'Ergänzen'
        });
      }
    }
    if (ha) {
      const year = new Date().getFullYear();
      const old = ha.filter((e) => e.dateObj.getFullYear() < year);
      if (old.length) {
        items.push({
          href: 'hochaemter.html#archiv', ico: 'archive',
          title: `Jahreswechsel: ${plural(old.length, 'Termin', 'Termine')} ins Archiv`,
          sub: 'Die Hochämter der Vorjahre gehören ins Jahresarchiv. Ein Klick erledigt das.',
          go: 'Erledigen'
        });
      }
      const limit = HD.today();
      limit.setDate(limit.getDate() + SOON_DAYS);
      for (const e of HD.splitByDate(ha).upcoming) {
        if (e.dateObj > limit) break;
        const miss = A.missingInfo(e);
        if (!miss.length) continue;
        items.push({
          href: `hochaemter.html?bearbeiten=${encodeURIComponent(e.id)}`, ico: 'alert',
          title: `${A.fmtShort(e.date)}, ${e.time} · ${e.piece || e.type}`,
          sub: `Es fehlt: ${miss.join(', ')}`,
          go: 'Ergänzen'
        });
      }
    }
    for (const p of sol || []) {
      if (!p.image) {
        items.push({ href: 'solisten.html', ico: 'image', title: p.name, sub: 'Solist ohne Foto', go: 'Ergänzen' });
      }
    }
    $('ov-todo').innerHTML = items.length
      ? `<ul class="adm-todo">${items.map((it) =>
        `<li><a href="${it.href}">${icon(it.ico)}<span><span class="adm-todo-title">${esc(it.title)}</span>` +
        `<span class="adm-todo-sub">${esc(it.sub)}</span></span><span class="adm-todo-go">${it.go} &rarr;</span></a></li>`).join('')}</ul>`
      : `<p class="adm-allgood">${icon('checkCircle')}Alles vollständig für die nächsten ${SOON_DAYS / 7} Wochen.</p>`;
    if (!ha) $('ov-todo').insertAdjacentHTML('afterbegin', '<p class="adm-muted">Die Hochämter konnten nicht geladen werden.</p>');
  }

  async function refresh() {
    const data = await loadAll();
    renderTiles(data);
    renderTodo(data);
  }

  A.start(async () => {
    const s = A.session();
    const first = String(s.name || s.benutzer).split(/\s+/)[0];
    const hour = new Date().getHours();
    $('ov-greet').innerHTML = `${hour < 11 ? 'Guten Morgen' : hour >= 18 ? 'Guten Abend' : 'Grüß Gott'}, <em>${esc(first)}</em>`;
    $('ov-today').textContent = `${A.fmtDate(A.isoToday())}`;
    if (new URLSearchParams(location.search).get('hinweis') === 'nur-admin') {
      A.toast('Die Zugänge kann nur ein Admin verwalten.', 'err');
      history.replaceState(null, '', location.pathname);
    }
    await refresh();
    A.folder.on((state) => { if (state === 'ok') refresh(); });
  });
})();
