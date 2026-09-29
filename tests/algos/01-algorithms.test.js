/* Lesson 01 · What is an algorithm? — step generator tests (node --test tests/algos/01-algorithms.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const V = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const L = require(path.join(ROOT, 'js', 'algos', '01-algorithms.js'));

function randomList(rng, n, lo, hi) { const a = []; for (let i = 0; i < n; i++) a.push(rng.int(lo, hi)); return a; }
const FLOW_IDS = ['start', 'take', 'more', 'bigger', 'update', 'next', 'output'];
const LINES = [null, 'take', 'more', 'bigger', 'update', 'next', 'output'];

/* ------------------------------------------------------------------ findMaxTrace */
function checkTrace(values) {
  const steps = L.findMaxTrace(values);
  const n = values.length;
  const last = steps[steps.length - 1];
  assert.ok(steps.length >= 1);
  if (!n) { assert.equal(steps.length, 1); assert.equal(last.kind, 'empty'); return steps; }
  const max = Math.max(...values);
  // answer
  assert.equal(last.kind, 'done');
  assert.equal(values[last.best], max, 'reported best is the maximum');
  assert.equal(last.best, values.indexOf(max), 'strict > keeps the FIRST copy of the maximum');
  assert.equal(last.vars.best, max);
  // counts
  assert.equal(last.counters.comparisons, n - 1, 'n − 1 comparisons in every case');
  assert.equal(last.counters.flips, n);
  let updates = 0, run = values[0];
  for (let i = 1; i < n; i++) if (values[i] > run) { run = values[i]; updates++; }
  assert.equal(last.counters.updates, updates);
  // every step is well formed and truthful
  steps.forEach((s, k) => {
    assert.ok(FLOW_IDS.includes(s.flow), 'flow id ' + s.flow);
    assert.ok(LINES.includes(s.line), 'line ' + s.line);
    assert.ok(s.eng >= 0 && s.eng <= 6);
    assert.equal(typeof s.caption, 'string');
    assert.ok(s.caption.length > 10);
    assert.deepEqual(Object.keys(s.counters), ['flips', 'comparisons', 'updates']);
    assert.equal(s.cards.length, n);
    s.cards.forEach((c, i) => {
      assert.equal(c.id, 'c' + i, 'stable ids');
      assert.equal(c.value, values[i]);
      if (!c.up) assert.equal(c.state, 'default', 'a face-down card claims nothing');
      if (c.state === 'found') assert.equal(s.kind, 'done', 'found only when finished');
    });
    const keyed = s.cards.filter(c => c.state === 'key');
    if (s.best !== null && s.kind !== 'done') {
      assert.equal(keyed.length, 1);
      assert.equal(keyed[0].id, 'c' + s.best);
      // invariant: best is the largest of the cards turned over so far
      const upVals = s.cards.filter(c => c.up).map(c => c.value);
      if (s.kind !== 'cmp') assert.equal(values[s.best], Math.max(...upVals), 'best = max of turned-over cards (step ' + k + ')');
      else assert.equal(values[s.best], Math.max(...upVals.slice(0, -1).concat([values[s.best]])));
    }
    if (s.kind === 'cmp') {
      assert.equal(s.cards.filter(c => c.state === 'compare').length, 1);
      assert.equal(s.vars['cards[i]'], values[s.ptr]);
    }
    if (s.ptr !== null) assert.ok(s.ptr >= 1 && s.ptr <= n);
    // counters never decrease
    if (k) Object.keys(s.counters).forEach(key => assert.ok(s.counters[key] >= steps[k - 1].counters[key]));
  });
  // a card is only turned over once, left to right
  for (let k = 1; k < steps.length; k++) {
    steps[k - 1].cards.forEach((c, i) => { if (c.up) assert.ok(steps[k].cards[i].up, 'cards stay face up'); });
  }
  return steps;
}

test('findMaxTrace: default example', () => {
  const steps = checkTrace([5, 3, 9, 2, 9, 12, 4]);
  assert.equal(steps[0].kind, 'start');
  assert.equal(steps[1].kind, 'take');
  assert.equal(steps[1].best, 0);
  assert.ok(steps.some(s => s.kind === 'update'));
});

