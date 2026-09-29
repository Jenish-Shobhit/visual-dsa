// Lesson 33 · Backtracking — step generator tests.
// Run: node --test tests/algos/33-backtracking.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const A = require(path.join(root, 'js/algos/33-backtracking.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

const SOLUTION_COUNTS = [1, 0, 0, 2, 10, 4, 40, 92];   // n = 1..8

function frozen(steps) {   // steps must be plain snapshots (no shared mutation): serialise twice, compare
  return JSON.stringify(steps);
}
function lastOf(steps, kind) { for (let i = steps.length - 1; i >= 0; i--) if (steps[i].kind === kind) return steps[i]; return null; }
function isSafeBoard(cols) {
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) if (cols[i] === cols[j] || Math.abs(cols[i] - cols[j]) === j - i) return false;
  return true;
}

/* ------------------------------------------------------------------ N-Queens */
test('queens: solution counts match the known sequence and the brute-force reference', () => {
  for (let n = 1; n <= 8; n++) {
    assert.equal(A.queensCount(n, true).solutions, SOLUTION_COUNTS[n - 1], 'count n=' + n);
    assert.equal(A.queensSolutions(n).length, SOLUTION_COUNTS[n - 1], 'reference n=' + n);
    const t = A.queens(n, { all: true, cap: 100000 });
    assert.equal(t.solutions, SOLUTION_COUNTS[n - 1], 'trace n=' + n);
    assert.ok(!t.capped);
  }
});

test('queens: every recorded solution is valid, distinct and in the reference set', () => {
  for (let n = 4; n <= 7; n++) {
    const ref = new Set(A.queensSolutions(n).map(s => s.join(',')));
    const t = A.queens(n, { all: true, cap: 100000 });
    const seen = new Set();
    t.steps.filter(s => s.kind === 'solution').forEach(s => {
      assert.equal(s.cols.length, n);
      assert.ok(isSafeBoard(s.cols), 'safe');
      assert.ok(ref.has(s.cols.join(',')), 'in reference');
      seen.add(s.cols.join(','));
    });
    assert.equal(seen.size, ref.size);
  }
});

test('queens: first-solution trace stops at the lexicographically first solution', () => {
  for (let n = 1; n <= 10; n++) {
    const t = A.queens(n);
    const ref = A.queensSolutions(n <= 8 ? n : 8);
    if (n === 2 || n === 3) {
      assert.equal(t.solutions, 0);
      assert.equal(t.steps[t.steps.length - 1].kind, 'done');
      assert.equal(t.first, null);
    } else {
      assert.equal(t.solutions, 1);
      const last = t.steps[t.steps.length - 1];
      assert.equal(last.kind, 'solution');
      assert.ok(isSafeBoard(last.cols));
      assert.equal(last.cols.length, n);
      if (n <= 8) assert.deepEqual(last.cols, ref[0]);
    }
  }
});

test('queens: counters match queensCount and the counters never decrease', () => {
  for (let n = 3; n <= 8; n++) for (const all of [false, true]) {
    const t = A.queens(n, { all, cap: 100000 });
    const c = A.queensCount(n, all);
    const last = t.steps[t.steps.length - 1].counters;
    assert.equal(last.nodes, c.nodes, 'nodes n=' + n + ' all=' + all);
    assert.equal(last.checks, c.checks, 'checks');
    assert.equal(last.solutions, c.solutions);
    for (let i = 1; i < t.steps.length; i++) {
      ['nodes', 'checks', 'backtracks', 'solutions'].forEach(k => assert.ok(t.steps[i].counters[k] >= t.steps[i - 1].counters[k], k));
    }
    assert.deepEqual(Object.keys(t.steps[0].counters), ['nodes', 'checks', 'backtracks', 'solutions']);
  }
});

