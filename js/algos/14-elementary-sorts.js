/* Elementary sorts: pure step generators for bubble, selection and insertion sort (plus cocktail shaker sort).
   No DOM. UMD: in the browser it merges into VDSA.algos.sorting (other sorting lessons add to the same object);
   in Node it exports the same API.

     VDSA.algos.sorting.bubble(values, opts)     -> steps
     VDSA.algos.sorting.selection(values, opts)  -> steps
     VDSA.algos.sorting.insertion(values, opts)  -> steps
     VDSA.algos.sorting.cocktail(values, opts)   -> steps
     VDSA.algos.sorting.run(name, values, opts)  -> steps
     VDSA.algos.sorting.count(name, values)      -> {comparisons, swaps, shifts, writes, rounds}  (fast, no steps)
     VDSA.algos.sorting.inversions(values)       -> {count, pairs: [[i, j], ...]}  (i < j and a[i] > a[j])
     VDSA.algos.sorting.roundFrames(steps)       -> [start, end of round 1, end of round 2, ...]
     VDSA.algos.sorting.opFrames(steps)          -> steps where a comparison or a move happened (+ first and last)
     VDSA.algos.sorting.CODE[name]               -> {pseudo, js, py} with // @labels matching step.line
     VDSA.algos.sorting.META[name]               -> title, invariant, costs, stable, adaptive …

   values: numbers, or {value, label, id} objects (labels tag equal keys, e.g. 'a', 'b' or card suits).
   opts:   {idPrefix: 'v'} item ids are idPrefix + original index; bubble/cocktail also take {earlyExit: true}.

   Every step is a complete snapshot that VDSA.views.array can draw directly:
     { algo, kind, round, roundEnd,
       items: [{id, value, state, label?, index?}], held, ghosts, pointers, regions,   <- array view state
       order: [id | null],   ids by position (null = the hole while insertion sort holds its key)
       final: [index],       positions proven final: their item never moves again
       caption, line, flow, vars, varStates, counters,                                   <- player fields
       ops: {comparisons, swaps, shifts, writes} }
   Truth rules (tested in tests/algos/14-elementary-sorts.test.js): an item is 'done' only at a final position;
   comparisons are strict (a[j] > a[j+1], a[j] < a[min], a[j] > key), so bubble and insertion sort are stable
   and selection sort keeps the FIRST copy of a repeated minimum; counters only ever grow. */
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
  var NA = { __vdsaRaw: true, text: '–', type: 'undef' };   // "not set" in the variable watch (VDSA.vars.raw shape)

  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* Display name of an item in captions: 7, 4<sub>a</sub> (letter tags) or 5♠ (anything else). */
  function name(it) {
    if (it.label === undefined || it.label === null || it.label === '') return fmt(it.value);
    var l = String(it.label);
    return fmt(it.value) + (/^[a-z]$/i.test(l) ? '<sub>' + esc(l) + '</sub>' : esc(l));
  }
  function b(it) { return '<b>' + name(it) + '</b>'; }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }

  /* Normalise input into items {id, value, label}. Ids follow the ORIGINAL position, so they are stable. */
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
  /* One array-view item. `index` only when the row has gaps (insertion sort's hole). */
  function cell(it, state, index) {
    var o = { id: it.id, value: it.value, state: state || 'default' };
    if (it.label !== undefined) o.label = it.label;
    if (index !== undefined) o.index = index;
    return o;
  }
  function range(lo, hi) { var out = []; for (var k = lo; k <= hi; k++) out.push(k); return out; }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE = {
    bubble: {
      pseudo: [
        'procedure bubbleSort(a)',
        '  for i ← 0 to n − 2                  // @pass',
        '    swapped ← false                   // @reset',
        '    for j ← 0 to n − 2 − i            // @inner',
        '      if a[j] > a[j + 1] then         // @cmp',
        '        swap a[j] and a[j + 1]        // @swap',
        '        swapped ← true                // @swap',
        '    if not swapped then stop          // @exit',
        '  return a                            // @done'
      ].join('\n'),
      js: [
        'function bubbleSort(a) {',
        '  const n = a.length;',
        '  for (let i = 0; i < n - 1; i++) {          // @pass',
        '    let swapped = false;                      // @reset',
        '    for (let j = 0; j < n - 1 - i; j++) {     // @inner',
        '      if (a[j] > a[j + 1]) {                  // @cmp',
        '        [a[j], a[j + 1]] = [a[j + 1], a[j]];  // @swap',
        '        swapped = true;                       // @swap',
        '      }',
        '    }',
        '    if (!swapped) break;                      // @exit',
        '  }',
        '  return a;                                   // @done',
        '}'
      ].join('\n'),
      py: [
        'def bubble_sort(a):',
        '    n = len(a)',
        '    for i in range(n - 1):                    # @pass',
        '        swapped = False                       # @reset',
        '        for j in range(n - 1 - i):            # @inner',
        '            if a[j] > a[j + 1]:               # @cmp',
        '                a[j], a[j + 1] = a[j + 1], a[j]  # @swap',
        '                swapped = True                # @swap',
        '        if not swapped:                       # @exit',
        '            break                             # @exit',
        '    return a                                  # @done'
      ].join('\n')
    },
    selection: {
      pseudo: [
        'procedure selectionSort(a)',
        '  for i ← 0 to n − 2                  // @pass',
        '    min ← i                           // @init',
        '    for j ← i + 1 to n − 1            // @inner',
        '      if a[j] < a[min] then           // @cmp',
        '        min ← j                       // @newmin',
        '    if min ≠ i then                   // @check',
        '      swap a[i] and a[min]            // @swap',
        '  return a                            // @done'
      ].join('\n'),
      js: [
        'function selectionSort(a) {',
        '  const n = a.length;',
        '  for (let i = 0; i < n - 1; i++) {        // @pass',
        '    let min = i;                            // @init',
        '    for (let j = i + 1; j < n; j++) {       // @inner',
        '      if (a[j] < a[min]) {                  // @cmp',
        '        min = j;                            // @newmin',
        '      }',
        '    }',
        '    if (min !== i) {                        // @check',
        '      [a[i], a[min]] = [a[min], a[i]];      // @swap',
        '    }',
        '  }',
        '  return a;                                 // @done',
        '}'
      ].join('\n'),
      py: [
        'def selection_sort(a):',
        '    n = len(a)',
        '    for i in range(n - 1):                  # @pass',
        '        min_i = i                           # @init',
        '        for j in range(i + 1, n):           # @inner',
        '            if a[j] < a[min_i]:             # @cmp',
        '                min_i = j                   # @newmin',
        '        if min_i != i:                      # @check',
        '            a[i], a[min_i] = a[min_i], a[i]  # @swap',
        '    return a                                # @done'
      ].join('\n')
    },
    insertion: {
      pseudo: [
        'procedure insertionSort(a)',
        '  for i ← 1 to n − 1                  // @outer',
        '    key ← a[i]                        // @lift',
        '    j ← i − 1                         // @lift',
        '    while j ≥ 0 and a[j] > key do     // @cmp',
        '      a[j + 1] ← a[j]                 // @shift',
        '      j ← j − 1                       // @shift',
        '    a[j + 1] ← key                    // @insert',
        '  return a                            // @done'
      ].join('\n'),
      js: [
        'function insertionSort(a) {',
        '  for (let i = 1; i < a.length; i++) {     // @outer',
        '    const key = a[i];                       // @lift',
        '    let j = i - 1;                          // @lift',
        '    while (j >= 0 && a[j] > key) {          // @cmp',
        '      a[j + 1] = a[j];                      // @shift',
        '      j--;                                  // @shift',
        '    }',
        '    a[j + 1] = key;                         // @insert',
        '  }',
        '  return a;                                 // @done',
        '}'
      ].join('\n'),
      py: [
        'def insertion_sort(a):',
        '    for i in range(1, len(a)):              # @outer',
        '        key = a[i]                          # @lift',
        '        j = i - 1                           # @lift',
        '        while j >= 0 and a[j] > key:        # @cmp',
        '            a[j + 1] = a[j]                 # @shift',
        '            j -= 1                          # @shift',
        '        a[j + 1] = key                      # @insert',
        '    return a                                # @done'
      ].join('\n')
    }
  };

  var META = {
    bubble: {
      title: 'Bubble sort', verb: 'swaps', moveLabel: 'Swaps',
      idea: 'Neighbours that are out of order trade places, so each pass carries the largest remaining value to the end.',
      invariant: 'After pass k, the last k positions hold the k largest values in their final places.',
      best: 'n − 1 comparisons (already sorted, thanks to the early exit)', worst: 'n(n − 1)/2 comparisons and swaps (reversed)',
      stable: true, inPlace: true, adaptive: true
    },
    selection: {
      title: 'Selection sort', verb: 'swaps', moveLabel: 'Swaps',
      idea: 'Scan the unsorted part for its smallest value and swap it to the front of that part.',
      invariant: 'After pass k, the first k positions hold the k smallest values in their final places.',
      best: 'n(n − 1)/2 comparisons, always', worst: 'n(n − 1)/2 comparisons, at most n − 1 swaps',
      stable: false, inPlace: true, adaptive: false
    },
    insertion: {
      title: 'Insertion sort', verb: 'shifts', moveLabel: 'Shifts',
      idea: 'Take the next value and slide larger values right until the gap is where it belongs.',
      invariant: 'After round k, the first k + 1 values are sorted among themselves, but not necessarily final.',
      best: 'n − 1 comparisons, 0 shifts (already sorted)', worst: 'n(n − 1)/2 comparisons and shifts (reversed)',
      stable: true, inPlace: true, adaptive: true
    },
    cocktail: {
      title: 'Cocktail shaker sort', verb: 'swaps', moveLabel: 'Swaps',
      idea: 'Bubble sort that sweeps right, then left, so small values near the end travel home quickly too.',
      invariant: 'After each sweep, one more value is final at the right end or the left end.',
      stable: true, inPlace: true, adaptive: true
    }
  };

  var VAR_STATES = {
    bubble: { j: 'compare', 'a[j]': 'compare', 'a[j+1]': 'compare' },
    selection: { i: 'active', j: 'compare', 'a[j]': 'compare', min: 'key', 'a[min]': 'key' },
    insertion: { i: 'active', key: 'key', j: 'compare', 'a[j]': 'compare' },
    cocktail: { j: 'compare', 'a[j]': 'compare', 'a[j+1]': 'compare' }
  };

  /* ------------------------------------------------------------------ bubble sort */
  function bubble(values, opts) {
    opts = opts || {};
    var early = opts.earlyExit !== false;
    var a = normalize(values, opts.idPrefix), n = a.length;
    var steps = [], ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var finalFrom = n, allFinal = false, round = 0, verdict = '';
    var vs = VAR_STATES.bubble;

    function snap(kind, o) {
      o = o || {};
      var mark = o.mark || {};
      var fin = allFinal ? range(0, n - 1) : range(finalFrom, n - 1);
      var finSet = {};
      fin.forEach(function (k) { finSet[k] = true; });
      var regions = [];
      if (n && (allFinal || finalFrom < n)) {
        regions.push({ id: 'final', from: allFinal ? 0 : finalFrom, to: n - 1, state: 'done', label: allFinal ? 'sorted' : 'final' });
      }
      steps.push({
        algo: 'bubble', kind: kind, round: round, roundEnd: !!o.roundEnd,
        items: a.map(function (it, k) { return cell(it, mark[k] || (finSet[k] ? 'done' : 'default')); }),
        held: null, ghosts: [],
        pointers: o.pointers || [],
        regions: regions,
        order: a.map(function (it) { return it.id; }),
        final: fin,
        caption: verdict + (o.caption || ''),
        line: o.line === undefined ? null : o.line,
        flow: o.flow || null,
        flowAlso: o.flowAlso || null,   // further flowchart nodes this step passes through (decisions evaluated on the way)
        vars: o.vars || { i: NA, j: NA, 'a[j]': NA, 'a[j+1]': NA, swapped: NA },
        varStates: vs,
        counters: { comparisons: ops.comparisons, swaps: ops.swaps },
        ops: { comparisons: ops.comparisons, swaps: ops.swaps, shifts: 0, writes: ops.writes }
      });
      verdict = '';
    }

    if (!n) {
      allFinal = true;
      snap('done', { caption: 'The array is empty, so there is nothing to sort: an empty array is already in order.', line: 'done', flow: 'done' });
      return steps;
    }
    var stoppedEarly = false;   // the swapped? test ended the sort, so the outer test is not evaluated again
    snap('start', {
      caption: n === 1 ? 'One value on its own is already sorted.' : 'Each pass walks left to right and swaps any two neighbours that are out of order. Watch the largest values drift right.',
      flow: 'start'
    });
    for (var i = 0; i < n - 1; i++) {
      round = i + 1;
      var swapped = false, last = n - 1 - i;
      snap('pass', {
        caption: 'Pass ' + round + ': sweep a[0..' + last + ']. ' + (i === 0
          ? 'Whatever the largest value is, each comparison carries it one step right, so it will end at index ' + last + '.'
          : 'Index ' + (last + 1) + ' onward is already final, so this pass stops one position earlier than the last one.'),
        line: ['pass', 'reset'], flow: 'pass', flowAlso: ['outer'],
        vars: { i: i, j: NA, 'a[j]': NA, 'a[j+1]': NA, swapped: false }
      });
      for (var j = 0; j < last; j++) {
        var L = a[j], R = a[j + 1];
        ops.comparisons++;
        var ptrs = [{ name: 'j', index: j, state: 'compare' }, { name: 'j+1', index: j + 1, state: 'compare' }];
        var mk = {}; mk[j] = 'compare'; mk[j + 1] = 'compare';
        snap('compare', {
          caption: 'Compare neighbours a[' + j + '] = ' + b(L) + ' and a[' + (j + 1) + '] = ' + b(R) + '.',
          line: 'cmp', flow: 'cmp', flowAlso: j > 0 ? ['more'] : null, mark: mk, pointers: ptrs,
          vars: { i: i, j: j, 'a[j]': L.value, 'a[j+1]': R.value, swapped: swapped }
        });
        if (L.value > R.value) {
          a[j] = R; a[j + 1] = L;
          swapped = true; ops.swaps++; ops.writes += 2;
          var ms = {}; ms[j] = 'swap'; ms[j + 1] = 'swap';
          snap('swap', {
            caption: fmt(L.value) + ' &gt; ' + fmt(R.value) + ', so they are out of order: swap them. ' + b(L) + ' moves one step right.',
            line: 'swap', flow: 'swap', mark: ms, pointers: ptrs,
            vars: { i: i, j: j, 'a[j]': R.value, 'a[j+1]': L.value, swapped: true }
          });
        } else {
          verdict = L.value === R.value
            ? fmt(L.value) + ' = ' + fmt(R.value) + ': equal values are never swapped (the test is strict), which keeps their order. '
            : fmt(L.value) + ' &lt; ' + fmt(R.value) + ': already in order, no swap. ';
        }
      }
      if (!swapped && early) {
        allFinal = true; stoppedEarly = true;
        snap('passEnd', {
          roundEnd: true,
          caption: 'Pass ' + round + ' made no swaps, so every neighbour pair is in order: the whole array is sorted. ' + (i < n - 2 ? 'Stop early and skip the remaining passes.' : 'Stop.'),
          line: 'exit', flow: 'exitQ', flowAlso: ['more'],
          vars: { i: i, j: NA, 'a[j]': NA, 'a[j+1]': NA, swapped: false }
        });
        break;
      }
      finalFrom = last;
      var mEnd = {}; mEnd[last] = 'done';
      snap('passEnd', {
        roundEnd: true,
        caption: 'Pass ' + round + ' is over. ' + b(a[last]) + ' is the largest of a[0..' + last + '], so index ' + last + ' is final: nothing to its left will ever pass it.' +
          (swapped ? '' : ' (No swaps happened, but the early exit is switched off, so the passes continue.)'),
        line: 'exit', flow: 'exitQ', flowAlso: ['more'], mark: mEnd,
        vars: { i: i, j: NA, 'a[j]': NA, 'a[j+1]': NA, swapped: swapped }
      });
    }
    allFinal = true;
    snap('done', {
      caption: n === 1 ? 'Done, with zero comparisons.' : 'Sorted, using ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + ' in ' + plural(round, 'pass', 'passes') + '.',
      line: 'done', flow: 'done', flowAlso: stoppedEarly ? null : ['outer']
    });
    return steps;
  }

  /* ------------------------------------------------------------------ selection sort */
  function selection(values, opts) {
    opts = opts || {};
    var a = normalize(values, opts.idPrefix), n = a.length;
    var steps = [], ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var finalTo = -1, allFinal = false, round = 0, verdict = '';
    var vs = VAR_STATES.selection;

    function snap(kind, o) {
      o = o || {};
      var mark = o.mark || {};
      var fin = allFinal ? range(0, n - 1) : range(0, finalTo);
      var regions = [];
      if (n && (allFinal || finalTo >= 0)) regions.push({ id: 'final', from: 0, to: allFinal ? n - 1 : finalTo, state: 'done', label: allFinal ? 'sorted' : 'final' });
      steps.push({
        algo: 'selection', kind: kind, round: round, roundEnd: !!o.roundEnd,
        items: a.map(function (it, k) { return cell(it, mark[k] || (allFinal || k <= finalTo ? 'done' : 'default')); }),
        held: null, ghosts: [],
        pointers: o.pointers || [],
        regions: regions,
        order: a.map(function (it) { return it.id; }),
        final: fin,
        caption: verdict + (o.caption || ''),
        line: o.line === undefined ? null : o.line,
        flow: o.flow || null,
        flowAlso: o.flowAlso || null,   // further flowchart nodes this step passes through (decisions evaluated on the way)
        vars: o.vars || { i: NA, j: NA, min: NA, 'a[j]': NA, 'a[min]': NA },
        varStates: vs,
        counters: { comparisons: ops.comparisons, swaps: ops.swaps },
        ops: { comparisons: ops.comparisons, swaps: ops.swaps, shifts: 0, writes: ops.writes }
      });
      verdict = '';
    }
    function pointers(i, j, min) {
      var p = [{ name: 'i', index: i, state: 'active' }];
      if (j !== null) p.push({ name: 'j', index: j, state: 'compare' });
      p.push({ name: 'min', index: min, state: 'key', side: 'above' });
      return p;
    }

    if (!n) {
      allFinal = true;
      snap('done', { caption: 'The array is empty, so there is nothing to sort: an empty array is already in order.', line: 'done', flow: 'done' });
      return steps;
    }
    snap('start', {
      caption: n === 1 ? 'One value on its own is already sorted.' : 'Each pass scans the unsorted part for its smallest value and swaps it to the front of that part. The front grows one final value at a time.',
      flow: 'start'
    });
    for (var i = 0; i < n - 1; i++) {
      round = i + 1;
      var min = i;
      var m0 = {}; m0[i] = 'key';
      snap('pass', {
        caption: 'Pass ' + round + ': find the smallest value in a[' + i + '..' + (n - 1) + ']. Until the scan finds something smaller, a[' + i + '] = ' + b(a[i]) + ' is the smallest so far.',
        line: ['pass', 'init'], flow: 'pass', flowAlso: ['outer'], mark: m0, pointers: pointers(i, null, min),
        vars: { i: i, j: NA, min: min, 'a[j]': NA, 'a[min]': a[min].value }
      });
      for (var j = i + 1; j < n; j++) {
        ops.comparisons++;
        var mk = {}; mk[min] = 'key'; mk[j] = 'compare';
        snap('compare', {
          caption: 'Is a[' + j + '] = ' + b(a[j]) + ' smaller than the smallest so far, a[' + min + '] = ' + b(a[min]) + '?',
          line: 'cmp', flow: 'cmp', flowAlso: j > i + 1 ? ['more'] : null, mark: mk, pointers: pointers(i, j, min),
          vars: { i: i, j: j, min: min, 'a[j]': a[j].value, 'a[min]': a[min].value }
        });
        if (a[j].value < a[min].value) {
          var old = a[min];
          min = j;
          var mn = {}; mn[min] = 'key';
          snap('newMin', {
            caption: 'Yes: ' + fmt(a[j].value) + ' &lt; ' + fmt(old.value) + ', so ' + b(a[j]) + ' is the new smallest so far. The min marker moves to index ' + j + '.',
            line: 'newmin', flow: 'newmin', mark: mn, pointers: pointers(i, j, min),
            vars: { i: i, j: j, min: min, 'a[j]': a[j].value, 'a[min]': a[min].value }
          });
        } else {
          verdict = a[j].value === a[min].value
            ? 'No: ' + fmt(a[j].value) + ' equals it but is not smaller, so the first ' + fmt(a[min].value) + ' stays the minimum. '
            : 'No: ' + fmt(a[j].value) + ' &gt; ' + fmt(a[min].value) + '. ';
        }
      }
      if (min !== i) {
        var A = a[i], M = a[min];
        a[i] = M; a[min] = A;
        ops.swaps++; ops.writes += 2;
        finalTo = i;
        var sw = {}; sw[i] = 'swap'; sw[min] = 'swap';
        snap('swap', {
          roundEnd: true,
          caption: 'The scan is over: ' + b(M) + ' is the smallest in a[' + i + '..' + (n - 1) + ']. Swap it with a[' + i + '] = ' + b(A) + ', which jumps to index ' + min + '. Index ' + i + ' is now final.',
          line: 'swap', flow: 'swap', flowAlso: ['more'], mark: sw, pointers: pointers(i, null, min),
          vars: { i: i, j: NA, min: min, 'a[j]': NA, 'a[min]': A.value }
        });
      } else {
        finalTo = i;
        snap('noSwap', {
          roundEnd: true,
          caption: 'The scan is over and the smallest value, ' + b(a[i]) + ', is already at index ' + i + ', so no swap is needed. Index ' + i + ' is final.',
          line: 'check', flow: 'swap', flowAlso: ['more'], pointers: pointers(i, null, min),
          vars: { i: i, j: NA, min: min, 'a[j]': NA, 'a[min]': a[min].value }
        });
      }
    }
    allFinal = true;
    snap('done', {
      caption: n === 1 ? 'Done, with zero comparisons.' : 'The last value is the largest left, so it is already final. Sorted, using ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + '.',
      line: 'done', flow: 'done', flowAlso: ['outer']
    });
    return steps;
  }

  /* ------------------------------------------------------------------ insertion sort */
  function insertion(values, opts) {
    opts = opts || {};
    var slots = normalize(values, opts.idPrefix), n = slots.length;
    var steps = [], ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var prefixTo = n ? 0 : -1, allFinal = false, round = 0, verdict = '';
    var vs = VAR_STATES.insertion;

    function snap(kind, o) {
      o = o || {};
      var mark = o.mark || {};
      var items = [];
      slots.forEach(function (it, k) {
        if (!it) return;
        var st = mark[k] || (allFinal ? 'done' : k <= prefixTo ? 'visited' : 'default');
        items.push(cell(it, st, k));
      });
      var held = o.held ? { id: o.held.it.id, value: o.held.it.value, over: o.held.over, state: 'key' } : null;
      if (held && o.held.it.label !== undefined) held.label = o.held.it.label;
      var regions = [];
      if (n) regions.push({ id: 'prefix', from: 0, to: allFinal ? n - 1 : prefixTo, state: allFinal ? 'done' : 'visited', label: allFinal ? 'sorted' : 'sorted prefix' });
      steps.push({
        algo: 'insertion', kind: kind, round: round, roundEnd: !!o.roundEnd,
        items: items, held: held, ghosts: o.hole !== undefined ? [o.hole] : [],
        pointers: o.pointers || [],
        regions: regions,
        order: slots.map(function (it) { return it ? it.id : null; }),
        final: allFinal ? range(0, n - 1) : [],
        caption: verdict + (o.caption || ''),
        line: o.line === undefined ? null : o.line,
        flow: o.flow || null,
        flowAlso: o.flowAlso || null,   // further flowchart nodes this step passes through (decisions evaluated on the way)
        vars: o.vars || { i: NA, key: NA, j: NA, 'a[j]': NA },
        varStates: vs,
        counters: { comparisons: ops.comparisons, shifts: ops.shifts },
        ops: { comparisons: ops.comparisons, swaps: 0, shifts: ops.shifts, writes: ops.writes }
      });
      verdict = '';
    }

    if (!n) {
      allFinal = true;
      snap('done', { caption: 'The array is empty, so there is nothing to sort: an empty array is already in order.', line: 'done', flow: 'done' });
      return steps;
    }
    snap('start', {
      caption: n === 1 ? 'One value on its own is already sorted.' : 'The first value on its own is a sorted prefix. Each round takes the next value, the key, and inserts it into the prefix.',
      flow: 'start'
    });
    for (var i = 1; i < n; i++) {
      round = i;
      var key = slots[i];
      slots[i] = null;
      prefixTo = i;           // the prefix a[0..i] (with a hole) stays sorted during the round
      var j = i - 1;
      snap('lift', {
        caption: 'Round ' + round + ': lift the key ' + b(key) + ' out of index ' + i + ', leaving a hole. The values to its left are sorted; the key must find its place among them.',
        line: ['outer', 'lift'], flow: 'lift', flowAlso: ['outer'], hole: i, held: { it: key, over: i },
        pointers: [{ name: 'i', index: i, state: 'active' }, { name: 'j', index: j, state: 'compare' }],
        vars: { i: i, key: key.value, j: j, 'a[j]': slots[j].value }
      });
      var shifted = 0;
      while (j >= 0) {
        var y = slots[j];
        ops.comparisons++;
        var mk = {}; mk[j] = 'compare';
        snap('compare', {
          caption: 'Is a[' + j + '] = ' + b(y) + ' greater than the key ' + b(key) + '?',
          line: 'cmp', flow: 'cmp', mark: mk, hole: j + 1, held: { it: key, over: j + 1 },
          pointers: [{ name: 'i', index: i, state: 'active' }, { name: 'j', index: j, state: 'compare' }],
          vars: { i: i, key: key.value, j: j, 'a[j]': y.value }
        });
        if (y.value > key.value) {
          slots[j + 1] = y; slots[j] = null;
          ops.shifts++; ops.writes++; shifted++;
          var ms = {}; ms[j + 1] = 'swap';
          snap('shift', {
            caption: 'Yes: ' + fmt(y.value) + ' &gt; ' + fmt(key.value) + ', so shift ' + b(y) + ' one slot right. The hole moves left to index ' + j + '.',
            line: 'shift', flow: 'shift', mark: ms, hole: j, held: { it: key, over: j },
            pointers: [{ name: 'i', index: i, state: 'active' }, { name: 'j', index: j - 1, state: 'compare' }],
            vars: { i: i, key: key.value, j: j - 1, 'a[j]': j - 1 >= 0 ? slots[j - 1].value : NA }
          });
          j--;
        } else {
          verdict = y.value === key.value
            ? 'No: ' + fmt(y.value) + ' equals the key but is not greater, so the key stays after it and equal values keep their order. '
            : 'No: ' + fmt(y.value) + ' &lt; ' + fmt(key.value) + ', so the key belongs right after it. ';
          break;
        }
      }
      if (j < 0 && shifted) verdict = 'j = −1: every value in the prefix was larger, so the key goes to the very front. ';
      slots[j + 1] = key;
      ops.writes++;
      var mi = {}; mi[j + 1] = 'key';
      snap('insert', {
        roundEnd: true,
        caption: (shifted
          ? 'Drop the key ' + b(key) + ' into the hole at index ' + (j + 1) + '. '
          : 'Nothing was larger, so the key ' + b(key) + ' goes straight back to index ' + (j + 1) + ' at the cost of one comparison. ') +
          'Now a[0..' + i + '] is sorted' + (i < n - 1 ? ', but not final: a later key may still push these values right.' : '.'),
        line: 'insert', flow: 'insert', mark: mi,
        pointers: [{ name: 'i', index: i, state: 'active' }, { name: 'j', index: j, state: 'compare' }],
        vars: { i: i, key: key.value, j: j, 'a[j]': j >= 0 ? slots[j].value : NA }
      });
    }
    allFinal = true;
    snap('done', {
      caption: n === 1 ? 'Done, with zero comparisons.' : 'The last key is in place, so the prefix is the whole array: sorted, using ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.shifts, 'shift') + '.',
      line: 'done', flow: 'done', flowAlso: ['outer']
    });
    return steps;
  }

  /* ------------------------------------------------------------------ cocktail shaker sort (a variation) */
  function cocktail(values, opts) {
    opts = opts || {};
    var early = opts.earlyExit !== false;
    var a = normalize(values, opts.idPrefix), n = a.length;
    var steps = [], ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var lo = 0, hi = n - 1, allFinal = false, round = 0, verdict = '';
    function snap(kind, o) {
      o = o || {};
      var mark = o.mark || {};
      var fin = allFinal ? range(0, n - 1) : range(0, lo - 1).concat(range(hi + 1, n - 1));
      var fs = {}; fin.forEach(function (k) { fs[k] = true; });
      var regions = [];
      if (allFinal && n) regions.push({ id: 'hi', from: 0, to: n - 1, state: 'done', label: 'sorted' });
      else {
        if (hi < n - 1) regions.push({ id: 'hi', from: hi + 1, to: n - 1, state: 'done', label: 'final' });
        if (lo > 0) regions.push({ id: 'lo', from: 0, to: lo - 1, state: 'done', label: 'final' });
      }
      steps.push({
        algo: 'cocktail', kind: kind, round: round, roundEnd: !!o.roundEnd,
        items: a.map(function (it, k) { return cell(it, mark[k] || (fs[k] ? 'done' : 'default')); }),
        held: null, ghosts: [], pointers: o.pointers || [], regions: regions,
        order: a.map(function (it) { return it.id; }), final: fin,
        caption: verdict + (o.caption || ''), line: null, flow: null,
        vars: o.vars || {}, varStates: VAR_STATES.cocktail,
        counters: { comparisons: ops.comparisons, swaps: ops.swaps },
        ops: { comparisons: ops.comparisons, swaps: ops.swaps, shifts: 0, writes: ops.writes }
      });
      verdict = '';
    }
    function visit(j) {
      var L = a[j], R = a[j + 1];
      ops.comparisons++;
      var ptrs = [{ name: 'j', index: j, state: 'compare' }, { name: 'j+1', index: j + 1, state: 'compare' }];
      var mk = {}; mk[j] = 'compare'; mk[j + 1] = 'compare';
      snap('compare', { caption: 'Compare ' + b(L) + ' and ' + b(R) + '.', mark: mk, pointers: ptrs });
      if (L.value > R.value) {
        a[j] = R; a[j + 1] = L; ops.swaps++; ops.writes += 2;
        var ms = {}; ms[j] = 'swap'; ms[j + 1] = 'swap';
        snap('swap', { caption: fmt(L.value) + ' &gt; ' + fmt(R.value) + ': swap.', mark: ms, pointers: ptrs });
        return true;
      }
      verdict = fmt(L.value) + ' ≤ ' + fmt(R.value) + ': no swap. ';
      return false;
    }
    if (!n) { allFinal = true; snap('done', { caption: 'Nothing to sort.' }); return steps; }
    snap('start', { caption: 'Sweep right, then left. A small value stuck near the end rides home in a single backward sweep.' });
    while (lo < hi) {
      round++;
      var swapped = false;
      snap('pass', { caption: 'Sweep ' + round + ', left to right: carry the largest remaining value to index ' + hi + '.' });
      for (var j = lo; j < hi; j++) if (visit(j)) swapped = true;
      if (!swapped && early) { allFinal = true; snap('passEnd', { roundEnd: true, caption: 'No swaps in this sweep: sorted. Stop early.' }); break; }
      hi--;
      snap('passEnd', { roundEnd: true, caption: 'Index ' + (hi + 1) + ' is final.' });
      if (lo >= hi) break;
      round++;
      swapped = false;
      snap('pass', { caption: 'Sweep ' + round + ', right to left: carry the smallest remaining value to index ' + lo + '.' });
      for (j = hi - 1; j >= lo; j--) if (visit(j)) swapped = true;
      if (!swapped && early) { allFinal = true; snap('passEnd', { roundEnd: true, caption: 'No swaps in this sweep: sorted. Stop early.' }); break; }
      lo++;
      snap('passEnd', { roundEnd: true, caption: 'Index ' + (lo - 1) + ' is final.' });
    }
    allFinal = true;
    snap('done', { caption: 'Sorted, using ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + ' in ' + plural(round, 'sweep') + '.' });
    return steps;
  }

  /* ------------------------------------------------------------------ fast counters (no steps) */
  /* The same loops as the generators, counting only. Used for charts with large n. */
  function count(nameOf, values, opts) {
    opts = opts || {};
    var a = (values || []).map(valueOf), n = a.length, c = 0, s = 0, sh = 0, w = 0, rounds = 0, i, j, t;
    if (nameOf === 'bubble') {
      for (i = 0; i < n - 1; i++) {
        rounds++;
        var swapped = false;
        for (j = 0; j < n - 1 - i; j++) { c++; if (a[j] > a[j + 1]) { t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; s++; w += 2; swapped = true; } }
        if (!swapped && opts.earlyExit !== false) break;
      }
    } else if (nameOf === 'selection') {
      for (i = 0; i < n - 1; i++) {
        rounds++;
        var m = i;
        for (j = i + 1; j < n; j++) { c++; if (a[j] < a[m]) m = j; }
        if (m !== i) { t = a[i]; a[i] = a[m]; a[m] = t; s++; w += 2; }
      }
    } else if (nameOf === 'insertion') {
      for (i = 1; i < n; i++) {
        rounds++;
        var key = a[i];
        j = i - 1;
        while (j >= 0) { c++; if (a[j] > key) { a[j + 1] = a[j]; sh++; w++; j--; } else break; }
        a[j + 1] = key; w++;
      }
    } else if (nameOf === 'cocktail') {
      var steps = cocktail(values, opts), last = steps[steps.length - 1];
      return { comparisons: last.ops.comparisons, swaps: last.ops.swaps, shifts: 0, writes: last.ops.writes, rounds: last.round };
    } else throw new Error('Unknown sort: ' + nameOf);
    return { comparisons: c, swaps: s, shifts: sh, writes: w, rounds: rounds };
  }

  /* Inverted pairs: positions i < j with a[i] > a[j]. The number of them measures disorder: 0 when sorted,
     n(n − 1)/2 when reversed. Every adjacent swap of an out-of-order pair removes exactly one. */
  function inversions(values) {
    var a = (values || []).map(valueOf), pairs = [];
    for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) if (a[i] > a[j]) pairs.push([i, j]);
    return { count: pairs.length, pairs: pairs };
  }

  /* Steps that end each outer round, starting with the first step: frames[k] = the array after k rounds.
     Frames past an early exit repeat the final step, so frames always has max(1, n) entries. */
  function roundFrames(steps) {
    if (!steps || !steps.length) return [];
    var n = steps[0].order.length, out = [steps[0]];
    steps.forEach(function (s) { if (s.roundEnd) out.push(s); });
    var last = steps[steps.length - 1];
    while (out.length < Math.max(1, n)) out.push(last);
    return out;
  }
  /* Steps where a comparison or a move happened, plus the first and the last: one "tick" of work each.
     A fair clock for races: bubble, selection and insertion all pay one tick per comparison and per move. */
  function opFrames(steps) {
    if (!steps || !steps.length) return [];
    function work(s) { return s.ops.comparisons + s.ops.swaps + s.ops.shifts; }
    var out = [steps[0]], prev = work(steps[0]);
    for (var k = 1; k < steps.length - 1; k++) { var w = work(steps[k]); if (w > prev) { out.push(steps[k]); prev = w; } }
    if (steps.length > 1) out.push(steps[steps.length - 1]);
    return out;
  }

  var GENERATORS = { bubble: bubble, selection: selection, insertion: insertion, cocktail: cocktail };
  function run(nameOf, values, opts) {
    var g = GENERATORS[nameOf];
    if (!g) throw new Error('Unknown sort: ' + nameOf);
    return g(values, opts);
  }

  return {
    bubble: bubble, selection: selection, insertion: insertion, cocktail: cocktail, run: run,
    count: count, inversions: inversions, roundFrames: roundFrames, opFrames: opFrames,
    normalize: normalize, itemName: name,
    CODE: CODE, META: META, ELEMENTARY: ['bubble', 'selection', 'insertion']
  };
}));
