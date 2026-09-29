/* Lesson 04 · Functions & the call stack — step generator tests
   (node --test tests/algos/04-functions-and-the-stack.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..', '..', 'js');
const F = require(path.join(root, 'algos', '04-functions-and-the-stack.js'));
const VDSA = require(path.join(root, 'vdsa', 'core.js'));
const CODE = require(path.join(root, 'vdsa', 'code.js'));

const FLOWS = new Set(['call', 'nested', 'eval', 'push', 'bind', 'run', 'ret', 'pop', 'resume']);
const LANGS = ['pseudo', 'js', 'py'];
const STATES = new Set(['default', 'active', 'compare', 'swap', 'done', 'found', 'visited', 'frontier', 'path', 'pivot', 'key', 'error', 'muted']);

/* ------------------------------------------------------------ reference implementations */
const refArea = (w, h) => w * h;
const refTotal = (a) => a.reduce((x, y) => x + y, 0);
const text = (a) => '[' + a.map((v) => (v < 0 ? '−' + Math.abs(v) : String(v))).join(', ') + ']';
const minus = (v) => (v < 0 ? '−' + Math.abs(v) : String(v));

function parsed(code) {
  const out = {};
  LANGS.forEach((l) => { out[l] = CODE.parse(code[l], l); });
  return out;
}

/* Checks that hold for every lab step, whatever the program. */
function checkCommon(steps, program, input) {
  const code = parsed(F.labCode(program, input));
  const keys = JSON.stringify(Object.keys(steps[0].counters));
  let calls = 0, returns = 0;
  steps.forEach((s, i) => {
    assert.ok(s.caption && s.caption.length > 15, `caption at ${i}`);
    assert.equal(JSON.stringify(Object.keys(s.counters)), keys, 'counter keys stay the same');
    LANGS.forEach((l) => { if (s.line !== null) assert.ok(code[l].labels[s.line], `label ${s.line} exists in ${l}`); });
    if (s.flow !== null) assert.ok(FLOWS.has(s.flow), `flow ${s.flow}`);
    assert.equal(s.counters.depth, s.frames.length);
    assert.ok(s.counters.calls >= calls && s.counters.returns >= returns, 'counters never go down');
    calls = s.counters.calls; returns = s.counters.returns;
    assert.equal(s.counters.calls - s.counters.returns, s.frames.length, 'live frames = calls − returns');
    assert.ok(s.counters.deepest >= s.frames.length);
    // frames: main at the bottom, exactly one top frame is active/done, the rest wait
    if (s.frames.length) {
      assert.equal(s.frames[0].fn, 'main');
      s.frames.forEach((f, k) => {
        if (k < s.frames.length - 1) assert.equal(f.state, 'frontier', 'frames below the top wait');
        else assert.ok(f.state === 'active' || f.state === 'done', 'top frame runs or returns');
        f.vars.forEach((v) => assert.ok(STATES.has(v.state), 'known state ' + v.state));
      });
    }
    // references: no dangling pointer, and an array nobody points at is muted (and only then)
    const ids = new Set(s.heap.map((a) => a.id));
    const live = new Set();
    s.frames.forEach((f) => f.vars.forEach((v) => {
      if (v.ptr !== undefined) { assert.ok(ids.has(v.ptr), `dangling reference ${v.ptr} at step ${i}`); live.add(v.ptr); }
    }));
    s.heap.forEach((a) => assert.equal(a.state, live.has(a.id) ? 'default' : 'muted', `heap ${a.id} reachability at ${i}`));
    // a returning frame carries its value
    const top = s.frames[s.frames.length - 1];
    if (top && top.state === 'done' && s.frames.length > 1) assert.notEqual(top.returnValue, undefined, 'returning frame shows a value');
    // the watch panel is complete
    assert.deepEqual(Object.keys(s.vars), ['running', 'waiting', 'returned']);
    // output only ever grows
    if (i) assert.ok(s.output.length >= steps[i - 1].output.length);
  });
  assert.equal(steps[0].frames.length, 0, 'starts with an empty stack');
  const last = steps[steps.length - 1];
  assert.equal(last.frames.length, 0, 'ends with an empty stack');
  assert.equal(last.counters.calls, last.counters.returns);
  return last;
}

