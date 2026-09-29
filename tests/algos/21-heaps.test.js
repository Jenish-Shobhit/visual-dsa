/* Step generators for lesson 21 (js/algos/21-heaps.js): binary heap operations, build-heap, heap sort, top-k,
   k-way merge and the priority-queue implementations.
   Run: node --test tests/algos/21-heaps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const H = require(path.join(ROOT, 'js', 'algos', '21-heaps.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const FLOWS = new Set(['up:place', 'up:test', 'up:swap', 'up:done', 'down:start', 'down:haschild', 'down:pick', 'down:cmp', 'down:swap', 'down:done']);

/* ------------------------------------------------------------ straightforward reference implementations */
function better(kind, x, y) { return kind === 'max' ? x > y : x < y; }
function refInsert(heap, x, kind) {
  const a = heap.slice(); a.push(x);
  let i = a.length - 1, swaps = 0, cmp = 0;
  while (i > 0) {
    const p = (i - 1) >> 1; cmp++;
    if (better(kind, a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; swaps++; i = p; } else break;
  }
  return { a, swaps, cmp };
}
function refSiftDown(a, i, n, kind, c) {
  for (;;) {
    let m = 2 * i + 1;
    if (m >= n) return;
    if (m + 1 < n) { c.cmp++; if (better(kind, a[m + 1], a[m])) m++; }
    c.cmp++;
    if (better(kind, a[m], a[i])) { [a[i], a[m]] = [a[m], a[i]]; c.swaps++; i = m; } else return;
  }
}
function refExtract(heap, kind) {
  const a = heap.slice(), top = a[0], c = { swaps: 0, cmp: 0 };
  const last = a.pop();
  if (a.length) { a[0] = last; refSiftDown(a, 0, a.length, kind, c); }
  return { a, top, swaps: c.swaps, cmp: c.cmp };
}
function refBuild(values, kind) {
  const a = values.slice(), c = { swaps: 0, cmp: 0 };
  for (let i = (a.length >> 1) - 1; i >= 0; i--) refSiftDown(a, i, a.length, kind, c);
  return { a, swaps: c.swaps, cmp: c.cmp };
}
function refHeapify(values, kind) { let a = []; values.forEach(v => { a = refInsert(a, v, kind).a; }); return a; }

/* ------------------------------------------------------------ helpers */
function lastOf(steps) { return steps[steps.length - 1]; }
function valuesOf(step) { return step.items.map(it => it.value); }
function heapValues(step) { return step.items.slice(0, step.size).map(it => it.value); }
function itemsOf(values) { return values.map((v, i) => ({ id: 'h' + i, value: v })); }
function randomInputs(seed, count, maxLen, maxVal) {
  const rng = core.rng(seed), out = [];
  for (let c = 0; c < count; c++) {
    const n = rng.int(0, maxLen), a = [];
    for (let i = 0; i < n; i++) a.push(rng.int(-maxVal, maxVal));
    out.push(a);
  }
  return out;
}
function validHeapOf(values, kind) { return refHeapify(values, kind); }

/* generic truth checks for any step list */
function checkSteps(steps, label) {
  assert.ok(steps.length > 0, label + ': no steps');
  let prevC = -1, prevS = -1;
  steps.forEach((s, k) => {
    assert.ok(Array.isArray(s.items), label + ' step ' + k + ': items');
    assert.equal(s.order.length, s.items.length);
    s.items.forEach((it, p) => {
      assert.ok(STATES.has(it.state), label + ' step ' + k + ': bad state ' + it.state);
      assert.equal(it.id, s.order[p]);
    });
    assert.equal(new Set(s.order).size, s.order.length, label + ' step ' + k + ': ids must be unique');
    assert.ok(s.size >= 0 && s.size <= s.items.length);
    assert.ok(typeof s.caption === 'string');
    if (s.counters.comparisons !== undefined) {
      assert.ok(s.counters.comparisons >= prevC && s.counters.swaps >= prevS, label + ' step ' + k + ': counters must only grow');
      prevC = s.counters.comparisons; prevS = s.counters.swaps;
    }
    if (s.flow !== null && s.flow !== undefined) assert.ok(FLOWS.has(s.flow), 'unknown flow id ' + s.flow);
    s.pointers.forEach(p => assert.ok(STATES.has(p.state)));
    s.regions.forEach(r => assert.ok(r.from <= r.to));
    (s.edges || []).forEach(e => assert.ok(STATES.has(e[2])));
  });
}
function checkLines(steps, op, kind) {
  const src = H.CODE(op, kind);
  const parsed = {};
  ['pseudo', 'js', 'py'].forEach(l => { parsed[l] = code.parse(src[l], l === 'py' ? 'py' : l).labels; });
  steps.forEach(s => {
    if (s.line === null || s.line === undefined) return;
    const list = Array.isArray(s.line) ? s.line : [s.line];
    list.forEach(lb => ['pseudo', 'js', 'py'].forEach(l => assert.ok(parsed[l][lb], op + '/' + kind + ': label "' + lb + '" missing in ' + l)));
  });
}

/* ------------------------------------------------------------ index arithmetic */
test('index arithmetic: parent, children, height and level', () => {
  assert.equal(H.parent(1), 0); assert.equal(H.parent(2), 0); assert.equal(H.parent(5), 2); assert.equal(H.parent(6), 2);
  assert.equal(H.left(0), 1); assert.equal(H.right(0), 2); assert.equal(H.left(4), 9); assert.equal(H.right(4), 10);
  for (let i = 0; i < 40; i++) { assert.equal(H.parent(H.left(i)), i); assert.equal(H.parent(H.right(i)), i); }
  assert.deepEqual([1, 2, 3, 4, 7, 8, 15, 16].map(H.height), [0, 1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual([0, 1, 2, 3, 6, 7, 14, 15].map(H.levelOf), [0, 1, 1, 2, 2, 3, 3, 4]);
});

test('isHeap: valid, invalid, empty, single, equal values, max mode', () => {
  assert.ok(H.isHeap([], 'min')); assert.ok(H.isHeap([5], 'min')); assert.ok(H.isHeap([2, 2, 2, 2], 'min')); assert.ok(H.isHeap([2, 2, 2, 2], 'max'));
  assert.ok(H.isHeap([1, 3, 2, 7, 4], 'min')); assert.ok(!H.isHeap([3, 1, 2], 'min')); assert.ok(H.isHeap([9, 5, 8, 1, 2], 'max'));
  assert.ok(!H.isHeap([1, 5, 2, 3, 9, 1], 'min'));   // index 5 holds 1 under parent index 2 holding 2
});

/* ------------------------------------------------------------ insert */
test('insert: matches the reference, keeps the heap property, on random inputs (min and max)', () => {
  ['min', 'max'].forEach(kind => {
    randomInputs(21, 60, 15, 30).forEach(vals => {
      const heap = validHeapOf(vals, kind);
      const x = core.rng(vals.length + 5).int(-30, 30);
      const r = H.insert(itemsOf(heap), x, { kind });
      const ref = refInsert(heap, x, kind);
      assert.deepEqual(r.items.map(i => i.value), ref.a);
      assert.ok(H.isHeap(ref.a, kind));
      const fin = lastOf(r.steps);
      assert.equal(fin.counters.swaps, ref.swaps);
      assert.equal(fin.counters.comparisons, ref.cmp);
      assert.deepEqual(valuesOf(fin), ref.a);
      checkSteps(r.steps, 'insert'); checkLines(r.steps, 'insert', kind);
    });
  });
});

test('insert: empty heap, single item, duplicates, and the worst case climbs to the root', () => {
  let r = H.insert([], 7);
  assert.deepEqual(r.items.map(i => i.value), [7]);
  assert.ok(r.steps.some(s => s.kind === 'root'), 'reaching the root is its own step');
  r = H.insert(itemsOf([5]), 5);
  assert.deepEqual(r.items.map(i => i.value), [5, 5]);
  assert.equal(lastOf(r.steps).counters.swaps, 0, 'equal values never swap');
  // worst case: inserting a new minimum climbs height(n) levels
  const heap = [10, 20, 30, 40, 50, 60, 70];
  r = H.insert(itemsOf(heap), 1);
  assert.equal(lastOf(r.steps).counters.swaps, H.height(8));
  assert.equal(r.items[0].value, 1);
  // best case: a value larger than everything does not move
  r = H.insert(itemsOf(heap), 99);
  assert.equal(lastOf(r.steps).counters.swaps, 0);
  // item identity: the new id exists, old ids survive
  r = H.insert(itemsOf(heap), 1, { id: 'new' });
  assert.deepEqual(r.items.map(i => i.id).sort(), ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'new']);
});

/* ------------------------------------------------------------ extract */
test('extract: matches the reference and repeated extraction yields sorted order', () => {
  ['min', 'max'].forEach(kind => {
    randomInputs(22, 60, 15, 30).forEach(vals => {
      const heap = validHeapOf(vals, kind);
      const r = H.extract(itemsOf(heap), { kind });
      if (!heap.length) { assert.equal(r.value, null); assert.deepEqual(r.items, []); return; }
      const ref = refExtract(heap, kind);
      assert.equal(r.value, ref.top);
      assert.deepEqual(r.items.map(i => i.value), ref.a);
      assert.ok(H.isHeap(ref.a, kind));
      const fin = lastOf(r.steps);
      assert.equal(fin.counters.swaps, ref.swaps);
      assert.equal(fin.counters.comparisons, ref.cmp);
      checkSteps(r.steps, 'extract'); checkLines(r.steps, 'extract', kind);
      // drain
      let items = itemsOf(heap), out = [];
      while (items.length) { const e = H.extract(items, { kind }); out.push(e.value); items = e.items; assert.ok(H.isHeap(items.map(i => i.value), kind)); }
      const sorted = heap.slice().sort((x, y) => kind === 'max' ? y - x : x - y);
      assert.deepEqual(out, sorted);
    });
  });
});

test('extract: single item, two items, duplicates, and the removed root leaves the heap before sifting', () => {
  let r = H.extract(itemsOf([4]));
  assert.equal(r.value, 4); assert.deepEqual(r.items, []);
  assert.equal(lastOf(r.steps).size, 0);
  r = H.extract(itemsOf([1, 2]));
  assert.equal(r.value, 1); assert.deepEqual(r.items.map(i => i.value), [2]);
  r = H.extract(itemsOf([2, 2, 2, 2]));
  assert.equal(lastOf(r.steps).counters.swaps, 0, 'ties do not swap');
  r = H.extract(itemsOf([1, 3, 2, 7, 4, 6]));
  const lift = r.steps.find(s => s.kind === 'lift');
  assert.equal(lift.size, 5, 'the heap shrinks when the last value is lifted');
  assert.equal(lift.items[5].value, 1, 'the extracted value waits outside the heap');
  assert.equal(lift.items[5].state, 'found');
  assert.equal(lift.items[0].value, 6, 'the last value took the root');
  // sift-down goes to the SMALLER child in a min-heap
  const pick = r.steps.find(s => s.kind === 'pick');
  assert.equal(pick.items[1].value, 3);
  assert.equal(pick.items[2].value, 2);
  assert.equal(pick.pointers.find(p => p.name === 'c').index, 2, 'min-heap picks the smaller child (2 < 3)');
});

test('peek reads the root and changes nothing; peek on empty says so', () => {
  const heap = itemsOf([1, 3, 2]);
  const r = H.peek(heap);
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].items[0].state, 'found');
  assert.deepEqual(r.items.map(i => i.value), [1, 3, 2]);
  assert.equal(r.steps[0].counters.comparisons, 0);
  const e = H.peek([]);
  assert.equal(e.steps[0].kind, 'empty');
});

