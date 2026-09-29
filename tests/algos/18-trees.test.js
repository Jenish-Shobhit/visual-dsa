/* Lesson 18 · Trees & traversals — step generator tests (node --test tests/algos/18-trees.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const A = require(path.join(ROOT, 'js', 'algos', '18-trees.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const COMBOS = [['pre', 'recursive'], ['in', 'recursive'], ['post', 'recursive'], ['pre', 'stack'], ['in', 'stack'], ['post', 'stack'], ['level', 'queue']];

/* ------------------------------------------------------------ independent references (nested-array trees) */
function toNested(t, id) { return id === null ? null : { v: t.nodes[id].value, id, l: toNested(t, t.nodes[id].left), r: toNested(t, t.nodes[id].right) }; }
const ref = {
  pre: (n) => (n ? [n.id, ...ref.pre(n.l), ...ref.pre(n.r)] : []),
  in: (n) => (n ? [...ref.in(n.l), n.id, ...ref.in(n.r)] : []),
  post: (n) => (n ? [...ref.post(n.l), ...ref.post(n.r), n.id] : []),
  level: (n) => { const out = []; const q = n ? [n] : []; while (q.length) { const x = q.shift(); out.push(x.id); if (x.l) q.push(x.l); if (x.r) q.push(x.r); } return out; },
  height: (n) => (n ? 1 + Math.max(ref.height(n.l), ref.height(n.r)) : -1),
  count: (n) => (n ? 1 + ref.count(n.l) + ref.count(n.r) : 0)
};

