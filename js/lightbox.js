/* ============================================================
   Augustinerkirche Wien — lightbox.js
   Vergroessert Plakate und Bilder: Link mit data-lightbox oder ein Foto
   im Inhalt anklicken, dann steht nur das Bild gross vor unscharfem Hintergrund.
   Schliessen per Klick, Escape oder Schliessen-Button.
   Galerie: Links mit demselben data-gallery (z. B. die Fotos eines Berichts)
   lassen sich durchblaettern (Pfeile, Pfeiltasten, Wischen am Handy); darunter
   stehen Zaehler, Bildunterschrift (data-caption) und Bildnachweis, ganz unten
   eine Leiste mit allen Fotos der Galerie zum Antippen.
   Ohne JavaScript oeffnet der Link das Bild einfach in einem neuen Tab.
   ============================================================ */
(function () {
  'use strict';

  let box = null;
  let img = null;
  let cap = null;
  let strip = null;
  let lastTrigger = null;
  let gallery = [];   /* Links der aktuellen Galerie */
  let index = 0;

  const ARROW = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function build() {
    box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Bild vergrößert');
    box.innerHTML =
      '<button type="button" class="lb-close" aria-label="Schließen"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></button>' +
      `<button type="button" class="lb-nav lb-prev" aria-label="Voriges Foto" hidden>${ARROW('M15 5l-7 7 7 7')}</button>` +
      '<figure class="lb-fig"><img class="lb-img" alt="" decoding="async"/><figcaption class="lb-cap" aria-live="polite"></figcaption></figure>' +
      `<button type="button" class="lb-nav lb-next" aria-label="Nächstes Foto" hidden>${ARROW('M9 5l7 7-7 7')}</button>` +
      '<div class="lb-strip" role="group" aria-label="Alle Fotos" hidden></div>';
    document.body.appendChild(box);
    img = box.querySelector('.lb-img');
    cap = box.querySelector('.lb-cap');
    strip = box.querySelector('.lb-strip');
    /* Ein Klick irgendwo (Bild, Hintergrund, Knopf) schliesst die Vergroesserung, ausser auf Pfeile und Leiste */
    box.addEventListener('click', (ev) => {
      const nav = ev.target.closest('.lb-nav');
      if (nav) {
        step(nav.classList.contains('lb-prev') ? -1 : 1);
        return;
      }
      const thumb = ev.target.closest('.lb-thumb');
      if (thumb) {
        go(Number(thumb.dataset.i));
        return;
      }
      if (ev.target.closest('.lb-cap,.lb-strip')) return;
      close();
    });
    box.addEventListener('keydown', (ev) => {
      if (gallery.length < 2) return;
      if (ev.key === 'ArrowLeft') step(-1);
      else if (ev.key === 'ArrowRight') step(1);
      else return;
      ev.preventDefault();
    });
    /* Wischen am Handy: nach links naechstes, nach rechts voriges Foto */
    let x0 = null;
    box.addEventListener('pointerdown', (ev) => { x0 = ev.pointerType === 'mouse' || ev.target.closest('.lb-strip') ? null : ev.clientX; });
    box.addEventListener('pointerup', (ev) => {
      if (x0 === null || gallery.length < 2) return;
      const dx = ev.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) {
        step(dx < 0 ? 1 : -1);
        box.dataset.swiped = '1';
      }
    });
    /* Nach dem Wischen kein Klick hinterher, der die Vergroesserung schliesst */
    box.addEventListener('click', (ev) => {
      if (box.dataset.swiped) {
        delete box.dataset.swiped;
        ev.stopImmediatePropagation();
      }
    }, true);
    box.addEventListener('close', () => {
      img.removeAttribute('src');
      gallery = [];
      /* Seite erst wieder scrollbar machen, wenn kein anderes Fenster (z. B. Meldung) mehr offen ist */
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('nd-lock');
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
  }
  function close() {
    if (box && box.open) box.close();
  }

  /* Bild der Galerie zeigen (bzw. das einzelne Bild) samt Zaehler und Unterschrift */
  function show(src, alt, caption) {
    img.alt = alt || '';
    img.src = src;
    const many = gallery.length > 1;
    box.querySelector('.lb-prev').hidden = !many;
    box.querySelector('.lb-next').hidden = !many;
    const credit = window.AugCredit ? window.AugCredit(src) : '';
    const parts = [many ? `${index + 1} / ${gallery.length}` : '', caption || '', credit || ''].filter(Boolean);
    cap.textContent = parts.join(' · ');
    cap.hidden = !parts.length;
    /* Leiste: aktuelles Foto markieren und sichtbar halten */
    for (const t of strip.querySelectorAll('.lb-thumb')) {
      const on = Number(t.dataset.i) === index;
      t.classList.toggle('on', on);
      if (on) {
        t.setAttribute('aria-current', 'true');
        t.scrollIntoView({ block: 'nearest', inline: 'center' });
      } else {
        t.removeAttribute('aria-current');
      }
    }
  }
  /* Leiste mit allen Fotos der Galerie (nur bei mehr als einem Foto) */
  function buildStrip() {
    const many = gallery.length > 1;
    box.classList.toggle('lb-has-strip', many);
    strip.hidden = !many;
    strip.replaceChildren(...(many ? gallery.map((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lb-thumb';
      b.dataset.i = String(i);
      b.setAttribute('aria-label', `Foto ${i + 1} von ${gallery.length}`);
      const t = document.createElement('img');
      t.src = a.href;
      t.alt = '';
      t.loading = 'lazy';
      t.decoding = 'async';
      b.append(t);
      return b;
    }) : []));
  }
  function go(i) {
    if (!gallery.length) return;
    index = (i + gallery.length) % gallery.length;
    const a = gallery[index];
    const pic = a.querySelector('img');
    show(a.href, (pic && pic.alt) || '', a.dataset.caption || '');
  }
  function step(dir) {
    if (gallery.length < 2) return;
    go(index + dir);
  }

  function open(src, alt, trigger, caption) {
    if (!box) build();
    lastTrigger = trigger || null;
    buildStrip();
    show(src, alt, caption);
    document.documentElement.classList.add('nd-lock');
    if (!box.open) box.showModal();
  }

  /* Fotos im Inhalt (nicht in Menue, Fusszeile, Links und Knoepfen) lassen sich
     ebenfalls anklicken und vergroessern */
  function zoomable(img) {
    if (!img || img.closest('a,button,label,summary,nav,footer,.lightbox,[data-no-zoom]')) return false;
    if (!img.closest('main,dialog')) return false;
    return img.clientWidth >= 48 && img.clientHeight >= 48;
  }

  document.addEventListener('click', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const a = ev.target.closest('a[data-lightbox]');
    if (a) {
      ev.preventDefault();
      const pic = a.querySelector('img');
      const name = a.dataset.gallery;
      const scope = a.closest('dialog,main') || document;
      gallery = name ? [...scope.querySelectorAll('a[data-lightbox][data-gallery]')].filter((x) => x.dataset.gallery === name) : [];
      index = Math.max(0, gallery.indexOf(a));
      open(a.href, (pic && pic.alt) || a.getAttribute('title') || '', a, a.dataset.caption || '');
      return;
    }
    const img = ev.target.closest('img');
    if (zoomable(img)) {
      gallery = [];
      open(img.currentSrc || img.src, img.alt, img);
    }
  });
})();
