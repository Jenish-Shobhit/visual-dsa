/* Lesson 35 · Dynamic programming II — the three labs (LCS, edit distance, 0/1 knapsack) and their code.
   Generators: js/algos/35-dynamic-programming-2d.js. Views: 35-dynamic-programming-2d-views.js.
   Every `line` label the generators use exists in every language below (the tests check the label sets). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var D = V.dp35 = V.dp35 || {};
  var A = V.algos['35-dynamic-programming-2d'];

  /* ------------------------------------------------------------------ small helpers shared with the lesson */
  D.$ = function (sel, root) { return (root || document).querySelector(sel); };
  /* Initialise a figure once it comes within ~1.5 screens of the viewport. */
  D.lazy = function (els, fn) {
    els = [].concat(els).filter(Boolean);
    var done = false, io = null;
    function run() { if (done) return; done = true; if (io) io.disconnect(); try { fn(); } catch (e) { console.error(e); } }
    if (!('IntersectionObserver' in window)) { run(); return; }
    io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) run(); }, { rootMargin: '900px 0px 900px 0px' });
    els.forEach(function (el) { io.observe(el); });
  };
  function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function rotate(list, k) { k = ((k % list.length) + list.length) % list.length; return list.slice(k).concat(list.slice(0, k)); }
  function fmtNum(v) { return Number(v).toLocaleString('en-US'); }
  D.fmtNum = fmtNum;

  /* ------------------------------------------------------------------ code */
  D.CODE = {
    lcs: {
      pseudo: [
        'function lcs(A, B)',
        '  dp ← (m + 1) × (n + 1) table of zeros                // @base',
        '  for i ← 1 to m                                       // @loopi',
        '    for j ← 1 to n                                     // @loopj',
        '      if A[i] = B[j]                                   // @cmp',
        '        dp[i][j] ← dp[i−1][j−1] + 1                // @match',
        '      else',
        '        dp[i][j] ← max(dp[i−1][j], dp[i][j−1])     // @skip',
        '  i ← m; j ← n; out ← ""                               // @trace',
        '  while i > 0 and j > 0',
        '    if A[i] = B[j]: out ← A[i] + out; i--; j--         // @pick',
        '    else if dp[i−1][j] ≥ dp[i][j−1]: i--           // @up',
        '    else: j--                                          // @left',
        '  return out                                           // @ret'
      ].join('\n'),
      js: [
        'function lcs(a, b) {',
        '  const m = a.length, n = b.length;',
        '  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));   // @base',
        '  for (let i = 1; i <= m; i++) {                          // @loopi',
        '    for (let j = 1; j <= n; j++) {                        // @loopj',
        '      if (a[i - 1] === b[j - 1]) {                        // @cmp',
        '        dp[i][j] = dp[i - 1][j - 1] + 1;                  // @match',
        '      } else {',
        '        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);  // @skip',
        '      }',
        '    }',
        '  }',
        '  let i = m, j = n, out = "";                             // @trace',
        '  while (i > 0 && j > 0) {',
        '    if (a[i - 1] === b[j - 1]) { out = a[i - 1] + out; i--; j--; }   // @pick',
        '    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;           // @up',
        '    else j--;                                             // @left',
        '  }',
        '  return out;                                             // @ret',
        '}'
      ].join('\n'),
      py: [
        'def lcs(a, b):',
        '    m, n = len(a), len(b)',
        '    dp = [[0] * (n + 1) for _ in range(m + 1)]             # @base',
        '    for i in range(1, m + 1):                              # @loopi',
        '        for j in range(1, n + 1):                          # @loopj',
        '            if a[i - 1] == b[j - 1]:                       # @cmp',
        '                dp[i][j] = dp[i - 1][j - 1] + 1            # @match',
        '            else:',
        '                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]) # @skip',
        '    i, j, out = m, n, ""                                   # @trace',
        '    while i > 0 and j > 0:',
        '        if a[i - 1] == b[j - 1]:                           # @pick',
        '            out = a[i - 1] + out; i -= 1; j -= 1',
        '        elif dp[i - 1][j] >= dp[i][j - 1]:                 # @up',
        '            i -= 1',
        '        else:                                              # @left',
        '            j -= 1',
        '    return out                                             # @ret'
      ].join('\n')
    },
    edit: {
      pseudo: [
        'function editDistance(A, B)',
        '  dp[i][0] ← i and dp[0][j] ← j                 // @base',
        '  for i ← 1 to m                                            // @loopi',
        '    for j ← 1 to n                                          // @loopj',
        '      dp[i][j] ← min(',
        '        dp[i − 1][j − 1] + (A[i] = B[j] ? 0 : 1),           // keep or replace  @diag',
        '        dp[i − 1][j] + 1,                                   // delete A[i]  @del',
        '        dp[i][j − 1] + 1 )                                  // insert B[j]  @ins',
        '  i ← m; j ← n                                              // @trace',
        '  while i > 0 or j > 0',
        '    if the diagonal was best: i--; j--                      // @opdiag',
        '    else if the cell above was best: delete A[i]; i--       // @opdel',
        '    else: insert B[j]; j--                                  // @opins',
        '  return dp[m][n]                                           // @ret'
      ].join('\n'),
      js: [
        'function editDistance(a, b) {',
        '  const m = a.length, n = b.length;',
        '  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));',
        '  for (let i = 0; i <= m; i++) dp[i][0] = i;              // @base',
        '  for (let j = 0; j <= n; j++) dp[0][j] = j;',
        '  for (let i = 1; i <= m; i++) {                          // @loopi',
        '    for (let j = 1; j <= n; j++) {                        // @loopj',
        '      dp[i][j] = Math.min(',
        '        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),   // @diag',
        '        dp[i - 1][j] + 1,                                 // @del',
        '        dp[i][j - 1] + 1);                                // @ins',
        '    }',
        '  }',
        '  let i = m, j = n;                                       // @trace',
        '  while (i > 0 || j > 0) {',
        '    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { i--; j--; }   // @opdiag',
        '    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) i--;   // @opdel',
        '    else j--;                                             // @opins',
        '  }',
        '  return dp[m][n];                                        // @ret',
        '}'
      ].join('\n'),
      py: [
        'def edit_distance(a, b):',
        '    m, n = len(a), len(b)',
        '    dp = [[0] * (n + 1) for _ in range(m + 1)]',
        '    for i in range(m + 1): dp[i][0] = i                    # @base',
        '    for j in range(n + 1): dp[0][j] = j',
        '    for i in range(1, m + 1):                              # @loopi',
        '        for j in range(1, n + 1):                          # @loopj',
        '            dp[i][j] = min(',
        '                dp[i - 1][j - 1] + (a[i - 1] != b[j - 1]), # @diag',
        '                dp[i - 1][j] + 1,                          # @del',
        '                dp[i][j - 1] + 1)                          # @ins',
        '    i, j = m, n                                            # @trace',
        '    while i > 0 or j > 0:',
        '        if i and j and dp[i][j] == dp[i - 1][j - 1] + (a[i - 1] != b[j - 1]):   # @opdiag',
        '            i -= 1; j -= 1',
        '        elif i and dp[i][j] == dp[i - 1][j] + 1:           # @opdel',
        '            i -= 1',
        '        else:                                              # @opins',
        '            j -= 1',
        '    return dp[m][n]                                        # @ret'
      ].join('\n')
    },
    knap: {
      pseudo: [
        'function knapsack(items, W)                 // item k: weight w[k], value v[k]',
        '  dp ← (n + 1) × (W + 1) table of zeros                    // @base',
        '  for i ← 1 to n                                           // @loopi',
        '    for c ← 1 to W                                         // @loopc',
        '      dp[i][c] ← dp[i − 1][c]                  // skip item i   @skip',
        '      if w[i] ≤ c and dp[i − 1][c − w[i]] + v[i] > dp[i][c]    // @cmp',
        '        dp[i][c] ← dp[i − 1][c − w[i]] + v[i]  // take item i   @take',
        '  bag ← { }; c ← W                                         // @trace',
        '  for i ← n down to 1',
        '    if dp[i][c] ≠ dp[i − 1][c]: add i to bag; c ← c − w[i] // @pick',
        '  return dp[n][W]                                          // @ret'
      ].join('\n'),
      js: [
        'function knapsack(items, W) {              // items[k] = { w, v }',
        '  const n = items.length;',
        '  const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));   // @base',
        '  for (let i = 1; i <= n; i++) {                           // @loopi',
        '    const { w, v } = items[i - 1];',
        '    for (let c = 1; c <= W; c++) {                         // @loopc',
        '      dp[i][c] = dp[i - 1][c];                             // @skip',
        '      if (w <= c && dp[i - 1][c - w] + v > dp[i][c])       // @cmp',
        '        dp[i][c] = dp[i - 1][c - w] + v;                   // @take',
        '    }',
        '  }',
        '  const bag = []; let c = W;                               // @trace',
        '  for (let i = n; i >= 1; i--) {',
        '    if (dp[i][c] !== dp[i - 1][c]) { bag.push(i); c -= items[i - 1].w; }   // @pick',
        '  }',
        '  return dp[n][W];                                         // @ret',
        '}'
      ].join('\n'),
      py: [
        'def knapsack(items, W):                    # items[k] = (w, v)',
        '    n = len(items)',
        '    dp = [[0] * (W + 1) for _ in range(n + 1)]             # @base',
        '    for i in range(1, n + 1):                              # @loopi',
        '        w, v = items[i - 1]',
        '        for c in range(1, W + 1):                          # @loopc',
        '            dp[i][c] = dp[i - 1][c]                        # @skip',
        '            if w <= c and dp[i - 1][c - w] + v > dp[i][c]: # @cmp',
        '                dp[i][c] = dp[i - 1][c - w] + v            # @take',
        '    bag, c = [], W                                         # @trace',
        '    for i in range(n, 0, -1):',
        '        if dp[i][c] != dp[i - 1][c]:                       # @pick',
        '            bag.append(i); c -= items[i - 1][0]',
        '    return dp[n][W]                                        # @ret'
      ].join('\n')
    }
  };

  /* ------------------------------------------------------------------ the recipe flowchart (lit by the LCS lab) */
  D.FLOW_SPEC = {
    nodes: [
      { id: 'base', type: 'start', text: 'First row and column = 0', col: 0, row: 0, maxWidth: 260 },
      { id: 'more', type: 'decision', text: 'More cells?', col: 0, row: 1 },
      { id: 'eq', type: 'decision', text: 'A[i] = B[j] ?', col: 0, row: 2 },
      { id: 'max', text: 'cell = max(↑, ←)', col: 0, row: 3 },
      { id: 'diag', text: 'cell = ↖ + 1', col: 1, row: 2 },
      { id: 'next', text: 'Go to the next cell', col: 0, row: 4 },
      { id: 'trace', type: 'end', text: 'Walk the arrows back from the corner', col: 1, row: 1, narrow: { col: 1, row: 1 } }
    ],
    edges: [
      { from: 'base', to: 'more' },
      { from: 'more', to: 'eq', label: 'yes' }, { from: 'more', to: 'trace', label: 'no' },
      { from: 'eq', to: 'diag', label: 'yes' }, { from: 'eq', to: 'max', label: 'no' },
      { from: 'diag', to: 'next', via: { fromSide: 'bottom', toSide: 'right' } }, { from: 'max', to: 'next' },
      { from: 'next', to: 'more', via: { fromSide: 'left', toSide: 'left' } }
    ]
  };

  /* ------------------------------------------------------------------ shared lab plumbing */
  function makeLab(cfg) {
    var fig = cfg.fig;
    var stage = fig.querySelector('[data-stage]');
    var table = V.views.grid(stage, { mode: 'table', cellSize: cfg.cellSize || 46, minCell: 18, label: cfg.tableLabel });
    var cand = D.candBar(fig.querySelector('[data-cands]'), { hint: cfg.hint });
    var hintFor = cfg.hintFor || function () { return cfg.hint; };
    var topHost = fig.querySelector('[data-top]');
    var top = cfg.top(topHost);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: cfg.code, default: 'pseudo', maxHeight: cfg.codeHeight || 340, title: cfg.title });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: cfg.varStates });
    V.legend(fig.querySelector('[data-legend]'), cfg.legend);
    var player = V.player({
      root: fig, steps: [], baseStepMs: cfg.stepMs || 1000, label: cfg.label,
      render: function (st, ctx) { table.render(st.table, { duration: ctx.duration }); top.render(st, ctx); cand.render(st.cands, hintFor(st)); },
      code: code, vars: vars, flow: cfg.flow || null,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: cfg.counterLabels, counterStates: cfg.counterStates
    });
    function load(steps) {
      var vs = cfg.varStates;
      steps = steps.map(function (st) { return Object.assign({}, st, { varStates: vs }); });
      table.reset();
      table.prepare(steps.map(function (x) { return x.table; }));
      if (top.prepare) top.prepare(steps);
      player.setSteps(steps);
      return steps;
    }
    var jump = fig.querySelector('[data-jump]');
    if (jump) jump.addEventListener('click', function () {
      var i = player.steps.findIndex(function (s) { return s.kind === 'answer'; });
      if (i >= 0) player.goto(i);
    });
    return { player: player, load: load, table: table, top: top };
  }
  function seedRandom() { return V.rng((Date.now() ^ 0x5bd1e995) >>> 0); }
  function randWord(rng, len, alphabet) { var s = ''; for (var i = 0; i < len; i++) s += alphabet.charAt(rng.int(0, alphabet.length - 1)); return s; }

  /* ================================================================== LCS lab */
  D.labs = D.labs || {};
  D.labs.lcs = function () {
    var fig = D.$('#lab-lcs');
    var flowFig = D.$('#fig-flow');
    var flowView = null, seen = [], flow = null;
    if (flowFig) {
      V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already passed' }]);
      flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), D.FLOW_SPEC, { label: 'Flowchart of one LCS cell' });
      flow = { highlight: function (id, ctx) {
        if (ctx && ctx.instant) seen = [];
        if (id && seen.indexOf(id) === -1) seen.push(id);
        flowView.render({ active: id, visited: seen.filter(function (x) { return x !== id; }) }, { duration: ctx ? ctx.duration : 0 });
      } };
    }
    var lab = makeLab({
      fig: fig, title: 'lcs', label: 'LCS lab controls', tableLabel: 'LCS table', code: D.CODE.lcs, flow: flow, stepMs: 950,
      hint: 'Each cell weighs its options here: match, or drop a letter.',
      hintFor: function (st) { return st.kind === 'base' ? 'Each cell weighs its options here: match, or drop a letter.' : 'Traceback: an arrow that goes diagonally on a match means the letter is in the subsequence.'; },
      top: function (host) { var v = D.pairStrip(host, { label: 'The two strings and the letters of the common subsequence' }); return { render: function (st, ctx) { v.render(st.strip, ctx); } }; },
      varStates: { i: 'active', j: 'active', 'a[i]': 'compare', 'b[j]': 'compare', 'dp[i][j]': 'active', result: 'path' },
      legend: [{ state: 'active', label: 'Cell / letters compared' }, { state: 'found', label: 'Letters match' }, { state: 'compare', label: 'Cells it reads' }, { state: 'key', shape: 'line', label: 'Winning arrow' }, { state: 'visited', label: 'Filled' }, { state: 'path', label: 'Traceback and subsequence' }],
      counterLabels: { cells: 'Cells filled', matches: 'Matches' }, counterStates: { matches: 'found' }
    });
    var player = lab.player;
    var current = ['AGGTAB', 'GXTXAYB'];
    function load() { lab.load(A.lcsLab(current[0], current[1])); }
    player.addCheckpoint(function (steps) {
      var fallback = -1, any = -1;
      for (var i = 1; i < steps.length; i++) {
        var p = steps[i - 1].predict;
        if (steps[i].kind !== 'write' || !p) continue;
        if (any < 0) any = i;
        if (!p.same && p.up !== p.left && p.i >= 2) return i;
        if (!p.same && fallback < 0) fallback = i;
      }
      return fallback >= 0 ? fallback : any;
    }, function (c) {
      var p = c.prev.predict, a = current[0], b = current[1];
      var rightVal = p.value, wrongs = [];
      if (p.same) wrongs = [p.up, p.left, p.diag];
      else wrongs = [p.up === rightVal ? p.left : p.up, p.diag + 1, rightVal + 1];
      var opts = unique([rightVal].concat(wrongs)).filter(function (v) { return v >= 0; }).sort(function (x, y) { return x - y; }).slice(0, 4);
      if (opts.indexOf(rightVal) === -1) opts[opts.length - 1] = rightVal, opts.sort(function (x, y) { return x - y; });
      return {
        question: 'What goes into <code>dp[' + p.i + '][' + p.j + ']</code>? (The letters are ' + a[p.i - 1] + ' and ' + b[p.j - 1] + '; the cell above holds ' + p.up + ', the cell to the left ' + p.left + ', the diagonal ' + p.diag + '.)',
        options: opts.map(String), answer: opts.indexOf(rightVal),
        explain: opts.map(function (v) {
          if (v === rightVal) return p.same ? 'Right: the letters match, so it is the diagonal cell + 1 = ' + p.diag + ' + 1 = ' + rightVal + '.' : 'Right: the letters differ, so take the better of the cell above (' + p.up + ') and the cell to the left (' + p.left + '): ' + rightVal + '.';
          if (!p.same && v === p.diag + 1) return v + ' is the diagonal + 1, the rule for a <em>match</em>. These letters differ, so the diagonal cannot be extended.';
          if (v === p.up || v === p.left) return v + ' is one of the neighbours, but ' + (p.same ? 'a match always adds 1 to the diagonal cell' : 'the cell keeps the <em>larger</em> of the two') + '.';
          return v + ' does not come from any neighbour: every value here is a neighbour, or the diagonal plus 1.';
        })
      };
    }, { id: 'lab-lcs-cell' });
    var inputHost = fig.querySelector('[data-input]');
    var rng = seedRandom();
    V.inputRow(inputHost, {
      label: 'Two strings, comma-separated (up to ' + A.LIMITS.lcs + ' letters each)', value: current, parse: A.parse.words, placeholder: 'e.g. AGGTAB, GXTXAYB', applyLabel: 'Apply',
      hint: 'Letters and digits only. The table has (length + 1) rows and columns.',
      presets: [
        { label: 'AGGTAB · GXTXAYB', value: ['AGGTAB', 'GXTXAYB'] },
        { label: 'ABCBDAB · BDCABA', value: ['ABCBDAB', 'BDCABA'] },
        { label: 'Identical', value: ['BANANA', 'BANANA'] },
        { label: 'Nothing shared', value: ['ABC', 'XYZ'] },
        { label: 'One inside the other', value: ['ACE', 'ABCDE'] },
        { label: 'Random', value: function () { return [randWord(rng, rng.int(5, 8), 'ABCD'), randWord(rng, rng.int(5, 8), 'ABCD')]; } }
      ],
      onApply: function (vals) { current = vals; load(); }
    });
    load();
    return lab;
  };

  /* ================================================================== edit distance lab */
  function wordViewFactory(host) {
    var view = V.views.array(host, { mode: 'boxes', cellSize: 40, pointerStyle: 'chip', label: 'The word A being turned into the word B' });
    function chars(s) { return String(s).split(''); }
    function toState(st) {
      var w = st.word, a = w.a, b = w.b, rowA, rowB, ptrs = [];
      if (w.mode === 'fill') {
        var same = w.ai > 0 && w.bj > 0 && a[w.ai - 1] === b[w.bj - 1];
        rowA = chars(a).map(function (c, k) { return { id: 'a' + (k + 1), value: c, state: k + 1 === w.ai ? (same ? 'found' : 'active') : k + 1 < w.ai ? 'visited' : 'default' }; });
        rowB = chars(b).map(function (c, k) { return { id: 't' + (k + 1), value: c, state: k + 1 === w.bj ? (same ? 'found' : 'active') : k + 1 < w.bj ? 'visited' : 'default' }; });
        if (w.ai > 0) ptrs.push({ name: 'i', row: 'A', index: w.ai - 1, state: same ? 'found' : 'active', side: 'above' });
        if (w.bj > 0) ptrs.push({ name: 'j', row: 'B', index: w.bj - 1, state: same ? 'found' : 'active', side: 'below' });
      } else {
        rowA = w.cur.map(function (t) { return { id: t.id, value: t.ch, state: t.state }; });
        var announcing = st.kind === 'edit-announce' && w.op !== 'del';
        rowB = chars(b).map(function (c, k) { return { id: 't' + (k + 1), value: c, state: k < w.done ? 'done' : (k === w.done && announcing ? 'active' : 'default') }; });
        if (!w.finished) ptrs.push({ name: 'next', row: 'A', index: w.next, state: 'active', side: 'above' });
      }
      return { rows: [{ id: 'A', label: 'A → ', items: rowA }, { id: 'B', label: 'B', items: rowB }], pointers: ptrs };
    }
    return {
      el: view.el,
      prepare: function (steps) { view.reset(); view.prepare(steps.map(toState)); },
      render: function (st, ctx) { view.render(toState(st), { duration: ctx.duration }); }
    };
  }
  D.wordView = wordViewFactory;

  D.labs.edit = function () {
    var fig = D.$('#lab-edit');
    var current = ['kitten', 'sitting'];
    var lab = makeLab({
      fig: fig, title: 'editDistance', label: 'Edit distance lab controls', tableLabel: 'Edit distance table', code: D.CODE.edit, stepMs: 950,
      hint: 'Each cell weighs its three edits here.',
      hintFor: function (st) { return st.kind === 'base' ? 'Each cell weighs its three edits here.' : st.kind === 'trace' || st.kind === 'answer' ? 'Traceback: every arrow on the path stands for one edit.' : 'Replay: each arrow on the path is applied to the word above.'; },
      top: wordViewFactory,
      varStates: { i: 'active', j: 'active', 'a[i]': 'compare', 'b[j]': 'compare', 'dp[i][j]': 'active' },
      legend: [{ state: 'active', label: 'Cell / letters compared' }, { state: 'compare', label: 'Cells it reads' }, { state: 'key', shape: 'line', label: 'Winning arrow' }, { state: 'visited', label: 'Filled' }, { state: 'path', label: 'Path = the edit script' }, { state: 'pivot', label: 'Replaced' }, { state: 'error', label: 'Deleted' }],
      counterLabels: { cells: 'Cells filled', edits: 'Edits made' }, counterStates: { edits: 'pivot' }, cellSize: 44
    });
    var player = lab.player;
    function load() { lab.load(A.editLab(current[0], current[1])); }
    var NAMES = ['diag', 'up', 'left'];
    player.addCheckpoint(function (steps) {
      var any = -1;
      for (var i = 1; i < steps.length; i++) {
        var p = steps[i - 1].predict;
        if (steps[i].kind !== 'write' || !p) continue;
        if (any < 0) any = i;
        if (p.choice !== 'diag' && p.i >= 2 && p.j >= 2) return i;
      }
      return any;
    }, function (c) {
      var p = c.prev.predict, a = current[0], b = current[1];
      var LBL = { diag: p.same ? '↖ keep ' + a[p.i - 1] + ' (free)' : '↖ replace ' + a[p.i - 1] + ' by ' + b[p.j - 1], up: '↑ delete ' + a[p.i - 1], left: '← insert ' + b[p.j - 1] };
      var costs = { diag: p.vD, up: p.vU, left: p.vL };
      var order = rotate(NAMES, p.i + p.j);
      return {
        question: 'Which arrow wins at <code>dp[' + p.i + '][' + p.j + ']</code> (A has <b>' + a[p.i - 1] + '</b> here, B has <b>' + b[p.j - 1] + '</b>)? The three candidates cost ' + p.vD + ' (↖), ' + p.vU + ' (↑) and ' + p.vL + ' (←).',
        options: order.map(function (n) { return LBL[n]; }), answer: order.indexOf(p.choice),
        explain: order.map(function (n) {
          if (n === p.choice) return 'Right: ' + LBL[n].slice(2) + ' costs ' + costs[n] + ', the smallest' + (costs[n] === Math.min(p.vD, p.vU, p.vL) && [p.vD, p.vU, p.vL].filter(function (x) { return x === costs[n]; }).length > 1 ? ' (tied: diagonal beats up beats left)' : '') + '.';
          return LBL[n].slice(2) + ' would cost ' + costs[n] + ', ' + (costs[n] > p.value ? 'more than the winner (' + p.value + ')' : 'the same as the winner, but ties go to diagonal first, then up') + '.';
        })
      };
    }, { id: 'lab-edit-arrow' });
    var rng = seedRandom();
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Two words, comma-separated (up to ' + A.LIMITS.edit + ' characters each)', value: current, parse: A.parse.editWords, placeholder: 'e.g. kitten, sitting', applyLabel: 'Apply',
      hint: 'A becomes B. Upper and lower case count as different letters.',
      presets: [
        { label: 'kitten · sitting', value: ['kitten', 'sitting'] },
        { label: 'flaw · lawn', value: ['flaw', 'lawn'] },
        { label: 'sunday · saturday', value: ['sunday', 'saturday'] },
        { label: 'cat · cut', value: ['cat', 'cut'] },
        { label: 'Same word', value: ['wolf', 'wolf'] },
        { label: 'Nothing in common', value: ['abc', 'xyz'] },
        { label: 'Random', value: function () { return [randWord(rng, rng.int(4, 6), 'abcd'), randWord(rng, rng.int(4, 6), 'abcd')]; } }
      ],
      onApply: function (vals) { current = vals; load(); }
    });
    load();
    return lab;
  };

  /* ================================================================== 0/1 knapsack lab */
  D.labs.knap = function () {
    var fig = D.$('#lab-knap');
    var state = { items: [{ w: 1, v: 1 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 7 }], W: 7 };
    var lab = makeLab({
      fig: fig, title: 'knapsack', label: 'Knapsack lab controls', tableLabel: 'Knapsack table', code: D.CODE.knap, stepMs: 900,
      hint: 'Each cell weighs its two choices here: skip the item, or take it.',
      hintFor: function (st) { return st.kind === 'base' ? 'Each cell weighs its two choices here: skip the item, or take it.' : 'Traceback: a value that differs from the cell above means the item was taken.'; },
      top: function (host) { var v = D.knapStage(host, { label: 'The items and the bag' }); return { render: function (st, ctx) { v.render(st.stage, ctx); } }; },
      varStates: { i: 'active', w: 'active', skip: 'compare', take: 'compare', 'dp[i][w]': 'active' },
      legend: [{ state: 'active', label: 'Cell / item being decided' }, { state: 'compare', label: 'Cells it reads' }, { state: 'key', shape: 'line', label: 'Winning choice' }, { state: 'visited', label: 'Filled' }, { state: 'path', label: 'Traceback / item in the bag' }, { state: 'muted', label: 'Item left out' }],
      counterLabels: { cells: 'Cells filled', reads: 'Cells read' }, counterStates: { reads: 'compare' }, cellSize: 42, codeHeight: 380
    });
    var player = lab.player;
    function load() { lab.load(A.knapLab(state.items, state.W)); }
    player.addCheckpoint(function (steps) {
      var want = state.items.length >= 3 ? 3 : state.items.length, first = -1, exact = -1;
      for (var i = 1; i < steps.length; i++) {
        if (steps[i].kind !== 'apply' || !steps[i - 1].predict) continue;
        if (first < 0) first = i;
        if (steps[i].decision.item === want) { exact = i; break; }
      }
      return exact >= 0 ? exact : first;
    }, function (c) {
      var p = c.prev.predict, it = state.items[p.i - 1];
      var opts = ['Yes: take it', 'No: leave it out'];
      var flip = p.i % 2 === 0;
      if (flip) opts.reverse();
      var yesIdx = opts.indexOf('Yes: take it');
      return {
        question: 'Walking back at capacity <b>' + p.w + '</b>: the cell in row #' + p.i + ' holds <b>' + p.here + '</b> and the cell right above it holds <b>' + p.above + '</b>. Does item #' + p.i + ' (weight ' + it.w + ', value ' + it.v + ') go in the bag?',
        options: opts, answer: p.take ? yesIdx : 1 - yesIdx,
        explain: opts.map(function (o) {
          var yes = o.indexOf('Yes') === 0;
          if (yes === p.take) return p.take ? 'Right: ' + p.here + ' ≠ ' + p.above + ', so having item #' + p.i + ' available improved this cell. Taking it must have caused that.' : 'Right: ' + p.here + ' = ' + p.above + ', so the optimum here was reachable without item #' + p.i + '. Leave it out.';
          return yes ? 'The two cells are equal (' + p.here + '), so item #' + p.i + ' added nothing at this capacity.' : 'The values differ (' + p.here + ' vs ' + p.above + '): item #' + p.i + ' is what made the difference.';
        })
      };
    }, { id: 'lab-knap-take' });
    // inputs: items text + capacity slider + presets that set both
    var inputHost = fig.querySelector('[data-input]');
    var rowEl = h('div', { class: 'dp2-knapin' }), itemsEl = h('div', { class: 'dp2-knapin__items' }), capEl = h('div', { class: 'dp2-knapin__cap' });
    rowEl.appendChild(itemsEl); rowEl.appendChild(capEl); inputHost.appendChild(rowEl);
    function itemsText(items) { return items.map(function (i) { return i.w + ':' + i.v; }); }
    var rng = seedRandom();
    var slider = null;
    var input = V.inputRow(itemsEl, {
      label: 'Items as weight:value (up to ' + A.LIMITS.items + ')', value: itemsText(state.items), parse: A.parse.items, placeholder: 'e.g. 3:4, 4:5, 2:3', applyLabel: 'Apply',
      hint: 'Weights 1 to ' + A.LIMITS.maxW + ', values 0 to ' + A.LIMITS.maxV + '.',
      onApply: function (items) { state.items = items; load(); }
    });
    slider = V.slider(capEl, { label: 'Bag capacity', min: 1, max: A.LIMITS.cap, value: state.W, onInput: function (v) { if (v !== state.W) { state.W = v; load(); } } });
    var presetRow = h('div', { class: 'input-row__presets dp2-knapin__presets', role: 'group', 'aria-label': 'Presets' });
    var PRESETS = [
      { label: 'Textbook', items: '1:1, 3:4, 4:5, 5:7', W: 7 },
      { label: 'Greedy trap', items: '1:6, 2:10, 3:12', W: 5 },
      { label: 'Everything fits', items: '1:2, 2:3, 3:4', W: 12 },
      { label: 'Nothing fits', items: '8:9, 9:9', W: 5 },
      { label: 'Ties', items: '2:5, 2:5, 2:5', W: 4 },
      { label: 'Random', random: true }
    ];
    PRESETS.forEach(function (p) {
      presetRow.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        var text = p.items, W = p.W;
        if (p.random) {
          var n = rng.int(3, 5), list = [];
          for (var i = 0; i < n; i++) list.push(rng.int(1, 6) + ':' + rng.int(1, 20));
          text = list.join(', '); W = rng.int(6, 12);
        }
        input.set(text, false);
        var r = A.parse.items(text);
        state.items = r.values; state.W = W; slider.set(W);
        load();
      } }, p.label));
    });
    inputHost.appendChild(presetRow);
    load();
    return lab;
  };
}());
