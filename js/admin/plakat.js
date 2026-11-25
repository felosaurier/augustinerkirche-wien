/* ============================================================
   Augustinerkirche Wien — plakat.js
   Gestaltet das Plakat eines Hochamts selbst und liefert es als
   Word-Datei (.docx, A4 hochkant) zum Drucken oder Weiterbearbeiten.

   Das Aussehen stammt aus dem Beispiel-Plakat (Hochamt vom 8. Dezember 2026,
   Haydn: Mariazellermesse). Dessen Dokument liegt unveraendert in
   assets/plakat/vorlage/ (Schriften, Bilder, Seiteneinstellungen, Fuss mit
   Adressen und QR-Codes, Wasserzeichen). Hier werden nur die Teile eingesetzt,
   die sich je Hochamt aendern: Datum, Zeit, Anlass, Zelebrant, Komponist,
   Werk, weitere Stuecke, Solisten, Chor, Orchester, Orgel, Dirigent.
   Nichts davon wird neu erfunden: jeder Absatz hat dieselben Schriften,
   Farben, Groessen, Schatten und Abstaende wie im Beispiel.

   Was das Beispiel nicht regelt, loest dieses Skript so, dass die Seite
   gleich aussieht und auf einer A4-Seite bleibt:
   - lange Texte werden gerade so viel verkleinert, dass sie in ihre Zeile passen
   - viele Stuecke, Solisten oder Organisten: die Leerraeume zwischen den
     Bloecken schrumpfen (nie unter ein Viertel), danach das grosse Werk
   - fehlt eine Angabe (Zelebrant, Solisten, Orchester ...), entfaellt ihr Block

   Aufbau: parse() liest den Termin, layout() setzt die Absaetze (reines XML,
   pruefbar ohne Browser), makeDocx() packt alles in eine .docx-Datei.
   ============================================================ */
