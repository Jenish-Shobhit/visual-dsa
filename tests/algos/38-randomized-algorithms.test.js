/* Generators and models for lesson 38 (js/algos/38-randomized-algorithms.js).
   Run: node --test tests/algos/38-randomized-algorithms.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const R = require(path.join(ROOT, 'js', 'algos', '38-randomized-algorithms.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const range = (n) => Array.from({ length: n }, (_, i) => i);

/* every step: known states, code labels present in every language */
function labelsOf(name) {
  const out = {};
  ['pseudo', 'js', 'py'].forEach((lang) => { out[lang] = new Set(Object.keys(code.parse(R.CODE[name][lang], lang === 'py' ? 'py' : 'js').labels)); });
  return out;
}
function checkLines(steps, codeName) {
  const L = labelsOf(codeName);
  steps.forEach((s, i) => {
    if (s.line === null || s.line === undefined) return;
    (Array.isArray(s.line) ? s.line : [s.line]).forEach((l) => {
      ['pseudo', 'js', 'py'].forEach((lang) => assert.ok(L[lang].has(l), `step ${i} line "${l}" missing in ${lang} of ${codeName}`));
    });
  });
}

/* ------------------------------------------------------------ Monte Carlo pi */
test('pi darts are reproducible and inside means x^2 + y^2 <= 1', () => {
  const a = R.piDarts(500, 7), b = R.piDarts(500, 7), c = R.piDarts(500, 8);
  assert.deepEqual(a.darts, b.darts);
  assert.notDeepEqual(a.darts, c.darts);
  a.darts.forEach((d) => assert.equal(d.inside, d.x * d.x + d.y * d.y <= 1));
  assert.equal(a.inside, a.darts.filter((d) => d.inside).length);
  assert.equal(a.estimate, 4 * a.inside / 500);
});
test('pi thrower in batches equals one big throw', () => {
  const t = R.piThrower(3);
  const parts = [].concat(t.throwDarts(10), t.throwDarts(90), t.throwDarts(400));
  assert.deepEqual(parts, R.piDarts(500, 3).darts);
  assert.equal(t.total, 500);
});
test('pi estimate converges and the error shrinks like 1/sqrt(n)', () => {
  const big = R.piDarts(200000, 11);
  assert.ok(Math.abs(big.estimate - Math.PI) < 0.03);
  const e1 = R.piMeanError(100, 400, 1), e2 = R.piMeanError(10000, 400, 2);
  assert.ok(e1 / e2 > 6 && e1 / e2 < 15, 'error ratio for 100x more darts should be near 10, got ' + e1 / e2);
  assert.ok(Math.abs(R.piStd(10000) - 0.01642) < 0.0005);
  const series = R.piSeries(R.piDarts(1000, 5).darts, 30);
  assert.equal(series[0][0], 1); assert.equal(series[series.length - 1][0], 1000);
});
test('pi steps grow monotonically and end with the total', () => {
  const steps = R.piSteps(400, 2);
  assert.equal(steps[0].k, 0);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].k > steps[i - 1].k && steps[i].darts.length === steps[i].k);
  assert.equal(steps[steps.length - 1].k, 400);
  const s = steps[steps.length - 1];
  assert.equal(s.estimate, 4 * s.darts.filter((d) => d.inside).length / 400);
});

