/* Sorting arena adapter (js/labs/sorting-arena-model.js) over the lesson generators.
   Run: node --test tests/labs/sorting-arena.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = {};                                  // the generators merge into window.VDSA.algos.sorting
const ROOT = path.join(__dirname, '..', '..');
['14-elementary-sorts', '15-merge-sort', '16-quick-sort', '17-linear-time-sorts', '21-heaps'].forEach((f) => require(path.join(ROOT, 'js', 'algos', f + '.js')));
const A = require(path.join(ROOT, 'js', 'labs', 'sorting-arena-model.js'));
const S = window.VDSA.algos.sorting;

const IDS = A.ALGOS.map((a) => a.id);
const inputs = [];
A.PRESETS.forEach((p) => [8, 9, 25, 60].forEach((n) => inputs.push({ name: p.id + ' ' + n, v: A.makeInput(p.id, n, 3) })));
inputs.push({ name: 'custom dups', v: [5, 5, 5, 0, 99, 0, 99, 42, 42, 1] });
const sortedCopy = (v) => v.slice().sort((a, b) => a - b);

test('presets: sizes, range and shape', () => {
  A.PRESETS.forEach((p) => {
    [8, 33, 120].forEach((n) => {
      const v = A.makeInput(p.id, n, 5);
      assert.equal(v.length, n, p.id);
      assert.ok(v.every((x) => Number.isInteger(x) && x >= 0 && x <= A.MAXV), p.id);
    });
  });
  assert.deepEqual(A.makeInput('sorted', 20), sortedCopy(A.makeInput('sorted', 20)));
  assert.deepEqual(A.makeInput('reversed', 20), sortedCopy(A.makeInput('reversed', 20)).reverse());
  assert.ok(new Set(A.makeInput('few', 60)).size <= 4);
  assert.equal(A.makeInput('random', 500).length, A.MAX_N, 'n is capped');
});

test('parseInput validates', () => {
  assert.deepEqual(A.parseInput('5, 3 8;1').values, [5, 3, 8, 1]);
  assert.ok(A.parseInput('5').error);
  assert.ok(A.parseInput('5, x').error);
  assert.ok(A.parseInput('5, 2.5').error);
  assert.ok(A.parseInput('5, 100').error);
  assert.ok(A.parseInput(new Array(121).fill(1).join(',')).error);
});

test('every lane ends sorted with the generator\'s own counters', () => {
  IDS.forEach((id) => inputs.forEach((inp) => {
    const lane = A.buildLane(id, inp.v, {});
    const last = lane.vals.slice((lane.F - 1) * lane.n);
    assert.deepEqual(Array.from(last), sortedCopy(inp.v), id + ' ' + inp.name);
    assert.ok(lane.sorted, id);
    const steps = A.steps(id, inp.v, {});
    const t = steps[steps.length - 1];
    if (id === 'counting') assert.equal(lane.wr, t.counters.tallies + t.counters.additions + t.counters.placements);
    else if (id === 'radix') { assert.equal(lane.wr, t.counters.drops + t.counters.collected); assert.equal(lane.cmp, 0); }
    else if (id === 'bucket') { assert.equal(lane.wr, t.counters.scattered + t.counters.collected); assert.equal(lane.cmp, t.counters.comparisons); }
    else { assert.equal(lane.cmp, t.ops.comparisons, id + ' cmp'); assert.equal(lane.wr, id === 'heap' ? 2 * t.ops.swaps : t.ops.writes, id + ' wr'); }
  }));
});

test('fast counters agree with the frames (growth chart uses them)', () => {
  IDS.forEach((id) => inputs.forEach((inp) => {
    const lane = A.buildLane(id, inp.v, {});
    const c = A.count(id, inp.v, {});
    assert.equal(c.comparisons, lane.cmp, id + ' cmp ' + inp.name);
    assert.equal(c.writes, lane.wr, id + ' wr ' + inp.name);
  }));
});

test('quick sort pivot option reaches both the frames and the counters', () => {
  const v = A.makeInput('sorted', 40);
  ['last', 'median3', 'random'].forEach((pivot) => {
    const lane = A.buildLane('quick', v, { pivot });
    assert.equal(A.count('quick', v, { pivot }).comparisons, lane.cmp, pivot);
  });
  assert.ok(A.count('quick', v, { pivot: 'last' }).comparisons > 3 * A.count('quick', v, { pivot: 'median3' }).comparisons);
});

test('frames: monotone clock, unique work values, values are a permutation of the input', () => {
  IDS.forEach((id) => {
    const v = A.makeInput('random', 30, 11), lane = A.buildLane(id, v, {});
    assert.equal(lane.w[0], 0, id);
    for (let i = 1; i < lane.F; i++) {
      assert.ok(lane.w[i] > lane.w[i - 1], id + ' strictly increasing work');
      assert.ok(lane.c[i] >= lane.c[i - 1] && lane.r[i] >= lane.r[i - 1], id + ' counters only grow');
    }
    assert.equal(lane.total, lane.cmp + lane.wr);
    if (id === 'counting') return;                   // the output row overlays the input row while it fills
    const want = sortedCopy(v).join();
    for (let i = 0; i < lane.F; i++) {
      const f = Array.from(lane.vals.slice(i * lane.n, (i + 1) * lane.n)).sort((a, b) => a - b).join();
      assert.equal(f, want, id + ' frame ' + i + ' keeps every value');
    }
  });
});

test('laneIndexAt: last frame whose work is at most t', () => {
  const lane = A.buildLane('bubble', A.makeInput('random', 12, 2), {});
  assert.equal(A.laneIndexAt(lane, 0), 0);
  assert.equal(A.laneIndexAt(lane, 1e9), lane.F - 1);
  for (let t = 0; t <= lane.total; t += 7) {
    const i = A.laneIndexAt(lane, t);
    assert.ok(lane.w[i] <= t && (i === lane.F - 1 || lane.w[i + 1] > t));
  }
});

test('podium ranks by work and shares a rank on ties', () => {
  const p = A.podium([{ id: 'a', total: 30, cmp: 1, wr: 1 }, { id: 'b', total: 10, cmp: 1, wr: 1 }, { id: 'c', total: 10, cmp: 1, wr: 1 }, { id: 'd', total: 50, cmp: 1, wr: 1 }]);
  assert.deepEqual(p.map((x) => x.rank), [1, 1, 3, 4]);
});

test('growth: counts only, sorted input separates the families', () => {
  const g = A.growth(['bubble', 'insertion', 'merge', 'quick', 'counting'], 'sorted', {});
  assert.equal(g.ns.length, A.GROWTH_NS.length);
  const at = (id) => g.series[id].cmp[g.ns.indexOf(256)];
  assert.equal(at('bubble'), 255);                                  // early exit
  assert.equal(at('insertion'), 255);
  assert.ok(at('quick') > 256 * 255 / 2 - 1);                       // last-element pivot on sorted input
  assert.equal(at('counting'), 0);
  const r = A.growth(['bubble', 'merge'], 'random', {});
  assert.ok(r.series.bubble.cmp[r.ns.length - 1] > 10 * r.series.merge.cmp[r.ns.length - 1]);
});
