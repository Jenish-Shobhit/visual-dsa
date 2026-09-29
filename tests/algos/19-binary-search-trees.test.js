/* Lesson 19 · Binary search trees — tests for the pure step generators.
   Every generator is compared with an independent pointer-based reference BST (below), on random inputs
   from VDSA.rng and on the edge cases: empty, single node, duplicates, sorted, reversed, absent keys,
   deleting the root in every case. Every step of every trace is checked as a complete, truthful snapshot. */
const test = require('node:test');
const assert = require('node:assert/strict');
const bst = require('../../js/algos/19-binary-search-trees.js');
const VDSA = require('../../js/vdsa/core.js');
const code = require('../../js/vdsa/code.js');

/* ------------------------------------------------------------------ independent reference */
class Ref {
  constructor() { this.root = null; }
  insert(k) {
    const node = { key: k, left: null, right: null };
    if (!this.root) { this.root = node; return true; }
    let cur = this.root;
    for (;;) {
      if (k === cur.key) return false;
      const side = k < cur.key ? 'left' : 'right';
      if (!cur[side]) { cur[side] = node; return true; }
      cur = cur[side];
    }
  }
  has(k) { let c = this.root; while (c) { if (c.key === k) return true; c = k < c.key ? c.left : c.right; } return false; }
  depth(k) { let c = this.root, d = 0; while (c) { if (c.key === k) return d; c = k < c.key ? c.left : c.right; d++; } return -1; }
  pathLength(k) { let c = this.root, n = 0; while (c) { n++; if (c.key === k) return n; c = k < c.key ? c.left : c.right; } return n; }
  delete(k) {
    const del = (node, key) => {
      if (!node) return null;
      if (key < node.key) node.left = del(node.left, key);
      else if (key > node.key) node.right = del(node.right, key);
      else {
        if (!node.left) return node.right;
        if (!node.right) return node.left;
        let s = node.right;
        while (s.left) s = s.left;
        node.key = s.key;
        node.right = del(node.right, s.key);
      }
      return node;
    };
    this.root = del(this.root, k);
  }
  shape(n = this.root) { return n ? [n.key, this.shape(n.left), this.shape(n.right)] : null; }
  keys() { const out = []; const walk = n => { if (!n) return; walk(n.left); out.push(n.key); walk(n.right); }; walk(this.root); return out; }
  height(n = this.root) { return n ? 1 + Math.max(this.height(n.left), this.height(n.right)) : -1; }
}
function refOf(keys) { const r = new Ref(); keys.forEach(k => r.insert(k)); return r; }

function randomKeys(rng, n, lo = 0, hi = 99) { const out = []; for (let i = 0; i < n; i++) out.push(rng.int(lo, hi)); return out; }

