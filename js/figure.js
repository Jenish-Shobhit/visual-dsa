/* Shared, reversible lesson timeline. A frame is a complete state, never a mutation. */
(function () {
  'use strict';
  var motionPreference = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Lesson renderers can stay small and declarative. Retain their DOM nodes between
     frames so a changed highlight can transition without replacing the whole scene. */
  function snapshot(node) {
    var attributes = node.attributes ? Array.from(node.attributes).map(function (a) { return [a.name, a.value]; }) : [];
    var moving = node.nodeType === 1 && /^(circle|rect|text|line|path|g)$/i.test(node.nodeName);
    return { node: node, text: node.nodeValue, attributes: attributes, rect: moving && node.getBoundingClientRect ? node.getBoundingClientRect() : null, children: Array.from(node.childNodes).map(snapshot) };
  }
  function restore(before, after, effects) {
    var node = before.node;
    if (node.nodeType !== after.node.nodeType || node.nodeName !== after.node.nodeName) return after.node;
    if (node.nodeType === 3) { node.nodeValue = after.text; return node; }
    if (node.nodeType !== 1) return after.node;
    var oldAttributes = Object.fromEntries(before.attributes);
    var newAttributes = Object.fromEntries(after.attributes);
    Array.from(node.attributes).forEach(function (a) { if (!(a.name in newAttributes)) node.removeAttribute(a.name); });
    after.attributes.forEach(function (a) { if (node.getAttribute(a[0]) !== a[1]) node.setAttribute(a[0], a[1]); });
    var children = after.children.map(function (child, i) { return before.children[i] ? restore(before.children[i], child, effects) : child.node; });
    children.forEach(function (child, i) { if (node.childNodes[i] !== child) node.insertBefore(child, node.childNodes[i] || null); });
    while (node.childNodes.length > children.length) node.removeChild(node.lastChild);
    if (effects && node.animate) effects.push({ node: node, rect: before.rect, old: oldAttributes, next: newAttributes });
    return node;
  }

  function runEffects(effects) {
    effects.forEach(function (effect) {
      var node = effect.node;
      if (!node.isConnected) return;
      var from = {}, to = {};
      ['fill', 'stroke'].forEach(function (name) {
        if (effect.old[name] && effect.next[name] && effect.old[name] !== effect.next[name]) { from[name] = effect.old[name]; to[name] = effect.next[name]; }
      });
      if (effect.rect && effect.rect.width) {
        var rect = node.getBoundingClientRect();
        var dx = effect.rect.left - rect.left, dy = effect.rect.top - rect.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          from.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          to.transform = 'translate(0,0)';
        }
      }
      if (Object.keys(from).length) node.animate([from, to], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
      else if ((effect.old.class || '') !== (effect.next.class || '') || (effect.old['data-state'] || '') !== (effect.next['data-state'] || '')) {
        node.animate([{ opacity: .62 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      }
    });
  }

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
    var index = 0, timer = null, playing = false, destroyed = false, rendered = false;
    var play = root.querySelector('[data-play]');
    var scrub = root.querySelector('.figure-scrub');
    var speed = root.querySelector('[data-speed]');
    var listeners = [];
    var panels = Array.from(root.querySelectorAll('.figure-panel'));
    function listen(target, event, callback) { if (target) { target.addEventListener(event, callback); listeners.push([target, event, callback]); } }
    if (!root.hasAttribute('tabindex')) root.tabIndex = 0;
    root.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End Space');
    if (controls) {
      if (!play) {
        play = document.createElement('button'); play.type = 'button'; play.dataset.play = '';
        controls.insertBefore(play, reset || null);
      }
      if (!scrub) {
        scrub = document.createElement('input'); scrub.type = 'range'; scrub.min = '0'; scrub.step = '1'; scrub.className = 'figure-scrub';
        scrub.setAttribute('aria-label', 'Choose a figure step'); controls.insertBefore(scrub, count || null);
      }
      if (!speed) {
        var label = document.createElement('label'); label.className = 'figure-speed'; label.textContent = 'Speed ';
        speed = document.createElement('select'); speed.dataset.speed = ''; speed.setAttribute('aria-label', 'Playback speed');
        [.5, 1, 1.5, 2].forEach(function (rate) { var option = document.createElement('option'); option.value = String(rate); option.textContent = rate + '×'; option.selected = rate === 1; speed.appendChild(option); });
        label.appendChild(speed); controls.insertBefore(label, count || null);
      }
    }
    if (caption) { caption.setAttribute('aria-live', 'polite'); caption.setAttribute('aria-atomic', 'true'); }
    function playbackState() {
      root.dataset.playing = String(playing);
      if (play) { var label = playing ? 'Pause' : index === frames.length - 1 && frames.length > 1 ? 'Replay' : 'Play'; play.textContent = label; play.setAttribute('aria-label', label + ' the figure'); play.setAttribute('aria-pressed', String(playing)); }
      if (caption) caption.setAttribute('aria-live', playing ? 'off' : 'polite');
    }
    function stop() { window.clearTimeout(timer); timer = null; playing = false; playbackState(); }
    function show(allowMotion) {
      if (destroyed) return;
      var hasFrames = frames.length > 0;
      if (previous) previous.disabled = !hasFrames || index === 0;
      if (next) next.disabled = !hasFrames || index === frames.length - 1;
      if (reset) reset.disabled = !hasFrames || index === 0;
      if (play) play.disabled = frames.length < 2;
      if (scrub) { scrub.max = String(Math.max(0, frames.length - 1)); scrub.value = String(index); scrub.disabled = frames.length < 2; }
      if (count) count.textContent = hasFrames ? 'Step ' + (index + 1) + ' of ' + frames.length : 'No steps';
      root.style.setProperty('--figure-progress', hasFrames && frames.length > 1 ? index / (frames.length - 1) * 100 + '%' : '0%');
      if (!hasFrames) { panels.forEach(function (panel) { panel.hidden = true; }); if (caption) caption.textContent = 'No steps to display.'; playbackState(); return; }
      panels.forEach(function (panel) { panel.hidden = false; });
      var before = rendered ? panels.map(snapshot) : [];
      options.draw(frames[index], index);
      var effects = allowMotion !== false && !(motionPreference && motionPreference.matches) ? [] : null;
      before.forEach(function (state, i) { restore(state, snapshot(panels[i]), effects); });
      if (effects) runEffects(effects);
      rendered = true;
      if (caption) caption.textContent = frames[index].caption || '';
      if (scrub) scrub.setAttribute('aria-valuetext', 'Step ' + (index + 1) + ' of ' + frames.length + '. ' + (frames[index].caption || ''));
      playbackState();
      if (options.onChange) options.onChange(frames[index], index);
    }
    function go(to, allowMotion) {
      var target = Math.max(0, Math.min(frames.length - 1, Math.floor(Number(to))));
      if (!frames.length || !Number.isFinite(target) || target === index || destroyed) return;
      index = target;
      if (index === frames.length - 1) stop();
      show(allowMotion);
      if (index === frames.length - 1 && options.onComplete) options.onComplete();
    }
    function schedule() {
      window.clearTimeout(timer);
      if (!playing || destroyed) return;
      if (document.hidden) { stop(); return; }
      var rate = speed ? Number(speed.value) : 1;
      timer = window.setTimeout(function () { timer = null; go(index + 1); if (playing) schedule(); }, (options.interval || 1200) / (rate > 0 ? rate : 1));
    }
    function toggle() {
      if (playing) { stop(); return; }
      if (frames.length < 2 || destroyed) return;
      if (index === frames.length - 1) { index = 0; show(false); }
      playing = true; playbackState(); schedule();
    }
    listen(previous, 'click', function () { stop(); go(index - 1); });
    listen(next, 'click', function () { stop(); go(index + 1); });
    listen(reset, 'click', function () { stop(); go(0, false); });
    listen(play, 'click', toggle);
    listen(scrub, 'input', function () { stop(); go(scrub.value, false); });
    listen(speed, 'change', schedule);
    listen(document, 'visibilitychange', function () { if (document.hidden) stop(); });
    listen(root, 'keydown', function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key === ' ' && !/^(BUTTON|A)$/.test(event.target.tagName)) { event.preventDefault(); toggle(); return; }
      var target = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? frames.length - 1 : null;
      if (target !== null) { event.preventDefault(); stop(); go(target); }
    });
    var api = {
      go: function (to) { stop(); go(to); },
      play: function () { if (!playing) toggle(); },
      pause: stop,
      getIndex: function () { return index; },
      isPlaying: function () { return playing; },
      setFrames: function (newFrames) { stop(); frames = newFrames || []; index = 0; show(false); },
      destroy: function () { stop(); destroyed = true; listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); }); }
    };
    show(false);
    return api;
  };

  if (window.location.pathname.indexOf('/chapters/') !== -1) {
    try {
      var visited = JSON.parse(window.localStorage.getItem('visual-dsa-visited') || '[]');
      var page = window.location.pathname.split('/').pop();
      if (Array.isArray(visited) && visited.indexOf(page) === -1) { visited.push(page); window.localStorage.setItem('visual-dsa-visited', JSON.stringify(visited)); }
    } catch (error) { /* Lessons work when storage is unavailable. */ }
  }
}());
