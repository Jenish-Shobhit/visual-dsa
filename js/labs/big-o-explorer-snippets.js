/* Big-O explorer: "guess the class" snippets. Each one has real, instrumented code (`run(n)` returns the number of
   basic steps the shown code performs), so the reveal after a guess shows measured counts, not claims.
   UMD: window.VDSA_SNIPPETS and module.exports; checked in tests/labs/big-o-explorer.test.js. */
(function (root) {
  'use strict';

  function S(id, answer, code, why, ns, run, unit) { return { id: id, answer: answer, code: code, why: why, ns: ns, run: run, unit: unit || 'doubling' }; }

  var SNIPPETS = [
    S('first-last', '1',
      'function ends(a) {\n  return a[0] + a[a.length - 1];\n}',
      'Two reads, whatever the length. The work does not depend on n at all.',
      [8, 16, 32, 64], function () { return 2; }),
    S('sum', 'n',
      'let sum = 0;\nfor (let i = 0; i < n; i++) {\n  sum += a[i];\n}',
      'One pass over n items: n additions.',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 0; i < n; i++) c++; return c; }),
    S('pairs', 'n2',
      'for (let i = 0; i < n; i++) {\n  for (let j = 0; j < n; j++) {\n    pairs++;\n  }\n}',
      'n rounds of the inner loop, each doing n steps: n × n.',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) c++; return c; }),
    S('halving', 'logn',
      'let steps = 0;\nwhile (n > 1) {\n  n = Math.floor(n / 2);\n  steps++;\n}',
      'Each round halves n, so it takes log₂ n rounds to reach 1. Doubling n adds a single round.',
      [8, 16, 32, 64], function (n) { var c = 0; while (n > 1) { n = Math.floor(n / 2); c++; } return c; }),
    S('log-inner', 'nlogn',
      'for (let i = 0; i < n; i++) {\n  for (let j = 1; j < n; j *= 2) {\n    work++;\n  }\n}',
      'The outer loop runs n times; the inner loop doubles j, so it runs about log₂ n times: n log n.',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 1; j < n; j *= 2) c++; return c; }),
    S('triangle', 'n2',
      'for (let i = 0; i < n; i++) {\n  for (let j = 0; j < i; j++) {\n    work++;\n  }\n}',
      'The inner loop runs 0, 1, 2, … n − 1 times: n(n − 1)/2 steps. Half of n² is still quadratic: constants do not change the class.',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 0; j < i; j++) c++; return c; }),
    S('triple', 'n3',
      'for (let i = 0; i < n; i++)\n  for (let j = 0; j < n; j++)\n    for (let k = 0; k < n; k++)\n      work++;',
      'Three nested loops of n: n × n × n. Doubling n makes it 8 times slower.',
      [4, 8, 16, 32], function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) c++; return c; }),
    S('three-loops', 'n',
      'for (let i = 0; i < n; i++) a[i]++;\nfor (let i = 0; i < n; i++) b[i]++;\nfor (let i = 0; i < n; i++) c[i]++;',
      'Loops one after another add: n + n + n = 3n. The constant 3 vanishes, so it is linear.',
      [8, 16, 32, 64], function (n) { var c = 0, r; for (r = 0; r < 3; r++) for (var i = 0; i < n; i++) c++; return c; }),
    S('big-constant', 'n',
      'for (let i = 0; i < n; i++) {\n  for (let j = 0; j < 1000; j++) {\n    work++;\n  }\n}',
      'The inner loop always runs 1000 times, a constant, so the total is 1000 n. Big-O ignores the 1000 (though your users will not).',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 0; j < 1000; j++) c++; return c; }),
    S('geometric', 'n',
      'for (let i = 1; i < n; i *= 2) {\n  for (let j = 0; j < i; j++) {\n    work++;\n  }\n}',
      'A trap. The inner loop runs 1, 2, 4, 8, … times. That sum is less than 2n, not n log n: the last term is half of it all.',
      [8, 16, 32, 64], function (n) { var c = 0; for (var i = 1; i < n; i *= 2) for (var j = 0; j < i; j++) c++; return c; }),
    S('trial', 'sqrtn',
      'function isPrime(n) {\n  for (let i = 2; i * i <= n; i++) {\n    if (n % i === 0) return false;\n  }\n  return true;   // worst case: n is prime\n}',
      'The loop stops when i × i exceeds n, so i only goes up to √n. Testing a prime does the full √n divisions.',
      [1009, 4093, 16381, 65521], function (n) { var c = 0; for (var i = 2; i * i <= n; i++) { c++; if (n % i === 0) break; } return c; }, 'quadruple'),
    S('recurse-halves', 'nlogn',
      'function f(n) {\n  if (n <= 1) return;\n  f(n / 2);\n  f(n / 2);\n  for (let i = 0; i < n; i++) work++;\n}',
      'Two half-size calls plus a linear pass: T(n) = 2T(n/2) + n. Each of the log₂ n levels does n work: this is merge sort’s shape.',
      [8, 16, 32, 64], function (n) { function f(m) { if (m <= 1) return 0; return f(m / 2) + f(m / 2) + m; } return f(n); }),
    S('fib', '2n',
      'function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}',
      'Each call makes two more, and the depth is n. The number of calls grows by about 1.6 for every +1 in n: exponential.',
      [10, 11, 12, 13], function (n) { function fib(m) { return m < 2 ? 1 : 1 + fib(m - 1) + fib(m - 2); } return fib(n); }, 'plus one'),
    S('subsets', '2n',
      'for (let mask = 0; mask < (1 << n); mask++) {\n  // one subset per bit pattern\n  work++;\n}',
      'n items make 2ⁿ yes-or-no patterns. Every extra item doubles the count.',
      [3, 4, 5, 6], function (n) { var c = 0; for (var m = 0; m < (1 << n); m++) c++; return c; }, 'plus one'),
    S('perms', 'nfact',
      'function permute(items, used, cur) {\n  if (cur.length === items.length) { count++; return; }\n  for (let i = 0; i < items.length; i++) {\n    if (used[i]) continue;\n    used[i] = true; cur.push(items[i]);\n    permute(items, used, cur);\n    cur.pop(); used[i] = false;\n  }\n}',
      'n choices, then n − 1, then n − 2 …: n × (n − 1) × … × 1 = n! orderings. Adding one item multiplies the count by n + 1.',
      [3, 4, 5, 6], function (n) { var c = 0; (function p(used, len) { if (len === n) { c++; return; } for (var i = 0; i < n; i++) { if (used[i]) continue; used[i] = 1; p(used, len + 1); used[i] = 0; } }([], 0)); return c; }, 'plus one')
  ];

  /* Independent check that a snippet's measured counts really follow its declared class (used by the tests). */
  function checkGrowth(sn) {
    var c = sn.ns.map(function (n) { return sn.run(n); }), r = [], i;
    for (i = 1; i < c.length; i++) r.push(c[i] / c[i - 1]);
    var last = r[r.length - 1], nLast = sn.ns[sn.ns.length - 2];
    switch (sn.answer) {
      case '1': return c.every(function (x) { return x === c[0]; });
      case 'logn': return c.every(function (x, j) { return j === 0 || x - c[j - 1] === 1; });
      case 'sqrtn': return Math.abs(last - 2) < 0.1;
      case 'n': return Math.abs(last - 2) < 0.1;
      case 'nlogn': return last > 2.02 && last < 2.6;
      case 'n2': return last > 3.7 && last < 4.2;
      case 'n3': return last > 7.4 && last < 8.3;
      case '2n': return last > 1.5 && sn.ns[1] - sn.ns[0] === 1;
      case 'nfact': return Math.abs(last - (nLast + 1)) < 1e-9;
    }
    return false;
  }

  var api = { SNIPPETS: SNIPPETS, checkGrowth: checkGrowth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_SNIPPETS = api;
}(typeof window !== 'undefined' ? window : null));
