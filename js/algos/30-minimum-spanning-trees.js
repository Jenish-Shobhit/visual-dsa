/* Lesson 30 · Minimum spanning trees — pure step generators (no DOM).

   Browser: VDSA.algos.mst.  Node: module.exports.

   A graph is {nodes: [{id, x?, y?} | id], edges: [{u, v, w}]}   (undirected, weighted; ids are short strings)

     MST.edgeKey(u, v)                      canonical edge id "A-C" (smaller name first)
     MST.parseEdges(text, opts)             "A-B:4, B-C:2, D" -> {values: {nodes, edges}, error}
     MST.kruskal(G, opts)                   plain Kruskal: {tree, total, components, sorted}
     MST.prim(G, start)                     plain lazy Prim: {tree, total, reached}
     MST.kruskalTrace(G, opts)              lab trace (sorted list + cursor + union-find components)
     MST.primTrace(G, start, opts)          lab trace (priority queue of candidate edges)
     MST.cutInfo(G, side)                   crossing edges of the cut (side = array of ids) and the lightest one
     MST.orderFrames(G, start)              the order Kruskal and Prim accept edges, frame by frame
     MST.boruvka(G)                         Borůvka rounds: {rounds: [{picks, added, groups}], tree, total}
     MST.spanningTrees(G, limit)            every spanning tree of a small graph {count, trees: [{edges, weight}]}
     MST.cycleCut(G)                        repeatedly drop the heaviest edge of a cycle -> the MST
     MST.clusterSplit(G, k)                 MST clustering: cut the k-1 heaviest MST edges
     MST.measure(V, E, rng)                 real operation counts of Kruskal, heap Prim and array Prim
     MST.randomGraph(V, E, rng)             connected random graph with weights in 1..999
     MST.pathInTree(edges, a, b)            edge ids on the tree path a -> b (or null)

   Tie-breaking: edges of equal weight are taken in input order (Kruskal), entries of equal weight leave the
   Prim queue in the order they were pushed. With distinct weights the MST is unique, so both agree.

   Trace step fields (Kruskal): {algo, kind: init|pick|check|accept|reject|done, cursor, sorted, status,
     groups, comp, accepted, total, same, caption, line, vars, counters, flow}
   Trace step fields (Prim):    {algo, kind: init|push|pop|add|skip|done, tree, treeEdges, pq, popped, status,
     newNode, total, caption, line, vars, counters, flow}
   Code labels — Kruskal: sort init loop check reject accept stop done. Prim: init seed loop pop skip add push done. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.mst = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { nodes: 10, edges: 22, minW: -99, maxW: 99 };

  function edgeKey(u, v) { u = String(u); v = String(v); return u < v ? u + '-' + v : v + '-' + u; }
  function dash(e) { return e.u + '–' + e.v; }
  function plural(k, one, many) { return k + ' ' + (k === 1 ? one : (many || one + 's')); }

  /* ------------------------------------------------------------------ normalising */
  function norm(G) {
    var ids = (G.nodes || []).map(function (n) { return String(n && typeof n === 'object' ? n.id : n); });
    var index = {};
    ids.forEach(function (id, i) { index[id] = i; });
    var edges = [];
    (G.edges || []).forEach(function (e, i) {
      var u, v, w;
      if (Array.isArray(e)) { u = e[0]; v = e[1]; w = e[2]; } else { u = e.u !== undefined ? e.u : e.from; v = e.v !== undefined ? e.v : e.to; w = e.w !== undefined ? e.w : e.weight; }
      u = String(u); v = String(v);
      if (index[u] === undefined || index[v] === undefined || u === v) return;
      edges.push({ id: edgeKey(u, v), u: u, v: v, w: +w, i: i });
    });
    var adj = {};
    ids.forEach(function (id) { adj[id] = []; });
    edges.forEach(function (e) {
      adj[e.u].push({ to: e.v, w: e.w, id: e.id, e: e });
      adj[e.v].push({ to: e.u, w: e.w, id: e.id, e: e });
    });
    return { ids: ids, index: index, edges: edges, adj: adj };
  }
  function sortEdges(edges) {
    return edges.slice().sort(function (a, b) { return a.w - b.w || a.i - b.i; });
  }
  function slim(e) { return { id: e.id, u: e.u, v: e.v, w: e.w }; }

  /* ------------------------------------------------------------------ union-find (root = smallest index) */
  function UF(n) {
    this.p = [];
    for (var i = 0; i < n; i++) this.p.push(i);
    this.hops = 0;
  }
  UF.prototype.find = function (x) {
    var p = this.p, r = x;
    while (p[r] !== r) { r = p[r]; this.hops++; }
    while (p[x] !== r) { var nx = p[x]; p[x] = r; x = nx; }
    return r;
  };
  UF.prototype.union = function (a, b) {
    var ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (ra < rb) this.p[rb] = ra; else this.p[ra] = rb;   // the smaller index becomes the root: a stable colour
    return true;
  };

  /* ------------------------------------------------------------------ plain algorithms (references for the traces) */
  function kruskal(G) {
    var g = norm(G), uf = new UF(g.ids.length), sorted = sortEdges(g.edges), tree = [], total = 0;
    sorted.forEach(function (e) {
      if (uf.union(g.index[e.u], g.index[e.v])) { tree.push(slim(e)); total += e.w; }
    });
    var roots = {};
    g.ids.forEach(function (id, i) { roots[uf.find(i)] = true; });
    return { tree: tree, total: total, components: Object.keys(roots).length, sorted: sorted.map(slim) };
  }

  function prim(G, start) {
    var g = norm(G);
    if (start === undefined || start === null || g.index[String(start)] === undefined) start = g.ids[0];
    start = String(start);
    var inTree = {}, pq = [], seq = 0, tree = [], total = 0;
    function push(v) { g.adj[v].forEach(function (a) { if (!inTree[a.to]) pq.push({ e: a.e, u: v, v: a.to, w: a.w, seq: seq++ }); }); pq.sort(pqCmp); }
    if (start === undefined) return { tree: [], total: 0, reached: 0 };
    inTree[start] = true; push(start);
    var count = 1;
    while (pq.length && count < g.ids.length) {
      var top = pq.shift();
      if (inTree[top.v]) continue;
      inTree[top.v] = true; count++; tree.push(slim(top.e)); total += top.w; push(top.v);
    }
    return { tree: tree, total: total, reached: count };
  }
  function pqCmp(a, b) { return a.w - b.w || a.seq - b.seq; }

  /* ------------------------------------------------------------------ tree paths */
  function pathInTree(edges, a, b) {
    a = String(a); b = String(b);
    var adj = {};
    edges.forEach(function (e) {
      var u = e.u, v = e.v;
      (adj[u] = adj[u] || []).push({ to: v, id: e.id || edgeKey(u, v) });
      (adj[v] = adj[v] || []).push({ to: u, id: e.id || edgeKey(u, v) });
    });
    if (a === b) return [];
    var prev = {}, q = [a], seen = {};
    seen[a] = true;
    while (q.length) {
      var x = q.shift();
      if (x === b) break;
      (adj[x] || []).forEach(function (n) { if (!seen[n.to]) { seen[n.to] = true; prev[n.to] = { from: x, id: n.id }; q.push(n.to); } });
    }
    if (!seen[b]) return null;
    var out = [], cur = b;
    while (cur !== a) { out.push(prev[cur].id); cur = prev[cur].from; }
    return out.reverse();
  }
  function pathNodes(edges, a, b) {
    var ids = pathInTree(edges, a, b);
    if (!ids) return null;
    var nodes = [String(a)], cur = String(a);
    ids.forEach(function (id) {
      var e = edges.filter(function (x) { return (x.id || edgeKey(x.u, x.v)) === id; })[0];
      cur = e.u === cur ? e.v : e.u; nodes.push(cur);
    });
    return nodes;
  }

  /* ================================================================== Kruskal trace */
  function kruskalTrace(G, opts) {
    opts = opts || {};
    var g = norm(G), n = g.ids.length, uf = new UF(n);
    var sorted = sortEdges(g.edges).map(function (e) { return { id: e.id, u: e.u, v: e.v, w: e.w, i: e.i }; });
    var sortedView = sorted.map(slim);
    var status = {};
    sorted.forEach(function (e) { status[e.id] = 'pending'; });
    var accepted = [], acceptedEdges = [], total = 0, examined = 0, rejected = 0, cursor = -1;
    var steps = [];

    function groups() {
      var by = {}, order = [];
      g.ids.forEach(function (id, i) {
        var r = uf.find(i);
        if (!by[r]) { by[r] = []; order.push(r); }
        by[r].push(id);
      });
      var comp = {};
      order.forEach(function (r) { by[r].forEach(function (id) { comp[id] = g.ids[r]; }); });
      return { list: order.map(function (r) { return by[r]; }), comp: comp };
    }
    function snap(kind, o) {
      var gr = groups();
      var s = {
        algo: 'kruskal', kind: kind, cursor: cursor, sorted: sortedView, status: Object.assign({}, status),
        groups: gr.list, comp: gr.comp, accepted: accepted.slice(), total: total,
        active: o.active || [], same: o.same === undefined ? null : o.same, need: n - 1,
        caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars,
        counters: { examined: examined, accepted: accepted.length, rejected: rejected, weight: total }
      };
      steps.push(s);
      return s;
    }
    function baseVars(e, ru, rv) {
      var v = { edge: e ? dash(e) : null, w: e ? e.w : null };
      v.ru = ru === undefined ? null : ru;
      v.rv = rv === undefined ? null : rv;
      v.kept = accepted.length + ' of ' + Math.max(0, n - 1);
      v.total = total;
      return v;
    }

    snap('init', {
      line: ['sort', 'init'], flow: 'init', vars: baseVars(null),
      caption: n === 0 ? 'Nothing to connect.' :
        'Sort the ' + plural(sorted.length, 'edge') + ' by weight, lightest first, and give every vertex its own component: ' + plural(n, 'component') + ' and an empty tree. From here on Kruskal only reads this sorted list, never the picture.'
    });

    var full = n <= 1;
    for (var i = 0; i < sorted.length && !full; i++) {
      var e = sorted[i], a = g.index[e.u], b = g.index[e.v];
      cursor = i;
      status[e.id] = 'considering';
      examined++;
      snap('pick', {
        line: 'loop', flow: 'next', active: [e.u, e.v], vars: baseVars(e),
        caption: 'Take the next edge from the list: <b>' + dash(e) + '</b>, weight <b>' + e.w + '</b>. Every lighter edge has already been judged, so this is the cheapest one left.'
      });
      var ra = uf.find(a), rb = uf.find(b), same = ra === rb;
      var A = g.ids[ra], B = g.ids[rb];
      snap('check', {
        line: 'check', flow: 'check', active: [e.u, e.v], same: same, vars: baseVars(e, A, B),
        caption: same
          ? '<code>find(' + e.u + ') = ' + A + '</code> and <code>find(' + e.v + ') = ' + B + '</code>: the same component. ' + e.u + ' and ' + e.v + ' are already connected, so this edge would only close a loop.'
          : '<code>find(' + e.u + ') = ' + A + '</code> but <code>find(' + e.v + ') = ' + B + '</code>: different components. ' + e.u + ' and ' + e.v + ' are not connected yet.'
      });
      if (same) {
        rejected++;
        status[e.id] = 'rejected';
        var path = pathNodes(acceptedEdges, e.u, e.v);
        snap('reject', {
          line: 'reject', flow: 'reject', active: [e.u, e.v], same: true, vars: baseVars(e, A, B),
          caption: 'Skip <b>' + dash(e) + '</b>. The tree already joins ' + e.u + ' to ' + e.v + (path ? ' through ' + path.join('–') : '') + ', so adding it closes a cycle, and every edge on that cycle is at most ' + e.w + ' (the others were cheaper).'
        });
      } else {
        uf.union(a, b);
        accepted.push(e.id); acceptedEdges.push(e); total += e.w;
        status[e.id] = 'accepted';
        var left = groups().list.length;
        snap('accept', {
          line: 'accept', flow: 'accept', active: [e.u, e.v], same: false, vars: baseVars(e, A, B),
          caption: 'Keep <b>' + dash(e) + '</b>. It is the lightest edge that leaves the component of ' + e.u + ' (or of ' + e.v + '), so nothing cheaper can connect them. Union the two components: ' + plural(left, 'component') + ' left, tree weight ' + total + '.'
        });
      }
      if (accepted.length === n - 1) full = true;
    }
    var comps = groups().list.length;
    var skipped = sorted.length - (cursor + 1);
    if (n > 0) {
      snap('done', {
        line: full ? 'stop' : 'done', flow: 'done', vars: baseVars(null),
        caption: full
          ? (n === 1 ? 'A single vertex is already a spanning tree of weight 0.' :
            plural(n - 1, 'edge') + ' kept, which is |V| − 1: every vertex is connected, so the tree is spanning' + (skipped > 0 ? '. The ' + plural(skipped, 'edge') + ' left in the list could only close cycles, so Kruskal never reads them' : '') + '. Total weight <b>' + total + '</b>.')
          : 'The list is used up but ' + plural(comps, 'component') + ' remain: the graph is not connected, so no spanning tree exists. What Kruskal built is a minimum spanning <em>forest</em>, weight <b>' + total + '</b>.'
      });
    }
    return steps;
  }

  /* ================================================================== Prim trace */
  function primTrace(G, start, opts) {
    opts = opts || {};
    var g = norm(G), n = g.ids.length;
    if (start === undefined || start === null || g.index[String(start)] === undefined) start = g.ids[0];
    start = String(start);
    var steps = [];
    if (!n) return steps;
    var inTree = {}, treeNodes = [], treeEdges = [], pq = [], seq = 0, total = 0, pushes = 0, pops = 0, popped = null, newNode = null;
    var status = {};
    g.edges.forEach(function (e) { status[e.id] = 'pending'; });

    function pqView() {
      return pq.map(function (x) { return { id: x.e.id, u: x.u, v: x.v, w: x.w, dead: !!inTree[x.v], key: x.e.id + '#' + x.seq }; });
    }
    var fixed = {};
    function refreshStatus() {
      var inq = {};
      pq.forEach(function (x) { inq[x.e.id] = inTree[x.v] ? 'dead' : 'queued'; });
      g.edges.forEach(function (e) { status[e.id] = fixed[e.id] || inq[e.id] || 'pending'; });
      if (popped) status[popped.e.id] = 'popped';
    }
    function snap(kind, o) {
      refreshStatus();
      var s = {
        algo: 'prim', kind: kind, start: start, tree: treeNodes.slice(), treeEdges: treeEdges.slice(), pq: pqView(),
        popped: popped ? { id: popped.e.id, u: popped.u, v: popped.v, w: popped.w, key: popped.e.id + '#' + popped.seq } : null,
        status: Object.assign({}, status), newNode: newNode, total: total,
        caption: o.caption, line: o.line, flow: o.flow,
        vars: {
          u: popped ? popped.u : null, v: popped ? popped.v : null, w: popped ? popped.w : null,
          tree: '{' + treeNodes.join(', ') + '}', queue: pq.length, total: total
        },
        counters: { intree: treeNodes.length, pushes: pushes, pops: pops, weight: total }
      };
      steps.push(s);
      return s;
    }
    function pushEdges(v) {
      var added = [];
      g.adj[v].forEach(function (a) {
        if (!inTree[a.to]) { pq.push({ e: a.e, u: v, v: a.to, w: a.w, seq: seq++ }); pushes++; added.push(a.e); }
      });
      pq.sort(pqCmp);
      return added;
    }

    inTree[start] = true; treeNodes.push(start); newNode = start;
    snap('init', {
      line: 'init', flow: 'init',
      caption: 'Start the tree at <b>' + start + '</b>. Prim grows one tree, and every round it adds the cheapest edge that leaves the tree. Right now the tree is just ' + start + ', weight 0.'
    });
    var added = pushEdges(start);
    snap('push', {
      line: 'seed', flow: 'push',
      caption: added.length
        ? 'Push every edge that leaves the tree into the priority queue: ' + added.map(function (e) { return dash(e) + ' (' + e.w + ')'; }).join(', ') + '. The queue keeps the lightest on top, so the cheapest way out is always one pop away.'
        : start + ' has no edges, so the queue stays empty and the tree cannot grow.'
    });
    newNode = null;

    while (pq.length && treeNodes.length < n) {
      var top = pq.shift();
      popped = top; pops++;
      snap('pop', {
        line: 'pop', flow: 'pop',
        caption: 'Pop the lightest edge in the queue: <b>' + top.u + '–' + top.v + '</b>, weight <b>' + top.w + '</b>. It leaves the tree at ' + top.u + ' and points at ' + top.v + '.'
      });
      if (inTree[top.v]) {
        fixed[top.e.id] = 'skipped';
        snap('skip', {
          line: 'skip', flow: 'skip',
          caption: top.v + ' is already in the tree: it joined earlier along a lighter edge, so this queue entry is stale. Adding ' + top.u + '–' + top.v + ' would close a cycle. Discard it.'
        });
        popped = null;
        continue;
      }
      inTree[top.v] = true; treeNodes.push(top.v); treeEdges.push(top.e.id); total += top.w; newNode = top.v;
      fixed[top.e.id] = 'tree';
      snap('add', {
        line: 'add', flow: 'add',
        caption: top.u + '–' + top.v + ' is the lightest edge crossing the cut between the tree and everything else, so it is safe. Add <b>' + top.v + '</b>: the tree now has ' + plural(treeNodes.length, 'vertex', 'vertices') + ' and weight ' + total + '.'
      });
      popped = null;
      var addedNow = treeNodes.length < n ? pushEdges(top.v) : [];
      if (treeNodes.length < n) {
        var dead = pq.filter(function (x) { return inTree[x.v]; }).length;
        snap('push', {
          line: 'push', flow: 'push',
          caption: addedNow.length
            ? 'New vertex ' + top.v + ' opens new ways out: push ' + addedNow.map(function (e) { return dash(e) + ' (' + e.w + ')'; }).join(', ') + '.' + (dead ? ' ' + plural(dead, 'entry', 'entries') + ' in the queue now ' + (dead === 1 ? 'points' : 'point') + ' inside the tree (dimmed): they are dead, but stay until they are popped.' : '')
            : top.v + ' has no edge to a vertex outside the tree, so nothing is pushed.' + (dead ? ' ' + plural(dead, 'dead entry', 'dead entries') + ' remain in the queue.' : '')
        });
      }
      newNode = null;
    }
    var deadLeft = pq.length;
    var complete = treeNodes.length === n;
    snap('done', {
      line: 'done', flow: 'done',
      caption: complete
        ? 'All ' + (n === 1 ? '1 vertex is' : n + ' vertices are') + ' in the tree: ' + plural(n - 1, 'edge') + ', total weight <b>' + total + '</b>.' + (deadLeft ? ' The ' + plural(deadLeft, 'entry', 'entries') + ' still in the queue are dead, so Prim stops without popping them.' : '')
        : 'The queue is empty but only ' + treeNodes.length + ' of ' + n + ' vertices are in the tree: ' + start + ' cannot reach the rest, so the graph is not connected. Prim gave the tree of ' + start + '’s component, weight <b>' + total + '</b>.'
    });
    return steps;
  }

  /* ================================================================== the cut property */
  /* side: array of node ids on one side. Returns {crossing, lightest, ties, valid, S, T}. */
  function cutInfo(G, side) {
    var g = norm(G), S = {}, ns = 0;
    (side || []).forEach(function (id) { if (g.index[String(id)] !== undefined && !S[id]) { S[id] = true; ns++; } });
    var T = g.ids.filter(function (id) { return !S[id]; });
    var valid = ns > 0 && T.length > 0;
    var crossing = g.edges.filter(function (e) { return !!S[e.u] !== !!S[e.v]; }).map(slim);
    var lightest = null, ties = 0;
    crossing.forEach(function (e) {
      if (!lightest || e.w < lightest.w) { lightest = e; ties = 1; } else if (e.w === lightest.w) ties++;
    });
    return { valid: valid, crossing: crossing, lightest: lightest, ties: ties, S: g.ids.filter(function (id) { return S[id]; }), T: T };
  }

  /* ================================================================== side by side */
  /* frames[k] = {k, kruskal: [ids accepted so far], prim: [...], kEdge, pEdge}, k = 0..n-1 (n = tree edges + 1) */
  function orderFrames(G, start) {
    var kr = kruskal(G), pr = prim(G, start);
    var kIds = kr.tree.map(function (e) { return e.id; }), pIds = pr.tree.map(function (e) { return e.id; });
    var m = Math.max(kIds.length, pIds.length), frames = [];
    for (var k = 0; k <= m; k++) {
      frames.push({
        k: k, kruskal: kIds.slice(0, k), prim: pIds.slice(0, k),
        kEdge: k > 0 ? kr.tree[k - 1] || null : null, pEdge: k > 0 ? pr.tree[k - 1] || null : null,
        kTotal: kr.tree.slice(0, k).reduce(function (s, e) { return s + e.w; }, 0),
        pTotal: pr.tree.slice(0, k).reduce(function (s, e) { return s + e.w; }, 0)
      });
    }
    return { frames: frames, kruskalOrder: kIds, primOrder: pIds, total: kr.total, primTotal: pr.total, sameEdges: sameSet(kIds, pIds) };
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = {};
    a.forEach(function (x) { s[x] = true; });
    return b.every(function (x) { return s[x]; });
  }

  /* ================================================================== the cycle property, as an algorithm */
  /* While a cycle exists, take a shortest one and drop its heaviest edge (ties: the later edge in input order).
     The edges that survive are a minimum spanning forest. */
  function shortestCycle(edges, ids) {
    // for each edge, shortest path between its ends avoiding it; the cycle is path + edge
    var best = null;
    edges.forEach(function (e) {
      var adj = {};
      edges.forEach(function (f) { if (f === e) return; (adj[f.u] = adj[f.u] || []).push({ to: f.v, e: f }); (adj[f.v] = adj[f.v] || []).push({ to: f.u, e: f }); });
      var prev = {}, seen = {}, q = [e.u];
      seen[e.u] = true;
      while (q.length && !seen[e.v]) {
        var x = q.shift();
        (adj[x] || []).forEach(function (a) { if (!seen[a.to]) { seen[a.to] = true; prev[a.to] = { from: x, e: a.e }; q.push(a.to); } });
      }
      if (!seen[e.v]) return;
      var cyc = [e], cur = e.v;
      while (cur !== e.u) { cyc.push(prev[cur].e); cur = prev[cur].from; }
      if (!best || cyc.length < best.length) best = cyc;
    });
    return best;
  }
  function cycleCut(G) {
    var g = norm(G), alive = g.edges.slice(), status = {}, steps = [], dropped = 0;
    g.edges.forEach(function (e) { status[e.id] = 'kept'; });
    function weight() { return alive.reduce(function (s, e) { return s + e.w; }, 0); }
    function snap(kind, cyc, heavy, caption, line) {
      var st = Object.assign({}, status);
      (cyc || []).forEach(function (e) { st[e.id] = 'cycle'; });
      if (heavy) st[heavy.id] = kind === 'drop' ? 'dropped' : 'heaviest';
      steps.push({
        algo: 'cycle', kind: kind, status: st, cycle: (cyc || []).map(function (e) { return e.id; }), heaviest: heavy ? heavy.id : null,
        alive: alive.map(function (e) { return e.id; }), total: weight(), dropped: dropped,
        caption: caption, line: line || null,
        counters: { edges: alive.length, dropped: dropped, weight: weight() }
      });
    }
    snap('init', null, null, 'Every road is still on the map: ' + plural(alive.length, 'edge') + ', total weight ' + weight() + '. The cycle property says any cycle can spare its heaviest edge. Keep finding cycles and dropping.');
    for (;;) {
      var cyc = shortestCycle(alive, g.ids);
      if (!cyc) break;
      var heavy = cyc[0];
      cyc.forEach(function (e) { if (e.w > heavy.w || (e.w === heavy.w && e.i > heavy.i)) heavy = e; });
      var names = cyc.slice().sort(function (a, b) { return a.w - b.w || a.i - b.i; }).map(function (e) { return dash(e) + ' (' + e.w + ')'; });
      snap('cycle', cyc, heavy, 'A cycle: ' + names.join(', ') + '. Its heaviest edge is <b>' + dash(heavy) + '</b> (' + heavy.w + '). Remove it and the other ' + (cyc.length - 1) + ' edges still join all of these vertices, so nothing is disconnected.');
      alive = alive.filter(function (e) { return e !== heavy; });
      status[heavy.id] = 'dropped'; dropped++;
      snap('drop', null, heavy, 'Drop <b>' + dash(heavy) + '</b>. The map is still connected wherever it was before, and ' + plural(alive.length, 'edge') + ' remain, total weight ' + weight() + '.');
    }
    snap('done', null, null, 'No cycles left, so what remains is a tree (a forest, if the graph was split): ' + plural(alive.length, 'edge') + ', total weight <b>' + weight() + '</b>. It is exactly what Kruskal and Prim build.');
    return { steps: steps, kept: alive.map(function (e) { return e.id; }), total: weight() };
  }

  /* ================================================================== MST clustering */
  /* Points -> complete graph with Euclidean distances (rounded to 0.1) -> MST -> cut the k-1 heaviest edges. */
  function pointsGraph(points) {
    var nodes = points.map(function (p, i) { return { id: p.id !== undefined ? String(p.id) : 'P' + i, x: p.x, y: p.y }; });
    var edges = [];
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) {
      var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      edges.push({ u: nodes[i].id, v: nodes[j].id, w: Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10 });
    }
    return { nodes: nodes, edges: edges };
  }
  function clusterSplit(G, k) {
    var g = norm(G), n = g.ids.length;
    var mst = kruskal(G).tree;   // in Kruskal's order: lightest first
    k = Math.max(1, Math.min(n, Math.floor(k) || 1));
    var keep = mst.slice(0, Math.max(0, mst.length - (k - 1)));
    var cut = mst.slice(keep.length);
    var uf = new UF(n);
    keep.forEach(function (e) { uf.union(g.index[e.u], g.index[e.v]); });
    var labels = {}, count = 0, assign = {}, sizes = [];
    g.ids.forEach(function (id, i) {
      var r = uf.find(i);
      if (labels[r] === undefined) { labels[r] = count++; sizes.push(0); }
      assign[id] = labels[r]; sizes[labels[r]]++;
    });
    return { k: count, assign: assign, sizes: sizes, keep: keep, cut: cut.slice().reverse(), mst: mst };
  }


  /* ================================================================== Borůvka: every component grabs its cheapest exit, in rounds */
  function boruvka(G) {
    var g = norm(G), n = g.ids.length, uf = new UF(n), rounds = [], tree = [], total = 0;
    function groups() {
      var by = {}, order = [];
      g.ids.forEach(function (id, i) { var r = uf.find(i); if (!by[r]) { by[r] = []; order.push(r); } by[r].push(id); });
      return order.map(function (r) { return by[r]; });
    }
    for (var guard = 0; guard < n + 2; guard++) {
      var best = {};
      g.edges.forEach(function (e) {
        var a = uf.find(g.index[e.u]), b = uf.find(g.index[e.v]);
        if (a === b) return;
        [a, b].forEach(function (c) {
          var cur = best[c];
          if (!cur || e.w < cur.w || (e.w === cur.w && e.i < cur.i)) best[c] = e;
        });
      });
      var picks = Object.keys(best).map(function (c) { return { comp: g.ids[+c], edge: best[c].id }; });
      if (!picks.length) break;
      var added = [];
      Object.keys(best).forEach(function (c) {
        var e = best[c];
        if (uf.union(g.index[e.u], g.index[e.v])) { added.push(e.id); tree.push(slim(e)); total += e.w; }
      });
      rounds.push({ picks: picks, added: added, groups: groups() });
    }
    return { rounds: rounds, tree: tree, total: total };
  }

  /* ================================================================== all spanning trees of a small graph */
  function spanningTrees(G, limit) {
    var g = norm(G), n = g.ids.length, m = g.edges.length, out = [], truncated = false;
    limit = limit || 3000;
    if (n === 0) return { count: 0, trees: [], truncated: false };
    function rec(i, chosen, uf) {
      if (out.length >= limit) { truncated = true; return; }
      if (chosen.length === n - 1) { out.push({ edges: chosen.map(function (e) { return e.id; }), weight: chosen.reduce(function (s, e) { return s + e.w; }, 0) }); return; }
      if (i >= m || m - i < n - 1 - chosen.length) return;
      var e = g.edges[i], a = g.index[e.u], b = g.index[e.v];
      var copy = new UF(n);
      copy.p = uf.p.slice();
      if (copy.union(a, b)) rec(i + 1, chosen.concat([e]), copy);
      rec(i + 1, chosen, uf);
    }
    rec(0, [], new UF(n));
    return { count: out.length, trees: out, truncated: truncated };
  }

  /* ================================================================== operation counts */
  function makeHeap() {
    var a = [], cmp = 0;
    function less(x, y) { cmp++; return x[0] < y[0] || (x[0] === y[0] && x[3] < y[3]); }
    return {
      size: function () { return a.length; },
      cmps: function () { return cmp; },
      push: function (x) {
        a.push(x);
        var i = a.length - 1;
        while (i > 0) { var p = (i - 1) >> 1; if (less(a[i], a[p])) { var t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break; }
      },
      pop: function () {
        var top = a[0], last = a.pop();
        if (a.length) {
          a[0] = last;
          var i = 0, n = a.length;
          for (;;) {
            var l = 2 * i + 1, r = l + 1, m = i;
            if (l < n && less(a[l], a[m])) m = l;
            if (r < n && less(a[r], a[m])) m = r;
            if (m === i) break;
            var t = a[i]; a[i] = a[m]; a[m] = t; i = m;
          }
        }
        return top;
      }
    };
  }
  /* Counts key comparisons (sort and heap) plus union-find pointer hops, on a connected graph with V vertices. */
  function measure(V, E, rng) {
    var G = randomGraph(V, E, rng), g = norm(G), n = g.ids.length;
    // Kruskal: sort comparisons + find hops (until V-1 edges are kept)
    var sortCmp = 0;
    var sorted = g.edges.slice().sort(function (a, b) { sortCmp++; return a.w - b.w || a.i - b.i; });
    var uf = new UF(n), kept = 0;
    for (var i = 0; i < sorted.length && kept < n - 1; i++) {
      if (uf.union(g.index[sorted[i].u], g.index[sorted[i].v])) kept++;
    }
    // Prim with a binary heap (lazy)
    var heap = makeHeap(), inT = {}, cnt = 1, seq = 0, s0 = g.ids[0];
    inT[s0] = true;
    g.adj[s0].forEach(function (a) { heap.push([a.w, s0, a.to, seq++]); });
    while (heap.size() && cnt < n) {
      var top = heap.pop();
      if (inT[top[2]]) continue;
      inT[top[2]] = true; cnt++;
      g.adj[top[2]].forEach(function (a) { if (!inT[a.to]) heap.push([a.w, top[2], a.to, seq++]); });
    }
    // Prim with plain arrays: scan every vertex for the smallest key, then relax its edges
    var key = {}, done = {}, arr = 0;
    g.ids.forEach(function (id) { key[id] = Infinity; });
    key[s0] = 0;
    for (var r = 0; r < n; r++) {
      var best = null;
      for (var j = 0; j < n; j++) { var id = g.ids[j]; if (!done[id]) { arr++; if (best === null || key[id] < key[best]) best = id; } }
      done[best] = true;
      g.adj[best].forEach(function (a) { arr++; if (!done[a.to] && a.w < key[a.to]) key[a.to] = a.w; });
    }
    return { V: n, E: g.edges.length, kruskal: sortCmp + uf.hops, kruskalSort: sortCmp, kruskalHops: uf.hops, primHeap: heap.cmps() + 0, primArray: arr, kept: kept, reached: cnt };
  }
  function randomGraph(V, E, rng) {
    V = Math.max(1, Math.floor(V));
    var maxE = V * (V - 1) / 2;
    E = Math.max(V - 1, Math.min(Math.floor(E), maxE));
    var nodes = [], edges = [], seen = {}, i;
    for (i = 0; i < V; i++) nodes.push({ id: 'V' + i });
    function add(a, b) {
      var k = a < b ? a + '-' + b : b + '-' + a;
      if (a === b || seen[k]) return false;
      seen[k] = true; edges.push({ u: 'V' + a, v: 'V' + b, w: rng.int(1, 999) });
      return true;
    }
    for (i = 1; i < V; i++) add(rng.int(0, i - 1), i);
    var guard = 0;
    while (edges.length < E && guard++ < E * 60) add(rng.int(0, V - 1), rng.int(0, V - 1));
    if (edges.length < E) for (var a = 0; a < V && edges.length < E; a++) for (var b = a + 1; b < V && edges.length < E; b++) add(a, b);
    return { nodes: nodes, edges: edges };
  }

  /* ================================================================== parsing */
  /* "A-B:4, B-C:2, D" -> nodes in order of appearance, edges {u, v, w}. Weights: whole numbers -99..99. */
  function parseEdges(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.nodes, maxEdges = opts.maxEdges || LIMITS.edges;
    var src = String(text === undefined || text === null ? '' : text).trim();
    if (!src) return { values: null, error: 'Type at least one edge with its weight, for example A-B:4, B-C:2.' };
    var tokens = src.split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    var nodes = [], seenN = {}, edges = [], seenE = {};
    function addNode(x) { if (!seenN[x]) { seenN[x] = true; nodes.push(x); } }
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var m = /^([A-Za-z0-9]{1,3})\s*(?:-|–|—)\s*([A-Za-z0-9]{1,3})\s*(?:[:=\s]\s*(-?\d+(?:\.\d+)?))?$/.exec(t);
      if (!m) {
        if (/^[A-Za-z0-9]{1,3}$/.test(t)) { addNode(t.toUpperCase()); continue; }
        return { values: null, error: '“' + t + '” is not an edge. Write two vertex names (up to 3 letters or digits) and a weight, like A-B:4.' };
      }
      var u = m[1].toUpperCase(), v = m[2].toUpperCase();
      if (u === v) return { values: null, error: '“' + t + '” joins a vertex to itself. A loop can never be in a spanning tree, so leave it out.' };
      if (m[3] === undefined) return { values: null, error: '“' + t + '” has no weight. Add one after a colon, like ' + u + '-' + v + ':4.' };
      var w = parseFloat(m[3]);
      if (Math.floor(w) !== w) return { values: null, error: 'Weights are whole numbers here; “' + m[3] + '” is not.' };
      if (w < LIMITS.minW || w > LIMITS.maxW) return { values: null, error: 'Weight ' + w + ' is out of range. Use whole numbers from ' + LIMITS.minW + ' to ' + LIMITS.maxW + '.' };
      var k = edgeKey(u, v);
      if (seenE[k]) return { values: null, error: 'The edge ' + u + '-' + v + ' appears twice. Keep only the lighter one: a heavier parallel edge is never needed.' };
      seenE[k] = true;
      addNode(u); addNode(v);
      edges.push({ u: u, v: v, w: w });
    }
    if (!edges.length) return { values: null, error: 'Add at least one edge with a weight, for example A-B:4.' };
    if (nodes.length > maxNodes) return { values: null, error: 'That is ' + nodes.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges }, error: null };
  }
  function toText(G) {
    var used = {};
    var parts = (G.edges || []).map(function (e) { used[e.u] = used[e.v] = true; return e.u + '-' + e.v + ':' + e.w; });
    (G.nodes || []).forEach(function (n) { var id = typeof n === 'object' ? n.id : n; if (!used[id]) parts.push(id); });
    return parts.join(', ');
  }

  return {
    LIMITS: LIMITS, edgeKey: edgeKey, norm: norm, sortEdges: sortEdges, UF: UF,
    kruskal: kruskal, prim: prim, kruskalTrace: kruskalTrace, primTrace: primTrace,
    cutInfo: cutInfo, orderFrames: orderFrames, cycleCut: cycleCut,
    boruvka: boruvka, spanningTrees: spanningTrees, pointsGraph: pointsGraph, clusterSplit: clusterSplit,
    measure: measure, randomGraph: randomGraph, pathInTree: pathInTree,
    parseEdges: parseEdges, toText: toText
  };
}));
