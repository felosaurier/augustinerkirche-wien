/* ============================================================
   Augustinerkirche Wien — admin-gottesdienste.js
   Gottesdienste pflegen (admin/gottesdienste.html):
   - Wochenplan aus data/gottesdienste.json: Termine anlegen,
     bearbeiten, loeschen; je Termin, ob er auch unter
     "Liturgie-Zeiten" erscheint und ob er hervorgehoben wird
   - Pfarrkanzlei und Kontakt aus data/kontakt.json (Startseite,
     Impressum): Oeffnungszeiten, Telefon, E-Mail, Adresse
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const PATH = 'data/gottesdienste.json';
  const KPATH = 'data/kontakt.json';
  const DAYS = { so: 'Sonntag', mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag' };
  const ORDER = Object.keys(DAYS);
  const byDay = (a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag) || a.zeit.localeCompare(b.zeit);
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  let termine = [];
  let editIndex = -1;
  let snap = '';
  let kontakt = {};
  let hours = null;
  let phones = null;
  let kSnap = '';

  /* ---------- Wochenplan ---------- */
  function render() {
    if (!termine.length) {
      $('gd-list').innerHTML = '<div class="adm-empty"><p class="adm-empty-title">Noch keine Termine</p>' +
        `<p>Lege den ersten Gottesdienst der Woche an.</p><button type="button" class="btn btn-gold" data-act="new">${icon('plus')}Neuer Termin</button></div>`;
      return;
    }
    $('gd-list').innerHTML = '<ul class="adm-rows">' + termine.map((t, i) =>
      `<li class="adm-row" data-key="${esc(`${t.tag}-${t.zeit}-${t.name}`)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="adm-date"><span class="adm-day">${esc(DAYS[t.tag].slice(0, 2))}</span><span class="adm-wd">${esc(DAYS[t.tag])}</span></span>` +
          '<span class="adm-row-body">' +
            `<span class="adm-row-title">${t.hervorheben ? '<span class="gd-dot"></span>' : ''}${esc(t.name)}</span>` +
            (t.hinweis ? `<span class="adm-row-meta">${esc(t.hinweis)}</span>` : '') +
            `<span class="adm-chip${t.liturgie ? '' : ' past'}">${t.liturgie ? 'Liturgie-Zeiten und Wochenüberblick' : 'Nur im Wochenüberblick'}</span>` +
          '</span>' +
          `<span class="adm-row-time">${esc(t.zeit)}</span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Löschen: ${esc(`${DAYS[t.tag]} ${t.zeit} ${t.name}`)}">${icon('trash')}Löschen</button>` +
        '</div></li>'
    ).join('') + '</ul>';
  }

  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('.adm-row-open').focus({ preventScroll: true });
  }

  async function load() {
    try {
      termine = (JSON.parse(await A.readText(PATH)).termine || []).sort(byDay);
    } catch (e) {
      $('gd-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Der Wochenplan konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function openEditor(i) {
    const t = i >= 0 ? termine[i] : null;
    editIndex = i;
    const form = $('gd-form');
    form.reset();
    A.clearErrors(form);
    $('f-tag').value = t ? t.tag : 'so';
    $('f-zeit').value = t ? t.zeit : '18:30';
    $('f-name').value = t ? t.name : 'Heilige Messe';
    $('f-hinweis').value = t ? t.hinweis : 'Augustinerkirche';
    $('f-liturgie').checked = t ? !!t.liturgie : true;
    $('f-hervorheben').checked = !!(t && t.hervorheben);
    $('gd-dlg-tag').textContent = t ? 'Termin bearbeiten' : 'Neuer Termin';
    $('gd-dlg-title').textContent = t ? `${DAYS[t.tag]}, ${t.zeit} Uhr` : 'Neuer Gottesdienst';
    $('gd-delete').hidden = !t;
    A.openDialog($('gd-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function store(next, note) {
    next.sort(byDay);
    const direct = await A.saveJSON(PATH, { termine: next });
    termine = next;
    render();
    A.toast(direct ? note : `${note} Bitte unten die Datei herunterladen.`);
    A.log(note);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('gd-form');
    const t = {
      tag: $('f-tag').value, zeit: A.HD.isoTime($('f-zeit').value), name: clean($('f-name').value),
      hinweis: clean($('f-hinweis').value), liturgie: $('f-liturgie').checked, hervorheben: $('f-hervorheben').checked
    };
    const errors = [];
    if (!t.zeit) errors.push([$('f-zeit'), 'Bitte die Uhrzeit eintragen.']);
    if (!t.name) errors.push([$('f-name'), 'Bitte eine Bezeichnung eintragen, z. B. Heilige Messe.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    const next = termine.slice();
    if (editIndex >= 0) next[editIndex] = t;
    else next.push(t);
    try {
      await store(next, `Gespeichert: ${DAYS[t.tag]}, ${t.zeit} · ${t.name}.`);
      $('gd-dlg').close();
      flash(`${t.tag}-${t.zeit}-${t.name}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  async function remove(i) {
    const t = termine[i];
    const ok = await A.confirmBox({
      title: 'Termin löschen?',
      html: `<strong>${esc(DAYS[t.tag])}, ${esc(t.zeit)} Uhr</strong> · ${esc(t.name)}<br><br>Der Termin verschwindet aus dem Wochenplan der Website.`,
      ok: 'Löschen', danger: true
    });
    if (!ok) return false;
    try {
      await store(termine.filter((x) => x !== t), `Gelöscht: ${DAYS[t.tag]}, ${t.zeit} · ${t.name}.`);
      return true;
    } catch (err) {
      A.toast(`Löschen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Pfarrkanzlei und Kontakt ---------- */
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

    $('gd-new').addEventListener('click', () => openEditor(-1));
    $('gd-form').addEventListener('submit', save);
    $('gd-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('gd-dlg').close();
    });
    $('gd-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit') openEditor(Number(b.dataset.i));
      if (b.dataset.act === 'del') remove(Number(b.dataset.i));
      if (b.dataset.act === 'new') openEditor(-1);
    });
    $('kt-form').addEventListener('submit', saveKontakt);
    $('kt-form').addEventListener('input', () => {
      $('kt-state').textContent = A.snapshot($('kt-form')) !== kSnap ? 'Noch nicht gespeichert' : '';
    });
    A.guard(() => ($('gd-dlg').open && A.snapshot($('gd-form')) !== snap) || A.snapshot($('kt-form')) !== kSnap);
    A.folder.on((state) => { if (state === 'ok') { load(); loadKontakt(); } });

    await Promise.all([load(), loadKontakt()]);
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
