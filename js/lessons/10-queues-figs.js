/* Lesson 10 — the mechanism figures: the problem, the four operations, shifting vs front index, ring index arithmetic,
   linked queue, deque playground, stack vs queue, two stacks, BFS preview, real-use minis, decision diagram, cost charts.
   Step generators: js/algos/10-queues.js (VDSA.algos.queues). Helpers: js/lessons/10-queues-views.js.
   Started (lazily) by js/lessons/10-queues.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L10 = V.lessons.l10;
  function Q() { return V.algos.queues; }
  var fmt = L10.fmt;

  /* ================================================================== the problem: a ticket line you control */
  L10.initLine = function () {
    var fig = V.$('#fig-line');
    var view = L10.ticketLine(fig.querySelector('[data-stage]'), { label: 'A ticket line you control' });
    var msg = fig.querySelector('[data-msg]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { waiting: 'Waiting', served: 'Served', longest: 'Longest wait so far (ticks)' }, states: { longest: 'error' } });
    var line, n, tick, served, longestServed, lastServed, newestFirst = false;
    function reset() {
      line = [{ id: 'p1', n: 1, at: 1 }, { id: 'p2', n: 2, at: 2 }, { id: 'p3', n: 3, at: 3 }];
      n = 3; tick = 3; served = 0; longestServed = 0; lastServed = null;
      draw(null, 0);
      say('Three people are waiting. Press <b>Serve next</b> to call the front of the line, or <b>Someone joins</b> to add a person at the back.', null);
    }
    function longest() { var w = longestServed; line.forEach(function (p) { w = Math.max(w, tick - p.at); }); return w; }
    function draw(serving, d) {
      view.render({ line: line.map(function (p) { return { id: p.id, n: p.n }; }), serving: serving, nowServing: lastServed }, { duration: d === undefined ? 480 : d });
      stats.update({ waiting: line.length, served: served, longest: longest() });
    }
    function say(html, state) { msg.innerHTML = html; if (state) msg.setAttribute('data-state', state); else msg.removeAttribute('data-state'); }
    fig.querySelector('[data-join]').addEventListener('click', function () {
      if (line.length >= 8) { say('The waiting room is full (8 people). Serve someone first.', 'compare'); return; }
      n++; tick++;
      line.push({ id: 'p' + n, n: n, at: tick });
      draw(null);
      say('Person <b>#' + n + '</b> joins at the <b>back</b>. Everyone already waiting stays ahead of them.', null);
    });
    fig.querySelector('[data-serve]').addEventListener('click', function () {
      if (!line.length) { say('Nobody is waiting. The window stays closed until someone joins.', 'compare'); return; }
      tick++;
      var p = newestFirst ? line.pop() : line.shift();
      var w = tick - p.at;
      longestServed = Math.max(longestServed, w); served++; lastServed = p.n;
      draw(p.id);
      if (newestFirst) {
        var old = line.length ? line[0] : null;
        say('The window serves <b>#' + p.n + '</b>, the <em>newest</em> arrival (waited ' + w + ').' + (old ? ' Meanwhile <b>#' + old.n + '</b> has been waiting ' + (tick - old.at) + ' ticks and is still at the front.' : ' Nobody is left waiting.'), old && tick - old.at >= 5 ? 'error' : null);
      } else {
        say('The window serves <b>#' + p.n + '</b>, the person who has waited longest (' + w + ' ticks). <b>First in, first out</b>: the line always moves forward in arrival order.', 'done');
      }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Serve the newest person first instead', checked: false, onChange: function (on) {
      newestFirst = on;
      say(on ? 'Now the window serves the <em>back</em> of the line. That is a stack, not a queue: watch who never gets served.' : 'Back to fair service: the front of the line is served first.', on ? 'compare' : null);
    } });
    fig.querySelector('[data-reset]').addEventListener('click', reset);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Front: served next' }, { state: 'frontier', label: 'Back: newest arrival' }]);
    reset();
  };

  /* ================================================================== the four operations */
  L10.initOps = function () {
    var fig = V.$('#fig-ops');
    var ops = [{ type: 'enq', value: 7 }, { type: 'enq', value: 3 }, { type: 'enq', value: 9 }, { type: 'peek' }, { type: 'deq' }, { type: 'enq', value: 4 }, { type: 'deq' }, { type: 'deq' }, { type: 'deq' }, { type: 'deq' }];
    var steps = Q().queueOps(ops);
    var view = V.views.queue(fig.querySelector('[data-stage]'), { label: 'A queue: values join at the rear and leave at the front', cellSize: 54 });
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { view.render({ items: s.items, label: s.label }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { enqueue: 'enqueue calls', dequeue: 'dequeue calls', peek: 'peek calls', refused: 'Refused (empty)' },
      counterStates: { refused: 'error' }, baseStepMs: 1350, label: 'Queue operations controls'
    });
    player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'dequeue'; }); }, function (c) {
      var vals = c.prev.items.map(function (i) { return i.value; });
      return {
        question: 'The queue holds <b>' + vals.join(', ') + '</b> (front to rear). What does <code>dequeue()</code> return?',
        options: [vals[0] + ', the front', vals[vals.length - 1] + ', the rear', 'the smallest value, ' + Math.min.apply(null, vals)],
        answer: 0,
        explain: [
          'Right. dequeue always takes the front, the value that joined first. That is what first in, first out means.',
          'The rear is the newest value. Taking it would make this a stack. A queue serves the oldest value first.',
          'A queue never looks at values, only at positions. Serving the smallest is a different structure: a priority queue.'
        ]
      };
    }, { id: 'l10-ops-deq' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Just joined the rear' }, { state: 'compare', label: 'peek: read, not removed' }]);
    return player;
  };

  /* ================================================================== shifting array vs moving front index */
  L10.initNaive = function () {
    var fig = V.$('#fig-naive');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 50, label: 'Two arrays of eight slots running the same queue operations' });
    var steps = Q().arrayQueues(V.algos.queues.parseOps(Q().ARRAY_DEFAULT).ops);
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { view.render({ rows: s.rows }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { moves: 'Values slid by Shift left', wasted: 'Slots wasted by Move front', refused: 'Enqueues Move front refused' },
      counterStates: { moves: 'swap', wasted: 'muted', refused: 'error' },
      baseStepMs: 1250, label: 'Shifting array versus moving front index controls'
    });
    player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'nospace'; }); }, function (c) {
      var p = c.prev.rows[1].pointers, front = 0, rear = 0;
      p.forEach(function (x) { if (x.name === 'front') front = x.index; if (x.name === 'rear') rear = x.index; });
      var cap = c.prev.rows[1].length;
      return {
        question: 'Move front holds ' + (rear - front) + ' values, and its front index is ' + front + '. Its rear is at slot ' + rear + '. Can it accept one more <code>enqueue</code>?',
        options: ['Yes: ' + plural(front, 'slot') + ' at the front of the array are free', 'No: the rear is at the end of the array, so it reports full', 'Yes, by moving the front index back to 0'],
        answer: 1,
        explain: [
          'Those slots are free, but the rear only ever moves right. Nothing in this design writes to a slot behind the front, so they are wasted.',
          'Right. The rear index is ' + cap + ', past the last slot. Only ' + (rear - front) + ' of ' + cap + ' slots are in use, yet this queue is stuck. That waste is what a circular buffer fixes.',
          'Moving the front index back would resurrect values that were already dequeued. The front never moves backwards.'
        ]
      };
    }, { id: 'l10-naive-nospace' });
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function load(ops) {
      var st = Q().arrayQueues(ops);
      view.reset(); view.prepare(st); player.setSteps(st);
    }
    L10.opsInput(fig.querySelector('[data-input]'), {
      value: Q().ARRAY_DEFAULT, maxOps: 16,
      presets: [
        { label: 'Default run', value: Q().ARRAY_DEFAULT },
        { label: 'Steady stream', value: '1 2 3 d 4 d 5 d 6 d 7 d 8 d' },
        { label: 'Fill it up', value: '1 2 3 4 5 6 7 8 9' },
        { label: 'One value', value: '5 d' }
      ],
      hint: 'Both arrays have 8 slots. Up to 16 operations.',
      onApply: load
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Just written' }, { state: 'swap', label: 'Slid one slot left' }, { state: 'muted', label: 'Wasted slot (old value)' }, { state: 'error', label: 'Rear at the end' }]);
    return player;
  };

  /* ================================================================== ring index arithmetic (sliders) */
  L10.initMod = function () {
    var fig = V.$('#fig-mod');
    var C = 8, head = 6, size = 5, k = 2;
    var ring = V.views.ring(fig.querySelector('[data-stage]'), { label: 'Ring buffer of eight slots showing where each logical position lives', radius: 116, headLabel: 'head', tailLabel: 'tail' });
    var readout = fig.querySelector('[data-readout]');
    var kSlider;
    function draw(d) {
      var slots = [];
      for (var i = 0; i < C; i++) {
        var j = ((i - head) % C + C) % C;
        slots.push(j < size ? { id: 'm' + j, value: j, state: j === Math.min(k, size - 1) ? 'active' : 'default' } : null);
      }
      ring.render({ capacity: C, slots: slots, head: head, tail: (head + size) % C, size: size }, { duration: d === undefined ? 520 : d });
      if (!size) { readout.innerHTML = 'The buffer is empty: no position exists yet. The next write goes to slot <b>' + head + '</b>.'; return; }
      var kk = Math.min(k, size - 1), raw = head + kk, slot = raw % C;
      readout.innerHTML = 'Position <b>' + kk + '</b> lives in slot <b>(head + k) mod C = (' + head + ' + ' + kk + ') mod ' + C + ' = ' + slot + '</b>.' +
        (raw >= C ? ' The sum ' + raw + ' runs off the end of the array; <b>mod ' + C + '</b> brings it back to slot ' + slot + '. That is the wrap-around.' : ' The sum stays below ' + C + ', so no wrap is needed.') +
        ' The next enqueue writes to <b>(head + size) mod C = ' + ((head + size) % C) + '</b>.';
    }
    V.slider(fig.querySelector('[data-head]'), { label: 'head (slot of the front)', min: 0, max: C - 1, value: head, onInput: function (v) { head = v; draw(); } });
    V.slider(fig.querySelector('[data-size]'), { label: 'size (values stored)', min: 0, max: C, value: size, onInput: function (v) { size = v; if (kSlider) { kSlider.input.max = Math.max(0, size - 1); if (k > size - 1) { k = Math.max(0, size - 1); kSlider.set(k); } } draw(); } });
    kSlider = V.slider(fig.querySelector('[data-k]'), { label: 'look at position k', min: 0, max: C - 1, value: k, onInput: function (v) { k = v; draw(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Position k' }, { state: 'default', label: 'Other stored values (numbered by position)' }]);
    draw(0);
  };

  /* ================================================================== stack vs queue on the same arrivals */
  L10.initSvq = function () {
    var fig = V.$('#fig-svq');
    var stackHost = fig.querySelector('[data-stack]'), queueHost = fig.querySelector('[data-queue]');
    var stackView = V.views.stack(stackHost, { orientation: 'horizontal', capacity: 8, cellSize: 44, label: 'Stack: the newest value is served first' });
    var queueView = V.views.queue(queueHost, { capacity: 8, cellSize: 44, label: 'Queue: the oldest value is served first' });
    var servedS = fig.querySelector('[data-served-stack]'), servedQ = fig.querySelector('[data-served-queue]');
    var stats = V.stats(fig.querySelector('[data-counters]'), { labels: { stackWorst: 'Longest wait, stack', queueWorst: 'Longest wait, queue', served: 'Values served' }, states: { stackWorst: 'error', queueWorst: 'done' } });
    var player = null;
    function chips(el, list, waiting) {
      V.clear(el);
      list.forEach(function (x) { el.appendChild(h('span', { class: 'l10-served', title: x.value + ' waited ' + x.wait + ' ticks' }, h('b', null, x.value), h('small', null, String(x.wait)))); });
      waiting.forEach(function (x) { el.appendChild(h('span', { class: 'l10-served is-waiting', title: x.value + ' has waited ' + x.wait + ' ticks so far' }, h('b', null, x.value), h('small', null, x.wait + '…'))); });
      if (!list.length && !waiting.length) el.appendChild(h('span', { class: 'l10-served__none' }, 'nothing yet'));
    }
    function render(s, ctx) {
      stackView.render({ items: s.stack }, { duration: ctx.duration });
      queueView.render({ items: s.queue }, { duration: ctx.duration });
      chips(servedS, s.servedStack, s.kind === 'done' ? s.waitingStack : []);
      chips(servedQ, s.servedQueue, s.kind === 'done' ? s.waitingQueue : []);
    }
    function load(plan) {
      var st = Q().stackVsQueue(plan);
      stackView.reset(); queueView.reset(); stackView.prepare(st.map(function (x) { return { items: x.stack, capacity: 8 }; })); queueView.prepare(st.map(function (x) { return { items: x.queue, capacity: 8 }; }));
      if (player) player.setSteps(st);
      else player = V.player({ root: fig, steps: st, render: render, caption: fig.querySelector('[data-caption]'), counters: null, baseStepMs: 1200, label: 'Stack versus queue controls',
        onStep: function (s) { stats.update(s.counters); } });
      stats.update(st[0].counters);
    }
    var PRESETS = [
      { label: 'Interleaved', value: 'A B C - D - E - F -' },
      { label: 'All arrive, then serve', value: 'A B C D E - - - - -' },
      { label: 'One at a time', value: 'A - B - C - D -' }
    ];
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Arrivals and service (a letter arrives, - serves one)', value: PRESETS[0].value, placeholder: 'e.g. A B C - D -',
      parse: function (t) { var r = Q().parsePlan(t); return { values: r.plan, error: r.error }; },
      presets: PRESETS, hint: 'Up to 8 arrivals and 14 entries. Each entry is one tick of the clock.',
      onApply: load
    });
    load(Q().parsePlan(PRESETS[0].value).plan);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Just arrived' }, { state: 'default', label: 'Waiting' }]);
    return function () { return player; };
  };

  /* ================================================================== linked queue */
  L10.initLinked = function () {
    var fig = V.$('#fig-linked');
    var view = V.views.list(fig.querySelector('[data-stage]'), { headPointer: false, pointerStyle: 'chip', label: 'A linked queue with head and tail pointers' });
    var player = null;
    var DEFAULT = '4 7 1 d d 9 d d';
    function load(ops) {
      var steps = Q().linkedQueue(ops);
      view.reset(); view.prepare(steps);
      if (player) player.setSteps(steps);
      else player = V.player({
        root: fig, steps: steps,
        render: function (s, ctx) { view.render({ nodes: s.nodes, pointers: s.pointers, order: s.order }, { duration: ctx.duration }); },
        caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
        counterLabels: { size: 'Nodes in the queue' }, baseStepMs: 1300, label: 'Linked queue controls'
      });
    }
    L10.opsInput(fig.querySelector('[data-input]'), {
      value: DEFAULT, maxOps: 12, maxEnq: 6,
      presets: [{ label: 'Default run', value: DEFAULT }, { label: 'Drain to empty', value: '5 8 d d d 3' }, { label: 'Underflow', value: '2 d d' }],
      hint: 'At most 6 enqueues and 12 operations.', onApply: load
    });
    load(V.algos.queues.parseOps(DEFAULT).ops);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'New node / head pointer' }, { state: 'frontier', label: 'tail pointer' }, { state: 'swap', label: 'Link being written / node leaving' }]);
    return function () { return player; };
  };

  /* ================================================================== deque playground (ring + logical view) */
  L10.initDeque = function () {
    var fig = V.$('#fig-deque');
    var C = 8, model = Q().dequeCreate(C), next = 1, timer = 0;
    var dq = V.views.deque(fig.querySelector('[data-deque]'), { capacity: C, cellSize: 46, label: 'The deque in logical order, front to back' });
    var ring = V.views.ring(fig.querySelector('[data-ring]'), { label: 'The same deque stored in a ring buffer', radius: 100, unrolled: false, showCenter: false, headLabel: 'head', tailLabel: 'next back' });
    var msg = fig.querySelector('[data-msg]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { size: 'Size', head: 'head slot', ops: 'Operations' }, states: { head: 'active' } });
    var opsN = 0;
    function draw(hot, d) {
      var v = Q().dequeView(model, hot);
      dq.render(v.deque, { duration: d === undefined ? 480 : d });
      ring.render(v.ring, { duration: d === undefined ? 480 : d });
      stats.update({ size: model.size, head: model.head, ops: opsN });
    }
    function say(html, state) { msg.innerHTML = html; if (state) msg.setAttribute('data-state', state); else msg.removeAttribute('data-state'); }
    function act(op) {
      var value = next;
      var r = Q().dequeApply(model, op, value);
      if (!r.ok) { say(r.msg, 'compare'); return false; }
      if (op === 'pushFront' || op === 'pushBack') next = next >= 99 ? 1 : next + 1;
      model = r.model; opsN++;
      draw(r.hot);
      say(r.msg, null);
      return true;
    }
    function stop() { if (timer) { clearTimeout(timer); timer = 0; } }
    V.$$('[data-op]', fig).forEach(function (b) { b.addEventListener('click', function () { stop(); act(b.getAttribute('data-op')); }); });
    var SCRIPTS = {
      stack: { ops: ['pushBack', 'pushBack', 'pushBack', 'popBack', 'popBack', 'popBack'], intro: 'Used as a <b>stack</b>: push and pop at the same end. The last value in is the first out.' },
      queue: { ops: ['pushBack', 'pushBack', 'pushBack', 'popFront', 'popFront', 'popFront'], intro: 'Used as a <b>queue</b>: push at the back, pop at the front. The first value in is the first out.' },
      wrap: { ops: ['pushFront', 'pushFront', 'pushFront', 'popBack', 'popBack', 'popBack'], intro: 'Pushing at the <b>front</b> moves head <em>backwards</em>, so from slot 0 it wraps round to slot ' + (C - 1) + '.' }
    };
    V.$$('[data-script]', fig).forEach(function (b) {
      b.addEventListener('click', function () {
        stop();
        model = Q().dequeCreate(C); next = 1; opsN = 0; draw(null, 0);
        var sc = SCRIPTS[b.getAttribute('data-script')], i = 0;
        say(sc.intro, null);
        function step() {
          if (i >= sc.ops.length) return;
          act(sc.ops[i++]);
          timer = setTimeout(step, V.reducedMotion && V.reducedMotion() ? 200 : 900);
        }
        timer = setTimeout(step, V.reducedMotion && V.reducedMotion() ? 200 : 700);
      });
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { stop(); model = Q().dequeCreate(C); next = 1; opsN = 0; draw(null, 0); say('Empty deque. Try the four buttons, or run a script.', null); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Value just written' }, { state: 'default', label: 'Stored value' }]);
    draw(null, 0);
    say('Empty deque. Try the four buttons, or run a script.', null);
  };

  /* ================================================================== a queue from two stacks */
  L10.initTwoStacks = function () {
    var fig = V.$('#fig-twostacks');
    var inV = V.views.stack(fig.querySelector('[data-inbox]'), { capacity: 7, cellSize: 32, cellWidth: 92, label: 'The inbox stack' });
    var outV = V.views.stack(fig.querySelector('[data-outbox]'), { capacity: 7, cellSize: 32, cellWidth: 92, label: 'The outbox stack' });
    var player = null, DEFAULT = '1 2 3 d 4 d d d';
    function load(ops) {
      var st = Q().twoStacks(ops);
      inV.reset(); outV.reset();
      if (player) player.setSteps(st);
      else player = V.player({
        root: fig, steps: st,
        render: function (s, ctx) { inV.render({ items: s.inbox }, { duration: ctx.duration }); outV.render({ items: s.outbox }, { duration: ctx.duration }); },
        caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
        counterLabels: { pushes: 'Pushes', pops: 'Pops', transfers: 'Values moved inbox → outbox' }, counterStates: { transfers: 'swap' },
        baseStepMs: 1050, label: 'Queue from two stacks controls'
      });
    }
    L10.opsInput(fig.querySelector('[data-input]'), {
      value: DEFAULT, maxOps: 14, maxEnq: 7,
      presets: [{ label: 'Default run', value: DEFAULT }, { label: 'Alternating', value: '1 d 2 d 3 d 4 d' }, { label: 'Fill, then drain', value: '1 2 3 4 5 6 d d d d d d' }],
      hint: 'At most 7 enqueues and 14 operations.', onApply: load
    });
    load(V.algos.queues.parseOps(DEFAULT).ops);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Value being pushed or popped' }]);
    return function () { return player; };
  };

  /* ================================================================== BFS preview: a queue feeding a flood fill */
  L10.initBfs = function () {
    var fig = V.$('#fig-bfs');
    var ROWS = 5, COLS = 7, START = [2, 0];
    var walls = [[0, 2], [1, 2], [3, 2], [4, 2], [1, 4], [2, 4], [3, 4], [3, 5]];
    function key(r, c) { return r + ',' + c; }
    var wallSet = {}; walls.forEach(function (w) { wallSet[key(w[0], w[1])] = true; });
    var grid = V.views.grid(fig.querySelector('[data-grid]'), { mode: 'path', cellSize: 52, label: 'A grid being flooded by breadth-first search', colHeaders: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], rowHeaders: ['1', '2', '3', '4', '5'], onCellClick: onClick });
    var queue = V.views.queue(fig.querySelector('[data-queue]'), { cellSize: 40, label: 'The BFS queue, front to rear' });
    var player = null;
    function curWalls() { return Object.keys(wallSet).map(function (k) { return k.split(',').map(Number); }); }
    function draw(s, ctx) {
      grid.render({ rows: s.rows, cols: s.cols, walls: s.walls, cells: s.cells, markers: { start: { cell: s.start, label: 'S' } } }, { duration: ctx.duration });
      queue.render({ items: s.queue }, { duration: ctx.duration });
    }
    function load() {
      var st = Q().bfsGrid(ROWS, COLS, curWalls(), START);
      queue.reset(); queue.prepare(st.map(function (x) { return { items: x.queue }; }));
      if (player) player.setSteps(st);
      else player = V.player({
        root: fig, steps: st, render: draw, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
        counterLabels: { visited: 'Cells expanded', queued: 'In the queue now', biggest: 'Largest the queue got' }, counterStates: { queued: 'frontier' },
        baseStepMs: 1000, label: 'Breadth-first flood fill controls'
      });
      var note = fig.querySelector('[data-note]');
      if (note) note.textContent = Object.keys(st.dist).length + ' of ' + (ROWS * COLS - walls.length) + ' open cells are reachable from S.';
    }
    function onClick(e) {
      var k = key(e.row, e.col);
      if (e.row === START[0] && e.col === START[1]) return;
      if (wallSet[k]) delete wallSet[k]; else wallSet[k] = true;
      walls = curWalls();
      load();
    }
    fig.querySelector('[data-clear]').addEventListener('click', function () { wallSet = {}; load(); });
    fig.querySelector('[data-maze]').addEventListener('click', function () { wallSet = {}; [[0, 2], [1, 2], [3, 2], [4, 2], [1, 4], [2, 4], [3, 4], [3, 5]].forEach(function (w) { wallSet[key(w[0], w[1])] = true; }); load(); });
    load();
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Cell being expanded' }, { state: 'frontier', label: 'In the queue' }, { state: 'visited', label: 'Expanded' }, { color: 'var(--ink)', label: 'Wall (click a cell to toggle)' }]);
    return function () { return player; };
  };

  /* ================================================================== real uses: four tiny looping queues */
  L10.initUses = function () {
    var host = V.$('#mini-uses');
    var Qs = Q();
    function mini(title, cap, kind, build, o) {
      o = o || {};
      var stage = h('div', { class: 'mini__stage l10-mini-stage', role: 'img', 'aria-label': o.alt || title });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l10-mini-title' }, title), stage, h('figcaption', { html: cap })));
      var view = build(stage);
      return { stage: stage, view: view };
    }
    // 1. printer spooler: a plain queue
    (function () {
      var ops = Qs.parseOps('1 2 3 d 4 d d 5 d d').ops;
      var st = Qs.queueOps(ops).map(function (s) { return { items: s.items }; });
      var m = mini('Print spooler', '<b>Jobs print in the order they were sent.</b> Nobody\'s document jumps the line.', 'queue', function (stage) {
        var v = V.views.queue(stage, { cellSize: 40, label: 'Print jobs in a queue' }); v.prepare(st); return v;
      }, { alt: 'Animation: print jobs join a queue at the right and leave from the left in the order they arrived.' });
      V.teaser(m.stage, { steps: st, render: function (s, ctx) { m.view.render(s, { duration: ctx.duration }); }, stepMs: 640, holdMs: 900, staticIndex: 3 });
    }());
    // 2. audio buffer: a small ring
    (function () {
      var ops = Qs.parseOps('1 2 3 4 d d 5 6 d d 7 8 d d').ops;
      var st = Qs.ring(5, ops, { scheme: 'size' }).filter(function (s) { return s.kind === 'advance' || s.kind === 'start'; });
      var m = mini('Audio buffer', '<b>A producer writes, a player reads.</b> The ring reuses the same 5 slots forever, with no copying.', 'ring', function (stage) {
        return V.views.ring(stage, { radius: 62, unrolled: false, showCenter: false, headLabel: 'play', tailLabel: 'write', label: 'Audio ring buffer' });
      }, { alt: 'Animation: a ring buffer of five slots; the write pointer chases the play pointer around the ring.' });
      V.teaser(m.stage, { steps: st, render: function (s, ctx) { m.view.render({ capacity: s.capacity, slots: s.slots, head: s.head, tail: s.tail }, { duration: ctx.duration }); }, stepMs: 700, holdMs: 800, staticIndex: 4 });
    }());
    // 3. rate limiter: a deque of timestamps
    (function () {
      var st = Qs.rateLimiter([1, 3, 4, 6, 9, 12, 14, 15], 3, 10);
      var m = mini('Rate limiter', '<b>At most 3 requests per 10 seconds.</b> Old timestamps leave the front; new ones join the back.', 'deque', function (stage) {
        var v = V.views.deque(stage, { cellSize: 40, label: 'Timestamps of recent requests' }); v.prepare(st.map(function (x) { return { items: x.items }; })); return v;
      }, { alt: 'Animation: a deque of request timestamps; expired timestamps leave at the front, and a fourth request inside the window is rejected.' });
      V.teaser(m.stage, { steps: st, render: function (s, ctx) { m.view.render({ items: s.items, label: s.label }, { duration: ctx.duration }); }, stepMs: 780, holdMs: 900, staticIndex: 5 });
    }());
    // 4. priority queue: leaves from the middle
    (function () {
      var ops = Qs.parseOps('5 2 8 3 d d 1 d d').ops;
      var st = Qs.priorityQueue(ops);
      var m = mini('Priority queue', '<b>Most urgent first, not oldest first.</b> Values leave from the middle: that needs a <em>heap</em>, coming in Unit 5.', 'pq', function (stage) {
        var v = V.views.queue(stage, { cellSize: 40, label: 'Priority queue' }); v.prepare(st.map(function (x) { return { items: x.items }; })); return v;
      }, { alt: 'Animation: a queue where the value with the smallest number is served first, leaving from the middle of the line.' });
      V.teaser(m.stage, { steps: st, render: function (s, ctx) { m.view.render({ items: s.items }, { duration: ctx.duration }); }, stepMs: 700, holdMs: 900, staticIndex: 5 });
    }());
  };

  /* ================================================================== "which structure?" decision diagram */
  var CHOOSE = {
    nodes: [
      { id: 'q0', type: 'decision', text: 'Window\nmax or min?', col: 1, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'a-mono', type: 'end', text: 'Monotonic deque', col: 2, row: 0, narrow: { col: 1, row: 0 } },
      { id: 'q1', type: 'decision', text: 'Insert and remove\nat both ends?', col: 1, row: 1, narrow: { col: 0, row: 1 } },
      { id: 'a-deque', type: 'end', text: 'Deque', col: 2, row: 1, narrow: { col: 1, row: 1 } },
      { id: 'q2', type: 'decision', text: 'Which value\nleaves first?', col: 1, row: 2, narrow: { col: 0, row: 2 } },
      { id: 'a-stack', type: 'end', text: 'Stack', col: 0, row: 2, narrow: { col: 1, row: 2 } },
      { id: 'a-pq', type: 'end', text: 'Priority queue\n(heap)', col: 2, row: 2, narrow: { col: 1, row: 3 } },
      { id: 'q3', type: 'decision', text: 'Size known\nin advance?', col: 1, row: 3, narrow: { col: 0, row: 3 } },
      { id: 'a-ring', type: 'end', text: 'Ring buffer', col: 0, row: 3, narrow: { col: 0, row: 4 } },
      { id: 'a-grow', type: 'end', text: 'Growable queue\n(doubling ring or\nlinked list)', col: 1, row: 4, narrow: { col: 1, row: 4 } }
    ],
    edges: [
      { from: 'q0', to: 'a-mono', label: 'yes' },
      { from: 'q0', to: 'q1', label: 'no' },
      { from: 'q1', to: 'a-deque', label: 'yes' },
      { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'a-stack', label: 'newest' },
      { from: 'q2', to: 'q3', label: 'oldest' },
      { from: 'q2', to: 'a-pq', label: 'most urgent' },
      { from: 'q3', to: 'a-ring', label: 'yes' },
      { from: 'q3', to: 'a-grow', label: 'no' }
    ]
  };
  var CHOOSE_WHY = {
    'a-mono': '<b>Monotonic deque.</b> Keep candidates in decreasing order; expired ones leave the front, dominated ones leave the back. Each item enters and leaves once, so the whole scan is O(n).',
    'a-stack': '<b>Stack.</b> Undo history, the browser back button, matching brackets, the call stack: whatever came last must be undone or finished first.',
    'a-deque': '<b>Deque.</b> Work stealing between threads, a browser history that trims from both ends, palindrome checks: you need cheap inserts and removals at both ends.',
    'a-pq': '<b>Priority queue.</b> Hospital triage, Dijkstra’s algorithm, the Apollo 11 computer shedding low-priority jobs: order comes from urgency, not arrival. See Unit 5 (heaps).',
    'a-ring': '<b>Ring buffer.</b> Audio, network packets, keyboard input, logging: a fixed block of memory, O(1) at both ends, no allocation while running.',
    'a-grow': '<b>Growable queue.</b> Most standard-library queues (a circular array that doubles when full, or a linked list). Print jobs, BFS, task queues: unbounded, first in first out.'
  };
  L10.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which linear structure should you use?', narrowWidth: 420 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q0'], taken = {};
    function show(d) {
      var cur = path[path.length - 1], st = {};
      if (CHOOSE_WHY[cur]) st[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: st }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box by pressing one of its labelled arrows.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q0']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    show(0);
  };

  /* ================================================================== cost charts */
  L10.initCost = function () {
    var fig = V.$('#fig-cost');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Work per dequeue as the queue grows', height: 320 });
    var mode = 'worst';
    var NS = []; for (var n = 1; n <= 100; n += 3) NS.push(n);
    function pts(fn) { return NS.map(function (n) { return [n, fn(n)]; }); }
    function draw(d) {
      var worst = mode === 'worst';
      var series = worst
        ? [
          { id: 'shift', label: 'Shift left', points: pts(function (n) { return Q().dequeueCost('shift', n); }), state: 'error', markers: false },
          { id: 'two', label: 'Two stacks', points: pts(function (n) { return Q().dequeueCost('twostack', n); }), state: 'compare', markers: false },
          { id: 'ring', label: 'Ring or linked', points: pts(function (n) { return Q().dequeueCost('ring', n); }), state: 'done', markers: false }
        ]
        : [
          { id: 'shift', label: 'Shift left', points: pts(function (n) { return Q().drainCost('shift', n); }), state: 'error', markers: false },
          { id: 'two', label: 'Two stacks', points: pts(function (n) { return Q().drainCost('twostack', n); }), state: 'compare', markers: false },
          { id: 'ring', label: 'Ring or linked', points: pts(function (n) { return Q().drainCost('ring', n); }), state: 'done', markers: false }
        ];
      chart.render({
        x: { label: 'values in the queue, n', min: 1, max: 100 },
        y: { label: worst ? 'stored values touched by ONE dequeue' : 'average values touched per dequeue', min: 0, max: worst ? 210 : 55 },
        series: series,
        highlight: worst ? { series: 'two', x: 100, label: '201 for n = 100' } : { series: 'shift', x: 100, label: '50.5 for n = 100' }
      }, { duration: d === undefined ? 700 : d });
      note.innerHTML = worst
        ? 'A single <b>shift-left</b> dequeue touches all <em>n</em> values. A <b>two-stack</b> dequeue can touch 2n + 1 when the outbox is empty (it moves everything), but that only happens once per value.'
        : 'Averaged over draining <em>n</em> values, shift-left still costs about (n + 1) / 2 per dequeue, while the two-stack queue settles at exactly <b>3</b>: that is <em>amortized</em> O(1). Ring and linked queues touch one value.';
    }
    var note = fig.querySelector('[data-note]');
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Measure', value: mode, options: [{ value: 'worst', label: 'One dequeue (worst case)' }, { value: 'avg', label: 'Average while draining' }], onChange: function (v) { mode = v; draw(); } });
    draw(0);

    // second chart: sliding window maximum, comparisons vs n
    var fig2 = V.$('#fig-cost2');
    var chart2 = V.views.chart(fig2.querySelector('[data-stage]'), { type: 'line', label: 'Comparisons for sliding window maximum as n grows', height: 320 });
    var K = 8, seg2 = null;
    var note2 = fig2.querySelector('[data-note]');
    function series2(k) {
      var xs = []; for (var n = k; n <= 200; n += 8) xs.push(n);
      var rng = V.rng(7);
      function avgRandom(n) { var t = 0, R = 6; for (var r = 0; r < R; r++) { var a = []; for (var i = 0; i < n; i++) a.push(rng.int(0, 99)); t += Q().slidingMaxCount(a, k).comparisons; } return t / R; }
      function inc(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return Q().slidingMaxCount(a, k).comparisons; }
      return [
        { id: 'brute', label: 'Brute force', points: xs.map(function (n) { return [n, Q().bruteCount(n, k)]; }), state: 'error', markers: false },
        { id: 'rand', label: 'Deque, random data', points: xs.map(function (n) { return [n, avgRandom(n)]; }), state: 'active', markers: false },
        { id: 'inc', label: 'Deque, sorted data', points: xs.map(function (n) { return [n, inc(n)]; }), state: 'done', markers: false },
        { id: 'two', label: '2n bound', points: xs.map(function (n) { return [n, 2 * n]; }), state: 'muted', dashed: true, markers: false }
      ];
    }
    function draw2(d) {
      var ser = series2(K);
      chart2.render({ x: { label: 'values scanned, n', min: K, max: 200 }, y: { label: 'comparisons (window k = ' + K + ')', min: 0, max: 1600 }, series: ser,
        highlight: { series: 'brute', x: 200, label: Q().bruteCount(200, K) + ' for n = 200' } }, { duration: d === undefined ? 700 : d });
      note2.innerHTML = 'Brute force compares (n − k + 1)(k − 1) times, so it grows with <b>n · k</b>. The deque never exceeds <b>2n</b>, whatever k is: every index is pushed once and popped at most once.';
    }
    seg2 = V.segmented(fig2.querySelector('[data-seg]'), { label: 'Window size k', value: String(K), options: [{ value: '4', label: 'k = 4' }, { value: '8', label: 'k = 8' }, { value: '16', label: 'k = 16' }, { value: '32', label: 'k = 32' }], onChange: function (v) { K = +v; draw2(); } });
    draw2(0);
    V.legend(fig2.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Brute force' }, { state: 'active', shape: 'line', label: 'Deque, random' }, { state: 'done', shape: 'line', label: 'Deque, sorted' }, { state: 'muted', shape: 'dash', label: '2n bound' }]);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Shift left' }, { state: 'compare', shape: 'line', label: 'Two stacks' }, { state: 'done', shape: 'line', label: 'Ring or linked' }]);
  };
}());
