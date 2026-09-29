/* node --test tests/algos/06-arrays.test.js
   Lesson 06 step generators checked against straightforward reference implementations. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const A = require(path.join(__dirname, '..', '..', 'js', 'algos', '06-arrays.js'));
const VDSA = require(path.join(__dirname, '..', '..', 'js', 'vdsa', 'core.js'));

/* ------------------------------------------------------------------ reference implementations */
function refAppendCosts(n, policy) {
  const out = []; let size = 0, cap = 0;
  for (let k = 1; k <= n; k++) {
    let copies = 0;
    if (size === cap) {
      copies = size;
      if (policy.type === 'add') cap += policy.k;
      else if (cap === 0) cap = 1;
      else if (policy.type === 'factor') cap = Math.max(cap + 1, Math.floor(cap * policy.a));
      else cap *= 2;
    }
    size++;
    out.push({ cost: copies + 1, copies, cap });
  }
  return out;
}

/* A plain dynamic array: the model the lab must agree with. */
class RefArray {
  constructor(values, cap) { this.a = values.slice(); this.cap = cap; }
  grow() { const c = this.a.length; this.cap = this.cap === 0 ? 1 : this.cap * 2; return c; }
  run(op) {
    const n = this.a.length, r = { reads: 0, writes: 0, shifts: 0, copies: 0 };
    if (op.type === 'read') { r.reads = 1; r.value = this.a[op.index]; }
    else if (op.type === 'search') { let j = 0; for (; j < n; j++) { r.reads++; if (this.a[j] === op.value) break; } r.value = j < n ? j : -1; }
    else if (op.type === 'append') { if (n === this.cap) r.copies = this.grow(); this.a.push(op.value); r.writes = 1; }
    else if (op.type === 'insert') { if (n === this.cap) r.copies = this.grow(); this.a.splice(op.index, 0, op.value); r.shifts = n - op.index; r.writes = 1; }
    else if (op.type === 'delete') { r.value = this.a.splice(op.index, 1)[0]; r.reads = 1; r.shifts = n - 1 - op.index; }
    return r;
  }
}

function liveRow(step) { return step.rows[step.rows.length - 1]; }
function rowValues(row) { return row.items.slice().sort((p, q) => p.index - q.index).map(it => it.value); }
function assertIdsUnique(step, where) {
  const ids = [];
  step.rows.forEach(r => r.items.forEach(it => ids.push(it.id)));
  if (step.held) ids.push(step.held.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids in a snapshot ' + where);
}
function assertSlotsInRange(step, where) {
  step.rows.forEach(r => {
    const used = new Set();
    r.items.forEach(it => {
      assert.ok(it.index >= 0 && it.index < r.length, `item ${it.id} at slot ${it.index} outside capacity ${r.length} ${where}`);
      assert.ok(!used.has(it.index), `two items share slot ${it.index} ${where}`);
      used.add(it.index);
    });
  });
}
const LABELS = { read: ['bounds', 'read'], search: ['cmp', 'found', 'none'], append: ['full', 'alloc', 'copy', 'free', 'write', 'size'],
  insert: ['full', 'alloc', 'copy', 'free', 'shift', 'write', 'size'], delete: ['take', 'shift', 'size', 'ret'] };

/* ------------------------------------------------------------------ address arithmetic */
test('address arithmetic and row/column-major indices', () => {
  assert.equal(A.addressOf(0x2000, 5, 4), 0x2014);
  assert.equal(A.hex(0x2014), '0x2014');
  assert.equal(A.hex(12), '0x000C');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    assert.equal(A.rowMajorIndex(r, c, 3, 4), r * 4 + c);
    assert.equal(A.colMajorIndex(r, c, 3, 4), c * 3 + r);
  }
  const seen = new Set(); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) seen.add(A.rowMajorIndex(r, c, 3, 4));
  assert.equal(seen.size, 12, 'row-major is a bijection onto 0..11');
});

/* ------------------------------------------------------------------ growth and the amortized ledger */
test('appendCosts matches a reference simulation for every policy', () => {
  const policies = [{ type: 'double' }, { type: 'add', k: 1 }, { type: 'add', k: 4 }, { type: 'factor', a: 1.5 }, { type: 'factor', a: 3 }];
  for (const p of policies) for (const n of [0, 1, 2, 3, 17, 64, 200]) {
    const got = A.appendCosts(n, p), ref = refAppendCosts(n, p);
    assert.equal(got.length, n);
    got.forEach((g, i) => { assert.equal(g.cost, ref[i].cost, `${p.type} k=${i + 1}`); assert.equal(g.cap, ref[i].cap); assert.ok(g.size <= g.cap); });
  }
});

