/* Lesson 03 · Decisions & loops — step generator tests (node --test tests/algos/03-control-flow.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const V = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const L = require(path.join(ROOT, 'js', 'algos', '03-control-flow.js'));
const CODE = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

function wellFormed(steps, counterKeys) {
  assert.ok(steps.length >= 1);
  steps.forEach((s, k) => {
    assert.equal(typeof s.caption, 'string', 'caption at ' + k);
    assert.ok(s.caption.length > 5, 'caption at ' + k);
    if (counterKeys) assert.deepEqual(Object.keys(s.counters), counterKeys, 'counter keys at ' + k);
  });
}
/* Consecutive flow nodes must be joined by an edge (so the flowchart token always has a path to travel). */
function flowPathOk(steps, key, edges) {
  for (let k = 1; k < steps.length; k++) {
    const a = steps[k - 1][key], b = steps[k][key];
    if (a === b) continue;
    assert.ok(edges.has(a + '->' + b) || edges.has(b + '->' + a), 'no edge ' + a + ' -> ' + b + ' (step ' + k + ')');
  }
}

/* ------------------------------------------------------------------ countLoop (hero) */
test('countLoop: tests once more than it counts, ends with count = limit', () => {
  for (const limit of [0, 1, 3, 5]) {
    const steps = L.countLoop(limit);
    wellFormed(steps);
    const tests = steps.filter(s => s.active === 'test');
    assert.equal(tests.length, limit + 1);
    assert.equal(tests[tests.length - 1].test, false);
    assert.ok(tests.slice(0, -1).every(s => s.test === true));
    assert.equal(steps.filter(s => s.active === 'body').length, limit);
    assert.equal(steps[steps.length - 1].count, limit);
    flowPathOk(steps, 'active', new Set(['init->test', 'test->body', 'body->test', 'test->done']));
  }
});

/* ------------------------------------------------------------------ logic */
test('truth tables match JavaScript operators', () => {
  for (const a of [false, true]) {
    assert.equal(L.truth('not', a), !a);
    for (const b of [false, true]) {
      assert.equal(L.truth('and', a, b), a && b);
      assert.equal(L.truth('or', a, b), a || b);
    }
  }
  assert.deepEqual(L.truthTable('and').map(r => r.out), [false, false, false, true]);
  assert.deepEqual(L.truthTable('or').map(r => r.out), [false, true, true, true]);
  assert.deepEqual(L.truthTable('not').map(r => r.out), [true, false]);
  assert.throws(() => L.truth('xor', true, false));
});

