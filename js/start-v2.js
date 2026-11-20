/* ============================================================
   Augustinerkirche Wien — start-v2.js
   Alternative Startseite (index-v2.html): füllt im dunklen Band die
   Kachel "Nächstes Hochamt" aus data/hochaemter.csv.
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;

  /* Unten: die Strichzeichnung der Kirche zeichnet sich ein, sobald der Bereich ins Bild kommt */
  function initZeichnung() {
    const end = document.querySelector('.v3-end');
    if (!end || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    end.classList.add('zeichnen');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      end.classList.add('gezeichnet');
      io.disconnect();
    }, { threshold: 0.25 });
    io.observe(end);
  }

  /* "Heute in der Augustinerkirche": die Gottesdienste (und Konzerte, Veranstaltungen) des Tages aus den
     gemeinsamen Kalenderdaten (js/kalender-daten.js: Wochenkalender, Gottesdienstplan, Hochämter, Ausfälle).
     Ist heute nichts mehr, steht der nächste Tag mit Terminen da. */
  const ZEIGEN = new Set(['hochamt', 'gottesdienst', 'tagzeit', 'konzert', 'veranstaltung']);
  async function initHeute() {
    const list = document.getElementById('v3-heute-list');
    const KD = window.KalenderDaten;
    if (!list || !KD || !HD) return;
    let items;
    try {
      items = (await KD.load('')).filter((it) => ZEIGEN.has(it.group) && !it.cancelled);
    } catch {
      return;
    }
    const jetzt = new Date();
    const heute = KD.isoOf(jetzt);
    const uhr = `${HD.pad(jetzt.getHours())}:${HD.pad(jetzt.getMinutes())}`;
    const vorbei = (it) => !!it.time && it.time <= uhr;
    let tag = heute;
    let liste = items.filter((it) => it.date === heute);
    if (!liste.length || liste.every(vorbei)) {
      const naechst = items.find((it) => it.date > heute);
      if (!naechst) return;
      tag = naechst.date;
      liste = items.filter((it) => it.date === tag);
    }
    const dt = HD.dateFromIso(tag);
    const morgen = KD.isoOf(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1));
    document.getElementById('v3-heute-wann').textContent =
      tag === heute ? 'Heute' : tag === morgen ? 'Morgen' : `Am ${HD.WEEKDAYS[dt.getDay()]}`;
    document.getElementById('v3-heute-date').textContent = `${HD.WEEKDAYS[dt.getDay()]}, ${dt.getDate()}. ${HD.MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
    list.innerHTML = liste.map((it) => {
      const zeit = it.label || it.time || '';
      const inner = `<span class="v3-h-zeit">${HD.esc(zeit)}</span>` +
        `<span class="v3-h-was"><b>${HD.esc(it.title)}</b>${it.sub ? `<small>${HD.esc(it.sub)}</small>` : ''}</span>`;
      const cls = `v3-h-item g-${it.group}${tag === heute && vorbei(it) ? ' vorbei' : ''}`;
      return `<li class="${cls}">${it.href ? `<a href="${HD.esc(it.href)}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initZeichnung();
    initHeute();
    const box = document.getElementById('v2-next-box');
    if (!box || !HD) return;
    try {
      const e = HD.splitByDate(await HD.load('data/hochaemter.csv')).upcoming[0];
      if (!e) return;
      const d = e.dateObj;
      box.href = `pages/hochamt.html?id=${encodeURIComponent(e.id)}`;
      document.getElementById('v2-next').textContent = e.piece || e.type || 'Hochamt';
      document.getElementById('v2-next-s').textContent = `${HD.WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HD.MONTHS[d.getMonth()]}, ${e.time} Uhr`;
    } catch {
      /* Tabelle nicht erreichbar: der allgemeine Text bleibt stehen */
    }
  });
})();
