(function(){
  'use strict';
  var original='total = 2\ntotal = total + 3\nshow(total)';
  var source=document.getElementById('program-source'),lines=document.getElementById('program-lines'),memory=document.getElementById('program-memory'),output=document.getElementById('program-output');
  var result,player;
  function draw(f){
    Array.from(lines.children).forEach(function(li,i){li.dataset.phase=i===f.line?f.phase:'';if(i===f.line)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    memory.replaceChildren();var names=Object.keys(f.memory);
    if(!names.length){var empty=document.createElement('span');empty.className='empty-state';empty.textContent='Nothing remembered yet.';memory.appendChild(empty);}
    names.forEach(function(name){var row=document.createElement('div');row.className='memory-value'+(f.change===name?' changed':'');var key=document.createElement('code');key.textContent=name;var value=document.createElement('b');value.textContent=f.memory[name];row.append(key,value);memory.appendChild(row);});
    output.replaceChildren();if(!f.output.length){var emptyOutput=document.createElement('span');emptyOutput.className='empty-state';emptyOutput.textContent='Nothing shown yet.';output.appendChild(emptyOutput);}else f.output.forEach(function(v){var value=document.createElement('span');value.className='output-value';value.textContent=v;output.appendChild(value);});
  }
  function apply(){
    var candidate=window.traceProgram(source.value);var error=document.getElementById('program-error');
    if(candidate.error){error.textContent=candidate.error;return false;}
    error.textContent='';result=candidate;lines.replaceChildren();result.lines.forEach(function(line){var li=document.createElement('li');li.textContent=line;lines.appendChild(li);});
    if(player)player.setFrames(result.frames);else player=window.FigureStepper({root:'#program-figure',frames:result.frames,draw:draw,interval:1500});
    document.getElementById('prediction-feedback').textContent='';return true;
  }
  document.getElementById('apply-program').addEventListener('click',apply);
  document.getElementById('restore-program').addEventListener('click',function(){source.value=original;apply();});
  document.getElementById('check-output').addEventListener('click',function(){var raw=document.getElementById('output-guess').value.trim(),feedback=document.getElementById('prediction-feedback');if(!/^-?\d+$/.test(raw)){feedback.textContent='Write your predicted number first.';return;}var final=result.frames[result.frames.length-1];if(final.phase==='error'){feedback.textContent='This program stops on an error. Step through it to find the missing information.';return;}if(final.output.length!==1){feedback.textContent='This version shows '+final.output.length+' values. Step through it and notice each show() instruction.';return;}feedback.textContent=Number(raw)===final.output[0]?'Your prediction matches. Now trace the steps and explain how that number gets to output.':'Not quite. Read each line in order: what does the notebook contain when show() runs?';});
  document.querySelectorAll('[data-order-guess]').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('[data-order-guess]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});document.getElementById('order-feedback').textContent='Prediction recorded. Move the instruction, then test what happens.';});});
  document.getElementById('try-order').addEventListener('click',function(){source.value='total = 2\nshow(total)\ntotal = total + 3';apply();document.getElementById('program-experiment').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});document.querySelector('#program-figure [data-next]').focus({preventScroll:true});});
  var interpretation='number';
  function updateBits(){var value=0,weights=[];document.querySelectorAll('[data-weight]').forEach(function(button){var on=button.getAttribute('aria-pressed')==='true';button.querySelector('strong').textContent=on?'1':'0';if(on){var weight=Number(button.dataset.weight);weights.push(weight);value+=weight;}});document.getElementById('bit-rule-label').textContent=interpretation==='number'?'As a number':'As a letter';document.getElementById('bit-value').textContent=interpretation==='number'?String(value):String.fromCharCode(65+value);document.getElementById('bit-calculation').textContent=interpretation==='number'?(weights.length?weights.join(' + ')+' = '+value:'No switches are on: 0.'):'A = 0, B = 1, …, '+String.fromCharCode(65+value)+' = '+value;document.getElementById('bit-feedback').textContent=interpretation==='letter'?'The switches have not changed. We changed the agreement used to read them.':value===9?'You made 9 using 8 + 1. Now read those same bits as a letter.':'Turn switches on. Add the weights above the switches that show 1.';}
  document.querySelectorAll('[data-weight]').forEach(function(button){button.addEventListener('click',function(){button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));updateBits();});});
  document.querySelectorAll('[data-interpret]').forEach(function(button){button.addEventListener('click',function(){interpretation=button.dataset.interpret;document.querySelectorAll('[data-interpret]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});updateBits();});});
  document.getElementById('check-transfer').addEventListener('click',function(){var a=document.getElementById('transfer-memory').value.trim(),b=document.getElementById('transfer-output').value.trim(),feedback=document.getElementById('transfer-feedback');if(!/^-?\d+$/.test(a)||!/^-?\d+$/.test(b)){feedback.textContent='Predict both values before checking.';return;}feedback.textContent=Number(a)===8&&Number(b)===4?'Yes. The notebook changes to 8 after 4 has already been shown. That distinction is the whole idea.':Number(a)===8?'Your final memory is right. Now look at when show(score) runs.':'Trace the last line: it reads the remembered 4, doubles it, then writes the result.';});
  var explanation=document.getElementById('explain-code');try{explanation.value=localStorage.getItem('visual-dsa-explain-code')||'';}catch(_){}
  explanation.addEventListener('input',function(){try{localStorage.setItem('visual-dsa-explain-code',explanation.value);}catch(_){}});
  apply();updateBits();
}());
