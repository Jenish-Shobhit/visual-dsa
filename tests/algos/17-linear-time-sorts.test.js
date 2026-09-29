/* Step generators for lesson 17 (js/algos/17-linear-time-sorts.js): counting, radix and bucket sort, and the decision tree.
   Run: node --test tests/algos/17-linear-time-sorts.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '17-linear-time-sorts.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));
const STATES = new Set(Object.keys(core.STATES));

/* ------------------------------------------------------------ straightforward references */
function refStable(vals) {
  return vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i).map(x => x.i);   // original indices in stable order
}
function refCounting(a, k) {
  const count = new Array(k + 1).fill(0);
  for (const x of a) count[x]++;
  for (let v = 1; v <= k; v++) count[v] += count[v - 1];
  const out = new Array(a.length);
  for (let i = a.length - 1; i >= 0; i--) { count[a[i]]--; out[count[a[i]]] = i; }
  return out;   // original indices
}
const last = steps => steps[steps.length - 1];
const outRow = step => step.rows.find(r => r.id === 'out');
const inputs = () => {
  const r = core.rng(17), out = [[], [0], [5], [3, 3, 3], [0, 0], [1, 2, 3, 4], [4, 3, 2, 1, 0], [2, 5, 3, 0, 2, 3, 0, 3], [9, 0, 9, 0, 9]];
  for (let t = 0; t < 40; t++) { const n = r.int(1, 12), m = r.int(0, 9); out.push(Array.from({ length: n }, () => r.int(0, m))); }
  return out;
};
const radixInputs = () => {
  const r = core.rng(170), out = [[], [0], [7], [0, 0, 0], [170, 45, 75, 90, 802, 24, 2, 66], [10, 20, 30, 10], [99, 100, 1], [5, 5, 5, 5], [123, 321, 132, 213]];
  for (let t = 0; t < 40; t++) { const n = r.int(1, 10), m = r.pick([9, 99, 999, 5000]); out.push(Array.from({ length: n }, () => r.int(0, m))); }
  return out;
};

/* ------------------------------------------------------------ counting sort */
test('counting sort output equals the stable reference on many inputs, including empty, single, duplicates, sorted, reversed', () => {
  for (const vals of inputs()) {
    const steps = S.counting(vals);
    const l = last(steps);
    const out = outRow(l).items.slice().sort((a, b) => a.index - b.index);
    assert.equal(out.length, vals.length, JSON.stringify(vals));
    const k = Math.max(0, ...vals);
    const ref = refCounting(vals, k);
    assert.deepEqual(out.map(o => o.id), ref.map(i => 'ov' + i), 'same slots as the reference: ' + JSON.stringify(vals));
    assert.deepEqual(out.map(o => o.id), refStable(vals).map(i => 'ov' + i), 'right-to-left placement is stable: ' + JSON.stringify(vals));
    assert.deepEqual(out.map(o => o.value), vals.slice().sort((a, b) => a - b));
  }
});

test('labelled duplicates keep their order right to left, and come out reversed left to right', () => {
  const vals = S.labelDuplicates([2, 5, 3, 0, 2, 3, 0, 3]);
  const lab = st => outRow(last(st)).items.slice().sort((a, b) => a.index - b.index).map(o => o.value + (o.label || '')).join(' ');
  assert.equal(lab(S.counting(vals)), '0a 0b 2a 2b 3a 3b 3c 5');
  assert.equal(lab(S.counting(vals, { direction: 'ltr' })), '0b 0a 2b 2a 3c 3b 3a 5');
});

