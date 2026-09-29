/* Lesson 31 · Max flow & min cut — part 5: cost charts, the race, patterns, checks and the summary card.
   Needs js/lessons/31-network-flow.js (VDSA.L31) and js/algos/31-network-flow.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var NF = V.algos.networkFlow;
  var L = V.L31;

  /* The classic trap: two fat side pipes and a thin middle pipe of capacity 1. */
  function trap(M) {
    return NF.parseNetwork('s-a:' + M + ', s-b:' + M + ', a-b:1, a-t:' + M + ', b-t:' + M).values;
  }
  function unlucky(round) { return round % 2 ? ['s', 'a', 'b', 't'] : ['s', 'b', 'a', 't']; }

  /* ================================================================== chart 1: augmentations vs capacity */
  function costAug(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 300, label: 'Augmentations needed as the capacity M grows' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Any path, unlucky choices' }, { state: 'done', shape: 'line', label: 'Edmonds-Karp' }, { state: 'muted', shape: 'dash', label: 'Bound V·E/2' }]);
    var pts = [], ek = [];
    for (var M = 1; M <= 30; M++) {
      var net = trap(M);
      pts.push([M, NF.maxFlow(net, { forced: unlucky }).rounds]);
      ek.push([M, NF.maxFlow(net).rounds]);
    }
    var bound = 4 * 5 / 2;
    var cur = 12;
    function draw(ms) {
      chart.render({
        x: { label: 'capacity M of the four fat pipes', min: 1, max: 30 },
        y: { label: 'augmentations', min: 0, max: 64 },
        series: [
          { id: 'bad', label: 'any path, unlucky', points: pts, state: 'error', markers: false },
          { id: 'ek', label: 'Edmonds-Karp', points: ek, state: 'done', markers: false },
          { id: 'bound', label: 'V·E/2 = ' + bound, fn: function () { return bound; }, domain: [1, 30], state: 'muted', dashed: true }
        ],
        highlight: [{ series: 'bad', x: cur, label: 2 * cur + ' rounds' }, { series: 'ek', x: cur, label: '2' }]
      }, { duration: ms });
    }
    draw(700);
    V.slider(fig.querySelector('[data-slider]'), { label: 'Capacity M', min: 1, max: 30, value: cur, format: function (v) { return 'M = ' + v; }, onInput: function (v) { cur = v; draw(250); } });
  }

  /* ================================================================== chart 2: measured vs the bound on random networks */
  function costRand(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'scatter', height: 300, label: 'Measured augmentations against the V·E/2 bound for random networks' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'dot', label: 'One random network' }, { state: 'muted', shape: 'dash', label: 'Worst-case bound' }]);
    var seed = 100;
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { nets: 'Networks', worst: 'Most augmentations', ratio: 'Largest share of the bound' }, states: { ratio: 'done' } });
    function draw() {
      var pts = [], worst = 0, ratio = 0;
      for (var i = 0; i < 60; i++) {
        var net = L.randomNet(seed + i), N = L.norm(net);
        var bound = N.ids.length * N.edges.length / 2;
        var r = NF.maxFlow(net).rounds;
        pts.push([bound, r, 'n' + (seed + i)]);
        worst = Math.max(worst, r); ratio = Math.max(ratio, r / bound);
      }
      chart.render({
        x: { label: 'bound V·E/2 for this network', min: 0, max: 60 },
        y: { label: 'augmentations measured', min: 0, max: 60 },
        series: [
          { id: 'pts', label: 'random networks', points: pts, state: 'active' },
          { id: 'bound', label: 'bound', fn: function (x) { return x; }, domain: [0, 60], state: 'muted', dashed: true }
        ]
      }, { duration: 600 });
      stats.update({ nets: 60, worst: worst, ratio: Math.round(ratio * 100) + '%' });
    }
    draw();
    fig.querySelector('[data-reroll]').addEventListener('click', function () { seed += 60; draw(); });
  }

  /* ================================================================== race: unlucky paths vs shortest paths */
  function raceFigure(fig) {
    var M = 4, net = L.make('s-a:' + M + ', s-b:' + M + ', a-b:1, a-t:' + M + ', b-t:' + M, { s: [90, 300], a: [450, 110], b: [450, 490], t: [915, 300] });
    var bad = NF.trace(net, { forced: unlucky, detail: 'rounds' }).filter(function (x) { return x.kind === 'init' || x.kind === 'push'; });
    var ek = NF.trace(net, { detail: 'rounds' }).filter(function (x) { return x.kind === 'init' || x.kind === 'push'; });
    var steps = bad.map(function (b, i) {
      return { left: b, right: ek[Math.min(i, ek.length - 1)], i: i, caption: i === 0
        ? 'Both start with empty pipes. The thin middle pipe a→b has capacity 1 and is the trap.'
        : i <= ek.length - 1
          ? 'Edmonds-Karp takes the shortest route, straight down a side pipe, and moves <b>' + M + '</b> units at once. The unlucky search pushes only 1 unit through the middle pipe.'
          : 'The unlucky search keeps zig-zagging through the thin middle pipe, one unit per round: forward across it, then back along the reverse arc. Edmonds-Karp finished ' + (i - ek.length + 1) + ' round' + (i - ek.length + 1 === 1 ? '' : 's') + ' ago.' };
    });
    var lv = V.views.graph(fig.querySelector('[data-stage="left"]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 300, label: 'Any path, unlucky choices', nodeRadius: 28, minRadius: 14 });
    var rv = V.views.graph(fig.querySelector('[data-stage="right"]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 300, label: 'Edmonds-Karp', nodeRadius: 28, minRadius: 14 });
    var lc = fig.querySelector('[data-count="left"]'), rc = fig.querySelector('[data-count="right"]');
    L.legend(fig.querySelector('[data-legend]'), [L.LEG.empty, L.LEG.flow, L.LEG.full, L.LEG.path]);
    V.player({
      root: fig, steps: steps,
      render: function (st, ctx) {
        lv.render(L.flowState(net, st.left), { duration: ctx.duration });
        rv.render(L.flowState(net, st.right), { duration: ctx.duration });
        lc.innerHTML = '<b>' + st.left.counters.augmentations + '</b> augmentations, flow <b>' + st.left.value + '</b> of ' + 2 * M;
        rc.innerHTML = '<b>' + st.right.counters.augmentations + '</b> augmentations, flow <b>' + st.right.value + '</b> of ' + 2 * M + (st.right.value === 2 * M ? ' (done)' : '');
      },
      caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Race controls'
    });
  }

  /* ================================================================== patterns (tabs with mini visuals) */
  function patterns(sec) {
    var tabs = V.$('#patterns-tabs');
    if (tabs) V.tabs(tabs);
    function mini(sel, net, step, o) {
      var host = V.$(sel, sec);
      if (!host) return;
      var v = V.views.graph(host, Object.assign({ directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 230, label: 'Pattern diagram', nodeRadius: 26, minRadius: 16 }, o || {}));
      v.render(L.flowState(net, step, {}), { duration: 0 });
      return v;
    }
    // 1: matching, final flow
    var pairs = [['Ana', 'Web'], ['Ana', 'Data'], ['Ben', 'Web'], ['Cy', 'Data']];
    var mm = NF.matchingNetwork(pairs), mt = NF.trace(mm.net, { detail: 'rounds' });
    mini('[data-mini="match"]', mm.net, L.last(mt).kind === 'cut' ? mt[mt.length - 2] : L.last(mt));
    // 2: vertex capacity by splitting; a two-frame loop
    var host = V.$('[data-mini="split"]', sec);
    if (host) {
      var v = V.views.graph(host, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 230, label: 'A vertex with capacity 3 becomes an edge with capacity 3', nodeRadius: 26, minRadius: 16 });
      var A = { nodes: [{ id: 's', x: 90, y: 300, state: 'key' }, { id: 'm', x: 500, y: 300, label: 'm', sub: 'passes ≤ 3' }, { id: 't', x: 910, y: 300, state: 'key' }],
        edges: [{ id: 's-m', from: 's', to: 'm', directed: true, label: '5' }, { id: 'm-t', from: 'm', to: 't', directed: true, label: '5' }] };
      var B = { nodes: [{ id: 's', x: 90, y: 300, state: 'key' }, { id: 'm', x: 340, y: 300, label: 'm_in' }, { id: 'mo', x: 670, y: 300, label: 'm_out' }, { id: 't', x: 915, y: 300, state: 'key' }],
        edges: [{ id: 's-m', from: 's', to: 'm', directed: true, label: '5' }, { id: 'm-mo', from: 'm', to: 'mo', directed: true, label: '3', state: 'compare' }, { id: 'mo-t', from: 'mo', to: 't', directed: true, label: '5' }] };
      V.teaser(host, { steps: [A, B], render: function (st, ctx) { v.render(st, { duration: ctx.duration }); }, stepMs: 1500, holdMs: 1500, instantWrap: false });
    }
    // 3: many sources
    var multi = { nodes: [{ id: 'S', x: 80, y: 300, label: 'S*', state: 'key' }, { id: 'a', x: 330, y: 130, label: 's1' }, { id: 'b', x: 330, y: 470, label: 's2' }, { id: 'c', x: 640, y: 300 }, { id: 't', x: 915, y: 300, state: 'key' }],
      edges: [{ id: 'S-a', from: 'S', to: 'a', directed: true, label: '∞', dashed: true }, { id: 'S-b', from: 'S', to: 'b', directed: true, label: '∞', dashed: true }, { id: 'a-c', from: 'a', to: 'c', directed: true, label: '4' }, { id: 'b-c', from: 'b', to: 'c', directed: true, label: '6' }, { id: 'c-t', from: 'c', to: 't', directed: true, label: '8' }] };
    var mh = V.$('[data-mini="multi"]', sec);
    if (mh) V.views.graph(mh, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 230, label: 'A super source joins two sources', nodeRadius: 26, minRadius: 16 }).render(multi, { duration: 0 });
    // 4: image segmentation on a tiny grid
    var gh = V.$('[data-mini="seg"]', sec);
    if (gh) {
      var cells = [];
      var pat = ['ffffm', 'fffmm', 'ffmmm', 'fmmmm'];
      pat.forEach(function (row, r) { cells.push(row.split('').map(function (c) { return { state: c === 'f' ? 'found' : 'muted' }; })); });
      V.views.grid(gh, { mode: 'path', cellSize: 40, showValues: false, label: 'A tiny image split into foreground and background by a minimum cut' }).render({ rows: 4, cols: 5, cells: cells }, { duration: 0 });
    }
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-after', {
      id: 'nf-check-after', question: 'Edmonds-Karp has just stopped: its search from s can no longer reach t. Which statement is <em>true</em>?',
      options: ['The flow is maximum, and the vertices the search did reach form a minimum cut.', 'The flow is maximum, but you must search again to find a cut.', 'The flow may still be improvable by a different sequence of paths.', 'Every edge in the network is now full.'],
      answer: 0,
      explain: [
        'Yes. No path from s to t in the residual graph means every edge leaving the reached set S is full and every edge coming back into S is empty, so the flow equals the capacity of that cut.',
        'The search that just failed already is the cut: S is exactly the set it reached. Nothing more to compute.',
        'No: a failed search proves optimality. Any flow is at most the capacity of any cut, and this cut has the same value as your flow.',
        'Only the edges that cross the cut are guaranteed full. Other edges can have plenty of room left, and that is fine.'
      ]
    });
    V.quiz('#quiz-why-bfs', {
      id: 'nf-check-why-bfs', question: 'Why does Edmonds-Karp insist on the <em>shortest</em> augmenting path (BFS) rather than any path?',
      options: ['It bounds the number of augmentations by O(V·E), whatever the capacities are.', 'Shortest paths carry more flow.', 'It is the only way to find a minimum cut.', 'Without it the algorithm can return a wrong answer.'],
      answer: 0,
      explain: [
        'Yes. With shortest paths, the distance from s to every vertex in the residual graph never decreases, and each edge can be the bottleneck only O(V) times. That gives O(V·E) augmentations of O(E) each: O(V·E²).',
        'Not so: a short path can have a tiny bottleneck. The gain is in how few rounds are needed overall, not in one round moving more.',
        'Any maximum flow reveals a minimum cut through the final residual graph, however the paths were chosen.',
        'Any choice ends with a correct maximum flow, if it ends. The risk is time: with unlucky paths the number of rounds can grow with the capacities.'
      ]
    });
    V.quiz('#quiz-matching', {
      id: 'nf-check-matching', question: 'In the flow network for matching workers to jobs, every pipe has capacity 1. What does a flow of value <b>5</b> tell you?',
      options: ['Five pairs can be matched, each worker to one job and each job to one worker.', 'Five workers can each do all their jobs.', 'The best job has five workers.', 'Five is an upper bound, not always reachable.'],
      answer: 0,
      explain: [
        'Yes. The pipe from s into a worker carries 1 at most, and so does the pipe from a job to t. Each unit of flow that crosses the middle is one worker-job pair, and integer flows use whole pipes.',
        'A worker receives at most one unit from s, so it can pass on flow to at most one job.',
        'The flow counts matched pairs across the whole network, not the popularity of one job.',
        'The maximum flow is exactly reachable: it is the size of the largest matching. Augmenting paths always find it.'
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
      svg.appendChild(s('line', { x1: a[1], y1: a[2], x2: b[1], y2: b[2], style: 'stroke:' + (st ? 'var(--st-' + st + ')' : 'var(--el-edge)') + ';stroke-width:' + (st ? 4 : 2) + (e[3] ? ';stroke-dasharray:4 3' : '') + ';stroke-linecap:round' }));
      if (e[4]) svg.appendChild(s('text', { x: (a[1] + b[1]) / 2, y: (a[2] + b[2]) / 2 - 5, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 9px var(--font-mono)' }, e[4]));
    });
    nodes.forEach(function (n) {
      var st = n[3] || 'default';
      var fill = st === 'default' ? 'var(--el-fill)' : 'color-mix(in srgb, var(--st-' + st + ') 30%, var(--el-fill))';
      svg.appendChild(s('circle', { cx: n[1], cy: n[2], r: 8, style: 'fill:' + fill + ';stroke:' + (st === 'default' ? 'var(--el-stroke)' : 'var(--st-' + st + ')') + ';stroke-width:1.5' }));
    });
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: tiny([['s', 15, 40, 'key'], ['a', 80, 20], ['b', 80, 60], ['t', 145, 40, 'key']], [['s', 'a', 'active', 0, '3/5'], ['s', 'b'], ['a', 't', 'active', 0, '3/4'], ['b', 't']], { label: 'Capacity and conservation' }),
        label: 'Two rules', text: 'Never exceed a pipe’s capacity; every vertex but s and t passes on what it receives.' },
      { svg: tiny([['s', 15, 40, 'key'], ['a', 55, 20, 'path'], ['b', 105, 60, 'path'], ['t', 145, 40, 'key']], [['s', 'a', 'path'], ['a', 'b', 'compare'], ['b', 't', 'path']], { label: 'Augmenting path' }),
        label: 'Augment', text: 'Find any route with room, push its bottleneck, repeat. Value rises every round.' },
      { svg: tiny([['u', 25, 25], ['v', 135, 25], ['x', 25, 58], ['y', 135, 58]], [['u', 'v', 'path', 0, '5−f'], ['y', 'x', 'pivot', 1, 'f']], { label: 'Residual graph' }),
        label: 'Reverse arcs', text: 'Each pipe with flow f adds a reverse arc of room f: the power to undo.' },
      { svg: tiny([['s', 15, 40, 'key'], ['a', 65, 40, 'visited'], ['b', 105, 40], ['t', 145, 40, 'key']], [['s', 'a', 'visited'], ['a', 'b', 'error', 0, 'full'], ['b', 't']], { label: 'Cut' }),
        label: 'Max flow = min cut', text: 'When no path is left, the vertices reached and the rest form a cut as small as the flow.' },
      { svg: tiny([['s', 15, 40, 'key'], ['w', 65, 22, 'done'], ['j', 105, 22, 'done'], ['t', 145, 40, 'key'], ['w2', 65, 60], ['j2', 105, 60]], [['s', 'w'], ['w', 'j', 'done'], ['j', 't'], ['s', 'w2'], ['w2', 'j2'], ['j2', 't']], { label: 'Matching' }),
        label: 'Matching', text: 'Unit capacities turn “workers to jobs” into a flow: value = pairs matched.' },
      { svg: tiny([['a', 20, 40], ['b', 55, 20], ['c', 90, 60], ['d', 125, 30], ['e', 145, 55]], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['a', 'c']], { label: 'Cost' }),
        label: 'O(V·E²)', text: 'Shortest paths (BFS) bound the rounds by V·E, whatever the capacities are.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-cost-aug', costAug);
    L.lazy('#fig-cost-rand', costRand);
    L.lazy('#fig-race', raceFigure);
    L.lazy('#patterns', patterns);
    checks();
    summaryCard();
  });
}());
