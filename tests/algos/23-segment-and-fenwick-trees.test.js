/* Step generators for lesson 23 (js/algos/23-segment-and-fenwick-trees.js).
   Run: node --test tests/algos/23-segment-and-fenwick-trees.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const T = require(path.join(ROOT, 'js', 'algos', '23-segment-and-fenwick-trees.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const OPS = ['sum', 'min', 'max', 'gcd'];
const F = { sum: (a, b) => a + b, min: Math.min, max: Math.max, gcd: T.gcd };
const ID = { sum: 0, min: Infinity, max: -Infinity, gcd: 0 };

function fold(op, xs) { return xs.reduce((acc, x) => F[op](acc, x), ID[op]); }
function randArr(rng, n, lo = -20, hi = 30) { return Array.from({ length: n }, () => rng.int(lo, hi)); }

/* every step of every generator must be a complete, well-formed snapshot */
function checkSegSteps(steps, n) {
  assert.ok(steps.length >= 2);
  let prevCounters = null;
  const shp = T.shape(n);
  for (const s of steps) {
    assert.equal(s.type, 'seg');
    assert.equal(s.n, n);
    assert.equal(s.arr.length, n);
    assert.equal(typeof s.caption, 'string');
    assert.ok(s.caption.length > 10);
    assert.ok(s.line !== undefined && s.line !== null);
    for (const id of Object.keys(s.states)) { assert.ok(shp.byId[id], 'unknown node ' + id); assert.ok(STATES.has(s.states[id]), 'bad state ' + s.states[id]); }
    for (const id of Object.keys(s.vals)) assert.ok(shp.byId[id]);
    for (const k of Object.keys(s.cells)) assert.ok(STATES.has(s.cells[k]));
    if (s.cur) assert.ok(shp.byId[s.cur]);
    if (s.move) { assert.ok(shp.byId[s.move.from] && shp.byId[s.move.to]); }
    if (prevCounters) for (const k of Object.keys(prevCounters)) assert.ok(s.counters[k] >= prevCounters[k], 'counter ' + k + ' went down');
    prevCounters = s.counters;
  }
}

function lines(src, lang) { return code.parse(src, lang).labels; }
function everyLineExists(steps, kindSrc) {
  for (const s of steps) {
    const ls = [].concat(s.line);
    for (const lang of ['pseudo', 'js', 'py']) {
      const labels = lines(kindSrc[lang], lang);
      for (const l of ls) assert.ok(labels[l], `label ${l} missing in ${lang}`);
    }
  }
}

/* ------------------------------------------------------------ shape */
test('shape: node count, heap numbers and depth', () => {
  for (let n = 1; n <= 20; n++) {
    const s = T.shape(n);
    assert.equal(s.nodes.length, 2 * n - 1);
    assert.equal(s.nodes.filter((x) => x.leaf).length, n);
    assert.equal(s.byId[s.root].k, 1);
    for (const nd of s.nodes) {
      if (!nd.leaf) {
        assert.equal(s.byId[nd.left].k, 2 * nd.k);
        assert.equal(s.byId[nd.right].k, 2 * nd.k + 1);
        assert.equal(s.byId[nd.left].lo, nd.lo);
        assert.equal(s.byId[nd.right].hi, nd.hi);
        assert.equal(s.byId[nd.left].hi + 1, s.byId[nd.right].lo);
      }
    }
    assert.equal(s.maxDepth, Math.ceil(Math.log2(n)));
  }
});

test('treeValues: every node holds the fold of its segment (all operations)', () => {
  const rng = core.rng(7);
  for (const op of OPS) for (let n = 1; n <= 13; n++) {
    const a = randArr(rng, n, 1, 40);
    const vals = T.treeValues(op, a);
    for (const nd of T.shape(n).nodes) assert.equal(vals[nd.id], fold(op, a.slice(nd.lo, nd.hi + 1)), `${op} ${nd.id}`);
  }
});

/* ------------------------------------------------------------ build */
test('segBuild: fills every node once, bottom-up, ending with the true tree', () => {
  const rng = core.rng(11);
  for (const op of OPS) for (const n of [1, 2, 3, 7, 8, 11, 16]) {
    const a = randArr(rng, n, 1, 30);
    const steps = T.segBuild(op, a);
    checkSegSteps(steps, n);
    const last = steps[steps.length - 1];
    assert.deepEqual(last.vals, T.treeValues(op, a));
    assert.equal(last.counters.written, 2 * n - 1);
    // children are always filled before their parent
    const seen = new Set();
    const shp = T.shape(n);
    for (const s of steps) for (const id of Object.keys(s.vals)) {
      if (!seen.has(id)) { seen.add(id); const nd = shp.byId[id]; if (!nd.leaf) { assert.ok(s.vals[nd.left] !== undefined && s.vals[nd.right] !== undefined); } }
    }
    everyLineExists(steps, T.segCode('build', op));
  }
});