/* ------------------------------------------------------------ shuffles */
function isPerm(a, n) { return [...a].sort((x, y) => x - y).join() === range(n).join(); }
test('shuffles return permutations and do not mutate the input', () => {
  const rng = core.rng(1);
  [0, 1, 2, 5, 9].forEach((n) => {
    const a = range(n);
    ['shuffleNaive', 'fisherYates'].forEach((fn) => {
      const out = R[fn](a, rng);
      assert.ok(isPerm(out, n));
      assert.deepEqual(a, range(n));
    });
  });
});
test('shuffle steps replay the plain functions with the same seed', () => {
  [['naive', R.shuffleNaive], ['fisher-yates', R.fisherYates]].forEach(([kind, fn]) => {
    [0, 1, 2, 3, 6, 8].forEach((n) => {
      const vals = range(n).map((i) => 'ABCDEFGH'[i]);
      const steps = R.shuffleSteps(kind, vals, 5);
      const last = steps[steps.length - 1];
      assert.deepEqual(last.items.map((x) => x.value), fn(vals, core.rng(5)), `${kind} n=${n}`);
      const ids = new Set(); last.items.forEach((x) => ids.add(x.id)); assert.equal(ids.size, n);
      checkLines(steps, kind === 'naive' ? 'shuffleNaive' : 'fisherYates');
      steps.forEach((s) => s.items.forEach((it) => assert.ok(STATES.has(it.state))));
    });
  });
});
test('Fisher-Yates marks a slot done only once it is final; naive never claims done', () => {
  const steps = R.shuffleSteps('fisher-yates', ['A', 'B', 'C', 'D', 'E'], 9);
  const final = steps[steps.length - 1].items.map((x) => x.id);
  steps.forEach((s, k) => {
    s.items.forEach((it, slot) => {
      if (it.state === 'done') assert.equal(steps[steps.length - 1].items[slot].id, it.id, 'done slot ' + slot + ' at step ' + k + ' must never change again');
    });
  });
  assert.ok(steps[steps.length - 1].items.every((x) => x.state === 'done'));
  assert.equal(final.length, 5);
  R.shuffleSteps('naive', ['A', 'B', 'C', 'D'], 3).forEach((s) => s.items.forEach((it) => assert.notEqual(it.state, 'done')));
});
test('naive shuffle is biased, Fisher-Yates is uniform (exact and simulated)', () => {
  const n = 5, exact = R.naiveExact(n);
  exact.forEach((row) => { assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-12); });
  for (let p = 0; p < n; p++) assert.ok(Math.abs(exact.reduce((a, r) => a + r[p], 0) - 1) < 1e-12);
  assert.ok(R.matrixBias(exact) > 0.03);
  const sim = R.shuffleMatrix('naive', n, 60000, 4);
  for (let x = 0; x < n; x++) for (let p = 0; p < n; p++) assert.ok(Math.abs(sim.probs[x][p] - exact[x][p]) < 0.01, `naive cell ${x},${p}`);
  const fy = R.shuffleMatrix('fisher-yates', n, 60000, 4);
  assert.ok(fy.bias < 0.01, 'fisher-yates bias ' + fy.bias);
  assert.ok(R.matrixBias(R.naiveExact(3)) > 0.03);
  // n = 3: 27 equally likely draw sequences cannot split evenly into 6 orders
  const p3 = R.naiveExact(3);
  assert.ok(Math.abs(p3[1][0] - 10 / 27) < 1e-12);
});
test('naive exact for n = 3 matches full enumeration of the 27 draw sequences', () => {
  const counts = {};
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    const p = [0, 1, 2];
    [a, b, c].forEach((j, i) => { const t = p[i]; p[i] = p[j]; p[j] = t; });
    const key = p.join(''); counts[key] = (counts[key] || 0) + 1;
  }
  const exact = R.naiveExact(3);
  for (let x = 0; x < 3; x++) for (let pos = 0; pos < 3; pos++) {
    let c = 0; Object.keys(counts).forEach((k) => { if (+k[pos] === x) c += counts[k]; });
    assert.ok(Math.abs(exact[x][pos] - c / 27) < 1e-12, `item ${x} slot ${pos}`);
  }
});