/* ------------------------------------------------------------ lab: area */
function checkArea(w, h) {
  const steps = F.lab('area', [w, h]);
  const last = checkCommon(steps, 'area', [w, h]);
  assert.deepEqual(last.output, [minus(refArea(w, h))]);
  assert.equal(last.counters.deepest, 3);
  assert.equal(last.counters.calls, 3);
  assert.equal(last.heap.length, 0);
  // the value that flies back is the reference answer, and it flies exactly twice
  const flies = steps.filter((s) => s.fly);
  assert.equal(flies.length, 2);
  assert.equal(flies[0].fly.value, refArea(w, h));
  assert.equal(flies[1].fly.value, refArea(w, h));
  assert.equal(flies[0].fly.from.split('(')[0], 'multiply');
  assert.equal(flies[1].fly.to.split('(')[0], 'main');
  // pop order is the reverse of push order
  const pushes = [], pops = [];
  steps.forEach((s, i) => {
    if (i && s.frames.length > steps[i - 1].frames.length) pushes.push(s.frames[s.frames.length - 1].fn);
    if (i && s.frames.length < steps[i - 1].frames.length) pops.push(steps[i - 1].frames[steps[i - 1].frames.length - 1].fn);
  });
  assert.deepEqual(pops, pushes.slice().reverse());
  return steps;
}
test('lab area: edge cases', () => {
  [[3, 4], [0, 5], [5, 0], [1, 1], [-3, 4], [-2, -6], [99, 99], [-99, 99], [0, 0]].forEach(([w, h]) => checkArea(w, h));
});
test('lab area: random inputs', () => {
  const rng = VDSA.rng(4);
  for (let t = 0; t < 60; t++) checkArea(rng.int(-99, 99), rng.int(-99, 99));
});
test('lab area: the stack peaks at three frames with the right locals', () => {
  const steps = F.lab('area', [3, 4]);
  const deepest = steps.find((s) => s.frames.length === 3 && s.kind === 'run');
  const names = deepest.frames.map((f) => f.fn);
  assert.deepEqual(names, ['main', 'area', 'multiply']);
  const mul = deepest.frames[2];
  assert.deepEqual(mul.vars.filter((v) => v.name !== '↩ to').map((v) => [v.name, v.value]), [['a', 3], ['b', 4], ['p', 12]]);
  assert.equal(mul.vars.find((v) => v.name === '↩ to').value, 'area');
  assert.equal(deepest.frames[1].vars.find((v) => v.name === 'r').value, '…', 'area is still waiting for r');
});

/* ------------------------------------------------------------ lab: total */
function checkTotal(xs) {
  const steps = F.lab('total', xs);
  const last = checkCommon(steps, 'total', xs);
  assert.deepEqual(last.output, [minus(refTotal(xs))]);
  assert.equal(last.counters.deepest, 2);
  assert.equal(last.heap.length, 1, 'the array survives the call');
  assert.equal(last.heap[0].state, 'muted', 'and is garbage once main is gone');
  assert.deepEqual(last.heap[0].fields.map((f) => f.value), xs, 'total never changes the array');
  // one array on the heap for the whole run: passing a reference copies no data
  steps.forEach((s) => assert.ok(s.heap.length <= 1, 'never a second array'));
  // while total runs, xs and scores point at the very same array
  const inside = steps.find((s) => s.frames.length === 2 && s.kind === 'bind');
  assert.equal(inside.frames[0].vars.find((v) => v.name === 'scores').ptr, inside.frames[1].vars.find((v) => v.name === 'xs').ptr);
  // running total after each add equals the prefix sum
  let prefix = 0, k = 0;
  steps.filter((s) => s.kind === 'add').forEach((s) => {
    prefix += xs[k++];
    const f = s.frames[1];
    assert.equal(f.vars.find((v) => v.name === 's').value, prefix);
  });
  assert.equal(k, xs.length);
  return steps;
}
test('lab total: edge cases', () => {
  [[], [5], [-3], [2, 2, 2], [1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1], [-99, 99, 0], [0, 0, 0]].forEach(checkTotal);
});
test('lab total: random lists', () => {
  const rng = VDSA.rng(41);
  for (let t = 0; t < 60; t++) { const a = []; const len = rng.int(0, 6); for (let i = 0; i < len; i++) a.push(rng.int(-99, 99)); checkTotal(a); }
});

