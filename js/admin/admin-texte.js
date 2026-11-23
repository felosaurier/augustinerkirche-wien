/* ============================================================
   Augustinerkirche Wien — admin-texte.js
   Texte der Seiten pflegen (admin/texte.html?bereich=kirche|aspersdorf).
   Im HTML der Seite traegt jeder aenderbare Abschnitt
     <div data-text="Schluessel" data-text-titel="Name in der Verwaltung">…</div>
   Die Verwaltung liest die Seite, zeigt die Abschnitte als Liste und
   oeffnet einen davon in einem Editor, der aussieht wie die Website
   (contenteditable mit den Stilen der Seite). Gespeichert wird nur, was
   vom HTML abweicht, in data/texte.json:
     {texte: {"<Schluessel>": {html, geaendert}}}
   js/inhalte.js (texte) setzt den Text auf der Website ein; beide filtern
   das HTML mit HochamtData.cleanHTML. E-Mail-Adressen stehen wie ueberall
   verschluesselt (data-mail), im Editor normal lesbar.
   Rechte: "texte" (Augustinerkirche) bzw. "asp-texte" (Aspersdorf).
   Benoetigt js/hochaemter-data.js und js/admin/admin.js.
   ============================================================ */
(function () {
  'use strict';

  const A = window.Admin;
  const { HD, $, esc, icon } = A;
  const PATH = 'data/texte.json';
  const BEREICHE = {
    kirche: { name: 'Augustinerkirche', seite: 'pages/augustinerkirche.html' },
    aspersdorf: { name: 'Aspersdorf', seite: 'pages/aspersdorf.html' }
  };
  const query = new URLSearchParams(location.search).get('bereich');
  const B = BEREICHE[query] || BEREICHE.kirche;

  /* Bausteine, die "Doppeln", "Nach oben/unten" und "Entfernen" an der Schreibmarke greifen
     (der innerste zuerst): Listenpunkt, Tabellenzeile, Zeile der Zeitleiste, Kontaktzeile, Karte … */
  const PARTS = 'li, tr, .timeline-item, .kontakt-row, dl > div, .fact, .card, .person-card-wide, .pgr-item, figure, .sakr-facts, .kontakt-card, p, h3, h4';

  let blocks = [];        /* {key, titel, html, anchor, shell} aus dem HTML der Seite */
  let texte = {};         /* gespeicherte Texte (data/texte.json) */
  let current = null;     /* Abschnitt im Editor */
  let orig = '';          /* Text aus dem HTML, so normalisiert wie serialize() */
  let snap = '';
  let picked = null;      /* angeklicktes Foto (laesst sich nicht mit der Schreibmarke greifen) */
  let linkRange = null;   /* Auswahl beim Oeffnen der Link-Zeile */
  let linkKind = 'link';

  const edit = () => $('tx-edit');

  /* ---------- E-Mail-Adressen: im Editor lesbar, gespeichert verschluesselt ---------- */
  const mailCode = (addr) => [...String(addr)].reverse().join('').replace('@', '|');
  const mailText = (addr) => String(addr).replace('@', '(at)').replace(/\./g, '(dot)');
  function showMails(root) {
    for (const a of root.querySelectorAll('a.mail[data-mail]')) {
      const addr = [...a.dataset.mail.replace('|', '@')].reverse().join('');
      a.setAttribute('href', `mailto:${addr}`);
      if (a.textContent.includes('(at)')) a.textContent = addr;
      a.removeAttribute('data-mail');
    }
  }
  function hideMails(root) {
    for (const a of root.querySelectorAll('a[href^="mailto:"]')) {
      const addr = decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]).trim();
      a.removeAttribute('href');
      a.classList.add('mail');
      a.setAttribute('data-mail', mailCode(addr));
      if (a.textContent.trim() === addr) a.textContent = mailText(addr);
    }
  }

  /* Neue Absaetze und Zwischentitel bekommen die Klasse ihrer Nachbarn (sonst saehen sie anders aus) */
  function tidy(root) {
    const firstP = root.querySelector('p[class]');
    for (const p of root.querySelectorAll('p:not([class])')) {
      let prev = p.previousElementSibling;
      while (prev && prev.tagName !== 'P') prev = prev.previousElementSibling;
      const cls = (prev && prev.className) || (firstP && firstP.className) || 'bio-p';
      p.className = cls;
    }
    for (const h of root.querySelectorAll('h3:not([class])')) {
      const other = root.querySelector('h3[class]');
      h.className = other ? other.className : 'pane-sub';
    }
    /* Leere Inline-Reste aus dem Editor */
    for (const el of root.querySelectorAll('span:not([class]), font')) el.replaceWith(...el.childNodes);
  }

  function serializeFrom(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('.tx-picked').forEach((el) => el.classList.remove('tx-picked'));
    copy.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    copy.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
    hideMails(copy);
    tidy(copy);
    return HD.cleanHTML(copy.innerHTML).trim();
  }
  /* Ein Text aus Datei oder HTML, so wie ihn der Editor speichern wuerde */
  function canon(html) {
    const div = document.createElement('div');
    div.innerHTML = HD.cleanHTML(html);
    showMails(div);
    return serializeFrom(div);
  }

  /* ---------- Laden ---------- */
  async function load() {
    let doc;
    try {
      doc = new DOMParser().parseFromString(await A.readText(B.seite), 'text/html');
    } catch (e) {
      $('tx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Seite <code>${esc(B.seite)}</code> konnte nicht gelesen werden (${esc(e.message)}).</div></div>`;
      return;
    }
    blocks = Array.from(doc.querySelectorAll('[data-text]')).map((el) => {
      const shell = [];
      for (let n = el.parentElement; n && n.tagName !== 'BODY'; n = n.parentElement) {
        shell.unshift({ cls: n.className || '', sakr: !!(n.previousElementSibling && n.parentElement.querySelector(':scope > .sakr-register')) && n.classList.contains('sakr-sec') });
        if (n.classList.contains('tab-pane')) break;
      }
      const pane = el.closest('.tab-pane');
      const sec = el.closest('.sakr-sec');
      return {
        key: el.dataset.text,
        titel: el.dataset.textTitel || el.dataset.text,
        html: el.innerHTML,
        anchor: (sec && sec.id) || (pane && pane.id) || '',
        shell
      };
    });
    texte = {};
    try {
      const d = await A.readJSON(PATH);
      if (d && d.texte && typeof d.texte === 'object') texte = d.texte;
    } catch (e) {
      if (!(e && (e.status === 404 || e.name === 'NotFoundError'))) {
        $('tx-list').innerHTML = `<div class="adm-alert">${icon('alert')}<div>Die Datei <code>${PATH}</code> konnte nicht geladen werden (${esc(e.message)}).</div></div>`;
        return;
      }
    }
    render();
  }

  const changed = (b) => !!(texte[b.key] && typeof texte[b.key].html === 'string' && texte[b.key].html.trim());

  function render() {
    const n = blocks.filter(changed).length;
    $('tx-count').textContent = `${blocks.length === 1 ? '1 Abschnitt' : `${blocks.length} Abschnitte`} · ${n ? `${n} geändert` : 'alle wie ursprünglich'}`;
    if (!blocks.length) {
      $('tx-list').innerHTML = '<div class="adm-empty"><p class="adm-empty-title">Auf dieser Seite gibt es keine änderbaren Texte.</p></div>';
      return;
    }
    $('tx-list').innerHTML = '<ul class="adm-rows">' + blocks.map((b, i) => {
      const t = texte[b.key];
      const meta = changed(b) ? `Geändert${t.geaendert ? ` am ${A.fmtDate ? A.fmtDate(t.geaendert) : t.geaendert}` : ''}` : 'Ursprünglicher Text';
      const plain = (changed(b) ? t.html : b.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
      const excerpt = new DOMParser().parseFromString(plain.slice(0, 160), 'text/html').body.textContent;
      return `<li class="adm-row${changed(b) ? ' tx-changed' : ''}" data-key="${esc(b.key)}">` +
        `<button type="button" class="adm-row-open" data-act="edit" data-i="${i}">` +
          `<span class="adm-row-body"><span class="adm-row-title">${esc(b.titel)}</span>` +
          `<span class="adm-row-meta">${esc(meta)}${excerpt ? ` · ${esc(excerpt)}…` : ''}</span></span>` +
        '</button>' +
        '<div class="adm-row-actions">' +
          `<a class="adm-act" href="../${esc(B.seite)}${b.anchor ? `#${esc(b.anchor)}` : ''}" target="_blank" rel="noopener" aria-label="Auf der Website ansehen: ${esc(b.titel)}">${icon('eye')}Ansehen</a>` +
          (changed(b) ? `<button type="button" class="adm-act" data-act="reset" data-i="${i}" aria-label="Ursprünglichen Text wiederherstellen: ${esc(b.titel)}">${icon('refresh')}Ursprünglich</button>` : '') +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function flash(key) {
    const row = document.querySelector(`.adm-row[data-key="${CSS.escape(key)}"]`);
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- Editor ---------- */
  function buildPaper(b) {
    const paper = $('tx-paper');
    paper.replaceChildren();
    let host = paper;
    for (const s of b.shell) {
      if (s.sakr) {
        const reg = document.createElement('div');
        reg.className = 'sakr-register';
        reg.hidden = true;
        host.append(reg);
      }
      const div = document.createElement('div');
      div.className = s.cls;
      if (div.classList.contains('tab-pane')) div.classList.add('active');
      host.append(div);
      host = div;
    }
    const ed = document.createElement('div');
    ed.id = 'tx-edit';
    ed.className = 'tx-edit';
    ed.contentEditable = 'true';
    ed.spellcheck = true;
    ed.setAttribute('role', 'textbox');
    ed.setAttribute('aria-multiline', 'true');
    ed.setAttribute('aria-label', `Text: ${b.titel}`);
    ed.lang = 'de';
    host.append(ed);
    return ed;
  }

  function openEditor(i) {
    current = blocks[i];
    const t = texte[current.key];
    const ed = buildPaper(current);
    ed.innerHTML = HD.cleanHTML(changed(current) ? t.html : current.html);
    showMails(ed);
    ed.querySelectorAll('figure').forEach((f) => { f.contentEditable = 'false'; });
    orig = canon(current.html);
    picked = null;
    closeLinkbar();
    $('tx-dlg-title').textContent = current.titel;
    $('tx-dlg-tag').textContent = `${B.name} · Text bearbeiten`;
    $('tx-reset').hidden = !changed(current);
    A.openDialog($('tx-dlg'), { isDirty: () => !!current && serializeFrom(edit()) !== snap });
    snap = serializeFrom(ed);
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.execCommand('styleWithCSS', false, false);
    } catch { /* aeltere Browser */ }
  }

  /* Schreibmarke im Editor? */
  function selInEditor() {
    const sel = window.getSelection();
    return sel && sel.rangeCount && edit().contains(sel.getRangeAt(0).commonAncestorContainer) ? sel : null;
  }
  function partAtCaret() {
    if (picked && edit().contains(picked)) return picked;
    const sel = selInEditor();
    if (!sel) return null;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    const part = node && node.closest(PARTS);
    return part && part !== edit() && edit().contains(part) ? part : null;
  }
  function pick(el) {
    edit().querySelectorAll('.tx-picked').forEach((x) => x.classList.remove('tx-picked'));
    picked = el;
    if (el) el.classList.add('tx-picked');
  }
  function caretInto(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function partTool(kind) {
    const part = partAtCaret();
    if (!part) {
      A.toast('Bitte zuerst in die Zeile, den Listenpunkt oder die Karte klicken (oder ein Foto anklicken).');
      return;
    }
    const label = part.matches('figure') ? 'das Foto' : part.matches('li') ? 'den Listenpunkt' : part.matches('tr') ? 'die Tabellenzeile' : 'den Baustein';
    if (kind === 'dup') {
      const copy = part.cloneNode(true);
      copy.classList.remove('tx-picked');
      part.after(copy);
      pick(null);
      if (!copy.matches('figure')) caretInto(copy);
    } else if (kind === 'up' || kind === 'down') {
      const other = kind === 'up' ? part.previousElementSibling : part.nextElementSibling;
      if (!other) return;
      if (kind === 'up') other.before(part);
      else other.after(part);
      part.scrollIntoView({ block: 'nearest' });
    } else if (kind === 'del') {
      const next = part.nextElementSibling || part.previousElementSibling;
      part.remove();
      pick(null);
      if (next && !next.matches('figure')) caretInto(next);
      A.toast(`Entfernt: ${label}. Mit ↶ lässt es sich bis zum Speichern zurückholen.`);
    }
    edit().dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* Doppeln, Verschieben, Entfernen und Links gehen am Rueckgaengig des Browsers vorbei:
     dafuer ein eigener Schritt, solange danach nicht getippt wurde */
  const steps = [];
  let ownStep = false;
  function remember() {
    steps.push(edit().innerHTML);
    if (steps.length > 40) steps.shift();
    ownStep = true;
  }

  function command(cmd) {
    if (cmd === 'undo' && ownStep && steps.length) {
      edit().innerHTML = steps.pop();
      ownStep = steps.length > 0;
      pick(null);
      return;
    }
    edit().focus();
    document.execCommand(cmd, false, null);
    if (cmd === 'insertUnorderedList') tidy(edit());
  }

  function block(tag) {
    edit().focus();
    document.execCommand('formatBlock', false, `<${tag}>`);
    tidy(edit());
  }

  /* ---------- Links ---------- */
  const LINK = {
    link: ['Adresse des Links', 'https://… oder eine Seite der Website, z. B. kalender.html#woche', (v) => /^https?:\/\/\S+$/i.test(v) || /^[\w./-]+\.html(#[\w-]+)?$/.test(v) || /^#[\w-]+$/.test(v), (v) => v],
    mail: ['E-Mail-Adresse', 'z. B. pfarre@augustinerkirche.at', (v) => /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(v), (v) => `mailto:${v}`],
    tel: ['Telefonnummer', 'z. B. +43 1 533 70 99', (v) => /^\+?[\d(][\d\s()/.-]{4,}$/.test(v), (v) => HD.telHref(v)]
  };
  function openLinkbar(kind) {
    const sel = selInEditor();
    if (!sel) {
      A.toast('Bitte zuerst in den Text klicken oder ein Wort markieren.');
      return;
    }
    linkRange = sel.getRangeAt(0).cloneRange();
    linkKind = kind;
    const [label, hint, isOk] = LINK[kind];
    const chosen = sel.toString().trim();
    $('tx-href-label').textContent = label;
    $('tx-href-hint').textContent = hint;
    $('tx-href').value = chosen && isOk(chosen) ? chosen : '';
    $('tx-linkbar').hidden = false;
    $('tx-href').focus();
  }
  function closeLinkbar() {
    $('tx-linkbar').hidden = true;
    linkRange = null;
  }
  function applyLink() {
    const v = $('tx-href').value.trim();
    const [, , isOk, toHref] = LINK[linkKind];
    if (!isOk(v)) {
      A.toast(`Bitte ${LINK[linkKind][0] === 'Adresse des Links' ? 'eine gültige Adresse' : `eine gültige ${LINK[linkKind][0]}`} eintragen.`, 'err');
      $('tx-href').focus();
      return;
    }
    const href = toHref(v);
    const range = linkRange;
    closeLinkbar();
    edit().focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (range) sel.addRange(range);
    remember();
    if (!range || range.collapsed) {
      const a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = v;
      (range || document.createRange()).insertNode(a);
    } else {
      document.execCommand('createLink', false, href);
    }
    /* Links nach aussen in einem neuen Fenster */
    if (/^https?:/i.test(href)) {
      for (const a of edit().querySelectorAll('a[href]')) {
        if (a.getAttribute('href') === href) a.setAttribute('target', '_blank');
      }
    }
    edit().dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- Speichern ---------- */
  async function persist(next) {
    const direct = await A.saveFile(PATH, JSON.stringify({ texte: next }, null, 2) + '\n');
    texte = next;
    return direct;
  }

  async function save() {
    if (!current) return;
    const html = serializeFrom(edit());
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
    if (!plain && !/<img/i.test(html)) {
      A.toast('Der Abschnitt ist leer. Zum Zurücksetzen bitte „Ursprünglicher Text“ wählen.', 'err');
      return;
    }
    const next = { ...texte };
    if (html === orig) delete next[current.key];
    else next[current.key] = { html, geaendert: A.isoToday() };
    const btn = $('tx-save');
    btn.disabled = true;
    try {
      const direct = await persist(next);
      snap = html;
      const key = current.key;
      $('tx-dlg').close();
      render();
      flash(key);
      A.toast(direct ? `Gespeichert: ${current.titel}.` : `${current.titel} übernommen. Bitte unten die Datei herunterladen.`);
      A.log(`Text der Seite geändert: ${B.name} · ${current.titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function reset(b) {
    const ok = await A.confirmBox({
      title: 'Ursprünglichen Text wiederherstellen?',
      html: `<strong>${esc(b.titel)}</strong><br><br>Ihre Änderungen an diesem Abschnitt werden verworfen; auf der Website steht wieder der ursprüngliche Text.`,
      ok: 'Wiederherstellen', danger: true
    });
    if (!ok) return;
    const next = { ...texte };
    delete next[b.key];
    try {
      const direct = await persist(next);
      if ($('tx-dlg').open) {
        snap = serializeFrom(edit());
        $('tx-dlg').close();
      }
      render();
      flash(b.key);
      A.toast(direct ? `Wiederhergestellt: ${b.titel}.` : 'Wiederhergestellt. Bitte unten die Datei herunterladen.');
      A.log(`Text der Seite zurückgesetzt: ${B.name} · ${b.titel}`);
    } catch (err) {
      A.toast(`Speichern nicht möglich: ${err.message}`, 'err');
    }
  }

  /* ---------- Start ---------- */
  A.start(async () => {
    $('tx-bereich').textContent = B.name;
    document.title = `Texte der Seiten: ${B.name} — Verwaltung Augustinerkirche Wien`;
    $('tx-view').href = `../${B.seite}`;

    const tools = document.querySelector('.tx-tools');
    /* Knoepfe nehmen den Fokus nicht: die Auswahl im Text bleibt */
    tools.addEventListener('mousedown', (ev) => { if (ev.target.closest('button')) ev.preventDefault(); });
    tools.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || !current) return;
      if (b.dataset.cmd) command(b.dataset.cmd);
      else if (b.dataset.block) block(b.dataset.block);
      else if (b.dataset.link) openLinkbar(b.dataset.link);
      else if (b.dataset.part) { remember(); partTool(b.dataset.part); }
    });
    $('tx-href-ok').addEventListener('click', applyLink);
    $('tx-href-no').addEventListener('click', () => { closeLinkbar(); edit().focus(); });
    $('tx-href').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); applyLink(); }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeLinkbar(); edit().focus(); }
    });

    const paper = $('tx-paper');
    /* Eingefuegt wird nur Text, ohne Schriften und Farben aus Word oder Webseiten */
    paper.addEventListener('paste', (ev) => {
      if (!edit().contains(ev.target)) return;
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    paper.addEventListener('drop', (ev) => { if (edit().contains(ev.target)) ev.preventDefault(); });
    /* Fotos lassen sich anklicken (dann greifen Doppeln, Schieben, Entfernen); Links nicht oeffnen */
    paper.addEventListener('click', (ev) => {
      if (!edit() || !edit().contains(ev.target)) return;
      const fig = ev.target.closest('figure, img');
      if (ev.target.closest('a')) ev.preventDefault();
      pick(fig ? (fig.closest('figure') || fig) : null);
    });
    paper.addEventListener('input', () => tidy(edit()));
    /* Getippt oder vom Browser formatiert: ab jetzt gilt wieder sein eigenes Rueckgaengig */
    paper.addEventListener('beforeinput', (ev) => { if (ev.inputType !== 'historyUndo') ownStep = false; });
    paper.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        save();
      }
    });
    $('tx-save').addEventListener('click', save);
    $('tx-reset').addEventListener('click', () => { if (current) reset(current); });
    $('tx-dlg').addEventListener('close', () => { steps.length = 0; ownStep = false; pick(null); });

    $('tx-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === 'edit') openEditor(i);
      else if (b.dataset.act === 'reset') reset(blocks[i]);
    });
    A.guard(() => $('tx-dlg').open && !!current && serializeFrom(edit()) !== snap);
    A.folder.on((state) => { if (state === 'ok') load(); });
    await load();
  });
})();