test('queens: visual states are truthful (place only on safe squares, conflict only on attacked ones)', () => {
  const t = A.queens(6, { all: true, cap: 100000 });
  let prev = null;
  t.steps.forEach((s, i) => {
    if (s.kind === 'conflict') {
      const before = s.cols;      // the queens that were on the board when the square was examined
      assert.equal(before.length, s.row);
      assert.ok(A.attackerOf(before, s.row, s.col), 'square really is attacked');
      assert.ok(s.attacker && s.attacker.r < s.row);
      const a = s.attacker;
      if (a.kind === 'column') assert.equal(a.c, s.col);
      if (a.kind === 'd1') assert.equal(a.r + a.c, s.row + s.col);
      if (a.kind === 'd2') assert.equal(a.r - a.c, s.row - s.col);
    }
    if (s.kind === 'place') {
      assert.equal(s.cols.length, s.row + 1);
      assert.equal(s.cols[s.row], s.col);
      assert.ok(isSafeBoard(s.cols));
    }
    if (s.kind === 'backtrack') {
      assert.equal(prev.cols.length, s.cols.length + 1, 'exactly one queen removed');
      assert.deepEqual(s.cols, prev.cols.slice(0, -1));
      assert.deepEqual(s.removed, { r: s.row, c: s.col });
    }
    assert.ok(isSafeBoard(s.cols), 'board never holds two attacking queens');
    prev = s;
  });
});

test('queens: constraint sets in vars agree with the board', () => {
  const t = A.queens(5, { all: true, cap: 100000 });
  t.steps.forEach(s => {
    assert.deepEqual(s.vars.cols, s.cols.slice().sort((a, b) => a - b));
    assert.deepEqual(s.vars.d1, s.cols.map((c, r) => r + c).sort((a, b) => a - b));
    assert.deepEqual(s.vars.d2, s.cols.map((c, r) => r - c).sort((a, b) => a - b));
  });
});

test('queens: tree snapshots are consistent (parents exist, one active leaf, collapse hides finished subtrees)', () => {
  for (const collapse of [true, false]) {
    const t = A.queens(5, { all: true, cap: 100000, collapse });
    t.steps.forEach(s => {
      const ids = new Set(s.tree.map(x => x.id));
      s.tree.forEach(x => { if (x.parent !== null) assert.ok(ids.has(x.parent), 'parent visible'); });
      if (['place', 'conflict', 'backtrack', 'start'].includes(s.kind)) assert.equal(s.tree.filter(x => x.state === 'active').length, 1);
      if (collapse) s.tree.forEach(x => { if (x.parent !== null) { const p = s.tree.find(y => y.id === x.parent); assert.ok(p.state !== 'muted' && p.state !== 'done', 'no child under a collapsed node'); } });
    });
    const end = t.steps[t.steps.length - 1];
    if (collapse) { assert.equal(end.tree.length, 1); assert.equal(end.tree[0].badge, String(A.queensCount(5, true).nodes)); }
    else assert.equal(end.tree.length, A.queensCount(5, true).nodes);
  }
});

test('queens: n = 1 has a single solution; n = 2 and 3 have none; bad n throws', () => {
  const one = A.queens(1);
  assert.deepEqual(one.steps.map(s => s.kind), ['start', 'place', 'solution']);
  const two = A.queens(2), three = A.queens(3);
  assert.equal(two.solutions, 0); assert.equal(three.solutions, 0);
  assert.equal(two.steps[two.steps.length - 1].kind, 'done');
  assert.throws(() => A.queens(0)); assert.throws(() => A.queens(13)); assert.throws(() => A.queens(2.5));
});

