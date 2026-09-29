/* Lesson 10 · Queues & deques: step generator tests (node --test tests/algos/10-queues.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const V = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const Q = require(path.join(ROOT, 'js', 'algos', '10-queues.js'));
const CODE = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(V.STATES));

function ops(text) { const r = Q.parseOps(text); assert.equal(r.error, null, text); return r.ops; }
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }

function wellFormed(steps, counterKeys) {
  assert.ok(steps.length >= 2);
  steps.forEach((s, k) => {
    assert.equal(typeof s.caption, 'string', 'caption at ' + k);
    assert.ok(stripTags(s.caption).length > 8, 'caption text at ' + k);
    if (counterKeys) assert.deepEqual(Object.keys(s.counters), counterKeys, 'counter keys at ' + k);
  });
}
function countersOnlyGrow(steps) {
  for (let k = 1; k < steps.length; k++) {
    for (const key of Object.keys(steps[k].counters)) {
      if (['stackWorst', 'queueWorst', 'queued', 'brute'].includes(key)) continue;
      assert.ok(steps[k].counters[key] >= steps[k - 1].counters[key], key + ' shrank at ' + k);
    }
  }
}
function labelsIn(src, lang) { return Object.keys(CODE.parse(src, lang).labels); }
function lineLabels(line) { return line === null || line === undefined ? [] : Array.isArray(line) ? line : [line]; }

/* ------------------------------------------------------------ parsing */
test('parseOps: numbers enqueue, d dequeues, friendly errors', () => {
  assert.deepEqual(Q.parseOps('5, 3 d -7 - x').ops.map((o) => o.type === 'enq' ? o.value : 'd'), [5, 3, 'd', -7, 'd', 'd']);
  assert.match(Q.parseOps('').error, /at least one/);
  assert.match(Q.parseOps('5 q').error, /“q”/);
  assert.match(Q.parseOps('500').error, /out of range/);
  assert.match(Q.parseOps(new Array(30).fill('1').join(' ')).error, /20 or fewer/);
  assert.equal(Q.parseOps('1 2', { maxOps: 5 }).ops.length, 2);
});
test('parsePlan: letters arrive, - serves, no duplicates', () => {
  assert.deepEqual(Q.parsePlan('a b - c').plan.map((p) => p.type === 'arrive' ? p.value : '-'), ['A', 'B', '-', 'C']);
  assert.match(Q.parsePlan('a a').error, /twice/);
  assert.match(Q.parsePlan('- -').error, /at least one arrival/);
  assert.match(Q.parsePlan('a ??').error, /not valid/);
});

/* ------------------------------------------------------------ ticket line */
test('ticketLine: first in line is served first', () => {
  const st = Q.ticketLine(['j', 'j', 'j', 's', 'j', 's', 's', 's', 's']);
  const servedOrder = st.filter((s) => s.event === 'serve').map((s) => s.servedPerson.n);
  assert.deepEqual(servedOrder, [1, 2, 3, 4]);
  assert.equal(st[st.length - 1].event, 'idle');
  assert.equal(st[st.length - 1].line.length, 0);
});

/* ------------------------------------------------------------ the four operations */
test('queueOps: FIFO order, peek does not remove, underflow leaves the queue empty', () => {
  const st = Q.queueOps([{ type: 'enq', value: 1 }, { type: 'enq', value: 2 }, { type: 'peek' }, { type: 'deq' }, { type: 'deq' }, { type: 'deq' }]);
  wellFormed(st, ['enqueue', 'dequeue', 'peek', 'refused']);
  countersOnlyGrow(st);
  assert.deepEqual(st.map((s) => s.kind), ['start', 'enqueue', 'enqueue', 'peek', 'dequeue', 'dequeue', 'underflow']);
  assert.deepEqual(st[3].items.map((i) => i.value), [1, 2]);
  assert.equal(st[3].returned, 1);
  assert.deepEqual(st[4].items.map((i) => i.value), [2]);
  assert.equal(st[5].items.length, 0);
  assert.equal(st[6].counters.refused, 1);
  assert.match(st[6].label, /underflow/);
});

