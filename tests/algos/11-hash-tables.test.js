/* Step generators for lesson 11 (js/algos/11-hash-tables.js): hashing, chaining, open addressing, simulations.
   Run: node --test tests/algos/11-hash-tables.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const H = require(path.join(ROOT, 'js', 'algos', '11-hash-tables.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));

const STATES = new Set(Object.keys(core.STATES));
const KINDS = ['linear', 'quadratic', 'double'];
const mod = (a, m) => ((a % m) + m) % m;

/* ------------------------------------------------------------ reference implementations */
function refProbeSeq(kind, key, m, hk) {
  const home = H.hashOf(key, m, hk), step = H.secondHash(key, m), out = [];
  for (let i = 0; i < m; i++) out.push(kind === 'quadratic' ? mod(home + i * i, m) : kind === 'double' ? mod(home + i * step, m) : mod(home + i, m));
  return out;
}
/* A lookup exactly as the textbook writes it, on the final slot array (null = empty, TOMB = tombstone). */
function refHas(kind, key, m, slots, tombs, hk) {
  for (const s of refProbeSeq(kind, key, m, hk)) {
    if (slots[s] === null && !tombs.includes(s)) return false;
    if (slots[s] === key) return true;
  }
  return false;
}
function randomKeys(rng, n, range) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng() < 0.2 ? 'abcdefghij'.slice(0, rng.int(1, 8)).split('').reverse().join('').slice(0, rng.int(1, 5)) : rng.int(0, range));
  return out;
}
function randomOps(seed, n, range, withResize) {
  const rng = core.rng(seed), ops = [], keys = randomKeys(rng, 12, range);
  for (let i = 0; i < n; i++) {
    const r = rng(), key = rng.pick(keys);
    if (withResize && r > 0.93) ops.push({ op: 'resize' });
    else ops.push({ op: r < 0.55 ? 'insert' : r < 0.8 ? 'search' : 'delete', key });
  }
  return ops;
}
function reference(ops) {
  const set = new Set(), results = [];
  for (const o of ops) {
    if (o.op === 'insert') set.add(o.key);
    else if (o.op === 'delete') set.delete(o.key);
    else if (o.op === 'search') results.push([o.key, set.has(o.key)]);
  }
  return { set, results };
}

function checkSteps(steps, label) {
  let prevC = null;
  steps.forEach((s, i) => {
    assert.ok(typeof s.caption === 'string' && s.caption.length, `${label} step ${i}: caption`);
    assert.ok(s.counters && Object.keys(s.counters).join() === Object.keys(steps[0].counters).join(), `${label} step ${i}: counter keys are stable`);
    if (prevC) {
      assert.ok(s.counters.compares === undefined || s.counters.compares >= prevC.compares, `${label}: compares never drop`);
      assert.ok(s.counters.probes === undefined || s.counters.probes >= prevC.probes, `${label}: probes never drop`);
      assert.ok(s.counters.collisions >= prevC.collisions, `${label}: collisions never drop`);
    }
    prevC = s.counters;
    const ids = new Set();
    s.entries.forEach(e => {
      assert.ok(!ids.has(e.id), `${label} step ${i}: duplicate entry id ${e.id}`);
      ids.add(e.id);
      assert.ok(STATES.has(e.state), `${label}: bad entry state ${e.state}`);
      assert.ok(e.bucket >= 0 && e.bucket < s.buckets, `${label}: bucket in range`);
    });
    if (s.mode === 'open') {
      const seen = new Set();
      s.entries.forEach(e => { assert.ok(!seen.has(e.bucket), `${label} step ${i}: slot ${e.bucket} holds two keys`); seen.add(e.bucket); });
      s.tombstones.forEach(t => assert.ok(!seen.has(t), `${label} step ${i}: tombstone ${t} overlaps a key`));
      assert.ok(Math.abs(s.loadFactor - (s.entries.length + s.tombstones.length) / s.buckets) < 1e-9, `${label}: load counts keys and tombstones`);
    }
    if (s.incoming) assert.ok(STATES.has(s.incoming.state || 'key'), 'incoming state');
    Object.values(s.bucketStates || {}).forEach(v => assert.ok(STATES.has(v), 'bucketStates uses shared states'));
  });
}

