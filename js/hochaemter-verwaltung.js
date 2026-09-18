/* ============================================================
   Augustinerkirche Wien — hochaemter-verwaltung.js
   Komfortables Bearbeiten von data/hochaemter.csv im Browser.
   Laedt die Tabelle, erlaubt Hinzufuegen/Bearbeiten/Loeschen,
   importiert eine in Excel bearbeitete CSV und exportiert die
   Liste wieder als Excel-taugliche CSV-Datei.
   ============================================================ */
(function(){
  'use strict';

  var HD = window.HochamtData;
  var DATA_URL = '../data/hochaemter.csv';
  var FIELDS = HD.FIELDS;
  var LONG = {piece:1,soloists:1,organist:1,extra:1,note:1};
  var entries = [];

  function qs(sel){return document.querySelector(sel)}
  function status(msg){var el=qs('#verw-status');if(el)el.textContent=msg}

  function inputType(key){return key==='date'?'date':key==='time'?'time':'text'}

  /* Roh-Eintrag -> Formularwerte (ISO-Datum, HH:MM) */
  function prepare(o){
    var e={};
    FIELDS.forEach(function(f){e[f[0]]=o[f[0]]||''});
    e.date=HD.isoDate(e.date);
    e.time=HD.isoTime(e.time)||'11:00';
    return e;
  }
  function sortEntries(){
    entries.sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time)});
  }
  function setEntries(raw){
    entries=raw.map(prepare).filter(function(e){return e.date});
    sortEntries();
    render();
  }

  function load(){
    HD.loadRaw(DATA_URL)
      .then(function(raw){setEntries(raw);status('Aktuelle Liste geladen ('+entries.length+' Einträge).')})
      .catch(function(){entries=[];render();status('Konnte data/hochaemter.csv nicht laden — die Liste ist leer.')});
  }

  function buildForm(){
    var form=qs('#verw-form');
    form.innerHTML=FIELDS.map(function(f){
      var k=f[0];
      return '<div class="verw-field'+(LONG[k]?' wide':'')+'"><label for="f-'+k+'">'+f[1]+'</label>'+
        '<input type="'+inputType(k)+'" id="f-'+k+'"'+(k==='date'||k==='piece'?' required':'')+
        (k==='time'?' value="11:00"':'')+(k==='location'?' value="Augustinerkirche"':'')+
        (k==='type'?' value="Hochamt"':'')+'/></div>';
    }).join('')+'<button type="submit" class="btn btn-dark">Hinzufügen</button>';

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var o={};
      FIELDS.forEach(function(f){o[f[0]]=qs('#f-'+f[0]).value});
      entries.push(prepare(o));
      sortEntries();
      render();
      form.reset();
      qs('#f-time').value='11:00';qs('#f-location').value='Augustinerkirche';qs('#f-type').value='Hochamt';
      qs('#f-date').focus();
    });
  }

  function render(){
    var head=qs('#verw-thead'),tbody=qs('#verw-tbody');
    if(!tbody)return;
    head.innerHTML='<tr>'+FIELDS.map(function(f){return '<th>'+f[1]+'</th>'}).join('')+'<th></th></tr>';
    tbody.innerHTML='';
    entries.forEach(function(entry,i){
      var tr=document.createElement('tr');
      tr.innerHTML=FIELDS.map(function(f){
        var k=f[0];
        return '<td><input type="'+inputType(k)+'" data-field="'+k+'" value="'+HD.esc(entry[k])+'"'+(LONG[k]?' class="wide"':'')+'/></td>';
      }).join('')+'<td><button type="button" class="verw-del" data-index="'+i+'">Entfernen</button></td>';
      tbody.appendChild(tr);
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('input'),function(input){
      input.addEventListener('change',function(){
        var index=Array.prototype.indexOf.call(tbody.children,input.closest('tr'));
        entries[index][input.dataset.field]=input.value;
      });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('.verw-del'),function(btn){
      btn.addEventListener('click',function(){entries.splice(Number(btn.dataset.index),1);render()});
    });
  }

  function initDownload(){
    qs('#verw-download').addEventListener('click',function(){
      sortEntries();
      var blob=new Blob([HD.toCSV(entries)],{type:'text/csv;charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download='hochaemter.csv';
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      URL.revokeObjectURL(url);
      status('Datei heruntergeladen — bitte data/hochaemter.csv damit ersetzen.');
    });
  }

  function initImport(){
    qs('#verw-import').addEventListener('change',function(ev){
      var file=ev.target.files[0];
      if(!file)return;
      var reader=new FileReader();
      reader.onload=function(){
        setEntries(HD.rowsToRaw(HD.parseCSV(reader.result)));
        status('„'+file.name+'“ importiert ('+entries.length+' Einträge). Zum Übernehmen bitte wieder herunterladen.');
        ev.target.value='';
      };
      reader.readAsText(file,'utf-8');
    });
  }

  document.addEventListener('DOMContentLoaded',function(){
    buildForm();
    initDownload();
    initImport();
    qs('#verw-reload').addEventListener('click',load);
    load();
  });
})();
