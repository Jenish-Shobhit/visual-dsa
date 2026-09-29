/* Lesson 35 · Dynamic programming II — the one-row trick, the cost chart, the "is it a 2D DP?" diagram,
   variations, checks and the summary card. Registered on VDSA.dp35.moreEager / moreLazy; booted by 35-dynamic-programming-2d.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos['35-dynamic-programming-2d'];
  var D = V.dp35, $ = D.$;
  D.moreEager = []; D.moreLazy = [];

  function fmtTime(ops) {
    var sec = ops / 1e8;
    if (sec < 0.001) return '< 1 ms';
    if (sec < 1) return Math.round(sec * 1000) + ' ms';
    if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' s';
    if (sec < 3600) return (sec / 60).toFixed(sec < 600 ? 1 : 0) + ' min';
    if (sec < 86400) return (sec / 3600).toFixed(1) + ' hours';
    return (sec / 86400).toFixed(1) + ' days';
  }

  /* ================================================================== one row: backwards vs forwards */
  function spaceFigure() {
    var fig = $('#fig-space');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Cell being written' }, { state: 'compare', label: 'Cell it reads' }, { state: 'error', label: 'Already rewritten / item reused' }, { state: 'visited', label: 'Written this pass' }, { state: 'muted', label: 'Row before this item' }]);
    var W = 7, w = 2, v = 3;
    var steps = A.oneRowSteps(w, v, W);
    function paneState(p) {
      var oldItems = p.old.map(function (x, k) { return { id: 'o' + k, value: x, state: 'muted' }; });
      var live = !!p.kind;
      var dp = p.dp.map(function (x, k) {
        var st = p.updated[k] ? 'visited' : 'default';
        if (live && k === p.src) st = (p.kind === 'read' && p.reason === 'stale') || (p.kind === 'write' && p.reason === 'reuse') ? 'error' : 'compare';
        if (live && k === p.a) st = p.kind === 'write' && p.reason === 'reuse' ? 'error' : 'active';
        var it = { id: 'd' + k, value: x, state: st };
        if (p.copies[k] > 0) { it.badge = '×' + p.copies[k]; it.badgeState = p.copies[k] > 1 ? 'error' : 'key'; }
        return it;
      });
      var ptrs = live ? [{ name: 'a', row: 'dp', index: p.a, state: 'active', side: 'below' }, { name: 'a−' + w, row: 'dp', index: p.src, state: 'compare', side: 'below' }] : [];
      return { rows: [{ id: 'old', label: 'before', items: oldItems }, { id: 'dp', label: 'dp', items: dp }], pointers: ptrs };
    }
    var left = V.views.array(fig.querySelector('[data-left]'), { mode: 'boxes', cellSize: 42, label: 'Backwards pass over the one-row table' });
    var right = V.views.array(fig.querySelector('[data-right]'), { mode: 'boxes', cellSize: 42, label: 'Forwards pass over the one-row table' });
    left.prepare(steps.map(function (x) { return paneState(x.left); }));
    right.prepare(steps.map(function (x) { return paneState(x.right); }));
    var player = V.player({
      root: fig, steps: steps, baseStepMs: 1350, label: 'One-row knapsack controls',
      render: function (st, ctx) { left.render(paneState(st.left), { duration: ctx.duration }); right.render(paneState(st.right), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]')
    });
    player.addCheckpoint(function (all) { return all.findIndex(function (x) { return x.kind === 'write' && x.wrote.copiesF === 2; }); }, function (c) {
      var wr = c.step.wrote, prevStep = c.prev;
      return {
        question: 'Going <b>forwards</b>, <code>dp[' + (wr.aF - w) + ']</code> was already rewritten to ' + prevStep.right.dp[wr.aF - w] + ' a moment ago. What lands in <code>dp[' + wr.aF + ']</code>?',
        options: ['3', '6', '9'], answer: 1,
        explain: [
          '3 is what a correct 0/1 table would write. But the forward pass reads dp[' + (wr.aF - w) + '], which already contains the item.',
          'Right: dp[' + wr.aF + '] = dp[' + (wr.aF - w) + '] + 3 = 3 + 3 = 6. That is the item counted twice, though you own one.',
          '9 comes two cells later. This cell reads dp[' + (wr.aF - w) + '] = 3 and adds 3.'
        ]
      };
    }, { id: 'space-forward-cell' });
    V.codeBlock($('[data-code-block="table"]'), '// 2D: dp[i][c] reads only the row above\nfor (let i = 1; i <= n; i++)\n  for (let c = 0; c <= W; c++)\n    dp[i][c] = Math.max(dp[i-1][c],\n      c >= w[i] ? dp[i-1][c - w[i]] + v[i] : 0);', 'js');
    V.codeBlock($('[data-code-block="row"]'), '// one row: go BACKWARDS so dp[c - w] is still the old row\nfor (let i = 1; i <= n; i++)\n  for (let c = W; c >= w[i]; c--)\n    dp[c] = Math.max(dp[c], dp[c - w[i]] + v[i]);', 'js');
  }

  /* ================================================================== cost chart */
  function costFigure() {
    var fig = $('#fig-cost');
    var legendEl = fig.querySelector('[data-legend]');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Operations against n: brute force against the table', labels: 'direct' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'n', brute: 'Brute force', dp: 'Table', time: 'Brute force takes' }, states: { brute: 'pivot', dp: 'done' } });
    var MAXN = 40, n = 20, W = 100, mode = 'knap';
    var nSlider, wSlider, wEl = fig.querySelector('[data-slider-w]');
    function brute(k) { return mode === 'knap' ? A.ops.knapBrute(k) : A.ops.lcsBrute(k); }
    function table(k) { return mode === 'knap' ? A.ops.knapDp(k, W) : A.ops.lcsDp(k); }
    function legend() {
      V.legend(legendEl, [{ state: 'pivot', shape: 'line', label: mode === 'knap' ? 'Brute force: 2ⁿ subsets' : 'Brute force: 2ⁿ subsequences' }, { state: 'done', shape: 'line', label: mode === 'knap' ? 'Table: n · W cells' : 'Table: n × n cells' }]);
    }
    function pts(fn) { var out = []; for (var k = 1; k <= MAXN; k++) out.push([k, fn(k)]); return out; }
    function render(dur) {
      var cross = mode === 'knap' ? A.ops.knapCross(W) : 0;
      var ann = [{ x: n, text: 'n = ' + n }];
      if (mode === 'knap' && cross > 1 && cross <= MAXN) ann.push({ x: cross, text: 'below n = ' + cross + ' brute force is cheaper', state: 'muted' });
      chart.render({
        x: { label: mode === 'knap' ? 'number of items n' : 'string length n', min: 1, max: MAXN },
        y: { label: 'operations (log scale)', scale: 'log', min: 1, max: 1e13 },
        series: [{ id: 'brute', label: '2ⁿ', points: pts(brute), state: 'pivot' }, { id: 'dp', label: mode === 'knap' ? 'n·W' : 'n²', points: pts(table), state: 'done' }],
        highlight: [{ series: 'brute', x: n, label: D.fmtNum(brute(n)) }, { series: 'dp', x: n, label: D.fmtNum(table(n)) }],
        annotations: ann
      }, { duration: dur });
      stats.update({ n: n, brute: D.fmtNum(brute(n)), dp: D.fmtNum(table(n)), time: fmtTime(brute(n)) });
    }
    V.segmented(fig.querySelector('[data-preset]'), { label: 'Problem', value: 'knap', options: [{ value: 'knap', label: 'Knapsack' }, { value: 'lcs', label: 'LCS of two strings' }],
      onChange: function (v) { mode = v; wEl.hidden = v !== 'knap'; legend(); render(700); } });
    nSlider = V.slider(fig.querySelector('[data-slider-n]'), { label: mode === 'knap' ? 'Items n' : 'n', min: 1, max: MAXN, value: n, onInput: function (v) { n = v; render(120); } });
    wSlider = V.slider(wEl, { label: 'Capacity W', min: 10, max: 1000, step: 10, value: W, onInput: function (v) { W = v; render(160); } });
    legend(); render(0);
  }

  /* ================================================================== "is it a 2D DP?" decision diagram */
  function chooseFigure() {
    var fig = $('#fig-choose');
    var spec = {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Two sequences to compare or align?', col: 0, row: 0 },
        { id: 'r1', type: 'end', text: 'Prefix table dp[i][j]: LCS, edit distance', col: 1, row: 0 },
        { id: 'q2', type: 'decision', text: 'Items to pick under a capacity?', col: 0, row: 1 },
        { id: 'r2', type: 'end', text: 'Item × capacity table: knapsack', col: 1, row: 1 },
        { id: 'q3', type: 'decision', text: 'Walking a grid, right or down?', col: 0, row: 2 },
        { id: 'r3', type: 'end', text: 'Cell table dp[r][c]: grid paths', col: 1, row: 2 },
        { id: 'q4', type: 'decision', text: 'Does a range i..j split into two ranges?', col: 0, row: 3 },
        { id: 'r4', type: 'end', text: 'Range table dp[i][j]: interval DP', col: 1, row: 3 },
        { id: 'r5', text: 'One index may be enough (lesson 34), or add a dimension', col: 0, row: 4 }
      ],
      edges: [
        { from: 'q1', to: 'r1', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
        { from: 'q2', to: 'r2', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
        { from: 'q3', to: 'r3', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
        { from: 'q4', to: 'r4', label: 'yes' }, { from: 'q4', to: 'r5', label: 'no' }
      ]
    };
    var CAP = {
      q1: 'Start here. Two strings, two lists, two sequences of anything? If the question is "how alike are they?", each cell can stand for a <em>pair of prefixes</em>.',
      r1: '<b>Prefix table.</b> dp[i][j] is about the first i items of one sequence and the first j of the other. Match, drop or edit the last item: three neighbours. Examples: LCS, edit distance, diff, DNA alignment.',
      q2: 'Not two sequences. Is it a choice of items, each with a cost (weight) and a reward (value), under a budget?',
      r2: '<b>Item × capacity table.</b> dp[i][c] = best value with the first i items and c units of room. Each cell asks: take item i or skip it. Examples: knapsack, subset sum, partition into equal halves.',
      q3: 'No budget either. Is the state simply a position in a grid, with moves in fixed directions?',
      r3: '<b>Cell table.</b> dp[r][c] is about arriving at (r, c). Examples: counting paths with obstacles, minimum-cost path, largest square of 1s.',
      q4: 'Still no. Does the answer for a stretch i..j come from splitting it in two stretches?',
      r4: '<b>Range table.</b> dp[i][j] covers a range and fills from short ranges to long ones. Examples: matrix-chain multiplication, palindrome cuts, burst balloons.',
      r5: 'One index (or a couple of variables) probably captures the state: think of lesson 34. If the future depends on something the state forgot, add it as a dimension.'
    };
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), spec, { interactive: true, label: 'Decision diagram: which kind of table does this problem need?' });
    var cap = fig.querySelector('[data-caption]'), path = ['q1'], taken = {};
    function show(active) {
      var st = {}; if (/^r\d$/.test(active)) st[active] = 'found';
      view.render({ active: active, visited: path.slice(0, -1), edgeStates: taken, states: st }, { duration: 500 });
      cap.innerHTML = CAP[active];
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(e.to); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show('q1'); });
    show('q1');
  }

  /* ================================================================== variations */
  function miniFig(host, caption) {
    var st = h('div', { class: 'mini__stage' });
    host.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: caption })));
    return st;
  }
  function variations() {
    V.tabs('#variants');
    var G = function (host, state, o) { return D.staticGrid(host, state, Object.assign({ cellSize: 34, minCell: 16 }, o || {})); };
    // 1. substring vs subsequence
    var a = 'AXBYC', b = 'ABXYC', tab = A.lcsTables(a, b).dp, sub = A.lcSubstring(a, b);
    var hd = { rowHeaders: ['∅'].concat(a.split('')), colHeaders: ['∅'].concat(b.split('')) };
    var host1 = $('[data-mini="substring"]');
    var lcsStates = {}; A.lcsTrace(a, b, A.lcsTables(a, b)).path.forEach(function (p) { lcsStates[p[0] + ',' + p[1]] = 'path'; });
    G(miniFig(host1, '<b>Subsequence</b> (letters may skip): a mismatch keeps the better neighbour. Longest: ' + tab[5][5] + ' (AXYC).'), D.miniState(tab, Object.assign({ states: lcsStates }, hd)));
    var subStates = {}; sub.dp.forEach(function (row, r) { row.forEach(function (v, c) { subStates[r + ',' + c] = v === 0 ? 'muted' : (r === sub.at[0] && c === sub.at[1] ? 'found' : 'compare'); }); });
    G(miniFig(host1, '<b>Substring</b> (letters must touch): a mismatch <b>resets to 0</b>, and the answer is the largest cell anywhere: ' + sub.best + ' (' + sub.string + ').'), D.miniState(sub.dp, Object.assign({ states: subStates }, hd)));
    V.codeBlock($('[data-code-block="substring"]'), 'dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : 0;   // reset\nbest = Math.max(best, dp[i][j]);                       // answer is anywhere', 'js');
    // 2. interval DP
    var host2 = $('[data-mini="interval"]');
    var n5 = 5, rowsI = [], stI = {}, txtI = {};
    for (var i = 0; i < n5; i++) { rowsI.push([]); for (var j = 0; j < n5; j++) { if (j < i) rowsI[i].push(null); else { rowsI[i].push(j - i + 1); stI[i + ',' + j] = i === 0 && j === 4 ? 'active' : 'visited'; } } }
    G(miniFig(host2, 'Cell (i, j) is the range i..j; the number is its <b>length</b>. Ranges of length 1 first, then 2, and so on: the table fills along <b>diagonals</b>, short to long.'), D.miniState(rowsI, { states: stI, rowHeaders: ['0', '1', '2', '3', '4'], colHeaders: ['0', '1', '2', '3', '4'] }));
    G(miniFig(host2, 'To fill (0, 4) try every split point k and combine the two smaller ranges: here k = 1 reads (0, 1) and (2, 4). Matrix-chain multiplication and palindrome partitioning work this way.'),
      D.miniState(rowsI, { states: Object.assign({}, stI, { '0,1': 'compare', '2,4': 'compare' }), arrows: [{ from: [0, 1], to: [0, 4], state: 'key' }, { from: [2, 4], to: [0, 4], state: 'key' }], rowHeaders: ['0', '1', '2', '3', '4'], colHeaders: ['0', '1', '2', '3', '4'] }));
    // 3. subset sum
    var host3 = $('[data-mini="subset"]');
    var ss = A.subsetSum([3, 4, 5], 9);
    var can = ss.can.map(function (r) { return r.map(function (x) { return x ? '✓' : '·'; }); });
    var ssStates = {}; ss.can.forEach(function (r, ri) { r.forEach(function (x, ci) { ssStates[ri + ',' + ci] = x ? 'visited' : 'muted'; }); }); ssStates['3,9'] = 'found';
    var ssNums = ['none', '3', '4', '5'];
    G(miniFig(host3, '<b>Subset sum</b>: can some items add up to exactly 9? Same table shape as knapsack, but each cell is a yes or a no: <code>can[i][t] = can[i−1][t] or can[i−1][t − x]</code>. Yes: 4 + 5.'),
      D.miniState(can, { states: ssStates, rowHeaders: ssNums, colHeaders: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(String) }), { cellSize: 30 });
    V.codeBlock($('[data-code-block="subset"]'), 'can[i][t] = can[i-1][t]                            // skip x\n          || (t >= x && can[i-1][t - x]);         // take x\n// partition into equal halves = subset sum with target total/2', 'js');
    // 4. two rows
    var host4 = $('[data-mini="rows"]');
    var a4 = 'AGGTAB', b4 = 'GXTXAYB', t4 = A.lcsTables(a4, b4).dp;
    var r3 = t4[3], r4 = t4[4];
    G(miniFig(host4, 'Row i reads only itself and row i − 1. Keep <b>two rows</b> and swap them after each row: <b>O(n)</b> space instead of O(m·n).'),
      D.miniState([r3, r4.map(function (x, k) { return k <= 4 ? x : null; })], { states: { '1,4': 'active', '0,3': 'compare', '0,4': 'compare', '1,3': 'compare' }, arrows: [{ from: [0, 3], to: [1, 4], state: 'key' }, { from: [0, 4], to: [1, 4], state: 'default' }, { from: [1, 3], to: [1, 4], state: 'default' }], rowHeaders: ['i − 1', 'i'], colHeaders: ['∅'].concat(b4.split('')) }), { cellSize: 40 });
    V.codeBlock($('[data-code-block="rows"]'), 'let prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0);\nfor (let i = 1; i <= m; i++) {\n  for (let j = 1; j <= n; j++)\n    cur[j] = a[i-1] === b[j-1] ? prev[j-1] + 1 : Math.max(prev[j], cur[j-1]);\n  [prev, cur] = [cur, prev];\n}\nreturn prev[n];   // the length only: rebuilding the string needs the table', 'js');
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-grid', {
      id: 'grid-3x3',
      question: 'A robot moves only right or down on a <b>3 × 3</b> grid of cells, from the top-left to the bottom-right, with no obstacles. How many routes are there?',
      options: ['9', '6', '8', '4'],
      answer: 1,
      explain: ['9 is the number of cells. Routes are counted by the recurrence, not the cells: 1 1 1 / 1 2 3 / 1 3 6.',
        'Fill the table: the first row and column are all 1, the middle cell is 1 + 1 = 2, the edge cells beside it are 3, and the corner is 3 + 3 = 6.',
        '8 is 2³, a guess. Every route makes exactly 2 right moves and 2 down moves; the count is the number of orders, 4 choose 2.',
        '4 is the number of moves in a route, not the number of routes.']
    });
    V.quiz('#quiz-order', {
      id: 'lcs-order-matters',
      question: 'What is the length of the longest common subsequence of <b>ABC</b> and <b>CBA</b>?',
      options: ['3', '0', '2', '1'],
      answer: 3,
      explain: ['Only if the letters could be reordered. A subsequence keeps the original order, and ABC reads the letters in the opposite order to CBA.',
        'The strings share letters, and a single shared letter is already a common subsequence of length 1.',
        'Two letters, say A then B, would need A before B in both strings. In CBA, B comes before A.',
        'Right: any one letter works, but two letters always appear in opposite orders in the two strings. Try it in the lab: the corner cell says 1.']
    });
    V.quiz('#quiz-arrow', {
      id: 'edit-arrow-left',
      question: 'In the edit distance table, the winning arrow into <code>dp[i][j]</code> points <b>left</b>, from <code>dp[i][j − 1]</code>. Which single edit does it stand for?',
      options: ['Delete a[i]', 'Replace a[i] by b[j]', 'Insert b[j]', 'Keep a[i]'],
      answer: 2,
      explain: ['Deleting a letter of A uses up a row: the arrow comes from the row above (↑), and the column stays the same.',
        'A replacement uses up one letter of each word: that is the diagonal arrow ↖.',
        'Right: moving one column right uses up a letter of B without using any letter of A, so B\'s letter b[j] was added: an insertion.',
        'Keeping a letter also uses one letter of each word: that is the diagonal too (with cost 0).']
    });
    V.quiz('#quiz-cells', {
      id: 'edit-cells-1000',
      question: 'You compare two texts of <b>1,000 characters</b> each with the edit distance table. Roughly how many cells does it fill?',
      options: ['2,000', 'about 1 million', 'about 10³⁰⁰', '1,000'],
      answer: 1,
      explain: ['2,000 would be the cost of reading both texts once. The table has a cell for every pair of positions, not every position.',
        'Right: (1,000 + 1) × (1,000 + 1) ≈ 10⁶ cells, each computed in constant time. Quadratic, but a fraction of a second.',
        'That is the size of the space of all edit scripts, the number brute force would face. The table collapses it by sharing subproblems.',
        '1,000 cells would be one row. Every letter of A gets a whole row of cells.']
    });
    V.quiz('#quiz-dir', {
      id: 'one-row-direction',
      question: 'You keep one row for knapsack and update it with capacity looping <b>upwards</b> (c = w … W). Every item is available once. What does the table end up holding?',
      options: ['The 0/1 knapsack answer', 'Values that can count an item more than once', 'Only zeros', 'The same as looping downwards'],
      answer: 1,
      explain: ['That needs each read to see the row before the item. Upward loops read cells that were already rewritten for this item.',
        'Right: dp[c − w] may already include the item, so the item can be used again and again: the unbounded knapsack. Loop downwards for 0/1.',
        'Cells do fill with real values: the loop is legal, it just answers a different question.',
        'The two orders agree only when no cell is read after being rewritten, which is exactly what the downward loop guarantees and the upward loop breaks.']
    });
  }

  /* ================================================================== summary */
  function summaryCard() {
    var grid = $('#summary-card .summary__grid');
    function tile(label, text) {
      var viz = h('div', { class: 'summary__viz stage-grid' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text', html: text })));
      return viz;
    }
    var o = { cellSize: 34, minCell: 12, label: 'Mini table' };
    var G = function (host, st, extra) { return D.staticGrid(host, st, Object.assign({}, o, extra || {})); };
    G(tile('Two indexes', 'One cell per pair (i, j); each reads its neighbours up, left and diagonal.'),
      D.miniState([[1, 1, 1], [1, 2, null], [1, null, null]], { states: { '1,1': 'compare', '0,1': 'compare', '1,0': 'compare', '0,0': 'compare' }, arrows: [{ from: [0, 0], to: [1, 1], state: 'key' }, { from: [0, 1], to: [1, 1], state: 'key' }, { from: [1, 0], to: [1, 1], state: 'key' }] }));
    G(tile('LCS: match or drop', 'Equal letters: diagonal + 1. Otherwise the better of up and left.'),
      D.miniState([[2, 2], [2, null]], { states: { '0,0': 'compare', '0,1': 'muted', '1,0': 'muted', '1,1': 'active' }, arrows: [{ from: [0, 0], to: [1, 1], state: 'key' }], text: { '1,1': '3' } }));
    G(tile('Edit: three arrows', '↖ replace or keep, ↑ delete, ← insert. Take the cheapest.'),
      D.miniState([[1, 2], [2, null]], { states: { '0,0': 'compare', '0,1': 'compare', '1,0': 'compare', '1,1': 'active' }, arrows: [{ from: [0, 0], to: [1, 1], state: 'key' }, { from: [0, 1], to: [1, 1], state: 'default' }, { from: [1, 0], to: [1, 1], state: 'default' }], text: { '1,1': '2' } }));
    G(tile('Knapsack: take or skip', 'Skip: copy the cell above. Take: jump back by the weight, add the value.'),
      D.miniState([[0, 0, 3, 3], [0, 0, 3, 4]], { states: { '0,3': 'compare', '0,1': 'compare', '1,3': 'active' }, arrows: [{ from: [0, 3], to: [1, 3], state: 'default' }, { from: [0, 1], to: [1, 3], state: 'key' }] }));
    G(tile('Trace back', 'Follow the winning arrows from the corner to read off the answer itself.'),
      D.miniState([[0, 0, 0, 0], [0, 1, 1, 1], [0, 1, 2, 2]], { states: { '2,3': 'path', '2,2': 'path', '1,1': 'path', '0,0': 'path' }, arrows: [{ from: [2, 2], to: [2, 3], state: 'path' }, { from: [1, 1], to: [2, 2], state: 'path' }, { from: [0, 0], to: [1, 1], state: 'path' }] }));
    G(tile('One row: go backwards', 'If a cell reads only the row above, a single row updated right to left is enough.'),
      D.miniState([[0, 0, 3, 3, 3, 3]], { states: { '0,5': 'active', '0,3': 'compare' }, arrows: [{ from: [0, 3], to: [0, 5], state: 'key' }] }), { cellSize: 30 });
  }

  D.moreEager.push(chooseFigure, variations, checks, summaryCard);
  D.moreLazy.push(['#fig-space', spaceFigure], ['#fig-cost', costFigure]);
}());
