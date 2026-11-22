/* ============================================================
   Augustinerkirche Wien — admin-farben.js
   Werkzeug "Farben" (admin/farben.html): alle Farben der Website mit
   HEX, RGB und CMYK zum Kopieren, Pruefung der Lesbarkeit und eine
   Vorschau. Wer das Recht "farben" hat, kann sie aendern; gespeichert
   wird in data/farben.json (nur Abweichungen vom Standard, Aufbau und
   Liste der Farben siehe js/thema.js). Dazu die Farben der Kopfzeilen
   aus data/themen.json (nur ansehen, geaendert wird in design.html).
   Benoetigt js/thema.js, js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const T = window.AugThema;
  const { $, esc, icon } = A;
  const PATH = 'data/farben.json';
  const BEREICHE = { startseite: 'Startseite', augustinerkirche: 'Augustinerkirche', kirchenmusik: 'Kirchenmusik', augustiner: 'Augustiner', aspersdorf: 'Aspersdorf' };
  const GEGEN_NAME = { '#ffffff': 'Weiß' };

  let werte = {};
  let snap = '';
  let darf = false;

  const byKey = (k) => T.FARBEN.find((f) => f.k === k);
  /* Eingabe wie "#abc", "abc" oder "#AABBCC" zu "#aabbcc"; ungueltig: '' */
  function normHex(v) {
    let s = String(v || '').trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : '';
  }
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const rgbText = (hex) => `rgb(${rgb(hex).join(', ')})`;
  /* Einfache Umrechnung ohne Farbprofil: fuer die Druckerei nur ein Anhaltspunkt */
  function cmykText(hex) {
    const [r, g, b] = rgb(hex).map((v) => v / 255);
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return '0 / 0 / 0 / 100';
    const f = (v) => Math.round(((1 - v - k) / (1 - k)) * 100);
    return `${f(r)} / ${f(g)} / ${f(b)} / ${Math.round(k * 100)}`;
  }
  const gegenWert = (f) => (!f.gegen ? '' : f.gegen.startsWith('#') ? f.gegen : werte[f.gegen]);
  const gegenName = (f) => (!f.gegen ? '' : f.gegen.startsWith('#') ? (GEGEN_NAME[f.gegen] || f.gegen) : byKey(f.gegen).name);
  const zahl = (x) => x.toFixed(1).replace('.', ',');

  function codesHTML(hex) {
    return [['HEX', hex], ['RGB', rgbText(hex)], ['CMYK', cmykText(hex)]].map(([l, v]) =>
      `<div class="fb-code"><dt>${l}</dt><dd><code data-v="${l}">${esc(v)}</code>` +
      `<button type="button" class="fb-copy" data-copy="${l}" title="${l} kopieren" aria-label="${l}-Wert kopieren">${icon('copy')}</button></dd></div>`).join('');
  }
  function cardHTML(f) {
    const hex = werte[f.k];
    const swatch = darf
      ? `<label class="fb-swatch" title="Farbe wählen"><input type="color" value="${hex}" data-k="${f.k}" aria-label="${esc(f.name)} wählen"/></label>`
      : '<span class="fb-swatch" aria-hidden="true"></span>';
    return `<article class="fb-card" data-k="${f.k}">${swatch}<div class="fb-body">` +
      `<div class="fb-top"><h3 class="fb-name">${esc(f.name)}</h3><span class="fb-tag" hidden>geändert</span></div>` +
      `<p class="fb-wo">${esc(f.wo)}</p>` +
      `<dl class="fb-codes">${codesHTML(hex)}</dl>` +
      (f.gegen ? '<p class="fb-kontrast"></p>' : '') +
      (darf ? `<div class="fb-edit"><input class="adm-input fb-hex" type="text" data-k="${f.k}" value="${hex}" maxlength="7" spellcheck="false" aria-label="HEX-Wert für ${esc(f.name)}"/>` +
        `<button type="button" class="btn btn-quiet btn-sm fb-std" data-std="${f.k}" title="Standard: ${f.std}">Standard</button></div>` : '') +
      '</div></article>';
  }

  /* Eine Karte nach einer Aenderung auffrischen (ohne neu zu zeichnen, damit der Fokus bleibt) */
  function update(f, ausFeld) {
    const card = document.querySelector(`.fb-card[data-k="${f.k}"]`);
    if (!card) return;
    const hex = werte[f.k];
    card.style.setProperty('--c', hex);
    card.querySelector('.fb-codes').innerHTML = codesHTML(hex);
    card.querySelector('.fb-tag').hidden = hex === f.std;
    const color = card.querySelector('input[type="color"]');
    if (color && color.value !== hex) color.value = hex;
    const feld = card.querySelector('.fb-hex');
    if (feld && !ausFeld) {
      feld.value = hex;
      feld.classList.remove('is-invalid');
    }
    const std = card.querySelector('.fb-std');
    if (std) std.disabled = hex === f.std;
    const k = card.querySelector('.fb-kontrast');
    if (k) {
      const r = T.ratio(hex, gegenWert(f));
      const ok = r >= 4.5;
      k.className = `fb-kontrast ${ok ? 'ok' : 'schwach'}`;
      k.innerHTML = `${icon(ok ? 'check' : 'alert')}<span>Lesbarkeit mit ${esc(gegenName(f))}: ${zahl(r)} : 1 ${ok ? '(gut)' : '(zu schwach, empfohlen mind. 4,5 : 1)'}</span>`;
    }
  }
  function stripHTML() {
    return T.FARBEN.map((f) => `<button type="button" class="fb-chip" data-hex="${werte[f.k]}" style="--c:${werte[f.k]}" title="${esc(f.name)}: ${werte[f.k]} kopieren">` +
      `<span class="fb-chip-c" aria-hidden="true"></span><span class="fb-chip-n">${esc(f.name)}</span><code>${werte[f.k]}</code></button>`).join('');
  }
  function preview() {
    const box = $('fb-preview');
    for (const f of T.FARBEN) for (const p of f.vars) box.style.setProperty(p.replace('--', '--pv-'), werte[f.k]);
    $('fb-strip').innerHTML = stripHTML();
  }
  function all() {
    for (const f of T.FARBEN) update(f);
    preview();
    state();
  }
  function render() {
    $('fb-list').innerHTML = T.FARBEN.map(cardHTML).join('');
    $('fb-foot').hidden = !darf;
    $('fb-list-sub').textContent = darf
      ? 'Wo die Farbe vorkommt, ihre Werte und wie gut Schrift lesbar ist. Ändern über das Farbfeld oder den HEX-Wert, danach unten speichern.'
      : 'Wo die Farbe vorkommt, ihre Werte und wie gut Schrift lesbar ist. Ändern können nur Benutzer mit dem Recht „Farben der Website ändern“.';
    all();
  }
  function state() {
    if (!darf) return;
    const dirty = JSON.stringify(T.farbenClean(werte)) !== snap;
    $('fb-state').textContent = dirty ? 'Noch nicht gespeichert' : '';
    $('fb-state').classList.toggle('is-dirty', dirty);
    $('fb-reset').disabled = T.FARBEN.every((f) => werte[f.k] === f.std);
  }
  const dirty = () => darf && JSON.stringify(T.farbenClean(werte)) !== snap;

  async function load() {
    let gespeichert = {};
    try {
      const d = await A.readJSON(PATH);
      gespeichert = T.farbenClean(d && d.farben);
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('fb-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    werte = Object.fromEntries(T.FARBEN.map((f) => [f.k, gespeichert[f.k] || f.std]));
    snap = JSON.stringify(gespeichert);
    render();
  }
  async function loadKopfzeilen() {
    let themen = {};
    try {
      const d = await A.readJSON('data/themen.json');
      themen = (d && d.themen) || {};
    } catch { /* ohne Datei gilt der Standard */ }
    $('fb-kz').innerHTML = T.THEMEN.map((k) => {
      const hex = T.clean(T.pick(themen, k) || T.STANDARD).leiste;
      return `<button type="button" class="fb-chip" data-hex="${hex}" style="--c:${hex}" title="${BEREICHE[k]}: ${hex} kopieren">` +
        `<span class="fb-chip-c" aria-hidden="true"></span><span class="fb-chip-n">${BEREICHE[k]}</span><code>${hex}</code></button>`;
    }).join('');
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      A.toast(`${text} kopiert.`);
    } catch {
      A.toast('Kopieren geht hier nicht.', 'err');
    }
  }
  function setze(k, hex, ausFeld) {
    const f = byKey(k);
    if (!f || !hex) return;
    werte[k] = hex;
    update(f, ausFeld);
    /* Farben, die eine andere als Hintergrund pruefen, mitziehen */
    for (const g of T.FARBEN) if (g.gegen === k) update(g);
    preview();
    state();
  }

  async function save(ev) {
    ev.preventDefault();
    if (!darf) return;
    if (!dirty()) {
      A.toast('Keine Änderungen zu speichern.');
      return;
    }
    const vorher = JSON.parse(snap);
    const neu = T.farbenClean(werte);
    const geaendert = T.FARBEN.filter((f) => (vorher[f.k] || f.std) !== (neu[f.k] || f.std)).map((f) => f.name);
    const btn = $('fb-save');
    btn.disabled = true;
    try {
      const direct = await A.saveJSON(PATH, { farben: neu });
      snap = JSON.stringify(neu);
      state();
      A.toast(direct ? `Gespeichert: ${geaendert.join(', ')}.` : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Farben der Website geändert: ${geaendert.join(', ')}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(async () => {
    darf = A.can('farben');
    document.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.fb-chip');
      if (chip) return copy(chip.dataset.hex);
      const c = ev.target.closest('.fb-copy');
      if (c) return copy(c.closest('dd').querySelector('code').textContent);
      const std = ev.target.closest('[data-std]');
      if (std) setze(std.dataset.std, byKey(std.dataset.std).std);
    });
    $('fb-list').addEventListener('input', (ev) => {
      const k = ev.target.dataset.k;
      if (!k) return;
      if (ev.target.matches('input[type="color"]')) return setze(k, normHex(ev.target.value));
      if (ev.target.classList.contains('fb-hex')) {
        const hex = normHex(ev.target.value);
        ev.target.classList.toggle('is-invalid', !hex);
        if (hex) setze(k, hex, true);
      }
    });
    $('fb-list').addEventListener('focusout', (ev) => {
      if (!ev.target.classList.contains('fb-hex')) return;
      ev.target.value = werte[ev.target.dataset.k];
      ev.target.classList.remove('is-invalid');
    });
    $('fb-reset').addEventListener('click', () => {
      for (const f of T.FARBEN) werte[f.k] = f.std;
      all();
    });
    $('fb-form').addEventListener('submit', save);
    A.guard(dirty);
    A.folder.on((st) => { if (st === 'ok' && !dirty()) { load(); loadKopfzeilen(); } });
    await Promise.all([load(), loadKopfzeilen()]);
  });
})();
