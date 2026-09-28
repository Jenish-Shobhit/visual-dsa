(function () {
  'use strict';
  var icons=['</>','01','↳','ƒ(x)','[ ]','∴','O(n)','▥','⌕','↔','⇥','#','↻','⑂','△','◇','Σ'];
  var cards=document.getElementById('curriculum-cards');
  var visited=[];
  try { var stored=JSON.parse(localStorage.getItem('visual-dsa-visited')||'[]');if(Array.isArray(stored))visited=stored; } catch (_) {}
  window.DSA_CHAPTERS.forEach(function(c,i){
    var a=document.createElement('a');a.className='curriculum-card';a.href=c.href;a.dataset.group=c.group;
    var opened=visited.indexOf(c.href.split('/').pop())!==-1;
    var top=document.createElement('div');top.className='card-top';var icon=document.createElement('span');icon.className='card-icon';icon.setAttribute('aria-hidden','true');icon.textContent=icons[i];var number=document.createElement('span');number.className='card-number';number.textContent=String(c.number).padStart(2,'0');top.append(icon,number);
    var title=document.createElement('h3');title.textContent=c.title;var description=document.createElement('p');description.textContent=c.description;
    var bottom=document.createElement('div');bottom.className='card-bottom';var time=document.createElement('span');time.textContent=c.group.toUpperCase()+' · ~'+c.minutes+' MIN';var arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';if(opened){arrow.className='visited';arrow.textContent='Opened ✓';arrow.removeAttribute('aria-hidden');}bottom.append(time,arrow);a.append(top,title,description,bottom);cards.appendChild(a);
  });
  document.querySelectorAll('[data-filter]').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});cards.querySelectorAll('a').forEach(function(a){a.hidden=button.dataset.filter!=='All'&&a.dataset.group!==button.dataset.filter;});});});
  var last=visited[visited.length-1];try{last=localStorage.getItem('visual-dsa-last-lesson')||last;}catch(_){}var resume=window.DSA_CHAPTERS.find(function(c){return c.href.split('/').pop()===last;});
  if(resume){var start=document.getElementById('start-learning');start.href=resume.href;start.firstChild.textContent='Continue learning ';start.setAttribute('aria-label','Continue learning: '+resume.title);}
  var values=[3,7,12,19,24,31,42,56],target=document.getElementById('search-demo-target');
  var board=document.getElementById('search-demo-array'),lab=document.getElementById('home-search-lab');
  var prev=document.getElementById('search-demo-prev'),next=document.getElementById('search-demo-next'),play=document.getElementById('search-demo-play'),scrub=document.getElementById('search-demo-scrub');
  var at=0,frames=[],timer=null;
  values.forEach(function(v,i){var cell=document.createElement('div');cell.className='demo-cell';cell.innerHTML='<b>'+v+'</b><small>'+i+'</small>';board.appendChild(cell);});
  function stop(){if(timer!==null)clearInterval(timer);timer=null;play.innerHTML='Play <span aria-hidden="true">▶</span>';play.setAttribute('aria-pressed','false');}
  function draw(){
    var f=frames[at];board.setAttribute('role','img');board.setAttribute('aria-label','Sorted array: '+values.map(function(v,i){return v+' at index '+i+', '+(f.result===i?'found':i===f.mid?'checking':i<f.low||i>f.high?'ruled out':'possible');}).join('; '));Array.from(board.children).forEach(function(cell,i){cell.dataset.state=f.result===i?'found':i===f.mid?'current':i<f.low||i>f.high?'discarded':'possible';cell.setAttribute('aria-label','Index '+i+', value '+values[i]+', '+cell.dataset.state);});
    document.getElementById('search-demo-caption').textContent=f.caption;
    document.getElementById('search-demo-comparisons').textContent=f.comparisons;
    document.getElementById('search-demo-remaining').textContent=f.result>=0&&f.result!==null?1:Math.max(0,f.high-f.low+1);
    document.getElementById('search-demo-count').textContent=String(at+1).padStart(2,'0')+' / '+String(frames.length).padStart(2,'0');
    document.querySelectorAll('#search-demo-code li').forEach(function(line,i){line.classList.toggle('active',i===f.line);});
    prev.disabled=at===0;next.disabled=at===frames.length-1;scrub.max=frames.length-1;scrub.value=at;scrub.setAttribute('aria-valuetext','Step '+(at+1)+' of '+frames.length+': '+f.caption);
    if(at===frames.length-1)stop();
  }
  function reset(){stop();at=0;frames=window.binarySearchTrace(values,Number(target.value));draw();}
  function go(n){stop();at=Math.max(0,Math.min(frames.length-1,n));draw();}
  function togglePlay(){if(timer!==null){stop();return;}if(at===frames.length-1)at=0;draw();play.innerHTML='Pause <span aria-hidden="true">Ⅱ</span>';play.setAttribute('aria-pressed','true');timer=setInterval(function(){at++;draw();},1600);}
  target.addEventListener('change',reset);prev.addEventListener('click',function(){go(at-1);});next.addEventListener('click',function(){go(at+1);});play.addEventListener('click',togglePlay);document.getElementById('search-demo-reset').addEventListener('click',reset);scrub.addEventListener('input',function(){go(Number(scrub.value));});
  lab.addEventListener('keydown',function(e){if(/INPUT|SELECT|BUTTON|SUMMARY/.test(e.target.tagName))return;if(e.key==='ArrowRight'){e.preventDefault();go(at+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(at-1);}if(e.key===' '){e.preventDefault();togglePlay();}});
  document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});
  reset();
}());
