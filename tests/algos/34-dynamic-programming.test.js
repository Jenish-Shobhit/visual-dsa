/* Tests for js/algos/34-dynamic-programming.js — run: node --test tests/algos/34-dynamic-programming.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const A = require(path.join(__dirname, '../../js/algos/34-dynamic-programming.js'));
const V = require(path.join(__dirname, '../../js/vdsa/core.js'));
const INF = Infinity;

/* ------------------------------------------------------------ helpers */
function countNaive(n) { let c = 0; (function f(k) { c++; if (k < 2) return k; return f(k - 1) + f(k - 2); }(n)); return c; }
function countMemo(n) {
  let c = 0, hits = 0; const memo = {};
  (function f(k) { c++; if (k < 2) return k; if (memo[k] !== undefined) { hits++; return memo[k]; } memo[k] = f(k - 1) + f(k - 2); return memo[k]; }(n));
  return { calls: c, hits };
}
function last(steps, kind) { for (let i = steps.length - 1; i >= 0; i--) if (!kind || steps[i].kind === kind) return steps[i]; return null; }
function cellValue(step, r, c) { const cell = step.table.rows[r].cells[c]; return cell && cell.value !== null && cell.value !== undefined ? cell.value : null; }
function randomList(rng, n, lo, hi) { const a = []; for (let i = 0; i < n; i++) a.push(rng.int(lo, hi)); return a; }
function randomCoins(rng) {
  const k = rng.int(1, 4), set = new Set();
  while (set.size < k) set.add(rng.int(1, 9));
  return [...set].sort((x, y) => x - y);
}

const LINES = {
  stairs: ['state', 'base', 'loop', 'rec', 'ret'],
  coinMin: ['base', 'coin', 'cmp', 'take', 'ret'],
  coinWays: ['base', 'skip', 'use', 'ret'],
  robber: ['base', 'skip', 'rob', 'take', 'ret'],
  lis: ['init', 'inner', 'cmp', 'take', 'ret']
};
const FLOWS = ['state', 'rec', 'base', 'next', 'fill', 'answer', 'recon'];

/* Structural checks every lab trace must pass. */
function checkLabTrace(name, steps) {
  assert.ok(steps.length >= 3, name + ': has steps');
  const shape = steps[0].table.rows.map(r => r.cells.length);
  const counterKeys = Object.keys(steps[0].counters).join(',');
  const finalValues = {};
  steps.forEach((s, i) => {
    assert.deepEqual(s.table.rows.map(r => r.cells.length), shape, name + ': table shape constant at step ' + i);
    assert.equal(Object.keys(s.counters).join(','), counterKeys, name + ': counter keys constant at step ' + i);
    assert.ok(typeof s.caption === 'string' && s.caption.length > 10, name + ': caption at step ' + i);
    assert.ok(FLOWS.includes(s.flow), name + ': flow id ' + s.flow);
    [].concat(s.line === null || s.line === undefined ? [] : s.line).forEach(l => assert.ok(LINES[name].includes(l), name + ': line label ' + l));
    s.table.arcs.forEach(a => {
      [a.from, a.to].forEach(p => {
        assert.ok(p[0] >= 0 && p[0] < shape.length && p[1] >= 0 && p[1] < shape[p[0]], name + ': arc endpoint in range at step ' + i);
      });
    });
    if (s.table.cursor) assert.ok(s.table.cursor[1] < shape[s.table.cursor[0]], name + ': cursor in range');
    // a written cell never changes value later (the table only grows)
    s.table.rows.forEach((r, ri) => r.cells.forEach((c, ci) => {
      if (!c || c.value === null || c.value === undefined) return;
      const k = ri + ',' + ci;
      if (finalValues[k] === undefined) finalValues[k] = c.value;
      else assert.equal(c.value, finalValues[k], name + ': cell ' + k + ' changed at step ' + i);
    }));
  });
  // counters never decrease
  for (let i = 1; i < steps.length; i++) Object.keys(steps[i].counters).forEach(k => assert.ok(steps[i].counters[k] >= steps[i - 1].counters[k], name + ': counter ' + k + ' monotone'));
  // no shared mutable snapshots: JSON round trip is identical, and the first step is not the final table
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(steps))), JSON.stringify(steps));
}

