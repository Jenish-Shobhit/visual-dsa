/* Step generators for lesson 13 (js/algos/13-binary-search.js).
   Run: node --test tests/algos/13-binary-search.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const B = require(path.join(ROOT, 'js', 'algos', '13-binary-search.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const VARIANTS = ['exact', 'lower', 'upper', 'first', 'last'];

/* ------------------------------------------------------------ straightforward references */
function refLower(a, x) { let i = 0; while (i < a.length && a[i] < x) i++; return i; }
function refUpper(a, x) { let i = 0; while (i < a.length && a[i] <= x) i++; return i; }
function refFirst(a, x) { return a.indexOf(x); }
function refLast(a, x) { return a.lastIndexOf(x); }
function refResult(variant, a, x) {
  switch (variant) {
    case 'lower': return refLower(a, x);
    case 'upper': return refUpper(a, x);
    case 'first': return refFirst(a, x);
    case 'last': return refLast(a, x);
    default: return a.indexOf(x);   // exact: any match; checked separately below
  }
}
function sortedInput(rng, maxLen, maxVal) {
  const n = rng.int(0, maxLen), a = [];
  for (let i = 0; i < n; i++) a.push(rng.int(0, maxVal));
  return a.sort((p, q) => p - q);
}
const last = steps => steps[steps.length - 1];
const EDGE = [[], [5], [5, 5], [1, 2], [1, 3, 3, 3, 5], [2, 2, 2, 2, 2, 2], [1, 2, 3, 4, 5, 6, 7], [-4, -1, 0, 3, 9]];

/* ------------------------------------------------------------ correctness */
test('every variant returns what a plain scan says, on edge cases and 400 random arrays', () => {
  const rng = core.rng(20260929);
  const inputs = EDGE.slice();
  for (let c = 0; c < 400; c++) inputs.push(sortedInput(rng, 20, 12));
  for (const a of inputs) {
    const targets = new Set([-5, 0, 6, 13, 99]);
    a.forEach(v => { targets.add(v); targets.add(v - 1); targets.add(v + 1); });
    for (const x of targets) {
      for (const variant of VARIANTS) {
        const res = B.probes(a, x, variant), steps = B.search(a, x, { variant });
        const fin = last(steps);
        if (variant === 'exact') {
          if (a.includes(x)) assert.equal(a[res.result], x, `exact finds a match on [${a}] x=${x}`);
          else assert.equal(res.result, -1, `exact absent on [${a}] x=${x}`);
        } else assert.equal(res.result, refResult(variant, a, x), `${variant} on [${a}] x=${x}`);
        assert.equal(fin.result, res.result, `${variant} last step result on [${a}] x=${x}`);
        assert.equal(fin.counters.comparisons, res.probes.length, `${variant} counter on [${a}] x=${x}`);
        assert.equal(B.count(variant, a, x), res.probes.length);
      }
    }
  }
});

test('comparisons never exceed floor(log2 n) + 1 (exact) or ceil(log2(n + 1)) (bounds)', () => {
  for (let n = 0; n <= 130; n++) {
    const a = Array.from({ length: n }, (_, i) => 2 * i);
    for (let x = -1; x <= 2 * n; x++) {
      assert.ok(B.count('exact', a, x) <= B.worstCase(n), `exact n=${n} x=${x}`);
      for (const v of ['lower', 'upper', 'first', 'last']) assert.ok(B.count(v, a, x) <= Math.ceil(Math.log2(n + 1)), `${v} n=${n} x=${x}`);
    }
  }
});

test('worstCase(n) = floor(log2 n) + 1 and is reached by some target', () => {
  assert.equal(B.worstCase(0), 0);
  assert.equal(B.worstCase(1), 1);
  assert.equal(B.worstCase(7), 3);
  assert.equal(B.worstCase(8), 4);
  assert.equal(B.worstCase(1000), 10);
  assert.equal(B.worstCase(1000000), 20);
  assert.equal(B.worstCase(1e9), 30);
  for (let n = 1; n <= 100; n++) assert.equal(B.worstMeasured(n), B.worstCase(n), `n = ${n}`);
});

test('the classic first-probe numbers', () => {
  const a = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
  const p = B.probes(a, 23, 'exact');
  assert.deepEqual(p.probes.map(q => q.mid), [4, 7, 5]);
  assert.equal(p.result, 5);
  assert.deepEqual([p.probes[0].loAfter, p.probes[0].hiAfter], [5, 9]);
  assert.deepEqual([p.probes[1].loAfter, p.probes[1].hiAfter], [5, 6]);
});

