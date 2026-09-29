/* Lesson 08 · Linked lists — tests for js/algos/08-linked-lists.js
   Run: node --test tests/algos/08-linked-lists.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const A = require(path.join(__dirname, '..', '..', 'js', 'algos', '08-linked-lists.js'));
const VDSA = require(path.join(__dirname, '..', '..', 'js', 'vdsa', 'core.js'));

/* ------------------------------------------------------------------ helpers */
function walk(step, limit = 64) {
  const byId = {};
  step.nodes.forEach(n => { byId[n.id] = n; });
  const out = [];
  let c = step.head;
  const seen = new Set();
  while (c !== null && c !== undefined && byId[c] && !seen.has(c) && out.length < limit) { seen.add(c); out.push(byId[c].value); c = byId[c].next; }
  return { values: out, cycle: c !== null && c !== undefined && seen.has(c) };
}
function randomList(rng, maxLen = 8) {
  const n = rng.int(0, maxLen);
  return Array.from({ length: n }, () => rng.int(-9, 20));
}
const STATES = new Set(['default', 'active', 'compare', 'swap', 'done', 'found', 'visited', 'frontier', 'path', 'pivot', 'key', 'error', 'muted']);

/* Every snapshot must be drawable on its own: unique ids, links to existing nodes, known states. */
function checkListSnapshot(s, where) {
  assert.ok(Array.isArray(s.nodes), where + ': nodes array');
  const ids = s.nodes.map(n => String(n.id));
  assert.equal(new Set(ids).size, ids.length, where + ': unique ids');
  const has = new Set(ids);
  s.nodes.forEach(n => {
    assert.ok(n.next === null || has.has(String(n.next)), where + ': next of ' + n.id + ' exists');
    if (n.prev !== undefined) assert.ok(n.prev === null || has.has(String(n.prev)), where + ': prev of ' + n.id + ' exists');
    if (n.state) assert.ok(STATES.has(n.state), where + ': state ' + n.state);
    if (n.nextState) assert.ok(STATES.has(n.nextState), where + ': nextState ' + n.nextState);
  });
  assert.ok(s.head === null || has.has(String(s.head)), where + ': head exists');
  (s.pointers || []).forEach(p => {
    assert.ok(p.target === null || has.has(String(p.target)), where + ': pointer ' + p.name + ' target exists');
    assert.ok(STATES.has(p.state || 'active'), where + ': pointer state');
  });
}
function checkTrace(steps, where, labels) {
  assert.ok(steps.length >= 2 || steps.length === 1, where + ': has steps');
  const keys = JSON.stringify(Object.keys(steps[0].counters || {}));
  steps.forEach((s, k) => {
    checkListSnapshot(s, where + ' step ' + k);
    assert.equal(typeof s.caption, 'string', where + ': caption');
    assert.ok(s.caption.length > 5, where + ': caption text');
    assert.equal(JSON.stringify(Object.keys(s.counters || {})), keys, where + ': same counter keys on every step');
    if (labels && s.line) assert.ok(labels.includes(s.line), where + ': unknown line label ' + s.line);
  });
  // snapshots are frozen: mutating one must not change another (no shared mutable node objects)
  const before = JSON.stringify(steps.map(s => s.nodes));
  steps[0].nodes.forEach(n => { n.__probe = 1; });
  steps[0].nodes.forEach(n => { delete n.__probe; });
  assert.equal(JSON.stringify(steps.map(s => s.nodes)), before, where + ': snapshots independent');
}

/* Reference implementations on plain arrays */
const ref = {
  insertAt: (a, i, x) => { const b = a.slice(); b.splice(i, 0, x); return b; },
  del: (a, x) => { const b = a.slice(); const k = b.indexOf(x); if (k >= 0) b.splice(k, 1); return b; },
  search: (a, x) => a.indexOf(x)
};