/* ------------------------------------------------------------ shifting array vs moving front index */
test('arrayQueues: shifting costs live-count moves per dequeue; front index wastes slots and runs out of room', () => {
  const st = Q.arrayQueues(ops(Q.ARRAY_DEFAULT));
  wellFormed(st, ['moves', 'wasted', 'refused']);
  countersOnlyGrow(st);
  const last = st[st.length - 1];
  // 5 enqueued, dequeue with 4, 3, 2 live values left: 4 + 3 + 2 moves
  assert.equal(last.counters.moves, 9);
  assert.equal(last.counters.wasted, 3);
  // enqueue 6, 2, 8 fit in slots 5..7; the last one (5) finds the rear at capacity while only 5 slots are live
  assert.ok(st.some((s) => s.kind === 'nospace'));
  assert.equal(last.counters.refused, 1);
  // shifting array: values are always packed from slot 0
  st.forEach((s) => {
    if (s.kind === 'dequeue') return;                       // that step shows the hole at slot 0 on purpose
    const naive = s.rows[0].items.map((i) => i.index).sort((a, b) => a - b);
    naive.forEach((ix, k) => assert.equal(ix, k));
  });
});
test('arrayQueues: random operations keep both arrays equal to straightforward models', () => {
  const rng = V.rng(10);
  for (let t = 0; t < 60; t++) {
    const list = [];
    for (let k = 0; k < rng.int(1, 18); k++) list.push(rng() < 0.6 ? { type: 'enq', value: rng.int(1, 9) } : { type: 'deq' });
    const st = Q.arrayQueues(list, { capacity: 6 });
    // model 1: shift left on every dequeue
    const naive = [];
    // model 2: values stay put, a front index advances and the rear index only grows
    const arr = new Array(6).fill(null); let front = 0, rear = 0;
    list.forEach((o) => {
      if (o.type === 'enq') {
        if (naive.length < 6) naive.push(o.value);
        if (rear < 6 && naive.length <= 6 && rear - front < 6 && arr.slice(front, rear).length < naive.length) { arr[rear++] = o.value; }
      } else if (naive.length) { naive.shift(); front++; }
    });
    const last = st[st.length - 1];
    assert.deepEqual(last.rows[0].items.map((i) => i.value), naive, 'shifting row');
    assert.deepEqual(last.rows[1].items.filter((i) => i.state !== 'muted').map((i) => i.value), arr.slice(front, rear), 'front-index row');
    assert.equal(last.counters.wasted, front);
    // neither array ever holds more than its capacity
    assert.ok(last.rows[0].items.length <= 6 && last.rows[1].items.length <= 6);
  }
});

