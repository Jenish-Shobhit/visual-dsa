/* Step generators for lesson 14 (js/algos/14-elementary-sorts.js): bubble, selection, insertion and cocktail sort.
   Run: node --test tests/algos/14-elementary-sorts.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '14-elementary-sorts.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const ALL = ['bubble', 'selection', 'insertion', 'cocktail'];
const ELEM = ['bubble', 'selection', 'insertion'];
const STATES = new Set(Object.keys(core.STATES));

/* ------------------------------------------------------------ straightforward reference implementations */
function refBubble(input, early = true) {
  const a = input.slice(); let comparisons = 0, swaps = 0, rounds = 0;
  for (let i = 0; i < a.length - 1; i++) {
    rounds++; let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) { comparisons++; if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; swaps++; swapped = true; } }
    if (!swapped && early) break;
  }
  return { a, comparisons, swaps, shifts: 0, rounds };
}
function refSelection(input) {
  const a = input.slice(); let comparisons = 0, swaps = 0, rounds = 0;
  for (let i = 0; i < a.length - 1; i++) {
    rounds++; let m = i;
    for (let j = i + 1; j < a.length; j++) { comparisons++; if (a[j] < a[m]) m = j; }
    if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; swaps++; }
  }
  return { a, comparisons, swaps, shifts: 0, rounds };
}
function refInsertion(input) {
  const a = input.slice(); let comparisons = 0, shifts = 0, rounds = 0;
  for (let i = 1; i < a.length; i++) {
    rounds++; const key = a[i]; let j = i - 1;
    while (j >= 0) { comparisons++; if (a[j] > key) { a[j + 1] = a[j]; shifts++; j--; } else break; }
    a[j + 1] = key;
  }
  return { a, comparisons, swaps: 0, shifts, rounds };
}
const REF = { bubble: refBubble, selection: refSelection, insertion: refInsertion };

/* ------------------------------------------------------------ helpers */
function valuesOf(step) {
  const byId = {};
  step.items.forEach(it => { byId[it.id] = it.value; });
  if (step.held) byId[step.held.id] = step.held.value;
  return step.order.map(id => (id === null ? null : byId[id]));
}
function lastOf(steps) { return steps[steps.length - 1]; }
function sortedCopy(a) { return a.slice().sort((x, y) => x - y); }

function randomInputs(seed, count, maxLen, maxVal) {
  const rng = core.rng(seed), out = [];
  for (let c = 0; c < count; c++) {
    const n = rng.int(0, maxLen), a = [];
    for (let i = 0; i < n; i++) a.push(rng.int(-maxVal, maxVal));
    out.push(a);
  }
  return out;
}
const EDGE = [[], [7], [4, 4], [2, 1], [3, 3, 3, 3], [1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1],
  [5, 1, 4, 2, 8, 3], [2, 3, 2, 3, 2, 3], [-3, 0, -3, 9, -1], [1, 2, 3, 5, 4, 6]];

/* ------------------------------------------------------------ correctness against the reference */
test('every generator sorts edge cases and 300 random inputs', () => {
  const inputs = EDGE.concat(randomInputs(20260929, 300, 14, 20));
  for (const name of ALL) {
    for (const input of inputs) {
      const steps = S.run(name, input);
      const last = lastOf(steps);
      assert.deepEqual(valuesOf(last), sortedCopy(input), `${name} on [${input}]`);
      assert.equal(last.kind, 'done', `${name} ends with a done step`);
      assert.equal(last.held, null, `${name} ends with nothing held`);
      assert.deepEqual(last.final, input.map((_, i) => i), `${name} marks every position final at the end`);
      assert.ok(last.items.every(it => it.state === 'done'), `${name}: every item done at the end`);
    }
  }
});

test('operation counts match straightforward reference implementations', () => {
  const inputs = EDGE.concat(randomInputs(7, 250, 16, 9));
  for (const name of ELEM) {
    for (const input of inputs) {
      const ref = REF[name](input);
      const last = lastOf(S.run(name, input));
      assert.deepEqual(valuesOf(last), ref.a, `${name} output on [${input}]`);
      assert.equal(last.ops.comparisons, ref.comparisons, `${name} comparisons on [${input}]`);
      assert.equal(last.ops.swaps, ref.swaps, `${name} swaps on [${input}]`);
      assert.equal(last.ops.shifts, ref.shifts, `${name} shifts on [${input}]`);
      const fast = S.count(name, input);
      assert.deepEqual([fast.comparisons, fast.swaps, fast.shifts, fast.rounds], [ref.comparisons, ref.swaps, ref.shifts, ref.rounds], `${name} count() on [${input}]`);
      assert.equal(fast.writes, last.ops.writes, `${name} count().writes`);
    }
  }
  // bubble without the early exit behaves like the textbook version
  for (const input of inputs.slice(0, 60)) {
    const ref = refBubble(input, false);
    const last = lastOf(S.bubble(input, { earlyExit: false }));
    assert.equal(last.ops.comparisons, ref.comparisons);
    assert.equal(S.count('bubble', input, { earlyExit: false }).comparisons, ref.comparisons);
  }
});

