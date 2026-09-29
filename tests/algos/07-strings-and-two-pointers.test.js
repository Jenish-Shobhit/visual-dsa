/* Step generators for lesson 07 (js/algos/07-strings-and-two-pointers.js).
   Run: node --test tests/algos/07-strings-and-two-pointers.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '07-strings-and-two-pointers.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const rng = core.rng(7);

/* ------------------------------------------------------------ straightforward references */
function refPalindrome(s) { const c = Array.from(s); for (let i = 0; i < c.length; i++) if (c[i] !== c[c.length - 1 - i]) return false; return true; }
function refTwoSum(a, t) { for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] + a[j] === t) return true; return false; }
function refLongest(str) {
  const s = Array.from(str); let best = 0, start = 0;
  for (let i = 0; i < s.length; i++) { const seen = new Set(); for (let j = i; j < s.length; j++) { if (seen.has(s[j])) break; seen.add(s[j]); if (j - i + 1 > best) { best = j - i + 1; start = i; } } }
  return { best, start };
}
function refMaxK(a, k) { let best = -Infinity, at = 0; for (let l = 0; l + k <= a.length; l++) { let s = 0; for (let i = l; i < l + k; i++) s += a[i]; if (s > best) { best = s; at = l; } } return { best, at }; }
function randomString(len, alpha) { let s = ''; for (let i = 0; i < len; i++) s += alpha[rng.int(0, alpha.length - 1)]; return s; }
function randomSorted(n, lo = -5, hi = 20) { const a = []; for (let i = 0; i < n; i++) a.push(rng.int(lo, hi)); return a.sort((x, y) => x - y); }
function allItems(step) { return step.items || (step.rows ? step.rows.flatMap((r) => r.items) : []); }

/* ------------------------------------------------------------ generic step contract */
function checkContract(steps, name) {
  assert.ok(steps.length > 0, name + ': has steps');
  steps.forEach((s, k) => {
    assert.ok(typeof s.caption === 'string' && s.caption.length > 5, name + ' step ' + k + ' caption');
    const ids = new Set();
    allItems(s).forEach((it) => {
      assert.ok(!ids.has(it.id), name + ' step ' + k + ' duplicate id ' + it.id);
      ids.add(it.id);
      assert.ok(STATES.has(it.state), name + ' step ' + k + ' state ' + it.state);
    });
    (s.pointers || []).forEach((p) => assert.ok(STATES.has(p.state)));
    (s.regions || []).forEach((r) => assert.ok(r.from <= r.to));
    const json = JSON.stringify(s);
    assert.ok(json.length > 10);
  });
  const keys = Object.keys(steps[0].counters || {}).join();
  steps.forEach((s, k) => assert.equal(Object.keys(s.counters || {}).join(), keys, name + ' counter keys step ' + k));
  for (const key of Object.keys(steps[0].counters || {})) {
    let prev = -1;
    steps.forEach((s) => { if (key === 'best' || key === 'length' || key === 'built') return; assert.ok(s.counters[key] >= prev, name + ' counter ' + key + ' only grows'); prev = s.counters[key]; });
  }
}
function labelsOf(lang, src) { return new Set(Object.keys(code.parse(src, lang).labels)); }
function checkLines(steps, codeSet, name) {
  const langs = Object.keys(codeSet);
  steps.forEach((s, k) => {
    if (!s.line) return;
    const wanted = Array.isArray(s.line) ? s.line : [s.line];
    langs.forEach((lang) => {
      const set = labelsOf(lang === 'pseudo' ? 'pseudo' : lang, codeSet[lang]);
      wanted.forEach((w) => assert.ok(set.has(w), name + ' step ' + k + ': label ' + w + ' missing in ' + lang));
    });
  });
}

/* ------------------------------------------------------------ characters */
test('charInfo: ASCII, accents and an emoji (two UTF-16 code units, four UTF-8 bytes)', () => {
  const info = S.charInfo('Aé😀');
  assert.equal(info.length, 3);
  assert.deepEqual(info.map((c) => c.codePoint), [65, 233, 0x1F600]);
  assert.deepEqual(info.map((c) => c.units.length), [1, 1, 2]);
  assert.deepEqual(info.map((c) => c.bytes), [1, 2, 4]);
  assert.equal(info[2].hex, 'U+1F600');
  assert.equal(info[2].unitStart, 2);
  assert.deepEqual(S.charInfo(''), []);
});

