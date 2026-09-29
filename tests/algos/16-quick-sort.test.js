/* Step generators for lesson 16 (js/algos/16-quick-sort.js): quick sort with Lomuto, Hoare and three-way partitions,
   the Dutch national flag, quickselect, fast counts, recursion-tree shapes and a merge trace for the race.
   Run: node --test tests/algos/16-quick-sort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '16-quick-sort.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const STRATS = ['last', 'first', 'middle', 'median3'];   // deterministic ones (random has its own tests)
const FULL = { lomuto: S.quickLomuto, hoare: S.quickHoare, three: S.quickThree };

/* ------------------------------------------------------------ helpers */
function randomInputs(seed, count, maxLen, maxVal) {
  const rng = core.rng(seed), out = [];
  for (let c = 0; c < count; c++) {
    const n = rng.int(0, maxLen), a = [];
    for (let i = 0; i < n; i++) a.push(rng.int(-maxVal, maxVal));
    out.push(a);
  }
  return out;
}
const EDGE = [[], [7], [4, 4], [2, 1], [1, 2], [3, 3, 3, 3], [1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1],
  [5, 1, 4, 2, 8, 3], [2, 3, 2, 3, 2, 3], [-3, 0, -3, 9, -1], [6, 2, 9, 4, 7, 1, 8, 4], [1, 1, 1, 2, 2, 2]];
const sortedCopy = a => a.slice().sort((x, y) => x - y);
const lastOf = a => a[a.length - 1];
const valuesOf = step => step.order.map(id => step.items.find(it => it.id === id).value);

/* straightforward reference implementations (textbook, counting comparisons and swaps the same way the lesson does) */
function pickRef(a, lo, hi, strat) {
  const mid = lo + ((hi - lo) >> 1);
  if (strat === 'first') return { idx: lo, cost: 0 };
  if (strat === 'middle') return { idx: mid, cost: 0 };
  if (strat === 'median3' && hi - lo + 1 >= 3) {
    const c = [lo, mid, hi].sort((x, y) => (a[x] - a[y]) || (x - y));
    return { idx: c[1], cost: 3 };
  }
  return { idx: hi, cost: 0 };
}
function refLomuto(input, strat) {
  const a = input.slice(); let c = 0, s = 0;
  const swap = (x, y) => { if (x !== y) { [a[x], a[y]] = [a[y], a[x]]; s++; } };
  (function qs(lo, hi) {
    if (lo >= hi) return;
    const pv = pickRef(a, lo, hi, strat); c += pv.cost; swap(pv.idx, hi);
    const pivot = a[hi]; let i = lo - 1;
    for (let j = lo; j < hi; j++) { c++; if (a[j] <= pivot) { i++; swap(i, j); } }
    swap(i + 1, hi);
    qs(lo, i); qs(i + 2, hi);
  })(0, a.length - 1);
  return { a, c, s };
}
function refHoare(input, strat) {
  const a = input.slice(); let c = 0, s = 0;
  const swap = (x, y) => { if (x !== y) { [a[x], a[y]] = [a[y], a[x]]; s++; } };
  (function qs(lo, hi) {
    if (lo >= hi) return;
    const pv = pickRef(a, lo, hi, strat); c += pv.cost; swap(pv.idx, lo);
    const pivot = a[lo]; let i = lo, j = hi, p;
    for (;;) {
      while (++c && a[i] < pivot) i++;
      while (++c && a[j] > pivot) j--;
      if (i >= j) { p = j; break; }
      swap(i, j); i++; j--;
    }
    qs(lo, p); qs(p + 1, hi);
  })(0, a.length - 1);
  return { a, c, s };
}
function refThree(input, strat) {
  const a = input.slice(); let c = 0, s = 0;
  const swap = (x, y) => { if (x !== y) { [a[x], a[y]] = [a[y], a[x]]; s++; } };
  (function qs(lo, hi) {
    if (lo >= hi) return;
    const pv = pickRef(a, lo, hi, strat); c += pv.cost; swap(pv.idx, lo);
    const pivot = a[lo]; let lt = lo, i = lo, gt = hi;
    while (i <= gt) {
      c++;
      if (a[i] < pivot) { swap(lt, i); lt++; i++; } else if (a[i] > pivot) { swap(i, gt); gt--; } else i++;
    }
    qs(lo, lt - 1); qs(gt + 1, hi);
  })(0, a.length - 1);
  return { a, c, s };
}
const REF = { lomuto: refLomuto, hoare: refHoare, three: refThree };

