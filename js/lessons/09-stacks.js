/* Lesson 09 — Stacks: figure wiring.
   Step generators: js/algos/09-stacks.js (VDSA.algos.stacks). Custom views and helpers: js/lessons/09-stacks-views.js.
   The three labs, the bracket flowchart and the shunting-yard figure: js/lessons/09-stacks-labs.js.
   Heavy figures start lazily as they approach the viewport; check ids are registered at load so the score total is stable. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L9 = V.lessons.l9;
  function A() { return V.algos.stacks; }
  var whenNear = L9.whenNear;
  var reduce = function () { return V.reducedMotion && V.reducedMotion(); };

  /* Register the ids of checks that live in lazily started figures. */
  ['problem-next-task', 'bracket-lab-predict', 'postfix-lab-predict', 'mono-lab-predict'].forEach(function (id) { V.quizScore.register(id); });

  function stackOf(host, opts) { return V.views.stack(host, opts); }
  function playStack(view, capacity) {
    return function (step, ctx) { view.render({ items: step.items, capacity: capacity }, { duration: ctx.duration }); };
  }
  function ops(list) {   // 'A B C - - D' -> push/pop ops
    return list.split(' ').map(function (t) { return t === '-' ? { op: 'pop' } : t === '?' ? { op: 'peek' } : { op: 'push', v: t }; });
  }

  /* ================================================================== hero teaser: plates dropping and lifting */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var view = stackOf(stage, { capacity: 4, cellSize: 38, cellWidth: 440, label: 'Plates stack animation' });
    var steps = A().scenarioSteps(ops('A B C D - - E F - - - G'), { intro: false });
    view.prepare(steps.map(function (st) { return { items: st.items, capacity: 4 }; }));
    var play = playStack(view, 4), wrapTimer = 0;
    /* End of the loop: the finished stack empties completely, then the next lap starts (no half-faded plates left hanging). */
    function render(step, ctx) {
      clearTimeout(wrapTimer);
      if (ctx.wrap && !ctx.instant) {
        view.render({ items: [], capacity: 4 }, { duration: 300 });
        wrapTimer = setTimeout(function () { play(step, ctx); }, 380);
      } else play(step, ctx);
    }
    V.teaser(stage, { steps: steps, render: render, stepMs: 620, holdMs: 1300, staticIndex: 3 });
  }

  /* ================================================================== the problem: nested unfinished work */
  var TASKS = [
    ['Write essay', 'You start writing an essay. It is your only task, so it sits at the bottom.'],
    ['Look up a date', 'You need a date, so you open a browser tab. The essay is unfinished, and waits underneath.'],
    ['Read article', 'The search result is an article. Reading it becomes the newest task; the search waits.'],
    ['Watch video', 'The article links to a video. Now three things are waiting, and the newest one is the one on screen.']
  ];
  function problemFigure() {
    var fig = V.$('#fig-problem');
    var list = TASKS.map(function (t) { return { op: 'push', v: t[0], caption: t[1] }; });
    list.push({ op: 'pop', caption: 'The video ends. You return to the <b>article</b>, the task you left most recently. Not the search, not the essay.' });
    list.push({ op: 'pop', caption: 'You finish the article. Now the search is the newest unfinished task, so you go back to it.' });
    list.push({ op: 'pop', caption: 'Search done: you have the date. The essay, the oldest task, comes back last. Every task resumed in the reverse order it was interrupted.' });
    var steps = A().scenarioSteps(list, { intro: 'Nothing is in progress yet.' });
    var view = stackOf(fig.querySelector('[data-stage]'), { cellSize: 38, cellWidth: 170, label: 'Tasks waiting, newest on top' });
    view.prepare(steps.map(function (st) { return { items: st.items }; }));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Task you are doing now' }, { state: 'default', label: 'Waiting underneath' }]);
    var player = V.player({ root: fig, steps: steps, render: playStack(view), caption: fig.querySelector('[data-caption]'), baseStepMs: 1700, label: 'Interrupted tasks' });
    player.addCheckpoint(function (st) { return st.findIndex(function (x) { return x.kind === 'pop'; }); }, function (c) {
      var below = c.prev.items[c.prev.items.length - 2].value;
      return Object.assign({ question: 'The video ends. Which task do you go back to?' }, (function () {
        var opts = ['Read article', 'Look up a date', 'Write essay'], expl = [
          'Right: the article is the task you left most recently, so it is the top of the stack once the video is popped.',
          'That task is waiting too, but it is under the article. You interrupted the article to watch the video.',
          'The essay is the oldest task. The oldest waiting task is the last to come back, not the first.'];
        return { options: opts, answer: opts.indexOf(below), explain: expl };
      }()));
    }, { id: 'problem-next-task' });
    return player;
  }

  /* ================================================================== intuition minis: push, peek, pop loops */
  function intuitionMinis() {
    var host = V.$('#mini-intuition');
    if (!host) return;
    var MINIS = [
      { title: 'push', list: 'A B C', hold: 1500, cap: '<b>push</b> puts a plate on top. It drops onto the pile; the plates below do not move.', at: 3 },
      { title: 'peek', list: 'A B C ? ?', hold: 1700, cap: '<b>peek</b> looks at the top plate without lifting it. The stack is unchanged.', at: 4 },
      { title: 'pop', list: 'A B C - -', hold: 1500, cap: '<b>pop</b> lifts the top plate off and hands it to you. The plate under it is the new top.', at: 4 }
    ];
    MINIS.forEach(function (m) {
      var stage = h('div', { class: 'mini__stage l9-mini-stage', role: 'img', 'aria-label': m.title + ' on a stack of plates, looping' });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l9-mini-title' }, m.title + '()'), stage, h('figcaption', { html: m.cap })));
      var view = stackOf(stage, { capacity: 4, cellSize: 27, cellWidth: 96, label: m.title + ' mini' });
      var steps = A().scenarioSteps(ops(m.list), { intro: false });
      view.prepare(steps.map(function (st) { return { items: st.items, capacity: 4 }; }));
      V.teaser(stage, { steps: steps, render: playStack(view, 4), stepMs: 700, holdMs: m.hold, staticIndex: m.at - 1 });
    });
  }

  /* ================================================================== playground: push, pop, peek with capacity */
  function playground() {
    var fig = V.$('#fig-playground');
    var view = stackOf(fig.querySelector('[data-stage]'), { cellSize: 38, cellWidth: 150, label: 'Stack playground' });
    var stage = fig.querySelector('[data-stage]');
    var msg = fig.querySelector('[data-msg]');
    var pushBtn = fig.querySelector('[data-push]'), popBtn = fig.querySelector('[data-pop]'), peekBtn = fig.querySelector('[data-peek]'), clearBtn = fig.querySelector('[data-clear]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { size: 'Size', top: 'Top index', capacity: 'Capacity' }, states: { size: 'frontier', top: 'active' } });
    var CAP = 5, mode = 'fixed', model, items, nid = 0, rng = V.rng(31), nextVal, timer = null;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Top' }, { state: 'compare', label: 'Peeked' }, { state: 'error', label: 'Rejected (overflow)' }]);

    function say(text, kind) { msg.innerHTML = text; msg.setAttribute('data-state', kind || 'info'); }
    function draw(extra, dur) {
      var st = { items: items.map(function (it, k) { return { id: it.id, value: it.value, state: k === items.length - 1 ? 'active' : 'default' }; }) };
      if (mode === 'fixed') st.capacity = CAP;
      if (extra && extra.peek && st.items.length) st.items[st.items.length - 1].state = 'compare';
      if (extra && extra.over) { st.items.push({ id: 'rejected', value: extra.over, state: 'error' }); st.overflow = true; }
      view.render(st, dur === undefined ? {} : { duration: dur });
      stats.update({ size: items.length, top: items.length - 1, capacity: mode === 'fixed' ? CAP : '∞' });
      popBtn.disabled = false;
      pushBtn.textContent = 'push(' + nextVal + ')';
    }
    function reset(newMode) {
      mode = newMode; clearTimeout(timer);
      model = A().StackModel(mode === 'fixed' ? CAP : null); items = []; nextVal = rng.int(10, 99);
      view.reset(); view.setOptions({ reserve: mode === 'fixed' ? 0 : 6 });
      draw(null, 0);
      say(mode === 'fixed' ? 'A fixed array of 5 slots. Push until it is full, then try one more.' : 'This stack grows as needed, so push never fails. pop on an empty stack still does.', 'info');
    }
    function settle() { clearTimeout(timer); timer = setTimeout(function () { draw(); }, 1000); }
    pushBtn.addEventListener('click', function () {
      clearTimeout(timer);
      var v = nextVal, r = model.push(v);
      if (r.ok) { items.push({ id: 'p' + (nid++), value: v }); nextVal = rng.int(10, 99); draw(); say('<code>push(' + v + ')</code> put ' + v + ' on top. Size is now ' + items.length + '.', 'ok'); }
      else { draw({ over: v }); say('<b>Overflow.</b> All ' + CAP + ' slots are taken, so there is nowhere to put ' + v + '. The push is rejected and the stack is unchanged.', 'error'); settle(); shake(); }
    });
    popBtn.addEventListener('click', function () {
      clearTimeout(timer);
      var r = model.pop();
      if (r.ok) { items.pop(); draw(); say('<code>pop()</code> removed and returned <b>' + r.value + '</b>. ' + (items.length ? 'The new top is ' + items[items.length - 1].value + '.' : 'The stack is empty again.'), 'ok'); }
      else { draw(); say('<b>Underflow.</b> <code>pop()</code> on an empty stack has nothing to return. Real code raises an error or returns nothing; it must check <code>isEmpty()</code> first.', 'error'); shake(); }
    });
    peekBtn.addEventListener('click', function () {
      clearTimeout(timer);
      var r = model.peek();
      if (r.ok) { draw({ peek: true }); say('<code>peek()</code> returned <b>' + r.value + '</b> and left it on the stack. Size is still ' + items.length + '.', 'ok'); settle(); }
      else { draw(); say('<code>peek()</code> on an empty stack has nothing to show. <code>isEmpty()</code> is <b>true</b>.', 'error'); shake(); }
    });
    clearBtn.addEventListener('click', function () { reset(mode); });
    function shake() { stage.classList.remove('is-shake'); void stage.offsetWidth; stage.classList.add('is-shake'); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Storage', value: 'fixed',
      options: [{ value: 'fixed', label: 'Fixed array (5 slots)' }, { value: 'grow', label: 'Grows as needed' }],
      onChange: reset
    });
    reset('fixed');
  }

  /* ================================================================== array-backed vs linked */
  function layoutsFigure() {
    var fig = V.$('#fig-layouts');
    var CAP = 6;
    var arr = V.views.array(fig.querySelector('[data-array]'), { mode: 'boxes', cellSize: 48, label: 'Array-backed stack: six slots and a top index' });
    var list = V.views.list(fig.querySelector('[data-list]'), { label: 'Linked stack: nodes and a head pointer', pointerStyle: 'chip', headPointer: false });
    var list0 = [{ op: 'push', v: 7 }, { op: 'push', v: 3 }, { op: 'push', v: 9 }, { op: 'pop' }, { op: 'pop' }, { op: 'push', v: 5 }, { op: 'pop' }];
    var steps = A().arrayVsLinkedSteps(list0, CAP);
    function arrState(st) {
      return { items: st.array.items, length: CAP, pointers: [{ name: 'top', index: st.array.top, state: 'active' }] };
    }
    function listState(st) {
      return { nodes: st.list.nodes.map(function (n) { return Object.assign({}, n); }), pointers: [{ name: 'head', target: st.list.head }], order: 'follow' };
    }
    arr.prepare(steps.map(arrState)); list.prepare(steps.map(listState));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Being written' }, { state: 'active', label: 'New top' }, { state: 'compare', label: 'Being returned' }, { state: 'muted', label: 'Stale: still in memory' }]);
    V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { arr.render(arrState(st), { duration: ctx.duration }); list.render(listState(st), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { size: 'Size', writes: 'Array slot writes', allocations: 'Nodes allocated' }, counterStates: { size: 'frontier' },
      baseStepMs: 1500, label: 'Array and linked stack controls'
    });
  }

  /* ================================================================== growth cost (bars) */
  function growthFigure() {
    var fig = V.$('#fig-growth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', valueLabels: false, label: 'Cost of each push into a growable array stack' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { total: 'Total steps', avg: 'Average per push', grows: 'Times it copied' }, states: { avg: 'done', grows: 'swap' } });
    var policy = 'double', n = 40;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', shape: 'square', label: 'Doubling' }, { state: 'swap', shape: 'square', label: 'Grow by 4 slots' }]);
    function update(dur) {
      var g = A().growCosts(n, policy);
      chart.render({
        categories: g.costs.map(function (_, k) { return String(k + 1); }),
        series: [{ id: 'cost', label: 'steps for this push', values: g.costs, state: policy === 'double' ? 'done' : 'swap' }],
        y: { label: 'steps for one push', min: 0, max: 64 }
      }, { duration: dur === undefined ? 500 : dur });
      stats.update({ total: g.total, avg: (g.total / n).toFixed(2), grows: g.costs.filter(function (c) { return c > 1; }).length });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'When the array is full', value: 'double',
      options: [{ value: 'double', label: 'Double the capacity' }, { value: 'plus4', label: 'Add 4 slots' }], onChange: function (v) { policy = v; update(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Pushes n', min: 8, max: 64, value: n, onInput: function (v) { n = v; update(160); } });
    update(0);
  }

  /* ================================================================== call stack figure */
  function callFigure() {
    var fig = V.$('#fig-calls');
    var view = V.views.callstack(fig.querySelector('[data-stage]'), { frameWidth: 300, label: 'Call stack for main, average and sum' });
    var steps = A().callChainSteps();
    view.prepare(steps.map(function (st) { return { frames: st.frames }; }));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Running now' }, { state: 'default', label: 'Waiting for a call to finish' }, { state: 'done', label: 'Returning' }]);
    V.player({ root: fig, steps: steps, render: function (st, ctx) { view.render({ frames: st.frames }, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1900, label: 'Call stack controls' });
  }

  /* ================================================================== two stacks: undo/redo and browser history */
  var PALETTE = ['--st-active', '--st-compare', '--st-swap', '--st-done', '--st-pivot', '--st-frontier'];
  function shapeCanvas(host) {
    var svg = s('svg', { class: 'l9-canvas', viewBox: '0 0 372 270', role: 'img', 'aria-label': 'Drawing canvas' });
    host.appendChild(svg);
    var els = {};
    function pos(k) { return { x: 34 + (k % 6) * 60, y: 50 + Math.floor(k / 6) * 76 }; }
    function shape(kind, color) {
      var c = 'var(' + PALETTE[color % PALETTE.length] + ')';
      var el = kind === 'circle' ? s('circle', { r: 20 }) : kind === 'square' ? s('rect', { x: -19, y: -19, width: 38, height: 38, rx: 6 }) : s('path', { d: 'M0 -23 L23 17 L-23 17 Z', 'stroke-linejoin': 'round' });
      el.setAttribute('class', 'l9-shape'); el.style.fill = c; el.style.stroke = c;
      return el;
    }
    return function render(snapshot) {
      var doc = snapshot.doc, keep = {};
      doc.forEach(function (it, k) {
        keep[it.id] = true;
        var p = pos(k), rec = els[it.id];
        if (!rec) {
          var g = s('g', { 'data-id': it.id }, shape(it.kind, it.color));
          svg.appendChild(g);
          V.place(g, { x: p.x, y: p.y, scale: 0.2, opacity: 0 });
          V.animate(g, { x: p.x, y: p.y, scale: 1, opacity: 1 }, { duration: 380, ease: 'out' });
          els[it.id] = { g: g };
        } else { V.animate(rec.g, { x: p.x, y: p.y, scale: 1, opacity: 1 }, { duration: 260, ease: 'out' }); }
      });
      Object.keys(els).forEach(function (id) {
        if (keep[id]) return;
        var g = els[id].g; delete els[id];
        V.animate(g, { scale: 0.2, opacity: 0 }, { duration: 260, ease: 'in' }).then(function () { if (g.parentNode) g.parentNode.removeChild(g); });
      });
      svg.querySelector('.l9-canvas__empty') || null;
      var hint = svg.querySelector('.l9-canvas__empty');
      if (!doc.length && !hint) { var t = s('text', { class: 'l9-canvas__empty', x: 186, y: 135, 'text-anchor': 'middle' }, 'empty canvas'); svg.appendChild(t); }
      else if (doc.length && hint) hint.remove();
    };
  }
  function browserCanvas(host) {
    var card = h('div', { class: 'l9-browser' },
      h('div', { class: 'l9-browser__bar' }, h('span', { class: 'l9-browser__dot' }), h('span', { class: 'l9-browser__dot' }), h('span', { class: 'l9-browser__dot' }), h('span', { class: 'l9-browser__url', 'data-url': '' })),
      h('div', { class: 'l9-browser__page', 'data-page': '' }));
    host.appendChild(card);
    var GLYPH = { Home: '⌂', News: '≣', Video: '▶', Shop: '◇', Mail: '✉' };
    return function render(snapshot) {
      var p = snapshot.doc;
      card.querySelector('[data-url]').textContent = 'example.com/' + p.toLowerCase();
      var page = card.querySelector('[data-page]');
      page.innerHTML = '<span class="l9-browser__glyph" aria-hidden="true">' + (GLYPH[p] || '·') + '</span><span class="l9-browser__title">' + V.escape(p) + '</span>';
      page.classList.remove('is-pop'); void page.offsetWidth; page.classList.add('is-pop');
    };
  }

  function twoStacks(fig, cfg) {
    var hist = A().createHistory(cfg.initial, cfg.domain);
    var stage = fig.querySelector('[data-stage]');
    var undoView = stackOf(fig.querySelector('[data-undo]'), { cellSize: 32, cellWidth: 120, reserve: 5, label: cfg.names[0] });
    var redoView = stackOf(fig.querySelector('[data-redo]'), { cellSize: 32, cellWidth: 120, reserve: 5, label: cfg.names[1] });
    var docRender = cfg.canvas(fig.querySelector('[data-doc]'));
    var msg = fig.querySelector('[data-msg]');
    var btnUndo = fig.querySelector('[data-do-undo]'), btnRedo = fig.querySelector('[data-do-redo]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { undo: cfg.names[2], redo: cfg.names[3] }, states: { undo: 'frontier', redo: 'key' } });
    var nid = 0, movedId = null;
    function plates(list, which) {
      return list.map(function (a, k) { return { id: which + a.id, value: cfg.plate(a, which), state: k === list.length - 1 && movedId === a.id ? 'active' : 'default' }; });
    }
    function sync(dur) {
      var snap = hist.snapshot();
      undoView.render({ items: plates(snap.undo, 'u'), label: undefined }, dur === undefined ? {} : { duration: dur });
      redoView.render({ items: plates(snap.redo, 'r') }, dur === undefined ? {} : { duration: dur });
      docRender(snap);
      btnUndo.disabled = !snap.undo.length; btnRedo.disabled = !snap.redo.length;
      stats.update({ undo: snap.undo.length, redo: snap.redo.length });
      cfg.actions.forEach(function (a) { a.btn.disabled = !!(a.disabled && a.disabled(snap)); });
    }
    function say(t, kind) { msg.innerHTML = t; msg.setAttribute('data-state', kind || 'info'); }
    function fly(from, to, text) {
      if (reduce() || !from || !to || !stage.animate) return;
      var sr = stage.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      var chip = h('span', { class: 'l9-fly', 'aria-hidden': 'true' }, text);
      stage.appendChild(chip);
      var ax = a.left - sr.left + a.width / 2, bx = b.left - sr.left + b.width / 2;
      var ay = a.top - sr.top + 36, by = b.top - sr.top + 36;
      var an = chip.animate([{ transform: 'translate(' + ax + 'px,' + ay + 'px) translate(-50%,-50%) scale(1)', opacity: 0.95 }, { transform: 'translate(' + (ax + bx) / 2 + 'px,' + (Math.min(ay, by) - 40) + 'px) translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.5 }, { transform: 'translate(' + bx + 'px,' + by + 'px) translate(-50%,-50%) scale(1)', opacity: 0.9 }], { duration: 480, easing: 'ease-in-out' });
      an.onfinish = function () { chip.remove(); };
    }
    function flash(view) { var el = view.el.closest('[data-flash]'); if (!el) return; el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); }

    function perform(make) {
      var snap = hist.snapshot(), action = make(snap);
      action.id = 'a' + (nid++);
      var cleared = hist.snapshot().redo.length;
      hist.do(action); movedId = action.id;
      sync();
      if (cleared) { flash(redoView); say(cfg.msgs.newAction(action) + ' ' + cfg.msgs.cleared(cleared), 'warn'); }
      else say(cfg.msgs.newAction(action), 'ok');
    }
    function undo() {
      var before = hist.snapshot(), top = before.undo[before.undo.length - 1];
      var r = hist.undo();
      if (!r.ok) { say(cfg.msgs.emptyUndo, 'error'); return; }
      movedId = r.action.id;
      fly(undoView.el, redoView.el, cfg.plate(r.action, 'r'));
      sync();
      say(cfg.msgs.undo(top), 'ok');
    }
    function redo() {
      var before = hist.snapshot(), top = before.redo[before.redo.length - 1];
      var r = hist.redo();
      if (!r.ok) { say(cfg.msgs.emptyRedo, 'error'); return; }
      movedId = r.action.id;
      fly(redoView.el, undoView.el, cfg.plate(r.action, 'u'));
      sync();
      say(cfg.msgs.redo(top), 'ok');
    }
    cfg.actions.forEach(function (a) { a.btn = fig.querySelector('[data-act="' + a.id + '"]'); a.btn.addEventListener('click', function () { perform(function (snap) { return a.make(snap, nid); }); }); });
    btnUndo.addEventListener('click', undo); btnRedo.addEventListener('click', redo);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Plate that just moved' }, { state: 'default', label: 'Waiting in the stack' }]);
    sync(0);
    say(cfg.msgs.start, 'info');
    return { hist: hist };
  }

  function undoFigure() {
    var fig = V.$('#fig-undo');
    var GL = { circle: '●', square: '■', triangle: '▲' };
    function addAction(id, kind) {
      return { id: id, make: function (snap, n) { return { type: 'add', item: { id: 's' + n, kind: kind, color: n }, label: 'add ' + GL[kind] }; },
        disabled: function (snap) { return snap.doc.length >= 12; } };
    }
    twoStacks(fig, {
      domain: A().HISTORY_DOMAINS.shapes, initial: [], canvas: shapeCanvas,
      names: ['Undo stack', 'Redo stack', 'Undo stack size', 'Redo stack size'],
      actions: [addAction('circle', 'circle'), addAction('square', 'square'), addAction('triangle', 'triangle'),
        { id: 'clear', make: function (snap) { return { type: 'clear', prev: snap.doc, label: 'clear all' }; }, disabled: function (snap) { return !snap.doc.length; } }],
      plate: function (a) { return a.label; },
      msgs: {
        start: 'Draw something. Every action is pushed on the undo stack; nothing is on the redo stack yet.',
        newAction: function (a) { return '<b>' + V.escape(a.label) + '</b> was done and pushed on the undo stack.'; },
        cleared: function (n) { return 'Because it is a new action, the ' + n + (n === 1 ? ' action' : ' actions') + ' on the redo stack are discarded: that future no longer exists.'; },
        undo: function (a) { return '<b>Undo</b> popped “' + V.escape(a.label) + '” from the undo stack, reversed it, and pushed it on the redo stack.'; },
        redo: function (a) { return '<b>Redo</b> popped “' + V.escape(a.label) + '” from the redo stack, did it again, and pushed it back on the undo stack.'; },
        emptyUndo: 'Nothing to undo: the undo stack is empty (an underflow the app avoids by disabling the button).',
        emptyRedo: 'Nothing to redo.'
      }
    });
  }

  function browserFigure() {
    var fig = V.$('#fig-browser');
    twoStacks(fig, {
      domain: A().HISTORY_DOMAINS.browser, initial: 'Home', canvas: browserCanvas,
      names: ['Back stack', 'Forward stack', 'Back stack size', 'Forward stack size'],
      actions: ['News', 'Video', 'Shop', 'Mail'].map(function (p) {
        return { id: p, make: function (snap) { return { type: 'visit', from: snap.doc, to: p, label: 'visit ' + p }; }, disabled: function (snap) { return snap.doc === p || snap.undo.length >= 8; } };
      }),
      plate: function (a, which) { return which === 'u' ? a.from : a.to; },
      msgs: {
        start: 'You are on Home. Follow a link: the page you leave goes on the back stack.',
        newAction: function (a) { return 'You moved from <b>' + V.escape(a.from) + '</b> to <b>' + V.escape(a.to) + '</b>. The page you left, ' + V.escape(a.from) + ', was pushed on the back stack.'; },
        cleared: function (n) { return 'Following a new link empties the forward stack (' + n + (n === 1 ? ' page' : ' pages') + '): those pages are no longer “forward”.'; },
        undo: function (a) { return '<b>Back</b> popped <b>' + V.escape(a.from) + '</b> from the back stack and made it the current page. The page you left, ' + V.escape(a.to) + ', went on the forward stack.'; },
        redo: function (a) { return '<b>Forward</b> popped <b>' + V.escape(a.to) + '</b> from the forward stack and went to it. ' + V.escape(a.from) + ' went back on the back stack.'; },
        emptyUndo: 'You cannot go back: the back stack is empty.', emptyRedo: 'You cannot go forward: the forward stack is empty.'
      }
    });
  }

  /* ================================================================== decision chart: does this problem want a stack? */
  var CHOOSER = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Do things nest?\n(brackets, calls)', col: 0, row: 0 },
      { id: 'a1', type: 'end', text: 'Stack\nbrackets, tags, calls', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Need undo or\n“go back”?', col: 0, row: 1 },
      { id: 'a2', type: 'end', text: 'Stack\nundo, back button', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Must the order\nbe reversed?', col: 0, row: 2 },
      { id: 'a3', type: 'end', text: 'Stack\nreverse a sequence', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Need each item’s next\nlarger value?', col: 0, row: 3 },
      { id: 'a4', type: 'end', text: 'Monotonic stack\nnext greater element', col: 1, row: 3 },
      { id: 'q5', type: 'decision', text: 'Does the oldest\nitem go first?', col: 0, row: 4 },
      { id: 'a5', type: 'end', text: 'Queue\nlesson 10', col: 1, row: 4 },
      { id: 'a6', type: 'end', text: 'Not a stack: try an\narray or a hash map', col: 0, row: 5 }
    ],
    edges: [
      { from: 'q1', to: 'a1', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'a2', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'a4', label: 'yes' }, { from: 'q4', to: 'q5', label: 'no' },
      { from: 'q5', to: 'a5', label: 'yes' }, { from: 'q5', to: 'a6', label: 'no' }
    ]
  };
  var NOTES = {
    a1: 'A stack. The newest unfinished thing is always the next one to finish: brackets, HTML tags and function calls all work this way.',
    a2: 'A stack. Undo reverses the most recent action first; a browser’s back button returns to the page you left last.',
    a3: 'A stack. Push everything, then pop everything: the order comes out reversed for free.',
    a4: 'A monotonic stack. Keep only the candidates that can still be an answer, and let each new value settle the smaller ones.',
    a5: 'A queue, not a stack: first in, first out. The next lesson builds it.',
    a6: 'Neither end-only structure fits. If you need arbitrary lookups, reach for an array or a hash map.'
  };
  function chooserFigure() {
    var fig = V.$('#fig-chooser');
    var stage = fig.querySelector('[data-stage]');
    var flow = V.views.flowchart(stage, CHOOSER, { interactive: true, decisionShape: 'hexagon', label: 'Does this problem want a stack? Decision chart', narrowWidth: 420 });
    var note = fig.querySelector('[data-note]');
    var path, taken, timers = [];
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Question now' }, { state: 'visited', label: 'Answered' }, { state: 'path', shape: 'line', label: 'Your answers' }]);
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      path = ['q1']; taken = {};
      flow.render({ active: 'q1' }, { duration: 0 });
      note.textContent = 'Answer yes or no on the chart, or try one of the situations above.'; note.removeAttribute('data-state');
    }
    function go(e, dur) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      var st = { active: e.to, visited: path.slice(0, -1), edgeStates: taken };
      if (NOTES[e.to]) st.states = (function () { var m = {}; m[e.to] = e.to === 'a6' ? 'muted' : 'found'; return m; }());
      flow.render(st, { duration: dur === undefined ? 450 : dur });
      if (NOTES[e.to]) { note.textContent = NOTES[e.to]; note.setAttribute('data-state', e.to === 'a6' ? 'warn' : 'ok'); }
    }
    flow.on('choose', function (e) { go(e); });
    var SCEN = [
      { label: 'Check that HTML tags close in order', ans: ['yes'] },
      { label: 'Undo in a text editor', ans: ['no', 'yes'] },
      { label: 'Print a word backwards', ans: ['no', 'no', 'yes'] },
      { label: 'Days until a warmer temperature', ans: ['no', 'no', 'no', 'yes'] },
      { label: 'Print jobs in arrival order', ans: ['no', 'no', 'no', 'no', 'yes'] },
      { label: 'Find a phone number by name', ans: ['no', 'no', 'no', 'no', 'no'] }
    ];
    var chips = fig.querySelector('[data-scenarios]');
    SCEN.forEach(function (sc) {
      chips.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        reset();
        var cur = 'q1';
        sc.ans.forEach(function (a, k) {
          var edge = CHOOSER.edges.filter(function (e) { return e.from === cur && e.label === a; })[0];
          var from = cur; cur = edge.to;
          var run = function () { go({ node: from, to: edge.to }, reduce() ? 0 : 450); };
          if (reduce()) run(); else timers.push(setTimeout(run, 650 * (k + 1)));
        });
      } }, sc.label));
    });
    fig.querySelector('[data-restart]').addEventListener('click', reset);
    reset();
  }

  /* ================================================================== cost: comparisons, naive vs stack */
  function monoCostFigure() {
    var fig = V.$('#fig-cost-mono');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Comparisons needed to find every next greater value, against the number of values' });
    var kind = 'decreasing', logY = false;
    var note = fig.querySelector('[data-note]');
    var cache = {};
    function series(k) {
      if (cache[k]) return cache[k];
      var naive = [], stack = [];
      for (var n = 2; n <= 60; n += 2) {
        var a, b;
        if (k === 'random') {
          a = 0; b = 0;
          for (var t = 0; t < 10; t++) {
            var rng = V.rng(n * 31 + t), arr = []; for (var i = 0; i < n; i++) arr.push(rng.int(1, 99));
            a += A().naiveCompareCount(arr); b += A().monoCompareCount(arr);
          }
          a /= 10; b /= 10;
        } else {
          var arr2 = []; for (var j = 0; j < n; j++) arr2.push(k === 'decreasing' ? n - j : j + 1);
          a = A().naiveCompareCount(arr2); b = A().monoCompareCount(arr2);
        }
        naive.push([n, a]); stack.push([n, b]);
      }
      return (cache[k] = { naive: naive, stack: stack });
    }
    function show(dur) {
      var d = series(kind), last = d.naive.length - 1;
      chart.render({
        x: { label: 'number of values n', min: 2, max: 60 },
        y: logY ? { label: 'comparisons (log scale)', scale: 'log', min: 1, max: 5000 } : { label: 'comparisons', min: 0 },
        series: [
          { id: 'naive', label: 'scan right from every value', points: d.naive, state: 'swap' },
          { id: 'stack', label: 'monotonic stack', points: d.stack, state: 'done' },
          { id: 'bound', label: '2n bound', fn: function (x) { return 2 * x; }, domain: [2, 60], state: 'muted', dashed: true }
        ],
        highlight: [{ series: 'naive', x: 60, label: String(Math.round(d.naive[last][1])) }, { series: 'stack', x: 60, label: String(Math.round(d.stack[last][1])) }]
      }, { duration: dur === undefined ? 700 : dur });
      var nv = d.naive[last][1], st = d.stack[last][1];
      note.textContent = kind === 'decreasing'
        ? 'Strictly decreasing input is the worst case for the scan: n = 60 costs ' + nv + ' comparisons, against ' + st + ' for the stack.'
        : kind === 'increasing'
          ? 'Increasing input helps the scan: each value finds its answer next door (' + nv + ' comparisons). The stack still does ' + st + ', never more than 2n.'
          : 'On random input the scan is cheap on average (' + Math.round(nv) + ' comparisons at n = 60), but it has no guarantee. The stack stays under 2n: ' + Math.round(st) + '.';
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Input', value: kind,
      options: [{ value: 'decreasing', label: 'Decreasing (worst for the scan)' }, { value: 'random', label: 'Random' }, { value: 'increasing', label: 'Increasing' }], onChange: function (v) { kind = v; show(); } });
    V.toggle(fig.querySelector('[data-log]'), { label: 'Log scale', checked: false, onChange: function (on) { logY = on; show(900); } });
    show(0);
  }

  /* ================================================================== variations: tabs with minis */
  function variations() {
    var browserStarted = false;
    function startBrowser() { if (!browserStarted) { browserStarted = true; browserFigure(); } }
    var tabs = V.tabs('#variants', { onChange: function (name) { if (name === 'browser') startBrowser(); } });
    if (tabs.value === 'browser') L9.whenNear('#fig-browser', startBrowser);
    var m = function (sel, node) { var el = V.$(sel); if (el) el.appendChild(node); };
    m('[data-mini="min-a"]', L9.stackMini([5, 3, 7, 2], { states: ['default', 'default', 'default', 'active'], label: 'Values stack: 5, 3, 7, 2', plate: 54, slots: 4 }));
    m('[data-mini="min-b"]', L9.stackMini([5, 3, 3, 2], { states: ['frontier', 'frontier', 'frontier', 'active'], label: 'Minimum stack: 5, 3, 3, 2', plate: 54, slots: 4 }));
    m('[data-mini="dfs"]', L9.stackMini(['A', 'C', 'F'], { states: ['frontier', 'frontier', 'active'], label: 'Explicit stack of nodes still to visit: A, C, F', plate: 54, slots: 4 }));
    m('[data-mini="rev-a"]', L9.stackMini(['h', 'e', 'l', 'l', 'o'], { states: ['default', 'default', 'default', 'default', 'active'], label: 'After pushing h, e, l, l, o', plate: 44, plateH: 17, slots: 5 }));
    m('[data-mini="rev-b"]', L9.stackMini([], { label: 'Empty after popping everything', plate: 44, plateH: 17, slots: 5, top: false }));
    var blocks = {
      min: 'push(x):\n  values.push(x)\n  mins.push(mins.empty() ? x : min(x, mins.top()))\npop():\n  mins.pop(); return values.pop()\ngetMin(): return mins.top()      // O(1)',
      dfs: 'const stack = [start], seen = new Set();\nwhile (stack.length) {\n  const v = stack.pop();\n  if (seen.has(v)) continue;\n  seen.add(v);\n  for (const w of graph[v]) stack.push(w);\n}',
      rev: 'const stack = [];\nfor (const ch of "hello") stack.push(ch);\nlet out = "";\nwhile (stack.length) out += stack.pop();   // "olleh"'
    };
    Object.keys(blocks).forEach(function (k) { var el = V.$('[data-code-block="' + k + '"]'); if (el) V.codeBlock(el, blocks[k], 'js'); });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-sequence', {
      question: 'Start with an empty stack and run <code>push(1)</code>, <code>push(2)</code>, <code>push(3)</code>, <code>pop()</code>, <code>push(4)</code>, <code>pop()</code>, <code>pop()</code>. What is left, bottom to top?',
      options: ['<code>[1]</code>', '<code>[1, 2]</code>', '<code>[1, 2, 4]</code>', '<code>[2, 4]</code>'],
      answer: 0,
      explain: [
        'Trace it: [1], [1, 2], [1, 2, 3], pop 3 gives [1, 2], push 4 gives [1, 2, 4], pop 4 gives [1, 2], pop 2 gives [1]. Each pop removes the newest value.',
        'That is the stack after the first <code>pop()</code> of 4. There is one more <code>pop()</code>, which removes 2.',
        'That is the stack right after <code>push(4)</code>. Two pops follow: first 4, then 2.',
        'A pop never removes the oldest value, only the newest. The 1 at the bottom can only leave last.'
      ],
      id: 'stack-sequence'
    });
    var row = V.$('#click-brackets');
    '([)]'.split('').forEach(function (ch, k) {
      row.appendChild(h('span', { class: 'l9-char', 'data-id': 'c' + k, 'data-label': 'Character ' + k + ': ' + ch }, ch));
    });
    V.clickQuiz(row, {
      el: '#quiz-click', question: 'The bracket matcher reads <code>( [ ) ]</code> from left to right. Click the character where it first reports “not balanced”.',
      answer: 'c2',
      right: 'Right. After <code>(</code> and <code>[</code> are pushed, the stack top is <code>[</code>. The closer <code>)</code> at index 2 needs <code>(</code> on top, so the matcher stops there. Every bracket has a partner, but the pairs cross instead of nesting.',
      wrong: 'Not that one. Push <code>(</code>, push <code>[</code>, and then look at what is on top when the first closer arrives.',
      id: 'click-crossing'
    });
    V.quiz('#quiz-postfix', {
      question: 'What does the postfix expression <code>8 2 3 * −</code> evaluate to?',
      options: ['2', '18', '−2', '14'],
      answer: 0,
      explain: [
        '2 × 3 = 6 is applied first, because <code>*</code> arrives when 2 and 3 are the top two values. Then 8 − 6 = 2.',
        'That is (8 − 2) × 3, which reads the tokens as if the operators came in the middle. In postfix, an operator always uses the two newest values.',
        'That subtracts in the wrong order. The value popped second (8) is the left operand: 8 − 6, not 6 − 8.',
        'That adds 6 to 8. The last token is <code>−</code>, so subtract: 8 − 6, not 8 + 6.'
      ],
      id: 'postfix-value'
    });
    V.quiz('#quiz-fit', {
      question: 'Which of these problems are a natural fit for a stack?',
      options: ['Check that the brackets in a source file nest properly', 'Serve print jobs in the order they arrived', 'Undo the most recent edit, then the one before it', 'For each day, find how many days until a warmer one', 'Find a user by their id'],
      answer: [0, 2, 3],
      explain: 'Nesting, undo and “next greater value” all revolve around the most recent unfinished thing. Print jobs are first in, first out (a queue), and a lookup by id needs direct access, not an end-only structure.',
      id: 'stack-fit'
    });
    V.quiz('#quiz-count', {
      question: 'Why is counting brackets not enough to check <code>([)]</code>?',
      options: ['It has one <code>(</code> and one <code>)</code>, one <code>[</code> and one <code>]</code>, so the counts match, but the pairs cross', 'It contains more openers than closers', 'Square brackets are not allowed inside round brackets', 'A counter cannot count past 2'],
      answer: 0,
      explain: [
        'A counter tracks how many groups are open, not <em>which</em> ones. The stack remembers which opener is the newest, and that is what the next closer must match.',
        'The counts are equal: two openers and two closers.',
        'Nesting is fine. <code>([])</code> is balanced. The problem is the order in <code>([)]</code>.',
        'Counters can count as high as memory allows. What they lack is the identity and order of the openers.'
      ],
      id: 'why-not-count'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    var tiles = [
      { svg: L9.stackMini(['a', 'b', 'c'], { states: ['default', 'default', 'active'], plate: 46, plateH: 18, slots: 3 }), label: 'Last in, first out', text: 'push, pop and peek all work on the top: O(1).' },
      { svg: L9.stackMini(['{', '('], { states: ['frontier', 'frontier'], plate: 46, plateH: 18, slots: 3 }), label: 'Nesting', text: 'Openers wait; each closer must match the newest.' },
      { svg: L9.stackMini(['5', '7'], { states: ['frontier', 'active'], plate: 46, plateH: 18, slots: 3 }), label: 'Expressions', text: 'Postfix needs no parentheses; a stack evaluates it.' },
      { svg: L9.stackMini(['+■', '+●'], { states: ['default', 'active'], plate: 46, plateH: 18, slots: 3 }), label: 'Undo and redo', text: 'Two stacks: pop one, push the other.' },
      { svg: L9.stackMini([9, 6, 3], { states: ['frontier', 'frontier', 'active'], plate: 46, plateH: 18, slots: 3, badges: ['#0', '#3', '#5'], top: false }), label: 'Monotonic stack', text: 'Values never increase upward; each index pops once.' },
      { svg: L9.stackMini(['main', 'f()', 'g()'], { states: ['default', 'default', 'active'], plate: 46, plateH: 18, slots: 3 }), label: 'The call stack', text: 'Every running program is already using one.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== start-up */
  V.ready(function () {
    heroTeaser();
    checks();
    variations();
    summaryCard();
    var start = function (sel, fn) { var el = V.$(sel); if (el) whenNear(el, fn); };
    start('#fig-problem', problemFigure);
    intuitionMinis();
    start('#fig-playground', playground);
    start('#fig-layouts', layoutsFigure);
    start('#fig-growth', growthFigure);
    start('#fig-calls', callFigure);
    start('#lab-brackets', L9.initBracketLab);
    var pf = false;
    L9.ensurePostfix = function () { if (!pf) { pf = true; L9.initPostfixLab(); } };
    start('#lab-postfix', L9.ensurePostfix);
    start('#fig-shunting', L9.initShunting);
    start('#fig-undo', undoFigure);
    start('#lab-mono', L9.initMonoLab);
    start('#fig-chooser', chooserFigure);
    start('#fig-cost-mono', monoCostFigure);
  });

  V.lessons.stacks = { A: A };
}());
