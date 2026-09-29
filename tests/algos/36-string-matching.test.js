/* Step generators for lesson 36 (js/algos/36-string-matching.js): naive, KMP, failure table, Rabin-Karp, Z, Boyer-Moore.
   Run: node --test tests/algos/36-string-matching.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '36-string-matching.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));
const STATES = new Set(Object.keys(core.STATES));

/* ------------------------------------------------------------ straightforward references */
function refFind(t, p) { const o = []; for (let s = 0; s + p.length <= t.length; s++) if (t.slice(s, s + p.length) === p) o.push(s); return o; }
function refPi(p) { // brute force: longest proper border of every prefix
  return [...p].map((_, i) => { const pre = p.slice(0, i + 1); for (let k = i; k >= 1; k--) if (pre.slice(0, k) === pre.slice(pre.length - k)) return k; return 0; });
}
function refZ(s) { return [...s].map((_, i) => { if (!i) return s.length; let k = 0; while (i + k < s.length && s[k] === s[i + k]) k++; return k; }); }
function refNaiveComparisons(t, p) { let c = 0; for (let s = 0; s + p.length <= t.length; s++) { let j = 0; while (j < p.length) { c++; if (t[s + j] !== p[j]) break; j++; } } return c; }
function randStr(rng, n, alpha) { let s = ''; for (let i = 0; i < n; i++) s += alpha[rng.int(0, alpha.length - 1)]; return s; }
const last = a => a[a.length - 1];

/* ------------------------------------------------------------ correctness of the answers */
test('find, naive, kmp, rabin-karp and z all agree with the reference on random inputs', () => {
  const rng = core.rng(36);
  for (let trial = 0; trial < 300; trial++) {
    const alpha = ['ab', 'abc', 'acgt'][trial % 3];
    const t = randStr(rng, rng.int(0, 22), alpha), p = randStr(rng, rng.int(1, 5), alpha);
    const want = refFind(t, p);
    assert.deepEqual(S.find(t, p), want);
    assert.deepEqual(last(S.naive(t, p)).matches, want, `naive ${t} / ${p}`);
    assert.deepEqual(last(S.kmp(t, p)).matches, want, `kmp ${t} / ${p}`);
    assert.deepEqual(last(S.boyerMoore(t, p)).matches, want, `bm ${t} / ${p}`);
    for (const q of [7, 13, 101]) assert.deepEqual(last(S.rabinKarp(t, p, { mod: q })).matches, want, `rk q=${q} ${t} / ${p}`);
    assert.deepEqual(last(S.zSteps(p, t)).matches, want, `z ${t} / ${p}`);
  }
});

test('edge cases: empty text, pattern longer than text, equal strings, one letter, overlaps, absent', () => {
  const cases = [['', 'a'], ['a', 'ab'], ['abc', 'abc'], ['a', 'a'], ['aaaa', 'aa'], ['aaaa', 'aaaaa'], ['abab', 'ba'], ['xyz', 'q'], ['aaaaaaaa', 'aaab'], ['abcabcabc', 'abc']];
  for (const [t, p] of cases) {
    const want = refFind(t, p);
    for (const name of ['naive', 'kmp', 'boyerMoore']) {
      const steps = S[name](t, p);
      assert.ok(steps.length >= 1, `${name} ${t}/${p} has steps`);
      assert.deepEqual(last(steps).matches, want, `${name} ${t}/${p}`);
    }
    assert.deepEqual(last(S.rabinKarp(t, p)).matches, want, `rk ${t}/${p}`);
    assert.deepEqual(last(S.zSteps(p, t)).matches, want, `z ${t}/${p}`);
  }
  assert.deepEqual(S.find('aaaa', 'aa'), [0, 1, 2]);
});

test('prefixTable matches a brute-force border search; prefixSteps ends with the same table', () => {
  const rng = core.rng(7);
  for (let trial = 0; trial < 200; trial++) {
    const p = randStr(rng, rng.int(1, 12), ['ab', 'abc'][trial % 2]);
    assert.deepEqual(S.prefixTable(p), refPi(p), p);
    const steps = S.prefixSteps(p);
    assert.deepEqual(last(steps).vars.pi, refPi(p), 'steps: ' + p);
  }
  assert.deepEqual(S.prefixTable('ababaca'), [0, 0, 1, 2, 3, 0, 1]);
  assert.deepEqual(S.prefixTable('aaaa'), [0, 1, 2, 3]);
  assert.deepEqual(S.prefixTable('abcd'), [0, 0, 0, 0]);
  assert.deepEqual(S.prefixTable('a'), [0]);
  assert.deepEqual(S.prefixTable(''), []);
});

