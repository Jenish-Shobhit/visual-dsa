/* Graph studio model (labs/graph-studio.html): pure logic, no DOM.

   Browser: VDSA.labs.graphStudio.  Node: module.exports (tests/labs/graph-studio.test.js).

   The studio owns ONE graph model and an adapter to the tested lesson generators (lessons 25 to 31):

     graph = {directed, weighted, nodes: [{id, x, y}], edges: [{from, to, w}]}      (w is always kept, shown when weighted)

     M.LIMITS                                   maxNodes 16, maxEdges 48, weight range, Floyd-Warshall cap
     M.parseText(text, {directed})              "A-B:4, B>C:2, D" -> {directed, weighted, nodes, edges, error}
     M.toText(graph)                            the same format (round-trips through parseText)
     M.encode(state) / M.decode(search)         URL query: g (edge list), d, w, p (positions), a, s, t
     M.facts(graph)                             V, E, density, components, cyclic, bipartite, negative, ...
     M.availability(graph, sel)                 {algoId: {ok, why, warn}}: which algorithms make sense right now
     M.run(algoId, graph, sel)                  {ok, frames, summary, legend} | {ok: false, error}
     M.PRESETS, M.preset(id), M.randomGraph(n, density, seed, opts), M.tidy(graph, layouts)

   A frame is one step of a generator turned into what the studio draws:
     {caption, counters, nodes: {id: {state, badge, badgeState, sub}}, edges: {key: {state, pulse, from, to, flow, capacity}},
      cur (vertex in focus), panel: {sections: [{label, chips: [{t, s}], empty, note}], grid?}}
   Edge keys are "from-to" when directed and the string-sorted pair otherwise (the same rule as the generators). */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) { root.VDSA.labs = root.VDSA.labs || {}; root.VDSA.labs.graphStudio = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 16, maxEdges: 48, minW: -99, maxW: 99, fwMax: 12, bounds: { w: 1000, h: 640 } };

  /* ================================================================== the generators */
  var LIB = null;
  function lib() {
    if (LIB) return LIB;
    if (typeof window === 'undefined' && typeof require === 'function') {
      var R = '../algos/';
      LIB = { GS: require(R + '26-bfs-and-dfs.js'), T: require(R + '27-topological-sort.js'), SP: require(R + '28-dijkstra-and-a-star.js'),
        SP2: require(R + '29-bellman-ford-and-floyd-warshall.js'), M: require(R + '30-minimum-spanning-trees.js'),
        NF: require(R + '31-network-flow.js'), G: require(R + '25-graphs.js') };
    } else {
      /* lesson 29 replaces VDSA.algos.shortestPaths, so graph-studio-capture.js saves lesson 28's copy as sp28 */
      var A = window.VDSA.algos;
      LIB = { GS: A.graphSearch, T: A.topo, SP: A.sp28 || A.shortestPaths, SP2: A.shortestPaths, M: A.mst, NF: A.networkFlow, G: A.graphs };
    }
    return LIB;
  }

  /* ================================================================== small helpers */
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fd(x) { return x === null || x === undefined || x === Infinity ? '∞' : String(x).replace('-', '−'); }
  function ids(g) { return g.nodes.map(function (n) { return n.id; }); }
  function key(from, to, directed) { from = String(from); to = String(to); if (!directed && to < from) { var t = from; from = to; to = t; } return from + '-' + to; }
  function ekey(g, e) { return key(e.from, e.to, g.directed); }
  function wOf(g, e) { return g.weighted ? e.w : 1; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function clone(g) {
    return { directed: !!g.directed, weighted: !!g.weighted,
      nodes: g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }),
      edges: g.edges.map(function (e) { return { from: e.from, to: e.to, w: e.w }; }) };
  }
  function chips(list, state) { return list.map(function (t) { return { t: String(t), s: state || 'default' }; }); }
  function path(parent, from, to) {
    var out = [], at = to, guard = 0;
    while (at !== null && at !== undefined && guard++ < 100) { out.push(at); if (at === from) return out.reverse(); at = parent[at]; }
    return null;
  }
  function pathEdgeStates(g, p, state, into) {
    for (var i = 0; i + 1 < p.length; i++) into[key(p[i], p[i + 1], g.directed)] = { state: state };
    return into;
  }
  function natCmp(a, b2) {
    a = String(a); b2 = String(b2);
    var ra = a.match(/\d+|\D+/g) || [], rb = b2.match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ra.length, rb.length); i++) {
      var x = ra[i], y = rb[i];
      if (/^\d/.test(x) && /^\d/.test(y)) { var d = parseInt(x, 10) - parseInt(y, 10); if (d) return d < 0 ? -1 : 1; }
      if (x !== y) return x < y ? -1 : 1;
    }
    return ra.length - rb.length;
  }

  /* ================================================================== graph normalising */
  /* Drop self-loops and repeated edges, make sure every edge end is a vertex, clamp weights to whole numbers. */
  function normalize(g) {
    var out = { directed: !!g.directed, weighted: !!g.weighted, nodes: [], edges: [] }, seen = {}, keys = {};
    (g.nodes || []).forEach(function (n) {
      var id = String(n && typeof n === 'object' ? n.id : n);
      if (seen[id]) return;
      seen[id] = true; out.nodes.push({ id: id, x: n.x, y: n.y });
    });
    (g.edges || []).forEach(function (e) {
      var from = String(e.from), to = String(e.to);
      if (from === to || !seen[from] || !seen[to]) return;
      var k = key(from, to, out.directed);
      if (keys[k]) return;
      keys[k] = true;
      var w = Number(e.w === undefined || e.w === null || e.w === '' ? (e.weight === undefined ? 1 : e.weight) : e.w);
      if (!isFinite(w)) w = 1;
      out.edges.push({ from: from, to: to, w: clamp(Math.round(w), LIMITS.minW, LIMITS.maxW) });
    });
    return out;
  }

  /* ================================================================== text format */
  var TOKEN = /^([A-Za-z0-9_]{1,4})\s*(->|→|>|-|–|—)\s*([A-Za-z0-9_]{1,4})(?:\s*[:=]\s*(-?\d+))?$/;
  function parseText(text, opts) {
    opts = opts || {};
    var raw = String(text === undefined || text === null ? '' : text);
    var parts = raw.split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) return { error: 'Type at least one vertex or edge, for example A-B:4, B-C:2.' };
    var nodes = [], seen = {}, edges = [], keys = {}, arrows = 0, dashes = 0, weights = 0;
    function add(id) { if (!seen[id]) { seen[id] = true; nodes.push(id); } }
    var parsed = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], m = TOKEN.exec(p);
      if (m) {
        if (m[1] === m[3]) return { error: '“' + p + '” joins a vertex to itself. Self-loops are not supported here.' };
        var isArrow = m[2] === '>' || m[2] === '->' || m[2] === '→';
        if (isArrow) arrows++; else dashes++;
        var w = null;
        if (m[4] !== undefined) {
          w = parseInt(m[4], 10); weights++;
          if (w < LIMITS.minW || w > LIMITS.maxW) return { error: 'The weight in “' + p + '” must be between ' + LIMITS.minW + ' and ' + LIMITS.maxW + '.' };
        }
        parsed.push([m[1], m[3], w]);
        add(m[1]); add(m[3]);
      } else if (/^[A-Za-z0-9_]{1,4}$/.test(p)) add(p);
      else return { error: 'Could not read “' + p + '”. Write edges as A-B (undirected) or A>B (directed), add :weight if you like, and separate items with commas. Names have up to 4 letters or digits.' };
      if (nodes.length > LIMITS.maxNodes) return { error: 'That is more than ' + LIMITS.maxNodes + ' vertices. The studio stops at ' + LIMITS.maxNodes + ' so the matrix stays readable.' };
    }
    var directed = arrows > 0 ? true : dashes > 0 ? false : !!opts.directed;
    parsed.forEach(function (e) {
      var k = key(e[0], e[1], directed);
      if (keys[k]) return;
      keys[k] = true;
      edges.push({ from: e[0], to: e[1], w: e[2] === null ? 1 : e[2] });
    });
    if (edges.length > LIMITS.maxEdges) return { error: 'That is more than ' + LIMITS.maxEdges + ' edges. Keep it to ' + LIMITS.maxEdges + ' or fewer.' };
    return { directed: directed, weighted: weights > 0, nodes: nodes, edges: edges, error: null };
  }

  function toText(g) {
    var arrow = g.directed ? '>' : '-', used = {}, out = [];
    g.edges.forEach(function (e) {
      used[e.from] = used[e.to] = true;
      out.push(e.from + arrow + e.to + (g.weighted ? ':' + e.w : ''));
    });
    g.nodes.forEach(function (n) { if (!used[n.id]) out.push(n.id); });
    return out.join(', ');
  }

  /* ================================================================== URL state */
  function enc(s) { return encodeURIComponent(s).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%3B/g, ';').replace(/%20/g, '+'); }
  function encode(st) {
    var g = st.graph, q = [];
    q.push('g=' + enc(toText(g)));
    if (g.directed) q.push('d=1');
    if (g.weighted) q.push('w=1');
    var pos = g.nodes.filter(function (n) { return typeof n.x === 'number'; }).map(function (n) { return n.id + ':' + Math.round(n.x) + ',' + Math.round(n.y); });
    if (pos.length) q.push('p=' + enc(pos.join(';')));
    if (st.algo) q.push('a=' + encodeURIComponent(st.algo));
    if (st.src) q.push('s=' + encodeURIComponent(st.src));
    if (st.dst) q.push('t=' + encodeURIComponent(st.dst));
    return '?' + q.join('&');
  }
  function decode(search) {
    var out = { graph: null, algo: null, src: null, dst: null, error: null };
    var params = {};
    String(search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { params[k] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { params[k] = v; }
    });
    if (params.a) out.algo = params.a;
    if (params.s) out.src = params.s;
    if (params.t) out.dst = params.t;
    if (params.g) {
      var r = parseText(params.g, { directed: params.d === '1' });
      if (r.error) { out.error = r.error; return out; }
      var directed = params.d === '1' || r.directed;
      var g = { directed: directed, weighted: params.w === '1' || r.weighted, nodes: r.nodes.map(function (id) { return { id: id }; }), edges: r.edges };
      if (params.p) {
        var pos = {};
        params.p.split(';').forEach(function (s) {
          var m = /^([A-Za-z0-9_]{1,4}):(-?\d+),(-?\d+)$/.exec(s);
          if (m) pos[m[1]] = { x: +m[2], y: +m[3] };
        });
        g.nodes.forEach(function (n) { if (pos[n.id]) { n.x = pos[n.id].x; n.y = pos[n.id].y; } });
      }
      out.graph = normalize(g);
    }
    return out;
  }

  /* ================================================================== layouts */
  function circleLayout(list, o) {
    var w = o.w, h = o.h, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - o.pad, out = {};
    list.forEach(function (id, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / list.length; out[id] = { x: cx + r * 1.25 * Math.cos(a), y: cy + r * Math.sin(a) }; });
    return out;
  }
  /* tidy(graph, layouts, mode): new positions. layouts = VDSA.views.graph.layouts (browser); a circle in Node. */
  function tidy(g, layouts, mode) {
    var list = ids(g), o = { w: LIMITS.bounds.w, h: LIMITS.bounds.h, pad: 80 }, pos;
    if (!list.length) return g;
    var nodes = list.map(function (id) { return { id: id }; }), edges = g.edges.map(function (e) { return { from: e.from, to: e.to }; });
    var cyc = g.directed && !!lib().T.findCycle({ nodes: list, edges: g.edges.map(function (e) { return [e.from, e.to]; }), directed: true });
    mode = mode || (g.directed && !cyc && g.edges.length ? 'layered' : 'force');
    if (layouts && mode === 'layered') { try { pos = layouts.layered(nodes, edges, { w: o.w, h: o.h, pad: o.pad, direction: 'LR' }); } catch (e) { pos = null; } }
    if (!pos && layouts && mode === 'circle') pos = layouts.circle(list, o);
    if (!pos && layouts && list.length > 2) pos = layouts.force(nodes, edges, { w: o.w, h: o.h, pad: o.pad });
    if (!pos) pos = circleLayout(list, o);
    var out = clone(g);
    out.nodes.forEach(function (n) { var p = pos[n.id] || { x: 500, y: 320 }; n.x = Math.round(p.x); n.y = Math.round(p.y); });
    return out;
  }
  function needsLayout(g) { return g.nodes.some(function (n) { return typeof n.x !== 'number' || typeof n.y !== 'number'; }); }

  /* ================================================================== presets */
  function mk(directed, weighted, nodes, edges, extra) {
    var g = { directed: directed, weighted: weighted, nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2] }; }),
      edges: edges.map(function (e) { return { from: e[0], to: e[1], w: e[2] === undefined ? 1 : e[2] }; }) };
    return Object.assign(g, extra || {});
  }
  var PRESETS = [
    { id: 'city', label: 'City map', blurb: 'Eight towns and the roads between them, weighted by distance.' },
    { id: 'courses', label: 'Course DAG', blurb: 'Prerequisites between courses: a directed graph with no cycle.' },
    { id: 'grid', label: 'Grid graph', blurb: 'A 4 by 4 lattice with random road costs.' },
    { id: 'negedge', label: 'Negative edge', blurb: 'One negative edge that fools Dijkstra.' },
    { id: 'negcycle', label: 'Negative cycle', blurb: 'A loop that pays you every lap: shortest paths do not exist.' },
    { id: 'flow', label: 'Flow network', blurb: 'The classic source-to-sink pipe network: max flow 23.' },
    { id: 'random', label: 'Random', blurb: 'A random graph. Use the size and density sliders.' }
  ];
  function preset(id, opts) {
    opts = opts || {};
    var g, hint = {};
    if (id === 'city') {
      g = mk(false, true, [['A', 110, 300], ['B', 300, 120], ['C', 330, 480], ['D', 520, 300], ['E', 690, 130], ['F', 700, 470], ['G', 890, 250], ['H', 880, 500]],
        [['A', 'B', 7], ['A', 'C', 9], ['B', 'C', 10], ['B', 'D', 15], ['C', 'D', 11], ['C', 'F', 20], ['D', 'E', 6], ['D', 'F', 9], ['E', 'G', 8], ['F', 'H', 6], ['G', 'H', 12], ['E', 'F', 14]]);
      hint = { algo: 'dijkstra', src: 'A', dst: 'H' };
    } else if (id === 'courses') {
      g = mk(true, false, [['M1', 90, 150], ['CS1', 90, 420], ['STAT', 320, 60], ['DS', 320, 300], ['ALG', 560, 200], ['OS', 560, 440], ['DB', 790, 100], ['ML', 790, 300], ['NET', 790, 500]],
        [['M1', 'STAT'], ['M1', 'ML'], ['CS1', 'DS'], ['DS', 'ALG'], ['DS', 'OS'], ['STAT', 'ML'], ['ALG', 'ML'], ['ALG', 'DB'], ['OS', 'NET'], ['DS', 'DB']]);
      hint = { algo: 'topo', src: 'CS1' };
    } else if (id === 'grid') {
      var r = window_rng(4), nodes = [], edges = [];
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) nodes.push(['G' + (i * 4 + j), 150 + j * 233, 90 + i * 155]);
      for (var a = 0; a < 4; a++) for (var c = 0; c < 4; c++) {
        if (c < 3) edges.push(['G' + (a * 4 + c), 'G' + (a * 4 + c + 1), 1 + Math.floor(r() * 9)]);
        if (a < 3) edges.push(['G' + (a * 4 + c), 'G' + ((a + 1) * 4 + c), 1 + Math.floor(r() * 9)]);
      }
      g = mk(false, true, nodes, edges);
      hint = { algo: 'kruskal', src: 'G0', dst: 'G15' };
    } else if (id === 'negedge') {
      g = mk(true, true, [['S', 110, 320], ['A', 380, 130], ['B', 380, 510], ['C', 650, 130], ['T', 890, 320]],
        [['S', 'A', 2], ['S', 'B', 3], ['B', 'A', -2], ['A', 'C', 3], ['A', 'T', 4], ['C', 'T', 1]]);
      hint = { algo: 'dijkstra', src: 'S', dst: 'T' };
    } else if (id === 'negcycle') {
      g = mk(true, true, [['S', 110, 320], ['A', 360, 150], ['B', 640, 150], ['C', 500, 500], ['T', 890, 320]],
        [['S', 'A', 2], ['A', 'B', 1], ['B', 'C', -4], ['C', 'A', 2], ['B', 'T', 3]]);
      hint = { algo: 'bellman', src: 'S', dst: 'T' };
    } else if (id === 'flow') {
      g = mk(true, true, [['s', 90, 320], ['a', 300, 130], ['c', 300, 510], ['b', 560, 130], ['d', 560, 510], ['t', 880, 320]],
        [['s', 'a', 16], ['s', 'c', 13], ['a', 'b', 12], ['c', 'a', 4], ['b', 'c', 9], ['c', 'd', 14], ['d', 'b', 7], ['b', 't', 20], ['d', 't', 4]]);
      hint = { algo: 'flow', src: 's', dst: 't' };
    } else if (id === 'random') {
      g = randomGraph(opts.n || 9, opts.density === undefined ? 0.3 : opts.density, opts.seed || 1, { directed: !!opts.directed, weighted: opts.weighted !== false });
      hint = { algo: 'bfs', src: 'V0', dst: null };
    } else {
      g = { directed: false, weighted: false, nodes: [], edges: [] };
    }
    g.hint = hint;
    return g;
  }
  function window_rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* randomGraph(n, density, seed, {directed, weighted}): n vertices V0..; `density` is the share of possible edges.
     It starts from a random spanning tree when there are enough edges, so a dense graph is connected. */
  function randomGraph(n, density, seed, o) {
    o = o || {};
    n = clamp(Math.round(n), 2, LIMITS.maxNodes);
    var rng = window_rng(seed || 1), directed = !!o.directed;
    var maxE = directed ? n * (n - 1) : n * (n - 1) / 2;
    var m = clamp(Math.round(clamp(density, 0, 1) * maxE), 0, LIMITS.maxEdges);
    var list = []; for (var i = 0; i < n; i++) list.push('V' + i);
    var edges = [], keys = {};
    function add(a, c) {
      var k = key(a, c, directed);
      if (a === c || keys[k]) return false;
      keys[k] = true;
      edges.push({ from: a, to: c, w: 1 + Math.floor(rng() * 19) });
      return true;
    }
    if (m >= n - 1) {
      var order = list.slice();
      for (var s = order.length - 1; s > 0; s--) { var j = Math.floor(rng() * (s + 1)); var t = order[s]; order[s] = order[j]; order[j] = t; }
      for (var k = 1; k < n && edges.length < m; k++) {
        var p = order[Math.floor(rng() * k)], q = order[k];
        if (directed && rng() < 0.5) add(q, p); else add(p, q);
      }
    }
    var guard = 0;
    while (edges.length < m && guard++ < 5000) add(list[Math.floor(rng() * n)], list[Math.floor(rng() * n)]);
    return { directed: directed, weighted: o.weighted !== false, nodes: list.map(function (id) { return { id: id }; }), edges: edges };
  }

  /* ================================================================== facts */
  function genGraph(g, weights) {
    return { nodes: ids(g), directed: g.directed, edges: g.edges.map(function (e) { return weights ? [e.from, e.to, wOf(g, e)] : [e.from, e.to]; }) };
  }
  function facts(g, opts) {
    opts = opts || {};
    var L = lib(), list = ids(g), V = list.length, E = g.edges.length;
    var gi = genGraph(g, true);
    var rep = L.G.build({ nodes: list, edges: gi.edges, directed: g.directed });
    var comps = V ? L.G.components(rep) : [];
    var neg = g.weighted && g.edges.some(function (e) { return e.w < 0; });
    var cyclic = false;
    if (V) cyclic = g.directed ? !!L.T.findCycle({ nodes: list, edges: g.edges.map(function (e) { return [e.from, e.to]; }), directed: true }) : E > V - comps.length;
    var bip = null;
    if (opts.bipartite !== false && V && V <= 16 && E) { try { bip = !!L.G.isBipartiteRef({ nodes: list, edges: g.edges.map(function (e) { return [e.from, e.to]; }), directed: false }); } catch (e2) { bip = null; } }
    var capOk = g.weighted && g.edges.every(function (e) { return e.w >= 0; });
    return { V: V, E: E, directed: g.directed, weighted: g.weighted, components: comps.length, connected: comps.length <= 1, cyclic: cyclic, bipartite: bip,
      negative: neg, capOk: capOk, density: V > 1 ? L.G.density(V, E, g.directed) : 0, rep: rep };
  }

  /* ================================================================== the algorithm catalogue */
  var ALGOS = [
    { id: 'bfs', group: 'traverse', label: 'BFS', full: 'Breadth-first search', lesson: '26-bfs-and-dfs', src: true, dst: 'path' },
    { id: 'dfs', group: 'traverse', label: 'DFS', full: 'Depth-first search', lesson: '26-bfs-and-dfs', src: true },
    { id: 'topo', group: 'order', label: 'Topological sort (Kahn)', full: 'Topological sort with Kahn’s algorithm', lesson: '27-topological-sort' },
    { id: 'topodfs', group: 'order', label: 'Topological sort (DFS)', full: 'Topological sort by reverse DFS finish time', lesson: '27-topological-sort' },
    { id: 'scc', group: 'order', label: 'Strongly connected components', full: 'Kosaraju’s strongly connected components', lesson: '27-topological-sort' },
    { id: 'dijkstra', group: 'paths', label: 'Dijkstra', full: 'Dijkstra’s shortest paths', lesson: '28-dijkstra-and-a-star', src: true, dst: 'path' },
    { id: 'bellman', group: 'paths', label: 'Bellman-Ford', full: 'Bellman-Ford shortest paths', lesson: '29-bellman-ford-and-floyd-warshall', src: true, dst: 'path' },
    { id: 'floyd', group: 'paths', label: 'Floyd-Warshall', full: 'Floyd-Warshall all-pairs shortest paths', lesson: '29-bellman-ford-and-floyd-warshall', dst: 'pair', src: 'pair' },
    { id: 'kruskal', group: 'trees', label: 'Kruskal', full: 'Kruskal’s minimum spanning tree', lesson: '30-minimum-spanning-trees' },
    { id: 'prim', group: 'trees', label: 'Prim', full: 'Prim’s minimum spanning tree', lesson: '30-minimum-spanning-trees', src: true },
    { id: 'flow', group: 'flow', label: 'Edmonds-Karp', full: 'Edmonds-Karp maximum flow', lesson: '31-network-flow', src: 'source', dst: 'sink' }
  ];
  var GROUPS = [
    { id: 'traverse', label: 'Traverse' }, { id: 'order', label: 'Order' }, { id: 'paths', label: 'Shortest paths' },
    { id: 'trees', label: 'Trees' }, { id: 'flow', label: 'Flow' }
  ];
  function algoById(id) { for (var i = 0; i < ALGOS.length; i++) if (ALGOS[i].id === id) return ALGOS[i]; return null; }

  function availability(g, sel) {
    sel = sel || {};
    var f = facts(g, { bipartite: false }), out = {};
    function set(id, ok, why, warn) { out[id] = { ok: ok, why: ok ? '' : why, warn: warn || '' }; }
    var empty = f.V === 0;
    ALGOS.forEach(function (a) {
      if (empty) return set(a.id, false, 'Add a vertex first.');
      switch (a.id) {
        case 'bfs': case 'dfs': return set(a.id, true);
        case 'topo': case 'topodfs': case 'scc':
          return set(a.id, g.directed, 'Needs a directed graph: turn on Directed.');
        case 'dijkstra':
          return set(a.id, true, '', f.negative ? 'This graph has a negative weight. Dijkstra assumes there are none, so it can settle a vertex too early and report a wrong distance. Watch, then compare with Bellman-Ford.' : '');
        case 'bellman':
          return set(a.id, true, '', !g.directed && f.negative ? 'In an undirected graph a negative edge is a negative cycle by itself (walk back and forth along it).' : '');
        case 'floyd':
          return set(a.id, f.V <= LIMITS.fwMax, 'The matrix view stops at ' + LIMITS.fwMax + ' vertices.', !g.directed && f.negative ? 'In an undirected graph a negative edge is a negative cycle by itself.' : '');
        case 'kruskal': case 'prim':
          return set(a.id, !g.directed, 'Spanning trees are for undirected graphs: turn off Directed.', !f.connected ? 'The graph is not connected, so ' + (a.id === 'kruskal' ? 'Kruskal builds a spanning forest' : 'Prim only reaches its own component') + '.' : '');
        case 'flow': {
          if (!g.directed) return set(a.id, false, 'Pipes have a direction: turn on Directed.');
          if (!g.weighted) return set(a.id, false, 'Needs capacities: turn on Weighted (each weight is a pipe capacity).');
          if (!f.capOk) return set(a.id, false, 'Capacities must be whole numbers, 0 or more.');
          if (sel.src && sel.dst && sel.src === sel.dst) return set(a.id, false, 'Pick two different vertices as source and sink.');
          return set(a.id, true);
        }
      }
    });
    return out;
  }

  /* ================================================================== frames */
  function nodeFrame(step, list, fn) {
    var out = {};
    list.forEach(function (id) { out[id] = fn(id) || {}; });
    return out;
  }
  function pulseEdge(edges, g, pulse, state, flag) {
    if (!pulse) return;
    edges[key(pulse.from, pulse.to, g.directed)] = { state: state || 'compare', pulse: flag !== false, from: pulse.from, to: pulse.to };
  }
  function copyEdges(map, g, transform) {
    var out = {};
    Object.keys(map || {}).forEach(function (k) { out[k] = { state: transform ? transform(map[k], k) : map[k] }; });
    return out;
  }
  function ccState(k) { return k ? 'cc' + ((k - 1) % 8) : 'default'; }

  function guardRun(fn) {
    try { return fn(); } catch (e) { return { ok: false, error: (e && e.message) || 'This graph could not be run.' }; }
  }

  /* ---------------------------------------------------------------- BFS */
  function runBfs(g, sel) {
    var L = lib(), list = ids(g), src = sel.src;
    var steps = L.GS.bfs(genGraph(g), src, sel.dst && sel.dst !== src ? { target: sel.dst } : {});
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g); pulseEdge(edges, g, s.pulse, 'compare');
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) { var d = s.dist[id]; return { state: s.states[id] || 'default', badge: d === null || d === undefined ? '∞' : d }; }),
        edges: edges,
        panel: { sections: [
          { label: 'Queue (front to back)', chips: chips((s.queue || []).map(function (q) { return q.v; }), 'frontier'), empty: 'empty' },
          { label: 'Visited, in order', chips: chips(s.order || [], 'visited'), empty: 'nothing yet' },
          { label: 'Distance from ' + src + ' (edges)', chips: chips(list.filter(function (id) { return s.dist[id] !== null && s.dist[id] !== undefined; }).map(function (id) { return id + ' = ' + s.dist[id]; })), empty: 'nothing yet' }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [], reach = list.filter(function (id) { return last.dist[id] !== null && last.dist[id] !== undefined; });
    rows.push(['Visit order', last.order.map(esc).join(' → ')]);
    var pending = list.filter(function (id) { return last.order.indexOf(id) < 0 && last.dist[id] !== null && last.dist[id] !== undefined; });
    if (pending.length) rows.push(['Queued, not yet visited', pending.map(esc).join(', ') + ' (found and waiting in the queue when the search stopped at ' + esc(sel.dst) + ')']);
    var far = 0; reach.forEach(function (id) { far = Math.max(far, last.dist[id]); });
    rows.push(['Reached', plural(reach.length, 'vertex', 'vertices') + ' of ' + list.length + (reach.length < list.length ? '; ' + list.filter(function (id) { return reach.indexOf(id) < 0; }).map(esc).join(', ') + ' not reachable from ' + esc(src) : '')]);
    rows.push(['Farthest', far + ' edge' + (far === 1 ? '' : 's') + ' from ' + esc(src)]);
    if (last.path) rows.push(['Fewest edges to ' + esc(sel.dst), last.path.map(esc).join(' → ') + ' (' + (last.path.length - 1) + ' edges)']);
    else if (sel.dst && sel.dst !== src) rows.push(['To ' + esc(sel.dst), 'no route from ' + esc(src)]);
    return { ok: true, frames: frames, summary: { headline: 'BFS from ' + b(src) + ' reaches ' + plural(reach.length, 'vertex', 'vertices') + '.', rows: rows } };
  }

  /* ---------------------------------------------------------------- DFS */
  var CLASS_STATE = { tree: 'done', back: 'error', forward: 'pivot', cross: 'compare' };
  function runDfs(g, sel) {
    var L = lib(), list = ids(g), src = sel.src;
    var steps = L.GS.dfs(genGraph(g), src, { all: true, classify: true });
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g);
      Object.keys(s.edgeClass || {}).forEach(function (k) { edges[k] = { state: CLASS_STATE[s.edgeClass[k]] || 'visited' }; });
      pulseEdge(edges, g, s.pulse, s.kind === 'back' ? 'error' : 'compare');
      var counts = { tree: 0, back: 0, forward: 0, cross: 0 };
      Object.keys(s.edgeClass || {}).forEach(function (k) { counts[s.edgeClass[k]] = (counts[s.edgeClass[k]] || 0) + 1; });
      var times = list.filter(function (id) { return s.disc[id] !== null && s.disc[id] !== undefined; }).map(function (id) { return id + ' ' + s.disc[id] + '/' + (s.fin[id] === null || s.fin[id] === undefined ? '–' : s.fin[id]); });
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var d = s.disc[id], f = s.fin[id];
          return { state: s.states[id] || 'default', sub: d === null || d === undefined ? undefined : d + '/' + (f === null || f === undefined ? '–' : f) };
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Stack (bottom to top)', chips: chips(s.stack || [], 'frontier'), empty: 'empty' },
          { label: 'Discovery / finish time', chips: chips(times), empty: 'nothing yet' },
          { label: 'Edge kinds so far', chips: [{ t: 'tree ' + counts.tree, s: 'done' }, { t: 'back ' + counts.back, s: 'error' }, { t: 'forward ' + counts.forward, s: 'pivot' }, { t: 'cross ' + counts.cross, s: 'compare' }] }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [];
    rows.push(['Visit order', last.order.map(esc).join(' → ')]);
    rows.push(['DFS forest', plural(last.roots.length, 'tree') + ' (roots ' + last.roots.map(esc).join(', ') + ')']);
    rows.push(['Cycle?', last.hasCycle ? 'yes: a back edge closes a loop' : 'no back edge, so no cycle']);
    return { ok: true, frames: frames, summary: { headline: 'DFS from ' + b(src) + ' visits all ' + list.length + ' vertices in ' + plural(last.roots.length, 'tree') + '.', rows: rows } };
  }

  /* ---------------------------------------------------------------- topological sort (Kahn) */
  function runKahn(g) {
    var L = lib(), list = ids(g);
    var steps = L.T.kahn(genGraph(g));
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g); pulseEdge(edges, g, s.pulse, 'compare');
      if (s.cycle) s.cycle.edges.forEach(function (k) { edges[k] = { state: 'error' }; });
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var st = s.states[id] || 'default', i = s.order.indexOf(id), o = { state: st };
          if (st !== 'active' && st !== 'done') { o.badge = s.indeg[id]; o.badgeState = s.indeg[id] === 0 ? 'done' : 'default'; }
          if (i >= 0) o.sub = '#' + (i + 1);
          return o;
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Ready (in-degree 0)', chips: chips(s.ready || [], 'frontier'), empty: 'none ready' },
          { label: 'Output order', chips: chips(s.order || [], 'done'), empty: 'nothing yet' },
          { label: 'In-degree (unplaced prerequisites)', chips: chips(list.map(function (id) { return id + ' ' + s.indeg[id]; })) }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [], headline;
    if (last.acyclic) {
      headline = 'A valid order exists: ' + last.order.map(b).join(' → ');
      rows.push(['Order', last.order.map(esc).join(' → ')]);
      rows.push(['Others', 'Ties are broken alphabetically. ' + (L.T.countOrders && list.length <= 20 ? (function (n) { return n + ' valid order' + (n === 1 ? ' exists' : 's exist') + ' for this graph.'; }(L.T.countOrders(genGraph(g)))) : '')]);
    } else {
      headline = 'No topological order: the graph has a cycle.';
      rows.push(['Cycle', last.cycle ? last.cycle.nodes.map(esc).join(' → ') + ' → ' + esc(last.cycle.nodes[0]) : 'yes']);
      rows.push(['Stuck', last.stuck.map(esc).join(', ') + ' never reach in-degree 0']);
    }
    return { ok: true, frames: frames, summary: { headline: headline, rows: rows } };
  }

  /* ---------------------------------------------------------------- topological sort (DFS) */
  function runDfsTopo(g) {
    var L = lib(), list = ids(g);
    var steps = L.T.dfsTopo(genGraph(g));
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g);
      if (s.cycle && s.cycle.edges) s.cycle.edges.forEach(function (k) { edges[k] = { state: 'error' }; });
      pulseEdge(edges, g, s.pulse, s.edgeClass === 'back' || s.kind === 'cycle' ? 'error' : 'compare');
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var st = s.states[id] || 'default', c = s.color && s.color[id];
          if (st !== 'active' && st !== 'error') st = c === 'grey' ? 'frontier' : c === 'black' ? 'done' : 'default';
          var d = s.disc[id], f = s.fin[id];
          return { state: st, sub: d === null || d === undefined ? undefined : d + '/' + (f === null || f === undefined ? '–' : f) };
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Stack (grey, still open)', chips: chips(s.stack || [], 'frontier'), empty: 'empty' },
          { label: 'Finished (first to last)', chips: chips(s.finished || [], 'done'), empty: 'nothing yet' },
          { label: 'Order so far (reverse of finished)', chips: chips((s.finished || []).slice().reverse(), 'path'), empty: 'nothing yet' }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [], headline;
    if (last.acyclic) {
      headline = 'Reverse finishing order: ' + last.order.map(b).join(' → ');
      rows.push(['Order', last.order.map(esc).join(' → ')]);
    } else {
      headline = 'A back edge shows the graph has a cycle, so there is no order.';
      rows.push(['Cycle', last.cycle && last.cycle.nodes ? last.cycle.nodes.map(esc).join(' → ') : 'found']);
    }
    return { ok: true, frames: frames, summary: { headline: headline, rows: rows } };
  }

  /* ---------------------------------------------------------------- strongly connected components (Kosaraju) */
  function runScc(g) {
    var L = lib(), list = ids(g);
    var steps = L.T.kosaraju(genGraph(g));
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g);
      if (s.pulse) {
        var a = s.transposed ? s.pulse.to : s.pulse.from, c = s.transposed ? s.pulse.from : s.pulse.to;
        edges[key(a, c, true)] = { state: 'compare', pulse: true, from: s.pulse.from, to: s.pulse.to };
      }
      var phase = s.phase === 1 ? 'Pass 1: finish times on the graph' : s.phase === 2 ? 'Pass 2: sweep the reversed graph' : 'Components found';
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var st = s.states[id] || 'default';
          if (st === 'cc') st = ccState(s.comp[id] || 1);
          var d = s.disc[id], f = s.fin[id];
          return { state: st, sub: d === null || d === undefined ? undefined : d + '/' + (f === null || f === undefined ? '–' : f) };
        }),
        edges: edges,
        panel: { sections: [
          { label: phase, chips: [] },
          { label: 'Stack', chips: chips(s.stack || [], 'frontier'), empty: 'empty' },
          { label: 'Finish order (last finished goes first in pass 2)', chips: chips((s.finished || []).slice().reverse(), 'visited'), empty: 'nothing yet' },
          { label: 'Components', chips: (s.comps || []).map(function (c, i) { return { t: '{' + c.join(', ') + '}', s: ccState(i + 1) }; }), empty: 'none yet' }
        ] }
      };
    });
    var last = steps[steps.length - 1], tj = L.T.tarjanScc(genGraph(g));
    var rows = [['Components', (last.comps || []).map(function (c) { return '{' + c.map(esc).join(', ') + '}'; }).join(' ')]];
    var big = (last.comps || []).filter(function (c) { return c.length > 1; });
    rows.push(['Loops', big.length ? plural(big.length, 'component') + ' with more than one vertex: each is a cycle of mutually reachable vertices' : 'every vertex is alone: the graph has no cycle (it is a DAG)']);
    rows.push(['Cross-check', 'Tarjan’s one-pass algorithm finds ' + plural(tj.comps.length, 'component') + (tj.comps.length === (last.comps || []).length ? ': the same answer' : ': a different count, please report this') ]);
    return { ok: true, frames: frames, summary: { headline: b((last.comps || []).length) + ' strongly connected ' + ((last.comps || []).length === 1 ? 'component' : 'components') + '.', rows: rows } };
  }

  /* ---------------------------------------------------------------- Dijkstra */
  function dijkstraSummary(g, sel, last, list) {
    var L = lib(), rows = [], neg = g.weighted && g.edges.some(function (e) { return e.w < 0; });
    var gi = genGraph(g, true), ref = L.SP.bellmanFord(gi, sel.src);
    var known = function (id) { return last.dist[id] !== null && last.dist[id] !== undefined; };
    /* stopped at the target: only settled vertices are final; the rest are the best found so far */
    var early = !neg && !!last.settled && list.some(function (id) { return known(id) && !last.settled[id]; });
    var dists = list.filter(function (id) { return known(id) && (!early || last.settled[id]); }).map(function (id) { return esc(id) + ' = ' + fd(last.dist[id]); });
    rows.push(['Distances from ' + esc(sel.src), (dists.join(', ') || 'none') + (early ? ' (final)' : '')]);
    if (early) rows.push(['Not final', list.filter(function (id) { return known(id) && !last.settled[id]; }).map(function (id) { return esc(id) + ' ≤ ' + fd(last.dist[id]); }).join(', ') + ': the search stopped at ' + esc(sel.dst) + ' before they were settled, so they may still shrink.']);
    var unreach = early ? [] : list.filter(function (id) { return !known(id); });
    if (unreach.length) rows.push(['Unreachable', unreach.map(esc).join(', ')]);
    var wrong = [];
    if (neg && !ref.negativeCycle) list.forEach(function (id) { if (ref.dist[id] !== undefined && ref.dist[id] !== null && last.dist[id] !== ref.dist[id]) wrong.push(id); });
    if (sel.dst && sel.dst !== sel.src) {
      var p = path(last.parent, sel.src, sel.dst);
      rows.push(['Route to ' + esc(sel.dst), p ? p.map(esc).join(' → ') + ' (length ' + fd(last.dist[sel.dst]) + ')' : 'no route']);
    }
    if (neg) {
      if (ref.negativeCycle) rows.push(['Truth', 'A negative cycle is reachable: no shortest distances exist for vertices past it. Run Bellman-Ford to see it flagged.']);
      else if (wrong.length) rows.push(['Wrong answers', wrong.map(function (id) { return esc(id) + ': Dijkstra says ' + fd(last.dist[id]) + ', truth is ' + fd(ref.dist[id]); }).join('; ') + '. A negative edge lets a settled vertex get cheaper later.']);
      else rows.push(['Truth', 'The answers happen to be right on this graph, but nothing guaranteed it. Try the Negative edge preset.']);
    }
    return { rows: rows, wrong: wrong, early: early };
  }
  function runDijkstra(g, sel) {
    var L = lib(), list = ids(g), src = sel.src;
    var neg = g.weighted && g.edges.some(function (e) { return e.w < 0; });
    var steps = L.SP.dijkstra(genGraph(g, true), src, neg ? { allowNegative: true } : (sel.dst && sel.dst !== src ? { target: sel.dst } : {}));
    var frames = steps.map(function (s) {
      var edges = copyEdges(s.edges, g);
      if (s.pulse) edges[key(s.pulse.from, s.pulse.to, g.directed)] = { state: s.pulse.result === 'relax' ? 'active' : s.pulse.result === 'ignore' ? 'error' : 'compare', pulse: true, from: s.pulse.from, to: s.pulse.to };
      var settled = list.filter(function (id) { return s.settled && s.settled[id]; });
      return {
        caption: s.caption, counters: s.counters, cur: s.u || (s.popped && s.popped.v) || null, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var o = { state: s.states[id] || 'default', badge: fd(s.dist[id]) };
          if (s.parent[id]) o.sub = 'via ' + s.parent[id];
          return o;
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Priority queue (smallest first)', chips: (s.pq || []).map(function (q) { return { t: '(' + q.d + ', ' + q.v + ')', s: q.stale ? 'muted' : 'frontier' }; }), empty: 'empty', note: 'Greyed entries are stale: a shorter route to that vertex was found after they were pushed.' },
          { label: 'Just popped', chips: s.popped ? [{ t: '(' + s.popped.d + ', ' + s.popped.v + ')' + (s.popped.stale ? ' stale' : ''), s: s.popped.stale ? 'muted' : 'active' }] : [], empty: 'nothing' },
          { label: 'Settled (final)', chips: chips(settled, neg ? 'visited' : 'done'), empty: 'none yet' },
          { label: 'Distance table', chips: chips(list.map(function (id) { return id + ' ' + fd(s.dist[id]); })) }
        ] }
      };
    });
    var last = steps[steps.length - 1], sm = dijkstraSummary(g, sel, last, list);
    if (sm.wrong.length) frames[frames.length - 1].nodes = nodeFrame(null, list, function (id) { var o = Object.assign({}, frames[frames.length - 1].nodes[id]); if (sm.wrong.indexOf(id) >= 0) { o.state = 'error'; } return o; });
    var headline = neg ? (sm.wrong.length ? 'Dijkstra answered wrongly for ' + sm.wrong.map(b).join(', ') + ' because of a negative edge.' : 'Dijkstra finished, but it is unsafe with negative edges.') : (sel.dst && sel.dst !== src && sm.early ? 'Shortest route from ' + b(src) + ' to ' + b(sel.dst) + ' found; the search stopped there.' : 'Shortest distances from ' + b(src) + ' to every reachable vertex.');
    return { ok: true, frames: frames, summary: { headline: headline, rows: sm.rows } };
  }

  /* ---------------------------------------------------------------- Bellman-Ford (and its graph form) */
  function directedForm(g) {
    var edges = [];
    g.edges.forEach(function (e) {
      edges.push({ from: e.from, to: e.to, w: wOf(g, e) });
      if (!g.directed) edges.push({ from: e.to, to: e.from, w: wOf(g, e) });
    });
    return { nodes: ids(g), edges: edges, directed: true };
  }
  function runBellman(g, sel) {
    var L = lib(), list = ids(g), src = sel.src, df = directedForm(g);
    var steps = L.SP2.bellmanFord(df, src);
    var frames = steps.map(function (s) {
      var edges = {}, cyc = {};
      (s.cycle || []).forEach(function (id) { cyc[id] = true; });
      list.forEach(function (id) { if (s.parent[id]) edges[key(s.parent[id], id, g.directed)] = { state: s.final && !s.cycle ? 'done' : 'frontier' }; });
      if (s.cycle) for (var i = 0; i < s.cycle.length; i++) edges[key(s.cycle[i], s.cycle[(i + 1) % s.cycle.length], g.directed)] = { state: 'error' };
      if (s.u && s.v && s.pos >= 0) edges[key(s.u, s.v, g.directed)] = { state: s.result === 'yes' ? 'active' : 'compare', pulse: true, from: s.u, to: s.v };
      var order = s.order || [];
      return {
        caption: s.caption, counters: s.counters, cur: s.u || null, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) {
          var st = 'default', d = s.dist[id];
          if (d !== null && d !== undefined) st = 'frontier';
          if (s.updated && s.updated[id]) st = 'swap';
          if (id === s.v && s.pos >= 0) st = 'compare';
          if (id === s.u && s.pos >= 0) st = 'active';
          if (s.final && !s.cycle && d !== null && d !== undefined) st = 'done';
          if (cyc[id]) st = 'error';
          var o = { state: st, badge: fd(d) };
          if (s.parent[id]) o.sub = 'via ' + s.parent[id];
          return o;
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Round ' + s.round + ' of ' + s.rounds + (s.verify ? ' (the check round)' : ''), chips: [] },
          { label: 'Edges this round (green: improved something)', chips: order.map(function (ei, pos) {
            var e = df.edges[ei], m = s.marks && s.marks[pos];
            return { t: e.from + '→' + e.to + ' ' + e.w, s: pos === s.pos ? 'active' : m === 'yes' ? 'done' : m === 'no' ? 'muted' : 'default' };
          }) },
          { label: 'Distance table', chips: chips(list.map(function (id) { return id + ' ' + fd(s.dist[id]); })) }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [], headline;
    if (last.cycle) {
      headline = 'Negative cycle: ' + last.cycle.map(b).join(' → ') + '.';
      rows.push(['Cycle', last.cycle.map(esc).join(' → ') + ' → ' + esc(last.cycle[0])]);
      rows.push(['Meaning', 'Each lap around it lowers the total, so there is no shortest path to anything it can reach.']);
    } else {
      headline = 'Shortest distances from ' + b(src) + ', negative edges allowed.';
      rows.push(['Distances', list.filter(function (id) { return last.dist[id] !== null && last.dist[id] !== undefined; }).map(function (id) { return esc(id) + ' = ' + fd(last.dist[id]); }).join(', ')]);
      var un = list.filter(function (id) { return last.dist[id] === null || last.dist[id] === undefined; });
      if (un.length) rows.push(['Unreachable', un.map(esc).join(', ')]);
      if (sel.dst && sel.dst !== src) {
        var p = path(last.parent, src, sel.dst);
        rows.push(['Route to ' + esc(sel.dst), p ? p.map(esc).join(' → ') + ' (length ' + fd(last.dist[sel.dst]) + ')' : 'no route']);
      }
      rows.push(['Work', plural(last.counters.checks, 'edge check') + ' in ' + plural(last.counters.round, 'round') + (last.early ? ' (stopped early: a full round changed nothing)' : '')]);
    }
    return { ok: true, frames: frames, summary: { headline: headline, rows: rows } };
  }

  /* ---------------------------------------------------------------- Floyd-Warshall */
  function fwGrid(s, g) {
    var n = s.n || s.ids.length, cells = [], pass = {}, via = {};
    (s.passUpdates || []).forEach(function (p) { pass[p[0] + ',' + p[1]] = true; });
    if (s.via) { via[s.via.a[0] + ',' + s.via.a[1]] = true; via[s.via.b[0] + ',' + s.via.b[1]] = true; }
    var neg = {}; (s.neg || []).forEach(function (i) { neg[i] = true; });
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        var v = s.d[i][j], k = i + ',' + j, st = 'default';
        if (s.improved && s.improved[i][j]) st = 'visited';
        if (pass[k]) st = 'frontier';
        if (via[k]) st = 'key';
        if ((s.kind === 'update' || s.kind === 'check') && s.i === i && s.j === j) st = s.kind === 'update' ? 'found' : 'compare';
        if (i === j && neg[i]) st = 'error';
        var cell = { state: st };
        if (v === null) cell.text = '∞'; else cell.value = v;
        row.push(cell);
      }
      cells.push(row);
    }
    var out = { rows: n, cols: n, cells: cells, rowHeaders: s.ids, colHeaders: s.ids, corner: 'i \\ j' };
    if (s.k >= 0) { out.highlightRow = { index: s.k, state: 'pivot' }; out.highlightCol = { index: s.k, state: 'pivot' }; }
    if ((s.kind === 'check' || s.kind === 'update') && s.i >= 0) out.cursor = { cell: [s.i, s.j], state: s.kind === 'update' ? 'found' : 'compare' };
    return out;
  }
  function runFloyd(g, sel) {
    var L = lib(), list = ids(g), df = directedForm(g);
    var steps = L.SP2.floydWarshall(df, { mode: 'improve' });
    var frames = steps.map(function (s) {
      var edges = {}, nodes = {};
      list.forEach(function (id) { nodes[id] = {}; });
      var k = s.k >= 0 ? s.ids[s.k] : null;
      if (k) nodes[k] = { state: 'pivot' };
      if (s.i >= 0 && s.ids[s.i]) nodes[s.ids[s.i]] = { state: 'active' };
      if (s.j >= 0 && s.ids[s.j] && s.j !== s.i) nodes[s.ids[s.j]] = { state: 'compare' };
      if (s.path && s.path.length > 1) {
        s.path.forEach(function (ix) { var id = s.ids[ix]; if (!nodes[id].state || nodes[id].state === 'default') nodes[id] = { state: 'path' }; });
        for (var i = 0; i + 1 < s.path.length; i++) edges[key(s.ids[s.path[i]], s.ids[s.path[i + 1]], g.directed)] = { state: s.pathKind === 'take' ? 'path' : 'compare' };
      }
      (s.neg || []).forEach(function (ix) { nodes[s.ids[ix]] = { state: 'error' }; });
      return { caption: s.caption, counters: s.counters, cur: k, kind: s.kind, nodes: nodes, edges: edges, panel: { grid: fwGrid(s, g), sections: [] } };
    });
    var last = steps[steps.length - 1], rows = [], n = last.n || list.length, reach = 0;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j && last.d[i][j] !== null) reach++;
    var headline;
    if (last.negCycle) {
      headline = 'A negative cycle: some vertices have a negative distance to themselves.';
      rows.push(['On a cycle', last.neg.map(function (ix) { return esc(last.ids[ix]); }).join(', ')]);
    } else {
      headline = 'Every pair at once: ' + plural(reach, 'reachable pair') + ' of ' + n * (n - 1) + '.';
      rows.push(['Reachable pairs', reach + ' of ' + n * (n - 1)]);
      var src = sel.src, dst = sel.dst;
      if (src && dst && src !== dst) {
        var si = last.ids.indexOf(src), di = last.ids.indexOf(dst), p = L.SP2.pathFromNext(last.next, si, di);
        rows.push(['Distance ' + esc(src) + ' to ' + esc(dst), last.d[si][di] === null ? 'no route' : fd(last.d[si][di]) + (p ? ' via ' + p.map(function (ix) { return esc(last.ids[ix]); }).join(' → ') : '')]);
      }
      var best = null;
      for (var a = 0; a < n; a++) for (var c = 0; c < n; c++) if (a !== c && last.d[a][c] !== null && (best === null || last.d[a][c] > best.d)) best = { d: last.d[a][c], a: a, c: c };
      if (best) rows.push(['Longest shortest route', esc(last.ids[best.a]) + ' to ' + esc(last.ids[best.c]) + ': ' + fd(best.d)]);
      rows.push(['Work', plural(last.counters.checks, 'cell check') + ', ' + plural(last.counters.updates, 'improvement')]);
    }
    return { ok: true, frames: frames, summary: { headline: headline, rows: rows } };
  }

  /* ---------------------------------------------------------------- Kruskal / Prim */
  function mstInput(g) { return { nodes: ids(g), edges: g.edges.map(function (e) { return { u: e.from, v: e.to, w: wOf(g, e) }; }) }; }
  function runKruskal(g) {
    var L = lib(), list = ids(g);
    var steps = L.M.kruskalTrace(mstInput(g));
    var STATE = { considering: 'compare', accepted: 'done', rejected: 'muted', pending: 'default' };
    var frames = steps.map(function (s) {
      var edges = {};
      Object.keys(s.status).forEach(function (k) {
        var st = s.status[k]; edges[k] = { state: STATE[st] || 'default' };
        if (st === 'rejected') edges[k].dashed = true;
      });
      var size = {}; Object.keys(s.comp).forEach(function (id) { size[s.comp[id]] = (size[s.comp[id]] || 0) + 1; });
      var roots = Object.keys(size).filter(function (r) { return size[r] > 1; }).sort(natCmp), colour = {};
      roots.forEach(function (r, i) { colour[r] = 'cc' + (i % 8); });
      var act = {}; (s.active || []).forEach(function (id) { act[id] = true; });
      return {
        caption: s.caption, counters: s.counters, cur: null, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) { return { state: act[id] ? 'active' : size[s.comp[id]] > 1 ? colour[s.comp[id]] : 'default' }; }),
        edges: edges,
        panel: { sections: [
          { label: 'Edges sorted by weight', chips: s.sorted.map(function (e) { var st = s.status[e.id]; return { t: e.u + '–' + e.v + ' ' + e.w, s: st === 'considering' ? 'compare' : st === 'accepted' ? 'done' : st === 'rejected' ? 'error' : 'default' }; }) },
          { label: 'Union-find components', chips: s.groups.map(function (gr) { var r = s.comp[gr[0]]; return { t: '{' + gr.join(', ') + '}', s: gr.length > 1 ? colour[r] || 'default' : 'default' }; }) },
          { label: 'Tree so far', chips: [{ t: 'weight ' + s.total, s: 'done' }, { t: plural(s.accepted.length, 'edge') + ' of ' + s.need, s: 'default' }] }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [];
    var tree = last.accepted, comps = last.groups.length;
    rows.push(['Tree edges', tree.map(function (id) { return esc(id.replace('-', '–')); }).join(', ') || 'none']);
    rows.push(['Total weight', esc(last.total)]);
    rows.push(['Components', comps === 1 ? 'one: the tree spans every vertex' : comps + ': the graph is not connected, so this is a minimum spanning forest']);
    rows.push(['Work', plural(last.counters.examined, 'edge') + ' examined, ' + last.counters.rejected + ' rejected (would close a loop)']);
    return { ok: true, frames: frames, summary: { headline: 'Minimum spanning ' + (comps === 1 ? 'tree' : 'forest') + ' weight: ' + b(last.total) + '.', rows: rows } };
  }
  function runPrim(g, sel) {
    var L = lib(), list = ids(g), src = sel.src;
    var steps = L.M.primTrace(mstInput(g), src);
    var STATE = { tree: 'done', popped: 'compare', queued: 'frontier', dead: 'muted', pending: 'default' };
    var frames = steps.map(function (s) {
      var edges = {}; Object.keys(s.status).forEach(function (k) { edges[k] = { state: STATE[s.status[k]] || 'default' }; });
      var inTree = {}; (s.tree || []).forEach(function (id) { inTree[id] = true; });
      return {
        caption: s.caption, counters: s.counters, cur: s.newNode || null, kind: s.kind,
        nodes: nodeFrame(s, list, function (id) { return { state: id === s.newNode ? 'active' : inTree[id] ? 'done' : 'default' }; }),
        edges: edges,
        panel: { sections: [
          { label: 'Priority queue of edges (lightest first)', chips: (s.pq || []).map(function (q) { return { t: q.u + '–' + q.v + ' ' + q.w, s: q.dead ? 'muted' : 'frontier' }; }), empty: 'empty', note: 'Greyed edges lead to a vertex already in the tree: they will be skipped.' },
          { label: 'Popped', chips: s.popped ? [{ t: s.popped.u + '–' + s.popped.v + ' ' + s.popped.w, s: 'compare' }] : [], empty: 'nothing' },
          { label: 'Tree vertices', chips: chips(s.tree || [], 'done') },
          { label: 'Tree weight', chips: [{ t: String(s.total), s: 'done' }] }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [], reached = last.tree.length;
    rows.push(['Tree edges', last.treeEdges.map(function (id) { return esc(id.replace('-', '–')); }).join(', ') || 'none']);
    rows.push(['Total weight', esc(last.total)]);
    rows.push(['Reached', reached === list.length ? 'every vertex, growing from ' + esc(src) : plural(reached, 'vertex', 'vertices') + ' of ' + list.length + ': Prim stays inside the component of ' + esc(src)]);
    rows.push(['Work', plural(last.counters.pushes, 'push', 'pushes') + ', ' + plural(last.counters.pops, 'pop')]);
    return { ok: true, frames: frames, summary: { headline: 'Minimum spanning tree weight: ' + b(last.total) + (reached < list.length ? ' (component of ' + esc(src) + ' only)' : '') + '.', rows: rows } };
  }

  /* ---------------------------------------------------------------- Edmonds-Karp */
  function runFlow(g, sel) {
    var L = lib(), list = ids(g);
    var net = { nodes: list, edges: g.edges.map(function (e) { return { from: e.from, to: e.to, cap: e.w }; }), source: sel.src, sink: sel.dst };
    var N = L.NF.normalize(net), steps = L.NF.trace(net, { detail: 'full' }), result = steps.result;
    var frames = steps.map(function (s) {
      var fl = s.fl || {}, mark = {}, found = {}, bott = null, cutSet = {};
      (s.path || []).forEach(function (a, i) { mark[a.edge] = a.dir; if (i === s.bottleArc && s.kind === 'bottleneck') bott = a.edge; });
      (s.found || []).forEach(function (a) { found[a.edge] = a.dir; });
      if (s.cut) s.cut.edges.forEach(function (id) { cutSet[id] = true; });
      var edges = {};
      N.edges.forEach(function (e) {
        var f = fl[e.id] || 0, st = f === 0 ? 'default' : f >= e.cap ? 'done' : 'active';
        if (cutSet[e.id]) st = 'error';
        if (found[e.id]) st = found[e.id] === 'back' ? 'pivot' : 'frontier';
        if (mark[e.id]) st = mark[e.id] === 'back' ? 'pivot' : 'path';
        if (bott === e.id) st = 'compare';
        edges[e.id] = { state: st, flow: f, capacity: e.cap, pulse: mark[e.id] === 'fwd' && s.kind === 'push' };
      });
      var res = L.NF.residual(N, fl);
      return {
        caption: s.caption, counters: s.counters, cur: s.current, kind: s.kind, value: s.value,
        nodes: nodeFrame(s, list, function (id) {
          var st = s.states[id] || 'default';
          if (st === 'default' && (id === sel.src || id === sel.dst)) st = 'key';
          var o = { state: st };
          if (s.level && s.level[id] !== undefined) o.badge = s.level[id];
          if (id === sel.src) o.sub = 'source'; else if (id === sel.dst) o.sub = 'sink';
          return o;
        }),
        edges: edges,
        panel: { sections: [
          { label: 'Flow value', chips: [{ t: String(s.value), s: 'done' }] },
          { label: 'Search queue', chips: chips(s.queue || [], 'frontier'), empty: 'empty' },
          { label: 'Augmenting path', chips: s.pathNodes ? chips(s.pathNodes, 'path') : [], empty: 'none right now' },
          { label: 'Residual room (dashed: flow you can take back)', chips: res.map(function (r) { return { t: r.from + '→' + r.to + ' ' + r.res, s: r.reverseOnly ? 'pivot' : 'default' }; }), empty: 'no room left anywhere' }
        ] }
      };
    });
    var last = steps[steps.length - 1], rows = [];
    rows.push(['Paths used', plural(result.rounds, 'augmenting path') + (result.paths && result.paths.length ? ': ' + result.paths.map(function (p) { return p.map(esc).join('→'); }).join('; ') : '')]);
    if (result.cut) rows.push(['Min cut', 'edges ' + (result.cut.edges.map(function (id) { return esc(id.replace('-', '→')); }).join(', ') || 'none') + ' with total capacity ' + esc(result.cut.value) + ': the same as the flow']);
    var busy = Object.keys(result.flow).filter(function (k) { return result.flow[k] > 0; }).length;
    rows.push(['Pipes used', busy + ' of ' + N.edges.length]);
    return { ok: true, frames: frames, summary: { headline: 'Maximum flow from ' + b(sel.src) + ' to ' + b(sel.dst) + ': ' + b(result.value) + '.', rows: rows }, value: result.value, last: last };
  }

  /* ================================================================== run */
  function legendFor(id, g) {
    var neutral = [{ state: 'active', label: 'Current' }];
    switch (id) {
      case 'bfs': return [{ state: 'frontier', label: 'In the queue' }, { state: 'active', label: 'Being expanded' }, { state: 'visited', label: 'Visited' }, { state: 'path', label: 'Path found' }, { state: 'compare', shape: 'line', label: 'Edge being checked' }];
      case 'dfs': return [{ state: 'frontier', label: 'On the stack' }, { state: 'active', label: 'Current' }, { state: 'visited', label: 'Finished' }, { state: 'done', shape: 'line', label: 'Tree edge' }, { state: 'error', shape: 'line', label: 'Back edge (cycle)' }, { state: 'pivot', shape: 'line', label: 'Forward edge' }, { state: 'compare', shape: 'line', label: 'Cross edge' }];
      case 'topo': return [{ state: 'default', shape: 'outline', label: 'Waiting (badge = in-degree)' }, { state: 'frontier', label: 'Ready' }, { state: 'active', label: 'Placing now' }, { state: 'done', label: 'Placed' }, { state: 'error', label: 'Stuck in a cycle' }];
      case 'topodfs': return [{ state: 'frontier', label: 'Open (grey)' }, { state: 'active', label: 'Current' }, { state: 'done', label: 'Finished (black)' }, { state: 'error', shape: 'line', label: 'Back edge (cycle)' }];
      case 'scc': return [{ state: 'active', label: 'Current' }, { state: 'cc0', label: 'One colour per component' }, { state: 'compare', shape: 'line', label: 'Edge being followed' }];
      case 'dijkstra': return [{ state: 'frontier', label: 'Tentative distance' }, { state: 'active', label: 'Just settled' }, { state: 'done', label: 'Settled (final)' }, { state: 'error', label: 'Wrong answer' }, { state: 'active', shape: 'line', label: 'Edge relaxed' }, { state: 'done', shape: 'line', label: 'Shortest-path tree' }];
      case 'bellman': return [{ state: 'frontier', label: 'Has a distance' }, { state: 'active', label: 'Edge start' }, { state: 'compare', label: 'Edge end' }, { state: 'swap', label: 'Improved this round' }, { state: 'done', label: 'Final' }, { state: 'error', label: 'Negative cycle' }];
      case 'floyd': return [{ state: 'pivot', label: 'Stopover k' }, { state: 'active', label: 'From i' }, { state: 'compare', label: 'To j' }, { state: 'path', label: 'Route tried' }];
      case 'kruskal': return [{ state: 'compare', shape: 'line', label: 'Edge considered' }, { state: 'done', shape: 'line', label: 'In the tree' }, { state: 'muted', shape: 'line', label: 'Rejected (loop)' }, { state: 'cc0', label: 'Component colour' }];
      case 'prim': return [{ state: 'done', label: 'In the tree' }, { state: 'active', label: 'Just added' }, { state: 'frontier', shape: 'line', label: 'Candidate edge' }, { state: 'compare', shape: 'line', label: 'Popped' }, { state: 'muted', shape: 'line', label: 'Dead edge' }];
      case 'flow': return [{ state: 'path', shape: 'line', label: 'Augmenting path' }, { state: 'compare', shape: 'line', label: 'Bottleneck' }, { state: 'pivot', shape: 'line', label: 'Reverse hop (undo)' }, { state: 'active', shape: 'line', label: 'Carries flow' }, { state: 'done', shape: 'line', label: 'Full pipe' }, { state: 'error', shape: 'line', label: 'Min cut' }];
    }
    return neutral;
  }

  function restingFrame(caption) { return { caption: caption || '', counters: {}, nodes: {}, edges: {}, cur: null, kind: 'rest', panel: { sections: [] } }; }

  function run(id, graph, sel) {
    sel = sel || {};
    var g = normalize(Object.assign({}, graph, { nodes: graph.nodes.map(function (n) { return { id: n.id }; }) }));
    var a = algoById(id);
    if (!a) return { ok: false, error: 'Pick an algorithm.' };
    var av = availability(g, sel)[id];
    if (!av.ok) return { ok: false, error: av.why };
    var list = ids(g), src = sel.src && list.indexOf(sel.src) >= 0 ? sel.src : list[0], dst = sel.dst && list.indexOf(sel.dst) >= 0 ? sel.dst : null;
    var s2 = { src: src, dst: dst };
    if (id === 'flow' && !dst) s2.dst = list[list.length - 1];
    if (id === 'flow' && s2.src === s2.dst) return { ok: false, error: 'Pick two different vertices as source and sink.' };
    var r = guardRun(function () {
      switch (id) {
        case 'bfs': return runBfs(g, s2);
        case 'dfs': return runDfs(g, s2);
        case 'topo': return runKahn(g, s2);
        case 'topodfs': return runDfsTopo(g, s2);
        case 'scc': return runScc(g, s2);
        case 'dijkstra': return runDijkstra(g, s2);
        case 'bellman': return runBellman(g, s2);
        case 'floyd': return runFloyd(g, s2);
        case 'kruskal': return runKruskal(g, s2);
        case 'prim': return runPrim(g, s2);
        case 'flow': return runFlow(g, s2);
      }
    });
    if (r.ok) { r.legend = legendFor(id, g); r.warn = av.warn; r.sel = s2; r.algo = a; }
    return r;
  }

  return {
    LIMITS: LIMITS, ALGOS: ALGOS, GROUPS: GROUPS, PRESETS: PRESETS, algoById: algoById,
    normalize: normalize, clone: clone, key: key, ekey: ekey, parseText: parseText, toText: toText, encode: encode, decode: decode,
    tidy: tidy, needsLayout: needsLayout, preset: preset, randomGraph: randomGraph, facts: facts, availability: availability,
    run: run, restingFrame: restingFrame, natCmp: natCmp, fd: fd, genGraph: genGraph
  };
}));
