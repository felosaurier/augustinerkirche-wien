/* ============================================================
   Augustinerkirche Wien — start-v2.js
   Startseite (index.html): füllt im dunklen Band die Infos "Nächstes Hochamt"
   (data/hochaemter.csv) und "Heute in der Augustinerkirche" (gemeinsame Kalenderdaten).
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
  let kalender = null;
  function kalenderDaten() {
    const KD = window.KalenderDaten;
    if (!KD || !HD) return Promise.reject(new Error('fehlt'));
    if (!kalender) kalender = KD.load('');
    return kalender;
  }
  const isoHeute = (d) => `${d.getFullYear()}-${HD.pad(d.getMonth() + 1)}-${HD.pad(d.getDate())}`;

  /* Kleines Kennzeichen, wann: Heute, Morgen, In 3 Tagen (weiter weg: keines) */
  function wann(iso, jetzt) {
    const tage = Math.round((HD.dateFromIso(iso) - HD.dateFromIso(isoHeute(jetzt))) / 86400000);
    return tage === 0 ? 'Heute' : tage === 1 ? 'Morgen' : tage > 1 && tage < 7 ? `In ${tage} Tagen` : '';
  }
  function setWhen(id, text, jetzt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle('jetzt', !!jetzt);
  }

  async function initHeute() {
    const list = document.getElementById('v3-heute-list');
    const KD = window.KalenderDaten;
    if (!list || !KD || !HD) return;
    let items;
    try {
      items = (await kalenderDaten()).filter((it) => ZEIGEN.has(it.group) && !it.cancelled);
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
    /* Jede Karte: Uhrzeit, Zustand (Jetzt, Als Nächstes, Vorbei), Art, Titel, Angaben; Hochamt mit Link zum Programm */
    const ART = { hochamt: 'Hochamt mit Chor & Orchester', gottesdienst: 'Gottesdienst', tagzeit: 'Tagzeitenliturgie', konzert: 'Konzert', veranstaltung: 'Veranstaltung' };
    const minuten = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const nun = jetzt.getHours() * 60 + jetzt.getMinutes();
    const naechstes = liste.find((it) => !(tag === heute && vorbei(it)));
    list.innerHTML = liste.map((it) => {
      const zeit = it.label || it.time || '';
      const start = minuten(it.time);
      const laeuft = tag === heute && start !== null && nun >= start && nun < start + 60;
      const weg = tag === heute && vorbei(it) && !laeuft;
      const status = laeuft ? '<span class="v3-h-st jetzt">Jetzt</span>'
        : weg ? '<span class="v3-h-st">Vorbei</span>'
        : it === naechstes ? '<span class="v3-h-st next">Als Nächstes</span>' : '';
      const art = ART[it.group] || '';
      /* Ort eigens mit Symbol (steht er schon allein in den Angaben, dort weglassen) */
      const ort = String((it.d && it.d.ort) || '').trim();
      const sub = ort && it.sub === ort ? '' : String(it.sub || '');
      const inner = `<span class="v3-h-top"><span class="v3-h-zeit">${HD.esc(zeit)}</span>${status}</span>` +
        (art && art !== it.title ? `<span class="v3-h-art">${HD.esc(art)}</span>` : '') +
        `<b class="v3-h-titel">${HD.esc(it.title)}</b>` +
        (sub ? `<small class="v3-h-sub">${HD.esc(sub)}</small>` : '') +
        (ort ? `<span class="v3-h-ort"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${HD.esc(ort)}</span>` : '') +
        (it.href && it.group === 'hochamt' ? '<span class="v3-h-mehr">Zum Programm</span>' : '');
      const cls = `v3-h-item g-${it.group}${weg ? ' vorbei' : ''}${laeuft ? ' laeuft' : ''}`;
      return `<li class="${cls}">${it.href ? `<a href="${HD.esc(it.href)}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initZeichnung();
    initHeute();
    const box = document.getElementById('v2-next-box');
    if (!box || !HD) return;
    try {
      /* Wie die Tafel auf der Kirchenmusik-Seite: ein Hochamt bleibt bis 2 Stunden nach Beginn "das nächste" */
      const jetzt = new Date();
      const beginn = (x) => {
        const hm = /^(\d{1,2})[:.](\d{2})/.exec(String(x.time || '').trim());
        return hm ? x.dateObj.getTime() + (Number(hm[1]) * 60 + Number(hm[2])) * 60000 : null;
      };
      const ende = (x) => (beginn(x) !== null ? beginn(x) + 2 * 3600000 : x.dateObj.getTime() + 86400000);
      const e = HD.splitByDate(await HD.load('data/hochaemter.csv')).upcoming.find((x) => ende(x) > jetzt.getTime());
      if (!e) return;
      const d = e.dateObj;
      box.href = `pages/hochamt.html?id=${encodeURIComponent(e.id)}`;
      document.getElementById('v2-next').textContent = e.piece || e.type || 'Hochamt';
      document.getElementById('v2-next-s').textContent = `${HD.WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${HD.MONTHS[d.getMonth()]}, ${e.time} Uhr`;
      /* Hat es schon begonnen (die Liste wechselt erst 2 Stunden nach Beginn): "Jetzt" */
      const begonnen = beginn(e) !== null && beginn(e) <= jetzt.getTime();
      setWhen('v2-next-when', begonnen ? 'Jetzt' : wann(e.date, jetzt), begonnen);
    } catch {
      /* Tabelle nicht erreichbar: der allgemeine Text bleibt stehen */
    }
  });
})();