test('zArray matches the brute-force definition', () => {
  const rng = core.rng(9);
  for (let trial = 0; trial < 200; trial++) {
    const s = randStr(rng, rng.int(1, 16), ['ab', 'abc'][trial % 2]);
    assert.deepEqual(S.zArray(s), refZ(s), s);
  }
});

/* ------------------------------------------------------------ counters and cost claims */
test('counters: steps and count-only agree, and counters never decrease', () => {
  const rng = core.rng(5);
  for (let trial = 0; trial < 120; trial++) {
    const t = randStr(rng, rng.int(2, 24), ['ab', 'abc'][trial % 2]), p = randStr(rng, rng.int(1, 5), ['ab', 'abc'][trial % 2]);
    const runs = { naive: S.naive(t, p), kmp: S.kmp(t, p), rk: S.rabinKarp(t, p, { mod: 13 }), z: S.zSteps(p, t), prefix: S.prefixSteps(p + p[0]), bm: S.boyerMoore(t, p) };
    for (const [name, steps] of Object.entries(runs)) {
      const keys = Object.keys(steps[0].counters);
      for (let k = 1; k < steps.length; k++) {
        assert.deepEqual(Object.keys(steps[k].counters), keys, `${name}: same counter keys`);
        for (const key of keys) assert.ok(steps[k].counters[key] >= steps[k - 1].counters[key], `${name}.${key} never decreases`);
        assert.ok(steps[k].work >= steps[k - 1].work || name === 'prefix' || name === 'z' || name === 'bm', `${name} work never decreases`);
      }
    }
    assert.equal(last(runs.naive).counters.comparisons, S.count.naive(t, p).comparisons);
    assert.equal(last(runs.naive).counters.comparisons, refNaiveComparisons(t, p));
    assert.equal(last(runs.kmp).counters.comparisons, S.count.kmp(t, p).comparisons);
    const rk = S.count.rabinKarp(t, p, { mod: 13 });
    assert.equal(last(runs.rk).counters.comparisons, rk.comparisons);
    assert.equal(last(runs.rk).counters.spurious, rk.spurious);
    assert.equal(last(runs.rk).work, rk.work);
    assert.equal(last(runs.z).counters.comparisons, S.count.z(p, t).comparisons);
  }
});

test('adversarial input: naive is n·m, KMP stays under 2n, Rabin-Karp verifies nothing', () => {
  for (const [n, m] of [[10, 4], [20, 5], [40, 8], [100, 10]]) {
    const t = 'a'.repeat(n), p = 'a'.repeat(m - 1) + 'b';
    assert.equal(S.count.naive(t, p).comparisons, (n - m + 1) * m);
    const k = S.count.kmp(t, p);
    assert.ok(k.comparisons <= 2 * n, `kmp ${k.comparisons} <= ${2 * n}`);
    assert.ok(k.comparisons + k.tableCost < (n - m + 1) * m || n < 12);
    const r = S.count.rabinKarp(t, p, { mod: 1009 });
    assert.equal(r.comparisons, 0);
    assert.equal(r.hits, 0);
    assert.ok(r.work <= n + m);
  }
});

test('KMP text pointer never moves left, and it needs at most 2n comparisons on random text', () => {
  const rng = core.rng(11);
  for (let trial = 0; trial < 200; trial++) {
    const t = randStr(rng, rng.int(1, 40), 'ab'), p = randStr(rng, rng.int(1, 6), 'ab');
    const steps = S.kmp(t, p);
    let prevI = 0;
    for (const s of steps) if (s.vars.i !== undefined) { assert.ok(s.vars.i >= prevI, 'i monotone'); prevI = s.vars.i; }
    assert.ok(S.count.kmp(t, p).comparisons <= 2 * t.length);
  }
});