/* ------------------------------------------------------------------ snapshot checks */
const LABELS = {};
for (const op of Object.keys(bst.CODE)) {
  LABELS[op] = ['pseudo', 'js', 'py'].map(l => new Set(Object.keys(code.parse(bst.CODE[op][l], l).labels)));
}
function checkLines(steps, op) {
  for (const s of steps) {
    if (s.line === null || s.line === undefined) continue;
    for (const lab of [].concat(s.line)) {
      for (const set of LABELS[op]) assert.ok(set.has(lab), `${op}: label @${lab} missing in a language (${s.kind})`);
    }
  }
}
function checkSnapshots(steps, label) {
  assert.ok(steps.length > 0, label + ': no steps');
  const counterKeys = JSON.stringify(Object.keys(steps[0].counters || {}));
  steps.forEach((s, i) => {
    const where = `${label} step ${i} (${s.kind})`;
    assert.equal(typeof s.caption, 'string', where + ': caption');
    if (s.kind !== 'range') assert.ok(s.caption.length > 0, where + ': empty caption');
    assert.equal(JSON.stringify(Object.keys(s.counters || {})), counterKeys, where + ': counter keys changed');
    const ids = new Set(s.nodes.map(n => n.id));
    assert.equal(ids.size, s.nodes.length, where + ': duplicate node ids');
    if (s.root === null) assert.equal(s.nodes.length, 0, where + ': nodes without a root');
    else {
      assert.ok(ids.has(s.root), where + ': root missing');
      // every node reachable exactly once from the root
      const byId = Object.fromEntries(s.nodes.map(n => [n.id, n]));
      const seen = new Set(); const stack = [s.root];
      while (stack.length) {
        const id = stack.pop();
        assert.ok(!seen.has(id), where + ': cycle / shared child at ' + id);
        seen.add(id);
        const n = byId[id];
        assert.ok(n, where + ': dangling child ' + id);
        if (n.left) stack.push(n.left);
        if (n.right) stack.push(n.right);
      }
      assert.equal(seen.size, s.nodes.length, where + ': unreachable nodes');
      // the ordering invariant holds in every snapshot (a copy in progress may show one key twice)
      const t = { root: s.root, nodes: byId, next: 0 };
      if (s.kind !== 'copied') assert.ok(bst.isValid(t), where + ': not a BST');
    }
    const byId = Object.fromEntries(s.nodes.map(n => [n.id, n]));
    for (const key of Object.keys(s.edges || {})) {
      const [p, c] = key.split('-');
      assert.ok(byId[p] && (byId[p].left === c || byId[p].right === c), where + ': edge state on a missing link ' + key);
    }
    for (const p of s.pointers || []) assert.ok(ids.has(p.target), where + ': pointer ' + p.name + ' targets a missing node');
    for (const h of s.hulls || []) assert.ok(ids.has(h.root), where + ': hull on a missing node');
    for (const c of s.chips || []) { assert.ok(ids.has(c.from) || c.from === undefined, where + ': chip source'); assert.ok(ids.has(c.at), where + ': chip target'); }
    for (const sl of s.slots || []) {
      if (sl.parent === null) continue;
      assert.ok(ids.has(sl.parent), where + ': slot parent missing');
      assert.equal(byId[sl.parent][sl.side], null, where + ': slot is not empty');
    }
    if (s.probe) {
      assert.equal(s.probe.state, 'key');
      if (s.probe.at) assert.ok(ids.has(s.probe.at), where + ': probe at missing node');
      if (s.probe.slot && s.probe.slot.parent !== null) assert.equal(byId[s.probe.slot.parent][s.probe.slot.side], null, where + ': probe slot not empty');
      assert.ok(!ids.has(s.probe.id), where + ': probe id collides with a node');
    }
    // 'found' only on a node whose key is the answer at that moment
    for (const n of s.nodes) if (n.state === 'found' && s.kind === 'found' && s.probe) assert.equal(n.value, s.probe.value, where + ': found on the wrong key');
  });
}

/* ------------------------------------------------------------------ tree helpers */
test('helpers: fromKeys, height, inorder, validity and bounds', () => {
  const t = bst.fromKeys([50, 30, 70, 20, 40, 60, 80, 30]);
  assert.deepEqual(bst.inorder(t), [20, 30, 40, 50, 60, 70, 80]);
  assert.equal(bst.height(t), 2);
  assert.equal(bst.height(bst.empty()), -1);
  assert.equal(bst.height(bst.fromKeys([5])), 0);
  assert.ok(bst.isValid(t));
  // the classic trap: every parent/child pair is fine, but 55 sits in 50's left subtree
  const fake = bst.fromShape([50, [30, [20], [40, [35], [55]]], [70, [60], [80]]]);
  assert.equal(bst.isValid(fake), false);
  const v = bst.firstViolation(fake);
  assert.equal(fake.nodes[v.id].value, 55);
  assert.equal(v.hi, 50);
  const b = bst.bounds(t);
  assert.deepEqual(b[bst.findId(t, 40)], { lo: 30, hi: 50 });
  assert.equal(bst.fromShape(null).root, null);
});

