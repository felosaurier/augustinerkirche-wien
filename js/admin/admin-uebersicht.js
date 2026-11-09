/* ============================================================
   Augustinerkirche Wien — admin-uebersicht.js
   Startseite der Verwaltung (admin/uebersicht.html): Begruessung mit
   Schnellzugriff (neue Meldung, neues Hochamt), "Noch offen" (fehlende
   Angaben bei den naechsten Hochaemtern, Jahreswechsel, Runden ohne
   Termine, Wochenkalender), alle Bereiche als kompakte Liste (eine Zeile
   je Bereich mit Stand, Hinweis und Schnellzugriff, in denselben Gruppen
   wie die Seitenleiste) und ganz unten "Zuletzt geaendert" (nur eigene).
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
    const [ha, news, sol, acc, gd, rd, ps, rp, st, tm, pt, cd, rg, pg, hw, mt, re, sp, wk, ga, pa, wo, fh, pr] = await Promise.allSettled([
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
      json('data/rechtliches.json'),
      json('data/sprueche.json'),
      json('data/wochenkalender.json'),
      /* fehlt die Datei noch, gibt es eben keine Alben */
      json('data/galerie.json').catch(() => ({ alben: [] })),
      json('data/pgr-aspersdorf.json'),
      json('data/aspersdorf-wochen.json'),
      json('data/friedhof.json'),
      json('data/predigten/index.json').catch(() => json('data/predigten.json'))
    ]);
    const val = (r) => (r.status === 'fulfilled' ? r.value : null);
    return {
      ha: val(ha), news: val(news), sol: val(sol), acc: val(acc), gd: val(gd),
      rd: val(rd) && val(rd).runden, ps: val(ps), rp: val(rp), st: val(st),
      tm: val(tm), pt: val(pt), cd: val(cd), rg: val(rg), pg: val(pg), hw: val(hw), mt: val(mt), re: val(re), sp: val(sp), wk: val(wk), ga: val(ga),
      pa: val(pa), wo: val(wo), fh: val(fh), pr: val(pr)
    };
  }

  /* Wochenkalender: Hinweis, wenn fuer die naechsten sieben Tage nicht alles eingetragen ist */
  function weekFlag(wk) {
    if (!wk) return '';
    const days = (wk.tage || []).map((t) => t.datum).filter((x) => x >= A.isoToday()).sort();
    if (!days.length) return 'Keine kommenden Tage eingetragen';
    const limit = HD.today();
    limit.setDate(limit.getDate() + 6);
    const last = days[days.length - 1];
    return last < A.isoOf(limit) ? `Nur bis ${A.fmtShort(last)} eingetragen` : '';
  }
  /* Runden (die die Person bearbeiten darf), deren Termine alle vorbei sind */
  function staleRunden(rd) {
    const today = A.isoToday();
    return (rd || []).filter((r) => {
      if (!A.canRunde(r.id)) return false;
      const all = (r.termine || []).flatMap((b) => b.daten || []);
      return all.length && !all.some((x) => x >= today);
    });
  }

  /* Eine Zeile je Bereich: Name, Stand, Hinweis (flag, z. B. "2 ohne Foto") und Schnellzugriff */
  function row({ href, ico, title, stat, flag = '' }) {
    /* Rechts steht nur die Zahl ("23 Meldungen" -> 23); ein Punkt zeigt, wo etwas zu tun ist */
    const n = (String(stat).match(/^(\d+)/) || [])[1] || '';
    return `<li class="adm-area${flag ? ' has-flag' : ''}">` +
      `<a class="adm-idx" href="${href}"${flag ? ` title="${esc(flag)}"` : ''}>${icon(ico)}` +
        `<span class="adm-idx-name">${title}</span><span class="adm-idx-dots" aria-hidden="true"></span>` +
        (flag ? `<span class="adm-idx-flag" role="img" aria-label="${esc(flag)}"></span>` : '') +
        (n ? `<span class="adm-idx-n">${n}</span>` : '') +
      '</a></li>';
  }

  /* Alle Bereiche, gruppiert wie die Seitenleiste (js/admin/admin.js, NAV) */
  function renderAreas({ ha, news, sol, acc, gd, rd, ps, rp, st, tm, pt, cd, rg, pg, hw, mt, re, sp, wk, ga, pa, wo, fh, pr }) {
    const { upcoming } = ha ? HD.splitByDate(ha) : { upcoming: [] };
    const none = '&nbsp;';
    const can = A.can;
    const count = (list) => (list || []).length;
    const people = (groups) => (ps ? groups.reduce((n, g) => n + count(ps[g]), 0) : null);
    const mine = (rd || []).filter((r) => A.canRunde(r.id));
    const live = (list) => (list || []).filter((h) => A.noticeActive(h)).length;
    const cdN = cd ? (cd.gruppen || []).reduce((n, g) => n + count(g.cds), 0) : null;
    const stale = staleRunden(rd).length;
    /* Wochenblatt Aspersdorf: Hinweis, wenn das neueste schon laenger als eine Woche zurueckliegt */
    const newestWeek = wo ? (wo.wochen || []).map((w) => w.datum).sort().pop() : '';
    const weekOld = wo && (!newestWeek || newestWeek < A.isoOf(new Date(Date.now() - 8 * 86400000)))
      ? (newestWeek ? `Letztes Blatt vom ${A.fmtShort(newestWeek)}` : 'Noch kein Wochenblatt') : '';
    const noPhoto = (sol || []).filter((p) => !p.image).length;
    const noCover = cd ? (cd.gruppen || []).reduce((n, g) => n + (g.cds || []).filter((c) => !c.cover).length, 0) : 0;
    const openLegal = re ? ['impressum', 'datenschutz'].reduce((n, k) => n + ((re[k] && re[k].abschnitte) || [])
      .reduce((m, s) => m + (String(s.text || '').match(/\[\[offen:/g) || []).length, 0), 0) : 0;

    const groups = [
      ['Aktuelles', [
        can('neuigkeiten') && row({
          href: 'neuigkeiten.html', ico: 'news', title: 'Neuigkeiten',
          stat: news ? plural(news.length, 'Meldung', 'Meldungen') : none,
          addHref: 'neuigkeiten.html?neu=1', addLabel: 'Neue Meldung'
        }),
        can('termine') && row({
          href: 'termine.html', ico: 'calendar', title: 'Termine',
          stat: tm ? plural(count(tm.termine), 'eigener Termin', 'eigene Termine') : none,
          addHref: 'termine.html?neu=1', addLabel: 'Neuer Termin'
        }),
        can('hochaemter') && row({
          href: 'hochaemter.html', ico: 'music', title: 'Hochämter',
          stat: ha ? plural(upcoming.length, 'kommender Termin', 'kommende Termine') : none,
          addHref: 'hochaemter.html?neu=1', addLabel: 'Neues Hochamt'
        })
      ]],
      ['Pfarre & Kloster', [
        can('gottesdienste') && row({
          href: 'gottesdienste.html', ico: 'clock', title: 'Regelmäßige Termine',
          stat: gd ? plural(count(gd.termine), 'Termin pro Woche', 'Termine pro Woche') : none,
          addHref: 'gottesdienste.html?neu=1', addLabel: 'Neuer Termin'
        }),
        can('wochenkalender') && row({
          href: 'wochenkalender.html', ico: 'calendarWeek', title: 'Wochenkalender', flag: weekFlag(wk),
          stat: wk ? plural(count((wk.tage || []).filter((x) => x.datum >= A.isoToday())), 'kommender Tag', 'kommende Tage') : none,
          addHref: 'wochenkalender.html', addLabel: 'Woche eintragen', addIcon: 'edit'
        }),
        A.canAnyRunde() && row({
          href: 'runden.html', ico: 'users', title: A.canAllRunden() ? 'Runden' : mine.length === 1 ? 'Meine Runde' : 'Meine Runden',
          flag: stale ? `${stale} ohne kommende Termine` : '',
          stat: rd ? plural(mine.length, 'Runde', 'Runden') : none,
          /* Wer nicht alle Runden darf, kann keine neue anlegen; Schnellzugriff dann auf die einzige eigene */
          ...(A.canAllRunden()
            ? { addHref: 'runden.html?neu=1', addLabel: 'Neue Runde' }
            : { addHref: mine.length === 1 ? `runden.html?bearbeiten=${encodeURIComponent(mine[0].id)}` : 'runden.html', addLabel: 'Bearbeiten', addIcon: 'edit' })
        }),
        can('kontakt') && row({
          href: 'kontakt.html', ico: 'phone', title: 'Pfarrkanzlei &amp; Kontakt',
          stat: 'Öffnungszeiten, Telefon, E-Mail', addHref: 'kontakt.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        }),
        can('rundgang') && row({
          href: 'rundgang.html', ico: 'image', title: 'Kirchenrundgang',
          stat: rg ? plural(count(rg.bilder), 'Bild', 'Bilder') : none,
          addHref: 'rundgang.html?neu=1', addLabel: 'Neues Bild'
        }),
        can('pgr') && row({
          href: 'pgr.html', ico: 'users', title: 'Pfarrgemeinderat',
          stat: pg ? plural(count(pg.mitglieder) + count(pg.weitere), 'Person', 'Personen') : none,
          addHref: 'pgr.html?neu=1', addLabel: 'Neue Person'
        }),
        can('predigten') && row({
          href: 'predigten.html', ico: 'quote', title: 'Predigten und Ansprachen',
          stat: pr ? plural(count(pr.predigten), 'Beitrag', 'Beiträge') : none,
          addHref: 'predigten.html?neu=1', addLabel: 'Neuer Beitrag'
        }),
        can('mitbrueder') && row({
          href: 'personen.html?bereich=kloster', ico: 'user', title: 'Mitbrüder',
          stat: ps ? plural(people(['mitbrueder']), 'Mitbruder', 'Mitbrüder') : none,
          addHref: 'personen.html?bereich=kloster&neu=1', addLabel: 'Neuer Mitbruder'
        })
      ]],
      ['Kirchenmusik', [
        can('solisten') && row({
          href: 'solisten.html', ico: 'mic', title: 'Solisten', flag: noPhoto ? `${noPhoto} ohne Foto` : '',
          stat: sol ? plural(sol.length, 'Solist', 'Solisten') : none,
          addHref: 'solisten.html?neu=1', addLabel: 'Neuer Solist'
        }),
        can('repertoire') && row({
          href: 'repertoire.html', ico: 'book', title: 'Repertoire',
          stat: rp ? plural((rp.komponisten || []).reduce((n, k) => n + count(k.werke), 0), 'Werk', 'Werke') : none,
          addHref: 'repertoire.html?neu=1', addLabel: 'Neuer Komponist'
        }),
        can('musik-personen') && row({
          href: 'personen.html?bereich=musik', ico: 'user', title: 'Leitung &amp; Organisten',
          stat: ps ? plural(people(['leitung', 'gastdirigenten', 'organisten']), 'Person', 'Personen') : none,
          addHref: 'personen.html?bereich=musik&neu=1', addLabel: 'Neue Person'
        }),
        can('paten') && row({
          href: 'paten.html', ico: 'heart', title: 'Paten &amp; Ehrenpaten',
          stat: pt ? `${plural(count(pt.paten), 'Pate', 'Paten')} · ${plural(count(pt.ehrenpaten), 'Ehrenpate', 'Ehrenpaten')}` : none,
          addHref: 'paten.html?neu=1', addLabel: 'Neuer Pate'
        }),
        can('paten') && row({
          href: 'spenden.html', ico: 'heart', title: 'Spenden &amp; Möglichkeiten',
          stat: pt ? `${plural(count(pt.stufen), 'Möglichkeit', 'Möglichkeiten')}${pt.paypal ? ' · PayPal' : ''}` : none
        }),
        can('cds') && row({
          href: 'cds.html', ico: 'disc', title: 'CDs', flag: noCover ? `${noCover} ohne Cover` : '',
          stat: cdN !== null ? plural(cdN, 'CD', 'CDs') : none,
          addHref: 'cds.html?neu=1', addLabel: 'Neue CD'
        }),
        can('galerie') && row({
          href: 'galerie.html', ico: 'image', title: 'Galerie',
          stat: ga ? plural(count(ga.alben), 'Album', 'Alben') : none,
          addHref: 'galerie.html?neu=1', addLabel: 'Neues Album'
        })
      ]],
      ['Pfarre Aspersdorf', [
        can('asp-personen') && row({
          href: 'personen.html?bereich=aspersdorf', ico: 'user', title: 'Leitung',
          stat: ps ? plural(people(['asp-leitung']), 'Person', 'Personen') : none,
          addHref: 'personen.html?bereich=aspersdorf&neu=1', addLabel: 'Neue Person'
        }),
        can('asp-gremien') && row({
          href: 'aspersdorf-gremien.html', ico: 'users', title: 'Pfarrgemeinderat &amp; Vermögensverwaltungsrat',
          stat: pa ? plural(count(pa.mitglieder) + count(pa.vwr), 'Person', 'Personen') : none,
          addHref: 'aspersdorf-gremien.html?neu=1', addLabel: 'Neue Person'
        }),
        can('asp-wochen') && row({
          href: 'aspersdorf-wochen.html', ico: 'calendarWeek', title: 'Wochenblätter (PDF)', flag: weekOld,
          stat: wo ? plural(count(wo.wochen), 'Wochenblatt', 'Wochenblätter') : none,
          addHref: 'aspersdorf-wochen.html?neu=1', addLabel: 'Neues Wochenblatt'
        }),
        can('asp-friedhof') && row({
          href: 'aspersdorf-friedhof.html', ico: 'book', title: 'Friedhofsgebühren',
          stat: fh ? plural(count(fh.tabellen), 'Tabelle', 'Tabellen') : none,
          addHref: 'aspersdorf-friedhof.html?neu=1', addLabel: 'Neue Tabelle'
        })
      ]],
      ['Website', [
        can('startseite') && row({
          href: 'startseite.html', ico: 'image', title: 'Titelfotos',
          stat: st ? plural(count(st.bilder), 'Titelfoto', 'Titelfotos') : none,
          addHref: 'startseite.html?neu=1', addLabel: 'Fotos hinzufügen'
        }),
        can('hinweise') && row({
          href: 'hinweise.html', ico: 'alert', title: 'Hinweisbanner',
          stat: hw ? (live(hw.hinweise) ? `${plural(live(hw.hinweise), 'Hinweis', 'Hinweise')} sichtbar` : 'Gerade kein Hinweis sichtbar') : none,
          addHref: 'hinweise.html?neu=1', addLabel: 'Neuer Hinweis'
        }),
        can('sprueche') && row({
          href: 'sprueche.html', ico: 'quote', title: 'Sprüche',
          stat: sp ? plural(count(sp.sprueche), 'Spruch', 'Sprüche') : none,
          addHref: 'sprueche.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        }),
        can('design') && row({
          href: 'design.html', ico: 'palette', title: 'Farben &amp; Logo',
          stat: 'Titelzeile je Hauptseite', addHref: 'design.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        }),
        can('navigation') && row({
          href: 'navigation.html', ico: 'menu', title: 'Menü &amp; Leiste',
          stat: 'Bereiche in Leiste und Menü', addHref: 'navigation.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        }),
        can('rechtliches') && row({
          href: 'rechtliches.html', ico: 'shield', title: 'Impressum &amp; Datenschutz',
          flag: openLegal ? `${plural(openLegal, 'Stelle', 'Stellen')} noch offen` : '',
          stat: re ? (openLegal ? 'Noch nicht vollständig' : 'Vollständig') : none,
          addHref: 'rechtliches.html', addLabel: 'Bearbeiten', addIcon: 'edit'
        })
      ]],
      ['Verwaltung', [
        A.isAdmin() && row({
          href: 'zugaenge.html', ico: 'key', title: 'Zugänge',
          stat: acc ? plural(acc.length, 'Zugang', 'Zugänge') : none,
          addHref: 'zugaenge.html?neu=1', addLabel: 'Neuer Zugang'
        }),
        A.isDev() && row({
          href: 'aenderungen.html', ico: 'history', title: 'Änderungen',
          stat: 'Wer hat wann was geändert', addHref: 'aenderungen.html', addLabel: 'Ansehen', addIcon: 'eye'
        }),
        A.isDev() && row({
          href: 'mitteilungen.html', ico: 'info', title: 'Mitteilungen',
          stat: mt ? (live(mt.mitteilungen) ? `${plural(live(mt.mitteilungen), 'Mitteilung', 'Mitteilungen')} aktiv` : 'Gerade keine aktiv') : 'Gerade keine aktiv',
          addHref: 'mitteilungen.html?neu=1', addLabel: 'Neue Mitteilung'
        })
      ]]
    ];
    $('ov-areas').innerHTML = groups
      .map(([title, rows]) => [title, rows.filter(Boolean)])
      .filter(([, rows]) => rows.length)
      .map(([title, rows]) =>
        `<section class="adm-areagroup" aria-label="${esc(title)}"><h3 class="adm-areagroup-h">${esc(title)}</h3>` +
        `<ul class="adm-areas">${rows.join('')}</ul></section>`)
      .join('');
  }

  /* Schnellzugriff im Seitenkopf: das, was am haeufigsten neu angelegt wird */
  function renderQuick() {
    const quick = [
      A.can('neuigkeiten') && ['neuigkeiten.html?neu=1', 'Neue Meldung'],
      A.can('hochaemter') && ['hochaemter.html?neu=1', 'Neues Hochamt'],
      A.can('termine') && ['termine.html?neu=1', 'Neuer Termin']
    ].filter(Boolean);
    $('ov-quick').innerHTML = quick.map(([href, label], i) =>
      `<a class="btn ${i ? 'btn-quiet' : 'btn-gold'}" href="${href}">${icon('plus')}${label}</a>`).join('');
    $('ov-quick').hidden = !quick.length;
  }

  /* Zuletzt geaendert: nur, was die angemeldete Person selbst geaendert hat. Mit Projektordner
     oder Server aus dem gemeinsamen Protokoll (alle Geraete), dazu das Protokoll dieses Geraets
     (dort stehen Aenderungen auch ohne Ordner); nach Tagen gruppiert, die letzten 10,
     je Eintrag aufklappbar, was sich genau geaendert hat */
  const LOG_MAX = 10;
  async function renderLog() {
    const me = A.session();
    const mine = (e) => e && (e.benutzer ? e.benutzer === me.benutzer : e.wer === me.name);
    const { list: shared } = await A.readProtocol();
    const seen = new Set();
    const list = [...(shared || []), ...A.recentLog()]
      .filter(mine)
      .filter((e) => {
        const key = `${e.zeit}|${e.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((x, y) => new Date(y.zeit) - new Date(x.zeit))
      .slice(0, LOG_MAX);
    const panel = $('ov-log-h').closest('section');
    panel.hidden = !list.length;
    if (!list.length) return;
    $('ov-log-sub').textContent = shared
      ? 'Was du zuletzt geändert hast, auf allen Geräten.'
      : 'Was du zuletzt auf diesem Gerät geändert hast.';
    /* '' bei ungueltigem Datum (toISOString wuerde werfen) */
    const isoOrEmpty = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
    const dayKey = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : A.isoOf(d); };
    const today = A.isoToday();
    const yesterday = (() => { const t = HD.today(); t.setDate(t.getDate() - 1); return A.isoOf(t); })();
    const dayLabel = (k) => (!k ? 'Ohne Datum' : k === today ? 'Heute' : k === yesterday ? 'Gestern' : A.fmtShort(k));
    const time = (t) => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }); };
    const days = [];
    for (const e of list) {
      const k = dayKey(e.zeit);
      if (!days.length || days[days.length - 1][0] !== k) days.push([k, []]);
      days[days.length - 1][1].push(e);
    }
    $('ov-log').innerHTML = days.map(([k, entries]) => `<h3 class="adm-log-day">${esc(dayLabel(k))}</h3><ul class="adm-log">${entries.map((e) => {
      const det = Array.isArray(e.details) ? e.details : [];
      return `<li><time datetime="${esc(isoOrEmpty(e.zeit))}">${esc(time(e.zeit))}</time><span>${esc(e.text)}` +
        (det.length ? `<details class="adm-log-det"><summary>${plural(det.length, 'Änderung', 'Änderungen')}</summary><ul>${det.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '') +
        '</span></li>';
    }).join('')}</ul>`).join('') +
      (A.isDev() ? '<p class="adm-log-all"><a href="aenderungen.html">Alle Änderungen von allen ansehen</a></p>' : '');
  }

  function renderTodo({ ha, sol, rd, wk, news }) {
    const items = [];
    /* Entwuerfe warten auf Freigabe oder Fertigstellung */
    const drafts = A.can('neuigkeiten') && news ? news.filter((e) => /^ja$/i.test(e.Entwurf || '')).length : 0;
    if (drafts) {
      items.push({
        href: 'neuigkeiten.html', ico: 'news',
        title: `${plural(drafts, 'Meldung ist', 'Meldungen sind')} noch ein Entwurf`,
        sub: A.isAdmin() ? 'Auf der Website nicht sichtbar. Prüfen und freigeben?' : 'Auf der Website nicht sichtbar, bis ein Admin sie freigibt.',
        go: 'Ansehen'
      });
    }
    /* Meldungen ohne Enddatum sind kein Fehler: sie gelten zwei Wochen (HD.newsUntil) */
    /* Runden mit Terminen, die alle vorbei sind */
    for (const r of A.canAnyRunde() ? staleRunden(rd) : []) {
      items.push({
        href: `runden.html?bearbeiten=${encodeURIComponent(r.id)}`, ico: 'calendar',
        title: r.titel, sub: 'Alle Termine sind vorbei. Neue Termine eintragen?', go: 'Ergänzen'
      });
    }
    const wkFlag = A.can('wochenkalender') ? weekFlag(wk) : '';
    if (wkFlag) {
      items.push({ href: 'wochenkalender.html', ico: 'calendarWeek', title: 'Wochenkalender', sub: `${wkFlag}. Die nächsten Tage eintragen?`, go: 'Eintragen' });
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
    /* Ohne Recht fuer diese Bereiche gibt es nichts, was offen sein koennte */
    const panel = $('ov-todo-h').closest('section');
    panel.hidden = !(A.can('hochaemter') || A.can('solisten') || A.can('wochenkalender') || A.canAnyRunde() || drafts);
    $('ov-todo').innerHTML = items.length
      ? `<ul class="adm-todo">${items.map((it) =>
        `<li><a href="${it.href}">${icon(it.ico)}<span><span class="adm-todo-title">${esc(it.title)}</span>` +
        `<span class="adm-todo-sub">${esc(it.sub)}</span></span><span class="adm-todo-go">${it.go} &rarr;</span></a></li>`).join('')}</ul>`
      : `<p class="adm-allgood">${icon('checkCircle')}Alles vollständig für die nächsten ${SOON_DAYS / 7} Wochen.</p>`;
    if (!ha && A.can('hochaemter')) $('ov-todo').insertAdjacentHTML('afterbegin', '<p class="adm-muted">Die Hochämter konnten nicht geladen werden.</p>');
    $('ov-todo-n').textContent = items.length ? String(items.length) : '';
    return panel.hidden ? null : items.length;
  }

  /* Auf einen Blick: vier Kacheln mit den wichtigsten Zahlen (nur, was die Person bearbeiten darf) */
  function renderStats({ ha, news, sol, pt, rd }, open) {
    const tiles = [];
    const upcoming = ha ? HD.splitByDate(ha).upcoming : [];
    if (ha && A.can('hochaemter')) {
      const limit = HD.today();
      limit.setDate(limit.getDate() + SOON_DAYS);
      const soon = upcoming.filter((e) => e.dateObj <= limit).length;
      tiles.push({ href: 'hochaemter.html', ico: 'calendar', label: `Nächste ${SOON_DAYS / 7} Wochen`, value: String(soon), sub: soon === 1 ? 'Hochamt oder Konzert' : 'Hochämter und Konzerte' });
    }
    if (news && A.can('neuigkeiten')) {
      const hidden = news.filter((e) => A.newsHidden(e));
      const drafts = hidden.filter((e) => /^ja$/i.test(e.Entwurf || '')).length;
      const planned = hidden.length - drafts;
      const extra = [drafts ? plural(drafts, 'Entwurf', 'Entwürfe') : '', planned ? `${planned} geplant` : ''].filter(Boolean).join(' · ');
      tiles.unshift({ href: 'neuigkeiten.html', ico: 'news', label: 'Auf der Startseite', value: String(A.newsOnHome(news).size), sub: extra || `von ${plural(news.length, 'Meldung', 'Meldungen')}` });
    }
    if (sol && A.can('solisten')) {
      const noPhoto = sol.filter((p) => !p.image).length;
      tiles.push({ href: 'solisten.html', value: String(sol.length), label: 'Solisten', sub: noPhoto ? `${noPhoto} ohne Foto` : 'alle mit Foto' });
    }
    if (pt && A.can('paten')) {
      tiles.push({ href: 'paten.html', value: String((pt.paten || []).length), label: 'Paten', sub: plural((pt.ehrenpaten || []).length, 'Ehrenpate', 'Ehrenpaten') });
    }
    const myRunden = (rd || []).filter((r) => A.canRunde(r.id));
    if (rd && A.canAnyRunde()) {
      tiles.push({ href: 'runden.html', value: String(myRunden.length), label: A.canAllRunden() ? 'Runden' : 'Meine Runden', sub: 'in St. Augustin' });
    }
    const box = $('ov-stats');
    box.hidden = !tiles.length;
    box.innerHTML = tiles.map((t) =>
      `<a class="ov-stat" href="${t.href}"><span class="ov-stat-value">${esc(t.value)}</span>` +
        `<span class="ov-stat-text"><b>${esc(t.label)}</b><span>${esc(t.sub)}</span></span></a>`).join('');
  }

  /* Anschlagtafel: das naechste Hochamt gross, darunter die drei danach.
     Fehlende Angaben stehen gleich dabei. */
  function renderBoard({ ha }) {
    const box = $('ov-board');
    if (!A.can('hochaemter') || !ha) {
      box.hidden = true;
      return;
    }
    const { upcoming } = HD.splitByDate(ha);
    const next = upcoming[0];
    box.hidden = false;
    if (!next) {
      box.innerHTML = '<div class="ov-board-main"><p class="ov-board-kicker">Nächstes Hochamt</p>' +
        '<p class="ov-board-title">Noch kein Termin eingetragen</p>' +
        `<a class="ov-board-btn" href="hochaemter.html?neu=1">${icon('plus')}Neues Hochamt</a></div>`;
      return;
    }
    const days = Math.round((next.dateObj - HD.today()) / 86400000);
    const when = days <= 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`;
    const wd = next.dateObj.toLocaleDateString('de-AT', { weekday: 'long' });
    const miss = A.missingInfo(next);
    const who = [['Zelebrant', next.celebrant], ['Dirigent', next.conductor], ['Organist', next.organist]].filter(([, v]) => v);
    const later = upcoming.slice(1, 4).map((e) =>
      `<li><a href="hochaemter.html?bearbeiten=${encodeURIComponent(e.id)}"><span class="ov-slot-day">${e.date.slice(8, 10)}</span>` +
      `<span class="ov-slot-txt"><b>${esc(e.piece || e.type)}</b><span>${esc(HD.MONTHS_SHORT[e.dateObj.getMonth()])}, ${esc(e.time)}</span></span></a></li>`).join('');
    box.innerHTML =
      '<div class="ov-board-main">' +
        `<p class="ov-board-kicker">Nächstes Hochamt, ${when}</p>` +
        '<div class="ov-board-date">' +
          `<span class="ov-board-day">${next.date.slice(8, 10)}</span>` +
          `<span class="ov-board-md"><b>${esc(HD.MONTHS[next.dateObj.getMonth()])}</b><span>${esc(wd)}, ${esc(next.time)} Uhr</span></span>` +
        '</div>' +
        (next.piece && next.piece !== next.type
          ? `<p class="ov-board-title">${esc(next.type)}</p><h2 class="ov-board-piece">${esc(next.piece)}</h2>`
          : `<h2 class="ov-board-piece">${esc(next.type)}</h2>`) +
        (who.length ? `<p class="ov-board-who">${who.map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`).join('')}</p>` : '') +
        (miss.length ? `<p class="ov-board-miss">${icon('alert')}Es fehlt: ${esc(miss.join(', '))}</p>` : '') +
        `<a class="ov-board-btn" href="hochaemter.html?bearbeiten=${encodeURIComponent(next.id)}">${icon('edit')}Bearbeiten</a>` +
      '</div>' +
      (later ? `<div class="ov-board-next"><p class="ov-board-kicker">Danach</p><ul>${later}</ul></div>` : '');
  }

  async function refresh() {
    const data = await loadAll();
    renderBoard(data);
    renderStats(data, renderTodo(data));
    renderAreas(data);
    await renderLog();
  }

  A.start(async () => {
    greet(A.session());
    renderQuick();
    const hinweis = new URLSearchParams(location.search).get('hinweis');
    if (hinweis === 'nur-admin' || hinweis === 'kein-recht') {
      A.toast(hinweis === 'nur-admin' ? 'Die Zugänge kann nur ein Admin verwalten.' : 'Dafür hast du keine Berechtigung.', 'err');
      history.replaceState(null, '', location.pathname);
    }
    await refresh();
    A.folder.on((state) => { if (state === 'ok') refresh(); });
  });

  function greet(s) {
    /* Titel (Pater, Dr. ...) bleiben stehen, dazu der Vorname: "Guten Abend, Pater Matthias" */
    const words = String(s.name || s.benutzer).trim().split(/\s+/);
    const isTitle = (w) => /^(pater|p\.|dr\.|mag\.|mmag\.|prof\.|dipl\.-ing\.|frau|herr|br\.|bruder|fr\.)$/i.test(w);
    let n = 0;
    while (n < words.length - 1 && isTitle(words[n])) n++;
    const first = words.slice(0, n + 1).join(' ');
    const hour = new Date().getHours();
    $('ov-greet').innerHTML = `${hour < 11 ? 'Guten Morgen' : hour >= 18 ? 'Guten Abend' : 'Grüß Gott'}, <em>${esc(first)}</em>`;
    $('ov-today').textContent = `${A.fmtDate(A.isoToday())}`;
  }
})();
