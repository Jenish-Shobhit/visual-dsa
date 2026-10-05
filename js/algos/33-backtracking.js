/* Lesson 33 · Backtracking — pure step generators (no DOM).

   Loaded in the browser as a classic script (registers VDSA.algos['33-backtracking']) and in Node via require()
   for tests/algos/33-backtracking.test.js.

   Contents
   - N-Queens:   queens(n, {all, collapse, cap})     the lab trace: board + state-space tree, one step per square
                 queensCount(n, all)                 nodes / squares checked / solutions (fast reference counter)
                 queensSolutions(n)                  every solution, brute force over permutations (tests only)
                 bruteForce(n)                       sizes of the brute-force search spaces
                 queensTrees(n)                      the unpruned and the pruned tree, grown level by level
                 attackerOf(cols, r, c), attackedCells(pieces, n), pairsAttacking(pieces)
   - Choose sets: subsetsTrace(items), permutationsTrace(items), combinationsTrace(items, k)
   - Sudoku:     sudoku(grid, {order, cap, nodeCap}) trace; sudokuCount(grid, order, nodeCap); parseSudoku(text);
                 solveSudoku(grid) plain reference; PUZZLES
   - Word search: wordSearch(rows, word, {cap, nodeCap}); wordSearchRef(rows, word); parseWordGrid(text, word)
   - Analogy:    mazeWalk()                          depth-first walk of a small maze of forks
   - Parse:      parseItems(text, {min, max})

   Every step is a complete snapshot; nothing is mutated after it is pushed. Lab steps carry
   {kind, caption, line, vars, counters, flow} plus what their renderer needs. Long searches are capped: the
   trace records the first `cap` steps, keeps counting silently, and ends with one summary step. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) {
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos['33-backtracking'] = api;
    root.VDSA.algos.backtracking = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function minus(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function sortedNums(a) { return a.slice().sort(function (x, y) { return x - y; }); }
  function fmtInt(v) { return v >= 1e21 ? v.toExponential(1) : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ================================================================== N-Queens: references */

  /* The first queen among rows 0..r-1 (cols[i] = column of the queen in row i) that attacks (r, c), or null. */
  function attackerOf(cols, r, c) {
    for (var i = 0; i < r && i < cols.length; i++) {
      var d = cols[i];
      if (d === c) return { r: i, c: d, kind: 'column' };
      if (i + d === r + c) return { r: i, c: d, kind: 'd1' };       // same r + c: the "/" diagonal
      if (i - d === r - c) return { r: i, c: d, kind: 'd2' };       // same r - c: the "\" diagonal
    }
    return null;
  }
  /* Squares attacked by at least one of the pieces [[r, c], ...] (a queen's own square counts). Returns n*n booleans. */
  function attackedCells(pieces, n) {
    var out = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var hit = false;
      for (var k = 0; k < pieces.length && !hit; k++) {
        var pr = pieces[k][0], pc = pieces[k][1];
        hit = pr === r || pc === c || pr + pc === r + c || pr - pc === r - c;
      }
      out.push(hit);
    }
    return out;
  }
  /* Pairs of pieces that attack each other (any two queens sharing a row, column or diagonal). */
  function pairsAttacking(pieces) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) for (var j = i + 1; j < pieces.length; j++) {
      var a = pieces[i], b = pieces[j];
      if (a[0] === b[0] || a[1] === b[1] || a[0] + a[1] === b[0] + b[1] || a[0] - a[1] === b[0] - b[1]) out.push([i, j]);
    }
    return out;
  }

  /* Counts for the full search with rows filled in order and columns tried left to right.
     nodes = calls of solve (the root plus every queen placed); checks = squares examined; the first* fields describe
     the stop-at-first-solution run (0 when the board has no solution). */
  function queensCount(n, all) {
    var cols = [], d1 = [], d2 = [], nodes = 1, checks = 0, backtracks = 0, sols = 0, first = null;
    function go(r) {
      if (r === n) { sols++; if (!first) first = { nodes: nodes, checks: checks, backtracks: backtracks }; return !all; }
      for (var c = 0; c < n; c++) {
        checks++;
        if (cols[c] || d1[r + c] || d2[r - c + n]) continue;
        cols[c] = d1[r + c] = d2[r - c + n] = true; nodes++;
        var stop = go(r + 1);
        if (stop) return true;
        cols[c] = d1[r + c] = d2[r - c + n] = false; backtracks++;
      }
      return false;
    }
    go(0);
    if (!all) return { n: n, nodes: nodes, checks: checks, backtracks: backtracks, solutions: sols };
    return { n: n, nodes: nodes, checks: checks, backtracks: backtracks, solutions: sols,
      firstNodes: first ? first.nodes : 0, firstChecks: first ? first.checks : 0 };
  }
  /* Every solution as an array of columns (one per row), found by testing all n! permutations. Small n only. */
  function queensSolutions(n) {
    var out = [];
    (function perm(cols, left) {
      if (!left.length) {
        for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) if (Math.abs(cols[i] - cols[j]) === j - i) return;
        out.push(cols.slice()); return;
      }
      for (var k = 0; k < left.length; k++) { cols.push(left[k]); perm(cols, left.slice(0, k).concat(left.slice(k + 1))); cols.pop(); }
    }([], Array.apply(null, { length: n }).map(function (_, i) { return i; })));
    return out;
  }
  function binom(a, b) { var r = 1; for (var i = 1; i <= b; i++) r = r * (a - b + i) / i; return Math.round(r); }
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  /* Sizes of the search spaces a brute-force program would face. */
  function bruteForce(n) {
    return {
      n: n,
      choose: binom(n * n, n),                                   // any n of the n*n squares
      rows: Math.pow(n, n),                                      // one queen per row, any column
      perms: factorial(n),                                       // one per row and per column
      fullTree: n === 1 ? 2 : (Math.pow(n, n + 1) - 1) / (n - 1) // nodes of the unpruned row-by-row tree
    };
  }

  /* ================================================================== N-Queens: the lab trace
     Row-by-row search with three constraint sets. Board state = cols (the column of the queen in each filled row).
     Tree nodes are the calls of solve: the root plus one node per queen placed. Finished branches collapse
     into one muted node that shows how many nodes hide inside it (collapse = true). */
  function queens(n, opts) {
    opts = opts || {};
    if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > 12) throw new RangeError('n must be a whole number from 1 to 12');
    var all = !!opts.all, collapse = opts.collapse !== false, cap = opts.cap || 5000;
    var cols = [], steps = [], capped = false;
    var recs = [{ parent: -1, label: 'start', row: -1, col: -1, finished: false, hasSol: false, size: 1, key: '', snap: null }];
    var path = [0];
    var ct = { nodes: 1, checks: 0, backtracks: 0, solutions: 0 };
    var firstSolution = null;

    function nodeSnap(i, state, badge) {
      var r = recs[i], key = state + '|' + (badge || '');
      if (r.key !== key) { r.key = key; r.snap = { id: 't' + i, parent: r.parent < 0 ? null : 't' + r.parent, label: r.label, row: r.row, col: r.col, state: state, badge: badge || null }; }
      return r.snap;
    }
    function tree(solved) {
      var out = [], top = path[path.length - 1];
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i], p = r.parent < 0 ? null : recs[r.parent];
        r.vis = p === null ? true : (p.vis && !(collapse && p.finished));
        if (!r.vis) continue;
        var state, badge = null;
        if (r.finished) { state = r.hasSol ? 'done' : 'muted'; if (collapse && r.size > 1) badge = String(r.size); }
        else if (i === top) state = solved ? 'found' : 'active';
        else state = solved ? 'path' : 'frontier';
        out.push(nodeSnap(i, state, badge));
      }
      return out;
    }
    function varsNow(row, col) {
      return { row: row, col: col, cols: sortedNums(cols), d1: sortedNums(cols.map(function (c, r) { return r + c; })), d2: sortedNums(cols.map(function (c, r) { return r - c; })) };
    }
    function emit(kind, o, force) {
      if (capped && !force) return;
      if (!force && steps.length >= cap - 1) { capped = true; return; }
      steps.push({
        kind: kind, n: n, cols: cols.slice(), row: o.row === undefined ? null : o.row, col: o.col === undefined ? null : o.col,
        attacker: o.attacker || null, reason: o.reason || null, removed: o.removed || null, solved: !!o.solved,
        tree: tree(!!o.solved), caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: varsNow(o.row === undefined ? null : o.row, o.col === undefined ? null : o.col),
        counters: { nodes: ct.nodes, checks: ct.checks, backtracks: ct.backtracks, solutions: ct.solutions }
      });
    }

    emit('start', { caption: 'An empty ' + n + '×' + n + ' board. <b>solve(0)</b> fills one row at a time, so every row gets exactly one queen and rows can never clash: only columns and diagonals need checking.', line: 'head', flow: 'start' });

    function why(a, r, c) {
      if (a.kind === 'column') return 'column ' + c + ' already holds the queen from row ' + a.r + ' (<code>' + c + ' ∈ cols</code>)';
      if (a.kind === 'd1') return 'it shares the “/” diagonal with the queen at row ' + a.r + ', column ' + a.c + ': both have row + column = ' + (r + c) + ' (<code>' + (r + c) + ' ∈ d1</code>)';
      return 'it shares the “\\” diagonal with the queen at row ' + a.r + ', column ' + a.c + ': both have row − column = ' + minus(r - c) + ' (<code>' + minus(r - c) + ' ∈ d2</code>)';
    }
    function nextMove(c) { return c + 1 < n ? 'try column ' + (c + 1) : 'nothing is left in this row'; }

    /* returns true when the search should stop (first solution found in first-solution mode) */
    function solve(r, idx) {
      if (r === n) {
        ct.solutions++;
        for (var q = 0; q < path.length; q++) recs[path[q]].hasSol = true;
        if (!firstSolution) firstSolution = cols.slice();
        emit('solution', { row: r - 1, col: cols[r - 1], solved: true, line: 'done', flow: 'record',
          caption: 'All ' + n + ' rows hold a queen and no two attack each other: <b>solution ' + ct.solutions + '</b> (columns ' + cols.join(', ') + '). ' + (all ? 'Record it, then keep searching for more.' : 'Record it and stop: one solution is all we asked for.') });
        return !all;
      }
      var placedHere = 0;
      for (var c = 0; c < n; c++) {
        ct.checks++;
        var a = attackerOf(cols, r, c);
        if (a) {
          emit('conflict', { row: r, col: c, attacker: a, reason: a.kind, line: 'check', flow: 'skip',
            caption: 'Row ' + r + ', column ' + c + ': ' + why(a, r, c) + '. <b>Prune</b>: skip this square, nothing is placed, and ' + nextMove(c) + '.' });
          continue;
        }
        cols.push(c); ct.nodes++; placedHere++;
        var ni = recs.length;
        recs.push({ parent: idx, label: String(c), row: r, col: c, finished: false, hasSol: false, size: 1, key: '', snap: null });
        path.push(ni);
        emit('place', { row: r, col: c, line: 'choose', flow: 'choose',
          caption: 'Row ' + r + ', column ' + c + ' is safe: no queen shares its column or diagonals. <b>Choose</b> it: add the queen and its three keys to the sets, then <b>explore</b> row ' + (r + 1) + (r + 1 === n ? ' (past the last row).' : '.') });
        var stop = solve(r + 1, ni);
        if (stop) return true;
        cols.pop(); path.pop(); ct.backtracks++;
        recs[ni].finished = true; recs[idx].size += recs[ni].size;
        var out = (c + 1 < n) ? 'Next: column ' + (c + 1) + ' in row ' + r + '.' : 'That was the last column of row ' + r + ', so the search will back up again.';
        emit('backtrack', { row: r, col: c, removed: { r: r, c: c }, line: 'unchoose', flow: 'unchoose',
          caption: (r + 1 === n ? 'Row ' + (r + 1) + ' is past the board: the queen at row ' + r + ' was the last one placed. ' : 'Row ' + (r + 1) + ' has no safe column left. ') + '<b>Unchoose</b>: take the queen at row ' + r + ', column ' + c + ' off the board and delete its keys from the sets. ' + out });
      }
      return false;
    }
    var stopped = solve(0, 0);
    recs[0].finished = true;
    path = [0];
    var s = ct.solutions;
    var end = s === 0 ? 'The search is over and no arrangement exists: every branch ended in a dead end.'
      : (stopped ? 'Stopped at the first solution.' : 'The whole tree has been searched: <b>' + s + '</b> solution' + (s === 1 ? '' : 's') + ' exist' + (s === 1 ? 's' : '') + ' for n = ' + n + '.');
    if (capped) {
      steps.push({ kind: 'capped', n: n, cols: [], row: null, col: null, attacker: null, reason: null, removed: null, solved: false,
        tree: tree(false), caption: 'This search is too long to animate step by step, so the trace stops after ' + fmtInt(steps.length) + ' steps. Running to the end: <b>' + fmtInt(ct.nodes) + '</b> nodes explored, <b>' + fmtInt(ct.checks) + '</b> squares checked, <b>' + fmtInt(ct.solutions) + '</b> solutions.',
        line: null, flow: 'ret', vars: varsNow(null, null), counters: { nodes: ct.nodes, checks: ct.checks, backtracks: ct.backtracks, solutions: ct.solutions } });
    } else if (stopped) {
      /* the first-solution run ended on the solution step; keep it as the last frame */
    } else {
      steps.push({ kind: 'done', n: n, cols: [], row: null, col: null, attacker: null, reason: null, removed: null, solved: false,
        tree: tree(false), caption: end, line: null, flow: 'ret', vars: varsNow(null, null),
        counters: { nodes: ct.nodes, checks: ct.checks, backtracks: ct.backtracks, solutions: ct.solutions } });
    }
    return { steps: steps, n: n, capped: capped, solutions: ct.solutions, first: firstSolution, totals: { nodes: ct.nodes, checks: ct.checks, backtracks: ct.backtracks, solutions: ct.solutions } };
  }

  /* ================================================================== brute force vs backtracking: two trees, level by level
     Unpruned tree: every column in every row (nodes ids are the column path, '' = root).
     Pruned tree: only safe squares are explored; each rejected square is kept as a red leaf that stands for a whole
     unpruned subtree (its size is in `skip`). Steps: grow to depth 0..n, then light up one cut, then every cut. */
  function queensTrees(n) {
    if (n < 2 || n > 5) throw new RangeError('n must be from 2 to 5');
    var full = [], pruned = [], cols = [];
    function subtreeSize(depthLeft) { var t = 0, p = 1; for (var i = 0; i <= depthLeft; i++) { t += p; p *= n; } return t; }
    // the full tree: ids are 'r' followed by the column digits of the path
    (function grow(r, id, parentId, keptPath) {
      var safe = keptPath;
      full.push({ id: id, parent: parentId, depth: r, label: r === 0 ? '∅' : id.slice(-1), kept: safe, cutRoot: false });
      if (r === n) return;
      for (var c = 0; c < n; c++) {
        var ok = safe && !attackerOf(cols, r, c);
        var cid = id + c;
        if (ok) { cols.push(c); grow(r + 1, cid, id, true); cols.pop(); }
        else grow(r + 1, cid, id, false);
      }
    }(0, 'r', null, true));
    // mark the roots of cut subtrees: a not-kept node whose parent is kept
    var byId = {}; full.forEach(function (f) { byId[f.id] = f; });
    full.forEach(function (f) { f.cutRoot = !f.kept && f.parent !== null && byId[f.parent].kept; });
    // pruned tree = kept nodes + cut roots as red leaves
    full.forEach(function (f) {
      if (f.kept) pruned.push({ id: f.id, parent: f.parent, depth: f.depth, label: f.label, cut: false, skip: 0 });
      else if (f.cutRoot) pruned.push({ id: f.id, parent: f.parent, depth: f.depth, label: f.label, cut: true, skip: subtreeSize(n - f.depth) });
    });
    var steps = [];
    var keptCount = pruned.filter(function (p) { return !p.cut; }).length, cutTotal = 0;
    pruned.forEach(function (p) { if (p.cut) cutTotal += p.skip; });
    var cutRoots = pruned.filter(function (p) { return p.cut; });
    for (var d = 0; d <= n; d++) {
      var fShown = full.filter(function (f) { return f.depth <= d; }), pShown = pruned.filter(function (p) { return p.depth <= d; });
      steps.push({ kind: 'grow', depth: d, full: fShown.map(function (f) { return { id: f.id, parent: f.parent, label: f.label, state: f.kept ? 'active' : 'default' }; }),
        pruned: pShown.map(function (p) { return { id: p.id, parent: p.parent, label: p.label, state: p.cut ? 'error' : 'active', badge: p.cut ? '−' + p.skip : null }; }),
        counters: { full: fShown.length, pruned: pShown.filter(function (p) { return !p.cut; }).length, cut: pShown.filter(function (p) { return p.cut; }).reduce(function (a, p) { return a + p.skip; }, 0) },
        caption: d === 0 ? 'Both searches start at the empty board: one node.' : 'Depth ' + d + ': brute force tries every column in row ' + (d - 1) + ' below every node, so its level has ' + fmtInt(Math.pow(n, d)) + ' nodes. Backtracking only keeps the ' + pShown.filter(function (p) { return p.depth === d && !p.cut; }).length + ' safe placements; each red leaf is a rejected square whose whole subtree is never built.' });
    }
    // light up one cut, then all cuts, in the full tree
    function cutIds(root) { return full.filter(function (f) { return f.id.indexOf(root) === 0; }).map(function (f) { return f.id; }); }
    var one = cutRoots.filter(function (p) { return p.depth === 2; })[0] || cutRoots[0];
    var lit = {};
    if (one) cutIds(one.id).forEach(function (i) { lit[i] = i === one.id ? 'error' : 'muted'; });
    steps.push({ kind: 'cutone', depth: n, full: full.map(function (f) { return { id: f.id, parent: f.parent, label: f.label, state: lit[f.id] || (f.kept ? 'active' : 'default') }; }),
      pruned: pruned.map(function (p) { return { id: p.id, parent: p.parent, label: p.label, state: p.cut ? (one && p.id === one.id ? 'error' : 'muted') : 'active', badge: p.cut ? '−' + p.skip : null }; }),
      counters: { full: full.length, pruned: keptCount, cut: one ? one.skip : 0 }, focus: one ? one.id : null,
      caption: one ? 'One red leaf, one decision: square (row ' + (one.depth - 1) + ', column ' + one.label + ') is attacked. In the brute-force tree that single rejection removes <b>' + one.skip + '</b> nodes, the whole subtree lit up above.' : 'No rejections at this size.' });
    var litAll = {};
    cutRoots.forEach(function (p) { cutIds(p.id).forEach(function (i) { litAll[i] = i === p.id ? 'error' : 'muted'; }); });
    steps.push({ kind: 'cutall', depth: n, full: full.map(function (f) { return { id: f.id, parent: f.parent, label: f.label, state: litAll[f.id] || 'done' }; }),
      pruned: pruned.map(function (p) { return { id: p.id, parent: p.parent, label: p.label, state: p.cut ? 'error' : 'done', badge: p.cut ? '−' + p.skip : null }; }),
      counters: { full: full.length, pruned: keptCount, cut: cutTotal },
      caption: 'Add them all up: backtracking visits <b>' + keptCount + '</b> of the <b>' + full.length + '</b> nodes. The other ' + fmtInt(cutTotal) + ' sit under red leaves and are never built.' });
    return { steps: steps, fullCount: full.length, keptCount: keptCount, cutTotal: cutTotal, solutions: queensCount(n, true).solutions };
  }

  /* ================================================================== choose sets: subsets, permutations, combinations */
  /* Shared recorder for the three "choose from a list" labs. Every step: tree (all nodes so far), path (the partial
     solution), results, used (permutations), counters. Nodes keep their ids for the whole trace. */
  function makeRecorder(items, cap) {
    var recs = [], path = [], stackIds = [], results = [], steps = [], capped = false, used = [];
    var ct = { calls: 0, results: 0, pruned: 0 };
    function add(id, parent, label, extra) {
      var r = { id: id, parent: parent, label: label, finished: false, found: false, pruned: false, ret: null, key: '', snap: null };
      recs.push(r); return r;
    }
    function snapNode(r, state) {
      var key = state + '|' + (r.ret || '') + '|' + (r.pruned ? 'p' : '');
      if (r.key !== key) { r.key = key; r.snap = { id: r.id, parent: r.parent, label: r.label, state: state, ret: r.ret, pruned: r.pruned }; }
      return r.snap;
    }
    function tree(activeId) {
      var out = [];
      recs.forEach(function (r) {
        var state;
        if (r.pruned) state = 'muted';
        else if (r.id === activeId) state = r.found ? 'found' : 'active';
        else if (r.finished) state = 'done';
        else state = 'frontier';
        out.push(snapNode(r, state));
      });
      return out;
    }
    return {
      recs: recs, path: path, results: results, steps: steps, ct: ct, used: used, add: add,
      isCapped: function () { return capped; },
      emit: function (kind, activeId, o) {
        if (capped) return;
        if (steps.length >= cap) { capped = true; return; }
        steps.push({ kind: kind, tree: tree(activeId), active: activeId, path: path.slice(), results: results.slice(), used: used.slice(),
          caption: o.caption, line: o.line === undefined ? null : o.line, vars: o.vars || {},
          counters: { calls: ct.calls, results: ct.results, pruned: ct.pruned } });
      }
    };
  }
  function itemText(a) { return a.length ? a.join('') : '∅'; }
  function setText(a) { return '{' + a.join(', ') + '}'; }

  /* Subsets by include / exclude: 2^n leaves, one per subset. */
  function subsetsTrace(items) {
    var n = items.length;
    if (n < 1 || n > 5) throw new RangeError('Use 1 to 5 items');
    var R = makeRecorder(items, 4000), path = R.path;
    function go(i, node) {
      R.ct.calls++;
      var item = items[i];
      if (i === n) {
        R.ct.results++; node.found = true; node.ret = itemText(path); R.results.push(path.slice());
        R.emit('record', node.id, { line: 'leaf', caption: 'Every item has been decided, so the partial set <b>' + setText(path) + '</b> is a complete subset. <b>Record</b> it; this leaf is subset number ' + R.ct.results + ' of ' + Math.pow(2, n) + '.', vars: { i: i, path: path.slice() } });
        node.found = false; node.finished = true;
        return;
      }
      // include branch
      path.push(item);
      var inc = R.add(node.id + '+', node.id, '+' + item);
      R.emit('call', inc.id, { line: 'include', caption: (i === 0 ? 'Decide item <b>' + item + '</b> first. ' : 'Now item <b>' + item + '</b>. ') + '<b>Choose</b> it: push it onto the partial set, giving <b>' + setText(path) + '</b>, and recurse on item ' + (i + 1) + '.', vars: { i: i + 1, path: path.slice() } });
      go(i + 1, inc);
      inc.finished = true;
      path.pop();
      R.emit('unchoose', node.id, { line: 'unchoose', caption: 'Everything below “include ' + item + '” is finished. <b>Unchoose</b>: pop ' + item + ' so the partial set is <b>' + setText(path) + '</b> again, ready for the other branch.', vars: { i: i, path: path.slice() } });
      // exclude branch
      var exc = R.add(node.id + '-', node.id, '−' + item);
      R.emit('call', exc.id, { line: 'exclude', caption: 'The other branch: <b>exclude</b> ' + item + '. Nothing is pushed, so the set stays <b>' + setText(path) + '</b>, and we recurse on item ' + (i + 1) + '.', vars: { i: i + 1, path: path.slice() } });
      go(i + 1, exc);
      exc.finished = true;
      node.finished = true;
    }
    var root = R.add('r', null, 'start');
    R.emit('start', 'r', { line: 'head', caption: 'Subsets of <b>' + setText(items) + '</b>: for each item in turn there are two branches, <b>include</b> or <b>exclude</b>. After ' + n + ' decisions the partial set is complete.', vars: { i: 0, path: [] } });
    go(0, root);
    root.finished = true;
    finish(R, 'done', 'Search finished: <b>' + R.ct.results + '</b> subsets, exactly 2<sup>' + n + '</sup>, from a tree of ' + R.recs.length + ' nodes.');
    return { steps: R.steps, results: R.results, capped: R.isCapped(), nodes: R.recs.length };
  }
  function finish(R, kind, caption) {
    // the final frame is always emitted, even when the recording was capped
    R.steps.push({ kind: kind, tree: R.recs.map(function (r) { return { id: r.id, parent: r.parent, label: r.label, state: r.pruned ? 'muted' : 'done', ret: r.ret, pruned: r.pruned }; }),
      active: null, path: [], results: R.results.slice(), used: [], caption: caption, line: null, vars: { path: [] },
      counters: { calls: R.ct.calls, results: R.ct.results, pruned: R.ct.pruned } });
  }

  /* Permutations with a used[] array: n! leaves. */
  function permutationsTrace(items) {
    var n = items.length;
    if (n < 1 || n > 4) throw new RangeError('Use 1 to 4 items');
    var R = makeRecorder(items, 4000), path = R.path, used = R.used;
    for (var u = 0; u < n; u++) used.push(false);
    function go(node) {
      R.ct.calls++;
      if (path.length === n) {
        R.ct.results++; node.found = true; node.ret = itemText(path); R.results.push(path.slice());
        R.emit('record', node.id, { line: 'leaf', caption: 'The path holds all ' + n + ' items: <b>' + itemText(path) + '</b> is a full permutation. <b>Record</b> it (number ' + R.ct.results + ' of ' + factorial(n) + ').', vars: { path: path.slice(), used: used.slice() } });
        node.found = false; node.finished = true;
        return;
      }
      for (var i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true; path.push(items[i]);
        var child = R.add(node.id + i, node.id, items[i]);
        var left = items.filter(function (_, k) { return !used[k]; });
        R.emit('call', child.id, { line: 'choose', caption: '<b>Choose</b> ' + items[i] + ' (used[' + i + '] = true), so the path is <b>' + itemText(path) + '</b>. ' + (left.length ? 'Recurse: the items still free are ' + left.join(', ') + '.' : 'Nothing is left to choose.'), vars: { i: i, path: path.slice(), used: used.slice() } });
        go(child);
        child.finished = true;
        path.pop(); used[i] = false;
        R.emit('unchoose', node.id, { line: 'unchoose', caption: 'Back from ' + items[i] + '. <b>Unchoose</b>: pop it and set used[' + i + '] = false, so it is free again for the next branch.', vars: { i: i, path: path.slice(), used: used.slice() } });
      }
      node.finished = true;
    }
    var root = R.add('r', null, 'start');
    R.emit('start', 'r', { line: 'head', caption: 'Permutations of <b>' + itemText(items) + '</b>: at each level pick any item that is not used yet. Level 1 has ' + n + ' choices, level 2 has ' + (n - 1) + ', and so on: ' + factorial(n) + ' leaves.', vars: { path: [], used: used.slice() } });
    go(root);
    root.finished = true;
    finish(R, 'done', 'Search finished: <b>' + R.ct.results + '</b> permutations, exactly ' + n + '! = ' + factorial(n) + '.');
    return { steps: R.steps, results: R.results, capped: R.isCapped(), nodes: R.recs.length };
  }

  /* Combinations C(n, k) with a bound: give up when too few items remain to fill the set. */
  function combinationsTrace(items, k) {
    var n = items.length;
    if (n < 1 || n > 6) throw new RangeError('Use 1 to 6 items');
    if (k !== Math.floor(k) || k < 0 || k > n) throw new RangeError('k must be a whole number from 0 to ' + n);
    var R = makeRecorder(items, 4000), path = R.path;
    function go(start, node) {
      R.ct.calls++;
      if (path.length === k) {
        R.ct.results++; node.found = true; node.ret = itemText(path); R.results.push(path.slice());
        R.emit('record', node.id, { line: 'leaf', caption: 'The set has ' + k + ' items: <b>' + setText(path) + '</b> is a combination. <b>Record</b> it (number ' + R.ct.results + ' of ' + binom(n, k) + ').', vars: { start: start, path: path.slice() } });
        node.found = false; node.finished = true;
        return;
      }
      var need = k - path.length, have = n - start;
      if (have < need) {
        R.ct.pruned++; node.pruned = true; node.finished = true;
        R.emit('prune', node.id, { line: 'prune', caption: '<b>Prune</b>: ' + need + ' more item' + (need === 1 ? ' is' : 's are') + ' needed but only ' + have + ' remain' + (have === 1 ? 's' : '') + ' (' + (have ? items.slice(start).join(', ') : 'none') + '). No choice below this node can reach size ' + k + ', so return without looping.', vars: { start: start, path: path.slice(), need: need, have: have } });
        return;
      }
      for (var i = start; i < n; i++) {
        path.push(items[i]);
        var child = R.add(node.id + i, node.id, items[i]);
        R.emit('call', child.id, { line: 'choose', caption: '<b>Choose</b> ' + items[i] + ' (index ' + i + '): the set becomes <b>' + setText(path) + '</b>. Recurse with start = ' + (i + 1) + ' so items are never revisited or reordered.', vars: { i: i, start: i + 1, path: path.slice() } });
        go(i + 1, child);
        child.finished = true;
        path.pop();
        R.emit('unchoose', node.id, { line: 'unchoose', caption: 'Back from ' + items[i] + '. <b>Unchoose</b>: pop it, so the set is <b>' + setText(path) + '</b> again, and try the next item.', vars: { i: i, start: start, path: path.slice() } });
      }
      node.finished = true;
    }
    var root = R.add('r', null, 'start');
    R.emit('start', 'r', { line: 'head', caption: 'Combinations: choose <b>' + k + '</b> of <b>' + setText(items) + '</b>. Order does not matter, so a set may only add items to the right of the last one chosen.', vars: { start: 0, path: [] } });
    go(0, root);
    root.finished = true;
    finish(R, 'done', 'Search finished: <b>' + R.ct.results + '</b> combinations, C(' + n + ', ' + k + ') = ' + binom(n, k) + '. The bound pruned ' + R.ct.pruned + ' call' + (R.ct.pruned === 1 ? '' : 's') + '.');
    return { steps: R.steps, results: R.results, capped: R.isCapped(), nodes: R.recs.length, pruned: R.ct.pruned };
  }

  /* References for the three generators (plain, no trace). */
  function subsetsRef(items) { var out = [[]]; items.forEach(function (x) { out = out.concat(out.map(function (s) { return s.concat([x]); })); }); return out; }
  function permutationsRef(items) {
    if (items.length <= 1) return [items.slice()];
    var out = [];
    items.forEach(function (x, i) { permutationsRef(items.slice(0, i).concat(items.slice(i + 1))).forEach(function (p) { out.push([x].concat(p)); }); });
    return out;
  }
  function combinationsRef(items, k) {
    if (k === 0) return [[]];
    var out = [];
    for (var i = 0; i <= items.length - k; i++) combinationsRef(items.slice(i + 1), k - 1).forEach(function (c) { out.push([items[i]].concat(c)); });
    return out;
  }

  /* ================================================================== Sudoku */
  var PUZZLES = {
    easy: { label: 'Easy', text: '003020600900305001001806400008102900700000008006708200002609500800203009005010300' },
    medium: { label: 'Medium', text: '530070000600195000098000060800060003400803001700020006060000280000419005000080079' },
    hard: { label: 'Hard for naive', text: '400000805030000000000700000020000060000080400000010000000603070500200000104000000' },
    empty: { label: 'Empty grid', text: '0'.repeat(81) }
  };
  function textToGrid(t) { var g = []; for (var i = 0; i < 81; i++) g.push(+t.charAt(i)); return g; }

  /* "530070000..." (or dots, spaces, pipes, rows on separate lines) -> {grid: 81 ints, error} */
  function parseSudoku(text) {
    var clean = String(text || '').replace(/[\s|+\-_,]/g, '');
    if (!clean.length) return { grid: null, error: 'Type or paste 81 cells: digits 1–9, with 0 or . for a blank.' };
    var bad = clean.match(/[^0-9.]/);
    if (bad) return { grid: null, error: 'Only the digits 0–9 and “.” are allowed (found “' + bad[0] + '”).' };
    if (clean.length !== 81) return { grid: null, error: 'A Sudoku has 81 cells, but this has ' + clean.length + '.' };
    var g = clean.split('').map(function (ch) { return ch === '.' ? 0 : +ch; });
    for (var i = 0; i < 81; i++) {
      if (!g[i]) continue;
      var r = Math.floor(i / 9), c = i % 9;
      for (var j = i + 1; j < 81; j++) {
        if (g[j] !== g[i]) continue;
        var r2 = Math.floor(j / 9), c2 = j % 9;
        if (r2 === r) return { grid: null, error: 'Row ' + (r + 1) + ' has two ' + g[i] + 's.' };
        if (c2 === c) return { grid: null, error: 'Column ' + (c + 1) + ' has two ' + g[i] + 's.' };
        if (Math.floor(r / 3) === Math.floor(r2 / 3) && Math.floor(c / 3) === Math.floor(c2 / 3)) return { grid: null, error: 'A 3×3 box has two ' + g[i] + 's (rows ' + (r + 1) + ' and ' + (r2 + 1) + ').' };
      }
    }
    return { grid: g, error: null };
  }
  function boxOf(i) { return Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3); }
  function popcount(m) { var c = 0; while (m) { c++; m &= m - 1; } return c; }
  function bitsOf(m) { var out = []; for (var d = 0; d < 9; d++) if (m & (1 << d)) out.push(d + 1); return out; }

  /* Shared solver state: masks of used digits per row, column and box. */
  function makeSolver(grid, order) {
    var g = grid.slice(), rows = [0, 0, 0, 0, 0, 0, 0, 0, 0], cols = rows.slice(), boxes = rows.slice(), empty = 0;
    for (var i = 0; i < 81; i++) {
      if (g[i]) { var b = 1 << (g[i] - 1); rows[Math.floor(i / 9)] |= b; cols[i % 9] |= b; boxes[boxOf(i)] |= b; } else empty++;
    }
    function mask(i) { return (~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)])) & 511; }
    function pick() {
      var best = -1, bc = 10, bm = 0;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = mask(i);
        if (order === 'naive') return { cell: i, mask: m, count: popcount(m) };
        var c = popcount(m);
        if (c < bc) { bc = c; best = i; bm = m; if (c === 0) break; }
      }
      return best < 0 ? { cell: -1, mask: 0, count: 0 } : { cell: best, mask: bm, count: bc };
    }
    function put(i, d) { var b = 1 << (d - 1); g[i] = d; rows[Math.floor(i / 9)] |= b; cols[i % 9] |= b; boxes[boxOf(i)] |= b; empty--; }
    function take(i, d) { var b = 1 << (d - 1); g[i] = 0; rows[Math.floor(i / 9)] &= ~b; cols[i % 9] &= ~b; boxes[boxOf(i)] &= ~b; empty++; }
    return { g: g, mask: mask, pick: pick, put: put, take: take, empty: function () { return empty; } };
  }
  /* Attempts (digits placed) and whether the search finished, with a node cap. No trace. */
  function sudokuCount(grid, order, nodeCap) {
    nodeCap = nodeCap || 1e6;
    var S = makeSolver(grid, order), attempts = 0, backtracks = 0, aborted = false;
    function go() {
      var p = S.pick();
      if (p.cell < 0) return true;
      for (var d = 1; d <= 9; d++) {
        if (!(p.mask & (1 << (d - 1)))) continue;
        if (attempts >= nodeCap) { aborted = true; return false; }
        attempts++; S.put(p.cell, d);
        if (go()) return true;
        if (aborted) return false;
        S.take(p.cell, d); backtracks++;
      }
      return false;
    }
    var ok = go();
    return { solved: ok, attempts: attempts, backtracks: backtracks, aborted: aborted, grid: S.g.slice() };
  }
  /* Plain reference: the slow textbook solver, first empty cell, digits 1-9 with a full validity scan. */
  function solveSudoku(grid) {
    var g = grid.slice();
    function ok(i, d) {
      var r = Math.floor(i / 9), c = i % 9;
      for (var k = 0; k < 9; k++) {
        if (g[r * 9 + k] === d || g[k * 9 + c] === d) return false;
        var br = Math.floor(r / 3) * 3 + Math.floor(k / 3), bc = Math.floor(c / 3) * 3 + k % 3;
        if (g[br * 9 + bc] === d) return false;
      }
      return true;
    }
    function go(i) {
      while (i < 81 && g[i]) i++;
      if (i === 81) return true;
      for (var d = 1; d <= 9; d++) if (ok(i, d)) { g[i] = d; if (go(i + 1)) return true; g[i] = 0; }
      return false;
    }
    return go(0) ? g : null;
  }
  function isValidSolution(g) {
    for (var u = 0; u < 9; u++) {
      var r = 0, c = 0, b = 0;
      for (var k = 0; k < 9; k++) {
        r |= 1 << (g[u * 9 + k] - 1); c |= 1 << (g[k * 9 + u] - 1);
        b |= 1 << (g[(Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + k % 3] - 1);
      }
      if (r !== 511 || c !== 511 || b !== 511) return false;
    }
    return true;
  }

  /* The trace: pick a cell, place each candidate digit in turn, recurse, erase on failure.
     order: 'naive' (reading order) or 'mrv' (fewest candidates first). */
  function sudoku(grid, opts) {
    opts = opts || {};
    var order = opts.order === 'naive' ? 'naive' : 'mrv', cap = opts.cap || 2400, nodeCap = opts.nodeCap || 1e6;
    var S = makeSolver(grid, order), given = grid.map(function (v) { return v > 0; });
    var steps = [], capped = false, attempts = 0, backtracks = 0, aborted = false, lastFail = null;
    function cands() { var m = new Uint16Array(81); for (var i = 0; i < 81; i++) m[i] = S.g[i] ? 0 : S.mask(i); return m; }
    function ct() { return { attempts: attempts, backtracks: backtracks, empty: S.empty() }; }
    function emit(kind, o, force) {
      if (capped && !force) return;
      if (!force && steps.length >= cap - 1) { capped = true; return; }
      steps.push({ kind: kind, grid: S.g.slice(), given: given, cand: cands(), focus: o.focus === undefined ? -1 : o.focus,
        focusMask: o.focusMask || 0, digit: o.digit || 0, count: o.count === undefined ? null : o.count, order: order,
        caption: o.caption, line: o.line === undefined ? null : o.line, vars: o.vars || {}, counters: ct() });
    }
    function cellName(i) { return '(' + Math.floor(i / 9) + ', ' + (i % 9) + ')'; }
    emit('start', { line: 'head', caption: (order === 'mrv' ? 'Most-constrained-first' : 'Naive order') + ' search on a puzzle with ' + S.empty() + ' empty cells. Faint digits are the candidates: the digits not yet used in the cell’s row, column or box.', vars: { empty: S.empty() } });
    function go() {
      var p = S.pick();
      if (p.cell < 0) return true;
      var list = bitsOf(p.mask);
      var why = order === 'mrv'
        ? (p.count === 0 ? 'Cell ' + cellName(p.cell) + ' has <b>no candidates</b>: the search spots the dead end before placing anything.'
          : p.count === 1 ? 'Cell ' + cellName(p.cell) + ' has exactly one candidate, <b>' + list[0] + '</b>: a forced move, no branching at all.'
            : 'Cell ' + cellName(p.cell) + ' has only <b>' + p.count + '</b> candidates (' + list.join(', ') + '), the fewest of any empty cell. Fewer choices means fewer branches, so it goes first.')
        : (p.count === 0 ? 'Reading order reaches cell ' + cellName(p.cell) + ' and no digit fits: a dead end.'
          : 'Reading order: the first empty cell is ' + cellName(p.cell) + ', with ' + p.count + ' candidate' + (p.count === 1 ? '' : 's') + ' (' + list.join(', ') + '). It is picked without looking at how constrained it is.');
      emit('pick', { focus: p.cell, focusMask: p.mask, count: p.count, line: p.count === 0 ? 'dead' : 'pick', caption: why, vars: { cell: [Math.floor(p.cell / 9), p.cell % 9], candidates: list } });
      if (p.count === 0) { lastFail = 'dead'; return false; }
      for (var k = 0; k < list.length; k++) {
        var d = list[k];
        if (attempts >= nodeCap) { aborted = true; return false; }
        attempts++; S.put(p.cell, d);
        emit('place', { focus: p.cell, digit: d, focusMask: p.mask, count: p.count, line: 'choose',
          caption: 'Try <b>' + d + '</b> in ' + cellName(p.cell) + ' (candidate ' + (k + 1) + ' of ' + p.count + '). No row, column or box holds a ' + d + ', so <b>choose</b> it and move on to the next cell.',
          vars: { cell: [Math.floor(p.cell / 9), p.cell % 9], digit: d, candidates: list } });
        if (go()) return true;
        if (aborted) return false;
        S.take(p.cell, d); backtracks++;
        emit('erase', { focus: p.cell, digit: d, line: 'unchoose', focusMask: p.mask, count: p.count,
          caption: (lastFail === 'dead' ? 'The next cell has no candidates left, so ' : 'Every digit failed further down, so ') + '<b>' + d + '</b> at ' + cellName(p.cell) + ' leads nowhere. <b>Unchoose</b>: erase it' + (k + 1 < list.length ? ' and try ' + list[k + 1] + ' next.' : '. It was the last candidate here, so this cell fails too and the search backs up again.'),
          vars: { cell: [Math.floor(p.cell / 9), p.cell % 9], digit: d, candidates: list } });
        lastFail = 'exhausted';
      }
      lastFail = 'exhausted';
      return false;
    }
    var solved = go();
    var total = ct();
    if (capped) {
      emit(solved ? 'summary' : (aborted ? 'gaveup' : 'nosolution'), { line: null, caption: 'The full search is too long to animate, so the trace stops after ' + fmtInt(steps.length) + ' steps. Run to the end (not shown): ' + (solved ? 'the puzzle is <b>solved</b>' : aborted ? 'the search <b>gave up</b>' : 'the search <b>proves there is no solution</b>') + ' after <b>' + fmtInt(attempts) + '</b> digits placed and <b>' + fmtInt(backtracks) + '</b> erased' + (aborted ? ' (limit ' + fmtInt(nodeCap) + ')' : '') + '.' }, true);
    } else if (solved) {
      emit('solved', { line: 'done', caption: 'No empty cell is left, so the grid is a valid solution: <b>' + fmtInt(attempts) + '</b> digits placed, <b>' + fmtInt(backtracks) + '</b> erased.' }, true);
    } else {
      emit(aborted ? 'gaveup' : 'nosolution', { line: null, caption: aborted ? 'Gave up after ' + fmtInt(attempts) + ' placements.' : 'Every branch failed: this puzzle has <b>no solution</b> (' + fmtInt(attempts) + ' digits placed, ' + fmtInt(backtracks) + ' erased).' }, true);
    }
    return { steps: steps, solved: solved, aborted: aborted, capped: capped, attempts: attempts, backtracks: backtracks, grid: S.g.slice(), total: total };
  }

  /* ================================================================== Word search */
  var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  var DIR_NAME = ['right', 'down', 'left', 'up'];

  /* rows: array of equal-length strings (upper case). Standard "does the word exist as a path of adjacent cells". */
  function wordSearchRef(rows, word) {
    var R = rows.length, C = R ? rows[0].length : 0, seen = [];
    for (var i = 0; i < R; i++) seen.push(new Array(C).fill(false));
    function dfs(r, c, k) {
      if (r < 0 || c < 0 || r >= R || c >= C || seen[r][c] || rows[r][c] !== word[k]) return false;
      if (k === word.length - 1) return true;
      seen[r][c] = true;
      for (var d = 0; d < 4; d++) if (dfs(r + DIRS[d][0], c + DIRS[d][1], k + 1)) { seen[r][c] = false; return true; }
      seen[r][c] = false;
      return false;
    }
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (dfs(r, c, 0)) return true;
    return false;
  }
  /* Calls made by the plain search (count only), stopped at nodeCap. */
  function wordSearchCount(rows, word, nodeCap) {
    nodeCap = nodeCap || 200000;
    var R = rows.length, C = rows[0].length, seen = [], calls = 0, aborted = false;
    for (var i = 0; i < R; i++) seen.push(new Array(C).fill(false));
    function dfs(r, c, k) {
      calls++;
      if (calls > nodeCap) { aborted = true; return false; }
      if (r < 0 || c < 0 || r >= R || c >= C || seen[r][c] || rows[r][c] !== word[k]) return false;
      if (k === word.length - 1) return true;
      seen[r][c] = true;
      for (var d = 0; d < 4; d++) if (dfs(r + DIRS[d][0], c + DIRS[d][1], k + 1)) { seen[r][c] = false; return true; }
      seen[r][c] = false;
      return false;
    }
    var found = false;
    for (var r = 0; r < R && !found && !aborted; r++) for (var c = 0; c < C && !found && !aborted; c++) found = dfs(r, c, 0);
    return { found: found, calls: calls, aborted: aborted };
  }

  function parseWordGrid(text, word) {
    var rows = String(text || '').toUpperCase().split(/[\n,;\/]+/).map(function (s) { return s.replace(/\s+/g, ''); }).filter(function (s) { return s.length; });
    var w = String(word || '').toUpperCase().replace(/\s+/g, '');
    if (!rows.length) return { rows: null, word: null, error: 'Type the grid, one row per line or rows separated by commas (for example ABCE, SFCS, ADEE).' };
    if (rows.some(function (r) { return /[^A-Z]/.test(r); })) return { rows: null, word: null, error: 'Use letters A–Z only.' };
    if (rows.some(function (r) { return r.length !== rows[0].length; })) return { rows: null, word: null, error: 'Every row needs the same number of letters.' };
    if (rows.length > 6 || rows[0].length > 6) return { rows: null, word: null, error: 'Keep the grid to 6 rows × 6 columns so the search stays readable.' };
    if (!w) return { rows: null, word: null, error: 'Type the word to find.' };
    if (/[^A-Z]/.test(w)) return { rows: null, word: null, error: 'The word may use letters A–Z only.' };
    if (w.length > 12) return { rows: null, word: null, error: 'Use a word of at most 12 letters.' };
    return { rows: rows, word: w, error: null };
  }

  /* Trace: for every start cell, DFS along adjacent cells (right, down, left, up); a cell on the path cannot be reused. */
  function wordSearch(rows, word, opts) {
    opts = opts || {};
    var cap = opts.cap || 2500, nodeCap = opts.nodeCap || 200000;
    var R = rows.length, C = rows[0].length, L = word.length;
    var seen = [], path = [], steps = [], capped = false, aborted = false, found = false, foundPath = null;
    for (var i = 0; i < R; i++) seen.push(new Array(C).fill(false));
    var ct = { calls: 0, matches: 0, backtracks: 0 };
    var counters = function () { return { calls: ct.calls, matches: ct.matches, backtracks: ct.backtracks }; };
    function emit(kind, o, force) {
      if (capped && !force) return;
      if (!force && steps.length >= cap - 1) { capped = true; return; }
      steps.push({ kind: kind, rows: rows, word: word, path: path.map(function (p) { return p.slice(); }), cursor: o.cursor || null, bad: o.bad || null, matched: path.length,
        found: !!o.found, caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow || null, vars: o.vars || {}, counters: counters() });
    }
    function pathText() { return path.map(function (p) { return rows[p[0]][p[1]]; }).join(''); }
    emit('start', { line: 'head', caption: 'Find <b>' + esc(word) + '</b> as a path of neighbouring cells (right, down, left, up), using each cell at most once. Try every cell as a start, and from each one explore as far as the letters keep matching.', vars: { word: word, k: 0 } });
    function dfs(r, c, k, from) {
      ct.calls++;
      if (ct.calls > nodeCap) { aborted = true; return false; }
      if (r < 0 || c < 0 || r >= R || c >= C) return false;
      if (seen[r][c]) {
        emit('reject', { cursor: [r, c], bad: [r, c], line: 'reject', vars: { r: r, c: c, k: k }, caption: 'Cell (' + r + ', ' + c + ') is already on the path, and a cell may not be used twice. <b>Reject</b>.' });
        return false;
      }
      if (rows[r][c] !== word[k]) {
        emit('reject', { cursor: [r, c], bad: [r, c], line: 'reject', vars: { r: r, c: c, k: k, 'word[k]': word[k] },
          caption: 'Cell (' + r + ', ' + c + ') holds <b>' + rows[r][c] + '</b> but letter ' + k + ' of the word is <b>' + word[k] + '</b>. <b>Reject</b>: nothing on this route can spell the word, so it is cut off here.' });
        return false;
      }
      ct.matches++;
      seen[r][c] = true; path.push([r, c]);
      if (k === L - 1) {
        found = true; foundPath = path.map(function (p) { return p.slice(); });
        emit('found', { cursor: [r, c], found: true, line: 'found', flow: 'record', vars: { r: r, c: c, k: k }, caption: 'Letter ' + k + ' is <b>' + word[k] + '</b>, the last one. The path spells <b>' + esc(pathText()) + '</b>: found.' });
        return true;
      }
      emit('match', { cursor: [r, c], line: 'choose', vars: { r: r, c: c, k: k, path: pathText() },
        caption: 'Cell (' + r + ', ' + c + ') holds <b>' + rows[r][c] + '</b>, matching letter ' + k + '. <b>Choose</b> it: mark it as used, then explore its neighbours for letter ' + (k + 1) + ' (<b>' + word[k + 1] + '</b>).' });
      for (var d = 0; d < 4; d++) {
        if (dfs(r + DIRS[d][0], c + DIRS[d][1], k + 1)) return true;
        if (aborted) return false;
      }
      seen[r][c] = false; path.pop(); ct.backtracks++;
      emit('backtrack', { cursor: [r, c], line: 'unchoose', vars: { r: r, c: c, k: k, path: pathText() },
        caption: 'None of the four neighbours of (' + r + ', ' + c + ') continues the word. <b>Unchoose</b>: free the cell and step back to ' + (path.length ? 'the previous cell, which tries its next direction.' : 'the start scan.') });
      return false;
    }
    outer:
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (dfs(r, c, 0)) break outer;
      if (aborted) break outer;
    }
    if (capped || aborted) {
      emit(found ? 'found' : 'summary', { found: found, line: null, flow: 'ret', caption: 'The search is too long to animate, so the trace stops here. Run to the end: ' + (aborted ? 'still searching after <b>' + fmtInt(ct.calls) + '</b> calls, so the search was stopped' : found ? 'the word <b>was found</b> after <b>' + fmtInt(ct.calls) + '</b> calls' : 'the word is <b>not in the grid</b>, after <b>' + fmtInt(ct.calls) + '</b> calls') + '.' }, true);
      if (found) { steps[steps.length - 1].path = foundPath; steps[steps.length - 1].matched = foundPath.length; }
    } else if (!found) {
      emit('done', { line: null, flow: 'ret', caption: 'Every start cell has been tried and every route dead-ended: <b>' + esc(word) + '</b> is not in the grid (' + fmtInt(ct.calls) + ' calls).' }, true);
    }
    return { steps: steps, found: found, capped: capped, aborted: aborted, calls: ct.calls, path: foundPath };
  }

  /* ================================================================== the maze of forks (the analogy figure) */
  /* A small maze as a tree. Depth-first with chalk: walk into a branch, hit a dead end, walk back to the last fork
     that still has an untried branch. Node states: active = you are here, frontier = a fork on your way (has
     untried branches), muted = explored dead end, done = every branch tried, found = the exit. */
  var MAZE = {
    id: 'f', kids: [
      { id: 'a', kids: [{ id: 'a1', kids: [] }, { id: 'a2', kids: [{ id: 'a2a', kids: [] }, { id: 'a2b', kids: [] }] }] },
      { id: 'b', kids: [{ id: 'b1', kids: [{ id: 'b1a', kids: [] }, { id: 'b1b', kids: [], goal: true }] }, { id: 'b2', kids: [] }] },
      { id: 'c', kids: [] }
    ]
  };
  function mazeWalk(spec) {
    spec = spec || MAZE;
    var flat = [], state = {}, steps = [], visited = 0, deadEnds = 0, backs = 0, found = false;
    (function walk(nd, parent) { flat.push({ id: nd.id, parent: parent, kids: nd.kids.map(function (k) { return k.id; }), goal: !!nd.goal, label: nd.goal ? 'exit' : (nd.kids.length ? '' : '') }); nd.kids.forEach(function (k) { walk(k, nd.id); }); }(spec, null));
    var byId = {}; flat.forEach(function (f) { byId[f.id] = f; });
    var onPath = [];
    function snap(kind, at, caption) {
      var nodes = flat.filter(function (f) { return state[f.id] !== undefined || f.parent === null || (state[f.parent] !== undefined); })
        .map(function (f) { return { id: f.id, parent: f.parent, kids: f.kids, goal: f.goal, state: f.id === at ? (found ? 'found' : (kind === 'dead' ? 'error' : 'active')) : (found && onPath.indexOf(f.id) >= 0 ? 'path' : (state[f.id] || 'default')) }; });
      steps.push({ kind: kind, at: at, nodes: nodes, path: onPath.slice(), caption: caption, counters: { visited: visited, deadEnds: deadEnds, backtracks: backs } });
    }
    function go(nd) {
      visited++;
      state[nd.id] = 'frontier'; onPath.push(nd.id);
      if (nd.goal) { found = true; snap('exit', nd.id, 'The exit! The chalk marks on the path from the entrance show the answer. Everything else was explored and abandoned.'); return true; }
      if (!nd.kids.length) {
        deadEnds++;
        snap('dead', nd.id, 'A dead end: no corridors lead on. Nothing to do here but turn around.');
        state[nd.id] = 'muted'; onPath.pop(); backs++;
        return false;
      }
      snap(nd === spec ? 'enter' : 'fork', nd.id, nd === spec ? 'You stand at the entrance, a fork with ' + nd.kids.length + ' corridors. Take the leftmost one and keep going deeper.' : 'A fork with ' + nd.kids.length + ' corridor' + (nd.kids.length === 1 ? '' : 's') + '. Depth first: take the leftmost untried one.');
      for (var k = 0; k < nd.kids.length; k++) {
        if (go(nd.kids[k])) return true;
        // returned from a failed child: we are back at nd
        if (k + 1 < nd.kids.length) snap('back', nd.id, 'Back at the fork. That corridor is fully explored and marked as a dead end, so <b>unchoose</b> it and take the next one.');
      }
      state[nd.id] = 'done'; onPath.pop(); backs++;
      snap('exhausted', onPath.length ? onPath[onPath.length - 1] : nd.id, 'Every corridor from that fork failed, so the fork itself is a dead end. Walk back to the previous fork.');
      return false;
    }
    snap('start', null, 'A maze of forks. Somewhere is an exit. You have chalk, and one rule: go as deep as you can, and when you are stuck, walk back to the last fork with an untried corridor.');
    go(spec);
    return { steps: steps, nodes: flat, found: found };
  }

  /* ================================================================== parse: a short list of item names */
  function parseItems(text, opts) {
    opts = opts || {};
    var max = opts.max || 5, min = opts.min || 1;
    var parts = String(text || '').split(/[\s,;]+/).filter(function (s) { return s.length; });
    if (parts.length < min) return { values: null, error: 'Type ' + (min === 1 ? 'at least one item' : min + ' or more items') + ', for example a b c.' };
    if (parts.length > max) return { values: null, error: 'Use at most ' + max + ' items, so the tree stays readable (' + parts.length + ' given).' };
    if (parts.some(function (p) { return p.length > 3; })) return { values: null, error: 'Keep each item to 3 characters or fewer.' };
    var seen = {};
    for (var i = 0; i < parts.length; i++) { if (seen[parts[i]]) return { values: null, error: 'Items must be different (“' + parts[i] + '” appears twice).' }; seen[parts[i]] = true; }
    return { values: parts, error: null };
  }

  return {
    attackerOf: attackerOf, attackedCells: attackedCells, pairsAttacking: pairsAttacking,
    queens: queens, queensCount: queensCount, queensSolutions: queensSolutions, bruteForce: bruteForce, queensTrees: queensTrees,
    subsetsTrace: subsetsTrace, permutationsTrace: permutationsTrace, combinationsTrace: combinationsTrace,
    subsetsRef: subsetsRef, permutationsRef: permutationsRef, combinationsRef: combinationsRef,
    PUZZLES: PUZZLES, textToGrid: textToGrid, parseSudoku: parseSudoku, sudoku: sudoku, sudokuCount: sudokuCount, solveSudoku: solveSudoku, isValidSolution: isValidSolution,
    wordSearch: wordSearch, wordSearchRef: wordSearchRef, wordSearchCount: wordSearchCount, parseWordGrid: parseWordGrid, DIR_NAME: DIR_NAME,
    mazeWalk: mazeWalk, MAZE: MAZE, parseItems: parseItems, fmtInt: fmtInt, binom: binom, factorial: factorial
  };
}));
