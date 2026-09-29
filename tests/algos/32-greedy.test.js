// Lesson 32 · Greedy algorithms — generator and solver tests.
// Run: node --test tests/algos/32-greedy.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const G = require(path.join(root, 'js/algos/32-greedy.js'));
const VDSA = require(path.join(root, 'js/vdsa/core.js'));

/* ------------------------------------------------------------------ references */
function bruteMax(ivs) {
  let best = 0; const n = ivs.length;
  for (let m = 0; m < (1 << n); m++) {
    const p = []; for (let i = 0; i < n; i++) if (m & (1 << i)) p.push(ivs[i]);
    let ok = true;
    for (let a = 0; a < p.length && ok; a++) for (let b = a + 1; b < p.length; b++) if (p[a].s < p[b].e && p[b].s < p[a].e) { ok = false; break; }
    if (ok) best = Math.max(best, p.length);
  }
  return best;
}
function compatible(ids, ivs) {
  const by = Object.fromEntries(ivs.map(i => [i.id, i]));
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if (G.overlaps(by[ids[a]], by[ids[b]])) return false;
  return true;
}
function refCoins(coins, amount) {
  const memo = new Map();
  (function f(a) { if (a === 0) return 0; if (memo.has(a)) return memo.get(a); let b = Infinity; for (const c of coins) if (c <= a) b = Math.min(b, f(a - c) + 1); memo.set(a, b); return b; })(amount);
  const r = (function f(a) { if (a === 0) return 0; if (memo.has(a)) return memo.get(a); let b = Infinity; for (const c of coins) if (c <= a) b = Math.min(b, f(a - c) + 1); memo.set(a, b); return b; })(amount);
  return r;
}
function randIvs(rng, n) { const pairs = []; for (let i = 0; i < n; i++) { const len = rng.int(1, 8), s = rng.int(0, 24 - len); pairs.push([s, s + len]); } return G.makeIntervals(pairs); }
function checkSteps(steps) {
  assert.ok(steps.length > 0);
  for (const st of steps) { assert.equal(typeof st.caption, 'string'); assert.ok(st.caption.length > 0); }
}

