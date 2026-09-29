/* Lesson 11 — Hash tables: boot, hero teaser, checks, summary card.
   Step generators: js/algos/11-hash-tables.js (VDSA.algos.hashing). Figures: 11-hash-tables-figs.js (fold, machine,
   spread, birthday), 11-hash-tables-more.js (race, tombstones, charts, decision tree, set/map tabs) and
   11-hash-tables-labs.js (the two labs). Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L11 = V.lessons.l11;
  function A() { return V.algos.hashing; }

  /* ================================================================== hero teaser: keys fly through h(k) into buckets */
  function heroTeaser() {
    var stage = V.$('#teaser'), A11 = A();
    var view = V.views.hashtable(stage, { mode: 'chaining', label: 'Keys passing through a hash function into buckets', threshold: 1.5 });
    var rng = V.rng(1953);
    function data() {
      var keys = V.presets.random(5, { min: 10, max: 60, unique: true, rng: rng });
      var run = A11.chaining(keys.map(function (k) { return { op: 'insert', key: k }; }), { m: 4 });
      var steps = run.steps.filter(function (st) { return st.kind === 'input' || st.kind === 'hash' || st.kind === 'push'; }).map(function (st) { return Object.assign({}, st, { threshold: 2 }); });
      view.reset(); view.prepare(steps);
      return steps;
    }
    var first = data();
    V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 640, holdMs: 1800, regenerate: data, staticIndex: first.length - 1 });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-linear', {
      id: 'l11-quiz-linear',
      question: 'A table has 7 slots and <code>h(k) = k mod 7</code>. Linear probing has filled slot 3 with 10 and slot 4 with 17. Where does key <b>24</b> go?',
      options: ['Slot 3', 'Slot 4', 'Slot 5', 'Slot 6'], answer: 2,
      explain: ['Slot 3 is 24’s home (24 mod 7 = 3), but 10 is already there.',
        'Probe 1 is slot 4, but 17 is there too.',
        'Yes. Probe 0 is slot 3 (taken by 10), probe 1 is slot 4 (taken by 17), probe 2 is slot 5, which is empty. That is 3 probes, and any later search for 24 needs 3 probes too.',
        'Slot 6 is never reached: the sequence 3, 4, 5, … stops at the first empty slot.']
    });
    V.quiz('#quiz-alpha', {
      id: 'l11-quiz-alpha',
      question: 'A table has 16 slots and holds 12 keys, and it grows when α exceeds 0.75. What is α, and what happens when the 13th key arrives?',
      options: ['α = 0.75; the 13th key raises α to about 0.81, so the table grows', 'α = 1.33; the table is already overfull', 'α = 0.75; the 13th key fits and nothing happens', 'α = 12; the table must grow now'],
      answer: 0,
      explain: ['Yes. α = n / m = 12 / 16 = 0.75, which is not above the limit. With 13 keys α = 13 / 16 ≈ 0.81, so the insert triggers a resize and rehash.',
        'That is m / n, the wrong way round. The load factor is keys divided by slots.',
        'α = 0.75 is right, but the 13th key makes it 0.81, which is above the limit.',
        'α is a ratio, not the key count. 12 is n.']
    });
    V.quiz('#quiz-birthday', {
      id: 'l11-quiz-birthday',
      question: 'You hash random keys into 365 empty slots. Roughly how many keys until a collision is <em>more likely than not</em>?',
      options: ['About 23', 'About 100', 'About 183 (half of 365)', '365: only a full table must collide'], answer: 0,
      explain: ['Yes. With 23 keys there are 253 pairs, and the chance that none of them collide is about 49%. Collisions scale with the square root of the table size, not with the table size.',
        'It happens much sooner: by 57 keys the chance is already 99%.',
        'Half full would be far too late. The chance passes 50% at only 23 keys, a table 6% full.',
        'A full table must collide, but collisions become likely long before it is full.']
    });
    V.quiz('#quiz-good', {
      id: 'l11-quiz-good',
      question: 'Which of these does a good hash function need?',
      options: ['The same key always gives the same bucket', 'Keys spread evenly over the buckets', 'It is cheap to compute', 'A different random bucket on every call', 'Sorted keys map to sorted buckets'],
      answer: [0, 1, 2],
      explain: 'A good hash function is deterministic (or you could never find a key again), uniform (or chains and probe runs grow) and fast (it runs on every operation). Randomness per call would lose every key. Keeping order is the opposite of spreading: hashing scatters keys on purpose, which is why hash tables cannot answer range queries.'
    });
    V.quiz('#quiz-tomb', {
      id: 'l11-quiz-tomb',
      question: 'A linear-probing table has seen many inserts and deletes. It holds few keys, but every unsuccessful search is slow. Why, and what is the fix?',
      options: ['Tombstones fill the table, so probe runs are long. Rehash into a fresh table, which drops them.', 'Deleted keys are still counted as stored. Delete them again.', 'Tombstones make searches return wrong answers. Stop using them.', 'The hash function stopped being uniform. Pick a new one.'],
      answer: 0,
      explain: ['Yes. A search for an absent key only stops at a truly empty slot, and tombstones are not empty. Counting tombstones toward the load factor triggers a resize, and rehashing copies only live keys.',
        'They are gone. What remains is the marker that keeps other probe paths intact.',
        'The opposite: tombstones are what keep searches correct. The cost is slowness, not wrong answers.',
        'The hash function did not change, and a bad function would be slow from the start.']
    });
    V.quiz('#quiz-choose', {
      id: 'l11-quiz-choose',
      question: 'You store order numbers and often ask: “list every order between #1000 and #2000, in order”. Which structure fits best?',
      options: ['A hash set of order numbers', 'A hash map from order number to details', 'A sorted structure, such as a balanced search tree', 'An unsorted array'], answer: 2,
      explain: ['A hash set answers “is #1500 in it?” in O(1), but it has no order. A range query would scan every bucket.',
        'The same problem: hashing scatters neighbouring keys into unrelated buckets.',
        'Yes. A sorted structure finds #1000 in O(log n) and then walks forward in order until #2000. Hash tables trade order for O(1) lookups.',
        'It works, but every query scans all n orders.']
    });
    // lazily built figures still count toward the score from the start
    ['l11-click-bucket', 'l11-lab-chain-collision', 'l11-lab-open-probe', 'l11-tomb-predict'].forEach(function (id) { V.quizScore.register(id); });
  }

  /* ================================================================== probe table under "What it costs" */
  function probeTable() {
    var body = V.$('#probe-table'), A11 = A();
    [0.5, 0.75, 0.9].forEach(function (a) {
      var c = A11.expectedProbes('chaining', a), l = A11.expectedProbes('linear', a), d = A11.expectedProbes('double', a);
      var cells = [c.found, c.missing, l.found, l.missing, d.found, d.missing];
      body.appendChild(h('tr', null, h('th', { scope: 'row' }, 'α = ' + a), cells.map(function (v, i) { return h('td', { class: 'num' + (i === 3 && a >= 0.75 ? ' l11-hot' : '') }, v >= 10 ? v.toFixed(1) : v.toFixed(2)); })));
    });
  }

  /* ================================================================== intuition minis are the machine; summary tiles are tiny pictures */
  function tile(kind) {
    var W = 150, HH = 84, svg = s('svg', { class: 'l11-svg l11-mini', viewBox: '0 0 ' + W + ' ' + HH, 'aria-hidden': 'true' });
    function box(x, y, w, hgt, txt, cls) { return s('g', { class: 'l11-mbox ' + (cls || '') }, s('rect', { x: x, y: y, width: w, height: hgt, rx: 5 }), txt !== undefined ? s('text', { x: x + w / 2, y: y + hgt / 2 + 4, 'text-anchor': 'middle' }, txt) : null); }
    function arrow(x1, y1, x2, y2, cls) { return s('path', { class: 'l11-marrow ' + (cls || ''), d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 }); }
    function strip(n, x0, y, w, fills, labels) { for (var i = 0; i < n; i++) svg.appendChild(box(x0 + i * w, y, w - 3, 24, labels ? labels[i] : String(i), fills && fills[i] ? fills[i] : '')); }
    if (kind === 'hash') {
      svg.appendChild(box(8, 10, 40, 22, 'cat', 'is-key')); svg.appendChild(box(58, 10, 40, 22, 'h', 'is-fn')); svg.appendChild(arrow(48, 21, 58, 21)); svg.appendChild(arrow(98, 21, 110, 21));
      svg.appendChild(box(110, 10, 32, 22, '4', 'is-active')); strip(7, 8, 52, 19, { 4: 'is-active' });
    } else if (kind === 'collide') {
      svg.appendChild(box(8, 6, 34, 20, '12', 'is-key')); svg.appendChild(box(8, 32, 34, 20, '42', 'is-key'));
      svg.appendChild(arrow(42, 16, 84, 60, 'is-bad')); svg.appendChild(arrow(42, 42, 84, 62, 'is-bad'));
      strip(4, 60, 58, 22, { 2: 'is-bad' }, ['0', '1', '2', '3']);
    } else if (kind === 'chain') {
      svg.appendChild(box(8, 30, 26, 24, '3', 'is-active'));
      [['10', 46], ['24', 82], ['31', 118]].forEach(function (b, i) { svg.appendChild(box(b[1], 32, 26, 20, b[0], 'is-key')); svg.appendChild(arrow(i ? b[1] - 10 : 34, 42, b[1] - 1, 42)); });
    } else if (kind === 'open') {
      strip(6, 12, 42, 21, { 2: 'is-key', 3: 'is-key', 4: 'is-active' }, ['', '', '10', '17', '24', '']);
      svg.appendChild(s('path', { class: 'l11-marrow is-hop', d: 'M54 40 C54 22 84 22 96 38' })); svg.appendChild(s('text', { class: 'l11-note', x: 75, y: 18, 'text-anchor': 'middle' }, 'probe 2'));
    } else if (kind === 'load') {
      svg.appendChild(s('rect', { class: 'l11-meter', x: 10, y: 34, width: 130, height: 16, rx: 8 }));
      svg.appendChild(s('rect', { class: 'l11-meterfill', x: 10, y: 34, width: 130 * 0.5, height: 16, rx: 8 }));
      svg.appendChild(s('line', { class: 'l11-tick', x1: 10 + 130 * 0.75, x2: 10 + 130 * 0.75, y1: 28, y2: 56 }));
      svg.appendChild(s('text', { class: 'l11-note', x: 75, y: 76, 'text-anchor': 'middle' }, 'α = n / m'));
    } else if (kind === 'resize') {
      strip(3, 8, 30, 20, { 0: 'is-key', 2: 'is-key' }, ['', '', '']);
      svg.appendChild(arrow(72, 42, 84, 42)); strip(6, 88, 30, 10, { 1: 'is-key', 4: 'is-key' }, ['', '', '', '', '', '']);
      svg.appendChild(s('text', { class: 'l11-note', x: 75, y: 70, 'text-anchor': 'middle' }, 'rehash every key'));
    }
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    [
      { k: 'hash', label: 'Hash function', text: 'Turns a key into a bucket: deterministic, uniform, fast.' },
      { k: 'collide', label: 'Collisions', text: 'Certain by pigeonhole, and early: 23 keys in 365 slots.' },
      { k: 'chain', label: 'Chaining', text: 'A list per bucket. Cost of a search: about 1 + α/2 keys.' },
      { k: 'open', label: 'Open addressing', text: 'Probe for a free slot. Deletes need tombstones.' },
      { k: 'load', label: 'Load factor', text: 'α = n / m. Grow before it passes about 0.75.' },
      { k: 'resize', label: 'Resizing', text: 'Doubling and rehashing makes inserts O(1) amortized.' }
    ].forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, tile(t.k)), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    var when = L11.whenNear;
    heroTeaser();
    checks();
    probeTable();
    summaryCard();
    var openLab = null;
    function startOpen() { if (!openLab) openLab = L11.openLab(); }
    when('#fig-fold', L11.foldFigure);
    when('#fig-machine', L11.machineFigure);
    when('#fig-spread', L11.spreadFigure);
    when('#fig-bucketclick', L11.bucketClick);
    when('#fig-birthday', L11.birthdayFigure);
    when('#fig-birthday-chart', L11.birthdayChart);
    when('#lab-chain', L11.chainLab);
    when('#lab-open', startOpen);
    when('#fig-flow', startOpen);
    when('#fig-race', L11.raceFigure);
    when('#fig-tomb', L11.tombFigure);
    when('#fig-probes', L11.probesFigure);
    when('#fig-amortized', L11.amortizedFigure);
    when('#fig-choose', L11.chooseFigure);
    when('#variants', L11.variants);
  });
}());