/* ------------------------------------------------------------ lab: grow (mutate, then rebind) */
function checkGrow(xs) {
  const steps = F.lab('grow', xs);
  const last = checkCommon(steps, 'grow', xs);
  const want = F.grow(xs, F.GROW_V);
  assert.deepEqual(last.output, [text(want.scores) + ' ' + want.n]);
  assert.equal(last.counters.deepest, 2);
  // the two arrays: the caller's (mutated once) and the local one (built by rebinding)
  assert.equal(last.heap.length, 2);
  assert.deepEqual(last.heap[0].fields.map((f) => f.value), want.scores);
  assert.deepEqual(last.heap[1].fields.map((f) => f.value), [F.GROW_V, F.GROW_V]);
  assert.ok(last.heap.every((a) => a.state === 'muted'));
  // mutation is visible through scores; rebinding moves only xs
  const mut = steps.find((s) => s.kind === 'mutate');
  assert.equal(mut.frames[0].vars.find((v) => v.name === 'scores').ptr, mut.frames[1].vars.find((v) => v.name === 'xs').ptr);
  assert.deepEqual(mut.heap[0].fields.map((f) => f.value), xs.concat([F.GROW_V]));
  const reb = steps.find((s) => s.kind === 'rebind');
  assert.notEqual(reb.frames[0].vars.find((v) => v.name === 'scores').ptr, reb.frames[1].vars.find((v) => v.name === 'xs').ptr);
  assert.equal(reb.frames[0].vars.find((v) => v.name === 'scores').ptr, 'A1', 'scores did not move');
  // after the pop, the local array is garbage but the caller's is not
  const popped = steps.find((s) => s.kind === 'pop' && s.frames.length === 1);
  assert.equal(popped.heap[0].state, 'default');
  assert.equal(popped.heap[1].state, 'muted');
  return steps;
}
test('lab grow: edge cases', () => { [[], [1], [4, 7], [0, 0, 0], [-5, 5], [1, 2, 3, 4, 5]].forEach(checkGrow); });
test('lab grow: random lists', () => {
  const rng = VDSA.rng(77);
  for (let t = 0; t < 40; t++) { const a = []; const len = rng.int(0, 5); for (let i = 0; i < len; i++) a.push(rng.int(-99, 99)); checkGrow(a); }
});

test('labCode: every language carries the same labels, and the input appears in the source', () => {
  [['area', [3, 4]], ['area', [-2, 9]], ['total', []], ['total', [4, 7, 1]], ['grow', [4, 7]], ['grow', []]].forEach(([p, input]) => {
    const code = F.labCode(p, input);
    const sets = parsed(code);
    const names = Object.keys(sets.js.labels).sort();
    assert.ok(names.length >= 6);
    LANGS.forEach((l) => assert.deepEqual(Object.keys(sets[l].labels).sort(), names, `${p}: labels in ${l}`));
    if (p !== 'area') assert.ok(code.js.includes(F.labCode(p, input).js.split('\n').find((x) => x.includes('scores =')).trim().split('=')[1].trim().replace(/;.*$/, '').trim()));
    assert.ok(!code.js.includes('−'), 'source code uses an ASCII minus');
  });
});

