/* ============================================================
   Augustinerkirche Wien — news.js
   Neuigkeiten aus data/news.csv (Excel-Tabelle):
   - Startseite (#news-grid): die 6 neuesten Meldungen als Karten
   - Archiv (#news-archive): alle aelteren Meldungen, nach Jahren
   - Klick auf eine Meldung oeffnet ein Fenster mit allen Infos
   Aufruf mit ?news=ID oeffnet die Meldung direkt (teilbarer Link).
   Benoetigt js/hochaemter-data.js (CSV-Parser).
   ============================================================ */
(function(){
  'use strict';

  var HD = window.HochamtData;
  if(!HD)return;

  var LATEST = 6;
  var MONTHS = HD.MONTHS;
  var KEYS = {
    datum:'date', kategorie:'cat', titel:'title', kurztext:'teaser', infos:'infos',
    details:'details', vorschaubild:'thumb', plakat:'poster', link:'link', linktext:'linktext'
  };

  var base = '';
  var entries = [];
  var dialog = null;
  var lastTrigger = null;

  function qs(sel,ctx){return (ctx||document).querySelector(sel)}
  function esc(s){return HD.esc(s)}

  /* ---------- Daten ---------- */
  function slug(s){
    return String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
  }
  function list(s,sep){
    return String(s||'').split(sep).map(function(x){return x.trim()}).filter(Boolean);
  }
  function parse(text){
    var rows = HD.parseCSV(text);
    if(!rows.length)return [];
    var keys = rows[0].map(function(h){return KEYS[String(h).toLowerCase().replace(/[^a-zäöüß]/g,'')]||null});
    var out = [];
    rows.slice(1).forEach(function(r,idx){
      var o = {};
      keys.forEach(function(k,i){if(k)o[k]=(r[i]||'').trim()});
      var iso = HD.isoDate(o.date);
      if(!iso||!o.title)return;
      var p = iso.split('-').map(Number);
      out.push({
        id: iso+'-'+slug(o.title),
        iso: iso, order: idx,
        dateObj: new Date(p[0],p[1]-1,p[2]),
        cat: o.cat||'', title: o.title, teaser: o.teaser||'',
        infos: list(o.infos,'|').map(function(x){
          var m = x.match(/^([^:]{1,60}):\s+(.+)$/);
          return m?{label:m[1].trim(),value:m[2].trim()}:{label:'',value:x};
        }),
        details: list(o.details,'|'),
        thumb: o.thumb||'', poster: o.poster||'', link: o.link||'', linktext: o.linktext||''
      });
    });
    out.sort(function(a,b){return b.iso.localeCompare(a.iso)||a.order-b.order});
    return out;
  }

  function longDate(e){return e.dateObj.getDate()+'. '+MONTHS[e.dateObj.getMonth()]+' '+e.dateObj.getFullYear()}
  function shortDate(e){return e.dateObj.getDate()+'. '+MONTHS[e.dateObj.getMonth()]}
  function pageUrl(id){return location.pathname+'?news='+encodeURIComponent(id)}

  /* Vorschaubild: eigenes Bild, sonst das Plakat (oberer Ausschnitt), sonst das goldene Logo */
  function thumbHTML(e,cls){
    var src = e.thumb||e.poster;
    if(src){
      return '<img class="'+cls+(e.poster?'':' news-thumb-photo')+'" src="'+esc(base+src)+'" alt="" width="640" height="480" loading="lazy" decoding="async"/>';
    }
    return '<span class="news-noimg"><img src="'+esc(base+'assets/logo-gold.png')+'" alt="" width="64" height="64" loading="lazy" decoding="async"/></span>';
  }

  /* ---------- Startseite: 6 Karten ---------- */
  function cardHTML(e){
    return '<a class="news-card" href="'+esc(pageUrl(e.id))+'" data-id="'+esc(e.id)+'">'+
      '<div class="news-card-img">'+thumbHTML(e,'news-thumb')+
        (e.cat?'<span class="news-card-cat">'+esc(e.cat)+'</span>':'')+
      '</div>'+
      '<div class="news-card-body">'+
        '<div class="news-card-date">'+esc(longDate(e))+'</div>'+
        '<h3 class="news-card-title">'+esc(e.title)+'</h3>'+
        '<p class="news-card-text">'+esc(e.teaser)+'</p>'+
        '<span class="link-arr">Mehr erfahren</span>'+
      '</div></a>';
  }
  function renderLatest(el){
    var latest = entries.slice(0,LATEST);
    el.innerHTML = latest.length?latest.map(cardHTML).join(''):'<p class="s-text">Derzeit gibt es keine Meldungen.</p>';
    var more = qs('#news-more');
    if(more)more.hidden = entries.length<=LATEST;
  }

  /* ---------- Archiv: nach Jahren ---------- */
  function rowHTML(e){
    return '<a class="news-row" href="'+esc(pageUrl(e.id))+'" data-id="'+esc(e.id)+'">'+
      '<div class="news-row-img">'+thumbHTML(e,'news-thumb')+'</div>'+
      '<div class="news-row-main">'+
        '<div class="news-row-meta"><span>'+esc(shortDate(e))+'</span>'+(e.cat?'<span class="news-row-cat">'+esc(e.cat)+'</span>':'')+'</div>'+
        '<h3 class="news-row-title">'+esc(e.title)+'</h3>'+
        '<p class="news-row-text">'+esc(e.teaser)+'</p>'+
      '</div>'+
      '<span class="news-row-go" aria-hidden="true">&rarr;</span></a>';
  }
  function renderArchive(el){
    var older = entries.slice(LATEST);
    if(!older.length){
      el.innerHTML = '<p class="s-text">Im Archiv befinden sich noch keine Meldungen. Sobald es mehr als sechs aktuelle Neuigkeiten gibt, wandern die älteren automatisch hierher.</p>';
      return;
    }
    var years = [];
    older.forEach(function(e){var y=e.dateObj.getFullYear();if(years.indexOf(y)<0)years.push(y)});
    years.sort(function(a,b){return b-a});

    el.innerHTML =
      '<div class="news-years" role="group" aria-label="Jahr wählen">'+
        years.map(function(y,i){
          var n = older.filter(function(e){return e.dateObj.getFullYear()===y}).length;
          return '<button type="button" class="news-year'+(i===0?' active':'')+'" data-year="'+y+'">'+y+'<span class="news-year-n">'+n+'</span></button>';
        }).join('')+
      '</div>'+
      '<div class="news-rows" id="news-rows" aria-live="polite"></div>';

    var rows = qs('#news-rows',el);
    function show(y){
      rows.innerHTML = older.filter(function(e){return e.dateObj.getFullYear()===y}).map(rowHTML).join('');
    }
    el.addEventListener('click',function(ev){
      var b = ev.target.closest('.news-year');
      if(!b)return;
      Array.prototype.forEach.call(el.querySelectorAll('.news-year'),function(x){x.classList.toggle('active',x===b)});
      show(Number(b.dataset.year));
    });
    show(years[0]);
  }

  /* ---------- Fenster ---------- */
  function linkify(text){
    return esc(text).replace(/([A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,})/g,'<a href="mailto:$1">$1</a>');
  }
  function buildDialog(){
    dialog = document.createElement('dialog');
    dialog.className = 'news-dialog';
    dialog.setAttribute('aria-labelledby','nd-title');
    dialog.innerHTML =
      '<button type="button" class="nd-close" aria-label="Schließen"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></button>'+
      '<div class="nd-layout"><div class="nd-media"></div><div class="nd-content"></div></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener('click',function(ev){if(ev.target===dialog)close()});
    dialog.addEventListener('close',function(){
      document.documentElement.classList.remove('nd-lock');
      history.replaceState(null,'',location.pathname);
      if(lastTrigger&&document.contains(lastTrigger))lastTrigger.focus();
    });
    qs('.nd-close',dialog).addEventListener('click',close);
  }
  function close(){if(dialog&&dialog.open)dialog.close()}

  function open(id,trigger){
    var e = entries.filter(function(x){return x.id===id})[0];
    if(!e)return;
    if(!dialog)buildDialog();
    lastTrigger = trigger||null;

    var media = qs('.nd-media',dialog), content = qs('.nd-content',dialog), layout = qs('.nd-layout',dialog);
    var img = e.poster||e.thumb;
    layout.classList.toggle('nd-photo',!e.poster);
    media.innerHTML = img
      ? (e.poster
          ? '<a href="'+esc(base+e.poster)+'" target="_blank" rel="noopener" title="Plakat in voller Größe öffnen" data-lightbox><img src="'+esc(base+e.poster)+'" alt="Plakat: '+esc(e.title)+'" decoding="async"/></a>'
          : '<img src="'+esc(base+e.thumb)+'" alt="" decoding="async"/>')
      : '<span class="news-noimg nd-noimg"><img src="'+esc(base+'assets/logo-gold.png')+'" alt="" width="96" height="96"/></span>';

    content.innerHTML =
      '<div class="nd-meta">'+(e.cat?'<span class="nd-cat">'+esc(e.cat)+'</span>':'')+'<span class="nd-date">'+esc(longDate(e))+'</span></div>'+
      '<h2 class="nd-title" id="nd-title">'+esc(e.title)+'</h2>'+
      '<div class="divider-g"></div>'+
      '<p class="nd-teaser">'+esc(e.teaser)+'</p>'+
      (e.infos.length?'<div class="nd-infos">'+e.infos.map(function(r){
        return '<div class="nd-info"><div class="nd-info-label">'+esc(r.label||'Info')+'</div><div class="nd-info-value">'+linkify(r.value)+'</div></div>';
      }).join('')+'</div>':'')+
      (e.details.length?'<div class="nd-details">'+e.details.map(function(p){return '<p>'+linkify(p)+'</p>'}).join('')+'</div>':'')+
      (e.link?'<div class="nd-actions"><a class="btn btn-dark" href="'+esc(base+e.link)+'">'+esc(e.linktext||'Mehr erfahren')+'</a>'+
        (e.poster?'<a class="btn btn-outline" href="'+esc(base+e.poster)+'" target="_blank" rel="noopener" data-lightbox>Plakat vergrößern</a>':'')+'</div>':'');

    content.scrollTop = 0;
    media.scrollTop = 0;
    document.documentElement.classList.add('nd-lock');
    if(!dialog.open)dialog.showModal();
    history.replaceState(null,'',pageUrl(id));
  }

  /* ---------- Start ---------- */
  function init(){
    var grid = qs('#news-grid'), archive = qs('#news-archive');
    var host = grid||archive;
    if(!host)return;
    base = host.getAttribute('data-base')||'';

    fetch(base+'data/news.csv')
      .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.text()})
      .then(function(text){
        entries = parse(text);
        if(grid)renderLatest(grid);
        if(archive)renderArchive(archive);
        var want = new URLSearchParams(location.search).get('news');
        if(want)open(want);
      })
      .catch(function(){
        host.innerHTML = '<p class="s-text">Die Neuigkeiten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>';
      });

    document.addEventListener('click',function(ev){
      var a = ev.target.closest('[data-id].news-card,[data-id].news-row');
      if(!a)return;
      if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button===1)return;
      ev.preventDefault();
      open(a.dataset.id,a);
    });
  }
  document.addEventListener('DOMContentLoaded',init);
})();
