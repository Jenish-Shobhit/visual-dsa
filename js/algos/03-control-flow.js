/* Lesson 03 · Decisions & loops — pure step generators (no DOM).

   Browser: VDSA.algos.lesson03.loopTrace({from: 1, to: 5, step: 1, body: 'sum'}) … (after js/vdsa/core.js)
   Node:    require('js/algos/03-control-flow.js').loopTrace({from: 1, to: 5})

   Every generator returns plain snapshot objects (docs/ENGINE.md → "Step conventions"): a step is a complete
   picture, items keep stable ids, and colours only claim what is true. Flowchart node ids live in `flow`
   (and `active` for the hero), code labels in `line`.

   Contents
     countLoop(limit)                     hero teaser + "loop" mini: count up to a limit, then exit
     truth(op, a, b), truthTable(op)      AND / OR / NOT
     compareAll(a, b)                     the six comparison operators on two numbers
     batteryPath(level, order)            if / else-if / else: which tests run, which branch wins
     ticketTrace(start)                   while loop: hand out tickets until none are left
     jumpTrace(limit)                     the same loop as numbered instructions with jumps (program counter)
     loopValues(spec), loopCount(spec)    the values a counted for-loop gives i (reference)
     validateLoop(spec)                   friendly error or null
     loopCode(spec)                       pseudocode / JavaScript / Python for the lab loop
     loopTrace(spec)                      the lab: for i from a to b step s: total += i (or count += 1)
     fenceTrace(n, start, cmp)            off-by-one: for (i = start; i CMP n; i++) read a[i]
     fuelTrace(cond, update, opts)        infinite-loop detector: a fuel budget of trips
     terminates(cond, update, opts)       does that loop stop? (bounded simulation)
     nestedTrace(n, m, shape), nestedCount(n, m, shape)   nested loops as a grid of (i, j) visits
     breakContinueTrace(values, mode)     break (stop at the first negative) / continue (skip negatives)
     fizz(i), fizzbuzzTrace(n)            FizzBuzz through a flowchart
     ITER                                 iteration counts for the cost chart
*/
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.lesson03 = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Minus sign for captions: "−4" reads better than "-4". */
  function num(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function plural(k, word, many) { return k + ' ' + (k === 1 ? word : (many || word + 's')); }
  function times(k) { return k === 1 ? 'once' : k === 2 ? 'twice' : k + ' times'; }

  /* ================================================================ count up to a limit (hero, loop mini)
     count ← 0; while count < limit: count ← count + 1; done.
     Step: {active (flow id), flow, visited, count, test (bool|null), trips, caption}. */
  function countLoop(limit) {
    limit = limit === undefined ? 3 : limit;
    var steps = [], visited = [], count = 0;
    function go(active, test, caption) {
      steps.push({ active: active, flow: active, visited: visited.slice(), count: count, trips: count, test: test, caption: caption });
      if (visited.indexOf(active) === -1) visited.push(active);
    }
    go('init', null, 'Set <b>count = 0</b>. Nothing has been counted yet.');
    for (;;) {
      var ok = count < limit;
      go('test', ok, ok
        ? 'Is ' + count + ' &lt; ' + limit + '? Yes, so the token goes round the loop again.'
        : 'Is ' + count + ' &lt; ' + limit + '? No. The test is false for the first time, so the token leaves the loop.');
      if (!ok) break;
      count++;
      go('body', null, 'Add one: <b>count = ' + count + '</b>. The body changes the value the test will look at next.');
    }
    go('done', null, 'Done after ' + plural(count, 'trip') + ' round the loop.');
    return steps;
  }

  /* ================================================================ Boolean logic */
  var OPS = {
    and: { label: 'AND', js: '&&', py: 'and', circuit: 'series' },
    or: { label: 'OR', js: '||', py: 'or', circuit: 'parallel' },
    not: { label: 'NOT', js: '!', py: 'not', circuit: 'bypass' }
  };
  function truth(op, a, b) {
    if (op === 'and') return !!(a && b);
    if (op === 'or') return !!(a || b);
    if (op === 'not') return !a;
    throw new Error('unknown operator ' + op);
  }
  /* Rows in the usual order: false before true, A changes slowest. */
  function truthTable(op) {
    if (op === 'not') return [false, true].map(function (a, k) { return { id: 'r' + k, a: a, out: truth('not', a) }; });
    var rows = [];
    [false, true].forEach(function (a) { [false, true].forEach(function (b) { rows.push({ id: 'r' + rows.length, a: a, b: b, out: truth(op, a, b) }); }); });
    return rows;
  }

  /* The six comparison operators. `code` is written the way JavaScript and Python share it. */
  function compareAll(a, b) {
    return [
      { op: '<', text: 'a < b', value: a < b },
      { op: '<=', text: 'a <= b', value: a <= b },
      { op: '>', text: 'a > b', value: a > b },
      { op: '>=', text: 'a >= b', value: a >= b },
      { op: '==', text: 'a == b', value: a === b },
      { op: '!=', text: 'a != b', value: a !== b }
    ];
  }

  /* ================================================================ if / else-if / else: the battery icon
     order 'good': if level >= 50 → green, else if level >= 20 → amber, else red.
     order 'bad' : the same tests with the smaller threshold first, so every level ≥ 20 shows amber.
     Returns {path: [flow ids start … end], result, tests: [{id, limit, value}], correct}. */
  var BATTERY = {
    good: [{ id: 't1', limit: 50, result: 'green' }, { id: 't2', limit: 20, result: 'amber' }],
    bad: [{ id: 't1', limit: 20, result: 'amber' }, { id: 't2', limit: 50, result: 'green' }]
  };
  function batteryPath(level, order) {
    var tests = BATTERY[order === 'bad' ? 'bad' : 'good'];
    var path = ['start'], ran = [], result = 'red';
    for (var k = 0; k < tests.length; k++) {
      var t = tests[k], v = level >= t.limit;
      path.push(t.id); ran.push({ id: t.id, limit: t.limit, value: v });
      if (v) { result = t.result; break; }
    }
    path.push(result, 'end');
    var correct = level >= 50 ? 'green' : level >= 20 ? 'amber' : 'red';
    return { path: path, result: result, tests: ran, correct: correct };
  }

  /* ================================================================ while loop: hand out tickets
     tickets ← start; while tickets > 0: give ticket #tickets; tickets ← tickets − 1; print "sold out".
     Step: {kind, flow, line, tickets, left: [ticket numbers in the box], out: [handed out, in order],
            test (bool|null), caption, vars, counters {tests, trips}}. */
  function ticketTrace(start) {
    var steps = [], tickets = start, out = [], tests = 0, trips = 0, left = [];
    for (var k = 1; k <= start; k++) left.push(k);
    function push(kind, flow, line, test, caption) {
      steps.push({ kind: kind, flow: flow, line: line, tickets: tickets, left: left.slice(), out: out.slice(), test: test,
        caption: caption, vars: { tickets: tickets }, counters: { tests: tests, trips: trips } });
    }
    push('init', 'init', 'init', null, start
      ? 'Put ' + plural(start, 'ticket') + ' in the box: <b>tickets = ' + start + '</b>. The loop has not asked anything yet.'
      : 'The box starts empty: <b>tickets = 0</b>. The loop has not asked anything yet.');
    for (;;) {
      tests++;
      var ok = tickets > 0;
      if (!ok) {
        push('test', 'test', 'test', false, start === 0
          ? 'Is 0 &gt; 0? No, so the loop is skipped entirely. A while loop tests <em>before</em> the first trip, so its body can run zero times.'
          : 'Is 0 &gt; 0? No. This is the test that stops the loop: it ran ' + plural(tests, 'time') + ', one more than the body, because the last test is the one that says “stop”.');
        break;
      }
      push('test', 'test', 'test', true, 'Is ' + tickets + ' &gt; 0? Yes, so the body runs.');
      trips++;
      var handed = left.pop();
      out.push(handed);
      push('give', 'body', 'body', null, 'Hand out ticket #' + handed + '. The box now holds ' + left.length + ', but the variable still says <b>tickets = ' + tickets + '</b>: nothing changes it until the next line runs.');
      tickets--;
      push('update', 'update', 'update', null, '<b>tickets = ' + (tickets + 1) + ' − 1 = ' + tickets + '</b>. This line is the loop’s progress: every trip brings tickets one step closer to 0, where the test turns false.');
    }
    push('done', 'done', 'done', null, 'Print “sold out”. The body ran ' + times(trips) + ' and the test ran ' + times(tests) + '.');
    return steps;
  }

  /* ================================================================ the loop as jumps (what the CPU sees)
     1  i = 0 · 2  if i ≥ limit, jump to 6 · 3  print i · 4  i = i + 1 · 5  jump to 2 · 6  print "done"
     Step: {pc (1–6), i, out: [printed], jump: {from, to} | null (the jump that brought the pc here), test, caption,
            vars, counters {jumps}}. */
  function jumpTrace(limit) {
    limit = limit === undefined ? 3 : limit;
    var steps = [], i = null, out = [], jumps = 0;
    function push(pc, jump, test, caption) {
      var vars = { pc: pc };
      if (i !== null) vars.i = i;
      steps.push({ pc: pc, i: i, out: out.slice(), jump: jump, test: test, caption: caption, vars: vars, counters: { jumps: jumps } });
    }
    i = 0;
    push(1, null, null, 'Line 1 stores 0 in i. The <b>program counter</b> (pc) holds the number of the line running now; after each line it normally moves down by one.');
    var fromJump = null;
    for (;;) {
      var done = i >= limit;
      if (!done) {
        push(2, fromJump, false, 'Line 2 asks: is ' + i + ' ≥ ' + limit + '? No, so the jump is <em>not</em> taken and the pc falls through to line 3.');
        push(3, null, null, 'Print ' + i + '.');
        out.push(i);
        steps[steps.length - 1].out = out.slice();
        i++;
        push(4, null, null, 'Add one: i = ' + i + '.');
        push(5, null, null, 'Line 5 is an unconditional jump. It writes 2 into the pc instead of letting it move on to 6.');
        jumps++;
        fromJump = { from: 5, to: 2 };
      } else {
        push(2, fromJump, true, 'Line 2 asks: is ' + i + ' ≥ ' + limit + '? Yes, so the jump <em>is</em> taken: the pc becomes 6, skipping the body.');
        jumps++;
        push(6, { from: 2, to: 6 }, null, 'Print “done”. A loop is nothing more than a jump backwards plus a test that can jump out.');
        break;
      }
    }
    return steps;
  }

  /* ================================================================ counted loops (the lab)
     spec: {from, to, step (≠ 0, default 1), body: 'sum' | 'count'}.
     step > 0 tests i <= to; step < 0 tests i >= to (a countdown). */
  var LIMITS = { min: -20, max: 30, stepMax: 5, trips: 12 };
  function norm(spec) {
    spec = spec || {};
    return { from: spec.from === undefined ? 1 : spec.from, to: spec.to === undefined ? 5 : spec.to,
      step: spec.step === undefined ? 1 : spec.step, body: spec.body === 'count' ? 'count' : 'sum' };
  }
  function holds(i, s) { return s.step > 0 ? i <= s.to : i >= s.to; }
  /* Reference: the values i takes inside the body. */
  function loopValues(spec) {
    var s = norm(spec), out = [];
    if (!s.step) return out;
    for (var i = s.from; holds(i, s) && out.length <= 1000; i += s.step) out.push(i);
    return out;
  }
  function loopCount(spec) {
    var s = norm(spec);
    if (!s.step) return Infinity;
    var span = s.step > 0 ? s.to - s.from : s.from - s.to;
    return span < 0 ? 0 : Math.floor(span / Math.abs(s.step)) + 1;
  }
  function validateLoop(spec) {
    var s = norm(spec);
    var keys = ['from', 'to', 'step'];
    for (var k = 0; k < keys.length; k++) {
      var v = s[keys[k]];
      if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) return '“' + keys[k] + '” must be a whole number.';
    }
    if (s.from < LIMITS.min || s.from > LIMITS.max || s.to < LIMITS.min || s.to > LIMITS.max) return 'Keep “from” and “to” between −20 and 30.';
    if (s.step === 0) return 'A step of 0 never moves i, so the loop would never end. Pick a step from −5 to 5, but not 0.';
    if (Math.abs(s.step) > LIMITS.stepMax) return 'Keep the step between −5 and 5.';
    var c = loopCount(s);
    if (c > LIMITS.trips) return 'That loop would run ' + c + ' times. Keep it to ' + LIMITS.trips + ' trips or fewer so every row of the trace stays readable.';
    return null;
  }
  function accName(s) { return s.body === 'count' ? 'count' : 'total'; }
  /* Source code for the three languages, with @labels for the code panel. */
  function loopCode(spec) {
    var s = norm(spec), acc = accName(s);
    var up = s.step > 0, a = s.step, abs = Math.abs(a);
    var pseudoHead = 'for i ← ' + num(s.from) + (up ? ' to ' : ' down to ') + num(s.to) + (abs !== 1 ? ' step ' + num(a) : '');
    var jsUpdate = up ? (a === 1 ? 'i++' : 'i += ' + a) : (a === -1 ? 'i--' : 'i -= ' + abs);
    var jsHead = 'for (let i = ' + s.from + '; i ' + (up ? '<=' : '>=') + ' ' + s.to + '; ' + jsUpdate + ') {';
    var stop = up ? s.to + 1 : s.to - 1;
    var pyHead = 'for i in range(' + s.from + ', ' + stop + (a !== 1 ? ', ' + a : '') + '):';
    var body = s.body === 'count' ? { pseudo: 'count ← count + 1', js: 'count = count + 1;', py: 'count = count + 1' }
      : { pseudo: 'total ← total + i', js: 'total = total + i;', py: 'total = total + i' };
    return {
      pseudo: [acc + ' ← 0                 // @init', pseudoHead + '     // @loop', '  ' + body.pseudo + '     // @body', 'print ' + acc + '              // @done'].join('\n'),
      js: ['let ' + acc + ' = 0;              // @init', jsHead + '  // @loop', '  ' + body.js + '   // @body', '}', 'console.log(' + acc + ');      // @done'].join('\n'),
      py: [acc + ' = 0                  # @init', pyHead + '  # @loop', '    ' + body.py + '   # @body', 'print(' + acc + ')             # @done'].join('\n')
    };
  }

  /* loopTrace(spec) -> steps for the lab.
     Step: {kind: 'init'|'set'|'test'|'body'|'update'|'done', line, flow, i (null before set), acc, accName, cond,
            rows: [{id, trip, i, test, acc}] (the trace table so far), row (current row id), cols: [{id, i, add}]
            (one column per body run), exit (i value that failed the test, on the last test/done), spec, values,
            caption, vars, varStates, counters {tests, runs}}. */
  function loopTrace(spec) {
    var s = norm(spec), name = accName(s), err = validateLoop(s);
    if (err) throw new Error(err);
    var steps = [], rows = [], cols = [], acc = 0, i = null, tests = 0, runs = 0, curRow = null, exit = null;
    var values = loopValues(s), cmp = s.step > 0 ? '≤' : '≥', cmpHtml = s.step > 0 ? '&le;' : '&ge;';
    function snapRows() { return rows.map(function (r) { return { id: r.id, trip: r.trip, i: r.i, test: r.test, acc: r.acc }; }); }
    function push(kind, line, flow, cond, caption) {
      var vars = {};
      if (i !== null) vars.i = i;
      vars[name] = acc;
      var vs = {}; if (i !== null) vs.i = kind === 'test' ? 'compare' : 'active'; vs[name] = kind === 'body' ? 'swap' : 'key';
      steps.push({ kind: kind, line: line, flow: flow, i: i, acc: acc, accName: name, cond: cond,
        rows: snapRows(), row: curRow, cols: cols.slice(), exit: exit, spec: s, values: values,
        caption: caption, vars: vars, varStates: vs, counters: { tests: tests, runs: runs } });
    }
    var what = s.body === 'count' ? 'a counter' : 'a running total';
    push('init', 'init', 'init', null, '<b>' + name + ' = 0</b> before the loop. ' + (s.body === 'count'
      ? 'Nothing has been counted yet, so the count starts at 0.'
      : 'A running total must start at 0: that is the sum of no numbers at all.'));
    i = s.from;
    push('set', 'loop', 'setI', null, 'The for header’s first part runs exactly once: <b>i = ' + num(i) + '</b>. It is the loop variable, the value that must move towards the exit.');
    for (;;) {
      tests++;
      var ok = holds(i, s);
      var row = { id: 'r' + tests, trip: ok ? runs + 1 : null, i: i, test: ok, acc: null };
      rows.push(row); curRow = row.id;
      if (!ok) {
        exit = i;
        push('test', 'loop', 'test', false, 'Test: is ' + num(i) + ' ' + cmpHtml + ' ' + num(s.to) + '? <b>No.</b> ' + (runs === 0
          ? 'The very first test is false, so the body never runs. That is not an error: some loops run zero times.'
          : 'The loop ends here. i = ' + num(i) + ' is the first value that fails the test, so the body never sees it.'));
        break;
      }
      push('test', 'loop', 'test', true, 'Test: is ' + num(i) + ' ' + cmpHtml + ' ' + num(s.to) + '? <b>Yes</b>, so the body runs' + (runs === 0 ? ' for the first time.' : ' again (trip ' + (runs + 1) + ').'));
      runs++;
      var add = s.body === 'count' ? 1 : i, before = acc;
      acc += add;
      row.acc = acc;
      cols.push({ id: 'c' + runs, i: i, add: add });
      push('body', 'body', 'body', null, s.body === 'count'
        ? 'The body adds one: <b>count = ' + before + ' + 1 = ' + acc + '</b>. The count is how many times the body has run.'
        : 'The body adds i: <b>total = ' + num(before) + ' + ' + (i < 0 ? '(' + num(i) + ')' : num(i)) + ' = ' + num(acc) + '</b>. ' + (runs === 1 ? 'The trace table records the new value.' : 'total now holds the sum of every i so far.'));
      var old = i;
      i += s.step;
      curRow = row.id;
      push('update', 'loop', 'update', null, 'The header’s last part runs after the body: <b>i = ' + num(old) + (s.step > 0 ? ' + ' + s.step : ' − ' + Math.abs(s.step)) + ' = ' + num(i) + '</b>. ' +
        (holds(i, s) ? 'Back to the test.' : 'Back to the test, which is about to fail.'));
    }
    curRow = null;
    push('done', 'done', 'done', null, 'Print <b>' + name + ' = ' + num(acc) + '</b>. The body ran ' + times(runs) + ' and the test ran ' + times(tests) +
      (runs ? ': one extra test, the one that said stop.' : ': a loop always tests at least once, even when it never runs.') + (s.body === 'sum' && runs ? ' (' + what + ' of ' + values.map(num).join(' + ') + '.)' : ''));
    return steps;
  }

  /* ================================================================ off-by-one: fence posts
     for (i = start; i CMP n; i++) read a[i]    with start ∈ {0, 1}, CMP ∈ {'<', '<='}; a has indices 0 … n − 1.
     Step: {kind: 'init'|'visit'|'exit', i, n, start, cmp, reads: [indices read so far, may include n],
            current (index read in this step or null), oob (index n was read), missed (indices never read, on exit),
            caption, counters {runs, outOfBounds, missed}}. */
  function fenceTrace(n, start, cmp) {
    start = start ? 1 : 0; cmp = cmp === '<=' ? '<=' : '<';
    var steps = [], reads = [], runs = 0, oob = 0, i = start;
    function test(v) { return cmp === '<' ? v < n : v <= n; }
    var cmpHtml = cmp === '<' ? '&lt;' : '&lt;=';
    function push(kind, current, missed, caption) {
      steps.push({ kind: kind, i: i, n: n, start: start, cmp: cmp, reads: reads.slice(), current: current, oob: oob > 0, missed: missed,
        caption: caption, counters: { runs: runs, outOfBounds: oob, missed: missed.length } });
    }
    push('init', null, [], 'The array has ' + plural(n, 'box', 'boxes') + ', a[0] to a[' + (n - 1) + ']. The loop starts with <b>i = ' + start + '</b>' + (start ? ', not 0.' : '.'));
    while (test(i)) {
      runs++;
      reads.push(i);
      if (i >= n) {
        oob++;
        push('visit', i, [], 'Is ' + i + ' ' + cmpHtml + ' ' + n + '? Yes, so the body reads <b>a[' + i + ']</b>. But the last box is a[' + (n - 1) + ']: this read is <b>out of bounds</b>. JavaScript quietly gives <code>undefined</code>; Python raises an IndexError.');
      } else {
        push('visit', i, [], 'Is ' + i + ' ' + cmpHtml + ' ' + n + '? Yes, so the body reads a[' + i + '].');
      }
      i++;
    }
    var missed = [];
    for (var k = 0; k < n; k++) if (reads.indexOf(k) === -1) missed.push(k);
    var verdict;
    if (!oob && !missed.length) verdict = 'Every box read exactly once: ' + plural(runs, 'trip') + ' for ' + plural(n, 'box', 'boxes') + '. Correct.';
    else if (oob && missed.length) verdict = 'The body ran ' + times(runs) + ', which looks right for ' + plural(n, 'box', 'boxes') + ', but it skipped a[' + missed.join('], a[') + '] and read past the end. Right count, wrong boxes.';
    else if (oob) verdict = 'The body ran ' + times(runs) + ' for ' + plural(n, 'box', 'boxes') + ': <b>one too many</b>. The extra trip read past the end.';
    else verdict = 'The body ran ' + times(runs) + ' for ' + plural(n, 'box', 'boxes') + ': <b>one too few</b>. a[' + missed.join('], a[') + '] was never read.';
    push('exit', null, missed, 'Is ' + i + ' ' + cmpHtml + ' ' + n + '? No, so the loop stops. ' + verdict);
    return steps;
  }

  /* ================================================================ infinite loops: the fuel gauge
     i ← start; while i COND target: i ← UPDATE(i)
     cond: '!=' | '<'.  update: '+1' | '+2' | '-1' | 'same' | '*2'.  opts: {start = 1, target = 10, fuel = 20}.
     Step: {kind: 'init'|'trip'|'exit'|'empty', i, prev, fuel, fuelMax, dist, trips, hops: [values of i so far],
            cond, update, target, caption, vars, counters {trips, fuel}}. */
  var UPDATES = {
    '+1': { text: 'i = i + 1', f: function (i) { return i + 1; } },
    '+2': { text: 'i = i + 2', f: function (i) { return i + 2; } },
    '-1': { text: 'i = i - 1', f: function (i) { return i - 1; } },
    same: { text: 'i = i', f: function (i) { return i; } },
    '*2': { text: 'i = i * 2', f: function (i) { return i * 2; } }
  };
  function condHolds(cond, i, target) { return cond === '<' ? i < target : i !== target; }
  function distance(cond, i, target) { return cond === '<' ? target - i : Math.abs(target - i); }
  function fuelTrace(cond, update, opts) {
    opts = opts || {};
    cond = cond === '<' ? '<' : '!=';
    var U = UPDATES[update] || UPDATES['+1'];
    var start = opts.start === undefined ? 1 : opts.start, target = opts.target === undefined ? 10 : opts.target;
    var fuelMax = opts.fuel || 20, fuel = fuelMax, i = start, prev = null, trips = 0, hops = [start], steps = [];
    var condHtml = cond === '<' ? '&lt;' : '!=';
    function push(kind, caption) {
      steps.push({ kind: kind, i: i, prev: prev, fuel: fuel, fuelMax: fuelMax, dist: distance(cond, i, target), trips: trips, hops: hops.slice(),
        cond: cond, update: update, updateText: U.text, target: target, caption: caption,
        vars: { i: i, 'distance to exit': distance(cond, i, target) }, counters: { trips: trips, fuel: fuel } });
    }
    push('init', 'Start with <b>i = ' + num(start) + '</b>. The loop may run while <code>i ' + condHtml + ' ' + target + '</code>. Each trip burns one unit of fuel; the tank holds ' + fuelMax + '.');
    for (;;) {
      if (!condHolds(cond, i, target)) {
        push('exit', 'Is ' + num(i) + ' ' + condHtml + ' ' + target + '? No, so the loop exits after ' + plural(trips, 'trip') + ', with ' + fuel + ' fuel to spare.');
        break;
      }
      if (fuel === 0) {
        push('empty', '<b>Out of fuel.</b> After ' + plural(trips, 'trip') + ', ' + num(i) + ' ' + condHtml + ' ' + target + ' is still true. ' +
          (update === 'same' ? 'The update never changes i, so the test can never change either.'
            : cond === '!=' && (update === '+2' || update === '*2') && hops.some(function (v) { return v > target; }) ? 'i jumped <em>over</em> ' + target + ', and != only stops on an exact hit, so it will never stop.'
            : 'i is moving away from the exit, so the distance only grows. This loop would run forever.'));
        break;
      }
      prev = i; i = U.f(i); fuel--; trips++; hops.push(i);
      var d0 = distance(cond, prev, target), d1 = distance(cond, i, target);
      var why = d1 < d0 ? 'The distance to the exit shrank from ' + num(d0) + ' to ' + num(d1) + ': progress.'
        : d1 === d0 ? 'The distance to the exit is still ' + num(d1) + ': no progress at all.'
          : 'The distance to the exit grew from ' + num(d0) + ' to ' + num(d1) + ': the wrong way.';
      push('trip', 'Is ' + num(prev) + ' ' + condHtml + ' ' + target + '? Yes, so run the body: <code>' + U.text + '</code> gives <b>i = ' + num(i) + '</b>. ' + why);
    }
    return steps;
  }
  /* Does `while (i COND target) i = UPDATE(i)` stop? Bounded simulation (the updates here are simple enough that
     1000 trips decides it); returns {stops, trips} with trips = Infinity when it runs forever. */
  function terminates(cond, update, opts) {
    opts = opts || {};
    var U = UPDATES[update], i = opts.start === undefined ? 1 : opts.start, target = opts.target === undefined ? 10 : opts.target;
    for (var t = 0; t <= 1000; t++) {
      if (!condHolds(cond, i, target)) return { stops: true, trips: t };
      i = U.f(i);
      if (Math.abs(i) > 1e9) break;
    }
    return { stops: false, trips: Infinity };
  }

  /* ================================================================ nested loops
     shape 'rect': for i in 0..n−1: for j in 0..m−1: visit(i, j)       → n × m visits
     shape 'tri' : for i in 0..n−1: for j in i+1..n−1: visit(i, j)     → n(n − 1)/2 visits (every pair once)
     Step: {kind: 'start'|'outer'|'visit'|'done', i, j, n, m, shape, visited: ['r,c', …], current: 'r,c'|null,
            line, caption, counters {visits}}. */
  function nestedCount(n, m, shape) { return shape === 'tri' ? n * (n - 1) / 2 : n * m; }
  function nestedTrace(n, m, shape) {
    shape = shape === 'tri' ? 'tri' : 'rect';
    if (shape === 'tri') m = n;
    var steps = [], visited = [], visits = 0, i = null, j = null;
    function push(kind, line, current, caption) {
      steps.push({ kind: kind, i: i, j: j, n: n, m: m, shape: shape, visited: visited.slice(), current: current, line: line, caption: caption, counters: { visits: visits } });
    }
    push('start', null, null, shape === 'rect'
      ? 'A grid of ' + n + ' rows and ' + m + ' columns. The outer loop picks a row i; for each row, the inner loop walks every column j.'
      : 'Every pair (i, j) with j &gt; i: the inner loop starts just right of the diagonal, so each pair is visited once.');
    for (i = 0; i < n; i++) {
      j = null;
      var lo = shape === 'tri' ? i + 1 : 0, cnt = m - lo;
      push('outer', 'outer', null, 'Outer loop: <b>i = ' + i + '</b>. ' + (cnt > 0
        ? 'The inner loop now starts again from j = ' + lo + ' and will run ' + times(cnt) + '.'
        : 'The inner loop starts at j = ' + lo + ', which already fails j &lt; ' + m + ', so it runs zero times.'));
      for (j = lo; j < m; j++) {
        visits++;
        visited.push(i + ',' + j);
        push('visit', 'body', i + ',' + j, 'Inner loop: <b>j = ' + j + '</b>. Visit cell (' + i + ', ' + j + '). Visit number ' + visits + '.');
      }
    }
    i = null; j = null;
    push('done', 'done', null, shape === 'rect'
      ? 'Done: ' + n + ' rows × ' + m + ' columns = <b>' + visits + ' visits</b>. The inner body runs n × m times.'
      : 'Done: <b>' + visits + ' visits</b> = ' + n + ' × ' + (n - 1) + ' / 2, a little under half of the ' + n * n + ' cells. Still about n²/2 trips: the same growth as the full grid.');
    return steps;
  }

  /* ================================================================ break and continue
     mode 'break'   : for x in a: if x < 0: found = x; break.     print found
     mode 'continue': for x in a: if x < 0: continue; total += x.  print total
     Step: {kind: 'start'|'take'|'test'|'act'|'jump'|'end'|'done', flow, line, k (index or null), cond,
            states: [per item], acc (found or total), caption, vars, counters {looked, skipped}}. */
  function breakContinueTrace(values, mode) {
    var a = (values || []).slice(), n = a.length, steps = [], looked = 0, skipped = 0;
    mode = mode === 'continue' ? 'continue' : 'break';
    var st = a.map(function () { return 'default'; });
    var acc = mode === 'break' ? null : 0, k = null;
    function push(kind, flow, line, cond, caption) {
      var vars = {};
      if (k !== null && k < n) vars.x = a[k];
      vars[mode === 'break' ? 'found' : 'total'] = acc;
      steps.push({ kind: kind, flow: flow, line: line, k: k, cond: cond, states: st.slice(), acc: acc, mode: mode, values: a,
        caption: caption, vars: vars, counters: { looked: looked, skipped: skipped } });
    }
    push('start', 'start', null, null, mode === 'break'
      ? 'Find the first negative number. As soon as one turns up, there is no reason to look further.'
      : 'Add up only the positive numbers. Negative ones are skipped with <code>continue</code>.');
    var carry = '';
    for (k = 0; k <= n; k++) {
      if (k === n) {
        push('end', 'loop', 'loop', false, carry + 'Items left? No, so the loop ends normally' + (mode === 'break' ? ', without a break: there is no negative number.' : '.'));
        break;
      }
      looked++;
      st[k] = 'active';
      push('take', 'loop', 'loop', true, carry + 'Items left? Yes: take <b>x = ' + num(a[k]) + '</b>.');
      carry = '';
      var neg = a[k] < 0;
      st[k] = 'compare';
      push('test', 'test', 'test', neg, 'Is ' + num(a[k]) + ' &lt; 0? ' + (neg ? '<b>Yes.</b>' : 'No.'));
      if (mode === 'break') {
        if (neg) {
          acc = a[k]; st[k] = 'found';
          for (var r = k + 1; r < n; r++) st[r] = 'muted';
          push('act', 'act', 'act', null, 'Record <b>found = ' + num(a[k]) + '</b>.');
          push('jump', 'done', 'jump', null, '<code>break</code> jumps straight out of the loop. ' + (n - k - 1 ? 'The remaining ' + plural(n - k - 1, 'item') + ' are never even looked at.' : 'It was the last item anyway.'));
          k = null;
          push('done', 'done', 'done', null, 'Print ' + num(acc) + ': the first negative number, found after looking at ' + plural(looked, 'item') + ' of ' + n + '.');
          return steps;
        }
        st[k] = 'visited';
        carry = num(a[k]) + ' is not negative, so the body is finished: back to the top. ';
        continue;
      }
      if (neg) {
        skipped++; st[k] = 'muted';
        push('jump', 'loop', 'jump', null, '<code>continue</code> skips the rest of the body: ' + num(a[k]) + ' is not added. The loop moves straight to the next item.');
        continue;
      }
      var before = acc;
      acc += a[k]; st[k] = 'done';
      push('act', 'act', 'act', null, '<b>total = ' + num(before) + ' + ' + num(a[k]) + ' = ' + num(acc) + '</b>.');
    }
    k = null;
    push('done', 'done', 'done', null, mode === 'break'
      ? 'Print “none”: every item was looked at and none was negative.'
      : 'Print <b>' + num(acc) + '</b>: the sum of the positive numbers. ' + (skipped ? plural(skipped, 'negative number was', 'negative numbers were') + ' skipped.' : 'Nothing was skipped.'));
    return steps;
  }

  /* ================================================================ FizzBuzz
     for i in 1..n: if i % 15 == 0 print FizzBuzz, else if i % 3 == 0 print Fizz, else if i % 5 == 0 print Buzz, else print i.
     Step: {flow, i, out: [{i, text, kind}], cond, caption, counters {printed, tests}}. */
  function fizz(i) { return i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : String(i); }
  function fizzKind(i) { return i % 15 === 0 ? 'fizzbuzz' : i % 3 === 0 ? 'fizz' : i % 5 === 0 ? 'buzz' : 'num'; }
  function fizzbuzzTrace(n) {
    var steps = [], out = [], tests = 0, i = null;
    function push(flow, cond, caption) {
      steps.push({ flow: flow, i: i, out: out.slice(), cond: cond, caption: caption, counters: { printed: out.length, tests: tests } });
    }
    i = 1;
    push('init', null, 'Start at <b>i = 1</b>.');
    for (;;) {
      if (i > n) { push('test', false, 'Is ' + i + ' ≤ ' + n + '? No: every number has been printed, so the loop ends.'); break; }
      push('test', true, 'Is ' + i + ' ≤ ' + n + '? Yes.');
      var chain = [['t15', 15, 'fizzbuzz'], ['t3', 3, 'fizz'], ['t5', 5, 'buzz']], printed = false;
      for (var c = 0; c < chain.length && !printed; c++) {
        tests++;
        var hit = i % chain[c][1] === 0;
        push(chain[c][0], hit, 'Is ' + i + ' divisible by ' + chain[c][1] + '? ' + (hit ? '<b>Yes</b> (' + i + ' % ' + chain[c][1] + ' is 0).' : 'No (' + i + ' % ' + chain[c][1] + ' = ' + (i % chain[c][1]) + ').'));
        if (hit) {
          out.push({ i: i, text: fizz(i), kind: fizzKind(i) });
          push('p' + chain[c][1], null, 'Print <b>' + fizz(i) + '</b>. The first true test wins; the tests below it are skipped.');
          printed = true;
        }
      }
      if (!printed) {
        out.push({ i: i, text: String(i), kind: 'num' });
        push('pn', null, 'No test was true, so the final else prints the number itself: <b>' + i + '</b>.');
      }
      i++;
      push('inc', null, 'Next number: <b>i = ' + i + '</b>.');
    }
    return steps;
  }

  /* ================================================================ iteration counts (cost chart) */
  var ITER = {
    single: function (n) { return n; },
    nested: function (n) { return n * n; },
    triangle: function (n) { return n * (n - 1) / 2; },
    halving: function (n) { return n < 1 ? 0 : Math.floor(Math.log2(n)) + 1; }
  };
  /* Reference: count the halving loop's trips by running it. */
  function halvingTrips(n) { var t = 0; for (var k = n; k >= 1; k = Math.floor(k / 2)) t++; return t; }

  return {
    num: num,
    countLoop: countLoop,
    OPS: OPS, truth: truth, truthTable: truthTable, compareAll: compareAll,
    BATTERY: BATTERY, batteryPath: batteryPath,
    ticketTrace: ticketTrace, jumpTrace: jumpTrace,
    LIMITS: LIMITS, loopValues: loopValues, loopCount: loopCount, validateLoop: validateLoop, loopCode: loopCode, loopTrace: loopTrace,
    fenceTrace: fenceTrace,
    UPDATES: UPDATES, fuelTrace: fuelTrace, terminates: terminates,
    nestedTrace: nestedTrace, nestedCount: nestedCount,
    breakContinueTrace: breakContinueTrace,
    fizz: fizz, fizzbuzzTrace: fizzbuzzTrace,
    ITER: ITER, halvingTrips: halvingTrips
  };
}));
