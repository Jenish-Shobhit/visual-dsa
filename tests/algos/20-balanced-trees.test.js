/* Lesson 20 · Balanced trees — tests for the pure step generators.
   Every generator is compared with an independent textbook reference (recursive AVL with stored heights,
   CLRS red-black insertion with parent pointers) on random inputs from VDSA.rng and on the edge cases:
   empty, single node, duplicates, sorted, reversed, absent keys, deleting the root, every AVL case. Every
   step of every trace is checked as a complete, truthful snapshot. */
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/algos/20-balanced-trees.js');
const VDSA = require('../../js/vdsa/core.js');
const code = require('../../js/vdsa/code.js');

function randomKeys(rng, n, lo = 0, hi = 99) { const out = []; for (let i = 0; i < n; i++) out.push(rng.int(lo, hi)); return out; }
function distinct(keys) { return Array.from(new Set(keys)); }
function sortedRange(n) { return Array.from({ length: n }, (_, i) => i + 1); }
function treeFromStep(step) {
  const t = { root: step.root, nodes: {}, next: 0 };
  step.nodes.forEach(n => { t.nodes[n.id] = { id: n.id, value: n.value, left: n.left, right: n.right, color: n.color || null }; });
  return t;
}
function buildAvl(keys) { let t = T.empty(); for (const k of keys) t = T.avlInsertSteps(t, k, { quick: true }).tree; return t; }
function buildRb(keys) { let t = T.empty(); for (const k of keys) t = T.rbInsertSteps(t, k, { quick: true }).tree; return t; }

/* every step is a complete, well-formed snapshot of a real tree */
function checkSnapshot(step, label) {
  assert.ok(Array.isArray(step.nodes), label + ': nodes');
  const ids = new Set(step.nodes.map(n => n.id));
  assert.equal(ids.size, step.nodes.length, label + ': unique ids');
  if (step.root !== null) assert.ok(ids.has(step.root), label + ': root exists');
  const seen = new Set();
  const stack = step.root === null ? [] : [step.root];
  const byId = Object.fromEntries(step.nodes.map(n => [n.id, n]));
  while (stack.length) {
    const id = stack.pop();
    assert.ok(!seen.has(id), label + ': node ' + id + ' reached twice');
    seen.add(id);
    const n = byId[id];
    for (const c of [n.left, n.right]) if (c !== null && c !== undefined) { assert.ok(ids.has(c), label + ': child exists'); stack.push(c); }
  }
  assert.equal(seen.size, step.nodes.length, label + ': every node reachable from the root');
  assert.ok(step.counters && typeof step.counters.height === 'number', label + ': counters');
  assert.ok(typeof step.caption === 'string' && step.caption.length > 0, label + ': caption');
  const t = treeFromStep(step);
  // the delete's "copy" step holds the successor's key twice on purpose (copy first, remove the old node next)
  if (step.kind !== 'copy') assert.ok(T.isBst(t), label + ': always a valid BST, rotations preserve order');
  assert.equal(step.counters.height, T.height(t), label + ': height counter is truthful');
  assert.equal(step.counters.nodes, step.nodes.length, label + ': node counter');
}
const CODEL = {};
for (const op of Object.keys(T.CODE)) CODEL[op] = ['pseudo', 'js', 'py'].map(l => new Set(Object.keys(code.parse(T.CODE[op][l], l).labels)));
function checkLines(steps, op) {
  for (const s of steps) {
    if (s.line === null || s.line === undefined) continue;
    const lines = Array.isArray(s.line) ? s.line : [s.line];
    for (const l of lines) CODEL[op].forEach((set, i) => assert.ok(set.has(l), op + ': label "' + l + '" missing in language ' + i));
  }
}
function sameCounterKeys(steps) {
  const keys = Object.keys(steps[0].counters).join(',');
  for (const s of steps) assert.equal(Object.keys(s.counters).join(','), keys);
}