/* ------------------------------------------------------------ hash functions */
test('rawHash: integers are themselves, words use exact Horner base 31', () => {
  assert.equal(H.rawHash(24), 24);
  assert.equal(H.rawHash('cat'), 99 * 961 + 97 * 31 + 116);
  assert.equal(H.rawHash('a'), 97);
  assert.equal(H.hashOf(24, 7, 'mod'), 3);
  assert.equal(H.hashOf('cat', 7, 'first'), 99 % 7);
  assert.equal(H.hashOf(-3, 7, 'mod'), 4, 'never negative');
  assert.equal(H.secondHash(24, 7), 1 + (24 % 6));
  assert.ok(Number.isSafeInteger(H.rawHash('zzzzzzzz')), 'eight letters stay exact');
  assert.deepEqual(['24', ' cat ', 'Cat', '', 'a b', 'toolongword', '123456'].map(H.parseKey), [24, 'cat', 'cat', null, null, null, null]);
});

test('probe sequences: linear and double hashing visit every slot when m is prime; quadratic stays in range', () => {
  for (const m of H.PRIMES.slice(0, 8)) {
    for (const key of [0, 1, 7, 24, 100, 'cat', 'zebra']) {
      for (const kind of ['linear', 'double']) {
        const seq = refProbeSeq(kind, key, m, 'mod');
        assert.equal(new Set(seq).size, m, `${kind} m=${m} key=${key}`);
        for (let i = 0; i < m; i++) assert.equal(H.probeSlot(kind, H.hashOf(key, m, 'mod'), H.secondHash(key, m), m, i), seq[i]);
      }
      const q = refProbeSeq('quadratic', key, m, 'mod');
      assert.ok(q.every(s => s >= 0 && s < m));
      assert.ok(new Set(q.slice(0, Math.floor(m / 2) + 1)).size === Math.floor(m / 2) + 1, 'first (m+1)/2 quadratic probes are distinct for prime m');
    }
  }
});

/* ------------------------------------------------------------ the machine */
test('machine: characters accumulate exactly, then mod m', () => {
  for (const [text, kind] of [['cat', 'poly'], ['cat', 'sum'], ['cat', 'first'], ['banana', 'poly'], ['', 'poly'], ['a', 'sum']]) {
    for (const m of [7, 10, 13]) {
      const steps = H.machine(text, kind, m), last = steps[steps.length - 1];
      if (!text) { assert.equal(steps.length, 1); assert.equal(steps[0].kind, 'empty'); continue; }
      const num = kind === 'first' ? text.charCodeAt(0) : kind === 'sum' ? [...text].reduce((a, c) => a + c.charCodeAt(0), 0) : H.polyOf(text, 31);
      assert.equal(last.kind, 'mod');
      assert.equal(last.acc, num);
      assert.equal(last.bucket, mod(num, m));
      assert.equal(steps[0].kind, 'text');
      assert.ok(steps.every(s => s.acc <= num && s.vars));
      assert.equal(steps.length, 2 + (kind === 'first' ? 1 : text.length) - 0);
    }
  }
  assert.equal(H.machine('cat', 'poly', 10)[3].acc, 99 * 961 + 97 * 31 + 116);
});

/* ------------------------------------------------------------ chaining */
test('chaining equals a reference set on random operation scripts', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const ops = randomOps(seed, 22, 40, true);
    for (const opts of [{ m: 5 }, { m: 7, autoResize: true }, { m: 11, hash: 'first' }, { m: 5, autoResize: true, threshold: 0.5 }]) {
      const r = H.chaining(ops, opts), ref = reference(ops);
      const stored = r.final.chains.flat();
      assert.equal(stored.length, r.final.size);
      assert.equal(new Set(stored).size, stored.length, 'no duplicate keys');
      assert.deepEqual(new Set(stored), ref.set, `seed ${seed} ${JSON.stringify(opts)}`);
      r.final.chains.forEach((chain, b) => chain.forEach(k => assert.equal(H.hashOf(k, r.final.m, opts.hash || 'mod'), b, 'each key sits in its own bucket')));
      assert.equal(r.opStart.length, ops.length);
      assert.equal(r.opStart[0], 0);
      checkSteps(r.steps, 'chaining');
      // search outcomes: every search ends in hit or miss matching the reference
      let k = 0;
      const searchEnds = r.steps.filter((s, i) => s.opName === 'search' && (s.kind === 'hit' || s.kind === 'miss'));
      assert.equal(searchEnds.length, ref.results.length);
      searchEnds.forEach((s, i) => assert.equal(s.kind === 'hit', ref.results[i][1], `search #${i}`));
    }
  }
});