test('compareAll agrees with the language operators on random pairs', () => {
  const rng = V.rng(3);
  for (let t = 0; t < 200; t++) {
    const a = rng.int(-10, 10), b = rng.int(-10, 10);
    const got = Object.fromEntries(L.compareAll(a, b).map(c => [c.op, c.value]));
    assert.deepEqual(got, { '<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a === b, '!=': a !== b });
  }
});

/* ------------------------------------------------------------------ if / else-if / else */
test('batteryPath: the good order always matches the rule; the bad order is wrong exactly for levels ≥ 50', () => {
  for (let level = 0; level <= 100; level++) {
    const good = L.batteryPath(level, 'good');
    const want = level >= 50 ? 'green' : level >= 20 ? 'amber' : 'red';
    assert.equal(good.result, want, 'good ' + level);
    assert.equal(good.correct, want);
    assert.equal(good.path[0], 'start');
    assert.equal(good.path[good.path.length - 1], 'end');
    assert.equal(good.path[good.path.length - 2], want);
    // only the tests up to the first true one run
    assert.equal(good.tests.filter(t => t.value).length, want === 'red' ? 0 : 1);
    assert.equal(good.tests[good.tests.length - 1].value, want !== 'red');
    const bad = L.batteryPath(level, 'bad');
    assert.equal(bad.result === want, level < 50, 'bad ' + level);
    if (level >= 50) assert.equal(bad.result, 'amber');
  }
  // boundaries are inclusive
  assert.equal(L.batteryPath(50, 'good').result, 'green');
  assert.equal(L.batteryPath(49, 'good').result, 'amber');
  assert.equal(L.batteryPath(20, 'good').result, 'amber');
  assert.equal(L.batteryPath(19, 'good').result, 'red');
});

/* ------------------------------------------------------------------ while: tickets */
test('ticketTrace: n tickets → n trips, n + 1 tests, zero trips for 0', () => {
  for (let start = 0; start <= 8; start++) {
    const steps = L.ticketTrace(start);
    wellFormed(steps, ['tests', 'trips']);
    const last = steps[steps.length - 1];
    assert.equal(last.kind, 'done');
    assert.equal(last.counters.trips, start);
    assert.equal(last.counters.tests, start + 1);
    assert.equal(last.tickets, 0);
    assert.deepEqual(last.left, []);
    assert.deepEqual(last.out, Array.from({ length: start }, (_, k) => start - k), 'handed out from the top');
    // every ticket is either in the box or handed out, never both, never lost
    steps.forEach(s => {
      assert.equal(s.left.length + s.out.length, start);
      assert.equal(new Set(s.left.concat(s.out)).size, start);
    });
    const tests = steps.filter(s => s.kind === 'test');
    assert.equal(tests[tests.length - 1].test, false);
    assert.equal(tests[tests.length - 1].tickets, 0);
    flowPathOk(steps, 'flow', new Set(['init->test', 'test->body', 'body->update', 'update->test', 'test->done']));
  }
});

/* ------------------------------------------------------------------ jumps */
test('jumpTrace: prints 0..limit−1, pc moves by one except on jumps', () => {
  for (const limit of [0, 1, 3, 4]) {
    const steps = L.jumpTrace(limit);
    wellFormed(steps, ['jumps']);
    const last = steps[steps.length - 1];
    assert.equal(last.pc, 6);
    assert.deepEqual(last.out, Array.from({ length: limit }, (_, k) => k));
    assert.equal(last.counters.jumps, limit + 1, 'one jump back per trip plus the jump out');
    for (let k = 1; k < steps.length; k++) {
      const a = steps[k - 1].pc, b = steps[k].pc;
      if (steps[k].jump) { assert.equal(steps[k].jump.from, a); assert.equal(steps[k].jump.to, b); }
      else assert.equal(b, a + 1, 'fall through from ' + a);
    }
  }
});

/* ------------------------------------------------------------------ counted loops (lab) */
function refLoop(from, to, step, body) {
  let acc = 0, tests = 0, runs = 0; const seen = [];
  for (let i = from; ; i += step) {
    tests++;
    if (!(step > 0 ? i <= to : i >= to)) break;
    runs++; seen.push(i); acc += body === 'count' ? 1 : i;
  }
  return { acc, tests, runs, seen };
}
function checkLoop(spec) {
  const steps = L.loopTrace(spec);
  wellFormed(steps, ['tests', 'runs']);
  const s = Object.assign({ from: 1, to: 5, step: 1, body: 'sum' }, spec);
  const ref = refLoop(s.from, s.to, s.step, s.body);
  const last = steps[steps.length - 1];
  assert.equal(last.kind, 'done');
  assert.equal(last.acc, ref.acc, 'result for ' + JSON.stringify(spec));
  assert.equal(last.counters.tests, ref.tests);
  assert.equal(last.counters.runs, ref.runs);
  assert.equal(last.counters.tests, last.counters.runs + 1, 'always one more test than body runs');
  assert.deepEqual(L.loopValues(s), ref.seen);
  assert.equal(L.loopCount(s), ref.runs);
  assert.deepEqual(last.cols.map(c => c.i), ref.seen);
  // trace table: one row per test, the last one false; accumulator column is the running value
  assert.equal(last.rows.length, ref.tests);
  assert.ok(last.rows.slice(0, -1).every(r => r.test === true));
  assert.equal(last.rows[last.rows.length - 1].test, false);
  let run = 0;
  last.rows.slice(0, -1).forEach((r, k) => { run += s.body === 'count' ? 1 : ref.seen[k]; assert.equal(r.acc, run); assert.equal(r.trip, k + 1); assert.equal(r.i, ref.seen[k]); });
  assert.equal(last.exit, ref.seen.length ? ref.seen[ref.seen.length - 1] + s.step : s.from);
  // each step's line exists in every language of the generated code
  const code = L.loopCode(s);
  for (const lang of ['pseudo', 'js', 'py']) {
    const labels = CODE.parse(code[lang], lang).labels;
    steps.forEach(st => assert.ok(labels[st.line], lang + ' has @' + st.line));
  }
  // flow ids are joined by edges
  flowPathOk(steps, 'flow', new Set(['init->setI', 'setI->test', 'test->body', 'body->update', 'update->test', 'test->done']));
  // vars never claim an i before it exists
  assert.ok(!('i' in steps[0].vars));
  return steps;
}
test('loopTrace matches a reference loop on presets and edge cases', () => {
  checkLoop({});                                          // 1..5 → 15
  checkLoop({ from: 1, to: 0 });                          // zero trips
  checkLoop({ from: 3, to: 3 });                          // one trip
  checkLoop({ from: -3, to: 3 });                         // negative range, sums to 0
  checkLoop({ from: 1, to: 9, step: 2 });                 // odd numbers
  checkLoop({ from: 5, to: 1, step: -1 });                // countdown
  checkLoop({ from: 5, to: 1, step: 1 });                 // wrong direction: zero trips
  checkLoop({ from: 1, to: 5, body: 'count' });
  checkLoop({ from: 0, to: 10, step: 3 });                // 0, 3, 6, 9; exits at 12
  checkLoop({ from: -20, to: -9, step: 1 });              // 12 trips, all negative
  assert.equal(L.loopTrace({}).slice(-1)[0].acc, 15);
});
test('loopTrace on random valid loops', () => {
  const rng = V.rng(33);
  let tried = 0;
  while (tried < 300) {
    const spec = { from: rng.int(-20, 30), to: rng.int(-20, 30), step: rng.pick([-5, -3, -2, -1, 1, 2, 3, 5]), body: rng.pick(['sum', 'count']) };
    if (L.validateLoop(spec)) continue;
    checkLoop(spec);
    tried++;
  }
});
test('validateLoop gives friendly errors', () => {
  assert.equal(L.validateLoop({ from: 1, to: 5, step: 1 }), null);
  assert.match(L.validateLoop({ from: 1, to: 5, step: 0 }), /never/);
  assert.match(L.validateLoop({ from: 1, to: 50, step: 1 }), /between/);
  assert.match(L.validateLoop({ from: 1, to: 30, step: 1 }), /30 times/);
  assert.match(L.validateLoop({ from: 1.5, to: 5, step: 1 }), /whole number/);
  assert.match(L.validateLoop({ from: 1, to: 5, step: 9 }), /step/);
  assert.throws(() => L.loopTrace({ from: 1, to: 5, step: 0 }));
});
test('loopCode: Python range stop matches the inclusive test', () => {
  const up = L.loopCode({ from: 1, to: 5, step: 1 });
  assert.match(up.py, /range\(1, 6\)/);
  assert.match(up.js, /i <= 5; i\+\+/);
  const down = L.loopCode({ from: 5, to: 1, step: -2 });
  assert.match(down.py, /range\(5, 0, -2\)/);
  assert.match(down.js, /i >= 1; i -= 2/);
  assert.match(down.pseudo, /down to 1 step −2/);
});

/* ------------------------------------------------------------------ off-by-one */
test('fenceTrace: the four variants read exactly the right boxes', () => {
  for (let n = 1; n <= 8; n++) {
    for (const start of [0, 1]) {
      for (const cmp of ['<', '<=']) {
        const steps = L.fenceTrace(n, start, cmp);
        wellFormed(steps, ['runs', 'outOfBounds', 'missed']);
        const want = [];
        for (let i = start; cmp === '<' ? i < n : i <= n; i++) want.push(i);
        const last = steps[steps.length - 1];
        assert.equal(last.kind, 'exit');
        assert.deepEqual(last.reads, want);
        assert.equal(last.counters.runs, want.length);
        assert.equal(last.oob, cmp === '<=', 'out of bounds iff <=');
        assert.deepEqual(last.missed, start ? [0] : []);
        assert.equal(last.i, cmp === '<' ? n : n + 1, 'exit value');
      }
    }
  }
  const good = L.fenceTrace(5, 0, '<').slice(-1)[0];
  assert.match(good.caption, /Correct/);
  assert.match(L.fenceTrace(5, 1, '<=').slice(-1)[0].caption, /Right count, wrong boxes/);
});

/* ------------------------------------------------------------------ infinite loops */
test('fuelTrace agrees with terminates() and never lies about exit', () => {
  for (const cond of ['!=', '<']) {
    for (const up of Object.keys(L.UPDATES)) {
      const steps = L.fuelTrace(cond, up);
      wellFormed(steps, ['trips', 'fuel']);
      const last = steps[steps.length - 1];
      const t = L.terminates(cond, up);
      if (last.kind === 'exit') {
        assert.ok(t.stops);
        assert.equal(last.trips, t.trips);
        assert.equal(cond === '<' ? last.i < 10 : last.i !== 10, false, 'exit only when the test is false');
      } else {
        assert.equal(last.kind, 'empty');
        assert.equal(last.fuel, 0);
        assert.equal(t.stops, false, cond + ' ' + up + ' should run forever');
      }
      // fuel drains by one per trip, hops record every value
      steps.forEach(s => { assert.equal(s.fuel + s.trips, s.fuelMax); assert.equal(s.hops.length, s.trips + 1); });
    }
  }
  // the lesson's claims
  assert.equal(L.terminates('!=', '+1').stops, true);
  assert.equal(L.terminates('!=', '+2').stops, false);   // jumps over 10
  assert.equal(L.terminates('<', '+2').stops, true);
  assert.equal(L.terminates('<', '-1').stops, false);
  assert.equal(L.terminates('<', 'same').stops, false);
  assert.equal(L.terminates('<', '*2').stops, true);
  assert.equal(L.terminates('!=', '*2').stops, false);
});

/* ------------------------------------------------------------------ nested loops */
test('nestedTrace visits every cell (or pair) exactly once, in row-major order', () => {
  for (let n = 1; n <= 8; n++) {
    for (let m = 1; m <= 8; m++) {
      const steps = L.nestedTrace(n, m, 'rect');
      wellFormed(steps, ['visits']);
      const last = steps[steps.length - 1];
      const want = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) want.push(i + ',' + j);
      assert.deepEqual(last.visited, want);
      assert.equal(last.counters.visits, L.nestedCount(n, m, 'rect'));
    }
    const tri = L.nestedTrace(n, 99, 'tri');
    const last = tri[tri.length - 1];
    const want = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) want.push(i + ',' + j);
    assert.deepEqual(last.visited, want);
    assert.equal(last.counters.visits, n * (n - 1) / 2);
    assert.equal(tri.filter(s => s.kind === 'outer').length, n, 'the outer loop runs n times even when the inner runs 0');
  }
});

