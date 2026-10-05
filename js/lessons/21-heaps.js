/* Lesson 21 — Heaps & priority queues: page wiring.
   Step generators: js/algos/21-heaps.js (VDSA.algos.heap; heap sort also as VDSA.algos.sorting.heap).
   Shared views: 21-heaps-views.js. Labs and stepping figures: 21-heaps-labs.js. Other figures: 21-heaps-more.js.
   Heavy figures start lazily when they approach the viewport; check ids are registered up front so the page
   score total does not jump. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L21 = V.lessons.l21;
  function H() { return V.algos.heap; }
  var fmt = L21.fmt;

  /* ================================================================== hero teaser: a value climbs, then the top leaves */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var pair = L21.pair(stage, { label: 'Heap teaser', nodeSize: 30, cellSize: 34, pointers: false, treeOptions: { levelHeight: 46 }, arrayOptions: { showIndices: false, arc: false } });
    var rng = V.rng(21);
    function data() {
      var base = V.presets.random(8, { min: 20, max: 90, unique: true, rng: rng });
      var items = H().build(base.map(function (v, i) { return { id: 't' + i, value: v }; })).items;
      var lo = Math.min.apply(null, base);
      var r = H().chain(items, [{ op: 'insert', value: Math.max(2, lo - rng.int(8, 18)) }, { op: 'extract' }], { intro: false });
      var st = r.steps.filter(function (s) { return s.kind !== 'start' && s.kind !== 'haschild' && s.kind !== 'settle' && s.kind !== 'take'; });
      // opening frame: the heap as it is before the insert
      var first = H().snapshot(items, { caption: '' }).steps[0];
      st.unshift(first);
      pair.reset(); pair.prepare(st);
      return st;
    }
    var first = data();
    var mid = first.findIndex(function (s) { return s.kind === 'swap'; });
    V.teaser(stage, { steps: first, render: function (s, ctx) { pair.render(s, ctx); }, stepMs: 620, holdMs: 1500, regenerate: data, staticIndex: mid > 0 ? mid : first.length - 1 });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-insert', {
      question: 'A min-heap is stored as the array <code>[2, 5, 4, 9, 7]</code>. You insert <code>3</code>. What is the array afterwards?',
      options: ['<code>[2, 5, 3, 9, 7, 4]</code>', '<code>[2, 3, 4, 9, 7, 5]</code>', '<code>[3, 2, 4, 9, 7, 5]</code>', '<code>[2, 5, 4, 9, 7, 3]</code>'],
      answer: 0,
      explain: [
        '3 lands at index 5. Its parent is index ⌊(5 − 1) / 2⌋ = 2, holding 4. Since 3 < 4 they swap, and 3 is at index 2. Its parent is index 0, holding 2, and 2 ≤ 3, so it stops.',
        'That swaps 3 with the value at index 1, which is not its parent. The parent of index 5 is index 2, not index 1.',
        'That lets 3 climb to the root, but 2 ≤ 3, so the climb must stop below the root.',
        'That skips the repair: 3 is smaller than its parent 4 at index 2, so the heap property would still be broken.'
      ],
      kicker: 'Predict the array', id: 'heap-quiz-insert'
    });
    V.quiz('#quiz-valid', {
      question: 'Which of these arrays are valid <em>min</em>-heaps? Pick all that apply.',
      options: ['<code>[1, 3, 2, 7, 4, 5, 6]</code>', '<code>[2, 1, 3, 4, 5]</code>', '<code>[1, 2, 3, 4, 5, 6, 7]</code>', '<code>[1, 4, 2, 3, 5, 6]</code>', '<code>[5, 5, 5, 5]</code>'],
      answer: [0, 2, 4],
      explain: [
        'Valid: 1 ≤ 3, 2; 3 ≤ 7, 4; 2 ≤ 5, 6. Siblings 3 and 2 are in any order, and that is fine.',
        'Not valid: index 1 holds 1, which is smaller than its parent, index 0, holding 2.',
        'Valid: a sorted array is always a min-heap, because every parent sits at a smaller index and so holds a smaller or equal value.',
        'Not valid: index 3 holds 3, but its parent, index 1, holds 4. A child is smaller than its parent.',
        'Valid: the rule is ≤, and equal values satisfy it.'
      ],
      kicker: 'Is it a heap?', id: 'heap-quiz-valid'
    });
    V.quiz('#quiz-build', {
      question: 'Building a heap bottom-up (sift down every non-leaf, last to first) takes O(<em>n</em>), not O(<em>n</em> log <em>n</em>). Why?',
      options: [
        'Half the nodes are leaves and need no work, and few nodes sit near the top, where sinking is expensive.',
        'It sorts the array first, and sorted arrays are already heaps.',
        'Sift-down never swaps on average, so it costs one comparison per node.',
        'It skips the last level and only repairs the levels above.'
      ],
      answer: 0,
      explain: [
        'A node at height h sinks at most h levels, and only about n / 2^(h+1) nodes have height h. Adding h × n / 2^(h+1) over all heights gives at most n.',
        'Sorting would already cost O(n log n). Build-heap does not sort anything.',
        'Sift-down does swap: on the worst input every node sinks all the way to its subtree’s leaves. The total is still linear.',
        'The leaves are skipped, but the nodes just above them are repaired. What makes the sum small is how few nodes have large height.'
      ],
      kicker: 'Why linear?', id: 'heap-quiz-build'
    });
    V.quiz('#quiz-topk', {
      question: 'You must find the 100 largest numbers among a billion that arrive one at a time. Which structure do you keep?',
      options: ['A max-heap holding all values seen so far', 'A min-heap of size 100', 'A max-heap of size 100', 'A min-heap holding all values seen so far'],
      answer: 1,
      explain: [
        'That stores a billion values and every insert costs log of a billion. Only 100 are ever needed.',
        'The root of the min-heap is the smallest of the 100 largest, so the bar to clear is at the top. A newcomer larger than the root replaces it. Memory is 100 values and each value costs O(log 100).',
        'A max-heap of size 100 exposes the largest value, not the weakest member of the top 100, so you could not tell whether a newcomer belongs.',
        'That stores every value. It gives the smallest value, which is the opposite of what you need.'
      ],
      kicker: 'Pick the heap', id: 'heap-quiz-topk'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: L21.miniCells([1, 3, 2, 7, 4, 5, 6], { size: 24, pitch: 28, index: true, states: { 0: 'compare', 1: 'key', 3: 'frontier', 4: 'frontier' }, tags: [{ at: 1, text: 'i' }] }),
        label: 'Tree in an array', text: 'Children of i: 2i + 1 and 2i + 2. Parent: ⌊(i − 1) / 2⌋.' },
      { svg: L21.miniTree([1, 3, 2, 7, 4, 5, 6], { r: 11, levelH: 32, states: { 0: 'found' } }),
        label: 'Heap property', text: 'Every parent ≤ its children. The minimum sits at the root: peek is O(1).' },
      { svg: L21.miniTree([2, 5, 4, 9, 7, 3], { r: 11, levelH: 32, states: { 5: 'key', 2: 'swap' }, edgeStates: { 5: 'swap' } }),
        label: 'Insert: sift up', text: 'Append, then swap with the parent while smaller. At most log n swaps.' },
      { svg: L21.miniTree([4, 5, 3, 9, 7], { r: 11, levelH: 32, states: { 0: 'key', 2: 'compare' }, edgeStates: { 2: 'compare' } }),
        label: 'Extract: sift down', text: 'Last value to the root, then swap with the smaller child. At most log n swaps.' },
      { svg: L21.miniCells([9, 7, 8, 3, 4, 2, 1], { size: 24, pitch: 28, states: { 0: 'compare', 6: 'compare' } }),
        label: 'Build in O(n)', text: 'Sift down every non-leaf, last to first: about n swaps in the worst case.' },
      { svg: L21.miniCells([1, 2, 3, 5, 7, 8, 9], { size: 24, pitch: 28, states: { 3: 'done', 4: 'done', 5: 'done', 6: 'done' } }),
        label: 'Heap sort', text: 'Build a max-heap, then swap the root to the end. O(n log n), in place, not stable.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    // register check ids up front so the page score total is stable while figures start lazily
    if (V.quizScore && V.quizScore.register) ['heap-lab-predict-up', 'heap-lab-predict-child', 'heapsort-predict-swap'].forEach(V.quizScore.register);
    var more = L21.more, labs = L21.labs;
    heroTeaser();
    checks();
    summaryCard();
    more.partialMinis();
    more.badNodeFigure();
    labs.pqProblemFigure();
    more.variations();
    // heavier figures: start when they approach the viewport (the lab and flowcharts start together, since the
    // lab drives the flowcharts)
    L21.whenNear('#fig-map', more.mapExplorer);
    L21.whenNear('#fig-up', labs.siftFigures);
    L21.whenNear('#lab-fig', function () { labs.flowFigures(); labs.heapLab(); });
    L21.whenNear('#fig-build', more.buildFigure);
    L21.whenNear('#fig-buildchart', more.buildChart);
    L21.whenNear('#sort-fig', labs.sortLab);
    L21.whenNear('#fig-topk', more.topkFigure);
    L21.whenNear('#fig-merge', more.mergeFigure);
    L21.whenNear('#fig-pqcmp', more.pqCompareFigure);
    L21.whenNear('#fig-pqchart', more.pqChart);
  });

  L21.fmt = fmt;
}());
