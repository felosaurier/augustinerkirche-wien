/* ============================================================
   Augustinerkirche Wien — hochaemter-start.js
   Zeigt auf der Startseite (#hs-list) automatisch die naechsten
   Hochaemter aus data/hochaemter.csv. Jeder Eintrag fuehrt zur
   Detailseite pages/hochamt.html.
   ============================================================ */
(function(){
  'use strict';

  var HD = window.HochamtData;
  var COUNT = 3;
  var MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  function itemHTML(e){
    var d=e.dateObj;
    return '<a class="hs-item" href="pages/hochamt.html?id='+e.id+'">'+
      '<div class="hs-when"><span class="hs-day">'+HD.pad(d.getDate())+'</span><span class="hs-mon">'+MONTHS_SHORT[d.getMonth()]+'</span><span class="hs-yr">'+d.getFullYear()+'</span></div>'+
      '<div class="hs-main"><div class="hs-piece">'+HD.esc(e.piece||e.type)+'</div>'+
        '<div class="hs-meta">'+HD.WEEKDAYS[d.getDay()]+' · '+HD.esc(e.type)+'</div></div>'+
      '<div class="hs-time">'+e.time+'</div>'+
    '</a>';
  }

  document.addEventListener('DOMContentLoaded',function(){
    var list=document.getElementById('hs-list');
    if(!list||!HD)return;
    HD.load('data/hochaemter.csv').then(function(data){
      var next=data.filter(HD.isUpcoming).slice(0,COUNT);
      if(next.length)list.innerHTML=next.map(itemHTML).join('');
      else list.innerHTML='<p class="hs-fallback">Derzeit sind keine kommenden Hochämter eingetragen.</p>';
    }).catch(function(){});
  });
})();