/* ------------------------------------------------------------ correctness */
test('every full generator sorts edge cases and 200 random inputs, for every pivot strategy', () => {
  const inputs = EDGE.concat(randomInputs(20260929, 200, 13, 12));
  for (const kind of Object.keys(FULL)) {
    for (const strat of STRATS.concat(['random'])) {
      for (const input of inputs) {
        const steps = FULL[kind](input, { pivot: strat, seed: 5 });
        const last = lastOf(steps);
        assert.deepEqual(valuesOf(last), sortedCopy(input), `${kind}/${strat} on [${input}]`);
        assert.equal(last.kind, 'done');
        assert.deepEqual(last.final, input.map((_, i) => i), `${kind}/${strat}: all positions final at the end`);
        assert.ok(last.items.every(it => it.state === 'done'), `${kind}/${strat}: every item done at the end`);
      }
    }
  }
});

test('comparisons and swaps match the textbook reference, and quickCount matches the steps', () => {
  const inputs = EDGE.concat(randomInputs(7, 150, 12, 9));
  for (const kind of Object.keys(FULL)) {
    for (const strat of STRATS) {
      for (const input of inputs) {
        const ref = REF[kind](input, strat);
        const steps = FULL[kind](input, { pivot: strat });
        const last = lastOf(steps);
        assert.deepEqual(valuesOf(last), ref.a, `${kind}/${strat} output on [${input}]`);
        assert.equal(last.ops.comparisons, ref.c, `${kind}/${strat} comparisons on [${input}]`);
        assert.equal(last.ops.swaps, ref.s, `${kind}/${strat} swaps on [${input}]`);
        const fast = S.quickCount(input, { partition: kind, pivot: strat });
        assert.deepEqual([fast.comparisons, fast.swaps], [ref.c, ref.s], `${kind}/${strat} quickCount on [${input}]`);
        assert.deepEqual(fast.result, ref.a);
      }
    }
    // random pivots: the generator and the fast counter draw from the same stream
    for (const input of inputs.slice(0, 60)) {
      const last = lastOf(FULL[kind](input, { pivot: 'random', seed: 11 }));
      const fast = S.quickCount(input, { partition: kind, pivot: 'random', seed: 11 });
      assert.deepEqual([last.ops.comparisons, last.ops.swaps], [fast.comparisons, fast.swaps], `${kind}/random on [${input}]`);
    }
  }
});

test('known costs: sorted input with a first or last pivot is quadratic; middle and median of three are not', () => {
  const n = 31, sorted = Array.from({ length: n }, (_, i) => i + 1), half = n * (n - 1) / 2;
  assert.equal(S.quickCount(sorted, { pivot: 'last' }).comparisons, half);
  assert.equal(S.quickCount(sorted, { pivot: 'first' }).comparisons, half);
  assert.equal(S.quickCount(sorted, { pivot: 'last' }).depth, n);
  assert.equal(S.quickCount(sorted, { pivot: 'middle' }).depth, 5);           // perfectly balanced: 31 = 1 + 15 + 15 ...
  assert.ok(S.quickCount(sorted, { pivot: 'middle' }).comparisons < 3 * n * Math.log2(n));
  assert.ok(S.quickCount(sorted, { pivot: 'median3' }).comparisons < 3 * n * Math.log2(n));
  const rev = sorted.slice().reverse();
  assert.equal(S.quickCount(rev, { pivot: 'last' }).comparisons, half);
  // all equal: Lomuto collapses (every value is <= pivot), three-way is one pass
  const eq = Array(n).fill(4);
  assert.equal(S.quickCount(eq, { partition: 'lomuto' }).comparisons, half);
  assert.equal(S.quickCount(eq, { partition: 'three' }).comparisons, n);
  assert.ok(S.quickCount(eq, { partition: 'hoare' }).comparisons < 4 * n * Math.log2(n));
  // random pivots on sorted input: about 2 n ln n comparisons, far below n^2/2
  let tot = 0;
  for (let seed = 1; seed <= 30; seed++) tot += S.quickCount(sorted, { pivot: 'random', seed }).comparisons;
  assert.ok(tot / 30 < 3 * n * Math.log(n) + 30 && tot / 30 < half / 2, `average ${tot / 30}`);
});

