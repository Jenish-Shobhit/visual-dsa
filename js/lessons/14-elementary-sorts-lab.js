/* Lesson 14 — the big interactive figures: the three-tab lab (+ its flowchart), the race, the cost charts,
   the "which simple sort?" decision diagram. Uses VDSA.algos.sorting (js/algos/14-elementary-sorts.js) and the
   helpers in js/lessons/14-elementary-sorts-views.js. Started by js/lessons/14-elementary-sorts.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L14 = V.lessons.l14;
  var NAMES = ['bubble', 'selection', 'insertion'];
  var TITLE = { bubble: 'Bubble sort', selection: 'Selection sort', insertion: 'Insertion sort' };
  var MOVE = { bubble: 'swaps', selection: 'swaps', insertion: 'shifts' };
  function S() { return V.algos.sorting; }
  function fmt(v) { return L14.fmt(v); }

  /* ================================================================== legends per algorithm */
  var LEGENDS = {
    bubble: [{ state: 'compare', label: 'Comparing a[j], a[j+1]' }, { state: 'swap', label: 'Swapping' }, { state: 'done', label: 'Final' }],
    selection: [{ state: 'key', label: 'Smallest so far' }, { state: 'compare', label: 'Comparing a[j]' }, { state: 'swap', label: 'Swapping' }, { state: 'done', label: 'Final' }],
    insertion: [{ state: 'key', label: 'Key in hand' }, { state: 'compare', label: 'Comparing a[j]' }, { state: 'swap', label: 'Shifted right' }, { state: 'visited', label: 'Sorted prefix (not final)' }, { state: 'done', label: 'Final' }]
  };
  L14.LEGENDS = LEGENDS;

  /* ================================================================== flowcharts (one per algorithm) */
  var FLOWS = {
    bubble: {
      nodes: [
        { id: 'start', type: 'start', text: 'i = 0', col: 0, row: 0 },
        { id: 'outer', type: 'decision', text: 'i < n − 1 ?', col: 0, row: 1 },
        { id: 'pass', type: 'process', text: 'swapped = false\nj = 0', col: 0, row: 2 },
        { id: 'cmp', type: 'decision', text: 'a[j] > a[j + 1] ?', col: 0, row: 3 },
        { id: 'swap', type: 'process', text: 'swap a[j], a[j + 1]\nswapped = true', col: 1, row: 3 },
        { id: 'more', type: 'decision', text: 'more pairs\nthis pass?', col: 0, row: 4 },
        { id: 'exitQ', type: 'decision', text: 'swapped ?', col: 0, row: 5 },
        { id: 'done', type: 'end', text: 'sorted', col: 2, row: 5, narrow: { col: 1, row: 6 } }
      ],
      edges: [
        { from: 'start', to: 'outer' },
        { from: 'outer', to: 'pass', label: 'yes' },
        { from: 'outer', to: 'done', label: 'no', via: { fromSide: 'right', toSide: 'top' } },
        { from: 'pass', to: 'cmp' },
        { from: 'cmp', to: 'swap', label: 'yes' },
        { from: 'cmp', to: 'more', label: 'no' },
        { from: 'swap', to: 'more' },
        { from: 'more', to: 'cmp', label: 'yes: j + 1' },
        { from: 'more', to: 'exitQ', label: 'no' },
        { from: 'exitQ', to: 'outer', label: 'yes: i + 1' },
        { from: 'exitQ', to: 'done', label: 'no' }
      ]
    },
    selection: {
      nodes: [
        { id: 'start', type: 'start', text: 'i = 0', col: 0, row: 0 },
        { id: 'outer', type: 'decision', text: 'i < n − 1 ?', col: 0, row: 1 },
        { id: 'pass', type: 'process', text: 'min = i\nj = i + 1', col: 0, row: 2 },
        { id: 'cmp', type: 'decision', text: 'a[j] < a[min] ?', col: 0, row: 3 },
        { id: 'newmin', type: 'process', text: 'min = j', col: 1, row: 3 },
        { id: 'more', type: 'decision', text: 'more values\nto scan?', col: 0, row: 4 },
        { id: 'swap', type: 'process', text: 'swap a[i], a[min]\ni = i + 1', col: 0, row: 5 },
        { id: 'done', type: 'end', text: 'sorted', col: 1, row: 1 }
      ],
      edges: [
        { from: 'start', to: 'outer' },
        { from: 'outer', to: 'pass', label: 'yes' },
        { from: 'outer', to: 'done', label: 'no' },
        { from: 'pass', to: 'cmp' },
        { from: 'cmp', to: 'newmin', label: 'yes' },
        { from: 'cmp', to: 'more', label: 'no' },
        { from: 'newmin', to: 'more' },
        { from: 'more', to: 'cmp', label: 'yes: j + 1' },
        { from: 'more', to: 'swap', label: 'no' },
        { from: 'swap', to: 'outer' }
      ]
    },
    insertion: {
      nodes: [
        { id: 'start', type: 'start', text: 'i = 1', col: 0, row: 0 },
        { id: 'outer', type: 'decision', text: 'i < n ?', col: 0, row: 1 },
        { id: 'lift', type: 'process', text: 'key = a[i]\nj = i − 1', col: 0, row: 2 },
        { id: 'cmp', type: 'decision', text: 'j ≥ 0 and\na[j] > key ?', col: 0, row: 3 },
        { id: 'shift', type: 'process', text: 'a[j + 1] = a[j]\nj = j − 1', col: 1, row: 3 },
        { id: 'insert', type: 'process', text: 'a[j + 1] = key\ni = i + 1', col: 0, row: 4 },
        { id: 'done', type: 'end', text: 'sorted', col: 1, row: 1 }
      ],
      edges: [
        { from: 'start', to: 'outer' },
        { from: 'outer', to: 'lift', label: 'yes' },
        { from: 'outer', to: 'done', label: 'no' },
        { from: 'lift', to: 'cmp' },
        { from: 'cmp', to: 'shift', label: 'yes' },
        { from: 'shift', to: 'cmp', via: { fromSide: 'top', toSide: 'top' } },
        { from: 'cmp', to: 'insert', label: 'no' },
        { from: 'insert', to: 'outer' }
      ]
    }
  };
  L14.FLOWS = FLOWS;
  var FLOW_ALT = {
    bubble: 'Text alternative: start with i = 0. While i < n − 1, set swapped to false and walk j from 0; whenever a[j] > a[j + 1], swap them and set swapped to true. When the pass ends, stop if nothing was swapped; otherwise increase i and sweep again.',
    selection: 'Text alternative: start with i = 0. While i < n − 1, set min = i and scan j from i + 1 to the end; whenever a[j] < a[min], set min = j. After the scan, swap a[i] with a[min] and increase i.',
    insertion: 'Text alternative: start with i = 1. While i < n, lift key = a[i] and set j = i − 1; while j ≥ 0 and a[j] > key, shift a[j] one slot right and decrease j; then write the key into a[j + 1] and increase i.'
  };

  /* ================================================================== the lab */
  var DEFAULT_INPUT = [6, 2, 9, 4, 7, 1, 8, 4];

  L14.initLab = function () {
    var fig = V.$('#lab-fig');
    var flowFig = V.$('#fig-flow');
    var stage = fig.querySelector('[data-stage]');
    var algo = 'bubble', values = DEFAULT_INPUT.slice(), mode = 'bars';
    var view = V.views.array(stage, { mode: mode, label: 'Array being sorted', barHeight: 220 });
    var legendEl = fig.querySelector('[data-legend]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE.bubble, default: 'pseudo', maxHeight: 330 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });

    /* flowchart below the lab, lit by the lab's current step */
    var flowStage = flowFig.querySelector('[data-stage]');
    var flowView = V.views.flowchart(flowStage, FLOWS.bubble, { label: 'Flowchart of the sort running in the lab', narrowWidth: 380 });
    var flowTitle = flowFig.querySelector('[data-flow-title]');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [], states = {}, also = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          also = (st[ctx.index] && st[ctx.index].flowAlso) || [];   // decisions this step evaluates on its way to `flow`
          also.forEach(function (x) { states[x] = 'active'; });
          for (var k = 0; k < ctx.index && k < st.length; k++) [st[k].flow].concat(st[k].flowAlso || []).forEach(function (x) { if (x && visited.indexOf(x) === -1 && x !== id && also.indexOf(x) === -1) visited.push(x); });
        }
        flowView.render({ active: id || undefined, states: states, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function generate() { return S().run(algo, L14.labelDuplicates(values)); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig,
      steps: steps,
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps', shifts: 'Shifts' },
      counterStates: { comparisons: 'compare', swaps: 'swap', shifts: 'swap' },
      baseStepMs: 950,
      label: 'Sorting lab controls'
    });

    /* ---- predictions: one per algorithm; each resolves to -1 (skipped) when another algorithm is loaded ---- */
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'bubble') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'pass' && st[k].round === 2) return k;
      return -1;
    }, function (c) {
      var n = c.step.order.length;
      return {
        question: 'Pass 1 is over. How far does pass 2 need to sweep?',
        options: ['Up to index ' + (n - 2) + ': index ' + (n - 1) + ' already holds the largest value', 'Up to index ' + (n - 1) + ' again: the largest value could still move', 'Only until its first swap'],
        answer: 0,
        explain: [
          'Right. Pass 1 carried the largest value to index ' + (n - 1) + ', and nothing can ever pass it, so each pass can stop one position earlier than the one before.',
          'The largest value can never move again: every comparison with it finds it bigger, so it only moves right. Sweeping to index ' + (n - 1) + ' would waste a comparison.',
          'A pass never stops at its first swap: the largest value in the unsorted part has to ride all the way to the end.'
        ]
      };
    }, { id: 'l14-lab-bubble-pass2' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'selection') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'swap') return k;
      return -1;
    }, function (c) {
      var s = c.prev, i = null, m = null;
      s.pointers.forEach(function (p) { if (p.name === 'i') i = p.index; if (p.name === 'min') m = p.index; });
      if (i === null || m === null) return null;
      var byId = {}; s.items.forEach(function (it) { byId[it.id] = it; });
      var ai = byId[s.order[i]], am = byId[s.order[m]];
      var opts = ['Index ' + m + ', where the minimum ' + fmt(am.value) + ' was', 'Index ' + (i + 1) + ', one step to the right', 'Nowhere: ' + fmt(am.value) + ' is inserted at index ' + i + ' and everything shifts right'];
      return {
        question: 'The scan is over and the min marker points at index ' + m + '. What happens to <code>a[' + i + '] = ' + fmt(ai.value) + '</code>?',
        options: opts, answer: 0,
        explain: [
          'Right. A swap trades the two values, so ' + fmt(ai.value) + ' jumps straight to index ' + m + ', past everything in between. That long jump is why selection sort can reorder equal values.',
          'That would be a neighbour swap, as in bubble sort. Selection sort swaps a[' + i + '] with the minimum wherever the minimum is.',
          'That is what insertion sort does. Selection sort makes exactly one swap per pass, which is why it needs at most n − 1 swaps.'
        ]
      };
    }, { id: 'l14-lab-selection-jump' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'insertion') return -1;
      var best = -1, shifts = 0;
      for (var k = 1; k < st.length; k++) {
        if (st[k].kind === 'lift') shifts = 0;
        if (st[k].kind === 'shift') shifts++;
        if (st[k].kind === 'insert' && shifts >= 2) return k;
        if (st[k].kind === 'insert' && shifts === 1 && best < 0) best = k;
      }
      return best;
    }, function (c) {
      var target = c.step, prev = c.prev;
      if (!prev.held) return null;
      var key = prev.held, land = target.order.indexOf(key.id), from = null;
      prev.pointers.forEach(function (p) { if (p.name === 'i') from = p.index; });
      var cand = [land, land > 0 ? land - 1 : land + 1, from].filter(function (x, k, arr) { return x !== null && arr.indexOf(x) === k; });
      var names = cand.map(function (p) { return 'Index ' + p + (p === from ? ', back where it started' : p === 0 ? ', the front' : ''); });
      return {
        question: 'The key <code>' + fmt(key.value) + '</code> is in hand. Where will it be inserted?',
        options: names, answer: 0,
        explain: cand.map(function (p, k) {
          if (!k) return 'Right. The larger values have shifted right, and the hole is now at index ' + land + '. The key drops into the hole.';
          if (p === from) return 'It started at index ' + from + ', but larger values have shifted right into that slot. The key goes where the hole is now: index ' + land + '.';
          return 'Look at the hole: the key always drops into it, and the hole is at index ' + land + '.';
        })
      };
    }, { id: 'l14-lab-insertion-land' });

    /* ---- tabs ---- */
    var tabs = V.tabs('#lab-tabs', { onChange: function (name) { select(name, true); } });
    function select(name, fromTabs, force) {
      if (name === algo && !force) return;
      algo = name;
      if (!fromTabs) tabs.select(name);
      code.setSource(S().CODE[algo]);
      V.legend(legendEl, LEGENDS[algo]);
      flowView.setSpec(FLOWS[algo]);
      if (flowTitle) flowTitle.textContent = TITLE[algo] + ' as a flowchart';
      var alt = flowFig.querySelector('[data-flow-alt]');
      if (alt) alt.textContent = FLOW_ALT[algo];
      if (flowSeg && flowSeg.value !== algo) flowSeg.set(algo);
      reload();
    }
    function reload() {
      steps = generate();
      view.reset(); view.prepare(steps);
      player.setSteps(steps);
    }
    V.legend(legendEl, LEGENDS[algo]);

    /* ---- flowchart's own switch, synced both ways ---- */
    var flowSeg = V.segmented(flowFig.querySelector('[data-seg]'), {
      label: 'Algorithm', value: algo,
      options: NAMES.map(function (n) { return { value: n, label: TITLE[n].replace(' sort', '') }; }),
      onChange: function (v) { select(v, false); }
    });

    /* ---- input + presets ---- */
    var N = 8;
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (0 to 16 values, −99 to 99)',
      value: values,
      parse: { min: -99, max: 99, maxCount: 16, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(N, { min: 5, max: 95 }); } },
        { label: 'Sorted', title: 'Best case for bubble (early exit) and insertion sort', value: function () { return V.presets.sorted(N, { min: 5, max: 95 }); } },
        { label: 'Reversed', title: 'Worst case: every pair is out of order', value: function () { return V.presets.reversed(N, { min: 5, max: 95 }); } },
        { label: 'Nearly sorted', value: function () { return V.presets.nearlySorted(N, { min: 5, max: 95, swaps: 2 }); } },
        { label: 'Few unique', value: function () { return V.presets.fewUnique(N, { min: 10, max: 90, k: 3 }); } },
        { label: 'All equal', value: [5, 5, 5, 5, 5, 5] },
        { label: 'One value', value: [42] }
      ],
      hint: 'Repeated values get small a, b, c tags in box view, so you can see whether their order survives.',
      onApply: function (vals) { values = vals; reload(); }
    });
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Draw values as', value: mode,
      options: [{ value: 'bars', label: 'Bars' }, { value: 'boxes', label: 'Boxes' }],
      onChange: function (m) { mode = m; view.setOptions({ mode: m }); view.reset(); view.prepare(player.steps); player.refresh(); }
    });

    select('bubble', true, true);
    return { select: function (n) { select(n, false); }, player: player };
  };

  /* ================================================================== the race */
  L14.initRace = function () {
    var fig = V.$('#fig-race');
    var lanesEl = fig.querySelector('[data-lanes]');
    var preset = 'random', n = 12, seed = 11;
    var narrow = lanesEl.clientWidth > 0 && lanesEl.clientWidth < 600;
    var lanes = NAMES.map(function (name) {
      var status = h('span', { class: 'l14-lane__status' });
      var host = h('div', { class: 'l14-lane__stage' });
      var stats = h('div', { class: 'l14-lane__stats' });
      var el = h('div', { class: 'l14-lane', 'data-algo': name },
        h('div', { class: 'l14-lane__head' }, h('span', { class: 'l14-lane__name' }, TITLE[name]), status), host, stats);
      lanesEl.appendChild(el);
      // identical lane reservations keep the three baselines level whatever each algorithm draws
      var view = V.views.array(host, { mode: 'bars', showIndices: false, showValues: false, label: TITLE[name] + ' lane', cellSize: 30, barHeight: narrow ? 76 : 120,
        reserve: { held: true } });
      var st = V.stats(stats, { labels: { comparisons: 'Comparisons', moves: MOVE[name] === 'shifts' ? 'Shifts' : 'Swaps', ticks: 'Ticks' }, states: { comparisons: 'compare', moves: 'swap' } });
      return { name: name, el: el, status: status, view: view, stats: st, frames: [] };
    });
    function input() {
      var o = { min: 5, max: 95, seed: seed };
      if (preset === 'sorted') return V.presets.sorted(n, o);
      if (preset === 'reversed') return V.presets.reversed(n, o);
      if (preset === 'nearly') return V.presets.nearlySorted(n, Object.assign({ swaps: 2 }, o));
      if (preset === 'few') return V.presets.fewUnique(n, Object.assign({ k: 3 }, o));
      return V.presets.random(n, o);
    }
    function build() {
      var vals = input(), T = 0;
      lanes.forEach(function (l) {
        // lanes are small: drop pointers and region labels, keep colours, bands and the held key
        l.frames = S().opFrames(S().run(l.name, vals)).map(function (f) {
          return Object.assign({}, f, { pointers: [], regions: f.regions.map(function (r) { return Object.assign({}, r, { label: undefined }); }) });
        });
        l.view.reset(); l.view.prepare(l.frames);
        T = Math.max(T, l.frames.length);
      });
      var totals = lanes.map(function (l) { return l.frames.length - 1; });
      var sortedTotals = totals.slice().sort(function (a, b) { return a - b; });
      lanes.forEach(function (l, k) { l.total = totals[k]; l.rank = sortedTotals.indexOf(totals[k]) + 1; });
      var out = [];
      for (var t = 0; t < T; t++) out.push({ t: t, caption: caption(t, T), vals: vals });
      return out;
    }
    function caption(t, T) {
      if (t === 0) return 'Same ' + n + ' values in every lane. One tick = one comparison or one move (a swap or a shift). Press play.';
      var done = lanes.filter(function (l) { return t >= l.total; }).sort(function (a, b) { return a.total - b.total; });
      if (t >= T - 1) {
        var order = lanes.slice().sort(function (a, b) { return a.total - b.total; });
        var lesson = preset === 'nearly' || preset === 'sorted' ? ' Insertion sort only pays for the disorder that is there.' : preset === 'reversed' ? ' Reversed input is the worst case for all three; selection still makes the fewest moves.' : preset === 'few' ? ' Repeats cut the work of bubble and insertion sort a little: equal values never swap.' : '';
        return 'Finished: ' + order.map(function (l) { return '<b>' + TITLE[l.name].replace(' sort', '') + '</b> ' + l.total; }).join(', ') + ' ticks.' + lesson;
      }
      return 'Tick ' + t + '. ' + (done.length ? done.map(function (l) { return TITLE[l.name] + ' finished at tick ' + l.total; }).join('; ') + '.' : 'All three are still working.');
    }
    function render(step, ctx) {
      lanes.forEach(function (l) {
        var k = Math.min(step.t, l.frames.length - 1), f = l.frames[k];
        l.view.render(f, { duration: ctx.duration });
        l.stats.update({ comparisons: f.ops.comparisons, moves: f.ops.swaps + f.ops.shifts, ticks: k });
        var fin = step.t >= l.total;
        l.el.classList.toggle('is-finished', fin);
        l.status.textContent = fin ? (l.rank === 1 ? '1st' : l.rank === 2 ? '2nd' : '3rd') + ' · ' + l.total + ' ticks' : 'running';
        l.status.setAttribute('data-rank', fin ? l.rank : '');
      });
    }
    var player = V.player({ root: fig, steps: build(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 240, speed: 2, speeds: [0.5, 1, 2, 4, 8], label: 'Race controls' });
    function rebuild() { player.setSteps(build()); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: preset,
      options: [{ value: 'random', label: 'Random' }, { value: 'nearly', label: 'Nearly sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'sorted', label: 'Sorted' }, { value: 'few', label: 'Few unique' }],
      onChange: function (v) { preset = v; rebuild(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 6, max: 20, value: n, onChange: function (v) { n = v; rebuild(); }, onInput: function (v) { n = v; } });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed = (seed * 7919 + 13) % 100003; rebuild(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Comparing' }, { state: 'swap', label: 'Moving' }, { state: 'key', label: 'Held / smallest' }, { state: 'done', label: 'Final' }]);
    return player;
  };

  /* ================================================================== cost: grouped bars */
  function inputFor(preset, n, seed) {
    var o = { min: 1, max: 999, seed: seed };
    if (preset === 'sorted') return V.presets.sorted(n, o);
    if (preset === 'reversed') return V.presets.reversed(n, o);
    if (preset === 'nearly') return V.presets.nearlySorted(n, Object.assign({ swaps: Math.max(1, Math.round(n / 10)) }, o));
    if (preset === 'few') return V.presets.fewUnique(n, Object.assign({ k: 4 }, o));
    return V.presets.random(n, o);
  }
  /* Average counts over several seeds for the random-ish presets (exact for sorted / reversed). */
  function averageCounts(preset, n) {
    var runs = preset === 'sorted' || preset === 'reversed' ? 1 : 24, acc = {};
    NAMES.forEach(function (a) { acc[a] = { comparisons: 0, moves: 0 }; });
    for (var r = 0; r < runs; r++) {
      var vals = inputFor(preset, n, 1000 + r * 37 + n);
      NAMES.forEach(function (a) { var c = S().count(a, vals); acc[a].comparisons += c.comparisons; acc[a].moves += c.swaps + c.shifts; });
    }
    NAMES.forEach(function (a) { acc[a].comparisons = Math.round(acc[a].comparisons / runs); acc[a].moves = Math.round(acc[a].moves / runs); });
    return acc;
  }
  L14.averageCounts = averageCounts;

  L14.initBars = function () {
    var fig = V.$('#fig-bars');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Comparisons and moves per algorithm' });
    var readout = fig.querySelector('[data-readout]');
    var preset = 'random', n = 32;
    var PRESET_NAME = { random: 'random', nearly: 'nearly sorted', reversed: 'reversed', sorted: 'sorted', few: 'few unique' };
    function draw(dur) {
      var c = averageCounts(preset, n);
      var avg = preset === 'sorted' || preset === 'reversed' ? '' : ' (average of 24 inputs)';
      chart.render({
        categories: NAMES.map(function (a) { return TITLE[a]; }),
        series: [
          { id: 'cmp', label: 'Comparisons', values: NAMES.map(function (a) { return c[a].comparisons; }), state: 'compare' },
          { id: 'mov', label: 'Swaps or shifts', values: NAMES.map(function (a) { return c[a].moves; }), state: 'swap' }
        ],
        y: { label: 'operations, n = ' + n + ', ' + PRESET_NAME[preset] + avg, min: 0 }
      }, { duration: dur === undefined ? 700 : dur });
      readout.innerHTML = NAMES.map(function (a) {
        return '<b>' + TITLE[a] + '</b>: ' + c[a].comparisons + ' comparisons, ' + c[a].moves + ' ' + MOVE[a];
      }).join(' · ') + '. For reference, n(n − 1)/2 = ' + (n * (n - 1) / 2) + '.';
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: preset,
      options: [{ value: 'random', label: 'Random' }, { value: 'nearly', label: 'Nearly sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'sorted', label: 'Sorted' }, { value: 'few', label: 'Few unique' }],
      onChange: function (v) { preset = v; draw(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 8, max: 64, step: 4, value: n, onInput: function (v) { n = v; draw(250); } });
    draw(0);
  };

  /* ================================================================== cost: growth vs n */
  L14.initGrowth = function () {
    var fig = V.$('#fig-growth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Operations as n grows' });
    var kase = 'random', metric = 'comparisons';
    var cache = {};
    function series(name) {
      var key = name + kase + metric;
      if (cache[key]) return cache[key];
      var pts = [];
      for (var n = 2; n <= 64; n += 2) {
        var runs = kase === 'random' ? 40 : 1, tot = 0;
        for (var r = 0; r < runs; r++) {
          var vals = inputFor(kase, n, 500 + r * 101 + n);
          var c = S().count(name, vals);
          tot += metric === 'comparisons' ? c.comparisons : c.swaps + c.shifts;
        }
        pts.push([n, Math.round(tot / runs * 10) / 10]);
      }
      return (cache[key] = pts);
    }
    var NOTE = {
      comparisons: {
        sorted: 'Sorted input: bubble and insertion sort make n − 1 comparisons, a straight line. Selection sort still makes n(n − 1)/2: it never notices the input is sorted.',
        random: 'Random input: all three curves bend upward like n². Insertion sort makes about half as many comparisons as the other two.',
        reversed: 'Reversed input: every pair is out of order, and all three make exactly n(n − 1)/2 comparisons. The three lines lie on top of each other.'
      },
      moves: {
        sorted: 'Sorted input: nothing is out of order, so nobody moves anything.',
        random: 'Random input: bubble swaps and insertion shifts both equal the number of inverted pairs, about n²/4. Selection sort stays under n − 1 swaps.',
        reversed: 'Reversed input: bubble and insertion sort move n(n − 1)/2 times. Selection sort makes just ⌊n/2⌋ swaps.'
      }
    };
    function draw(dur) {
      var ser = NAMES.map(function (a, k) { return { id: a, label: TITLE[a].replace(' sort', ''), points: series(a), color: [0, 1, 2][k] }; });
      ser.push({ id: 'ref', label: 'n(n − 1)/2', fn: function (n) { return n * (n - 1) / 2; }, domain: [2, 64], state: 'muted', dashed: true });
      chart.render({
        x: { label: 'input size n', min: 0, max: 64 },
        y: { label: (metric === 'comparisons' ? 'comparisons' : 'swaps or shifts') + (kase === 'random' ? ' (average)' : ''), min: 0, max: 2100 },
        series: ser
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').textContent = NOTE[metric][kase];
    }
    V.segmented(fig.querySelector('[data-case]'), {
      label: 'Input order', value: kase,
      options: [{ value: 'sorted', label: 'Sorted' }, { value: 'random', label: 'Random' }, { value: 'reversed', label: 'Reversed' }],
      onChange: function (v) { kase = v; draw(); }
    });
    V.segmented(fig.querySelector('[data-metric]'), {
      label: 'Count', value: metric,
      options: [{ value: 'comparisons', label: 'Comparisons' }, { value: 'moves', label: 'Swaps or shifts' }],
      onChange: function (v) { metric = v; draw(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Bubble' }, { state: 'compare', shape: 'line', label: 'Selection' }, { state: 'done', shape: 'line', label: 'Insertion' }, { state: 'muted', shape: 'dash', label: 'n(n − 1)/2' }]);
    draw(0);
  };

  /* ================================================================== which simple sort? */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Thousands of items or more?', col: 0, row: 0 },
      { id: 'fast', type: 'end', text: 'Merge sort or quicksort', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Already nearly sorted?', col: 0, row: 1 },
      { id: 'insA', type: 'end', text: 'Insertion sort', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Writes far costlier than reads?', col: 0, row: 2 },
      { id: 'insB', type: 'end', text: 'Insertion sort', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Must equal keys keep their order?', col: 0, row: 3 },
      { id: 'insC', type: 'end', text: 'Insertion sort', col: 1, row: 3 },
      { id: 'sel', type: 'end', text: 'Selection sort', col: 0, row: 4 },
      { id: 'bub', type: 'note', text: 'Bubble sort? Only as a one-pass “is it already sorted?” check.', col: 1, row: 4 }
    ],
    edges: [
      { from: 'q1', to: 'fast', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'insA', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'q4', label: 'yes' }, { from: 'q3', to: 'insB', label: 'no' },
      { from: 'q4', to: 'insC', label: 'yes' }, { from: 'q4', to: 'sel', label: 'no' }
    ]
  };
  var CHOOSE_WHY = {
    fast: '<b>Use an n log n sort.</b> At n = 10,000 a quadratic sort makes about 50 million comparisons; merge sort makes about 130,000. Lessons 15 and 16 build them. Real libraries still switch to insertion sort for the tiny pieces.',
    insA: '<b>Insertion sort.</b> It costs about n + (number of inverted pairs), so a nearly sorted input takes close to n comparisons. This is why Timsort and many library sorts use it on short, almost-ordered runs.',
    insB: '<b>Insertion sort.</b> Among the three it makes the fewest comparisons on average (about n²/4), it is stable, it works in place, and it stops early on sorted stretches.',
    insC: '<b>Insertion sort.</b> You need stability, and selection sort does not have it. Insertion sort keeps equal keys in order, at the price of up to n²/2 shifts.',
    sel: '<b>Selection sort.</b> It makes at most n − 1 swaps, whatever the input, which matters when each write is slow or wears out the memory. Its comparisons are always n(n − 1)/2.'
  };
  L14.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which simple sort should you use?', narrowWidth: 380 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q1'], taken = {};
    function show(d) {
      var cur = path[path.length - 1];
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: CHOOSE_WHY[cur] ? (function () { var o = {}; o[cur] = 'found'; return o; })() : {} }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box with its <b>yes</b> or <b>no</b> button.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    show(0);
  };
}());