const LABELS = {
  insertHead: ['alloc', 'link', 'head'],
  insertAt: ['alloc', 'check0', 'link0', 'head', 'start', 'walk', 'hop', 'link', 'splice'],
  appendWalk: ['alloc', 'empty', 'head', 'start', 'walk', 'hop', 'splice'],
  appendTail: ['alloc', 'empty', 'head', 'splice', 'tail'],
  delete: ['empty', 'none', 'checkHead', 'dropHead', 'doneHead', 'start', 'walk', 'cmp', 'bypass', 'done', 'hop', 'absent'],
  search: ['start', 'walk', 'cmp', 'found', 'hop', 'absent']
};

/* ------------------------------------------------------------------ operations lab */
test('insert at head / at index / append match the array reference (random + edge cases)', () => {
  const rng = VDSA.rng(8);
  const cases = [[], [5], [3, 3, 3], [1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1]];
  for (let t = 0; t < 150; t++) cases.push(randomList(rng, 7));
  for (const a of cases) {
    const x = rng.int(-9, 20);
    const h = A.opInsertHead(a, x);
    checkTrace(h, 'insertHead ' + a, LABELS.insertHead);
    assert.deepEqual(walk(h.at(-1)).values, [x, ...a]);
    assert.deepEqual(h.at(-1).result, [x, ...a]);
    assert.deepEqual(h.at(-1).counters, { hops: 0, compares: 0, writes: 2 });
    for (let i = 0; i <= a.length; i++) {
      const s = A.opInsertAt(a, i, x);
      checkTrace(s, 'insertAt ' + a + ' @' + i, LABELS.insertAt);
      assert.deepEqual(walk(s.at(-1)).values, ref.insertAt(a, i, x), 'insertAt ' + a + ' @' + i);
      assert.equal(s.at(-1).counters.writes, 2);
      assert.equal(s.at(-1).counters.hops, Math.max(0, i - 1), 'hops to reach index i - 1');
      // the first write is flagged (for the "which pointer first?" checkpoint)
      assert.equal(s.filter(st => st.firstWrite).length, 1);
    }
    const w = A.opAppend(a, x, false);
    checkTrace(w, 'appendWalk ' + a, LABELS.appendWalk);
    assert.deepEqual(walk(w.at(-1)).values, [...a, x]);
    assert.equal(w.at(-1).counters.hops, Math.max(0, a.length - 1));
    assert.equal(w.at(-1).counters.writes, 1);
    const tl = A.opAppend(a, x, true);
    checkTrace(tl, 'appendTail ' + a, LABELS.appendTail);
    assert.deepEqual(walk(tl.at(-1)).values, [...a, x]);
    assert.equal(tl.at(-1).counters.hops, 0);
    assert.equal(tl.at(-1).counters.writes, 2);
    const tailPtr = tl.at(-1).pointers.find(p => p.name === 'tail');
    assert.equal(tl.at(-1).nodes.find(n => n.id === tailPtr.target).value, x, 'tail ends on the new node');
  }
});

test('new node stays detached until it is reachable, and is "done" only at the end', () => {
  for (const [a, i] of [[[4, 7, 9], 0], [[4, 7, 9], 2], [[4, 7, 9], 3], [[], 0]]) {
    const s = A.opInsertAt(a, i, 5);
    s.forEach((st, k) => {
      const node = st.nodes.find(n => n.id === A.NEW_ID);
      if (!node) return;
      const reach = walk(st).values.length === a.length + 1;
      if (node.detached) assert.ok(k < s.length - 1, 'detached before the end');
      if (node.state === 'done') assert.equal(k, s.length - 1, 'done only on the final step');
      if (k === s.length - 1) assert.ok(reach && !node.detached);
    });
  }
});