/* ------------------------------------------------------------------ intervals */
test('earliest finish equals the brute-force optimum on random inputs', () => {
  const rng = VDSA.rng(32);
  for (let t = 0; t < 300; t++) {
    const ivs = randIvs(rng, rng.int(1, 9));
    const picked = G.optimalPick(ivs);
    assert.ok(compatible(picked, ivs));
    assert.equal(picked.length, bruteMax(ivs));
  }
});
test('every strategy returns a compatible set no larger than the optimum', () => {
  const rng = VDSA.rng(5);
  for (let t = 0; t < 200; t++) {
    const ivs = randIvs(rng, rng.int(1, 9));
    const best = bruteMax(ivs);
    for (const s of G.STRAT_IDS) { const p = G.pick(ivs, s); assert.ok(compatible(p, ivs)); assert.ok(p.length <= best); assert.ok(p.length >= 1); }
  }
});
test('touching intervals do not clash; duplicates do', () => {
  const ivs = G.makeIntervals([[0, 4], [4, 8], [8, 12]]);
  assert.equal(G.optimalPick(ivs).length, 3);
  const dup = G.makeIntervals([[2, 6], [2, 6], [2, 6]]);
  assert.equal(G.optimalPick(dup).length, 1);
  assert.equal(G.optimalPick(G.makeIntervals([[1, 2]])).length, 1);
  assert.equal(G.optimalPick([]).length, 0);
});
test('the wrong strategies have counterexamples, earliest finish never does', () => {
  for (const s of ['start', 'short', 'conflicts']) {
    const ex = G.findCounterexample(s, 0);
    assert.ok(ex, s);
    assert.ok(G.pick(ex, s).length < bruteMax(ex), s);
  }
  for (const [txt, s] of [['0-20, 2-6, 8-12, 14-18', 'start'], ['0-7, 6-9, 8-15', 'short'], ['15-20, 1-8, 10-15, 0-2, 18-24, 7-11, 12-18', 'conflicts']]) {
    const ivs = G.parseIntervals(txt).intervals;
    assert.ok(G.pick(ivs, s).length < bruteMax(ivs), txt);
    assert.equal(G.pick(ivs, 'finish').length, bruteMax(ivs));
  }
});
test('scoreboard matches pick', () => {
  const ivs = G.parseIntervals('0-7, 6-9, 8-15').intervals;
  assert.deepEqual(G.scoreboard(ivs), { start: 2, short: 1, conflicts: 2, finish: 2 });
});
test('parseIntervals validates', () => {
  assert.equal(G.parseIntervals('1-3').error !== null, true);
  assert.equal(G.parseIntervals('1-3, 5').error !== null, true);
  assert.equal(G.parseIntervals('5-3, 1-2').error !== null, true);
  assert.equal(G.parseIntervals('1-30, 2-3').error !== null, true);
  assert.equal(G.parseIntervals('0-1,1-2,2-3,3-4,4-5,5-6,6-7,7-8,8-9,9-10').error !== null, true);
  const r = G.parseIntervals('0-4, 3–8');
  assert.equal(r.error, null); assert.equal(r.intervals.length, 2); assert.equal(G.intervalsToText(r.intervals), '0-4, 3-8');
});
test('intervalTrace: kept set equals pick(), snapshots complete, states truthful', () => {
  const rng = VDSA.rng(11);
  for (let t = 0; t < 120; t++) {
    const ivs = randIvs(rng, rng.int(2, 9));
    for (const s of G.STRAT_IDS) {
      const steps = G.intervalTrace(ivs, s);
      checkSteps(steps);
      const last = steps[steps.length - 1];
      const kept = Object.keys(last.tl.states).filter(id => last.tl.states[id] === 'done');
      assert.deepEqual(kept.sort(), G.pick(ivs, s).slice().sort());
      assert.equal(last.counters.kept, kept.length);
      assert.equal(last.counters.checked, ivs.length);
      for (const st of steps) {
        assert.deepEqual(Object.keys(st.counters), ['kept', 'checked']);
        assert.equal(st.tl.order.length, ivs.length);
        const done = Object.keys(st.tl.states).filter(id => st.tl.states[id] === 'done');
        assert.ok(compatible(done, ivs));
        assert.equal(st.tl.busy.length, done.length);
        if (st.kind === 'skip') assert.ok(st.tl.clash.length > 0);
      }
      assert.equal(last.tl.ghosts.length > 0, G.pick(ivs, s).length < bruteMax(ivs));
      // walk order equals the sorted order
      const looked = steps.filter(x => x.kind === 'look').map(x => x.cand);
      assert.deepEqual(looked, G.order(ivs, s).map(x => x.id));
    }
  }
});
test('exchangeTrace: every state is a valid optimal schedule and ends at greedy', () => {
  const rng = VDSA.rng(77);
  let checked = 0;
  for (let t = 0; t < 150; t++) {
    const ivs = randIvs(rng, rng.int(3, 8));
    const sets = G.optimalSets(ivs);
    const opt = sets[rng.int(0, sets.length - 1)];
    const steps = G.exchangeTrace(ivs, opt);
    checkSteps(steps);
    const m = opt.length;
    for (const st of steps) { assert.equal(st.ex.o.length, m); assert.equal(st.valid, true); }
    const last = steps[steps.length - 1];
    assert.deepEqual(last.ex.o, last.ex.g);
    assert.equal(last.ex.g.length, m);
    checked++;
  }
  assert.ok(checked > 0);
  const inst = G.parseIntervals('0-5, 1-4, 3-9, 5-10, 8-14, 11-15, 9-13, 14-20').intervals;
  const st = G.exchangeTrace(inst, ['C', 'G', 'H']);
  assert.equal(st.filter(x => x.kind === 'swap').length, 3);
});

