/* ============================================================
   Augustinerkirche Wien — hochaemter.js
   Isolierte Logik fuer den Hochamt-Kalender auf musik.html.
   Die Termine selbst liegen in data/hochaemter.json (siehe
   pages/hochaemter-verwaltung.html zum komfortablen Pflegen).
   Dieses Modul rendert kommende Hochaemter mit Monatsfilter in
   der Pane #p-hochaemter sowie vergangene Termine in der
   eigenstaendigen Pane #p-hochaemter-archiv.
   ============================================================ */
(function(){
  'use strict';

  var DATA_URL = '../data/hochaemter.json';
  var MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var WEEKDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

  function qs(sel,ctx){return (ctx||document).querySelector(sel)}

  function parseDate(s){
    var parts=s.split('-').map(Number);
    return new Date(parts[0],parts[1]-1,parts[2]);
  }
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function monthLabel(d){return MONTH_NAMES[d.getMonth()]+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'')}

  function rowHTML(entry){
    var d=parseDate(entry.date);
    return '<div class="kal-row" data-m="'+monthKey(d)+'">'+
      '<div><div class="kal-d">'+String(d.getDate()).padStart(2,'0')+'</div><div class="kal-wd">'+WEEKDAYS[d.getDay()]+'</div></div>'+
      '<div><div class="kal-name">'+entry.piece+'</div><div class="kal-type">'+entry.type+'</div></div>'+
      '<div><div class="kal-time">'+entry.time+'</div><div class="kal-loc">'+entry.location+'</div></div>'+
    '</div>';
  }

  function renderUpcoming(entries,monthsEl,listEl){
    if(!entries.length){
      listEl.innerHTML='<p class="s-text">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
      return;
    }
    var groups=[];
    var seen={};
    entries.forEach(function(entry){
      var d=parseDate(entry.date);
      var key=monthKey(d);
      if(!seen[key]){seen[key]=true;groups.push({key:key,label:monthLabel(d)})}
    });

    monthsEl.innerHTML=groups.map(function(g,i){
      return '<button class="kal-m-btn'+(i===0?' active':'')+'" data-filter="'+g.key+'">'+g.label+'</button>';
    }).join('');

    listEl.innerHTML=entries.map(rowHTML).join('');

    var rows=Array.prototype.slice.call(listEl.querySelectorAll('.kal-row'));
    var buttons=Array.prototype.slice.call(monthsEl.querySelectorAll('.kal-m-btn'));
    function applyFilter(key){
      rows.forEach(function(row){row.style.display=(row.dataset.m===key)?'':'none'});
    }
    buttons.forEach(function(btn){
      btn.addEventListener('click',function(){
        buttons.forEach(function(b){b.classList.remove('active')});
        btn.classList.add('active');
        applyFilter(btn.dataset.filter);
      });
    });
    if(groups.length)applyFilter(groups[0].key);
  }

  function renderArchive(entries,listEl){
    if(!entries.length){
      listEl.innerHTML='<p class="s-text">Es sind noch keine vergangenen Hochämter erfasst.</p>';
      return;
    }
    var sorted=entries.slice().sort(function(a,b){return b.date.localeCompare(a.date)});
    listEl.innerHTML=sorted.map(rowHTML).join('');
  }

  function init(){
    var monthsEl=qs('#kal-months');
    var listEl=qs('#kal-list');
    var archiveList=qs('#kal-archive-list');
    if(!monthsEl&&!listEl&&!archiveList)return;

    fetch(DATA_URL)
      .then(function(res){
        if(!res.ok)throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(function(data){
        if(!Array.isArray(data))throw new Error('Unerwartetes Datenformat');
        var today=new Date();
        today.setHours(0,0,0,0);
        var upcoming=[],past=[];
        data.forEach(function(entry){
          (parseDate(entry.date)>=today?upcoming:past).push(entry);
        });
        upcoming.sort(function(a,b){return a.date.localeCompare(b.date)});

        if(monthsEl&&listEl)renderUpcoming(upcoming,monthsEl,listEl);
        if(archiveList)renderArchive(past,archiveList);
      })
      .catch(function(){
        var message='<p class="s-text">Der Hochamt-Kalender konnte nicht geladen werden. Das vollständige Programm finden Sie unter <a class="link-arr" href="https://hochamt.augustiner.at">hochamt.augustiner.at</a>.</p>';
        if(listEl)listEl.innerHTML=message;
        if(archiveList)archiveList.innerHTML=message;
      });
  }

  document.addEventListener('DOMContentLoaded',init);
})();