/* ------------------------------------------------------------------ insert / build */
test('insertSteps builds exactly the reference tree on random inputs, with valid snapshots', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(seed);
    const keys = randomKeys(rng, rng.int(0, 18), -20, 60);
    const ref = new Ref();
    let t = bst.empty();
    for (const k of keys) {
      const quick = seed % 2 === 0;
      const res = bst.insertSteps(t, k, { quick });
      const expectInserted = ref.insert(k);
      assert.equal(res.inserted, expectInserted, `seed ${seed} key ${k}`);
      checkSnapshots(res.steps, `insert ${k} (seed ${seed})`);
      checkLines(res.steps, 'insert');
      if (!quick) {
        const compares = res.steps.filter(s => s.kind === 'compare' || s.kind === 'dup').length;
        assert.equal(compares, ref.pathLength(k) - (expectInserted ? 1 : 0) + (expectInserted ? 0 : 0), `compare steps for ${k}`);
      }
      assert.equal(res.steps.at(-1).counters.comparisons, expectInserted ? ref.depth(k) : ref.depth(k) + 1, `comparisons for ${k}`);
      t = res.tree;
    }
    assert.deepEqual(bst.shape(t), ref.shape(), `seed ${seed}`);
  }
});

test('insert: empty tree, duplicates and the input tree is never mutated', () => {
  const r0 = bst.insertSteps(bst.empty(), 7);
  assert.equal(r0.inserted, true);
  assert.deepEqual(bst.shape(r0.tree), [7, null, null]);
  assert.equal(r0.steps.at(-1).counters.height, 0);
  const t = bst.fromKeys([8, 3, 10]);
  const before = JSON.stringify(t);
  const dup = bst.insertSteps(t, 3);
  assert.equal(dup.inserted, false);
  assert.equal(dup.steps.at(-1).kind, 'dup');
  assert.deepEqual(bst.shape(dup.tree), bst.shape(t));
  bst.insertSteps(t, 9); bst.deleteSteps(t, 8); bst.searchSteps(t, 3);
  assert.equal(JSON.stringify(t), before, 'input tree mutated');
  // the probe lands: its id is the new node's id
  const ins = bst.insertSteps(t, 9);
  const probeIds = ins.steps.filter(s => s.probe).map(s => s.probe.id);
  assert.ok(probeIds.every(id => id === ins.id));
});

test('buildSteps: sorted and reversed input degenerate into a stick; median-first is perfectly balanced', () => {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const sorted = bst.buildSteps(keys);
  assert.equal(bst.height(sorted.tree), 14);
  assert.equal(sorted.comparisons, 14 * 15 / 2);
  checkSnapshots(sorted.steps, 'build sorted');
  checkLines(sorted.steps, 'insert');
  const rev = bst.buildSteps(keys.slice().reverse());
  assert.equal(bst.height(rev.tree), 14);
  const bal = bst.buildSteps(bst.medianFirst(keys));
  assert.equal(bst.height(bal.tree), 3);
  assert.deepEqual(bst.inorder(bal.tree), keys);
  const zz = bst.buildSteps(bst.zigzag(keys));
  assert.equal(bst.height(zz.tree), 14, 'zig-zag order is also a stick');
  const dups = bst.buildSteps([5, 5, 3, 5, 3]);
  assert.deepEqual(dups.rejected, [5, 5, 3]);
  assert.equal(bst.size(dups.tree), 2);
  const none = bst.buildSteps([]);
  assert.equal(none.steps.length, 1);
  assert.equal(none.tree.root, null);
  // comparisons are cumulative and never decrease
  for (let i = 1; i < sorted.steps.length; i++) assert.ok(sorted.steps[i].counters.comparisons >= sorted.steps[i - 1].counters.comparisons);
  for (let seed = 1; seed <= 20; seed++) {
    const rng = VDSA.rng(100 + seed);
    const ks = randomKeys(rng, 14);
    assert.deepEqual(bst.shape(bst.buildSteps(ks).tree), refOf(ks).shape());
  }
});

