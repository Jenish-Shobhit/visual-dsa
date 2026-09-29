/* Tree studio model (js/labs/tree-studio-model.js): operations agree with plain references, the structures stay valid,
   frames are consistent, and URL state round-trips.
   Run: node --test tests/labs/tree-studio.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const M = require(path.join(ROOT, 'js', 'labs', 'tree-studio-model.js'));
const A = require(path.join(ROOT, 'js', 'algos', '20-balanced-trees.js'));
const H = require(path.join(ROOT, 'js', 'algos', '21-heaps.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));

const sortedNums = (a) => a.slice().sort((x, y) => x - y);
function valuesOf(S) {
  if (M.isTree(S.kind)) return A.inorder(S.data);
  if (M.isHeap(S.kind)) return S.data.map((i) => i.value);
  return S.data.slice().sort();
}

test('insert/delete/search agree with a Set on random operations, for every tree kind', () => {
  for (const kind of ['bst', 'avl', 'rb']) {
    const rng = core.rng(7);
    let S = M.create(kind);
    const ref = new Set();
    for (let i = 0; i < 120; i++) {
      const v = Math.floor(rng() * 40);
      const r = rng();
      if (r < 0.55) { const o = M.run(S, { op: 'insert', value: v }, { quick: true }); assert.equal(o.ok, !ref.has(v)); ref.add(v); S = o.state; }
      else if (r < 0.8) { const o = M.run(S, { op: 'delete', value: v }); assert.equal(o.ok, ref.has(v)); ref.delete(v); S = o.state; }
      else { const o = M.run(S, { op: 'search', value: v }); assert.equal(o.ok, ref.has(v)); S = o.state; }
      assert.deepEqual(valuesOf(S), sortedNums([...ref]), kind + ' step ' + i);
      assert.deepEqual(sortedNums(S.keys), sortedNums([...ref]));
      if (kind === 'avl') assert.ok(A.isAvl(S.data));
      if (kind === 'rb') assert.ok(A.isRedBlack(S.data));
    }
  }
});

test('heaps keep the heap property; extract returns values in order', () => {
  for (const kind of ['minheap', 'maxheap']) {
    const rng = core.rng(3);
    let S = M.create(kind);
    const vals = [];
    for (let i = 0; i < 30; i++) { const v = Math.floor(rng() * 20); vals.push(v); S = M.run(S, { op: 'insert', value: v }).state; assert.ok(H.isHeap(S.data.map((x) => x.value), kind === 'minheap' ? 'min' : 'max')); }
    const out = [];
    while (S.data.length) { out.push(S.data[0].value); S = M.run(S, { op: 'extract' }).state; }
    assert.deepEqual(out, kind === 'minheap' ? sortedNums(vals) : sortedNums(vals).reverse());
    assert.equal(M.run(S, { op: 'extract' }).ok, false);
    assert.equal(M.run(S, { op: 'delete', value: 1 }).ok, false);
  }
});

test('trie insert, search and delete', () => {
  let S = M.create('trie');
  ['tea', 'ten', 'to', 'tea'].forEach((w) => { S = M.run(S, { op: 'insert', value: w }).state; });
  assert.deepEqual(S.data.slice().sort(), ['tea', 'ten', 'to']);
  assert.equal(M.run(S, { op: 'search', value: 'ten' }).ok, true);
  assert.equal(M.run(S, { op: 'search', value: 'te' }).ok, false);
  S = M.run(S, { op: 'delete', value: 'ten' }).state;
  assert.deepEqual(S.data.slice().sort(), ['tea', 'to']);
  assert.equal(M.run(S, { op: 'delete', value: 'zzz' }).ok, false);
});

test('frames: totals only grow, counters match the picture, last frame is the resting tree', () => {
  for (const kind of M.ORDER) {
    let S = M.create(kind);
    const vals = M.KINDS[kind].word ? ['tea', 'ten', 'to', 'inn'] : [5, 3, 8, 1, 4, 7, 9, 2, 6];
    let prev = 0;
    for (const v of vals) {
      const o = M.run(S, { op: 'insert', value: v });
      let c = 0;
      o.frames.forEach((f) => { assert.ok(f.cmp >= c, kind + ' cmp grows within an op'); c = f.cmp; });
      assert.ok(o.frames[0].cmp >= prev);
      prev = o.state.cmp;
      const last = o.frames[o.frames.length - 1];
      const st = M.viewStats(last.view);
      assert.equal(last.height, st.height);
      assert.equal(M.viewStats(M.idle(o.state).view).height, st.height, kind + ' resting height');
      S = o.state;
    }
    assert.equal(S.heights.length, vals.length);
  }
});

test('AVL rotations are counted and stay 0 for a BST; sorted input makes a BST a stick', () => {
  const keys = []; for (let i = 1; i <= 15; i++) keys.push(i);
  const b = M.bulk(M.create('bst'), keys), a = M.bulk(M.create('avl'), keys), r = M.bulk(M.create('rb'), keys);
  assert.equal(M.heightOf(b.state), 14);
  assert.equal(M.heightOf(a.state), 3);
  assert.ok(M.heightOf(r.state) <= 6);
  assert.equal(b.state.rot, 0);
  assert.ok(a.state.rot > 0 && r.state.rot > 0);
  assert.equal(a.done, 15);
});

test('bulk: duplicates are skipped and frames are never empty', () => {
  const o = M.bulk(M.create('bst'), [5, 5, 3]);
  assert.equal(o.done, 2); assert.deepEqual(o.skipped, [5]);
  assert.ok(o.frames.length > 0);
  assert.ok(M.bulk(M.create('bst'), []).frames.length === 1);
});

test('caps refuse politely', () => {
  let S = M.create('minheap');
  for (let i = 0; i < 70; i++) S = M.run(S, { op: 'insert', value: i }, { quick: true }).state;
  assert.equal(S.data.length, 63);
});

test('parseValue / parseList', () => {
  assert.equal(M.parseValue('bst', ' 42 ').value, 42);
  assert.equal(M.parseValue('bst', '−7').value, -7);
  assert.ok(M.parseValue('bst', 'x').error);
  assert.ok(M.parseValue('bst', '5000').error);
  assert.equal(M.parseValue('trie', 'Tea').value, 'tea');
  assert.ok(M.parseValue('trie', 'a1').error);
  assert.ok(M.parseValue('trie', 'abcdefghij').error);
  assert.deepEqual(M.parseList('bst', '1, 2 3;4').values, [1, 2, 3, 4]);
});

test('URL state round-trips and rejects junk', () => {
  const q = M.encode({ kind: 'avl', keys: [50, 30, 70], compare: false });
  assert.equal(q, 's=avl&k=50,30,70');
  assert.deepEqual(M.decode('?' + q), { kind: 'avl', keys: [50, 30, 70], compare: false });
  assert.deepEqual(M.decode('?s=trie&k=tea,ten').keys, ['tea', 'ten']);
  assert.deepEqual(M.decode('?s=nope&k=1,x,3'), { kind: 'bst', keys: [], compare: false });
  assert.equal(M.decode('?c=1&k=1,2').compare, true);
  const S = M.replay('avl', [4, 2, 6]);
  assert.deepEqual(valuesOf(S), [2, 4, 6]);
});

test('orders() of a small BST', () => {
  const S = M.replay('bst', [4, 2, 6, 1, 3]);
  const o = M.orders(M.idle(S).view);
  const l = (a) => a.map((x) => x.label).join(' ');
  assert.equal(l(o.pre), '4 2 1 3 6'); assert.equal(l(o.inorder), '1 2 3 4 6');
  assert.equal(l(o.post), '1 3 2 6 4'); assert.equal(l(o.level), '4 2 6 1 3');
});