test('delete by value matches the reference, covers head / tail / absent / empty / duplicates', () => {
  const rng = VDSA.rng(80);
  const cases = [[[], 3], [[3], 3], [[3], 4], [[4, 7, 9], 4], [[4, 7, 9], 9], [[4, 7, 9], 7], [[4, 7, 9], 99], [[5, 5, 5], 5], [[1, 2, 1], 1]];
  for (let t = 0; t < 200; t++) { const a = randomList(rng, 8); cases.push([a, rng.pick(a.length && rng() < 0.7 ? a : [100])]); }
  for (const [a, x] of cases) {
    const s = A.opDelete(a, x);
    checkTrace(s, 'delete ' + x + ' from ' + a, LABELS.delete);
    const expect = ref.del(a, x);
    assert.deepEqual(walk(s.at(-1)).values, expect, 'delete ' + x + ' from ' + a);
    assert.equal(s.at(-1).deleted, a.includes(x));
    assert.equal(s.at(-1).counters.writes, a.includes(x) ? 1 : 0);
    assert.equal(s.at(-1).counters.compares, a.includes(x) ? a.indexOf(x) + 1 : a.length);
    // every step carries a flowchart node id
    s.forEach(st => assert.ok(['start', 'empty', 'none', 'head', 'dropHead', 'init', 'walk', 'cmp', 'bypass', 'hop', 'absent'].includes(st.flow), 'flow id ' + st.flow));
    // a node is "error" only while it is being cut out, and it is gone at the end
    if (a.includes(x)) {
      const cut = s.findIndex(st => st.kind === 'bypass' || st.kind === 'dropHead');
      assert.ok(cut > 0);
      assert.equal(s.at(-1).nodes.length, a.length - 1, 'victim removed');
      // in the cut step the list from head already skips the victim, but the victim still exists
      assert.deepEqual(walk(s[cut]).values, expect);
      assert.equal(s[cut].nodes.length, a.length);
    }
  }
});

test('search returns the first index or -1, visiting exactly the nodes before it', () => {
  const rng = VDSA.rng(81);
  for (let t = 0; t < 200; t++) {
    const a = randomList(rng, 8), x = rng.int(-9, 20);
    const s = A.opSearch(a, x);
    checkTrace(s, 'search', LABELS.search);
    assert.equal(s.at(-1).result, ref.search(a, x));
    const k = ref.search(a, x);
    assert.equal(s.at(-1).counters.compares, k >= 0 ? k + 1 : a.length);
    assert.equal(s.at(-1).counters.hops, k >= 0 ? k : a.length);
    const found = s.filter(st => st.nodes.some(n => n.state === 'found'));
    assert.equal(found.length, k >= 0 ? 1 : 0, 'found appears only on the hit');
  }
});

test('get(i) walks exactly i hops', () => {
  const a = [4, 7, 9, 12, 15, 21];
  for (let i = 0; i < a.length; i++) {
    const s = A.opGet(a, i);
    checkTrace(s, 'get ' + i);
    assert.equal(s.at(-1).result, a[i]);
    assert.equal(s.at(-1).counters.hops, i);
    assert.equal(s.length, i + 2);
  }
});

test('validateOp gives friendly errors', () => {
  assert.equal(A.validateOp('insertAt', [1, 2], { x: 3, i: 2 }), null);
  assert.match(A.validateOp('insertAt', [1, 2], { x: 3, i: 3 }), /between 0 and 2/);
  assert.match(A.validateOp('insertAt', [1, 2], { x: 3, i: -1 }), /between 0 and 2/);
  assert.match(A.validateOp('delete', [1], { x: 1.5 }), /whole number/);
  assert.match(A.validateOp('delete', [1], { x: 500 }), /between/);
  assert.match(A.validateOp('insertHead', [1, 2, 3, 4, 5, 6, 7, 8], { x: 1 }), /full/);
  assert.equal(A.validateOp('delete', [1, 2, 3, 4, 5, 6, 7, 8], { x: 1 }), null);
  assert.match(A.validateOp('search', [1, 2, 3, 4, 5, 6, 7, 8, 9], { x: 1 }), /at most/);
  for (const op of ['insertHead', 'insertAt', 'appendWalk', 'appendTail', 'delete', 'search']) {
    const s = A.labSteps(op, [3, 1, 4], { x: 1, i: 1 });
    checkTrace(s, 'labSteps ' + op, LABELS[op]);
  }
});

