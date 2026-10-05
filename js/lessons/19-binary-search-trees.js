/* Lesson 19 · Binary search trees — figure wiring.
   Step generators: js/algos/19-binary-search-trees.js (VDSA.algos.lesson19, tested in Node).
   BST view + mini trees: js/lessons/19-binary-search-trees-view.js (VDSA.lesson19).
   The lab and the operation flowcharts: js/lessons/19-binary-search-trees-lab.js.

   Heavy figures start when they come within ~600px of the viewport (nearView). Append ?all to the URL to
   start every figure at once (used for full-page screenshots). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var B = V.algos.lesson19, L19 = V.lesson19;
  var bstView = L19.bstView, mini = L19.miniTree, num = B.num;
  var EAGER = /[?&]all\b/.test(location.search);

  /* ================================================================== shared helpers */
  function nearView(el, fn) {
    if (!el) return;
    function run() { try { fn(); } catch (e) { console.error('[lesson 19] figure failed', el.id, e); } }
    if (EAGER || !('IntersectionObserver' in window)) { run(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && !done) { done = true; io.disconnect(); run(); } });
    }, { rootMargin: '600px 0px 600px 0px' });
    io.observe(el);
  }
  L19.nearView = nearView;

  var LABELS = {
    comparisons: 'Comparisons', height: 'Height', nodes: 'Nodes', candidates: 'Keys still possible',
    levels: 'Levels risen', written: 'Keys written', moves: 'Moves', reported: 'Reported', visited: 'Visited', skipped: 'Skipped unseen'
  };
  L19.LABELS = LABELS;

  /* One bstView driven by one player. */
  function treeFigure(fig, steps, o) {
    o = o || {};
    var view = bstView(fig.querySelector('[data-stage]'), o.view || {});
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, c) { view.render(s, { duration: c.duration }); if (o.onRender) o.onRender(s, c); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: LABELS, counterStates: o.counterStates,
      flow: o.flow, baseStepMs: o.baseStepMs || 1250, label: o.label || 'Figure controls'
    });
    return {
      view: view, player: player,
      load: function (next) { view.reset(); view.prepare(next); player.setSteps(next); }
    };
  }
  function legend(fig, entries) { var el = fig.querySelector('[data-legend]'); if (el) V.legend(el, entries); }

  var TREES = {
    rule: [50, 30, 70, 20, 40, 60, 85, 10, 25, 35, 45, 65, 90],
    search: [50, 30, 72, 18, 41, 61, 87, 9, 24, 35, 46, 55, 66, 80, 93],
    insert: [8, 3, 10, 1, 6, 14, 4, 13],
    nav: [50, 30, 70, 20, 40, 60, 80, 10, 35, 45, 65, 75],
    del: [50, 30, 70, 20, 40, 60, 80, 45, 55, 65, 58],
    inorder: [44, 21, 70, 12, 33, 58, 86, 27, 39, 63, 91],
    range: [50, 25, 75, 12, 37, 62, 88, 6, 18, 31, 43, 56, 68, 81, 94],
    fold: [3, 8, 12, 17, 21, 26, 30, 34, 39, 43, 47, 52, 58, 63, 71],
    shape: [4, 9, 13, 18, 22, 27, 31, 36, 40, 45, 49, 54, 58, 63, 67]
  };
  L19.TREES = TREES;

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var rng = V.rng(19);
    function innerHeight() {
      var cs = getComputedStyle(stage);
      return Math.max(160, stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    }
    var view = bstView(stage, { nodeSize: 44, gap: 0.8, height: innerHeight(), describe: false, pad: 8, label: 'A key dropping into a binary search tree' });
    view.el.setAttribute('aria-hidden', 'true');
    /* level order of the balanced tree over sorted keys: the first three make a bushy start */
    function levelOrder(sorted) {
      var out = [], q = [[0, sorted.length - 1]];
      while (q.length) { var r = q.shift(); if (r[0] > r[1]) continue; var m = (r[0] + r[1]) >> 1; out.push(sorted[m]); q.push([r[0], m - 1]); q.push([m + 1, r[1]]); }
      return out;
    }
    function lap() {
      var keys, best = null, tries = 0;
      do {
        var sorted = V.presets.sorted(10, { min: 2, max: 98, rng: rng });
        var lo = levelOrder(sorted);
        keys = lo.slice(0, 5).concat(V.shuffle(lo.slice(5), rng));
        var hh = B.height(B.fromKeys(keys));
        if (!best || hh < best.h) best = { keys: keys, h: hh };
        tries += 1;
      } while (best.h > 3 && tries < 60);
      keys = best.keys;
      var tree = B.fromKeys(keys.slice(0, 5));
      var steps = [];
      var base = B.buildSteps([], { start: tree }).steps[0];
      base.caption = '';
      steps.push(base);
      keys.slice(5).forEach(function (k) {
        var res = B.insertSteps(tree, k);
        res.steps.forEach(function (s) { steps.push(s); });
        tree = res.tree;
      });
      var last = steps[steps.length - 1];
      steps.push(Object.assign({}, last, { nodes: last.nodes.map(function (n) { var c = Object.assign({}, n); c.state = 'done'; return c; }), edges: {}, pointers: [], probe: null, slots: [] }));
      steps.forEach(function (s) { s.pointers = []; });
      view.reset(); view.prepare(steps);
      return steps;
    }
    var teaser = V.teaser(stage, {
      steps: lap(), stepMs: 760, holdMs: 2200, instantWrap: true, regenerate: lap,
      render: function (s, c) { view.render(s, { duration: c.duration }); }
    });
    void teaser;
    V.onResize(stage, function () { view.setOptions({ height: innerHeight() }); });
  }

  /* ================================================================== problem: sorted array vs BST */
  function raceFigure() {
    var fig = V.$('#fig-race');
    var start = [12, 19, 27, 33, 41, 56, 64, 78, 85];
    var arrivals = [30, 70, 15];
    var cap = start.length + arrivals.length;
    legend(fig, [{ state: 'key', label: 'new key' }, { state: 'compare', label: 'compared' }, { state: 'swap', label: 'shifted' }, { state: 'done', label: 'placed' }]);

    var arr = start.slice();
    var tree = B.buildSteps(B.medianFirst(start)).tree;
    var steps = [], aCmp = 0, aMov = 0, tCmp = 0;
    function arrState(o) {
      o = o || {};
      var items = arr.map(function (v, i) {
        var st = 'default';
        if (o.compare === i) st = 'compare';
        if (o.shifted && o.shifted.indexOf(v) !== -1) st = 'swap';
        if (o.placed === v) st = 'done';
        return { id: 'a' + v, value: v, state: st };
      });
      var s = { items: items, length: cap };
      if (o.held !== undefined && o.held !== null) s.held = { id: 'a' + o.held, value: o.held, over: o.over, state: 'key' };
      if (o.lo !== undefined) s.regions = [{ from: o.lo, to: Math.max(o.lo, o.hi - 1), state: 'active', label: 'still possible' }];
      return s;
    }
    function push(a, t, caption) {
      steps.push({ arr: a, tree: t, caption: caption, stats: { array: { comparisons: aCmp, moves: aMov }, tree: { comparisons: tCmp, moves: 0 } } });
    }
    var first = B.buildSteps([], { start: tree }).steps[0];
    push(arrState(), first, 'Nine scores, stored twice: as a sorted array and as a binary search tree. Three new scores are about to arrive.');
    arrivals.forEach(function (key) {
      // array: lower-bound binary search, then shift, then write
      var lo = 0, hi = arr.length, aCompares = [];
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        aCompares.push({ lo: lo, hi: hi, mid: mid, v: arr[mid] });
        if (arr[mid] < key) lo = mid + 1; else hi = mid;
      }
      var pos = lo;
      var ins = B.insertSteps(tree, key);
      var tStart = ins.steps[0], tCompares = ins.steps.filter(function (s) { return s.kind === 'compare'; });
      var tNull = ins.steps.filter(function (s) { return s.kind === 'null'; })[0], tIns = ins.steps[ins.steps.length - 1];
      push(arrState({ held: key, over: (arr.length - 1) >> 1, lo: 0, hi: arr.length }), tStart, 'New score <b>' + key + '</b>. Both structures first have to find where it belongs.');
      var n = Math.max(aCompares.length, tCompares.length);
      for (var i = 0; i < n; i++) {
        var ac = aCompares[i], tc = tCompares[i];
        var parts = [];
        if (ac) { aCmp += 1; parts.push('<b>Array</b>: ' + key + (key > ac.v ? ' &gt; ' : ' ≤ ') + ac.v + ', keep the ' + (key > ac.v ? 'right' : 'left') + ' part.'); }
        else parts.push('<b>Array</b>: done searching: slot ' + pos + '.');
        if (tc) { tCmp += 1; parts.push('<b>Tree</b>: ' + key + (tc.side === 'left' ? ' &lt; ' : ' &gt; ') + num(tree.nodes[tc.at].value) + ', go ' + tc.side + '.'); }
        else parts.push('<b>Tree</b>: done walking.');
        var last = ac || aCompares[aCompares.length - 1];
        var aNow = ac ? arrState({ held: key, over: ac.mid, compare: ac.mid, lo: ac.lo, hi: ac.hi }) : arrState({ held: key, over: Math.min(pos, arr.length - 1), lo: pos, hi: pos + 1 });
        void last;
        push(aNow, tc || tCompares[tCompares.length - 1] || tStart, parts.join(' '));
      }
      var shifted = arr.slice(pos);
      aMov += shifted.length;
      var before = arr.slice();
      arr.splice(pos, 0, null);
      var aShift = {
        items: before.map(function (v, i) { return { id: 'a' + v, value: v, index: i < pos ? i : i + 1, state: i >= pos ? 'swap' : 'default' }; }),
        length: cap, held: { id: 'a' + key, value: key, over: pos, state: 'key' }, ghosts: [pos]
      };
      push(aShift, tNull, '<b>Array</b>: to open slot ' + pos + ', shift the ' + shifted.length + ' larger scores one place right: <b>' + shifted.length + ' moves</b>. <b>Tree</b>: the walk fell off an empty link. No key moves.');
      arr[pos] = key;
      push(arrState({ placed: key }), tIns, '<b>Array</b>: write ' + key + ' into the gap. <b>Tree</b>: hang ' + key + ' as a new leaf: one link, zero moves.');
      tree = ins.tree;
    });
    var lastStep = steps[steps.length - 1];
    steps.push({ arr: arrState(), tree: Object.assign({}, lastStep.tree, { nodes: lastStep.tree.nodes.map(function (n) { var c = Object.assign({}, n); delete c.state; return c; }), edges: {}, pointers: [] }), stats: lastStep.stats,
      caption: 'Three inserts: the array shifted <b>' + aMov + '</b> scores; the tree moved <b>none</b>. Both made a similar number of comparisons (' + aCmp + ' and ' + tCmp + '). The gap grows with the array: an insert near the front of a million scores shifts almost a million.' });

    var aView = V.views.array(fig.querySelector('[data-stage="array"]'), { mode: 'boxes', cellSize: 44, label: 'Sorted array of scores' });
    aView.prepare(steps.map(function (s) { return s.arr; }));
    var tView = bstView(fig.querySelector('[data-stage="tree"]'), { nodeSize: 40, gap: 1.7, levelHeight: 82, label: 'Binary search tree of the same scores' });
    tView.prepare(steps.map(function (s) { return s.tree; }));
    var aStats = V.stats(fig.querySelector('[data-stats="array"]'), { labels: LABELS, states: { moves: 'swap' } });
    var tStats = V.stats(fig.querySelector('[data-stats="tree"]'), { labels: LABELS, states: { moves: 'swap' } });
    V.player({
      root: fig, steps: steps, baseStepMs: 1300, label: 'Array versus tree controls',
      caption: fig.querySelector('[data-caption]'),
      render: function (s, c) {
        aView.render(s.arr, { duration: c.duration });
        tView.render(s.tree, { duration: c.duration });
        aStats.update(s.stats.array); tStats.update(s.stats.tree);
      }
    });
  }

  /* ================================================================== intuition: fold a sorted array */
  function foldFigure() {
    var fig = V.$('#fig-fold');
    legend(fig, [{ state: 'active', label: 'just risen' }, { state: 'visited', label: 'in the tree' }, { state: 'compare', label: 'asked now' }, { state: 'muted', label: 'ruled out' }, { state: 'found', label: 'found' }]);
    // 15 keys on wide screens; the middle 7 on phones, so every key stays readable without scrolling
    var stage = fig.querySelector('[data-stage]');
    function narrow() { return stage.clientWidth < 520; }
    function steps(n) { return n ? B.foldSteps([8, 17, 26, 34, 43, 52, 63], 43).steps : B.foldSteps(TREES.fold, 47).steps; }
    var isNarrow = narrow();
    var f = treeFigure(fig, steps(isNarrow), { view: { nodeSize: 40, colGap: 0.95, label: 'Sorted array folding into a binary search tree' }, baseStepMs: 1500, label: 'Fold controls' });
    V.onResize(stage, function () { var n = narrow(); if (n !== isNarrow) { isNarrow = n; f.load(steps(n)); } });
  }

  /* ================================================================== the rule: click a node, see its subtrees */
  function ruleFigure() {
    var fig = V.$('#fig-rule');
    legend(fig, [{ state: 'pivot', label: 'chosen node' }, { state: 'active', label: 'left subtree: all smaller' }, { state: 'compare', label: 'right subtree: all larger' }]);
    var t = B.fromKeys(TREES.rule), bounds = B.bounds(t);
    var selected = t.root, showRanges = false;
    var caption = fig.querySelector('[data-caption]');
    function inf(v) { return v === -Infinity ? '−∞' : v === Infinity ? '∞' : num(v); }
    function state() {
      var n = t.nodes[selected];
      var nodes = Object.keys(t.nodes).map(function (id) {
        var x = t.nodes[id], o = { id: id, value: x.value, left: x.left, right: x.right, dataLabel: 'Node ' + x.value };
        if (id === selected) o.state = 'pivot';
        if (showRanges) o.sub = '(' + inf(bounds[id].lo) + ', ' + inf(bounds[id].hi) + ')';
        return o;
      });
      var hulls = [];
      if (n.left) hulls.push({ id: 'L', root: n.left, state: 'active', label: 'all < ' + num(n.value) });
      if (n.right) hulls.push({ id: 'R', root: n.right, state: 'compare', label: 'all > ' + num(n.value) });
      return { root: t.root, nodes: nodes, edges: {}, hulls: hulls };
    }
    function describe() {
      var n = t.nodes[selected];
      var lv = B.subtreeIds(t, n.left).map(function (id) { return t.nodes[id].value; });
      var rv = B.subtreeIds(t, n.right).map(function (id) { return t.nodes[id].value; });
      if (!lv.length && !rv.length) return '<b>' + num(n.value) + '</b> is a leaf: both of its subtrees are empty, so the rule has nothing to check below it. It still must fit its ancestors: its key lies in ' + '(' + inf(bounds[selected].lo) + ', ' + inf(bounds[selected].hi) + ').';
      return 'Node <b>' + num(n.value) + '</b>. Left subtree: ' + (lv.length ? lv.map(num).join(', ') + ', every one smaller than ' + num(n.value) : 'empty') + '. Right subtree: ' + (rv.length ? rv.map(num).join(', ') + ', every one larger' : 'empty') + '.';
    }
    var view = bstView(fig.querySelector('[data-stage]'), {
      nodeSize: 40, label: 'Binary search tree: click a node to shade its subtrees',
      onNodeClick: function (e) { selected = e.id; draw(); }
    });
    function draw(d) { view.render(state(), { duration: d === undefined ? 420 : d }); caption.innerHTML = describe() + (selected === t.root ? ' <span class="muted">Click another node.</span>' : ''); }
    // reserve room for the range labels so toggling does not resize the figure
    showRanges = true; var withSubs = state(); showRanges = false;
    view.prepare([state(), withSubs]);
    draw(0);
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show each key’s allowed range', checked: false, onChange: function (on) { showRanges = on; draw(); } });
  }

  /* ================================================================== spot the broken BST (click quiz) */
  function fakeFigure() {
    var fig = V.$('#fig-fake');
    legend(fig, [{ state: 'error', label: 'breaks the rule' }, { state: 'error', shape: 'dash', label: 'where it must be smaller' }]);
    var t = B.fromShape([50, [30, [20], [40, [35], [55]]], [70, [60], [80]]]);
    var bad = B.firstViolation(t), bounds = B.bounds(t);
    var stage = fig.querySelector('[data-stage]');
    var view = bstView(stage, { nodeSize: 40, dataIds: true, label: 'A tree where one key breaks the binary search tree rule' });
    function state(reveal) {
      return {
        root: t.root, edges: {},
        nodes: Object.keys(t.nodes).map(function (id) {
          var x = t.nodes[id], o = { id: id, value: x.value, left: x.left, right: x.right, dataLabel: 'Node ' + x.value };
          if (reveal && id === bad.id) o.state = 'error';
          return o;
        }),
        hulls: reveal ? [{ id: 'L', root: t.nodes[t.root].left, state: 'error', label: 'every key here must be < 50' }] : []
      };
    }
    view.prepare([state(false), state(true)]);
    view.render(state(false), { duration: 0 });
    function inf(v) { return v === -Infinity ? '−∞' : v === Infinity ? '∞' : num(v); }
    V.clickQuiz(stage, {
      el: '#quiz-fake', id: 'bst-fake-node', kicker: 'Click to answer',
      question: 'Click the key that breaks the binary search tree rule.',
      check: function (id) {
        if (id === bad.id) return { correct: true, message: '55 is larger than its parent 40, so the local check passes. But 55 sits in the <em>left</em> subtree of 50, where every key must be smaller than 50. A search for 55 would go right at 50 and never find it.' };
        var n = t.nodes[id];
        if (!n) return { correct: false, message: 'Click one of the keys.' };
        return { correct: false, message: num(n.value) + ' is fine: its ancestors only require it to lie in (' + inf(bounds[id].lo) + ', ' + inf(bounds[id].hi) + '), and it does. Check each key against every ancestor, not only its parent.' };
      }
    }).onAnswer(function (r) { if (r.correct) view.render(state(true), { duration: 520 }); });
  }

  /* ================================================================== search */
  function searchFigure() {
    var fig = V.$('#fig-search');
    legend(fig, [{ state: 'key', label: 'key in hand' }, { state: 'compare', label: 'compared now' }, { state: 'muted', label: 'ruled out' }, { state: 'found', label: 'found' }, { state: 'path', shape: 'line', label: 'path walked' }]);
    var t = B.fromKeys(TREES.search);
    var targets = [46, 63, 87, 50];
    function steps(k) { return B.searchSteps(t, k, { counters: 'search' }).steps; }
    var f = treeFigure(fig, steps(46), { view: { nodeSize: 38, label: 'Search in a binary search tree' }, label: 'Search controls', counterStates: { candidates: 'active' } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Key to search for', value: 46,
      options: targets.map(function (k) { return { value: k, label: k === 63 ? '63 (absent)' : k === 50 ? '50 (root)' : String(k) }; }),
      onChange: function (k) { f.load(steps(k)); }
    });
  }

  /* ================================================================== insert: where does 7 go? */
  function insertFigure() {
    var fig = V.$('#fig-insert');
    legend(fig, [{ state: 'key', label: 'key in hand' }, { state: 'compare', label: 'compared now' }, { state: 'visited', label: 'on the path' }, { state: 'done', label: 'new leaf' }, { state: 'default', shape: 'ring', label: 'empty link', color: 'var(--line-strong)' }]);
    var t = B.fromKeys(TREES.insert);
    var res = B.insertSteps(t, 7);
    var f = treeFigure(fig, res.steps, { view: { nodeSize: 44, showNulls: true, dataIds: true, label: 'Insert 7: every empty link is drawn' }, baseStepMs: 1250, label: 'Insert controls' });
    var six = B.findId(t, 6);
    var answer = 'slot-' + six + '-right';
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-insert', id: 'bst-where-7',
      question: 'Where does <b>7</b> go? Click the empty link.',
      check: function (id) {
        if (id === answer) return { correct: true, message: '7 &lt; 8 → left. 7 &gt; 3 → right. 7 &gt; 6 → right, and 6 has no right child. That empty link is the only place that keeps every key in order. Watch it drop.' };
        if (id.indexOf('slot-') !== 0) return { correct: false, message: 'Pick an empty link (a dashed circle), not a key. A new key always becomes a leaf.' };
        var m = /^slot-(.+)-(left|right)$/.exec(id), p = m && t.nodes[m[1]];
        return { correct: false, message: 'Not there: that is the ' + (m ? m[2] : '') + ' link of ' + (p ? num(p.value) : '?') + '. Walk it from the root: compare 7 with each key and go left if smaller, right if larger.' };
      }
    }).onAnswer(function (r) { if (r.correct) { f.player.reset(); f.player.play(); } });
  }

  /* ================================================================== min / max / successor / predecessor */
  function navFigure() {
    var fig = V.$('#fig-nav');
    legend(fig, [{ state: 'key', label: 'key' }, { state: 'compare', label: 'cur' }, { state: 'pivot', label: 'best candidate so far' }, { state: 'visited', label: 'walked' }, { state: 'found', label: 'answer' }]);
    var t = B.fromKeys(TREES.nav);
    var op = 'succ', key = 30;
    var pick = fig.querySelector('[data-pick]');
    function steps() {
      if (op === 'min') return B.minSteps(t).steps;
      if (op === 'max') return B.maxSteps(t).steps;
      return op === 'succ' ? B.successorSteps(t, key).steps : B.predecessorSteps(t, key).steps;
    }
    function note() {
      pick.textContent = op === 'min' || op === 'max' ? 'Starts at the root.' : (op === 'succ' ? 'Successor' : 'Predecessor') + ' of ' + num(key) + '. Click a node to choose another key.';
    }
    var f;
    var all = [];
    ['min', 'max'].forEach(function (o) { op = o; all = all.concat(steps()); });
    op = 'succ';
    TREES.nav.forEach(function (k) { all = all.concat(B.successorSteps(t, k).steps, B.predecessorSteps(t, k).steps); });
    f = treeFigure(fig, steps(), {
      view: { nodeSize: 38, label: 'Minimum, maximum, successor and predecessor walks', onNodeClick: function (e) {
        if (op === 'min' || op === 'max') { op = 'succ'; seg.set('succ'); }
        key = e.value; note(); f.load(steps());
      } }, label: 'Neighbour walk controls', baseStepMs: 1300
    });
    f.view.prepare(all);
    f.player.refresh();
    var seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: 'succ',
      options: [{ value: 'min', label: 'Min' }, { value: 'max', label: 'Max' }, { value: 'succ', label: 'Successor' }, { value: 'pred', label: 'Predecessor' }],
      onChange: function (v) { op = v; note(); f.load(steps()); f.view.prepare(all); f.player.refresh(); }
    });
    note();
  }

  /* ================================================================== delete: three cases + flowchart */
  var CASES_SPEC = {
    nodes: [
      { id: 'find', type: 'start', text: 'Find the node x', col: 1, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'kids', type: 'decision', text: 'Children of x?', col: 1, row: 1, narrow: { col: 0, row: 1 } },
      { id: 'zero', type: 'end', text: 'Remove x', col: 0, row: 2, narrow: { col: 1, row: 1 } },
      { id: 'one', type: 'end', text: 'x’s child takes its place', col: 1, row: 2, narrow: { col: 0, row: 2 } },
      { id: 'two', type: 'process', text: 's ← smallest key in x’s right subtree', col: 2, row: 2, narrow: { col: 1, row: 2 } },
      { id: 'copy', type: 'process', text: 'Copy s’s key into x', col: 2, row: 3, narrow: { col: 1, row: 3 } },
      { id: 'delSucc', type: 'end', text: 'Delete s (0 or 1 child)', col: 2, row: 4, narrow: { col: 1, row: 4 } }
    ],
    edges: [
      { from: 'find', to: 'kids' },
      { from: 'kids', to: 'zero', label: '0' },
      { from: 'kids', to: 'one', label: '1' },
      { from: 'kids', to: 'two', label: '2' },
      { from: 'two', to: 'copy' },
      { from: 'copy', to: 'delSucc' }
    ]
  };
  L19.CASES_SPEC = CASES_SPEC;
  /* Adapter: player.flow -> flowchart view. map(stepFlowId) -> chart node id or null. */
  function flowAdapter(view, map) {
    var player = null;
    return {
      bind: function (p) { player = p; },
      highlight: function (id, c) {
        var steps = player ? player.steps : [], idx = c ? c.index : 0;
        var visited = [], active = null;
        for (var i = 0; i <= idx && i < steps.length; i++) {
          var m = map(steps[i].flow, steps[i], steps);
          if (m && i < idx && visited.indexOf(m) === -1) visited.push(m);
          if (i === idx) active = m;
        }
        view.render({ active: active, visited: visited.filter(function (v) { return v !== active; }) }, { duration: c ? c.duration : 0 });
      }
    };
  }
  L19.flowAdapter = flowAdapter;

  function deleteFigure() {
    var fig = V.$('#fig-delete');
    legend(fig, [{ state: 'key', label: 'key in hand' }, { state: 'swap', label: 'being removed' }, { state: 'pivot', label: 'successor s' }, { state: 'active', label: 'subtree moving up' }, { state: 'done', label: 'result' }]);
    var t = B.fromKeys(TREES.del);
    var cases = { leaf: 20, one: 40, two: 50 };
    var flowView = V.views.flowchart(fig.querySelector('[data-flow]'), CASES_SPEC, { label: 'Delete decision flowchart: zero, one or two children' });
    function mapFlow(id, step, steps) {
      if (id === 'start' || id === 'goL' || id === 'goR' || id === 'absent') return 'find';
      if (id === 'done') { for (var i = steps.length - 1; i >= 0; i--) { var f2 = steps[i].flow; if (f2 && f2 !== 'done') return mapFlow(f2, steps[i], steps); } }
      return ['kids', 'zero', 'one', 'two', 'copy', 'delSucc'].indexOf(id) !== -1 ? id : null;
    }
    var adapter = flowAdapter(flowView, mapFlow);
    var allSteps = [];
    Object.keys(cases).forEach(function (c) { allSteps = allSteps.concat(B.deleteSteps(t, cases[c]).steps); });
    var f = treeFigure(fig, B.deleteSteps(t, cases.leaf).steps, { view: { nodeSize: 38, label: 'Deleting from a binary search tree' }, flow: adapter, baseStepMs: 1450, label: 'Delete controls' });
    adapter.bind(f.player);
    f.view.prepare(allSteps);
    f.player.refresh();
    f.player.goto(0);
    adapter.highlight(null, { index: 0, duration: 0 });
    var asked = false;
    f.player.addCheckpoint(function (steps) {
      if (asked) return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'succStart') return i;
      return -1;
    }, function () {
      return {
        question: '50 has two children. Which key will take its place?',
        options: ['55', '45', '60', '70'],
        answer: 0,
        explain: [
          'Yes: 55 is the smallest key in 50’s right subtree, the next larger key after 50. It is bigger than everything on the left and smaller than everything else on the right.',
          '45 is the predecessor, the largest key on the left. That would also keep the order, but this method uses the successor: the smallest key on the right.',
          '60 is on the right, but 55 is smaller than 60 and still larger than 50. Take the smallest key in the right subtree: keep going left from 70.',
          '70 is 50’s right child, but not the smallest key on its right. 60 and 55 are both smaller than 70 and larger than 50.'
        ]
      };
    }, { id: 'bst-delete-successor' });
    f.player.on('checkpointdone', function () { asked = true; });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Deletion case', value: 'leaf',
      options: [{ value: 'leaf', label: 'Leaf (20)' }, { value: 'one', label: 'One child (40)' }, { value: 'two', label: 'Two children (50)' }],
      onChange: function (c) { f.player.setSteps(B.deleteSteps(t, cases[c]).steps); }
    });
  }

  /* ================================================================== in-order walk */
  function inorderFigure() {
    var fig = V.$('#fig-inorder');
    legend(fig, [{ state: 'compare', label: 'being written' }, { state: 'done', label: 'written' }]);
    var t = B.fromKeys(TREES.inorder);
    treeFigure(fig, B.inorderSteps(t, { label: 'in-order output' }).steps, { view: { nodeSize: 38, colGap: 0.95, label: 'In-order walk dropping keys onto a number line' }, baseStepMs: 1200, label: 'In-order walk controls' });
  }

  /* ================================================================== range query */
  function rangeFigure() {
    var fig = V.$('#fig-range');
    legend(fig, [{ state: 'found', label: 'reported' }, { state: 'visited', label: 'visited, outside the range' }, { state: 'muted', label: 'skipped unseen' }, { state: 'path', shape: 'line', label: 'links followed' }]);
    var t = B.fromKeys(TREES.range);
    var lo = 30, hi = 65;
    var caption = fig.querySelector('[data-caption]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: LABELS, states: { reported: 'found', skipped: 'muted' } });
    var view = bstView(fig.querySelector('[data-stage]'), { nodeSize: 38, label: 'Range query: pruned subtrees are shaded grey' });
    var all = [];
    for (var a = 0; a <= 100; a += 10) for (var b = a; b <= 100; b += 10) all.push(B.rangeState(t, a, b).step);
    view.prepare(all);
    function draw(d) {
      var a = Math.min(lo, hi), b = Math.max(lo, hi);
      var r = B.rangeState(t, a, b);
      view.render(r.step, { duration: d === undefined ? 380 : d });
      stats.update(r.step.counters);
      caption.innerHTML = 'Range [' + a + ', ' + b + ']: ' + (r.reported.length ? 'reported <b>' + r.reported.join(', ') + '</b>' : 'no keys in range') + '. Visited ' + r.visited + ' of ' + B.size(t) + ' nodes; ' + (r.skipped ? r.skipped + ' were never looked at, because a comparison proved their whole subtree was out of range.' : 'nothing could be skipped this time.') + (lo > hi ? ' (The sliders crossed, so lo and hi swap.)' : '');
    }
    V.slider(fig.querySelector('[data-lo]'), { label: 'lo', min: 0, max: 100, value: lo, onInput: function (v) { lo = v; draw(160); } });
    V.slider(fig.querySelector('[data-hi]'), { label: 'hi', min: 0, max: 100, value: hi, onInput: function (v) { hi = v; draw(160); } });
    draw(0);
  }

  /* ================================================================== shape race: random vs sorted */
  function shapeFigure() {
    var fig = V.$('#fig-shape');
    legend(fig, [{ state: 'key', label: 'key dropping in' }, { state: 'visited', label: 'its path' }, { state: 'done', label: 'just landed' }]);
    var keys = TREES.shape, n = keys.length;
    var rng = V.rng(7);
    var randomOrder = V.shuffle(keys, rng);
    var orderB = 'sorted';
    var titles = { sorted: 'Sorted order', reversed: 'Reversed order', zigzag: 'Zig-zag order (smallest, largest, …)', median: 'Median-first order' };
    function orderOf(kind) {
      if (kind === 'sorted') return keys.slice();
      if (kind === 'reversed') return keys.slice().reverse();
      if (kind === 'zigzag') return B.zigzag(keys);
      return B.medianFirst(keys);
    }
    var views = {
      a: bstView(fig.querySelector('[data-stage="a"]'), { nodeSize: 34, gap: 0.3, maxHeight: 640, label: 'Tree built from a random insertion order' }),
      b: bstView(fig.querySelector('[data-stage="b"]'), { nodeSize: 34, gap: 0.3, maxHeight: 640, label: 'Tree built from the second insertion order' })
    };
    var stats = {
      a: V.stats(fig.querySelector('[data-stats="a"]'), { labels: { height: 'Height', comparisons: 'Comparisons so far', search: 'Search for ' + keys[n - 1] } }),
      b: V.stats(fig.querySelector('[data-stats="b"]'), { labels: { height: 'Height', comparisons: 'Comparisons so far', search: 'Search for ' + keys[n - 1] } })
    };
    function meter(side, hgt) {
      var m = fig.querySelector('[data-meter="' + side + '"]');
      var hv = hgt === '—' ? 0 : hgt;
      m.querySelector('i').style.setProperty('--p', (100 * hv / (n - 1)) + '%');
      m.querySelector('[data-h]').textContent = hgt;
      m.classList.toggle('is-bad', hv > 2 * Math.ceil(Math.log2(n + 1)));
    }
    function groups(build) {
      var g = [], cur = null;
      build.steps.forEach(function (s) {
        if (s.buildIndex === undefined) return;
        if (!cur || cur.i !== s.buildIndex) { cur = { i: s.buildIndex, steps: [] }; g.push(cur); }
        cur.steps.push(s);
      });
      return g;
    }
    function searchCost(tree, k) { var c = 0, cur = tree.root; while (cur !== null) { c += 1; var nn = tree.nodes[cur]; if (nn.value === k) break; cur = k < nn.value ? nn.left : nn.right; } return c; }
    function makeSteps() {
      var A = B.buildSteps(randomOrder), Bb = B.buildSteps(orderOf(orderB));
      var ga = groups(A), gb = groups(Bb), steps = [];
      function st(sa, sb, cap, fin) {
        steps.push({ a: sa, b: sb, caption: cap, fin: fin || null });
      }
      st(A.steps[0], Bb.steps[0], 'Two empty trees. The same ' + n + ' keys will arrive, one per step, in two different orders.');
      for (var i = 0; i < n; i++) {
        var sa = ga[i].steps, sb = gb[i].steps;
        for (var j = 0; j < Math.max(sa.length, sb.length); j++) {
          var xa = sa[Math.min(j, sa.length - 1)], xb = sb[Math.min(j, sb.length - 1)];
          var cap = j === 0 && sa.length > 1
            ? 'Key ' + (i + 1) + ' of ' + n + ': left tree drops <b>' + randomOrder[i] + '</b>, right tree drops <b>' + orderOf(orderB)[i] + '</b>. Each walks down to an empty link.'
            : 'Both keys land as new leaves. Heights: ' + xa.counters.height + ' and ' + xb.counters.height + '.';
          st(xa, xb, cap);
        }
      }
      var la = A.steps[A.steps.length - 1], lb = Bb.steps[Bb.steps.length - 1];
      var ca = searchCost(A.tree, keys[n - 1]), cb = searchCost(Bb.tree, keys[n - 1]);
      st(la, lb, 'Same keys, same code. Left: height <b>' + B.height(A.tree) + '</b>, ' + A.comparisons + ' comparisons to build. Right: height <b>' + B.height(Bb.tree) + '</b>, ' + Bb.comparisons + ' comparisons. Finding ' + keys[n - 1] + ' now costs ' + ca + ' comparisons on the left and ' + cb + ' on the right.', { a: ca, b: cb });
      return steps;
    }
    function prepareViews(steps) {
      views.a.reset(); views.b.reset();
      views.a.prepare(steps.map(function (s) { return s.a; }));
      views.b.prepare(steps.map(function (s) { return s.b; }));
    }
    var steps = makeSteps();
    prepareViews(steps);
    function render(s, c) {
      views.a.render(s.a, { duration: c.duration });
      views.b.render(s.b, { duration: c.duration });
      ['a', 'b'].forEach(function (side) {
        var x = s[side];
        stats[side].update({ height: x.counters.height, comparisons: x.counters.comparisons, search: s.fin ? s.fin[side] : '—' });
        meter(side, x.counters.height);
      });
    }
    // open on the finished race so the contrast is visible at once; replay (or any change) runs it from the start
    var player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 900, startAt: steps.length - 1, label: 'Shape race controls' });
    function reload() { steps = makeSteps(); prepareViews(steps); player.setSteps(steps); if (!V.reducedMotion()) player.play(); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Order for the right tree', value: orderB,
      options: [{ value: 'sorted', label: 'Sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'zigzag', label: 'Zig-zag' }, { value: 'median', label: 'Median first' }],
      onChange: function (v) { orderB = v; fig.querySelector('[data-title-b]').textContent = titles[v]; reload(); }
    });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { randomOrder = V.shuffle(keys, rng); reload(); });
  }

  /* ================================================================== cost chart (simulation) */
  function depthChart() {
    var fig = V.$('#fig-depth');
    legend(fig, [{ state: 'error', shape: 'line', label: 'sorted order: average depth' }, { state: 'done', shape: 'line', label: 'random order: average depth' }, { state: 'frontier', shape: 'dash', label: 'random order: height' }, { state: 'muted', shape: 'dash', label: '1.39 log₂ n' }]);
    var ns = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024];
    var rows = B.simulate(ns, { seed: 19 });
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Average node depth against the number of keys, random versus sorted insertion order' });
    var last = rows[rows.length - 1];
    function show(log, d) {
      chart.render({
        x: { label: 'keys n', min: 2, max: 1024, scale: log ? 'log' : 'linear', ticks: log ? [2, 8, 32, 128, 512] : undefined },
        y: log ? { label: 'depth (log scale)', scale: 'log', min: 0.5, max: 1100 } : { label: 'depth (links from the root)', min: 0, max: 520 },
        series: [
          { id: 'sorted', label: 'sorted: avg depth', state: 'error', points: rows.map(function (r) { return [r.n, r.sortedDepth]; }) },
          { id: 'rh', label: 'random: height', state: 'frontier', dashed: true, points: rows.map(function (r) { return [r.n, r.randomHeight]; }) },
          { id: 'rd', label: 'random: avg depth', state: 'done', points: rows.map(function (r) { return [r.n, r.randomDepth]; }) },
          { id: 'ref', label: '1.39 log₂ n', state: 'muted', dashed: true, fn: function (x) { return Math.max(0.5, 1.39 * Math.log2(x)); }, domain: [2, 1024] }
        ],
        highlight: { series: 'sorted', x: 1024, label: 'n = 1024: ' + last.sortedDepth.toFixed(1) }
      }, { duration: d === undefined ? 800 : d });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Scale', value: 'lin', options: [{ value: 'lin', label: 'Linear scale' }, { value: 'log', label: 'Log scale' }], onChange: function (v) { show(v === 'log'); } });
    show(false, 0);
    fig.querySelector('[data-caption]').innerHTML = 'At n = 1024: a random order puts the average key <b>' + last.randomDepth.toFixed(1) + '</b> links deep (height about ' + last.randomHeight.toFixed(0) + '); the sorted order puts it <b>' + last.sortedDepth.toFixed(1) + '</b> deep (height 1023). Switch to the log scale to see the random curves grow like log n.';
  }

  /* ================================================================== quizzes */
  function quizzes() {
    V.quiz('#quiz-succ', {
      id: 'bst-succ-45',
      question: 'In the figure above (keys 10 to 80), what is the <b>successor</b> of 45?',
      options: ['50', '40', '60', '35'],
      answer: 0,
      explain: [
        '45 has no right subtree, so the answer is the nearest ancestor you reached by going left. The walk to 45 goes left at 50, right at 30, right at 40: the last left turn was at 50.',
        '40 is smaller than 45: that is its predecessor, not its successor.',
        '60 is larger than 45, but 50 is larger too and closer. The successor is the smallest key larger than 45.',
        '35 is smaller than 45. The successor is the next <em>larger</em> key.'
      ]
    });
    var before = [30, [20, 10, 25], [40, 35, 50]];
    V.quiz('#quiz-delete', {
      id: 'bst-delete-30',
      kicker: 'Quick check: pick the tree',
      question: 'You delete <b>30</b> from this tree, replacing it with its successor. Which tree do you get?' + mini(before, { size: 30, label: 'Tree: 30 with children 20 and 40; 20 has 10 and 25; 40 has 35 and 50', states: { 30: 'swap' } }),
      options: [
        mini([35, [20, 10, 25], [40, null, 50]], { size: 28, label: 'Option A: 35 at the root, 40 keeps only 50' }),
        mini([25, [20, 10], [40, 35, 50]], { size: 28, label: 'Option B: 25 at the root' }),
        mini([40, [20, 10, 25], [50, 35]], { size: 28, label: 'Option C: 40 at the root, 35 under 50' }),
        mini([35, [20, 10, 25], [40, 50]], { size: 28, label: 'Option D: 35 at the root, 50 left of 40' })
      ],
      answer: 0,
      explain: [
        'Right. The successor of 30 is 35, the smallest key in its right subtree. Copy 35 into the root, then remove the old 35, a leaf. 40 keeps 50 on its right.',
        'This tree is a valid BST, but it used the <em>predecessor</em> 25, the largest key on the left. The successor rule picks 35.',
        'Broken: 35 sits in the right subtree of 40 but is smaller than 40. Promoting a child does not keep the order.',
        'Broken: 50 is the left child of 40 but larger than 40.'
      ]
    });
    V.quiz('#quiz-order', {
      id: 'bst-tallest-order',
      question: 'You insert the keys 1 to 7 into an empty BST. Which order builds the <b>tallest</b> tree?',
      options: ['<code>4, 2, 6, 1, 3, 5, 7</code>', '<code>1, 7, 2, 6, 3, 5, 4</code>', '<code>2, 1, 3, 4, 5, 6, 7</code>', '<code>5, 3, 7, 1, 2, 4, 6</code>'],
      answer: 1,
      explain: [
        'This is median-first: a perfect tree of height 2, the shortest possible.',
        'Right: height 6. Each key is the smallest or largest of those left, so every new key hangs below the last one. A zig-zag stick is as bad as a sorted one.',
        'Height 5: 2 has two children, but 3 to 7 then form a stick. Tall, but not the tallest.',
        'Height 3: fairly bushy.'
      ]
    });
    V.quiz('#quiz-cost', {
      id: 'bst-million-sorted',
      question: 'A plain BST holds 1,000,000 keys that were inserted in <b>sorted</b> order. About how many comparisons does it take to find the largest key?',
      options: ['About 20', 'About 40', 'About 1,000', 'About 1,000,000'],
      answer: 3,
      explain: [
        '20 is log₂ of a million: what a balanced tree would need. Sorted insertion does not build a balanced tree.',
        '40 is about a random tree’s height. Sorted insertion is the worst case, not the average.',
        '1,000 is √n. No part of this tree halves or square-roots the keys.',
        'Right: sorted insertion builds a stick of height 999,999, and the largest key is at the bottom. A search walks every node.'
      ]
    });
    V.quiz('#quiz-inorder', {
      id: 'bst-inorder-check',
      question: 'An in-order walk of a binary tree writes <code>3, 9, 14, 12, 20</code>. What can you conclude?',
      options: ['It is not a valid BST', 'The root is 12', 'The tree is a stick', 'Nothing: in-order output can come in any order'],
      answer: 0,
      explain: [
        'Right. In-order output of a valid BST is strictly increasing. 14 before 12 means some key is on the wrong side of an ancestor.',
        'In-order output does not tell you the root; many shapes give the same sequence.',
        'Shape cannot be read from in-order output alone.',
        'For a valid BST the in-order output is always sorted. That is exactly why this one proves the tree is broken.'
      ]
    });
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    var minis = {
      dup: mini([50, [30, 20, 40], [70, 60, 80]], { size: 30, badges: { 30: '×2' }, states: { 30: 'found' }, label: 'Tree where node 30 carries a count of 2' }),
      floor: mini([50, [30, 20, [40, 35, 45]], [70, 60, 80]], { size: 30, states: { 50: 'visited', 30: 'visited', 40: 'visited', 45: 'found' }, edges: { '50-30': 'path', '30-40': 'path', '40-45': 'path' }, label: 'Floor of 47: the walk visits 50, 30, 40 and ends at 45' }),
      kth: mini([50, [30, 20, 40], [70, 60, [80, 75, 90]]], { size: 30, badges: { 50: 9, 30: 3, 20: 1, 40: 1, 70: 5, 60: 1, 80: 3, 75: 1, 90: 1 }, states: { 50: 'visited', 70: 'found' }, edges: { '50-70': 'path' }, label: 'Subtree sizes as badges; the sixth smallest key is 70' }),
      valid: mini([50, [30, 20, [40, 35, 55]], [70, 60, 80]], { size: 30, subs: { 50: '(−∞, ∞)', 30: '(−∞, 50)', 40: '(30, 50)', 55: '(40, 50)', 70: '(50, ∞)' }, states: { 55: 'error' }, label: 'Allowed ranges passed down; 55 falls outside (40, 50)' }),
      lca: mini([50, [30, 20, [40, 35, 45]], [70, 60, 80]], { size: 30, states: { 35: 'key', 60: 'key', 50: 'found' }, edges: { '50-30': 'path', '30-40': 'path', '40-35': 'path', '50-70': 'path', '70-60': 'path' }, label: 'Lowest common ancestor of 35 and 60 is 50' })
    };
    var blocks = {
      dup: '// equal keys increase a count instead of adding a node\nfunction insert(root, key) {\n  if (root === null) return new Node(key);   // count = 1\n  if (key === root.key) root.count++;\n  else if (key < root.key) root.left = insert(root.left, key);\n  else root.right = insert(root.right, key);\n  return root;\n}',
      floor: 'function floor(root, x) {       // largest key <= x\n  let best = null;\n  for (let cur = root; cur !== null; ) {\n    if (cur.key === x) return cur.key;\n    if (cur.key < x) { best = cur.key; cur = cur.right; }\n    else cur = cur.left;\n  }\n  return best;\n}',
      kth: 'function kth(node, k) {         // node.size = keys in its subtree\n  while (node !== null) {\n    const L = node.left ? node.left.size : 0;\n    if (k <= L) node = node.left;\n    else if (k === L + 1) return node.key;\n    else { k -= L + 1; node = node.right; }\n  }\n  return null;\n}',
      valid: 'function isBST(node, lo = -Infinity, hi = Infinity) {\n  if (node === null) return true;\n  if (node.key <= lo || node.key >= hi) return false;\n  return isBST(node.left, lo, node.key) &&\n         isBST(node.right, node.key, hi);\n}',
      lca: 'function lca(root, a, b) {\n  let cur = root;\n  while (cur !== null) {\n    if (a < cur.key && b < cur.key) cur = cur.left;\n    else if (a > cur.key && b > cur.key) cur = cur.right;\n    else return cur;             // the paths split here\n  }\n  return null;\n}'
    };
    Object.keys(minis).forEach(function (k) {
      V.$('[data-mini="' + k + '"]').innerHTML = minis[k];
      V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js');
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: mini([50, [30, 20, 40], [70, 60, 80]], { size: 25, hullOf: 30, states: { 50: 'pivot' }, label: 'Left subtree of 50 shaded' }), label: 'One rule, whole subtrees', text: 'Left subtree &lt; node &lt; right subtree, at every node.' },
      { svg: mini([50, [30, 20, 40], [70, 60, 80]], { size: 25, states: { 50: 'visited', 30: 'visited', 40: 'found' }, edges: { '50-30': 'path', '30-40': 'path' }, label: 'Search path 50, 30, 40' }), label: 'Search walks one path', text: 'One comparison per level: O(h).' },
      { svg: mini([50, [30, 20, [40, null, 45]], [70, 60, 80]], { size: 25, states: { 45: 'done' }, edges: { '40-45': 'path' }, label: 'New leaf 45' }), label: 'Insert where you fall off', text: 'The new key always becomes a leaf.' },
      { svg: mini([55, [30, 20, 40], [70, [60, null, 58], 80]], { size: 25, states: { 55: 'done', 58: 'active' }, label: 'Successor 55 copied into the root' }), label: 'Delete: 0, 1 or 2 children', text: 'Two children: copy the successor, delete it.' },
      { svg: mini([40, [20, 10, 30], [60, 50, 70]], { size: 24, order: 'inorder', gap: 0.9, level: 1.2, strip: true, label: 'Each key dropped straight down gives 10, 20, 30, 40, 50, 60, 70' }), label: 'In-order is sorted', text: 'Left, node, right: smallest to largest.' },
      { svg: mini([1, null, [2, null, [3, null, [4, null, 5]]]], { size: 25, level: 1.05, states: { 5: 'error' }, label: 'A stick of five keys' }), label: 'Order decides the shape', text: 'Sorted input builds a stick: h = n − 1.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid', html: t.svg }),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text', html: t.text })));
    });
  }

  V.ready(function () {
    function safe(fn) { try { fn(); } catch (e) { console.error('[lesson 19]', e); } }
    safe(heroTeaser);
    safe(quizzes);
    safe(variations);
    safe(summaryCard);
    nearView(V.$('#fig-race'), raceFigure);
    nearView(V.$('#fig-fold'), foldFigure);
    nearView(V.$('#fig-rule'), ruleFigure);
    nearView(V.$('#fig-fake'), fakeFigure);
    nearView(V.$('#fig-search'), searchFigure);
    nearView(V.$('#fig-insert'), insertFigure);
    nearView(V.$('#fig-nav'), navFigure);
    nearView(V.$('#fig-delete'), deleteFigure);
    nearView(V.$('#fig-inorder'), inorderFigure);
    nearView(V.$('#fig-range'), rangeFigure);
    nearView(V.$('#fig-shape'), shapeFigure);
    nearView(V.$('#fig-depth'), depthChart);
  });
}());
