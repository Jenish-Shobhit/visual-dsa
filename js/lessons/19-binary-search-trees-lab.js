/* Lesson 19 · Binary search trees — the lab and the operation flowcharts.
   The lab keeps one tree across operations: each operation produces a trace from the current tree
   (js/algos/19-binary-search-trees.js), the player shows it, and the result becomes the new tree.
   The flowchart section below the lab follows the operation that ran last, with its route lit. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var B = V.algos.lesson19, L19 = V.lesson19;
  var num = B.num;
  var MAX_NODES = 24;

  /* ================================================================== flowchart specs + routes */
  function walkSpec(kind) {
    var ins = kind === 'insert';
    return {
      nodes: [
        { id: 'start', type: 'start', text: ins ? 'parent ← null, cur ← root' : 'cur ← root', col: 1, row: 0 },
        { id: 'loop', type: 'decision', text: 'cur = null ?', col: 1, row: 1 },
        { id: ins ? 'hang' : 'absent', type: 'end', text: ins ? 'Hang the new key under parent' : 'Return null: absent', col: 2, row: 1 },
        { id: 'eq', type: 'decision', text: 'key = cur.key ?', col: 1, row: 2 },
        { id: ins ? 'dup' : 'found', type: 'end', text: ins ? 'Already there: change nothing' : 'Return cur: found', col: 2, row: 2 },
        { id: 'lt', type: 'decision', text: 'key < cur.key ?', col: 1, row: 3 },
        { id: 'goL', type: 'process', text: ins ? 'parent ← cur, cur ← cur.left' : 'cur ← cur.left', col: 0, row: 3 },
        { id: 'goR', type: 'process', text: ins ? 'parent ← cur, cur ← cur.right' : 'cur ← cur.right', col: 1, row: 4 }
      ],
      edges: [
        { from: 'start', to: 'loop' },
        { from: 'loop', to: ins ? 'hang' : 'absent', label: 'yes' },
        { from: 'loop', to: 'eq', label: 'no' },
        { from: 'eq', to: ins ? 'dup' : 'found', label: 'yes' },
        { from: 'eq', to: 'lt', label: 'no' },
        { from: 'lt', to: 'goL', label: 'yes' },
        { from: 'lt', to: 'goR', label: 'no' },
        { from: 'goL', to: 'loop', via: { fromSide: 'top', toSide: 'left', points: [[0, 1]] } },
        { from: 'goR', to: 'loop', via: { fromSide: 'left', toSide: 'left', points: [[-0.5, 4], [-0.5, 1.25]] } }
      ]
    };
  }
  var SPECS = {
    search: walkSpec('search'),
    insert: walkSpec('insert'),
    delete: {
      nodes: [
        { id: 'find', type: 'start', text: 'Search for the key', col: 1, row: 0, narrow: { col: 0, row: 0 } },
        { id: 'found', type: 'decision', text: 'Found ?', col: 1, row: 1, narrow: { col: 0, row: 1 } },
        { id: 'absent', type: 'end', text: 'Nothing to delete', col: 0, row: 1, narrow: { col: 1, row: 1 } },
        { id: 'kids', type: 'decision', text: 'Children ?', col: 1, row: 2, narrow: { col: 0, row: 2 } },
        { id: 'zero', type: 'end', text: 'Remove the leaf', col: 0, row: 3, narrow: { col: 1, row: 2 } },
        { id: 'one', type: 'end', text: 'Its child takes its place', col: 1, row: 3, narrow: { col: 0, row: 3 } },
        { id: 'two', type: 'process', text: 's ← smallest key on the right', col: 2, row: 3, narrow: { col: 1, row: 3 } },
        { id: 'copy', type: 'process', text: 'Copy s’s key into the node', col: 2, row: 4, narrow: { col: 1, row: 4 } },
        { id: 'delSucc', type: 'end', text: 'Delete s (0 or 1 child)', col: 2, row: 5, narrow: { col: 1, row: 5 } }
      ],
      edges: [
        { from: 'find', to: 'found' },
        { from: 'found', to: 'absent', label: 'no' },
        { from: 'found', to: 'kids', label: 'yes' },
        { from: 'kids', to: 'zero', label: '0' },
        { from: 'kids', to: 'one', label: '1' },
        { from: 'kids', to: 'two', label: '2' },
        { from: 'two', to: 'copy' },
        { from: 'copy', to: 'delSucc' }
      ]
    },
    min: extremeSpec('left'),
    max: extremeSpec('right'),
    succ: {
      nodes: [
        { id: 'start', type: 'start', text: 'cur ← root, succ ← null', col: 0, row: 0 },
        { id: 'find', type: 'decision', text: 'cur.key = key ?', col: 0, row: 1 },
        { id: 'lt', type: 'decision', text: 'key < cur.key ?', col: 0, row: 2 },
        { id: 'goLs', type: 'process', text: 'succ ← cur, cur ← cur.left', col: 0, row: 3 },
        { id: 'goR', type: 'process', text: 'cur ← cur.right', col: 1, row: 3 },
        { id: 'hasRight', type: 'decision', text: 'Right subtree ?', col: 1, row: 1 },
        { id: 'dive', type: 'process', text: 'Right once, then left to the end', col: 2, row: 1 },
        { id: 'retMin', type: 'end', text: 'Return that node', col: 2, row: 2 },
        { id: 'retAnc', type: 'end', text: 'Return succ', col: 1, row: 2 }
      ],
      edges: [
        { from: 'start', to: 'find' },
        { from: 'find', to: 'hasRight', label: 'yes' },
        { from: 'find', to: 'lt', label: 'no' },
        { from: 'lt', to: 'goLs', label: 'yes' },
        { from: 'lt', to: 'goR', label: 'no' },
        { from: 'goLs', to: 'find' },
        { from: 'goR', to: 'find' },
        { from: 'hasRight', to: 'dive', label: 'yes' },
        { from: 'hasRight', to: 'retAnc', label: 'no' },
        { from: 'dive', to: 'retMin' }
      ]
    }
  };
  function extremeSpec(side) {
    return {
      nodes: [
        { id: 'start', type: 'start', text: 'cur ← root', col: 1, row: 0 },
        { id: 'test', type: 'decision', text: 'cur.' + side + ' = null ?', col: 1, row: 1 },
        { id: 'ret', type: 'end', text: 'Return cur: the ' + (side === 'left' ? 'minimum' : 'maximum'), col: 2, row: 1 },
        { id: 'step', type: 'process', text: 'cur ← cur.' + side, col: 1, row: 2 }
      ],
      edges: [
        { from: 'start', to: 'test' },
        { from: 'test', to: 'ret', label: 'yes' },
        { from: 'test', to: 'step', label: 'no' },
        { from: 'step', to: 'test' }
      ]
    };
  }
  /* step.flow -> the route through the chart that this one step takes (last node = active) */
  var ROUTES = {
    search: { start: ['start'], goL: ['loop', 'eq', 'lt', 'goL'], goR: ['loop', 'eq', 'lt', 'goR'], found: ['loop', 'eq', 'found'], absent: ['loop', 'absent'] },
    insert: { start: ['start'], goL: ['loop', 'eq', 'lt', 'goL'], goR: ['loop', 'eq', 'lt', 'goR'], dup: ['loop', 'eq', 'dup'], null: ['loop'], hang: ['loop', 'hang'] },
    delete: { start: ['find'], goL: ['find'], goR: ['find'], absent: ['find', 'found', 'absent'], kids: ['find', 'found', 'kids'], zero: ['kids', 'zero'], one: ['kids', 'one'], two: ['kids', 'two'], copy: ['two', 'copy'], delSucc: ['copy', 'delSucc'] },
    min: { start: ['start'], empty: ['start'], step: ['test', 'step'], ret: ['test', 'ret'] },
    max: { start: ['start'], empty: ['start'], step: ['test', 'step'], ret: ['test', 'ret'] },
    succ: { start: ['start'], goLs: ['find', 'lt', 'goLs'], goR: ['find', 'lt', 'goR'], absent: ['find'], hasRight: ['find', 'hasRight'], goRight: ['hasRight', 'dive'], dive: ['dive'], retMin: ['dive', 'retMin'], retAnc: ['hasRight', 'retAnc'] }
  };
  var TITLES = { search: 'Search', insert: 'Insert', delete: 'Delete', min: 'Minimum', max: 'Maximum', succ: 'Successor' };
  var SHORT = { search: 'Search', insert: 'Insert', delete: 'Delete', min: 'Min', max: 'Max', succ: 'Successor' };
  var FOOTS = {
    search: 'Text alternative: start at the root; if cur is null the key is absent; if the key equals cur’s key it is found; otherwise go left when the key is smaller and right when it is larger, and repeat.',
    insert: 'Text alternative: walk down exactly as in a search, remembering the parent. If the key is already there, change nothing. When cur becomes null, hang the new key as the parent’s left or right child.',
    delete: 'Text alternative: search for the key; if it is not there, stop. Otherwise count its children: 0, remove it; 1, the child takes its place; 2, find the smallest key s in its right subtree, copy s’s key into the node, then delete s, which has at most one child.',
    min: 'Text alternative: start at the root and follow left links until a node has no left child; that node holds the minimum.',
    max: 'Text alternative: start at the root and follow right links until a node has no right child; that node holds the maximum.',
    succ: 'Text alternative: search for the key, remembering the last node where the walk went left. If the key’s node has a right subtree, return that subtree’s minimum; otherwise return the remembered node.'
  };

  /* ================================================================== flowchart figure */
  var flow = null;
  function flowFigure() {
    if (flow) return;
    var fig = V.$('#fig-flow');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'current step in the lab' }, { state: 'visited', label: 'already passed' }]);
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), SPECS.search, { label: 'Operation flowchart' });
    var title = fig.querySelector('[data-flow-title]'), foot = fig.querySelector('[data-flow-foot]');
    var current = 'search';
    function setOp(op) {
      if (op === current && view) return;
      current = op;
      view.setSpec(SPECS[op]);
      view.render({}, { duration: 0 });
      title.textContent = TITLES[op] + ' as a flowchart';
      foot.textContent = FOOTS[op];
      if (seg && seg.value !== op) seg.set(op);
    }
    var seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: 'search',
      options: ['search', 'insert', 'delete', 'min', 'max', 'succ'].map(function (k) { return { value: k, label: SHORT[k] }; }),
      onChange: function (v) { setOp(v); }
    });
    title.textContent = 'Search as a flowchart';
    foot.textContent = FOOTS.search;
    flow = {
      setOp: setOp,
      show: function (op, steps, idx, duration) {
        if (!ROUTES[op]) return;
        if (op !== current) setOp(op);
        var visited = [], edges = {}, active = null;
        for (var i = 0; i <= idx && i < steps.length; i++) {
          var route = ROUTES[op][steps[i].flow];
          if (!route) continue;
          if (i < idx) route.forEach(function (n) { if (visited.indexOf(n) === -1) visited.push(n); });
          else {
            active = route[route.length - 1];
            route.slice(0, -1).forEach(function (n) { if (visited.indexOf(n) === -1) visited.push(n); });
            for (var k = 1; k < route.length; k++) edges[route[k - 1] + '->' + route[k]] = 'active';
          }
        }
        view.render({ active: active, visited: visited.filter(function (v) { return v !== active; }), edgeStates: edges }, { duration: duration || 0 });
      }
    };
  }

  /* ================================================================== the lab */
  function lab() {
    var fig = V.$('#lab-fig');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'key in hand' }, { state: 'compare', label: 'compared now' }, { state: 'visited', label: 'walked' },
      { state: 'found', label: 'found' }, { state: 'done', label: 'placed / result' }, { state: 'swap', label: 'being removed' }, { state: 'pivot', label: 'successor / candidate' }
    ]);
    var DEFAULT = [50, 30, 70, 20, 40, 60, 80, 35, 65, 45];
    var tree = B.empty();
    var op = 'build';
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: B.CODE.insert.pseudo, js: B.CODE.insert.js, py: B.CODE.insert.py }, default: 'pseudo', title: B.CODE.insert.title, maxHeight: 337 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { key: 'key', cur: 'compare', node: 'compare', parent: 'visited', s: 'pivot', succ: 'pivot', min: 'found', max: 'found' } });
    var keyField;
    var view = L19.bstView(fig.querySelector('[data-stage]'), {
      nodeSize: 40, maxHeight: 640, label: 'BST lab tree: click a node to use its key',
      onNodeClick: function (e) { keyField.value = e.value; setErr(''); keyField.focus({ preventScroll: true }); }
    });
    function setCode(which) {
      var c = B.CODE[which === 'build' ? 'insert' : which];
      code.setSource({ pseudo: c.pseudo, js: c.js, py: c.py });
      var t = fig.querySelector('.code-panel__title');
      if (t) t.textContent = which === 'build' ? 'insert(root, key), repeated' : c.title;
    }
    var player = V.player({
      root: fig, steps: [B.buildSteps([]).steps[0]],
      render: function (s, c) { view.render(s, { duration: c.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: L19.LABELS, counterStates: { comparisons: 'compare' },
      baseStepMs: 1100, label: 'BST lab controls',
      onStep: function (s, i, c) { if (flow && op !== 'build' && c.player) flow.show(op, c.player.steps, i, c.duration); }
    });
    function load(which, steps, o) {
      o = o || {};
      op = which;
      setCode(which);
      view.reset(); view.prepare(steps);
      player.setSteps(steps, { index: o.index || 0 });
      if (flow && which !== 'build') flow.show(which, steps, o.index || 0, 0);
      if (o.play && !V.reducedMotion()) player.play();
    }

    /* predictions (each asked once per visit) */
    var askedWay = false, askedSucc = false;
    player.addCheckpoint(function (steps) {
      if (askedWay || op === 'build') return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'compare' && steps[i].probe) return i;
      return -1;
    }, function (c) {
      var s = c.step, k = s.probe.value, at = s.nodes.filter(function (n) { return n.id === s.at; })[0];
      if (!at) return null;
      var left = k < at.value;
      return {
        question: 'The key in hand is <b>' + num(k) + '</b> and the node is <b>' + num(at.value) + '</b>. Which way does the walk go?',
        options: ['Left', 'Right', 'Stop here'],
        answer: left ? 0 : 1,
        explain: [
          left ? num(k) + ' &lt; ' + num(at.value) + ': every key in the right subtree is larger than ' + num(at.value) + ', so ' + num(k) + ' can only be on the left.' : num(k) + ' is larger than ' + num(at.value) + ', so it cannot be in the left subtree, where every key is smaller.',
          left ? num(k) + ' is smaller than ' + num(at.value) + ', so it cannot be in the right subtree, where every key is larger.' : num(k) + ' &gt; ' + num(at.value) + ': every key in the left subtree is smaller than ' + num(at.value) + ', so ' + num(k) + ' can only be on the right.',
          'The walk stops only when the keys are equal (or the link is empty). ' + num(k) + ' ≠ ' + num(at.value) + '.'
        ]
      };
    }, { id: 'bst-lab-which-way' });
    player.addCheckpoint(function (steps) {
      if (askedSucc || op !== 'delete') return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'succStart') return i;
      return -1;
    }, function (c) {
      var t = treeOf(c.prev), x = c.prev.nodes.filter(function (n) { return n.state === 'swap'; })[0];
      if (!x) return null;
      var keys = B.inorder(t), i = keys.indexOf(x.value);
      var succ = keys[i + 1], pred = keys[i - 1];
      var rightChild = t.nodes[x.right] ? t.nodes[x.right].value : null;
      var opts = [succ];
      if (pred !== undefined) opts.push(pred);
      if (rightChild !== null && rightChild !== succ) opts.push(rightChild);
      var biggest = keys[keys.length - 1];
      if (opts.indexOf(biggest) === -1) opts.push(biggest);
      opts = opts.slice(0, 4);
      var order = opts.slice().sort(function (a, b) { return a - b; });
      return {
        question: num(x.value) + ' has two children. Which key will take its place?',
        options: order.map(num),
        answer: order.indexOf(succ),
        explain: order.map(function (v) {
          if (v === succ) return 'Yes: ' + num(succ) + ' is the smallest key in ' + num(x.value) + '’s right subtree, its successor.';
          if (v === pred) return num(pred) + ' is the predecessor, the largest key on the left. It would also keep the order, but this code uses the successor.';
          return num(v) + ' is on the right, but ' + num(succ) + ' is smaller and still larger than ' + num(x.value) + '. The successor is the smallest key on the right.';
        })
      };
    }, { id: 'bst-lab-successor' });
    player.on('checkpointdone', function (res, target) {
      var s = player.steps[target];
      if (s && s.kind === 'succStart') askedSucc = true; else askedWay = true;
    });
    function treeOf(step) {
      var t = { root: step.root, nodes: {}, next: 0 };
      step.nodes.forEach(function (n) { t.nodes[n.id] = { id: n.id, value: n.value, left: n.left, right: n.right }; });
      return t;
    }

    /* build input */
    function build(keys, o) {
      var res = B.buildSteps(keys, { quick: true });
      tree = res.tree;
      load('build', res.steps, o);
    }
    var rng = V.rng(1919);
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Build a tree from these keys, in this order (up to 15)',
      value: DEFAULT,
      parse: { min: -99, max: 99, maxCount: 15, minCount: 0 },
      applyLabel: 'Build',
      presets: [
        { label: 'Random', value: function () { return V.presets.random(10, { min: 1, max: 99, unique: true, rng: rng }); } },
        { label: 'Sorted', title: 'Every key larger than the last: the tree becomes a stick', value: function () { return V.presets.sorted(9, { min: 5, max: 95, rng: rng }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(9, { min: 5, max: 95, rng: rng }); } },
        { label: 'Median first', title: 'The insertion order that builds a perfectly balanced tree', value: function () { return B.medianFirst(V.presets.sorted(15, { min: 3, max: 97, rng: rng })); } },
        { label: 'Zig-zag', value: function () { return B.zigzag(V.presets.sorted(8, { min: 5, max: 95, rng: rng })); } },
        { label: 'Duplicates', value: [50, 30, 50, 70, 30, 60] },
        { label: 'One key', value: [42] },
        { label: 'Empty', value: [] }
      ],
      hint: 'Duplicates are skipped: the tree stores a set. Build replaces the whole tree.',
      onApply: function (values) { build(values, { play: true }); }
    });

    /* operations */
    var err = h('p', { class: 'bst-ops__err', role: 'alert' });
    function setErr(m) { err.textContent = m || ''; keyField.setAttribute('aria-invalid', m ? 'true' : 'false'); }
    keyField = h('input', { class: 'field', id: 'bst-lab-key', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: '42', 'aria-describedby': 'bst-lab-key-err' });
    err.id = 'bst-lab-key-err';
    function readKey() {
      var txt = keyField.value.trim().replace('−', '-');
      if (!/^-?\d+$/.test(txt)) { setErr('Type a whole number, for example 42.'); return null; }
      var k = parseInt(txt, 10);
      if (k < -99 || k > 99) { setErr('Keys must be between −99 and 99 so they fit in a node.'); return null; }
      setErr('');
      return k;
    }
    function run(which) {
      var res, k = null;
      if (which !== 'min' && which !== 'max') { k = readKey(); if (k === null) { keyField.focus(); return; } }
      if (which === 'insert') {
        if (B.size(tree) >= MAX_NODES && B.findId(tree, k) === null) { setErr('The lab holds up to ' + MAX_NODES + ' keys so every node stays readable. Delete one first, or build a new tree.'); return; }
        res = B.insertSteps(tree, k); tree = res.tree;
      } else if (which === 'search') res = B.searchSteps(tree, k, { prune: false });
      else if (which === 'delete') { res = B.deleteSteps(tree, k); tree = res.tree; }
      else if (which === 'min') res = B.minSteps(tree);
      else if (which === 'max') res = B.maxSteps(tree);
      else if (which === 'succ') res = B.successorSteps(tree, k);
      load(which, res.steps, { play: true });
    }
    var buttons = [['insert', 'Insert', true], ['search', 'Search'], ['delete', 'Delete'], ['min', 'Minimum'], ['max', 'Maximum'], ['succ', 'Successor']].map(function (b) {
      return h('button', { type: 'button', class: 'btn' + (b[2] ? ' btn--primary' : ''), onclick: function () { run(b[0]); } }, b[1]);
    });
    keyField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run('search'); } });
    keyField.addEventListener('input', function () { if (err.textContent) setErr(''); });
    fig.querySelector('[data-ops]').appendChild(h('div', { class: 'bst-ops' },
      h('div', { class: 'bst-ops__key' }, h('label', { class: 'field-label', for: 'bst-lab-key' }, 'Key'), keyField),
      h('div', { class: 'bst-ops__btns', role: 'group', 'aria-label': 'Operations' }, buttons),
      err,
      h('p', { class: 'bst-ops__hint' }, 'Tip: click a node to copy its key. Enter runs a search.')));

    build(DEFAULT, { index: 0 });
    // show the finished default tree, with the build one scrub away
    player.goto(player.steps.length - 1);
  }

  V.ready(function () {
    L19.nearView(V.$('#fig-flow'), flowFigure);
    L19.nearView(V.$('#lab-fig'), function () {
      if (!flow) { var f = V.$('#fig-flow'); if (f) try { flowFigure(); } catch (e) { console.error(e); } }
      lab();
    });
  });
}());
