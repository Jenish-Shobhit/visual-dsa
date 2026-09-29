/* Lesson 12 · Recursion — step generator tests (node --test tests/algos/12-recursion.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const R = require(path.join(__dirname, '..', '..', 'js', 'algos', '12-recursion.js'));
const VDSA = require(path.join(__dirname, '..', '..', 'js', 'vdsa', 'core.js'));

const LINES = new Set(['sig', 'base', 'baseRet', 'recurse', 'combine', 'left', 'right', 'even', 'odd']);
const FLOWS = new Set(['call', 'test', 'base', 'shrink', 'combine', 'ret']);

/* ------------------------------------------------------------ reference implementations */
const ref = {
  factorial: (n) => (n === 0 ? 1 : n * ref.factorial(n - 1)),
  total: (a) => a.reduce((x, y) => x + y, 0),
  power: ({ x, n }) => { let r = 1; for (let i = 0; i < n; i++) r *= x; return r; },
  reverse: (s) => s.split('').reverse().join(''),
  fib: (n) => (n < 2 ? n : ref.fib(n - 1) + ref.fib(n - 2))
};
const expectedCalls = {
  factorial: (n) => n + 1,
  total: (a) => a.length + 1,
  power: ({ n }) => (n === 0 ? 1 : Math.floor(Math.log2(n)) + 2),
  reverse: (s) => Math.max(1, s.length),
  fib: (n) => R.fibCalls(n)
};
const expectedDepth = {
  factorial: (n) => n + 1,
  total: (a) => a.length + 1,
  power: ({ n }) => (n === 0 ? 1 : Math.floor(Math.log2(n)) + 2),
  reverse: (s) => Math.max(1, s.length),
  fib: (n) => Math.max(1, n)
};
/* the value a node label stands for, e.g. 'fact(3)' -> 6 */
function labelValue(kind, label) {
  const inside = label.slice(label.indexOf('(') + 1, -1);
  if (kind === 'factorial') return ref.factorial(Number(inside));
  if (kind === 'fib') return ref.fib(Number(inside));
  if (kind === 'total') return ref.total(JSON.parse(inside.replace(/−/g, '-')));
  if (kind === 'power') { const [x, n] = inside.replace(/−/g, '-').split(',').map(Number); return ref.power({ x, n }); }
  if (kind === 'reverse') return '"' + ref.reverse(JSON.parse(inside)) + '"';
  throw new Error(kind);
}

function checkLab(kind, input) {
  const steps = R.lab(kind, input);
  const want = ref[kind](input);
  assert.equal(steps.result, want, `${kind}(${JSON.stringify(input)}) result`);
  assert.equal(steps.calls, expectedCalls[kind](input), `${kind} calls`);
  assert.equal(steps.deepest, expectedDepth[kind](input), `${kind} deepest`);
  assert.ok(steps.length >= 3);
  const keys = JSON.stringify(Object.keys(steps[0].counters));
  let prevNodes = 0;
  steps.forEach((s, i) => {
    assert.ok(s.caption && s.caption.length > 10, `caption at ${i}`);
    assert.equal(JSON.stringify(Object.keys(s.counters)), keys, 'counter keys stay the same');
    if (s.line !== null) assert.ok(LINES.has(s.line), `line label ${s.line}`);
    if (s.flow !== null) assert.ok(FLOWS.has(s.flow), `flow id ${s.flow}`);
    // main is always the bottom frame; the rest are the calls still running, parent below child
    assert.equal(s.frames[0].id, 'main');
    assert.equal(s.frames.length - 1, s.depth);
    assert.equal(s.counters.depth, s.depth);
    const byId = Object.fromEntries(s.nodes.map((n) => [n.id, n]));
    for (let f = 2; f < s.frames.length; f++) {
      assert.ok(byId[s.frames[f - 1].id].children.includes(s.frames[f].id), 'stack frames form a chain in the tree');
    }
    // tree grows by at most one node per step and never loses one
    assert.ok(s.nodes.length === prevNodes || s.nodes.length === prevNodes + 1);
    prevNodes = s.nodes.length;
    assert.equal(s.nodes.length, s.counters.calls);
    // states are truthful
    const onStack = new Set(s.frames.slice(1).map((f) => f.id));
    s.nodes.forEach((n) => {
      if (n.state === 'done') assert.equal(n.returnValue, labelValue(kind, n.label), `returned value of ${n.label}`);
      else assert.ok(onStack.has(n.id), `${n.label} is ${n.state} but not on the stack`);
      if (n.state === 'active') assert.equal(n.id, s.frames[s.frames.length - 1].id, 'only the top frame is active');
    });
    s.frames.slice(1).forEach((f) => { if (f.state === 'done') assert.equal(f.returnValue, labelValue(kind, byId[f.id].label)); });
    if (s.quiz) {
      assert.equal(String(s.quiz.options[0]).replace(/&quot;/g, '"'), String(typeof s.quiz.value === 'string' ? '"' + s.quiz.value + '"' : s.quiz.value).replace('-', '−'));
      assert.equal(new Set(s.quiz.options.map(String)).size, s.quiz.options.length, 'quiz options are distinct');
    }
  });
  const last = steps[steps.length - 1];
  assert.equal(last.kind, 'done');
  assert.equal(last.depth, 0);
  assert.ok(last.nodes.every((n) => n.state === 'done'));
  return steps;
}

