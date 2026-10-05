/* Lesson 20 · Balanced trees — figures: the four AVL cases, the thinnest AVL trees, red-black rules and the
   violation check, the three-tree race and the height chart. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A = V.algos.lesson20, L = V.lesson20;
  var legend = L.legend, nearView = L.nearView, num = A.num;

  /* ================================================================== the four cases, as looping mini animations */
  function casesFigure() {
    var fig = V.$('#fig-cases');
    legend(fig, [{ state: 'error', label: 'out of balance (±2)' }, { state: 'pivot', label: 'heavy path' }, { state: 'active', label: 'just rotated' }, { state: 'key', label: 'new key' }]);
    var host = fig.querySelector('[data-gallery]');
    var notes = {
      LL: { kind: 'straight', fix: 'One rotation right at the flashing node.' },
      RR: { kind: 'straight', fix: 'One rotation left at the flashing node.' },
      LR: { kind: 'bend', fix: 'Rotate left at the child, then right at the flashing node.' },
      RL: { kind: 'bend', fix: 'Rotate right at the child, then left at the flashing node.' }
    };
    ['LL', 'RR', 'LR', 'RL'].forEach(function (name) {
      var c = A.avlCaseSteps(name);
      var tile = h('figure', { class: 'mini bt-tile' });
      var head = h('div', { class: 'bt-tile__head' }, h('span', { class: 'bt-tile__name' }, name), h('span', { class: 'bt-tile__kind' }, notes[name].kind === 'straight' ? 'straight line: one rotation' : 'a bend: two rotations'));
      var stage = h('div', { class: 'mini__stage bt-tile__stage', role: 'img', 'aria-label': name + ' case: ' + notes[name].fix });
      var cap = h('figcaption', { class: 'bt-tile__cap', 'aria-live': 'off' });
      tile.appendChild(head); tile.appendChild(stage); tile.appendChild(cap);
      host.appendChild(tile);
      var view = V.views.tree(stage, { nodeSize: 34, gap: 0.5, height: 190, describe: false, label: name + ' case' });
      view.el.setAttribute('aria-hidden', 'true');
      var steps = c.steps.filter(function (s) { return s.kind !== 'settle'; }).map(function (s) { return Object.assign({}, s, { nodes: s.nodes.map(function (n) { var m = Object.assign({}, n); delete m.sub; return m; }) }); });
      view.prepare(steps);
      function valueOf(s, id) { var n = s.nodes.filter(function (x) { return x.id === id; })[0]; return n ? n.value : '?'; }
      function short(s) {
        if (s.kind === 'start') return 'A balanced tree. Insert <b>' + c.key + '</b>.';
        if (s.kind === 'attach') return '<b>' + c.key + '</b> lands on the heavy side.';
        if (s.kind === 'flag') return 'Node <b>' + valueOf(s, s.case.top) + '</b> is at ' + (s.nodes.filter(function (n) { return n.id === s.case.top; })[0].badge) + ': case <b>' + name + '</b>.';
        if (s.kind === 'rotate') {
          var first = s.case.step === 1;
          if (name === 'LL') return 'Rotate right at <b>' + valueOf(s, s.case.top) + '</b>.';
          if (name === 'RR') return 'Rotate left at <b>' + valueOf(s, s.case.top) + '</b>.';
          if (name === 'LR') return first ? 'Rotate left at the child <b>' + valueOf(s, s.case.child) + '</b>.' : 'Then rotate right at <b>' + valueOf(s, s.case.top) + '</b>.';
          return first ? 'Rotate right at the child <b>' + valueOf(s, s.case.child) + '</b>.' : 'Then rotate left at <b>' + valueOf(s, s.case.top) + '</b>.';
        }
        return 'Balanced again. Same keys, same order.';
      }
      V.teaser(stage, {
        steps: steps, stepMs: 1100, holdMs: 1800, instantWrap: false,
        render: function (s, ctx) { view.render(s, { duration: ctx.duration }); cap.innerHTML = short(s); }
      });
    });
  }

  /* ================================================================== the thinnest AVL trees */
  function fibFigure() {
    var fig = V.$('#fig-fib');
    legend(fig, [{ state: 'key', label: 'new at this height' }, { state: 'default', label: 'kept from the height below' }]);
    var res = A.minimalAvlSteps(5);
    L.treeFigure(fig, res.steps, { view: { nodeSize: 30, minNodeSize: 14, gap: 0.5, label: 'The thinnest AVL trees of height 0 to 5' }, baseStepMs: 1500, label: 'Thinnest trees controls' });
  }

  /* ================================================================== red-black: every path has the same black count */
  var RB_SAMPLE = [13, [8, [1, null, [6, null, null, 'r'], 'b'], [11, null, null, 'b'], 'r'], [17, [15, null, null, 'b'], [25, [22, null, null, 'r'], [27, null, null, 'r'], 'b'], 'r'], 'b'];
  L.RB_SAMPLE = RB_SAMPLE;
  var RED = { state: 'default', label: 'red node', color: 'var(--st-error)' };
  var BLACK = { state: 'default', label: 'black node', color: 'var(--ink)' };
  function rbRulesFigure() {
    var fig = V.$('#fig-rbrules');
    legend(fig, [RED, BLACK, { state: 'path', label: 'current path' }]);
    var t = A.fromShape(RB_SAMPLE);
    var res = A.rbPathSteps(t);
    L.treeFigure(fig, res.steps, { view: { nodeSize: 38, gap: 0.55, label: 'A valid red-black tree; each root-to-NIL path is highlighted in turn' }, baseStepMs: 1400, label: 'Path walk controls', counterStates: { blackNodes: 'done' } });
  }

  /* ================================================================== is this red-black tree valid? (click) */
  function rbQuiz() {
    var fig = V.$('#fig-rbq');
    legend(fig, [RED, BLACK, { state: 'error', label: 'breaks a rule' }]);
    var t = A.fromShape([13, [8, [1, null, null, 'b'], [11, null, null, 'b'], 'r'], [17, [15, null, null, 'b'], [25, [22, [20, null, null, 'r'], null, 'r'], [27, null, null, 'r'], 'b'], 'r'], 'b']);
    var rc = A.rbCheck(t);
    var bad = rc.nodes[3].map(function (id) { return t.nodes[id].value; });
    function state(reveal) {
      var s = A.viewOf(t);
      s.nodes.forEach(function (n) { if (reveal && bad.indexOf(n.value) !== -1) n.state = 'error'; });
      return s;
    }
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 40, gap: 0.55, label: 'A red-black tree in which one red node has a red child' });
    view.prepare([state(false), state(true)]);
    view.render(state(false), { duration: 0 });
    L.tagNodes(view);
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-rb-click', id: 'rb-violation', kicker: 'Click to answer',
      question: 'One rule is broken. Click a node that breaks it.',
      check: function (id) {
        var v = parseInt(id, 10);
        if (bad.indexOf(v) !== -1) return { correct: true, message: 'Red 22 has a red child, 20. That breaks rule 4: a red node never has a red child. The black counts are fine (every path has 2 blacks), so it is the only violation. The fix would be a rotation or recolouring, exactly as in the lab.' };
        var node = t.nodes[A.findId(t, v)];
        if (!node) return { correct: false, message: 'Click one of the nodes.' };
        if (node.color === 'black') return { correct: false, message: v + ' is black. A black node can have any children, so it cannot break rule 4; look for a <em>red</em> node with a red child. (Rule 5 holds here: every path has 2 black nodes.)' };
        return { correct: false, message: v + ' is red, but both of its children are black or missing: no two reds are in a row here. Look at the red nodes near the bottom.' };
      }
    }).onAnswer(function (r) { if (r.correct) view.render(state(true), { duration: 420 }); });
  }

  /* ================================================================== the tree used by the first two multiple-choice checks */
  function qTree() {
    var fig = V.$('#fig-q');
    legend(fig, [{ state: 'key', label: 'just inserted' }]);
    var t = A.fromShape([40, [20, [10], [30, [25]]], [50]]);
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 42, label: 'A search tree: 40 at the root, 20 and 50 below, then 10, 30 and 25' });
    var s = A.viewOf(t, A.findId(t, 25));
    view.prepare([s]); view.render(s, { duration: 0 });
  }

  /* ================================================================== the race: one key stream, three trees */
  function raceFigure() {
    var fig = V.$('#fig-race');
    legend(fig, [RED, BLACK, { state: 'key', label: 'key just inserted' }]);
    var stages = { bst: fig.querySelector('[data-stage="bst"]'), avl: fig.querySelector('[data-stage="avl"]'), rb: fig.querySelector('[data-stage="rb"]') };
    var views = {
      bst: V.views.tree(stages.bst, { nodeSize: 28, minNodeSize: 24, levelHeight: 29, gap: 0, label: 'Plain binary search tree' }),
      avl: V.views.tree(stages.avl, { nodeSize: 34, minNodeSize: 24, gap: 0, label: 'AVL tree' }),
      rb: V.views.tree(stages.rb, { nodeSize: 34, minNodeSize: 24, gap: 0, label: 'Red-black tree' })
    };
    var meters = {};
    ['bst', 'avl', 'rb'].forEach(function (k) { meters[k] = fig.querySelector('[data-meter="' + k + '"]'); });
    meters.bst.classList.add('is-bad');
    var rng = V.rng(2020);
    var orders = {
      sorted: function () { return A.raceSteps(range(15)); },
      reversed: function () { return A.raceSteps(range(15).reverse()); },
      random: function () { return A.raceSteps(V.shuffle(range(15), rng)); }
    };
    function range(n) { var o = []; for (var i = 1; i <= n; i++) o.push(i); return o; }
    var res = orders.sorted();
    function prepare(steps) { ['bst', 'avl', 'rb'].forEach(function (k) { views[k].reset(); views[k].prepare(steps.map(function (s) { return s.trees[k]; })); }); }
    prepare(res.steps);
    var player = V.player({
      root: fig, steps: res.steps, startAt: res.steps.length - 1, baseStepMs: 1100, label: 'Race controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS,
      render: function (s, c) {
        ['bst', 'avl', 'rb'].forEach(function (k) {
          views[k].render(s.trees[k], { duration: c.duration });
          var m = meters[k];
          m.querySelector('[data-h]').textContent = Math.max(0, s.heights[k]);
          m.querySelector('.bt-meter__bar').style.setProperty('--p', (Math.max(0, s.heights[k]) / 14 * 100) + '%');
        });
      }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'Sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'random', label: 'Random' }],
      onChange: function (v) { var r = orders[v](); prepare(r.steps); player.setSteps(r.steps, { index: r.steps.length - 1 }); }
    });
  }

  /* ================================================================== chart: height vs n */
  function chartFigure() {
    var fig = V.$('#fig-heights');
    legend(fig, [{ state: 'error', label: 'plain BST' }, { state: 'done', label: 'AVL' }, { state: 'active', label: 'red-black' }, { state: 'muted', shape: 'dash', label: 'log₂ n and the guarantees' }]);
    var N = 100;
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 340, label: 'Tree height against number of keys inserted, for a plain binary search tree, an AVL tree and a red-black tree' });
    var cache = {};
    function curves(order) {
      if (cache[order]) return cache[order];
      var out;
      if (order === 'sorted') out = A.heightCurves(N, 'sorted');
      else {
        var runs = 8, acc = { bst: [], avl: [], rb: [] };
        for (var r = 0; r < runs; r++) {
          var c = A.heightCurves(N, 'random', V.rng(100 + r));
          ['bst', 'avl', 'rb'].forEach(function (k) { c[k].forEach(function (p, i) { acc[k][i] = (acc[k][i] || 0) + p[1] / runs; }); });
        }
        out = {};
        ['bst', 'avl', 'rb'].forEach(function (k) { out[k] = acc[k].map(function (v, i) { return [i + 1, Math.round(v * 100) / 100]; }); });
      }
      cache[order] = out; return out;
    }
    var order = 'sorted', bounds = false, hidePlain = false, caption = fig.querySelector('[data-caption]');
    function draw(d) {
      var c = curves(order);
      var series = [
        { id: 'bst', label: 'Plain BST', points: c.bst, state: 'error', markers: false },
        { id: 'rb', label: 'Red-black', points: c.rb, state: 'active', markers: false },
        { id: 'avl', label: 'AVL', points: c.avl, state: 'done', markers: false },
        { id: 'log', label: 'log₂ n', fn: function (n) { return Math.log2(n); }, state: 'muted', dashed: true }
      ];
      if (hidePlain) series.shift();
      if (bounds) {
        series.push({ id: 'avlb', label: 'AVL guarantee', fn: function (n) { return 1.4405 * Math.log2(n + 2) - 1.3277; }, state: 'done', dashed: true });
        series.push({ id: 'rbb', label: 'RB guarantee', fn: function (n) { return 2 * Math.log2(n + 1) - 1; }, state: 'active', dashed: true });
      }
      chart.render({
        x: { label: 'keys inserted (n)', min: 1, max: N },
        y: { label: 'height (links)', min: 0, max: hidePlain ? 14 : (order === 'sorted' ? 100 : 22) },
        series: series,
        highlight: hidePlain ? { series: 'rb', x: N, label: 'h = ' + (Math.round(c.rb[N - 1][1] * 10) / 10) } : { series: 'bst', x: N, label: 'h = ' + (Math.round(c.bst[N - 1][1] * 10) / 10) }
      }, { duration: d === undefined ? 700 : d });
      var f = function (k) { return Math.round(c[k][N - 1][1] * 10) / 10; };
      caption.innerHTML = 'At <b>n = ' + N + '</b> the plain tree has height <b>' + f('bst') + '</b>, the AVL tree <b>' + f('avl') + '</b> and the red-black tree <b>' + f('rb') + '</b>; a perfect tree would be ' + Math.floor(Math.log2(N)) + '. ' +
        (order === 'sorted' ? 'The plain tree’s height is n − 1: a straight line up the chart.' : 'Even on random input the plain tree is taller than either balanced tree, and nothing bounds it: bad luck is possible.');
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'Sorted input' }, { value: 'random', label: 'Random order (mean of 8)' }],
      onChange: function (v) { order = v; draw(); }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show the guarantees', checked: false, onChange: function (on) { bounds = on; draw(500); } });
    V.toggle(fig.querySelector('[data-toggle2]'), { label: 'Hide the plain tree to compare the other two', checked: false, onChange: function (on) { hidePlain = on; draw(600); } });
    draw(700);
  }

  V.ready(function () {
    nearView(V.$('#fig-cases'), casesFigure);
    nearView(V.$('#fig-fib'), fibFigure);
    nearView(V.$('#fig-rbrules'), rbRulesFigure);
    nearView(V.$('#fig-rbq'), rbQuiz);
    nearView(V.$('#fig-q'), qTree);
    nearView(V.$('#fig-race'), raceFigure);
    nearView(V.$('#fig-heights'), chartFigure);
  });
}());
