/* Lesson 13 · Binary search: pure step generators (no DOM).
   Browser: VDSA.algos.binarySearch.   Node: module.exports (tests/algos/13-binary-search.test.js).

   Generators
   - search(values, x, {variant})     exact | lower | upper | first | last: array-view snapshots with lo/mid/hi,
                                      dimmed (ruled out) regions, code lines, flowchart ids, vars and counters
   - probes(values, x, variant)       the bare list of comparisons {lo, hi, mid, move, ...} + result (fast, no snapshots)
   - count(variant, values, x)        comparisons only;  worstMeasured(n) brute-forces the worst case over every target
   - worstCase(n)                     floor(log2 n) + 1 comparisons (0 for n = 0)
   - linear(values, x)                the linear-search baseline as array-view steps;  linearComparisons(values, x)
   - guessSteps(secret, lo, hi)       the halving strategy for the guess-the-number game
   - halving(n)                       worst-case candidates left after k comparisons: n, n/2, n/4 ... 0
   - decisionTree(values)             every comparison binary search can make, as a tree (+ gap leaves for absent targets)
   - treeSteps(values, x)             a search walking down the decision tree
   - answerSteps(problem)             binary search on the answer (min shipping capacity | integer square root)
   - bisection(f, lo, hi, iters)      the continuous cousin: halve an interval around a sign change
   - bugSteps(kind, values, x, fixed) the classic bugs (lo = mid loops forever; lo < hi misses the last candidate)
   - int32 helpers: wrap32, midNaive, midSafe   (why (lo + hi) / 2 overflows)
   - CODE[variant], BUG_CODE[kind][fixed], VARIANTS[variant]   code panels with // @labels matching step.line

   Every step is a complete snapshot; nothing is mutated after it is pushed. Truth rules (tested): a dimmed item is
   dimmed only when its side has been proven (when the input is sorted); the counters only grow; the result equals a
   plain reference implementation on every input. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.binarySearch = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  var NA = { __vdsaRaw: true, text: '–', type: 'undef' };   // "not set yet" in the variable watch
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function valueOf(x) { return x !== null && typeof x === 'object' ? x.value : x; }
  function isSorted(a) { for (var i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false; return true; }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }
  function floorLog2(n) { var k = 0; while (n >= 2) { n = Math.floor(n / 2); k++; } return k; }
  function worstCase(n) { return n <= 0 ? 0 : floorLog2(n) + 1; }
  function span(word, a, b) { return a === b ? word + ' ' + a + ' is' : (word === 'index' ? 'indexes' : word + 's') + ' ' + a + ' to ' + b + ' are'; }
  function range(lo, hi) { var out = []; for (var k = lo; k <= hi; k++) out.push(k); return out; }

  /* ------------------------------------------------------------------ variants */
  var VARIANTS = {
    exact: {
      title: 'Exact search', half: false, verify: null,
      goRight: function (v, x) { return v < x; },
      leftSign: '<', rightSign: '>',
      invariant: 'If <code>x</code> is in the array, it is inside <code>a[lo..hi]</code>. Everything left of <code>lo</code> is <code>&lt; x</code>, everything right of <code>hi</code> is <code>&gt; x</code>.',
      answer: 'the index of a match, or −1'
    },
    lower: {
      title: 'Lower bound', half: true, verify: null,
      goRight: function (v, x) { return v < x; },
      leftSign: '<', rightSign: '≥',
      invariant: 'Everything left of <code>lo</code> is <code>&lt; x</code>; <code>hi</code> and everything after it is <code>≥ x</code>. The answer, the first index whose value is <code>≥ x</code>, lies in <code>[lo, hi]</code>.',
      answer: 'the first index whose value is ≥ x (n if none)'
    },
    upper: {
      title: 'Upper bound', half: true, verify: null,
      goRight: function (v, x) { return v <= x; },
      leftSign: '≤', rightSign: '>',
      invariant: 'Everything left of <code>lo</code> is <code>≤ x</code>; <code>hi</code> and everything after it is <code>&gt; x</code>. The answer, the first index whose value is <code>&gt; x</code>, lies in <code>[lo, hi]</code>.',
      answer: 'the first index whose value is > x (n if none)'
    },
    first: {
      title: 'First occurrence', half: true, verify: 'first',
      goRight: function (v, x) { return v < x; },
      leftSign: '<', rightSign: '≥',
      invariant: 'A lower bound, then one check: the first index with a value <code>≥ x</code> is the first occurrence only if <code>a[lo] === x</code>.',
      answer: 'the index of the first x, or −1'
    },
    last: {
      title: 'Last occurrence', half: true, verify: 'last',
      goRight: function (v, x) { return v <= x; },
      leftSign: '≤', rightSign: '>',
      invariant: 'An upper bound, then one check: the item just before the first value <code>&gt; x</code> is the last occurrence only if <code>a[lo − 1] === x</code>.',
      answer: 'the index of the last x, or −1'
    }
  };

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE = {
    exact: {
      pseudo: [
        'procedure binarySearch(a, x)',
        '  lo ← 0;  hi ← n − 1                  // @init',
        '  while lo ≤ hi                         // @loop',
        '    mid ← lo + (hi − lo) div 2          // @mid',
        '    if a[mid] = x then                  // @cmp',
        '      return mid                        // @found',
        '    else if a[mid] < x then             // @less',
        '      lo ← mid + 1                      // @right',
        '    else',
        '      hi ← mid − 1                      // @left',
        '  return −1                             // @none'
      ].join('\n'),
      js: [
        'function binarySearch(a, x) {',
        '  let lo = 0, hi = a.length - 1;                 // @init',
        '  while (lo <= hi) {                             // @loop',
        '    const mid = lo + Math.floor((hi - lo) / 2);  // @mid',
        '    if (a[mid] === x) return mid;                // @cmp @found',
        '    if (a[mid] < x) {                            // @less',
        '      lo = mid + 1;                              // @right',
        '    } else {',
        '      hi = mid - 1;                              // @left',
        '    }',
        '  }',
        '  return -1;                                     // @none',
        '}'
      ].join('\n'),
      py: [
        'def binary_search(a, x):',
        '    lo, hi = 0, len(a) - 1              # @init',
        '    while lo <= hi:                     # @loop',
        '        mid = lo + (hi - lo) // 2       # @mid',
        '        if a[mid] == x:                 # @cmp',
        '            return mid                  # @found',
        '        if a[mid] < x:                  # @less',
        '            lo = mid + 1                # @right',
        '        else:',
        '            hi = mid - 1                # @left',
        '    return -1                           # @none'
      ].join('\n')
    }
  };
  function boundCode(fn, pseudoName, jsName, pyName, pseudoTest, jsTest, tail) {
    return {
      pseudo: [
        'procedure ' + pseudoName + '(a, x)',
        '  lo ← 0;  hi ← n                       // @init',
        '  while lo < hi                         // @loop',
        '    mid ← lo + (hi − lo) div 2          // @mid',
        '    if ' + pseudoTest + ' then' + new Array(Math.max(1, 20 - pseudoTest.length)).join(' ') + '// @cmp',
        '      lo ← mid + 1                      // @right',
        '    else',
        '      hi ← mid                          // @left'
      ].concat(tail.pseudo).join('\n'),
      js: [
        'function ' + jsName + '(a, x) {',
        '  let lo = 0, hi = a.length;                     // @init',
        '  while (lo < hi) {                              // @loop',
        '    const mid = lo + Math.floor((hi - lo) / 2);  // @mid',
        '    if (' + jsTest + ') {' + new Array(Math.max(1, 30 - jsTest.length)).join(' ') + '// @cmp',
        '      lo = mid + 1;                              // @right',
        '    } else {',
        '      hi = mid;                                  // @left',
        '    }',
        '  }'
      ].concat(tail.js).concat(['}']).join('\n'),
      py: [
        'def ' + pyName + '(a, x):',
        '    lo, hi = 0, len(a)                  # @init',
        '    while lo < hi:                      # @loop',
        '        mid = lo + (hi - lo) // 2       # @mid',
        '        if ' + jsTest + ':' + new Array(Math.max(1, 26 - jsTest.length)).join(' ') + '# @cmp',
        '            lo = mid + 1                # @right',
        '        else:',
        '            hi = mid                    # @left'
      ].concat(tail.py).join('\n')
    };
  }
  CODE.lower = boundCode(null, 'lowerBound', 'lowerBound', 'lower_bound', 'a[mid] < x', 'a[mid] < x', {
    pseudo: ['  return lo                             // @done'],
    js: ['  return lo;                                     // @done'],
    py: ['    return lo                           # @done']
  });
  CODE.upper = boundCode(null, 'upperBound', 'upperBound', 'upper_bound', 'a[mid] ≤ x', 'a[mid] <= x', {
    pseudo: ['  return lo                             // @done'],
    js: ['  return lo;                                     // @done'],
    py: ['    return lo                           # @done']
  });
  CODE.first = boundCode(null, 'firstOccurrence', 'firstOccurrence', 'first_occurrence', 'a[mid] < x', 'a[mid] < x', {
    pseudo: ['  if lo < n and a[lo] = x then return lo   // @verify @found', '  return −1                             // @none'],
    js: ['  if (lo < a.length && a[lo] === x) return lo;   // @verify @found', '  return -1;                                     // @none'],
    py: ['    if lo < len(a) and a[lo] == x: return lo   # @verify @found', '    return -1                           # @none']
  });
  CODE.last = boundCode(null, 'lastOccurrence', 'lastOccurrence', 'last_occurrence', 'a[mid] ≤ x', 'a[mid] <= x', {
    pseudo: ['  if lo > 0 and a[lo − 1] = x then return lo − 1   // @verify @found', '  return −1                             // @none'],
    js: ['  if (lo > 0 && a[lo - 1] === x) return lo - 1;  // @verify @found', '  return -1;                                     // @none'],
    py: ['    if lo > 0 and a[lo - 1] == x: return lo - 1   # @verify @found', '    return -1                           # @none']
  });

  /* ------------------------------------------------------------------ probes: the bare comparisons */
  /* One entry per comparison of a[mid] with x. lo/hi are the bounds BEFORE the comparison, loAfter/hiAfter after it.
     exact:  closed range [lo, hi], stops early on a match.  bound family: half-open [lo, hi), hi may be n. */
  function probes(values, x, variant) {
    var v = VARIANTS[variant || 'exact'];
    if (!v) throw new Error('Unknown variant: ' + variant);
    var a = (values || []).map(valueOf), n = a.length, list = [];
    var lo = 0, hi = v.half ? n : n - 1;
    if (!v.half) {
      while (lo <= hi) {
        var mid = lo + Math.floor((hi - lo) / 2), p = { lo: lo, hi: hi, mid: mid, value: a[mid] };
        if (a[mid] === x) { p.move = 'found'; p.loAfter = lo; p.hiAfter = hi; list.push(p); return { probes: list, lo: lo, hi: hi, result: mid }; }
        if (a[mid] < x) { p.move = 'right'; lo = mid + 1; } else { p.move = 'left'; hi = mid - 1; }
        p.loAfter = lo; p.hiAfter = hi; list.push(p);
      }
      return { probes: list, lo: lo, hi: hi, result: -1 };
    }
    while (lo < hi) {
      var m = lo + Math.floor((hi - lo) / 2), q = { lo: lo, hi: hi, mid: m, value: a[m] };
      if (v.goRight(a[m], x)) { q.move = 'right'; lo = m + 1; } else { q.move = 'left'; hi = m; }
      q.loAfter = lo; q.hiAfter = hi; list.push(q);
    }
    var result = lo;
    if (v.verify === 'first') result = lo < n && a[lo] === x ? lo : -1;
    if (v.verify === 'last') result = lo > 0 && a[lo - 1] === x ? lo - 1 : -1;
    return { probes: list, lo: lo, hi: hi, result: result, boundary: lo };
  }
  function count(variant, values, x) { return probes(values, x, variant).probes.length; }
  function worstMeasured(n, variant) {
    var a = range(0, n - 1).map(function (i) { return 2 * i + 2; }), worst = 0;
    for (var t = 0; t <= 2 * n + 2; t++) worst = Math.max(worst, count(variant || 'exact', a, t));
    return worst;
  }

  /* ------------------------------------------------------------------ search: array-view snapshots */
  function search(values, target, opts) {
    opts = opts || {};
    var variant = opts.variant || 'exact', cfg = VARIANTS[variant];
    if (!cfg) throw new Error('Unknown variant: ' + variant);
    var a = (values || []).map(valueOf), n = a.length, x = target, prefix = opts.idPrefix || 'v';
    var half = cfg.half, sorted = isSorted(a);
    var plan = probes(a, x, variant);
    var lo = 0, hi = half ? n : n - 1, mid = -1, cmps = 0, steps = [];
    var assume = sorted ? '' : ' <em>(if the array were sorted)</em>';
    var xs = fmt(x), lsign = cfg.leftSign, rsign = cfg.rightSign;

    function candidates() { return Math.max(0, hi - lo + 1); }
    function snap(kind, o) {
      o = o || {};
      var rightFrom = half ? hi : hi + 1, liveTo = half ? hi - 1 : hi;
      var items = a.map(function (v, i) {
        var st = 'default';
        if (i < lo || i >= rightFrom) st = 'muted';
        if (o.midState && i === o.midIndex) st = o.midState;
        if (o.hit !== undefined && i === o.hit) st = 'found';
        if (o.key !== undefined && i === o.key) st = 'key';
        if (o.error !== undefined && i === o.error) st = 'error';
        return { id: prefix + i, value: v, state: st };
      });
      var regions = [];
      if (lo > 0) regions.push({ id: 'rl', from: 0, to: Math.min(lo - 1, n - 1), state: 'muted', label: (sorted ? '' : 'assumed ') + lsign + ' ' + xs });
      if (rightFrom < n) regions.push({ id: 'rr', from: Math.max(rightFrom, 0), to: n - 1, state: 'muted', label: (sorted ? '' : 'assumed ') + rsign + ' ' + xs });
      if (!o.noLive && lo <= liveTo && n > 0) regions.push({ id: 'rv', from: lo, to: liveTo, state: 'active', label: liveTo - lo >= 2 ? 'candidates' : undefined });
      var pointers = [];
      if (o.showBounds !== false) {
        pointers.push({ name: 'lo', index: lo, state: 'active', side: 'below', id: 'p-lo' });
        pointers.push({ name: 'hi', index: hi, state: 'active', side: 'below', id: 'p-hi' });
      }
      if (o.pointerMid !== undefined && o.pointerMid >= 0) pointers.push({ name: o.pointerName || 'mid', index: o.pointerMid, state: o.pointerState || 'compare', side: 'above', id: 'p-mid' });
      var s = {
        algo: 'binary', variant: variant, kind: kind, n: n, target: x, sorted: sorted,
        items: items, pointers: pointers, regions: regions,
        lo: lo, hi: hi, mid: mid, live: [lo, liveTo], result: o.result === undefined ? null : o.result,
        caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow,
        vars: { lo: lo, hi: hi, mid: mid >= 0 ? mid : NA, 'a[mid]': mid >= 0 && mid < n ? a[mid] : NA, x: x },
        varStates: { lo: 'active', hi: 'active', mid: 'compare' },
        counters: { comparisons: cmps, left: candidates() }
      };
      steps.push(s);
      return s;
    }

    // ---- start
    var startCap = n === 0
      ? 'The array is empty, so there is nothing to look at. ' + (half ? '<code>lo = 0</code> and <code>hi = n = 0</code>: the answer can only be position 0.' : '<code>lo = 0</code> and <code>hi = n − 1 = −1</code> already cross.')
      : 'Looking for <b>' + xs + '</b> among ' + plural(n, 'sorted value') + '. ' + (half
        ? 'The answer is one of the ' + (n + 1) + ' positions 0 to ' + n + ' (position ' + n + ' means “past the end”), so <code>lo = 0</code> and <code>hi = n = ' + n + '</code>.'
        : 'Any of the ' + n + ' positions could hold it, so <code>lo = 0</code> and <code>hi = n − 1 = ' + (n - 1) + '</code>.');
    if (!sorted) startCap += ' <b>Careful: this array is not sorted</b>, so the halving argument below will not hold.';
    snap('start', { caption: startCap, line: 'init', flow: 'start' });

    for (var k = 0; k < plan.probes.length; k++) {
      var p = plan.probes[k];
      // loop test (true)
      snap('check', { caption: half
        ? '<code>lo &lt; hi</code> (' + fmt(lo) + ' &lt; ' + fmt(hi) + '): more than one position is still possible, so keep halving.'
        : '<code>lo ≤ hi</code> (' + fmt(lo) + ' ≤ ' + fmt(hi) + '): at least one candidate is left, so keep going.', line: 'loop', flow: 'loop' });
      mid = p.mid;
      snap('mid', { midIndex: mid, midState: 'compare', pointerMid: mid, line: 'mid', flow: 'mid', caption:
        'Probe the middle of the range: <code>mid = ' + fmt(lo) + ' + (' + fmt(hi) + ' − ' + fmt(lo) + ') div 2 = ' + mid + '</code>. ' +
        (k === 0 ? 'Its value tells us which half to throw away, so we compare just this one item.' : 'One comparison here will discard about half of what is left.') });
      cmps++;
      var v = p.value, vs = fmt(v), why;
      if (!half) {
        if (p.move === 'found') {
          snap('compare', { midIndex: mid, midState: 'compare', pointerMid: mid, line: 'cmp', flow: 'cmp', caption: '<code>a[' + mid + '] = ' + vs + '</code> equals the target <b>' + xs + '</b>. ' + 'This comparison ends the search.' });
          snap('found', { hit: mid, pointerMid: mid, pointerState: 'found', pointerName: 'found', result: mid, line: 'found', flow: 'found', showBounds: true, caption:
            '<b>Found ' + xs + ' at index ' + mid + '</b> after ' + plural(cmps, 'comparison') + '. ' + (n > 1 ? 'A linear scan could have needed up to ' + n + '.' : '') });
          return steps;
        }
        if (p.move === 'right') why = '<code>a[' + mid + '] = ' + vs + '</code> is less than <b>' + xs + '</b>, so it is too small' + assume + '. Every value to its left is ≤ ' + vs + ' (sorted order), so none of them can be ' + xs + '.';
        else why = '<code>a[' + mid + '] = ' + vs + '</code> is greater than <b>' + xs + '</b>, so it is too big' + assume + '. Every value to its right is ≥ ' + vs + ' (sorted order), so none of them can be ' + xs + '.';
      } else {
        var goesRight = p.move === 'right';
        if (variant === 'lower' || variant === 'first') why = goesRight
          ? '<code>a[' + mid + '] = ' + vs + '</code> is <b>&lt; ' + xs + '</b>' + assume + '. It, and everything left of it, comes before the boundary, so the answer is to the right.'
          : '<code>a[' + mid + '] = ' + vs + '</code> is <b>≥ ' + xs + '</b>. Everything from here on is ≥ ' + xs + ' too' + assume + ', but <code>mid</code> itself might be the first such item, so the boundary is at <code>mid</code> or to its left.';
        else why = goesRight
          ? '<code>a[' + mid + '] = ' + vs + '</code> is <b>≤ ' + xs + '</b>' + assume + '. It, and everything left of it, is not greater than ' + xs + ', so the boundary is to the right.'
          : '<code>a[' + mid + '] = ' + vs + '</code> is <b>&gt; ' + xs + '</b>. Everything from here on is greater too' + assume + ', but <code>mid</code> itself might be the first such item, so the boundary is at <code>mid</code> or to its left.';
      }
      snap('compare', { midIndex: mid, midState: 'compare', pointerMid: mid, line: 'cmp', flow: 'cmp', caption: why });
      // discard
      var before = candidates();
      lo = p.loAfter; hi = p.hiAfter;
      var after = candidates();
      var cap;
      if (!half) {
        cap = p.move === 'right'
          ? '<code>lo = mid + 1 = ' + lo + '</code>: ' + span('index', 0, mid) + ' out. Plus one because <code>mid</code> was just compared and is not ' + xs + '. ' + after + ' of ' + before + ' candidates left.'
          : '<code>hi = mid − 1 = ' + fmt(hi) + '</code>: ' + span('index', mid, n - 1) + ' out. Minus one because <code>mid</code> was just compared and is not ' + xs + '. ' + after + ' of ' + before + ' candidates left.';
      } else {
        cap = p.move === 'right'
          ? '<code>lo = mid + 1 = ' + lo + '</code>: ' + span('position', 0, mid) + ' out. ' + after + ' of ' + before + ' possible positions left.'
          : '<code>hi = mid = ' + hi + '</code>, not <code>mid − 1</code>: position ' + mid + ' could still be the answer. ' + after + ' of ' + before + ' possible positions left.';
      }
      snap('discard', { pointerMid: mid, pointerState: 'muted', line: p.move, flow: p.move, caption: cap });
      mid = -1;
    }

    // ---- end of the loop
    if (!half) {
      snap('check', { line: 'loop', flow: 'loop', caption: '<code>lo &gt; hi</code> (' + fmt(lo) + ' &gt; ' + fmt(hi) + '): no candidates are left.' });
      var missed = -1;
      if (!sorted) missed = a.indexOf(x);
      if (missed >= 0) snap('missed', { line: 'none', flow: 'none', result: -1, noLive: true, error: missed, caption: '<b>Returns −1, but ' + xs + ' IS in the array, at index ' + missed + '.</b> “Everything to the left is smaller” was false because the array is not sorted, so the search threw the target away.' });
      else snap('done', { line: 'none', flow: 'none', result: -1, noLive: true, caption: '<b>' + xs + ' is not in the array.</b> ' + (n === 0 ? 'Nothing to search.' : 'Every position was ruled out by ' + plural(cmps, 'comparison') + (sorted ? '.' : ', though only because sorted order was assumed.')) + ' Return −1.' });
      return steps;
    }
    snap('check', { line: 'loop', flow: 'loop', caption: '<code>lo = hi = ' + lo + '</code>: only one position is possible, so that is the answer.' });
    var b = lo, exists = b < n;
    var boundaryCap = variant === 'lower' || variant === 'first'
      ? 'Lower bound = <b>' + b + '</b>: ' + (exists ? '<code>a[' + b + '] = ' + fmt(a[b]) + '</code> is the first value ≥ ' + xs + ', and every value before it is &lt; ' + xs + '.' : 'every value is &lt; ' + xs + ', so it would go at the very end.')
      : 'Upper bound = <b>' + b + '</b>: ' + (exists ? '<code>a[' + b + '] = ' + fmt(a[b]) + '</code> is the first value &gt; ' + xs + ', and every value before it is ≤ ' + xs + '.' : 'no value is greater than ' + xs + ', so the boundary is the end.');
    if (!cfg.verify) {
      snap('done', { key: exists ? b : undefined, pointerMid: b, pointerName: 'answer', pointerState: 'found', result: b, noLive: true, line: 'done', flow: 'done', showBounds: false, caption: boundaryCap });
      return steps;
    }
    // first / last: one more check
    var idx = variant === 'first' ? b : b - 1, okIdx = idx >= 0 && idx < n && a[idx] === x;
    snap('boundary', { key: exists ? b : undefined, pointerMid: b, pointerName: variant === 'first' ? 'a[lo]' : 'bound', pointerState: 'key', noLive: true, line: 'verify', flow: 'verify', showBounds: false,
      caption: boundaryCap + ' Now check whether ' + xs + ' is really there: ' + (variant === 'first'
        ? (b < n ? 'is <code>a[' + b + '] = ' + fmt(a[b]) + '</code> equal to ' + xs + '?' : 'index ' + b + ' is past the end, so no.')
        : (b > 0 ? 'is <code>a[' + (b - 1) + '] = ' + fmt(a[b - 1]) + '</code> equal to ' + xs + '?' : 'there is no item before index 0, so no.')) });
    if (okIdx) snap('found', { hit: idx, pointerMid: idx, pointerName: 'result', pointerState: 'found', result: idx, noLive: true, line: 'found', flow: 'found', showBounds: false,
      caption: '<b>' + (variant === 'first' ? 'First' : 'Last') + ' occurrence of ' + xs + ': index ' + idx + '.</b> ' + (variant === 'first' ? 'Everything before it is &lt; ' + xs + ', so no earlier copy exists.' : 'Everything after it is &gt; ' + xs + ', so no later copy exists.') });
    else snap('done', { line: 'none', flow: 'none', result: -1, noLive: true, showBounds: false, caption: '<b>' + xs + ' is not in the array</b>: ' + (variant === 'first' ? (b < n ? '<code>a[' + b + ']</code> is not equal to it' : 'there is no item at index ' + b) : (b > 0 ? '<code>a[' + (b - 1) + ']</code> is not equal to it' : 'there is no item before index 0')) + ', and in sorted order every copy of it would sit right at the boundary. Return −1.' });
    return steps;
  }

  /* ------------------------------------------------------------------ linear baseline */
  function linearComparisons(values, x) {
    var a = (values || []).map(valueOf);
    for (var i = 0; i < a.length; i++) if (a[i] === x) return i + 1;
    return a.length;
  }
  function linear(values, target, opts) {
    var a = (values || []).map(valueOf), n = a.length, steps = [], cmps = 0, xs = fmt(target), prefix = (opts && opts.idPrefix) || 'v';
    function snap(kind, o) {
      var items = a.map(function (v, i) {
        var st = i < o.upto ? 'visited' : 'default';
        if (i === o.at) st = o.state || 'compare';
        return { id: prefix + i, value: v, state: st };
      });
      steps.push({ algo: 'linear', kind: kind, items: items,
        pointers: o.at !== undefined && o.at >= 0 ? [{ name: 'i', index: o.at, state: o.state === 'found' ? 'found' : 'compare', side: 'above', id: 'p-i' }] : [],
        regions: [], caption: o.caption, counters: { comparisons: cmps }, result: o.result === undefined ? null : o.result });
    }
    snap('start', { upto: 0, caption: 'Looking for <b>' + xs + '</b> the slow way: start at index 0 and check every value in turn. It works on any array, sorted or not.' });
    for (var i = 0; i < n; i++) {
      cmps++;
      if (a[i] === target) { snap('found', { upto: i, at: i, state: 'found', result: i, caption: '<code>a[' + i + '] = ' + fmt(a[i]) + '</code> matches: <b>found after ' + plural(cmps, 'comparison') + '</b>.' }); return steps; }
      snap('compare', { upto: i, at: i, caption: '<code>a[' + i + '] = ' + fmt(a[i]) + '</code> is not ' + xs + '. ' + (a[i] < target ? 'It is smaller, but linear search does not use that fact: it moves on to the next value.' : 'It is bigger, and linear search still has to check the rest.') });
    }
    snap('done', { upto: n, result: -1, caption: '<b>' + xs + ' is not here</b>, and linear search needed all ' + plural(n, 'comparison') + ' to be sure.' });
    return steps;
  }

  /* ------------------------------------------------------------------ guess the number */
  /* The halving strategy on lo..hi: guess the middle, hear "higher" or "lower". Two steps per guess. */
  function guessSteps(secret, lo, hi) {
    lo = lo === undefined ? 1 : lo; hi = hi === undefined ? 100 : hi;
    var steps = [], size = hi - lo + 1, guesses = 0;
    steps.push({ kind: 'start', lo: lo, hi: hi, guess: null, verdict: null, guesses: 0, remaining: size, caption: 'Pick a number from ' + lo + ' to ' + hi + '. Every one of the ' + size + ' numbers is still possible.' });
    var l = lo, h = hi;
    while (l <= h) {
      var g = l + Math.floor((h - l) / 2);
      guesses++;
      var rem = h - l + 1;
      steps.push({ kind: 'guess', lo: l, hi: h, guess: g, verdict: null, guesses: guesses, remaining: rem, caption: '<b>Guess ' + g + '.</b> The middle of ' + l + ' to ' + h + ', so that either answer will cross out about half of the ' + rem + ' numbers.' });
      if (g === secret) { steps.push({ kind: 'hit', lo: g, hi: g, guess: g, verdict: 'hit', guesses: guesses, remaining: 1, caption: '<b>Correct: ' + g + '</b> in ' + plural(guesses, 'guess', 'guesses') + '.' }); return steps; }
      var verdict;
      if (g < secret) { verdict = 'higher'; l = g + 1; } else { verdict = 'lower'; h = g - 1; }
      steps.push({ kind: 'verdict', lo: l, hi: h, guess: g, verdict: verdict, guesses: guesses, remaining: Math.max(0, h - l + 1),
        caption: '“Too ' + (verdict === 'higher' ? 'low' : 'high') + '.” Everything ' + (verdict === 'higher' ? 'up to ' : 'from ') + g + (verdict === 'higher' ? '' : ' up') + ' is out: <b>' + Math.max(0, h - l + 1) + ' left</b>.' });
    }
    return steps;
  }
  /* Worst case candidates remaining after each comparison: n, floor(n/2), ... 0. */
  function halving(n) {
    var out = [n], r = n;
    while (r > 0) { r = Math.floor(r / 2); out.push(r); }
    return out;
  }

  /* ------------------------------------------------------------------ decision tree */
  function decisionTree(values) {
    var a = (values || []).map(valueOf), n = a.length, nodes = [], index = {};
    function build(lo, hi, depth) {
      if (lo > hi) {
        var gid = 'g' + lo, g = { id: gid, kind: 'gap', gap: lo, depth: depth, lo: lo, hi: hi, comparisons: depth };
        nodes.push(g); index[gid] = g; return gid;
      }
      var mid = lo + Math.floor((hi - lo) / 2), id = 'n' + mid;
      var node = { id: id, kind: 'node', index: mid, value: a[mid], depth: depth, comparisons: depth + 1, lo: lo, hi: hi };
      nodes.push(node); index[id] = node;
      node.left = build(lo, mid - 1, depth + 1);
      node.right = build(mid + 1, hi, depth + 1);
      return id;
    }
    var root = build(0, n - 1, 0);
    return { root: root, nodes: nodes, index: index, n: n, values: a, height: nodes.reduce(function (m, d) { return d.kind === 'node' ? Math.max(m, d.depth + 1) : m; }, 0) };
  }
  /* Nodes visited when searching for x in distinct sorted values, and where the path ends. */
  function treePath(tree, x) {
    var path = [], id = tree.root;
    while (id) {
      var d = tree.index[id];
      if (d.kind === 'gap') { path.push({ id: id, cmp: null }); return { path: path, end: id, found: false }; }
      var c = x === d.value ? '=' : x < d.value ? '<' : '>';
      path.push({ id: id, cmp: c });
      if (c === '=') return { path: path, end: id, found: true };
      id = c === '<' ? d.left : d.right;
    }
    return { path: path, end: null, found: false };
  }
  function treeSteps(values, x) {
    var tree = decisionTree(values), tp = treePath(tree, x), a = tree.values, steps = [], xs = fmt(x);
    function nodeList(activeId, visitedIds, endState) {
      return tree.nodes.map(function (d) {
        var st = 'default';
        if (d.kind === 'gap') st = 'muted';
        if (visitedIds.indexOf(d.id) >= 0) st = 'visited';
        if (d.id === activeId) st = endState || 'active';
        var o = { id: d.id, value: d.kind === 'gap' ? null : d.value, label: d.kind === 'gap' ? '∅' : fmt(d.value), left: d.left, right: d.right, state: st };
        if (d.kind === 'gap') { o.badge = String(d.comparisons); o.badgeState = d.id === activeId ? endState : 'muted'; }
        return o;
      });
    }
    function edgeStates(upto) {
      var e = {};
      for (var k = 0; k < upto; k++) e[tp.path[k].id + '-' + tp.path[k + 1].id] = 'path';
      return e;
    }
    steps.push({ kind: 'start', nodes: nodeList(null, []), root: tree.root, edges: {}, comparisons: 0,
      caption: 'Every possible search on ' + plural(tree.n, 'value') + ', drawn as one tree. The root is the first probe: the middle item. Now search for <b>' + xs + '</b>.' });
    tp.path.forEach(function (p, k) {
      var d = tree.index[p.id], visited = tp.path.slice(0, k).map(function (q) { return q.id; });
      if (d.kind === 'gap') {
        steps.push({ kind: 'end', nodes: nodeList(p.id, visited, 'error'), root: tree.root, edges: edgeStates(k), comparisons: k, end: p.id,
          caption: '<b>' + xs + ' is not in the array.</b> The path fell off the tree after ' + plural(k, 'comparison') + ' into a gap: ' + gapText(a, d.gap) + '. Every absent target ends in one of the ' + (tree.n + 1) + ' gaps.' });
        return;
      }
      var cap = p.cmp === '='
        ? 'Compare with <b>' + fmt(d.value) + '</b>: equal. <b>Found in ' + plural(k + 1, 'comparison') + '</b>, at level ' + (k + 1) + ' of the tree.'
        : 'Compare with <b>' + fmt(d.value) + '</b>: ' + xs + (p.cmp === '<' ? ' is smaller, so go <b>left</b>' : ' is bigger, so go <b>right</b>') + '. Everything on the other branch is ruled out.';
      steps.push({ kind: p.cmp === '=' ? 'hit' : 'compare', nodes: nodeList(p.id, visited, p.cmp === '=' ? 'found' : undefined), root: tree.root, edges: edgeStates(k), comparisons: k + 1, end: p.cmp === '=' ? p.id : null, caption: cap });
    });
    return steps;
  }
  function gapText(a, k) {
    if (!a.length) return 'the array is empty';
    if (k === 0) return 'smaller than ' + fmt(a[0]);
    if (k === a.length) return 'larger than ' + fmt(a[a.length - 1]);
    return 'between ' + fmt(a[k - 1]) + ' and ' + fmt(a[k]);
  }

  /* ------------------------------------------------------------------ binary search on the answer */
  function daysNeeded(weights, cap) {
    var days = 1, load = 0, groups = [[]];
    weights.forEach(function (w) {
      if (load + w > cap) { days++; load = 0; groups.push([]); }
      load += w; groups[groups.length - 1].push(w);
    });
    return { days: days, groups: groups };
  }
  function problemInfo(problem) {
    if (problem.kind === 'ship') {
      var w = problem.weights, mx = Math.max.apply(null, w), sum = w.reduce(function (s, v) { return s + v; }, 0);
      return { lo: mx, hi: sum, label: 'capacity',
        pred: function (c) { return daysNeeded(w, c).days <= problem.days; },
        explain: function (c) {
          var r = daysNeeded(w, c);
          return 'Pack the parcels in order, starting a new day whenever the next one would not fit under ' + c + ': ' + r.groups.map(function (g) { return g.reduce(function (s, v) { return s + v; }, 0); }).join(' | ') + ' → <b>' + plural(r.days, 'day') + '</b>' + (r.days <= problem.days ? ' ≤ ' + problem.days + ', so <b>true</b>' : ' &gt; ' + problem.days + ', so <b>false</b>') + '.';
        },
        answerText: function (v) { return 'The smallest capacity that ships everything in ' + problem.days + ' days is <b>' + v + '</b>.'; } };
    }
    var x = problem.x;
    return { lo: 0, hi: x + 1, label: 'm',
      pred: function (m) { return m * m > x; },
      explain: function (m) { return '<code>' + m + '² = ' + (m * m) + '</code> is ' + (m * m > x ? '<b>greater than</b> ' + x + ', so <b>true</b>: ' + m + ' is too big' : 'at most ' + x + ', so <b>false</b>: ' + m + ' is not too big') + '.'; },
      answerText: function (v) { return 'The first m with m² &gt; ' + x + ' is ' + v + ', so the integer square root is <b>' + (v - 1) + '</b>.'; } };
  }
  function answerSteps(problem) {
    var info = problemInfo(problem), lo = info.lo, hi = info.hi, base = info.lo, steps = [], evals = 0, evaluated = [];
    var n = hi - lo + 1;
    function snap(kind, o) {
      o = o || {};
      steps.push({ kind: kind, base: base, size: n, lo: lo, hi: hi, mid: o.mid === undefined ? null : o.mid, probe: o.probe === undefined ? null : o.probe,
        evaluated: evaluated.slice(), label: info.label, done: !!o.done, answer: o.answer === undefined ? null : o.answer,
        caption: o.caption, line: o.line === undefined ? null : o.line,
        vars: { lo: lo, hi: hi, mid: o.mid === undefined ? NA : o.mid, 'p(mid)': o.probe === undefined || o.probe === null ? NA : o.probe },
        varStates: { lo: 'active', hi: 'active', mid: 'compare' },
        counters: { evaluations: evals, left: Math.max(0, hi - lo) + 1 } });
    }
    var pName = problem.kind === 'ship' ? 'can ship in ' + problem.days + ' days?' : 'm² > ' + problem.x + '?';
    snap('start', { line: 'init', caption: problem.kind === 'ship'
      ? 'The answer is a capacity between <b>' + lo + '</b> (the heaviest parcel: anything smaller can never ship it) and <b>' + hi + '</b> (everything in one day: certainly enough). The test “' + pName + '” is false for small capacities and true for large ones, and never flips back.'
      : 'The answer is near the square root of ' + problem.x + '. Test each m with “' + pName + '”: false for small m, true once m is big enough, and never back. The first true m is one too far.' });
    while (lo < hi) {
      var mid = lo + Math.floor((hi - lo) / 2);
      snap('mid', { mid: mid, line: 'mid', caption: 'Probe the middle candidate, <code>mid = ' + mid + '</code>: ' + (hi - lo + 1) + ' candidates from ' + lo + ' to ' + hi + ' (the right end, ' + hi + ', is known to be true).' });
      var p = info.pred(mid);
      evals++; evaluated.push(mid - base);
      snap('test', { mid: mid, probe: p, line: 'test', caption: info.explain(mid) });
      if (p) { hi = mid; snap('discard', { mid: mid, probe: p, line: 'true', caption: 'True at <code>' + mid + '</code>, so every bigger candidate is true too (monotonic). The first true is <code>' + mid + '</code> or earlier: <code>hi = mid</code>.' }); }
      else { lo = mid + 1; snap('discard', { mid: mid, probe: p, line: 'false', caption: 'False at <code>' + mid + '</code>, so every smaller candidate is false too (monotonic). The first true is later: <code>lo = mid + 1 = ' + lo + '</code>.' }); }
    }
    var ans = problem.kind === 'ship' ? lo : lo - 1;
    snap('done', { done: true, answer: ans, line: 'done', caption: info.answerText(lo) + ' It took only <b>' + evals + '</b> tests out of ' + n + ' candidates.' });
    return steps;
  }
  function answerBrute(problem) {
    var info = problemInfo(problem);
    for (var c = info.lo; c <= info.hi; c++) if (info.pred(c)) return problem.kind === 'ship' ? c : c - 1;
    return null;
  }
  var ANSWER_CODE = {
    pseudo: [
      'procedure firstTrue(lo, hi, p)          // @init',
      '  while lo < hi                          // @loop',
      '    mid ← lo + (hi − lo) div 2           // @mid',
      '    if p(mid) then                       // @test',
      '      hi ← mid                           // @true',
      '    else',
      '      lo ← mid + 1                       // @false',
      '  return lo                              // @done'
    ].join('\n'),
    js: [
      'function firstTrue(lo, hi, p) {   // @init',
      '  while (lo < hi) {                              // @loop',
      '    const mid = lo + Math.floor((hi - lo) / 2);  // @mid',
      '    if (p(mid)) {                                // @test',
      '      hi = mid;                                  // @true',
      '    } else {',
      '      lo = mid + 1;                              // @false',
      '    }',
      '  }',
      '  return lo;                                     // @done',
      '}'
    ].join('\n'),
    py: [
      'def first_true(lo, hi, p):    # @init',
      '    while lo < hi:                     # @loop',
      '        mid = lo + (hi - lo) // 2      # @mid',
      '        if p(mid):                     # @test',
      '            hi = mid                   # @true',
      '        else:',
      '            lo = mid + 1               # @false',
      '    return lo                          # @done'
    ].join('\n')
  };

  /* ------------------------------------------------------------------ bisection on a function */
  function bisection(f, lo, hi, iters) {
    var steps = [], flo = f(lo), fhi = f(hi);
    steps.push({ kind: 'start', lo: lo, hi: hi, mid: null, fmid: null, width: hi - lo, iter: 0,
      caption: 'f changes sign on [' + lo + ', ' + hi + ']: f(' + lo + ') = ' + trim(flo) + ' is negative and f(' + hi + ') = ' + trim(fhi) + ' is positive. A continuous curve must cross zero in between.' });
    for (var k = 1; k <= iters; k++) {
      var mid = (lo + hi) / 2, fm = f(mid);
      steps.push({ kind: 'probe', lo: lo, hi: hi, mid: mid, fmid: fm, width: hi - lo, iter: k,
        caption: 'Probe the middle, x = ' + trim(mid) + ': f = ' + trim(fm) + (fm < 0 ? ' is negative, so the root is to the right.' : fm > 0 ? ' is positive, so the root is to the left.' : ' is zero: an exact root.') });
      if (fm === 0) { steps.push({ kind: 'done', lo: mid, hi: mid, mid: mid, fmid: 0, width: 0, iter: k, caption: 'Exactly zero at x = ' + trim(mid) + '.' }); return steps; }
      if (fm < 0) lo = mid; else hi = mid;
      steps.push({ kind: 'halve', lo: lo, hi: hi, mid: mid, fmid: fm, width: hi - lo, iter: k, caption: 'The interval is now [' + trim(lo) + ', ' + trim(hi) + '], half as wide: <b>' + trim(hi - lo) + '</b>. Each probe gains one more correct binary digit of the root.' });
    }
    return steps;
    function trim(v) { return String(Math.round(v * 1e6) / 1e6); }
  }

  /* ------------------------------------------------------------------ the classic bugs */
  function wrap32(v) { return v | 0; }
  function midNaive(lo, hi) { return Math.trunc(wrap32(wrap32(lo) + wrap32(hi)) / 2); }   // (lo + hi) / 2 in 32-bit ints
  function midSafe(lo, hi) { return lo + Math.trunc((hi - lo) / 2); }

  var BUG_CODE = {
    loop: {
      bug: {
        js: [
          'function lowerBound(a, x) {',
          '  let lo = 0, hi = a.length - 1;      // @init',
          '  while (lo < hi) {                   // @loop',
          '    const mid = (lo + hi) >> 1;       // @mid',
          '    if (a[mid] < x) {                 // @cmp',
          '      lo = mid;                       // @right   ← BUG',
          '    } else {',
          '      hi = mid;                       // @left',
          '    }',
          '  }',
          '  return lo;                          // @done',
          '}'
        ].join('\n'),
        py: [
          'def lower_bound(a, x):',
          '    lo, hi = 0, len(a) - 1            # @init',
          '    while lo < hi:                    # @loop',
          '        mid = (lo + hi) // 2          # @mid',
          '        if a[mid] < x:                # @cmp',
          '            lo = mid                  # @right   ← BUG',
          '        else:',
          '            hi = mid                  # @left',
          '    return lo                         # @done'
        ].join('\n')
      },
      fix: {
        js: [
          'function lowerBound(a, x) {',
          '  let lo = 0, hi = a.length - 1;      // @init',
          '  while (lo < hi) {                   // @loop',
          '    const mid = (lo + hi) >> 1;       // @mid',
          '    if (a[mid] < x) {                 // @cmp',
          '      lo = mid + 1;                   // @right   ← fixed',
          '    } else {',
          '      hi = mid;                       // @left',
          '    }',
          '  }',
          '  return lo;                          // @done',
          '}'
        ].join('\n'),
        py: [
          'def lower_bound(a, x):',
          '    lo, hi = 0, len(a) - 1            # @init',
          '    while lo < hi:                    # @loop',
          '        mid = (lo + hi) // 2          # @mid',
          '        if a[mid] < x:                # @cmp',
          '            lo = mid + 1              # @right   ← fixed',
          '        else:',
          '            hi = mid                  # @left',
          '    return lo                         # @done'
        ].join('\n')
      }
    },
    last: {
      bug: {
        js: [
          'function binarySearch(a, x) {',
          '  let lo = 0, hi = a.length - 1;      // @init',
          '  while (lo < hi) {                   // @loop   ← BUG',
          '    const mid = (lo + hi) >> 1;       // @mid',
          '    if (a[mid] === x) return mid;     // @cmp @found',
          '    if (a[mid] < x) lo = mid + 1;     // @right',
          '    else hi = mid - 1;                // @left',
          '  }',
          '  return -1;                          // @none',
          '}'
        ].join('\n'),
        py: [
          'def binary_search(a, x):',
          '    lo, hi = 0, len(a) - 1            # @init',
          '    while lo < hi:                    # @loop   ← BUG',
          '        mid = (lo + hi) // 2          # @mid',
          '        if a[mid] == x:               # @cmp',
          '            return mid                # @found',
          '        if a[mid] < x: lo = mid + 1   # @right',
          '        else: hi = mid - 1            # @left',
          '    return -1                         # @none'
        ].join('\n')
      },
      fix: {
        js: [
          'function binarySearch(a, x) {',
          '  let lo = 0, hi = a.length - 1;      // @init',
          '  while (lo <= hi) {                  // @loop   ← fixed',
          '    const mid = (lo + hi) >> 1;       // @mid',
          '    if (a[mid] === x) return mid;     // @cmp @found',
          '    if (a[mid] < x) lo = mid + 1;     // @right',
          '    else hi = mid - 1;                // @left',
          '  }',
          '  return -1;                          // @none',
          '}'
        ].join('\n'),
        py: [
          'def binary_search(a, x):',
          '    lo, hi = 0, len(a) - 1            # @init',
          '    while lo <= hi:                   # @loop   ← fixed',
          '        mid = (lo + hi) // 2          # @mid',
          '        if a[mid] == x:               # @cmp',
          '            return mid                # @found',
          '        if a[mid] < x: lo = mid + 1   # @right',
          '        else: hi = mid - 1            # @left',
          '    return -1                         # @none'
        ].join('\n')
      }
    }
  };
  // both bug panels also show pseudocode-free code; the panel uses js + py only

  /* kind 'loop':  lower bound with `lo = mid` (never advances when hi = lo + 1).
     kind 'last':  exact search whose loop test is `lo < hi`: the last candidate is never inspected.
     fixed: the corrected loop. The buggy 'loop' trace stops after `cap` rounds with a final 'stuck' step. */
  function bugSteps(kind, values, target, fixed, cap) {
    var a = (values || []).map(valueOf), n = a.length, x = target, xs = fmt(x), steps = [], cmps = 0, rounds = 0;
    cap = cap || 3;
    var lo = 0, hi = n - 1, mid = -1, stuckAt = null;
    function snap(k, o) {
      o = o || {};
      var items = a.map(function (v, i) {
        var st = 'default';
        if (i < lo || i > hi) st = 'muted';
        if (o.midState && i === mid) st = o.midState;
        if (o.hit !== undefined && i === o.hit) st = 'found';
        if (o.error !== undefined && i === o.error) st = 'error';
        return { id: 'b' + i, value: v, state: st };
      });
      var pointers = [{ name: 'lo', index: lo, state: o.stuck ? 'error' : 'active', side: 'below', id: 'p-lo' }, { name: 'hi', index: hi, state: 'active', side: 'below', id: 'p-hi' }];
      if (mid >= 0 && o.showMid !== false) pointers.push({ name: 'mid', index: mid, state: 'compare', side: 'above', id: 'p-mid' });
      steps.push({ algo: 'bug', bug: kind, fixed: !!fixed, kind: k, items: items, pointers: pointers,
        regions: hi >= lo ? [{ id: 'rv', from: Math.max(lo, 0), to: Math.min(hi, n - 1), state: o.stuck ? 'error' : 'active', label: o.stuck ? 'never shrinks' : 'candidates' }] : [],
        caption: o.caption, line: o.line === undefined ? null : o.line,
        vars: { lo: lo, hi: hi, mid: mid >= 0 ? mid : NA, x: x },
        varStates: { lo: 'active', hi: 'active', mid: 'compare' },
        counters: { rounds: rounds, comparisons: cmps }, result: o.result === undefined ? null : o.result });
    }
    var tail = kind === 'loop' ? 'the first index whose value is ≥ ' + xs : xs;
    snap('start', { line: 'init', caption: 'Searching ' + plural(n, 'value') + ' for ' + tail + (fixed ? ' with the <b>fixed</b> code.' : ' with the <b>buggy</b> code.') });
    if (kind === 'loop') {
      while (lo < hi) {
        rounds++;
        snap('check', { line: 'loop', caption: '<code>lo &lt; hi</code> (' + lo + ' &lt; ' + hi + '), so go round again' + (rounds > 1 ? ' (round ' + rounds + ')' : '') + '.' });
        mid = (lo + hi) >> 1;
        snap('mid', { midState: 'compare', line: 'mid', caption: '<code>mid = (' + lo + ' + ' + hi + ') &gt;&gt; 1 = ' + mid + '</code>. The middle rounds <b>down</b>, so it can equal <code>lo</code>.' });
        cmps++;
        var less = a[mid] < x;
        snap('compare', { midState: 'compare', line: 'cmp', caption: '<code>a[' + mid + '] = ' + fmt(a[mid]) + '</code> is ' + (less ? '' : 'not ') + 'less than ' + xs + '.' });
        var oldLo = lo, oldHi = hi;
        if (less) lo = fixed ? mid + 1 : mid; else hi = mid;
        if (!fixed && lo === oldLo && hi === oldHi) {
          snap('discard', { line: 'right', caption: '<code>lo = mid = ' + lo + '</code>. That is the value <code>lo</code> already had: <b>nothing moved</b>. The state is exactly what it was at the start of this round.' });
          if (rounds >= cap) {
            mid = -1;
            snap('stuck', { stuck: true, showMid: false, line: 'loop', caption: '<b>Stuck.</b> <code>lo</code> and <code>hi</code> are the same as ' + (rounds > 1 ? 'a round ago' : 'before') + ', so every later round repeats this one. The loop never ends: the program hangs. Switch to the fixed code to see the difference.' });
            return steps;
          }
        } else {
          snap('discard', { line: less ? 'right' : 'left', caption: less ? '<code>lo = mid + 1 = ' + lo + '</code>: the range shrinks.' : '<code>hi = mid = ' + hi + '</code>: the range shrinks.' });
        }
        mid = -1;
      }
      snap('check', { line: 'loop', caption: '<code>lo = hi = ' + lo + '</code>: the loop ends.' });
      snap('done', { line: 'done', result: lo, hit: lo, showMid: false, caption: '<b>Returns ' + lo + '</b>: the first index whose value is ≥ ' + xs + '. With <code>lo = mid + 1</code> the range shrinks every round, so the loop always ends.' });
      return steps;
    }
    // kind 'last': the last candidate is never inspected when the loop test is lo < hi
    var cond = fixed ? function () { return lo <= hi; } : function () { return lo < hi; };
    while (cond()) {
      rounds++;
      snap('check', { line: 'loop', caption: fixed ? '<code>lo ≤ hi</code> (' + lo + ' ≤ ' + hi + '): a candidate remains.' : '<code>lo &lt; hi</code> (' + lo + ' &lt; ' + hi + '): more than one candidate remains.' });
      mid = (lo + hi) >> 1;
      snap('mid', { midState: 'compare', line: 'mid', caption: '<code>mid = ' + mid + '</code>.' });
      cmps++;
      if (a[mid] === x) { snap('compare', { midState: 'compare', line: 'cmp', caption: '<code>a[' + mid + '] = ' + fmt(a[mid]) + '</code> equals ' + xs + '.' }); snap('found', { hit: mid, line: 'found', result: mid, caption: '<b>Found ' + xs + ' at index ' + mid + '.</b>' }); return steps; }
      var right = a[mid] < x;
      snap('compare', { midState: 'compare', line: 'cmp', caption: '<code>a[' + mid + '] = ' + fmt(a[mid]) + '</code> is ' + (right ? 'less' : 'greater') + ' than ' + xs + '.' });
      if (right) lo = mid + 1; else hi = mid - 1;
      snap('discard', { line: right ? 'right' : 'left', caption: right ? '<code>lo = mid + 1 = ' + lo + '</code>.' : '<code>hi = mid − 1 = ' + hi + '</code>.' });
      mid = -1;
    }
    var truth = a.indexOf(x);
    if (fixed) snap('check', { line: 'loop', caption: '<code>lo &gt; hi</code> (' + lo + ' &gt; ' + hi + '): no candidates left.' });
    else snap('check', { line: 'loop', caption: '<code>lo &lt; hi</code> is false (' + lo + ' = ' + hi + '): the loop ends <b>with one candidate still uninspected</b>, index ' + lo + '.' });
    snap('none', { line: 'none', result: -1, error: truth >= 0 ? truth : undefined, caption: truth >= 0
      ? '<b>Returns −1, but ' + xs + ' is at index ' + truth + '.</b> The very last candidate was never compared. The test must be <code>lo ≤ hi</code>: when <code>lo = hi</code> one candidate is still alive.'
      : '<b>Returns −1</b>: ' + xs + ' is not in the array.' });
    return steps;
  }

  return {
    search: search, probes: probes, count: count, worstCase: worstCase, worstMeasured: worstMeasured, floorLog2: floorLog2,
    linear: linear, linearComparisons: linearComparisons,
    guessSteps: guessSteps, halving: halving,
    decisionTree: decisionTree, treePath: treePath, treeSteps: treeSteps, gapText: gapText,
    answerSteps: answerSteps, answerBrute: answerBrute, problemInfo: problemInfo, daysNeeded: daysNeeded, ANSWER_CODE: ANSWER_CODE,
    bisection: bisection,
    bugSteps: bugSteps, BUG_CODE: BUG_CODE, wrap32: wrap32, midNaive: midNaive, midSafe: midSafe,
    isSorted: isSorted, CODE: CODE, VARIANTS: VARIANTS, VARIANT_ORDER: ['exact', 'lower', 'upper', 'first', 'last']
  };
}));
