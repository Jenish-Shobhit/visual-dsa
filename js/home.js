/* Reading position is a convenience, not a score. Works without storage too. */
(function(){
  'use strict';
  var chapters=window.DSA_CHAPTERS||[],visited=[],last='';
  try{visited=JSON.parse(localStorage.getItem('visual-dsa-visited')||'[]');if(!Array.isArray(visited))visited=[];last=localStorage.getItem('visual-dsa-last-lesson')||'';}catch(_){}
  var resume=chapters.find(function(c){return c.href.split('/').pop()===last;});
  if(resume){document.getElementById('resume-label').textContent='PICK UP WHERE YOU LEFT OFF';document.getElementById('resume-title').textContent=resume.title;document.getElementById('resume-description').textContent=resume.description;var link=document.getElementById('resume-link');link.href=resume.href;link.textContent='Continue learning →';}
  var count=0;
  document.querySelectorAll('[data-lesson]').forEach(function(a){if(visited.includes(a.dataset.lesson)){count++;var status=a.querySelector('.chapter-state');status.textContent='Opened';status.classList.add('opened');status.removeAttribute('aria-hidden');}});
  if(count){document.getElementById('reading-progress').textContent=count+' of 17 lessons opened';document.getElementById('progress-note').hidden=false;}
}());
