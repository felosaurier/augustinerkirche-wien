/* ============================================================
   Augustinerkirche Wien — admin-neuigkeiten.js
   Neuigkeiten pflegen (admin/neuigkeiten.html), Quelle ist
   data/news.csv. Meldungen anlegen, bearbeiten und loeschen,
   samt Plakat oder Foto:
   - Bild per Ziehen und Ablegen oder Auswahl; WebP bleibt, andere
     Formate werden in voller Groesse in WebP umgewandelt
   - das Bild kommt in den Jahresordner assets/img/news/JAHR/
   - Vorschau der Karte, wie sie auf der Startseite erscheint
   - Schaltflaeche im Fenster: Ziel aus Listen waehlen (Hochamt oder
     Konzert, Runde, Seite der Website, andere Website) statt Adresse;
     liegt am Enddatum ein Termin, wird er zum Verknuepfen vorgeschlagen
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/news.csv';
  const LATEST = A.NEWS_HOME;
  const TEASER_MAX = 160;

  let entries = [];       /* neueste zuerst, Schluessel wie die Spalten der Tabelle */
  let query = '';
  let editIndex = -1;     /* -1 = neue Meldung */
  let image = null;       /* neu gewaehltes Bild {blob, ext, url, converted, name} */
  let current = '';       /* bisheriges Bild der Meldung (Pfad) */
  let removeImage = false;
  let snap = '';
  let infos = null;

  /* | trennt in der Tabelle mehrere Eintraege einer Zelle */
  const clean = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const isoToDe = (iso) => iso.split('-').reverse().join('.');
  const fileSlug = (s) => HD.slug(s, 50) || 'bild';
  const imgOf = (e) => e.Plakat || e.Vorschaubild;
  const newsId = (e) => `${HD.isoDate(e.Datum)}-${HD.slug(e.Titel)}`;
  const kind = () => (document.querySelector('input[name="kind"]:checked') || {}).value || 'poster';
  const toCSV = (list) => HD.csvText([A.NEWS_HEAD, ...list.map((o) => A.NEWS_HEAD.map((h) => o[h]))]);
  /* Neueste zuerst; am selben Tag bleibt die bisherige Reihenfolge */
  const sortEntries = (list) => list.sort((a, b) => HD.isoDate(b.Datum).localeCompare(HD.isoDate(a.Datum)));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function longDate(iso) {
    const dt = HD.dateFromIso(iso);
    return `${dt.getDate()}. ${HD.MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  /* ---------- Ziel der Schaltflaeche ---------- */
  const HA_PREFIX = 'pages/hochamt.html?id=';
  /* Seiten der Website: [Adresse, Name in der Auswahl, Text der Schaltflaeche] */
  const PAGES = [
    ['Gottesdienste', [
      ['pages/gottesdienste.html', 'Gottesdienste: Liturgie-Zeiten', 'Zu den Gottesdiensten'],
      ['pages/gottesdienste.html#p-woche', 'Gottesdienste: Wochenüberblick', 'Zum Wochenüberblick'],
      ['pages/gottesdienste.html#p-runden', 'Runden in St. Augustin (Übersicht)', 'Zu den Runden'],
      ['pages/sakramente.html', 'Sakramente', 'Zu den Sakramenten']]],
    ['Kirchenmusik', [
      ['pages/musik.html#p-hochaemter', 'Hochämter: alle Termine', 'Alle Hochämter ansehen'],
      ['pages/musik.html#p-hochaemter-archiv', 'Vergangene Hochämter', 'Zu den vergangenen Hochämtern'],
      ['pages/musik.html#p-chor', 'Chor von St. Augustin', 'Zum Chor'],
      ['pages/musik.html#p-kammerchor', 'Kammerchor', 'Zum Kammerchor'],
      ['pages/musik.html#p-repertoire', 'Repertoire des Chores', 'Zum Repertoire'],
      ['pages/musik.html#p-solisten', 'Solisten', 'Zu den Solisten'],
      ['pages/musik.html#p-orchester', 'Orchester', 'Zum Orchester'],
      ['pages/musik.html#p-orgeln', 'Orgeln', 'Zu den Orgeln'],
      ['pages/musik.html#p-patenschaft', 'Patenschaft St. Augustin', 'Zur Patenschaft'],
      ['pages/musik.html#p-cds', 'CDs von St. Augustin', 'Zu den CDs']]],
    ['Augustinerkirche', [
      ['pages/chronik.html#p-geschichte', 'Geschichte', 'Zur Geschichte'],
      ['pages/chronik.html#p-herzgruft', 'Herzgruft', 'Zur Herzgruft'],
      ['pages/chronik.html#p-fuehrungen', 'Führungen', 'Zu den Führungen'],
      ['pages/chronik.html#p-wien', 'Die Augustiner in Wien', 'Zu den Augustinern in Wien']]],
    ['Weitere', [
      ['pages/aspersdorf.html', 'Pfarre Aspersdorf', 'Nach Aspersdorf'],
      ['pages/archiv.html', 'Archiv der Neuigkeiten', 'Zum Archiv'],
      ['index.html#kontakt', 'Kontakt', 'Zum Kontakt']]]
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
      A.readText('data/runden.json').then((t) => JSON.parse(t).runden || [])
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
  function rowHTML(e, i, home) {
    const src = A.imageUrl(imgOf(e));
    const thumb = src
      ? `<span class="adm-thumb${e.Plakat ? '' : ' photo'}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"/></span>`
      : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>';
    const place = placeOf(e, home);
    const badge = place === 'home' ? '<span class="adm-badge on">Startseite</span>'
      : place === 'home-expired' ? '<span class="adm-badge on" title="Abgelaufen, füllt die Startseite unten auf, solange es weniger als 3 aktive Meldungen gibt">Startseite · abgelaufen</span>'
      : place === 'expired' ? '<span class="adm-badge">Abgelaufen · Archiv</span>'
        : `<span class="adm-badge">Archiv ${esc(e.Datum.split('.')[2])}</span>`;
    return `<li class="adm-row" data-key="${esc(newsId(e))}">` +
      `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">${thumb}` +
        '<span class="adm-row-body">' +
          `<span class="adm-row-date">${esc(e.Datum)}${e.Bis ? ` · bis ${esc(e.Bis)}` : ''}${e.Kategorie ? ` · ${esc(e.Kategorie)}` : ''}</span>` +
          `<span class="adm-row-title">${esc(e.Titel)}</span>` +
          `<span class="adm-row-people">${esc(e.Kurztext)}</span>` +
          (e.Bis ? '' : `<span class="adm-chip">${icon('alert')}Enddatum fehlt: bitte ergänzen</span> `) +
          (src ? '' : `<span class="adm-chip">${icon('image')}Ohne Bild: die Karte zeigt das Logo</span>`) +
        `</span>${badge}` +
      '</button>' +
      '<div class="adm-row-actions">' +
        `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(e.Titel)}">${icon('trash')}Löschen</button>` +
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
    $('nv-list').innerHTML = '<ul class="adm-rows">' + list.map(({ e, i }) => rowHTML(e, i, home)).join('') + '</ul>';
  }

  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('.adm-row-open').focus({ preventScroll: true });
  }

  /* ---------- Fenster: Bild ---------- */
  const imageSrc = () => (image ? image.url : (!removeImage && current ? A.imageUrl(current) : ''));

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
    renderImage();
    renderPreview();
  }

  /* ---------- Fenster: Vorschau der Karte ---------- */
  /* Wo landet die Meldung mit den Angaben im Formular? Dafuer die Liste
     mit dieser Meldung durchrechnen (gleiche Regel wie auf der Website). */
  function whereText(iso) {
    if (!HD.isoDate(iso)) return '';
    const bis = HD.isoDate($('f-bis').value);
    const me = { Datum: isoToDe(iso), Bis: bis ? isoToDe(bis) : '' };
    const next = entries.slice();
    if (editIndex >= 0) next[editIndex] = me;
    else next.push(me);
    sortEntries(next);
    const home = A.newsOnHome(next);
    if (home.has(me)) {
      const pos = [...home].indexOf(me) + 1;
      return `Steht auf der Startseite an Stelle ${pos} von ${home.size}${bis ? `, bis einschließlich ${A.fmtDate(bis)}` : ''}.`;
    }
    if (bis && bis < A.isoToday()) return `Das Enddatum ist vorbei: Die Meldung steht nur im Archiv ${iso.slice(0, 4)}.`;
    return `Es gibt drei neuere Meldungen: Diese steht vorerst nur im Archiv ${iso.slice(0, 4)}.`;
  }
  function renderPreview() {
    const iso = $('f-date').value;
    const cat = $('f-cat').value.trim();
    const src = imageSrc();
    $('nv-card').innerHTML = '<div class="news-card">' +
      '<div class="news-card-img">' +
        (src
          ? `<img class="news-thumb${kind() === 'photo' ? ' news-thumb-photo' : ''}" src="${esc(src)}" alt=""/>`
          : '<span class="news-noimg"><img src="../assets/logo-gold.png" alt="" width="64" height="64"/></span>') +
        (cat ? `<span class="news-card-cat">${esc(cat)}</span>` : '') +
      '</div><div class="news-card-body">' +
        `<div class="news-card-date">${HD.isoDate(iso) ? esc(longDate(iso)) : '&nbsp;'}</div>` +
        `<h3 class="news-card-title">${esc($('f-title').value.trim() || 'Titel der Meldung')}</h3>` +
        `<p class="news-card-text">${esc($('f-teaser').value.trim() || 'Hier erscheint der Kurztext.')}</p>` +
        '<span class="link-arr">Mehr erfahren</span>' +
      '</div></div>';
    $('nv-where').textContent = whereText(iso);
    renderSuggest();
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

  function openEditor(i) {
    const e = i >= 0 ? entries[i] : null;
    editIndex = i;
    suggestOff = false;
    const form = $('nv-form');
    form.reset();
    A.clearErrors(form);
    $('f-date').value = e ? HD.isoDate(e.Datum) : A.isoToday();
    $('f-bis').value = e ? HD.isoDate(e.Bis) : '';
    $('f-cat').value = e ? e.Kategorie : '';
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
    document.querySelector(`input[name="kind"][value="${e && !e.Plakat && e.Vorschaubild ? 'photo' : 'poster'}"]`).checked = true;
    delete $('f-filename').dataset.touched;
    renderImage();
    renderPreview();
    updateCounter();

    $('nv-dlg-tag').textContent = e ? 'Meldung bearbeiten' : 'Neue Meldung';
    $('nv-dlg-title').textContent = e ? e.Titel : 'Neue Meldung';
    $('nv-delete').hidden = !e;
    $('nv-view').hidden = !e;
    if (e) $('nv-view').href = `../${A.newsOnHome(entries).has(e) ? 'index.html' : 'pages/archiv.html'}?news=${encodeURIComponent(newsId(e))}`;
    A.openDialog($('nv-dlg'), { isDirty: () => A.snapshot(form) !== snap || !!image || removeImage });
    snap = A.snapshot(form);
  }

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
    const teaser = clean($('f-teaser').value);
    const target = readLink();
    const link = target.link || '';
    const errors = [];
    const bis = HD.isoDate($('f-bis').value);
    if (!HD.isoDate(date)) errors.push([$('f-date'), 'Bitte das Datum der Meldung wählen.']);
    if (!bis) errors.push([$('f-bis'), 'Bitte eintragen, bis wann die Meldung auf der Startseite stehen soll.']);
    else if (HD.isoDate(date) && bis < date) errors.push([$('f-bis'), 'Das Enddatum liegt vor dem Datum der Meldung.']);
    if (!title) errors.push([$('f-title'), 'Bitte einen Titel eintragen.']);
    if (!teaser) errors.push([$('f-teaser'), 'Bitte einen Kurztext eintragen.']);
    if (target.error) errors.push(target.error);
    /* Zweite Schaltflaeche: Text und Adresse gehoeren zusammen */
    const text2 = clean($('f-linktext2').value);
    const link2 = $('f-link2').value.trim() ? webAddress($('f-link2').value) : '';
    if ($('f-link2').value.trim() && !link2) errors.push([$('f-link2'), 'Diese Adresse sieht nicht richtig aus, z. B. www.musikverein.at.']);
    else if (link2 && !text2) errors.push([$('f-linktext2'), 'Bitte den Text der zweiten Schaltfläche eintragen, z. B. Karten kaufen.']);
    else if (text2 && !link2) errors.push([$('f-link2'), 'Bitte die Adresse für die zweite Schaltfläche eintragen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }

    const old = editIndex >= 0 ? entries[editIndex] : null;
    const poster = kind() === 'poster';
    const entry = {
      Datum: isoToDe(date), Bis: isoToDe(bis), Kategorie: clean($('f-cat').value), Titel: title, Kurztext: teaser,
      Infos: readInfos(), Details: readDetails(), Vorschaubild: '', Plakat: '',
      Link: link, Linktext: link ? clean($('f-linktext').value) || defaultText() : '',
      'Weiterer Link': link2, 'Weiterer Linktext': link2 ? text2 : ''
    };
    /* Bisheriges Bild behalten (Art kann sich geaendert haben) */
    if (!image && !removeImage && current) {
      entry.Plakat = poster ? current : '';
      entry.Vorschaubild = poster ? '' : current;
    }
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
      const next = entries.slice();
      if (old) next[editIndex] = entry;
      else next.push(entry);
      sortEntries(next);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
      $('nv-dlg').close();
      render();
      flash(newsId(entry));
      A.toast(direct
        ? `Gespeichert: „${title}“${imgPath ? ' mit Bild' : ''}.`
        : `„${title}“ übernommen. Bitte unten ${imgPath ? 'beide Dateien' : 'die Datei'} herunterladen.`);
      A.log(`Meldung ${old ? 'geändert' : 'angelegt'}: ${title}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const e = entries[i];
    const ok = await A.confirmBox({
      title: 'Meldung löschen?',
      html: `<strong>${esc(e.Titel)}</strong> (${esc(e.Datum)})<br><br>Die Meldung verschwindet von der Website. Das Bild bleibt im Ordner erhalten.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      const next = entries.filter((x) => x !== e);
      const direct = await A.saveFile(PATH, toCSV(next));
      entries = next;
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
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    A.wireDrop($('nv-drop'));
    $('nv-img-remove').addEventListener('click', dropImage);
    $('nv-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('nv-dlg').close();
    });
    $('nv-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
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
    A.guard(() => $('nv-dlg').open && (A.snapshot($('nv-form')) !== snap || !!image || removeImage));
    A.folder.on((state) => { if (state === 'ok') { load(); loadTargets(); } });

    await Promise.all([load(), loadTargets()]);
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