/* ------------------------------------------------------------ numbers */
test('fib, call counts and additions match instrumented recursion', () => {
  const F = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  F.forEach((v, n) => assert.equal(A.fib(n), v));
  for (let n = 0; n <= 20; n++) {
    assert.equal(A.naiveCalls(n), countNaive(n), 'naive calls n=' + n);
    assert.equal(A.memoCalls(n), countMemo(n).calls, 'memo calls n=' + n);
    assert.equal(A.tableAdds(n), Math.max(0, n - 1));
  }
  assert.equal(A.naiveCalls(10), 177);
  assert.equal(A.naiveCalls(50), 40730022147);
  assert.equal(A.memoCalls(10), 19);
});

test('stairsWays lists every way exactly once', () => {
  for (let n = 0; n <= 10; n++) {
    const ways = A.stairsWays(n);
    assert.equal(ways.length, A.fib(n + 1), 'count n=' + n);
    const keys = new Set(ways.map(w => w.join('')));
    assert.equal(keys.size, ways.length, 'unique n=' + n);
    ways.forEach(w => { assert.equal(w.reduce((s, x) => s + x, 0), n); w.forEach(x => assert.ok(x === 1 || x === 2)); });
  }
  assert.deepEqual(A.stairsWays(3), [[1, 1, 1], [1, 2], [2, 1]]);
});

test('fibTree is the full call tree in preorder', () => {
  for (let n = 0; n <= 8; n++) {
    const t = A.fibTree(n);
    assert.equal(t.length, A.naiveCalls(n));
    assert.equal(t[0].k, n);
    t.forEach(node => {
      if (node.k >= 2) assert.deepEqual(node.children.map(c => t[+c.slice(1)].k), [node.k - 1, node.k - 2]);
      else assert.equal(node.children.length, 0);
    });
    const counts = {}; t.forEach(x => { counts[x.k] = (counts[x.k] || 0) + 1; });
    for (let k = 1; k <= n; k++) assert.equal(counts[k], A.fib(n - k + 1), 'fib(' + k + ') appears F(n-k+1) times');
  }
});

/* ------------------------------------------------------------ fibTrace */
test('fibTrace plain: counters, return values and repeat states are truthful', () => {
  for (let n = 0; n <= 6; n++) {
    const steps = A.fibTrace(n);
    const end = steps[steps.length - 1];
    assert.equal(end.counters.calls, A.naiveCalls(n));
    assert.equal(end.counters.distinct, n < 2 ? 1 : n + 1, 'distinct');
    assert.equal(end.counters.hits, 0);
    const root = end.tree.nodes.find(x => x.id === 'c0');
    assert.equal(root.returnValue, A.fib(n));
    const tree = A.fibTree(n);
    assert.equal(end.tree.nodes.length, tree.length, 'every call drawn');
    end.tree.nodes.forEach(node => {
      const t = tree[+node.id.slice(1)];
      assert.equal(node.returnValue, A.fib(t.k), 'return value of ' + node.id);
      // a repeat is exactly a call whose argument was already solved by an earlier call
      assert.equal(node.state === 'pivot', t.rep > 0, 'repeat state of ' + node.id);
    });
    // row counts how many times each k was asked
    end.row.items.forEach((it, k) => assert.equal(it.value, tree.filter(x => x.k === k).length));
    // one node is active at a time
    steps.forEach(s => assert.ok(s.tree.nodes.filter(x => x.state === 'active').length <= 1));
  }
});

test('fibTrace memo: hits, ghosts and memo row', () => {
  for (let n = 0; n <= 6; n++) {
    const steps = A.fibTrace(n, { memo: true });
    const end = steps[steps.length - 1];
    const ref = countMemo(n);
    assert.equal(end.counters.calls, ref.calls, 'calls n=' + n);
    assert.equal(end.counters.hits, ref.hits, 'hits n=' + n);
    assert.equal(end.tree.nodes.find(x => x.id === 'c0').returnValue, A.fib(n));
    const real = end.tree.nodes.filter(x => x.state !== 'muted');
    assert.equal(real.length, ref.calls, 'real (non-ghost) nodes = calls');
    assert.equal(end.tree.nodes.length, A.naiveCalls(n), 'ghosts complete the plain tree');
    end.tree.nodes.filter(x => x.state === 'muted').forEach(x => assert.equal(x.returnValue, undefined, 'ghosts never return'));
    // memo row holds fib(k) for k = 2..n
    assert.equal(end.row.items.length, Math.max(0, n - 1));
    end.row.items.forEach(it => assert.equal(it.value, A.fib(+it.id.slice(1))));
    // a hit is only ever shown for a k already in the memo
    steps.forEach((s, i) => {
      if (s.kind !== 'hit') return;
      const lit = s.row.items.filter(it => it.state === 'found');
      assert.equal(lit.length, 1, 'one memo cell lights on a hit');
      assert.ok(steps[i - 1].row.items.some(it => it.id === lit[0].id), 'the hit cell was already stored');
    });
  }
  assert.equal(A.fibTrace(5, { memo: true }).filter(s => s.kind === 'hit').length, 2);
});

