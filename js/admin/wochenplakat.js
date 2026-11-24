/* ============================================================
   Augustinerkirche Wien — wochenplakat.js
   Gedruckter Wochenkalender als Plakat (A4 hoch, wie der Aushang): Kopf mit Logo und
   Datum, darunter je Tag eine Zeile mit Wochentag, Heiligen, großer Tageszahl und allen
   Terminen (Uhrzeit, Bezeichnung, Zelebrant, Musik, Hinweis, Ort).
   Die Termine kommen aus js/gemeinsam/kalender-daten.js (dieselben wie im Wochenkalender
   der Verwaltung); Sonn- und Samstage sind rot, die Tageszahl des Sonntags steht auf Rot.
   WochenPlakat.build(montag, items, opts) liefert das Plakat als HTML (feste Größe 794 × 1122 px,
   Schrift wird bei vielen Terminen automatisch kleiner), dazu toPng() und toPdf().
   Benötigt js/gemeinsam/hochaemter-data.js und js/gemeinsam/kalender-daten.js.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  const KD = window.KalenderDaten;
  const W = 794;
  const H = 1122;
  const LOGO = '../assets/logo/logo-marine.png';
  const WD = ['SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const dmy = (dt) => `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;

  const CSS_URL = '../css/wochenplakat.css';
  let cssText = '';

  /* Logo einmal als Daten-Adresse laden: so enthält das Plakat alles und lässt sich als Bild speichern */
  let logoData = '';
  /* Das Logo wird in der Farbe des Plakats (Marineblau der Schrift) neu eingefärbt */
  async function tint(url, rgb) {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    const opaqueBg = p[3] === 255 && p[0] + p[1] + p[2] > 600; /* weißer Hintergrund statt Transparenz */
    for (let i = 0; i < p.length; i += 4) {
      const a = opaqueBg ? 255 - (p[i] + p[i + 1] + p[i + 2]) / 3 : p[i + 3];
      p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; p[i + 3] = a;
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  }
  async function prepare() {
    if (!cssText) { try { cssText = await (await fetch(CSS_URL)).text(); } catch { cssText = ''; } }
    if (logoData) return;
    try {
      logoData = await tint(LOGO, [26, 22, 128]);
    } catch { logoData = LOGO; }
  }

  const timeText = (it) => (it.label ? it.label : it.time ? `${it.time.replace(/^0/, '')} Uhr` : '');

  /* Die Angaben eines Termins für das Plakat (HTML und Word) */
  function itemData(it, dayRed) {
    const d = it.d || {};
    let title = String(it.title || d.name || '');
    let paren = '';
    const m = /^(.*?) \((.*)\)$/.exec(title);
    if (m) { title = m[1]; paren = m[2]; }
    let place = d.ort || '';
    let note = d.hinweis || '';
    /* "bis 12:00 Uhr, Eingang: …" (Kanzleistunden): "bis …" steht darunter, der Rest rechts beim Ort */
    let bisZeile = '';
    const bis = /^(bis [^,]+?)(?:,\s*(.+))?$/i.exec(note);
    if (bis) {
      bisZeile = bis[1];
      note = '';
      if (bis[2]) place = place ? `${place}, ${bis[2]}` : bis[2];
    }
    const bisParen = /^bis [^,]+$/i.test(paren);
    if (bisParen) { bisZeile = paren; paren = ''; }
    if (it.group === 'hochamt') {
      title = title.toUpperCase();
      if (!place) place = 'Augustinerkirche';
    }
    const red = dayRed && (it.group === 'hochamt' || it.group === 'gottesdienst');
    return { time: timeText(it), title, paren, zel: d.zelebrant || '', bis: bisZeile, musik: d.musik || '', note, place, red };
  }
  function itemHTMLOf(x) {
    return `<div class="wp-it${x.red ? ' red' : ''}"><span class="wp-t">${esc(x.time)}</span>` +
      `<span class="wp-b"><b>${esc(x.title)}</b>${x.paren ? ` <span>(${esc(x.paren)})</span>` : ''}${x.zel ? ` <span>| Z: ${esc(x.zel)}</span>` : ''}` +
        (x.bis ? `<span class="wp-m">${esc(x.bis)}</span>` : '') +
        (x.musik ? `<span class="wp-m"><i>♫</i> ${esc(x.musik)}</span>` : '') +
        (x.note ? `<span class="wp-x">${esc(x.note)}</span>` : '') +
      `</span><span class="wp-p">${esc(x.place)}</span></div>`;
  }

  /* Die Tage des Plakats mit Angaben und Terminen (für HTML und Word) */
  function model(montag, items, opts = {}) {
    const first = opts.sonntag === false ? montag : addDays(montag, -1);
    const out = [];
    for (let dt = first; dt <= addDays(montag, 6); dt = addDays(dt, 1)) {
      const iso = KD.isoOf(dt);
      const dow = dt.getDay();
      const inf = KD.infoAm(iso);
      out.push({
        date: dt, dow, wd: WD[dow], red: dow === 0,
        info: inf ? [inf.tag, ...inf.heilige].filter(Boolean) : [],
        items: items.filter((it) => it.date === iso && !it.hidden && !it.cancelled).map((it) => itemData(it, dow === 0 || dow === 6))
      });
    }
    return out;
  }

  /* Das Plakat der Woche ab Montag "montag" (Date). opts.sonntag: den Sonntag davor mitnehmen (Standard: ja) */
  function build(montag, items, opts = {}) {
    const days = model(montag, items, opts);
    const rows = days.map((day) => {
      const info = day.info.map((x) => HD.formatText(x)).join('<br>');
      return `<div class="wp-row${day.red ? ' red' : ''}"><div class="wp-l"><div class="wp-wd">${day.wd}</div>${info ? `<div class="wp-inf">${info}</div>` : ''}</div>` +
        `<div class="wp-n">${day.date.getDate()}</div>` +
        `<div class="wp-r">${day.items.map((x) => itemHTMLOf(x)).join('')}</div></div>`;
    }).join('');
    return `<div class="wp">` +
      '<div class="wp-head"><div class="wp-h1">Wochenkalender der</div><div class="wp-h2">Wiener Augustinerkirche</div>' +
      `<div class="wp-h3">${dmy(days[0].date)}–${dmy(days[days.length - 1].date)}</div><img class="wp-logo" src="${esc(logoData || LOGO)}" alt=""/></div>` +
      `<div class="wp-rows">${rows}</div>` +
      '<div class="wp-foot">Z = Zelebrant des Gottesdienstes | P = Pater | D = Diakon | Pr = Predigt | ♫ = Musikalische Gestaltung | Änderungen vorbehalten</div></div>';
  }

  /* Passt nicht alles auf die Seite, wird die Schrift Schritt für Schritt kleiner */
  function fit(poster) {
    const rows = poster.querySelector('.wp-rows');
    for (let s = 1; s >= 0.55; s -= 0.03) {
      poster.style.setProperty('--s', s.toFixed(2));
      /* Spalte mit Wochentag und Heiligen: so breit, dass der längste Heilige in eine Zeile passt (höchstens 250 px, dann bricht er um) */
      poster.classList.remove('wrapinf');
      poster.style.removeProperty('--lw');
      const need = Math.max(...Array.from(poster.querySelectorAll('.wp-l')).map((e) => e.getBoundingClientRect().width / (poster.getBoundingClientRect().width / W)));
      if (need > 250) poster.classList.add('wrapinf');
      poster.style.setProperty('--lw', `${Math.ceil(Math.min(need, 250))}px`);
      if (rows.scrollHeight <= rows.clientHeight + 1) return s;
    }
    return 0.55;
  }

  /* Als PNG-Bild (scale 2 = 1588 × 2244 px) über ein SVG mit dem Plakat darin */
  async function toPng(poster, scale = 2) {
    const clone = poster.cloneNode(true);
    clone.style.transform = '';
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    const st = document.createElement('style');
    st.textContent = cssText;
    clone.insertBefore(st, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
    const img = new Image();
    img.decoding = 'async';
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Bild konnte nicht erstellt werden'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Bild konnte nicht erstellt werden');
    return blob;
  }

  /* Als PDF (A4, eine Seite): das Plakat als JPEG-Bild in einer einfachen PDF-Datei */
  async function toPdf(poster, scale = 2.2) {
    const png = await toPng(poster, scale);
    const bmp = await createImageBitmap(png);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    const jpg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.93))).arrayBuffer());
    const enc = new TextEncoder();
    const parts = [];
    const offs = [];
    let len = 0;
    const put = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); put(body); put('\nendobj\n'); };
    const PW = 595.28;
    const PH = 841.89;
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offs[4] = len;
    put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    put(jpg);
    put('\nendstream\nendobj\n');
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offs[n]).padStart(10, '0')} 00000 n 
`).join('')}`);
    put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  window.WochenPlakat = { build, model, fit, toPng, toPdf, prepare, logo: () => logoData, W, H };
})();
