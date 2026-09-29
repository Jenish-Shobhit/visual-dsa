/* Lesson 30 · Minimum spanning trees — part 3: the swap proof, Kruskal vs Prim side by side, the cycle property,
   clustering, the cost chart, variations, the decision diagram, checks and the summary card.
   Needs js/lessons/30-minimum-spanning-trees.js (VDSA.L30) and js/algos/30-minimum-spanning-trees.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var M = V.algos.mst;
  var L = V.L30;
  var CC = 8;

  function edgeOf(g, id) { return g.edges.filter(function (e) { return M.edgeKey(e.u, e.v) === id; })[0]; }
  function sum(ids, g) { return ids.reduce(function (t, id) { return t + edgeOf(g, id).w; }, 0); }
  function plural(k, one, many) { return k + ' ' + (k === 1 ? one : many || one + 's'); }
  function groupsFrom(g, edgeIds) {   // union-find groups after joining these edges: {comp: node -> leader, size}
    var ids = L.ids(g), uf = new M.UF(ids.length), comp = {}, size = {};
    edgeIds.forEach(function (id) { var e = edgeOf(g, id); uf.union(ids.indexOf(e.u), ids.indexOf(e.v)); });
    ids.forEach(function (id, i) { var r = ids[uf.find(i)]; comp[id] = r; size[r] = (size[r] || 0) + 1; });
    return { comp: comp, size: size };
  }

  /* ================================================================== uses (static minis) */
  function usesMinis(row) {
    function mini(cap, build) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      build(st);
    }
    mini('<b>Cable and pipes:</b> join every office with the least cable.', function (st) {
      var g = L.graph([['a', 90, 300], ['b', 300, 90], ['c', 320, 480], ['d', 560, 250], ['e', 800, 100], ['f', 860, 420]],
        [['a', 'b', 4], ['a', 'c', 5], ['b', 'c', 8], ['b', 'd', 6], ['c', 'd', 3], ['d', 'e', 7], ['d', 'f', 2], ['e', 'f', 9]]);
      var t = {};
      M.kruskal(g).tree.forEach(function (e) { t[e.id] = true; });
      V.views.graph(st, { maxHeight: 190, nodeRadius: 17, minRadius: 12, showWeights: false, label: 'Six offices joined by the cheapest cables' })
        .render(L.state(g, { node: function () { return 'done'; }, edge: function (e, id) { return t[id] ? { state: 'done' } : { state: 'muted', dashed: true }; } }), { duration: 0 });
    });
    mini('<b>Clustering:</b> the longest links of the MST separate the groups.', function (st) {
      var rng = V.rng(9), pts = [];
      [[200, 170], [640, 200], [430, 470]].forEach(function (c) { for (var i = 0; i < 4; i++) pts.push({ x: c[0] + rng.int(-90, 90), y: c[1] + rng.int(-90, 90) }); });
      var g = M.pointsGraph(pts), r = M.clusterSplit(g, 3), tr = {}, cut = {};
      r.keep.forEach(function (e) { tr[e.id] = true; }); r.cut.forEach(function (e) { cut[e.id] = true; });
      V.views.graph(st, { maxHeight: 190, nodeRadius: 11, minRadius: 8, showWeights: false, label: 'Twelve points in three clusters, joined by the MST with the two longest links cut' })
        .render(L.state(g, { node: function (id) { return { state: 'cc' + r.assign[id], label: '' }; }, edge: function (e, id) { return tr[id] ? { state: 'default' } : cut[id] ? { state: 'error', dashed: true } : { state: 'muted', dashed: true, label: '' }; } }), { duration: 0 });
    });
    mini('<b>Travelling salesman:</b> walk around the MST, skip repeats. The tour is at most twice the best one.', function (st) {
      var pts = [[130, 300], [330, 110], [520, 260], [760, 120], [840, 400], [560, 500], [300, 480]];
      var g = { nodes: pts.map(function (p, i) { return { id: String(i + 1), x: p[0], y: p[1] }; }), edges: [] };
      var all = M.pointsGraph(g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }));
      var tree = M.kruskal(all).tree, adj = {};
      tree.forEach(function (e) { (adj[e.u] = adj[e.u] || []).push(e.v); (adj[e.v] = adj[e.v] || []).push(e.u); });
      var order = [], seen = {};
      (function dfs(u) { seen[u] = true; order.push(u); (adj[u] || []).forEach(function (v) { if (!seen[v]) dfs(v); }); }('1'));
      var isTree = {}, edges = [], have = {};
      tree.forEach(function (e) { isTree[e.id] = true; edges.push({ u: e.u, v: e.v, w: 0 }); have[e.id] = true; });
      for (var i = 0; i < order.length; i++) {
        var a = order[i], b = order[(i + 1) % order.length], k = M.edgeKey(a, b);
        if (!have[k]) { have[k] = true; edges.push({ u: a, v: b, w: 0 }); }
      }
      g.edges = edges;
      V.views.graph(st, { maxHeight: 190, nodeRadius: 13, minRadius: 10, showWeights: false, label: 'Seven points: the MST in green and a shortcut tour as dashed orange lines' })
        .render(L.state(g, { node: function () { return 'default'; }, edge: function (e, id) { return isTree[id] ? { state: 'done', label: '' } : { state: 'path', dashed: true, label: '' }; } }), { duration: 0 });
    });
  }

  /* ================================================================== the swap proof */
  function proofFigure(fig) {
    var g = L.TOWNS, ids = L.ids(g), mst = M.kruskal(g);
    var S = ['A', 'B', 'C', 'D', 'E', 'F'], inS = {};
    S.forEach(function (id) { inS[id] = true; });
    var info = M.cutInfo(g, S), e = info.lightest, cross = {};
    info.crossing.forEach(function (x) { cross[x.id] = true; });
    var mstIds = mst.tree.map(function (x) { return x.id; });
    // T = MST - e + f, where f is the heaviest crossing edge that reconnects the two halves
    var f = null;
    info.crossing.slice().sort(function (a, b) { return b.w - a.w; }).forEach(function (c) {
      if (f || c.id === e.id || mstIds.indexOf(c.id) >= 0) return;
      var t = mstIds.filter(function (id) { return id !== e.id; }).concat([c.id]);
      if (groupsFrom(g, t).size[ids[0]] === ids.length) f = c;
    });
    var T = mstIds.filter(function (id) { return id !== e.id; }).concat([f.id]);
    var Tedges = T.map(function (id) { return edgeOf(g, id); });
    var path = M.pathInTree(Tedges.map(function (x) { return { u: x.u, v: x.v, id: M.edgeKey(x.u, x.v) }; }), e.u, e.v);
    var cycle = path.concat([e.id]);
    var wT = sum(T, g), wNew = wT - f.w + e.w;
    function snap(kind, caption, edgesMap, weight, extra) {
      return Object.assign({ kind: kind, caption: caption, edges: edgesMap, counters: { weight: weight } }, extra || {});
    }
    var base = {};
    g.edges.forEach(function (x) { base[M.edgeKey(x.u, x.v)] = { state: 'muted', dashed: true }; });
    function em(over) { var m = Object.assign({}, base); Object.keys(over).forEach(function (k) { m[k] = over[k]; }); return m; }
    var treeState = {};
    T.forEach(function (id) { treeState[id] = { state: 'path' }; });
    var steps = [
      snap('tree', 'Here is a spanning tree <b>T</b> (orange), weight <b>' + wT + '</b>. The cut splits the towns into S (blue) and the rest (pink). The lightest road crossing it is <b>' + L.dash(e) + '</b> (' + e.w + '), and T does not use it. Claim: T can be improved.', em(treeState), wT),
      snap('add', 'Add <b>' + L.dash(e) + '</b> to T. Its ends were already connected inside T, so adding it closes exactly one cycle (amber).', em(Object.assign({}, treeState, (function () { var o = {}; cycle.forEach(function (id) { o[id] = { state: 'compare' }; }); o[e.id] = { state: 'done' }; return o; }()))), wT + e.w),
      snap('cross', 'The cycle starts in S, crosses the cut along ' + L.dash(e) + ', and must cross back somewhere else. It does so along <b>' + L.dash(f) + '</b> (' + f.w + '). Because ' + L.dash(e) + ' is the lightest crossing edge, ' + e.w + ' &lt; ' + f.w + '.', em(Object.assign({}, treeState, (function () { var o = {}; cycle.forEach(function (id) { o[id] = { state: 'compare' }; }); o[e.id] = { state: 'done' }; o[f.id] = { state: 'error' }; return o; }()))), wT + e.w),
      snap('swap', 'Remove <b>' + L.dash(f) + '</b>. Every town is still connected, because the new road covers the same gap. The weight drops by ' + (f.w - e.w) + ' to <b>' + wNew + '</b>. So T was never the cheapest: the lightest crossing edge belongs in an MST.', em((function () { var o = {}; T.forEach(function (id) { if (id !== f.id) o[id] = { state: 'path' }; }); o[e.id] = { state: 'done' }; o[f.id] = { state: 'muted', dashed: true }; return o; }())), wNew)
    ];
    var view = V.views.graph(fig.querySelector('[data-stage]'), { label: 'Swap argument on the nine towns', maxHeight: 400 });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'Side S' }, { state: 'default', color: 'color-mix(in srgb, var(--st-pivot) 30%, var(--el-fill))', label: 'Other side' },
      { state: 'path', shape: 'line', label: 'Tree T' }, { state: 'compare', shape: 'line', label: 'The cycle' }, { state: 'done', shape: 'line', label: 'Lightest crossing' }, { state: 'error', shape: 'line', label: 'Heavier, crossing back' }]);
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { weight: 'Weight of the tree' }, counterStates: { weight: 'done' }, baseStepMs: 2200, label: 'Swap argument controls',
      render: function (st, ctx) {
        view.render(L.state(g, {
          node: function (id) { return inS[id] ? 'cc0' : 'cc3'; },
          edge: function (x, id) { return st.edges[id]; }
        }), { duration: ctx.duration });
      }
    });
    void player;
  }

  /* ================================================================== Kruskal and Prim side by side */
  function compareFigure(fig) {
    var g = L.TOWNS, ids = L.ids(g), start = 'A';
    var kStage = fig.querySelector('[data-stage="k"]'), pStage = fig.querySelector('[data-stage="p"]');
    var kv = V.views.graph(kStage, { label: 'Kruskal building the tree', maxHeight: 300, nodeRadius: 19, minRadius: 12 });
    var pv = V.views.graph(pStage, { label: 'Prim building the tree', maxHeight: 300, nodeRadius: 19, minRadius: 12 });
    var kHost = fig.querySelector('[data-order="k"]'), pHost = fig.querySelector('[data-order="p"]');
    var kTot = h('span', { class: 'mst-order__total' }), pTot = h('span', { class: 'mst-order__total' });
    var kList = h('div'), pList = h('div');
    kHost.appendChild(h('div', { class: 'mst-order__head' }, h('span', { class: 'mst-panel__title' }, 'Edges in the order kept'), kTot)); kHost.appendChild(kList);
    pHost.appendChild(h('div', { class: 'mst-order__head' }, h('span', { class: 'mst-panel__title' }, 'Edges in the order kept'), pTot)); pHost.appendChild(pList);
    var kc = L.chipList(kList, { label: 'Kruskal edges in order', empty: 'none yet' }), pc = L.chipList(pList, { label: 'Prim edges in order', empty: 'none yet' });
    var sel = fig.querySelector('[data-start]');
    ids.forEach(function (id) { sel.appendChild(h('option', { value: id }, id)); });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'done', shape: 'line', label: 'Kept' }, { state: 'active', shape: 'line', label: 'Kept just now' }, { state: 'default', shape: 'line', label: 'Not kept (yet)' },
      { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'Kruskal component' }, { state: 'done', label: 'In Prim’s tree' }]);
    var data, player;
    function build() {
      data = M.orderFrames(g, start);
      var n = ids.length;
      return data.frames.map(function (fr, i) {
        var cap;
        if (i === 0) cap = 'Nothing kept yet. Kruskal starts with every town alone; Prim starts with the tree {' + start + '}.';
        else {
          var a = fr.kEdge, b = fr.pEdge;
          cap = 'Edge ' + i + ' of ' + (n - 1) + '. Kruskal keeps <b>' + L.dash(a) + '</b> (' + a.w + '): the lightest edge left that joins two components. Prim keeps <b>' + L.dash(b) + '</b> (' + b.w + '): the lightest edge leaving its tree.' + (a.id === b.id ? ' Same edge this time.' : '');
          if (i === n - 1) cap += ' <b>Both trees are complete</b>: ' + (data.sameEdges ? 'the same ' + (n - 1) + ' edges' : 'different edges (ties)') + ', total ' + fr.kTotal + ' and ' + fr.pTotal + '.';
        }
        return { i: i, fr: fr, caption: cap, counters: { kruskal: fr.kTotal, prim: fr.pTotal } };
      });
    }
    function render(st, ctx) {
      var fr = st.fr, kg = groupsFrom(g, fr.kruskal), inTree = {};
      inTree[start] = true;
      fr.prim.forEach(function (id) { var e = edgeOf(g, id); inTree[e.u] = inTree[e.v] = true; });
      var lastK = fr.kruskal[fr.kruskal.length - 1], lastP = fr.prim[fr.prim.length - 1];
      kv.render(L.state(g, {
        node: function (id) { return L.cc(ids, kg.comp[id], kg.size[kg.comp[id]]); },
        edge: function (e, id) { return fr.kruskal.indexOf(id) >= 0 ? { state: id === lastK ? 'active' : 'done', pulse: id === lastK && st.i > 0 } : 'default'; }
      }), { duration: ctx.duration });
      pv.render(L.state(g, {
        node: function (id) { return id === start && st.i === 0 ? 'active' : inTree[id] ? 'done' : 'default'; },
        edge: function (e, id) { return fr.prim.indexOf(id) >= 0 ? { state: id === lastP ? 'active' : 'done', pulse: id === lastP && st.i > 0 } : 'default'; }
      }), { duration: ctx.duration });
      function items(list, order) { return order.slice(0, fr[list].length).map(function (id, i) { var e = edgeOf(g, id); return { key: id, label: (i + 1) + '. ' + L.dash(e), w: e.w, state: i === fr[list].length - 1 ? 'considering' : 'accepted' }; }); }
      kc.render(items('kruskal', data.kruskalOrder), { duration: ctx.duration });
      pc.render(items('prim', data.primOrder), { duration: ctx.duration });
      kTot.textContent = 'weight ' + fr.kTotal; pTot.textContent = 'weight ' + fr.pTotal;
    }
    player = V.player({
      root: fig, steps: build(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, label: 'Side by side controls'
    });
    sel.addEventListener('change', function () { start = sel.value; player.setSteps(build()); });
  }

  /* ================================================================== the cycle property */
  function cycleFigure(fig) {
    var graphs = { six: L.MAIN, nine: L.TOWNS }, key = 'six', g = graphs.six;
    var view = V.views.graph(fig.querySelector('[data-stage]'), { label: 'Dropping the heaviest edge of each cycle', maxHeight: 400 });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'line', label: 'Still in the graph' }, { state: 'compare', shape: 'line', label: 'On the cycle' }, { state: 'error', shape: 'line', label: 'Heaviest of the cycle' },
      { state: 'muted', shape: 'dash', label: 'Dropped' }, { state: 'done', shape: 'line', label: 'Left: the MST' }]);
    function steps() { return M.cycleCut(g).steps; }
    function render(st, ctx) {
      view.render(L.state(g, {
        node: function () { return st.kind === 'done' ? 'done' : 'default'; },
        edge: function (e, id) {
          var status = st.status[id];
          if (status === 'dropped') return st.kind === 'drop' && st.heaviest === id ? { state: 'error', dashed: true } : { state: 'muted', dashed: true };
          if (status === 'heaviest') return 'error';
          if (status === 'cycle') return 'compare';
          return st.kind === 'done' ? 'done' : 'default';
        }
      }), { duration: ctx.duration });
    }
    var player = V.player({
      root: fig, steps: steps(), render: render, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { edges: 'Edges left', dropped: 'Edges dropped', weight: 'Total weight' }, counterStates: { dropped: 'error', weight: 'done' },
      baseStepMs: 1400, label: 'Cycle property controls'
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph', value: 'six', options: [{ value: 'six', label: 'Six towns' }, { value: 'nine', label: 'Nine towns' }],
      onChange: function (v) { key = v; g = graphs[v]; player.setSteps(steps()); }
    });
  }

  /* ================================================================== MST clustering */
  function clusterFigure(fig) {
    var seed = 5, pts, g, k = 3, mst;
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { w: 1000, h: 600 }, label: 'Points joined by their minimum spanning tree, longest links cut', maxHeight: 400, nodeRadius: 12, minRadius: 8 });
    var out = fig.querySelector('[data-readout]');
    function makePoints() {
      var rng = V.rng(seed), centers = [], out2 = [];
      while (centers.length < 3) {
        var c = [rng.int(140, 860), rng.int(120, 480)];
        if (centers.every(function (o) { return Math.hypot(o[0] - c[0], o[1] - c[1]) > 300; })) centers.push(c);
      }
      var sizes = [5, 5, 4];
      centers.forEach(function (c, ci) { for (var i = 0; i < sizes[ci]; i++) out2.push({ x: Math.max(30, Math.min(970, c[0] + rng.int(-85, 85))), y: Math.max(30, Math.min(570, c[1] + rng.int(-85, 85))) }); });
      return out2;
    }
    function load() { pts = makePoints(); g = M.pointsGraph(pts); mst = M.kruskal(g).tree; }
    var sl = V.slider(fig.querySelector('[data-slider]'), { label: 'Clusters k', min: 1, max: 8, step: 1, value: 3, format: function (v) { return 'k = ' + v; }, onInput: function (v) { k = v; draw(400); } });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'A cluster (one colour each)' }, { state: 'default', shape: 'line', label: 'MST link kept' }, { state: 'error', shape: 'dash', label: 'Cut: one of the k − 1 longest' }]);
    function draw(dur) {
      var r = M.clusterSplit(g, k), cut = {}, keep = {};
      r.cut.forEach(function (e) { cut[e.id] = e.w; }); r.keep.forEach(function (e) { keep[e.id] = true; });
      var shown = {};
      mst.forEach(function (e) { shown[e.id] = true; });
      view.render({
        nodes: g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, label: '', state: 'cc' + (r.assign[n.id] % CC) }; }),
        edges: mst.map(function (e) { return { id: e.id, from: e.u, to: e.v, state: cut[e.id] !== undefined ? 'error' : 'default', dashed: cut[e.id] !== undefined, label: cut[e.id] !== undefined ? String(Math.round(e.w)) : '' }; })
      }, { duration: dur });
      var maxKeep = r.keep.reduce(function (m, e) { return Math.max(m, e.w); }, 0), minCut = r.cut.length ? r.cut[r.cut.length - 1].w : 0;
      out.innerHTML = 'k = <b>' + r.k + '</b>: cluster sizes <b>' + r.sizes.join(', ') + '</b>. ' + (r.cut.length
        ? 'The ' + plural(r.cut.length, 'cut link') + ' weigh ' + r.cut.map(function (e) { return Math.round(e.w); }).join(', ') + '; the longest link kept is ' + Math.round(maxKeep) + '. ' + (minCut > 1.5 * maxKeep ? 'A big jump between kept and cut links is where the natural clusters end.' : 'Here the gap is small: the extra clusters are not natural.')
        : 'One cluster: the whole tree is kept.');
    }
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed++; load(); draw(500); });
    load(); draw(0);
  }

  /* ================================================================== cost chart (measured) */
  function costFigure(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 320, label: 'Operations counted while finding an MST, by number of vertices' });
    var out = fig.querySelector('[data-readout]');
    var Vs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    var data = {};
    function measureAll(kind) {
      if (data[kind]) return data[kind];
      var rng = V.rng(kind === 'sparse' ? 7 : 8);
      data[kind] = Vs.map(function (n) { return M.measure(n, kind === 'sparse' ? 3 * n : n * (n - 1) / 2, rng); });
      return data[kind];
    }
    var kind = 'sparse';
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Kruskal: sort + find' }, { state: 'pivot', label: 'Prim + binary heap' }, { state: 'done', label: 'Prim + array (no heap)' }]);
    function show(dur) {
      var rows = measureAll(kind);
      chart.render({
        x: { label: 'vertices V', min: 10, max: 100, ticks: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
        y: { label: 'operations counted', min: 0 },
        series: [
          { id: 'k', label: 'Kruskal', state: 'active', points: rows.map(function (r) { return [r.V, r.kruskal]; }) },
          { id: 'h', label: 'Prim heap', state: 'pivot', points: rows.map(function (r) { return [r.V, r.primHeap]; }) },
          { id: 'a', label: 'Prim array', state: 'done', points: rows.map(function (r) { return [r.V, r.primArray]; }) }
        ]
      }, { duration: dur });
      var r = rows[rows.length - 1], vals = { Kruskal: r.kruskal, 'Prim + heap': r.primHeap, 'Prim + array': r.primArray };
      var best = Object.keys(vals).sort(function (a, b) { return vals[a] - vals[b]; })[0];
      out.innerHTML = 'At V = ' + r.V + ' with <b>' + r.E.toLocaleString('en-US') + '</b> edges (' + (kind === 'sparse' ? 'sparse: E = 3V' : 'dense: every pair of vertices joined') + '): Kruskal <b>' + r.kruskal.toLocaleString('en-US') + '</b>, Prim + heap <b>' + r.primHeap.toLocaleString('en-US') + '</b>, Prim + array <b>' + r.primArray.toLocaleString('en-US') + '</b>. Least work: <b>' + best + '</b>. Counts are key comparisons in the sort, the heap and the array scans, plus union-find pointer hops, on random graphs.';
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph density', value: 'sparse', options: [{ value: 'sparse', label: 'Sparse: E = 3V' }, { value: 'dense', label: 'Dense: E = V(V−1)/2' }],
      onChange: function (v) { kind = v; show(700); }
    });
    show(600);
  }

  /* ================================================================== Kruskal or Prim? (decision diagram) */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Dense graph?\n(E close to V²)', col: 0, row: 0 },
      { id: 'array', type: 'end', text: 'Prim with a\nplain array', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Edges sorted, or\nforest / clusters?', col: 0, row: 1 },
      { id: 'kruskal', type: 'end', text: 'Kruskal', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Grow from a start,\nor implicit graph?', col: 0, row: 2 },
      { id: 'primheap', type: 'end', text: 'Prim with\na binary heap', col: 1, row: 2 },
      { id: 'either', type: 'end', text: 'Either one:\nO(E log V)', col: 0, row: 3 }
    ],
    edges: [
      { from: 'q1', to: 'array', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'kruskal', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'primheap', label: 'yes' }, { from: 'q3', to: 'either', label: 'no' }
    ]
  };
  var CHOOSE_TEXT = {
    q1: 'Start here. <b>Dense</b> means almost every pair of vertices has an edge, so E is about V². Pick <b>yes</b> or <b>no</b> on the lit question (click a label, or Tab to it and press Enter).',
    q2: 'Sparse graph. Do the edges already come as a sorted list, or do you need a spanning <em>forest</em> of a disconnected graph, or MST clustering (stop early)?',
    q3: 'Neither of those. Must the tree grow outward from a given start, or is the graph implicit (points in a plane, a grid) so you never build the whole edge list?',
    array: '<b>Prim with a plain array</b>, O(V²). With about V² edges a heap only adds a log factor to more work. You never need to sort or store all the edges.',
    kruskal: '<b>Kruskal.</b> Sorting is the only expensive step, and it disappears if the edges are already sorted. Stopping after n − k edges gives k clusters, and a disconnected graph simply ends as a forest.',
    primheap: '<b>Prim with a binary heap</b>, O(E log V). It only touches edges near the tree, so it fits adjacency lists and graphs generated on demand.',
    either: '<b>Either works</b> in O(E log V). Kruskal is the shortest to write if you already have union-find; Prim if you already have a heap and adjacency lists.'
  };
  function chooseFigure(fig) {
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Kruskal or Prim decision tree' });
    var cap = fig.querySelector('[data-caption]'), path, taken;
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

  /* ================================================================== variations */
  function tiesMini(st) {
    var g = L.TIES, sides = [['A-B', 'B-C', 'C-D'], ['A-B', 'B-C', 'A-D'], ['A-B', 'C-D', 'A-D'], ['B-C', 'C-D', 'A-D']];
    var view = V.views.graph(st, { maxHeight: 200, nodeRadius: 19, minRadius: 13, label: 'A square of equal weights and one of its four minimum spanning trees' });
    var i = 0;
    var btn = h('button', { type: 'button', class: 'btn btn--soft btn--sm mst-mini-btn' }, 'Next tie-break');
    st.parentNode.insertBefore(btn, st.nextSibling);
    function show() {
      var set = {};
      sides[i].forEach(function (id) { set[id] = true; });
      view.render(L.state(g, {
        node: function () { return 'done'; },
        edge: function (e, id) { return set[id] ? { state: 'done' } : { state: 'muted', dashed: true }; }
      }), { duration: 400 });
    }
    btn.addEventListener('click', function () { i = (i + 1) % sides.length; show(); });
    view.render(L.state(g, { node: function () { return 'done'; }, edge: function (e, id) { return sides[0].indexOf(id) >= 0 ? { state: 'done' } : { state: 'muted', dashed: true }; } }), { duration: 0 });
  }
  function spMini(st) {
    var g = L.MAIN, t = {}, path = { 'A-C': 1, 'C-D': 1, 'B-D': 1 };
    M.kruskal(g).tree.forEach(function (e) { t[e.id] = true; });
    V.views.graph(st, { maxHeight: 200, nodeRadius: 18, minRadius: 12, label: 'MST route from A to B costs 10 while the direct road costs 6' })
      .render(L.state(g, {
        node: function (id) { return id === 'A' || id === 'B' ? 'active' : 'default'; },
        edge: function (e, id) { return id === 'A-B' ? { state: 'compare', dashed: true } : path[id] ? { state: 'path' } : t[id] ? { state: 'done' } : { state: 'muted', dashed: true }; }
      }), { duration: 0 });
  }
  function maxMini(st) {
    var g = L.MAIN, neg = { nodes: g.nodes, edges: g.edges.map(function (e) { return { u: e.u, v: e.v, w: -e.w }; }) };
    var t = {}, total = 0;
    M.kruskal(neg).tree.forEach(function (e) { t[e.id] = true; total += -e.w; });
    var view = V.views.graph(st, { maxHeight: 200, nodeRadius: 18, minRadius: 12, label: 'Maximum spanning tree of the six towns, weight ' + total });
    view.render(L.state(g, { node: function () { return 'key'; }, edge: function (e, id) { return t[id] ? { state: 'key' } : { state: 'muted', dashed: true }; } }), { duration: 0 });
  }
  function boruvkaFigure(fig) {
    var g = L.TOWNS, ids = L.ids(g), r = M.boruvka(g);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { label: 'Borůvka rounds on the nine towns', maxHeight: 300, nodeRadius: 18, minRadius: 12 });
    var steps = [{ kind: 'init', kept: [], picks: [], caption: 'Every town is its own component. Round 1 begins: each component will grab its cheapest outgoing edge.', groups: ids.map(function (id) { return [id]; }) }];
    var kept = [];
    r.rounds.forEach(function (rd, i) {
      steps.push({ kind: 'pick', kept: kept.slice(), picks: rd.picks.map(function (p) { return p.edge; }), caption: 'Round ' + (i + 1) + ': every component picks its lightest edge to another component (amber). ' + plural(rd.added.length, 'distinct edge') + ' get chosen; two components often pick the same one.', groups: steps[steps.length - 1].groups });
      kept = kept.concat(rd.added);
      steps.push({ kind: 'merge', kept: kept.slice(), picks: [], caption: 'Merge along all the chosen edges at once. ' + plural(rd.groups.length, 'component') + ' left' + (rd.groups.length === 1 ? ': the MST is done.' : '; the count at least halved.'), groups: rd.groups });
    });
    function render(st, ctx) {
      var comp = {}, size = {};
      st.groups.forEach(function (gr) { gr.forEach(function (id) { comp[id] = gr[0]; }); size[gr[0]] = gr.length; });
      var keptSet = {}, pickSet = {};
      st.kept.forEach(function (id) { keptSet[id] = true; }); st.picks.forEach(function (id) { pickSet[id] = true; });
      view.render(L.state(g, {
        node: function (id) { return L.cc(ids, comp[id], size[comp[id]]); },
        edge: function (e, id) { return pickSet[id] ? 'compare' : keptSet[id] ? { state: 'done' } : 'default'; }
      }), { duration: ctx.duration });
    }
    V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1800, label: 'Borůvka controls' });
  }

  /* ================================================================== checks */
  function checks() {
    var g = L.graph([['A', 140, 130], ['B', 800, 130], ['C', 800, 470], ['D', 140, 470]], [['A', 'B', 4], ['B', 'C', 2], ['C', 'D', 3], ['D', 'A', 6], ['A', 'C', 5]]);
    var fig = V.$('#fig-total');
    V.views.graph(fig.querySelector('[data-stage]'), { maxHeight: 260, label: 'Square with a diagonal: A-B 4, B-C 2, C-D 3, D-A 6, A-C 5' }).render(L.state(g, {}), { duration: 0 });
    V.quiz('#quiz-total', {
      id: 'l30-total', question: 'What is the total weight of the minimum spanning tree of this graph?',
      options: ['9', '10', '11', '20'], answer: 0,
      explain: ['Sort the edges: 2, 3, 4, 5, 6. Keep B–C 2, C–D 3 and A–B 4: four vertices need three edges, and these three connect them. 2 + 3 + 4 = 9.',
        '10 is A–C 5 + B–C 2 + C–D 3. That is a spanning tree, but A–B 4 reaches A more cheaply than A–C 5.',
        '11 is D–A 6 + C–D 3 + B–C 2. It is a spanning tree that uses the heaviest edge where A–B 4 or A–C 5 would do.',
        '20 is every edge added together. A spanning tree of 4 vertices keeps only 3 edges.']
    });
    V.quiz('#quiz-dense', {
      id: 'l30-dense', question: 'A graph has 1,000 vertices and nearly all 500,000 possible edges. Which implementation does the least work?',
      options: ['Kruskal: sort all 500,000 edges', 'Prim with a binary heap', 'Prim with a plain array, O(V²)', 'They all do about the same'], answer: 2,
      explain: ['Sorting 500,000 edges costs roughly E log E, about 9 million steps.', 'A heap costs about E log V, still millions of steps: the log factor is paid on every one of 500,000 edges.', 'V² is 1,000,000 steps and needs no sort and no heap. When E is close to V², the plain array wins.', 'The counts differ by a factor of several, as the cost chart showed on complete graphs.']
    });
    V.quiz('#quiz-cycle', {
      id: 'l30-cycle', question: 'A cycle in a graph has edges of weight 3, 5, 5 and 9. What does the cycle property guarantee?',
      options: ['The edge of weight 9 is in no minimum spanning tree', 'Both edges of weight 5 are in every MST', 'The edge of weight 3 must be in every MST', 'Nothing: it depends on the rest of the graph'], answer: 0,
      explain: ['Yes: 9 is strictly the heaviest edge on the cycle, so removing it never disconnects anything and always lowers the total. No MST can contain it.', 'Not guaranteed. Two edges of equal weight on one cycle: one of them may be dropped.', 'Not from the cycle property alone. It is the lightest on this cycle, but the cut property, not the cycle property, would be needed to say it is safe.', 'The guarantee holds whatever the rest of the graph looks like: that is what makes the property useful.']
    });
    V.quiz('#quiz-bridge', {
      id: 'l30-bridge', question: 'True or false: the heaviest edge of the whole graph is never in the MST.',
      options: ['True', 'False'], answer: 1,
      explain: ['Not always. If that edge is the only link to a leaf, or the only road between two halves, every spanning tree needs it.', 'False. An edge that lies on no cycle (a bridge) must be in every spanning tree, whatever its weight. Only the heaviest edge <em>of a cycle</em> can be discarded.']
    });
  }

  /* ================================================================== summary card */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    function tile(label, text, draw) {
      var svg = s('svg', { viewBox: '0 0 160 90', width: '100%', height: '90', role: 'img', 'aria-label': label });
      draw(svg);
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, svg), h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text)));
    }
    function node(svg, x, y, cls) { svg.appendChild(s('circle', { cx: x, cy: y, r: 8, class: 'sm-node ' + (cls || '') })); }
    function line(svg, x1, y1, x2, y2, cls) { svg.appendChild(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: 'sm-edge ' + (cls || '') })); }
    tile('Cut property', 'The lightest edge across any cut is safe.', function (svg) {
      svg.appendChild(s('line', { x1: 82, y1: 6, x2: 72, y2: 84, class: 'sm-knife' }));
      [[30, 25], [40, 65], [58, 40]].forEach(function (p) { node(svg, p[0], p[1], 'is-a'); });
      [[110, 20], [125, 62], [100, 48]].forEach(function (p) { node(svg, p[0], p[1], 'is-b'); });
      line(svg, 58, 40, 100, 48, 'is-safe'); line(svg, 40, 65, 125, 62, 'is-cross'); line(svg, 30, 25, 110, 20, 'is-cross');
    });
    tile('Kruskal', 'Sort, then keep an edge if it joins two components.', function (svg) {
      [[16, 1], [30, 2], [44, 3], [58, 5], [72, 6], [86, 8]].forEach(function (b, i) {
        svg.appendChild(s('rect', { x: b[0] + 8, y: 70 - b[1] * 7, width: 11, height: b[1] * 7, rx: 2, class: 'sm-bar ' + (i < 4 ? 'is-keep' : 'is-skip') }));
      });
      svg.appendChild(s('text', { x: 128, y: 44, class: 'sm-text' }, '✓ ✓ ✓ ✓'));
      svg.appendChild(s('text', { x: 128, y: 62, class: 'sm-text is-skip' }, '✕ ✕'));
    });
    tile('Prim', 'Grow one tree by its cheapest exit, from a heap.', function (svg) {
      [[24, 45], [54, 22], [54, 68], [92, 45], [128, 25], [128, 65]].forEach(function (p, i) { node(svg, p[0], p[1], i < 4 ? 'is-tree' : ''); });
      line(svg, 24, 45, 54, 22, 'is-tree'); line(svg, 24, 45, 54, 68, 'is-tree'); line(svg, 54, 68, 92, 45, 'is-tree'); line(svg, 92, 45, 128, 25, 'is-cross'); line(svg, 92, 45, 128, 65, 'is-cross');
    });
    tile('Cycle property', 'The heaviest edge of any cycle can go.', function (svg) {
      node(svg, 40, 68, ''); node(svg, 120, 68, ''); node(svg, 80, 18, '');
      line(svg, 40, 68, 80, 18, ''); line(svg, 80, 18, 120, 68, ''); line(svg, 40, 68, 120, 68, 'is-drop');
      svg.appendChild(s('text', { x: 80, y: 84, class: 'sm-text is-skip' }, 'heaviest'));
    });
    tile('V − 1 edges', 'Connected and acyclic: exactly V − 1 edges.', function (svg) {
      [[30, 45], [62, 20], [62, 70], [100, 45], [132, 22]].forEach(function (p) { node(svg, p[0], p[1], 'is-tree'); });
      line(svg, 30, 45, 62, 20, 'is-tree'); line(svg, 30, 45, 62, 70, 'is-tree'); line(svg, 62, 20, 100, 45, 'is-tree'); line(svg, 100, 45, 132, 22, 'is-tree');
      svg.appendChild(s('text', { x: 132, y: 70, class: 'sm-text' }, '5 − 1 = 4'));
    });
    tile('Which one?', 'Dense: Prim + array. Edge list or forest: Kruskal.', function (svg) {
      svg.appendChild(s('text', { x: 80, y: 32, class: 'sm-text is-big' }, 'E log V'));
      svg.appendChild(s('text', { x: 80, y: 62, class: 'sm-text' }, 'or V² when dense'));
    });
  }

  V.ready(function () {
    var uses = V.$('#mini-uses'); if (uses) L.lazy(uses, usesMinis);
    L.lazy('#fig-proof', proofFigure);
    L.lazy('#fig-compare', compareFigure);
    L.lazy('#fig-cycle', cycleFigure);
    L.lazy('#fig-cluster', clusterFigure);
    L.lazy('#fig-cost', costFigure);
    L.lazy('#fig-choose', chooseFigure);
    L.lazy('#mini-ties', tiesMini); L.lazy('#mini-sp', spMini); L.lazy('#mini-max', maxMini);
    L.lazy('#fig-boruvka', boruvkaFigure);
    checks();
    summary();
    V.tabs('#variants');
  });
}());
