/* Lesson 17 — cost and comparison figures: the counting-sort break-even chart, the radix base chart, the grand table
   with animated sparklines, and the "which sort?" decision flowchart for the whole unit.
     L17.initCrossover(), L17.initRadixBase(), L17.initCompare(), L17.initChooser() */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L17 = V.lessons.l17;
  function S() { return V.algos.sorting; }
  function int(v) { return Math.round(v).toLocaleString('en-US'); }
  function compact(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(/\.0$/, '') + ' billion';
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + ' million';
    if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '') + ' thousand';
    return String(Math.round(v));
  }
  function niceN(v) {   // 10^(v/10) rounded to 2 significant figures
    var n = Math.pow(10, v / 10), p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / p) * p;
  }

  /* ================================================================== break-even chart */
  L17.initCrossover = function () {
    var fig = V.$('#fig-crossover');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Steps for counting sort and for a comparison sort against the key range k', height: 300 });
    var readout = fig.querySelector('[data-readout]');
    var expo = 30;   // n = 1000
    function draw(dur) {
      var n = niceN(expo), cmp = n * Math.log2(n), star = cmp - 2 * n;
      var ann = [];
      if (star >= 1) ann.push({ x: star, text: 'break-even k ≈ ' + int(star), state: 'pivot' });
      chart.render({
        x: { label: 'key range k (keys are 0 … k)', scale: 'log', min: 1, max: 1e9 },
        y: { label: 'steps', scale: 'log', min: Math.pow(10, Math.floor(Math.log10(n))), max: 1e10 },
        series: [
          { id: 'counting', label: 'counting sort: 2n + k', fn: function (k) { return 2 * n + k; }, domain: [1, 1e9], state: 'active' },
          { id: 'cmp', label: 'comparison sort: n log₂ n', fn: function () { return cmp; }, domain: [1, 1e9], state: 'compare' }
        ],
        annotations: ann
      }, { duration: dur === undefined ? 600 : dur });
      readout.innerHTML = 'With <b>n = ' + int(n) + '</b> items, an <em>n</em> log₂ <em>n</em> comparison sort takes about <b>' + compact(cmp) + '</b> steps. Counting sort takes 2n + k, so it wins while <b>k is below about ' + int(Math.max(0, star)) + '</b> (' + (star / n).toFixed(1) + ' × n). Past that, its count array costs more than the comparisons it saves.';
    }
    V.slider(fig.querySelector('[data-slider]'), {
      label: 'n (number of items)', min: 20, max: 60, step: 1, value: expo,
      format: function (v) { return int(niceN(v)); },
      onInput: function (v) { expo = v; draw(200); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Counting sort' }, { state: 'compare', shape: 'line', label: 'Comparison sort' }]);
    draw(0);
  };

  /* ================================================================== radix base chart */
  var SUP = { 2: '²', 4: '⁴', 8: '⁸', 11: '¹¹', 16: '¹⁶', 22: '²²' };
  L17.initRadixBase = function () {
    var fig = V.$('#fig-radixbase');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Steps of radix sort for different bases', height: 280 });
    var readout = fig.querySelector('[data-readout]');
    var bits = 32, N = 1e6, EXPS = [2, 4, 8, 11, 16, 22];
    function data() {
      return EXPS.map(function (e) { var b = Math.pow(2, e), d = Math.ceil(bits / e); return { e: e, b: b, d: d, ops: S().radixOps(N, d, b).total }; });
    }
    function draw(dur) {
      var rows = data(), best = rows.reduce(function (m, r) { return r.ops < m.ops ? r : m; }, rows[0]);
      var cmp = N * Math.log2(N);
      chart.render({
        categories: rows.map(function (r) { return '2' + SUP[r.e] + ' · ' + r.d + 'p'; }),
        series: [{ id: 'ops', label: 'steps', values: rows.map(function (r) { return r.ops; }), state: 'active' }],
        y: { label: 'basic steps (n = 1,000,000)', min: 0, max: Math.max.apply(null, rows.map(function (r) { return r.ops; })) * 1.08 },
        highlight: { category: '2' + SUP[best.e] + ' · ' + best.d + 'p' }
      }, { duration: dur === undefined ? 600 : dur });
      readout.innerHTML = 'For ' + bits + '-bit keys the best base here is <b>2' + SUP[best.e] + ' = ' + int(best.b) + '</b> with <b>' + best.d + ' pass' + (best.d === 1 ? '' : 'es') + '</b>: about ' + compact(best.ops) + ' steps, against ' + compact(cmp) + ' comparisons for <em>n</em> log₂ <em>n</em>. Tiny bases need many passes; huge bases pay for a huge count array on every pass. Labels read “base · d passes”.';
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Key size', value: String(bits),
      options: [{ value: '32', label: '32-bit keys' }, { value: '64', label: '64-bit keys' }],
      onChange: function (v) { bits = +v; draw(); }
    });
    draw(0);
  };

  /* ================================================================== the grand table */
  var ROWS = [
    { id: 'bubble', name: 'Bubble sort', best: ['n', 'O(n)'], avg: ['n2', 'O(n²)'], worst: ['n2', 'O(n²)'], space: ['1', 'O(1)'], stable: 1, inplace: 1, adaptive: 1, linear: 0, f: function (n) { return n * n / 2; }, note: 'early exit on sorted input' },
    { id: 'selection', name: 'Selection sort', best: ['n2', 'O(n²)'], avg: ['n2', 'O(n²)'], worst: ['n2', 'O(n²)'], space: ['1', 'O(1)'], stable: 0, inplace: 1, adaptive: 0, linear: 0, f: function (n) { return n * n / 2; }, note: 'at most n − 1 swaps' },
    { id: 'insertion', name: 'Insertion sort', best: ['n', 'O(n)'], avg: ['n2', 'O(n²)'], worst: ['n2', 'O(n²)'], space: ['1', 'O(1)'], stable: 1, inplace: 1, adaptive: 1, linear: 0, f: function (n) { return n * n / 4; }, note: 'n + inversions' },
    { id: 'merge', name: 'Merge sort', best: ['nlogn', 'O(n log n)'], avg: ['nlogn', 'O(n log n)'], worst: ['nlogn', 'O(n log n)'], space: ['n', 'O(n)'], stable: 1, inplace: 0, adaptive: 0, linear: 0, f: function (n) { return n * Math.log2(Math.max(2, n)); }, note: 'the stable n log n sort' },
    { id: 'quick', name: 'Quicksort', best: ['nlogn', 'O(n log n)'], avg: ['nlogn', 'O(n log n)'], worst: ['n2', 'O(n²)'], space: ['logn', 'O(log n)'], stable: 0, inplace: 1, adaptive: 0, linear: 0, f: function (n) { return 1.39 * n * Math.log2(Math.max(2, n)); }, note: 'fastest in practice; in place except for its O(log n) stack' },
    { id: 'heap', name: 'Heapsort', best: ['nlogn', 'O(n log n)'], avg: ['nlogn', 'O(n log n)'], worst: ['nlogn', 'O(n log n)'], space: ['1', 'O(1)'], stable: 0, inplace: 1, adaptive: 0, linear: 0, f: function (n) { return 2 * n * Math.log2(Math.max(2, n)); }, note: 'n log n worst case, no extra memory' },
    { id: 'counting', name: 'Counting sort', best: ['n', 'O(n + k)'], avg: ['n', 'O(n + k)'], worst: ['n', 'O(n + k)'], space: ['n', 'O(n + k)'], stable: 1, inplace: 0, adaptive: 0, linear: 1, f: function (n) { return 3 * n; }, note: 'small integer keys' },
    { id: 'radix', name: 'Radix sort (LSD)', best: ['n', 'O(d(n + b))'], avg: ['n', 'O(d(n + b))'], worst: ['n', 'O(d(n + b))'], space: ['n', 'O(n + b)'], stable: 1, inplace: 0, adaptive: 0, linear: 1, f: function (n) { return 3 * (2 * n + 10); }, note: 'fixed-width keys' },
    { id: 'bucket', name: 'Bucket sort', best: ['n', 'O(n + k)'], avg: ['n', 'O(n + k)'], worst: ['n2', 'O(n²)'], space: ['n', 'O(n + k)'], stable: 1, inplace: 0, adaptive: 0, linear: 1, f: function (n) { return 3 * n; }, note: 'evenly spread numbers' }
  ];
  var FILTERS = [
    { id: 'stable', label: 'Stable' }, { id: 'inplace', label: 'In place' }, { id: 'adaptive', label: 'Adaptive' }, { id: 'linear', label: 'Linear time' }
  ];

  L17.initCompare = function () {
    var fig = V.$('#fig-compare');
    var stage = fig.querySelector('[data-stage]');
    var toolbarSeg = fig.querySelector('[data-seg]');
    var note = fig.querySelector('[data-note]');
    var active = {}, scale = 'shared', N = 64;
    var wrap = h('div', { class: 'table-wrap l17-compare-wrap' });
    var table = h('table', { class: 'table table--compact l17-compare' });
    wrap.appendChild(table); stage.appendChild(wrap);
    function yes(v, label) { return h('td', { class: 'l17-yn ' + (v ? 'is-yes' : 'is-no'), 'aria-label': label + (v ? ': yes' : ': no') }, h('span', { 'aria-hidden': 'true' }, v ? '●' : '○'), h('span', { class: 'sr-only' }, v ? 'Yes' : 'No')); }
    function badge(o) { return h('span', { class: 'big-o', 'data-o': o[0] }, o[1]); }
    function sparkline(row, i, ymax) {
      var W = 132, Hh = 40, pad = 3, pts = [], samples = 48;
      var fmax = scale === 'fit' ? row.f(N) : ymax;
      for (var s = 0; s <= samples; s++) {
        var n = 1 + (N - 1) * s / samples;
        var y = Math.min(1, row.f(n) / fmax);
        pts.push([pad + (W - 2 * pad) * s / samples, Hh - pad - (Hh - 2 * pad) * y]);
      }
      var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      var svg = V.s('svg', { class: 'l17-spark', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': row.name + ': work grows ' + (row.linear ? 'in a nearly straight line' : row.id === 'merge' || row.id === 'quick' || row.id === 'heap' ? 'a little faster than a line' : 'like a parabola') + ' with n', style: { '--i': i } },
        V.s('line', { class: 'l17-spark__base', x1: pad, x2: W - pad, y1: Hh - pad, y2: Hh - pad }),
        V.s('path', { class: 'l17-spark__area', d: d + 'L' + (W - pad) + ' ' + (Hh - pad) + 'L' + pad + ' ' + (Hh - pad) + 'Z' }),
        V.s('path', { class: 'l17-spark__line', d: d, pathLength: 1 }),
        V.s('circle', { class: 'l17-spark__dot', cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3 }));
      return svg;
    }
    function draw() {
      V.clear(table);
      var ymax = Math.max.apply(null, ROWS.map(function (r) { return r.f(N); }));
      table.appendChild(h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Sort'), h('th', { scope: 'col' }, 'Growth as n rises to ' + N), h('th', { scope: 'col' }, 'Best'), h('th', { scope: 'col' }, 'Average'), h('th', { scope: 'col' }, 'Worst'),
        h('th', { scope: 'col' }, 'Extra space'), h('th', { scope: 'col', class: 'l17-yn' }, 'Stable'), h('th', { scope: 'col', class: 'l17-yn' }, 'In place'), h('th', { scope: 'col', class: 'l17-yn' }, 'Adaptive')
      )));
      var body = h('tbody', {});
      var kept = 0;
      ROWS.forEach(function (r, i) {
        var match = FILTERS.every(function (f) { return !active[f.id] || r[f.id]; });
        if (match) kept++;
        var tr = h('tr', { class: 'l17-row' + (match ? '' : ' is-dim'), 'data-row': r.id },
          h('th', { scope: 'row' }, h('span', { class: 'l17-rowname' }, r.name), h('small', { class: 'l17-rownote' }, r.note)),
          h('td', { class: 'l17-sparkcell' }, sparkline(r, i, ymax), h('small', { class: 'l17-sparkcap' }, '≈ ' + int(r.f(N)) + ' steps at n = ' + N)),
          h('td', {}, badge(r.best)), h('td', {}, badge(r.avg)), h('td', {}, badge(r.worst)), h('td', {}, badge(r.space)),
          yes(r.stable, 'Stable'), yes(r.inplace, 'In place'), yes(r.adaptive, 'Adaptive'));
        body.appendChild(tr);
      });
      table.appendChild(body);
      var on = FILTERS.filter(function (f) { return active[f.id]; }).map(function (f) { return f.label.toLowerCase(); });
      note.textContent = on.length ? kept + ' of 9 sorts are ' + on.join(' and ') + '.' : (scale === 'shared'
        ? 'Same vertical scale: the three linear sorts hug the floor next to the three quadratic sorts. Bucket sort’s worst case (one crowded bucket) is not drawn.'
        : 'Each curve is stretched to fill its own box, so you see the shape only: parabola, slightly bent line, straight line.');
    }
    var fl = fig.querySelector('[data-filters]');
    FILTERS.forEach(function (f) {
      var b = h('button', { type: 'button', class: 'btn btn--sm l17-filter', 'aria-pressed': 'false' }, f.label);
      b.addEventListener('click', function () { active[f.id] = !active[f.id]; b.setAttribute('aria-pressed', String(!!active[f.id])); b.classList.toggle('is-on', !!active[f.id]); draw(); });
      fl.appendChild(b);
    });
    V.segmented(toolbarSeg, {
      label: 'Curve scale', value: scale,
      options: [{ value: 'shared', label: 'Same scale' }, { value: 'fit', label: 'Each fits its box' }],
      onChange: function (v) { scale = v; draw(); }
    });
    draw();
    V.onVisible(stage, function (vis) { stage.classList.toggle('is-live', vis); });
  };

  /* ================================================================== which sort? */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Under ~20 items,\nor nearly sorted?', col: 0, row: 0 },
      { id: 'ins', type: 'end', text: 'Insertion sort', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Whole-number keys or\nfixed-length digits?', col: 0, row: 1 },
      { id: 'q2b', type: 'decision', text: 'Key range k about\nn or smaller?', col: 1, row: 1 },
      { id: 'counting', type: 'end', text: 'Counting sort', col: 2, row: 1, narrow: { col: 1, row: 2 } },
      { id: 'radix', type: 'end', text: 'Radix sort', col: 1, row: 2, narrow: { col: 1, row: 3 } },
      { id: 'q3', type: 'decision', text: 'Decimals spread evenly\nover a known range?', col: 0, row: 3, narrow: { col: 0, row: 4 } },
      { id: 'bucket', type: 'end', text: 'Bucket sort', col: 1, row: 3, narrow: { col: 1, row: 4 } },
      { id: 'q4', type: 'decision', text: 'Must equal keys\nkeep their order?', col: 0, row: 4, narrow: { col: 0, row: 5 } },
      { id: 'merge', type: 'end', text: 'Merge sort (Timsort)', col: 1, row: 4, narrow: { col: 1, row: 5 } },
      { id: 'q5', type: 'decision', text: 'Need a worst-case\nguarantee, no extra memory?', col: 0, row: 5, narrow: { col: 0, row: 6 } },
      { id: 'heap', type: 'end', text: 'Heapsort (introsort)', col: 1, row: 5, narrow: { col: 1, row: 6 } },
      { id: 'quick', type: 'end', text: 'Quicksort', col: 0, row: 6, narrow: { col: 0, row: 7 } }
    ],
    edges: [
      { from: 'q1', to: 'ins', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'q2b', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q2b', to: 'counting', label: 'yes' }, { from: 'q2b', to: 'radix', label: 'no' },
      { from: 'q3', to: 'bucket', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'merge', label: 'yes' }, { from: 'q4', to: 'q5', label: 'no' },
      { from: 'q5', to: 'heap', label: 'yes' }, { from: 'q5', to: 'quick', label: 'no' }
    ]
  };
  var WHY = {
    ins: '<b>Insertion sort.</b> For a handful of items, or data that is already almost in order, it does about n + (out-of-order pairs) steps with a tiny constant, in place and stable. Fast library sorts hand short runs to it.',
    counting: '<b>Counting sort.</b> With keys 0…k and k not much bigger than n, it takes 2n + k steps and no comparisons: exam scores, ages, letters, small ids. It is stable, and the count array is the price.',
    radix: '<b>Radix sort.</b> Split wide integers or fixed-length strings into digits and make d passes of counting sort: d · (n + b) steps. It needs a stable inner sort. Base 256 is a good default.',
    bucket: '<b>Bucket sort.</b> For evenly spread decimals, such as uniform random numbers, it averages about n steps. If the numbers cluster into one bucket it degrades to n².',
    merge: '<b>Merge sort.</b> n log n always, stable, and friendly to linked lists and disk files, at the price of n extra space. Python and Java sort objects with Timsort, a merge sort that uses insertion sort on short runs.',
    heap: '<b>Heapsort, or introsort.</b> n log n in the worst case, in place. Choose it when you cannot risk quicksort’s n² case or extra memory. It is not stable and is slower in practice than quicksort.',
    quick: '<b>Quicksort.</b> The fastest general comparison sort on average and in place. Pick pivots well: C++’s std::sort is introsort, quicksort with a heapsort safety net for bad pivots.'
  };
  L17.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which sorting algorithm should you use?', narrowWidth: 460 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q1'], taken = {};
    function show(d) {
      var cur = path[path.length - 1];
      var states = {};
      if (WHY[cur]) states[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: states }, { duration: d === undefined ? 550 : d });
      out.innerHTML = WHY[cur] || 'Answer the question in the highlighted box with its <b>yes</b> or <b>no</b> button.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    show(0);
  };
}());