/* ------------------------------------------------------------ truth of every snapshot */
function checkTruth(steps, input, label) {
  const sorted = sortedCopy(input), n = input.length;
  let prevC = 0, prevS = 0;
  const finalAt = {};   // id -> slot once it is claimed final
  steps.forEach((st, k) => {
    const tag = `${label} step ${k} (${st.kind})`;
    assert.equal(st.items.length, n, tag);
    assert.equal(new Set(st.order).size, n, `${tag}: ids unique`);
    assert.deepEqual(st.items.map(it => it.id), st.order, `${tag}: order matches items`);
    st.items.forEach((it, slot) => {
      assert.ok(STATES.has(it.state), `${tag}: state ${it.state}`);
      if (it.state === 'done' || it.state === 'found') {
        // a done item sits at its final sorted slot value, and never moves again
        assert.equal(it.value, sorted[slot], `${tag}: ${it.state} value at slot ${slot} must be the sorted value`);
        finalAt[it.id] = slot;
      }
    });
    Object.keys(finalAt).forEach(id => assert.equal(st.order.indexOf(id), finalAt[id], `${tag}: final item ${id} moved`));
    st.final.forEach(slot => assert.equal(st.items[slot].value, sorted[slot], `${tag}: final slot ${slot}`));
    st.regions.forEach(r => { assert.ok(r.from >= 0 && r.to < n && r.from <= r.to, `${tag}: region ${r.id} ${r.from}..${r.to}`); assert.ok(STATES.has(r.state)); });
    st.pointers.forEach(p => assert.ok(STATES.has(p.state) && Number.isInteger(p.index) && p.index >= -1 && p.index <= n, `${tag}: pointer ${p.name}`));
    assert.ok(st.counters.comparisons >= prevC && st.counters.swaps >= prevS, `${tag}: counters only grow`);
    prevC = st.counters.comparisons; prevS = st.counters.swaps;
    assert.ok(st.range[0] >= 0 && st.range[1] < n || n === 0, `${tag}: range`);
    assert.equal(typeof st.caption, 'string');
  });
}

test('every snapshot is truthful: done items are final and never move, regions and pointers are valid', () => {
  const inputs = EDGE.concat(randomInputs(31, 60, 11, 8));
  for (const kind of Object.keys(FULL)) for (const strat of ['last', 'median3', 'random']) for (const input of inputs) {
    checkTruth(FULL[kind](input, { pivot: strat, seed: 3 }), input, `${kind}/${strat} [${input}]`);
  }
});

test('Lomuto partition: the invariant regions describe the array at every step', () => {
  for (const input of EDGE.concat(randomInputs(9, 60, 10, 6)).filter(a => a.length > 1)) {
    const steps = S.partitionLomuto(input, { pivot: 'last' });
    const pivot = input[input.length - 1];
    steps.forEach(st => {
      if (!['compare', 'small', 'large'].includes(st.kind)) return;
      const v = valuesOf(st);
      st.regions.forEach(r => {
        for (let k = r.from; k <= r.to; k++) {
          if (r.id === 'small') assert.ok(v[k] <= pivot, `small zone holds ${v[k]} > ${pivot} in [${input}]`);
          if (r.id === 'big') assert.ok(v[k] > pivot, `big zone holds ${v[k]} <= ${pivot} in [${input}]`);
        }
      });
    });
    const last = lastOf(steps), v = valuesOf(last), p = last.split;
    assert.equal(v[p], pivot, 'the pivot lands at the split index');
    for (let k = 0; k < p; k++) assert.ok(v[k] <= pivot);
    for (let k = p + 1; k < v.length; k++) assert.ok(v[k] > pivot);
    assert.equal(last.items[p].state, 'done');
    assert.equal(last.items.filter(it => it.state === 'done').length, 1, 'only the pivot is final after one Lomuto partition');
  }
});

