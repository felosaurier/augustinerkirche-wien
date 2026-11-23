/* ============================================================
   Augustinerkirche Wien — admin-entdecken.js
   Der Bereich "Das könnte Sie interessieren …" der Startseite (admin/entdecken.html):
   Karten mit Titel, Ziel, Bild (mit Ausschnitt) und Links darunter, Reihenfolge,
   neue Karten, Karten entfernen, Einleitungssatz.
   Ausgangspunkt sind die Karten in index.html (<article class="v3-way" data-entdecken="…">).
   Gespeichert in data/entdecken.json:
     {einleitung, karten: [{key?, titel, link, bild, ausschnitt ("x% y%"), links: [{text, link}]}],
      bilder: {<key>: {bild, ausschnitt}}}
   karten: die deutsche Startseite baut den Bereich daraus neu (js/seiten/start-v2.js);
   bilder: eigene Bilder der sechs urspruenglichen Karten, damit auch die englische und
   italienische Startseite sie zeigen.
   Hochgeladene Bilder: assets/img/startseite/entdecken-<key|karte>-<Kennung>.webp; ein eigenes
   Bild, das keine Karte mehr verwendet, wird geloescht.
   Benoetigt js/gemeinsam/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/entdecken.json';
  const IMG_DIR = 'assets/img/startseite/';
  const OWN = /^assets\/img\/startseite\/entdecken-[a-z]+-[a-z0-9]+\.webp$/;
  /* Ziel: Seite dieser Website (pages/….html oder index.html, mit #Abschnitt oder ?id=…) oder https-Adresse */
  const LINK = /^((index|pages\/[a-z0-9\-/]+)\.html([#?][\w\-=&%.]*)?|https?:\/\/[^\s"<>]+)$/i;
  const NEU_BILD = 'assets/img/kirche/interior-hero.webp';
  const MAX_LINKS = 5;

  let standard = [];     /* Karten aus index.html */
  let karten = [];       /* aktuelle Karten (gespeichert oder Standard) */
  let einleitung = '';
  let einleitungStandard = '';
  let eigen = false;     /* gibt es gespeicherte Karten? */
  let edit = -1;         /* Index der Karte im Fenster, karten.length = neue Karte */
  let image = null;      /* neu gewaehltes Bild {blob, ext, url} */
  let links = null;      /* listEditor der Links */
  let snap = '';

  const url = (path) => A.imageUrl(path);
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const kopie = (k) => ({ ...k, links: (k.links || []).map((l) => ({ ...l })) });

  async function loadStandard() {
    const html = await A.fetchText('index.html');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const lead = doc.querySelector('#v3-ways-h')?.closest('.v3-head')?.querySelector('.v3-lead');
    einleitungStandard = lead ? clean(lead.textContent) : '';
    /* Vorschlaege fuer die Ziele: alle Seiten, auf die die Startseite verweist */
    const ziele = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      const text = clean(a.textContent);
      if (LINK.test(href) && !/^https?:/i.test(href) && text && !ziele.has(href)) ziele.set(href, text);
    }
    $('dl-en-ziel').innerHTML = Array.from(ziele, ([href, text]) => `<option value="${esc(href)}">${esc(text)}</option>`).join('');
    return Array.from(doc.querySelectorAll('[data-entdecken]')).map((el) => {
      const h = el.querySelector('h3 a') || el.querySelector('h3');
      return {
        key: el.dataset.entdecken,
        titel: clean(h ? h.textContent : ''),
        link: (h && h.getAttribute('href')) || '',
        bild: (el.querySelector('.v3-way-img img') || {}).getAttribute?.('src') || '',
        ausschnitt: '',
        links: Array.from(el.querySelectorAll('ul a'), (a) => ({ text: clean(a.textContent), link: a.getAttribute('href') || '' }))
      };
    }).filter((c) => /^[a-z]+$/.test(c.key));
  }

  async function load() {
    const fail = (what, e) => {
      $('en-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>${what} (${esc(e.message)}).</div></div>`;
    };
    try {
      standard = await loadStandard();
    } catch (e) {
      fail('Die Startseite konnte nicht gelesen werden', e);
      return;
    }
    let d = null;
    try {
      d = await A.readJSON(PATH);
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        fail('Die gespeicherten Karten konnten nicht geladen werden', e);
        return;
      }
    }
    eigen = !!(d && Array.isArray(d.karten) && d.karten.length);
    if (eigen) {
      karten = d.karten.map((k) => ({
        key: /^[a-z]+$/.test(k.key || '') ? k.key : '',
        titel: clean(k.titel), link: clean(k.link), bild: clean(k.bild), ausschnitt: clean(k.ausschnitt),
        links: (Array.isArray(k.links) ? k.links : []).map((l) => ({ text: clean(l.text), link: clean(l.link) })).filter((l) => l.text && l.link)
      }));
    } else {
      /* noch keine eigenen Karten: Standard, mit den bisher getauschten Bildern */
      const bilder = (d && d.bilder && typeof d.bilder === 'object') ? d.bilder : {};
      karten = standard.map((c) => (bilder[c.key] ? { ...kopie(c), bild: bilder[c.key].bild, ausschnitt: bilder[c.key].ausschnitt || '' } : kopie(c)));
    }
    einleitung = d && typeof d.einleitung === 'string' && d.einleitung.trim() ? d.einleitung.trim() : einleitungStandard;
    $('en-lead').value = einleitung;
    $('en-lead').placeholder = einleitungStandard;
    $('en-lead-save').disabled = true;
    render();
  }

  function render() {
    $('en-count').textContent = `${karten.length} ${karten.length === 1 ? 'Karte' : 'Karten'} · ${eigen ? 'eigene Auswahl' : 'Standard der Startseite'}`;
    $('en-reset-all').hidden = !eigen;
    const last = karten.length - 1;
    $('en-list').innerHTML = '<ul class="adm-rows">' + karten.map((k, i) =>
      `<li class="adm-row en-row" data-key="k-${i}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="en-row-thumb"><img src="${esc(url(k.bild || NEU_BILD))}" alt="" style="object-position:${esc(A.focusPos(k.ausschnitt) || '50% 50%')}"/></span>` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(k.titel)}</span>` +
          `<span class="adm-row-meta">${esc(k.links.map((l) => l.text).join(' · ') || 'ohne Links darunter')}</span></span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(k.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
          `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(k.titel)}" title="Nach unten"${i === last ? ' disabled' : ''}>${icon('down')}</button>` +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(k.titel)}"${karten.length < 2 ? ' disabled' : ''}>${icon('trash')}Entfernen</button>` +
        '</div></li>'
    ).join('') + '</ul>';
  }
  function flash(i, sel) {
    const row = document.querySelector(`.adm-row[data-key="k-${i}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = row.querySelector(sel || '.adm-row-open');
    if (btn) btn.focus({ preventScroll: true });
  }

  /* ---------- Speichern ---------- */
  function daten(next, lead) {
    /* eigene Bilder der urspruenglichen Karten auch fuer die anderen Sprachen */
    const bilder = {};
    for (const k of next) {
      const s = k.key && standard.find((c) => c.key === k.key);
      if (s && (k.bild !== s.bild || k.ausschnitt)) bilder[k.key] = { bild: k.bild, ausschnitt: k.ausschnitt };
    }
    return { einleitung: lead === einleitungStandard ? '' : lead, karten: next, bilder };
  }
  async function persist(next, lead = einleitung) {
    const direct = await A.saveFile(PATH, JSON.stringify(daten(next, lead), null, 2) + '\n');
    karten = next;
    einleitung = lead;
    eigen = true;
    render();
    return direct;
  }
  /* eigenes Bild loeschen, sobald es keine Karte mehr verwendet */
  async function dropUnused(paths) {
    const used = new Set(karten.map((k) => k.bild));
    const weg = [...new Set(paths)].filter((p) => p && OWN.test(p) && !used.has(p));
    if (!weg.length) return;
    try { await A.media.remove(weg); } catch { /* bleibt liegen */ }
  }
  const meldung = (direct, text) => A.toast(direct ? text : `${text} Bitte unten die Dateien herunterladen.`);

  /* ---------- Fenster ---------- */
  function showPick() {
    const k = karten[edit] || {};
    const src = image ? image.url : url(k.bild || NEU_BILD);
    const pos = A.focusPos($('en-focus').value) || '50% 50%';
    $('en-full').src = src;
    $('en-prev').src = src;
    $('en-prev').style.objectPosition = pos;
    const [x, y] = pos.split(' ');
    Object.assign($('en-dot').style, { left: x, top: y });
  }
  function setFocus(x, y) {
    const r = (v) => Math.max(0, Math.min(100, Math.round(v)));
    $('en-focus').value = `${r(x)}% ${r(y)}%`;
    showPick();
  }
  function openEditor(i) {
    edit = i;
    const k = karten[i] || { titel: '', link: '', bild: '', ausschnitt: '', links: [] };
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    $('en-form').reset();
    A.clearErrors($('en-form'));
    $('en-titel').value = k.titel;
    $('en-ziel').value = k.link;
    $('en-focus').value = A.focusPos(k.ausschnitt) || '';
    links.set(k.links.length ? k.links : [{}]);
    $('en-dlg-tag').textContent = karten[i] ? 'Karte bearbeiten' : 'Neue Karte';
    $('en-dlg-title').textContent = k.titel || 'Neue Karte';
    const s = k.key && standard.find((c) => c.key === k.key);
    $('en-std').hidden = !(s && k.bild !== s.bild);
    $('en-delete').hidden = !karten[i] || karten.length < 2;
    showPick();
    A.openDialog($('en-dlg'), { isDirty: () => dirty() });
    snap = A.snapshot($('en-form'));
    $('en-titel').focus();
  }
  const dirty = () => !!image || A.snapshot($('en-form')) !== snap;

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    let conv;
    try {
      conv = await A.toWebp(await A.stableFile(file), { maxSize: 2000, quality: 0.86 });
    } catch {
      return;   /* Meldung kam schon von toWebp */
    }
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob) };
    $('en-focus').value = '';
    showPick();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('en-form');
    A.clearErrors(form);
    const titel = clean($('en-titel').value);
    const link = clean($('en-ziel').value);
    const rows = links.values().map((l) => ({ text: clean(l.text), link: clean(l.link) })).filter((l) => l.text || l.link);
    const errors = [];
    if (!titel) errors.push([$('en-titel'), 'Bitte einen Titel eintragen.']);
    if (!LINK.test(link)) errors.push([$('en-ziel'), 'Bitte ein Ziel wählen: eine Seite dieser Website (z. B. pages/musik.html#p-chor) oder eine Adresse mit https://.']);
    const firstInput = links.el.querySelector('input') || $('en-titel');
    if (!firstInput.id) firstInput.id = 'en-link-erster';
    if (rows.some((l) => !l.text || !LINK.test(l.link))) errors.push([firstInput, 'Jeder Link darunter braucht einen Text und ein gültiges Ziel (Seite dieser Website oder https://…).']);
    if (rows.length > MAX_LINKS) errors.push([firstInput, `Höchstens ${MAX_LINKS} Links je Karte.`]);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const alt = karten[edit];
    const btn = $('en-save');
    btn.disabled = true;
    try {
      const key = alt ? alt.key : '';
      let bild = alt ? alt.bild : NEU_BILD;
      if (image) {
        bild = `${IMG_DIR}entdecken-${key || 'karte'}-${Date.now().toString(36)}.${image.ext}`;
        await A.saveFile(bild, image.blob);
      }
      const karte = { key, titel, link, bild, ausschnitt: A.focusPos($('en-focus').value) || '', links: rows };
      const next = karten.map(kopie);
      if (alt) next[edit] = karte;
      else next.push(karte);
      const direct = await persist(next);
      if (alt && image) await dropUnused([alt.bild]);
      $('en-dlg').close();
      meldung(direct, `Gespeichert: ${titel}.`);
      A.log(`${alt ? 'Karte geändert' : 'Karte hinzugefügt'} (Das könnte Sie interessieren): ${titel}`);
      flash(alt ? edit : next.length - 1);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* Bild der urspruenglichen Karte wiederherstellen */
  async function standardBild() {
    const k = karten[edit];
    const s = k && k.key && standard.find((c) => c.key === k.key);
    if (!s) return;
    const ok = await A.confirmBox({
      title: 'Standardbild wiederherstellen?',
      html: `Bei <strong>${esc(k.titel)}</strong> erscheint wieder das ursprüngliche Bild.` + (OWN.test(k.bild) ? ' Das hochgeladene Bild wird gelöscht.' : ''),
      ok: 'Standardbild'
    });
    if (!ok) return;
    try {
      const next = karten.map(kopie);
      next[edit] = { ...next[edit], bild: s.bild, ausschnitt: '' };
      const direct = await persist(next);
      await dropUnused([k.bild]);
      $('en-dlg').close();
      meldung(direct, `Standardbild bei ${k.titel}.`);
      A.log(`Entdecken-Bild zurückgesetzt: ${k.titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function remove(i) {
    const k = karten[i];
    if (!k || karten.length < 2) return;
    const ok = await A.confirmBox({
      title: 'Karte entfernen?',
      html: `<strong>${esc(k.titel)}</strong> erscheint nicht mehr auf der Startseite.` + (OWN.test(k.bild) ? ' Das hochgeladene Bild wird gelöscht.' : ''),
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      const next = karten.map(kopie);
      next.splice(i, 1);
      const direct = await persist(next);
      await dropUnused([k.bild]);
      if ($('en-dlg').open) $('en-dlg').close();
      meldung(direct, `Entfernt: ${k.titel}.`);
      A.log(`Karte entfernt (Das könnte Sie interessieren): ${k.titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= karten.length) return;
    const next = karten.map(kopie);
    [next[i], next[j]] = [next[j], next[i]];
    try {
      const direct = await persist(next);
      if (!direct) A.toast('Reihenfolge übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Reihenfolge geändert (Das könnte Sie interessieren): ${next[j].titel}`);
      flash(j, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function saveLead() {
    const lead = clean($('en-lead').value) || einleitungStandard;
    try {
      const direct = await persist(karten.map(kopie), lead);
      $('en-lead').value = lead;
      $('en-lead-save').disabled = true;
      meldung(direct, 'Einleitung gespeichert.');
      A.log('Einleitung geändert (Das könnte Sie interessieren)');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* Alles wie urspruenglich in index.html: eigene Karten, Texte und Bilder fallen weg */
  async function resetAll() {
    const ok = await A.confirmBox({
      title: 'Auf den Standard zurücksetzen?',
      html: 'Die Startseite zeigt wieder die ursprünglichen sechs Karten mit ihren Texten, Links und Bildern. Eigene Karten und hochgeladene Bilder werden entfernt.',
      ok: 'Zurücksetzen', danger: true
    });
    if (!ok) return;
    const alt = karten.map((k) => k.bild);
    try {
      const direct = await A.saveFile(PATH, JSON.stringify({ einleitung: '', karten: [], bilder: {} }, null, 2) + '\n');
      karten = standard.map(kopie);
      eigen = false;
      einleitung = einleitungStandard;
      $('en-lead').value = einleitung;
      $('en-lead-save').disabled = true;
      render();
      await dropUnused(alt);
      meldung(direct, 'Zurückgesetzt.');
      A.log('Das könnte Sie interessieren: auf Standard zurückgesetzt');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    links = A.listEditor($('en-links'), {
      fields: [
        { key: 'text', label: 'Text', placeholder: 'Text, z. B. Hochämter' },
        { key: 'link', label: 'Ziel', placeholder: 'Ziel, z. B. pages/musik.html#p-hochaemter', list: 'dl-en-ziel' }
      ],
      addLabel: 'Link hinzufügen', rowLabel: 'Link'
    });
    $('en-new').addEventListener('click', () => openEditor(karten.length));
    $('en-reset-all').addEventListener('click', resetAll);
    $('en-lead').addEventListener('input', () => { $('en-lead-save').disabled = clean($('en-lead').value) === einleitung; });
    $('en-lead-save').addEventListener('click', saveLead);
    $('en-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(i);
      else if (b.dataset.act === 'up') move(i, -1);
      else if (b.dataset.act === 'down') move(i, 1);
      else if (b.dataset.act === 'del') remove(i);
    });
    A.wireDrop($('en-drop'));
    $('en-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('en-pick').addEventListener('click', (ev) => {
      const r = $('en-full').getBoundingClientRect();
      if (!r.width || !r.height) return;
      setFocus(((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
    });
    $('en-pick').addEventListener('keydown', (ev) => {
      const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[ev.key];
      if (!step) return;
      ev.preventDefault();
      const [x, y] = (A.focusPos($('en-focus').value) || '50% 50%').split(' ').map(parseFloat);
      setFocus(x + step[0], y + step[1]);
    });
    $('en-center').addEventListener('click', () => {
      $('en-focus').value = '';
      showPick();
    });
    $('en-form').addEventListener('submit', save);
    $('en-std').addEventListener('click', standardBild);
    $('en-delete').addEventListener('click', () => remove(edit));
    $('en-dlg').addEventListener('close', () => {
      if (image) URL.revokeObjectURL(image.url);
      image = null;
    });
    A.guard(() => ($('en-dlg').open && dirty()) || !$('en-lead-save').disabled);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
