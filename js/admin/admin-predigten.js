/* ============================================================
   Augustinerkirche Wien — admin-predigten.js
   Predigten und Ansprachen pflegen (admin/predigten.html). Geteilte Ablage:
   data/predigten/index.json: {predigten: [{id, datum, titel, auszug, bild, breite, hoehe,
   bildtext, nachweis, entwurf}]} (Reihenfolge = Website) und je Beitrag
   data/predigten/<id>.json: {id, text}. Je Beitrag hoechstens ein Foto (assets/img/predigten/),
   der Text mit den Formatierungszeichen der Website (Leiste ueber dem Feld).
   Ein ersetztes oder entferntes Foto und ein geloeschter Beitrag verschwinden wirklich
   (Admin.media.remove). Gibt es nur die alte Sammeldatei data/predigten.json, wird sie beim
   ersten Speichern uebernommen und danach entfernt.
   Erscheint auf pages/augustinerkirche.html#p-predigten in der Reihenfolge der
   Datei: neue Beitraege nach Datum eingereiht, danach mit Pfeilen verschiebbar;
   ein Entwurf (entwurf: true) ist auf der Website verborgen.
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const INDEX = 'data/predigten/index.json';
  const LEGACY = 'data/predigten.json';
  const textPath = (id) => `data/predigten/${id}.json`;
  const IMG_DIR = 'assets/img/predigten/';

  let list = [];          /* Eintraege der Uebersicht (bei der alten Datei samt text) */
  let legacy = false;     /* noch die alte Sammeldatei */
  let texts = new Map();  /* id -> geladener Text */
  let textReady = Promise.resolve();
  let editText = '';      /* Text beim Oeffnen (fuer "geaendert?") */
  let query = '';
  let edit = -1;          /* Index in list oder -1 = neu */
  let snap = '';
  let image = null;       /* neu gewaehltes Foto {blob, ext, url, name, w, h} */
  let removeImage = false;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /* Neu (oder Datum geaendert): vor den ersten aelteren Beitrag, am selben Tag ganz oben */
  function placeEntry(xs, e, oldIndex = -1, keep = false) {
    if (oldIndex >= 0 && keep) {
      xs[oldIndex] = e;
      return;
    }
    if (oldIndex >= 0) xs.splice(oldIndex, 1);
    const at = xs.findIndex((x) => String(x.datum) <= String(e.datum));
    xs.splice(at < 0 ? xs.length : at, 0, e);
  }
  const longDate = (iso) => {
    const d = HD.dateFromIso(iso);
    return d ? `${d.getDate()}. ${HD.MONTHS[d.getMonth()]} ${d.getFullYear()}` : iso;
  };
  /* Text ohne Formatierungszeichen, fuer die Vorschau in der Liste */
  const plain = (t) => String(t || '').replace(/\[\/?(?:groß|klein)\]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_~]{1,2}/g, '').replace(/\s+/g, ' ').trim();

  /* Auszug fuer Liste und Website (ohne Formatierungszeichen) */
  const excerptOf = (text) => HD.plainText(String(text || '').split(/\n+/).join(' ')).slice(0, 400);
  const newId = (datum, titel) => {
    const base = `${datum}-${HD.slug(titel, 50) || 'predigt'}`;
    let id = base;
    for (let n = 2; list.some((p) => p.id === id); n++) id = `${base}-${n}`;
    return id;
  };

  /* ---------- Laden und Liste ---------- */
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  async function load() {
    texts = new Map();
    try {
      const d = await A.readJSON(INDEX);
      if (!d || !Array.isArray(d.predigten)) throw new Error('unerwarteter Inhalt');
      list = d.predigten.slice();
      legacy = false;
    } catch (e) {
      try {
        if (!notFound(e)) throw e;
        const d = await A.readJSON(LEGACY);
        if (!d || !Array.isArray(d.predigten)) throw new Error('unerwarteter Inhalt');
        list = d.predigten.slice();
        legacy = true;
      } catch (e2) {
        $('pd-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Predigten konnten nicht geladen werden (${esc(e2.message)}).</div></div>`;
        return;
      }
    }
    render();
  }
  /* Text eines Beitrags (aus der Detail-Datei, bei der alten Datei direkt) */
  async function textOf(p) {
    if (!p) return '';
    if (legacy) return String(p.text || '');
    if (texts.has(p.id)) return texts.get(p.id);
    const t = String((await A.readJSON(textPath(p.id))).text || '');
    texts.set(p.id, t);
    return t;
  }
  /* Alte Sammeldatei aufteilen: je Beitrag eine Datei, dann die Uebersicht, dann die alte Datei weg */
  async function migrate() {
    if (!legacy) return;
    const next = [];
    for (const p of list) {
      const id = p.id || newId(p.datum, p.titel);
      const { text, ...rest } = p;
      await A.saveJSON(textPath(id), { id, text: String(text || '') });
      texts.set(id, String(text || ''));
      const c = rest.bild ? (rest.nachweis || A.credits.get(rest.bild)) : '';
      next.push({ ...rest, id, auszug: excerptOf(text), ...(c ? { nachweis: c } : {}) });
      p.id = id;
    }
    await A.saveJSON(INDEX, { predigten: next });
    list = next;
    legacy = false;
    await A.discardFile(LEGACY);
    const old = Object.fromEntries(next.filter((p) => p.bild && A.credits.get(p.bild)).map((p) => [p.bild, '']));
    if (Object.keys(old).length) await A.credits.save(old);
    A.log('Predigten in die geteilte Ablage übernommen (data/predigten/)');
  }

  function render() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = list.map((p, i) => ({ p, i })).filter(({ p }) =>
      words.every((w) => `${p.titel} ${plain(p.auszug || p.text)}`.toLowerCase().includes(w)));
    $('pd-count').textContent = words.length ? `${plural(shown.length, 'Treffer', 'Treffer')} für „${query.trim()}“` : plural(list.length, 'Beitrag', 'Beiträge');
    if (!shown.length) {
      $('pd-list').innerHTML = words.length
        ? '<div class="adm-empty"><p class="adm-empty-title">Keine Treffer</p><button type="button" class="btn btn-quiet" data-act="clear">Suche zurücksetzen</button></div>'
        : `<div class="adm-empty"><p class="adm-empty-title">Noch keine Predigt eingetragen</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Beitrag hinzufügen</button></div>`;
      return;
    }
    const searching = words.length > 0;
    $('pd-list').innerHTML = '<ul class="adm-rows">' + shown.map(({ p, i }) => {
      const src = p.bild ? A.imageUrl(p.bild) : '';
      return `<li class="adm-row" data-key="pd-${i}">` +
        `<button type="button" class="adm-row-open has-thumb" data-act="edit" data-i="${i}">` +
          (src ? `<span class="adm-thumb photo"><img src="${esc(src)}" alt="" loading="lazy"/></span>`
            : '<span class="adm-thumb none"><img src="../assets/logo-gold.png" alt=""/></span>') +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(p.titel)}</span>` +
          `<span class="adm-row-meta">${esc(longDate(p.datum))}</span>` +
          `<span class="adm-row-people">${esc(plain(p.auszug || p.text).slice(0, 140))}</span></span>` +
          (p.entwurf ? '<span class="adm-badge" title="Auf der Website nicht sichtbar">Entwurf</span>' : '<span></span>') +
        '</button>' +
        '<div class="adm-row-actions">' +
          (searching ? '' :
            `<button type="button" class="adm-act icon" data-act="up" data-i="${i}" aria-label="Nach oben: ${esc(p.titel)}" title="Nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
            `<button type="button" class="adm-act icon" data-act="down" data-i="${i}" aria-label="Nach unten: ${esc(p.titel)}" title="Nach unten"${i === list.length - 1 ? ' disabled' : ''}>${icon('down')}</button>`) +
          (p.entwurf
            ? `<button type="button" class="adm-act icon" data-act="publish" data-i="${i}" aria-label="Veröffentlichen: ${esc(p.titel)}" title="Entwurf: auf der Website verborgen. Klicken zum Veröffentlichen">${icon('eyeOff')}</button>`
            : `<button type="button" class="adm-act icon" data-act="draft" data-i="${i}" aria-label="Als Entwurf verbergen: ${esc(p.titel)}" title="Sichtbar. Klicken, um den Beitrag als Entwurf zu verbergen">${icon('eye')}</button>`) +
          `<button type="button" class="adm-act icon danger" data-act="del" data-i="${i}" aria-label="Entfernen: ${esc(p.titel)}" title="Entfernen">${icon('trash')}</button>` +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function flash(key, sel) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    const btn = sel && row.querySelector(sel);
    if (btn) btn.focus({ preventScroll: true });
  }

  /* Uebersicht schreiben (vorher ggf. die alte Datei aufteilen) */
  async function persist(next) {
    await migrate();
    const clean2 = next.map(({ text, ...rest }) => rest);   // eslint-disable-line no-unused-vars
    const direct = await A.saveJSON(INDEX, { predigten: clean2 });
    list = clean2;
    return direct;
  }

  /* Pfeile: mit dem Nachbarn tauschen */
  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    await migrate();
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await persist(next);
      render();
      flash(`pd-${j}`, `[data-act="${dir < 0 ? 'up' : 'down'}"]:not([disabled])`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* Auge: Entwurf ein/aus */
  async function setDraft(i, on) {
    await migrate();
    const next = list.slice();
    const p = { ...next[i] };
    if (on) p.entwurf = true;
    else delete p.entwurf;
    next[i] = p;
    try {
      const direct = await persist(next);
      render();
      flash(`pd-${i}`, `[data-act="${on ? 'publish' : 'draft'}"]`);
      A.toast(!direct ? 'Übernommen. Bitte unten die Datei herunterladen.'
        : on ? `„${p.titel}“ ist jetzt ein Entwurf und auf der Website verborgen.` : `„${p.titel}“ ist jetzt auf der Website sichtbar.`);
      A.log(`Predigt/Ansprache ${on ? 'als Entwurf verborgen' : 'veröffentlicht'}: ${p.titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Fenster: Foto ---------- */
  function currentPhoto() {
    const p = edit >= 0 ? list[edit] : null;
    return p && p.bild && !removeImage ? p : null;
  }
  function renderImage() {
    const cur = currentPhoto();
    const src = image ? image.url : cur ? A.imageUrl(cur.bild) : '';
    $('pd-prev').innerHTML = src ? `<img src="${esc(src)}" alt="Vorschau des Fotos"/>` : '<span class="none">Noch kein Foto</span>';
    $('pd-imginfo').textContent = image ? `${image.name} · ${image.w} × ${image.h} Pixel` : cur ? `Aktuelles Foto: ${cur.bild}` : '';
    $('pd-img-remove').hidden = !src;
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      A.toast('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).', 'err');
      return;
    }
    const conv = await A.toWebp(file, { maxSize: 1200, quality: 0.84 });
    let w = 0;
    let h = 0;
    try {
      const bmp = await createImageBitmap(conv.blob);
      w = bmp.width;
      h = bmp.height;
      if (bmp.close) bmp.close();
    } catch { /* Groesse unbekannt */ }
    if (image) URL.revokeObjectURL(image.url);
    /* Es gibt nur ein Foto: ein neues ersetzt das bisherige */
    image = { ...conv, url: URL.createObjectURL(conv.blob), name: file.name, w, h };
    removeImage = false;
    renderImage();
  }
  function dropImage() {
    if (image) {
      URL.revokeObjectURL(image.url);
      image = null;
    } else {
      removeImage = true;
    }
    $('f-file').value = '';
    renderImage();
  }
  async function freePath(base, ext, old) {
    let path = `${IMG_DIR}${base}.${ext}`;
    for (let n = 2; ((old && old.bild === path) || (A.folder.state === 'ok' && await A.folder.exists(path))); n++) path = `${IMG_DIR}${base}-${n}.${ext}`;
    return path;
  }
  const dirtyState = () => A.snapshot($('pd-form')) + (image ? 'neu' : '') + (removeImage ? 'weg' : '');

  /* ---------- Fenster ---------- */
  function openEditor(i) {
    edit = i === undefined ? -1 : i;
    const p = edit >= 0 ? list[edit] : null;
    const form = $('pd-form');
    form.reset();
    A.clearErrors(form);
    $('f-titel').value = p ? p.titel : '';
    $('f-datum').value = p ? p.datum || '' : A.isoToday();
    $('f-text').value = '';
    editText = '';
    $('f-text').disabled = !!p;
    $('f-text').placeholder = p ? 'Der Text wird geladen …' : '';
    $('f-bildtext').value = p ? p.bildtext || '' : '';
    $('f-draft').checked = !!(p && p.entwurf);
    $('f-credit').value = p && p.bild ? (p.nachweis !== undefined ? p.nachweis : A.credits.get(p.bild)) : '';
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    removeImage = false;
    $('f-file').value = '';
    renderImage();
    $('pd-dlg-tag').textContent = p ? 'Bearbeiten' : 'Hinzufügen';
    $('pd-dlg-title').textContent = p ? p.titel : 'Neuer Beitrag';
    $('pd-delete').hidden = !p;
    A.openDialog($('pd-dlg'), { isDirty: () => dirtyState() !== snap });
    snap = dirtyState();
    /* Text erst jetzt laden; bis dahin ist das Feld gesperrt (nichts geht verloren) */
    const mine = p;
    textReady = (async () => {
      if (!mine) return;
      try {
        const t = await textOf(mine);
        if (edit < 0 || list[edit] !== mine) return;
        const untouched = dirtyState() === snap;
        $('f-text').value = t;
        editText = t;
        $('f-text').disabled = false;
        $('f-text').placeholder = '';
        if (untouched) snap = dirtyState();
      } catch (e) {
        $('f-text').placeholder = '';
        A.toast(`Der Text konnte nicht geladen werden (${e.message}). Bitte die Seite neu laden.`, 'err');
      }
    })();
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('pd-form');
    await textReady;
    if ($('f-text').disabled) {
      A.toast('Der Text ist noch nicht geladen. Bitte die Seite neu laden.', 'err');
      return;
    }
    const titel = clean($('f-titel').value);
    const datum = $('f-datum').value;
    const text = $('f-text').value.replace(/\r\n/g, '\n').trim();
    const errors = [];
    if (!titel) errors.push([$('f-titel'), 'Bitte einen Titel eintragen.']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) errors.push([$('f-datum'), 'Bitte das Datum angeben.']);
    if (!text) errors.push([$('f-text'), 'Bitte den Text eintragen.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const btn = $('pd-save');
    btn.disabled = true;
    try {
      await migrate();
      const old = edit >= 0 ? list[edit] : null;
      const cur = currentPhoto();
      const entry = {
        id: old && old.id ? old.id : newId(datum, titel),
        datum, titel, auszug: excerptOf(text),
        bild: cur ? cur.bild : '', breite: cur ? cur.breite || 0 : 0, hoehe: cur ? cur.hoehe || 0 : 0,
        bildtext: clean($('f-bildtext').value)
      };
      if ($('f-draft').checked) entry.entwurf = true;
      if (image) {
        const path = await freePath(`${datum}-${HD.slug(titel, 50) || 'predigt'}`, image.ext, old);
        await A.saveFile(path, image.blob);
        Object.assign(entry, { bild: path, breite: image.w, hoehe: image.h });
      }
      /* Bildnachweis steht beim Beitrag (nicht mehr in data/bildnachweise.json) */
      const credit = clean($('f-credit').value);
      if (entry.bild && credit) entry.nachweis = credit;
      /* Text zuerst (eigene Datei), dann die Uebersicht */
      if (!old || text !== editText) {
        await A.saveJSON(textPath(entry.id), { id: entry.id, text });
        texts.set(entry.id, text);
      }
      const next = list.slice();
      /* Bestehender Beitrag bleibt an seiner Stelle, solange das Datum gleich bleibt */
      placeEntry(next, entry, old ? edit : -1, !!old && old.datum === datum);
      const direct = await persist(next);
      if (entry.bild && A.credits.get(entry.bild)) await A.credits.set(entry.bild, '');
      /* Ersetztes oder entferntes Foto wirklich loeschen (samt kleiner Fassung und Nachweis) */
      if (old && old.bild && old.bild !== entry.bild) await A.media.remove([old.bild]);
      $('pd-dlg').close();
      query = '';
      $('pd-search').value = '';
      render();
      flash(`pd-${list.findIndex((x) => x.id === entry.id)}`);
      A.toast(direct ? `Gespeichert: ${titel}.` : `${titel} übernommen. Bitte unten die Dateien herunterladen.`);
      A.log(`Predigt/Ansprache ${old ? 'geändert' : 'ergänzt'}: ${titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const p = list[i];
    const ok = await A.confirmBox({
      title: 'Beitrag entfernen?',
      html: `<strong>${esc(p.titel)}</strong><br>${esc(longDate(p.datum))}<br><br>Der Beitrag verschwindet von der Seite „Predigten und Ansprachen“.${p.bild ? ' Das Foto wird gelöscht.' : ''}`,
      ok: 'Entfernen', danger: true
    });
    if (!ok) return;
    try {
      await migrate();
      const q = list[i];
      const direct = await persist(list.filter((_, k) => k !== i));
      /* Text-Datei und Foto wirklich loeschen */
      if (q.id) {
        await A.discardFile(textPath(q.id));
        texts.delete(q.id);
      }
      if (q.bild) await A.media.remove([q.bild]);
      if ($('pd-dlg').open) $('pd-dlg').close();
      render();
      A.toast(direct ? `Entfernt: ${p.titel}.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Predigt/Ansprache entfernt: ${p.titel}`);
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    A.credits.load();
    $('f-file').addEventListener('change', (ev) => onFile(ev.target.files[0]));
    $('pd-img-remove').addEventListener('click', dropImage);
    A.wireDrop($('pd-drop'));
    $('pd-new').addEventListener('click', () => openEditor());
    $('pd-form').addEventListener('submit', save);
    $('pd-delete').addEventListener('click', () => { if (edit >= 0) remove(edit); });
    $('pd-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'edit') openEditor(Number(b.dataset.i));
      else if (act === 'del') remove(Number(b.dataset.i));
      else if (act === 'up' || act === 'down') move(Number(b.dataset.i), act === 'up' ? -1 : 1);
      else if (act === 'draft' || act === 'publish') setDraft(Number(b.dataset.i), act === 'draft');
      else if (act === 'new') openEditor();
      else if (act === 'clear') {
        query = '';
        $('pd-search').value = '';
        render();
      }
    });
    let timer = 0;
    $('pd-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 120);
    });
    A.guard(() => $('pd-dlg').open && dirtyState() !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor();
      history.replaceState(null, '', location.pathname);
    }
  });
})();