/* ------------------------------------------------------------ reservoir */
test('reservoir steps end with the reference reservoir (same random draws)', () => {
  const rng = core.rng(21);
  for (let trial = 0; trial < 60; trial++) {
    const n = rng.int(0, 16), k = rng.int(1, 6), seed = rng.int(1, 9999);
    const stream = range(n).map((i) => String.fromCharCode(65 + i));
    const steps = R.reservoirSteps(stream, k, seed);
    const last = steps[steps.length - 1];
    const ref = R.reservoirReference(stream, k, core.rng(seed));
    const got = last.reservoir.filter((x) => x !== null).map((id) => stream[+id.slice(1)]);
    assert.deepEqual(got, ref, `n=${n} k=${k} seed=${seed}`);
    assert.equal(got.length, Math.min(n, k));
    checkLines(steps, 'reservoir');
    steps.forEach((s) => {
      assert.equal(s.reservoir.length, k);
      assert.ok(s.counters.kept - s.counters.replaced <= k);
    });
  }
});
test('reservoir: first k always kept; item i>k kept with probability k/i', () => {
  const steps = R.reservoirSteps('ABCDEFGHIJ'.split(''), 3, 4);
  const fills = steps.filter((s) => s.kind === 'fill'); assert.equal(fills.length, 3);
  steps.filter((s) => s.kind === 'roll').forEach((s) => { assert.equal(s.roll.k, 3); assert.ok(s.roll.j >= 1 && s.roll.j <= s.roll.i); });
  // stream shorter than k
  const short = R.reservoirSteps(['x', 'y'], 5, 1);
  assert.deepEqual(short[short.length - 1].reservoir.filter(Boolean).length, 2);
  assert.equal(R.reservoirSteps([], 3, 1).length, 2);
});
test('reservoir inclusion is uniform: every item appears about runs*k/n times', () => {
  const n = 10, k = 3, runs = 30000, counts = R.reservoirInclusion(n, k, runs, 8);
  const expect = runs * k / n;
  counts.forEach((c, i) => assert.ok(Math.abs(c - expect) < 5 * Math.sqrt(runs * 0.3 * 0.7), `item ${i}: ${c} vs ${expect}`));
  assert.equal(counts.reduce((a, b) => a + b, 0), runs * k);
});
test('the 10th item of a stream enters a size-3 reservoir with probability 3/10', () => {
  let inRes = 0; const runs = 40000, rng = core.rng(2), stream = range(10);
  for (let r = 0; r < runs; r++) if (R.reservoirReference(stream, 3, rng).includes(9)) inRes++;
  assert.ok(Math.abs(inRes / runs - 0.3) < 0.01);
});