/* ------------------------------------------------------------ input validation */
test('parseLabInput: friendly validation', () => {
  const P = F.parseLabInput;
  assert.deepEqual(P('area', '3, 4'), { values: [3, 4], error: null });
  assert.deepEqual(P('area', ' 3  4 ').values, [3, 4]);
  assert.deepEqual(P('area', '−3, 4').values, [-3, 4]);
  assert.ok(P('area', '3').error.includes('two numbers'));
  assert.ok(P('area', '').error);
  assert.ok(P('area', '1, 2, 3').error);
  assert.ok(P('area', '3, x').error.includes('“x”'));
  assert.ok(P('area', '2.5, 3').error);
  assert.ok(P('area', '100, 3').error);
  assert.deepEqual(P('total', '').values, []);
  assert.deepEqual(P('total', '[4, 7, 1]').values, [4, 7, 1]);
  assert.ok(P('total', '1,2,3,4,5,6,7').error);
  assert.equal(P('total', '1,2,3,4,5,6').error, null);
  assert.ok(P('grow', '1,2,3,4,5,6').error);
  assert.equal(P('grow', '1,2,3,4,5').error, null);
  assert.ok(P('grow', '-100').error);
});

/* ------------------------------------------------------------ passing into a function */
test('passing: a number is copied, so the caller never changes', () => {
  const steps = F.passing('number');
  const last = steps[steps.length - 1];
  assert.deepEqual(last.output, ['5 6']);
  const push = steps.find((s) => s.kind === 'push');
  const n = push.frames[1].vars.find((v) => v.name === 'n'), c = push.frames[0].vars.find((v) => v.name === 'count');
  assert.equal(n.value, 5); assert.equal(c.value, 5);
  const run = steps.find((s) => s.kind === 'run');
  assert.equal(run.frames[1].vars.find((v) => v.name === 'n').value, 6);
  assert.equal(run.frames[0].vars.find((v) => v.name === 'count').value, 5);
  steps.forEach((s) => assert.equal(s.heap.length, 0));
});
test('passing: mutating through a reference is seen by the caller', () => {
  const steps = F.passing('mutate');
  const last = steps[steps.length - 1];
  assert.deepEqual(last.output, ['[1, 2, 9]']);
  const push = steps.find((s) => s.kind === 'push');
  assert.equal(push.frames[0].vars.find((v) => v.name === 'list').ptr, push.frames[1].vars.find((v) => v.name === 'xs').ptr);
  assert.equal(last.heap.length, 1);
  assert.deepEqual(last.heap[0].fields.map((f) => f.value), [1, 2, 9]);
});
test('passing: rebinding a parameter breaks the link and leaves the caller alone', () => {
  const steps = F.passing('rebind');
  const last = steps[steps.length - 1];
  assert.deepEqual(last.output, ['[1, 2]']);
  const run = steps.find((s) => s.kind === 'run');
  assert.notEqual(run.frames[0].vars.find((v) => v.name === 'list').ptr, run.frames[1].vars.find((v) => v.name === 'xs').ptr);
  assert.equal(run.heap.length, 2);
  const pop = steps.find((s) => s.kind === 'pop');
  assert.equal(pop.heap[1].state, 'muted', 'the local array is unreachable after the pop');
  assert.equal(pop.heap[0].state, 'default');
  assert.deepEqual(pop.heap[0].fields.map((f) => f.value), [1, 2]);
});
test('passing: every step is a complete, consistent snapshot', () => {
  ['number', 'mutate', 'rebind'].forEach((k) => {
    const steps = F.passing(k);
    const before = JSON.stringify(steps);
    const again = JSON.stringify(F.passing(k));
    assert.equal(before, again, 'deterministic');
    steps.forEach((s) => {
      const ids = new Set(s.heap.map((a) => a.id));
      s.frames.forEach((f) => f.vars.forEach((v) => { if (v.ptr !== undefined) assert.ok(ids.has(v.ptr)); }));
      assert.ok(s.line >= 1 && s.line <= F.PASS_CODE[k].length, 'line inside the snippet');
    });
  });
});