test('chaining: comparisons, collisions and the last snapshot agree with the model', () => {
  const ops = [10, 24, 17, 31, 3].map(key => ({ op: 'insert', key }));   // all in bucket 3 (mod 7)
  const r = H.chaining(ops, { m: 7 });
  const last = r.steps[r.steps.length - 1];
  assert.deepEqual(last.entries.filter(e => e.bucket === 3).map(e => e.key), [10, 24, 17, 31, 3]);
  assert.equal(r.final.collisions, 4);
  assert.equal(r.final.compares, 0 + 1 + 2 + 3 + 4, 'each insert walks the whole chain');
  assert.equal(last.counters.load, (5 / 7).toFixed(2));
  // an absent key in a chain of 5 costs 5 comparisons; a present key at the head costs 1
  const s1 = H.chaining(ops.concat([{ op: 'search', key: 45 }]), { m: 7 });
  assert.equal(s1.final.compares - r.final.compares, 5);
  const s2 = H.chaining(ops.concat([{ op: 'search', key: 10 }]), { m: 7 });
  assert.equal(s2.final.compares - r.final.compares, 1);
  // empty table
  assert.equal(H.chaining([], { m: 5 }).steps[0].kind, 'empty');
  assert.equal(H.chaining([{ op: 'search', key: 3 }], { m: 5 }).steps.pop().kind, 'miss');
  assert.equal(H.chaining([{ op: 'delete', key: 3 }], { m: 5 }).steps.pop().kind, 'miss');
});

test('chaining: duplicates, map values, delete and resize behave', () => {
  let r = H.chaining([{ op: 'insert', key: 5 }, { op: 'insert', key: 5 }], { m: 5 });
  assert.equal(r.final.size, 1);
  assert.equal(r.steps.pop().kind, 'dup');
  r = H.chaining([{ op: 'insert', key: 'cat', value: 1 }, { op: 'insert', key: 'cat', value: 2 }, { op: 'insert', key: 'dog', value: 1 }], { m: 5 });
  assert.deepEqual(r.final.values, { cat: 2, dog: 1 });
  assert.ok(r.steps.some(s => s.kind === 'update'));
  r = H.chaining([1, 2, 3, 4, 5].map(key => ({ op: 'insert', key })).concat([{ op: 'delete', key: 3 }]), { m: 5 });
  assert.equal(r.final.size, 4);
  assert.ok(!r.final.chains.flat().includes(3));
  // auto-resize: 4 keys in 5 buckets pass 0.75 at the 4th insert; the bigger table (11) holds up to 8 keys
  r = H.chaining([1, 2, 3, 4, 5, 6, 7].map(key => ({ op: 'insert', key })), { m: 5, autoResize: true });
  assert.equal(r.final.m, 11);
  assert.ok(r.final.size / r.final.m <= 0.75 + 1e-9);
  const grow = r.steps.filter(s => s.kind === 'growMove')[0];
  assert.ok(grow.entries.every(e => e.state === 'key' && e.bucket === e.key % 11), 'every key moved to k mod 11');
  // stops at the cap
  r = H.chaining(Array.from({ length: 40 }, (_, i) => ({ op: 'insert', key: i })), { m: 5, autoResize: true });
  assert.equal(r.final.m, 23);
  assert.ok(r.steps.some(s => s.kind === 'growMax'));
  assert.equal(H.chaining([{ op: 'resize' }], { m: 23 }).steps[0].kind, 'resizeMax');
});