test('lab: factorial 0..10', () => { for (let n = 0; n <= 10; n++) checkLab('factorial', n); });
test('lab: fib 0..6', () => { for (let n = 0; n <= 6; n++) checkLab('fib', n); });
test('lab: total on edge cases and random lists', () => {
  [[], [5], [-3], [2, 2, 2], [1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1], [-99, 99, 0]].forEach((a) => checkLab('total', a));
  const rng = VDSA.rng(12);
  for (let t = 0; t < 40; t++) { const a = []; const len = rng.int(0, 7); for (let i = 0; i < len; i++) a.push(rng.int(-99, 99)); checkLab('total', a); }
});
test('lab: power on edge cases and random inputs', () => {
  [{ x: 2, n: 0 }, { x: 0, n: 0 }, { x: 0, n: 5 }, { x: 2, n: 1 }, { x: -3, n: 5 }, { x: 2, n: 10 }, { x: 2, n: 52 }, { x: 9, n: 16 }, { x: 1, n: 64 }, { x: -1, n: 63 }].forEach((p) => checkLab('power', p));
  const rng = VDSA.rng(99);
  for (let t = 0; t < 40; t++) {
    const x = rng.int(-9, 9), n = rng.int(0, 20);
    if (Math.abs(ref.power({ x, n })) > Number.MAX_SAFE_INTEGER) continue;
    checkLab('power', { x, n });
  }
});
test('lab: reverse on edge cases and random strings', () => {
  ['', 'a', 'ab', 'aa', 'racecar', 'stack', 'abcdefgh', '1 2'].forEach((s) => checkLab('reverse', s));
  const rng = VDSA.rng(5), abc = 'abcxyz';
  for (let t = 0; t < 30; t++) { let s = ''; const len = rng.int(0, 8); for (let i = 0; i < len; i++) s += rng.pick(abc.split('')); checkLab('reverse', s); }
});
test('lab: fib counts repeated arguments', () => {
  const s = R.lab('fib', 5);
  assert.equal(s.calls, 15);
  assert.equal(s.repeats, 15 - 6);   // 6 distinct arguments 0..5
});
test('lab: the prediction lands on a combine step', () => {
  const s = R.lab('factorial', 4);
  const q = s.filter((x) => x.quiz);
  assert.equal(q.length, 4);
  assert.ok(q.every((x) => x.kind === 'return'));
});
test('lab: unknown kind throws', () => { assert.throws(() => R.lab('nope', 1)); });

