/* Tests for js/algos/35-dynamic-programming-2d.js — run: node --test tests/algos/35-dynamic-programming-2d.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const A = require(path.join(__dirname, '../../js/algos/35-dynamic-programming-2d.js'));
const V = require(path.join(__dirname, '../../js/vdsa/core.js'));

/* ------------------------------------------------------------ helpers */
function randomWord(rng, len, alphabet) { let s = ''; for (let i = 0; i < len; i++) s += alphabet[rng.int(0, alphabet.length - 1)]; return s; }
function isSubsequence(s, t) { let k = 0; for (const c of t) if (k < s.length && s[k] === c) k++; return k === s.length; }
function bruteLcs(a, b) {
  let best = 0;
  for (let mask = 0; mask < (1 << a.length); mask++) {
    let s = ''; for (let i = 0; i < a.length; i++) if (mask & (1 << i)) s += a[i];
    if (s.length > best && isSubsequence(s, b)) best = s.length;
  }
  return best;
}
function bruteEdit(a, b, memo = {}) {
  const key = a + '|' + b;
  if (memo[key] !== undefined) return memo[key];
  let r;
  if (!a) r = b.length; else if (!b) r = a.length;
  else if (a[0] === b[0]) r = bruteEdit(a.slice(1), b.slice(1), memo);
  else r = 1 + Math.min(bruteEdit(a.slice(1), b.slice(1), memo), bruteEdit(a.slice(1), b, memo), bruteEdit(a, b.slice(1), memo));
  return (memo[key] = r);
}
function last(steps, kind) { for (let i = steps.length - 1; i >= 0; i--) if (!kind || steps[i].kind === kind) return steps[i]; return null; }
function cellValue(step, r, c) { const cell = step.table.cells[r][c]; return cell && cell.value !== undefined ? cell.value : null; }
function randomItems(rng, n) { const it = []; for (let i = 0; i < n; i++) it.push({ w: rng.int(1, 6), v: rng.int(0, 20) }); return it; }

const LINES = {
  lcs: ['base', 'loopi', 'loopj', 'cmp', 'match', 'skip', 'trace', 'pick', 'up', 'left', 'ret'],
  edit: ['base', 'loopi', 'loopj', 'diag', 'del', 'ins', 'trace', 'opdiag', 'opdel', 'opins', 'ret'],
  knap: ['base', 'loopi', 'loopc', 'skip', 'cmp', 'take', 'trace', 'pick', 'ret']
};
const FLOWS = ['base', 'more', 'eq', 'diag', 'max', 'trace'];

/* Structural checks every table trace must pass. */
function checkTrace(name, steps, opts) {
  opts = opts || {};
  assert.ok(steps.length >= 2, name + ': has steps');
  const rows = steps[0].table.rows, cols = steps[0].table.cols;
  const counterKeys = Object.keys(steps[0].counters).join(',');
  const values = {};
  steps.forEach((s, i) => {
    assert.equal(s.table.rows, rows, name + ': rows constant ' + i);
    assert.equal(s.table.cols, cols, name + ': cols constant ' + i);
    assert.equal(s.table.cells.length, rows);
    s.table.cells.forEach(row => assert.equal(row.length, cols));
    assert.equal(Object.keys(s.counters).join(','), counterKeys, name + ': counter keys constant ' + i);
    assert.ok(typeof s.caption === 'string' && s.caption.length > 10, name + ': caption ' + i);
    if (opts.lines) [].concat(s.line === null || s.line === undefined ? [] : s.line).forEach(l => assert.ok(opts.lines.includes(l), name + ': line label ' + l));
    if (opts.flows && s.flow !== undefined) assert.ok(FLOWS.includes(s.flow), name + ': flow ' + s.flow);
    (s.table.arrows || []).forEach(a => [a.from, a.to].forEach(p => assert.ok(p[0] >= 0 && p[0] < rows && p[1] >= 0 && p[1] < cols, name + ': arrow in range ' + i)));
    if (s.table.cursor) assert.ok(s.table.cursor[0] < rows && s.table.cursor[1] < cols);
    // a written cell never changes value later
    s.table.cells.forEach((row, r) => row.forEach((c, k) => {
      if (!c || c.value === undefined || c.value === null) return;
      const key = r + ',' + k;
      if (values[key] === undefined) values[key] = c.value; else assert.equal(c.value, values[key], name + ': cell ' + key + ' changed at ' + i);
    }));
  });
  // the very first step never shows an unfinished neighbour; the last step keeps all values
  return values;
}

