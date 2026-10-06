/* ============================================================
   Augustinerkirche Wien — admin-zugaenge.js
   Zugaenge zur Verwaltung pflegen (admin/zugaenge.html), Quelle
   ist admin/zugaenge.json. Zugang anlegen, Namen oder Passwort
   aendern, Zugang entfernen. Passwoerter werden nur als PBKDF2-
   Pruefsumme gespeichert (siehe js/admin.js).
   Benoetigt js/hochaemter-data.js und js/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;

  let accounts = [];
  let editIndex = -1;   /* -1 = neuer Zugang */
  let snap = '';

  const me = () => (A.session() || {}).benutzer;
  const ROLES = { admin: 'Admin', redaktion: 'Redaktion' };
  const role = () => (document.querySelector('input[name="rolle"]:checked') || {}).value || 'redaktion';
  const admins = (list) => list.filter((a) => A.roleOf(a) === 'admin');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  const deDate = (iso) => (HD.isoDate(iso) ? iso.split('-').reverse().join('.') : '');

  async function load() {
    try {
      accounts = A.parseAccounts(await A.readText(A.ACCOUNTS));
    } catch (e) {
      $('zg-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Zugänge konnten nicht geladen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    render();
  }

  function render() {
    const self = me();
    $('zg-list').innerHTML = `<h2 class="adm-group-title">${plural(accounts.length, 'Zugang', 'Zugänge')}</h2>` +
      '<ul class="adm-rows">' + accounts.map((a, i) =>
        `<li class="adm-row" data-key="${esc(a.benutzer)}">` +
          `<button type="button" class="adm-row-open adm-acc" data-act="edit" data-i="${i}">` +
            `<span class="adm-avatar" aria-hidden="true">${esc(initials(a.name))}</span>` +
            '<span class="adm-row-body">' +
              `<span class="adm-row-title">${esc(a.name)}${a.benutzer === self ? ' <span class="adm-badge">Du</span>' : ''}` +
                ` <span class="adm-badge${A.roleOf(a) === 'admin' ? ' on' : ''}">${ROLES[A.roleOf(a)]}</span></span>` +
              `<span class="adm-row-meta">Benutzername <code>${esc(a.benutzer)}</code>${a.angelegt ? ` · angelegt am ${esc(deDate(a.angelegt))}` : ''}</span>` +
            '</span><span></span>' +
          '</button>' +
          '<div class="adm-row-actions">' +
            `<button type="button" class="adm-act" data-act="edit" data-i="${i}" aria-label="Name oder Passwort ändern: ${esc(a.name)}">${icon('key')}Passwort ändern</button>` +
            `<button type="button" class="adm-act danger" data-act="del" data-i="${i}" aria-label="Zugang entfernen: ${esc(a.name)}">${icon('trash')}Entfernen</button>` +
          '</div></li>'
      ).join('') + '</ul>';
  }

  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.querySelector('.adm-row-open').focus({ preventScroll: true });
  }

  /* ---------- Fenster ---------- */
  function hidePasswords() {
    for (const id of ['f-pw', 'f-pw2']) $(id).type = 'password';
    const t = document.querySelector('#zg-form .adm-pw-toggle');
    t.setAttribute('aria-pressed', 'false');
    t.setAttribute('aria-label', 'Passwort anzeigen');
    t.innerHTML = icon('eye');
  }
  const updateMeter = () => { $('f-pw-meter').dataset.level = String(A.pwLevel($('f-pw').value)); };

  function openEditor(i) {
    const acc = i >= 0 ? accounts[i] : null;
    editIndex = i;
    const form = $('zg-form');
    form.reset();
    A.clearErrors(form);
    hidePasswords();
    $('f-name').value = acc ? acc.name : '';
    $('f-user').value = acc ? acc.benutzer : '';
    document.querySelector(`input[name="rolle"][value="${acc ? A.roleOf(acc) : 'redaktion'}"]`).checked = true;
    /* Der letzte Admin kann nicht zur Redaktion werden */
    const lastAdmin = acc && A.roleOf(acc) === 'admin' && admins(accounts).length === 1;
    document.querySelector('input[name="rolle"][value="redaktion"]').disabled = lastAdmin;
    $('zg-role-hint').textContent = lastAdmin ? 'Das ist der einzige Admin. Lege zuerst einen weiteren Admin an, bevor du diese Rolle änderst.' : '';
    $('f-user').readOnly = !!acc;
    delete $('f-user').dataset.touched;
    $('f-user-req').hidden = !!acc;
    $('f-user-hint').innerHTML = acc ? 'Der Benutzername bleibt gleich.' : 'Kleinbuchstaben, ohne Leerzeichen, z. B. <code>maria</code>.';
    $('zg-pw-legend').textContent = acc ? 'Neues Passwort' : 'Passwort';
    $('f-pw-label').textContent = acc ? 'Neues Passwort' : 'Passwort';
    $('f-pw-hint').textContent = acc ? 'Leer lassen, um das bisherige Passwort zu behalten. Sonst mindestens 10 Zeichen.' : 'Mindestens 10 Zeichen.';
    updateMeter();
    $('zg-dlg-tag').textContent = acc ? (acc.benutzer === me() ? 'Dein Zugang' : 'Zugang bearbeiten') : 'Neuer Zugang';
    $('zg-dlg-title').textContent = acc ? acc.name : 'Zugang anlegen';
    $('zg-delete').hidden = !acc;
    A.openDialog($('zg-dlg'), { isDirty: () => A.snapshot(form) !== snap });
    snap = A.snapshot(form);
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('zg-form');
    const old = editIndex >= 0 ? accounts[editIndex] : null;
    const name = $('f-name').value.replace(/\s+/g, ' ').trim();
    const user = A.normUser($('f-user').value);
    const pw = $('f-pw').value;
    const errors = [];
    if (!name) errors.push([$('f-name'), 'Bitte den Namen eintragen.']);
    if (!old) {
      if (!/^[a-z0-9._-]{2,30}$/.test(user)) errors.push([$('f-user'), 'Benutzername: 2 bis 30 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt oder Bindestrich.']);
      else if (accounts.some((a) => a.benutzer === user)) errors.push([$('f-user'), `Den Benutzernamen „${user}“ gibt es schon.`]);
    }
    if (!old || pw) {
      if (pw.length < A.MIN_PW) errors.push([$('f-pw'), `Das Passwort braucht mindestens ${A.MIN_PW} Zeichen.`]);
      else if (pw.toLowerCase() === (old ? old.benutzer : user)) errors.push([$('f-pw'), 'Das Passwort darf nicht der Benutzername sein.']);
      if ($('f-pw2').value !== pw) errors.push([$('f-pw2'), 'Die beiden Passwörter stimmen nicht überein.']);
    }
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    if (!A.cryptoReady()) {
      A.toast('Dafür braucht es eine sichere Verbindung (https oder localhost).', 'err');
      return;
    }

    const btn = $('zg-save');
    btn.disabled = true;
    try {
      const next = accounts.slice();
      let acc;
      if (!old) {
        acc = await A.makeAccount({ benutzer: user, name, passwort: pw, rolle: role() });
        next.push(acc);
      } else {
        acc = pw
          ? { ...(await A.makeAccount({ benutzer: old.benutzer, name, passwort: pw, rolle: role() })), angelegt: old.angelegt }
          : { ...old, name, rolle: role() };
        next[editIndex] = acc;
      }
      const direct = await A.saveFile(A.ACCOUNTS, A.accountsJSON(next));
      accounts = next;
      /* Eigener Zugang: Sitzung auf den neuen Stand bringen, sonst gilt sie als ungueltig */
      if (acc.benutzer === me() && direct) {
        A.startSession(acc);
        const nameEl = document.querySelector('.adm-user-name');
        if (nameEl) nameEl.textContent = acc.name;
        const avatar = document.querySelector('.adm-top .adm-avatar');
        if (avatar) avatar.textContent = initials(acc.name);
      }
      $('zg-dlg').close();
      render();
      flash(acc.benutzer);
      const what = !old ? `Zugang „${acc.benutzer}“ angelegt (${ROLES[A.roleOf(acc)]})` : pw ? `Passwort für „${acc.benutzer}“ geändert` : `Zugang „${acc.benutzer}“ geändert`;
      /* Eigene Rolle zur Redaktion geaendert: Zugaenge sind dann nicht mehr erlaubt */
      if (acc.benutzer === me() && direct && A.roleOf(acc) !== 'admin') setTimeout(() => location.replace('uebersicht.html'), 1500);
      A.toast(direct ? `${what}.` : `${what}. Bitte unten die Datei herunterladen.`);
      A.log(what);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function remove(i) {
    const acc = accounts[i];
    if (accounts.length === 1) {
      A.toast('Der letzte Zugang kann nicht entfernt werden, sonst könnte sich niemand mehr anmelden.', 'err');
      return false;
    }
    if (A.roleOf(acc) === 'admin' && admins(accounts).length === 1) {
      A.toast('Das ist der einzige Admin. Lege zuerst einen weiteren Admin an.', 'err');
      return false;
    }
    const self = acc.benutzer === me();
    const ok = await A.confirmBox({
      title: 'Zugang entfernen?',
      html: `<strong>${esc(acc.name)}</strong> (<code>${esc(acc.benutzer)}</code>) kann sich danach nicht mehr anmelden.` +
        (self ? '<br><br><strong>Das ist dein eigener Zugang.</strong> Du wirst danach abgemeldet.' : ''),
      ok: 'Entfernen', danger: true
    });
    if (!ok) return false;
    try {
      const next = accounts.filter((a) => a !== acc);
      const direct = await A.saveFile(A.ACCOUNTS, A.accountsJSON(next));
      accounts = next;
      render();
      A.toast(direct ? `Zugang „${acc.benutzer}“ entfernt.` : 'Entfernt. Bitte unten die Datei herunterladen.');
      A.log(`Zugang „${acc.benutzer}“ entfernt`);
      if (self && direct) setTimeout(() => A.logout('abgemeldet'), 1500);
      return true;
    } catch (err) {
      A.toast(`Entfernen nicht möglich: ${err.message}`, 'err');
      return false;
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('zg-new').addEventListener('click', () => openEditor(-1));
    $('zg-form').addEventListener('submit', save);
    $('f-pw').addEventListener('input', updateMeter);
    $('zg-suggest').addEventListener('click', () => {
      const pw = A.suggestPassword();
      for (const id of ['f-pw', 'f-pw2']) {
        $(id).value = pw;
        $(id).type = 'text';
        A.setError($(id), '');
      }
      const t = document.querySelector('#zg-form .adm-pw-toggle');
      t.setAttribute('aria-pressed', 'true');
      t.setAttribute('aria-label', 'Passwort verbergen');
      t.innerHTML = icon('eyeOff');
      updateMeter();
      A.toast('Passwort eingesetzt. Bitte der Person sicher weitergeben.');
    });
    /* Benutzername aus dem Vornamen vorschlagen, bis er selbst geaendert wird */
    $('f-name').addEventListener('input', () => {
      const u = $('f-user');
      if (u.readOnly || u.dataset.touched) return;
      u.value = HD.slug($('f-name').value.trim().split(/\s+/)[0] || '', 30).replace(/-/g, '');
    });
    $('f-user').addEventListener('input', (ev) => { ev.target.dataset.touched = '1'; });
    $('zg-delete').addEventListener('click', async () => {
      if (editIndex >= 0 && await remove(editIndex)) $('zg-dlg').close();
    });
    $('zg-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(i);
      if (b.dataset.act === 'del') remove(i);
    });
    A.guard(() => $('zg-dlg').open && A.snapshot($('zg-form')) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });

    await load();
    if (new URLSearchParams(location.search).has('neu')) {
      openEditor(-1);
      history.replaceState(null, '', location.pathname);
    }
  });
})();
