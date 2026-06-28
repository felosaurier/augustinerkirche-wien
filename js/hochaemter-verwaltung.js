/* ============================================================
   Augustinerkirche Wien — hochaemter-verwaltung.js
   Formular-Werkzeug zum Pflegen von data/hochaemter.json ohne
   direkte Code-Bearbeitung. Laedt die bestehende Liste, erlaubt
   Hinzufuegen/Bearbeiten/Loeschen einzelner Zeilen und exportiert
   das Ergebnis wieder als JSON-Datei zum Download.
   ============================================================ */
(function(){
  'use strict';

  var DATA_URL = '../data/hochaemter.json';
  var entries = [];

  function qs(sel){return document.querySelector(sel)}

  function load(){
    var status=qs('#verw-status');
    fetch(DATA_URL)
      .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json()})
      .then(function(data){
        entries=Array.isArray(data)?data.slice():[];
        entries.sort(function(a,b){return a.date.localeCompare(b.date)});
        render();
        if(status)status.textContent='Aktuelle Liste geladen ('+entries.length+' Einträge).';
      })
      .catch(function(){
        entries=[];
        render();
        if(status)status.textContent='Konnte data/hochaemter.json nicht laden — Liste ist leer, neue Einträge koennen trotzdem ergaenzt werden.';
      });
  }

  function render(){
    var tbody=qs('#verw-tbody');
    if(!tbody)return;
    tbody.innerHTML='';
    entries.forEach(function(entry,i){
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td><input type="date" data-field="date" value="'+entry.date+'"/></td>'+
        '<td><input type="time" data-field="time" value="'+entry.time+'"/></td>'+
        '<td><input type="text" data-field="piece" value="'+escapeAttr(entry.piece)+'"/></td>'+
        '<td><input type="text" data-field="type" value="'+escapeAttr(entry.type)+'"/></td>'+
        '<td><input type="text" data-field="location" value="'+escapeAttr(entry.location)+'"/></td>'+
        '<td><button type="button" class="verw-del" data-index="'+i+'">Entfernen</button></td>';
      tbody.appendChild(tr);
    });

    Array.prototype.forEach.call(tbody.querySelectorAll('input'),function(input){
      input.addEventListener('change',function(){
        var tr=input.closest('tr');
        var index=Array.prototype.indexOf.call(tbody.children,tr);
        entries[index][input.dataset.field]=input.value;
      });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('.verw-del'),function(btn){
      btn.addEventListener('click',function(){
        entries.splice(Number(btn.dataset.index),1);
        render();
      });
    });
  }

  function escapeAttr(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  }

  function initForm(){
    var form=qs('#verw-form');
    if(!form)return;
    form.addEventListener('submit',function(e){
      e.preventDefault();
      entries.push({
        date:qs('#f-date').value,
        time:qs('#f-time').value,
        piece:qs('#f-piece').value,
        type:qs('#f-type').value,
        location:qs('#f-location').value||'Augustinerkirche'
      });
      entries.sort(function(a,b){return a.date.localeCompare(b.date)});
      render();
      form.reset();
      qs('#f-time').value='11:00';
      qs('#f-location').value='Augustinerkirche';
      qs('#f-date').focus();
    });
  }

  function initDownload(){
    var btn=qs('#verw-download');
    if(!btn)return;
    btn.addEventListener('click',function(){
      var json=JSON.stringify(entries,null,2)+'\n';
      var blob=new Blob([json],{type:'application/json'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;
      a.download='hochaemter.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      var status=qs('#verw-status');
      if(status)status.textContent='Datei heruntergeladen — bitte data/hochaemter.json damit ersetzen.';
    });
  }

  function initReload(){
    var btn=qs('#verw-reload');
    if(!btn)return;
    btn.addEventListener('click',load);
  }

  document.addEventListener('DOMContentLoaded',function(){
    initForm();
    initDownload();
    initReload();
    load();
  });
})();