/* ------------------------------------------------------------------ break / continue */
test('breakContinueTrace: break stops at the first negative, continue sums the positives', () => {
  const rng = V.rng(8);
  const cases = [[], [5], [-5], [3, 8, -2, 7, -4], [1, 2, 3], [-1, -2], [4, -1]];
  for (let t = 0; t < 100; t++) cases.push(Array.from({ length: rng.int(0, 9) }, () => rng.int(-9, 9)));
  for (const a of cases) {
    const br = L.breakContinueTrace(a, 'break');
    wellFormed(br, ['looked', 'skipped']);
    const firstNeg = a.findIndex(x => x < 0);
    const lb = br[br.length - 1];
    assert.equal(lb.kind, 'done');
    assert.equal(lb.acc, firstNeg === -1 ? null : a[firstNeg]);
    assert.equal(lb.counters.looked, firstNeg === -1 ? a.length : firstNeg + 1);
    if (firstNeg !== -1) {
      assert.equal(lb.states[firstNeg], 'found');
      lb.states.slice(firstNeg + 1).forEach(s => assert.equal(s, 'muted', 'never looked at after break'));
    }
    flowPathOk(br, 'flow', new Set(['start->loop', 'loop->test', 'test->act', 'test->loop', 'act->done', 'loop->done']));

    const co = L.breakContinueTrace(a, 'continue');
    wellFormed(co, ['looked', 'skipped']);
    const lc = co[co.length - 1];
    assert.equal(lc.acc, a.filter(x => x >= 0).reduce((s, x) => s + x, 0));
    assert.equal(lc.counters.skipped, a.filter(x => x < 0).length);
    assert.equal(lc.counters.looked, a.length);
    a.forEach((x, k) => assert.equal(lc.states[k], x < 0 ? 'muted' : 'done'));
    flowPathOk(co, 'flow', new Set(['start->loop', 'loop->test', 'test->act', 'test->loop', 'act->loop', 'loop->done']));
  }
});

