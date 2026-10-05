/* Lesson 16 — Quick sort & quickselect: helpers and the smaller figures.
   Step generators: js/algos/16-quick-sort.js (VDSA.algos.sorting.quickLomuto / quickHoare / quickThree / quickselect …).
   Loaded before js/lessons/16-quick-sort-lab.js (labs, race) and js/lessons/16-quick-sort.js (boot, checks, summary).

     L16.whenNear(el, fn)            run fn once when el comes within ~700px of the viewport (lazy figures)
     L16.labelDuplicates(values)     [{value, label}] with a/b/c tags on repeated values
     L16.fmt(v)                      numbers with a real minus sign
     L16.slice(steps, kinds)         the steps whose kind is listed (coarser traces)
     L16.init*                       one function per figure, started lazily by the boot file */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L16 = V.lessons = V.lessons || {};
  L16 = V.lessons.l16 = V.lessons.l16 || {};
  function S() { return V.algos.sorting; }
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  L16.fmt = fmt;

  /* ------------------------------------------------------------------ lazy init */
  L16.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 16] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  var TAGS = 'abcdefghijklmnop';
  L16.labelDuplicates = function (values) {
    var counts = {}, seen = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    return values.map(function (v) {
      if (counts[v] < 2) return { value: v };
      var k = seen[v] = (seen[v] || 0) + 1;
      return { value: v, label: TAGS[k - 1] || String(k) };
    });
  };
  L16.slice = function (steps, kinds) { return steps.filter(function (s) { return kinds.indexOf(s.kind) >= 0; }); };
  /* Drop region labels and pointer labels (small figures) */
  L16.quiet = function (step, o) {
    o = o || {};
    return Object.assign({}, step, {
      regions: o.keepRegions ? step.regions : [],
      pointers: o.keepPointers ? step.pointers : []
    });
  };
  var PRESET_OPTS = { min: 5, max: 95 };
  L16.PRESETS = function (N) {
    return [
      { label: 'Random', value: function () { return V.presets.random(N, PRESET_OPTS); } },
      { label: 'Sorted', title: 'Worst case for a first-element or last-element pivot', value: function () { return V.presets.sorted(N, PRESET_OPTS); } },
      { label: 'Reversed', title: 'Also a worst case for a last-element pivot', value: function () { return V.presets.reversed(N, PRESET_OPTS); } },
      { label: 'Nearly sorted', value: function () { return V.presets.nearlySorted(N, Object.assign({ swaps: 2 }, PRESET_OPTS)); } },
      { label: 'Few unique', title: 'Many equal keys', value: function () { return V.presets.fewUnique(N, Object.assign({ k: 3 }, { min: 10, max: 90 })); } },
      { label: 'All equal', value: [5, 5, 5, 5, 5, 5, 5, 5] },
      { label: 'One value', value: [42] }
    ];
  };
  L16.PIVOT_OPTIONS = [
    { value: 'last', label: 'Last' }, { value: 'first', label: 'First' }, { value: 'middle', label: 'Middle' },
    { value: 'random', label: 'Random' }, { value: 'median3', label: 'Median of 3' }
  ];

  /* ------------------------------------------------------------------ small helpers for charts */
  function shuffledInput(n, seed) { return V.shuffle(V.range(n).map(function (x) { return x + 1; }), V.rng(seed)); }
  function fewUniqueInput(n, seed) { var r = V.rng(seed), out = []; for (var i = 0; i < n; i++) out.push(r.int(1, 3)); return out; }
  function inputOf(kind, n, seed) {
    if (kind === 'sorted') return V.range(n).map(function (x) { return x + 1; });
    if (kind === 'reversed') return V.range(n).map(function (x) { return n - x; });
    if (kind === 'few') return fewUniqueInput(n, seed);
    if (kind === 'equal') { var a = []; for (var i = 0; i < n; i++) a.push(4); return a; }
    return shuffledInput(n, seed);
  }
  L16.inputOf = inputOf;

  /* ================================================================== the problem: sort by splitting, by hand */
  function perfectCost(n) { return n < 2 ? 0 : (n - 1) + perfectCost(Math.floor((n - 1) / 2)) + perfectCost(Math.ceil((n - 1) / 2)); }
  L16.perfectCost = perfectCost;

  L16.initHand = function () {
    var fig = V.$('#fig-hand');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 52, label: 'Numbers to sort by choosing pivots', showIndices: false, onItemClick: null });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { splits: 'Pivots chosen', cmp: 'Comparisons', best: 'A perfect pivot each time' }, states: { splits: 'pivot', cmp: 'compare', best: 'done' } });
    var msg = fig.querySelector('[data-msg]');
    var START = [47, 12, 83, 29, 65, 8, 74, 36, 91, 52, 20];
    var order, done, segs, splits, cmp, rng = V.rng(16);
    function vals(id) { return byId[id]; }
    var byId = {};
    function reset(values) {
      order = values.map(function (v, i) { return 'h' + i; });
      byId = {}; values.forEach(function (v, i) { byId['h' + i] = v; });
      done = {}; splits = 0; cmp = 0;
      segs = [[0, values.length - 1]];
      if (values.length < 2) { segs = []; order.forEach(function (id) { done[id] = true; }); }
      draw(0);
      msg.removeAttribute('data-state');
      msg.innerHTML = 'Click any number inside the shaded group. It becomes the pivot: smaller numbers go left, larger numbers go right.';
    }
    function draw(dur) {
      var regions = segs.filter(function (s) { return s[1] > s[0]; }).map(function (s) { return { id: 'seg' + order[s[0]], from: s[0], to: s[1], state: 'active', label: 'unsorted' }; });
      view.render({
        items: order.map(function (id, k) { return { id: id, value: byId[id], state: done[id] ? 'done' : 'default' }; }),
        regions: regions
      }, { duration: dur === undefined ? 520 : dur });
      stats.update({ splits: splits, cmp: cmp, best: perfectCost(order.length) });
    }
    view.on('click', function (e) {
      var k = order.indexOf(e.id);
      var si = -1;
      segs.forEach(function (s, idx) { if (k >= s[0] && k <= s[1] && s[1] > s[0]) si = idx; });
      if (si < 0) return;
      var s = segs[si], ids = order.slice(s[0], s[1] + 1), pv = byId[e.id];
      var small = ids.filter(function (id) { return byId[id] < pv; }), big = ids.filter(function (id) { return byId[id] > pv; });
      var neu = small.concat([e.id], big);
      for (var q = 0; q < neu.length; q++) order[s[0] + q] = neu[q];
      cmp += ids.length - 1; splits++;
      var pk = s[0] + small.length;
      done[e.id] = true;
      var next = [];
      if (small.length > 1) next.push([s[0], pk - 1]); else if (small.length === 1) done[small[0]] = true;
      if (big.length > 1) next.push([pk + 1, s[1]]); else if (big.length === 1) done[big[0]] = true;
      segs.splice.apply(segs, [si, 1].concat(next));
      draw();
      var balance = Math.min(small.length, big.length) / Math.max(1, Math.max(small.length, big.length));
      var verdict = small.length + big.length === 0 ? '' : balance >= 0.5 ? ' A near-even split: the best kind of pivot.' : balance === 0 ? ' Everything landed on one side, so only one value was settled for ' + (ids.length - 1) + ' comparisons. That is the worst kind of pivot.' : ' A lopsided split: one side kept most of the work.';
      if (!segs.length) {
        var perfect = perfectCost(order.length), worst = order.length * (order.length - 1) / 2;
        msg.setAttribute('data-state', cmp <= perfect + 2 ? 'done' : 'compare');
        msg.innerHTML = '<b>Sorted with ' + splits + ' pivots and ' + cmp + ' comparisons.</b> Choosing the middle value of every group would have taken ' + perfect + '; the very worst choices take ' + worst + '. Splits near the middle keep the total close to the best case.';
      } else {
        msg.removeAttribute('data-state');
        msg.innerHTML = 'You picked <b>' + pv + '</b>: <b>' + small.length + '</b> smaller went left, <b>' + big.length + '</b> larger went right, and ' + pv + ' is final. Cost: ' + (ids.length - 1) + ' comparisons.' + verdict;
      }
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { reset(START); });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { reset(V.presets.random(11, { min: 5, max: 99, unique: true, rng: rng })); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Unsorted group: click a value' }, { state: 'done', label: 'In its final place' }]);
    reset(START);
  };

  /* ================================================================== intuition: three static facts */
  L16.initFacts = function () {
    var host = V.$('#mini-facts');
    var FACTS = [
      { title: 'The pivot’s home is known', cap: '<b>Its index is the count of smaller values.</b> Three values are smaller than 5, so 5 belongs at index 3, whatever order the sides are in.',
        state: { items: [3, 1, 2, 5, 9, 7, 8].map(function (v, k) { return { id: 'f' + k, value: v, state: k === 3 ? 'done' : 'default' }; }),
          regions: [{ from: 0, to: 2, state: 'frontier', label: 'smaller: 3' }, { from: 4, to: 6, state: 'visited', label: 'larger: 3' }],
          pointers: [{ name: 'index 3', index: 3, state: 'done', style: 'chip' }] } },
      { title: 'The two sides are independent', cap: '<b>Nothing crosses the pivot again.</b> The left side can be sorted without ever looking at the right side, and vice versa.',
        state: { items: [1, 3, 2, 5, 9, 7, 8].map(function (v, k) { return { id: 'g' + k, value: v, state: k === 3 ? 'done' : 'default' }; }),
          regions: [{ from: 0, to: 2, state: 'active', label: 'sort me' }, { from: 4, to: 6, state: 'active', label: 'sort me too' }] } },
      { title: 'Nothing to combine', cap: '<b>The array is sorted when the calls return.</b> Each value was settled on the way down, so no merge step is needed.',
        state: { items: [1, 2, 3, 5, 7, 8, 9].map(function (v, k) { return { id: 'j' + k, value: v, state: 'done' }; }),
          regions: [{ from: 0, to: 6, state: 'done', label: 'sorted' }] } }
    ];
    FACTS.forEach(function (f) {
      var stage = h('div', { class: 'mini__stage l16-fact', role: 'img', 'aria-label': f.title });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l16-mini-title' }, f.title), stage, h('figcaption', { html: f.cap })));
      var v = V.views.array(stage, { mode: 'boxes', cellSize: 34, showIndices: false, label: f.title });
      v.render(f.state, { duration: 0 });
    });
  };

  /* ================================================================== partition in isolation (Lomuto and Hoare) */
  L16.LEGEND_LOMUTO = [{ state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Comparing a[j]' }, { state: 'swap', label: 'Swapped' }, { state: 'frontier', shape: 'outline', label: '≤ pivot zone' }, { state: 'visited', shape: 'outline', label: '> pivot zone' }, { state: 'muted', shape: 'outline', label: 'not seen' }, { state: 'done', label: 'Final place' }];
  L16.LEGEND_HOARE = [{ state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Pointer moving' }, { state: 'active', label: 'Pointer stopped' }, { state: 'swap', label: 'Swapped' }, { state: 'frontier', shape: 'outline', label: '≤ pivot zone' }, { state: 'visited', shape: 'outline', label: '≥ pivot zone' }, { state: 'muted', shape: 'outline', label: 'not seen' }];

  L16.initPartition = function () {
    var fig = V.$('#fig-partition');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 60, label: 'Array being partitioned' });
    var kind = 'lomuto', values = [7, 2, 9, 4, 3, 8, 5];
    var legendEl = fig.querySelector('[data-legend]');
    var title = fig.querySelector('[data-title]');
    function gen() {
      var vals = L16.labelDuplicates(values);
      return kind === 'lomuto' ? S().partitionLomuto(vals, { pivot: 'last' }) : S().partitionHoare(vals, { pivot: 'first' });
    }
    var steps = gen();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps' }, counterStates: { comparisons: 'compare', swaps: 'swap' },
      baseStepMs: 1150, label: 'Partition controls'
    });
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'quickLomuto') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'place') return k;
      return -1;
    }, function (c) {
      var s = c.prev, ps = c.step.split, pivotVal = null, lo = s.range[0], hi = s.range[1];
      s.items.forEach(function (it, k) { if (k === hi) pivotVal = it.value; });
      var smaller = 0;
      s.order.forEach(function (id, k) { if (k < hi && s.items[k].value <= pivotVal) smaller++; });
      var opts = [ps, hi, lo, ps + 1].filter(function (x, k, a) { return a.indexOf(x) === k && x >= lo && x <= hi; });
      return {
        question: 'The scan is over. The pivot <b>' + fmt(pivotVal) + '</b> is still at the end. Where will the last swap put it?',
        options: opts.map(function (x) { return 'Index ' + x + (x === ps ? ', right after the last value that is ≤ ' + fmt(pivotVal) : x === hi ? ', where it is now' : x === lo ? ', the front' : ', one slot further'); }),
        answer: 0,
        explain: opts.map(function (x, k) {
          if (!k) return 'Right. ' + smaller + ' values are ≤ ' + fmt(pivotVal) + ' (i = ' + (ps - 1) + '), so the pivot belongs at index i + 1 = ' + ps + ': the count of values that must stand before it. The last swap trades it with the first value of the big zone.';
          if (x === hi) return 'The pivot was only parked at the end so the scan could ignore it. It is not in its sorted place unless every other value is ≤ it.';
          if (x === lo) return 'It would only go to the front if no value were ≤ it. Here ' + smaller + ' are, and they all have to stand before it.';
          return 'The pivot goes directly after the small zone, at i + 1, and i is ' + (ps - 1) + '. The value at i + 1 is the first of the big zone, and it moves to the end.';
        })
      };
    }, { id: 'l16-part-lomuto-lands' });
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'quickHoare') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'cross') return k;
      return -1;
    }, function (c) {
      var s = c.prev, ip = null, jp = null;
      s.pointers.forEach(function (p) { if (p.name === 'i') ip = p.index; if (p.name === 'j') jp = p.index; });
      var sp = c.step.split;
      if (ip === null || jp === null) return null;
      var lo = s.range[0], hi = s.range[1];
      var cand = [sp, sp + 1, lo].filter(function (x, k, a) { return a.indexOf(x) === k && x >= lo && x < hi; });
      return {
        question: 'Both pointers have stopped: i is at index ' + ip + ' and j at index ' + jp + ', and i is no longer left of j. Where does Hoare split the array?',
        options: cand.map(function (x) { return 'After index ' + x + (x === sp ? ', at j' : x === sp + 1 ? (ip === sp + 1 ? ', at i' : ', one past j') : ', where the pivot started'); }),
        answer: 0,
        explain: cand.map(function (x, k) {
          if (!k) return 'Right. The rule is: when i ≥ j, return j. Everything up to index j is ≤ pivot and everything after it is ≥ pivot, so the two sides are sorted separately. The pivot is not guaranteed to be at j.';
          if (x === sp + 1) return (ip === sp + 1 ? 'That is the position of i. ' : 'That is one slot past j (i has not moved past j here). ') + 'Hoare splits after j, so the left side is a[lo..j] and the right side a[j + 1..hi].';
          return 'The pivot started at the front, but it may have been swapped away. Hoare does not track it: it only promises left ≤ pivot ≤ right.';
        })
      };
    }, { id: 'l16-part-hoare-split' });
    V.legend(legendEl, L16.LEGEND_LOMUTO);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Partition', value: kind,
      options: [{ value: 'lomuto', label: 'Lomuto (pivot = last)' }, { value: 'hoare', label: 'Hoare (pivot = first)' }],
      onChange: function (v) { kind = v; reload(); }
    });
    function reload() {
      title.textContent = kind === 'lomuto' ? 'One Lomuto partition, step by step' : 'One Hoare partition, step by step';
      V.legend(legendEl, kind === 'lomuto' ? L16.LEGEND_LOMUTO : L16.LEGEND_HOARE);
      steps = gen(); view.reset(); view.prepare(steps); player.setSteps(steps);
    }
    var rng = V.rng(160);
    fig.querySelector('[data-new]').addEventListener('click', function () { values = V.presets.random(7, { min: 1, max: 9, unique: true, rng: rng }); reload(); });
    return player;
  };

  /* ================================================================== recursion: one partition per step, with the tree */
  L16.initLevels = function () {
    var fig = V.$('#fig-levels');
    var arr = V.views.array(fig.querySelector('[data-arr]'), { mode: 'boxes', cellSize: 46, label: 'Array being sorted by quick sort', showIndices: true });
    var all = S().quickLomuto([8, 3, 11, 5, 1, 9, 12, 2, 7, 10, 4, 6], { pivot: 'last' });
    var steps = L16.slice(all, ['start', 'call', 'place', 'base', 'done']).map(function (s) { return Object.assign({}, s, { pointers: s.pointers.filter(function (p) { return p.name === 'p'; }) }); });
    /* size the stage from the deepest tree the run ever draws, so the last level is never cut off */
    var maxDepth = 0;
    steps.forEach(function (s) {
      var byId = {}, nodes = (s.tree && s.tree.nodes) || [];
      nodes.forEach(function (nd) { byId[nd.id] = nd; });
      (function walk(id, d) {
        var nd = byId[id]; if (!nd) return;
        if (d > maxDepth) maxDepth = d;
        if (nd.left !== undefined && nd.left !== null) walk(nd.left, d + 1);
        if (nd.right !== undefined && nd.right !== null) walk(nd.right, d + 1);
      }(s.tree && s.tree.root, 0));
    });
    var tree = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 34, label: 'Recursion tree', height: Math.max(210, 32 + 6 + 34 + maxDepth * 42 + 8) });
    arr.prepare(steps); tree.prepare(steps.map(function (s) { return s.tree; }));
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { arr.render(s, { duration: ctx.duration }); tree.render(s.tree, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps' }, counterStates: { comparisons: 'compare', swaps: 'swap' },
      baseStepMs: 1000, label: 'Recursion controls'
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Final place' }, { state: 'frontier', shape: 'outline', label: '≤ pivot' }, { state: 'visited', shape: 'outline', label: '> pivot' }, { state: 'muted', label: 'Waiting: not in this call' }, { state: 'active', label: 'Running call (tree)' }, { state: 'frontier', shape: 'dot', label: 'Suspended call (tree)' }]);
    return player;
  };

  /* ================================================================== balanced tree vs chain */
  function treeFrames(nodes) {
    var byId = {}, kids = {};
    nodes.forEach(function (nd) { byId[nd.id] = nd; });
    var frames = [];
    for (var k = 0; k <= nodes.length; k++) {
      var live = nodes.slice(0, k), anc = {};
      if (k > 0) { var cur = nodes[k - 1]; while (cur) { anc[cur.id] = true; cur = cur.parent ? byId[cur.parent] : null; } }
      var cmpSoFar = 0, depth = 0;
      var out = live.map(function (nd) {
        cmpSoFar += nd.comparisons; if (nd.depth > depth) depth = nd.depth;
        var st = k === nodes.length ? 'done' : nd.id === nodes[k - 1].id ? 'active' : anc[nd.id] ? 'frontier' : 'done';
        var o = { id: nd.id, label: fmt(nd.pivot), state: st };
        if (nd.size > 1) { o.badge = nd.comparisons; o.badgeState = 'compare'; }
        return o;
      });
      live.forEach(function (nd) {
        if (nd.parent) { var p = out.filter(function (x) { return x.id === nd.parent; })[0]; if (p) p[nd.side === 'L' ? 'left' : 'right'] = nd.id; }
      });
      frames.push({ k: k, tree: { root: live.length ? live[0].id : null, nodes: out }, comparisons: cmpSoFar, depth: depth, calls: k });
    }
    return frames;
  }
  L16.treeFrames = treeFrames;

  L16.initTrees = function () {
    var fig = V.$('#fig-trees');
    var sides = { good: fig.querySelector('[data-side="good"]'), bad: fig.querySelector('[data-side="bad"]') };
    var N = 15, input = 'sorted';
    var views = {}, stats = {};
    ['good', 'bad'].forEach(function (k) {
      views[k] = V.views.tree(sides[k].querySelector('[data-tree]'), { nodeSize: 40, minNodeSize: 22, gap: 0.12, levelHeight: 46,   /* no fixed height: the stage grows to the deepest prepared frame, so a 15-deep chain is never clipped */ label: k === 'good' ? 'Recursion tree with the middle value as pivot' : 'Recursion tree with the last value as pivot' });
      stats[k] = V.stats(sides[k].querySelector('[data-stats]'), { labels: { comparisons: 'Comparisons', depth: 'Levels deep', calls: 'Calls' }, states: { comparisons: 'compare', depth: 'pivot', calls: 'active' } });
    });
    var pair, caption = fig.querySelector('[data-caption]');
    function build() {
      var vals = input === 'sorted' ? inputOf('sorted', N) : shuffledInput(N, 7);
      var good = S().quickTree(vals, { pivot: 'middle' }), bad = S().quickTree(vals, { pivot: 'last' });
      pair = { good: treeFrames(good.nodes), bad: treeFrames(bad.nodes), goodTotal: good, badTotal: bad };
      var steps = [];
      for (var k = 0; k <= N; k++) steps.push({ k: k });
      return steps;
    }
    var steps = build();
    ['good', 'bad'].forEach(function (k) { views[k].prepare(pair[k].map(function (f) { return f.tree; })); });
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) {
        ['good', 'bad'].forEach(function (k) {
          var f = pair[k][Math.min(s.k, pair[k].length - 1)];
          views[k].render(f.tree, { duration: ctx.duration });
          stats[k].update({ comparisons: f.comparisons, depth: f.depth, calls: f.calls });
        });
      },
      baseStepMs: 750, label: 'Tree comparison controls'
    });
    function cap(s) {
      var g = pair.goodTotal, b = pair.badTotal;
      if (s.k === 0) return 'Same ' + N + ' values ' + (input === 'sorted' ? 'in sorted order' : 'in a shuffled order') + ' on both sides. Each step is one more call. Press play.';
      if (s.k === N) return 'Done. Middle pivot: <b>' + g.comparisons + '</b> comparison' + (g.comparisons === 1 ? '' : 's') + ', ' + g.depth + ' level' + (g.depth === 1 ? '' : 's') + '. Last-value pivot: <b>' + b.comparisons + '</b> comparison' + (b.comparisons === 1 ? '' : 's') + ', ' + b.depth + ' level' + (b.depth === 1 ? '' : 's') + '.' +
        (input === 'sorted' ? ' On sorted input the last value is always the largest, so every call leaves n − 1 values in a single group: a chain, and n(n − 1)/2 comparisons.' : ' On shuffled input the last value is as good as any other, so both trees are bushy and the totals are close. The pivot rule only hurts on inputs that line up against it.');
      var nd = null;
      return 'Call ' + s.k + ' of ' + N + '. The number on each node is the comparisons that call pays: one per other value in its range.';
    }
    player.on('step', function (s) { caption.innerHTML = cap(s); });
    caption.innerHTML = cap(steps[0]);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: input,
      options: [{ value: 'sorted', label: 'Sorted input' }, { value: 'shuffled', label: 'Shuffled input' }],
      onChange: function (v) {
        input = v; var st = build();
        ['good', 'bad'].forEach(function (k) { views[k].reset(); views[k].prepare(pair[k].map(function (f) { return f.tree; })); });
        player.setSteps(st);
        caption.innerHTML = cap(st[0]);
      }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Running call' }, { state: 'frontier', label: 'Waiting for its children' }, { state: 'done', label: 'Returned' }, { state: 'compare', shape: 'dot', label: 'Comparisons paid' }]);
    return player;
  };

  /* ================================================================== comparisons vs n for four pivot rules */
  L16.initStrategies = function () {
    var fig = V.$('#fig-strategies');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Comparisons against n for four pivot rules', height: (fig.querySelector('[data-stage]').clientWidth || 800) < 520 ? 300 : undefined });
    var kind = 'sorted', log = false, cache = {};
    var RULES = [
      { id: 'last', label: 'Last element', pivot: 'last', color: 0 },
      { id: 'middle', label: 'Middle element', pivot: 'middle', color: 2 },
      { id: 'median3', label: 'Median of three', pivot: 'median3', color: 1 },
      { id: 'random', label: 'Random', pivot: 'random', color: 3 }
    ];
    function points(rule) {
      var key = rule.id + kind;
      if (cache[key]) return cache[key];
      var pts = [], avg = kind === 'shuffled' || kind === 'few';
      for (var n = 8; n <= 200; n += 8) {
        var runs = avg || rule.pivot === 'random' ? 10 : 1, tot = 0;
        for (var r = 0; r < runs; r++) tot += S().quickCount(inputOf(kind, n, 40 + r * 13 + n), { pivot: rule.pivot, seed: r + 1 }).comparisons;
        pts.push([n, Math.round(tot / runs)]);
      }
      return (cache[key] = pts);
    }
    var NOTES = {
      sorted: 'Sorted input: the last-element rule (and the first-element rule, which is identical here) makes n(n − 1)/2 comparisons and shoots off the top of the chart. Middle and median of three split perfectly. The random rule stays near n log₂ n at these sizes (the 1.39 factor is the large-n limit).',
      reversed: 'Reversed input is just as bad for the last-element rule. The middle element and median of three are still perfect here; random does not care.',
      shuffled: 'Shuffled input: nothing lines up against any rule, so all four sit close to n log₂ n (dashed). Simple rules only fail on inputs that are ordered against them.',
      few: 'Only three different values: every rule collapses, because Lomuto sends all values equal to the pivot to one side. Pivot choice cannot fix duplicates; a three-way partition can (later in this lesson).'
    };
    function draw(dur) {
      var ser = RULES.map(function (r) { return { id: r.id, label: r.label, points: points(r), color: r.color }; });
      ser.push({ id: 'ref', label: 'n log₂ n', fn: function (n) { return n * Math.log2(n); }, domain: [8, 200], state: 'muted', dashed: true });
      chart.render({
        x: { label: 'input size n', min: 0, max: 200 },
        y: log ? { label: 'comparisons (log scale)', scale: 'log', min: 10, max: 30000 } : { label: 'comparisons', min: 0, max: 3200 },
        series: ser
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').textContent = NOTES[kind];
    }
    V.segmented(fig.querySelector('[data-input]'), {
      label: 'Input', value: kind,
      options: [{ value: 'sorted', label: 'Sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'shuffled', label: 'Shuffled' }, { value: 'few', label: 'Few unique' }],
      onChange: function (v) { kind = v; draw(); }
    });
    V.segmented(fig.querySelector('[data-scale]'), {
      label: 'Axis', value: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }],
      onChange: function (v) { log = v === 'log'; draw(900); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Last element' }, { state: 'done', shape: 'line', label: 'Middle element' }, { state: 'compare', shape: 'line', label: 'Median of three' }, { state: 'pivot', shape: 'line', label: 'Random' }, { state: 'muted', shape: 'dash', label: 'n log₂ n' }]);
    draw(0);
  };

  /* ================================================================== bad luck is rare: histogram of random-pivot runs */
  L16.initLuck = function () {
    var fig = V.$('#fig-luck');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Histogram of comparison counts over random-pivot runs' });
    var n = 30, results = [], readout = fig.querySelector('[data-readout]'), seedNext = 1;
    var BIN = 15;
    function run(count) {
      var sorted = inputOf('sorted', n);
      for (var i = 0; i < count; i++) results.push(S().quickCount(sorted, { pivot: 'random', seed: seedNext++ }).comparisons);
    }
    function draw(dur) {
      var worst = n * (n - 1) / 2, lo = 60, hi = Math.max(240, Math.ceil(Math.max.apply(null, results.concat([1])) / BIN) * BIN);
      var cats = [], counts = [];
      for (var b0 = lo; b0 < hi; b0 += BIN) { cats.push(b0 + '–' + (b0 + BIN - 1)); counts.push(0); }
      results.forEach(function (r) { var k = Math.floor((Math.max(r, lo) - lo) / BIN); if (k >= counts.length) k = counts.length - 1; counts[k]++; });
      chart.render({
        categories: cats,
        series: [{ id: 'runs', label: 'Runs', values: counts, state: 'pivot' }],
        y: { label: 'number of runs', min: 0, max: Math.max(10, Math.ceil(Math.max.apply(null, counts.concat([1])) * 1.15)) }
      }, { duration: dur === undefined ? 500 : dur });
      if (!results.length) { readout.innerHTML = 'No runs yet. Press <b>Run 100 more</b>.'; return; }
      var sum = 0, mx = 0, mn = Infinity;
      results.forEach(function (r) { sum += r; if (r > mx) mx = r; if (r < mn) mn = r; });
      var mean = sum / results.length, over = results.filter(function (r) { return r > 2 * mean; }).length;
      readout.innerHTML = '<b>' + results.length + ' runs</b>: mean ' + mean.toFixed(0) + ' comparisons, best ' + mn + ', worst seen ' + mx + '. The worst possible is ' + worst + ', and ' + over + ' runs out of ' + results.length + ' cost more than twice the mean. The exact expected cost for n = ' + n + ' is about ' + Math.round(expected(n)) + ', and it grows like 2 n ln n.';
    }
    function expected(m) { var c = [0, 0]; for (var i = 2; i <= m; i++) { var s = 0; for (var j = 0; j < i; j++) s += c[j]; c[i] = (i - 1) + 2 * s / i; } return c[m]; }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Array size n', min: 10, max: 50, step: 2, value: n, onChange: function (v) { n = v; results = []; seedNext = 1; run(100); draw(); } });
    fig.querySelector('[data-more]').addEventListener('click', function () { run(100); draw(); });
    fig.querySelector('[data-clear]').addEventListener('click', function () { results = []; draw(); });
    run(100);
    draw(0);
  };

  /* ================================================================== decision diagram: choosing a pivot */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Could the input be sorted, reversed or patterned?', col: 0, row: 0 },
      { id: 'last', type: 'end', text: 'Last or first element', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Must the worst case be guaranteed?', col: 0, row: 1 },
      { id: 'safe', type: 'end', text: 'Merge sort, heapsort or introsort', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Many equal keys?', col: 0, row: 2 },
      { id: 'flag', type: 'end', text: 'Random pivot + three-way partition', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Can you spare 3 comparisons per partition?', col: 0, row: 3 },
      { id: 'med', type: 'end', text: 'Median of three', col: 1, row: 3 },
      { id: 'rand', type: 'end', text: 'Random pivot', col: 0, row: 4 }
    ],
    edges: [
      { from: 'q1', to: 'last', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
      { from: 'q2', to: 'safe', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'flag', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'med', label: 'yes' }, { from: 'q4', to: 'rand', label: 'no' }
    ]
  };
  var CHOOSE_WHY = {
    last: '<b>Last or first element.</b> If the data really is in random order, any fixed position is as good as any other, and it costs nothing. The risk is that real data is rarely random: logs, IDs and timestamps arrive nearly sorted.',
    safe: '<b>Use a guaranteed algorithm.</b> Merge sort and heapsort are n log n in the worst case. Introsort (quick sort that falls back to heapsort when the recursion gets too deep) keeps quick sort’s speed with that guarantee, and it is what C++ std::sort does.',
    flag: '<b>Random pivot and a three-way partition.</b> The random pivot removes bad inputs; the three-way partition puts all equal keys in one zone that is never revisited, so many duplicates make the sort faster instead of slower.',
    med: '<b>Median of three.</b> The middle of the first, middle and last values is a good pivot on sorted, reversed and random input, at the price of three comparisons per partition. A hand-built input can still beat it, so real libraries add a depth limit.',
    rand: '<b>Random pivot.</b> No fixed input is bad; only unlucky random draws are. Expected cost is 2 n ln n comparisons on every input, at the price of one random number per partition.'
  };
  L16.initChoose = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'How should I choose the pivot?', narrowWidth: 380 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q1'], taken = {};
    function show(d) {
      var cur = path[path.length - 1], st = {};
      if (CHOOSE_WHY[cur]) st[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: st }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box with its <b>yes</b> or <b>no</b> button.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    show(0);
  };

  /* ================================================================== Dutch national flag */
  L16.initFlag = function () {
    var fig = V.$('#fig-flag');
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.array(stage, { mode: 'dots', cellSize: 46, label: 'Red, white and blue discs to sort', showIndices: true, pointerStyle: 'chip' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE_QUICK.three, default: 'pseudo', maxHeight: 296 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var values = [2, 0, 1, 1, 2, 0, 2, 1, 0, 2];
    function gen() { return S().dutchFlag(values); }
    var steps = gen();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Looks at an item', swaps: 'Swaps' }, counterStates: { comparisons: 'compare', swaps: 'swap' },
      baseStepMs: 1000, label: 'Dutch flag controls'
    });
    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'greater' && st[k].ops.swaps > 0) return k;
      for (k = 1; k < st.length; k++) if (st[k].kind === 'greater') return k;
      return -1;
    }, function (c) {
      var s = c.prev, ip = null;
      s.pointers.forEach(function (p) { if (p.name === 'i') ip = p.index; });
      if (ip === null) return null;
      var v = s.items[ip].value;
      if (v !== 2) return null;
      return {
        question: 'Pointer i is on a <b>blue</b> item, which is greater than the white pivot value. What happens next?',
        options: ['Swap it with the item at gt, shrink gt, and leave i where it is', 'Swap it with the item at lt, and move lt and i on', 'Just move i on: blue items belong at the right anyway'],
        answer: 0,
        explain: [
          'Right. Blue goes to the greater zone at the right end, so it swaps with the last unseen item and gt shrinks. The item that arrives at i has not been looked at, so i must stay and examine it.',
          'That is what happens for a red (less-than) item: it swaps with the front of the equal zone. A blue one belongs at the other end.',
          'Moving on would leave a blue item in the unseen middle, and the greater zone only grows from the right end. The blue item has to be moved there.'
        ]
      };
    }, { id: 'l16-flag-blue' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'dot', label: 'Red (0): less than the pivot' }, { state: 'default', shape: 'ring', label: 'White (1): the pivot value' }, { state: 'active', shape: 'dot', label: 'Blue (2): greater' }, { state: 'muted', shape: 'outline', label: 'not seen yet' }]);
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your flags: 0 = red, 1 = white, 2 = blue (up to 16)', value: values,
      parse: { min: 0, max: 2, maxCount: 16, minCount: 0, integers: true },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(10, { min: 0, max: 2 }); } },
        { label: 'Reversed', value: [2, 2, 2, 1, 1, 1, 0, 0, 0] },
        { label: 'Already sorted', value: [0, 0, 0, 1, 1, 2, 2, 2] },
        { label: 'No white', value: [2, 0, 2, 0, 0, 2, 2, 0] },
        { label: 'All white', value: [1, 1, 1, 1, 1, 1] },
        { label: 'One item', value: [2] }
      ],
      hint: 'Whole numbers 0, 1 or 2 only.',
      onApply: function (vals) { values = vals; steps = gen(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    });
    return player;
  };

  /* ================================================================== two-way vs three-way: comparisons on duplicates */
  L16.initDups = function () {
    var fig = V.$('#fig-dups');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Comparisons of two-way and three-way partitions' });
    var readout = fig.querySelector('[data-readout]'), n = 64;
    var CASES = [{ id: 'equal', label: 'All equal' }, { id: 'few', label: '3 different values' }, { id: 'shuffled', label: 'Random, distinct' }, { id: 'sorted', label: 'Already sorted' }];
    var PARTS = [{ id: 'lomuto', label: 'Lomuto (≤ pivot left)', state: 'error' }, { id: 'hoare', label: 'Hoare', state: 'active' }, { id: 'three', label: 'Three-way', state: 'done' }];
    function cost(part, kind) {
      var runs = kind === 'few' || kind === 'shuffled' ? 12 : 1, tot = 0;
      for (var r = 0; r < runs; r++) tot += S().quickCount(inputOf(kind, n, 90 + r * 17 + n), { partition: part, pivot: 'median3' }).comparisons;
      return Math.round(tot / runs);
    }
    function draw(dur) {
      var data = {};
      PARTS.forEach(function (p) { data[p.id] = CASES.map(function (c) { return cost(p.id, c.id); }); });
      chart.render({
        categories: CASES.map(function (c) { return c.label; }),
        series: PARTS.map(function (p) { return { id: p.id, label: p.label, values: data[p.id], state: p.state }; }),
        y: { label: 'comparisons, n = ' + n, min: 0 }
      }, { duration: dur === undefined ? 600 : dur });
      readout.innerHTML = 'All values equal, n = ' + n + ': Lomuto makes <b>' + data.lomuto[0] + '</b> comparisons (n(n − 1)/2 = ' + (n * (n - 1) / 2) + ' for the partitions themselves, plus the few comparisons spent choosing each median-of-three pivot), Hoare <b>' + data.hoare[0] + '</b>, three-way <b>' + data.three[0] + '</b>. With three different values the three-way partition still wins clearly. On distinct values the three are within a factor of two of each other: Hoare pays extra comparisons to save swaps, and the three-way partition pays one comparison per value against the pivot.';
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 16, max: 128, step: 8, value: n, onInput: function (v) { n = v; draw(250); } });
    draw(0);
  };
}());
