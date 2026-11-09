/* ============================================================
   Augustinerkirche Wien — admin-neuigkeiten.js
   Neuigkeiten pflegen (admin/neuigkeiten.html), Quelle ist
   data/news.csv. Meldungen anlegen, bearbeiten und loeschen,
   samt Plakat oder Foto:
   - Bild per Ziehen und Ablegen oder Auswahl; WebP bleibt, andere
     Formate werden in voller Groesse in WebP umgewandelt
   - jede Meldung hat einen eigenen Ordner assets/img/news/JAHR/<Kennung>/ fuer Bild und
     Fotos (Videos: assets/video/news/JAHR/<Kennung>/); was entfernt oder ersetzt wird und
     nirgends mehr vorkommt, wird beim Speichern wirklich geloescht, samt leerem Ordner
   - Vorschau der Karte, wie sie auf der Startseite erscheint
   - Fotos als Bildergalerie (bei "Bericht" bis zu 30, sonst bis zu 5) und Videos (MP4/WebM):
     Uebersicht data/neuigkeiten/index.json, je Meldung data/neuigkeiten/<Kennung>.json mit
     Beschreibung und Bildnachweis je Foto. Ohne eigenes Bild zeigt die Karte das erste Foto.
   - Bildnachweis des Bildes (Plakat/Foto der Karte) in der Spalte "Bildnachweis" der Tabelle
   - Schaltflaeche im Fenster: Ziel aus Listen waehlen (Hochamt oder
     Konzert, Runde, Seite der Website, andere Website) statt Adresse;
     liegt am Enddatum ein Termin, wird er zum Verknuepfen vorgeschlagen
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/news.csv';
  const TEASER_MAX = 160;

  let entries = [];       /* neueste zuerst, Schluessel wie die Spalten der Tabelle */
  let query = '';
  let editIndex = -1;     /* -1 = neue Meldung */
  let image = null;       /* neu gewaehltes Bild {blob, ext, url, converted, name} */
  let current = '';       /* bisheriges Bild der Meldung (Pfad) */
  let removeImage = false;
  let snap = '';
  let infos = null;

  /* Bildergalerie und Videos der Meldung (Aufbau siehe "Fenster: Fotos" unten) */
  const INDEX_PATH = 'data/neuigkeiten/index.json';
  const DETAIL_DIR = 'data/neuigkeiten/';
  const LEGACY_PHOTOS = 'data/news-fotos.json';
  const LEGACY_VIDEOS = 'data/news-videos.json';
  const MAX_REPORT = 30;   /* Kategorie "Bericht" */
  const MAX_PHOTOS = 5;    /* alle anderen Meldungen */
  let newsIndex = {};      /* Kennung -> {fotos, videos, titelbild} */
  let legacy = null;       /* alte Sammeldateien, solange nicht uebernommen */
  let indexBroken = false;
  let detailBroken = false;
  let photos = [];         /* Fotos im Fenster {key, path, thumb, url, ext, w, h, alt, credit, fresh} */
  let vids = [];           /* Videos im Fenster {key, path, titel, file}; file nur bei neu gewaehlten */
  let savedDetail = { fotos: [], videos: [] };
  let removedMedia = [];   /* Dateien (Fotos, Videos, Bild), die beim Speichern geloescht werden */
  let photosLoading = false;
  let photosReady = Promise.resolve();
  let uploading = Promise.resolve();
  let mediaChain = Promise.resolve();
  let dialogToken = 0;
  let photoSeq = 0;
  let vidSeq = 0;
  let photoDir = '';       /* eigener Ordner dieser Meldung */

  /* | trennt in der Tabelle mehrere Eintraege einer Zelle */
  const clean = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const isoToDe = (iso) => iso.split('-').reverse().join('.');
  const fileSlug = (s) => HD.slug(s, 50) || 'bild';
  const imgOf = (e) => e.Plakat || e.Vorschaubild;
  const newsId = (e) => `${HD.isoDate(e.Datum)}-${HD.slug(e.Titel)}`;
  const kind = () => (document.querySelector('input[name="kind"]:checked') || {}).value || 'poster';
  const toCSV = (list) => HD.csvText([A.NEWS_HEAD, ...list.map((o) => A.NEWS_HEAD.map((h) => o[h]))]);
  /* Die Reihenfolge der Tabelle ist die auf der Website. Eine neue Meldung (oder eine mit
     geaendertem Datum) wird nach Datum eingereiht: vor die erste aeltere, am selben Tag
     ganz oben. Danach laesst sie sich mit den Pfeilen verschieben. */
  function placeEntry(list, e, oldIndex = -1, keep = false) {
    if (oldIndex >= 0 && keep) {
      list[oldIndex] = e;
      return;
    }
    if (oldIndex >= 0) list.splice(oldIndex, 1);
    const iso = HD.isoDate(e.Datum);
    const at = list.findIndex((x) => HD.isoDate(x.Datum) <= iso);
    list.splice(at < 0 ? list.length : at, 0, e);
  }
  /* Ohne Enddatum zaehlen zwei Wochen ab dem spaeteren von Datum und "Sichtbar ab" */
  const untilBase = (iso) => {
    const ab = HD.isoDate($('f-ab').value);
    return ab && ab > iso ? ab : iso;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Ziel der Schaltflaeche ---------- */
  const HA_PREFIX = 'pages/hochamt.html?id=';
  /* Seiten der Website: [Adresse, Name in der Auswahl, Text der Schaltflaeche] */
  const PAGES = [
    ['Gottesdienste', [
      ['pages/augustinerkirche.html#p-zeiten', 'Gottesdienste: Liturgie-Zeiten', 'Zu den Gottesdiensten'],
      ['pages/kalender.html#woche', 'Kalender: Wochenüberblick', 'Zum Wochenüberblick'],
      ['pages/augustinerkirche.html#p-runden', 'Runden in St. Augustin (Übersicht)', 'Zu den Runden'],
      ['pages/augustinerkirche.html#p-sakramente', 'Sakramente', 'Zu den Sakramenten']]],
    ['Kirchenmusik', [
      ['pages/musik.html#p-hochaemter', 'Hochämter: alle Termine', 'Alle Hochämter ansehen'],
      ['pages/musik.html#p-hochaemter-archiv', 'Hochämter-Archiv', 'Zum Hochämter-Archiv'],
      ['pages/musik.html#p-chor', 'Chor von St. Augustin', 'Zum Chor'],
      ['pages/musik.html#p-kammerchor', 'Kammerchor', 'Zum Kammerchor'],
      ['pages/musik.html#p-repertoire', 'Repertoire des Chores', 'Zum Repertoire'],
      ['pages/musik.html#p-solisten', 'Solisten', 'Zu den Solisten'],
      ['pages/musik.html#p-orchester', 'Orchester', 'Zum Orchester'],
      ['pages/musik.html#p-patenschaft', 'Patenschaft St. Augustin', 'Zur Patenschaft'],
      ['pages/musik.html#p-paten', 'Paten von St. Augustin', 'Zu den Paten'],
      ['pages/musik.html#p-cds', 'CDs von St. Augustin', 'Zu den CDs']]],
    ['Augustinerkirche', [
      ['pages/augustinerkirche.html#p-geschichte', 'Geschichte', 'Zur Geschichte'],
      ['pages/augustinerkirche.html#p-herzgruft', 'Herzgruft', 'Zur Herzgruft'],
      ['pages/augustinerkirche.html#p-fuehrungen', 'Führungen', 'Zu den Führungen'],
      ['pages/augustiner.html#p-wien', 'Die Augustiner in Wien', 'Zu den Augustinern in Wien']]],
    ['Weitere', [
      ['pages/aspersdorf.html', 'Pfarre Aspersdorf', 'Nach Aspersdorf'],
      ['pages/archiv.html', 'Archiv der Neuigkeiten', 'Zum Archiv'],
      ['pages/kontakt.html', 'Kontakt', 'Zum Kontakt']]]
  ];
  const PAGE_LIST = PAGES.flatMap(([, list]) => list);

  let haEntries = [];      /* Hochaemter und Konzerte (normalisiert) */
  let rundenList = [];
  let autoText = '';       /* zuletzt automatisch eingesetzter Text der Schaltflaeche */
  let suggestOff = false;  /* Vorschlag fuer dieses Fenster abgelehnt */

  const rundeHref = (r) => r.link || r.seite || `pages/runden/runde.html?id=${encodeURIComponent(r.id)}`;
  const haLabel = (e) => `${A.fmtShort(e.date)}, ${e.time} · ${e.type}${e.piece && e.piece !== e.type ? ` · ${e.piece}` : ''}`;
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;

  async function loadTargets() {
    const [ha, rd] = await Promise.allSettled([
      A.readText('data/hochaemter.csv').then((t) => HD.rowsToRaw(HD.parseCSV(t)).map(HD.normalize).filter(Boolean).sort(HD.byDateTime)),
      A.readJSON('data/runden.json').then((d) => d.runden || [])
    ]);
    haEntries = ha.status === 'fulfilled' ? ha.value : [];
    rundenList = rd.status === 'fulfilled' ? rd.value : [];
  }

  /* Auswahllisten fuellen; die bisherige Adresse bleibt waehlbar, auch wenn
     sie in keiner Liste steht (vergangener Termin, eigene Adresse) */
  function fillTargets(link) {
    const today = A.isoToday();
    const current = link.startsWith(HA_PREFIX) ? decodeURIComponent(link.slice(HA_PREFIX.length)) : '';
    const months = new Map();
    for (const e of haEntries.filter((x) => x.date >= today || x.id === current)) {
      const key = `${HD.MONTHS[e.dateObj.getMonth()]} ${e.dateObj.getFullYear()}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(e);
    }
    $('f-ziel-hochamt').innerHTML = option('', 'Bitte wählen …') +
      (current && !haEntries.some((e) => e.id === current) ? option(current, `Termin ${current} (nicht mehr in der laufenden Liste)`) : '') +
      [...months].map(([m, list]) => `<optgroup label="${esc(m)}">${list.map((e) => option(e.id, haLabel(e))).join('')}</optgroup>`).join('');
    $('f-ziel-runde').innerHTML = option('', 'Bitte wählen …') +
      rundenList.filter((r) => r.sichtbar !== false || rundeHref(r) === link).map((r) => option(rundeHref(r), r.titel)).join('');
    const known = PAGE_LIST.some(([href]) => href === link);
    const own = link && !known && !current && !/^https?:/i.test(link) && !rundenList.some((r) => rundeHref(r) === link);
    $('f-ziel-seite').innerHTML = option('', 'Bitte wählen …') +
      (own ? option(link, `Bisherige Adresse: ${link}`) : '') +
      PAGES.map(([group, list]) => `<optgroup label="${esc(group)}">${list.map(([href, label]) => option(href, label)).join('')}</optgroup>`).join('');
  }

  function modeOf(link) {
    if (!link) return '';
    if (link.startsWith(HA_PREFIX)) return 'hochamt';
    if (rundenList.some((r) => rundeHref(r) === link)) return 'runde';
    if (/^https?:/i.test(link)) return 'extern';
    return 'seite';
  }
  function updateZiel() {
    const mode = $('f-ziel').value;
    document.querySelectorAll('[data-ziel]').forEach((el) => { el.hidden = el.dataset.ziel !== mode; });
    $('nv-linktext-field').hidden = !mode;
  }
  function defaultText() {
    switch ($('f-ziel').value) {
      case 'hochamt': return 'Zum Programm';
      case 'runde': {
        const r = rundenList.find((x) => rundeHref(x) === $('f-ziel-runde').value);
        return r ? `Zur Runde ${r.titel}` : 'Zur Runde';
      }
      case 'seite': {
        const pg = PAGE_LIST.find(([href]) => href === $('f-ziel-seite').value);
        return pg ? pg[2] : 'Mehr erfahren';
      }
      case 'extern': return 'Zur Website';
      default: return '';
    }
  }
  /* Text vorschlagen, solange er nicht von Hand geaendert wurde; bei einem
     neuen Ziel (force) passt ein alter Text nicht mehr und wird ersetzt */
  function applyDefaultText(force) {
    const t = $('f-linktext');
    if (force || !t.value.trim() || t.value === autoText) {
      autoText = defaultText();
      t.value = autoText;
    }
  }
  function setTarget(link) {
    fillTargets(link);
    const mode = modeOf(link);
    $('f-ziel').value = mode;
    if (mode === 'hochamt') $('f-ziel-hochamt').value = decodeURIComponent(link.slice(HA_PREFIX.length));
    if (mode === 'runde') $('f-ziel-runde').value = link;
    if (mode === 'seite') $('f-ziel-seite').value = link;
    $('f-ziel-extern').value = mode === 'extern' ? link : '';
    updateZiel();
    autoText = $('f-linktext').value === defaultText() ? $('f-linktext').value : '';
  }
  /* Adresse aus der Auswahl; liefert {link} oder {error: [Feld, Text]} */
  function readLink() {
    const mode = $('f-ziel').value;
    const pick = (id, msg) => ($(id).value ? { link: $(id).value } : { error: [$(id), msg] });
    if (mode === 'hochamt') {
      const v = $('f-ziel-hochamt').value;
      return v ? { link: HA_PREFIX + v } : { error: [$('f-ziel-hochamt'), 'Bitte den Termin wählen.'] };
    }
    if (mode === 'runde') return pick('f-ziel-runde', 'Bitte die Runde wählen.');
    if (mode === 'seite') return pick('f-ziel-seite', 'Bitte die Seite wählen.');
    if (mode === 'extern') {
      const v = clean($('f-ziel-extern').value);
      if (!v) return { error: [$('f-ziel-extern'), 'Bitte die Adresse der Website eintragen.'] };
      const link = webAddress(v);
      return link ? { link } : { error: [$('f-ziel-extern'), 'Diese Adresse sieht nicht richtig aus, z. B. www.musikverein.at.'] };
    }
    return { link: '' };
  }
  /* Adresse einer anderen Website ("www.…" bekommt https://) oder Seite der
     Website (pages/…); '' wenn sie nicht stimmen kann */
  function webAddress(value) {
    let v = clean(value);
    if (/^(pages\/|index\.html)/.test(v)) return HD.safeUrl(v, '../') ? v : '';
    if (!/^[a-z][a-z\d+.-]*:/i.test(v)) v = `https://${v.replace(/^\/+/, '')}`;
    return HD.safeUrl(v) && /^(https?:\/\/[^/\s]+\.[^/\s]+|mailto:\S+@\S+)/i.test(v) ? v : '';
  }

  /* Vorschlag: Liegt am Enddatum ein Hochamt oder Konzert, gehoert das Plakat
     vermutlich dazu. Ein Klick verknuepft die Schaltflaeche mit dem Termin. */
  function renderSuggest() {
    const box = $('nv-suggest');
    const bis = HD.isoDate($('f-bis').value);
    /* Passendster Termin zuerst: die meisten gemeinsamen Woerter mit Titel und Kurztext */
    const words = new Set(`${$('f-title').value} ${$('f-teaser').value}`.toLowerCase().match(/[a-zäöüß]{4,}/g) || []);
    const score = (e) => (`${e.type} ${e.piece} ${e.location}`.toLowerCase().match(/[a-zäöüß]{4,}/g) || []).filter((w) => words.has(w)).length;
    const hits = (bis ? haEntries.filter((e) => e.date === bis) : []).sort((x, y) => score(y) - score(x));
    const linkedId = $('f-ziel').value === 'hochamt' ? $('f-ziel-hochamt').value : '';
    /* Verknuepft ist immer sichtbar (auch wenn der Termin nicht am Enddatum liegt) */
    const linked = haEntries.find((e) => e.id === linkedId);
    if (!linked && (!hits.length || suggestOff)) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = linked
      ? `<div class="adm-suggest ok"><b>${icon('checkCircle')}Verknüpft mit ${esc(haLabel(linked))}</b>` +
        '<div class="adm-suggest-row"><span>Die Schaltfläche führt zum Programm, das Plakat erscheint auch auf der Seite des Termins.</span>' +
        `<button type="button" class="btn btn-quiet btn-sm" data-unlink>${icon('close')}Verknüpfung aufheben</button></div></div>`
      : `<div class="adm-suggest"><b>${icon('info')}Gehört dieses Plakat zu einem Termin am ${esc(A.fmtDate(bis))}?</b>` +
        hits.map((e) => `<div class="adm-suggest-row"><span>${esc(haLabel(e))}</span>` +
          `<button type="button" class="btn btn-dark btn-sm" data-link-ha="${esc(e.id)}">${icon('check')}Verknüpfen</button></div>`).join('') +
        `<div><button type="button" class="adm-act" data-no-suggest>${icon('close')}Nein, gehört nicht dazu</button></div>` +
        '</div>';
  }
  /* Verknuepfung loesen: keine Schaltflaeche mehr, Vorschlag nicht gleich wieder zeigen */
  function unlink() {
    const wasLinked = $('f-ziel').value === 'hochamt';
    $('f-ziel').value = '';
    updateZiel();
    $('f-linktext').value = '';
    autoText = '';
    suggestOff = true;
    renderSuggest();
    A.toast(wasLinked ? 'Verknüpfung aufgehoben. Wirksam nach dem Speichern.' : 'Schaltfläche entfernt. Wirksam nach dem Speichern.');
    $('f-ziel').focus();
  }
  function linkHochamt(id) {
    fillTargets(HA_PREFIX + id);
    $('f-ziel').value = 'hochamt';
    $('f-ziel-hochamt').value = id;
    updateZiel();
    applyDefaultText(true);
    renderSuggest();
    const ok = $('nv-suggest').querySelector('.adm-suggest');
    if (ok) {
      ok.tabIndex = -1;
      ok.focus();
    }
  }

  /* ---------- Laden und Liste ---------- */
  async function load() {
    try {
      entries = A.parseNews(await A.readText(PATH));
    } catch (e) {
      $('nv-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Tabelle <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  /* Wo steht die Meldung? Startseite (abgelaufene nur zum Auffuellen, unten),
     abgelaufen oder (zu alt) im Archiv */
  function placeOf(e, home) {
    const expired = A.newsExpired(e);
    if (home.has(e)) return expired ? 'home-expired' : 'home';
    return expired ? 'expired' : 'archive';
  }
  function rowHTML(e, i, home, searching) {
    const info = newsIndex[newsId(e)];
    const src = A.imageUrl(imgOf(e) || (info && info.titelbild));
    const thumb = src
      ? `<span class="adm-thumb${e.Plakat ? '' : ' photo'}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"/></span>`
      : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>';
    const place = placeOf(e, home);
    const draft = /^ja$/i.test(e.Entwurf || '');
    const badge = draft ? '<span class="adm-badge" title="Auf der Website nicht sichtbar">Entwurf</span>'
      : A.newsHidden(e) ? `<span class="adm-badge" title="Noch nicht sichtbar">Geplant ab ${esc(isoToDe(HD.isoDate(e.Ab)))}</span>`
      : place === 'home' ? '<span class="adm-badge on">Startseite</span>'
      : place === 'home-expired' ? `<span class="adm-badge on" title="Abgelaufen, füllt die Startseite unten auf, solange es weniger als ${A.NEWS_HOME} aktive Meldungen gibt">Startseite · abgelaufen</span>`
      : place === 'expired' ? '<span class="adm-badge">Abgelaufen · Archiv</span>'
      : !HD.newsOnPage(e.Seiten, 'startseite') ? '<span class="adm-badge on" title="Steht unter Aktuelles auf den gewählten Seiten">Aktuell</span>'
        : `<span class="adm-badge">Archiv ${esc(e.Datum.split('.')[2])}</span>`;
    return `<li class="adm-row" data-key="${esc(newsId(e))}">` +
      `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">${thumb}` +
        '<span class="adm-row-body">' +
          `<span class="adm-row-date">${esc(e.Datum)}${e.Bis ? ` · bis ${esc(e.Bis)}` : ''}${e.Kategorie ? ` · ${esc(e.Kategorie)}` : ''}</span>` +
          `<span class="adm-row-title">${esc(e.Titel)}</span>` +
          `<span class="adm-row-people">${esc(e.Kurztext)}</span>` +
          '<span class="adm-chips">' +
          (src ? '' : `<span class="adm-chip">${icon('image')}Ohne Bild: die Karte zeigt das Logo</span>`) +
          (info && info.fotos ? `<span class="adm-chip">${icon('image')}${plural(info.fotos, 'Foto', 'Fotos')} in der Galerie</span>` : '') +
          (info && info.videos ? `<span class="adm-chip">${plural(info.videos, 'Video', 'Videos')}</span>` : '') +
          (e.Seiten ? `<span class="adm-chip">Nur auf: ${esc(HD.newsPages(e.Seiten).map((k) => HD.NEWS_PAGES.find(([x]) => x === k)[1]).join(', '))}</span>` : '') +
          '</span>' +
        `</span>${badge}` +
      '</button>' +
      '<div class="adm-row-actions">' +
        /* Pfeile nur in der ganzen Liste (nicht in Suchtreffern) */
        (searching ? '' :
          `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(e.Titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(e.Titel)}" title="Nach unten"${i === entries.length - 1 ? ' disabled' : ''}>${icon('down')}</button>`) +
        /* Entwurf ein/aus; wer eine Freigabe braucht, kann nicht selbst veroeffentlichen */
        (A.needsApproval() ? '' : draft
          ? `<button type="button" class="adm-act icon" data-act="publish" data-i="${i}" aria-label="Veröffentlichen: ${esc(e.Titel)}" title="Entwurf: auf der Website verborgen. Klicken zum Veröffentlichen">${icon('eyeOff')}</button>`
          : `<button type="button" class="adm-act icon" data-act="draft" data-i="${i}" aria-label="Als Entwurf verbergen: ${esc(e.Titel)}" title="Sichtbar. Klicken, um sie als Entwurf zu verbergen">${icon('eye')}</button>`) +
        `<button type="button" class="adm-act icon" data-act="dup" data-i="${i}" aria-label="Duplizieren: ${esc(e.Titel)}" title="Duplizieren">${icon('copy')}</button>` +
        `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(e.Titel)}" title="Löschen">${icon('trash')}</button>` +
      '</div></li>';
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = entries.map((e, i) => ({ e, i })).filter(({ e }) => {
      if (!words.length) return true;
      const hay = [e.Datum, e.Kategorie, e.Titel, e.Kurztext, e.Infos, e.Details].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const home = A.newsOnHome(entries);
    $('nv-count').textContent = words.length
      ? `${plural(list.length, 'Treffer', 'Treffer')} für „${query.trim()}“`
      : `${plural(entries.length, 'Meldung', 'Meldungen')} · ${home.size} auf der Startseite`;
    if (!list.length) {
      $('nv-list').innerHTML = words.length
        ? `<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><p>Für „${esc(query.trim())}“ wurde nichts gefunden.</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>`
        : `<div class="adm-empty"><p class="adm-empty-title">Noch keine Meldungen</p><p>Lege die erste Meldung an.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Neue Meldung</button></div>`;
      return;
    }
    $('nv-list').innerHTML = '<ul class="adm-rows">' + list.map(({ e, i }) => rowHTML(e, i, home, words.length > 0)).join('') + '</ul>';
  }

  function flash(key, sel) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    (row.querySelector(sel || '.adm-row-open') || row.querySelector('.adm-row-open')).focus({ preventScroll: true });
  }

  /* Pfeile: Meldung mit der Nachbarin tauschen (Reihenfolge auf der Website) */
  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await A.saveFile(PATH, toCSV(next));
      entries = next;
      render();
      flash(newsId(next[j]), `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* Auge: Entwurf (verborgen) ein- oder ausschalten, ohne das Fenster zu oeffnen */
  async function setDraft(i, on) {
    const e = entries[i];
    const next = entries.slice();
    next[i] = { ...e, Entwurf: on ? 'ja' : '' };
    try {
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      render();
      flash(newsId(next[i]), `[data-act="${on ? 'publish' : 'draft'}"]`);
      const later = !on && A.newsHidden(next[i]);
      A.toast(!direct ? 'Übernommen. Bitte unten die Datei herunterladen.'
        : on ? `„${e.Titel}“ ist jetzt ein Entwurf und auf der Website verborgen.`
          : later ? `„${e.Titel}“ ist freigegeben und erscheint ab ${isoToDe(HD.isoDate(e.Ab))}.`
            : `„${e.Titel}“ ist jetzt auf der Website sichtbar.`);
      A.log(`Meldung ${on ? 'als Entwurf verborgen' : 'veröffentlicht'}: ${e.Titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Fenster: Bild ---------- */
  const imageSrc = () => (image ? image.url : (!removeImage && current ? A.imageUrl(current) : ''));
  /* Bild der Karte: eigenes Bild, sonst das erste Foto der Galerie */
  const cardSrc = () => imageSrc() || (photos[0] ? photos[0].url : '');

  function renderImage() {
    const src = imageSrc();
    $('nv-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des gewählten Bildes"/>` : '<span class="none">Noch kein Bild</span>';
    $('nv-imginfo').textContent = image
      ? `${image.name} · ${Math.round(image.blob.size / 1024)} KB${image.converted ? ' · in WebP umgewandelt, ohne Verkleinerung' : ''}`
      : src ? `Aktuelles Bild: ${current}. Nur ein neues wählen, wenn es ersetzt werden soll.` : '';
    const rm = $('nv-img-remove');
    rm.hidden = !src;
    rm.lastChild.textContent = image && current && !removeImage ? 'Neue Auswahl verwerfen' : 'Bild entfernen';
    $('nv-filename-field').hidden = !image;
  }

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file);
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob), name: file.name };
    removeImage = false;
    $('f-focus').value = '';
    if (!$('f-filename').dataset.touched) $('f-filename').value = fileSlug($('f-title').value || file.name.replace(/\.[^.]+$/, ''));
    renderImage();
    renderPreview();
  }

  function dropImage() {
    if (image) {
      URL.revokeObjectURL(image.url);
      image = null;
    } else {
      removeImage = true;
    }
    $('f-file').value = '';
    $('f-focus').value = '';
    renderImage();
    renderPreview();
  }

  /* ---------- Fenster: Fotos (Bildergalerie) und Videos ----------
     Geteilte Ablage (tools/daten-teilen.py):
       data/neuigkeiten/index.json      {meldungen: {Kennung: {fotos, videos, titelbild}}}  (fuer Karten und Listen)
       data/neuigkeiten/<Kennung>.json  {kennung, fotos: [{bild, vorschau, alt, nachweis, breite, hoehe}],
                                         videos: [{datei, titel}]}  (erst beim Oeffnen der Meldung)
     Jede Meldung hat einen eigenen Ordner assets/img/news/JAHR/<Kennung>/ (Plakat, Fotos foto-N.webp mit
     Vorschau foto-N-v.webp) und fuer Videos assets/video/news/JAHR/<Kennung>/. Entfernte Dateien
     verschwinden beim Speichern, eine geloeschte Meldung nimmt alles mit (Admin.media.remove).
     Gibt es nur die alten Sammeldateien (data/news-fotos.json, data/news-videos.json), werden sie
     beim ersten Speichern uebernommen und danach entfernt. */
  const isReport = () => $('f-report').checked;
  const photoLimit = () => (isReport() ? MAX_REPORT : MAX_PHOTOS);
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  const detailPath = (id) => `${DETAIL_DIR}${id}.json`;
  const OWN_DIR = /^assets\/(img|video)\/news\/\d{4}\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/$/;

  async function loadIndex() {
    indexBroken = false;
    try {
      newsIndex = (await A.readJSON(INDEX_PATH)).meldungen || {};
      legacy = null;
      return;
    } catch (e) {
      newsIndex = {};
      if (!notFound(e)) {
        indexBroken = true;
        A.toast('Die Übersicht der Fotos und Videos konnte nicht geladen werden. Fotos lassen sich erst nach dem Neuladen wieder speichern.', 'err');
        return;
      }
    }
    /* Noch die alten Sammeldateien? */
    legacy = { fotos: {}, videos: {} };
    try { legacy.fotos = (await A.readJSON(LEGACY_PHOTOS)).bilder || {}; } catch (e) { if (!notFound(e)) indexBroken = true; }
    try { legacy.videos = (await A.readJSON(LEGACY_VIDEOS)).videos || {}; } catch (e) { if (!notFound(e)) indexBroken = true; }
    for (const id of new Set([...Object.keys(legacy.fotos), ...Object.keys(legacy.videos)])) {
      const f = legacy.fotos[id] || [];
      const v = legacy.videos[id] || [];
      if (f.length || v.length) newsIndex[id] = { fotos: f.length, videos: v.length, titelbild: f[0] ? (f[0].vorschau || f[0].bild) : '' };
    }
  }
  /* Fotos und Videos einer Meldung */
  async function loadDetail(id) {
    if (!id) return { fotos: [], videos: [] };
    if (legacy) return { fotos: (legacy.fotos[id] || []).slice(), videos: (legacy.videos[id] || []).map((v) => ({ datei: v.datei, titel: v.titel })) };
    if (!newsIndex[id]) return { fotos: [], videos: [] };
    try {
      const d = await A.readJSON(detailPath(id));
      return { fotos: d.fotos || [], videos: d.videos || [] };
    } catch (e) {
      if (notFound(e)) return { fotos: [], videos: [] };
      throw e;
    }
  }
  function renderPhotos() {
    const limit = photoLimit();
    $('nv-photos').innerHTML = photosLoading ? `<p class="adm-hint">${icon('image')} Fotos werden geladen …</p>` : photos.map((p, i) =>
      `<div class="adm-ph" data-k="${p.key}">` +
        `<span class="adm-thumb photo" data-ph-grip title="Zum Verschieben ziehen" style="cursor:grab"><img src="${esc(p.url)}" alt="" loading="lazy" decoding="async"/></span>` +
        '<div class="adm-ph-fields">' +
          `<label class="adm-label" for="ph-alt-${p.key}">Beschreibung <span class="adm-opt">${i === 0 ? 'erstes Foto, ' : ''}steht unter dem Foto</span></label>` +
          `<input class="adm-input" type="text" id="ph-alt-${p.key}" data-ph="alt" value="${esc(p.alt)}" maxlength="200" placeholder="z. B. Gemeinsames Mittagessen im Klostergarten"/>` +
          `<label class="adm-label" for="ph-cr-${p.key}">Bildnachweis</label>` +
          `<input class="adm-input" type="text" id="ph-cr-${p.key}" data-ph="credit" value="${esc(p.credit)}" maxlength="200" placeholder="z. B. © Augustiner Wien, Foto: Max Muster"/>` +
          (i === 0 && photos.length > 1 ? '<button type="button" class="adm-act adm-ph-credit-all" data-ph-credit-all>Diesen Bildnachweis für alle Fotos übernehmen</button>' : '') +
        '</div>' +
        '<div class="adm-ph-act">' +
          `<span class="adm-ph-no" aria-hidden="true">${i + 1}</span>` +
          `<button type="button" class="adm-act icon" data-ph-act="up" aria-label="Foto ${i + 1} nach vorne"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-ph-act="down" aria-label="Foto ${i + 1} nach hinten"${i === photos.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act icon danger" data-ph-act="del" aria-label="Foto ${i + 1} entfernen">${icon('trash')}</button>` +
        '</div></div>'
    ).join('');
    const over = photos.length > limit;
    const count = $('nv-photo-count');
    count.textContent = `${plural(photos.length, 'Foto', 'Fotos')} von höchstens ${limit}` +
      (over ? `: bitte ${photos.length - limit} entfernen oder „Als Bericht kennzeichnen“ ankreuzen` : '');
    count.classList.toggle('over', over);
    $('nv-photo-drop').hidden = photosLoading || photos.length >= limit;
  }
  /* Eigener Ordner der Meldung: schon vorhandene Fotos, Videos oder Plakat geben ihn vor,
     sonst neu nach Datum und Titel (assets/img/news/JAHR/<Kennung>/) */
  function folderFor() {
    if (photoDir) return photoDir;
    const known = [...photos.map((p) => p.path), ...vids.map((v) => v.path.replace(/^assets\/video\//, 'assets/img/')), (!removeImage && current) || '']
      .map((p) => A.dirName(p)).find((d) => OWN_DIR.test(d) && d.startsWith('assets/img/'));
    if (known) {
      photoDir = known;
      return photoDir;
    }
    const iso = HD.isoDate($('f-date').value) || A.isoToday();
    photoDir = `assets/img/news/${iso.slice(0, 4)}/${iso}-${HD.slug($('f-title').value, 50) || 'meldung'}/`;
    return photoDir;
  }
  const videoFolder = () => folderFor().replace(/^assets\/img\//, 'assets/video/');
  const thumbOf = (path) => path.replace(/\.(webp|jpe?g|png)$/i, '-v.webp');
  /* Freier Name im Ordner: foto-1.webp, foto-2.webp … (auch gegenueber entfernten, noch nicht geloeschten) */
  async function freePhotoPath(dir, ext) {
    const taken = new Set([...photos.map((p) => p.path), ...removedMedia]);
    for (let n = 1; ; n++) {
      const path = `${dir}foto-${n}.${ext}`;
      if (!taken.has(path) && !(A.folder.state === 'ok' && await A.folder.exists(path))) return path;
    }
  }
  /* Vorschau (laengste Seite 640 px); null, wenn der Browser kein WebP erzeugen kann */
  async function makeThumb(blob) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const size = { w: bmp.width, h: bmp.height };
    if (bmp.close) bmp.close();
    const out = await new Promise((r) => c.toBlob(r, 'image/webp', 0.76));
    return { thumb: out && out.type === 'image/webp' ? out : null, ...size };
  }
  function progress(done, total, name) {
    const box = $('nv-ph-progress');
    if (!box) return;
    box.hidden = total === 0;
    if (!total) return;
    box.querySelector('.adm-progress-text').textContent = done < total
      ? `Foto ${done + 1} von ${total} wird verarbeitet: ${name}` : `${total} ${total === 1 ? 'Foto' : 'Fotos'} verarbeitet`;
    box.querySelector('progress').value = done;
    box.querySelector('progress').max = total;
  }
  /* Viele Fotos nacheinander (der Browser friert nicht ein), je Foto Grossfassung und Vorschau */
  function addPhotos(files) {
    let list = Array.from(files || []);
    $('nv-photo-file').value = '';
    const free = photoLimit() - photos.length;
    if (list.length > free) {
      A.toast(free > 0
        ? `Es passen nur noch ${plural(free, 'Foto', 'Fotos')} dazu (höchstens ${photoLimit()}${isReport() ? '' : ', als Bericht bis zu 30'}). Die übrigen wurden nicht übernommen.`
        : `Es sind schon ${photoLimit()} Fotos da${isReport() ? '' : '. Als Bericht sind bis zu 30 möglich'}.`, 'err');
      list = list.slice(0, Math.max(0, free));
    }
    if (!list.length) return uploading;
    uploading = uploading.then(() => runUpload(list));
    return uploading;
  }
  async function runUpload(list) {
    const token = dialogToken;
    const failed = [];
    let added = 0;
    $('nv-save').disabled = true;
    try {
      await photosReady;
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        if (token !== dialogToken) return;
        progress(i, list.length, file.name);
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.name)) {
          failed.push(`${file.name} (keine Bilddatei)`);
          continue;
        }
        const written = [];
        try {
          const big = await A.toWebp(file, { maxSize: 1920, quality: 0.82, silent: true });
          const { thumb, w, h } = await makeThumb(big.blob);
          const path = await freePhotoPath(folderFor(), big.ext);
          await A.saveFile(path, big.blob);
          written.push(path);
          let vorschau = '';
          if (thumb && thumb.size < big.blob.size) {
            vorschau = thumbOf(path);
            await A.saveFile(vorschau, thumb);
            written.push(vorschau);
          }
          if (token !== dialogToken) {
            for (const p of written) await A.discardFile(p);
            return;
          }
          photos.push({ key: `n${++photoSeq}`, path, thumb: vorschau, url: URL.createObjectURL(thumb || big.blob), ext: big.ext, w, h, alt: '', credit: '', fresh: true, size: big.blob.size });
          added++;
          renderPhotos();
          renderPreview();
        } catch (e) {
          for (const p of written) await A.discardFile(p).catch(() => {});
          failed.push(`${file.name}${e && e.message ? ` (${e.message})` : ''}`);
        }
      }
      progress(list.length, list.length, '');
    } finally {
      if (token === dialogToken) $('nv-save').disabled = false;
      setTimeout(() => progress(0, 0, ''), 2500);
    }
    if (added) A.toast(A.folder.state === 'ok' ? `${plural(added, 'Foto', 'Fotos')} hinzugefügt. Zum Übernehmen bitte speichern.` : `${plural(added, 'Foto', 'Fotos')} bereit. Nach dem Speichern bitte unten herunterladen.`);
    if (failed.length) A.toast(`${failed.length === 1 ? 'Eine Datei ließ' : `${failed.length} Dateien ließen`} sich nicht verarbeiten: ${failed.slice(0, 4).join(', ')}${failed.length > 4 ? ' …' : ''}`, 'err');
  }
  /* Fotos, die in diesem Fenster neu dazukamen und nicht uebernommen wurden, wieder loeschen */
  async function discardFresh(list) {
    for (const p of list) {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      if (!p.fresh) continue;
      await A.discardFile(p.path);
      if (p.thumb) await A.discardFile(p.thumb);
    }
  }
  /* Fotos und Videos einer Meldung ins Fenster holen (Detail-Datei erst jetzt) */
  function setMedia(id) {
    for (const p of photos) if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    photos = [];
    vids = [];
    removedMedia = [];
    savedDetail = { fotos: [], videos: [] };
    photoDir = '';
    photosLoading = !!id && !!newsIndex[id];
    const token = ++dialogToken;
    renderPhotos();
    renderVideos();
    photosReady = (async () => {
      let d = { fotos: [], videos: [] };
      try {
        d = await loadDetail(id);
      } catch (e) {
        detailBroken = true;
        A.toast(`Fotos und Videos dieser Meldung konnten nicht geladen werden (${e.message}). Bitte die Seite neu laden.`, 'err');
      }
      if (token !== dialogToken) return;
      const untouched = dirtyState() === snap;
      photos = d.fotos.filter((b) => b && b.bild).map((b) => ({
        key: `p${++photoSeq}`, path: b.bild, thumb: b.vorschau || '', url: A.imageUrl(b.vorschau || b.bild), ext: 'webp',
        w: b.breite || 0, h: b.hoehe || 0, alt: b.alt || '', credit: b.nachweis !== undefined ? b.nachweis : A.credits.get(b.bild)
      }));
      vids = d.videos.filter((v) => v && v.datei).map((v) => ({ key: `v${++vidSeq}`, path: v.datei, titel: v.titel || '', file: null }));
      savedDetail = detailOf();
      photosLoading = false;
      renderPhotos();
      renderVideos();
      renderPreview();
      if (untouched) snap = dirtyState();
      if (!$('nv-list').querySelector('.adm-alert')) render();
    })();
    return photosReady;
  }
  /* Stand fuer die Detail-Datei; Bildnachweis steht beim Foto */
  const detailOf = () => ({
    fotos: photos.map((p) => ({
      bild: p.path, ...(p.thumb ? { vorschau: p.thumb } : {}), alt: clean(p.alt),
      ...(clean(p.credit) ? { nachweis: clean(p.credit) } : {}), breite: p.w, hoehe: p.h
    })),
    videos: vids.map((v) => ({ datei: v.path, titel: clean(v.titel) || 'Video' }))
  });
  const indexEntry = (d) => ({ fotos: d.fotos.length, videos: d.videos.length, titelbild: d.fotos[0] ? (d.fotos[0].vorschau || d.fotos[0].bild) : '' });
  async function writeIndex(next) {
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    await A.saveJSON(INDEX_PATH, { meldungen: sorted });
    newsIndex = sorted;
  }
  /* Alte Sammeldateien in die geteilte Ablage uebernehmen, dann entfernen */
  async function migrateLegacy() {
    if (!legacy) return;
    const next = {};
    for (const id of new Set([...Object.keys(legacy.fotos), ...Object.keys(legacy.videos)])) {
      const fotos = (legacy.fotos[id] || []).filter((b) => b && b.bild).map((b) => {
        const c = A.credits.get(b.bild);
        return { ...b, ...(c && b.nachweis === undefined ? { nachweis: c } : {}) };
      });
      const videos = (legacy.videos[id] || []).filter((v) => v && v.datei);
      if (!fotos.length && !videos.length) continue;
      await A.saveJSON(detailPath(id), { kennung: id, fotos, videos });
      next[id] = indexEntry({ fotos, videos });
    }
    await writeIndex(next);
    await A.discardFile(LEGACY_PHOTOS);
    await A.discardFile(LEGACY_VIDEOS);
    legacy = null;
    A.log('Fotos und Videos der Neuigkeiten in die geteilte Ablage übernommen (data/neuigkeiten/)');
  }
  /* Detail und Uebersicht speichern (in einer Kette, damit sich zwei Speichervorgaenge nicht ueberschreiben) */
  function saveMedia(oldId, id) {
    mediaChain = mediaChain.catch(() => {}).then(() => saveMediaNow(oldId, id));
    return mediaChain;
  }
  async function saveMediaNow(oldId, id) {
    await photosReady;
    await uploading;
    if (indexBroken || detailBroken) throw new Error('Fotos und Videos ließen sich vorher nicht laden, deshalb wurden sie nicht gespeichert. Bitte die Seite neu laden.');
    await migrateLegacy();
    /* neue Videos jetzt in den Ordner der Meldung schreiben */
    for (const v of vids) {
      if (v.file) {
        await A.saveFile(v.path, v.file);
        v.file = null;
      }
    }
    const d = detailOf();
    const moved = !!oldId && oldId !== id;
    const has = d.fotos.length || d.videos.length;
    if (JSON.stringify(d) !== JSON.stringify(savedDetail) || moved) {
      if (has) await A.saveJSON(detailPath(id), { kennung: id, ...d });
      else if (newsIndex[id]) await A.discardFile(detailPath(id));
      if (moved && newsIndex[oldId]) await A.discardFile(detailPath(oldId));
      const next = { ...newsIndex };
      if (moved) delete next[oldId];
      if (has) next[id] = indexEntry(d);
      else delete next[id];
      if (JSON.stringify(next) !== JSON.stringify(newsIndex)) await writeIndex(next);
    }
    /* Nachweise alter Art (data/bildnachweise.json) dieser Fotos dort entfernen: sie stehen jetzt beim Foto */
    const oldCredits = Object.fromEntries(photos.filter((p) => A.credits.get(p.path)).map((p) => [p.path, '']));
    if (Object.keys(oldCredits).length) await A.credits.save(oldCredits);
    for (const p of photos) p.fresh = false;
    savedDetail = d;
    return d;
  }

  /* ---------- Videos ---------- */
  function renderVideos() {
    $('nv-videos').innerHTML = vids.map((v) =>
      `<div class="adm-ph" data-k="${v.key}">` +
        `<div class="adm-ph-fields"><label class="adm-label" for="vd-${v.key}">Titel des Videos <span class="adm-opt">${esc(A.fileName(v.path))}${v.file ? ' · neu, ' + Math.round(v.file.size / 1048576) + ' MB' : ''}</span></label>` +
        `<input class="adm-input" type="text" id="vd-${v.key}" data-vd="titel" value="${esc(v.titel)}" placeholder="z. B. Einzug der Ministranten"/></div>` +
        `<div class="adm-ph-act"><button type="button" class="adm-act icon danger" data-vd-act="del" aria-label="Video entfernen">${icon('trash')}</button></div></div>`
    ).join('');
  }
  async function addVideos(files) {
    for (const picked of Array.from(files || [])) {
      const ok = await A.checkVideo(picked);
      if (!ok) continue;
      const base = `${videoFolder()}${HD.slug(ok.file.name.replace(/\.[^.]+$/, ''), 50) || 'video'}`;
      let path = `${base}.${ok.ext}`;
      for (let n = 2; vids.some((v) => v.path === path) || removedMedia.includes(path) || (A.folder.state === 'ok' && await A.folder.exists(path)); n++) path = `${base}-${n}.${ok.ext}`;
      vids.push({ key: `v${++vidSeq}`, path, titel: ok.file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), file: ok.file });
    }
    $('nv-video-file').value = '';
    renderVideos();
  }

  /* ---------- Vorschau des Fensters (wie auf der Website, js/news.js) ---------- */
  /* Bildadresse fuer die Vorschau: Pfad im Projekt, in dieser Sitzung neu Gespeichertes als blob: */
  const previewSrc = (path) => {
    const u = A.imageUrl(path);
    return u && u.startsWith('blob:') ? u : path;
  };
  function openPreview() {
    if (!window.AugNews) {
      A.toast('Die Vorschau konnte nicht geladen werden. Bitte die Seite neu laden.', 'err');
      return;
    }
    const own = image ? image.url : (!removeImage && current ? previewSrc(current) : '');
    const poster = kind() === 'poster';
    const link = readLink().link || '';
    const link2 = $('f-link2').value.trim() ? webAddress($('f-link2').value) : '';
    window.AugNews.preview({
      report: $('f-report').checked,
      cat: clean($('f-cat').value),
      title: clean($('f-title').value) || 'Titel der Meldung',
      teaser: HD.cleanLines($('f-teaser').value.replace(/\|/g, '/')),
      infos: infos.values().map((r) => ({ label: clean(r.label), value: clean(r.value) })).filter((r) => r.value),
      details: $('f-details').value.split(/\n+/).map(clean).filter(Boolean),
      thumb: own && !poster ? own : '',
      poster: own && poster ? own : '',
      link, linktext: link ? clean($('f-linktext').value) || defaultText() : '',
      link2, linktext2: link2 ? clean($('f-linktext2').value) || 'Mehr Informationen' : '',
      photos: photos.map((p) => ({ src: p.url.startsWith('blob:') ? p.url : p.path, alt: p.alt.replace(/\s+/g, ' ').trim() })),
      videos: vids.map((v) => ({ src: v.file ? (v.url = v.url || URL.createObjectURL(v.file)) : v.path, titel: clean(v.titel) }))
    }, $('nv-preview'));
  }

  /* ---------- Fenster: Vorschau der Karte ---------- */
  /* Wo landet die Meldung mit den Angaben im Formular? Dafuer die Liste
     mit dieser Meldung durchrechnen (gleiche Regel wie auf der Website). */
  function whereText(iso) {
    if (!HD.isoDate(iso)) return '';
    const bis = HD.newsUntil(untilBase(iso), $('f-bis').value);
    const ab = HD.isoDate($('f-ab').value);
    const me = { Datum: isoToDe(iso), Bis: isoToDe(bis), Entwurf: $('f-draft').checked ? 'ja' : '', Ab: ab };
    if ($('f-draft').checked) return 'Entwurf: Die Meldung ist auf der Website nicht sichtbar.';
    if (ab && ab > A.isoToday()) return `Wird ab ${A.fmtDate(ab)} sichtbar (bis einschließlich ${A.fmtDate(bis)}).`;
    const next = entries.slice();
    placeEntry(next, me, editIndex, editIndex >= 0 && HD.isoDate(entries[editIndex].Datum) === iso);
    const home = A.newsOnHome(next);
    if (home.has(me)) {
      const pos = [...home].indexOf(me) + 1;
      return `Steht auf der Startseite an Stelle ${pos} von ${home.size}${bis ? `, bis einschließlich ${A.fmtDate(bis)}` : ''}.`;
    }
    if (bis && bis < A.isoToday()) return `Das Enddatum ist vorbei: Die Meldung steht nur noch im Archiv ${iso.slice(0, 4)}, nicht mehr auf der Startseite.`;
    return `Es gibt ${A.NEWS_HOME === 4 ? 'vier' : A.NEWS_HOME} neuere Meldungen: Diese steht im Archiv ${iso.slice(0, 4)} und noch nicht auf der Startseite.`;
  }
  function renderPreview() {
    const iso = $('f-date').value;
    const cat = $('f-cat').value.trim();
    const own = imageSrc();
    const src = cardSrc();
    $('nv-card').innerHTML = '<div class="news-card">' +
      `<div class="news-card-img${own ? ' adm-pan' : ''}"${own ? ' tabindex="0" role="group" aria-label="Bildausschnitt: mit der Maus ziehen oder mit den Pfeiltasten verschieben"' : ''}>` +
        (src
          ? `<img class="news-thumb${!own || kind() === 'photo' ? ' news-thumb-photo' : ''}" src="${esc(src)}" alt=""${own && A.focusPos($('f-focus').value) ? ` style="object-position:${A.focusPos($('f-focus').value)}"` : ''} draggable="false"/>`
          : '<span class="news-noimg"><img src="../assets/logo-gold.png" alt="" width="64" height="64"/></span>') +
        (cat ? `<span class="news-card-cat">${esc(cat)}</span>` : '') +
        (photos.length > 1 ? `<span class="news-card-photos">${plural(photos.length, 'Foto', 'Fotos')}</span>` : '') +
      '</div><div class="news-card-body">' +
        `<h3 class="news-card-title">${esc($('f-title').value.trim() || 'Titel der Meldung')}</h3>` +
        `<p class="news-card-text">${HD.formatText($('f-teaser').value.trim() || 'Hier erscheint der Kurztext.')}</p>` +
        '<span class="link-arr">Mehr erfahren</span>' +
      '</div></div>';
    $('nv-where').textContent = whereText(iso);
    $('nv-pan').hidden = !own;
    renderSuggest();
  }
  /* Bildausschnitt: Bild in der Karte ziehen oder mit Pfeiltasten verschieben;
     gespeichert als object-position ("x% y%") in f-focus */
  function panBox() {
    const box = $('nv-card').querySelector('.adm-pan');
    const img = box && box.querySelector('img');
    return img && img.naturalWidth ? { box, img } : null;
  }
  function panTo(x, y) {
    const t = panBox();
    if (!t) return;
    const clamp = (v) => Math.round(Math.min(100, Math.max(0, v)));
    $('f-focus').value = `${clamp(x)}% ${clamp(y)}%`;
    t.img.style.objectPosition = $('f-focus').value;
  }
  function panStart() {
    const v = $('f-focus').value.match(/^(\d+)% (\d+)%$/);
    if (v) return { x: Number(v[1]), y: Number(v[2]) };
    return { x: 50, y: kind() === 'photo' ? 50 : 0 };
  }
  function wirePan() {
    const card = $('nv-card');
    let drag = null;
    card.addEventListener('pointerdown', (ev) => {
      const t = panBox();
      if (!t || !t.box.contains(ev.target)) return;
      const r = t.box.getBoundingClientRect();
      const scale = Math.max(r.width / t.img.naturalWidth, r.height / t.img.naturalHeight);
      drag = {
        x0: ev.clientX, y0: ev.clientY, ...panStart(),
        rx: t.img.naturalWidth * scale - r.width, ry: t.img.naturalHeight * scale - r.height
      };
      t.box.setPointerCapture(ev.pointerId);
      t.box.classList.add('dragging');
      ev.preventDefault();
    });
    card.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      panTo(drag.rx > 1 ? drag.x - ((ev.clientX - drag.x0) / drag.rx) * 100 : drag.x,
        drag.ry > 1 ? drag.y - ((ev.clientY - drag.y0) / drag.ry) * 100 : drag.y);
    });
    const end = () => {
      drag = null;
      const t = panBox();
      if (t) t.box.classList.remove('dragging');
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('keydown', (ev) => {
      const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[ev.key];
      if (!step || !panBox()) return;
      ev.preventDefault();
      const s = panStart();
      panTo(s.x + step[0], s.y + step[1]);
    });
    $('nv-pan-reset').addEventListener('click', () => {
      $('f-focus').value = '';
      renderPreview();
    });
  }

  function updateCounter() {
    const n = $('f-teaser').value.trim().length;
    const el = $('f-teaser-count');
    el.textContent = n > TEASER_MAX ? `${n} Zeichen: auf der Karte wird nach drei Zeilen gekürzt` : `${n} von etwa ${TEASER_MAX} Zeichen`;
    el.classList.toggle('over', n > TEASER_MAX);
  }

  /* ---------- Fenster: Oeffnen und Speichern ---------- */
  function parseInfo(x) {
    const m = x.match(/^([^:]{1,60}):\s+(.+)$/);
    return m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: x };
  }
  const readInfos = () => infos.values()
    .map((r) => ({ label: clean(r.label), value: clean(r.value) }))
    .filter((r) => r.value)
    .map((r) => (r.label ? `${r.label}: ${r.value}` : r.value))
    .join(' | ');
  const readDetails = () => $('f-details').value.split(/\n+/).map(clean).filter(Boolean).join(' | ');

  /* copy: Inhalt der Meldung i als neue Meldung (Entwurf, heutiges Datum, ohne Fotos) */
  function openEditor(i, copy) {
    const e = i >= 0 ? entries[i] : null;
    editIndex = copy ? -1 : i;
    suggestOff = false;
    const form = $('nv-form');
    form.reset();
    A.clearErrors(form);
    $('f-date').value = e && !copy ? HD.isoDate(e.Datum) : A.isoToday();
    $('f-bis').value = e && !copy ? HD.isoDate(e.Bis) : '';
    $('f-draft').checked = copy ? true : !!e && /^ja$/i.test(e.Entwurf || '');
    $('f-ab').value = e && !copy ? HD.isoDate(e.Ab || '') : '';
    /* Redaktion mit Freigabe: immer Entwurf, ein Admin gibt frei */
    $('f-draft').disabled = A.needsApproval();
    $('f-approval').hidden = !A.needsApproval();
    if (A.needsApproval()) $('f-draft').checked = true;
    $('f-cat').value = e ? e.Kategorie : '';
    /* Frueher war "Bericht" eine Kategorie: gilt weiterhin als Bericht */
    $('f-report').checked = e ? /^ja$/i.test(e.Bericht || '') || /^bericht$/i.test(e.Kategorie) : false;
    setPages(e ? e.Seiten : '');
    $('f-title').value = e ? e.Titel : '';
    $('f-teaser').value = e ? e.Kurztext : '';
    $('f-details').value = e ? e.Details.split('|').map((s) => s.trim()).filter(Boolean).join('\n') : '';
    $('f-linktext').value = e ? e.Linktext : '';
    $('f-link2').value = e ? e['Weiterer Link'] : '';
    $('f-linktext2').value = e ? e['Weiterer Linktext'] : '';
    setTarget(e ? e.Link : '');
    const rows = e && e.Infos ? e.Infos.split('|').map((s) => s.trim()).filter(Boolean).map(parseInfo) : [];
    infos.set(rows.length ? rows : [{ label: 'Termin' }, { label: 'Ort' }]);
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    removeImage = false;
    current = e ? imgOf(e) : '';
    $('f-focus').value = e ? A.focusPos(e.Bildausschnitt) : '';
    $('f-credit').value = (e && e.Bildnachweis) || A.credits.get(current);
    document.querySelector(`input[name="kind"][value="${e && !e.Plakat && e.Vorschaubild ? 'photo' : 'poster'}"]`).checked = true;
    delete $('f-filename').dataset.touched;
    setMedia(e && !copy ? newsId(e) : '');
    renderImage();
    renderPreview();
    updateCounter();

    const existing = e && !copy;
    $('nv-dlg-tag').textContent = copy ? 'Kopie einer Meldung' : e ? 'Meldung bearbeiten' : 'Neue Meldung';
    $('nv-dlg-title').textContent = copy ? `Kopie: ${e.Titel}` : e ? e.Titel : 'Neue Meldung';
    $('nv-delete').hidden = !existing;
    $('nv-view').hidden = !existing || A.newsHidden(e);
    if (existing) $('nv-view').href = `../${A.newsOnHome(entries).has(e) ? 'index.html' : 'pages/archiv.html'}?news=${encodeURIComponent(newsId(e))}`;
    isCopy = !!copy;
    A.openDialog($('nv-dlg'), { isDirty: isDirty });
    snap = dirtyState();
  }
  /* Seiten, auf denen die Meldung unter "Aktuelles" steht */
  function setPages(value) {
    const on = HD.newsPages(value);
    $('f-pages').innerHTML = HD.NEWS_PAGES.map(([k, label]) =>
      `<label class="adm-check"><input type="checkbox" id="f-page-${esc(k)}" name="seite" value="${esc(k)}"${on.includes(k) ? ' checked' : ''}/>${esc(label)}</label>`).join('');
  }
  const readPages = () => [...$('f-pages').querySelectorAll('input:checked')].map((x) => x.value);

  /* Stand des Fensters: Formular samt Fotos (Reihenfolge, Beschreibung, Nachweis) */
  const dirtyState = () => A.snapshot($('nv-form')) + JSON.stringify(photos.map((p) => [p.path, p.alt, p.credit])) + JSON.stringify(vids.map((v) => [v.path, v.titel]));
  let isCopy = false;   /* Kopie: gilt als geaendert, bis sie gespeichert ist */
  const isDirty = () => isCopy || dirtyState() !== snap || !!image || removeImage;

  /* Freier Dateiname im Ordner der Meldung (name.webp, name-2.webp …); die eigene Datei
     einer bearbeiteten Meldung darf ersetzt werden (keine Kopie: die teilt ihr Bild evtl.) */
  async function freeImagePath(name, ext, old) {
    const dir = folderFor();
    let path = `${dir}${name}.${ext}`;
    const isOwn = (p) => !isCopy && old && (old.Plakat === p || old.Vorschaubild === p);
    const taken = (p) => photos.some((x) => x.path === p || x.thumb === p) || removedMedia.includes(p);
    for (let n = 2; !isOwn(path) && (taken(path) || (A.folder.state === 'ok' && await A.folder.exists(path))); n++) path = `${dir}${name}-${n}.${ext}`;
    return path;
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('nv-form');
    const date = $('f-date').value;
    const title = clean($('f-title').value);
    const teaser = HD.cleanLines($('f-teaser').value.replace(/\|/g, '/'));
    const target = readLink();
    const link = target.link || '';
    const errors = [];
    /* Ohne eigenes Enddatum: zwei Wochen ab dem Datum der Meldung */
    const bis = HD.newsUntil(untilBase(date), $('f-bis').value);
    if (!HD.isoDate(date)) errors.push([$('f-date'), 'Bitte das Datum der Meldung wählen.']);
    else if (bis < date) errors.push([$('f-bis'), 'Das Enddatum liegt vor dem Datum der Meldung.']);
    if (!title) errors.push([$('f-title'), 'Bitte einen Titel eintragen.']);
    if (!teaser) errors.push([$('f-teaser'), 'Bitte einen Kurztext eintragen.']);
    if (target.error) errors.push(target.error);
    /* Zweite Schaltflaeche: Text und Adresse gehoeren zusammen */
    const text2 = clean($('f-linktext2').value);
    const link2 = $('f-link2').value.trim() ? webAddress($('f-link2').value) : '';
    if ($('f-link2').value.trim() && !link2) errors.push([$('f-link2'), 'Diese Adresse sieht nicht richtig aus, z. B. www.musikverein.at.']);
    else if (link2 && !text2) errors.push([$('f-linktext2'), 'Bitte den Text der zweiten Schaltfläche eintragen, z. B. Karten kaufen.']);
    else if (text2 && !link2) errors.push([$('f-link2'), 'Bitte die Adresse für die zweite Schaltfläche eintragen.']);
    const pages = readPages();
    if (!pages.length) errors.push([$('f-pages').querySelector('input'), 'Bitte mindestens eine Seite wählen.']);
    if (photos.length > photoLimit()) {
      errors.push([$('f-report'), `Diese Meldung hat ${photos.length} Fotos. Erlaubt sind ${MAX_PHOTOS}, als Bericht bis zu ${MAX_REPORT}. Bitte Fotos entfernen oder „Als Bericht kennzeichnen“ ankreuzen.`]);
    }
    /* Gleiche Kennung (Datum + Titel) wie eine andere Meldung: Link und Fotos kaemen durcheinander */
    if (HD.isoDate(date) && title && entries.some((x, k) => k !== editIndex && newsId(x) === `${HD.isoDate(date)}-${HD.slug(title)}`)) {
      errors.push([$('f-title'), 'Es gibt schon eine Meldung mit diesem Titel und Datum. Bitte den Titel oder das Datum ändern.']);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    /* Hinweise (keine Fehler): bei einem Entwurf nicht noetig, der ist noch in Arbeit */
    if (!$('f-draft').checked && !A.needsApproval()) {
      const hints = [];
      const noAlt = photos.filter((p) => !p.alt.trim()).length;
      if (noAlt) hints.push(`${plural(noAlt, 'Foto hat', 'Fotos haben')} keine Beschreibung. Sie hilft Sehbehinderten, die Bilder zu verstehen.`);
      const big = [image && image.blob.size, ...photos.map((p) => p.size || 0)].filter((n) => n > 1500000).length;
      if (big) hints.push(`${plural(big, 'Bild ist', 'Bilder sind')} größer als 1,5 MB und laden am Handy langsam.`);
      if (!image && !(!removeImage && current) && !photos.length) hints.push('Es gibt weder ein Bild noch ein Foto: Die Karte zeigt nur das Logo.');
      if (!clean($('f-cat').value)) hints.push('Keine Kategorie: Die Meldung lässt sich im Archiv nicht danach filtern.');
      if (teaser.length > TEASER_MAX) hints.push(`Der Kurztext ist mit ${teaser.length} Zeichen länger als ${TEASER_MAX} und wird auf der Karte abgeschnitten.`);
      if ($('f-ziel').value === 'hochamt' && link && !haEntries.some((x) => HA_PREFIX + x.id === link)) hints.push('Die Schaltfläche führt zu einem Termin, den es in der Hochamt-Liste nicht (mehr) gibt.');
      if (!(await A.confirmWarnings(hints))) return;
    }

    const old = editIndex >= 0 ? entries[editIndex] : null;
    const poster = kind() === 'poster';
    const entry = {
      Datum: isoToDe(date), Bis: isoToDe(bis), Kategorie: clean($('f-cat').value), Titel: title, Kurztext: teaser,
      Infos: readInfos(), Details: readDetails(), Vorschaubild: '', Plakat: '',
      Link: link, Linktext: link ? clean($('f-linktext').value) || defaultText() : '',
      'Weiterer Link': link2, 'Weiterer Linktext': link2 ? text2 : '', Bildausschnitt: '',
      /* alle Seiten = leer (so stehen auch kuenftige Seiten automatisch dabei) */
      Seiten: pages.length === HD.NEWS_PAGES.length ? '' : pages.join(', '),
      Bericht: $('f-report').checked ? 'ja' : '',
      Entwurf: $('f-draft').checked || A.needsApproval() ? 'ja' : '',
      Ab: HD.isoDate($('f-ab').value) ? isoToDe(HD.isoDate($('f-ab').value)) : '',
      Bildnachweis: ''
    };
    /* Bisheriges Bild behalten (Art kann sich geaendert haben) */
    if (!image && !removeImage && current) {
      entry.Plakat = poster ? current : '';
      entry.Vorschaubild = poster ? '' : current;
    }
    const hasImage = !!image || (!removeImage && !!current);
    const btn = $('nv-save');
    btn.disabled = true;
    try {
      let imgPath = '';
      if (image) {
        imgPath = await freeImagePath(fileSlug($('f-filename').value || title), image.ext, old);
        entry.Plakat = poster ? imgPath : '';
        entry.Vorschaubild = poster ? '' : imgPath;
        await A.saveFile(imgPath, image.blob);
      }
      if (hasImage) {
        entry.Bildausschnitt = $('f-focus').value;
        entry.Bildnachweis = clean($('f-credit').value);
      }
      /* Ersetztes oder entferntes Bild wird beim Speichern geloescht (falls nirgends sonst verwendet) */
      if (current && (removeImage || (imgPath && imgPath !== current))) removedMedia.push(current);
      const next = entries.slice();
      /* Bestehende Meldung bleibt an ihrer Stelle, solange das Datum gleich bleibt */
      placeEntry(next, entry, old ? editIndex : -1, !!old && HD.isoDate(old.Datum) === date);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      /* Der Nachweis steht jetzt in der Tabelle; einen alten in data/bildnachweise.json entfernen */
      if (imgOf(entry) && A.credits.get(imgOf(entry))) await A.credits.set(imgOf(entry), '');
      const d = await saveMedia(old && !isCopy ? newsId(old) : '', newsId(entry));
      /* Entferntes wirklich loeschen; ist nichts mehr in der Meldung, auch ihr Ordner */
      const gone = removedMedia.slice();
      removedMedia = [];
      const empty = !imgOf(entry) && !d.fotos.length && !d.videos.length;
      const dirs = empty ? [...new Set([photoDir, ...gone.map((f) => A.dirName(f))].filter((x) => x && OWN_DIR.test(x))
        .flatMap((x) => [x.replace(/^assets\/video\//, 'assets/img/'), x.replace(/^assets\/img\//, 'assets/video/')]))] : [];
      if (gone.length || dirs.length) await A.media.remove(gone, { ownDirs: dirs });
      isCopy = false;
      $('nv-dlg').close();
      render();
      flash(newsId(entry));
      const withWhat = [imgPath ? 'Bild' : '', photos.length ? plural(photos.length, 'Foto', 'Fotos') : ''].filter(Boolean).join(' und ');
      A.toast(direct
        ? `Gespeichert: „${title}“${withWhat ? ` mit ${withWhat}` : ''}.`
        : `„${title}“ übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Meldung ${old ? 'geändert' : 'angelegt'}: ${title}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const e = entries[i];
    const id = newsId(e);
    const info = newsIndex[id] || { fotos: 0, videos: 0 };
    const parts = [imgOf(e) ? 'das Bild' : '', info.fotos ? plural(info.fotos, 'Foto', 'Fotos') : '', info.videos ? plural(info.videos, 'Video', 'Videos') : ''].filter(Boolean);
    const what = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}` : parts[0];
    const ok = await A.confirmBox({
      title: 'Meldung löschen?',
      html: `<strong>${esc(e.Titel)}</strong> (${esc(e.Datum)})<br><br>Die Meldung verschwindet von der Website.` +
        (what ? ` Dazu werden ${esc(what)} gelöscht, samt Vorschaubildern, Bildnachweisen und Ordner (nur was nicht noch anderswo verwendet wird).` : ''),
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    if (indexBroken) {
      A.toast('Fotos und Videos ließen sich vorher nicht laden. Bitte die Seite neu laden und noch einmal löschen.', 'err');
      return false;
    }
    try {
      const d = await loadDetail(id);
      const next = entries.filter((x) => x !== e);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      /* Daten zuerst: Detail-Datei und Eintrag in der Uebersicht */
      mediaChain = mediaChain.catch(() => {}).then(async () => {
        await migrateLegacy();
        if (newsIndex[id]) {
          await A.discardFile(detailPath(id));
          const rest = { ...newsIndex };
          delete rest[id];
          await writeIndex(rest);
        }
      });
      await mediaChain;
      /* dann die Dateien: Bild, Fotos, Videos und die eigenen Ordner der Meldung */
      const files = [imgOf(e), ...d.fotos.map((x) => x && x.bild), ...d.videos.map((v) => v && v.datei)].filter(Boolean);
      const dirs = [...new Set(files.map((f) => A.dirName(f)).filter((x) => OWN_DIR.test(x)))];
      await A.media.remove(files, { ownDirs: dirs });
      render();
      A.toast(direct ? `Gelöscht: „${e.Titel}“.` : 'Gelöscht. Bitte unten die Datei herunterladen.');
      A.log(`Meldung gelöscht: ${e.Titel}`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    infos = A.listEditor($('f-infos'), {
      fields: [
        { key: 'label', label: 'Bezeichnung', placeholder: 'Bezeichnung', list: 'dl-label' },
        { key: 'value', label: 'Wert', placeholder: 'z. B. Sonntag, 20. September, 11:00 Uhr' }
      ],
      addLabel: 'Zeile hinzufügen', rowLabel: 'Zeile', labelFirst: true
    });

    $('nv-new').addEventListener('click', () => openEditor(-1));
    $('nv-form').addEventListener('submit', save);
    $('nv-form').addEventListener('input', (ev) => {
      if (ev.target.id === 'f-teaser') updateCounter();
      if (ev.target.id === 'f-title' && image && !$('f-filename').dataset.touched) $('f-filename').value = fileSlug(ev.target.value);
      if (ev.target.id === 'f-filename') ev.target.dataset.touched = '1';
      /* "Bericht" entscheidet, wie viele Fotos erlaubt sind */
      if (ev.target.id === 'f-report') renderPhotos();
      renderPreview();
    });
    $('nv-form').addEventListener('change', (ev) => {
      if (ev.target.name === 'kind') renderPreview();
      if (ev.target.id && ev.target.id.startsWith('f-ziel')) {
        updateZiel();
        applyDefaultText(ev.target.id === 'f-ziel');
        renderSuggest();
      }
    });
    $('f-link2').addEventListener('blur', (ev) => {
      const v = clean(ev.target.value);
      if (v && !/^(pages\/|index\.html|[a-z][a-z\d+.-]*:)/i.test(v)) ev.target.value = `https://${v}`;
    });
    $('f-ziel-extern').addEventListener('blur', (ev) => {
      const v = clean(ev.target.value);
      if (v && !/^[a-z][a-z\d+.-]*:/i.test(v)) ev.target.value = `https://${v}`;
    });
    $('nv-suggest').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-link-ha]');
      if (b) linkHochamt(b.dataset.linkHa);
      if (ev.target.closest('[data-no-suggest]')) {
        suggestOff = true;
        renderSuggest();
        $('f-cat').focus();
      }
    });
    $('nv-form').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-unlink]')) unlink();
    });
    /* Schnellwahl: ab dem Datum der Meldung (oder heute) */
    $('nv-form').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-bis]');
      if (!b) return;
      const from = HD.isoDate($('f-date').value) || A.isoToday();
      const dt = HD.dateFromIso(from);
      if (b.dataset.bis === 'juni') {
        const y = dt.getMonth() >= 6 ? dt.getFullYear() + 1 : dt.getFullYear();
        $('f-bis').value = `${y}-06-30`;
      } else {
        dt.setDate(dt.getDate() + Number(b.dataset.bis));
        $('f-bis').value = A.isoOf(dt);
      }
      A.setError($('f-bis'), '');
      renderPreview();
      $('f-bis').focus();
    });
    wirePan();
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('nv-drop'));
    $('nv-img-remove').addEventListener('click', dropImage);
    $('nv-preview').addEventListener('click', openPreview);
    /* Bildergalerie */
    $('nv-photo-file').addEventListener('change', (ev) => addPhotos(ev.target.files));
    A.wireDrop($('nv-photo-drop'), addPhotos);
    $('nv-photos').addEventListener('input', (ev) => {
      const k = ev.target.closest('.adm-ph');
      const p = k && photos.find((x) => x.key === k.dataset.k);
      if (p && ev.target.dataset.ph) p[ev.target.dataset.ph] = ev.target.value;
    });
    /* Fotos per Ziehen umsortieren: das Vorschaubild ist der Griff */
    let dragKey = '';
    const rowOf = (t) => t.closest('.adm-ph');
    $('nv-photos').addEventListener('pointerdown', (ev) => {
      const row = ev.target.closest('[data-ph-grip]') && rowOf(ev.target);
      if (row) row.draggable = true;
    });
    $('nv-photos').addEventListener('dragstart', (ev) => {
      const row = rowOf(ev.target);
      if (!row || !row.draggable) return;
      dragKey = row.dataset.k;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', dragKey);
      row.classList.add('dragging');
    });
    $('nv-photos').addEventListener('dragover', (ev) => {
      if (!dragKey) return;
      ev.preventDefault();
      const row = rowOf(ev.target);
      $('nv-photos').querySelectorAll('.drop-over').forEach((x) => x.classList.remove('drop-over'));
      if (row && row.dataset.k !== dragKey) row.classList.add('drop-over');
    });
    $('nv-photos').addEventListener('drop', (ev) => {
      const row = rowOf(ev.target);
      if (!dragKey || !row) return;
      ev.preventDefault();
      const from = photos.findIndex((x) => x.key === dragKey);
      const to = photos.findIndex((x) => x.key === row.dataset.k);
      dragKey = '';
      if (from < 0 || to < 0 || from === to) return renderPhotos();
      photos.splice(to, 0, photos.splice(from, 1)[0]);
      renderPhotos();
      renderPreview();
    });
    $('nv-photos').addEventListener('dragend', () => {
      dragKey = '';
      renderPhotos();
    });
    $('nv-photos').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ph-act]');
      const k = b && b.closest('.adm-ph');
      if (!k) return;
      const i = photos.findIndex((x) => x.key === k.dataset.k);
      const act = b.dataset.phAct;
      if (act === 'del') {
        /* neu: gleich weg; schon gespeichert: beim Speichern loeschen */
        if (photos[i].fresh) discardFresh([photos[i]]);
        else removedMedia.push(photos[i].path);
        photos.splice(i, 1);
      } else {
        const j = i + (act === 'up' ? -1 : 1);
        if (j < 0 || j >= photos.length) return;
        [photos[i], photos[j]] = [photos[j], photos[i]];
      }
      renderPhotos();
      renderPreview();
    });
    $('nv-video-file').addEventListener('change', (ev) => addVideos(ev.target.files));
    A.wireDrop($('nv-video-drop'));
    $('nv-videos').addEventListener('input', (ev) => {
      const k = ev.target.closest('.adm-ph');
      const v = k && vids.find((x) => x.key === k.dataset.k);
      if (v && ev.target.dataset.vd) v.titel = ev.target.value;
    });
    $('nv-videos').addEventListener('click', (ev) => {
      const k = ev.target.closest('[data-vd-act]') && ev.target.closest('.adm-ph');
      if (!k) return;
      const v = vids.find((x) => x.key === k.dataset.k);
      if (v && !v.file) removedMedia.push(v.path);
      vids = vids.filter((x) => x.key !== k.dataset.k);
      renderVideos();
    });
    $('nv-dlg').addEventListener('close', () => {
      dialogToken++;   /* laufendes Hochladen bricht ab und raeumt seine Dateien weg */
      vids = [];
      discardFresh(photos.filter((p) => p.fresh));
      photos = [];
      removedMedia = [];
      photoDir = '';
      $('nv-save').disabled = false;
    });
    /* Bildnachweis des ersten Fotos fuer alle */
    $('nv-photos').addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-ph-credit-all]') || !photos.length) return;
      for (const p of photos) p.credit = photos[0].credit;
      renderPhotos();
      A.toast(`Bildnachweis für alle ${photos.length} Fotos übernommen.`);
    });
    $('nv-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('nv-dlg').close();
    });
    $('nv-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
      if (b.dataset.act === 'dup') openEditor(Number(b.dataset.i), true);
      if (b.dataset.act === 'up' || b.dataset.act === 'down') move(Number(b.dataset.i), b.dataset.act === 'up' ? -1 : 1);
      if (b.dataset.act === 'draft' || b.dataset.act === 'publish') setDraft(Number(b.dataset.i), b.dataset.act === 'draft');
      if (b.dataset.act === 'new') openEditor(-1);
      if (b.dataset.act === 'clear') {
        $('nv-search').value = '';
        query = '';
        render();
        $('nv-search').focus();
      }
    });
    let timer = 0;
    $('nv-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('nv-dlg').open && isDirty());
    A.folder.on((state) => { if (state === 'ok') { load(); loadTargets(); loadIndex(); } });

    await Promise.all([load(), loadTargets(), loadIndex()]);
    /* jetzt auch mit den Fotos der Galerie (eine Fehlermeldung beim Laden bleibt stehen) */
    if (!$('nv-list').querySelector('.adm-alert')) render();
    /* Direkt oeffnen: ?neu=1 oder ?bearbeiten=<Kennung der Meldung> */
    const params = new URLSearchParams(location.search);
    const wanted = params.get('bearbeiten');
    if (params.has('neu')) openEditor(-1);
    else if (wanted) {
      const i = entries.findIndex((e) => newsId(e) === wanted);
      if (i >= 0) openEditor(i);
      else A.toast('Diese Meldung wurde nicht gefunden.', 'err');
    }
    if (params.has('neu') || wanted) history.replaceState(null, '', location.pathname);
  });
})();