test('doubling: the study numbers (17 appends) and the < 3 average', () => {
  const c = A.appendCosts(17, { type: 'double' });
  assert.deepEqual(c.map(x => x.cost), [1, 2, 3, 1, 5, 1, 1, 1, 9, 1, 1, 1, 1, 1, 1, 1, 17]);
  assert.equal(c[16].total, 48);
  assert.equal(A.totalCopies(17, { type: 'double' }), 31);
  assert.deepEqual(c.filter(x => x.grew).map(x => x.k), [1, 2, 3, 5, 9, 17]);
  const big = A.appendCosts(5000, { type: 'double' });
  big.forEach(x => { assert.ok(x.avg < 3, 'average below 3 at k=' + x.k); assert.ok(x.bank >= 2, 'bank never below 2'); assert.ok(x.phi >= 0, 'potential never negative'); });
  // amortized cost actual + ΔΦ is exactly 3 after the first append
  for (let i = 1; i < big.length; i++) assert.equal(big[i].cost + big[i].phi - big[i - 1].phi, 3);
});

test('grow-by-k copies are quadratic, geometric growth copies are linear', () => {
  for (const n of [1, 2, 10, 64, 300]) {
    assert.equal(A.totalCopies(n, { type: 'add', k: 1 }), n * (n - 1) / 2);
    assert.ok(A.totalCopies(n, { type: 'double' }) < 2 * n);
    assert.ok(A.totalCopies(n, { type: 'factor', a: 1.5 }) <= 3 * n + 3);
  }
  assert.equal(A.nextCapacity(0, { type: 'double' }), 1);
  assert.equal(A.nextCapacity(0, { type: 'add', k: 4 }), 4);
  assert.equal(A.nextCapacity(1, { type: 'factor', a: 1.5 }), 2);
});

/* ------------------------------------------------------------------ the operations lab */
function checkOp(ref, st, op, where) {
  const r = A.arrayOp(st, op);
  assert.equal(r.error, null, where + ': ' + r.error);
  const expect = ref.run(op);
  assert.deepEqual(r.state.items.map(it => it.value), ref.a, where + ' values');
  assert.equal(r.state.cap, ref.cap, where + ' capacity');
  const last = r.steps[r.steps.length - 1];
  assert.deepEqual(last.counters, { reads: expect.reads, writes: expect.writes, shifts: expect.shifts, copies: expect.copies }, where + ' counters');
  assert.equal(r.cost, expect.reads + expect.writes + expect.shifts + expect.copies, where + ' cost');
  assert.deepEqual(rowValues(liveRow(last)), ref.a, where + ' final snapshot');
  assert.equal(liveRow(last).length, ref.cap, where + ' final block length');
  const ids = r.state.items.map(it => it.id);
  assert.deepEqual(liveRow(last).items.slice().sort((p, q) => p.index - q.index).map(it => it.id), ids, where + ' final ids');
  const keys = JSON.stringify(Object.keys(r.steps[0].counters));
  r.steps.forEach((s, k) => {
    assertIdsUnique(s, where + ' step ' + k);
    assertSlotsInRange(s, where + ' step ' + k);
    assert.equal(JSON.stringify(Object.keys(s.counters)), keys, 'counter keys stay the same');
    assert.ok(typeof s.caption === 'string' && s.caption.length > 10, 'every step has a caption');
    [].concat(s.line === null ? [] : s.line).forEach(l => assert.ok(LABELS[op.type].includes(l), `unknown code label ${l} for ${op.type}`));
    assert.ok(s.rows.length <= 2, 'at most two memory blocks at once');
  });
  if (op.type === 'read' || op.type === 'search') {
    const found = last.rows[0].items.find(it => it.state === 'found');
    if (op.type === 'search' && expect.value === -1) assert.equal(found, undefined, where + ' nothing found');
    else if (op.type === 'search') assert.equal(found.index, expect.value, where + ' found index');
    else { assert.equal(found.value, expect.value, where + ' read value'); assert.equal(found.index, op.index); }
  }
  if (op.type === 'search' && expect.value === -1) assert.ok(/−1/.test(last.caption) || ref.a.length === 0);
  return r.state;
}