/* ------------------------------------------------------------ nested calls with a timeline */
test('nested: hyp2(3, 4) returns 25 and calls unwind in reverse', () => {
  const steps = F.nested();
  const last = steps[steps.length - 1];
  assert.equal(last.frames.length, 0);
  const rets = steps.filter((s) => s.kind === 'ret').map((s) => s.frames[s.frames.length - 1].returnValue).filter((v) => v !== undefined);
  assert.deepEqual(rets, [9, 16, 25]);
  assert.equal(Math.max(...steps.map((s) => s.frames.length)), 3);
  // main's local d becomes 25 only after hyp2 returned
  const d = steps.filter((s) => s.frames.length === 1 && s.frames[0].locals.some((l) => l[0] === 'd' && l[1] === 25));
  assert.ok(d.length >= 2);
  // bars: 4 calls beyond main... main, hyp2, square, square; nested properly by depth
  assert.deepEqual(last.bars.map((b) => b.label), ['main()', 'hyp2(3, 4)', 'square(3)', 'square(4)']);
  assert.deepEqual(last.bars.map((b) => b.depth), [0, 1, 2, 2]);
  last.bars.forEach((b) => assert.ok(b.end > b.start));
  // a callee's bar sits inside its caller's bar
  const [m, hy, s1, s2] = last.bars;
  assert.ok(m.start <= hy.start && hy.end <= m.end);
  assert.ok(hy.start <= s1.start && s1.end <= hy.end && hy.start <= s2.start && s2.end <= hy.end);
  assert.ok(s1.end <= s2.start, 'the two square calls do not overlap');
  const code = parsed(F.NESTED_CODE);
  steps.forEach((s) => { if (s.line) LANGS.forEach((l) => assert.ok(code[l].labels[s.line], `${s.line} in ${l}`)); });
  // frame ids are never reused
  const seen = new Set();
  steps.forEach((s) => s.frames.forEach((f) => seen.add(f.id)));
  assert.equal(seen.size, 4);
});

/* ------------------------------------------------------------ value vs reference */
test('valueVsRef: numbers are copied, references are shared', () => {
  const steps = F.valueVsRef();
  const last = steps[steps.length - 1];
  assert.equal(last.outL, '5 6');
  assert.equal(last.outR, '[1, 2, 3] [1, 2, 3]');
  const copy = steps.find((s) => s.lineL === 2);
  assert.equal(copy.left.frames[0].vars[0].value, copy.left.frames[0].vars[1].value);
  assert.equal(copy.right.frames[0].vars[0].ptr, copy.right.frames[0].vars[1].ptr);
  assert.equal(copy.right.heap.length, 1, 'copying a reference does not copy the array');
  assert.equal(last.left.heap.length, 0);
  steps.forEach((s) => {
    [s.left, s.right].forEach((side) => {
      const ids = new Set(side.heap.map((a) => a.id));
      side.frames[0].vars.forEach((v) => { if (v.ptr !== undefined) assert.ok(ids.has(v.ptr)); });
    });
  });
});

/* ------------------------------------------------------------ stack overflow */
test('overflow: with a base case the stack peaks at 4 frames and empties', () => {
  const steps = F.overflow(true, 10);
  const peak = Math.max(...steps.map((s) => s.frames.length));
  assert.equal(peak, 4);
  assert.ok(steps.every((s) => !s.overflow));
  const last = steps[steps.length - 1];
  assert.equal(last.frames.length, 0);
  assert.deepEqual(last.output, ['3', '2', '1']);
  const code = parsed(F.OVERFLOW_CODE.base);
  steps.forEach((s) => LANGS.forEach((l) => assert.ok(code[l].labels[s.line], `${s.line} in ${l}`)));
});
test('overflow: without a base case it crashes exactly when the limit is passed', () => {
  [1, 3, 6, 10, 12].forEach((cap) => {
    const steps = F.overflow(false, cap);
    const last = steps[steps.length - 1];
    assert.equal(last.overflow, true);
    assert.equal(last.frames.length, cap + 1, 'the frame that does not fit');
    assert.equal(last.frames[cap].state, 'error');
    assert.equal(steps.filter((s) => s.overflow).length, 1, 'it stops at the first overflow');
    assert.ok(steps.slice(0, -1).every((s) => s.frames.length <= cap));
    const code = parsed(F.OVERFLOW_CODE.none);
    steps.forEach((s) => LANGS.forEach((l) => assert.ok(code[l].labels[s.line])));
  });
});
test('overflow: a limit smaller than the base-case depth also crashes', () => {
  const steps = F.overflow(true, 3);
  assert.equal(steps[steps.length - 1].overflow, true);
});

