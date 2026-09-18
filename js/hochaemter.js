/* ============================================================
   Augustinerkirche Wien — hochaemter.js
   Kalender und Archiv der Hochaemter auf musik.html.
   Die Termine kommen aus data/hochaemter.csv (Excel-Tabelle,
   siehe js/hochaemter-data.js). Jede Zeile fuehrt zur Detailseite
   hochamt.html. Kommende Termine mit Monatsfilter in #p-hochaemter,
   vergangene in #p-hochaemter-archiv.
   ============================================================ */
(function(){
  'use strict';

  var DATA_URL = '../data/hochaemter.csv';
  var HD = window.HochamtData;
  var MONTH_NAMES = HD.MONTHS;
  var WEEKDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

  function qs(sel,ctx){return (ctx||document).querySelector(sel)}

  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function monthLabel(d){return MONTH_NAMES[d.getMonth()]+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'')}

  function rowHTML(entry){
    var d=entry.dateObj;
    var year='<div class="kal-wd kal-yr">'+d.getFullYear()+'</div>';
    return '<a class="kal-row" data-m="'+monthKey(d)+'" href="hochamt.html?id='+entry.id+'">'+
      '<div><div class="kal-d">'+HD.pad(d.getDate())+'</div><div class="kal-wd">'+WEEKDAYS[d.getDay()]+'</div>'+year+'</div>'+
      '<div><div class="kal-name">'+HD.esc(entry.piece||entry.type)+'</div><div class="kal-type">'+HD.esc(entry.type)+'</div></div>'+
      '<div><div class="kal-time">'+entry.time+'</div><div class="kal-loc">'+HD.esc(entry.location)+'</div></div>'+
      '<div class="kal-go" aria-hidden="true">&rarr;</div>'+
    '</a>';
  }

  function renderUpcoming(entries,monthsEl,listEl){
    if(!entries.length){
      listEl.innerHTML='<p class="s-text">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
      return;
    }
    var groups=[];
    var seen={};
    entries.forEach(function(entry){
      var d=entry.dateObj;
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
    var sorted=entries.slice().sort(function(a,b){return (b.date+b.time).localeCompare(a.date+a.time)});
    listEl.innerHTML=sorted.map(rowHTML).join('');
  }

  function init(){
    var monthsEl=qs('#kal-months');
    var listEl=qs('#kal-list');
    var archiveList=qs('#kal-archive-list');
    if(!monthsEl&&!listEl&&!archiveList)return;

    HD.load(DATA_URL)
      .then(function(data){
        var upcoming=data.filter(HD.isUpcoming);
        var past=data.filter(function(e){return !HD.isUpcoming(e)});

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