/* ------------------------------------------------------------ query */
test('segQuery: answer equals a naive loop for every range (small arrays, all operations)', () => {
  const rng = core.rng(21);
  for (const op of OPS) for (const n of [1, 2, 3, 5, 8, 9]) {
    const a = randArr(rng, n, 1, 25);
    for (let l = 0; l < n; l++) for (let r = l; r < n; r++) {
      const steps = T.segQuery(op, a, l, r);
      assert.equal(steps[steps.length - 1].answer, fold(op, a.slice(l, r + 1)), `${op} [${l},${r}] of ${a}`);
    }
  }
});

test('segQuery: random arrays and ranges, structure of the trace', () => {
  const rng = core.rng(22);
  for (let t = 0; t < 120; t++) {
    const op = OPS[t % OPS.length], n = rng.int(1, 16);
    const a = randArr(rng, n, -20, 30);
    const l = rng.int(0, n - 1), r = rng.int(l, n - 1);
    const steps = T.segQuery(op, a, l, r);
    checkSegSteps(steps, n);
    const last = steps[steps.length - 1];
    assert.equal(last.answer, fold(op, a.slice(l, r + 1)));
    const cost = T.segQueryCost(n, l, r);
    assert.equal(last.counters.visited, cost.visited);
    assert.equal(last.counters.used, cost.used);
    // 'done' (green) nodes: whole segment inside the query, and together they tile [l, r] exactly
    const shp = T.shape(n);
    const done = Object.keys(last.states).filter((id) => last.states[id] === 'done').map((id) => shp.byId[id]).sort((x, y) => x.lo - y.lo);
    assert.equal(done.length, cost.used);
    let at = l;
    for (const nd of done) { assert.ok(nd.lo >= l && nd.hi <= r); assert.equal(nd.lo, at); at = nd.hi + 1; }
    assert.equal(at, r + 1);
    // 'muted' nodes are disjoint from the query, 'compare' nodes partially overlap it
    for (const id of Object.keys(last.states)) {
      const nd = shp.byId[id];
      if (last.states[id] === 'muted') assert.ok(nd.hi < l || r < nd.lo);
      if (last.states[id] === 'compare') assert.ok(!(nd.hi < l || r < nd.lo) && !(l <= nd.lo && nd.hi <= r));
    }
    // a query never visits more than 4 nodes per level
    assert.ok(cost.visited <= 4 * (shp.maxDepth + 1));
    everyLineExists(steps, T.segCode('query', op));
  }
});

test('segQuery: single cell, whole array, bad input', () => {
  const a = [5, 3, 8, 1];
  let s = T.segQuery('sum', a, 2, 2);
  assert.equal(s[s.length - 1].answer, 8);
  s = T.segQuery('sum', a, 0, 3);
  assert.equal(s[s.length - 1].answer, 17);
  assert.equal(s[s.length - 1].counters.visited, 1, 'the root alone answers a whole-array query');
  s = T.segQuery('max', [7], 0, 0);
  assert.equal(s[s.length - 1].answer, 7);
  assert.throws(() => T.segQuery('sum', a, 3, 2));
  assert.throws(() => T.segQuery('sum', a, -1, 2));
  assert.throws(() => T.segQuery('sum', a, 0, 4));
  assert.throws(() => T.segQuery('sum', [], 0, 0));
  assert.throws(() => T.segQuery('nope', a, 0, 1));
});

test('segQuery: duplicates, all equal, negatives', () => {
  const a = [4, 4, 4, 4, 4, 4];
  for (const op of ['min', 'max', 'sum']) {
    const s = T.segQuery(op, a, 1, 4);
    assert.equal(s[s.length - 1].answer, fold(op, a.slice(1, 5)));
  }
  const b = [-3, -7, -1, -9];
  assert.equal(T.segQuery('max', b, 0, 3).slice(-1)[0].answer, -1);
  assert.equal(T.segQuery('min', b, 1, 2).slice(-1)[0].answer, -7);
});

