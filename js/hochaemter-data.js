/* ============================================================
   Augustinerkirche Wien — hochaemter-data.js
   Gemeinsames Datenmodul fuer alle Hochamt-Ansichten (Startseite,
   Kalender/Archiv auf musik.html, Detailseite hochamt.html und
   Verwaltung). Quelle ist data/hochaemter.csv — eine Tabelle, die
   sich direkt in Excel bearbeiten laesst (Semikolon-getrennt).
   ============================================================ */
(function(w){
  'use strict';

  var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var WEEKDAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  /* Spaltenueberschriften (frei benennbar) -> interne Feldnamen */
  var ALIASES = {
    datum:'date', uhrzeit:'time', zeit:'time', beginn:'time',
    anlass:'type', typ:'type', werk:'piece', musik:'piece',
    ort:'location', zelebrant:'celebrant', dirigent:'conductor',
    chor:'choir', orchester:'orchestra', solisten:'soloists',
    organist:'organist', organisten:'organist',
    weiteremusik:'extra', weiterestücke:'extra', weiterelieder:'extra', extralieder:'extra', lieder:'extra',
    hinweis:'note', hinweise:'note', bemerkung:'note'
  };
  var FIELDS = [
    ['date','Datum'],['time','Uhrzeit'],['type','Anlass'],['piece','Werk'],['location','Ort'],
    ['celebrant','Zelebrant'],['conductor','Dirigent'],['choir','Chor'],['orchestra','Orchester'],
    ['soloists','Solisten'],['organist','Organist'],['extra','Weitere Musik'],['note','Hinweis']
  ];

  function pad(n){return String(n).padStart(2,'0')}

  function esc(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* CSV -> Zeilen (Anfuehrungszeichen, Zeilenumbrueche in Zellen, Trennzeichen-Erkennung) */
  function parseCSV(text){
    text = String(text).replace(/^﻿/,'');
    var firstLine = text.split(/\r?\n/,1)[0];
    var delim = ';', best = -1;
    [';',',','\t'].forEach(function(d){
      var c = firstLine.split(d).length;
      if(c>best){best=c;delim=d}
    });
    var rows=[], row=[], cell='', inQ=false, i, ch;
    for(i=0;i<text.length;i++){
      ch=text[i];
      if(inQ){
        if(ch==='"'){
          if(text[i+1]==='"'){cell+='"';i++}else inQ=false;
        }else cell+=ch;
      }else if(ch==='"'){inQ=true}
      else if(ch===delim){row.push(cell);cell=''}
      else if(ch==='\n'||ch==='\r'){
        if(ch==='\r'&&text[i+1]==='\n')i++;
        row.push(cell);cell='';
        rows.push(row);row=[];
      }else cell+=ch;
    }
    if(cell!==''||row.length){row.push(cell);rows.push(row)}
    return rows;
  }

  /* Datum 'TT.MM.JJJJ' oder 'JJJJ-MM-TT' -> 'JJJJ-MM-TT' ('' wenn ungueltig) */
  function isoDate(s){
    s=String(s||'').trim();
    var m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if(m){var y=+m[3];if(y<100)y+=2000;return y+'-'+pad(m[2])+'-'+pad(m[1])}
    m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m)return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);
    return '';
  }
  function isoTime(s){
    var m=String(s||'').match(/(\d{1,2})\s*[:.hH]\s*(\d{2})/);
    return m?pad(m[1])+':'+m[2]:'';
  }

  /* Zeilen -> Roh-Objekte (Textfelder, interne Feldnamen) */
  function rowsToRaw(rows){
    if(!rows.length)return [];
    var keys=rows[0].map(function(h){
      return ALIASES[String(h).toLowerCase().replace(/[^a-zäöüß]/g,'')]||null;
    });
    var out=[];
    rows.slice(1).forEach(function(r){
      var o={};
      keys.forEach(function(k,i){if(k)o[k]=(r[i]||'').trim()});
      if(Object.keys(o).some(function(k){return o[k]}))out.push(o);
    });
    return out;
  }

  function list(s){
    return String(s||'').split(/\s*(?:\||\r?\n)\s*/).map(function(x){return x.trim()}).filter(Boolean);
  }

  function normalize(o){
    var date=isoDate(o.date);
    if(!date)return null;
    var time=isoTime(o.time)||'11:00';
    var p=date.split('-').map(Number);
    return {
      id: date+'-'+time.replace(':',''),
      date: date, time: time,
      dateObj: new Date(p[0],p[1]-1,p[2]),
      type: o.type||'Hochamt',
      piece: o.piece||'',
      location: o.location||'Augustinerkirche',
      celebrant: o.celebrant||'',
      conductor: o.conductor||'',
      choir: o.choir||'',
      orchestra: o.orchestra||'',
      soloists: list(o.soloists),
      organist: list(o.organist),
      extra: list(o.extra),
      note: o.note||''
    };
  }

  function sortEntries(a,b){return (a.date+a.time).localeCompare(b.date+b.time)}

  function fetchText(url){
    return fetch(url).then(function(res){
      if(!res.ok)throw new Error('HTTP '+res.status);
      return res.text();
    });
  }

  /* Laedt die Tabelle; liefert normalisierte, chronologisch sortierte Eintraege */
  function load(url){
    return fetchText(url).then(function(text){
      return rowsToRaw(parseCSV(text)).map(normalize).filter(Boolean).sort(sortEntries);
    });
  }
  function loadRaw(url){
    return fetchText(url).then(function(text){return rowsToRaw(parseCSV(text))});
  }

  function today(){var d=new Date();d.setHours(0,0,0,0);return d}
  function isUpcoming(e){return e.dateObj>=today()}

  function toCSV(raws){
    function q(v){
      v=String(v==null?'':v);
      return /[;"\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
    }
    var lines=[FIELDS.map(function(f){return f[1]}).join(';')];
    raws.forEach(function(o){
      lines.push(FIELDS.map(function(f){
        var v=o[f[0]]||'';
        if(f[0]==='date'){var iso=isoDate(v);if(iso){var p=iso.split('-');v=p[2]+'.'+p[1]+'.'+p[0]}}
        return q(v);
      }).join(';'));
    });
    return '﻿'+lines.join('\r\n')+'\r\n';
  }

  w.HochamtData = {
    MONTHS:MONTHS, WEEKDAYS:WEEKDAYS, FIELDS:FIELDS,
    esc:esc, pad:pad, parseCSV:parseCSV, rowsToRaw:rowsToRaw, isoDate:isoDate, isoTime:isoTime,
    normalize:normalize, load:load, loadRaw:loadRaw, isUpcoming:isUpcoming, today:today, toCSV:toCSV
  };
})(window);