/* ------------------------------------------------------------------ search */
test('searchSteps finds exactly the present keys, with one comparison per node on the path', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = VDSA.rng(200 + seed);
    const keys = randomKeys(rng, rng.int(0, 16), 0, 40);
    const t = bst.fromKeys(keys), ref = refOf(keys);
    for (let k = -1; k <= 41; k += 3) {
      const res = bst.searchSteps(t, k, { counters: 'search' });
      checkSnapshots(res.steps, `search ${k}`);
      checkLines(res.steps, 'search');
      assert.equal(res.found !== null, ref.has(k), `seed ${seed} key ${k}`);
      if (res.found) assert.equal(t.nodes[res.found].value, k);
      const last = res.steps.at(-1);
      assert.equal(last.counters.comparisons, ref.root ? ref.pathLength(k) : 0);
      assert.equal(last.counters.candidates, ref.has(k) ? 1 : 0);
      // candidates never increase, and a present key is never muted before it is found
      for (let i = 1; i < res.steps.length; i++) assert.ok(res.steps[i].counters.candidates <= res.steps[i - 1].counters.candidates);
      if (res.found) for (const s of res.steps) { const n = s.nodes.find(x => x.id === res.found); assert.notEqual(n.state, 'muted', 'target muted'); }
    }
  }
});

test('search: pruned hulls never contain the target', () => {
  const t = bst.fromKeys([50, 30, 70, 20, 40, 60, 80, 35, 45, 65]);
  for (const k of bst.inorder(t)) {
    const res = bst.searchSteps(t, k);
    for (const s of res.steps) for (const h of s.hulls) {
      const vals = bst.subtreeIds(t, h.root).map(id => t.nodes[id].value);
      assert.ok(!vals.includes(k), `hull contains ${k}`);
    }
  }
  const e = bst.searchSteps(bst.empty(), 5);
  assert.equal(e.found, null);
  assert.equal(e.steps.length, 1);
});

/* ------------------------------------------------------------------ min / max / successor / predecessor */
test('min, max, successor and predecessor match the sorted order', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = VDSA.rng(300 + seed);
    const keys = randomKeys(rng, rng.int(0, 15), 0, 50);
    const t = bst.fromKeys(keys);
    const sorted = [...new Set(keys)].sort((a, b) => a - b);
    const mn = bst.minSteps(t), mx = bst.maxSteps(t);
    checkSnapshots(mn.steps, 'min'); checkSnapshots(mx.steps, 'max');
    checkLines(mn.steps, 'min'); checkLines(mx.steps, 'max');
    assert.equal(mn.result ? t.nodes[mn.result].value : null, sorted.length ? sorted[0] : null);
    assert.equal(mx.result ? t.nodes[mx.result].value : null, sorted.length ? sorted.at(-1) : null);
    for (let k = -1; k <= 51; k += 2) {
      const i = sorted.indexOf(k);
      const s = bst.successorSteps(t, k), p = bst.predecessorSteps(t, k);
      checkSnapshots(s.steps, 'succ ' + k); checkSnapshots(p.steps, 'pred ' + k);
      checkLines(s.steps, 'succ');
      const expS = i === -1 ? null : (i + 1 < sorted.length ? sorted[i + 1] : null);
      const expP = i === -1 ? null : (i > 0 ? sorted[i - 1] : null);
      assert.equal(s.result ? t.nodes[s.result].value : null, expS, `succ of ${k} in [${sorted}]`);
      assert.equal(p.result ? t.nodes[p.result].value : null, expP, `pred of ${k} in [${sorted}]`);
    }
  }
});

test('successor: both cases are traced (right subtree minimum, nearest left-turn ancestor)', () => {
  const t = bst.fromKeys([50, 30, 70, 20, 40, 60, 80, 35, 45, 65]);
  const a = bst.successorSteps(t, 30);   // has a right subtree -> 35
  assert.equal(t.nodes[a.result].value, 35);
  assert.ok(a.steps.some(s => s.kind === 'goDown'));
  const b = bst.successorSteps(t, 45);   // no right subtree -> ancestor 50
  assert.equal(t.nodes[b.result].value, 50);
  assert.ok(!b.steps.some(s => s.kind === 'goDown'));
  const c = bst.successorSteps(t, 80);   // maximum -> none
  assert.equal(c.result, null);
  assert.equal(bst.minSteps(bst.empty()).result, null);
  assert.equal(bst.successorSteps(bst.empty(), 3).result, null);
});