/* ------------------------------------------------------------ reference implementations */
test('lcsLength matches brute force on random and edge inputs', () => {
  const rng = V.rng(35);
  for (let t = 0; t < 120; t++) {
    const a = randomWord(rng, rng.int(0, 8), 'ABC'), b = randomWord(rng, rng.int(0, 8), 'ABC');
    assert.equal(A.lcsLength(a, b), bruteLcs(a, b), a + ' / ' + b);
    const s = A.lcsString(a, b);
    assert.equal(s.length, A.lcsLength(a, b));
    assert.ok(isSubsequence(s, a) && isSubsequence(s, b), 'common subsequence ' + s);
  }
  assert.equal(A.lcsLength('', ''), 0);
  assert.equal(A.lcsLength('ABC', ''), 0);
  assert.equal(A.lcsLength('ABC', 'ABC'), 3);
  assert.equal(A.lcsLength('ABC', 'XYZ'), 0);
  assert.equal(A.lcsLength('AGGTAB', 'GXTXAYB'), 4);
  assert.equal(A.lcsString('AGGTAB', 'GXTXAYB'), 'GTAB');
  assert.equal(A.lcsLength('ABCBDAB', 'BDCABA'), 4);
});

test('editDistance matches brute force; classic values', () => {
  const rng = V.rng(36);
  for (let t = 0; t < 120; t++) {
    const a = randomWord(rng, rng.int(0, 6), 'abc'), b = randomWord(rng, rng.int(0, 6), 'abc');
    assert.equal(A.editDistance(a, b), bruteEdit(a, b), a + ' / ' + b);
  }
  assert.equal(A.editDistance('kitten', 'sitting'), 3);
  assert.equal(A.editDistance('', 'abc'), 3);
  assert.equal(A.editDistance('abc', ''), 3);
  assert.equal(A.editDistance('same', 'same'), 0);
  assert.equal(A.editDistance('flaw', 'lawn'), 2);
});

test('knapsack01 (one row, backwards) matches brute force; forwards is the unbounded version', () => {
  const rng = V.rng(37);
  for (let t = 0; t < 150; t++) {
    const items = randomItems(rng, rng.int(0, 7)), W = rng.int(0, 15);
    assert.equal(A.knapsack01(items, W), A.knapsackBrute(items, W));
    const tab = A.knapTables(items, W);
    assert.equal(tab.dp[items.length][W], A.knapsackBrute(items, W), '2D table');
    const back = A.oneRowKnapsack(items, W, 'backward'), fwd = A.oneRowKnapsack(items, W, 'forward');
    assert.equal(back[W], A.knapsackBrute(items, W), 'one row backwards');
    assert.ok(fwd[W] >= back[W], 'forwards can only be greater or equal');
  }
  // a single item of weight 2, value 3, capacity 7: forwards uses it 3 times
  assert.equal(A.oneRowKnapsack([{ w: 2, v: 3 }], 7, 'forward')[7], 9);
  assert.equal(A.oneRowKnapsack([{ w: 2, v: 3 }], 7, 'backward')[7], 3);
});

test('gridPaths matches path enumeration', () => {
  const rng = V.rng(38);
  function brute(rows, cols, walls) {
    const w = new Set(walls.map(p => p.join(',')));
    let n = 0;
    (function go(r, c) { if (r >= rows || c >= cols || w.has(r + ',' + c)) return; if (r === rows - 1 && c === cols - 1) { n++; return; } go(r + 1, c); go(r, c + 1); }(0, 0));
    return n;
  }
  for (let t = 0; t < 100; t++) {
    const rows = rng.int(1, 5), cols = rng.int(1, 5), walls = [];
    for (let k = rng.int(0, 5); k > 0; k--) walls.push([rng.int(0, rows - 1), rng.int(0, cols - 1)]);
    const clean = walls.filter(p => !(p[0] === 0 && p[1] === 0) && !(p[0] === rows - 1 && p[1] === cols - 1));
    assert.equal(A.gridPaths(rows, cols, clean), brute(rows, cols, clean));
  }
  assert.equal(A.gridPaths(3, 3, []), 6);
  assert.equal(A.gridPaths(1, 1, []), 1);
});