/* ------------------------------------------------------------ circular buffer */
function refRing(cap, list, scheme, policy) {
  const usable = scheme === 'spare' ? cap - 1 : cap;
  const q = [], out = [], acc = [];
  list.forEach((o) => {
    if (o.type === 'enq') {
      if (q.length === usable) {
        if (policy === 'overwrite') { q.shift(); q.push(o.value); acc.push(true); } else acc.push(false);
      } else { q.push(o.value); acc.push(true); }
    } else out.push(q.length ? q.shift() : null);
  });
  return { q, out, acc };
}
function checkRingSnapshot(s, C) {
  assert.equal(s.capacity, C);
  assert.equal(s.slots.length, C);
  assert.ok(s.head >= 0 && s.head < C && s.tail >= 0 && s.tail < C, 'pointers in range');
  s.flat.forEach((f) => { assert.ok(f.index >= 0 && f.index < C); assert.ok(STATES.has(f.state), f.state); });
  s.slots.forEach((x) => { if (x) assert.ok(STATES.has(x.state)); });
  const ids = s.flat.map((f) => f.id); assert.equal(new Set(ids).size, ids.length, 'unique ids');
  s.regions.forEach((r) => assert.ok(r.from >= 0 && r.to < C && r.from <= r.to));
}
for (const scheme of ['size', 'spare']) {
  for (const policy of ['reject', 'overwrite']) {
    test('ring ' + scheme + '/' + policy + ': matches a reference queue on random operations', () => {
      const rng = V.rng(scheme.length * 7 + policy.length);
      for (let t = 0; t < 120; t++) {
        const C = rng.int(2, 8), list = [];
        const bias = rng();
        for (let k = 0; k < rng.int(1, 20); k++) list.push(rng() < bias ? { type: 'enq', value: rng.int(-9, 99) } : { type: 'deq' });
        const st = Q.ring(C, list, { scheme, policy });
        const ref = refRing(C, list, scheme, policy);
        assert.deepEqual(st.out, ref.out, 'dequeue results');
        assert.deepEqual(st.live, ref.q, 'final contents');
        assert.deepEqual(st.accepted, ref.acc);
        st.forEach((s) => checkRingSnapshot(s, C));
        countersOnlyGrow(st);
        wellFormed(st, ['enqueued', 'dequeued', 'wraps', 'refused', 'overwritten']);
        // the flat view's live items are exactly the reference queue in order
        const last = st[st.length - 1];
        const liveFlat = last.flat.filter((f) => f.state === 'default').sort((a, b) => ((a.index - last.head + C) % C) - ((b.index - last.head + C) % C)).map((f) => f.value);
        assert.deepEqual(liveFlat, ref.q);
        if (scheme === 'size') assert.equal(last.size, ref.q.length);
      }
    });
  }
}
test('ring: fills, wraps, and full/empty are told apart with an explicit size', () => {
  const st = Q.ring(4, ops('1 2 3 4 5 d d 5 6 d d d d d'), { scheme: 'size' });
  assert.deepEqual(st.accepted, [true, true, true, true, false, true, true]);
  assert.deepEqual(st.out, [1, 2, 3, 4, 5, 6, null]);
  const full = st.find((s) => s.kind === 'advance' && s.flags.isFull);
  assert.ok(full); assert.equal(full.head, full.tail, 'full: head equals tail');
  assert.equal(full.size, 4);
  const empty = st.filter((s) => s.flags.isEmpty && s.kind !== 'start').pop();
  assert.equal(empty.head, empty.tail, 'empty: head equals tail too');
  assert.equal(empty.size, 0);
  assert.ok(st[st.length - 1].counters.wraps >= 2);
  assert.equal(st[st.length - 1].counters.refused, 2);            // one FULL, one EMPTY
});
test('ring: the capacity-5 sequence from the checks ends with head 3 and tail 2', () => {
  const st = Q.ring(5, ops('1 2 3 4 d d d 5 6 7'), { scheme: 'size' });
  const last = st[st.length - 1];
  assert.equal(last.head, 3); assert.equal(last.tail, 2); assert.equal(last.size, 4);
  assert.deepEqual(st.live, [4, 5, 6, 7]);
});
test('ring spare: one slot stays empty, so capacity C holds C − 1 values', () => {
  const st = Q.ring(4, ops('1 2 3 4 5'), { scheme: 'spare' });
  assert.deepEqual(st.accepted, [true, true, true, false, false]);
  assert.equal(st[st.length - 1].flags.usable, 3);
  assert.ok(st.some((s) => s.kind === 'reject'));
});
test('ring bug: after C enqueues head equals tail, the code says empty although C values are stored', () => {
  const st = Q.ring(4, ops('1 2 3 4 d'), { scheme: 'bug' });
  const afterFill = st.filter((s) => s.kind === 'advance')[3];
  assert.equal(afterFill.head, afterFill.tail);
  assert.equal(afterFill.flags.isEmpty, true);
  assert.equal(afterFill.flags.stored, 4);
  assert.equal(afterFill.flags.lost, 4);
  assert.equal(afterFill.size, 0);
  assert.ok(afterFill.flat.every((f) => f.state === 'error' && f.badge === 'lost'));
  assert.deepEqual(st.out, [null]);                                 // the dequeue reports EMPTY
  assert.match(stripTags(st.find((s) => s.kind === 'underflow').caption), /4 unread values/);
});
test('ring bug: below capacity it behaves like a normal queue; the C+1st enqueue overwrites unread data', () => {
  const ok = Q.ring(4, ops('1 2 3 d d'), { scheme: 'bug' });
  assert.deepEqual(ok.out, [1, 2]);
  const over = Q.ring(3, ops('1 2 3 9'), { scheme: 'bug' });
  assert.equal(over[over.length - 1].counters.overwritten, 1);
  assert.match(stripTags(over.find((s) => s.kind === 'write' && s.op === 'enqueue(9)').caption), /gone/);
});
test('ring overwrite policy: the oldest value is dropped and counted', () => {
  const st = Q.ring(3, ops('1 2 3 4 5'), { scheme: 'size', policy: 'overwrite' });
  assert.deepEqual(st.live, [3, 4, 5]);
  assert.equal(st[st.length - 1].counters.overwritten, 2);
  assert.equal(st[st.length - 1].counters.refused, 0);
});
test('ring: dequeued slots stay physically filled (stale) until overwritten', () => {
  const st = Q.ring(4, ops('7 8 d'), { scheme: 'size' });
  const last = st[st.length - 1];
  const stale = last.flat.find((f) => f.value === 7);
  assert.equal(stale.state, 'muted'); assert.equal(stale.badge, 'old');
  assert.equal(last.slots[stale.index], null, 'the ring view shows the slot as free');
});
test('ring: capacity is validated', () => {
  assert.throws(() => Q.ring(1, []), /capacity/);
  assert.throws(() => Q.ring(13, []), /capacity/);
  assert.throws(() => Q.ring(4, [], { scheme: 'nope' }), /scheme/);
  assert.equal(Q.ring(4, [], {}).length, 2);                        // empty operation list: start + done
});
test('ring: every step line exists in every language; every flow id exists in the flowchart', () => {
  for (const scheme of ['size', 'spare', 'bug']) {
    for (const policy of ['reject', 'overwrite']) {
      const code = Q.ringCode(scheme, policy), flow = Q.ringFlow(scheme, policy);
      const ids = new Set(flow.nodes.map((n) => n.id));
      const rng = V.rng(5);
      const list = []; for (let k = 0; k < 18; k++) list.push(rng() < 0.55 ? { type: 'enq', value: k } : { type: 'deq' });
      const st = Q.ring(4, list, { scheme, policy });
      for (const lang of ['pseudo', 'js', 'py']) {
        const have = new Set(labelsIn(code[lang], lang));
        st.forEach((s) => lineLabels(s.line).forEach((l) => assert.ok(have.has(l), scheme + '/' + policy + ' ' + lang + ' lacks label ' + l)));
      }
      st.forEach((s) => { if (s.flow) assert.ok(ids.has(s.flow), 'flow node ' + s.flow); });
      flow.edges.forEach((e) => { assert.ok(ids.has(e.from) && ids.has(e.to), e.from + '->' + e.to); });
      // consecutive steps of one operation follow an edge (so the flowchart token can travel)
      const edges = new Set(flow.edges.map((e) => e.from + '->' + e.to));
      for (let k = 1; k < st.length; k++) {
        const a = st[k - 1], b = st[k];
        if (!a.flow || !b.flow || a.flow === b.flow || a.op !== b.op || !['check', 'evict', 'write', 'read'].includes(a.kind)) continue;
        assert.ok(edges.has(a.flow + '->' + b.flow), scheme + '/' + policy + ': no edge ' + a.flow + ' -> ' + b.flow);
      }
    }
  }
});
test('ring: the JavaScript in the code panel really implements the queue (size scheme)', () => {
  const src = CODE.plainText(CODE.parse(Q.ringCode('size', 'reject').js, 'js'));
  const Ring = new Function(src + '; return Ring;')();
  const rng = V.rng(77);
  for (let t = 0; t < 30; t++) {
    const C = rng.int(2, 6), r = new Ring(C), ref = [];
    for (let k = 0; k < 40; k++) {
      if (rng() < 0.55) { const ok = r.enqueue(k); if (ref.length < C) { assert.equal(ok, true); ref.push(k); } else assert.equal(ok, false); }
      else assert.equal(r.dequeue(), ref.shift());
    }
  }
});
test('ring: the JavaScript for the spare-slot scheme holds C − 1 values', () => {
  const src = CODE.plainText(CODE.parse(Q.ringCode('spare', 'reject').js, 'js'));
  const Ring = new Function(src + '; return Ring;')();
  const r = new Ring(4);
  assert.deepEqual([1, 2, 3, 4].map((x) => r.enqueue(x)), [true, true, true, false]);
  assert.equal(r.dequeue(), 1);
});