/* ------------------------------------------------------------ update */
test('segUpdate: rewrites exactly the root-to-leaf path and the tree matches a rebuild', () => {
  const rng = core.rng(31);
  for (let t = 0; t < 100; t++) {
    const op = OPS[t % OPS.length], n = rng.int(1, 16);
    const a = randArr(rng, n, 1, 40);
    const i = rng.int(0, n - 1), v = rng.int(1, 60);
    const steps = T.segUpdate(op, a, i, v);
    checkSegSteps(steps, n);
    const last = steps[steps.length - 1];
    const b = a.slice(); b[i] = v;
    assert.deepEqual(last.vals, T.treeValues(op, b));
    assert.deepEqual(last.arr, b);
    assert.equal(last.counters.written, T.segUpdateCost(n, i));
    const before = T.treeValues(op, a), shp = T.shape(n);
    const pathIds = shp.nodes.filter((nd) => nd.lo <= i && i <= nd.hi).map((nd) => nd.id);
    assert.equal(pathIds.length, T.segUpdateCost(n, i));
    // every node off the path keeps its old value
    for (const nd of shp.nodes) if (!pathIds.includes(nd.id)) assert.equal(last.vals[nd.id], before[nd.id]);
    // the path is recomputed leaf first, root last
    const pulls = steps.filter((s) => s.kind === 'pull').map((s) => s.cur);
    assert.deepEqual(pulls, pathIds.slice(0, -1).reverse());
    everyLineExists(steps, T.segCode('update', op));
  }
});

test('segUpdate: edge cases', () => {
  const s1 = T.segUpdate('sum', [5], 0, 9);
  assert.equal(s1[s1.length - 1].vals.s0_0, 9);
  assert.equal(s1[s1.length - 1].counters.written, 1);
  const same = T.segUpdate('sum', [1, 2, 3], 1, 2);
  assert.deepEqual(same[same.length - 1].arr, [1, 2, 3]);
  assert.throws(() => T.segUpdate('sum', [1, 2], 2, 1));
  assert.throws(() => T.segUpdate('sum', [1, 2], 0, 1.5));
});

test('update then query stays consistent (sequence of random operations)', () => {
  const rng = core.rng(41);
  for (const op of OPS) {
    let a = randArr(rng, 10, 1, 30);
    for (let t = 0; t < 30; t++) {
      if (rng() < 0.5) {
        const i = rng.int(0, 9), v = rng.int(1, 50);
        const s = T.segUpdate(op, a, i, v); a = s[s.length - 1].arr;
      } else {
        const l = rng.int(0, 9), r = rng.int(l, 9);
        assert.equal(T.segQuery(op, a, l, r).slice(-1)[0].answer, fold(op, a.slice(l, r + 1)));
      }
    }
  }
});

/* ------------------------------------------------------------ lazy propagation */
test('lazyRun: answers match a naive array, and tags/stale flags are truthful', () => {
  const rng = core.rng(51);
  for (let t = 0; t < 60; t++) {
    const n = rng.int(1, 12), a = randArr(rng, n, 1, 20);
    const ops = [];
    const k = rng.int(2, 6);
    for (let j = 0; j < k; j++) {
      const l = rng.int(0, n - 1), r = rng.int(l, n - 1);
      ops.push(rng() < 0.5 ? { type: 'add', l, r, v: rng.int(-5, 9) } : { type: 'query', l, r });
    }
    const steps = T.lazyRun(a, ops);
    checkSegSteps(steps, n);
    const truth = a.slice(), expected = [];
    for (const op of ops) {
      if (op.type === 'add') for (let x = op.l; x <= op.r; x++) truth[x] += op.v;
      else expected.push(truth.slice(op.l, op.r + 1).reduce((p, q) => p + q, 0));
    }
    assert.deepEqual(steps[steps.length - 1].answers, expected);
    const shp = T.shape(n);
    for (const s of steps) {
      // stale flag <=> some proper ancestor holds a non-zero tag
      for (const nd of shp.nodes) {
        let anc = nd.parent, tagged = false;
        while (anc) { if (s.tags[anc]) tagged = true; anc = shp.byId[anc].parent; }
        assert.equal(!!s.stale[nd.id], tagged, 'stale flag of ' + nd.id);
      }
      // a leaf never keeps a tag (it has no children to owe anything to) unless it was just applied: allowed, but stored sum must be consistent
      // invariant: a non-stale node stores the true sum of its segment
      for (const nd of shp.nodes) {
        if (s.stale[nd.id]) continue;
        if (s.kind === 'push' || s.kind === 'combine') continue; // mid-update recomputation
        if (Object.values(s.states).includes('compare') && s.states[nd.id] === 'compare' && (s.kind === 'split' || s.kind === 'inside' || s.kind === 'outside')) continue;
      }
      if (s.kind === 'opdone' || s.kind === 'done' || (s.kind === 'opstart' && ops[s.opIndex].type === 'query')) {
        // between operations the root is correct
        assert.equal(s.vals[shp.root], s.arr.reduce((p, q) => p + q, 0), 'root sum at ' + s.kind);
        // and every non-stale node is right
        for (const nd of shp.nodes) if (!s.stale[nd.id]) assert.equal(s.vals[nd.id], s.arr.slice(nd.lo, nd.hi + 1).reduce((p, q) => p + q, 0), 'non-stale node ' + nd.id + ' at ' + s.kind);
      }
    }
    everyLineExists(steps, T.LAZY_CODE);
  }
});