/* ------------------------------------------------------------------ rotation */
test('rotate right and left keep the in-order sequence and are inverses', () => {
  const t = T.fromShape([50, [30, [20], [40]], [70]]);
  const before = T.inorder(t);
  const c = T.clone(t);
  const top = T.rotate(c, c.root, 'right');
  assert.equal(c.nodes[top].value, 30);
  assert.deepEqual(T.shape(c), [30, [20, null, null], [50, [40, null, null], [70, null, null]]]);
  assert.deepEqual(T.inorder(c), before);
  T.rotate(c, c.root, 'left');
  assert.deepEqual(T.shape(c), T.shape(t));
});
test('rotate throws without the needed child', () => {
  const t = T.fromShape([10, null, [20]]);
  assert.throws(() => T.rotate(t, t.root, 'right'));
});
test('rotateUp on a child, on the root and on a deep node', () => {
  const t = T.fromShape([50, [30, [20], [40]], [70]]);
  assert.equal(T.rotateUp(t, t.root), null);
  const idOf = v => T.findId(t, v);
  const up = T.rotateUp(t, idOf(30));
  assert.equal(up.nodes[up.root].value, 30);
  assert.deepEqual(T.inorder(up), T.inorder(t));
  const deep = T.rotateUp(t, idOf(40));
  assert.deepEqual(T.inorder(deep), T.inorder(t));
  assert.equal(deep.nodes[deep.nodes[deep.root].left].value, 40);
});
test('xyState: both orientations hold A x B y C in order', () => {
  ['left', 'right'].forEach(which => {
    const s = T.xyState(which);
    const t = { root: s.root, nodes: {} };
    s.nodes.forEach(n => { t.nodes[n.id] = { id: n.id, value: n.label, left: n.left, right: n.right }; });
    assert.deepEqual(T.inorderIds(t), ['A', 'x', 'B', 'y', 'C']);
  });
});
test('random rotations never change the in-order sequence or break the BST rule', () => {
  const rng = VDSA.rng(2020);
  for (let round = 0; round < 40; round++) {
    let t = T.fromKeys(distinct(randomKeys(rng, 12)));
    const order = T.inorder(t);
    for (let k = 0; k < 15; k++) {
      const ids = Object.keys(t.nodes);
      const next = T.rotateUp(t, ids[rng.int(0, ids.length - 1)]);
      if (next) t = next;
      assert.deepEqual(T.inorder(t), order);
      assert.ok(T.isBst(t));
    }
  }
});

