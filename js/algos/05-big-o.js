/* Lesson 05 · Complexity & Big-O — pure growth maths and step generators (no DOM).

   Browser: VDSA.algos.bigO    Node: module.exports (tests/algos/05-big-o.test.js)

   Contents
   - Growth classes: CLASSES, work(id, n), log10Work(id, n), feasibleN(id, budget), doubling(id, n),
     formatBig(log10), formatCount(v), secondsText(log10s)
   - Figures: raceSteps (linear vs binary search), linearSearchSteps + searchHistogram (cases),
     snippetOps (operation counter), appendSteps (amortized preview)
   - Lab: LAB (six algorithms: findMax, pairSum, binarySearch, bubbleSort, subsetSum, mergeSort), each with
     steps(values, target) -> snapshots for VDSA.views.array, and countOps(id, values, target)
   - Flowchart: FLOW (how to find the Big-O of code) and FLOW_TRACES (one path per snippet)

   Every step is a complete snapshot: {view, caption, line, vars, counters, ...}. Items keep ids for their
   whole life so the array view moves them instead of redrawing. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) { root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos.bigO = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LN10 = Math.LN10, LOG10_2 = Math.log10(2);
  function log2(x) { return Math.log(x) / Math.LN2; }

  /* ln(n!) — exact sum for small n, Stirling series beyond (error < 1e-10 for n > 64). */
  function lnFactorial(n) {
    if (n < 2) return 0;
    if (n <= 64) { var s = 0; for (var k = 2; k <= n; k++) s += Math.log(k); return s; }
    return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n) + 1 / (12 * n) - 1 / (360 * n * n * n);
  }
  function factorial(n) {
    if (n > 170) return Infinity;
    var f = 1; for (var k = 2; k <= n; k++) f *= k; return f;
  }

  /* ================================================================== growth classes
     id matches the .big-o[data-o] badge. `f` is the raw function (drawn on charts); `work` never drops below
     one operation (log 1 = 0, but a program still does something). `color` is the lesson's colour for the class. */
  var CLASSES = [
    { id: '1', label: '1', o: 'O(1)', name: 'constant', color: 'done', f: function () { return 1; } },
    { id: 'logn', label: 'log n', o: 'O(log n)', name: 'logarithmic', color: 'frontier', f: function (n) { return n > 0 ? log2(n) : 0; } },
    { id: 'n', label: 'n', o: 'O(n)', name: 'linear', color: 'active', f: function (n) { return n; } },
    { id: 'nlogn', label: 'n log n', o: 'O(n log n)', name: 'linearithmic', color: 'key', f: function (n) { return n > 0 ? n * log2(n) : 0; } },
    { id: 'n2', label: 'n²', o: 'O(n²)', name: 'quadratic', color: 'compare', f: function (n) { return n * n; } },
    { id: 'n3', label: 'n³', o: 'O(n³)', name: 'cubic', color: 'path', f: function (n) { return n * n * n; } },
    { id: '2n', label: '2ⁿ', o: 'O(2ⁿ)', name: 'exponential', color: 'swap', f: function (n) { return Math.pow(2, n); } },
    { id: 'nfact', label: 'n!', o: 'O(n!)', name: 'factorial', color: 'pivot', f: function (n) { return n <= 170 ? factorial(Math.round(n)) : Infinity; } }
  ];
  var BY_ID = {};
  CLASSES.forEach(function (c) { BY_ID[c.id] = c; });
  function cls(id) { var c = BY_ID[id]; if (!c) throw new Error('unknown growth class ' + id); return c; }

  /* log10 of the work done by class `id` on input size n (n >= 1). Exact in log space, so 2^1000 is fine. */
  function log10Work(id, n) {
    n = Math.max(1, n);
    var v;
    switch (id) {
      case '1': v = 0; break;
      case 'logn': v = Math.log10(log2(n)); break;
      case 'n': v = Math.log10(n); break;
      case 'nlogn': v = Math.log10(n) + Math.log10(log2(n)); break;
      case 'n2': v = 2 * Math.log10(n); break;
      case 'n3': v = 3 * Math.log10(n); break;
      case '2n': v = n * LOG10_2; break;
      case 'nfact': v = lnFactorial(Math.round(n)) / LN10; break;
      default: cls(id);
    }
    return isFinite(v) ? Math.max(0, v) : 0;
  }
  function work(id, n) { var l = log10Work(id, n); return l > 300 ? Infinity : Math.max(1, Math.pow(10, l)); }

  /* Largest whole n >= 1 whose work fits in `budget` operations.
     -> {n, log10n, unbounded}. n is Infinity when it cannot be written as a double (log n with a big budget);
     log10n still says how many digits it has. unbounded: constant time fits any n. n = 0 when even n = 1 does not fit. */
  function feasibleN(id, budget) {
    cls(id);
    if (!(budget >= 1)) return { n: 0, log10n: -Infinity, unbounded: false };
    if (id === '1') return { n: Infinity, log10n: Infinity, unbounded: true };
    if (work(id, 1) > budget) return { n: 0, log10n: -Infinity, unbounded: false };
    var n;
    if (id === 'logn') {
      var l = budget * LOG10_2;           // log2 n <= B  ->  n <= 2^B
      if (budget <= 1000) { n = Math.floor(Math.pow(2, budget) + 1e-9); return { n: n, log10n: Math.log10(n), unbounded: false }; }
      return { n: Infinity, log10n: l, unbounded: false };
    }
    if (id === 'n') n = Math.floor(budget);
    else if (id === 'n2') { n = Math.floor(Math.sqrt(budget)); while ((n + 1) * (n + 1) <= budget) n++; while (n * n > budget) n--; }
    else if (id === 'n3') { n = Math.floor(Math.cbrt(budget)); while ((n + 1) * (n + 1) * (n + 1) <= budget) n++; while (n * n * n > budget) n--; }
    else if (id === '2n') { n = Math.floor(log2(budget)); while (Math.pow(2, n + 1) <= budget) n++; while (Math.pow(2, n) > budget) n--; }
    else if (id === 'nfact') { n = 1; while (lnFactorial(n + 1) <= Math.log(budget) + 1e-12) n++; }
    else if (id === 'nlogn') {
      var lo = 1, hi = Math.floor(budget) + 1;          // work(1) = 1 <= budget < work(budget + 1)
      for (var it = 0; it < 200 && hi - lo > 1; it++) {
        var mid = Math.floor((lo + hi) / 2);
        if (Math.max(1, mid * log2(mid)) <= budget) lo = mid; else hi = mid;
      }
      n = lo;
    }
    n = Math.max(1, n);
    return { n: n, log10n: Math.log10(n), unbounded: false };
  }

  /* What happens to the work when n doubles: {ratioLog10, ratio, diff, text}.
     ratio = work(2n) / work(n) (Infinity when too big for a double); diff = work(2n) − work(n). */
  function doubling(id, n) {
    var a = log10Work(id, n), b = log10Work(id, 2 * n);
    var ratioLog10 = b - a;
    var ratio = ratioLog10 > 300 ? Infinity : Math.pow(10, ratioLog10);
    var wa = work(id, n), wb = work(id, 2 * n);
    var diff = isFinite(wa) && isFinite(wb) ? wb - wa : Infinity;
    var text;
    if (id === '1') text = '×1';
    else if (id === 'logn') text = '+' + trimNum(diff, 2) + ' step';
    else if (ratio < 1000) text = '×' + trimNum(ratio, ratio < 10 ? 2 : 0);
    else text = '×' + formatBig(ratioLog10);
    return { ratioLog10: ratioLog10, ratio: ratio, diff: diff, text: text };
  }

  /* ------------------------------------------------------------------ number formatting (pure) */
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sup(n) { return String(n).split('').map(function (c) { return SUP[c] || c; }).join(''); }
  function trimNum(v, d) { return String(parseFloat(Number(v).toFixed(d === undefined ? 2 : d))); }
  function withCommas(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* A number given as its log10: 999,999 · 1.05 million · 4.29 billion · 1.27 × 10³⁰ · 10³⁰¹⁰³⁰
     (above 10¹⁰⁰⁰ the mantissa is meaningless, so only the power is shown). */
  var BIG_NAMES = { 6: 'million', 9: 'billion', 12: 'trillion' };
  function formatBig(l) {
    if (l === Infinity) return '∞';
    if (!isFinite(l)) return '0';
    if (l < 6) return withCommas(Math.pow(10, l));
    var e = Math.floor(l + 1e-9), m = Math.pow(10, l - e);
    if (+m.toPrecision(3) >= 10) { m = 1; e += 1; }
    if (e >= 1000) return '10' + sup(Math.round(l));
    if (e < 15) { var base = e - e % 3; return String(+(m * Math.pow(10, e - base)).toPrecision(3)) + ' ' + BIG_NAMES[base]; }
    var ms = String(+m.toPrecision(3));
    return (ms === '1' ? '' : ms + ' × ') + '10' + sup(e);
  }
  function formatCount(v) {
    if (v === Infinity) return '∞';
    if (v < 1e6) return v === Math.round(v) ? withCommas(v) : trimNum(v, v < 10 ? 2 : 1);
    return formatBig(Math.log10(v));
  }
  /* Seconds (given as log10) as friendly text: 12 ns · 3.4 ms · 1.5 s · 2.8 hours · 31,710 years · 10²² years */
  var YEAR = 31557600;
  function secondsText(l) {
    if (!isFinite(l)) return l > 0 ? 'forever' : 'no time';
    var s = Math.pow(10, l);
    if (l < -6) return trimNum(s * 1e9, s * 1e9 < 10 ? 1 : 0) + ' ns';
    if (l < -3) return trimNum(s * 1e6, s * 1e6 < 10 ? 1 : 0) + ' µs';
    if (l < 0) return trimNum(s * 1e3, s * 1e3 < 10 ? 1 : 0) + ' ms';
    if (s < 60) return trimNum(s, s < 10 ? 1 : 0) + ' s';
    if (s < 3600) return trimNum(s / 60, s < 600 ? 1 : 0) + ' min';
    if (s < 86400) return trimNum(s / 3600, s < 36000 ? 1 : 0) + ' hours';
    if (s < YEAR) return trimNum(s / 86400, s < 864000 ? 1 : 0) + ' days';
    var ly = l - Math.log10(YEAR);
    if (ly < 6) return withCommas(Math.pow(10, ly)) + ' years';
    return formatBig(ly) + ' years';
  }

  /* ================================================================== problem: linear scan vs binary search
     raceSteps(sortedValues, target): both searches make one comparison per tick, side by side.
     Step: {tick, lin: {i, state: 'run'|'found'|'absent'}, bin: {lo, hi, mid, state}, counters: {linear, binary}, caption} */
  function raceSteps(values, target) {
    var a = values.slice(), n = a.length, steps = [];
    var lin = { i: -1, state: 'run' }, bin = { lo: 0, hi: n - 1, mid: -1, state: 'run' };
    var cl = 0, cb = 0, tick = 0;
    function snap(caption) {
      steps.push({ tick: tick, values: a, target: target,
        lin: { i: lin.i, state: lin.state }, bin: { lo: bin.lo, hi: bin.hi, mid: bin.mid, state: bin.state },
        counters: { linear: cl, binary: cb }, caption: caption });
    }
    if (!n) { lin.state = bin.state = 'absent'; snap('The list is empty: both searches stop at once with zero comparisons.'); return steps; }
    snap('Both searches look for <b>' + target + '</b> among ' + n + ' sorted numbers. Each tick, each one makes <b>one comparison</b>.');
    var guard = 0;
    while ((lin.state === 'run' || bin.state === 'run') && guard++ < 4 * n + 10) {
      tick++;
      var parts = [];
      if (lin.state === 'run') {
        lin.i++; cl++;
        if (a[lin.i] === target) { lin.state = 'found'; parts.push('Linear scan finds it at index ' + lin.i + ' after ' + cl + ' comparison' + (cl === 1 ? '' : 's') + '.'); }
        else if (lin.i === n - 1) { lin.state = 'absent'; parts.push('Linear scan checked all ' + n + ' values: not there.'); }
        else parts.push('Linear scan: a[' + lin.i + '] = ' + a[lin.i] + ' is not it, so step right.');
      }
      if (bin.state === 'run') {
        bin.mid = Math.floor((bin.lo + bin.hi) / 2); cb++;
        var v = a[bin.mid];
        if (v === target) { bin.state = 'found'; parts.push('Binary search hits it at index ' + bin.mid + ' on probe ' + cb + '.'); }
        else {
          if (v < target) { bin.lo = bin.mid + 1; parts.push('Binary: middle value ' + v + ' &lt; ' + target + ', so the whole left half is thrown away.'); }
          else { bin.hi = bin.mid - 1; parts.push('Binary: middle value ' + v + ' &gt; ' + target + ', so the whole right half is thrown away.'); }
          if (bin.lo > bin.hi) { bin.state = 'absent'; bin.mid = -1; parts.push('The window is empty after ' + cb + ' probes: not there.'); }
        }
      } else parts.push('Binary search already finished, with ' + cb + ' comparison' + (cb === 1 ? '' : 's') + '.');
      snap(parts.join(' '));
    }
    var last = steps[steps.length - 1];
    last.caption += ' <b>Final count: ' + cl + ' vs ' + cb + '.</b>';
    return steps;
  }

  /* ================================================================== cases: linear search
     linearSearchSteps(values, target) -> steps with {view, counters: {comparisons}, result: index|-1} */
  function linearSearchSteps(values, target) {
    var a = values.slice(), n = a.length, steps = [], cmp = 0;
    function view(i, phase) {
      return {
        items: a.map(function (v, k) {
          var st = 'default';
          if (phase === 'found' && k === i) st = 'found';
          else if (k === i && phase === 'cmp') st = 'compare';
          else if (k < i || (phase === 'absent')) st = 'visited';
          return { id: 'ls' + k, value: v, state: st };
        }),
        pointers: i >= 0 && i < n && phase !== 'absent' ? [{ name: 'i', index: i, state: phase === 'found' ? 'found' : 'compare' }] : []
      };
    }
    function snap(i, phase, caption, result) { steps.push({ view: view(i, phase), counters: { comparisons: cmp }, caption: caption, phase: phase, i: i, result: result }); }
    if (!n) { snap(-1, 'absent', 'The list is empty: nothing to compare, so the answer is "not found" after 0 comparisons.', -1); return steps; }
    snap(-1, 'start', 'Look for <b>' + target + '</b> by checking values from the left, one at a time.', null);
    for (var i = 0; i < n; i++) {
      cmp++;
      if (a[i] === target) { snap(i, 'found', 'a[' + i + '] = ' + target + ': found after <b>' + cmp + '</b> comparison' + (cmp === 1 ? '' : 's') + '.', i); return steps; }
      snap(i, 'cmp', 'a[' + i + '] = ' + a[i] + ' is not ' + target + '. Keep going.', null);
    }
    snap(n, 'absent', target + ' is not in the list. Proving that took all <b>' + cmp + '</b> comparisons: every value had to be ruled out.', -1);
    return steps;
  }
  /* Comparisons for every possible target position, plus "absent". */
  function searchHistogram(n) {
    var out = [];
    for (var k = 0; k < n; k++) out.push({ key: 'p' + k, label: 'a[' + k + ']', comparisons: k + 1 });
    out.push({ key: 'absent', label: 'absent', comparisons: n });
    return out;
  }

  /* ================================================================== operation counter snippets */
  var SNIPPETS = {
    constant: { o: '1', count: function () { return 1; } },
    linear: { o: 'n', count: function (n) { var c = 0; for (var i = 0; i < n; i++) c++; return c; } },
    halving: { o: 'logn', count: function (n) { var c = 0; for (var i = n; i > 1; i = Math.floor(i / 2)) c++; return c; } },
    nested: { o: 'n2', count: function (n) { var c = 0; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) c++; return c; } }
  };
  function snippetOps(kind, n) { return SNIPPETS[kind].count(n); }
  /* The sequence of window sizes the halving loop sees: n, ⌊n/2⌋, … while > 1. */
  function halvingTrail(n) { var out = []; for (var i = n; i > 1; i = Math.floor(i / 2)) out.push(i); return out; }

  /* ================================================================== amortized preview: doubling array
     appendSteps(m): append m values to an array that starts with capacity 1 and doubles when full.
     Step k (1-based): {k, size, cap, copies (this append), cost (= copies + 1), total, avg, resized} */
  function appendSteps(m) {
    var steps = [], size = 0, cap = 1, total = 0, copiesTotal = 0;
    steps.push({ k: 0, size: 0, cap: 1, copies: 0, cost: 0, total: 0, avg: 0, resized: false, costs: [],
      counters: { appends: 0, copies: 0, total: 0 },
      caption: 'An empty dynamic array with room for 1 value. Each append writes one value; a full array must first copy everything into a new array twice as big.' });
    var costs = [];
    for (var k = 1; k <= m; k++) {
      var copies = 0, resized = false, oldCap = cap;
      if (size === cap) { copies = size; cap *= 2; resized = true; }
      size++;
      var cost = copies + 1;
      total += cost; copiesTotal += copies;
      costs = costs.concat([{ write: 1, copies: copies }]);
      var avg = total / k;
      steps.push({ k: k, size: size, cap: cap, oldCap: oldCap, copies: copies, cost: cost, total: total, avg: avg, resized: resized, costs: costs,
        counters: { appends: k, copies: copiesTotal, total: total },
        caption: resized
          ? 'Append #' + k + ': the array is full (' + oldCap + ' of ' + oldCap + '), so copy all ' + copies + ' value' + (copies === 1 ? '' : 's') + ' into a new array of ' + cap + ', then write. Cost ' + cost + '. Average so far: ' + trimNum(avg, 2) + '.'
          : 'Append #' + k + ': there is room (' + (size - 1) + ' of ' + cap + ' used), so write one value. Cost 1. Average so far: ' + trimNum(avg, 2) + '.' });
    }
    return steps;
  }

  /* ================================================================== the lab: six algorithms
     Each LAB entry: {id, title, op (counter key), opLabel, big (badge id), theory(n), theoryLabel, maxN,
     target (needs a target), sorted (input must be sorted), steps(values, target)}. */
  function ids(prefix, a) { return a.map(function (_, k) { return prefix + k; }); }

  function findMaxSteps(input) {
    var a = input.slice(), n = a.length, id = ids('m', a), steps = [], cmp = 0, upd = 0, best = 0;
    function view(i, phase) {
      return {
        items: a.map(function (v, k) {
          var st = 'default';
          if (phase === 'done') st = k === best ? 'found' : 'visited';
          else if (k === best) st = 'key';
          else if (phase === 'cmp' && k === i) st = 'compare';
          else if (i !== null && k <= i) st = 'visited';
          return { id: id[k], value: v, state: st };
        }),
        pointers: [
          phase !== 'done' && i !== null ? { name: 'i', index: i, state: 'compare' } : null,
          n ? { name: 'best', index: best, state: phase === 'done' ? 'found' : 'key', side: 'above' } : null
        ].filter(Boolean)
      };
    }
    function snap(kind, i, caption, line, vars) { steps.push({ kind: kind, view: view(i, kind), caption: caption, line: line, vars: vars, counters: { comparisons: cmp } }); }
    if (!n) { snap('empty', null, 'The list is empty, so there is no maximum and no comparison to make.', null, {}); return steps; }
    snap('init', null, 'Hold the first value: <b>best = ' + a[0] + '</b>. It cost nothing: no comparison yet.', 'init', { n: n, best: a[0], i: null });
    for (var i = 1; i < n; i++) {
      cmp++;
      snap('cmp', i, 'Comparison #' + cmp + ': is a[' + i + '] = ' + a[i] + ' larger than best = ' + a[best] + '? Every value after the first costs exactly one comparison.', 'cmp', { n: n, best: a[best], i: i, 'a[i]': a[i] });
      if (a[i] > a[best]) { var old = a[best]; best = i; upd++; snap('update', i, a[i] + ' &gt; ' + old + ', so best becomes ' + a[i] + '. Updates are not the operation we count, so the counter stays at ' + cmp + '.', 'update', { n: n, best: a[i], i: i, 'a[i]': a[i] }); }
    }
    snap('done', null, n === 1 ? 'One value: it is the maximum, found with <b>0</b> comparisons.' : 'Done: <b>' + cmp + ' comparisons</b> for n = ' + n + ', which is n − 1. The order of the values never changes that count.', 'ret', { n: n, best: a[best], i: n });
    return steps;
  }

  function pairSumSteps(input, target) {
    var a = input.slice(), n = a.length, id = ids('p', a), steps = [], checks = 0;
    function view(i, j, phase) {
      return {
        items: a.map(function (v, k) {
          var st = 'default';
          if (phase === 'found' && (k === i || k === j)) st = 'found';
          else if (phase === 'none') st = 'visited';
          else if (k === i) st = 'active';
          else if (k === j) st = 'compare';
          else if (i !== null && k < i) st = 'visited';
          return { id: id[k], value: v, state: st };
        }),
        pointers: phase === 'none' || i === null ? [] : [{ name: 'i', index: i, state: phase === 'found' ? 'found' : 'active' }].concat(j !== null ? [{ name: 'j', index: j, state: phase === 'found' ? 'found' : 'compare' }] : []),
        regions: i !== null && phase === 'check' && i + 1 <= n - 1 ? [{ from: i + 1, to: n - 1, state: 'compare', label: 'partners of a[' + i + ']' }] : []
      };
    }
    function snap(kind, i, j, caption, line, vars) { steps.push({ kind: kind, view: view(i, j, kind), caption: caption, line: line, vars: vars, counters: { pairs: checks } }); }
    if (n < 2) { snap('none', null, null, n ? 'One value cannot form a pair: 0 pairs to check.' : 'The list is empty: 0 pairs to check.', 'none', { n: n, t: target }); return steps; }
    snap('init', null, null, 'Try every pair i &lt; j and ask whether a[i] + a[j] = <b>' + target + '</b>. With ' + n + ' values there are up to ' + (n * (n - 1) / 2) + ' pairs.', 'outer', { n: n, t: target, i: null, j: null });
    for (var i = 0; i < n - 1; i++) {
      for (var j = i + 1; j < n; j++) {
        checks++;
        var s = a[i] + a[j];
        if (s === target) {
          snap('found', i, j, 'a[' + i + '] + a[' + j + '] = ' + a[i] + ' + ' + a[j] + ' = ' + target + '. Found a pair after <b>' + checks + '</b> check' + (checks === 1 ? '' : 's') + ', so the loops stop early.', 'found', { n: n, t: target, i: i, j: j, sum: s });
          return steps;
        }
        snap('check', i, j, 'Check #' + checks + ': ' + a[i] + ' + ' + a[j] + ' = ' + s + (s < target ? ' &lt; ' : ' &gt; ') + target + '.' + (j === n - 1 ? ' That was a[' + i + ']’s last partner, so i moves right and has one fewer partner.' : ''), 'check', { n: n, t: target, i: i, j: j, sum: s });
      }
    }
    snap('none', null, null, 'No pair works. Ruling that out took every pair: <b>' + checks + ' checks</b> = n(n − 1)/2 for n = ' + n + '. Doubling n would roughly quadruple it.', 'none', { n: n, t: target, i: null, j: null });
    return steps;
  }

  function binarySearchSteps(input, target) {
    var a = input.slice(), n = a.length, id = ids('b', a), steps = [], probes = 0, lo = 0, hi = n - 1;
    function view(mid, phase) {
      return {
        items: a.map(function (v, k) {
          var st = 'default';
          if (phase === 'found' && k === mid) st = 'found';
          else if (k < lo || k > hi) st = 'muted';
          else if (k === mid && phase === 'mid') st = 'compare';
          return { id: id[k], value: v, state: st };
        }),
        pointers: phase === 'found' ? [{ name: 'mid', index: mid, state: 'found' }] : [
          { name: 'lo', index: lo, state: 'active' }, { name: 'hi', index: hi, state: 'active', side: 'above' }
        ].concat(mid !== null && phase === 'mid' ? [{ name: 'mid', index: mid, state: 'compare' }] : []),
        regions: lo <= hi && phase !== 'found' ? [{ from: lo, to: hi, state: 'active', label: (hi - lo + 1) + ' left' }] : []
      };
    }
    function snap(kind, mid, caption, line, vars) { steps.push({ kind: kind, view: view(mid, kind), caption: caption, line: line, vars: vars, counters: { probes: probes } }); }
    if (!n) { snap('none', null, 'The list is empty: the window lo..hi is empty from the start, so 0 probes.', 'none', { lo: 0, hi: -1, t: target }); return steps; }
    snap('init', null, 'The values are sorted, so one probe in the middle can rule out half of them. Search for <b>' + target + '</b>.', 'init', { lo: lo, hi: hi, mid: null, t: target });
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2);
      probes++;
      snap('mid', mid, 'Probe #' + probes + ': the middle of ' + (hi - lo + 1) + ' candidates is a[' + mid + '] = ' + a[mid] + '.', 'mid', { lo: lo, hi: hi, mid: mid, 'a[mid]': a[mid], t: target });
      if (a[mid] === target) { snap('found', mid, a[mid] + ' = ' + target + ': found with <b>' + probes + '</b> probe' + (probes === 1 ? '' : 's') + '.', 'found', { lo: lo, hi: hi, mid: mid, 'a[mid]': a[mid], t: target }); return steps; }
      var before = hi - lo + 1;
      if (a[mid] < target) { lo = mid + 1; snap('right', mid, a[mid] + ' &lt; ' + target + ', so everything left of mid is too small too. Keep the right part: ' + before + ' → ' + Math.max(0, hi - lo + 1) + ' candidates.', 'right', { lo: lo, hi: hi, mid: mid, 'a[mid]': a[mid], t: target }); }
      else { hi = mid - 1; snap('left', mid, a[mid] + ' &gt; ' + target + ', so everything right of mid is too big too. Keep the left part: ' + before + ' → ' + Math.max(0, hi - lo + 1) + ' candidates.', 'left', { lo: lo, hi: hi, mid: mid, 'a[mid]': a[mid], t: target }); }
    }
    snap('none', null, 'The window is empty: ' + target + ' is not here. It took <b>' + probes + ' probes</b>; ⌊log₂ ' + n + '⌋ + 1 = ' + (Math.floor(log2(n)) + 1) + ' is the most any search of ' + n + ' values can need.', 'none', { lo: lo, hi: hi, mid: null, t: target });
    return steps;
  }

  function bubbleSortSteps(input) {
    var n = input.length, arr = input.map(function (v, k) { return { id: 'u' + k, value: v }; }), steps = [], cmp = 0, swp = 0, doneFrom = n;
    function view(j, phase) {
      return {
        items: arr.map(function (it, k) {
          var st = 'default';
          if (k >= doneFrom) st = 'done';
          else if (j !== null && (k === j || k === j + 1)) st = phase === 'swap' ? 'swap' : 'compare';
          return { id: it.id, value: it.value, state: st };
        }),
        pointers: j !== null && phase !== 'pass' ? [{ name: 'j', index: j, state: phase === 'swap' ? 'swap' : 'compare' }] : [],
        regions: doneFrom < n ? [{ from: doneFrom, to: n - 1, state: 'done', label: 'final' }] : []
      };
    }
    function vals() { return arr.map(function (x) { return x.value; }); }
    function snap(kind, j, caption, line, vars) { steps.push({ kind: kind, view: view(j, kind), caption: caption, line: line, vars: vars, counters: { comparisons: cmp, swaps: swp } }); }
    if (n < 2) { doneFrom = 0; snap('done', null, n ? 'One value is already sorted: 0 comparisons.' : 'The list is empty: nothing to sort, 0 comparisons.', 'ret', { a: vals() }); return steps; }
    snap('init', null, 'Bubble sort compares neighbours and swaps them when they are out of order. Each pass carries the largest remaining value to the end.', 'outer', { pass: 0, j: null, a: vals() });
    for (var pass = 0; pass < n - 1; pass++) {
      for (var j = 0; j < n - 1 - pass; j++) {
        cmp++;
        var x = arr[j].value, y = arr[j + 1].value;
        snap('cmp', j, 'Comparison #' + cmp + ': is ' + x + ' &gt; ' + y + '?', 'cmp', { pass: pass, j: j, a: vals() });
        if (x > y) {
          var t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t; swp++;
          snap('swap', j, x + ' &gt; ' + y + ', so they swap. The larger value keeps moving right.', 'swap', { pass: pass, j: j, a: vals() });
        }
      }
      doneFrom = n - 1 - pass;
      if (pass === n - 2) doneFrom = 0;
      snap('pass', null, pass === n - 2 ? 'All passes done: <b>' + cmp + ' comparisons</b> = n(n − 1)/2 for n = ' + n + '. This version compares every pair of neighbours in every pass, whatever the input order.' : 'Pass ' + (pass + 1) + ' is over: ' + arr[n - 1 - pass].value + ' has reached its final place. The next pass is one comparison shorter.', pass === n - 2 ? 'ret' : 'outer', { pass: pass + 1, j: null, a: vals() });
    }
    return steps;
  }

  function subsetSumSteps(input, target) {
    var a = input.slice(), n = a.length, id = ids('s', a), steps = [], checked = 0, total = Math.pow(2, n);
    function view(mask, phase) {
      return {
        items: a.map(function (v, k) {
          var inSet = mask !== null && ((mask >> k) & 1);
          return { id: id[k], value: v, state: inSet ? (phase === 'found' ? 'found' : 'key') : (phase === 'none' ? 'visited' : 'default'), label: mask !== null ? String((mask >> k) & 1) : undefined };
        })
      };
    }
    function snap(kind, mask, caption, line, vars) { steps.push({ kind: kind, view: view(mask, kind), caption: caption, line: line, vars: vars, counters: { subsets: checked } }); }
    snap('init', null, 'Try every subset of the ' + n + ' value' + (n === 1 ? '' : 's') + ' and ask whether it adds up to <b>' + target + '</b>. Each value is either in or out, so there are 2<sup>' + n + '</sup> = ' + total + ' subsets.', 'loop', { mask: null, subset: [], sum: null, t: target });
    for (var mask = 0; mask < total; mask++) {
      checked++;
      var sub = [], s = 0;
      for (var i = 0; i < n; i++) if ((mask >> i) & 1) { sub.push(a[i]); s += a[i]; }
      var name = sub.length ? '{' + sub.join(', ') + '}' : 'the empty set {}';
      var vars = { mask: mask, subset: sub, sum: s, t: target };
      if (s === target) { snap('found', mask, 'Subset #' + checked + ', ' + name + ', adds up to ' + target + '. Found after <b>' + checked + '</b> of ' + total + ' subsets.', 'found', vars); return steps; }
      snap('check', mask, 'Subset #' + checked + ' (mask ' + mask + ', the 0/1 under each value): ' + name + ' sums to ' + s + ', not ' + target + '.', 'check', vars);
    }
    snap('none', null, 'No subset works. Proving it took all <b>' + total + '</b> subsets. One more value would double that to ' + (2 * total) + '.', 'none', { mask: null, subset: [], sum: null, t: target });
    return steps;
  }

  /* Merge sort (top-down). Two rows: the array `a` and the merge buffer `out`. An item written to the buffer
     keeps its id, so it flies down; copying back flies it up again. Counts element comparisons. */
  function mergeSortSteps(input) {
    var n = input.length, a = input.map(function (v, k) { return { id: 'g' + k, value: v }; }), steps = [], cmp = 0;
    var buf = [];   // [{id, value, index}]
    function view(o) {
      o = o || {};
      var inBuf = {}; buf.forEach(function (b) { inBuf[b.id] = true; });
      var itemsA = [];
      a.forEach(function (it, k) {
        if (inBuf[it.id]) return;
        var st = 'default';
        if (o.done) st = 'done';
        else if (o.cmp && (k === o.cmp[0] || k === o.cmp[1])) st = 'compare';
        else if (o.range && (k < o.range[0] || k > o.range[1])) st = 'muted';
        itemsA.push({ id: it.id, value: it.value, index: k, state: st });
      });
      var itemsB = buf.map(function (b, k) { return { id: b.id, value: b.value, index: b.index, state: k === buf.length - 1 && o.wrote ? 'swap' : 'visited' }; });
      var regions = [];
      if (o.range && !o.done) {
        var lo = o.range[0], hi = o.range[1], mid = o.mid;
        if (mid !== undefined && mid !== null) {
          regions.push({ from: lo, to: mid, state: 'active', label: 'left half', row: 'a' });
          if (mid + 1 <= hi) regions.push({ from: mid + 1, to: hi, state: 'frontier', label: 'right half', row: 'a' });
        } else regions.push({ from: lo, to: hi, state: 'active', label: 'sorted', row: 'a' });
      }
      var pointers = [];
      if (o.i !== undefined && o.i !== null && o.i <= o.mid) pointers.push({ name: 'i', index: o.i, state: 'compare', row: 'a' });
      if (o.j !== undefined && o.j !== null && o.j <= o.range[1]) pointers.push({ name: 'j', index: o.j, state: 'compare', row: 'a' });
      return {
        rows: [
          { id: 'a', label: 'a', items: itemsA, length: n },
          { id: 'out', label: 'out', items: itemsB, length: n, showIndices: false }
        ],
        regions: regions, pointers: pointers
      };
    }
    function vals() { return a.map(function (x) { return x.value; }); }
    function snap(kind, o, caption, line, vars) { steps.push({ kind: kind, view: view(o), caption: caption, line: line, vars: vars, counters: { comparisons: cmp } }); }
    if (n < 2) { snap('done', { done: true }, n ? 'One value is already sorted: 0 comparisons.' : 'The list is empty: nothing to sort, 0 comparisons.', 'base', { a: vals() }); return steps; }
    snap('init', {}, 'Merge sort splits the list in half, sorts each half, then merges the two sorted halves by comparing their front values.', 'split', { a: vals() });
    function sort(lo, hi) {
      if (lo >= hi) return;
      var mid = Math.floor((lo + hi) / 2);
      snap('split', { range: [lo, hi], mid: mid }, 'Split a[' + lo + '..' + hi + '] into a[' + lo + '..' + mid + '] and a[' + (mid + 1) + '..' + hi + ']. Each half is sorted first, then merged.', 'split', { lo: lo, mid: mid, hi: hi, a: vals() });
      sort(lo, mid);
      sort(mid + 1, hi);
      merge(lo, mid, hi);
    }
    function merge(lo, mid, hi) {
      var i = lo, j = mid + 1, k = lo;
      buf = [];
      snap('merge', { range: [lo, hi], mid: mid, i: i, j: j }, 'Merge the sorted halves a[' + lo + '..' + mid + '] and a[' + (mid + 1) + '..' + hi + '] into the buffer.', 'merge', { lo: lo, mid: mid, hi: hi, i: i, j: j, a: vals() });
      while (i <= mid && j <= hi) {
        cmp++;
        var x = a[i].value, y = a[j].value;
        snap('cmp', { range: [lo, hi], mid: mid, i: i, j: j, cmp: [i, j] }, 'Comparison #' + cmp + ': ' + x + ' vs ' + y + '. The smaller front value goes next.', 'cmp', { lo: lo, mid: mid, hi: hi, i: i, j: j, a: vals() });
        if (x <= y) { buf.push({ id: a[i].id, value: x, index: k }); i++; k++; snap('take', { range: [lo, hi], mid: mid, i: i, j: j, wrote: true }, x + ' ≤ ' + y + ', so write ' + x + ' from the left half.', 'takeL', { lo: lo, mid: mid, hi: hi, i: i, j: j, a: vals() }); }
        else { buf.push({ id: a[j].id, value: y, index: k }); j++; k++; snap('take', { range: [lo, hi], mid: mid, i: i, j: j, wrote: true }, y + ' &lt; ' + x + ', so write ' + y + ' from the right half.', 'takeR', { lo: lo, mid: mid, hi: hi, i: i, j: j, a: vals() }); }
      }
      if (i <= mid || j <= hi) {
        var rest = [];
        while (i <= mid) { rest.push(a[i].value); buf.push({ id: a[i].id, value: a[i].value, index: k }); i++; k++; }
        while (j <= hi) { rest.push(a[j].value); buf.push({ id: a[j].id, value: a[j].value, index: k }); j++; k++; }
        snap('rest', { range: [lo, hi], mid: mid, i: i, j: j, wrote: true }, 'One half is empty, so the rest (' + rest.join(', ') + ') is already in order: copy it with no comparisons.', 'rest', { lo: lo, mid: mid, hi: hi, i: i, j: j, a: vals() });
      }
      var sorted = buf.map(function (b) { return { id: b.id, value: b.value }; });
      for (var t = 0; t < sorted.length; t++) a[lo + t] = sorted[t];
      buf = [];
      var final = lo === 0 && hi === n - 1;
      snap(final ? 'done' : 'copy', final ? { done: true } : { range: [lo, hi] }, final
        ? 'Copied back: the whole list is sorted with <b>' + cmp + ' comparisons</b>. For n = ' + n + ', n log₂ n ≈ ' + Math.round(n * log2(n)) + ': each of about log₂ n levels of merging costs at most n comparisons.'
        : 'Copy the merged run back into a[' + lo + '..' + hi + ']. It is sorted now, ready for a bigger merge.', 'copy', { lo: lo, mid: mid, hi: hi, a: vals() });
    }
    sort(0, n - 1);
    return steps;
  }

  var LAB = [
    { id: 'findMax', title: 'Find the maximum', op: 'comparisons', opLabel: 'Comparisons', big: 'n', theory: function (n) { return Math.max(0, n - 1); }, theoryLabel: 'n − 1', maxN: 16, defaultN: 10, target: false, sorted: false, steps: findMaxSteps },
    { id: 'pairSum', title: 'Pair sum, brute force', op: 'pairs', opLabel: 'Pairs checked', big: 'n2', theory: function (n) { return n * (n - 1) / 2; }, theoryLabel: 'n(n − 1)/2', maxN: 12, defaultN: 8, target: true, sorted: false, steps: pairSumSteps },
    { id: 'binarySearch', title: 'Binary search', op: 'probes', opLabel: 'Probes', big: 'logn', theory: function (n) { return n >= 1 ? Math.floor(log2(n)) + 1 : 0; }, theoryLabel: '⌊log₂ n⌋ + 1', maxN: 16, defaultN: 16, target: true, sorted: true, steps: binarySearchSteps },
    { id: 'bubbleSort', title: 'Bubble sort', op: 'comparisons', opLabel: 'Comparisons', big: 'n2', theory: function (n) { return n * (n - 1) / 2; }, theoryLabel: 'n(n − 1)/2', maxN: 10, defaultN: 8, target: false, sorted: false, steps: bubbleSortSteps },
    { id: 'subsetSum', title: 'Subset sum, every subset', op: 'subsets', opLabel: 'Subsets checked', big: '2n', theory: function (n) { return Math.pow(2, n); }, theoryLabel: '2ⁿ', maxN: 6, defaultN: 5, target: true, sorted: false, steps: subsetSumSteps },
    { id: 'mergeSort', title: 'Merge sort', op: 'comparisons', opLabel: 'Comparisons', big: 'nlogn', theory: function (n) { return n > 1 ? n * log2(n) : 0; }, theoryLabel: 'n log₂ n', maxN: 10, defaultN: 8, target: false, sorted: false, steps: mergeSortSteps }
  ];
  var LAB_BY_ID = {};
  LAB.forEach(function (x) { LAB_BY_ID[x.id] = x; });
  function labSteps(id, values, target) {
    var alg = LAB_BY_ID[id];
    var v = alg.sorted ? values.slice().sort(function (p, q) { return p - q; }) : values.slice();
    return alg.steps(v, target);
  }
  function countOps(id, values, target) {
    var steps = labSteps(id, values, target), last = steps[steps.length - 1];
    return last.counters[LAB_BY_ID[id].op];
  }

  /* ================================================================== flowchart: how to find the Big-O of code */
  var FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'Look at the code', col: 1, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'kind', type: 'decision', text: 'Loop or recursion?', col: 1, row: 1, narrow: { col: 0, row: 1 } },
      { id: 'o1', type: 'end', text: 'O(1): fixed work', col: 2, row: 1, narrow: { col: 1, row: 1 } },
      { id: 'halve', type: 'decision', text: 'Counter halves or doubles?', col: 1, row: 2, narrow: { col: 0, row: 2 } },
      { id: 'ologn', type: 'end', text: 'O(log n)', col: 2, row: 2, narrow: { col: 1, row: 2 } },
      { id: 'inner', type: 'decision', text: 'Another loop inside?', col: 1, row: 3, narrow: { col: 0, row: 3 } },
      { id: 'on', type: 'end', text: 'O(n)', col: 2, row: 3, narrow: { col: 1, row: 3 } },
      { id: 'multiply', type: 'process', text: 'Multiply: n × inner cost', col: 1, row: 4, narrow: { col: 0, row: 4 } },
      { id: 'innerHalve', type: 'decision', text: 'Inner counter halves?', col: 1, row: 5, narrow: { col: 0, row: 5 } },
      { id: 'onlogn', type: 'end', text: 'O(n log n)', col: 2, row: 5, narrow: { col: 1, row: 5 } },
      { id: 'on2', type: 'end', text: 'O(n²)', col: 1, row: 6, narrow: { col: 0, row: 6 } },
      { id: 'split', type: 'decision', text: 'Halves n, linear merge?', col: 0, row: 2, narrow: { col: 0, row: 7 } },
      { id: 'rnlogn', type: 'end', text: 'O(n log n)', col: 0, row: 3, narrow: { col: 1, row: 7 } },
      { id: 'twoCalls', type: 'decision', text: 'Two calls on n − 1?', col: 0, row: 4, narrow: { col: 0, row: 8 } },
      { id: 'o2n', type: 'end', text: 'O(2ⁿ)', col: 0, row: 5, narrow: { col: 1, row: 8 } }
    ],
    edges: [
      { from: 'start', to: 'kind' },
      { from: 'kind', to: 'o1', label: 'neither' },
      { from: 'kind', to: 'halve', label: 'loop' },
      { from: 'kind', to: 'split', label: 'recursion' },
      { from: 'halve', to: 'ologn', label: 'yes' },
      { from: 'halve', to: 'inner', label: 'no' },
      { from: 'inner', to: 'on', label: 'no' },
      { from: 'inner', to: 'multiply', label: 'yes' },
      { from: 'multiply', to: 'innerHalve' },
      { from: 'innerHalve', to: 'onlogn', label: 'yes' },
      { from: 'innerHalve', to: 'on2', label: 'no' },
      { from: 'split', to: 'rnlogn', label: 'yes' },
      { from: 'split', to: 'twoCalls', label: 'no' },
      { from: 'twoCalls', to: 'o2n', label: 'yes' }
    ]
  };
  /* One path per snippet; each hop must be an edge of FLOW (tested). */
  var FLOW_TRACES = {
    constant: { answer: '1', path: ['start', 'kind', 'o1'] },
    findMax: { answer: 'n', path: ['start', 'kind', 'halve', 'inner', 'on'] },
    binarySearch: { answer: 'logn', path: ['start', 'kind', 'halve', 'ologn'] },
    pairSum: { answer: 'n2', path: ['start', 'kind', 'halve', 'inner', 'multiply', 'innerHalve', 'on2'] },
    loopLog: { answer: 'nlogn', path: ['start', 'kind', 'halve', 'inner', 'multiply', 'innerHalve', 'onlogn'] },
    mergeSort: { answer: 'nlogn', path: ['start', 'kind', 'split', 'rnlogn'] },
    subsets: { answer: '2n', path: ['start', 'kind', 'split', 'twoCalls', 'o2n'] }
  };

  return {
    CLASSES: CLASSES, cls: cls, log2: log2, lnFactorial: lnFactorial, factorial: factorial,
    log10Work: log10Work, work: work, feasibleN: feasibleN, doubling: doubling,
    formatBig: formatBig, formatCount: formatCount, secondsText: secondsText, withCommas: withCommas, trimNum: trimNum, sup: sup, YEAR: YEAR,
    raceSteps: raceSteps, linearSearchSteps: linearSearchSteps, searchHistogram: searchHistogram,
    SNIPPETS: SNIPPETS, snippetOps: snippetOps, halvingTrail: halvingTrail, appendSteps: appendSteps,
    LAB: LAB, LAB_BY_ID: LAB_BY_ID, labSteps: labSteps, countOps: countOps,
    findMaxSteps: findMaxSteps, pairSumSteps: pairSumSteps, binarySearchSteps: binarySearchSteps,
    bubbleSortSteps: bubbleSortSteps, subsetSumSteps: subsetSumSteps, mergeSortSteps: mergeSortSteps,
    FLOW: FLOW, FLOW_TRACES: FLOW_TRACES
  };
}));
