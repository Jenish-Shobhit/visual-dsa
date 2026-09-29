/* Lesson 05 · Complexity & Big-O — page wiring.
   Figure builders live in js/lessons/05-big-o-figs.js and js/lessons/05-big-o-lab.js (VDSA.L05). This file adds the
   checks, the summary card and the class table, and starts every heavy figure lazily as it approaches the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, B = V.algos.bigO, L = V.L05;
  var col = L.col, text = L.text, svgRoot = L.svgRoot;

  /* ================================================================== growth classes table */
  function classTable() {
    var body = V.$('[data-class-table]');
    if (!body) return;
    var EX = { '1': 'read a[i], push onto a stack', logn: 'binary search', n: 'linear scan, find the maximum', nlogn: 'merge sort, heap sort', n2: 'all pairs, bubble sort', n3: 'naive matrix multiplication', '2n': 'try every subset', nfact: 'try every ordering' };
    B.CLASSES.forEach(function (c) {
      function cell(n) { return c.id === 'logn' ? B.trimNum(c.f(n), 1) : B.formatBig(B.log10Work(c.id, n)); }
      body.appendChild(h('tr', null,
        h('th', { scope: 'row' }, h('span', { class: 'big-o', 'data-o': c.id }, c.o)),
        h('td', null, c.name), h('td', { class: 'num' }, cell(10)), h('td', { class: 'num' }, cell(1000)), h('td', { class: 'num' }, cell(1e6)),
        h('td', null, EX[c.id])));
    });
  }

  /* ================================================================== match six snippets to their growth class */
  function matchWidget() {
    var el = V.$('#match');
    if (!el) return;
    var id = 'match-snippets';
    V.quizScore.register(id);
    var SNIPS = [
      { key: 'd', o: 'nlogn', code: 'for (let i = 0; i < n; i++)\n  for (let j = 1; j < n; j *= 2) ops++;', why: 'n outer rounds, and the inner counter doubles, so about log₂ n inner rounds each: n log n.' },
      { key: 'a', o: '1', code: 'return a[a.length - 1];', why: 'One read, whatever the length of the array.' },
      { key: 'f', o: '2n', code: 'function f(n) {\n  if (n === 0) return 1;\n  return f(n - 1) + f(n - 1);\n}', why: 'Every call makes two calls on n − 1: 1, 2, 4, … 2ⁿ calls.' },
      { key: 'c', o: 'n', code: 'let total = 0;\nfor (const x of a) total += x;', why: 'One addition per element: n.' },
      { key: 'e', o: 'n2', code: 'for (let i = 0; i < n; i++)\n  for (let j = 0; j < i; j++) ops++;', why: '0 + 1 + … + (n − 1) = n(n − 1)/2 steps: still n².' },
      { key: 'b', o: 'logn', code: 'for (let i = 1; i < n; i *= 2) ops++;', why: 'i doubles each round, so it passes n after about log₂ n rounds.' }
    ];
    var CLS = ['1', 'logn', 'n', 'nlogn', 'n2', '2n'];
    var picks = {}, selected = null, checked = false, attempts = 0;
    el.classList.add('quiz');
    var status = h('span', { class: 'quiz__status' });
    var fb = h('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    var list = h('div', { class: 'match__snips', role: 'group', 'aria-label': 'Snippets' });
    var bank = h('div', { class: 'match__bank', role: 'group', 'aria-label': 'Growth classes' });
    var checkBtn = h('button', { type: 'button', class: 'btn btn--primary btn--sm', disabled: true }, 'Check answers');
    var resetBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, 'Clear');
    el.appendChild(h('div', { class: 'quiz__head' }, h('span', { class: 'quiz__kicker' }, h('i', { class: 'ico', 'data-ico': 'target', 'aria-hidden': 'true' }), 'Match them up'), status));
    el.appendChild(h('p', { class: 'quiz__q' }, 'Match each snippet to its growth class. Select a snippet, then the class it belongs to.'));
    el.appendChild(h('div', { class: 'match__grid' }, list, bank));
    el.appendChild(fb);
    el.appendChild(h('div', { class: 'quiz__actions' }, checkBtn, resetBtn));
    var cards = {};
    SNIPS.forEach(function (sn, i) {
      var pre = h('pre', { class: 'match__code' });
      V.codeBlock(pre, sn.code, 'js');
      var slot = h('span', { class: 'match__slot' }, 'no class yet');
      var note = h('p', { class: 'match__why' });
      var btn = h('button', { type: 'button', class: 'match__snip', 'aria-pressed': 'false', 'aria-label': 'Snippet ' + (i + 1) + ': ' + sn.code.replace(/\n/g, ' ') },
        h('span', { class: 'match__num' }, String(i + 1)), pre, slot);
      var wrap = h('div', { class: 'match__item' }, btn, note);
      btn.addEventListener('click', function () { if (checked) return; selected = sn.key; paint(); });
      list.appendChild(wrap);
      cards[sn.key] = { btn: btn, slot: slot, note: note, wrap: wrap };
    });
    var badges = {};
    CLS.forEach(function (c) {
      var b = h('button', { type: 'button', class: 'match__cls', style: '--cc:' + col(c) }, h('span', { class: 'big-o', 'data-o': c }, B.cls(c).o));
      b.addEventListener('click', function () {
        if (checked) return;
        if (!selected) { fb.className = 'quiz__feedback is-bad'; fb.textContent = 'Select a snippet first, then its class.'; return; }
        picks[selected] = c;
        var order = SNIPS.map(function (x) { return x.key; }), idx = order.indexOf(selected);
        selected = null;
        for (var k = 1; k <= order.length; k++) { var nk = order[(idx + k) % order.length]; if (!picks[nk]) { selected = nk; break; } }
        fb.className = 'quiz__feedback'; fb.textContent = '';
        paint();
        if (selected) cards[selected].btn.focus({ preventScroll: true });
        else checkBtn.focus({ preventScroll: true });
      });
      bank.appendChild(b);
      badges[c] = b;
    });
    function paint() {
      SNIPS.forEach(function (sn) {
        var cd = cards[sn.key], p = picks[sn.key];
        cd.btn.setAttribute('aria-pressed', String(selected === sn.key));
        V.clear(cd.slot);
        if (p) cd.slot.appendChild(h('span', { class: 'big-o', 'data-o': p }, B.cls(p).o)); else cd.slot.textContent = 'no class yet';
      });
      bank.classList.toggle('is-armed', !!selected);
      checkBtn.disabled = checked || SNIPS.some(function (sn) { return !picks[sn.key]; });
    }
    checkBtn.addEventListener('click', function () {
      attempts++;
      var right = 0;
      SNIPS.forEach(function (sn) {
        var ok = picks[sn.key] === sn.o, cd = cards[sn.key];
        cd.wrap.classList.toggle('is-right', ok); cd.wrap.classList.toggle('is-wrong', !ok);
        cd.note.innerHTML = (ok ? '<b>Right.</b> ' : '<b>It is ' + B.cls(sn.o).o + '.</b> ') + sn.why;
        if (ok) right++;
      });
      var all = right === SNIPS.length;
      V.quizScore.record(id, all);
      checked = true; selected = null; paint();
      fb.className = 'quiz__feedback ' + (all ? 'is-good' : 'is-bad');
      fb.innerHTML = all ? '<b>All six right.</b> Loops add, nesting multiplies, halving gives log n, and two recursive calls per level double the work.' : '<b>' + right + ' of 6 right.</b> Read the notes under each snippet, then press Clear to try again.';
      status.textContent = all ? (attempts === 1 ? 'Correct first try' : 'Solved') : '';
      status.className = 'quiz__status' + (all ? ' is-good' : '');
    });
    resetBtn.addEventListener('click', function () {
      picks = {}; selected = SNIPS[0].key; checked = false;
      SNIPS.forEach(function (sn) { var cd = cards[sn.key]; cd.wrap.classList.remove('is-right', 'is-wrong'); cd.note.innerHTML = ''; });
      fb.className = 'quiz__feedback'; fb.textContent = '';
      paint();
    });
    selected = SNIPS[0].key;
    if (V.quizScore.wasSolved(id)) { status.textContent = 'Solved before'; status.className = 'quiz__status is-good'; }
    paint();
  }

  /* ================================================================== click the biggest count at n = 1000 */
  function whichFigure() {
    var fig = V.$('#fig-which');
    if (!fig) return;
    var stage = fig.querySelector('[data-stage]');
    var N = 1000;
    var C = [
      { id: 'c100n2', expr: '100 · n²', note: 'a big constant', o: 'n2', l: 2 + 2 * 3 },
      { id: 'n3', expr: 'n³', note: 'no constant at all', o: 'n3', l: 9 },
      { id: 'nlogn', expr: '1,000 · n log₂ n', note: 'a huge constant', o: 'nlogn', l: 3 + Math.log10(N * Math.log2(N)) },
      { id: 'exp', expr: '2^(n / 50)', note: 'exponential, slowly', o: '2n', l: (N / 50) * Math.log10(2) }
    ];
    var bars = {};
    C.forEach(function (c) {
      var fill = h('span', { class: 'which__fill' }), val = h('span', { class: 'which__val' }, '?');
      var card = h('div', { class: 'which__card', 'data-id': c.id, 'data-label': c.expr + ' steps', style: '--cc:' + col(c.o) },
        h('span', { class: 'which__expr' }, c.expr), h('span', { class: 'which__note' }, c.note),
        h('span', { class: 'which__bar' }, fill), val);
      stage.appendChild(card);
      bars[c.id] = { fill: fill, val: val };
    });
    function reveal() {
      C.forEach(function (c, i) {
        var b = bars[c.id];
        setTimeout(function () { b.fill.style.width = (c.l / 10 * 100) + '%'; b.val.textContent = '≈ ' + B.formatBig(c.l); }, V.reducedMotion() ? 0 : i * 140);
      });
    }
    V.clickQuiz(stage, {
      el: '#quiz-which', id: 'which-largest',
      question: 'At <b>n = 1,000</b>, which algorithm does the most steps? Click its card.',
      check: function (cid) {
        var msg = {
          c100n2: '100 · n² = 100 × 10⁶ = 10⁸. A big constant, but n³ passed it at n = 100 and is ten times bigger here.',
          nlogn: '1,000 · n log₂ n ≈ 10⁷. A constant of 1,000 cannot make up for such slow growth.',
          exp: '2^(n/50) = 2²⁰ ≈ 10⁶ at n = 1,000: the smallest right now. It does grow fastest, and passes n³ at about n = 1,600.'
        };
        if (cid === 'n3') return { correct: true, message: 'n³ = 10⁹ is the largest at n = 1,000. But 2^(n/50) grows fastest: it is only about 10⁶ here, yet it overtakes n³ at about n = 1,600. Growth rate decides the long run; the value at one n can mislead.' };
        return { correct: false, message: msg[cid] };
      }
    }).onAnswer(function (r) { if (r.correct) reveal(); });
  }

  /* ================================================================== multiple-choice checks */
  function quizzes() {
    V.quiz('#quiz-triple', {
      question: 'An O(n²) algorithm takes <b>2 seconds</b> on 1,000 items. Roughly how long on <b>3,000</b> items?',
      options: ['6 seconds', '8 seconds', '18 seconds', '54 seconds'],
      answer: 2,
      explain: [
        'That is what a linear algorithm would do: 3 × the items, 3 × the time.',
        '8 = 2 × 4 is what doubling n does to quadratic work. Here n triples.',
        'Tripling n multiplies n² by 3² = 9, so 2 s × 9 = 18 s.',
        '54 = 2 × 27 is what tripling does to cubic work, n³.'
      ],
      id: 'quiz-triple'
    });
    V.quiz('#quiz-bound', {
      question: 'Which statements are true? Pick all that apply.',
      options: ['“O(n²)” means the worst case takes exactly n² steps.', 'Merge sort is O(n²).', 'Binary search is Θ(log n) in its best case.', '3n + 100 is Θ(n).'],
      answer: [1, 3],
      explain: 'B is true but loose: O is only a ceiling, and n² sits above n log n. D is true: 3n ≤ 3n + 100 ≤ 4n once n ≥ 100. A is false twice over: O hides constants, and it is a bound, not a case. C is false: in the best case binary search finds the target on its first probe, so the best case is Θ(1).',
      id: 'quiz-bound'
    });
  }

  /* ================================================================== summary tiles */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    function tile(svg, label, textStr) {
      svg.style.height = '100%';
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, svg), h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, textStr)));
    }
    var W = 160, H = 80;
    // 1 count steps
    var a = svgRoot(W, H, null, 'l05-sum');
    a.appendChild(s('rect', { class: 'sum-box', x: 18, y: 16, width: 124, height: 48, rx: 10 }));
    a.appendChild(text(80, 36, 'T(n) = n − 1', { class: 'sum-t', 'text-anchor': 'middle' }));
    a.appendChild(text(80, 53, 'comparisons', { class: 'sum-s', 'text-anchor': 'middle' }));
    tile(a, 'Count steps, not seconds', 'Name one basic operation and count it as a function of n.');
    // 2 ladder
    var b = svgRoot(W, H, null, 'l05-sum');
    ['1', 'logn', 'n', 'nlogn', 'n2', '2n'].forEach(function (id) {
      var d = '';
      for (var x = 1; x <= 12; x += 0.25) {
        var y = L.smoothF(id, x) * 0.9;
        d += (d ? 'L' : 'M') + (8 + (x - 1) * 12.5).toFixed(1) + ' ' + Math.max(4, 72 - y * 0.66).toFixed(1);
        if (72 - y * 0.66 < 4) break;            // stop where the curve leaves the tile
      }
      b.appendChild(s('path', { class: 'sum-line', d: d, style: '--cc:' + col(id) }));
    });
    tile(b, 'The growth ladder', '1 < log n < n < n log n < n² < 2ⁿ < n!. The rung decides what scales.');
    // 3 doubling
    var c = svgRoot(W, H, null, 'l05-sum');
    [['n', 2], ['n2', 4]].forEach(function (p, i) {
      var y = 18 + i * 30;
      c.appendChild(s('rect', { class: 'sum-ghost', x: 14, y: y, width: 26, height: 12, rx: 4 }));
      c.appendChild(s('rect', { class: 'sum-bar', x: 14, y: y, width: 26 * p[1] / 1.4, height: 12, rx: 4, style: '--cc:' + col(p[0]) }));
      c.appendChild(text(150, y + 10, '×' + p[1], { class: 'sum-t', 'text-anchor': 'end' }));
    });
    tile(c, 'The doubling test', 'Double n: linear work ×2, quadratic ×4, exponential squares.');
    // 4 constants
    var d2 = svgRoot(W, H, null, 'l05-sum');
    d2.appendChild(s('path', { class: 'sum-line', d: 'M10 62 L150 22', style: '--cc:' + col('n') }));
    d2.appendChild(s('path', { class: 'sum-line is-dashed', d: 'M10 72 L150 32', style: '--cc:var(--st-muted)' }));
    d2.appendChild(s('path', { class: 'sum-line', d: 'M10 76 L150 4', style: '--cc:' + col('n2') }));
    tile(d2, 'Keep the biggest term', 'Constants shift a curve, exponents tilt it. 3n + 5 is O(n).');
    // 5 cases vs bounds
    var e = svgRoot(W, H, null, 'l05-sum');
    for (var k = 0; k < 8; k++) e.appendChild(s('rect', { class: 'sum-bar', x: 14 + k * 17, y: 70 - (k + 1) * 7, width: 13, height: (k + 1) * 7, rx: 2, style: '--cc:' + (k === 0 ? 'var(--st-done)' : k === 7 ? 'var(--st-swap)' : 'var(--st-active)') }));
    tile(e, 'Cases are not bounds', 'Best, average, worst pick the input; O, Ω, Θ bound its cost.');
    // 6 feasibility
    var f = svgRoot(W, H, null, 'l05-sum');
    [['n2', '10,000', 0.62], ['2n', '26', 0.14]].forEach(function (p, i) {
      var y = 16 + i * 30;
      f.appendChild(s('rect', { class: 'sum-bar', x: 12, y: y, width: 136 * p[2], height: 14, rx: 4, style: '--cc:' + col(p[0]) }));
      f.appendChild(text(16 + 136 * p[2], y + 11, B.cls(p[0]).label + ': ' + p[1], { class: 'sum-s' }));
    });
    tile(f, 'What fits in a second', 'At 10⁸ steps per second: n² handles 10,000 items, 2ⁿ only 26.');
  }

  /* ================================================================== boot */
  V.ready(function () {
    // Register the checkpoint ids now so the page score has its full total before the figures load.
    ['race-halving', 'lab-predict-total'].forEach(function (id) { V.quizScore.register(id); });
    L.teaser();
    classTable();
    matchWidget();
    whichFigure();
    quizzes();
    summary();
    L.patterns();
    [['#fig-race', L.race], ['#fig-machines', L.machines], ['#fig-party', L.party], ['#fig-counter', L.counter],
     ['#fig-growth', L.growth], ['#fig-doubling', L.doubling], ['#fig-constants', L.constants], ['#fig-bounds', L.bounds],
     ['#fig-cases', L.cases], ['#fig-space', L.space], ['#lab-fig', L.lab], ['#fig-flow', L.flow],
     ['#fig-feasible', L.feasible], ['#fig-timeline', L.timeline], ['#fig-amortized', L.amortized]
    ].forEach(function (p) { L.lazy(V.$(p[0]), p[1]); });
  });
}());