/* ------------------------------------------------------------ open addressing */
test('open addressing equals a reference set for every probe sequence, with tombstones', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 90; seed++) {
      const ops = randomOps(seed * 7, 26, 60, true);
      for (const opts of [{ m: 7, kind }, { m: 11, kind, autoResize: false }, { m: 5, kind, threshold: 0.5, clusters: true }, { m: 13, kind, hash: 'first' }]) {
        const r = H.probing(ops, opts), ref = reference(ops);
        const keys = r.final.slots.filter(k => k !== null);
        assert.equal(new Set(keys).size, keys.length, 'a key is stored once');
        // keys that were inserted, when there was room, are present; failures only happen when the table cannot grow
        const missing = [...ref.set].filter(k => !keys.includes(k));
        const extra = keys.filter(k => !ref.set.has(k));
        assert.equal(extra.length, 0, `${kind} seed ${seed}: keys that should be gone are still there`);
        if (opts.autoResize === false || opts.m >= 7) {
          // tables without room reject inserts (a 'full' or 'growMax' step is recorded); otherwise nothing is missing
          if (missing.length) assert.ok(r.steps.some(s => s.kind === 'full' || s.kind === 'growMax' || s.kind === 'resizeMax' || s.kind === 'fail'), `${kind} ${seed}: missing ${missing} without a failure step`);
        }
        keys.forEach(k => assert.ok(refHas(kind, k, r.final.m, r.final.slots, r.final.tombstones, opts.hash || 'mod'), `${kind} seed ${seed}: key ${k} is reachable by probing`));
        checkSteps(r.steps, kind);
      }
    }
  }
});

test('open addressing: every search result equals the reference when tombstones are used', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 80; seed++) {
      const ops = randomOps(seed * 13, 30, 50, false);
      const r = H.probing(ops, { m: 11, kind, autoResize: true });
      // replay the reference against the table's own contents to decide the truth at each search
      const set = new Set(); const truth = [];
      let cap = 11;
      ops.forEach(o => {
        if (o.op === 'insert') set.add(o.key); else if (o.op === 'delete') set.delete(o.key);
        else truth.push(set.has(o.key));
      });
      const ends = r.steps.filter(s => s.opName === 'search' && (s.kind === 'hit' || s.kind === 'miss'));
      assert.equal(ends.length, truth.length);
      // A table that could not store a key (full at the cap) may miss it; with m=11 growing to 23 that needs > 16 live keys.
      if (r.final.size < 16) ends.forEach((s, i) => assert.equal(s.kind === 'hit', truth[i], `${kind} seed ${seed} search #${i}`));
    }
  }
});

test('the tombstone demo: naive deletion loses a key, a tombstone keeps it', () => {
  const bad = H.tombstoneDemo(true), good = H.tombstoneDemo(false);
  assert.deepEqual(bad.final.slots, [null, null, null, null, 17, 24, null]);
  assert.deepEqual(good.final.slots, [null, null, null, null, 17, 24, null]);
  assert.deepEqual(good.final.tombstones, [3]);
  assert.deepEqual(bad.final.tombstones, []);
  const lastBad = bad.steps[bad.steps.length - 1], lastGood = good.steps[good.steps.length - 1];
  assert.equal(lastBad.kind, 'miss');
  assert.ok(/wrongly/.test(lastBad.caption), 'the failure is called out');
  assert.equal(lastGood.kind, 'hit');
  assert.deepEqual(lastGood.probe.slots, [3, 4, 5], 'probed past the tombstone and 17');
  assert.equal(lastGood.entries.find(e => e.key === 24).state, 'found');
  // in the failing trace the entry for 24 is flagged, never shown as found
  assert.ok(bad.steps.filter(s => s.opName === 'search').every(s => s.entries.every(e => e.state !== 'found')));
  assert.ok(bad.steps.some(s => s.opName === 'search' && s.entries.some(e => e.key === 24 && e.state === 'error')));
});

test('open addressing: tombstones are reused by inserts and dropped by a resize', () => {
  let r = H.probing([{ op: 'insert', key: 10 }, { op: 'insert', key: 17 }, { op: 'delete', key: 10 }, { op: 'insert', key: 24 }], { m: 7, autoResize: false });
  // 24 has home 3: slot 3 is a tombstone, slot 4 holds 17; 24 must reuse the tombstone
  assert.deepEqual(r.final.slots, [null, null, null, 24, 17, null, null]);
  assert.deepEqual(r.final.tombstones, []);
  assert.ok(r.steps.some(s => s.kind === 'place' && /reusing the tombstone/.test(s.caption)));
  r = H.probing([{ op: 'insert', key: 10 }, { op: 'insert', key: 17 }, { op: 'delete', key: 10 }, { op: 'resize' }], { m: 7, autoResize: false });
  assert.deepEqual(r.final.tombstones, []);
  assert.equal(r.final.m, 17);
  assert.equal(r.final.slots[H.hashOf(17, 17, 'mod')], 17);
  // a tombstone counts as load
  const last = H.probing([{ op: 'insert', key: 1 }, { op: 'delete', key: 1 }], { m: 7 }).steps.pop();
  assert.equal(last.loadFactor, 1 / 7);
  assert.equal(last.counters.entries, 0);
});