/* ------------------------------------------------------------ stack vs queue */
test('stackVsQueue: same arrivals, LIFO vs FIFO service order, and waits', () => {
  const plan = Q.parsePlan('a b c - d - e -').plan;
  const st = Q.stackVsQueue(plan);
  wellFormed(st, ['stackWorst', 'queueWorst', 'served']);
  const last = st[st.length - 1];
  assert.deepEqual(last.servedQueue.map((x) => x.value), ['A', 'B', 'C']);
  assert.deepEqual(last.servedStack.map((x) => x.value), ['C', 'D', 'E']);
  assert.deepEqual(last.stack.map((x) => x.value), ['A', 'B']);   // A and B are buried under newer arrivals
  assert.deepEqual(last.queue.map((x) => x.value), ['D', 'E']);
  assert.equal(last.counters.stackWorst, 7);                       // A arrived at tick 1 and is still waiting at tick 8
  assert.equal(last.counters.queueWorst, 5);                       // C waited from tick 3 to tick 8
});
test('stackVsQueue: random plans match reference LIFO and FIFO', () => {
  const rng = V.rng(31);
  for (let t = 0; t < 80; t++) {
    const list = []; let letters = 0;
    for (let k = 0; k < rng.int(1, 14); k++) { if (rng() < 0.6 && letters < 8) { list.push({ type: 'arrive', value: String.fromCharCode(65 + letters++) }); } else list.push({ type: 'serve' }); }
    const st = Q.stackVsQueue(list), last = st[st.length - 1];
    const S = [], F = [], outS = [], outF = [];
    list.forEach((p) => { if (p.type === 'arrive') { S.push(p.value); F.push(p.value); } else if (S.length) { outS.push(S.pop()); outF.push(F.shift()); } });
    assert.deepEqual(last.servedStack.map((x) => x.value), outS);
    assert.deepEqual(last.servedQueue.map((x) => x.value), outF);
    assert.deepEqual(last.stack.map((x) => x.value), S);
    assert.deepEqual(last.queue.map((x) => x.value), F);
    // waiting time is never negative and a queue never has a longer-waiting value behind a shorter one
    last.waitingQueue.forEach((w, i) => { assert.ok(w.wait >= 0); if (i) assert.ok(last.waitingQueue[i - 1].wait >= w.wait); });
  }
});

