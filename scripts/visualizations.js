/* Interactive player for the six sorting traces. No animation can outlive a
   changed input or algorithm: every pending timer is cancelled first. */
(function () {
  'use strict';

  var lab = document.getElementById('sorting-lab');
  if (!lab) return;

  var source = [8, 3, 5, 3, 9, 1, 6, 2, 7, 5];
  var algorithm = 'insertion';
  var result = null;
  var position = 0;
  var playing = false;
  var timer = null;
  var bars = [];

  var plot = document.getElementById('sort-bars');
  var caption = document.getElementById('sort-caption');
  var count = document.getElementById('sort-count');
  var timeline = document.getElementById('sort-timeline');
  var previous = document.getElementById('sort-prev');
  var next = document.getElementById('sort-next');
  var reset = document.getElementById('sort-reset');
  var play = document.getElementById('sort-play');
  var speed = document.getElementById('sort-speed');
  var speedValue = document.getElementById('sort-speed-value');
  var size = document.getElementById('sort-size');
  var sizeValue = document.getElementById('sort-size-value');
  var edit = document.getElementById('sort-input');
  var error = document.getElementById('sort-error');
  var sequence = document.getElementById('sort-sequence');
  var held = document.getElementById('sort-held');
  var comparisons = document.getElementById('sort-comparisons');
  var writes = document.getElementById('sort-writes');
  var swaps = document.getElementById('sort-swaps');
  var title = document.getElementById('sort-algorithm-title');
  var idea = document.getElementById('sort-idea');
  var invariant = document.getElementById('sort-invariant');
  var detail = document.getElementById('sort-detail');
  var best = document.getElementById('sort-best');
  var average = document.getElementById('sort-average');
  var worst = document.getElementById('sort-worst');
  var space = document.getElementById('sort-space');
  var stable = document.getElementById('sort-stable');
  var algorithmButtons = Array.from(lab.querySelectorAll('[data-algorithm]'));
  var delays = { 1: 800, 2: 380, 3: 160, 4: 55, 5: 12 };

  function stop() {
    playing = false;
    window.clearTimeout(timer);
    timer = null;
    play.textContent = 'Play';
    play.setAttribute('aria-label', 'Play sorting trace');
    caption.setAttribute('aria-live', 'polite');
  }

  function schedule() {
    window.clearTimeout(timer);
    if (!playing) return;
    timer = window.setTimeout(function () {
      if (position >= result.frames.length - 1) { stop(); return; }
      position++;
      if (position === result.frames.length - 1) caption.setAttribute('aria-live', 'polite');
      render();
      if (position === result.frames.length - 1) stop();
      else schedule();
    }, delays[Number(speed.value)]);
  }

  function makeBars() {
    bars = source.map(function () {
      var bar = document.createElement('div');
      bar.className = 'sort-bar';
      var value = document.createElement('span');
      value.className = 'sort-bar-value';
      var origin = document.createElement('small');
      origin.className = 'sort-bar-origin';
      bar.appendChild(value);
      bar.appendChild(origin);
      return bar;
    });
    plot.replaceChildren.apply(plot, bars);
    plot.classList.toggle('sort-bars-dense', bars.length > 18);
  }

  function render() {
    var frame = result.frames[position];
    var max = Math.max.apply(null, source.concat([1]));
    frame.items.forEach(function (item, i) {
      var bar = bars[i];
      var value = bar.firstChild;
      var origin = bar.lastChild;
      var active = frame.active.indexOf(i) !== -1;
      var final = frame.settled.indexOf(i) !== -1;
      bar.className = 'sort-bar' + (active ? ' is-active' : final ? ' is-final' : '') + (item ? '' : ' is-gap');
      bar.style.height = item ? Math.max(18, item.value / max * 100) + '%' : '18%';
      value.textContent = item ? item.value : '□';
      origin.textContent = item ? '#' + (item.id + 1) : '';
      bar.title = item ? 'Value ' + item.value + ', originally position ' + (item.id + 1) : 'Open position';
    });
    var currentValues = frame.items.map(function (item) { return item ? item.value : 'gap'; });
    plot.setAttribute('aria-label', result.definition.title + ', step ' + (position + 1) + ' of ' + result.frames.length + '. Values from left to right: ' + currentValues.join(', ') + '. ' + frame.caption);
    caption.textContent = frame.caption;
    count.textContent = (position + 1) + ' / ' + result.frames.length;
    timeline.value = position;
    timeline.setAttribute('aria-valuetext', 'Step ' + (position + 1) + ' of ' + result.frames.length + ': ' + frame.caption);
    previous.disabled = position === 0;
    reset.disabled = position === 0;
    next.disabled = position === result.frames.length - 1;
    sequence.textContent = currentValues.join('  ·  ');
    held.textContent = frame.held ? 'Held aside: ' + frame.held.value + ' (original position ' + (frame.held.id + 1) + ')' : 'Held aside: none';
    comparisons.textContent = frame.comparisons;
    writes.textContent = frame.writes;
    swaps.textContent = frame.swaps;
  }

  function seek(index) {
    stop();
    position = Math.max(0, Math.min(result.frames.length - 1, index));
    render();
  }

  function load() {
    stop();
    result = SortLab.run(algorithm, source);
    position = 0;
    timeline.max = result.frames.length - 1;
    makeBars();
    render();
    var info = result.definition;
    title.textContent = info.title;
    idea.textContent = info.idea;
    invariant.textContent = info.invariant;
    detail.textContent = info.detail;
    best.textContent = info.best;
    average.textContent = info.average;
    worst.textContent = info.worst;
    space.textContent = info.space;
    stable.textContent = info.stable;
    algorithmButtons.forEach(function (button) {
      var selected = button.dataset.algorithm === algorithm;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    size.value = source.length;
    sizeValue.value = source.length;
    edit.value = source.join(', ');
    error.textContent = '';
  }

  function randomArray(length) {
    return Array.from({ length: length }, function () { return Math.floor(Math.random() * 89) + 1; });
  }

  algorithmButtons.forEach(function (button) {
    button.addEventListener('click', function () { algorithm = button.dataset.algorithm; load(); });
  });
  previous.addEventListener('click', function () { seek(position - 1); });
  next.addEventListener('click', function () { seek(position + 1); });
  reset.addEventListener('click', function () { seek(0); });
  play.addEventListener('click', function () {
    if (playing) { stop(); return; }
    if (position === result.frames.length - 1) position = 0;
    playing = true;
    play.textContent = 'Pause';
    play.setAttribute('aria-label', 'Pause sorting trace');
    caption.setAttribute('aria-live', 'off');
    render();
    schedule();
  });
  timeline.addEventListener('input', function () { seek(Number(timeline.value)); });
  speed.addEventListener('input', function () {
    speedValue.value = speed.value + ' / 5';
    schedule();
  });
  size.addEventListener('input', function () { sizeValue.value = size.value; });
  size.addEventListener('change', function () { source = randomArray(Number(size.value)); load(); });
  document.getElementById('sort-shuffle').addEventListener('click', function () { source = randomArray(source.length); load(); });
  document.getElementById('sort-reverse').addEventListener('click', function () { source = source.slice().sort(function (a, b) { return b - a; }); load(); });
  document.getElementById('sort-apply').addEventListener('click', function () {
    var raw = edit.value.trim();
    var parts = raw.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 64 || parts.some(function (part) { return !/^(?:[0-9]|[1-9][0-9])$/.test(part); })) {
      error.textContent = 'Enter 2–64 whole numbers from 0 to 99, separated by commas or spaces.';
      return;
    }
    source = parts.map(Number);
    load();
  });
  edit.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); document.getElementById('sort-apply').click(); }
  });
  lab.addEventListener('keydown', function (event) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); seek(position + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); seek(position - 1); }
  });

  speedValue.value = speed.value + ' / 5';
  load();
}());
