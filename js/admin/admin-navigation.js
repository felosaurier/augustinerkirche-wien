/* ============================================================
   Augustinerkirche Wien — admin-navigation.js
   Menue & Leiste pflegen (admin/navigation.html), Quelle ist
   data/navigation.json: {bereiche: {"musik.html#p-solisten": {titel,
   leiste, menue, gruppe}}}. Gespeichert wird nur, was vom HTML abweicht;
   js/main.js wendet es auf jeder Seite an.
   Die Bereiche (linke Leiste) und das Menue oben liest die Seite aus dem
   HTML der Website, damit neue Bereiche ohne Nacharbeit erscheinen.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc } = A;
  const PATH = 'data/navigation.json';
  /* Seiten mit linker Leiste: [Datei, Name] */
  const PAGES = [
    ['augustiner.html', 'Augustiner'],
    ['musik.html', 'Kirchenmusik'],
    ['augustinerkirche.html', 'Augustinerkirche'],
    ['aspersdorf.html', 'Aspersdorf']
  ];
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  let menu = [];      /* [{id, label, groups: [{label, links: ["datei#bereich"]}]}] */
  let pages = [];     /* [{file, name, items: [{key, titel, gruppe, leiste0, menue0, ort}]}] */
  let saved = {};
  let snap = '';

  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const keyOf = (href) => {
    const m = /(?:^|\/)([\w-]+\.html)#([\w-]+)$/.exec(href || '');
    return m ? `${m[1]}#${m[2]}` : '';
  };

  /* ---------- Laden ---------- */
  function readMenu(doc) {
    return Array.from(doc.querySelectorAll('.nav-center .nav-item')).map((item) => ({
      id: item.id,
      label: clean(item.querySelector('.nav-btn').textContent),
      groups: Array.from(item.querySelectorAll('.mega-group')).map((g) => ({
        label: clean((g.querySelector('.mega-group-label') || {}).textContent),
        links: Array.from(g.querySelectorAll('a')).map((a) => keyOf(a.getAttribute('href'))).filter(Boolean)
      }))
    }));
  }
  /* Spalten mit diesem Eintrag als "Menuepunkt|Spalte" */
  function placesOf(key) {
    const out = [];
    for (const it of menu) for (const g of it.groups) if (g.links.includes(key)) out.push(`${it.id}|${g.label}`);
    return out;
  }
  function placeName(place) {
    const [id, label] = place.split('|');
    const it = menu.find((x) => x.id === id);
    return `${it ? it.label : id} › ${label}`;
  }
  /* Spalte fuer einen neuen Menue-Eintrag: dort, wo schon ein Bereich aus derselben
     Gruppe der Leiste steht, sonst die letzte des Menuepunkts, der auf die Seite zeigt */
  function defaultGroup(page, item) {
    const sibling = page.items.find((x) => x.gruppe === item.gruppe && x.ort.length);
    if (sibling) return sibling.ort[0];
    const it = menu.find((x) => x.groups.some((g) => g.links.some((k) => k.startsWith(`${page.file}#`)))) || menu[0];
    const g = it && it.groups[it.groups.length - 1];
    return g ? `${it.id}|${g.label}` : '';
  }
  function readPage(file, name, doc) {
    const items = [];
    let gruppe = '';
    for (const el of doc.querySelectorAll('.sidebar .sidebar-group-label, .sidebar .sidebar-item[data-pane]')) {
      if (el.classList.contains('sidebar-group-label')) { gruppe = clean(el.textContent); continue; }
      const key = `${file}#${el.dataset.pane}`;
      const ort = placesOf(key);
      items.push({ key, titel: clean(el.textContent), gruppe, leiste0: !el.hasAttribute('hidden'), menue0: ort.length > 0, ort });
    }
    return { file, name, items };
  }

  async function load() {
    try {
      menu = readMenu(parse(await A.fetchText('index.html')));
      pages = await Promise.all(PAGES.map(async ([file, name]) => readPage(file, name, parse(await A.fetchText(`pages/${file}`)))));
    } catch (e) {
      $('nv-pages').innerHTML = `<div class="adm-alert">${A.icon('alert')}<div>Die Seiten der Website konnten nicht gelesen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    try {
      const d = await A.readJSON(PATH);
      saved = (d && typeof d.bereiche === 'object' && d.bereiche) || {};
    } catch (e) {
      if (!notFound(e)) {
        $('nv-pages').innerHTML = `<div class="adm-alert">${A.icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
      saved = {};
    }
    render();
  }

  /* ---------- Anzeige ---------- */
  function groupOptions(value) {
    let html = '';
    for (const it of menu) {
      html += `<optgroup label="${esc(it.label)}">`;
      for (const g of it.groups) {
        const v = `${it.id}|${g.label}`;
        html += `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(it.label)} › ${esc(g.label)}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  }
  function rowHTML(page, it, i) {
    const s = saved[it.key] || {};
    const leiste = typeof s.leiste === 'boolean' ? s.leiste : it.leiste0;
    const menue = typeof s.menue === 'boolean' ? s.menue : it.menue0;
    const where = it.menue0
      ? `<span class="adm-muted">${esc(it.ort.map(placeName).join(', '))}</span>`
      : `<label class="visually-hidden" for="nv-g-${i}">Spalte im Menü für ${esc(it.titel)}</label>` +
        `<select class="adm-input" id="nv-g-${i}" data-gruppe${menue ? '' : ' disabled'}>${groupOptions(s.gruppe || defaultGroup(page, it))}</select>`;
    return `<tr data-key="${esc(it.key)}">` +
      `<th scope="row">${esc(it.titel)}${it.gruppe ? `<span class="adm-nv-grp">${esc(it.gruppe)}</span>` : ''}</th>` +
      `<td><label class="adm-check"><input type="checkbox" data-leiste${leiste ? ' checked' : ''}/><span class="visually-hidden">${esc(it.titel)} in der Leiste</span></label></td>` +
      `<td><label class="adm-check"><input type="checkbox" data-menue${menue ? ' checked' : ''}/><span class="visually-hidden">${esc(it.titel)} im Menü oben</span></label></td>` +
      `<td>${where}</td></tr>`;
  }
  function render() {
    let i = 0;
    $('nv-pages').innerHTML = pages.filter((p) => p.items.length).map((p) => `<section class="adm-panel" aria-labelledby="nv-h-${esc(p.file)}">` +
      `<h2 class="adm-panel-title" id="nv-h-${esc(p.file)}">${esc(p.name)}</h2>` +
      '<div class="adm-nv-wrap"><table class="adm-nv"><thead><tr><th scope="col">Bereich</th><th scope="col">Leiste</th><th scope="col">Menü oben</th><th scope="col">Stelle im Menü</th></tr></thead><tbody>' +
      p.items.map((it) => rowHTML(p, it, i++)).join('') +
      '</tbody></table></div></section>').join('');
    snap = A.snapshot($('nv-form'));
    setState('');
  }
  function setState(text) {
    $('nv-state').textContent = text;
    $('nv-state').classList.toggle('is-dirty', text === 'Noch nicht gespeichert');
  }

  /* ---------- Speichern ---------- */
  async function save(ev) {
    ev.preventDefault();
    const items = new Map(pages.flatMap((p) => p.items.map((it) => [it.key, it])));
    const bereiche = {};
    for (const tr of document.querySelectorAll('#nv-pages tr[data-key]')) {
      const it = items.get(tr.dataset.key);
      const leiste = tr.querySelector('[data-leiste]').checked;
      const menue = tr.querySelector('[data-menue]').checked;
      if (leiste === it.leiste0 && menue === it.menue0) continue;
      const b = { titel: it.titel, leiste, menue };
      const sel = tr.querySelector('[data-gruppe]');
      if (menue && !it.menue0 && sel) b.gruppe = sel.value;
      bereiche[it.key] = b;
    }
    const next = { bereiche };
    try {
      const direct = await A.saveJSON(PATH, next);
      saved = bereiche;
      render();
      setState(direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.');
      A.toast(direct ? 'Menü und Leiste gespeichert.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log('Menü und Leiste geändert');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    const form = $('nv-form');
    form.addEventListener('submit', save);
    form.addEventListener('change', (e) => {
      if (e.target.matches('[data-menue]')) {
        const sel = e.target.closest('tr').querySelector('[data-gruppe]');
        if (sel) sel.disabled = !e.target.checked;
      }
      setState(A.snapshot(form) !== snap ? 'Noch nicht gespeichert' : '');
    });
    A.guard(() => A.snapshot(form) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