/* ------------------------------------------------------------ jumps, notes, argFlight, teaser */
test('jumps: each return goes back to the note left by that call', () => {
  const steps = F.jumps();
  const calls = steps.filter((s) => s.arrow && s.arrow.kind === 'call'), rets = steps.filter((s) => s.arrow && s.arrow.kind === 'ret');
  assert.equal(calls.length, 2); assert.equal(rets.length, 2);
  calls.forEach((c, i) => {
    assert.deepEqual(c.notes, [c.arrow.from], 'the note records the calling line');
    assert.equal(rets[i].arrow.to, c.arrow.from, 'return lands where the note said');
    assert.equal(rets[i].notes.length, 0, 'the note is used up');
  });
  const last = steps[steps.length - 1];
  assert.deepEqual(last.values, { kitchen: 12, hall: 10, total: 22 });
  steps.forEach((s) => assert.ok(s.line >= 1 && s.line <= F.JUMP_LINES.length));
});
test('notes: a stack of interruptions, newest first', () => {
  const steps = F.notes();
  assert.deepEqual(steps.map((s) => s.items.length), [0, 1, 2, 1, 0]);
  assert.equal(steps[2].items[1].id, 'n2');
  assert.equal(steps[3].items[0].id, 'n1');
});
test('argFlight: numbers in the caption match the arguments', () => {
  [[3, 4], [0, 9], [-2, 5], [12, 12]].forEach(([w, h]) => {
    const steps = F.argFlight(w, h);
    assert.equal(steps.length, 6);
    steps.forEach((s) => { assert.equal(s.p, w * h); assert.ok(s.caption.length > 20); });
    assert.ok(steps[4].caption.includes(minus(w * h)));
  });
});
test('teaser: balanced push/pop, references re-route, garbage is muted before it goes', () => {
  const steps = F.teaser(3, 4);
  assert.equal(steps[0].frames.length, 1);
  const last = steps[steps.length - 1];
  assert.equal(last.frames.length, 1);
  assert.equal(last.frames[0].vars.find((v) => v.name === 's').value, 12);
  assert.equal(last.heap.length, 1);
  const mutedStep = steps.find((s) => s.heap.some((a) => a.state === 'muted'));
  assert.ok(mutedStep, 'the old array is drawn muted before it is removed');
  assert.ok(steps.filter((s) => s.fly).length >= 2);
  steps.forEach((s) => {
    const ids = new Set(s.heap.map((a) => a.id));
    s.frames.forEach((f) => f.vars.forEach((v) => { if (v.ptr !== undefined) assert.ok(ids.has(v.ptr)); }));
  });
});

/* ------------------------------------------------------------ steps are never shared or mutated */
test('steps are independent snapshots', () => {
  const steps = F.lab('grow', [4, 7]);
  const a = JSON.stringify(steps);
  steps[3].frames[0].vars.push({ name: 'x', value: 1 });
  const fresh = F.lab('grow', [4, 7]);
  assert.equal(JSON.stringify(fresh), a);
  for (let i = 1; i < fresh.length; i++) assert.notEqual(fresh[i].frames, fresh[i - 1].frames);
});

