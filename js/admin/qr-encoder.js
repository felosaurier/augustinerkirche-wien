/* ============================================================
   Augustinerkirche Wien — qr-encoder.js
   Kleiner QR-Code-Erzeuger (Bytemodus, Version 1-40, Fehlerkorrektur L/M/Q/H,
   automatische Maske). Ohne Fremdbibliothek, damit die Verwaltung
   offline und mit strenger Sicherheitsrichtlinie funktioniert.
   window.QR.make(text, 'L'|'M'|'Q'|'H') -> { size, get(x, y), isFinder(x, y) }
   ============================================================ */
(function () {
  'use strict';
  const ECC = { L: 0, M: 1, Q: 2, H: 3 };
  const FMT = [1, 0, 3, 2];
  const PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  const BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  const dataWords = (v, e) => Math.floor(rawModules(v) / 8) - PER_BLOCK[e][v] * BLOCKS[e][v];

  /* Reed-Solomon ueber GF(256) */
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(deg) {
    const res = new Array(deg).fill(0);
    res[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) { res[j] = gfMul(res[j], root); if (j + 1 < deg) res[j] ^= res[j + 1]; }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ res.shift();
      res.push(0);
      div.forEach((c, i) => { res[i] ^= gfMul(c, f); });
    }
    return res;
  }

  function make(text, level) {
    const e = ECC[level] !== undefined ? ECC[level] : 1;
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    for (;; ver++) {
      if (ver > 40) throw new Error('Der Text ist zu lang für einen QR-Code.');
      const cc = ver <= 9 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= dataWords(ver, e) * 8) break;
    }
    const cap = dataWords(ver, e);
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    /* Bloecke, Fehlerkorrektur, Verschraenkung */
    const nb = BLOCKS[e][ver], eccLen = PER_BLOCK[e][ver], raw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const d = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += d.length;
      const ecc = rsRemainder(d, div);
      if (i < nShort) d.push(0); /* Platzhalter, damit alle Bloecke gleich lang sind */
      blocks.push(d.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[blocks.length - 1].length; i++) {
      blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });
    }

    /* Matrix */
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, v) => { mod[y][x] = v; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const n = ver === 1 ? 0 : Math.floor(ver / 7) + 2;
    const pos = [];
    if (n) {
      const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      pos.push(6);
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    }
    pos.forEach((cx, i) => pos.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = (mask) => {
      const d = (FMT[e] << 3) | mask;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const f = ((d << 10) | r) ^ 0x5412;
      const bit = (i) => ((f >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const v = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const c = ((v >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, c); set(b, a, c);
      }
    }
    /* Daten im Zickzack */
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && k < all.length * 8) { mod[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }
    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    const applyMask = (m) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };
    const penalty = () => {
      let p = 0;
      const line = (get) => {
        for (let a = 0; a < size; a++) {
          let run = 1, hist = '';
          for (let b = 0; b < size; b++) {
            const c = get(a, b);
            hist += c ? '1' : '0';
            if (b > 0 && c === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
          }
          const m = hist.match(/(?=(00001011101|10111010000))/g);
          if (m) p += m.length * 40;
        }
      };
      line((y, x) => mod[y][x]); line((x, y) => mod[y][x]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
      let dark = 0;
      mod.forEach((r) => r.forEach((c) => { if (c) dark++; }));
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const p = penalty();
      if (p < bestP) { best = m; bestP = p; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return {
      size, version: ver,
      get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && mod[y][x],
      isFinder: (x, y) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
    };
  }
  window.QR = { make };
})();
