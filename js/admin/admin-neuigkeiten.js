/* ============================================================
   Augustinerkirche Wien — admin-neuigkeiten.js
   Neuigkeiten pflegen (admin/neuigkeiten.html), Quelle ist
   data/news.csv. Meldungen anlegen, bearbeiten und loeschen,
   samt Plakat oder Foto:
   - Bild per Ziehen und Ablegen oder Auswahl; WebP bleibt, andere
     Formate werden in voller Groesse in WebP umgewandelt
   - das Bild kommt in den Jahresordner assets/img/news/JAHR/
   - Vorschau der Karte, wie sie auf der Startseite erscheint
   - Fotos als Bildergalerie im Fenster der Meldung (data/news-fotos.json,
     Kennung der Meldung -> [{bild, alt, breite, hoehe}]): bei der Kategorie
     "Bericht" bis zu 30, sonst bis zu 5; jede Meldung bekommt dafuer einen
     eigenen Ordner assets/img/news/JAHR/<Datum>-<Titel>/ (foto-1.webp …).
     Ohne eigenes Bild zeigt die Karte das erste Foto.
   - Videos (MP4/WebM) in data/news-videos.json, Kennung -> [{datei, titel}],
     Dateien in assets/video/news/JAHR/; erscheinen unter der Galerie
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

  /* Bildergalerie der Meldung */
  const PHOTOS_PATH = 'data/news-fotos.json';
  const MAX_REPORT = 30;   /* Kategorie "Bericht" */
  const MAX_PHOTOS = 5;    /* alle anderen Meldungen */
  let photoMap = {};       /* Kennung der Meldung -> Liste der Fotos */
  let photos = [];         /* Fotos im Fenster {key, path, url, ext, w, h, alt, credit, fresh} */
  let photoSeq = 0;
  let photoDir = '';       /* Ordner der Fotos dieser Meldung */

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
    const gallery = photoMap[newsId(e)] || [];
    const src = A.imageUrl(imgOf(e) || (gallery[0] && gallery[0].bild));
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
          (gallery.length ? `<span class="adm-chip">${icon('image')}${plural(gallery.length, 'Foto', 'Fotos')} in der Galerie</span>` : '') +
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

  /* ---------- Fenster: Fotos (Bildergalerie) ---------- */
  const isReport = () => $('f-report').checked;
  const photoLimit = () => (isReport() ? MAX_REPORT : MAX_PHOTOS);
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');

  async function loadPhotos() {
    try {
      photoMap = (await A.readJSON(PHOTOS_PATH)).bilder || {};
    } catch (e) {
      photoMap = {};
      if (!notFound(e)) A.toast('Die Fotos der Neuigkeiten konnten nicht geladen werden.', 'err');
    }
  }
  function renderPhotos() {
    const limit = photoLimit();
    $('nv-photos').innerHTML = photos.map((p, i) =>
      `<div class="adm-ph" data-k="${p.key}">` +
        `<span class="adm-thumb" data-ph-grip title="Zum Verschieben ziehen" style="cursor:grab"><img src="${esc(p.url)}" alt=""/></span>` +
        '<div class="adm-ph-fields">' +
          `<label class="adm-label" for="ph-alt-${p.key}">Beschreibung <span class="adm-opt">${i === 0 ? 'erstes Foto, ' : ''}steht unter dem Foto</span></label>` +
          `<input class="adm-input" type="text" id="ph-alt-${p.key}" data-ph="alt" value="${esc(p.alt)}" placeholder="z. B. Gemeinsames Mittagessen im Klostergarten"/>` +
          `<label class="adm-label" for="ph-cr-${p.key}">Bildnachweis</label>` +
          `<input class="adm-input" type="text" id="ph-cr-${p.key}" data-ph="credit" value="${esc(p.credit)}" placeholder="z. B. © Augustiner Wien, Foto: Max Muster"/>` +
        '</div>' +
        '<div class="adm-ph-act">' +
          `<button type="button" class="adm-act icon" data-ph-act="up" aria-label="Nach vorne"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-ph-act="down" aria-label="Nach hinten"${i === photos.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act icon danger" data-ph-act="del" aria-label="Foto entfernen">${icon('trash')}</button>` +
        '</div></div>'
    ).join('');
    const over = photos.length > limit;
    const count = $('nv-photo-count');
    count.textContent = `${plural(photos.length, 'Foto', 'Fotos')} von höchstens ${limit}` +
      (over ? `: bitte ${photos.length - limit} entfernen oder „Als Bericht kennzeichnen“ ankreuzen` : '');
    count.classList.toggle('over', over);
    $('nv-photo-drop').hidden = photos.length >= limit;
  }
  /* Ordner der Fotos: bei vorhandenen Fotos deren Ordner, sonst nach Datum und Titel */
  function folderFor() {
    if (photoDir) return photoDir;
    const iso = HD.isoDate($('f-date').value) || A.isoToday();
    photoDir = `assets/img/news/${iso.slice(0, 4)}/${iso}-${HD.slug($('f-title').value, 50) || 'meldung'}/`;
    return photoDir;
  }
  /* Freier Name im Ordner: foto-1.webp, foto-2.webp … */
  async function freePhotoPath(dir, ext) {
    const taken = new Set(photos.map((p) => p.path));
    for (let n = 1; ; n++) {
      const path = `${dir}foto-${n}.${ext}`;
      if (!taken.has(path) && !(A.folder.state === 'ok' && await A.folder.exists(path))) return path;
    }
  }
  async function addPhotos(files) {
    let list = Array.from(files || []);
    const free = photoLimit() - photos.length;
    if (list.length > free) {
      A.toast(free > 0
        ? `Es passen nur noch ${plural(free, 'Foto', 'Fotos')} dazu (höchstens ${photoLimit()}${isReport() ? '' : ', als Bericht bis zu 30'}). Die übrigen wurden nicht übernommen.`
        : `Es sind schon ${photoLimit()} Fotos da${isReport() ? '' : '. Als Bericht sind bis zu 30 möglich'}.`, 'err');
      list = list.slice(0, Math.max(0, free));
    }
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        A.toast(`„${file.name}“ ist keine Bilddatei.`, 'err');
        continue;
      }
      try {
        const conv = await A.toWebp(file);
        let w = 0;
        let h = 0;
        try {
          const bmp = await createImageBitmap(conv.blob);
          w = bmp.width;
          h = bmp.height;
          if (bmp.close) bmp.close();
        } catch { /* Groesse unbekannt */ }
        const path = await freePhotoPath(folderFor(), conv.ext);
        await A.saveFile(path, conv.blob);
        photos.push({ key: `n${++photoSeq}`, path, url: URL.createObjectURL(conv.blob), ext: conv.ext, w, h, alt: '', credit: '', fresh: true, size: conv.blob.size });
        renderPhotos();
        renderPreview();
      } catch {
        /* Meldung hat toWebp schon gezeigt */
      }
    }
    if (list.length && A.folder.state !== 'ok') A.toast('Fotos bereit. Bitte unten herunterladen.');
    $('nv-photo-file').value = '';
    renderPhotos();
    renderPreview();
  }
  /* Fotos, die in diesem Fenster neu dazukamen und nicht uebernommen wurden, wieder loeschen */
  async function discardFresh(list) {
    for (const p of list) {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      if (p.fresh) await A.discardFile(p.path);
    }
  }
  function setPhotos(key) {
    for (const p of photos) if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    photos = ((key && photoMap[key]) || []).map((b) => ({
      key: `p${++photoSeq}`, path: b.bild, url: A.imageUrl(b.bild), ext: 'webp',
      w: b.breite || 0, h: b.hoehe || 0, alt: b.alt || '', credit: A.credits.get(b.bild)
    }));
    photoDir = photos.length ? photos[0].path.replace(/[^/]+$/, '') : '';
    renderPhotos();
  }
  /* Liste dieser Meldung speichern; oldKey: bisherige Kennung (Titel oder Datum geaendert) */
  async function savePhotos(oldKey, key) {
    const list = photos.map((p) => ({ bild: p.path, alt: p.alt.replace(/\s+/g, ' ').trim(), breite: p.w, hoehe: p.h }));
    const next = { ...photoMap };
    if (oldKey && oldKey !== key) delete next[oldKey];
    if (list.length) next[key] = list;
    else delete next[key];
    if (JSON.stringify(next) !== JSON.stringify(photoMap)) {
      const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
      await A.saveJSON(PHOTOS_PATH, { bilder: sorted });
      photoMap = sorted;
    }
    if (photos.length) await A.credits.save(Object.fromEntries(photos.map((p) => [p.path, p.credit])));
    for (const p of photos) p.fresh = false;   /* uebernommen: bleibt auch beim Schliessen */
  }

  /* ---------- Fenster: Videos (data/news-videos.json: {videos: {Kennung: [{datei, titel}]}}) ---------- */
  const VIDEOS_PATH = 'data/news-videos.json';
  let videoMap = {};
  let vids = [];           /* {key, path, titel, file}; file nur bei neu gewaehlten, noch nicht geschriebenen */
  let vidSeq = 0;

  async function loadVideos() {
    try {
      videoMap = (await A.readJSON(VIDEOS_PATH)).videos || {};
    } catch (e) {
      videoMap = {};
      if (!notFound(e)) A.toast('Die Videos der Neuigkeiten konnten nicht geladen werden.', 'err');
    }
  }
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
      const year = (HD.isoDate($('f-date').value) || A.isoToday()).slice(0, 4);
      const base = `assets/video/news/${year}/${HD.slug(ok.file.name.replace(/\.[^.]+$/, ''), 50) || 'video'}`;
      let path = `${base}.${ok.ext}`;
      for (let n = 2; vids.some((v) => v.path === path) || (A.folder.state === 'ok' && await A.folder.exists(path)); n++) path = `${base}-${n}.${ok.ext}`;
      vids.push({ key: `v${++vidSeq}`, path, titel: ok.file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), file: ok.file });
    }
    $('nv-video-file').value = '';
    renderVideos();
  }
  function setVideos(key) {
    vids = ((key && videoMap[key]) || []).map((v) => ({ key: `v${++vidSeq}`, path: v.datei, titel: v.titel || '', file: null }));
    renderVideos();
  }
  async function saveVideos(oldKey, key) {
    for (const v of vids) {
      if (v.file) {
        await A.saveFile(v.path, v.file);
        v.file = null;
      }
    }
    const next = { ...videoMap };
    if (oldKey && oldKey !== key) delete next[oldKey];
    if (vids.length) next[key] = vids.map((v) => ({ datei: v.path, titel: clean(v.titel) || 'Video' }));
    else delete next[key];
    if (JSON.stringify(next) !== JSON.stringify(videoMap)) {
      await A.saveJSON(VIDEOS_PATH, { videos: Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])) });
      videoMap = next;
    }
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
    $('f-credit').value = A.credits.get(current);
    document.querySelector(`input[name="kind"][value="${e && !e.Plakat && e.Vorschaubild ? 'photo' : 'poster'}"]`).checked = true;
    delete $('f-filename').dataset.touched;
    setPhotos(e && !copy ? newsId(e) : '');
    setVideos(e && !copy ? newsId(e) : '');
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

  /* Freier Dateiname im Jahresordner (name.webp, name-2.webp …);
     die eigene Datei einer bearbeiteten Meldung darf ersetzt werden */
  async function freeImagePath(year, name, ext, old) {
    const dir = `assets/img/news/${year}/`;
    let path = `${dir}${name}.${ext}`;
    if (A.folder.state !== 'ok') return path;
    const isOwn = (p) => old && (old.Plakat === p || old.Vorschaubild === p);
    for (let n = 2; !isOwn(path) && await A.folder.exists(path); n++) path = `${dir}${name}-${n}.${ext}`;
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
      Ab: HD.isoDate($('f-ab').value) ? isoToDe(HD.isoDate($('f-ab').value)) : ''
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
        imgPath = await freeImagePath(date.slice(0, 4), fileSlug($('f-filename').value || title), image.ext, old);
        entry.Plakat = poster ? imgPath : '';
        entry.Vorschaubild = poster ? '' : imgPath;
        await A.saveFile(imgPath, image.blob);
      }
      if (hasImage) entry.Bildausschnitt = $('f-focus').value;
      const next = entries.slice();
      /* Bestehende Meldung bleibt an ihrer Stelle, solange das Datum gleich bleibt */
      placeEntry(next, entry, old ? editIndex : -1, !!old && HD.isoDate(old.Datum) === date);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      if (imgOf(entry)) await A.credits.set(imgOf(entry), $('f-credit').value);
      await savePhotos(old ? newsId(old) : '', newsId(entry));
      await saveVideos(old ? newsId(old) : '', newsId(entry));
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
    const gallery = photoMap[newsId(e)] || [];
    const ok = await A.confirmBox({
      title: 'Meldung löschen?',
      html: `<strong>${esc(e.Titel)}</strong> (${esc(e.Datum)})<br><br>Die Meldung verschwindet von der Website. Das Bild bleibt im Ordner erhalten.` +
        (gallery.length ? ` Die ${plural(gallery.length, 'Foto', 'Fotos')} der Galerie werden mit gelöscht.` : ''),
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      const next = entries.filter((x) => x !== e);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      /* Galerie: eigener Ordner der Meldung, die Fotos werden sonst nirgends verwendet */
      if (gallery.length) {
        const rest = { ...photoMap };
        delete rest[newsId(e)];
        await A.saveJSON(PHOTOS_PATH, { bilder: rest });
        photoMap = rest;
        for (const b of gallery) await A.discardFile(b.bild);
        await A.credits.save(Object.fromEntries(gallery.map((b) => [b.bild, ''])));
      }
      const clips = videoMap[newsId(e)] || [];
      if (clips.length) {
        const rest = { ...videoMap };
        delete rest[newsId(e)];
        await A.saveJSON(VIDEOS_PATH, { videos: rest });
        videoMap = rest;
        for (const c of clips) await A.discardFile(c.datei);
      }
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
        discardFresh([photos[i]]);
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
      vids = vids.filter((x) => x.key !== k.dataset.k);
      renderVideos();
    });
    $('nv-dlg').addEventListener('close', () => {
      vids = [];
      discardFresh(photos.filter((p) => p.fresh));
      photos = [];
      photoDir = '';
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
    A.folder.on((state) => { if (state === 'ok') { load(); loadTargets(); loadPhotos(); loadVideos(); } });

    await Promise.all([load(), loadTargets(), loadPhotos(), loadVideos()]);
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