test('queens: long searches are capped, summarised, and totals stay truthful', () => {
  const t = A.queens(8, { all: true, cap: 300 });
  assert.ok(t.capped);
  assert.ok(t.steps.length <= 301);
  const last = t.steps[t.steps.length - 1];
  assert.equal(last.kind, 'capped');
  const ref = A.queensCount(8, true);
  assert.equal(last.counters.nodes, ref.nodes);
  assert.equal(last.counters.solutions, 92);
  // step lists are bounded for every lab size, first-solution mode
  for (let n = 4; n <= 10; n++) assert.ok(A.queens(n).steps.length < 3000, 'n=' + n);
  // recorded steps are never mutated after the fact
  const a = frozen(A.queens(6, { all: true }).steps), b = frozen(A.queens(6, { all: true }).steps);
  assert.equal(a, b);
});

test('queensCount: known node counts', () => {
  assert.equal(A.queensCount(4, true).nodes, 17);
  assert.equal(A.queensCount(8, true).nodes, 2057);
  assert.equal(A.queensCount(8, false).nodes, 114);
  assert.equal(A.queensCount(8, true).checks, 15720);
});

test('bruteForce and queensTrees: sizes add up', () => {
  const b = A.bruteForce(8);
  assert.equal(b.choose, 4426165368);
  assert.equal(b.rows, 16777216);
  assert.equal(b.perms, 40320);
  assert.equal(A.bruteForce(4).fullTree, 341);
  for (const n of [3, 4, 5]) {
    const T = A.queensTrees(n);
    assert.equal(T.fullCount, A.bruteForce(n).fullTree);
    assert.equal(T.keptCount, A.queensCount(n, true).nodes);
    assert.equal(T.keptCount + T.cutTotal, T.fullCount, 'every full-tree node is either explored or under a cut');
    const last = T.steps[T.steps.length - 1];
    assert.equal(last.kind, 'cutall');
    assert.equal(last.full.length, T.fullCount);
    assert.equal(last.full.filter(x => x.state === 'done').length, T.keptCount);
    assert.equal(T.steps[0].full.length, 1);
    for (let i = 1; i < T.steps.length; i++) assert.ok(T.steps[i].full.length >= T.steps[i - 1].full.length);
  }
  assert.throws(() => A.queensTrees(6));
});

test('attackedCells and pairsAttacking', () => {
  const g = A.attackedCells([[0, 0]], 4);
  assert.equal(g.filter(Boolean).length, 4 + 3 + 3);       // row + column + diagonal, own square counted once
  assert.deepEqual(A.pairsAttacking([[0, 1], [1, 3], [2, 0]]), []);
  assert.equal(A.pairsAttacking([[0, 0], [1, 1]]).length, 1);
  assert.equal(A.pairsAttacking([[0, 0], [0, 3], [3, 3]]).length, 3);
});

/* ------------------------------------------------------------------ subsets, permutations, combinations */
const sortKey = a => a.map(x => x.join('')).sort();
const ITEM_SETS = [['a'], ['a', 'b'], ['x', 'y', 'z'], ['a', 'b', 'c', 'd'], ['p', 'q', 'r', 'd', 'e']];