/* ------------------------------------------------------------ skip lists */
function sortedKeys(list) { return list.keys.map((n) => n.key); }
test('skip list build is sorted, unique, capped, and reproducible', () => {
  const l1 = R.skipBuild([50, 20, 70, 10, 30, 60, 90, 20], 3), l2 = R.skipBuild([50, 20, 70, 10, 30, 60, 90, 20], 3);
  assert.deepEqual(sortedKeys(l1), [10, 20, 30, 50, 60, 70, 90]);
  assert.deepEqual(l1, l2);
  l1.keys.forEach((n) => assert.ok(n.h >= 1 && n.h <= R.MAX_LEVEL));
});
test('skip list search finds exactly the keys present', () => {
  const rng = core.rng(5);
  for (let t = 0; t < 40; t++) {
    const keys = range(rng.int(0, 14)).map(() => rng.int(1, 60));
    const list = R.skipBuild(keys, rng.int(1, 999));
    for (let key = 0; key <= 62; key += 1) {
      const res = R.skipSearchSteps(list, key);
      assert.equal(res.found, sortedKeys(list).includes(key), `key ${key}`);
      const last = res.steps[res.steps.length - 1];
      assert.equal(last.found, res.found);
      assert.deepEqual(R.skipCost(list, key).compares, res.cost.compares);
      checkLines(res.steps, 'skipSearch');
      res.steps.forEach((s) => { assert.equal(s.nodes.length, list.keys.length); s.nodes.forEach((n) => assert.ok(STATES.has(n.state))); });
      // counters only grow
      for (let i = 1; i < res.steps.length; i++) ['compares', 'hops', 'drops'].forEach((c) => assert.ok(res.steps[i].counters[c] >= res.steps[i - 1].counters[c]));
    }
  }
});
test('skip search on an empty list and a single key', () => {
  const empty = { keys: [] };
  const r0 = R.skipSearchSteps(empty, 5); assert.equal(r0.found, false); assert.ok(r0.steps.length >= 3);
  const one = R.skipBuild([7], 1);
  assert.equal(R.skipSearchSteps(one, 7).found, true);
  assert.equal(R.skipSearchSteps(one, 3).found, false);
  assert.equal(R.skipSearchSteps(one, 9).found, false);
});
test('skip list search only ever moves right and down along real pointers', () => {
  const list = R.skipBuild([5, 15, 25, 35, 45, 55, 65, 75], 12);
  const res = R.skipSearchSteps(list, 65);
  const path = res.steps[res.steps.length - 1].path;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (b.level === a.level) {
      assert.ok(b.key > (a.key === null ? -Infinity : a.key));
      const node = list.keys.find((n) => n.key === b.key); assert.ok(node.h >= b.level);
    } else { assert.equal(b.level, a.level - 1); assert.equal(b.key, a.key); }
  }
});
test('skip insert steps produce the same list as the pure model with the same coins', () => {
  const rng = core.rng(9);
  for (let t = 0; t < 40; t++) {
    let list = R.skipBuild(range(rng.int(0, 10)).map(() => rng.int(1, 40)), rng.int(1, 99));
    const key = rng.int(1, 40), seed = rng.int(1, 9999);
    const plain = R.skipInsert(list, key, core.rng(seed));
    const res = R.skipInsertSteps(list, key, core.rng(seed));
    assert.deepEqual(res.list, plain.list);
    assert.equal(res.added, plain.added);
    checkLines(res.steps, 'skipInsert');
    const last = res.steps[res.steps.length - 1];
    assert.deepEqual(last.nodes.map((n) => n.key), sortedKeys(plain.list));
    if (plain.added) {
      const node = last.nodes.find((n) => n.key === key);
      assert.equal(node.h, plain.height);
      assert.equal(res.steps.filter((s) => s.kind === 'link').length, plain.height);
      assert.equal(res.steps.filter((s) => s.kind === 'flip').length, plain.flips.length);
    }
  }
});
test('tower heights follow the fair-coin distribution', () => {
  const rng = core.rng(3), hist = [0, 0, 0, 0, 0, 0]; const N = 40000;
  for (let i = 0; i < N; i++) hist[R.flipTower(rng, 40).h]++;
  assert.ok(Math.abs(hist[1] / N - 0.5) < 0.01); assert.ok(Math.abs(hist[2] / N - 0.25) < 0.01); assert.ok(Math.abs(hist[3] / N - 0.125) < 0.01);
});
test('expected skip list height and search cost grow like log n, not n', () => {
  assert.ok(R.skipExpectedHeight(16) > 5 && R.skipExpectedHeight(16) < 5.6);
  assert.ok(Math.abs(R.skipExpectedHeight(1024) - 11.33) < 0.1);
  const small = R.skipAverageCost(64, 40, 1), big = R.skipAverageCost(1024, 40, 2);
  assert.ok(big.skip < small.skip * 3, 'search cost should grow slowly');
  assert.ok(big.plain > big.skip * 10);
  assert.ok(Math.abs(big.height - R.skipExpectedHeight(1024)) < 1.2);
});