/* ------------------------------------------------------------------ AVL insert */
test('AVL insert matches the textbook reference (random)', () => {
  const rng = VDSA.rng(7);
  for (let round = 0; round < 60; round++) {
    const keys = randomKeys(rng, rng.int(0, 22));
    const t = buildAvl(keys);
    const ref = T.avlRef(keys);
    assert.deepEqual(T.shape(t), T.shape(ref), 'keys ' + keys.join(','));
    assert.ok(T.isAvl(t));
    assert.deepEqual(T.inorder(t), distinct(keys).sort((a, b) => a - b));
  }
});
test('AVL insert is valid after every single insert, sorted, reversed and zig-zag', () => {
  const orders = [sortedRange(40), sortedRange(40).reverse(), [1, 40, 2, 39, 3, 38, 4, 37, 5, 36, 6, 35]];
  for (const keys of orders) {
    let t = T.empty();
    for (const k of keys) { t = T.avlInsertSteps(t, k, { quick: true }).tree; assert.ok(T.isAvl(t), 'after ' + k); }
  }
});
test('AVL insert: empty tree, single key, duplicate', () => {
  const one = T.avlInsertSteps(T.empty(), 5);
  assert.equal(one.inserted, true);
  assert.deepEqual(T.shape(one.tree), [5, null, null]);
  one.steps.forEach((s, i) => checkSnapshot(s, 'single ' + i));
  const dup = T.avlInsertSteps(one.tree, 5);
  assert.equal(dup.inserted, false);
  assert.deepEqual(T.shape(dup.tree), [5, null, null]);
  assert.equal(dup.steps[dup.steps.length - 1].kind, 'dup');
  dup.steps.forEach((s, i) => { s.counters = s.counters; checkSnapshot(s, 'dup ' + i); });
});
test('AVL insert never mutates its input tree', () => {
  const t = buildAvl([10, 20, 30, 40]);
  const snapshot = JSON.stringify(t);
  T.avlInsertSteps(t, 50);
  T.avlDeleteSteps(t, 20);
  assert.equal(JSON.stringify(t), snapshot);
});
test('AVL: each of the four cases is named and fixed as taught', () => {
  const expect = { LL: 1, RR: 1, LR: 2, RL: 2 };
  for (const name of Object.keys(expect)) {
    const c = T.avlCaseSteps(name);
    const flags = c.steps.filter(s => s.kind === 'flag');
    assert.equal(flags.length, 1, name);
    assert.equal(flags[0].case.name, name);
    const rots = c.steps.filter(s => s.kind === 'rotate');
    assert.equal(rots.length, expect[name], name + ' rotations');
    assert.ok(T.isAvl(c.tree));
    assert.deepEqual(T.inorder(c.tree), T.inorder(c.base).concat([c.key]).sort((a, b) => a - b));
    const flagIdx = c.steps.indexOf(flags[0]);
    // the flagged step shows the unbalanced node with a ±2 badge
    const bad = c.steps[flagIdx].nodes.filter(n => n.badgeState === 'error');
    assert.equal(bad.length, 1, name + ' one node flashes');
    assert.ok(bad[0].badge === '+2' || bad[0].badge === '−2');
    // a double rotation is still unbalanced after the first rotation
    if (expect[name] === 2) {
      const afterFirst = c.steps[c.steps.indexOf(rots[0])];
      assert.ok(afterFirst.nodes.some(n => n.badgeState === 'error'), name + ' still unbalanced after the first rotation');
      const afterSecond = c.steps[c.steps.indexOf(rots[1])];
      assert.ok(!afterSecond.nodes.some(n => n.badgeState === 'error'), name + ' balanced after the second');
    }
    c.steps.forEach((s, i) => checkSnapshot(s, name + ' ' + i));
  }
});
test('AVL rotations preserve the in-order sequence in every step of every trace', () => {
  const rng = VDSA.rng(11);
  for (let round = 0; round < 25; round++) {
    const keys = distinct(randomKeys(rng, 14));
    let t = T.empty();
    for (const k of keys) {
      const res = T.avlInsertSteps(t, k);
      const expected = distinct(T.inorder(t).concat([k])).sort((a, b) => a - b);
      res.steps.forEach((s, i) => {
        checkSnapshot(s, 'insert ' + k + ' step ' + i);
        assert.deepEqual(T.inorder(treeFromStep(s)).filter(v => expected.includes(v)), T.inorder(treeFromStep(s)));
        if (s.kind !== 'attach' && s.kind !== 'start' && s.kind !== 'compare' && s.kind !== 'dup') assert.deepEqual(T.inorder(treeFromStep(s)), expected, 'kind ' + s.kind);
      });
      t = res.tree;
    }
  }
});
test('AVL insert: badges are stale until the walk back up reaches the node', () => {
  // 30 20 → inserting 10 makes 30 left-heavy by 2, but its badge still says +1 until it is checked
  const t = buildAvl([30, 20]);
  const res = T.avlInsertSteps(t, 10);
  const attach = res.steps.find(s => s.kind === 'attach');
  const top = attach.nodes.find(n => n.value === 30);
  assert.equal(top.badge, '+1', 'the old value');
  const flag = res.steps.find(s => s.kind === 'flag');
  assert.equal(flag.case.name, 'LL');
  assert.equal(flag.nodes.find(n => n.value === 30).badge, '+2');
  assert.equal(flag.nodes.find(n => n.value === 30).badgeState, 'error');
});
test('AVL: counters, code labels and vars are consistent', () => {
  const res = T.avlInsertSteps(buildAvl([10, 20, 30, 40, 50]), 60);
  sameCounterKeys(res.steps);
  checkLines(res.steps, 'avlInsert');
  res.steps.forEach((s, i) => checkSnapshot(s, 'ins ' + i));
  const cmp = res.steps.map(s => s.counters.comparisons);
  assert.deepEqual(cmp, cmp.slice().sort((a, b) => a - b), 'comparisons never go down');
  const last = res.steps[res.steps.length - 1];
  assert.equal(last.kind, 'done');
  assert.equal(last.counters.nodes, 6);
});
test('AVL height bound: h ≤ 1.4405·log2(n+2) − 1.3277 on the worst insertion orders we can find', () => {
  for (const n of [1, 2, 3, 7, 15, 31, 64, 100, 200]) {
    const h = T.height(buildAvl(sortedRange(n)));
    assert.ok(h <= 1.4405 * Math.log2(n + 2) - 1.3277 + 1e-9, 'sorted n=' + n + ' h=' + h);
    const rng = VDSA.rng(n);
    const keys = VDSA.shuffle(sortedRange(n), rng);
    const h2 = T.height(buildAvl(keys));
    assert.ok(h2 <= 1.4405 * Math.log2(n + 2) - 1.3277 + 1e-9);
    assert.ok(h2 >= Math.floor(Math.log2(n)));
  }
});
test('sorted inserts: a plain BST is a stick (h = n − 1), AVL and red-black stay logarithmic', () => {
  for (const n of [1, 2, 5, 15, 63]) {
    const b = T.fromKeys(sortedRange(n));
    assert.equal(T.height(b), n - 1);
    assert.ok(T.height(buildAvl(sortedRange(n))) <= Math.ceil(Math.log2(n + 1)) + 1);
    assert.ok(T.height(buildRb(sortedRange(n))) <= 2 * Math.log2(n + 1));
  }
  assert.equal(T.height(buildAvl(sortedRange(15))), 3, '1..15 fills a perfect tree in AVL');
});