/* ------------------------------------------------------------ string building */
test('concatSteps: naive costs n(n+1)/2 writes, builder 2n; identity and caption contract', () => {
  for (let n = 1; n <= S.LIMITS.concat; n++) {
    const naive = S.concatSteps(n, 'naive'), builder = S.concatSteps(n, 'builder');
    assert.equal(naive[naive.length - 1].cost, n * (n + 1) / 2);
    assert.equal(builder[builder.length - 1].cost, 2 * n);
    assert.equal(S.concatCost(n).naive, n * (n + 1) / 2);
    assert.equal(S.concatCost(n).builder, 2 * n);
    assert.equal(naive[naive.length - 1].length, n);
    checkContract(naive, 'concat naive ' + n);
    checkContract(builder, 'concat builder ' + n);
    let prev = 0; naive.forEach((s) => { assert.ok(s.cost >= prev); prev = s.cost; });
  }
  assert.throws(() => S.concatSteps(0, 'naive'), RangeError);
  assert.throws(() => S.concatSteps(S.LIMITS.concat + 1, 'naive'), RangeError);
});

/* ------------------------------------------------------------ palindrome */
test('palindrome: verdict matches the reference on fixed and random strings', () => {
  const fixed = ['', 'a', 'aa', 'ab', 'aba', 'abba', 'abca', 'racecar', 'level', 'aaaa', 'abcba', 'abcbb', 'a b a', 'Aba', 'é😀é'];
  const random = [];
  for (let i = 0; i < 200; i++) random.push(randomString(rng.int(0, 9), 'ab'));
  for (const str of fixed.concat(random)) {
    const steps = S.palindrome(str), last = steps[steps.length - 1];
    assert.equal(last.result, refPalindrome(str), JSON.stringify(str));
    assert.ok(last.kind === 'end' || last.kind === 'miss');
    checkContract(steps, 'palindrome ' + str);
    checkLines(steps, S.CODE.palindrome, 'palindrome');
  }
});
test('palindrome: comparisons are at most floor(n/2); green only for matched pairs; pointers converge', () => {
  for (let i = 0; i < 120; i++) {
    const str = randomString(rng.int(0, 10), 'abc'), c = Array.from(str), steps = S.palindrome(str), last = steps[steps.length - 1];
    assert.ok(last.counters.comparisons <= Math.floor(c.length / 2));
    if (last.result) assert.equal(last.counters.comparisons, Math.floor(c.length / 2));
    steps.forEach((s) => s.items.forEach((it, k) => {
      if (it.state === 'done') assert.equal(c[k], c[c.length - 1 - k], 'done needs a matching mirror (or the middle)');
      if (it.state === 'error') assert.notEqual(c[k], c[c.length - 1 - k]);
    }));
    let prevL = -1, prevR = c.length;
    steps.forEach((s) => { if (s.kind === 'end' && !c.length) return; assert.ok(s.l >= prevL && s.r <= prevR); prevL = s.l; prevR = s.r; });
  }
  const one = S.palindrome('x');
  assert.equal(one[one.length - 1].items[0].state, 'done', 'a single character is its own mirror');
});
test('palindrome: empty string has no pointers', () => {
  const s = S.palindrome('');
  assert.equal(s.length, 1); assert.equal(s[0].result, true); assert.deepEqual(s[0].pointers, []);
});