/* ------------------------------------------------------------------ coins */
test('optimalCoins matches a memoised reference; greedy never beats it', () => {
  const rng = VDSA.rng(9);
  for (let t = 0; t < 200; t++) {
    const k = rng.int(2, 5), set = new Set([1]);
    while (set.size < k) set.add(rng.int(2, 30));
    const coins = [...set].sort((a, b) => a - b), amount = rng.int(0, 80);
    const o = G.optimalCoins(coins, amount), g = G.greedyCoins(coins, amount);
    assert.equal(o.length, refCoins(coins, amount));
    assert.equal(o.reduce((a, b) => a + b, 0), amount);
    assert.equal(g.picks.reduce((a, b) => a + b, 0), amount);
    assert.ok(g.picks.length >= o.length);
  }
});
test('coin change: US coins are safe, {1,3,4} fails at 6', () => {
  assert.deepEqual(G.greedyCoins([1, 5, 10, 25], 30).picks, [25, 5]);
  assert.deepEqual(G.optimalCoins([1, 5, 10, 25], 30), [25, 5]);
  assert.deepEqual(G.greedyCoins([1, 3, 4], 6).picks, [4, 1, 1]);
  assert.deepEqual(G.optimalCoins([1, 3, 4], 6), [3, 3]);
  assert.equal(G.firstCoinFailure([1, 5, 10, 25]).amount, null);
  assert.equal(G.firstCoinFailure([1, 3, 4]).amount, 6);
  assert.deepEqual(G.greedyCoins([1, 2], 0).picks, []);
});
test('firstCoinFailure (Kozen–Zaks bound) agrees with an exhaustive scan', () => {
  const rng = VDSA.rng(21);
  for (let t = 0; t < 150; t++) {
    const k = rng.int(2, 5), set = new Set([1]);
    while (set.size < k) set.add(rng.int(2, 40));
    const coins = [...set].sort((a, b) => a - b);
    let first = null;
    for (let a = 1; a <= 300 && first === null; a++) if (G.greedyCoins(coins, a).picks.length > refCoins(coins, a)) first = a;
    assert.equal(G.firstCoinFailure(coins).amount, first, coins.join());
  }
});
test('coinTrace ends with the right verdict and counts', () => {
  const bad = G.coinTrace([1, 3, 4], 6), good = G.coinTrace([1, 5, 10, 25], 30);
  checkSteps(bad); checkSteps(good);
  assert.equal(bad[bad.length - 1].verdict.ok, false);
  assert.equal(good[good.length - 1].verdict.ok, true);
  assert.deepEqual(bad[bad.length - 1].greedy.picks, [4, 1, 1]);
  assert.deepEqual(bad[bad.length - 1].best.picks, [3, 3]);
  assert.equal(G.coinTrace([1, 2], 0).length >= 3, true);
});
test('parseCoins validates', () => {
  assert.ok(G.parseCoins('3').error); assert.ok(G.parseCoins('2, 3').error); assert.ok(G.parseCoins('1, 1, 3').error);
  assert.ok(G.parseCoins('1, x').error); assert.ok(G.parseCoins('1,2,3,4,5,6,7').error);
  assert.deepEqual(G.parseCoins('4, 1, 3').coins, [1, 3, 4]);
});

