/* Lesson 35 · Dynamic programming II — figure wiring.
   Generators: js/algos/35-dynamic-programming-2d.js (VDSA.algos['35-dynamic-programming-2d'], tested in Node).
   Custom views: js/lessons/35-dynamic-programming-2d-views.js (VDSA.dp35.pairStrip, candBar, knapStage, staticGrid).
   Labs and code: js/lessons/35-dynamic-programming-2d-labs.js (VDSA.dp35.labs.lcs / edit / knap).
   The rest of the figures: this file and 35-dynamic-programming-2d-more.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A = V.algos['35-dynamic-programming-2d'];
  var D = V.dp35, $ = D.$, lazy = D.lazy;

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = $('#teaser');
    if (!stage) return;
    var view = V.views.grid(stage, { mode: 'table', cellSize: 42, minCell: 22, label: 'Teaser', pop: false });
    view.el.setAttribute('aria-hidden', 'true');
    var steps = A.lcsTeaser('BATH', 'BEAT');
    view.prepare(steps.map(function (x) { return x.table; }));
    V.teaser(stage, { steps: steps, render: function (st, ctx) { view.render(st.table, { duration: ctx.duration }); }, stepMs: 780, holdMs: 2600, instantWrap: true });
  }

  /* ================================================================== the problem: robot on a grid */
  function gridFigure() {
    var fig = $('#fig-grid');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Neighbours that feed it' }, { state: 'key', shape: 'line', label: 'Paths flowing in' }, { state: 'found', label: 'Goal' }, { state: 'path', label: 'One route' }, { state: 'default', shape: 'square', color: 'var(--ink-3)', label: 'Obstacle' }]);
    var ROWS = 5, COLS = 6;
    var walls = [[1, 3], [2, 1], [3, 4]];
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.grid(stage, { mode: 'table', cellSize: 56, minCell: 30, label: 'Grid path counts. Click a cell to toggle an obstacle.', onCellClick: onClick });
    function decorate(steps) {
      return steps.map(function (st) {
        var t = st.table, cells = t.cells.map(function (r) { return r.slice(); });
        var g = cells[ROWS - 1][COLS - 1];
        cells[ROWS - 1][COLS - 1] = Object.assign({ state: 'default' }, g || {}, { label: 'goal' });
        if (cells[0][0]) cells[0][0] = Object.assign({}, cells[0][0], { label: 'start' });
        return Object.assign({}, st, { table: Object.assign({}, t, { cells: cells }) });
      });
    }
    var player = V.player({
      root: fig, steps: [], baseStepMs: 520, label: 'Grid path controls',
      render: function (st, ctx) { view.render(st.table, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { cells: 'Cells filled' }
    });
    function load(atEnd) {
      var steps = decorate(A.gridSteps(ROWS, COLS, walls));
      view.reset(); view.prepare(steps.map(function (x) { return x.table; }));
      player.setSteps(steps, atEnd ? { index: steps.length - 1 } : undefined);
    }
    function onClick(e) {
      var r = e.row, c = e.col;
      if ((r === 0 && c === 0) || (r === ROWS - 1 && c === COLS - 1)) return;
      var k = walls.findIndex(function (w) { return w[0] === r && w[1] === c; });
      if (k >= 0) walls.splice(k, 1); else walls.push([r, c]);
      load(true);
    }
    var PRE = { open: [], rocks: [[1, 3], [2, 1], [3, 4]], corridor: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3], [4, 3]], sealed: [[0, 1], [1, 0]] };
    V.segmented(fig.querySelector('[data-preset]'), { label: 'Obstacles', value: 'rocks',
      options: [{ value: 'open', label: 'Open field' }, { value: 'rocks', label: 'A few rocks' }, { value: 'corridor', label: 'Zig-zag' }, { value: 'sealed', label: 'Sealed start' }],
      onChange: function (v) { walls = PRE[v].map(function (w) { return w.slice(); }); load(true); } });
    load(true);
  }

  /* ================================================================== intuition: what two strings share */
  function shareFigure() {
    var fig = $('#fig-share');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'path', label: 'Letter used, linked across' }, { state: 'error', label: 'Not a common subsequence' }, { state: 'default', shape: 'outline', label: 'Letter left out' }]);
    var strip = D.pairStrip(fig.querySelector('[data-stage]'), { label: 'Two strings and the letters they share, in order' });
    var raw = A.shareSteps('AGGTAB', 'GXTXAYB', ['G', 'GT', 'TG', 'AB', 'GAB', 'GTAB']);
    var tried = 0;
    var steps = raw.map(function (st) {
      if (st.kind === 'good' || st.kind === 'bad') tried++;
      return Object.assign({}, st, { counters: { tried: tried, best: st.count.best } });
    });
    V.player({
      root: fig, steps: steps, baseStepMs: 1500, label: 'Common subsequence tour',
      render: function (st, ctx) { strip.render(st.strip, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { tried: 'Candidates tried', best: 'Best length so far' }, counterStates: { best: 'path' }
    });
  }

  /* ================================================================== intuition: what one cell means (click a cell) */
  function prefixFigure() {
    var fig = $('#fig-prefix');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'Letters in the two prefixes' }, { state: 'active', label: 'Last letters' }, { state: 'path', label: 'A longest common subsequence of the prefixes' }, { state: 'active', shape: 'ring', label: 'Chosen cell' }]);
    var a = 'AGGTAB', b = 'GXTXAYB', m = a.length, n = b.length;
    var t = A.lcsTables(a, b);
    var strip = D.pairStrip(fig.querySelector('[data-strip]'), { label: 'The two prefixes selected by the chosen cell' });
    var cap = fig.querySelector('[data-caption]');
    var view = V.views.grid(fig.querySelector('[data-stage]'), { mode: 'table', cellSize: 44, minCell: 20, label: 'LCS table of AGGTAB and GXTXAYB. Choose any cell.', pop: false, onCellClick: function (e) { show(e.row, e.col); } });
    var sel = [3, 4];
    function tableState(i, j) {
      var cells = t.dp.map(function (row, r) { return row.map(function (v, c) { return { value: v, state: r === i && c === j ? 'active' : r <= i && c <= j ? 'visited' : 'default' }; }); });
      return { rows: m + 1, cols: n + 1, cells: cells, rowHeaders: ['∅'].concat(a.split('')), colHeaders: ['∅'].concat(b.split('')), cursor: [i, j], highlightRow: i, highlightCol: j };
    }
    function show(i, j, instant) {
      sel = [i, j];
      var pa = a.slice(0, i), pb = b.slice(0, j);
      var tt = A.lcsTables(pa, pb), tr = A.lcsTrace(pa, pb, tt);
      view.render(tableState(i, j), { duration: instant ? 0 : 320 });
      strip.render({ a: a, b: b, i: i, j: j, links: tr.links, result: tr.string, L: t.dp[i][j], trace: false }, { duration: instant ? 0 : 320 });
      cap.innerHTML = 'Cell <b>dp[' + i + '][' + j + '] = ' + t.dp[i][j] + '</b>: the first ' + i + ' letter' + (i === 1 ? '' : 's') + ' of A (<b>' + (pa || '∅') + '</b>) and the first ' + j + ' letter' + (j === 1 ? '' : 's') + ' of B (<b>' + (pb || '∅') + '</b>) ' + (t.dp[i][j] ? 'share a subsequence of length ' + t.dp[i][j] + ', for example <b>' + tr.string + '</b>.' : 'share no letters at all.');
    }
    show(3, 4, true);
    V.onVisible(fig, function (vis) { if (vis && !fig.__seen) { fig.__seen = true; show(sel[0], sel[1], true); } });
  }

  /* ================================================================== the recurrence: three tiny windows */
  function rulesMinis() {
    var host = $('#mini-rules');
    function mini(caption, state, o) {
      var st = h('div', { class: 'mini__stage' });
      host.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: caption })));
      D.staticGrid(st, state, Object.assign({ cellSize: 50, minCell: 30, label: 'A two by two window of the table' }, o || {}));
    }
    var hdr = function (rows, cols) { return { rowHeaders: rows, colHeaders: cols }; };
    mini('<b>Letters match</b> (T and T). The best answer for the shorter strings is up-left; the match extends it by 1: <b>2 + 1 = 3</b>. Taking max(↑, ←) would give only 2.',
      D.miniState([[2, 2], [2, null]], Object.assign({ states: { '0,0': 'compare', '0,1': 'muted', '1,0': 'muted', '1,1': 'active' }, arrows: [{ from: [0, 0], to: [1, 1], state: 'key', label: '+1' }], cursor: [1, 1], text: { '1,1': '3' } }, hdr(['', 'T'], ['', 'T']))));
    mini('<b>Letters differ</b> (T and X). They cannot both end the subsequence, so drop one: take the larger of the cell above (3) and the cell to the left (2): <b>3</b>.',
      D.miniState([[2, 3], [2, null]], Object.assign({ states: { '0,0': 'muted', '0,1': 'compare', '1,0': 'compare', '1,1': 'active' }, arrows: [{ from: [0, 1], to: [1, 1], state: 'key' }, { from: [1, 0], to: [1, 1], state: 'default' }], cursor: [1, 1], text: { '1,1': '3' } }, hdr(['', 'T'], ['', 'X']))));
    mini('<b>An empty string</b> (∅) shares nothing with anything, so row 0 and column 0 are <b>0</b>. These base cells are what every arrow chain starts from.',
      D.miniState([[0, 0, 0], [0, null, null]], Object.assign({ states: { '0,0': 'done', '0,1': 'done', '0,2': 'done', '1,0': 'done' } }, hdr(['∅', 'T'], ['∅', 'A', 'B']))));
  }

  /* ================================================================== the fill order figure */
  function orderFigure() {
    var fig = $('#fig-order');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Cells finished this step' }, { state: 'compare', shape: 'line', label: 'Cells they read' }, { state: 'visited', label: 'Finished (number = order)' }, { state: 'error', label: 'Reads an empty cell' }]);
    var view = V.views.grid(fig.querySelector('[data-stage]'), { mode: 'table', cellSize: 50, minCell: 26, label: 'A five by five table filled in a chosen order', pop: false });
    var player = V.player({
      root: fig, steps: [], baseStepMs: 620, label: 'Fill order controls',
      render: function (st, ctx) { view.render(st.table, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { cells: 'Cells finished', waiting: 'Empty cells it needs' }, counterStates: { waiting: 'error' }
    });
    function load(order) {
      var steps = A.orderSteps(5, order);
      view.reset(); view.prepare(steps.map(function (x) { return x.table; }));
      player.setSteps(steps);
    }
    V.segmented(fig.querySelector('[data-preset]'), { label: 'Fill order', value: 'row',
      options: [{ value: 'row', label: 'Row by row' }, { value: 'col', label: 'Column by column' }, { value: 'diag', label: 'Diagonals' }, { value: 'bad', label: 'Bottom row first' }],
      onChange: load });
    load('row');
  }

  /* ================================================================== edit distance: the three operations */
  function editOpsMinis() {
    var host = $('#mini-ops');
    function mini(caption, before, after, aria) {
      var st = h('div', { class: 'mini__stage' });
      host.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: caption })));
      var view = V.views.array(st, { mode: 'boxes', cellSize: 38, showIndices: false, label: aria, rowLabels: 'above' });
      view.render({ rows: [{ id: 'b', label: 'before', items: before }, { id: 'a', label: 'after', items: after }] }, { duration: 0 });
    }
    function it(id, ch, state) { return ch === null ? null : { id: id, value: ch, state: state || 'default' }; }
    mini('<b>Replace</b>: one letter changes. The diagonal arrow ↖ costs 1 (or 0 when the letters already agree).',
      [it('c', 'c'), it('a', 'a', 'pivot'), it('t', 't')], [it('c2', 'c'), it('u', 'u', 'pivot'), it('t2', 't')], 'cat becomes cut by replacing a with u');
    mini('<b>Delete</b>: a letter of A has no partner. The arrow ↑ (one row up, same column) costs 1.',
      [it('c', 'c'), it('a', 'a', 'error'), it('t', 't')], [it('c2', 'c'), null, it('t2', 't')], 'cat becomes ct by deleting a');
    mini('<b>Insert</b>: a letter of B appears from nowhere. The arrow ← (same row, one column left) costs 1.',
      [it('c', 'c'), null, it('t', 't')], [it('c2', 'c'), it('a2', 'a', 'active'), it('t2', 't')], 'ct becomes cat by inserting a');
  }

  /* ================================================================== knapsack: the greedy trap (two bags) */
  function greedyMinis() {
    var host = $('#mini-greedy');
    var items = [{ w: 1, v: 6 }, { w: 2, v: 10 }, { w: 3, v: 12 }];
    function mini(caption, taken, label) {
      var st = h('div', { class: 'mini__stage' });
      host.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: caption })));
      var stage = D.knapStage(st, { label: label });
      var bagW = 0, bagV = 0, list = items.map(function (it, k) {
        var slot = taken.indexOf(k + 1);
        if (slot >= 0) { bagW += it.w; bagV += it.v; }
        return { id: 'it' + (k + 1), no: k + 1, w: it.w, v: it.v, state: slot >= 0 ? 'path' : 'muted', slot: slot };
      });
      stage.render({ items: list, W: 5, bagW: bagW, bagV: bagV }, { duration: 0 });
    }
    mini('<b>Greedy</b>: grab the best value per weight (#1 is 6 per unit, #2 is 5, #3 is 4). It takes #1 and #2, then #3 no longer fits: value <b>16</b>.', [1, 2], 'Greedy fills the bag with items 1 and 2 for value 16');
    mini('<b>Best</b>: skip the "best-looking" #1 and take #2 and #3. They fill the bag exactly: value <b>22</b>. Only a table that tries both choices finds it.', [2, 3], 'The best bag holds items 2 and 3 for value 22');
  }
  function knapClickFigure() {
    var fig = $('#fig-knap-click');
    var items = [{ w: 4, v: 6 }, { w: 3, v: 5 }, { w: 2, v: 3 }];
    var stage = D.knapStage(fig.querySelector('[data-stage]'), { label: 'Three items and a bag with room for 5' });
    stage.render({ items: items.map(function (it, k) { return { id: 'it' + (k + 1), no: k + 1, w: it.w, v: it.v, state: 'default', slot: -1 }; }), W: 5, bagW: 0, bagV: 0 }, { duration: 0 });
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-knap-click', id: 'knap-click-leftout',
      question: 'The bag holds 5 units. Items: <b>#1</b> weight 4, value 6 · <b>#2</b> weight 3, value 5 · <b>#3</b> weight 2, value 3. <b>Click the item the best bag leaves out.</b>',
      check: function (id) {
        if (id === 'it1') return { correct: true, message: 'Item #1 is worth the most alone (6), but #2 + #3 weigh exactly 5 and are worth 8. A table compares 6 against 8; a hunch would not.' };
        if (id === 'it2') return { correct: false, message: 'If #2 is out, the best you can do is #1 alone (weight 4, value 6) or #3 alone: at most 6. With #2 and #3 together you get 8.' };
        return { correct: false, message: 'If #3 is out, you have #1 (4) or #2 (3): #1 and #2 together weigh 7, too heavy, so the best is 6. Keeping #3 with #2 gives 8.' };
      }
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // register check ids up front so the page score total is stable while figures load lazily
    if (V.quizScore) ['lab-lcs-cell', 'lab-edit-arrow', 'lab-knap-take', 'space-forward-cell'].forEach(V.quizScore.register);
    var eager = [heroTeaser, gridFigure, shareFigure, rulesMinis, editOpsMinis, greedyMinis, knapClickFigure];
    eager.concat(D.moreEager || []).forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[lesson 35] ' + (fn.name || 'figure') + ' failed', e); }
    });
    lazy($('#fig-prefix'), prefixFigure);
    lazy($('#fig-order'), orderFigure);
    lazy([$('#lab-lcs'), $('#fig-flow')], D.labs.lcs);
    lazy($('#lab-edit'), D.labs.edit);
    lazy($('#lab-knap'), D.labs.knap);
    (D.moreLazy || []).forEach(function (p) { lazy($(p[0]), p[1]); });
  });

  V.lessons = V.lessons || {};
  V.lessons['35-dynamic-programming-2d'] = { algos: A };
}());
