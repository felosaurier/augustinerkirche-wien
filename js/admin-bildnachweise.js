/* ============================================================
   Augustinerkirche Wien — admin-bildnachweise.js
   Bildnachweise pflegen (admin/bildnachweise.html), Quelle ist
   data/bildnachweise.json: {bilder: {pfad: nachweis}}.
   Sucht alle Bilder der Website (Seiten, Titelfotos und die
   Datendateien von Personen, Solisten, Runden und Neuigkeiten)
   und zeigt sie mit Fundort und einem Feld für den Nachweis.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;

  const PAGES = [
    ['index.html', 'Startseite'], ['pages/pfarre.html', 'Pfarre'], ['pages/gottesdienste.html', 'Gottesdienste'],
    ['pages/sakramente.html', 'Sakramente'], ['pages/musik.html', 'Kirchenmusik'], ['pages/chronik.html', 'Chronik'],
    ['pages/aspersdorf.html', 'Aspersdorf'], ['pages/kalender.html', 'Kalender'], ['pages/archiv.html', 'Archiv']
  ];
  /* Logo und Symbole brauchen keinen Nachweis */
  const SKIP = /(^|\/)(logo[^/]*|favicon[^/]*|apple-touch-icon[^/]*|icon-[^/]*)\.(png|webp|svg|ico)$|^assets\/app\//;

  let images = [];        /* {path, uses: [..], credit} */
  let saved = {};         /* Stand der Datei */
  const edits = new Map();  /* pfad -> neuer Text */
  let filter = 'alle';
  let query = '';

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const creditOf = (p) => (edits.has(p) ? edits.get(p) : saved[p] || '');

  /* Adresse relativ zu einer Seite -> Pfad ab der Website-Wurzel */
  function rootPath(src, page) {
    if (!src || /^(data:|blob:|https?:)/i.test(src)) return '';
    try {
      return decodeURIComponent(new URL(src, `https://x/${page}`).pathname.slice(1));
    } catch {
      return '';
    }
  }

  async function collect() {
    const found = new Map();
    const add = (path, use) => {
      if (!path || SKIP.test(path)) return;
      if (!found.has(path)) found.set(path, new Set());
      found.get(path).add(use);
    };
    const read = async (path) => {
      try {
        return await A.readText(path);
      } catch {
        return '';
      }
    };

    /* Runden-Seiten aus der Liste der Runden */
    let runden = [];
    try {
      runden = JSON.parse(await read('data/runden.json')).runden || [];
    } catch { /* ohne Runden weiter */ }
    const pages = PAGES.concat(runden.filter((r) => r.seite).map((r) => [r.seite, `Runde: ${r.titel}`]));

    const parser = new DOMParser();
    await Promise.all(pages.map(async ([page, label]) => {
      const html = await read(page);
      if (!html) return;
      const doc = parser.parseFromString(html, 'text/html');
      for (const img of doc.querySelectorAll('img[src]')) add(rootPath(img.getAttribute('src'), page), label);
      for (const el of doc.querySelectorAll('[style*="url("]')) {
        const m = el.getAttribute('style').match(/url\(['"]?([^'")]+)/);
        if (m) add(rootPath(m[1], page), `${label} (Titelfoto)`);
      }
    }));

    /* Datendateien */
    for (const r of runden) if (r.bild && r.bild.pfad) add(r.bild.pfad, `Runde: ${r.titel}`);
    try {
      const walk = (o) => {
        if (Array.isArray(o)) o.forEach(walk);
        else if (o && typeof o === 'object') {
          if (typeof o.bild === 'string' && o.bild) add(o.bild, `Personen: ${o.name || ''}`.trim());
          Object.values(o).forEach(walk);
        }
      };
      walk(JSON.parse(await read('data/personen.json')));
    } catch { /* ohne Personen weiter */ }
    try {
      for (const s of JSON.parse(await read('data/solisten.json'))) if (s.image) add(s.image, `Solisten: ${s.name}`);
    } catch { /* ohne Solisten weiter */ }
    try {
      for (const e of A.parseNews(await read('data/news.csv'))) {
        const p = e.Plakat || e.Vorschaubild;
        if (p) add(p, `Neuigkeiten: ${e.Titel}`);
      }
    } catch { /* ohne Neuigkeiten weiter */ }

    /* Nachweise zu Bildern, die nirgends mehr vorkommen, nicht verlieren */
    for (const p of Object.keys(saved)) if (!found.has(p)) found.set(p, new Set(['derzeit nicht auf der Website']));

    return [...found].map(([path, uses]) => ({ path, uses: [...uses].sort() }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /* ---------- Liste ---------- */
  function rowHTML(im) {
    const src = A.imageUrl(im.path);
    const val = creditOf(im.path);
    const id = `bn-${HDslug(im.path)}`;
    return `<li class="adm-row adm-bn${edits.has(im.path) ? ' changed' : ''}" data-path="${esc(im.path)}">` +
      `<span class="adm-thumb photo"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"/></span>` +
      '<div class="adm-bn-body">' +
        `<label class="adm-bn-file" for="${id}">${esc(im.path.split('/').pop())}</label>` +
        `<span class="adm-row-people" title="${esc(im.uses.join(', '))}">${esc(im.uses.join(', '))}</span>` +
        `<input class="adm-input" type="text" id="${id}" data-path="${esc(im.path)}" value="${esc(val)}" placeholder="Bildnachweis, z. B. © Augustiner Wien, Foto: Max Muster" autocomplete="off"/>` +
      '</div></li>';
  }
  const HDslug = (p) => A.HD.slug(p, 80) || 'bild';

  function visible() {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return images.filter((im) => {
      const c = creditOf(im.path);
      if (filter === 'ohne' && c) return false;
      if (filter === 'mit' && !c) return false;
      return words.every((w) => `${im.path} ${im.uses.join(' ')} ${c}`.toLowerCase().includes(w));
    });
  }

  function counts() {
    const mit = images.filter((im) => creditOf(im.path)).length;
    $('bn-n-alle').textContent = images.length;
    $('bn-n-mit').textContent = mit;
    $('bn-n-ohne').textContent = images.length - mit;
    $('bn-save').disabled = !edits.size;
    $('bn-save').lastChild.textContent = edits.size ? `${plural(edits.size, 'Änderung', 'Änderungen')} speichern` : 'Speichern';
  }

  function render() {
    const list = visible();
    counts();
    $('bn-count').textContent = `${plural(list.length, 'Bild', 'Bilder')}${query.trim() ? ` · Suche „${query.trim()}“` : ''}`;
    $('bn-list').innerHTML = list.length
      ? `<ul class="adm-rows">${list.map(rowHTML).join('')}</ul>`
      : `<div class="adm-empty"><p class="adm-empty-title">${filter === 'ohne' && !query.trim() ? 'Alle Bilder haben einen Nachweis' : 'Keine Bilder gefunden'}</p></div>`;
  }

  async function load() {
    try {
      saved = { ...(await A.credits.load(true)) };
      images = await collect();
    } catch (e) {
      $('bn-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Bilder konnten nicht gesammelt werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  async function save() {
    if (!edits.size) return;
    const btn = $('bn-save');
    btn.disabled = true;
    try {
      const n = edits.size;
      const direct = await A.credits.save(Object.fromEntries(edits));
      saved = { ...(await A.credits.load()) };
      edits.clear();
      render();
      A.toast(direct === null ? 'Keine Änderungen.' : direct ? `Gespeichert: ${plural(n, 'Bildnachweis', 'Bildnachweise')}.` : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log(`Bildnachweise geändert (${n})`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
      counts();
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('bn-save').addEventListener('click', save);
    $('bn-list').addEventListener('input', (ev) => {
      const inp = ev.target.closest('input[data-path]');
      if (!inp) return;
      const path = inp.dataset.path;
      const v = clean(inp.value);
      if (v === (saved[path] || '')) edits.delete(path);
      else edits.set(path, v);
      inp.closest('.adm-row').classList.toggle('changed', edits.has(path));
      counts();
    });
    /* Enter im Feld speichert */
    $('bn-list').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.matches('input[data-path]')) {
        ev.preventDefault();
        save();
      }
    });
    $('bn-filter').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-filter]');
      if (!b) return;
      filter = b.dataset.filter;
      for (const x of document.querySelectorAll('#bn-filter [data-filter]')) {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
      render();
    });
    let timer = 0;
    $('bn-search').addEventListener('input', (ev) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = ev.target.value;
        render();
      }, 150);
    });
    A.guard(() => edits.size > 0);
    A.folder.on((state) => { if (state === 'ok' && !edits.size) load(); });
    await load();
  });
})();