/* ------------------------------------------------------------ sliding window maximum */
test('slidingMax: the classic example', () => {
  const nums = [1, 3, -1, -3, 5, 3, 6, 7];
  const st = Q.slidingMax(nums, 3);
  assert.deepEqual(st.result, [3, 3, 5, 5, 6, 7]);
  wellFormed(st, ['comparisons', 'pops', 'brute']);
  countersOnlyGrow(st);
  assert.equal(st[st.length - 1].counters.brute, Q.bruteCount(8, 3));
  assert.equal(st[st.length - 1].counters.comparisons, Q.slidingMaxCount(nums, 3).comparisons);
});
test('slidingMax: random inputs match brute force; the deque stays strictly decreasing; work stays under 2n', () => {
  const rng = V.rng(99);
  for (let t = 0; t < 250; t++) {
    const n = rng.int(1, 16), k = rng.int(1, n);
    const nums = []; const spread = rng.pick([3, 10, 99]);
    for (let i = 0; i < n; i++) nums.push(rng.int(-spread, spread));
    const st = Q.slidingMax(nums, k);
    assert.deepEqual(st.result, Q.slidingMaxReference(nums, k), JSON.stringify([nums, k]));
    st.forEach((s) => {
      for (let i = 1; i < s.dq.length; i++) assert.ok(s.dq[i - 1].value > s.dq[i].value, 'strictly decreasing');
      assert.ok(s.dq.length <= k, 'deque never larger than k');
      if (s.i !== null) s.dq.forEach((d) => { const ix = +d.id.slice(1); assert.ok(ix <= s.i && ix >= s.i - k + (s.kind === 'arrive' || s.kind === 'expire' ? 0 : 1) - 1); });
      s.nums.forEach((x) => assert.ok(STATES.has(x.state)));
    });
    const last = st[st.length - 1];
    assert.ok(last.counters.comparisons <= 2 * n, 'comparisons ≤ 2n');
    assert.ok(last.counters.pops <= n);
    assert.equal(last.out.length, n - k + 1);
    assert.equal(Q.slidingMaxCount(nums, k).comparisons, last.counters.comparisons);
  }
});
test('slidingMax: edge cases (k = 1, k = n, single value, equal values, sorted, reversed)', () => {
  assert.deepEqual(Q.slidingMax([4], 1).result, [4]);
  assert.deepEqual(Q.slidingMax([2, 9, 4], 1).result, [2, 9, 4]);
  assert.deepEqual(Q.slidingMax([2, 9, 4], 3).result, [9]);
  assert.deepEqual(Q.slidingMax([5, 5, 5, 5], 2).result, [5, 5, 5]);
  const inc = Q.slidingMax([1, 2, 3, 4, 5, 6], 3);
  assert.deepEqual(inc.result, [3, 4, 5, 6]);
  assert.ok(inc.every((s) => s.dq.length <= 1), 'increasing input keeps a single candidate');
  const dec = Q.slidingMax([6, 5, 4, 3, 2, 1], 3);
  assert.deepEqual(dec.result, [6, 5, 4, 3]);
  assert.ok(dec.some((s) => s.dq.length === 3), 'decreasing input fills the deque with k candidates');
  assert.ok(dec.every((s) => s.kind !== 'pop'), 'decreasing input never pops from the back');
  assert.throws(() => Q.slidingMax([1, 2], 3), /k must/);
  assert.throws(() => Q.slidingMax([1, 2], 0), /k must/);
  // equal values: the older one is popped (<=), so exactly one of them stays in the deque
  const eq = Q.slidingMax([5, 5, 5], 3);
  assert.equal(eq.filter((s) => s.kind === 'pop').length, 2);
});
test('slidingMax: every step line exists in every language and every flow id in the flowchart', () => {
  const flow = Q.windowFlow(), ids = new Set(flow.nodes.map((n) => n.id));
  const st = Q.slidingMax([4, 2, 12, 3, 8, 1, 9, 5], 3);
  for (const lang of ['pseudo', 'js', 'py']) {
    const have = new Set(labelsIn(Q.WINDOW_CODE[lang], lang));
    st.forEach((s) => lineLabels(s.line).forEach((l) => assert.ok(have.has(l), lang + ' lacks ' + l)));
  }
  st.forEach((s) => { if (s.flow) assert.ok(ids.has(s.flow), s.flow); });
  flow.edges.forEach((e) => assert.ok(ids.has(e.from) && ids.has(e.to)));
});
test('slidingMax: the JavaScript in the code panel is correct', () => {
  const src = CODE.plainText(CODE.parse(Q.WINDOW_CODE.js, 'js'));
  const fn = new Function(src + '; return maxSliding;')();
  const rng = V.rng(5);
  for (let t = 0; t < 40; t++) {
    const n = rng.int(1, 14), k = rng.int(1, n), nums = [];
    for (let i = 0; i < n; i++) nums.push(rng.int(-20, 20));
    assert.deepEqual(fn(nums, k), Q.slidingMaxReference(nums, k));
  }
});
test('bruteCount: (n − k + 1)(k − 1) comparisons', () => {
  assert.equal(Q.bruteCount(8, 3), 12); assert.equal(Q.bruteCount(5, 5), 4); assert.equal(Q.bruteCount(4, 1), 0); assert.equal(Q.bruteCount(2, 5), 0);
});

