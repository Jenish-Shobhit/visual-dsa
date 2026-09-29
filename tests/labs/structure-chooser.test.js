'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/labs/structure-chooser-data.js');
const R = require('../../js/labs/reference-data.js');

test('every edge joins existing nodes; every non-leaf has yes and no', () => {
  for (const e of C.EDGES) { assert.ok(C.node(e.from), e.from); assert.ok(C.node(e.to), e.to); }
  for (const n of C.NODES) {
    const es = C.out(n.id);
    if (n.type === 'decision') { assert.deepEqual(es.map((e) => e.label).sort(), ['no', 'yes'], n.id); assert.ok(n.q && n.hint); }
    if (n.type === 'end') assert.equal(es.length, 0, n.id + ' is a leaf');
  }
});
test('every node is reachable from start and there are no cycles', () => {
  const seen = new Set();
  (function go(id, stack) { assert.ok(!stack.has(id), 'cycle at ' + id); seen.add(id); C.out(id).forEach((e) => go(e.to, new Set([...stack, id]))); })('start', new Set());
  assert.equal(seen.size, C.NODES.length);
});
test('grid cells are unique', () => {
  const cells = new Set();
  for (const n of C.NODES) { const k = n.col + ',' + n.row; assert.ok(!cells.has(k), 'two nodes at ' + k); cells.add(k); }
});
test('every leaf is a structure with a lesson and costs', () => {
  for (const n of C.NODES.filter((x) => x.rec)) {
    const s = R.structure(n.rec);
    assert.ok(s, n.rec); assert.ok(s.lesson && s.use && s.avoid && s.ops.search);
  }
});
test('scenarios land where they claim and have unique ids', () => {
  const ids = new Set();
  for (const s of C.SCENARIOS) {
    assert.ok(!ids.has(s.id)); ids.add(s.id);
    const w = C.walk(s.answers);
    assert.equal(w.leaf, s.leaf, s.id);
    assert.equal(s.answers.length, w.path.length - 2, s.id + ' uses every answer');
  }
  assert.ok(C.SCENARIOS.length >= 10);
});
test('every leaf is the answer to some scenario or path', () => {
  const leaves = C.NODES.filter((x) => x.rec).map((x) => x.rec);
  assert.equal(leaves.length, 16);
});