test('counting sort: counts, prefix sums and reserved stretches are truthful at every step', () => {
  const vals = [2, 5, 3, 0, 2, 3, 0, 3];
  const steps = S.counting(vals);
  const cntRow = s => s.rows.find(r => r.id === 'cnt').items.map(c => c.value);
  const tallyDone = steps.find(s => s.kind === 'tallyDone');
  assert.deepEqual(cntRow(tallyDone), [2, 0, 2, 3, 0, 1]);
  const pd = steps.find(s => s.kind === 'prefixDone');
  assert.deepEqual(cntRow(pd), [2, 2, 4, 7, 7, 8]);
  const regions = outRow(pd).regions.map(r => [r.from, r.to]);
  assert.deepEqual(regions, [[0, 1], [2, 3], [4, 6], [7, 7]], 'stretch of key v is [count[v-1], count[v]-1]; empty keys have no region');
  // every placement lands inside its key's stretch, and never overwrites
  const seen = new Set();
  for (const s of steps.filter(s => s.kind === 'place')) {
    const newest = outRow(s).items.filter(o => o.from);
    assert.equal(newest.length, 1);
    const o = newest[0];
    assert.ok(!seen.has(o.index), 'slot written twice'); seen.add(o.index);
    const reg = outRow(pd).regions.find(r => o.index >= r.from && o.index <= r.to);
    assert.ok(reg && (reg.label === 'key ' + o.value || reg.label === String(o.value)), 'item in the wrong stretch');
  }
  // after all placements each counter equals the start of its key's stretch
  assert.deepEqual(cntRow(last(steps)), [0, 2, 2, 4, 7, 7]);
});

test('counting sort: an output item is done and never moves again; counters only grow; no key comparisons', () => {
  for (const vals of inputs()) {
    const steps = S.counting(vals);
    const slotOf = {};
    let prev = null;
    for (const s of steps) {
      for (const row of s.rows) for (const it of row.items) assert.ok(STATES.has(it.state), 'unknown state ' + it.state);
      for (const o of outRow(s).items) {
        assert.equal(o.state, 'done');
        if (slotOf[o.id] !== undefined) assert.equal(o.index, slotOf[o.id], 'an output item moved');
        slotOf[o.id] = o.index;
      }
      assert.equal(s.counters.comparisons, 0);
      if (prev) for (const key of Object.keys(s.counters)) assert.ok(s.counters[key] >= prev.counters[key], key + ' decreased');
      prev = s;
    }
    const k = Math.max(0, ...vals), n = vals.length, c = last(steps).counters;
    if (n) { assert.equal(c.tallies, n); assert.equal(c.additions, k); assert.equal(c.placements, n); }
  }
});

test('counting sort: rows keep the same ids, lengths and keys on every step (stable heights)', () => {
  const steps = S.counting([3, 1, 3, 0]);
  for (const s of steps) {
    assert.equal(s.rows.length, 3);
    assert.equal(s.rows[0].items.length, 4);
    assert.equal(s.rows[1].items.length, 4, 'k + 1 counters');
    assert.equal(s.rows[2].length, 4);
    assert.deepEqual(Object.keys(s.counters), ['comparisons', 'tallies', 'additions', 'placements']);
    assert.ok(typeof s.caption === 'string' && s.caption.length > 10);
  }
});

test('counting sort: the variable watch shows i, key, the live counters and the output so far', () => {
  const steps = S.counting([2, 0, 2]);
  const take = steps.find(s => s.kind === 'take');
  assert.equal(take.vars.i, 2, 'placement starts at the last index');
  assert.equal(take.vars.key, 2);
  assert.deepEqual(take.vars.count, [1, 1, 2], 'count[2] was decremented from 3 to 2');
  assert.deepEqual(take.vars.out, [null, null, null]);
  const tally = steps.find(s => s.kind === 'tally');
  assert.equal(tally.vars.i, 0); assert.equal(tally.vars.key, 2);
  assert.deepEqual(tally.vars.count, [0, 0, 1]);
  assert.deepEqual(last(steps).vars.out, [0, 2, 2]);
});

