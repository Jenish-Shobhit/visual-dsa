/* Lesson 30 · Minimum spanning trees — part 2: the Kruskal and Prim labs and their flowcharts.
   Needs js/lessons/30-minimum-spanning-trees.js (VDSA.L30) and js/algos/30-minimum-spanning-trees.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var M = V.algos.mst;
  var L = V.L30;

  /* ================================================================== code (labels tie lines across languages) */
  var CODE = {
    kruskal: {
      pseudo: [
        'Kruskal(V, E)',
        '  sort E by weight, lightest first              // @sort',
        '  make-set(v) for every vertex v                // @init',
        '  T ← empty list; total ← 0                     // @init',
        '  for each edge (u, v, w) in sorted order       // @loop',
        '    ru ← find(u);  rv ← find(v)                 // @check',
        '    if ru = rv: skip it (it would close a cycle) // @reject',
        '    else: add (u, v) to T; total ← total + w    // @accept',
        '          union(ru, rv)                         // @accept',
        '    if |T| = |V| − 1: stop                      // @stop',
        '  return T                                      // @done'
      ].join('\n'),
      js: [
        'function kruskal(n, edges) {',
        '  edges = [...edges].sort((a, b) => a.w - b.w);          // @sort',
        '  const parent = Array.from({ length: n }, (_, i) => i); // @init',
        '  const find = (x) =>',
        '    parent[x] === x ? x : (parent[x] = find(parent[x])); // @init',
        '  const tree = []; let total = 0;                        // @init',
        '  for (const { u, v, w } of edges) {                     // @loop',
        '    const ru = find(u), rv = find(v);                    // @check',
        '    if (ru === rv) continue;  // same set: a cycle       // @reject',
        '    parent[ru] = rv;                                     // @accept',
        '    tree.push([u, v]); total += w;                       // @accept',
        '    if (tree.length === n - 1) break;                    // @stop',
        '  }',
        '  return { tree, total };                                // @done',
        '}'
      ].join('\n'),
      py: [
        'def kruskal(n, edges):',
        '    edges = sorted(edges, key=lambda e: e[2])     # @sort',
        '    parent = list(range(n))                       # @init',
        '    def find(x):                                  # @init',
        '        while parent[x] != x:',
        '            parent[x] = parent[parent[x]]',
        '            x = parent[x]',
        '        return x',
        '    tree, total = [], 0                           # @init',
        '    for u, v, w in edges:                         # @loop',
        '        ru, rv = find(u), find(v)                 # @check',
        '        if ru == rv: continue   # same set: cycle # @reject',
        '        parent[ru] = rv                           # @accept',
        '        tree.append((u, v)); total += w           # @accept',
        '        if len(tree) == n - 1: break              # @stop',
        '    return tree, total                            # @done'
      ].join('\n')
    },
    prim: {
      pseudo: [
        'Prim(G, s)',
        '  tree ← {s}; total ← 0                       // @init',
        '  push every edge (s, x, w) into the queue pq  // @seed',
        '  while pq is not empty and |tree| < |V|       // @loop',
        '    (u, v, w) ← pop the lightest edge of pq    // @pop',
        '    if v is already in the tree: continue      // @skip',
        '    add v to the tree; keep edge (u, v)        // @add',
        '    total ← total + w                          // @add',
        '    push every edge (v, x, w), x outside       // @push',
        '  return tree                                  // @done'
      ].join('\n'),
      js: [
        'function prim(adj, s) {           // adj[u] = [[v, w], ...]',
        '  const inTree = new Set([s]);                       // @init',
        '  const tree = []; let total = 0;                    // @init',
        '  const pq = new MinHeap();      // keyed by weight  // @init',
        '  for (const [x, w] of adj[s]) pq.push([w, s, x]);   // @seed',
        '  while (pq.size > 0 && inTree.size < adj.length) {  // @loop',
        '    const [w, u, v] = pq.pop();                      // @pop',
        '    if (inTree.has(v)) continue;                     // @skip',
        '    inTree.add(v); tree.push([u, v]);                // @add',
        '    total += w;                                      // @add',
        '    for (const [x, wx] of adj[v])                    // @push',
        '      if (!inTree.has(x)) pq.push([wx, v, x]);       // @push',
        '  }',
        '  return { tree, total };                            // @done',
        '}'
      ].join('\n'),
      py: [
        'import heapq',
        '',
        'def prim(adj, s):                 # adj[u] = [(v, w), ...]',
        '    in_tree = {s}                                # @init',
        '    tree, total = [], 0                          # @init',
        '    pq = [(w, s, x) for x, w in adj[s]]          # @seed',
        '    heapq.heapify(pq)                            # @seed',
        '    while pq and len(in_tree) < len(adj):        # @loop',
        '        w, u, v = heapq.heappop(pq)              # @pop',
        '        if v in in_tree: continue                # @skip',
        '        in_tree.add(v); tree.append((u, v))      # @add',
        '        total += w                               # @add',
        '        for x, wx in adj[v]:                     # @push',
        '            if x not in in_tree:                 # @push',
        '                heapq.heappush(pq, (wx, v, x))   # @push',
        '    return tree, total                           # @done'
      ].join('\n')
    }
  };
  L.CODE = CODE;

  /* ================================================================== flowcharts (ids = step.flow) */
  var FLOW_KRUSKAL = {
    nodes: [
      { id: 'init', type: 'start', text: 'sort the edges\nmake-set(v) for every v', col: 0, row: 0 },
      { id: 'next', text: 'take the next lightest\nedge (u, v, w)', col: 0, row: 1 },
      { id: 'check', type: 'decision', text: 'find(u) ≠ find(v) ?', col: 0, row: 2 },
      { id: 'accept', text: 'keep the edge\nunion(u, v)', col: 0, row: 3 },
      { id: 'reject', text: 'skip it: it would\nclose a cycle', col: 1, row: 3 },
      { id: 'full', type: 'decision', text: '|T| = |V| − 1 ?', col: 0, row: 4 },
      { id: 'done', type: 'end', text: 'return T', col: 1, row: 4 }
    ],
    edges: [
      { from: 'init', to: 'next' },
      { from: 'next', to: 'check' },
      { from: 'check', to: 'accept', label: 'yes' },
      { from: 'check', to: 'reject', label: 'no' },
      { from: 'accept', to: 'full' },
      { from: 'full', to: 'done', label: 'yes' },
      { from: 'full', to: 'next', label: 'no', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'reject', to: 'next', via: { fromSide: 'right', toSide: 'right', points: [[1.6, 3], [1.6, 1]] } }
    ]
  };
  var FLOW_PRIM = {
    nodes: [
      { id: 'init', type: 'start', text: 'tree ← {s}', col: 1, row: 0 },
      { id: 'push', text: 'push every edge from\nthe newest vertex\nto outside', col: 1, row: 1, maxWidth: 190 },
      { id: 'more', type: 'decision', text: 'queue empty or\ntree full ?', col: 1, row: 2 },
      { id: 'done', type: 'end', text: 'return tree', col: 0, row: 2 },
      { id: 'pop', text: 'pop the lightest\nedge (u, v)', col: 1, row: 3 },
      { id: 'stale', type: 'decision', text: 'v already in tree ?', col: 1, row: 4 },
      { id: 'skip', text: 'discard: stale,\nwould close a cycle', col: 2, row: 4 },
      { id: 'add', text: 'add v and edge (u, v)\nto the tree', col: 1, row: 5 }
    ],
    edges: [
      { from: 'init', to: 'push' },
      { from: 'push', to: 'more' },
      { from: 'more', to: 'done', label: 'yes' },
      { from: 'more', to: 'pop', label: 'no' },
      { from: 'pop', to: 'stale' },
      { from: 'stale', to: 'skip', label: 'yes' },
      { from: 'stale', to: 'add', label: 'no' },
      { from: 'add', to: 'push', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'skip', to: 'more', via: { fromSide: 'top', toSide: 'right' } }
    ]
  };
  L.FLOW_KRUSKAL = FLOW_KRUSKAL; L.FLOW_PRIM = FLOW_PRIM;

  /* ================================================================== graph presets */
  var PRESETS = [
    { label: 'Six towns', g: L.MAIN, start: 'A' },
    { label: 'Nine towns', g: L.TOWNS, start: 'A' },
    { label: 'Ties', g: L.TIES, start: 'A' },
    { label: 'Two islands', g: L.ISLANDS, start: 'A' },
    { label: 'Dense K5', g: L.K5, start: 'A' },
    { label: 'Random', random: true, start: 'A' }
  ];
  var randomSeed = 11;

  /* ================================================================== the lab */
  function mstLab(fig) {
    var algo = fig.getAttribute('data-algo');
    var isK = algo === 'kruskal';
    var G = L.TOWNS, start = 'A';
    var stage = fig.querySelector('[data-stage]'), panels = fig.querySelector('[data-panels]');
    var drawBtn = fig.querySelector('[data-draw]'), editor = fig.querySelector('[data-editor]');
    var startSel = fig.querySelector('[data-start]');

    var view = V.views.graph(stage, { bounds: { w: 1000, h: 600 }, label: (isK ? 'Kruskal' : 'Prim') + ' lab graph', maxHeight: 430 });
    var chipHost = h('div'), stripHost = h('div');
    var chipBox = h('div', { class: 'mst-panel mst-panel--chips' },
      h('p', { class: 'mst-panel__title' }, isK ? 'Sorted edge list (lightest first)' : 'Priority queue of candidate edges (lightest first)'), chipHost);
    panels.appendChild(chipBox);
    if (isK) panels.appendChild(h('div', { class: 'mst-panel' }, h('p', { class: 'mst-panel__title' }, 'Components (union-find sets)'), stripHost));
    var chips = L.chipList(chipHost, { cursor: isK, label: isK ? 'Sorted edge list' : 'Priority queue', empty: isK ? 'no edges' : 'the queue is empty' });
    var strip = isK ? L.groupStrip(stripHost, L.ids(G)) : null;

    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE[algo], default: 'pseudo', title: algo, maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: isK ? { edge: 'compare', ru: 'active', rv: 'active', total: 'done' } : { u: 'active', v: 'compare', tree: 'done', total: 'done' } });

    var flowFig = V.$('#fig-flow-' + algo), flowView = null, flow = null;
    if (flowFig) {
      V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }, { state: 'visited', label: 'Already run' }]);
      flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), isK ? FLOW_KRUSKAL : FLOW_PRIM, { label: (isK ? 'Kruskal' : 'Prim') + ' decision flow, lit by the lab' });
      var seen = {};
      flow = { highlight: function (id, ctx) { if (id === 'init') seen = {}; else if (id) seen[id] = true; flowView.render(id ? { active: id, visited: Object.keys(seen).filter(function (k) { return k !== id; }) } : {}, { duration: ctx ? ctx.duration : 0 }); } };
    }

    function legend() {
      V.legend(fig.querySelector('[data-legend]'), isK ? [
        { state: 'default', shape: 'outline', label: 'Not judged' }, { state: 'compare', label: 'Edge being judged' }, { state: 'active', label: 'Its two ends' },
        { state: 'done', label: 'Kept in the tree' }, { state: 'error', label: 'Rejected: cycle' },
        { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'One colour per component' }
      ] : [
        { state: 'default', shape: 'outline', label: 'Outside, no edge yet' }, { state: 'frontier', label: 'Outside, edge in the queue' }, { state: 'compare', label: 'Edge just popped' },
        { state: 'active', label: 'Newest vertex' }, { state: 'done', label: 'In the tree' }, { state: 'muted', shape: 'dash', label: 'Dead queue entry' }
      ]);
    }

    function normalize(steps) {
      var raw = V.vars.raw;
      return steps.map(function (st) {
        var o = Object.assign({}, st), vv = st.vars || {};
        function r(x) { return x === null || x === undefined ? null : raw(String(x)); }
        o.vars = isK
          ? { edge: r(vv.edge), w: vv.w === undefined ? null : vv.w, ru: r(vv.ru), rv: r(vv.rv), kept: r(vv.kept), total: vv.total }
          : { u: r(vv.u), v: r(vv.v), w: vv.w === undefined ? null : vv.w, tree: r(vv.tree), queue: vv.queue, total: vv.total };
        return o;
      });
    }
    function generate() {
      var raw = isK ? M.kruskalTrace(G) : M.primTrace(G, start);
      return normalize(raw);
    }
    function kItems(st) {
      var full = st.kind === 'done' && st.accepted.length === st.need && st.need > 0;
      return st.sorted.map(function (e) {
        var status = st.status[e.id];
        return { key: e.id, label: L.dash(e), w: e.w, state: status === 'pending' ? (full ? 'unread' : 'pending') : status };
      });
    }
    function pItems(st) {
      var items = [];
      if (st.popped) items.push({ key: st.popped.key, label: st.popped.u + '–' + st.popped.v, w: st.popped.w, state: st.kind === 'skip' ? 'rejected' : 'popped' });
      st.pq.forEach(function (q) { items.push({ key: q.key, label: q.u + '–' + q.v, w: q.w, state: q.dead ? 'dead' : 'queued', title: q.u + ' to ' + q.v + ', weight ' + q.w + (q.dead ? ', dead: both ends in the tree' : '') }); });
      return items;
    }
    function render(st, ctx) {
      view.render(isK ? L.kruskalState(G, st) : L.primState(G, st), { duration: ctx.duration });
      if (isK) { chips.render(kItems(st), { duration: ctx.duration, cursor: st.cursor }); strip.render(st.groups); }
      else chips.render(pItems(st), { duration: ctx.duration });
    }
    function fillStart() {
      if (!startSel) return;
      var ids = L.ids(G);
      if (ids.indexOf(start) === -1) start = ids[0];
      V.clear(startSel);
      ids.forEach(function (id) { startSel.appendChild(h('option', { value: id, selected: id === start }, id)); });
    }

    legend();
    fillStart();
    var first = generate();
    var player = V.player({
      root: fig, steps: first, render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: isK ? { examined: 'Edges examined', accepted: 'Edges kept', rejected: 'Cycles avoided', weight: 'Tree weight' }
        : { intree: 'Vertices in tree', pushes: 'Queue pushes', pops: 'Queue pops', weight: 'Tree weight' },
      counterStates: isK ? { accepted: 'done', rejected: 'error', weight: 'done' } : { intree: 'done', pushes: 'frontier', weight: 'done' },
      baseStepMs: isK ? 1000 : 1100, label: (isK ? 'Kruskal' : 'Prim') + ' lab controls'
    });

    L.reserve(player, panels, function (st) {
      if (isK) { chips.render(kItems(st), { duration: 0, cursor: st.cursor }); strip.render(st.groups); }
      else chips.render(pItems(st), { duration: 0 });
    }, first);
    L.reserveVars(player, vars, first);

    /* ---------- predictions */
    if (isK) {
      player.addCheckpoint(function (steps) {
        var picks = [], i;
        for (i = 1; i < steps.length; i++) if (steps[i].kind === 'pick') picks.push(i);
        for (i = 0; i < picks.length; i++) if (steps[picks[i] + 2] && steps[picks[i] + 2].kind === 'reject') return picks[i];
        return picks.length >= 3 ? picks[2] : (picks.length ? picks[picks.length - 1] : -1);
      }, function (c) {
        var st = c.step, e = st.sorted[st.cursor], d = c.steps[c.index + 2];
        if (!e || !d) return null;
        var before = c.prev, reject = d.kind === 'reject';
        return {
          question: 'The next edge in the sorted list is <b>' + L.dash(e) + '</b>, weight <b>' + e.w + '</b>. Will Kruskal keep it?',
          options: ['Keep it: it joins two different components', 'Skip it: its ends are already connected'],
          answer: reject ? 1 : 0,
          explain: reject
            ? ['Not quite. Look at the colours: ' + e.u + ' and ' + e.v + ' already share one, so the kept edges already join them and a new edge would only make a loop.', 'Right. ' + e.u + ' and ' + e.v + ' are already in one component (same colour), so this edge would close a cycle.']
            : ['Right. ' + e.u + ' and ' + e.v + ' are in different components, so this edge merges two separate pieces and cannot close a cycle.', 'They are in different components (different colours), so nothing connects them yet. The edge is kept.']
        };
      }, { id: 'l30-kruskal-next' });
    } else {
      player.addCheckpoint(function (steps) {
        var n = 0;
        for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'pop' && steps[i + 1] && steps[i + 1].kind === 'add' && ++n === 3) return i;
        n = 0;
        for (var j = 1; j < steps.length; j++) if (steps[j].kind === 'pop' && steps[j + 1] && steps[j + 1].kind === 'add' && ++n === 2) return j;
        return -1;
      }, function (c) {
        var before = c.prev, pop = c.step.popped;
        var alive = before.pq.filter(function (q) { return !q.dead; });
        var byV = {};
        alive.forEach(function (q) { if (!byV[q.v] || q.w < byV[q.v].w) byV[q.v] = q; });
        var cands = Object.keys(byV).map(function (v) { return byV[v]; }).sort(function (a, b) { return a.w - b.w; });
        if (cands.length < 2 || !pop) return null;
        cands = cands.slice(0, 3);
        var correct = cands.filter(function (q) { return q.v === pop.v; })[0];
        if (!correct) return null;
        var ans = cands.indexOf(correct);
        return {
          question: 'The tree holds <code>' + before.tree.join(' ') + '</code>. Which vertex does Prim add next?',
          options: cands.map(function (q) { return '<b>' + q.v + '</b> (cheapest queue edge ' + q.u + '–' + q.v + ', ' + q.w + ')'; }),
          answer: ans,
          explain: cands.map(function (q, i) {
            return i === ans ? q.v + ' is reached by the lightest live edge in the queue (' + q.w + '), so Prim pops it first. That edge is the cheapest way out of the tree, so it is safe.'
              : q.v + ' is only reachable by an edge of weight ' + q.w + ', and a lighter edge (' + correct.w + ') is still waiting in the queue. Prim always pops the lightest first.';
          })
        };
      }, { id: 'l30-prim-vertex' });
      player.addCheckpoint(function (steps) {
        for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'skip') return i;
        return -1;
      }, function (c) {
        var pop = c.prev.popped;
        if (!pop) return null;
        return {
          question: 'Prim pops <b>' + pop.u + '–' + pop.v + '</b> (' + pop.w + '), but <b>' + pop.v + '</b> is already in the tree. What now?',
          options: ['Add the edge anyway: it is the lightest in the queue', 'Discard it: adding it would close a cycle', 'Restart Prim from a new vertex'],
          answer: 1,
          explain: [
            'The lightest is not the only test. Both ends are in the tree, so the edge would create a cycle and waste ' + pop.w + '.',
            pop.v + ' joined earlier along a lighter route. The entry is stale, so Prim throws it away and pops again.',
            'Nothing is wrong: the tree is fine. Only this queue entry is useless, so it is dropped.'
          ]
        };
      }, { id: 'l30-prim-skip' });
    }

    function reload() {
      player.setSteps(generate());
    }
    function setGraph(g, startId) {
      G = g;
      if (startId) start = startId;
      view.resetPositions && view.resetPositions();
      if (isK) { V.clear(stripHost); strip = L.groupStrip(stripHost, L.ids(G)); }
      fillStart();
      reload();
    }
    if (startSel) startSel.addEventListener('change', function () { start = startSel.value; reload(); });

    /* ---------- custom input: an edge list with weights, plus presets with hand-made layouts */
    var pending = null;
    function layoutFor(parsed) {
      var old = {};
      G.nodes.forEach(function (n) { old[n.id] = n; });
      var keep = parsed.nodes.filter(function (id) { return old[id]; });
      var nodes = parsed.nodes.map(function (id) { return old[id] ? { id: id, x: old[id].x, y: old[id].y, fixed: true } : { id: id }; });
      var edges = parsed.edges.map(function (e) { return { from: e.u, to: e.v }; });
      var pos = V.views.graph.layouts.force(keep.length ? nodes : parsed.nodes, edges, { w: 1000, h: 600, pad: 90, seed: 5 });
      return { nodes: parsed.nodes.map(function (id) { var p = pos[id] || old[id]; return { id: id, x: p.x, y: p.y }; }), edges: parsed.edges };
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges with weights (up to 10 vertices)',
      value: M.toText(G),
      placeholder: 'e.g. A-B:4, B-C:2, A-C:7, D',
      parse: function (text) { return M.parseEdges(text); },
      presets: PRESETS.map(function (p) {
        return { label: p.label, value: function () { pending = p.random ? { g: L.random(randomSeed++), start: 'A' } : p; return M.toText(pending.g); } };
      }),
      hint: 'Write each road as A-B:weight, separated by commas. Weights are whole numbers from −99 to 99. A lone name is a vertex with no road.',
      onApply: function (parsed) {
        var p = pending;
        pending = null;
        if (p && M.toText(p.g) === input.field.value) setGraph(p.g, p.start);
        else setGraph(layoutFor(parsed), null);
      }
    });

    /* ---------- draw mode */
    var ed = null, edErr = editor.querySelector('[data-editor-error]');
    function openEditor() {
      player.pause();
      editor.hidden = false;
      drawBtn.setAttribute('aria-pressed', 'true');
      if (!ed) ed = V.views.graph(editor.querySelector('[data-editor-canvas]'), { editable: true, directed: false, weighted: true, defaultWeight: 5, bounds: { w: 1000, h: 600 }, maxHeight: 420 });
      ed.setGraph({ nodes: G.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }), edges: G.edges.map(function (e) { return { from: e.u, to: e.v, weight: e.w }; }) });
      edErr.textContent = '';
      var b = editor.querySelector('button');
      if (b) b.focus();
    }
    function closeEditor() { editor.hidden = true; drawBtn.setAttribute('aria-pressed', 'false'); drawBtn.focus(); }
    drawBtn.addEventListener('click', function () { if (editor.hidden) openEditor(); else closeEditor(); });
    editor.querySelector('[data-editor-clear]').addEventListener('click', function () { ed.setGraph({ nodes: [], edges: [] }); edErr.textContent = ''; });
    editor.querySelector('[data-editor-done]').addEventListener('click', function () {
      var g = ed.getGraph();
      if (!g.nodes.length) { edErr.textContent = 'Add at least one vertex: click on empty space.'; return; }
      if (g.nodes.length > M.LIMITS.nodes) { edErr.textContent = 'That is ' + g.nodes.length + ' vertices. Keep it to ' + M.LIMITS.nodes + ' or fewer so every step stays readable.'; return; }
      var edges = [], seen = {};
      g.edges.forEach(function (e) {
        var k = M.edgeKey(e.from, e.to);
        if (String(e.from) === String(e.to) || seen[k]) return;
        seen[k] = true;
        var w = Math.round(Number(e.weight === undefined || e.weight === null || e.weight === '' ? 5 : e.weight));
        if (!isFinite(w)) w = 5;
        edges.push({ u: String(e.from), v: String(e.to), w: Math.max(M.LIMITS.minW, Math.min(M.LIMITS.maxW, w)) });
      });
      if (edges.length > M.LIMITS.edges) { edErr.textContent = 'That is ' + edges.length + ' edges. Keep it to ' + M.LIMITS.edges + ' or fewer.'; return; }
      var ng = { nodes: g.nodes.map(function (n) { return { id: String(n.id), x: n.x, y: n.y }; }), edges: edges };
      closeEditor();
      input.field.value = M.toText(ng);
      input.setError('');
      setGraph(ng, null);
    });
    editor.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented && document.activeElement && !document.activeElement.closest('.vz')) closeEditor(); });
    L['lab_' + algo] = { player: player, setGraph: setGraph, view: view };
  }

  V.ready(function () {
    // the labs start lazily; register their predictions now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l30-kruskal-next', 'l30-prim-vertex', 'l30-prim-skip'].forEach(V.quizScore.register);
    L.lazy('#lab-kruskal', mstLab);
    L.lazy('#lab-prim', mstLab);
  });
}());
