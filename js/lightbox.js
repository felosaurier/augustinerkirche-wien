/* ============================================================
   Augustinerkirche Wien — lightbox.js
   Vergroessert Plakate und Bilder: Link mit data-lightbox anklicken,
   dann steht nur das Bild gross vor unscharfem Hintergrund.
   Schliessen per Klick, Escape oder Schliessen-Button.
   ============================================================ */
(function(){
  'use strict';

  var box = null, img = null, lastTrigger = null;

  function build(){
    box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label','Bild vergrößert');
    box.innerHTML =
      '<button type="button" class="lb-close" aria-label="Schließen"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></button>'+
      '<img class="lb-img" alt="" decoding="async"/>';
    document.body.appendChild(box);
    img = box.querySelector('.lb-img');
    box.addEventListener('click',close);
    box.addEventListener('close',function(){
      img.removeAttribute('src');
      if(!document.querySelector('dialog[open]'))document.documentElement.classList.remove('nd-lock');
      if(lastTrigger&&document.contains(lastTrigger))lastTrigger.focus();
    });
  }
  function close(){if(box&&box.open)box.close()}

  function open(src,alt,trigger){
    if(!box)build();
    lastTrigger = trigger||null;
    img.alt = alt||'';
    img.src = src;
    document.documentElement.classList.add('nd-lock');
    if(!box.open)box.showModal();
  }

  document.addEventListener('click',function(ev){
    var a = ev.target.closest('a[data-lightbox]');
    if(!a)return;
    if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button===1)return;
    ev.preventDefault();
    var pic = a.querySelector('img');
    open(a.getAttribute('href'),(pic&&pic.alt)||a.getAttribute('title')||'',a);
  });
})();
