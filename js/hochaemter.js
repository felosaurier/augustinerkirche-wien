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
  var ARCHIVE_DIR = '../data/archiv/';
  var HD = window.HochamtData;
  var MONTH_NAMES = HD.MONTHS;
  var WEEKDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  var MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  function qs(sel,ctx){return (ctx||document).querySelector(sel)}

  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function monthLabel(d){return MONTH_NAMES[d.getMonth()]+' '+d.getFullYear()}

  function rowHTML(entry){
    var d=entry.dateObj;
    var year='<div class="kal-wd kal-yr">'+MONTHS_SHORT[d.getMonth()]+' '+d.getFullYear()+'</div>';
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

    /* Handy: Monatsauswahl als Aufklappmenue (die Reiter sind dort ausgeblendet) */
    var oldSel=monthsEl.parentNode.querySelector('.kal-select-wrap');
    if(oldSel)oldSel.parentNode.removeChild(oldSel);
    var selWrap=document.createElement('div');
    selWrap.className='kal-select-wrap';
    selWrap.innerHTML='<label class="kal-select-label" for="kal-select">Monat wählen</label>'+
      '<select id="kal-select" class="kal-select">'+groups.map(function(g){
        return '<option value="'+g.key+'">'+g.label+'</option>';
      }).join('')+'</select>';
    monthsEl.parentNode.insertBefore(selWrap,monthsEl);
    var select=selWrap.querySelector('select');

    listEl.innerHTML=entries.map(rowHTML).join('');

    var rows=Array.prototype.slice.call(listEl.querySelectorAll('.kal-row'));
    var buttons=Array.prototype.slice.call(monthsEl.querySelectorAll('.kal-m-btn'));
    function applyFilter(key){
      rows.forEach(function(row){row.style.display=(row.dataset.m===key)?'':'none'});
    }
    /* Wird der Bereich kuerzer, rutscht das klebende Seitenmenue (Querformat) aus dem Bild:
       dann an den Anfang des Bereichs zurueckscrollen. */
    function keepSidebarInView(){
      var sidebar=qs('.sidebar');
      if(!sidebar||window.innerWidth<=1024)return;
      var navH=(qs('nav')||{offsetHeight:72}).offsetHeight;
      if(sidebar.getBoundingClientRect().top<navH){
        var wrap=sidebar.closest('.with-sidebar')||sidebar;
        window.scrollTo(0,wrap.getBoundingClientRect().top+window.pageYOffset-navH-16);
      }
    }
    buttons.forEach(function(btn){
      btn.addEventListener('click',function(){
        buttons.forEach(function(b){b.classList.remove('active')});
        btn.classList.add('active');
        select.value=btn.dataset.filter;
        showActive();
        applyFilter(btn.dataset.filter);
        keepSidebarInView();
      });
    });
    /* Monatszeile (Querformat): eine Zeile, seitlich verschiebbar (Wischen, Ziehen, Trackpad) */
    function updateEdges(){
      var max=monthsEl.scrollWidth-monthsEl.clientWidth;
      monthsEl.classList.toggle('has-left',monthsEl.scrollLeft>2);
      monthsEl.classList.toggle('has-right',monthsEl.scrollLeft<max-2);
    }
    function showActive(){
      var a=monthsEl.querySelector('.kal-m-btn.active');
      if(!a||monthsEl.scrollWidth<=monthsEl.clientWidth)return;
      var left=a.offsetLeft-(monthsEl.clientWidth-a.offsetWidth)/2;
      if(monthsEl.scrollTo)monthsEl.scrollTo({left:left,behavior:'smooth'});else monthsEl.scrollLeft=left;
    }
    monthsEl.addEventListener('scroll',updateEdges);
    window.addEventListener('resize',updateEdges);
    updateEdges();
    (function(){
      var down=false,startX=0,startLeft=0,moved=false;
      monthsEl.addEventListener('pointerdown',function(e){
        if(e.pointerType!=='mouse'||e.button!==0)return;
        down=true;moved=false;startX=e.clientX;startLeft=monthsEl.scrollLeft;
      });
      window.addEventListener('pointermove',function(e){
        if(!down)return;
        var dx=e.clientX-startX;
        if(Math.abs(dx)>5){moved=true;monthsEl.classList.add('dragging')}
        if(moved)monthsEl.scrollLeft=startLeft-dx;
      });
      window.addEventListener('pointerup',function(){
        if(!down)return;
        down=false;monthsEl.classList.remove('dragging');
      });
      /* Nach dem Ziehen keinen Monat versehentlich anklicken */
      monthsEl.addEventListener('click',function(e){
        if(moved){e.preventDefault();e.stopPropagation();moved=false}
      },true);
    })();

    select.addEventListener('change',function(){
      var btn=buttons.filter(function(b){return b.dataset.filter===select.value})[0];
      if(btn)btn.click();
    });
    if(groups.length)applyFilter(groups[0].key);
  }

  function renderArchive(entries,archiveYears,listEl){
    var sorted=entries.slice().sort(function(a,b){return (b.date+b.time).localeCompare(a.date+a.time)});
    var counts={};
    sorted.forEach(function(e){var y=e.dateObj.getFullYear();counts[y]=(counts[y]||0)+1});
    var years=Object.keys(counts).map(Number);
    var known={};   /* Anzahl der Termine je Archivjahr (aus data/archiv/jahre.json) */
    (archiveYears||[]).forEach(function(a){
      var y=Number(a&&a.jahr!==undefined?a.jahr:a);
      if(a&&a.anzahl)known[y]=a.anzahl;
      if(years.indexOf(y)<0)years.push(y);
    });
    years.sort(function(a,b){return b-a});
    if(!years.length){
      listEl.innerHTML='<p class="s-text">Es sind noch keine vergangenen Hochämter erfasst.</p>';
      return;
    }

    /* Nach Jahren geordnet, wie im Neuigkeiten-Archiv: neuestes Jahr zuerst.
       Aeltere Jahre liegen in eigenen Dateien und werden erst beim Anklicken geladen. */
    var yearCount=function(y){return counts[y]||known[y]||0};
    listEl.innerHTML=
      /* Handy: Jahr als Aufklappmenue (die Reiter sind dort ausgeblendet) */
      '<div class="kal-select-wrap kal-year-wrap">'+
        '<label class="kal-select-label" for="kal-year-select">Jahr wählen</label>'+
        '<select id="kal-year-select" class="kal-select">'+
          years.map(function(y){return '<option value="'+y+'">'+y+(yearCount(y)?' ('+yearCount(y)+')':'')+'</option>'}).join('')+
        '</select>'+
      '</div>'+
      '<div class="news-years" role="group" aria-label="Jahr wählen">'+
        years.map(function(y,i){
          return '<button type="button" class="news-year'+(i===0?' active':'')+'" data-year="'+y+'">'+y+((counts[y]||known[y])?'<span class="news-year-n">'+(counts[y]||known[y])+'</span>':'')+'</button>';
        }).join('')+
      '</div>'+
      '<div class="kal-archive-rows" aria-live="polite"></div>';

    var rowsEl=listEl.querySelector('.kal-archive-rows');
    var token=0;
    function fill(list){
      rowsEl.innerHTML=list.slice().sort(function(a,b){return (b.date+b.time).localeCompare(a.date+a.time)}).map(rowHTML).join('');
    }
    function showYear(y){
      var mine=++token;
      if(counts[y]){
        fill(sorted.filter(function(e){return e.dateObj.getFullYear()===y}));
        return;
      }
      rowsEl.innerHTML='<p class="s-text">Wird geladen …</p>';
      HD.loadYear(ARCHIVE_DIR,y).then(function(list){
        if(mine===token)fill(list);
      }).catch(function(){
        if(mine===token)rowsEl.innerHTML='<p class="s-text">Dieses Jahr konnte nicht geladen werden.</p>';
      });
    }
    var yearSelect=listEl.querySelector('#kal-year-select');
    listEl.addEventListener('click',function(ev){
      var btn=ev.target.closest('.news-year');
      if(!btn)return;
      Array.prototype.forEach.call(listEl.querySelectorAll('.news-year'),function(x){x.classList.toggle('active',x===btn)});
      if(yearSelect)yearSelect.value=btn.dataset.year;
      showYear(Number(btn.dataset.year));
    });
    if(yearSelect)yearSelect.addEventListener('change',function(){
      var btn=listEl.querySelector('.news-year[data-year="'+yearSelect.value+'"]');
      if(btn)btn.click();
    });
    showYear(years[0]);
  }

  function init(){
    var monthsEl=qs('#kal-months');
    var listEl=qs('#kal-list');
    var archiveList=qs('#kal-archive-list');
    if(!monthsEl&&!listEl&&!archiveList)return;

    Promise.all([HD.load(DATA_URL),archiveList?HD.archiveYears(ARCHIVE_DIR):Promise.resolve([])])
      .then(function(res){
        var data=res[0];
        var upcoming=data.filter(HD.isUpcoming);
        var past=data.filter(function(e){return !HD.isUpcoming(e)});

        if(monthsEl&&listEl)renderUpcoming(upcoming,monthsEl,listEl);
        if(archiveList)renderArchive(past,res[1],archiveList);
      })
      .catch(function(){
        var message='<p class="s-text">Der Hochamt-Kalender konnte nicht geladen werden. Das vollständige Programm finden Sie unter <a class="link-arr" href="https://hochamt.augustiner.at">hochamt.augustiner.at</a>.</p>';
        if(listEl)listEl.innerHTML=message;
        if(archiveList)archiveList.innerHTML=message;
      });
  }

  document.addEventListener('DOMContentLoaded',init);
})();