/* ------------------------------------------------------------ truthful snapshots */
test('snapshots are complete, ids are unique, states are valid, pointers are in range, counters only grow', () => {
  const rng = core.rng(11);
  const cases = EDGE.map(a => [a, a.length ? a[Math.floor(a.length / 2)] : 3]);
  for (let c = 0; c < 60; c++) { const a = sortedInput(rng, 16, 10); cases.push([a, rng.int(-1, 11)]); }
  for (const [a, x] of cases) for (const variant of VARIANTS) {
    const steps = B.search(a, x, { variant });
    let prevCmp = -1;
    steps.forEach((s, k) => {
      const ctx = `${variant} [${a}] x=${x} step ${k}`;
      assert.equal(s.items.length, a.length, ctx);
      assert.equal(new Set(s.items.map(it => it.id)).size, a.length, ctx + ' unique ids');
      s.items.forEach((it, i) => { assert.ok(STATES.has(it.state), ctx + ' state ' + it.state); assert.equal(it.value, a[i], ctx); });
      s.pointers.forEach(p => assert.ok(p.index >= -1 && p.index <= a.length, ctx + ` pointer ${p.name}=${p.index}`));
      s.regions.forEach(r => { assert.ok(r.from >= 0 && r.to < a.length && r.from <= r.to, ctx + ' region'); assert.ok(STATES.has(r.state)); });
      assert.ok(s.counters.comparisons >= prevCmp, ctx + ' counters grow'); prevCmp = s.counters.comparisons;
      assert.ok(typeof s.caption === 'string' && s.caption.length > 5, ctx + ' caption');
      assert.ok(s.line !== undefined && s.flow !== undefined, ctx);
    });
    assert.equal(steps[0].kind, 'start');
    assert.ok(['done', 'found'].includes(last(steps).kind), `${variant} ends`);
  }
});

test('dimmed items are dimmed only when their side is proven (sorted input)', () => {
  const rng = core.rng(5);
  for (let c = 0; c < 200; c++) {
    const a = sortedInput(rng, 18, 9), x = rng.int(-1, 10);
    for (const variant of VARIANTS) {
      const cfg = B.VARIANTS[variant];
      B.search(a, x, { variant }).forEach(s => {
        s.items.forEach((it, i) => {
          if (it.state !== 'muted') return;
          if (i < s.lo) {
            // left of lo: always "too small" for the sign of this variant
            if (cfg.leftSign === '<') assert.ok(a[i] < x, `[${a}] x=${x} ${variant}: a[${i}]=${a[i]} muted on the left but not < x`);
            else assert.ok(a[i] <= x, `${variant}: a[${i}] muted on the left but not ≤ x`);
          } else {
            if (cfg.rightSign === '>') assert.ok(a[i] > x, `[${a}] x=${x} ${variant}: a[${i}]=${a[i]} muted on the right but not > x`);
            else assert.ok(a[i] >= x, `${variant}: a[${i}] muted on the right but not ≥ x`);
          }
        });
      });
    }
  }
});

test('the loop invariant: the answer always lies in [lo, hi]', () => {
  const rng = core.rng(9);
  for (let c = 0; c < 200; c++) {
    const a = sortedInput(rng, 18, 9), x = rng.int(-1, 10);
    const m = a.indexOf(x);
    B.search(a, x, { variant: 'exact' }).forEach(s => { if (s.kind === 'found' || s.kind === 'done') return; if (m >= 0) assert.ok(a.slice(s.lo, s.hi + 1).includes(x), `exact [${a}] x=${x}`); });
    B.search(a, x, { variant: 'lower' }).forEach(s => { const ans = refLower(a, x); assert.ok(s.lo <= ans && ans <= s.hi, `lower [${a}] x=${x}: ${s.lo}..${s.hi} vs ${ans}`); });
    B.search(a, x, { variant: 'upper' }).forEach(s => { const ans = refUpper(a, x); assert.ok(s.lo <= ans && ans <= s.hi, `upper`); });
  }
});

