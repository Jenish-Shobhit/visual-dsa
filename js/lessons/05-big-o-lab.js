/* Lesson 05 · Complexity & Big-O — the count-the-steps lab, the Big-O flowchart, feasibility figures,
   the amortized preview and the pattern minis. Builders are registered on VDSA.L05 and started lazily by
   js/lessons/05-big-o.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, B = V.algos.bigO, L = V.L05;
  var col = L.col, clamp = L.clamp, text = L.text, svgRoot = L.svgRoot;

  /* ================================================================== lab code (labels shared across languages) */
  var CODE = {
    findMax: {
      pseudo: [
        'function findMax(a)',
        '  best ← a[0]                     // @init',
        '  for i ← 1 to n − 1',
        '    if a[i] > best then           // @cmp',
        '      best ← a[i]                 // @update',
        '  return best                     // @ret'].join('\n'),
      js: [
        'function findMax(a) {',
        '  let best = a[0];                       // @init',
        '  for (let i = 1; i < a.length; i++) {',
        '    if (a[i] > best) {                   // @cmp',
        '      best = a[i];                       // @update',
        '    }',
        '  }',
        '  return best;                           // @ret',
        '}'].join('\n'),
      py: [
        'def find_max(a):',
        '    best = a[0]                  # @init',
        '    for i in range(1, len(a)):',
        '        if a[i] > best:          # @cmp',
        '            best = a[i]          # @update',
        '    return best                  # @ret'].join('\n')
    },
    pairSum: {
      pseudo: [
        'function hasPairSum(a, t)',
        '  for i ← 0 to n − 2                // @outer',
        '    for j ← i + 1 to n − 1',
        '      if a[i] + a[j] = t then       // @check',
        '        return true                 // @found',
        '  return false                      // @none'].join('\n'),
      js: [
        'function hasPairSum(a, t) {',
        '  for (let i = 0; i < a.length - 1; i++) {   // @outer',
        '    for (let j = i + 1; j < a.length; j++) {',
        '      if (a[i] + a[j] === t) {               // @check',
        '        return true;                         // @found',
        '      }',
        '    }',
        '  }',
        '  return false;                              // @none',
        '}'].join('\n'),
      py: [
        'def has_pair_sum(a, t):',
        '    for i in range(len(a) - 1):          # @outer',
        '        for j in range(i + 1, len(a)):',
        '            if a[i] + a[j] == t:         # @check',
        '                return True              # @found',
        '    return False                         # @none'].join('\n')
    },
    binarySearch: {
      pseudo: [
        'function binarySearch(a, t)',
        '  lo ← 0; hi ← n − 1                  // @init',
        '  while lo ≤ hi',
        '    mid ← ⌊(lo + hi) / 2⌋             // @mid',
        '    if a[mid] = t then return mid      // @found',
        '    if a[mid] < t then lo ← mid + 1    // @right',
        '    else hi ← mid − 1                  // @left',
        '  return −1                            // @none'].join('\n'),
      js: [
        'function binarySearch(a, t) {',
        '  let lo = 0, hi = a.length - 1;        // @init',
        '  while (lo <= hi) {',
        '    const mid = (lo + hi) >> 1;         // @mid',
        '    if (a[mid] === t) return mid;       // @found',
        '    if (a[mid] < t) lo = mid + 1;       // @right',
        '    else hi = mid - 1;                  // @left',
        '  }',
        '  return -1;                            // @none',
        '}'].join('\n'),
      py: [
        'def binary_search(a, t):',
        '    lo, hi = 0, len(a) - 1           # @init',
        '    while lo <= hi:',
        '        mid = (lo + hi) // 2         # @mid',
        '        if a[mid] == t:              # @found',
        '            return mid',
        '        if a[mid] < t:               # @right',
        '            lo = mid + 1',
        '        else:                        # @left',
        '            hi = mid - 1',
        '    return -1                        # @none'].join('\n')
    },
    bubbleSort: {
      pseudo: [
        'function bubbleSort(a)',
        '  for pass ← 0 to n − 2                 // @outer',
        '    for j ← 0 to n − 2 − pass',
        '      if a[j] > a[j + 1] then           // @cmp',
        '        swap a[j] and a[j + 1]          // @swap',
        '  return a                              // @ret'].join('\n'),
      js: [
        'function bubbleSort(a) {',
        '  for (let pass = 0; pass < a.length - 1; pass++) {   // @outer',
        '    for (let j = 0; j < a.length - 1 - pass; j++) {',
        '      if (a[j] > a[j + 1]) {                          // @cmp',
        '        [a[j], a[j + 1]] = [a[j + 1], a[j]];          // @swap',
        '      }',
        '    }',
        '  }',
        '  return a;                                           // @ret',
        '}'].join('\n'),
      py: [
        'def bubble_sort(a):',
        '    for p in range(len(a) - 1):                # @outer',
        '        for j in range(len(a) - 1 - p):',
        '            if a[j] > a[j + 1]:                # @cmp',
        '                a[j], a[j + 1] = a[j + 1], a[j]   # @swap',
        '    return a                                   # @ret'].join('\n')
    },
    subsetSum: {
      pseudo: [
        'function subsetSum(a, t)',
        '  for mask ← 0 to 2ⁿ − 1               // @loop',
        '    s ← sum of a[i] where bit i of mask is 1',
        '    if s = t then                       // @check',
        '      return mask                       // @found',
        '  return none                           // @none'].join('\n'),
      js: [
        'function subsetSum(a, t) {',
        '  const n = a.length;',
        '  for (let mask = 0; mask < (1 << n); mask++) {   // @loop',
        '    let s = 0;',
        '    for (let i = 0; i < n; i++)',
        '      if (mask & (1 << i)) s += a[i];',
        '    if (s === t) {                                // @check',
        '      return mask;                                // @found',
        '    }',
        '  }',
        '  return -1;                                      // @none',
        '}'].join('\n'),
      py: [
        'def subset_sum(a, t):',
        '    n = len(a)',
        '    for mask in range(1 << n):                              # @loop',
        '        s = sum(a[i] for i in range(n) if mask >> i & 1)',
        '        if s == t:                                          # @check',
        '            return mask                                     # @found',
        '    return -1                                               # @none'].join('\n')
    },
    mergeSort: {
      pseudo: [
        'function mergeSort(a, lo, hi)',
        '  if lo ≥ hi then return                // @base',
        '  mid ← ⌊(lo + hi) / 2⌋                 // @split',
        '  mergeSort(a, lo, mid)',
        '  mergeSort(a, mid + 1, hi)',
        '  merge(a, lo, mid, hi)                 // @merge',
        '',
        'function merge(a, lo, mid, hi)',
        '  i ← lo; j ← mid + 1; out ← []',
        '  while i ≤ mid and j ≤ hi',
        '    if a[i] ≤ a[j] then                 // @cmp',
        '      move a[i] to out; i ← i + 1       // @takeL',
        '    else move a[j] to out; j ← j + 1    // @takeR',
        '  move the rest of either half to out   // @rest',
        '  copy out back into a[lo..hi]          // @copy'].join('\n'),
      js: [
        'function mergeSort(a, lo = 0, hi = a.length - 1) {',
        '  if (lo >= hi) return;                     // @base',
        '  const mid = (lo + hi) >> 1;               // @split',
        '  mergeSort(a, lo, mid);',
        '  mergeSort(a, mid + 1, hi);',
        '  merge(a, lo, mid, hi);                    // @merge',
        '}',
        'function merge(a, lo, mid, hi) {',
        '  const out = [];',
        '  let i = lo, j = mid + 1;',
        '  while (i <= mid && j <= hi) {',
        '    if (a[i] <= a[j]) {                     // @cmp',
        '      out.push(a[i++]);                     // @takeL',
        '    } else {',
        '      out.push(a[j++]);                     // @takeR',
        '    }',
        '  }',
        '  while (i <= mid) out.push(a[i++]);        // @rest',
        '  while (j <= hi) out.push(a[j++]);         // @rest',
        '  for (let k = 0; k < out.length; k++) a[lo + k] = out[k];   // @copy',
        '}'].join('\n'),
      py: [
        'def merge_sort(a, lo=0, hi=None):',
        '    if hi is None:',
        '        hi = len(a) - 1',
        '    if lo >= hi:                         # @base',
        '        return',
        '    mid = (lo + hi) // 2                 # @split',
        '    merge_sort(a, lo, mid)',
        '    merge_sort(a, mid + 1, hi)',
        '    merge(a, lo, mid, hi)                # @merge',
        '',
        'def merge(a, lo, mid, hi):',
        '    out, i, j = [], lo, mid + 1',
        '    while i <= mid and j <= hi:',
        '        if a[i] <= a[j]:                 # @cmp',
        '            out.append(a[i]); i += 1     # @takeL',
        '        else:',
        '            out.append(a[j]); j += 1     # @takeR',
        '    out += a[i:mid + 1] + a[j:hi + 1]    # @rest',
        '    a[lo:hi + 1] = out                   # @copy'].join('\n')
    }
  };
  L.LAB_CODE = CODE;

  /* Worst-case merge sort input: the permutation that makes every merge alternate between halves. */
  function mergeWorst(n) {
    function un(a) { if (a.length <= 1) return a; var l = [], r = []; a.forEach(function (v, i) { (i % 2 ? r : l).push(v); }); return un(l).concat(un(r)); }
    var a = []; for (var i = 1; i <= n; i++) a.push(i * 3);
    return un(a);
  }

  /* ================================================================== the lab */
  L.lab = function () {
    var fig = V.$('#lab-fig');
    var sel = fig.querySelector('[data-alg]'), targetWrap = fig.querySelector('[data-target-wrap]'), targetField = fig.querySelector('[data-target]');
    var DEFAULT_TARGET = { pairSum: 100, binarySearch: 100, subsetSum: 999 };
    B.LAB.forEach(function (a) { sel.appendChild(h('option', { value: a.id }, a.title + '  ·  ' + B.cls(a.big).o)); });
    var alg = B.LAB_BY_ID.findMax, values = null, target = 100, kind = 'random', rng = V.rng(2024);
    var LEGENDS = {
      findMax: [{ state: 'compare', label: 'a[i] being compared' }, { state: 'key', label: 'best so far' }, { state: 'visited', label: 'Scanned' }, { state: 'found', label: 'Maximum' }],
      pairSum: [{ state: 'active', label: 'a[i]' }, { state: 'compare', label: 'a[j] and its range' }, { state: 'visited', label: 'Done as a[i]' }, { state: 'found', label: 'The pair' }],
      binarySearch: [{ state: 'active', label: 'Window lo..hi' }, { state: 'compare', label: 'Probe a[mid]' }, { state: 'muted', label: 'Ruled out' }, { state: 'found', label: 'Found' }],
      bubbleSort: [{ state: 'compare', label: 'Neighbours compared' }, { state: 'swap', label: 'Swapping' }, { state: 'done', label: 'Final place' }],
      subsetSum: [{ state: 'key', label: 'In this subset (bit 1)' }, { state: 'visited', label: 'All subsets tried' }, { state: 'found', label: 'Matching subset' }],
      mergeSort: [{ state: 'active', label: 'Left half' }, { state: 'frontier', label: 'Right half' }, { state: 'compare', label: 'Front values compared' }, { state: 'swap', label: 'Just written' }, { state: 'visited', label: 'In the buffer' }, { state: 'done', label: 'Sorted' }]
    };
    var legendEl = fig.querySelector('[data-legend]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.findMax, default: 'pseudo', maxHeight: 320 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { best: 'key', i: 'compare', j: 'compare', 'a[i]': 'compare', lo: 'active', hi: 'active', mid: 'compare', 'a[mid]': 'compare', mask: 'key', subset: 'key', sum: 'key', t: 'found' } });
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', label: 'The lab’s array' });
    var measure = V.views.chart(fig.querySelector('[data-measure]'), { type: 'line', height: 240, labels: 'legend', label: 'Measured operations against the formula' });
    var measureTitle = fig.querySelector('[data-measure-title]');
    var measured = [], steps = [];

    function gen(k, n) {
      var lo = 1, hi = 40;
      if (k === 'sorted') return V.presets.sorted(n, { min: lo, max: hi, rng: rng });
      if (k === 'reversed') return V.presets.reversed(n, { min: lo, max: hi, rng: rng });
      if (k === 'worst') {
        if (alg.id === 'findMax') return V.presets.sorted(n, { min: lo, max: hi, rng: rng });        // best changes every time
        if (alg.id === 'bubbleSort') return V.presets.reversed(n, { min: lo, max: hi, rng: rng });   // a swap on every comparison
        if (alg.id === 'mergeSort') return mergeWorst(n);
        return V.presets.random(n, { min: lo, max: hi, unique: true, rng: rng });
      }
      if (k === 'best') {
        if (alg.id === 'findMax') return V.presets.reversed(n, { min: lo, max: hi, rng: rng });
        if (alg.id === 'bubbleSort' || alg.id === 'mergeSort') return V.presets.sorted(n, { min: lo, max: hi, rng: rng });
        return V.presets.random(n, { min: lo, max: hi, unique: true, rng: rng });
      }
      return V.presets.random(n, { min: lo, max: hi, unique: alg.id === 'binarySearch', rng: rng });
    }
    /* Presets that change the target too (worst = absent target, best = the luckiest target). */
    function presetTarget(k, vals) {
      if (!alg.target) return target;
      if (k === 'worst') return alg.id === 'subsetSum' ? 999 : 100;
      if (k === 'best') {
        if (alg.id === 'pairSum') return vals.length > 1 ? vals[0] + vals[1] : 100;
        if (alg.id === 'binarySearch') { var sv = vals.slice().sort(function (a, b) { return a - b; }); return sv[Math.floor((sv.length - 1) / 2)]; }
        if (alg.id === 'subsetSum') return 0;
      }
      return target;
    }
    function parseInput(textIn) {
      var tokens = String(textIn || '').split(/[\s,;]+/).filter(Boolean);
      if (tokens.length > alg.maxN) return { values: [], error: alg.title + ' is capped at ' + alg.maxN + ' values so every step stays readable' + (alg.id === 'subsetSum' ? ': 7 values would already mean 128 subsets.' : '.') };
      return V.parseNumbers(textIn, { min: -99, max: 99, minCount: 1, maxCount: alg.maxN });
    }
    function readTarget() {
      var raw = String(targetField.value).trim(), v = Number(raw);
      if (!raw || !Number.isInteger(v) || v < -999 || v > 999) { input.setError('The target must be a whole number between −999 and 999.'); targetField.setAttribute('aria-invalid', 'true'); return null; }
      targetField.removeAttribute('aria-invalid');
      return v;
    }
    function measureState(st, index) {
      var n = values.length, cur = st.counters[alg.op], last = steps[steps.length - 1].counters[alg.op];
      var finished = index === steps.length - 1;
      // the dot for the full input appears only when the trace ends, so it never gives a prediction away
      var pts = finished ? measured : measured.slice(0, n - 1);
      var ymax = Math.max(alg.theory(alg.maxN), last, 1) * 1.12;
      return {
        x: { label: 'n (number of values)', min: 1, max: alg.maxN, ticks: alg.maxN <= 8 ? alg.maxN : 6 },
        y: { label: alg.opLabel.toLowerCase(), min: 0, max: ymax },
        series: [
          { id: 'theory', label: alg.theoryLabel, fn: function (x) { return alg.theory(x); }, state: 'muted', dashed: true, domain: [1, alg.maxN], samples: alg.id === 'binarySearch' ? 160 : 72 },
          { id: 'measured', label: 'your input', points: pts, state: B.cls(alg.big).color, markers: true }
        ],
        highlight: { series: 'measured', x: n, y: cur, label: finished ? cur + ' in total' : cur + ' so far' }
      };
    }
    var player = V.player({
      root: fig, steps: [{ view: { items: [] }, counters: { comparisons: 0 }, caption: '' }],
      render: function (st, ctx) {
        view.render(st.view, { duration: ctx.duration });
        if (values) measure.render(measureState(st, ctx.index), { duration: ctx.instant ? 0 : Math.min(ctx.duration, 380) });
      },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps', pairs: 'Pairs checked', probes: 'Probes', subsets: 'Subsets checked' },
      counterStates: { comparisons: 'compare', pairs: 'compare', probes: 'compare', subsets: 'key', swaps: 'swap' },
      baseStepMs: 900, label: 'Lab controls'
    });
    function build() {
      var t = alg.target ? readTarget() : target;
      if (t === null) return;
      target = t;
      steps = B.labSteps(alg.id, values, target);
      measured = [];
      for (var k = 1; k <= values.length; k++) measured.push([k, B.countOps(alg.id, values.slice(0, k), target)]);
      measureTitle.textContent = alg.opLabel + ' against n: your input (dots) and ' + alg.theoryLabel + ' (dashed)';
      view.reset();
      view.prepare(steps.map(function (x) { return x.view; }));
      player.setSteps(steps);
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers', value: [], placeholder: 'e.g. 5, 3, 8, 1',
      parse: parseInput,
      presets: [
        { label: 'Random', value: function () { kind = 'random'; return gen('random', nSlider.value); } },
        { label: 'Sorted', value: function () { kind = 'sorted'; return gen('sorted', nSlider.value); } },
        { label: 'Reversed', value: function () { kind = 'reversed'; return gen('reversed', nSlider.value); } },
        { label: 'Worst case', title: 'The input that makes this algorithm do the most work', value: function () { kind = 'worst'; var v = gen('worst', nSlider.value); targetField.value = presetTarget('worst', v); return v; } },
        { label: 'Best case', title: 'The input that makes this algorithm do the least work', value: function () { kind = 'best'; var v = gen('best', nSlider.value); targetField.value = presetTarget('best', v); return v; } }
      ],
      hint: 'Whole numbers from −99 to 99. Binary search sorts your numbers first.',
      onApply: function (vals) { values = vals; if (nSlider.value !== vals.length) nSlider.set(Math.min(alg.maxN, vals.length)); build(); }
    });
    var nSlider = V.slider(fig.querySelector('[data-n]'), { label: 'n', min: 1, max: alg.maxN, value: alg.defaultN,
      onChange: function (v) { var vals = gen(kind, v); if (kind === 'worst' || kind === 'best') targetField.value = presetTarget(kind, vals); input.set(vals); } });
    targetField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.apply(); } });
    targetField.addEventListener('change', function () { input.apply(); });

    player.addCheckpoint(function (st) { return st.length > 2 ? 1 : -1; }, function (c) {
      var last = c.steps[c.steps.length - 1], total = last.counters[alg.op], n = values.length;
      var cands = [n - 1, n, Math.floor(Math.log2(Math.max(1, n))) + 1, n * (n - 1) / 2, n * n, Math.pow(2, n), Math.round(n * Math.log2(Math.max(2, n)))];
      var opts = [total];
      cands.forEach(function (v) { if (opts.length < 4 && v >= 0 && opts.indexOf(v) === -1) opts.push(v); });
      opts.sort(function (a, b) { return a - b; });
      var ans = opts.indexOf(total);
      var found = last.kind === 'found';
      var why = {
        findMax: 'Every value after the first is compared exactly once: n − 1 = ' + total + '.',
        pairSum: found ? 'A pair adds up to ' + target + ', so the loops stop after ' + total + ' of the ' + (n * (n - 1) / 2) + ' pairs.' : 'No pair adds up to ' + target + ', so all n(n − 1)/2 = ' + total + ' pairs are checked.',
        binarySearch: 'Each probe halves the candidates, so it takes ' + total + ' probe' + (total === 1 ? '' : 's') + ' (never more than ⌊log₂ ' + n + '⌋ + 1 = ' + (Math.floor(Math.log2(n)) + 1) + ').',
        bubbleSort: 'Every pass compares all its neighbours: (n − 1) + (n − 2) + … + 1 = n(n − 1)/2 = ' + total + ', whatever the order.',
        subsetSum: found ? 'Subset #' + total + ' adds up to ' + target + ', so it stops there, out of 2ⁿ = ' + Math.pow(2, n) + '.' : 'No subset adds up to ' + target + ', so all 2ⁿ = ' + total + ' subsets are checked.',
        mergeSort: 'Merging makes at most one comparison per value written, about log₂ n times over: this input needs ' + total + ' (n log₂ n ≈ ' + Math.round(n * Math.log2(n)) + ').'
      }[alg.id];
      return {
        question: 'Before you run it: how many <b>' + alg.opLabel.toLowerCase() + '</b> will ' + alg.title.toLowerCase() + ' make on these ' + n + ' values' + (alg.target ? ' with target ' + target : '') + '?',
        options: opts.map(function (v) { return B.withCommas(v); }), answer: ans,
        explain: opts.map(function (v) { return v === total ? why : 'Not this input: ' + why; }),
        kicker: 'Predict the count'
      };
    }, { id: 'lab-predict-total' });

    function selectAlg(id) {
      alg = B.LAB_BY_ID[id];
      sel.value = id;
      code.setSource(CODE[id]);
      V.legend(legendEl, LEGENDS[id]);
      targetWrap.hidden = !alg.target;
      if (alg.target) targetField.value = DEFAULT_TARGET[id];
      nSlider.input.max = alg.maxN;
      nSlider.set(alg.defaultN);
      kind = 'random';
      rng = V.rng(id.length * 97 + 11);
      input.set(gen('random', alg.defaultN));
    }
    sel.addEventListener('change', function () { selectAlg(sel.value); });
    selectAlg('findMax');
  };

  /* ================================================================== flowchart: find the Big-O */
  var SNIP = {
    constant: { title: 'Two reads and an add', code: 'x = a[0] + a[n − 1]', caps: {
      start: 'Read the snippet: two array reads and one addition.',
      kind: 'No loop and no recursive call, so the work cannot depend on n.',
      o1: '<b>O(1)</b>: the same three operations for ten items or ten million.' } },
    findMax: { title: 'Find the maximum', code: 'for i in 1 … n − 1:\n  if a[i] > best: best = a[i]', caps: {
      start: 'Read the snippet: one loop over the array.',
      kind: 'There is a loop, and no function calls itself.',
      halve: 'i goes up by 1 each round. It neither halves nor doubles.',
      inner: 'Inside the loop there is only an if: no second loop.',
      on: 'One pass of n − 1 rounds, a constant amount of work in each: <b>O(n)</b>.' } },
    binarySearch: { title: 'Binary search', code: 'while lo ≤ hi:\n  mid = (lo + hi) / 2\n  keep the half that can hold t', caps: {
      start: 'Read the snippet: a loop that narrows a window.',
      kind: 'There is a loop.',
      halve: 'Each round keeps half the window: the size of the problem halves.',
      ologn: 'You can halve n only about log₂ n times before one item is left: <b>O(log n)</b>.' } },
    pairSum: { title: 'Pair sum, brute force', code: 'for i in 0 … n − 1:\n  for j in i + 1 … n − 1:\n    if a[i] + a[j] = t: return true', caps: {
      start: 'Read the snippet: a loop with a loop inside it.',
      kind: 'There is a loop.',
      halve: 'i goes up by 1. No halving.',
      inner: 'Yes: for each i, j runs over the rest of the array.',
      multiply: 'Up to n outer rounds, each with up to n inner rounds. Nested loops multiply.',
      innerHalve: 'j goes up by 1 too. The inner loop is linear.',
      on2: 'n × n shape: exactly n(n − 1)/2 checks in the worst case, <b>O(n²)</b>.' } },
    loopLog: { title: 'A loop around a doubling loop', code: 'for i in 0 … n − 1:\n  j = 1\n  while j < n: j = j × 2', caps: {
      start: 'Read the snippet: an outer loop and an inner loop.',
      kind: 'There is a loop.',
      halve: 'The outer counter i goes up by 1.',
      inner: 'Yes, there is a loop inside.',
      multiply: 'n outer rounds, each running the inner loop once. Multiply.',
      innerHalve: 'The inner counter doubles: 1, 2, 4, … so it runs about log₂ n times.',
      onlogn: 'n × log₂ n: <b>O(n log n)</b>.' } },
    mergeSort: { title: 'Merge sort', code: 'mergeSort(a):\n  sort the left half\n  sort the right half\n  merge them in one pass', caps: {
      start: 'Read the snippet: a function that calls itself.',
      kind: 'mergeSort calls mergeSort: recursion.',
      split: 'Each call halves its range and then merges in linear time.',
      rnlogn: 'About log₂ n levels of halving, n work on each level: <b>O(n log n)</b>.' } },
    subsets: { title: 'Every subset', code: 'subsets(i):\n  if i = n: check this subset; return\n  subsets(i + 1)  // without a[i]\n  subsets(i + 1)  // with a[i]', caps: {
      start: 'Read the snippet: a function that calls itself twice.',
      kind: 'subsets calls subsets: recursion.',
      split: 'It does not halve n: each call drops only one item.',
      twoCalls: 'Each call makes two calls on the remaining n − 1 items.',
      o2n: 'The calls double on every level: 1, 2, 4, …, 2ⁿ leaves. <b>O(2ⁿ)</b>.' } }
  };
  L.flow = function () {
    var fig = V.$('#fig-flow'), pick = fig.querySelector('[data-pick]'), codeEl = fig.querySelector('[data-code]');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Question being asked' }, { state: 'visited', label: 'Already answered' }, { state: 'found', label: 'The answer' }]);
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), B.FLOW, { label: 'How to find the Big-O of code', decisionShape: 'auto' });
    Object.keys(SNIP).forEach(function (k) { pick.appendChild(h('option', { value: k }, SNIP[k].title)); });
    function traceSteps(k) {
      var path = B.FLOW_TRACES[k].path, caps = SNIP[k].caps, out = [];
      path.forEach(function (id, i) {
        var last = i === path.length - 1, edges = {};
        for (var e = 1; e <= i; e++) edges[path[e - 1] + '->' + path[e]] = 'path';
        out.push({ active: id, visited: path.slice(0, i), edgeStates: edges, states: last ? (function () { var o = {}; o[id] = 'found'; return o; }()) : {}, caption: caps[id] || '' });
      });
      return out;
    }
    var player = V.player({ root: fig, steps: traceSteps('findMax'),
      render: function (st, ctx) { view.render({ active: st.active, visited: st.visited, edgeStates: st.edgeStates, states: st.states }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), baseStepMs: 1200, label: 'Flowchart controls' });
    function choose(k) { V.codeBlock(codeEl, SNIP[k].code, 'py'); player.setSteps(traceSteps(k)); }
    pick.value = 'findMax';
    pick.addEventListener('change', function () { choose(pick.value); });
    choose('findMax');
  };

  /* ================================================================== what fits in the budget */
  L.feasible = function () {
    var fig = V.$('#fig-feasible'), host = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var speed = 1e8, budget = 1;
    var BUDGETS = [{ v: 1e-3, label: '1 ms' }, { v: 1, label: '1 second' }, { v: 60, label: '1 minute' }, { v: 3600, label: '1 hour' }, { v: 86400, label: '1 day' }, { v: B.YEAR, label: '1 year' }];
    var rows = {}, table = h('div', { class: 'feas', role: 'table', 'aria-label': 'Largest n per growth class' });
    table.appendChild(h('div', { class: 'feas__row feas__row--head', role: 'row' }, h('span', { role: 'columnheader' }, 'Class'), h('span', { role: 'columnheader' }, 'Largest n (log scale bar)'), h('span', { role: 'columnheader', class: 'feas__num' }, 'n')));
    B.CLASSES.forEach(function (c) {
      var fill = h('span', { class: 'feas__fill' }), num = h('span', { class: 'feas__num', role: 'cell' });
      var row = h('div', { class: 'feas__row', role: 'row', style: '--cc:' + col(c.id) },
        h('span', { class: 'feas__cls', role: 'rowheader' }, h('span', { class: 'big-o', 'data-o': c.id }, c.o), h('span', { class: 'feas__name' }, c.name)),
        h('span', { class: 'feas__track', role: 'cell' }, fill), num);
      table.appendChild(row);
      rows[c.id] = { fill: fill, num: num, last: 0 };
    });
    host.appendChild(table);
    var MAXLOG = 20;
    function show(ms) {
      var ops = speed * budget;
      B.CLASSES.forEach(function (c) {
        var r = rows[c.id], f = B.feasibleN(c.id, ops), w, label;
        if (f.unbounded) { w = 100; label = 'any n'; }
        else if (f.n === Infinity) { w = 100; label = c.id === 'logn' ? 'astronomically large (2^' + (ops < 1e15 ? B.withCommas(ops) : B.formatBig(Math.log10(ops))) + ')' : '≈ ' + B.formatBig(f.log10n); r.num.title = 'A number with about ' + B.withCommas(Math.round(f.log10n)) + ' digits: more than any memory can hold.'; }
        else if (f.n < 1) { w = 0; label = 'none'; }
        else { w = clamp(f.log10n / MAXLOG * 100, 1.5, 100); label = null; }
        r.fill.style.width = w + '%';
        r.fill.classList.toggle('is-max', w >= 100);
        if (label) { if (r.num.__count) r.num.__count.cancel(); r.num.textContent = label; r.last = 0; }
        else if (f.n < 1e6) { L.countTo(r.num, r.last || 0, f.n, ms); r.last = f.n; }
        else { if (r.num.__count) r.num.__count.cancel(); r.num.textContent = B.formatBig(f.log10n); r.last = 0; }
      });
      var bl = BUDGETS.filter(function (b) { return b.v === budget; })[0].label;
      var n2 = B.feasibleN('n2', ops), e2 = B.feasibleN('2n', ops), nl = B.feasibleN('nlogn', ops);
      cap.innerHTML = 'At ' + B.formatBig(Math.log10(speed)) + ' operations per second, <b>' + bl + '</b> ' + (budget === 1 ? 'allows' : 'buys ' + B.formatBig(Math.log10(ops)) + ' operations') + ': n log n reaches ' + B.formatBig(nl.log10n) + ' items, n² ' + B.formatBig(n2.log10n) + ', and 2ⁿ only <b>' + (e2.n || 0) + '</b>.';
    }
    V.segmented(fig.querySelector('[data-speed]'), { label: 'Speed', value: 1e8, options: [{ value: 1e6, label: '10⁶ ops/s' }, { value: 1e8, label: '10⁸ ops/s' }, { value: 1e10, label: '10¹⁰ ops/s' }],
      onChange: function (v) { speed = v; show(700); } });
    V.segmented(fig.querySelector('[data-budget]'), { label: 'Time budget', value: 1, options: BUDGETS.map(function (b) { return { value: b.v, label: b.label }; }),
      onChange: function (v) { budget = v; show(700); } });
    show(900);
  };

  /* ================================================================== timeline: how long each class takes */
  L.timeline = function () {
    var fig = V.$('#fig-timeline'), stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var STOPS = [10, 20, 50, 100, 1000, 1e4, 1e6], stop = 3, SPEED = 1e8;
    var LMIN = -8, LMAX = 24;
    var UNIVERSE = 13.8e9 * B.YEAR;
    var MARKS = [[-6, '1 µs'], [0, '1 s'], [Math.log10(3600), '1 hour'], [Math.log10(B.YEAR), '1 year'], [Math.log10(100 * B.YEAR), 'a lifetime'], [Math.log10(UNIVERSE), 'age of the universe']];
    var els = null;
    var fig2 = L.responsive(stage, function (W) {
      var LW = 78, rowH = 30, top = 34, H = top + rowH * B.CLASSES.length + 30, x0 = LW, x1 = W - 26;
      function X(l) { return x0 + (clamp(l, LMIN, LMAX) - LMIN) / (LMAX - LMIN) * (x1 - x0); }
      var svg = svgRoot(W, H, 'Time each growth class needs, on a log time line', 'l05-tl');
      MARKS.forEach(function (m, i) {
        var x = X(m[0]);
        svg.appendChild(s('line', { class: 'tl-mark' + (i === MARKS.length - 1 ? ' is-universe' : ''), x1: x, x2: x, y1: top - 8, y2: H - 22 }));
        svg.appendChild(text(x, i % 2 ? top - 20 : H - 8, m[1], { class: 'tl-mark-label' + (i === MARKS.length - 1 ? ' is-universe' : ''), 'text-anchor': 'middle' }));
      });
      els = { X: X, rows: {}, x1: x1, W: W };
      B.CLASSES.forEach(function (c, i) {
        var y = top + i * rowH + rowH / 2;
        var g = s('g', { style: '--cc:' + col(c.id) });
        g.appendChild(text(10, y, c.label, { class: 'tl-label', dy: '.35em' }));
        g.appendChild(s('line', { class: 'tl-track', x1: x0, x2: x1, y1: y, y2: y }));
        var bar = s('line', { class: 'tl-bar', x1: x0, x2: x0, y1: y, y2: y });
        var dot = s('circle', { class: 'tl-dot', r: 6, cx: x0, cy: y });
        var arrow = s('path', { class: 'tl-arrow', d: 'M0 -6 L9 0 L0 6 Z', opacity: 0 });
        var lab = text(x0, y - 10, '', { class: 'tl-time' });
        [bar, dot, arrow, lab].forEach(function (e) { g.appendChild(e); });
        svg.appendChild(g);
        els.rows[c.id] = { bar: bar, dot: dot, arrow: arrow, lab: lab, y: y };
      });
      return svg;
    }, update, 560);
    function update(ms) {
      if (!els) return;
      var n = STOPS[stop], parts = [];
      B.CLASSES.forEach(function (c) {
        var r = els.rows[c.id], l = B.log10Work(c.id, n) - Math.log10(SPEED), x = els.X(l), off = l > LMAX;
        V.animate(r.dot, { attr: { cx: x } }, { duration: ms, ease: 'out' });
        V.animate(r.bar, { attr: { x2: x } }, { duration: ms, ease: 'out' });
        V.animate(r.arrow, { x: els.x1 + 4, y: r.y, opacity: off ? 1 : 0 }, { duration: ms });
        var t = B.secondsText(l);
        var uni = Math.log10(UNIVERSE);
        if (l > uni) t += ' = ' + B.formatBig(l - uni) + ' universe ages';
        r.lab.textContent = t;
        var lx = x + 10, anchor = 'start';
        if (lx + L.clamp(t.length * 6.4, 40, 400) > els.W - 4) { lx = x - 10; anchor = 'end'; }
        V.animate(r.lab, { attr: { x: lx } }, { duration: ms, ease: 'out' });
        r.lab.setAttribute('text-anchor', anchor);
        r.dot.classList.toggle('is-off', off);
        parts.push(c.label + ': ' + t);
      });
      cap.innerHTML = 'At <b>n = ' + B.formatCount(n) + '</b>: ' + parts.join(' · ') + '.';
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 0, max: STOPS.length - 1, value: stop, format: function (i) { return B.formatCount(STOPS[i]); },
      onInput: function (v) { stop = v; update(650); } });
    void fig2;
  };

  /* ================================================================== amortized: appending to a doubling array */
  L.amortized = function () {
    var fig = V.$('#fig-amortized'), stage = fig.querySelector('[data-stage]');
    var M = 16, steps = B.appendSteps(M), CMAX = 10;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Filled slot' }, { state: 'swap', label: 'Copied in a resize' }, { state: 'active', label: 'One write' }, { state: 'pivot', shape: 'line', label: 'Average cost per append' }]);
    var els = null, cur = null;
    var fig2 = L.responsive(stage, function (W) {
      var H = 290, pad = 16, slotW = Math.min(34, (W - 2 * pad) / M), x0 = (W - slotW * M) / 2;
      var svg = svgRoot(W, H, 'A dynamic array and the cost of each append', 'l05-am');
      els = { slots: [], bars: [], x0: x0, slotW: slotW, top: 34, chartTop: 110, chartBot: H - 28 };
      svg.appendChild(text(x0, 20, 'the array: capacity and filled slots', { class: 'am-title' }));
      for (var k = 0; k < M; k++) {
        var r = s('rect', { class: 'am-slot', x: x0 + k * slotW + 1, y: els.top, width: slotW - 2, height: slotW - 2, rx: 4 });
        V.place(r, { opacity: 0 });
        svg.appendChild(r); els.slots.push(r);
      }
      function Y(v) { return els.chartBot - v / CMAX * (els.chartBot - els.chartTop); }
      els.Y = Y;
      [0, 3, 6, 9].forEach(function (v) {
        svg.appendChild(s('line', { class: 'am-grid' + (v === 3 ? ' is-three' : ''), x1: x0 - 4, x2: x0 + slotW * M, y1: Y(v), y2: Y(v) }));
        svg.appendChild(text(x0 - 8, Y(v), String(v), { class: 'am-tick', 'text-anchor': 'end', dy: '.35em' }));
      });
      svg.appendChild(text(x0 + slotW * M, Y(3) - 6, 'average stays below 3', { class: 'am-three', 'text-anchor': 'end' }));
      svg.appendChild(text(x0, els.chartTop - 12, 'cost of each append (writes + copies)', { class: 'am-title' }));
      for (var j = 0; j < M; j++) {
        var bx = x0 + j * slotW + slotW * 0.18, bw = slotW * 0.64;
        var copy = s('rect', { class: 'am-copy', x: bx, y: els.chartBot, width: bw, height: 0, rx: 2 });
        var write = s('rect', { class: 'am-write', x: bx, y: els.chartBot, width: bw, height: 0, rx: 2 });
        var lbl = text(bx + bw / 2, els.chartBot + 14, String(j + 1), { class: 'am-tick', 'text-anchor': 'middle' });
        svg.appendChild(copy); svg.appendChild(write); svg.appendChild(lbl);
        els.bars.push({ copy: copy, write: write });
      }
      els.avg = s('polyline', { class: 'am-avg', points: '' });
      svg.appendChild(els.avg);
      return svg;
    }, function (ms) { if (cur) draw(cur, ms); });
    function draw(st, ms) {
      if (!els) return;
      els.slots.forEach(function (r, k) {
        var inCap = k < st.cap, filled = k < st.size;
        var cls = 'am-slot' + (filled ? (st.resized && k < st.copies ? ' is-copied' : k === st.size - 1 && st.k > 0 ? ' is-new' : ' is-filled') : '');
        r.setAttribute('class', cls);
        V.animate(r, { opacity: inCap ? 1 : 0 }, { duration: ms, delay: inCap && st.resized ? (k - st.oldCap) * 30 : 0 });
      });
      var pts = [];
      els.bars.forEach(function (b, j) {
        var c = st.costs[j];
        var yc = c ? els.Y(c.copies) : els.chartBot, yw = c ? els.Y(c.copies + 1) : els.chartBot;
        V.animate(b.copy, { attr: { y: yc, height: els.chartBot - yc } }, { duration: ms, ease: 'out' });
        V.animate(b.write, { attr: { y: yw, height: yc - yw } }, { duration: ms, ease: 'out' });
        if (c) { var tot = 0; for (var q = 0; q <= j; q++) tot += st.costs[q].copies + 1; pts.push((els.x0 + j * els.slotW + els.slotW / 2).toFixed(1) + ',' + els.Y(tot / (j + 1)).toFixed(1)); }
      });
      els.avg.setAttribute('points', pts.join(' '));
    }
    V.player({ root: fig, steps: steps,
      render: function (st, ctx) { cur = st; draw(st, ctx.duration); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { appends: 'Appends', copies: 'Values copied', total: 'Total cost' }, counterStates: { copies: 'swap', total: 'pivot' },
      baseStepMs: 1000, label: 'Amortized append controls' });
    void fig2;
  };

  /* ================================================================== pattern minis (static pictures + code) */
  L.patterns = function () {
    V.tabs('#pattern-tabs');
    function cells(svg, x, y, n, size, cls) { for (var k = 0; k < n; k++) svg.appendChild(s('rect', { class: 'mini-cell ' + (cls || ''), x: x + k * size, y: y, width: size - 2, height: size - 2, rx: 2 })); }
    var minis = {
      add: function () {
        var svg = svgRoot(240, 150, 'Two loops side by side versus nested loops', 'l05-mini');
        svg.appendChild(text(6, 14, 'n + n', { class: 'mini-t' }));
        cells(svg, 6, 22, 6, 13, 'is-a'); cells(svg, 6, 38, 6, 13, 'is-b');
        svg.appendChild(text(126, 14, 'n × n', { class: 'mini-t' }));
        for (var i = 0; i < 6; i++) cells(svg, 126, 22 + i * 17, 6, 17, 'is-c');
        svg.appendChild(text(6, 72, '12 steps', { class: 'mini-sub' }));
        svg.appendChild(text(6, 88, 'for n = 6', { class: 'mini-sub' }));
        svg.appendChild(text(126, 144, '36 steps', { class: 'mini-sub' }));
        return svg;
      },
      halve: function () {
        var svg = svgRoot(240, 130, 'A window halving from 16 to 1', 'l05-mini');
        [16, 8, 4, 2, 1].forEach(function (w, i) {
          svg.appendChild(s('rect', { class: 'mini-cell is-c', x: 10, y: 8 + i * 24, width: w * 12.5, height: 16, rx: 3 }));
          svg.appendChild(text(10 + w * 12.5 + 6, 20 + i * 24, String(w), { class: 'mini-sub' }));
        });
        return svg;
      },
      divide: function () {
        var svg = svgRoot(240, 130, 'A recursion tree: four levels, eight units of work on each', 'l05-mini');
        var levels = [1, 2, 4, 8];
        levels.forEach(function (cnt, i) {
          var w = 176 / cnt;
          for (var k = 0; k < cnt; k++) svg.appendChild(s('rect', { class: 'mini-cell is-c', x: 6 + k * w + 1, y: 8 + i * 30, width: w - 3, height: 20, rx: 3 }));
          svg.appendChild(text(190, 22 + i * 30, '8 work', { class: 'mini-sub' }));
        });
        return svg;
      },
      hidden: function () {
        var svg = svgRoot(240, 130, 'Loop counts for N with 1, 2 and 3 digits', 'l05-mini');
        [['N = 9', 9], ['N = 99', 99], ['N = 999', 999]].forEach(function (r, i) {
          var w = 6 + Math.log10(r[1]) / 3 * 150;
          svg.appendChild(text(6, 24 + i * 38, r[0], { class: 'mini-t' }));
          svg.appendChild(s('rect', { class: 'mini-cell is-d', x: 70, y: 12 + i * 38, width: w, height: 16, rx: 3 }));
          svg.appendChild(text(76 + w, 24 + i * 38, r[1] + ' loops', { class: 'mini-sub' }));
        });
        return svg;
      }
    };
    var blocks = {
      add: 'for (let i = 0; i < n; i++) a();      // n\nfor (let i = 0; i < n; i++) b();      // + n  -> O(n)\n\nfor (let i = 0; i < n; i++)\n  for (let j = 0; j < n; j++) c();    // n × n -> O(n²)',
      halve: 'let steps = 0;\nfor (let size = n; size > 1; size = Math.floor(size / 2))\n  steps++;                             // about log2(n) times',
      divide: 'function sort(a) {\n  if (a.length < 2) return a;\n  const mid = a.length >> 1;\n  return merge(sort(a.slice(0, mid)),   // T(n/2)\n               sort(a.slice(mid)));    // T(n/2) + n to merge\n}',
      hidden: 'function isPrime(N) {                 // input: the digits of N\n  for (let d = 2; d * d <= N; d++)     // up to √N rounds\n    if (N % d === 0) return false;\n  return true;\n}'
    };
    Object.keys(minis).forEach(function (k) {
      V.$('[data-mini="' + k + '"]').appendChild(minis[k]());
      V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js');
    });
  };
}());