test('counting sort validates input and honours a larger k', () => {
  assert.throws(() => S.counting([1, -1]), RangeError);
  assert.throws(() => S.counting([1.5]), RangeError);
  assert.throws(() => S.counting([3], { k: 2 }), RangeError);
  const st = S.counting([1, 0], { k: 4 });
  assert.equal(st[0].rows[1].items.length, 5);
  assert.equal(last(st).counters.additions, 4);
});

/* ------------------------------------------------------------ radix sort */
function listOrder(step) {
  const byId = Object.fromEntries(step.items.map(i => [i.id, i]));
  return step.order.map(id => (id === null ? null : byId[id].value));
}
test('radix sort sorts a wide range of inputs and matches the stable reference', () => {
  for (const vals of radixInputs()) {
    for (const base of [10, 2, 16]) {
      const steps = S.radix(vals, { base });
      const l = last(steps);
      const byId = Object.fromEntries(l.items.map(i => [i.id, i]));
      const got = l.order.map(id => byId[id]);
      assert.deepEqual(got.map(i => i.id), refStable(vals).map(i => 'v' + i), 'base ' + base + ' ' + JSON.stringify(vals));
      assert.ok(got.every(i => i.state === 'done'));
    }
  }
});

test('radix sort: after pass p the list is sorted by its last p digits, ties in earlier order (the LSD invariant)', () => {
  for (const vals of radixInputs()) {
    const steps = S.radix(vals);
    const d = steps[0].d;
    const passEnds = steps.filter(s => s.kind === 'passEnd');
    assert.equal(passEnds.length, d);
    passEnds.forEach((s, idx) => {
      const p = idx + 1, mod = Math.pow(10, p);
      const byId = Object.fromEntries(s.items.map(i => [i.id, i]));
      const got = s.order.map(id => byId[id]);
      const ref = vals.map((v, i) => ({ v, i })).sort((a, b) => (a.v % mod) - (b.v % mod) || a.i - b.i).map(x => 'v' + x.i);
      // stable LSD: the list after pass p is ordered by (last p digits), then by the ORIGINAL order
      assert.deepEqual(got.map(i => i.id), ref, 'pass ' + p + ' of ' + JSON.stringify(vals));
    });
  }
});

test('radix sort: every bucket is a queue (arrival order), items are in exactly one place, depth is the queue position', () => {
  const vals = [170, 45, 75, 90, 802, 24, 2, 66];
  const steps = S.radix(vals);
  for (const s of steps) {
    const ids = new Set(s.items.map(i => i.id));
    assert.equal(ids.size, vals.length);
    const buckets = {};
    for (const it of s.items) {
      assert.ok(STATES.has(it.state));
      if (it.where === 'bucket') { (buckets[it.bucket] = buckets[it.bucket] || []).push(it); assert.ok(it.bucket >= 0 && it.bucket < 10); }
      else assert.ok(it.index >= 0 && it.index < vals.length);
    }
    for (const b of Object.values(buckets)) assert.deepEqual(b.map(i => i.depth).sort((x, y) => x - y), b.map((_, k) => k));
    const inList = s.items.filter(i => i.where === 'list').map(i => i.index);
    assert.equal(new Set(inList).size, inList.length, 'two items in one list slot');
    assert.equal(s.counters.comparisons, 0);
  }
  // pass 1 drops in list order: bucket 0 receives 170 then 90 (in that order)
  const afterDrops = steps.filter(s => s.kind === 'drop')[7];
  const b0 = afterDrops.items.filter(i => i.where === 'bucket' && i.bucket === 0).sort((a, b) => a.depth - b.depth).map(i => i.value);
  assert.deepEqual(b0, [170, 90]);
  assert.equal(last(steps).counters.passes, 3);
  assert.equal(last(steps).counters.drops, 24);
  assert.equal(last(steps).counters.collected, 24);
});