/* ------------------------------------------------------------ two-sum on a sorted array */
test('twoSum: finds a pair iff one exists; the pair sums to the target', () => {
  const cases = [[[], 3], [[5], 5], [[1, 2], 3], [[1, 2], 4], [[1, 3, 4, 6, 8, 11], 14], [[2, 2, 2, 2], 4], [[1, 2, 3], 100], [[-3, -1, 0, 4], 1]];
  for (let i = 0; i < 300; i++) cases.push([randomSorted(rng.int(0, 12)), rng.int(-8, 40)]);
  for (const [a, t] of cases) {
    const steps = S.twoSum(a, t), last = steps[steps.length - 1];
    assert.equal(last.result !== null, refTwoSum(a, t), JSON.stringify([a, t]));
    if (last.result) { assert.ok(last.result[0] < last.result[1]); assert.equal(a[last.result[0]] + a[last.result[1]], t); }
    checkContract(steps, 'twoSum');
    checkLines(steps, S.CODE.twoSum, 'twoSum');
    assert.ok(last.counters.sums <= Math.max(0, a.length - 1), 'at most n − 1 sums');
  }
});
test('twoSum: sums checked agree with twoSumTrace and never revisit a pair', () => {
  for (let i = 0; i < 100; i++) {
    const a = randomSorted(rng.int(2, 12)), t = rng.int(-4, 35), tr = S.twoSumTrace(a, t), steps = S.twoSum(a, t);
    const seen = steps.filter((s) => s.kind === 'sum').map((s) => [s.lo, s.hi, s.sum]);
    assert.deepEqual(seen, tr.pairs);
    assert.equal(new Set(tr.pairs.map((p) => p[0] + ',' + p[1])).size, tr.pairs.length);
    assert.deepEqual(steps[steps.length - 1].result === null ? null : steps[steps.length - 1].result, tr.found);
  }
});
test('twoSum: a pair grid cell is ruled out only when sorted order proves it cannot hit the target', () => {
  for (let i = 0; i < 150; i++) {
    const a = randomSorted(rng.int(2, 12)), t = rng.int(-4, 35), steps = S.twoSum(a, t), n = a.length;
    const answer = S.bruteTrace(a, t).found;
    steps.forEach((s) => {
      for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) {
        const out = x < s.lo || y > s.hi;
        if (out && !(s.found && s.found[0] === x && s.found[1] === y)) assert.notEqual(a[x] + a[y], t, 'ruled-out pair ' + x + ',' + y + ' must not sum to the target');
      }
      // ruledOut counts unseen eliminated pairs, and together with checked pairs it never exceeds the grid
      assert.ok(s.counters.ruledOut + s.counters.sums <= n * (n - 1) / 2);
    });
    if (answer) assert.ok(steps[steps.length - 1].found, 'a solution is never lost');
  }
});
test('twoSum: refuses unsorted input; muted only outside [lo, hi]', () => {
  assert.throws(() => S.twoSum([3, 1, 2], 4), RangeError);
  const steps = S.twoSum([1, 2, 4, 7, 11, 15], 15);
  steps.forEach((s) => s.items.forEach((it, k) => { if (it.state === 'muted' && s.kind !== 'none') assert.ok(k < s.lo || k > s.hi); }));
  const last = steps[steps.length - 1];
  assert.equal(last.kind, 'found');
  assert.deepEqual(last.found, [2, 4]);
});
test('bruteTrace vs twoSumTrace: brute force checks n(n-1)/2 pairs when the target is absent', () => {
  for (let n = 0; n <= 14; n++) {
    const a = Array.from({ length: n }, (_, i) => i);
    assert.equal(S.bruteTrace(a, -1).pairs.length, n * (n - 1) / 2 + 0);
    assert.equal(S.twoSumTrace(a, -1).pairs.length, Math.max(0, n - 1));
    const o = S.ops.twoSum(n);
    assert.equal(o.brute, n * (n - 1) / 2 + 0);
    assert.equal(o.pointers, Math.max(0, n - 1));
  }
});

/* ------------------------------------------------------------ reverse */
test('reverse: result is the reversed string with floor(n/2) swaps', () => {
  for (const str of ['', 'a', 'ab', 'abc', 'abcd', 'hello', 'aab', 'a b', '😀ab']) {
    const steps = S.reverse(str), last = steps[steps.length - 1], c = Array.from(str);
    if (c.length) assert.deepEqual(last.items.map((it) => it.value), c.slice().reverse());
    assert.equal(last.counters.swaps, Math.floor(c.length / 2));
    checkContract(steps, 'reverse ' + str);
    checkLines(steps, S.CODE.reverse, 'reverse');
  }
  for (let i = 0; i < 100; i++) {
    const str = randomString(rng.int(0, 12), 'abcd'), steps = S.reverse(str), c = Array.from(str);
    steps.forEach((s) => {
      s.items.forEach((it, k) => { if (it.state === 'done') assert.equal(it.value, c[c.length - 1 - k], 'done means already in its reversed position'); });
      assert.equal(new Set(s.items.map((it) => it.id)).size, c.length);
    });
  }
});

/* ------------------------------------------------------------ remove duplicates */
test('dedupe: keeps the unique values in a prefix, in order, and reports w', () => {
  const cases = [[], [1], [1, 1], [1, 2], [1, 1, 1, 1], [1, 1, 2, 3, 3, 3, 4], [-2, -2, 0, 0, 5]];
  for (let i = 0; i < 200; i++) cases.push(randomSorted(rng.int(0, 12), 0, 6));
  for (const a of cases) {
    const steps = S.dedupe(a), last = steps[steps.length - 1], uniq = a.filter((v, k) => k === 0 || v !== a[k - 1]);
    assert.equal(last.result, uniq.length, JSON.stringify(a));
    assert.deepEqual(last.items.slice(0, uniq.length).map((it) => it.value), uniq);
    assert.equal(last.counters.reads, Math.max(0, a.length - 1));
    assert.equal(last.counters.writes, uniq.length - (a.length ? 1 : 0));
    steps.forEach((s) => s.items.forEach((it, k) => { if (it.state === 'done') assert.equal(it.value, uniq[k], 'the kept prefix is final and unique'); }));
    checkContract(steps, 'dedupe');
    checkLines(steps, S.CODE.dedupe, 'dedupe');
  }
  assert.throws(() => S.dedupe([2, 1]), RangeError);
});