/* ------------------------------------------------------------ deque on a ring */
test('deque: random operations match a reference array deque', () => {
  const rng = V.rng(21);
  for (let t = 0; t < 100; t++) {
    const C = rng.int(2, 8);
    let m = Q.dequeCreate(C); const ref = [];
    for (let k = 0; k < 40; k++) {
      const op = rng.pick(['pushFront', 'pushBack', 'popFront', 'popBack']), val = rng.int(0, 99);
      const r = Q.dequeApply(m, op, val);
      let expectOk = true, expectRet;
      if (op === 'pushFront') { if (ref.length < C) ref.unshift(val); else expectOk = false; }
      else if (op === 'pushBack') { if (ref.length < C) ref.push(val); else expectOk = false; }
      else if (op === 'popFront') { if (ref.length) expectRet = ref.shift(); else expectOk = false; }
      else { if (ref.length) expectRet = ref.pop(); else expectOk = false; }
      assert.equal(r.ok, expectOk, op);
      if (expectRet !== undefined) assert.equal(r.returned, expectRet);
      m = r.model;
      assert.deepEqual(Q.dequeItems(m).map((x) => x.value), ref);
      const v = Q.dequeView(m, null);
      assert.deepEqual(v.deque.items.map((i) => i.value), ref);
      assert.equal(v.ring.slots.filter(Boolean).length, ref.length);
      assert.ok(m.head >= 0 && m.head < C);
    }
  }
});
test('deque: pushFront at head 0 wraps to the last slot (the "+ C" in the formula)', () => {
  const r = Q.dequeApply(Q.dequeCreate(6), 'pushFront', 7);
  assert.equal(r.model.head, 5);
  assert.match(r.msg, /\+ 6\) mod 6 = 5/);
  assert.match(r.msg, /wraps round/);
  assert.equal(Q.dequeApply(r.model, 'popFront').model.head, 0);
});
test('deque: full and empty are reported without changing the model', () => {
  let m = Q.dequeCreate(2);
  m = Q.dequeApply(m, 'pushBack', 1).model; m = Q.dequeApply(m, 'pushFront', 2).model;
  const full = Q.dequeApply(m, 'pushBack', 3);
  assert.equal(full.ok, false); assert.strictEqual(full.model, m);
  const e = Q.dequeApply(Q.dequeCreate(3), 'popBack');
  assert.equal(e.ok, false); assert.match(e.msg, /underflow/);
  assert.throws(() => Q.dequeApply(m, 'nope'), /unknown/);
});