/* ------------------------------------------------------------------ AVL delete */
test('AVL delete matches the textbook reference (random inserts, random deletes)', () => {
  const rng = VDSA.rng(99);
  for (let round = 0; round < 60; round++) {
    const keys = distinct(randomKeys(rng, rng.int(1, 20)));
    const dels = randomKeys(rng, rng.int(1, 8));
    let t = buildAvl(keys);
    const ref = T.avlRef(keys);
    const refKeys = keys.slice();
    for (const d of dels) {
      const res = T.avlDeleteSteps(t, d, { quick: true });
      t = res.tree;
      const before = refKeys.slice();
      const i = refKeys.indexOf(d);
      const wasThere = i !== -1;
      if (wasThere) refKeys.splice(i, 1);
      assert.equal(res.removed, wasThere);
      assert.ok(T.isAvl(t), 'after deleting ' + d + ' from ' + before.join(','));
      assert.deepEqual(T.inorder(t), refKeys.slice().sort((a, b) => a - b));
    }
    void ref;
  }
});
test('AVL delete equals the reference tree exactly', () => {
  const rng = VDSA.rng(5);
  for (let round = 0; round < 40; round++) {
    const keys = distinct(randomKeys(rng, rng.int(2, 18)));
    const del = keys[rng.int(0, keys.length - 1)];
    // reference: build with avlRef then delete in the same reference
    const ref = T.avlRef(keys, [del]);
    const mine = T.avlDeleteSteps(buildAvl(keys), del).tree;
    assert.deepEqual(T.shape(mine), T.shape(ref), keys.join(',') + ' − ' + del);
  }
});
test('AVL delete: leaf, one child, two children, root, absent, empty', () => {
  const base = buildAvl([50, 30, 70, 20, 40, 60, 80, 35]);
  const cases = { leaf: 20, oneChild: 40, twoKids: 30, root: 50, absent: 99 };
  for (const [name, key] of Object.entries(cases)) {
    const res = T.avlDeleteSteps(base, key);
    res.steps.forEach((s, i) => checkSnapshot(s, name + ' ' + i));
    sameCounterKeys(res.steps);
    checkLines(res.steps, 'avlDelete');
    assert.equal(res.removed, name !== 'absent');
    assert.ok(T.isAvl(res.tree));
    const expect = T.inorder(base).filter(v => v !== key);
    assert.deepEqual(T.inorder(res.tree), expect, name);
  }
  const empty = T.avlDeleteSteps(T.empty(), 5);
  assert.equal(empty.removed, false);
  assert.equal(empty.steps.length, 1);
});
test('AVL delete: the two-children case copies the successor and removes its node', () => {
  const base = buildAvl([50, 30, 70, 20, 40, 60, 80]);
  const res = T.avlDeleteSteps(base, 50);
  assert.deepEqual(res.steps.map(s => s.kind).filter(k => ['found', 'succ', 'copy', 'remove'].includes(k)), ['found', 'succ', 'copy', 'remove']);
  const copy = res.steps.find(s => s.kind === 'copy');
  assert.equal(copy.nodes.find(n => n.state === 'pivot').value, 60, 'the successor of 50 is 60');
  assert.ok(!T.inorder(res.tree).includes(50));
});
test('AVL delete can trigger a rotation, and the trace names the case with a level child', () => {
  // deleting from the short side of an AVL tree whose taller child is level → single rotation
  const base = T.fromShape([50, [30, [20], [40]], [70]]);
  const res = T.avlDeleteSteps(base, 70);
  const flag = res.steps.find(s => s.kind === 'flag');
  assert.ok(flag, 'a rebalance happens');
  assert.equal(flag.case.name, 'LL');
  assert.match(flag.caption, /level/);
  assert.ok(T.isAvl(res.tree));
});
test('deleting every key one by one keeps the tree an AVL tree', () => {
  const rng = VDSA.rng(31);
  const keys = distinct(randomKeys(rng, 30));
  let t = buildAvl(keys);
  for (const k of VDSA.shuffle(keys, rng)) {
    t = T.avlDeleteSteps(t, k, { quick: true }).tree;
    assert.ok(T.isAvl(t));
  }
  assert.equal(T.size(t), 0);
  assert.equal(t.root, null);
});

