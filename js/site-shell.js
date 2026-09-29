/* One book, one contents list. The lesson stays at the center. */
(function(){
  'use strict';
  var base=new URL('../',document.currentScript.src);
  function url(p){return new URL(p,base).href;}
  var chapters=window.DSA_CHAPTERS||[];
  var home=location.pathname===base.pathname||location.pathname===new URL('index.html',base).pathname;
  var current=chapters.find(function(c){return new URL(c.href,base).pathname===location.pathname;});
  var main=document.querySelector('main');
  document.body.classList.add('course-mode');
  var header=document.createElement('header');header.className='course-header';
  var brand=document.createElement('a');brand.className='course-brand';brand.href=url('index.html');brand.innerHTML='<span aria-hidden="true">v.</span> Visual DSA';
  var position=document.createElement('span');position.className='course-position';position.textContent=current?'Chapter '+String(current.number).padStart(2,'0')+' of 17':home?'Your dashboard':'Notes & experiments';
  var contents=document.createElement('details');contents.className='course-contents';contents.id='course-contents';
  var summary=document.createElement('summary');summary.textContent='Contents';contents.appendChild(summary);
  var nav=document.createElement('nav');nav.setAttribute('aria-label','Chapters in order');var label=document.createElement('p');label.textContent='One idea leads to the next.';nav.appendChild(label);
  chapters.forEach(function(c){var a=document.createElement('a');a.href=url(c.href);var n=document.createElement('span');n.textContent=String(c.number).padStart(2,'0');a.append(n,document.createTextNode(c.title));if(current===c)a.setAttribute('aria-current','page');nav.appendChild(a);});contents.appendChild(nav);header.append(brand,position,contents);document.body.prepend(header);
  if(main){if(!main.id)main.id='main-content';var skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Skip to content';document.body.prepend(skip);}
  function close(){contents.open=false;}
  document.addEventListener('click',function(e){if(!contents.contains(e.target))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&contents.open){close();summary.focus();}});
  if(location.hash==='#course-contents')contents.open=true;
  window.addEventListener('hashchange',function(){if(location.hash==='#course-contents')contents.open=true;});
  document.querySelectorAll('[data-explain-key]').forEach(function(field){
    var key='visual-dsa-explain-'+field.dataset.explainKey;
    var status=field.closest('.explain-back').querySelector('[data-draft-status]');
    try{field.value=localStorage.getItem(key)||'';}catch(_){if(status)status.textContent='Storage is unavailable. Copy your explanation if you want to keep it.';}
    field.addEventListener('input',function(){try{localStorage.setItem(key,field.value);if(status)status.textContent='Saved on this device.';}catch(_){if(status)status.textContent='This draft could not be saved. Copy it if you want to keep it.';}});
  });
  if(current){
    try{var visited=JSON.parse(localStorage.getItem('visual-dsa-visited')||'[]');if(!Array.isArray(visited))visited=[];var file=current.href.split('/').pop();if(!visited.includes(file))visited.push(file);localStorage.setItem('visual-dsa-visited',JSON.stringify(visited));localStorage.setItem('visual-dsa-last-lesson',file);}catch(_){}
  }
}());
