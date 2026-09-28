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
  var slots = [];
  var parked = document.createDocumentFragment();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

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
    play.setAttribute('aria-pressed', 'false');
    lab.dataset.playing = 'false';
    caption.setAttribute('aria-live', 'polite');
  }

  function schedule() {
    window.clearTimeout(timer);
    if (!playing) return;
    if (document.hidden) { stop(); return; }
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
    bars = source.map(function (item, id) {
      var bar = document.createElement('div');
      bar.className = 'sort-bar';
      bar.dataset.itemId = String(id);
      var value = document.createElement('span');
      value.className = 'sort-bar-value';
      var origin = document.createElement('small');
      origin.className = 'sort-bar-origin';
      bar.appendChild(value);
      bar.appendChild(origin);
      return bar;
    });
    slots = source.map(function () {
      var slot = document.createElement('div');
      slot.className = 'sort-slot';
      slot.style.cssText = 'position:relative;display:flex;align-items:flex-end;flex:1 1 0;min-width:0;height:100%';
      return slot;
    });
    plot.replaceChildren.apply(plot, slots);
    plot.classList.toggle('sort-bars-dense', bars.length > 18);
  }

  function render(allowMotion) {
    var frame = result.frames[position];
    var max = Math.max.apply(null, source.concat([1]));
    var lastById = Object.create(null);
    frame.items.forEach(function (item, index) { if (item) lastById[item.id] = index; });
    var oldPositions = bars.map(function (bar) {
      var rect = bar.parentNode && bar.parentNode.classList && bar.parentNode.classList.contains('sort-slot') ? bar.getBoundingClientRect() : null;
      if (bar.getAnimations) bar.getAnimations().forEach(function (animation) { animation.cancel(); });
      return rect;
    });
    frame.items.forEach(function (item, i) {
      var active = frame.active.indexOf(i) !== -1;
      var final = frame.settled.indexOf(i) !== -1;
      if (!item) {
        if (!slots[i].firstChild || !slots[i].firstChild.classList.contains('sort-gap')) {
          var gap = document.createElement('div');
          gap.className = 'sort-bar sort-gap is-gap';
          gap.style.cssText = 'width:100%;flex:none;height:18%';
          gap.textContent = '□';
          gap.setAttribute('aria-hidden', 'true');
          slots[i].replaceChildren(gap);
        }
        return;
      }
      var copied = lastById[item.id] !== i;
      var bar = copied ? bars[item.id].cloneNode(true) : bars[item.id];
      if (copied) {
        bar.removeAttribute('data-item-id');
        bar.setAttribute('aria-hidden', 'true');
        bar.style.opacity = '.38';
      }
      bar.className = 'sort-bar' + (active ? ' is-active' : final ? ' is-final' : '');
      bar.style.width = '100%';
      bar.style.flex = 'none';
      bar.style.height = Math.max(18, item.value / max * 100) + '%';
      bar.firstChild.textContent = item.value;
      bar.lastChild.textContent = '#' + (item.id + 1);
      bar.title = 'Value ' + item.value + ', originally position ' + (item.id + 1);
      slots[i].replaceChildren(bar);
    });
    if (frame.held) parked.appendChild(bars[frame.held.id]);
    if (allowMotion !== false && !(reduceMotion && reduceMotion.matches)) {
      bars.forEach(function (bar, id) {
        if (!bar.parentNode || !bar.parentNode.classList || !bar.parentNode.classList.contains('sort-slot') || !bar.animate) return;
        var to = bar.getBoundingClientRect();
        var from = oldPositions[id];
        var duration = playing ? Math.min(320, delays[Number(speed.value)] * .78) : 300;
        if (from && from.width && to.width) {
          var dx = from.left - to.left, dy = from.top - to.top;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            bar.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }], { duration: duration, easing: 'cubic-bezier(.2,.7,.2,1)' });
          }
        } else if (!from) {
          bar.animate([{ opacity: 0, transform: 'translateY(-18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: duration, easing: 'ease-out' });
        }
      });
    }
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

  function seek(index, animate) {
    stop();
    position = Math.max(0, Math.min(result.frames.length - 1, index));
    render(animate);
  }

  function load() {
    stop();
    result = SortLab.run(algorithm, source);
    position = 0;
    timeline.max = result.frames.length - 1;
    makeBars();
    render(false);
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
  reset.addEventListener('click', function () { seek(0, false); });
  play.addEventListener('click', function () {
    if (playing) { stop(); return; }
    if (position === result.frames.length - 1) position = 0;
    playing = true;
    play.textContent = 'Pause';
    play.setAttribute('aria-label', 'Pause sorting trace');
    play.setAttribute('aria-pressed', 'true');
    lab.dataset.playing = 'true';
    caption.setAttribute('aria-live', 'off');
    render();
    schedule();
  });
  timeline.addEventListener('input', function () { seek(Number(timeline.value), false); });
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
    if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); seek(position + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); seek(position - 1); }
    if (event.key === 'Home') { event.preventDefault(); seek(0); }
    if (event.key === 'End') { event.preventDefault(); seek(result.frames.length - 1); }
    if (event.key === ' ' && !/^(BUTTON|A)$/.test(event.target.tagName)) { event.preventDefault(); play.click(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

  speedValue.value = speed.value + ' / 5';
  load();
}());