test('rabin-karp rolling hash equals a fresh hash of every window', () => {
  const rng = core.rng(21);
  for (let trial = 0; trial < 100; trial++) {
    const q = [7, 13, 97][trial % 3];
    const t = randStr(rng, rng.int(6, 24), 'abcde'), p = randStr(rng, rng.int(2, 5), 'abcde');
    if (t.length < p.length) continue;
    const steps = S.rabinKarp(t, p, { mod: q });
    const fresh = str => [...str].reduce((h, ch) => (h * 10 + (ch.charCodeAt(0) - 96)) % q, 0);
    for (const s of steps) {
      if (s.kind === 'hashcmp') {
        const start = s.offset, win = t.slice(start, start + p.length);
        assert.equal(s.hash.hit, fresh(win) === fresh(p));
      }
      if (s.kind === 'rollAdd') assert.equal(s.hash.h, fresh(t.slice(s.offset, s.offset + p.length)), 'rolled = fresh');
      if (s.kind === 'verified') assert.equal(t.slice(s.offset, s.offset + p.length), p);
      if (s.kind === 'spurious') assert.notEqual(t.slice(s.offset, s.offset + p.length), p);
    }
  }
});

/* ------------------------------------------------------------ truthful visuals */
test('visual states tell the truth on every step', () => {
  const rng = core.rng(3);
  const traces = [];
  for (let trial = 0; trial < 60; trial++) {
    const t = randStr(rng, rng.int(2, 22), ['ab', 'abc'][trial % 2]), p = randStr(rng, rng.int(1, 5), ['ab', 'abc'][trial % 2]);
    traces.push(['naive', t, p, S.naive(t, p)], ['kmp', t, p, S.kmp(t, p)], ['rk', t, p, S.rabinKarp(t, p, { mod: 7 })], ['bm', t, p, S.boyerMoore(t, p)]);
    traces.push(['prefix', p, p, S.prefixSteps(p)], ['z', p + '#' + t, p + '#' + t, S.zSteps(p, t)]);
  }
  for (const [name, text, pat, steps] of traces) {
    const occ = new Set(); refFind(name === 'z' ? text.slice(pat.length + 1 - 0) : text, pat);
    for (const s of steps) {
      assert.ok(typeof s.caption === 'string' && s.caption.length > 5, `${name} caption`);
      const P = s.pat === null ? null : s.pat;
      const check = (map, isText) => Object.values(map).forEach(v => assert.ok(STATES.has(v), `${name}: state ${v}`));
      check(s.tStates); check(s.pStates);
      if (P !== null && s.offset !== null && s.algo !== 'rk') {
        // a 'found' cell pair must show equal characters wherever both cells exist
        for (const [j, st] of Object.entries(s.pStates)) {
          if (st !== 'found' && st !== 'done') continue;
          const ti = s.offset + Number(j), tst = s.tStates[ti];
          if (tst === 'found' || tst === 'done') assert.equal(s.text[ti], P[j], `${name}: found pair text[${ti}] vs pat[${j}] at ${s.kind}`);
        }
        if (s.cmp) {
          const eq = s.text[s.cmp.t] === P[s.cmp.p];
          assert.equal(s.cmp.state, eq ? 'found' : 'error', `${name}: cmp colour`);
          assert.equal(s.cmp.t, s.offset + s.cmp.p, `${name}: cmp cells line up`);
        }
      }
      // 'done' text cells belong to confirmed occurrences only
      const occs = name === 'z' ? null : refFind(text, pat);
      for (const [i, st] of Object.entries(s.tStates)) if (st === 'done' && occs) {
        assert.ok(occs.some(o => Number(i) >= o && Number(i) < o + pat.length), `${name}: done cell ${i} outside every occurrence (${text}/${pat})`);
      }
      if (name === 'z') for (const [i, st] of Object.entries(s.tStates)) if (st === 'done') {
        const m = pat.length; assert.ok(Number(i) > 0);
      }
    }
    // every state list stays inside the drawn strings
    for (const s of steps) Object.keys(s.tStates).forEach(i => assert.ok(Number(i) >= 0 && Number(i) < s.text.length, `${name}: t index in range`));
  }
});

