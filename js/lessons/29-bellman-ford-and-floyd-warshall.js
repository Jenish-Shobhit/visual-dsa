/* Lesson 29 · Bellman-Ford & Floyd-Warshall — shared helpers and the first figures (hero to negative cycles).
   Part 2 (Bellman-Ford lab, Floyd-Warshall lab, flowcharts): js/lessons/29-bellman-ford-and-floyd-warshall-labs.js
   Part 3 (arbitrage, stopover idea, next hops, cost, decision tree, variations, checks, summary): ...-more.js
   Step generators: js/algos/29-bellman-ford-and-floyd-warshall.js (VDSA.algos.shortestPaths). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SP = V.algos.shortestPaths;
  var L = V.L29 = V.L29 || {};

  /* ================================================================== data */
  function G(nodes, edges) {
    return {
      nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2] }; }),
      edges: edges.map(function (e) { return { from: e[0], to: e[1], w: e[2] }; }),
      directed: true
    };
  }
  L.G = G;
  /* The lesson graph (CLRS, figure 24.4): from S the distances are T 2, X 4, Y 7, Z −2. */
  L.CLRS = G([['S', 100, 300], ['T', 370, 100], ['X', 920, 100], ['Y', 370, 500], ['Z', 720, 500]],
    [['T', 'X', 5], ['T', 'Y', 8], ['T', 'Z', -4], ['X', 'T', -2], ['Y', 'X', -3], ['Y', 'Z', 9], ['Z', 'X', 7], ['Z', 'S', 2], ['S', 'T', 6], ['S', 'Y', 7]]);
  /* A cycle A → B → C → A of weight −1, with D hanging off it. */
  L.CYCLE = G([['S', 90, 300], ['A', 330, 300], ['B', 580, 120], ['C', 580, 480], ['D', 880, 480]],
    [['S', 'A', 2], ['A', 'B', 3], ['B', 'C', -6], ['C', 'A', 2], ['C', 'D', 4]]);
  L.CHAIN = G([['S', 90, 300], ['A', 300, 170], ['B', 510, 430], ['C', 720, 170], ['D', 910, 430]],
    [['S', 'A', 4], ['A', 'B', -1], ['B', 'C', 2], ['C', 'D', 1]]);
  L.last = function (a) { return a[a.length - 1]; };
  L.fmt = SP.fmtD;

  function toText(g) {
    var used = {};
    var parts = g.edges.map(function (e) { used[e.from] = used[e.to] = true; return e.from + '>' + e.to + ':' + e.w; });
    g.nodes.forEach(function (n) { if (!used[n.id]) parts.push(n.id); });
    return parts.join(', ');
  }
  L.toText = toText;

  /* Turn parsed input into a graph with positions: keep positions of vertices already known, force layout otherwise. */
  L.layoutFor = function (parsed, old) {
    var ids = parsed.nodes, byId = {};
    (old ? old.nodes : []).forEach(function (n) { byId[n.id] = n; });
    var edgesForLayout = parsed.edges.map(function (e) { return { from: e.from, to: e.to }; });
    var nodes = ids.map(function (id) { return { id: id }; });
    var pos = V.views.graph.layouts.force(nodes, edgesForLayout, { w: 1000, h: 600, pad: 100, seed: 11, iterations: 400 });
    return {
      nodes: ids.map(function (id) { var p = pos[id]; return { id: id, x: p.x, y: p.y }; }),
      edges: parsed.edges, directed: true
    };
  };

  /* ================================================================== lazy init */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 29] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* VDSA.legend with working `color` overrides (style objects drop custom properties). */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };

  /* Variable-watch values: {raw: 'text'} -> shown without quotes. */
  L.fixVars = function (vars) {
    var out = {};
    Object.keys(vars || {}).forEach(function (k) {
      var v = vars[k];
      out[k] = v && typeof v === 'object' && v.raw !== undefined ? V.vars.raw(v.raw) : v;
    });
    return out;
  };

  /* Put data-id / data-label on graph view nodes so VDSA.clickQuiz can target them. */
  L.tagNodes = function (view, describe) {
    V.$$('.vz-gnode', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var id = t ? t.textContent : '';
      if (!id) return;
      g.setAttribute('data-id', id);
      g.setAttribute('data-label', describe ? describe(id) : 'Vertex ' + id);
    });
  };

  /* ================================================================== graph snapshots */
  function edgeKey(e) { return e.from + '-' + e.to; }
  L.edgeKey = edgeKey;

  /* Bellman-Ford step -> graph view state. */
  L.bfGraphState = function (g, st, o) {
    o = o || {};
    var cyc = st.cycle || [], inCyc = {}, cycEdge = {};
    cyc.forEach(function (id, i) { inCyc[id] = true; cycEdge[id + '-' + cyc[(i + 1) % cyc.length]] = true; });
    var nodes = g.nodes.map(function (n) {
      var id = n.id, d = st.dist[id], state = 'default';
      if (d !== null) state = 'visited';
      if (st.updated && st.updated[id] && !st.final) state = 'frontier';
      if (st.final) state = d === null ? 'muted' : 'done';
      if (st.kind === 'scan' || st.kind === 'relax' || st.kind === 'cycle') {
        if (id === st.u) state = 'active';
        else if (id === st.v) state = st.kind === 'relax' ? 'key' : 'compare';
      }
      if (inCyc[id]) state = 'error';
      var node = { id: id, x: n.x, y: n.y, state: state, badge: d === null ? '∞' : d };
      if (d !== null && st.parent[id]) node.sub = '← ' + st.parent[id];
      return node;
    });
    var edges = g.edges.map(function (e, i) {
      var key = edgeKey(e), state = 'default', pulse = false;
      if (cycEdge[key]) state = 'error';
      else if (st.edge === i && (st.kind === 'scan' || st.kind === 'cycle')) state = st.result === 'yes' ? 'compare' : 'compare';
      else if (st.edge === i && st.kind === 'relax') { state = 'active'; pulse = true; }
      else if (st.parent[e.to] === e.from) state = st.final ? 'done' : 'visited';
      var out = { id: key, from: e.from, to: e.to, directed: true, weight: e.w, state: state };
      if (pulse) out.pulse = true;
      return out;
    });
    return { nodes: nodes, edges: edges };
  };

  /* Floyd-Warshall step -> graph view state (k pivot, i active, j compare, route through k lit). */
  L.fwGraphState = function (g, st, o) {
    o = o || {};
    var ids = st.ids, onPath = {}, pe = {};
    if (st.path) st.path.forEach(function (ix, a) { onPath[ids[ix]] = true; if (a + 1 < st.path.length) pe[ids[ix] + '-' + ids[st.path[a + 1]]] = true; });
    var negNodes = {};
    (st.neg || []).forEach(function (ix) { negNodes[ids[ix]] = true; });
    var nodes = g.nodes.map(function (n) {
      var ix = ids.indexOf(n.id), state = 'default';
      if (st.k === ix && st.k >= 0) state = 'pivot';
      else if (st.i === ix && st.i >= 0 && (st.kind === 'check' || st.kind === 'update')) state = 'active';
      else if (st.j === ix && st.j >= 0 && (st.kind === 'check' || st.kind === 'update')) state = 'compare';
      else if (onPath[n.id]) state = 'visited';
      if (negNodes[n.id]) state = 'error';
      return { id: n.id, x: n.x, y: n.y, state: state };
    });
    var edges = g.edges.map(function (e) {
      var key = edgeKey(e), state = 'default';
      if (pe[key]) state = st.pathKind === 'take' ? 'path' : 'compare';
      var out = { id: key, from: e.from, to: e.to, directed: true, state: state };
      if (!o.noWeights) out.weight = e.w;
      return out;
    });
    return { nodes: nodes, edges: edges };
  };

  /* Floyd-Warshall (or closure) step -> grid view state. */
  L.fwGridState = function (st, o) {
    o = o || {};
    var n = st.n, ids = st.ids, cells = [];
    var passSet = {};
    (st.passUpdates || []).forEach(function (p) { passSet[p[0] + ',' + p[1]] = true; });
    var negDiag = {};
    (st.neg || []).forEach(function (ix) { negDiag[ix] = true; });
    var via = {};
    if (st.via && (st.kind === 'check' || st.kind === 'update')) { via[st.via.a.join(',')] = true; via[st.via.b.join(',')] = true; }
    var shownK = st.kind === 'kstart' || st.kind === 'check' || st.kind === 'update' || (o.keepK && st.kind === 'kend');
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        var v = st.d[i][j], key = i + ',' + j, state = 'default';
        if (st.improved && st.improved[i][j]) state = 'visited';
        if (passSet[key]) state = 'frontier';
        if (via[key]) state = 'key';
        if ((st.kind === 'update' || st.kind === 'check') && st.i === i && st.j === j) state = st.kind === 'update' ? 'found' : 'compare';
        if (i === j && negDiag[i]) state = 'error';
        var cell = { state: state };
        if (o.bool) cell.text = v === null ? '0' : '1';
        else if (v === null) cell.text = '∞';
        else cell.value = v;
        if (o.bool && v === null) cell.state = state === 'default' ? 'muted' : state;
        row.push(cell);
      }
      cells.push(row);
    }
    var out = { rows: n, cols: n, cells: cells, rowHeaders: ids, colHeaders: ids, corner: o.corner === undefined ? 'i \\ j' : o.corner };
    if (st.k >= 0 && (shownK || o.showK)) { out.highlightRow = { index: st.k, state: 'pivot' }; out.highlightCol = { index: st.k, state: 'pivot' }; }
    if ((st.kind === 'check' || st.kind === 'update') && st.i >= 0) {
      out.cursor = { cell: [st.i, st.j], state: st.kind === 'update' ? 'found' : 'compare' };
      if (st.via && (st.cand !== null || st.kind === 'update')) {
        var arrows = [];
        [st.via.a, st.via.b].forEach(function (a, ai) { if (a[0] !== st.i || a[1] !== st.j) arrows.push({ id: 'arr' + ai, from: a, to: [st.i, st.j], state: 'key' }); });
        out.arrows = arrows;
      }
    }
    return out;
  };

  /* ================================================================== hero teaser: the matrix ripples as k advances */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var label = h('div', { class: 'bf-hero__label', 'aria-hidden': 'true' });
    var host = h('div', { class: 'bf-hero__grid' });
    stage.classList.add('bf-hero');
    stage.appendChild(label); stage.appendChild(host);
    var view = V.views.grid(host, { cellSize: 38, countUp: true, label: 'Distance matrix during Floyd-Warshall' });
    var graphs = [L.CLRS], lap = 0;
    function make(gr) {
      var all = SP.floydWarshall(gr, { mode: 'improve' });
      return all.filter(function (st) { return st.kind !== 'update'; });
    }
    function next() {
      var gr = graphs[lap++ % graphs.length];
      if (lap > 1) gr = SP.randomGraph(5, 9, V.rng(lap * 13), { negative: true });
      return make(gr);
    }
    function render(step, ctx) {
      var st = Object.assign({}, step);
      if (st.kind === 'kend') st.passUpdates = step.passUpdates;
      var gs = L.fwGridState(st, { showK: true, keepK: true });
      if (step.kind === 'init') label.innerHTML = 'start: only <b>single edges</b>';
      else if (step.kind === 'kstart') label.innerHTML = 'allow <b>' + step.ids[step.k] + '</b> as a stopover';
      else if (step.kind === 'kend') label.innerHTML = 'cheaper routes through <b>' + step.ids[step.k] + '</b>';
      else label.innerHTML = 'every distance, <b>all pairs</b>';
      view.render(gs, { duration: ctx.duration });
    }
    V.teaser(stage, { steps: next(), render: render, stepMs: 950, holdMs: 1800, regenerate: next, instantWrap: true });
  }

  /* ================================================================== the problem: greedy locks a distance too early */
  function greedyFigure(fig) {
    var g = G([['S', 110, 300], ['A', 430, 110], ['B', 430, 490], ['T', 880, 300]], [['S', 'A', 2], ['S', 'B', 3], ['B', 'A', -2], ['A', 'T', 4]]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 340, label: 'A graph with one negative edge, B to A' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Locked as final' }, { state: 'frontier', label: 'Tentative' }, { state: 'compare', label: 'Edge being checked' }, { state: 'error', label: 'Wrong answer' }, { state: 'path', label: 'True route' }]);
    function P(nodes, edges, cap) { return { nodes: nodes, edges: edges, caption: cap }; }
    function nd(states, badges) { return ['S', 'A', 'B', 'T'].map(function (id) { return { id: id, state: states[id] || 'default', badge: badges[id] === undefined ? '∞' : badges[id] }; }); }
    var steps = [
      { st: {}, b: { S: 0 }, e: {}, cap: 'You want the cheapest way from <b>S</b> to <b>T</b>. Every road has a cost, and the road B → A is a <b>rebate</b>: −2, like a toll booth that pays you. The greedy rule to test: <em>always finish the closest unfinished place, and never touch its number again.</em>' },
      { st: { S: 'done', A: 'frontier', B: 'frontier' }, b: { S: 0, A: 2, B: 3 }, e: { 'S-A': 'visited', 'S-B': 'visited' }, cap: 'Greedy finishes S (0), the closest. Its roads give A = 2 and B = 3 as first guesses.' },
      { st: { S: 'done', A: 'done', B: 'frontier', T: 'frontier' }, b: { S: 0, A: 2, B: 3, T: 6 }, e: { 'S-A': 'visited', 'S-B': 'visited', 'A-T': 'visited' }, cap: 'The closest unfinished place is A, at 2. Greedy <b>locks A = 2</b> and uses it: A → T costs 4, so T = 6.' },
      { st: { S: 'done', A: 'done', B: 'done', T: 'frontier' }, b: { S: 0, A: 2, B: 3, T: 6 }, e: { 'S-A': 'visited', 'S-B': 'visited', 'A-T': 'visited', 'B-A': 'compare' }, cap: 'Next it finishes B (3). B → A is the rebate: 3 + (−2) = <b>1</b>, cheaper than the 2 written next to A.' },
      { st: { S: 'done', A: 'error', B: 'done', T: 'error' }, b: { S: 0, A: 2, B: 3, T: 6 }, e: { 'S-A': 'visited', 'S-B': 'visited', 'A-T': 'visited', 'B-A': 'compare' }, cap: 'Too late: A is locked, so greedy never looks again. It reports A = 2 and T = 6, and <b>both are wrong</b>.' },
      { st: { S: 'path', A: 'path', B: 'path', T: 'path' }, b: { S: 0, A: 1, B: 3, T: 5 }, e: { 'S-B': 'path', 'B-A': 'path', 'A-T': 'path' }, cap: 'The truth: S → B → A → T costs 3 − 2 + 4 = <b>5</b>, and A is really 1. A rule that never lowers a finished number cannot cope with negative edges. We need a method that stays willing to <b>lower</b> any distance it has written down.' }
    ].map(function (x) {
      return { caption: x.cap, graph: { nodes: nd(x.st, x.b).map(function (n) { var p = g.nodes.filter(function (q) { return q.id === n.id; })[0]; n.x = p.x; n.y = p.y; return n; }),
        edges: g.edges.map(function (e) { var k = edgeKey(e); return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: x.e[k] || 'default', pulse: false }; }) } };
    });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 2200, label: 'Greedy trap controls',
      render: function (st, ctx) { view.render(st.graph, { duration: ctx.duration }); }
    });
  }

  /* ================================================================== relaxing one edge (sliders) */
  function relaxFigure(fig) {
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 300 }, maxHeight: 210, label: 'One edge from u to v' });
    var out = fig.querySelector('[data-out]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Edge that improves' }, { state: 'compare', label: 'Vertex that improves' }, { state: 'visited', label: 'Vertex with a distance' }]);
    var vals = { du: 3, w: -2, dv: 5 };
    var sl = {};
    var box = fig.querySelector('[data-sliders]');
    function mk(key, label, min, max, fmt) {
      var host = h('div', { class: 'bf-slider' });
      box.appendChild(host);
      sl[key] = V.slider(host, { label: label, min: min, max: max, step: 1, value: vals[key], format: fmt, onInput: function (v) { vals[key] = v; draw(300); } });
    }
    mk('du', 'd[u]', 0, 12, function (v) { return String(v); });
    mk('w', 'weight w', -9, 9, function (v) { return v < 0 ? '−' + (-v) : String(v); });
    mk('dv', 'd[v]', 0, 16, function (v) { return v >= 16 ? '∞' : String(v); });
    function draw(dur) {
      var dv = vals.dv >= 16 ? null : vals.dv;
      var cand = vals.du + vals.w;
      var better = dv === null || cand < dv;
      view.render({
        nodes: [
          { id: 'u', label: 'u', x: 200, y: 150, state: 'visited', badge: vals.du },
          { id: 'v', label: 'v', x: 800, y: 150, state: better ? 'compare' : 'visited', badge: dv === null ? '∞' : dv }
        ],
        edges: [{ id: 'u-v', from: 'u', to: 'v', directed: true, weight: vals.w, state: better ? 'active' : 'default', pulse: better }]
      }, { duration: dur });
      var wt = vals.w < 0 ? '(−' + (-vals.w) + ')' : String(vals.w);
      out.innerHTML = 'd[u] + w = ' + vals.du + ' + ' + wt + ' = <b>' + cand + '</b>' + (dv === null ? ' &lt; d[v] = ∞' : (better ? ' &lt; d[v] = ' + dv : (cand === dv ? ' = d[v] = ' + dv : ' &gt; d[v] = ' + dv))) +
        '<br>' + (better ? '<span class="bf-yes">Relax: d[v] becomes ' + cand + '.</span> The route through u is cheaper.' : '<span class="bf-no">No change: d[v] stays ' + (dv === null ? '∞' : dv) + '.</span> ' + (cand === dv ? 'A tie is not an improvement.' : 'The route through u is not cheaper.'));
    }
    draw(0);
  }

  /* ================================================================== paths with at most k edges */
  function layersFigure(fig) {
    var g = L.CLRS, ids = g.nodes.map(function (n) { return n.id; });
    var lay = SP.layers(g, 'S');
    var gview = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 380, label: 'Cheapest routes with at most k edges' });
    var tview = V.views.grid(fig.querySelector('[data-table]'), { cellSize: 44, label: 'Distance of each vertex after each round' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Not reachable in k edges' }, { state: 'visited', label: 'Reachable' }, { state: 'frontier', label: 'Just got cheaper' }, { state: 'path', shape: 'line', label: 'Route that changed' }, { state: 'visited', shape: 'line', label: 'Other best routes' }]);
    var caps = [
      'Round 0: zero edges used. Only <b>S</b> is known, at cost 0. Everything else is ∞ because you cannot reach it with no edges.',
      'After <b>round 1</b>, every number is the cheapest route using <b>at most 1 edge</b>: T = 6 and Y = 7 are S’s neighbours. No other vertex is one edge from S.',
      'After <b>round 2</b>: routes of at most 2 edges. X = 7 − 3 = 4 (S → Y → X) and Z = 6 − 4 = 2 (S → T → Z). Each new route extends a round-1 route by one edge.',
      'After <b>round 3</b>: T drops from 6 to 2. The route S → Y → X → T uses 3 edges and the rebate X → T (−2) makes it cheaper than the direct edge.',
      'After <b>round 4</b>: Z drops from 2 to −2 through the improved T. This is the longest cheapest route here: 4 edges, which is V − 1 = 4.'
    ];
    var steps = lay.map(function (l) {
      var pe = {}, others = {};
      ids.forEach(function (id) {
        var p = l.paths[id];
        if (!p) return;
        for (var a = 0; a + 1 < p.length; a++) (l.changed[id] ? pe : others)[p[a] + '-' + p[a + 1]] = true;
      });
      return { layer: l, pe: pe, others: others, caption: caps[l.k], line: null };
    });
    function rowText(k) { return k; }
    var hdr = lay.map(function (l) { return String(rowText(l.k)); });
    function render(st, ctx) {
      var l = st.layer;
      gview.render({
        nodes: g.nodes.map(function (n) {
          var d = l.dist[n.id], state = d === null ? 'default' : 'visited';
          if (l.changed[n.id]) state = 'frontier';
          return { id: n.id, x: n.x, y: n.y, state: state, badge: d === null ? '∞' : d };
        }),
        edges: g.edges.map(function (e) {
          var k = edgeKey(e);
          return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: st.pe[k] ? 'path' : (st.others[k] ? 'visited' : 'default') };
        })
      }, { duration: ctx.duration });
      tview.render({
        rows: ids.length, cols: lay.length, corner: 'edges ≤',
        rowHeaders: ids, colHeaders: hdr,
        cells: ids.map(function (id) {
          return lay.map(function (c) {
            if (c.k > l.k) return { text: '', state: 'default' };
            var d = c.dist[id], cell = d === null ? { text: '∞' } : { value: d };
            cell.state = c.k === l.k && c.changed[id] ? 'frontier' : (d === null ? 'muted' : 'default');
            return cell;
          });
        }),
        highlightCol: { index: l.k, state: 'active' }
      }, { duration: ctx.duration });
    }
    V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 2600, label: 'Paths with at most k edges controls' });
  }

  /* ================================================================== a negative cycle: distances never settle */
  function cycleChartFigure(fig) {
    var gview = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 300, label: 'A cycle A, B, C whose total weight you can change' });
    var chart = V.views.chart(fig.querySelector('[data-chart]'), { type: 'line', height: 300, label: 'Distance of A and D after each round' });
    var note = fig.querySelector('[data-note]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Negative cycle' }, { state: 'default', shape: 'line', label: 'Ordinary edge' }]);
    var total = -1, first = true;
    function graph(t) {
      var bc = t - 5;   // A→B 3, C→A 2: the cycle weighs 3 + bc + 2
      return G([['S', 90, 300], ['A', 330, 300], ['B', 580, 120], ['C', 580, 480], ['D', 880, 480]],
        [['S', 'A', 2], ['A', 'B', 3], ['B', 'C', bc], ['C', 'A', 2], ['C', 'D', 4]]);
    }
    function draw(dur) {
      var g = graph(total), lay = SP.layers(g, 'S', { rounds: 12 });
      var neg = total < 0;
      gview.render({
        nodes: g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, state: neg && 'ABC'.indexOf(n.id) >= 0 ? 'error' : 'default', badge: n.id === 'S' ? 0 : undefined }; }),
        edges: g.edges.map(function (e) { var k = edgeKey(e); return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: neg && (k === 'A-B' || k === 'B-C' || k === 'C-A') ? 'error' : 'default' }; })
      }, { duration: dur });
      var A = lay.map(function (l) { return [l.k, l.dist.A]; }).filter(function (p) { return p[1] !== null; });
      var D = lay.map(function (l) { return [l.k, l.dist.D]; }).filter(function (p) { return p[1] !== null; });
      var lo = Math.min.apply(null, A.concat(D).map(function (p) { return p[1]; })), hi = Math.max.apply(null, A.concat(D).map(function (p) { return p[1]; }));
      chart.render({
        x: { label: 'round k (edges allowed)', min: 0, max: 12, ticks: [0, 2, 4, 6, 8, 10, 12] },
        y: { label: 'cheapest cost found', min: Math.floor(Math.min(lo, 0) - 1), max: Math.ceil(hi + 1), zero: false },
        series: [{ id: 'A', label: 'd[A]', points: A, state: neg ? 'error' : 'active', markers: true }, { id: 'D', label: 'd[D]', points: D, state: 'muted', markers: true, dashed: true }]
      }, { duration: first ? 700 : dur });
      first = false;
      note.innerHTML = neg
        ? 'The loop A → B → C → A costs <b>' + total + '</b>: every lap around it makes both numbers <b>' + (-total) + ' cheaper</b>, forever. There is no cheapest route, so no number is correct.'
        : total === 0
          ? 'The loop costs exactly 0. Going round changes nothing, so the numbers settle. Zero-weight cycles are harmless.'
          : 'The loop costs <b>+' + total + '</b>. Going round only adds cost, so no shortest path uses it and the numbers settle after a few rounds.';
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Total weight of the loop A → B → C → A', value: '-1',
      options: [{ value: '-1', label: 'Loop weighs −1' }, { value: '0', label: '0' }, { value: '1', label: '+1' }],
      onChange: function (v) { total = +v; draw(600); }
    });
    draw(0);
  }

  V.ready(function () {
    if (V.quizScore) ['lab-bf-round1', 'lab-fw-pass2'].forEach(function (id) { V.quizScore.register(id); });   // lazily built labs: keep the page total stable
    heroTeaser();
    L.lazy('#fig-greedy', greedyFigure);
    L.lazy('#fig-relax', relaxFigure);
    L.lazy('#fig-layers', layersFigure);
    L.lazy('#fig-cycle-chart', cycleChartFigure);
  });
}());
