// Lesson 05 · Complexity & Big-O — tests for the pure growth maths and step generators.
// Run: node --test tests/algos/05-big-o.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const B = require(path.join(root, 'js/algos/05-big-o.js'));
const V = require(path.join(root, 'js/vdsa/core.js'));

function randomArray(rng, n, lo, hi) { const a = []; for (let i = 0; i < n; i++) a.push(rng.int(lo, hi)); return a; }
function uniqueSorted(rng, n) {
  const set = new Set();
  while (set.size < n) set.add(rng.int(1, 99));
  return [...set].sort((a, b) => a - b);
}
function last(steps) { return steps[steps.length - 1]; }

/* ------------------------------------------------------------------ reference implementations */
function refBinaryProbes(a, t) {
  let lo = 0, hi = a.length - 1, probes = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; probes++; if (a[mid] === t) return { probes, index: mid }; if (a[mid] < t) lo = mid + 1; else hi = mid - 1; }
  return { probes, index: -1 };
}
function refPairChecks(a, t) {
  let c = 0;
  for (let i = 0; i < a.length - 1; i++) for (let j = i + 1; j < a.length; j++) { c++; if (a[i] + a[j] === t) return { checks: c, found: true }; }
  return { checks: c, found: false };
}
function refSubsets(a, t) {
  const total = 1 << a.length;
  for (let m = 0; m < total; m++) { let s = 0; for (let i = 0; i < a.length; i++) if ((m >> i) & 1) s += a[i]; if (s === t) return { checked: m + 1, found: true }; }
  return { checked: total, found: false };
}
function refMergeComparisons(a) {
  let c = 0;
  (function ms(x) {
    if (x.length < 2) return x;
    const m = Math.floor((x.length - 1) / 2) + 1;   // left half is a[lo..mid] with mid = floor((lo+hi)/2)
    const L = ms(x.slice(0, m)), R = ms(x.slice(m)), out = [];
    let p = 0, q = 0;
    while (p < L.length && q < R.length) { c++; out.push(L[p] <= R[q] ? L[p++] : R[q++]); }
    const res = out.concat(L.slice(p), R.slice(q));
    for (let k = 0; k < res.length; k++) x[k] = res[k];
    return res;
  })(a.slice());
  return c;
}
function inversions(a) { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c; }

/* ------------------------------------------------------------------ growth classes */
test('growth classes: ids match the Big-O badges and are ordered by growth', () => {
  assert.deepEqual(B.CLASSES.map(c => c.id), ['1', 'logn', 'n', 'nlogn', 'n2', 'n3', '2n', 'nfact']);
  for (const n of [16, 64, 1000]) {
    const w = B.CLASSES.map(c => B.log10Work(c.id, n));
    for (let k = 1; k < w.length; k++) assert.ok(w[k] >= w[k - 1], `class ${B.CLASSES[k].id} grows at least as fast at n=${n}`);
  }
});

test('log10Work matches the direct formulas where they fit in a double', () => {
  for (const n of [1, 2, 3, 10, 31, 100]) {
    for (const c of B.CLASSES) {
      const direct = Math.max(1, c.f(n));
      if (!isFinite(direct)) continue;
      assert.ok(Math.abs(B.log10Work(c.id, n) - Math.log10(direct)) < 1e-9, `${c.id} at n=${n}`);
    }
  }
  assert.ok(Math.abs(B.log10Work('2n', 1000) - 1000 * Math.log10(2)) < 1e-9, '2^1000 in log space');
  // Stirling branch agrees with the exact sum around the switch-over.
  let exact = 0; for (let k = 2; k <= 100; k++) exact += Math.log(k);
  assert.ok(Math.abs(B.lnFactorial(100) - exact) < 1e-8);
  assert.equal(B.factorial(10), 3628800);
});