test('subsets: results equal the reference, 2^n of them, no duplicates', () => {
  ITEM_SETS.forEach(items => {
    const t = A.subsetsTrace(items);
    assert.equal(t.results.length, 2 ** items.length);
    assert.deepEqual(sortKey(t.results), sortKey(A.subsetsRef(items)));
    assert.equal(new Set(t.results.map(r => r.join(','))).size, t.results.length);
    const last = t.steps[t.steps.length - 1];
    assert.equal(last.kind, 'done');
    assert.equal(last.counters.results, 2 ** items.length);
    assert.equal(last.counters.calls, 2 ** (items.length + 1) - 1);
    assert.equal(t.nodes, 2 ** (items.length + 1) - 1);
  });
});
test('subsets: the partial path is always the items chosen on the way down', () => {
  const items = ['a', 'b', 'c'];
  const t = A.subsetsTrace(items);
  t.steps.forEach(s => {
    if (!s.active) return;
    const rec = s.tree.find(x => x.id === s.active);
    // reconstruct include decisions from the node id: 'r' then '+'/'-' per item
    const decisions = s.active.slice(1).split('');
    const expect = decisions.map((d, i) => d === '+' ? items[i] : null).filter(Boolean);
    if (s.kind !== 'unchoose') assert.deepEqual(s.path, expect, s.kind + ' ' + s.active);
    assert.ok(rec);
  });
});
test('permutations: results equal the reference, n! of them', () => {
  ITEM_SETS.slice(0, 4).forEach(items => {
    const t = A.permutationsTrace(items);
    assert.equal(t.results.length, A.factorial(items.length));
    assert.deepEqual(sortKey(t.results), sortKey(A.permutationsRef(items)));
    assert.equal(new Set(t.results.map(r => r.join(''))).size, t.results.length);
    // used[] always agrees with the path
    t.steps.forEach(s => { if (s.kind === 'call' || s.kind === 'record' || s.kind === 'unchoose') assert.equal(s.used.filter(Boolean).length, s.path.length); });
  });
  assert.throws(() => A.permutationsTrace(['a', 'b', 'c', 'd', 'e']));
});
test('combinations: results equal the reference; bound prunes hopeless calls', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  for (let k = 0; k <= 5; k++) {
    const t = A.combinationsTrace(items, k);
    assert.deepEqual(sortKey(t.results), sortKey(A.combinationsRef(items, k)), 'k=' + k);
    assert.equal(t.results.length, A.binom(5, k));
    t.steps.filter(s => s.kind === 'prune').forEach(s => {
      const node = s.tree.find(x => x.id === s.active);
      assert.ok(node.pruned);
      assert.ok(items.length - (s.vars.start) < k - s.path.length, 'prune only when too few items remain');
    });
  }
  assert.ok(A.combinationsTrace(items, 4).pruned > 0);
  assert.equal(A.combinationsTrace(items, 1).pruned, 0);
  assert.throws(() => A.combinationsTrace(items, 6));
});
test('choose-set traces keep the same counter keys and node ids stable', () => {
  const t = A.permutationsTrace(['a', 'b', 'c']);
  const keys = Object.keys(t.steps[0].counters).join();
  t.steps.forEach(s => assert.equal(Object.keys(s.counters).join(), keys));
  const idsAtEnd = new Set(t.steps[t.steps.length - 1].tree.map(x => x.id));
  t.steps.forEach(s => s.tree.forEach(x => assert.ok(idsAtEnd.has(x.id))));
});

/* ------------------------------------------------------------------ Sudoku */
const easy = A.textToGrid(A.PUZZLES.easy.text), medium = A.textToGrid(A.PUZZLES.medium.text), hard = A.textToGrid(A.PUZZLES.hard.text);