test('arrayOp agrees with a reference dynamic array on random operation sequences', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = VDSA.rng(seed);
    const n0 = rng.int(0, 8), cap0 = n0 + rng.int(0, 3);
    const vals = Array.from({ length: n0 }, () => rng.int(-9, 20));
    let st = A.makeState(vals, cap0);
    const ref = new RefArray(vals, st.cap);
    for (let step = 0; step < 25; step++) {
      const n = ref.a.length;
      const choices = ['search', 'append', 'insert'];
      if (n) choices.push('read', 'delete', 'delete');
      let type = rng.pick(choices);
      if (n >= A.MAX_ITEMS && (type === 'append' || type === 'insert')) type = 'delete';
      const op = { type };
      if (type === 'read' || type === 'delete') op.index = rng.int(0, n - 1);
      if (type === 'insert') op.index = rng.int(0, n);
      if (type === 'search') op.value = rng() < 0.6 && n ? ref.a[rng.int(0, n - 1)] : rng.int(-9, 30);
      if (type === 'append' || type === 'insert') op.value = rng.int(-9, 20);
      st = checkOp(ref, st, op, `seed ${seed} op ${step} ${JSON.stringify(op)}`);
    }
  }
});

test('arrayOp edge cases: empty, single, full, ends, duplicates, absent', () => {
  // empty with no storage: append allocates 1 slot, copying nothing
  let st = A.makeState([], 0), ref = new RefArray([], 0);
  st = checkOp(ref, st, { type: 'append', value: 7 }, 'append to capacity 0');
  assert.equal(st.cap, 1);
  st = checkOp(ref, st, { type: 'insert', index: 0, value: 3 }, 'insert at 0 when full');
  assert.equal(st.cap, 2);
  st = checkOp(ref, st, { type: 'delete', index: 1 }, 'delete the last element');
  st = checkOp(ref, st, { type: 'delete', index: 0 }, 'delete the only element');
  st = checkOp(ref, st, { type: 'search', value: 3 }, 'search an empty array');
  st = checkOp(ref, st, { type: 'insert', index: 0, value: 5 }, 'insert into an empty array with spare capacity');
  // duplicates: search returns the first match
  st = A.makeState([4, 2, 4, 4], 4); ref = new RefArray([4, 2, 4, 4], 4);
  const r = A.arrayOp(st, { type: 'search', value: 4 });
  assert.equal(r.steps.filter(s => s.kind === 'search' && /Compare/.test(s.caption)).length, 1, 'stops at the first 4');
  st = checkOp(ref, st, { type: 'search', value: 9 }, 'absent value');
  st = checkOp(ref, st, { type: 'append', value: 1 }, 'append to a full array doubles');
  assert.equal(st.cap, 8);
  st = checkOp(ref, st, { type: 'insert', index: st.items.length, value: 6 }, 'insert at size is an append');
  st = checkOp(ref, st, { type: 'read', index: 0 }, 'read index 0');
  st = checkOp(ref, st, { type: 'read', index: st.items.length - 1 }, 'read the last index');
  // inserting at 0 of n moves n elements
  const big = A.makeState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 16);
  assert.equal(A.arrayOp(big, { type: 'insert', index: 0, value: 0 }).counters.shifts, 10);
  assert.equal(A.arrayOp(big, { type: 'delete', index: 0 }).counters.shifts, 9);
  assert.equal(A.arrayOp(big, { type: 'delete', index: 9 }).counters.shifts, 0);
});

test('arrayOp validation gives friendly errors and leaves the state alone', () => {
  const st = A.makeState([1, 2, 3], 4);
  assert.match(A.arrayOp(st, { type: 'read', index: 3 }).error, /between 0 and 2/);
  assert.match(A.arrayOp(st, { type: 'read', index: -1 }).error, /between 0 and 2/);
  assert.match(A.arrayOp(st, { type: 'insert', index: 5, value: 1 }).error, /between 0 and 3/);
  assert.match(A.arrayOp(st, { type: 'append', value: 1.5 }).error, /whole number/);
  assert.match(A.arrayOp(st, { type: 'append', value: 500 }).error, /between/);
  assert.match(A.arrayOp(A.makeState([], 0), { type: 'delete', index: 0 }).error, /empty/);
  assert.match(A.arrayOp(st, { type: 'nope' }).error, /operation/);
  const full = A.makeState(Array.from({ length: 16 }, (_, i) => i), 16);
  assert.match(A.arrayOp(full, { type: 'append', value: 1 }).error, /at most 16/);
  const r = A.arrayOp(st, { type: 'read', index: 9 });
  assert.equal(r.state, st); assert.deepEqual(r.steps, []);
});

