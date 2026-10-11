/* ============================================================
   Augustinerkirche Wien — admin-uebersicht.js
   Startseite der Verwaltung (admin/uebersicht.html): Begruessung,
   je Bereich eine Kachel mit Stand und Schnellzugriff (nach Themen
   geordnet, jeder Bereich der Verwaltung ist hier erreichbar), eine
   Liste "Noch offen" (fehlende Angaben bei den naechsten Hochaemtern,
   Jahreswechsel) und "Zuletzt geaendert" (auf diesem Geraet).
   Gezeigt wird nur, was die angemeldete Person bearbeiten darf.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const SOON_DAYS = 42;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function loadAll() {
    const json = (path) => A.readJSON(path);
    const [ha, news, sol, acc, gd, rd, ps, rp, st, tm, pt, cd, rg, pg, hw, mt, re] = await Promise.allSettled([
      A.readText('data/hochaemter.csv').then((t) => HD.rowsToRaw(HD.parseCSV(t)).map(HD.normalize).filter(Boolean).sort(HD.byDateTime)),
      A.readText('data/news.csv').then(A.parseNews),
      json('data/solisten.json'),
      A.readText(A.ACCOUNTS).then(A.parseAccounts),
      json('data/gottesdienste.json'),
      json('data/runden.json'),
      json('data/personen.json'),
      json('data/repertoire.json'),
      json('data/startseite.json'),
      json('data/termine.json'),
      json('data/paten.json'),
      json('data/cds.json'),
      json('data/rundgang.json'),
      json('data/pgr.json'),
      json('data/hinweise.json'),
      A.isDev() ? json('admin/mitteilungen.json') : Promise.resolve(null),
      json('data/rechtliches.json')
    ]);
    const val = (r) => (r.status === 'fulfilled' ? r.value : null);
    return {
      ha: val(ha), news: val(news), sol: val(sol), acc: val(acc), gd: val(gd),
      rd: val(rd) && val(rd).runden, ps: val(ps), rp: val(rp), st: val(st),
      tm: val(tm), pt: val(pt), cd: val(cd), rg: val(rg), pg: val(pg), hw: val(hw), mt: val(mt), re: val(re)
    };
  }

  function tile({ href, ico, title, stat, addHref, addLabel, addIcon = 'plus' }) {
    return '<article class="adm-tile">' +
      `<span class="adm-tile-ico">${icon(ico)}</span>` +
      `<div class="adm-tile-body"><h3 class="adm-tile-title"><a href="${href}">${title}</a></h3><div class="adm-tile-stat">${stat}</div></div>` +
      `<a class="adm-tile-add" href="${addHref}" aria-label="${addLabel}" title="${addLabel}">${icon(addIcon)}</a>` +
    '</article>';
  }

  /* Bereiche nach Themen; jede Kachel erscheint nur, wenn die Person den Bereich bearbeiten darf */
  function renderTiles({ ha, news, sol, acc, gd, rd, ps, rp, st, tm, pt, cd, rg, pg, hw, mt, re }) {
    const { upcoming } = ha ? HD.splitByDate(ha) : { upcoming: [] };
    const none = '&nbsp;';
    const can = A.can;
    const count = (list) => (list || []).length;
    const people = (groups) => (ps ? groups.reduce((n, g) => n + count(ps[g]), 0) : null);
    const mine = (rd || []).filter((r) => A.canRunde(r.id));
    const live = (list) => (list || []).filter((h) => A.noticeActive(h)).length;
    const cdN = cd ? (cd.gruppen || []).reduce((n, g) => n + count(g.cds), 0) : null;

    const groups = [
      ['Website', [
        can('startseite') && tile({
          href: 'startseite.html', ico: 'image', title: 'Startseite',
          stat: st ? plural(count(st.bilder), 'Titelfoto', 'Titelfotos') : none,
          addHref: 'startseite.html?neu=1', addLabel: 'Fotos hinzufügen'
        }),
        can('rechtliches') && tile({
          href: 'rechtliches.html', ico: 'book', title: 'Impressum &amp; Datenschutz',
          stat: re ? (() => {
            const open = ['impressum', 'datenschutz'].reduce((n, k) => n + ((re[k] && re[k].abschnitte) || [])
              .reduce((m, s) => m + (String(s.text || '').match(/\[\[offen:/g) || []).length, 0), 0);
            return open ? `${plural(open, 'Stelle', 'Stellen')} noch offen` : 'Vollständig';
          })() : none,
          addHref: 'rechtliches.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        }),
        can('hinweise') && tile({
          href: 'hinweise.html', ico: 'alert', title: 'Hinweisbanner',
          stat: hw ? (live(hw.hinweise) ? `${plural(live(hw.hinweise), 'Hinweis', 'Hinweise')} sichtbar` : 'Gerade kein Hinweis sichtbar') : none,
          addHref: 'hinweise.html?neu=1', addLabel: 'Neuer Hinweis'
        }),
        can('neuigkeiten') && tile({
          href: 'neuigkeiten.html', ico: 'news', title: 'Neuigkeiten',
          stat: news ? plural(news.length, 'Meldung', 'Meldungen') : none,
          addHref: 'neuigkeiten.html?neu=1', addLabel: 'Neue Meldung'
        }),
        can('termine') && tile({
          href: 'termine.html', ico: 'calendar', title: 'Termine',
          stat: tm ? plural(count(tm.termine), 'eigener Termin', 'eigene Termine') : none,
          addHref: 'termine.html?neu=1', addLabel: 'Neuer Termin'
        })
      ]],
      ['Kirchenmusik', [
        can('hochaemter') && tile({
          href: 'hochaemter.html', ico: 'calendar', title: 'Hochämter',
          stat: ha ? plural(upcoming.length, 'kommender Termin', 'kommende Termine') : none,
          addHref: 'hochaemter.html?neu=1', addLabel: 'Neues Hochamt'
        }),
        can('solisten') && tile({
          href: 'solisten.html', ico: 'music', title: 'Solisten',
          stat: sol ? plural(sol.length, 'Solist', 'Solisten') : none,
          addHref: 'solisten.html?neu=1', addLabel: 'Neuer Solist'
        }),
        can('paten') && tile({
          href: 'paten.html', ico: 'users', title: 'Paten',
          stat: pt ? `${plural(count(pt.paten), 'Pate', 'Paten')} · ${plural(count(pt.ehrenpaten), 'Ehrenpate', 'Ehrenpaten')}` : none,
          addHref: 'paten.html?neu=1', addLabel: 'Neuer Pate'
        }),
        can('cds') && tile({
          href: 'cds.html', ico: 'music', title: 'CDs',
          stat: cdN !== null ? plural(cdN, 'CD', 'CDs') : none,
          addHref: 'cds.html?neu=1', addLabel: 'Neue CD'
        }),
        can('musik-personen') && tile({
          href: 'personen.html?bereich=musik', ico: 'user', title: 'Leitung & Organisten',
          stat: ps ? plural(people(['leitung', 'gastdirigenten', 'organisten']), 'Person', 'Personen') : none,
          addHref: 'personen.html?bereich=musik&neu=1', addLabel: 'Neue Person'
        }),
        can('repertoire') && tile({
          href: 'repertoire.html', ico: 'book', title: 'Repertoire',
          stat: rp ? plural((rp.komponisten || []).reduce((n, k) => n + count(k.werke), 0), 'Werk', 'Werke') : none,
          addHref: 'repertoire.html?neu=1', addLabel: 'Neuer Komponist'
        })
      ]],
      ['Pfarre & Kloster', [
        can('gottesdienste') && tile({
          href: 'gottesdienste.html', ico: 'clock', title: 'Gottesdienste',
          stat: gd ? plural(count(gd.termine), 'Termin pro Woche', 'Termine pro Woche') : none,
          addHref: 'gottesdienste.html?neu=1', addLabel: 'Neuer Termin'
        }),
        A.canAnyRunde() && tile({
          href: 'runden.html', ico: 'users', title: A.canAllRunden() ? 'Runden' : mine.length === 1 ? 'Meine Runde' : 'Meine Runden',
          stat: rd ? plural(mine.length, 'Runde', 'Runden') : none,
          /* Wer nicht alle Runden darf, kann keine neue anlegen; Schnellzugriff dann auf die einzige eigene */
          ...(A.canAllRunden()
            ? { addHref: 'runden.html?neu=1', addLabel: 'Neue Runde' }
            : { addHref: mine.length === 1 ? `runden.html?bearbeiten=${encodeURIComponent(mine[0].id)}` : 'runden.html', addLabel: 'Bearbeiten', addIcon: 'edit' })
        }),
        can('rundgang') && tile({
          href: 'rundgang.html', ico: 'image', title: 'Kirchenrundgang',
          stat: rg ? plural(count(rg.bilder), 'Bild', 'Bilder') : none,
          addHref: 'rundgang.html?neu=1', addLabel: 'Neues Bild'
        }),
        can('pgr') && tile({
          href: 'pgr.html', ico: 'users', title: 'Pfarrgemeinderat',
          stat: pg ? plural(count(pg.mitglieder) + count(pg.weitere), 'Person', 'Personen') : none,
          addHref: 'pgr.html?neu=1', addLabel: 'Neue Person'
        }),
        can('mitbrueder') && tile({
          href: 'personen.html?bereich=kloster', ico: 'user', title: 'Mitbrüder',
          stat: ps ? plural(people(['mitbrueder']), 'Mitbruder', 'Mitbrüder') : none,
          addHref: 'personen.html?bereich=kloster&neu=1', addLabel: 'Neuer Mitbruder'
        }),
        can('kontakt') && tile({
          href: 'kontakt.html', ico: 'clock', title: 'Pfarrkanzlei & Kontakt',
          stat: 'Öffnungszeiten, Telefon, E-Mail', addHref: 'kontakt.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        })
      ]],
      ['Verwaltung', [
        A.isDev() && tile({
          href: 'mitteilungen.html', ico: 'info', title: 'Mitteilungen',
          stat: mt ? (live(mt.mitteilungen) ? `${plural(live(mt.mitteilungen), 'Mitteilung', 'Mitteilungen')} aktiv` : 'Gerade keine aktiv') : 'Gerade keine aktiv',
          addHref: 'mitteilungen.html?neu=1', addLabel: 'Neue Mitteilung'
        }),
        A.isAdmin() && tile({
          href: 'zugaenge.html', ico: 'key', title: 'Zugänge',
          stat: acc ? plural(acc.length, 'Zugang', 'Zugänge') : none,
          addHref: 'zugaenge.html?neu=1', addLabel: 'Neuer Zugang'
        })
      ]]
    ];
    $('ov-tiles').innerHTML = groups
      .map(([title, tiles]) => [title, tiles.filter(Boolean)])
      .filter(([, tiles]) => tiles.length)
      .map(([title, tiles]) =>
        `<section class="adm-tilegroup" aria-label="${esc(title)}"><h3 class="adm-tilegroup-h">${esc(title)}</h3>` +
        `<div class="adm-tiles">${tiles.join('')}</div></section>`)
      .join('');
  }

  /* Zuletzt geaendert: das Protokoll dieses Geraets (maximal 30 Eintraege, hier die letzten 8),
     je Eintrag aufklappbar, was sich genau geaendert hat */
  function renderLog() {
    const list = A.recentLog().slice(0, 8);
    const panel = $('ov-log-h').closest('section');
    panel.hidden = !list.length;
    const when = (t) => new Date(t).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('ov-log').innerHTML = `<ul class="adm-log">${list.map((e) => {
      const det = e.details || [];
      return `<li><time datetime="${esc(new Date(e.zeit).toISOString())}">${esc(when(e.zeit))}</time><span>${esc(e.text)}${e.wer ? `<small>${esc(e.wer)}</small>` : ''}` +
        (det.length ? `<details class="adm-log-det"><summary>${plural(det.length, 'Änderung', 'Änderungen')}</summary><ul>${det.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '') +
        '</span></li>';
    }).join('')}</ul>` +
      (A.isDev() ? '<p class="adm-log-all"><a href="aenderungen.html">Alle Änderungen von allen ansehen</a></p>' : '');
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
    renderLog();
  }

  A.start(async () => {
    const s = A.session();
    /* Titel (Pater, Dr. ...) bleiben stehen, dazu der Vorname: "Guten Abend, Pater Matthias" */
    const words = String(s.name || s.benutzer).trim().split(/\s+/);
    const isTitle = (w) => /^(pater|p\.|dr\.|mag\.|mmag\.|prof\.|dipl\.-ing\.|frau|herr|br\.|bruder|fr\.)$/i.test(w);
    let n = 0;
    while (n < words.length - 1 && isTitle(words[n])) n++;
    const first = words.slice(0, n + 1).join(' ');
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