test('parseLabInput: friendly validation', () => {
  const P = R.parseLabInput;
  assert.deepEqual(P('factorial', ' 4 '), { value: 4, error: null });
  assert.equal(P('factorial', '0').value, 0);
  assert.ok(P('factorial', '').error);
  assert.ok(P('factorial', '-1').error.includes('base case'));
  assert.ok(P('factorial', '11').error);
  assert.ok(P('factorial', '2.5').error);
  assert.ok(P('fib', '7').error.includes('41'));
  assert.deepEqual(P('total', '').value, []);
  assert.deepEqual(P('total', '[3, 1, 4]').value, [3, 1, 4]);
  assert.deepEqual(P('total', '−2 5').value, [-2, 5]);
  assert.ok(P('total', '1,2,3,4,5,6,7,8').error);
  assert.ok(P('total', '1, x').error);
  assert.ok(P('total', '100').error);
  assert.deepEqual(P('power', '2, 10').value, { x: 2, n: 10 });
  assert.ok(P('power', '2').error);
  assert.ok(P('power', '2, -1').error.includes('base case'));
  assert.ok(P('power', '9, 17').error.includes('too large'));
  assert.ok(P('power', '10, 2').error);
  assert.equal(P('reverse', 'stack').value, 'stack');
  assert.equal(P('reverse', '"ab"').value, 'ab');
  assert.equal(P('reverse', '').value, '');
  assert.ok(P('reverse', 'abcdefghi').error);
});

test('hanoi: moves match the reference, legal and minimal', () => {
  for (let n = 1; n <= 7; n++) {
    const steps = R.hanoi(n);
    const moves = steps.filter((s) => s.move).map((s) => s.move);
    assert.deepEqual(moves, R.hanoiMoves(n));
    assert.equal(moves.length, 2 ** n - 1);
    assert.equal(steps.calls.length, 2 ** n - 1);
    const last = steps[steps.length - 1];
    assert.deepEqual(last.pegs, [[], [], Array.from({ length: n }, (_, i) => n - i)]);
    assert.equal(last.moves, 2 ** n - 1);
    assert.ok(last.status.every((x) => x === 3));
    steps.forEach((s) => {
      s.pegs.forEach((p) => { for (let i = 1; i < p.length; i++) assert.ok(p[i] < p[i - 1], 'smaller on larger'); });
      assert.equal(s.pegs.flat().length, n);
      assert.equal(s.stack.length, s.counters.depth);
      assert.ok(s.stack.length <= n);
      if (s.active !== null) assert.equal(s.status[s.active], s.kind === 'move' && steps.calls[s.active].k === 1 ? 3 : s.kind === 'return' ? 3 : 2);
    });
    // each call covers a contiguous block of 2^k - 1 moves
    steps.calls.forEach((c) => {
      const block = R.hanoiMoves(n).slice(c.moveStart, c.moveStart + 2 ** c.k - 1);
      assert.equal(block[2 ** (c.k - 1) - 1].disc, c.k);
    });
  }
});

test('fibTree: naive vs memoised call counts', () => {
  for (let n = 0; n <= 12; n++) {
    const naive = R.fibTree(n, false), memo = R.fibTree(n, true);
    assert.equal(naive.length, R.fibCalls(n));
    assert.equal(memo.length, R.fibMemoCalls(n));
    assert.equal(naive[0].value, R.fib(n));
    assert.equal(memo[0].value, R.fib(n));
    const ids = new Set(naive.map((x) => x.id));
    memo.forEach((x) => assert.ok(ids.has(x.id), 'memo tree is a subset of the naive tree'));
    naive.forEach((x) => assert.equal(x.value, R.fib(x.n)));
  }
  assert.equal(R.fibCalls(5), 15);
  assert.equal(R.fibCalls(30), 2692537);
});