test('candidates left shrinks to at most half each round (exact)', () => {
  const a = Array.from({ length: 64 }, (_, i) => i * 3);
  const steps = B.search(a, 100, { variant: 'exact' }).filter(s => s.kind === 'discard');
  let prev = 64;
  steps.forEach(s => { assert.ok(s.counters.left <= Math.floor(prev / 2), `${s.counters.left} vs ${prev}`); prev = s.counters.left; });
});

test('unsorted input: the search is honest about missing a target that is present', () => {
  const a = [9, 2, 7, 4, 1, 8, 3];
  const x = 9;   // sits at index 0, but the first probe (index 3, value 4) says "go right"
  const steps = B.search(a, x);
  assert.equal(steps[0].sorted, false);
  const fin = last(steps);
  assert.equal(fin.kind, 'missed');
  assert.equal(fin.result, -1);
  assert.equal(fin.items[0].state, 'error');
  assert.match(fin.caption, /not sorted/);
});

test('every step line and flow id exists in every language / flowchart node set', () => {
  for (const variant of VARIANTS) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(B.CODE[variant][lang], lang);
    const used = new Set();
    const rng = core.rng(3);
    const inputs = [[], [1], [1, 3, 3, 3, 5], [2, 4, 6, 8, 10, 12, 14]];
    for (const a of inputs) for (const x of [0, 3, 6, 100]) B.search(a, x, { variant }).forEach(s => { if (s.line) used.add(s.line); });
    assert.ok(used.size >= 5, `${variant} uses several labels`);
    for (const label of used) for (const lang of Object.keys(parsed)) assert.ok(parsed[lang].labels[label], `${variant}: label @${label} missing in ${lang}`);
    for (const lang of Object.keys(parsed)) parsed[lang].lines.forEach(l => assert.ok(!/@\w/.test(l.text), `${variant}/${lang}: label leaked into visible code`));
  }
  const parsedA = {};
  for (const lang of ['pseudo', 'js', 'py']) parsedA[lang] = code.parse(B.ANSWER_CODE[lang], lang);
  B.answerSteps({ kind: 'sqrt', x: 20 }).forEach(s => { if (s.line) for (const lang of Object.keys(parsedA)) assert.ok(parsedA[lang].labels[s.line], `answer: @${s.line} missing in ${lang}`); });
  for (const kind of ['loop', 'last']) for (const fixed of [false, true]) {
    const src = B.BUG_CODE[kind][fixed ? 'fix' : 'bug'];
    const ps = { js: code.parse(src.js, 'js'), py: code.parse(src.py, 'py') };
    const a = kind === 'loop' ? [3, 7] : [1, 3, 5, 7];
    B.bugSteps(kind, a, 7, fixed).forEach(s => { if (s.line) for (const lang of Object.keys(ps)) assert.ok(ps[lang].labels[s.line], `bug ${kind}: @${s.line} missing in ${lang}`); });
  }
});

/* ------------------------------------------------------------ linear baseline */
test('linear search steps match a scan and count one comparison per item', () => {
  const a = [3, 8, 12, 20, 25, 31];
  for (const x of [3, 12, 31, 4, 99]) {
    const steps = B.linear(a, x), fin = last(steps);
    assert.equal(fin.counters.comparisons, B.linearComparisons(a, x));
    assert.equal(fin.result, a.indexOf(x));
    assert.equal(fin.counters.comparisons, a.includes(x) ? a.indexOf(x) + 1 : a.length);
  }
  assert.equal(B.linearComparisons([], 1), 0);
});

/* ------------------------------------------------------------ guess the number */
test('the halving strategy guesses any secret in 1..100 within 7 guesses', () => {
  let worst = 0;
  for (let secret = 1; secret <= 100; secret++) {
    const steps = B.guessSteps(secret, 1, 100), fin = last(steps);
    assert.equal(fin.kind, 'hit');
    assert.equal(fin.guess, secret);
    assert.ok(fin.guesses <= 7, `secret ${secret}: ${fin.guesses}`);
    worst = Math.max(worst, fin.guesses);
    // remaining candidates only shrink, and always contain the secret
    steps.forEach(s => { if (s.kind === 'verdict' || s.kind === 'guess') assert.ok(s.lo <= secret && secret <= s.hi, `range contains the secret (${secret})`); });
  }
  assert.equal(worst, 7);
  assert.equal(B.worstCase(100), 7);
});

