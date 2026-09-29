/* Lesson 37 · P, NP & hard problems — shared helpers and the first figures.
   Part 2 (TSP lab, tour comparison, hero teaser): js/lessons/37-p-vs-np-tsp.js
   Part 3 (reductions, 3-SAT, Cook-Levin, web of hardness, vertex cover lab): js/lessons/37-p-vs-np-logic.js
   Part 4 (class map, decision guide, variations, checks, summary): js/lessons/37-p-vs-np-more.js
   Step generators: js/algos/37-p-vs-np.js (VDSA.algos.pnp). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos.pnp;
  var L = V.L37 = V.L37 || {};
  L.A = A;

  /* ================================================================== helpers */
  /* Start a figure when it nears the viewport. Everything registered with checks is still counted early by the caller. */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 37] figure failed', el.id || el.className, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };
  L.q = function (fig, sel) { return fig.querySelector(sel); };
  L.txt = function (x, y, cls, str, extra) { return s('text', Object.assign({ x: x, y: y, class: cls }, extra || {}), str); };

  /* ================================================================== 1. the race: verify vs solve */
  function raceView(stage) {
    var CELL = 30, cellsV = [], cellsS = [];
    function grid(kind, label) {
      var svg = s('svg', { class: 'race-grid', viewBox: '-2 -2 274 274', role: 'img', 'aria-label': label });
      var cells = [];
      for (var i = 0; i < 81; i++) {
        var r = Math.floor(i / 9), c = i % 9;
        var g = s('g', { class: 'rc' },
          s('rect', { x: c * CELL, y: r * CELL, width: CELL, height: CELL }),
          s('text', { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 + 1, class: 'rc-t' }));
        svg.appendChild(g); cells.push({ g: g, t: g.lastChild });
      }
      for (var k = 0; k <= 9; k++) {
        var thick = k % 3 === 0;
        svg.appendChild(s('line', { x1: 0, x2: 270, y1: k * CELL, y2: k * CELL, class: 'rc-line' + (thick ? ' is-box' : '') }));
        svg.appendChild(s('line', { y1: 0, y2: 270, x1: k * CELL, x2: k * CELL, class: 'rc-line' + (thick ? ' is-box' : '') }));
      }
      return { svg: svg, cells: cells };
    }
    var gv = grid('verify', 'Sudoku being verified, one row, column or box at a time');
    var gs = grid('solve', 'Sudoku being solved by backtracking');
    cellsV = gv.cells; cellsS = gs.cells;
    function panel(title, sub, g, id) {
      var status = h('span', { class: 'race-status' }, 'ready');
      var bar = h('i');
      var txt = h('div', { class: 'race-meter__txt' });
      var el = h('div', { class: 'race-panel', id: id },
        h('div', { class: 'race-panel__head' }, h('div', null, h('h4', { class: 'race-panel__title' }, title), h('p', { class: 'race-panel__sub' }, sub)), status),
        g.svg,
        h('div', { class: 'race-meter' }, h('div', { class: 'race-meter__bar', 'aria-hidden': 'true' }, bar), txt));
      return { el: el, status: status, bar: bar, txt: txt };
    }
    var pv = panel('Verify', 'Check a filled grid', gv, 'race-verify');
    var ps = panel('Solve', 'Find a solution from the clues', gs, 'race-solve');
    var wrap = h('div', { class: 'race' }, pv.el, ps.el);
    V.clear(stage); stage.appendChild(wrap);
    var UNITS = ['row', 'col', 'box'];

    function render(step, ctx) {
      var dur = (ctx && ctx.duration) || 0;
      wrap.style.setProperty('--t', dur + 'ms');
      var v = step.verify, given = step.given, cand = step.cand;
      var passes = new Array(81).fill(0), passed = v.kind === 'reject' ? Math.max(0, v.unitsDone - 1) : v.unitsDone;
      for (var u = 0; u < passed && u < 27; u++) A.unitCells(UNITS[Math.floor(u / 9)], u % 9).forEach(function (ci) { passes[ci]++; });
      var inUnit = {};
      if (v.kind === 'unit' || v.kind === 'reject') v.cells.forEach(function (ci) { inUnit[ci] = true; });
      var clash = {}; (v.clash || []).forEach(function (ci) { clash[ci] = true; });
      var accepted = v.kind === 'accept';
      for (var i = 0; i < 81; i++) {
        var cv = cellsV[i], cls = 'rc';
        if (given[i]) cls += ' is-given';
        if (passes[i] > 0) cls += ' is-p' + Math.min(3, passes[i]);
        if (accepted) cls += ' is-ok';
        if (inUnit[i]) cls += ' is-unit';
        if (clash[i]) cls += ' is-clash';
        cv.g.setAttribute('class', cls);
        cv.t.textContent = cand[i] || '';
        var cs = cellsS[i], c2 = 'rc';
        var d = step.solveGrid[i];
        if (given[i]) c2 += ' is-given'; else if (d) c2 += ' is-placed';
        if (i === step.cell && step.solveNodes > 0 && !step.done) c2 += ' is-cur';
        if (step.done) c2 += ' is-ok';
        cs.g.setAttribute('class', c2);
        cs.t.textContent = d || '';
      }
      var reads = step.counters.verifyOps, nodes = step.counters.solveOps;
      pv.status.textContent = v.kind === 'start' ? 'ready' : v.kind === 'accept' ? 'accepted' : v.kind === 'reject' ? 'rejected' : 'checking';
      pv.status.setAttribute('data-state', v.kind === 'accept' ? 'done' : v.kind === 'reject' ? 'error' : v.kind === 'start' ? 'idle' : 'compare');
      ps.status.textContent = step.done ? 'solved' : nodes ? 'searching' : 'ready';
      ps.status.setAttribute('data-state', step.done ? 'done' : nodes ? 'active' : 'idle');
      pv.txt.innerHTML = '<b>' + A.fmtInt(reads) + '</b> cell reads' + (reads ? ' <span>≈ ' + A.fmtDuration(reads * 1e-6) + ' at a million per second</span>' : '');
      ps.txt.innerHTML = '<b>' + A.fmtInt(nodes) + '</b> placements' + (nodes ? ' <span>≈ ' + A.fmtDuration(nodes * 1e-6) + ' at a million per second</span>' : '');
      pv.bar.style.width = Math.max(reads ? 1.2 : 0, reads / step.N * 100) + '%';
      ps.bar.style.width = (nodes / step.N * 100) + '%';
    }
    return { render: render, el: wrap };
  }
  L.raceView = raceView;

  function raceFigure(fig) {
    var stage = L.q(fig, '[data-stage]'), view = raceView(stage);
    var key = 'gentle', wrong = false;
    function gen() { return A.raceSteps(key, wrong).steps; }
    V.legend(L.q(fig, '[data-legend]'), [
      { state: 'compare', label: 'Unit under check' }, { state: 'done', label: 'Passed' }, { state: 'error', label: 'Duplicate' },
      { state: 'active', label: 'Digit the solver placed' }
    ]);
    var player = V.player({
      root: fig, steps: gen(), render: function (st, ctx) { view.render(st, ctx); },
      caption: L.q(fig, '[data-caption]'), baseStepMs: 420, label: 'Verify versus solve controls'
    });
    V.segmented(L.q(fig, '[data-seg-puzzle]'), {
      label: 'Puzzle', value: key,
      options: [{ value: 'gentle', label: 'Gentle puzzle' }, { value: 'nasty', label: 'Nasty puzzle' }],
      onChange: function (v) { key = v; player.setSteps(gen()); }
    });
    V.segmented(L.q(fig, '[data-seg-cand]'), {
      label: 'The grid to verify', value: 'right',
      options: [{ value: 'right', label: 'A correct solution' }, { value: 'wrong', label: 'One digit changed' }],
      onChange: function (v) { wrong = v === 'wrong'; player.setSteps(gen()); }
    });
    return player;
  }

  /* ================================================================== 2. certificate: click the missing edge */
  var CERT = {
    nodes: [['A', 500, 60], ['B', 830, 230], ['C', 700, 470], ['D', 300, 470], ['E', 170, 230], ['F', 930, 480], ['G', 60, 470]],
    edges: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['A', 'E'], ['B', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['D', 'E'], ['B', 'F'], ['C', 'F'], ['D', 'G'], ['E', 'G']],
    claim: ['A', 'B', 'C', 'D', 'E']
  };
  function certFigure(fig) {
    var stage = L.q(fig, '[data-stage]');
    var view = V.views.graph(stage, { bounds: { w: 1000, h: 540 }, maxHeight: 340, label: 'Graph with a claimed clique of five vertices' });
    var inClaim = {}; CERT.claim.forEach(function (x) { inClaim[x] = true; });
    view.render({
      nodes: CERT.nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], state: inClaim[n[0]] ? 'active' : 'default' }; }),
      edges: CERT.edges.map(function (e) { return { from: e[0], to: e[1], state: inClaim[e[0]] && inClaim[e[1]] ? 'active' : 'default' }; })
    }, { duration: 0 });
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'active', label: 'Claimed clique' }, { state: 'default', shape: 'outline', label: 'Other vertices' }]);
    var g = { nodes: CERT.nodes.map(function (n) { return { id: n[0] }; }), edges: CERT.edges };
    var miss = A.missingEdge(g, CERT.claim);
    V.clickQuiz(stage, {
      el: '#quiz-cert',
      question: 'The claim is that A, B, C, D and E are a clique. Click a vertex that is part of a missing edge.',
      id: 'l37-cert-clique',
      check: function (id) {
        if (miss.indexOf(id) >= 0) return true;
        return { correct: false, message: id + ' is joined to all four other claimed vertices. Check each pair: one pair of the ten has no edge.' };
      },
      right: 'Right: <b>' + miss[0] + '</b> and <b>' + miss[1] + '</b> are not joined, so the claim fails. One missing pair is a complete proof that the certificate is wrong. Verifying took 10 pair checks.',
      wrong: 'Not that one. Check every pair among A to E.'
    });
  }

  /* ================================================================== 3. growth chart, clocks */
  var RATES = { 1e6: 'Slow · 10⁶ steps/s', 1e9: 'Fast computer · 10⁹ steps/s', 1e12: 'Supercomputer · 10¹² steps/s' };
  function growthFigure(fig) {
    var stage = L.q(fig, '[data-stage]');
    var chart = V.views.chart(stage, { type: 'line', height: 380, label: 'Steps needed against input size n for n cubed, 2 to the n and n factorial', samples: 118 });
    var scale = 'log', rate = 1e9, n = 20;
    V.legend(L.q(fig, '[data-legend]'), [
      { state: 'active', shape: 'line', label: 'n³ (polynomial)' }, { state: 'path', shape: 'line', label: '2ⁿ' }, { state: 'pivot', shape: 'line', label: 'n!' },
      { state: 'error', shape: 'dash', label: 'age of the universe' }
    ]);
    var clocks = L.q(fig, '[data-clocks]');
    var rows = [
      { k: 'poly', name: 'n³', state: 'active', say: 'polynomial' },
      { k: 'exp', name: '2ⁿ', state: 'path', say: 'exponential' },
      { k: 'fact', name: 'n!', state: 'pivot', say: 'factorial' }
    ];
    var cards = rows.map(function (r) {
      var steps = h('span', { class: 'clock__steps' }), time = h('b', { class: 'clock__time' });
      var el = h('div', { class: 'clock', 'data-state': r.state }, h('span', { class: 'clock__name' }, r.name), steps, time);
      clocks.appendChild(el);
      return { r: r, steps: steps, time: time, el: el };
    });
    function draw(dur) {
      var log = scale === 'log';
      var series = [
        { id: 'poly', label: 'n³', fn: function (x) { return x * x * x; }, state: 'active' },
        { id: 'exp', label: '2ⁿ', fn: function (x) { return Math.pow(2, x); }, state: 'path' },
        { id: 'fact', label: 'n!', fn: function (x) { return A.factorialF(x); }, state: 'pivot' }
      ];
      var xmax = log ? 60 : 12, ymax = log ? 1e32 : 5000;
      var ann = [];
      if (log) {
        ann.push({ y: rate, text: '1 second', state: 'muted', id: 'sec' });
        ann.push({ y: rate * 3.156e7, text: '1 year', state: 'compare', id: 'year' });
        ann.push({ y: rate * A.AGE_OF_UNIVERSE_S, text: 'age of the universe', state: 'error', id: 'univ' });
      }
      var hl = [];
      rows.forEach(function (r) {
        var v = A.opsFor(r.k, n);
        if (r.k !== 'poly' && v <= ymax && n <= xmax) hl.push({ series: r.k, x: n, y: v, label: log ? A.fmtDuration(v / rate) : A.fmtInt(v) });
      });
      chart.render({
        x: { label: 'input size n', min: 1, max: xmax },
        y: log ? { label: 'steps (log scale)', scale: 'log', min: 1, max: ymax } : { label: 'steps (linear scale)', min: 0, max: ymax },
        series: series, annotations: ann, highlight: hl
      }, { duration: dur === undefined ? 500 : dur });
    }
    function clockUpdate() {
      cards.forEach(function (c) {
        var v = A.opsFor(c.r.k, n);
        c.steps.textContent = A.fmtBig(v) + ' steps';
        c.time.textContent = A.fmtDuration(v / rate);
        c.el.classList.toggle('is-wall', v / rate > A.AGE_OF_UNIVERSE_S / 1e4);
      });
    }
    V.segmented(L.q(fig, '[data-seg-scale]'), {
      label: 'Axis scale', value: scale, options: [{ value: 'log', label: 'Log scale' }, { value: 'linear', label: 'Linear scale' }],
      onChange: function (v) { scale = v; draw(900); }
    });
    V.segmented(L.q(fig, '[data-seg-rate]'), {
      label: 'Computer speed', value: String(rate),
      options: Object.keys(RATES).map(function (k) { return { value: k, label: RATES[k] }; }),
      onChange: function (v) { rate = +v; draw(700); clockUpdate(); }
    });
    V.slider(L.q(fig, '[data-slider]'), {
      label: 'n', min: 1, max: 60, step: 1, value: n,
      onInput: function (v) { n = v; draw(120); clockUpdate(); }
    });
    draw(0); clockUpdate();
  }

  /* ================================================================== 4. certificate minis */
  function certMinis() {
    var row = V.$('#mini-cert');
    // 1. SAT
    var sat = s('svg', { viewBox: '0 0 260 150', class: 'l37-mini', role: 'img', 'aria-label': 'Formula with two clauses, an assignment, and both clauses satisfied' },
      s('rect', { x: 12, y: 14, width: 108, height: 40, rx: 10, class: 'lm-card is-ok' }), L.txt(66, 39, 'lm-t', '(x₁ ∨ ¬x₂)', { 'text-anchor': 'middle' }),
      s('rect', { x: 140, y: 14, width: 108, height: 40, rx: 10, class: 'lm-card is-ok' }), L.txt(194, 39, 'lm-t', '(¬x₁ ∨ x₃)', { 'text-anchor': 'middle' }),
      L.txt(130, 82, 'lm-k', 'certificate: x₁=1, x₂=0, x₃=1', { 'text-anchor': 'middle' }),
      s('circle', { cx: 66, cy: 118, r: 13, class: 'lm-dot is-ok' }), L.txt(66, 123, 'lm-tick', '✓', { 'text-anchor': 'middle' }),
      s('circle', { cx: 194, cy: 118, r: 13, class: 'lm-dot is-ok' }), L.txt(194, 123, 'lm-tick', '✓', { 'text-anchor': 'middle' }));
    // 2. clique
    var P = [[130, 22], [212, 62], [190, 128], [70, 128], [48, 62]], E = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    var cq = s('svg', { viewBox: '0 0 260 150', class: 'l37-mini', role: 'img', 'aria-label': 'Graph where four highlighted vertices are all joined to each other' });
    E.forEach(function (e) { cq.appendChild(s('line', { x1: P[e[0]][0], y1: P[e[0]][1], x2: P[e[1]][0], y2: P[e[1]][1], class: 'lm-edge is-on' })); });
    cq.appendChild(s('line', { x1: P[4][0], y1: P[4][1], x2: P[3][0], y2: P[3][1], class: 'lm-edge' }));
    P.forEach(function (p, i) { cq.appendChild(s('circle', { cx: p[0], cy: p[1], r: 13, class: 'lm-node' + (i < 4 ? ' is-on' : '') })); });
    // 3. subset sum
    var vals = [3, 34, 4, 12, 5, 2], pick = { 2: 1, 4: 1 };
    var ss = s('svg', { viewBox: '0 0 260 150', class: 'l37-mini', role: 'img', 'aria-label': 'Numbers 3, 34, 4, 12, 5, 2 with 4 and 5 selected, adding up to the target 9' });
    vals.forEach(function (v, i) {
      var x = 10 + i * 40;
      ss.appendChild(s('rect', { x: x, y: 20, width: 34, height: 40, rx: 8, class: 'lm-card' + (pick[i] ? ' is-key' : '') }));
      ss.appendChild(L.txt(x + 17, 46, 'lm-t' + (pick[i] ? ' is-key' : ''), String(v), { 'text-anchor': 'middle' }));
    });
    ss.appendChild(L.txt(130, 92, 'lm-k', 'certificate: pick 4 and 5', { 'text-anchor': 'middle' }));
    ss.appendChild(L.txt(130, 126, 'lm-t is-big', '4 + 5 = 9 ✓', { 'text-anchor': 'middle' }));
    var items = [
      { svg: sat, cap: '<b>SAT</b>. Certificate: an assignment. Verifier: evaluate each clause, one pass.' },
      { svg: cq, cap: '<b>Clique of size k</b>. Certificate: the k vertices. Verifier: check all k(k−1)/2 pairs.' },
      { svg: ss, cap: '<b>Subset sum</b>. Certificate: the chosen numbers. Verifier: add them up and compare with the target.' }
    ];
    items.forEach(function (it) { row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, it.svg), h('figcaption', { html: it.cap }))); });
  }

  V.ready(function () {
    L.lazy('#fig-race', raceFigure);
    L.lazy('#fig-cert', certFigure);
    L.lazy('#fig-growth', growthFigure);
    certMinis();
    // Register the click quiz's id early so the page score total does not jump when the figure starts lazily.
    if (V.quizScore && V.quizScore.register) V.quizScore.register('l37-cert-clique');
  });
}());