(function (root) {
  'use strict';

  const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  /* Farben der Vorlage; layout() und makeDocx() setzen sie je Plakat (opts.colors: Hauptfarbe fuer Schrift,
     Akzentfarbe fuer Datum, Komponist, Striche) */
  const DEF_GOLD = '966E00';
  const DEF_NAVY = '000064';
  let GOLD = DEF_GOLD;
  let NAVY = DEF_NAVY;
  const hex6 = (h, d) => (/^#?[0-9a-f]{6}$/i.test(h || '') ? h.replace('#', '').toUpperCase() : d);
  function setColors(c = {}) {
    NAVY = hex6(c.main, DEF_NAVY);
    GOLD = hex6(c.accent, DEF_GOLD);
  }
  const GREY = '808080';

  /* ---------- Zeichenbreiten (Calibri, je 1000 em) zum Einpassen langer Texte ---------- */
  const mk = (s, w) => Object.fromEntries([...s].map((c, i) => [c, w[i]]));
  const BOLD = {
    ...mk('abcdefghijklmnopqrstuvwxyz', [494, 537, 418, 537, 503, 316, 474, 537, 246, 255, 480, 246, 813, 537, 538, 537, 537, 355, 399, 347, 537, 473, 745, 459, 474, 397]),
    ...mk('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [606, 561, 529, 630, 488, 459, 637, 631, 267, 331, 547, 423, 874, 659, 676, 532, 691, 563, 473, 495, 653, 591, 906, 564, 531, 478]),
    ...mk('0123456789', Array(10).fill(507)),
    ...mk(' .,:;-–|&„“"()+/!?', [226, 267, 258, 276, 276, 306, 498, 464, 705, 453, 453, 453, 312, 312, 498, 349, 266, 476])
  };
  const REG = {
    ...mk('abcdefghijklmnopqrstuvwxyz', [479, 525, 423, 525, 498, 305, 471, 525, 229, 239, 455, 229, 799, 525, 527, 525, 525, 349, 391, 335, 525, 452, 715, 433, 453, 395]),
    ...mk('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [579, 544, 533, 615, 488, 459, 631, 623, 252, 319, 520, 420, 855, 646, 662, 517, 673, 543, 459, 487, 642, 567, 890, 519, 487, 468]),
    ...mk('0123456789', Array(10).fill(507)),
    ...mk(' .,:;-–|&„“"()+/!?', [226, 252, 250, 268, 268, 306, 498, 460, 682, 440, 440, 440, 303, 303, 498, 327, 463, 463])
  };
  const baseChar = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  function adv(table, c) {
    if (table[c] !== undefined) return table[c];
    const b = baseChar(c);
    if (c === 'æ') return table.a + table.e;
    if (c === 'ß') return table.s * 2;
    return table[b] !== undefined ? table[b] : 520;
  }
  /* Breite in pt: pt = Schriftgroesse, spc = Zeichenabstand in pt, scale = Dehnung in % */
  function textWidth(text, { bold = false, pt, spc = 0, scale = 100 }) {
    const t = bold ? BOLD : REG;
    let w = 0;
    for (const c of String(text)) w += (adv(t, c) / 1000) * pt * (scale / 100) + spc;
    return w;
  }

  /* ---------- Hilfen fuer XML ---------- */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* Schatten je Schriftgroesse wie im Beispiel */
  const SHADOW = { 220: [63500, 50800], 76: [50800, 38100], 70: [50800, 38100], 44: [38100, 25400], 42: [38100, 25400], 36: [25400, 12700], 20: [12700, 6350] };
  const shadow = (sz) => {
    const key = SHADOW[sz] ? sz : sz > 100 ? 220 : sz > 60 ? 70 : sz > 40 ? 44 : sz > 28 ? 36 : 20;
    const [blur, dist] = SHADOW[key];
    return `<w14:shadow w14:blurRad="${blur}" w14:dist="${dist}" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:srgbClr w14:val="000000"><w14:alpha w14:val="60000"/></w14:srgbClr></w14:shadow>`;
  };
  const FONT = {
    cal: '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>',
    light: '<w:rFonts w:ascii="Calibri Light" w:eastAsia="Calibri" w:hAnsi="Calibri Light" w:cs="Arial"/>',
    major: '<w:rFonts w:asciiTheme="majorHAnsi" w:eastAsia="Calibri" w:hAnsiTheme="majorHAnsi" w:cstheme="majorHAnsi"/>'
  };
  /* Zeichenformat: font, b (fett), color, spacing (Zwanzigstel pt), w (Dehnung %), sz (halbe pt), szCs, sh (Schatten ja/nein) */
  function rpr({ font = 'cal', b = false, color, spacing, w, sz, szCs, sh = true }) {
    return '<w:rPr>' + FONT[font] + (b ? '<w:b/>' : '') + (color ? `<w:color w:val="${color}"/>` : '') +
      (spacing !== undefined ? `<w:spacing w:val="${spacing}"/>` : '') + (w ? `<w:w w:val="${w}"/>` : '') +
      `<w:sz w:val="${sz}"/><w:szCs w:val="${szCs || sz}"/>` + (sh ? shadow(sz) : '') + '</w:rPr>';
  }
  function run(text, o, { tab = false } = {}) {
    return `<w:r>${rpr(o)}${tab ? '<w:tab/>' : ''}${text === '' ? '' : `<w:t xml:space="preserve">${esc(text)}</w:t>`}</w:r>`;
  }
  const para = (ppr, runs, mark) => `<w:p><w:pPr>${ppr}${mark || ''}</w:pPr>${runs}</w:p>`;
  const spacingP = (o) => `<w:spacing${o.before ? ` w:before="${o.before}"` : ''} w:line="${o.line}" w:lineRule="exact"/>`;

  /* Zeichen, die im Beispiel nicht fett stehen (Satzzeichen, Anfuehrungszeichen, &) */
  const PUNCT = /[.,;:&„“”"'’()+/|!?*–—-]/;
  /* Text in Laeufe teilen: Woerter und Leerzeichen fett, Satzzeichen normal */
  function boldRuns(text, o) {
    let out = '';
    let buf = '';
    let bold = null;
    const flush = () => { if (buf) out += run(buf, { ...o, b: bold }); buf = ''; };
    for (const c of String(text)) {
      const b = !PUNCT.test(c);
      if (b !== bold) { flush(); bold = b; }
      buf += c;
    }
    flush();
    return out;
  }
  /* Breite eines fett/normal gemischten Textes in pt */
  function mixedWidth(text, { pt, spc = 0 }) {
    let w = 0;
    for (const c of String(text)) w += textWidth(c, { bold: !PUNCT.test(c), pt, spc });
    return w;
  }
  /* Groesste Schriftgroesse (halbe pt, in 2er-Schritten), bei der der Text in maxPt passt */
  function fitSz(text, sz, maxPt, { spc = 0, min = 24 } = {}) {
    let s = sz;
    while (s > min && mixedWidth(text, { pt: s / 2, spc }) > maxPt) s -= 2;
    return s;
  }

  /* ---------- Termin lesen ---------- */
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const list = (s) => String(s || '').split(/\s*(?:\||\r?\n)\s*/).map(clean).filter(Boolean);
  const END = /\s*Ende\s+(ca\.\s*)?(\d{1,2})[:.](\d{2})\s*(Uhr)?\.?/i;

  /* Geistliche Anreden vor dem Namen */
  const TITLES = new Set(['S.', 'Exz.', 'Dechant', 'Regionalvikar', 'Prior', 'Pfarrer', 'Pfarrvikar', 'Abt', 'Erzabt', 'Bischof', 'Diözesanbischof', 'Weihbischof', 'Erzbischof', 'Kardinal', 'Provinzial', 'Generalprior']);
  const norm = (s) => clean(s).toLowerCase();

  function parseCelebrant(text, people) {
    let s = clean(text);
    if (!s) return null;
    const paren = (s.match(/\(([^)]*)\)\s*$/) || [])[1] || '';
    s = s.replace(/\s*\([^)]*\)\s*$/, '');
    const words = s.split(' ');
    let n = 0;
    while (n < words.length - 1 && TITLES.has(words[n])) n++;
    const prefix = words.slice(0, n).join(' ');
    const name = words.slice(n).join(' ') || s;
    const hit = (people || []).find((p) => norm(p.name) === norm(name));
    let sub = hit && hit.rolle ? hit.rolle.replace(/\bWiener\s+/g, '') : prefix;
    if (!hit && paren && !/^sprecher$/i.test(paren)) sub = `${sub}${sub ? ' ' : ''}(${paren})`;
    return { name, sub };
  }

  /* "Name (1732-1809): Rest" oder "Name: Rest" oder nur "Rest" */
  const YEARS = /[∗*]\s*\d{4}|\d{4}\s*[-–]\s*\d{4}|\d{4}/;
  function parseItem(text) {
    const s = clean(text);
    let m = s.match(/^([^:„“"()]{3,70}?)\s*\(([^)]{3,60})\)\s*:\s*(.*)$/);
    if (m && YEARS.test(m[2])) return { name: m[1], years: m[2].match(YEARS)[0].replace(/\s+/g, ''), rest: m[3] };
    m = s.match(/^([^:„“"()\d]{3,70}?)\s*:\s*(.*)$/);
    if (m) return { name: m[1], years: '', rest: m[2] };
    return { name: '', years: '', rest: s };
  }
  /* Kurztitel eines Stuecks fuer das Plakat: bis zum ersten Werktitel in Anfuehrungszeichen, sonst bis zur Werkzahl */
  function shortTitle(rest) {
    const t = clean(rest).replace(/,?\s+aus:.*$/, '');
    const q = t.match(/^[^„“"]*[„"][^“"”]*[“"”]/);
    if (q) return q[0];
    const cut = t.search(/,?\s+(aus:|KV|op\.|Hob\.|BWV|HWV|D\s?\d|WAB|RV|MWV|WoO|Wq|SWV|TWV|Anh\.)/);
    return (cut > 0 ? t.slice(0, cut) : t).replace(/[\s,;:]+$/, '');
  }

  /* Das Hauptwerk (Messe): Komponist, Titel gross, Zusatz klein darunter */
  function parseMass(piece, items) {
    const pm = clean(piece).match(/^(.*?):\s*(.*)$/);
    const wTitle = (pm ? pm[2] : clean(piece)).replace(/\s*\([^)]*\)\s*$/, '').trim();
    const key = norm(wTitle).replace(/[„“”"]/g, '');
    let idx = items.findIndex((it) => key && norm(it.rest).replace(/[„“”"]/g, '').includes(key));
    if (idx < 0 && items.length && !items[0].name.startsWith('Am ')) idx = 0;
    const it = idx >= 0 ? items[idx] : null;
    let title = wTitle;
    let sub = '';
    if (it) {
      const q = it.rest.match(/^[„"]([^“"”]*)[“"”]/);
      if (q) {
        title = q[1];
        sub = it.rest.slice(q[0].length).replace(/^[\s,]+/, '');
      } else {
        /* Ohne Komponist ist der Eintrag nur eine andere Schreibweise des Werks: kein Zusatz */
        sub = !it.name ? '' : norm(it.rest).startsWith(norm(title)) ? it.rest.slice(title.length).replace(/^[\s,]+/, '') : it.rest;
      }
    }
    return { index: idx, composer: it && it.name ? it.name : (pm ? pm[1].trim() : ''), years: it ? it.years : '', title, sub };
  }

  /* Chor und Orchester zu einer Zeile: "Chor & Orchester von St. Augustin" */
  function ensemble(choir, orch) {
    choir = clean(choir);
    orch = clean(orch);
    if (choir && orch) {
      const c = choir.match(/^(.*?)\s+(von .*)$/);
      const o = orch.match(/^(.*?)\s+(von .*)$/);
      if (c && o && c[2] === o[2]) return [`${c[1]} & ${o[1]} ${c[2]}`];
      return [choir, orch];
    }
    return choir || orch ? [choir || orch] : [];
  }

  /* lookup(name) -> { name, jahre } ergaenzt abgekuerzte Komponisten ("J. Haydn" -> "Joseph Haydn", 1732-1809) */
  function parse(e, people, lookup) {
    const d = new Date(`${e.date}T00:00:00`);
    const em = END.exec(e.note || '');
    const loc = clean(e.location) || 'Augustinerkirche';
    const where = loc === 'Augustinerkirche' ? 'in der Augustinerkirche' : loc === 'Wiener Musikverein' ? 'im Wiener Musikverein' : `in ${loc}`;
    const items = list(e.extra).map(parseItem);
    const mass = parseMass(e.piece, items);
    const full = (name, years) => {
      const hit = name && !years && lookup ? lookup(name) : null;
      return hit ? { name: hit.name, years: hit.jahre } : { name, years };
    };
    Object.assign(mass, (({ name, years }) => ({ composer: name, years }))(full(mass.composer, mass.years)));
    const seen = new Set(mass.composer ? [norm(mass.composer)] : []);
    const pieces = [];
    items.forEach((it, i) => {
      if (i === mass.index || !it.rest) return;
      const title = shortTitle(it.rest);
      const who = full(it.name, it.years);
      const first = who.name && !seen.has(norm(who.name));
      if (who.name) seen.add(norm(who.name));
      pieces.push({ name: who.name, years: first ? who.years : '', title });
    });
    const soloists = list(e.soloists).map((s) => {
      const m = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      return m ? { name: m[1].trim(), voice: m[2].trim() } : { name: s, voice: '' };
    });
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: MONATE[d.getMonth()],
      weekday: WOCHENTAGE[d.getDay()],
      time: e.time || '11:00',
      end: em ? { ca: !!em[1], time: `${em[2]}:${em[3]}` } : null,
      type: clean(e.type) || 'Hochamt',
      where,
      celebrant: parseCelebrant(e.celebrant, people),
      mass,
      pieces,
      soloists,
      ensemble: ensemble(e.choir, e.orchestra),
      organists: list(e.organist).map((o) => ({ name: o, label: 'Orgel' })),
      conductors: list(e.conductor).map((c) => {
        const m = c.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
        return m ? { name: m[1].trim(), label: m[2].trim() } : { name: c, label: 'Dirigent' };
      })
    };
  }

  /* ---------- Gestalten ---------- */
  const LINE = 1.2207;                    /* Zeilenhoehe Calibri im Verhaeltnis zur Schriftgroesse */
  const PAGE_PT = 801.8;                  /* nutzbare Hoehe zwischen den Seitenraendern, abzueglich 0,4 pt Spiel */
  const TEXT_PT = 510;                    /* Satzbreite A4 */
  const HEAD_PT = 296;                    /* Textbreite neben Tag und Wappen */

  /* Stimmlagen; alles andere (Orgel, Trompete, Violine, Sprecher ...) gilt als Instrument bzw. eigene Rolle */
  const SINGERS = /^(Sopran|Mezzosopran|Alt|Altus|Countertenor|Tenor|Bariton|Bassbariton|Bass|Knabensopran|Knabenalt)(\s+[IV]+)?$/i;
  const grey = (sz, w) => ({ font: 'light', color: GREY, w, sz, sh: false });
  const centered = '<w:jc w:val="center"/>';

  /* Leerer Zwischenraum; sz = Schriftgroesse der Absatzmarke in halben pt (bestimmt die Hoehe) */
  function spacer(sz, kind) {
    const tabs = kind === 'right' ? '<w:tabs><w:tab w:val="right" w:pos="10546"/></w:tabs>' : kind === 'left' ? '<w:tabs><w:tab w:val="left" w:pos="5273"/></w:tabs>' : '';
    const small = kind === 'right' || kind === 'left';
    return `<w:p><w:pPr>${tabs}${centered}<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"${small ? '' : ' w:cs="Calibri"'}/><w:color w:val="00B0F0"/>${small ? '<w:spacing w:val="-16"/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:pPr></w:p>`;
  }
  const spacerPt = (sz) => (sz / 2) * LINE;

  /* Das grosse Werk in einer oder zwei Zeilen; gemeinsame Groesse, damit es in die Breite passt */
  function splitTitle(title) {
    const words = clean(title).split(' ');
    const wid = (t) => textWidth(t, { bold: true, pt: 110, spc: -5 });
    const cand = [];
    const last = words[words.length - 1];
    const m = last.match(/^(.{3,})(messe)$/i);
    if (m) cand.push([[...words.slice(0, -1), `${m[1]}-`].join(' '), m[2]]);
    for (let i = 1; i < words.length; i++) cand.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    if (!cand.length) return [words.join(' ')];
    /* die Teilung, die am wenigsten verkleinert werden muss (zweite Zeile hat die Striche) */
    const need = (c) => Math.max(wid(c[0]) / TITLE_PT, wid(c[1]) / LEADER_PT);
    cand.sort((a, b) => need(a) - need(b));
    return cand[0];
  }
  const TITLE_PT = 496;                   /* grosses Werk ohne Striche */
  const LEADER_PT = 450;                  /* Zeile mit Strichen: links und rechts bleiben mind. 30 pt Strich */
  /* Striche links und rechts: Text in der Seitenmitte, Strich rechts bis zum Rand, dadurch gleich lang */
  const LEADER_TABS = '<w:tabs><w:tab w:val="center" w:leader="underscore" w:pos="5102"/><w:tab w:val="right" w:leader="underscore" w:pos="10204"/></w:tabs>';

  function layout(m, opts = {}) {
    setColors(opts.colors);
    const warn = [];
    /* ----- Kopf: Tag, Monat, Zeit, Anlass ----- */
    const kopfTag = para('<w:spacing w:line="2000" w:lineRule="exact"/><w:ind w:left="-109"/>',
      run(m.day, { b: true, color: GOLD, spacing: -60, w: 80, sz: 220, szCs: 160 }),
      rpr({ color: GOLD, spacing: -60, sz: 78, sh: false }));
    const mo = { b: true, color: GOLD, spacing: -10, sz: 76 };
    const kopfMonat = para('<w:spacing w:before="120" w:line="700" w:lineRule="exact"/><w:ind w:left="142"/>', run(m.month, mo), rpr(mo));

    const t = { color: GOLD, spacing: -6, sz: 44 };
    const tb = { ...t, b: true };
    const sp = { ...tb, sz: 30 };
    const hm = (s) => { const [h, mi] = s.split(':'); return run(h, tb) + run(':', t) + run(mi, tb); };
    let zeit = run(m.weekday, tb) + run(', ', t) + hm(m.time);
    if (m.end) {
      zeit += run(' ', sp) + run('-', tb) + run(' ', sp) + (m.end.ca ? run('ca.', { ...t, sz: 42 }) + run(' ', sp) : '') + hm(m.end.time);
    }
    zeit += run(' Uhr', tb);
    const kopfZeit = para('<w:spacing w:line="340" w:lineRule="exact"/><w:ind w:left="170"/>', zeit, rpr(tb));
    const artText = `${m.type} ${m.where}`;
    const artSz = fitSz(artText, 44, HEAD_PT, { spc: -0.3, min: 28 });
    const art = { b: true, color: NAVY, spacing: -6, sz: artSz };
    const kopfArt = para('<w:spacing w:line="620" w:lineRule="exact"/><w:ind w:left="170"/>', boldRuns(artText, art), rpr(art));

    /* ----- Koerper ----- */
    const blocks = [];   /* { sp: Nenngroesse des Zwischenraums davor, kind, xml, pt } */
    const add = (spSz, kind, xml, pt) => blocks.push({ spSz, kind, xml, pt });

    if (m.celebrant) {
      const n = m.celebrant.name;
      const sz = fitSz(n, 44, TEXT_PT - 20, { spc: -0.5, min: 28 });
      const o = { b: true, color: NAVY, spacing: -10, sz };
      let xml = para(spacingP({ line: 440 }) + centered, boldRuns(n, o), rpr(o));
      let pt = 22;
      if (m.celebrant.sub) {
        const sub = m.celebrant.sub;
        const subSz = textWidth(sub, { pt: 15, scale: 95 }) > TEXT_PT - 20 ? 24 : 30;
        xml += para(spacingP({ line: 260 }) + centered, run(sub, grey(subSz, 95)), rpr(grey(subSz, 95)));
        pt += 13;
      }
      add(30, '', xml, pt);
    }

    /* Komponist und Werk: bleiben zusammen */
    {
      let xml = '';
      let pt = 0;
      const tabs = LEADER_TABS;
      if (m.mass.composer) {
        const sz = fitSz(m.mass.composer, 70, 440, { spc: -0.5, min: 40 });
        const o = { b: true, color: GOLD, spacing: -10, sz };
        const tab = { ...o, sz: 8 };
        xml += para(tabs + spacingP({ line: 700 }), run('', tab, { tab: true }) + run(m.mass.composer, o) + run('', tab, { tab: true }), rpr(o));
        pt += 35;
        if (m.mass.years) {
          xml += para(spacingP({ line: 240 }) + centered, run(m.mass.years, grey(30, 95)), rpr(grey(30, 95)));
          pt += 12;
        }
      }
      const lines = splitTitle(m.mass.title);
      const wid = (s) => textWidth(s, { bold: true, pt: 110, spc: -5 });
      /* Vorgabe der Kirchenmusik: das Werk immer 110 pt, Schmal 5 pt, Zeile 1 genau 100 pt, Zeile 2 genau 75 pt.
         Nie verkleinert (zu lange Titel korrigiert man in Word von Hand). */
      const sz = 220;
      const big = { b: true, color: NAVY, spacing: -100, sz, szCs: 160 };
      const l1 = 2000;
      const l2 = 1500;
      const bigRuns = (s) => {
        let out = '';
        let buf = '';
        let b = null;
        const flush = () => { if (buf) out += run(buf, { ...big, b }); buf = ''; };
        for (const c of s) { const x = c !== '-'; if (x !== b) { flush(); b = x; } buf += c; }
        flush();
        return out;
      };
      const tab = { ...big, sz: 8, szCs: 6 };
      if (lines.length === 2) {
        xml += para(spacingP({ line: l1 }) + centered, bigRuns(lines[0]), rpr(big));
        xml += para(tabs + spacingP({ line: l2 }), run('', tab, { tab: true }) + bigRuns(lines[1]) + run('', tab, { tab: true }), rpr(big));
        pt += (l1 + l2) / 20;
      } else {
        xml += para(tabs + spacingP({ line: l2 }), run('', tab, { tab: true }) + bigRuns(lines[0]) + run('', tab, { tab: true }), rpr(big));
        pt += l2 / 20;
      }
      if (m.mass.sub) {
        const subSz = textWidth(m.mass.sub, { pt: 15, scale: 95 }) > TEXT_PT - 20 ? 24 : 30;
        xml += para(spacingP({ line: 160 }) + centered, run(m.mass.sub, grey(subSz, 95)), rpr(grey(subSz, 95)));
        pt += 8;
      }
      add(70, '', xml, pt);
    }

    /* Weitere Stuecke: "Komponist  Jahre  |  Titel" */
    if (m.pieces.length) {
      let xml = '';
      let pt = 0;
      m.pieces.forEach((p, i) => {
        let sz = 36;
        const width = (s) => (p.name ? textWidth(p.name, { bold: true, pt: s / 2 }) + textWidth('    ', { bold: true, pt: 15 }) +
          (p.years ? textWidth(p.years, { pt: 15, scale: 90 }) + textWidth('  ', { bold: true, pt: 15 }) : 0) +
          textWidth('|', { pt: s / 2 }) + textWidth('  ', { bold: true, pt: 15 }) : 0) + mixedWidth(p.title, { pt: s / 2 });
        while (sz > 28 && width(sz) > TEXT_PT - 2) sz -= 2;
        const lines = Math.max(1, Math.ceil(width(sz) / (TEXT_PT - 2)));
        const nm = { b: true, color: GOLD, sz };
        const two = { b: true, sz: 30, sh: false };
        const ti = { color: NAVY, sz };
        let runs = '';
        if (p.name) {
          runs += run(p.years ? `${p.name}  ` : p.name, nm);
          if (p.years) runs += run(p.years, grey(30, 90));
          runs += run('  ', two) + run('|', { font: 'major', color: GOLD, spacing: -2, sz }) + run('  ', two);
        }
        runs += boldRuns(p.title, ti);
        xml += para(spacingP({ before: i ? 120 : 0, line: 320 }) + centered, runs, rpr(ti));
        pt += lines * 16 + (i ? 6 : 0);
      });
      add(70, '', xml, pt);
    }

    /* Solisten: Saengerinnen und Saenger bei gerader Zahl zwei je Zeile in zwei Spalten (wie im Beispiel),
       sonst untereinander; Instrumente (Orgel, Trompete ...) immer untereinander */
    if (m.soloists.length) {
      let xml = '';
      let pt = 0;
      const tabs = '<w:tabs><w:tab w:val="center" w:pos="2835"/><w:tab w:val="center" w:pos="7711"/><w:tab w:val="center" w:pos="7910"/></w:tabs>';
      const nm = { b: true, color: NAVY, spacing: -10, sz: 44 };
      const voice = (v) => (v ? run(`  ${v}`, grey(30, 90)) : '');
      const singers = m.soloists.filter((s) => SINGERS.test(s.voice));
      const others = m.soloists.filter((s) => !SINGERS.test(s.voice));
      const rows = [];
      if (singers.length % 2 === 0) for (let i = 0; i < singers.length; i += 2) rows.push([singers[i], singers[i + 1]]);
      else singers.forEach((s) => rows.push([s]));
      others.forEach((s) => rows.push([s]));
      for (const [a, b] of rows) {
        const sz = (s) => fitSz(s.name, 44, b ? 235 : TEXT_PT - 80, { spc: -0.5, min: 30 });
        if (b) {
          xml += para(tabs + spacingP({ line: 440 }),
            run(a.name, { ...nm, sz: sz(a) }, { tab: true }) + voice(a.voice) + run(b.name, { ...nm, sz: sz(b) }, { tab: true }) + voice(b.voice), rpr(grey(30, 90)));
        } else {
          xml += para(spacingP({ line: 440 }) + centered, run(a.name, { ...nm, sz: sz(a) }) + voice(a.voice), rpr(nm));
        }
        pt += 22;
      }
      add(70, '', xml, pt);
    }

    /* Chor, Orchester und Orgel */
    if (m.ensemble.length || m.organists.length) {
      let xml = '';
      let pt = 0;
      const nm = (s) => ({ b: true, color: NAVY, spacing: -10, sz: fitSz(s, 44, TEXT_PT - 20, { spc: -0.5, min: 28 }) });
      for (const s of m.ensemble) {
        xml += para(spacingP({ line: 440 }) + centered, boldRuns(s, nm(s)), rpr(nm(s)));
        pt += 22;
      }
      for (const o of m.organists) {
        xml += para('<w:tabs><w:tab w:val="right" w:pos="10546"/></w:tabs>' + spacingP({ line: 440 }) + centered,
          boldRuns(o.name, nm(o.name)) + run(`  ${o.label}`, grey(30, 90)), rpr(nm(o.name)));
        pt += 22;
      }
      add(20, 'right', xml, pt);
    }

    /* Dirigent */
    if (m.conductors.length) {
      let xml = '';
      let pt = 0;
      for (const c of m.conductors) {
        const o = { b: true, color: NAVY, spacing: -10, sz: fitSz(c.name, 44, TEXT_PT - 20, { spc: -0.5, min: 28 }) };
        xml += para(spacingP({ line: 440 }) + centered, boldRuns(c.name, o) + run(`  ${c.label}`, grey(30, 90)), rpr(o));
        pt += 22;
      }
      add(20, 'left', xml, pt);
    }

    /* ----- Seite fuellen wie im Beispiel -----
       fest: Kopf (91,3) und die Fusszeile (Absatz mit Wasserzeichen 42,7, Adressen 46,75, Schlussmarke 1,2).
       Zu langes Programm: Zwischenraeume schrumpfen (bis ein Viertel). Sonst bleiben sie immer gleich gross
       (Vorgabe der Kirchenmusik: 15, 35, 10 pt); der Rest der Seite bleibt vor dem Fuss frei. */
    const z = (sz) => Math.max(6, Math.round(sz * f));
    const fixed = 91.3 + spacerPt(70) + 46.75 + 1.2;
    const total = (x) => {
      const s = (sz) => spacerPt(Math.max(6, Math.round(sz * x)));
      return fixed + s(30) + s(22) + blocks.reduce((sum, b, i) => sum + b.pt + (i ? s(b.spSz) : 0), 0);
    };
    let f = 1;
    while (total(f) > PAGE_PT && f > 0.25) f = Math.round((f - 0.05) * 100) / 100;
    if (total(f) > PAGE_PT) warn.push('Das Programm ist sehr lang: Es passt nur knapp oder nicht mehr auf eine Seite.');
    let koerper = spacer(z(30), '');
    blocks.forEach((b, i) => {
      if (i) koerper += spacer(z(b.spSz), b.kind === 'right' || b.kind === 'left' ? b.kind : '');
      koerper += b.xml;
    });
    /* Die Platzhalter haben immer dieselbe Groesse (15, 35, 10 pt); bleibt Platz uebrig, fuellt ihn der letzte Platzhalter vor dem Fuss */
    const rest = Math.max(0, PAGE_PT - 3 - total(f));
    koerper += spacer(Math.min(1638, z(22) + Math.floor((rest / LINE) * 2)), '');
    return { kopf: { tag: kopfTag, monat: kopfMonat, zeit: kopfZeit, art: kopfArt }, koerper, warn, factor: f, height: total(f) };
  }

  /* Vorlage mit den Absaetzen fuellen */
  function fillTemplate(template, L) {
    return template
      .replace(/w:color="966E00"/g, `w:color="${GOLD}"`)
      .replace('<!--KOPF_TAG-->', () => L.kopf.tag)
      .replace('<!--KOPF_MONAT-->', () => L.kopf.monat)
      .replace('<!--KOPF_ZEIT-->', () => L.kopf.zeit)
      .replace('<!--KOPF_ART-->', () => L.kopf.art)
      .replace('<!--KOERPER-->', () => L.koerper);
  }

  /* Dateiname wie im Beispiel: 2026-12-08_Haydn-Mariazellermesse.docx */
  function fileName(e, m) {
    const surname = (m.mass.composer || '').split(' ').filter(Boolean).pop() || '';
    const title = m.mass.title.replace(/[\\/:*?"<>|„“]/g, '').trim().replace(/\s+/g, '-');
    return `${e.date}_${[surname, title].filter(Boolean).join('-') || m.type}.docx`.replace(/-+\./, '.');
  }

  /* ---------- ZIP (ohne Kompression, wie ein .docx es braucht) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files, now = new Date()) {
    const enc = new TextEncoder();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return [...parts, ...central, new Uint8Array(end.buffer)];
  }

  /* Alle Teile der Vorlage (document.xml kommt gefuellt dazu) */
  const PARTS = [
    '[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml', 'word/_rels/document.xml.rels',
    'word/document.xml', 'word/footer1.xml', 'word/_rels/footer1.xml.rels', 'word/styles.xml', 'word/settings.xml', 'word/webSettings.xml', 'word/fontTable.xml', 'word/theme/theme1.xml',
    'word/media/image1.png', 'word/media/image2.png', 'word/media/image3.png', 'word/media/image4.png'
  ];

  /* fetchPart(pfad) -> Uint8Array; people: Mitbrueder aus data/personen.json (fuer die Rolle des Zelebranten) */
  /* colors: {main, accent} (#rrggbb); images: {'word/media/image1.png': Uint8Array, …} ersetzen Bilder der Vorlage
     (Logo, Zeichnung und QR-Codes in den gewaehlten Farben, erzeugt in js/admin/admin-plakat.js) */
  async function makeDocx(e, { people = [], lookup, fetchPart, colors, images = {} }) {
    const m = parse(e, people, lookup);
    const L = layout(m, { colors });
    const files = [];
    for (const name of PARTS) {
      let data = images[name] || await fetchPart(name);
      if (name === 'word/document.xml') data = new TextEncoder().encode(fillTemplate(new TextDecoder().decode(data), L));
      if (name === 'word/footer1.xml') {
        data = new TextEncoder().encode(new TextDecoder().decode(data)
          .replace(/w:val="000064"/g, `w:val="${NAVY}"`).replace(/w:val="966E00"/g, `w:val="${GOLD}"`));
      }
      files.push({ name, data });
    }
    return { parts: zip(files), name: fileName(e, m), warnings: L.warn, model: m };
  }

  const api = { parse, layout, fillTemplate, fileName, makeDocx, textWidth, mixedWidth, PARTS, colors: () => ({ main: `#${NAVY}`, accent: `#${GOLD}` }), DEF: { main: `#${DEF_NAVY}`, accent: `#${DEF_GOLD}` } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Plakat = api;
})(typeof window !== 'undefined' ? window : globalThis);