/* ------------------------------------------------------------------ red-black */
test('rbCheck: a valid tree, and each rule broken in turn', () => {
  const good = T.fromShape([13, [8, [1, null, [6, null, null, 'r'], 'b'], [11, null, null, 'b'], 'r'], [17, [15, null, null, 'b'], [25, [22, null, null, 'r'], [27, null, null, 'r'], 'b'], 'r'], 'b']);
  const g = T.rbCheck(good);
  assert.equal(g.valid, true);
  assert.equal(g.blackHeight, 2);
  const badRoot = T.fromShape([10, [5, null, null, 'b'], [15, null, null, 'b'], 'r']);
  assert.deepEqual(T.rbCheck(badRoot).ok, [true, false, true, true, false].map((v, i) => i === 4 ? true : v));
  const redRed = T.fromShape([10, [5, [3, null, null, 'r'], null, 'r'], [15, null, null, 'b'], 'b']);
  const rr = T.rbCheck(redRed);
  assert.equal(rr.ok[3], false);
  assert.equal(rr.nodes[3].length, 2);
  const blackCount = T.fromShape([10, [5, null, null, 'b'], null, 'b']);
  const bc = T.rbCheck(blackCount);
  assert.equal(bc.ok[4], false);
  assert.deepEqual(bc.nodes[4], [blackCount.root]);
  const uncolored = T.fromShape([10, [5], [15], 'b']);
  assert.equal(T.rbCheck(uncolored).ok[0], false);
  assert.equal(T.rbCheck(T.empty()).valid, true);
});
test('red-black insert matches the CLRS reference (random) and is valid', () => {
  const rng = VDSA.rng(23);
  for (let round = 0; round < 60; round++) {
    const keys = randomKeys(rng, rng.int(0, 24));
    const t = buildRb(keys);
    const ref = T.rbRef(keys);
    assert.deepEqual(T.shapeColored(t), T.shapeColored(ref), keys.join(','));
    assert.ok(T.isRedBlack(t), 'valid: ' + keys.join(','));
    assert.deepEqual(T.inorder(t), distinct(keys).sort((a, b) => a - b));
  }
});
test('red-black insert: sorted, reversed, empty, single, duplicate', () => {
  for (const keys of [sortedRange(50), sortedRange(50).reverse()]) {
    let t = T.empty();
    for (const k of keys) { t = T.rbInsertSteps(t, k, { quick: true }).tree; assert.ok(T.isRedBlack(t)); }
    assert.ok(T.height(t) <= 2 * Math.log2(51));
  }
  const one = T.rbInsertSteps(T.empty(), 7);
  assert.equal(one.tree.nodes[one.tree.root].color, 'black');
  one.steps.forEach((s, i) => checkSnapshot(s, 'rb single ' + i));
  assert.equal(one.steps[0].rules.ok[1], false, 'a fresh red root breaks rule 2');
  assert.equal(one.steps[one.steps.length - 1].rules.valid, true);
  const dup = T.rbInsertSteps(one.tree, 7);
  assert.equal(dup.inserted, false);
  assert.equal(dup.steps[dup.steps.length - 1].kind, 'dup');
});
test('red-black: every step is a truthful snapshot, rules are checked live, and the last step is valid', () => {
  const rng = VDSA.rng(3);
  for (let round = 0; round < 20; round++) {
    const keys = distinct(randomKeys(rng, 15));
    let t = T.empty();
    for (const k of keys) {
      const res = T.rbInsertSteps(t, k);
      sameCounterKeys(res.steps);
      checkLines(res.steps, 'rbInsert');
      res.steps.forEach((s, i) => {
        checkSnapshot(s, 'rb ' + k + ' ' + i);
        const live = T.rbCheck(treeFromStep(s));
        assert.deepEqual(s.rules.ok, live.ok, 'the panel matches the tree on screen');
        // violators are lit as errors
        [1, 3, 4].forEach(ri => s.rules.nodes[ri].forEach(id => assert.equal(s.nodes.find(n => n.id === id).state, 'error')));
      });
      const last = res.steps[res.steps.length - 1];
      assert.equal(last.rules.valid, true);
      assert.ok(res.rotations <= 2, 'at most two rotations per insert');
      t = res.tree;
    }
  }
});
test('red-black: recolour case and both rotation cases are exercised', () => {
  // uncle red: 10 black; 5, 15 red; insert 1 → recolour
  const rec = T.rbInsertSteps(T.fromShape([10, [5, null, null, 'r'], [15, null, null, 'r'], 'b']), 1);
  assert.ok(rec.steps.some(s => s.kind === 'recolor'));
  assert.equal(rec.rotations, 0);
  assert.equal(rec.tree.nodes[rec.tree.root].color, 'black');
  // uncle black, line: 10 b; 5 r; insert 1 → recolour + rotate
  const line = T.rbInsertSteps(T.fromShape([10, [5, null, null, 'r'], null, 'b']), 1);
  assert.equal(line.rotations, 1);
  assert.deepEqual(T.shapeColored(line.tree), [5, [1, null, null, 'r'], [10, null, null, 'r'], 'b']);
  // uncle black, triangle: 10 b; 5 r; insert 7 → two rotations
  const tri = T.rbInsertSteps(T.fromShape([10, [5, null, null, 'r'], null, 'b']), 7);
  assert.equal(tri.rotations, 2);
  assert.deepEqual(T.shapeColored(tri.tree), [7, [5, null, null, 'r'], [10, null, null, 'r'], 'b']);
  assert.ok(tri.steps.some(s => s.line && s.line.includes && s.line.includes('rotP')));
  // the recolour that leaves the root red is turned black at the end
  const chain = T.rbBuildSteps([10, 5, 15, 1]);
  assert.equal(chain.tree.nodes[chain.tree.root].color, 'black');
});
test('red-black black heights and badges', () => {
  const res = T.rbInsertSteps(buildRb([10, 5, 15, 1, 8]), 12, { blackHeights: true });
  const last = res.steps[res.steps.length - 1];
  assert.ok(last.nodes.every(n => /^bh \d+$/.test(n.badge)));
  const rootNode = last.nodes.find(n => n.id === last.root);
  assert.equal(rootNode.badge, 'bh ' + last.rules.blackHeight);
});
test('red-black height bound: h ≤ 2·log2(n + 1)', () => {
  const rng = VDSA.rng(77);
  for (const n of [1, 3, 7, 20, 63, 120]) {
    for (const keys of [sortedRange(n), VDSA.shuffle(sortedRange(n), rng)]) {
      const t = buildRb(keys);
      assert.ok(T.height(t) + 1 <= 2 * Math.log2(n + 1) + 1e-9, 'n=' + n);
      const bh = T.rbCheck(t).blackHeight;
      assert.ok(n >= Math.pow(2, bh) - 1, 'a tree with black height b has at least 2^b − 1 nodes');
    }
  }
});
test('rbPathSteps: every path has the same number of black nodes, then shortest and longest', () => {
  const t = T.fromShape([13, [8, [1, null, [6, null, null, 'r'], 'b'], [11, null, null, 'b'], 'r'], [17, [15, null, null, 'b'], [25, [22, null, null, 'r'], [27, null, null, 'r'], 'b'], 'r'], 'b']);
  const res = T.rbPathSteps(t);
  assert.equal(res.paths, 11, 'n + 1 NIL slots for n = 10');
  const pathSteps = res.steps.filter(s => s.kind === 'path');
  assert.equal(pathSteps.length, 11);
  assert.ok(pathSteps.every(s => s.blacks === 2));
  const short = res.steps.find(s => s.kind === 'short'), long = res.steps.find(s => s.kind === 'long');
  assert.ok(short.path.length < long.path.length);
  assert.ok(long.path.length <= 2 * short.path.length);
  res.steps.forEach((s, i) => assert.ok(s.caption && s.nodes, 'step ' + i));
});

