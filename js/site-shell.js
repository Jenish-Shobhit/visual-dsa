(function () {
  'use strict';
  var script = document.currentScript;
  var base = new URL('../', script.src);
  function url(path) { return new URL(path, base).href; }
  var chapters = window.DSA_CHAPTERS || [];
  var catalogue = window.DSA_CATALOGUE || chapters;
  var isStudy = location.pathname.indexOf('/studies/') !== -1;
  var current = chapters.find(function (c) { return new URL(c.href, base).pathname === location.pathname; });
  var isHome = location.pathname === base.pathname || location.pathname === new URL('index.html',base).pathname;
  var visited = [];
  try { var stored = JSON.parse(localStorage.getItem('visual-dsa-visited') || '[]'); if (Array.isArray(stored)) visited = stored; } catch (_) {}
  if(current){
    var currentFile=current.href.split('/').pop();
    if(visited.indexOf(currentFile)===-1)visited.push(currentFile);
    try{localStorage.setItem('visual-dsa-visited',JSON.stringify(visited));localStorage.setItem('visual-dsa-last-lesson',currentFile);}catch(_){}
  }
  var completed = chapters.filter(function(c){return visited.indexOf(c.href.split('/').pop()) !== -1;}).length;
  var sidebar = document.createElement('aside');
  sidebar.className = 'workspace-sidebar';
  sidebar.id = 'workspace-navigation';
  sidebar.setAttribute('aria-label','Learning workspace');
  sidebar.innerHTML = '<a class="workspace-brand" href="'+url('index.html')+'"><span class="workspace-logo" aria-hidden="true">v<span>.</span></span>visual<span class="brand-light">dsa</span></a><span class="workspace-edition">THE INTERACTIVE FIELD GUIDE</span><button class="workspace-search" type="button"><span aria-hidden="true">⌕</span> Find an idea <kbd>/</kbd></button><span class="workspace-label">YOUR WORKSPACE</span><nav class="workspace-main" aria-label="Main navigation"><a '+(isHome?'aria-current="page"':'')+' href="'+url('index.html')+'"><span aria-hidden="true">◫</span> Overview</a><a href="'+url('index.html#path')+'"><span aria-hidden="true">▤</span> Learning path <small>17</small></a><a href="'+url('studies/index.html')+'"><span aria-hidden="true">◎</span> Deep studies <small>24</small></a><a href="'+url('index.html#laboratories')+'"><span aria-hidden="true">⌘</span> Laboratories</a></nav><span class="workspace-label">'+(current?'IN THE GUIDED PATH':'START WITH THE FUNDAMENTALS')+'</span><nav class="workspace-lessons" aria-label="Guided lessons"></nav><div class="workspace-bottom"><div class="workspace-progress-label"><span>Your reading journey</span><b>'+completed+' / 17</b></div><div class="workspace-progress" role="progressbar" aria-label="Lessons opened" aria-valuemin="0" aria-valuemax="17" aria-valuenow="'+completed+'"><span style="width:'+(completed/17*100)+'%"></span></div><small>Lessons opened · saved on this device</small><a href="'+url('about.html')+'">About the guide <span aria-hidden="true">↗</span></a></div>';
  if(location.pathname.indexOf('/labs/')!==-1)sidebar.querySelector('.workspace-main a[href="'+url('index.html#laboratories')+'"]').setAttribute('aria-current','page');
  if(current)sidebar.querySelector('.workspace-main a[href="'+url('index.html#path')+'"]').setAttribute('aria-current','page');
  if(isStudy) sidebar.querySelector('.workspace-main a[href="'+url('studies/index.html')+'"]').setAttribute('aria-current','page');
  var lessonNav=sidebar.querySelector('.workspace-lessons');
  chapters.forEach(function(c){var a=document.createElement('a');a.href=url(c.href);a.innerHTML='<span>'+String(c.number).padStart(2,'0')+'</span>';a.appendChild(document.createTextNode(c.title));if(current===c)a.setAttribute('aria-current','page');lessonNav.appendChild(a);});
  document.body.prepend(sidebar);
  document.body.classList.add('has-workspace');
  var main=document.querySelector('main');
  if(main){if(!main.id)main.id='main-content';var skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Skip to content';document.body.prepend(skip);}
  var mobile=document.createElement('div');mobile.className='workspace-mobile';mobile.innerHTML='<a href="'+url('index.html')+'">visual<b>dsa</b><span>.</span></a><button type="button" aria-expanded="false" aria-controls="workspace-navigation">Menu <span aria-hidden="true">☰</span></button>';document.body.prepend(mobile);
  var menu=mobile.querySelector('button');function closeMenu(){document.body.classList.remove('navigation-open');menu.setAttribute('aria-expanded','false');}
  menu.addEventListener('click',function(){var open=document.body.classList.toggle('navigation-open');menu.setAttribute('aria-expanded',String(open));});
  sidebar.addEventListener('click',function(e){if(e.target.closest('a'))closeMenu();});
  document.addEventListener('click',function(e){if(!sidebar.contains(e.target)&&!mobile.contains(e.target))closeMenu();});
  if(current){
    var toolbar=document.createElement('nav');toolbar.className='lesson-context';toolbar.setAttribute('aria-label','Lesson context');toolbar.innerHTML='<a href="'+url('index.html#path')+'">Learning path</a><span>/</span><span>'+current.group+'</span><b>'+String(current.number).padStart(2,'0')+' / 17</b>';
    main.prepend(toolbar);
    var headings=Array.from(main.querySelectorAll('.prose h2, .figure-title'));
    if(headings.length){var contents=document.createElement('details');contents.className='lesson-contents';var summary=document.createElement('summary');summary.textContent='In this lesson · '+headings.length+' sections';contents.appendChild(summary);var links=document.createElement('div');headings.forEach(function(h,i){if(!h.id)h.id='section-'+i;var a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;links.appendChild(a);});contents.appendChild(links);var hero=main.querySelector('.chapter-hero');if(hero)hero.after(contents);}
  }
  var dialog=document.createElement('dialog');dialog.className='search-dialog';dialog.setAttribute('aria-label','Find a lesson');dialog.innerHTML='<div class="search-dialog-head"><label for="global-search">Find your next idea</label><button type="button" aria-label="Close search">Esc</button></div><input id="global-search" type="search" placeholder="Try recursion, memory, FFT, or graphs…" autocomplete="off"><div class="search-results" aria-live="polite"></div><p>Search all 41 lessons and studies. <a href="'+url('studies/index.html')+'">Browse the 24 advanced studies →</a></p>';document.body.appendChild(dialog);
  var field=dialog.querySelector('input'),results=dialog.querySelector('.search-results');
  function search(){var terms=field.value.trim().toLowerCase().split(/\s+/).filter(Boolean);var matches=catalogue.filter(function(c){var text=(c.title+' '+c.description+' '+c.group+' '+(c.keywords||'')).toLowerCase();return terms.every(function(term){return text.includes(term);});});results.replaceChildren();matches.forEach(function(c){var a=document.createElement('a');a.href=url(c.href);var title=document.createElement('strong');title.textContent=c.title+' · '+c.group;var desc=document.createElement('span');desc.textContent=c.description;a.append(title,desc);results.appendChild(a);});if(!matches.length)results.textContent='No lesson matches. Try a broader term, such as “graph” or “memory”.';}
  function openSearch(){closeMenu();search();dialog.showModal();field.focus();}
  sidebar.querySelector('.workspace-search').addEventListener('click',openSearch);document.querySelectorAll('[data-open-search]').forEach(function(b){b.addEventListener('click',openSearch);});
  field.addEventListener('input',search);dialog.querySelector('button').addEventListener('click',function(){dialog.close();});dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu();if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!e.target.isContentEditable&&!dialog.open){e.preventDefault();openSearch();}});
}());
