/* Lesson 29 · Bellman-Ford & Floyd-Warshall — part 2: the Bellman-Ford lab, the Floyd-Warshall lab and their flowcharts.
   Needs js/lessons/29-bellman-ford-and-floyd-warshall.js (VDSA.L29) and js/algos/29-bellman-ford-and-floyd-warshall.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SP = V.algos.shortestPaths;
  var L = V.L29;

  /* ================================================================== code (labels tie lines across languages) */
  var CODE = {
    bf: {
      pseudo: [
        'BellmanFord(V, E, s)',
        '  dist[v] ← ∞ for every vertex; dist[s] ← 0     // @init',
        '  repeat V − 1 times                             // @round',
        '    changed ← false',
        '    for each edge (u, v, w) in E',
        '      if dist[u] + w < dist[v]                   // @check',
        '        dist[v] ← dist[u] + w                    // @relax',
        '        parent[v] ← u; changed ← true            // @relax',
        '    if not changed: return dist                  // @early',
        '  for each edge (u, v, w) in E                   // @verify',
        '    if dist[u] + w < dist[v]                     // @verify',
        '      return "negative cycle"                    // @cycle',
        '  return dist                                    // @done'
      ].join('\n'),
      js: [
        'function bellmanFord(n, edges, s) {',
        '  const dist = Array(n).fill(Infinity), parent = Array(n).fill(-1);',
        '  dist[s] = 0;                                    // @init',
        '  for (let round = 1; round <= n - 1; round++) {  // @round',
        '    let changed = false;',
        '    for (const [u, v, w] of edges) {',
        '      if (dist[u] + w < dist[v]) {                // @check',
        '        dist[v] = dist[u] + w;                    // @relax',
        '        parent[v] = u; changed = true;            // @relax',
        '      }',
        '    }',
        '    if (!changed) return { dist, parent };        // @early',
        '  }',
        '  for (const [u, v, w] of edges) {                // @verify',
        '    if (dist[u] + w < dist[v]) {                  // @verify',
        '      return { negativeCycle: true };             // @cycle',
        '    }',
        '  }',
        '  return { dist, parent };                        // @done',
        '}'
      ].join('\n'),
      py: [
        'def bellman_ford(n, edges, s):',
        '    INF = float("inf")',
        '    dist, parent = [INF] * n, [-1] * n',
        '    dist[s] = 0                                # @init',
        '    for _ in range(n - 1):                     # @round',
        '        changed = False',
        '        for u, v, w in edges:',
        '            if dist[u] + w < dist[v]:          # @check',
        '                dist[v] = dist[u] + w          # @relax',
        '                parent[v] = u; changed = True  # @relax',
        '        if not changed:                        # @early',
        '            return dist, parent                # @early',
        '    for u, v, w in edges:                      # @verify',
        '        if dist[u] + w < dist[v]:              # @verify',
        '            raise ValueError("negative cycle") # @cycle',
        '    return dist, parent                        # @done'
      ].join('\n')
    },
    fw: {
      pseudo: [
        'FloydWarshall(d)   // d[i][j] = weight of edge i → j, else ∞; d[i][i] = 0',
        '  next[i][j] ← j when the edge i → j exists       // @init',
        '  for k ← 1 to V                                  // @pass',
        '    for i ← 1 to V                                // @cell',
        '      for j ← 1 to V                              // @cell',
        '        if d[i][k] + d[k][j] < d[i][j]            // @check',
        '          d[i][j] ← d[i][k] + d[k][j]             // @update',
        '          next[i][j] ← next[i][k]                 // @update',
        '  if some d[i][i] < 0: there is a negative cycle  // @done'
      ].join('\n'),
      js: [
        'function floydWarshall(d, next) {  // d: V x V, Infinity = no edge, 0 on the diagonal',
        '  const n = d.length;                                       // @init',
        '  for (let k = 0; k < n; k++) {                             // @pass',
        '    for (let i = 0; i < n; i++) {                           // @cell',
        '      for (let j = 0; j < n; j++) {                         // @cell',
        '        if (d[i][k] + d[k][j] < d[i][j]) {                  // @check',
        '          d[i][j] = d[i][k] + d[k][j];                      // @update',
        '          next[i][j] = next[i][k];                          // @update',
        '        }',
        '      }',
        '    }',
        '  }',
        '  return d.some((row, i) => row[i] < 0) ? null : d;         // @done',
        '}'
      ].join('\n'),
      py: [
        'def floyd_warshall(d, nxt):   # d: V x V, inf = no edge, 0 on the diagonal',
        '    n = len(d)                                         # @init',
        '    for k in range(n):                                 # @pass',
        '        for i in range(n):                             # @cell',
        '            for j in range(n):                         # @cell',
        '                if d[i][k] + d[k][j] < d[i][j]:        # @check',
        '                    d[i][j] = d[i][k] + d[k][j]        # @update',
        '                    nxt[i][j] = nxt[i][k]              # @update',
        '    return None if any(d[i][i] < 0 for i in range(n)) else d   # @done'
      ].join('\n')
    }
  };
  L.CODE = CODE;

  /* ================================================================== flowcharts (ids = step.flow) */
  var FLOW_BF = {
    nodes: [
      { id: 'cycle', type: 'end', text: 'negative cycle\nreachable', col: 0, row: 0 },
      { id: 'init', type: 'start', text: 'dist[s] ← 0\nall others ← ∞', col: 1, row: 0 },
      { id: 'verify', type: 'decision', text: 'round V:\nsome edge still\nrelaxes?', col: 0, row: 1 },
      { id: 'round', type: 'decision', text: 'round ≤ V − 1 ?', col: 1, row: 1 },
      { id: 'check', type: 'decision', text: 'next edge (u, v, w):\nd[u] + w < d[v] ?', col: 1, row: 2, maxWidth: 170 },
      { id: 'relax', text: 'd[v] ← d[u] + w\nparent[v] ← u', col: 1, row: 3 },
      { id: 'more', type: 'decision', text: 'more edges\nin this round?', col: 1, row: 4 },
      { id: 'changed', type: 'decision', text: 'did any\nedge relax?', col: 1, row: 5 },
      { id: 'done', type: 'end', text: 'return dist\n(all final)', col: 1, row: 6 }
    ],
    edges: [
      { from: 'init', to: 'round' },
      { from: 'round', to: 'check', label: 'yes' },
      { from: 'round', to: 'verify', label: 'no' },
      { from: 'check', to: 'relax', label: 'yes' },
      { from: 'check', to: 'more', label: 'no', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'relax', to: 'more' },
      { from: 'more', to: 'check', label: 'yes', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'more', to: 'changed', label: 'no' },
      { from: 'changed', to: 'round', label: 'yes', via: { fromSide: 'right', toSide: 'right', points: [[1.6, 5], [1.6, 1]] } },
      { from: 'changed', to: 'done', label: 'no (stop early)' },
      { from: 'verify', to: 'cycle', label: 'yes' },
      { from: 'verify', to: 'done', label: 'no', via: { fromSide: 'bottom', toSide: 'left', points: [[0, 6]] } }
    ]
  };
  var FLOW_FW = {
    nodes: [
      { id: 'init', type: 'start', text: 'd ← edge weights\n(∞ if none, 0 on diagonal)', col: 1, row: 0, maxWidth: 200 },
      { id: 'pass', type: 'decision', text: 'next stopover k\n(k = 1 … V) ?', col: 1, row: 1 },
      { id: 'check', type: 'decision', text: 'd[i][k] + d[k][j]\n< d[i][j] ?', col: 1, row: 2 },
      { id: 'update', text: 'd[i][j] ← d[i][k] + d[k][j]\nnext[i][j] ← next[i][k]', col: 1, row: 3, maxWidth: 220 },
      { id: 'more', type: 'decision', text: 'more cells (i, j)\nin this pass?', col: 1, row: 4 },
      { id: 'done', type: 'end', text: 'answer: d\n(negative d[i][i] = negative cycle)', col: 2, row: 1, maxWidth: 190 }
    ],
    edges: [
      { from: 'init', to: 'pass' },
      { from: 'pass', to: 'check', label: 'yes' },
      { from: 'pass', to: 'done', label: 'no' },
      { from: 'check', to: 'update', label: 'yes' },
      { from: 'check', to: 'more', label: 'no', via: { fromSide: 'right', toSide: 'right' } },
      { from: 'update', to: 'more' },
      { from: 'more', to: 'check', label: 'yes', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'more', to: 'pass', label: 'no', via: { fromSide: 'bottom', toSide: 'left', points: [[0, 4.5], [0, 1]] } }
    ]
  };
  L.FLOW_BF = FLOW_BF; L.FLOW_FW = FLOW_FW;

  /* ================================================================== edge tape + round strip (Bellman-Ford lab panels) */
  function edgeTape(el) {
    var chips = [], last = null;
    var cursor = h('span', { class: 'bf-cursor', 'aria-hidden': 'true' });
    el.appendChild(cursor);
    function build(edges, order) {
      chips.forEach(function (c) { c.remove(); });
      chips = order.map(function (ei, p) {
        var e = edges[ei];
        var c = h('span', { class: 'bf-chip' },
          h('span', { class: 'bf-chip__pos' }, String(p + 1)),
          h('span', { class: 'bf-chip__e' }, e.from + ' → ' + e.to),
          h('span', { class: 'bf-chip__w' }, SP.fmtW(e.w)),
          h('span', { class: 'bf-chip__m', 'aria-hidden': 'true' }));
        el.appendChild(c);
        return c;
      });
      last = null;
    }
    function place(st, dur) {
      var c = st && st.pos >= 0 ? chips[st.pos] : null;
      el.style.setProperty('--bf-dur', Math.max(0, dur || 0) + 'ms');
      if (!c) { cursor.style.opacity = '0'; return; }
      cursor.style.opacity = '1';
      cursor.style.left = c.offsetLeft - 3 + 'px'; cursor.style.top = c.offsetTop - 3 + 'px';
      cursor.style.width = c.offsetWidth + 6 + 'px'; cursor.style.height = c.offsetHeight + 6 + 'px';
      cursor.classList.toggle('is-cycle', st.kind === 'cycle');
    }
    function update(st, dur) {
      last = st;
      chips.forEach(function (c, p) {
        var m = st.marks[p];
        c.classList.toggle('is-yes', m === 'yes' && st.kind !== 'cycle');
        c.classList.toggle('is-no', m === 'no');
        c.classList.toggle('is-skip', m === 'skip');
        c.classList.toggle('is-cycle', m === 'yes' && st.kind === 'cycle');
        c.querySelector('.bf-chip__m').textContent = m === 'yes' ? '✓' : m === 'no' ? '–' : m === 'skip' ? '∞' : '';
      });
      place(st, dur);
      el.setAttribute('aria-label', 'Edges in scan order, round ' + st.round);
    }
    V.onResize(el, function () { if (last) place(last, 0); });
    return { build: build, update: update };
  }
  L.edgeTape = edgeTape;

  function roundStrip(el) {
    var chips = [], key = '';
    function build(n) {
      V.clear(el);
      chips = [];
      for (var r = 1; r <= n - 1; r++) chips.push(el.appendChild(h('span', { class: 'bf-round', title: 'Round ' + r }, 'R' + r)));
      chips.push(el.appendChild(h('span', { class: 'bf-round bf-round--check', title: 'Round ' + n + ': the negative-cycle check' }, 'check')));
    }
    function update(st) {
      var n = st.ids.length;
      var k = n + ':' + st.rounds;
      if (k !== key) { key = k; build(n); }
      chips.forEach(function (c, i) {
        var r = i + 1, isCheck = i === chips.length - 1;
        var cls = 'bf-round' + (isCheck ? ' bf-round--check' : '');
        if (!isCheck) {
          if (st.verify || r < st.round) cls += ' is-done';
          else if (r === st.round) cls += st.kind === 'roundEnd' ? ' is-done' : (st.kind === 'early' || st.kind === 'done' ? ' is-flat' : ' is-cur');
          else if (st.early) cls += ' is-skip';
        } else if (st.verify) {
          cls += st.kind === 'cycle' ? ' is-bad' : (st.kind === 'done' ? ' is-done' : ' is-cur');
        }
        c.className = cls;
      });
      el.setAttribute('aria-label', st.verify ? 'Check round' : 'Round ' + st.round + ' of ' + st.rounds);
    }
    return { update: update };
  }
  L.roundStrip = roundStrip;

  /* ================================================================== Bellman-Ford lab */
  var BF_PRESETS = [
    { label: 'Lesson graph', g: L.CLRS, source: 'S' },
    { label: 'Lucky order (early exit)', g: L.CHAIN, source: 'S' },
    { label: 'Unlucky order (V − 1 rounds)', g: { nodes: L.CHAIN.nodes, edges: L.CHAIN.edges.slice().reverse(), directed: true }, source: 'S' },
    { label: 'Negative cycle', g: L.CYCLE, source: 'S' },
    { label: 'Cycle out of reach', source: 'S', g: L.G([['S', 100, 150], ['A', 380, 150], ['B', 680, 150], ['C', 300, 470], ['D', 640, 470]], [['S', 'A', 3], ['A', 'B', 2], ['C', 'D', -3], ['D', 'C', 1], ['D', 'B', 4]]) },
    { label: 'Random', random: true }
  ];
  var randomSeed = 21;

  function bfLab(fig) {
    var G = L.CLRS, source = 'S', orderMode = 'listed', shuffleSeed = 7;
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { directed: true, draggable: true, bounds: { w: 1000, h: 600 }, maxHeight: 400, label: 'Graph for Bellman-Ford, with the current distance on each vertex' });
    var tape = edgeTape(fig.querySelector('[data-tape]'));
    var rounds = roundStrip(fig.querySelector('[data-rounds]'));
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.bf, default: 'pseudo', title: 'bellmanFord', maxHeight: 400 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { round: 'active', 'dist[u]': 'active', 'dist[u] + w': 'compare', 'dist[v]': 'compare', relaxed: 'key' } });
    var srcSel = fig.querySelector('[data-source]');

    var flowFig = V.$('#fig-flow-bf');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_BF, { label: 'Bellman-Ford decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Distance ∞' },
      { state: 'visited', label: 'Has a distance' },
      { state: 'frontier', label: 'Improved this round' },
      { state: 'active', label: 'Edge start u' },
      { state: 'compare', label: 'Edge end v' },
      { state: 'key', label: 'Just relaxed' },
      { state: 'visited', shape: 'line', label: 'Best route so far' },
      { state: 'error', label: 'Negative cycle' },
      { state: 'done', label: 'Final' }
    ]);

    function orderArg() {
      if (orderMode === 'reverse') return 'reverse';
      if (orderMode === 'shuffle') return V.shuffle(V.range(G.edges.length), V.rng(shuffleSeed));
      return 'listed';
    }
    function generate() {
      var raw = SP.bellmanFord(G, source, { order: orderArg() });
      tape.build(G.edges, raw.length ? raw[0].order : []);
      return raw.map(function (st) { var o = Object.assign({}, st); o.vars = L.fixVars(st.vars); return o; });
    }
    function render(step, ctx) {
      view.render(L.bfGraphState(G, step), { duration: ctx.duration });
      tape.update(step, ctx.duration);
      rounds.update(step);
    }
    function fillSource() {
      var ids = G.nodes.map(function (n) { return n.id; });
      if (ids.indexOf(source) < 0) source = ids[0];
      V.clear(srcSel);
      ids.forEach(function (id) { srcSel.appendChild(h('option', { value: id, selected: id === source }, id)); });
    }
    fillSource();
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { round: 'Round', checks: 'Edge checks', relaxed: 'Relaxations' },
      counterStates: { relaxed: 'key', round: 'active' },
      baseStepMs: 1100, animMs: 700, speeds: [0.5, 1, 2, 4, 8], label: 'Bellman-Ford lab controls'
    });

    /* predict: how many vertices know a distance after round 1? */
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'scan' && steps[i].round === 1 && steps[i - 1].kind === 'round') return i;
      return -1;
    }, function (c) {
      var steps = c.steps, n = steps[0].ids.length;
      var end = steps.filter(function (s) { return s.kind === 'roundEnd' || s.kind === 'early'; })[0];
      if (!end || n < 3) return null;
      var have = Object.keys(end.dist).filter(function (id) { return end.dist[id] !== null; }).length;
      var opts = [1, have, n].filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (have + 1 <= n && opts.indexOf(have + 1) < 0 && opts.length < 3) opts.push(have + 1);
      opts.sort(function (a, b) { return a - b; });
      var first = end.order.map(function (ei) { return G.edges[ei]; });
      var why = function (x) {
        if (x === have) return 'Round 1 walks the list once, in order. A vertex only gets a distance when an edge into it is scanned <em>after</em> its own start already has one, so a distance can travel several edges in one round only if the list happens to line up. Here exactly ' + have + ' vertices (' + Object.keys(end.dist).filter(function (id) { return end.dist[id] !== null; }).join(', ') + ') end up with one.';
        if (x === 1) return have > 1 ? 'More than the source gets a distance: edges leaving the source are scanned during this round, and every one of them gives its far end a distance.' : 'Only the source: nothing else is reachable through the edges scanned in this order.';
        if (x === n) return 'Every vertex knowing a distance after one round would need the edge list to be in exactly the right order. Scanning ' + first.length + ' edges does not guarantee it: an edge scanned early cannot use a distance that a later edge creates.';
        return 'Count the vertices whose distance stops being ∞ during this round. It is ' + have + ', not ' + x + '.';
      };
      return {
        question: 'Round 1 is about to scan all ' + first.length + ' edges once, in the order shown. When it finishes, how many vertices (counting the source) will have a distance other than ∞?',
        options: opts.map(String), answer: opts.indexOf(have),
        explain: opts.map(why)
      };
    }, { id: 'lab-bf-round1' });

    function reload() { player.setSteps(generate()); }
    V.segmented(fig.querySelector('[data-order]'), {
      label: 'Edge order', value: 'listed',
      options: [{ value: 'listed', label: 'As listed' }, { value: 'reverse', label: 'Reversed' }, { value: 'shuffle', label: 'Shuffled' }],
      onChange: function (v) { orderMode = v; reload(); }
    });
    srcSel.addEventListener('change', function () { source = srcSel.value; reload(); });

    var pendingPreset = null;
    function setGraph(g, src) {
      G = g;
      if (src) source = src;
      if (view.resetPositions) view.resetPositions();
      fillSource();
      reload();
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges (up to 8 vertices)',
      value: L.toText(G),
      placeholder: 'e.g. S>A:4, A>B:-2, B>C:3',
      parse: function (text) { return SP.parseGraph(text, { maxNodes: 8, maxEdges: 16 }); },
      presets: BF_PRESETS.map(function (p) {
        return { label: p.label, value: function () {
          pendingPreset = p;
          if (p.random) { randomSeed += 1; p.g = SP.randomGraph(6, 9, V.rng(randomSeed), { negative: true }); }
          return L.toText(p.g);
        } };
      }),
      hint: 'Write edges as from>to:weight, e.g. A>B:-2, separated by commas. Negative weights are welcome. The order you type is the order the lab scans them.',
      onApply: function (parsed) {
        var p = pendingPreset;
        pendingPreset = null;
        if (p && p.g && L.toText(p.g) === input.field.value && !p.random) setGraph(p.g, p.source);
        else if (p && p.random) setGraph(L.layoutFor({ nodes: p.g.nodes, edges: p.g.edges }), 'A');
        else setGraph(L.layoutFor(parsed, G), null);
      }
    });
    L.bfLab = { player: player };
  }

  /* ================================================================== Floyd-Warshall lab */
  var FW_PRESETS = [
    { label: 'Lesson graph', g: L.CLRS },
    { label: 'Negative cycle', g: L.CYCLE },
    { label: 'Disconnected pieces', g: L.G([['A', 120, 150], ['B', 400, 150], ['C', 680, 150], ['D', 200, 470], ['E', 560, 470]], [['A', 'B', 3], ['B', 'C', -1], ['D', 'E', 2]]) },
    { label: 'Chain', g: L.CHAIN },
    { label: 'Random', random: true }
  ];

  function fwLab(fig) {
    var G = L.CLRS, mode = 'improve';
    var gview = V.views.graph(fig.querySelector('[data-graph]'), { directed: true, draggable: true, bounds: { w: 1000, h: 600 }, maxHeight: 360, label: 'Graph for Floyd-Warshall, with the current route through k lit' });
    var mview = V.views.grid(fig.querySelector('[data-matrix]'), { cellSize: 54, label: 'Distance matrix d[i][j]' });
    var eq = fig.querySelector('[data-eq]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.fw, default: 'pseudo', title: 'floydWarshall', maxHeight: 400 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { k: 'pivot', i: 'active', j: 'compare', 'd[i][k]': 'key', 'd[k][j]': 'key', 'via k': 'compare' } });

    var flowFig = V.$('#fig-flow-fw');
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_FW, { label: 'Floyd-Warshall decision flow, lit by the lab' });
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'pivot', label: 'Stopover k (row and column)' },
      { state: 'active', label: 'From i' },
      { state: 'compare', label: 'To j' },
      { state: 'key', label: 'The two cells added' },
      { state: 'found', label: 'Cell just improved' },
      { state: 'frontier', label: 'Improved in this pass' },
      { state: 'visited', label: 'Improved earlier' },
      { state: 'path', shape: 'line', label: 'Route through k' },
      { state: 'error', label: 'Negative cycle' }
    ]);

    function generate() {
      return SP.floydWarshall(G, { mode: mode }).map(function (st) { var o = Object.assign({}, st); o.vars = L.fixVars(st.vars); return o; });
    }
    function eqText(st) {
      var ids = st.ids;
      if (st.kind === 'init') return '<span class="bf-eq__hint">Start: every cell holds the cost of a single edge.</span>';
      if (st.kind === 'done') return '<span class="bf-eq__hint">' + (st.negCycle ? 'Negative diagonal: a negative cycle.' : 'Finished: every entry is a shortest distance.') + '</span>';
      if (st.k < 0) return '';
      if (st.kind === 'kstart' || st.kind === 'kend') return '<span class="bf-eq__hint">Stopover <b>' + ids[st.k] + '</b>: row ' + ids[st.k] + ' and column ' + ids[st.k] + ' are the only cells read.</span>';
      var a = st.d[st.via.a[0]][st.via.a[1]], b = st.d[st.via.b[0]][st.via.b[1]], cur = st.kind === 'update' ? null : st.d[st.i][st.j];
      function chip(cls, name, v) { return '<span class="bf-eq__chip ' + cls + '"><i>' + name + '</i>' + (v === null ? '∞' : SP.fmtD(v)) + '</span>'; }
      var nm = function (x, y) { return 'd[' + ids[x] + '][' + ids[y] + ']'; };
      var out = chip('is-a', nm(st.i, st.k), a) + '<span class="bf-eq__op">+</span>' + chip('is-b', nm(st.k, st.j), b) + '<span class="bf-eq__op">=</span>' +
        '<span class="bf-eq__chip is-sum">' + (st.cand === null ? '∞' : SP.fmtD(st.cand)) + '</span>';
      if (st.kind === 'update') out += '<span class="bf-eq__op">→</span><span class="bf-eq__chip is-new"><i>' + nm(st.i, st.j) + '</i>' + SP.fmtD(st.cand) + '</span>';
      else out += '<span class="bf-eq__op">' + (st.result === 'yes' ? '&lt;' : st.result === 'skip' ? '' : '≥') + '</span><span class="bf-eq__chip"><i>' + nm(st.i, st.j) + '</i>' + (cur === null ? '∞' : SP.fmtD(cur)) + '</span>';
      return out;
    }
    function render(step, ctx) {
      gview.render(L.fwGraphState(G, step), { duration: ctx.duration });
      mview.render(L.fwGridState(step, {}), { duration: ctx.duration });
      eq.innerHTML = eqText(step);
    }
    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { pass: 'Pass k', checks: 'Cell checks', updates: 'Improvements' },
      counterStates: { updates: 'found', pass: 'pivot' },
      baseStepMs: 1000, animMs: 700, speeds: [0.5, 1, 2, 4, 8], label: 'Floyd-Warshall lab controls'
    });

    /* predict: which cell improves first in pass 2 */
    player.addCheckpoint(function (steps) {
      if (mode !== 'improve' || !steps.length) return -1;
      for (var i = 0; i + 1 < steps.length; i++) if (steps[i].kind === 'kstart' && steps[i].k >= 1 && steps[i + 1].kind === 'update') return i + 1;
      return -1;
    }, function (c) {
      var st = c.step, prev = c.prev, k = st.k, ids = st.ids, n = st.n;
      if (k < 1 || n < 3) return null;
      // every cell that improves during this pass
      var updated = {};
      for (var i = c.index; i < c.steps.length && c.steps[i].kind !== 'kend'; i++) if (c.steps[i].kind === 'update') updated[c.steps[i].i + ',' + c.steps[i].j] = true;
      function nm(x, y) { return 'd[' + ids[x] + '][' + ids[y] + ']'; }
      var opts = [{ cell: [st.i, st.j], right: true }];
      // decoy 1: a cell that cannot combine because one half is unknown
      var d1 = null, d2 = null, x, y;
      for (x = 0; x < n && !d1; x++) for (y = 0; y < n && !d1; y++) {
        if (x === k || y === k || x === y || updated[x + ',' + y]) continue;
        if (prev.d[x][k] === null || prev.d[k][y] === null) d1 = [x, y];
      }
      // decoy 2: a cell of row k itself
      for (y = 0; y < n && !d2; y++) if (y !== k && !updated[k + ',' + y]) d2 = [k, y];
      if (!d2) for (x = 0; x < n && !d2; x++) for (y = 0; y < n && !d2; y++) if (!updated[x + ',' + y] && !(d1 && d1[0] === x && d1[1] === y) && !(x === st.i && y === st.j)) d2 = [x, y];
      if (!d1) for (x = 0; x < n && !d1; x++) for (y = 0; y < n && !d1; y++) if (!updated[x + ',' + y] && !(d2 && d2[0] === x && d2[1] === y) && !(x === st.i && y === st.j)) d1 = [x, y];
      if (d1) opts.push({ cell: d1 });
      if (d2) opts.push({ cell: d2 });
      if (opts.length < 2) return null;
      var pos = (n + k) % opts.length;
      opts.splice(pos, 0, opts.shift());
      var kn = ids[k];
      function whyNot(o) {
        var a = prev.d[o.cell[0]][k], b = prev.d[k][o.cell[1]];
        if (o.cell[0] === k || o.cell[1] === k) return nm(o.cell[0], o.cell[1]) + ' lies on row ' + kn + ' or column ' + kn + ' itself. Going through ' + kn + ' to reach ' + kn + ' adds d[' + kn + '][' + kn + '] = 0 and gains nothing.';
        if (a === null) return 'To use ' + kn + ' as a stopover, ' + ids[o.cell[0]] + ' must be able to reach ' + kn + ': d[' + ids[o.cell[0]] + '][' + kn + '] is still ∞, so this cell cannot improve in this pass.';
        if (b === null) return 'To use ' + kn + ' as a stopover, ' + kn + ' must be able to reach ' + ids[o.cell[1]] + ': d[' + kn + '][' + ids[o.cell[1]] + '] is still ∞, so this cell cannot improve in this pass.';
        return 'Going through ' + kn + ' costs ' + SP.fmtD(a + b) + ', which is not cheaper than the ' + SP.fmtD(prev.d[o.cell[0]][o.cell[1]]) + ' already there.';
      }
      var a0 = prev.d[st.i][k], b0 = prev.d[k][st.j];
      return {
        question: 'Pass ' + (k + 1) + ' allows routes to stop over at <b>' + kn + '</b>, so only row ' + kn + ' and column ' + kn + ' are read. Scanning the matrix row by row, which cell improves <b>first</b>?',
        options: opts.map(function (o) { return '<code>' + nm(o.cell[0], o.cell[1]) + '</code>'; }),
        answer: opts.findIndex(function (o) { return o.right; }),
        explain: opts.map(function (o) {
          return o.right ? ids[st.i] + ' → ' + kn + ' → ' + ids[st.j] + ' costs ' + SP.fmtD(a0) + ' + ' + SP.fmtD(b0) + ' = ' + SP.fmtD(st.cand) + (prev.d[st.i][st.j] === null ? ', and there was no route at all before.' : ', cheaper than ' + SP.fmtD(prev.d[st.i][st.j]) + '.') + ' It is the first such cell in row-by-row order.' : whyNot(o);
        })
      };
    }, { id: 'lab-fw-pass2' });

    function reload() { player.setSteps(generate()); }
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Steps shown', value: 'improve',
      options: [{ value: 'improve', label: 'Improvements only' }, { value: 'all', label: 'Every cell check' }],
      onChange: function (v) { mode = v; reload(); }
    });
    var pendingPreset = null;
    function setGraph(g) {
      G = g;
      if (gview.resetPositions) gview.resetPositions();
      reload();
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges (up to 6 vertices)',
      value: L.toText(G),
      placeholder: 'e.g. A>B:3, B>C:-1, C>A:2',
      parse: function (text) { return SP.parseGraph(text, { maxNodes: 6, maxEdges: 16 }); },
      presets: FW_PRESETS.map(function (p) {
        return { label: p.label, value: function () {
          pendingPreset = p;
          if (p.random) { randomSeed += 1; p.g = SP.randomGraph(5, 8, V.rng(randomSeed), { negative: true }); }
          return L.toText(p.g);
        } };
      }),
      hint: 'Write edges as from>to:weight, separated by commas. Up to 6 vertices keeps the matrix readable.',
      onApply: function (parsed) {
        var p = pendingPreset;
        pendingPreset = null;
        if (p && p.g && !p.random && L.toText(p.g) === input.field.value) setGraph(p.g);
        else if (p && p.random) setGraph(L.layoutFor({ nodes: p.g.nodes, edges: p.g.edges }));
        else setGraph(L.layoutFor(parsed, G));
      }
    });
  }

  V.ready(function () {
    L.lazy('#lab-bf', bfLab);
    L.lazy('#lab-fw', fwLab);
  });
}());
