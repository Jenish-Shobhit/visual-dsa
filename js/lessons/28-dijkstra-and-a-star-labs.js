/* Lesson 28 · Dijkstra & A* — part 3: the graph lab (with editor), its flowchart, and the negative-edge counterexample.
   Needs js/lessons/28-dijkstra-and-a-star.js (VDSA.L28) and js/algos/28-dijkstra-and-a-star.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SP = V.algos.shortestPaths;
  var L = V.L28;

  /* ================================================================== code (labels tie lines across languages) */
  var CODE = {
    pseudo: [
      'Dijkstra(graph, s, target)',
      '  dist[v] ← ∞ for every v; dist[s] ← 0     // @init',
      '  parent[v] ← none for every v              // @init',
      '  queue ← priority queue holding (0, s)     // @init',
      '  while queue is not empty                  // @loop',
      '    (d, u) ← pop the smallest entry         // @pop',
      '    if d > dist[u]: skip (stale entry)      // @stale',
      '    settle u: dist[u] = d is final          // @settle',
      '    if u = target: return the path          // @found',
      '    for each edge (u, v, w)                 // @edges',
      '      if dist[u] + w < dist[v]              // @check',
      '        dist[v] ← dist[u] + w               // @relax',
      '        parent[v] ← u                       // @relax',
      '        push (dist[v], v) onto queue        // @relax',
      '  return dist, parent                       // @done'
    ].join('\n'),
    js: [
      'function dijkstra(adj, s, target) {',
      '  const dist = new Map(), parent = new Map();     // @init',
      '  for (const v of adj.keys()) dist.set(v, Infinity); // @init',
      '  dist.set(s, 0);                                 // @init',
      '  const queue = new MinHeap(), settled = new Set(); // @init',
      '  queue.push([0, s]);                             // @init',
      '  while (queue.size > 0) {                        // @loop',
      '    const [d, u] = queue.pop();                   // @pop',
      '    if (d > dist.get(u)) continue;                // @stale',
      '    settled.add(u);                               // @settle',
      '    if (u === target) return pathTo(parent, u);   // @found',
      '    for (const [v, w] of adj.get(u)) {            // @edges',
      '      if (dist.get(u) + w < dist.get(v)) {        // @check',
      '        dist.set(v, dist.get(u) + w);             // @relax',
      '        parent.set(v, u);                         // @relax',
      '        queue.push([dist.get(v), v]);             // @relax',
      '      }',
      '    }',
      '  }',
      '  return { dist, parent };                        // @done',
      '}'
    ].join('\n'),
    py: [
      'import heapq',
      '',
      'def dijkstra(adj, s, target=None):',
      '    dist = {v: float("inf") for v in adj}         # @init',
      '    parent = {v: None for v in adj}               # @init',
      '    dist[s] = 0                                   # @init',
      '    queue, settled = [(0, s)], set()              # @init',
      '    while queue:                                  # @loop',
      '        d, u = heapq.heappop(queue)               # @pop',
      '        if d > dist[u]:                           # @stale',
      '            continue                              # @stale',
      '        settled.add(u)                            # @settle',
      '        if u == target:                           # @found',
      '            return path_to(parent, u)             # @found',
      '        for v, w in adj[u]:                       # @edges',
      '            if dist[u] + w < dist[v]:             # @check',
      '                dist[v] = dist[u] + w             # @relax',
      '                parent[v] = u                     # @relax',
      '                heapq.heappush(queue, (dist[v], v))  # @relax',
      '    return dist, parent                           # @done'
    ].join('\n')
  };
  L.CODE_DIJKSTRA = CODE;

  /* ================================================================== flowchart (ids = step.flow) */
  var FLOW = {
    nodes: [
      { id: 'init', type: 'start', text: 'dist[s] ← 0\npush (0, s)', col: 1, row: 0 },
      { id: 'empty', type: 'decision', text: 'queue empty?', col: 1, row: 1 },
      { id: 'done', type: 'end', text: 'done: every reachable vertex is settled', col: 2, row: 1, maxWidth: 170 },
      { id: 'stale', type: 'decision', text: 'pop (d, u): stale?\nd > dist[u] ?', col: 1, row: 2 },
      { id: 'settle', text: 'settle u\ndist[u] is final', col: 1, row: 3 },
      { id: 'target', type: 'decision', text: 'u = target?', col: 1, row: 4 },
      { id: 'found', type: 'end', text: 'stop: read the path from the parents', col: 2, row: 4, maxWidth: 170 },
      { id: 'more', type: 'decision', text: 'next edge u → v ?', col: 1, row: 5 },
      { id: 'better', type: 'decision', text: 'dist[u] + w\n< dist[v] ?', col: 1, row: 6 },
      { id: 'relax', text: 'dist[v] ← dist[u] + w\nparent[v] ← u\npush (dist[v], v)', col: 1, row: 7, maxWidth: 230 }
    ],
    edges: [
      { from: 'init', to: 'empty' },
      { from: 'empty', to: 'done', label: 'yes' },
      { from: 'empty', to: 'stale', label: 'no' },
      { from: 'stale', to: 'empty', label: 'yes', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'stale', to: 'settle', label: 'no' },
      { from: 'settle', to: 'target' },
      { from: 'target', to: 'found', label: 'yes' },
      { from: 'target', to: 'more', label: 'no' },
      { from: 'more', to: 'better', label: 'yes' },
      { from: 'more', to: 'empty', label: 'no', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'better', to: 'relax', label: 'yes' },
      { from: 'better', to: 'more', label: 'no', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'relax', to: 'more', via: { fromSide: 'right', toSide: 'right' } }
    ]
  };

  /* ================================================================== graph presets */
  function toText(g) {
    var used = {};
    var parts = g.edges.map(function (e) { used[e[0]] = used[e[1]] = true; return e[0] + '-' + e[1] + ':' + e[2]; });
    g.nodes.forEach(function (n) { if (!used[n.id]) parts.push(n.id); });
    return parts.join(', ');
  }
  var PRESETS = [
    { label: 'Lesson map', g: L.MAP, start: 'S', target: 'T' },
    { label: 'Fewest roads ≠ fastest', g: L.ROAD, start: 'H', target: 'T' },
    { label: 'Stale entries', start: 'S', target: '', g: L.graph(
      [['S', 90, 300], ['A', 540, 120], ['B', 360, 300], ['C', 260, 480], ['D', 560, 500], ['T', 900, 300]],
      [['S', 'A', 10], ['S', 'B', 8], ['S', 'C', 5], ['C', 'B', 2], ['C', 'A', 4], ['B', 'A', 1], ['A', 'T', 2], ['B', 'D', 3], ['D', 'T', 9]]) },
    { label: 'Grid of weights', start: 'A', target: 'I', g: (function () {
      var ids = 'ABCDEFGHI'.split(''), w = { 'A-B': 4, 'B-C': 1, 'A-D': 2, 'B-E': 7, 'C-F': 3, 'D-E': 1, 'E-F': 6, 'D-G': 5, 'E-H': 2, 'F-I': 1, 'G-H': 3, 'H-I': 4 };
      var nodes = ids.map(function (id, i) { return [id, 170 + (i % 3) * 330, 90 + Math.floor(i / 3) * 210]; });
      return L.graph(nodes, Object.keys(w).map(function (k) { var p = k.split('-'); return [p[0], p[1], w[k]]; }));
    }()) },
    { label: 'All weights equal (BFS)', start: 'A', target: 'H', g: L.graph(
      [['A', 90, 300], ['B', 300, 130], ['C', 300, 470], ['D', 520, 130], ['E', 520, 470], ['F', 730, 300], ['G', 900, 130], ['H', 900, 470]],
      [['A', 'B', 1], ['A', 'C', 1], ['B', 'D', 1], ['C', 'E', 1], ['D', 'F', 1], ['E', 'F', 1], ['F', 'G', 1], ['F', 'H', 1], ['B', 'C', 1]]) },
    { label: 'Two islands', start: 'A', target: '', g: L.graph(
      [['A', 120, 160], ['B', 340, 90], ['C', 340, 330], ['D', 130, 470], ['E', 660, 150], ['F', 880, 140], ['G', 700, 440], ['H', 900, 430]],
      [['A', 'B', 3], ['A', 'C', 5], ['B', 'C', 1], ['C', 'D', 4], ['E', 'F', 2], ['E', 'G', 6], ['F', 'H', 3], ['G', 'H', 1]]) }
  ];
  L.LAB_PRESETS = PRESETS;

  /* ================================================================== shared checkpoint for "who is settled next" */
  function nextSettleCheckpoint(player, id, minLive) {
    player.addCheckpoint(function (all) {
      for (var i = 3; i < all.length; i++) {
        if (all[i].kind !== 'settle') continue;
        var live = all[i - 1].pq.filter(function (e) { return !e.stale; });
        if (live.length >= minLive) return i;
      }
      return -1;
    }, function (c) {
      var live = c.prev.pq.filter(function (e) { return !e.stale; });
      var nextU = c.step.u;
      if (live.length < 2) return null;
      var opts = live.slice(0, 3).map(function (e) { return { v: e.v, d: e.d }; });
      var ans = opts.findIndex(function (o) { return o.v === nextU; });
      if (ans < 0) return null;
      return {
        question: 'The queue holds ' + live.map(function (e) { return '(' + e.d + ', ' + e.v + ')'; }).join(', ') + '. Which vertex does Dijkstra settle next?',
        options: opts.map(function (o) { return '<b>' + o.v + '</b>, at ' + o.d; }), answer: ans,
        explain: opts.map(function (o, i) {
          return i === ans ? o.v + ' has the smallest distance in the queue (' + o.d + '). Nothing else can reach it more cheaply, so it is settled.'
            : o.v + ' waits at ' + o.d + ', but a smaller number is still in the queue. Dijkstra takes the smallest distance, not the newest entry or the first letter.';
        })
      };
    }, { id: id });
  }
  L.nextSettleCheckpoint = nextSettleCheckpoint;

  /* ================================================================== the graph lab */
  function graphLab(fig) {
    var stage = fig.querySelector('[data-stage]');
    var startSel = fig.querySelector('[data-start]'), targetSel = fig.querySelector('[data-target]');
    var drawBtn = fig.querySelector('[data-draw]');
    var editor = fig.querySelector('[data-editor]');
    var G = L.MAP, start = 'S', target = 'T', directed = false;
    L.legend(fig.querySelector('[data-legend]'), L.LEGEND_DIJKSTRA);

    var view = V.views.graph(stage, { bounds: { w: 1000, h: 600 }, maxHeight: 420, draggable: true, nodeRadius: 22, minRadius: 14, label: 'Lab graph' });
    var pq = L.pqPanel(fig.querySelector('[data-pq]'));
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'pseudo', title: 'dijkstra', maxHeight: 380 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', v: 'compare', pq: 'frontier' } });

    var flowFig = V.$('#fig-flow');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW, { label: 'Dijkstra decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    function normalize(steps) {
      return steps.map(function (st) {
        var o = Object.assign({}, st);
        var vv = st.vars || {};
        function name(x) { return x === undefined || x === null ? null : V.vars.raw(String(x)); }
        o.vars = { u: name(vv.u), 'dist[u]': vv['dist[u]'] === undefined ? null : vv['dist[u]'], v: name(vv.v), w: vv.w === undefined ? null : vv.w, 'dist[u] + w': vv['dist[u] + w'] === undefined ? null : vv['dist[u] + w'], 'dist[v]': vv['dist[v]'] === undefined ? null : vv['dist[v]'], queue: V.vars.raw(vv.pq || '[]') };
        if (vv.path) o.vars.path = V.vars.raw(vv.path);
        return o;
      });
    }
    function generate() {
      var g = { nodes: G.nodes, edges: G.edges, directed: directed };
      return normalize(SP.dijkstra(g, start, { target: target || null }));
    }
    function render(step, ctx) {
      var g = Object.assign({}, G, { directed: directed });
      view.render(L.graphState(g, step), { duration: ctx.duration });
      pq.render(step, ctx.duration);
    }
    function fillSelects() {
      var ids = G.nodes.map(function (n) { return n.id; });
      if (ids.indexOf(start) === -1) start = ids[0];
      if (target && ids.indexOf(target) === -1) target = '';
      V.clear(startSel); V.clear(targetSel);
      ids.forEach(function (id) { startSel.appendChild(h('option', { value: id, selected: id === start }, id)); });
      targetSel.appendChild(h('option', { value: '', selected: !target }, 'none (all)'));
      ids.forEach(function (id) { targetSel.appendChild(h('option', { value: id, selected: id === target }, id)); });
    }
    fillSelects();
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { settled: 'Vertices settled', relaxations: 'Relaxations', pushes: 'Heap pushes', stale: 'Stale pops' },
      counterStates: { settled: 'done', relaxations: 'active', stale: 'muted' },
      baseStepMs: 1100, label: 'Graph lab controls'
    });

    nextSettleCheckpoint(player, 'dj-lab-next', 2);
    player.addCheckpoint(function (all) {
      for (var i = 2; i < all.length; i++) {
        var k = all[i].kind;
        if ((k === 'relax' || k === 'skip') && all[i - 1].dist[all[i].v] !== null && all[i - 1].dist[all[i].v] !== undefined && all[i].vars['dist[u] + w'] !== null) return i;
      }
      return -1;
    }, function (c) {
      var st = c.step, v = st.v, old = c.prev.dist[v];
      if (old === null || old === undefined) return null;
      var cand = st.vars['dist[u] + w'], u = st.u;
      var better = cand < old;
      var opts = [String(old), String(cand)];
      if (old === cand) opts = [String(old), String(old + 1)];
      var right = better ? String(cand) : String(old);
      var ans = opts.indexOf(right);
      return {
        question: 'Relaxing edge ' + u + '→' + v + ': dist[' + u + '] + w = <b>' + cand + '</b> and dist[' + v + '] is now <b>' + old + '</b>. What is dist[' + v + '] afterwards?',
        options: opts.map(function (o) { return '<b>' + o + '</b>'; }), answer: ans,
        explain: opts.map(function (o) {
          if (o === right) return better ? cand + ' is smaller than ' + old + ', so ' + v + ' now goes through ' + u + ' and the old entry in the queue becomes stale.' : cand + ' is not smaller than ' + old + ', so ' + v + ' keeps its current route.';
          if (o === String(old) && better) return 'That would be right only if the new route were not shorter. ' + cand + ' < ' + old + ', so it replaces it.';
          if (o === String(cand)) return cand + ' would replace ' + old + ' only if it were smaller. It is not.';
          return 'A relaxation never invents a number: it keeps the old one or takes dist[u] + w.';
        })
      };
    }, { id: 'dj-lab-relax' });

    function reload() { view.resetPositions && view.resetPositions(); player.setSteps(generate()); }
    startSel.addEventListener('change', function () { start = startSel.value; reload(); });
    targetSel.addEventListener('change', function () { target = targetSel.value; reload(); });
    V.toggle(fig.querySelector('[data-directed]'), { label: 'Directed edges', checked: false, onChange: function (on) { directed = on; if (ed) closeEditor(); reload(); } });

    // custom input: a weighted edge list; presets carry hand-made layouts
    var pendingPreset = null, input = null;
    function setGraph(g, startId, targetId) {
      G = g;
      if (startId) start = startId;
      if (targetId !== undefined) target = targetId;
      fillSelects();
      reload();
    }
    function layoutFor(parsed) {
      var old = {};
      G.nodes.forEach(function (n) { old[n.id] = n; });
      var nodes = parsed.nodes.map(function (id) { return old[id] ? { id: id, x: old[id].x, y: old[id].y, fixed: true } : { id: id }; });
      var edges = parsed.edges.map(function (e) { return { from: e[0], to: e[1] }; });
      var pos = V.views.graph.layouts.force(nodes, edges, { w: 1000, h: 600, pad: 80, seed: 5 });
      return { nodes: parsed.nodes.map(function (id) { var p = pos[id] || old[id]; return { id: id, x: p.x, y: p.y }; }), edges: parsed.edges, directed: directed };
    }
    input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges with weights (up to 10 vertices, 20 edges)',
      value: toText(G),
      placeholder: 'e.g. A-B:4, A-C:2, B-D:7',
      parse: function (text) { return SP.parseWeightedEdgeList(text, { maxNodes: 10, maxEdges: 20, directed: directed }); },
      presets: PRESETS.map(function (p) { return { label: p.label, value: function () { pendingPreset = p; return toText(p.g); } }; }),
      hint: 'Write each road as A-B:4 (weight 0 to 99), separated by commas. A lone name is a vertex with no roads. Negative weights are refused: that is the next section.',
      onApply: function (parsed) {
        var p = pendingPreset;
        pendingPreset = null;
        if (p && toText(p.g) === input.field.value) setGraph(p.g, p.start, p.target);
        else setGraph(layoutFor(parsed), null, undefined);
      }
    });

    // draw mode: a weighted graph editor laid over the stage
    var ed = null, edErr = editor.querySelector('[data-editor-error]');
    function openEditor() {
      player.pause();
      editor.hidden = false;
      drawBtn.setAttribute('aria-pressed', 'true');
      if (ed) ed.destroy();
      V.clear(editor.querySelector('[data-editor-canvas]'));
      ed = V.views.graph(editor.querySelector('[data-editor-canvas]'), { editable: true, directed: directed, weighted: true, defaultWeight: 1, bounds: { w: 1000, h: 600 }, maxHeight: 420, label: 'Graph editor' });
      ed.setGraph({ nodes: G.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }), edges: G.edges.map(function (e) { return { from: e[0], to: e[1], weight: e[2] }; }) });
      edErr.textContent = '';
      var first = editor.querySelector('button');
      if (first) first.focus();
    }
    function closeEditor() { editor.hidden = true; drawBtn.setAttribute('aria-pressed', 'false'); }
    drawBtn.addEventListener('click', function () { if (editor.hidden) openEditor(); else { closeEditor(); drawBtn.focus(); } });
    editor.querySelector('[data-editor-clear]').addEventListener('click', function () { ed.setGraph({ nodes: [], edges: [] }); edErr.textContent = ''; });
    editor.querySelector('[data-editor-done]').addEventListener('click', function () {
      var g = ed.getGraph();
      if (!g.nodes.length) { edErr.textContent = 'Add at least one vertex: click on empty space.'; return; }
      if (g.nodes.length > 10) { edErr.textContent = 'That is ' + g.nodes.length + ' vertices. Keep it to 10 or fewer so every step stays readable.'; return; }
      var edges = [], seen = {};
      for (var i = 0; i < g.edges.length; i++) {
        var e = g.edges[i], w = e.weight === undefined || e.weight === null || e.weight === '' ? 1 : Number(e.weight);
        if (e.from === e.to) continue;
        if (!isFinite(w) || w !== Math.round(w) || w < 0 || w > 99) { edErr.textContent = 'The edge ' + e.from + '–' + e.to + ' has weight ' + e.weight + '. Weights must be whole numbers from 0 to 99 (Dijkstra cannot handle negative ones).'; return; }
        var k = SP.edgeKey(e.from, e.to, directed);
        if (seen[k]) continue;
        seen[k] = true;
        edges.push([String(e.from), String(e.to), w]);
      }
      if (edges.length > 20) { edErr.textContent = 'That is ' + edges.length + ' edges. Keep it to 20 or fewer.'; return; }
      var ng = { nodes: g.nodes.map(function (n) { return { id: String(n.id), x: n.x, y: n.y }; }), edges: edges, directed: directed };
      closeEditor();
      input.field.value = toText(ng);
      input.setError('');
      setGraph(ng, null, undefined);
    });
    editor.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented && document.activeElement && !document.activeElement.closest('.vz')) { closeEditor(); drawBtn.focus(); } });
  }

  /* ================================================================== the negative-edge counterexample */
  function negFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Not reached (∞)' }, { state: 'frontier', label: 'Tentative distance' },
      { state: 'active', label: 'Just settled' }, { state: 'visited', label: 'Settled, but nothing proves it final' },
      { state: 'error', label: 'Wrong distance' }, { state: 'error', shape: 'line', label: 'Improvement Dijkstra ignored' }
    ]);
    var g = L.graph([['S', 90, 300], ['A', 440, 130], ['B', 440, 470], ['T', 880, 300]], [['S', 'A', 1], ['S', 'B', 2], ['A', 'T', 1], ['B', 'A', -3]], true);
    var steps = SP.negativeDemo(g, 'S');
    var fx = L.dijkstraFigure(fig, g, steps, { label: 'Dijkstra on a graph with a negative edge', maxHeight: 320, baseStepMs: 1700, controlsLabel: 'Negative edge controls' });
    fx.player.addCheckpoint(function (all) { return all.findIndex(function (s) { return s.kind === 'ignore'; }); }, function (c) {
      return {
        question: 'Dijkstra has settled A at 1 and now relaxes B → A, whose weight is −3. That gives 2 − 3 = −1, better than 1. What does it do?',
        options: ['Sets dist[A] = −1 and pushes A again', 'Ignores the edge, because A is already settled', 'Stops with an error'],
        answer: 1,
        explain: [
          'That would be the right thing to do, but Dijkstra never reopens a settled vertex: it settled A trusting that nothing could improve it. (Allowing it makes the loop correct here, but it loses the guarantee and the speed.)',
          'A is in the settled set, and the loop only relaxes edges into vertices that are still waiting. So the −1 route is never recorded, and T, which was reached through A, keeps its wrong distance too.',
          'Dijkstra does not check for negative weights at all. It simply runs, and quietly returns wrong answers, which is why the refusal has to come from you.'
        ]
      };
    }, { id: 'dj-neg-ignore' });
  }

  V.ready(function () {
    L.lazy('#lab-graph', graphLab);
    L.lazy('#fig-neg', negFigure);
  });
}());
