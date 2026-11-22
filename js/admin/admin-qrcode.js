/* ============================================================
   Augustinerkirche Wien — admin-qrcode.js
   QR-Codes erstellen (admin/qrcode.html): feste Adressen der Kirche,
   Designs mit Logo in der Mitte, Beschriftung, durchsichtiger Hintergrund;
   Kopieren in die Zwischenablage, Download als PNG oder SVG. Alles im
   Browser, es wird nichts gespeichert oder hochgeladen.
   Benoetigt js/admin/admin.js und js/admin/qr-encoder.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $ } = A;
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* Feste Adressen (ohne www, das ist die kuerzeste Form; Aspersdorf mit www) */
  const DOMAINS = [
    { url: 'https://augustinerkirche.at', name: 'augustinerkirche.at', sub: 'Startseite' },
    { url: 'https://augustinerkirche.wien', name: 'augustinerkirche.wien', sub: 'Startseite (.wien)' },
    { url: 'https://augustiner.at', name: 'augustiner.at', sub: 'Kloster der Augustiner' },
    { url: 'https://augustiner.wien', name: 'augustiner.wien', sub: 'Kloster (.wien)' },
    { url: 'https://hochamt.at', name: 'hochamt.at', sub: 'Hochämter' },
    { url: 'https://hochamt.wien', name: 'hochamt.wien', sub: 'Hochämter (.wien)' },
    { url: 'https://kirchenmusik.wien', name: 'kirchenmusik.wien', sub: 'Kirchenmusik' },
    /* Aspersdorf wie angegeben mit www */
    { url: 'https://www.aspersdorf.at', name: 'www.aspersdorf.at', sub: 'Pfarre Aspersdorf' }
  ];
  const LOGOS = [
    ['marine', 'Marineblau'], ['gold', 'Gold'], ['gold-dunkel', 'Dunkelgold'], ['hellgold', 'Hellgold'],
    ['bordeaux', 'Bordeaux'], ['tannengruen', 'Tannengrün'], ['gruen', 'Grün'], ['schwarz', 'Schwarz'], ['weiss', 'Weiß']
  ];
  const MARINE = '#10192e', GOLD = '#a8812f', BORDEAUX = '#6e1a28', TANNE = '#1f4d3a';
  /* Designs: Farben, Formen und das passende Logo */
  /* Farbvorschläge, die immer gut lesbar und zur Kirche passend sind */
  const DARK = [
    ['#10192e', 'Marineblau'], ['#000000', 'Schwarz'], ['#2b2f36', 'Anthrazit'], ['#6e1a28', 'Bordeaux'], ['#1f4d3a', 'Tannengrün'],
    ['#7d5f1c', 'Dunkelgold'], ['#1d3a6b', 'Königsblau'], ['#4a2145', 'Aubergine'], ['#4a3220', 'Braun'], ['#0f4c5c', 'Petrol']
  ];
  const LIGHT = [
    ['#ffffff', 'Weiß'], ['#fbf7ee', 'Elfenbein'], ['#f6efdf', 'Creme'], ['#efe6d2', 'Sand'], ['#f1f1f1', 'Hellgrau'],
    ['#eaf0f8', 'Hellblau'], ['#eef4ec', 'Hellgrün'], ['#f8ecec', 'Rosé'], ['#f7edd2', 'Hellgold'], ['#f4f1f7', 'Perlmutt']
  ];
  /* passendes Logo zur Farbe der Punkte */
  const LOGO_FOR = { '#10192e': 'marine', '#000000': 'schwarz', '#2b2f36': 'schwarz', '#6e1a28': 'bordeaux', '#1f4d3a': 'tannengruen', '#7d5f1c': 'gold-dunkel', '#1d3a6b': 'marine', '#4a2145': 'schwarz', '#4a3220': 'schwarz', '#0f4c5c': 'marine' };
  const GOLDD = '#7d5f1c', IVORY = '#fbf7ee';
  const D = (id, name, fg, bg, eye, dots, eyes, logo, extra) => Object.assign({ id, name, fg, bg, eye, dots, eyes, logo }, extra);
  const DESIGNS = [
    D('klassisch', 'Klassisch', MARINE, '#ffffff', MARINE, 'square', 'square', 'marine'),
    D('plakat', 'Plakat Marine', MARINE, '#ffffff', MARINE, 'square', 'square', 'marine', { caption: true }),
    D('plakat-gold', 'Plakat Gold', GOLDD, IVORY, GOLDD, 'square', 'square', 'gold-dunkel', { caption: true }),
    D('plakat-bordeaux', 'Plakat Bordeaux', BORDEAUX, '#ffffff', BORDEAUX, 'square', 'square', 'bordeaux', { caption: true }),
    D('streng', 'Schwarz-Weiß', '#000000', '#ffffff', '#000000', 'square', 'square', 'schwarz'),
    D('goldmarine', 'Gold & Marine', MARINE, IVORY, GOLD, 'square', 'square', 'gold'),
    D('fein-marine', 'Fein Marine', MARINE, '#ffffff', MARINE, 'small', 'square', 'marine'),
    D('fein-gold', 'Fein Gold', GOLDD, IVORY, GOLDD, 'small', 'square', 'gold-dunkel'),
    D('fein-bordeaux', 'Fein Bordeaux', BORDEAUX, '#ffffff', BORDEAUX, 'small', 'square', 'bordeaux'),
    D('raute-marine', 'Raute Marine', MARINE, '#ffffff', MARINE, 'diamond', 'square', 'marine'),
    D('raute-gold', 'Raute Gold', GOLDD, IVORY, GOLDD, 'diamond', 'square', 'gold-dunkel'),
    D('raute-tanne', 'Raute Tannengrün', TANNE, '#ffffff', TANNE, 'diamond', 'square', 'tannengruen'),
    D('senkrecht-marine', 'Streifen Marine', MARINE, '#ffffff', MARINE, 'vbar', 'square', 'marine'),
    D('senkrecht-bordeaux', 'Streifen Bordeaux', BORDEAUX, '#ffffff', BORDEAUX, 'vbar', 'square', 'bordeaux'),
    D('waagrecht-gold', 'Zeilen Gold', GOLDD, IVORY, GOLDD, 'hbar', 'square', 'gold-dunkel'),
    D('waagrecht-tanne', 'Zeilen Tannengrün', TANNE, '#ffffff', TANNE, 'hbar', 'square', 'tannengruen'),
    D('durchsichtig', 'Durchsichtig', MARINE, '#ffffff', MARINE, 'dots', 'circle', 'marine', { transp: true }),
    D('durchsichtig-fein', 'Durchsichtig Fein', MARINE, '#ffffff', MARINE, 'small', 'square', 'marine', { transp: true }),
    D('rund-marine', 'Rund Marine', MARINE, '#ffffff', MARINE, 'dots', 'circle', 'marine'),
    D('rund-gold', 'Rund Gold', GOLDD, IVORY, GOLDD, 'dots', 'circle', 'gold-dunkel'),
    D('rund-bordeaux', 'Rund Bordeaux', BORDEAUX, '#ffffff', BORDEAUX, 'dots', 'circle', 'bordeaux'),
    D('rund-tanne', 'Rund Tannengrün', TANNE, '#ffffff', TANNE, 'dots', 'circle', 'tannengruen'),
    D('elfenbein', 'Elfenbein', '#2a2a3d', '#f6efdf', GOLD, 'dots', 'circle', 'gold-dunkel'),
    D('mini-marine', 'Mini-Punkte Marine', MARINE, '#ffffff', MARINE, 'tiny', 'circle', 'marine'),
    D('mini-gold', 'Mini-Punkte Gold', GOLDD, IVORY, GOLDD, 'tiny', 'circle', 'gold-dunkel')
  ];

  const S = {
    design: 'rund-marine', logoMode: 'kirche', logoVar: 'marine', ownUrl: '', ownRatio: 1, badge: 'none', logoPct: 27,
    fg: MARINE, bg: '#ffffff', eye: MARINE, transp: false, dots: 'dots', eyes: 'circle', margin: 2, ecc: 'M'
  };
  const logoCache = {}; // Variante -> data-Adresse
  let svgUrl = '';
  let current = null;

  const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const setRadio = (name, v) => { const r = document.querySelector(`input[name="${name}"][value="${v}"]`); if (r) r.checked = true; };
  const xml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Farben ---------- */
  function lum(hex) {
    const c = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /* ---------- Formen als Pfade (Einheit: ein Punkt = 1) ---------- */
  const f = (n) => String(Math.round(n * 1000) / 1000);
  function rrect(x, y, w, h, r) {
    return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}` +
      `h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`;
  }
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
  function shape(kind, x, y, w, r) {
    if (kind === 'circle') return circle(x + w / 2, y + w / 2, w / 2);
    if (kind === 'rounded') return rrect(x, y, w, w, r);
    return `M${f(x)} ${f(y)}h${f(w)}v${f(w)}h${f(-w)}z`;
  }
  /* Rechteck mit je einem Radius pro Ecke [links oben, rechts oben, rechts unten, links unten] */
  function prr(x, y, w, h, r) {
    const [a, b, c, d] = r;
    return `M${f(x + a)} ${f(y)}h${f(w - a - b)}${b ? `a${f(b)} ${f(b)} 0 0 1 ${f(b)} ${f(b)}` : ''}v${f(h - b - c)}${c ? `a${f(c)} ${f(c)} 0 0 1 ${f(-c)} ${f(c)}` : ''}` +
      `h${f(-(w - c - d))}${d ? `a${f(d)} ${f(d)} 0 0 1 ${f(-d)} ${f(-d)}` : ''}v${f(-(h - d - a))}${a ? `a${f(a)} ${f(a)} 0 0 1 ${f(a)} ${f(-a)}` : ''}z`;
  }
  function eye(kind, x, y) {
    if (kind === 'leaf') return prr(x, y, 7, 7, [0, 3, 0, 3]) + prr(x + 1, y + 1, 5, 5, [0, 2, 0, 2]) + prr(x + 2, y + 2, 3, 3, [0, 1.5, 0, 1.5]);
    const r = kind === 'rounded' ? [2.2, 1.3, 1] : [0, 0, 0];
    return shape(kind, x, y, 7, r[0]) + shape(kind, x + 1, y + 1, 5, r[1]) + shape(kind, x + 2, y + 2, 3, r[2]);
  }

  /* ---------- SVG bauen ---------- */
  function buildSvg(q, o, px) {
    const m = o.margin, total = q.size + 2 * m;
    const band = o.caption ? Math.round(total * 0.2 * 100) / 100 : 0;
    const H = total + band;
    const hasLogo = !!o.logo;
    const logoMods = hasLogo ? Math.max(3, Math.round(q.size * o.logoPct / 100)) : 0;
    const c = total / 2;
    const badgeR = logoMods / 2 + (o.badge === 'none' ? 0.2 : 0.7);
    const clear = (x, y) => {
      if (!hasLogo) return false;
      const cx = x + m + 0.5, cy = y + m + 0.5;
      if (o.badge === 'round') return Math.hypot(cx - c, cy - c) < badgeR + 0.7;
      return Math.abs(cx - c) < badgeR + 0.5 + (o.badge === 'none' ? 0.3 : 0.2) && Math.abs(cy - c) < badgeR + 0.5 + (o.badge === 'none' ? 0.3 : 0.2);
    };
    const on = (x, y) => x >= 0 && y >= 0 && x < q.size && y < q.size && q.get(x, y) && !q.isFinder(x, y) && !clear(x, y);
    let d = '';
    if (o.dots === 'vbar' || o.dots === 'hbar') {
      const v = o.dots === 'vbar';
      for (let a = 0; a < q.size; a++) {
        for (let b = 0; b < q.size; b++) {
          if (!(v ? on(a, b) : on(b, a))) continue;
          let e = b;
          while (e + 1 < q.size && (v ? on(a, e + 1) : on(e + 1, a))) e++;
          const len = e - b + 1;
          d += v ? `M${f(a + m + 0.08)} ${f(b + m)}h0.84v${len}h-0.84z` : `M${f(b + m)} ${f(a + m + 0.08)}h${len}v0.84h${-len}z`;
          b = e;
        }
      }
    }
    for (let y = 0; y < q.size && o.dots !== 'vbar' && o.dots !== 'hbar'; y++) for (let x = 0; x < q.size; x++) {
      if (!on(x, y)) continue;
      const X = x + m, Y = y + m;
      if (o.dots === 'dots') d += circle(X + 0.5, Y + 0.5, 0.46);
      else if (o.dots === 'tiny') d += circle(X + 0.5, Y + 0.5, 0.33);
      else if (o.dots === 'small') d += `M${f(X + 0.1)} ${f(Y + 0.1)}h0.8v0.8h-0.8z`;
      else if (o.dots === 'diamond') d += `M${f(X + 0.5)} ${f(Y - 0.02)}l0.52 0.52l-0.52 0.52l-0.52 -0.52z`;
      else if (o.dots === 'rounded') {
        /* fliessend: nur Ecken ohne Nachbarn werden rund */
        const L = on(x - 1, y), R = on(x + 1, y), U = on(x, y - 1), D = on(x, y + 1);
        const r = (a, b) => (a || b ? 0 : 0.5);
        d += prr(X, Y, 1, 1, [r(L, U), r(R, U), r(R, D), r(L, D)]);
      } else d += `M${X} ${Y}h1v1h-1z`;
    }
    let eyes = '';
    for (const [ex, ey] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) eyes += eye(o.eyes, ex + m, ey + m);
    const out = [`<svg xmlns="${SVGNS}" viewBox="0 0 ${f(total)} ${f(H)}" width="${px}" height="${f(px * H / total)}"${o.dots === 'square' || o.dots === 'small' ? ' shape-rendering="crispEdges"' : ''}>`];
    if (!o.transp) out.push(`<rect width="${f(total)}" height="${f(H)}" fill="${o.bg}"/>`);
    out.push(`<path d="${d}" fill="${o.fg}"/>`);
    out.push(`<path d="${eyes}" fill="${o.eyeColor}" fill-rule="evenodd"/>`);
    if (hasLogo) {
      if (o.badge !== 'none') {
        const fill = o.transp ? '#ffffff' : o.bg;
        out.push(o.badge === 'round'
          ? `<circle cx="${f(c)}" cy="${f(c)}" r="${f(badgeR)}" fill="${fill}" stroke="${o.eyeColor}" stroke-width="0.3"/>`
          : `<rect x="${f(c - badgeR)}" y="${f(c - badgeR)}" width="${f(badgeR * 2)}" height="${f(badgeR * 2)}" rx="0.9" fill="${fill}" stroke="${o.eyeColor}" stroke-width="0.3"/>`);
      }
      const box = o.badge === 'round' ? logoMods * 0.9 : logoMods;
      const w = o.ratio >= 1 ? box : box * o.ratio;
      const h = o.ratio >= 1 ? box / o.ratio : box;
      out.push(`<image href="${o.logo}" x="${f(c - w / 2)}" y="${f(c - h / 2 - box * 0.05)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    if (o.caption) {
      const fs = band * 0.46;
      out.push(`<rect y="${f(total)}" width="${f(total)}" height="${f(band)}" fill="${o.fg}"/>`);
      out.push(`<text x="${f(total / 2)}" y="${f(total + band / 2 + fs * 0.34)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${f(fs)}" fill="${o.transp ? '#ffffff' : o.bg}">${xml(o.caption)}</text>`);
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- Logos laden (gleiche Herkunft, als Daten-Adresse einbetten) ---------- */
  function toDataUrl(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  }
  /* Logo auf den sichtbaren Bereich zuschneiden, damit es genau in der Mitte sitzt */
  function cropLogo(url) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = im.naturalWidth; c.height = im.naturalHeight;
          const g = c.getContext('2d');
          g.drawImage(im, 0, 0);
          const px = g.getImageData(0, 0, c.width, c.height).data;
          let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            if (px[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
          if (x1 < 0) return resolve({ url, ratio: 1 });
          const w = x1 - x0 + 1, h = y1 - y0 + 1;
          const o = document.createElement('canvas');
          o.width = w; o.height = h;
          o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
          resolve({ url: o.toDataURL('image/png'), ratio: w / h });
        } catch { resolve({ url, ratio: (im.naturalWidth || 1) / (im.naturalHeight || 1) }); }
      };
      im.onerror = () => resolve({ url: '', ratio: 1 });
      im.src = url;
    });
  }
  async function loadLogo(v) {
    if (logoCache[v]) return logoCache[v];
    try {
      const r = await fetch(`../assets/logo/logo-${v}.png`);
      if (!r.ok) throw new Error(String(r.status));
      logoCache[v] = await cropLogo(await toDataUrl(await r.blob()));
    } catch { logoCache[v] = { url: '', ratio: 1 }; }
    return logoCache[v];
  }

  function options(over) {
    const s = Object.assign({}, S, over || {});
    let logo = '', ratio = 1;
    if (s.logoMode === 'kirche') { const l = logoCache[s.logoVar]; if (l) { logo = l.url; ratio = l.ratio; } }
    else if (s.logoMode === 'own') { logo = s.ownUrl; ratio = s.ownRatio; }
    const cap = (over && over.captionText !== undefined) ? over.captionText : $('q-caption').value.trim();
    return {
      fg: s.fg, bg: s.bg, transp: !!s.transp, eyeColor: s.eye, dots: s.dots, eyes: s.eyes, margin: s.margin,
      logo, ratio, badge: s.badge, logoPct: s.logoPct, caption: cap, eyeBand: false
    };
  }

  /* ---------- Entwuerfe und Oberflaeche ---------- */
  function applyDesign(id) {
    const dsg = DESIGNS.find((x) => x.id === id);
    if (!dsg) return;
    Object.assign(S, { design: id, fg: dsg.fg, bg: dsg.bg, eye: dsg.eye, transp: !!dsg.transp, dots: dsg.dots, eyes: dsg.eyes, logoVar: dsg.logo });
    if (S.logoMode === 'none' || S.logoMode === 'kirche') S.logoMode = S.logoMode;
    if (dsg.caption && !$('q-caption').value.trim()) $('q-caption').value = (DOMAINS.find((x) => x.url === $('q-text').value.trim()) || {}).name || 'augustinerkirche.at';
    syncControls();
    update();
  }
  function syncControls() {
    $('q-fg').value = S.fg; $('q-bg').value = S.bg; $('q-eye').value = S.eye; $('q-transp').checked = S.transp;
    setRadio('q-dots', S.dots); setRadio('q-eyes', S.eyes); setRadio('q-logomode', S.logoMode);
    $('q-margin').value = S.margin; $('q-logo-size').value = S.logoPct; $('q-var').value = S.logoVar; $('q-ecc').value = S.ecc;
    document.querySelectorAll('#q-badge .adm-seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.badge)));
  }
  function readControls() {
    S.fg = $('q-fg').value; S.bg = $('q-bg').value; S.eye = $('q-eye').value; S.transp = $('q-transp').checked;
    S.dots = radio('q-dots'); S.eyes = radio('q-eyes'); S.logoMode = radio('q-logomode');
    S.margin = Number($('q-margin').value); S.logoPct = Number($('q-logo-size').value); S.logoVar = $('q-var').value; S.ecc = $('q-ecc').value;
  }

  const tiles = {};
  function renderTiles() {
    const demo = window.QR.make('https://augustinerkirche.at', 'H');
    for (const dsg of DESIGNS) {
      const img = tiles[dsg.id];
      if (!img) continue;
      const o = options({ fg: dsg.fg, bg: dsg.bg, eye: dsg.eye, transp: !!dsg.transp, dots: dsg.dots, eyes: dsg.eyes, logoVar: dsg.logo, logoMode: 'kirche', margin: 1, captionText: dsg.caption ? 'augustinerkirche.at' : '' });
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(demo, o, 112))}`;
    }
  }
  function buildUi() {
    const box = $('q-doms');
    DOMAINS.forEach((dm) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qr-chip'; b.dataset.url = dm.url; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<b>${xml(dm.name)}</b><span>${xml(dm.sub)}</span>`;
      b.addEventListener('click', () => {
        $('q-text').value = dm.url;
        const cap = $('q-caption');
        if (!cap.value.trim() || DOMAINS.some((x) => x.name === cap.value.trim())) { if (DESIGNS.find((x) => x.id === S.design).caption) cap.value = dm.name; }
        update();
      });
      box.appendChild(b);
    });
    const dBox = $('q-designs');
    DESIGNS.forEach((dsg) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qr-design'; b.setAttribute('role', 'radio'); b.dataset.id = dsg.id;
      const img = document.createElement('img'); img.alt = ''; img.width = 112; img.height = 112; tiles[dsg.id] = img;
      const n = document.createElement('b'); n.textContent = dsg.name;
      b.append(img, n);
      b.addEventListener('click', () => applyDesign(dsg.id));
      dBox.appendChild(b);
    });
    $('q-var').innerHTML = LOGOS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  }

  function buildSwatches() {
    const defs = [['q-sw-fg', 'q-fg', DARK], ['q-sw-bg', 'q-bg', LIGHT], ['q-sw-eye', 'q-eye', DARK]];
    for (const [boxId, inputId, list] of defs) {
      const box = $(boxId);
      if (!box) continue;
      list.forEach(([hex, name]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'qr-swatch'; b.dataset.hex = hex; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', 'false');
        b.style.background = hex;
        b.addEventListener('click', () => {
          $(inputId).value = hex;
          const lv = inputId === 'q-fg' && LOGO_FOR[hex];
          if (lv) { $('q-var').value = lv; }
          readControls(); S.design = ''; update();
        });
        box.appendChild(b);
      });
    }
  }
  function markSwatches() {
    for (const [boxId, inputId] of [['q-sw-fg', 'q-fg'], ['q-sw-bg', 'q-bg'], ['q-sw-eye', 'q-eye']]) {
      const v = $(inputId).value.toLowerCase();
      document.querySelectorAll(`#${boxId} .qr-swatch`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === v)));
    }
  }

  /* ---------- Vorschau ---------- */
  function update() {
    markSwatches();
    $('q-margin-o').textContent = $('q-margin').value;
    $('q-logo-size-o').textContent = $('q-logo-size').value;
    const hasLogo = S.logoMode !== 'none';
    $('q-own-box').hidden = S.logoMode !== 'own';
    $('q-var-box').hidden = S.logoMode !== 'kirche';
    $('q-logo-opts').hidden = !hasLogo;
    $('q-ecc').disabled = hasLogo;
    $('q-ecc-hint').textContent = hasLogo ? 'Mit Logo immer „Sehr hoch“, damit der Code lesbar bleibt.' : 'Je höher, desto mehr darf verschmutzt oder verdeckt sein.';
    document.querySelectorAll('.qr-design').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === S.design)));
    const text = $('q-text').value.trim();
    document.querySelectorAll('.qr-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.url === text)));

    if (S.logoMode === 'kirche' && logoCache[S.logoVar] === undefined) { loadLogo(S.logoVar).then(update); }

    const o = options();
    const msgs = [];
    if (!o.transp && contrast(o.fg, o.bg) < 3) msgs.push('Punkte und Hintergrund sind sich zu ähnlich, der Code wird schlecht gelesen.');
    else if (!o.transp && lum(o.fg) > lum(o.bg)) msgs.push('Helle Punkte auf dunklem Grund lesen nicht alle Handys.');
    if (o.transp) msgs.push('Durchsichtig: Nur auf hellem, ruhigem Untergrund verwenden.');
    if (o.margin < 2) msgs.push('Der Rand ist sehr schmal, manche Handys finden den Code dann nicht.');
    $('q-contrast').textContent = msgs.join(' ');
    $('q-contrast').hidden = !msgs.length;

    $('q-target').innerHTML = text ? `Führt zu <b>${xml(text.length > 90 ? text.slice(0, 90) + '…' : text)}</b>` : '';
    const img = $('q-img');
    current = null;
    if (!text) {
      img.hidden = true; $('q-empty').hidden = false; $('q-empty').textContent = 'Wähle links eine Adresse.'; $('q-info').textContent = '';
    } else {
      try {
        const q = window.QR.make(text, hasLogo ? 'H' : S.ecc);
        current = { q, o };
        if (svgUrl) URL.revokeObjectURL(svgUrl);
        svgUrl = URL.createObjectURL(new Blob([buildSvg(q, o, 320)], { type: 'image/svg+xml' }));
        img.src = svgUrl; img.hidden = false; $('q-empty').hidden = true;
        $('q-info').textContent = `${q.size} × ${q.size} Punkte${hasLogo && !o.logo ? ' · Logo wird geladen …' : ''}`;
      } catch (e) {
        img.hidden = true; $('q-empty').hidden = false; $('q-empty').textContent = String((e && e.message) || e); $('q-info').textContent = '';
      }
    }
    for (const id of ['q-dl-png', 'q-dl-svg', 'q-copy']) $(id).disabled = !current;
  }

  /* ---------- PNG, Kopieren, Download ---------- */
  function renderPng(px) {
    return new Promise((resolve, reject) => {
      const svg = buildSvg(current.q, current.o, px);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = px; c.height = Math.round(px * im.naturalHeight / im.naturalWidth);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('leer'))), 'image/png');
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild')); };
      im.src = url;
    });
  }
  function fileName(ext) {
    const base = $('q-name').value.trim().replace(/[^\w\-äöüÄÖÜß .]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '').slice(0, 60) || 'qr-code';
    return `${base}.${ext}`;
  }
  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function downloadPng() {
    if (!current) return;
    try { save(await renderPng(Number($('q-px').value)), fileName('png')); A.toast(current.o.transp ? 'PNG mit durchsichtigem Hintergrund heruntergeladen.' : 'PNG heruntergeladen.'); }
    catch { A.toast('Das PNG konnte nicht erstellt werden.', 'err'); }
  }
  function downloadSvg() {
    if (!current) return;
    save(new Blob([buildSvg(current.q, current.o, 1024)], { type: 'image/svg+xml' }), fileName('svg'));
    A.toast('SVG heruntergeladen.');
  }
  async function copyImage() {
    if (!current) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('nicht unterstuetzt');
      const png = renderPng(1024);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      A.toast('QR-Code kopiert. Jetzt in Word, Mail oder Chat einfügen.');
    } catch { A.toast('Kopieren geht hier nicht (braucht https oder localhost). Bitte „PNG herunterladen“ nehmen.', 'err'); }
  }
  async function copyLink() {
    const t = $('q-text').value.trim();
    if (!t) return;
    try { await navigator.clipboard.writeText(t); A.toast('Adresse kopiert.'); } catch { A.toast('Kopieren geht hier nicht.', 'err'); }
  }

  /* ---------- Eigenes Logo ---------- */
  function pickLogo() {
    const file = $('q-logo').files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { $('q-logo').value = ''; return A.toast('Das Logo ist zu groß (höchstens 3 MB).', 'err'); }
    toDataUrl(file).then((url) => {
      const im = new Image();
      im.onload = () => { S.ownRatio = (im.naturalWidth || 1) / (im.naturalHeight || 1); S.ownUrl = url; update(); };
      im.onerror = () => { $('q-logo').value = ''; A.toast('Dieses Bild konnte nicht gelesen werden.', 'err'); };
      im.src = url;
    });
  }

  function setupTabs() {
    const panes = Array.from(document.querySelectorAll('.qr-pane'));
    const tabs = Array.from(document.querySelectorAll('.qr-tab'));
    const show = (n) => {
      panes.forEach((p) => { p.hidden = p.dataset.pane !== String(n); });
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === String(n))));
    };
    const names = ['Adresse', 'Design', 'Logo', 'Feinschliff'];
    panes.forEach((p) => {
      const n = Number(p.dataset.pane);
      const nav = document.createElement('div');
      nav.className = 'qr-nav';
      if (n > 1) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline'; b.textContent = `Zurück: ${names[n - 2]}`; b.addEventListener('click', () => show(n - 1)); nav.appendChild(b); }
      if (n < 4) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-dark'; b.textContent = `Weiter: ${names[n]}`; b.addEventListener('click', () => show(n + 1)); nav.appendChild(b); }
      p.appendChild(nav);
    });
    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
    $('q-custom').addEventListener('click', () => { show(4); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    show(1);
  }

  async function init() {
    buildUi();
    buildSwatches();
    setupTabs();
    const form = $('qr-form');
    form.addEventListener('submit', (e) => e.preventDefault());
    const touched = () => { readControls(); S.design = ''; update(); };
    for (const id of ['q-fg', 'q-bg', 'q-eye', 'q-transp', 'q-margin', 'q-ecc']) $(id).addEventListener('input', touched);
    for (const n of ['q-dots', 'q-eyes']) document.querySelectorAll(`input[name="${n}"]`).forEach((r) => r.addEventListener('change', touched));
    document.querySelectorAll('input[name="q-logomode"]').forEach((r) => r.addEventListener('change', () => { readControls(); update(); }));
    $('q-var').addEventListener('change', () => { readControls(); S.design = ''; update(); });
    $('q-logo-size').addEventListener('input', () => { readControls(); update(); });
    document.querySelectorAll('#q-badge .adm-seg-btn').forEach((b) => b.addEventListener('click', () => {
      S.badge = b.dataset.v; S.design = '';
      document.querySelectorAll('#q-badge .adm-seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      update();
    }));
    $('q-text').addEventListener('input', update);
    $('q-caption').addEventListener('input', update);
    $('q-logo').addEventListener('change', pickLogo);
    $('q-dl-png').addEventListener('click', downloadPng);
    $('q-dl-svg').addEventListener('click', downloadSvg);
    $('q-copy').addEventListener('click', copyImage);
    $('q-copy-link').addEventListener('click', copyLink);
    /* erst alle Logos holen, damit die Vorschaubilder der Designs sofort stimmen */
    await Promise.all([...new Set(DESIGNS.map((x) => x.logo).concat(S.logoVar))].map(loadLogo));
    $('q-text').value = DOMAINS[0].url;
    syncControls();
    renderTiles();
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