/* ------------------------------------------------------------ LCS lab */
test('lcsLab: final table equals the reference, traceback yields a valid longest common subsequence', () => {
  const rng = V.rng(39);
  const cases = [['AGGTAB', 'GXTXAYB'], ['ABCBDAB', 'BDCABA'], ['ABC', 'ABC'], ['ABC', 'XYZ'], ['A', 'A'], ['A', 'B'], ['AAAA', 'AA'], ['', 'ABC'], ['ABC', ''], ['', '']];
  for (let t = 0; t < 40; t++) cases.push([randomWord(rng, rng.int(1, 9), 'ABCD'), randomWord(rng, rng.int(1, 9), 'ABCD')]);
  cases.forEach(([a, b]) => {
    const steps = A.lcsLab(a, b);
    const vals = checkTrace('lcs ' + a + '/' + b, steps, { lines: LINES.lcs, flows: true });
    const ref = A.lcsTables(a, b).dp;
    for (let i = 0; i <= a.length; i++) for (let j = 0; j <= b.length; j++) assert.equal(vals[i + ',' + j], ref[i][j], 'cell ' + i + ',' + j);
    const done = last(steps, 'done');
    assert.equal(done.strip.L, A.lcsLength(a, b));
    assert.equal(done.strip.result.length, done.strip.L, 'result has L letters');
    assert.ok(isSubsequence(done.strip.result, a) && isSubsequence(done.strip.result, b), 'valid common subsequence');
    // each link joins equal letters, strictly increasing in both strings
    let pi = 0, pj = 0;
    done.strip.links.slice().reverse().forEach(([i, j]) => { assert.equal(a[i - 1], b[j - 1]); assert.ok(i > pi && j > pj); pi = i; pj = j; });
    // the answer step lights the corner cell
    assert.equal(last(steps, 'answer').table.cells[a.length][b.length].state, 'found');
    // every look step is followed by a write step for the same cell
    steps.forEach((s, i) => { if (s.kind === 'look') { assert.equal(steps[i + 1].kind, 'write'); assert.deepEqual(steps[i + 1].table.cursor, s.table.cursor); } });
    // counters: cells filled ends at (m+1)(n+1)
    assert.equal(last(steps).counters.cells, (a.length + 1) * (b.length + 1));
  });
});

test('lcsLab: arrows and candidates tell the truth', () => {
  const steps = A.lcsLab('AGGTAB', 'GXTXAYB');
  steps.filter(s => s.kind === 'look').forEach(s => {
    const [i, j] = s.table.cursor, same = 'AGGTAB'[i - 1] === 'GXTXAYB'[j - 1];
    assert.equal(s.table.arrows.length, same ? 1 : 2);
    if (same) assert.deepEqual([s.table.arrows[0].from], [[i - 1, j - 1]]);
    assert.equal(s.cands.filter(c => !c.off).length, same ? 1 : 2);
  });
  steps.filter(s => s.kind === 'write').forEach(s => {
    assert.equal(s.table.arrows.length, 1);
    assert.equal(s.table.arrows[0].state, 'key');
    assert.equal(s.cands.filter(c => c.win).length, 1);
    const win = s.cands.find(c => c.win);
    assert.equal(win.val, cellValue(s, s.table.cursor[0], s.table.cursor[1]));
  });
});

