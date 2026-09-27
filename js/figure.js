/* A small, dependency-free timeline used by the lessons. Figures supply their own state and drawing. */
(function () {
  'use strict';
  var steppers = [];
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.FigureStepper = function (options) {
    var root = typeof options.root === 'string' ? document.querySelector(options.root) : options.root;
    if (!root) throw new Error('FigureStepper root was not found');
    var controls = root.querySelector('.figure-controls');
    var previous = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var reset = root.querySelector('[data-reset]');
    var caption = root.querySelector('[data-caption]');
    var count = root.querySelector('[data-count]');
    var frames = options.frames || [];
    var index = 0;
    var timer = null;
    var hovered = false;
    var play = null;
    var scrub = null;

    if (!root.hasAttribute('tabindex')) root.tabIndex = 0;
    if (controls && !controls.querySelector('[data-play]')) {
      play = document.createElement('button');
      play.type = 'button';
      play.dataset.play = '';
      play.textContent = 'Play';
      play.setAttribute('aria-label', 'Play the figure');
      controls.insertBefore(play, reset || null);
      scrub = document.createElement('input');
      scrub.type = 'range';
      scrub.min = '0';
      scrub.step = '1';
      scrub.className = 'figure-scrub';
      scrub.setAttribute('aria-label', 'Choose a figure step');
      controls.insertBefore(scrub, count || null);
    } else {
      play = root.querySelector('[data-play]');
      scrub = root.querySelector('.figure-scrub');
    }

    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (play) { play.textContent = 'Play'; play.setAttribute('aria-label', 'Play the figure'); }
    }
    function show() {
      if (!frames.length) return;
      options.draw(frames[index], index);
      if (caption) caption.textContent = frames[index].caption || '';
      if (count) count.textContent = (index + 1) + ' / ' + frames.length;
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === frames.length - 1;
      if (scrub) { scrub.max = String(Math.max(0, frames.length - 1)); scrub.value = String(index); }
      if (index === frames.length - 1) {
        stop();
        if (options.onComplete) options.onComplete();
      }
      if (options.onChange) options.onChange(frames[index], index);
    }
    function go(to) {
      var target = Math.max(0, Math.min(frames.length - 1, Number(to)));
      if (!Number.isFinite(target) || target === index) return;
      index = target;
      show();
    }
    function start() {
      if (timer !== null) { stop(); return; }
      if (index === frames.length - 1) index = 0;
      if (play) { play.textContent = 'Pause'; play.setAttribute('aria-label', 'Pause the figure'); }
      show();
      timer = window.setInterval(function () {
        if (index >= frames.length - 1) { stop(); return; }
        index += 1;
        show();
      }, reducedMotion ? 1350 : 950);
    }
    if (previous) previous.addEventListener('click', function () { stop(); go(index - 1); });
    if (next) next.addEventListener('click', function () { stop(); go(index + 1); });
    if (reset) reset.addEventListener('click', function () { stop(); index = 0; show(); });
    if (play) play.addEventListener('click', start);
    if (scrub) scrub.addEventListener('input', function () { stop(); go(scrub.value); });
    root.addEventListener('mouseenter', function () { hovered = true; });
    root.addEventListener('mouseleave', function () { hovered = false; });
    var api = {
      go: function (to) { stop(); go(to); },
      getIndex: function () { return index; },
      setFrames: function (newFrames) { stop(); frames = newFrames || []; index = 0; show(); },
      destroy: function () { stop(); var at = steppers.indexOf(api); if (at >= 0) steppers.splice(at, 1); },
      ownsKeyboard: function () { return root.contains(document.activeElement) || hovered; }
    };
    steppers.push(api);
    show();
    return api;
  };

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    var active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(active.tagName)) return;
    var owner = steppers.find(function (stepper) { return stepper.ownsKeyboard(); });
    if (!owner && steppers.length === 1) owner = steppers[0];
    if (!owner) return;
    event.preventDefault();
    owner.go(owner.getIndex() + (event.key === 'ArrowRight' ? 1 : -1));
  });

  if (window.location.pathname.indexOf('/chapters/') !== -1) {
    try {
      var visited = JSON.parse(window.localStorage.getItem('visual-dsa-visited') || '[]');
      var page = window.location.pathname.split('/').pop();
      if (visited.indexOf(page) === -1) {
        visited.push(page);
        window.localStorage.setItem('visual-dsa-visited', JSON.stringify(visited));
      }
    } catch (error) { /* Local storage may be unavailable; the lessons still work. */ }
  }
}());
