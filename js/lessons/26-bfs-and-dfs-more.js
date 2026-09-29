/* Lesson 26 · BFS & DFS — part 3: components, bipartite, cycles, patterns, cost charts, checks and summary.
   Needs js/lessons/26-bfs-and-dfs.js (VDSA.L26) and js/algos/26-bfs-and-dfs.js (VDSA.algos.graphSearch). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var GS = V.algos.graphSearch;
  var L = V.L26;
  var CC = [null, 'var(--u3)', 'var(--u4)', 'var(--u6)', 'var(--u5)'];

  /* ================================================================== connected components */
  function componentsFigure(fig) {
    var g = L.graph(
      [['A', 90, 150], ['B', 260, 60], ['C', 230, 320], ['D', 420, 190], ['E', 400, 450], ['F', 610, 80], ['G', 830, 110], ['H', 720, 290], ['I', 570, 480], ['J', 790, 520], ['K', 940, 330]],
      [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['F', 'G'], ['G', 'H'], ['F', 'H'], ['I', 'J']]);
    var steps = GS.components(g);
    var n = L.last(steps).count;
    var items = [{ state: 'default', shape: 'outline', label: 'No component yet' }, { state: 'frontier', label: 'Queued' }, { state: 'active', label: 'Current' }];
    for (var k = 1; k <= Math.min(4, n); k++) items.push({ state: 'default', color: CC[k], label: 'Component ' + k });
    L.legend(fig.querySelector('[data-legend]'), items);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: 'auto', label: 'A graph with several components', maxHeight: 360 });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Components controls',
      render: function (step, ctx) {
        view.render(L.graphState(g, step, {
          mapNode: function (node) {
            var c = step.comp[node.id];
            if (c !== null && node.state === 'visited') node.state = 'cc' + Math.min(4, c);
            if (c !== null) node.badge = c;
            if (step.scan === node.id && node.state !== 'active') node.sub = 'scan';
          }
        }), { duration: ctx.duration });
      }
    });
  }

  /* ================================================================== bipartite */
  function bipartiteFigure(fig) {
    var nodes = [['A', 500, 70], ['B', 760, 200], ['C', 760, 420], ['D', 500, 540], ['E', 240, 420], ['F', 240, 200]];
    var ring = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A'], ['B', 'E']];
    var graphs = { even: L.graph(nodes, ring), odd: L.graph(nodes, ring.concat([['C', 'E']])) };
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'var(--u1)', label: 'Side A' }, { state: 'default', color: 'var(--u3)', label: 'Side B' },
      { state: 'compare', shape: 'line', label: 'Edge being checked' }, { state: 'error', label: 'Conflict: odd cycle' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: 'auto', label: 'Two-colouring a graph', maxHeight: 360 });
    var mode = 'even';
    function render(step, ctx) {
      var g = graphs[mode];
      view.render(L.graphState(g, step, {
        mapNode: function (node) {
          var sd = step.side[node.id];
          if (node.state !== 'error') node.state = sd === 0 ? 'sidea' : sd === 1 ? 'sideb' : 'default';
          if (sd !== null) { node.badge = 'AB'[sd]; node.badgeState = node.id === step.current ? 'active' : 'default'; }
        },
        mapEdge: function (e) { if (e.state === 'visited') e.state = 'default'; }
      }), { duration: ctx.duration });
    }
    var player = V.player({ root: fig, steps: GS.bipartite(graphs.even), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Two-colouring controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph', value: 'even',
      options: [{ value: 'even', label: 'Six-cycle with a chord' }, { value: 'odd', label: 'Add the edge C–E' }],
      onChange: function (v) { mode = v; player.setSteps(GS.bipartite(graphs[v])); }
    });
  }

  /* ================================================================== cycles: DFS edge classes */
  function cyclesFigure(fig) {
    var nodes = [['A', 110, 300], ['B', 340, 110], ['C', 340, 490], ['D', 620, 110], ['E', 860, 300]];
    var edges = [['A', 'B'], ['A', 'C'], ['A', 'E'], ['B', 'D'], ['D', 'E'], ['E', 'B'], ['C', 'D']];
    var graphs = {
      cyc: L.graph(nodes, edges, true),
      dag: L.graph(nodes, edges.filter(function (e) { return e.join('') !== 'EB'; }), true)
    };
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'On the stack' }, { state: 'active', label: 'Current' }, { state: 'visited', label: 'Finished' },
      { state: 'visited', shape: 'line', label: 'Tree' }, { state: 'error', shape: 'line', label: 'Back (cycle!)' },
      { state: 'pivot', shape: 'dash', label: 'Forward' }, { state: 'muted', shape: 'dash', label: 'Cross' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: 'auto', label: 'DFS on a directed graph', maxHeight: 360 });
    var mode = 'cyc';
    var CLS = { tree: ['visited', false], back: ['error', false], forward: ['pivot', true], cross: ['muted', true] };
    function render(step, ctx) {
      view.render(L.graphState(graphs[mode], step, {
        sub: 'times',
        mapNode: function (node) { if (step.cycle && step.cycle.indexOf(node.id) !== -1) node.state = 'error'; },
        mapEdge: function (e) {
          var c = step.edgeClass[e.id];
          if (c && !e.pulse) { e.state = CLS[c][0]; e.dashed = CLS[c][1]; }
          if (c && e.pulse) e.dashed = CLS[c][1];
        }
      }), { duration: ctx.duration });
    }
    var player = V.player({ root: fig, steps: GS.dfs(graphs.cyc, 'A', { all: true }), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1050, label: 'Cycle detection controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph', value: 'cyc',
      options: [{ value: 'cyc', label: 'With the edge E → B' }, { value: 'dag', label: 'Without it' }],
      onChange: function (v) { mode = v; player.setSteps(GS.dfs(graphs[v], 'A', { all: true })); }
    });
  }

  /* ================================================================== patterns (tabs with mini visuals) */
  function patterns(tabsEl) {
    V.tabs(tabsEl);
    // multi-source BFS: a wave from two sources, looping quietly
    var R = 6, C = 12, sources = [[1, 1], [4, 10]], walls = ['0,5', '1,5', '2,5', '4,6', '5,6', '3,8'];
    var wallSet = {};
    walls.forEach(function (w) { wallSet[w] = true; });
    var dist = {}, q = [];
    sources.forEach(function (p) { dist[p.join(',')] = 0; q.push(p); });
    var maxD = 0;
    while (q.length) {
      var u = q.shift(), du = dist[u.join(',')];
      maxD = Math.max(maxD, du);
      [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(function (d) {
        var r = u[0] + d[0], c = u[1] + d[1], k = r + ',' + c;
        if (r < 0 || c < 0 || r >= R || c >= C || wallSet[k] || dist[k] !== undefined) return;
        dist[k] = du + 1; q.push([r, c]);
      });
    }
    var steps = [];
    for (var layer = 0; layer <= maxD; layer++) {
      var cells = {};
      Object.keys(dist).forEach(function (k) { if (dist[k] <= layer) cells[k] = { state: dist[k] === layer ? 'frontier' : 'visited', label: dist[k] }; });
      steps.push({ cells: cells });
    }
    var host = V.$('[data-mini="multi"]');
    var gv = V.views.grid(host, { mode: 'path', cellSize: 24, label: 'Multi-source BFS distances' });
    V.teaser(host, {
      steps: steps, stepMs: 600, holdMs: 1600, instantWrap: true,
      render: function (st, ctx) {
        gv.render({ rows: R, cols: C, walls: walls.map(function (w) { return w.split(',').map(Number); }), cells: st.cells,
          markers: sources.map(function (p, i) { return { id: 'src' + i, kind: 'start', cell: p, label: '' }; }) }, { duration: ctx.duration });
      }
    });
    // iterative DFS: frames of (vertex, next neighbour index)
    V.views.stack(V.$('[data-mini="iter"]'), { cellSize: 30, cellWidth: 110, label: 'Explicit DFS stack' }).render({
      items: [{ id: 'a', value: 'A · next 2', state: 'frontier' }, { id: 'b', value: 'B · next 1', state: 'frontier' }, { id: 'd', value: 'D · next 0', state: 'active' }]
    }, { duration: 0 });
    // implicit graph: a word ladder
    var words = L.graph([['cold', 100, 300], ['cord', 300, 300], ['card', 500, 150], ['word', 500, 450], ['ward', 700, 300], ['warm', 900, 300], ['colt', 200, 520]],
      [['cold', 'cord'], ['cord', 'card'], ['cord', 'word'], ['card', 'ward'], ['word', 'ward'], ['ward', 'warm'], ['cold', 'colt']]);
    V.views.graph(V.$('[data-mini="implicit"]'), { label: 'Word ladder from cold to warm', maxHeight: 170, nodeRadius: 22, minRadius: 17 }).render(L.graphState(words, {
      states: { cold: 'active', cord: 'path', card: 'path', ward: 'path', warm: 'found', word: 'visited', colt: 'visited' },
      edges: { 'cold-cord': 'path', 'card-cord': 'path', 'card-ward': 'path', 'ward-warm': 'path' }
    }), { duration: 0 });
    var blocks = {
      multi: 'const queue = [...sources];\nconst dist = new Map(sources.map((s) => [s, 0]));\nwhile (queue.length) {\n  const u = queue.shift();\n  for (const v of neighbours(u))\n    if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); queue.push(v); }\n}',
      iter: 'const stack = [[s, 0]]; seen.add(s);\nwhile (stack.length) {\n  const top = stack[stack.length - 1];\n  const [u, i] = top;\n  if (i === adj[u].length) { stack.pop(); continue; }  // finished\n  top[1] = i + 1;\n  const v = adj[u][i];\n  if (!seen.has(v)) { seen.add(v); stack.push([v, 0]); }  // dive\n}',
      implicit: 'function neighbours(word) {\n  const out = [];\n  for (let i = 0; i < word.length; i++)\n    for (const ch of "abcdefghijklmnopqrstuvwxyz") {\n      const w = word.slice(0, i) + ch + word.slice(i + 1);\n      if (w !== word && dictionary.has(w)) out.push(w);\n    }\n  return out;\n}'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
  }

  /* ================================================================== cost: measured work vs V */
  function costFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Adjacency list: V + 2E steps' },
      { state: 'compare', shape: 'line', label: 'Adjacency matrix: V + V² steps' }
    ]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Measured BFS operations against the number of vertices' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { v: 'Vertices', e: 'Edges', list: 'List steps', matrix: 'Matrix steps' }, states: { list: 'active', matrix: 'compare' } });
    var k = 4, logScale = false, cache = {};
    var Ns = [];
    for (var n = 10; n <= 200; n += 10) Ns.push(n);
    function measure(deg) {
      if (cache[deg]) return cache[deg];
      var rng = V.rng(260 + deg), list = [], matrix = [], last = null;
      Ns.forEach(function (n) {
        var m = Math.min(Math.round(n * deg / 2), n * (n - 1) / 2);
        var g = GS.randomGraph(n, m, rng, { connected: true });
        var r = GS.bfsResult(g, 'V0');
        list.push([n, r.visited + r.checks]);
        matrix.push([n, r.visited + r.visited * n]);
        last = { v: n, e: g.edges.length, list: r.visited + r.checks, matrix: r.visited + r.visited * n };
      });
      return (cache[deg] = { list: list, matrix: matrix, last: last });
    }
    function update(dur) {
      var d = measure(k);
      chart.render({
        x: { label: 'vertices V', min: 0, max: 200 },
        y: logScale ? { label: 'steps (log scale)', scale: 'log', min: 10, max: 100000 } : { label: 'steps', min: 0, max: 42000 },
        series: [
          { id: 'list', label: 'list', points: d.list, state: 'active' },
          { id: 'matrix', label: 'matrix', points: d.matrix, state: 'compare' }
        ],
        highlight: { series: 'list', x: 150, label: V.vz.fmt(d.list[14][1]) }
      }, { duration: dur });
      stats.update({ v: d.last.v, e: d.last.e, list: d.last.list.toLocaleString('en'), matrix: d.last.matrix.toLocaleString('en') });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Average neighbours per vertex, k', min: 2, max: 16, step: 2, value: k, onInput: function (v) { k = v; update(250); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (on) { logScale = on; update(700); } });
    update(0);
  }

  /* Largest frontier on four shapes: measured queue peak (BFS) and stack depth (DFS). */
  function spaceFigure(fig) {
    function tree(branch, depth) {
      var nodes = ['V0'], edges = [], frontier = ['V0'], id = 1;
      for (var d = 0; d < depth; d++) {
        var next = [];
        frontier.forEach(function (p) { for (var b = 0; b < branch; b++) { var c = 'V' + id++; nodes.push(c); edges.push([p, c]); next.push(c); } });
        frontier = next;
      }
      return { nodes: nodes, edges: edges };
    }
    function path(n) { var nodes = [], edges = []; for (var i = 0; i < n; i++) { nodes.push('V' + i); if (i) edges.push(['V' + (i - 1), 'V' + i]); } return { nodes: nodes, edges: edges }; }
    function lattice(r, c) { var nodes = [], edges = []; for (var i = 0; i < r * c; i++) { nodes.push('V' + i); if (i % c < c - 1) edges.push(['V' + i, 'V' + (i + 1)]); if (i + c < r * c) edges.push(['V' + i, 'V' + (i + c)]); } return { nodes: nodes, edges: edges }; }
    function complete(n) { var nodes = [], edges = []; for (var i = 0; i < n; i++) { nodes.push('V' + i); for (var j = 0; j < i; j++) edges.push(['V' + j, 'V' + i]); } return { nodes: nodes, edges: edges }; }
    var shapes = [['bushy tree', tree(4, 3)], ['long path', path(40)], ['grid', lattice(8, 8)], ['complete', complete(12)]];
    var bfsV = [], dfsV = [];
    shapes.forEach(function (sh) { bfsV.push(GS.bfsResult(sh[1], 'V0').peak); dfsV.push(GS.dfsResult(sh[1], 'V0').maxDepth); });
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Largest frontier for BFS and DFS on four graph shapes' });
    var shown = false;
    function draw(dur) {
      chart.render({
        categories: shapes.map(function (sh) { return sh[0]; }),
        series: [{ id: 'bfs', label: 'BFS queue', values: bfsV, state: 'frontier' }, { id: 'dfs', label: 'DFS stack', values: dfsV, state: 'pivot' }],
        y: { label: 'vertices held at once', min: 0 }
      }, { duration: dur });
    }
    V.onVisible(fig, function (vis) { if (vis && !shown) { shown = true; draw(900); } });
    draw(0);
  }

  /* ================================================================== checks */
  function checks() {
    // Click the next vertex BFS will take
    var fig = V.$('#fig-quiz-bfs');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'In the queue' }, { state: 'visited', label: 'Visited' }, { state: 'default', shape: 'outline', label: 'Unseen' }]);
    var g = L.graph([['S', 110, 300], ['A', 330, 150], ['B', 330, 450], ['C', 570, 80], ['D', 590, 280], ['E', 570, 500], ['F', 830, 170], ['G', 840, 420]],
      [['S', 'A'], ['S', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'E'], ['C', 'F'], ['D', 'G'], ['E', 'G']]);
    var steps = GS.bfs(g, 'S');
    var snap = null, n = 0;
    for (var i = 0; i < steps.length; i++) { if (steps[i].kind === 'dequeue' && ++n === 3) { snap = steps[i - 1]; break; } }
    var state = Object.assign({}, snap, { states: Object.assign({}, snap.states) });
    Object.keys(state.states).forEach(function (id) { if (state.states[id] === 'active') state.states[id] = 'visited'; });
    state.pulse = null;
    var view = V.views.graph(fig.querySelector('[data-stage]'), { label: 'BFS paused mid-search', maxHeight: 300 });
    view.render(L.graphState(g, state, { badge: 'dist' }), { duration: 0 });
    L.tagNodes(view);
    V.views.queue(fig.querySelector('[data-container]'), { cellSize: 36, label: 'Queue' }).render(L.queueState(state), { duration: 0 });
    var front = state.queue[0].v, qtxt = state.queue.map(function (x) { return x.v; }).join(', ');
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-next-bfs', id: 'click-next-bfs',
      question: 'BFS from S has visited S and A, and the queue holds ' + qtxt + '. <b>Click the vertex BFS takes next.</b>',
      check: function (id) {
        if (id === front) return true;
        var inQ = state.queue.some(function (x) { return x.v === id; });
        if (inQ) return { correct: false, message: id + ' is in the queue, but not at the front. A queue is first in, first out: ' + front + ' has waited longest.' };
        if (state.states[id] === 'visited') return { correct: false, message: id + ' is already visited. BFS never takes a vertex twice.' };
        return { correct: false, message: id + ' has not been discovered yet, so it is not in the queue at all.' };
      },
      right: front + ' is at the front of the queue: it was discovered first, from S, so it leaves first. Taking the newest (' + L.last(state.queue).v + ') would be depth-first.'
    });

    var small = { nodes: ['A', 'B', 'C', 'D', 'E', 'F'], edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['D', 'F']] };
    var dOrder = GS.dfsResult(small, 'A').order.join(' '), bOrder = GS.bfsResult(small, 'A').order.join(' ');
    V.quiz('#quiz-dfs-order', {
      id: 'quiz-dfs-order',
      question: 'Edges: A–B, A–C, B–D, C–D, C–E, D–F. In which order does DFS from A <em>discover</em> the vertices, trying neighbours in alphabetical order?',
      options: ['<code>' + bOrder + '</code>', '<code>' + dOrder + '</code>', '<code>A B D F C E</code>', '<code>A C E D B F</code>'],
      answer: 1,
      explain: [
        'That is the BFS order: all of A’s neighbours (B, C) before anything further away.',
        'A → B (first neighbour) → D (B’s first unseen) → C (D’s neighbours are B, C, F; C comes first) → E (C’s last unseen) → back up to D → F.',
        'At D the neighbours are tried in the order B, C, F. B is seen, so DFS dives into C before F.',
        'DFS tries A’s neighbours alphabetically, so it goes to B first, not C.'
      ]
    });
    V.quiz('#quiz-shortest', {
      id: 'quiz-shortest-length',
      question: 'On the lesson graph, BFS from A gives dist[I] = 4. You add one new edge, A–G. What does BFS now report for dist[I]?',
      options: ['1', '2', '3', '4'],
      answer: 1,
      explain: [
        'A and I are still not neighbours, so I is at least 2 edges away.',
        'G is now at distance 1, and G–I is an edge, so BFS discovers I from G at distance 2: A → G → I.',
        'The new edge makes a 2-edge route A → G → I, and BFS always finds a fewest-edge route.',
        'Before the new edge the answer was 4. The shortcut through G cuts it to 2.'
      ]
    });
    V.quiz('#quiz-mark', {
      id: 'quiz-mark-when',
      question: 'What goes wrong if BFS marks a vertex as seen only when it leaves the queue, instead of when it enters?',
      options: ['The distances come out wrong', 'The same vertex can wait in the queue many times, wasting time and memory', 'It turns into a depth-first search', 'Nothing changes at all'],
      answer: 1,
      explain: [
        'The first copy of each vertex still leaves the queue at its correct distance; the order of visits is unchanged. The damage is elsewhere.',
        'Until a vertex is marked, every neighbour that finds it adds another copy. On a dense graph the queue can hold far more entries than there are vertices.',
        'The queue is still first in, first out, so the visiting order stays breadth-first.',
        'The answer is the same, but the work is not: on five vertices that all know each other the queue took 11 entries instead of 5.'
      ]
    });
    V.quiz('#quiz-when', {
      id: 'quiz-when-bfs',
      question: 'Which of these does <b>one plain BFS</b> answer directly? Pick all that apply.',
      options: ['The fewest knight moves between two chessboard squares', 'The cheapest route when roads have different tolls', 'The distance from every cell of a maze to its nearest exit', 'Whether a directed graph has a cycle, by spotting an edge to an ancestor'],
      answer: [0, 2],
      explain: 'Knight moves are unweighted edges, so BFS counts them exactly. Nearest exit is multi-source BFS: start the queue with every exit. Tolls are weights, which need Dijkstra. An edge back to an ancestor still on the stack is DFS’s back edge; BFS has no such stack.'
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
      svg.appendChild(s('line', { x1: a[1], y1: a[2], x2: b[1], y2: b[2], style: 'stroke:' + (st ? 'var(--st-' + st + ')' : 'var(--el-edge)') + ';stroke-width:' + (st ? 2.5 : 1.5) + (e[3] ? ';stroke-dasharray:4 3' : '') }));
    });
    nodes.forEach(function (n) {
      var st = n[3] || 'default';
      var fill = st === 'default' ? 'var(--el-fill)' : st === 'visited' ? 'color-mix(in srgb, var(--st-visited) 25%, var(--el-fill))' : 'var(--st-' + st + ')';
      svg.appendChild(s('circle', { cx: n[1], cy: n[2], r: 8, style: 'fill:' + fill + ';stroke:' + (st === 'default' ? 'var(--el-stroke)' : 'var(--st-' + st + ')') + ';stroke-width:1.5' }));
      if (n[4] !== undefined) svg.appendChild(s('text', { x: n[1], y: n[2] - 12, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 9px var(--font-mono)' }, n[4]));
    });
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: tiny([['a', 20, 40, 'visited', 0], ['b', 60, 18, 'visited', 1], ['c', 60, 62, 'visited', 1], ['d', 100, 18, 'frontier', 2], ['e', 100, 62, 'frontier', 2], ['f', 140, 40, 'default']], [['a', 'b', 'visited'], ['a', 'c', 'visited'], ['b', 'd', 'visited'], ['c', 'e', 'visited'], ['d', 'f'], ['e', 'f']], { label: 'BFS layers' }),
        label: 'Queue → BFS', text: 'Oldest first: layer by layer, so the first route found has the fewest edges.' },
      { svg: tiny([['a', 20, 40, 'frontier'], ['b', 55, 20, 'frontier'], ['c', 90, 40, 'frontier'], ['d', 125, 60, 'active'], ['e', 55, 62, 'default'], ['f', 125, 18, 'default']], [['a', 'b', 'visited'], ['b', 'c', 'visited'], ['c', 'd', 'visited'], ['a', 'e'], ['c', 'f']], { label: 'DFS route' }),
        label: 'Stack → DFS', text: 'Newest first: dive along one route, back up at dead ends. Recursion is the stack.' },
      { svg: tiny([['a', 30, 40, 'visited'], ['b', 80, 18, 'frontier'], ['c', 80, 62, 'frontier'], ['d', 130, 40, 'frontier']], [['a', 'b', 'visited'], ['a', 'c', 'visited'], ['b', 'd', 'visited'], ['c', 'd', 'compare']], { label: 'Mark on discovery' }),
        label: 'Mark when discovered', text: 'Every vertex enters the frontier once. Marking later fills the queue with copies.' },
      { svg: tiny([['a', 20, 40, 'path', 0], ['b', 60, 20, 'path', 1], ['c', 100, 20, 'path', 2], ['d', 140, 40, 'found', 3], ['e', 80, 64, 'visited', 1]], [['a', 'b', 'path'], ['b', 'c', 'path'], ['c', 'd', 'path'], ['a', 'e'], ['e', 'd']], { label: 'Parent pointers' }),
        label: 'Distances and parents', text: 'dist[v] = dist[u] + 1 and parent[v] = u. Follow parents back to rebuild a shortest path.' },
      { svg: tiny([['a', 25, 60, 'visited'], ['b', 70, 20, 'frontier'], ['c', 120, 20, 'frontier'], ['d', 120, 64, 'active']], [['a', 'b', 'visited'], ['b', 'c', 'visited'], ['c', 'd', 'visited'], ['d', 'b', 'error']], { label: 'Back edge' }),
        label: 'Back edge = cycle', text: 'An edge to a vertex still on the DFS stack closes a cycle. d/f times nest like brackets.' },
      { svg: tiny([['a', 20, 55, 'visited'], ['b', 55, 25, 'visited'], ['c', 90, 55, 'visited'], ['d', 125, 25, 'visited'], ['e', 145, 60, 'visited']], [['a', 'b', 'visited'], ['b', 'c', 'visited'], ['c', 'd', 'visited'], ['d', 'e', 'visited'], ['a', 'c'], ['c', 'e']], { label: 'Every vertex and edge once' }),
        label: 'O(V + E)', text: 'Each vertex leaves the frontier once and each adjacency list is read once. A matrix makes it O(V²).' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-components', componentsFigure);
    L.lazy('#fig-bipartite', bipartiteFigure);
    L.lazy('#fig-cycles', cyclesFigure);
    L.lazy('#patterns', patterns);
    L.lazy('#fig-cost', costFigure);
    L.lazy('#fig-space', spaceFigure);
    L.lazy('#check', checks);
    L.lazy('#summary-card', summaryCard);
  });
}());