test('feasibleN: f(n) fits in the budget and f(n + 1) does not', () => {
  assert.equal(B.feasibleN('2n', 1).n, 0, 'even n = 1 needs 2 operations');
  const budgets = [2, 7, 1e3, 12345, 1e6, 1e8, 1e9, 3.6e11, 1e12];
  for (const bud of budgets) {
    for (const c of B.CLASSES) {
      if (c.id === '1' || c.id === 'logn') continue;
      const r = B.feasibleN(c.id, bud);
      assert.ok(r.n >= 1 && Number.isInteger(r.n), `${c.id} budget ${bud} gives a whole n`);
      assert.ok(B.work(c.id, r.n) <= bud * (1 + 1e-12), `${c.id}: work(${r.n}) fits ${bud}`);
      assert.ok(B.work(c.id, r.n + 1) > bud, `${c.id}: work(${r.n + 1}) exceeds ${bud}`);
    }
  }
  assert.equal(B.feasibleN('n', 1e8).n, 1e8);
  assert.equal(B.feasibleN('n2', 1e8).n, 1e4);
  assert.equal(B.feasibleN('n3', 1e8).n, 464);
  assert.equal(B.feasibleN('2n', 1e8).n, 26);
  assert.equal(B.feasibleN('nfact', 1e8).n, 11);
  assert.ok(Math.abs(B.feasibleN('nlogn', 1e8).n - 4.52e6) < 1e4);
  assert.equal(B.feasibleN('1', 1e8).unbounded, true);
  assert.equal(B.feasibleN('logn', 20).n, 1048576);
  const big = B.feasibleN('logn', 1e8);
  assert.equal(big.n, Infinity);
  assert.ok(Math.abs(big.log10n - 1e8 * Math.log10(2)) < 1e-3, 'log n budget reports its digit count');
  assert.equal(B.feasibleN('n', 0.5).n, 0, 'a budget below one operation fits nothing');
});

test('doubling: the multipliers of the doubling game', () => {
  for (const n of [8, 16, 1000]) {
    assert.equal(B.doubling('1', n).text, '×1');
    assert.equal(B.doubling('logn', n).text, '+1 step');
    assert.ok(Math.abs(B.doubling('n', n).ratio - 2) < 1e-9);
    assert.ok(Math.abs(B.doubling('n2', n).ratio - 4) < 1e-9);
    assert.ok(Math.abs(B.doubling('n3', n).ratio - 8) < 1e-9);
    const nl = B.doubling('nlogn', n).ratio;
    assert.ok(nl > 2 && nl < 2.7, 'n log n: a little more than double');
    assert.ok(Math.abs(B.doubling('2n', n).ratioLog10 - n * Math.log10(2)) < 1e-6, '2^(2n) / 2^n = 2^n: the work is squared');
  }
});

test('formatting: counts, huge numbers and durations', () => {
  assert.equal(B.formatBig(Math.log10(999999)), '999,999');
  assert.equal(B.formatBig(Math.log10(1048576)), '1.05 million');
  assert.equal(B.formatBig(9), '1 billion');
  assert.equal(B.formatBig(30 + Math.log10(1.27)), '1.27 × 10³⁰');
  assert.equal(B.formatBig(301029.99), '10³⁰¹⁰³⁰');
  assert.equal(B.formatCount(1234), '1,234');
  assert.equal(B.formatCount(Infinity), '∞');
  assert.equal(B.secondsText(-8), '10 ns');
  assert.equal(B.secondsText(0), '1 s');
  assert.equal(B.secondsText(Math.log10(7200)), '2 hours');
  assert.match(B.secondsText(22.1), /years$/);
});

/* ------------------------------------------------------------------ problem race */
test('raceSteps: counts match a linear scan and a reference binary search', () => {
  const rng = V.rng(5);
  for (let trial = 0; trial < 60; trial++) {
    const n = rng.int(1, 40), a = uniqueSorted(rng, n);
    const present = rng() < 0.7;
    const t = present ? a[rng.int(0, n - 1)] : 100 + trial;
    const steps = B.raceSteps(a, t), end = last(steps);
    const idx = a.indexOf(t);
    assert.equal(end.counters.linear, idx === -1 ? n : idx + 1, 'linear comparisons');
    assert.equal(end.counters.binary, refBinaryProbes(a, t).probes, 'binary probes');
    assert.equal(end.lin.state, idx === -1 ? 'absent' : 'found');
    assert.equal(end.bin.state, idx === -1 ? 'absent' : 'found');
    assert.equal(steps.length, Math.max(end.counters.linear, end.counters.binary) + 1, 'one tick per comparison, plus the start');
    // counters never decrease and grow by at most one per tick
    for (let k = 1; k < steps.length; k++) {
      const d1 = steps[k].counters.linear - steps[k - 1].counters.linear, d2 = steps[k].counters.binary - steps[k - 1].counters.binary;
      assert.ok(d1 === 0 || d1 === 1); assert.ok(d2 === 0 || d2 === 1);
    }
  }
  const empty = B.raceSteps([], 5);
  assert.equal(empty.length, 1);
  assert.deepEqual(empty[0].counters, { linear: 0, binary: 0 });
});