test('halving(n) lists the worst-case candidates: n, n/2, ... 0 in worstCase(n) + 1 entries', () => {
  assert.deepEqual(B.halving(7), [7, 3, 1, 0]);
  assert.equal(B.halving(1000000).length, 21);
  assert.equal(B.halving(1000000)[10], 976);
  for (const n of [1, 2, 3, 10, 64, 100, 1000, 1e9]) assert.equal(B.halving(n).length - 1, B.worstCase(n));
});

/* ------------------------------------------------------------ decision tree */
test('the decision tree has n comparisons nodes, n + 1 gaps, height ceil(log2(n + 1)) and every path is short', () => {
  for (let n = 0; n <= 40; n++) {
    const a = Array.from({ length: n }, (_, i) => 10 * (i + 1));
    const t = B.decisionTree(a);
    assert.equal(t.nodes.filter(d => d.kind === 'node').length, n);
    assert.equal(t.nodes.filter(d => d.kind === 'gap').length, n + 1);
    assert.equal(t.height, B.worstCase(n));
    for (let x = 0; x <= 10 * n + 10; x += 5) {
      const tp = B.treePath(t, x), truth = a.indexOf(x);
      assert.equal(tp.found, truth >= 0, `n=${n} x=${x}`);
      if (tp.found) assert.equal(t.index[tp.end].index, truth);
      const comparisons = tp.path.filter(p => p.cmp).length;
      assert.equal(comparisons, B.count('exact', a, x), `path length equals probes for n=${n} x=${x}`);
      assert.ok(comparisons <= t.height);
    }
  }
  const t7 = B.decisionTree([10, 20, 30, 40, 50, 60, 70]);
  assert.equal(t7.root, 'n3');
  assert.equal(t7.height, 3);
});

test('treeSteps walks the path and ends on the right node', () => {
  const a = [10, 20, 30, 40, 50, 60, 70];
  for (const x of [10, 40, 70, 5, 35, 99]) {
    const steps = B.treeSteps(a, x), fin = last(steps);
    assert.equal(steps[0].kind, 'start');
    const found = a.includes(x);
    assert.equal(fin.kind, found ? 'hit' : 'end');
    const endNode = fin.nodes.find(n => n.id === fin.end);
    assert.ok(endNode);
    assert.equal(endNode.state, found ? 'found' : 'error');
    assert.equal(fin.comparisons, B.count('exact', a, x));
    // exactly one node is active/found/error at the end; earlier path nodes are visited
    steps.forEach(s => { s.nodes.forEach(n => assert.ok(STATES.has(n.state))); });
  }
});

/* ------------------------------------------------------------ binary search on the answer */
test('shipping capacity: the halving answer equals brute force, tests stay logarithmic', () => {
  const rng = core.rng(77);
  const problems = [{ kind: 'ship', weights: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], days: 5 }, { kind: 'ship', weights: [3, 2, 2, 4, 1, 4], days: 3 }, { kind: 'ship', weights: [7], days: 1 }, { kind: 'ship', weights: [5, 5, 5], days: 3 }];
  for (let c = 0; c < 80; c++) {
    const w = Array.from({ length: rng.int(1, 9) }, () => rng.int(1, 9));
    problems.push({ kind: 'ship', weights: w, days: rng.int(1, w.length) });
  }
  for (const p of problems) {
    const steps = B.answerSteps(p), fin = last(steps);
    assert.equal(fin.answer, B.answerBrute(p), JSON.stringify(p));
    const info = B.problemInfo(p);
    assert.ok(fin.counters.evaluations <= B.worstCase(info.hi - info.lo + 1), 'few tests');
    // the strip stays truthful: everything left of lo is false, everything right of hi is true
    steps.forEach(s => {
      for (let c = info.lo; c < s.lo; c++) assert.equal(info.pred(c), false, `pred(${c}) false left of lo (${JSON.stringify(p)})`);
      for (let c = s.hi; c <= info.hi; c++) assert.equal(info.pred(c), true, `pred(${c}) true from hi (${JSON.stringify(p)})`);
    });
  }
  assert.equal(B.answerBrute(problems[0]), 15);
  assert.equal(B.answerBrute(problems[1]), 6);
});

test('integer square root: the halving answer equals Math.floor(Math.sqrt(x))', () => {
  for (let x = 0; x <= 200; x++) {
    const fin = last(B.answerSteps({ kind: 'sqrt', x }));
    assert.equal(fin.answer, Math.floor(Math.sqrt(x)), `x = ${x}`);
  }
});