/* ------------------------------------------------------------------ wrong order vs right order */
test('right order splices; wrong order loses the tail and makes a self-loop', () => {
  const a = [4, 7, 9, 12, 15];
  for (let i = 1; i < a.length; i++) {
    const right = A.spliceOrderSteps(a, i, 8, 'right');
    checkTrace(right, 'right ' + i);
    assert.deepEqual(walk(right.at(-1)).values, ref.insertAt(a, i, 8));
    assert.ok(right.every(s => s.counters.lost === 0), 'nothing is ever lost in the right order');
    const wrong = A.spliceOrderSteps(a, i, 8, 'wrong');
    checkTrace(wrong, 'wrong ' + i);
    const last = wrong.at(-1), w = walk(last);
    assert.equal(w.cycle, true, 'the walk from head loops');
    assert.deepEqual(w.values, [...a.slice(0, i), 8]);
    const node = last.nodes.find(n => n.id === A.NEW_ID);
    assert.equal(node.next, A.NEW_ID, 'the new node points at itself');
    assert.equal(last.counters.lost, a.length - i);
    const lostStep = wrong.find(s => s.kind === 'lost');
    lostStep.lostIds.forEach(id => {
      const n = lostStep.nodes.find(m => m.id === id);
      assert.equal(n.state, 'muted');
      assert.ok(n.y > 0, 'lost nodes float below the row');
    });
  }
});

/* ------------------------------------------------------------------ reversal */
test('reversal reverses every input in place with n flips + 1 head write', () => {
  const rng = VDSA.rng(88);
  const cases = [[], [1], [2, 2], [1, 2, 3, 4, 5, 6, 7, 8]];
  for (let t = 0; t < 100; t++) cases.push(randomList(rng, 8));
  for (const a of cases) {
    const s = A.reverseSteps(a);
    checkTrace(s, 'reverse ' + a, ['init', 'loop', 'save', 'flip', 'advPrev', 'advCurr', 'head']);
    assert.deepEqual(walk(s.at(-1)).values, a.slice().reverse());
    assert.deepEqual(s.at(-1).result, a.slice().reverse());
    assert.deepEqual(s.at(-1).counters, { loops: a.length, writes: a.length + 1 });
    assert.equal(s.filter(st => st.kind === 'flip').length, a.length);
    // node identity never changes: same ids, values attached to the same ids
    const ids0 = s[0].nodes.map(n => n.id + ':' + n.value).sort(), ids1 = s.at(-1).nodes.map(n => n.id + ':' + n.value).sort();
    assert.deepEqual(ids0, ids1);
    // after every step the nodes reachable from head plus those reachable from `next` cover the whole list
    s.forEach((st, k) => {
      if (st.kind !== 'flip') return;
      const nextPtr = st.pointers.find(p => p.name === 'next');
      const fromNext = walk({ nodes: st.nodes, head: nextPtr.target }).values.length;
      const prevPtr = st.pointers.find(p => p.name === 'prev');
      const fromCurr = walk({ nodes: st.nodes, head: st.pointers.find(p => p.name === 'curr').target }).values.length;
      assert.equal(fromNext + fromCurr, a.length, 'no node lost at flip step ' + k);
      void prevPtr;
    });
  }
});

test('the hero teaser loop ends exactly where it starts', () => {
  const s = A.teaserSteps([3, 7, 1, 9, 4]);
  const first = s[0], last = s.at(-1);
  assert.deepEqual(last.nodes.map(n => [n.id, n.next]), first.nodes.map(n => [n.id, n.next]));
  assert.deepEqual(last.order, first.order);
  assert.equal(last.head, first.head);
  s.forEach((st, k) => checkListSnapshot(st, 'teaser ' + k));
  const mid = s.find(st => st.note && st.note.indexOf('4 → 9 → 1 → 7 → 3') === 0);
  assert.ok(mid, 'passes through the reversed list');
});