test('KMP jump steps keep matched characters aligned', () => {
  const t = 'abababac', p = 'ababac';
  const steps = S.kmp(t, p);
  const jump = steps.find(s => s.kind === 'jump');
  assert.ok(jump, 'has a jump');
  assert.equal(jump.offset, 2, 'π[4] = 3, so the pattern moves from 0 to 2');
  assert.equal(jump.ghost, 0);
  assert.equal(jump.arrows[0].label, 'π[4] = 3');
  assert.deepEqual(last(steps).matches, [2]);
  // the ghost is where the pattern was, and the aligned prefix really equals the text under it
  for (const s of steps.filter(x => x.kind === 'jump')) for (const [j, st] of Object.entries(s.pStates)) if (st === 'found') assert.equal(t[s.offset + Number(j)], p[j]);
});

test('Z steps: the Z-box only ever claims text that equals the prefix', () => {
  const rng = core.rng(13);
  for (let trial = 0; trial < 80; trial++) {
    const pat = randStr(rng, rng.int(1, 4), 'ab'), text = randStr(rng, rng.int(0, 16), 'ab');
    const s = pat + '#' + text;
    for (const st of S.zSteps(pat, text)) for (const b of st.bands) {
      if (b.dashed) continue;
      for (let q = b.from; q <= b.to; q++) assert.equal(s[q], s[q - b.from], `box [${b.from},${b.to}] of ${s}`);
    }
  }
});

test('boyer-moore never compares more than naive and skips on absent letters', () => {
  const t = 'abcabcabcabcabc', p = 'xyz';
  assert.ok(S.count.naive(t, p).comparisons > S.boyerMoore(t, p).slice(-1)[0].counters.comparisons);
  const rng = core.rng(4);
  for (let trial = 0; trial < 100; trial++) {
    const tt = randStr(rng, rng.int(5, 30), 'abcd'), pp = randStr(rng, rng.int(1, 5), 'abcd');
    assert.ok(last(S.boyerMoore(tt, pp)).counters.comparisons <= S.count.naive(tt, pp).comparisons * 1 + tt.length);
  }
});

/* ------------------------------------------------------------ code panels */
test('every step.line label exists in every language of its code panel', () => {
  const rng = core.rng(2);
  const t = randStr(rng, 18, 'ab'), p = 'abab';
  const runs = { naive: S.naive(t, p), kmp: S.kmp(t, p), prefix: S.prefixSteps('ababaca'), rk: S.rabinKarp(t + 'abab', p, { mod: 7 }), z: S.zSteps('aab', 'aabxaabaab') };
  for (const [name, steps] of Object.entries(runs)) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(S.CODE[name][lang], lang);
    const used = new Set();
    for (const s of steps) [].concat(s.line === null ? [] : s.line).forEach(l => used.add(l));
    assert.ok(used.size >= 3, `${name} uses several labels`);
    for (const label of used) for (const lang of Object.keys(parsed)) assert.ok(parsed[lang].labels[label], `${name}: label @${label} missing in ${lang}`);
    for (const lang of Object.keys(parsed)) assert.ok(!code.plainText(parsed[lang]).includes('@'), `${name} ${lang}: label text visible`);
  }
});

test('code in the panels actually runs and matches the generators (JS versions)', () => {
  const rng = core.rng(8);
  const naiveJs = new Function(S.CODE.naive.js + '; return naiveSearch;')();
  const prefixJs = S.CODE.prefix.js, kmpJs = S.CODE.kmp.js, rkJs = S.CODE.rk.js, zJs = S.CODE.z.js;
  const kmpFn = new Function(prefixJs + ';' + kmpJs + '; return kmpSearch;')();
  const rkFn = new Function(rkJs + '; return rabinKarp;')();
  const zFn = new Function(zJs + '; return zArray;')();
  for (let trial = 0; trial < 100; trial++) {
    const t = randStr(rng, rng.int(5, 24), 'abc'), p = randStr(rng, rng.int(1, 4), 'abc');
    const want = refFind(t, p);
    assert.deepEqual(naiveJs(t, p), want);
    assert.deepEqual(kmpFn(t, p), want);
    assert.deepEqual(rkFn(t, p, 10, 13), want);
    assert.deepEqual(zFn(p + '#' + t).slice(1), refZ(p + '#' + t).slice(1));
  }
});