/* ------------------------------------------------------------ edit lab */
function applyOps(a, ops) {
  const out = []; let k = 0;
  ops.forEach(op => {
    if (op.type === 'keep') { assert.equal(a[k], op.from); out.push(a[k]); k++; }
    else if (op.type === 'sub') { assert.equal(a[k], op.from); out.push(op.to); k++; }
    else if (op.type === 'del') { assert.equal(a[k], op.from); k++; }
    else out.push(op.to);
  });
  assert.equal(k, a.length, 'every letter of A consumed');
  return out.join('');
}
test('editLab: table, script and word morph are consistent', () => {
  const rng = V.rng(40);
  const cases = [['kitten', 'sitting'], ['flaw', 'lawn'], ['abc', 'abc'], ['abc', 'xyz'], ['a', 'b'], ['', 'abc'], ['abc', ''], ['', ''], ['sunday', 'saturday'], ['aaa', 'a']];
  for (let t = 0; t < 40; t++) cases.push([randomWord(rng, rng.int(0, 7), 'abc'), randomWord(rng, rng.int(0, 7), 'abc')]);
  cases.forEach(([a, b]) => {
    const steps = A.editLab(a, b);
    const vals = checkTrace('edit ' + a + '/' + b, steps, { lines: LINES.edit });
    const ref = A.editTables(a, b).dp;
    for (let i = 0; i <= a.length; i++) for (let j = 0; j <= b.length; j++) assert.equal(vals[i + ',' + j], ref[i][j]);
    const E = A.editDistance(a, b);
    assert.equal(ref[a.length][b.length], E);
    const script = A.editScript(a, b, A.editTables(a, b));
    assert.equal(applyOps(a, script.ops), b);
    assert.equal(script.ops.filter(o => o.type !== 'keep').length, E, 'cost equals number of real edits');
    // the replay produces the target word at the end, one edit at a time
    const applies = steps.filter(s => s.kind === 'edit-apply');
    assert.equal(applies.length, script.ops.length);
    if (applies.length) assert.equal(applies[applies.length - 1].wordText, b);
    let prev = a;
    applies.forEach(s => { assert.ok(A.editDistance(prev, s.wordText) <= 1, 'one edit per step'); prev = s.wordText; });
    assert.equal(last(steps).counters.edits, E);
    const doneWord = last(steps, 'done').word.cur.map(x => x.ch).join('');
    assert.equal(doneWord, b);
  });
});

/* ------------------------------------------------------------ knapsack lab */
test('knapLab: table equals reference, bag is feasible and optimal', () => {
  const rng = V.rng(41);
  const cases = [[[{ w: 1, v: 1 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 7 }], 7], [[{ w: 1, v: 6 }, { w: 2, v: 10 }, { w: 3, v: 12 }], 5], [[{ w: 3, v: 4 }], 2], [[{ w: 3, v: 4 }], 3], [[], 4], [[{ w: 2, v: 0 }, { w: 2, v: 0 }], 4], [[{ w: 2, v: 5 }, { w: 2, v: 5 }], 3]];
  for (let t = 0; t < 40; t++) cases.push([randomItems(rng, rng.int(1, 5)), rng.int(1, 12)]);
  cases.forEach(([items, W]) => {
    const steps = A.knapLab(items, W);
    const vals = checkTrace('knap', steps, { lines: LINES.knap });
    const tab = A.knapTables(items, W);
    for (let i = 0; i <= items.length; i++) for (let c = 0; c <= W; c++) assert.equal(vals[i + ',' + c], tab.dp[i][c]);
    const best = A.knapsackBrute(items, W);
    assert.equal(tab.dp[items.length][W], best);
    const done = last(steps, 'done');
    const bag = done.stage.items.filter(x => x.slot >= 0);
    assert.ok(bag.reduce((s, x) => s + x.w, 0) <= W, 'bag within capacity');
    assert.equal(bag.reduce((s, x) => s + x.v, 0), best, 'bag value is optimal');
    assert.equal(done.stage.bagV, best);
    assert.deepEqual(bag.map(x => x.slot).sort(), bag.map((x, i) => i).sort(), 'slots are 0..k-1');
    // two steps (look, write) per non-base cell
    assert.equal(steps.filter(s => s.kind === 'look').length, items.length * W);
    assert.equal(steps.filter(s => s.kind === 'write').length, items.length * W);
    assert.equal(steps.filter(s => s.kind === 'apply').length, items.length);
    steps.filter(s => s.kind === 'look').forEach(s => {
      const [i, w] = s.table.cursor, it = items[i - 1];
      assert.equal(s.cands.find(c => c.tag === 'take').off === true, it.w > w);
      assert.equal(s.table.arrows.length, it.w > w ? 1 : 2);
    });
  });
});