function randomLevelTokens(rng, n) {
  // grow a random tree by attaching each new node to a random open place, then read it out in level order
  const shape = { v: 1, l: null, r: null };
  const open = [[shape, 'l'], [shape, 'r']];
  for (let i = 2; i <= n; i++) {
    const k = rng.int(0, open.length - 1);
    const [p, side] = open.splice(k, 1)[0];
    const node = { v: i, l: null, r: null };
    p[side] = node;
    open.push([node, 'l'], [node, 'r']);
  }
  const out = []; const q = [shape];
  while (q.length) { const x = q.shift(); if (x === null) { out.push('#'); continue; } out.push(x.v); q.push(x.l, x.r); }
  while (out[out.length - 1] === '#') out.pop();
  return out;
}
function sampleTrees() {
  const trees = [
    ['single', A.fromLevel([7])],
    ['left chain', A.degenerate(6, 'left')],
    ['right chain', A.degenerate(6, 'right')],
    ['perfect 3', A.perfect(3)],
    ['complete 10', A.complete(10)],
    ['full not complete', A.fullNotComplete()],
    ['duplicates', A.fromLevel([5, 5, 5, 5, '#', 5])],
    ['textbook', A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F'])]
  ];
  const rng = core.rng(1810);
  for (let k = 0; k < 40; k++) trees.push(['random ' + k, A.fromLevel(randomLevelTokens(rng, rng.int(1, 15)))]);
  return trees;
}

/* ------------------------------------------------------------ building trees */
test('fromLevel builds level-order trees and skips # places', () => {
  const t = A.fromLevel([1, 2, 3, '#', 4, 5, 6]);
  assert.equal(A.size(t), 6);
  const one = t.nodes[t.nodes[t.root].left];
  assert.equal(one.value, 2); assert.equal(one.left, null); assert.equal(t.nodes[one.right].value, 4);
  assert.deepEqual(A.levelTokens(t), [1, 2, 3, '#', 4, 5, 6]);
  assert.equal(A.fromLevel([]).root, null);
  assert.equal(A.fromLevel(['#', 1]).root, null);
});
test('levelTokens is the inverse of fromLevel on random trees', () => {
  const rng = core.rng(4);
  for (let k = 0; k < 60; k++) {
    const toks = randomLevelTokens(rng, rng.int(1, 15));
    assert.deepEqual(A.levelTokens(A.fromLevel(toks)), toks);
  }
});
test('parseLevel validates input with friendly errors', () => {
  assert.equal(A.parseLevel('').error !== null, true);
  assert.match(A.parseLevel('# 1 2').error, /root/);
  assert.equal(A.parseLevel('1 2 3 # # 4 5 6 7').error, null);
  assert.match(A.parseLevel('1 # # 5').error, /Too many values/);
  assert.match(A.parseLevel('1 2 toolong').error, /too long/);
  assert.match(A.parseLevel('1 2 $').error, /not a value/);
  const big = A.parseLevel(Array.from({ length: 16 }, (_, i) => i + 1).join(' '));
  assert.match(big.error, /up to 15/);
  const ok = A.parseLevel('5, 3, 8, #, 4, null, 9');
  assert.equal(ok.error, null);
  assert.equal(A.size(ok.tree), 5);
  assert.equal(A.parseLevel('[1,2,3]').error, null);
  assert.equal(A.parseLevel('1 2 3 # #').error, null);            // trailing # are fine
  assert.equal(A.parseLevel('-4 A b').tree.nodes.n0.value, -4);
});
test('fromShape and shape builders agree with the facts', () => {
  const t = A.fromShape([1, [2, [4], [5]], [3, null, [6]]]);
  assert.deepEqual(A.levelTokens(t), [1, 2, 3, 4, 5, '#', 6]);
  assert.equal(A.size(A.perfect(3)), 15);
  assert.equal(A.height(A.perfect(3)), 3);
  assert.equal(A.height(A.degenerate(9)), 8);
  assert.equal(A.height(A.complete(20)), 4);
  assert.equal(A.height(A.fromLevel([])), -1);
});
test('shapeInfo classifies full, complete, perfect and degenerate trees', () => {
  const p = A.shapeInfo(A.perfect(2));
  assert.deepEqual([p.n, p.height, p.full, p.complete, p.perfect, p.degenerate], [7, 2, true, true, true, false]);
  const c = A.shapeInfo(A.complete(6));
  assert.deepEqual([c.full, c.complete, c.perfect], [false, true, false]);
  const c4 = A.shapeInfo(A.complete(4));
  assert.deepEqual([c4.full, c4.complete], [false, true]);
  const f = A.shapeInfo(A.fullNotComplete());
  assert.deepEqual([f.n, f.full, f.complete, f.perfect], [5, true, false, false]);
  const d = A.shapeInfo(A.degenerate(5, 'left'));
  assert.deepEqual([d.n, d.height, d.full, d.complete, d.degenerate], [5, 4, false, false, true]);
  const s = A.shapeInfo(A.fromLevel([1]));
  assert.deepEqual([s.full, s.complete, s.perfect, s.edges], [true, true, true, 0]);
  sampleTrees().forEach(([name, t]) => {
    const info = A.shapeInfo(t);
    assert.equal(info.edges, info.n - 1, name);
    assert.ok(info.height >= A.minHeight(info.n) && info.height <= A.maxHeight(info.n), name);
    if (info.perfect) assert.ok(info.complete && info.full, name);
  });
});
test('minHeight and maxHeight bound every tree; complete trees reach the minimum', () => {
  for (let n = 1; n <= 40; n++) {
    assert.equal(A.height(A.complete(n)), A.minHeight(n), 'complete ' + n);
    assert.equal(A.height(A.degenerate(n, 'right')), A.maxHeight(n));
  }
  assert.equal(A.minHeight(20), 4);
  assert.equal(A.minHeight(0), -1);
});
test('indexInfo matches heap numbering and the complete tree structure', () => {
  const n = 12, t = A.complete(n);
  for (let i = 0; i < n; i++) {
    const info = A.indexInfo(i, n);
    const node = t.nodes['n' + i];
    assert.equal(info.left, node.left === null ? null : Number(node.left.slice(1)), 'left of ' + i);
    assert.equal(info.right, node.right === null ? null : Number(node.right.slice(1)), 'right of ' + i);
    if (i > 0) assert.equal(info.parent, Math.floor((i - 1) / 2));
  }
  assert.equal(A.indexInfo(0, 5).parent, null);
  assert.equal(A.indexInfo(2, 5).left, null);
});
test('randomTree is a binary search tree of the right size', () => {
  const t = A.randomTree(30, core.rng(9));
  assert.equal(A.size(t), 30);
  const vals = A.valuesOf(t, A.inorder(t));
  assert.deepEqual(vals, Array.from({ length: 30 }, (_, i) => i + 1));
});

/* ------------------------------------------------------------ traversals */
test('reference orders agree with an independent implementation', () => {
  sampleTrees().forEach(([name, t]) => {
    const nested = toNested(t, t.root);
    assert.deepEqual(A.preorder(t), ref.pre(nested), name);
    assert.deepEqual(A.inorder(t), ref.in(nested), name);
    assert.deepEqual(A.postorder(t), ref.post(nested), name);
    assert.deepEqual(A.levelorder(t), ref.level(nested), name);
  });
});
test('textbook example', () => {
  const t = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F']);
  const o = A.orders(t);
  assert.equal(A.valuesOf(t, o.pre).join(''), 'ABDECF');
  assert.equal(A.valuesOf(t, o.in).join(''), 'DBEACF');
  assert.equal(A.valuesOf(t, o.post).join(''), 'DEBFCA');
  assert.equal(A.valuesOf(t, o.level).join(''), 'ABCDEF');
});
test('the Euler tour touches every node three times and yields all three orders', () => {
  sampleTrees().forEach(([name, t]) => {
    const stops = A.eulerStops(t);
    assert.equal(stops.length, 3 * A.size(t), name);
    ['pre', 'in', 'post'].forEach((kind) => {
      assert.deepEqual(stops.filter((s) => s.kind === kind).map((s) => s.id), A[{ pre: 'preorder', in: 'inorder', post: 'postorder' }[kind]](t), name + ' ' + kind);
    });
    // every node's stops are in the order pre, in, post
    const pos = A.stopPositions(t);
    Object.keys(t.nodes).forEach((id) => { assert.ok(pos[id + ':pre'] < pos[id + ':in'] && pos[id + ':in'] < pos[id + ':post'], name); });
  });
});

function checkTrace(name, t, order, method) {
  const res = A.run(t, order, method);
  const steps = res.steps;
  const nested = toNested(t, t.root);
  const expected = ref[order](nested);
  const tag = name + ' ' + order + '/' + method;
  assert.deepEqual(res.out, expected, tag + ' output');
  assert.deepEqual(steps[steps.length - 1].out, expected, tag + ' final snapshot');
  const ids = new Set(t.order);
  const countersKeys = JSON.stringify(Object.keys(steps[0].counters));
  let prevOut = 0, peak = 0;
  steps.forEach((s, i) => {
    assert.equal(s.nodes.length, ids.size, tag + ' nodes step ' + i);
    assert.ok(s.caption && s.caption.length > 10, tag + ' caption ' + i);
    assert.equal(JSON.stringify(Object.keys(s.counters)), countersKeys, tag + ' counters keys ' + i);
    // output only grows, by at most one node per step, and follows the reference prefix
    assert.ok(s.out.length >= prevOut && s.out.length <= prevOut + 1, tag + ' out grows ' + i);
    assert.deepEqual(s.out, expected.slice(0, s.out.length), tag + ' prefix ' + i);
    prevOut = s.out.length;
    // truthful colours: done/swap only for nodes that are really in the output; everything in the output is done or swap
    const outSet = new Set(s.out);
    s.nodes.forEach((n) => {
      assert.ok(STATES.has(n.state), tag + ' state ' + n.state);
      if (n.state === 'done' || n.state === 'swap') assert.ok(outSet.has(n.id), tag + ' colour claims visited ' + n.id + ' at ' + i);
      if (outSet.has(n.id)) assert.ok(n.state === 'done' || n.state === 'swap', tag + ' visited node ' + n.id + ' not coloured at ' + i);
    });
    // swap = the one written this step
    const swaps = s.nodes.filter((n) => n.state === 'swap').map((n) => n.id);
    if (s.kind === 'visit') assert.deepEqual(swaps, [s.out[s.out.length - 1]], tag + ' visit swap ' + i);
    else assert.deepEqual(swaps, [], tag + ' no swap outside visit ' + i);
    // frames / stack / queue sizes stay within the tree's bounds and match the counters
    if (method === 'recursive') {
      assert.equal(s.frames.length, s.counters.depth, tag + ' depth ' + i);
      assert.ok(s.frames.length <= A.height(t) + 1, tag + ' depth bound');
      // the frames form a root-to-node chain
      s.frames.forEach((f, k) => { if (k) assert.ok(s.edges[s.frames[k - 1].id.slice(1) + '-' + f.id.slice(1)] === 'path', tag + ' chain ' + i); });
      peak = Math.max(peak, s.frames.length);
    } else if (method === 'stack') { assert.equal(s.stack.length, s.counters.stackSize, tag + ' stack size ' + i); peak = Math.max(peak, s.stack.length); }
    else { assert.equal(s.queue.length, s.counters.queueSize, tag + ' queue size ' + i); peak = Math.max(peak, s.queue.length); }
    assert.equal(s.counters.visited, s.out.length, tag + ' visited counter');
    assert.equal(s.counters.peak >= (s.counters.depth || s.counters.stackSize || s.counters.queueSize || 0), true, tag + ' peak counter');
    // the pointer, when present, is on a real node
    s.pointers.forEach((p) => assert.ok(ids.has(p.target), tag + ' pointer target'));
    if (s.tour !== null && s.tour !== undefined) assert.ok(s.tour >= 0 && s.tour <= 3 * ids.size + 1, tag + ' tour range');
  });
  assert.equal(res.peak, peak, tag + ' reported peak');
  assert.equal(steps[steps.length - 1].counters.peak, peak, tag + ' final peak counter');
  // no node may be on the stack/queue twice at once
  steps.forEach((s) => {
    const list = (method === 'stack' ? s.stack : method === 'queue' ? s.queue : []).map((x) => x.nid);
    assert.equal(new Set(list).size, list.length, tag + ' duplicates on structure');
  });
  return res;
}

test('every traversal, in every implementation, produces the reference order on many trees', () => {
  sampleTrees().forEach(([name, t]) => {
    COMBOS.forEach(([order, method]) => checkTrace(name, t, order, method));
  });
});
test('the empty tree traces to a single explanatory step', () => {
  const t = A.fromLevel([]);
  COMBOS.forEach(([order, method]) => {
    const r = A.run(t, order, method);
    assert.equal(r.steps.length, method === 'recursive' ? 2 : 1, order + method);
    assert.deepEqual(r.out, []);
  });
});
test('recursive traces: three steps per node, and the token walks the Euler tour in order', () => {
  sampleTrees().forEach(([name, t]) => {
    const n = A.size(t);
    ['pre', 'in', 'post'].forEach((order) => {
      const steps = A.traceSteps(t, order, 'recursive');
      assert.equal(steps.length, 3 * n + 2, name + order);           // start + (call, visit, return) per node + end
      let last = 0;
      steps.forEach((s, i) => { assert.ok(s.tour >= last, name + ' token never goes backwards ' + i); last = s.tour; });
      assert.equal(steps[0].tour, 0);
      assert.equal(steps[steps.length - 1].tour, 3 * n + 1);
      // a visit happens exactly at the token's stop of the matching kind
      const stops = A.eulerStops(t);
      steps.filter((s) => s.kind === 'visit').forEach((s) => {
        const stop = stops[s.tour - 1];
        assert.equal(stop.kind, order, name + ' visit at the ' + order + ' dot');
        assert.equal(stop.id, s.out[s.out.length - 1], name + ' visit at the right node');
      });
    });
  });
});
test('call stack depth is height + 1 for recursion; queue peak matches the widest level', () => {
  sampleTrees().forEach(([name, t]) => {
    ['pre', 'in', 'post'].forEach((order) => assert.equal(A.run(t, order, 'recursive').peak, A.height(t) + 1, name));
    assert.equal(A.run(t, 'level', 'queue').peak, A.peakQueue(t), name);
    assert.equal(A.peakStack(t), A.height(t) + 1);
    // the widest level is a lower bound for the queue; the queue never holds more than n
    assert.ok(A.peakQueue(t) >= Math.max(...A.levelWidths(t)) - (A.size(t) > 1 ? 0 : 0) || A.size(t) === 1, name);
    assert.ok(A.peakQueue(t) <= A.size(t), name);
  });
  const perfect = A.perfect(4), chain = A.degenerate(15, 'left');
  assert.equal(A.peakStack(perfect), 5);
  assert.equal(A.peakQueue(perfect), 16);
  assert.equal(A.peakStack(chain), 15);
  assert.equal(A.peakQueue(chain), 1);
  // explicit stacks never hold more than the call stack would (plus at most one waiting sibling per level)
  assert.ok(A.peakExplicitStack(perfect, 'pre') <= A.height(perfect) + 2);
  assert.ok(A.peakExplicitStack(chain, 'in') === 15);
});
test('single node and chains give tiny, correct traces', () => {
  const one = A.fromLevel(['X']);
  COMBOS.forEach(([order, method]) => assert.deepEqual(A.run(one, order, method).out, ['n0']));
  const chain = A.degenerate(5, 'left');
  assert.deepEqual(A.run(chain, 'in', 'stack').out, A.inorder(chain));
  assert.deepEqual(A.valuesOf(chain, A.run(chain, 'pre', 'recursive').out), [1, 2, 3, 4, 5]);
  assert.deepEqual(A.valuesOf(chain, A.run(chain, 'post', 'stack').out), [5, 4, 3, 2, 1]);
});
test('every step line label exists in every language of its code', () => {
  const langs = ['pseudo', 'js', 'py'];
  COMBOS.forEach(([order, method]) => {
    const key = A.codeKey(order, method);
    assert.ok(A.CODE[key], key);
    const parsed = {};
    langs.forEach((l) => { parsed[l] = code.parse(A.CODE[key][l], l === 'pseudo' ? 'pseudo' : l).labels; });
    sampleTrees().slice(0, 12).forEach(([name, t]) => {
      A.run(t, order, method).steps.forEach((s) => {
        if (s.line === null || s.line === undefined) return;
        [].concat(s.line).forEach((lab) => langs.forEach((l) => assert.ok(parsed[l][lab] && parsed[l][lab].length, key + ' ' + l + ' lacks label ' + lab + ' (' + name + ')')));
      });
    });
  });
});
test('compute code labels exist in every language', () => {
  const langs = ['pseudo', 'js', 'py'];
  ['height', 'count', 'eval', 'folder'].forEach((key) => {
    const parsed = {};
    langs.forEach((l) => { parsed[l] = code.parse(A.CODE[key][l], l).labels; });
    const t = key === 'eval' ? A.fromShape(['×', ['+', [3], [4]], ['−', [5], [2]]]) : A.fromLevel([1, 2, 3, 4, '#', 5]);
    const steps = key === 'folder' ? A.folderSteps({ id: 'r', label: 'root', children: [{ id: 'a', label: 'a', size: 3 }, { id: 'b', label: 'b', children: [{ id: 'c', label: 'c', size: 4 }] }] }).steps : A.computeSteps(t, key).steps;
    steps.forEach((s) => { if (s.line) [].concat(s.line).forEach((lab) => langs.forEach((l) => assert.ok(parsed[l][lab], key + ' ' + l + ' ' + lab))); });
  });
});

/* ------------------------------------------------------------ Euler walk figure */
test('eulerSteps: the three output rows grow with the token and end as the three orders', () => {
  sampleTrees().forEach(([name, t]) => {
    const steps = A.eulerSteps(t), n = A.size(t);
    assert.equal(steps.length, 3 * n + 2, name);
    const stops = A.eulerStops(t);
    steps.forEach((s, i) => {
      assert.equal(s.tour, i, name);
      if (i >= 1 && i <= 3 * n) assert.equal(s.cur, stops[i - 1].id, name);
      const total = s.rows.pre.length + s.rows.in.length + s.rows.post.length;
      assert.equal(total, Math.min(i, 3 * n), name + ' rows grow one dot at a time');
      // a node is done only after its post dot
      s.nodes.forEach((nd) => { if (nd.state === 'done') assert.ok(s.rows.post.includes(nd.id), name); });
    });
    const last = steps[steps.length - 1];
    assert.deepEqual(last.rows.pre, A.preorder(t), name);
    assert.deepEqual(last.rows.in, A.inorder(t), name);
    assert.deepEqual(last.rows.post, A.postorder(t), name);
  });
});

/* ------------------------------------------------------------ postorder computations */
test('computeSteps returns the reference height, count and expression value', () => {
  sampleTrees().forEach(([name, t]) => {
    ['height', 'count'].forEach((kind) => {
      const r = A.computeSteps(t, kind);
      assert.equal(r.value, A.referenceCompute(t, kind), name + kind);
      assert.equal(r.value, kind === 'height' ? ref.height(toNested(t, t.root)) : ref.count(toNested(t, t.root)));
      // every node's returned chip equals its own subtree's height/count
      const last = r.steps[r.steps.length - 1];
      last.nodes.forEach((nd) => {
        const sub = toNested(t, nd.id);
        const want = kind === 'height' ? ref.height(sub) : ref.count(sub);
        assert.equal(nd.returnValue, want < 0 ? '−' + Math.abs(want) : String(want), name + ' chip ' + nd.id);
        assert.equal(nd.state, 'done');
      });
    });
  });
});
test('computeSteps visits children before parents and never claims a value early', () => {
  const t = A.fromLevel([1, 2, 3, 4, 5, '#', 6]);
  const r = A.computeSteps(t, 'height');
  const computedOrder = r.steps.filter((s) => s.kind === 'compute').map((s) => s.current);
  assert.deepEqual(computedOrder, A.postorder(t));
  r.steps.forEach((s, i) => {
    const withChip = s.nodes.filter((n) => n.returnValue !== undefined).map((n) => n.id);
    withChip.forEach((id) => {
      const nd = t.nodes[id];
      [nd.left, nd.right].filter(Boolean).forEach((c) => assert.ok(withChip.includes(c), 'chip of ' + id + ' before its child at step ' + i));
    });
    assert.ok(s.frames.length <= A.height(t) + 1);
  });
  const rec = r.steps.filter((s) => s.kind === 'call').length;
  assert.equal(rec, 6);
});
test('expression tree (3 + 4) × (5 − 2) evaluates to 21 and reads out three ways', () => {
  const t = A.fromShape(['×', ['+', [3], [4]], ['−', [5], [2]]]);
  const r = A.computeSteps(t, 'eval');
  assert.equal(r.value, 21);
  assert.equal(A.referenceCompute(t, 'eval'), 21);
  const toks = A.exprTokens(t);
  const s = (list) => list.map((x) => x.text).join(' ');
  assert.equal(s(toks.prefix), '× + 3 4 − 5 2');
  assert.equal(s(toks.infix), '( 3 + 4 ) × ( 5 − 2 )');
  assert.equal(s(toks.postfix), '3 4 + 5 2 − ×');
  // evaluation happens in postfix order
  const order = r.steps.filter((x) => x.kind === 'compute').map((x) => t.nodes[x.current].value);
  assert.deepEqual(order, [3, 4, '+', 5, 2, '−', '×']);
  assert.equal(A.valuesOf(t, A.inorder(t)).join(''), '3+4×5−2');
});
test('division and subtraction respect operand order', () => {
  const t = A.fromShape(['÷', ['−', [9], [3]], [2]]);
  assert.equal(A.computeSteps(t, 'eval').value, 3);
  const t2 = A.fromShape(['−', [2], ['×', [3], [4]]]);
  assert.equal(A.computeSteps(t2, 'eval').value, -10);
});

/* ------------------------------------------------------------ n-ary trees */
const FS = {
  id: 'root', label: 'project', children: [
    { id: 'src', label: 'src', children: [{ id: 'app', label: 'app.js', size: 14 }, { id: 'ui', label: 'ui', children: [{ id: 'btn', label: 'button.js', size: 6 }, { id: 'mod', label: 'modal.js', size: 9 }] }] },
    { id: 'docs', label: 'docs', children: [{ id: 'rm', label: 'readme.md', size: 3 }] },
    { id: 'pkg', label: 'package.json', size: 2 }
  ]
};
test('folderSteps totals every folder after everything inside it', () => {
  const r = A.folderSteps(FS);
  assert.equal(r.total, 34);
  assert.equal(A.naryTotal(FS), 34);
  const last = r.steps[r.steps.length - 1];
  const chip = {}; last.nodes.forEach((n) => { chip[n.id] = n.returnValue; });
  assert.deepEqual([chip.ui, chip.src, chip.docs, chip.root], ['15KB', '29KB', '3KB', '34KB']);
  // postorder: every folder is computed after each of its children
  const computed = r.steps.filter((s) => s.kind === 'compute').map((s) => s.nodes.find((n) => n.state === 'done' && n.returnValue !== undefined && !r.steps[r.steps.indexOf(s) - 1].nodes.find((m) => m.id === n.id && m.returnValue !== undefined)).id);
  const ix = A.naryIndex(FS);
  computed.forEach((id, k) => ix.map[id].children.forEach((c) => assert.ok(computed.indexOf(c) < k, id + ' after ' + c)));
  assert.equal(computed.length, ix.order.length);
  r.steps.forEach((s) => assert.ok(s.frames.length <= 4));
});

/* ------------------------------------------------------------ growing a tree, vocabulary, teaser */
test('growSteps adds one node and one edge at a time: n nodes, n - 1 edges', () => {
  sampleTrees().forEach(([name, t]) => {
    const steps = A.growSteps(t), n = A.size(t);
    assert.equal(steps.length, n + 1, name);
    steps.forEach((s, i) => {
      const k = Math.min(i + 1, n);
      assert.equal(s.counters.nodes, k, name);
      assert.equal(s.counters.edges, k - 1, name);
      assert.equal(s.nodes.length, k, name);
      // the links drawn are exactly the edges counted
      const links = s.nodes.reduce((c, nd) => c + (nd.left !== null ? 1 : 0) + (nd.right !== null ? 1 : 0), 0);
      assert.equal(links, k - 1, name);
    });
    assert.deepEqual(steps[n].nodes.map((x) => x.id).sort(), t.order.slice().sort(), name);
  });
});
test('vocabFacts: parent, depth, height, subtree and level', () => {
  const t = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F', 'G']);
  const id = (v) => t.order.find((x) => t.nodes[x].value === v);
  const d = A.vocabFacts(t, id('D'));
  assert.equal(d.parent, id('B')); assert.equal(d.depth, 2); assert.equal(d.height, 1);
  assert.deepEqual(d.children.map((x) => t.nodes[x].value), ['G']);
  assert.deepEqual(d.siblings.map((x) => t.nodes[x].value), ['E']);
  assert.deepEqual(d.ancestors.map((x) => t.nodes[x].value), ['B', 'A']);
  assert.equal(d.subtreeSize, 2);
  const a = A.vocabFacts(t, t.root);
  assert.equal(a.parent, null); assert.equal(a.depth, 0); assert.equal(a.height, A.height(t)); assert.equal(a.subtreeSize, A.size(t));
  assert.deepEqual(a.siblings, []);
  assert.equal(A.vocabFacts(t, id('E')).leaf, true);
  assert.deepEqual(A.vocabFacts(t, id('F')).level.map((x) => t.nodes[x].value).sort(), ['D', 'E', 'F']);
  sampleTrees().forEach(([name, tr]) => {
    tr.order.forEach((x) => {
      const f = A.vocabFacts(tr, x);
      assert.equal(f.height, A.heightOf(tr, x), name);
      assert.equal(f.subtreeSize, A.subtreeIds(tr, x).length, name);
      assert.equal(f.ancestors.length, f.depth, name);
      const path = A.longestDown(tr, x);
      assert.equal(path.length - 1, f.height, name + ' longest path');
    });
  });
});
test('teaserSteps grow the tree, then walk it in preorder and end after the whole tour', () => {
  const t = A.fromLevel(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const steps = A.teaserSteps(t), n = A.size(t);
  assert.ok(steps.every((s) => s.caption === ''));
  const walk = steps.filter((s) => s.kind === 'walk');
  assert.equal(walk.length, n);
  assert.deepEqual(walk.map((s) => s.tour), A.preorder(t).map((id) => A.stopPositions(t)[id + ':pre']));
  assert.equal(steps[steps.length - 1].tour, 3 * n + 1);
  assert.ok(steps.filter((s) => s.kind === 'add' || s.kind === 'root').every((s) => s.tour === null));
});