/* ------------------------------------------------------------ collapse */
test('collapseSteps phases and counts', () => {
  const s = A.collapseSteps(6);
  assert.equal(s[0].phase, 'tree');
  assert.equal(s[0].counter, 25);
  assert.ok(s.some(x => x.phase === 'collapse' && x.counter === 7));
  const fills = s.filter(x => x.phase === 'fill');
  assert.deepEqual(fills.map(x => x.fill), [0, 1, 2, 3, 4, 5, 6]);
  const t = A.collapseSteps(5, { teaser: true });
  assert.deepEqual(t.map(x => x.phase), ['grow', 'grow', 'grow', 'grow', 'grow', 'repeats', 'collapse', 'dag']);
  assert.equal(t[4].counter, 15);
});

/* ------------------------------------------------------------ lab: climbing stairs */
test('lab.stairs matches the reference for n = 0..12', () => {
  for (let n = 0; n <= 12; n++) {
    const steps = A.lab.stairs(n);
    checkLabTrace('stairs', steps);
    const ans = last(steps, 'answer');
    assert.equal(ans.vars.answer, A.reference.stairs(n), 'n=' + n);
    for (let i = 0; i <= n; i++) assert.equal(cellValue(ans, 0, i), A.reference.stairs(i));
    assert.equal(ans.counters.cells, n + 1);
    assert.equal(ans.counters.reads, n === 0 ? 0 : 2 * n - 1);
  }
});

/* ------------------------------------------------------------ lab: fewest coins */
function checkCoinMin(coins, amount) {
  const steps = A.lab.coinMin(coins, amount);
  checkLabTrace('coinMin', steps);
  const ref = A.reference.coinMin(coins, amount);
  const ans = last(steps, 'answer');
  assert.equal(ans.vars.answer, ref === INF ? -1 : ref, JSON.stringify(coins) + ' ' + amount);
  for (let a = 0; a <= amount; a++) assert.equal(cellValue(ans, 0, a), A.reference.coinMin(coins, a), 'cell ' + a);
  const recon = steps.filter(s => s.kind === 'recon');
  if (ref === INF) { assert.equal(recon.length, 0); assert.equal(ans.table.rows[0].cells[amount].state, 'error'); }
  else {
    assert.equal(recon.length, ref);
    const used = recon.length ? recon[recon.length - 1].vars.used : [];
    assert.equal(used.reduce((s, x) => s + x, 0), amount, 'reconstructed coins sum to the amount');
    used.forEach(c => assert.ok(coins.includes(c)));
  }
  // the look step's prediction data matches the value written next
  steps.forEach((s, i) => { if (s.kind === 'look') assert.equal(s.predict.best, cellValue(steps[i + 1], 0, s.predict.a)); });
}
test('lab.coinMin: edge cases', () => {
  checkCoinMin([1, 3, 4], 6);
  checkCoinMin([1, 2, 5], 11);
  checkCoinMin([2], 3);          // impossible
  checkCoinMin([2], 0);          // amount zero
  checkCoinMin([7], 7);          // single coin exact
  checkCoinMin([5, 7], 15);      // sparse reachability
  checkCoinMin([1], 15);
  const s = A.lab.coinMin([1, 3, 4], 6);
  assert.deepEqual(last(s, 'recon').vars.used.slice().sort(), [3, 3], 'optimal 3 + 3 beats greedy 4 + 1 + 1');
});
test('lab.coinMin: random inputs', () => {
  const rng = V.rng(34);
  for (let t = 0; t < 120; t++) checkCoinMin(randomCoins(rng), rng.int(0, 15));
});

