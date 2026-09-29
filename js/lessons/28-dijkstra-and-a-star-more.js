/* Lesson 28 · Dijkstra & A* — part 5: the decision tree, cost charts, variations, checks and the summary card.
   Needs js/lessons/28-dijkstra-and-a-star.js (VDSA.L28) and js/algos/28-dijkstra-and-a-star.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SP = V.algos.shortestPaths;
  var L = V.L28;

  /* ================================================================== which algorithm? (interactive decision tree) */
  var CHOOSE = {
    nodes: [
      { id: 'q0', type: 'decision', text: 'Weighted edges?', col: 0, row: 0 },
      { id: 'bfs', type: 'end', text: 'BFS', col: 1, row: 0 },
      { id: 'q1', type: 'decision', text: 'A DAG (no cycles)?', col: 0, row: 1 },
      { id: 'dag', type: 'end', text: 'Relax in topological order', col: 1, row: 1, maxWidth: 150 },
      { id: 'q2', type: 'decision', text: 'Paths between all pairs?', col: 0, row: 2 },
      { id: 'fw', type: 'end', text: 'Floyd-Warshall', col: 1, row: 2 },
      { id: 'q3', type: 'decision', text: 'Any negative weights?', col: 0, row: 3 },
      { id: 'bf', type: 'end', text: 'Bellman-Ford', col: 1, row: 3 },
      { id: 'q4', type: 'decision', text: 'One goal and a good distance estimate?', col: 0, row: 4, maxWidth: 170 },
      { id: 'astar', type: 'end', text: 'A*', col: 1, row: 4 },
      { id: 'dij', type: 'end', text: 'Dijkstra', col: 0, row: 5 }
    ],
    edges: [
      { from: 'q0', to: 'bfs', label: 'no' }, { from: 'q0', to: 'q1', label: 'yes' },
      { from: 'q1', to: 'dag', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'fw', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'bf', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'astar', label: 'yes' }, { from: 'q4', to: 'dij', label: 'no' }
    ]
  };
  var CHOOSE_TEXT = {
    q0: 'Start here: do the edges carry different weights (distances, prices, times)? Pick <b>yes</b> or <b>no</b> on the lit question (click a label, or Tab to it and press Enter).',
    q1: 'Weighted. Does the graph have no cycles at all (a directed acyclic graph, like a course prerequisite chart)?',
    q2: 'It has cycles. Do you need the shortest path between <em>every pair</em> of vertices, not just from one start?',
    q3: 'One start vertex. Can any edge weight be negative (a refund, a discount, a gain)?',
    q4: 'Weights are 0 or more. Do you have one target, and a cheap estimate of the remaining cost (straight-line distance on a map, Manhattan distance on a grid)?',
    bfs: '<b>BFS</b> (lesson 26). With no weights, fewest edges is least weight, and a queue does it in O(V + E).',
    dag: '<b>Relax the edges in topological order</b> (lesson 27). In a DAG every vertex is settled after all of its predecessors, so one pass in O(V + E) suffices, even with negative weights.',
    fw: '<b>Floyd-Warshall</b> (lesson 29): three nested loops give every pair in O(V³), and negative edges are fine.',
    bf: '<b>Bellman-Ford</b> (lesson 29): relax every edge V − 1 times, O(V · E). It also detects negative cycles, where “shortest” stops making sense.',
    astar: '<b>A*</b>: Dijkstra plus an admissible guess. It expands only the vertices that look promising and still returns the cheapest route.',
    dij: '<b>Dijkstra</b>: non-negative weights and no useful estimate. O((V + E) log V) with a binary heap.'
  };
  function chooseFigure(fig) {
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which shortest-path algorithm decision tree' });
    var cap = fig.querySelector('[data-caption]');
    var path, taken;
    function reset() {
      path = ['q0']; taken = {};
      view.render({ active: 'q0' }, { duration: 0 });
      cap.innerHTML = CHOOSE_TEXT.q0;
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

  /* ================================================================== cost: measured heap work */
  function costGraphFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Measured heap comparisons' },
      { state: 'muted', shape: 'dash', label: '(V + E) · log₂ V, scaled to the last point' }
    ]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Measured heap comparisons of Dijkstra against the number of vertices' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { v: 'Vertices', e: 'Edges', pushes: 'Heap pushes', stale: 'Stale pops' }, states: { pushes: 'active', stale: 'muted' } });
    var k = 4, logScale = false, cache = {};
    var Ns = [];
    for (var n = 10; n <= 200; n += 10) Ns.push(n);
    function measure(deg) {
      if (cache[deg]) return cache[deg];
      var rng = V.rng(280 + deg), pts = [], lastRes = null, lastG = null;
      Ns.forEach(function (n) {
        var m = Math.min(Math.round(n * deg / 2), n * (n - 1) / 2);
        var g = SP.randomWeightedGraph(n, m, rng, { connected: true, maxW: 9 });
        var r = SP.dijkstraResult(g, 'V0');
        pts.push([n, r.compares]);
        lastRes = r; lastG = g;
      });
      var lastN = Ns[Ns.length - 1], lastE = lastG.edges.length;
      var scale = lastRes.compares / ((lastN + lastE) * Math.log2(lastN));
      var model = Ns.map(function (n) { var e = Math.min(Math.round(n * deg / 2), n * (n - 1) / 2); return [n, (n + e) * Math.log2(n) * scale]; });
      return (cache[deg] = { pts: pts, model: model, last: { v: lastN, e: lastE, pushes: lastRes.pushes, stale: lastRes.stale } });
    }
    function update(dur) {
      var d = measure(k);
      chart.render({
        x: { label: 'vertices V', min: 0, max: 200 },
        y: logScale ? { label: 'comparisons (log scale)', scale: 'log', min: 10, max: 100000 } : { label: 'heap comparisons', min: 0 },
        series: [
          { id: 'model', label: '(V+E) log V', points: d.model, state: 'muted', dashed: true, markers: false },
          { id: 'meas', label: 'measured', points: d.pts, state: 'active' }
        ],
        highlight: { series: 'meas', x: 150, label: V.vz.fmt(d.pts[14][1]) }
      }, { duration: dur });
      stats.update({ v: d.last.v, e: d.last.e, pushes: d.last.pushes, stale: d.last.stale });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Average edges per vertex, k', min: 2, max: 12, step: 2, value: k, onInput: function (v) { k = v; update(250); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (on) { logScale = on; update(700); } });
    update(0);
  }

  /* ================================================================== cost: cells expanded vs grid size */
  function costGridFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Dijkstra' }, { state: 'compare', shape: 'line', label: 'A* (Manhattan)' }, { state: 'done', shape: 'line', label: 'Greedy best-first' }
    ]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Cells expanded against grid side length' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { dij: 'Dijkstra at 60 × 60', ast: 'A* at 60 × 60', gre: 'Greedy at 60 × 60' }, states: { dij: 'active', ast: 'compare', gre: 'done' } });
    var Ns = [];
    for (var n = 5; n <= 60; n += 5) Ns.push(n);
    var cache = {};
    function walls(nn, seed, p) {
      var rng = V.rng(seed), w = [];
      for (var r = 0; r < nn; r++) for (var c = 0; c < nn; c++) { if ((r === 0 && c === 0) || (r === nn - 1 && c === nn - 1)) continue; if (rng() < p) w.push(r + ',' + c); }
      return w;
    }
    function measure(kind) {
      if (cache[kind]) return cache[kind];
      var out = { dij: [], ast: [], gre: [] };
      Ns.forEach(function (nn) {
        var grid = { rows: nn, cols: nn, walls: [] }, tries = 0;
        if (kind === 'walls') { do { grid.walls = walls(nn, 900 + nn + tries * 131, 0.2); tries++; } while (tries < 30 && !SP.gridSearchResult(grid, [0, 0], [nn - 1, nn - 1], { algo: 'dijkstra' }).found); }
        var t = [nn - 1, nn - 1];
        out.dij.push([nn, SP.gridSearchResult(grid, [0, 0], t, { algo: 'dijkstra' }).expanded]);
        out.ast.push([nn, SP.gridSearchResult(grid, [0, 0], t, { algo: 'astar' }).expanded]);
        out.gre.push([nn, SP.gridSearchResult(grid, [0, 0], t, { algo: 'greedy' }).expanded]);
      });
      return (cache[kind] = out);
    }
    var kind = 'open';
    function update(dur) {
      var d = measure(kind);
      chart.render({
        x: { label: 'grid side n (n × n cells)', min: 0, max: 60 },
        y: { label: 'cells expanded', min: 0 },
        series: [
          { id: 'dij', label: 'Dijkstra', points: d.dij, state: 'active' },
          { id: 'ast', label: 'A*', points: d.ast, state: 'compare' },
          { id: 'gre', label: 'greedy', points: d.gre, state: 'done' }
        ],
        highlight: [{ series: 'dij', x: 50 }, { series: 'ast', x: 50 }]
      }, { duration: dur });
      stats.update({ dij: d.dij[d.dij.length - 1][1], ast: d.ast[d.ast.length - 1][1], gre: d.gre[d.gre.length - 1][1] });
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Map', value: kind, options: [{ value: 'open', label: 'Open field' }, { value: 'walls', label: 'Random walls (20%)' }],
      onChange: function (v) { kind = v; update(700); }
    });
    update(0);
  }

  /* ================================================================== variations */
  function patterns() {
    // early exit: the explored area when the target is settled
    var grid = { rows: 11, cols: 19, walls: ['2,9', '3,9', '4,9', '5,9', '6,9', '7,9', '8,9'], mud: [] };
    var steps = SP.gridDijkstra(grid, [5, 3], [5, 6]);
    var found = steps.filter(function (st) { return st.kind === 'found'; })[0];
    var host = V.$('[data-mini="early"]');
    var view = V.views.grid(host, { mode: 'path', cellSize: 22, showValues: false, label: 'Dijkstra stopping at a nearby target' });
    var ov = L.gridOverlay(view);
    view.render(L.gridState(found, { heat: true }), { duration: 0 });
    ov.draw(found, { heat: true });
    V.onResize(host, function () { requestAnimationFrame(function () { ov.redraw(); }); });

    // bidirectional: two small circles vs one big one
    var W = 260, H = 200, Sx = 40, Tx = 220, cy = 100;
    var svg = s('svg', { class: 'dj-mini-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Two searches growing from both ends meet in the middle, covering a quarter of the area of one search that has to reach all the way across' });
    var big = s('circle', { class: 'bi-big', cx: Sx, cy: cy, r: 180 });
    var a = s('circle', { class: 'bi-a', cx: Sx, cy: cy, r: 0 }), b2 = s('circle', { class: 'bi-b', cx: Tx, cy: cy, r: 0 });
    var dotS = s('circle', { class: 'bi-dot', cx: Sx, cy: cy, r: 6 }), dotT = s('circle', { class: 'bi-dot is-t', cx: Tx, cy: cy, r: 6 });
    var meet = s('circle', { class: 'bi-meet', cx: (Sx + Tx) / 2, cy: cy, r: 0 });
    var lbS = s('text', { class: 'bi-lbl', x: Sx, y: cy + 22, 'text-anchor': 'middle' }, 'S'), lbT = s('text', { class: 'bi-lbl', x: Tx, y: cy + 22, 'text-anchor': 'middle' }, 'T');
    var clip = s('clipPath', { id: 'bi-clip' }, s('rect', { x: 0, y: 0, width: W, height: H }));
    svg.appendChild(s('defs', {}, clip));
    var grp = s('g', { 'clip-path': 'url(#bi-clip)' }, big, a, b2);
    [grp, dotS, dotT, meet, lbS, lbT].forEach(function (e) { svg.appendChild(e); });
    var biSteps = [];
    for (var t = 0; t <= 9; t++) biSteps.push({ r: t * 10 });
    biSteps.push({ r: 90, done: true });
    var biHost = V.$('[data-mini="bidir"]');
    biHost.appendChild(svg);
    V.teaser(biHost, {
      steps: biSteps, stepMs: 420, holdMs: 1400, instantWrap: true, staticIndex: biSteps.length - 1,
      render: function (st, ctx) {
        svg.style.setProperty('--t', (ctx.duration || 0) + 'ms');
        V.animate(a, { attr: { r: st.r } }, { duration: ctx.duration, ease: 'out' });
        V.animate(b2, { attr: { r: st.r } }, { duration: ctx.duration, ease: 'out' });
        V.animate(big, { attr: { r: st.r * 2 } }, { duration: ctx.duration, ease: 'out' });
        V.animate(meet, { attr: { r: st.done ? 7 : 0 } }, { duration: ctx.duration });
      }
    });

    // 0-1 BFS: a deque of (vertex, distance)
    var zo = V.$('[data-mini="zeroone"]');
    var dq = [
      { front: [['B', 3], ['E', 3]], back: [['C', 4], ['D', 4]], note: 'popped A (3)' },
      { front: [['F', 3], ['B', 3], ['E', 3]], back: [['C', 4], ['D', 4]], note: 'edge weight 0: push F on the front' },
      { front: [['F', 3], ['B', 3], ['E', 3]], back: [['C', 4], ['D', 4], ['G', 4]], note: 'edge weight 1: push G on the back' }
    ];
    var row = h('div', { class: 'dj-deque', role: 'img', 'aria-label': 'A double-ended queue: weight-0 neighbours join at the front, weight-1 neighbours at the back' });
    zo.appendChild(row);
    var noteEl = h('p', { class: 'dj-deque__note' });
    zo.appendChild(noteEl);
    var chipsById = {}, box = h('div', { class: 'dj-deque__chips' });
    row.appendChild(h('span', { class: 'dj-deque__end' }, 'front'));
    row.appendChild(box);
    row.appendChild(h('span', { class: 'dj-deque__end' }, 'back'));
    var dqSteps = dq.map(function (d, i) { return { i: i, items: d.front.concat(d.back), note: d.note }; });
    V.teaser(zo, {
      steps: dqSteps, stepMs: 1300, holdMs: 1200, instantWrap: true,
      render: function (st, ctx) {
        var want = {};
        st.items.forEach(function (it) { want[it[0]] = it; });
        Object.keys(chipsById).forEach(function (id) { if (!want[id]) { chipsById[id].remove(); delete chipsById[id]; } });
        st.items.forEach(function (it, i) {
          var c = chipsById[it[0]];
          if (!c) { c = chipsById[it[0]] = h('span', { class: 'dj-chip' }, h('b', { class: 'dj-chip__d' }, it[1]), h('span', { class: 'dj-chip__v' }, it[0])); }
          c.querySelector('.dj-chip__d').textContent = it[1];
          if (box.children[i] !== c) box.insertBefore(c, box.children[i] || null);
        });
        noteEl.textContent = st.note;
      }
    });

    // multi-source: two fire stations
    var g = L.WORLD;
    var withSuper = { nodes: g.nodes.map(function (n) { return n.id; }).concat(['*']), edges: g.edges.concat([['*', 'A', 0], ['*', 'K', 0]]), directed: false };
    var r = SP.dijkstraResult(withSuper, '*');
    var states = {}, dist = {};
    g.nodes.forEach(function (n) {
      var root = n.id, guard = 0;
      while (r.parent[root] && r.parent[root] !== '*' && guard++ < 50) root = r.parent[root];
      states[n.id] = n.id === 'A' || n.id === 'K' ? 'active' : root === 'A' ? 'frontier' : 'path';
      dist[n.id] = r.dist[n.id];
    });
    V.views.graph(V.$('[data-mini="multi"]'), { bounds: { w: 1000, h: 600 }, maxHeight: 200, nodeRadius: 24, minRadius: 15, label: 'Distance to the nearest of two sources' })
      .render(L.graphState(g, { states: states, dist: dist }, { sub: false }), { duration: 0 });

    var blocks = {
      early: 'while (queue.size > 0) {\n  const [d, u] = queue.pop();\n  if (d > dist.get(u)) continue;\n  if (u === target) return d;     // final: stop here\n  relaxEdgesOf(u);\n}',
      bidir: '// forward search from S, backward search from T (reverse edges)\n// alternate; stop when a vertex is settled by both\nbest = Infinity;\nwhile (fwd.notEmpty() && bwd.notEmpty()) {\n  step(fwd.top() <= bwd.top() ? fwd : bwd);\n  if (fwd.top() + bwd.top() >= best) break;\n}',
      zeroone: 'const dq = [[s, 0]];              // a deque\nwhile (dq.length) {\n  const [u, d] = dq.shift();\n  if (d > dist[u]) continue;\n  for (const [v, w] of adj[u]) {\n    if (d + w < dist[v]) {\n      dist[v] = d + w;\n      w === 0 ? dq.unshift([v, dist[v]]) : dq.push([v, dist[v]]);\n    }\n  }\n}',
      multi: 'for (const s of sources) {\n  dist.set(s, 0);\n  queue.push([0, s]);\n}\n// then the same loop as before'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
    var tabs = V.tabs('#patterns', {});
  }

  /* ================================================================== checks */
  function checks() {
    var fig = V.$('#fig-quiz-next');
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'done', label: 'Settled' }, { state: 'frontier', label: 'Tentative distance' }, { state: 'default', shape: 'outline', label: 'Not reached' }
    ]);
    var g = L.graph([['S', 90, 300], ['A', 330, 130], ['B', 330, 470], ['C', 620, 130], ['D', 640, 470]],
      [['S', 'A', 2], ['S', 'B', 4], ['A', 'C', 4], ['A', 'D', 5], ['B', 'D', 1]]);
    var steps = SP.dijkstra(g, 'S');
    var n = 0, snapIdx = -1;
    for (var i = 0; i < steps.length; i++) { if (steps[i].kind === 'settle' && ++n === 3) { snapIdx = i - 1; break; } }
    var base = steps[snapIdx];
    var state = Object.assign({}, base, { states: Object.assign({}, base.states), pulse: null });
    Object.keys(state.states).forEach(function (id) { if (state.states[id] === 'active') state.states[id] = 'done'; });
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 300, label: 'Dijkstra paused mid-search' });
    view.render(L.graphState(g, state), { duration: 0 });
    L.tagNodes(view);
    L.pqPanel(fig.querySelector('[data-pq]')).render(state, 0);
    var live = state.pq.filter(function (e) { return !e.stale; });
    var next = steps[snapIdx + 1].u;
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-next', id: 'quiz-next',
      question: 'Dijkstra from S has settled S and A. The queue holds ' + live.map(function (e) { return '(' + e.d + ', ' + e.v + ')'; }).join(', ') + '. <b>Click the vertex it settles next.</b>',
      check: function (id) {
        if (id === next) return true;
        var e = live.filter(function (x) { return x.v === id; })[0];
        if (e) return { correct: false, message: id + ' is in the queue at ' + e.d + ', but a smaller entry (' + live[0].d + ', ' + live[0].v + ') is waiting. Dijkstra takes the smallest distance in the queue.' };
        if (state.settled[id]) return { correct: false, message: id + ' is already settled. Its distance is final and it never returns to the queue.' };
        return { correct: false, message: id + ' has no distance yet, so it is not in the queue.' };
      },
      right: next + ' has the smallest distance in the queue (' + live[0].d + '). Note that D’s entry (7) will be replaced by a better one, 5 through B, once B is settled.'
    });

    V.quiz('#quiz-pq-size', {
      id: 'quiz-pq-size',
      question: 'Lazy Dijkstra runs on a directed graph with V vertices and E edges. Counting the very first entry for the start, at most how many entries are ever pushed into the priority queue?',
      options: ['V', 'E + 1', 'V²', 'V log V'],
      answer: 1,
      explain: [
        'Each vertex can be pushed more than once: every time a shorter route to it is found, a new entry goes in. V is too small in general.',
        'A push happens only after a successful relaxation of an edge, and each edge is relaxed at most once (when its tail is settled). So at most E pushes, plus the first entry for the start. That is why the time is O((V + E) log V) even with stale entries.',
        'V² would allow every pair of vertices to push, but pushes are tied to edges, and E can be far below V².',
        'The number of pushes depends on edges, not on a logarithm of the vertices.'
      ]
    });
    V.quiz('#quiz-guarantee', {
      id: 'quiz-guarantee',
      question: 'You multiply <em>every</em> edge weight in a graph by 10. What happens to the shortest paths that Dijkstra finds?',
      options: ['Nothing: the same routes, with distances 10 times larger', 'Routes with fewer edges become better', 'Some routes change, because the ties break differently', 'Dijkstra can no longer be used'],
      answer: 0,
      explain: [
        'A route’s total is the sum of its weights, so every total is multiplied by 10. The ordering of all routes is unchanged, and so are the shortest ones.',
        'Every route is scaled by the same factor, so no route gains on another. Adding a constant would favour fewer edges, but multiplying does not.',
        'The order of totals is unchanged, so a tie stays a tie and a strict winner stays the winner.',
        'Weights of 10 times the size are still non-negative, so every assumption holds.'
      ]
    });
    V.quiz('#quiz-negfix', {
      id: 'quiz-negfix',
      question: 'A graph has one edge of weight −4. A friend suggests adding 4 to <em>every</em> weight so they are all non-negative, then running Dijkstra. Will it find the original shortest paths?',
      options: ['Yes: every route shifts by the same amount', 'No: a route with more edges gains more than a route with fewer edges', 'Yes, but only on directed graphs', 'No: the graph would have a negative cycle'],
      answer: 1,
      explain: [
        'The shift is not the same for every route: a route with k edges gains 4k. Routes are not shifted equally, so their order can change.',
        'A route with 6 edges gains 24, while one with 2 edges gains only 8. A long cheap route can lose to a short dear one after the shift. Bellman-Ford is the tool for negative edges.',
        'Directedness does not change the argument: routes still gain 4 per edge.',
        'Adding a positive number cannot create a negative cycle; it makes weights larger.'
      ]
    });
  }

  /* ================================================================== summary card */
  function tiny(nodes, edges, o) {
    o = o || {};
    var svg = s('svg', { viewBox: '0 0 160 80', role: 'img', 'aria-label': o.label || '' });
    var P = {};
    nodes.forEach(function (n) { P[n[0]] = n; });
    edges.forEach(function (e) {
      var a = P[e[0]], b = P[e[1]], st = e[2];
      svg.appendChild(s('line', { x1: a[1], y1: a[2], x2: b[1], y2: b[2], style: 'stroke:' + (st ? 'var(--st-' + st + ')' : 'var(--el-edge)') + ';stroke-width:' + (st ? 2.5 : 1.5) + (e[4] ? ';stroke-dasharray:4 3' : '') }));
      if (e[3] !== undefined) svg.appendChild(s('text', { x: (a[1] + b[1]) / 2, y: (a[2] + b[2]) / 2 - 2, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 8px var(--font-mono);paint-order:stroke;stroke:var(--bg-elev);stroke-width:3px' }, e[3]));
    });
    nodes.forEach(function (n) {
      var st = n[3] || 'default';
      var fill = st === 'default' ? 'var(--el-fill)' : 'var(--st-' + st + ')';
      svg.appendChild(s('circle', { cx: n[1], cy: n[2], r: 8, style: 'fill:' + fill + ';stroke:' + (st === 'default' ? 'var(--el-stroke)' : 'var(--st-' + st + ')') + ';stroke-width:1.5' }));
      if (n[4] !== undefined) svg.appendChild(s('text', { x: n[1], y: n[2] - 12, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 9px var(--font-mono)' }, n[4]));
    });
    return svg;
  }
  function chipsSvg() {
    var svg = s('svg', { viewBox: '0 0 160 80', role: 'img', 'aria-label': 'A priority queue with a stale entry' });
    [['1', 'B', 0, ''], ['3', 'A', 1, ''], ['4', 'A', 2, 'stale']].forEach(function (c) {
      var x = 14 + c[2] * 46;
      svg.appendChild(s('rect', { x: x, y: 26, width: 40, height: 26, rx: 8, style: 'fill:' + (c[3] ? 'var(--bg-sunken)' : 'color-mix(in srgb, var(--st-frontier) 22%, var(--el-fill))') + ';stroke:' + (c[3] ? 'var(--el-stroke)' : 'var(--st-frontier)') + ';stroke-width:1.5' + (c[3] ? ';stroke-dasharray:3 2' : '') }));
      svg.appendChild(s('text', { x: x + 20, y: 43, 'text-anchor': 'middle', style: 'fill:' + (c[3] ? 'var(--ink-3)' : 'var(--ink)') + ';font:700 12px var(--font-mono)' + (c[3] ? ';text-decoration:line-through' : '') }, c[0] + ' ' + c[1]));
    });
    svg.appendChild(s('text', { x: 34, y: 20, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font:700 8px var(--font-sans)' }, 'MIN'));
    svg.appendChild(s('text', { x: 148, y: 66, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font:600 8px var(--font-sans)' }, 'discard'));
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: tiny([['u', 30, 50, 'done', 5], ['v', 130, 50, 'active', 8]], [['u', 'v', 'active', 3]], { label: 'Relaxation' }), label: 'Relax an edge', text: 'If dist[u] + w < dist[v], lower dist[v] and set parent[v] = u. Distances only go down.' },
      { svg: tiny([['s', 20, 44, 'done', 0], ['a', 62, 22, 'done', 2], ['b', 62, 66, 'frontier', 4], ['c', 110, 22, 'active', 3], ['d', 142, 56, 'default']], [['s', 'a', 'done', 2], ['a', 'c', 'done', 1], ['s', 'b', 'frontier', 4], ['c', 'd', undefined, 5]], { label: 'Closest first' }), label: 'Settle the closest', text: 'Pop the smallest distance: no detour can beat it when weights are 0 or more.' },
      { svg: chipsSvg(), label: 'Lazy deletion', text: 'Push a new entry on every improvement; discard an entry if its distance is out of date when popped.' },
      { svg: tiny([['s', 18, 40, 'done', 0], ['a', 58, 20, 'done', 2], ['b', 58, 62, 'done', 3], ['c', 104, 20, 'done', 4], ['t', 142, 44, 'found', 6]], [['s', 'a', 'done'], ['s', 'b', 'done'], ['a', 'c', 'done'], ['c', 't', 'path'], ['b', 't', undefined, 5, true]], { label: 'Parent pointers' }), label: 'Parents form a tree', text: 'Follow parent[v] back to the start to read a shortest route. All parents together are the shortest-path tree.' },
      { svg: tiny([['s', 20, 44, 'visited', 0], ['a', 70, 22, 'error', 1], ['b', 70, 64, 'visited', 2], ['t', 132, 44, 'error', 2]], [['s', 'a', 'visited', 1], ['s', 'b', 'visited', 2], ['b', 'a', 'error', -3], ['a', 't', 'visited', 1]], { label: 'Negative edge' }), label: 'Negative edges break it', text: 'A settled vertex is never revisited, so a later negative edge cannot fix it. Use Bellman-Ford.' },
      { svg: (function () {
        var svg = s('svg', { viewBox: '0 0 160 80', role: 'img', 'aria-label': 'A* search band toward the goal' });
        svg.appendChild(s('ellipse', { cx: 80, cy: 40, rx: 70, ry: 30, style: 'fill:color-mix(in srgb, var(--st-visited) 12%, transparent);stroke:var(--st-visited);stroke-dasharray:4 3;stroke-width:1.2' }));
        svg.appendChild(s('ellipse', { cx: 84, cy: 40, rx: 52, ry: 10, style: 'fill:color-mix(in srgb, var(--st-frontier) 22%, transparent);stroke:var(--st-frontier);stroke-width:1.5' }));
        svg.appendChild(s('circle', { cx: 18, cy: 40, r: 6, style: 'fill:var(--st-active)' }));
        svg.appendChild(s('circle', { cx: 144, cy: 40, r: 6, style: 'fill:none;stroke:var(--st-found);stroke-width:2.5' }));
        svg.appendChild(s('text', { x: 80, y: 74, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 9px var(--font-mono)' }, 'f = g + h'));
        return svg;
      }()), label: 'A* aims', text: 'Order by g + h with an admissible h and you still get the cheapest route, expanding far fewer cells.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-choose', chooseFigure);
    L.lazy('#fig-cost-graph', costGraphFigure);
    L.lazy('#fig-cost-grid', costGridFigure);
    L.lazy('#patterns', patterns);
    L.lazy('#check', checks);
    L.lazy('#summary-card', summaryCard);
  });
}());
