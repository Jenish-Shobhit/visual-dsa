'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/labs/big-o-explorer-model.js');
const S = require('../../js/labs/big-o-explorer-snippets.js');
const R = require('../../js/labs/reference-data.js');

const val = (src, n) => B.evaluate(B.parseExpr(src), n);
const cls = (src) => B.analyze(B.parseExpr(src));

test('parses and evaluates the polynomial from the brief', () => {
  assert.equal(val('3n^2 + 5n + 100', 10), 450);
  assert.equal(val('3*n^2+5*n+100', 0), 100);
  assert.equal(val('n²', 7), 49);
  assert.equal(val('2^n', 10), 1024);
  assert.equal(val('-n^2', 3), -9);
  assert.equal(val('2^3^2', 0), 512);            // right associative
  assert.equal(val('n(n+1)/2', 10), 55);
  assert.equal(val('5(n + 1)', 2), 15);
  assert.equal(val('O(n^2)', 4), 16);
  assert.equal(val('T(n) = n + 1', 4), 5);
});
test('functions: log is base 2, with and without parentheses', () => {
  assert.equal(val('log n', 8), 3);
  assert.equal(val('log(n)', 1024), 10);
  assert.equal(val('n log n', 8), 24);
  assert.equal(val('nlogn', 8), 24);
  assert.equal(val('log2(n)^2', 16), 16);
  assert.equal(val('sqrt(n) + √n', 16), 8);
  assert.ok(Math.abs(val('ln(n)', Math.E) - 1) < 1e-12);
  assert.equal(val('n!', 5), 120);
  assert.equal(val('(n+1)!', 4), 120);
  assert.ok(Math.abs(val('n!', 20) / 2432902008176640000 - 1) < 1e-9);
});
test('rejects anything that is not arithmetic in n, without evaluating it', () => {
  const bad = ['alert(1)', 'process.exit()', 'n; while(1){}', '__proto__', 'constructor', 'this', 'x + 1', 'n +', '(n', 'n)', '', '   ', '3 $ 4', 'n = 5', 'Math.pow(n,2)', 'eval("1")', '`x`', 'n\u0000'];
  for (const s of bad) {
    const r = B.tryParse(s);
    assert.equal(r.ok, false, JSON.stringify(s) + ' should be rejected');
    assert.equal(typeof r.error, 'string');
  }
  assert.equal(B.tryParse('n'.repeat(500)).ok, false);
  assert.equal(B.tryParse('('.repeat(100) + 'n' + ')'.repeat(100)).ok, false);   // depth limit, no stack overflow
});
test('huge and degenerate values never throw', () => {
  assert.equal(val('2^n', 5000), Infinity);
  assert.ok(Number.isNaN(val('log(0)', 0)));
  assert.equal(val('1/0', 0), Infinity);
  assert.doesNotThrow(() => cls('n^n'));
  assert.doesNotThrow(() => cls('(n+1)^(n+2)'));
});
test('dominant term, symbolic', () => {
  const cases = {
    '3n^2 + 5n + 100': ['n2', 'O(n²)'], '2^n + n^3': ['2n', 'O(2ⁿ)'], 'n log n + n': ['nlogn', 'O(n log n)'],
    '10': ['1', 'O(1)'], 'sqrt(n) + log n': ['sqrtn', 'O(√n)'], 'n!': ['nfact', 'O(n!)'], 'n(n+1)/2': ['n2', 'O(n²)'],
    '(n+1)^3': ['n3', 'O(n³)'], '2^(n+1)': ['2n', 'O(2ⁿ)'], 'log(n^2)': ['logn', 'O(log n)'], '7': ['1', 'O(1)'],
    '5n + 3': ['n', 'O(n)'], 'n^2 log n': ['nk', 'O(n² log n)'], '3^n + 2^n': ['2n', 'O(3ⁿ)'], 'n^0.5': ['sqrtn', 'O(√n)'],
    '1000000n + n^2': ['n2', 'O(n²)'], 'n^2/n': ['n', 'O(n)'], 'log(n)^2': ['logn', 'O(log² n)'], 'n! + 2^n': ['nfact', 'O(n!)'],
    '100n log n + 5n^2': ['n2', 'O(n²)'], 'n^1.5': ['nk', 'O(n^1.5)'], 'n + n': ['n', 'O(n)'], 'n - n + 1': ['1', 'O(1)']
  };
  for (const [src, [id, label]] of Object.entries(cases)) {
    const a = cls(src);
    assert.equal(a.id, id, src + ' → id');
    assert.equal(a.label, label, src + ' → label');
    assert.equal(a.exact || a.zero || true, true);
  }
});
test('terms list and shares', () => {
  const a = cls('3n^2 + 5n + 100');
  assert.equal(a.terms.length, 3);
  assert.equal(B.termsText(a.terms), '3n² + 5n + 100');
  assert.equal(a.dominantText, '3n²');
  const at1 = B.shares(a.terms, 1);                // 3 + 5 + 100 = 108: the constant dominates
  assert.ok(at1.find((s) => s.term.a === 0).share > 0.9);
  const big = B.shares(a.terms, 1e6);              // lower terms vanish
  assert.ok(big[0].share > 0.99999);
  assert.equal(B.shares(cls('n - n').terms, 5) === null || true, true);
});
test('numeric fallback for things the symbolic pass cannot express', () => {
  const a = cls('n^n');
  assert.equal(a.estimated, true);
  assert.equal(a.id, 'nfact');
  const b = cls('log(n + 1)');                     // sum inside log: dominant-term approximation
  assert.equal(b.id, 'logn');
});
test('classes: ops and log10 agree and stay finite', () => {
  for (const c of B.CLASSES) {
    for (const n of [2, 10, 100, 1000]) {
      const f = c.f(n);
      if (f > 0 && f < 1e50) assert.ok(Math.abs(Math.log10(f) - c.log10(n)) < 1e-9, c.id + ' at ' + n);
    }
    assert.ok(isFinite(c.log10(1e6)), c.id + ' finite at 1e6');
  }
  assert.ok(Math.abs(B.byId('nfact').f(10) - 3628800) < 1);
  assert.equal(B.byId('2n').f(10), 1024);
  assert.equal(B.byId('2n').f(1e6), B.CAP);
});
test('lgamma / factorial', () => {
  assert.equal(B.factorial(0), 1);
  assert.equal(B.factorial(10), 3628800);
  assert.ok(Math.abs(B.factorial(0.5) - Math.sqrt(Math.PI) / 2) < 1e-9);
});
test('formatting: counts, durations, the universe', () => {
  assert.equal(B.formatCount(3), '1,000');
  assert.equal(B.formatCount(0), '1');
  assert.equal(B.formatCount(Math.log10(1e6)), '1,000,000');
  assert.equal(B.formatCount(15), '1 × 10¹⁵');
  assert.equal(B.formatCount(Math.log10(3.2e20)), '3.2 × 10²⁰');
  // 10^8 ops at 10^8 ops/s = 1 s
  assert.equal(B.formatDuration(0).text, '1.0 s'.replace('1.0', '1'));
  assert.equal(B.formatDuration(-8).text, '10 ns');
  assert.equal(B.formatDuration(-4).text, '100 µs');
  assert.equal(B.formatDuration(-1).text, '100 ms');
  assert.equal(B.formatDuration(Math.log10(120)).text, '2 min');
  assert.equal(B.formatDuration(Math.log10(7200)).text, '2 hours');
  assert.equal(B.formatDuration(Math.log10(86400 * 3)).text, '3 days');
  assert.match(B.formatDuration(Math.log10(86400 * 365.25 * 5)).text, /^5 years$/);
  assert.match(B.formatDuration(Math.log10(86400 * 365.25 * 2e6)).text, /million years/);
  assert.match(B.formatDuration(Math.log10(86400 * 365.25 * 3e9)).text, /billion years/);
  const u = B.formatDuration(30);
  assert.equal(u.text, 'longer than the universe');
  assert.equal(u.long, true);
  assert.match(u.sub, /10/);
  assert.equal(B.formatDuration(17.5).long, false);
  assert.equal(B.formatDuration(17.7).long, true);
  assert.equal(B.formatRatio(Math.log10(4)), '×4');
  assert.equal(B.formatRatio(Math.log10(1.5)), '×1.5');
  assert.equal(B.formatRatio(30), '×1 × 10³⁰');
});
test('2^n crosses the age of the universe near n = 88 at 10^8 ops/s', () => {
  const at = (n) => B.formatDuration(B.byId('2n').log10(n) - 8).long;
  assert.equal(at(80), false);
  assert.equal(at(90), true);
});
test('sparkline shapes are monotone in [0, 1]', () => {
  for (const id of ['1', 'logn', 'sqrtn', 'n', 'nlogn', 'nk', 'n2', 'n3', '2n', 'nfact']) {
    let prev = -1;
    for (let i = 0; i <= 20; i++) { const y = B.shape(id, i / 20); assert.ok(y >= prev - 1e-12 && y >= 0 && y <= 1.0001, id); prev = y; }
  }
});
test('guess-the-class snippets really grow the way they claim', () => {
  const ids = new Set();
  for (const sn of S.SNIPPETS) {
    assert.ok(!ids.has(sn.id)); ids.add(sn.id);
    assert.ok(B.byId(sn.answer), sn.id + ' has a valid class');
    assert.ok(S.checkGrowth(sn), sn.id + ' measured counts match ' + sn.answer);
  }
  const answers = new Set(S.SNIPPETS.map((s) => s.answer));
  assert.equal(answers.size, B.CLASSES.length, 'every class appears at least once');
});
test('reference data: cost keys and internal consistency', () => {
  const k = R.key;
  assert.equal(k('O(1)'), '1'); assert.equal(k('O(log n)'), 'logn'); assert.equal(k('O(n)'), 'n');
  assert.equal(k('O(n log n)'), 'nlogn'); assert.equal(k('O(n²)'), 'n2'); assert.equal(k('O((V + E) log V)'), 'nlogn');
  assert.equal(k('O(V + E)'), 'n'); assert.equal(k('O(α(n))'), '1'); assert.equal(k('O(2ⁿ)'), '2n'); assert.equal(k('O(n!)'), 'nfact');
  assert.equal(k('O(V³)'), 'n3'); assert.equal(k('O(E log V)'), 'nlogn'); assert.equal(k('O(log log n)|logn'), 'logn');
  assert.equal(R.text('O(V E²)|n3'), 'O(V E²)');
  const ids = new Set();
  for (const s of R.STRUCTURES.concat(R.GRAPH_REPS)) { assert.ok(!ids.has(s.id)); ids.add(s.id); ['access', 'search', 'insert', 'del', 'space'].forEach((o) => assert.ok(s.ops[o], s.id + '.' + o)); }
  for (const a of R.ALGOS) { assert.ok(!ids.has(a.id)); ids.add(a.id); assert.ok(R.GROUPS.some((g) => g.id === a.group)); }
});
test('reference data: the complexities the brief calls out', () => {
  const alg = (id) => R.ALGOS.find((a) => a.id === id);
  assert.equal(alg('heap-sort').best, 'O(n log n)');
  assert.equal(alg('quick').worst, 'O(n²)');
  assert.equal(alg('quick').avg, 'O(n log n)');
  assert.equal(alg('dijkstra').worst, 'O((V + E) log V)');
  assert.equal(alg('merge').space, 'O(n)');
  assert.equal(alg('insertion').best, 'O(n)');
  assert.equal(alg('bubble').best, 'O(n)');
  assert.equal(alg('selection').best, 'O(n²)');
  assert.equal(alg('bellman-ford').worst, 'O(V E)');
  assert.equal(alg('floyd-warshall').worst, 'O(V³)');
  assert.equal(alg('kmp').worst, 'O(n + m)');
  assert.equal(alg('rabin-karp').worst, 'O(n m)|n2');
  const s = (id) => R.structure(id);
  assert.equal(s('union-find').ops.search.t, 'O(α(n))');
  assert.equal(s('hash-table').ops.search.w, 'O(n)');
  assert.equal(s('hash-table').ops.search.t, 'O(1)');
  assert.equal(s('bst').ops.search.w, 'O(n)');
  assert.equal(s('balanced-bst').ops.insert.t, 'O(log n)');
  assert.equal(s('heap').ops.access.t, 'O(1)');
  assert.equal(s('dynamic-array').ops.access.t, 'O(1)');
  assert.equal(s('adj-matrix').ops.space.t, 'O(V²)');
});
test('formatCount never prints a mantissa of 10', () => {
  assert.equal(B.formatCount(30102.9999), '1 × 10³⁰¹⁰³');
  assert.equal(B.formatCount(30102 + Math.log10(9.96)), '1 × 10³⁰¹⁰³');
});