/* ------------------------------------------------------------------ cases */
test('linearSearchSteps: best, worst, absent, duplicates, empty', () => {
  const a = [7, 3, 9, 3, 5];
  assert.equal(last(B.linearSearchSteps(a, 7)).counters.comparisons, 1, 'target first: best case');
  assert.equal(last(B.linearSearchSteps(a, 5)).counters.comparisons, 5, 'target last');
  const absent = last(B.linearSearchSteps(a, 4));
  assert.equal(absent.counters.comparisons, 5, 'absent: every value is checked');
  assert.equal(absent.result, -1);
  assert.equal(last(B.linearSearchSteps(a, 3)).result, 1, 'duplicates: the first copy is found');
  const e = B.linearSearchSteps([], 1);
  assert.equal(e.length, 1); assert.equal(e[0].counters.comparisons, 0); assert.equal(e[0].result, -1);
  const rng = V.rng(11);
  for (let trial = 0; trial < 50; trial++) {
    const arr = randomArray(rng, rng.int(1, 12), 1, 9), t = rng.int(1, 10);
    const end = last(B.linearSearchSteps(arr, t)), idx = arr.indexOf(t);
    assert.equal(end.result, idx);
    assert.equal(end.counters.comparisons, idx === -1 ? arr.length : idx + 1);
    // truthful states: only the found item is 'found'
    const found = end.view.items.filter(x => x.state === 'found');
    assert.equal(found.length, idx === -1 ? 0 : 1);
  }
});