test('folders: totals bubble up', () => {
  const steps = R.folders();
  assert.equal(steps.total, 20);
  const last = steps[steps.length - 1];
  assert.ok(Object.values(last.states).every((s) => s === 'done'));
  assert.equal(last.totals.f0, 20);
  // the first folder to finish is the deepest-first leaf, 2023
  const firstDone = steps.findIndex((s) => Object.values(s.states).includes('done'));
  const doneId = Object.keys(steps[firstDone].states).find((k) => steps[firstDone].states[k] === 'done');
  assert.equal(steps[firstDone].rows.find((r) => r.id === doneId).name, '2023');
  steps.forEach((s) => assert.ok(Object.values(s.states).filter((x) => x === 'active').length <= 1));
});

test('rows: the answer climbs back', () => {
  for (let k = 1; k <= 6; k++) {
    const steps = R.rows(k);
    assert.equal(steps.length, 2 * k);
    assert.equal(steps[steps.length - 1].known[k], k);
  }
});

test('unfold: rewriting ends at n!', () => {
  for (let n = 0; n <= 6; n++) {
    const steps = R.unfold(n);
    const last = steps[steps.length - 1].tokens;
    assert.equal(last.length, 1);
    assert.equal(Number(last[0].text), R.factorial(n));
    assert.equal(Math.max(...steps.map((s) => s.pending)), n);
    steps.forEach((s) => assert.equal(new Set(s.tokens.map((t) => t.id)).size, s.tokens.length));
  }
});

test('countdown: base case unwinds, missing base case overflows', () => {
  const ok = R.countdown(3, true, 8);
  assert.equal(Math.max(...ok.map((s) => s.items.length)), 4);
  assert.equal(ok[ok.length - 1].items.length, 0);
  assert.ok(!ok.some((s) => s.overflow));
  assert.deepEqual(ok[ok.length - 1].output, ['3', '2', '1', 'liftoff']);
  const bad = R.countdown(3, false, 8);
  const last = bad[bad.length - 1];
  assert.ok(last.overflow);
  assert.equal(last.items.length, 9);
  assert.equal(last.items[8].state, 'error');
});

test('compare: all three agree, only plain recursion grows the stack', () => {
  for (let n = 1; n <= 7; n++) {
    const steps = R.compare(n);
    assert.equal(steps.result, R.factorial(n));
    const last = steps[steps.length - 1];
    assert.deepEqual(last.peaks, [n + 1, 1, 1]);
    last.lanes.forEach((l) => assert.equal(l.result, R.factorial(n)));
  }
});

test('palindrome: matches the reference on edge cases and random strings', () => {
  const isPal = (s) => s === s.split('').reverse().join('');
  ['', 'a', 'aa', 'ab', 'aba', 'abba', 'racecar', 'rocket', 'level', 'abca'].forEach((s) => assert.equal(R.palindrome(s).result, isPal(s), s));
  const rng = VDSA.rng(3);
  for (let t = 0; t < 60; t++) { let s = ''; const len = rng.int(0, 9); for (let i = 0; i < len; i++) s += rng.pick(['a', 'b']); assert.equal(R.palindrome(s).result, isPal(s), s); }
  R.palindrome('racecar').forEach((s) => assert.ok(s.depth <= 4));
});

test('binarySearch: finds present values, reports absent ones, stays logarithmic', () => {
  const rng = VDSA.rng(8);
  for (let t = 0; t < 80; t++) {
    const len = rng.int(0, 15), a = [];
    for (let i = 0; i < len; i++) a.push(rng.int(1, 30));
    a.sort((x, y) => x - y);
    const target = rng.int(0, 31);
    const s = R.binarySearch(a, target);
    if (a.includes(target)) assert.equal(a[s.result], target);
    else assert.equal(s.result, -1);
    assert.ok(s.calls <= Math.floor(Math.log2(Math.max(1, len))) + 2);
  }
  assert.equal(R.binarySearch([], 3).result, -1);
  assert.equal(R.binarySearch([4], 4).result, 0);
});

test('dolls and fractal', () => {
  const d = R.dolls(4);
  const last = d[d.length - 1].dolls;
  assert.equal(last.length, 1);
  assert.equal(last[0].value, 24);
  for (let depth = 0; depth <= 10; depth++) assert.equal(R.fractal(depth, 30).length, 2 ** (depth + 1) - 1);
});