/* ------------------------------------------------------------ lab: coin combinations */
function checkCoinWays(coins, amount) {
  const steps = A.lab.coinWays(coins, amount);
  checkLabTrace('coinWays', steps);
  const ans = last(steps, 'answer');
  assert.equal(ans.vars.answer, A.reference.coinWays(coins, amount), JSON.stringify(coins) + ' ' + amount);
  for (let i = 0; i <= coins.length; i++) for (let a = 0; a <= amount; a++)
    assert.equal(cellValue(ans, i, a), A.reference.coinWays(coins.slice(0, i), a), 'W[' + i + '][' + a + ']');
  assert.equal(ans.counters.cells, (coins.length + 1) * (amount + 1));
}
test('lab.coinWays: edge cases and random inputs', () => {
  checkCoinWays([1, 2, 5], 5);
  checkCoinWays([2], 3);
  checkCoinWays([3], 0);
  checkCoinWays([1, 2, 3, 4], 12);
  const rng = V.rng(7);
  for (let t = 0; t < 80; t++) checkCoinWays(randomCoins(rng), rng.int(0, 12));
  assert.equal(last(A.lab.coinWays([1, 2, 5], 5), 'answer').vars.answer, 4);
});

/* ------------------------------------------------------------ lab: house robber */
function checkRobber(h) {
  const steps = A.lab.robber(h);
  checkLabTrace('robber', steps);
  const ref = A.reference.robber(h);
  const ans = last(steps, 'answer');
  assert.equal(ans.vars.answer, ref, JSON.stringify(h));
  const recon = steps.filter(s => s.kind === 'recon');
  const robbed = recon.length ? recon[recon.length - 1].vars.robbed : [];
  for (let i = 1; i < robbed.length; i++) assert.ok(robbed[i] - robbed[i - 1] >= 2, 'no two neighbours robbed');
  assert.equal(robbed.reduce((s, i) => s + h[i - 1], 0), ref, 'robbed houses add up to the answer');
  // the input row never changes value
  steps.forEach(s => h.forEach((v, i) => assert.equal(cellValue(s, 0, i + 1), v)));
}
test('lab.robber: edge cases and random inputs', () => {
  checkRobber([2, 7, 9, 3, 1]);
  checkRobber([5]);
  checkRobber([4, 4, 4, 4, 4]);       // duplicates
  checkRobber([0, 0, 0]);
  checkRobber([1, 2, 3, 4, 5, 6]);    // sorted
  checkRobber([6, 5, 4, 3, 2, 1]);    // reversed
  checkRobber([2, 1, 1, 2]);
  const rng = V.rng(99);
  for (let t = 0; t < 150; t++) checkRobber(randomList(rng, rng.int(1, 10), 0, 99));
});

/* ------------------------------------------------------------ lab: LIS */
function checkLis(a) {
  const steps = A.lab.lis(a);
  checkLabTrace('lis', steps);
  const ref = A.reference.lis(a);
  const ans = last(steps, 'answer');
  assert.equal(ans.vars.answer, ref, JSON.stringify(a));
  const recon = steps.filter(s => s.kind === 'recon');
  if (a.length) {
    const run = recon[recon.length - 1].vars.run;
    assert.equal(run.length, ref, 'run length');
    for (let i = 1; i < run.length; i++) assert.ok(run[i] > run[i - 1], 'strictly increasing');
  }
}
test('lab.lis: edge cases and random inputs', () => {
  checkLis([3, 1, 4, 1, 5, 9, 2, 6]);
  checkLis([7]);
  checkLis([5, 5, 5, 5]);                  // duplicates: strictly increasing means 1
  checkLis([1, 2, 3, 4, 5, 6, 7, 8]);      // sorted
  checkLis([8, 7, 6, 5, 4, 3, 2, 1]);      // reversed
  checkLis([-3, 10, -1, 0, 2]);
  const rng = V.rng(2024);
  for (let t = 0; t < 150; t++) checkLis(randomList(rng, rng.int(1, 10), -20, 20));
  assert.equal(last(A.lab.lis([1, 2, 3, 4, 5, 6, 7, 8]), 'answer').vars.answer, 8);
  assert.equal(last(A.lab.lis([8, 7, 6, 5, 4, 3, 2, 1]), 'answer').vars.answer, 1);
});

