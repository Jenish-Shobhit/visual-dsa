/* Visual DSA step player: owns time for every algorithm figure.

   A figure precomputes an array of step snapshots. The player shows one step at a time and asks the
   figure's render function to draw it, animating from whatever was on screen before.

     var player = VDSA.player({
       root: '#lab',                 // figure element; controls go in its [data-controls] (or are appended)
       steps: steps,                 // [{caption, line, vars, counters, flow, …renderer state}]
       render: function (step, ctx) {…},   // ctx = {index, prev, direction, instant, duration, first, reason, player}
       code: codePanel,              // optional: code.highlight(step.line)
       vars: varsPanel,              // optional: vars.update(step.vars, step.varStates)
       caption: '[data-caption]',    // optional: innerHTML = step.caption (aria-live)
       captionText: function (step, i) {…},  // optional: computed caption HTML (replaces step.caption; the tallest one is reserved)
       views: [view | {view, state: fn(step)}],  // optional: views to prepare(); a lone array view is found automatically
       counters: '[data-counters]',  // optional: stat chips from step.counters
       flow: flowchart,              // optional: any object with highlight(id) — gets step.flow
       baseStepMs: 900, speeds: [0.25, 0.5, 1, 2, 4], speed: 1, autoplay: false, loop: false,
       onStep: function (step, index, ctx) {}
     });

   Timing rule (see logic.timing):
     interval  = baseStepMs / speed                              time between steps while playing
     duration  = min(animMs, 0.8 * baseStepMs) / speed            passed to render as ctx.duration
                 animMs defaults to min(600, 0.8 * baseStepMs)
     duration  = 0 when ctx.instant (first render, scrubbing, jumps, setSteps) or under reduced motion.
   So an animation always ends before the next step starts, at every speed. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  /* ---------------------------------------------------------------- pure logic (tested in Node) */
  var logic = {
    /* Clamp an index into [0, n-1]; -1 when there are no steps. Non-numbers become 0. */
    clamp: function (i, n) {
      if (!n || n < 1) return -1;
      i = Math.floor(Number(i));
      if (!isFinite(i)) i = i === Infinity ? n - 1 : 0;
      return Math.max(0, Math.min(n - 1, i));
    },
    direction: function (from, to) { return from < 0 ? 0 : (to > from ? 1 : to < from ? -1 : 0); },
    /* timing({baseStepMs, speed, animMs, instant, reduced}) -> {interval, duration} */
    timing: function (o) {
      var base = o.baseStepMs > 0 ? o.baseStepMs : 900;
      var speed = o.speed > 0 ? o.speed : 1;
      var cap = base * 0.8;
      var anim = o.animMs === undefined || o.animMs === null ? Math.min(600, cap) : Math.min(Math.max(0, o.animMs), cap);
      return { interval: Math.round(base / speed), duration: (o.instant || o.reduced) ? 0 : Math.round(anim / speed) };
    },
    /* Index of the speed in `speeds` closest to s. */
    nearestSpeed: function (speeds, s) {
      var best = 0;
      for (var i = 1; i < speeds.length; i++) if (Math.abs(speeds[i] - s) < Math.abs(speeds[best] - s)) best = i;
      return best;
    },
    /* The armed checkpoint that should interrupt a forward step from `from` to `to`, or null.
       Checkpoints only fire on single forward steps (next / play), never on jumps or scrubbing. */
    checkpointFor: function (checkpoints, from, to) {
      if (to !== from + 1) return null;
      for (var i = 0; i < checkpoints.length; i++) {
        var c = checkpoints[i];
        if (!c.done && c.index === to) return c;
      }
      return null;
    },
    /* Does a jump from `from` to `to` count as an animated single step? */
    isSingleStep: function (from, to) { return from >= 0 && Math.abs(to - from) === 1; }
  };

  var api = { logic: logic };
  if (!win) return api;

  var VDSA = win.VDSA = win.VDSA || {};
  var doc = win.document;
  var h = VDSA.h;

  var ICON = {
    start: '<path d="M6 5v14"/><path d="M19 5.5v13a.5.5 0 0 1-.8.4L9.5 12.4a.5.5 0 0 1 0-.8l8.7-6.5a.5.5 0 0 1 .8.4z" fill="currentColor" stroke="none"/>',
    prev: '<path d="m15 5-7 7 7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    end: '<path d="M18 5v14"/><path d="M5 5.5v13a.5.5 0 0 0 .8.4l8.7-6.5a.5.5 0 0 0 0-.8L5.8 5.1a.5.5 0 0 0-.8.4z" fill="currentColor" stroke="none"/>',
    play: '<path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4A.8.8 0 0 0 8 5.6z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>'
  };
  function icon(paths, cls) {
    var el = VDSA.s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: cls || null });
    el.innerHTML = paths;
    return el;
  }

  /* ---------------------------------------------------------------- shared keyboard routing */
  var players = [];
  var lastActive = null;
  function typing(t) {
    if (VDSA.isTyping) return VDSA.isTyping(t);
    if (!t || !t.tagName) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
    return t.tagName === 'INPUT' && ['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].indexOf((t.type || '').toLowerCase()) === -1;
  }
  function onGlobalKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (typing(t)) return;
    if (t && t.tagName === 'INPUT' && (t.type || '').toLowerCase() === 'range') return; // let the scrubber/sliders work natively
    if (doc.querySelector('dialog[open]')) return;
    var p = null;
    for (var i = players.length - 1; i >= 0; i--) if (players[i]._root.contains(t)) { p = players[i]; break; }
    var inside = !!p;
    if (!p) {
      if (t && t !== doc.body && t !== doc.documentElement) return; // focus is on some other control on the page
      p = lastActive;
      if (!p || !p._visible()) return;
    }
    if (p._pendingEl() && p._pendingEl().contains(t)) return; // answering a prediction
    if (t && t.closest && t.closest('[role="tablist"], [role="radiogroup"], .is-clickable [data-id]') && inside && (String(e.key).indexOf('Arrow') === 0 || e.key === ' ')) return;
    var interactive = inside && t !== p._root && t.closest && t.closest('button, a[href], summary, [role="button"], [role="tab"], [role="radio"]');
    var k = e.key;
    if (k === 'ArrowRight') p.next();
    else if (k === 'ArrowLeft') p.prev();
    else if (k === ' ' || k === 'Spacebar') { if (interactive) return; p.toggle(); }
    else if (k === 'k' || k === 'K') p.toggle();
    else if (k === 'Home') p.goto(0);
    else if (k === 'End') p.goto(p.steps.length - 1);
    else if (k === '+' || k === '=') p.faster();
    else if (k === '-' || k === '_') p.slower();
    else if (k === 'r' || k === 'R') p.reset();
    else return;
    lastActive = p;
    e.preventDefault();
  }
  var keyListening = false;

  /* ---------------------------------------------------------------- the player */
  VDSA.player = function (opts) {
    opts = opts || {};
    var root = VDSA.$(opts.root);
    if (!root) throw new Error('VDSA.player: root not found (' + opts.root + ')');
    function find(sel) { if (!sel) return null; if (typeof sel !== 'string') return sel; return root.querySelector(sel) || doc.querySelector(sel); }

    var steps = Array.isArray(opts.steps) ? opts.steps : [];
    var index = -1, playing = false, timer = 0, autoPaused = false, visible = true, destroyed = false;
    var speeds = (opts.speeds && opts.speeds.length ? opts.speeds : [0.25, 0.5, 1, 2, 4]).slice();
    var speedIdx = logic.nearestSpeed(speeds, opts.speed || 1);
    var baseStepMs = opts.baseStepMs || 900;
    var listeners = {};
    var checkpoints = [];
    var pending = null;
    var cpCounter = 0;

    var code = opts.code && typeof opts.code.highlight === 'function' ? opts.code : null;
    var vars = opts.vars ? (typeof opts.vars.update === 'function' ? opts.vars : (VDSA.varsPanel ? VDSA.varsPanel(find(opts.vars)) : null)) : null;
    var flow = opts.flow && typeof opts.flow.highlight === 'function' ? opts.flow : null;
    var captionEl = find(opts.caption);
    if (captionEl) { captionEl.setAttribute('aria-live', 'polite'); captionEl.setAttribute('aria-atomic', 'true'); }
    var stats = null;
    if (opts.counters) {
      var cEl = find(opts.counters);
      if (cEl && typeof cEl.update === 'function') stats = cEl;
      else if (cEl && VDSA.stats) stats = VDSA.stats(cEl, { labels: opts.counterLabels, states: opts.counterStates });
    }

    /* ---------- controls ---------- */
    function btn(cls, label, paths, fn) {
      var b = h('button', { type: 'button', class: 'player__btn ' + cls, 'aria-label': label, title: label }, icon(paths));
      b.addEventListener('click', function () { lastActive = api; fn(); });
      return b;
    }
    var btnStart = btn('player__start', 'Go to the first step (Home)', ICON.start, function () { goto(0); });
    var btnPrev = btn('player__prev', 'Step back (←)', ICON.prev, function () { prev(); });
    var btnPlay = h('button', { type: 'button', class: 'player__btn player__play', 'aria-label': 'Play (Space)', title: 'Play (Space)' },
      icon(ICON.play, 'i-play'), icon(ICON.pause, 'i-pause'), icon(ICON.replay, 'i-replay'));
    btnPlay.addEventListener('click', function () { lastActive = api; toggle(); });
    var btnNext = btn('player__next', 'Step forward (→)', ICON.next, function () { next(); });
    var btnEnd = btn('player__end', 'Go to the last step (End)', ICON.end, function () { goto(steps.length - 1); });
    var scrub = h('input', { type: 'range', class: 'range player__range', min: 0, max: 0, step: 1, value: 0, 'aria-label': 'Step' });
    var count = h('span', { class: 'player__count', 'aria-hidden': 'true' });
    var speedSel = h('select', { class: 'field select', 'aria-label': 'Playback speed', title: 'Speed (+ / −)' });
    speeds.forEach(function (s, i) { speedSel.appendChild(h('option', { value: String(i) }, (s < 1 ? String(s).replace(/^0/, '') : String(s)) + '×')); });
    speedSel.value = String(speedIdx);
    var bar = h('div', { class: 'player', role: 'group', 'aria-label': opts.label || 'Step controls' },
      h('div', { class: 'player__transport' }, btnStart, btnPrev, btnPlay, btnNext, btnEnd),
      h('div', { class: 'player__scrub' }, scrub, count),
      h('label', { class: 'player__speed' }, speedSel));
    var controlsHost = root.querySelector('[data-controls]');
    var createdHost = null;
    if (controlsHost) controlsHost.appendChild(bar);
    else { createdHost = h('div', { class: 'fig__controls' }, bar); root.appendChild(createdHost); controlsHost = createdHost; }
    if (opts.controls === false) controlsHost.hidden = true;

    scrub.addEventListener('input', function () { lastActive = api; cancelPending(); pause(); show(Number(scrub.value), 'instant', 'scrub'); });
    speedSel.addEventListener('change', function () { setSpeedIndex(Number(speedSel.value)); });

    /* ---------- events ---------- */
    function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return function () { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); }; }
    function emit(name) {
      var args = Array.prototype.slice.call(arguments, 1);
      (listeners[name] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) { console.error(e); } });
    }

    /* ---------- rendering ---------- */
    function timing(instant) {
      return logic.timing({ baseStepMs: baseStepMs, speed: speeds[speedIdx], animMs: opts.animMs, instant: instant, reduced: VDSA.reducedMotion() });
    }
    /* Caption markup for a step: opts.captionText(step, index) when given (for figures whose caption is computed rather than stored), else step.caption. */
    function capHTML(step, i) {
      if (typeof opts.captionText === 'function') {
        try { var t = opts.captionText(step, i); return t === undefined || t === null ? '' : String(t); } catch (e) { console.error(e); return ''; }
      }
      return (step && step.caption) || '';
    }
    function show(i, mode, reason) {
      if (!steps.length) { index = -1; updateUI(); return; }
      i = logic.clamp(i, steps.length);
      var from = index;
      var prevStep = from >= 0 ? steps[from] : null;
      var instant = mode === 'instant' || from < 0;
      var t = timing(instant);
      index = i;
      var step = steps[i] || {};
      var ctx = { index: i, prev: prevStep, direction: logic.direction(from, i), instant: instant, duration: t.duration, first: from < 0, reason: reason || mode, player: api };
      try { if (opts.render) opts.render(step, ctx); }
      catch (e) { console.error('[VDSA.player] render failed at step ' + i, e); }
      if (code) code.highlight(step.line === undefined ? null : step.line);
      if (vars) vars.update(step.vars || {}, step.varStates);
      if (captionEl) captionEl.innerHTML = capHTML(step, i);
      if (stats) stats.update(step.counters || {});
      if (flow) flow.highlight(step.flow === undefined ? null : step.flow, ctx);
      updateUI();
      emit('step', step, i, ctx);
      if (opts.onStep) { try { opts.onStep(step, i, ctx); } catch (e) { console.error(e); } }
      if (i === steps.length - 1 && from !== i) emit('end', step, i);
    }
    function refresh() {
      if (index < 0 || !steps[index]) return;
      var step = steps[index];
      try { if (opts.render) opts.render(step, { index: index, prev: step, direction: 0, instant: true, duration: 0, first: false, reason: 'refresh', player: api }); }
      catch (e) { console.error('[VDSA.player] render failed on refresh', e); }
    }

    function updateUI() {
      var n = steps.length, last = n - 1;
      var atEnd = n > 0 && index >= last;
      bar.classList.toggle('is-playing', playing);
      bar.classList.toggle('is-ended', atEnd);
      var label = playing ? 'Pause (Space)' : atEnd && n > 1 ? 'Replay from the first step (Space)' : 'Play (Space)';
      btnPlay.setAttribute('aria-label', label); btnPlay.title = label;
      btnStart.disabled = btnPrev.disabled = index <= 0;
      btnNext.disabled = !pending && (index >= last);
      btnEnd.disabled = index >= last;
      btnPlay.disabled = n < 2;
      scrub.max = String(Math.max(0, last));
      scrub.value = String(Math.max(0, index));
      scrub.disabled = n < 2;
      scrub.style.setProperty('--p', (last > 0 ? (100 * Math.max(0, index) / last) : 0) + '%');
      scrub.setAttribute('aria-valuetext', n ? 'Step ' + (index + 1) + ' of ' + n : 'No steps');
      count.innerHTML = n ? 'Step <b>' + (index + 1) + '</b> / ' + n : 'No steps';
      if (captionEl) captionEl.setAttribute('aria-live', playing ? 'off' : 'polite');
      root.classList.toggle('is-playing', playing);
    }

    /* ---------- time ---------- */
    function clearTimer() { if (timer) { clearTimeout(timer); timer = 0; } }
    function schedule(ms) { clearTimer(); timer = setTimeout(tick, ms === undefined ? timing(false).interval : ms); }
    function tick() {
      timer = 0;
      if (!playing || destroyed) return;
      if (index >= steps.length - 1) {
        if (opts.loop) { show(0, 'instant', 'loop'); schedule(); }
        else { pause(); }
        return;
      }
      var moved = advance(true);
      if (!playing) return;
      if (moved && index >= steps.length - 1) {
        if (opts.loop) schedule(timing(false).interval + (opts.loopDelay === undefined ? 1200 : opts.loopDelay));
        else pause();
        return;
      }
      schedule();
    }
    function play() {
      if (destroyed || playing || steps.length < 2) return;
      if (pending) { pending.resume = true; pending.ctrl.reveal(); return; }
      if (index >= steps.length - 1) show(0, 'instant', 'replay');
      playing = true; autoPaused = false;
      updateUI(); emit('play');
      schedule();
    }
    function pause() {
      clearTimer();
      if (!playing) return;
      playing = false;
      updateUI(); emit('pause');
    }
    function toggle() { if (playing) pause(); else play(); }

    /* ---------- navigation ---------- */
    function advance(fromPlay) {
      if (index >= steps.length - 1) return false;
      var target = index + 1;
      var cp = logic.checkpointFor(checkpoints, index, target);
      if (cp) { openCheckpoint(cp, target, fromPlay && playing); return false; }
      show(target, 'step', fromPlay ? 'play' : 'next');
      return true;
    }
    function next() {
      if (pending) { pending.ctrl.reveal(); return; }
      pause();
      advance(false);
    }
    function prev() { cancelPending(); pause(); if (index > 0) show(index - 1, 'step', 'prev'); }
    function goto(i, o) {
      cancelPending(); pause();
      i = logic.clamp(i, steps.length);
      var animate = (o && o.animate) || logic.isSingleStep(index, i);
      if (i !== index) show(i, animate ? 'step' : 'instant', 'goto');
    }
    function reset() { cancelPending(); pause(); checkpoints.forEach(function (c) { if (!c.permanent) c.done = false; }); if (steps.length) show(0, 'instant', 'reset'); }

    function setSpeedIndex(i) {
      speedIdx = Math.max(0, Math.min(speeds.length - 1, i));
      speedSel.value = String(speedIdx);
      if (playing) schedule();
      emit('speed', speeds[speedIdx]);
    }

    /* ---------- checkpoints ---------- */
    function resolveAt(cp) {
      var at = typeof cp.at === 'function' ? cp.at(steps) : cp.at;
      cp.index = (typeof at === 'number' && at > 0 && at < steps.length) ? Math.floor(at) : -1;
    }
    /* The prediction panel is a floating sheet hung from a zero-height anchor right under the controls (stage and caption
       stay visible). It overlays whatever follows, and may overhang the figure's bottom edge; nothing is reserved, so the
       figure never grows and there is no blank band. */
    var predSlot = null;
    function ensureSlot() {
      if (predSlot) return predSlot;
      predSlot = h('div', { class: 'predict-slot', 'data-predict': '' });
      controlsHost.parentNode.insertBefore(predSlot, controlsHost.nextSibling);
      return predSlot;
    }
    function predictHost() { return ensureSlot(); }
    function openCheckpoint(cp, target, resume) {
      var wasPlaying = playing || resume;
      pause();
      var spec = typeof cp.spec === 'function' ? cp.spec({ steps: steps, index: target, step: steps[target], prev: steps[index], player: api }) : cp.spec;
      if (!spec || !VDSA.predict) { cp.done = true; show(target, 'step', 'next'); if (wasPlaying) play(); return; }
      spec = Object.assign({ id: cp.id }, spec);
      var ctrl = VDSA.predict(predictHost(), spec);
      var mine = pending = { cp: cp, target: target, ctrl: ctrl, resume: wasPlaying };
      root.classList.add('is-predicting');
      ctrl.el.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ctrl.reveal(); } });
      updateUI();
      emit('checkpoint', spec, target);
      try {
        var pr = ctrl.el.getBoundingClientRect(), vh = window.innerHeight || 800;
        if (pr.bottom > vh - 8) {   // scroll just enough to show the whole sheet, but keep at least the lower part of the stage on screen
          var st = (root.querySelector('.fig__stage') || root).getBoundingClientRect();
          var dy = Math.min(pr.bottom - vh + 16, Math.max(0, pr.top - 100));   // keep the controls above the sheet visible
          if (st.bottom > 200) dy = Math.min(dy, Math.max(0, st.bottom - 40));
          if (dy > 1) window.scrollBy({ top: dy, behavior: 'smooth' });
        }
      } catch (e) {}
      var first = ctrl.el.querySelector('.quiz__opt');
      if (first) first.focus({ preventScroll: true });
      ctrl.promise.then(function (res) {
        if (pending !== mine) return;
        pending = null;
        root.classList.remove('is-predicting');
        if (res.cancelled) { updateUI(); return; }
        cp.done = true;
        var fromInside = root.contains(doc.activeElement) || doc.activeElement === doc.body;
        if (index === mine.target - 1) show(mine.target, 'step', 'reveal');
        else updateUI();
        if (fromInside && !bar.contains(doc.activeElement)) btnNext.disabled ? btnPlay.focus({ preventScroll: true }) : btnNext.focus({ preventScroll: true });
        emit('checkpointdone', res, mine.target);
        if (mine.resume) play();
      });
    }
    function cancelPending() {
      if (!pending) return;
      var p = pending; pending = null;
      root.classList.remove('is-predicting');
      p.ctrl.close();
      updateUI();
    }
    function addCheckpoint(at, spec, o) {
      o = o || {};
      cpCounter++;
      var cp = { at: at, spec: spec, id: o.id || (spec && spec.id) || ('cp-' + (root.id || 'fig') + '-' + cpCounter), done: false, index: -1 };
      resolveAt(cp);
      checkpoints.push(cp);
      if (VDSA.quizScore) VDSA.quizScore.register(cp.id);
      ensureSlot();
      return api;
    }

    /* ---------- steps ---------- */
    /* Give the side panels and views the whole run up front so nothing grows while playing:
       - the variables panel gets the union of every step's variable names (rows exist from step 1);
       - array views are prepare()d (tallest row stack / held lane / scale). Pass `views: [view | {view, state: fn(step)}]`
         to choose them; otherwise a lone array view inside the figure whose steps are themselves array states is used. */
    function prepareViews() {
      try { if (vars && typeof vars.prepare === 'function') vars.prepare(steps); } catch (e) { console.error(e); }
      if (!steps.length) return;
      var list = [];
      if (Array.isArray(opts.views)) list = opts.views;
      else if (opts.views === undefined && root.querySelectorAll) {
        var found = [];
        Array.prototype.forEach.call(root.querySelectorAll('svg.vz-array'), function (n) { if (n.__vdsaView) found.push(n.__vdsaView); });
        var s0 = steps[0] || {};
        if (found.length === 1 && (Array.isArray(s0.rows) || Array.isArray(s0.items))) list = found;
      }
      list.forEach(function (v) {
        var view = v && v.view ? v.view : v, map = v && typeof v.state === 'function' ? v.state : null;
        if (!view || typeof view.prepare !== 'function') return;
        try { view.prepare(map ? steps.map(map) : steps); } catch (e) { console.error(e); }
      });
    }
    /* Reserve the tallest caption of the run (at the current width) so the controls below never jump while playing. */
    var capRO = null, capW = 0;
    function reserveCaption() {
      if (!captionEl || !captionEl.parentNode) return;
      var w = captionEl.getBoundingClientRect().width;
      if (!w) return;
      capW = w;
      var probe = captionEl.cloneNode(false);
      probe.removeAttribute('id'); probe.removeAttribute('data-caption'); probe.removeAttribute('aria-live');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;min-height:0;width:' + w + 'px;';
      captionEl.parentNode.appendChild(probe);
      var seen = {}, n = 0, max = 0, stride = Math.max(1, Math.ceil(steps.length / 400));
      try {
        for (var i = 0; i < steps.length && n < 400; i += stride) {
          var c = capHTML(steps[i], i);
          if (!c || seen[c]) continue;
          seen[c] = 1; n++;
          probe.innerHTML = c;
          if (probe.offsetHeight > max) max = probe.offsetHeight;
        }
      } catch (e) {}
      captionEl.parentNode.removeChild(probe);
      captionEl.style.minHeight = max > 0 ? Math.ceil(max) + 'px' : '';
      captionEl.setAttribute('data-cap-reserved', '');
    }
    /* Captions a figure writes itself (outside step.caption) cannot be measured up front; grow the reserve the first time
       one is taller than anything seen, so each figure jumps at most once per new maximum instead of on every step. */
    var capMO = null;
    function growCaption() {
      if (capMO || !captionEl || !win.MutationObserver) return;
      capMO = new win.MutationObserver(function () {
        var hgt = captionEl.offsetHeight, cur = parseFloat(captionEl.style.minHeight) || 0;
        if (hgt > cur + 1) captionEl.style.minHeight = Math.ceil(hgt) + 'px';
      });
      capMO.observe(captionEl, { childList: true, characterData: true, subtree: true });
    }
    function watchCaption() {
      growCaption();
      if (capRO || !captionEl || !win.ResizeObserver) return;
      capRO = new win.ResizeObserver(function () { var w = captionEl.getBoundingClientRect().width; if (Math.abs(w - capW) > 1) reserveCaption(); });
      capRO.observe(captionEl);
    }
    function setSteps(newSteps, o) {
      o = o || {};
      cancelPending(); pause();
      steps = Array.isArray(newSteps) ? newSteps : [];
      prepareViews();
      reserveCaption(); watchCaption();
      checkpoints = checkpoints.filter(function (c) { return typeof c.at === 'function' || o.keepCheckpoints; });
      checkpoints.forEach(function (c) { c.done = false; resolveAt(c); });
      var start = o.keepIndex ? logic.clamp(index, steps.length) : logic.clamp(o.index || 0, steps.length);
      index = -1; // next render is a fresh start: prev = null, instant
      if (steps.length) show(start, 'instant', 'setSteps');
      else { // generators should return at least one step (e.g. "the list is empty"); clear the side panels if not
        if (captionEl) captionEl.innerHTML = '';
        if (code) code.highlight(null);
        if (vars) vars.update({});
        if (stats) stats.update({});
        updateUI();
      }
    }

    /* ---------- lifecycle ---------- */
    var autoplayPending = !!opts.autoplay && !VDSA.reducedMotion();
    function markActive() { lastActive = api; }
    root.addEventListener('pointerdown', markActive);
    root.addEventListener('focusin', markActive);
    var unVis = VDSA.onVisible(root, function (v) {
      visible = v;
      if (!v && playing) { pause(); autoPaused = true; }
      else if (v && autoPaused) { autoPaused = false; play(); }
      else if (v && autoplayPending) { autoplayPending = false; play(); }
    });
    function onDocVis() {
      if (doc.hidden && playing) { pause(); autoPaused = true; }
      else if (!doc.hidden && autoPaused && visible) { autoPaused = false; play(); }
    }
    doc.addEventListener('visibilitychange', onDocVis);
    if (!keyListening) { doc.addEventListener('keydown', onGlobalKey); keyListening = true; }

    var api = {
      play: play, pause: pause, toggle: toggle, next: next, prev: prev, goto: goto, reset: reset,
      setSteps: setSteps, addCheckpoint: addCheckpoint, refresh: refresh, on: on,
      setSpeed: function (s) { setSpeedIndex(logic.nearestSpeed(speeds, s)); },
      faster: function () { setSpeedIndex(speedIdx + 1); },
      slower: function () { setSpeedIndex(speedIdx - 1); },
      get index() { return index; },
      get steps() { return steps; },
      get step() { return steps[index] || null; },
      get playing() { return playing; },
      get speed() { return speeds[speedIdx]; },
      get root() { return root; },
      get controls() { return bar; },
      destroy: function () {
        destroyed = true; cancelPending(); pause(); if (capRO) capRO.disconnect(); if (capMO) capMO.disconnect();
        root.removeEventListener('pointerdown', markActive); root.removeEventListener('focusin', markActive);
        unVis(); doc.removeEventListener('visibilitychange', onDocVis);
        if (bar.parentNode) bar.parentNode.removeChild(bar);
        if (createdHost && createdHost.parentNode) createdHost.parentNode.removeChild(createdHost);
        players = players.filter(function (p) { return p !== api; });
        if (lastActive === api) lastActive = null;
      },
      _root: root,
      _visible: function () { return visible; },
      _pendingEl: function () { return pending ? pending.ctrl.el : null; }
    };
    players.push(api);

    prepareViews();
    reserveCaption(); watchCaption();
    if (steps.length) show(logic.clamp(opts.startAt || 0, steps.length), 'instant', 'init'); else updateUI();
    return api;
  };

  VDSA.player.logic = logic;
  return api;
}));