test('radix sort with an unstable inner sort (stack buckets) really breaks on the classic input, and says so truthfully', () => {
  const bad = S.radix([170, 45, 75, 90, 802, 24, 2, 66], { stable: false });
  const l = last(bad);
  const byId = Object.fromEntries(l.items.map(i => [i.id, i]));
  const vals = l.order.map(id => byId[id].value);
  assert.notDeepEqual(vals, vals.slice().sort((a, b) => a - b));
  assert.ok(l.items.some(i => i.state === 'error'));
  assert.ok(!l.items.some(i => i.state === 'done'));
  // when the data has no ties in any pass the unstable variant happens to work, and it is then marked done
  const lucky = S.radix([1, 2, 3, 4], { stable: false });
  assert.ok(last(lucky).items.every(i => i.state === 'done'));
  // every claim of "done" is a sorted list
  for (const vals2 of radixInputs()) {
    const st = last(S.radix(vals2, { stable: false }));
    const by = Object.fromEntries(st.items.map(i => [i.id, i]));
    const ord = st.order.map(id => by[id].value);
    const sorted = ord.every((v, k) => k === 0 || ord[k - 1] <= v);
    assert.equal(st.items.every(i => i.state === 'done'), sorted || vals2.length === 0);
  }
});

test('radix sort: edge cases (empty, all zeros, single digit, validation)', () => {
  assert.equal(S.radix([]).length, 2);
  const z = S.radix([0, 0, 0]);
  assert.equal(z[0].d, 0);
  assert.ok(last(z).items.every(i => i.state === 'done'));
  assert.equal(S.radix([5, 3, 9, 3]).filter(s => s.kind === 'passEnd').length, 1);
  assert.throws(() => S.radix([1, -2]), RangeError);
});

/* ------------------------------------------------------------ bucket sort */
test('bucket sort sorts numbers in [0, 1), counts only in-bucket comparisons, and is stable', () => {
  const r = core.rng(5);
  const cases = [[], [0.5], [0.1, 0.1, 0.1], [0.99, 0.01], [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]];
  for (let t = 0; t < 30; t++) cases.push(Array.from({ length: r.int(1, 12) }, () => Math.round(r() * 99) / 100));
  for (const vals of cases) {
    for (const k of [1, 4, 5, 10]) {
      const steps = S.bucket(vals, { buckets: k });
      const l = last(steps);
      const byId = Object.fromEntries(l.items.map(i => [i.id, i]));
      const got = l.order.map(id => byId[id]);
      assert.deepEqual(got.map(i => i.id), vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i).map(x => 'v' + x.i), 'k=' + k + ' ' + JSON.stringify(vals));
      // scatter puts x in bucket floor(x * k)
      for (const s of steps.filter(s => s.kind === 'scatter')) {
        for (const it of s.items.filter(i => i.where === 'bucket')) assert.equal(it.bucket, Math.floor(it.value * k));
      }
      // comparisons are never made between items of different buckets: recompute
      let cmp = 0;
      const bk = Array.from({ length: k }, () => []);
      vals.forEach(v => bk[Math.floor(v * k)].push(v));
      bk.forEach(b => { for (let a = 1; a < b.length; a++) { let j = a - 1; while (j >= 0) { cmp++; if (b[j] > b[a]) j--; else break; } } });
      // the insertion sort above counts against the shifting array; recompute exactly like the generator
      let exact = 0;
      bk.forEach(b => { const arr = b.slice(); for (let a = 1; a < arr.length; a++) { const key = arr[a]; let j = a - 1; while (j >= 0) { exact++; if (arr[j] > key) { arr[j + 1] = arr[j]; j--; } else break; } arr[j + 1] = key; } });
      assert.equal(l.counters.comparisons, exact);
    }
  }
  assert.throws(() => S.bucket([1.2]), RangeError);
  assert.throws(() => S.bucket([-0.1]), RangeError);
});

