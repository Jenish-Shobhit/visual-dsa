/* Step generators for lesson 15 (js/algos/15-merge-sort.js): top-down, level-by-level and bottom-up merge sort,
   merging two runs in isolation, counters, ticks and inversion counting.
   Run: node --test tests/algos/15-merge-sort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const M = require(path.join(ROOT, 'js', 'algos', '15-merge-sort.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));

/* ------------------------------------------------------------ straightforward references */
function refMergeSort(input) {
  // textbook top-down merge sort on {value, idx}; ties take the left run, so it is stable
  let comparisons = 0, writes = 0;
  function sort(a) {
    if (a.length < 2) return a;
    const mid = Math.ceil(a.length / 2);      // == floor((lo + hi) / 2) - lo + 1
    const L = sort(a.slice(0, mid)), R = sort(a.slice(mid));
    const out = []; let i = 0, j = 0;
    while (i < L.length && j < R.length) { comparisons++; out.push(L[i].value <= R[j].value ? L[i++] : R[j++]); }
    while (i < L.length) out.push(L[i++]);
    while (j < R.length) out.push(R[j++]);
    writes += out.length;
    return out;
  }
  const sorted = sort(input.map((value, idx) => ({ value, idx })));
  return { order: sorted.map(x => x.idx), values: sorted.map(x => x.value), comparisons, writes };
}
function bruteInversions(a) { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c; }
function lastOf(a) { return a[a.length - 1]; }
function randomInputs(seed, count, maxLen, maxVal) {
  const rng = core.rng(seed), out = [];
  for (let c = 0; c < count; c++) {
    const n = rng.int(0, maxLen), a = [];
    for (let i = 0; i < n; i++) a.push(rng.int(-maxVal, maxVal));
    out.push(a);
  }
  return out;
}
const EDGE = [[], [7], [4, 4], [2, 1], [1, 2], [3, 3, 3, 3], [1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1],
  [5, 2, 8, 4, 1, 6, 3, 7], [2, 3, 2, 3, 2, 3, 2], [-3, 0, -3, 9, -1], [1, 2, 3, 5, 4], [4, 1, 3], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1]];
const INPUTS = EDGE.concat(randomInputs(20260929, 250, 16, 12));

/* Where every item sits in a step of the level trace: id -> {row, slot}. */
function placements(step) {
  const map = {};
  step.rows.forEach((row, r) => row.items.forEach(it => {
    assert.ok(!(it.id in map), `item ${it.id} appears twice in one step`);
    map[it.id] = { row: r, slot: it.index, item: it };
  }));
  return map;
}
function slotsAreUnique(rowsOrFlat, label) {
  const seen = new Set();
  rowsOrFlat.forEach(it => { assert.ok(!seen.has(it.index), `${label}: two items share slot ${it.index}`); seen.add(it.index); });
}

/* ------------------------------------------------------------ top-down trace */
test('merge(): sorts edge cases and random inputs, matching the reference (order, comparisons, writes)', () => {
  for (const input of INPUTS) {
    const steps = M.merge(input);
    const ref = refMergeSort(input);
    const last = lastOf(steps);
    assert.equal(last.kind, 'done', `ends with done on [${input}]`);
    const p = placements(last);
    const outOrder = Object.keys(p).sort((a, b) => p[a].slot - p[b].slot).map(id => +id.slice(1));
    assert.deepEqual(outOrder, ref.order, `stable output order on [${input}]`);
    assert.ok(Object.values(p).every(x => x.row === 0 && x.item.state === 'done'), `everything final on row 0: [${input}]`);
    assert.equal(last.ops.comparisons, ref.comparisons, `comparisons on [${input}]`);
    assert.equal(last.ops.writes, ref.writes, `writes on [${input}]`);
    const fast = M.mergeCount(input);
    assert.equal(fast.comparisons, ref.comparisons);
    assert.equal(fast.writes, ref.writes);
  }
});

