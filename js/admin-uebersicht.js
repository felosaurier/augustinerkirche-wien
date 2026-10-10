/* ============================================================
   Augustinerkirche Wien — admin-uebersicht.js
   Startseite der Verwaltung (admin/uebersicht.html): Begruessung,
   je Bereich eine Kachel mit Stand und Schnellzugriff und eine Liste
   "Noch offen" (fehlende Angaben bei den naechsten Hochaemtern,
   Jahreswechsel). Gezeigt wird nur, was die angemeldete Person bearbeiten darf.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const SOON_DAYS = 42;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function loadAll() {
    const json = (path) => A.readText(path).then((t) => JSON.parse(t));
    const [ha, news, sol, acc, gd, rd, ps, rp, st] = await Promise.allSettled([
      A.readText('data/hochaemter.csv').then((t) => HD.rowsToRaw(HD.parseCSV(t)).map(HD.normalize).filter(Boolean).sort(HD.byDateTime)),
      A.readText('data/news.csv').then(A.parseNews),
      json('data/solisten.json'),
      A.readText(A.ACCOUNTS).then(A.parseAccounts),
      json('data/gottesdienste.json'),
      json('data/runden.json'),
      json('data/personen.json'),
      json('data/repertoire.json'),
      json('data/startseite.json')
    ]);
    const val = (r) => (r.status === 'fulfilled' ? r.value : null);
    return {
      ha: val(ha), news: val(news), sol: val(sol), acc: val(acc), gd: val(gd),
      rd: val(rd) && val(rd).runden, ps: val(ps), rp: val(rp), st: val(st)
    };
  }

  function tile({ href, ico, title, stat, addHref, addLabel, addIcon = 'plus' }) {
    return '<article class="adm-tile">' +
      `<span class="adm-tile-ico">${icon(ico)}</span>` +
      `<div class="adm-tile-body"><h3 class="adm-tile-title"><a href="${href}">${title}</a></h3><div class="adm-tile-stat">${stat}</div></div>` +
      `<a class="adm-tile-add" href="${addHref}" aria-label="${addLabel}" title="${addLabel}">${icon(addIcon)}</a>` +
    '</article>';
  }

  function renderTiles({ ha, news, sol, acc, gd, rd, ps, rp, st }) {
    const { upcoming } = ha ? HD.splitByDate(ha) : { upcoming: [] };
    const none = '&nbsp;';
    const can = A.can;

    /* Personen: je nach Recht Leitung & Organisten (musik) und/oder Mitbrueder (kloster) */
    const personenArea = can('musik-personen') ? 'musik' : 'kloster';
    const personenCount = ps ? [['musik-personen', ['leitung', 'gastdirigenten', 'organisten']], ['mitbrueder', ['mitbrueder']]]
      .filter(([right]) => can(right))
      .reduce((n, [, groups]) => n + groups.reduce((m, g) => m + (ps[g] || []).length, 0), 0) : 0;
    const mine = (rd || []).filter((r) => A.canRunde(r.id));

    $('ov-tiles').innerHTML = [
      can('startseite') ? tile({
        href: 'startseite.html', ico: 'image', title: 'Startseite',
        stat: st ? plural((st.bilder || []).length, 'Titelfoto', 'Titelfotos') : none,
        addHref: 'startseite.html?neu=1', addLabel: 'Neues Foto'
      }) : '',
      can('hochaemter') ? tile({
        href: 'hochaemter.html', ico: 'calendar', title: 'Hochämter',
        stat: ha ? plural(upcoming.length, 'kommender Termin', 'kommende Termine') : none,
        addHref: 'hochaemter.html?neu=1', addLabel: 'Neues Hochamt'
      }) : '',
      can('neuigkeiten') ? tile({
        href: 'neuigkeiten.html', ico: 'news', title: 'Neuigkeiten',
        stat: news ? `${plural(news.length, 'Meldung', 'Meldungen')}` : none,
        addHref: 'neuigkeiten.html?neu=1', addLabel: 'Neue Meldung'
      }) : '',
      can('gottesdienste') ? tile({
        href: 'gottesdienste.html', ico: 'clock', title: 'Gottesdienste',
        stat: gd ? plural((gd.termine || []).length, 'Termin pro Woche', 'Termine pro Woche') : none,
        addHref: 'gottesdienste.html?neu=1', addLabel: 'Neuer Termin'
      }) : '',
      A.canAnyRunde() ? tile({
        href: 'runden.html', ico: 'users', title: A.canAllRunden() ? 'Runden' : mine.length === 1 ? 'Meine Runde' : 'Meine Runden',
        stat: rd ? plural(mine.length, 'Runde', 'Runden') : none,
        /* Wer nicht alle Runden darf, kann keine neue anlegen; Schnellzugriff dann auf die einzige eigene */
        ...(A.canAllRunden()
          ? { addHref: 'runden.html?neu=1', addLabel: 'Neue Runde' }
          : { addHref: mine.length === 1 ? `runden.html?bearbeiten=${encodeURIComponent(mine[0].id)}` : 'runden.html', addLabel: 'Bearbeiten', addIcon: 'edit' })
      }) : '',
      can('musik-personen') || can('mitbrueder') ? tile({
        href: `personen.html?bereich=${personenArea}`, ico: 'user', title: 'Personen',
        stat: ps ? plural(personenCount, 'Person', 'Personen') : none,
        ...(can('musik-personen') && can('mitbrueder')
          ? { addHref: 'personen.html?bereich=kloster', addLabel: 'Mitbrüder', addIcon: 'user' }
          : { addHref: `personen.html?bereich=${personenArea}`, addLabel: 'Bearbeiten', addIcon: 'edit' })
      }) : '',
      can('solisten') ? tile({
        href: 'solisten.html', ico: 'music', title: 'Solisten',
        stat: sol ? plural(sol.length, 'Solist', 'Solisten') : none,
        addHref: 'solisten.html?neu=1', addLabel: 'Neu'
      }) : '',
      can('repertoire') ? tile({
        href: 'repertoire.html', ico: 'book', title: 'Repertoire',
        stat: rp ? plural((rp.komponisten || []).reduce((n, k) => n + k.werke.length, 0), 'Werk', 'Werke') : none,
        addHref: 'repertoire.html?neu=1', addLabel: 'Komponist'
      }) : '',
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
    for (const r of A.canAnyRunde() ? rd || [] : []) {
      if (!A.canRunde(r.id)) continue;
      const all = (r.termine || []).flatMap((b) => b.daten || []);
      if (all.length && !all.some((d) => d >= A.isoToday())) {
        items.push({
          href: `runden.html?bearbeiten=${encodeURIComponent(r.id)}`, ico: 'calendar',
          title: r.titel, sub: 'Alle Termine sind vorbei. Neue Termine eintragen?', go: 'Ergänzen'
        });
      }
    }
    if (ha && A.can('hochaemter')) {
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
    for (const p of A.can('solisten') ? sol || [] : []) {
      if (!p.image) {
        items.push({ href: 'solisten.html', ico: 'image', title: p.name, sub: 'Solist ohne Foto', go: 'Ergänzen' });
      }
    }
    /* Ohne Recht fuer Hochaemter, Solisten und Runden gibt es nichts, was offen sein koennte */
    const panel = $('ov-todo-h').closest('section');
    panel.hidden = !(A.can('hochaemter') || A.can('solisten') || A.canAnyRunde());
    $('ov-todo').innerHTML = items.length
      ? `<ul class="adm-todo">${items.map((it) =>
        `<li><a href="${it.href}">${icon(it.ico)}<span><span class="adm-todo-title">${esc(it.title)}</span>` +
        `<span class="adm-todo-sub">${esc(it.sub)}</span></span><span class="adm-todo-go">${it.go} &rarr;</span></a></li>`).join('')}</ul>`
      : `<p class="adm-allgood">${icon('checkCircle')}Alles vollständig für die nächsten ${SOON_DAYS / 7} Wochen.</p>`;
    if (!ha && A.can('hochaemter')) $('ov-todo').insertAdjacentHTML('afterbegin', '<p class="adm-muted">Die Hochämter konnten nicht geladen werden.</p>');
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
    const hinweis = new URLSearchParams(location.search).get('hinweis');
    if (hinweis === 'nur-admin' || hinweis === 'kein-recht') {
      A.toast(hinweis === 'nur-admin' ? 'Die Zugänge kann nur ein Admin verwalten.' : 'Dafür hast du keine Berechtigung.', 'err');
      history.replaceState(null, '', location.pathname);
    }
    await refresh();
    A.folder.on((state) => { if (state === 'ok') refresh(); });
  });
})();