/* ------------------------------------------------------------------ FizzBuzz */
test('fizzbuzzTrace prints the classic sequence and the first true test wins', () => {
  const ref = i => (i % 3 === 0 && i % 5 === 0) ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : String(i);
  for (const n of [0, 1, 5, 15, 30]) {
    const steps = L.fizzbuzzTrace(n);
    wellFormed(steps, ['printed', 'tests']);
    const last = steps[steps.length - 1];
    assert.deepEqual(last.out.map(o => o.text), Array.from({ length: n }, (_, k) => ref(k + 1)));
    assert.equal(last.flow, 'test');
    assert.equal(last.cond, false);
    flowPathOk(steps, 'flow', new Set(['init->test', 'test->t15', 't15->p15', 't15->t3', 't3->p3', 't3->t5', 't5->p5', 't5->pn',
      'p15->inc', 'p3->inc', 'p5->inc', 'pn->inc', 'inc->test']));
  }
  // 15 goes to the FizzBuzz box, not Fizz
  const s = L.fizzbuzzTrace(15);
  const at15 = s.filter(x => x.i === 15 && /^p/.test(x.flow));
  assert.deepEqual(at15.map(x => x.flow), ['p15']);
});

/* ------------------------------------------------------------------ cost */
test('iteration counts', () => {
  for (let n = 1; n <= 200; n++) {
    assert.equal(L.ITER.halving(n), L.halvingTrips(n));
    assert.equal(L.ITER.triangle(n), L.nestedCount(n, n, 'tri'));
    assert.equal(L.ITER.nested(n), L.nestedCount(n, n, 'rect'));
  }
  assert.equal(L.ITER.halving(0), 0);
  assert.equal(L.ITER.halving(1000), 10);
});

