/* Lesson 21 — the code-synced labs: the heap lab (insert / extract / peek / build), the heap sort lab, the two
   flowcharts wired to the lab, the sift-up and sift-down stepping figures, and the array priority-queue figure.
   Step generators: js/algos/21-heaps.js (VDSA.algos.heap). Shared views: js/lessons/21-heaps-views.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L21 = V.lessons.l21;
  function H() { return V.algos.heap; }
  var fmt = L21.fmt;
  var MAX = 15;

  /* ================================================================== flowcharts, wired to the lab */
  var UP_SPEC = {
    nodes: [
      { id: 'place', type: 'process', text: 'Append x at index n − 1\ni ← n − 1', col: 0, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'test', type: 'decision', text: 'i > 0 and a[i] beats\nits parent?', col: 1, row: 0, narrow: { col: 0, row: 1 } },
      { id: 'swap', type: 'process', text: 'swap a[i] with its parent\ni ← parent', col: 1, row: 1, narrow: { col: 1, row: 1 } },
      { id: 'done', type: 'end', text: 'Stop: heap is valid', col: 2, row: 0, narrow: { col: 0, row: 2 } }
    ],
    edges: [
      { from: 'place', to: 'test' },
      { from: 'test', to: 'swap', label: 'yes' },
      { from: 'test', to: 'done', label: 'no' },
      { from: 'swap', to: 'test' }
    ]
  };
  var DOWN_SPEC = {
    nodes: [
      { id: 'start', type: 'process', text: 'Put the value at i\n(the root, after a lift)', col: 0, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'haschild', type: 'decision', text: 'Does i have a child?\n2i + 1 < n', col: 1, row: 0, narrow: { col: 0, row: 1 } },
      { id: 'pick', type: 'process', text: 'c ← the child that\nbeats its sibling', col: 2, row: 0, narrow: { col: 1, row: 1 } },
      { id: 'done', type: 'end', text: 'Stop: heap is valid', col: 1, row: 1, narrow: { col: 0, row: 3 } },
      { id: 'cmp', type: 'decision', text: 'Does a[c] beat\na[i]?', col: 2, row: 1, narrow: { col: 1, row: 2 } },
      { id: 'swap', type: 'process', text: 'swap a[i] and a[c]\ni ← c', col: 2, row: 2, narrow: { col: 1, row: 3 } }
    ],
    edges: [
      { from: 'start', to: 'haschild' },
      { from: 'haschild', to: 'pick', label: 'yes' },
      { from: 'haschild', to: 'done', label: 'no' },
      { from: 'pick', to: 'cmp' },
      { from: 'cmp', to: 'swap', label: 'yes' },
      { from: 'cmp', to: 'done', label: 'no' },
      { from: 'swap', to: 'haschild', via: { fromSide: 'left', toSide: 'bottom', points: [[1.5, 2], [1.5, 1.5]] } }
    ]
  };

  /* One object the player can drive: ids arrive as 'up:test' / 'down:cmp' (or null). */
  L21.flowMux = (function () {
    var charts = { up: null, down: null }, current = { up: null, down: null };
    var mux = {
      attach: function (which, chart) { charts[which] = chart; },
      highlight: function (id, ctx) {
        var dur = ctx && ctx.duration !== undefined ? ctx.duration : 0;
        ['up', 'down'].forEach(function (w) {
          var node = null;
          if (id && id.indexOf(w + ':') === 0) node = id.slice(w.length + 1);
          var c = charts[w];
          if (!c) return;
          if (node === current[w]) return;
          current[w] = node;
          c.render(node ? { active: node } : {}, { duration: dur });
        });
      }
    };
    return mux;
  }());

  function flowFigures() {
    var upFig = V.$('#fig-flow-up'), downFig = V.$('#fig-flow-down');
    V.legend(upFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }]);
    V.legend(downFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }]);
    L21.flowMux.attach('up', V.views.flowchart(upFig.querySelector('[data-stage]'), UP_SPEC, { label: 'Sift-up flowchart' }));
    L21.flowMux.attach('down', V.views.flowchart(downFig.querySelector('[data-stage]'), DOWN_SPEC, { label: 'Sift-down flowchart' }));
  }
  L21.flowFigures = flowFigures;

  /* ================================================================== the heap lab */
  var PRESET_LISTS = {
    random: function (rng) { return V.presets.random(10, { min: 1, max: 60, rng: rng }); },
    descending: function () { return [58, 51, 47, 40, 33, 29, 22, 17, 11, 6]; },
    sorted: function () { return [6, 11, 17, 22, 29, 33, 40, 47, 51, 58]; },
    dupes: function () { return [7, 3, 7, 3, 7, 1, 3, 1]; }
  };

  function heapLab() {
    var fig = V.$('#lab-fig');
    var legend = [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, L21.LEG.found, L21.LEG.visited, L21.LEG.hover];
    V.legend(fig.querySelector('[data-legend]'), legend);
    var kind = 'min', uid = 0, gen = 0, rng = V.rng(21);
    var items = [];
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: H().CODE('insert', kind), default: 'pseudo', title: 'insert', maxHeight: 420 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'key', parent: 'compare', c: 'compare', 'a[i]': 'key', 'a[parent]': 'compare', 'a[c]': 'compare', top: 'found', x: 'key' } });
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: 'Heap lab' });
    var msg = h('p', { class: 'l21-msg', role: 'status', 'aria-live': 'polite' });
    var lastOp = 'insert';

    function fullStep() {
      var dummy = []; for (var i = 0; i < MAX; i++) dummy.push({ id: 'z' + i, value: i });
      return H().snapshot(dummy).steps[0];
    }
    var FULL = fullStep();

    function idle(caption) { return H().snapshot(items, { kind: kind, caption: caption }); }
    var player = V.player({
      root: fig, steps: [], render: function (s, ctx) { pair.render(s, ctx); },
      code: code, vars: vars, flow: L21.flowMux,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterStates: { comparisons: 'compare', swaps: 'swap' }, baseStepMs: 1050, label: 'Heap lab controls'
    });

    function load(steps, op) {
      lastOp = op;
      if (op) { code.setSource(H().CODE(op === 'peek' ? 'insert' : op, kind)); }
      pair.reset();
      pair.prepare(steps.concat([FULL]));
      player.setSteps(steps);
    }
    function show(caption) { load(idle(caption).steps, null); }

    function setMsg(text) { msg.textContent = text || ''; }
    function newHeap(values) {
      gen++;
      var list = values.map(function (v, i) { return { id: 'g' + gen + '_' + i, value: v }; });
      var built = H().build(list, { kind: kind });
      items = built.items;
      setMsg('');
      show('A ' + kind + '-heap of ' + items.length + ' values. Insert a value, extract the ' + (kind === 'min' ? 'smallest' : 'largest') + ', or build a new heap from your own list.');
    }
    function run(op, arg) {
      setMsg('');
      var r;
      if (op === 'insert') {
        if (items.length >= MAX) { setMsg('The lab holds at most ' + MAX + ' values so the tree stays readable. Extract one first.'); return; }
        r = H().insert(items, arg, { kind: kind, id: 'n' + (uid++) });
      } else if (op === 'extract') {
        if (!items.length) { setMsg('The heap is empty: there is nothing to extract.'); return; }
        r = H().extract(items, { kind: kind });
      } else if (op === 'peek') {
        if (!items.length) { setMsg('The heap is empty: there is nothing to peek at.'); return; }
        r = H().peek(items, { kind: kind });
      }
      items = r.items;
      load(r.steps, op);
      player.play();
    }
    function buildFrom(values) {
      gen++;
      var list = values.map(function (v, i) { return { id: 'g' + gen + '_' + i, value: v }; });
      var r = H().build(list, { kind: kind });
      items = r.items;
      setMsg('');
      load(r.steps, 'build');
      player.play();
    }

    // toolbar
    var tb = fig.querySelector('[data-toolbar]');
    var valueField = h('input', { class: 'field l21-num', type: 'number', min: 0, max: 99, step: 1, value: 4, inputmode: 'numeric', 'aria-label': 'Value to insert, 0 to 99' });
    var row1 = h('div', { class: 'l21-tbrow' },
      h('div', { class: 'l21-mode', 'data-kind': '' }),
      h('div', { class: 'l21-tbgroup' }, h('label', { class: 'field-label', for: 'l21-value' }, 'Value'), valueField,
        h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: function () {
          var v = parseInt(valueField.value, 10);
          if (!isFinite(v) || v < 0 || v > 99) { setMsg('Type a whole number from 0 to 99.'); return; }
          run('insert', v);
        } }, 'Insert'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { run('extract'); } }, kind === 'min' ? 'Extract min' : 'Extract max'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { run('peek'); } }, 'Peek')));
    valueField.id = 'l21-value';
    var extractBtn = row1.querySelectorAll('.btn')[1];
    var row2 = h('div', { class: 'l21-buildrow' });
    tb.appendChild(row1); tb.appendChild(row2); tb.appendChild(msg);
    V.segmented(row1.querySelector('[data-kind]'), {
      label: 'Heap type', value: 'min', options: [{ value: 'min', label: 'Min-heap' }, { value: 'max', label: 'Max-heap' }],
      onChange: function (v) {
        kind = v;
        extractBtn.textContent = kind === 'min' ? 'Extract min' : 'Extract max';
        newHeap(items.map(function (it) { return it.value; }));
      }
    });
    var INITIAL = PRESET_LISTS.random(rng).slice(0, 8);
    V.inputRow(row2, {
      label: 'Build a heap from your list (up to ' + MAX + ' numbers, 0 to 99)', value: INITIAL, applyLabel: 'Build heap',
      parse: { min: 0, max: 99, minCount: 1, maxCount: MAX, integers: true },
      presets: [
        { label: 'Random', value: function () { return PRESET_LISTS.random(rng); } },
        { label: 'Descending', value: PRESET_LISTS.descending, title: 'Worst case for a min-heap: every value must sink' },
        { label: 'Sorted', value: PRESET_LISTS.sorted, title: 'A sorted array is already a min-heap' },
        { label: 'Duplicates', value: PRESET_LISTS.dupes }
      ],
      onApply: function (values) { buildFrom(values); }
    });

    // predictions
    player.addCheckpoint(function (steps) {
      var k = steps.findIndex(function (s) { return s.kind === 'compare' && s.flow === 'up:test'; });
      return k < 0 ? -1 : k + 1;
    }, function (c) {
      var p = c.prev, x = p.vars['a[i]'], par = p.vars['a[parent]'], swaps = c.step.kind === 'swap', mx = p.heapKind === 'max';
      return {
        question: 'The new value <code>' + fmt(x) + '</code> is compared with its parent <code>' + fmt(par) + '</code> in a ' + (mx ? 'max' : 'min') + '-heap. What happens next?',
        options: ['They swap: ' + fmt(x) + ' moves up', 'Nothing: ' + fmt(x) + ' stays where it is'],
        answer: swaps ? 0 : 1,
        explain: swaps
          ? ['In a ' + (mx ? 'max' : 'min') + '-heap the parent must be ' + (mx ? '≥' : '≤') + ' its child. ' + fmt(x) + ' is ' + (mx ? 'larger' : 'smaller') + ' than ' + fmt(par) + ', so the rule is broken and they trade places.', 'The rule is broken here: ' + fmt(x) + ' is ' + (mx ? 'larger' : 'smaller') + ' than its parent, so it cannot stay.']
          : ['Correct. The parent ' + fmt(par) + ' is already ' + (mx ? '≥' : '≤') + ' ' + fmt(x) + ', so the rule holds and the climb stops.', 'A swap would put the ' + (mx ? 'smaller' : 'larger') + ' value above the ' + (mx ? 'larger' : 'smaller') + ' one, which breaks the rule. The parent ' + fmt(par) + ' already fits.']
      };
    }, { id: 'heap-lab-predict-up' });
    player.addCheckpoint(function (steps) {
      var k = steps.findIndex(function (s, i) { return s.kind === 'haschild' && s.edges.length === 2 && steps[i + 1] && steps[i + 1].kind === 'pick'; });
      return k < 0 ? -1 : k + 1;
    }, function (c) {
      var p = c.prev, l = p.edges[0][1], r = p.edges[1][1], mx = p.heapKind === 'max';
      var lv = p.items[l].value, rv = p.items[r].value;
      var chosen = c.step.vars.c === l ? 0 : 1;
      var win = mx ? 'larger' : 'smaller';
      return {
        question: 'Sift-down is at index ' + c.step.vars.i + ' with two children: left <code>' + fmt(lv) + '</code> (index ' + l + ') and right <code>' + fmt(rv) + '</code> (index ' + r + '). Which child does it consider swapping with?',
        options: ['The left child, ' + fmt(lv), 'The right child, ' + fmt(rv)],
        answer: chosen,
        explain: [chosen === 0
          ? 'Yes: ' + fmt(lv) + ' is the ' + win + ' child' + (lv === rv ? ' (a tie goes to the left child)' : '') + '. It is the only one that can safely take the parent’s seat.'
          : 'Not this one: the right child ' + fmt(rv) + ' is the ' + win + ' child, and that is the one that must move up.',
          chosen === 1
          ? 'Yes: ' + fmt(rv) + ' is the ' + win + ' child. If the other child moved up instead, it would sit above a ' + win + ' sibling and break the rule.'
          : 'Not this one: the left child ' + fmt(lv) + ' is the ' + win + ' child' + (lv === rv ? ' (a tie goes to the left)' : '') + ', so it is the one to move up.']
      };
    }, { id: 'heap-lab-predict-child' });

    newHeap(INITIAL);
    return { player: player, pair: pair };
  }

  /* ================================================================== the heap sort lab */
  function sortLab() {
    var fig = V.$('#sort-fig');
    V.legend(fig.querySelector('[data-legend]'), [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, L21.LEG.visited, L21.LEG.done, { state: 'active', label: 'Heap region' }]);
    var SORT_DEFAULT = [5, 9, 2, 7, 3, 8, 1, 6];
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: H().CODE_SORT, default: 'pseudo', title: 'heapSort', maxHeight: 420 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'key', c: 'compare', 'a[i]': 'key', 'a[c]': 'compare', end: 'done' } });
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: 'Heap sort', index: true });
    var player = V.player({
      root: fig, steps: [], render: function (s, ctx) { pair.render(s, ctx); },
      code: code, vars: vars, flow: L21.flowMux,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterStates: { comparisons: 'compare', swaps: 'swap' }, baseStepMs: 900, label: 'Heap sort controls'
    });
    // flow ids from the sort steps light the shared sift-down flowchart too, which is helpful, not required
    function load(values) {
      var steps = H().sort(values);
      pair.reset(); pair.prepare(steps);
      player.setSteps(steps);
    }
    player.addCheckpoint(function (steps) {
      var k = steps.findIndex(function (s) { return s.kind === 'sswap'; });
      return k;
    }, function (c) {
      var p = c.prev, s = c.step, heapVals = s.items.slice(0, s.size).map(function (it) { return it.value; });
      var ok = V.algos.heap.isHeap(heapVals, 'max');
      var top = p.items[0].value, last = p.items[s.size].value;
      return {
        question: 'The root <code>' + fmt(top) + '</code> swaps with the last heap slot (<code>' + fmt(last) + '</code>) and the heap shrinks by one. Is the array a valid max-heap again right after the swap?',
        options: ['Yes: swapping two values cannot break the heap', 'No: the new root may be too small, so it must sift down'],
        answer: ok ? 0 : 1,
        explain: ok
          ? ['This time it happens to hold: the new root ' + fmt(s.items[0].value) + ' is still at least as large as both children. It usually does not.', 'Usually right, but here the swapped-in value already beats both children.']
          : ['A value from the bottom of the tree is now the root. It is probably smaller than its children, so sift-down has to repair it.', 'Correct: the value ' + fmt(last) + ' came from the bottom, and it is smaller than at least one child of the root. Sift-down repairs the heap.']
      };
    }, { id: 'heapsort-predict-swap' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (up to 12, 0 to 99)', value: SORT_DEFAULT, applyLabel: 'Sort',
      parse: { min: 0, max: 99, minCount: 0, maxCount: 12, integers: true },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(9, { min: 1, max: 60 }); } },
        { label: 'Sorted', value: function () { return V.presets.sorted(9, { min: 1, max: 60 }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(9, { min: 1, max: 60 }); } },
        { label: 'Few unique', value: function () { return V.presets.fewUnique(9, { min: 1, max: 60, k: 3 }); } },
        { label: 'One value', value: [42] }
      ],
      onApply: load
    });
    load(SORT_DEFAULT);
    return { player: player };
  }

  /* ================================================================== sift-up / sift-down stepping figures */
  function steppingFigure(figSel, variants, legend, opts) {
    opts = opts || {};
    var fig = V.$(figSel);
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: fig.querySelector('.fig__title').textContent, treeOptions: { levelHeight: 52 } });
    function stepsOf(v) { return v.steps(); }
    var cur = variants[0], steps = stepsOf(cur);
    pair.prepare(steps);
    var player = V.player({ root: fig, steps: steps, render: function (s, ctx) { pair.render(s, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterStates: { comparisons: 'compare', swaps: 'swap' },
      baseStepMs: opts.stepMs || 1150, label: opts.label || 'Step through' });
    if (variants.length > 1) {
      V.segmented(fig.querySelector('[data-seg]'), {
        label: 'Scenario', value: variants[0].id, options: variants.map(function (v) { return { value: v.id, label: v.label }; }),
        onChange: function (id) {
          cur = variants.filter(function (v) { return v.id === id; })[0];
          var st = stepsOf(cur);
          pair.reset(); pair.prepare(st);
          player.setSteps(st);
        }
      });
    }
    V.legend(fig.querySelector('[data-legend]'), legend);
    return player;
  }
  function items(vals, prefix) { return vals.map(function (v, i) { return { id: (prefix || 'h') + i, value: v }; }); }

  function siftFigures() {
    steppingFigure('#fig-up', [
      { id: 'root', label: 'Climbs to the root', steps: function () { return H().insert(items([4, 9, 6, 12, 10, 8, 7]), 2, { id: 'new' }).steps; } },
      { id: 'half', label: 'Stops halfway', steps: function () { return H().insert(items([4, 9, 6, 12, 10, 11, 7]), 8, { id: 'new' }).steps; } },
      { id: 'none', label: 'Does not move', steps: function () { return H().insert(items([4, 9, 6, 12, 10, 8, 7]), 15, { id: 'new' }).steps; } }
    ], [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, L21.LEG.hover], { label: 'Sift-up controls' });
    steppingFigure('#fig-down', [
      { id: 'leaf', label: 'Sinks to a leaf', steps: function () { return H().extract(items([2, 5, 3, 9, 7, 8, 6, 11, 10])).steps; } },
      { id: 'early', label: 'Stops early', steps: function () { return H().extract(items([1, 3, 4, 7, 8, 6, 5])).steps; } },
      { id: 'one', label: 'One child only', steps: function () { return H().extract(items([1, 4, 2, 6, 5, 3])).steps; } }
    ], [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, L21.LEG.found, L21.LEG.hover], { label: 'Sift-down controls' });
  }

  /* ================================================================== the array priority queues of the problem */
  function pqProblemFigure() {
    var fig = V.$('#fig-pq');
    var INITIAL = [5, 2, 8, 3, 9, 4];
    var OPS = [{ op: 'extract' }, { op: 'insert', value: 6 }, { op: 'extract' }, { op: 'insert', value: 7 }];
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 52, showIndices: true, label: 'Array priority queue' });
    var kind = 'unsorted';
    function make() {
      return H().pqRun(kind, INITIAL, OPS).map(function (s) {
        var tag = '<span class="l21-op">' + s.opLabel + '</span> ';
        return Object.assign({}, s, { caption: tag + s.caption });
      });
    }
    var steps = make();
    view.prepare(steps);
    var player = V.player({ root: fig, steps: steps, render: function (s, ctx) { view.render({ items: s.items, pointers: s.pointers }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { cost: 'Cost so far (cells compared, moved or written)' },
      counterStates: { cost: 'swap' }, baseStepMs: 900, label: 'Array priority queue controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Array kind', value: kind, options: [{ value: 'unsorted', label: 'Unsorted array' }, { value: 'sorted', label: 'Sorted array (largest first)' }],
      onChange: function (v) { kind = v; var st = make(); view.reset(); view.prepare(st); player.setSteps(st); }
    });
    V.legend(fig.querySelector('[data-legend]'), [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, { state: 'found', label: 'Smallest (removed)' }]);
    return player;
  }

  L21.labs = { heapLab: heapLab, sortLab: sortLab, siftFigures: siftFigures, pqProblemFigure: pqProblemFigure, flowFigures: flowFigures };
}());