test('quadratic probing that cannot find a free slot grows the table and retries', () => {
  const ops = [7, 14, 21, 28, 35].map(key => ({ op: 'insert', key }));     // all home 0 in m = 7
  const r = H.probing(ops, { m: 7, kind: 'quadratic', autoResize: true });
  assert.ok(r.steps.some(s => s.kind === 'fail'), 'the fifth key has nowhere to go');
  assert.equal(r.final.m, 17);
  assert.deepEqual(r.final.slots.filter(k => k !== null).sort((a, b) => a - b), [7, 14, 21, 28, 35]);
  const stuck = H.probing(ops, { m: 7, kind: 'quadratic', autoResize: false });
  assert.equal(stuck.steps.pop().kind, 'full');
  assert.equal(stuck.final.size, 4);
  // linear probing would have found room
  assert.equal(H.probing(ops, { m: 7, kind: 'linear', autoResize: false }).final.size, 5);
});

test('open addressing: probing every slot proves absence, and probe counts match the sequence', () => {
  // fill a table completely (no growth): a miss must walk all m slots and report absent
  const ops = [0, 1, 2, 3, 4].map(key => ({ op: 'insert', key })).concat([{ op: 'search', key: 5 }]);
  const r = H.probing(ops, { m: 5, autoResize: false });
  const end = r.steps.pop();
  assert.equal(end.kind, 'miss');
  assert.equal(end.probe.slots.length, 5);
  // probes counter increments once per slot examined
  const one = H.probing([{ op: 'insert', key: 10 }, { op: 'insert', key: 17 }, { op: 'search', key: 17 }], { m: 7, autoResize: false });
  assert.equal(one.final.probes, 1 + 2 + 2);
  assert.equal(one.final.collisions, 1);
  assert.equal(H.probing([], { m: 7 }).steps[0].kind, 'empty');
  assert.equal(H.probing([{ op: 'delete', key: 4 }], { m: 7 }).steps.pop().kind, 'miss');
});

test('runs finds clusters of consecutive filled slots, cyclically', () => {
  assert.deepEqual(H.runs([1, 1, 0, 1, 0, 0]), [{ start: 0, length: 2 }, { start: 3, length: 1 }]);
  assert.deepEqual(H.runs([1, 0, 1, 1, 1, 1]).map(r => r.length), [5]);        // wraps around
  assert.deepEqual(H.runs([1, 1, 1]), [{ start: 0, length: 3 }]);
  assert.deepEqual(H.runs([0, 0, 0]), []);
  assert.deepEqual(H.runs([]), []);
  const r = H.probing([10, 17, 24].map(key => ({ op: 'insert', key })), { m: 7, kind: 'linear', clusters: true, autoResize: false });
  const s = r.steps[r.steps.length - 1];
  assert.deepEqual(Object.keys(s.bucketStates).sort(), ['3', '4', '5'], 'the run of three is highlighted');
});

/* ------------------------------------------------------------ the race, the histogram, the simulations */
test('clusterRace: same keys, three sequences; totals are sums of per-key probes', () => {
  const keys = [10, 33, 56, 79, 102, 125, 148, 171];
  const frames = H.clusterRace(keys, 23);
  assert.equal(frames.length, keys.length);
  KINDS.forEach(kind => {
    let total = 0;
    frames.forEach((f, i) => {
      total += f.kinds[kind].probes;
      assert.equal(f.kinds[kind].total, total);
      assert.equal(f.kinds[kind].slots.filter(x => x !== null).length, i + 1);
      assert.equal(f.kinds[kind].slots[f.kinds[kind].slot], keys[i]);
    });
  });
  // these keys share home slot 10 (23 | difference): linear probing builds one long cluster, double hashing scatters them
  assert.equal(frames[7].kinds.linear.longest, 8);
  assert.ok(frames[7].kinds.double.longest < 8);
  assert.ok(frames[7].kinds.linear.total > frames[7].kinds.double.total);
});