/* ------------------------------------------------------------ Bloom */
test('bloom indexes are stable, in range, and differ across words', () => {
  const a = R.bloomIndexes('cat', 32, 3), b = R.bloomIndexes('cat', 32, 3);
  assert.deepEqual(a, b); assert.equal(a.length, 3);
  a.forEach((x) => assert.ok(Number.isInteger(x) && x >= 0 && x < 32));
  assert.notDeepEqual(R.bloomIndexes('cat', 32, 3), R.bloomIndexes('dog', 32, 3));
  assert.equal(R.bloomIndexes('x', 8, 1).length, 1);
});
test('bloom filter never has a false negative, and steps tell the truth', () => {
  const rng = core.rng(4);
  for (let t = 0; t < 30; t++) {
    let st = R.bloomStart(rng.pick([16, 24, 32, 48]), rng.int(1, 5));
    const added = [];
    for (let i = 0; i < rng.int(0, 12); i++) {
      const w = 'w' + rng.int(1, 40);
      const r = R.bloomOpSteps(st, 'add', w); st = r.state; added.push(w);
      checkLines(r.steps, 'bloomAdd');
      R.bloomIndexes(w, st.m, st.k).forEach((b) => assert.equal(st.bits[b], 1));
    }
    for (let q = 1; q <= 40; q++) {
      const w = 'w' + q, r = R.bloomOpSteps(st, 'check', w), last = r.steps[r.steps.length - 1];
      checkLines(r.steps, 'bloomCheck');
      const allOnes = R.bloomIndexes(w, st.m, st.k).every((b) => st.bits[b] === 1);
      if (added.includes(w)) assert.equal(last.verdict, 'maybe', 'false negative for ' + w);
      else assert.equal(last.verdict, allOnes ? 'false-positive' : 'no');
      assert.equal(last.verdict === 'no', !allOnes);
      assert.deepEqual(r.state.bits, st.bits, 'a check must not change the bits');
    }
  }
});
test('bloom add steps do not mutate the input state and only ever set bits', () => {
  const s0 = R.bloomStart(24, 3), r = R.bloomOpSteps(s0, 'add', 'cat');
  assert.equal(s0.bits.reduce((a, b) => a + b, 0), 0);
  assert.equal(r.state.adds, 1);
  const r2 = R.bloomOpSteps(r.state, 'add', 'dog');
  r2.state.bits.forEach((b, i) => assert.ok(b >= r.state.bits[i]));
});
test('bloom false-positive rate: formula matches measurement', () => {
  [[128, 3, 16], [256, 4, 40], [64, 2, 10]].forEach(([m, k, n]) => {
    const theory = R.bloomFpRate(m, k, n), meas = R.bloomEmpiricalFp(m, k, n, 20000, 1);
    assert.ok(Math.abs(theory - meas) < Math.max(0.02, theory * 0.4), `m=${m} k=${k} n=${n}: ${theory} vs ${meas}`);
  });
  assert.equal(R.bloomFpRate(64, 3, 0), 0);
  assert.ok(R.bloomFpRate(64, 3, 100) > 0.9);
  assert.ok(Math.abs(R.bloomBestK(100, 10) - 6.93) < 0.01);
  assert.ok(R.bloomFpRate(96, 7, 10) < 0.01);
});

/* ------------------------------------------------------------ quicksort vs an adversary */
test('a fixed pivot is quadratic on sorted input, a random pivot is not', () => {
  const n = 128, sorted = R.quickInputs('sorted', n);
  const fixed = R.quickComparisons(sorted, 'last');
  const rand = [1, 2, 3, 4, 5].map((s) => R.quickComparisons(sorted, 'random', s));
  assert.ok(fixed >= n * (n - 1) / 2 - 1, 'fixed ' + fixed);
  rand.forEach((c) => assert.ok(c < 4 * n * Math.log2(n), 'random ' + c));
  assert.deepEqual(R.quickInputs('sorted', 4), [1, 2, 3, 4]);
  assert.deepEqual(R.quickInputs('reversed', 4), [4, 3, 2, 1]);
  assert.equal(new Set(R.quickInputs('equal', 6)).size, 1);
  assert.ok(isPermFrom1(R.quickInputs('random', 20, 3), 20));
});
function isPermFrom1(a, n) { return [...a].sort((x, y) => x - y).join() === range(n).map((i) => i + 1).join(); }
test('the hill-climbing adversary beats a random input for every fixed rule', () => {
  ['last', 'first', 'middle', 'median3'].forEach((rule) => {
    const n = 24, adv = R.adversaryInput(n, rule, 1, 1500);
    assert.ok(isPermFrom1(adv, n));
    const advCost = R.quickComparisons(adv, rule), randCost = R.quickComparisons(R.quickInputs('random', n, 7), rule);
    assert.ok(advCost > randCost * 1.15, `${rule}: adversary ${advCost} vs random ${randCost}`);
    assert.deepEqual(R.adversaryInput(n, rule, 1, 1500), adv, 'deterministic');
  });
});