/* ------------------------------------------------------------------ fast & slow */
test('middle node: slow ends at index floor(n / 2)', () => {
  for (let n = 0; n <= 9; n++) {
    const a = Array.from({ length: n }, (_, i) => i * 3);
    const s = A.middleSteps(a);
    s.forEach((st, k) => checkListSnapshot(st, 'middle ' + n + ' step ' + k));
    assert.equal(s.at(-1).result, n ? Math.floor(n / 2) : null);
    if (n) assert.equal(s.at(-1).counters.moves, Math.floor(n / 2));
  }
});

test('Floyd: meeting point matches brute force, entry = mu after mu phase-2 steps', () => {
  for (let mu = 0; mu <= 8; mu++) {
    for (let lambda = 1; lambda <= 10; lambda++) {
      const s = A.floydSteps(mu, lambda), r = A.floydRef(mu, lambda);
      const meetIdx = s.findIndex(st => st.kind === 'meet');
      assert.ok(meetIdx > 0, 'they meet for mu=' + mu + ' lambda=' + lambda);
      const meetStep = s[meetIdx];
      assert.equal(meetStep.meet, r.meet);
      assert.equal(meetStep.counters.slow, r.slowSteps);
      assert.ok(meetStep.counters.slow <= mu + lambda, 'slow meets within mu + lambda steps');
      assert.equal(meetStep.counters.fast, 2 * meetStep.counters.slow);
      // first meeting: no earlier move step had them on the same node
      s.slice(1, meetIdx).forEach(st => assert.notEqual(st.slow, st.fast));
      // once both are on the loop the gap shrinks by exactly one per turn
      let prevGap = null;
      s.slice(0, meetIdx + 1).forEach(st => {
        if (st.gap !== null && prevGap !== null) assert.equal(st.gap, prevGap - 1, 'gap shrinks by one');
        prevGap = st.gap;
      });
      const last = s.at(-1);
      assert.equal(last.kind, 'entry');
      assert.equal(last.entry, mu);
      assert.equal(last.entry, r.entry);
      assert.equal(s.filter(st => st.kind === 'move2').length + (mu > 0 ? 1 : 0), mu, 'phase 2 takes mu steps');
      assert.equal(last.slow, last.fast);
    }
  }
});

test('Floyd without a cycle stops when the hare reaches the end; edge cases', () => {
  for (let mu = 0; mu <= 9; mu++) {
    const s = A.floydSteps(mu, 0);
    assert.equal(s.at(-1).kind, 'nocycle');
    assert.ok(s.every(st => st.meet === null));
    assert.equal(A.floydRef(mu, 0).entry, null);
  }
  const self = A.floydSteps(0, 1);          // one node pointing at itself
  assert.equal(self.find(st => st.kind === 'meet').meet, 0);
  assert.equal(self.at(-1).entry, 0);
  const head = A.floydSteps(0, 6);          // cycle at the head
  assert.equal(head.at(-1).entry, 0);
  assert.deepEqual(A.rhoNext(2, 3), [1, 2, 3, 4, 2]);
  assert.deepEqual(A.rhoNext(3, 0), [1, 2, null]);
});