test('bucket sort on clustered data does all its work in one bucket (the quadratic worst case)', () => {
  const vals = [0.51, 0.55, 0.53, 0.59, 0.52, 0.58, 0.54, 0.57];
  const l = last(S.bucket(vals, { buckets: 5 }));
  assert.ok(l.counters.comparisons >= vals.length - 1);
  const spread = last(S.bucket([0.05, 0.25, 0.45, 0.65, 0.85], { buckets: 5 }));
  assert.equal(spread.counters.comparisons, 0, 'one item per bucket means no comparisons at all');
});

/* ------------------------------------------------------------ the barrier */
test('the 3-item decision tree has 6 leaves, height 3, and sorts every ordering', () => {
  const st = S.treeStats(S.decision3);
  assert.equal(st.leaves, 6);
  assert.equal(st.height, 3);
  assert.ok(st.height >= Math.log2(6));
  const seen = new Set();
  for (const p of [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]) {
    const vals = { a: p[0], b: p[1], c: p[2] };
    const r = S.runDecision(S.decision3, vals);
    const sorted = r.order.map(x => vals[x]);
    assert.deepEqual(sorted, [1, 2, 3], JSON.stringify(p));
    assert.ok(r.path.length >= 2 && r.path.length <= 3);
    seen.add(r.leaf);
  }
  assert.equal(seen.size, 6, 'every leaf is reachable, by exactly one ordering');
});

test('real comparison sorts have n! leaves and height at least ceil(log2 n!)', () => {
  for (let n = 1; n <= 6; n++) {
    for (const algo of ['insertion', 'merge']) {
      const st = S.sortDecisionStats(n, algo);
      assert.equal(st.leaves, S.factorial(n), algo + ' n=' + n);
      assert.ok(st.height >= S.minComparisons(n), algo + ' n=' + n + ' height ' + st.height);
    }
  }
});

test('factorial, log2(n!) and the minimum comparison counts', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(S.factorial), [1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(S.minComparisons), [0, 1, 3, 5, 7, 10, 13, 16, 19, 22, 29]);
  for (let n = 2; n <= 40; n++) {
    const l = S.log2Factorial(n);
    assert.ok(l <= n * Math.log2(n), 'log2 n! <= n log2 n');
    assert.ok(l >= (n / 2) * Math.log2(n / 2) - 1e-9, 'log2 n! >= (n/2) log2 (n/2)');
  }
  assert.equal(S.countingOps(8, 5).total, 21);
  assert.equal(S.radixOps(1e6, 4, 256).total, 4 * (2e6 + 256));
});

/* ------------------------------------------------------------ code labels */
test('every code line label used by a step exists in pseudocode, JavaScript and Python', () => {
  const gens = { counting: S.counting([2, 5, 3, 0, 2]), radix: S.radix([170, 45, 75, 90, 802]), bucket: S.bucket([0.78, 0.17, 0.39, 0.26, 0.72]) };
  for (const [name, steps] of Object.entries(gens)) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(S.CODE17[name][lang], lang);
    const used = new Set(steps.map(s => s.line).filter(Boolean));
    assert.ok(used.size >= 3, name + ' uses several labels');
    for (const label of used) for (const lang of Object.keys(parsed)) assert.ok(parsed[lang].labels[label], `${name}: label @${label} missing in ${lang}`);
    for (const lang of Object.keys(parsed)) assert.ok(!code.plainText(parsed[lang]).includes('@'), `${name} ${lang}: label text visible`);
  }
});

test('the generators merge into VDSA.algos.sorting without replacing other lessons', () => {
  const g = { VDSA: { algos: { sorting: { bubble: () => 'lesson 14' } } } };
  // simulate the browser attach the way the UMD wrapper does
  Object.assign(g.VDSA.algos.sorting, S);
  assert.equal(g.VDSA.algos.sorting.bubble(), 'lesson 14');
  assert.equal(typeof g.VDSA.algos.sorting.counting, 'function');
  assert.equal(typeof g.VDSA.algos.sorting.radix, 'function');
});