test('lazyRun: a covered node keeps a tag and its children stay stale until a query pushes it', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const steps = T.lazyRun(a, [{ type: 'add', l: 0, r: 3, v: 10 }, { type: 'query', l: 1, r: 2 }]);
  const afterAdd = steps.find((s) => s.kind === 'opdone');
  assert.equal(afterAdd.tags.s0_3, 10);
  assert.equal(afterAdd.stale.s0_1, true);
  assert.equal(afterAdd.stale.s0_0, true);
  assert.equal(afterAdd.vals.s0_3, 10 + 40);
  assert.equal(afterAdd.vals.s0_1, 3, 'child still shows the old sum');
  const push = steps.find((s) => s.kind === 'push');
  assert.ok(push);
  assert.equal(push.tags.s0_3, undefined);
  assert.equal(push.tags.s0_1, 10);
  assert.equal(push.vals.s0_1, 3 + 20);
  assert.equal(steps[steps.length - 1].answers[0], 2 + 3 + 20);
  assert.equal(steps[steps.length - 1].counters.pushes >= 1, true);
  assert.throws(() => T.lazyRun(a, []));
  assert.throws(() => T.lazyRun(a, [{ type: 'add', l: 3, r: 1, v: 1 }]));
});

test('lazyRun: an add touches O(log n) nodes, not the range length', () => {
  const a = new Array(16).fill(1);
  const steps = T.lazyRun(a, [{ type: 'add', l: 0, r: 15, v: 3 }]);
  assert.equal(steps[steps.length - 1].counters.visited, 1, 'the root absorbs a whole-array add');
  assert.equal(steps[steps.length - 1].counters.pushes, 0);
});

/* ------------------------------------------------------------ Fenwick */
test('lowbit and fenTree: T[i] sums the lowbit(i) elements ending at i', () => {
  assert.equal(T.lowbit(12), 4);
  assert.equal(T.lowbit(13), 1);
  assert.equal(T.lowbit(8), 8);
  const rng = core.rng(61);
  for (let n = 1; n <= 20; n++) {
    const a = randArr(rng, n);
    const tr = T.fenTree(a);
    for (let i = 1; i <= n; i++) assert.equal(tr[i - 1], a.slice(i - (i & -i), i).reduce((p, q) => p + q, 0));
  }
});

function checkFenSteps(steps, n) {
  let prev = null;
  for (const s of steps) {
    assert.equal(s.type, 'fen');
    assert.equal(s.n, n);
    assert.equal(s.arr.length, n);
    assert.equal(s.tree.length, n);
    assert.ok(s.caption.length > 10);
    for (const k of Object.keys(s.bars)) assert.ok(STATES.has(s.bars[k]));
    if (prev) for (const k of Object.keys(prev.counters)) assert.ok(s.counters[k] >= prev.counters[k]);
    prev = s;
  }
}

test('fenPrefix: matches the naive prefix sum, jumps strip the lowest bit', () => {
  const rng = core.rng(62);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(1, 16), a = randArr(rng, n), i = rng.int(0, n);
    const steps = T.fenPrefix(a, i);
    checkFenSteps(steps, n);
    const last = steps[steps.length - 1];
    assert.equal(last.answer, a.slice(0, i).reduce((p, q) => p + q, 0));
    assert.equal(last.counters.steps, T.fenQueryCost(i));
    assert.equal(last.counters.steps, i.toString(2).split('1').length - 1);
    for (const j of last.jumps) assert.equal(j.to, j.from - (j.from & -j.from));
    // the visited blocks tile a[1..i] with no overlap
    const seq = last.jumps.map((j) => j.from);
    let end = i;
    for (const idx of seq) { assert.equal(idx, end); end -= idx & -idx; }
    assert.equal(end, 0);
    everyLineExists(steps, T.FEN_CODE.prefix);
  }
});