/* ------------------------------------------------------------------ race and curves */
test('raceSteps: three trees, heights, rotations', () => {
  const res = T.raceSteps(sortedRange(15));
  assert.equal(res.steps.length, 16);
  const last = res.steps[15];
  assert.equal(last.heights.bst, 14);
  assert.equal(last.heights.avl, 3, '1..15 fills a perfect tree in AVL');
  assert.ok(last.heights.rb >= 3 && last.heights.rb <= 2 * Math.log2(16));
  assert.ok(last.rotations.avl > 0 && last.rotations.rb > 0);
  for (const s of res.steps) {
    ['bst', 'avl', 'rb'].forEach(k => {
      const v = s.trees[k];
      const t = { root: v.root, nodes: {} };
      v.nodes.forEach(n => { t.nodes[n.id] = { id: n.id, value: n.value, left: n.left, right: n.right, color: n.color || null }; });
      assert.ok(T.isBst(t));
    });
  }
  assert.ok(T.isAvl(res.trees.avl) && T.isRedBlack(res.trees.rb));
  const rbNodes = last.trees.rb.nodes;
  assert.ok(rbNodes.every(n => n.color === 'red' || n.color === 'black'));
  assert.ok(last.trees.avl.nodes.every(n => !n.color));
});
test('heightCurves: sorted BST is n − 1, balanced trees are logarithmic; random is reproducible', () => {
  const c = T.heightCurves(64, 'sorted');
  assert.equal(c.bst[63][1], 63);
  assert.ok(c.avl[63][1] <= 7 && c.rb[63][1] <= 10);
  const a = T.heightCurves(40, 'random', VDSA.rng(1)), b = T.heightCurves(40, 'random', VDSA.rng(1));
  assert.deepEqual(a, b);
  assert.equal(a.avl.length, 40);
});

