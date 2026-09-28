(function () {
  'use strict';
  var root = document.getElementById('instruction-machine');
  if (!root || !window.MachineModel || !window.FigureStepper) return;
  var input = document.getElementById('machine-input');
  var error = document.getElementById('machine-error');
  var programList = document.getElementById('machine-program');
  var memoryCells = Array.from(document.querySelectorAll('#machine-memory .machine-cell'));
  var phaseLabels = Array.from(root.querySelectorAll('[data-phase]'));
  var prediction = document.getElementById('machine-guess');
  var feedback = document.getElementById('machine-feedback');
  var presetButtons = Array.from(document.querySelectorAll('[data-program]'));
  var preset = 'add', trace = null, player = null;
  var defaults = { add: 7, countdown: 4, sum: 5 };
  function hex(value) { return value.toString(16).toUpperCase().padStart(2, '0'); }
  function bits(value) { return value.toString(2).padStart(8, '0'); }
  function setText(id, value) { document.getElementById(id).textContent = String(value); }
  function buildProgram(program) {
    programList.replaceChildren();
    program.forEach(function (inst, at) {
      var line = document.createElement('li');
      var address = document.createElement('span'); address.className = 'line-address'; address.textContent = String(at).padStart(2, '0');
      var mnemonic = document.createElement('code'); mnemonic.textContent = window.MachineModel.format(inst);
      var bytes = document.createElement('small'); bytes.textContent = window.MachineModel.encode(inst).map(hex).join(' ');
      line.append(address, mnemonic, bytes);
      programList.appendChild(line);
    });
  }
  function draw(frame) {
    var active = frame.active;
    Array.from(programList.children).forEach(function (line, at) {
      var isActive = at === active && frame.phase !== 'ready';
      line.classList.toggle('is-active', isActive);
      line.classList.toggle('is-next', at === frame.pc && !isActive && frame.status !== 'halted' && frame.status !== 'limit');
      if (isActive) line.setAttribute('aria-current', 'step');
      else line.removeAttribute('aria-current');
    });
    phaseLabels.forEach(function (label) {
      var current = label.dataset.phase === frame.phase;
      label.classList.toggle('is-current', current);
      if (current) label.setAttribute('aria-current', 'step');
      else label.removeAttribute('aria-current');
    });
    setText('machine-pc', frame.pc);
    setText('machine-acc', frame.acc);
    setText('machine-executed', frame.executed);
    setText('machine-ir', frame.ir ? 'HEX  ' + frame.ir.map(hex).join(' ') : 'HEX  — —');
    setText('machine-ir-binary', frame.ir ? 'BITS ' + frame.ir.map(bits).join(' ') : 'BITS —');
    setText('machine-decoded', frame.decoded || (frame.phase === 'fetch' ? 'Encoded bytes fetched; meaning not decoded yet' : 'Waiting for fetch'));
    memoryCells.forEach(function (cell, address) {
      cell.querySelector('b').textContent = frame.memory[address];
      cell.classList.toggle('is-written', frame.lastWrite === address);
    });
    setText('machine-output', frame.output.length ? frame.output.join(' → ') : '—');
    document.getElementById('machine-output-card').classList.toggle('is-written', frame.lastOutput !== null);
    document.getElementById('machine-acc-card').classList.toggle('is-active', frame.phase === 'execute' && /^(LOAD|ADD|SUB)/.test(trace.program[active].op));
    document.getElementById('machine-pc-card').classList.toggle('is-active', frame.phase === 'execute' && /^(JZ|JNZ)$/.test(trace.program[active].op));
    document.getElementById('machine-count-card').classList.toggle('is-active', frame.phase === 'execute');
    setText('machine-zero', frame.acc === 0 ? 'A is zero' : 'A is nonzero');
    setText('machine-wrap', frame.wrapped ? 'Last arithmetic wrapped' : 'No wrap on last arithmetic');
    setText('machine-status', frame.status === 'ready' ? 'Ready' : frame.status === 'running' ? 'Running' : frame.status === 'halted' ? 'Halted' : frame.status === 'limit' ? 'Safety limit reached' : 'Program fault');
  }
  function load() {
    var raw = input.value.trim();
    var value = Number(raw);
    if (!raw || !Number.isInteger(value) || value < 0 || value > 255) {
      error.textContent = 'Enter a whole starting byte from 0 to 255.';
      return;
    }
    error.textContent = '';
    trace = window.MachineModel.run(window.MachineModel.presets(preset, value), { maxInstructions: 192 });
    buildProgram(trace.program);
    if (player) player.setFrames(trace.frames);
    else player = window.FigureStepper({ root: root, frames: trace.frames, draw: draw, interval: 850 });
    feedback.textContent = '';
    prediction.value = '';
  }
  presetButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      preset = button.dataset.program;
      presetButtons.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
      input.value = defaults[preset];
      load();
    });
  });
  document.getElementById('machine-apply').addEventListener('click', load);
  input.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); load(); } });
  input.addEventListener('input', function () { error.textContent = ''; });
  document.getElementById('machine-check').addEventListener('click', function () {
    var raw = prediction.value.trim(), guess = Number(raw), none = /^(none|no output)$/i.test(raw);
    if (!none && (!raw || !Number.isInteger(guess) || guess < 0 || guess > 255)) { feedback.textContent = 'Enter a whole byte from 0 to 255, or none.'; return; }
    var output = trace.frames[trace.frames.length - 1].output;
    if (!output.length) {
      feedback.textContent = (none ? 'Correct. ' : 'This trace has no first output. ') + (trace.status === 'limit' ? 'No output appeared before the 192-instruction limit. Try a smaller starting byte.' : 'This program produces no output for this input.');
    } else {
      feedback.textContent = !none && guess === output[0] ? 'Correct. The first output is ' + output[0] + '.' : 'The first output is ' + output[0] + '. Step to OUT to see why.';
    }
  });
  prediction.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); document.getElementById('machine-check').click(); } });
  load();
}());