/* ------------------------------------------------------------------ doubly, dummy, circular, copy trick */
function checkDoubly(step, where) {
  const byId = {};
  step.nodes.forEach(n => { byId[n.id] = n; });
  const chain = [];
  let c = step.head, prev = null;
  while (c !== null) { const n = byId[c]; assert.equal(n.prev, prev, where + ': prev of ' + c); chain.push(n.value); prev = c; c = n.next; }
  return chain;
}
test('doubly linked insert and delete keep next and prev consistent', () => {
  const a = [2, 5, 11, 14];
  for (let k = 0; k < a.length; k++) {
    const ins = A.doublyInsertSteps(a, k, 8);
    ins.forEach((st, j) => checkListSnapshot(st, 'dins ' + k + ' ' + j));
    assert.deepEqual(checkDoubly(ins.at(-1), 'insert after ' + k), ref.insertAt(a, k + 1, 8));
    assert.equal(ins.at(-1).counters.writes, k === a.length - 1 ? 3 : 4);
    const del = A.doublyDeleteSteps(a, k);
    del.forEach((st, j) => checkListSnapshot(st, 'ddel ' + k + ' ' + j));
    assert.deepEqual(checkDoubly(del.at(-1), 'delete ' + k), a.filter((_, i) => i !== k));
    assert.ok(del.at(-1).counters.writes <= 2);
  }
});

test('dummy-node delete equals the reference without a head special case', () => {
  const rng = VDSA.rng(808);
  for (let t = 0; t < 120; t++) {
    const a = randomList(rng, 7), x = a.length && rng() < 0.7 ? rng.pick(a) : 100;
    const s = A.dummyDeleteSteps(a, x);
    s.forEach((st, j) => checkListSnapshot(st, 'dummy ' + j));
    assert.deepEqual(s.at(-1).result, ref.del(a, x));
    assert.equal(s.at(-1).nodes[0].id, 'dummy', 'the dummy is never deleted');
  }
});

test('circular walk visits each node once; copy trick deletes all but the tail', () => {
  for (let n = 0; n <= 7; n++) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    const s = A.circularSteps(a);
    s.forEach((st, j) => checkListSnapshot(st, 'circ ' + j));
    assert.equal(s.at(-1).counters.visits, n);
    if (n) assert.equal(s.at(-1).nodes.find(nd => nd.id === 'c' + (n - 1)).next, 'c0', 'tail links back to head');
  }
  const a = [4, 7, 9, 12];
  for (let k = 0; k < a.length; k++) {
    const s = A.copyDeleteSteps(a, k);
    s.forEach((st, j) => checkListSnapshot(st, 'copy ' + j));
    if (k === a.length - 1) assert.equal(s.at(-1).kind, 'fail');
    else assert.deepEqual(s.at(-1).result, a.filter((_, i) => i !== k));
  }
});

/* ------------------------------------------------------------------ array vs list race and costs */
test('race totals follow the cost model for every operation and size', () => {
  for (let n = 2; n <= 8; n++) {
    const a = Array.from({ length: n }, (_, i) => 10 + i);
    const m = Math.floor(n / 2);
    const expect = {
      access: { array: 1, list: n - 2 },
      insertFront: { array: n + 1, list: 2 },
      insertMiddle: { array: n - m + 1, list: Math.max(0, m - 1) + 2 },
      append: { array: 1, list: n },
      deleteLast: { array: 1, list: n - 1 }
    };
    for (const op of Object.keys(expect)) {
      const s = A.raceSteps(op, a, 1);
      assert.deepEqual(s.totals, expect[op], op + ' n=' + n);
      assert.deepEqual(s.at(-1).counters, expect[op]);
      s.forEach((st, j) => {
        checkListSnapshot(st.list, op + ' list ' + j);
        assert.ok(Array.isArray(st.array.items));
        const ids = st.array.items.map(it => it.id);
        assert.equal(new Set(ids).size, ids.length, 'array ids unique');
        const slots = st.array.items.map(it => it.index);
        assert.equal(new Set(slots).size, slots.length, op + ': no two array items share a slot at step ' + j);
      });
      const listFinal = walk(s.at(-1).list).values;
      const arrFinal = s.at(-1).array.items.slice().sort((p, q) => p.index - q.index).map(it => it.value);
      if (op !== 'access') assert.deepEqual(listFinal, arrFinal, op + ': both sides end with the same sequence');
    }
  }
  assert.deepEqual(A.costOf('access', 10), { array: 1, list: 9 });
  assert.deepEqual(A.costOf('insertFront', 10), { array: 11, list: 2 });
});