test('findMaxTrace: edge cases (one card, all equal, negatives, sorted, reversed, empty)', () => {
  const one = checkTrace([42]);
  assert.deepEqual(one.map(s => s.kind), ['start', 'take', 'more', 'done']);
  assert.match(one[one.length - 1].caption, /zero comparisons/);
  const eq = checkTrace([7, 7, 7, 7]);
  assert.equal(eq[eq.length - 1].counters.updates, 0);
  assert.ok(eq.some(s => /strictly bigger/.test(s.caption)), 'equal cards are explained');
  const neg = checkTrace([-4, -9, -2, -7]);
  assert.equal(neg[neg.length - 1].vars.best, -2);
  assert.match(neg[neg.length - 1].caption, /−2/);
  const asc = checkTrace([1, 2, 3, 4, 5, 6]);
  assert.equal(asc[asc.length - 1].counters.updates, 5, 'ascending: every comparison updates');
  const desc = checkTrace([6, 5, 4, 3, 2, 1]);
  assert.equal(desc[desc.length - 1].counters.updates, 0, 'descending: no updates');
  checkTrace([3, 9, 9, 1]);
  checkTrace([]);
});

test('findMaxTrace: random inputs match a reference implementation', () => {
  const rng = V.rng(2024);
  for (let t = 0; t < 400; t++) {
    const n = rng.int(1, 12);
    const values = randomList(rng, n, -99, 99);
    checkTrace(values);
    assert.equal(L.trueMax(values), Math.max(...values));
  }
});

test('findMaxTrace: steps do not share mutable card arrays', () => {
  const steps = L.findMaxTrace([4, 1, 6]);
  assert.notEqual(steps[1].cards, steps[2].cards);
  const before = JSON.stringify(steps[1]);
  L.findMaxTrace([4, 1, 6]);
  assert.equal(JSON.stringify(steps[1]), before);
});

/* ------------------------------------------------------------------ pipeline */
test('pipelineSteps: consumes the input left to right and outputs the maximum', () => {
  const rng = V.rng(7);
  for (let t = 0; t < 100; t++) {
    const values = randomList(rng, rng.int(1, 8), -20, 20);
    const steps = L.pipelineSteps(values);
    assert.equal(steps.length, values.length + 2);
    steps.forEach((s, k) => {
      assert.equal(s.tray.length + s.taken, values.length);
      if (k >= 1 && k <= values.length) assert.equal(s.best, Math.max(...values.slice(0, k)));
    });
    assert.equal(steps[steps.length - 1].out, Math.max(...values));
  }
  const empty = L.pipelineSteps([]);
  assert.equal(empty[empty.length - 1].out, null);
});

/* ------------------------------------------------------------------ scan patterns */
test('scanPattern: min, sum and count agree with direct computation', () => {
  const rng = V.rng(99);
  for (let t = 0; t < 100; t++) {
    const values = randomList(rng, rng.int(1, 8), -9, 9);
    const min = L.scanPattern(values, 'min');
    assert.equal(min[min.length - 1].hand.value, Math.min(...values));
    assert.equal(values[min[min.length - 1].best], Math.min(...values));
    const sum = L.scanPattern(values, 'sum');
    assert.equal(sum[sum.length - 1].hand.value, values.reduce((a, b) => a + b, 0));
    const target = values[0];
    const count = L.scanPattern(values, 'count', target);
    assert.equal(count[count.length - 1].hand.value, values.filter(v => v === target).length);
    [min, sum, count].forEach(steps => assert.equal(steps.length, values.length + 2));
  }
});

/* ------------------------------------------------------------------ correct vs buggy versions */
test('runFindMax: the correct version passes every bench row; each bug fails at least one', () => {
  const correct = L.benchResults('correct');
  assert.ok(correct.every(r => r.pass));
  const fails = {};
  L.VARIANTS.forEach(v => { fails[v] = L.benchResults(v).filter(r => !r.pass).map(r => r.id); });
  assert.deepEqual(fails.correct, []);
  assert.deepEqual(fails.zero, ['negative']);
  assert.deepEqual(fails.early, ['last']);
  assert.deepEqual(fails.skipLast, ['last']);
  assert.deepEqual(fails.stuck, ['mixed', 'first', 'last', 'equal', 'negative'], 'one card: the loop never runs, so even the stuck version answers');
  const stuck = L.benchResults('stuck').find(r => r.id === 'mixed');
  assert.equal(stuck.halted, false);
  assert.equal(stuck.loops, 1000);
});

test('runFindMax: correct variant equals the maximum on random input', () => {
  const rng = V.rng(5);
  for (let t = 0; t < 300; t++) {
    const values = randomList(rng, rng.int(1, 10), -50, 50);
    assert.equal(L.runFindMax(values, 'correct').result, Math.max(...values));
    const z = L.runFindMax(values, 'zero').result;
    assert.equal(z, Math.max(0, ...values), 'zero bug returns max(0, …)');
  }
});