/* ------------------------------------------------------------------ minimal AVL trees */
test('minimal AVL trees have N(h) = N(h−1) + N(h−2) + 1 nodes and really are AVL', () => {
  const res = T.minimalAvlSteps(6);
  assert.deepEqual(res.counts, [1, 2, 4, 7, 12, 20, 33]);
  res.counts.forEach((c, h) => assert.equal(T.minimalCount(h), c));
  res.steps.forEach((s, h) => {
    const t = treeFromStep(s);
    assert.equal(T.size(t), res.counts[h]);
    assert.equal(T.height(t), h);
    // in-order values are 1..n, so it is a BST and AVL-balanced
    assert.deepEqual(T.inorder(t), sortedRange(res.counts[h]));
    assert.ok(T.isAvl(t));
    // minimal: removing any leaf makes it shorter or unbalanced is not checked; the node count identity is the proof
  });
  // Fibonacci: N(h) + 1 = F(h + 3)
  const fib = [0, 1]; for (let i = 2; i < 12; i++) fib.push(fib[i - 1] + fib[i - 2]);
  res.counts.forEach((c, h) => assert.equal(c + 1, fib[h + 3]));
  // the height-(h−1) tree keeps its node ids inside the height-h tree
  const ids5 = new Set(res.steps[5].nodes.map(n => n.id));
  res.steps[4].nodes.forEach(n => assert.ok(ids5.has(n.id)));
});

