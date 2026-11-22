/* ============================================================
   Augustinerkirche Wien — start-v2.js
   Startseite (index.html): füllt im dunklen Band die Infos "Nächstes Hochamt"
   (data/hochaemter.csv) und "Heute in der Augustinerkirche" (gemeinsame Kalenderdaten).
   Die Bilder unter "Entdecken" lassen sich in der Verwaltung tauschen (data/entdecken.json).
   ============================================================ */
(function () {
  'use strict';

  const HD = window.HochamtData;
  /* Uebersetzung (js/thema.js); deutsche Seiten: der Text bleibt */
  const T = window.AugT || ((s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));

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
    return tage === 0 ? T('Heute') : tage === 1 ? T('Morgen') : tage > 1 && tage < 7 ? T('In {n} Tagen', { n: tage }) : '';
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
    /* Am Zeilenanfang gross (italienische Wochentage sind klein) */
    const gross = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById('v3-heute-wann').textContent =
      gross(tag === heute ? T('Heute') : tag === morgen ? T('Morgen') : T('Am {tag}', { tag: HD.WEEKDAYS[dt.getDay()] }));
    document.getElementById('v3-heute-date').textContent = gross(HD.fmtLang(dt, true));
    /* Tagesbezeichnung und Heilige des Tages (Wochenkalender bzw. Heiligenkalender) */
    const inf = KD.infoAm ? KD.infoAm(tag) : null;
    /* Übersetzte Seiten: Tagesbezeichnung und Feste, die im Wörterbuch stehen; übrige Heilige stehen nur deutsch im Kalender */
    const de = (T.lang || 'de') === 'de';
    const zeile = inf ? (de ? [inf.tag, ...inf.heilige] : [inf.tag && (T.tag ? T.tag(inf.tag) : inf.tag), ...inf.heilige.filter((h) => T(h) !== h).map((h) => T(h))]).filter(Boolean).join(' · ') : '';
    let hl = document.getElementById('v3-heute-heilige');
    if (zeile) {
      if (!hl) {
        hl = document.createElement('p');
        hl.id = 'v3-heute-heilige';
        hl.className = 'v3-heute-heilige';
        document.getElementById('v3-heute-date').after(hl);
      }
      hl.textContent = zeile;
    } else if (hl) hl.remove();
    /* Jede Karte: Uhrzeit, Zustand (Jetzt, Als Nächstes, Vorbei), Art, Titel, Angaben; Hochamt mit Link zum Programm */
    const ART = { hochamt: T('Hochamt mit Chor & Orchester'), gottesdienst: T('Gottesdienst'), tagzeit: T('Tagzeitenliturgie'), konzert: T('Konzert'), veranstaltung: T('Veranstaltung') };
    const minuten = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const nun = jetzt.getHours() * 60 + jetzt.getMinutes();
    const naechstes = liste.find((it) => !(tag === heute && vorbei(it)));
    list.innerHTML = liste.map((it) => {
      const zeit = HD.uhr(it.label || it.time || '');
      const start = minuten(it.time);
      const laeuft = tag === heute && start !== null && nun >= start && nun < start + 60;
      const weg = tag === heute && vorbei(it) && !laeuft;
      const status = laeuft ? `<span class="v3-h-st jetzt">${T('Jetzt')}</span>`
        : weg ? `<span class="v3-h-st">${T('Vorbei')}</span>`
        : it === naechstes ? `<span class="v3-h-st next">${T('Als Nächstes')}</span>` : '';
      const art = ART[it.group] || '';
      /* Ort eigens mit Symbol (steht er schon allein in den Angaben, dort weglassen) */
      const ort = String((it.d && it.d.ort) || '').trim();
      const sub = ort && it.sub === ort ? '' : (KD.subText ? KD.subText(String(it.sub || '').split(' · ').filter((x) => !ort || x !== ort).join(' · ')).join(' · ') : T(String(it.sub || '')));
      const inner = `<span class="v3-h-top"><span class="v3-h-zeit">${HD.esc(zeit)}</span>${status}</span>` +
        (art && art !== it.title ? `<span class="v3-h-art">${HD.esc(art)}</span>` : '') +
        `<b class="v3-h-titel">${HD.esc(T(it.title))}</b>` +
        (sub ? `<small class="v3-h-sub">${HD.esc(sub)}</small>` : '') +
        (ort ? `<span class="v3-h-ort"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${HD.esc(T(ort))}</span>` : '') +
        (it.href && it.group === 'hochamt' ? `<span class="v3-h-mehr">${T('Zum Programm')}</span>` : '');
      const cls = `v3-h-item g-${it.group}${weg ? ' vorbei' : ''}${laeuft ? ' laeuft' : ''}`;
      return `<li class="${cls}">${it.href ? `<a href="${HD.esc(it.href)}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
    }).join('');
  }

  /* "Entdecken": eigene Bilder aus data/entdecken.json {bilder: {<Schluessel>: {bild, ausschnitt}}},
     Schluessel wie data-entdecken an den Karten. Fehlt ein Eintrag (oder die Datei), bleibt das Bild aus index.html. */
  /* Ziel einer Karte: Seite dieser Website oder https-Adresse; sonst kein Link */
  const ZIEL = /^((index|pages\/[a-z0-9\-/]+)\.html([#?][\w\-=&%.]*)?|https?:\/\/[^\s"<>]+)$/i;
  const BILD = /^assets\/img\/[^?#]+\.(webp|jpe?g|png)$/i;
  function karten(data) {
    const box = document.querySelector('.v3-ways');
    if (!box) return;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ziel = (s) => (ZIEL.test(String(s || '').trim()) ? String(s).trim() : '');
    const extra = (href) => (/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '');
    const html = data.karten.map((k) => {
      const titel = String(k.titel || '').trim();
      const href = ziel(k.link);
      if (!titel || !href) return '';
      const bild = typeof k.bild === 'string' && BILD.test(k.bild) ? k.bild : '';
      const src = bild && (window.AugBild ? window.AugBild.vorschau(bild) : bild);
      const pos = /^\d{1,3}% \d{1,3}%$/.test(k.ausschnitt || '') ? ` style="object-position:${k.ausschnitt}"` : '';
      const unten = (Array.isArray(k.links) ? k.links : [])
        .map((l) => ({ text: String((l && l.text) || '').trim(), href: ziel(l && l.link) })).filter((l) => l.text && l.href);
      return '<article class="v3-way">' +
        (src ? `<a class="v3-way-img" href="${esc(href)}"${extra(href)} tabindex="-1" aria-hidden="true"><img src="${esc(encodeURI(src))}" alt="" loading="lazy" decoding="async"${pos}/></a>` : '') +
        `<h3><a href="${esc(href)}"${extra(href)}>${esc(titel)}</a></h3>` +
        (unten.length ? `<ul>${unten.map((l) => `<li><a href="${esc(l.href)}"${extra(l.href)}>${esc(l.text)}</a></li>`).join('')}</ul>` : '') +
        '</article>';
    }).join('');
    if (html) box.innerHTML = html;
    const lead = document.querySelector('#v3-ways-h')?.closest('.v3-head')?.querySelector('.v3-lead');
    if (lead && typeof data.einleitung === 'string' && data.einleitung.trim()) lead.textContent = data.einleitung.trim();
  }

  async function initEntdecken() {
    let data = null;
    try {
      const res = await fetch('data/entdecken.json', { cache: 'no-cache' });
      if (res.ok) data = await res.json();
    } catch { /* ohne Datei die Standardbilder */ }
    const bilder = data && data.bilder && typeof data.bilder === 'object' ? data.bilder : {};
    if (window.AugBild) await window.AugBild.ready;
    /* Eigene Auswahl aus der Verwaltung (nur deutsche Startseite): Karten, Reihenfolge, Texte, Links */
    if ((T.lang || 'de') === 'de' && data && Array.isArray(data.karten) && data.karten.length) {
      karten(data);
      return;
    }
    for (const card of document.querySelectorAll('[data-entdecken]')) {
      const b = bilder[card.dataset.entdecken];
      const img = card.querySelector('.v3-way-img img');
      if (!img || !b || typeof b.bild !== 'string' || !/^assets\/img\/[^?#]+\.(webp|jpe?g|png)$/i.test(b.bild)) continue;
      img.src = encodeURI(window.AugBild ? window.AugBild.vorschau(b.bild) : b.bild);   /* kleine Karte: immer die kleine Fassung */
      img.style.objectPosition = /^\d{1,3}% \d{1,3}%$/.test(b.ausschnitt || '') ? b.ausschnitt : '';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initZeichnung();
    initHeute();
    initEntdecken();
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
      box.href = `${T.seite ? T.seite('pages/hochamt.html') : 'pages/hochamt.html'}?id=${encodeURIComponent(e.id)}`;
      document.getElementById('v2-next').textContent = e.piece || T(e.type || 'Hochamt');
      const satz = `${HD.fmtLang(d, false)}, ${HD.fmtUhr(e.time)}`;
      document.getElementById('v2-next-s').textContent = satz.charAt(0).toUpperCase() + satz.slice(1);
      /* Hat es schon begonnen (die Liste wechselt erst 2 Stunden nach Beginn): "Jetzt" */
      const begonnen = beginn(e) !== null && beginn(e) <= jetzt.getTime();
      setWhen('v2-next-when', begonnen ? T('Jetzt') : wann(e.date, jetzt), begonnen);
    } catch {
      /* Tabelle nicht erreichbar: der allgemeine Text bleibt stehen */
    }
  });
})();