/* ------------------------------------------------------------------ delete */
test('deleteSteps matches Hibbard deletion (copy the successor) on random sequences', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(400 + seed);
    const keys = randomKeys(rng, rng.int(1, 16), 0, 40);
    const ref = refOf(keys);
    let t = bst.fromKeys(keys);
    const victims = randomKeys(rng, 10, -2, 42);
    for (const k of victims) {
      const had = ref.has(k);
      const res = bst.deleteSteps(t, k);
      checkSnapshots(res.steps, `delete ${k} (seed ${seed})`);
      checkLines(res.steps, 'delete');
      ref.delete(k);
      assert.equal(res.deleted, had);
      assert.deepEqual(bst.shape(res.tree), ref.shape(), `seed ${seed} delete ${k}`);
      assert.ok(bst.isValid(res.tree));
      assert.deepEqual(bst.inorder(res.tree), ref.keys());
      t = res.tree;
    }
  }
});

test('delete: all three cases, at the root and below, animate the right way', () => {
  const base = [50, 30, 70, 20, 40, 60, 80, 45, 55, 65];
  const t = bst.fromKeys(base);
  const leaf = bst.deleteSteps(t, 20);
  assert.equal(leaf.kind, 'leaf');
  assert.ok(leaf.steps.some(s => s.kind === 'remove'));
  const one = bst.deleteSteps(t, 40);          // 40 has only the right child 45
  assert.equal(one.kind, 'one');
  const splice = one.steps.find(s => s.kind === 'splice');
  const n30 = splice.nodes.find(n => n.value === 30);
  assert.equal(splice.nodes.find(n => n.id === n30.right).value, 45, '45 takes 40\'s place under 30');
  const two = bst.deleteSteps(t, 50);          // root with two children: successor 55
  assert.equal(two.kind, 'two');
  const kinds = two.steps.map(s => s.kind);
  for (const k of ['found', 'case', 'succStart', 'succFound', 'copy', 'copied', 'done']) assert.ok(kinds.includes(k), 'missing ' + k);
  assert.ok(kinds.indexOf('succFound') < kinds.indexOf('copy') && kinds.indexOf('copy') < kinds.indexOf('copied'));
  const copyStep = two.steps.find(s => s.kind === 'copy');
  assert.equal(copyStep.chips.length, 1);
  assert.equal(copyStep.chips[0].value, 55);
  assert.equal(copyStep.nodes.find(n => n.id === copyStep.chips[0].at).value, 50, 'the target still shows 50 while the copy flies');
  const copied = two.steps.find(s => s.kind === 'copied');
  assert.equal(copied.nodes.filter(n => n.value === 55).length, 2, 'the key appears twice before the old copy is removed');
  assert.equal(two.tree.nodes[two.tree.root].value, 55);
  assert.equal(two.tree.root, t.root, 'the node keeps its identity; only its key changes');
  // successor is the right child itself (no left child)
  const t2 = bst.fromKeys([10, 5, 20, 25]);
  const d2 = bst.deleteSteps(t2, 10);
  assert.deepEqual(bst.shape(d2.tree), [20, [5, null, null], [25, null, null]]);
  // successor with a right child that must be spliced up
  const t3 = bst.fromKeys([10, 5, 30, 20, 25]);
  const d3 = bst.deleteSteps(t3, 10);
  assert.deepEqual(bst.shape(d3.tree), [20, [5, null, null], [30, [25, null, null], null]]);
  assert.ok(d3.steps.some(s => s.kind === 'splice'));
  // root cases, single node, empty, absent
  assert.equal(bst.deleteSteps(bst.fromKeys([7]), 7).tree.root, null);
  assert.deepEqual(bst.shape(bst.deleteSteps(bst.fromKeys([7, 9, 8]), 7).tree), [9, [8, null, null], null]);
  const e = bst.deleteSteps(bst.empty(), 3);
  assert.equal(e.deleted, false); assert.equal(e.steps.length, 1);
  const miss = bst.deleteSteps(t, 47);
  assert.equal(miss.kind, 'absent');
  assert.deepEqual(bst.shape(miss.tree), bst.shape(t));
});