test('merge(): every step is a complete, truthful snapshot', () => {
  for (const input of INPUTS.slice(0, 120)) {
    const n = input.length;
    const steps = M.merge(input);
    const finalRank = {};
    refMergeSort(input).order.forEach((idx, r) => { finalRank['v' + idx] = r; });
    let prev = { comparisons: 0, writes: 0 };
    steps.forEach((s, k) => {
      const p = placements(s);
      assert.equal(Object.keys(p).length, n, `step ${k} shows all ${n} items`);
      assert.ok(typeof s.caption === 'string' && s.caption.length > 0, `step ${k} has a caption`);
      assert.ok(s.counters.comparisons >= prev.comparisons && s.counters.writes >= prev.writes, 'counters only grow');
      prev = s.counters;
      Object.keys(p).forEach(id => {
        const it = p[id].item;
        assert.ok(STATES.has(it.state), `valid state ${it.state}`);
        if (it.state === 'done') {
          assert.equal(p[id].row, 0, `a done item sits on row 0 (${id}, step ${k}, [${input}])`);
          assert.equal(p[id].slot, finalRank[id], `a done item is at its FINAL slot (${id}, step ${k}, [${input}])`);
        }
      });
      // within a row, no two items share a slot; the flat picture is a permutation of 0..n-1
      s.rows.forEach(row => slotsAreUnique(row.items, `row ${row.id} step ${k}`));
      assert.equal(s.flat.items.length, n);
      slotsAreUnique(s.flat.items, `flat step ${k}`);
      assert.deepEqual(s.flat.items.map(x => x.index).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), 'flat covers every slot exactly once');
      s.pointers.forEach(ptr => assert.ok(s.rows.some(r => r.id === ptr.row), 'pointer names an existing row'));
    });
  }
});

test('merge(): compare steps name the item that goes next, take steps write exactly that item', () => {
  for (const input of INPUTS.slice(0, 120)) {
    const steps = M.merge(input);
    steps.forEach((s, k) => {
      if (s.kind !== 'compare') return;
      const nextStep = steps[k + 1];
      assert.equal(nextStep.kind, 'take');
      const p = placements(nextStep);
      assert.equal(p[s.next].row, s.range[2], 'the chosen item flew to the output row');
      const cmp = s.rows.flatMap(r => r.items).filter(it => it.state === 'compare');
      assert.equal(cmp.length, 2, 'exactly two fronts are being compared');
      const chosen = cmp.find(it => it.id === s.next), other = cmp.find(it => it.id !== s.next);
      assert.ok(chosen.value <= other.value, 'the chosen front is the smaller one');
    });
  }
});

test('merge(): singletons need no comparisons, empty and one-value inputs are handled', () => {
  const empty = M.merge([]);
  assert.equal(lastOf(empty).kind, 'done');
  assert.equal(lastOf(empty).rows.length, 1);
  const one = M.merge([42]);
  assert.deepEqual(one.map(s => s.kind), ['start', 'call', 'base', 'done']);
  assert.equal(lastOf(one).counters.comparisons, 0);
  assert.equal(lastOf(one).rows[0].items[0].state, 'done');
});

test('merge(): stability. Equal values with labels keep their input order', () => {
  const input = [{ value: 3, label: 'a' }, { value: 1 }, { value: 3, label: 'b' }, { value: 2 }, { value: 3, label: 'c' }, { value: 1, label: 'd' }];
  const last = lastOf(M.merge(input));
  const p = placements(last);
  const out = Object.keys(p).sort((x, y) => p[x].slot - p[y].slot).map(id => p[id].item.label || '.');
  assert.deepEqual(out, ['.', 'd', '.', 'a', 'b', 'c']);
});

