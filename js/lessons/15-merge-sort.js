/* Lesson 15 — Merge sort & divide and conquer: page wiring, hero teaser, intuition minis, variations, checks and
   summary card. Step generators: js/algos/15-merge-sort.js (VDSA.algos.mergesort). Figures: js/lessons/15-merge-sort-figs.js
   (mechanism) and js/lessons/15-merge-sort-lab.js (lab, race, charts, chooser). Heavy figures start lazily. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L15 = V.lessons.l15;
  function M() { return V.algos.mergesort; }

  /* ================================================================== hero teaser: split down, merge up */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 90, showIndices: false, label: 'Merge sort animation' });
    var rng = V.rng(15);
    function data() {
      var st = M().mergeLevels(V.presets.random(6, { min: 1, max: 9, unique: true, rng: rng })).map(function (x) { return L15.stripLabels(x); });
      view.reset(); view.prepare(st);
      return st;
    }
    var first = data();
    var lastSplit = 0;
    first.forEach(function (x, k) { if (x.kind === 'split') lastSplit = k; });
    V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 1150, holdMs: 1900, regenerate: data, staticIndex: lastSplit + 2 });
  }

  /* ================================================================== intuition: divide, conquer, combine */
  function intuitionMinis() {
    var host = V.$('#mini-intuition');
    function mini(title, cap, build) {
      var stage = h('div', { class: 'mini__stage l15-mini-stage', role: 'img', 'aria-label': title + ': ' + cap });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l15-mini-title' }, title), stage, h('figcaption', { html: cap })));
      build(stage);
    }
    var rng = V.rng(1501);
    mini('1 · Divide', '<b>Cut the pile in half,</b> again and again, until every piece is a single paper.', function (stage) {
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 26, showIndices: false, label: 'Divide mini' });
      function data() {
        var st = M().mergeLevels(V.presets.random(8, { min: 1, max: 9, unique: true, rng: rng })).filter(function (x) { return x.kind === 'start' || x.kind === 'split'; }).map(function (x) { return L15.stripLabels(x); });
        view.reset(); view.prepare(st); return st;
      }
      var first = data();
      V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 900, holdMs: 1400, regenerate: data, staticIndex: first.length - 1 });
    });
    mini('2 · Conquer', '<b>Sort each half</b> the same way. Trust the recursion: it hands back two sorted piles.', function (stage) {
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 26, showIndices: false, label: 'Conquer mini' });
      function data() {
        var v = V.presets.random(8, { min: 1, max: 9, unique: true, rng: rng });
        function items(a, b) { return v.map(function (x, k) { return { id: 'q' + k, value: x, index: 0, state: 'default' }; }); }
        var left = v.slice(0, 4).map(function (x, k) { return { id: 'q' + k, value: x }; }), right = v.slice(4).map(function (x, k) { return { id: 'q' + (k + 4), value: x }; });
        function sortedBy(arr) { return arr.slice().sort(function (x, y) { return x.value - y.value; }); }
        function frame(l, r, ls, rs) {
          var its = [];
          l.forEach(function (x, k) { its.push({ id: x.id, value: x.value, state: ls, index: k }); });
          r.forEach(function (x, k) { its.push({ id: x.id, value: x.value, state: rs, index: 4 + k }); });
          return { items: its, breaks: [4], pointers: [], regions: [] };
        }
        var st = [frame(left, right, 'default', 'default'), frame(sortedBy(left), right, 'visited', 'default'), frame(sortedBy(left), sortedBy(right), 'visited', 'visited')];
        view.reset(); view.prepare(st); return st;
      }
      var first = data();
      V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 1100, holdMs: 1400, regenerate: data, staticIndex: 2 });
    });
    mini('3 · Combine', '<b>Merge the two sorted piles:</b> compare the tops, move the smaller. Nothing is ever looked at twice.', function (stage) {
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 26, showIndices: false, label: 'Combine mini' });
      function data() {
        var a = V.presets.random(8, { min: 1, max: 9, unique: true, rng: rng }).sort(function (x, y) { return x - y; });
        var st = M().mergeRuns(a.filter(function (x, k) { return k % 2 === 0; }), a.filter(function (x, k) { return k % 2 === 1; }).reverse().reverse()).map(function (x) { return L15.stripLabels(x); });
        view.reset(); view.prepare(st); return st;
      }
      var first = data();
      V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 650, holdMs: 1400, regenerate: data, staticIndex: Math.floor(first.length / 2) });
    });
  }

  /* ================================================================== variations */
  function kwaySteps() {
    var runs = [[2, 6, 9], [1, 4, 8], [3, 5, 7]], front = [0, 0, 0], out = [], steps = [];
    var total = 9, cmp = 0;
    function snap(state, taken, pointerRows) {
      var rows = runs.map(function (r, ri) {
        var items = [];
        r.forEach(function (v, k) { if (k >= front[ri] || false) items.push({ id: 'k' + ri + '_' + k, value: v, index: k, state: state[ri] === k ? 'compare' : 'visited' }); });
        return { id: 'run' + ri, label: 'run ' + (ri + 1), items: items, length: 3, showIndices: false };
      });
      var outItems = out.map(function (o, k) { return { id: o.id, value: o.value, index: k, state: taken === o.id ? 'swap' : 'done' }; });
      rows.push({ id: 'out', label: 'output', items: outItems, length: total, showIndices: false });
      var ptrs = [];
      runs.forEach(function (r, ri) { if (front[ri] < r.length) ptrs.push({ name: 'i' + (ri + 1), row: 'run' + ri, index: front[ri], state: 'active', side: 'above' }); });
      steps.push({ rows: rows, pointers: ptrs, regions: [] });
    }
    snap({}, null);
    for (var t = 0; t < total; t++) {
      var best = -1;
      for (var r = 0; r < 3; r++) if (front[r] < runs[r].length && (best < 0 || runs[r][front[r]] < runs[best][front[best]])) best = r;
      var mark = {}; for (r = 0; r < 3; r++) if (front[r] < runs[r].length) mark[r] = front[r];
      var st = {}; Object.keys(mark).forEach(function (r2) { st[r2] = mark[r2]; });
      // highlight only the winning front, all fronts are candidates
      var w = { id: 'k' + best + '_' + front[best], value: runs[best][front[best]] };
      out.push(w); front[best]++;
      var stateMap = {}; stateMap[best] = -1;
      snap({}, w.id);
    }
    return steps;
  }
  function listSteps() {
    var A = [{ id: 'a1', v: 1 }, { id: 'a4', v: 4 }, { id: 'a7', v: 7 }], B = [{ id: 'b2', v: 2 }, { id: 'b3', v: 3 }, { id: 'b9', v: 9 }];
    var next = { a1: 'a4', a4: 'a7', a7: null, b2: 'b3', b3: 'b9', b9: null };
    var val = {}; A.concat(B).forEach(function (n) { val[n.id] = n.v; });
    var steps = [], merged = [], ia = 0, ib = 0, tail = null;
    function nodes(hl) {
      var order = merged.concat(A.slice(ia).map(function (n) { return n.id; }), B.slice(ib).map(function (n) { return n.id; }));
      return {
        order: order,
        nodes: order.map(function (id) {
          return { id: id, value: val[id], next: next[id], state: merged.indexOf(id) >= 0 ? 'done' : 'default', nextState: hl === id ? 'swap' : undefined };
        }),
        pointers: [
          { name: 'a', target: ia < A.length ? A[ia].id : null, state: 'active', side: 'above' },
          { name: 'b', target: ib < B.length ? B[ib].id : null, state: 'frontier', side: 'above' }
        ].concat(tail ? [{ name: 'tail', target: tail, state: 'swap', side: 'below' }] : [])
      };
    }
    steps.push(nodes());
    while (ia < A.length && ib < B.length) {
      var takeA = val[A[ia].id] <= val[B[ib].id], pick = takeA ? A[ia].id : B[ib].id;
      if (tail) next[tail] = pick;
      merged.push(pick); if (takeA) ia++; else ib++;
      var prev = tail; tail = pick;
      steps.push(nodes(prev));
    }
    var rest = ia < A.length ? A.slice(ia) : B.slice(ib);
    if (rest.length) { next[tail] = rest[0].id; steps.push(nodes(tail)); }
    return steps;
  }
  function variations() {
    V.tabs('#variants');
    var C = {
      inv: 'function countInversions(a, lo = 0, hi = a.length - 1) {\n  if (hi - lo < 1) return 0;\n  const mid = (lo + hi) >> 1;\n  let count = countInversions(a, lo, mid) + countInversions(a, mid + 1, hi);\n  const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);\n  let i = 0, j = 0, k = lo;\n  while (i < L.length && j < R.length) {\n    if (L[i] <= R[j]) a[k++] = L[i++];\n    else { count += L.length - i; a[k++] = R[j++]; }  // jumps over the rest of L\n  }\n  while (i < L.length) a[k++] = L[i++];\n  while (j < R.length) a[k++] = R[j++];\n  return count;\n}',
      hybrid: 'const CUTOFF = 16;\nfunction sort(a, lo, hi) {\n  if (hi - lo < CUTOFF) return insertionSort(a, lo, hi);  // tiny piece: stop splitting\n  const mid = (lo + hi) >> 1;\n  sort(a, lo, mid); sort(a, mid + 1, hi);\n  if (a[mid] <= a[mid + 1]) return;   // halves already in order: skip the merge\n  merge(a, lo, mid, hi);\n}',
      kway: 'function mergeK(runs) {                // every run is sorted\n  const front = runs.map(() => 0), out = [];\n  for (;;) {\n    let best = -1;\n    for (let r = 0; r < runs.length; r++)\n      if (front[r] < runs[r].length &&\n          (best < 0 || runs[r][front[r]] < runs[best][front[best]])) best = r;\n    if (best < 0) return out;\n    out.push(runs[best][front[best]++]);\n  }\n}                                       // a heap of the fronts makes each pick O(log k)',
      list: 'function mergeLists(a, b) {\n  const dummy = { next: null };\n  let tail = dummy;\n  while (a && b) {\n    if (a.value <= b.value) { tail.next = a; a = a.next; }\n    else                    { tail.next = b; b = b.next; }\n    tail = tail.next;\n  }\n  tail.next = a || b;                   // attach whatever is left\n  return dummy.next;\n}'
    };
    Object.keys(C).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), C[k], 'js'); });
    V.codeBlock(V.$('[data-code-block="bottomup"]'), 'function mergeSortBottomUp(a) {\n  const n = a.length;\n  for (let width = 1; width < n; width *= 2) {          // runs of 1, 2, 4, 8, ...\n    for (let lo = 0; lo < n - width; lo += 2 * width) {\n      const mid = lo + width - 1;\n      const hi = Math.min(lo + 2 * width - 1, n - 1);\n      merge(a, lo, mid, hi);                             // the same merge as before\n    }\n  }\n}', 'js');

    // count inversions: a merge with a counter
    var st = V.$('[data-mini="inv"]');
    var view = V.views.array(st, { mode: 'boxes', cellSize: 34, showIndices: false, label: 'Counting inversions while merging' });
    var steps = M().mergeRuns([3, 5, 8], [1, 4, 9], { inversions: true }).map(function (x) { return L15.stripLabels(x); });
    view.prepare(steps);
    var note = V.$('[data-inv-note]');
    V.teaser(st, { steps: steps, render: function (x, ctx) { view.render(x, { duration: ctx.duration }); note.innerHTML = 'Merging 3, 5, 8 with 1, 4, 9. Inversions found so far: <b>' + x.counters.inversions + '</b>' + (x.kind === 'done' ? ' (the array 3, 5, 8, 1, 4, 9 has exactly 5).' : '.'); }, stepMs: 800, holdMs: 1800, staticIndex: steps.length - 1 });

    // hybrid: insertion sort on runs of 4, then merge
    var v = [9, 4, 7, 2, 8, 1, 6, 3, 5, 12, 10, 11];
    function srt(a) { return a.slice().sort(function (x, y) { return x - y; }); }
    var blocks = [v.slice(0, 4), v.slice(4, 8), v.slice(8)].map(srt);
    var m8 = srt(blocks[0].concat(blocks[1])), all = srt(v);
    function st_(vals, state) { return vals.map(function (x) { return { value: x, state: state }; }); }
    L15.staticRuns(V.$('[data-mini="hybrid"]'), { cellSize: 24, label: 'Twelve values: runs of four sorted by insertion sort, then merged', rows: [
      { label: 'input', items: st_(v, 'default'), breaks: [] },
      { label: 'insertion sort', items: st_([].concat(blocks[0], blocks[1], blocks[2]), 'visited'), breaks: [4, 8] },
      { label: 'merge', items: st_(m8.concat(blocks[2]), 'visited'), breaks: [8] },
      { label: 'merge', items: st_(all, 'done'), breaks: [] }
    ] });

    // k-way merge
    var ks = kwaySteps();
    var kview = V.views.array(V.$('[data-mini="kway"]'), { mode: 'boxes', cellSize: 34, showIndices: false, label: 'Merging three sorted runs' });
    kview.prepare(ks);
    V.teaser(V.$('[data-mini="kway"]'), { steps: ks, render: function (x, ctx) { kview.render(x, { duration: ctx.duration }); }, stepMs: 700, holdMs: 1600, staticIndex: 5 });

    // linked lists
    var ls = listSteps();
    var lview = V.views.list(V.$('[data-mini="list"]'), { label: 'Merging two sorted linked lists by relinking', headPointer: false });
    lview.prepare(ls);
    V.teaser(V.$('[data-mini="list"]'), { steps: ls, render: function (x, ctx) { lview.render(x, { duration: ctx.duration }); }, stepMs: 900, holdMs: 1800, staticIndex: ls.length - 1 });
  }

  /* ================================================================== checks */
  function frozenMerge(host) {
    var Lr = [2, 6, 9, 12], Rr = [1, 4, 7, 15];
    var written = [{ id: 'R0', v: 1 }, { id: 'L0', v: 2 }, { id: 'R1', v: 4 }];
    var cw = 46, ch = 42, gap = 9, x0 = 24, W = x0 * 2 + 8 * (cw + gap) - gap, rowY = { L: 46, R: 126, O: 206 }, H = 262;
    var svg = s('svg', { class: 'l15-frozen', viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'A merge in progress: left run 2, 6, 9, 12; right run 1, 4, 7, 15; output so far 1, 2, 4.' });
    function label(text, y) { svg.appendChild(s('text', { class: 'l15-frozen__label', x: x0, y: y - 12 }, text)); }
    label('left run', rowY.L); label('right run', rowY.R); label('output', rowY.O);
    function box(id, v, slot, row, cls, aria) {
      var g = s('g', { class: 'l15-fbox ' + cls, 'data-id': id, 'data-label': aria });
      g.appendChild(s('rect', { x: x0 + slot * (cw + gap), y: rowY[row], width: cw, height: ch, rx: 9 }));
      if (v !== null) g.appendChild(s('text', { x: x0 + slot * (cw + gap) + cw / 2, y: rowY[row] + ch / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(v)));
      svg.appendChild(g);
    }
    Lr.forEach(function (v, k) { box('L' + k, v, k, 'L', k === 0 ? 'is-ghost' : 'is-run', k === 0 ? 'already written: 2' : 'left run, ' + v); });
    Rr.forEach(function (v, k) { box('R' + k, v, k, 'R', k < 2 ? 'is-ghost' : 'is-run', k < 2 ? 'already written: ' + v : 'right run, ' + v); });
    for (var k = 0; k < 8; k++) {
      if (k < written.length) box('O' + k, written[k].v, k, 'O', 'is-out', 'output slot ' + k + ': ' + written[k].v);
      else svg.appendChild(s('rect', { class: 'l15-fslot', x: x0 + k * (cw + gap), y: rowY.O, width: cw, height: ch, rx: 9 }));
    }
    function pointer(name, slot, row, cls) {
      var cx = x0 + slot * (cw + gap) + cw / 2, y = rowY[row];
      var g = s('g', { class: 'l15-fptr ' + cls, 'aria-hidden': 'true' });
      g.appendChild(s('path', { d: 'M' + (cx - 6) + ' ' + (y - 16) + ' L' + (cx + 6) + ' ' + (y - 16) + ' L' + cx + ' ' + (y - 6) + ' Z' }));
      g.appendChild(s('text', { x: cx + 12, y: y - 9, 'dominant-baseline': 'central' }, name));
      svg.appendChild(g);
    }
    pointer('i', 1, 'L', 'is-i'); pointer('j', 2, 'R', 'is-j'); pointer('k', 3, 'O', 'is-k');
    host.appendChild(svg);
    return svg;
  }

  function checks() {
    V.quiz('#quiz-levels', {
      kicker: 'Predict', id: 'l15-levels32',
      question: 'Merge sort sorts <b>32</b> values. How many levels of <em>merging</em> does it need, from runs of one value up to the sorted array?',
      options: ['5', '6', '16', '32'],
      answer: 0,
      explain: [
        'Right. Each merge level doubles the run length: 1 → 2 → 4 → 8 → 16 → 32. That is 5 doublings, and 5 = log₂ 32.',
        'The recursion tree has 6 rows (sizes 32, 16, 8, 4, 2, 1), but the bottom row is single values, which need no merge. Merging happens on the 5 rows above it.',
        '16 is the number of merges on the level just above the leaves. The number of levels is how many times you can halve 32: log₂ 32 = 5.',
        'That would be one level per value, which is what insertion sort effectively does. Halving means the number of levels is only log₂ 32 = 5.'
      ]
    });
    V.quiz('#quiz-recurrence', {
      id: 'l15-recurrence',
      question: 'Merge sort’s running time obeys <code>T(n) = 2·T(n/2) + n</code>. What does it solve to?',
      options: ['<code>O(n)</code>', '<code>O(n log n)</code>', '<code>O(n²)</code>', '<code>O(log n)</code>'],
      answer: 1,
      explain: [
        'Two half-size calls alone would cost about n in total, but the merge adds n on every level of the tree, and there are log₂ n levels.',
        'Right. Draw the tree: every level costs n (2 calls × n/2, then 4 × n/4, …), and there are log₂ n levels, so about n · log₂ n.',
        'That would happen if each level cost more than the one above it. Here each level costs exactly n, not n² or n·(something growing).',
        'Merging alone costs n, so the total cannot be smaller than n. log n would be the answer for binary search, which recurses into one half and merges nothing.'
      ]
    });
    V.quiz('#quiz-tie', {
      id: 'l15-tie',
      question: 'A merge takes the <em>right</em> value when the two fronts are equal (it uses <code>&lt;</code> instead of <code>≤</code>). What changes?',
      options: ['The output is no longer sorted', 'The sort is no longer stable: equal values can swap order', 'The merge needs more comparisons', 'Nothing changes'],
      answer: 1,
      explain: [
        'It is still sorted: on a tie either front is a correct next value, because they are equal.',
        'Right. Equal values are interchangeable for sortedness but not for identity. If the left run holds 3<sub>a</sub> and the right run 3<sub>b</sub>, taking the right one first puts 3<sub>b</sub> before 3<sub>a</sub>.',
        'Not reliably. The count can move either way with the tie rule: merging [3, 5] with [3] takes 2 comparisons with ≤ and 1 with <, while merging [3] with [3, 5] is the other way round. Each comparison still writes one value. What really changes is stability.',
        'Something does change: the order of equal records. That matters when you sort by one field and the records carry others.'
      ]
    });
    V.quiz('#quiz-sorted', {
      id: 'l15-sorted-input',
      question: 'Merge sort runs on an array that is <em>already sorted</em>. Compared with a random array of the same size, how much work does it do?',
      options: ['Almost none: it notices the array is sorted and stops', 'About half the comparisons, but the same number of writes', 'Exactly the same comparisons and writes', 'It is faster, but still O(n²)'],
      answer: 1,
      explain: [
        'Plain merge sort does not check for order. It still splits down to single values and merges every level back. Some versions add a check (skip the merge if a[mid] ≤ a[mid+1]), but that is an extra, not the basic algorithm.',
        'Right. On sorted input each merge empties the left run first, so it makes about n/2 comparisons per level instead of about n, but it still writes every value once per level: n log₂ n writes. Merge sort is not adaptive.',
        'Close. The writes are identical, but the comparisons drop: each merge on sorted input needs only as many comparisons as the left run has values, roughly half.',
        'It is never O(n²): the tree has the same shape for every input, so the total is always Θ(n log n) writes.'
      ]
    });
    V.quiz('#quiz-binary', {
      id: 'l15-binary',
      question: 'Binary search checks the middle and then recurses into <em>one</em> half, doing constant work per call: <code>T(n) = T(n/2) + 1</code>. What does it solve to?',
      options: ['<code>O(log n)</code>', '<code>O(n)</code>', '<code>O(n log n)</code>', '<code>O(1)</code>'],
      answer: 0,
      explain: [
        'Right. The recursion tree is a single path, not a tree: each level makes one call and costs 1, and halving n leaves log₂ n levels. Try a = 1, c = 0 in the explorer above.',
        'That would need every level to cost more. Here the path has only log₂ n calls, each doing one comparison.',
        'n log n needs two calls per level, each half the size, plus n of merging. Binary search makes one call and merges nothing.',
        'Halving takes more than one step once n is larger than 1: about log₂ n calls.'
      ]
    });
    // click quiz on a frozen merge
    var host = V.$('#fig-click [data-stage]');
    frozenMerge(host);
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l15-click-next',
      question: 'This merge is frozen halfway: 1, 2 and 4 are written. Click the value that goes to the output next.',
      check: function (id) {
        if (id === 'L1') return true;
        if (id === 'R2') return { correct: false, message: '7 is the right run’s front, but the left run’s front, 6, is smaller. The smaller of the two fronts goes first.' };
        if (/^O/.test(id) || id === 'L0' || id === 'R0' || id === 'R1') return { correct: false, message: 'That value is already written. Look at the pointers i and j: only the fronts of the two runs can go next.' };
        return { correct: false, message: 'That value is behind a front. Each run is sorted, so it is larger than the front in front of it and cannot go next.' };
      },
      right: '6 vs 7: the left front is smaller, so 6 is written to slot 3 and <code>i</code> moves to 9. Then 7 goes next, and 9 after that.'
    });
  }

  /* ================================================================== summary card */
  function tinySvg(build, w, hh) {
    var svg = s('svg', { viewBox: '0 0 ' + w + ' ' + hh, width: '100%', height: '100%', role: 'img', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
    build(svg);
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { label: 'Divide', text: 'Split at the middle until every piece has one value: ⌈log₂ n⌉ levels of halving.', build: function (el) {
        L15.staticRuns(el, { cellSize: 22, label: 'Four values split into halves and then single values', rowLabels: 'above', rows: [
          { items: [5, 2, 8, 1].map(function (x) { return { value: x }; }) },
          { items: [5, 2, 8, 1].map(function (x) { return { value: x }; }), breaks: [2] },
          { items: [5, 2, 8, 1].map(function (x) { return { value: x, state: 'visited' }; }), breaks: [1, 2, 3] }
        ] });
      } },
      { label: 'Merge', text: 'Two pointers, take the smaller front. At most n − 1 comparisons and exactly n writes for n values.', build: function (el) {
        L15.staticRuns(el, { cellSize: 20, label: 'Two sorted runs merging into an output row', rows: [
          { items: [{ value: 2, state: 'visited' }, { value: 5, state: 'compare' }, { value: 8, state: 'visited' }] },
          { items: [{ value: 3, state: 'compare' }, { value: 4, state: 'visited' }] },
          { items: [{ value: 2, state: 'done' }, { value: 3, state: 'swap' }], length: 5 }
        ], pointers: [{ name: 'i', row: 'row0', index: 1 }, { name: 'j', row: 'row1', index: 0, state: 'frontier' }] });
      } },
      { label: 'n per level', text: 'Every level of the recursion tree writes n values, and there are log₂ n levels: n log n in total.', build: function (el) {
        el.appendChild(tinySvg(function (svg) {
          for (var i = 0; i < 4; i++) {
            var n = Math.pow(2, i), w = 176 / n;
            for (var j = 0; j < n; j++) svg.appendChild(s('rect', { class: 'l15-tiny-node', x: 12 + j * w + 1.5, y: 6 + i * 21, width: w - 3, height: 16, rx: 4 }));
            svg.appendChild(s('text', { class: 'l15-tiny-n', x: 196, y: 14 + i * 21, 'dominant-baseline': 'central' }, 'n'));
          }
        }, 220, 92));
      } },
      { label: 'Stable', text: 'Ties take the left value, so equal keys keep their order. Take the right one and they swap.', build: function (el) {
        L15.staticRuns(el, { cellSize: 30, label: 'Two equal values tagged a and b keeping their order', rows: [
          { items: [{ value: 3, label: 'a', state: 'visited' }, { value: 3, label: 'b', state: 'visited' }] },
          { items: [{ value: 3, label: 'a', state: 'done' }, { value: 3, label: 'b', state: 'done' }] }
        ] });
      } },
      { label: 'Extra memory', text: 'The merge writes into a buffer: O(n) extra space for arrays, O(1) for linked lists. Only log₂ n calls deep.', build: function (el) {
        L15.staticRuns(el, { cellSize: 22, label: 'An array and an equally long temporary buffer', rows: [
          { label: 'a', items: [1, 3, 4, 6, 2, 5, 7, 8].map(function (x, k) { return { value: x, state: k < 4 ? 'visited' : 'default' }; }) },
          { label: 'temp', items: [1, 3, 4, 6, 2, 5, 7, 8].map(function (x) { return { value: x, state: 'compare' }; }) }
        ] });
      } },
      { label: 'Not adaptive', text: 'Sorted input costs about the same as random. Use it for guaranteed n log n, lists and disk; insertion sort for nearly sorted data.', build: function (el) {
        L15.staticRuns(el, { cellSize: 22, label: 'A sorted array still split down and merged back', rows: [
          { items: [1, 2, 3, 4, 5, 6].map(function (x) { return { value: x, state: 'done' }; }) },
          { items: [1, 2, 3, 4, 5, 6].map(function (x) { return { value: x, state: 'visited' }; }), breaks: [3] },
          { items: [1, 2, 3, 4, 5, 6].map(function (x) { return { value: x, state: 'visited' }; }), breaks: [2, 3, 5] }
        ] });
      } }
    ];
    tiles.forEach(function (t) {
      var viz = h('div', { class: 'summary__viz stage-grid' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
      L15.whenNear(viz, function () { t.build(viz); });
    });
  }

  /* ================================================================== boot */
  function guard(name, fn) { return function () { try { fn.apply(null, arguments); } catch (e) { console.error('[lesson 15] ' + name + ' failed', e); } }; }
  V.ready(function () {
    // lazily started figures register their checks now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l15-lab-next', 'l15-lab-drain', 'l15-lab-oddsplit'].forEach(V.quizScore.register);
    guard('hero', heroTeaser)();
    guard('checks', checks)();
    guard('summary', summaryCard)();
    L15.whenNear('#fig-scale', L15.initScale);
    L15.whenNear('#mini-intuition', guard('minis', intuitionMinis));
    L15.whenNear('#fig-levels', L15.initLevels);
    L15.whenNear('#fig-merge', L15.initMergeGame);
    L15.whenNear('#fig-stable', L15.initStable);
    L15.whenNear('#fig-tree', L15.initTree);
    L15.whenNear('#lab-fig', function () { L15.lab = L15.initLab(); });
    L15.whenNear('#fig-bottomup', L15.initBottomUp);
    L15.whenNear('#fig-growth', L15.initGrowth);
    L15.whenNear('#fig-race', function () { L15.race = L15.initRace(); });
    L15.whenNear('#fig-master', L15.initMaster);
    L15.whenNear('#variants', guard('variations', variations));
    L15.whenNear('#fig-choose', L15.initChooser);
  });
}());