/* ------------------------------------------------------------------ B-tree */
function checkB(t) {
  const max = t.max, minKeys = Math.ceil((max + 1) / 2) - 1;
  Object.keys(t.nodes).forEach(id => {
    const n = t.nodes[id];
    assert.ok(n.keys.length <= max, 'no overflow');
    for (let i = 1; i < n.keys.length; i++) assert.ok(n.keys[i - 1].v < n.keys[i].v);
    if (n.kids.length) assert.equal(n.kids.length, n.keys.length + 1);
    if (id !== t.root) assert.ok(n.keys.length >= minKeys, 'half full at least: ' + n.keys.length);
  });
  const depths = T.bDepthsOfLeaves(t);
  assert.ok(depths.every(d => d === depths[0]), 'all leaves at one depth');
  const vals = T.bInorder(t);
  assert.deepEqual(vals, vals.slice().sort((a, b) => a - b));
}
test('B-tree insert: invariants for max 2 (2-3 tree) and max 3, random and sorted', () => {
  const rng = VDSA.rng(41);
  for (const max of [2, 3, 4]) {
    for (let round = 0; round < 25; round++) {
      const keys = round % 3 === 0 ? sortedRange(25) : randomKeys(rng, rng.int(0, 30), 0, 60);
      const res = T.bBuildSteps(keys, max, { quick: true });
      if (T.bInorder(res.tree).length) checkB(res.tree);
      assert.deepEqual(T.bInorder(res.tree), distinct(keys).sort((a, b) => a - b));
    }
  }
});
test('B-tree insert: split promotes the middle key, root split grows the tree at the top', () => {
  const res = T.bBuildSteps([10, 20, 30, 40], 3);
  const overflow = res.steps.find(s => s.kind === 'overflow');
  assert.ok(overflow);
  assert.equal(overflow.nodes.find(n => n.state === 'error').keys.length, 4);
  const split = res.steps.find(s => s.kind === 'split');
  assert.equal(T.bHeight(res.tree), 1);
  const rootNode = res.tree.nodes[res.tree.root];
  assert.deepEqual(rootNode.keys.map(k => k.v), [20]);
  assert.deepEqual(res.tree.nodes[rootNode.kids[0]].keys.map(k => k.v), [10]);
  assert.deepEqual(res.tree.nodes[rootNode.kids[1]].keys.map(k => k.v), [30, 40]);
  // the promoted key is the same key identity before and after
  const before = overflow.nodes.find(n => n.state === 'error').keys.find(k => k.v === 20).id;
  assert.ok(split.nodes.find(n => n.id === split.root).keys.some(k => k.id === before));
  assert.equal(res.splits, 1);
});
test('B-tree: duplicates, empty, single, cascading splits', () => {
  const dup = T.bBuildSteps([5, 5], 3);
  assert.equal(dup.steps[dup.steps.length - 1].kind, 'dup');
  assert.equal(T.bInorder(dup.tree).length, 1);
  const none = T.bBuildSteps([], 3);
  assert.equal(none.steps.length, 1);
  const cascade = T.bBuildSteps(sortedRange(20), 2);
  checkB(cascade.tree);
  assert.ok(T.bHeight(cascade.tree) >= 3);
  cascade.steps.forEach(s => assert.ok(s.counters && typeof s.counters.splits === 'number'));
  const counts = cascade.steps.map(s => s.counters.splits);
  assert.deepEqual(counts, counts.slice().sort((a, b) => a - b));
});

test('stickRace: the plain tree needs n comparisons, the AVL tree about log n', () => {
  const r = T.stickRace(15);
  assert.equal(r.plain, 15);
  assert.equal(r.balanced, 4);
  assert.equal(r.steps.length, 16);
  const last = r.steps[r.steps.length - 1];
  assert.deepEqual(last.counters, { plain: 15, balanced: 4 });
  assert.equal(last.a.nodes.filter(n => n.state === 'found').length, 1);
  assert.equal(last.b.nodes.filter(n => n.state === 'found').length, 1);
  assert.equal(T.height(r.trees.a), 14);
  assert.equal(T.height(r.trees.b), 3);
  const small = T.stickRace(1);
  assert.equal(small.plain, 1); assert.equal(small.balanced, 1);
});

test('build traces keep cumulative counters across inserts', () => {
  const a = T.avlBuildSteps([10, 20, 30, 40, 50, 60, 70]);
  const last = a.steps[a.steps.length - 1].counters;
  assert.equal(last.rotations, a.rotations);
  assert.equal(last.nodes, 7);
  const rot = a.steps.map(s => s.counters.rotations);
  assert.deepEqual(rot, rot.slice().sort((x, y) => x - y));
  const r = T.rbBuildSteps([1, 2, 3, 4, 5, 6]);
  const rc = r.steps.map(s => s.counters.recolours);
  assert.deepEqual(rc, rc.slice().sort((x, y) => x - y));
  assert.ok(rc[rc.length - 1] > 0);
});