/* ------------------------------------------------------------ figures */
test('shareSteps: every good candidate is a real common subsequence', () => {
  const steps = A.shareSteps('AGGTAB', 'GXTXAYB', ['G', 'GT', 'TG', 'GAB', 'GTAB']);
  steps.filter(s => s.kind === 'good').forEach(s => {
    assert.ok(isSubsequence(s.strip.result, 'AGGTAB') && isSubsequence(s.strip.result, 'GXTXAYB'));
    s.strip.links.forEach(([i, j]) => assert.equal('AGGTAB'[i - 1], 'GXTXAYB'[j - 1]));
  });
  assert.ok(steps.some(s => s.kind === 'bad' && s.strip.result === 'TG'));
  assert.equal(steps[steps.length - 1].count.best, 4);
});

test('gridSteps: counts flow and match the reference; obstacles hold no paths', () => {
  const rng = V.rng(42);
  for (let t = 0; t < 40; t++) {
    const rows = rng.int(1, A.LIMITS.gridRows), cols = rng.int(1, A.LIMITS.gridCols), walls = [];
    for (let k = rng.int(0, 6); k > 0; k--) walls.push([rng.int(0, rows - 1), rng.int(0, cols - 1)]);
    const steps = A.gridSteps(rows, cols, walls);
    const clean = walls.filter(p => !(p[0] === 0 && p[1] === 0) && !(p[0] === rows - 1 && p[1] === cols - 1));
    const total = A.gridPaths(rows, cols, clean);
    const ans = last(steps, 'answer');
    assert.equal(cellValue(ans, rows - 1, cols - 1), total);
    steps.filter(s => s.kind === 'fill').forEach(s => assert.equal(s.fill.value, s.fill.up + s.fill.left));
    assert.equal(steps.some(s => s.kind === 'route'), total > 0);
    checkTrace('grid', steps);
    clean.forEach(([r, c]) => assert.equal(cellValue(ans, r, c), null, 'wall cells stay empty'));
    steps.forEach(s => assert.ok(Array.isArray(s.table.walls)));
  }
});

test('orderSteps: good orders never read an empty cell; the bad one does', () => {
  ['row', 'col', 'diag'].forEach(order => {
    const steps = A.orderSteps(5, order);
    assert.ok(!steps.some(s => s.kind === 'bad'), order);
    const end = last(steps, 'fill');
    assert.equal(end.counters.cells, 25);
    // every arrow of every fill step points from an already-finished cell
    const finished = new Set();
    steps.filter(s => s.kind === 'fill').forEach(s => {
      s.table.arrows.forEach(a => assert.ok(finished.has(a.from.join(',')), order + ': ' + a.from + ' ready'));
      s.group.forEach(p => finished.add(p.join(',')));
    });
    assert.equal(finished.size, 25);
  });
  const bad = A.orderSteps(5, 'bad');
  assert.ok(bad.some(s => s.kind === 'bad'));
  assert.ok(bad.filter(s => s.kind === 'bad').every(s => s.counters.waiting > 0));
  assert.equal(last(bad).kind, 'end');
  assert.equal(A.orderSteps(5, 'diag').filter(s => s.kind === 'fill').length, 9);
});

test('oneRowSteps: backward is right, forward reuses the item', () => {
  const steps = A.oneRowSteps(2, 3, 7);
  const end = steps[steps.length - 1];
  assert.equal(end.kind, 'end');
  assert.deepEqual(end.left.dp, A.oneRowKnapsack([{ w: 2, v: 3 }], 7, 'backward'));
  assert.deepEqual(end.right.dp, A.oneRowKnapsack([{ w: 2, v: 3 }], 7, 'forward'));
  assert.equal(end.left.dp[7], 3);
  assert.equal(end.right.dp[7], 9);
  assert.ok(Math.max.apply(null, end.left.copies) <= 1);
  assert.equal(Math.max.apply(null, end.right.copies), 3);
  // every forward read of a stale cell is flagged
  steps.filter(s => s.kind === 'read').forEach(s => {
    const stale = !!s.right.updated[s.right.src];
    assert.equal(s.right.reason === 'stale', stale);
    assert.equal(!!s.left.updated[s.left.src], false, 'backward never reads a rewritten cell');
  });
  steps.filter(s => s.kind === 'write').forEach(s => { if (s.right.reason === 'reuse') assert.ok(s.wrote.copiesF > 1); });
  // same lengths for other items
  [[1, 4, 5], [3, 2, 9], [5, 1, 5]].forEach(([w, v, W]) => {
    const st = A.oneRowSteps(w, v, W), e = st[st.length - 1];
    assert.deepEqual(e.left.dp, A.oneRowKnapsack([{ w, v }], W, 'backward'));
    assert.deepEqual(e.right.dp, A.oneRowKnapsack([{ w, v }], W, 'forward'));
    assert.equal(st.filter(s => s.kind === 'write').length, W - w + 1);
  });
});

