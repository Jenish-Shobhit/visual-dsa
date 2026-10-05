/* Lesson 31 · Max flow & min cut — part 3: the Edmonds-Karp lab, the flowchart it lights, and the staircase chart.
   Needs js/lessons/31-network-flow.js (VDSA.L31) and js/algos/31-network-flow.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var NF = V.algos.networkFlow;
  var L = V.L31;

  /* ================================================================== code (labels tie lines across languages) */
  var CODE = {
    pseudo: [
      'maxFlow(graph, s, t)',
      '  flow[e] ← 0 for every edge                      // @init',
      '  repeat                                          // @loop',
      '    BFS from s over arcs with room > 0            // @bfs',
      '    if t was not reached: stop                    // @nopath',
      '    b ← smallest room along the path              // @bottleneck',
      '    for each arc on the path                      // @augment',
      '      forward arc: flow += b; reverse arc: flow −= b   // @augment',
      '    value ← value + b                             // @value',
      '  S ← vertices the last search reached            // @cut',
      '  return value and the cut (S, the rest)          // @cut'
    ].join('\n'),
    js: [
      'function maxFlow(n, edges, s, t) {   // edges: [from, to, capacity]',
      '  const g = Array.from({ length: n }, () => []);',
      '  for (const [u, v, cap] of edges) {                                // @init',
      '    g[u].push({ to: v, cap, rev: g[v].length });                    // @init',
      '    g[v].push({ to: u, cap: 0, rev: g[u].length - 1 });             // @init',
      '  }',
      '  let value = 0, prev;',
      '  while (true) {                                                    // @loop',
      '    prev = new Array(n).fill(null); prev[s] = { u: s };             // @bfs',
      '    const queue = [s];                                              // @bfs',
      '    while (queue.length && !prev[t]) {                              // @bfs',
      '      const u = queue.shift();                                      // @bfs',
      '      g[u].forEach((e, i) => {                                      // @bfs',
      '        if (e.cap > 0 && !prev[e.to]) { prev[e.to] = { u, i }; queue.push(e.to); }  // @bfs',
      '      });',
      '    }',
      '    if (!prev[t]) break;                                            // @nopath',
      '    let b = Infinity;                                               // @bottleneck',
      '    for (let v = t; v !== s; v = prev[v].u)                         // @bottleneck',
      '      b = Math.min(b, g[prev[v].u][prev[v].i].cap);                 // @bottleneck',
      '    for (let v = t; v !== s; v = prev[v].u) {                       // @augment',
      '      const e = g[prev[v].u][prev[v].i];                            // @augment',
      '      e.cap -= b; g[v][e.rev].cap += b;                             // @augment',
      '    }',
      '    value += b;                                                     // @value',
      '  }',
      '  const S = prev.map((p) => p !== null);                            // @cut',
      '  return { value, S };                                              // @cut',
      '}'
    ].join('\n'),
    py: [
      'from collections import deque',
      '',
      'def max_flow(n, edges, s, t):          # edges: (from, to, capacity)',
      '    g = [[] for _ in range(n)]',
      '    for u, v, cap in edges:                                    # @init',
      '        g[u].append([v, cap, len(g[v])])                       # @init',
      '        g[v].append([u, 0, len(g[u]) - 1])                     # @init',
      '    value = 0',
      '    while True:                                                # @loop',
      '        prev = [None] * n; prev[s] = (s, -1)                   # @bfs',
      '        queue = deque([s])                                     # @bfs',
      '        while queue and prev[t] is None:                       # @bfs',
      '            u = queue.popleft()                                # @bfs',
      '            for i, (v, cap, _) in enumerate(g[u]):             # @bfs',
      '                if cap > 0 and prev[v] is None:                # @bfs',
      '                    prev[v] = (u, i); queue.append(v)          # @bfs',
      '        if prev[t] is None: break                              # @nopath',
      '        b, v = float("inf"), t                                 # @bottleneck',
      '        while v != s:                                          # @bottleneck',
      '            u, i = prev[v]; b = min(b, g[u][i][1]); v = u      # @bottleneck',
      '        v = t                                                  # @augment',
      '        while v != s:                                          # @augment',
      '            u, i = prev[v]                                     # @augment',
      '            g[u][i][1] -= b; g[v][g[u][i][2]][1] += b          # @augment',
      '            v = u                                              # @augment',
      '        value += b                                             # @value',
      '    S = [p is not None for p in prev]                          # @cut',
      '    return value, S                                            # @cut'
    ].join('\n')
  };
  L.CODE = CODE;

  /* ================================================================== flowchart (ids = step.flow) */
  var FLOW_SPEC = {
    nodes: [
      { id: 'init', type: 'start', text: 'flow ← 0 on every edge', col: 1, row: 0 },
      { id: 'bfs', text: 'BFS from s over arcs with room > 0', col: 1, row: 1 },
      { id: 'found', type: 'decision', text: 'reached t?', col: 1, row: 2 },
      { id: 'bottleneck', text: 'b ← smallest room on the path', col: 1, row: 3 },
      { id: 'augment', text: 'push b: forward arcs +b, reverse arcs −b\nvalue ← value + b', col: 1, row: 4, maxWidth: 210 },
      { id: 'cut', type: 'end', text: 'stop. S = vertices reached is a minimum cut; its capacity = value', col: 2, row: 2, maxWidth: 190 }
    ],
    edges: [
      { from: 'init', to: 'bfs' },
      { from: 'bfs', to: 'found' },
      { from: 'found', to: 'bottleneck', label: 'yes' },
      { from: 'found', to: 'cut', label: 'no' },
      { from: 'bottleneck', to: 'augment' },
      { from: 'augment', to: 'bfs', label: 'repeat', via: { fromSide: 'left', toSide: 'left' } }
    ]
  };

  /* ================================================================== random network for the "Random" preset */
  L.randomNet = function (seed) {
    var rng = V.rng(seed), sizes = [], layers = rng.int(2, 3);
    for (var i = 0; i < layers; i++) sizes.push(layers === 3 ? rng.int(2, 2) + (rng() < 0.3 ? 1 : 0) : rng.int(2, 3));
    var names = [], layerIds = [], k = 0;
    sizes.forEach(function (n) { var ids = []; for (var j = 0; j < n; j++) ids.push(String.fromCharCode(97 + k++)); layerIds.push(ids); });
    var edges = [], seen = {};
    function add(u, v) { var key = u + '-' + v; if (seen[key]) return; seen[key] = true; edges.push({ from: u, to: v, cap: rng.int(2, 9) }); }
    layerIds[0].forEach(function (id) { add('s', id); });
    layerIds.forEach(function (ids, li) {
      var nextIds = li === layerIds.length - 1 ? ['t'] : layerIds[li + 1];
      ids.forEach(function (id) { add(id, rng.pick(nextIds)); if (rng() < 0.6) add(id, rng.pick(nextIds)); });
      nextIds.forEach(function (nid) { if (!edges.some(function (e) { return e.to === nid && ids.indexOf(e.from) !== -1; })) add(rng.pick(ids), nid); });
    });
    var nodes = [{ id: 's', x: 90, y: 300 }], step = 825 / (layers + 1);
    layerIds.forEach(function (ids, li) {
      ids.forEach(function (id, j) { nodes.push({ id: id, x: 90 + step * (li + 1), y: ids.length === 1 ? 300 : 90 + (420 * j) / (ids.length - 1) + 30 }); });
    });
    nodes.push({ id: 't', x: 915, y: 300 });
    void names;
    return { nodes: nodes, edges: edges, source: 's', sink: 't' };
  };

  /* Layered left-to-right layout for a typed network. */
  function layoutNet(parsed) {
    var pos = V.views.graph.layouts.layered(parsed.nodes, parsed.edges.map(function (e) { return { from: e.from, to: e.to }; }), { w: 1000, h: 600, pad: 95, direction: 'LR' });
    return {
      nodes: parsed.nodes.map(function (id) { var p = pos[id] || { x: 500, y: 300 }; return { id: id, x: p.x, y: p.y }; }),
      edges: parsed.edges, source: 's', sink: 't'
    };
  }

  var PRESETS = [
    { label: 'Lesson network', net: L.MAIN },
    { label: 'Greedy trap', net: L.DIAMOND },
    { label: 'Three lanes', net: L.make('s-a:5, s-b:5, s-c:5, a-d:4, b-d:3, b-e:3, c-e:4, d-t:6, e-t:6', { s: [90, 300], a: [330, 100], b: [330, 300], c: [330, 500], d: [630, 200], e: [630, 400], t: [915, 300] }) },
    { label: 'Hourglass', net: L.make('s-a:6, s-b:6, a-m:4, b-m:5, m-c:4, m-d:4, c-t:6, d-t:6', { s: [60, 300], a: [255, 85], b: [255, 515], m: [490, 300], c: [725, 85], d: [725, 515], t: [940, 300] }) },
    { label: 'With a cycle', net: L.make('s-a:9, a-b:6, b-c:5, c-a:4, b-t:3, c-t:6', { s: [90, 300], a: [330, 300], b: [590, 130], c: [590, 470], t: [915, 300] }) },
    { label: 'No route', net: L.make('s-a:5, b-t:5', { s: [90, 300], a: [340, 300], b: [610, 300], t: [915, 300] }) }
  ];

  /* ================================================================== the lab */
  function labFigure(fig) {
    var net = L.MAIN, detail = 'full', residual = false, seed = 21;
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 430, draggable: true, label: 'Flow network lab: pipes with flow over capacity', nodeRadius: 24, minRadius: 14 });
    var badge = h('div', { class: 'nf-total', 'aria-hidden': 'true' }, h('span', { class: 'nf-total__k' }, 'total flow'), h('b', { class: 'nf-total__v' }, '0'));
    stage.appendChild(badge);
    var badgeV = badge.querySelector('.nf-total__v');
    var chartHost = fig.querySelector('[data-chart]');
    var chart = V.views.chart(chartHost, { type: 'bar', height: 190, label: 'Total flow after each augmentation' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'pseudo', title: 'maxFlow', maxHeight: 400 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', queue: 'frontier', path: 'path', b: 'compare', value: 'done', S: 'frontier' } });
    var flowFig = V.$('#fig-flow');
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_SPEC, { label: 'Max-flow algorithm flowchart, lit by the lab' });
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }]);
    var flow = { highlight: function (id, ctx) { flowView.render(id ? { active: id } : {}, { duration: ctx ? ctx.duration : 0 }); } };

    L.legend(fig.querySelector('[data-legend]'), [L.LEG.queued, L.LEG.current, L.LEG.visited, L.LEG.path, L.LEG.bottleneck, L.LEG.reverse, L.LEG.flow, L.LEG.full, L.LEG.cut]);

    var result = null;
    function generate() {
      var raw = NF.trace(net, { detail: detail });
      result = raw.result;
      var steps = raw.map(L.fixVars);
      return steps;
    }
    function drawChart(step, ms) {
      var R = Math.max(result.rounds, 1), cats = [], vals = [];
      var doneRounds = step.counters.augmentations;
      // cumulative value after each augmentation, known from the run
      var byRound = result.byRound;
      for (var k = 1; k <= R; k++) { cats.push(String(k)); vals.push(k <= doneRounds && byRound[k - 1] !== undefined ? byRound[k - 1] : 0); }
      chart.render({
        categories: cats, series: [{ id: 'flow', label: 'Total flow', values: vals, state: 'active' }],
        y: { label: 'total flow', min: 0, max: Math.max(result.value, 1) },
        highlight: doneRounds > 0 ? { category: String(doneRounds) } : undefined
      }, { duration: ms });
    }
    function computeByRound(steps) {
      var out = [];
      steps.forEach(function (st) { if (st.kind === 'push') out.push(st.value); });
      result.byRound = out;
    }
    var steps0 = generate();
    computeByRound(steps0);

    function render(step, ctx) {
      view.render(L.flowState(net, step, { residual: residual, levels: true, subs: true, spread: true }), { duration: ctx.duration });
      if (badgeV.textContent !== String(step.value)) { badgeV.textContent = step.value; badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump'); }
      drawChart(step, ctx.duration);
    }
    var player = V.player({
      root: fig, steps: steps0, render: render, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { augmentations: 'Augmentations', value: 'Flow value', scans: 'Arcs examined' },
      counterStates: { value: 'done', augmentations: 'path' },
      baseStepMs: 1100, label: 'Max-flow lab controls'
    });

    function reload(keepLayout) {
      if (!keepLayout && view.resetPositions) view.resetPositions();
      var st = generate();
      computeByRound(st);
      player.setSteps(st);
    }

    // predictions
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'bottleneck') return i;
      return -1;
    }, function (c) {
      var p = c.prev;
      if (!p || !p.path || !p.path.length) return null;
      var rooms = p.path.map(function (a) { return a.res; });
      var min = Math.min.apply(null, rooms), max = Math.max.apply(null, rooms), sum = rooms.reduce(function (a, b) { return a + b; }, 0);
      var cand = [
        { v: min, why: 'Yes. Every arc on the path must carry the same amount, so the tightest one decides: min(' + rooms.join(', ') + ') = ' + min + '. Pushing more would overfill that pipe.' },
        { v: rooms[0], why: 'The first arc is only the start of the path. Water cannot pile up at a vertex, so what the first arc sends must also fit through every later arc.' },
        { v: sum, why: 'Adding the rooms treats the arcs as parallel lanes. They are in series: the water passes through every one of them, one after another.' },
        { v: max, why: 'The widest arc is the one that limits the least. The narrowest arc on the path decides how much can pass.' }
      ];
      var seenV = {}, opts = [];
      cand.forEach(function (x) { if (!seenV[x.v]) { seenV[x.v] = true; opts.push(x); } });
      if (opts.length < 2) return null;
      return {
        question: 'The path is <b>' + p.pathNodes.map(function (id) { return L.norm(net).label[id] || id; }).join(' → ') + '</b>, and its arcs have room <b>' + rooms.join(', ') + '</b>. How much can be pushed along it in one augmentation?',
        options: opts.map(function (x) { return String(x.v); }), answer: 0, explain: opts.map(function (x) { return x.why; })
      };
    }, { id: 'nf-lab-bottleneck' });

    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'push' && steps[i].path.some(function (a) { return a.dir === 'back'; })) return i;
      return -1;
    }, function (c) {
      var st = c.step, back = st.path.filter(function (a) { return a.dir === 'back'; })[0];
      if (!back) return null;
      var nm = function (id) { return L.norm(net).label[id] || id; };
      var pipe = nm(back.to) + '→' + nm(back.from);
      return {
        question: 'The path uses the dashed <em>reverse</em> arc <b>' + nm(back.from) + '→' + nm(back.to) + '</b>, which exists because the pipe <b>' + pipe + '</b> carries flow. After this push of <b>' + st.bottleneck + '</b>, what happens to the flow on <b>' + pipe + '</b>?',
        options: ['It rises by ' + st.bottleneck, 'It falls by ' + st.bottleneck, 'It stays the same'], answer: 1,
        explain: [
          'A reverse arc never adds to its pipe. It is the pipe read backward, so using it can only remove flow from that pipe.',
          'Yes. Pushing along the reverse arc cancels ' + st.bottleneck + ' units on ' + pipe + ': that flow now leaves ' + nm(back.to) + ' along another route. Nothing is lost, only rerouted.',
          'If the flow stayed the same, the reverse arc would have done nothing. It exists to change the flow on ' + pipe + ' in the only way possible: down.'
        ]
      };
    }, { id: 'nf-lab-reverse' });

    // toolbar
    V.segmented(fig.querySelector('[data-detail]'), {
      label: 'Detail', value: 'full',
      options: [{ value: 'full', label: 'Every BFS step' }, { value: 'rounds', label: 'One step per path' }],
      onChange: function (v) { detail = v; reload(true); }
    });
    V.toggle(fig.querySelector('[data-residual]'), {
      label: 'Show the residual graph', checked: false,
      onChange: function (on) { residual = on; view.render(L.flowState(net, player.step, { residual: residual, levels: true, subs: true, spread: true }), { duration: 450 }); }
    });
    fig.querySelector('[data-layout]').addEventListener('click', function () { if (view.resetPositions) view.resetPositions(); });

    // input: typed pipes + presets
    var pending = null;
    function setNet(n) {
      net = n; net._N = null;
      reload(false);
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Pipes: from-to:capacity (up to 10 vertices, 24 pipes)',
      value: L.toText(net),
      placeholder: 'e.g. s-a:7, s-b:5, a-t:4, b-t:6',
      parse: function (text) { return NF.parseNetwork(text); },
      presets: PRESETS.map(function (p) { return { label: p.label, value: function () { pending = p.net; return L.toText(p.net); } }; })
        .concat([{ label: 'Random', value: function () { pending = L.randomNet(seed++); return L.toText(pending); } }]),
      hint: 'Name the source s and the sink t. Capacities are whole numbers from 1 to 99. Drag a vertex to tidy the drawing.',
      onApply: function (parsed, text) {
        var p = pending;
        pending = null;
        if (p && L.toText(p) === input.field.value.trim()) setNet(p);
        else setNet(layoutNet(parsed));
      }
    });
  }

  V.ready(function () {
    L.lazy('#lab-flow', labFigure);
  });
}());
