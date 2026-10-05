/* Lesson 21 — the remaining figures: index-mapping explorer, build-heap with per-level work, the n log n chart,
   top-k streaming, merging k lists, the priority-queue comparison and its chart, static minis and variations.
   Step generators: js/algos/21-heaps.js. Shared views: js/lessons/21-heaps-views.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L21 = V.lessons.l21;
  function H() { return V.algos.heap; }
  var fmt = L21.fmt;

  function items(vals, prefix) { return vals.map(function (v, i) { return { id: (prefix || 'h') + i, value: v }; }); }

  /* ================================================================== intuition minis: same keys, three valid heaps */
  function partialMinis() {
    var row = V.$('#mini-partial');
    var trees = [
      { vals: [1, 2, 3, 4, 5, 6], cap: '<b>Sorted order</b> is a heap too.' },
      { vals: [1, 3, 2, 5, 4, 6], cap: '<b>Another order.</b> 3 and 2 are siblings in any order.' },
      { vals: [1, 2, 3, 6, 4, 5], cap: '<b>A third.</b> Nodes in different branches, like 6 and 5, are never compared.' }
    ];
    trees.forEach(function (t) {
      var svg = L21.miniTree(t.vals, { states: { 0: 'found' }, r: 16, indices: false, label: 'A min-heap holding 1 to 6 as the array ' + t.vals.join(', ') });
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage l21-minitree' }, svg), h('figcaption', { html: t.cap })));
    });
  }

  /* ================================================================== a click quiz on a tree with one mistake */
  function badNodeFigure() {
    var fig = V.$('#fig-badnode');
    var stage = fig.querySelector('[data-stage]');
    var vals = [3, 8, 5, 9, 4, 7, 6];
    stage.appendChild(L21.miniTree(vals, { ids: true, r: 19, levelH: 56, indices: true, idLabel: function (v, i) { return 'Node ' + v + ' at index ' + i + ', parent ' + (i ? vals[(i - 1) >> 1] : 'none'); }, label: 'A tree of seven numbers to check' }));
    V.clickQuiz(stage, {
      el: '#quiz-badnode',
      question: 'Click the node that breaks the min-heap rule (a child that is smaller than its parent).',
      answer: '4',
      right: '4 sits below 8, and a min-heap needs the parent to be at most its children. Sift-up would repair it: 4 swaps with 8, and then stops, because 3 ≤ 4.',
      wrong: 'Check each edge: is the upper value at most the lower one? Only one edge fails.'
    });
  }

  /* ================================================================== index-mapping explorer */
  function mapExplorer() {
    var fig = V.$('#fig-map');
    var N = 15, n = N, sel = 4, base = 0;
    var formula = fig.querySelector('[data-formula]');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Selected index' }, { state: 'compare', label: 'Parent' }, { state: 'frontier', label: 'Children' }, L21.LEG.hover]);
    function snapshot() {
      var its = [], edges = [];
      var p = sel > 0 ? (sel - 1) >> 1 : -1, l = 2 * sel + 1, r = 2 * sel + 2;
      for (var i = 0; i < n; i++) {
        var st = i === sel ? 'key' : i === p ? 'compare' : (i === l || i === r) ? 'frontier' : 'default';
        its.push({ id: 'm' + i, value: i + base, state: st });
      }
      if (p >= 0) edges.push([p, sel, 'compare']);
      if (l < n) edges.push([sel, l, 'frontier']);
      if (r < n) edges.push([sel, r, 'frontier']);
      return { items: its, order: its.map(function (x) { return x.id; }), size: n, pointers: [], regions: [], edges: edges };
    }
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: 'Index mapping', index: false, cellSize: 44, nodeSize: 40,
      arrayOptions: { showIndices: false } });
    pair.prepare([snapshot()]);
    function writeFormula() {
      var i = sel, p = (i - 1) >> 1, l = 2 * i + 1, r = 2 * i + 2;
      var b = base;
      function cell(cls, html) { return '<div class="l21-formula__cell ' + cls + '">' + html + '</div>'; }
      var shown = i + b;
      var par = i === 0 ? cell('is-none', '<span class="l21-formula__k">parent</span><span class="l21-formula__v">none</span><span class="l21-formula__e">the root has no parent</span>')
        : cell('is-parent', '<span class="l21-formula__k">parent</span><span class="l21-formula__v">' + (p + b) + '</span><span class="l21-formula__e">' +
          (b ? '⌊' + shown + ' / 2⌋' : '⌊(' + i + ' − 1) / 2⌋') + ' = ' + (p + b) + '</span>');
      function child(name, idx, expr) {
        return idx < n ? cell('is-child', '<span class="l21-formula__k">' + name + '</span><span class="l21-formula__v">' + (idx + b) + '</span><span class="l21-formula__e">' + expr + ' = ' + (idx + b) + '</span>')
          : cell('is-none', '<span class="l21-formula__k">' + name + '</span><span class="l21-formula__v">none</span><span class="l21-formula__e">' + (idx + b) + ' would be past the last index ' + (n - 1 + b) + '</span>');
      }
      var lc = child('left child', l, b ? '2 · ' + shown : '2 · ' + i + ' + 1');
      var rc = child('right child', r, b ? '2 · ' + shown + ' + 1' : '2 · ' + i + ' + 2');
      var lvl = Math.floor(Math.log2(i + 1));
      formula.innerHTML = '<div class="l21-formula__row">' + cell('is-sel', '<span class="l21-formula__k">selected i</span><span class="l21-formula__v">' + shown + '</span><span class="l21-formula__e">level ' + lvl + ' of ' + (Math.floor(Math.log2(n)) ) + '</span>') + par + lc + rc + '</div>' +
        '<p class="l21-formula__note">' + (l >= n ? 'Index ' + shown + ' is a <b>leaf</b>: it has no children.' : r >= n ? 'Index ' + shown + ' has <b>one child</b>: the last node is a left child.' : 'Index ' + shown + ' has two children.') +
        ' A heap of ' + n + ' values has ' + (Math.floor(n / 2)) + ' internal nodes and ' + (n - Math.floor(n / 2)) + ' leaves: everything from index ' + (Math.floor(n / 2) + b) + ' on.</p>';
    }
    function render(dur) {
      pair.render(snapshot(), { duration: dur === undefined ? 380 : dur });
      writeFormula();
    }
    pair.on('click', function (idx) { if (idx >= 0) { sel = idx; render(); } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Indexing', value: '0', options: [{ value: '0', label: '0-based' }, { value: '1', label: '1-based' }],
      onChange: function (v) { base = +v; render(200); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Values n', min: 1, max: N, value: n, onInput: function (v) { n = v; if (sel >= n) sel = n - 1; render(300); } });
    fig.querySelector('[data-prev]').addEventListener('click', function () { sel = (sel + n - 1) % n; render(); });
    fig.querySelector('[data-next]').addEventListener('click', function () { sel = (sel + 1) % n; render(); });
    pair.render(snapshot(), { duration: 0 });
    writeFormula();
  }

  /* ================================================================== build-heap with the per-level work panel */
  function workPanel(el, n) {
    var nh = H().nodesAtHeight(n), mw = H().maxWork(n), top = H().height(n);
    var scale = 1; Object.keys(mw).forEach(function (k) { scale = Math.max(scale, mw[k]); });
    V.clear(el);
    el.appendChild(h('p', { class: 'l21-work__title' }, 'Swaps spent at each height'));
    var rows = {};
    for (var hh = top; hh >= 0; hh--) {
      var max = mw[hh] || 0;
      var fill = h('span', { class: 'l21-work__fill' });
      var cap = h('span', { class: 'l21-work__cap', style: { width: (max / scale * 100) + '%' } }, fill);
      var num = h('span', { class: 'l21-work__num' });
      var r = h('div', { class: 'l21-work__row' },
        h('span', { class: 'l21-work__label' }, h('b', null, 'height ' + hh), h('small', null, nh[hh] + ' node' + (nh[hh] === 1 ? '' : 's') + (hh ? ' × ' + hh : ' (leaves)'))),
        h('span', { class: 'l21-work__bar' }, cap), num);
      rows[hh] = { fill: fill, num: num, max: max, scale: scale };
      el.appendChild(r);
    }
    var total = h('p', { class: 'l21-work__total' });
    el.appendChild(total);
    el.appendChild(h('p', { class: 'l21-work__note' }, 'A node at height h can sink at most h levels. Half of all nodes are leaves (height 0), a quarter sit at height 1, an eighth at height 2, so most of the work is cheap.'));
    var ceiling = 0; Object.keys(mw).forEach(function (k) { ceiling += mw[k]; });
    return {
      update: function (byHeight) {
        var t = 0;
        Object.keys(rows).forEach(function (k) {
          var v = (byHeight && byHeight[k]) || 0, r = rows[k];
          t += v;
          r.fill.style.width = (r.max ? Math.min(100, v / r.max * 100) : 0) + '%';
          r.num.textContent = r.max ? v + ' of ≤ ' + r.max : 'no work';
        });
        total.innerHTML = 'Total swaps so far <b>' + t + '</b>. The most any input could need: <b>' + ceiling + '</b>, which is less than n = <b>' + n + '</b>.';
      }
    };
  }

  function buildFigure() {
    var fig = V.$('#fig-build');
    var LISTS = {
      worst: { label: 'Descending', vals: [96, 88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 12, 8, 4, 2] },
      random: { label: 'Random', vals: [37, 12, 58, 5, 44, 21, 63, 9, 30, 51, 17, 70, 26, 3, 41] },
      heap: { label: 'Valid heap', vals: null }
    };
    LISTS.heap.vals = H().build(LISTS.random.vals).items.map(function (it) { return it.value; });
    var n = 15;
    var work = workPanel(fig.querySelector('[data-work]'), n);
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: 'Bottom-up build-heap' });
    function stepsFor(id) { return H().build(LISTS[id].vals).steps; }
    var steps = stepsFor('worst');
    pair.prepare(steps);
    var player = V.player({ root: fig, steps: steps,
      render: function (st, ctx) { pair.render(st, ctx); work.update(st.byHeight); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterStates: { comparisons: 'compare', swaps: 'swap' }, baseStepMs: 900, label: 'Build-heap controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Starting array', value: 'worst', options: Object.keys(LISTS).map(function (k) { return { value: k, label: LISTS[k].label }; }),
      onChange: function (id) { var st = stepsFor(id); pair.reset(); pair.prepare(st); player.setSteps(st); }
    });
    V.legend(fig.querySelector('[data-legend]'), [L21.LEG.key, L21.LEG.compare, L21.LEG.swap, L21.LEG.visited, L21.LEG.hover]);
  }

  /* n log n versus the real cost of building */
  function buildChart() {
    var fig = V.$('#fig-buildchart');
    var NS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
    var rng = V.rng(210);
    function desc(n) { var a = []; for (var i = 0; i < n; i++) a.push(n - i); return a; }
    function rand(n) { var a = []; for (var i = 0; i < n; i++) a.push(rng.int(0, 1e6)); return a; }
    var cache = {};
    function costs(n) {
      if (cache[n]) return cache[n];
      var d = desc(n), avg = { comparisons: 0, swaps: 0 }, T = 6;
      for (var t = 0; t < T; t++) { var c = H().count.buildBottomUp(rand(n)); avg.comparisons += c.comparisons / T; avg.swaps += c.swaps / T; }
      return (cache[n] = { ins: H().count.buildByInsert(d), up: H().count.buildBottomUp(d), avg: avg });
    }
    var metric = 'swaps', n = 64, log = false;
    function nearest(x) { var b = NS[0]; NS.forEach(function (v) { if (Math.abs(v - x) < Math.abs(b - x)) b = v; }); return b; }
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Cost of building a heap against n', height: 320 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'n', nlogn: 'n log₂ n', ins: 'Repeated insert, worst input', up: 'Bottom-up, worst input', avg: 'Bottom-up, random input' }, states: { ins: 'error', up: 'done', avg: 'frontier' } });
    function series() {
      var ref = metric === 'swaps' ? function (x) { return x; } : function (x) { return 2 * x; };
      return [
        { id: 'nlogn', label: 'n log₂ n', fn: function (x) { return x * Math.log2(x); }, domain: [1, 512], state: 'muted', dashed: true },
        { id: 'ins', label: 'repeated insert, worst input', points: NS.map(function (x) { return [x, Math.max(log ? 0.5 : 0, costs(x).ins[metric])]; }), state: 'error' },
        { id: 'ref', label: metric === 'swaps' ? 'n' : '2n', fn: ref, domain: [1, 512], state: 'muted' },
        { id: 'up', label: 'bottom-up, worst input', points: NS.map(function (x) { return [x, Math.max(log ? 0.5 : 0, costs(x).up[metric])]; }), state: 'done' },
        { id: 'avg', label: 'bottom-up, random input', points: NS.map(function (x) { return [x, Math.max(log ? 0.5 : 0, costs(x).avg[metric])]; }), state: 'frontier' }
      ];
    }
    function show(dur) {
      var nn = nearest(n);
      var y = log ? { label: (metric === 'swaps' ? 'swaps' : 'comparisons') + ' (log scale)', scale: 'log', min: 1, max: 10000 } : { label: metric === 'swaps' ? 'swaps' : 'comparisons', min: 0, max: 5200 };
      chart.render({ x: { label: 'n (number of values)', min: 1, max: 512, scale: log ? 'log' : 'linear' }, y: y, series: series(), highlight: [{ series: 'up', x: nn }] }, { duration: dur === undefined ? 600 : dur });
      var c = costs(nn);
      stats.update({ n: nn, nlogn: Math.round(nn * Math.log2(Math.max(1, nn))), ins: c.ins[metric], up: c.up[metric], avg: Math.round(c.avg[metric]) });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Count', value: 'swaps', options: [{ value: 'swaps', label: 'Swaps' }, { value: 'comparisons', label: 'Comparisons' }], onChange: function (v) { metric = v; show(); } });
    V.segmented(fig.querySelector('[data-seg2]'), { label: 'Scale', value: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { log = v === 'log'; show(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 1, max: 512, value: n, format: function (v) { return String(nearest(v)); }, onInput: function (v) { n = v; show(80); } });
    show(0);
  }

  /* ================================================================== top-k streaming */
  function topkFigure() {
    var fig = V.$('#fig-topk');
    var K = 3;
    var STREAMS = {
      random: { label: 'Random', vals: [7, 3, 9, 2, 8, 5, 10, 1, 6, 4] },
      rising: { label: 'Rising (worst)', vals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      falling: { label: 'Falling (best)', vals: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }
    };
    var stage = fig.querySelector('[data-stage]');
    var streamEl = h('div', { class: 'l21-stream' });
    var heapEl = h('div', { class: 'l21-topk-heap' });
    stage.appendChild(h('p', { class: 'l21-stage-label' }, 'The stream'));
    stage.appendChild(streamEl);
    stage.appendChild(h('p', { class: 'l21-stage-label' }, 'Min-heap of size ' + K + ' (root = weakest of the current top ' + K + ')'));
    stage.appendChild(heapEl);
    var streamView = V.views.array(streamEl, { mode: 'boxes', cellSize: 44, showIndices: false, label: 'The stream of values' });
    var pair = L21.pair(heapEl, { label: 'Top-k heap', nodeSize: 38, bare: true,
      map: function (st) { return { tree: H().treeState(st, { index: true }), array: { items: st.items, pointers: st.pointers, regions: [], length: st.k } }; } });
    function stepsFor(id) { return H().topK(STREAMS[id].vals, K); }
    function streamState(st) {
      return { items: st.stream.items, pointers: st.stream.next >= 0 ? [{ name: 'next', index: st.stream.next, state: 'key' }] : [] };
    }
    var steps = stepsFor('random');
    function prep(st) { streamView.reset(); streamView.prepare(st.map(streamState)); pair.reset(); pair.prepare(st); }
    prep(steps);
    var player = V.player({ root: fig, steps: steps,
      render: function (st, ctx) { streamView.render(streamState(st), { duration: ctx.duration }); pair.render(st, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterStates: { comparisons: 'compare', swaps: 'swap' }, baseStepMs: 1050, label: 'Top-k controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Stream', value: 'random', options: Object.keys(STREAMS).map(function (k) { return { value: k, label: STREAMS[k].label }; }),
      onChange: function (id) { var st = stepsFor(id); prep(st); player.setSteps(st); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Incoming value' }, { state: 'frontier', label: 'In the top-' + K + ' heap' }, { state: 'muted', label: 'Dropped' }, { state: 'compare', label: 'Compared' }, { state: 'done', label: 'Final top-' + K }]);
  }

  /* ================================================================== merging k sorted lists */
  function mergeFigure() {
    var fig = V.$('#fig-merge');
    var LISTS = [[1, 5, 9], [2, 3, 8], [4, 6, 7]];
    var stage = fig.querySelector('[data-stage]');
    var rowsEl = h('div', { class: 'l21-lists' });
    var heapEl = h('div', { class: 'l21-merge-heap' });
    stage.appendChild(rowsEl);
    stage.appendChild(h('p', { class: 'l21-stage-label' }, 'Min-heap of the current list heads (label = which list)'));
    stage.appendChild(heapEl);
    var rowsView = V.views.array(rowsEl, { mode: 'boxes', cellSize: 40, showIndices: false, label: 'Three sorted lists and the merged output' });
    var tree = V.views.tree(heapEl, { nodeSize: 40, label: 'Heap of list heads' });
    var steps = H().mergeK(LISTS);
    rowsView.prepare(steps.map(function (st) { return { rows: st.rows }; }));
    tree.prepare(steps.map(function (st) { return H().treeState(st, { index: false }); }));
    V.player({ root: fig, steps: steps,
      render: function (st, ctx) { rowsView.render({ rows: st.rows }, { duration: ctx.duration }); tree.render(H().treeState(st, { index: false }), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterStates: { comparisons: 'compare', swaps: 'swap' }, baseStepMs: 900, label: 'Merge controls' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Head of a list (in the heap)' }, { state: 'key', label: 'Value being sifted' }, { state: 'found', label: 'Smallest head' }, { state: 'muted', label: 'Already output' }, { state: 'done', label: 'Output' }]);
  }

  /* ================================================================== the three priority queues side by side */
  function costBars(el) {
    var rows = {};
    V.clear(el);
    el.appendChild(h('p', { class: 'l21-cost__title' }, 'Cost so far'));
    [['unsorted', 'Unsorted array'], ['sorted', 'Sorted array'], ['heap', 'Binary heap']].forEach(function (k) {
      var fill = h('span', { class: 'l21-cost__fill' });
      var num = h('span', { class: 'l21-cost__num' });
      rows[k[0]] = { fill: fill, num: num };
      el.appendChild(h('div', { class: 'l21-cost__row', 'data-kind': k[0] }, h('span', { class: 'l21-cost__label' }, k[1]), h('span', { class: 'l21-cost__bar' }, fill), num));
    });
    return {
      update: function (total, last, max) {
        Object.keys(rows).forEach(function (k) {
          rows[k].fill.style.width = (max ? total[k] / max * 100 : 0) + '%';
          rows[k].num.innerHTML = '<b>' + total[k] + '</b>' + (last && last[k] !== undefined ? ' <small>+' + last[k] + '</small>' : '');
        });
      }
    };
  }

  function pqCompareFigure() {
    var fig = V.$('#fig-pqcmp');
    var INITIAL = [5, 3, 8, 1, 9, 4, 7, 2];
    var PRESETS = {
      mixed: { label: 'Mixed', ops: [{ op: 'extract' }, { op: 'insert', value: 6 }, { op: 'extract' }, { op: 'insert', value: 0 }, { op: 'extract' }, { op: 'insert', value: 10 }] },
      inserts: { label: 'Only inserts', ops: [{ op: 'insert', value: 6 }, { op: 'insert', value: 0 }, { op: 'insert', value: 10 }, { op: 'insert', value: 4 }, { op: 'insert', value: 12 }] },
      extracts: { label: 'Only extracts', ops: [{ op: 'extract' }, { op: 'extract' }, { op: 'extract' }, { op: 'extract' }, { op: 'extract' }] }
    };
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 38, showIndices: false, label: 'Three priority queue implementations' });
    var bars = costBars(fig.querySelector('[data-cost]'));
    var LABELS = { unsorted: 'Unsorted array', sorted: 'Sorted array (largest first)', heap: 'Binary heap' };
    function framesFor(id) {
      var fr = H().pqFrames(INITIAL, PRESETS[id].ops);
      var max = 0; ['unsorted', 'sorted', 'heap'].forEach(function (k) { max = Math.max(max, fr[fr.length - 1].total[k]); });
      return fr.map(function (f, i) {
        var cap;
        if (i === 0) cap = 'The same eight values, stored three ways. Each operation below is applied to all three. Highlighted cells were compared, moved or written by the last operation.';
        else cap = '<span class="l21-op">' + f.label + '</span> Unsorted array: <b>' + f.cost.unsorted + '</b>. Sorted array: <b>' + f.cost.sorted + '</b>. Heap: <b>' + f.cost.heap + '</b>. ' +
          (f.op.op === 'extract' ? 'Extract is one step for the sorted array, a full scan for the unsorted one, and one path for the heap.' : 'Insert is one step for the unsorted array, ' + (f.cost.sorted > f.cost.unsorted + 1 ? 'a walk and shift of several cells for the sorted one' : 'almost free for the sorted one this time, because ' + (f.op.value !== undefined ? '<b>' + f.op.value + '</b> ' : 'the new value ') + 'already belongs at the end') + ', and one path for the heap.');
        return { frame: f, caption: cap, max: max, index: i };
      });
    }
    function viewState(st) {
      var rows = ['unsorted', 'sorted', 'heap'].map(function (k) { return { id: k, label: LABELS[k], items: st.frame.rows[k], showIndices: k === 'heap' }; });
      return { rows: rows };
    }
    var steps = framesFor('mixed');
    view.prepare(steps.map(viewState));
    var player = V.player({ root: fig, steps: steps,
      render: function (st, ctx) { view.render(viewState(st), { duration: ctx.duration }); bars.update(st.frame.total, i0(st) ? null : st.frame.cost, st.max); },
      caption: fig.querySelector('[data-caption]'), baseStepMs: 1400, label: 'Priority queue comparison controls' });
    function i0(st) { return st.index === 0; }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operations', value: 'mixed', options: Object.keys(PRESETS).map(function (k) { return { value: k, label: PRESETS[k].label }; }),
      onChange: function (id) { var st = framesFor(id); view.reset(); view.prepare(st.map(viewState)); player.setSteps(st); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Compared, moved or written by the last operation' }]);
  }

  function pqChart() {
    var fig = V.$('#fig-pqchart');
    var NS = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 320, 400];
    var rng = V.rng(211), cache = {};
    function costs(n) {
      if (cache[n]) return cache[n];
      var T = 3, out = { unsorted: 0, sorted: 0, heap: 0 };
      for (var t = 0; t < T; t++) {
        var v = []; for (var i = 0; i < n; i++) v.push(rng.int(0, 1e6));
        ['unsorted', 'sorted', 'heap'].forEach(function (k) { out[k] += H().pqWorkloadCost(k, v) / T; });
      }
      Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k]); });
      return (cache[n] = out);
    }
    var log = false, n = 128;
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Cost of n inserts and n extracts against n', height: 320 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'n', unsorted: 'Unsorted array', sorted: 'Sorted array', heap: 'Binary heap' }, states: { unsorted: 'active', sorted: 'compare', heap: 'done' } });
    function show(dur) {
      var y = log ? { label: 'cost (log scale)', scale: 'log', min: 10, max: 1e6 } : { label: 'cost (cells compared, moved or written)', min: 0, max: 100000 };
      chart.render({ x: { label: 'n (values inserted, then all extracted)', min: 2, max: 400 }, y: y,
        series: [
          { id: 'unsorted', label: 'unsorted array', points: NS.map(function (x) { return [x, costs(x).unsorted]; }), state: 'active' },
          { id: 'sorted', label: 'sorted array', points: NS.map(function (x) { return [x, costs(x).sorted]; }), state: 'compare' },
          { id: 'heap', label: 'binary heap', points: NS.map(function (x) { return [x, costs(x).heap]; }), state: 'done' }
        ], highlight: [{ series: 'heap', x: nearest(n) }, { series: 'unsorted', x: nearest(n) }] }, { duration: dur === undefined ? 600 : dur });
      var c = costs(nearest(n));
      stats.update({ n: nearest(n), unsorted: c.unsorted, sorted: c.sorted, heap: c.heap });
    }
    function nearest(x) { var b = NS[0]; NS.forEach(function (v) { if (Math.abs(v - x) < Math.abs(b - x)) b = v; }); return b; }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Scale', value: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { log = v === 'log'; show(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: 400, value: n, format: function (v) { return String(nearest(v)); }, onInput: function (v) { n = v; show(80); } });
    show(0);
  }

  /* ================================================================== variations */
  var LIB = {
    py: 'import heapq\n\nh = []\nheapq.heappush(h, 5)\nheapq.heappush(h, 2)\nheapq.heappush(h, 8)\nh[0]                # peek -> 2\nheapq.heappop(h)    # extract -> 2\n\nheapq.heapify(items)   # build in O(n)\n# max-heap: push -x, pop and negate',
    java: 'PriorityQueue<Integer> pq = new PriorityQueue<>();\npq.add(5); pq.add(2); pq.add(8);\npq.peek();   // 2\npq.poll();   // extract -> 2\n\n// max-heap:\nnew PriorityQueue<>(Comparator.reverseOrder());',
    cpp: 'std::priority_queue<int> pq;   // max-heap\npq.push(5); pq.push(2); pq.push(8);\npq.top();    // 8\npq.pop();\n\n// min-heap:\nstd::priority_queue<int, std::vector<int>, std::greater<int>> mn;'
  };

  function variations() {
    var started = false;
    V.tabs('#variants', { onChange: function (name) { if (name === 'decrease' && !started) { started = true; setTimeout(decreaseKey, 30); } } });
    V.$('[data-mini="max"]').appendChild(L21.miniTree([6, 4, 5, 1, 3, 2], { states: { 0: 'found' }, r: 16, label: 'A max-heap holding 1 to 6 as the array 6, 4, 5, 1, 3, 2' }));
    Object.keys(LIB).forEach(function (k) { V.codeBlock(V.$('[data-lib="' + k + '"]'), LIB[k], k === 'py' ? 'py' : k === 'java' ? 'java' : 'cpp'); });
  }
  function decreaseKey() {
    var fig = V.$('#fig-decrease');
    var pair = L21.pair(fig.querySelector('[data-stage]'), { label: 'Decrease-key' });
    var st = H().decreaseKey(items([1, 5, 2, 9, 8, 4, 3]), 4, 0).steps;
    pair.prepare(st);
    V.player({ root: fig, steps: st, render: function (s2, ctx) { pair.render(s2, ctx); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: 'Decrease-key controls' });
  }

  L21.more = { partialMinis: partialMinis, badNodeFigure: badNodeFigure, mapExplorer: mapExplorer, buildFigure: buildFigure, buildChart: buildChart,
    topkFigure: topkFigure, mergeFigure: mergeFigure, pqCompareFigure: pqCompareFigure, pqChart: pqChart, variations: variations };
}());