/* ------------------------------------------------------------ two stacks */
test('twoStacks: dequeues in FIFO order, moves each value at most once, amortized constant', () => {
  const rng = V.rng(8);
  for (let t = 0; t < 80; t++) {
    const list = []; for (let k = 0; k < rng.int(1, 20); k++) list.push(rng() < 0.6 ? { type: 'enq', value: rng.int(1, 99) } : { type: 'deq' });
    const st = Q.twoStacks(list);
    wellFormed(st, ['pushes', 'pops', 'transfers']);
    countersOnlyGrow(st);
    const ref = [], out = [];
    list.forEach((o) => { if (o.type === 'enq') ref.push(o.value); else if (ref.length) out.push(ref.shift()); });
    assert.deepEqual(st.dequeued, out);
    const enq = list.filter((o) => o.type === 'enq').length, last = st[st.length - 1];
    assert.ok(last.counters.transfers <= enq, 'each value transferred at most once');
    assert.ok(last.counters.pushes + last.counters.pops <= 4 * enq, 'at most 4 stack operations per value');
    assert.equal(last.inbox.length + last.outbox.length, ref.length);
    // outbox is in reverse queue order: its top is the oldest value
    const outVals = last.outbox.map((x) => x.value), inVals = last.inbox.map((x) => x.value);
    assert.deepEqual(outVals.slice().reverse().concat(inVals), ref);
  }
});
test('twoStacks: underflow on empty', () => {
  const st = Q.twoStacks(ops('d'));
  assert.equal(st[1].kind, 'underflow');
});

/* ------------------------------------------------------------ linked queue */
test('linkedQueue: FIFO, tail resets when the queue empties', () => {
  const st = Q.linkedQueue(ops('1 2 3 d d d 4'));
  st.forEach((s) => {
    // walking next pointers from head visits exactly the queue, and the last node is the tail
    const byId = {}; s.nodes.forEach((n) => { byId[n.id] = n; });
    const seen = []; let cur = s.headId;
    while (cur) { seen.push(cur); cur = byId[cur] ? byId[cur].next : null; if (seen.length > 20) break; }
    if (s.kind === 'head' || s.kind === 'link') return;               // between "head moves" and "unlink" the old node is still listed
    assert.equal(seen[seen.length - 1] || null, s.tailId, 'tail is the last node reachable from head, step ' + s.kind);
    assert.equal(s.headId === null, s.tailId === null, 'head and tail are null together');
  });
  const emptied = st.filter((s) => s.kind === 'reset');
  assert.equal(emptied.length, 1);
  assert.match(emptied[0].caption, /tail must be set to null/);
  const last = st[st.length - 1];
  assert.deepEqual(last.nodes.map((n) => n.value), [4]);
});
test('linkedQueue: random operations equal a reference queue', () => {
  const rng = V.rng(64);
  for (let t = 0; t < 60; t++) {
    const list = []; for (let k = 0; k < rng.int(1, 16); k++) list.push(rng() < 0.55 ? { type: 'enq', value: rng.int(1, 99) } : { type: 'deq' });
    const st = Q.linkedQueue(list), ref = [];
    list.forEach((o) => { if (o.type === 'enq') ref.push(o.value); else ref.shift(); });
    assert.deepEqual(st[st.length - 1].nodes.map((n) => n.value), ref);
    assert.equal(st[st.length - 1].counters.size, ref.length);
  }
});