test('arrayOp growth draws truthful copies: originals muted, copies fly out of them', () => {
  const st = A.makeState([5, 6, 7, 8], 4);
  const r = A.arrayOp(st, { type: 'append', value: 9 });
  const copies = r.steps.filter(s => s.kind === 'copy');
  assert.equal(copies.length, 4);
  copies.forEach((s, j) => {
    assert.equal(s.rows.length, 2);
    const fresh = s.rows[1].items.find(it => it.index === j);
    const orig = s.rows[0].items.find(it => it.index === j);
    assert.equal(fresh.from, orig.id, 'copy starts at its original');
    assert.equal(fresh.value, orig.value);
    assert.equal(orig.state, 'muted');
  });
  const free = r.steps.find(s => s.kind === 'free');
  assert.equal(free.rows.length, 1, 'the old block is freed');
  assert.equal(free.rows[0].length, 8);
  // flowchart path: full -> grow -> write -> done
  assert.deepEqual([...new Set(r.steps.map(s => s.flow).filter(Boolean))], ['full', 'grow', 'write', 'done']);
});

test('growthSteps appends from capacity 0 and doubles 1, 2, 4, 8, 16', () => {
  const steps = A.growthSteps([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const caps = [...new Set(steps.map(s => s.meta.cap))];
  assert.deepEqual(caps, [0, 1, 2, 4, 8, 16]);
  const last = steps[steps.length - 1];
  assert.deepEqual(rowValues(liveRow(last)), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(last.meta.totalCopies, 15);
  assert.equal(last.meta.totalCost, 24);
  steps.forEach((s, k) => { assertIdsUnique(s, 'growth ' + k); assertSlotsInRange(s, 'growth ' + k); });
});

/* ------------------------------------------------------------------ shifting */
test('shiftDemo: insert from the back, delete, and the wrong (front-to-back) order', () => {
  const rng = VDSA.rng(99);
  for (let t = 0; t < 40; t++) {
    const n = rng.int(1, 7), vals = Array.from({ length: n }, () => rng.int(1, 9)), i = rng.int(0, n), x = rng.int(10, 20);
    const ins = A.shiftDemo(vals, 8, 'insert', i, x);
    const expected = vals.slice(); expected.splice(i, 0, x);
    const last = ins[ins.length - 1];
    assert.deepEqual(last.items.slice().sort((p, q) => p.index - q.index).map(it => it.value), expected);
    assert.equal(last.moves, n - i);
    ins.forEach(s => { const ids = s.items.map(it => it.id).concat(s.held ? [s.held.id] : []); assert.equal(new Set(ids).size, ids.length); });
    const wrong = A.shiftDemo(vals, 8, 'wrong', i, x);
    const wl = wrong[wrong.length - 1];
    const smear = vals.slice(0, i).concat([x]).concat(i < n ? Array(n - i).fill(vals[i]) : []);
    assert.deepEqual(wl.items.slice().sort((p, q) => p.index - q.index).map(it => it.value), smear, 'front-to-back copies smear a[i]');
    assert.deepEqual(wl.lost, vals.slice(i + 1), 'the overwritten values are reported as lost');
    if (i < n) {
      const di = rng.int(0, n - 1);
      const del = A.shiftDemo(vals, 8, 'delete', di);
      const exp2 = vals.slice(); exp2.splice(di, 1);
      const dl = del[del.length - 1];
      assert.deepEqual(dl.items.slice().sort((p, q) => p.index - q.index).map(it => it.value), exp2);
      assert.equal(dl.moves, n - 1 - di);
    }
  }
});

/* ------------------------------------------------------------------ bank account */
test('bankSteps: 3 coins per append always cover the work; the balance never goes negative', () => {
  for (const n of [1, 2, 3, 5, 9, 17]) {
    const steps = A.bankSteps(n);
    const costs = A.appendCosts(n, { type: 'double' });
    const last = steps[steps.length - 1];
    assert.equal(last.charged, 3 * n);
    assert.equal(last.work, costs[n - 1].total, 'work equals the real cost');
    assert.equal(last.balance, 3 * n - costs[n - 1].total, 'balance = paid − spent');
    steps.forEach((s, k) => {
      assert.ok(s.balance >= 0, 'balance never negative');
      assert.equal(s.coins.filter(c => c.state !== 'spent').length, s.balance, 'coins drawn = balance at step ' + k);
      const ids = s.coins.map(c => c.id); assert.equal(new Set(ids).size, ids.length, 'coin ids unique');
      const itemIds = new Set(s.items.map(it => it.id));
      s.coins.filter(c => c.owner).forEach(c => assert.ok(itemIds.has(c.owner), 'a stored coin sits on a drawn element'));
      assert.ok(s.blocks.length <= 2);
    });
    // after every write the bank matches the accounting column of the study table (3k − Σactual)
    const writes = steps.filter(s => s.phase === 'write');
    writes.forEach((s, i) => assert.equal(s.balance, costs[i].bank));
  }
});

/* ------------------------------------------------------------------ shrinking */
test('resizePolicy: shrinking at 1/2 thrashes, shrinking at 1/4 does not', () => {
  const ops = ['push', 'pop', 'push', 'pop', 'push', 'pop', 'push', 'pop'];
  const half = A.resizePolicy(ops, 'half', 8, 8), quarter = A.resizePolicy(ops, 'quarter', 8, 8);
  assert.deepEqual(half.slice(1).map(r => r.copies), [8, 8, 8, 8, 8, 8, 8, 8]);
  assert.equal(half[half.length - 1].total, 64);
  assert.deepEqual(quarter.slice(1).map(r => r.copies), [8, 0, 0, 0, 0, 0, 0, 0]);
  [half, quarter].forEach(run => run.forEach(r => assert.ok(r.n <= r.cap)));
  // popping everything with the quarter rule keeps size ≥ C/4 and ends small
  const drain = A.resizePolicy(Array(16).fill('pop'), 'quarter', 16, 16);
  drain.forEach(r => { if (r.cap > 1) assert.ok(r.n >= r.cap / 4 - 1e-9 || r.n === 0); });
  assert.equal(drain[drain.length - 1].n, 0);
  assert.equal(A.resizePolicy(['pop'], 'quarter', 0, 4)[1].n, 0, 'pop on empty is harmless');
});

/* ------------------------------------------------------------------ cache lines */
test('cacheWalk: rows reuse each loaded line, columns miss every time', () => {
  const rows = A.cacheWalk(4, 4, 'row', 4, 2), cols = A.cacheWalk(4, 4, 'col', 4, 2);
  assert.equal(rows.length, 17); assert.equal(cols.length, 17);
  assert.equal(rows[16].misses, 4); assert.equal(rows[16].hits, 12);
  assert.equal(cols[16].misses, 16);
  const seen = new Set(cols.slice(1).map(s => s.index)); assert.equal(seen.size, 16, 'every cell visited once');
  cols.forEach(s => assert.ok(s.cache.length <= 2));
  assert.equal(A.cacheWalk(4, 4, 'col', 4, 4)[16].misses, 4, 'a cache big enough for the whole array stops missing');
  assert.equal(A.cacheWalk(1, 1, 'row', 4, 1)[1].misses, 1);
});

/* ------------------------------------------------------------------ access race */
test('accessRace: k pointer hops against one address calculation', () => {
  for (let k = 0; k < 8; k++) {
    const r = A.accessRace(8, k, 3, 24);
    assert.equal(new Set(r.nodeCell).size, 8);
    r.nodeCell.forEach(c => assert.ok(c >= 0 && c < 24));
    const last = r.steps[r.steps.length - 1];
    assert.equal(last.listAt, k); assert.equal(last.listHops, k);
    assert.equal(last.arrayAt, k); assert.equal(last.arrayJumps, 1);
    assert.equal(r.steps.length, Math.max(k, 1) + 1);
    r.steps.forEach((s, t) => assert.ok(s.listHops <= t));
  }
  assert.deepEqual(A.accessRace(8, 3, 5).nodeCell, A.accessRace(8, 3, 5).nodeCell, 'deterministic per seed');
});