/* ------------------------------------------------------------ build-heap */
test('build: bottom-up result and counters match the reference; swaps below n', () => {
  ['min', 'max'].forEach(kind => {
    randomInputs(23, 80, 15, 40).forEach(vals => {
      const r = H.build(vals, { kind });
      const ref = refBuild(vals, kind);
      assert.deepEqual(r.items.map(i => i.value), ref.a);
      assert.ok(H.isHeap(ref.a, kind));
      const fin = lastOf(r.steps);
      assert.equal(fin.counters.swaps, ref.swaps);
      assert.equal(fin.counters.comparisons, ref.cmp);
      assert.ok(ref.swaps <= vals.length, 'bottom-up build never swaps more than n times');
      assert.ok(ref.cmp <= 2 * vals.length, 'and never compares more than 2n times');
      assert.deepEqual(H.count.buildBottomUp(vals, kind), { comparisons: ref.cmp, swaps: ref.swaps });
      checkSteps(r.steps, 'build'); checkLines(r.steps, 'build', kind);
    });
  });
});

test('build: leaves are marked as finished, byHeight sums to the swap total, and the heap property holds at the end', () => {
  const vals = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];      // descending: the worst input for a min-heap
  const r = H.build(vals);
  const first = r.steps[0];
  assert.equal(first.firstLeaf, 7);
  for (let p = 7; p < 15; p++) assert.equal(first.items[p].state, 'visited', 'leaf ' + p + ' is already a valid one-node heap');
  const fin = lastOf(r.steps);
  const total = Object.values(fin.byHeight).reduce((s, v) => s + v, 0);
  assert.equal(total, fin.counters.swaps);
  const mw = H.maxWork(15);
  Object.keys(fin.byHeight).forEach(h => assert.ok(fin.byHeight[h] <= mw[h], 'height ' + h + ' cannot exceed nodes × height'));
  assert.deepEqual(H.nodesAtHeight(15), { 0: 8, 1: 4, 2: 2, 3: 1 });
  assert.deepEqual(H.maxWork(15), { 0: 0, 1: 4, 2: 4, 3: 3 });
  assert.equal(Object.values(H.maxWork(15)).reduce((s, v) => s + v, 0), 11);
  assert.ok(H.isHeap(fin.items.map(i => i.value), 'min'));
  // byHeight only ever grows step to step
  let prev = 0;
  r.steps.forEach(s => { const t = Object.values(s.byHeight).reduce((a, v) => a + v, 0); assert.ok(t >= prev); prev = t; });
});

