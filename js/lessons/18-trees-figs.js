/* Lesson 18 · Trees & traversals — array mapping, expression tree, postorder computations, charts, the
   "which traversal?" diagram, variations, checks and the summary card. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, A = V.algos.lesson18, L = V.lesson18;
  var nearView = L.nearView, legend = L.legend, treeState = L.treeState;
  var LETTERS = 'ABCDEFGHIJKLMNO'.split('');

  if (V.quizScore && V.quizScore.register) ['l18-click-preorder4'].forEach(V.quizScore.register);

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function esc(v) { return V.escape(String(v)); }

  /* ================================================================== complete tree <-> array */
  function arrayFigure() {
    var fig = V.$('#fig-array');
    if (!fig) return;
    var n = 10, sel = 4, MAX = 15;
    var caption = fig.querySelector('[data-caption]');
    legend(fig, [{ state: 'pivot', label: 'chosen index' }, { state: 'compare', label: 'its parent' }, { state: 'active', label: 'its children' }]);
    var treeView = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 40, gap: 0.5, label: 'A complete binary tree', onNodeClick: function (e) { pick(Number(String(e.id).slice(1))); } });
    var arrView = V.views.array(fig.querySelector('[data-arr]'), { mode: 'boxes', cellSize: 42, label: 'The same tree stored in an array', onItemClick: function (e) { pick(e.index); } });
    function stateFor(count, s) {
      var info = A.indexInfo(s, count), st = {};
      st[s] = 'pivot';
      if (info.parent !== null) st[info.parent] = 'compare';
      if (info.left !== null) st[info.left] = 'active';
      if (info.right !== null) st[info.right] = 'active';
      var nodes = [], items = [];
      for (var i = 0; i < count; i++) {
        var l = 2 * i + 1, r = 2 * i + 2;
        nodes.push({ id: 'n' + i, value: LETTERS[i], left: l < count ? 'n' + l : null, right: r < count ? 'n' + r : null, state: st[i] || 'default' });
        items.push({ id: 'a' + i, value: LETTERS[i], index: i, state: st[i] || 'default' });
      }
      return { tree: { root: 'n0', nodes: nodes, edges: {} }, arr: { items: items, length: MAX, label: 'array a' } };
    }
    function text() {
      var i = sel, info = A.indexInfo(i, n), parts = [];
      parts.push('<b>' + LETTERS[i] + '</b> is stored at index <b>' + i + '</b>.');
      parts.push(info.parent === null ? 'Index 0 is the root: it has no parent.' : 'Parent: ⌊(' + i + ' − 1) / 2⌋ = <b>' + info.parent + '</b> (' + LETTERS[info.parent] + ').');
      parts.push(info.left !== null ? 'Left child: 2 × ' + i + ' + 1 = <b>' + info.left + '</b> (' + LETTERS[info.left] + ').' : 'Left child: 2 × ' + i + ' + 1 = ' + (2 * i + 1) + ', which is not below n = ' + n + ': none.');
      parts.push(info.right !== null ? 'Right child: 2 × ' + i + ' + 2 = <b>' + info.right + '</b> (' + LETTERS[info.right] + ').' : 'Right child: 2 × ' + i + ' + 2 = ' + (2 * i + 2) + ', not below n = ' + n + ': none.');
      return parts.join(' ');
    }
    function draw(d) {
      var s = stateFor(n, sel);
      treeView.render(s.tree, { duration: d === undefined ? 380 : d });
      arrView.render(s.arr, { duration: d === undefined ? 380 : d });
      caption.innerHTML = text();
    }
    function pick(i) { if (i >= 0 && i < n) { sel = i; draw(); } }
    treeView.prepare([stateFor(MAX, 0).tree]);
    arrView.prepare([stateFor(MAX, 0).arr]);
    draw(0);
    V.slider(fig.querySelector('[data-slider]'), {
      label: 'Nodes n', min: 1, max: MAX, step: 1, value: n, format: function (v) { return String(v); },
      onInput: function (v) { n = v; if (sel >= n) sel = n - 1; draw(420); }
    });
  }

  /* ================================================================== expression tree */
  function tokenRows(host, tokens) {
    clear(host);
    var rows = {};
    [['prefix', 'prefix = preorder'], ['infix', 'infix = inorder, with brackets'], ['postfix', 'postfix = postorder']].forEach(function (r) {
      var chips = tokens[r[0]].map(function (t) { return h('span', { class: 'tr-tok' + (t.paren ? ' tr-tok--paren' : ''), 'data-node': t.id }, t.text); });
      var row = h('div', { class: 'tr-tokrow' }, h('span', { class: 'tr-tokrow__label' }, r[1]), h('span', { class: 'tr-tokrow__chips' }, chips));
      host.appendChild(row);
      rows[r[0]] = chips;
    });
    return rows;
  }
  var EXPRS = {
    a: { label: '(3 + 4) × (5 − 2)', shape: ['×', ['+', [3], [4]], ['−', [5], [2]]] },
    b: { label: '8 − 3 − 2', shape: ['−', ['−', [8], [3]], [2]] },
    c: { label: '8 − (3 − 2)', shape: ['−', [8], ['−', [3], [2]]] }
  };
  function exprFigure() {
    var fig = V.$('#fig-expr');
    if (!fig) return;
    legend(fig, [{ state: 'active', label: 'being computed' }, { state: 'frontier', label: 'waiting for its operands' }, { state: 'done', label: 'value known' }, { state: 'path', shape: 'line', label: 'chain of calls' }]);
    var view = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 44, gap: 0.7, label: 'An expression tree evaluated from the bottom up' });
    var stack = V.views.callstack(fig.querySelector('[data-stack]'), { frameWidth: 300, maxVisible: 6, showLocals: false, label: 'Call stack of evaluate' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A.CODE.eval, default: 'pseudo', title: 'evaluate', maxHeight: 296 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { node: 'active', result: 'done' } });
    var tokHost = fig.querySelector('[data-tokens]'), rows = null, tree = null;
    var player = V.player({
      root: fig, steps: [{ caption: '', root: null, nodes: [], frames: [], counters: {} }], baseStepMs: 1200, label: 'Expression controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS, counterStates: { calls: 'active' },
      code: code, vars: vars,
      render: function (s, c) {
        if (!s.nodes.length) return;
        view.render(treeState(s), { duration: c.duration });
        stack.render({ frames: s.frames }, { duration: c.duration });
        var st = {}; s.nodes.forEach(function (n) { st[n.id] = n.state; });
        Object.keys(rows).forEach(function (k) {
          rows[k].forEach(function (chip) {
            var id = chip.getAttribute('data-node');
            chip.classList.toggle('is-done', st[id] === 'done');
            chip.classList.toggle('is-now', st[id] === 'active');
          });
        });
      }
    });
    function load(key) {
      tree = A.fromShape(EXPRS[key].shape);
      rows = tokenRows(tokHost, A.exprTokens(tree));
      var steps = A.computeSteps(tree, 'eval').steps;
      view.reset(); view.prepare(steps.map(treeState));
      stack.reset && stack.reset(); stack.prepare(steps.map(function (s) { return { frames: s.frames }; }));
      player.setSteps(steps);
    }
    load('a');
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Expression', value: 'a',
      options: Object.keys(EXPRS).map(function (k) { return { value: k, label: EXPRS[k].label }; }),
      onChange: load
    });
  }

  /* ================================================================== postorder computations */
  function computeFigure() {
    var fig = V.$('#fig-compute');
    if (!fig) return;
    var kind = 'height';
    var bin = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F', 'G']);
    legend(fig, [{ state: 'active', label: 'asked now' }, { state: 'frontier', label: 'waiting for its children' }, { state: 'done', label: 'answered: the chip is its value' }]);
    var view = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 44, gap: 0.6, label: 'A tree where every node computes an answer from its children' });
    var stack = V.views.callstack(fig.querySelector('[data-stack]'), { frameWidth: 300, maxVisible: 6, showLocals: false, label: 'Call stack' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A.CODE.height, default: 'pseudo', title: 'height', maxHeight: 296 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { node: 'active', result: 'done', total: 'done' } });
    var player = V.player({
      root: fig, steps: [{ caption: '', root: null, nodes: [], frames: [], counters: {} }], baseStepMs: 1150, label: 'Computation controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS, counterStates: { calls: 'active' },
      code: code, vars: vars,
      render: function (s, c) {
        if (!s.nodes.length) return;
        view.render(treeState(s), { duration: c.duration });
        stack.render({ frames: s.frames }, { duration: c.duration });
      }
    });
    function load(k) {
      kind = k;
      var steps = k === 'folder' ? A.folderSteps(L.FS).steps : A.computeSteps(bin, k).steps;
      code.setSource(A.CODE[k]);
      view.reset(); view.prepare(steps.map(treeState));
      stack.reset && stack.reset(); stack.prepare(steps.map(function (s) { return { frames: s.frames }; }));
      player.setSteps(steps);
    }
    load('height');
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Compute', value: 'height',
      options: [{ value: 'height', label: 'Height of every node' }, { value: 'count', label: 'Nodes in every subtree' }, { value: 'folder', label: 'Folder sizes' }],
      onChange: load
    });
    void kind;
  }

  /* ================================================================== charts */
  function heightChart() {
    var fig = V.$('#fig-height-chart');
    if (!fig) return;
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 320, label: 'Tree height against number of nodes for complete, random and chain-shaped trees' });
    var cache = {}, range = 'small', axis = 'linear';
    var caption = fig.querySelector('[data-caption]');
    function data(rangeKey) {
      if (cache[rangeKey]) return cache[rangeKey];
      var ns = rangeKey === 'small' ? V.range(31, 1) : [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1000];
      var rng = V.rng(1818);
      var pts = { chain: [], random: [], complete: [] };
      ns.forEach(function (n) {
        var samples = n <= 64 ? 60 : n <= 256 ? 25 : 10, sum = 0;
        for (var i = 0; i < samples; i++) sum += A.height(A.randomTree(n, rng));
        pts.chain.push([n, A.maxHeight(n)]);
        pts.random.push([n, Math.round(sum / samples * 100) / 100]);
        pts.complete.push([n, A.minHeight(n)]);
      });
      cache[rangeKey] = pts;
      return pts;
    }
    function draw(dur) {
      var d = data(range), log = axis === 'log';
      function pos(list) { return log ? list.filter(function (p) { return p[1] > 0; }) : list; }
      var big = range === 'large';
      chart.render({
        x: { label: 'number of nodes n', min: 1, max: big ? 1000 : 31 },
        y: log ? { label: 'height (links), log scale', scale: 'log', min: 1, max: big ? 2000 : 40 } : { label: 'height (links)', min: 0, max: big ? 1000 : 32 },
        series: [
          { id: 'chain', label: 'chain: n − 1', points: pos(d.chain), state: 'error', markers: !big },
          { id: 'random', label: 'random shape', points: pos(d.random), state: 'compare', markers: false },
          { id: 'complete', label: 'complete: ⌊log₂ n⌋', points: pos(d.complete), state: 'done', markers: false }
        ],
        highlight: big
          ? [{ series: 'chain', x: 1000, label: '999' }, { series: 'complete', x: 1000, label: '9' }]
          : [{ series: 'complete', x: 20, label: 'n = 20: height 4' }, { series: 'chain', x: 20, label: '19' }]
      }, { duration: dur });
      caption.innerHTML = big
        ? 'With 1000 nodes the shortest possible tree has height <b>9</b> and the longest has height <b>999</b>. A random shape lands near the bottom of that range, at about ' + Math.round(d.random[d.random.length - 1][1]) + '. On a log scale the gap between the top and bottom curves is easy to see.'
        : 'For every n, the height of a binary tree lies between ⌊log₂ n⌋ (a complete tree, green) and n − 1 (a chain, red). Random shapes (amber) stay close to the green curve.';
    }
    draw(0);
    V.segmented(fig.querySelector('[data-seg-range]'), { label: 'Range of n', value: 'small', options: [{ value: 'small', label: 'n up to 31' }, { value: 'large', label: 'n up to 1000' }], onChange: function (v) { range = v; draw(700); } });
    V.segmented(fig.querySelector('[data-seg-axis]'), { label: 'Height axis', value: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { axis = v; draw(800); } });
  }

  function spaceChart() {
    var fig = V.$('#fig-space-chart');
    if (!fig) return;
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', height: 300, label: 'Peak memory of a depth-first and a breadth-first traversal on three tree shapes' });
    var caption = fig.querySelector('[data-caption]');
    var SIZES = { 15: 3, 63: 5, 255: 7 };
    function draw(n, dur) {
      var perfect = A.perfect(SIZES[n]), chain = A.degenerate(n, 'right'), rand = A.randomTree(n, V.rng(n * 31 + 7));
      var trees = [perfect, rand, chain];
      chart.render({
        categories: ['perfect', 'random shape', 'chain'],
        series: [
          { id: 'dfs', label: 'Depth-first: call stack (height + 1)', values: trees.map(A.peakStack), state: 'active' },
          { id: 'bfs', label: 'Breadth-first: queue', values: trees.map(A.peakQueue), state: 'frontier' }
        ],
        y: { label: 'most nodes held at once', min: 0 }
      }, { duration: dur });
      caption.innerHTML = 'On these ' + n + '-node trees: depth-first holds up to <b>' + A.peakStack(perfect) + '</b> frames on the perfect tree and <b>' + A.peakStack(chain) + '</b> on the chain; the queue holds up to <b>' + A.peakQueue(perfect) + '</b> on the perfect tree but only <b>' + A.peakQueue(chain) + '</b> on the chain. Bushy trees are cheap for the stack and costly for the queue; chains are the opposite.';
    }
    draw(63, 0);
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Nodes n', value: '63', options: [{ value: '15', label: 'n = 15' }, { value: '63', label: 'n = 63' }, { value: '255', label: 'n = 255' }], onChange: function (v) { draw(Number(v), 700); } });
  }

  /* ================================================================== which traversal do I need? */
  var DECIDE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Do you need the nodes nearest the root first?', col: 0, row: 0, maxWidth: 190 },
      { id: 'level', type: 'end', text: 'Level order (queue)', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Must a node be handled before its children?', col: 0, row: 1, maxWidth: 190 },
      { id: 'pre', type: 'end', text: 'Preorder', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Must a node wait until its children are done?', col: 0, row: 2, maxWidth: 190 },
      { id: 'post', type: 'end', text: 'Postorder', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Is it a search tree, and do you want the keys sorted?', col: 0, row: 3, maxWidth: 190 },
      { id: 'in', type: 'end', text: 'Inorder', col: 1, row: 3 },
      { id: 'any', type: 'end', text: 'Any order works: take the simplest (recursive preorder)', col: 0, row: 4, maxWidth: 190 }
    ],
    edges: [
      { from: 'q1', to: 'level', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'pre', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'post', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'in', label: 'yes' }, { from: 'q4', to: 'any', label: 'no' }
    ]
  };
  var ANSWERS = {
    level: '<b>Level order.</b> A queue hands out nodes nearest the root first. Use it for “closest match”, shortest path in an unweighted tree, printing a tree row by row, and any job that must finish one level before starting the next.',
    pre: '<b>Preorder.</b> The parent comes before its children, so you can copy a tree, write it to a file (with # for empty places), print an outline, or build prefix notation: whatever must know the parent first.',
    post: '<b>Postorder.</b> Children come before their parent, so a parent can combine their answers: folder sizes, tree height, evaluating an expression tree, or deleting a tree from the bottom up.',
    'in': '<b>Inorder.</b> Left, node, right. On a binary search tree it lists the keys in sorted order, which also lets you check a BST is valid and find the k-th smallest key.',
    any: '<b>Any order.</b> If every node is handled independently (count the nodes, sum the values, find the maximum), the order does not matter. Pick the shortest code: recursive preorder.'
  };
  var SCENARIOS = [
    { label: 'Delete every node', path: ['q1', 'q2', 'q3', 'post'] },
    { label: 'Copy a tree', path: ['q1', 'q2', 'pre'] },
    { label: 'List a BST in sorted order', path: ['q1', 'q2', 'q3', 'q4', 'in'] },
    { label: 'Nearest node that matches', path: ['q1', 'level'] },
    { label: 'Size of every folder', path: ['q1', 'q2', 'q3', 'post'] },
    { label: 'Count the nodes', path: ['q1', 'q2', 'q3', 'q4', 'any'] }
  ];
  function decideFigure() {
    var fig = V.$('#fig-decide');
    if (!fig) return;
    legend(fig, [{ state: 'active', label: 'you are here' }, { state: 'visited', label: 'questions answered' }, { state: 'path', shape: 'line', label: 'your route' }]);
    var flow = V.views.flowchart(fig.querySelector('[data-stage]'), DECIDE, { interactive: true, label: 'Which traversal do I need? Click yes or no on each question.' });
    var answer = fig.querySelector('[data-answer]'), route = ['q1'], edges = {}, timer = 0;
    function isEnd(id) { return DECIDE.nodes.filter(function (n) { return n.id === id; })[0].type === 'end'; }
    function show(id) {
      flow.render({ active: id, visited: route.slice(0, -1), edgeStates: edges }, { duration: 420 });
      if (isEnd(id)) answer.innerHTML = ANSWERS[id]; else answer.innerHTML = '<span class="muted">Answer each question with the yes or no buttons on the arrows. Or pick a job below and watch the diagram answer for you.</span>';
    }
    function go(to, from) { route.push(to); edges[from + '->' + to] = 'path'; show(to); }
    function reset() { clearTimeout(timer); route = ['q1']; edges = {}; show('q1'); }
    flow.on('choose', function (e) { if (!isEnd(route[route.length - 1])) go(e.to, e.node); });
    show('q1');
    var bar = fig.querySelector('[data-scenarios]');
    SCENARIOS.forEach(function (sc) {
      bar.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        reset();
        var i = 1;
        (function step() {
          if (i >= sc.path.length) return;
          go(sc.path[i], sc.path[i - 1]); i++;
          timer = setTimeout(step, 800);
        }());
      } }, sc.label));
    });
    bar.appendChild(h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: reset }, 'Start over'));
  }

  /* ================================================================== variations */
  function variations() {
    var root = V.$('#variants');
    if (!root) return;
    var base = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F']);
    var levels = {}, d = A.depths(base);
    var lvlState = ['active', 'compare', 'done', 'pivot'];
    base.order.forEach(function (id) { levels[id] = lvlState[d[id]]; });
    L.mini(V.$('[data-mini="levels"]', root), base, { states: levels, nodeSize: 32, label: 'Tree with each level in its own colour' });
    L.mini(V.$('[data-mini="serialise"]', root), base, { showNulls: true, nodeSize: 30, gap: 0.3, label: 'The same tree with every empty place drawn' });
    var pre = A.preorder(base).map(function (id) { return base.nodes[id].value; }), ino = A.inorder(base).map(function (id) { return base.nodes[id].value; });
    var rs = {}; rs[base.root] = 'pivot';
    var leftIds = A.subtreeIds(base, base.nodes[base.root].left), rightIds = A.subtreeIds(base, base.nodes[base.root].right);
    leftIds.forEach(function (id) { rs[id] = 'active'; }); rightIds.forEach(function (id) { rs[id] = 'compare'; });
    L.mini(V.$('[data-mini="rebuild"]', root), base, { states: rs, nodeSize: 32, label: 'Tree rebuilt from preorder and inorder: root, left part, right part' });
    var chain = A.degenerate(7, 'right'), cs = {};
    chain.order.forEach(function (id) { cs[id] = 'frontier'; });
    L.mini(V.$('[data-mini="deep"]', root), chain, { states: cs, nodeSize: 26, gap: 0.3, label: 'A chain of seven nodes: a recursive walk needs seven frames' });

    // serialise string
    var out = [];
    (function go(id) { if (id === null) { out.push('#'); return; } out.push(base.nodes[id].value); go(base.nodes[id].left); go(base.nodes[id].right); }(base.root));
    V.$('[data-serial]', root).textContent = out.join(' ');
    // rebuild rows
    var host = V.$('[data-rebuild]', root);
    function chips(list, cls) { return list.map(function (v, i) { return h('span', { class: 'tr-tok ' + (cls[i] || '') }, v); }); }
    var rootAt = ino.indexOf(pre[0]);
    host.appendChild(h('div', { class: 'tr-tokrow' }, h('span', { class: 'tr-tokrow__label' }, 'preorder'), h('span', { class: 'tr-tokrow__chips' }, chips(pre, { 0: 'is-pivot' }))));
    var cls = {}; ino.forEach(function (v, i) { cls[i] = i < rootAt ? 'is-active' : i === rootAt ? 'is-pivot' : 'is-compare'; });
    host.appendChild(h('div', { class: 'tr-tokrow' }, h('span', { class: 'tr-tokrow__label' }, 'inorder'), h('span', { class: 'tr-tokrow__chips' }, chips(ino, cls))));

    var CODES = {
      levels: ['function levels(root) {', '  const result = [], queue = [root];', '  while (queue.length) {', '    const size = queue.length;      // nodes on this level', '    const level = [];', '    for (let i = 0; i < size; i++) {', '      const node = queue.shift();', '      level.push(node.value);', '      if (node.left)  queue.push(node.left);', '      if (node.right) queue.push(node.right);', '    }', '    result.push(level);', '  }', '  return result;   // [[A], [B, C], [D, E, F]]', '}'].join('\n'),
      serialise: ['function serialise(node, out = []) {', '  if (!node) { out.push("#"); return out; }', '  out.push(node.value);    // preorder: node first', '  serialise(node.left, out);', '  serialise(node.right, out);', '  return out;', '}', '', 'function rebuild(tokens) {  // same order back', '  const t = tokens.shift();', '  if (t === "#") return null;', '  return { value: t, left: rebuild(tokens), right: rebuild(tokens) };', '}'].join('\n'),
      rebuild: ['function build(pre, ino) {', '  if (pre.length === 0) return null;', '  const root = pre[0];         // preorder starts with the root', '  const k = ino.indexOf(root); // inorder: left part before it', '  return {', '    value: root,', '    left:  build(pre.slice(1, 1 + k), ino.slice(0, k)),', '    right: build(pre.slice(1 + k),    ino.slice(k + 1))', '  };', '}'].join('\n')
    };
    ['levels', 'serialise', 'rebuild'].forEach(function (k) { var pre = V.$('[data-code-block="' + k + '"]', root); if (pre) V.codeBlock(pre, CODES[k], 'js'); });
  }

  /* ================================================================== checks */
  function checks() {
    if (V.$('#quiz-tree-or-not')) V.quiz('#quiz-tree-or-not', {
      id: 'l18-tree-or-not', question: 'An office network has <b>9 computers</b> and <b>8 cables</b>, and every computer can reach every other one through the cables. Is its wiring a tree?',
      options: ['Yes: connected, with n − 1 links, means there is no loop', 'No: a tree needs one computer marked as the root', 'No: a tree may have at most 2 children per node', 'It depends on how the cables are drawn'],
      answer: 0,
      explain: [
        'Connected with n − 1 links is exactly a tree: a network with a loop needs at least n links to stay connected. Choosing a root is your decision, not a property of the wiring.',
        'Any node can be picked as the root: hang the others below it. The shape of the network is what matters, and it has no loops.',
        'That describes a <em>binary</em> tree. A tree in general can have any number of children per node, like a folder with ten files.',
        'The drawing does not matter. Only which computers are joined counts: 9 nodes, 8 links, all connected.'
      ]
    });
    if (V.$('#quiz-vocab')) V.quiz('#quiz-vocab', {
      id: 'l18-vocab-height-c', question: 'In the explorer above, what is the <b>height</b> of node <b>C</b>?',
      hint: 'Click C in the figure, or count the links on the longest way down from it.',
      options: ['0', '1', '2', '3'], answer: 2,
      explain: [
        'Height 0 means a leaf. C has a child (F), so it is not a leaf.',
        'C to F is one link, but F still has a child (J), so the longest path down is longer.',
        'C → F → J is two links, the longest way down from C. Height counts links down to the deepest leaf below the node.',
        '3 is the height of the whole tree, measured from A. C sits one level lower, so its own height is smaller.'
      ]
    });
    if (V.$('#quiz-height20')) V.quiz('#quiz-height20', {
      id: 'l18-height20', question: 'What is the <b>smallest possible height</b> of a binary tree with <b>20 nodes</b>?',
      hint: 'Levels can hold 1, 2, 4, 8, 16 … nodes.',
      options: ['3', '4', '5', '19'], answer: 1,
      explain: [
        'Levels 0 to 3 hold at most 1 + 2 + 4 + 8 = 15 nodes. Twenty do not fit, so the tree needs another level.',
        'Levels 0 to 3 hold 15 nodes, so the other 5 go on level 4. A complete tree fills each level before starting the next, so its height is ⌊log₂ 20⌋ = 4.',
        'Height 5 is possible, but it is not the smallest: level 4 alone has room for 16 more nodes.',
        '19 is the <em>largest</em> possible height (a chain of 20 nodes), the opposite extreme.'
      ]
    });
    if (V.$('#quiz-array')) V.quiz('#quiz-array', {
      id: 'l18-array-parent', question: 'A complete tree is stored in an array. Where is the <b>parent</b> of the node at index <b>11</b>?',
      options: ['5', '4', '6', '10'], answer: 0,
      explain: [
        'Parent = ⌊(11 − 1) / 2⌋ = ⌊10 / 2⌋ = 5. Check: the children of index 5 are 2 × 5 + 1 = 11 and 12.',
        '⌊11 / 2⌋ − 1 = 4 mixes up the order: subtract 1 first, then halve. The children of index 4 are 9 and 10.',
        'Rounding up gives 6, but the children of index 6 are 13 and 14. Always round down.',
        'Index 10 is the node just before it in the array, its left neighbour on the same level, not its parent.'
      ]
    });
    if (V.$('#quiz-post')) V.quiz('#quiz-post', {
      id: 'l18-postorder', question: 'What is the <b>postorder</b> of the tree above?',
      options: ['D G E B F C A', 'D B G E A C F', 'A B D E G C F', 'D G E F B C A'],
      answer: 0,
      explain: [
        'Left subtree of A first: D, then E’s subtree (G, then E), then B. Then C’s subtree: F, then C. A comes last, after everything below it.',
        'That is the <em>inorder</em>: left, node, right (D B G E A C F). Postorder never puts a parent before all its children.',
        'That is the <em>preorder</em>: each node before its children.',
        'This puts F before B, but B’s whole subtree finishes before anything in C’s subtree starts. Postorder is one subtree after the other.'
      ]
    });
    if (V.$('#quiz-which')) V.quiz('#quiz-which', {
      id: 'l18-which-order', question: 'You want the total size of <em>every</em> folder in a file system, computing each folder’s size once. Which order fits?',
      options: ['Preorder', 'Inorder', 'Postorder', 'Level order'], answer: 2,
      explain: [
        'Preorder visits a folder before the folders inside it, when their sizes are not known yet.',
        'Inorder is defined for two children (left, node, right). A folder can have many children, and its size needs all of them before the folder itself.',
        'Postorder handles every child first, so when a folder is reached, the sizes of everything inside it are ready to be added up.',
        'Level order also reaches a folder before its contents: it needs every level below finished first, so it would have to run backwards.'
      ]
    });
    if (V.$('#quiz-deep')) V.quiz('#quiz-deep', {
      id: 'l18-deep-chain', question: 'A tree of 1,000,000 nodes is a single chain. What happens when you traverse it with plain recursion in Python (default settings)?',
      options: ['It works: recursion depth is only log₂ n = 20', 'It raises a RecursionError: the depth equals the height, about a million', 'It works but visits the nodes in a different order', 'It is fast because a chain has no branches'],
      answer: 1,
      explain: [
        'log₂ n is the height only for a well-balanced tree. A chain has height n − 1.',
        'Depth of recursion = height + 1, here a million frames, far above Python’s default limit of about a thousand. An explicit stack keeps its items on the heap and copes with a million.',
        'The order does not change; the run simply cannot get that far.',
        'Speed is not the problem: the run fails long before it finishes.'
      ]
    });
  }

  /* the tree behind the click and postorder checks */
  function checkTree() {
    var fig = V.$('#fig-check');
    if (!fig) return;
    var tree = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F', '#', '#', 'G']);
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.tree(stage, { nodeSize: 42, gap: 0.7, label: 'A tree for the check questions', describe: true });
    var st = { root: tree.root, edges: {}, nodes: tree.order.map(function (id) { var n = tree.nodes[id]; return { id: id, value: n.value, left: n.left, right: n.right }; }) };
    view.prepare([st]); view.render(st, { duration: 0 });
    L.hits(view, tree);
    var idOf = {}; tree.order.forEach(function (id) { idOf[tree.nodes[id].value] = id; });
    var pre = A.preorder(tree).map(function (id) { return tree.nodes[id].value; });
    V.clickQuiz(stage, {
      el: '#quiz-click', id: 'l18-click-preorder4', kicker: 'Click to answer',
      question: 'Click the node that <b>preorder</b> visits <b>fourth</b>.',
      check: function (id) {
        var v = tree.nodes[id] && tree.nodes[id].value;
        if (v === pre[3]) return { correct: true, message: 'Preorder is node, left subtree, right subtree: ' + pre.join(', ') + '. The fourth is <b>' + pre[3] + '</b>: after A, B and D (a leaf, so the walk backs up), the next unvisited node on the left side is E.' };
        var at = pre.indexOf(v);
        return { correct: false, message: '<b>' + esc(v) + '</b> is number ' + (at + 1) + ' in preorder, not 4. Start at A, then keep going left, visiting each node as you first arrive at it, and only then try the right side.' };
      }
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    var t = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F']), o = A.orders(t);
    function orderBadges(list) { var b = {}; list.forEach(function (id, i) { b[id] = String(i + 1); }); return b; }
    function tile(label, text, tree, opts) {
      var viz = h('div', { class: 'summary__viz stage-grid' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text', html: text })));
      L.mini(viz, tree, Object.assign({ nodeSize: 30, gap: 0.35 }, opts));
    }
    var vocab = {}; vocab[t.root] = 'pivot'; t.order.forEach(function (id) { if (t.nodes[id].left === null && t.nodes[id].right === null) vocab[id] = 'done'; });
    tile('The words', 'One <b>root</b>, every other node has one <b>parent</b>. <b>Leaves</b> have no children. <b>Depth</b> counts links from the root; <b>height</b> counts links down.', t, { states: vocab, label: 'Tree with the root and the leaves marked' });
    tile('Preorder', 'Node, left, right. The parent comes first: copy, serialise, outline.', t, { badges: orderBadges(o.pre), label: 'Preorder numbering' });
    tile('Inorder', 'Left, node, right. On a search tree the keys come out sorted.', t, { badges: orderBadges(o.in), label: 'Inorder numbering' });
    tile('Postorder', 'Left, right, node. Children before parent: sizes, heights, evaluation, deleting.', t, { badges: orderBadges(o.post), label: 'Postorder numbering' });
    tile('Level order', 'A queue, level by level. Nearest the root first.', t, { badges: orderBadges(o.level), label: 'Level order numbering' });
    var c = A.complete(7), cs = {}; c.order.forEach(function (id) { cs[id] = 'frontier'; });
    tile('Cost', 'Every traversal is <b>O(n)</b> time. Extra memory: <b>O(h)</b> for depth-first, up to <b>O(n)</b> for the queue of a bushy tree. A complete tree has h = ⌊log₂ n⌋; a chain has h = n − 1.', c, { states: cs, label: 'A complete tree' });
  }

  /* ================================================================== start-up */
  checks();
  (function () {
    var nb = V.$('[data-code-block="node"]');
    if (nb) V.codeBlock(nb, ['class TreeNode {', '  constructor(value) {', '    this.value = value;', '    this.left = null;    // null means: no child on this side', '    this.right = null;', '  }', '}', '', '// A complete tree fits in an array, level by level:', 'const tree = ["A", "B", "C", "D", "E"];   // index 0 = root, children of i are 2i+1 and 2i+2'].join('\n'), 'js');
  }());
  nearView(V.$('#fig-array'), arrayFigure);
  nearView(V.$('#fig-expr'), exprFigure);
  nearView(V.$('#fig-compute'), computeFigure);
  nearView(V.$('#fig-height-chart'), heightChart);
  nearView(V.$('#fig-space-chart'), spaceChart);
  nearView(V.$('#fig-decide'), decideFigure);
  nearView(V.$('#fig-check'), checkTree);
  nearView(V.$('#variants'), variations);
  nearView(V.$('#summary-card'), summaryCard);
  if (V.$('#variants')) V.tabs('#variants');
}());