test('known costs: sorted, reversed, all equal', () => {
  const n = 9, sorted = Array.from({ length: n }, (_, i) => i + 1), reversed = sorted.slice().reverse(), equal = Array(n).fill(4);
  const half = n * (n - 1) / 2;
  // bubble: early exit makes sorted input one pass of n - 1 comparisons
  assert.deepEqual(pick(S.count('bubble', sorted)), [n - 1, 0, 0]);
  assert.deepEqual(pick(S.count('bubble', reversed)), [half, half, 0]);
  assert.deepEqual(pick(S.count('bubble', equal)), [n - 1, 0, 0]);
  // selection: always n(n-1)/2 comparisons; reversed needs only floor(n/2) swaps
  assert.deepEqual(pick(S.count('selection', sorted)), [half, 0, 0]);
  assert.deepEqual(pick(S.count('selection', reversed)), [half, Math.floor(n / 2), 0]);
  assert.deepEqual(pick(S.count('selection', equal)), [half, 0, 0]);
  // insertion: adaptive, n - 1 comparisons on sorted input
  assert.deepEqual(pick(S.count('insertion', sorted)), [n - 1, 0, 0]);
  assert.deepEqual(pick(S.count('insertion', reversed)), [half, 0, half]);
  assert.deepEqual(pick(S.count('insertion', equal)), [n - 1, 0, 0]);
  function pick(c) { return [c.comparisons, c.swaps, c.shifts]; }
});

test('insertion shifts and bubble swaps both equal the number of inversions', () => {
  for (const input of EDGE.concat(randomInputs(99, 200, 15, 6))) {
    const inv = S.inversions(input).count;
    assert.equal(S.count('insertion', input).shifts, inv, `insertion on [${input}]`);
    assert.equal(S.count('bubble', input).swaps, inv, `bubble on [${input}]`);
    assert.ok(S.count('selection', input).swaps <= Math.max(0, input.length - 1), 'selection swaps <= n - 1');
  }
  assert.deepEqual(S.inversions([3, 1, 2]), { count: 2, pairs: [[0, 1], [0, 2]] });
  assert.equal(S.inversions([5, 4, 3, 2, 1]).count, 10);
  assert.equal(S.inversions([]).count, 0);
});

/* ------------------------------------------------------------ truthful visuals */
test('a position marked final never changes its item, and done appears only on final positions', () => {
  const inputs = EDGE.concat(randomInputs(314, 200, 12, 5));
  for (const name of ALL) {
    for (const input of inputs) {
      const steps = S.run(name, input);
      const endOrder = lastOf(steps).order;
      steps.forEach((s, k) => {
        s.final.forEach(i => assert.equal(s.order[i], endOrder[i], `${name} step ${k}: index ${i} called final too early on [${input}]`));
        const finalSet = new Set(s.final);
        s.items.forEach(it => {
          const slot = it.index !== undefined ? it.index : s.order.indexOf(it.id);
          assert.equal(s.order[slot], it.id, `${name} step ${k}: item slot matches order`);
          if (it.state === 'done') assert.ok(finalSet.has(slot), `${name} step ${k}: ${it.id} is done at non-final slot ${slot}`);
          assert.ok(STATES.has(it.state), `unknown state ${it.state}`);
        });
        // final prefixes / suffixes only ever grow
        if (k) steps[k - 1].final.forEach(i => assert.ok(finalSet.has(i), `${name} step ${k}: final index ${i} was dropped`));
      });
    }
  }
});

test('snapshots are complete: unique ids, stable identity, one held key at most, consistent counters', () => {
  for (const name of ALL) {
    for (const input of EDGE.concat(randomInputs(5, 80, 12, 9))) {
      const steps = S.run(name, input);
      const ids0 = new Set(steps[0].order);
      let prevOps = null;
      steps.forEach((s, k) => {
        const ids = s.items.map(it => it.id).concat(s.held ? [s.held.id] : []);
        assert.equal(new Set(ids).size, ids.length, `${name} step ${k}: duplicate ids`);
        assert.equal(ids.length, input.length, `${name} step ${k}: every value is on screen`);
        ids.forEach(id => assert.ok(ids0.has(id), `${name} step ${k}: unknown id ${id}`));
        assert.equal(s.order.filter(x => x === null).length, s.held ? 1 : 0, `${name} step ${k}: hole iff a key is held`);
        if (s.held) assert.equal(s.ghosts.length, 1, 'a held key leaves exactly one ghost slot');
        assert.deepEqual(Object.keys(s.counters), Object.keys(steps[0].counters), `${name}: counter keys stay the same`);
        if (prevOps) for (const key of Object.keys(s.ops)) assert.ok(s.ops[key] >= prevOps[key], `${name} step ${k}: ${key} decreased`);
        prevOps = s.ops;
        assert.equal(typeof s.caption, 'string');
        assert.ok(s.caption.length > 0, `${name} step ${k}: caption`);
        (s.pointers || []).forEach(p => assert.ok(p.index >= -1 && p.index <= input.length, `${name}: pointer ${p.name} in range`));
      });
    }
  }
});