/* ------------------------------------------------------------ fixed window */
test('windowFixed: best sum matches the reference; costs are k + 2(n-k) sliding, k(n-k+1) recomputing', () => {
  for (let i = 0; i < 200; i++) {
    const n = rng.int(1, 12), k = rng.int(1, n), a = Array.from({ length: n }, () => rng.int(-9, 30));
    const slide = S.windowFixed(a, k), rec = S.windowFixed(a, k, { recompute: true }), ref = refMaxK(a, k);
    assert.equal(slide[slide.length - 1].best, ref.best);
    assert.equal(rec[rec.length - 1].best, ref.best);
    assert.equal(slide[slide.length - 1].bestStart, ref.at, 'first best window wins ties');
    assert.equal(slide[slide.length - 1].counters.ops, k + 2 * (n - k));
    assert.equal(rec[rec.length - 1].counters.ops, k * (n - k + 1));
    slide.forEach((s) => { assert.equal(s.r - s.l + 1, k); assert.equal(s.sum, a.slice(s.l, s.r + 1).reduce((x, y) => x + y, 0), 'running sum equals the true window sum'); });
    checkContract(slide, 'windowFixed');
    checkLines(slide, S.CODE.fixed, 'windowFixed');
  }
  assert.throws(() => S.windowFixed([1, 2], 3), RangeError);
  assert.throws(() => S.windowFixed([1, 2], 0), RangeError);
  assert.equal(S.windowFixed([5], 1).length, 2);
});

/* ------------------------------------------------------------ longest substring without repeats */
test('windowLongest: length and first position match brute force', () => {
  const fixed = ['', 'a', 'aa', 'abcabcbb', 'bbbbb', 'pwwkew', 'abcdef', 'dvdf', 'abba', 'tmmzuxt', 'a b a'];
  const random = [];
  for (let i = 0; i < 250; i++) random.push(randomString(rng.int(0, 14), 'abcd'));
  for (const str of fixed.concat(random)) {
    const steps = S.windowLongest(str), last = steps[steps.length - 1], ref = refLongest(str);
    assert.equal(last.best, ref.best, JSON.stringify(str));
    if (ref.best) assert.equal(last.bestStart, ref.start, 'strictly-longer rule keeps the first');
    checkContract(steps, 'windowLongest ' + str);
    checkLines(steps, S.CODE.longest, 'windowLongest');
  }
});
test('windowLongest: table matches the window; valid window after each update; each char in once and out at most once', () => {
  for (let i = 0; i < 150; i++) {
    const str = randomString(rng.int(1, 14), 'abcde'), c = Array.from(str), steps = S.windowLongest(str);
    steps.forEach((s) => {
      const inside = {};
      for (let k = s.l; k <= s.r; k++) inside[c[k]] = (inside[c[k]] || 0) + 1;
      s.alphabet.forEach((ch) => assert.equal(s.counts[ch] || 0, inside[ch] || 0, 'count table equals the window'));
      if (s.kind === 'update' || s.kind === 'end') Object.keys(inside).forEach((ch) => assert.equal(inside[ch], 1, 'window is duplicate-free after shrinking'));
      if (s.kind === 'dup' && s.dup) assert.ok(s.counts[s.dup] > 1);
      const win = s.rows[0].items;
      win.forEach((it, k) => { if (it.state === 'muted') assert.ok(k < s.l); });
    });
    const last = steps[steps.length - 1];
    assert.equal(last.counters.added, c.length);
    assert.ok(last.counters.dropped <= c.length);
    const fast = S.ops.longestFast(str);
    assert.equal(fast.adds, last.counters.added); assert.equal(fast.drops, last.counters.dropped); assert.equal(fast.best, last.best);
  }
});
test('windowLongest: counter keys stable; l and r never move backwards', () => {
  const steps = S.windowLongest('abcabcbb');
  let l = 0, r = -1;
  steps.forEach((s) => { assert.ok(s.l >= l && s.r >= r); l = s.l; r = s.r; });
  assert.equal(steps[steps.length - 1].best, 3);
  assert.deepEqual(S.windowLongest('').map((s) => s.kind), ['end']);
});

