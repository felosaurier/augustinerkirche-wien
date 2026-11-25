/* ============================================================
   Augustinerkirche Wien — plakat-bilder.js
   Die Bilder des Hochamt-Plakats in den gewaehlten Farben (Werkzeug "Plakat fuer ein Hochamt"):
   - Logo (word/media/image1.png) und Zeichnung der Kirche (image2.png) in der Akzentfarbe
   - QR-Codes (image3.png links: augustinerkirche.at, image4.png rechts: hochamt.at) wie die
     bisherigen: runde Punkte, runde Ecken, Logo in der Mitte; Punkte in der Hauptfarbe, Logo in
     der Akzentfarbe. Erzeugt mit js/admin/qr-encoder.js (Fehlerkorrektur H, damit das Logo
     in der Mitte nicht stoert).
   PlakatBilder.make({main, accent}) -> {files: {'word/media/image1.png': Uint8Array, …}, urls: {logo, zeichnung, qr1, qr2}}
   ============================================================ */
(function () {
  'use strict';

  const VORLAGE = '../assets/plakat/vorlage/word/media/';
  const QR_LINKS = 'https://augustinerkirche.at';
  const QR_RECHTS = 'https://hochamt.at';
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  const cache = new Map();
  function bild(url) {
    if (!cache.has(url)) {
      cache.set(url, new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error(`Bild fehlt: ${url}`));
        img.src = url;
      }));
    }
    return cache.get(url);
  }

  /* Ein Bild einfarbig neu einfaerben; weisser Hintergrund wird durchsichtig. max: laengste Seite in Pixel */
  function tint(img, rgb, max = 0) {
    const k = max && Math.max(img.naturalWidth, img.naturalHeight) > max ? max / Math.max(img.naturalWidth, img.naturalHeight) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      /* Deckkraft: aus der Helligkeit (weisser Grund) und der eigenen Durchsichtigkeit */
      const dunkel = 255 - (p[i] + p[i + 1] + p[i + 2]) / 3;
      const a = Math.min(p[i + 3], Math.min(255, dunkel * 1.25));
      p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; p[i + 3] = a;
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  /* QR-Code im Stil der bisherigen: runde Punkte, Ecken als Ring mit Punkt, Logo in der Mitte */
  function qr(text, rgbDots, logoCanvas, px = 1024) {
    const q = window.QR.make(text, 'H');
    const rand = 1;
    const n = q.size + 2 * rand;
    const cell = px / n;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, px, px);
    const farbe = `rgb(${rgbDots.join(',')})`;
    x.fillStyle = farbe;
    /* Platz fuer das Logo: ungerade Anzahl Module in der Mitte (gut ein Fuenftel) */
    let lm = Math.round(q.size * 0.26);
    if (lm % 2 === 0) lm += 1;
    const l0 = (q.size - lm) / 2;
    const imLogo = (mx, my) => mx >= l0 - 0.5 && mx < l0 + lm - 0.5 && my >= l0 - 0.5 && my < l0 + lm - 0.5;
    for (let my = 0; my < q.size; my++) {
      for (let mx = 0; mx < q.size; mx++) {
        if (!q.get(mx, my) || q.isFinder(mx, my) || imLogo(mx, my)) continue;
        x.beginPath();
        x.arc((mx + rand + 0.5) * cell, (my + rand + 0.5) * cell, cell * 0.45, 0, Math.PI * 2);
        x.fill();
      }
    }
    /* Ecken: Ring (7 Module) und Punkt (3 Module) */
    for (const [fx, fy] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) {
      const cx = (fx + rand + 3.5) * cell;
      const cy = (fy + rand + 3.5) * cell;
      x.beginPath();
      x.arc(cx, cy, cell * 3.5, 0, Math.PI * 2);
      x.arc(cx, cy, cell * 2.5, 0, Math.PI * 2, true);
      x.fill();
      x.beginPath();
      x.arc(cx, cy, cell * 1.5, 0, Math.PI * 2);
      x.fill();
    }
    /* Logo mittig, etwas kleiner als der freie Platz */
    if (logoCanvas) {
      const box = lm * cell * 0.86;
      const k = Math.min(box / logoCanvas.width, box / logoCanvas.height);
      const w = logoCanvas.width * k;
      const h = logoCanvas.height * k;
      x.drawImage(logoCanvas, px / 2 - w / 2, px / 2 - h / 2, w, h);
    }
    return c;
  }

  const png = (canvas) => new Promise((res) => canvas.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), 'image/png'));

  let letzte = { key: '', wert: null };
  async function make({ main, accent }) {
    const key = `${main}|${accent}`;
    if (letzte.key === key) return letzte.wert;
    const [logo, zeichnung] = await Promise.all([bild(`${VORLAGE}image1.png`), bild(`${VORLAGE}image2.png`)]);
    const logoC = tint(logo, hexRgb(accent), 900);
    const zeichC = tint(zeichnung, hexRgb(accent), 1500);
    const qrLogo = tint(logo, hexRgb(accent), 400);
    const qr1 = qr(QR_LINKS, hexRgb(main), qrLogo);
    const qr2 = qr(QR_RECHTS, hexRgb(main), qrLogo);
    const [b1, b2, b3, b4] = await Promise.all([png(logoC), png(zeichC), png(qr1), png(qr2)]);
    const wert = {
      files: { 'word/media/image1.png': b1, 'word/media/image2.png': b2, 'word/media/image3.png': b3, 'word/media/image4.png': b4 },
      urls: { logo: logoC.toDataURL('image/png'), zeichnung: zeichC.toDataURL('image/png'), qr1: qr1.toDataURL('image/png'), qr2: qr2.toDataURL('image/png') }
    };
    letzte = { key, wert };
    return wert;
  }

  window.PlakatBilder = { make, QR_LINKS, QR_RECHTS };
})();
