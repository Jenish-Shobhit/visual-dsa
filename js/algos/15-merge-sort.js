/* Lesson 15 · Merge sort & divide and conquer: pure step generators (no DOM).
   Browser: VDSA.algos.mergesort (everything) and, without replacing anything lesson 14 registered, the same
   generators under VDSA.algos.sorting (merge, mergeBottomUp, mergeLevels, mergeRuns, mergeCount, mergeTicks,
   mergeInversions, CODE_MERGE, META_MERGE). Node: module.exports (tests/algos/15-merge-sort.test.js).

   Generators (values: numbers, or {value, label, id} objects; opts.idPrefix sets ids, default 'v'):
     merge(values, opts)              top-down merge sort, every call / split / compare / write, as a recursion-level
                                      trace: rows r0 (whole array) .. rD (single values); items fly down when split and
                                      up when merged. Each step also carries `tree` (recursion tree) and `flat`
                                      (the same moment drawn as ONE array, for races).
     mergeLevels(values)              the same picture one whole level at a time (all splits, then all merges)
     mergeBottomUp(values)            iterative merge sort: runs of 1, 2, 4, 8 ... merging pairwise
     mergeRuns(left, right, opts)     merge two sorted runs in isolation (rows L, R, out); opts.tie 'left' (<=, stable)
                                      or 'right' (<), opts.inversions adds an inversion counter
     mergeCount(values)               {comparisons, writes, levels, merges}   (fast, no steps)
     mergeTicks(steps)                frames[t] = last step whose comparisons + writes <= t   (a fair clock for races)
     mergeInversions(values)          {count, sorted}: inversions counted while merging, O(n log n)
     treeLevels(n)                    the recursion tree of sizes, level by level: [{depth, sizes, internal, work}]
     CODE_MERGE {pseudo, js, py}      code with // @labels that match step.line; META_MERGE the cost facts

   Every step is a complete snapshot that VDSA.views.array can draw (`rows`, `pointers`, `regions`) plus the player
   fields (caption, line, flow, vars, counters). Truth rules (tests/algos/15-merge-sort.test.js): an item is 'done'
   only at its final position (only the last merge writes final positions); equal values keep their order because
   ties take the LEFT run; counters only grow. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.mergesort = api;
    var shared = {
      merge: api.merge, mergeBottomUp: api.mergeBottomUp, mergeLevels: api.mergeLevels, mergeRuns: api.mergeRuns,
      mergeCount: api.mergeCount, mergeTicks: api.mergeTicks, mergeInversions: api.mergeInversions,
      CODE_MERGE: api.CODE_MERGE, META_MERGE: api.META_MERGE
    };
    var sorting = V.algos.sorting = V.algos.sorting || {};
    Object.keys(shared).forEach(function (k) { sorting[k] = shared[k]; });   // never touches lesson 14's keys
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  var NA = { __vdsaRaw: true, text: '–', type: 'undef' };   // "not set" in the variable watch
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(it) {
    if (it.label === undefined || it.label === null || it.label === '') return fmt(it.value);
    var l = String(it.label);
    return fmt(it.value) + (/^[a-z]$/i.test(l) ? '<sub>' + esc(l) + '</sub>' : esc(l));
  }
  function b(it) { return '<b>' + name(it) + '</b>'; }
  function list(its) { return its.map(name).join(', '); }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }
  function plain(s) { return s; }

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
  function cell(it, state, index) {
    var o = { id: it.id, value: it.value, state: state || 'default' };
    if (it.label !== undefined) o.label = it.label;
    if (index !== undefined) o.index = index;
    return o;
  }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE_MERGE = {
    pseudo: [
      'procedure mergeSort(a, lo, hi)                     // @sort',
      '  if hi − lo < 1 then return                     // @base',
      '  mid ← ⌊(lo + hi) / 2⌋                            // @mid',
      '  mergeSort(a, lo, mid)                            // @left',
      '  mergeSort(a, mid + 1, hi)                        // @right',
      '  merge(a, lo, mid, hi)                            // @merge',
      '',
      'procedure merge(a, lo, mid, hi)',
      '  L ← copy of a[lo..mid]                          // @copy',
      '  R ← copy of a[mid+1..hi]',
      '  i ← 0, j ← 0, k ← lo                         // @init',
      '  while i < |L| and j < |R|                        // @loop',
      '    if L[i] ≤ R[j] then                          // @cmp',
      '      a[k] ← L[i]; i ← i + 1; k ← k + 1        // @takeL',
      '    else',
      '      a[k] ← R[j]; j ← j + 1; k ← k + 1        // @takeR',
      '  copy the rest of L into a[k..]                   // @drainL',
      '  copy the rest of R into a[k..]                   // @drainR'
    ].join('\n'),
    js: [
      'function mergeSort(a, lo = 0, hi = a.length - 1) {   // @sort',
      '  if (hi - lo < 1) return;                           // @base',
      '  const mid = Math.floor((lo + hi) / 2);             // @mid',
      '  mergeSort(a, lo, mid);                             // @left',
      '  mergeSort(a, mid + 1, hi);                         // @right',
      '  merge(a, lo, mid, hi);                             // @merge',
      '}',
      '',
      'function merge(a, lo, mid, hi) {',
      '  const L = a.slice(lo, mid + 1);                    // @copy',
      '  const R = a.slice(mid + 1, hi + 1);',
      '  let i = 0, j = 0, k = lo;                          // @init',
      '  while (i < L.length && j < R.length) {             // @loop',
      '    if (L[i] <= R[j]) {                              // @cmp',
      '      a[k++] = L[i++];                               // @takeL',
      '    } else {',
      '      a[k++] = R[j++];                               // @takeR',
      '    }',
      '  }',
      '  while (i < L.length) a[k++] = L[i++];              // @drainL',
      '  while (j < R.length) a[k++] = R[j++];              // @drainR',
      '}'
    ].join('\n'),
    py: [
      'def merge_sort(a, lo=0, hi=None):                     # @sort',
      '    if hi is None: hi = len(a) - 1',
      '    if hi - lo < 1: return                            # @base',
      '    mid = (lo + hi) // 2                              # @mid',
      '    merge_sort(a, lo, mid)                            # @left',
      '    merge_sort(a, mid + 1, hi)                        # @right',
      '    merge(a, lo, mid, hi)                             # @merge',
      '',
      'def merge(a, lo, mid, hi):',
      '    L = a[lo:mid + 1]                                 # @copy',
      '    R = a[mid + 1:hi + 1]',
      '    i = j = 0; k = lo                                 # @init',
      '    while i < len(L) and j < len(R):                  # @loop',
      '        if L[i] <= R[j]:                              # @cmp',
      '            a[k] = L[i]; i += 1; k += 1               # @takeL',
      '        else:',
      '            a[k] = R[j]; j += 1; k += 1               # @takeR',
      '    while i < len(L): a[k] = L[i]; i += 1; k += 1     # @drainL',
      '    while j < len(R): a[k] = R[j]; j += 1; k += 1     # @drainR'
    ].join('\n')
  };

  var META_MERGE = {
    title: 'Merge sort',
    idea: 'Split in half, sort each half, merge the two sorted halves in one linear pass.',
    recurrence: 'T(n) = 2 T(n/2) + n',
    best: 'about (n/2) log₂ n comparisons (already sorted), still n log₂ n writes',
    worst: 'at most n log₂ n − n + 1 comparisons',
    extraSpace: 'O(n) for the copies (a linked list needs O(1))',
    stable: true, inPlace: false, adaptive: false
  };

  /* ------------------------------------------------------------------ the recursion tree of a length-n array */
  /* Nodes {id, lo, hi, depth, left, right}. mid = floor((lo + hi) / 2): the left half gets the extra value. */
  function buildTree(n) {
    var nodes = [], byId = {};
    function go(lo, hi, depth) {
      var node = { id: 'c' + lo + '_' + hi, lo: lo, hi: hi, depth: depth, left: null, right: null };
      nodes.push(node); byId[node.id] = node;
      if (hi - lo >= 1) {
        var mid = (lo + hi) >> 1;
        node.left = go(lo, mid, depth + 1).id;
        node.right = go(mid + 1, hi, depth + 1).id;
      }
      return node;
    }
    if (n > 0) go(0, n - 1, 0);
    var maxDepth = 0;
    nodes.forEach(function (x) { maxDepth = Math.max(maxDepth, x.depth); });
    var breaks = [];
    for (var d = 0; d <= maxDepth; d++) {
      var starts = nodes.filter(function (x) { return x.depth === d; }).map(function (x) { return x.lo; }).sort(function (p, q) { return p - q; });
      breaks.push(starts.slice(1));
    }
    return { nodes: nodes, byId: byId, maxDepth: maxDepth, breaks: breaks };
  }

  /* Recursion tree of sizes, level by level. work = values written by the merges at that level (leaves merge nothing). */
  function treeLevels(n) {
    var t = buildTree(n), out = [];
    if (n < 1) return out;
    for (var d = 0; d <= t.maxDepth; d++) {
      var at = t.nodes.filter(function (x) { return x.depth === d; });
      var internal = at.filter(function (x) { return x.hi > x.lo; });
      out.push({
        depth: d,
        sizes: at.map(function (x) { return x.hi - x.lo + 1; }),
        internal: internal.length,
        work: internal.reduce(function (s, x) { return s + (x.hi - x.lo + 1); }, 0)
      });
    }
    return out;
  }

  /* ------------------------------------------------------------------ fast counters and reference merge */
  /* Merge two sorted arrays of plain values; ties take the left one. Returns {out, comparisons, cross} where
     cross counts (left, right) pairs with left > right, i.e. the inversions between the two runs. */
  function mergeValues(L, R) {
    var out = [], i = 0, j = 0, comparisons = 0, cross = 0;
    while (i < L.length && j < R.length) {
      comparisons++;
      if (L[i] <= R[j]) out.push(L[i++]);
      else { cross += L.length - i; out.push(R[j++]); }
    }
    while (i < L.length) out.push(L[i++]);
    while (j < R.length) out.push(R[j++]);
    return { out: out, comparisons: comparisons, cross: cross };
  }
  function sortValues(a, acc) {
    if (a.length < 2) return a.slice();
    var mid = (a.length + 1) >> 1;          // == floor((lo + hi) / 2) - lo + 1: the left half gets the extra value
    var L = sortValues(a.slice(0, mid), acc), R = sortValues(a.slice(mid), acc);
    var m = mergeValues(L, R);
    acc.comparisons += m.comparisons; acc.writes += a.length; acc.merges++; acc.cross += m.cross;
    return m.out;
  }
  function mergeCount(values) {
    var acc = { comparisons: 0, writes: 0, merges: 0, cross: 0 };
    var a = (values || []).map(valueOf);
    sortValues(a, acc);
    return { comparisons: acc.comparisons, writes: acc.writes, merges: acc.merges, levels: a.length < 2 ? 0 : Math.ceil(Math.log2(a.length)) };
  }
  function mergeInversions(values) {
    var acc = { comparisons: 0, writes: 0, merges: 0, cross: 0 };
    var sorted = sortValues((values || []).map(valueOf), acc);
    return { count: acc.cross, sorted: sorted };
  }

  /* ------------------------------------------------------------------ top-down trace */
  function merge(values, opts) {
    opts = opts || {};
    var items = normalize(values, opts.idPrefix), n = items.length;
    var T = buildTree(n), rowsN = T.maxDepth + 1;
    var pos = {}, st = {};
    items.forEach(function (it, k) { pos[it.id] = { row: 0, slot: k }; st[it.id] = 'default'; });
    var byIdItem = {};
    items.forEach(function (it) { byIdItem[it.id] = it; });
    var finalSlot = {};
    items.map(function (it, k) { return { it: it, k: k }; }).sort(function (x, y) { return x.it.value - y.it.value || x.k - y.k; })
      .forEach(function (e, r) { finalSlot[e.it.id] = r; });
    var ops = { comparisons: 0, writes: 0 };
    var steps = [];
    var tnodes = {}, torder = [];            // tree nodes seen so far
    var flatCtx = null;                      // the merge in progress, for the single-array picture
    var finished = false;

    function rowsState(o) {
      var rows = [];
      for (var r = 0; r < rowsN; r++) rows.push({ id: 'r' + r, label: 'depth ' + r, items: [], breaks: T.breaks[r], showIndices: r === 0 });
      items.forEach(function (it) { var p = pos[it.id]; rows[p.row].items.push(cell(it, st[it.id], p.slot)); });
      return rows;
    }
    function flatState(regions) {
      var slotOf = {};
      items.forEach(function (it) { slotOf[it.id] = pos[it.id].slot; });
      if (flatCtx) {
        var c = flatCtx, s = c.lo;
        c.out.forEach(function (id) { slotOf[id] = s++; });
        c.remL.forEach(function (id) { slotOf[id] = s++; });
        c.remR.forEach(function (id) { slotOf[id] = s++; });
      }
      return { items: items.map(function (it) { return cell(it, st[it.id], slotOf[it.id]); }), regions: regions || [] };
    }
    function treeState() {
      if (!torder.length) {
        if (!n) return null;
        var rl = n <= 4 ? items.map(function (it) { return fmt(it.value); }).join(' ') : 'a[0..' + (n - 1) + ']';
        return { root: 'c0_' + (n - 1), nodes: [{ id: 'c0_' + (n - 1), value: rl, label: rl, state: 'default' }] };   // the call that has not started yet
      }
      return {
        root: torder[0].id,
        nodes: torder.map(function (t) {
          var label;
          if (t.hi - t.lo + 1 <= 4) label = (t.state === 'done' ? t.sorted : t.vals).map(fmt).join(' ');
          else label = 'a[' + t.lo + '..' + t.hi + ']';
          // tree states: active = the running call, frontier = waiting for its halves, visited = returned a sorted run,
          // done = the finished array (only the root, only at the very end)
          var o = { id: t.id, value: label, label: label, state: t.state === 'done' ? (finished && t === torder[0] ? 'done' : 'visited') : t.state };
          if (t.left) o.left = t.left;
          if (t.right) o.right = t.right;
          return o;
        })
      };
    }
    function snap(kind, o) {
      o = o || {};
      var regions = o.regions || [];
      var step = {
        algo: 'merge', kind: kind, rows: rowsState(o), pointers: o.pointers || [], regions: regions,
        flat: flatState(o.flatRegions || []), tree: treeState(),
        caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow,
        vars: o.vars, counters: { comparisons: ops.comparisons, writes: ops.writes },
        ops: { comparisons: ops.comparisons, writes: ops.writes }
      };
      if (o.range) step.range = o.range;
      steps.push(step);
      return step;
    }
    function settle() { items.forEach(function (it) { if (st[it.id] === 'swap') st[it.id] = 'visited'; }); }
    function vars(o) {
      var v = { lo: NA, mid: NA, hi: NA, L: NA, R: NA, i: NA, j: NA, k: NA };
      Object.keys(o).forEach(function (key) { v[key] = o[key]; });
      return v;
    }
    function nodeItems(lo, hi, row) {
      return items.filter(function (it) { var p = pos[it.id]; return p.row === row && p.slot >= lo && p.slot <= hi; })
        .sort(function (x, y) { return pos[x.id].slot - pos[y.id].slot; });
    }
    function span(lo, hi, depth, state, label) {
      var o = { id: 'seg' + lo + '_' + hi, from: lo, to: hi, state: state || 'active', row: 'r' + depth };
      if (label) o.label = label;
      return o;
    }
    function rangeText(lo, hi) { return lo === hi ? 'a[' + lo + ']' : 'a[' + lo + '..' + hi + ']'; }

    if (n === 0) {
      snap('start', { caption: 'The array is empty, so there is nothing to sort and nothing to merge.', flow: 'start', line: 'sort', vars: vars({ lo: 0, hi: -1 }) });
      snap('done', { caption: 'An empty array is already sorted. Try one value, or add a few more.', flow: 'ret', line: null, vars: vars({ lo: 0, hi: -1 }) });
      return steps;
    }

    snap('start', {
      caption: n === 1
        ? 'One value. A single value is already sorted, so merge sort has nothing to do.'
        : plural(n, 'value') + ' in one run. Merge sort splits the run in half, again and again, until every piece holds a single value, then merges the pieces back together in order.',
      line: null, flow: 'start', vars: vars({ lo: 0, hi: n - 1 })
    });

    function sort(lo, hi, depth, side) {
      var t = { id: 'c' + lo + '_' + hi, lo: lo, hi: hi, depth: depth, state: 'active', left: null, right: null,
        vals: nodeItems(lo, hi, depth).map(function (it) { return it.value; }), sorted: null };
      torder.push(t); tnodes[t.id] = t;
      var parent = torder.filter(function (x) { return x.depth === depth - 1 && x.lo <= lo && x.hi >= hi; })[0];
      if (parent) { if (side === 'left') parent.left = t.id; else parent.right = t.id; }
      var size = hi - lo + 1, segItems = nodeItems(lo, hi, depth);
      var isLeaf = hi - lo < 1;
      var where = side === 'root' ? 'on the whole array' : 'on the ' + side + ' half ' + rangeText(lo, hi);
      var callCap = side === 'root'
        ? 'Call <code>mergeSort(a, 0, ' + (n - 1) + ')</code> on the whole array.'
        : 'Call <code>mergeSort(a, ' + lo + ', ' + hi + ')</code> on the ' + side + ' half. Until it returns, only these ' + plural(size, 'value') + ' matter.';
      snap('call', {
        caption: callCap, line: side === 'root' ? 'sort' : side, flow: side === 'root' ? 'start|small' : 'conquer|small',
        regions: [span(lo, hi, depth, 'active')], vars: vars({ lo: lo, hi: hi }), range: [lo, hi, depth]
      });
      if (isLeaf) {
        var only = segItems[0];
        st[only.id] = 'visited';
        t.state = 'done'; t.sorted = [only.value];
        snap('base', {
          caption: 'hi − lo = 0, so this piece has one value, ' + b(only) + '. Nothing can be out of order in a single value, so it is a sorted run and <code>mergeSort</code> returns at once.',
          line: 'base', flow: 'base', regions: [span(lo, hi, depth, 'visited')], vars: vars({ lo: lo, hi: hi }), range: [lo, hi, depth]
        });
        return;
      }
      var mid = (lo + hi) >> 1;
      var leftItems = segItems.filter(function (it) { return pos[it.id].slot <= mid; });
      var rightItems = segItems.filter(function (it) { return pos[it.id].slot > mid; });
      leftItems.concat(rightItems).forEach(function (it) { pos[it.id] = { row: depth + 1, slot: pos[it.id].slot }; });
      snap('split', {
        caption: rangeText(lo, hi) + ' holds ' + plural(size, 'value') + ', more than one, so divide: <code>mid = ⌊(' + lo + ' + ' + hi + ') / 2⌋ = ' + mid + '</code>. The left half is ' +
          rangeText(lo, mid) + ' (' + plural(leftItems.length, 'value') + '), the right half ' + rangeText(mid + 1, hi) + ' (' + plural(rightItems.length, 'value') + '). Both halves drop one row.',
        line: 'mid', flow: 'divide', regions: [span(lo, mid, depth + 1, 'active'), span(mid + 1, hi, depth + 1, 'active')],
        vars: vars({ lo: lo, mid: mid, hi: hi }), range: [lo, hi, depth]
      });
      t.state = 'frontier';
      sort(lo, mid, depth + 1, 'left');
      t.state = 'frontier';
      sort(mid + 1, hi, depth + 1, 'right');
      t.state = 'active';
      mergeStep(t, lo, mid, hi, depth);
    }

    function mergeStep(t, lo, mid, hi, depth) {
      var L = nodeItems(lo, mid, depth + 1), R = nodeItems(mid + 1, hi, depth + 1);
      var Lv = L.map(function (x) { return x.value; }), Rv = R.map(function (x) { return x.value; });
      var root = depth === 0, i = 0, j = 0, k = lo;
      var outIds = [];
      flatCtx = { lo: lo, out: outIds, remL: L.map(function (x) { return x.id; }), remR: R.map(function (x) { return x.id; }) };
      var region = [span(lo, hi, depth, 'active')];
      function ptrs() {
        var p = [];
        if (i < L.length) p.push({ name: 'i', row: 'r' + (depth + 1), index: lo + i, state: 'active', side: 'above' });
        if (j < R.length) p.push({ name: 'j', row: 'r' + (depth + 1), index: mid + 1 + j, state: 'frontier', side: 'above' });
        if (k <= hi) p.push({ name: 'k', row: 'r' + depth, index: k, state: 'swap', side: 'above' });
        return p;
      }
      function mvars() { return vars({ lo: lo, mid: mid, hi: hi, L: Lv, R: Rv, i: i, j: j, k: k }); }
      snap('mergeStart', {
        caption: 'Both halves of ' + rangeText(lo, hi) + ' are sorted runs: <b>' + Lv.map(fmt).join(', ') + '</b> and <b>' + Rv.map(fmt).join(', ') + '</b>. Merge them one row up: <code>i</code> marks the front of the left run, <code>j</code> the front of the right run, <code>k</code> the next free slot of the output.',
        line: ['copy', 'init'], flow: 'combine', regions: region, pointers: ptrs(), vars: mvars(), range: [lo, hi, depth]
      });
      while (i < L.length && j < R.length) {
        var a = L[i], c = R[j];
        settle();
        st[a.id] = 'compare'; st[c.id] = 'compare';
        ops.comparisons++;
        var takeLeft = a.value <= c.value;
        var why = a.value === c.value
          ? 'They are equal, so take the <b>left</b> one (<code>≤</code>): the value that came first stays first, which makes merge sort stable.'
          : 'Each run is sorted, so its front is its smallest value, and the smaller front is the smallest of everything not yet written: ' + b(takeLeft ? a : c) + ' goes next.';
        var cmpStep = snap('compare', {
          caption: 'Compare the two fronts: <code>L[' + i + ']</code> = ' + b(a) + ' and <code>R[' + j + ']</code> = ' + b(c) + '. ' + why,
          line: 'cmp', flow: 'combine', regions: region, pointers: ptrs(), vars: mvars(), range: [lo, hi, depth]
        });
        cmpStep.next = takeLeft ? a.id : c.id;
        cmpStep.nextSide = takeLeft ? 'L' : 'R';
        var w = takeLeft ? a : c;
        st[a.id] = 'visited'; st[c.id] = 'visited';
        pos[w.id] = { row: depth, slot: k };
        outIds.push(w.id);
        if (takeLeft) { flatCtx.remL.shift(); i++; } else { flatCtx.remR.shift(); j++; }
        k++; ops.writes++;
        st[w.id] = 'swap';
        var last = k > hi;
        snap('take', {
          caption: 'Write ' + b(w) + ' to <code>a[' + (k - 1) + ']</code> and advance <code>' + (takeLeft ? 'i' : 'j') + '</code>. ' +
            (last ? rangeText(lo, hi) + ' is now one sorted run' + (root ? ', and the values of the last merge are in their final places: the array is sorted.' : ': ' + Lv.length + ' + ' + Rv.length + ' values in ' + plural(Lv.length + Rv.length, 'write') + '.') : 'The output only grows to the right; nothing written is touched again.'),
          line: takeLeft ? 'takeL' : 'takeR', flow: 'combine', regions: region, pointers: ptrs(), vars: mvars(), range: [lo, hi, depth]
        });
        if (root) st[w.id] = 'done';   // the root merge writes final positions: the newest shows as moved for this step, then done
      }
      var leftOver = L.slice(i), rightOver = R.slice(j);
      var rest = leftOver.length ? leftOver : rightOver, fromLeft = leftOver.length > 0;
      if (rest.length) {
        settle();
        var moved = [];
        rest.forEach(function (it) {
          pos[it.id] = { row: depth, slot: k };
          outIds.push(it.id);
          if (fromLeft) flatCtx.remL.shift(); else flatCtx.remR.shift();
          k++; ops.writes++; st[it.id] = 'swap'; moved.push(it);
        });
        if (fromLeft) i = L.length; else j = R.length;
        snap('drain', {
          caption: 'The ' + (fromLeft ? 'right' : 'left') + ' run is used up. What is left of the ' + (fromLeft ? 'left' : 'right') + ' run, <b>' + list(moved) + '</b>, is sorted and no smaller than anything written, so copy ' + (moved.length === 1 ? 'it' : 'them') + ' over: ' + plural(moved.length, 'write') + ', no comparisons. ' +
            rangeText(lo, hi) + ' is now one sorted run' + (root ? ', and the values of the last merge are in their final places.' : '.'),
          line: fromLeft ? 'drainL' : 'drainR', flow: 'combine', regions: region, pointers: [], vars: mvars(), range: [lo, hi, depth]
        });
      }
      // the merge is over: the run is sorted; only the root run is final
      flatCtx = null;
      var sortedNow = nodeItems(lo, hi, depth);
      t.state = 'done'; t.sorted = sortedNow.map(function (x) { return x.value; });
      sortedNow.forEach(function (it) { st[it.id] = root ? 'done' : 'swap'; });
      if (!root) settle();
    }

    sort(0, n - 1, 0, 'root');
    items.forEach(function (it) { st[it.id] = 'done'; });
    finished = true;
    snap('done', {
      caption: n === 1 ? 'Sorted.' : 'Sorted. ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.writes, 'write') + ' for ' + plural(n, 'value') + ' across ' + plural(T.maxDepth, 'level') + ' of merging: every level of merging writes each value once, so the writes are about <i>n</i> per level.',
      line: null, flow: 'ret', regions: [span(0, n - 1, 0, 'done', 'sorted')], flatRegions: [{ id: 'all', from: 0, to: n - 1, state: 'done', label: 'sorted' }],
      vars: vars({ lo: 0, hi: n - 1 }), range: [0, n - 1, 0]
    });
    return steps;
  }

  /* ------------------------------------------------------------------ level-at-a-time trace (teaser, figure) */
  function mergeLevels(values, opts) {
    opts = opts || {};
    var items = normalize(values, opts.idPrefix), n = items.length;
    var T = buildTree(n), rowsN = T.maxDepth + 1;
    var pos = {}, st = {}, steps = [];
    items.forEach(function (it, k) { pos[it.id] = { row: 0, slot: k }; st[it.id] = 'default'; });
    var ops = { comparisons: 0, writes: 0 };
    function snap(kind, caption, extra) {
      var rows = [];
      for (var r = 0; r < rowsN; r++) rows.push({ id: 'r' + r, label: 'depth ' + r, items: [], breaks: T.breaks[r], showIndices: r === 0 });
      items.forEach(function (it) { var p = pos[it.id]; rows[p.row].items.push(cell(it, st[it.id], p.slot)); });
      var step = { algo: 'levels', kind: kind, rows: rows, pointers: [], regions: (extra && extra.regions) || [], caption: caption,
        counters: { comparisons: ops.comparisons, writes: ops.writes } };
      if (extra) Object.keys(extra).forEach(function (k) { if (k !== 'regions') step[k] = extra[k]; });
      steps.push(step);
    }
    function nodeItems(nd, row) {
      return items.filter(function (it) { var p = pos[it.id]; return p.row === row && p.slot >= nd.lo && p.slot <= nd.hi; })
        .sort(function (x, y) { return pos[x.id].slot - pos[y.id].slot; });
    }
    function sizesText(sizes) {
      var count = {}, keys = [];
      sizes.forEach(function (x) { if (!count[x]) { count[x] = 0; keys.push(x); } count[x]++; });
      keys.sort(function (p, q) { return q - p; });
      var parts = keys.map(function (x) { return count[x] + (count[x] === 1 ? ' run' : ' runs') + ' of ' + x; });
      return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    }
    if (n === 0) { snap('start', 'Nothing to sort.'); return steps; }
    // leaves that already exist at the start
    if (n === 1) st[items[0].id] = 'done';
    snap('start', n === 1 ? 'One value is already sorted.' : plural(n, 'value') + ' in one run.', { level: 0 });
    var d, nodesAt;
    for (d = 0; d < T.maxDepth; d++) {
      nodesAt = T.nodes.filter(function (x) { return x.depth === d && x.hi > x.lo; });
      nodesAt.forEach(function (nd) {
        nodeItems(nd, d).forEach(function (it) { pos[it.id] = { row: d + 1, slot: pos[it.id].slot }; });
      });
      // leaves born at depth d + 1
      T.nodes.filter(function (x) { return x.depth === d + 1 && x.hi === x.lo; }).forEach(function (nd) { nodeItems(nd, d + 1).forEach(function (it) { st[it.id] = 'visited'; }); });
      var sizes = treeLevels(n)[d + 1].sizes;
      snap('split', 'Split every run in half: level ' + (d + 1) + ' has ' + sizesText(sizes) + '.' + (d + 1 === T.maxDepth ? ' Every run is one value, and one value is already sorted.' : ''), { level: d + 1 });
    }
    for (d = T.maxDepth - 1; d >= 0; d--) {
      nodesAt = T.nodes.filter(function (x) { return x.depth === d && x.hi > x.lo; });
      var comps = 0, written = 0;
      nodesAt.forEach(function (nd) {
        var mid = (nd.lo + nd.hi) >> 1;
        var L = nodeItems({ lo: nd.lo, hi: mid }, d + 1), R = nodeItems({ lo: mid + 1, hi: nd.hi }, d + 1);
        var i = 0, j = 0, out = [];
        while (i < L.length && j < R.length) { comps++; if (L[i].value <= R[j].value) out.push(L[i++]); else out.push(R[j++]); }
        while (i < L.length) out.push(L[i++]);
        while (j < R.length) out.push(R[j++]);
        out.forEach(function (it, t) { pos[it.id] = { row: d, slot: nd.lo + t }; st[it.id] = d === 0 ? 'done' : 'swap'; written++; });
      });
      ops.comparisons += comps; ops.writes += written;
      snap('merge', 'Merge level ' + d + ': ' + plural(nodesAt.length, 'pair') + ' of sorted runs ' + (nodesAt.length === 1 ? 'merges' : 'merge') + ', so level ' + d + ' now holds ' + sizesText(treeLevels(n)[d].sizes) + '. ' + plural(written, 'value') + ' written, ' + plural(comps, 'comparison') + '.' + (d === 0 ? ' The whole array is sorted.' : ''), { level: d });
      items.forEach(function (it) { if (st[it.id] === 'swap') st[it.id] = 'visited'; });
    }
    return steps;
  }

  /* ------------------------------------------------------------------ bottom-up merge sort */
  function mergeBottomUp(values, opts) {
    opts = opts || {};
    var items = normalize(values, opts.idPrefix), n = items.length;
    var m = 0; while ((1 << m) < n) m++;
    var pos = {}, st = {}, steps = [], ops = { comparisons: 0, writes: 0 };
    var breaks = [];
    for (var r = 0; r <= m; r++) { var br = []; for (var s = 1 << r; s < n; s += 1 << r) br.push(s); breaks.push(br); }
    items.forEach(function (it, k) { pos[it.id] = { row: 0, slot: k }; st[it.id] = 'visited'; });
    function snap(kind, caption, extra) {
      var rows = [];
      for (var q = 0; q <= m; q++) rows.push({ id: 'r' + q, label: 'runs of ' + (1 << q), items: [], breaks: breaks[q], showIndices: q === 0 });
      items.forEach(function (it) { var p = pos[it.id]; rows[p.row].items.push(cell(it, st[it.id], p.slot)); });
      var step = { algo: 'bottomUp', kind: kind, rows: rows, pointers: [], regions: (extra && extra.regions) || [], caption: caption,
        counters: { comparisons: ops.comparisons, writes: ops.writes } };
      if (extra) Object.keys(extra).forEach(function (k) { if (k !== 'regions') step[k] = extra[k]; });
      steps.push(step);
    }
    function settle() { items.forEach(function (it) { if (st[it.id] === 'swap') st[it.id] = 'visited'; }); }
    if (n === 0) { snap('start', 'Nothing to sort.'); return steps; }
    if (n === 1) st[items[0].id] = 'done';
    snap('start', n === 1 ? 'One value is already sorted.' : plural(n, 'value') + ' are ' + n + ' sorted runs of length 1. No recursion needed: start from the bottom and merge neighbouring runs.', { width: 1 });
    var byRow = function (row, lo, hi) {
      return items.filter(function (it) { var p = pos[it.id]; return p.row === row && p.slot >= lo && p.slot <= hi; }).sort(function (x, y) { return pos[x.id].slot - pos[y.id].slot; });
    };
    var row = 0;
    for (var width = 1; width < n; width *= 2, row++) {
      for (var lo = 0; lo < n; lo += 2 * width) {
        settle();
        var mid = lo + width - 1, hi = Math.min(lo + 2 * width - 1, n - 1);
        if (mid >= n - 1) {
          var lone = byRow(row, lo, hi);
          lone.forEach(function (it) { pos[it.id] = { row: row + 1, slot: pos[it.id].slot }; st[it.id] = 'swap'; });
          ops.writes += lone.length;
          snap('carry', 'The last run, a[' + lo + (hi > lo ? '..' + hi : '') + '], has no partner in this pass, so it moves up unchanged. (In real code it is simply left in place; the picture moves it so every row shows the whole array.)', { width: width, range: [lo, hi] });
          continue;
        }
        var L = byRow(row, lo, mid), R = byRow(row, mid + 1, hi);
        var i = 0, j = 0, out = [], cmp = 0;
        while (i < L.length && j < R.length) { cmp++; if (L[i].value <= R[j].value) out.push(L[i++]); else out.push(R[j++]); }
        while (i < L.length) out.push(L[i++]);
        while (j < R.length) out.push(R[j++]);
        var lastMerge = width * 2 >= n;
        out.forEach(function (it, t) { pos[it.id] = { row: row + 1, slot: lo + t }; st[it.id] = lastMerge ? 'done' : 'swap'; });
        ops.comparisons += cmp; ops.writes += out.length;
        snap('merge', 'Merge the runs <b>' + L.map(function (x) { return fmt(x.value); }).join(', ') + '</b> and <b>' + R.map(function (x) { return fmt(x.value); }).join(', ') + '</b> into one run of ' + out.length + ': ' +
          plural(cmp, 'comparison') + ', ' + plural(out.length, 'write') + '.' + (lastMerge ? ' This merge covers the whole array, so its values are in their final places.' : ''), { width: width, range: [lo, hi] });
      }
      settle();
      if (width * 2 < n) {
        // a marker step after each pass keeps the story readable: the whole row moved up
        steps[steps.length - 1].caption += ' Pass ' + (row + 1) + ' of ' + m + ' is complete: runs of ' + (2 * width) + '.';
      }
    }
    return steps;
  }

  /* ------------------------------------------------------------------ two runs in isolation */
  function mergeRuns(left, right, opts) {
    opts = opts || {};
    var tie = opts.tie === 'right' ? 'right' : 'left';
    var L = normalize(left, 'l'), R = normalize(right, 'r');
    var nL = L.length, nR = R.length, total = nL + nR;
    var pos = {}, st = {}, steps = [], i = 0, j = 0, k = 0, cmp = 0, inv = 0;
    var out = [];
    L.forEach(function (it, x) { pos[it.id] = { row: 'L', slot: x }; st[it.id] = 'visited'; });
    R.forEach(function (it, x) { pos[it.id] = { row: 'R', slot: x }; st[it.id] = 'visited'; });
    function counters() { var c = { comparisons: cmp, written: k }; if (opts.inversions) c.inversions = inv; return c; }
    function snap(kind, caption, extra) {
      var rows = [
        { id: 'L', label: 'left run', items: [], length: nL },
        { id: 'R', label: 'right run', items: [], length: nR },
        { id: 'out', label: 'output', items: [], length: total }
      ];
      var byRow = { L: rows[0], R: rows[1], out: rows[2] };
      L.concat(R).forEach(function (it) { var p = pos[it.id]; byRow[p.row].items.push(cell(it, st[it.id], p.slot)); });
      var ptrs = [];
      if (i < nL) ptrs.push({ name: 'i', row: 'L', index: i, state: 'active', side: 'above' });
      if (j < nR) ptrs.push({ name: 'j', row: 'R', index: j, state: 'frontier', side: 'above' });
      if (k < total) ptrs.push({ name: 'k', row: 'out', index: k, state: 'swap', side: 'above' });
      var step = { algo: 'runs', kind: kind, rows: rows, pointers: ptrs, regions: [], caption: caption, counters: counters(), ops: { comparisons: cmp, writes: k } };
      if (extra) Object.keys(extra).forEach(function (key) { step[key] = extra[key]; });
      steps.push(step);
      return step;
    }
    function settle() { L.concat(R).forEach(function (it) { if (st[it.id] === 'swap') st[it.id] = 'done'; }); }
    snap('start', 'Two sorted runs and an empty output row. <code>i</code> marks the front of the left run, <code>j</code> the front of the right run, <code>k</code> the next free output slot.');
    while (i < nL && j < nR) {
      settle();
      var a = L[i], c = R[j];
      st[a.id] = 'compare'; st[c.id] = 'compare'; cmp++;
      var takeLeft = tie === 'left' ? a.value <= c.value : a.value < c.value;
      var why = a.value === c.value
        ? (tie === 'left' ? 'A tie: take the <b>left</b> one, so equal values keep their original order.' : 'A tie, and this merge takes the <b>right</b> one: equal values swap order.')
        : b(takeLeft ? a : c) + ' is smaller, and both runs are sorted, so nothing still waiting can be smaller.';
      var cs = snap('compare', 'Compare ' + b(a) + ' and ' + b(c) + '. ' + why, { next: takeLeft ? a.id : c.id, nextSide: takeLeft ? 'L' : 'R' });
      var w = takeLeft ? a : c;
      st[a.id] = 'visited'; st[c.id] = 'visited';
      var remL = nL - i;
      if (!takeLeft) inv += a.value > c.value ? remL : 0;
      pos[w.id] = { row: 'out', slot: k }; out.push(w); k++;
      if (takeLeft) i++; else j++;
      st[w.id] = 'swap';
      var extra = null;
      var cap = 'Write ' + b(w) + ' to the output and advance <code>' + (takeLeft ? 'i' : 'j') + '</code>.';
      if (opts.inversions && !takeLeft) cap += ' It jumped over the ' + plural(remL, 'value') + ' still waiting in the left run: ' + plural(remL, 'inversion') + ' found.';
      snap('take', cap, { taken: w.id });
    }
    var rest = i < nL ? L.slice(i) : R.slice(j), fromLeft = i < nL;
    if (rest.length) {
      settle();
      rest.forEach(function (it) { pos[it.id] = { row: 'out', slot: k }; out.push(it); k++; st[it.id] = 'swap'; });
      if (fromLeft) i = nL; else j = nR;
      snap('drain', 'The ' + (fromLeft ? 'right' : 'left') + ' run is empty. The rest of the ' + (fromLeft ? 'left' : 'right') + ' run, <b>' + list(rest) + '</b>, is already in order, so copy ' + (rest.length === 1 ? 'it' : 'them') + ' over without comparing.', { drained: rest.map(function (x) { return x.id; }) });
    }
    settle();
    L.concat(R).forEach(function (it) { st[it.id] = 'done'; });
    snap('done', 'Merged: ' + plural(total, 'value') + ' written with ' + plural(cmp, 'comparison') + '. Every comparison wrote exactly one value, so a merge never needs more than ' + Math.max(0, total - 1) + ' comparisons.' + (opts.inversions ? ' Inversions found: ' + inv + '.' : ''));
    return steps;
  }

  /* Frames for a race: frames[t] = last step whose comparisons + writes is <= t, for t = 0 .. total. */
  function mergeTicks(steps) {
    if (!steps || !steps.length) return [];
    function work(s) { return s.ops.comparisons + s.ops.writes; }
    var total = work(steps[steps.length - 1]), frames = [], k = 0;
    for (var t = 0; t <= total; t++) {
      while (k + 1 < steps.length && work(steps[k + 1]) <= t) k++;
      frames.push(t === 0 ? steps[0] : steps[k]);   // tick 0 is the untouched input
    }
    return frames;
  }

  return {
    merge: merge, mergeLevels: mergeLevels, mergeBottomUp: mergeBottomUp, mergeRuns: mergeRuns,
    mergeCount: mergeCount, mergeTicks: mergeTicks, mergeInversions: mergeInversions, treeLevels: treeLevels,
    buildTree: buildTree, normalize: normalize, mergeValues: mergeValues,
    CODE_MERGE: CODE_MERGE, META_MERGE: META_MERGE
  };
}));