test('build: empty, single, two items', () => {
  assert.deepEqual(H.build([]).items, []);
  assert.deepEqual(H.build([4]).items.map(i => i.value), [4]);
  assert.deepEqual(H.build([2, 1]).items.map(i => i.value), [1, 2]);
  assert.deepEqual(H.build([1, 2]).items.map(i => i.value), [1, 2]);
  assert.ok(H.build([]).steps.length >= 1);
});

test('build by repeated insert equals the reference, and the worst input costs about n log n swaps', () => {
  randomInputs(24, 40, 15, 40).forEach(vals => {
    const r = H.buildByInsert(vals);
    assert.deepEqual(r.items.map(i => i.value), refHeapify(vals, 'min'));
    if (vals.length) assert.deepEqual(H.count.buildByInsert(vals), { comparisons: lastOf(r.steps).counters.comparisons, swaps: lastOf(r.steps).counters.swaps });
  });
  const n = 255, worst = [];
  for (let i = 0; i < n; i++) worst.push(n - i);       // strictly decreasing: every insert climbs to the root
  const byInsert = H.count.buildByInsert(worst).swaps, bottomUp = H.count.buildBottomUp(worst).swaps;
  assert.ok(byInsert > 3 * bottomUp, 'repeated insert is much slower than bottom-up on the worst input: ' + byInsert + ' vs ' + bottomUp);
  assert.ok(bottomUp < n);
  assert.ok(byInsert <= n * Math.log2(n));
});