/* ------------------------------------------------------------ BFS on a grid */
test('bfsGrid: distances equal a plain BFS on random walls; expansion order is by distance', () => {
  const rng = V.rng(13);
  for (let t = 0; t < 60; t++) {
    const rows = rng.int(2, 6), cols = rng.int(2, 7), walls = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (rng() < 0.25 && !(r === 0 && c === 0)) walls.push([r, c]);
    const st = Q.bfsGrid(rows, cols, walls, [0, 0]);
    const ref = Q.bfsReference(rows, cols, walls, [0, 0]);
    assert.deepEqual(st.dist, ref.dist);
    const expanded = st.filter((s) => s.kind === 'expand').length;
    assert.equal(expanded, Object.keys(ref.dist).length);
    const last = st[st.length - 1];
    assert.equal(last.queue.length, 0);
    Object.keys(last.cells).forEach((k) => assert.equal(last.cells[k].state, 'visited'));
    let prev = -1;
    ref.order.forEach((u) => { const d = ref.dist[u[0] + ',' + u[1]]; assert.ok(d >= prev); prev = d; });
    wellFormed(st, ['visited', 'queued', 'biggest']);
  }
});
test('bfsGrid: start walled in, one cell, and a wall at the start', () => {
  const st = Q.bfsGrid(2, 2, [[0, 1], [1, 0]], [0, 0]);
  assert.equal(st.filter((s) => s.kind === 'expand').length, 1);
  assert.deepEqual(Object.keys(st.dist), ['0,0']);
  assert.equal(Q.bfsGrid(1, 1, [], [0, 0]).length, 3);
  assert.throws(() => Q.bfsGrid(2, 2, [[0, 0]], [0, 0]), /wall/);
  assert.equal(Q.cellName(0, 0), 'A1'); assert.equal(Q.cellName(2, 3), 'D3');
});

/* ------------------------------------------------------------ measured costs */
test('dequeueCost: shifting touches n values, ring and linked touch 1, two stacks 2n + 1 worst case', () => {
  for (const n of [1, 2, 5, 50, 300]) {
    assert.equal(Q.dequeueCost('shift', n), n);
    assert.equal(Q.dequeueCost('ring', n), 1);
    assert.equal(Q.dequeueCost('linked', n), 1);
    assert.equal(Q.dequeueCost('twostack', n), 2 * n + 1);
  }
  assert.equal(Q.dequeueCost('shift', 0), 0);
  assert.throws(() => Q.dequeueCost('nope', 3), /unknown/);
});
test('drainCost: shifting averages (n + 1) / 2, ring and linked 1, two stacks exactly 3', () => {
  for (const n of [1, 2, 7, 64]) {
    assert.equal(Q.drainCost('shift', n), (n + 1) / 2);
    assert.equal(Q.drainCost('ring', n), 1);
    assert.equal(Q.drainCost('twostack', n), 3);
  }
});

/* ------------------------------------------------------------ minis: rate limiter, priority queue */
test('rateLimiter: at most `limit` accepted requests in any window; matches a brute-force count', () => {
  const rng = V.rng(3);
  for (let k = 0; k < 60; k++) {
    const times = []; let t = 0;
    for (let i = 0; i < rng.int(1, 14); i++) { t += rng.int(0, 5); times.push(t); }
    const limit = rng.int(1, 4), win = rng.int(2, 10);
    const st = Q.rateLimiter(times, limit, win);
    const accepted = [];
    times.forEach((x) => { const recent = accepted.filter((a) => x - a < win); if (recent.length < limit) accepted.push(x); });
    assert.equal(st.filter((s) => s.kind === 'accept').length, accepted.length);
    st.forEach((s) => assert.ok(s.items.length <= limit));
  }
});
test('priorityQueue: serves the smallest value, earliest first on ties', () => {
  const st = Q.priorityQueue(ops('5 2 8 2 d d d d d'));
  const served = st.filter((s) => s.kind === 'serve').length;
  assert.equal(served, 4);
  const picks = st.filter((s) => s.kind === 'pick').map((s) => s.items.find((i) => i.state === 'compare').id);
  assert.deepEqual(picks, ['p1', 'p3', 'p0', 'p2']);
  assert.equal(st[st.length - 1].kind, 'underflow');
});
test('ring: the first wrapping write is flagged', () => {
  const st = Q.ring(6, ops('1 2 3 4 5 d d d 6 7 8 9'), { scheme: 'size' });
  const w = st.filter((s) => s.wrapWrite);
  assert.equal(w.length, 1);
  assert.equal(w[0].tail, 0);
  const full = st.find((s) => s.kind === 'advance' && s.head === s.tail && s.flags.isFull);
  assert.ok(full, 'the default lab preset reaches a full buffer with head = tail');
});