test('distribution: counts add up, first-letter hashing piles usernames into one bucket', () => {
  const ks = H.KEYSETS;
  for (const set of Object.keys(ks)) for (const kind of ['first', 'sum', 'poly']) {
    const d = H.distribution(ks[set], 13, kind);
    assert.equal(d.counts.reduce((a, b) => a + b, 0), ks[set].length);
    assert.equal(d.max, Math.max(...d.counts));
    assert.equal(d.empty, d.counts.filter(c => c === 0).length);
    d.bucketOf.forEach((b, i) => assert.ok(b >= 0 && b < 13));
  }
  assert.equal(H.distribution(ks.usernames, 13, 'first').max, ks.usernames.length);
  assert.ok(H.distribution(ks.usernames, 13, 'poly').max <= 7);
  assert.ok(H.distribution(ks.anagrams, 13, 'sum').max > H.distribution(ks.anagrams, 13, 'poly').max, 'anagrams share their character sum');
  assert.equal(H.distribution([], 5, 'poly').empty, 5);
});

test('birthday: exact probability, and simulation agrees', () => {
  assert.ok(Math.abs(H.birthdayProb(23, 365) - 0.5073) < 1e-3);
  assert.equal(H.birthdayProb(0, 365), 0);
  assert.equal(H.birthdayProb(1, 365), 0);
  assert.equal(H.birthdayProb(366, 365), 1);
  assert.ok(Math.abs(H.birthdayProb(2, 10) - 0.1) < 1e-12);
  const rng = core.rng(11);
  const run = H.birthdayRun(365, rng);
  assert.equal(run.slots.length, run.throws);
  assert.equal(run.slots[run.throws - 1], run.slot);
  assert.equal(new Set(run.slots.slice(0, -1)).size, run.throws - 1, 'only the last throw collides');
  assert.equal(run.slots[run.first], run.slot);
  const hist = H.birthdayHistogram(365, 4000, core.rng(5));
  assert.equal(Object.values(hist.counts).reduce((a, b) => a + b, 0), 4000);
  assert.ok(Math.abs(hist.mean - 24.6) < 1.2, 'mean throws to first collision is about sqrt(pi m / 2) = 24.6, got ' + hist.mean);
  const runOne = H.birthdayRun(1, core.rng(1));
  assert.equal(runOne.throws, 2);
});

test('expected probes: textbook formulas and simulation agree', () => {
  assert.deepEqual(H.expectedProbes('chaining', 0.5), { found: 1.25, missing: 0.5 });
  assert.equal(H.expectedProbes('linear', 0.5).missing, 2.5);
  assert.equal(H.expectedProbes('linear', 0.5).found, 1.5);
  assert.ok(Math.abs(H.expectedProbes('linear', 0.9).missing - 50.5) < 1e-9);
  assert.equal(H.expectedProbes('double', 0.5).missing, 2);
  assert.ok(Math.abs(H.expectedProbes('double', 0.5).found - 2 * Math.log(2)) < 1e-12);
  assert.equal(H.expectedProbes('double', 0).found, 1);
  const alphas = [0.25, 0.5, 0.75];
  for (const kind of ['chaining', 'linear', 'double']) {
    const sim = H.simulateProbes(kind, 211, alphas, 60, core.rng(3));
    sim.forEach(p => {
      const t = H.expectedProbes(kind, p.alpha);
      assert.ok(Math.abs(p.found - t.found) / t.found < 0.12, `${kind} α=${p.alpha} found ${p.found} vs ${t.found}`);
      assert.ok(Math.abs(p.missing - t.missing) / t.missing < 0.2, `${kind} α=${p.alpha} missing ${p.missing} vs ${t.missing}`);
    });
  }
  assert.deepEqual(H.simulateProbes('linear', 11, [0], 3, core.rng(1)), [{ alpha: 0, found: 1, missing: 1 }]);
});