/* ------------------------------------------------------------ variations lab */
/* Reference: run the same programs as plain JavaScript and compare what they print. */
const variantRef = {
  pure: () => { const bumped = (xs) => xs.map((x) => x + 1); const a = [1, 2]; const b = bumped(a); return text(a) + ' ' + text(b); },
  effect: () => { let count = 0; const next = () => { count += 1; return count; }; const a = next(); const b = next(); return a + ' ' + b; },
  copy: () => { const withNine = (xs) => { const ys = xs.slice(); ys.push(9); return ys; }; const a = [1, 2]; const b = withNine(a); return text(a) + ' ' + text(b); },
  swap: () => { const swap = (x, y) => { const t = x; x = y; y = t; }; const a = 1, b = 2; swap(a, b); return a + ' ' + b; },
  swapArr: () => { const swap = (xs, i, j) => { const t = xs[i]; xs[i] = xs[j]; xs[j] = t; }; const a = [1, 2]; swap(a, 0, 1); return text(a); }
};
test('variant: every program prints what real JavaScript prints', () => {
  Object.keys(variantRef).forEach((k) => {
    const steps = F.variant(k);
    assert.deepEqual(steps[steps.length - 1].output, [variantRef[k]()], k);
    assert.equal(steps[0].frames[0].fn, 'global');
    assert.ok(steps.length >= 6 && steps.length <= 12, k + ' stays short enough to read');
  });
});
test('variant: snapshots are consistent and lines exist in the source', () => {
  Object.keys(variantRef).forEach((k) => {
    const steps = F.variant(k), n = F.VARIANT_CODE[k].length;
    const keys = JSON.stringify(Object.keys(steps[0].counters));
    steps.forEach((s, i) => {
      assert.ok(s.caption.length > 20);
      assert.ok(Number.isInteger(s.line) && s.line >= 1 && s.line <= n, `${k}: line ${s.line}`);
      assert.equal(JSON.stringify(Object.keys(s.counters)), keys);
      assert.equal(s.frames[0].fn, 'global', 'the global frame stays at the bottom');
      const ids = new Set(s.heap.map((a) => a.id)), live = new Set();
      s.frames.forEach((f) => f.vars.forEach((v) => { if (v.ptr !== undefined) { assert.ok(ids.has(v.ptr), `${k}: dangling ${v.ptr} at ${i}`); live.add(v.ptr); } }));
      s.heap.forEach((a) => assert.equal(a.state, live.has(a.id) ? 'default' : 'muted', `${k}: ${a.id} at ${i}`));
    });
    assert.equal(steps[steps.length - 1].frames.length, 1, 'only the global frame is left');
  });
});
test('variant: pure and copy leave the caller’s array alone; swapArr and effect change shared state', () => {
  ['pure', 'copy'].forEach((k) => {
    const last = F.variant(k).slice(-1)[0];
    assert.equal(last.heap.length, 2);
    assert.deepEqual(last.heap[0].fields.map((f) => f.value), [1, 2], 'the caller’s array is unchanged');
    assert.ok(last.heap.every((a) => a.state === 'default'), 'both arrays are still referenced (a and b)');
    const g = last.frames[0].vars;
    assert.notEqual(g.find((v) => v.name === 'a').ptr, g.find((v) => v.name === 'b').ptr);
  });
  const arr = F.variant('swapArr');
  assert.deepEqual(arr[arr.length - 1].heap[0].fields.map((f) => f.value), [2, 1]);
  const mid = arr.find((s) => s.kind === 'mutate');
  assert.equal(mid.frames[0].vars.find((v) => v.name === 'a').ptr, mid.frames[1].vars.find((v) => v.name === 'xs').ptr);
  const eff = F.variant('effect');
  assert.deepEqual(eff[eff.length - 1].frames[0].vars.map((v) => [v.name, v.value]).filter((x) => x[0] !== '↩ to'), [['count', 2], ['a', 1], ['b', 2]]);
  const sw = F.variant('swap');
  const inside = sw.find((s) => s.line === 4);
  assert.equal(inside.frames[1].vars.find((v) => v.name === 'x').value, 2);
  assert.equal(inside.frames[0].vars.find((v) => v.name === 'a').value, 1, 'the caller’s a never moves');
});
test('variant: unknown kind throws', () => { assert.throws(() => F.variant('nope')); });
