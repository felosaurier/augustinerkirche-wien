/* ============================================================
   Augustinerkirche Wien — main.js
   Globale Logik: Navigation, mobile Menue, Sidebar-Tabs,
   Hash-Routing, Kalender-/Wochenfilter,
   Scroll-Reveal via IntersectionObserver.
   Alle Module pruefen defensiv, ob die benoetigten DOM-Knoten
   auf der jeweiligen Seite ueberhaupt existieren.
   ============================================================ */
(function(){
  'use strict';

  /* ---------- Hilfsfunktionen ---------- */
  function qs(sel,ctx){return (ctx||document).querySelector(sel)}
  function qsa(sel,ctx){return Array.prototype.slice.call((ctx||document).querySelectorAll(sel))}

  /* ---------- Dropdown-Menues (Event-Delegation) ---------- */
  function initDropdowns(){
    var nav=qs('nav');
    if(!nav)return;

    nav.addEventListener('click',function(e){
      var btn=e.target.closest('.nav-btn');
      if(!btn)return;
      var item=btn.closest('.nav-item');
      if(!item)return;
      var wasOpen=item.classList.contains('open');
      closeAllDropdowns();
      if(!wasOpen){item.classList.add('open');btn.setAttribute('aria-expanded','true')}
    });

    document.addEventListener('click',function(e){
      if(!e.target.closest('.nav-item'))closeAllDropdowns();
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')closeAllDropdowns();
    });
  }
  function closeAllDropdowns(){
    qsa('.nav-item.open').forEach(function(i){i.classList.remove('open')});
    qsa('.nav-btn[aria-expanded="true"]').forEach(function(b){b.setAttribute('aria-expanded','false')});
  }

  /* ---------- Mobile Navigation ---------- */
  function initMobileNav(){
    var burger=qs('#hamburger');
    var menu=qs('#mob-menu');
    if(!burger||!menu)return;

    burger.setAttribute('aria-expanded','false');
    burger.addEventListener('click',function(){
      var open=menu.classList.toggle('open');
      burger.setAttribute('aria-expanded',open?'true':'false');
    });

    qsa('.mob-sub',menu).forEach(function(link){
      link.addEventListener('click',function(){
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded','false');
      });
    });
  }

  /* ---------- Sidebar-Tabs ---------- */
  function activatePane(sidebar,paneId){
    if(!sidebar)return;
    var area=sidebar.nextElementSibling;
    if(!area)return;
    var pane=document.getElementById(paneId);
    if(!pane||!area.contains(pane))return false;

    qsa('.sidebar-item',sidebar).forEach(function(b){b.classList.remove('active')});
    var match=qsa('.sidebar-item',sidebar).filter(function(b){return b.dataset.pane===paneId})[0];
    if(match){
      match.classList.add('active');
      /* Horizontale Tab-Leiste (Hochformat): aktiven Reiter mittig zeigen */
      if(sidebar.scrollWidth>sidebar.clientWidth){
        sidebar.scrollTo({left:match.offsetLeft-(sidebar.clientWidth-match.offsetWidth)/2,behavior:'smooth'});
      }
    }

    qsa('.tab-pane',area).forEach(function(p){p.classList.remove('active')});
    pane.classList.add('active');
    return true;
  }

  function initSidebarTabs(){
    document.addEventListener('click',function(e){
      var btn=e.target.closest('.sidebar-item');
      if(!btn)return;
      var sidebar=btn.closest('.sidebar');
      if(!sidebar)return;
      var paneId=btn.dataset.pane;
      if(!paneId)return;
      e.preventDefault();
      if(activatePane(sidebar,paneId)){
        history.replaceState(null,'',location.pathname+'#'+paneId);
        bleedBands();
        revealObserve();
      }
    });
  }

  /* ---------- Sakramente-Band ueber die volle Bildschirmbreite ----------
     Das Band liegt im Textbereich (neben dem Seitenmenue) und wird per
     negativem Rand bis an beide Bildschirmraender gezogen. */
  function bleedBands(){
    qsa('.sakr-band-inline').forEach(function(band){
      if(!band.offsetParent)return;
      band.style.marginLeft='0px';
      band.style.width='auto';
      var left=band.getBoundingClientRect().left;
      band.style.marginLeft=(-left)+'px';
      band.style.width=document.documentElement.clientWidth+'px';
    });
  }

  /* ---------- URL-Hash-Routing ---------- */
  function routeToHash(){
    var id=location.hash.replace('#','');
    if(!id)return;
    var pane=document.getElementById(id);
    if(!pane||!pane.classList.contains('tab-pane'))return;
    var area=pane.closest('.tab-content-area');
    var sidebar=area?area.previousElementSibling:null;
    if(!sidebar)return;

    if(activatePane(sidebar,id)){
      setTimeout(function(){
        var section=sidebar.closest('.with-sidebar')||pane;
        section.scrollIntoView({behavior:'smooth',block:'start'});
      },60);
    }
  }

  /* ---------- Markiert den aktiven Navigationspunkt ---------- */
  function markCurrentNav(){
    var path=location.pathname.split('?')[0].replace(/\/+$/,'');
    var current=path.split('/').pop()||'index.html';
    qsa('.mega a, .mob-sub').forEach(function(a){
      var href=a.getAttribute('href')||'';
      var page=href.split('#')[0].split('/').pop();
      if(page&&page===current){
        a.classList.add('current');
        var navItem=a.closest('.nav-item');
        if(navItem){
          var btn=qs('.nav-btn',navItem);
          if(btn)btn.classList.add('current');
        }
      }
    });
  }

  /* ---------- Kalender- und Wochenfilter (generisch, ueber data-Attribute) ---------- */
  function initAttributeFilter(buttonSelector,rowSelector,attr){
    var buttons=qsa(buttonSelector);
    var rows=qsa(rowSelector);
    if(!buttons.length||!rows.length)return;

    buttons.forEach(function(btn){
      btn.addEventListener('click',function(){
        buttons.forEach(function(b){b.classList.remove('active')});
        btn.classList.add('active');
        var value=btn.dataset.filter;
        var showAll=(value==='alle'||value==='all');
        rows.forEach(function(row){
          row.style.display=(showAll||row.dataset[attr]===value)?'':'none';
        });
      });
    });
  }

  /* ---------- Scroll-Reveal via IntersectionObserver ---------- */
  var revealObserver=null;
  function revealObserve(){
    var targets=qsa('.reveal:not(.in)');
    if(!targets.length)return;

    if(!('IntersectionObserver' in window)){
      targets.forEach(function(el){el.classList.add('in')});
      return;
    }
    if(!revealObserver){
      revealObserver=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            entry.target.classList.add('in');
            revealObserver.unobserve(entry.target);
          }
        });
      },{threshold:0.12});
    }
    targets.forEach(function(el){revealObserver.observe(el)});
  }

  /* ---------- Sakramente: Detailauswahl (sakramente.html) ---------- */
  function initSakrItems(){
    document.addEventListener('click',function(e){
      var jump=e.target.closest('.sakr-chip[data-target]');
      if(jump){
        var target=document.getElementById(jump.dataset.target);
        if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      var item=e.target.closest('.sakr-item[data-pane],.sakr-chip[data-pane]');
      if(!item)return;
      var sidebar=qs('.sidebar');
      if(!sidebar)return;
      if(activatePane(sidebar,item.dataset.pane)){
        history.replaceState(null,'',location.pathname+'#'+item.dataset.pane);
        var section=sidebar.closest('.with-sidebar');
        if(section)section.scrollIntoView({behavior:'smooth',block:'start'});
        revealObserve();
      }
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded',function(){
    initDropdowns();
    initMobileNav();
    initSidebarTabs();
    initSakrItems();
    markCurrentNav();
    initAttributeFilter('.kal-m-btn','.kal-row','m');
    initAttributeFilter('.week-filter-btn','.week-row','day');


    routeToHash();
    bleedBands();
    window.addEventListener('resize',bleedBands);
    window.addEventListener('load',bleedBands);
    revealObserve();
  });

  window.addEventListener('hashchange',function(){routeToHash();bleedBands()});
})();