test('sudoku: solvers agree with the plain reference and produce valid grids', () => {
  [easy, medium].forEach(g => {
    const ref = A.solveSudoku(g);
    assert.ok(ref && A.isValidSolution(ref));
    ['naive', 'mrv'].forEach(order => {
      const r = A.sudokuCount(g, order);
      assert.ok(r.solved);
      assert.deepEqual(r.grid, ref, order);
      g.forEach((v, i) => { if (v) assert.equal(r.grid[i], v, 'givens untouched'); });
    });
  });
  const h = A.sudokuCount(hard, 'mrv');
  assert.ok(h.solved && A.isValidSolution(h.grid));
});
test('sudoku: trace equals sudokuCount and ends solved; steps are truthful', () => {
  [easy, medium].forEach(g => ['naive', 'mrv'].forEach(order => {
    const t = A.sudoku(g, { order, cap: 100000 });
    const c = A.sudokuCount(g, order);
    assert.ok(t.solved && !t.capped);
    assert.equal(t.attempts, c.attempts);
    assert.equal(t.backtracks, c.backtracks);
    const last = t.steps[t.steps.length - 1];
    assert.equal(last.kind, 'solved');
    assert.ok(A.isValidSolution(last.grid));
    assert.equal(last.counters.empty, 0);
    let prev = null;
    t.steps.forEach(s => {
      // givens never change
      g.forEach((v, i) => { if (v) assert.equal(s.grid[i], v); });
      if (s.kind === 'place') {
        assert.equal(prev.grid[s.focus], 0);
        assert.equal(s.grid[s.focus], s.digit);
        assert.ok(prev.cand[s.focus] & (1 << (s.digit - 1)), 'digit was a candidate');
      }
      if (s.kind === 'erase') { assert.equal(prev.grid[s.focus], s.digit); assert.equal(s.grid[s.focus], 0); }
      if (s.kind === 'pick') {
        assert.equal(s.grid[s.focus], 0);
        assert.equal(s.focusMask, s.cand[s.focus]);
        const counts = [];
        s.cand.forEach((m, i) => { if (!s.grid[i]) counts.push([i, m.toString(2).split('1').length - 1]); });
        if (order === 'mrv') assert.equal(s.count, Math.min(...counts.map(x => x[1])), 'fewest candidates');
        if (order === 'naive') assert.equal(s.focus, counts[0][0], 'first empty cell in reading order');
      }
      prev = s;
    });
  }));
});
test('sudoku: most-constrained-first needs far fewer attempts than naive order', () => {
  const nm = A.sudokuCount(medium, 'naive'), mm = A.sudokuCount(medium, 'mrv');
  assert.ok(mm.attempts * 10 < nm.attempts, 'medium: ' + mm.attempts + ' vs ' + nm.attempts);
  const nh = A.sudokuCount(hard, 'naive', 200000);
  assert.ok(nh.aborted && !nh.solved, 'naive gives up on the hard puzzle within the cap');
  assert.ok(A.sudokuCount(hard, 'mrv').attempts < 5000);
});
test('sudoku: the empty grid, a solved grid and an unsolvable grid', () => {
  const empty = A.sudoku(new Array(81).fill(0), { order: 'mrv' });
  assert.ok(empty.solved); assert.equal(empty.attempts, 81);
  const solved = A.solveSudoku(easy);
  const done = A.sudoku(solved, { order: 'naive' });
  assert.ok(done.solved); assert.equal(done.attempts, 0);
  assert.deepEqual(done.steps.map(s => s.kind), ['start', 'solved']);
  // two givens that do not clash directly but leave a cell with no candidate
  const bad = new Array(81).fill(0);
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, k) => { bad[k] = d; });   // row 0 holds 1..8, cell 8 needs 9
  bad[17] = 9;                                                     // column 8 already has a 9
  const nosol = A.sudoku(bad, { order: 'mrv', cap: 100000 });
  assert.ok(!nosol.solved && !nosol.aborted);
  assert.equal(nosol.steps[nosol.steps.length - 1].kind, 'nosolution');
});
test('sudoku: long searches are capped and summarised, with truthful totals', () => {
  const t = A.sudoku(hard, { order: 'naive', cap: 500, nodeCap: 50000 });
  assert.ok(t.capped && t.aborted);
  assert.ok(t.steps.length <= 501);
  const last = t.steps[t.steps.length - 1];
  assert.equal(last.kind, 'gaveup');
  assert.equal(last.counters.attempts, 50000);
  const capped = A.sudoku(medium, { order: 'naive', cap: 200 });
  assert.ok(capped.capped && capped.solved);
  assert.equal(capped.steps[capped.steps.length - 1].kind, 'summary');
  assert.ok(A.isValidSolution(capped.steps[capped.steps.length - 1].grid));
  for (const order of ['naive', 'mrv']) assert.ok(A.sudoku(medium, { order }).steps.length <= 2400);
});
test('parseSudoku: friendly errors', () => {
  assert.ok(A.parseSudoku(A.PUZZLES.easy.text).grid);
  assert.ok(A.parseSudoku('.'.repeat(81)).grid);
  assert.match(A.parseSudoku('').error, /81/);
  assert.match(A.parseSudoku('123').error, /81 cells/);
  assert.match(A.parseSudoku('x'.repeat(81)).error, /allowed/);
  assert.match(A.parseSudoku('55' + '0'.repeat(79)).error, /Row 1/);
  assert.match(A.parseSudoku('5' + '0'.repeat(8) + '5' + '0'.repeat(71)).error, /Column 1/);
  assert.match(A.parseSudoku('5' + '0'.repeat(9) + '5' + '0'.repeat(70)).error, /box/);
  const rows = A.PUZZLES.medium.text.match(/.{9}/g).join('\n');
  assert.deepEqual(A.parseSudoku(rows).grid, medium);
});
test('sudoku random puzzles: trace, count and reference agree (seeded)', () => {
  const rng = VDSA.rng(33);
  const full = A.solveSudoku(new Array(81).fill(0));
  for (let t = 0; t < 12; t++) {
    const g = full.slice();
    // shuffle digits, then blank a random subset
    const perm = VDSA.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (let i = 0; i < 81; i++) g[i] = perm[g[i] - 1];
    const holes = rng.int(20, 45);
    VDSA.shuffle(VDSA.range(81), rng).slice(0, holes).forEach(i => { g[i] = 0; });
    ['naive', 'mrv'].forEach(order => {
      const tr = A.sudoku(g, { order, cap: 5000 });
      const c = A.sudokuCount(g, order);
      assert.equal(tr.solved, true);
      assert.equal(tr.attempts, c.attempts);
      assert.ok(A.isValidSolution(tr.grid));
      g.forEach((v, i) => { if (v) assert.equal(tr.grid[i], v); });
    });
  }
});

