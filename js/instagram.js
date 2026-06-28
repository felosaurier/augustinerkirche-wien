/* ============================================================
   Augustinerkirche Wien — instagram.js
   Isolierte Logik fuer die Instagram-Integration auf index.html.

   Architektur:
   - INSTAGRAM_API_ENDPOINT ist eine konfigurierbare Konstante.
     Sobald ein eigener Proxy/Serverless-Endpunkt (der das
     Instagram-Graph-API-Access-Token serverseitig haelt) zur
     Verfuegung steht, reicht es, die Konstante zu setzen.
   - Ohne konfigurierten Endpunkt rendert das Modul einen
     redaktionell gepflegten, semantisch gleichwertigen
     Fallback-Grid mit Verweis auf das echte Profil.
   - Ist ein Endpunkt konfiguriert, wird per fetch() mit Timeout
     (AbortController) geladen; bei Fehlschlag erscheint ein
     textbasierter Fehlerhinweis statt eines kaputten Layouts.
   ============================================================ */
(function(){
  'use strict';

  var INSTAGRAM_API_ENDPOINT = ''; // z.B. 'https://api.augustinerkirche.at/instagram/latest'
  var INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/augustinerkirche/';
  var FETCH_TIMEOUT_MS = 6000;
  var POST_COUNT = 8;

  function qs(sel,ctx){return (ctx||document).querySelector(sel)}

  function renderSkeleton(grid,count){
    grid.innerHTML='';
    for(var i=0;i<count;i++){
      var skel=document.createElement('div');
      skel.className='insta-skel';
      skel.setAttribute('aria-hidden','true');
      grid.appendChild(skel);
    }
  }

  function renderFallback(grid){
    grid.innerHTML='';
    var box=document.createElement('div');
    box.className='insta-fallback';
    box.innerHTML=
      '<div class="insta-fallback-title">Aktuelle Beitraege auf Instagram</div>'+
      '<p class="insta-fallback-text">Die Live-Einbindung des Instagram-Feeds erfordert ein serverseitig verwaltetes Zugriffstoken. '+
      'Bis ein eigener Proxy-Dienst eingerichtet ist, folgen Sie uns direkt auf Instagram.</p>'+
      '<a class="btn btn-dark" href="'+INSTAGRAM_PROFILE_URL+'" target="_blank" rel="noopener">Zum Instagram-Profil</a>';
    grid.appendChild(box);
  }

  function renderError(grid,message){
    grid.innerHTML='';
    var box=document.createElement('div');
    box.className='insta-error';
    box.textContent=message;
    grid.appendChild(box);
  }

  function renderPosts(grid,posts){
    grid.innerHTML='';
    posts.slice(0,POST_COUNT).forEach(function(post){
      var card=document.createElement('article');
      card.className='insta-card';

      if(post.imageUrl){
        var img=document.createElement('img');
        img.src=post.imageUrl;
        img.alt=post.caption||'Beitrag von Augustinerkirche auf Instagram';
        img.loading='lazy';
        card.appendChild(img);
      }

      var cap=document.createElement('div');
      cap.className='insta-cap';
      cap.textContent=post.caption||'';
      card.appendChild(cap);

      var link=document.createElement('a');
      link.href=post.permalink||INSTAGRAM_PROFILE_URL;
      link.target='_blank';
      link.rel='noopener';
      link.setAttribute('aria-label',post.caption||'Instagram-Beitrag oeffnen');
      card.appendChild(link);

      grid.appendChild(card);
    });
  }

  function fetchWithTimeout(url,timeoutMs){
    var controller=('AbortController' in window)?new AbortController():null;
    var timer=setTimeout(function(){if(controller)controller.abort()},timeoutMs);

    return fetch(url,{signal:controller?controller.signal:undefined})
      .then(function(res){
        clearTimeout(timer);
        if(!res.ok)throw new Error('HTTP '+res.status);
        return res.json();
      })
      .catch(function(err){
        clearTimeout(timer);
        throw err;
      });
  }

  function loadInstagramFeed(gridSelector){
    var grid=qs(gridSelector);
    if(!grid)return;

    renderSkeleton(grid,POST_COUNT);

    if(!INSTAGRAM_API_ENDPOINT){
      setTimeout(function(){renderFallback(grid)},450);
      return;
    }

    fetchWithTimeout(INSTAGRAM_API_ENDPOINT,FETCH_TIMEOUT_MS)
      .then(function(data){
        var posts=Array.isArray(data)?data:(data&&data.posts);
        if(!posts||!posts.length)throw new Error('Leere Antwort');
        renderPosts(grid,posts);
      })
      .catch(function(err){
        var isTimeout=err&&err.name==='AbortError';
        renderError(grid,isTimeout
          ? 'Die Instagram-Beitraege konnten nicht rechtzeitig geladen werden. Bitte besuchen Sie unser Profil direkt: '+INSTAGRAM_PROFILE_URL
          : 'Die Instagram-Beitraege sind derzeit nicht verfuegbar. Bitte besuchen Sie unser Profil direkt: '+INSTAGRAM_PROFILE_URL);
      });
  }

  document.addEventListener('DOMContentLoaded',function(){
    loadInstagramFeed('#insta-grid');
  });
})();
