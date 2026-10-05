/* Lesson 16 — the big interactive figures: the quick sort lab (+ its flowchart), the quickselect lab and its
   cost chart, and the race. Uses VDSA.algos.sorting (js/algos/16-quick-sort.js, and lesson 14's insertion sort for
   the race) and the helpers in js/lessons/16-quick-sort-figs.js. Started by js/lessons/16-quick-sort.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L16 = V.lessons.l16;
  function S() { return V.algos.sorting; }
  function fmt(v) { return L16.fmt(v); }
  var TITLE = { lomuto: 'Quick sort with Lomuto partition', hoare: 'Quick sort with Hoare partition' };

  /* ================================================================== legends */
  var LEGENDS = {
    lomuto: [{ state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Comparing a[j]' }, { state: 'swap', label: 'Swapped' }, { state: 'frontier', shape: 'outline', label: '≤ pivot zone' }, { state: 'visited', shape: 'outline', label: '> pivot zone' }, { state: 'muted', shape: 'outline', label: 'not seen / outside range' }, { state: 'done', label: 'Final place' }],
    hoare: [{ state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Pointer moving' }, { state: 'active', label: 'Pointer stopped' }, { state: 'swap', label: 'Swapped' }, { state: 'frontier', shape: 'outline', label: '≤ pivot zone' }, { state: 'visited', shape: 'outline', label: '≥ pivot zone' }, { state: 'muted', shape: 'outline', label: 'not seen / outside range' }, { state: 'done', label: 'Sorted (single value)' }]
  };
  L16.LEGENDS = LEGENDS;

  /* ================================================================== flowcharts */
  var FLOWS = {
    lomuto: {
      nodes: [
        { id: 'start', type: 'start', text: 'quicksort(lo, hi)', col: 0, row: 0 },
        { id: 'base', type: 'decision', text: 'lo ≥ hi ?', col: 0, row: 1 },
        { id: 'ret', type: 'end', text: 'return', col: 1, row: 1, narrow: { col: 1, row: 1 } },
        { id: 'pivot', type: 'process', text: 'choose pivot, park it at a[hi]\ni = lo − 1,  j = lo', col: 0, row: 2 },
        { id: 'more', type: 'decision', text: 'j < hi ?', col: 0, row: 3 },
        { id: 'cmp', type: 'decision', text: 'a[j] ≤ pivot ?', col: 0, row: 4 },
        { id: 'small', type: 'process', text: 'i = i + 1\nswap a[i], a[j]', col: 1, row: 4 },
        { id: 'inc', type: 'process', text: 'j = j + 1', col: 0, row: 5 },
        { id: 'place', type: 'process', text: 'swap a[i + 1], a[hi]\np = i + 1', col: 1, row: 3 },
        { id: 'rec', type: 'process', text: 'quicksort(lo, p − 1)\nquicksort(p + 1, hi)', col: 1, row: 2 }
      ],
      edges: [
        { from: 'start', to: 'base' },
        { from: 'base', to: 'ret', label: 'yes' },
        { from: 'base', to: 'pivot', label: 'no' },
        { from: 'pivot', to: 'more' },
        { from: 'more', to: 'cmp', label: 'yes' },
        { from: 'more', to: 'place', label: 'no' },
        { from: 'cmp', to: 'small', label: 'yes' },
        { from: 'cmp', to: 'inc', label: 'no' },
        { from: 'small', to: 'inc', via: { fromSide: 'bottom', toSide: 'right' } },
        { from: 'inc', to: 'more', via: { fromSide: 'left', toSide: 'left' } },
        { from: 'place', to: 'rec' },
        { from: 'rec', to: 'ret' }
      ]
    },
    hoare: {
      nodes: [
        { id: 'start', type: 'start', text: 'quicksort(lo, hi)', col: 0, row: 0 },
        { id: 'base', type: 'decision', text: 'lo ≥ hi ?', col: 0, row: 1 },
        { id: 'ret', type: 'end', text: 'return', col: 1, row: 1 },
        { id: 'pivot', type: 'process', text: 'choose pivot, park it at a[lo]\ni = lo,  j = hi', col: 0, row: 2 },
        { id: 'scanI', type: 'decision', text: 'a[i] < pivot ?', col: 0, row: 3 },
        { id: 'inci', type: 'process', text: 'i = i + 1', col: 1, row: 3 },
        { id: 'scanJ', type: 'decision', text: 'a[j] > pivot ?', col: 0, row: 4 },
        { id: 'decj', type: 'process', text: 'j = j − 1', col: 1, row: 4 },
        { id: 'cross', type: 'decision', text: 'i ≥ j ?', col: 0, row: 5 },
        { id: 'swap', type: 'process', text: 'swap a[i], a[j]\ni++,  j−−', col: 1, row: 5 },
        { id: 'rec', type: 'process', text: 'p = j\nquicksort(lo, p)\nquicksort(p + 1, hi)', col: 0, row: 6 }
      ],
      edges: [
        { from: 'start', to: 'base' },
        { from: 'base', to: 'ret', label: 'yes' },
        { from: 'base', to: 'pivot', label: 'no' },
        { from: 'pivot', to: 'scanI' },
        { from: 'scanI', to: 'inci', label: 'yes' },
        { from: 'inci', to: 'scanI', via: { fromSide: 'top', toSide: 'top' } },
        { from: 'scanI', to: 'scanJ', label: 'no' },
        { from: 'scanJ', to: 'decj', label: 'yes' },
        { from: 'decj', to: 'scanJ', via: { fromSide: 'top', toSide: 'top' } },
        { from: 'scanJ', to: 'cross', label: 'no' },
        { from: 'cross', to: 'swap', label: 'no' },
        { from: 'swap', to: 'scanI', via: { fromSide: 'right', toSide: 'right' } },
        { from: 'cross', to: 'rec', label: 'yes' },
        { from: 'rec', to: 'ret', via: { fromSide: 'right', toSide: 'bottom' } }
      ]
    }
  };
  L16.FLOWS = FLOWS;
  var FLOW_ALT = {
    lomuto: 'Text alternative: a range of one value or fewer returns at once. Otherwise choose a pivot and park it at a[hi], set i = lo − 1 and scan j from lo. If a[j] ≤ pivot, increase i and swap a[i] with a[j]. When j reaches hi, swap the pivot into a[i + 1] and sort the left and right parts.',
    hoare: 'Text alternative: a range of one value or fewer returns at once. Otherwise park the pivot at a[lo], put i at lo and j at hi. Move i right while a[i] < pivot and j left while a[j] > pivot. If i is still left of j, swap a[i] and a[j] and move both inward; otherwise split after j and sort the two parts.'
  };

  /* ================================================================== the lab */
  var DEFAULT_INPUT = [7, 2, 9, 4, 3, 8, 5, 1, 6];
  var SEED = 7;

  L16.initLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var stage = fig.querySelector('[data-stage]');
    var algo = 'lomuto', pivot = 'last', values = DEFAULT_INPUT.slice(), mode = 'boxes';
    var view = V.views.array(stage, { mode: mode, label: 'Array being sorted', barHeight: 200 });
    var tree = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 30, minNodeSize: 12, gap: 0.3, levelHeight: 36,   /* height follows the deepest prepared step, so the worst case is never clipped */ label: 'Recursion tree of the lab run' });
    var stack = V.views.callstack(fig.querySelector('[data-stack]'), { frameWidth: 210, maxVisible: 4, label: 'Call stack of the lab run' });
    var legendEl = fig.querySelector('[data-legend]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE_QUICK.lomuto, default: 'pseudo', maxHeight: 357 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });

    var flowStage = flowFig.querySelector('[data-stage]');
    var flowView = V.views.flowchart(flowStage, FLOWS.lomuto, { label: 'Flowchart of the sort running in the lab', narrowWidth: 420 });
    var flowTitle = flowFig.querySelector('[data-flow-title]');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [], states = {}, also = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          also = (st[ctx.index] && st[ctx.index].flowAlso) || [];   // decisions this step evaluates on its way to `flow`
          also.forEach(function (x) { states[x] = 'active'; });
          for (var k = 0; k < ctx.index && k < st.length; k++) [st[k].flow].concat(st[k].flowAlso || []).forEach(function (x) { if (x && visited.indexOf(x) === -1 && x !== id && also.indexOf(x) === -1) visited.push(x); });
        }
        flowView.render({ active: id || undefined, states: states, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function generate() {
      var vals = L16.labelDuplicates(values);
      return algo === 'lomuto' ? S().quickLomuto(vals, { pivot: pivot, seed: SEED }) : S().quickHoare(vals, { pivot: pivot, seed: SEED });
    }
    var steps = generate();
    function prepareAll(st) {
      view.reset(); view.prepare(st);
      tree.reset(); tree.prepare(st.map(function (s) { return s.tree; }));
      stack.reset(); stack.prepare(st.map(function (s) { return { frames: s.frames }; }));
    }
    prepareAll(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        view.render(step, { duration: ctx.duration });
        tree.render(step.tree, { duration: ctx.duration });
        stack.render({ frames: step.frames }, { duration: ctx.duration });
      },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps' }, counterStates: { comparisons: 'compare', swaps: 'swap' },
      baseStepMs: 950, label: 'Quick sort lab controls'
    });

    /* ---- predictions (each resolves to -1 when another algorithm is loaded) ---- */
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'quickLomuto') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'small' && st[k].ops.swaps > st[k - 1].ops.swaps) return k;
      return -1;
    }, function (c) {
      var s = c.prev, j = null, i = null;
      s.pointers.forEach(function (p) { if (p.name === 'j') j = p.index; if (p.name === 'i') i = p.index; });
      if (j === null || i === null) return null;
      var x = s.items[j].value, P = null;
      s.items.forEach(function (it, k) { if (it.state === 'pivot') P = it.value; });
      if (P === null || !(x <= P)) return null;
      return {
        question: 'j is on <code>a[' + j + ']</code> = <b>' + fmt(x) + '</b> and the pivot is <b>' + fmt(P) + '</b>. What happens next?',
        options: ['i moves to ' + (i + 1) + ' and a[' + (i + 1) + '] swaps with a[' + j + ']', fmt(x) + ' stays where it is; only j moves on', 'The scan stops: a value is out of order'],
        answer: 0,
        explain: [
          'Right. ' + fmt(x) + ' ≤ ' + fmt(P) + ', so it must join the small zone. i grows the zone by one slot, and whatever sits in that slot (the first value of the big zone, if there is one) trades places with it.',
          'That is what happens to a value larger than the pivot: it already sits in the big zone, so nothing needs to move. ' + fmt(x) + ' is not larger.',
          'The scan never stops early: it visits every value from lo to hi − 1 exactly once, and each one goes to the small or the big zone.'
        ]
      };
    }, { id: 'l16-lab-lomuto-swap' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'quickHoare') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'swap') return k;
      return -1;
    }, function (c) {
      var s = c.prev, i = null, j = null;
      s.pointers.forEach(function (p) { if (p.name === 'i') i = p.index; if (p.name === 'j') j = p.index; });
      if (i === null || j === null || i >= j) return null;
      var xi = s.items[i].value, xj = s.items[j].value;
      return {
        question: 'Both pointers have stopped: i on <b>' + fmt(xi) + '</b> (index ' + i + ') and j on <b>' + fmt(xj) + '</b> (index ' + j + '). i is still left of j. What happens next?',
        options: ['Swap a[' + i + '] and a[' + j + '], then move i right and j left', 'Swap a[' + i + '] with the pivot', 'The partition is over: split after j'],
        answer: 0,
        explain: [
          'Right. i found a value that belongs on the right and j found one that belongs on the left, and they have not crossed yet, so trading them fixes both at once. Then both pointers step inward and scan again.',
          'Hoare never swaps with the pivot during the scan; the pivot is just the value the two pointers compare against.',
          'The partition only ends when i ≥ j. Here i (' + i + ') is still smaller than j (' + j + '), so there is more to fix.'
        ]
      };
    }, { id: 'l16-lab-hoare-swap' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'quickLomuto') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'call' && st[k - 1].kind === 'place') return k;
      return -1;
    }, function (c) {
      var s = c.prev, p = s.split, lo = s.range[0], hi = s.range[1];
      if (p === undefined) return null;
      return {
        question: 'The first partition put the pivot at index <b>' + p + '</b>. What does quick sort do with the value at index ' + p + ' from now on?',
        options: ['Nothing: it is in its final place, and the recursion covers a[' + lo + '..' + (p - 1) + '] and a[' + (p + 1) + '..' + hi + '] only', 'It is included in the right side and sorted again', 'It is compared with the other pivots later, to double-check'],
        answer: 0,
        explain: [
          'Right. Everything left of it is ≤ it and everything right of it is larger, so no sorting step can ever move it. The two calls that follow are on either side of it.',
          'Lomuto’s pivot is excluded from both sides (the calls are lo..p−1 and p+1..hi). Hoare’s recursion is different: its right side would include it.',
          'Nothing needs double-checking: the partition has already proved where the pivot belongs.'
        ]
      };
    }, { id: 'l16-lab-lomuto-next' });

    /* ---- tabs ---- */
    var tabs = V.tabs('#lab-tabs', { onChange: function (name) { select(name, true); } });
    var flowSeg;
    function select(name, fromTabs, force) {
      if (name === algo && !force) return;
      algo = name;
      if (!fromTabs) tabs.select(name);
      code.setSource(S().CODE_QUICK[algo]);
      V.legend(legendEl, LEGENDS[algo]);
      flowView.setSpec(FLOWS[algo]);
      if (flowTitle) flowTitle.textContent = TITLE[algo] + ' as a flowchart';
      var alt = flowFig.querySelector('[data-flow-alt]');
      if (alt) alt.textContent = FLOW_ALT[algo];
      if (flowSeg && flowSeg.value !== algo) flowSeg.set(algo);
      reload();
    }
    function reload() {
      steps = generate();
      prepareAll(steps);
      player.setSteps(steps);
    }
    V.legend(legendEl, LEGENDS[algo]);
    flowSeg = V.segmented(flowFig.querySelector('[data-seg]'), {
      label: 'Partition', value: algo,
      options: [{ value: 'lomuto', label: 'Lomuto' }, { value: 'hoare', label: 'Hoare' }],
      onChange: function (v) { select(v, false); }
    });

    /* ---- input, pivot rule, view ---- */
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (0 to 16 values, −99 to 99)', value: values,
      parse: { min: -99, max: 99, maxCount: 16, minCount: 0 },
      presets: L16.PRESETS(9),
      hint: 'Repeated values get small a, b, c tags in box view, so you can see whether their order survives.',
      onApply: function (vals) { values = vals; reload(); }
    });
    V.segmented(fig.querySelector('[data-pivot]'), {
      label: 'Pivot rule', value: pivot, options: L16.PIVOT_OPTIONS,
      onChange: function (v) { pivot = v; reload(); }
    });
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Draw values as', value: mode, options: [{ value: 'boxes', label: 'Boxes' }, { value: 'bars', label: 'Bars' }],
      onChange: function (m) { mode = m; view.setOptions({ mode: m }); view.reset(); view.prepare(player.steps); player.refresh(); }
    });
    select('lomuto', true, true);
    return { select: function (n) { select(n, false); }, player: player };
  };

  /* ================================================================== quickselect lab */
  var SEL_DEFAULT = [7, 2, 9, 4, 3, 8, 5, 1, 6, 12, 10, 11];
  L16.initSelect = function () {
    var fig = V.$('#sel-fig');
    var values = SEL_DEFAULT.slice(), k = 4, pivot = 'last';
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 52, label: 'Array being searched by quickselect' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE_QUICK.select, default: 'pseudo', maxHeight: 357 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var note = fig.querySelector('[data-note]');
    function gen() { return S().quickselect(L16.labelDuplicates(values), k, { pivot: pivot, seed: SEED }); }
    var steps = gen();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps', partitions: 'Partitions' }, counterStates: { comparisons: 'compare', swaps: 'swap', partitions: 'pivot' },
      baseStepMs: 1000, label: 'Quickselect controls'
    });
    player.addCheckpoint(function (st) {
      for (var q = 1; q < st.length; q++) if (st[q].kind === 'discard') return q;
      return -1;
    }, function (c) {
      var s = c.prev, p = s.split;
      if (p === undefined) return null;
      var target = null;
      s.pointers.forEach(function (pt) { if (pt.name === 'k') target = pt.index; });
      if (target === null) return null;
      var left = target < p;
      return {
        question: 'The pivot landed at index <b>' + p + '</b>, and you are looking for the value that belongs at index <b>' + target + '</b>. Which part do you search next?',
        options: ['The left part, a[' + s.range[0] + '..' + (p - 1) + ']', 'The right part, a[' + (p + 1) + '..' + s.range[1] + ']', 'Both parts, as quick sort would'],
        answer: left ? 0 : 1,
        explain: left
          ? ['Right. Index ' + target + ' is left of the pivot’s final place ' + p + ', so the wanted value is in the left part. Every value on the right is larger than the pivot and cannot be it: discard them.', 'The right part holds values that belong at indexes above ' + p + '. Index ' + target + ' is below.', 'Quick sort needs both sides sorted; quickselect needs only the side that contains index ' + target + '. That is the whole saving.']
          : ['The left part holds indexes below ' + p + '; the wanted index ' + target + ' is above.', 'Right. Index ' + target + ' is right of the pivot’s final place ' + p + ', so the wanted value is in the right part. Everything on the left is at most the pivot: discard it.', 'Quick sort needs both sides sorted; quickselect needs only the side that contains index ' + target + '. That is the whole saving.']
      };
    }, { id: 'l16-select-side' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', shape: 'dot', label: 'k: where the answer belongs' }, { state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Comparing a[j]' }, { state: 'done', label: 'Pivot in its final place' }, { state: 'muted', label: 'Discarded' }, { state: 'found', label: 'The answer' }]);

    var sliderHost = fig.querySelector('[data-slider]'), slider;
    function makeSlider() {
      V.clear(sliderHost);
      k = Math.min(k, Math.max(1, values.length));
      slider = V.slider(sliderHost, { label: 'k (find the k-th smallest)', min: 1, max: Math.max(1, values.length), step: 1, value: k, onChange: function (v) { k = v; reload(); } });
    }
    function reload() {
      if (!values.length) { steps = S().quickselect([], 1); }
      else { steps = gen(); }
      view.reset(); view.prepare(steps); player.setSteps(steps);
      if (values.length) {
        var last = steps[steps.length - 1], full = S().quickCount(values, { partition: 'lomuto', pivot: pivot, seed: SEED });
        note.innerHTML = 'Quickselect used <b>' + last.ops.comparisons + '</b> comparisons for the ' + k + (k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th') + ' smallest of ' + values.length + ' values. Sorting all of them with the same pivot rule takes <b>' + full.comparisons + '</b>.';
      } else note.textContent = '';
    }
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (1 to 16 values, −99 to 99)', value: values,
      parse: { min: -99, max: 99, maxCount: 16, minCount: 1 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(12, { min: 5, max: 95 }); } },
        { label: 'Sorted', value: function () { return V.presets.sorted(12, { min: 5, max: 95 }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(12, { min: 5, max: 95 }); } },
        { label: 'Few unique', value: function () { return V.presets.fewUnique(12, { k: 3, min: 10, max: 90 }); } },
        { label: 'One value', value: [42] }
      ],
      hint: 'k runs from 1 (the minimum) to n (the maximum). For the median, use k = (n + 1) / 2.',
      onApply: function (vals) { values = vals; makeSlider(); reload(); }
    });
    V.segmented(fig.querySelector('[data-pivot]'), {
      label: 'Pivot rule', value: pivot,
      options: [{ value: 'last', label: 'Last' }, { value: 'median3', label: 'Median of 3' }, { value: 'random', label: 'Random' }],
      onChange: function (v) { pivot = v; reload(); }
    });
    makeSlider(); reload();
    return { player: player };
  };

  /* ================================================================== selecting vs sorting: cost chart */
  L16.initSelWork = function () {
    var fig = V.$('#fig-selwork');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Comparisons of quickselect and quick sort against n' });
    var which = 'median', cache = {};
    function kOf(n) { return which === 'min' ? 1 : which === 'max' ? n : Math.ceil(n / 2); }
    function pts(kind) {
      var key = kind + which;
      if (cache[key]) return cache[key];
      var out = [];
      for (var n = 10; n <= 400; n += 10) {
        var tot = 0, runs = 16;
        for (var r = 0; r < runs; r++) {
          var a = V.presets.random(n, { min: 1, max: 100000, seed: 900 + r * 31 + n });
          tot += kind === 'select' ? S().quickselectCount(a, kOf(n), { pivot: 'random', seed: r + 1 }).comparisons : S().quickCount(a, { pivot: 'random', seed: r + 1 }).comparisons;
        }
        out.push([n, Math.round(tot / runs)]);
      }
      return (cache[key] = out);
    }
    var NOTES = {
      median: 'The median is the hardest k: the answer sits in the middle, so the search range shrinks slowest. Expected cost is about 3.4 n comparisons, still a straight line, against sorting’s n log n curve.',
      min: 'The minimum needs about 2 n comparisons: each partition throws away the whole right side, and the sizes shrink geometrically.',
      max: 'The maximum behaves like the minimum, mirrored: about 2 n comparisons.'
    };
    function draw(dur) {
      chart.render({
        x: { label: 'array size n', min: 0, max: 400 },
        y: { label: 'comparisons (random pivot)', min: 0, max: 4000 },
        series: [
          { id: 'sort', label: 'Quick sort (sorts all)', points: pts('sort'), color: 3 },
          { id: 'select', label: 'Quickselect', points: pts('select'), color: 2 },
          { id: 'ref', label: 'n', fn: function (n) { return n; }, domain: [10, 400], state: 'muted', dashed: true }
        ]
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').textContent = NOTES[which];
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Find', value: which,
      options: [{ value: 'min', label: 'k = 1 (smallest)' }, { value: 'median', label: 'Median' }, { value: 'max', label: 'k = n (largest)' }],
      onChange: function (v) { which = v; draw(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', shape: 'line', label: 'Quick sort' }, { state: 'done', shape: 'line', label: 'Quickselect' }, { state: 'muted', shape: 'dash', label: 'n' }]);
    draw(0);
  };

  /* ================================================================== the race */
  var LANES = [
    { id: 'quick', title: 'Quick sort' },
    { id: 'merge', title: 'Merge sort' },
    { id: 'insertion', title: 'Insertion sort' }
  ];
  L16.initRace = function () {
    var fig = V.$('#fig-race');
    var lanesEl = fig.querySelector('[data-lanes]');
    var preset = 'random', n = 14, seed = 11, pivot = 'last';
    var narrow = lanesEl.clientWidth > 0 && lanesEl.clientWidth < 600;
    var lanes = LANES.map(function (def) {
      var status = h('span', { class: 'l16-lane__status' });
      var nameEl = h('span', { class: 'l16-lane__name' }, def.title);
      var host = h('div', { class: 'l16-lane__stage' });
      var stats = h('div', { class: 'l16-lane__stats' });
      var el = h('div', { class: 'l16-lane', 'data-algo': def.id }, h('div', { class: 'l16-lane__head' }, nameEl, status), host, stats);
      lanesEl.appendChild(el);
      var view = V.views.array(host, { mode: 'bars', showIndices: false, showValues: false, label: def.title + ' lane', cellSize: 26, barHeight: narrow ? 76 : 120, reserve: { held: true } });
      var st = V.stats(stats, { labels: { comparisons: 'Comparisons', moves: def.id === 'quick' ? 'Swaps' : def.id === 'merge' ? 'Writes' : 'Shifts', ticks: 'Ticks' }, states: { comparisons: 'compare', moves: 'swap' } });
      return { def: def, nameEl: nameEl, el: el, status: status, view: view, stats: st, frames: [] };
    });
    function input() {
      var o = { min: 5, max: 95, seed: seed };
      if (preset === 'sorted') return V.presets.sorted(n, o);
      if (preset === 'reversed') return V.presets.reversed(n, o);
      if (preset === 'nearly') return V.presets.nearlySorted(n, Object.assign({ swaps: 2 }, o));
      if (preset === 'few') return V.presets.fewUnique(n, Object.assign({ k: 3 }, o));
      return V.presets.random(n, o);
    }
    function trace(id, vals) {
      if (id === 'quick') return S().quickLomuto(vals, { pivot: pivot, seed: SEED });
      if (id === 'merge') return S().raceMerge(vals);
      return S().insertion(vals);
    }
    function build() {
      var vals = input(), T = 0;
      lanes.forEach(function (l) {
        l.frames = S().workFrames(trace(l.def.id, vals)).map(function (f) { return Object.assign({}, f, { pointers: [], regions: [] }); });
        l.view.reset(); l.view.prepare(l.frames);
        T = Math.max(T, l.frames.length);
        l.nameEl.textContent = l.def.id === 'quick' ? 'Quick sort (' + (pivot === 'last' ? 'last-element pivot' : 'median-of-3 pivot') + ')' : l.def.title;
      });
      var totals = lanes.map(function (l) { return l.frames.length - 1; });
      var sortedTotals = totals.slice().sort(function (a, b) { return a - b; });
      lanes.forEach(function (l, k) { l.total = totals[k]; l.rank = sortedTotals.indexOf(totals[k]) + 1; });
      var out = [];
      for (var t = 0; t < T; t++) out.push({ t: t, caption: caption(t, T), vals: vals });
      return out;
    }
    function label(l) { return l.def.id === 'quick' ? 'Quick' : l.def.id === 'merge' ? 'Merge' : 'Insertion'; }
    function caption(t, T) {
      if (t === 0) return 'Same ' + n + ' values in every lane. One tick = one comparison or one move (a swap, a write or a shift). Press play.';
      var done = lanes.filter(function (l) { return t >= l.total; }).sort(function (a, b) { return a.total - b.total; });
      if (t >= T - 1) {
        var order = lanes.slice().sort(function (a, b) { return a.total - b.total; });
        var lesson = '';
        if (preset === 'sorted' || preset === 'reversed') lesson = pivot === 'last' ? ' The last element is the largest (or smallest) in every range, so quick sort peels off one value per partition: a chain, as in the tree figure.' : ' The median of three finds the true middle of a sorted range, so quick sort keeps splitting evenly.';
        else if (preset === 'nearly') lesson = ' Insertion sort only pays for the disorder that is there' + (pivot === 'last' ? '; a last-element quick sort is also fooled by nearly sorted data.' : '.');
        else if (preset === 'few') lesson = ' Many equal values are a weakness of the two-way partition: quick sort loses ground here.';
        else lesson = ' On random input, quick sort needs far fewer ticks than insertion sort. Merge sort is in the same range.';
        return 'Finished: ' + order.map(function (l) { return '<b>' + label(l) + '</b> ' + l.total; }).join(', ') + ' ticks.' + lesson;
      }
      return 'Tick ' + t + '. ' + (done.length ? done.map(function (l) { return label(l) + ' finished at tick ' + l.total; }).join('; ') + '.' : 'All three are still working.');
    }
    function render(step, ctx) {
      lanes.forEach(function (l) {
        var k = Math.min(step.t, l.frames.length - 1), f = l.frames[k];
        l.view.render(f, { duration: ctx.duration });
        l.stats.update({ comparisons: f.ops.comparisons, moves: f.ops.swaps + f.ops.shifts, ticks: k });
        var fin = step.t >= l.total;
        l.el.classList.toggle('is-finished', fin);
        l.status.textContent = fin ? (l.rank === 1 ? '1st' : l.rank === 2 ? '2nd' : '3rd') + ' · ' + l.total + ' ticks' : 'running';
        l.status.setAttribute('data-rank', fin ? l.rank : '');
      });
    }
    var player = V.player({ root: fig, steps: build(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 240, speed: 2, speeds: [0.5, 1, 2, 4, 8], label: 'Race controls' });
    function rebuild() { player.setSteps(build()); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: preset,
      options: [{ value: 'random', label: 'Random' }, { value: 'nearly', label: 'Nearly sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'sorted', label: 'Sorted' }, { value: 'few', label: 'Few unique' }],
      onChange: function (v) { preset = v; rebuild(); }
    });
    V.segmented(fig.querySelector('[data-pivot]'), {
      label: 'Quick sort pivot', value: pivot,
      options: [{ value: 'last', label: 'Last element' }, { value: 'median3', label: 'Median of 3' }],
      onChange: function (v) { pivot = v; rebuild(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 6, max: 20, value: n, onChange: function (v) { n = v; rebuild(); }, onInput: function (v) { n = v; } });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed = (seed * 7919 + 13) % 100003; rebuild(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Comparing' }, { state: 'swap', label: 'Moving' }, { state: 'pivot', label: 'Pivot' }, { state: 'key', label: 'Held key' }, { state: 'done', label: 'Final' }]);
    return player;
  };
}());
