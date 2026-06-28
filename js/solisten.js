/* ============================================================
   Augustinerkirche Wien — solisten.js
   Isolierte Logik fuer die vollstaendige Solistenliste auf
   musik.html. Laedt data/solisten.json und erlaubt Sortierung
   alphabetisch (nach Nachname) oder nach Stimmlage.
   ============================================================ */
(function(){
  'use strict';

  var DATA_URL = '../data/solisten.json';
  var VOICE_ORDER = ['Sopran','Mezzosopran','Alt','Altus','Tenor','Bariton','Bass'];

  function qs(sel){return document.querySelector(sel)}

  function cardHTML(p){
    var name = p.name + (p.deceased ? ' †' : '');
    return '<div class="person-card-wide compact">'+
      '<img src="../'+p.image+'" alt="'+name+'" loading="lazy"/>'+
      '<div class="person-body">'+
        '<div class="person-name">'+name+'</div>'+
        '<div class="person-role">'+p.voice+'</div>'+
      '</div>'+
    '</div>';
  }

  function render(list, container){
    container.innerHTML = list.map(cardHTML).join('');
  }

  function sortAlpha(data){
    return data.slice().sort(function(a,b){return a.surname.localeCompare(b.surname,'de')});
  }
  function sortVoice(data){
    return data.slice().sort(function(a,b){
      var ai = VOICE_ORDER.indexOf(a.voice), bi = VOICE_ORDER.indexOf(b.voice);
      if(ai===-1)ai=99;
      if(bi===-1)bi=99;
      if(ai!==bi)return ai-bi;
      return a.surname.localeCompare(b.surname,'de');
    });
  }

  function init(){
    var container = qs('#solisten-list');
    var sortAlphaBtn = qs('#solisten-sort-alpha');
    var sortVoiceBtn = qs('#solisten-sort-voice');
    var status = qs('#solisten-status');
    if(!container)return;

    fetch(DATA_URL)
      .then(function(res){
        if(!res.ok)throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(function(data){
        if(!Array.isArray(data)||!data.length)throw new Error('Leere Liste');

        if(status)status.textContent = data.length + ' Sängerinnen und Sänger';

        render(sortAlpha(data), container);
        if(sortAlphaBtn)sortAlphaBtn.classList.add('active');

        if(sortAlphaBtn){
          sortAlphaBtn.addEventListener('click', function(){
            render(sortAlpha(data), container);
            sortAlphaBtn.classList.add('active');
            if(sortVoiceBtn)sortVoiceBtn.classList.remove('active');
          });
        }
        if(sortVoiceBtn){
          sortVoiceBtn.addEventListener('click', function(){
            render(sortVoice(data), container);
            sortVoiceBtn.classList.add('active');
            if(sortAlphaBtn)sortAlphaBtn.classList.remove('active');
          });
        }
      })
      .catch(function(){
        container.innerHTML = '<p class="s-text">Die Solistenliste konnte nicht geladen werden.</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
