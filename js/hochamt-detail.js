/* ============================================================
   Augustinerkirche Wien — hochamt-detail.js
   Detailseite eines Hochamts (pages/hochamt.html?id=JJJJ-MM-TT-HHMM).
   Zeigt Zelebrant, Dirigent, Chor, Orchester, Solisten, Organist
   und weitere Musik aus data/hochaemter.csv.
   ============================================================ */
(function(){
  'use strict';

  var HD = window.HochamtData;
  function qs(sel){return document.querySelector(sel)}

  function longDate(e){
    var d=e.dateObj;
    return HD.WEEKDAYS[d.getDay()]+', '+d.getDate()+'. '+HD.MONTHS[d.getMonth()]+' '+d.getFullYear()+' · '+e.time+' Uhr';
  }
  function row(label,value){
    if(!value||(Array.isArray(value)&&!value.length))return '';
    var html=Array.isArray(value)
      ? '<ul>'+value.map(function(v){return '<li>'+HD.esc(v)+'</li>'}).join('')+'</ul>'
      : '<p>'+HD.esc(value)+'</p>';
    return '<div class="hd-row"><div class="hd-label">'+label+'</div><div class="hd-value">'+html+'</div></div>';
  }
  function navLink(e,dir){
    if(!e)return '<span></span>';
    return '<a class="hd-nav-link hd-'+dir+'" href="hochamt.html?id='+e.id+'">'+
      '<span class="hd-nav-dir">'+(dir==='prev'?'&larr; Vorheriges':'Nächstes &rarr;')+'</span>'+
      '<span class="hd-nav-txt">'+HD.esc(e.piece||e.type)+'</span>'+
      '<span class="hd-nav-date">'+e.dateObj.getDate()+'. '+HD.MONTHS[e.dateObj.getMonth()]+' '+e.dateObj.getFullYear()+'</span></a>';
  }

  function render(entries,id){
    var idx=-1,i;
    for(i=0;i<entries.length;i++)if(entries[i].id===id){idx=i;break}
    var body=qs('#hd-body');
    if(idx<0){
      qs('#hd-title').innerHTML='Hochamt nicht <em>gefunden</em>';
      body.innerHTML='<p class="s-text">Dieser Termin ist nicht (mehr) eingetragen.</p><p style="margin-top:1.5rem"><a class="btn btn-dark" href="musik.html#p-hochaemter">Alle Hochämter</a></p>';
      return;
    }
    var e=entries[idx];
    document.title=(e.piece||e.type)+' — '+e.type+' — Augustinerkirche Wien';
    qs('#hd-type').textContent=e.type;
    qs('#hd-title').textContent=e.piece||e.type;
    qs('#hd-when').textContent=longDate(e)+' · '+e.location;

    var rows=
      row('Zelebrant',e.celebrant)+
      row('Dirigent',e.conductor)+
      row('Chor',e.choir)+
      row('Orchester',e.orchestra)+
      row('Solisten',e.soloists)+
      row('Organist',e.organist)+
      row('Programm',e.extra)+
      row('Hinweis',e.note);

    body.innerHTML=
      '<div class="s-label">Programm &amp; Besetzung</div>'+
      '<h2 class="s-title">Musikalische <em>Gestaltung</em></h2>'+
      '<div class="divider-g"></div>'+
      (rows
        ? '<div class="hd-grid">'+rows+'</div>'
        : '<p class="s-text">Die Mitwirkenden und das genaue Programm werden noch bekannt gegeben.</p>')+
      '<p style="margin-top:2rem"><a class="link-arr" href="musik.html#'+(HD.isUpcoming(e)?'p-hochaemter':'p-hochaemter-archiv')+'">'+(HD.isUpcoming(e)?'Alle Hochämter':'Zum Archiv')+'</a></p>';

    qs('#hd-nav').innerHTML=navLink(entries[idx-1],'prev')+navLink(entries[idx+1],'next');
  }

  document.addEventListener('DOMContentLoaded',function(){
    var id=new URLSearchParams(location.search).get('id')||'';
    HD.load('../data/hochaemter.csv')
      .then(function(entries){render(entries,id)})
      .catch(function(){
        qs('#hd-body').innerHTML='<p class="s-text">Die Termine konnten nicht geladen werden. Das vollständige Programm finden Sie unter <a class="link-arr" href="https://hochamt.augustiner.at">hochamt.augustiner.at</a>.</p>';
      });
  });
})();
