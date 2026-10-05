/* Lesson 07 — Strings, two pointers & windows: boot, hero teaser, small looping figures, variations, checks, summary.
   Step generators: js/algos/07-strings-and-two-pointers.js (VDSA.algos.strings).
   Mechanism figures: 07-strings-and-two-pointers-figs.js. Labs and the lit flowchart: 07-strings-and-two-pointers-labs.js.
   Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L7 = V.lessons.l07;
  function A() { return V.algos.strings; }

  /* ================================================================== hero teaser: palindromes lighting up in mirror pairs */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 76, showIndices: false, label: 'Palindrome teaser', pointerStyle: 'chip' });
    var words = ['racecar', 'level', 'rotator', 'kayak', 'deified', 'noon'], wi = 0;
    function data() {
      var w = words[wi++ % words.length];
      var st = A().palindrome(w).map(function (s) { return Object.assign({}, s, { regions: [] }); });
      view.reset(); view.prepare(st);
      return st;
    }
    var first = data();
    var mid = first.findIndex(function (s, k) { return s.kind === 'match' && k > 3; });
    V.teaser(stage, { steps: first, render: function (s, ctx) { view.render({ items: s.items, pointers: s.pointers }, { duration: ctx.duration }); }, stepMs: 700, holdMs: 1700, regenerate: data, staticIndex: mid > 0 ? mid : first.length - 1 });
  }

  /* ================================================================== intuition: three families of one-pass walks */
  function intuitionMinis() {
    var host = V.$('#mini-intuition');
    var MINIS = [
      { title: 'Converging', word: 'noon',
        cap: '<b>Two ends, walking inward.</b> Palindromes, sorted pair sums, reversing. Each pointer only ever moves toward the other.',
        steps: function () { return A().palindrome('noon').map(function (s) { return { snap: { items: s.items, pointers: s.pointers } }; }); } },
      { title: 'Read and write', word: 'dedupe',
        cap: '<b>One reads, one writes.</b> The reader visits everything; the writer trails behind, marking where the next keeper goes. Duplicates, filtering in place.',
        steps: function () { return A().dedupe([1, 1, 2, 2, 3, 3]).map(function (s) { return { snap: { items: s.items, pointers: s.pointers } }; }); } },
      { title: 'Sliding window', word: 'window',
        cap: '<b>A bracket that slides.</b> Add what enters, remove what leaves, keep an answer about the stretch in between. Best week, longest run.',
        steps: function () { return A().windowFixed([2, 1, 5, 1, 3, 2], 3).map(function (s) { return { snap: { rows: s.rows } }; }); } }
    ];
    MINIS.forEach(function (m, k) {
      var stage = h('div', { class: 'mini__stage l07-mini-stage', role: 'img', 'aria-label': m.title + ' pointers, looping animation' });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l07-mini-title' }, m.title), stage, h('figcaption', { html: m.cap })));
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 38, showIndices: false, label: m.title + ' mini' });
      var st = m.steps();
      view.prepare(st.map(function (x) { return x.snap; }));
      var tell = Math.max(1, Math.floor(st.length * 0.55));
      V.teaser(stage, { steps: st, render: function (s, ctx) { view.render(s.snap, { duration: ctx.duration }); }, stepMs: 640, holdMs: 1500, staticIndex: tell });
    });
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    function mini(sel, snap, o) {
      var host = V.$(sel); if (!host) return;
      var v = V.views.array(host, { mode: 'boxes', cellSize: (o && o.cell) || 34, showIndices: !(o && o.noIdx), label: (o && o.label) || 'Illustration' });
      v.render(snap, { duration: 0 });
    }
    function box(id, val, state, extra) { var it = { id: id, value: val, state: state || 'default' }; if (extra) Object.assign(it, extra); return it; }
    mini('[data-mini="three"]', {
      items: [-4, -1, -1, 0, 1, 2].map(function (v, k) { return box('t' + k, v, k === 0 ? 'key' : k === 1 || k === 5 ? 'compare' : 'default'); }),
      pointers: [{ name: 'i', index: 0, state: 'key', side: 'above' }, { name: 'lo', index: 1, state: 'compare', side: 'below' }, { name: 'hi', index: 5, state: 'compare', side: 'above' }],
      regions: [{ from: 1, to: 5, state: 'visited', label: 'two-sum on the rest' }]
    }, { label: 'Three-sum: fix i, then run two-sum on the values to its right' });
    mini('[data-mini="zeros"]', {
      items: [box('z0', 1, 'done'), box('z1', 3, 'done'), box('z2', 0, 'muted'), box('z3', 3, 'compare'), box('z4', 12)],
      pointers: [{ name: 'w', index: 2, state: 'active', side: 'below' }, { name: 'r', index: 3, state: 'compare', side: 'above' }],
      regions: [{ from: 0, to: 1, state: 'done', label: 'non-zeros so far' }]
    }, { label: 'Move zeroes: the write pointer trails the read pointer' });
    mini('[data-mini="anagram"]', {
      items: 'cbaeb'.split('').map(function (c, k) { return box('a' + k, c, k < 3 ? 'found' : 'default'); }),
      regions: [{ from: 0, to: 2, state: 'found', label: 'window “cba” = counts of “abc”' }],
      pointers: []
    }, { label: 'Anagram of “abc” inside a string: a fixed window of size 3 with a count table' });
    mini('[data-mini="merge"]', {
      rows: [
        { id: 'x', label: 'a', items: [1, 4, 7].map(function (v, k) { return box('ma' + k, v, k === 0 ? 'done' : k === 1 ? 'compare' : 'default'); }), pointers: [{ name: 'i', index: 1, state: 'compare', side: 'above' }] },
        { id: 'y', label: 'b', items: [2, 3, 9].map(function (v, k) { return box('mb' + k, v, k < 2 ? 'done' : 'default'); }), pointers: [{ name: 'j', index: 2, state: 'active', side: 'above' }] },
        { id: 'o', label: 'out', items: [1, 2, 3].map(function (v, k) { return box('mo' + k, v, 'done'); }), length: 6 }
      ]
    }, { label: 'Merging two sorted lists: one pointer per list, always take the smaller', cell: 30 });
    mini('[data-mini="hash"]', {
      items: 'abcde'.split('').map(function (c, k) { return box('h' + k, c, k === 0 ? 'muted' : k === 4 ? 'active' : 'visited', k === 0 ? { badge: '−', badgeState: 'compare' } : k === 4 ? { badge: '+', badgeState: 'active' } : {}); }),
      regions: [{ from: 1, to: 3, state: 'active', label: 'window “bcd” · fingerprint' }], pointers: []
    }, { label: 'Rolling hash: the fingerprint of the next window from the previous one' });
    var blocks = {
      three: 'nums.sort((x, y) => x - y);\nfor (let i = 0; i < nums.length - 2; i++) {\n  let lo = i + 1, hi = nums.length - 1;\n  while (lo < hi) {              // two-sum on nums[i+1..]\n    const s = nums[i] + nums[lo] + nums[hi];\n    if (s === 0) { out.push([nums[i], nums[lo], nums[hi]]); lo++; hi--; }\n    else if (s < 0) lo++;\n    else hi--;\n  }\n}   // O(n²): n rounds of an O(n) pair search',
      zeros: 'let w = 0;\nfor (let r = 0; r < a.length; r++) {\n  if (a[r] !== 0) a[w++] = a[r];   // keep non-zeros in order\n}\nwhile (w < a.length) a[w++] = 0;   // fill the rest',
      anagram: 'const need = count("abc");            // letter counts of the pattern\nconst win = new Map();\nfor (let r = 0; r < s.length; r++) {\n  add(win, s[r]);\n  if (r >= 3) remove(win, s[r - 3]);   // fixed window of size 3\n  if (r >= 2 && sameCounts(win, need)) hits.push(r - 2);\n}',
      merge: 'let i = 0, j = 0; const out = [];\nwhile (i < a.length && j < b.length)\n  out.push(a[i] <= b[j] ? a[i++] : b[j++]);\nwhile (i < a.length) out.push(a[i++]);\nwhile (j < b.length) out.push(b[j++]);',
      hash: '// hash of s[l..l+k-1] as a base-B number, mod M\nh = ((h - code(s[l]) * B ** (k - 1)) * B + code(s[l + k])) % M;   // O(1) per slide\n// equal hashes: compare the k characters to be sure.  Rabin–Karp, 1987'
    };
    Object.keys(blocks).forEach(function (k) { var el = V.$('[data-code-block="' + k + '"]'); if (el) V.codeBlock(el, blocks[k], 'js'); });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-sorted', {
      kicker: 'Why it is safe', id: 'l07-why-safe',
      question: 'In sorted two-sum, <code>a[lo] + a[hi]</code> is smaller than the target. Why can <b>lo</b> move right without missing an answer?',
      options: [
        '<code>a[hi]</code> is the largest value still in play, so even the best partner leaves <code>a[lo]</code> too small',
        'Because <code>a[lo]</code> is smaller than <code>a[hi]</code>',
        'Because index <code>lo</code> has been visited before',
        'It is not safe: two pointers can miss pairs'
      ],
      answer: 0,
      explain: [
        'Right. If <code>a[lo]</code> cannot reach the target even when paired with the largest remaining value, then no other partner can help. Its whole row of pairs is ruled out.',
        'That is true of every pair with lo &lt; hi, so it proves nothing. The argument needs the <em>sum</em> to be too small even with the best possible partner.',
        'lo has not been paired with anything else yet. The proof is about values, not about visits.',
        'It is safe on sorted input: every pair that is skipped is provably too small or too big. On unsorted input it would be unsafe.'
      ]
    });
    V.quiz('#quiz-window', {
      kicker: 'Count the work', id: 'l07-window-moves',
      question: 'The longest-substring window runs over a string of <em>n</em> characters. At most how many times does <b>l</b> move in the whole run, even though it sits inside a loop inside a loop?',
      options: ['n: it only moves right, so it visits each index at most once', 'n²: a shrink loop runs for every r', 'log n', 'It depends on how many repeats there are, with no bound'],
      answer: 0,
      explain: [
        'Right. l starts at 0, only ever increases, and can never pass n. Each character is added once by r and dropped at most once by l, so the whole run costs at most 2n steps.',
        'The shrink loop can be long for one r, but it moves l, which never goes back. The total over all r cannot exceed n.',
        'Nothing halves here. l walks one step at a time.',
        'Repeats change when l moves, but not how far it can go in total: n is a hard bound.'
      ]
    });
    V.quiz('#quiz-prefix', {
      kicker: 'Use the table', id: 'l07-prefix-range',
      question: 'For <code>a = [3, 1, 4, 1, 5]</code> the prefix array is <code>P = [0, 3, 4, 8, 9, 14]</code>. What is the sum of <code>a[1..3]</code>?',
      options: ['6', '8', '9', '5'],
      answer: 0,
      explain: [
        'Right: P[4] − P[1] = 9 − 3 = 6, which is 1 + 4 + 1.',
        '8 is P[3]: the sum of a[0..2], which starts at the wrong place and stops one short.',
        '9 is P[4]: the sum of a[0..3]. It still includes a[0] = 3, which is before the range.',
        'That is a[1] + a[2] − 0, or a[3..4] − 1. Use P[r + 1] − P[l] with r = 3 and l = 1.'
      ]
    });
    V.quiz('#quiz-concat', {
      kicker: 'Estimate', id: 'l07-concat-cost',
      question: 'A language copies the whole string on every <code>s = s + c</code>. Roughly how many characters get written to build a string of 10,000 characters that way?',
      options: ['About 10,000', 'About 20,000', 'About 50 million', 'About 100 billion'],
      answer: 2,
      explain: [
        'That is what a builder costs (well, twice that). The loop copies the old string every turn, so the total is much larger.',
        '2n is the builder’s cost: n appends plus one final copy.',
        'Right: 1 + 2 + … + 10,000 = 10,000 × 10,001 / 2 ≈ 50 million. Some runtimes optimise this pattern behind your back, but you should not count on it.',
        'That would be n² × 1,000. The sum 1 + 2 + … + n is about n² / 2, which for n = 10,000 is 50 million.'
      ]
    });
    // click the answer on a frozen window
    var host = V.$('#fig-click [data-stage]');
    var view = V.views.array(host, { mode: 'boxes', cellSize: 54, label: 'The string abcbd with the window s[0..3] broken by a repeated b' });
    var s = 'abcbd'.split('');
    view.render({
      items: s.map(function (c, k) { return { id: 'k' + k, value: c, state: k < 4 ? (c === 'b' ? 'error' : 'visited') : 'default' }; }),
      pointers: [{ name: 'l', index: 0, state: 'active', side: 'below' }, { name: 'r', index: 3, state: 'active', side: 'above' }],
      regions: [{ from: 0, to: 3, state: 'error', label: 'window has two b' }]
    }, { duration: 0 });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l07-click-shrink',
      question: 'r just added the second <b>b</b> and broke the window. Click the character where <b>l</b> will stand once the window is valid again.',
      check: function (id) {
        var k = +id.slice(1);
        if (k === 2) return true;
        if (k === 0) return { correct: false, message: 'l starts at index 0, and a valid window must not contain two b. It has to move.' };
        if (k === 1) return { correct: false, message: 'With l = 1 the window is s[1..3] = b, c, b: the older b is still inside, so it still holds two b.' };
        return { correct: false, message: 'l never jumps past r. It moves one step at a time until the older b has left, then stops right after it.' };
      },
      right: 'l drops a (index 0), then drops the older b (index 1) and stops on c at index 2. The window is now “cb” plus the new b: <code>s[2..3] = cb</code>, all different. Note that the a had to leave too, even though it was not the repeat.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tile(snap, label, text, o) {
      var viz = h('div', { class: 'summary__viz stage-grid' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text)));
      var v = V.views.array(viz, { mode: (o && o.mode) || 'boxes', cellSize: (o && o.cell) || 26, showIndices: false, label: label + ' illustration', showValues: !(o && o.noValues), maxValue: o && o.max, minValue: 0 });
      v.render(snap, { duration: 0 });
    }
    function it(id, v, st, extra) { return Object.assign({ id: id, value: v, state: st || 'default' }, extra || {}); }
    tile({ items: 'racecar'.split('').map(function (c, k) { return it('s' + k, c, k < 2 || k > 4 ? 'done' : k === 2 || k === 4 ? 'compare' : 'default'); }), pointers: [{ name: 'l', index: 2, side: 'below', state: 'compare' }, { name: 'r', index: 4, side: 'above', state: 'compare' }] },
      'Converging pointers', 'Start at both ends, move inward. Palindromes, sorted two-sum, reversing: n / 2 to n steps, O(1) space.', { cell: 24 });
    tile({ items: [1, 1, 2, 3, 3].map(function (v, k) { return it('r' + k, v, k < 3 ? 'done' : k === 3 ? 'compare' : 'default'); }), pointers: [{ name: 'w', index: 3, side: 'below', state: 'active' }, { name: 'r', index: 4, side: 'above', state: 'compare' }] },
      'Read / write pointers', 'The reader visits everything, the writer marks where the next keeper goes. In place, one pass.', { cell: 26 });
    tile({ items: [2, 1, 5, 1, 3].map(function (v, k) { return it('f' + k, v, k >= 1 && k <= 3 ? 'visited' : 'default'); }), regions: [{ from: 1, to: 3, state: 'active', label: 'k = 3' }] },
      'Fixed window', 'Add the value that enters, subtract the one that leaves: O(1) per slide, O(n) in total.', { cell: 26 });
    tile({ items: 'abcbd'.split('').map(function (c, k) { return it('v' + k, c, k >= 2 ? 'visited' : 'muted'); }), regions: [{ from: 2, to: 4, state: 'active', label: 'all different' }] },
      'Variable window', 'Grow r until a rule breaks, shrink l until it holds. l and r only move right: O(n).', { cell: 26 });
    tile({ items: [0, 3, 4, 8, 9, 14].map(function (v, k) { return it('p' + k, v, k === 1 ? 'key' : k === 4 ? 'compare' : 'default'); }), regions: [] },
      'Prefix sums', 'P[i] is the sum of the first i values. sum(a[l..r]) = P[r + 1] − P[l]: O(n) to build, O(1) per query.', { mode: 'bars', cell: 24, max: 14, noValues: true });
    tile({ items: 'abcab'.split('').map(function (c, k) { return it('c' + k, c, k === 3 || k === 4 ? 'found' : 'default', { badge: k === 3 || k === 4 ? '×2' : undefined }); }), pointers: [] },
      'Frequency counts', 'A tally per letter turns “same letters?” into a comparison of tables: O(n), no sorting.', { cell: 26 });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // lazily started figures register their checks now, so the page score total does not jump
    if (V.quizScore && V.quizScore.register) ['l07-pal-next', 'l07-pairs-move', 'l07-prefix-query', 'l07-lab-dedupe', 'l07-lab-reverse', 'l07-lab-shrink', 'l07-lab-slide'].forEach(V.quizScore.register);
    heroTeaser();
    checks();
    summaryCard();
    var W = L7.whenNear;
    W('#fig-chars', L7.charsFigure);
    W('#fig-concat', L7.concatFigure);
    W('#mini-intuition', intuitionMinis);
    W('#fig-pal', L7.palindromeFigure);
    W('#fig-pairs', L7.pairsFigure);
    W('#lab-pointers', function () { L7.pointerLab = L7.initPointerLab(); });
    W('#fig-race', L7.raceFigure);
    W('#fig-fixed', L7.fixedFigure);
    W('#lab-window', function () { L7.windowLab = L7.initWindowLab(); });
    W('#fig-prefix', L7.prefixFigure);
    W('#fig-anagram', L7.anagramFigure);
    W('#fig-choose', L7.chooserFigure);
    W('#fig-cost', L7.costFigure);
    W('#variants', variations);
  });
}());