/* ------------------------------------------------------------ prefix sums */
test('prefixSums: P is the running total and the query is a difference of two entries', () => {
  for (let i = 0; i < 150; i++) {
    const n = rng.int(1, 10), a = Array.from({ length: n }, () => rng.int(0, 9)), l = rng.int(0, n - 1), r = rng.int(l, n - 1);
    const steps = S.prefixSums(a, l, r), last = steps[steps.length - 1];
    assert.equal(last.P.length, n + 1);
    let run = 0; last.P.forEach((p, k) => { assert.equal(p, k ? (run += a[k - 1]) : 0); });
    let direct = 0; for (let k = l; k <= r; k++) direct += a[k];
    assert.equal(last.answer, direct);
    assert.equal(last.counters.queryOps, 1);
    assert.equal(last.counters.built, n);
    checkContract(steps, 'prefix');
    checkLines(steps, S.CODE.prefix, 'prefix');
    steps.forEach((s) => assert.ok(s.built >= 1 && s.built <= n + 1));
  }
  assert.throws(() => S.prefixSums([1, 2, 3], 2, 1), RangeError);
  assert.throws(() => S.prefixSums([1, 2, 3], 0, 3), RangeError);
  assert.equal(S.prefixSums([], 0, 0).length, 1);
});

/* ------------------------------------------------------------ anagram */
test('anagram: verdict matches the sorted-letters reference', () => {
  const cases = [['', ''], ['a', 'a'], ['a', 'b'], ['listen', 'silent'], ['abc', 'abd'], ['aab', 'abb'], ['ab', 'abc'], ['', 'a'], ['aa', 'a']];
  for (let i = 0; i < 200; i++) cases.push([randomString(rng.int(0, 7), 'abc'), randomString(rng.int(0, 7), 'abc')]);
  for (const [a, b] of cases) {
    const steps = S.anagram(a, b), last = steps[steps.length - 1];
    const ref = a.split('').sort().join('') === b.split('').sort().join('');
    assert.equal(last.verdict, ref, JSON.stringify([a, b]));
    if (!ref) assert.ok(last.diff.length > 0); else assert.equal(last.diff.length, 0);
    checkContract(steps, 'anagram');
  }
});

/* ------------------------------------------------------------ cost counts */
test('ops: brute force is quadratic, the pointer/window/prefix versions are linear', () => {
  for (const n of [1, 2, 5, 10, 40, 80]) {
    assert.equal(S.ops.longest(n).brute, n * (n + 1) / 2);
    assert.equal(S.ops.longest(n).window, n);
    assert.equal(S.ops.range(n).brute, n * n);
    assert.equal(S.ops.range(n).prefix, 2 * n);
  }
});

/* ------------------------------------------------------------ code panels */
test('every code panel has the same labels in all three languages', () => {
  for (const name of Object.keys(S.CODE)) {
    const sets = ['pseudo', 'js', 'py'].map((lang) => [...labelsOf(lang, S.CODE[name][lang])].sort().join());
    assert.equal(new Set(sets).size, 1, name + ' labels differ between languages: ' + sets.join(' | '));
  }
});

/* ------------------------------------------------------------ flow mode (lab) */
test('windowFixed with flow: same answer, every step names a flowchart node, lines exist in the code', () => {
  const NODES = new Set(['init', 'slide', 'better', 'upd', 'more', 'ret']);
  for (let i = 0; i < 100; i++) {
    const n = rng.int(1, 10), k = rng.int(1, n), a = Array.from({ length: n }, () => rng.int(-9, 30));
    const steps = S.windowFixed(a, k, { flow: true }), plain = S.windowFixed(a, k);
    assert.equal(steps[steps.length - 1].best, refMaxK(a, k).best);
    assert.equal(steps[steps.length - 1].counters.ops, plain[plain.length - 1].counters.ops);
    steps.forEach((s) => assert.ok(NODES.has(s.flow), 'flow node ' + s.flow));
    checkContract(steps, 'windowFixed flow');
    checkLines(steps, S.CODE.fixed, 'windowFixed flow');
  }
});
test('windowLongest steps name flowchart nodes', () => {
  const NODES = new Set(['init', 'add', 'dup', 'shrink', 'update', 'ret']);
  S.windowLongest('abcabcbb').forEach((s) => assert.ok(NODES.has(s.flow)));
});
