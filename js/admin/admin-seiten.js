/* ============================================================
   Augustinerkirche Wien — admin-seiten.js
   Abschnitte der Seiten Augustiner (Kloster) und Aspersdorf pflegen
   (admin/seiten.html?seite=augustiner|aspersdorf), Quelle ist
   data/seite-<seite>.json: {abschnitte: [{id, titel, gruppe, zeile,
   ueberschrift, bloecke}]}; js/inhalte.js baut die Seite daraus.
   - Gibt es die Datei noch nicht, wird der Stand aus dem HTML der Seite
     uebernommen: Absaetze, Zwischentitel, Listen, Bilder und einfache
     Karten werden bearbeitbar, alles andere (Kontaktkarten, Tabellen,
     Zeitleisten …) bleibt ein fester Baustein {art: 'fest', nr} und wird
     auf der Website aus dem HTML genommen.
   - Abschnitte und Bausteine anlegen, umstellen und entfernen
   - Bilder als WebP nach assets/img/<seite>/, mit Bildnachweis
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const SEITEN = {
    augustiner: { file: 'augustiner.html', name: 'Augustiner', em: 'Kloster & Orden' },
    aspersdorf: { file: 'aspersdorf.html', name: 'Aspersdorf', em: 'Pfarre St. Georg' }
  };
  const KEY = new URLSearchParams(location.search).get('seite') in SEITEN ? new URLSearchParams(location.search).get('seite') : 'augustiner';
  const SEITE = SEITEN[KEY];
  const PATH = `data/seite-${KEY}.json`;
  const IMG_DIR = `assets/img/${KEY}/`;
  /* Bausteine zum Anlegen: [art, Name] */
  const ARTEN = [['text', 'Text'], ['einleitung', 'Einleitung'], ['zwischentitel', 'Zwischentitel'], ['bild', 'Bild'], ['liste', 'Liste'], ['karten', 'Karten']];
  const ART_NAME = Object.fromEntries(ARTEN.concat([['fest', 'Fester Baustein']]));

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const notFound = (e) => !!e && (e.status === 404 || e.name === 'NotFoundError');
  let uid = 0;
  const nextUid = () => `u${++uid}`;

  let secs = [];          /* Abschnitte; Bausteine mit _uid, neue Bilder mit _blob/_url */
  let fest = new Map();   /* Abschnitt-ID -> [{nr, name, vorschau}] feste Bausteine aus dem HTML */
  let fromHtml = false;
  let open = new Set();   /* aufgeklappte Abschnitte (_uid) */
  let snap = '';

  /* ---------- HTML der Seite in Bausteine umwandeln ---------- */
  const INLINE = new Set(['EM', 'I', 'STRONG', 'B', 'U', 'S', 'BR', 'A', 'SPAN']);
  /* Nur schlichter Text mit Hervorhebungen und Links laesst sich als Text bearbeiten */
  function simple(el) {
    for (const d of el.querySelectorAll('*')) {
      if (!INLINE.has(d.tagName) || d.hasAttribute('style')) return false;
      if (d.tagName === 'SPAN' && !/^fs-(gross|klein)$/.test(d.className)) return false;
      if (d.tagName === 'A' && d.className && d.className !== 'mail') return false;
    }
    return true;
  }
  const mailAddr = (code) => [...String(code).replace('|', '@')].reverse().join('');
  /* Adresse einer Seite der Website relativ zur Wurzel (wie in den Datendateien) */
  function siteLink(href) {
    try {
      const u = new URL(href, `https://seite.invalid/pages/${SEITE.file}`);
      if (u.host !== 'seite.invalid') return u.href;
      return u.pathname.slice(1) + u.hash;
    } catch {
      return href;
    }
  }
  /* Inhalt eines Elements in die Zeichen der Formatierungsleiste (HD.richText) */
  function markup(node) {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += n.textContent.replace(/\s+/g, ' '); continue; }
      if (n.nodeType !== 1) continue;
      const inner = markup(n);
      switch (n.tagName) {
        case 'BR': out += '\n'; break;
        case 'EM': case 'I': out += `*${inner}*`; break;
        case 'STRONG': case 'B': out += `**${inner}**`; break;
        case 'U': out += `__${inner}__`; break;
        case 'S': out += `~~${inner}~~`; break;
        case 'SPAN': out += n.className === 'fs-gross' ? `[groß]${inner}[/groß]` : `[klein]${inner}[/klein]`; break;
        case 'A': {
          if (n.classList.contains('mail')) {
            const addr = mailAddr(n.dataset.mail || '');
            out += clean(n.textContent) === addr.replace('@', '(at)').replace(/\./g, '(dot)') ? addr : `[${inner}](mailto:${addr})`;
          } else {
            const href = n.getAttribute('href') || '';
            out += /^tel:/i.test(href) ? `[${inner}](tel:${href.slice(4)})` : `[${inner}](${siteLink(href)})`;
          }
          break;
        }
        default: out += inner;
      }
    }
    return out;
  }
  const md = (el) => markup(el).replace(/ *\n */g, '\n').trim();

  /* Kurzbeschreibung eines festen Bausteins */
  function festName(el) {
    const c = el.classList;
    const t = (sel) => clean((el.querySelector(sel) || {}).textContent);
    if (c.contains('kontakt-card')) return `Kontaktkarte: ${t('.kontakt-title')}`;
    if (c.contains('pgr-list')) return `Personenliste (${el.querySelectorAll(':scope > li').length} Personen)`;
    if (c.contains('timeline')) return 'Zeitleiste';
    if (c.contains('facts')) return 'Kennzahlen';
    if (c.contains('sakr-band')) return 'Leiste „Zu den Sakramenten“';
    if (c.contains('sakr-sec')) return `Sakrament: ${t('.sakr-sec-title')}`;
    if (c.contains('cards-stack')) return `Karten: ${Array.from(el.querySelectorAll('.card-title'), (x) => clean(x.textContent)).join(', ')}`;
    if (c.contains('saint-list')) return 'Liste von Heiligen';
    if (c.contains('link-list')) return 'Linkliste';
    if (c.contains('people-stack')) return 'Personen';
    if (c.contains('aug-grid')) return 'Einleitung mit Bild';
    if (c.contains('card')) return `Karte: ${t('.card-title')}`;
    if (el.tagName === 'TABLE' || el.querySelector('table')) return 'Tabelle';
    if (el.tagName === 'FIGURE' || el.tagName === 'IMG') return `Bild${el.querySelector('figcaption') ? `: ${t('figcaption')}` : ''}`;
    if (el.tagName === 'H3') return `Überschrift: ${clean(el.textContent)}`;
    if (c.contains('s-label')) return `Kleine Zeile: ${clean(el.textContent)}`;
    if (el.querySelector('a.link-arr')) return 'Links';
    if (el.tagName === 'P') return 'Absatz';
    return 'Baustein';
  }

  function cardsOf(el) {
    const cards = [];
    for (const card of el.children) {
      if (!card.classList.contains('card')) return null;
      const k = { titel: '', kurz: '', text: [] };
      for (const part of card.children) {
        if (!simple(part) || part.hasAttribute('style')) return null;
        if (part.classList.contains('card-title')) k.titel = clean(part.textContent);
        else if (part.classList.contains('card-text')) k.kurz = md(part);
        else if (part.tagName === 'P' && part.classList.contains('card-more')) k.text.push(md(part));
        else return null;
      }
      cards.push({ titel: k.titel, kurz: k.kurz, text: k.text.join('\n\n') });
    }
    return cards.length ? cards : null;
  }
  function figureOf(el) {
    if (el.tagName !== 'FIGURE' || !/^pane-fig( hoch)?$/.test(el.className)) return null;
    const img = el.querySelector('img');
    if (!img || el.querySelectorAll('img').length !== 1) return null;
    const cap = el.querySelector('figcaption');
    if (cap && !simple(cap)) return null;
    return {
      art: 'bild', bild: siteLink(img.getAttribute('src')), alt: img.getAttribute('alt') || '',
      unterschrift: cap ? md(cap) : '', breite: HD.num(img.getAttribute('width'), 0), hoehe: HD.num(img.getAttribute('height'), 0)
    };
  }

  function convertPane(pane) {
    const out = { zeile: '', ueberschrift: '', bloecke: [] };
    const fixed = [];
    const kids = Array.from(pane.children);
    const push = (b) => {
      const last = out.bloecke[out.bloecke.length - 1];
      /* Aufeinanderfolgende Absaetze werden ein Text (Absaetze durch Leerzeile) */
      if (last && (b.art === 'text' || b.art === 'einleitung') && last.art === b.art) last.text += `\n\n${b.text}`;
      else out.bloecke.push(b);
    };
    kids.forEach((el, nr) => {
      const c = el.classList;
      if (nr < 3 && !out.zeile && !out.ueberschrift && el.tagName === 'DIV' && el.className === 's-label') { out.zeile = clean(el.textContent); return; }
      if (nr < 3 && !out.ueberschrift && el.tagName === 'H2' && c.contains('s-title') && simple(el)) { out.ueberschrift = clean(el.textContent); return; }
      /* Ein Abstand im style-Attribut geht verloren; Zeilen mit Links (display:flex) bleiben fest */
      if (el.tagName === 'P' && !/display/.test(el.getAttribute('style') || '') && simple(el) && (c.contains('bio-p') || c.contains('s-text')) && c.length === 1) {
        push({ art: c.contains('s-text') ? 'einleitung' : 'text', text: md(el) });
        return;
      }
      if (el.tagName === 'H3' && el.className === 'pane-sub' && simple(el)) { push({ art: 'zwischentitel', text: clean(el.textContent) }); return; }
      if (el.tagName === 'UL' && el.className === 'pgr-tasks' && Array.from(el.children).every((li) => li.tagName === 'LI' && simple(li))) {
        push({ art: 'liste', punkte: Array.from(el.children, md) });
        return;
      }
      const fig = figureOf(el);
      if (fig) { push(fig); return; }
      if (el.tagName === 'DIV' && el.className === 'cards-stack') {
        const karten = cardsOf(el);
        if (karten) { push({ art: 'karten', karten }); return; }
      }
      push({ art: 'fest', nr });
      fixed.push({ nr, name: festName(el), vorschau: clean(el.textContent).slice(0, 160) });
    });
    return { ...out, fixed };
  }

  function readPage(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const box = doc.querySelector('.with-sidebar[data-seite]');
    if (!box) throw new Error('Die Seite hat keine Abschnitte');
    const area = box.querySelector('.sidebar').nextElementSibling;
    const list = [];
    let gruppe = '';
    for (const el of box.querySelectorAll('.sidebar .sidebar-group-label, .sidebar .sidebar-item[data-pane]')) {
      if (el.classList.contains('sidebar-group-label')) { gruppe = clean(el.textContent); continue; }
      const pane = area.querySelector(`#${CSS.escape(el.dataset.pane)}`);
      if (!pane) continue;
      const conv = convertPane(pane);
      fest.set(pane.id, conv.fixed);
      list.push({ id: pane.id, titel: clean(el.textContent), gruppe, zeile: conv.zeile, ueberschrift: conv.ueberschrift, bloecke: conv.bloecke });
    }
    return list;
  }

  /* ---------- Laden ---------- */
  const withUids = (list) => list.map((s) => ({
    ...s,
    _uid: nextUid(),
    bloecke: (s.bloecke || []).filter(Boolean).map((b) => {
      const credit = b.art === 'bild' ? A.credits.get(b.bild) : undefined;
      return { ...b, _uid: nextUid(), credit, _credit0: credit };
    })
  }));
  async function load() {
    let fromPage;
    try {
      fest = new Map();
      fromPage = readPage(await A.fetchText(`pages/${SEITE.file}`));
    } catch (e) {
      $('sx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Seite <code>pages/${esc(SEITE.file)}</code> konnte nicht gelesen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    await A.credits.load();
    let saved = null;
    try {
      const d = await A.readJSON(PATH);
      if (!d || !Array.isArray(d.abschnitte)) throw new Error('unerwarteter Inhalt');
      saved = d.abschnitte.filter((s) => s && typeof s === 'object' && /^[\w-]+$/.test(s.id || ''));
    } catch (e) {
      if (!notFound(e)) {
        $('sx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${esc(PATH)}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    fromHtml = !saved;
    secs = withUids(saved || fromPage);
    $('sx-note').innerHTML = fromHtml
      ? `<div class="adm-alert">${icon('info')}<div>Diese Seite wurde hier noch nie gespeichert. Angezeigt wird der jetzige Stand der Website. Erst nach dem Speichern kommt die Seite aus der Verwaltung.</div></div>`
      : '';
    open = new Set();
    render();
    snap = state();
    setState('');
  }

  /* ---------- Anzeige ---------- */
  const arrowBtns = (kind, i, n, name) =>
    `<button type="button" class="adm-act" data-act="${kind}-up" data-i="${i}" title="Nach oben" aria-label="${esc(name)} nach oben"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>` +
    `<button type="button" class="adm-act" data-act="${kind}-down" data-i="${i}" title="Nach unten" aria-label="${esc(name)} nach unten"${i === n - 1 ? ' disabled' : ''}>${icon('down')}</button>` +
    `<button type="button" class="adm-act" data-act="${kind}-del" data-i="${i}" title="Entfernen" aria-label="${esc(name)} entfernen">${icon('trash')}</button>`;
  const rows = (s) => Math.min(16, Math.max(3, Math.ceil(String(s || '').length / 90) + String(s || '').split('\n').length));

  function blockHTML(b, j, n, sec) {
    const id = `sx-${b._uid}`;
    let body = '';
    switch (b.art) {
      case 'text':
      case 'einleitung':
        body = `<label class="visually-hidden" for="${id}">${ART_NAME[b.art]}</label>` +
          `<textarea class="adm-input" id="${id}" data-f="text" rows="${rows(b.text)}">${esc(b.text || '')}</textarea>` +
          '<p class="adm-hint">Eine leere Zeile beginnt einen neuen Absatz.</p>';
        break;
      case 'zwischentitel':
        body = `<label class="visually-hidden" for="${id}">Zwischentitel</label><input class="adm-input" type="text" id="${id}" data-f="text" value="${esc(b.text || '')}"/>`;
        break;
      case 'liste':
        body = `<label class="visually-hidden" for="${id}">Punkte der Liste</label>` +
          `<textarea class="adm-input" id="${id}" data-f="punkte" rows="${rows((b.punkte || []).join('\n'))}">${esc((b.punkte || []).join('\n'))}</textarea>` +
          '<p class="adm-hint">Ein Punkt pro Zeile.</p>';
        break;
      case 'bild': {
        const src = b._url || (b.bild ? A.imageUrl(b.bild) : '');
        body = '<div class="adm-sx-img">' +
          (src ? `<img src="${esc(src)}" alt=""/>` : '<span class="adm-muted">Noch kein Bild gewählt</span>') +
          `<label class="btn btn-outline adm-sx-pick">${icon('upload')}${src ? 'Anderes Bild' : 'Bild wählen'}<input type="file" accept="image/*" data-pick="${esc(b._uid)}" class="visually-hidden"/></label></div>` +
          '<div class="adm-grid">' +
          `<div class="adm-field full"><label class="adm-label" for="${id}-alt">Beschreibung <span class="adm-opt">für Blinde und Suchmaschinen</span></label><input class="adm-input" type="text" id="${id}-alt" data-f="alt" value="${esc(b.alt || '')}"/></div>` +
          `<div class="adm-field"><label class="adm-label" for="${id}-cap">Bildunterschrift <span class="adm-opt">optional</span></label><input class="adm-input" type="text" id="${id}-cap" data-f="unterschrift" value="${esc(b.unterschrift || '')}"/></div>` +
          `<div class="adm-field"><label class="adm-label" for="${id}-cr">Bildnachweis <span class="adm-opt">optional</span></label><input class="adm-input" type="text" id="${id}-cr" data-f="credit" value="${esc(b.credit || '')}"/></div>` +
          '</div>';
        break;
      }
      case 'karten':
        body = (b.karten || []).map((k, m) => `<div class="adm-sx-card" data-k="${m}">` +
          `<div class="adm-sx-card-head"><span class="adm-label">Karte ${m + 1}</span><button type="button" class="adm-act" data-act="card-del" data-k="${m}" title="Karte entfernen" aria-label="Karte ${m + 1} entfernen">${icon('trash')}</button></div>` +
          '<div class="adm-grid">' +
          `<div class="adm-field"><label class="adm-label" for="${id}-t${m}">Titel</label><input class="adm-input" type="text" id="${id}-t${m}" data-kf="titel" value="${esc(k.titel || '')}"/></div>` +
          `<div class="adm-field"><label class="adm-label" for="${id}-k${m}">Kurztext <span class="adm-opt">optional</span></label><input class="adm-input" type="text" id="${id}-k${m}" data-kf="kurz" value="${esc(k.kurz || '')}"/></div>` +
          `<div class="adm-field full"><label class="adm-label" for="${id}-x${m}">Text</label><textarea class="adm-input" id="${id}-x${m}" data-kf="text" rows="${rows(k.text)}">${esc(k.text || '')}</textarea></div>` +
          '</div></div>').join('') +
          `<button type="button" class="btn btn-outline" data-act="card-add">${icon('plus')}Karte hinzufügen</button>`;
        break;
      case 'fest': {
        const f = (fest.get(sec.id) || []).find((x) => x.nr === b.nr);
        body = f
          ? `<p><strong>${esc(f.name)}</strong></p><p class="adm-muted adm-sx-prev">${esc(f.vorschau)}${f.vorschau.length >= 160 ? ' …' : ''}</p>`
          : '<p class="adm-muted">Dieser Baustein ist im HTML der Seite nicht mehr vorhanden und wird nicht angezeigt.</p>';
        break;
      }
      default:
        body = '<p class="adm-muted">Unbekannter Baustein, er wird nicht angezeigt.</p>';
    }
    return `<div class="adm-sx-blk${b.art === 'fest' ? ' is-fest' : ''}" data-j="${j}">` +
      `<div class="adm-sx-blk-head"><span class="adm-sx-art">${esc(ART_NAME[b.art] || b.art)}</span><span class="adm-sx-tools">${arrowBtns('blk', j, n, ART_NAME[b.art] || 'Baustein')}</span></div>` +
      body + '</div>';
  }

  function secHTML(s, i) {
    const id = `sx-${s._uid}`;
    const bl = s.bloecke || [];
    return `<details class="adm-panel adm-sx-sec" data-i="${i}"${open.has(s._uid) ? ' open' : ''}>` +
      `<summary><span class="adm-sx-name">${esc(s.titel || 'Neuer Abschnitt')}</span>${s.gruppe ? `<span class="adm-muted"> · ${esc(s.gruppe)}</span>` : ''}` +
      `<span class="adm-sx-tools">${arrowBtns('sec', i, secs.length, s.titel || 'Abschnitt')}</span></summary>` +
      '<div class="adm-grid adm-sx-fields">' +
      `<div class="adm-field"><label class="adm-label" for="${id}-titel">Name in der Leiste <span class="adm-req">*</span></label><input class="adm-input" type="text" id="${id}-titel" data-s="titel" value="${esc(s.titel || '')}" required/></div>` +
      `<div class="adm-field"><label class="adm-label" for="${id}-gruppe">Gruppe in der Leiste <span class="adm-opt">Abschnitte mit gleicher Gruppe stehen beisammen</span></label><input class="adm-input" type="text" id="${id}-gruppe" data-s="gruppe" list="sx-groups" value="${esc(s.gruppe || '')}"/></div>` +
      `<div class="adm-field"><label class="adm-label" for="${id}-zeile">Kleine Zeile über der Überschrift <span class="adm-opt">optional</span></label><input class="adm-input" type="text" id="${id}-zeile" data-s="zeile" value="${esc(s.zeile || '')}"/></div>` +
      `<div class="adm-field"><label class="adm-label" for="${id}-ueb">Überschrift <span class="adm-opt">leer = keine</span></label><input class="adm-input" type="text" id="${id}-ueb" data-s="ueberschrift" value="${esc(s.ueberschrift || '')}"/></div>` +
      '</div>' +
      `<div class="adm-sx-blocks">${bl.map((b, j) => blockHTML(b, j, bl.length, s)).join('') || '<p class="adm-muted">Noch keine Bausteine.</p>'}</div>` +
      `<div class="adm-sx-add"><span class="adm-label">Baustein hinzufügen:</span>${ARTEN.map(([art, name]) => `<button type="button" class="btn btn-outline" data-act="blk-add" data-art="${art}">${icon('plus')}${name}</button>`).join('')}</div>` +
      '</details>';
  }

  function render() {
    $('sx-list').innerHTML = secs.map(secHTML).join('') || '<p class="adm-muted">Noch keine Abschnitte.</p>';
    $('sx-groups').innerHTML = [...new Set(secs.map((s) => clean(s.gruppe)).filter(Boolean))].map((g) => `<option value="${esc(g)}"></option>`).join('');
  }

  /* ---------- Formular -> Daten ---------- */
  function collect() {
    for (const det of document.querySelectorAll('#sx-list .adm-sx-sec')) {
      const s = secs[+det.dataset.i];
      if (!s) continue;
      if (det.open) open.add(s._uid); else open.delete(s._uid);
      for (const el of det.querySelectorAll('[data-s]')) s[el.dataset.s] = clean(el.value);
      for (const blk of det.querySelectorAll('.adm-sx-blk')) {
        const b = s.bloecke[+blk.dataset.j];
        if (!b) continue;
        for (const el of blk.querySelectorAll('[data-f]')) {
          const f = el.dataset.f;
          if (f === 'punkte') b.punkte = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
          else if (f === 'text' && el.tagName === 'TEXTAREA') b.text = el.value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
          else b[f] = clean(el.value);
        }
        if (b.art === 'karten') {
          b.karten = Array.from(blk.querySelectorAll('.adm-sx-card'), (card) => {
            const k = {};
            for (const el of card.querySelectorAll('[data-kf]')) k[el.dataset.kf] = el.dataset.kf === 'text' ? el.value.replace(/\r\n?/g, '\n').trim() : clean(el.value);
            return k;
          });
        }
      }
    }
  }
  /* Was gespeichert wird (ohne Hilfsfelder) */
  function output() {
    return secs.map((s) => ({
      id: s.id, titel: s.titel, gruppe: s.gruppe || '', zeile: s.zeile || '', ueberschrift: s.ueberschrift || '',
      bloecke: (s.bloecke || []).map((b) => {
        const o = {};
        for (const [k, v] of Object.entries(b)) if (!k.startsWith('_') && k !== 'credit' && v !== undefined) o[k] = v;
        return o;
      })
    }));
  }
  function state() {
    collect();
    return JSON.stringify([output(), secs.flatMap((s) => s.bloecke.filter((b) => b.art === 'bild').map((b) => [b._uid, b.credit || '', !!b._blob]))]);
  }
  function setState(text) {
    $('sx-state').textContent = text;
    $('sx-state').classList.toggle('is-dirty', text === 'Noch nicht gespeichert');
  }
  const markDirty = () => setState(state() !== snap ? 'Noch nicht gespeichert' : '');

  function newBlock(art) {
    const b = { art, _uid: nextUid() };
    if (art === 'text' || art === 'einleitung' || art === 'zwischentitel') b.text = '';
    if (art === 'liste') b.punkte = [];
    if (art === 'bild') Object.assign(b, { bild: '', alt: '', unterschrift: '', breite: 0, hoehe: 0, credit: '' });
    if (art === 'karten') b.karten = [{ titel: '', kurz: '', text: '' }];
    return b;
  }
  const move = (list, i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  };

  async function onClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    ev.preventDefault();
    collect();
    const det = btn.closest('.adm-sx-sec');
    const s = det && secs[+det.dataset.i];
    const blk = btn.closest('.adm-sx-blk');
    const i = +btn.dataset.i;
    switch (btn.dataset.act) {
      case 'sec-up': move(secs, i, -1); break;
      case 'sec-down': move(secs, i, 1); break;
      case 'sec-del': {
        const ok = await A.confirmBox({
          title: 'Abschnitt entfernen?',
          html: `<strong>${esc(secs[i].titel || 'Neuer Abschnitt')}</strong><br><br>Der Abschnitt verschwindet nach dem Speichern von der Seite ${esc(SEITE.name)}. Bilder bleiben im Ordner erhalten.`,
          ok: 'Entfernen', danger: true
        });
        if (!ok) return;
        secs.splice(i, 1);
        break;
      }
      case 'blk-up': move(s.bloecke, i, -1); break;
      case 'blk-down': move(s.bloecke, i, 1); break;
      case 'blk-del': s.bloecke.splice(i, 1); break;
      case 'blk-add': s.bloecke.push(newBlock(btn.dataset.art)); break;
      case 'card-add': s.bloecke[+blk.dataset.j].karten.push({ titel: '', kurz: '', text: '' }); break;
      case 'card-del': s.bloecke[+blk.dataset.j].karten.splice(+btn.dataset.k, 1); break;
      default: return;
    }
    render();
    markDirty();
  }

  async function onPick(ev) {
    const input = ev.target.closest('input[data-pick]');
    if (!input || !input.files || !input.files[0]) return;
    collect();
    const b = secs.flatMap((s) => s.bloecke).find((x) => x._uid === input.dataset.pick);
    const file = input.files[0];
    if (!b) return;
    if (!file.type.startsWith('image/')) {
      A.toast(`„${file.name}“ ist keine Bilddatei.`, 'err');
      return;
    }
    try {
      const conv = await A.toWebp(file);
      const bmp = await createImageBitmap(conv.blob);
      if (b._url) URL.revokeObjectURL(b._url);
      Object.assign(b, { _blob: conv.blob, _url: URL.createObjectURL(conv.blob), _credit0: '', breite: bmp.width, hoehe: bmp.height });
      if (bmp.close) bmp.close();
    } catch {
      return; /* Meldung hat toWebp schon gezeigt */
    }
    render();
    markDirty();
  }

  /* ---------- Speichern ---------- */
  const slug = (s) => clean(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'abschnitt';

  async function save(ev) {
    ev.preventDefault();
    collect();
    const missing = secs.findIndex((s) => !s.titel);
    if (missing >= 0) {
      open.add(secs[missing]._uid);
      render();
      const el = document.querySelector(`#sx-list .adm-sx-sec[data-i="${missing}"] [data-s="titel"]`);
      A.showErrors($('sx-form'), [[el, 'Bitte einen Namen für die Leiste eintragen.']]);
      return;
    }
    const noImg = secs.flatMap((s) => s.bloecke).find((b) => b.art === 'bild' && !b.bild && !b._blob);
    if (noImg) {
      A.toast('Ein Bild-Baustein hat noch kein Bild. Bitte ein Bild wählen oder den Baustein entfernen.', 'err');
      return;
    }
    /* Neue Abschnitte bekommen eine feste ID aus ihrem Namen */
    const ids = new Set(secs.filter((s) => s.id).map((s) => s.id));
    for (const s of secs) {
      if (s.id) continue;
      let id = `p-${slug(s.titel)}`;
      for (let n = 2; ids.has(id); n++) id = `p-${slug(s.titel)}-${n}`;
      s.id = id;
      ids.add(id);
    }
    try {
      for (const s of secs) {
        for (const b of s.bloecke) {
          if (b.art !== 'bild' || !b._blob) continue;
          const path = `${IMG_DIR}${s.id.replace(/^p-/, '')}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.webp`;
          await A.saveFile(path, b._blob);
          b.bild = path;
          delete b._blob;
        }
      }
      const direct = await A.saveJSON(PATH, { abschnitte: output() });
      /* Nur geaenderte Bildnachweise (und die neuer Bilder) */
      const credits = {};
      for (const s of secs) {
        for (const b of s.bloecke) {
          if (b.art !== 'bild' || !b.bild || clean(b.credit) === (b._credit0 || '')) continue;
          credits[b.bild] = clean(b.credit);
          b._credit0 = clean(b.credit);
        }
      }
      if (Object.keys(credits).length) await A.credits.save(credits);
      fromHtml = false;
      $('sx-note').innerHTML = '';
      render();
      snap = state();
      setState(direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.');
      A.toast(direct ? `Seite ${SEITE.name} gespeichert.` : 'Übernommen. Bitte unten die Dateien herunterladen.');
      A.log(`Seite ${SEITE.name} geändert`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    document.title = `${SEITE.name} — Verwaltung Augustinerkirche Wien`;
    $('sx-title').innerHTML = `${esc(SEITE.name)} <em>${esc(SEITE.em)}</em>`;
    $('sx-view').href = `../pages/${SEITE.file}`;
    const form = $('sx-form');
    form.addEventListener('submit', save);
    form.addEventListener('click', onClick);
    form.addEventListener('change', (ev) => {
      if (ev.target.matches('input[data-pick]')) onPick(ev);
      else markDirty();
    });
    form.addEventListener('input', (ev) => {
      const name = ev.target.matches('[data-s="titel"]') && ev.target.closest('.adm-sx-sec').querySelector('.adm-sx-name');
      if (name) name.textContent = ev.target.value || 'Neuer Abschnitt';
      markDirty();
    });
    $('sx-add').addEventListener('click', () => {
      collect();
      const s = { id: '', titel: '', gruppe: (secs[secs.length - 1] || {}).gruppe || '', zeile: '', ueberschrift: '', bloecke: [newBlock('text')], _uid: nextUid() };
      secs.push(s);
      open.add(s._uid);
      render();
      markDirty();
      const el = document.querySelector(`#sx-list .adm-sx-sec[data-i="${secs.length - 1}"] [data-s="titel"]`);
      if (el) el.focus();
    });
    A.guard(() => state() !== snap);
    A.folder.on((st) => { if (st === 'ok') load(); });
    await load();
  });
})();
