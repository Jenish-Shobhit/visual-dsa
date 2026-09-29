/* Lesson 26 · BFS & DFS — part 2: the graph lab (with editor), the grid lab, and the flowcharts.
   Needs js/lessons/26-bfs-and-dfs.js (VDSA.L26) and js/algos/26-bfs-and-dfs.js (VDSA.algos.graphSearch). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var GS = V.algos.graphSearch;
  var L = V.L26;

  /* ================================================================== code (labels tie lines across languages) */
  var CODE = {
    bfs: {
      pseudo: [
        'BFS(graph, s, target)',
        '  dist[s] ← 0; parent[s] ← none        // @init',
        '  queue ← [s]                          // @init',
        '  while queue is not empty             // @loop',
        '    u ← dequeue(queue)                 // @dequeue',
        '    if u = target                      // @found',
        '      return the path back via parent  // @found',
        '    for each neighbour v of u          // @neighbors',
        '      if v has no distance yet         // @check',
        '        dist[v] ← dist[u] + 1          // @discover',
        '        parent[v] ← u                  // @discover',
        '        enqueue(queue, v)              // @discover',
        '  return dist                          // @done'
      ].join('\n'),
      js: [
        'function bfs(adj, s, target) {',
        '  const dist = new Map([[s, 0]]);                // @init',
        '  const parent = new Map([[s, null]]);           // @init',
        '  const queue = [s];                             // @init',
        '  while (queue.length > 0) {                     // @loop',
        '    const u = queue.shift();                     // @dequeue',
        '    if (u === target) return pathTo(parent, u);  // @found',
        '    for (const v of adj[u]) {                    // @neighbors',
        '      if (!dist.has(v)) {                        // @check',
        '        dist.set(v, dist.get(u) + 1);            // @discover',
        '        parent.set(v, u);                        // @discover',
        '        queue.push(v);                           // @discover',
        '      }',
        '    }',
        '  }',
        '  return dist;                                   // @done',
        '}'
      ].join('\n'),
      py: [
        'from collections import deque',
        '',
        'def bfs(adj, s, target=None):',
        '    dist = {s: 0}                       # @init',
        '    parent = {s: None}                  # @init',
        '    queue = deque([s])                  # @init',
        '    while queue:                        # @loop',
        '        u = queue.popleft()             # @dequeue',
        '        if u == target:                 # @found',
        '            return path_to(parent, u)   # @found',
        '        for v in adj[u]:                # @neighbors',
        '            if v not in dist:           # @check',
        '                dist[v] = dist[u] + 1   # @discover',
        '                parent[v] = u           # @discover',
        '                queue.append(v)         # @discover',
        '    return dist                         # @done'
      ].join('\n')
    },
    dfs: {
      pseudo: [
        'DFS(graph, s, target)',
        '  time ← 0',
        '  visit(s)                             // @call',
        '',
        'visit(u)',
        '  mark u seen; time ← time + 1         // @enter',
        '  d[u] ← time                          // @enter',
        '  if u = target: stop (stack = route)  // @found',
        '  for each neighbour v of u            // @neighbors',
        '    if v is not seen                   // @check',
        '      parent[v] ← u; visit(v)          // @recurse',
        '  time ← time + 1; f[u] ← time         // @finish'
      ].join('\n'),
      js: [
        'function dfs(adj, s, target) {',
        '  const seen = new Set(), d = {}, f = {}, parent = { [s]: null };',
        '  let time = 0;',
        '  function visit(u) {',
        '    seen.add(u); d[u] = ++time;             // @enter',
        '    if (u === target) return true;          // @found',
        '    for (const v of adj[u]) {               // @neighbors',
        '      if (!seen.has(v)) {                   // @check',
        '        parent[v] = u;                      // @recurse',
        '        if (visit(v)) return true;          // @recurse',
        '      }',
        '    }',
        '    f[u] = ++time;                          // @finish',
        '    return false;                           // @finish',
        '  }',
        '  visit(s);                                 // @call',
        '  return { d, f, parent };',
        '}'
      ].join('\n'),
      py: [
        'def dfs(adj, s, target=None):',
        '    seen, d, f, parent = set(), {}, {}, {s: None}',
        '    time = 0',
        '    def visit(u):',
        '        nonlocal time',
        '        seen.add(u); time += 1; d[u] = time   # @enter',
        '        if u == target: return True           # @found',
        '        for v in adj[u]:                      # @neighbors',
        '            if v not in seen:                 # @check',
        '                parent[v] = u                 # @recurse',
        '                if visit(v): return True      # @recurse',
        '        time += 1; f[u] = time                # @finish',
        '        return False                          # @finish',
        '    visit(s)                                  # @call',
        '    return d, f, parent'
      ].join('\n')
    },
    gridbfs: {
      pseudo: [
        'gridBFS(grid, S, T)',
        '  dist[S] ← 0; queue ← [S]                  // @init',
        '  while queue is not empty                  // @loop',
        '    cell ← dequeue(queue)                   // @dequeue',
        '    if cell = T: return path via parents    // @found',
        '    for step in up, right, down, left       // @neighbors',
        '      next ← cell + step',
        '      if next is open and has no distance   // @check',
        '        dist[next] ← dist[cell] + 1         // @discover',
        '        parent[next] ← cell                 // @discover',
        '        enqueue(queue, next)                // @discover',
        '  return "no path"                          // @none'
      ].join('\n'),
      js: [
        'function gridBfs(grid, S, T) {',
        '  const dist = { [S]: 0 }, parent = {}, queue = [S];   // @init',
        '  while (queue.length > 0) {                          // @loop',
        '    const cell = queue.shift();                       // @dequeue',
        '    if (cell === T) return pathTo(parent, T);         // @found',
        '    for (const next of openNeighbours(grid, cell)) {  // @neighbors',
        '      if (!(next in dist)) {                          // @check',
        '        dist[next] = dist[cell] + 1;                  // @discover',
        '        parent[next] = cell;                          // @discover',
        '        queue.push(next);                             // @discover',
        '      }',
        '    }',
        '  }',
        '  return null;  // no path                            // @none',
        '}'
      ].join('\n'),
      py: [
        'def grid_bfs(grid, S, T):',
        '    dist, parent, queue = {S: 0}, {}, deque([S])     # @init',
        '    while queue:                                     # @loop',
        '        cell = queue.popleft()                       # @dequeue',
        '        if cell == T: return path_to(parent, T)      # @found',
        '        for nxt in open_neighbours(grid, cell):      # @neighbors',
        '            if nxt not in dist:                      # @check',
        '                dist[nxt] = dist[cell] + 1           # @discover',
        '                parent[nxt] = cell                   # @discover',
        '                queue.append(nxt)                    # @discover',
        '    return None  # no path                           # @none'
      ].join('\n')
    },
    griddfs: {
      pseudo: [
        'gridDFS(grid, S, T)',
        '  stack ← [S]; mark S seen                    // @init',
        '  while stack is not empty                    // @loop',
        '    cell ← top(stack)                         // @top',
        '    if cell = T: return stack (the route)     // @found',
        '    next ← first open, unseen neighbour       // @pick',
        '    if next exists: mark it, push(stack, next) // @push',
        '    else: pop(stack)   (dead end: back up)    // @pop',
        '  return "no path"                            // @none'
      ].join('\n'),
      js: [
        'function gridDfs(grid, S, T) {',
        '  const stack = [S], seen = new Set([S]);           // @init',
        '  while (stack.length > 0) {                        // @loop',
        '    const cell = stack[stack.length - 1];           // @top',
        '    if (cell === T) return stack;                   // @found',
        '    const next = openNeighbours(grid, cell)',
        '      .find((n) => !seen.has(n));                   // @pick',
        '    if (next) { seen.add(next); stack.push(next); } // @push',
        '    else stack.pop();                               // @pop',
        '  }',
        '  return null;                                      // @none',
        '}'
      ].join('\n'),
      py: [
        'def grid_dfs(grid, S, T):',
        '    stack, seen = [S], {S}                            # @init',
        '    while stack:                                      # @loop',
        '        cell = stack[-1]                              # @top',
        '        if cell == T: return stack                    # @found',
        '        nxt = next((n for n in open_neighbours(grid, cell)',
        '                    if n not in seen), None)          # @pick',
        '        if nxt: seen.add(nxt); stack.append(nxt)      # @push',
        '        else: stack.pop()                             # @pop',
        '    return None                                       # @none'
      ].join('\n')
    }
  };

  /* ================================================================== flowchart specs (ids = step.flow) */
  var FLOW_BFS = {
    nodes: [
      { id: 'init', type: 'start', text: 'queue ← [s]\ndist[s] ← 0', col: 1, row: 0 },
      { id: 'empty', type: 'decision', text: 'queue empty?', col: 1, row: 1 },
      { id: 'done', type: 'end', text: 'done: every reachable vertex has its distance', col: 2, row: 1, maxWidth: 170 },
      { id: 'take', text: 'u ← front of the queue', col: 1, row: 2 },
      { id: 'target', type: 'decision', text: 'u = target?', col: 1, row: 3 },
      { id: 'path', type: 'end', text: 'follow parents back: the path', col: 2, row: 3, maxWidth: 170 },
      { id: 'more', type: 'decision', text: 'next neighbour v?', col: 1, row: 4 },
      { id: 'seen', type: 'decision', text: 'v seen?', col: 1, row: 5 },
      { id: 'add', text: 'dist[v] ← dist[u] + 1\nparent[v] ← u\nenqueue v', col: 1, row: 6 }
    ],
    edges: [
      { from: 'init', to: 'empty' },
      { from: 'empty', to: 'done', label: 'yes' },
      { from: 'empty', to: 'take', label: 'no' },
      { from: 'take', to: 'target' },
      { from: 'target', to: 'path', label: 'yes' },
      { from: 'target', to: 'more', label: 'no' },
      { from: 'more', to: 'seen', label: 'yes' },
      { from: 'more', to: 'empty', label: 'no', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'seen', to: 'add', label: 'no' },
      { from: 'seen', to: 'more', label: 'yes', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'add', to: 'more', via: { fromSide: 'right', toSide: 'right' } }
    ]
  };
  /* flow ids emitted by the BFS generator: init, take, target, path, add, seen, done */
  var FLOW_DFS = {
    nodes: [
      { id: 'call', type: 'start', text: 'visit(s)', col: 1, row: 0 },
      { id: 'enter', text: 'enter u: mark seen\nd[u] ← time', col: 1, row: 1 },
      { id: 'targetq', type: 'decision', text: 'u = target?', col: 1, row: 2 },
      { id: 'found', type: 'end', text: 'stop: the stack is the route', col: 2, row: 2, maxWidth: 160 },
      { id: 'more', type: 'decision', text: 'next neighbour v?', col: 1, row: 3 },
      { id: 'seen', type: 'decision', text: 'v seen?', col: 1, row: 4 },
      { id: 'dive', text: 'visit(v): go deeper', col: 2, row: 4 },
      { id: 'finish', text: 'f[u] ← time\npop u, back up', col: 0, row: 4 },
      { id: 'empty', type: 'decision', text: 'stack empty?', col: 0, row: 5 },
      { id: 'done', type: 'end', text: 'done', col: 0, row: 6 }
    ],
    edges: [
      { from: 'call', to: 'enter' },
      { from: 'enter', to: 'targetq' },
      { from: 'targetq', to: 'found', label: 'yes' },
      { from: 'targetq', to: 'more', label: 'no' },
      { from: 'more', to: 'seen', label: 'yes' },
      { from: 'more', to: 'finish', label: 'no', via: { fromSide: 'left', toSide: 'top' } },
      { from: 'seen', to: 'dive', label: 'no' },
      { from: 'seen', to: 'more', label: 'yes', via: { fromSide: 'bottom', toSide: 'right', points: [[1, 4.5], [1.5, 4.5], [1.5, 3]] } },
      { from: 'dive', to: 'enter', via: { fromSide: 'top', toSide: 'right' } },
      { from: 'finish', to: 'empty' },
      { from: 'empty', to: 'done', label: 'yes' },
      { from: 'empty', to: 'more', label: 'no', via: { fromSide: 'left', toSide: 'left' } }
    ]
  };
  /* DFS generator flow ids: enter, seen, finish, done, found. The 'targetq' and 'more' boxes are passed through. */

  /* ================================================================== graph presets (positions in 1000 × 600) */
  function toText(g) {
    var used = {};
    var parts = g.edges.map(function (e) { used[e[0]] = used[e[1]] = true; return e[0] + '-' + e[1]; });
    g.nodes.forEach(function (n) { if (!used[n.id]) parts.push(n.id); });
    return parts.join(', ');
  }
  var PRESETS = [
    { label: 'Lesson graph', g: L.MAIN, start: 'A' },
    { label: 'Tree', start: 'A', g: L.graph(
      [['A', 500, 70], ['B', 280, 230], ['C', 720, 230], ['D', 150, 400], ['E', 400, 400], ['F', 620, 400], ['G', 850, 400], ['H', 90, 550], ['I', 230, 550], ['J', 480, 550]],
      [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'F'], ['C', 'G'], ['D', 'H'], ['D', 'I'], ['E', 'J']]) },
    { label: 'Grid', start: 'A', g: (function () {
      var ids = 'ABCDEFGHIJKL'.split(''), nodes = [], edges = [];
      ids.forEach(function (id, i) { var r = Math.floor(i / 4), c = i % 4; nodes.push([id, 170 + c * 220, 100 + r * 200]); if (c < 3) edges.push([id, ids[i + 1]]); if (r < 2) edges.push([id, ids[i + 4]]); });
      return L.graph(nodes, edges);
    }()) },
    { label: 'Cycle with a tail', start: 'A', g: L.graph(
      [['A', 120, 300], ['B', 290, 300], ['C', 430, 140], ['D', 640, 140], ['E', 780, 300], ['F', 640, 460], ['G', 430, 460], ['H', 920, 300]],
      [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'G'], ['G', 'B'], ['E', 'H']]) },
    { label: 'Two islands', start: 'A', g: L.graph(
      [['A', 120, 160], ['B', 320, 90], ['C', 330, 300], ['D', 140, 420], ['E', 380, 500], ['F', 650, 150], ['G', 860, 150], ['H', 650, 420], ['I', 860, 420]],
      [['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D'], ['C', 'E'], ['F', 'G'], ['F', 'H'], ['G', 'I'], ['H', 'I']]) },
    { label: 'Long path', start: 'A', g: L.graph(
      [['A', 90, 150], ['B', 250, 450], ['C', 400, 150], ['D', 550, 450], ['E', 700, 150], ['F', 850, 450], ['G', 940, 150]],
      [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'G']]) }
  ];

  /* ================================================================== the graph lab */
  function graphLab(fig) {
    var legendEl = fig.querySelector('[data-legend]');
    var stage = fig.querySelector('[data-stage]');
    var box = fig.querySelector('[data-container]');
    var panelTitle = fig.querySelector('[data-panel-title]');
    var startSel = fig.querySelector('[data-start]'), targetSel = fig.querySelector('[data-target]');
    var drawBtn = fig.querySelector('[data-draw]');
    var editor = fig.querySelector('[data-editor]');
    var algo = 'bfs', G = L.MAIN, start = 'A', target = '';

    var view = V.views.graph(stage, { bounds: { w: 1000, h: 600 }, label: 'Lab graph', maxHeight: 420 });
    var qHost = h('div'), sHost = h('div');
    box.appendChild(qHost); box.appendChild(sHost);
    var qv = V.views.queue(qHost, { cellSize: 36, label: 'BFS queue' });
    var sv = V.views.stack(sHost, { orientation: 'horizontal', cellSize: 36, label: 'DFS stack' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.bfs, default: 'pseudo', title: 'bfs', maxHeight: 360 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', v: 'compare', queue: 'frontier', stack: 'frontier' } });

    // flowchart lives in its own figure below the lab, but it is driven by this lab
    var flowFig = V.$('#fig-flow');
    var flowTitle = flowFig.querySelector('[data-flow-title]');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_BFS, { label: 'BFS decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    function legend() {
      L.legend(legendEl, [
        { state: 'default', shape: 'outline', label: 'Unseen' },
        { state: 'frontier', label: algo === 'bfs' ? 'In the queue' : 'On the stack' },
        { state: 'active', label: 'Current' },
        { state: 'visited', label: algo === 'bfs' ? 'Visited' : 'Finished' },
        { state: 'compare', shape: 'line', label: 'Edge being checked' },
        { state: 'visited', shape: 'line', label: 'Tree edge' },
        { state: 'path', label: 'Path' }
      ]);
    }
    function normalize(steps) {
      return steps.map(function (st) {
        var o = Object.assign({}, st);
        o.counters = { visited: st.counters.visited, checks: st.counters.checks, frontier: st.counters.frontier };
        var vv = st.vars || {};
        function name(x) { return x === undefined || x === null ? null : V.vars.raw(String(x)); }
        o.vars = algo === 'bfs'
          ? { u: name(vv.u), v: name(vv.v), 'dist[u]': vv['dist[u]'] === undefined ? null : vv['dist[u]'], 'dist[v]': vv['dist[v]'] === undefined ? null : vv['dist[v]'], queue: V.vars.raw('[' + (st.queue || []).map(function (q) { return q.v; }).join(', ') + ']') }
          : { u: name(vv.u), v: name(vv.v), time: st.time, stack: V.vars.raw('[' + st.stack.join(', ') + ']') };
        return o;
      });
    }
    function generate() {
      var raw = algo === 'bfs' ? GS.bfs(G, start, { target: target || null }) : GS.dfs(G, start, { target: target || null });
      var steps = normalize(raw);
      qv.reset(); sv.reset();
      if (algo === 'bfs') qv.prepare(steps.map(function (x) { return L.queueState(x); }));
      else sv.prepare(steps.map(function (x) { return L.stackState(x); }));
      return steps;
    }
    function render(step, ctx) {
      view.render(L.graphState(G, step, { badge: algo === 'bfs' ? 'dist' : null, sub: algo === 'dfs' ? 'times' : null }), { duration: ctx.duration });
      if (algo === 'bfs') qv.render(L.queueState(step), { duration: ctx.duration });
      else sv.render(L.stackState(step), { duration: ctx.duration });
    }
    function fillSelects() {
      var ids = G.nodes.map(function (n) { return n.id; });
      if (ids.indexOf(start) === -1) start = ids[0];
      if (target && ids.indexOf(target) === -1) target = '';
      V.clear(startSel); V.clear(targetSel);
      ids.forEach(function (id) { startSel.appendChild(h('option', { value: id, selected: id === start }, id)); });
      targetSel.appendChild(h('option', { value: '', selected: !target }, 'none'));
      ids.forEach(function (id) { targetSel.appendChild(h('option', { value: id, selected: id === target }, id)); });
    }
    function showAlgo() {
      qHost.hidden = algo !== 'bfs'; sHost.hidden = algo !== 'dfs';
      panelTitle.textContent = algo === 'bfs' ? 'Queue (front on the left)' : 'Stack (top on the right)';
      code.setSource(CODE[algo]);
      var ttl = fig.querySelector('.code-panel__title');
      if (ttl) ttl.textContent = algo;
      flowView.setSpec(algo === 'bfs' ? FLOW_BFS : FLOW_DFS);
      flowTitle.textContent = algo === 'bfs' ? 'BFS decision flow' : 'DFS decision flow';
      legend();
    }

    showAlgo();
    fillSelects();
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { visited: 'Vertices visited', checks: 'Edge checks', frontier: 'Frontier size' },
      counterStates: { frontier: 'frontier', visited: 'visited' },
      baseStepMs: 1000, label: 'Graph lab controls'
    });

    // predict before reveal
    player.addCheckpoint(function (steps) {
      if (!steps.length) return -1;
      if (steps[0].algo === 'bfs') {
        var n = 0;
        for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'dequeue' && ++n === 3) return i;
        return -1;
      }
      for (var j = 1; j < steps.length; j++) if (steps[j].kind === 'finish' && steps[j].stack.length) return j;
      return -1;
    }, function (c) {
      var p = c.prev, nx = c.step;
      if (p.algo === 'bfs') {
        var q = p.queue.map(function (x) { return x.v; });
        if (q.length < 2) return null;
        var front = q[0], rear = q[q.length - 1];
        var opts = [rear, front], ans = 1;
        var other = p.order.length ? p.order[p.order.length - 1] : null;
        var alpha = G.nodes.map(function (n) { return n.id; }).filter(function (id) { return p.states[id] === 'default'; })[0];
        if (alpha && opts.indexOf(alpha) === -1) opts.push(alpha);
        return {
          question: 'The queue holds <code>' + q.join(' ') + '</code>. Which vertex does BFS take next?',
          options: opts.map(function (o) { return '<b>' + o + '</b>'; }), answer: ans,
          explain: [
            rear + ' joined most recently. Taking the newest discovery is what DFS does, not BFS.',
            front + ' has waited longest: a queue is first in, first out, so the front leaves first.',
            alpha ? alpha + ' has not been discovered yet, so it is not in the queue at all.' : ''
          ]
        };
      }
      var u = p.current, par = p.stack.length > 1 ? p.stack[p.stack.length - 2] : null;
      if (!par) return null;
      return {
        question: '<b>' + u + '</b> has no unseen neighbours left. What does DFS do next?',
        options: ['Jump back to the start, ' + p.stack[0], 'Finish ' + u + ' and back up to ' + par, 'Take the oldest vertex it has discovered'],
        answer: 1,
        explain: [
          'Only the most recent unfinished call resumes. ' + p.stack[0] + ' waits at the bottom of the stack until everything above it is done.',
          'The call visit(' + u + ') returns, so control goes back to the caller, visit(' + par + '), which carries on with its next neighbour.',
          'Taking the oldest discovery is BFS’s rule. DFS always resumes the newest unfinished vertex.'
        ]
      };
    }, { id: 'lab-graph-predict' });

    function reload() { player.setSteps(generate()); }
    V.segmented(fig.querySelector('[data-algo]'), {
      label: 'Algorithm', value: 'bfs',
      options: [{ value: 'bfs', label: 'BFS (queue)' }, { value: 'dfs', label: 'DFS (stack)' }],
      onChange: function (v) { algo = v; showAlgo(); reload(); }
    });
    startSel.addEventListener('change', function () { start = startSel.value; reload(); });
    targetSel.addEventListener('change', function () { target = targetSel.value; reload(); });

    // custom input: an edge list, with presets that carry hand-made layouts
    var pendingPreset = null;
    function setGraph(g, startId) {
      G = g;
      if (startId) start = startId;
      view.resetPositions && view.resetPositions();
      fillSelects();
      reload();
    }
    function layoutFor(parsed) {
      var old = {};
      G.nodes.forEach(function (n) { old[n.id] = n; });
      var keep = parsed.nodes.filter(function (id) { return old[id]; });
      var nodes = parsed.nodes.map(function (id) { return old[id] ? { id: id, x: old[id].x, y: old[id].y, fixed: true } : { id: id }; });
      var edges = parsed.edges.map(function (e) { return { from: e[0], to: e[1] }; });
      var pos = V.views.graph.layouts.force(keep.length === parsed.nodes.length ? nodes : (keep.length ? nodes : parsed.nodes), edges, { w: 1000, h: 600, pad: 80, seed: 5 });
      return { nodes: parsed.nodes.map(function (id) { var p = pos[id] || old[id]; return { id: id, x: p.x, y: p.y }; }), edges: parsed.edges, directed: false };
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges (up to 12 vertices)',
      value: toText(G),
      placeholder: 'e.g. A-B, A-C, B-D, E',
      parse: function (text) { return GS.parseEdgeList(text, { maxNodes: 12, maxEdges: 24 }); },
      presets: PRESETS.map(function (p) { return { label: p.label, value: function () { pendingPreset = p; return toText(p.g); } }; }),
      hint: 'Write edges as A-B separated by commas. A lone name is a vertex with no edges.',
      onApply: function (parsed) {
        var p = pendingPreset;
        pendingPreset = null;
        if (p && toText(p.g) === input.field.value) setGraph(p.g, p.start);
        else setGraph(layoutFor(parsed), null);
      }
    });

    // draw mode: a graph editor over the stage
    var ed = null, edErr = editor.querySelector('[data-editor-error]');
    function openEditor() {
      player.pause();
      editor.hidden = false;
      drawBtn.setAttribute('aria-pressed', 'true');
      if (!ed) {
        ed = V.views.graph(editor.querySelector('[data-editor-canvas]'), { editable: true, directed: false, weighted: false, bounds: { w: 1000, h: 600 }, maxHeight: 420 });
      }
      ed.setGraph({ nodes: G.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }), edges: G.edges.map(function (e) { return { from: e[0], to: e[1] }; }) });
      edErr.textContent = '';
      var first = editor.querySelector('button');
      if (first) first.focus();
    }
    function closeEditor() { editor.hidden = true; drawBtn.setAttribute('aria-pressed', 'false'); drawBtn.focus(); }
    drawBtn.addEventListener('click', function () { if (editor.hidden) openEditor(); else closeEditor(); });
    editor.querySelector('[data-editor-clear]').addEventListener('click', function () { ed.setGraph({ nodes: [], edges: [] }); edErr.textContent = ''; });
    editor.querySelector('[data-editor-done]').addEventListener('click', function () {
      var g = ed.getGraph();
      if (!g.nodes.length) { edErr.textContent = 'Add at least one vertex: click on empty space.'; return; }
      if (g.nodes.length > 12) { edErr.textContent = 'That is ' + g.nodes.length + ' vertices. Keep it to 12 or fewer so every step stays readable.'; return; }
      var edges = [], seen = {};
      g.edges.forEach(function (e) { var k = GS.edgeKey(e.from, e.to, false); if (e.from !== e.to && !seen[k]) { seen[k] = true; edges.push([String(e.from), String(e.to)]); } });
      if (edges.length > 24) { edErr.textContent = 'That is ' + edges.length + ' edges. Keep it to 24 or fewer.'; return; }
      var ng = { nodes: g.nodes.map(function (n) { return { id: String(n.id), x: n.x, y: n.y }; }), edges: edges, directed: false };
      closeEditor();
      input.field.value = toText(ng);
      input.setError('');
      setGraph(ng, null);
    });
    editor.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented && document.activeElement && !document.activeElement.closest('.vz')) closeEditor(); });
  }

  /* ================================================================== the grid lab */
  function gridLab(fig) {
    var R = 13, C = 23;
    var stage = fig.querySelector('[data-stage]');
    var mode = 'bfs', walls = {}, start = [6, 3], goal = [6, 19];
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.gridbfs, default: 'pseudo', maxHeight: 320 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { cell: 'active', queue: 'frontier', depth: 'frontier' } });
    var view = V.views.grid(stage, { mode: 'path', paintable: true, draggableMarkers: true, cellSize: 30, label: 'Paintable grid' });

    function legend() {
      L.legend(fig.querySelector('[data-legend]'), [
        { state: 'default', color: 'var(--bg-sunken)', label: 'Open' },
        { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Wall' },
        { state: 'frontier', label: mode === 'dfs' ? 'On the stack' : 'In the queue' },
        { state: 'active', label: 'Current' },
        { state: 'visited', label: mode === 'dfs' ? 'Dead end' : 'Visited' },
        { state: 'path', label: 'Path' }
      ]);
    }
    function key(r, c) { return r + ',' + c; }
    function grid() { return { rows: R, cols: C, walls: Object.keys(walls) }; }
    function generate() {
      var g = grid();
      var steps = mode === 'dfs' ? GS.gridDfs(g, start, goal) : mode === 'fill' ? GS.gridBfs(g, start, null, { fill: true }) : GS.gridBfs(g, start, goal);
      return steps.map(function (st) {
        var o = Object.assign({}, st, { vars: Object.assign({}, st.vars) });
        if (o.vars.cell) o.vars.cell = V.vars.raw(o.vars.cell);
        return o;
      });
    }
    function render(step, ctx) {
      view.render(L.gridState(step, { labels: mode !== 'dfs' }), { duration: ctx.duration });
    }
    // presets
    function setWalls(list) { walls = {}; list.forEach(function (k) { if (k !== key(start[0], start[1]) && k !== key(goal[0], goal[1])) walls[k] = true; }); }
    function wallsPreset() {
      var out = [];
      for (var r = 0; r < R; r++) { if (r !== 9) out.push(key(r, 8)); if (r !== 2) out.push(key(r, 15)); }
      for (var c = 9; c < 15; c++) if (c !== 12) out.push(key(5, c));
      return out;
    }
    function mazePreset(seed) {
      var rng = V.rng(seed), open = {}, out = [];
      function visit(r, c) {
        open[key(r, c)] = true;
        var dirs = V.shuffle([[0, 2], [2, 0], [0, -2], [-2, 0]], rng);
        dirs.forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || open[key(nr, nc)]) return;
          open[key(r + d[0] / 2, c + d[1] / 2)] = true;
          visit(nr, nc);
        });
      }
      visit(1, 1);
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (!open[key(r, c)]) out.push(key(r, c));
      return out;
    }
    function randomPreset(seed) {
      var rng = V.rng(seed), out = [];
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (rng() < 0.3) out.push(key(r, c));
      return out;
    }
    var seed = 7;
    var presets = [
      { label: 'Walls with gaps', run: function () { start = [6, 3]; goal = [6, 19]; setWalls(wallsPreset()); } },
      { label: 'Maze', run: function () { start = [1, 1]; goal = [11, 21]; setWalls(mazePreset(seed++)); } },
      { label: 'Random walls', run: function () { start = [6, 3]; goal = [6, 19]; setWalls(randomPreset(seed++)); } },
      { label: 'Open field', run: function () { start = [6, 3]; goal = [6, 19]; setWalls([]); } },
      { label: 'No way through', run: function () { start = [6, 3]; goal = [6, 19]; var out = []; for (var r = 0; r < R; r++) out.push(key(r, 11)); setWalls(out); } }
    ];
    var presetBox = fig.querySelector('[data-presets]');
    presets.forEach(function (p) {
      presetBox.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { p.run(); reload(); } }, p.label));
    });
    presets[0].run();
    legend();

    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { visited: 'Cells visited', frontier: 'Frontier size', path: 'Path length' },
      counterStates: { frontier: 'frontier', path: 'path' },
      baseStepMs: 240, animMs: 180, speeds: [0.5, 1, 2, 4, 8], label: 'Grid lab controls'
    });
    player.addCheckpoint(function (steps) {
      if (!steps.length || steps[0].algo !== 'gridbfs') return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'found') return i;
      return -1;
    }, function (c) {
      var st = c.step, d = st.dist[st.goal[0] * st.cols + st.goal[1]];
      return {
        question: 'T is next out of the queue, and its distance label is <b>' + d + '</b>. How many steps long is the shortest path from S to T?',
        options: [d + 1 + ' (one more for T itself)', 'Exactly ' + d, 'Unknown until the path is traced'],
        answer: 1,
        explain: [
          'The distance counts steps between cells, not cells. A path of ' + d + ' steps touches ' + (d + 1) + ' cells.',
          'BFS gave T the distance ' + d + ' when it discovered T, and a BFS distance is already the length of a shortest route. Tracing parents only draws it.',
          'The number is already known: BFS distances are final the moment a cell is discovered. Tracing the parents only shows which cells the route uses.'
        ]
      };
    }, { id: 'lab-grid-path-length' });

    function reload() { player.setSteps(generate()); }
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Search', value: 'bfs',
      options: [{ value: 'bfs', label: 'BFS: shortest path' }, { value: 'fill', label: 'BFS: flood fill' }, { value: 'dfs', label: 'DFS: any path' }],
      onChange: function (v) { mode = v; code.setSource(v === 'dfs' ? CODE.griddfs : CODE.gridbfs); legend(); reload(); }
    });
    view.on('paint', function (e) {
      player.pause();
      e.cells.forEach(function (rc) {
        var k = key(rc[0], rc[1]);
        if (k === key(start[0], start[1]) || (mode !== 'fill' && k === key(goal[0], goal[1]))) return;
        if (e.value) walls[k] = true; else delete walls[k];
      });
    });
    view.on('paintend', function () { reload(); });
    view.on('move-marker', function (e) {
      player.pause();
      if (!e.done) return;
      var k = key(e.cell[0], e.cell[1]);
      if (walls[k]) { reload(); return; }
      if (e.marker === 'start') { if (k !== key(goal[0], goal[1])) start = e.cell.slice(); }
      else if (e.marker === 'end') { if (k !== key(start[0], start[1])) goal = e.cell.slice(); }
      reload();
    });
  }

  /* ================================================================== BFS or DFS? (interactive decision tree) */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Weighted edges?', col: 0, row: 0 },
      { id: 'dij', type: 'end', text: 'Dijkstra or A*', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Fewest edges?', col: 0, row: 1 },
      { id: 'bfs', type: 'end', text: 'BFS', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Need structure?', col: 0, row: 2 },
      { id: 'dfs', type: 'end', text: 'DFS', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Very deep?', col: 0, row: 3 },
      { id: 'deep', type: 'end', text: 'BFS or iterative DFS', col: 1, row: 3, maxWidth: 120 },
      { id: 'either', type: 'end', text: 'Either one', col: 0, row: 4 }
    ],
    edges: [
      { from: 'q1', to: 'dij', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'bfs', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'dfs', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'deep', label: 'yes' }, { from: 'q4', to: 'either', label: 'no' }
    ]
  };
  var CHOOSE_TEXT = {
    q1: 'Start here: do the edges carry different weights (distances, prices, times)? Pick <b>yes</b> or <b>no</b> on the lit question (click a label, or Tab to it and press Enter).',
    q2: 'Unweighted. Do you need the <em>fewest edges</em> between two places, such as the fewest moves or the fewest hops?',
    q3: 'Not a distance question. Do you need structure: a cycle, a dependency order, the pieces that hang together?',
    q4: 'You only need to reach everything. Could a route be thousands of vertices long?',
    dij: '<b>Dijkstra or A*</b> (lesson 28). BFS counts edges, not weights, so with weights its “shortest” path can be wrong.',
    bfs: '<b>BFS.</b> Its queue visits vertices in order of distance, so the first time it reaches a vertex is along a fewest-edge route.',
    dfs: '<b>DFS.</b> Its stack and clock expose back edges (cycles), finish order (topological sort, lesson 27) and more.',
    deep: '<b>BFS, or DFS with your own stack.</b> Recursive DFS nests one call per vertex on a long route and can overflow the call stack.',
    either: '<b>Either works</b> in O(V + E). Recursive DFS is usually the shortest to write; BFS is just as fast.'
  };
  function chooseFigure(fig) {
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'BFS or DFS decision tree' });
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
    L.lazy('#lab-graph', graphLab);
    L.lazy('#lab-grid', gridLab);
    L.lazy('#fig-choose', chooseFigure);
  });

  L.CODE = CODE;
}());