/* ------------------------------------------------------------------ knapsack */
function bruteKnap(items, cap) {
  let best = 0;
  for (let m = 0; m < (1 << items.length); m++) { let w = 0, v = 0; items.forEach((it, i) => { if (m & (1 << i)) { w += it.w; v += it.v; } }); if (w <= cap) best = Math.max(best, v); }
  return best;
}
test('knapsack: fractional >= optimal 0/1 >= greedy 0/1; DP equals brute force', () => {
  const rng = VDSA.rng(3);
  for (let t = 0; t < 300; t++) {
    const items = G.makeItems(Array.from({ length: rng.int(2, 6) }, () => [rng.int(1, 30), rng.int(1, 100)]));
    const cap = rng.int(1, 60);
    const f = G.fractionalKnap(items, cap), g = G.greedyKnap01(items, cap), o = G.optimalKnap01(items, cap);
    assert.equal(o.value, bruteKnap(items, cap));
    assert.ok(f.value + 1e-9 >= o.value);
    assert.ok(o.value >= g.value);
    assert.ok(f.used <= cap + 1e-9);
    const packed = o.taken.reduce((a, id) => a + items.find(i => i.id === id).w, 0);
    assert.ok(packed <= cap);
  }
});
test('knapsack classic: 10:60 20:100 30:120, capacity 50', () => {
  const items = G.parseItems('10:60, 20:100, 30:120').items;
  assert.equal(G.fractionalKnap(items, 50).value, 240);
  assert.equal(G.greedyKnap01(items, 50).value, 160);
  assert.equal(G.optimalKnap01(items, 50).value, 220);
  const steps = G.knapTrace(items, 50);
  checkSteps(steps);
  const last = steps[steps.length - 1];
  assert.equal(last.frac.value, 240); assert.equal(last.g01.value, 160); assert.equal(last.best.value, 220);
  assert.equal(last.frac.blocks[2].frac.toFixed(3), (20 / 30).toFixed(3));
  assert.equal(last.g01.status.C, 'skip');
});
test('knapsack edge cases and parsing', () => {
  const items = G.parseItems('60:10, 50:20').items;
  assert.equal(G.greedyKnap01(items, 5).value, 0);
  assert.ok(G.fractionalKnap(items, 5).value > 0);
  assert.ok(G.parseItems('10').error); assert.ok(G.parseItems('a:b, 1:2').error);
  assert.ok(G.parseItems('1:1,2:2,3:3,4:4,5:5,6:6').error);
  checkSteps(G.knapTrace(G.parseItems('5:5, 5:5').items, 3));
});

/* ------------------------------------------------------------------ Huffman */
function exhaustiveCost(ws) { // min total internal weight over every merge order
  if (ws.length === 1) return 0;
  let best = Infinity;
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
    const rest = ws.filter((_, k) => k !== i && k !== j); rest.push(ws[i] + ws[j]);
    best = Math.min(best, ws[i] + ws[j] + exhaustiveCost(rest));
  }
  return best;
}
function randText(rng, n, k) { const al = 'abcdefghijkl '.slice(0, k); return Array.from({ length: n }, () => al[Math.min(k - 1, Math.floor(rng() ** 2 * k))]).join(''); }
test('Huffman codes are prefix-free, decode back, and are optimal', () => {
  const rng = VDSA.rng(101);
  for (let t = 0; t < 200; t++) {
    const k = rng.int(2, 6), text = randText(rng, rng.int(2, 30), k);
    const codes = G.huffmanCodes(text), syms = Object.keys(codes);
    for (const a of syms) for (const b of syms) if (a !== b) assert.ok(!codes[b].startsWith(codes[a]), 'prefix');
    if (syms.length > 1) assert.equal(syms.reduce((s, c) => s + 2 ** -codes[c].length, 0), 1);
    const bits = text.split('').map(c => codes[c]).join('');
    const inv = Object.fromEntries(syms.map(c => [codes[c], c]));
    let out = '', cur = '';
    for (const b of bits) { cur += b; if (inv[cur]) { out += inv[cur]; cur = ''; } }
    assert.equal(out, text); assert.equal(cur, '');
    if (syms.length > 1) assert.equal(G.huffmanCost(text), exhaustiveCost(G.freqTable(text).map(x => x.f)));
  }
});
test('Huffman classic examples', () => {
  const abr = G.huffmanCodes('abracadabra');
  assert.equal(abr.a.length, 1);
  assert.equal(G.huffmanCost('abracadabra'), 23);
  assert.deepEqual(G.huffmanCodes('aaaa'), { a: '0' });
  assert.equal(G.huffmanCost('aaaa'), 4);
  const bpc = G.bitsPerChar('abracadabra');
  assert.equal(bpc.fixed, 3);
  assert.ok(bpc.entropy <= bpc.huffman + 1e-9 && bpc.huffman < bpc.entropy + 1);
});
test('huffmanTrace: snapshots are complete and consistent', () => {
  const rng = VDSA.rng(55);
  for (const text of ['a', 'ab', 'abracadabra', 'hello world', 'aaaaaaaabc', ...Array.from({ length: 40 }, () => randText(rng, rng.int(1, 40), rng.int(1, 8)))]) {
    const steps = G.huffmanTrace(text);
    checkSteps(steps);
    const k = G.freqTable(text).length, last = steps[steps.length - 1];
    assert.equal(last.kind, 'encode');
    assert.equal(last.hf.enc.huff, G.huffmanCost(text));
    assert.deepEqual(last.hf.codes, G.huffmanCodes(text));
    assert.equal(steps.filter(s => s.kind === 'merge').length, k - 1);
    for (const st of steps) {
      assert.deepEqual(Object.keys(st.counters), ['merges', 'trees']);
      const ids = new Set(st.hf.nodes.map(n => n.id));
      st.hf.queue.forEach(id => assert.ok(ids.has(id)));
      st.hf.nodes.forEach(n => { if (n.left) { assert.ok(ids.has(n.left) && ids.has(n.right)); } });
      const ws = st.hf.queue.map(id => st.hf.nodes.find(n => n.id === id).w);
      assert.deepEqual(ws, ws.slice().sort((a, b) => a - b));
      assert.equal(ws.reduce((a, b) => a + b, 0), text.length);
    }
  }
});
test('parseText validates', () => {
  assert.ok(G.parseText('').error);
  assert.ok(G.parseText('x'.repeat(81)).error);
  assert.ok(G.parseText('abcdefghijklm').error);
  assert.equal(G.parseText('hello').error, null);
});
test('bitsPerChar: Huffman never exceeds fixed width and never beats entropy', () => {
  for (const t of ['abracadabra', 'mississippi', 'hello world', 'the quick brown fox jumps over the lazy dog', 'aaaaaaaabc']) {
    const b = G.bitsPerChar(t);
    assert.ok(b.huffman <= b.fixed + 1e-9, t);
    assert.ok(b.huffman + 1e-9 >= b.entropy, t);
  }
});

