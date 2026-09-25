/* ============================================================
   Augustinerkirche Wien — lightbox.js
   Vergroessert Plakate und Bilder: Link mit data-lightbox anklicken,
   dann steht nur das Bild gross vor unscharfem Hintergrund.
   Schliessen per Klick, Escape oder Schliessen-Button.
   Ohne JavaScript oeffnet der Link das Bild einfach in einem neuen Tab.
   ============================================================ */
(function () {
  'use strict';

  let box = null;
  let img = null;
  let lastTrigger = null;

  function build() {
    box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Bild vergrößert');
    box.innerHTML =
      '<button type="button" class="lb-close" aria-label="Schließen"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></button>' +
      '<img class="lb-img" alt="" decoding="async"/>';
    document.body.appendChild(box);
    img = box.querySelector('.lb-img');
    /* Ein Klick irgendwo (Bild, Hintergrund, Knopf) schliesst die Vergroesserung */
    box.addEventListener('click', close);
    box.addEventListener('close', () => {
      img.removeAttribute('src');
      /* Seite erst wieder scrollbar machen, wenn kein anderes Fenster (z. B. Meldung) mehr offen ist */
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('nd-lock');
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
  }
  function close() {
    if (box && box.open) box.close();
  }

  function open(src, alt, trigger) {
    if (!box) build();
    lastTrigger = trigger || null;
    img.alt = alt || '';
    img.src = src;
    document.documentElement.classList.add('nd-lock');
    if (!box.open) box.showModal();
  }

  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[data-lightbox]');
    if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    const pic = a.querySelector('img');
    open(a.href, (pic && pic.alt) || a.getAttribute('title') || '', a);
  });
})();
