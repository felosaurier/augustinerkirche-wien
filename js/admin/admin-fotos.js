/* ============================================================
   Augustinerkirche Wien — admin-fotos.js
   Fotos der Seiten austauschen (admin/fotos.html): alle Fotos mit data-foto="…" (an <figure>
   oder direkt am <img>) auf den Seiten der Website, nach Seiten geordnet. Je Foto ein neues Bild, der Bildtext
   (unter dem Foto) und eine kurze Beschreibung (fuer Screenreader). Gleicher Schluessel an
   mehreren Stellen (z. B. Gruppenbild der Mitbrueder) = ein Foto fuer alle diese Stellen.
   Gespeichert in data/fotos.json: {fotos: {schluessel: {bild, breite, hoehe, alt, bildtext}}};
   die Website setzt es mit js/inhalte.js ein. Hochgeladene Bilder liegen in
   assets/img/seiten/<schluessel>-<Kennung>.webp; ein ersetztes eigenes Bild wird geloescht.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/fotos.json';
  const IMG_DIR = 'assets/img/seiten/';
  const OWN = /^assets\/img\/seiten\/[a-z0-9-]+-[a-z0-9]+\.webp$/;
  /* Seiten, die nach Fotos durchsucht werden (deutsche Fassungen) */
  const SEITEN = ['pages/augustiner.html', 'pages/augustinerkirche.html', 'pages/musik.html', 'pages/aspersdorf.html',
    'pages/kontakt.html', 'pages/orgel-rieger.html', 'pages/orgel-reil.html', 'pages/kalender.html', 'pages/archiv.html',
    'pages/impressum.html', 'pages/datenschutz.html'];

  let fotos = [];        /* [{key, seite, seitenTitel, bereich, standard, bildtext, hatText, alt, stellen: [{seitenTitel, bereich}]}] */
  let eigen = {};        /* data/fotos.json: fotos */
  let edit = null;
  let image = null;      /* {blob, ext, url, breite, hoehe} */
  let snap = '';

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const cur = (f) => eigen[f.key] || null;
  const bildVon = (f) => (cur(f) && cur(f).bild) || f.standard;
  const textVon = (f) => (cur(f) && cur(f).bildtext) || f.bildtext;

  /* Pfad im HTML ("../assets/…") -> Pfad ab der Wurzel ("assets/…") */
  function wurzel(seite, src) {
    try {
      return new URL(src, `https://x/${seite}`).pathname.replace(/^\//, '');
    } catch {
      return '';
    }
  }

  async function scan() {
    const liste = [];
    const gefunden = new Map();
    for (const seite of SEITEN) {
      let html;
      try {
        html = await A.fetchText(seite);
      } catch {
        continue;
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const seitenTitel = clean((doc.querySelector('title') || {}).textContent || seite).split(' — ')[0];
      for (const el of doc.querySelectorAll('[data-foto]')) {
        const key = el.dataset.foto;
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (!/^[a-z0-9-]+$/.test(key) || !img) continue;
        /* Abschnitt der Stelle: Ueberschrift des Reiters bzw. Bereichs */
        const pane = el.closest('.tab-pane, section');
        const h = pane && pane.querySelector('h1, h2');
        const stelle = { seitenTitel, bereich: h ? clean(h.textContent) : '' };
        const cap = el.tagName === 'FIGURE' ? el.querySelector('figcaption') : null;
        if (gefunden.has(key)) {
          const f = gefunden.get(key);
          f.stellen.push(stelle);
          if (!f.bildtext && cap) f.bildtext = clean(cap.textContent);
          if (cap) f.hatText = true;
          continue;
        }
        const f = {
          key, seite, seitenTitel, bereich: stelle.bereich,
          standard: wurzel(seite, img.getAttribute('src')),
          bildtext: cap ? clean(cap.textContent) : '',
          hatText: !!cap,
          alt: clean(img.getAttribute('alt') || ''),
          stellen: [stelle]
        };
        gefunden.set(key, f);
        liste.push(f);
      }
    }
    return liste;
  }

  async function load() {
    try {
      fotos = await scan();
    } catch (e) {
      $('fo-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Seiten konnten nicht gelesen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    eigen = {};
    try {
      const d = await A.readJSON(PATH);
      if (d && d.fotos && typeof d.fotos === 'object') eigen = d.fotos;
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('fo-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die ausgetauschten Fotos konnten nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    render();
  }

  function render() {
    const getauscht = fotos.filter((f) => cur(f)).length;
    $('fo-count').textContent = `${fotos.length} Fotos · ${getauscht ? `${getauscht} ausgetauscht` : 'alle wie ursprünglich'}`;
    if (!fotos.length) {
      $('fo-list').innerHTML = '<p class="adm-muted">Auf den Seiten wurden keine austauschbaren Fotos gefunden.</p>';
      return;
    }
    const seiten = [...new Set(fotos.map((f) => f.seite))];
    $('fo-list').innerHTML = seiten.map((s) => {
      const fs = fotos.filter((f) => f.seite === s);
      return `<section class="fo-seite"><h2 class="adm-group-title">${esc(fs[0].seitenTitel)}</h2><div class="en-grid">` + fs.map((f) => {
        const own = cur(f);
        return `<button type="button" class="en-card" data-key="${esc(f.key)}">` +
          `<span class="en-thumb"><img src="${esc(A.imageUrl(bildVon(f)))}" alt="" loading="lazy"/></span>` +
          '<span class="en-card-body fo-card-body">' +
            `<span class="fo-card-text">${esc(textVon(f) || f.alt || f.key)}</span>` +
            `<span class="fo-card-meta">${esc(stellenText(f))}</span>` +
            `<span class="adm-badge${own ? ' on' : ''}">${own ? 'Ausgetauscht' : 'Ursprüngliches Foto'}</span>` +
          '</span></button>';
      }).join('') + '</div></section>';
    }).join('');
  }

  /* "Seite · Abschnitt", bei mehreren Stellen alle */
  const stelleText = (s) => [s.seitenTitel, s.bereich].filter(Boolean).join(' · ');
  const stellenText = (f) => (f.stellen.length > 1
    ? `An ${f.stellen.length} Stellen: ${f.stellen.map(stelleText).join('; ')}`
    : f.bereich);

  /* ---------- Fenster ---------- */
  function zeigen() {
    $('fo-prev').src = image ? image.url : A.imageUrl(bildVon(edit));
  }
  function openEditor(key) {
    edit = fotos.find((f) => f.key === key);
    if (!edit) return;
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    const form = $('fo-form');
    form.reset();
    A.clearErrors(form);
    const own = cur(edit);
    $('fo-dlg-title').textContent = textVon(edit) || edit.alt || edit.key;
    $('fo-dlg-tag').textContent = stelleText(edit.stellen[0]);
    $('fo-text').value = (own && own.bildtext) || edit.bildtext;
    $('fo-text').placeholder = edit.bildtext || 'Kein Bildtext';
    $('fo-alt').value = (own && own.alt) || edit.alt;
    $('fo-mehr').hidden = edit.stellen.length < 2;
    $('fo-mehr').innerHTML = `Dieses Foto steht an ${edit.stellen.length} Stellen, der Austausch gilt für alle:<br>` +
      edit.stellen.map((s) => `– ${esc(stelleText(s))}`).join('<br>');
    $('fo-text-feld').hidden = !edit.hatText;
    $('fo-reset').hidden = !own;
    zeigen();
    A.openDialog($('fo-dlg'), { isDirty: () => dirty() });
    snap = A.snapshot(form);
  }
  const dirty = () => !!image || A.snapshot($('fo-form')) !== snap;

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
    let breite = 0;
    let hoehe = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      breite = bmp.width;
      hoehe = bmp.height;
      bmp.close();
    } catch { /* ohne Masse */ }
    if (image) URL.revokeObjectURL(image.url);
    image = { ...conv, url: URL.createObjectURL(conv.blob), breite, hoehe };
    zeigen();
  }

  async function persist(next) {
    const direct = await A.saveFile(PATH, JSON.stringify({ fotos: next }, null, 2) + '\n');
    eigen = next;
    render();
    return direct;
  }
  async function dropOld(path) {
    if (path && OWN.test(path)) {
      try { await A.media.remove([path]); } catch { /* bleibt liegen */ }
    }
  }

  async function save(ev) {
    ev.preventDefault();
    const f = edit;
    const old = cur(f);
    const bildtext = clean($('fo-text').value);
    const alt = clean($('fo-alt').value);
    if (!image && !old && bildtext === f.bildtext && alt === f.alt) {
      $('fo-dlg').close();
      return;
    }
    const btn = $('fo-save');
    btn.disabled = true;
    try {
      const eintrag = old ? { ...old } : { bild: '', breite: 0, hoehe: 0 };
      if (image) {
        eintrag.bild = `${IMG_DIR}${f.key}-${Date.now().toString(36)}.${image.ext}`;
        eintrag.breite = image.breite;
        eintrag.hoehe = image.hoehe;
        await A.saveFile(eintrag.bild, image.blob);
      }
      eintrag.bildtext = bildtext === f.bildtext ? '' : bildtext;
      eintrag.alt = alt === f.alt ? '' : alt;
      const next = { ...eigen };
      if (!eintrag.bild && !eintrag.bildtext && !eintrag.alt) delete next[f.key];
      else next[f.key] = eintrag;
      const direct = await persist(next);
      if (image && old && old.bild !== eintrag.bild) await dropOld(old.bild);
      $('fo-dlg').close();
      const name = bildtext || f.alt || f.key;
      A.toast(direct ? `Gespeichert: ${name}.` : `${name} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Foto der Seite ${image ? 'ausgetauscht' : 'geändert'}: ${f.seitenTitel} · ${name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function reset() {
    const f = edit;
    const old = cur(f);
    if (!old) return;
    const ok = await A.confirmBox({
      title: 'Ursprüngliches Foto wiederherstellen?',
      html: `Hier erscheint wieder das ursprüngliche Foto mit seinem Bildtext.` + (OWN.test(old.bild || '') ? ' Das hochgeladene Bild wird gelöscht.' : ''),
      ok: 'Wiederherstellen'
    });
    if (!ok) return;
    try {
      const next = { ...eigen };
      delete next[f.key];
      const direct = await persist(next);
      await dropOld(old.bild);
      $('fo-dlg').close();
      A.toast(direct ? 'Ursprüngliches Foto wiederhergestellt.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Foto der Seite zurückgesetzt: ${f.seitenTitel} · ${f.bildtext || f.key}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('fo-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-key]');
      if (b) openEditor(b.dataset.key);
    });
    A.wireDrop($('fo-drop'));
    $('fo-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('fo-form').addEventListener('submit', save);
    $('fo-reset').addEventListener('click', reset);
    $('fo-dlg').addEventListener('close', () => {
      if (image) URL.revokeObjectURL(image.url);
      image = null;
    });
    A.guard(() => $('fo-dlg').open && dirty());
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