test('merge(): the recursion tree in every step is consistent', () => {
  for (const input of INPUTS.slice(0, 60)) {
    if (!input.length) continue;
    const steps = M.merge(input), T = M.buildTree(input.length);
    steps.forEach((s, k) => {
      if (!s.tree) return;
      const ids = new Set(s.tree.nodes.map(x => x.id));
      assert.equal(ids.size, s.tree.nodes.length, 'unique tree node ids');
      s.tree.nodes.forEach(nd => {
        if (nd.left) assert.ok(ids.has(nd.left)); if (nd.right) assert.ok(ids.has(nd.right));
      });
      assert.ok(s.tree.nodes.filter(nd => nd.state === 'active').length <= 1, `at most one active call (step ${k})`);
    });
    assert.equal(lastOf(steps).tree.nodes.length, T.nodes.length, 'the finished tree has every call');
    assert.equal(lastOf(steps).tree.nodes[0].state, 'done');
    assert.ok(lastOf(steps).tree.nodes.slice(1).every(nd => nd.state === 'visited'));
  }
});

test('merge(): code labels used by steps exist in every language', () => {
  const langs = ['pseudo', 'js', 'py'].map(l => code.parse(M.CODE_MERGE[l], l));
  const used = new Set();
  M.merge([5, 2, 8, 4, 1, 6, 3, 7, 9]).forEach(s => {
    (Array.isArray(s.line) ? s.line : [s.line]).forEach(l => { if (l) used.add(l); });
  });
  ['sort', 'base', 'mid', 'left', 'right', 'merge', 'copy', 'init', 'cmp', 'takeL', 'takeR', 'drainL', 'drainR'].forEach(l => used.add(l));
  for (const label of used) langs.forEach((parsed, i) => assert.ok(parsed.labels[label] && parsed.labels[label].length, `label ${label} exists in language #${i}`));
});

/* ------------------------------------------------------------ level-by-level and bottom-up */
test('mergeLevels(): all splits then all merges, and the last step is sorted', () => {
  for (const input of INPUTS) {
    const steps = M.mergeLevels(input);
    const ref = refMergeSort(input);
    const p = placements(lastOf(steps));
    const out = Object.keys(p).sort((a, b) => p[a].slot - p[b].slot).map(id => +id.slice(1));
    assert.deepEqual(out, ref.order, `[${input}]`);
    assert.ok(Object.values(p).every(x => x.row === 0));
    if (input.length > 1) {
      assert.equal(lastOf(steps).counters.comparisons, ref.comparisons);
      assert.equal(lastOf(steps).counters.writes, ref.writes);
    }
    steps.forEach(s => { placements(s); s.rows.forEach(r => slotsAreUnique(r.items, 'levels row')); });
  }
});

test('mergeBottomUp(): sorts, is stable, runs double each pass', () => {
  for (const input of INPUTS) {
    const steps = M.mergeBottomUp(input);
    const last = lastOf(steps), p = placements(last);
    const out = Object.keys(p).sort((a, b) => p[a].slot - p[b].slot).map(id => +id.slice(1));
    assert.deepEqual(out, refMergeSort(input).order, `bottom-up order on [${input}]`);
    const n = input.length, m = n < 2 ? 0 : Math.ceil(Math.log2(n));
    assert.ok(Object.values(p).every(x => x.row === m && x.item.state === 'done'), `all on the last row [${input}]`);
    steps.forEach(s => { placements(s); s.rows.forEach(r => slotsAreUnique(r.items, 'bottom-up row')); });
    let prev = 0;
    steps.forEach(s => { assert.ok(s.counters.writes >= prev); prev = s.counters.writes; });
  }
  // for powers of two bottom-up and top-down do exactly the same merges
  for (const input of [[5, 2, 8, 4, 1, 6, 3, 7], [3, 1, 2, 0], [9, 9, 1, 1, 5, 5, 0, 0, 3, 2, 8, 7, 6, 1, 4, 4]]) {
    const bu = lastOf(M.mergeBottomUp(input)).counters, td = M.mergeCount(input);
    assert.equal(bu.comparisons, td.comparisons);
    assert.equal(bu.writes, td.writes);
  }
});