test('bottom-up build stays linear: swaps per element bounded as n grows', () => {
  const rng = core.rng(99);
  [15, 63, 255, 1023].forEach(n => {
    const worst = []; for (let i = 0; i < n; i++) worst.push(n - i);
    assert.ok(H.count.buildBottomUp(worst).swaps < n);
    assert.ok(H.count.buildBottomUp(worst).comparisons <= 2 * n);
    const rand = []; for (let i = 0; i < n; i++) rand.push(rng.int(0, 1e6));
    assert.ok(H.count.buildBottomUp(rand).swaps < n);
  });
});

/* ------------------------------------------------------------ heap sort */
test('sort: sorted output, counters match the reference and the fast counter, on random inputs', () => {
  randomInputs(25, 120, 16, 40).forEach(vals => {
    const steps = H.sort(vals);
    const fin = lastOf(steps);
    assert.deepEqual(valuesOf(fin), vals.slice().sort((x, y) => x - y));
    checkSteps(steps, 'sort');
    checkLines(steps, 'sort', 'max');
    const c = H.count.sort(vals);
    assert.equal(fin.counters.comparisons, c.comparisons);
    assert.equal(fin.counters.swaps, c.swaps);
  });
});

test('sort: edge cases (empty, single, duplicates, sorted, reversed, all equal)', () => {
  assert.deepEqual(valuesOf(lastOf(H.sort([]))), []);
  assert.deepEqual(valuesOf(lastOf(H.sort([3]))), [3]);
  assert.deepEqual(valuesOf(lastOf(H.sort([2, 1]))), [1, 2]);
  assert.deepEqual(valuesOf(lastOf(H.sort([3, 1, 3, 1, 2, 2]))), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual(valuesOf(lastOf(H.sort([1, 2, 3, 4, 5, 6, 7]))), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(valuesOf(lastOf(H.sort([7, 6, 5, 4, 3, 2, 1]))), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(valuesOf(lastOf(H.sort([5, 5, 5, 5]))), [5, 5, 5, 5]);
  assert.equal(lastOf(H.sort([5, 5, 5, 5])).counters.swaps, 3, 'only the n − 1 root-to-end swaps, no sift swaps');
});

test('sort: "done" only marks positions that never change again; the heap stays a max-heap; ids are stable', () => {
  randomInputs(26, 60, 14, 30).forEach(vals => {
    const steps = H.sort(vals);
    const sorted = vals.slice().sort((x, y) => x - y);
    const idsAt0 = steps[0].order.slice().sort();
    steps.forEach((s, k) => {
      assert.deepEqual(s.order.slice().sort(), idsAt0, 'the same items throughout');
      s.items.forEach((it, p) => {
        if (it.state === 'done') {
          assert.equal(it.value, sorted[p], 'step ' + k + ': position ' + p + ' marked done but holds the wrong value');
          assert.ok(p >= s.size, 'done positions lie outside the heap');
          const later = lastOf(steps).items[p];
          assert.equal(later.id, it.id, 'a done item never moves again');
        }
      });
      s.final.forEach(p => assert.equal(s.items[p].value, sorted[p]));
      if (s.phase === 'sort' && s.size > 0) assert.ok(H.isHeap(heapValues(s), 'max') || ['swap', 'compare', 'pick', 'haschild', 'lift', 'sswap', 'sfor', 'settle', 'leaf', 'sortStart'].includes(s.kind));
    });
    // at every 'settle'/'leaf' step the heap prefix is a valid max-heap again after a sift in the sort phase
    steps.forEach(s => { if (s.phase === 'sort' && (s.kind === 'sortStart')) assert.ok(H.isHeap(heapValues(s), 'max')); });
    // at the end of each extraction round (the next 'sfor' or 'done') the heap prefix is valid
    steps.forEach((s, k) => { if (s.phase === 'sort' && (s.kind === 'sfor' || s.kind === 'done')) assert.ok(H.isHeap(heapValues(s), 'max'), 'round boundary ' + k); });
  });
});

test('sort: not stable (equal keys can reorder), and labelled items keep their labels', () => {
  const vals = [{ value: 2, label: 'a' }, { value: 2, label: 'b' }, { value: 1, label: 'c' }];
  const fin = lastOf(H.sort(vals));
  assert.deepEqual(fin.items.map(i => i.value), [1, 2, 2]);
  assert.deepEqual(fin.items.map(i => i.label).sort(), ['a', 'b', 'c']);
  // find some input where equal keys swap order: heap sort is not stable
  let unstable = false;
  const rng = core.rng(3);
  for (let t = 0; t < 200 && !unstable; t++) {
    const n = 8, its = [];
    for (let i = 0; i < n; i++) its.push({ value: rng.int(0, 3), label: 'x' + i });
    const out = lastOf(H.sort(its)).items;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (out[i].value === out[j].value && +out[i].label.slice(1) > +out[j].label.slice(1)) unstable = true;
  }
  assert.ok(unstable, 'heap sort should reorder some equal keys');
});

test('sorting.heap registration shape: heap, heapCount, CODE_HEAP, META_HEAP', () => {
  assert.equal(typeof H.sort, 'function');
  assert.equal(typeof H.count.sort, 'function');
  assert.ok(H.CODE_SORT.pseudo && H.CODE_SORT.js && H.CODE_SORT.py);
  assert.ok(H.META.sort.invariant);
  const c = H.count.sort([3, 1, 2]);
  ['comparisons', 'swaps', 'shifts', 'writes', 'rounds'].forEach(k => assert.equal(typeof c[k], 'number'));
  // the step shape mirrors lesson 14: items/order/pointers/regions/final/ops
  const st = H.sort([3, 1, 2])[0];
  ['items', 'order', 'pointers', 'regions', 'final', 'ops', 'caption', 'line', 'vars', 'counters'].forEach(k => assert.ok(k in st, k));
});

/* ------------------------------------------------------------ tree snapshot */
test('treeState: same ids as the array, children at 2i+1 and 2i+2, extracted items hidden', () => {
  const r = H.build([5, 4, 3, 2, 1, 0, 9]);
  r.steps.forEach(s => {
    const t = H.treeState(s);
    assert.equal(t.nodes.length, s.size);
    t.nodes.forEach((nd, p) => {
      assert.equal(nd.id, s.items[p].id);
      if (2 * p + 1 < s.size) assert.equal(nd.left, s.items[2 * p + 1].id); else assert.equal(nd.left, undefined);
      if (2 * p + 2 < s.size) assert.equal(nd.right, s.items[2 * p + 2].id); else assert.equal(nd.right, undefined);
    });
    t.edges.forEach(e => assert.ok(t.nodes.some(n => n.id === e.from) && t.nodes.some(n => n.id === e.to)));
    (t.pointers || []).forEach(p => assert.ok(t.nodes.some(n => n.id === p.target)));
  });
  const ex = H.extract(itemsOf([1, 3, 2, 7, 4, 6]));
  const lift = ex.steps.find(s => s.kind === 'lift');
  assert.equal(H.treeState(lift).nodes.length, 5);
  assert.equal(H.treeState(H.build([]).steps[0]).root, null);
});

/* ------------------------------------------------------------ decrease-key */
test('decreaseKey: the lowered key climbs; keeps the heap property; validates input', () => {
  const heap = [1, 5, 2, 9, 8, 4, 3];
  const r = H.decreaseKey(itemsOf(heap), 4, 0);
  assert.ok(H.isHeap(r.items.map(i => i.value), 'min'));
  assert.equal(r.items[0].value, 0);
  assert.equal(r.items[0].id, 'h4', 'the node keeps its identity as it climbs');
  assert.throws(() => H.decreaseKey(itemsOf(heap), 4, 100));
  assert.throws(() => H.decreaseKey(itemsOf(heap), 40, 0));
  const same = H.decreaseKey(itemsOf(heap), 3, 9);
  assert.equal(lastOf(same.steps).counters.swaps, 0);
});

/* ------------------------------------------------------------ chain (teaser) */
test('chain: a run of inserts and extracts stays a valid heap', () => {
  const r = H.chain([], [{ op: 'insert', value: 5 }, { op: 'insert', value: 2 }, { op: 'insert', value: 8 }, { op: 'extract' }, { op: 'insert', value: 1 }, { op: 'peek' }]);
  assert.equal(r.items.length, 3);
  assert.ok(H.isHeap(r.items.map(i => i.value), 'min'));
  assert.equal(r.items[0].value, 1);
  checkSteps(r.steps, 'chain');
});

/* ------------------------------------------------------------ top-k */
test('topK: the heap ends with the k largest; each step is a valid min-heap; discards cost one comparison', () => {
  const rng = core.rng(27);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(0, 16), k = rng.int(1, 6), stream = [];
    for (let i = 0; i < n; i++) stream.push(rng.int(0, 30));
    const steps = H.topK(stream, k);
    const fin = lastOf(steps);
    const want = stream.slice().sort((x, y) => y - x).slice(0, k).sort((x, y) => x - y);
    const got = heapValues(fin).slice().sort((x, y) => x - y);
    assert.deepEqual(got, want);
    steps.forEach(s => {
      assert.ok(s.size <= k);
      if (['settle', 'leaf', 'discard', 'done', 'start'].includes(s.kind)) assert.ok(H.isHeap(heapValues(s), 'min'), s.kind);
    });
    checkSteps(steps, 'topK');
    // stream states: exactly the heap items are in-heap (frontier/done) at the end
    const inHeap = fin.stream.items.filter(x => x.state === 'done').map(x => x.id).sort();
    assert.deepEqual(inHeap, heapValues ? fin.items.slice(0, fin.size).map(x => x.id).sort() : []);
    // ids of heap nodes are stream ids
    fin.items.forEach(it => assert.ok(/^s\d+$/.test(it.id)));
  }
  assert.throws(() => H.topK([1, 2], 0));
  const one = lastOf(H.topK([5], 3));
  assert.deepEqual(heapValues(one), [5]);
  const dupes = lastOf(H.topK([4, 4, 4, 4, 4], 2));
  assert.deepEqual(heapValues(dupes), [4, 4]);
});

/* ------------------------------------------------------------ merge k lists */
test('mergeK: output is the merged sorted list; the heap never holds more than k heads; heap property throughout', () => {
  const rng = core.rng(28);
  for (let t = 0; t < 60; t++) {
    const k = rng.int(1, 4), lists = [];
    for (let i = 0; i < k; i++) { const len = rng.int(0, 5), l = []; for (let j = 0; j < len; j++) l.push(rng.int(0, 20)); lists.push(l.sort((x, y) => x - y)); }
    const steps = H.mergeK(lists);
    const fin = lastOf(steps);
    const merged = [].concat(...lists).sort((x, y) => x - y);
    const outRow = fin.rows[fin.rows.length - 1];
    assert.deepEqual(outRow.items.map(i => i.value), merged);
    steps.forEach(s => {
      assert.ok(s.size <= k);
      if (['settle', 'leaf', 'done', 'start'].includes(s.kind)) assert.ok(H.isHeap(heapValues(s), 'min'), s.kind);
      // the heap holds each list's current head at most once
      const lists2 = s.items.slice(0, s.size).map(it => it.id.replace(/\d+$/, '').slice(1));
      assert.equal(new Set(lists2).size, lists2.length);
    });
    checkSteps(steps, 'mergeK');
  }
  assert.deepEqual(lastOf(H.mergeK([])).rows.pop().items, []);
  assert.deepEqual(lastOf(H.mergeK([[], []])).rows.pop().items, []);
  const one = lastOf(H.mergeK([[1, 2, 3]])).rows.pop().items.map(i => i.value);
  assert.deepEqual(one, [1, 2, 3]);
});

/* ------------------------------------------------------------ priority-queue implementations */
test('pqRun: every implementation extracts in priority order; costs are monotone', () => {
  const rng = core.rng(29);
  ['unsorted', 'sorted', 'heap'].forEach(kind => {
    for (let t = 0; t < 30; t++) {
      const init = []; const n0 = rng.int(0, 6); for (let i = 0; i < n0; i++) init.push(rng.int(1, 20));
      const ops = []; let size = n0;
      for (let i = 0; i < 8; i++) {
        if (size > 0 && rng.int(0, 2) === 0) { ops.push({ op: 'extract' }); size--; } else { ops.push({ op: 'insert', value: rng.int(1, 20) }); size++; }
      }
      const steps = H.pqRun(kind, init, ops);
      checkSteps(steps.map(s => Object.assign({}, s, { flow: null })), 'pq-' + kind);
      // replay with a reference multiset
      const ref = init.slice(), got = [];
      let ci = 0;
      ops.forEach((op, oi) => {
        const sts = steps.filter(s => s.opIndex === oi);
        const fin = sts[sts.length - 1];
        if (op.op === 'insert') ref.push(op.value); else { ref.sort((x, y) => x - y); got.push(ref.shift()); }
        assert.deepEqual(fin.items.map(i => i.value).sort((x, y) => x - y), ref.slice().sort((x, y) => x - y), kind + ' op ' + oi);
        if (kind === 'sorted') assert.deepEqual(fin.items.map(i => i.value), fin.items.map(i => i.value).slice().sort((x, y) => y - x));
        if (kind === 'heap') assert.ok(H.isHeap(fin.items.map(i => i.value), 'min'));
        ci++;
      });
      void ci; void got;
      let prev = 0; steps.forEach(s => { assert.ok(s.counters.cost >= prev); prev = s.counters.cost; });
    }
  });
});

test('pqRun costs: unsorted extract scans everything, sorted extract is O(1), heap is logarithmic; totals match pqWorkloadCost', () => {
  const vals = [7, 3, 9, 1, 5, 8, 2, 6];
  const ops = vals.map(v => ({ op: 'insert', value: v })).concat(vals.map(() => ({ op: 'extract' })));
  ['unsorted', 'sorted', 'heap'].forEach(kind => {
    const steps = H.pqRun(kind, [], ops);
    assert.equal(lastOf(steps).counters.cost, H.pqWorkloadCost(kind, vals), kind + ' total cost');
  });
  const un = H.pqFrames([4, 8, 1, 9, 3, 7], [{ op: 'extract' }]);
  assert.equal(un[1].cost.unsorted, 6, 'scanning n = 6 values plus one removal write: 5 comparisons + 1');
  assert.equal(un[1].cost.sorted, 1);
  assert.ok(un[1].cost.heap <= 1 + 2 * 2 * H.height(6) + 1 + 5);
  // sorted insert of a new minimum costs almost nothing; of a new maximum shifts the whole array
  const mn = H.pqFrames([9, 8, 7, 6, 5, 4], [{ op: 'insert', value: 1 }]);
  const mx = H.pqFrames([9, 8, 7, 6, 5, 4], [{ op: 'insert', value: 99 }]);
  assert.ok(mx[1].cost.sorted > 3 * mn[1].cost.sorted);
  assert.equal(mn[1].cost.unsorted, 1); assert.equal(mx[1].cost.unsorted, 1);
});

test('pqWorkloadCost: heap grows like n log n, the arrays like n²', () => {
  const rng = core.rng(30);
  function costs(n) { const v = []; for (let i = 0; i < n; i++) v.push(rng.int(0, 1e6)); return ['unsorted', 'sorted', 'heap'].map(k => H.pqWorkloadCost(k, v)); }
  const small = costs(64), big = costs(512);
  assert.ok(big[0] / small[0] > 40, 'unsorted ~ quadratic: 8x n should be ~64x cost');
  assert.ok(big[1] / small[1] > 30);
  assert.ok(big[2] / small[2] < 14, 'heap ~ n log n: 8x n should be ~10x cost');
  assert.ok(big[2] < big[0] / 10 && big[2] < big[1] / 5);
});

test('pqFrames: one frame per op plus the start; running totals', () => {
  const ops = [{ op: 'insert', value: 4 }, { op: 'extract' }, { op: 'insert', value: 2 }];
  const fr = H.pqFrames([5, 3], ops);
  assert.equal(fr.length, 4);
  ['unsorted', 'sorted', 'heap'].forEach(k => {
    let sum = 0; for (let i = 1; i < fr.length; i++) sum += fr[i].cost[k];
    assert.equal(fr[fr.length - 1].total[k], sum);
  });
  assert.equal(fr[0].rows.heap.length, 2);
  assert.deepEqual(fr[1].rows.unsorted.map(x => x.value), [5, 3, 4]);
});

/* ------------------------------------------------------------ code labels for every op and order */
test('CODE: labels resolve in pseudocode, JavaScript and Python for every operation and order', () => {
  ['insert', 'extract', 'build', 'sort'].forEach(op => ['min', 'max'].forEach(kind => {
    const src = H.CODE(op, kind);
    ['pseudo', 'js', 'py'].forEach(l => assert.ok(src[l].length > 40));
    const lang = { pseudo: 'pseudo', js: 'js', py: 'py' };
    const labels = {};
    Object.keys(lang).forEach(l => { labels[l] = Object.keys(code.parse(src[l], lang[l]).labels); });
    assert.deepEqual(labels.js.sort(), labels.py.sort(), op + '/' + kind + ': js and py label sets differ');
    assert.deepEqual(labels.js.sort(), labels.pseudo.sort(), op + '/' + kind + ': pseudo and js label sets differ');
  }));
  assert.ok(H.CODE('insert', 'max').js.includes('heap[i] > heap[p]'));
  assert.ok(H.CODE('insert', 'min').js.includes('heap[i] < heap[p]'));
});
