/* ============================================================
   Augustinerkirche Wien — news-verwaltung.js
   Interne Seite zum Anlegen, Bearbeiten und Loeschen von Neuigkeiten
   (data/news.csv) samt Plakat/Bild.
   - Chrome/Edge: Projektordner einmal verbinden, dann werden Tabelle
     und Bild direkt an die richtige Stelle gespeichert.
   - Sonst: Tabelle und Bild werden zum Herunterladen angeboten.
   Benoetigt js/hochaemter-data.js (CSV-Parser).
   ============================================================ */
(function(){
  'use strict';

  var HD = window.HochamtData;
  var HEAD = ['Datum','Kategorie','Titel','Kurztext','Infos','Details','Vorschaubild','Plakat','Link','Linktext'];
  var LATEST = 6;

  var entries = [];      // Objekte mit den Schluesseln aus HEAD (Text)
  var root = null;       // Ordner-Handle (Projektordner)
  var editIndex = -1;    // -1 = neue Meldung
  var image = null;      // {blob,ext,url,converted}
  var dirty = false;     // Aenderungen noch nicht gespeichert (ohne Ordner)

  function $(id){return document.getElementById(id)}
  function esc(s){return HD.esc(s)}
  function status(msg,kind){
    var el = $('nv-status');
    el.textContent = msg;
    el.className = 'nv-status' + (kind?' '+kind:'');
  }

  /* ---------- Hilfen ---------- */
  function slug(s){
    return String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'bild';
  }
  function clean(s){return String(s||'').replace(/\|/g,'/').replace(/;/g,',').trim()}
  function isoToDe(iso){var p=iso.split('-');return p[2]+'.'+p[1]+'.'+p[0]}
  function deToIso(de){return HD.isoDate(de)}
  function todayIso(){var d=new Date();return d.getFullYear()+'-'+HD.pad(d.getMonth()+1)+'-'+HD.pad(d.getDate())}

  /* ---------- CSV lesen/schreiben ---------- */
  function parseEntries(text){
    var rows = HD.parseCSV(text);
    if(!rows.length)return [];
    var idx = HEAD.map(function(h){
      var i = -1;
      rows[0].forEach(function(c,k){if(String(c).trim().toLowerCase()===h.toLowerCase())i=k});
      return i;
    });
    return rows.slice(1).map(function(r){
      var o = {};
      HEAD.forEach(function(h,k){o[h] = idx[k]>=0?(r[idx[k]]||'').trim():''});
      return o;
    }).filter(function(o){return o.Titel&&deToIso(o.Datum)});
  }
  function toCSV(list){
    function q(v){
      v = String(v==null?'':v);
      return /[;"\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
    }
    var lines = [HEAD.join(';')];
    list.forEach(function(o){lines.push(HEAD.map(function(h){return q(o[h])}).join(';'))});
    return '﻿'+lines.join('\r\n')+'\r\n';
  }
  function sortEntries(){
    entries = entries.map(function(e,i){return {e:e,i:i}});
    entries.sort(function(a,b){
      return deToIso(b.e.Datum).localeCompare(deToIso(a.e.Datum))||a.i-b.i;
    });
    entries = entries.map(function(x){return x.e});
  }

  /* ---------- Ordner (File System Access API) ---------- */
  async function getFile(dir,parts,create){
    var d = dir;
    for(var i=0;i<parts.length-1;i++)d = await d.getDirectoryHandle(parts[i],{create:!!create});
    return d.getFileHandle(parts[parts.length-1],{create:!!create});
  }
  async function writeFile(parts,data){
    var fh = await getFile(root,parts,true);
    var w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }
  async function fileExists(parts){
    try{await getFile(root,parts,false);return true}catch(e){return false}
  }
  async function connect(){
    try{
      var dir = await window.showDirectoryPicker({mode:'readwrite'});
      var fh;
      try{fh = await getFile(dir,['data','news.csv'],false)}
      catch(e){status('Das ist nicht der Projektordner. Bitte den Ordner wählen, in dem index.html liegt.','err');return}
      var text = await (await fh.getFile()).text();
      root = dir;
      entries = parseEntries(text);
      sortEntries();
      dirty = false;
      renderTable();
      updateModeUI();
      status('Projektordner verbunden. '+entries.length+' Meldungen geladen. Neue Meldungen werden jetzt direkt gespeichert.','ok');
    }catch(e){
      if(e&&e.name!=='AbortError')status('Verbindung nicht möglich: '+e.message,'err');
    }
  }
  function updateModeUI(){
    var supported = !!window.showDirectoryPicker;
    $('nv-connect').hidden = !supported || !!root;
    $('nv-connected').hidden = !root;
    $('nv-fallback-note').hidden = supported;
    $('nv-downloads').hidden = !!root || !dirty;
    $('nv-save').textContent = root?(editIndex>=0?'Änderung speichern':'Meldung speichern'):(editIndex>=0?'Änderung übernehmen':'Meldung übernehmen');
  }

  /* ---------- Formular ---------- */
  function addInfoRow(label,value){
    var row = document.createElement('div');
    row.className = 'nv-info-row';
    row.innerHTML =
      '<input type="text" class="nv-info-label" list="nv-labels" placeholder="Bezeichnung" value="'+esc(label||'')+'"/>'+
      '<input type="text" class="nv-info-value" placeholder="Wert, z. B. Sonntag, 20. September 2026, 11:00 Uhr" value="'+esc(value||'')+'"/>'+
      '<button type="button" class="nv-mini" aria-label="Zeile entfernen">&times;</button>';
    row.querySelector('button').addEventListener('click',function(){row.parentNode.removeChild(row)});
    $('nv-infos').appendChild(row);
  }
  function readInfos(){
    return Array.prototype.map.call($('nv-infos').querySelectorAll('.nv-info-row'),function(r){
      var l = clean(r.querySelector('.nv-info-label').value), v = clean(r.querySelector('.nv-info-value').value);
      return v?(l?l+': '+v:v):'';
    }).filter(Boolean).join(' | ');
  }
  function readDetails(){
    return $('f-details').value.split(/\n+/).map(clean).filter(Boolean).join(' | ');
  }

  function resetForm(){
    $('nv-form').reset();
    $('f-date').value = todayIso();
    $('nv-infos').innerHTML = '';
    addInfoRow('Termin','');
    addInfoRow('Ort','');
    editIndex = -1;
    clearImage();
    $('nv-formtitle').textContent = 'Neue Meldung';
    $('nv-cancel').hidden = true;
    updateModeUI();
  }
  function clearImage(){
    if(image&&image.url)URL.revokeObjectURL(image.url);
    image = null;
    $('f-file').value = '';
    $('nv-preview').innerHTML = '<span class="nv-noimg">Noch kein Bild gewählt</span>';
    $('f-filename').value = '';
    $('nv-imginfo').textContent = '';
  }

  async function onFile(){
    var f = $('f-file').files[0];
    if(!f)return;
    if(!/^image\//.test(f.type)){status('Bitte eine Bilddatei wählen (WebP, JPG oder PNG).','err');return}
    var ext = (f.name.split('.').pop()||'').toLowerCase();
    var conv = null;
    if(f.type==='image/webp'||ext==='webp'){
      conv = {blob:f,ext:'webp'};
    }else{
      try{
        var bmp = await createImageBitmap(f);
        var c = document.createElement('canvas');
        c.width = bmp.width;c.height = bmp.height;
        c.getContext('2d').drawImage(bmp,0,0);
        var b = await new Promise(function(r){c.toBlob(r,'image/webp',0.92)});
        if(b&&b.type==='image/webp')conv = {blob:b,ext:'webp',converted:true};
      }catch(e){}
      if(!conv)conv = {blob:f,ext:ext||'jpg'};
    }
    if(image&&image.url)URL.revokeObjectURL(image.url);
    conv.url = URL.createObjectURL(conv.blob);
    image = conv;
    $('nv-preview').innerHTML = '<img src="'+conv.url+'" alt="Vorschau des gewählten Bildes"/>';
    var base = f.name.replace(/\.[^.]+$/,'');
    $('f-filename').value = slug($('f-title').value||base);
    $('nv-imginfo').textContent = 'Original in voller Größe'+(conv.converted?', in WebP umgewandelt (ohne Verkleinerung)':'')+' · '+Math.round(conv.blob.size/1024)+' KB';
  }
  $('f-title').addEventListener('input',function(){
    if(image&&!$('f-filename').dataset.touched)$('f-filename').value = slug(this.value);
  });
  $('f-filename').addEventListener('input',function(){this.dataset.touched = '1'});

  /* ---------- Speichern ---------- */
  async function save(ev){
    ev.preventDefault();
    var date = $('f-date').value, title = clean($('f-title').value), teaser = clean($('f-teaser').value);
    if(!date||!title||!teaser){status('Bitte Datum, Titel und Kurztext ausfüllen.','err');return}

    var old = editIndex>=0?entries[editIndex]:null;
    var entry = {
      Datum: isoToDe(date), Kategorie: clean($('f-cat').value), Titel: title, Kurztext: teaser,
      Infos: readInfos(), Details: readDetails(),
      Vorschaubild: old?old.Vorschaubild:'', Plakat: old?old.Plakat:'',
      Link: clean($('f-link').value), Linktext: clean($('f-linktext').value)
    };

    var imgParts = null, imgPath = '';
    if(image){
      var year = date.slice(0,4);
      var name = slug($('f-filename').value||title);
      imgPath = 'assets/img/news/'+year+'/'+name+'.'+image.ext;
      if(root){
        var n = 2;
        while(await fileExists(imgPath.split('/'))&&(!old||(old.Plakat!==imgPath&&old.Vorschaubild!==imgPath))){
          imgPath = 'assets/img/news/'+year+'/'+name+'-'+(n++)+'.'+image.ext;
        }
      }
      imgParts = imgPath.split('/');
      if($('f-imgtype').value==='poster'){entry.Plakat = imgPath;entry.Vorschaubild = ''}
      else{entry.Vorschaubild = imgPath;entry.Plakat = ''}
    }

    if(editIndex>=0)entries[editIndex] = entry;else entries.push(entry);
    sortEntries();

    try{
      if(root){
        if(image)await writeFile(imgParts,image.blob);
        await writeFile(['data','news.csv'],new Blob([toCSV(entries)],{type:'text/csv;charset=utf-8'}));
        status('Gespeichert: „'+title+'“'+(imgPath?' mit Bild '+imgPath:'')+'. Zum Veröffentlichen bitte Bescheid sagen (commit und push).','ok');
        dirty = false;
      }else{
        dirty = true;
        window.__pendingImage = image?{blob:image.blob,path:imgPath}:null;
        status('Übernommen. Jetzt unten die Dateien herunterladen und an die angegebenen Stellen legen.','ok');
        $('nv-where').innerHTML = (imgPath?'<li>Bild in den Ordner <code>'+esc(imgPath.replace(/\/[^/]+$/,'/'))+'</code> legen (Dateiname <code>'+esc(imgPath.split('/').pop())+'</code>)</li>':'')+
          '<li><code>news.csv</code> in den Ordner <code>data/</code> legen und die alte Datei ersetzen</li>';
      }
    }catch(e){
      status('Speichern nicht möglich: '+e.message,'err');
      return;
    }
    renderTable();
    resetForm();
    updateModeUI();
    window.scrollTo({top:$('nv-tablewrap').getBoundingClientRect().top+window.pageYOffset-80,behavior:'smooth'});
  }

  /* ---------- Tabelle ---------- */
  function renderTable(){
    var body = $('nv-tbody');
    body.innerHTML = entries.map(function(e,i){
      var img = e.Plakat||e.Vorschaubild;
      var badge = i<LATEST?'<span class="nv-badge on">Startseite</span>':'<span class="nv-badge">Archiv '+esc(e.Datum.split('.')[2])+'</span>';
      return '<tr><td>'+esc(e.Datum)+'</td><td><strong>'+esc(e.Titel)+'</strong><div class="nv-sub">'+esc(e.Kategorie)+'</div></td>'+
        '<td>'+badge+'</td><td>'+(img?'ja':'<span class="nv-warn">kein Bild</span>')+'</td>'+
        '<td class="nv-actions"><button type="button" class="nv-mini txt" data-edit="'+i+'">Bearbeiten</button>'+
        '<button type="button" class="nv-mini txt danger" data-del="'+i+'">Entfernen</button></td></tr>';
    }).join('');
    $('nv-count').textContent = entries.length+' Meldungen · die '+Math.min(LATEST,entries.length)+' neuesten stehen auf der Startseite';
  }

  function edit(i){
    var e = entries[i];
    editIndex = i;
    $('f-date').value = deToIso(e.Datum);
    $('f-cat').value = e.Kategorie;
    $('f-title').value = e.Titel;
    $('f-teaser').value = e.Kurztext;
    $('f-link').value = e.Link;
    $('f-linktext').value = e.Linktext;
    $('f-details').value = e.Details.split(' | ').join('\n\n');
    $('nv-infos').innerHTML = '';
    var rows = e.Infos?e.Infos.split(' | '):[];
    rows.forEach(function(r){
      var m = r.match(/^([^:]{1,60}):\s+(.+)$/);
      addInfoRow(m?m[1]:'',m?m[2]:r);
    });
    if(!rows.length)addInfoRow('','');
    clearImage();
    var cur = e.Plakat||e.Vorschaubild;
    if(cur){
      $('nv-preview').innerHTML = '<img src="../'+esc(cur)+'" alt="Aktuelles Bild"/>';
      $('nv-imginfo').textContent = 'Aktuelles Bild: '+cur+' (nur ein neues Bild wählen, wenn es ersetzt werden soll)';
      $('f-imgtype').value = e.Plakat?'poster':'photo';
    }
    $('nv-formtitle').textContent = 'Meldung bearbeiten';
    $('nv-cancel').hidden = false;
    updateModeUI();
    window.scrollTo({top:$('nv-formtitle').getBoundingClientRect().top+window.pageYOffset-80,behavior:'smooth'});
  }
  async function remove(i){
    var e = entries[i];
    if(!window.confirm('„'+e.Titel+'“ wirklich entfernen?\n(Das Bild bleibt im Ordner erhalten.)'))return;
    entries.splice(i,1);
    try{
      if(root){
        await writeFile(['data','news.csv'],new Blob([toCSV(entries)],{type:'text/csv;charset=utf-8'}));
        status('Entfernt und gespeichert.','ok');
      }else{
        dirty = true;
        $('nv-where').innerHTML = '<li><code>news.csv</code> in den Ordner <code>data/</code> legen und die alte Datei ersetzen</li>';
        status('Entfernt. Bitte unten die news.csv herunterladen und ersetzen.','ok');
      }
    }catch(err){status('Speichern nicht möglich: '+err.message,'err')}
    renderTable();updateModeUI();
  }

  /* ---------- Downloads (ohne Ordner-Verbindung) ---------- */
  function download(blob,name){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;a.download = name;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded',function(){
    $('nv-connect').addEventListener('click',connect);
    $('nv-form').addEventListener('submit',save);
    $('f-file').addEventListener('change',onFile);
    $('nv-addinfo').addEventListener('click',function(){addInfoRow('','')});
    $('nv-cancel').addEventListener('click',function(){resetForm();status('Bearbeiten abgebrochen.','')});
    $('nv-tbody').addEventListener('click',function(ev){
      var b = ev.target.closest('button');
      if(!b)return;
      if(b.dataset.edit!==undefined)edit(Number(b.dataset.edit));
      if(b.dataset.del!==undefined)remove(Number(b.dataset.del));
    });
    $('nv-dl-csv').addEventListener('click',function(){download(new Blob([toCSV(entries)],{type:'text/csv;charset=utf-8'}),'news.csv')});
    $('nv-dl-img').addEventListener('click',function(){
      var p = window.__pendingImage;
      if(p)download(p.blob,p.path.split('/').pop());else status('Es gibt kein neues Bild zum Herunterladen.','err');
    });
    fetch('../data/news.csv').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()})
      .then(function(t){entries = parseEntries(t);sortEntries();renderTable()})
      .catch(function(){status('Die Tabelle konnte nicht geladen werden. Bitte den Projektordner verbinden.','err')});
    resetForm();
    updateModeUI();
  });
})();