/* ------------------------------------------------------------ two runs in isolation */
test('mergeRuns(): merges two sorted runs, one write per comparison, ties take the left', () => {
  const rng = core.rng(99);
  for (let c = 0; c < 200; c++) {
    const L = Array.from({ length: rng.int(0, 7) }, () => rng.int(0, 9)).sort((x, y) => x - y);
    const R = Array.from({ length: rng.int(0, 7) }, () => rng.int(0, 9)).sort((x, y) => x - y);
    const steps = M.mergeRuns(L, R);
    const last = lastOf(steps);
    const out = last.rows[2].items.sort((a, b) => a.index - b.index).map(it => it.value);
    assert.deepEqual(out, L.concat(R).sort((x, y) => x - y), `[${L}] + [${R}]`);
    const ref = M.mergeValues(L, R);
    assert.equal(last.counters.comparisons, ref.comparisons);
    assert.equal(last.counters.written, L.length + R.length);
    assert.ok(last.counters.comparisons <= Math.max(0, L.length + R.length - 1));
    // stability: left-run values come before equal right-run values in the output
    const lastLeftBefore = last.rows[2].items.sort((a, b) => a.index - b.index).map(it => it.id);
    const pos = id => lastLeftBefore.indexOf(id);
    for (let i = 0; i < L.length; i++) for (let j = 0; j < R.length; j++) if (L[i] === R[j]) assert.ok(pos('l' + i) < pos('r' + j), 'equal values: left run first');
    steps.forEach(s => { s.rows.forEach(r => slotsAreUnique(r.items, 'runs row')); });
    steps.forEach((s, k) => { if (s.kind === 'compare') assert.ok(s.next && steps[k + 1].kind === 'take'); });
  }
});

test('mergeRuns(): tie: "right" flips equal values (an unstable merge), and the counts are unchanged', () => {
  const L = [{ value: 3, label: 'a' }, { value: 5 }], R = [{ value: 3, label: 'b' }, { value: 4 }];
  const stable = lastOf(M.mergeRuns(L, R, { tie: 'left' })).rows[2].items.sort((x, y) => x.index - y.index).map(it => it.label || it.value);
  const flipped = lastOf(M.mergeRuns(L, R, { tie: 'right' })).rows[2].items.sort((x, y) => x.index - y.index).map(it => it.label || it.value);
  assert.deepEqual(stable, ['a', 'b', 4, 5]);
  assert.deepEqual(flipped, ['b', 'a', 4, 5]);
});

test('mergeRuns(): inversion counter equals the brute-force count of cross pairs', () => {
  const rng = core.rng(5);
  for (let c = 0; c < 200; c++) {
    const L = Array.from({ length: rng.int(0, 6) }, () => rng.int(0, 9)).sort((x, y) => x - y);
    const R = Array.from({ length: rng.int(0, 6) }, () => rng.int(0, 9)).sort((x, y) => x - y);
    const last = lastOf(M.mergeRuns(L, R, { inversions: true }));
    let cross = 0; L.forEach(x => R.forEach(y => { if (x > y) cross++; }));
    assert.equal(last.counters.inversions, cross, `[${L}] + [${R}]`);
  }
});

/* ------------------------------------------------------------ inversions, counts, ticks, tree */
test('mergeInversions() equals the O(n^2) count and sorts', () => {
  for (const input of INPUTS) {
    const r = M.mergeInversions(input);
    assert.equal(r.count, bruteInversions(input), `[${input}]`);
    assert.deepEqual(r.sorted, input.slice().sort((a, b) => a - b));
  }
});