test('searchHistogram: k + 1 comparisons at position k, n when absent, mean (n + 1) / 2 over positions', () => {
  const h = B.searchHistogram(10);
  assert.equal(h.length, 11);
  assert.deepEqual(h.slice(0, 10).map(x => x.comparisons), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(h[10].comparisons, 10);
  const mean = h.slice(0, 10).reduce((s, x) => s + x.comparisons, 0) / 10;
  assert.equal(mean, 5.5);
});

/* ------------------------------------------------------------------ operation counter + amortized */
test('snippetOps: loop counts match the formulas', () => {
  for (let n = 1; n <= 64; n++) {
    assert.equal(B.snippetOps('constant', n), 1);
    assert.equal(B.snippetOps('linear', n), n);
    assert.equal(B.snippetOps('halving', n), Math.floor(Math.log2(n)));
    assert.equal(B.snippetOps('nested', n), n * n);
    assert.equal(B.halvingTrail(n).length, B.snippetOps('halving', n));
  }
  assert.deepEqual(B.halvingTrail(20), [20, 10, 5, 2]);
});

test('appendSteps: copies happen at powers of two and the total stays under 3m', () => {
  for (const m of [1, 2, 5, 16, 17, 100]) {
    const steps = B.appendSteps(m);
    assert.equal(steps.length, m + 1);
    const end = last(steps);
    assert.ok(end.total < 3 * m, `total ${end.total} < 3·${m}`);
    assert.ok(end.cap >= m && end.cap < 2 * m + 1);
    steps.slice(1).forEach(s => {
      const isPow = s.k > 1 && ((s.k - 1) & (s.k - 2)) === 0;
      assert.equal(s.resized, isPow, `append #${s.k} resizes only after a power of two`);
      assert.equal(s.cost, s.copies + 1);
      assert.equal(s.costs.length, s.k);
    });
  }
});

/* ------------------------------------------------------------------ lab generators */
test('lab: every generator handles empty and single inputs', () => {
  for (const alg of B.LAB) {
    for (const input of [[], [4]]) {
      const steps = B.labSteps(alg.id, input, 99);
      assert.ok(steps.length >= 1, `${alg.id} on ${JSON.stringify(input)}`);
      const end = last(steps);
      assert.ok(Object.prototype.hasOwnProperty.call(end.counters, alg.op), `${alg.id} reports its operation`);
      if (alg.id === 'subsetSum') assert.equal(end.counters.subsets, 1 << input.length);
      else if (alg.id === 'binarySearch') assert.equal(end.counters.probes, input.length);
      else assert.equal(end.counters[alg.op], 0);
    }
  }
});

test('lab: counter keys are identical on every step of a trace', () => {
  const rng = V.rng(3);
  for (const alg of B.LAB) {
    const steps = B.labSteps(alg.id, randomArray(rng, Math.min(alg.maxN, 6), 1, 20), 17);
    const keys = JSON.stringify(Object.keys(steps[0].counters));
    steps.forEach(s => assert.equal(JSON.stringify(Object.keys(s.counters)), keys, alg.id));
    steps.forEach(s => assert.ok(typeof s.caption === 'string' && s.caption.length > 10, `${alg.id} captions every step`));
  }
});

test('lab: find max makes n − 1 comparisons and reports the first maximum', () => {
  const rng = V.rng(21);
  for (let trial = 0; trial < 40; trial++) {
    const a = randomArray(rng, rng.int(1, 16), -5, 9);
    const steps = B.findMaxSteps(a), end = last(steps);
    assert.equal(end.counters.comparisons, a.length - 1);
    const found = end.view.items.findIndex(x => x.state === 'found');
    assert.equal(found, a.indexOf(Math.max(...a)), 'first copy of the maximum');
  }
  assert.equal(last(B.findMaxSteps([1, 2, 3, 4])).counters.comparisons, 3, 'sorted');
  assert.equal(last(B.findMaxSteps([4, 3, 2, 1])).counters.comparisons, 3, 'reversed');
});

test('lab: pair sum matches brute force, including early exits', () => {
  const rng = V.rng(8);
  for (let trial = 0; trial < 80; trial++) {
    const a = randomArray(rng, rng.int(0, 12), 1, 20), t = rng.int(2, 45);
    const ref = refPairChecks(a, t), end = last(B.pairSumSteps(a, t));
    assert.equal(end.counters.pairs, ref.checks);
    assert.equal(end.kind === 'found', ref.found);
  }
  assert.equal(last(B.pairSumSteps([1, 2, 3, 4, 5, 6, 7, 8], 1000)).counters.pairs, 28, 'absent target: n(n−1)/2');
  assert.equal(last(B.pairSumSteps([3, 3], 6)).counters.pairs, 1, 'duplicates can pair');
});

test('lab: binary search matches the reference on sorted input (the lab sorts for you)', () => {
  const rng = V.rng(13);
  for (let trial = 0; trial < 80; trial++) {
    const a = randomArray(rng, rng.int(1, 16), 1, 30), t = rng.int(0, 31);
    const sorted = a.slice().sort((x, y) => x - y);
    const ref = refBinaryProbes(sorted, t);
    const steps = B.labSteps('binarySearch', a, t), end = last(steps);
    assert.equal(end.counters.probes, ref.probes);
    assert.equal(end.kind === 'found', ref.index !== -1);
    assert.ok(end.counters.probes <= Math.floor(Math.log2(a.length)) + 1, 'never more than ⌊log₂ n⌋ + 1 probes');
    if (ref.index !== -1) assert.equal(end.view.items[ref.index].state, 'found');
  }
});

test('lab: bubble sort sorts, compares n(n − 1)/2 times, swaps once per inversion, and marks only final items done', () => {
  const rng = V.rng(17);
  const cases = [[], [1], [2, 1], [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [3, 3, 1, 3]];
  for (let trial = 0; trial < 30; trial++) cases.push(randomArray(rng, rng.int(2, 10), 1, 9));
  for (const a of cases) {
    const steps = B.bubbleSortSteps(a), end = last(steps);
    const out = end.view.items.map(x => x.value);
    assert.deepEqual(out, a.slice().sort((x, y) => x - y));
    assert.equal(end.counters.comparisons, (a.length * (a.length - 1) / 2) || 0);
    assert.equal(end.counters.swaps, inversions(a));
    steps.forEach(s => s.view.items.forEach((it, k) => {
      if (it.state === 'done') {
        const final = a.slice().sort((x, y) => x - y)[k];
        assert.equal(it.value, final, 'a done item holds its final value');
      }
    }));
    // identity: every id appears exactly once in every step
    steps.forEach(s => assert.equal(new Set(s.view.items.map(x => x.id)).size, a.length));
  }
});

test('lab: subset sum checks subsets in mask order until one matches', () => {
  const rng = V.rng(29);
  for (let trial = 0; trial < 60; trial++) {
    const a = randomArray(rng, rng.int(0, 6), 1, 12), t = rng.int(1, 60);
    const ref = refSubsets(a, t), end = last(B.subsetSumSteps(a, t));
    assert.equal(end.counters.subsets, ref.checked);
    assert.equal(end.kind === 'found', ref.found);
  }
  assert.equal(last(B.subsetSumSteps([1, 2, 4, 8, 16], 1000)).counters.subsets, 32, 'absent: all 2ⁿ subsets');
  assert.equal(last(B.subsetSumSteps([5, 5], 0)).counters.subsets, 1, 'target 0: the empty set matches first');
});

test('lab: merge sort sorts and counts the same comparisons as a reference merge sort', () => {
  const rng = V.rng(31);
  const cases = [[], [1], [2, 1], [1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1], [4, 4, 4, 4], [5, 1, 4, 1, 5, 9, 2, 6, 5, 3]];
  for (let trial = 0; trial < 40; trial++) cases.push(randomArray(rng, rng.int(2, 10), 1, 20));
  for (const a of cases) {
    const steps = B.mergeSortSteps(a), end = last(steps);
    const rowA = end.view.rows ? end.view.rows[0].items.map(x => x.value) : end.view.items.map(x => x.value);
    assert.deepEqual(rowA, a.slice().sort((x, y) => x - y));
    assert.equal(end.counters.comparisons, refMergeComparisons(a));
    if (a.length > 1) {
      // every id lives in exactly one row at every step
      steps.forEach(s => {
        const all = s.view.rows[0].items.concat(s.view.rows[1].items).map(x => x.id);
        assert.equal(new Set(all).size, a.length, 'each item is in a or in out, never both');
        assert.equal(all.length, a.length);
      });
      // only the final step claims 'done'
      steps.slice(0, -1).forEach(s => s.view.rows[0].items.forEach(it => assert.notEqual(it.state, 'done')));
      assert.ok(end.counters.comparisons <= a.length * Math.ceil(Math.log2(a.length)), 'at most n⌈log₂ n⌉');
    }
  }
});

test('lab: countOps agrees with the last step and the theory curve bounds the worst case', () => {
  for (const alg of B.LAB) {
    for (let n = 1; n <= alg.maxN; n++) {
      const worst = alg.id === 'binarySearch'
        ? B.countOps(alg.id, Array.from({ length: n }, (_, k) => 2 * k + 1), 1000)   // target above every value: the longest path
        : alg.id === 'pairSum' || alg.id === 'subsetSum'
        ? B.countOps(alg.id, Array.from({ length: n }, (_, k) => 2 * k + 1), -1)   // odd values, target −1: absent
        : B.countOps(alg.id, Array.from({ length: n }, (_, k) => n - k), 0);       // reversed
      if (alg.id === 'mergeSort') assert.ok(worst <= Math.max(0, n * Math.ceil(Math.log2(n))), `merge n=${n}`);
      else assert.equal(worst, alg.theory(n), `${alg.id} worst case at n=${n}`);
    }
  }
});

/* ------------------------------------------------------------------ flowchart */
test('flowchart: every trace follows edges of the diagram and ends on its answer', () => {
  const ids = new Set(B.FLOW.nodes.map(n => n.id));
  const edges = new Set(B.FLOW.edges.map(e => e.from + '->' + e.to));
  B.FLOW.edges.forEach(e => { assert.ok(ids.has(e.from)); assert.ok(ids.has(e.to)); });
  const answers = { o1: '1', ologn: 'logn', on: 'n', onlogn: 'nlogn', rnlogn: 'nlogn', on2: 'n2', o2n: '2n' };
  for (const [name, tr] of Object.entries(B.FLOW_TRACES)) {
    assert.equal(tr.path[0], 'start', name);
    for (let k = 1; k < tr.path.length; k++) assert.ok(edges.has(tr.path[k - 1] + '->' + tr.path[k]), `${name}: ${tr.path[k - 1]} -> ${tr.path[k]}`);
    assert.equal(answers[tr.path[tr.path.length - 1]], tr.answer, `${name} ends on ${tr.answer}`);
  }
});