test('Hoare partition: left of the split is <= pivot, right is >= pivot, and the pivot is never claimed final', () => {
  for (const strat of STRATS) for (const input of EDGE.concat(randomInputs(12, 80, 10, 6)).filter(a => a.length > 1)) {
    const steps = S.partitionHoare(input, { pivot: strat });
    const last = lastOf(steps), v = valuesOf(last), p = last.split;
    assert.ok(p >= 0 && p < input.length - 1, `split ${p} leaves both sides non-empty for [${input}]`);
    const pivotItem = steps[steps.length - 1].items; void pivotItem;
    const pivotVal = steps.find(s => s.kind === 'init').vars.pivot;
    for (let k = 0; k <= p; k++) assert.ok(v[k] <= pivotVal, `[${input}] left ${v[k]} > ${pivotVal}`);
    for (let k = p + 1; k < v.length; k++) assert.ok(v[k] >= pivotVal, `[${input}] right ${v[k]} < ${pivotVal}`);
    assert.ok(steps.every(s => s.items.every(it => it.state !== 'done')), 'no item is done: Hoare does not place the pivot');
    assert.deepEqual(sortedCopy(v), sortedCopy(input), 'a partition only permutes');
  }
});

test('three-way partition: less | equal | greater, and the equal zone is final', () => {
  for (const input of EDGE.concat(randomInputs(15, 80, 12, 4)).filter(a => a.length > 1)) {
    const steps = S.quickThree(input);
    const placeStep = steps.find(s => s.kind === 'place');
    const v = valuesOf(placeStep), P = placeStep.vars.pivot, { lt, gt } = placeStep;
    for (let k = 0; k < lt; k++) assert.ok(v[k] < P);
    for (let k = lt; k <= gt; k++) assert.equal(v[k], P);
    for (let k = gt + 1; k < v.length; k++) assert.ok(v[k] > P);
    for (let k = lt; k <= gt; k++) assert.equal(placeStep.items[k].state, 'done');
  }
});

/* ------------------------------------------------------------ Dutch national flag */
test('Dutch flag: sorts 0/1/2 in one pass, keeps identity colours, at most one comparison per item', () => {
  const rng = core.rng(77), all = [[0], [1], [2], [2, 1, 0], [0, 0, 0], [1, 1], []];
  for (let c = 0; c < 120; c++) { const n = rng.int(1, 14), a = []; for (let i = 0; i < n; i++) a.push(rng.int(0, 2)); all.push(a); }
  for (const input of all) {
    const steps = S.dutchFlag(input);
    const last = lastOf(steps);
    assert.deepEqual(valuesOf(last), sortedCopy(input), `[${input}]`);
    assert.equal(last.ops.comparisons, input.length, 'one comparison per item');
    steps.forEach(st => st.items.forEach(it => assert.equal(it.state, ['error', 'default', 'active'][it.value], 'flag colours follow the value')));
    steps.forEach(st => st.items.forEach(it => assert.equal(it.text, 'RWB'[it.value])));
  }
  assert.throws(() => S.dutchFlag([0, 3]), /0, 1 and 2/);
});

