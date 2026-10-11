/* ============================================================
   Augustinerkirche Wien — admin-anmeldung.js
   Anmeldeseite der Verwaltung (admin/index.html).
   - Gibt es noch keinen Zugang, fuehrt die Ersteinrichtung durch:
     Projektordner verbinden, Namen und Passwort festlegen; der
     Zugang wird in admin/zugaenge.json gespeichert (ohne Ordner
     als Download mit Anleitung).
   - Sonst: Anmelden mit Benutzername und Passwort, danach weiter
     zur gewuenschten Seite (Standard: Uebersicht).
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { $, esc, icon } = A;
  const params = new URLSearchParams(location.search);

  /* Nur einfache Seiten der Verwaltung als Ziel zulassen (kein Sprung nach aussen) */
  function target() {
    const t = params.get('weiter') || '';
    return /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(t) && !t.startsWith('index.html') ? t : 'uebersicht.html';
  }

  function message(host, kind, html) {
    host.innerHTML = html
      ? `<div class="adm-alert ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${icon(kind === 'ok' ? 'checkCircle' : kind === 'info' ? 'info' : 'alert')}<div>${html}</div></div>`
      : '';
  }
  function busy(btn, on, text) {
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.innerHTML = `<span class="login-busy" aria-hidden="true"></span>${esc(text)}`;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  /* ---------- Anmelden ---------- */
  const NOTES = {
    abgemeldet: ['ok', 'Du bist abgemeldet. Bis bald!'],
    abgelaufen: ['info', 'Die Sitzung ist abgelaufen. Bitte neu anmelden.'],
    ungueltig: ['info', 'Dein Zugang wurde geändert. Bitte neu anmelden.']
  };

  let lockTimer = 0;
  function showLock(seconds) {
    const btn = $('l-submit');
    clearInterval(lockTimer);
    let left = seconds;
    const tick = () => {
      if (left <= 0) {
        clearInterval(lockTimer);
        btn.disabled = false;
        message($('login-msg'), '', '');
        return;
      }
      btn.disabled = true;
      message($('login-msg'), 'err', `Zu viele Fehlversuche. Bitte in <b>${left} Sekunden</b> erneut versuchen.`);
      left--;
    };
    tick();
    lockTimer = setInterval(tick, 1000);
  }

  function initLogin(loadError) {
    $('login-view').hidden = false;
    const form = $('login-form');
    const user = $('l-user');
    const pw = $('l-pw');
    const note = NOTES[params.get('hinweis')];
    if (loadError) message($('login-msg'), 'err', loadError);
    else if (note) message($('login-msg'), note[0], esc(note[1]));
    if (A.lockLeft()) showLock(A.lockLeft());
    user.focus();

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errors = [];
      if (!user.value.trim()) errors.push([user, 'Bitte den Benutzernamen eingeben.']);
      if (!pw.value) errors.push([pw, 'Bitte das Passwort eingeben.']);
      A.clearErrors(form);
      if (errors.length) {
        errors.forEach(([i, m]) => A.setError(i, m));
        errors[0][0].focus();
        return;
      }
      const btn = $('l-submit');
      busy(btn, true, 'Wird geprüft …');
      message($('login-msg'), '', '');
      try {
        await A.login(user.value, pw.value);
        location.replace(target());
      } catch (e) {
        busy(btn, false);
        if (e.code === 'locked') return showLock(A.lockLeft());
        if (e.code === 'wrong') {
          message($('login-msg'), 'err', 'Benutzername oder Passwort stimmt nicht. Bitte noch einmal versuchen.');
          pw.value = '';
          pw.focus();
          return;
        }
        if (e.code === 'insecure') {
          message($('login-msg'), 'err', 'Die Anmeldung braucht eine sichere Verbindung: die Seite über <code>https://</code> oder <code>http://localhost</code> öffnen.');
          return;
        }
        message($('login-msg'), 'err', 'Die Zugangsdaten konnten nicht geladen werden. Bitte die Seite über den Webserver öffnen (lokal: <code>python -m http.server 8123</code>).');
      }
    });
  }

  /* ---------- Ersteinrichtung ---------- */
  function updateStep1() {
    const step = $('setup-step1');
    const txt = $('setup-step1-txt');
    const btn = $('setup-connect');
    const state = A.folder.state;
    step.classList.toggle('done', state === 'ok');
    step.querySelector('.login-step-n').innerHTML = state === 'ok' ? icon('check') : '1';
    if (state === 'ok' && A.folder.server) {
      /* Verwaltung auf dem Webserver: dort wird gespeichert, ein Ordner ist nicht nötig */
      step.querySelector('b').textContent = 'Mit dem Server verbunden';
      txt.innerHTML = `Der Zugang wird direkt auf dem Server „${esc(A.folder.handle.name)}“ gespeichert.`;
      btn.hidden = true;
    } else if (state === 'ok') {
      txt.innerHTML = `Verbunden mit „${esc(A.folder.handle.name)}“.`;
      btn.hidden = true;
    } else if (state === 'prompt') {
      txt.innerHTML = `Der Ordner „${esc(A.folder.handle.name)}“ ist bekannt, der Browser fragt aber noch einmal nach.`;
      btn.textContent = 'Zugriff erlauben';
      btn.hidden = false;
    } else if (state === 'unsupported') {
      txt.innerHTML = 'Dieser Browser kann nicht direkt speichern. Du bekommst die Datei <code>zugaenge.json</code> zum Herunterladen und legst sie in den Ordner <code>admin/</code>.';
      btn.hidden = true;
    }
  }

  function updateMeter() {
    $('s-pw-meter').dataset.level = String(A.pwLevel($('s-pw').value));
  }

  function initSetup() {
    $('setup-view').hidden = false;
    updateStep1();
    A.folder.on(updateStep1);
    $('setup-connect').addEventListener('click', () => (A.folder.state === 'prompt' ? A.folder.allow() : A.folder.connect()));
    $('s-pw').addEventListener('input', updateMeter);
    $('s-suggest').addEventListener('click', () => {
      const pw = A.suggestPassword();
      for (const id of ['s-pw', 's-pw2']) {
        $(id).value = pw;
        $(id).type = 'text';
      }
      document.querySelectorAll('#setup-form .adm-pw-toggle').forEach((t) => {
        t.setAttribute('aria-pressed', 'true');
        t.setAttribute('aria-label', 'Passwort verbergen');
        t.innerHTML = icon('eyeOff');
      });
      updateMeter();
      A.toast('Passwort eingesetzt. Bitte notieren oder im Passwort-Manager speichern.');
    });
    /* Benutzername aus dem Namen vorschlagen, bis er selbst geaendert wird */
    $('s-name').addEventListener('input', () => {
      const u = $('s-user');
      if (u.dataset.touched) return;
      u.value = A.HD.slug(($('s-name').value.trim().split(/\s+/)[0]) || '', 30).replace(/-/g, '');
    });
    $('s-user').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
    $('setup-form').addEventListener('submit', createFirst);
    $('s-name').focus();
  }

  async function createFirst(ev) {
    ev.preventDefault();
    const form = $('setup-form');
    const name = $('s-name');
    const user = $('s-user');
    const pw = $('s-pw');
    const pw2 = $('s-pw2');
    const errors = [];
    if (!name.value.trim()) errors.push([name, 'Bitte deinen Namen eingeben.']);
    if (!/^[a-z0-9._-]{2,30}$/.test(A.normUser(user.value))) errors.push([user, 'Benutzername: 2 bis 30 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt oder Bindestrich.']);
    const pwBad = A.pwProblem(pw.value, user.value);
    if (pwBad) errors.push([pw, pwBad]);
    if (pw2.value !== pw.value) errors.push([pw2, 'Die beiden Passwörter stimmen nicht überein.']);
    if (errors.length) {
      A.showErrors(form, errors);
      return;
    }
    if (!A.cryptoReady()) {
      message($('setup-msg'), 'err', 'Dafür braucht es eine sichere Verbindung: die Seite über <code>https://</code> oder <code>http://localhost</code> öffnen.');
      return;
    }
    if (A.folder.state === 'none' || A.folder.state === 'prompt') {
      message($('setup-msg'), 'err', 'Bitte zuerst den Projektordner verbinden (Schritt 1).');
      $('setup-connect').focus();
      return;
    }

    const btn = $('s-submit');
    busy(btn, true, 'Wird angelegt …');
    try {
      /* Wer die Verwaltung einrichtet, ist der Entwickler (hoechste Rolle) */
      const acc = await A.makeAccount({ benutzer: user.value, name: name.value, passwort: pw.value, rolle: 'entwickler' });
      const json = A.accountsJSON([acc]);
      if (A.folder.state === 'ok') {
        await A.folder.write(A.ACCOUNTS, new Blob([json], { type: 'application/json' }));
        /* Liefert der Webserver die neue Datei schon aus (lokal), gleich anmelden */
        try {
          await A.login(acc.benutzer, pw.value);
          A.log(`Ersten Zugang „${acc.benutzer}“ angelegt`);
          location.replace('uebersicht.html');
          return;
        } catch {
          message($('setup-msg'), 'ok', 'Der Zugang ist in <code>admin/zugaenge.json</code> gespeichert. Sobald die Änderung veröffentlicht ist (commit und push), kannst du dich hier anmelden.');
        }
      } else {
        A.HD.download(new Blob([json], { type: 'application/json' }), 'zugaenge.json');
        message($('setup-msg'), 'ok', 'Die Datei <code>zugaenge.json</code> wurde heruntergeladen. Bitte in den Ordner <code>admin/</code> legen (vorhandene Datei ersetzen), dann diese Seite neu laden und anmelden.');
      }
      form.reset();
      updateMeter();
    } catch (e) {
      message($('setup-msg'), 'err', `Anlegen nicht möglich: ${esc(e.message)}`);
    }
    busy(btn, false);
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    if (A.session()) {
      location.replace(target());
      return;
    }
    let accounts = null;
    let loadError = '';
    try {
      accounts = A.parseAccounts(await A.fetchText(A.ACCOUNTS));
    } catch (e) {
      loadError = e.status === 404
        ? 'Die Datei <code>admin/zugaenge.json</code> fehlt.'
        : 'Die Zugangsdaten konnten nicht geladen werden. Bitte die Seite über den Webserver öffnen (lokal: <code>python -m http.server 8123</code>).';
    }
    $('login-loading').hidden = true;
    if (accounts && !accounts.length) initSetup();
    else initLogin(loadError);
  });
})();
