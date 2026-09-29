/* Lesson 17 — Counting, radix & the n log n barrier: boot, checks, summary card and variation minis.
   Generators: js/algos/17-linear-time-sorts.js (VDSA.algos.sorting.counting / radix / bucket, decision3 …).
   Figures: -buckets.js (bucket view + helpers), -tree.js (decision tree, halving game, log2(n!) chart),
   -counting.js (counting sort figures + lab), -radix.js (hero, pockets, radix lab, bucket sort), -cost.js (charts,
   grand table, chooser). Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L17 = V.lessons.l17;

  /* ================================================================== tiny static pictures (summary + variations) */
  /* mini([values], {states, labels, bars, size, tags:[{at,text,state}], flow}) -> <svg> */
  function mini(values, o) {
    o = o || {};
    var s = V.s, C = o.size || 30, P = Math.round(C * 1.2), PAD = 8;
    var n = values.length, tagH = o.tags && o.tags.length ? 22 : 0;
    var barMax = o.bars ? C * 1.9 : 0, max = Math.max.apply(null, values.map(Math.abs).concat([1]));
    var top = PAD + tagH;
    var W = PAD * 2 + n * P - (P - C), H = top + (o.bars ? barMax : C) + PAD + (o.idx ? 14 : 0);
    var svg = s('svg', { class: 'vz l17m', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Values ' + values.join(', ')) });
    svg.style.maxWidth = Math.round(W * (o.scale || 1.5)) + 'px';
    values.forEach(function (v, k) {
      var st = (o.states && o.states[k]) || 'default';
      var lab = o.labels && o.labels[k];
      if (o.bars) {
        var bh = Math.max(3, barMax * Math.abs(v) / max);
        svg.appendChild(s('g', { class: 'vz-item is-' + st }, s('rect', { class: 'vz-shape', x: PAD + k * P, y: top + barMax - bh, width: C, height: bh, rx: 4 }),
          s('text', { class: 'vz-label', x: PAD + k * P + C / 2, y: top + barMax - bh - 4, 'text-anchor': 'middle', style: 'font-size:10px' }, String(v))));
      } else {
        var g = s('g', { class: 'vz-item is-' + st, transform: 'translate(' + (PAD + k * P) + ' ' + top + ')' },
          s('rect', { class: 'vz-shape', width: C, height: C, rx: Math.round(C / 5) }),
          s('text', { class: 'vz-ink vz-value', x: C / 2, y: C / 2 + (lab ? -C * 0.1 : 0), dy: '.35em', 'text-anchor': 'middle', style: 'font-size:' + Math.round(C * 0.42) + 'px' }, L17.fmt(v)));
        if (lab) g.appendChild(s('text', { class: 'vz-ink vz-sub', x: C / 2, y: C * 0.76, dy: '.35em', 'text-anchor': 'middle', style: 'font-size:' + Math.round(C * 0.3) + 'px' }, lab));
        svg.appendChild(g);
      }
      if (o.idx) svg.appendChild(s('text', { class: 'vz-label', x: PAD + k * P + C / 2, y: H - 4, 'text-anchor': 'middle', style: 'font-size:9px' }, String(o.idxLabels ? o.idxLabels[k] : k)));
    });
    (o.tags || []).forEach(function (t) {
      var x = PAD + t.at * P + C / 2, w = Math.max(24, t.text.length * 6.4 + 12);
      svg.appendChild(s('g', { class: 'l17m-tag is-' + (t.state || 'key'), transform: 'translate(' + x + ' ' + (top - 5) + ')' },
        s('rect', { x: -w / 2, y: -17, width: w, height: 15, rx: 7.5 }),
        s('text', { x: 0, y: -9.5, dy: '.35em', 'text-anchor': 'middle' }, t.text)));
    });
    return svg;
  }
  L17.mini = mini;

  /* a tiny decision tree (3 levels) for the summary */
  function miniTree() {
    var s = V.s;
    var svg = s('svg', { class: 'vz l17m', viewBox: '0 0 150 84', role: 'img', 'aria-label': 'A binary tree with six leaves and three levels of questions' });
    svg.style.maxWidth = '210px';
    var nodes = { r: [75, 10], a: [40, 34], b: [110, 34], c: [22, 60], d: [58, 60], e: [92, 60], f: [128, 60] };
    var edges = [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e'], ['b', 'f']];
    edges.forEach(function (e) { svg.appendChild(s('line', { class: 'l17-edge', x1: nodes[e[0]][0], y1: nodes[e[0]][1], x2: nodes[e[1]][0], y2: nodes[e[1]][1] })); });
    Object.keys(nodes).forEach(function (k) {
      var leaf = 'cdef'.indexOf(k) >= 0;
      svg.appendChild(s('g', { class: 'vz-item is-' + (leaf ? 'done' : 'active') }, s('circle', { class: 'vz-shape', cx: nodes[k][0], cy: nodes[k][1], r: leaf ? 8 : 7 })));
    });
    svg.appendChild(s('text', { class: 'vz-label', x: 75, y: 80, 'text-anchor': 'middle', style: 'font-size:9px' }, '6 leaves ≥ 2² · 2.58'));
    return svg;
  }

  /* ================================================================== variation minis */
  function variations() {
    V.tabs('#variants');
    var minis = {
      negative: mini([-2, 0, 1, -1, 2], { states: ['key', 'default', 'default', 'default', 'default'], tags: [{ at: 0, text: '−2 → slot 0', state: 'key' }], idx: true, idxLabels: [0, 1, 2, 3, 4], label: 'Keys −2 to 2 stored in slots 0 to 4 after adding 2' }),
      records: mini([3, 5, 5, 8, 8, 9], { labels: ['Ana', 'Ben', 'Eli', 'Cy', 'Di', 'Flo'], states: ['done', 'done', 'done', 'done', 'done', 'done'], size: 36, label: 'Students sorted by grade, equal grades in roll order' }),
      strings: mini(['cat', 'bat', 'ant', 'ace'], { size: 42, states: ['default', 'default', 'default', 'default'], tags: [{ at: 0, text: 'last letter first', state: 'key' }], label: 'Four three-letter words, sorted one letter at a time from the last letter' }),
      hist: mini([2, 0, 2, 3, 0, 1], { bars: true, states: ['active', 'default', 'active', 'active', 'default', 'active'], idx: true, label: 'Counts for keys 0 to 5' })
    };
    Object.keys(minis).forEach(function (k) { V.$('[data-mini="' + k + '"]').appendChild(minis[k]); });
    var blocks = {
      negative: 'const min = Math.min(...a), max = Math.max(...a);\nconst count = new Array(max - min + 1).fill(0);\nfor (const x of a) count[x - min]++;      // shift every key by -min\n// prefix sums and the right-to-left placement are unchanged;\n// write x back to out[...] as before (or add min to recover the key)',
      records: '// sort students by grade 0..10, keeping roll-number order inside a grade\nfor (const s of students) count[s.grade]++;\nfor (let g = 1; g <= 10; g++) count[g] += count[g - 1];\nfor (let i = students.length - 1; i >= 0; i--)   // right to left = stable\n  out[--count[students[i].grade]] = students[i];',
      strings: '// LSD radix sort for words of equal length w, letters a-z\nfor (let pos = w - 1; pos >= 0; pos--) {            // last letter first\n  words = countingSortBy(words, word => word.charCodeAt(pos) - 97, 25);\n}',
      hist: 'const freq = new Array(26).fill(0);\nfor (const ch of text) freq[ch.charCodeAt(0) - 97]++;\nconst top = freq.indexOf(Math.max(...freq));        // most frequent letter'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
  }

  /* ================================================================== checks */
  var LEAF_IDS = { abc: 'a, b, c', acb: 'a, c, b', cab: 'c, a, b', bac: 'b, a, c', bca: 'b, c, a', cba: 'c, b, a' };
  function checks() {
    V.quiz('#quiz-leaves', {
      kicker: 'Predict', id: 'l17-leaves-n4',
      question: 'A decision tree that sorts <b>n = 4</b> distinct items must have at least how many leaves?',
      options: ['4, one per item', '12', '24', '16, because 2⁴ = 16'],
      answer: 2,
      explain: [
        'A leaf announces an ordering, not an item. Four items can be ordered in many more than four ways.',
        '12 is half of the orderings. Two different orderings can never share a leaf, so every one needs its own leaf.',
        'Right. There are 4! = 4 · 3 · 2 · 1 = 24 orderings, so at least 24 leaves. A tree of height 4 has at most 2⁴ = 16 leaves, so the height must be at least 5: sorting 4 items needs 5 comparisons in the worst case.',
        '2⁴ = 16 is the most leaves a tree of height 4 can have. That is too few for 24 orderings, which is exactly why 4 comparisons cannot be enough.'
      ]
    });
    V.quiz('#quiz-stable', {
      kicker: 'Why does it work?', id: 'l17-radix-stable',
      question: 'Why must the sort used for each digit in radix sort be <b>stable</b>?',
      options: [
        'Unstable sorts are always slower than stable ones',
        'It does not need to be: any correct sort of the digit will do',
        'Numbers with the same current digit must keep the order the earlier digits gave them',
        'Otherwise a bucket could overflow'
      ],
      answer: 2,
      explain: [
        'Speed is not the issue: an unstable pass can be just as fast, and it still gets the wrong answer.',
        'Try it in the lab: switch the buckets to a stack. The digit of every pass is sorted correctly, but ties come out reversed and the final list is not sorted.',
        'Right. After the ones pass the list is ordered by last digit. The tens pass reorders by tens digit, and ties on the tens digit must stay in ones-digit order. Only a stable pass promises that.',
        'Buckets are lists that grow as needed, so overflow never happens. Order inside the bucket is the problem.'
      ]
    });
    V.quiz('#quiz-positions', {
      kicker: 'Predict', id: 'l17-cs-slot',
      question: 'Counting sort on keys 0 to 5 has finished its prefix sums: <code>count = [2, 2, 4, 7, 7, 8]</code>. Placing right to left, which output slot does the <em>last</em> item with key <b>3</b> take?',
      options: ['Slot 7', 'Slot 6', 'Slot 4', 'Slot 3'],
      answer: 1,
      explain: [
        '<code>count[3]</code> = 7 is one past the end of key 3’s stretch, so slot 7 belongs to the next key. Subtract 1 first.',
        'Right. count[3] = 7 items have keys 3 or less, so key 3’s stretch ends at slot 6. The last copy is visited first and takes the last slot, 6, then the counter drops to 6.',
        'Slot 4 is the <em>start</em> of key 3’s stretch (count[2] = 4). The first copy goes there, but we place from the right.',
        'Slot 3 is inside key 2’s stretch (slots 2 and 3). Key 3’s items start at slot count[2] = 4.'
      ]
    });
    V.quiz('#quiz-bigk', {
      kicker: 'Choose', id: 'l17-big-k',
      question: 'You must sort 1,000 integers that can be any 32-bit value. Counting sort takes 2n + k steps. Why is a single counting pass a poor choice?',
      options: [
        'Counting sort cannot handle numbers that large',
        'k is about 4 billion, so the count array dwarfs the 1,000 items',
        'Counting sort is not stable',
        'It needs comparisons, which are slow for big numbers'
      ],
      answer: 1,
      explain: [
        'It can handle them in principle. The problem is cost: the count array has one cell for every possible key.',
        'Right. 2n + k is about 4 billion steps and gigabytes of counters to sort 1,000 numbers. Radix sort avoids that by using a few small counting passes over 8 bits at a time, roughly 4 · (2,000 + 256) steps.',
        'Counting sort is stable when you place from the right. Stability is not what goes wrong here.',
        'Counting sort makes no comparisons at all.'
      ]
    });
    V.quiz('#quiz-model', {
      kicker: 'Think', id: 'l17-no-contradiction',
      question: 'Counting sort sorts <em>n</em> integers in O(n + k) time. Does that contradict the Ω(n log n) lower bound?',
      options: [
        'Yes: one of the two proofs must be wrong',
        'No: because k is always small',
        'Yes, but only for stable sorts',
        'No: it reads keys as array indexes, which a comparison sort is not allowed to do'
      ],
      answer: 3,
      explain: [
        'Both proofs are correct. They are about different models of what an algorithm may do with a key.',
        'k can be huge, and then counting sort is slow. That affects its cost, not whether the bound applies.',
        'Stability plays no role in the lower bound.',
        'Right. The decision-tree proof assumes the algorithm learns only by comparing pairs. Counting sort uses a key as an address, so it has no decision tree of yes/no comparisons, and the bound never applied to it.'
      ]
    });
    // click the answer on the static decision tree
    var host = V.$('#fig-click [data-stage]');
    var tree = L17.staticTree(host);
    var right = tree.leafFor({ a: 4, b: 9, c: 1 });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l17-click-leaf',
      question: 'Your cards are <b>a = 4, b = 9, c = 1</b>. Follow the questions from the root and click the leaf where this tree ends.',
      check: function (id) {
        if (id === right) return true;
        var order = LEAF_IDS[id];
        if (!order) return false;
        return { correct: false, message: 'Not this one: the leaf “' + order + '” would mean ' + order.split(', ').map(function (x) { return x + ' = ' + { a: 4, b: 9, c: 1 }[x]; }).join(' &lt; ') + ', which is not true for these cards. Answer the questions: is 4 &lt; 9? is 9 &lt; 1? is 4 &lt; 1?' };
      },
      right: '4 &lt; 9 is yes, so go to “b &lt; c ?”. 9 &lt; 1 is no, so go to “a &lt; c ?”. 4 &lt; 1 is no, so the leaf is c, a, b: 1 &lt; 4 &lt; 9. Three comparisons.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: miniTree(), label: 'Decision tree', text: 'Every comparison sort is a tree of yes/no questions with at least n! leaves.' },
      { svg: mini([1, 2, 6, 24, 120], { bars: true, states: ['default', 'default', 'default', 'default', 'compare'], size: 20, idx: true, idxLabels: ['1', '2', '3', '4', '5'], tags: [{ at: 2, text: 'n! orderings', state: 'compare' }], label: 'Factorials 1, 2, 6, 24, 120' }), label: 'Ω(n log n)', text: 'Height ≥ log₂ n! ≈ n log₂ n comparisons in the worst case, for any comparison sort.' },
      { svg: mini([2, 0, 2, 3, 0, 1], { bars: true, states: ['active', 'default', 'active', 'active', 'default', 'active'], size: 20, idx: true, label: 'Counters for keys 0 to 5' }), label: 'Counting sort', text: 'Count, add up, place from the right. O(n + k), stable, no key comparisons.' },
      { svg: mini([2, 2, 4, 7, 7, 8], { states: ['visited', 'visited', 'visited', 'visited', 'visited', 'visited'], tags: [{ at: 3, text: 'ends at 7', state: 'active' }], size: 26, label: 'Prefix sums 2, 2, 4, 7, 7, 8' }), label: 'Prefix sums', text: 'count[v] is where key v’s stretch ends. Each key owns a fixed stretch of the output.' },
      { svg: mini(['170', '090', '802'], { states: ['swap', 'swap', 'swap'], tags: [{ at: 0, text: 'digit by digit', state: 'pivot' }], size: 38, label: 'Three numbers sorted by digit' }), label: 'Radix sort', text: 'One stable pass per digit, least significant first. O(d · (n + b)).' },
      { svg: mini([0.12, 0.23, 0.17, 0.78], { states: ['done', 'done', 'done', 'done'], size: 34, label: 'Decimals sorted into range buckets' }), label: 'Bucket sort', text: 'Spread numbers into equal ranges. About O(n) if even, O(n²) if crowded.' },
      { svg: mini([3, 3, 3], { labels: ['a', 'b', 'c'], states: ['done', 'done', 'done'], size: 34, label: 'Equal keys a, b, c in order' }), label: 'Stability', text: 'Equal keys keep their order. Radix sort depends on it.' },
      { svg: mini([1, 1, 1], { states: ['found', 'found', 'found'], size: 26, tags: [{ at: 1, text: 'built-in sort', state: 'found' }], label: 'Default: use the built-in sort' }), label: 'What to use', text: 'Built-in sort by default. Counting or radix for bounded integer keys. Insertion sort for tiny or nearly sorted data.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // the labs start lazily; register their predictions now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l17-lab-prefix', 'l17-lab-place', 'l17-lab-bucket'].forEach(V.quizScore.register);
    L17.initHero();
    checks();
    summaryCard();
    var W = L17.whenNear;
    W('#fig-pigeon', L17.initPigeon);
    W('#fig-halving', L17.initHalving);
    W('#fig-tree', L17.initTree);
    W('#fig-bound', L17.initBound);
    W('#fig-cs-steps', L17.initCountSteps);
    W('#fig-cs-stable', L17.initCountStable);
    W('#lab-count', L17.initCountLab);
    W('#lab-radix', L17.initRadixLab);
    W('#fig-bucket', L17.initBucket);
    W('#fig-crossover', L17.initCrossover);
    W('#fig-radixbase', L17.initRadixBase);
    W('#fig-compare', L17.initCompare);
    W('#fig-choose', L17.initChooser);
    W('#variants', variations);
  });
}());
