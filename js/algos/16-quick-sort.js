/* Quick sort & quickselect: pure step generators (lesson 16). No DOM. UMD: in the browser this merges into
   VDSA.algos.sorting (lesson 14 and 15 add their own names to the same object, so only NEW names are exported here);
   in Node it exports the same API.

     quickLomuto(values, opts)   -> steps   full quick sort, Lomuto partition (pivot parked at the end, one scan pointer)
     quickHoare(values, opts)    -> steps   full quick sort, Hoare partition (two pointers walking inwards)
     quickThree(values, opts)    -> steps   full quick sort, three-way (Dutch national flag) partition
     partitionLomuto(values, opts) / partitionHoare(values, opts)  -> steps of ONE partition of the whole array
     dutchFlag(values, opts)     -> steps   one three-way partition around the value 1 of an array of 0s, 1s and 2s
                                            (opts.flag: true colours the items red / white / blue instead of states)
     quickselect(values, k, opts)-> steps   k-th smallest (k = 1..n), recursing into one side only
     quickselectCount(values, k, opts) -> {comparisons, swaps, partitions, result}
     quickCount(values, opts)    -> {comparisons, swaps, depth, stackDepth, calls, nodes?}   fast counts, same rules as the steps
     quickTree(values, opts)     -> {nodes, comparisons, depth}   recursion-tree shape (preorder), Lomuto by default
     raceMerge(values)           -> steps   a merge sort trace in the same shape (for the race figure)
     workFrames(steps)           -> steps at which one more comparison or move happened (a fair race clock)
     pickPivotIndex(values, lo, hi, strategy, rnd) -> {index, cands, cost}
     CODE_QUICK[name], META_QUICK[name]  -> code (pseudo / js / py, with // @labels matching step.line) and facts

   opts: {pivot: 'last' | 'first' | 'middle' | 'random' | 'median3', seed: 1, idPrefix: 'v', once: false}
   values: numbers, or {value, label, id} objects (labels tag equal keys, e.g. 'a', 'b').

   Every step is a complete snapshot that VDSA.views.array can draw directly:
     { algo, kind, range: [lo, hi],
       items: [{id, value, state, label?}], held, ghosts, pointers, regions,
       order: [id], final: [slot, ...],          positions proven final (their item never moves again)
       tree: {root, nodes},  frames: [...],      recursion tree so far, and the calls still running (call stack)
       caption, line, flow, vars, varStates, counters: {comparisons, swaps}, ops }
   Truth rules (tested in tests/algos/16-quick-sort.test.js): an item is 'done' only at a position proven final (a
   Lomuto pivot after it is placed, a singleton call, the equal zone of a three-way partition, everything at the end);
   Hoare's pivot is NOT final after a partition, so it is never marked done; outside the current range items are muted;
   counters only grow; the counts equal quickCount's. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.sorting = Object.assign(V.algos.sorting || {}, api);
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ shared helpers */
  var NA = { __vdsaRaw: true, text: '–', type: 'undef' };

  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(it) {
    if (it.label === undefined || it.label === null || it.label === '') return fmt(it.value);
    var l = String(it.label);
    return fmt(it.value) + (/^[a-z]$/i.test(l) ? '<sub>' + esc(l) + '</sub>' : esc(l));
  }
  function b(it) { return '<b>' + name(it) + '</b>'; }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }

  function normalize(values, prefix) {
    prefix = prefix === undefined ? 'v' : prefix;
    return (values || []).map(function (v, i) {
      if (v !== null && typeof v === 'object') {
        var o = { id: v.id !== undefined ? String(v.id) : prefix + i, value: v.value };
        if (v.label !== undefined && v.label !== null && v.label !== '') o.label = String(v.label);
        return o;
      }
      return { id: prefix + i, value: v };
    });
  }
  function valueOf(x) { return x !== null && typeof x === 'object' ? x.value : x; }
  function cell(it, state) {
    var o = { id: it.id, value: it.value, state: state || 'default' };
    if (it.label !== undefined) o.label = it.label;
    return o;
  }
  function range(lo, hi) { var out = []; for (var k = lo; k <= hi; k++) out.push(k); return out; }
  function mulberry(seed) {
    var s = (seed === undefined ? 1 : seed) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ pivot choice (shared by steps and counts) */
  var STRATEGIES = ['last', 'first', 'middle', 'random', 'median3'];
  /* The index (lo..hi) of the pivot. Median of three looks at a[lo], a[mid], a[hi] and costs 3 comparisons
     (only when the range has at least 3 values). Random consumes one number from rnd, only for ranges of 2+. */
  function pickPivotIndex(values, lo, hi, strategy, rnd) {
    var n = hi - lo + 1, mid = lo + ((hi - lo) >> 1), idx;
    strategy = strategy || 'last';
    if (STRATEGIES.indexOf(strategy) < 0) throw new Error('Unknown pivot strategy: ' + strategy);
    if (strategy === 'first') idx = lo;
    else if (strategy === 'middle') idx = mid;
    else if (strategy === 'random') idx = n < 2 ? lo : lo + Math.floor((rnd || Math.random)() * n);
    else if (strategy === 'median3' && n >= 3) {
      var c = [lo, mid, hi].sort(function (x, y) { return (valueOf(values[x]) - valueOf(values[y])) || (x - y); });
      return { index: c[1], cands: [lo, mid, hi], cost: 3 };
    } else idx = hi;
    return { index: idx, cands: null, cost: 0 };
  }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE_QUICK = {
    lomuto: {
      pseudo: [
        'procedure quicksort(a, lo, hi)',
        '  if lo ≥ hi then return                  // @base',
        '  p ← partition(a, lo, hi)                // @call',
        '  quicksort(a, lo, p − 1)                 // @left',
        '  quicksort(a, p + 1, hi)                 // @right',
        '',
        'procedure partition(a, lo, hi)',
        '  move the chosen pivot to a[hi]          // @pivot',
        '  pivot ← a[hi]',
        '  i ← lo − 1                              // @init',
        '  for j ← lo to hi − 1                    // @scan',
        '    if a[j] ≤ pivot then                  // @cmp',
        '      i ← i + 1                           // @small',
        '      swap a[i] and a[j]                  // @small',
        '  swap a[i + 1] and a[hi]                 // @place',
        '  return i + 1                            // @place'
      ].join('\n'),
      js: [
        'function quickSort(a, lo = 0, hi = a.length - 1) {',
        '  if (lo >= hi) return;                          // @base',
        '  const p = partition(a, lo, hi);                // @call',
        '  quickSort(a, lo, p - 1);                       // @left',
        '  quickSort(a, p + 1, hi);                       // @right',
        '}',
        '',
        'function partition(a, lo, hi) {',
        '  choosePivot(a, lo, hi);  // parks it at a[hi]  // @pivot',
        '  const pivot = a[hi];',
        '  let i = lo - 1;                                // @init',
        '  for (let j = lo; j < hi; j++) {                // @scan',
        '    if (a[j] <= pivot) {                         // @cmp',
        '      i++;                                       // @small',
        '      [a[i], a[j]] = [a[j], a[i]];               // @small',
        '    }',
        '  }',
        '  [a[i + 1], a[hi]] = [a[hi], a[i + 1]];         // @place',
        '  return i + 1;                                  // @place',
        '}'
      ].join('\n'),
      py: [
        'def quick_sort(a, lo=0, hi=None):',
        '    if hi is None:',
        '        hi = len(a) - 1',
        '    if lo >= hi:                                 # @base',
        '        return',
        '    p = partition(a, lo, hi)                     # @call',
        '    quick_sort(a, lo, p - 1)                     # @left',
        '    quick_sort(a, p + 1, hi)                     # @right',
        '',
        'def partition(a, lo, hi):',
        '    choose_pivot(a, lo, hi)  # parks it at a[hi]  # @pivot',
        '    pivot = a[hi]',
        '    i = lo - 1                                   # @init',
        '    for j in range(lo, hi):                      # @scan',
        '        if a[j] <= pivot:                        # @cmp',
        '            i += 1                               # @small',
        '            a[i], a[j] = a[j], a[i]              # @small',
        '    a[i + 1], a[hi] = a[hi], a[i + 1]            # @place',
        '    return i + 1                                 # @place'
      ].join('\n')
    },
    hoare: {
      pseudo: [
        'procedure quicksort(a, lo, hi)',
        '  if lo ≥ hi then return                  // @base',
        '  p ← partition(a, lo, hi)                // @call',
        '  quicksort(a, lo, p)                     // @left',
        '  quicksort(a, p + 1, hi)                 // @right',
        '',
        'procedure partition(a, lo, hi)',
        '  move the chosen pivot to a[lo]          // @pivot',
        '  pivot ← a[lo]',
        '  i ← lo;  j ← hi                         // @init',
        '  loop forever                            // @loop',
        '    while a[i] < pivot do i ← i + 1       // @scanI',
        '    while a[j] > pivot do j ← j − 1       // @scanJ',
        '    if i ≥ j then return j                // @cross',
        '    swap a[i] and a[j]                    // @swap',
        '    i ← i + 1;  j ← j − 1                 // @swap'
      ].join('\n'),
      js: [
        'function quickSort(a, lo = 0, hi = a.length - 1) {',
        '  if (lo >= hi) return;                          // @base',
        '  const p = partition(a, lo, hi);                // @call',
        '  quickSort(a, lo, p);                           // @left',
        '  quickSort(a, p + 1, hi);                       // @right',
        '}',
        '',
        'function partition(a, lo, hi) {',
        '  choosePivot(a, lo, hi);  // parks it at a[lo]  // @pivot',
        '  const pivot = a[lo];',
        '  let i = lo, j = hi;                            // @init',
        '  while (true) {                                 // @loop',
        '    while (a[i] < pivot) i++;                    // @scanI',
        '    while (a[j] > pivot) j--;                    // @scanJ',
        '    if (i >= j) return j;                        // @cross',
        '    [a[i], a[j]] = [a[j], a[i]];                 // @swap',
        '    i++; j--;                                    // @swap',
        '  }',
        '}'
      ].join('\n'),
      py: [
        'def quick_sort(a, lo=0, hi=None):',
        '    if hi is None:',
        '        hi = len(a) - 1',
        '    if lo >= hi:                                 # @base',
        '        return',
        '    p = partition(a, lo, hi)                     # @call',
        '    quick_sort(a, lo, p)                         # @left',
        '    quick_sort(a, p + 1, hi)                     # @right',
        '',
        'def partition(a, lo, hi):',
        '    choose_pivot(a, lo, hi)  # parks it at a[lo]  # @pivot',
        '    pivot = a[lo]',
        '    i, j = lo, hi                                # @init',
        '    while True:                                  # @loop',
        '        while a[i] < pivot:                      # @scanI',
        '            i += 1                               # @scanI',
        '        while a[j] > pivot:                      # @scanJ',
        '            j -= 1                               # @scanJ',
        '        if i >= j:                               # @cross',
        '            return j                             # @cross',
        '        a[i], a[j] = a[j], a[i]                  # @swap',
        '        i += 1                                   # @swap',
        '        j -= 1                                   # @swap'
      ].join('\n')
    },
    three: {
      pseudo: [
        'procedure partition3(a, lo, hi, pivot)',
        '  lt ← lo;  i ← lo;  gt ← hi              // @init',
        '  while i ≤ gt                            // @loop',
        '    if a[i] < pivot then                  // @cmp',
        '      swap a[lt] and a[i]                 // @less',
        '      lt ← lt + 1;  i ← i + 1             // @less',
        '    else if a[i] > pivot then             // @cmp',
        '      swap a[i] and a[gt]                 // @greater',
        '      gt ← gt − 1                         // @greater',
        '    else                                  // @equal',
        '      i ← i + 1                           // @equal',
        '  return (lt, gt)                         // @done'
      ].join('\n'),
      js: [
        'function partition3(a, lo, hi, pivot) {',
        '  let lt = lo, i = lo, gt = hi;                  // @init',
        '  while (i <= gt) {                              // @loop',
        '    if (a[i] < pivot) {                          // @cmp',
        '      [a[lt], a[i]] = [a[i], a[lt]];             // @less',
        '      lt++; i++;                                 // @less',
        '    } else if (a[i] > pivot) {                   // @cmp',
        '      [a[i], a[gt]] = [a[gt], a[i]];             // @greater',
        '      gt--;                                      // @greater',
        '    } else {',
        '      i++;                                       // @equal',
        '    }',
        '  }',
        '  return [lt, gt];                               // @done',
        '}'
      ].join('\n'),
      py: [
        'def partition3(a, lo, hi, pivot):',
        '    lt, i, gt = lo, lo, hi                       # @init',
        '    while i <= gt:                               # @loop',
        '        if a[i] < pivot:                         # @cmp',
        '            a[lt], a[i] = a[i], a[lt]            # @less',
        '            lt += 1                              # @less',
        '            i += 1                               # @less',
        '        elif a[i] > pivot:                       # @cmp',
        '            a[i], a[gt] = a[gt], a[i]            # @greater',
        '            gt -= 1                              # @greater',
        '        else:',
        '            i += 1                               # @equal',
        '    return lt, gt                                # @done'
      ].join('\n')
    },
    select: {
      pseudo: [
        'procedure quickselect(a, k)               // k-th smallest, k = 1..n',
        '  lo ← 0;  hi ← n − 1;  target ← k − 1    // @init',
        '  while lo < hi                           // @loop',
        '    p ← partition(a, lo, hi)              // @call',
        '    if p = target then return a[p]        // @hit',
        '    if target < p then hi ← p − 1         // @left',
        '    else lo ← p + 1                       // @right',
        '  return a[lo]                            // @last',
        '',
        'procedure partition(a, lo, hi)',
        '  move the chosen pivot to a[hi]          // @pivot',
        '  pivot ← a[hi]',
        '  i ← lo − 1                              // @pinit',
        '  for j ← lo to hi − 1                    // @scan',
        '    if a[j] ≤ pivot then                  // @cmp',
        '      i ← i + 1                           // @small',
        '      swap a[i] and a[j]                  // @small',
        '  swap a[i + 1] and a[hi]                 // @place',
        '  return i + 1                            // @place'
      ].join('\n'),
      js: [
        'function quickselect(a, k) {                     // k = 1..n',
        '  let lo = 0, hi = a.length - 1;                 // @init',
        '  const target = k - 1;',
        '  while (lo < hi) {                              // @loop',
        '    const p = partition(a, lo, hi);              // @call',
        '    if (p === target) return a[p];               // @hit',
        '    if (target < p) hi = p - 1;                  // @left',
        '    else lo = p + 1;                             // @right',
        '  }',
        '  return a[lo];                                  // @last',
        '}',
        '',
        'function partition(a, lo, hi) {',
        '  choosePivot(a, lo, hi);  // parks it at a[hi]  // @pivot',
        '  const pivot = a[hi];',
        '  let i = lo - 1;                                // @pinit',
        '  for (let j = lo; j < hi; j++) {                // @scan',
        '    if (a[j] <= pivot) {                         // @cmp',
        '      i++;                                       // @small',
        '      [a[i], a[j]] = [a[j], a[i]];               // @small',
        '    }',
        '  }',
        '  [a[i + 1], a[hi]] = [a[hi], a[i + 1]];         // @place',
        '  return i + 1;                                  // @place',
        '}'
      ].join('\n'),
      py: [
        'def quickselect(a, k):                           # k = 1..n',
        '    lo, hi = 0, len(a) - 1                       # @init',
        '    target = k - 1',
        '    while lo < hi:                               # @loop',
        '        p = partition(a, lo, hi)                 # @call',
        '        if p == target:                          # @hit',
        '            return a[p]                          # @hit',
        '        if target < p:                           # @left',
        '            hi = p - 1                           # @left',
        '        else:',
        '            lo = p + 1                           # @right',
        '    return a[lo]                                 # @last',
        '',
        'def partition(a, lo, hi):',
        '    choose_pivot(a, lo, hi)  # parks it at a[hi]  # @pivot',
        '    pivot = a[hi]',
        '    i = lo - 1                                   # @pinit',
        '    for j in range(lo, hi):                      # @scan',
        '        if a[j] <= pivot:                        # @cmp',
        '            i += 1                               # @small',
        '            a[i], a[j] = a[j], a[i]              # @small',
        '    a[i + 1], a[hi] = a[hi], a[i + 1]            # @place',
        '    return i + 1                                 # @place'
      ].join('\n')
    }
  };

  var META_QUICK = {
    lomuto: {
      title: 'Lomuto partition',
      idea: 'Park the pivot at the end, then sweep j from left to right. Every value that is at most the pivot is swapped across the boundary i into the small zone.',
      invariant: 'Before each look at a[j]: a[lo..i] ≤ pivot, a[i+1..j−1] > pivot, a[j..hi−1] not seen yet, a[hi] = pivot. The final swap puts the pivot at i + 1, its sorted place.',
      pivotFinal: true
    },
    hoare: {
      title: 'Hoare partition',
      idea: 'Two pointers walk towards each other. i stops at a value that is at least the pivot, j at a value that is at most the pivot; those two swap.',
      invariant: 'Everything left of i is ≤ pivot and everything right of j is ≥ pivot. When the pointers meet or cross, the array splits after j. The pivot itself is not necessarily at j.',
      pivotFinal: false
    },
    three: {
      title: 'Three-way partition',
      idea: 'Three pointers sort values into less than, equal to and greater than the pivot in one pass. The equal zone is final and never looked at again.',
      invariant: 'a[lo..lt−1] < pivot, a[lt..i−1] = pivot, a[i..gt] not seen yet, a[gt+1..hi] > pivot.',
      pivotFinal: true
    }
  };

  var VAR_STATES = {
    lomuto: { i: 'frontier', j: 'compare', 'a[j]': 'compare', pivot: 'pivot', p: 'done' },
    hoare: { i: 'frontier', j: 'visited', pivot: 'pivot', p: 'active' },
    three: { lt: 'frontier', i: 'compare', gt: 'visited', pivot: 'pivot' },
    select: { i: 'frontier', j: 'compare', pivot: 'pivot', p: 'done', k: 'key' }
  };

  var VAR_BASE = {
    lomuto: { lo: NA, hi: NA, pivot: NA, i: NA, j: NA, 'a[j]': NA, p: NA },
    hoare: { lo: NA, hi: NA, pivot: NA, i: NA, j: NA, 'a[i]': NA, 'a[j]': NA, p: NA },
    three: { lo: NA, hi: NA, pivot: NA, lt: NA, i: NA, gt: NA },
    select: { lo: NA, hi: NA, k: NA, pivot: NA, i: NA, j: NA, 'a[j]': NA, p: NA }
  };

  /* ------------------------------------------------------------------ the run: shared snapshot machinery */
  var FLAG_NAME = ['red', 'white', 'blue'], FLAG_LETTER = ['R', 'W', 'B'], FLAG_STATE = ['error', 'default', 'active'];

  function createRun(values, opts, algo, varKind) {
    opts = opts || {};
    var R = {
      a: normalize(values, opts.idPrefix), opts: opts, algo: algo, steps: [],
      ops: { comparisons: 0, swaps: 0 }, extra: {}, final: {}, verdict: '',
      lo: 0, hi: 0, nodes: [], nodeById: {}, frames: [], nodeSeq: 0,
      rnd: mulberry(opts.seed), select: false, flag: !!opts.flag, target: null, found: null
    };
    R.n = R.a.length; R.lo = 0; R.hi = R.n - 1;
    R.vs = VAR_STATES[varKind] || VAR_STATES.lomuto;
    R.varBase = Object.assign({}, VAR_BASE[varKind] || VAR_BASE.lomuto);
    R.noDepth = varKind === 'select' || !!opts.flag;
    R.swap = function (x, y) {
      if (x === y) return false;
      var t = R.a[x]; R.a[x] = R.a[y]; R.a[y] = t; R.ops.swaps++;
      return true;
    };
    function treeSnap() {
      if (!R.nodes.length) return { root: null, nodes: [] };
      return {
        root: R.nodes[0].id,
        nodes: R.nodes.map(function (nd) {
          var o = { id: nd.id, label: nd.label, state: nd.state };
          if (nd.sub) { o.badge = nd.sub; o.badgeState = 'pivot'; }
          if (nd.left) o.left = nd.left;
          if (nd.right) o.right = nd.right;
          return o;
        })
      };
    }
    R.snap = function (kind, o) {
      o = o || {};
      var mark = o.mark || {}, lo = R.lo, hi = R.hi, n0 = R.n;
      var finalSlots = [];
      var items = R.a.map(function (it, k) {
        var st;
        if (R.flag) st = FLAG_STATE[it.value];
        else {
          st = mark[k];
          if (!st) st = R.final[it.id] ? 'done' : (k >= lo && k <= hi ? 'default' : 'muted');
        }
        if (R.final[it.id]) finalSlots.push(k);
        var c = cell(it, st);
        if (R.flag) c.text = FLAG_LETTER[it.value];
        return c;
      });
      var vars = Object.assign({}, R.varBase, o.vars || {});
      if (!R.noDepth) vars.depth = R.frames.length;
      var regionsOut = (o.regions || []).slice();
      if (R.select && n0 > 0) {
        if (lo > 0) regionsOut.push({ id: 'dl', from: 0, to: lo - 1, state: 'muted', label: 'discarded' });
        if (hi < n0 - 1) regionsOut.push({ id: 'dr', from: hi + 1, to: n0 - 1, state: 'muted', label: 'discarded' });
      }
      var step = {
        algo: R.algo, kind: kind, range: [lo, hi],
        items: items, held: null, ghosts: [],
        pointers: o.pointers || [], regions: regionsOut,
        order: R.a.map(function (it) { return it.id; }),
        final: finalSlots,
        tree: treeSnap(),
        frames: R.frames.map(function (f) { return { id: f.id, fn: f.fn, args: { lo: f.lo, hi: f.hi }, locals: f.locals ? Object.assign({}, f.locals) : {} }; }),
        caption: R.verdict + (o.caption || ''),
        line: o.line === undefined ? null : o.line,
        flow: o.flow || null,
        vars: vars, varStates: R.vs,
        counters: { comparisons: R.ops.comparisons, swaps: R.ops.swaps },
        ops: { comparisons: R.ops.comparisons, swaps: R.ops.swaps, shifts: 0, writes: R.ops.swaps * 2 }
      };
      if (R.select) { step.counters.partitions = R.extra.partitions || 0; }
      if (o.extra) Object.assign(step, o.extra);
      R.steps.push(step);
      R.verdict = '';
      return step;
    };
    /* recursion-tree bookkeeping */
    R.newNode = function (lo, hi, parent, side) {
      var nd = { id: 'c' + (R.nodeSeq++), lo: lo, hi: hi, label: lo === hi ? '' : lo + '–' + hi, state: 'active', sub: '', parent: parent || null, side: side };
      R.nodes.push(nd); R.nodeById[nd.id] = nd;
      if (parent) parent[side === 'L' ? 'left' : 'right'] = nd.id;
      return nd;
    };
    R.pushFrame = function (nd) { R.frames.push({ id: nd.id, fn: R.select ? 'quickselect' : 'quicksort', lo: nd.lo, hi: nd.hi, locals: {} }); };
    R.popFrame = function () { R.frames.pop(); };
    return R;
  }

  function chooseWhy(strategy, cost, pv, a, lo, hi, target) {
    var it = a[pv.index], P = b(it), where = 'a[' + pv.index + ']';
    if (strategy === 'first') return 'The pivot is the first value, ' + where + ' = ' + P + '.';
    if (strategy === 'middle') return 'The pivot is the middle value, ' + where + ' = ' + P + '.';
    if (strategy === 'random') return 'A random position was drawn: ' + where + ' = ' + P + ' is the pivot. No input can be bad on purpose against a coin flip.';
    if (strategy === 'median3' && pv.cands) {
      return 'Median of three: compare a[' + lo + '] = ' + b(a[lo]) + ', a[' + pv.cands[1] + '] = ' + b(a[pv.cands[1]]) + ' and a[' + hi + '] = ' + b(a[hi]) +
        ' (3 comparisons). The middle one in value, ' + P + ', is the pivot.';
    }
    return 'The pivot is the last value, ' + where + ' = ' + P + '.';
  }

  /* ------------------------------------------------------------------ Lomuto partition (used by quicksort and quickselect) */
  function lomutoPartition(R, lo, hi, node) {
    var a = R.a, strat = R.opts.pivot || 'last', pv = pickPivotIndex(R.a, lo, hi, strat, R.rnd);
    var pIdx = pv.index, k, ptrs = [];
    R.ops.comparisons += pv.cost;
    if (R.select) R.extra.partitions = (R.extra.partitions || 0) + 1;
    var mk = {};
    if (pv.cands) pv.cands.forEach(function (c) { mk[c] = 'compare'; });
    mk[pIdx] = 'pivot';
    var vbase = { lo: lo, hi: hi, pivot: a[pIdx].value };
    var tgt = R.select ? [{ name: 'k', index: R.target, state: 'key' }] : [];
    if (pv.cands) ptrs = [{ name: 'lo', index: pv.cands[0], state: 'compare' }, { name: 'mid', index: pv.cands[1], state: 'compare' }, { name: 'hi', index: pv.cands[2], state: 'compare' }];
    else ptrs = [{ name: 'pivot', index: pIdx, state: 'pivot' }];
    R.snap('pivot', {
      caption: chooseWhy(strat, pv.cost, pv, a, lo, hi) + (pIdx === hi ? ' Lomuto wants it parked at the end, and it already is.' : ' Lomuto parks the pivot at the end so it stays out of the way of the scan.'),
      mark: mk, pointers: ptrs.concat(tgt), line: 'pivot', flow: 'pivot', vars: vbase
    });
    if (pIdx !== hi) {
      R.swap(pIdx, hi);
      var m2 = {}; m2[pIdx] = 'swap'; m2[hi] = 'pivot';
      R.snap('move', {
        caption: 'Swap the pivot ' + b(a[hi]) + ' with the last value ' + b(a[pIdx]) + '. The scan can now look at every other value in the range.',
        mark: m2, pointers: [{ name: 'pivot', index: hi, state: 'pivot' }].concat(tgt), line: 'pivot', flow: 'pivot', vars: vbase
      });
    }
    var P = a[hi], i = lo - 1;
    function regionsFor(j, processedThroughJ) {
      var rs = [], upto = processedThroughJ ? j : j - 1;
      if (i >= lo) rs.push({ id: 'small', from: lo, to: i, state: 'frontier', label: '≤ pivot' });
      if (upto >= i + 1) rs.push({ id: 'big', from: i + 1, to: upto, state: 'visited', label: '> pivot' });
      var unseenFrom = processedThroughJ ? j + 1 : j;
      if (unseenFrom <= hi - 1) rs.push({ id: 'unseen', from: unseenFrom, to: hi - 1, state: 'muted', label: 'not seen' });
      return rs;
    }
    function vars(j, extra) { return Object.assign({ lo: lo, hi: hi, pivot: P.value, i: i, j: j === null ? NA : j }, extra || {}); }
    function pointers(j, jState) {
      var ps = [{ name: 'i', index: i, state: 'frontier' }];
      if (j !== null) ps.push({ name: 'j', index: j, state: jState || 'compare' });
      return ps.concat(tgt);
    }
    if (hi > lo) {
      R.snap('init', {
        caption: 'Set i just left of the range: nothing is known to be ≤ ' + fmt(P.value) + ' yet. j will scan every value from index ' + lo + ' to ' + (hi - 1) + '.',
        mark: (function () { var o = {}; o[hi] = 'pivot'; return o; })(), pointers: pointers(lo), regions: regionsFor(lo, false), line: 'init', flow: 'pivot', vars: vars(lo)
      });
    }
    for (var j = lo; j < hi; j++) {
      var x = a[j];
      R.ops.comparisons++;
      var cm = {}; cm[hi] = 'pivot'; cm[j] = 'compare';
      R.snap('compare', {
        caption: 'Compare <code>a[' + j + ']</code> = ' + b(x) + ' with the pivot ' + b(P) + '. Is it ≤ ' + fmt(P.value) + '?',
        mark: cm, pointers: pointers(j), regions: regionsFor(j, false), line: 'cmp', flow: 'cmp', vars: vars(j, { 'a[j]': x.value })
      });
      if (x.value <= P.value) {
        i++;
        var moved = i !== j, y = a[i];
        R.swap(i, j);
        var sm = {}; sm[hi] = 'pivot'; if (moved) { sm[i] = 'swap'; sm[j] = 'swap'; } else sm[j] = 'active';
        R.snap('small', {
          caption: fmt(x.value) + ' ≤ ' + fmt(P.value) + ': it belongs in the small zone, so i moves to ' + i + '. ' +
            (moved ? 'a[' + i + '] holds ' + b(y) + ', the first value of the big zone, so swap them: the small value crosses the boundary and the big one moves to index ' + j + '.'
              : 'i and j are the same slot (no big value seen yet), so nothing needs to move: the small zone just grows.'),
          mark: sm, pointers: pointers(j), regions: regionsFor(j, true), line: 'small', flow: 'small', vars: vars(j, { 'a[j]': a[j].value })
        });
      } else {
        var lm = {}; lm[hi] = 'pivot'; lm[j] = 'active';
        R.snap('large', {
          caption: fmt(x.value) + ' &gt; ' + fmt(P.value) + ': it stays where it is and the big zone grows by one. Only j moves on; i stays put, so it keeps marking the end of the small zone.',
          mark: lm, pointers: pointers(j, 'active'), regions: regionsFor(j, true), line: 'cmp', flow: 'inc', vars: vars(j, { 'a[j]': x.value })
        });
      }
    }
    var p = i + 1, other = a[p];
    var swapped = R.swap(p, hi);
    R.final[a[p].id] = R.select ? R.final[a[p].id] : true;
    R.pivotIdFinal = a[p].id;
    var pm = {}; pm[p] = 'done';
    if (swapped) pm[hi] = 'swap';
    var pr = [];
    if (p - 1 >= lo) pr.push({ id: 'small', from: lo, to: p - 1, state: 'frontier', label: '≤ pivot' });
    if (hi >= p + 1) pr.push({ id: 'big', from: p + 1, to: hi, state: 'visited', label: '> pivot' });
    var nSmall = p - lo, nBig = hi - p;
    R.snap('place', {
      caption: 'The scan is over. Swap the pivot ' + b(P) + ' with a[' + p + '], the first value of the big zone' + (swapped ? ' (' + b(other) + ')' : ' (the pivot is already there: the big zone is empty)') +
        '. Now the pivot sits at index <b>' + p + '</b>, its final place: ' + plural(nSmall, 'value') + ' at most ' + fmt(P.value) + ' on its left, ' + plural(nBig, 'value') + ' larger on its right.',
      mark: pm, pointers: [{ name: 'p', index: p, state: 'done' }].concat(tgt), regions: pr, line: 'place', flow: 'place', vars: vars(null, { i: i, p: p }),
      extra: { split: p }
    });
    if (node) { node.sub = fmt(P.value); }
    return p;
  }

  /* ------------------------------------------------------------------ Hoare partition */
  function hoarePartition(R, lo, hi, node) {
    var a = R.a, strat = R.opts.pivot || 'last', pv = pickPivotIndex(R.a, lo, hi, strat, R.rnd);
    var pIdx = pv.index;
    R.ops.comparisons += pv.cost;
    var mk = {};
    if (pv.cands) pv.cands.forEach(function (c) { mk[c] = 'compare'; });
    mk[pIdx] = 'pivot';
    var ptrs = pv.cands ? [{ name: 'lo', index: pv.cands[0], state: 'compare' }, { name: 'mid', index: pv.cands[1], state: 'compare' }, { name: 'hi', index: pv.cands[2], state: 'compare' }] : [{ name: 'pivot', index: pIdx, state: 'pivot' }];
    R.snap('pivot', {
      caption: chooseWhy(strat, pv.cost, pv, a, lo, hi) + (pIdx === lo ? ' Hoare wants it at the front, and it already is.' : ' Hoare parks the pivot at the front of the range.'),
      mark: mk, pointers: ptrs, line: 'pivot', flow: 'pivot', vars: { lo: lo, hi: hi, pivot: a[pIdx].value }
    });
    if (pIdx !== lo) {
      R.swap(pIdx, lo);
      var m2 = {}; m2[pIdx] = 'swap'; m2[lo] = 'pivot';
      R.snap('move', {
        caption: 'Swap the pivot ' + b(a[lo]) + ' with the first value ' + b(a[pIdx]) + '.',
        mark: m2, pointers: [{ name: 'pivot', index: lo, state: 'pivot' }], line: 'pivot', flow: 'pivot', vars: { lo: lo, hi: hi, pivot: a[lo].value }
      });
    }
    var P = a[lo], i = lo, j = hi;
    function regs(iEdge, jEdge, unseenFrom, unseenTo) {
      var rs = [];
      if (iEdge >= lo) rs.push({ id: 'left', from: lo, to: iEdge, state: 'frontier', label: '≤ pivot' });
      if (jEdge <= hi) rs.push({ id: 'right', from: jEdge, to: hi, state: 'visited', label: '≥ pivot' });
      if (unseenFrom <= unseenTo) rs.push({ id: 'unseen', from: unseenFrom, to: unseenTo, state: 'muted', label: 'not seen' });
      return rs;
    }
    function vars(extra) { return Object.assign({ lo: lo, hi: hi, pivot: P.value, i: i, j: j }, extra || {}); }
    function pp(iState, jState) { return [{ name: 'i', index: i, state: iState || 'frontier' }, { name: 'j', index: j, state: jState || 'visited' }]; }
    var pm0 = {}; pm0[lo] = 'pivot';
    R.snap('init', {
      caption: 'Put i at the front and j at the back. i will walk right past every value that is smaller than ' + fmt(P.value) + ', j will walk left past every value that is larger.',
      mark: pm0, pointers: pp(), regions: regs(lo - 1, hi + 1, lo, hi), line: 'init', flow: 'pivot', vars: vars()
    });
    var guard = 0;
    for (;;) {
      if (++guard > 10 * (R.n + 5)) throw new Error('Hoare partition did not terminate');
      // scan i
      for (;;) {
        if (i > hi) throw new Error('Hoare: i ran past hi');
        R.ops.comparisons++;
        var stop = !(a[i].value < P.value);
        var cm = {}; cm[lo] = 'pivot'; cm[i] = stop ? 'active' : 'compare';
        R.snap('scanI', {
          caption: '<code>a[' + i + ']</code> = ' + b(a[i]) + (stop ? ' is not smaller than the pivot ' + b(P) + ': i stops here, on a value that belongs on the right.' : ' &lt; ' + fmt(P.value) + ': already on the correct side, so i walks on.'),
          mark: cm, pointers: pp(stop ? 'active' : 'compare'), regions: regs(i - 1, j + 1, i, j), line: 'scanI', flow: 'scanI', vars: vars({ 'a[i]': a[i].value })
        });
        if (stop) break;
        i++;
      }
      // scan j
      for (;;) {
        if (j < lo) throw new Error('Hoare: j ran past lo');
        R.ops.comparisons++;
        var stopJ = !(a[j].value > P.value);
        var cj = {}; cj[lo] = 'pivot'; cj[i] = 'active'; cj[j] = stopJ ? 'active' : 'compare';
        R.snap('scanJ', {
          caption: '<code>a[' + j + ']</code> = ' + b(a[j]) + (stopJ ? ' is not larger than the pivot ' + b(P) + ': j stops here, on a value that belongs on the left.' : ' &gt; ' + fmt(P.value) + ': already on the correct side, so j walks left.'),
          mark: cj, pointers: pp('active', stopJ ? 'active' : 'compare'), regions: regs(i - 1, j + 1, i, j), line: 'scanJ', flow: 'scanJ', vars: vars({ 'a[j]': a[j].value })
        });
        if (stopJ) break;
        j--;
      }
      if (i >= j) {
        var pr = [{ id: 'left', from: lo, to: j, state: 'frontier', label: '≤ pivot' }];
        if (j + 1 <= hi) pr.push({ id: 'right', from: j + 1, to: hi, state: 'visited', label: '≥ pivot' });
        var pm = {}; pm[j] = 'active';
        R.snap('cross', {
          caption: 'i (' + i + ') has reached or passed j (' + j + '), so every value is on its side: a[' + lo + '..' + j + '] are all ≤ ' + fmt(P.value) + ' and a[' + (j + 1) + '..' + hi + '] are all ≥ ' + fmt(P.value) +
            '. Split after index ' + j + '. Unlike Lomuto, the pivot is <em>not</em> necessarily at j, so nothing is final yet.',
          mark: pm, pointers: [{ name: 'j', index: j, state: 'active' }], regions: pr, line: 'cross', flow: 'cross', vars: vars({ p: j }), extra: { split: j }
        });
        if (node) node.sub = 'j=' + j;
        return j;
      }
      var x = a[i], y = a[j];
      R.swap(i, j);
      var sm = {}; sm[lo] = 'pivot'; sm[i] = 'swap'; sm[j] = 'swap';
      R.snap('swap', {
        caption: 'i is on ' + b(x) + ' (too big for the left) and j is on ' + b(y) + ' (too small for the right), and i is still left of j: swap them. Then both pointers step inward.',
        mark: sm, pointers: pp('swap', 'swap'), regions: regs(i, j, i + 1, j - 1), line: 'swap', flow: 'swap', vars: vars()
      });
      i++; j--;
    }
  }

  /* ------------------------------------------------------------------ recursion drivers */
  function pushLeafFinal(R, nd, lo) {
    R.final[R.a[lo].id] = true;
    nd.state = 'done'; nd.label = fmt(R.a[lo].value);
  }

  function quickRun(values, opts, kind) {
    opts = opts || {};
    var R = createRun(values, opts, kind === 'lomuto' ? 'quickLomuto' : 'quickHoare', kind);
    var n = R.n;
    if (!n) {
      R.snap('done', { caption: 'The array is empty, so there is nothing to sort: an empty array is already in order.', line: 'base', flow: 'ret' });
      return R.steps;
    }
    R.snap('start', {
      caption: n === 1 ? 'One value on its own is already sorted.' : (opts.once
        ? 'One partition of the whole array. Pick a pivot, then rearrange so that small values end up on its left and large ones on its right.'
        : 'Quick sort picks a pivot, partitions the range around it, then does the same to each side. The recursion tree on the right grows as the calls happen.'),
      line: 'call', flow: 'start', vars: { lo: 0, hi: n - 1 }
    });
    var part = kind === 'lomuto' ? lomutoPartition : hoarePartition;
    function sortRange(lo, hi, parent, side) {
      if (lo > hi) return;
      R.lo = lo; R.hi = hi;
      var nd = R.newNode(lo, hi, parent, side);
      R.pushFrame(nd);
      if (lo === hi) {
        pushLeafFinal(R, nd, lo);
        var m = {}; m[lo] = 'done';
        R.snap('base', {
          caption: 'A range of one value (index ' + lo + ') is sorted by itself, and everything around it is already settled, so this value is in its final place.',
          mark: m, line: 'base', flow: 'ret', vars: { lo: lo, hi: hi }
        });
        R.popFrame();
        return;
      }
      var callWhy = 'quicksort(' + lo + ', ' + hi + '): the whole array, ' + (hi - lo + 1) + ' values.';
      if (parent) callWhy = 'quicksort(' + lo + ', ' + hi + '): the ' + (side === 'L' ? 'left' : 'right') + ' part has ' + (hi - lo + 1) + ' values, so it needs partitioning.';
      else callWhy += ' More than one value, so it needs partitioning.';
      R.snap('call', { caption: callWhy, line: 'call', flow: parent ? 'rec' : 'start', vars: { lo: lo, hi: hi } });
      var p = part(R, lo, hi, nd);
      R.frames[R.frames.length - 1].locals = { p: p };
      nd.state = 'frontier';
      if (kind === 'lomuto') { nd.label = lo + '–' + hi; }
      if (opts.once) return;
      var L = kind === 'lomuto' ? [lo, p - 1] : [lo, p], Rr = kind === 'lomuto' ? [p + 1, hi] : [p + 1, hi];
      if (L[0] <= L[1]) sortRange(L[0], L[1], nd, 'L');
      if (Rr[0] <= Rr[1]) sortRange(Rr[0], Rr[1], nd, 'R');
      R.lo = lo; R.hi = hi;
      nd.state = 'done';
      R.popFrame();
    }
    sortRange(0, n - 1, null, null);
    if (opts.once) return R.steps;
    R.lo = 0; R.hi = n - 1;
    R.a.forEach(function (it) { R.final[it.id] = true; });
    R.nodes.forEach(function (nd) { nd.state = 'done'; });
    R.snap('done', { caption: 'Every call has returned and every value is in its final place. The array is sorted.', line: 'base', flow: 'ret', vars: { lo: 0, hi: n - 1 } });
    return R.steps;
  }
  function quickLomuto(values, opts) { return quickRun(values, opts, 'lomuto'); }
  function quickHoare(values, opts) { return quickRun(values, opts, 'hoare'); }
  function partitionLomuto(values, opts) { return quickRun(values, Object.assign({}, opts, { once: true }), 'lomuto'); }
  function partitionHoare(values, opts) { return quickRun(values, Object.assign({}, opts, { once: true }), 'hoare'); }

  /* ------------------------------------------------------------------ three-way partition */
  function threeWayPartition(R, lo, hi, node, pivotVal, noPivotElement) {
    var a = R.a;
    if (!noPivotElement) {
      var strat = R.opts.pivot || 'first', pv = pickPivotIndex(R.a, lo, hi, strat, R.rnd);
      R.ops.comparisons += pv.cost;
      var mk = {};
      if (pv.cands) pv.cands.forEach(function (c) { mk[c] = 'compare'; });
      mk[pv.index] = 'pivot';
      R.snap('pivot', {
        caption: chooseWhy(strat, pv.cost, pv, a, lo, hi) + (pv.index === lo ? '' : ' Move it to the front of the range.'),
        mark: mk, pointers: [{ name: 'pivot', index: pv.index, state: 'pivot' }], line: 'init', flow: 'init', vars: { lo: lo, hi: hi, pivot: a[pv.index].value }
      });
      if (pv.index !== lo) {
        R.swap(pv.index, lo);
        var m2 = {}; m2[pv.index] = 'swap'; m2[lo] = 'pivot';
        R.snap('move', { caption: 'Swap the pivot ' + b(a[lo]) + ' to the front.', mark: m2, pointers: [{ name: 'pivot', index: lo, state: 'pivot' }], line: 'init', flow: 'init', vars: { lo: lo, hi: hi, pivot: a[lo].value } });
      }
      pivotVal = a[lo].value;
    }
    var flag = R.flag, lt = lo, i = lo, gt = hi;
    var word = function (v) { return flag ? '<b>' + FLAG_NAME[v] + '</b>' : '<b>' + fmt(v) + '</b>'; };
    var Word = function (v) { return flag ? '<b>' + FLAG_NAME[v][0].toUpperCase() + FLAG_NAME[v].slice(1) + '</b>' : fmt(v); };
    function regs() {
      var rs = [];
      if (lt - 1 >= lo) rs.push({ id: 'less', from: lo, to: lt - 1, state: 'frontier', label: '< pivot' });
      if (i - 1 >= lt) rs.push({ id: 'equal', from: lt, to: i - 1, state: 'pivot', label: '= pivot' });
      if (i <= gt) rs.push({ id: 'unseen', from: i, to: gt, state: 'muted', label: 'not seen' });
      if (gt + 1 <= hi) rs.push({ id: 'greater', from: gt + 1, to: hi, state: 'visited', label: '> pivot' });
      return rs;
    }
    function ptrs(iState) {
      var ps = [{ name: 'lt', index: lt, state: 'frontier', side: 'below' }, { name: 'gt', index: gt, state: 'visited', side: 'below' }];
      if (i <= gt) ps.push({ name: 'i', index: i, state: iState || 'compare', side: 'above' });
      return ps;
    }
    function vars() { return { lo: lo, hi: hi, pivot: pivotVal, lt: lt, i: i, gt: gt }; }
    R.vs = VAR_STATES.three;
    if (flag || noPivotElement) {
      R.snap('init', {
        caption: 'The pivot value is ' + word(pivotVal) + '. Three pointers split the range into four zones: lt marks the end of the "less" zone, gt the start of the "greater" zone, and i scans everything between them.',
        mark: {}, pointers: ptrs(), regions: regs(), line: 'init', flow: 'init', vars: vars()
      });
    } else {
      R.snap('init', {
        caption: 'Set lt = i = ' + lo + ' and gt = ' + hi + '. Three zones will grow: less than ' + fmt(pivotVal) + ' on the left, greater than ' + fmt(pivotVal) + ' on the right, equal to it in the middle. i scans what is left.',
        mark: (function () { var o = {}; o[lo] = 'pivot'; return o; })(), pointers: ptrs(), regions: regs(), line: 'init', flow: 'init', vars: vars()
      });
    }
    while (i <= gt) {
      var x = a[i];
      R.ops.comparisons++;   // one three-way comparison: less, equal or greater
      var cm = {}; cm[i] = 'compare';
      R.snap('compare', {
        caption: 'Look at <code>a[' + i + ']</code> = ' + (flag ? word(x.value) : b(x)) + '. Is it less than, equal to, or greater than the pivot ' + word(pivotVal) + '?',
        mark: cm, pointers: ptrs('compare'), regions: regs(), line: 'cmp', flow: 'cmp', vars: vars()
      });
      if (x.value < pivotVal) {
        var did = R.swap(lt, i);
        var sm = {}; if (did) { sm[lt] = 'swap'; sm[i] = 'swap'; } else sm[i] = 'active';
        var ltOld = lt;
        lt++; i++;
        R.snap('less', {
          caption: Word(x.value) + ' is less than the pivot: swap it with a[' + ltOld + '], the first value of the equal zone' + (did ? '' : ' (which is itself: nothing to move)') + ', and move both lt and i on. The less zone and the equal zone both slide right by one.',
          mark: sm, pointers: ptrs(), regions: regs(), line: 'less', flow: 'less', vars: vars()
        });
      } else if (x.value === pivotVal) {
        var em = {}; em[i] = 'active';
        i++;
        R.snap('equal', {
          caption: Word(x.value) + ' equals the pivot: it is already next to the other equal values, so only i moves on. The equal zone grows by one.',
          mark: em, pointers: ptrs(), regions: regs(), line: 'equal', flow: 'equal', vars: vars()
        });
      } else {
        var did2 = R.swap(i, gt), gtOld = gt;
        var gm = {}; if (did2) { gm[i] = 'swap'; gm[gt] = 'swap'; } else gm[i] = 'active';
        gt--;
        R.snap('greater', {
          caption: Word(x.value) + ' is greater than the pivot: swap it with a[' + gtOld + '], the last value not seen yet, and shrink gt. <b>i stays</b>: the value that just arrived from the right has not been looked at.',
          mark: gm, pointers: ptrs(), regions: regs(), line: 'greater', flow: 'greater', vars: vars()
        });
      }
    }
    // the equal zone is final
    for (var k = lt; k <= gt; k++) R.final[a[k].id] = true;
    var pm = {};
    var rs = [];
    if (lt - 1 >= lo) rs.push({ id: 'less', from: lo, to: lt - 1, state: 'frontier', label: '< pivot' });
    rs.push({ id: 'equal', from: lt, to: gt, state: flag ? 'pivot' : 'done', label: '= pivot' });
    if (gt + 1 <= hi) rs.push({ id: 'greater', from: gt + 1, to: hi, state: 'visited', label: '> pivot' });
    var nEq = gt - lt + 1;
    R.snap('place', {
      caption: 'i has passed gt, so every value has been placed. ' + (flag
        ? 'The array is sorted: all the red, then all the white, then all the blue.'
        : plural(nEq, 'value') + ' equal to the pivot now sit in a[' + lt + '..' + gt + '], their final places. Only the ' + plural(lt - lo, 'less value') + ' and the ' + plural(hi - gt, 'greater value') + ' still need sorting.'),
      mark: pm, pointers: [{ name: 'lt', index: lt, state: 'frontier', side: 'below' }, { name: 'gt', index: gt, state: 'visited', side: 'below' }], regions: rs, line: 'done', flow: 'done', vars: { lo: lo, hi: hi, pivot: pivotVal, lt: lt, i: i, gt: gt },
      extra: { lt: lt, gt: gt }
    });
    if (node) node.sub = '=' + fmt(pivotVal);
    return { lt: lt, gt: gt };
  }

  function quickThree(values, opts) {
    opts = Object.assign({ pivot: 'first' }, opts || {});
    var R = createRun(values, opts, 'quickThree', 'three'), n = R.n;
    if (!n) { R.snap('done', { caption: 'The array is empty, so there is nothing to sort.', line: 'done' }); return R.steps; }
    R.snap('start', { caption: n === 1 ? 'One value on its own is already sorted.' : 'Three-way quick sort: each partition also collects every value equal to the pivot in one final zone.', line: 'init', vars: { lo: 0, hi: n - 1 } });
    function sortRange(lo, hi, parent, side) {
      if (lo > hi) return;
      R.lo = lo; R.hi = hi;
      var nd = R.newNode(lo, hi, parent, side);
      R.pushFrame(nd);
      if (lo === hi) {
        pushLeafFinal(R, nd, lo);
        var m = {}; m[lo] = 'done';
        R.snap('base', { caption: 'A range of one value is sorted by itself: index ' + lo + ' is final.', mark: m, line: 'done', flow: 'done', vars: { lo: lo, hi: hi } });
        R.popFrame();
        return;
      }
      R.snap('call', { caption: 'Range ' + lo + '–' + hi + ' has ' + (hi - lo + 1) + ' values: partition it three ways.', line: 'init', flow: 'init', vars: { lo: lo, hi: hi } });
      var r = threeWayPartition(R, lo, hi, nd);
      nd.state = 'frontier';
      sortRange(lo, r.lt - 1, nd, 'L');
      sortRange(r.gt + 1, hi, nd, 'R');
      R.lo = lo; R.hi = hi;
      nd.state = 'done';
      R.popFrame();
    }
    sortRange(0, n - 1, null, null);
    R.lo = 0; R.hi = n - 1;
    R.a.forEach(function (it) { R.final[it.id] = true; });
    R.nodes.forEach(function (nd) { nd.state = 'done'; });
    R.snap('done', { caption: 'Every call has returned. The array is sorted.', line: 'done', flow: 'done', vars: { lo: 0, hi: n - 1 } });
    return R.steps;
  }

  /* One three-way partition around the VALUE 1 of an array of 0s (red), 1s (white) and 2s (blue). */
  function dutchFlag(values, opts) {
    opts = Object.assign({ flag: true }, opts || {});
    var vals = (values || []).map(function (v) { v = valueOf(v); if (v !== 0 && v !== 1 && v !== 2) throw new Error('dutchFlag takes only 0, 1 and 2'); return v; });
    var R = createRun(vals, opts, 'dutchFlag', 'three'), n = R.n;
    if (!n) { R.snap('done', { caption: 'An empty row of flags is already sorted.', line: 'done' }); return R.steps; }
    R.snap('start', { caption: 'A row of red, white and blue items in a jumble. Sort them in one pass, without counting and without a second array: red first, then white, then blue.', vars: { lo: 0, hi: n - 1 } });
    threeWayPartition(R, 0, n - 1, null, 1, true);
    R.a.forEach(function (it) { R.final[it.id] = true; });
    return R.steps;
  }

  /* ------------------------------------------------------------------ quickselect */
  function quickselect(values, k, opts) {
    opts = opts || {};
    var R = createRun(values, opts, 'quickselect', 'select'), n = R.n;
    R.select = true; R.extra.partitions = 0;
    if (!n) { R.snap('done', { caption: 'The array is empty: there is no k-th smallest value.', line: 'init' }); return R.steps; }
    if (!(k >= 1 && k <= n) || Math.floor(k) !== k) throw new Error('k must be a whole number from 1 to ' + n);
    var target = k - 1; R.target = target; R.varBase.k = target;
    var lo = 0, hi = n - 1;
    var kp = function () { return [{ name: 'k', index: target, state: 'key' }]; };
    var ordinal = k === 1 ? 'smallest' : k + (k % 10 === 1 && k % 100 !== 11 ? 'st' : k % 10 === 2 && k % 100 !== 12 ? 'nd' : k % 10 === 3 && k % 100 !== 13 ? 'rd' : 'th') + ' smallest';
    R.lo = lo; R.hi = hi;
    R.snap('start', {
      caption: 'Goal: the <b>' + ordinal + '</b> value. In sorted order it would sit at index <b>' + target + '</b> (marked k). Sorting everything would find it, but partitioning tells us which <em>side</em> holds index ' + target + ', and the other side can be thrown away.',
      pointers: kp(), line: 'init', flow: 'start', vars: { lo: lo, hi: hi, k: target }
    });
    var nd = null;
    while (lo < hi) {
      R.lo = lo; R.hi = hi;
      var cnode = R.newNode(lo, hi, nd, 'R'); if (nd) nd.right = cnode.id; nd = cnode;
      R.snap('call', {
        caption: 'Search range a[' + lo + '..' + hi + '] (' + (hi - lo + 1) + ' values); the answer is at index ' + target + ' of the sorted array, which lies inside it. Partition the range.',
        pointers: kp(), line: 'call', flow: 'call', vars: { lo: lo, hi: hi, k: target }
      });
      var p = lomutoPartition(R, lo, hi, cnode);
      cnode.state = 'frontier';
      if (p === target) {
        R.found = R.a[p];
        var fm = {}; fm[p] = 'found';
        R.final[R.a[p].id] = true;
        R.lo = p; R.hi = p;
        cnode.state = 'done';
        R.snap('hit', {
          caption: 'The pivot landed exactly on index ' + target + '. A partition puts the pivot in its final sorted place, so <b>' + fmt(R.found.value) + '</b> is the ' + ordinal + ' value. Every other value is discarded without ever being sorted.',
          mark: fm, pointers: kp(), line: 'hit', flow: 'hit', vars: { lo: lo, hi: hi, p: p, k: target }
        });
        return R.steps;
      }
      var left = target < p, oldLo = lo, oldHi = hi;
      if (left) hi = p - 1; else lo = p + 1;
      R.lo = lo; R.hi = hi;
      var dm = {};
      var discarded = left ? plural(oldHi - p + 1, 'value') + ' (index ' + p + ' to ' + oldHi + ')' : plural(p - oldLo + 1, 'value') + ' (index ' + oldLo + ' to ' + p + ')';
      R.snap('discard', {
        caption: 'Index ' + target + ' is ' + (left ? 'left' : 'right') + ' of the pivot\'s final place, ' + p + ', so the ' + ordinal + ' value is in the ' + (left ? 'left' : 'right') + ' part. The other side, ' + discarded + ', can never contain it: <b>discard it</b>. Quick sort would have to sort both sides; quickselect walks into one.',
        mark: dm, pointers: kp(), line: left ? 'left' : 'right', flow: left ? 'left' : 'right', vars: { lo: lo, hi: hi, p: p, k: target }
      });
    }
    // lo === hi: the last remaining value is the answer
    R.found = R.a[lo];
    var lm = {}; lm[lo] = 'found';
    R.final[R.a[lo].id] = true;
    R.lo = lo; R.hi = hi;
    if (nd) nd.state = 'done';
    R.snap('hit', {
      caption: 'Only one value is left in the search range, and it is index ' + target + ' of the sorted array: <b>' + fmt(R.found.value) + '</b> is the ' + ordinal + ' value.',
      mark: lm, pointers: kp(), line: 'last', flow: 'last', vars: { lo: lo, hi: hi, k: target }
    });
    return R.steps;
  }

  /* ------------------------------------------------------------------ fast counts (no steps), same rules as the steps */
  function quickCount(values, opts) {
    opts = opts || {};
    var a = (values || []).map(valueOf), n = a.length, part = opts.partition || 'lomuto';
    var rnd = mulberry(opts.seed), strat = opts.pivot || (part === 'three' ? 'first' : 'last');
    var c = 0, s = 0, depth = 0, calls = 0, nodes = [], seq = 0, stackDepth = 0;
    function swap(x, y) { if (x !== y) { var t = a[x]; a[x] = a[y]; a[y] = t; s++; } }
    /* stackDepth: recursion depth if every call recursed into the SMALLER side and looped on the larger one */
    function kids(node, d, sd, l1, h1, l2, h2) {
      var s1 = h1 - l1 + 1, s2 = h2 - l2 + 1, id = node && node.id;
      lo3(l1, h1, id, 'L', d + 1, s1 <= s2 ? sd + 1 : sd);
      lo3(l2, h2, id, 'R', d + 1, s1 <= s2 ? sd : sd + 1);
    }
    function lo3(lo, hi, parentId, side, d, sd) {
      if (lo > hi) return;
      calls++; if (d > depth) depth = d; if (sd > stackDepth) stackDepth = sd;
      var node = null;
      if (opts.tree) { node = { id: 'c' + (seq++), parent: parentId, side: side, lo: lo, hi: hi, size: hi - lo + 1, depth: d, comparisons: 0, pivot: null }; nodes.push(node); }
      if (lo === hi) { if (node) node.pivot = a[lo]; return; }
      var before = c, pv = pickPivotIndex(a, lo, hi, strat, rnd);
      c += pv.cost;
      if (part === 'lomuto') {
        swap(pv.index, hi);
        var P = a[hi], i = lo - 1;
        for (var j = lo; j < hi; j++) { c++; if (a[j] <= P) { i++; swap(i, j); } }
        swap(i + 1, hi);
        var p = i + 1;
        if (node) { node.pivot = a[p]; node.comparisons = c - before; }
        kids(node, d, sd, lo, p - 1, p + 1, hi);
      } else if (part === 'hoare') {
        swap(pv.index, lo);
        var Q = a[lo], x = lo, y = hi, split;
        for (;;) {
          while (true) { c++; if (a[x] < Q) x++; else break; }
          while (true) { c++; if (a[y] > Q) y--; else break; }
          if (x >= y) { split = y; break; }
          swap(x, y); x++; y--;
        }
        if (node) { node.pivot = Q; node.comparisons = c - before; }
        kids(node, d, sd, lo, split, split + 1, hi);
      } else {
        swap(pv.index, lo);
        var T = a[lo], lt = lo, m = lo, gt = hi;
        while (m <= gt) {
          c++;
          if (a[m] < T) { swap(lt, m); lt++; m++; }
          else if (a[m] > T) { swap(m, gt); gt--; }
          else m++;
        }
        if (node) { node.pivot = T; node.comparisons = c - before; }
        kids(node, d, sd, lo, lt - 1, gt + 1, hi);
      }
    }
    if (!(part === 'lomuto' || part === 'hoare' || part === 'three')) throw new Error('Unknown partition: ' + part);
    lo3(0, n - 1, null, null, 1, 1);
    var out = { comparisons: c, swaps: s, depth: depth, stackDepth: stackDepth, calls: calls, result: a };
    if (opts.tree) out.nodes = nodes;
    return out;
  }
  /* Counts for quickselect (Lomuto partition, same pivot rules), without steps. */
  function quickselectCount(values, k, opts) {
    opts = opts || {};
    var a = (values || []).map(valueOf), n = a.length, rnd = mulberry(opts.seed), strat = opts.pivot || 'last';
    if (!n) return { comparisons: 0, swaps: 0, partitions: 0, result: undefined };
    if (!(k >= 1 && k <= n)) throw new Error('k must be from 1 to ' + n);
    var c = 0, s = 0, parts = 0, lo = 0, hi = n - 1, target = k - 1;
    function swap(x, y) { if (x !== y) { var t = a[x]; a[x] = a[y]; a[y] = t; s++; } }
    while (lo < hi) {
      parts++;
      var pv = pickPivotIndex(a, lo, hi, strat, rnd);
      c += pv.cost;
      swap(pv.index, hi);
      var P = a[hi], i = lo - 1;
      for (var j = lo; j < hi; j++) { c++; if (a[j] <= P) { i++; swap(i, j); } }
      swap(i + 1, hi);
      var p = i + 1;
      if (p === target) return { comparisons: c, swaps: s, partitions: parts, result: a[p] };
      if (target < p) hi = p - 1; else lo = p + 1;
    }
    return { comparisons: c, swaps: s, partitions: parts, result: a[lo] };
  }
  function quickTree(values, opts) {
    var r = quickCount(values, Object.assign({}, opts || {}, { tree: true }));
    return { nodes: r.nodes, comparisons: r.comparisons, depth: r.depth };
  }

  /* ------------------------------------------------------------------ merge sort trace (for the race) */
  function raceMerge(values, opts) {
    opts = opts || {};
    var a = normalize(values, opts.idPrefix), n = a.length;
    var steps = [], ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var final = {};
    function snap(kind, marks, order, caption) {
      var mk = marks || {};
      steps.push({
        algo: 'raceMerge', kind: kind,
        items: order.map(function (it) { return cell(it, mk[it.id] || (final[it.id] ? 'done' : 'default')); }),
        held: null, ghosts: [], pointers: [], regions: [],
        order: order.map(function (it) { return it.id; }),
        caption: caption || '', line: null, flow: null,
        counters: { comparisons: ops.comparisons, moves: ops.shifts },
        ops: { comparisons: ops.comparisons, swaps: 0, shifts: ops.shifts, writes: ops.writes }
      });
    }
    snap('start', {}, a.slice(), n ? 'Merge sort splits the array in halves, sorts each half, then merges them.' : 'Nothing to sort.');
    function sort(lo, hi) {
      if (lo >= hi) return;
      var mid = (lo + hi) >> 1;
      sort(lo, mid); sort(mid + 1, hi);
      var L = a.slice(lo, mid + 1), Rr = a.slice(mid + 1, hi + 1), li = 0, ri = 0, out = [];
      function layout() { return a.slice(0, lo).concat(out, L.slice(li), Rr.slice(ri), a.slice(hi + 1)); }
      while (li < L.length && ri < Rr.length) {
        ops.comparisons++;
        var take;
        if (L[li].value <= Rr[ri].value) take = L[li++]; else take = Rr[ri++];
        out.push(take); ops.shifts++; ops.writes++;
        var m = {}; m[take.id] = 'swap';
        snap('merge', m, layout(), 'Merge: the smaller front value moves into the output.');
      }
      while (li < L.length) { var t1 = L[li++]; out.push(t1); ops.shifts++; ops.writes++; var m1 = {}; m1[t1.id] = 'swap'; snap('merge', m1, layout(), 'Copy the rest of the left run.'); }
      while (ri < Rr.length) { var t2 = Rr[ri++]; out.push(t2); ops.shifts++; ops.writes++; var m2 = {}; m2[t2.id] = 'swap'; snap('merge', m2, layout(), 'Copy the rest of the right run.'); }
      for (var k = 0; k < out.length; k++) a[lo + k] = out[k];
    }
    sort(0, n - 1);
    a.forEach(function (it) { final[it.id] = true; });
    snap('done', {}, a.slice(), 'Sorted.');
    return steps;
  }

  /* Steps at which one more comparison or one more move happened, plus the first and last: a fair race clock. */
  function workFrames(steps) {
    if (!steps || !steps.length) return [];
    function work(s) { return s.ops.comparisons + s.ops.swaps + s.ops.shifts; }
    var out = [steps[0]], prev = work(steps[0]);
    for (var k = 1; k < steps.length - 1; k++) { var w = work(steps[k]); if (w > prev) { out.push(steps[k]); prev = w; } }
    if (steps.length > 1) out.push(steps[steps.length - 1]);
    return out;
  }

  return {
    quickLomuto: quickLomuto, quickHoare: quickHoare, quickThree: quickThree,
    partitionLomuto: partitionLomuto, partitionHoare: partitionHoare, dutchFlag: dutchFlag,
    quickselect: quickselect, quickselectCount: quickselectCount, quickCount: quickCount, quickTree: quickTree, raceMerge: raceMerge, workFrames: workFrames,
    pickPivotIndex: pickPivotIndex, QUICK_STRATEGIES: STRATEGIES,
    CODE_QUICK: CODE_QUICK, META_QUICK: META_QUICK
  };
}));
