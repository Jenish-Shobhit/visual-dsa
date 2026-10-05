/* Linear-time sorts and the comparison barrier: pure step generators. No DOM.
   UMD: in the browser it merges into VDSA.algos.sorting (lesson 14 and others add to the same object, nothing is
   replaced); in Node it exports the same API.

     sorting.counting(values, opts)   -> steps   stable counting sort; opts {direction: 'rtl' (default) | 'ltr', k, idPrefix}
     sorting.radix(values, opts)      -> steps   LSD radix sort with bucket queues; opts {base: 10, stable: true, idPrefix}
     sorting.bucket(values, opts)     -> steps   bucket sort of numbers in [0, 1); opts {buckets: 5, idPrefix}
     sorting.labelDuplicates(values)  -> [{value, label}] with a, b, c tags on repeated values
     sorting.countingRef(values)      -> stable reference result (array of items, for tests and the figures)
     sorting.decision3                -> the decision tree that sorts 3 items (6 leaves) as plain data
     sorting.runDecision(tree, vals)  -> {path: [{node, answer}], leaf, order}
     sorting.treeStats(tree)          -> {leaves, height, depths}
     sorting.sortDecisionStats(n, algo) -> {leaves, height} measured by running a real comparison sort on every permutation
     sorting.factorial(n), sorting.log2Factorial(n), sorting.minComparisons(n)   (ceil(log2 n!))
     sorting.countingOps(n, k), sorting.radixOps(n, d, b)   operation models used by the cost figures
     sorting.CODE17[name]             -> {pseudo, js, py} with // @labels matching step.line
     sorting.META17[name]             -> titles and costs

   values: counting/radix take non-negative integers (or {value, label, id} objects; labels tag equal keys);
   bucket takes numbers in [0, 1).

   Counting sort steps are complete snapshots for VDSA.views.array in its multi-row form:
     { algo, kind, phase, rows: [{id:'in'|'cnt'|'out', items, pointers, regions, ...}], caption, line, vars, counters, flow }
   Radix and bucket sort steps are snapshots for the lesson's bucket view (js/lessons/17-linear-time-sorts-buckets.js):
     { algo, kind, items: [{id, value, text, digits, where: 'list'|'bucket', index | bucket + depth, state}], nBuckets, ... }

   Truth rules (tested in tests/algos/17-linear-time-sorts.test.js):
   - a counting-sort output item is 'done' the moment it is written: its slot never changes again;
   - the count row after the prefix step holds "how many items have key <= v", and the reserved stretch of key v is
     [count[v-1], count[v] - 1];
   - counters only ever grow; counting and radix sort make 0 key comparisons;
   - the radix caption "sorted by the last p digits" is checked against the data in the tests. */
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

  /* ------------------------------------------------------------------ helpers */
  var NA = { __vdsaRaw: true, text: '–', type: 'undef' };
  var TAGS = 'abcdefghijklmnopqrstuvwxyz';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtNum(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function name(it) {
    var t = it.text !== undefined ? it.text : fmtNum(it.value);
    if (it.label === undefined || it.label === null || it.label === '') return t;
    var l = String(it.label);
    return t + (/^[a-z]$/i.test(l) ? '<sub>' + esc(l) + '</sub>' : esc(l));
  }
  function b(it) { return '<b>' + name(it) + '</b>'; }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }

  function labelDuplicates(values) {
    var counts = {}, seen = {};
    values.forEach(function (v) { var x = v !== null && typeof v === 'object' ? v.value : v; counts[x] = (counts[x] || 0) + 1; });
    return values.map(function (v) {
      var x = v !== null && typeof v === 'object' ? v.value : v;
      if (counts[x] < 2) return v !== null && typeof v === 'object' ? v : { value: x };
      var k = seen[x] = (seen[x] || 0) + 1;
      return { value: x, label: TAGS[k - 1] || String(k) };
    });
  }

  function normalize(values, prefix, check) {
    prefix = prefix === undefined ? 'v' : prefix;
    return (values || []).map(function (v, i) {
      var o;
      if (v !== null && typeof v === 'object') {
        o = { id: v.id !== undefined ? String(v.id) : prefix + i, value: v.value };
        if (v.label !== undefined && v.label !== null && v.label !== '') o.label = String(v.label);
      } else o = { id: prefix + i, value: v };
      check(o.value, i);
      return o;
    });
  }
  function needKey(v, i) {
    if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v || v < 0) throw new RangeError('Item ' + i + ' is not a whole number that is 0 or more: ' + v);
  }
  function needUnit(v, i) {
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v >= 1) throw new RangeError('Item ' + i + ' is not in [0, 1): ' + v);
  }

  function cell(it, state) {
    var o = { id: it.id, value: it.value, state: state || 'default' };
    if (it.label !== undefined) o.label = it.label;
    return o;
  }

  /* ------------------------------------------------------------------ code */
  var CODE17 = {
    counting: {
      pseudo: [
        'procedure countingSort(a, k)',
        '  count ← array of k + 1 zeros           // @init',
        '  for i ← 0 to n − 1                     // @tallyLoop',
        '    count[a[i]] ← count[a[i]] + 1        // @tally',
        '  for v ← 1 to k                         // @prefixLoop',
        '    count[v] ← count[v] + count[v − 1]   // @prefix',
        '  out ← array of n empty slots           // @outinit',
        '  for i ← n − 1 down to 0                // @placeLoop',
        '    count[a[i]] ← count[a[i]] − 1        // @dec',
        '    out[count[a[i]]] ← a[i]              // @place',
        '  return out                             // @done'
      ].join('\n'),
      js: [
        'function countingSort(a, k) {',
        '  const count = new Array(k + 1).fill(0);   // @init',
        '  for (let i = 0; i < a.length; i++) {      // @tallyLoop',
        '    count[a[i]]++;                          // @tally',
        '  }',
        '  for (let v = 1; v <= k; v++) {            // @prefixLoop',
        '    count[v] += count[v - 1];               // @prefix',
        '  }',
        '  const out = new Array(a.length);          // @outinit',
        '  for (let i = a.length - 1; i >= 0; i--) { // @placeLoop',
        '    count[a[i]]--;                          // @dec',
        '    out[count[a[i]]] = a[i];                // @place',
        '  }',
        '  return out;                               // @done',
        '}'
      ].join('\n'),
      py: [
        'def counting_sort(a, k):',
        '    count = [0] * (k + 1)                # @init',
        '    for x in a:                          # @tallyLoop',
        '        count[x] += 1                    # @tally',
        '    for v in range(1, k + 1):            # @prefixLoop',
        '        count[v] += count[v - 1]         # @prefix',
        '    out = [None] * len(a)                # @outinit',
        '    for i in range(len(a) - 1, -1, -1):  # @placeLoop',
        '        count[a[i]] -= 1                 # @dec',
        '        out[count[a[i]]] = a[i]          # @place',
        '    return out                           # @done'
      ].join('\n')
    },
    radix: {
      pseudo: [
        'procedure radixSort(a, base)',
        '  for each digit, lowest first          // @pass',
        '    buckets ← base empty queues         // @init',
        '    for x in a, in order                // @dropLoop',
        '      d ← that digit of x               // @digit',
        '      add x to the back of buckets[d]   // @drop',
        '    a ← all buckets joined, 0 first   // @collect',
        '  return a                              // @done'
      ].join('\n'),
      js: [
        'function radixSort(a, base = 10) {',
        '  const max = Math.max(0, ...a);',
        '  for (let exp = 1; Math.floor(max / exp) > 0; exp *= base) {  // @pass',
        '    const buckets = Array.from({ length: base }, () => []);     // @init',
        '    for (const x of a) {                                        // @dropLoop',
        '      const d = Math.floor(x / exp) % base;                     // @digit',
        '      buckets[d].push(x);                                       // @drop',
        '    }',
        '    a = buckets.flat();                                         // @collect',
        '  }',
        '  return a;                                                     // @done',
        '}'
      ].join('\n'),
      py: [
        'def radix_sort(a, base=10):',
        '    m = max(a, default=0)',
        '    exp = 1',
        '    while m // exp > 0:                          # @pass',
        '        buckets = [[] for _ in range(base)]      # @init',
        '        for x in a:                              # @dropLoop',
        '            d = (x // exp) % base                # @digit',
        '            buckets[d].append(x)                 # @drop',
        '        a = [x for b in buckets for x in b]      # @collect',
        '        exp *= base',
        '    return a                                     # @done'
      ].join('\n')
    },
    bucket: {
      pseudo: [
        'procedure bucketSort(a, k)',
        '  buckets ← k empty lists                 // @init',
        '  for x in a                              // @scatterLoop',
        '    add x to buckets[⌊x · k⌋]             // @scatter',
        '  for each bucket                         // @bucketLoop',
        '    insertion-sort the bucket             // @sortBucket',
        '  return buckets joined in order          // @concat'
      ].join('\n'),
      js: [
        'function bucketSort(a, k = a.length) {',
        '  const buckets = Array.from({ length: k }, () => []);  // @init',
        '  for (const x of a) {                                   // @scatterLoop',
        '    buckets[Math.floor(x * k)].push(x);                  // @scatter',
        '  }',
        '  for (const bucket of buckets) {                        // @bucketLoop',
        '    insertionSort(bucket);                               // @sortBucket',
        '  }',
        '  return buckets.flat();                                 // @concat',
        '}'
      ].join('\n'),
      py: [
        'def bucket_sort(a, k=None):',
        '    k = k or len(a)',
        '    buckets = [[] for _ in range(k)]         # @init',
        '    for x in a:                              # @scatterLoop',
        '        buckets[int(x * k)].append(x)        # @scatter',
        '    for bucket in buckets:                   # @bucketLoop',
        '        bucket.sort()                        # @sortBucket',
        '    return [x for b in buckets for x in b]   # @concat'
      ].join('\n')
    }
  };
  var META17 = {
    counting: { title: 'Counting sort', cost: 'O(n + k)', stable: true, space: 'O(n + k)' },
    radix: { title: 'Radix sort (LSD)', cost: 'O(d · (n + b))', stable: true, space: 'O(n + b)' },
    bucket: { title: 'Bucket sort', cost: 'O(n + k) average on uniform data, O(n²) worst', stable: true, space: 'O(n + k)' }
  };

  /* ================================================================== counting sort */
  function countingRef(values) {
    var items = normalize(values, 'v', needKey);
    return items.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (x, y) { return x.it.value - y.it.value || x.i - y.i; })
      .map(function (x) { return x.it; });
  }

  function counting(values, opts) {
    opts = opts || {};
    var dir = opts.direction === 'ltr' ? 'ltr' : 'rtl';
    var items = normalize(values, opts.idPrefix, needKey);
    var n = items.length;
    var maxKey = 0;
    items.forEach(function (it) { if (it.value > maxKey) maxKey = it.value; });
    var k = opts.k !== undefined ? opts.k : maxKey;
    if (k < maxKey) throw new RangeError('k = ' + k + ' is smaller than the largest key ' + maxKey);
    var count = zeros(k + 1), out = [], k1 = k + 1;
    for (var s = 0; s < n; s++) out.push(null);
    var starts = null;                 // reserved stretch of each key, known after the prefix sums
    var C = { comparisons: 0, tallies: 0, additions: 0, placements: 0 };
    var steps = [];

    function regionsNow(activeKey) {
      if (!starts) return [];
      var rs = [];
      for (var v = 0; v <= k; v++) {
        var lo = starts.lo[v], hi = starts.hi[v];
        if (hi < lo) continue;
        rs.push({ id: 'r' + v, from: lo, to: hi, state: v === activeKey ? 'active' : 'visited', label: hi > lo ? 'key ' + v : String(v) });
      }
      return rs;
    }
    function varsNow(o) {
      o = o || {};
      return {
        i: o.i === undefined ? NA : o.i,
        key: o.key === undefined ? NA : o.key,
        count: count.slice(),
        out: out.map(function (x) { return x ? x.value : null; })
      };
    }
    function snap(kind, o) {
      o.inState = o.inState || {}; o.cntState = o.cntState || {};
      var inItems = items.map(function (it) { return cell(it, o.inState[it.id]); });
      var cnt = count.map(function (c, v) { return { id: 'c' + v, value: c, state: o.cntState[v] || 'default' }; });
      var outItems = [];
      out.forEach(function (it, slot) {
        if (!it) return;
        var oi = { id: 'o' + it.id, value: it.value, state: 'done', index: slot };
        if (it.label !== undefined) oi.label = it.label;
        if (o.from === it.id) oi.from = it.id;
        outItems.push(oi);
      });
      var step = {
        algo: 'counting', kind: kind, phase: o.phase || kind,
        rows: [
          { id: 'in', label: 'input a', items: inItems, pointers: o.inPointers || [] },
          { id: 'cnt', label: 'count', items: cnt, pointers: o.cntPointers || [] },
          { id: 'out', label: 'output', items: outItems, length: n, regions: regionsNow(o.activeKey), pointers: o.outPointers || [] }
        ],
        caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow,
        vars: varsNow(o), counters: Object.assign({}, C),
        k: k, n: n
      };
      steps.push(step);
      return step;
    }

    // ---- start
    snap('init', {
      phase: 'init', line: 'init', flow: 'init',
      cntState: {},
      caption: n === 0
        ? 'There is nothing to sort: the input is empty, so counting sort returns an empty array.'
        : 'Keys are whole numbers from 0 to <b>' + k + '</b>, so make <b>' + k1 + '</b> counters, one per possible key, all starting at 0. Each counter will tally how many items have that key.'
    });

    // ---- 1. tally
    for (var i = 0; i < n; i++) {
      var it = items[i], key = it.value;
      count[key]++; C.tallies++;
      var cs = {}; cs[key] = 'swap';
      var ins = {};
      for (var q = 0; q < i; q++) ins[items[q].id] = 'visited';
      ins[it.id] = 'compare';
      snap('tally', {
        phase: 'tally', line: 'tally', flow: 'tally', i: i, key: key, inState: ins, cntState: cs,
        inPointers: [{ name: 'i', index: i, state: 'active' }], cntPointers: [{ name: 'key', index: key, state: 'swap', side: 'above' }],
        caption: 'Read ' + b(it) + ' at index ' + i + '. Its key is <b>' + key + '</b>, so add 1 to <code>count[' + key + ']</code>: it goes from ' + (count[key] - 1) + ' to <b>' + count[key] + '</b>. No key is compared with any other key.'
      });
    }
    {
      var allIn = {}; items.forEach(function (x) { allIn[x.id] = 'visited'; });
      var tcs = {}; count.forEach(function (c, v) { if (c > 0) tcs[v] = 'visited'; });
      snap('tallyDone', {
        phase: 'tally', line: 'tallyLoop', flow: 'tallyQ', inState: allIn, cntState: tcs,
        caption: n === 0
          ? 'All ' + k1 + ' counters are still 0.'
          : 'Tally done. <code>count[v]</code> is how many items have key <em>v</em>, and the counters add up to ' + n + '. The counters already say <em>how many</em> of each key there are, but not yet <em>where</em> they go.'
      });
    }

    // ---- 2. prefix sums
    for (var v = 1; v <= k; v++) {
      var before = count[v];
      count[v] += count[v - 1]; C.additions++;
      var ps = {};
      for (var u = 0; u < v - 1; u++) ps[u] = 'visited';
      ps[v - 1] = 'compare'; ps[v] = 'swap';
      var ins2 = {}; items.forEach(function (x) { ins2[x.id] = 'visited'; });
      snap('prefix', {
        phase: 'prefix', line: 'prefix', flow: 'prefix', inState: ins2, cntState: ps,
        cntPointers: [{ name: 'v', index: v, state: 'swap', side: 'above' }],
        caption: '<code>count[' + v + ']</code> = ' + before + ' + <code>count[' + (v - 1) + ']</code> (' + count[v - 1] + ') = <b>' + count[v] + '</b>. That is how many items have a key of ' + v + ' or less, so key ' + v + '’s items must fill the slots just below index ' + count[v] + '.'
      });
    }
    starts = { lo: [], hi: [] };
    for (var w = 0; w <= k; w++) { starts.lo.push(w === 0 ? 0 : count[w - 1]); starts.hi.push(count[w] - 1); }
    var pd = {}; count.forEach(function (c, vv) { pd[vv] = 'visited'; });
    var pins = {}; items.forEach(function (x) { pins[x.id] = 'visited'; });
    snap('prefixDone', {
      phase: 'prefix', line: 'outinit', flow: 'placeQ', inState: pins, cntState: pd,
      caption: n === 0 ? 'Nothing to place.' : 'Prefix sums done. Each key now owns a fixed stretch of the output, shaded below: key <em>v</em> owns slots <code>count[v − 1]</code> up to <code>count[v] − 1</code>. Now the items can be dropped straight into their stretch.'
    });

    // ---- 3. place
    var order = [];
    for (var z = 0; z < n; z++) order.push(dir === 'rtl' ? n - 1 - z : z);
    var placedIn = {};
    order.forEach(function (idx, t) {
      var it2 = items[idx], key2 = it2.value;
      var ins3 = {};
      items.forEach(function (x) { ins3[x.id] = placedIn[x.id] ? 'muted' : 'visited'; });
      ins3[it2.id] = 'compare';
      count[key2]--;
      var slot = count[key2];
      var cs2 = {}; count.forEach(function (c, vv) { cs2[vv] = 'visited'; }); cs2[key2] = 'swap';
      var left = slot - starts.lo[key2];
      var why = dir === 'rtl'
        ? 'Going right to left, the <em>last</em> item with a key takes the <em>last</em> free slot of its stretch, so equal keys keep their order.'
        : 'Going left to right with this rule, the <em>first</em> item with a key takes the <em>last</em> slot of its stretch, so equal keys end up in reverse order.';
      snap('take', {
        phase: 'place', line: 'dec', flow: 'place', i: idx, key: key2, inState: ins3, cntState: cs2, activeKey: key2,
        inPointers: [{ name: 'i', index: idx, state: 'active' }], cntPointers: [{ name: 'key', index: key2, state: 'swap', side: 'above' }],
        outPointers: [{ name: 'slot', index: slot, state: 'swap', side: 'above' }],
        caption: 'Take ' + b(it2) + ' (index ' + idx + ', key ' + key2 + '). Subtract 1 from <code>count[' + key2 + ']</code>: it becomes <b>' + slot + '</b>, the last free slot in key ' + key2 + '’s stretch. ' + why
      });
      out[slot] = it2; C.placements++; placedIn[it2.id] = true;
      var ins4 = {};
      items.forEach(function (x) { ins4[x.id] = placedIn[x.id] ? 'muted' : 'visited'; });
      var cs3 = {}; count.forEach(function (c, vv) { cs3[vv] = 'visited'; });
      snap('place', {
        phase: 'place', line: 'place', flow: 'place', i: idx, key: key2, inState: ins4, cntState: cs3, activeKey: key2, from: it2.id,
        inPointers: [{ name: 'i', index: idx, state: 'active' }],
        caption: 'Write ' + b(it2) + ' into <code>out[' + slot + ']</code>. That slot is final: nothing moves after this. ' + (left > 0 ? 'Key ' + key2 + ' still has ' + plural(left, 'free slot') + ' below it.' : 'Key ' + key2 + '’s stretch is now full.')
      });
    });

    // ---- done
    var dIn = {}; items.forEach(function (x) { dIn[x.id] = 'muted'; });
    var dc = {}; count.forEach(function (c, vv) { dc[vv] = 'visited'; });
    snap('done', {
      phase: 'done', line: 'done', flow: 'done', inState: dIn, cntState: dc,
      caption: n === 0 ? 'Done: an empty array is already sorted.' :
        '<b>Sorted.</b> ' + plural(2 * n + k, 'basic step') + ' (' + n + ' tallies, ' + k + ' additions, ' + n + ' placements) and <b>0</b> key comparisons. Leftover fact: each counter now equals the <em>start</em> of its key’s stretch.'
    });
    return steps;
  }

  /* ================================================================== bucket queues shared by radix and bucket sort */
  function digitsOf(v, base) { var d = 0; while (v > 0) { d++; v = Math.floor(v / base); } return d; }
  function digitAt(v, pos, base) { return Math.floor(v / Math.pow(base, pos)) % base; }
  function pad(v, d, base) {
    var s = v.toString(base);
    while (s.length < d) s = '0' + s;
    return s;
  }

  /* Radix sort with bucket queues. Every step draws the list row (n slots) and `base` buckets. */
  function radix(values, opts) {
    opts = opts || {};
    var base = opts.base || 10, stable = opts.stable !== false;
    var items = normalize(values, opts.idPrefix, needKey);
    var n = items.length;
    var maxV = 0; items.forEach(function (it) { if (it.value > maxV) maxV = it.value; });
    var d = digitsOf(maxV, base);
    var slots = items.slice();                 // list row: item or null (dealt out)
    var buckets = []; for (var bi = 0; bi < base; bi++) buckets.push([]);
    var C = { comparisons: 0, passes: 0, drops: 0, collected: 0 };
    var steps = [];
    var exp = 1, pos = 0, x = null, dg = null, pass = 0;

    function bucketText() {
      var parts = [];
      buckets.forEach(function (bk, i) { if (bk.length) parts.push(i + ':[' + bk.map(function (it) { return it.value; }).join(',') + ']'); });
      return { __vdsaRaw: true, text: parts.length ? parts.join(' ') : '(all empty)', type: 'str' };
    }
    function snap(kind, o) {
      o = o || {};
      var where = {};
      slots.forEach(function (it, i) { if (it) where[it.id] = { where: 'list', index: i }; });
      buckets.forEach(function (bk, bidx) { bk.forEach(function (it, depth) { where[it.id] = { where: 'bucket', bucket: bidx, depth: depth }; }); });
      var st = o.states || {};
      var its = items.map(function (it) {
        var w = where[it.id];
        var e = { id: it.id, value: it.value, digits: pad(it.value, Math.max(d, 1), base), state: st[it.id] || 'default' };
        if (it.label !== undefined) e.label = it.label;
        e.where = w.where;
        if (w.where === 'list') e.index = w.index; else { e.bucket = w.bucket; e.depth = w.depth; }
        return e;
      });
      var listVals = slots.map(function (it) { return it ? it.value : null; });
      var step = {
        algo: 'radix', kind: kind, pass: pass, pos: o.pos === undefined ? -1 : o.pos, d: d, base: base, nBuckets: base,
        stable: stable, items: its, listLabel: o.listLabel || 'list a',
        activeBucket: o.activeBucket === undefined ? null : o.activeBucket,
        caption: o.caption, line: o.line === undefined ? null : o.line,
        vars: {
          pass: pass ? { __vdsaRaw: true, text: pass + ' of ' + d, type: 'num' } : NA,
          exp: pass ? exp : NA,
          x: x === null ? NA : x,
          digit: dg === null ? NA : dg,
          list: { __vdsaRaw: true, text: '[' + listVals.map(function (vv) { return vv === null ? '·' : vv; }).join(', ') + ']', type: 'arr' },
          buckets: bucketText()
        },
        counters: Object.assign({}, C), order: slots.map(function (it) { return it ? it.id : null; })
      };
      steps.push(step);
      return step;
    }
    function allStates(state) { var o = {}; items.forEach(function (it) { o[it.id] = state; }); return o; }
    function placeName(p) { return ['ones', 'tens', 'hundreds', 'thousands'][p] || ('digit ' + (p + 1)); }

    snap('init', {
      line: 'pass',
      caption: n === 0 ? 'The list is empty, so there is nothing to sort.'
        : d === 0 ? 'Every value is 0, so there are no digits to look at and the list is already sorted.'
        : 'Sort ' + n + ' numbers of up to <b>' + d + '</b> digit' + (d === 1 ? '' : 's') + ' each. Radix sort makes <b>' + d + '</b> pass' + (d === 1 ? '' : 'es') + ', one per digit position, starting with the <b>least significant</b> (' + placeName(0) + ') digit. Shorter numbers are padded with leading zeros.'
    });

    for (var p = 0; p < d; p++) {
      pos = p; pass = p + 1; exp = Math.pow(base, p); C.passes++; x = null; dg = null;
      snap('pass', {
        pos: p, line: 'pass',
        caption: '<b>Pass ' + pass + ' of ' + d + '.</b> Look only at the <b>' + placeName(p) + '</b> digit (highlighted). Deal every number, in list order, into the bucket with that digit' +
          (stable ? '. Each bucket is a queue: new arrivals join the back.' : '. In this broken version each bucket is a stack: new arrivals go on the <em>front</em>.')
      });
      for (var i = 0; i < n; i++) {
        var it = slots[i];
        x = it.value; dg = digitAt(it.value, p, base);
        slots[i] = null;
        if (stable) buckets[dg].push(it); else buckets[dg].unshift(it);
        C.drops++;
        var others = buckets[dg].length - 1;
        var sts = {}; sts[it.id] = 'swap';
        snap('drop', {
          pos: p, line: 'drop', states: sts, activeBucket: dg,
          caption: 'The ' + placeName(p) + ' digit of ' + b(it) + ' is <b>' + dg + '</b>, so it goes into bucket ' + dg + '. ' +
            (others === 0 ? 'The bucket was empty.' : stable
              ? 'It joins the back, behind ' + plural(others, 'number') + ' that arrived earlier, so ties keep their order.'
              : 'It goes on the front, ahead of ' + plural(others, 'number') + ' that arrived earlier: ties now come out in reverse order.')
        });
      }
      // collect
      var next = 0;
      for (var bk = 0; bk < base; bk++) {
        if (!buckets[bk].length) continue;
        var moved = buckets[bk].slice();
        buckets[bk] = [];
        var mst = {};
        moved.forEach(function (it2) { slots[next++] = it2; C.collected++; mst[it2.id] = 'swap'; });
        x = null; dg = null;
        snap('collect', {
          pos: p, line: 'collect', states: mst, activeBucket: bk,
          caption: 'Empty bucket ' + bk + ' back into the list, front to back: ' + moved.map(b).join(', ') + '. Buckets are read in order 0, 1, 2, …, so smaller digits come first.'
        });
      }
      x = null; dg = null;
      snap('passEnd', {
        pos: p, line: 'collect', states: allStates(p === d - 1 ? 'default' : 'visited'),
        caption: p === d - 1
          ? 'Pass ' + pass + ' is done: every digit has had its turn.'
          : stable
            ? '<b>After pass ' + pass + '</b> the list is ordered by its last ' + (pass === 1 ? 'digit' : pass + ' digits') + ', and numbers that tie on the digit just used still appear in their earlier order.'
            : (pass === 1 ? '<b>After pass 1</b> the list is ordered by its last digit.' : '<b>After pass ' + pass + '</b> the list is ordered by the ' + placeName(p) + ' digit alone: the numbers that tie on it were reversed, which scrambled the order the earlier passes built.')
      });
    }
    // done
    var okSorted = slots.every(function (it, j) { return j === 0 || slots[j - 1].value <= it.value; });
    var fin = {};
    slots.forEach(function (it) { fin[it.id] = okSorted ? 'done' : 'default'; });
    if (!okSorted) {
      for (var j2 = 1; j2 < slots.length; j2++) if (slots[j2 - 1].value > slots[j2].value) { fin[slots[j2 - 1].id] = 'error'; fin[slots[j2].id] = 'error'; }
    }
    pass = d; x = null; dg = null;
    var bad = [];
    for (var j3 = 1; j3 < slots.length; j3++) if (slots[j3 - 1].value > slots[j3].value) bad.push(slots[j3 - 1].value + ' before ' + slots[j3].value);
    snap('done', {
      pos: -1, line: 'done', states: fin,
      caption: n === 0 ? 'Done.' : okSorted
        ? '<b>Sorted after ' + plural(d, 'pass', 'passes') + '.</b> The last pass decided the biggest digit, and because every pass kept ties in order, the smaller digits were already settled. No two numbers were ever compared.'
        : '<b>Not sorted.</b> ' + bad.slice(0, 3).join('; ') + '. The stack-style buckets reversed ties in some pass, and that undid the work of the earlier passes. Radix sort only works if each pass is stable.'
    });
    return steps;
  }

  /* ================================================================== bucket sort on [0, 1) */
  function bucketSort(values, opts) {
    opts = opts || {};
    var items = normalize(values, opts.idPrefix, needUnit);
    var n = items.length;
    var k = opts.buckets || 5;
    var slots = items.slice();
    var buckets = []; for (var i = 0; i < k; i++) buckets.push([]);
    var C = { comparisons: 0, scattered: 0, sortedBuckets: 0, collected: 0 };
    var steps = [];
    var x = null, bIdx = null;
    function txt(it) { return it.value.toFixed(2); }
    function bname(it) { return '<b>' + txt(it) + '</b>'; }
    function labels() {
      var out = [];
      for (var q = 0; q < k; q++) out.push((q / k).toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0') + '–' + ((q + 1) / k).toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0'));
      return out;
    }
    function bucketText() {
      var parts = [];
      buckets.forEach(function (bk, q) { if (bk.length) parts.push(q + ':[' + bk.map(txt).join(',') + ']'); });
      return { __vdsaRaw: true, text: parts.length ? parts.join(' ') : '(all empty)', type: 'str' };
    }
    function snap(kind, o) {
      o = o || {};
      var where = {};
      slots.forEach(function (it, q) { if (it) where[it.id] = { where: 'list', index: q }; });
      buckets.forEach(function (bk, q) { bk.forEach(function (it, depth) { where[it.id] = { where: 'bucket', bucket: q, depth: depth }; }); });
      var st = o.states || {};
      var its = items.map(function (it) {
        var w = where[it.id];
        var e = { id: it.id, value: it.value, text: txt(it), state: st[it.id] || 'default', where: w.where };
        if (w.where === 'list') e.index = w.index; else { e.bucket = w.bucket; e.depth = w.depth; }
        return e;
      });
      var step = {
        algo: 'bucket', kind: kind, nBuckets: k, bucketLabels: labels(), items: its, listLabel: 'list a',
        activeBucket: o.activeBucket === undefined ? null : o.activeBucket,
        caption: o.caption, line: o.line === undefined ? null : o.line,
        vars: { x: x === null ? NA : +x.toFixed(2), bucket: bIdx === null ? NA : bIdx, buckets: bucketText() },
        counters: Object.assign({}, C), order: slots.map(function (it) { return it ? it.id : null; })
      };
      steps.push(step);
      return step;
    }
    snap('init', {
      line: 'init',
      caption: n === 0 ? 'The list is empty.' :
        'The ' + n + ' numbers are all in [0, 1). Split that interval into <b>' + k + '</b> equal ranges, one bucket each. A number <em>x</em> belongs in bucket ⌊<em>x</em> · ' + k + '⌋, and no comparison is needed to find it.'
    });
    for (var t = 0; t < n; t++) {
      var it = slots[t];
      var q = Math.floor(it.value * k);
      x = it.value; bIdx = q;
      slots[t] = null; buckets[q].push(it); C.scattered++;
      var s1 = {}; s1[it.id] = 'swap';
      snap('scatter', {
        line: 'scatter', states: s1, activeBucket: q,
        caption: bname(it) + ' × ' + k + ' = ' + (it.value * k).toFixed(2) + ', rounded down: bucket <b>' + q + '</b> (the range ' + labels()[q] + '). ' + (buckets[q].length === 1 ? 'It is the first arrival.' : 'It lands behind ' + plural(buckets[q].length - 1, 'number') + '.')
      });
    }
    x = null; bIdx = null;
    for (var q2 = 0; q2 < k; q2++) {
      var bk = buckets[q2];
      if (bk.length > 1) {
        var cmp = 0, arr = bk.slice();
        for (var a = 1; a < arr.length; a++) {
          var key = arr[a], j = a - 1;
          while (j >= 0) { cmp++; if (arr[j].value > key.value) { arr[j + 1] = arr[j]; j--; } else break; }
          arr[j + 1] = key;
        }
        C.comparisons += cmp; C.sortedBuckets++;
        var moved = arr.some(function (it2, idx) { return it2 !== bk[idx]; });
        buckets[q2] = arr;
        var s2 = {}; arr.forEach(function (it2) { s2[it2.id] = 'compare'; });
        snap('sortBucket', {
          line: 'sortBucket', states: s2, activeBucket: q2,
          caption: 'Bucket ' + q2 + ' holds ' + plural(arr.length, 'number') + '. Insertion sort puts them in order with <b>' + cmp + '</b> comparison' + (cmp === 1 ? '' : 's') + (moved ? '' : ' (they happened to arrive in order)') + '. Small buckets are cheap to sort.'
        });
      }
    }
    var next = 0;
    for (var q3 = 0; q3 < k; q3++) {
      if (!buckets[q3].length) continue;
      var moved2 = buckets[q3].slice(); buckets[q3] = [];
      var s3 = {};
      moved2.forEach(function (it3) { slots[next++] = it3; C.collected++; s3[it3.id] = 'done'; });
      snap('collect', {
        line: 'concat', states: s3, activeBucket: q3,
        caption: 'Read bucket ' + q3 + ' back into the list: ' + moved2.map(bname).join(', ') + '. Every number here is larger than everything in earlier buckets and smaller than everything in later ones, so these positions are final.'
      });
    }
    var all = {}; items.forEach(function (it4) { all[it4.id] = 'done'; });
    snap('done', {
      line: 'concat', states: all, activeBucket: null,
      caption: n === 0 ? 'Done.' : '<b>Sorted.</b> ' + plural(C.comparisons, 'comparison') + ' in total, all inside buckets. On evenly spread data every bucket holds about one number, so this is about n work.'
    });
    return steps;
  }

  /* ================================================================== the comparison barrier */
  function factorial(n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; }
  function log2Factorial(n) { var s = 0; for (var i = 2; i <= n; i++) s += Math.log(i) / Math.LN2; return s; }
  function minComparisons(n) { return n < 2 ? 0 : Math.ceil(log2Factorial(n) - 1e-9); }

  /* The decision tree that sorts three items a, b, c: every internal node asks "x < y ?", every leaf is one ordering. */
  var decision3 = {
    root: 'q1',
    nodes: [
      { id: 'q1', cmp: ['a', 'b'], yes: 'q2', no: 'q3' },
      { id: 'q2', cmp: ['b', 'c'], yes: 'abc', no: 'q4' },
      { id: 'q4', cmp: ['a', 'c'], yes: 'acb', no: 'cab' },
      { id: 'q3', cmp: ['a', 'c'], yes: 'bac', no: 'q5' },
      { id: 'q5', cmp: ['b', 'c'], yes: 'bca', no: 'cba' },
      { id: 'abc', leaf: ['a', 'b', 'c'] }, { id: 'acb', leaf: ['a', 'c', 'b'] }, { id: 'cab', leaf: ['c', 'a', 'b'] },
      { id: 'bac', leaf: ['b', 'a', 'c'] }, { id: 'bca', leaf: ['b', 'c', 'a'] }, { id: 'cba', leaf: ['c', 'b', 'a'] }
    ]
  };
  function nodeMap(tree) { var m = {}; tree.nodes.forEach(function (nd) { m[nd.id] = nd; }); return m; }
  function runDecision(tree, vals) {
    var m = nodeMap(tree), cur = m[tree.root], path = [];
    while (!cur.leaf) {
      var ans = vals[cur.cmp[0]] < vals[cur.cmp[1]];
      path.push({ node: cur.id, answer: ans ? 'yes' : 'no' });
      cur = m[ans ? cur.yes : cur.no];
    }
    return { path: path, leaf: cur.id, order: cur.leaf.slice() };
  }
  function treeStats(tree) {
    var m = nodeMap(tree), depths = {}, leaves = 0, height = 0;
    (function walk(id, dd) {
      var nd = m[id];
      if (nd.leaf) { leaves++; depths[id] = dd; if (dd > height) height = dd; return; }
      walk(nd.yes, dd + 1); walk(nd.no, dd + 1);
    }(tree.root, 0));
    return { leaves: leaves, height: height, depths: depths };
  }
  function permutations(n) {
    var out = [];
    (function rec(cur, rest) {
      if (!rest.length) { out.push(cur); return; }
      rest.forEach(function (x, i) { rec(cur.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))); });
    }([], Array.apply(null, Array(n)).map(function (_, i) { return i; })));
    return out;
  }
  /* Run a real comparison sort on every permutation of 0..n-1, log the yes/no answers, and count the distinct
     answer sequences: that is the number of leaves of the algorithm's decision tree. */
  function sortDecisionStats(n, algo) {
    var seen = {}, height = 0, leaves = 0;
    permutations(n).forEach(function (p) {
      var log = [];
      function less(x, y) { var r = x < y; log.push(r ? 1 : 0); return r; }
      var a = p.slice();
      if (algo === 'merge') a = mergeSort(a, less);
      else {
        for (var i = 1; i < a.length; i++) {
          var key = a[i], j = i - 1;
          while (j >= 0 && less(key, a[j])) { a[j + 1] = a[j]; j--; }
          a[j + 1] = key;
        }
      }
      for (var q = 1; q < a.length; q++) if (a[q - 1] > a[q]) throw new Error('sort failed');
      var id = log.join('');
      if (!seen[id]) { seen[id] = true; leaves++; }
      if (log.length > height) height = log.length;
    });
    return { leaves: leaves, height: height };
  }
  function mergeSort(a, less) {
    if (a.length < 2) return a;
    var mid = a.length >> 1, l = mergeSort(a.slice(0, mid), less), r = mergeSort(a.slice(mid), less), out = [], i = 0, j = 0;
    while (i < l.length && j < r.length) { if (less(r[j], l[i])) out.push(r[j++]); else out.push(l[i++]); }
    while (i < l.length) out.push(l[i++]);
    while (j < r.length) out.push(r[j++]);
    return out;
  }

  /* ================================================================== cost models */
  function countingOps(n, k) { return { tally: n, prefix: k, place: n, total: 2 * n + k }; }
  function radixOps(n, d, base) { return { passes: d, perPass: 2 * n + base, total: d * (2 * n + base) }; }

  return {
    counting: counting, radix: radix, bucket: bucketSort,
    labelDuplicates: labelDuplicates, countingRef: countingRef,
    decision3: decision3, runDecision: runDecision, treeStats: treeStats, sortDecisionStats: sortDecisionStats,
    factorial: factorial, log2Factorial: log2Factorial, minComparisons: minComparisons,
    countingOps: countingOps, radixOps: radixOps,
    digitsOf: digitsOf, digitAt: digitAt,
    CODE17: CODE17, META17: META17
  };
}));