/* ------------------------------------------------------------------ Word search */
const BOARD = ['ABCE', 'SFCS', 'ADEE'];
test('wordSearch: agrees with the reference on the classic examples and random grids', () => {
  ['ABCCED', 'SEE', 'ABCB', 'A', 'ABFSA', 'Z', 'ADEEC'].forEach(w => {
    const t = A.wordSearch(BOARD, w);
    assert.equal(t.found, A.wordSearchRef(BOARD, w), w);
    assert.equal(A.wordSearchCount(BOARD, w).found, t.found);
  });
  assert.equal(A.wordSearchRef(BOARD, 'ABCCED'), true);
  assert.equal(A.wordSearchRef(BOARD, 'SEE'), true);
  assert.equal(A.wordSearchRef(BOARD, 'ABCB'), false);
  const rng = VDSA.rng(79);
  for (let trial = 0; trial < 60; trial++) {
    const R = rng.int(1, 4), C = rng.int(1, 4), letters = 'ABC';
    const rows = [];
    for (let r = 0; r < R; r++) { let s = ''; for (let c = 0; c < C; c++) s += letters[rng.int(0, 2)]; rows.push(s); }
    let w = ''; const L = rng.int(1, 6); for (let i = 0; i < L; i++) w += letters[rng.int(0, 2)];
    const t = A.wordSearch(rows, w, { cap: 100000 });
    assert.equal(t.found, A.wordSearchRef(rows, w), rows.join('/') + ' ' + w);
    assert.equal(A.wordSearchCount(rows, w).found, t.found);
  }
});
test('wordSearch: the found path spells the word through adjacent, distinct cells; paths are valid every step', () => {
  const t = A.wordSearch(BOARD, 'ABCCED');
  assert.ok(t.found);
  const p = t.path;
  assert.equal(p.map(([r, c]) => BOARD[r][c]).join(''), 'ABCCED');
  assert.equal(new Set(p.map(x => x.join(','))).size, p.length);
  for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]), 1);
  let prev = null;
  t.steps.forEach(s => {
    const letters = s.path.map(([r, c]) => BOARD[r][c]).join('');
    assert.equal(letters, 'ABCCED'.slice(0, s.path.length), 'path is always a prefix of the word');
    assert.equal(s.matched, s.path.length);
    if (s.kind === 'reject') { const [r, c] = s.bad; assert.ok(r >= 0 && c >= 0 && r < 3 && c < 4); }
    if (s.kind === 'backtrack') assert.equal(s.path.length, prev.path.length - 1);
    if (s.kind === 'match') assert.equal(s.path.length, prev.path.length + 1);
    prev = s;
  });
  assert.equal(t.steps[t.steps.length - 1].kind, 'found');
});
test('wordSearch: absent word ends with done and every path was undone', () => {
  const t = A.wordSearch(BOARD, 'ABCB');
  assert.ok(!t.found);
  const last = t.steps[t.steps.length - 1];
  assert.equal(last.kind, 'done');
  assert.equal(last.path.length, 0);
  const finalCounters = last.counters;
  assert.equal(finalCounters.matches, finalCounters.backtracks, 'every chosen cell was unchosen');
});
test('wordSearch: 1x1 grids, single letters and the exponential worst case is capped', () => {
  assert.ok(A.wordSearch(['A'], 'A').found);
  assert.ok(!A.wordSearch(['A'], 'B').found);
  assert.ok(!A.wordSearch(['A'], 'AA').found);
  const worst = ['AAAAAA', 'AAAAAA', 'AAAAAA', 'AAAAAA', 'AAAAAA', 'AAAAAA'];
  const t = A.wordSearch(worst, 'AAAAAAAAAAAB', { cap: 400, nodeCap: 30000 });
  assert.ok(t.capped);
  assert.ok(t.steps.length <= 401);
  assert.ok(t.aborted);
  assert.equal(t.steps[t.steps.length - 1].kind, 'summary');
});
test('parseWordGrid: friendly errors', () => {
  assert.deepEqual(A.parseWordGrid('abce, sfcs, adee', 'see').rows, BOARD);
  assert.equal(A.parseWordGrid('ABCE\nSFCS\nADEE', 'SEE').word, 'SEE');
  assert.match(A.parseWordGrid('', 'A').error, /grid/i);
  assert.match(A.parseWordGrid('AB1, CD', 'A').error, /letters/);
  assert.match(A.parseWordGrid('ABC, DE', 'A').error, /same number/);
  assert.match(A.parseWordGrid('ABCDEFG', 'A').error, /6/);
  assert.match(A.parseWordGrid('AB, CD', '').error, /word/);
  assert.match(A.parseWordGrid('AB, CD', 'ABCDEFGHIJKLM').error, /12/);
});

