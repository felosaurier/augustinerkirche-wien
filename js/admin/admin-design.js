/* ============================================================
   Augustinerkirche Wien — admin-design.js
   Farben & Logo der Hauptseiten (admin/design.html), Quelle ist
   data/themen.json (Aufbau siehe js/thema.js). Je Thema: Farbe der
   Titelzeile (Vorschlaege oder frei), Schrift (automatisch, hell, dunkel),
   Logo aus assets/logo/ und der Text neben dem Logo (Name, Untertitel);
   dazu eine Vorschau der Titelzeile.
   Benoetigt js/thema.js, js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const T = window.AugThema;
  const { $, esc, icon } = A;
  const PATH = 'data/themen.json';

  const INFO = {
    augustinerkirche: { label: 'Augustinerkirche', seiten: 'Startseite und alle übrigen Seiten (Pfarre, Gottesdienste, Kalender …)', href: '../index.html' },
    kirchenmusik: { label: 'Kirchenmusik', seiten: 'Seite Kirchenmusik und die Seiten der einzelnen Hochämter', href: '../pages/musik.html' },
    augustiner: { label: 'Augustiner', seiten: 'Seite Augustiner', href: '../pages/augustiner.html' },
    aspersdorf: { label: 'Aspersdorf', seiten: 'Seite Aspersdorf', href: '../pages/aspersdorf.html' }
  };
  const FARBEN = [
    ['#10192e', 'Dunkelblau'], ['#1b2a4a', 'Marine'], ['#c9a24d', 'Gold'], ['#e9d9ad', 'Hellgold'],
    ['#ffffff', 'Weiß'], ['#6e1f2b', 'Bordeaux'], ['#1f3b2d', 'Tannengrün'], ['#111111', 'Schwarz']
  ];
  const LOGO_NAMEN = { gold: 'Gold', 'gold-dunkel': 'Dunkelgold', hellgold: 'Hellgold', weiss: 'Weiß', schwarz: 'Schwarz', marine: 'Dunkelblau', bordeaux: 'Bordeaux', tannengruen: 'Tannengrün', gruen: 'Grün' };

  let data = {};
  let snap = '';

  async function load() {
    let all = {};
    try {
      const d = await A.readJSON(PATH);
      all = (d && d.themen) || {};
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('ds-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    data = Object.fromEntries(T.THEMEN.map((k) => [k, T.clean(all[k] || T.STANDARD)]));
    render();
    snap = JSON.stringify(data);
    state();
  }

  function cardHTML(k) {
    const t = data[k];
    const info = INFO[k];
    const custom = !FARBEN.some(([hex]) => hex === t.leiste);
    return `<section class="adm-panel ds-card" data-k="${k}" aria-labelledby="ds-${k}-h">` +
      `<div class="ds-head"><h2 class="adm-panel-title" id="ds-${k}-h">${esc(info.label)}</h2>` +
      `<a class="link-arr" href="${info.href}" target="_blank" rel="noopener">Seite ansehen</a></div>` +
      `<p class="adm-panel-sub">${esc(info.seiten)}</p>` +
      '<div class="ds-preview" aria-hidden="true"></div>' +
      '<div class="adm-grid ds-text">' +
        `<div class="adm-field"><label class="adm-label" for="ds-${k}-name">Name neben dem Logo</label>` +
        `<input class="adm-input" type="text" id="ds-${k}-name" data-f="name" maxlength="60" value="${esc(t.name)}" placeholder="${esc(T.NAME)}"/></div>` +
        `<div class="adm-field"><label class="adm-label" for="ds-${k}-sub">Untertitel</label>` +
        `<input class="adm-input" type="text" id="ds-${k}-sub" data-f="untertitel" maxlength="60" value="${esc(t.untertitel)}" placeholder="${esc(T.UNTERTITEL)}"/></div>` +
      '</div>' +
      '<div class="ds-grid">' +
        `<fieldset class="ds-fs"><legend class="adm-label">Farbe der Titelzeile</legend><div class="ds-swatches">` +
          FARBEN.map(([hex, name]) => `<button type="button" class="ds-swatch" data-farbe="${hex}" aria-pressed="${t.leiste === hex}" title="${name}" style="--c:${hex}"><span class="visually-hidden">${name}</span></button>`).join('') +
          `<label class="ds-custom${custom ? ' on' : ''}" title="Eigene Farbe"><input type="color" value="${esc(t.leiste)}" data-f="leiste" aria-label="Eigene Farbe für ${esc(info.label)}"/><span>Eigene</span></label>` +
        '</div></fieldset>' +
        `<fieldset class="ds-fs"><legend class="adm-label">Schrift</legend><div class="adm-seg">` +
          [['auto', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']].map(([v, l]) =>
            `<button type="button" class="adm-seg-btn" data-schrift="${v}" aria-pressed="${t.schrift === v}">${l}</button>`).join('') +
        '</div></fieldset>' +
      '</div>' +
      `<fieldset class="ds-fs"><legend class="adm-label">Logo</legend><div class="ds-logos">` +
        T.LOGOS.map((v) => `<button type="button" class="ds-logo" data-logo="${v}" aria-pressed="${t.logo === v}">` +
          `<span class="ds-logo-img"><img src="${esc(T.logoUrl(v))}" alt="" width="44" height="44"/></span><span class="ds-logo-name">${LOGO_NAMEN[v] || v}</span></button>`).join('') +
      '</div></fieldset>' +
      '</section>';
  }
  /* Vorschau: dieselben Farben wie die echte Titelzeile (AugThema.vars) */
  function preview(k) {
    const card = document.querySelector(`.ds-card[data-k="${k}"]`);
    const t = data[k];
    const box = card.querySelector('.ds-preview');
    box.style.cssText = Object.entries(T.vars(t)).map(([p, v]) => `${p}:${v}`).join(';');
    box.innerHTML = `<span class="ds-p-logo"><img src="${esc(T.logoUrl(t.logo))}" alt="" width="34" height="34"/>` +
      `<span><span class="ds-p-name">${esc(t.name || T.NAME)}</span><span class="ds-p-sub">${esc(t.untertitel || T.UNTERTITEL)}</span></span></span>` +
      '<span class="ds-p-menu"><span>Augustinerkirche</span><span class="cur">Kirchenmusik</span><span>Augustiner</span></span>' +
      '<span class="ds-p-cta">Gottesdienste</span>';
    for (const b of card.querySelectorAll('[data-farbe]')) b.setAttribute('aria-pressed', String(b.dataset.farbe === t.leiste));
    card.querySelector('.ds-custom').classList.toggle('on', !FARBEN.some(([hex]) => hex === t.leiste));
    card.querySelector('input[type="color"]').value = t.leiste;
    for (const b of card.querySelectorAll('[data-schrift]')) b.setAttribute('aria-pressed', String(b.dataset.schrift === t.schrift));
    for (const b of card.querySelectorAll('[data-logo]')) {
      b.setAttribute('aria-pressed', String(b.dataset.logo === t.logo));
      b.querySelector('.ds-logo-img').style.background = t.leiste;
    }
  }
  function render() {
    $('ds-list').innerHTML = T.THEMEN.map(cardHTML).join('');
    T.THEMEN.forEach(preview);
  }
  function state() {
    $('ds-state').textContent = JSON.stringify(data) !== snap ? 'Noch nicht gespeichert' : '';
  }

  async function save(ev) {
    ev.preventDefault();
    if (JSON.stringify(data) === snap) {
      A.toast('Keine Änderungen zu speichern.');
      return;
    }
    const before = JSON.parse(snap);
    const changed = T.THEMEN.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(data[k])).map((k) => INFO[k].label);
    const btn = $('ds-save');
    btn.disabled = true;
    try {
      /* Text bereinigen wie die Website (js/thema.js) */
      for (const k of T.THEMEN) data[k] = T.clean(data[k]);
      const direct = await A.saveJSON(PATH, { themen: data });
      snap = JSON.stringify(data);
      state();
      A.toast(direct ? `Gespeichert: ${changed.join(', ')}.` : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Farben & Logo geändert: ${changed.join(', ')}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(async () => {
    const list = $('ds-list');
    list.addEventListener('click', (ev) => {
      const card = ev.target.closest('.ds-card');
      if (!card) return;
      const k = card.dataset.k;
      const b = ev.target.closest('[data-farbe],[data-schrift],[data-logo]');
      if (!b) return;
      if (b.dataset.farbe) data[k].leiste = b.dataset.farbe;
      if (b.dataset.schrift) data[k].schrift = b.dataset.schrift;
      if (b.dataset.logo) data[k].logo = b.dataset.logo;
      preview(k);
      state();
    });
    list.addEventListener('input', (ev) => {
      const f = ev.target.dataset.f;
      if (f === 'name' || f === 'untertitel') {
        const k = ev.target.closest('.ds-card').dataset.k;
        data[k][f] = ev.target.value;
        preview(k);
        state();
        return;
      }
      if (!ev.target.matches('input[type="color"]')) return;
      const k = ev.target.closest('.ds-card').dataset.k;
      data[k].leiste = ev.target.value.toLowerCase();
      preview(k);
      state();
    });
    $('ds-form').addEventListener('submit', save);
    A.guard(() => JSON.stringify(data) !== snap);
    A.folder.on((st) => { if (st === 'ok' && JSON.stringify(data) === snap) load(); });
    await load();
  });
})();