test('daysNeeded packs greedily in order', () => {
  assert.equal(B.daysNeeded([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 15).days, 5);
  assert.equal(B.daysNeeded([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 55).days, 1);
  assert.deepEqual(B.daysNeeded([3, 2, 2], 4).groups, [[3], [2, 2]]);
});

/* ------------------------------------------------------------ bisection */
test('bisection halves the interval and converges on sqrt(2)', () => {
  const steps = B.bisection(x => x * x - 2, 1, 2, 12);
  const fin = last(steps);
  assert.ok(Math.abs((fin.lo + fin.hi) / 2 - Math.SQRT2) < 1 / 4096);
  const widths = steps.filter(s => s.kind === 'halve').map(s => s.width);
  widths.forEach((w, i) => assert.ok(Math.abs(w - 1 / Math.pow(2, i + 1)) < 1e-12));
  // the sign change is always kept inside [lo, hi]
  steps.forEach(s => { assert.ok(s.lo * s.lo - 2 <= 0 + 1e-12); assert.ok(s.hi * s.hi - 2 >= 0 - 1e-12); });
});

/* ------------------------------------------------------------ the classic bugs */
test('int32 overflow: (lo + hi) / 2 goes negative, lo + (hi - lo) / 2 does not', () => {
  const lo = 1500000000, hi = 2000000000;
  assert.equal(B.wrap32(lo + hi), lo + hi - 4294967296);
  assert.ok(B.midNaive(lo, hi) < 0);
  assert.equal(B.midSafe(lo, hi), 1750000000);
  assert.equal(B.midNaive(10, 20), 15);
  for (let c = 0; c < 200; c++) {
    const l = c * 1000, h = l + c * 7;
    assert.equal(B.midNaive(l, h), B.midSafe(l, h));
  }
  // the smallest overflowing pair: lo + hi = 2^31
  assert.ok(B.midNaive(2 ** 30, 2 ** 30) < 0);
  assert.equal(B.midNaive(2 ** 30 - 1, 2 ** 30), 1073741823 + 0);
});

test('bug "lo = mid": the buggy trace gets stuck, the fixed one finishes with the right answer', () => {
  const a = [3, 7];
  const bug = B.bugSteps('loop', a, 7, false), fixed = B.bugSteps('loop', a, 7, true);
  assert.equal(last(bug).kind, 'stuck');
  // the state repeats: lo and hi are identical at the start of every round
  const checks = bug.filter(s => s.kind === 'check');
  assert.ok(checks.length >= 3);
  checks.forEach(s => { assert.equal(s.vars.lo, 0); assert.equal(s.vars.hi, 1); });
  assert.equal(last(fixed).kind, 'done');
  assert.equal(last(fixed).result, 1);
  // on every input the fixed loop matches the reference lower bound
  const rng = core.rng(21);
  for (let c = 0; c < 100; c++) {
    const arr = sortedInput(rng, 12, 8);
    if (!arr.length) continue;
    const x = rng.int(0, 9), fin = last(B.bugSteps('loop', arr, x, true));
    assert.equal(fin.result, Math.min(refLower(arr, x), arr.length - 1), `[${arr}] x=${x}`);
  }
});

test('bug "lo < hi": the buggy exact search misses the last candidate, the fixed one finds it', () => {
  const a = [1, 3, 5, 7];
  const bug = last(B.bugSteps('last', a, 7, false)), fixed = last(B.bugSteps('last', a, 7, true));
  assert.equal(bug.kind, 'none');
  assert.equal(bug.result, -1);
  assert.equal(bug.items[3].state, 'error');
  assert.equal(fixed.kind, 'found');
  assert.equal(fixed.result, 3);
  // single element: the buggy loop never even runs
  assert.equal(last(B.bugSteps('last', [5], 5, false)).result, -1);
  assert.equal(last(B.bugSteps('last', [5], 5, true)).result, 0);
  // fixed version agrees with indexOf on distinct sorted arrays
  const rng = core.rng(8);
  for (let c = 0; c < 100; c++) {
    const arr = Array.from(new Set(sortedInput(rng, 12, 30)));
    const x = rng.int(0, 30), fin = last(B.bugSteps('last', arr, x, true));
    assert.equal(fin.result, arr.indexOf(x), `[${arr}] x=${x}`);
  }
});
