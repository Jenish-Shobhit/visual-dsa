/* Lesson 18 · Trees & traversals — the Euler-tour figure, the traversal lab and its flowchart.
   The lab: pick a tree (type it, or use a preset), an order, and recursion or an explicit stack. A token walks the
   Euler tour (recursion) or the algorithm's working node (stack, queue), the output builds, and the call stack /
   stack / queue is drawn beside the tree, in step with the code. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, A = V.algos.lesson18, L = V.lesson18;
  var nearView = L.nearView, legend = L.legend, treeState = L.treeState;
  var ORDER_LABEL = { pre: 'Preorder', 'in': 'Inorder', post: 'Postorder', level: 'Level order' };
  var KIND_STATE = { pre: 'active', 'in': 'compare', post: 'done' };

  if (V.quizScore && V.quizScore.register) ['l18-lab-next-visit', 'l18-lab-peak'].forEach(V.quizScore.register);

  function valueOf(tree, id) { return tree.nodes[id].value; }
  function uniqueBy(list, key) { var seen = {}; return list.filter(function (x) { var k = key(x); if (seen[k]) return false; seen[k] = true; return true; }); }

  /* ================================================================== Euler tour figure */
  function eulerFigure() {
    var fig = V.$('#fig-euler');
    if (!fig) return;
    var tree = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F']);
    var steps = A.eulerSteps(tree), n = A.size(tree);
    legend(fig, L.TOUR_LEGEND.concat([{ state: 'key', shape: 'line', label: 'the walk so far' }]));
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 44, gap: 1.1, levelHeight: 78, label: 'A tree with the Euler tour drawn around it: a walk with three dots per node' });
    var layer = L.tourLayer(view, tree);
    var rows = V.views.array(fig.querySelector('[data-rows]'), { mode: 'boxes', cellSize: 38, label: 'The three orders as the walk builds them' });
    var focus = null;
    var NAMES = { pre: 'preorder', 'in': 'inorder', post: 'postorder' };
    function rowsState(s) {
      return {
        rows: ['pre', 'in', 'post'].map(function (kind) {
          return {
            id: kind, label: NAMES[kind], length: n,
            items: s.rows[kind].map(function (id, i) {
              return { id: kind + '-' + id, value: valueOf(tree, id), index: i, state: focus && focus !== kind ? 'muted' : KIND_STATE[kind] };
            })
          };
        })
      };
    }
    view.prepare(steps.map(treeState));
    rows.prepare(steps.map(rowsState));
    var player = V.player({
      root: fig, steps: steps, baseStepMs: 1000, label: 'Euler tour controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS,
      counterStates: KIND_STATE,
      render: function (s, c) {
        view.render(treeState(s), { duration: c.duration });
        layer.update({ pos: s.tour, ms: c.duration, focus: focus });
        rows.render(rowsState(s), { duration: c.duration });
      }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Which dot to count', value: 'all',
      options: [{ value: 'all', label: 'All three' }, { value: 'pre', label: 'Left dots' }, { value: 'in', label: 'Bottom dots' }, { value: 'post', label: 'Right dots' }],
      onChange: function (v) { focus = v === 'all' ? null : v; player.refresh(); }
    });
    return player;
  }

  /* ================================================================== flowchart (lit by the lab) */
  var flowCtl = null;
  function flowSpec(order, method) {
    if (order === 'level') {
      return {
        nodes: [
          { id: 'init', type: 'start', text: 'queue ← [root]', col: 0, row: 0 },
          { id: 'loop', type: 'decision', text: 'queue empty ?', col: 0, row: 1 },
          { id: 'done', type: 'end', text: 'stop: every node visited', col: 1, row: 1 },
          { id: 'deq', type: 'process', text: 'node ← take the front of the queue', col: 0, row: 2 },
          { id: 'visit', type: 'process', text: 'VISIT node (write it to the output)', col: 0, row: 3 },
          { id: 'enq', type: 'process', text: 'add its left child, then its right child, to the back', col: 0, row: 4 }
        ],
        edges: [
          { from: 'init', to: 'loop' }, { from: 'loop', to: 'done', label: 'yes' }, { from: 'loop', to: 'deq', label: 'no' },
          { from: 'deq', to: 'visit' }, { from: 'visit', to: 'enq' },
          { from: 'enq', to: 'loop', via: { fromSide: 'left', toSide: 'left', points: [[-0.5, 4], [-0.5, 1]] } }
        ]
      };
    }
    if (method === 'stack') {
      return { nodes: [{ id: 'note', type: 'note', text: 'This flowchart follows the recursive and level-order runs. Choose “Recursion” above to light it up.', col: 0, row: 0, maxWidth: 260 }], edges: [] };
    }
    function point(k, word) {
      return order === k ? 'VISIT the node here: ' + word : word + ': nothing to do';
    }
    return {
      nodes: [
        { id: 'call', type: 'start', text: 'visit(node) is called', col: 0, row: 0 },
        { id: 'pre', type: 'process', text: point('pre', 'before the children'), col: 0, row: 1 },
        { id: 'hasL', type: 'decision', text: 'left child ?', col: 0, row: 2 },
        { id: 'goL', type: 'process', text: 'visit(node.left): this whole chart again', col: 1, row: 2 },
        { id: 'in', type: 'process', text: point('in', 'between the children'), col: 0, row: 3 },
        { id: 'hasR', type: 'decision', text: 'right child ?', col: 0, row: 4 },
        { id: 'goR', type: 'process', text: 'visit(node.right): this whole chart again', col: 1, row: 4 },
        { id: 'post', type: 'process', text: point('post', 'after the children'), col: 0, row: 5 },
        { id: 'ret', type: 'end', text: 'return to the caller', col: 0, row: 6 }
      ],
      edges: [
        { from: 'call', to: 'pre' }, { from: 'pre', to: 'hasL' },
        { from: 'hasL', to: 'goL', label: 'yes' }, { from: 'hasL', to: 'in', label: 'no' }, { from: 'goL', to: 'in' },
        { from: 'in', to: 'hasR' },
        { from: 'hasR', to: 'goR', label: 'yes' }, { from: 'hasR', to: 'post', label: 'no' }, { from: 'goR', to: 'post' },
        { from: 'post', to: 'ret' }
      ]
    };
  }
  function flowFigure() {
    if (flowCtl) return flowCtl;
    var fig = V.$('#fig-flow');
    if (!fig) return null;
    legend(fig, [{ state: 'active', label: 'where the run is now' }]);
    var foot = fig.querySelector('[data-flow-foot]');
    var mode = { order: 'pre', method: 'recursive' };
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), flowSpec('pre', 'recursive'), { label: 'Flowchart of a recursive traversal: visit, left, visit, right, visit' });
    function note() {
      if (mode.order === 'level') foot.textContent = 'Level order: a queue, so nodes leave in the order they arrived. Run it in the lab and this chart follows along.';
      else if (mode.method === 'stack') foot.textContent = 'Explicit-stack runs have no flowchart here: switch the lab to recursion, or to level order.';
      else foot.textContent = 'The same chart serves all three depth-first orders. Only the box that says VISIT moves: ' + ORDER_LABEL[mode.order].toLowerCase() + ' visits ' + (mode.order === 'pre' ? 'before' : mode.order === 'in' ? 'between' : 'after') + ' the children. Run the lab and it lights up step by step.';
    }
    flowCtl = {
      view: view,
      highlight: function (id, ctx) { view.highlight(id === undefined ? null : id, ctx); },
      setMode: function (order, method) {
        if (mode.order === order && mode.method === method) return;
        mode = { order: order, method: method };
        view.setSpec(flowSpec(order, method));
        view.render({ active: null }, { duration: 0 });
        note();
      }
    };
    note();
    return flowCtl;
  }

  /* ================================================================== the lab */
  function randomTokens(rng) {
    var n = rng.int(7, 12), letters = 'ABCDEFGHIJKL'.split('');
    var shape = { v: letters[0], l: null, r: null }, open = [[shape, 'l'], [shape, 'r']];
    for (var i = 1; i < n; i++) {
      var pick = open.splice(rng.int(0, open.length - 1), 1)[0];
      var node = { v: letters[i], l: null, r: null };
      pick[0][pick[1]] = node;
      open.push([node, 'l'], [node, 'r']);
    }
    var out = [], q = [shape];
    while (q.length) { var x = q.shift(); if (x === null) { out.push('#'); continue; } out.push(x.v); q.push(x.l, x.r); }
    while (out[out.length - 1] === '#') out.pop();
    return out.join(' ');
  }

  function labFigure() {
    var fig = V.$('#lab-fig');
    if (!fig) return;
    var st = { tree: A.parseLevel('A B C D E # F').tree, order: 'pre', method: 'recursive', steps: [], structure: 'callstack' };
    var rng = V.rng(1818);
    var grid = fig.querySelector('.tr-pane--struct');
    var structTitle = fig.querySelector('[data-struct-title]');
    var hosts = { callstack: fig.querySelector('[data-host="callstack"]'), stack: fig.querySelector('[data-host="stack"]'), queue: fig.querySelector('[data-host="queue"]') };
    var flow = flowFigure();
    var flowProxy = { highlight: function (id, ctx) { if (flow) flow.highlight(id, ctx); } };

    var view = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 44, gap: 1, levelHeight: 82, label: 'The tree being traversed' });
    var outView = V.views.array(fig.querySelector('[data-out]'), { mode: 'boxes', cellSize: 38, label: 'Output: nodes in the order they were visited' });
    var structs = {};
    function struct(kind) {
      if (structs[kind]) return structs[kind];
      if (kind === 'callstack') structs[kind] = V.views.callstack(hosts.callstack, { frameWidth: 340, maxVisible: 7, showLocals: false, label: 'Call stack' });
      else if (kind === 'stack') structs[kind] = V.views.stack(hosts.stack, { cellSize: 32, cellWidth: 130, label: 'Explicit stack' });
      else structs[kind] = V.views.queue(hosts.queue, { cellSize: 40, label: 'Queue' });
      return structs[kind];
    }
    function structState(kind, s) {
      if (kind === 'callstack') return { frames: s.frames };
      if (kind === 'stack') return { items: s.stack.map(function (x) { return { id: x.id, value: x.value, state: 'default' }; }), label: 'stack' };
      return { items: s.queue.map(function (x) { return { id: x.id, value: x.value, state: 'default' }; }) };
    }
    function outState(s) {
      return {
        items: s.out.map(function (id) { return { id: 'o' + id, value: valueOf(st.tree, id), state: id === s.just ? 'swap' : 'done' }; }),
        length: A.size(st.tree), label: 'output'
      };
    }
    var layer = null;

    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A.CODE['recursive-pre'], default: 'pseudo', title: 'traversal', maxHeight: 419 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { node: 'active', cur: 'active', out: 'done', stack: 'frontier', queue: 'frontier' } });

    var player = V.player({
      root: fig, steps: [{ caption: '', root: null, nodes: [], out: [], frames: [], stack: [], queue: [], tour: null, counters: {}, vars: {} }], baseStepMs: 1100, label: 'Traversal lab controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS,
      counterStates: { visited: 'done', peak: 'frontier', depth: 'frontier', stackSize: 'frontier', queueSize: 'frontier' },
      code: code, vars: vars, flow: flowProxy,
      render: function (s, c) {
        if (!s.nodes.length) return;
        view.render(treeState(s), { duration: c.duration });
        if (layer) layer.update({ pos: s.tour, ms: c.duration, focus: st.order });
        outView.render(outState(s), { duration: c.duration });
        struct(st.structure).render(structState(st.structure, s), { duration: c.duration });
        var sh = hosts[st.structure], none = (s.frames || []).length + (s.stack || []).length + (s.queue || []).length === 0;
        if (sh && sh.parentNode) sh.parentNode.toggleAttribute('data-empty', none);
      }
    });

    /* ---- checkpoints (function specs are re-resolved for every new trace) */
    function chooseOptions(items, answerKey, key) {
      var uniq = uniqueBy(items, key);
      var ai = uniq.findIndex(function (x) { return key(x) === answerKey; });
      if (ai > 0 && uniq.length > 1) { var t = uniq[0]; uniq[0] = uniq[ai]; uniq[ai] = t; }
      // deterministic shuffle keyed by the tree, so the right answer is not always first
      var seed = A.size(st.tree) * 7 + st.order.length * 3 + st.tree.order.map(function (id, i) { return String(valueOf(st.tree, id)).charCodeAt(0) * (i + 1); }).reduce(function (a, b) { return a + b; }, 0);
      var r = V.rng(seed), out = uniq.slice();
      for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = out[i]; out[i] = out[j]; out[j] = tmp; }
      return out;
    }
    player.addCheckpoint(function (steps) {
      var visits = [];
      steps.forEach(function (s, i) { if (s.kind === 'visit') visits.push(i); });
      return visits.length >= 3 ? visits[2] : -1;
    }, function (c) {
      var tree = st.tree, o = A.orders(tree), seen = {};
      c.prev.out.forEach(function (id) { seen[id] = true; });
      var want = c.step.out[c.step.out.length - 1];
      var firstUnseen = function (list) { return list.filter(function (id) { return !seen[id]; })[0]; };
      var byOrder = { pre: firstUnseen(o.pre), 'in': firstUnseen(o.in), post: firstUnseen(o.post), level: firstUnseen(o.level) };
      var cand = [want, byOrder.pre, byOrder['in'], byOrder.post, byOrder.level].concat(tree.order.filter(function (id) { return !seen[id]; }));
      var opts = chooseOptions(uniqueBy(cand.filter(Boolean), function (id) { return String(valueOf(tree, id)); }).slice(0, 4), want, function (id) { return id; });
      if (opts.length < 2) return null;
      var name = ORDER_LABEL[st.order].toLowerCase();
      var rule = {
        pre: 'Preorder visits a node before its children, and the whole left subtree before the right one.',
        'in': 'Inorder finishes the whole left subtree first, then visits the node, then does the right subtree.',
        post: 'Postorder visits both subtrees before the node itself, so a node comes after everything below it.',
        level: 'Level order goes level by level, left to right: the node at the front of the queue is next.'
      }[st.order];
      var seenList = c.prev.out.map(function (id) { return valueOf(tree, id); }).join(', ');
      return {
        question: 'The output so far is <b>' + V.escape(seenList) + '</b>. Which node will <b>' + name + '</b> visit next?',
        options: opts.map(function (id) { return V.escape(String(valueOf(tree, id))); }),
        answer: opts.indexOf(want),
        explain: opts.map(function (id) {
          var v = V.escape(String(valueOf(tree, id)));
          if (id === want) return 'Yes, <b>' + v + '</b>. ' + rule;
          var who = ['pre', 'in', 'post', 'level'].filter(function (k) { return byOrder[k] === id && k !== st.order; }).map(function (k) { return ORDER_LABEL[k].toLowerCase(); });
          return '<b>' + v + '</b> is not next in ' + name + '.' + (who.length ? ' It is what ' + who.join(' or ') + ' would visit next, which is a different rule.' : ' It has to wait: something nearer in the ' + name + ' comes first.') + ' ' + rule;
        })
      };
    }, { id: 'l18-lab-next-visit' });

    player.addCheckpoint(function (steps) {
      if (steps.length < 8) return -1;
      var visits = steps.map(function (s, i) { return s.kind === 'visit' ? i : -1; }).filter(function (i) { return i >= 0; });
      var idx = Math.round(steps.length * 0.5);
      if (visits.indexOf(idx) !== -1) idx += 1;
      return idx < steps.length ? idx : -1;
    }, function (c) {
      var tree = st.tree, last = c.steps[c.steps.length - 1], peak = last.counters.peak, n = A.size(tree), hgt = A.height(tree);
      var cands = uniqueBy([peak, peak + 1, n, hgt + 1, hgt, peak > 1 ? peak - 1 : null, 2 * peak].filter(function (x) { return x !== null && x >= 1 && x <= n; }), String);
      var opts = chooseOptions(cands.slice(0, 4), peak, String);
      if (opts.indexOf(peak) === -1 || opts.length < 2) return null;
      var m = st.order === 'level' ? 'queue' : st.method === 'stack' ? 'stack' : 'callstack';
      var ask = { callstack: 'the call stack holds at most how many frames at one time', stack: 'the explicit stack holds at most how many nodes at one time', queue: 'the queue is at most how long' }[m];
      var why = {
        callstack: 'Each frame on the stack is a call that has started and not yet returned, and those calls always form one path from the root down. The longest path has height + 1 = ' + peak + ' nodes.',
        stack: 'The stack holds work that is started but unfinished, plus nodes waiting to be handled. Running the algorithm on this tree, the most it ever holds at one moment is ' + peak + '.',
        queue: 'The queue holds a whole “frontier” of discovered but unvisited nodes. On this tree the line is longest at ' + peak + ', about the width of the widest level.'
      }[m];
      return {
        question: 'Before you watch it play out: for this tree and this method, ' + ask + '?',
        options: opts.map(String), answer: opts.indexOf(peak),
        explain: opts.map(function (x) {
          if (x === peak) return 'Yes: <b>' + x + '</b>. ' + why;
          if (x === n) return '<b>' + x + '</b> would mean every node is stored at once. Nodes leave the structure as soon as they are handled, so it is never that many here; the peak is ' + peak + '.';
          return '<b>' + x + '</b> is not the peak: the structure gets up to ' + peak + ' here. ' + why;
        })
      };
    }, { id: 'l18-lab-peak' });

    /* ---- load a tree / order / method */
    function structFor() { return st.order === 'level' ? 'queue' : st.method === 'stack' ? 'stack' : 'callstack'; }
    function setup(o) {
      if (o) Object.assign(st, o);
      var res = A.run(st.tree, st.order, st.method);
      var steps = res.steps;
      st.steps = steps;
      st.structure = structFor();
      Object.keys(hosts).forEach(function (k) { hosts[k].hidden = k !== st.structure; });
      grid.setAttribute('data-struct', st.structure);
      structTitle.textContent = { callstack: 'Call stack', stack: 'Explicit stack', queue: 'Queue' }[st.structure];
      code.setSource(A.CODE[A.codeKey(st.order, st.method)]);
      view.reset(); view.prepare(steps.map(treeState));
      outView.reset(); outView.prepare(steps.map(outState));
      var sv = struct(st.structure);
      sv.reset && sv.reset(); sv.prepare && sv.prepare(steps.map(function (s) { return structState(st.structure, s); }));
      if (layer) { layer.destroy(); layer = null; }
      var dfsRec = st.order !== 'level' && st.method === 'recursive';
      if (dfsRec) layer = L.tourLayer(view, st.tree);
      legend(fig, [{ state: 'active', label: 'node being worked on' }, { state: 'frontier', label: st.structure === 'queue' ? 'waiting in the queue' : 'waiting on the stack' },
        { state: 'swap', label: 'visited now' }, { state: 'done', label: 'already in the output' }].concat(dfsRec ? [{ state: 'path', shape: 'line', label: 'chain of calls' }].concat(L.TOUR_LEGEND) : []));
      if (flow) flow.setMode(st.order, st.method);
      player.setSteps(steps);
    }

    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your tree, level by level', value: 'A B C D E # F', placeholder: 'e.g. A B C # D  (# = empty place)',
      parse: function (text) { var r = A.parseLevel(text); return { values: r.tree, error: r.error }; },
      presets: [
        { label: 'Textbook', value: 'A B C D E # F' },
        { label: 'Perfect (7)', value: 'A B C D E F G' },
        { label: 'Complete (10)', value: 'A B C D E F G H I J' },
        { label: 'Left chain', value: 'A B # C # D #' },
        { label: 'Right chain', value: 'A # B # C # D' },
        { label: 'Random', value: function () { return randomTokens(rng); } }
      ],
      applyLabel: 'Build', hint: 'Level by level, left to right. A # holds an empty place. Values of up to 3 characters, at most 15 nodes.',
      onApply: function (tree) { setup({ tree: tree }); }
    });
    var methodWrap = fig.querySelector('[data-seg-method]');
    var segOrder = V.segmented(fig.querySelector('[data-seg-order]'), {
      label: 'Order', value: 'pre',
      options: [{ value: 'pre', label: 'Preorder' }, { value: 'in', label: 'Inorder' }, { value: 'post', label: 'Postorder' }, { value: 'level', label: 'Level order' }],
      onChange: function (v) { methodWrap.hidden = v === 'level'; setup({ order: v }); }
    });
    V.segmented(methodWrap, {
      label: 'How', value: 'recursive',
      options: [{ value: 'recursive', label: 'Recursion' }, { value: 'stack', label: 'Explicit stack' }],
      onChange: function (v) { setup({ method: v }); }
    });
    void segOrder; void input;
    setup();
    return { player: player, setup: setup };
  }

  nearView(V.$('#fig-euler'), eulerFigure);
  nearView(V.$('#fig-flow'), flowFigure);
  nearView(V.$('#lab-fig'), labFigure);
}());
