/* ============================================================
   Augustinerkirche Wien — admin-kontakt.js
   Pfarrkanzlei und Kontakt pflegen (admin/kontakt.html), Quelle ist
   data/kontakt.json (Startseite, Impressum): Oeffnungszeiten,
   Telefon, E-Mail, Adresse.
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $ } = A;
  const KPATH = 'data/kontakt.json';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  let kontakt = {};
  let hours = null;
  let phones = null;
  let kSnap = '';

  function fillKontakt() {
    hours.set((kontakt.kanzlei || []).length ? kontakt.kanzlei : [{}]);
    phones.set((kontakt.telefon || []).length ? kontakt.telefon : [{}]);
    $('kt-email').value = kontakt.email || '';
    $('kt-adresse').value = kontakt.adresse || '';
    $('kt-ort').value = kontakt.ort || '';
    $('kt-eingang').value = kontakt.eingang || '';
    kSnap = A.snapshot($('kt-form'));
    $('kt-state').textContent = '';
  }
  async function loadKontakt() {
    try {
      kontakt = JSON.parse(await A.readText(KPATH));
    } catch {
      kontakt = {};
      A.toast('Die Kontaktdaten konnten nicht geladen werden.', 'err');
    }
    fillKontakt();
  }
  async function saveKontakt(ev) {
    ev.preventDefault();
    const form = $('kt-form');
    const email = clean($('kt-email').value);
    A.clearErrors(form);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      A.showErrors(form, [[$('kt-email'), 'Diese E-Mail-Adresse sieht nicht richtig aus.']]);
      return;
    }
    const next = {
      adresse: clean($('kt-adresse').value), ort: clean($('kt-ort').value), eingang: clean($('kt-eingang').value),
      telefon: phones.values().filter((t) => t.nummer).map((t) => ({ nummer: clean(t.nummer), bezeichnung: clean(t.bezeichnung) })),
      email,
      kanzlei: hours.values().filter((h) => h.tage || h.zeit).map((h) => ({ tage: clean(h.tage), zeit: clean(h.zeit) }))
    };
    try {
      const direct = await A.saveJSON(KPATH, next);
      kontakt = next;
      fillKontakt();
      $('kt-state').textContent = direct ? 'Gespeichert.' : 'Übernommen, bitte unten herunterladen.';
      A.toast(direct ? 'Kontakt und Öffnungszeiten gespeichert.' : 'Übernommen. Bitte unten die Datei herunterladen.');
      A.log('Kontakt und Öffnungszeiten der Pfarrkanzlei geändert');
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    hours = A.listEditor($('kt-hours'), {
      fields: [
        { key: 'tage', label: 'Tage', placeholder: 'z. B. Mo, Mi, Fr' },
        { key: 'zeit', label: 'Zeit', placeholder: 'z. B. 09–12 Uhr' }
      ],
      addLabel: 'Weitere Öffnungszeit', rowLabel: 'Öffnungszeit', labelFirst: true
    });
    phones = A.listEditor($('kt-tel'), {
      fields: [
        { key: 'nummer', label: 'Telefonnummer', placeholder: '+43 (0)1 …' },
        { key: 'bezeichnung', label: 'Bezeichnung', placeholder: 'z. B. Pfarre' }
      ],
      addLabel: 'Weitere Nummer', rowLabel: 'Telefonnummer'
    });

    $('kt-form').addEventListener('submit', saveKontakt);
    $('kt-form').addEventListener('input', () => {
      $('kt-state').textContent = A.snapshot($('kt-form')) !== kSnap ? 'Noch nicht gespeichert' : '';
    });
    A.guard(() => A.snapshot($('kt-form')) !== kSnap);
    A.folder.on((state) => { if (state === 'ok') loadKontakt(); });
    await loadKontakt();
  });
})();