/* ------------------------------------------------------------------ guessing */
test('guessCountUp and guessHalving find every secret', () => {
  for (const n of [1, 2, 3, 7, 10, 100, 1000]) {
    let worst = 0;
    for (let s = 1; s <= n; s++) {
      const a = L.guessCountUp(s, n);
      assert.equal(a.length, s);
      assert.equal(a[a.length - 1].guess, s);
      assert.equal(a[a.length - 1].reply, 'correct');
      const b = L.guessHalving(s, n);
      assert.equal(b[b.length - 1].guess, s);
      assert.equal(b[b.length - 1].reply, 'correct');
      b.forEach(g => {
        assert.ok(g.lo <= s && s <= g.hi, 'secret stays inside the band');
        assert.equal(g.guess, Math.floor((g.lo + g.hi) / 2));
        if (g.reply === 'higher') assert.ok(g.guess < s);
        if (g.reply === 'lower') assert.ok(g.guess > s);
      });
      worst = Math.max(worst, b.length);
    }
    assert.equal(worst, L.worstHalving(n), 'worst case for n = ' + n);
    assert.equal(L.worstHalving(n), Math.ceil(Math.log2(n + 1)));
  }
  assert.equal(L.worstHalving(1000), 10, 'the 1..1000 quiz answer');
  assert.equal(L.worstHalving(100), 7);
  assert.equal(L.worstHalving(1000000), 20);
  assert.throws(() => L.guessHalving(0, 10), RangeError);
  assert.throws(() => L.guessCountUp(11, 10), RangeError);
  assert.throws(() => L.guessCountUp(2.5, 10), RangeError);
});

test('guessStats and raceSteps', () => {
  const st = L.guessStats(100);
  assert.equal(st.countUp.length, 100);
  assert.equal(st.maxHalving, 7);
  assert.equal(st.avgCountUp, 50.5);
  assert.ok(st.avgHalving > 5 && st.avgHalving < 6.5);
  const rng = V.rng(3);
  for (let t = 0; t < 60; t++) {
    const s = rng.int(1, 100);
    const steps = L.raceSteps(s, 100);
    const a = L.guessCountUp(s, 100).length, b = L.guessHalving(s, 100).length;
    assert.equal(steps.length, Math.max(a, b) + 1);
    const last = steps[steps.length - 1];
    assert.ok(last.up.done && last.half.done);
    assert.equal(last.up.count, a);
    assert.equal(last.half.count, b);
    assert.equal(last.up.guess, s);
    assert.equal(last.half.guess, s);
    steps.forEach(x => assert.equal(typeof x.caption, 'string'));
  }
});

/* ------------------------------------------------------------------ Euclid */
test('euclidSteps: last square is the gcd and the squares tile the rectangle', () => {
  const rng = V.rng(11);
  const cases = [[21, 12], [12, 21], [8, 5], [12, 12], [1, 1], [17, 1], [1, 17], [60, 48]];
  for (let t = 0; t < 200; t++) cases.push([rng.int(1, 60), rng.int(1, 60)]);
  for (const [W, H] of cases) {
    const steps = L.euclidSteps(W, H);
    const last = steps[steps.length - 1];
    assert.equal(last.kind, 'done');
    assert.equal(last.gcd, L.gcd(W, H), 'gcd(' + W + ', ' + H + ')');
    assert.equal(last.counters.cuts, steps.length - 2);
    assert.ok(last.counters.cuts <= Math.max(W, H) - 1);
    const sq = last.squares;
    assert.equal(sq[sq.length - 1].size, last.gcd);
    assert.equal(sq.reduce((a, s) => a + s.size * s.size, 0), W * H, 'areas add up');
    const grid = new Uint8Array(W * H);
    for (const s of sq) {
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.size <= W && s.y + s.size <= H, 'inside');
      assert.equal(s.size % last.gcd, 0, 'every square is a multiple of the gcd');
      for (let y = s.y; y < s.y + s.size; y++) for (let x = s.x; x < s.x + s.size; x++) { assert.equal(grid[y * W + x], 0, 'no overlap'); grid[y * W + x] = 1; }
    }
    steps.forEach((s, k) => {
      if (k && s.kind === 'cut') assert.equal(s.squares.length, steps[k - 1].squares.length + 1);
      assert.ok(['loop', 'cutw', 'cuth', 'ret'].includes(s.line));
      assert.deepEqual(Object.keys(s.counters), ['cuts']);
      assert.equal(s.rem.w, s.w); assert.equal(s.rem.h, s.h);
    });
  }
  assert.throws(() => L.euclidSteps(0, 4), RangeError);
  assert.throws(() => L.euclidSteps(2.5, 4), RangeError);
});
