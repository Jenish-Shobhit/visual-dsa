/* Lesson 25 · Graphs & representations — part 3: memory chart, decision diagram, implicit grid, special graphs,
   two-colouring lab, variations, checks and the summary card. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var G = V.algos.graphs, L = V.L25;

  function fmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }
  function circle(n, o) { return V.views.graph.layouts.circle(n, Object.assign({ w: 1000, h: 600, pad: 95 }, o || {})); }

  /* ================================================================== memory versus V (chart + calculator) */
  function memoryFigure(fig) {
    var d = 4, n = 60, log = false;
    var chart = V.views.chart(fig.querySelector('[data-chart]'), { type: 'line', height: 300, label: 'Memory cells needed by an adjacency matrix and an adjacency list as the number of vertices V grows' });
    var stats = V.stats(fig.querySelector('[data-stats]'), {
      labels: { mm: 'Matrix cells', ml: 'List cells', em: 'Is u–v an edge? matrix', el: 'Is u–v an edge? list', nm: 'List neighbours: matrix', nl: 'List neighbours: list' },
      states: { mm: 'active', ml: 'path' }, format: function (v) { return typeof v === 'number' ? fmt(v) : v; }
    });
    function draw(dur) {
      var series = [
        { id: 'matrix', label: 'matrix: V²', fn: function (x) { return x * x; }, domain: [2, 200], state: 'active' },
        { id: 'dense', label: 'list, dense graph', fn: function (x) { return x + x * (x - 1); }, domain: [2, 200], state: 'muted', dashed: true },
        { id: 'list', label: 'list, ' + d + ' friends each', fn: function (x) { return x + x * Math.min(d, x - 1); }, domain: [2, 200], state: 'path' }
      ];
      chart.render({
        x: { label: 'number of vertices V', min: 2, max: 200 },
        y: log ? { label: 'cells of memory (log scale)', scale: 'log', min: 1, max: 100000 } : { label: 'cells of memory', min: 0, max: 40000 },
        series: series,
        highlight: [{ series: 'matrix', x: n, label: fmt(n * n) }, { series: 'list', x: n, label: fmt(n + n * Math.min(d, n - 1)) }]
      }, { duration: dur === undefined ? 500 : dur });
      var dd = Math.min(d, n - 1);
      stats.update({ mm: n * n, ml: n + n * dd, em: '1 read', el: '≤ ' + dd + ' reads', nm: n + ' reads', nl: dd + ' reads' });
    }
    draw(0);
    V.slider(fig.querySelector('[data-slider-d]'), { label: 'Friends per vertex d', min: 1, max: 30, value: d, onInput: function (x) { d = x; draw(150); } });
    V.slider(fig.querySelector('[data-slider-n]'), { label: 'Vertices V', min: 5, max: 200, value: n, onInput: function (x) { n = x; draw(150); } });
    V.toggle(fig.querySelector('[data-log]'), { label: 'Log scale', checked: false, onChange: function (c) { log = c; draw(900); } });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Matrix: V × V cells' },
      { state: 'path', shape: 'line', label: 'List, sparse graph' },
      { state: 'muted', shape: 'dash', label: 'List, dense graph', color: 'var(--ink-3)' }
    ]);
  }

  /* ================================================================== "matrix or list?" decision diagram */
  function chooseFigure(fig) {
    var spec = {
      nodes: [
        { id: 'q0', type: 'decision', text: 'Too big or too regular to store?', col: 0, row: 0 },
        { id: 'implicit', type: 'end', text: 'Implicit graph: compute neighbours on demand', col: 1, row: 0, maxWidth: 190 },
        { id: 'q1', type: 'decision', text: 'Only scan or sort all edges?', col: 0, row: 1 },
        { id: 'elist', type: 'end', text: 'Edge list', col: 1, row: 1 },
        { id: 'q2', type: 'decision', text: 'Dense, and V small?', col: 0, row: 2 },
        { id: 'matrix', type: 'end', text: 'Adjacency matrix', col: 1, row: 2 },
        { id: 'q3', type: 'decision', text: 'Mostly asking “is u–v an edge?”', col: 0, row: 3 },
        { id: 'matrix2', type: 'end', text: 'Matrix, or a hash set of edges', col: 1, row: 3, maxWidth: 190 },
        { id: 'list', type: 'end', text: 'Adjacency list (the default)', col: 0, row: 4, maxWidth: 190 }
      ],
      edges: [
        { from: 'q0', to: 'implicit', label: 'yes' }, { from: 'q0', to: 'q1', label: 'no' },
        { from: 'q1', to: 'elist', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
        { from: 'q2', to: 'matrix', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
        { from: 'q3', to: 'matrix2', label: 'yes' }, { from: 'q3', to: 'list', label: 'no' }
      ]
    };
    var stage = fig.querySelector('[data-stage]');
    var flow = V.views.flowchart(stage, spec, { interactive: true, label: 'Decision diagram: which way to store a graph' });
    var path = ['q0'], taken = {}, timers = [];
    var out = fig.querySelector('[data-result]');
    var ANSWERS = {
      implicit: 'A grid, a chess board or a puzzle has a huge or regular graph. Do not build it: write a function that returns the neighbours of any state.',
      elist: 'Algorithms such as Kruskal only sort and scan the edges, so a plain list of (u, v, weight) triples is smallest and simplest.',
      matrix: 'When almost every pair is linked and V is small, the V × V table wastes little and gives constant-time edge checks.',
      matrix2: 'If the constant-time question “is u–v an edge?” dominates, a matrix (or a hash set of edges) answers it in one step.',
      list: 'Most real graphs are sparse. An adjacency list costs V + E cells and walks a vertex’s neighbours in exactly its degree. This is the default for BFS, DFS and shortest paths.'
    };
    function show(dur) {
      var cur = path[path.length - 1];
      flow.render({ active: cur, visited: path.slice(0, -1), edgeStates: taken }, { duration: dur === undefined ? 500 : dur });
      out.innerHTML = ANSWERS[cur] ? '<b>' + spec.nodes.filter(function (n) { return n.id === cur; })[0].text + '.</b> ' + ANSWERS[cur] : 'Answer the question by clicking <b>yes</b> or <b>no</b> on the diagram.';
    }
    function go(to, label, from) { path.push(to); taken[from + '->' + to] = 'path'; show(); }
    flow.on('choose', function (e) { go(e.to, e.label, e.node); });
    function reset() { timers.forEach(clearTimeout); timers = []; path = ['q0']; taken = {}; show(0); }
    fig.querySelector('[data-reset]').addEventListener('click', reset);
    var scenarios = [
      { label: 'Friends on a social network', run: [['q0', 'q1'], ['q1', 'q2'], ['q2', 'q3'], ['q3', 'list']] },
      { label: 'A maze or a chess board', run: [['q0', 'implicit']] },
      { label: 'Kruskal’s minimum spanning tree', run: [['q0', 'q1'], ['q1', 'elist']] },
      { label: 'Distances between 100 cities', run: [['q0', 'q1'], ['q1', 'q2'], ['q2', 'matrix']] },
      { label: 'Millions of “are they friends?” checks, 3,000 people', run: [['q0', 'q1'], ['q1', 'q2'], ['q2', 'q3'], ['q3', 'matrix2']] }
    ];
    var row = fig.querySelector('[data-scenarios]');
    scenarios.forEach(function (sc) {
      var b = h('button', { type: 'button', class: 'btn btn--soft btn--sm' }, sc.label);
      b.addEventListener('click', function () {
        reset();
        sc.run.forEach(function (st, i) { timers.push(setTimeout(function () { go(st[1], '', st[0]); }, V.reducedMotion() ? 0 : 700 * (i + 1))); });
      });
      row.appendChild(b);
    });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Where you are' }, { state: 'visited', label: 'Answered' }, { state: 'path', shape: 'line', label: 'Your route' }]);
    show(0);
  }

  /* ================================================================== a grid is an implicit graph */
  function implicitFigure(fig) {
    var R = 11, C = 21, diag = false, mode = 'inspect', wander = null;
    var walls = {}, sel = [1, 1];
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.grid(stage, { mode: 'path', cellSize: 34, showValues: false, label: 'Maze grid. Select a cell to see its neighbours, which are computed on demand.' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { open: 'Open cells (vertices)', edges: 'Edges it defines', nb: 'Neighbours of the selected cell', stored: 'Edges stored in memory' }, states: { stored: 'done' } });
    function key(r, c) { return r + ',' + c; }
    function maze(seed) {
      var rng = V.rng(seed), open = {}, w = {};
      (function visit(r, c) {
        open[key(r, c)] = true;
        V.shuffle([[0, 2], [2, 0], [0, -2], [-2, 0]], rng).forEach(function (dd) {
          var nr = r + dd[0], nc = c + dd[1];
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || open[key(nr, nc)]) return;
          open[key(r + dd[0] / 2, c + dd[1] / 2)] = true;
          visit(nr, nc);
        });
      }(1, 1));
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (!open[key(r, c)]) w[key(r, c)] = true;
      return w;
    }
    walls = maze(7);
    (function () { var best = -1; for (var r = 1; r < R; r++) for (var c = 1; c < C; c++) if (!walls[key(r, c)]) { var k = G.gridNeighbours(R, C, walls, r, c, false).length; if (k > best) { best = k; sel = [r, c]; } } }());
    function neighbours(r, c) { return G.gridNeighbours(R, C, walls, r, c, diag); }
    function draw(dur) {
      var cells = {}, arrows = [];
      var nb = sel && !walls[key(sel[0], sel[1])] ? neighbours(sel[0], sel[1]) : [];
      nb.forEach(function (p) { cells[key(p[0], p[1])] = { state: 'frontier' }; if (!diag) arrows.push({ from: sel, to: p, state: 'active' }); });
      if (sel && !walls[key(sel[0], sel[1])]) cells[key(sel[0], sel[1])] = { state: 'active' };
      var wl = Object.keys(walls).map(function (k) { return k.split(',').map(Number); });
      view.render({ rows: R, cols: C, walls: wl, cells: cells, arrows: arrows }, { duration: dur === undefined ? 250 : dur });
      var open = 0, deg = 0;
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (!walls[key(r, c)]) { open++; deg += neighbours(r, c).length; }
      stats.update({ open: open, edges: deg / 2, nb: nb.length, stored: 0 });
      fig.querySelector('[data-caption]').innerHTML = sel && walls[key(sel[0], sel[1])] ? 'That cell is a wall: it is not a vertex, so it has no neighbours.' :
        sel ? 'Cell <b>(' + sel[0] + ', ' + sel[1] + ')</b> has <b>' + nb.length + '</b> neighbour' + (nb.length === 1 ? '' : 's') + '. The function found them from arithmetic alone: no list was stored for this cell.' : 'Click a cell to ask for its neighbours.';
    }
    view.on('click', function (e) {
      if (mode !== 'inspect') return;
      sel = [e.row, e.col]; stopWander(); draw();
    });
    view.on('paint', function (e) { e.cells.forEach(function (p) { if (e.value) walls[key(p[0], p[1])] = true; else delete walls[key(p[0], p[1])]; }); });
    view.on('paintend', function () { draw(0); });
    function stopWander() { if (wander) { clearInterval(wander); wander = null; wbtn.setAttribute('aria-pressed', 'false'); wbtn.textContent = 'Wander'; } }
    var wbtn = fig.querySelector('[data-wander]');
    wbtn.addEventListener('click', function () {
      if (wander) { stopWander(); return; }
      if (!sel || walls[key(sel[0], sel[1])]) { sel = [1, 1]; if (walls[key(1, 1)]) delete walls[key(1, 1)]; }
      wbtn.setAttribute('aria-pressed', 'true'); wbtn.textContent = 'Stop';
      var prev = null, rng = V.rng(Date.now() % 1000);
      wander = setInterval(function () {
        var nb = neighbours(sel[0], sel[1]);
        var opts = nb.filter(function (p) { return !prev || p[0] !== prev[0] || p[1] !== prev[1]; });
        var next = opts.length ? rng.pick(opts) : (nb.length ? nb[0] : null);
        if (!next) { stopWander(); return; }
        prev = sel; sel = next; draw(300);
      }, V.reducedMotion() ? 1400 : 650);
    });
    V.onVisible(fig, function (vis) { if (!vis) stopWander(); });
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Tool', value: 'inspect', options: [{ value: 'inspect', label: 'Inspect a cell' }, { value: 'paint', label: 'Paint walls' }],
      onChange: function (v) { mode = v; stopWander(); view.setOptions({ paintable: v === 'paint' }); }
    });
    V.toggle(fig.querySelector('[data-diag]'), { label: 'Diagonal moves', checked: false, onChange: function (c) { diag = c; draw(); } });
    var presets = fig.querySelector('[data-presets]');
    [['New maze', function () { walls = maze(1 + Math.floor(Math.random() * 90)); }], ['Open field', function () { walls = {}; }], ['Walls everywhere', function () {
      walls = {}; for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if ((r + c) % 3 === 0 && (r % 2 === 0)) walls[key(r, c)] = true; }]].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'btn btn--soft btn--sm' }, p[0]);
      b.addEventListener('click', function () { p[1](); stopWander(); draw(200); });
      presets.appendChild(b);
    });
    V.codeBlock(V.$('#code-implicit'), [
      'function neighbours(r, c) {',
      '  const out = [];',
      '  for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {',
      '    const nr = r + dr, nc = c + dc;',
      '    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !wall[nr][nc]) out.push([nr, nc]);',
      '  }',
      '  return out;   // the whole graph lives in this function',
      '}'].join('\n'), 'js');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Selected cell' }, { state: 'frontier', label: 'Its neighbours' }, { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Wall' }]);
    draw(0);
  }

  /* ================================================================== gallery of special graphs */
  function galleryFigure(fig) {
    var ids = 'ABCDEF'.split('');
    var cyc = circle(6), com = circle(6, { pad: 105 });
    function P(arr) { var o = {}; ids.forEach(function (id, i) { o[id] = arr[i]; }); return o; }
    var kinds = {
      tree: { label: 'Tree', directed: false, pos: P([[500, 80], [270, 230], [730, 230], [160, 420], [380, 420], [730, 420]]),
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'F']],
        text: 'A <b>tree</b> is connected and has no cycle. Any two vertices are joined by exactly one path, and E = V − 1.' },
      cycle: { label: 'Cycle', directed: false, pos: P(cyc),
        edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A']],
        text: 'A <b>cycle graph</b> is one loop: every vertex has degree 2, so E = V. Remove any one edge and it becomes a tree.' },
      complete: { label: 'Complete', directed: false, pos: P(com),
        edges: (function () { var e = []; for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) e.push([ids[i], ids[j]]); return e; }()),
        text: 'In a <b>complete graph</b> every pair is linked: E = V(V − 1) / 2, the most a simple graph can have. This is the one case where a matrix wastes nothing.' },
      dag: { label: 'DAG', directed: true, pos: P([[100, 300], [330, 120], [330, 480], [580, 300], [830, 140], [830, 460]]),
        edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'], ['D', 'F'], ['B', 'E']],
        text: 'A <b>DAG</b> (directed acyclic graph) has arrows and no directed cycle, so you can never arrive back where you started. Prerequisites, build steps and spreadsheets are DAGs.' },
      bip: { label: 'Bipartite', directed: false, pos: P([[240, 100], [760, 100], [240, 300], [760, 300], [240, 500], [760, 500]]),
        edges: [['A', 'B'], ['A', 'D'], ['C', 'B'], ['C', 'F'], ['E', 'D'], ['E', 'F'], ['C', 'D']], sides: { A: 0, C: 0, E: 0, B: 1, D: 1, F: 1 },
        text: 'A <b>bipartite graph</b> splits into two sides with every edge crossing between them: students and courses, jobs and workers. Next: how to test for it.' }
    };
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { x: 60, y: 40, w: 820, h: 540 }, maxHeight: 440, nodeRadius: 30, label: 'Gallery of special graphs on six vertices' });
    var cap = fig.querySelector('[data-caption]'), facts = fig.querySelector('[data-facts]');
    function show(key, dur) {
      var k = kinds[key];
      var rep = G.build({ nodes: ids, edges: k.edges, directed: k.directed });
      view.render({
        nodes: ids.map(function (id) { return { id: id, x: k.pos[id][0], y: k.pos[id][1], state: k.sides ? (k.sides[id] ? 'path' : 'active') : 'default' }; }),
        edges: k.edges.map(function (e) { return { id: L.pairKey(e[0], e[1]), from: e[0], to: e[1], directed: k.directed }; })
      }, { duration: dur });
      cap.innerHTML = k.text;
      V.clear(facts);
      var dens = Math.round(G.density(rep.V, rep.E, k.directed) * 100);
      [['V = ' + rep.V, ''], ['E = ' + rep.E, ''], [k.directed ? 'directed' : 'undirected', ''], ['density ' + dens + '%', dens > 50 ? 'dense' : 'sparse']].forEach(function (c) {
        facts.appendChild(h('span', { class: 'chip chip--sm' }, c[0]));
      });
      var cc = G.components(rep).length;
      facts.appendChild(h('span', { class: 'chip chip--sm' }, cc + (cc === 1 ? ' component' : ' components')));
      facts.appendChild(h('span', { class: 'chip chip--sm' }, G.simpleCycles(rep, 1).length ? 'has a cycle' : 'no cycle'));
    }
    show('tree', 0);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Kind of graph', value: 'tree',
      options: Object.keys(kinds).map(function (k) { return { value: k, label: kinds[k].label }; }),
      onChange: function (v) { show(v, 900); }
    });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Vertex' }, { state: 'active', label: 'Side 1 (bipartite)' }, { state: 'path', label: 'Side 2' }]);
  }

  /* ================================================================== two-colouring lab (bipartite test) */
  var BI_CODE = {
    pseudo: [
      'function isBipartite(adj, start)',
      '  colour[start] ← 0; queue ← [start]        // @start',
      '  while queue is not empty',
      '    u ← remove first of queue                // @pop',
      '    for each neighbour w of u',
      '      if w has no colour then',
      '        colour[w] ← 1 − colour[u]; add w    // @colour',
      '      else if colour[w] = colour[u] then     // @check',
      '        return false                          // @conflict',
      '  return true                                 // @done'
    ].join('\n'),
    js: [
      'function isBipartite(adj, start) {',
      '  const colour = new Map([[start, 0]]);      // @start',
      '  const queue = [start];',
      '  while (queue.length) {',
      '    const u = queue.shift();                 // @pop',
      '    for (const w of adj[u]) {',
      '      if (!colour.has(w)) {',
      '        colour.set(w, 1 - colour.get(u));    // @colour',
      '        queue.push(w);',
      '      } else if (colour.get(w) === colour.get(u)) {   // @check',
      '        return false;                        // @conflict',
      '      }',
      '    }',
      '  }',
      '  return true;                               // @done',
      '}'
    ].join('\n'),
    py: [
      'def is_bipartite(adj, start):',
      '    colour = {start: 0}                      # @start',
      '    queue = deque([start])',
      '    while queue:',
      '        u = queue.popleft()                  # @pop',
      '        for w in adj[u]:',
      '            if w not in colour:',
      '                colour[w] = 1 - colour[u]    # @colour',
      '                queue.append(w)',
      '            elif colour[w] == colour[u]:     # @check',
      '                return False                 # @conflict',
      '    return True                              # @done'
    ].join('\n')
  };
  function bicolorFigure(fig) {
    var ring = { nodes: 'ABCDEF'.split(''), edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A']] };
    var chord = { nodes: ring.nodes, edges: ring.edges.concat([['A', 'C']]) };
    var which = 'ring';
    var cpos = circle(6, { pad: 100 });
    var ids = ring.nodes;
    var base = {}; ids.forEach(function (id, i) { base[id] = [cpos[i].x, cpos[i].y]; });
    var cols = {}; ['A', 'C', 'E'].forEach(function (id, i) { cols[id] = [250, 110 + i * 190]; }); ['B', 'D', 'F'].forEach(function (id, i) { cols[id] = [750, 110 + i * 190]; });
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { x: 150, y: 50, w: 700, h: 500 }, maxHeight: 360, nodeRadius: 30, label: 'Two-colouring a ring of six vertices with a queue' });
    var queueHost = fig.querySelector('[data-queue]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: BI_CODE, default: 'pseudo', maxHeight: 300 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', w: 'compare' } });
    function graph() { return which === 'ring' ? ring : chord; }
    function gen() {
      return G.biColorSteps(graph(), 'A').map(function (st) {
        var o = Object.assign({}, st); o.vars = Object.assign({}, st.vars);
        if (o.vars.queue) o.vars.queue = V.vars.raw('[' + o.vars.queue.join(', ') + ']');
        return o;
      });
    }
    function render(step, ctx) {
      var g = graph();
      var nodes = ids.map(function (id) {
        var st = step.colour[id] === undefined ? 'default' : step.colour[id] === 0 ? 'active' : 'path';
        if (step.conflict && step.conflict.indexOf(id) >= 0) st = 'error';
        var p = step.columns && cols[id] ? cols[id] : base[id];
        var n = { id: id, x: p[0], y: p[1], state: st };
        if (step.cur === id && step.kind !== 'done') n.sub = 'now';
        return n;
      });
      var edges = g.edges.map(function (e) { var k = L.pairKey(e[0], e[1]); return { id: k, from: e[0], to: e[1], state: step.edges[k] || 'default' }; });
      view.render({ nodes: nodes, edges: edges }, { duration: ctx.duration });
      L.chipSync(queueHost, step.queue.map(function (q) { return { key: q, text: q, cls: step.colour[q] === 0 ? 'is-side0' : 'is-side1' }; }));
    }
    var player = V.player({
      root: fig, steps: gen(), render: render, code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { coloured: 'Coloured', checked: 'Edges checked' }, baseStepMs: 1300, label: 'Two-colouring controls'
    });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'colour') return k; return -1; }, function (c) {
      var st = c.step, w = st.vars.w, u = st.vars.u;
      void w; void u;
      var next = c.steps[c.index];
      var cw = next.colour[next.vars.w];
      return {
        question: 'The colour of <b>' + next.vars.u + '</b> is ' + (next.colour[next.vars.u] === 0 ? 'blue' : 'orange') + '. <b>' + next.vars.w + '</b> is its neighbour and has no colour yet. What colour does the rule give it?',
        options: ['Blue', 'Orange'], answer: cw === 0 ? 0 : 1,
        explain: cw === 0 ? ['Right: the opposite of orange is blue.', 'An edge must join two different colours, so the neighbour of an orange vertex is blue.']
          : ['An edge must join two different colours, so a neighbour of a blue vertex cannot be blue.', 'Right: the opposite of blue is orange.']
      };
    }, { id: 'bicolor-colour' });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'conflict') return k; return -1; }, function (c) {
      var next = c.steps[c.index], u = next.conflict[0], w = next.conflict[1];
      return {
        question: '<b>' + u + '</b> and <b>' + w + '</b> are joined by an edge, and both already wear the same colour. What should the algorithm conclude?',
        options: ['Recolour one of them and carry on', 'Stop: no valid two-colouring exists', 'Ignore this edge'], answer: 1,
        explain: ['Recolouring one just breaks another edge: the colours were forced by the queue order, all the way back to the start.', 'Right: every colour was forced by an earlier edge, so this clash proves an odd cycle. The graph is not bipartite.', 'An edge cannot be ignored: the whole point is that every edge crosses between the sides.']
      };
    }, { id: 'bicolor-conflict' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph', value: 'ring',
      options: [{ value: 'ring', label: 'Ring of six (even)' }, { value: 'chord', label: 'Ring + shortcut A–C (odd cycle)' }],
      onChange: function (v) { which = v; player.setSteps(gen()); }
    });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Side 1 (blue)' }, { state: 'path', label: 'Side 2 (orange)' }, { state: 'error', label: 'Conflict' }, { state: 'visited', shape: 'line', label: 'Consistent edge' }]);
  }

  /* ================================================================== variations (tabs with mini pictures) */
  function variations() {
    V.tabs('#variants');
    function miniGraph(host, nodes, edges, directed, o) {
      var v = V.views.graph(host, { bounds: { x: 60, y: 50, w: 880, h: 500 }, maxHeight: 190, nodeRadius: 32, minRadius: 14, directed: directed, label: o && o.label });
      v.render({ nodes: nodes, edges: edges }, { duration: 0 });
    }
    function miniMatrix(host, ids, cells, o) {
      var v = V.views.grid(host, { mode: 'table', cellSize: 34, minCell: 20, label: o && o.label });
      v.render({ rows: ids.length, cols: ids.length, cells: cells, rowHeaders: ids, colHeaders: ids }, { duration: 0 });
    }
    function matrix(rep, f) { return rep.ids.map(function (a, i) { return rep.ids.map(function (b, j) { return f(rep.has[i][j], rep.matrix[i][j], i, j); }); }); }
    var N = [{ id: 'A', x: 130, y: 300 }, { id: 'B', x: 500, y: 110 }, { id: 'C', x: 870, y: 300 }, { id: 'D', x: 500, y: 490 }];
    var ids = ['A', 'B', 'C', 'D'];
    // weighted
    var wE = [{ from: 'A', to: 'B', weight: 4 }, { from: 'B', to: 'C', weight: 2 }, { from: 'C', to: 'D', weight: 7 }, { from: 'A', to: 'D', weight: 3 }];
    var repW = G.build({ nodes: ids, edges: wE.map(function (e) { return [e.from, e.to, e.weight]; }) });
    miniGraph(V.$('[data-mini="w-g"]'), N, wE, false, { label: 'Weighted graph' });
    miniMatrix(V.$('[data-mini="w-m"]'), ids, matrix(repW, function (has, w) { return has ? { value: w, state: 'visited' } : { text: '∞', state: 'muted' }; }), { label: 'Weighted adjacency matrix with infinity for no edge' });
    // directed
    var dE = [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'A' }, { from: 'B', to: 'D' }];
    var repD = G.build({ nodes: ids, edges: dE.map(function (e) { return [e.from, e.to]; }), directed: true });
    miniGraph(V.$('[data-mini="d-g"]'), N, dE, true, { label: 'Directed graph' });
    miniMatrix(V.$('[data-mini="d-m"]'), ids, matrix(repD, function (has) { return { value: has ? 1 : 0, state: has ? 'visited' : 'muted' }; }), { label: 'Directed adjacency matrix, not symmetric' });
    // multigraph
    var mE = [{ from: 'A', to: 'B' }, { from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }];
    miniGraph(V.$('[data-mini="m-g"]'), N, mE, false, { label: 'Graph with two parallel edges' });
    var counts = { 'A,B': 2, 'B,A': 2, 'B,C': 1, 'C,B': 1, 'C,D': 1, 'D,C': 1 };
    miniMatrix(V.$('[data-mini="m-m"]'), ids, ids.map(function (a) { return ids.map(function (b) { var c = counts[a + ',' + b] || 0; return { value: c, state: c ? (c > 1 ? 'active' : 'visited') : 'muted' }; }); }), { label: 'Matrix with a count of two for the parallel edges' });
    // set
    var setHost = V.$('[data-mini="s-l"]');
    var rows = [['A', ['B', 'D']], ['B', ['A', 'C']], ['C', ['B', 'D']], ['D', ['A', 'C']]];
    var lg = h('div', { class: 'g25-lgrid g25-lgrid--one' });
    setHost.appendChild(lg);
    L.rowSync(lg, rows.map(function (r) { return { id: r[0], head: r[0], chips: r[1].map(function (x) { return { key: r[0] + x, text: x, cls: '' }; }) }; }));
    [['weighted', 'w'], ['directed', 'd'], ['multi', 'm']].forEach(function () {});
    var blocks = {
      w: 'const INF = Infinity;\nconst M = Array.from({ length: V }, () => Array(V).fill(INF));\nM[u][v] = weight;      // instead of 1',
      d: 'M[u][v] = 1;         // one direction only\n// undirected: also M[v][u] = 1;\n// out-neighbours: scan row u; in-neighbours: scan column u',
      m: 'M[u][v] += 1;        // count parallel edges\nM[u][u] += 1;        // a self-loop (degree counts it twice)\n// list: push v again, or push {to: v, id: bridgeNo}',
      s: 'const adj = Array.from({ length: V }, () => new Set());\nadj[u].add(v); adj[v].add(u);\nadj[u].has(v);         // expected O(1), space still O(V + E)'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
  }

  /* ================================================================== checks */
  function checks() {
    // 1. click the vertex of highest degree
    (function (fig) {
      var stage = fig.querySelector('[data-stage]');
      var pos = { A: [120, 130], B: [420, 220], C: [260, 470], D: [560, 410], E: [880, 470], F: [880, 130] };
      var edges = [['A', 'B'], ['B', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'], ['D', 'F'], ['C', 'E']];
      var rep = G.build({ nodes: Object.keys(pos), edges: edges }), dg = G.degrees(rep).deg;
      var view = V.views.graph(stage, { bounds: { x: 60, y: 70, w: 880, h: 460 }, maxHeight: 340, nodeRadius: 30, label: 'Graph with six vertices: click the one of highest degree' });
      view.render({ nodes: Object.keys(pos).map(function (id) { return { id: id, x: pos[id][0], y: pos[id][1] }; }), edges: edges.map(function (e) { return { id: L.pairKey(e[0], e[1]), from: e[0], to: e[1] }; }) }, { duration: 0 });
      L.tagNodes(view, function (id) { return 'Vertex ' + id; });
      var best = Object.keys(dg).sort(function (a, b) { return dg[b] - dg[a]; })[0];
      V.clickQuiz(stage, {
        el: '#quiz-degree', id: 'degree-max', question: 'Click the vertex with the <b>highest degree</b>.', answer: best,
        right: 'D touches four edges (B, C, E and F). B and C have three, E has two, and A and F only one. Degree is the number of edges at a vertex, not how central it looks.',
        wrong: 'Count the lines that touch each vertex. A vertex that looks central may not have the most.'
      });
    }(V.$('#fig-quizdeg')));
    // 2. fill in a row of the matrix
    (function (fig) {
      var pos = { A: [140, 300], B: [380, 110], C: [400, 480], D: [720, 490], E: [780, 130] };
      var edges = [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'E'], ['C', 'D'], ['D', 'E']];
      var rep = G.build({ nodes: Object.keys(pos), edges: edges });
      var gv = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { x: 80, y: 60, w: 760, h: 480 }, maxHeight: 300, nodeRadius: 30, label: 'Graph with five vertices A to E' });
      gv.render({ nodes: rep.ids.map(function (id) { return { id: id, x: pos[id][0], y: pos[id][1], state: id === 'B' ? 'active' : 'default' }; }), edges: edges.map(function (e) { return { id: L.pairKey(e[0], e[1]), from: e[0], to: e[1] }; }) }, { duration: 0 });
      var mv = V.views.grid(fig.querySelector('[data-matrix]'), { mode: 'table', cellSize: 38, minCell: 22, label: 'Adjacency matrix with the row of vertex B hidden' });
      function draw(reveal) {
        var cells = rep.ids.map(function (a, i) { return rep.ids.map(function (b, j) {
          if (a === 'B' && !reveal) return { text: '?', state: 'compare' };
          var on = rep.has[i][j]; return { value: on ? 1 : 0, state: a === 'B' ? (on ? 'found' : 'muted') : on ? 'visited' : 'muted' };
        }); });
        mv.render({ rows: 5, cols: 5, cells: cells, rowHeaders: rep.ids, colHeaders: rep.ids, highlightRow: { index: 1, state: 'active' } }, { duration: 300 });
      }
      draw(false);
      var want = rep.ids.map(function (id, j) { return rep.has[1][j] ? j : -1; }).filter(function (j) { return j >= 0; });
      V.quiz('#quiz-row', {
        question: 'In the matrix, which cells of <b>row B</b> hold a 1? Tick every column.', id: 'matrix-row-b',
        options: ['A', 'B', 'C', 'D', 'E'], answer: want, multi: true,
        explain: 'Row B lists B’s neighbours: A, C and E. The diagonal cell (B, B) is 0 because there is no self-loop, and D is not adjacent to B. The row sums to 3, which is B’s degree.'
      }).onAnswer(function () { draw(true); });
    }(V.$('#fig-quizrow')));
    V.quiz('#quiz-social', {
      question: 'A social network has 1 billion people, each with about 150 friends. Which representation do you use to store the friendships?',
      id: 'sparse-social', options: ['Adjacency matrix', 'Adjacency list', 'It does not matter: both need about the same memory', 'Neither: it has too many vertices for a computer'], answer: 1,
      explain: ['A billion by a billion table is 10¹⁸ cells, mostly zeros. No computer can hold it.',
        'Right: 150 entries per person is about 1.5 × 10¹¹ entries in total. That is large but feasible, and listing a person’s friends costs 150 reads.',
        'They differ by a factor of about seven million: V² against V + E. Density decides.',
        'Real systems store exactly this graph, as adjacency lists spread over many machines.']
    });
    V.quiz('#quiz-handshake', {
      question: 'A class has 7 students. Can every student shake hands with exactly 3 others, each pair shaking at most once?',
      id: 'handshake-7x3', options: ['Yes: 7 × 3 = 21 handshakes', 'Yes, but only if the students form a cycle', 'No: the degrees would sum to 21, and that must equal 2E', 'No: 7 students can only make 6 handshakes'], answer: 2,
      explain: ['Each handshake involves two students, so the number of handshakes is 21 / 2 = 10.5, which is not a whole number.', 'A cycle gives every student degree 2, not 3.',
        'Right: the sum of degrees is always 2E, an even number. Seven odd degrees add up to an odd sum.', 'Handshakes are pairs: 7 students allow up to 21 pairs. The obstacle is parity, not the count.']
    });
    V.quiz('#quiz-symmetric', {
      question: 'Which statements about adjacency matrices are true?', id: 'matrix-symmetry',
      options: ['The matrix of an undirected graph is symmetric: M[u][v] = M[v][u]', 'The matrix of a directed graph is always symmetric', 'The sum of row u of an undirected graph’s matrix is the degree of u', 'A directed graph with no edges has a matrix of all ones'],
      answer: [0, 2],
      explain: 'An undirected edge is stored twice, so the table mirrors itself across the diagonal, and a row’s ones are that vertex’s neighbours. A directed edge fills only one cell, so its matrix is usually not symmetric, and no edges means all zeros.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tinyGraph(nodes, edges, directed) {
      var host = h('div', { class: 'g25-tiny' });
      V.views.graph(host, { bounds: { w: 1000, h: 600 }, maxHeight: 100, nodeRadius: 26, minRadius: 8, directed: directed, showWeights: false, label: 'Small graph' }).render({ nodes: nodes, edges: edges }, { duration: 0 });
      return host;
    }
    function tinyMatrix(rows) {
      var host = h('div', { class: 'g25-tiny' });
      V.views.grid(host, { mode: 'table', cellSize: 22, minCell: 12, showValues: true, label: 'Small matrix' }).render({ rows: 4, cols: 4, cells: rows.map(function (r) { return r.map(function (v) { return { value: v, state: v ? 'visited' : 'muted' }; }); }) }, { duration: 0 });
      return host;
    }
    var N = [{ id: 'A', x: 120, y: 300 }, { id: 'B', x: 500, y: 100 }, { id: 'C', x: 880, y: 300 }, { id: 'D', x: 500, y: 500 }];
    var E = [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'A', to: 'D' }, { from: 'B', to: 'D' }];
    var listViz = h('div', { class: 'g25-lgrid g25-lgrid--tiny' });
    L.rowSync(listViz, [['A', ['B', 'D']], ['B', ['A', 'C', 'D']], ['C', ['B']], ['D', ['A', 'B']]].map(function (r) { return { id: r[0], head: r[0], chips: r[1].map(function (x) { return { key: r[0] + x, text: x, cls: '' }; }) }; }));
    var elist = h('div', { class: 'g25-elist g25-elist--tiny' });
    L.chipSync(elist, [['A', 'B'], ['B', 'C'], ['A', 'D'], ['B', 'D']].map(function (e) { return { key: e.join(''), text: '(' + e.join(',') + ')', cls: '' }; }));
    var tree = tinyGraph([{ id: 'A', x: 500, y: 100 }, { id: 'B', x: 250, y: 300 }, { id: 'C', x: 750, y: 300 }, { id: 'D', x: 120, y: 500 }, { id: 'E', x: 380, y: 500 }],
      [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'B', to: 'D' }, { from: 'B', to: 'E' }], false);
    var deg = tinyGraph(N, E, false);
    var tiles = [
      { viz: tinyGraph(N, E, false), label: 'Vertices and edges', text: 'Things and the links between them. Directed or not, weighted or not.' },
      { viz: h('div', { class: 'g25-tiny g25-tiny--text' }, h('span', null, 'deg(B) = 3'), h('small', null, 'edges touching B'), h('span', null, 'Σ deg = 2E'), h('small', null, 'handshake lemma')), label: 'Degree and paths', text: 'Degree counts edges at a vertex. A path chains edges; a cycle returns to its start.' },
      { viz: tinyMatrix([[0, 1, 0, 1], [1, 0, 1, 1], [0, 1, 0, 0], [1, 1, 0, 0]]), label: 'Adjacency matrix', text: 'V × V table. Edge check in O(1); needs V² cells; scanning a row costs V.' },
      { viz: listViz, label: 'Adjacency list', text: 'A short list per vertex. V + E cells; neighbours cost their degree. The default.' },
      { viz: elist, label: 'Edge list', text: 'Just the pairs: E entries. Ideal when you only sort or scan all edges.' },
      { viz: h('div', { class: 'g25-tiny g25-tiny--text' }, h('span', null, 'E ≈ V'), h('small', null, 'sparse → list'), h('span', null, 'E ≈ V²'), h('small', null, 'dense → matrix')), label: 'Density decides', text: 'Real graphs are almost always sparse. Compare E with V² before you choose.' },
      { viz: h('div', { class: 'g25-tiny g25-tiny--text' }, h('span', null, 'f(x) → [ ]'), h('small', null, 'neighbours on demand')), label: 'Implicit graphs', text: 'Grids and puzzles need no stored edges: a function returns the neighbours.' },
      { viz: tree, label: 'Special graphs', text: 'Trees (E = V − 1), DAGs, complete and bipartite graphs. Bipartite means no odd cycle.' }
    ];
    void deg;
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.viz), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-memory', memoryFigure);
    L.lazy('#fig-choose', chooseFigure);
    L.lazy('#fig-implicit', implicitFigure);
    L.lazy('#fig-gallery', galleryFigure);
    bicolorFigure(V.$('#fig-bicolor'));
    variations();
    checks();
    L.lazy('#summary-card', summaryCard);
  });
  void s;
}());