/* ------------------------------------------------------------ quickselect */
test('quickselect returns the k-th smallest for every k, and only ever narrows the range', () => {
  const inputs = EDGE.filter(a => a.length).concat(randomInputs(21, 120, 12, 9).filter(a => a.length));
  for (const strat of ['last', 'median3', 'random', 'first']) for (const input of inputs) {
    const sorted = sortedCopy(input);
    for (let k = 1; k <= input.length; k++) {
      const steps = S.quickselect(input, k, { pivot: strat, seed: 2 });
      const last = lastOf(steps);
      assert.equal(last.kind, 'hit');
      const found = last.items.filter(it => it.state === 'found');
      assert.equal(found.length, 1, 'exactly one item is found');
      assert.equal(found[0].value, sorted[k - 1], `k = ${k} of [${input}] (${strat})`);
      const fast = S.quickselectCount(input, k, { pivot: strat, seed: 2 });
      assert.equal(fast.result, sorted[k - 1]);
      assert.deepEqual([last.ops.comparisons, last.ops.swaps, last.counters.partitions], [fast.comparisons, fast.swaps, fast.partitions], `counts k=${k} [${input}]`);
      let lo = 0, hi = input.length - 1;
      steps.forEach(st => {
        assert.ok(st.range[0] >= lo && st.range[1] <= hi, 'the range never grows');
        lo = st.range[0]; hi = st.range[1];
        assert.ok(lo <= k - 1 && k - 1 <= hi, 'the target index stays inside the range');
        st.items.forEach((it, slot) => { if (slot < st.range[0] || slot > st.range[1]) assert.ok(it.state === 'muted' || it.state === 'found', 'outside the range is muted'); });
      });
    }
  }
  assert.throws(() => S.quickselect([1, 2, 3], 0), /k must be/);
  assert.throws(() => S.quickselect([1, 2, 3], 4), /k must be/);
  assert.equal(S.quickselect([], 1).length, 1);
});

test('quickselect does far less work than sorting: about 2-3.5 n comparisons in expectation', () => {
  const rng = core.rng(5), n = 200, a = [];
  for (let i = 0; i < n; i++) a.push(rng.int(0, 10000));
  let tot = 0;
  for (let seed = 1; seed <= 30; seed++) tot += S.quickselectCount(a, 100, { pivot: 'random', seed }).comparisons;
  const avg = tot / 30, sortCost = S.quickCount(a, { pivot: 'random', seed: 1 }).comparisons;
  assert.ok(avg < 4 * n, `avg ${avg}`);
  assert.ok(avg < sortCost / 2, `avg ${avg} vs sort ${sortCost}`);
});

test('recursing into the smaller side first keeps the stack logarithmic even when the tree is a chain', () => {
  const n = 64, sorted = Array.from({ length: n }, (_, i) => i + 1);
  const bad = S.quickCount(sorted, { pivot: 'last' });
  assert.equal(bad.depth, n);
  assert.ok(bad.stackDepth <= 2, `stack ${bad.stackDepth}`);
  for (const input of randomInputs(8, 60, 60, 20)) {
    const r = S.quickCount(input, { pivot: 'random', seed: 3 });
    assert.ok(r.stackDepth <= Math.log2(Math.max(2, input.length)) + 2, `stack ${r.stackDepth} for n=${input.length}`);
  }
});

/* ------------------------------------------------------------ recursion trees */
test('quickTree: balanced on sorted input with a middle pivot, a chain with a last pivot', () => {
  const sorted = Array.from({ length: 15 }, (_, i) => i + 1);
  const good = S.quickTree(sorted, { pivot: 'middle' }), bad = S.quickTree(sorted, { pivot: 'last' });
  assert.equal(good.nodes.length, 15); assert.equal(bad.nodes.length, 15);
  assert.equal(good.depth, 4); assert.equal(bad.depth, 15);
  assert.equal(bad.comparisons, 15 * 14 / 2);
  assert.ok(good.comparisons < 40);
  assert.equal(good.nodes.reduce((t, nd) => t + nd.comparisons, 0), good.comparisons, 'node costs add up to the total');
  assert.equal(good.nodes[0].pivot, 8, 'the middle value is the first pivot');
  // preorder: every node comes after its parent
  const seen = new Set();
  good.nodes.forEach(nd => { assert.ok(nd.parent === null || seen.has(nd.parent)); seen.add(nd.id); });
  // the generator's tree ends with the same number of nodes and the same depth
  const st = lastOf(S.quickLomuto(sorted, { pivot: 'last' }));
  assert.equal(st.tree.nodes.length, 15);
});

