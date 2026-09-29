/* Lesson 13 — the big interactive figures: the five-tab lab (+ its flowchart), the decision tree of comparisons and the
   linear-vs-binary race. Uses VDSA.algos.binarySearch (js/algos/13-binary-search.js) and the helpers in
   js/lessons/13-binary-search-views.js. Started lazily by js/lessons/13-binary-search.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L13 = V.lessons.l13;
  function B() { return V.algos.binarySearch; }
  function fmt(v) { return L13.fmt(v); }
  var ORDER = ['exact', 'lower', 'upper', 'first', 'last'];
  var TITLE = { exact: 'Exact search', lower: 'Lower bound', upper: 'Upper bound', first: 'First occurrence', last: 'Last occurrence' };

  /* ================================================================== legends per variant */
  function legendFor(variant) {
    var l = [{ state: 'active', label: 'Candidates' }, { state: 'compare', label: 'Probe (mid)' }, { state: 'muted', label: 'Ruled out (side proven)' }];
    if (variant === 'exact') l.push({ state: 'found', label: 'Found' }, { state: 'error', label: 'Missed target' });
    else if (variant === 'lower' || variant === 'upper') l.push({ state: 'key', label: 'Boundary item' });
    else l.push({ state: 'key', label: 'Boundary item' }, { state: 'found', label: 'Match' });
    return l;
  }
  L13.legendFor = legendFor;

  /* ================================================================== flowcharts */
  function flowSpec(variant) {
    if (variant === 'exact') {
      return {
        nodes: [
          { id: 'start', type: 'start', text: 'lo = 0\nhi = n − 1', col: 1, row: 0 },
          { id: 'loop', type: 'decision', text: 'lo ≤ hi ?', col: 1, row: 1 },
          { id: 'none', type: 'end', text: 'return −1', col: 2, row: 1, narrow: { col: 1, row: 6 } },
          { id: 'mid', type: 'process', text: 'mid = lo + (hi − lo) div 2', col: 1, row: 2 },
          { id: 'cmp', type: 'decision', text: 'compare\na[mid] with x', col: 1, row: 3 },
          { id: 'left', type: 'process', text: 'hi = mid − 1', col: 0, row: 4, narrow: { col: 0, row: 4 } },
          { id: 'found', type: 'end', text: 'return mid', col: 1, row: 4, narrow: { col: 1, row: 5 } },
          { id: 'right', type: 'process', text: 'lo = mid + 1', col: 2, row: 4, narrow: { col: 2, row: 4 } }
        ],
        edges: [
          { from: 'start', to: 'loop' },
          { from: 'loop', to: 'mid', label: 'yes' },
          { from: 'loop', to: 'none', label: 'no', via: { fromSide: 'right', toSide: 'left' } },
          { from: 'mid', to: 'cmp' },
          { from: 'cmp', to: 'found', label: '=' },
          { from: 'cmp', to: 'left', label: '>', via: { fromSide: 'left', toSide: 'top' } },
          { from: 'cmp', to: 'right', label: '<', via: { fromSide: 'right', toSide: 'top' } },
          { from: 'left', to: 'loop', via: { fromSide: 'left', toSide: 'left' } },
          { from: 'right', to: 'loop', via: { fromSide: 'right', toSide: 'right' } }
        ]
      };
    }
    var test = { lower: 'a[mid] < x ?', first: 'a[mid] < x ?', upper: 'a[mid] ≤ x ?', last: 'a[mid] ≤ x ?' }[variant];
    var verify = variant === 'first' || variant === 'last';
    var nodes = [
      { id: 'start', type: 'start', text: 'lo = 0\nhi = n', col: 1, row: 0 },
      { id: 'loop', type: 'decision', text: 'lo < hi ?', col: 1, row: 1 },
      { id: 'mid', type: 'process', text: 'mid = lo + (hi − lo) div 2', col: 1, row: 2 },
      { id: 'cmp', type: 'decision', text: test, col: 1, row: 3 },
      { id: 'left', type: 'process', text: 'hi = mid', col: 0, row: 4 },
      { id: 'right', type: 'process', text: 'lo = mid + 1', col: 2, row: 4 }
    ];
    var edges = [
      { from: 'start', to: 'loop' },
      { from: 'loop', to: 'mid', label: 'yes' },
      { from: 'mid', to: 'cmp' },
      { from: 'cmp', to: 'left', label: 'no', via: { fromSide: 'left', toSide: 'top' } },
      { from: 'cmp', to: 'right', label: 'yes', via: { fromSide: 'right', toSide: 'top' } },
      { from: 'left', to: 'loop', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'right', to: 'loop', via: { fromSide: 'right', toSide: 'right' } }
    ];
    if (!verify) {
      nodes.push({ id: 'done', type: 'end', text: 'return lo', col: 2, row: 1, narrow: { col: 1, row: 6 } });
      edges.push({ from: 'loop', to: 'done', label: 'no', via: { fromSide: 'right', toSide: 'left' } });
    } else {
      nodes.push({ id: 'verify', type: 'decision', text: variant === 'first' ? 'lo < n and\na[lo] = x ?' : 'lo > 0 and\na[lo − 1] = x ?', col: 2, row: 1, narrow: { col: 1, row: 5 } });
      nodes.push({ id: 'found', type: 'end', text: variant === 'first' ? 'return lo' : 'return lo − 1', col: 3, row: 0, narrow: { col: 0, row: 6 } });
      nodes.push({ id: 'none', type: 'end', text: 'return −1', col: 3, row: 2, narrow: { col: 2, row: 6 } });
      edges.push({ from: 'loop', to: 'verify', label: 'no', via: { fromSide: 'right', toSide: 'left' } });
      edges.push({ from: 'verify', to: 'found', label: 'yes', via: { fromSide: 'right', toSide: 'left' } });
      edges.push({ from: 'verify', to: 'none', label: 'no', via: { fromSide: 'bottom', toSide: 'left' } });
    }
    return { nodes: nodes, edges: edges };
  }
  var FLOW_ALT = {
    exact: 'Text alternative: start with lo = 0 and hi = n − 1. While lo ≤ hi, compute mid and compare a[mid] with x: on equal, return mid; if a[mid] is less, set lo = mid + 1; if greater, set hi = mid − 1; then test the loop again. When lo passes hi, return −1.',
    lower: 'Text alternative: start with lo = 0 and hi = n. While lo < hi, compute mid; if a[mid] < x set lo = mid + 1, otherwise set hi = mid. When lo meets hi, return lo, the first index whose value is at least x.',
    upper: 'Text alternative: start with lo = 0 and hi = n. While lo < hi, compute mid; if a[mid] ≤ x set lo = mid + 1, otherwise set hi = mid. When lo meets hi, return lo, the first index whose value is greater than x.',
    first: 'Text alternative: run the lower-bound loop. Then, if lo < n and a[lo] = x, return lo; otherwise return −1.',
    last: 'Text alternative: run the upper-bound loop. Then, if lo > 0 and a[lo − 1] = x, return lo − 1; otherwise return −1.'
  };

  /* ================================================================== the lab */
  var DEFAULT_VALUES = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
  var UNSORTED = [3, 8, 62, 17, 23, 29, 34, 41, 47, 55, 12, 68, 74, 81, 90];
  function sorted64() { return V.presets.sorted(64, { min: 1, max: 400, seed: 64 }); }
  var PRESETS = [
    { label: 'Found in the middle', values: DEFAULT_VALUES, x: 23 },
    { label: 'Found at the start', values: DEFAULT_VALUES, x: 2 },
    { label: 'Absent', values: DEFAULT_VALUES, x: 40 },
    { label: 'Smaller than all', values: DEFAULT_VALUES, x: 1 },
    { label: 'Larger than all', values: DEFAULT_VALUES, x: 99 },
    { label: 'Duplicates', values: [1, 3, 3, 3, 3, 5, 7, 7, 9, 9, 9, 12], x: 3 },
    { label: 'One item', values: [42], x: 42 },
    { label: 'Empty', values: [], x: 7 },
    { label: '64 items', values: null, x: null, big: true },
    { label: 'Unsorted (breaks it)', values: UNSORTED, x: 62 }
  ];

  function optionsFor(list, correct, key) {
    // list of {text, ok}; returns options in a stable pseudo-random order plus the index of the right one
    var idx = list.map(function (o, i) { return i; });
    var rng = V.rng(key);
    var order = V.shuffle(idx, rng);
    var options = order.map(function (i) { return list[i].text; });
    var explain = order.map(function (i) { return list[i].why; });
    return { options: options, explain: explain, answer: order.indexOf(correct) };
  }

  L13.initLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var stage = fig.querySelector('[data-stage]');
    var variant = 'exact', values = DEFAULT_VALUES.slice(), target = 23, mode = 'boxes';
    var view = V.views.array(stage, { mode: mode, label: 'Sorted array being searched', barHeight: 210, cellSize: 54 });
    var legendEl = fig.querySelector('[data-legend]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: B().CODE.exact, default: 'js', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var targetEl = fig.querySelector('[data-target]'), targetErr = fig.querySelector('[data-target-err]'), warn = fig.querySelector('[data-warn]');

    /* invariants in the tab panels come from the generator's metadata (one source of truth) */
    ORDER.forEach(function (k) { var p = fig.querySelector('[data-invariant="' + k + '"]'); if (p) p.innerHTML = '<b>' + TITLE[k] + '</b> returns ' + B().VARIANTS[k].answer + '. <b>Invariant:</b> ' + B().VARIANTS[k].invariant; });

    /* flowchart below the lab, lit by the lab's current step */
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), flowSpec('exact'), { label: 'Flowchart of the search running in the lab', narrowWidth: 420 });
    var flowTitle = flowFig.querySelector('[data-flow-title]');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = 0; k < ctx.index && k < st.length; k++) if (st[k].flow && visited.indexOf(st[k].flow) === -1 && st[k].flow !== id) visited.push(st[k].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function generate() { return B().search(values, target, { variant: variant }); }
    function modeFor(n) { return n <= 16 ? 'boxes' : 'bars'; }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', left: 'Candidates left' }, counterStates: { comparisons: 'compare', left: 'active' },
      baseStepMs: 1050, label: 'Binary search lab controls'
    });

    /* ---- predictions ---- */
    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'discard') return k;
      return -1;
    }, function (c) {
      var p = c.prev, a = c.step, mid = p.mid, half = variant !== 'exact';
      var goesRight = a.lo > p.lo, v = p.vars['a[mid]'];
      var right = { lo: mid + 1, hi: p.hi }, left = { lo: p.lo, hi: half ? mid : mid - 1 };
      var correct = goesRight ? right : left;
      var wrongSame = goesRight ? { lo: mid, hi: p.hi } : { lo: p.lo, hi: half ? mid - 1 : mid };
      var wrongSide = goesRight ? left : right;
      var list = [
        { text: 'lo = ' + correct.lo + ', hi = ' + fmt(correct.hi), why: 'Right. ' + (goesRight ? 'The probe was too small, so lo jumps past it: lo = mid + 1 = ' + (mid + 1) + ', and hi does not change.' : 'The probe ' + (half ? 'is at least x, so hi = mid = ' + mid + ': mid might itself be the boundary.' : 'was too big, so hi steps below it: hi = mid − 1 = ' + (mid - 1) + '.') + ' lo does not change.') },
        { text: 'lo = ' + wrongSame.lo + ', hi = ' + fmt(wrongSame.hi), why: goesRight ? 'Close, but mid was just compared and cannot be the answer here, so lo must move to mid + 1, not stay at mid. Not moving past mid is the classic bug that can loop forever.' : (half ? 'For a boundary search, mid might itself be the first item ≥ x, so hi = mid, not mid − 1.' : 'mid was just compared and is not the target, so hi must move to mid − 1, not stay at mid. Staying at mid can loop forever.') },
        { text: 'lo = ' + wrongSide.lo + ', hi = ' + fmt(wrongSide.hi), why: 'That is the other branch. a[mid] = ' + fmt(v) + ' compared with x = ' + fmt(target) + ' says which half to keep: ' + (goesRight ? 'the probe is smaller, so the answer is to the right.' : 'the probe is bigger, so the answer is to the left.') },
        { text: 'lo = ' + p.lo + ', hi = ' + fmt(p.hi) + ' (nothing changes)', why: 'Every comparison rules out at least the probe itself, so at least one of lo and hi has to move.' }
      ];
      var seen = {};
      list = list.filter(function (o) { if (seen[o.text]) return false; seen[o.text] = true; return true; });
      var o = optionsFor(list, 0, 130 + mid);
      return { question: 'a[' + mid + '] = ' + fmt(v) + ' has just been compared with x = ' + fmt(target) + '. What are <code>lo</code> and <code>hi</code> after the next step?', options: o.options, answer: o.answer, explain: o.explain };
    }, { id: 'l13-lab-lohi' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].variant === 'exact') return -1;
      for (var k = st.length - 1; k > 0; k--) if (st[k].kind === 'done' || st[k].kind === 'boundary') return k;
      return -1;
    }, function (c) {
      var s = c.step, v = s.variant, n = s.n, b = s.lo, res = s.result;
      var isVerify = v === 'first' || v === 'last';
      var truth = isVerify ? res : b;
      var cands = [truth, truth + 1, truth - 1, -1].filter(function (x, i, arr) { return arr.indexOf(x) === i && x >= -1 && x <= n; });
      var list = cands.map(function (x, i) {
        var text = x === -1 ? '−1 (not found)' : 'Index ' + x;
        var why;
        if (i === 0) why = isVerify ? 'Right. The boundary is ' + b + ' and ' + (res >= 0 ? 'the item at ' + res + ' equals x, so that is the ' + (v === 'first' ? 'first' : 'last') + ' occurrence.' : 'the item next to it is not x, so x is absent.') : 'Right. lo and hi meet at ' + b + ': everything before it is ' + B().VARIANTS[v].leftSign + ' x and it is the first index that is ' + B().VARIANTS[v].rightSign + ' x' + (b === n ? ' (past the end)' : '') + '.';
        else if (x === -1) why = 'The bound searches never return −1 by themselves: they always return a position, even for absent x, and the first/last variants add a final check.';
        else why = 'Look at where lo and hi meet: that is the boundary, ' + b + '.';
        return { text: text, why: why };
      });
      var o = optionsFor(list, 0, 131 + truth);
      return { question: 'The loop is about to end with <code>lo = hi = ' + b + '</code>. What does this search return?', options: o.options, answer: o.answer, explain: o.explain };
    }, { id: 'l13-lab-answer' });

    /* ---- tabs, both ways ---- */
    var tabs = V.tabs('#lab-tabs', { onChange: function (name) { select(name, true); } });
    var flowSeg;
    function select(name, fromTabs, force) {
      if (name === variant && !force) return;
      variant = name;
      if (!fromTabs) tabs.select(name);
      code.setSource(B().CODE[variant]);
      V.legend(legendEl, legendFor(variant));
      flowView.setSpec(flowSpec(variant));
      if (flowTitle) flowTitle.textContent = TITLE[variant] + ' as a flowchart';
      var alt = flowFig.querySelector('[data-flow-alt]'); if (alt) alt.textContent = FLOW_ALT[variant];
      if (flowSeg && flowSeg.value !== variant) flowSeg.set(variant);
      reload();
    }
    function reload() {
      var n = values.length, m = modeFor(n);
      if (m !== mode) { mode = m; view.setOptions({ mode: m }); }
      steps = generate();
      view.reset(); view.prepare(steps);
      player.setSteps(steps);
      warn.hidden = B().isSorted(values);
      if (!warn.hidden) warn.innerHTML = '<b>This array is not sorted.</b> Binary search assumes “everything left of mid is smaller”, and that is false here. Step through and watch it discard the wrong half.';
      targetEl.value = String(target);
    }
    V.legend(legendEl, legendFor(variant));
    flowSeg = V.segmented(flowFig.querySelector('[data-seg]'), {
      label: 'Variant', value: variant,
      options: ORDER.map(function (k) { return { value: k, label: { exact: 'Exact', lower: 'Lower', upper: 'Upper', first: 'First', last: 'Last' }[k] }; }),
      onChange: function (v) { select(v, false); }
    });

    /* ---- inputs ---- */
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Sorted numbers (0 to 64 whole numbers, −999 to 999)',
      value: values,
      parse: function (text) {
        var r = V.parseNumbers(text, { min: -999, max: 999, minCount: 0, maxCount: 64, integers: true });
        return r;
      },
      hint: 'Binary search needs sorted input. Unsorted numbers are allowed here so you can watch it fail.',
      onApply: function (vals) { values = vals; reload(); }
    });
    function applyTarget() {
      var t = targetEl.value.trim().replace('−', '-');
      var num = Number(t);
      if (t === '' || !isFinite(num) || Math.floor(num) !== num || Math.abs(num) > 9999) {
        targetErr.textContent = 'Enter a whole number, for example 23.'; targetEl.setAttribute('aria-invalid', 'true'); return;
      }
      targetErr.textContent = ''; targetEl.removeAttribute('aria-invalid');
      target = num; reload();
    }
    fig.querySelector('[data-target-apply]').addEventListener('click', applyTarget);
    targetEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyTarget(); } });
    var presetsEl = fig.querySelector('[data-presets]');
    var rng = V.rng(1313);
    PRESETS.forEach(function (p) {
      presetsEl.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        if (p.big) { values = sorted64(); target = values[rng.int(0, 63)]; } else { values = p.values.slice(); target = p.x; }
        input.set(values); targetErr.textContent = ''; reload();
      } }, p.label));
    });
    presetsEl.insertBefore(h('span', { class: 'l13-presets__label' }, 'Try:'), presetsEl.firstChild);
    targetEl.value = String(target);
    select('exact', true, true);
    return { select: function (n) { select(n, false); }, player: player };
  };

  /* ================================================================== decision tree */
  L13.initTree = function () {
    var fig = V.$('#fig-tree');
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 40, minNodeSize: 14, label: 'Decision tree of binary search', levelHeight: 64 });
    var selectEl = fig.querySelector('[data-target]');
    var n = 7, target = 50, values, player, cur = [];
    function makeValues(k) { return Array.from({ length: k }, function (_, i) { return 10 * (i + 1); }); }
    function options() {
      var out = [];
      values.forEach(function (v, i) {
        out.push({ x: v - 5, text: (v - 5) + ' (absent: ' + B().gapText(values, i) + ')' });
        out.push({ x: v, text: v + ' (in the array)' });
      });
      out.push({ x: values[values.length - 1] + 5, text: (values[values.length - 1] + 5) + ' (absent: ' + B().gapText(values, values.length) + ')' });
      return out;
    }
    function fillSelect() {
      V.clear(selectEl);
      options().forEach(function (o) { selectEl.appendChild(h('option', { value: o.x }, o.text)); });
      selectEl.value = String(target);
      if (selectEl.value !== String(target)) { target = values[Math.floor(values.length / 2) + 1]; selectEl.value = String(target); }
    }
    function build() {
      values = makeValues(n);
      cur = B().treeSteps(values, target);
      view.reset(); view.prepare(cur);
      return cur;
    }
    build(); fillSelect();
    player = V.player({ root: fig, steps: cur, render: function (st, ctx) { view.render({ root: st.root, nodes: st.nodes, edges: st.edges }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'Decision tree controls' });
    function reload() { build(); player.setSteps(cur); }
    selectEl.addEventListener('change', function () { target = Number(selectEl.value); reload(); });
    fig.querySelector('[data-random]').addEventListener('click', function () {
      var opts = options(), pick = opts[V.rng(Date.now() % 9999).int(0, opts.length - 1)];
      target = pick.x; selectEl.value = String(target); reload(); player.play();
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Array size', value: 7,
      options: [{ value: 7, label: '7 values' }, { value: 15, label: '15 values' }],
      onChange: function (k) { n = k; target = k === 7 ? 50 : 90; build(); fillSelect(); player.setSteps(cur); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Comparison now' }, { state: 'visited', label: 'Already compared' }, { state: 'found', label: 'Found' }, { state: 'error', label: 'Absent: falls into a gap' }, { state: 'muted', label: '∅ gap (number = comparisons)' }]);
  };

  /* ================================================================== the race */
  L13.initRace = function () {
    var fig = V.$('#fig-race'), lanesEl = fig.querySelector('[data-lanes]');
    var n = 1000, tsel = 'middle', vals, plan, lin, lanes;
    var TARGETS = { first: 'The 3rd item', middle: 'A middle item', last: 'The last item', absent: 'Not in the array' };
    function build() {
      vals = Array.from({ length: n }, function (_, i) { return 2 * i + 1; });
      var idx = { first: 2, middle: Math.floor(n * 0.62), last: n - 1, absent: -1 }[tsel];
      var x = idx >= 0 ? vals[idx] : n;   // even number: never in the array
      plan = B().probes(vals, x, 'exact');
      var linTicks = B().linearComparisons(vals, x), binTicks = plan.probes.length;
      var found = idx >= 0;
      // single ticks until binary finishes, then fast-forward strides for the linear lane
      var steps = [], t;
      var single = Math.min(linTicks, Math.max(binTicks, 1)) + 1;
      for (t = 0; t < single; t++) steps.push({ t: t });
      var rest = Math.max(linTicks, binTicks);
      var stride = Math.max(1, Math.ceil((rest - single + 1) / 36));
      for (t = single - 1 + stride; t < rest; t += stride) steps.push({ t: t });
      if (steps[steps.length - 1].t !== rest) steps.push({ t: rest });
      steps.forEach(function (st, k) { st.fast = st.t >= single && stride > 1; st.stride = stride; });
      lin = { ticks: linTicks, idx: idx, found: found }; lin.bin = { ticks: binTicks, idx: plan.result };
      return { steps: steps, x: x, linTicks: linTicks, binTicks: binTicks, idx: idx };
    }
    var built = build();
    function mkLane(kind, title) {
      var status = h('span', { class: 'l13-lane__status' });
      var host = h('div', { class: 'l13-lane__bar' });
      var stats = h('div', { class: 'l13-lane__stats' });
      var el = h('div', { class: 'l13-lane', 'data-kind': kind }, h('div', { class: 'l13-lane__head' }, h('span', { class: 'l13-lane__name' }, title), status), host, stats);
      lanesEl.appendChild(el);
      var bar = L13.rangeBar(host, { min: 0, max: n - 1, ticks: [0, n - 1], tickText: function (v) { return v === 0 ? 'index 0' : 'index ' + L13.num(n - 1); }, height: 92, label: title + ' lane' });
      var st = V.stats(stats, { labels: { comparisons: 'Comparisons', left: 'Not yet ruled out' }, states: { comparisons: 'compare', left: 'active' }, format: function (v) { return L13.num(v); } });
      return { el: el, status: status, bar: bar, stats: st, kind: kind };
    }
    lanes = { lin: mkLane('linear', 'Linear search'), bin: mkLane('binary', 'Binary search') };
    function rebuildBars() {
      // the bars are sized for the current n: recreate them
      ['lin', 'bin'].forEach(function (k) { lanes[k].bar.destroy(); });
      V.clear(lanesEl); lanes = { lin: mkLane('linear', 'Linear search'), bin: mkLane('binary', 'Binary search') };
    }
    function render(st, ctx) {
      var t = st.t;
      // linear lane
      var lt = Math.min(t, built.linTicks), l = lanes.lin;
      var done = t >= built.linTicks;
      var lstate = { scan: lt > 0 ? [0, (done && lin.found ? built.idx : lt) - (done && lin.found ? 1 : 1)] : null, marks: [], describe: 'Linear search has checked ' + lt + ' values.' };
      if (lt > 0) lstate.scan = [0, lt - 1];
      if (lt > 0 && !(done && lin.found)) lstate.marks = [{ id: 'i', at: lt - 1, label: 'i = ' + L13.num(lt - 1), state: 'compare', side: 'above' }];
      if (done && lin.found) { lstate.hit = built.idx; lstate.marks = [{ id: 'i', at: built.idx, label: 'found ' + L13.num(built.idx), state: 'found', side: 'above' }]; }
      l.bar.render(lstate, { duration: ctx.duration });
      l.stats.update({ comparisons: lt, left: Math.max(0, n - (done && lin.found ? built.idx + 1 : lt)) });
      // binary lane
      var bt = Math.min(t, built.binTicks), b = lanes.bin, bdone = t >= built.binTicks;
      var probe = bt > 0 ? plan.probes[bt - 1] : null;
      var bstate = { marks: [], describe: 'Binary search has made ' + bt + ' comparisons.' };
      var left = n;
      if (!probe) bstate.live = [0, n - 1];
      else if (probe.move === 'found') { bstate.live = null; bstate.hit = probe.mid; left = 0; bstate.marks = [{ id: 'm', at: probe.mid, label: 'found ' + L13.num(probe.mid), state: 'found', side: 'above' }]; }
      else {
        var a = probe.loAfter, z = probe.hiAfter;
        left = Math.max(0, z - a + 1);
        bstate.live = left > 0 ? [a, z] : null;
        bstate.marks = [{ id: 'm', at: probe.mid, label: 'mid = ' + L13.num(probe.mid), state: 'compare', side: 'above' }];
      }
      b.bar.render(bstate, { duration: ctx.duration });
      b.stats.update({ comparisons: bt, left: left });
      // statuses
      function tag(lane, finished, ticks, text) { lane.el.classList.toggle('is-finished', finished); lane.status.textContent = finished ? text : 'running'; lane.status.removeAttribute('data-rank'); }
      var linWins = built.linTicks < built.binTicks, tie = built.linTicks === built.binTicks;
      tag(lanes.lin, done, built.linTicks, (lin.found ? 'found' : 'not found') + ' in ' + L13.num(built.linTicks) + ' ticks');
      tag(lanes.bin, bdone, built.binTicks, (plan.result >= 0 ? 'found' : 'not found') + ' in ' + built.binTicks + ' ticks');
      if (done && bdone) { var w = tie ? null : linWins ? lanes.lin : lanes.bin; if (w) w.status.setAttribute('data-rank', '1'); }
      else if (done && !bdone) lanes.lin.status.setAttribute('data-rank', '1');
      else if (bdone && !done) lanes.bin.status.setAttribute('data-rank', '1');
    }
    function caption(st) {
      var t = st.t, lt = Math.min(t, built.linTicks), bt = Math.min(t, built.binTicks);
      var doneL = t >= built.linTicks, doneB = t >= built.binTicks;
      var target = built.idx >= 0 ? 'a value at index ' + L13.num(built.idx) : 'a value that is not in the array';
      if (t === 0) return 'Both lanes search the same ' + L13.num(n) + ' sorted values for ' + target + '. One tick is one comparison. Press play, or step with <kbd>→</kbd>.';
      if (doneL && doneB) {
        var lw = built.linTicks < built.binTicks;
        return '<b>Both finished.</b> Linear search: <b>' + L13.num(built.linTicks) + '</b> comparisons. Binary search: <b>' + built.binTicks + '</b>. ' + (built.linTicks === built.binTicks ? 'A tie, on this target.' : lw ? 'Linear search wins this one because the target sits at the very front; that is its best case, and binary search does not know that.' : 'Binary search needed ' + Math.round(built.linTicks / built.binTicks) + ' times fewer looks' + (n >= 1000 ? ', and the gap widens as n grows.' : '.'));
      }
      if (doneB && !doneL) return '<b>Binary search has finished after ' + built.binTicks + ' comparisons.</b> Linear search has checked ' + L13.num(lt) + ' of ' + L13.num(n) + ' values' + (st.fast ? ' (fast-forwarding: each step is now ' + st.stride + ' ticks)' : '') + ' and still needs ' + L13.num(built.linTicks - lt) + ' more.';
      if (doneL && !doneB) return '<b>Linear search found it after ' + built.linTicks + ' comparisons</b>, before binary search finished: the target is near the front.';
      return 'Tick ' + t + '. Linear search has checked ' + L13.num(lt) + ' value' + (lt === 1 ? '' : 's') + ', ruling out ' + L13.num(lt) + '. Binary search has made ' + bt + ' comparison' + (bt === 1 ? '' : 's') + ' and ruled out ' + L13.num(n - (bt > 0 && plan.probes[bt - 1].move !== 'found' ? Math.max(0, plan.probes[bt - 1].hiAfter - plan.probes[bt - 1].loAfter + 1) : n)) + '.';
    }
    var steps = built.steps.map(function (st) { return Object.assign({}, st, { caption: caption(st) }); });
    var player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 900, speeds: [0.5, 1, 2, 4], label: 'Race controls' });
    function reset() {
      built = build();
      var st = built.steps.map(function (s) { return Object.assign({}, s, { caption: caption(s) }); });
      player.setSteps(st);
    }
    V.segmented(fig.querySelector('[data-seg-n]'), {
      label: 'Array size', value: n,
      options: [{ value: 100, label: '100 items' }, { value: 1000, label: '1,000 items' }],
      onChange: function (v) { n = v; rebuildBars(); reset(); }
    });
    V.segmented(fig.querySelector('[data-seg-t]'), {
      label: 'Target', value: tsel,
      options: [{ value: 'first', label: '3rd item' }, { value: 'middle', label: 'Middle-ish item' }, { value: 'last', label: 'Last item' }, { value: 'absent', label: 'Not there' }],
      onChange: function (v) { tsel = v; reset(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'Checked by linear search' }, { state: 'active', label: 'Not yet ruled out (binary)' }, { state: 'compare', shape: 'dot', label: 'Current probe' }, { state: 'found', label: 'Found' }]);
    return player;
  };
}());