test('growthCosts: doubling is amortised O(1), adding a constant is not', () => {
  const d = H.growthCosts(1000, 'double'), p = H.growthCosts(1000, 'plus');
  assert.equal(d.costs.length, 1000);
  assert.ok(d.avg[999] < 3.1, 'about 3 units per insert');
  assert.ok(p.avg[999] > 30, 'grows with n');
  assert.deepEqual(d.resizes.slice(0, 4), [5, 9, 17, 33]);
  assert.equal(d.costs[4], 1 + 4);
  assert.equal(d.total, d.costs.reduce((a, b) => a + b, 0));
  assert.equal(H.growthCosts(0, 'double').costs.length, 0);
  for (let n = 1; n <= 200; n++) assert.ok(H.growthCosts(n, 'double').total <= 3 * n, 'total cost of n inserts <= 3n');
});

/* ------------------------------------------------------------ code labels */
test('every step line exists in every language of its code panel', () => {
  const panels = { chaining: H.CODE.chaining, linear: H.openCode('linear'), quadratic: H.openCode('quadratic'), double: H.openCode('double') };
  const parsed = {};
  Object.keys(panels).forEach(name => { parsed[name] = {}; for (const lang of ['pseudo', 'js', 'py']) parsed[name][lang] = code.parse(panels[name][lang], lang); });
  Object.keys(panels).forEach(name => for_(name));
  function for_(name) {
    for (const lang of ['pseudo', 'js', 'py']) assert.ok(!code.plainText(parsed[name][lang]).includes('@'), `${name} ${lang}: label text visible`);
  }
  function labelsOf(line) { return line === null || line === undefined ? [] : [].concat(line); }
  const ops = randomOps(99, 40, 30, true);
  const runs = [['chaining', H.chaining(ops, { m: 5, autoResize: true })]];
  KINDS.forEach(k => runs.push([k, H.probing(ops, { m: 5, kind: k })]));
  runs.push(['linear', H.tombstoneDemo(true)], ['linear', H.tombstoneDemo(false)], ['quadratic', H.probing([7, 14, 21, 28, 35].map(key => ({ op: 'insert', key })), { m: 7, kind: 'quadratic' })]);
  for (const [name, r] of runs) {
    r.steps.forEach(s => labelsOf(s.line).forEach(label => {
      for (const lang of ['pseudo', 'js', 'py']) assert.ok(parsed[name][lang].labels[label], `${name}: label @${label} missing in ${lang} (step kind ${s.kind})`);
    }));
  }
  // the js panels are valid, working JavaScript that agrees with the generator on a small script
  const set = eval('(function(){ const hash = k => typeof k === "number" ? k : [...k].reduce((a, c) => a * 31 + c.charCodeAt(0), 0);' +
    'const nextPrime = n => [5,7,11,13,17,23,29,37].find(p => p >= n);' + panels.chaining.js.replace(/^class ChainedSet/, 'class ChainedSet') + '; return new ChainedSet(5); })()');
  [10, 24, 17, 'cat', 3, 8, 24].forEach(k => set.add(k));
  set.delete(10);
  const model = H.chaining([10, 24, 17, 'cat', 3, 8, 24].map(key => ({ op: 'insert', key })).concat([{ op: 'delete', key: 10 }]), { m: 5, autoResize: true, threshold: 0.75 }).final;
  assert.equal(set.m, model.m);
  assert.deepEqual(set.chains, model.chains);
});

test('the JavaScript probing code runs and matches the generator', () => {
  for (const kind of KINDS) {
    const js = H.openCode(kind).js;
    const make = eval('(function(){ const hash = k => typeof k === "number" ? k : [...k].reduce((a, c) => a * 31 + c.charCodeAt(0), 0);' +
      'const nextPrime = n => [5,7,11,13,17,23,29,37].find(p => p >= n);' + js + '; return ProbingSet; })()');
    const rng = core.rng(42);
    for (let t = 0; t < 40; t++) {
      const ops = []; for (let i = 0; i < 14; i++) ops.push({ op: rng() < 0.75 ? 'insert' : 'delete', key: rng.int(0, 30) });
      const set = new make(7);
      ops.forEach(o => { if (o.op === 'insert') set.add(o.key); else set.delete(o.key); });
      const model = H.probing(ops, { m: 7, kind, autoResize: true, threshold: 0.7, maxBuckets: 37 }).final;
      const asKeys = set.slots.map(s => (typeof s === 'symbol' || s === null ? null : s));
      assert.deepEqual(asKeys, model.slots, `${kind} trial ${t}`);
    }
  }
});