/* ------------------------------------------------------------------ maze and parse */
test('mazeWalk: depth-first with backtracking finds the exit; a dead end is never re-entered', () => {
  const m = A.mazeWalk();
  assert.ok(m.found);
  const last = m.steps[m.steps.length - 1];
  assert.equal(last.kind, 'exit');
  assert.deepEqual(last.path, ['f', 'b', 'b1', 'b1b']);
  const visitedDead = new Set();
  m.steps.forEach(s => { if (s.kind === 'dead') { assert.ok(!visitedDead.has(s.at)); visitedDead.add(s.at); } });
  assert.equal(last.counters.deadEnds, visitedDead.size);
  assert.equal(last.nodes.find(n => n.id === 'c').state, 'default', 'the last corridor was never entered');
  assert.equal(last.nodes.filter(n => n.state === 'path' || n.state === 'found').length, 4);
});
test('parseItems: limits and duplicates', () => {
  assert.deepEqual(A.parseItems('a b, c').values, ['a', 'b', 'c']);
  assert.match(A.parseItems('').error, /Type/);
  assert.match(A.parseItems('a b c d e f').error, /at most 5/);
  assert.match(A.parseItems('a a').error, /different/);
  assert.match(A.parseItems('abcdef').error, /3 characters/);
  assert.match(A.parseItems('a b', { min: 3 }).error, /3 or more/);
});
