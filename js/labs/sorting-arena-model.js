/* Sorting arena: pure model (no DOM). UMD: browser -> window.SortingArena, Node -> module.exports.
   It normalises the lesson generators on VDSA.algos.sorting (lessons 14, 15, 16, 17 and 21) into ONE race frame format:

     lane = { id, n, F, c: Int32Array, r: Int32Array, w: Int32Array,   cumulative comparisons, writes, work = c + r
              vals: Int16Array (F * n), st: Uint8Array (F * n),          array values and state codes per frame
              total, cmp, wr, sorted }
     frame index for clock t: the last frame whose work w <= t   (laneIndexAt)

   One frame per comparison or write. The clock is "work" = comparisons + writes, so every lane pays for both the
   same way. Counts are the generators' own (ops.comparisons / ops.writes; counting, radix and bucket sort make no
   or few comparisons, so their writes are tallies + prefix additions + placements, drops + collected, scattered +
   collected). tests/labs/sorting-arena.test.js checks the adapter against each generator's own fast counters. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SortingArena = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  var MAXV = 99;                       // values are whole numbers 0..99 (counting / radix / bucket sort need a bound)
  var MAX_N = 120, MIN_N = 8;
  var STATE_NAMES = ['default', 'active', 'compare', 'swap', 'done', 'found', 'visited', 'frontier', 'path', 'pivot', 'key', 'error', 'muted'];
  var STATE_CODE = {}; STATE_NAMES.forEach(function (s, i) { STATE_CODE[s] = i; });

  function sorting() {
    var V = root && root.VDSA;
    return (V && V.algos && V.algos.sorting) || {};
  }

  /* ------------------------------------------------------------------ inputs */
  function rng(seed) {
    var a = (seed === undefined ? 1 : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clampN(n) { n = Math.round(Number(n)); return isFinite(n) ? Math.max(MIN_N, Math.min(MAX_N, n)) : 32; }
  /* evenly spaced ranks scaled into 1..MAXV */
  function ramp(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(n === 1 ? 1 : Math.round(1 + (MAXV - 1) * i / (n - 1)));
    return out;
  }
  function shuffle(arr, r) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  var PRESETS = [
    { id: 'random', label: 'Random' },
    { id: 'sorted', label: 'Sorted' },
    { id: 'reversed', label: 'Reversed' },
    { id: 'nearly', label: 'Nearly sorted' },
    { id: 'few', label: 'Few unique' },
    { id: 'sawtooth', label: 'Sawtooth' },
    { id: 'organ', label: 'Organ pipe' }
  ];
  function makeInput(preset, n, seed) {
    n = clampN(n); var r = rng(seed === undefined ? 7 : seed), a, i;
    switch (preset) {
      case 'sorted': return ramp(n);
      case 'reversed': return ramp(n).reverse();
      case 'nearly':
        a = ramp(n);
        for (i = 0; i < Math.max(1, Math.round(n / 12)); i++) { var x = Math.floor(r() * n), y = Math.min(n - 1, x + 1 + Math.floor(r() * 3)), t = a[x]; a[x] = a[y]; a[y] = t; }
        return a;
      case 'few':
        a = [];
        for (i = 0; i < n; i++) a.push([15, 40, 65, 90][Math.floor(r() * 4)]);
        return a;
      case 'sawtooth':
        a = []; var teeth = n >= 48 ? 4 : 3, per = Math.ceil(n / teeth);
        for (i = 0; i < n; i++) a.push(Math.round(1 + (MAXV - 1) * (i % per) / Math.max(1, per - 1)));
        return a;
      case 'organ':
        a = [];
        for (i = 0; i < n; i++) { var k = i < n / 2 ? i : n - 1 - i; a.push(Math.round(1 + (MAXV - 1) * k / Math.max(1, Math.ceil(n / 2) - 1))); }
        return a;
      default:
        a = []; for (i = 0; i < n; i++) a.push(1 + Math.floor(r() * MAXV));
        return a;
    }
  }
  /* Custom input text -> {values, error}. Whole numbers 0..99, 2..120 of them. */
  function parseInput(text) {
    var parts = String(text || '').split(/[\s,;]+/).filter(Boolean), out = [];
    if (parts.length < 2) return { values: null, error: 'Enter at least 2 numbers, separated by commas or spaces.' };
    if (parts.length > MAX_N) return { values: null, error: 'Up to ' + MAX_N + ' numbers, please (you gave ' + parts.length + ').' };
    for (var i = 0; i < parts.length; i++) {
      var v = Number(parts[i].replace('−', '-'));
      if (!isFinite(v) || Math.floor(v) !== v) return { values: null, error: '"' + parts[i] + '" is not a whole number.' };
      if (v < 0 || v > MAXV) return { values: null, error: 'Keep every number between 0 and ' + MAXV + ' (counting, radix and bucket sort need a bound).' };
      out.push(v);
    }
    return { values: out, error: null };
  }

  /* ------------------------------------------------------------------ registry */
  /* gen(values, opts) -> the lesson's own steps; count(values, opts) -> {comparisons, writes} without steps.
     Ids are the URL names (?algos=bubble,merge,quick). */
  var ALGOS = [
    { id: 'bubble', name: 'Bubble sort', short: 'Bubble', lesson: '14-elementary-sorts', family: 'n2', stable: true, inPlace: true, cost: 'O(n²)', note: 'Early exit: sorted input costs n − 1 comparisons.' },
    { id: 'selection', name: 'Selection sort', short: 'Selection', lesson: '14-elementary-sorts', family: 'n2', stable: false, inPlace: true, cost: 'O(n²)', note: 'Always n(n − 1)/2 comparisons, but at most n − 1 swaps.' },
    { id: 'insertion', name: 'Insertion sort', short: 'Insertion', lesson: '14-elementary-sorts', family: 'n2', stable: true, inPlace: true, cost: 'O(n²), O(n) if nearly sorted', note: 'Shines on nearly sorted input.' },
    { id: 'cocktail', name: 'Cocktail shaker sort', short: 'Cocktail', lesson: '14-elementary-sorts', family: 'n2', stable: true, inPlace: true, cost: 'O(n²)', note: 'Bubble sort that sweeps both ways.' },
    { id: 'merge', name: 'Merge sort', short: 'Merge', lesson: '15-merge-sort', family: 'nlogn', stable: true, inPlace: false, cost: 'O(n log n)', note: 'Same work on every input, and stable.' },
    { id: 'quick', name: 'Quick sort (Lomuto)', short: 'Quick', lesson: '16-quick-sort', family: 'nlogn', stable: false, inPlace: true, cost: 'O(n log n) average, O(n²) worst', note: 'Pivot choice matters: try sorted input with the last element as pivot.' },
    { id: 'hoare', name: 'Quick sort (Hoare)', short: 'Hoare', lesson: '16-quick-sort', family: 'nlogn', stable: false, inPlace: true, cost: 'O(n log n) average', note: 'Two pointers walk inward; far fewer swaps than Lomuto.' },
    { id: 'three', name: 'Quick sort (3-way)', short: '3-way', lesson: '16-quick-sort', family: 'nlogn', stable: false, inPlace: true, cost: 'O(n log n), O(n) with few unique keys', note: 'Groups equal keys, so few-unique input is cheap.' },
    { id: 'heap', name: 'Heap sort', short: 'Heap', lesson: '21-heaps', family: 'nlogn', stable: false, inPlace: true, cost: 'O(n log n)', note: 'Guaranteed n log n, in place, but jumps around memory.' },
    { id: 'counting', name: 'Counting sort', short: 'Counting', lesson: '17-linear-time-sorts', family: 'linear', stable: true, inPlace: false, cost: 'O(n + k)', note: 'No comparisons at all: it counts keys instead.' },
    { id: 'radix', name: 'Radix sort (LSD)', short: 'Radix', lesson: '17-linear-time-sorts', family: 'linear', stable: true, inPlace: false, cost: 'O(d · (n + b))', note: 'One pass per digit, no comparisons.' },
    { id: 'bucket', name: 'Bucket sort', short: 'Bucket', lesson: '17-linear-time-sorts', family: 'linear', stable: true, inPlace: false, cost: 'O(n) on evenly spread keys', note: 'Scatter into buckets, sort each small bucket, collect.' }
  ];
  var BY_ID = {}; ALGOS.forEach(function (a) { BY_ID[a.id] = a; });
  var QUICK_PIVOTS = [{ id: 'last', label: 'Last element' }, { id: 'first', label: 'First element' }, { id: 'middle', label: 'Middle element' }, { id: 'median3', label: 'Median of three' }, { id: 'random', label: 'Random' }];

  function get(id) { return BY_ID[id] || null; }

  function opts(o) { return { pivot: (o && o.pivot) || 'last', seed: 1 }; }

  /* the lesson's steps for one algorithm */
  function steps(id, values, o) {
    var S = sorting(), v = values.slice();
    switch (id) {
      case 'bubble': case 'selection': case 'insertion': case 'cocktail': return S[id](v);
      case 'merge': return S.merge(v);
      case 'quick': return S.quickLomuto(v, opts(o));
      case 'hoare': return S.quickHoare(v, opts(o));
      case 'three': return S.quickThree(v, opts(o));
      case 'heap': return S.heap(v);
      case 'counting': return S.counting(v);
      case 'radix': return S.radix(v);
      case 'bucket': return S.bucket(v.map(function (x) { return x / (MAXV + 1); }));
    }
    throw new Error('Unknown algorithm: ' + id);
  }
  /* code tables of the lesson generators ({pseudo, js, py} with @labels) or null */
  function codeOf(id) {
    var S = sorting();
    switch (id) {
      case 'bubble': case 'selection': case 'insertion': case 'cocktail': return S.CODE && S.CODE[id] || null;
      case 'merge': return S.CODE_MERGE || null;
      case 'quick': return S.CODE_QUICK && S.CODE_QUICK.lomuto || null;
      case 'hoare': return S.CODE_QUICK && S.CODE_QUICK.hoare || null;
      case 'three': return S.CODE_QUICK && S.CODE_QUICK.three || null;
      case 'heap': return S.CODE_HEAP || null;
      case 'counting': case 'radix': case 'bucket': return S.CODE17 && S.CODE17[id] || null;
    }
    return null;
  }

  /* counters of a finished step list, in arena terms */
  function tally(id, last) {
    var o = last.ops, c = last.counters || {};
    if (id === 'counting') return { comparisons: 0, writes: (c.tallies || 0) + (c.additions || 0) + (c.placements || 0) };
    if (id === 'radix') return { comparisons: 0, writes: (c.drops || 0) + (c.collected || 0) };
    if (id === 'bucket') return { comparisons: c.comparisons || 0, writes: (c.scattered || 0) + (c.collected || 0) };
    /* heap sort's steps leave ops.writes at 0 (its own heapCount says 2 per swap), so count 2 writes per swap there */
    return { comparisons: o.comparisons, writes: id === 'heap' ? 2 * o.swaps : o.writes };
  }
  /* Fast counts without steps (used by the growth chart). Elementary sorts, merge, quick and heap have counters
     in the lessons; the linear-time sorts are cheap enough to run their generators. */
  function count(id, values, o) {
    var S = sorting(), v = values.slice(), c;
    switch (id) {
      case 'bubble': case 'selection': case 'insertion': case 'cocktail':
        c = S.count(id, v); return { comparisons: c.comparisons, writes: c.writes };
      case 'merge': c = S.mergeCount(v); return { comparisons: c.comparisons, writes: c.writes };
      case 'quick': case 'hoare': case 'three':
        c = S.quickCount(v, { partition: id === 'quick' ? 'lomuto' : id, pivot: opts(o).pivot, seed: 1 });
        return { comparisons: c.comparisons, writes: 2 * c.swaps };
      case 'heap': c = S.heapCount(v); return { comparisons: c.comparisons, writes: c.writes };
    }
    var st = steps(id, v, o);
    return tally(id, st[st.length - 1]);
  }

  /* ------------------------------------------------------------------ one step -> array picture */
  /* Returns {vals: [n numbers], st: [n state codes]}. `prev` is the previous picture (fills gaps). */
  function picture(id, step, n, prev) {
    var vals = new Array(n), st = new Array(n), k, it, pos, i;
    for (i = 0; i < n; i++) { vals[i] = null; st[i] = 0; }
    function put(p, v, s) { if (p >= 0 && p < n) { vals[p] = v; st[p] = STATE_CODE[s] || 0; } }
    var scale = id === 'bucket' ? (MAXV + 1) : 1;

    if (step.flat && step.flat.items) {                                   // merge sort: the same moment as one array
      step.flat.items.forEach(function (x) { put(x.index, Math.round(x.value * scale), x.state); });
    } else if (step.rows && id === 'counting') {                          // counting sort: output row over the input row
      var inRow = step.rows[0], outRow = step.rows[step.rows.length - 1];
      for (k = 0; k < inRow.items.length; k++) { it = inRow.items[k]; if (it) put(k, it.value, it.state === 'done' ? 'default' : it.state); }
      for (k = 0; k < outRow.items.length; k++) { it = outRow.items[k]; if (it && it.value !== undefined && it.value !== null) put(k, it.value, 'done'); }
    } else if (step.items && step.items.length && step.items[0].where) {  // radix / bucket: list first, buckets fill the gaps
      var free = [], taken = {}, bucketed = [];
      step.items.forEach(function (x) {
        if (x.where === 'list') { taken[x.index] = true; put(x.index, Math.round(x.value * scale), x.state); } else bucketed.push(x);
      });
      for (i = 0; i < n; i++) if (!taken[i]) free.push(i);
      bucketed.sort(function (a, b) { return (a.bucket - b.bucket) || (a.depth - b.depth); });
      bucketed.forEach(function (x, j) { put(free[j], Math.round(x.value * scale), x.state === 'default' ? 'visited' : x.state); });
    } else if (step.items) {                                              // elementary, quick, heap
      var slot = {};
      if (step.order) step.order.forEach(function (idn, p) { if (idn !== null && idn !== undefined) slot[idn] = p; });
      for (k = 0; k < step.items.length; k++) {
        it = step.items[k];
        pos = it.index !== undefined ? it.index : (slot[it.id] !== undefined ? slot[it.id] : k);
        put(pos, it.value, it.state);
      }
      var held = step.held ? [].concat(step.held) : [];
      for (i = 0; i < n; i++) if (vals[i] === null) {                     // a hole: the key in hand belongs there for now
        var h = held.shift();
        if (h) { vals[i] = h.value; st[i] = STATE_CODE.key; } else if (prev) { vals[i] = prev.vals[i]; st[i] = STATE_CODE.muted; }
      }
    }
    for (i = 0; i < n; i++) if (vals[i] === null) vals[i] = prev ? prev.vals[i] : 0;
    return { vals: vals, st: st };
  }

  /* ------------------------------------------------------------------ the adapter */
  function isSorted(a) { for (var i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false; return true; }

  function buildLane(id, values, o) {
    var list = steps(id, values, o), n = values.length, F = 0, i, t, tl;
    var keep = [], lastW = -1, work = [];
    for (i = 0; i < list.length; i++) {
      t = tally(id, list[i]); work.push(t);
      var w = t.comparisons + t.writes;
      if (i === 0 || w !== lastW) { keep.push(i); lastW = w; }
      else if (i === list.length - 1) keep[keep.length - 1] = i;      // the final picture replaces a frame of equal work
    }
    F = keep.length;
    var c = new Int32Array(F), r = new Int32Array(F), wArr = new Int32Array(F), vals = new Int16Array(F * n), st = new Uint8Array(F * n), prev = null;
    for (i = 0; i < F; i++) {
      tl = work[keep[i]];
      c[i] = tl.comparisons; r[i] = tl.writes; wArr[i] = tl.comparisons + tl.writes;
      prev = picture(id, list[keep[i]], n, prev);
      for (var j = 0; j < n; j++) { vals[i * n + j] = prev.vals[j]; st[i * n + j] = prev.st[j]; }
    }
    // the last picture is the sorted result: mark it done
    var lastVals = Array.prototype.slice.call(vals, (F - 1) * n, F * n);
    var sorted = isSorted(lastVals);
    if (sorted) for (var q = 0; q < n; q++) st[(F - 1) * n + q] = STATE_CODE.done;
    return { id: id, n: n, F: F, c: c, r: r, w: wArr, vals: vals, st: st, total: wArr[F - 1], cmp: c[F - 1], wr: r[F - 1], sorted: sorted };
  }

  /* last frame whose work <= t (binary search) */
  function laneIndexAt(lane, t) {
    var lo = 0, hi = lane.F - 1;
    if (t >= lane.w[hi]) return hi;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (lane.w[mid] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }

  /* Finishing order: fewest work first; equal work shares a rank. Returns [{id, rank, total}] */
  function podium(lanes) {
    var sorted = lanes.slice().sort(function (a, b) { return a.total - b.total; }), out = [], rank = 0, last = null;
    sorted.forEach(function (l, i) {
      if (last === null || l.total !== last) rank = i + 1;
      last = l.total; out.push({ id: l.id, rank: rank, total: l.total, cmp: l.cmp, wr: l.wr });
    });
    return out;
  }

  /* One teaching sentence about why this race came out the way it did. rows = podium(); preset = input shape id; pivot = quick sort pivot id. */
  var SIMPLE = ['bubble', 'selection', 'insertion', 'cocktail'], NOCMP = ['counting', 'radix', 'bucket'], QUICKS = ['quick'];
  function takeaway(rows, preset, pivot) {
    if (!rows || rows.length < 2) return '';
    var ids = rows.map(function (r) { return r.id; }), first = rows[0].id, lastRow = rows[rows.length - 1], last = lastRow.id;
    var has = function (set) { return ids.some(function (i) { return set.indexOf(i) >= 0; }); };
    var name = function (id) { return get(id).short; };
    if (rows[0].total === lastRow.total) return 'A dead heat: every racer did the same amount of work on this input.';
    if (preset === 'sorted' || preset === 'nearly') {
      if (ids.indexOf('insertion') >= 0 && first === 'insertion') return 'Insertion sort wins because there is almost nothing to fix: each number is compared with its left neighbour, found in place, and left alone. Work is about n, not n².';
      if (last === 'quick' && (pivot || 'last') === 'last' && preset === 'sorted') return 'Quick sort with the last element as pivot hits its worst case: the pivot is always the biggest value, so one side is empty and the work grows like n².';
      if (has(SIMPLE) && (first === 'bubble' || first === 'cocktail')) return 'Bubble and cocktail sort stop after one pass with no swaps, so nearly sorted input is cheap for them.';
    }
    if (preset === 'reversed' && has(SIMPLE) && SIMPLE.indexOf(last) >= 0) return 'Reversed is the worst case for the simple sorts: every number has to travel the whole way, about n²/2 moves. Merge and heap sort barely notice the order.';
    if (preset === 'few' && has(QUICKS) && ids.indexOf('three') >= 0 && rows.filter(function (r) { return r.id === 'three'; })[0].total < rows.filter(function (r) { return r.id === 'quick'; })[0].total) return '3-way quick sort groups equal values in one pass, so a handful of distinct values means very little work.';
    if (NOCMP.indexOf(first) >= 0) return name(first) + ' wins by never comparing two numbers: it counts or buckets values by their digits, so its ticks are all writes. The catch is that it needs numbers in a small range.';
    if (SIMPLE.indexOf(last) >= 0 && ids.some(function (i) { return SIMPLE.indexOf(i) < 0 && NOCMP.indexOf(i) < 0; })) return name(last) + ' is the slowest because it fixes one pair at a time (n² work), while the divide-and-conquer sorts halve the problem again and again (n log n). Raise n to widen the gap.';
    return name(first) + ' did the least work here, ' + name(last) + ' the most. Change the input shape and race again to see whether the order holds.';
  }

  var GROWTH_NS = [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
  /* Counts only: {ns, series: {id: {cmp: [...], wr: [...]}}} on the same input shape at each n */
  function growth(ids, preset, o) {
    var series = {};
    ids.forEach(function (id) { series[id] = { cmp: [], wr: [] }; });
    GROWTH_NS.forEach(function (n) {
      var input = makeInputAny(preset, n);
      ids.forEach(function (id) { var c = count(id, input, o); series[id].cmp.push(c.comparisons); series[id].wr.push(c.writes); });
    });
    return { ns: GROWTH_NS.slice(), series: series };
  }
  function makeInputAny(preset, n) {           // growth may go beyond the race cap of 120
    if (n <= MAX_N) return makeInput(preset, n, 7);
    var a = makeInput(preset, MAX_N, 7), out = [], i;
    // rebuild the same shape at size n by resampling
    for (i = 0; i < n; i++) out.push(a[Math.min(MAX_N - 1, Math.floor(i * MAX_N / n))]);
    return preset === 'random' || preset === 'few' ? bigRandom(preset, n) : out;
  }
  function bigRandom(preset, n) {
    var r = rng(7), out = [], i;
    for (i = 0; i < n; i++) out.push(preset === 'few' ? [15, 40, 65, 90][Math.floor(r() * 4)] : 1 + Math.floor(r() * MAXV));
    return out;
  }

  return {
    MAXV: MAXV, MIN_N: MIN_N, MAX_N: MAX_N, STATE_NAMES: STATE_NAMES, STATE_CODE: STATE_CODE, PRESETS: PRESETS,
    ALGOS: ALGOS, get: get, QUICK_PIVOTS: QUICK_PIVOTS, GROWTH_NS: GROWTH_NS,
    makeInput: makeInput, parseInput: parseInput, clampN: clampN,
    steps: steps, codeOf: codeOf, count: count, picture: picture,
    buildLane: buildLane, laneIndexAt: laneIndexAt, podium: podium, takeaway: takeaway, growth: growth
  };
}));
