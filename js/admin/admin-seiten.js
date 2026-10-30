/* ============================================================
   Augustinerkirche Wien — admin-seiten.js
   Seiten der Website pflegen (admin/seiten.html?seite=…, Liste in
   Admin.SEITEN), Quelle ist data/seite-<seite>.json:
   {kopf, bereiche, abschnitte}; js/inhalte.js baut die Seite daraus.
   - kopf: Titelbereich (kleine Zeile, Titel, Text, Knoepfe)
   - bereiche: Teile der Seite unter dem Kopf (Inhalt mit Bausteinen,
     Bild mit Text, die Leiste, Module wie Aktuelles)
   - abschnitte: Eintraege der linken Leiste mit Bausteinen
   Gibt es die Datei noch nicht, wird der Stand aus dem HTML der Seite
   uebernommen. Alles, was sich als Baustein beschreiben laesst, wird
   bearbeitbar; sonst ein HTML-Baustein. Module (Teile, die anderswo
   gepflegt werden oder Funktionen der Website sind) bleiben aus dem HTML.
   Formulare entstehen aus TYPES (Felder je Bausteinart).
   Vorschau: ungespeicherter Stand in localStorage, die Seite liest ihn mit
   ?vorschau=<seite>.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const LIST = A.SEITEN;
  const QKEY = new URLSearchParams(location.search).get('seite');
  const [KEY, FILE, NAME] = LIST.find((x) => x[0] === QKEY) || LIST[0];
  const PATH = `data/seite-${KEY}.json`;
  const IMG_DIR = `assets/img/seiten/${KEY}/`;
  const PREVIEW_KEY = `aug-vorschau-${KEY}`;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  let uid = 0;

  /* ---------- Bausteinarten und ihre Felder ----------
     Feldarten: line (eine Zeile), area (Text mit Formatierungsleiste), small (kurzer
     Text mit Leiste), lines (ein Eintrag pro Zeile), cells (Zellen mit | getrennt),
     check, select, code (HTML), image (Bild im selben Objekt: bild, breite, hoehe),
     group (Felder in einem Unterobjekt), rows (wiederholbare Zeilen mit eigenen Feldern) */
  const LINK = [{ k: 'text', t: 'line', label: 'Text' }, { k: 'link', t: 'line', label: 'Adresse', hint: 'z. B. pages/pfarre.html, #p-chor oder https://…' }];
  const TYPES = {
    text: { name: 'Text', fields: [{ k: 'text', t: 'area', hint: 'Eine leere Zeile beginnt einen neuen Absatz.' }] },
    einleitung: { name: 'Einleitung (größer)', fields: [{ k: 'text', t: 'area', hint: 'Eine leere Zeile beginnt einen neuen Absatz.' }] },
    zwischentitel: { name: 'Zwischentitel', fields: [{ k: 'text', t: 'line', label: 'Text' }, { k: 'stil', t: 'select', label: 'Größe', opts: [['', 'Normal'], ['klein', 'Klein']] }] },
    zeile: { name: 'Kleine Zeile', fields: [{ k: 'text', t: 'line', label: 'Text' }] },
    liste: { name: 'Liste', fields: [{ k: 'punkte', t: 'lines', label: 'Punkte', hint: 'Ein Punkt pro Zeile; **fett** und Links gehen auch hier.' }] },
    bild: { name: 'Bild', fields: [
      { k: 'bild', t: 'image' },
      { k: 'alt', t: 'line', label: 'Beschreibung', hint: 'für Blinde und Suchmaschinen' },
      { k: 'unterschrift', t: 'line', label: 'Bildunterschrift', opt: true },
      { k: 'credit', t: 'line', label: 'Bildnachweis', opt: true },
      { k: 'stil', t: 'select', label: 'Anordnung', opts: [['', 'Normal'], ['rechts', 'Rechts neben dem Text'], ['breit', 'Volle Breite'], ['gruppe', 'Gruppenfoto']] }
    ] },
    karten: { name: 'Karten', fields: [
      { k: 'stil', t: 'select', label: 'Anordnung', opts: [['', 'Untereinander'], ['zwei', 'Zwei nebeneinander'], ['drei', 'Drei nebeneinander'], ['intro', 'Zwei große (Startseite)']] },
      { k: 'karten', t: 'rows', label: 'Karte', fields: [
        { k: 'titel', t: 'line', label: 'Titel' },
        { k: 'kurz', t: 'small', label: 'Kurztext', opt: true },
        { k: 'text', t: 'area', label: 'Text', opt: true },
        { k: 'daten', t: 'rows', label: 'Angabe', opt: true, fields: [{ k: 'begriff', t: 'line', label: 'Begriff' }, { k: 'wert', t: 'line', label: 'Wert' }] },
        { k: 'kontakt', t: 'small', label: 'Kontakt', opt: true },
        { k: 'links', t: 'rows', label: 'Link', opt: true, fields: LINK },
        { k: 'knoepfe', t: 'rows', label: 'Knopf', opt: true, fields: LINK },
        { k: 'id', t: 'line', label: 'Sprungmarke', opt: true, hint: 'für Links wie index.html#kloster' },
        { k: 'ziel', t: 'line', label: 'Ganze Karte verlinkt auf', opt: true, hint: 'dann ohne eigene Links und Knöpfe' },
        { k: 'zieltext', t: 'line', label: 'Text mit Pfeil', opt: true, hint: 'z. B. Zur Seite' }
      ] }
    ] },
    personenkarten: { name: 'Personen mit Foto', fields: [
      { k: 'stil', t: 'select', label: 'Größe', opts: [['', 'Groß'], ['kompakt', 'Kompakt']] },
      { k: 'personen', t: 'rows', label: 'Person', fields: [
        { k: 'bild', t: 'image' }, { k: 'alt', t: 'line', label: 'Beschreibung des Fotos', opt: true },
        { k: 'name', t: 'line', label: 'Name' }, { k: 'rolle', t: 'line', label: 'Funktion', opt: true }, { k: 'text', t: 'area', label: 'Text', opt: true }
      ] }
    ] },
    orgeln: { name: 'Orgeln', fields: [
      { k: 'orgeln', t: 'rows', label: 'Orgel', fields: [
        { k: 'bild', t: 'image' }, { k: 'alt', t: 'line', label: 'Beschreibung des Fotos', opt: true }, { k: 'titel', t: 'line', label: 'Titel' },
        { k: 'daten', t: 'rows', label: 'Angabe', opt: true, fields: [{ k: 'begriff', t: 'line', label: 'Begriff' }, { k: 'wert', t: 'line', label: 'Wert' }] },
        { k: 'text', t: 'area', label: 'Text', opt: true }
      ] }
    ] },
    gottesdienstzeiten: { name: 'Gottesdienstzeiten', fields: [{ k: 'zeiten', t: 'rows', label: 'Termin', fields: [
      { k: 'tag', t: 'line', label: 'Tag' }, { k: 'zeit', t: 'line', label: 'Uhrzeit' }, { k: 'name', t: 'line', label: 'Bezeichnung' }, { k: 'hinweis', t: 'small', label: 'Hinweis', opt: true }
    ] }] },
    zitatkasten: { name: 'Kasten mit Zitat', fields: [
      { k: 'zeile', t: 'line', label: 'Kleine Zeile', opt: true }, { k: 'name', t: 'line', label: 'Name' },
      { k: 'text', t: 'small', label: 'Text', opt: true }, { k: 'zitat', t: 'small', label: 'Zitat', opt: true }
    ] },
    programme: { name: 'Programmhefte', fields: [{ k: 'jahre', t: 'rows', label: 'Jahr', fields: [
      { k: 'jahr', t: 'line', label: 'Jahr' }, { k: 'links', t: 'rows', label: 'Heft', fields: LINK }
    ] }] },
    kontaktkarte: { name: 'Kontaktkarte', fields: [
      { k: 'titel', t: 'line', label: 'Titel' },
      { k: 'text', t: 'small', label: 'Text', opt: true },
      { k: 'zeilen', t: 'rows', label: 'Zeile', fields: [
        { k: 'label', t: 'line', label: 'Bezeichnung', hint: 'z. B. E-Mail, Telefon' },
        { k: 'wert', t: 'small', label: 'Angabe' },
        { k: 'zeiten', t: 'check', label: 'Als Öffnungszeiten setzen' }
      ] }
    ] },
    personen: { name: 'Personenliste', fields: [
      { k: 'personen', t: 'rows', label: 'Person', fields: [
        { k: 'name', t: 'line', label: 'Name' },
        { k: 'rolle', t: 'line', label: 'Funktion', opt: true },
        { k: 'aufgaben', t: 'lines', label: 'Aufgaben', opt: true, hint: 'Eine pro Zeile' },
        { k: 'kontakt', t: 'small', label: 'Kontakt', opt: true }
      ] }
    ] },
    zeitleiste: { name: 'Zeitleiste', fields: [{ k: 'eintraege', t: 'rows', label: 'Eintrag', fields: [{ k: 'jahr', t: 'line', label: 'Jahr' }, { k: 'text', t: 'small', label: 'Text' }] }] },
    kennzahlen: { name: 'Kennzahlen', fields: [{ k: 'zahlen', t: 'rows', label: 'Zahl', fields: [{ k: 'zahl', t: 'line', label: 'Zahl' }, { k: 'text', t: 'line', label: 'Bedeutung' }] }] },
    daten: { name: 'Angaben (Begriff und Wert)', fields: [{ k: 'daten', t: 'rows', label: 'Angabe', fields: [{ k: 'begriff', t: 'line', label: 'Begriff' }, { k: 'wert', t: 'small', label: 'Wert' }] }] },
    gutzuwissen: { name: 'Kasten „Gut zu wissen“', fields: [{ k: 'titel', t: 'line', label: 'Titel', hint: 'leer = Gut zu wissen' }, { k: 'punkte', t: 'lines', label: 'Punkte', hint: 'Ein Punkt pro Zeile' }] },
    links: { name: 'Links mit Pfeil', fields: [{ k: 'links', t: 'rows', label: 'Link', fields: LINK }] },
    linkliste: { name: 'Linkliste', fields: [{ k: 'links', t: 'rows', label: 'Link', fields: [...LINK, { k: 'hinweis', t: 'line', label: 'Hinweis', opt: true }] }] },
    heilige: { name: 'Liste mit Datum', fields: [{ k: 'eintraege', t: 'rows', label: 'Eintrag', fields: [{ k: 'datum', t: 'line', label: 'Datum' }, { k: 'name', t: 'line', label: 'Name' }] }] },
    tabelle: { name: 'Tabelle', fields: [{ k: 'zeilen', t: 'rows', label: 'Zeile', fields: [{ k: 'zellen', t: 'cells', label: 'Zellen', hint: 'Spalten mit | trennen' }, { k: 'kopf', t: 'check', label: 'Überschriftszeile' }] }] },
    sakrament: { name: 'Sakrament', fields: [
      { k: 'titel', t: 'line', label: 'Titel' },
      { k: 'kurz', t: 'line', label: 'Name in der Sprungleiste', opt: true },
      { k: 'text', t: 'area', label: 'Text' },
      { k: 'fakten', t: 'group', label: 'Kasten „Gut zu wissen“', fields: [{ k: 'titel', t: 'line', label: 'Titel', opt: true }, { k: 'punkte', t: 'lines', label: 'Punkte', opt: true, hint: 'Ein Punkt pro Zeile' }] },
      { k: 'anker', t: 'line', label: 'Sprungmarke', hint: 'nötig für die Sprungleiste, z. B. as-taufe' }
    ] },
    sprungleiste: { name: 'Sprungleiste', info: 'Zeigt automatisch alle Sakrament-Bausteine dieses Abschnitts als Leiste zum Hinspringen.', fields: [{ k: 'titel', t: 'line', label: 'Titel', hint: 'leer = Zu den Sakramenten' }] },
    html: { name: 'HTML', fields: [{ k: 'html', t: 'code', label: 'HTML', hint: 'Für Besonderes, das kein anderer Baustein kann. Skripte und unsichere Angaben werden entfernt.' }] },
    modul: { name: 'Modul', fields: [] },
    fest: { name: 'Modul', fields: [] }
  };
  const ADD = ['text', 'einleitung', 'zwischentitel', 'bild', 'liste', 'karten', 'kontaktkarte', 'personenkarten', 'personen', 'gottesdienstzeiten', 'zitatkasten', 'orgeln', 'programme', 'zeitleiste', 'kennzahlen', 'daten', 'gutzuwissen', 'links', 'linkliste', 'heilige', 'tabelle', 'sakrament', 'sprungleiste', 'zeile', 'html'];
  function defaults(fields) {
    const o = {};
    for (const f of fields) o[f.k] = f.t === 'rows' || f.t === 'lines' || f.t === 'cells' ? [] : f.t === 'check' ? false : f.t === 'group' ? defaults(f.fields) : '';
    return o;
  }
  function newBlock(art) {
    const b = { art, ...defaults(TYPES[art].fields) };
    for (const f of TYPES[art].fields) if (f.t === 'rows') b[f.k] = [defaults(f.fields)];
    if (art === 'bild') Object.assign(b, { breite: 0, hoehe: 0, _credit0: '' });
    return b;
  }

  /* ---------- Module: Teile, die anderswo gepflegt werden ---------- */
  const SCRIPT_IDS = ['hero-show', 'hs-list', 'kal-archive-list', 'kal-list', 'kontakt', 'news-grid', 'news-more', 'solisten-list', 'solisten-sort-alpha', 'solisten-sort-voice', 'solisten-status'];
  const MOD_SEL = ['.quote-band', '[data-inhalt]', '[data-personen]', '[data-show]', '[data-seite]', 'input', 'select', 'textarea', 'form', 'button', ...SCRIPT_IDS.map((i) => `#${i}`)].join(',');
  const isModul = (el) => el.matches(MOD_SEL) || !!el.querySelector(MOD_SEL);
  const MOD_NAMES = {
    kontakt: ['Kontaktleiste', 'kontakt.html'], liturgie: ['Liturgie-Zeiten', 'gottesdienste.html'], runden: ['Runden', 'runden.html'],
    rundgang: ['Kirchenrundgang', 'rundgang.html'], repertoire: ['Repertoire', 'repertoire.html'], 'repertoire-text': ['Einleitung des Repertoires', 'repertoire.html'],
    paten: ['Paten', 'paten.html'], ehrenpaten: ['Paten', 'paten.html'], stufen: ['Spenden & Möglichkeiten', 'spenden.html'], paypal: ['PayPal-Knopf', 'spenden.html'],
    galerie: ['Galerie', 'galerie.html'], cds: ['CDs', 'cds.html'], 'pgr-mitglieder': ['Pfarrgemeinderat', 'pgr.html'], 'pgr-weitere': ['Pfarrgemeinderat', 'pgr.html'],
    kanzlei: ['Öffnungszeiten der Pfarrkanzlei', 'kontakt.html']
  };
  function modInfo(el) {
    const has = (sel) => (el.matches(sel) ? el : el.querySelector(sel));
    if (has('.quote-band')) return ['Spruch (wechselt, aus Sprüche)', 'sprueche.html'];
    if (has('#news-grid')) return ['Aktuelles (Neuigkeiten)', 'neuigkeiten.html'];
    if (has('#hs-list')) return ['Die nächsten Hochämter', 'hochaemter.html'];
    if (has('#kal-list, #kal-archive-list')) return ['Hochämter', 'hochaemter.html'];
    if (has('[id^="solisten-"]')) return ['Solisten', 'solisten.html'];
    const dp = has('[data-personen]');
    if (dp) return dp.dataset.personen === 'mitbrueder' ? ['Mitbrüder', 'personen.html?bereich=kloster'] : ['Leitung & Organisten', 'personen.html?bereich=musik'];
    const di = has('[data-inhalt]');
    if (di && MOD_NAMES[di.dataset.inhalt]) return MOD_NAMES[di.dataset.inhalt];
    return ['Funktion der Website (Suche, Filter, Kalender …)', ''];
  }
  /* Gleiche Regel wie modKey in js/inhalte.js */
  function modKey(el) {
    if (el.id) return `#${el.id}`;
    const d = el.querySelector('[id]');
    if (d) return `>#${d.id}`;
    const di = el.matches('[data-inhalt]') ? el : el.querySelector('[data-inhalt]');
    if (di) return `[data-inhalt=${di.dataset.inhalt}]`;
    const dp = el.matches('[data-personen]') ? el : el.querySelector('[data-personen]');
    if (dp) return `[data-personen=${dp.dataset.personen}]`;
    return `.${el.className.trim().split(/\s+/)[0]}`;
  }
  let modules = new Map(); /* key -> {name, wo, vorschau} */
  function modulBlock(el) {
    const key = modKey(el);
    const [name, wo] = modInfo(el);
    modules.set(key, { name, wo, vorschau: clean(el.textContent).slice(0, 140) });
    return { art: 'modul', key };
  }

  /* ---------- HTML der Seite in Bausteine umwandeln ---------- */
  const INLINE = new Set(['EM', 'I', 'STRONG', 'B', 'U', 'S', 'BR', 'A', 'SPAN']);
  function simple(el) {
    if (!el) return true;
    for (const d of el.querySelectorAll('*')) {
      if (!INLINE.has(d.tagName) || d.hasAttribute('style')) return false;
      if (d.tagName === 'SPAN' && !/^fs-(gross|klein)$/.test(d.className)) return false;
      if (d.tagName === 'A' && d.className && !/^(mail|link-arr)$/.test(d.className)) return false;
    }
    return true;
  }
  const mailAddr = (code) => [...String(code).replace('|', '@')].reverse().join('');
  const mailText = (addr) => addr.replace('@', '(at)').replace(/\./g, '(dot)');
  /* Adresse relativ zur Wurzel der Website (wie in den Datendateien) */
  function siteLink(href) {
    const h = String(href || '').trim();
    if (/^#/.test(h)) return h;
    try {
      const u = new URL(h, `https://seite.invalid/${FILE}`);
      if (u.host !== 'seite.invalid') return u.href;
      return u.pathname.slice(1) + u.hash;
    } catch {
      return h;
    }
  }
  function markup(node) {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += n.textContent.replace(/\s+/g, ' '); continue; }
      if (n.nodeType !== 1) continue;
      const inner = markup(n);
      switch (n.tagName) {
        case 'BR': out += '\n'; break;
        case 'EM': case 'I': out += `*${inner}*`; break;
        case 'STRONG': case 'B': out += `**${inner}**`; break;
        case 'U': out += `__${inner}__`; break;
        case 'S': out += `~~${inner}~~`; break;
        case 'SPAN': out += n.className === 'fs-gross' ? `[groß]${inner}[/groß]` : n.className === 'fs-klein' ? `[klein]${inner}[/klein]` : inner; break;
        case 'A': {
          if (n.classList.contains('mail')) {
            const addr = mailAddr(n.dataset.mail || '');
            const text = clean(n.textContent) === mailText(addr) ? addr : inner.trim();
            if (n.dataset.subject) out += `[${text}](mailto:${addr}?subject=${n.dataset.subject})`;
            else out += text === addr ? addr : `[${text}](mailto:${addr})`;
          } else {
            const href = n.getAttribute('href') || '';
            /* Sprungmarke dieser Seite: mit Seitenadresse, weil Text-Links von der Wurzel aus gelten */
            out += /^tel:/i.test(href) ? `[${inner}](tel:${href.slice(4)})` : `[${inner}](${/^#/.test(href) ? FILE + href : siteLink(href)})`;
          }
          break;
        }
        default: out += inner;
      }
    }
    return out;
  }
  const md = (el) => (el ? markup(el).replace(/ *\n */g, '\n').trim() : '');
  const txt = (el) => (el ? clean(el.textContent) : '');
  const kids = (el) => Array.from(el.children);
  const one = (el, sel) => el.querySelector(sel);
  /* Ein Teil gilt nur, wenn alles darin erkannt wurde; sonst wird es ein HTML-Baustein */
  class Fail extends Error {}
  const need = (ok) => { if (!ok) throw new Fail(); };
  const rich = (el) => { need(simple(el)); return md(el); };
  const linkOf = (a) => ({ text: txt(a), link: siteLink(a.getAttribute('href')) });

  function cardOf(card) {
    need(card.classList.contains('card'));
    const k = { titel: '', kurz: '', text: '', daten: [], kontakt: '', links: [], knoepfe: [], id: card.id || '', ziel: '', zieltext: '' };
    if (card.tagName === 'A') k.ziel = siteLink(card.getAttribute('href'));
    const more = [];
    for (const p of kids(card)) {
      const c = p.classList;
      if (c.contains('card-title')) k.titel = txt(p);
      else if (c.contains('card-text')) k.kurz = rich(p);
      else if (c.contains('card-more')) more.push(rich(p));
      else if (c.contains('card-contact')) k.kontakt = rich(p);
      else if (c.contains('organ-facts')) k.daten = kids(p).map((d) => ({ begriff: txt(one(d, 'dt')), wert: rich(one(d, 'dd')) }));
      else if (c.contains('card-links')) k.links = Array.from(p.querySelectorAll('a'), linkOf);
      else if (c.contains('card-actions')) k.knoepfe = Array.from(p.querySelectorAll('a'), linkOf);
      else if (card.tagName === 'A' && p.matches('span.link-arr')) k.zieltext = txt(p);
      else need(false);
    }
    k.text = more.join('\n\n');
    return k;
  }
  function figOf(el) {
    const img = el.tagName === 'IMG' ? el : one(el, 'img');
    need(img && (el.tagName === 'IMG' || el.querySelectorAll('img').length === 1));
    const cap = el.tagName === 'IMG' ? null : one(el, 'figcaption');
    return {
      art: 'bild', bild: siteLink(img.getAttribute('src')), alt: img.getAttribute('alt') || '', unterschrift: cap ? rich(cap) : '',
      breite: HD.num(img.getAttribute('width'), 0), hoehe: HD.num(img.getAttribute('height'), 0),
      stil: el.tagName === 'IMG' ? 'breit' : el.classList.contains('side') ? 'rechts' : el.classList.contains('mitbrueder-foto') ? 'gruppe' : ''
    };
  }
  /* Ein Element -> Baustein; chips: Namen der Sprungleiste je Sprungmarke */
  function convertEl(el, chips) {
    const c = el.classList;
    const tag = el.tagName;
    if (c.contains('sakr-band')) return { art: 'sprungleiste', titel: txt(one(el, '.sakr-band-label')) };
    if (isModul(el)) return modulBlock(el);
    try {
      if (tag === 'DIV' && el.className === 's-label') return { art: 'zeile', text: txt(el) };
      if (tag === 'P' && (c.contains('bio-p') || c.contains('s-text')) && c.length === 1 && !/display/.test(el.getAttribute('style') || '') && simple(el)) {
        return { art: c.contains('s-text') ? 'einleitung' : 'text', text: md(el) };
      }
      const onlyLinks = tag === 'P' && el.children.length && kids(el).every((a) => a.matches('a.link-arr')) &&
        !clean(Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''));
      if (onlyLinks || (tag === 'A' && c.contains('link-arr'))) return { art: 'links', stil: tag === 'A' ? 'frei' : '', links: (tag === 'A' ? [el] : kids(el)).map(linkOf) };
      if (tag === 'H3' && (c.contains('pane-sub') || c.contains('card-title')) && simple(el)) return { art: 'zwischentitel', text: txt(el), stil: c.contains('card-title') ? 'klein' : '' };
      if (tag === 'UL' && c.contains('pgr-tasks')) return { art: 'liste', punkte: kids(el).map((li) => { need(li.tagName === 'LI'); return rich(li); }) };
      if ((tag === 'FIGURE' && (c.contains('pane-fig') || c.contains('mitbrueder-foto'))) || tag === 'IMG') return figOf(el);
      if (tag === 'DIV' && (c.contains('cards-stack') || c.contains('cards-2') || c.contains('cards-3'))) {
        const stil = c.contains('cards-intro') ? 'intro' : c.contains('cards-2') ? 'zwei' : c.contains('cards-3') ? 'drei' : '';
        return { art: 'karten', stil, karten: kids(el).map(cardOf) };
      }
      if (c.contains('card')) return { art: 'karten', stil: '', karten: [cardOf(el)] };
      if (c.contains('kontakt-card')) {
        const b = { art: 'kontaktkarte', titel: '', text: '', zeilen: [] };
        for (const p of kids(el)) {
          if (p.classList.contains('kontakt-title')) b.titel = txt(p);
          else if (p.classList.contains('kontakt-text')) b.text = rich(p);
          else if (p.classList.contains('kontakt-rows')) {
            b.zeilen = kids(p).map((r) => {
              const v = one(r, '.kontakt-val');
              need(v);
              return { label: txt(one(r, '.kontakt-label')), wert: rich(v), zeiten: v.classList.contains('kontakt-hours') };
            });
          } else need(false);
        }
        return b;
      }
      if (tag === 'UL' && c.contains('pgr-list')) {
        return { art: 'personen', personen: kids(el).map((li) => ({
          name: txt(one(li, '.pgr-name')), rolle: txt(one(li, '.pgr-role')),
          aufgaben: Array.from(li.querySelectorAll('.pgr-tasks li'), rich), kontakt: rich(one(li, '.pgr-contact'))
        })) };
      }
      if (c.contains('timeline')) return { art: 'zeitleiste', eintraege: kids(el).map((i) => ({ jahr: txt(one(i, '.timeline-year')), text: rich(one(i, '.timeline-text')) })) };
      if (c.contains('facts')) return { art: 'kennzahlen', zahlen: kids(el).map((f) => ({ zahl: txt(one(f, '.fact-n')), text: txt(one(f, '.fact-l')) })) };
      if (tag === 'DL' && c.contains('organ-facts')) return { art: 'daten', daten: kids(el).map((d) => ({ begriff: txt(one(d, 'dt')), wert: rich(one(d, 'dd')) })) };
      if (c.contains('sakr-facts')) return { art: 'gutzuwissen', titel: txt(one(el, '.sakr-facts-title')), punkte: Array.from(el.querySelectorAll('li'), rich) };
      if (tag === 'UL' && c.contains('link-list')) return { art: 'linkliste', links: kids(el).map((li) => ({ ...linkOf(one(li, 'a')), hinweis: txt(one(li, 'span')) })) };
      if (tag === 'UL' && c.contains('saint-list')) return { art: 'heilige', eintraege: kids(el).map((li) => ({ datum: txt(one(li, '.saint-date')), name: txt(li.lastElementChild) })) };
      if (tag === 'TABLE' && c.contains('fee-table')) {
        return { art: 'tabelle', zeilen: Array.from(el.querySelectorAll('tr'), (tr) => {
          const th = one(tr, 'th');
          return th ? { kopf: true, zellen: [txt(th)] } : { kopf: false, zellen: Array.from(tr.querySelectorAll('td'), rich) };
        }) };
      }
      if (c.contains('people-stack')) {
        let stil = '';
        const personen = kids(el).map((card) => {
          need(card.classList.contains('person-card-wide'));
          if (card.classList.contains('compact')) stil = 'kompakt';
          const img = one(card, ':scope > img');
          const body = one(card, '.person-body');
          need(body);
          const x = { bild: img ? siteLink(img.getAttribute('src')) : '', alt: img ? img.getAttribute('alt') || '' : '', breite: img ? HD.num(img.getAttribute('width'), 0) : 0, hoehe: img ? HD.num(img.getAttribute('height'), 0) : 0, name: '', rolle: '', text: '' };
          const bio = [];
          for (const q of kids(body)) {
            if (q.classList.contains('person-name')) x.name = txt(q);
            else if (q.classList.contains('person-role')) x.rolle = txt(q);
            else if (q.classList.contains('person-bio')) bio.push(rich(q));
            else need(false);
          }
          x.text = bio.join('\n\n');
          return x;
        });
        return { art: 'personenkarten', stil, personen };
      }
      if (c.contains('organ-grid')) {
        return { art: 'orgeln', orgeln: kids(el).map((card) => {
          const img = one(card, '.organ-img');
          const body = one(card, '.organ-body');
          need(body);
          const o = { bild: img ? siteLink(img.getAttribute('src')) : '', alt: img ? img.getAttribute('alt') || '' : '', breite: img ? HD.num(img.getAttribute('width'), 0) : 0, hoehe: img ? HD.num(img.getAttribute('height'), 0) : 0, titel: '', daten: [], text: '' };
          const ps = [];
          for (const q of kids(body)) {
            if (q.classList.contains('organ-title')) o.titel = txt(q);
            else if (q.classList.contains('organ-facts')) o.daten = kids(q).map((d) => ({ begriff: txt(one(d, 'dt')), wert: rich(one(d, 'dd')) }));
            else if (q.classList.contains('organ-desc')) ps.push(rich(q));
            else need(false);
          }
          o.text = ps.join('\n\n');
          return o;
        }) };
      }
      const gd = tag === 'TABLE' && c.contains('gd-table') ? el : (tag === 'DIV' && el.children.length === 1 && el.firstElementChild.matches('table.gd-table') ? el.firstElementChild : null);
      if (gd) {
        return { art: 'gottesdienstzeiten', zeiten: Array.from(gd.querySelectorAll('tr'), (tr) => ({
          tag: txt(one(tr, '.gd-day')), zeit: txt(one(tr, '.gd-time')), name: txt(one(tr, '.gd-name')), hinweis: rich(one(tr, '.gd-note'))
        })) };
      }
      if (c.contains('patron-box')) {
        return { art: 'zitatkasten', zeile: txt(one(el, '.s-label')), name: txt(one(el, '.patron-name')), text: rich(one(el, '.patron-text')), zitat: txt(one(el, '.patron-quote')) };
      }
      if (tag === 'UL' && c.contains('prog-list')) {
        return { art: 'programme', jahre: kids(el).map((li) => ({ jahr: txt(one(li, '.prog-year')), links: Array.from(li.querySelectorAll('.prog-links a'), linkOf) })) };
      }
      if (c.contains('sakr-sec')) {
        const b = { art: 'sakrament', titel: '', kurz: chips.get(el.id) || '', text: '', fakten: { titel: '', punkte: [] }, anker: el.id || '' };
        const ps = [];
        for (const p of kids(el)) {
          if (p.classList.contains('sakr-sec-nr')) continue;
          if (p.classList.contains('sakr-sec-title')) b.titel = txt(p);
          else if (p.tagName === 'P' && p.classList.contains('bio-p')) ps.push(rich(p));
          else if (p.classList.contains('sakr-facts')) b.fakten = { titel: txt(one(p, '.sakr-facts-title')), punkte: Array.from(p.querySelectorAll('li'), rich) };
          else need(false);
        }
        b.text = ps.join('\n\n');
        return b;
      }
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
    }
    return { art: 'html', html: el.outerHTML.replace(/\n\s+/g, '\n').trim() };
  }
  function convertList(els) {
    const chips = new Map();
    for (const el of els) for (const ch of el.querySelectorAll('.sakr-chip[data-target]')) chips.set(ch.dataset.target, txt(one(ch, '.sakr-chip-name')));
    const out = [];
    for (const el of els) {
      const b = convertEl(el, chips);
      const last = out[out.length - 1];
      /* Aufeinanderfolgende Absaetze werden ein Text (Absaetze durch Leerzeile) */
      if (last && (b.art === 'text' || b.art === 'einleitung') && last.art === b.art) last.text += `\n\n${b.text}`;
      else out.push(b);
    }
    return out;
  }

  function convertPane(pane) {
    const els = kids(pane);
    const out = { zeile: '', ueberschrift: '' };
    let i = 0;
    if (els[i] && els[i].matches('div.s-label')) out.zeile = txt(els[i++]);
    if (els[i] && els[i].matches('h2.s-title') && simple(els[i])) out.ueberschrift = txt(els[i++]);
    out.bloecke = convertList(els.slice(i));
    return out;
  }
  function convertKopf(main) {
    const hero = one(main, ':scope > .hero .hero-content');
    if (hero) {
      return {
        zeile: txt(one(hero, '.hero-eyebrow')), titel: md(one(hero, '.hero-h1')), text: md(one(hero, '.hero-sub')),
        knoepfe: Array.from(hero.querySelectorAll('.hero-actions a'), linkOf), _hero: true
      };
    }
    const ph = one(main, ':scope > .page-hero');
    if (ph) return { zeile: txt(one(ph, '.ph-tag')), titel: md(one(ph, '.ph-title')), text: md(one(ph, '.ph-sub')) };
    return null;
  }
  function convertBereich(el) {
    if (el.querySelector('.with-sidebar')) return { art: 'leiste' };
    if (isModul(el)) return modulBlock(el);
    if (el.classList.contains('herzgruft')) {
      const img = one(el, '.herzgruft-img');
      const m = /url\(['"]?([^'")]+)['"]?\)/.exec((img && img.getAttribute('style')) || '');
      const a = one(el, 'a.link-arr');
      return {
        art: 'teaser', zeile: txt(one(el, '.s-label')), titel: txt(one(el, 'h2')),
        text: Array.from(el.querySelectorAll('p.s-text'), md).join('\n\n'),
        linktext: txt(a), link: a ? siteLink(a.getAttribute('href')) : '', bild: m ? siteLink(m[1]) : ''
      };
    }
    const inner = one(el, ':scope > .inner');
    if (inner) {
      const head = one(inner, ':scope > .sec-head');
      const h2 = head && one(head, 'h2');
      const sub = h2 && one(h2, '.s-title-sub');
      return {
        art: 'inhalt', id: el.id || '',
        ueberschrift: h2 ? clean(Array.from(h2.childNodes).filter((n) => n !== sub).map((n) => n.textContent).join('')) : '',
        unter: txt(sub), bloecke: convertList(kids(inner).filter((x) => x !== head))
      };
    }
    return { art: 'html', html: el.outerHTML.replace(/\n\s+/g, '\n').trim() };
  }
  function readPage(html) {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const main = page.querySelector('main');
    if (!main) throw new Error('Die Seite hat keinen Inhaltsbereich');
    modules = new Map();
    const out = { kopf: convertKopf(main), bereiche: [], abschnitte: [] };
    for (const el of kids(main)) {
      if (el.matches('.hero, .page-hero')) continue;
      out.bereiche.push(convertBereich(el));
    }
    const box = main.querySelector('.with-sidebar');
    if (box) {
      const area = box.querySelector('.sidebar').nextElementSibling;
      let gruppe = '';
      for (const el of box.querySelectorAll('.sidebar .sidebar-group-label, .sidebar .sidebar-item[data-pane]')) {
        if (el.classList.contains('sidebar-group-label')) { gruppe = txt(el); continue; }
        const pane = area.querySelector(`#${CSS.escape(el.dataset.pane)}`);
        if (pane) out.abschnitte.push({ id: pane.id, titel: txt(el), gruppe, ...convertPane(pane) });
      }
    }
    return out;
  }

  /* ---------- Daten ---------- */
  let doc = { kopf: null, bereiche: [], abschnitte: [] };
  let ready = false;      /* erst nach fehlerfreiem Laden darf gespeichert werden */
  let hero = false;
  let open = new Set();
  let snap = '';
  let rowSchemas = [];

  const getPath = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
  /* Fehlende Unterobjekte (z. B. ein Kasten in aelteren Daten) werden angelegt */
  function setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let o = doc;
    for (const k of keys) {
      if (o[k] == null) o[k] = {};
      o = o[k];
    }
    o[last] = value;
  }
  const uidOf = (o) => { if (!o._uid) o._uid = `u${++uid}`; return o._uid; };
  function walk(o, fn) {
    if (Array.isArray(o)) o.forEach((x) => walk(x, fn));
    else if (o && typeof o === 'object') {
      fn(o);
      Object.values(o).forEach((x) => walk(x, fn));
    }
  }
  /* Was gespeichert wird: ohne Hilfsfelder (_…) und Bildnachweise; Vorschau mit neuen Bildern */
  function strip(o, preview) {
    if (Array.isArray(o)) return o.map((x) => strip(x, preview));
    if (!o || typeof o !== 'object') return o;
    const r = {};
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('_') && k !== 'credit') r[k] = strip(v, preview);
    if (preview && o._data) r.bild = o._data;
    return r;
  }
  const output = (preview) => strip(doc, preview);

  async function load() {
    ready = false;
    let fromPage;
    try {
      fromPage = readPage(await A.fetchText(FILE));
    } catch (e) {
      $('sx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Seite <code>${esc(FILE)}</code> konnte nicht gelesen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    hero = !!(fromPage.kopf && fromPage.kopf._hero);
    await A.credits.load();
    let saved = null;
    try {
      const d = await A.readJSON(PATH);
      if (!d || typeof d !== 'object') throw new Error('unerwarteter Inhalt');
      saved = d;
    } catch (e) {
      if (!notFound(e)) {
        $('sx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${esc(PATH)}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    /* Was nicht gespeichert ist, kommt aus dem HTML */
    doc = saved
      ? { kopf: saved.kopf || fromPage.kopf, bereiche: Array.isArray(saved.bereiche) ? saved.bereiche : fromPage.bereiche, abschnitte: Array.isArray(saved.abschnitte) ? saved.abschnitte : fromPage.abschnitte }
      : fromPage;
    if (doc.kopf) delete doc.kopf._hero;
    walk(doc, (o) => {
      if (o.art === 'bild' && o.credit === undefined) {
        o.credit = A.credits.get(o.bild);
        o._credit0 = o.credit;
      }
    });
    $('sx-note').innerHTML = saved
      ? ''
      : `<div class="adm-alert">${icon('info')}<div>Diese Seite wurde hier noch nie gespeichert. Angezeigt wird der jetzige Stand der Website. Erst nach dem Speichern kommt die Seite aus der Verwaltung.</div></div>`;
    open = new Set();
    render();
    snap = state();
    setState('');
    ready = true;
  }

  /* ---------- Formular aus den Feldern ---------- */
  const rowsFor = (s) => Math.min(18, Math.max(2, Math.ceil(String(s || '').length / 85) + String(s || '').split('\n').length));
  const tools = (arr, i, n, name) =>
    '<span class="adm-sx-tools">' +
    `<button type="button" class="adm-act" data-act="up" data-p="${arr}" data-i="${i}" title="Nach oben" aria-label="${esc(name)} nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
    `<button type="button" class="adm-act" data-act="down" data-p="${arr}" data-i="${i}" title="Nach unten" aria-label="${esc(name)} nach unten"${i === n - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
    `<button type="button" class="adm-act" data-act="del" data-p="${arr}" data-i="${i}" title="Entfernen" aria-label="${esc(name)} entfernen">${icon('trash')}</button></span>`;
  const label = (f, id) => `<label class="adm-label" for="${id}">${esc(f.label || '')}${f.opt ? ' <span class="adm-opt">optional</span>' : ''}${f.hint ? ` <span class="adm-opt">${esc(f.hint)}</span>` : ''}</label>`;
  function fieldHTML(f, obj, path) {
    const p = `${path}.${f.k}`;
    const id = `f-${p.replace(/\./g, '-')}`;
    const v = obj[f.k];
    switch (f.t) {
      case 'line': return `<div class="adm-field">${label(f, id)}<input class="adm-input" type="text" id="${id}" data-p="${p}" value="${esc(v || '')}"/></div>`;
      case 'cells': return `<div class="adm-field">${label(f, id)}<input class="adm-input" type="text" id="${id}" data-p="${p}" data-kind="cells" value="${esc((v || []).join(' | '))}"/></div>`;
      case 'area': case 'small':
        return `<div class="adm-field full">${f.label || f.hint ? label(f, id) : ''}<textarea class="adm-input" id="${id}" data-p="${p}" rows="${f.t === 'small' ? Math.min(6, rowsFor(v)) : rowsFor(v) + 1}">${esc(v || '')}</textarea></div>`;
      case 'lines': return `<div class="adm-field full">${label(f, id)}<textarea class="adm-input" id="${id}" data-p="${p}" data-kind="lines" rows="${rowsFor((v || []).join('\n'))}">${esc((v || []).join('\n'))}</textarea></div>`;
      case 'code': return `<div class="adm-field full">${label(f, id)}<textarea class="adm-input adm-sx-code" id="${id}" data-p="${p}" data-no-format spellcheck="false" rows="${rowsFor(v) + 2}">${esc(v || '')}</textarea></div>`;
      case 'check': return `<div class="adm-field"><label class="adm-check"><input type="checkbox" data-p="${p}" data-kind="check"${v ? ' checked' : ''}/>${esc(f.label)}</label></div>`;
      case 'select': return `<div class="adm-field">${label(f, id)}<select class="adm-input" id="${id}" data-p="${p}">${f.opts.map(([val, name]) => `<option value="${esc(val)}"${(v || '') === val ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></div>`;
      case 'image': {
        const src = obj._url || (obj.bild ? A.imageUrl(obj.bild) : '');
        return '<div class="adm-field full"><div class="adm-sx-img">' + (src ? `<img src="${esc(src)}" alt=""/>` : '<span class="adm-muted">Noch kein Bild gewählt</span>') +
          `<label class="btn btn-outline adm-sx-pick">${icon('upload')}${src ? 'Anderes Bild' : 'Bild wählen'}<input type="file" accept="image/*" data-pick="${path}" class="visually-hidden"/></label></div></div>`;
      }
      case 'group': return `<fieldset class="adm-sx-group adm-field full"><legend class="adm-label">${esc(f.label)}</legend><div class="adm-grid">${f.fields.map((g) => fieldHTML(g, v || {}, p)).join('')}</div></fieldset>`;
      case 'rows': {
        const list = Array.isArray(v) ? v : [];
        const rid = rowSchemas.push(f.fields) - 1;
        return `<fieldset class="adm-sx-rows adm-field full"><legend class="adm-label">${esc(f.label)}${f.opt ? ' <span class="adm-opt">optional</span>' : ''}</legend>` +
          list.map((r, i) => `<div class="adm-sx-row"><div class="adm-sx-row-head"><span class="adm-sx-art">${esc(f.label)} ${i + 1}</span>${tools(p, i, list.length, `${f.label} ${i + 1}`)}</div>` +
            `<div class="adm-grid">${f.fields.map((g) => fieldHTML(g, r, `${p}.${i}`)).join('')}</div></div>`).join('') +
          `<button type="button" class="btn btn-outline adm-sx-rowadd" data-act="row-add" data-p="${p}" data-rid="${rid}">${icon('plus')}${esc(f.label)} hinzufügen</button></fieldset>`;
      }
      default: return '';
    }
  }
  function modulHTML(key) {
    const m = modules.get(key);
    return m
      ? `<p><strong>${esc(m.name)}</strong>${m.wo ? ` · wird unter <a href="${esc(m.wo)}">${esc(m.name)}</a> gepflegt` : ' · lässt sich hier nur verschieben oder entfernen'}</p>` +
        `<p class="adm-muted adm-sx-prev">${esc(m.vorschau)}${m.vorschau.length >= 140 ? ' …' : ''}</p>`
      : '<p class="adm-muted">Dieser Teil ist im HTML der Seite nicht mehr vorhanden und wird nicht angezeigt.</p>';
  }
  function blockHTML(b, path, i, n) {
    const T = TYPES[b.art];
    let body;
    if (!T) body = '<p class="adm-muted">Unbekannter Baustein, er wird nicht angezeigt.</p>';
    else if (b.art === 'modul' || b.art === 'fest') body = modulHTML(b.key);
    else body = (T.info ? `<p class="adm-muted">${esc(T.info)}</p>` : '') + `<div class="adm-grid">${T.fields.map((f) => fieldHTML(f, b, path)).join('')}</div>`;
    const name = T ? T.name : b.art;
    const arr = path.replace(/\.\d+$/, '');
    return `<div class="adm-sx-blk${b.art === 'modul' || b.art === 'fest' ? ' is-fest' : ''}">` +
      `<div class="adm-sx-blk-head"><span class="adm-sx-art">${esc(name)}</span>${tools(arr, i, n, name)}</div>${body}</div>`;
  }
  function blocksHTML(list, path) {
    const id = `add-${path.replace(/\./g, '-')}`;
    return `<div class="adm-sx-blocks">${(list || []).map((b, j) => blockHTML(b, `${path}.${j}`, j, list.length)).join('') || '<p class="adm-muted">Noch keine Bausteine.</p>'}</div>` +
      `<div class="adm-sx-add"><label class="adm-label" for="${id}">Baustein hinzufügen</label>` +
      `<select class="adm-input" id="${id}" data-add="${path}"><option value="">Art wählen …</option>${ADD.map((a) => `<option value="${a}">${esc(TYPES[a].name)}</option>`).join('')}</select></div>`;
  }
  function details(o, title, sub, toolsHTML, body) {
    const u = uidOf(o);
    return `<details class="adm-panel adm-sx-sec" data-uid="${u}"${open.has(u) ? ' open' : ''}><summary><span class="adm-sx-name">${esc(title)}</span>` +
      `${sub ? `<span class="adm-muted"> · ${esc(sub)}</span>` : ''}${toolsHTML}</summary><div class="adm-sx-body">${body}</div></details>`;
  }

  function kopfHTML() {
    const k = doc.kopf;
    if (!k) return '';
    const fields = [
      { k: 'zeile', t: 'line', label: 'Kleine Zeile über dem Titel' },
      { k: 'titel', t: 'small', label: 'Titel', hint: 'Enter = neue Zeile' },
      { k: 'text', t: 'small', label: 'Text' },
      ...(hero ? [{ k: 'knoepfe', t: 'rows', label: 'Knopf', fields: LINK }] : [])
    ];
    return '<h2 class="adm-group-title">Kopf der Seite</h2>' + details(k, 'Kopf', clean(k.titel).slice(0, 60), '', `<div class="adm-grid">${fields.map((f) => fieldHTML(f, k, 'kopf')).join('')}</div>`);
  }
  const TEASER = [
    { k: 'zeile', t: 'line', label: 'Kleine Zeile' }, { k: 'titel', t: 'line', label: 'Titel' }, { k: 'text', t: 'area', label: 'Text' },
    { k: 'linktext', t: 'line', label: 'Linktext', opt: true }, { k: 'link', t: 'line', label: 'Link', opt: true }, { k: 'bild', t: 'image' }
  ];
  function bereichHTML(b, i, n) {
    const p = `bereiche.${i}`;
    const t = tools('bereiche', i, n, 'Bereich');
    if (b.art === 'leiste') return details(b, 'Leiste mit Abschnitten', `${doc.abschnitte.length} Abschnitte, siehe unten`, t, '<p class="adm-muted">Die Abschnitte der Leiste stehen weiter unten.</p>');
    if (b.art === 'modul') return details(b, (modules.get(b.key) || { name: 'Modul' }).name, 'Modul', t, modulHTML(b.key));
    if (b.art === 'teaser') return details(b, b.titel || 'Bild mit Text', 'Bild mit Text', t, `<div class="adm-grid">${TEASER.map((f) => fieldHTML(f, b, p)).join('')}</div>`);
    if (b.art === 'html') return details(b, 'Freier Bereich', 'HTML', t, `<div class="adm-grid">${TYPES.html.fields.map((f) => fieldHTML(f, b, p)).join('')}</div>`);
    const fields = [{ k: 'ueberschrift', t: 'line', label: 'Überschrift', opt: true }, { k: 'unter', t: 'line', label: 'Zusatz zur Überschrift', opt: true }, { k: 'id', t: 'line', label: 'Sprungmarke', opt: true }];
    return details(b, b.ueberschrift || 'Inhalt', 'Inhalt', t, `<div class="adm-grid">${fields.map((f) => fieldHTML(f, b, p)).join('')}</div>${blocksHTML(b.bloecke, `${p}.bloecke`)}`);
  }
  function abschnittHTML(s, i, n) {
    const p = `abschnitte.${i}`;
    const fields = [
      { k: 'titel', t: 'line', label: 'Name in der Leiste' },
      { k: 'gruppe', t: 'line', label: 'Gruppe in der Leiste', hint: 'gleiche Gruppe = stehen beisammen' },
      { k: 'zeile', t: 'line', label: 'Kleine Zeile über der Überschrift', opt: true },
      { k: 'ueberschrift', t: 'line', label: 'Überschrift', hint: 'leer = keine' }
    ];
    return details(s, s.titel || 'Neuer Abschnitt', s.gruppe, tools('abschnitte', i, n, s.titel || 'Abschnitt'),
      `<div class="adm-grid">${fields.map((f) => fieldHTML(f, s, p)).join('')}</div>${blocksHTML(s.bloecke, `${p}.bloecke`)}`);
  }
  function render() {
    rowSchemas = [];
    const hasLeiste = doc.bereiche.some((b) => b.art === 'leiste');
    $('sx-list').innerHTML = kopfHTML() +
      '<h2 class="adm-group-title">Bereiche der Seite</h2>' +
      doc.bereiche.map((b, i) => bereichHTML(b, i, doc.bereiche.length)).join('') +
      `<button type="button" class="btn btn-outline adm-sx-new" data-act="new-bereich">${icon('plus')}Neuer Bereich</button>` +
      (hasLeiste
        ? '<h2 class="adm-group-title">Abschnitte der Leiste</h2>' + doc.abschnitte.map((s, i) => abschnittHTML(s, i, doc.abschnitte.length)).join('') +
          `<button type="button" class="btn btn-outline adm-sx-new" data-act="new-abschnitt">${icon('plus')}Neuer Abschnitt</button>`
        : '');
  }

  /* ---------- Formular -> Daten ---------- */
  function collect() {
    for (const det of document.querySelectorAll('#sx-list details[data-uid]')) {
      if (det.open) open.add(det.dataset.uid); else open.delete(det.dataset.uid);
    }
    for (const el of document.querySelectorAll('#sx-list [data-p]')) {
      if (el.tagName === 'BUTTON') continue;
      const kind = el.dataset.kind;
      let v;
      if (kind === 'check') v = el.checked;
      else if (kind === 'lines') v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
      else if (kind === 'cells') v = el.value.split('|').map((x) => x.trim());
      else if (el.tagName === 'TEXTAREA') v = el.value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
      else v = el.tagName === 'SELECT' ? el.value : clean(el.value);
      setPath(el.dataset.p, v);
    }
  }
  function state() {
    collect();
    const extra = [];
    walk(doc, (o) => { if (o.art === 'bild' || o._blob) extra.push([o.credit || '', !!o._blob]); });
    return JSON.stringify([output(false), extra]);
  }
  function setState(text) {
    $('sx-state').textContent = text;
    $('sx-state').classList.toggle('is-dirty', text === 'Noch nicht gespeichert');
  }
  const markDirty = () => setState(state() !== snap ? 'Noch nicht gespeichert' : '');

  async function onClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    ev.preventDefault();
    collect();
    const act = btn.dataset.act;
    const arr = btn.dataset.p ? getPath(btn.dataset.p) : null;
    const i = +btn.dataset.i;
    if (act === 'up' || act === 'down') {
      const j = i + (act === 'up' ? -1 : 1);
      if (!arr || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    } else if (act === 'del') {
      if (!arr) return;
      if (btn.dataset.p === 'abschnitte' || btn.dataset.p === 'bereiche') {
        const o = arr[i];
        const name = btn.dataset.p === 'abschnitte' ? (o.titel || 'Neuer Abschnitt') : (o.ueberschrift || o.titel || (modules.get(o.key) || {}).name || 'Bereich');
        const ok = await A.confirmBox({
          title: btn.dataset.p === 'abschnitte' ? 'Abschnitt entfernen?' : 'Bereich entfernen?',
          html: `<strong>${esc(name)}</strong><br><br>Er verschwindet nach dem Speichern von der Seite ${esc(NAME)}. Bilder bleiben im Ordner erhalten.`,
          ok: 'Entfernen', danger: true
        });
        if (!ok) return;
      }
      arr.splice(i, 1);
    } else if (act === 'row-add') {
      if (!Array.isArray(arr)) setPath(btn.dataset.p, []);
      getPath(btn.dataset.p).push(defaults(rowSchemas[+btn.dataset.rid]));
    } else if (act === 'new-bereich') {
      const b = { art: 'inhalt', id: '', ueberschrift: '', unter: '', bloecke: [newBlock('text')] };
      doc.bereiche.push(b);
      open.add(uidOf(b));
    } else if (act === 'new-abschnitt') {
      const s = { id: '', titel: '', gruppe: (doc.abschnitte[doc.abschnitte.length - 1] || {}).gruppe || '', zeile: '', ueberschrift: '', bloecke: [newBlock('text')] };
      doc.abschnitte.push(s);
      open.add(uidOf(s));
    } else return;
    render();
    markDirty();
  }

  async function onPick(input) {
    collect();
    const obj = getPath(input.dataset.pick);
    const file = input.files && input.files[0];
    if (!obj || !file) return;
    if (!file.type.startsWith('image/')) {
      A.toast(`„${file.name}“ ist keine Bilddatei.`, 'err');
      return;
    }
    try {
      const conv = await A.toWebp(file);
      const bmp = await createImageBitmap(conv.blob);
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(conv.blob);
      });
      if (obj._url) URL.revokeObjectURL(obj._url);
      Object.assign(obj, { _blob: conv.blob, _url: URL.createObjectURL(conv.blob), _data: data, _credit0: '', breite: bmp.width, hoehe: bmp.height });
      if (bmp.close) bmp.close();
    } catch {
      return; /* Meldung hat toWebp schon gezeigt */
    }
    render();
    markDirty();
  }

  /* ---------- Vorschau ---------- */
  function preview() {
    if (!ready) return;
    collect();
    try {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(output(true)));
    } catch {
      /* Zu gross (neue Bilder): ohne die neuen Bilder */
      try {
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(output(false)));
        A.toast('Die Vorschau zeigt neu gewählte Bilder erst nach dem Speichern.', 'err');
      } catch {
        A.toast('Die Vorschau ist in diesem Browser nicht möglich (Speicher gesperrt).', 'err');
        return;
      }
    }
    window.open(`../${FILE}?vorschau=${KEY}`, `aug-vorschau-${KEY}`);
  }

  /* ---------- Speichern ---------- */
  const slug = (s) => clean(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'abschnitt';
  async function save(ev) {
    ev.preventDefault();
    /* Nie eine halb geladene (leere) Seite speichern */
    if (!ready || !doc.bereiche.length) {
      A.toast('Die Seite ist nicht vollständig geladen und wird darum nicht gespeichert. Bitte neu laden.', 'err');
      return;
    }
    collect();
    const missing = doc.abschnitte.findIndex((s) => !s.titel);
    if (missing >= 0) {
      open.add(uidOf(doc.abschnitte[missing]));
      render();
      A.showErrors($('sx-form'), [[document.querySelector(`[data-p="abschnitte.${missing}.titel"]`), 'Bitte einen Namen für die Leiste eintragen.']]);
      return;
    }
    const ids = new Set(doc.abschnitte.filter((s) => s.id).map((s) => s.id));
    for (const s of doc.abschnitte) {
      if (s.id) continue;
      let id = `p-${slug(s.titel)}`;
      for (let n = 2; ids.has(id); n++) id = `p-${slug(s.titel)}-${n}`;
      s.id = id;
      ids.add(id);
    }
    try {
      /* Neue Bilder hochladen */
      const pending = [];
      walk(doc, (o) => { if (o._blob) pending.push(o); });
      for (const o of pending) {
        const path = `${IMG_DIR}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.webp`;
        await A.saveFile(path, o._blob);
        o.bild = path;
        delete o._blob;
        delete o._data;
      }
      const direct = await A.saveJSON(PATH, output(false));
      /* Nur geaenderte Bildnachweise (und die neuer Bilder) */
      const credits = {};
      walk(doc, (o) => {
        if (o.art !== 'bild' || !o.bild || clean(o.credit) === (o._credit0 || '')) return;
        credits[o.bild] = clean(o.credit);
        o._credit0 = clean(o.credit);
      });
      if (Object.keys(credits).length) await A.credits.save(credits);
      $('sx-note').innerHTML = '';
      render();
      snap = state();
      setState(direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.');
      A.toast(direct ? `Seite ${NAME} gespeichert.` : 'Übernommen. Bitte unten die Dateien herunterladen.');
      A.log(`Seite ${NAME} geändert`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    document.title = `${NAME} — Verwaltung Augustinerkirche Wien`;
    $('sx-title').innerHTML = `Seite <em>${esc(NAME)}</em>`;
    $('sx-view').href = `../${FILE}`;
    const form = $('sx-form');
    form.addEventListener('submit', save);
    form.addEventListener('click', onClick);
    form.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('input[data-pick]')) { onPick(t); return; }
      if (t.matches('select[data-add]')) {
        if (!t.value) return;
        collect();
        const list = getPath(t.dataset.add);
        const b = newBlock(t.value);
        if (Array.isArray(list)) list.push(b); else setPath(t.dataset.add, [b]);
        render();
        markDirty();
        return;
      }
      markDirty();
    });
    let timer = 0;
    form.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(markDirty, 250);
    });
    $('sx-preview').addEventListener('click', preview);
    A.guard(() => state() !== snap);
    A.folder.on((st) => { if (st === 'ok') load(); });
    await load();
  });
})();