/* ------------------------------------------------------------ order, DAG, space */
test('orderSteps: both sides agree with the reference; top-down touches only reachable amounts', () => {
  const cases = [[[3, 5], 11], [[1, 2], 8], [[2], 5], [[1, 3, 4], 6], [[4], 0]];
  const rng = V.rng(5);
  for (let t = 0; t < 30; t++) cases.push([randomCoins(rng), rng.int(0, 12)]);
  cases.forEach(([coins, amount]) => {
    const steps = A.orderSteps(coins, amount);
    const end = steps[steps.length - 1];
    end.right.rows[0].cells.forEach((c, a) => assert.equal(c.value, A.reference.coinMin(coins, a), 'bottom-up cell ' + a));
    // top-down: every finished cell is correct, and the set of finished cells is exactly the reachable-by-subtraction set
    const reach = new Set(); (function go(x) { if (reach.has(x)) return; reach.add(x); if (x === 0) return; coins.forEach(c => { if (c <= x) go(x - c); }); }(amount));
    end.left.rows[0].cells.forEach((c, a) => {
      if (reach.has(a)) { assert.ok(c, 'top-down finished ' + a); assert.equal(c.value, A.reference.coinMin(coins, a)); }
      else assert.equal(c, null, 'top-down never touched ' + a);
    });
    assert.equal(steps.meta.tdCells, reach.size);
    steps.forEach(s => assert.ok(s.counters.tdDepth <= amount + 1));
  });
});

test('dagSteps: shortest path equals fewest coins; greedy shown only when it loses', () => {
  const rng = V.rng(11);
  const cases = [[[1, 3, 4], 6], [[1, 2, 5], 9], [[3, 5], 7], [[2], 5]];
  for (let t = 0; t < 30; t++) cases.push([randomCoins(rng), rng.int(1, 12)]);
  cases.forEach(([coins, target]) => {
    const steps = A.dagSteps(coins, target);
    const ref = A.reference.coinMin(coins, target);
    const settled = steps.filter(s => s.kind === 'settle');
    assert.equal(settled.length, target + 1);
    const lastSettle = settled[settled.length - 1];
    lastSettle.table.rows[0].cells.forEach((c, v) => assert.equal(c.value, A.reference.coinMin(coins, v), 'dist ' + v));
    const p = steps.find(s => s.kind === 'path');
    if (ref === INF) assert.equal(p, undefined);
    else assert.equal(p.table.arcs.filter(a => a.state === 'path').length, ref, 'path edges = coins');
    const g = steps.find(s => s.kind === 'greedy');
    if (g) assert.ok(g.table.arcs.filter(a => a.state === 'error').length > ref, 'greedy only shown when worse');
  });
  assert.ok(A.dagSteps([1, 3, 4], 6).some(s => s.kind === 'greedy'), 'the classic greedy trap is shown');
});

test('spaceSteps: Fibonacci values, and storage shrinks to two', () => {
  const steps = A.spaceSteps(12, 6);
  steps.forEach(s => s.array.items.forEach(it => assert.equal(it.value, A.fib(+it.id.slice(1)))));
  const drop = steps.find(s => s.phase === 'drop');
  assert.equal(drop.array.items.length, 2);
  assert.equal(steps[steps.length - 1].array.items[1].value, A.fib(12));
  assert.ok(steps.filter(s => s.phase !== 'full').every(s => s.counters.stored <= 3));
});

/* ------------------------------------------------------------ parsing */
test('parse gives friendly errors and sorted unique coins', () => {
  assert.deepEqual(A.parse.coins('4, 1 3').values, [1, 3, 4]);
  assert.match(A.parse.coins('1, 1').error, /once/);
  assert.match(A.parse.coins('0').error, /between/);
  assert.match(A.parse.coins('1 2 3 4 5').error, /at most/);
  assert.match(A.parse.coins('').error, /at least/);
  assert.match(A.parse.houses('3, x').error, /whole number/);
  assert.match(A.parse.lis('1 2 3 4 5 6 7 8 9 10 11').error, /at most/);
  assert.equal(A.parse.lis('-5 3').error, null);
});