/* ------------------------------------------------------------------ job scheduling */
function bruteJobs(jobs) {
  let best = 0;
  for (let m = 0; m < (1 << jobs.length); m++) {
    const sel = jobs.filter((_, i) => m & (1 << i)).sort((a, b) => a.d - b.d);
    if (sel.every((j, i) => j.d >= i + 1)) best = Math.max(best, sel.reduce((s, j) => s + j.p, 0));
  }
  return best;
}
test('job scheduling greedy equals brute force', () => {
  const rng = VDSA.rng(8);
  for (let t = 0; t < 300; t++) {
    const jobs = Array.from({ length: rng.int(2, 8) }, (_, i) => ({ id: 'ABCDEFGH'[i], d: rng.int(1, 6), p: rng.int(1, 99) }));
    const steps = G.jobTrace(jobs), last = steps[steps.length - 1];
    checkSteps(steps);
    assert.equal(last.counters.profit, bruteJobs(jobs));
    for (const st of steps) assert.deepEqual(Object.keys(st.counters), ['profit', 'placed']);
    last.slots.forEach((id, i) => { if (id) assert.ok(jobs.find(j => j.id === id).d >= i + 1); });
  }
});
test('parseJobs validates', () => {
  assert.ok(G.parseJobs('2:5').error); assert.ok(G.parseJobs('9:5, 1:1').error); assert.ok(G.parseJobs('x, y').error);
  assert.equal(G.parseJobs('2:100, 1:19').error, null);
});

/* ------------------------------------------------------------------ hill climbing */
test('hill climbing: summit on the single hill, stuck on the two-hill terrain', () => {
  const one = G.hillTrace(G.TERRAINS.one, 2);
  assert.equal(one[one.length - 1].summit, true);
  const two = G.hillTrace(G.TERRAINS.two, 2);
  assert.equal(two[two.length - 1].summit, false);
  const two2 = G.hillTrace(G.TERRAINS.two, 20);
  assert.equal(two2[two2.length - 1].summit, true);
  const flat = G.hillTrace([5, 5, 5], 1);
  assert.equal(flat.length, 2);
  for (const st of two) assert.ok(st.pos >= 0 && st.pos < G.TERRAINS.two.length);
});
test('growth', () => { assert.equal(G.growth(10).subsets, 1024); assert.ok(G.growth(10).greedy < 40); });
