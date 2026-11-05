/* ============================================================
   Augustinerkirche Wien — admin-profil.js
   Mein Profil (admin/profil.html): jede angemeldete Person aendert
   ihren eigenen Namen (der Benutzername zum Anmelden bleibt) und ihr
   Passwort. Gespeichert wird in admin/zugaenge.json, nur die eigene
   Zeile aendert sich (Rolle und Rechte bleiben).
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, icon } = A;

  const meter = () => { $('pf-meter').dataset.level = String(A.pwLevel($('pf-neu').value)); };

  function showPw(on) {
    for (const id of ['pf-neu', 'pf-neu2']) $(id).type = on ? 'text' : 'password';
    const t = document.querySelector('#pf-form .adm-pw-toggle');
    t.setAttribute('aria-pressed', String(on));
    t.setAttribute('aria-label', on ? 'Passwort verbergen' : 'Passwort anzeigen');
    t.innerHTML = icon(on ? 'eyeOff' : 'eye');
  }

  async function save(ev) {
    ev.preventDefault();
    const form = $('pf-form');
    const me = A.session().benutzer;
    const errors = [];
    const alt = $('pf-alt').value;
    const neu = $('pf-neu').value;
    if (!alt) errors.push([$('pf-alt'), 'Bitte das bisherige Passwort eingeben.']);
    const bad = A.pwProblem(neu, me);
    if (bad) errors.push([$('pf-neu'), bad]);
    if ($('pf-neu2').value !== neu) errors.push([$('pf-neu2'), 'Die beiden Passwörter stimmen nicht überein.']);
    if (errors.length) return A.showErrors(form, errors);
    A.clearErrors(form);
    if (!A.cryptoReady()) return A.toast('Dafür braucht es eine sichere Verbindung (https oder localhost).', 'err');

    const btn = $('pf-save');
    btn.disabled = true;
    try {
      /* immer den frischen Stand lesen: andere Zugaenge duerfen nicht verloren gehen */
      const list = A.parseAccounts(await A.readText(A.ACCOUNTS));
      const i = list.findIndex((a) => a.benutzer === me);
      if (i < 0) throw new Error('Dein Zugang steht nicht mehr in der Liste. Bitte neu anmelden.');
      if (!(await A.checkPassword(list[i], alt))) {
        A.showErrors(form, [[$('pf-alt'), 'Das bisherige Passwort stimmt nicht.']]);
        return;
      }
      const acc = { ...(await A.makeAccount({ benutzer: me, name: list[i].name, passwort: neu, rolle: A.roleOf(list[i]), rechte: list[i].rechte })), angelegt: list[i].angelegt };
      if (list[i].rolle === undefined) delete acc.rolle;   /* alte Zugaenge ohne Rolle bleiben, wie sie sind */
      const next = list.slice();
      next[i] = acc;
      const direct = await A.saveFile(A.ACCOUNTS, A.accountsJSON(next));
      /* Sitzung auf den neuen Stand bringen, sonst gilt sie als ungueltig */
      if (direct) A.startSession(acc);
      form.reset();
      meter();
      showPw(false);
      A.log('Eigenes Passwort geändert');
      A.toast(direct ? 'Dein Passwort ist geändert.' : 'Passwort geändert. Bitte unten die Datei herunterladen.');
    } catch (e) {
      A.toast(`Speichern nicht möglich: ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* Name aendern: nur das Feld "name" der eigenen Zeile; Passwort, Rolle und Rechte bleiben */
  async function saveName(ev) {
    ev.preventDefault();
    const form = $('pf-name-form');
    const me = A.session().benutzer;
    const name = $('pf-name').value.replace(/\s+/g, ' ').trim();
    if (!name) return A.showErrors(form, [[$('pf-name'), 'Bitte deinen Namen eintragen.']]);
    if (name.length > 60) return A.showErrors(form, [[$('pf-name'), 'Der Name darf höchstens 60 Zeichen haben.']]);
    A.clearErrors(form);
    const btn = $('pf-name-save');
    btn.disabled = true;
    try {
      /* immer den frischen Stand lesen: andere Zugaenge duerfen nicht verloren gehen */
      const list = A.parseAccounts(await A.readText(A.ACCOUNTS));
      const i = list.findIndex((a) => a.benutzer === me);
      if (i < 0) throw new Error('Dein Zugang steht nicht mehr in der Liste. Bitte neu anmelden.');
      if (list[i].name === name) {
        A.toast('Der Name ist unverändert.');
        return;
      }
      const old = list[i].name;
      const next = list.slice();
      next[i] = { ...list[i], name };
      const direct = await A.saveFile(A.ACCOUNTS, A.accountsJSON(next));
      if (direct) {
        A.startSession(next[i]);
        /* Name und Kuerzel in der Seitenleiste gleich mitziehen */
        document.querySelectorAll('.adm-top .adm-user-name').forEach((el) => { el.textContent = name; });
        document.querySelectorAll('.adm-top .adm-avatar').forEach((el) => { el.textContent = A.initials(name); });
      }
      $('pf-name').value = name;
      A.log(`Eigenen Namen geändert: ${old} → ${name}`);
      A.toast(direct ? 'Dein Name ist geändert.' : 'Name geändert. Bitte unten die Datei herunterladen.');
    } catch (e) {
      A.toast(`Speichern nicht möglich: ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  A.start(() => {
    const s = A.session();
    $('pf-name').value = s.name || '';
    $('pf-user').textContent = s.benutzer;
    $('pf-name-form').addEventListener('submit', saveName);
    $('pf-neu').addEventListener('input', meter);
    document.querySelector('#pf-form .adm-pw-toggle').addEventListener('click', () => showPw($('pf-neu').type === 'password'));
    $('pf-suggest').addEventListener('click', () => {
      const pw = A.suggestPassword();
      $('pf-neu').value = pw;
      $('pf-neu2').value = pw;
      showPw(true);
      meter();
      A.toast('Passwort eingesetzt. Bitte notieren oder im Passwort-Manager speichern.');
    });
    $('pf-form').addEventListener('submit', save);

    /* Als App installieren: Android/Computer per Knopf, iPhone nur ueber "Teilen" */
    const inst = A.appInstall;
    const text = $('pf-app-text');
    const base = text.textContent;
    const showApp = () => {
      $('pf-app-install').hidden = !inst.can();
      if (inst.standalone()) text.textContent = 'Du nutzt die Verwaltung gerade als App.';
      else if (!inst.can() && /iPhone|iPad|iPod/.test(navigator.userAgent)) text.textContent = `${base} Auf dem iPhone: unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“.`;
      else if (!inst.can()) text.textContent = `${base} Am Handy: im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.`;
      else text.textContent = base;
    };
    inst.onChange(showApp);
    $('pf-app-install').addEventListener('click', () => inst.run());
    showApp();
  });
})();
