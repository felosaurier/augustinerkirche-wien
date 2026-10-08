/* ============================================================
   Augustinerkirche Wien — admin-uebersicht.js
   Startseite der Verwaltung (admin/uebersicht.html): Begruessung,
   je Bereich eine Kachel mit Stand und Schnellzugriff, eine Liste
   "Noch offen" (fehlende Angaben bei den naechsten Hochaemtern,
   Jahreswechsel) und die letzten Aenderungen auf diesem Geraet.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const SOON_DAYS = 42;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function loadAll() {
    const json = (path) => A.readText(path).then((t) => JSON.parse(t));
    const [ha, news, sol, acc, gd, kt, rd, ps, rp] = await Promise.allSettled([
      A.readText('data/hochaemter.csv').then((t) => HD.rowsToRaw(HD.parseCSV(t)).map(HD.normalize).filter(Boolean).sort(HD.byDateTime)),
      A.readText('data/news.csv').then(A.parseNews),
      json('data/solisten.json'),
      A.readText(A.ACCOUNTS).then(A.parseAccounts),
      json('data/gottesdienste.json'),
      json('data/kontakt.json'),
      json('data/runden.json'),
      json('data/personen.json'),
      json('data/repertoire.json')
    ]);
    const val = (r) => (r.status === 'fulfilled' ? r.value : null);
    return {
      ha: val(ha), news: val(news), sol: val(sol), acc: val(acc), gd: val(gd), kt: val(kt),
      rd: val(rd) && val(rd).runden, ps: val(ps), rp: val(rp)
    };
  }

  function tile({ href, ico, title, stat, text, addHref, addLabel, addIcon = 'plus' }) {
    return '<article class="adm-tile">' +
      `<div class="adm-tile-head"><span class="adm-tile-ico">${icon(ico)}</span><h3 class="adm-tile-title"><a href="${href}">${title}</a></h3></div>` +
      `<div class="adm-tile-stat">${stat}</div>` +
      `<p class="adm-tile-text">${text}</p>` +
      `<div class="adm-tile-foot"><span class="link-arr" aria-hidden="true">Öffnen</span>` +
      `<a class="btn btn-dark btn-sm" href="${addHref}">${icon(addIcon)}${addLabel}</a></div>` +
    '</article>';
  }

  const DAYS = { so: 'Sonntag', mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag' };
  /* Naechster Termin aller Runden: {d, r} */
  function nextRunde(rd) {
    let best = null;
    for (const r of rd || []) {
      for (const d of (r.termine || []).flatMap((b) => b.daten || [])) {
        if (d >= A.isoToday() && (!best || d < best.d)) best = { d, r };
      }
    }
    return best;
  }

  function renderTiles({ ha, news, sol, acc, gd, kt, rd, ps, rp }) {
    const unavailable = 'Konnte nicht geladen werden.';
    const { upcoming } = ha ? HD.splitByDate(ha) : { upcoming: [] };
    const next = upcoming[0];
    const voices = new Map();
    for (const p of sol || []) voices.set(p.voice, (voices.get(p.voice) || 0) + 1);
    const me = A.session() || {};

    $('ov-tiles').innerHTML = [
      tile({
        href: 'hochaemter.html', ico: 'calendar', title: 'Hochämter',
        stat: ha ? plural(upcoming.length, 'kommender Termin', 'kommende Termine') : '&nbsp;',
        text: !ha ? unavailable : next
          ? `Als Nächstes: <b>${esc(A.fmtDate(next.date))}</b>, ${esc(next.time)} Uhr<br>${esc(next.piece || next.type)}`
          : 'Keine kommenden Termine eingetragen.',
        addHref: 'hochaemter.html?neu=1', addLabel: 'Neues Hochamt'
      }),
      tile({
        href: 'neuigkeiten.html', ico: 'news', title: 'Neuigkeiten',
        stat: news ? `${plural(news.length, 'Meldung', 'Meldungen')} · ${A.newsOnHome(news).size} auf der Startseite` : '&nbsp;',
        text: !news ? unavailable : news.length
          ? `Neueste: <b>${esc(news[0].Titel)}</b><br>vom ${esc(news[0].Datum)}`
          : 'Noch keine Meldungen.',
        addHref: 'neuigkeiten.html?neu=1', addLabel: 'Neue Meldung'
      }),
      tile({
        href: 'gottesdienste.html', ico: 'clock', title: 'Gottesdienste',
        stat: gd ? plural((gd.termine || []).length, 'Termin in der Woche', 'Termine in der Woche') : '&nbsp;',
        text: !gd ? unavailable
          : `Wochenplan der Messen und Termine.${kt && (kt.kanzlei || []).length
            ? `<br>Pfarrkanzlei: ${(kt.kanzlei || []).map((h) => `${esc(h.tage)} ${esc(h.zeit)}`).join(' · ')}` : ''}`,
        addHref: 'gottesdienste.html?neu=1', addLabel: 'Neuer Termin'
      }),
      tile({
        href: 'runden.html', ico: 'users', title: 'Runden',
        stat: rd ? plural(rd.length, 'Runde', 'Runden') : '&nbsp;',
        text: !rd ? unavailable : (() => {
          const n = nextRunde(rd);
          return n ? `Nächster Termin: <b>${esc(A.fmtDate(n.d))}</b><br>${esc(n.r.titel)}` : 'Keine kommenden Termine eingetragen.';
        })(),
        addHref: 'runden.html?neu=1', addLabel: 'Neue Runde'
      }),
      tile({
        href: 'personen.html?bereich=musik', ico: 'user', title: 'Personen',
        stat: ps ? plural(Object.values(ps).reduce((n, l) => n + l.length, 0), 'Person', 'Personen') : '&nbsp;',
        text: !ps ? unavailable
          : `Mitbrüder, Leitung, Gastdirigenten und Organisten.<br>${[['mitbrueder', 'Mitbrüder'], ['leitung', 'Leitung'], ['gastdirigenten', 'Gastdirigenten'], ['organisten', 'Organisten']]
            .map(([k, l]) => `${(ps[k] || []).length} ${l}`).join(' · ')}`,
        addHref: 'personen.html?bereich=kloster', addLabel: 'Mitbrüder', addIcon: 'user'
      }),
      tile({
        href: 'solisten.html', ico: 'music', title: 'Solisten',
        stat: sol ? plural(sol.length, 'Solistin oder Solist', 'Solistinnen und Solisten') : '&nbsp;',
        text: !sol ? unavailable
          : `Fotos und Stimmlagen für Kirchenmusik → Solisten.<br>${[...voices].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v, n]) => `${n} ${esc(v)}`).join(' · ')}`,
        addHref: 'solisten.html?neu=1', addLabel: 'Neu'
      }),
      tile({
        href: 'repertoire.html', ico: 'book', title: 'Repertoire',
        stat: rp ? plural((rp.komponisten || []).reduce((n, k) => n + k.werke.length, 0), 'Werk', 'Werke') : '&nbsp;',
        text: !rp ? unavailable : `Ständiges Repertoire des Chores, ${plural((rp.komponisten || []).length, 'Komponist', 'Komponisten')}.`,
        addHref: 'repertoire.html?neu=1', addLabel: 'Komponist'
      }),
      A.isAdmin() ? tile({
        href: 'zugaenge.html', ico: 'key', title: 'Zugänge',
        stat: acc ? plural(acc.length, 'Zugang', 'Zugänge') : '&nbsp;',
        text: `Wer sich hier anmelden darf. Du bist angemeldet als <b>${esc(me.benutzer)}</b> (Admin).`,
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

  function renderLog() {
    const list = A.recentLog().slice(0, 8);
    $('ov-log').innerHTML = list.length
      ? `<ul class="adm-log">${list.map((e) => {
        const dt = new Date(e.zeit);
        const when = `${HD.pad(dt.getDate())}.${HD.pad(dt.getMonth() + 1)}. ${HD.pad(dt.getHours())}:${HD.pad(dt.getMinutes())}`;
        return `<li><time datetime="${dt.toISOString()}">${when}</time><span>${esc(e.text)}${e.wer ? `<small>von ${esc(e.wer)}</small>` : ''}</span></li>`;
      }).join('')}</ul>`
      : '<p class="adm-muted">Noch nichts geändert.</p>';
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
    $('ov-today').textContent = `${A.fmtDate(A.isoToday())}. Was möchtest du heute pflegen?`;
    renderLog();
    if (new URLSearchParams(location.search).get('hinweis') === 'nur-admin') {
      A.toast('Die Zugänge kann nur ein Admin verwalten.', 'err');
      history.replaceState(null, '', location.pathname);
    }
    await refresh();
    A.folder.on((state) => { if (state === 'ok') refresh(); });
  });
})();
