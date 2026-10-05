/* Lesson 35 · Dynamic programming II — pure step generators (no DOM).

   Loaded in the browser as a classic script (registers VDSA.algos['35-dynamic-programming-2d']) and in Node via
   require() for tests/algos/35-dynamic-programming-2d.test.js.

   Contents
   - reference:  lcsLength, lcsString, editDistance, knapsack01, knapsackBrute, gridPaths (plain implementations)
   - tables:     lcsTables, editTables, knapTables (values + stored choices)
   - labs:       lcsLab(a, b)            LCS table with arrows, traceback and the resulting subsequence
                 editLab(a, b)           edit distance table, traceback, then the word morphing into the other
                 knapLab(items, W)       0/1 knapsack table (take vs skip), traceback, items flying into a bag
   - figures:    shareSteps(a, b)        common subsequences of two strings (the problem)
                 gridSteps(r, c, walls)  grid paths: counts flow right and down around obstacles
                 orderSteps(n, order)    four fill orders of one table (row, column, diagonal, a broken one)
                 oneRowSteps(w, v, W)    the one-row knapsack trick: capacity backwards vs forwards, in lock step
                 lcsTeaser(a, b)         anti-diagonal wavefront + traceback for the hero
   - numbers:    ops.knapBrute/knapDp/lcsBrute/lcsDp for the cost chart
   - parse:      friendly validation for the lab inputs

   Every step is a complete snapshot (never mutated after it is pushed). Table steps carry
   {table: grid state, caption, line, vars, counters, flow, kind, ...}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) { root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos['35-dynamic-programming-2d'] = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { lcs: 9, edit: 8, items: 5, cap: 12, maxW: 9, maxV: 99, gridRows: 6, gridCols: 7 };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ch(c) { return '<b>' + esc(c) + '</b>'; }
  function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function chars(s) { return String(s).split(''); }
  function matrix(r, c, v) { var m = []; for (var i = 0; i < r; i++) { m.push([]); for (var j = 0; j < c; j++) m[i].push(v); } return m; }

  /* ================================================================== reference implementations */
  function lcsLength(a, b) {
    var m = a.length, n = b.length, dp = matrix(m + 1, n + 1, 0);
    for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    return dp[m][n];
  }
  /* One longest common subsequence, by the same tie rule the lab uses (up before left). */
  function lcsString(a, b) { var t = lcsTables(a, b); return lcsTrace(a, b, t).string; }
  function editDistance(a, b) {
    var m = a.length, n = b.length, dp = matrix(m + 1, n + 1, 0);
    for (var i = 0; i <= m; i++) dp[i][0] = i;
    for (var j = 0; j <= n; j++) dp[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    return dp[m][n];
  }
  /* items: [{w, v}] */
  function knapsack01(items, W) {
    var dp = [];
    for (var c = 0; c <= W; c++) dp.push(0);
    items.forEach(function (it) { for (var k = W; k >= it.w; k--) dp[k] = Math.max(dp[k], dp[k - it.w] + it.v); });
    return dp[W];
  }
  /* Best value over every subset (2^n) - the brute-force reference. */
  function knapsackBrute(items, W) {
    var best = 0, n = items.length;
    for (var mask = 0; mask < (1 << n); mask++) {
      var w = 0, v = 0;
      for (var i = 0; i < n; i++) if (mask & (1 << i)) { w += items[i].w; v += items[i].v; }
      if (w <= W && v > best) best = v;
    }
    return best;
  }
  /* Number of monotone (right/down) paths from the top-left to the bottom-right avoiding walls ([[r,c]]). */
  function gridPaths(rows, cols, walls) {
    var wall = {};
    (walls || []).forEach(function (w) { wall[w[0] + ',' + w[1]] = true; });
    var dp = matrix(rows, cols, 0);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (wall[r + ',' + c]) { dp[r][c] = 0; continue; }
      if (r === 0 && c === 0) { dp[r][c] = 1; continue; }
      dp[r][c] = (r > 0 ? dp[r - 1][c] : 0) + (c > 0 ? dp[r][c - 1] : 0);
    }
    return rows && cols ? dp[rows - 1][cols - 1] : 0;
  }

  /* ================================================================== tables with stored choices */
  function lcsTables(a, b) {
    var m = a.length, n = b.length, dp = matrix(m + 1, n + 1, 0), choice = matrix(m + 1, n + 1, null);
    for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; choice[i][j] = 'diag'; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { dp[i][j] = dp[i - 1][j]; choice[i][j] = 'up'; }
      else { dp[i][j] = dp[i][j - 1]; choice[i][j] = 'left'; }
    }
    return { dp: dp, choice: choice, m: m, n: n };
  }
  /* Walk the choices from (m, n). path = every cell visited; links = matched pairs [i, j] (1-based) in walk order. */
  function lcsTrace(a, b, t) {
    var i = t.m, j = t.n, path = [[i, j]], links = [], picked = [];
    while (i > 0 && j > 0) {
      var c = t.choice[i][j];
      if (c === 'diag') { links.push([i, j]); picked.push(a[i - 1]); i--; j--; }
      else if (c === 'up') i--;
      else j--;
      path.push([i, j]);
    }
    return { path: path, links: links, string: picked.reverse().join('') };
  }
  /* choice: 'diag' (keep or replace), 'up' (delete a[i]), 'left' (insert b[j]); ties prefer diag, then up, then left. */
  function editTables(a, b) {
    var m = a.length, n = b.length, dp = matrix(m + 1, n + 1, 0), choice = matrix(m + 1, n + 1, null);
    for (var i = 1; i <= m; i++) { dp[i][0] = i; choice[i][0] = 'up'; }
    for (var j = 1; j <= n; j++) { dp[0][j] = j; choice[0][j] = 'left'; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var d = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), u = dp[i - 1][j] + 1, l = dp[i][j - 1] + 1;
      var best = Math.min(d, u, l);
      dp[i][j] = best;
      choice[i][j] = best === d ? 'diag' : best === u ? 'up' : 'left';
    }
    return { dp: dp, choice: choice, m: m, n: n };
  }
  /* Forward edit script: [{type: 'keep'|'sub'|'del'|'ins', ai, bj, from, to, cell: [i, j] (cell after the edit's arrow)}] */
  function editScript(a, b, t) {
    var i = t.m, j = t.n, path = [[i, j]], back = [];
    while (i > 0 || j > 0) {
      var c = t.choice[i][j], op;
      if (c === 'diag') { op = { type: a[i - 1] === b[j - 1] ? 'keep' : 'sub', ai: i, bj: j, from: a[i - 1], to: b[j - 1] }; i--; j--; }
      else if (c === 'up') { op = { type: 'del', ai: i, bj: j, from: a[i - 1], to: null }; i--; }
      else { op = { type: 'ins', ai: i, bj: j, from: null, to: b[j - 1] }; j--; }
      back.push({ op: op, to: [i, j], at: path[path.length - 1] });
      path.push([i, j]);
    }
    return { ops: back.map(function (x) { return x.op; }).reverse(), moves: back, path: path };
  }
  function knapTables(items, W) {
    var n = items.length, dp = matrix(n + 1, W + 1, 0), take = matrix(n + 1, W + 1, false);
    for (var i = 1; i <= n; i++) for (var c = 1; c <= W; c++) {
      var skip = dp[i - 1][c], it = items[i - 1];
      var t = it.w <= c ? dp[i - 1][c - it.w] + it.v : -1;
      if (t > skip) { dp[i][c] = t; take[i][c] = true; } else dp[i][c] = skip;
    }
    return { dp: dp, take: take, n: n, W: W };
  }
  /* Walk back from (n, W): the item numbers (1-based) in the bag, in the order the walk meets them. */
  function knapTrace(items, t) {
    var i = t.n, c = t.W, picked = [];
    while (i >= 1) {
      if (t.dp[i][c] !== t.dp[i - 1][c]) { picked.push(i); c -= items[i - 1].w; }
      i--;
    }
    return picked;
  }

  /* ================================================================== the table snapshot builder */
  /* A board holds values (null = not filled yet) and the resting state of filled cells; snap() makes a fresh grid state. */
  function makeBoard(rows, cols, o) {
    o = o || {};
    var v = matrix(rows, cols, null), st = matrix(rows, cols, 'visited'), txt = matrix(rows, cols, undefined);
    return {
      rows: rows, cols: cols, v: v, st: st,
      set: function (r, c, val, state, text) { v[r][c] = val; st[r][c] = state || 'visited'; txt[r][c] = text; },
      rest: function (r, c, state) { st[r][c] = state; },
      snap: function (over) {
        over = over || {};
        var cells = [];
        for (var r = 0; r < rows; r++) {
          var row = [];
          for (var c = 0; c < cols; c++) {
            var k = r + ',' + c, s = over.cells && over.cells[k];
            if (v[r][c] === null) row.push(s ? { state: s } : null);
            else row.push({ value: v[r][c], state: s || st[r][c], text: txt[r][c] });
          }
          cells.push(row);
        }
        var out = { rows: rows, cols: cols, cells: cells, rowHeaders: o.rowHeaders || null, colHeaders: o.colHeaders || null,
          cursor: over.cursor || null, arrows: over.arrows || [] };
        if (over.hr !== undefined && over.hr !== null) out.highlightRow = over.hr;
        if (over.hc !== undefined && over.hc !== null) out.highlightCol = over.hc;
        if (o.walls) out.walls = o.walls;
        return out;
      }
    };
  }
  function arrow(from, to, state, label) { var a = { from: from, to: to, state: state || 'default' }; if (label !== undefined && label !== null) a.label = label; return a; }
  function cellKey(r, c) { return r + ',' + c; }
  function statesMap(list, state, into) { into = into || {}; list.forEach(function (p) { into[cellKey(p[0], p[1])] = state; }); return into; }

  /* ================================================================== LCS lab */
  function lcsLab(a, b, opts) {
    opts = opts || {};
    var m = a.length, n = b.length, t = lcsTables(a, b), dp = t.dp, tr = lcsTrace(a, b, t);
    var board = makeBoard(m + 1, n + 1, { rowHeaders: ['∅'].concat(chars(a)), colHeaders: ['∅'].concat(chars(b)) });
    var S = [], filled = 0, matches = 0;
    function strip(i, j, extra) { return Object.assign({ a: a, b: b, i: i, j: j, links: [], result: '', L: null, bad: false }, extra || {}); }
    function push(o) {
      o.counters = { cells: filled, matches: matches };
      S.push(o);
    }
    // base row and column
    for (var i = 0; i <= m; i++) { board.set(i, 0, 0); filled++; }
    for (var j = 1; j <= n; j++) { board.set(0, j, 0); filled++; }
    push({ kind: 'base', table: board.snap(), strip: strip(0, 0), cands: null, line: 'base', flow: 'base',
      caption: 'Row 0 and column 0 compare a string with the <b>empty string</b> ∅. Two strings can share nothing when one is empty, so every cell there is <b>0</b>.',
      vars: { i: null, j: null, 'a[i]': null, 'b[j]': null, 'dp[i][j]': null, result: '' } });
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var same = a[i - 1] === b[j - 1], d = dp[i - 1][j - 1], u = dp[i - 1][j], l = dp[i][j - 1];
      var srcs = same ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      var cellsOver = statesMap(srcs, 'compare'); cellsOver[cellKey(i, j)] = 'active';
      var arrows = same ? [arrow([i - 1, j - 1], [i, j], 'compare')] : [arrow([i - 1, j], [i, j], 'compare'), arrow([i, j - 1], [i, j], 'compare')];
      var vars = { i: i, j: j, 'a[i]': a[i - 1], 'b[j]': b[j - 1], 'dp[i][j]': null, result: '' };
      var cands = same
        ? [{ tag: 'diag', title: '↖ letters match', expr: 'dp[' + (i - 1) + '][' + (j - 1) + '] + 1 = ' + d + ' + 1', val: d + 1 },
           { tag: 'up', title: '↑ skip a[i]', expr: 'not needed', off: true }, { tag: 'left', title: '← skip b[j]', expr: 'not needed', off: true }]
        : [{ tag: 'diag', title: '↖ letters differ', expr: 'cannot use both', off: true },
           { tag: 'up', title: '↑ skip a[i]', expr: 'dp[' + (i - 1) + '][' + j + '] = ' + u, val: u },
           { tag: 'left', title: '← skip b[j]', expr: 'dp[' + i + '][' + (j - 1) + '] = ' + l, val: l }];
      push({ kind: 'look', table: board.snap({ cursor: [i, j], hr: i, hc: j, cells: cellsOver, arrows: arrows }), strip: strip(i, j), cands: cands,
        line: 'cmp', flow: 'eq', vars: vars,
        predict: { i: i, j: j, same: same, diag: d, up: u, left: l, value: dp[i][j] },
        caption: same
          ? 'Compare the last letters: ' + ch(a[i - 1]) + ' = ' + ch(b[j - 1]) + '. They match, so ' + ch(a[i - 1]) + ' can extend the best answer for the two shorter prefixes, found diagonally up-left (' + d + ').'
          : 'Compare the last letters: ' + ch(a[i - 1]) + ' ≠ ' + ch(b[j - 1]) + '. They cannot both end the subsequence, so drop one of them: the answer is the better of the cell above (' + u + ') and the cell to the left (' + l + ').' });
      var choice = t.choice[i][j];
      board.set(i, j, dp[i][j], 'visited'); filled++; if (same) matches++;
      var srcCell = choice === 'diag' ? [i - 1, j - 1] : choice === 'up' ? [i - 1, j] : [i, j - 1];
      var done2 = statesMap([srcCell], 'compare');
      var cands2 = cands.map(function (c) { return Object.assign({}, c, { win: c.tag === choice }); });
      push({ kind: 'write', table: board.snap({ cursor: [i, j], hr: i, hc: j, cells: Object.assign(done2, statesMap([[i, j]], 'active')), arrows: [arrow(srcCell, [i, j], 'key')] }),
        strip: strip(i, j), cands: cands2, line: same ? 'match' : 'skip', flow: same ? 'diag' : 'max',
        vars: Object.assign({}, vars, { 'dp[i][j]': dp[i][j] }),
        caption: same
          ? 'Write ' + d + ' + 1 = <b>' + dp[i][j] + '</b>. The arrow points back along the diagonal: this cell used the match.'
          : 'Write max(' + u + ', ' + l + ') = <b>' + dp[i][j] + '</b>. The arrow points to the bigger neighbour' + (u === l ? ' (a tie: we keep the one above)' : '') + ', so the traceback will know which letter to drop.' });
    }
    board.rest(m, n, 'found');
    var L = dp[m][n];
    push({ kind: 'answer', table: board.snap({ cursor: [m, n], cells: statesMap([[m, n]], 'found') }), strip: strip(m, n, { L: L }), cands: null,
      line: 'trace', flow: 'trace', vars: { i: m, j: n, 'a[i]': null, 'b[j]': null, 'dp[i][j]': L, result: '' },
      caption: 'The table is full. The corner cell holds the answer: the longest common subsequence has length <b>' + L + '</b>. The arrows tell us which letters form it.' });
    // traceback
    var pathCells = {}, pathArrows = [], links = [], picked = '';
    pathCells[cellKey(m, n)] = 'path';
    var walk = tr.path;
    for (var k = 1; k < walk.length; k++) {
      var from = walk[k - 1], to = walk[k], c0 = t.choice[from[0]][from[1]];
      var isMatch = c0 === 'diag';
      pathArrows.push(arrow(from, to, 'path'));
      pathCells[cellKey(to[0], to[1])] = 'path';
      if (isMatch) { links.push([from[0], from[1]]); picked = a[from[0] - 1] + picked; }
      push({ kind: 'trace', table: board.snap({ cursor: to, cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }),
        strip: strip(isMatch ? from[0] : 0, isMatch ? from[1] : 0, { links: links.slice(), result: picked, L: L, trace: true }), cands: null,
        line: isMatch ? 'pick' : c0 === 'up' ? 'up' : 'left', flow: 'trace',
        vars: { i: to[0], j: to[1], 'a[i]': from[0] > 0 ? a[from[0] - 1] : null, 'b[j]': from[1] > 0 ? b[from[1] - 1] : null, 'dp[i][j]': dp[to[0]][to[1]], result: picked },
        move: { at: from, to: to, choice: c0 },
        caption: isMatch
          ? 'At dp[' + from[0] + '][' + from[1] + '] the arrow goes diagonally: the letters ' + ch(a[from[0] - 1]) + ' match here, so ' + ch(a[from[0] - 1]) + ' is <b>in</b> the subsequence. Step to the diagonal cell.'
          : 'At dp[' + from[0] + '][' + from[1] + '] the arrow goes ' + (c0 === 'up' ? '<b>up</b>: drop ' + ch(a[from[0] - 1]) + ' from A' : '<b>left</b>: drop ' + ch(b[from[1] - 1]) + ' from B') + '. No letter is added.',
        counters: null });
      S[S.length - 1].counters = { cells: filled, matches: matches };
    }
    push({ kind: 'done', table: board.snap({ cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }),
      strip: strip(0, 0, { links: links.slice(), result: picked, L: L, trace: true }), cands: null, line: 'ret', flow: 'trace',
      vars: { i: walk[walk.length - 1][0], j: walk[walk.length - 1][1], 'a[i]': null, 'b[j]': null, 'dp[i][j]': L, result: picked },
      caption: L === 0 ? 'The walk reached the edge without meeting a match: the two strings share <b>no</b> letters, so the longest common subsequence is empty.'
        : 'Reached the edge. Reading the matched letters left to right gives <b>' + esc(picked) + '</b>, a longest common subsequence of length ' + L + '.' });
    return S;
  }

  /* ================================================================== edit distance lab */
  function editLab(a, b) {
    var m = a.length, n = b.length, t = editTables(a, b), dp = t.dp;
    var board = makeBoard(m + 1, n + 1, { rowHeaders: ['∅'].concat(chars(a)), colHeaders: ['∅'].concat(chars(b)) });
    var S = [], filled = 0;
    var script = editScript(a, b, t);
    function words(o) { return Object.assign({ a: a, b: b, ai: 0, bj: 0, cur: chars(a).map(function (c, i) { return { id: 'a' + (i + 1), ch: c, state: 'default' }; }), done: 0, mode: 'fill' }, o || {}); }
    function push(o) { o.counters = { cells: filled, edits: o.edits !== undefined ? o.edits : 0 }; delete o.edits; S.push(o); }
    var OPNAME = { keep: 'keep', sub: 'replace', del: 'delete', ins: 'insert' };
    for (var i = 0; i <= m; i++) { board.set(i, 0, i); filled++; }
    for (var j = 1; j <= n; j++) { board.set(0, j, j); filled++; }
    push({ kind: 'base', table: board.snap(), word: words(), cands: null, line: 'base',
      vars: { i: null, j: null, 'a[i]': null, 'b[j]': null, 'dp[i][j]': null },
      caption: 'Column 0: turning the first <i>i</i> letters of A into nothing costs <b>i deletions</b>. Row 0: building the first <i>j</i> letters of B from nothing costs <b>j insertions</b>. Both are forced, so they are the base cases.' });
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var same = a[i - 1] === b[j - 1];
      var dg = dp[i - 1][j - 1], up = dp[i - 1][j], lf = dp[i][j - 1];
      var vD = dg + (same ? 0 : 1), vU = up + 1, vL = lf + 1;
      var over = statesMap([[i - 1, j - 1], [i - 1, j], [i, j - 1]], 'compare'); over[cellKey(i, j)] = 'active';
      var arrows = [arrow([i - 1, j - 1], [i, j], 'compare'), arrow([i - 1, j], [i, j], 'compare'), arrow([i, j - 1], [i, j], 'compare')];
      var vars = { i: i, j: j, 'a[i]': a[i - 1], 'b[j]': b[j - 1], 'dp[i][j]': null };
      var cands = [
        { tag: 'diag', title: same ? '↖ keep (letters equal)' : '↖ replace ' + a[i - 1] + ' by ' + b[j - 1], expr: 'dp[' + (i - 1) + '][' + (j - 1) + '] + ' + (same ? 0 : 1) + ' = ' + dg + ' + ' + (same ? 0 : 1), val: vD },
        { tag: 'up', title: '↑ delete ' + a[i - 1], expr: 'dp[' + (i - 1) + '][' + j + '] + 1 = ' + up + ' + 1', val: vU },
        { tag: 'left', title: '← insert ' + b[j - 1], expr: 'dp[' + i + '][' + (j - 1) + '] + 1 = ' + lf + ' + 1', val: vL }];
      push({ kind: 'look', table: board.snap({ cursor: [i, j], hr: i, hc: j, cells: over, arrows: arrows }), word: words({ ai: i, bj: j }), cands: cands,
        line: ['diag', 'del', 'ins'], vars: vars,
        predict: { i: i, j: j, same: same, vD: vD, vU: vU, vL: vL, value: dp[i][j], choice: t.choice[i][j] },
        caption: 'Three ways to end up with the first ' + j + (j === 1 ? ' letter' : ' letters') + ' of B from the first ' + i + ' of A: <b>↖</b> ' + (same ? 'keep ' + ch(a[i - 1]) + ' (letters equal, free)' : 'replace ' + ch(a[i - 1]) + ' by ' + ch(b[j - 1])) + ' costs ' + vD + '; <b>↑</b> delete ' + ch(a[i - 1]) + ' costs ' + vU + '; <b>←</b> insert ' + ch(b[j - 1]) + ' costs ' + vL + '.' });
      var choice = t.choice[i][j], best = dp[i][j] = Math.min(vD, vU, vL);
      board.set(i, j, best);
      filled++;
      var src = choice === 'diag' ? [i - 1, j - 1] : choice === 'up' ? [i - 1, j] : [i, j - 1];
      var what = choice === 'diag' ? (same ? 'keep' : 'replace') : choice === 'up' ? 'delete' : 'insert';
      push({ kind: 'write', table: board.snap({ cursor: [i, j], hr: i, hc: j, cells: Object.assign(statesMap([src], 'compare'), statesMap([[i, j]], 'active')), arrows: [arrow(src, [i, j], 'key')] }),
        word: words({ ai: i, bj: j }), cands: cands.map(function (c) { return Object.assign({}, c, { win: c.tag === choice }); }),
        line: choice === 'diag' ? 'diag' : choice === 'up' ? 'del' : 'ins', vars: Object.assign({}, vars, { 'dp[i][j]': best }),
        caption: 'The cheapest is <b>' + best + '</b>, by the <b>' + what + '</b> arrow' + ((vD === best) + (vU === best) + (vL === best) > 1 ? ' (a tie: we prefer diagonal, then up, then left)' : '') + '. Store it, and remember which arrow won.' });
    }
    var E = dp[m][n];
    board.rest(m, n, 'found');
    push({ kind: 'answer', table: board.snap({ cursor: [m, n], cells: statesMap([[m, n]], 'found') }), word: words({ ai: m, bj: n }), cands: null, line: 'trace',
      vars: { i: m, j: n, 'a[i]': null, 'b[j]': null, 'dp[i][j]': E },
      caption: 'The corner holds the answer: the edit distance is <b>' + E + '</b>. Now walk the winning arrows back to the corner: each one is a single edit.' });
    // traceback (backwards) then replay forwards
    var pathCells = {}, pathArrows = [];
    pathCells[cellKey(m, n)] = 'path';
    script.moves.forEach(function (mv, k) {
      pathArrows.push(arrow(mv.at, mv.to, 'path', OPNAME[mv.op.type]));
      pathCells[cellKey(mv.to[0], mv.to[1])] = 'path';
      var op = mv.op;
      var txt = op.type === 'keep' ? 'diagonal, letters equal: <b>keep</b> ' + ch(op.from)
        : op.type === 'sub' ? 'diagonal, letters differ: <b>replace</b> ' + ch(op.from) + ' by ' + ch(op.to)
        : op.type === 'del' ? 'up: <b>delete</b> ' + ch(op.from) : 'left: <b>insert</b> ' + ch(op.to);
      push({ kind: 'trace', table: board.snap({ cursor: mv.to, cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }), word: words({ ai: mv.to[0], bj: mv.to[1] }), cands: null,
        line: op.type === 'del' ? 'opdel' : op.type === 'ins' ? 'opins' : 'opdiag', vars: { i: mv.to[0], j: mv.to[1], 'a[i]': mv.at[0] > 0 ? a[mv.at[0] - 1] : null, 'b[j]': mv.at[1] > 0 ? b[mv.at[1] - 1] : null, 'dp[i][j]': dp[mv.to[0]][mv.to[1]] },
        move: { at: mv.at, to: mv.to, type: op.type },
        caption: 'From dp[' + mv.at[0] + '][' + mv.at[1] + '] the winning arrow goes ' + txt + '.' });
    });
    // forward replay: the word A morphs into B
    var cur = chars(a).map(function (c, i) { return { id: 'a' + (i + 1), ch: c, state: 'default' }; });
    var producedB = 0, edits = 0;
    var fwdPath = script.path.slice().reverse();          // (0,0) ... (m,n)
    function clone(list) { return list.map(function (x) { return { id: x.id, ch: x.ch, state: x.state }; }); }
    function posOf(id) { for (var q = 0; q < cur.length; q++) if (cur[q].id === id) return q; return -1; }
    var nMoves = script.moves.length;
    // progress along the path while replaying: done cells/arrows orange, the one being applied lit, the rest quiet
    function replayTable(k, phase, cursor) {
      var cellsOv = {}, arrs = [];
      for (var q = 0; q <= Math.min(k + (phase === 'apply' ? 1 : 0), fwdPath.length - 1); q++) cellsOv[cellKey(fwdPath[q][0], fwdPath[q][1])] = 'path';
      if (phase === 'announce' && k < nMoves) cellsOv[cellKey(fwdPath[k + 1][0], fwdPath[k + 1][1])] = 'active';
      pathArrows.forEach(function (pa, idx) {
        var opIndex = nMoves - 1 - idx;                       // forward index of the edit this arrow stands for
        var st = opIndex < k || (opIndex === k && phase === 'apply') ? 'path' : opIndex === k ? 'key' : 'muted';
        arrs.push(arrow(pa.from, pa.to, st, pa.label));
      });
      return board.snap({ cursor: cursor, cells: cellsOv, arrows: arrs });
    }
    push({ kind: 'replay', table: replayTable(-1, 'announce', fwdPath[0]), word: words({ mode: 'edit', cur: clone(cur), ai: 0, bj: 0, done: 0, next: 0 }), cands: null, line: 'trace',
      vars: { i: 0, j: 0, 'a[i]': null, 'b[j]': null, 'dp[i][j]': 0 },
      caption: 'Now replay the path from the top-left corner. Each arrow becomes one edit to the word: the word <b>' + esc(a || '(empty)') + '</b> should turn into <b>' + esc(b || '(empty)') + '</b> in exactly ' + pl(E, 'edit') + '.' , edits: 0 });
    script.ops.forEach(function (op, k) {
      var cellAfter = fwdPath[k + 1];
      var pos = producedB;                                // tiles before this edit: kept, replaced or inserted so far
      var tileId, verb;
      if (op.type === 'keep' || op.type === 'sub' || op.type === 'del') tileId = 'a' + op.ai;
      var annCur = clone(cur);
      if (op.type === 'keep') { annCur[posOf(tileId)].state = 'compare'; verb = 'Letters equal: <b>keep</b> ' + ch(op.from) + '.'; }
      else if (op.type === 'sub') { annCur[posOf(tileId)].state = 'pivot'; verb = '<b>Replace</b> ' + ch(op.from) + ' by ' + ch(op.to) + ' (1 edit).'; }
      else if (op.type === 'del') { annCur[posOf(tileId)].state = 'error'; verb = '<b>Delete</b> ' + ch(op.from) + ' (1 edit).'; }
      else { verb = '<b>Insert</b> ' + ch(op.to) + ' here (1 edit).'; }
      push({ kind: 'edit-announce', table: replayTable(k, 'announce', cellAfter),
        word: words({ mode: 'edit', cur: annCur, ai: op.ai, bj: op.bj, done: producedB, next: pos, op: op.type }), cands: null, line: 'trace',
        vars: { i: cellAfter[0], j: cellAfter[1], 'a[i]': op.from, 'b[j]': op.to, 'dp[i][j]': dp[cellAfter[0]][cellAfter[1]] },
        caption: 'Edit ' + (k + 1) + ' of ' + script.ops.length + ': ' + verb, edits: edits });
      if (op.type === 'keep') { cur[posOf(tileId)].state = 'done'; producedB++; }
      else if (op.type === 'sub') { var tt = cur[posOf(tileId)]; tt.ch = op.to; tt.state = 'pivot'; producedB++; edits++; }
      else if (op.type === 'del') { cur.splice(posOf(tileId), 1); edits++; }
      else { cur.splice(pos, 0, { id: 'b' + op.bj, ch: op.to, state: 'active' }); producedB++; edits++; }
      var after = clone(cur);
      var doneWord = after.map(function (x) { return x.ch; }).join('');
      push({ kind: 'edit-apply', table: replayTable(k, 'apply', cellAfter),
        word: words({ mode: 'edit', cur: after, ai: op.ai, bj: op.bj, done: producedB, next: producedB, op: op.type }), cands: null, line: 'trace',
        vars: { i: cellAfter[0], j: cellAfter[1], 'a[i]': op.from, 'b[j]': op.to, 'dp[i][j]': dp[cellAfter[0]][cellAfter[1]] },
        caption: (op.type === 'keep' ? 'Nothing changes, and no cost.' : 'Cost so far: <b>' + edits + '</b>.') + ' The word now reads <b>' + esc(doneWord || '(empty)') + '</b>.', edits: edits, wordText: doneWord });
      cur.forEach(function (x) { if (x.state === 'active' || x.state === 'pivot') x.state = 'done'; });
    });
    push({ kind: 'done', table: board.snap({ cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }),
      word: words({ mode: 'edit', cur: clone(cur), ai: m, bj: n, done: cur.length, next: cur.length, finished: true }), cands: null, line: 'ret',
      vars: { i: 0, j: 0, 'a[i]': null, 'b[j]': null, 'dp[i][j]': E },
      caption: E === 0 ? 'The words are identical: zero edits.' : '<b>' + esc(a || '(empty)') + '</b> became <b>' + esc(b || '(empty)') + '</b> in <b>' + E + '</b> ' + (E === 1 ? 'edit' : 'edits') + ', and no shorter script exists: every cell along the way was a minimum.', edits: edits });
    return S;
  }

  /* ================================================================== 0/1 knapsack lab */
  function knapLab(items, W) {
    var n = items.length, t = knapTables(items, W), dp = t.dp, picked = knapTrace(items, t);
    var rowHeaders = ['none'];
    items.forEach(function (it, i) { rowHeaders.push('#' + (i + 1)); });
    var colHeaders = []; for (var c = 0; c <= W; c++) colHeaders.push(String(c));
    var board = makeBoard(n + 1, W + 1, { rowHeaders: rowHeaders, colHeaders: colHeaders });
    var S = [], filled = 0;
    function stage(cur, decided, tracing) {
      // cur: item number being considered (0 = none); decided: {itemNo: 'take'|'skip'}
      decided = decided || {};
      var order = 0, bagW = 0, bagV = 0, list = [];
      var bagOrder = [];
      Object.keys(decided).forEach(function (k) { if (decided[k].kind === 'take') bagOrder.push({ no: +k, at: decided[k].at }); });
      bagOrder.sort(function (x, y) { return x.at - y.at; });
      items.forEach(function (it, i) {
        var no = i + 1, d = decided[no], state;
        if (d) state = d.kind === 'take' ? 'path' : 'muted';
        else if (no === cur) state = 'active';
        else state = !tracing && cur > 0 && no < cur ? 'visited' : 'default';
        var slot = -1;
        if (d && d.kind === 'take') { slot = bagOrder.map(function (x) { return x.no; }).indexOf(no); bagW += it.w; bagV += it.v; }
        list.push({ id: 'it' + no, no: no, w: it.w, v: it.v, state: state, slot: slot });
      });
      return { items: list, W: W, bagW: bagW, bagV: bagV, cur: cur };
    }
    function push(o) { o.counters = { cells: filled, reads: o.reads || 0 }; delete o.reads; S.push(o); }
    var reads = 0;
    for (var i = 0; i <= n; i++) { board.set(i, 0, 0); filled++; }
    for (var w = 1; w <= W; w++) { board.set(0, w, 0); filled++; }
    push({ kind: 'base', table: board.snap(), stage: stage(0), cands: null, line: 'base', vars: { i: null, w: null, skip: null, take: null, 'dp[i][w]': null },
      caption: 'Row <b>none</b> means "no items to choose from", and column <b>0</b> means "no room": both can only hold value <b>0</b>. Each other cell answers: <i>best value using the first i items with capacity w</i>.' });
    for (i = 1; i <= n; i++) for (w = 1; w <= W; w++) {
      var it = items[i - 1], fits = it.w <= w;
      var skip = dp[i - 1][w], take = fits ? dp[i - 1][w - it.w] + it.v : null;
      var srcs = [[i - 1, w]]; if (fits) srcs.push([i - 1, w - it.w]);
      var over = statesMap(srcs, 'compare'); over[cellKey(i, w)] = 'active';
      var arrows = [arrow([i - 1, w], [i, w], 'compare', 'skip')]; if (fits) arrows.push(arrow([i - 1, w - it.w], [i, w], 'compare', 'take'));
      reads += fits ? 2 : 1;
      var cands = [
        { tag: 'skip', title: '↑ skip item #' + i, expr: 'dp[' + (i - 1) + '][' + w + '] = ' + skip, val: skip },
        fits ? { tag: 'take', title: '↖ take item #' + i + ' (w' + it.w + ', v' + it.v + ')', expr: 'dp[' + (i - 1) + '][' + (w - it.w) + '] + ' + it.v + ' = ' + dp[i - 1][w - it.w] + ' + ' + it.v, val: take }
             : { tag: 'take', title: '↖ take item #' + i, expr: 'too heavy: ' + it.w + ' > ' + w, off: true }];
      var vars = { i: i, w: w, skip: skip, take: fits ? take : null, 'dp[i][w]': null };
      push({ kind: 'look', table: board.snap({ cursor: [i, w], hr: i, hc: w, cells: over, arrows: arrows }), stage: stage(i), cands: cands, line: ['skip', 'cmp'], vars: vars, reads: reads,
        predict: { i: i, w: w, fits: fits, skip: skip, take: take, value: dp[i][w] },
        caption: fits
          ? 'Capacity ' + w + ', item #' + i + ' weighs ' + it.w + ' and is worth ' + it.v + '. <b>Skip</b> it: keep the best of the row above (' + skip + '). <b>Take</b> it: use the ' + (w - it.w) + (w - it.w === 1 ? ' unit' : ' units') + ' left over, best value there is ' + dp[i - 1][w - it.w] + ', plus ' + it.v + ' = ' + take + '.'
          : 'Capacity ' + w + ' is smaller than item #' + i + ' (weight ' + it.w + '), so it cannot go in. The only choice is to <b>skip</b>: copy the cell above (' + skip + ').' });
      var tookIt = t.take[i][w];
      board.set(i, w, dp[i][w]); filled++;
      var srcCell = tookIt ? [i - 1, w - it.w] : [i - 1, w];
      var arrowsW = [arrow(srcCell, [i, w], 'key', tookIt ? 'take' : 'skip')];
      push({ kind: 'write', table: board.snap({ cursor: [i, w], hr: i, hc: w, cells: Object.assign(statesMap([srcCell], 'compare'), statesMap([[i, w]], 'active')), arrows: arrowsW }),
        stage: stage(i), cands: cands.map(function (c) { return Object.assign({}, c, { win: c.tag === (tookIt ? 'take' : 'skip') }); }),
        line: tookIt ? 'take' : 'skip', vars: Object.assign({}, vars, { 'dp[i][w]': dp[i][w] }), reads: reads,
        caption: tookIt ? 'Taking (' + take + ') beats skipping (' + skip + '), so write <b>' + dp[i][w] + '</b> and remember: item #' + i + ' is in.'
          : fits ? 'Skipping (' + skip + ') is at least as good as taking (' + take + '), so write <b>' + dp[i][w] + '</b>. A tie goes to skip: fewer items.' : 'Write <b>' + dp[i][w] + '</b>.' });
    }
    board.rest(n, W, 'found');
    var best = dp[n][W];
    push({ kind: 'answer', table: board.snap({ cursor: [n, W], cells: statesMap([[n, W]], 'found') }), stage: stage(0), cands: null, line: 'trace', reads: reads,
      vars: { i: n, w: W, skip: null, take: null, 'dp[i][w]': best },
      caption: 'The bottom-right cell is the answer: with all ' + n + ' item' + (n === 1 ? '' : 's') + ' and capacity ' + W + ', the best value is <b>' + best + '</b>. But which items make it? Walk back up and ask, row by row, whether the value changed.' });
    // traceback: two steps per row
    var pathCells = {}, pathArrows = [], decided = {}, cw = W, bagCount = 0;
    pathCells[cellKey(n, W)] = 'path';
    for (i = n; i >= 1; i--) {
      var here = dp[i][cw], above = dp[i - 1][cw], tookRow = here !== above, itm = items[i - 1];
      var o2 = statesMap([[i, cw]], 'path'), o3 = Object.assign({}, pathCells, o2, statesMap([[i - 1, cw]], 'compare'));
      var v2 = { i: i, w: cw, skip: above, take: here, 'dp[i][w]': here };
      push({ kind: 'decide', table: board.snap({ cursor: [i, cw], cells: o3, arrows: pathArrows.slice() }), stage: stage(i, decided, true), cands: null, line: 'pick', reads: reads,
        vars: v2, predict: { i: i, w: cw, take: tookRow, here: here, above: above },
        caption: 'Row #' + i + ' at capacity ' + cw + ': compare this cell (<b>' + here + '</b>) with the cell directly above (<b>' + above + '</b>). ' + (tookRow ? 'They differ.' : 'They are equal.') });
      var next;
      if (tookRow) {
        decided[i] = { kind: 'take', at: bagCount++ };
        next = [i - 1, cw - itm.w];
        pathArrows.push(arrow([i, cw], next, 'path', 'take'));
      } else { decided[i] = { kind: 'skip' }; next = [i - 1, cw]; pathArrows.push(arrow([i, cw], next, 'path', 'skip')); }
      pathCells[cellKey(next[0], next[1])] = 'path';
      var cwBefore = cw;
      if (tookRow) cw -= itm.w;
      push({ kind: 'apply', table: board.snap({ cursor: next, cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }), stage: stage(i - 1, Object.assign({}, decided), true), cands: null, line: 'pick', reads: reads,
        vars: { i: i - 1, w: cw, skip: null, take: null, 'dp[i][w]': dp[i - 1][cw] }, decision: { item: i, take: tookRow },
        caption: tookRow
          ? 'The value changed, so item #' + i + ' must have been taken. Into the bag it goes (weight ' + itm.w + ', value ' + itm.v + '). The rest of the bag has ' + (cwBefore - itm.w) + ' capacity left: jump diagonally to dp[' + (i - 1) + '][' + (cwBefore - itm.w) + '].'
          : 'Same value as the row above, so item #' + i + ' added nothing here: leave it out. Same capacity, one row up.' });
    }
    var bagItems = picked.slice().reverse();
    push({ kind: 'done', table: board.snap({ cells: Object.assign({}, pathCells), arrows: pathArrows.slice() }), stage: stage(0, decided, true), cands: null, line: 'ret', reads: reads,
      vars: { i: 0, w: cw, skip: null, take: null, 'dp[i][w]': best },
      caption: picked.length === 0 ? 'Nothing fits profitably: the best bag is empty (value 0).' : 'The bag holds items <b>' + bagItems.map(function (k) { return '#' + k; }).join(', ') + '</b>: total weight ' + bagItems.reduce(function (s, k) { return s + items[k - 1].w; }, 0) + ' of ' + W + ', total value <b>' + best + '</b>, matching the table.' });
    return S;
  }

  /* ================================================================== the problem: common subsequences of two strings */
  /* Leftmost embedding of s in str: 1-based positions, or null when s is not a subsequence. */
  function embed(s, str) {
    var pos = [], k = 0;
    for (var q = 0; q < s.length; q++) {
      while (k < str.length && str[k] !== s[q]) k++;
      if (k >= str.length) return null;
      pos.push(k + 1); k++;
    }
    return pos;
  }
  function shareSteps(a, b, list) {
    list = list || ['G', 'GT', 'AB', 'GAB', 'GTAB'];
    var S = [], best = lcsLength(a, b);
    S.push({ kind: 'intro', strip: { a: a, b: b, i: 0, j: 0, links: [], result: '', L: null, bad: false },
      caption: 'Two strings. A <b>subsequence</b> keeps some letters in their original order and drops the rest. Which subsequences do A and B have in common, and how long can one be?', count: { cand: 0, best: 0 } });
    var bestSoFar = 0;
    list.forEach(function (s) {
      var pa = embed(s, a), pb = embed(s, b);
      if (!pa || !pb) {
        S.push({ kind: 'bad', strip: { a: a, b: b, i: 0, j: 0, links: [], result: s, L: null, bad: true },
          caption: '<b>' + esc(s) + '</b> is not a common subsequence: ' + (!pa ? 'A has no such letters in that order' : 'B has no such letters in that order') + '. Order matters.', count: { cand: s.length, best: bestSoFar } });
        return;
      }
      var links = pa.map(function (p, q) { return [p, pb[q]]; });
      bestSoFar = Math.max(bestSoFar, s.length);
      S.push({ kind: 'good', strip: { a: a, b: b, i: 0, j: 0, links: links, result: s, L: s.length, bad: false },
        caption: '<b>' + esc(s) + '</b> appears in both, in the same order. Length ' + s.length + (s.length === best ? ': the best possible.' : '. Can we do better?'), count: { cand: s.length, best: bestSoFar } });
    });
    S.push({ kind: 'end', strip: S[S.length - 1].strip, caption: 'A has ' + pl(a.length, 'letter') + ', so it has 2<sup>' + a.length + '</sup> = ' + pl(Math.pow(2, a.length), 'subsequence') + ' to test against B. The table you are about to build finds the best in ' + (a.length * b.length) + ' small steps.', count: { cand: best, best: best } });
    return S;
  }

  /* ================================================================== grid paths */
  function gridSteps(rows, cols, walls) {
    var wall = {};
    var W = (walls || []).filter(function (w) { return !(w[0] === 0 && w[1] === 0) && !(w[0] === rows - 1 && w[1] === cols - 1) && w[0] >= 0 && w[1] >= 0 && w[0] < rows && w[1] < cols; });
    W.forEach(function (w) { wall[cellKey(w[0], w[1])] = true; });
    var board = makeBoard(rows, cols, { walls: W });
    var S = [], filled = 0;
    function push(o) { o.counters = { cells: filled }; S.push(o); }
    var dp = matrix(rows, cols, 0);
    board.set(0, 0, 1); dp[0][0] = 1; filled++;
    push({ kind: 'start', table: board.snap({ cursor: [0, 0] }), caption: 'One way to be at the start: do nothing. Every other cell is the sum of the ways to reach the cell above and the cell to the left, because the last move was down or right.' });
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      if (wall[cellKey(r, c)]) {
        push({ kind: 'blocked', table: board.snap({ cursor: [r, c] }), caption: 'Cell (' + r + ', ' + c + ') is an obstacle: nobody can stand here, so it holds no paths.' });
        continue;
      }
      var up = r > 0 && !wall[cellKey(r - 1, c)] ? dp[r - 1][c] : 0, lf = c > 0 && !wall[cellKey(r, c - 1)] ? dp[r][c - 1] : 0;
      dp[r][c] = up + lf;
      var arrows = [], src = [];
      if (r > 0 && !wall[cellKey(r - 1, c)]) { arrows.push(arrow([r - 1, c], [r, c], 'key', String(up))); src.push([r - 1, c]); }
      if (c > 0 && !wall[cellKey(r, c - 1)]) { arrows.push(arrow([r, c - 1], [r, c], 'key', String(lf))); src.push([r, c - 1]); }
      board.set(r, c, dp[r][c]); filled++;
      var over = statesMap(src, 'compare'); over[cellKey(r, c)] = 'active';
      push({ kind: 'fill', table: board.snap({ cursor: [r, c], cells: over, arrows: arrows }), fill: { r: r, c: c, up: up, left: lf, value: dp[r][c] },
        caption: (r === 0 || c === 0 ? 'Edge cell: only one neighbour can feed it. ' : '') + 'Paths into (' + r + ', ' + c + ') = from above <b>' + up + '</b> + from the left <b>' + lf + '</b> = <b>' + dp[r][c] + '</b>.' });
    }
    var total = dp[rows - 1][cols - 1];
    board.rest(rows - 1, cols - 1, 'found');
    push({ kind: 'answer', table: board.snap({ cursor: [rows - 1, cols - 1], cells: statesMap([[rows - 1, cols - 1]], 'found') }),
      caption: total === 0 ? 'The corner holds <b>0</b>: the obstacles cut every route from the start to the goal.' : 'The bottom-right cell holds the answer: <b>' + total + '</b> different paths from start to goal.' });
    if (total > 0) {
      var rr = rows - 1, cc = cols - 1, pc = {}, pa = [];
      pc[cellKey(rr, cc)] = 'path';
      while (rr > 0 || cc > 0) {
        var upOk = rr > 0 && dp[rr - 1][cc] > 0;
        var to = upOk ? [rr - 1, cc] : [rr, cc - 1];
        pa.push(arrow(to, [rr, cc], 'path'));
        rr = to[0]; cc = to[1]; pc[cellKey(rr, cc)] = 'path';
      }
      push({ kind: 'route', table: board.snap({ cells: pc, arrows: pa }), caption: 'One of those ' + pl(total, 'route') + ', found by walking back from the goal through any neighbour that has a positive count.' });
    }
    return S;
  }

  /* ================================================================== fill orders */
  /* order: 'row' | 'col' | 'diag' | 'bad'. Each cell shows the step in which it was finished. */
  function orderSteps(n, order) {
    var board = makeBoard(n, n, { rowHeaders: null, colHeaders: null });
    var S = [], done = 0, label = { row: 'row by row', col: 'column by column', diag: 'anti-diagonal by anti-diagonal', bad: 'bottom row first (a bad order)' }[order];
    function push(o) { o.counters = { cells: done, waiting: o.waiting || 0 }; delete o.waiting; S.push(o); }
    function ready(r, c) { return board.v[r][c] !== null; }
    function deps(r, c) { var d = []; if (r > 0) d.push([r - 1, c]); if (c > 0) d.push([r, c - 1]); if (r > 0 && c > 0) d.push([r - 1, c - 1]); return d; }
    var groups = [];
    if (order === 'row') for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) groups.push([[r, c]]);
    else if (order === 'col') for (c = 0; c < n; c++) for (r = 0; r < n; r++) groups.push([[r, c]]);
    else if (order === 'diag') for (var k = 0; k <= 2 * (n - 1); k++) { var g = []; for (r = 0; r < n; r++) { c = k - r; if (c >= 0 && c < n) g.push([r, c]); } groups.push(g); }
    else for (r = n - 1; r >= 0; r--) for (c = 0; c < n; c++) groups.push([[r, c]]);
    push({ kind: 'intro', table: board.snap(), caption: 'Every cell reads its up, left and diagonal neighbours. Any order that finishes those first is fine. Order: <b>' + label + '</b>.' });
    var bad = 0;
    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi];
      var missing = [];
      grp.forEach(function (p) { deps(p[0], p[1]).forEach(function (d) { if (!ready(d[0], d[1])) missing.push(d); }); });
      if (order === 'bad' && missing.length) {
        bad++;
        var over = {}; grp.forEach(function (p) { over[cellKey(p[0], p[1])] = 'error'; }); missing.forEach(function (d) { over[cellKey(d[0], d[1])] = 'error'; });
        var arrows = []; grp.forEach(function (p) { deps(p[0], p[1]).forEach(function (d) { arrows.push(arrow(d, p, ready(d[0], d[1]) ? 'compare' : 'error')); }); });
        push({ kind: 'bad', table: board.snap({ cursor: grp[0], cells: over, arrows: arrows }), waiting: missing.length,
          caption: 'Cell (' + grp[0][0] + ', ' + grp[0][1] + ') needs ' + missing.length + ' neighbour' + (missing.length === 1 ? '' : 's') + ' that ' + (missing.length === 1 ? 'is' : 'are') + ' still empty (red). Reading an empty cell would give garbage.' });
        if (bad >= 4) break;
        continue;
      }
      done += grp.length;
      grp.forEach(function (p) { board.set(p[0], p[1], done, 'visited', String(done)); });
      var arrows2 = [], over2 = {};
      grp.forEach(function (p) { over2[cellKey(p[0], p[1])] = 'active'; deps(p[0], p[1]).forEach(function (d) { arrows2.push(arrow(d, p, 'compare')); }); });
      push({ kind: 'fill', table: board.snap({ cursor: grp.length === 1 ? grp[0] : null, cells: over2, arrows: arrows2 }), group: grp,
        caption: grp.length === 1
          ? 'Cell (' + grp[0][0] + ', ' + grp[0][1] + ') is finished: everything it reads is already there.'
          : 'The ' + grp.length + ' cells on this anti-diagonal read only earlier diagonals, so they do not depend on each other: they could even be computed at the same time.' });
    }
    if (order === 'bad') push({ kind: 'end', table: board.snap(), caption: 'This order breaks the one rule: <b>finish a cell\'s inputs first</b>. Row by row, column by column and diagonal by diagonal all obey it.' });
    else push({ kind: 'end', table: board.snap(), caption: 'Whole table filled, ' + (order === 'diag' ? pl(2 * n - 1, 'diagonal') : pl(n * n, 'cell')) + ', with no cell ever reading an empty neighbour.' });
    return S;
  }

  /* ================================================================== one-row knapsack: backward vs forward in lock step */
  function oneRowSteps(w, v, W) {
    var oldRow = []; for (var c = 0; c <= W; c++) oldRow.push(0);
    var pane = { back: { dp: oldRow.slice(), copies: oldRow.map(function () { return 0; }), stale: {} }, fwd: { dp: oldRow.slice(), copies: oldRow.map(function () { return 0; }), stale: {} } };
    var S = [];
    var total = W - w + 1;
    function paneState(p, aNow, srcNow, kindNow, reason) {
      return { old: oldRow.slice(), dp: p.dp.slice(), copies: p.copies.slice(), a: aNow, src: srcNow, kind: kindNow, updated: Object.assign({}, p.stale), reason: reason || null };
    }
    S.push({ kind: 'intro', k: -1, left: paneState(pane.back), right: paneState(pane.fwd), w: w, v: v, W: W,
      caption: 'One item, weight <b>' + w + '</b>, value <b>' + v + '</b>. There is only one of it. The row starts as "before this item" (all zeros). Both rows will apply the same rule, <code>dp[a] = max(dp[a], dp[a − ' + w + '] + ' + v + ')</code>, but in opposite directions.' });
    for (var k = 0; k < total; k++) {
      var aB = W - k, aF = w + k;
      var srcB = aB - w, srcF = aF - w;
      var badF = !!pane.fwd.stale[srcF];
      var lookL = paneState(pane.back, aB, srcB, 'read'), lookR = paneState(pane.fwd, aF, srcF, 'read', badF ? 'stale' : null);
      S.push({ kind: 'read', k: k, left: lookL, right: lookR, w: w, v: v, W: W,
        caption: 'Capacity <b>' + aB + '</b> going backwards, <b>' + aF + '</b> going forwards. Each reads the cell ' + w + ' to its left. ' +
          (badF ? 'On the right, <b>dp[' + srcF + ']</b> was already rewritten in this pass: it may already contain the item.' : 'Both cells still hold their "before this item" value.') });
      // write
      var newB = Math.max(pane.back.dp[aB], pane.back.dp[srcB] + v), newF = Math.max(pane.fwd.dp[aF], pane.fwd.dp[srcF] + v);
      if (pane.back.dp[srcB] + v > pane.back.dp[aB]) { pane.back.copies[aB] = pane.back.copies[srcB] + 1; }
      pane.back.dp[aB] = newB; pane.back.stale[aB] = true;
      if (pane.fwd.dp[srcF] + v > pane.fwd.dp[aF]) { pane.fwd.copies[aF] = pane.fwd.copies[srcF] + 1; }
      pane.fwd.dp[aF] = newF; pane.fwd.stale[aF] = true;
      S.push({ kind: 'write', k: k, left: paneState(pane.back, aB, srcB, 'write'), right: paneState(pane.fwd, aF, srcF, 'write', pane.fwd.copies[aF] > 1 ? 'reuse' : null), w: w, v: v, W: W,
        wrote: { back: newB, fwd: newF, aB: aB, aF: aF, copiesF: pane.fwd.copies[aF], copiesB: pane.back.copies[aB] },
        caption: 'Backward writes <b>dp[' + aB + '] = ' + newB + '</b> (' + pane.back.copies[aB] + ' cop' + (pane.back.copies[aB] === 1 ? 'y' : 'ies') + ' of the item at most). Forward writes <b>dp[' + aF + '] = ' + newF + '</b>' +
          (pane.fwd.copies[aF] > 1 ? ', which uses the item <b>' + pane.fwd.copies[aF] + ' times</b>: impossible with one item.' : '.') });
    }
    var maxF = Math.max.apply(null, pane.fwd.copies);
    S.push({ kind: 'end', k: total, left: paneState(pane.back), right: paneState(pane.fwd), w: w, v: v, W: W,
      caption: 'Backward: dp[' + W + '] = <b>' + pane.back.dp[W] + '</b>, correct for one item. Forward: dp[' + W + '] = <b>' + pane.fwd.dp[W] + '</b>, as if you owned ' + maxF + ' copies. Iterating capacity <b>backwards</b> keeps every read pointing at the old row; forwards solves the <em>unbounded</em> knapsack instead.' });
    return S;
  }
  /* Result of the one-row loop for a whole item list, in the given direction (used to test against the 2D table). */
  function oneRowKnapsack(items, W, direction) {
    var dp = []; for (var c = 0; c <= W; c++) dp.push(0);
    items.forEach(function (it) {
      if (direction === 'forward') for (var k = it.w; k <= W; k++) dp[k] = Math.max(dp[k], dp[k - it.w] + it.v);
      else for (k = W; k >= it.w; k--) dp[k] = Math.max(dp[k], dp[k - it.w] + it.v);
    });
    return dp;
  }

  /* ================================================================== hero teaser: wavefront + glowing path */
  function lcsTeaser(a, b) {
    var t = lcsTables(a, b), m = a.length, n = b.length, tr = lcsTrace(a, b, t);
    var board = makeBoard(m + 1, n + 1, { rowHeaders: ['∅'].concat(chars(a)), colHeaders: ['∅'].concat(chars(b)) });
    var S = [];
    for (var i = 0; i <= m; i++) board.set(i, 0, 0);
    for (var j = 1; j <= n; j++) board.set(0, j, 0);
    S.push({ kind: 'base', table: board.snap() });
    for (var k = 2; k <= m + n; k++) {
      var cells = {}, arrows = [], any = false;
      for (i = 1; i <= m; i++) {
        j = k - i;
        if (j < 1 || j > n) continue;
        any = true;
        board.set(i, j, t.dp[i][j]);
        cells[cellKey(i, j)] = 'active';
        var c0 = t.choice[i][j];
        arrows.push(arrow(c0 === 'diag' ? [i - 1, j - 1] : c0 === 'up' ? [i - 1, j] : [i, j - 1], [i, j], c0 === 'diag' ? 'found' : 'key'));
      }
      if (any) S.push({ kind: 'wave', table: board.snap({ cells: cells, arrows: arrows }) });
    }
    var pc = {}, pa = [];
    pc[cellKey(m, n)] = 'path';
    S.push({ kind: 'answer', table: board.snap({ cells: Object.assign({}, pc), cursor: [m, n] }) });
    for (var q = 1; q < tr.path.length; q++) {
      pa.push(arrow(tr.path[q - 1], tr.path[q], 'path'));
      pc[cellKey(tr.path[q][0], tr.path[q][1])] = 'path';
      S.push({ kind: 'trace', table: board.snap({ cells: Object.assign({}, pc), arrows: pa.slice(), cursor: tr.path[q] }) });
    }
    return S;
  }

  /* ================================================================== variations (static tables for the tabs) */
  /* Longest common SUBSTRING: a mismatch resets the run to 0, so the answer is the largest cell anywhere. */
  function lcSubstring(a, b) {
    var m = a.length, n = b.length, dp = matrix(m + 1, n + 1, 0), best = 0, at = [0, 0];
    for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : 0;
      if (dp[i][j] > best) { best = dp[i][j]; at = [i, j]; }
    }
    return { dp: dp, best: best, at: at, string: best ? a.slice(at[0] - best, at[0]) : '' };
  }
  /* Subset sum as a boolean table: can[i][t] = some subset of the first i numbers sums to exactly t. */
  function subsetSum(nums, target) {
    var can = matrix(nums.length + 1, target + 1, false);
    can[0][0] = true;
    for (var i = 1; i <= nums.length; i++) for (var t = 0; t <= target; t++)
      can[i][t] = can[i - 1][t] || (t >= nums[i - 1] && can[i - 1][t - nums[i - 1]]);
    return { can: can, ok: can[nums.length][target] };
  }

  /* ================================================================== operation counts for the cost chart */
  var ops = {
    knapBrute: function (n) { return Math.pow(2, n); },              // subsets
    knapDp: function (n, W) { return n * W; },                        // cells
    lcsBrute: function (n) { return Math.pow(2, n); },                // subsequences of one string
    lcsDp: function (n) { return n * n; },                            // cells
    /* smallest n where the exponential overtakes n*W */
    knapCross: function (W) { for (var n = 1; n < 60; n++) if (Math.pow(2, n) > n * W) return n; return 60; }
  };

  /* ================================================================== input validation */
  function parseWords(text, max, label) {
    var raw = String(text || '').split(/[,;\s]+/).filter(Boolean);
    if (raw.length !== 2) return { error: 'Type ' + (label || 'two words') + ' separated by a comma, like AGGTAB, GXTXAYB.' };
    for (var i = 0; i < 2; i++) {
      if (!/^[A-Za-z0-9]+$/.test(raw[i])) return { error: 'Use only letters and digits (no spaces or symbols): “' + raw[i].slice(0, 12) + '” has something else.' };
      if (raw[i].length > max) return { error: 'Keep each word to ' + max + ' characters or fewer so the table stays readable (“' + raw[i].slice(0, 12) + '” has ' + raw[i].length + ').' };
    }
    return { values: raw };
  }
  function parseItems(text) {
    var raw = String(text || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!raw.length) return { error: 'Add at least one item as weight:value, like 3:4, 4:5.' };
    if (raw.length > LIMITS.items) return { error: 'Up to ' + LIMITS.items + ' items, please (you typed ' + raw.length + ').' };
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var m = /^(\d+)\s*[:/]\s*(\d+)$/.exec(raw[i]);
      if (!m) return { error: '“' + raw[i].slice(0, 14) + '” is not weight:value. Write each item like 3:4 (weight 3, value 4).' };
      var w = +m[1], v = +m[2];
      if (w < 1 || w > LIMITS.maxW) return { error: 'Weights must be whole numbers from 1 to ' + LIMITS.maxW + ' (item ' + (i + 1) + ' has ' + w + ').' };
      if (v < 0 || v > LIMITS.maxV) return { error: 'Values must be from 0 to ' + LIMITS.maxV + ' (item ' + (i + 1) + ' has ' + v + ').' };
      out.push({ w: w, v: v });
    }
    return { values: out };
  }

  return {
    LIMITS: LIMITS,
    lcsLength: lcsLength, lcsString: lcsString, editDistance: editDistance, knapsack01: knapsack01, knapsackBrute: knapsackBrute, gridPaths: gridPaths,
    lcsTables: lcsTables, lcsTrace: lcsTrace, editTables: editTables, editScript: editScript, knapTables: knapTables, knapTrace: knapTrace,
    embed: embed, oneRowKnapsack: oneRowKnapsack, lcSubstring: lcSubstring, subsetSum: subsetSum,
    lcsLab: lcsLab, editLab: editLab, knapLab: knapLab,
    shareSteps: shareSteps, gridSteps: gridSteps, orderSteps: orderSteps, oneRowSteps: oneRowSteps, lcsTeaser: lcsTeaser,
    ops: ops,
    parse: {
      words: function (t) { return parseWords(t, LIMITS.lcs); },
      editWords: function (t) { return parseWords(t, LIMITS.edit); },
      items: parseItems
    }
  };
}));