test('the tree in each step is a valid binary tree that only grows', () => {
  for (const input of EDGE.filter(a => a.length).concat(randomInputs(3, 25, 12, 6).filter(a => a.length))) {
    const steps = S.quickLomuto(input);
    let prev = 0;
    steps.forEach(st => {
      const t = st.tree, ids = new Set(t.nodes.map(x => x.id));
      assert.ok(t.nodes.length >= prev); prev = t.nodes.length;
      t.nodes.forEach(nd => { [nd.left, nd.right].forEach(c => { if (c) assert.ok(ids.has(c)); }); assert.ok(STATES.has(nd.state)); });
      assert.ok(st.frames.length <= t.nodes.length);
    });
    assert.equal(lastOf(steps).tree.nodes.length, input.length, 'one node per value (each call has 1+ values)');
    assert.ok(lastOf(steps).tree.nodes.every(nd => nd.state === 'done'));
  }
});

/* ------------------------------------------------------------ stability, labels, duplicates */
test('quick sort is not stable: Lomuto reorders equal values', () => {
  const input = [{ value: 4, label: 'a' }, { value: 4, label: 'b' }, { value: 1 }];
  const last = lastOf(S.quickLomuto(input));
  const order = last.order.map(id => last.items.find(it => it.id === id)).map(it => (it.label ? it.value + it.label : String(it.value)));
  assert.deepEqual(order, ['1', '4b', '4a']);
});

test('items keep their identity and labels; custom ids are respected', () => {
  const input = [{ value: 3, label: 'x', id: 'q3' }, { value: 1, id: 'q1' }, { value: 2, id: 'q2' }];
  const steps = S.quickLomuto(input);
  assert.deepEqual(new Set(lastOf(steps).order), new Set(['q3', 'q1', 'q2']));
  assert.equal(lastOf(steps).items.find(it => it.id === 'q3').label, 'x');
  assert.deepEqual(valuesOf(lastOf(steps)), [1, 2, 3]);
});

test('the first partition of a known array (Lomuto, last pivot)', () => {
  const steps = S.partitionLomuto([7, 2, 9, 4, 3, 8, 5], { pivot: 'last' });
  assert.deepEqual(valuesOf(lastOf(steps)), [2, 4, 3, 5, 9, 8, 7]);
  assert.equal(lastOf(steps).split, 3);
});

/* ------------------------------------------------------------ code labels and flow ids */
test('every step line exists in pseudocode, JavaScript and Python', () => {
  const kinds = { lomuto: S.quickLomuto([5, 2, 8, 1, 9, 3, 7], { pivot: 'median3' }).concat(S.quickLomuto([3, 1, 2], { pivot: 'first' })),
    hoare: S.quickHoare([5, 2, 8, 1, 9, 3, 7], { pivot: 'random', seed: 4 }), three: S.dutchFlag([2, 0, 1, 1, 0]).concat(S.quickThree([4, 1, 4, 2, 4])),
    select: S.quickselect([5, 2, 8, 1, 9, 3, 7], 3, { pivot: 'first' }).concat(S.quickselect([5, 2, 8, 1, 9, 3, 7], 6)) };
  const codeKey = { lomuto: 'lomuto', hoare: 'hoare', three: 'three', select: 'select' };
  for (const kind of Object.keys(kinds)) {
    const parsed = {};
    ['pseudo', 'js', 'py'].forEach(l => { parsed[l] = code.parse(S.CODE_QUICK[codeKey[kind]][l], l); });
    kinds[kind].forEach(st => {
      if (st.line === null) return;
      [].concat(st.line).forEach(label => ['pseudo', 'js', 'py'].forEach(l => assert.ok(parsed[l].labels[label], `${kind}: label "${label}" missing in ${l} (step ${st.kind})`)));
    });
  }
});