test('mergeCount(): known costs', () => {
  assert.deepEqual(M.mergeCount([]), { comparisons: 0, writes: 0, merges: 0, levels: 0 });
  assert.deepEqual(M.mergeCount([1]), { comparisons: 0, writes: 0, merges: 0, levels: 0 });
  const n = 64, sorted = Array.from({ length: n }, (_, i) => i), reversed = sorted.slice().reverse();
  // writes: every level of merging writes every value once
  assert.equal(M.mergeCount(sorted).writes, n * 6);
  assert.equal(M.mergeCount(sorted).levels, 6);
  // sorted input: each merge exhausts the left run first: n/2 comparisons per level
  assert.equal(M.mergeCount(sorted).comparisons, (n / 2) * 6);
  assert.equal(M.mergeCount(reversed).comparisons, (n / 2) * 6);
  // worst case bound n * ceil(log2 n) - 2^ceil(log2 n) + 1 for n a power of two: n log n - n + 1
  const rng = core.rng(3);
  for (let t = 0; t < 40; t++) {
    const a = Array.from({ length: 1 + rng.int(0, 60) }, () => rng.int(0, 1000));
    const m = M.mergeCount(a), k = Math.ceil(Math.log2(Math.max(2, a.length)));
    assert.ok(m.comparisons <= a.length * k - (1 << k) + 1 || a.length < 2, `worst-case bound for n=${a.length}`);
    assert.ok(m.comparisons >= (a.length / 2) * Math.floor(Math.log2(Math.max(1, a.length))) - a.length || a.length < 2);
    assert.equal(m.levels, a.length < 2 ? 0 : k);
  }
});

test('treeLevels(): every level of a power-of-two tree costs n, and the tree has log2 n + 1 levels', () => {
  for (const n of [2, 4, 8, 16, 32, 64]) {
    const lv = M.treeLevels(n);
    assert.equal(lv.length, Math.log2(n) + 1);
    lv.slice(0, -1).forEach(l => assert.equal(l.work, n));
    assert.equal(lv[lv.length - 1].work, 0, 'the leaves merge nothing');
    assert.equal(lv.reduce((s, l) => s + l.work, 0), M.mergeCount(Array.from({ length: n }, (_, i) => i)).writes);
  }
  // any n: total work equals the writes the trace makes
  for (let n = 0; n <= 40; n++) {
    const total = M.treeLevels(n).reduce((s, l) => s + l.work, 0);
    assert.equal(total, M.mergeCount(Array.from({ length: n }, (_, i) => i)).writes, `n=${n}`);
    M.treeLevels(n).forEach(l => assert.equal(l.sizes.length >= 1 && l.sizes.reduce((a, b) => a + b, 0) <= n, true));
  }
  assert.deepEqual(M.treeLevels(0), []);
});

test('mergeTicks(): one frame per comparison-or-write, monotone', () => {
  for (const input of INPUTS.slice(0, 60)) {
    const steps = M.merge(input), frames = M.mergeTicks(steps);
    const total = lastOf(steps).ops.comparisons + lastOf(steps).ops.writes;
    assert.equal(frames.length, total + 1);
    let prev = -1;
    frames.forEach((f, t) => {
      const w = f.ops.comparisons + f.ops.writes;
      assert.ok(w <= t && w >= prev);
      prev = w;
    });
    if (total > 0) assert.equal(lastOf(frames), lastOf(steps));
    assert.equal(frames[0], steps[0], 'tick 0 is the untouched input');
  }
});

test('registers into VDSA.algos.sorting without replacing lesson 14 keys (browser-style merge)', () => {
  const fake = {};
  const src = require('node:fs').readFileSync(path.join(ROOT, 'js', 'algos', '15-merge-sort.js'), 'utf8');
  const sandboxWindow = { VDSA: { algos: { sorting: { bubble: 'keep', CODE: 'keep', META: 'keep', run: 'keep' } } } };
  new Function('window', 'module', src.replace(/\}\(typeof window !== 'undefined' \? window : null,/, '}(window,'))(sandboxWindow, undefined);
  const s = sandboxWindow.VDSA.algos.sorting;
  assert.equal(s.bubble, 'keep'); assert.equal(s.CODE, 'keep'); assert.equal(s.META, 'keep'); assert.equal(s.run, 'keep');
  ['merge', 'mergeBottomUp', 'mergeLevels', 'mergeRuns', 'mergeCount', 'mergeTicks', 'mergeInversions', 'CODE_MERGE', 'META_MERGE'].forEach(k => assert.ok(s[k], k));
  assert.ok(sandboxWindow.VDSA.algos.mergesort.merge);
  void fake;
});