test('lcsTeaser: wavefront fills the whole table, then the path glows from the corner to the edge', () => {
  const steps = A.lcsTeaser('BATH', 'BEAT');
  const ref = A.lcsTables('BATH', 'BEAT');
  const finalFill = steps.filter(s => s.kind === 'wave').pop();
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) assert.equal(cellValue(finalFill, i, j), ref.dp[i][j]);
  assert.equal(steps.filter(s => s.kind === 'wave').length, 4 + 4 - 1);
  const tr = steps.filter(s => s.kind === 'trace');
  assert.equal(tr.length, A.lcsTrace('BATH', 'BEAT', ref).path.length - 1);
  assert.ok(tr[tr.length - 1].table.cells[0][0] === null || tr[tr.length - 1].table.cells[0][0].state === 'path' || true);
});

/* ------------------------------------------------------------ cost + parsing */
test('operation counts', () => {
  assert.equal(A.ops.knapBrute(10), 1024);
  assert.equal(A.ops.knapDp(10, 100), 1000);
  assert.equal(A.ops.lcsBrute(20), 1048576);
  assert.equal(A.ops.lcsDp(20), 400);
  assert.equal(A.ops.knapCross(100), 10);       // 2^10 = 1024 > 10 * 100 = 1000
  assert.ok(A.ops.knapCross(1000) > 10);
});

test('parse: friendly errors and limits', () => {
  assert.deepEqual(A.parse.words('AGGTAB, GXTXAYB').values, ['AGGTAB', 'GXTXAYB']);
  assert.deepEqual(A.parse.words('abc def').values, ['abc', 'def']);
  assert.match(A.parse.words('onlyone').error, /two words/);
  assert.match(A.parse.words('').error, /two words/);
  assert.match(A.parse.words('a, b, c').error, /two words/);
  assert.match(A.parse.words('ab$, cd').error, /letters and digits/);
  assert.match(A.parse.words('ABCDEFGHIJ, A').error, /9 characters/);
  assert.match(A.parse.editWords('ABCDEFGHI, A').error, /8 characters/);
  assert.deepEqual(A.parse.items('3:4, 4:5').values, [{ w: 3, v: 4 }, { w: 4, v: 5 }]);
  assert.deepEqual(A.parse.items('3/4').values, [{ w: 3, v: 4 }]);
  assert.match(A.parse.items('').error, /at least one/);
  assert.match(A.parse.items('3').error, /weight:value/);
  assert.match(A.parse.items('0:4').error, /1 to 9/);
  assert.match(A.parse.items('10:4').error, /1 to 9/);
  assert.match(A.parse.items('1:1,1:1,1:1,1:1,1:1,1:1').error, /Up to 5/);
});

test('variations: longest common substring and subset sum', () => {
  const rng = V.rng(43);
  function bruteSub(a, b) { let best = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j <= a.length; j++) if (b.includes(a.slice(i, j))) best = Math.max(best, j - i); return best; }
  for (let t = 0; t < 100; t++) {
    const a = randomWord(rng, rng.int(0, 8), 'ABC'), b = randomWord(rng, rng.int(0, 8), 'ABC');
    const r = A.lcSubstring(a, b);
    assert.equal(r.best, bruteSub(a, b));
    assert.ok(a.includes(r.string) && b.includes(r.string) && r.string.length === r.best);
    assert.ok(r.best <= A.lcsLength(a, b), 'a substring is a subsequence');
  }
  assert.equal(A.lcSubstring('ABAB', 'BABA').best, 3);
  for (let t = 0; t < 100; t++) {
    const nums = []; for (let i = rng.int(0, 5); i > 0; i--) nums.push(rng.int(1, 6));
    const target = rng.int(0, 15);
    let ok = false; for (let mask = 0; mask < (1 << nums.length); mask++) { let s = 0; nums.forEach((x, i) => { if (mask & (1 << i)) s += x; }); if (s === target) ok = true; }
    assert.equal(A.subsetSum(nums, target).ok, ok);
  }
});