/* ------------------------------------------------------------------ the lesson's real flowchart specs */
test('flowchart specs: every traced flow id exists, consecutive nodes share an edge, and every edge routes cleanly', () => {
  const FC = require(path.join(ROOT, 'js', 'vdsa', 'views', 'flowchart.js'));
  const saved = global.window;
  global.window = { VDSA: { h() {}, s() {}, lessons: {}, algos: { lesson03: L } } };
  let S;
  try {
    require(path.join(ROOT, 'js', 'lessons', '03-control-flow-figs.js'));
    S = global.window.VDSA.lessons.cf.specs;
  } finally { global.window = saved; }
  const edgeSet = (spec) => new Set(spec.edges.map((e) => e.from + '->' + e.to));
  const ids = (spec) => new Set(spec.nodes.map((n) => n.id));
  const check = (name, spec, flows) => {
    const have = ids(spec), edges = edgeSet(spec);
    flows.forEach((f, k) => {
      assert.ok(have.has(f), name + ': unknown node ' + f);
      if (k && f !== flows[k - 1]) assert.ok(edges.has(flows[k - 1] + '->' + f) || edges.has(f + '->' + flows[k - 1]), name + ': no edge ' + flows[k - 1] + ' -> ' + f);
    });
    [1000, 360].forEach((w) => {
      const routes = FC.route(spec, FC.compute(spec, w, {}));
      routes.forEach((r, i) => { assert.ok(r && r.clear, name + ': edge ' + spec.edges[i].from + ' -> ' + spec.edges[i].to + ' is not routed cleanly at width ' + w); });
    });
  };
  check('hero', S.hero, L.countLoop(3).map((s) => s.flow));
  [{ from: 1, to: 5, step: 1, body: 'sum' }, { from: 5, to: 1, step: -1, body: 'sum' }, { from: 5, to: 1, step: 1, body: 'count' }].forEach((sp) =>
    check('loop', S.loop(sp), L.loopTrace(sp).map((s) => s.flow)));
  [0, 1, 5].forEach((n) => check('tickets', S.tickets(n), L.ticketTrace(n).map((s) => s.flow)));
  check('fizz', S.fizz, L.fizzbuzzTrace(20).map((s) => s.flow));
  ['break', 'continue'].forEach((mode) => [[4, 7, -2, 9], [3, 8], [], [-1]].forEach((vals) =>
    check('break-' + mode, S.breakMode(mode), L.breakContinueTrace(vals, mode).map((s) => s.flow))));
  ['good', 'bad'].forEach((order) => {
    for (let level = 0; level <= 100; level += 5) check('battery-' + order, S.battery(order), L.batteryPath(level, order).path);
  });
});