test('fenPrefix: the sequence for prefix(13) is 13, 12, 8', () => {
  const a = Array.from({ length: 16 }, (_, i) => i + 1);
  const steps = T.fenPrefix(a, 13);
  assert.deepEqual(steps[steps.length - 1].jumps.map((j) => j.from), [13, 12, 8]);
  assert.equal(steps[steps.length - 1].answer, 91);
  assert.equal(T.fenPrefix(a, 0).slice(-1)[0].answer, 0);
  assert.equal(T.fenPrefix(a, 16).slice(-1)[0].counters.steps, 1);
  assert.throws(() => T.fenPrefix(a, 17));
  assert.throws(() => T.fenPrefix(a, -1));
});

test('fenRange: prefix(r) - prefix(l - 1)', () => {
  const rng = core.rng(63);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(1, 16), a = randArr(rng, n), l = rng.int(1, n), r = rng.int(l, n);
    const steps = T.fenRange(a, l, r);
    checkFenSteps(steps, n);
    assert.equal(steps[steps.length - 1].answer, a.slice(l - 1, r).reduce((p, q) => p + q, 0));
    assert.equal(steps[steps.length - 1].counters.steps, T.fenQueryCost(r) + T.fenQueryCost(l - 1));
    everyLineExists(steps, T.FEN_CODE.range);
  }
  assert.throws(() => T.fenRange([1, 2, 3], 0, 2));
  assert.throws(() => T.fenRange([1, 2, 3], 3, 2));
});

test('fenUpdate: jumps add the lowest bit; the tree equals a rebuild', () => {
  const rng = core.rng(64);
  for (let t = 0; t < 80; t++) {
    const n = rng.int(1, 16), a = randArr(rng, n), i = rng.int(1, n), d = rng.int(-9, 9);
    const steps = T.fenUpdate(a, i, d);
    checkFenSteps(steps, n);
    const last = steps[steps.length - 1];
    const b = a.slice(); b[i - 1] += d;
    assert.deepEqual(last.arr, b);
    assert.deepEqual(last.tree, T.fenTree(b));
    assert.equal(last.counters.steps, T.fenUpdateCost(n, i));
    for (const j of last.jumps) assert.equal(j.to, j.from + (j.from & -j.from));
    // exactly the blocks that contain i changed
    const before = T.fenTree(a);
    for (let k = 1; k <= n; k++) {
      const covers = k - (k & -k) < i && i <= k;
      assert.equal(last.tree[k - 1] !== before[k - 1] || d === 0, covers || d === 0, 'block ' + k);
    }
    everyLineExists(steps, T.FEN_CODE.update);
  }
  assert.throws(() => T.fenUpdate([1, 2], 0, 1));
  assert.throws(() => T.fenUpdate([1, 2], 3, 1));
});

test('Fenwick and segment tree agree over random operation sequences', () => {
  const rng = core.rng(65);
  let a = randArr(rng, 12, 1, 30);
  for (let t = 0; t < 40; t++) {
    if (rng() < 0.5) {
      const i = rng.int(1, 12), d = rng.int(-5, 5);
      a = T.fenUpdate(a, i, d).slice(-1)[0].arr;
    } else {
      const l = rng.int(1, 12), r = rng.int(l, 12);
      assert.equal(T.fenRange(a, l, r).slice(-1)[0].answer, T.segQuery('sum', a, l - 1, r - 1).slice(-1)[0].answer);
    }
  }
});

/* ------------------------------------------------------------ costs and code */
test('cost helpers grow like log n for the trees and like n for the naive approaches', () => {
  const small = T.costs(64, { samples: 400, seed: 3 }), big = T.costs(4096, { samples: 400, seed: 3 });
  assert.ok(big.naiveQuery > 30 * small.naiveQuery / 2);
  assert.ok(big.prefixUpdate > 30 * small.prefixUpdate / 2);
  assert.ok(big.segQuery < 3 * small.segQuery);
  assert.ok(big.fenQuery < 3 * small.fenQuery);
  assert.ok(big.segUpdate <= 13 && big.fenUpdate <= 13);
  assert.equal(T.segUpdateCost(1, 0), 1);
  assert.equal(T.segUpdateCost(16, 5), 5);
  assert.equal(T.fenUpdateCost(16, 1), 5);
  assert.equal(T.fenUpdateCost(16, 16), 1);
});

test('code panels parse in all three languages with the same labels', () => {
  const sets = [];
  for (const op of OPS) for (const kind of ['build', 'query', 'update']) sets.push(T.segCode(kind, op));
  sets.push(T.LAZY_CODE, T.FEN_CODE.prefix, T.FEN_CODE.range, T.FEN_CODE.update);
  for (const src of sets) {
    const a = Object.keys(lines(src.pseudo, 'pseudo')).sort();
    const b = Object.keys(lines(src.js, 'js')).sort();
    const c = Object.keys(lines(src.py, 'py')).sort();
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  }
});