test('steps are immutable snapshots (later steps never change earlier ones)', () => {
  for (const name of ALL) {
    const input = [9, 3, 7, 1, 8, 2];
    const steps = S.run(name, input);
    const firstJSON = JSON.stringify(steps[0]);
    assert.deepEqual(valuesOf(steps[0]), input, `${name}: first step shows the input`);
    S.run(name, input);   // generating again must not disturb the old steps
    assert.equal(JSON.stringify(steps[0]), firstJSON);
    assert.deepEqual(steps[0].items.map(it => it.value), input);
  }
});

test('stability: bubble and insertion keep equal keys in order; selection can break it', () => {
  const tag = a => a.map((v, i) => ({ value: v, label: String.fromCharCode(97 + i) }));
  for (const input of randomInputs(42, 150, 12, 3)) {
    for (const name of ['bubble', 'insertion', 'cocktail']) {
      const last = lastOf(S.run(name, tag(input)));
      const byValue = {};
      last.order.forEach(id => { const it = last.items.find(x => x.id === id); (byValue[it.value] = byValue[it.value] || []).push(+id.slice(1)); });
      Object.values(byValue).forEach(ids => assert.deepEqual(ids, ids.slice().sort((x, y) => x - y), `${name} disturbed equal keys in [${input}]`));
    }
  }
  // the lesson's card example: selection swaps 5♠ past 5♥
  const hand = [{ value: 5, label: '♠' }, { value: 8, label: '♦' }, { value: 5, label: '♥' }, { value: 2, label: '♣' }, { value: 8, label: '♣' }];
  const labels = steps => { const l = lastOf(steps); return l.order.map(id => l.items.find(x => x.id === id).label); };
  assert.deepEqual(labels(S.selection(hand)), ['♣', '♥', '♠', '♦', '♣'], 'selection reverses the fives');
  assert.deepEqual(labels(S.insertion(hand)), ['♣', '♠', '♥', '♦', '♣'], 'insertion keeps the fives in order');
  // selection keeps the FIRST copy of a repeated minimum (strict <)
  const sel = S.selection([3, 1, 1, 2]);
  const swap = sel.find(s => s.kind === 'swap');
  assert.equal(swap.order[0], 'v1', 'the first 1 is selected');
});

/* ------------------------------------------------------------ step shapes the lesson relies on */
test('edge cases produce short, honest traces', () => {
  for (const name of ALL) {
    const empty = S.run(name, []);
    assert.equal(empty.length, 1, `${name}: empty input is one step`);
    assert.match(empty[0].caption, /nothing to sort/i);
    const one = S.run(name, [42]);
    assert.equal(one.length, 2, `${name}: one value is start + done`);
    assert.equal(lastOf(one).ops.comparisons, 0);
  }
  // bubble exits after one pass on sorted input and says so
  const sortedRun = S.bubble([1, 2, 3, 4, 5]);
  const exits = sortedRun.filter(s => s.kind === 'passEnd');
  assert.equal(exits.length, 1);
  assert.match(exits[0].caption, /no swaps/i);
  assert.deepEqual(exits[0].final, [0, 1, 2, 3, 4], 'early exit proves the whole array sorted');
  // insertion on sorted input never shifts and never shows a done prefix before the end
  const ins = S.insertion([1, 2, 3, 4]);
  assert.equal(ins.filter(s => s.kind === 'shift').length, 0);
  assert.ok(ins.slice(0, -1).every(s => s.items.every(it => it.state !== 'done')), 'insertion prefix is sorted, not final');
});

test('insertion sort: the key hovers over the hole and every shift moves one value right by one', () => {
  for (const input of randomInputs(8, 60, 10, 9)) {
    const steps = S.insertion(input);
    steps.forEach((s, k) => {
      if (s.held) {
        assert.equal(s.order[s.held.over], null, 'held key sits over the hole');
        assert.deepEqual(s.ghosts, [s.held.over]);
      }
      if (s.kind === 'shift') {
        const prev = steps[k - 1];
        const moved = s.order.map((id, i) => (id !== null && prev.order[i] !== id ? i : -1)).filter(i => i >= 0);
        assert.equal(moved.length, 1, 'exactly one value moves');
        assert.equal(prev.order[moved[0] - 1], s.order[moved[0]], 'it moved one slot right');
      }
    });
  }
});

