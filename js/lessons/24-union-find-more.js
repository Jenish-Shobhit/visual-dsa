/* Lesson 24 · Union-find — part 4: the race, the cost charts, percolation, cycle detection, the application
   tabs, the checks and the summary card.
   Needs js/lessons/24-union-find.js (VDSA.L24) and js/algos/24-union-find.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L = V.L24, UF = L.UF;

  /* ================================================================== the race */
  function raceFigure(fig) {
    var N = 12, kind = 'random';
    var stageA = fig.querySelector('[data-stage="a"]'), stageB = fig.querySelector('[data-stage="b"]');
    var fa = L.forestView(stageA, { label: 'Naive forest', nodeR: 15, maxSlot: 44, pointers: false, showRank: false, levelH: 48 });
    var fb = L.forestView(stageB, { label: 'Optimised forest', nodeR: 15, maxSlot: 44, pointers: false, showRank: true, levelH: 48 });
    var sa = V.stats(fig.querySelector('[data-stats="a"]'), { labels: { hops: 'Pointer hops', height: 'Tallest tree' }, states: { hops: 'path', height: 'pivot' } });
    var sb = V.stats(fig.querySelector('[data-stats="b"]'), { labels: { hops: 'Pointer hops', height: 'Tallest tree' }, states: { hops: 'path', height: 'pivot' } });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'path', label: 'Climbed by this operation' }, { state: 'found', label: 'Root that stays on top' }, { state: 'swap', label: 'Root hung underneath' }]);
    var seeds = { random: 4, chain: 1, balanced: 1 };
    function ops(k) {
      var w = UF.workload(k === 'balanced' ? 'binomial' : k, N, V.rng(seeds[k]));
      return k === 'random' ? w.slice(0, 22) : w.slice(0, k === 'chain' ? 11 + 9 : 11 + 8);
    }
    function frames(k) {
      var f = UF.race(N, ops(k));
      f.forEach(function (fr) { fr.sides[0].colors = null; });
      return f;
    }
    var f0 = frames(kind);
    function prep(fs) {
      fa.reset(); fb.reset();
      fa.prepare(fs.map(function (fr) { return { parent: fr.sides[0].parent }; }));
      fb.prepare(fs.map(function (fr) { return { parent: fr.sides[1].parent }; }));
    }
    prep(f0);
    var player = V.player({
      root: fig, steps: f0, caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Race controls',
      render: function (fr, ctx) {
        var A = fr.sides[0], B = fr.sides[1];
        fa.render({ parent: A.parent, states: A.states, edgeStates: A.edgeStates }, { duration: ctx.duration });
        fb.render({ parent: B.parent, rank: B.rank, states: B.states, edgeStates: B.edgeStates }, { duration: ctx.duration });
        sa.update({ hops: A.hops, height: A.height });
        sb.update({ hops: B.hops, height: B.height });
      }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operations', value: kind,
      options: [{ value: 'random', label: 'Random operations' }, { value: 'chain', label: 'A chain of unions' }, { value: 'balanced', label: 'Balanced merges' }],
      onChange: function (k) { kind = k; var fs = frames(k); prep(fs); player.setSteps(fs); }
    });
  }

  /* ================================================================== cost charts */
  var WORK = {
    random: { label: 'Random operations', kind: 'random', n: 256 },
    chain: { label: 'A chain of unions, then finds', kind: 'chain', n: 256 },
    balanced: { label: 'Balanced merges, then finds', kind: 'binomial', n: 256 }
  };
  var CFGS = [
    { id: 'naive', label: 'Naive', state: 'error', cfg: { byRank: false, compress: 'none' } },
    { id: 'rank', label: 'Rank only', state: 'compare', cfg: { byRank: true, compress: 'none' } },
    { id: 'both', label: 'Rank + compression', state: 'done', cfg: { byRank: true, compress: 'full' } }
  ];
  function costFigure(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 300, label: 'Average find cost as operations are performed', labels: 'direct' });
    var cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), CFGS.map(function (c) { return { state: c.state, shape: 'line', label: c.label }; }));
    var cache = {}, work = 'chain', metric = 'cost';
    function data(w) {
      if (cache[w]) return cache[w];
      var W = WORK[w], ops = UF.workload(W.kind, W.n, V.rng(7));
      return (cache[w] = { ops: ops.length, curves: CFGS.map(function (c) { return UF.curve(ops, W.n, c.cfg, 48); }) });
    }
    var notes = {
      random: 'On random operations the naive structure is not a disaster, but its trees still grow tall enough to cost several hops per find. Rank keeps finds near one hop, and compression trims them a little more.',
      chain: 'A chain of unions is the naive structure’s nightmare: the tree grows into a line, so each find pays for it. Rank keeps every tree flat by construction.',
      balanced: 'Merging equal trees in rounds is the worst case for rank alone: the height reaches log₂ n. Here naive and rank only build the same trees, so their lines coincide. Compression then flattens the paths that finds actually walk.'
    };
    function show(dur) {
      var d = data(work), key = metric;
      var series = CFGS.map(function (c, i) {
        var pts = metric === 'cost' ? d.curves[i].cost : d.curves[i].height.map(function (p) { return [p[0], p[1]]; });
        return { id: c.id, label: c.label, state: c.state, points: pts, markers: false };
      });
      chart.render({
        x: { label: 'operations performed so far', min: 0, max: d.ops },
        y: { label: metric === 'cost' ? 'average pointer hops per find so far' : 'height of the tallest tree', min: 0 },
        series: series
      }, { duration: dur });
      var last = function (i) { var a = metric === 'cost' ? d.curves[i].cost : d.curves[i].height; return a[a.length - 1][1]; };
      var fmt = function (v) { return metric === 'cost' ? (v < 10 ? v.toFixed(1) : Math.round(v)) : v; };
      cap.innerHTML = '<b>After ' + d.ops + ' operations on 256 elements:</b> naive ' + fmt(last(0)) + ', rank only ' + fmt(last(1)) + ', rank + compression ' + fmt(last(2)) + (metric === 'cost' ? ' hops per find.' : ' levels.') + ' ' + notes[work];
    }
    V.segmented(fig.querySelector('[data-seg-work]'), {
      label: 'Workload', value: work,
      options: Object.keys(WORK).map(function (k) { return { value: k, label: WORK[k].label }; }),
      onChange: function (v) { work = v; show(700); }
    });
    V.segmented(fig.querySelector('[data-seg-metric]'), {
      label: 'Measure', value: metric,
      options: [{ value: 'cost', label: 'Average find cost' }, { value: 'height', label: 'Tallest tree' }],
      onChange: function (v) { metric = v; show(700); }
    });
    show(900);
  }

  function alphaFigure(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', height: 260, label: 'alpha of n next to log2 of n' });
    var ns = [10, 1e3, 1e6, 1e9, 1e12], names = ['10', '1,000', '1 million', '1 billion', '1 trillion'];
    V.onVisible(fig, function (vis) {
      if (!vis || chart.done) return;
      chart.done = true;
      chart.render({
        categories: names,
        series: [
          { id: 'log', label: 'log₂ n', values: ns.map(function (n) { return +Math.log2(n).toFixed(1); }), state: 'compare' },
          { id: 'alpha', label: 'α(n)', values: ns.map(UF.alpha), state: 'done' }
        ],
        y: { label: 'value', min: 0, max: 42 }
      }, { duration: 900 });
    });
  }

  /* ================================================================== percolation */
  var ROWS = 10, COLS = 10;
  function percolationFigure(fig) {
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var N = ROWS * COLS, order = [], rng = V.rng(Date.now() % 100000);
    var top = h('div', { class: 'uf-edge-label' }, h('b', null, 'TOP'), ' virtual node: water enters here'), bot = h('div', { class: 'uf-edge-label' }, h('b', null, 'BOTTOM'), ' virtual node: water must reach here');
    var host = h('div', { class: 'uf-grid-host' });
    stage.appendChild(top); stage.appendChild(host); stage.appendChild(bot);
    var view = V.views.grid(host, { mode: 'path', cellSize: 38, showValues: false, label: 'Percolation grid, ' + ROWS + ' by ' + COLS });
    var stats = V.stats(fig.querySelector('[data-counters]'), { labels: { open: 'Open sites', percent: 'Fraction open', groups: 'Groups', percolates: 'Percolates?' }, states: { percolates: 'found', groups: 'pivot' } });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Blocked' },
      { state: 'visited', label: 'Open, dry' }, { state: 'frontier', label: 'Water from the top' }, { state: 'found', label: 'Water reaches the bottom' }
    ]);
    function toView(st) {
      var cells = {}, walls = [], codes = st.codes;
      for (var k = 0; k < N; k++) {
        var ch = codes[k], r = Math.floor(k / COLS), c = k % COLS;
        if (ch === '#') walls.push([r, c]);
        else cells[r + ',' + c] = { state: ch === 'p' ? 'found' : ch === 'f' ? 'frontier' : 'visited' };
      }
      if (st.cell) { var key = st.cell[0] + ',' + st.cell[1]; if (cells[key]) cells[key] = { state: cells[key].state === 'visited' ? 'active' : cells[key].state, label: '' }; }
      return { rows: ROWS, cols: COLS, walls: walls, cells: cells };
    }
    function gen() {
      return UF.percolation(ROWS, COLS, order);
    }
    var steps = gen();
    var player = V.player({
      root: fig, steps: steps, caption: cap, baseStepMs: 420, animMs: 260, speeds: [0.5, 1, 2, 4], label: 'Percolation controls',
      render: function (st, ctx) {
        view.render(toView(st), { duration: ctx.duration });
        stats.update({ open: st.open, percent: Math.round(100 * st.open / N) + ' %', groups: st.components, percolates: st.percolates ? 'YES' : 'no' });
      }
    });
    function closedCells() { var used = {}; order.forEach(function (c) { used[c] = true; }); var out = []; for (var i = 0; i < N; i++) if (!used[i]) out.push(i); return out; }
    function extend(list, mode) {
      if (!list.length) return;
      var old = player.steps.length - 1;
      order = order.concat(list);
      var st = gen();
      player.setSteps(st, { index: old });
      if (mode === 'play') player.play(); else player.next();
    }
    function randomClosed(k) { var pool = closedCells(); var out = []; for (var i = 0; i < k && pool.length; i++) { var j = Math.floor(rng() * pool.length); out.push(pool.splice(j, 1)[0]); } return out; }
    fig.querySelector('[data-open1]').addEventListener('click', function () { extend(randomClosed(1), 'one'); });
    fig.querySelector('[data-open5]').addEventListener('click', function () { extend(randomClosed(5), 'play'); });
    fig.querySelector('[data-until]').addEventListener('click', function () {
      var pool = randomClosed(N), cand = order.concat(pool), st = UF.percolation(ROWS, COLS, cand);
      var hit = -1;
      for (var i = 0; i < st.length; i++) if (st[i].percolates) { hit = i; break; }
      if (player.step && player.step.percolates) return;
      if (hit < 0) return;
      extend(cand.slice(order.length, hit), 'play');
    });
    fig.querySelector('[data-clear]').addEventListener('click', function () { order = []; player.setSteps(gen()); });
    view.on('click', function (e) {
      if (!e.wall) return;
      var idx = e.row * COLS + e.col;
      if (order.indexOf(idx) >= 0) return;
      extend([idx], 'one');
    });
    // start with a partly open grid, so the first picture is not empty
    var seed = V.rng(3), pre = [];
    var all = V.shuffle(V.range(N), seed);
    order = all.slice(0, 34);
    player.setSteps(gen(), { index: 34 });
  }

  function percolationCurve(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 280, label: 'Chance of percolating against fraction of open sites', hover: true });
    var note = fig.querySelector('[data-note]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Chance of percolating (20 × 20 grids)' }, { state: 'muted', shape: 'dash', label: 'Known threshold ≈ 0.593' }]);
    function curveFor(th) {
      var pts = [];
      for (var p = 0; p <= 1.0001; p += 0.02) pts.push([+p.toFixed(2), th.filter(function (t) { return t <= p + 1e-9; }).length / th.length]);
      return pts;
    }
    function show(trials, seed, dur) {
      var th = UF.percolationThresholds(20, trials, V.rng(seed));
      var mean = th.reduce(function (a, b) { return a + b; }, 0) / th.length;
      chart.render({
        x: { label: 'fraction of sites open', min: 0, max: 1 }, y: { label: 'chance the grid percolates', min: 0, max: 1 },
        series: [{ id: 'p', label: 'chance', state: 'active', points: curveFor(th), markers: false }],
        annotations: [{ x: 0.593, text: '0.593', state: 'muted' }]
      }, { duration: dur });
      note.textContent = trials + ' random 20 × 20 grids: on average they percolated at ' + (mean * 100).toFixed(1) + ' % open.';
    }
    var run = 0;
    show(40, 5, 900);
    fig.querySelector('[data-run]').addEventListener('click', function () { run++; show(200, 100 + run * 13, 700); });
  }

  /* ================================================================== cycle detection */
  var CYCLE_PRESETS = [
    { label: 'One cycle', text: '0-1, 1-2, 2-3, 3-4, 4-1, 0-5' },
    { label: 'A tree (no cycle)', text: '0-1, 0-2, 1-3, 1-4, 2-5' },
    { label: 'Triangle', text: '0-1, 1-2, 2-0' },
    { label: 'Two cycles', text: '0-1, 1-2, 2-0, 2-3, 3-4, 4-5, 5-3' },
    { label: 'Square with a diagonal', text: '0-1, 1-2, 2-3, 3-0, 0-2' },
    { label: 'Parallel edges', text: '0-1, 1-2, 0-1' }
  ];
  function cycleFigure(fig) {
    var gStage = fig.querySelector('[data-stage="graph"]'), fStage = fig.querySelector('[data-stage="forest"]');
    var graph = V.views.graph(gStage, { bounds: { w: 1000, h: 600 }, maxHeight: 340, label: 'Graph whose edges are checked one at a time' });
    var forest = L.forestView(fStage, { label: 'Union-find forest for the edges kept so far', nodeR: 17, maxSlot: 56, pointers: false, showRank: true, levelH: 56 });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'line', label: 'Not looked at yet' }, { state: 'compare', shape: 'line', label: 'Edge being tested' },
      { state: 'done', shape: 'line', label: 'Kept: joins two groups' }, { state: 'error', shape: 'line', label: 'Closes a cycle' }, { state: 'found', label: 'Root found' }
    ]);
    var G = UF.parseEdges(CYCLE_PRESETS[0].text).values, steps;
    function layoutPos(n) {
      var ids = []; for (var i = 0; i < n; i++) ids.push(String(i));
      return V.views.graph.layouts.circle(ids, { w: 1000, h: 600, pad: 90 });
    }
    function gstate(st) {
      var pos = layoutPos(G.n);
      var nodes = [], edges = [];
      for (var i = 0; i < G.n; i++) nodes.push({ id: String(i), x: pos[String(i)].x, y: pos[String(i)].y, state: (st.states && st.states[i]) || 'default' });
      G.edges.forEach(function (e, k) {
        var es = st.edgeStates && st.edgeStates[k] ? st.edgeStates[k] : 'default';
        edges.push({ id: 'e' + k, from: String(e[0]), to: String(e[1]), state: es, pulse: st.edge === k && (st.kind === 'look') });
      });
      return { nodes: nodes, edges: edges };
    }
    function build() {
      steps = UF.cycleDetect(G.n, G.edges);
      steps.forEach(function (st) { st.states = st.states || {}; });
      L.annotate(steps);
      forest.reset(); forest.prepare(steps);
      return steps;
    }
    var player = V.player({
      root: fig, steps: build(), caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { checked: 'Edges checked', merged: 'Groups merged', cycles: 'Cycles found', hops: 'Pointer hops' }, counterStates: { cycles: 'error', merged: 'done', hops: 'path' },
      baseStepMs: 1300, label: 'Cycle detection controls',
      render: function (st, ctx) {
        graph.render(gstate(st), { duration: ctx.duration });
        forest.render({ parent: st.parent, rank: st.rank, states: st.states, colors: st.colors }, { duration: ctx.duration });
      }
    });
    player.addCheckpoint(function (all) {
      var idx = -1, lastRoots = -1;
      all.forEach(function (st, i) { if (st.kind === 'roots') { lastRoots = i; if (idx < 0 && st.caption.indexOf('Same root') >= 0) idx = i; } });
      return idx >= 0 ? idx : lastRoots;
    }, function (c) {
      var st = c.step, e = G.edges[st.edge], same = st.caption.indexOf('Same root') >= 0;
      var u = e[0], v = e[1];
      return {
        question: 'Edge <b>' + u + '–' + v + '</b> is next. Ask find for the root of ' + u + ' and of ' + v + '. Are they going to be the <em>same</em> root?',
        options: ['Yes: the ends are already connected, so this edge closes a cycle', 'No: they are different groups, so the edge joins them'], answer: same ? 0 : 1,
        explain: same
          ? ['Right. Look at the forest: ' + u + ' and ' + v + ' already hang under one root, so a path between them exists without this edge. Adding it makes a loop.', 'They are already in one tree in the forest on the right, so there is no separate group to join.']
          : ['No path joins ' + u + ' and ' + v + ' yet: they sit in different trees on the right, so the edge cannot close a loop.', 'Right. They are in different trees, so this edge is the first link between two groups. It is kept and the groups merge.']
      };
    }, { id: 'uf-cycle-verdict' });
    var pending = null;
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges (vertices 0 to ' + (UF.LIMITS.graphNodes - 1) + ', up to ' + UF.LIMITS.graphEdges + ' edges)', value: CYCLE_PRESETS[0].text, placeholder: 'e.g. 0-1, 1-2, 2-0',
      parse: function (t) { return UF.parseEdges(t, {}); },
      presets: CYCLE_PRESETS.map(function (p) { return { label: p.label, value: p.text }; }),
      hint: 'Write edges as two vertex numbers joined by a dash, separated by commas. The order you write them in is the order they are tested.',
      onApply: function (values) { G = values; player.setSteps(build()); }
    });
    L.cycle = { input: input };
  }

  /* ================================================================== application tabs */
  var SRC = {
    kruskal: 'function kruskal(n, edges) {\n  const dsu = new DSU(n), mst = [];\n  edges.sort((a, b) => a.w - b.w);          // cheapest first\n  for (const { u, v, w } of edges) {\n    if (dsu.union(u, v)) mst.push([u, v, w]); // keep\n  }\n  return mst;\n}',
    regions: 'for (let r = 0; r < R; r++) {\n  for (let c = 0; c < C; c++) {\n    const i = r * C + c;\n    if (c + 1 < C && img[r][c] === img[r][c + 1]) dsu.union(i, i + 1);\n    if (r + 1 < R && img[r][c] === img[r + 1][c]) dsu.union(i, i + C);\n  }\n}\n// the number of regions = the number of roots',
    accounts: 'const owner = new Map();   // e-mail -> first account that had it\naccounts.forEach((acc, i) => {\n  for (const email of acc.emails) {\n    if (owner.has(email)) dsu.union(i, owner.get(email));\n    else owner.set(email, i);\n  }\n});'
  };
  function kruskalMini(host) {
    var g = { nodes: [['A', 90, 90], ['B', 300, 60], ['C', 500, 140], ['D', 110, 330], ['E', 330, 300], ['F', 520, 400]], edges: [['A', 'B', 4], ['A', 'D', 2], ['B', 'C', 6], ['B', 'E', 3], ['C', 'F', 5], ['D', 'E', 7], ['E', 'F', 1], ['C', 'E', 8]] };
    var ids = g.nodes.map(function (n) { return n[0]; });
    var idx = {}; ids.forEach(function (id, i) { idx[id] = i; });
    var steps = UF.kruskal(6, g.edges.map(function (e) { return [idx[e[0]], idx[e[1]], e[2]]; }));
    var view = V.views.graph(host, { bounds: { w: 600, h: 460 }, maxHeight: 250, nodeRadius: 20, minRadius: 12, label: 'Kruskal minimum spanning tree on six vertices' });
    function state(st) {
      return {
        nodes: g.nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2] }; }),
        edges: g.edges.map(function (e, i) { return { id: 'k' + i, from: e[0], to: e[1], weight: e[2], state: st.edgeStates[i] || 'default', pulse: st.cur === i && st.kind === 'look' }; })
      };
    }
    V.teaser(host, { steps: steps, render: function (st, ctx) { view.render(state(st), { duration: ctx.duration }); }, stepMs: 900, holdMs: 1800, instantWrap: true });
  }
  function regionsMini(host) {
    var img = ['001100011', '001001111', '100001001', '110100011', '110000011', '001110000'];
    var R = img.length, C = img[0].length, cells = [];
    img.forEach(function (row) { row.split('').forEach(function (ch) { cells.push(+ch); }); });
    var res = UF.gridComponents(R, C, cells);
    var STATES = ['active', 'done', 'pivot', 'frontier', 'visited', 'compare', 'path', 'error'];
    var view = V.views.grid(host, { mode: 'path', cellSize: 26, showValues: false, label: 'Image regions found with union-find' });
    var steps = []; for (var k = 0; k <= res.count; k++) steps.push({ k: k });
    // regions of the same colour value appear one after another
    function state(st) {
      var out = {};
      for (var i = 0; i < R * C; i++) {
        if (res.label[i] < st.k) out[Math.floor(i / C) + ',' + (i % C)] = { state: cells[i] ? STATES[res.label[i] % 8] : 'visited' };
      }
      return { rows: R, cols: C, cells: out };
    }
    V.teaser(host, { steps: steps, render: function (st, ctx) { view.render(state(st), { duration: ctx.duration }); }, stepMs: 380, holdMs: 1700, instantWrap: true });
  }
  function accountsMini(host) {
    var accts = [['John', ['john@a', 'john@b']], ['Mary', ['mary@c']], ['John', ['john@b', 'john@d']], ['Mary', ['mary@c', 'mary@e']]];
    var wrap = h('div', { class: 'uf-accounts' });
    var cards = accts.map(function (a, i) {
      var card = h('div', { class: 'uf-acct' }, h('p', { class: 'uf-acct__name' }, 'Account ' + i + ' · ' + a[0]), h('div', { class: 'uf-acct__mails' }, a[1].map(function (m) { return h('span', { class: 'uf-mail', 'data-mail': m }, m); })));
      wrap.appendChild(card); return card;
    });
    host.appendChild(wrap);
    var steps = [
      { g: [null, null, null, null], hot: [] }, { g: [0, null, 0, null], hot: ['john@b'] }, { g: [0, 1, 0, 1], hot: ['mary@c'] }
    ];
    V.teaser(host, {
      steps: steps, stepMs: 1300, holdMs: 1800, instantWrap: true,
      render: function (st) {
        cards.forEach(function (c, i) {
          c.className = 'uf-acct' + (st.g[i] === null ? '' : ' uf-g' + st.g[i] + ' is-merged');
          V.$$('.uf-mail', c).forEach(function (m) { m.classList.toggle('is-hot', st.hot.indexOf(m.getAttribute('data-mail')) >= 0); });
        });
      }
    });
  }
  function usesTabs(el) {
    var made = {}, ready = false, tabs;
    function init(name) {
      if (!ready || made[name]) return; made[name] = true;
      var host = V.$('[data-mini="' + name + '"]', el);
      if (name === 'kruskal') kruskalMini(host); else if (name === 'regions') regionsMini(host); else accountsMini(host);
    }
    tabs = V.tabs(el, { onChange: function (name) { requestAnimationFrame(function () { init(name); }); } });
    L.lazy(el, function () {
      V.$$('[data-code-block]', el).forEach(function (p) { V.codeBlock(p, SRC[p.getAttribute('data-code-block')], 'js'); });
      ready = true; init(tabs.value || 'kruskal');
    });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-array', {
      id: 'uf-quiz-array', kicker: 'Predict the array',
      question: 'Union by rank, and when two ranks are equal the <em>first</em> root goes under the second. Starting from four singletons you run <code>union(0, 1)</code>, <code>union(2, 3)</code> and then <code>union(0, 3)</code>. What is the parent array?',
      options: ['[1, 3, 3, 3]', '[1, 1, 3, 3]', '[0, 0, 2, 2]', '[3, 3, 3, 3]'], answer: 0,
      explain: [
        'Yes. union(0,1): equal ranks, 0 goes under 1. union(2,3): 2 goes under 3. union(0,3): the roots are 1 and 3, both rank 1, so 1 goes under 3 and rank[3] becomes 2. Elements 0 and 2 still point at 1 and 3.',
        'That is the array after only the first two unions. The third union links the roots 1 and 3, which changes parent[1].',
        'That would hang 1 under 0 and 3 under 2, the wrong way round: on a tie the first root goes under the second.',
        'Nothing flattened the tree: union only writes one pointer, and no compression ran. Element 0 still points at 1, not straight at 3.'
      ]
    });
    V.quiz('#quiz-rank', {
      id: 'uf-quiz-rank', kicker: 'Which root wins?',
      question: 'A tree with root <b>4</b> has rank 3, and a tree with root <b>9</b> has rank 1. You call <code>union(9, 4)</code> with union by rank. Afterwards, which root is on top and what is its rank?',
      options: ['Root 4, rank 3', 'Root 4, rank 4', 'Root 9, rank 3', 'Root 9, rank 2'], answer: 0,
      explain: [
        'Right. The shorter tree (rank 1) goes under the taller root, whatever the order of the arguments. The taller tree does not get taller, so the rank stays 3.',
        'Rank only grows when two trees of equal rank meet. Here the ranks differ, so nothing grows.',
        'The argument order does not decide. Ranks do: the rank-3 root must stay on top.',
        'That would put the taller tree underneath: every element of it would sink a level, which is exactly what rank tries to avoid.'
      ]
    });
    V.quiz('#quiz-compress', {
      id: 'uf-quiz-compress', kicker: 'Tree after path compression',
      question: 'The chain 0 → 1 → 2 → 3 → 4 has root 4, so <code>parent = [1, 2, 3, 4, 4]</code>. You call <code>find(0)</code> with <b>full</b> path compression. What is the parent array afterwards?',
      options: ['[4, 4, 4, 4, 4]', '[1, 2, 3, 4, 4]', '[2, 2, 4, 4, 4]', '[4, 2, 3, 4, 4]'], answer: 0,
      explain: [
        'Yes. The find walks 0, 1, 2, 3, 4, learns that the root is 4, and re-points every node it passed (0, 1 and 2) straight at 4. Node 3 already pointed at the root.',
        'That is the array with no compression at all. A find without compression leaves the tree untouched.',
        'That is what path <em>halving</em> produces: each visited node jumps to its grandparent. Full compression goes all the way to the root.',
        'Only node 0 was re-pointed. Compression re-points every node on the path, not just the first.'
      ]
    });
    V.quiz('#quiz-cost', {
      id: 'uf-quiz-cost', kicker: 'What does it cost?',
      question: 'You use union by rank but <em>no</em> path compression. What is the worst-case cost of a single <code>find</code> on <em>n</em> elements?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(α(n))'], answer: 1,
      explain: [
        'A find climbs one pointer per level, and the tree can still have several levels, so it is not constant.',
        'Right. A root of rank r covers at least 2<sup>r</sup> elements, so ranks (and heights) never exceed log₂ n. The balanced-merges workload reaches it exactly.',
        'That is the naive structure. Rank exists to stop chains from forming.',
        'α(n) is the amortised cost when you use both rank and path compression. Rank alone only gives log n for one find.'
      ]
    });
    // click on the forest
    var fig = V.$('#fig-click');
    L.lazy(fig, function () {
      var stage = fig.querySelector('[data-stage]');
      L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Element' }]);
      var par = [1, 3, 3, 3, 3, 5, 5, 7];
      var view = L.forestView(stage, { label: 'A forest of eight elements', pointers: false, showRank: false, nodeR: 20 });
      view.render({ parent: par, colors: L.groupColors([par])[0] }, { duration: 0 });
      V.clickQuiz(stage, {
        el: '#quiz-click', id: 'uf-click-root',
        question: 'Click the <b>root</b> of the tree that contains element <b>4</b>.', answer: '3',
        right: 'Right. From 4, parent[4] = 3 and parent[3] = 3: one hop, and 3 points to itself, so 3 is the root.',
        wrong: 'Not that one. Start at 4 and follow parent pointers up until you reach an element that points to itself.'
      });
    });
    if (V.quizScore) V.quizScore.register('uf-click-root');
  }

  /* ================================================================== summary card */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    function tile(text, label, state, body) {
      var viz = h('div', { class: 'summary__viz stage-grid uf-sum' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text', html: text })));
      if (state) { var v = L.forestView(viz, { label: label, nodeR: 11, maxSlot: 36, pointers: false, showRank: !!state.rank, levelH: 36 }); state.colors = state.colors || L.groupColors([state.parent])[0]; v.render(state, { duration: 0 }); }
      else if (body) viz.appendChild(body);
    }
    L.lazy('#summary-card', function () {
      tile('<code>parent[i]</code> points up. A root points at itself.', 'One array', { parent: [1, 1, 1, 3, 3] });
      tile('Follow parents to the root. The cost is the number of hops.', 'find', { parent: [1, 2, 2, 3, 3], states: { 0: 'path', 1: 'path', 2: 'found' }, edgeStates: { 0: 'active', 1: 'active' } });
      tile('Link the two <em>roots</em>, never the raw elements.', 'union', { parent: [0, 0, 3, 0, 0], states: { 3: 'swap', 0: 'found' }, edgeStates: { 3: 'swap' } });
      tile('Shorter tree under the taller root: height ≤ log₂ n.', 'By rank', { parent: [1, 1, 1, 1, 3], rank: [0, 2, 0, 1, 0], states: { 1: 'found' } });
      tile('After a find, point everyone you passed straight at the root.', 'Compression', { parent: [2, 2, 2, 2, 2], states: { 2: 'found', 0: 'swap', 1: 'swap', 3: 'swap' } });
      var big = h('div', { class: 'uf-bigalpha' }, h('span', { class: 'uf-bigalpha__n' }, 'α(n) ≤ 4'), h('span', { class: 'uf-bigalpha__t' }, 'm operations: O(m·α(n))'));
      tile('Nearly constant time, and provably no better is possible.', 'Cost', null, big);
    });
  }

  V.ready(function () {
    L.lazy('#fig-race', raceFigure);
    L.lazy('#fig-cost', costFigure);
    L.lazy('#fig-alpha', alphaFigure);
    L.lazy('#fig-perc', percolationFigure);
    L.lazy('#fig-perc-curve', percolationCurve);
    L.lazy('#fig-cycle', cycleFigure);
    usesTabs(V.$('#uses-tabs'));
    checks();
    summary();
  });
}());
