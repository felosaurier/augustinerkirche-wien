/* ============================================================
   Augustinerkirche Wien — hoerproben.js
   Hörproben im CD-Katalog (pages/musik.html#p-cds): ein Klick auf
   einen Knopf spielt die Probe ab, ein zweiter hält sie an. Es läuft
   immer nur eine Probe; die Dateien liegen in assets/audio/cds/.
   ============================================================ */
(function () {
  'use strict';

  let audio = null;
  let current = null;

  function setState(btn, playing) {
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', String(playing));
  }

  function stop() {
    if (audio) audio.pause();
    if (current) setState(current, false);
    current = null;
  }

  function player() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('ended', stop);
    audio.addEventListener('error', () => {
      if (current) current.classList.add('failed');
      stop();
    });
    return audio;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cd-play[data-audio]');
    if (!btn) return;
    const again = btn === current;
    stop();
    if (again) return;
    const a = player();
    a.src = btn.dataset.audio;
    current = btn;
    setState(btn, true);
    a.play().catch(stop);
  });

  /* Wechsel in einen anderen Reiter: laufende Probe anhalten */
  document.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar-item')) stop();
  });
})();