/* ------------------------------------------------------------------ in-order, fold, range */
test('inorderSteps writes every key once, in sorted order, each under its own node', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = VDSA.rng(500 + seed);
    const keys = randomKeys(rng, rng.int(0, 15));
    const t = bst.fromKeys(keys);
    const res = bst.inorderSteps(t);
    checkSnapshots(res.steps, 'inorder');
    const last = res.steps.at(-1);
    const expected = [...new Set(keys)].sort((a, b) => a - b);
    assert.deepEqual(last.strip.items.map(i => i.value), expected);
    assert.deepEqual(res.order, expected);
    for (const it of last.strip.items) {
      const src = last.nodes.find(n => n.id === it.from);
      assert.equal(src.value, it.value);
      assert.equal(src.col, it.col, 'copy drops straight down');
    }
    assert.equal(last.cols, expected.length);
  }
  assert.equal(bst.inorderSteps(bst.empty()).steps.length, 1);
});

test('foldSteps folds a sorted array into a perfectly balanced BST and searches both the same way', () => {
  const keys = [3, 8, 12, 17, 21, 26, 30, 34, 39, 43, 47, 52, 58, 63, 71];
  const res = bst.foldSteps(keys, 43);
  checkSnapshots(res.steps, 'fold');
  assert.ok(bst.isValid(res.tree));
  assert.equal(bst.height(res.tree), 3);
  assert.deepEqual(bst.inorder(res.tree), keys);
  assert.equal(res.steps.at(-1).kind, 'found');
  assert.equal(res.steps.at(-1).counters.comparisons, 3);   // 34, 52, 43
  const miss = bst.foldSteps(keys, 44);
  assert.equal(miss.steps.at(-1).kind, 'absent');
  // each rising node starts from its own array slot
  for (const s of res.steps) for (const n of s.nodes) if (n.from) assert.equal(s.strip.items.find(i => i.id === n.from).value, n.value);
  const odd = bst.foldSteps([1, 2, 3, 4, 5, 6], null);
  assert.equal(bst.height(odd.tree), 2);
});

test('rangeState reports exactly the keys in [lo, hi] and prunes only subtrees with no answers', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = VDSA.rng(600 + seed);
    const keys = randomKeys(rng, rng.int(0, 20));
    const t = bst.fromKeys(keys);
    const lo = rng.int(0, 99), hi = rng.int(0, 99);
    const a = Math.min(lo, hi), b = Math.max(lo, hi);
    const res = bst.rangeState(t, lo, hi);
    const expected = [...new Set(keys)].filter(k => k >= a && k <= b).sort((x, y) => x - y);
    assert.deepEqual(res.reported, expected, `[${a}, ${b}]`);
    for (const id of res.pruned) for (const k of bst.subtreeIds(t, id).map(x => t.nodes[x].value)) assert.ok(k < a || k > b, 'pruned an answer');
    assert.equal(res.visited + res.skipped + 0 <= bst.size(t), true);
    checkSnapshots([res.step], 'range');
    const reportedStates = res.step.nodes.filter(n => n.state === 'found').map(n => n.value).sort((x, y) => x - y);
    assert.deepEqual(reportedStates, expected);
  }
});

/* ------------------------------------------------------------------ simulation */
test('simulate: sorted order is a stick, random order stays logarithmic', () => {
  const rows = bst.simulate([1, 2, 8, 64, 256], { seed: 3 });
  for (const r of rows) {
    assert.equal(r.sortedHeight, r.n - 1);
    assert.ok(Math.abs(r.sortedDepth - (r.n - 1) / 2) < 1e-9);
  }
  const r256 = rows.find(r => r.n === 256);
  // expected average depth of a random BST: 2(1 + 1/n)H_n − 4
  let H = 0; for (let i = 1; i <= 256; i++) H += 1 / i;
  const expected = 2 * (1 + 1 / 256) * H - 4;
  assert.ok(Math.abs(r256.randomDepth - expected) < 0.35, `avg depth ${r256.randomDepth} vs ${expected}`);
  assert.ok(r256.randomHeight < 25 && r256.randomHeight > 8);
  assert.equal(rows[0].randomDepth, 0);
});