test('every code line label used by a step exists in pseudocode, JavaScript and Python', () => {
  for (const name of ELEM) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(S.CODE[name][lang], lang);
    const used = new Set();
    for (const input of EDGE) S.run(name, input).forEach(s => [].concat(s.line === null ? [] : s.line).forEach(l => used.add(l)));
    assert.ok(used.size >= 4, `${name} uses several labels`);
    for (const label of used) {
      for (const lang of Object.keys(parsed)) assert.ok(parsed[lang].labels[label], `${name}: label @${label} missing in ${lang}`);
    }
    // labels never leak into the visible code
    for (const lang of Object.keys(parsed)) assert.ok(!code.plainText(parsed[lang]).includes('@'), `${name} ${lang}: label text visible`);
  }
});

test('flow ids and variables are present on every step', () => {
  const flows = {
    bubble: ['start', 'pass', 'cmp', 'swap', 'exitQ', 'done'],
    selection: ['start', 'pass', 'cmp', 'newmin', 'swap', 'done'],
    insertion: ['start', 'lift', 'cmp', 'shift', 'insert', 'done']
  };
  for (const name of ELEM) {
    const steps = S.run(name, [4, 2, 7, 1, 7, 3]);
    const keys = Object.keys(steps[0].vars);
    steps.forEach(s => {
      assert.ok(flows[name].includes(s.flow), `${name}: flow ${s.flow}`);
      assert.deepEqual(Object.keys(s.vars), keys, `${name}: variable order is stable`);
    });
  }
});

test('roundFrames gives the array after k outer rounds', () => {
  for (const input of randomInputs(77, 80, 10, 9).concat(EDGE)) {
    for (const name of ELEM) {
      const frames = S.roundFrames(S.run(name, input));
      assert.equal(frames.length, Math.max(1, input.length));
      for (let k = 0; k < frames.length; k++) {
        const expect = afterRounds(name, input, k);
        assert.deepEqual(valuesOf(frames[k]), expect, `${name} after ${k} rounds on [${input}]`);
      }
    }
  }
  function afterRounds(name, input, k) {
    const a = input.slice();
    if (name === 'bubble') {
      for (let i = 0; i < Math.min(k, a.length - 1); i++) {
        let sw = false;
        for (let j = 0; j < a.length - 1 - i; j++) if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; sw = true; }
        if (!sw) break;
      }
    } else if (name === 'selection') {
      for (let i = 0; i < Math.min(k, a.length - 1); i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; [a[i], a[m]] = [a[m], a[i]]; }
    } else {
      for (let i = 1; i <= Math.min(k, a.length - 1); i++) { const key = a[i]; let j = i - 1; while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; } a[j + 1] = key; }
    }
    return a;
  }
});

test('opFrames: one tick per comparison or move, ending on the done step', () => {
  for (const input of randomInputs(3, 60, 12, 9)) {
    for (const name of ELEM) {
      const steps = S.run(name, input), ticks = S.opFrames(steps), last = lastOf(steps);
      const work = s => s.ops.comparisons + s.ops.swaps + s.ops.shifts;
      assert.equal(ticks[0], steps[0]);
      assert.equal(lastOf(ticks), last);
      if (input.length > 1) assert.equal(ticks.length, work(last) + 2, `${name}: ticks = work + first + last on [${input}]`);
      for (let k = 1; k < ticks.length - 1; k++) assert.equal(work(ticks[k]), k, 'one unit of work per tick');
    }
  }
});

test('trace length stays bounded at the lab limit (16 values)', () => {
  const worst = Array.from({ length: 16 }, (_, i) => 16 - i);
  for (const name of ALL) {
    const steps = S.run(name, worst);
    assert.ok(steps.length < 320, `${name}: ${steps.length} steps on 16 reversed values`);
  }
});

test('browser registration merges into VDSA.algos.sorting without clobbering other sorts', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(ROOT, 'js', 'algos', '14-elementary-sorts.js'), 'utf8');
  const merge = function () {};
  const window = { VDSA: { algos: { sorting: { merge } } } };
  vm.runInNewContext(src, { window });
  assert.equal(window.VDSA.algos.sorting.merge, merge, 'existing sorts survive');
  assert.equal(typeof window.VDSA.algos.sorting.bubble, 'function');
  assert.equal(typeof window.VDSA.algos.sorting.insertion, 'function');
});
