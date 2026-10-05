/* Lesson 16 — Quick sort & quickselect: boot, hero teaser, variations, checks and the summary card.
   Step generators: js/algos/16-quick-sort.js. Helpers and smaller figures: js/lessons/16-quick-sort-figs.js.
   Labs, cost chart and race: js/lessons/16-quick-sort-lab.js. Heavy figures start lazily near the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L16 = V.lessons.l16;
  function S() { return V.algos.sorting; }
  function fmt(v) { return L16.fmt(v); }

  /* ================================================================== hero teaser: pivots glow, values split around them */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = V.views.array(stage, { mode: 'bars', showIndices: false, showValues: false, maxValue: 100, minValue: 0, label: 'Quick sort animation', cellSize: 34 });
    var rng = V.rng(16);
    function data() {
      var st = S().quickLomuto(V.presets.random(11, { min: 12, max: 98, unique: true, rng: rng }), { pivot: 'last' })
        .filter(function (s) { return ['pivot', 'move', 'small', 'large', 'place', 'base', 'done'].indexOf(s.kind) >= 0; })
        .map(function (s) { return Object.assign({}, s, { pointers: [], regions: s.regions.map(function (r) { return Object.assign({}, r, { label: undefined }); }) }); });
      view.reset(); view.prepare(st);
      return st;
    }
    var first = data();
    var place = first.findIndex(function (s) { return s.kind === 'place'; });
    V.teaser(stage, { steps: first, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 300, holdMs: 1700, regenerate: data, staticIndex: place > 0 ? place : first.length - 1 });
  }

  /* ================================================================== variations */
  function variations() {
    // code snippets
    var SNIPS = {
      random: '// draw the pivot position at random\nconst p = lo + Math.floor(Math.random() * (hi - lo + 1));\n// park it at the end, then partition as usual\n[a[p], a[hi]] = [a[hi], a[p]];',
      median: 'const mid = lo + ((hi - lo) >> 1);\n// put the three values in order\nif (a[mid] < a[lo]) swap(a, mid, lo);\nif (a[hi] < a[lo]) swap(a, hi, lo);\nif (a[hi] < a[mid]) swap(a, hi, mid);\n// the median is now a[mid]: park it at a[hi]\nswap(a, mid, hi);',
      intro: 'function introSort(a, lo, hi, limit) {\n  if (hi - lo < 16) return insertionSort(a, lo, hi);\n  if (limit === 0) return heapSort(a, lo, hi);\n  const p = partition(a, lo, hi);\n  introSort(a, lo, p - 1, limit - 1);\n  introSort(a, p + 1, hi, limit - 1);\n}\n// start with limit = 2 * Math.floor(Math.log2(n))',
      stack: 'function quickSort(a, lo, hi) {\n  while (lo < hi) {\n    const p = partition(a, lo, hi);\n    if (p - lo < hi - p) {   // left side is smaller:\n      quickSort(a, lo, p - 1);   // recurse into it\n      lo = p + 1;                // loop on the right\n    } else {\n      quickSort(a, p + 1, hi);\n      hi = p - 1;\n    }\n  }\n}',
      topk: 'function kSmallest(a, k) {\n  quickselect(a, k);   // now a[0..k-1] hold the k smallest\n  // order just those k, if you need them ordered\n  return a.slice(0, k).sort((x, y) => x - y);\n}'
    };
    V.$$('[data-code-block]').forEach(function (el) { V.codeBlock(el, SNIPS[el.getAttribute('data-code-block')] || '', 'js'); });

    // random pivot: a looping mini partition with a fresh random pivot each lap
    (function () {
      var stage = V.$('[data-mini="random"]');
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 38, showIndices: false, label: 'Random pivot mini' });
      var rng = V.rng(88), seed = 1;
      function data() {
        var st = S().partitionLomuto(V.presets.random(8, { min: 1, max: 9, unique: true, rng: rng }), { pivot: 'random', seed: seed++ })
          .filter(function (s) { return ['pivot', 'move', 'small', 'large', 'place'].indexOf(s.kind) >= 0; })
          .map(function (s) { return L16.quiet(s, { keepRegions: false, keepPointers: true }); });
        st = st.map(function (s) { return Object.assign({}, s, { pointers: s.pointers.filter(function (p) { return p.name === 'pivot' || p.name === 'p'; }).map(function (p) { return Object.assign({}, p, { label: '' }); }) }); });
        view.reset(); view.prepare(st);
        return st;
      }
      var first = data();
      var pi = first.findIndex(function (s) { return s.kind === 'place'; });
      V.teaser(stage, { steps: first, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 620, holdMs: 1500, regenerate: data, staticIndex: pi > 0 ? pi : first.length - 1 });
    }());

    // median of three: the candidate step of a real trace, frozen
    (function () {
      var stage = V.$('[data-mini="median"]');
      var st = S().partitionLomuto([8, 3, 5, 1, 9, 2, 6], { pivot: 'median3' }).filter(function (s) { return s.kind === 'pivot'; })[0];
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 40, showIndices: true, pointerStyle: 'chip', label: 'Median of three: 8, 1 and 6 are candidates; 6 is the median and becomes the pivot' });
      view.render(Object.assign({}, st, { regions: [] }), { duration: 0 });
      stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', 'Array 8, 3, 5, 1, 9, 2, 6. The first, middle and last values, 8, 1 and 6, are compared; 6 is the middle one by value and becomes the pivot.');
    }());

    // introsort: a tiny decision diagram
    (function () {
      var stage = V.$('[data-mini="intro"]');
      V.views.flowchart(stage, {
        nodes: [
          { id: 'a', type: 'decision', text: 'depth > 2·log₂ n ?', col: 0, row: 0 },
          { id: 'heap', type: 'end', text: 'heapsort this range', col: 1, row: 0 },
          { id: 'b', type: 'decision', text: 'range < 16 ?', col: 0, row: 1 },
          { id: 'ins', type: 'end', text: 'insertion sort', col: 1, row: 1 },
          { id: 'q', type: 'process', text: 'partition, recurse', col: 0, row: 2 }
        ],
        edges: [
          { from: 'a', to: 'heap', label: 'yes' }, { from: 'a', to: 'b', label: 'no' },
          { from: 'b', to: 'ins', label: 'yes' }, { from: 'b', to: 'q', label: 'no' }
        ]
      }, { label: 'Introsort decision diagram', narrowWidth: 300 });
    }());

    // stack depth: two bars
    (function () {
      var stage = V.$('[data-mini="stack"]');
      var n = 64, r = S().quickCount(L16.inputOf('sorted', n), { pivot: 'last' });
      var chart = V.views.chart(stage, { type: 'bar', height: 190, label: 'Deepest recursion for a chain of splits' });
      chart.render({ categories: ['Recurse both sides', 'Smaller side first'], series: [{ id: 'depth', label: 'Deepest stack', values: [r.depth, r.stackDepth], state: 'swap' }], y: { label: 'stack frames, n = ' + n, min: 0 } }, { duration: 0 });
      V.$('[data-stack-note]').textContent = 'Sorted input with a last-element pivot, n = ' + n + ': the recursion is ' + r.depth + ' calls deep, but looping on the larger side needs only ' + r.stackDepth + ' at a time.';
    }());

    // not stable: a real trace of [4a, 4b, 1]
    (function () {
      var stage = V.$('[data-mini="stable"]'), figure = stage.closest('figure');
      var st = S().partitionLomuto([{ value: 4, label: 'a' }, { value: 4, label: 'b' }, { value: 1 }], { pivot: 'last' });
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 50, showIndices: false, label: 'Partition of 4a, 4b, 1' });
      view.prepare(st);
      var cap = h('p', { class: 'fig__caption l16-stable-cap', 'aria-live': 'polite' });
      figure.insertBefore(cap, figure.querySelector('figcaption'));
      V.player({ root: figure, steps: st, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, caption: cap, baseStepMs: 1300, label: 'Stability demo controls' });
      V.$('[data-stable-note]').innerHTML = 'The two 4s start as 4<sub>a</sub>, 4<sub>b</sub>. The last swap sends 4<sub>a</sub> to the far end, behind 4<sub>b</sub>.';
    }());

    // top k: quickselect leaves the k smallest on the left
    (function () {
      var stage = V.$('[data-mini="topk"]');
      var st = S().quickselect([7, 2, 9, 4, 3, 8, 5, 1, 6], 3, { pivot: 'last' });
      var last = st[st.length - 1];
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 34, showIndices: false, label: 'After quickselect for k = 3' });
      view.render({ items: last.items.map(function (it) { return { id: it.id, value: it.value, state: it.state === 'found' ? 'found' : 'default' }; }), regions: [{ from: 0, to: 2, state: 'frontier', label: '3 smallest' }, { from: 3, to: last.items.length - 1, state: 'muted', label: 'the rest' }] }, { duration: 0 });
    }());
  }

  /* ================================================================== checks */
  function checks() {
    // quiz 1: array after one Lomuto partition (options computed from the real generator)
    (function () {
      var input = [6, 3, 9, 2, 8, 5];
      var st = S().partitionLomuto(input, { pivot: 'last' }), last = st[st.length - 1];
      var right = last.order.map(function (id) { return last.items.filter(function (it) { return it.id === id; })[0].value; });
      var sortedArr = input.slice().sort(function (a, b) { return a - b; });
      var stable = input.filter(function (v) { return v <= 5 && v !== 5; }).concat([5], input.filter(function (v) { return v > 5; }));
      var hoare = S().partitionHoare(input, { pivot: 'last' }), hl = hoare[hoare.length - 1];
      var hoareArr = hl.order.map(function (id) { return hl.items.filter(function (it) { return it.id === id; })[0].value; });
      var opts = [sortedArr, stable, right, hoareArr].filter(function (a, k, all) { return all.findIndex(function (b2) { return b2.join() === a.join(); }) === k; });
      while (opts.length < 4) opts.push(input.slice());
      function code(a) { return '<code>' + a.join(', ') + '</code>'; }
      var expl = { };
      expl[right.join()] = 'Right. Scan with pivot 5: 6 &gt; 5 stays; 3 ≤ 5 swaps with 6; 9 &gt; 5 stays; 2 ≤ 5 swaps with 6 (the first value of the big zone); 8 &gt; 5 stays. Finally 5 swaps with a[2], the first value of the big zone (9).';
      expl[stable.join()] = 'That keeps the small values in their original order, which Lomuto does not: each small value is swapped across the boundary, so the large value it swaps with jumps to the right.';
      expl[sortedArr.join()] = 'One partition does not sort: it only guarantees the small side, the pivot and the big side. The two sides may still be out of order inside.';
      expl[hoareArr.join()] = 'That is where a Hoare-style partition with the last element as the pivot ends up; this question is about Lomuto, which parks the pivot at the end and scans once.';
      var ans = opts.findIndex(function (a) { return a.join() === right.join(); });
      V.quiz('#quiz-lomuto', {
        kicker: 'Predict', id: 'l16-lomuto-array',
        question: 'Lomuto partition with the <em>last</em> value as pivot runs on <code>' + input.join(', ') + '</code>. What does the array look like afterwards?',
        options: opts.map(code), answer: ans,
        explain: opts.map(function (a) { return expl[a.join()] || 'That is the original array, unchanged: the scan swaps the small values forward, so the order changes.'; })
      });
    }());
    V.quiz('#quiz-quadratic', {
      id: 'l16-quadratic-inputs',
      question: 'Quick sort takes the <em>first</em> value as its pivot. Which of these inputs of distinct values make it quadratic? Pick all that apply.',
      options: ['Already sorted: 1, 2, 3, 4, 5, 6', 'Reversed: 6, 5, 4, 3, 2, 1', 'A random shuffle', 'Mixed order: 3, 1, 4, 2, 6, 5'],
      answer: [0, 1],
      explain: [
        'Yes. The first value is the smallest in its range, so one side is empty every time: n − 1, n − 2, … comparisons.',
        'Yes. The first value is the largest in its range every time, so the other side is empty: again a chain.',
        'No. A random pivot position in a random order splits at a random point, and random splits give about 1.39 n log₂ n on average.',
        'No. The first value 3 splits the other five into two and three, close to the middle. Only an input that gives a lopsided split at every level is quadratic. (The zig-zag 1, 6, 2, 5, 3, 4 looks bad but takes 13 comparisons, not the 15 of a sorted run.)'
      ]
    });
    V.quiz('#quiz-select', {
      id: 'l16-select-next',
      question: 'You want the 3rd smallest value, which would sit at index 2 of the sorted array. A partition of the whole array puts the pivot at index 5. What does quickselect do next?',
      options: ['Recurse on both sides, like quick sort', 'Recurse only on the left part, indexes 0 to 4', 'Recurse only on the right part, indexes 6 and up', 'Return the pivot'],
      answer: 1,
      explain: [
        'Quick sort would. Quickselect does not need the right side at all: it only holds values that belong at indexes above 5.',
        'Right. Index 2 is below the pivot’s final place, 5, so the answer is one of the five values left of it. The pivot and everything right of it can be discarded.',
        'Index 6 and up hold values larger than the pivot; the value that belongs at index 2 is smaller than the pivot.',
        'The pivot is the 6th smallest (index 5), not the 3rd. Its position tells you which side to search, not the answer.'
      ]
    });
    // click quiz: which value is guaranteed to be final?
    var host = V.$('#fig-click [data-stage]');
    var vals = [2, 4, 3, 5, 9, 8, 7];
    var view = V.views.array(host, { mode: 'boxes', cellSize: 54, label: 'Array after partitioning around 5' });
    view.render({
      items: vals.map(function (v, k) { return { id: 'k' + k, value: v, state: 'default' }; }),
      regions: [{ from: 0, to: 2, state: 'frontier', label: '≤ 5' }, { from: 4, to: 6, state: 'visited', label: '> 5' }]
    }, { duration: 0 });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l16-click-final',
      question: 'The Lomuto partition around 5 has just finished. Click the one value that is <em>guaranteed</em> to be in its final sorted place.',
      check: function (id) {
        if (id === 'k3') return true;
        if (id === 'k0') return { correct: false, message: '2 does happen to be in its final place here, but the partition does not promise it: with another input it would not be. Only one value is guaranteed.' };
        return { correct: false, message: fmt(vals[+id.slice(1)]) + ' is on one side of the pivot, but the order <em>inside</em> each side is still arbitrary. Look for the value the partition placed on purpose.' };
      },
      right: 'The pivot. Everything left of it is ≤ 5 and everything right of it is larger, so it can never move again. The other values are only known to be on the correct <em>side</em>.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tile(state, label, text, opts) {
      var viz = h('div', { class: 'summary__viz stage-grid', role: 'img', 'aria-label': label });
      var item = h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text));
      grid.appendChild(item);
      if (state) {
        var v = V.views.array(viz, Object.assign({ mode: 'boxes', cellSize: 26, showIndices: false, label: label }, opts || {}));
        v.render(state, { duration: 0 });
      }
      return viz;
    }
    function items(vals, states) { return vals.map(function (v, k) { return { id: 's' + k, value: v, state: (states && states[k]) || 'default' }; }); }
    tile({ items: items([3, 1, 2, 5, 9, 7, 8], { 3: 'done' }), regions: [{ from: 0, to: 2, state: 'frontier' }, { from: 4, to: 6, state: 'visited' }] },
      'Partition', 'Rearrange around a pivot: smaller values left, larger right. The pivot lands in its final place. One pass, about one comparison per value.');
    tile({ items: items([2, 4, 9, 3, 8, 5], { 5: 'pivot', 3: 'compare' }), regions: [{ from: 0, to: 1, state: 'frontier' }, { from: 2, to: 2, state: 'visited' }, { from: 3, to: 4, state: 'muted' }], pointers: [{ name: 'i', index: 1, state: 'frontier' }, { name: 'j', index: 3, state: 'compare' }] },
      'Lomuto and Hoare', 'Lomuto: one scanner, pivot at the end, pivot final. Hoare: two pointers meeting, fewer swaps, pivot not final.');
    tile({ items: items([1, 2, 3, 4, 5, 6, 7], { 3: 'pivot' }), pointers: [{ name: 'mid', index: 3, state: 'pivot', style: 'chip' }] },
      'The pivot decides', 'Middle or median of three: balanced tree, n log n. Always the smallest or largest: a chain, n²/2. Random pivots make bad luck rare.', { cellSize: 24 });
    tile({ items: items([1, 2, 3, 3, 3, 5, 4], { 2: 'done', 3: 'done', 4: 'done' }), regions: [{ from: 0, to: 1, state: 'frontier' }, { from: 2, to: 4, state: 'done' }, { from: 5, to: 6, state: 'visited' }] },
      'Three-way partition', 'Less | equal | greater in one pass. Equal keys are final at once, so many duplicates make it faster, not slower.', { cellSize: 24 });
    tile({ items: items([2, 1, 4, 9, 7, 8], { 2: 'found', 3: 'muted', 4: 'muted', 5: 'muted' }), regions: [{ from: 3, to: 5, state: 'muted' }], pointers: [{ name: 'k', index: 2, state: 'key', style: 'chip' }] },
      'Quickselect', 'Partition, then keep only the side that contains index k. Expected O(n) comparisons for the k-th smallest.');
    var viz = tile(null, 'Costs', 'Average O(n log n) comparisons, worst case O(n²). In place, O(log n) stack with the smaller side first. Not stable.');
    viz.appendChild(h('div', { class: 'cluster' }, h('span', { class: 'big-o big-o--lg', 'data-o': 'nlogn' }, 'O(n log n)'), h('span', { class: 'big-o big-o--lg', 'data-o': 'n2' }, 'O(n²)')));
  }

  /* ================================================================== boot */
  V.ready(function () {
    // labs start lazily; register their predictions now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l16-part-lomuto-lands', 'l16-part-hoare-split', 'l16-lab-lomuto-swap', 'l16-lab-hoare-swap', 'l16-lab-lomuto-next', 'l16-flag-blue', 'l16-select-side'].forEach(V.quizScore.register);
    V.tabs('#variants');
    heroTeaser();
    checks();
    summaryCard();
    L16.whenNear('#fig-hand', L16.initHand);
    L16.whenNear('#mini-facts', L16.initFacts);
    L16.whenNear('#fig-partition', L16.initPartition);
    L16.whenNear('#fig-levels', L16.initLevels);
    L16.whenNear('#lab-fig', function () { L16.lab = L16.initLab(); });
    L16.whenNear('#fig-trees', L16.initTrees);
    L16.whenNear('#fig-strategies', L16.initStrategies);
    L16.whenNear('#fig-luck', L16.initLuck);
    L16.whenNear('#fig-choose', L16.initChoose);
    L16.whenNear('#fig-flag', L16.initFlag);
    L16.whenNear('#fig-dups', L16.initDups);
    L16.whenNear('#sel-fig', L16.initSelect);
    L16.whenNear('#fig-selwork', L16.initSelWork);
    L16.whenNear('#fig-race', function () { L16.race = L16.initRace(); });
    L16.whenNear('#variants', variations);
  });
}());
