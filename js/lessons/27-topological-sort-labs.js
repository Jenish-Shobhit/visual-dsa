/* Lesson 27 · Topological sort & cycles — part 2: the Kahn lab, the DFS lab, the SCC lab, flowcharts and the decision tree.
   Needs js/lessons/27-topological-sort.js (VDSA.L27) and js/algos/27-topological-sort.js (VDSA.algos.topo). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var T = V.algos.topo;
  var L = V.L27;

  /* ================================================================== code (labels tie lines across languages) */
  function kahnCode(pick) {
    var jsTake = { fifo: 'const u = ready.shift();', lifo: 'const u = ready.pop();', alpha: 'ready.sort(); const u = ready.shift();' }[pick];
    var pyTake = { fifo: 'u = ready.popleft()', lifo: 'u = ready.pop()', alpha: 'u = min(ready); ready.remove(u)' }[pick];
    var ps = { fifo: 'the oldest', lifo: 'the newest', alpha: 'the smallest' }[pick];
    return {
      pseudo: [
        'topoSort(graph)',
        '  indeg[v] ← number of arrows into v          // @init',
        '  ready ← every v with indeg[v] = 0           // @sources',
        '  order ← empty list',
        '  while ready is not empty',
        '    u ← take ' + ps + ' from ready       // @take',
        '    append u to order                          // @take',
        '    for each arrow u → v',
        '      indeg[v] ← indeg[v] − 1                  // @dec',
        '      if indeg[v] = 0: add v to ready          // @ready',
        '  if order has every vertex: return order      // @done',
        '  else: a cycle, the rest never reach 0        // @stuck'
      ].join('\n'),
      js: [
        'function topoSort(nodes, edges) {',
        '  const indeg = {}, out = {};',
        '  for (const v of nodes) { indeg[v] = 0; out[v] = []; }',
        '  for (const [u, v] of edges) { indeg[v]++; out[u].push(v); }  // @init',
        '  const ready = nodes.filter((v) => indeg[v] === 0);          // @sources',
        '  const order = [];',
        '  while (ready.length > 0) {',
        '    ' + jsTake + ' order.push(u);     // @take',
        '    for (const v of out[u]) {',
        '      indeg[v]--;                              // @dec',
        '      if (indeg[v] === 0) ready.push(v);       // @ready',
        '    }',
        '  }',
        '  if (order.length === nodes.length) return order;   // @done',
        '  return null; // a cycle: some vertices never reach 0  // @stuck',
        '}'
      ].join('\n'),
      py: [
        'from collections import deque',
        '',
        'def topo_sort(nodes, edges):',
        '    indeg = {v: 0 for v in nodes}',
        '    out = {v: [] for v in nodes}',
        '    for u, v in edges:                          # @init',
        '        indeg[v] += 1; out[u].append(v)         # @init',
        '    ready = deque(v for v in nodes if indeg[v] == 0)   # @sources',
        '    order = []',
        '    while ready:',
        '        ' + pyTake + '; order.append(u)      # @take',
        '        for v in out[u]:',
        '            indeg[v] -= 1                       # @dec',
        '            if indeg[v] == 0: ready.append(v)   # @ready',
        '    if len(order) == len(nodes): return order   # @done',
        '    return None  # a cycle: some never reach 0  # @stuck'
      ].join('\n')
    };
  }

  var DFS_CODE = {
    pseudo: [
      'topoSortDFS(graph)',
      '  color[v] ← white for every v; order ← empty list   // @init',
      '  for each vertex r, in name order',
      '    if color[r] = white: visit(r)                    // @scan',
      '  return order                                        // @done',
      '',
      'visit(u)',
      '  color[u] ← grey                                     // @enter',
      '  for each arrow u → v',
      '    if color[v] = grey: cycle, stop                   // @back',
      '    if color[v] = white: visit(v)                     // @edge',
      '  color[u] ← black                                    // @finish',
      '  put u at the FRONT of order                         // @finish'
    ].join('\n'),
    js: [
      'function topoSortDfs(adj) {',
      '  const color = {}, order = [];',
      '  for (const v in adj) color[v] = "white";          // @init',
      '  let cyclic = false;',
      '  function visit(u) {',
      '    color[u] = "grey";                               // @enter',
      '    for (const v of adj[u]) {',
      '      if (color[v] === "grey") { cyclic = true; return; }   // @back',
      '      if (color[v] === "white") visit(v);            // @edge',
      '      if (cyclic) return;',
      '    }',
      '    color[u] = "black";                              // @finish',
      '    order.unshift(u);                                // @finish',
      '  }',
      '  for (const r in adj) if (color[r] === "white") visit(r);   // @scan',
      '  return cyclic ? null : order;                      // @done',
      '}'
    ].join('\n'),
    py: [
      'def topo_sort_dfs(adj):',
      '    color = {v: "white" for v in adj}                # @init',
      '    order, cyclic = [], False',
      '    def visit(u):',
      '        nonlocal cyclic',
      '        color[u] = "grey"                            # @enter',
      '        for v in adj[u]:',
      '            if color[v] == "grey":                   # @back',
      '                cyclic = True; return                # @back',
      '            if color[v] == "white": visit(v)         # @edge',
      '            if cyclic: return',
      '        color[u] = "black"                           # @finish',
      '        order.insert(0, u)                           # @finish',
      '    for r in adj:                                    # @scan',
      '        if color[r] == "white": visit(r)             # @scan',
      '    return None if cyclic else order                 # @done'
    ].join('\n')
  };

  var SCC_CODE = {
    pseudo: [
      'kosaraju(graph)                                   // @init',
      '  pass 1: DFS over the graph; when a vertex',
      '    finishes, push it on the finish stack           // @enter1 @finish1',
      '  reverse every arrow                               // @flip',
      '  while the finish stack is not empty',
      '    u ← pop the top                                 // @pop',
      '    if u has no component yet:',
      '      DFS from u on the reversed graph;             // @visit',
      '      everything it reaches is one component        // @comp',
      '  contract each component to one vertex             // @condense'
    ].join('\n'),
    js: [
      'function kosaraju(adj) {',
      '  const seen = new Set(), stack = [];               // @init',
      '  const dfs1 = (u) => {',
      '    seen.add(u);                                    // @enter1',
      '    for (const v of adj[u]) if (!seen.has(v)) dfs1(v);   // @enter1',
      '    stack.push(u);                                  // @finish1',
      '  };',
      '  for (const u in adj) if (!seen.has(u)) dfs1(u);   // @enter1',
      '  const radj = reverse(adj);                        // @flip',
      '  const comp = {}, comps = [];',
      '  const dfs2 = (u, c) => {',
      '    comp[u] = c;                                    // @visit',
      '    for (const v of radj[u]) if (!(v in comp)) dfs2(v, c);   // @visit',
      '  };',
      '  while (stack.length > 0) {',
      '    const u = stack.pop();                          // @pop',
      '    if (!(u in comp)) {                             // @pop',
      '      dfs2(u, comps.length);                        // @visit',
      '      comps.push(membersOf(comp, comps.length));    // @comp',
      '    }',
      '  }',
      '  return contract(adj, comp, comps);                // @condense',
      '}'
    ].join('\n'),
    py: [
      'def kosaraju(adj):',
      '    seen, stack = set(), []                         # @init',
      '    def dfs1(u):',
      '        seen.add(u)                                 # @enter1',
      '        for v in adj[u]:                            # @enter1',
      '            if v not in seen: dfs1(v)               # @enter1',
      '        stack.append(u)                             # @finish1',
      '    for u in adj:                                   # @enter1',
      '        if u not in seen: dfs1(u)                   # @enter1',
      '    radj = reverse(adj)                             # @flip',
      '    comp, comps = {}, []',
      '    def dfs2(u, c):',
      '        comp[u] = c                                 # @visit',
      '        for v in radj[u]:                           # @visit',
      '            if v not in comp: dfs2(v, c)            # @visit',
      '    while stack:',
      '        u = stack.pop()                             # @pop',
      '        if u not in comp:                           # @pop',
      '            dfs2(u, len(comps))                     # @visit',
      '            comps.append(members_of(comp, len(comps)))   # @comp',
      '    return contract(adj, comp, comps)               # @condense'
    ].join('\n')
  };

  /* ================================================================== flowchart specs (ids = step.flow) */
  var FLOW_KAHN = {
    nodes: [
      { id: 'init', type: 'start', text: 'indeg[v] ← arrows into v', col: 1, row: 0 },
      { id: 'sources', text: 'ready ← every v\nwith indeg 0', col: 1, row: 1 },
      { id: 'empty', type: 'decision', text: 'ready empty?', col: 1, row: 2 },
      { id: 'all', type: 'decision', text: 'all V placed?', col: 2, row: 2 },
      { id: 'cycle', type: 'end', text: 'cycle: no order', col: 2, row: 1, maxWidth: 130 },
      { id: 'ok', type: 'end', text: 'return the order', col: 2, row: 3, maxWidth: 130 },
      { id: 'take', text: 'u ← take from ready\nappend u to order', col: 1, row: 3 },
      { id: 'more', type: 'decision', text: 'next arrow u → v?', col: 1, row: 4 },
      { id: 'dec', text: 'indeg[v] ← indeg[v] − 1', col: 1, row: 5 },
      { id: 'zero', type: 'decision', text: 'indeg[v] = 0?', col: 1, row: 6 },
      { id: 'push', text: 'add v to ready', col: 1, row: 7 }
    ],
    edges: [
      { from: 'init', to: 'sources' },
      { from: 'sources', to: 'empty' },
      { from: 'empty', to: 'all', label: 'yes' },
      { from: 'empty', to: 'take', label: 'no' },
      { from: 'all', to: 'ok', label: 'yes' },
      { from: 'all', to: 'cycle', label: 'no' },
      { from: 'take', to: 'more' },
      { from: 'more', to: 'dec', label: 'yes' },
      { from: 'more', to: 'empty', label: 'no', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'dec', to: 'zero' },
      { from: 'zero', to: 'push', label: 'yes' },
      { from: 'zero', to: 'more', label: 'no', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'push', to: 'more', via: { fromSide: 'left', toSide: 'left' } }
    ]
  };
  var FLOW_DFS = {
    nodes: [
      { id: 'init', type: 'start', text: 'all vertices white\norder ← [ ]', col: 1, row: 0 },
      { id: 'scan', text: 'next white vertex r:\nvisit(r)', col: 1, row: 1 },
      { id: 'done', type: 'end', text: 'none left: return order', col: 0, row: 1, maxWidth: 130 },
      { id: 'enter', text: 'u ← grey', col: 1, row: 2 },
      { id: 'more', type: 'decision', text: 'next arrow u → v?', col: 1, row: 3 },
      { id: 'finish', text: 'u ← black\nput u at front', col: 2, row: 3 },
      { id: 'grey', type: 'decision', text: 'v is grey?', col: 1, row: 4 },
      { id: 'back', type: 'end', text: 'cycle: stop', col: 0, row: 4, maxWidth: 110 },
      { id: 'white', type: 'decision', text: 'v is white?', col: 1, row: 5 },
      { id: 'edge', text: 'visit(v): dive', col: 2, row: 5 },
      { id: 'skip', text: 'v is black:\nignore', col: 0, row: 5 }
    ],
    edges: [
      { from: 'init', to: 'scan' },
      { from: 'scan', to: 'enter', label: 'found' },
      { from: 'scan', to: 'done', label: 'none' },
      { from: 'enter', to: 'more' },
      { from: 'more', to: 'grey', label: 'yes' },
      { from: 'more', to: 'finish', label: 'no' },
      { from: 'grey', to: 'back', label: 'yes' },
      { from: 'grey', to: 'white', label: 'no' },
      { from: 'white', to: 'edge', label: 'yes' },
      { from: 'white', to: 'skip', label: 'no' },
      { from: 'edge', to: 'enter', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'skip', to: 'more', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'finish', to: 'scan', via: { fromSide: 'top', toSide: 'right' } }
    ]
  };
  var FLOW_SCC = {
    nodes: [
      { id: 'enter1', type: 'start', text: 'pass 1: enter a vertex,\nfollow arrows to new ones', col: 1, row: 0, maxWidth: 190 },
      { id: 'finish1', text: 'vertex finishes:\npush on the finish stack', col: 1, row: 1, maxWidth: 190 },
      { id: 'flip', text: 'reverse every arrow', col: 1, row: 2 },
      { id: 'empty', type: 'decision', text: 'finish stack empty?', col: 1, row: 3 },
      { id: 'condense', type: 'end', text: 'contract each component: the condensation DAG', col: 2, row: 3, maxWidth: 150 },
      { id: 'pop', text: 'u ← pop the top', col: 1, row: 4 },
      { id: 'visit', text: 'DFS from u on the\nreversed graph', col: 1, row: 5 },
      { id: 'comp', text: 'everything reached\nis one component', col: 1, row: 6 }
    ],
    edges: [
      { from: 'enter1', to: 'finish1' },
      { from: 'finish1', to: 'enter1', label: 'more', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'finish1', to: 'flip', label: 'done' },
      { from: 'flip', to: 'empty' },
      { from: 'empty', to: 'condense', label: 'yes' },
      { from: 'empty', to: 'pop', label: 'no' },
      { from: 'pop', to: 'visit' },
      { from: 'visit', to: 'comp' },
      { from: 'comp', to: 'empty', via: { fromSide: 'left', toSide: 'left' } }
    ]
  };

  /* ================================================================== graph presets and the shared input row */
  function toText(g) {
    var used = {};
    var parts = g.edges.map(function (e) { used[e[0]] = used[e[1]] = true; return e[0] + '>' + e[1]; });
    g.nodes.forEach(function (n) { if (!used[n.id]) parts.push(n.id); });
    return parts.join(', ');
  }
  function fromText(text, seed) {
    var p = T.parseEdgeList(text);
    var edges = p.values.edges.map(function (e) { return { from: e[0], to: e[1] }; });
    var pos = V.views.graph.layouts.force(p.values.nodes, edges.filter(function (e) { return e.from !== e.to; }), { w: 1000, h: 600, pad: 90, seed: seed || 3 });
    return { nodes: p.values.nodes.map(function (id) { return { id: id, x: pos[id].x, y: pos[id].y }; }), edges: p.values.edges, directed: true };
  }
  var PRESETS = [
    { label: 'Course graph', g: L.COURSES },
    { label: 'Diamond', g: fromText('A>B, A>C, B>D, C>D', 4) },
    { label: 'Long chain', g: fromText('A>B>C>D>E>F', 2) },
    { label: 'Wide fan', g: fromText('S>A, S>B, S>C, S>D, A>T, B>T, C>T, D>T', 6) },
    { label: 'No dependencies', g: fromText('A, B, C, D, E', 1) },
    { label: 'Cycle behind a start', g: fromText('S>A, A>B, B>C, C>D, D>B, D>E', 8) },
    { label: 'Ring', g: fromText('A>B>C>A', 1) }
  ];

  /* Custom input: an edge list ("A>B, B>C>D"), with presets that carry hand-made layouts. onGraph(g) is called on every change. */
  function graphInput(host, current, onGraph, opt) {
    opt = opt || {};
    var pending = null;
    function layoutFor(parsed) {
      var old = {};
      current().nodes.forEach(function (n) { old[n.id] = n; });
      var keep = parsed.nodes.filter(function (id) { return old[id]; });
      var nodes = parsed.nodes.map(function (id) { return old[id] ? { id: id, x: old[id].x, y: old[id].y, fixed: true } : { id: id }; });
      var edges = parsed.edges.filter(function (e) { return e[0] !== e[1]; }).map(function (e) { return { from: e[0], to: e[1] }; });
      var pos = V.views.graph.layouts.force(keep.length ? nodes : parsed.nodes, edges, { w: 1000, h: 600, pad: 90, seed: 5 });
      return { nodes: parsed.nodes.map(function (id) { var p = pos[id] || old[id]; return { id: id, x: p.x, y: p.y }; }), edges: parsed.edges, directed: true };
    }
    var input = V.inputRow(host, {
      label: 'Dependencies (up to 12 vertices)',
      value: toText(current()),
      placeholder: 'e.g. A>B, A>C, B>D, C>D, E',
      parse: function (text) { return T.parseEdgeList(text); },
      presets: (opt.presets || PRESETS).map(function (p) { return { label: p.label, value: function () { pending = p; return toText(p.g); } }; }),
      hint: 'A>B means A must come before B. B>C>D chains, a lone name is a task with no dependencies.',
      onApply: function (parsed) {
        var p = pending;
        pending = null;
        if (p && toText(p.g) === input.field.value) onGraph(p.g);
        else onGraph(layoutFor(parsed));
      }
    });
    return input;
  }

  function raw(x) { return x === undefined || x === null ? null : V.vars.raw(String(x)); }
  function list(a) { return V.vars.raw('[' + (a || []).join(', ') + ']'); }

  /* ================================================================== Kahn's lab */
  function kahnLab(fig) {
    var G = L.COURSES, pick = 'fifo';
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { directed: true, allowSelfLoops: true, bounds: { w: 1000, h: 600 }, minRadius: 20, uniformLabels: true, maxHeight: 430, label: 'Kahn lab graph' });
    var box = fig.querySelector('[data-container]'), qHost = h('div'), sHost = h('div');
    box.appendChild(qHost); box.appendChild(sHost);
    var qv = V.views.queue(qHost, { cellSize: 36, label: 'Ready set (queue)' });
    var sv = V.views.stack(sHost, { orientation: 'horizontal', cellSize: 36, label: 'Ready set (stack)' });
    var strip = L.strip(fig.querySelector('[data-strip]'), { label: 'Order so far', empty: 'nothing placed yet' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: kahnCode(pick), default: 'pseudo', title: 'kahn', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', v: 'compare', ready: 'frontier', order: 'done' } });
    var panelTitle = fig.querySelector('[data-panel-title]');
    var layered = L.layeredPos(G);

    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Waiting (badge = in-degree)' }, { state: 'frontier', label: 'Ready (in-degree 0)' },
      { state: 'active', label: 'Being placed' }, { state: 'done', label: 'Placed' },
      { state: 'error', label: 'Stuck on the cycle' }, { state: 'compare', label: 'Stuck behind it' }, { state: 'compare', shape: 'line', label: 'Arrow being removed' }, { state: 'muted', shape: 'line', label: 'Arrow removed' }
    ]);

    // the flowchart lives in its own figure, driven by this lab
    var flowFig = V.$('#fig-flow-kahn');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_KAHN, { label: 'Kahn algorithm decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    function normalize(steps) {
      return steps.map(function (st) {
        var o = Object.assign({}, st), vv = st.vars || {};
        o.vars = { u: raw(vv.u), v: raw(vv.v), 'indeg[v]': vv['indeg[v]'] === undefined ? null : vv['indeg[v]'], ready: list(st.ready), order: list(st.order) };
        return o;
      });
    }
    function generate() {
      var steps = normalize(T.kahn(L.plain(G), { pick: pick }));
      qv.reset(); sv.reset();
      var states = steps.map(function (x) { return L.readyState(x); });
      if (pick === 'lifo') sv.prepare(states); else qv.prepare(states);
      layered = L.layeredPos(G);
      return steps;
    }
    function showPick() {
      qHost.hidden = pick === 'lifo'; sHost.hidden = pick !== 'lifo';
      panelTitle.textContent = { fifo: 'Ready set: queue', lifo: 'Ready set: stack', alpha: 'Ready set: smallest first' }[pick];
      code.setSource(kahnCode(pick));
    }
    function render(step, ctx) {
      view.render(L.gs(G, step, { badge: 'indeg', sub: 'pos', pos: step.layered ? layered : null }), { duration: ctx.duration });
      if (pick === 'lifo') sv.render(L.readyState(step), { duration: ctx.duration });
      else qv.render(L.readyState(step), { duration: ctx.duration });
      strip(step.order, ctx.duration, { newest: step.kind === 'take' ? step.current : null });
    }
    showPick();
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { emitted: 'Vertices placed', removed: 'Arrows removed', ready: 'Ready set size' },
      counterStates: { emitted: 'done', ready: 'frontier' },
      baseStepMs: 1000, label: 'Kahn lab controls'
    });

    player.addCheckpoint(function (steps) {
      for (var i = 2; i < steps.length; i++) if (steps[i].kind === 'take' && steps[i - 1].ready.length >= 2) return i;
      return -1;
    }, function (c) {
      var p = c.prev, r = p.ready.slice(), u = c.step.current;
      var waiting = Object.keys(p.states).filter(function (id) { return p.states[id] === 'default'; }).sort(T.natCmp)[0];
      var opts = r.slice();
      if (waiting && opts.indexOf(waiting) === -1) opts.push(waiting);
      var rule = { fifo: 'the one that has waited longest (the queue’s front)', lifo: 'the one added most recently (the stack’s top)', alpha: 'the smallest name' }[pick];
      return {
        question: 'The ready set holds <code>' + r.join(' ') + '</code> (leftmost first). Kahn’s rule here is “take ' + rule + '”. Which vertex is placed next?',
        options: opts.map(function (x) { return '<b>' + x + '</b>'; }), answer: opts.indexOf(u),
        explain: opts.map(function (x) {
          if (x === u) return x + ' is the one the rule picks. It has in-degree 0, so every prerequisite is already placed.';
          if (r.indexOf(x) !== -1) return x + ' is ready too, so it is a valid choice in general, but this rule picks ' + u + ' first. Any ready vertex gives a valid order; the rule only decides which.';
          return x + ' still has in-degree ' + p.indeg[x] + ': something it waits for is not placed yet, so it is not in the ready set at all.';
        })
      };
    }, { id: 'lab-kahn-next' });

    function reload() { player.setSteps(generate()); }
    graphInput(fig.querySelector('[data-input]'), function () { return G; }, function (g) { G = g; view.resetPositions && view.resetPositions(); reload(); });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Which ready vertex to take', value: pick,
      options: [{ value: 'fifo', label: 'Oldest (queue)' }, { value: 'lifo', label: 'Newest (stack)' }, { value: 'alpha', label: 'Smallest name' }],
      onChange: function (v) { pick = v; showPick(); reload(); }
    });
  }

  /* ================================================================== DFS lab */
  function dfsLab(fig) {
    var G = L.COURSES;
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { directed: true, allowSelfLoops: true, bounds: { w: 1000, h: 600 }, minRadius: 20, uniformLabels: true, maxHeight: 430, label: 'DFS lab graph' });
    var strip = L.strip(fig.querySelector('[data-strip]'), { label: 'Answer so far, front first', empty: 'nothing finished yet' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: DFS_CODE, default: 'pseudo', title: 'dfs', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', v: 'compare', stack: 'frontier', order: 'done' } });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'White: unseen' },
      { state: 'default', color: 'color-mix(in srgb, var(--ink) 30%, var(--el-fill))', label: 'Grey: on the route' },
      { state: 'default', color: 'var(--ink)', label: 'Black: finished' },
      { state: 'active', label: 'Current vertex' },
      { state: 'visited', shape: 'line', label: 'Tree edge' }, { state: 'error', shape: 'line', label: 'Back edge: cycle' }
    ]);
    var flowFig = V.$('#fig-flow-dfs');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_DFS, { label: 'DFS topological sort decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    function normalize(steps) {
      return steps.map(function (st) {
        var o = Object.assign({}, st), vv = st.vars || {};
        o.vars = { u: raw(vv.u), v: raw(vv.v), 'color[v]': raw(vv['color[v]']), stack: list(st.stack), order: list(st.order), time: st.time === undefined ? vv.time : st.time };
        return o;
      });
    }
    function generate() { return normalize(T.dfsTopo(L.plain(G))); }
    function render(step, ctx) {
      view.render(L.gs(G, step, { sub: 'times' }), { duration: ctx.duration });
      strip(step.order, ctx.duration, { newest: step.kind === 'finish' ? step.finished[step.finished.length - 1] : null });
    }
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { finished: 'Vertices finished', checks: 'Arrows examined', depth: 'Route length (grey)' },
      counterStates: { finished: 'done', depth: 'frontier' },
      baseStepMs: 1000, label: 'DFS lab controls'
    });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'skip' || steps[i].kind === 'back') return i;
      return -1;
    }, function (c) {
      var nx = c.step, u = nx.pulse.from, v = nx.pulse.to;
      var ans = nx.kind === 'back' ? 1 : 2;
      return {
        question: 'DFS is at <b>' + u + '</b> and looks along the arrow <b>' + u + ' → ' + v + '</b>. Look at the colour of ' + v + '. What happens?',
        options: ['Dive into ' + v + ' and colour it grey', 'Cycle found: stop, no order exists', 'Ignore the arrow: ' + v + ' is already finished'],
        answer: ans,
        explain: [
          v + ' is not white, so there is nothing new to explore there.',
          nx.kind === 'back' ? v + ' is grey: it is on the route that led to ' + u + ', so ' + u + ' depends on something that depends on ' + u + '. That is a cycle.' : v + ' is black, not grey. A black vertex is finished, so no route from it can return to ' + u + '.',
          nx.kind === 'skip' ? v + ' is black: it and everything after it are finished and already in the answer, so ' + u + ' will land in front of it. Nothing to do.' : v + ' is grey, not black. A grey vertex is still being explored, so this arrow closes a loop.'
        ]
      };
    }, { id: 'lab-dfs-edge' });

    function reload() { player.setSteps(generate()); }
    graphInput(fig.querySelector('[data-input]'), function () { return G; }, function (g) { G = g; view.resetPositions && view.resetPositions(); reload(); });
  }

  /* ================================================================== SCC lab (Kosaraju) */
  var SCC_PRESETS = [
    { label: 'Three knots', g: L.graph(
      [['A', 110, 150], ['B', 280, 300], ['C', 100, 430], ['D', 470, 160], ['E', 610, 320], ['F', 440, 450], ['G', 820, 130], ['H', 880, 320], ['I', 800, 510]],
      [['A', 'B'], ['B', 'C'], ['C', 'A'], ['B', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'D'], ['F', 'G'], ['G', 'H'], ['H', 'G'], ['F', 'I'], ['C', 'I']]) },
    { label: 'Already a DAG', g: L.COURSES },
    { label: 'One big cycle', g: fromText('A>B>C>D>A', 2) },
    { label: 'Two loops, one bridge', g: fromText('A>B, B>A, B>C, C>D, D>C, D>E', 5) },
    { label: 'Tangled', g: fromText('A>B, B>C, C>A, C>D, D>E, E>F, F>D, B>E, F>G, G>H, H>G', 9) }
  ];
  function sccLab(fig) {
    var G = SCC_PRESETS[0].g;
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { directed: true, allowSelfLoops: true, bounds: { w: 1000, h: 600 }, nodeRadius: 26, minRadius: 20, uniformLabels: true, maxHeight: 430, label: 'Strongly connected components lab graph' });
    var stripTitle = fig.querySelector('[data-strip-title]');
    var strip = L.strip(fig.querySelector('[data-strip]'), { label: 'Finish stack', empty: 'empty' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: SCC_CODE, default: 'pseudo', title: 'scc', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', finishStack: 'frontier' } });
    var cache = null;
    var flowFig = V.$('#fig-flow-scc');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_SCC, { label: 'Kosaraju algorithm decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    function prep() {
      var plain = L.plain(G), steps = T.kosaraju(plain), end = L.last(steps);
      var cond = end.condensation, cpos = null, centroid = {}, cluster = {};
      if (cond) {
        G.nodes.forEach(function (n) { });
        var compOf = {};
        cond.nodes.forEach(function (c) { c.members.forEach(function (m) { compOf[m] = c.id; }); });
        cond.nodes.forEach(function (c) {
          var pts = c.members.map(function (m) { return G.nodes.filter(function (n) { return n.id === m; })[0]; });
          var cx = pts.reduce(function (a, p) { return a + p.x; }, 0) / pts.length, cy = pts.reduce(function (a, p) { return a + p.y; }, 0) / pts.length;
          centroid[c.id] = { x: cx, y: cy };
          c.members.forEach(function (m, i) {
            var k = c.members.length, ang = -Math.PI / 2 + (2 * Math.PI * i) / k;
            cluster[m] = k === 1 ? { x: cx, y: cy } : { x: cx + Math.cos(ang) * (k === 2 ? 34 : 58), y: cy + Math.sin(ang) * (k === 2 ? 34 : 58) };
          });
        });
        var ids = cond.nodes.map(function (c) { return c.id; });
        cpos = V.views.graph.layouts.layered(ids, cond.edges.map(function (e) { return { from: e[0], to: e[1] }; }), { direction: 'LR', w: 1000, h: 600, pad: 110, sweeps: 8 });
      }
      cache = { centroid: centroid, cluster: cluster, cpos: cpos };
      return steps.map(function (st) {
        var o = Object.assign({}, st), vv = st.vars || {};
        o.vars = { phase: vv.phase, u: raw(vv.u), finishStack: list(vv.finishStack), components: vv.components };
        return o;
      });
    }
    function render(step, ctx) {
      var d = ctx.duration;
      if (step.phase === 3 && step.stage !== 'gather') {
        var cond = step.condensation, pos = step.stage === 'layout' ? cache.cpos : cache.centroid;
        var nodes = cond.nodes.map(function (c, i) {
          return { id: c.id, x: pos[c.id].x, y: pos[c.id].y, state: L.ccState(i + 1), label: c.id, sub: c.members.join(' ') };
        });
        var edges = cond.edges.map(function (e) { return { id: e[0] + '-' + e[1], from: e[0], to: e[1], directed: true, state: step.stage === 'layout' ? 'done' : 'default' }; });
        view.render({ nodes: nodes, edges: edges }, { duration: d });
      } else {
        view.render(L.gs(G, step, {
          sub: 'fin', pos: step.phase === 3 ? cache.cluster : null,
          mapNode: function (node) { if (step.phase === 2 && step.current === node.id) node.state = 'active'; },
          mapEdge: function (e) {
            if (step.transposed) { var t = e.from; e.from = e.to; e.to = t; }
            if (step.phase === 3 && step.stage === 'gather') { var cf = step.comp[e.from], ct = step.comp[e.to]; e.state = cf === ct ? 'default' : 'muted'; }
          }
        }), { duration: d });
      }
      var items, title, opts = { newest: null };
      if (step.phase === 1) { items = step.finished; title = 'Finish stack (top on the right)'; opts.newest = step.kind === 'finish' ? L.last(step.finished) : null; }
      else if (step.phase === 2) { items = step.remaining; title = 'Finish stack, popped from the right'; }
      else { items = step.condensation && step.stage === 'layout' ? step.condensation.order : step.comps.map(function (c, i) { return 'C' + (i + 1); }); title = step.stage === 'layout' ? 'Topological order of the components' : 'Components found'; }
      stripTitle.textContent = title;
      strip(items, d, opts);
    }
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Not in a component yet' }, { state: 'default', color: 'color-mix(in srgb, var(--ink) 30%, var(--el-fill))', label: 'Pass 1: grey' }, { state: 'default', color: 'var(--ink)', label: 'Pass 1: black' },
      { state: 'active', label: 'Being expanded' }, { state: 'default', color: 'var(--u1)', label: 'Component 1' }, { state: 'default', color: 'var(--u2)', label: 'Component 2' }, { state: 'default', color: 'var(--u3)', label: 'Component 3 …' }
    ]);
    var player = V.player({
      root: fig, steps: prep(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { components: 'Components found', visited: 'Vertex visits', finished: 'Finished (pass 1)' },
      counterStates: { components: 'done', finished: 'visited' },
      baseStepMs: 1000, label: 'SCC lab controls'
    });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'take') return i;
      return -1;
    }, function (c) {
      var p = c.prev, r = p.remaining.slice(), top = r[r.length - 1];
      var opts = [top];
      if (r.length > 1 && opts.indexOf(r[0]) === -1) opts.push(r[0]);
      if (r.length > 2 && opts.indexOf(r[Math.floor(r.length / 2)]) === -1) opts.push(r[Math.floor(r.length / 2)]);
      if (opts.length < 2) return null;
      return {
        question: 'Pass 1 is over and the finish stack is <code>' + r.join(' ') + '</code> (last finished on the right). Pass 2 pops a vertex to start the first component. Which one?',
        options: opts.map(function (x) { return '<b>' + x + '</b>'; }), answer: 0,
        explain: [
          top + ' finished last in pass 1, so it sits on top of the stack. The vertex that finishes last lies in a component that no other component points into, so walking backwards from it cannot escape its own component.',
          r[0] + ' finished first, which is the worst place to start: it can be in a component that other components point into, and the reversed walk would leak into them.'
        ].concat(opts.length > 2 ? [opts[2] + ' is in the middle of the stack. Pass 2 always takes the top: the latest finisher.'] : [])
      };
    }, { id: 'lab-scc-pop' });

    function reload() { player.setSteps(prep()); }
    graphInput(fig.querySelector('[data-input]'), function () { return G; }, function (g) { G = g; view.resetPositions && view.resetPositions(); reload(); }, { presets: SCC_PRESETS });
  }

  /* ================================================================== which tool? (interactive decision tree) */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Need a dependency order?', col: 0, row: 0 },
      { id: 'q5', type: 'decision', text: 'Need the knots of mutual dependence?', col: 1, row: 0, maxWidth: 150 },
      { id: 'q2', type: 'decision', text: 'Parallel rounds or a rule for ties?', col: 0, row: 1, maxWidth: 150 },
      { id: 'kahn1', type: 'end', text: 'Kahn’s algorithm', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Very deep graph?', col: 0, row: 2 },
      { id: 'kahn2', type: 'end', text: 'Kahn (no recursion)', col: 1, row: 2 },
      { id: 'dfs', type: 'end', text: 'DFS finish order', col: 0, row: 3 },
      { id: 'scc', type: 'end', text: 'SCC: Kosaraju or Tarjan', col: 2, row: 0, maxWidth: 120 },
      { id: 'other', type: 'end', text: 'A plain BFS / DFS or shortest path', col: 2, row: 1, maxWidth: 130 }
    ],
    edges: [
      { from: 'q1', to: 'q2', label: 'yes' }, { from: 'q1', to: 'q5', label: 'no' },
      { from: 'q5', to: 'scc', label: 'yes' }, { from: 'q5', to: 'other', label: 'no' },
      { from: 'q2', to: 'kahn1', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'kahn2', label: 'yes' }, { from: 'q3', to: 'dfs', label: 'no' }
    ]
  };
  var CHOOSE_TEXT = {
    q1: 'Start here. Do you have tasks with “A before B” rules, and need a line-up that respects all of them? Pick <b>yes</b> or <b>no</b> on the lit question (click a label, or Tab to it and press Enter).',
    q2: 'Would you like to know which tasks can run <em>at the same time</em> (each round is one Kahn wave), or do you need a specific tie-break, such as “smallest name first”?',
    q3: 'Both methods are linear. Is the longest chain of dependencies thousands of tasks long, so that recursion could overflow the call stack?',
    q5: 'No ordering needed. But maybe the graph has cycles and you want to know which vertices depend on each other in a loop: the strongly connected components.',
    kahn1: '<b>Kahn’s algorithm.</b> The ready set is a natural place to add a rule (queue, stack, smallest first), and each wave of the queue is a set of tasks that can run in parallel.',
    kahn2: '<b>Kahn’s algorithm.</b> It uses a loop and a list, not recursion, so depth is not a problem.',
    dfs: '<b>DFS finish order.</b> One recursive function and a list: the shortest code. Reverse the finish order, and watch for a back edge (a grey vertex) as the cycle alarm.',
    scc: '<b>Kosaraju or Tarjan.</b> Both find the strongly connected components in O(V + E). Contract them and you get a DAG you can topologically sort.',
    other: '<b>Not this lesson.</b> With no ordering and no cycles to untangle, reach for BFS or DFS (lesson 26), or shortest paths (lessons 28 and 29).'
  };
  function chooseFigure(fig) {
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which ordering tool decision tree' });
    var cap = fig.querySelector('[data-caption]');
    var path, taken;
    function reset() {
      path = ['q1']; taken = {};
      view.render({ active: 'q1' }, { duration: 0 });
      cap.innerHTML = CHOOSE_TEXT.q1;
    }
    view.on('choose', function (e) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      var end = CHOOSE.nodes.some(function (n) { return n.id === e.to && n.type === 'end'; });
      var states = {};
      if (end) states[e.to] = 'found';
      view.render({ active: e.to, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: states }, { duration: 500 });
      cap.innerHTML = CHOOSE_TEXT[e.to] + (end ? ' Press “Start over” to try another route.' : '');
    });
    fig.querySelector('[data-restart]').addEventListener('click', reset);
    reset();
  }

  V.ready(function () {
    L.lazy('#lab-kahn', kahnLab);
    L.lazy('#lab-dfs', dfsLab);
    L.lazy('#lab-scc', sccLab);
    L.lazy('#fig-choose', chooseFigure);
  });
  L.CODE = { kahn: kahnCode, dfs: DFS_CODE, scc: SCC_CODE };
}());