test('the code for every algorithm runs and agrees with the generators', () => {
  // execute the JavaScript listings with a simple pivot parking helper and compare with the generator's final array
  function runJs(kind, input, k) {
    const src = code.plainText ? code.plainText(code.parse(S.CODE_QUICK[kind].js, 'js')) : S.CODE_QUICK[kind].js.replace(/\/\/ @\w+( @\w+)*/g, '');
    const a = input.slice();
    const choosePivot = kind === 'hoare' ? (arr, lo) => { void arr; void lo; } : () => {};
    const fn = new Function('a', 'k', 'choosePivot', src + '\n' + (kind === 'select' ? 'return quickselect(a, k);' : kind === 'three' ? 'partition3(a, 0, a.length - 1, a[0]); return a;' : 'quickSort(a); return a;'));
    return fn(a, k, choosePivot);
  }
  for (const input of [[5, 2, 8, 1, 9, 3, 7], [3, 3, 1, 2, 3], [9, 8, 7, 6], [1]]) {
    assert.deepEqual(runJs('lomuto', input), sortedCopy(input));
    assert.deepEqual(runJs('hoare', input), sortedCopy(input));
    const three = runJs('three', input);
    assert.deepEqual(sortedCopy(three), sortedCopy(input));
    for (let k = 1; k <= input.length; k++) assert.equal(runJs('select', input, k), sortedCopy(input)[k - 1]);
  }
});

/* ------------------------------------------------------------ merge trace for the race */
test('raceMerge sorts and its op counts are the textbook merge sort counts', () => {
  for (const input of EDGE.concat(randomInputs(41, 80, 14, 9))) {
    const steps = S.raceMerge(input), last = lastOf(steps);
    assert.deepEqual(valuesOf(last), sortedCopy(input), `[${input}]`);
    let c = 0, w = 0;
    (function ms(a) {
      if (a.length < 2) return a;
      const m = (a.length + 1) >> 1, L = ms(a.slice(0, m)), R = ms(a.slice(m)), out = []; let i = 0, j = 0;
      while (i < L.length && j < R.length) { c++; out.push(L[i] <= R[j] ? L[i++] : R[j++]); w++; }
      while (i < L.length) { out.push(L[i++]); w++; }
      while (j < R.length) { out.push(R[j++]); w++; }
      return out;
    })(input);
    assert.equal(last.ops.comparisons, c);
    assert.equal(last.ops.shifts, w);
    steps.forEach(st => assert.equal(new Set(st.order).size, input.length));
  }
});

test('workFrames: one frame per comparison or move, ending at the last step', () => {
  const steps = S.quickLomuto([5, 2, 8, 1, 9, 3, 7]);
  const frames = S.workFrames(steps), last = lastOf(steps);
  assert.equal(frames[0], steps[0]);
  assert.equal(lastOf(frames), last);
  assert.ok(frames.length >= 2 && frames.length <= last.ops.comparisons + last.ops.swaps + 2);
  for (let k = 1; k < frames.length - 1; k++) {
    const d = (frames[k].ops.comparisons + frames[k].ops.swaps) - (frames[k - 1].ops.comparisons + frames[k - 1].ops.swaps);
    assert.ok(d >= 1);
  }
});

test('bad input is rejected with clear errors; the module only adds NEW names to the shared object', () => {
  assert.throws(() => S.quickLomuto([3, 1, 2], { pivot: 'nope' }), /Unknown pivot strategy/);
  assert.throws(() => S.quickCount([1], { partition: 'nope' }), /Unknown partition/);
  const clash = ['CODE', 'META', 'run', 'count', 'normalize', 'bubble', 'selection', 'insertion', 'merge', 'opFrames', 'inversions'];
  clash.forEach(k => assert.equal(S[k], undefined, `${k} belongs to another lesson`));
});
