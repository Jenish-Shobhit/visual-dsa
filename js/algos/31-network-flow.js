/* Lesson 31 · Max flow & min cut — pure step generators (no DOM).

   Browser: VDSA.algos.networkFlow.  Node: module.exports.

     var NF = VDSA.algos.networkFlow;
     NF.trace(net, {strategy, reverse, forced, detail})   Ford-Fulkerson / Edmonds-Karp, one step per idea
     NF.maxFlow(net, opts)                                 the same run without steps: {value, rounds, scans, flow, cut, paths}
     NF.residual(net, flow)                                merged residual arcs, for drawing the residual graph
     NF.cutValue(net, S)                                   capacity of the cut (S, V - S)
     NF.matchingNetwork(pairs)                             workers ↔ jobs as a unit-capacity flow network
     NF.assignments(net, fl)                               the matched (worker, job) pairs of a flow
     NF.parseNetwork(text, opts)                           "s-a:10, s-b:5, a-t:7" -> {values: net, error}

   Network input: {nodes: ['s', 'a'] | [{id, x, y}], edges: [{from, to, cap}] | [[from, to, cap]], source: 's', sink: 't'}.
   Parallel edges (same ordered pair) are merged by adding their capacities. Antiparallel edges (a→b and b→a) stay
   separate edges, each with its own capacity and flow.

   Residual graph: every edge u→v with flow f and capacity c gives a forward arc u→v with room c - f and a reverse arc
   v→u with room f (the flow you could take back). The search walks arcs in edge order, so every trace is deterministic.

   Options of trace():
     strategy  'bfs' (default, Edmonds-Karp: fewest arcs first) | 'dfs' (a Ford-Fulkerson with an arbitrary path)
     reverse   false: ignore reverse arcs (the "greedy" algorithm that can never undo a push)
     forced    [[node ids], ...] first paths to use, or a function (round, ctx) -> node path | null
     detail    'full' (BFS shows every dequeue) | 'rounds' (one step per path) | 'none' (no steps, result only)

   Every step: {kind, caption (why), line (code label), flow (flowchart node id), vars, counters (same keys on every
   step), fl {edgeId: flow}, value, round, states {node: state}, queue, path [arc], bottleneck, cut, ...}.
   An arc is {from, to, edge (edge id), dir 'fwd' | 'back', res (room when it was chosen)}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.networkFlow = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 10, maxEdges: 24, maxCap: 99 };

  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function edgeId(from, to) { return String(from) + '-' + String(to); }

  /* ================================================================== the network */

  /* normalize(net) -> {ids, label, edges: [{id, from, to, cap, index}], byId, source, sink, positions}
     Throws Error with a friendly message for a network that is not a flow network. */
  function normalize(net) {
    if (!net) throw new Error('No network given.');
    var ids = [], seen = {}, pos = {}, label = {};
    function add(id, n) {
      id = String(id);
      if (!seen[id]) { seen[id] = true; ids.push(id); }
      if (n && typeof n === 'object') {
        if (typeof n.x === 'number') pos[id] = { x: n.x, y: n.y };
        if (n.label !== undefined) label[id] = n.label;
      }
    }
    (net.nodes || []).forEach(function (n) { add(n !== null && typeof n === 'object' ? n.id : n, n); });
    var edges = [], byId = {};
    (net.edges || []).forEach(function (e) {
      var from = String(Array.isArray(e) ? e[0] : e.from), to = String(Array.isArray(e) ? e[1] : e.to);
      var cap = Array.isArray(e) ? e[2] : e.cap;
      if (typeof cap !== 'number' || !isFinite(cap) || cap < 0 || Math.floor(cap) !== cap) throw new Error('Capacity of ' + from + ' to ' + to + ' must be a whole number, 0 or more.');
      if (from === to) throw new Error('An edge from ' + from + ' to itself carries no flow.');
      add(from); add(to);
      var id = edgeId(from, to);
      if (byId[id]) { byId[id].cap += cap; return; }
      var rec = { id: id, from: from, to: to, cap: cap, index: edges.length };
      edges.push(rec); byId[id] = rec;
    });
    var source = String(net.source === undefined ? 's' : net.source), sink = String(net.sink === undefined ? 't' : net.sink);
    if (!seen[source]) throw new Error('The source ' + source + ' is not in the network.');
    if (!seen[sink]) throw new Error('The sink ' + sink + ' is not in the network.');
    if (source === sink) throw new Error('The source and the sink must be different vertices.');
    return { ids: ids, label: label, edges: edges, byId: byId, source: source, sink: sink, positions: pos };
  }

  /* Arcs of the residual graph, per vertex, in edge order. */
  function buildArcs(N) {
    var adj = {}, arcs = [];
    N.ids.forEach(function (id) { adj[id] = []; });
    N.edges.forEach(function (e) {
      var fwd = { from: e.from, to: e.to, edge: e.index, dir: 'fwd' };
      var back = { from: e.to, to: e.from, edge: e.index, dir: 'back' };
      arcs.push(fwd, back);
      adj[e.from].push(fwd);
      adj[e.to].push(back);
    });
    return { adj: adj, arcs: arcs };
  }

  function room(N, f, arc) { var e = N.edges[arc.edge]; return arc.dir === 'fwd' ? e.cap - f[arc.edge] : f[arc.edge]; }
  function arcOut(N, f, arc) { return { from: arc.from, to: arc.to, edge: N.edges[arc.edge].id, dir: arc.dir, res: room(N, f, arc) }; }

  function flowValue(N, f) {
    var v = 0;
    N.edges.forEach(function (e) { if (e.from === N.source) v += f[e.index]; if (e.to === N.source) v -= f[e.index]; });
    return v;
  }

  /* residual(net, fl) -> [{from, to, res, fwd, back}]: one entry per ordered pair with room, merging parallel arcs.
     `back` is true when every unit of room on the pair comes from reverse arcs (nothing forward: draw it dashed). */
  function residual(net, fl) {
    var N = net.byId ? net : normalize(net);
    var pairs = {}, order = [];
    N.edges.forEach(function (e) {
      var g = fl ? (fl[e.id] || 0) : 0;
      [[e.from, e.to, e.cap - g, true], [e.to, e.from, g, false]].forEach(function (a) {
        if (a[2] <= 0) return;
        var k = edgeId(a[0], a[1]);
        if (!pairs[k]) { pairs[k] = { from: a[0], to: a[1], res: 0, fwd: 0, back: 0 }; order.push(k); }
        pairs[k].res += a[2];
        if (a[3]) pairs[k].fwd += a[2]; else pairs[k].back += a[2];
      });
    });
    return order.map(function (k) { var p = pairs[k]; p.reverseOnly = p.fwd === 0; return p; });
  }

  function cutValue(net, S) {
    var N = net.byId ? net : normalize(net);
    var inS = {};
    S.forEach(function (id) { inS[String(id)] = true; });
    var v = 0;
    N.edges.forEach(function (e) { if (inS[e.from] && !inS[e.to]) v += e.cap; });
    return v;
  }
  function cutEdges(net, S) {
    var N = net.byId ? net : normalize(net);
    var inS = {};
    S.forEach(function (id) { inS[String(id)] = true; });
    return N.edges.filter(function (e) { return inS[e.from] && !inS[e.to]; }).map(function (e) { return e.id; });
  }

  /* ================================================================== path finders */

  function pathText(N, nodes) { return nodes.map(function (id) { return N.label[id] !== undefined ? N.label[id] : id; }).join(' → '); }
  function nm(N, id) { return N.label[id] !== undefined ? N.label[id] : id; }

  /* A path given as node ids -> arcs (forward arc preferred), or null when a hop has no room. */
  function arcsForNodes(N, A, f, nodes, useRev) {
    var out = [];
    for (var i = 0; i + 1 < nodes.length; i++) {
      var pick = null;
      A.adj[nodes[i]].forEach(function (arc) {
        if (arc.to !== nodes[i + 1] || room(N, f, arc) <= 0) return;
        if (arc.dir === 'back' && !useRev) return;
        if (!pick || (pick.dir === 'back' && arc.dir === 'fwd')) pick = arc;
      });
      if (!pick) return null;
      out.push(pick);
    }
    return out;
  }

  /* ================================================================== the run */

  /* trace(net, opts) -> steps (or, with detail 'none', a result object; see maxFlow) */
  function trace(input, opts) {
    opts = opts || {};
    var N = normalize(input), A = buildArcs(N);
    var s = N.source, t = N.sink;
    var strategy = opts.strategy === 'dfs' ? 'dfs' : 'bfs';
    var useRev = opts.reverse !== false;
    var detail = opts.detail || 'full';
    var want = detail !== 'none';
    var full = detail === 'full' && strategy === 'bfs';
    var maxRounds = opts.maxRounds || 5000;
    var f = N.edges.map(function () { return 0; });
    var value = 0, rounds = 0, pushes = 0, scans = 0, steps = [], paths = [], cut = null;
    var algoName = strategy === 'bfs' ? (useRev ? 'edmonds-karp' : 'greedy') : (useRev ? 'ford-fulkerson' : 'greedy');

    function flowMap() { var m = {}; N.edges.forEach(function (e) { m[e.id] = f[e.index]; }); return m; }
    function baseStates() { var m = {}; N.ids.forEach(function (id) { m[id] = 'default'; }); return m; }
    function snap(kind, o) {
      if (!want) return;
      o = o || {};
      var st = {
        algo: algoName, kind: kind, round: o.round === undefined ? rounds : o.round,
        caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow || null,
        fl: flowMap(), value: value,
        states: o.states || baseStates(), queue: o.queue || [], current: o.current === undefined ? null : o.current,
        found: o.found || [], path: o.path || null, pathNodes: o.pathNodes || null,
        bottleneck: o.bottleneck === undefined ? null : o.bottleneck, bottleArc: o.bottleArc === undefined ? -1 : o.bottleArc,
        cut: o.cut || null, pushed: o.pushed || null, level: o.level || null, source: s, sink: t,
        counters: { augmentations: pushes, value: value, scans: scans },
        vars: o.vars || { value: value }
      };
      steps.push(st);
    }
    function queueVar(q) { return q.map(function (id) { return nm(N, id); }); }
    function rawList(list) { return '[' + list.join(', ') + ']'; }

    snap('init', {
      round: 0, flow: 'init', line: 'init',
      caption: 'Every pipe starts empty: flow 0 on all ' + N.edges.length + ' edges, total value 0. The goal is the largest value that fits through without breaking two rules. No pipe may carry more than its capacity, and every vertex except ' + b(nm(N, s)) + ' and ' + b(nm(N, t)) + ' must pass on exactly what it receives.',
      vars: { value: 0 }
    });

    /* ---- BFS over residual arcs; returns {arcs: [...], nodes: [...]} or {reach} when t is unreachable */
    function bfsSearch(attempt) {
      var parent = {}, level = {}, queue = [s], order = [], reach = {};
      level[s] = 0; reach[s] = true;
      var states = baseStates();
      states[s] = 'frontier';
      if (full) {
        snap('search', {
          round: rounds, flow: 'bfs', line: 'bfs', states: copyStates(states), queue: queue.slice(), level: copyStates(level),
          caption: 'Round ' + attempt + '. Look for a route from ' + b(nm(N, s)) + ' to ' + b(nm(N, t)) + ' that still has room, walking only arcs of the residual graph with room above 0. A queue makes the search fan out ring by ring, so the first route it finds uses the fewest arcs.',
          vars: { value: value, round: attempt, queue: V(rawList(queueVar(queue))) }
        });
      }
      while (queue.length) {
        var u = queue.shift();
        order.push(u);
        var newly = [], hitT = false, look = 0;
        for (var i = 0; i < A.adj[u].length && !hitT; i++) {
          var arc = A.adj[u][i];
          if (arc.dir === 'back' && !useRev) continue;
          scans++; look++;
          var r = room(N, f, arc);
          if (r > 0 && level[arc.to] === undefined) {
            level[arc.to] = level[u] + 1; parent[arc.to] = arc; reach[arc.to] = true;
            queue.push(arc.to);
            newly.push(arcOut(N, f, arc));
            if (arc.to === t) hitT = true;
          }
        }
        if (full) {
          states[u] = 'visited';
          queue.forEach(function (id) { if (states[id] !== 'visited') states[id] = 'frontier'; });
          var st2 = copyStates(states);
          st2[u] = 'active';
          var desc;
          if (!newly.length) desc = 'Take ' + b(nm(N, u)) + ' off the front of the queue. None of its arcs leads anywhere new with room left, so it adds nothing.';
          else desc = 'Take ' + b(nm(N, u)) + ' off the front of the queue and scan its arcs. ' + newly.map(function (a) { return b(nm(N, a.to)) + ' is new (room ' + a.res + (a.dir === 'back' ? ', a reverse arc' : '') + ')'; }).join('; ') + ', so ' + (newly.length > 1 ? 'they join' : 'it joins') + ' the queue.';
          if (hitT) desc += ' ' + b(nm(N, t)) + ' has been reached, so BFS can stop.';
          snap(hitT ? 'reach' : 'dequeue', {
            round: rounds, flow: 'bfs', line: 'bfs', states: st2, queue: queue.slice(), current: u, found: newly, level: copyStates(level),
            caption: desc,
            vars: { value: value, round: attempt, u: V(nm(N, u)), queue: V(rawList(queueVar(queue))) }
          });
        }
        if (hitT) break;
      }
      if (parent[t] === undefined) return { reach: reach, order: order, level: level };
      var arcs = [], nodes = [t], at = t;
      while (at !== s) { var pa = parent[at]; arcs.unshift(pa); at = pa.from; nodes.unshift(at); }
      return { arcs: arcs, nodes: nodes, level: level, reach: reach, order: order };
    }

    function dfsSearch() {
      var parent = {}, seen = {}, stack = [s], reach = {}, order = [];
      seen[s] = true; reach[s] = true;
      // iterative DFS: explore each vertex's arcs in order, depth first
      var idx = {};
      N.ids.forEach(function (id) { idx[id] = 0; });
      while (stack.length) {
        var u = stack[stack.length - 1];
        if (u === t) break;
        if (idx[u] >= A.adj[u].length) { stack.pop(); continue; }
        var arc = A.adj[u][idx[u]++];
        if (arc.dir === 'back' && !useRev) continue;
        scans++;
        if (room(N, f, arc) > 0 && !seen[arc.to]) { seen[arc.to] = true; reach[arc.to] = true; parent[arc.to] = arc; stack.push(arc.to); order.push(arc.to); }
      }
      if (!seen[t]) return { reach: reach, order: order };
      var arcs = [], nodes = [t], at = t;
      while (at !== s) { var pa = parent[at]; arcs.unshift(pa); at = pa.from; nodes.unshift(at); }
      return { arcs: arcs, nodes: nodes, reach: reach, order: order };
    }

    function forcedPath(attempt) {
      var fp = opts.forced, nodes = null, isFn = typeof fp === 'function';
      if (isFn) nodes = fp(attempt, { flow: flowMap(), value: value });
      else if (Array.isArray(fp) && attempt <= fp.length) nodes = fp[attempt - 1];
      if (!nodes) return null;
      var arcs = arcsForNodes(N, A, f, nodes.map(String), useRev);
      if (!arcs) {
        if (isFn) return null;
        throw new Error('Forced path ' + nodes.join(' → ') + ' is not an augmenting path in round ' + attempt + '.');
      }
      return { arcs: arcs, nodes: nodes.map(String), forced: true };
    }

    function copyStates(m) { var o = {}; for (var k in m) o[k] = m[k]; return o; }
    function V(x) { return { __raw: x }; }

    while (rounds < maxRounds) {
      var attempt = rounds + 1;
      var found = forcedPath(attempt);
      if (!found) found = strategy === 'dfs' ? dfsSearch() : bfsSearch(attempt);
      if (!found.arcs) {
        // no augmenting path: flow is maximum; the vertices the search reached form the source side of a minimum cut
        var S = N.ids.filter(function (id) { return found.reach[id]; });
        var cst = baseStates();
        S.forEach(function (id) { cst[id] = 'visited'; });
        snap('nopath', {
          round: rounds, flow: 'found', line: 'nopath', states: cst,
          caption: (full ? 'The queue ran empty without ever reaching ' : 'The search ran out of arcs with room without reaching ') + b(nm(N, t)) + '. No augmenting path exists, so nothing more can be pushed: the flow of ' + b(value) + ' is the maximum. The vertices the search did reach, call them <b>R</b>, are ' + S.map(function (id) { return b(nm(N, id)); }).join(', ') + '.',
          vars: { value: value, round: attempt, R: V(rawList(S.map(function (id) { return nm(N, id); }))) }
        });
        var edgesCut = cutEdges(N, S), cv = cutValue(N, S);
        var T = N.ids.filter(function (id) { return !found.reach[id]; });
        var cs2 = baseStates();
        S.forEach(function (id) { cs2[id] = 'frontier'; });
        cut = { S: S, T: T, edges: edgesCut, value: cv, caps: edgesCut.map(function (id) { return N.byId[id].cap; }) };
        snap('cut', {
          round: rounds, flow: 'cut', line: 'cut', states: cs2, cut: cut,
          caption: 'Split the vertices into R, the set that ' + b(nm(N, s)) + ' can still reach, and the rest. Every edge from R to the other side is full, and their capacities add up to ' + b(cut.caps.join(' + ') + (cut.caps.length > 1 ? ' = ' + cv : '')) + ', exactly the flow. That is the max-flow min-cut theorem: the bottleneck is a cut of the same size.',
          vars: { value: value, R: V(rawList(S.map(function (id) { return nm(N, id); }))), 'cut capacity': cv }
        });
        break;
      }
      rounds++;
      var arcs = found.arcs.map(function (a) { return arcOut(N, f, a); });
      var minRes = Infinity, minAt = -1;
      arcs.forEach(function (a, i) { if (a.res < minRes) { minRes = a.res; minAt = i; } });
      var pst = baseStates();
      found.nodes.forEach(function (id) { pst[id] = 'path'; });
      var hops = arcs.length;
      var how = found.forced ? 'This route is chosen for you, to make a point.' : strategy === 'bfs' ? 'BFS found it, so no route with fewer arcs exists.' : 'A depth-first search found it: it is a valid route, but not necessarily a short one.';
      var uses = arcs.filter(function (a) { return a.dir === 'back'; });
      var pcap = 'Augmenting path ' + b(pathText(N, found.nodes)) + ' (' + hops + ' arc' + (hops > 1 ? 's' : '') + '). ' + how +
        (uses.length ? ' Its hop ' + b(nm(N, uses[0].from) + ' → ' + nm(N, uses[0].to)) + ' runs backward along the edge ' + nm(N, uses[0].to) + ' → ' + nm(N, uses[0].from) + ': it takes flow back.' : '');
      paths.push(found.nodes.slice());
      snap('path', {
        round: rounds, flow: 'found', line: 'bfs', states: pst, path: arcs, pathNodes: found.nodes,
        caption: pcap,
        vars: { value: value, round: rounds, path: V(rawList(found.nodes.map(function (id) { return nm(N, id); }))) }
      });
      var roomList = arcs.map(function (a) { return a.res; });
      snap('bottleneck', {
        round: rounds, flow: 'bottleneck', line: 'bottleneck', states: pst, path: arcs, pathNodes: found.nodes, bottleneck: minRes, bottleArc: minAt,
        caption: 'The room along the path is ' + roomList.join(', ') + '. The path can carry only as much as its tightest arc, so the bottleneck is ' + b('min(' + roomList.join(', ') + ') = ' + minRes) + ', on ' + b(nm(N, arcs[minAt].from) + ' → ' + nm(N, arcs[minAt].to)) + '. Pushing more would overfill that pipe; pushing less wastes room.',
        vars: { value: value, round: rounds, path: V(rawList(found.nodes.map(function (id) { return nm(N, id); }))), b: minRes }
      });
      found.arcs.forEach(function (a) { f[a.edge] += a.dir === 'fwd' ? minRes : -minRes; });
      var before = value;
      value = flowValue(N, f);
      pushes++;
      var backs = arcs.filter(function (a) { return a.dir === 'back'; });
      snap('push', {
        round: rounds, flow: 'augment', line: ['augment', 'value'], states: pst, path: arcs, pathNodes: found.nodes, bottleneck: minRes, bottleArc: minAt, pushed: arcs,
        caption: 'Push ' + b(minRes) + ' along the path: forward arcs gain ' + minRes + ' flow' + (backs.length ? ', and the reverse hop cancels ' + minRes + ' of the flow on ' + backs.map(function (a) { return b(nm(N, a.to) + ' → ' + nm(N, a.from)); }).join(', ') + ' (an earlier choice is undone)' : '') + '. The total rises from ' + before + ' to ' + b(value) + '. Conservation still holds at every vertex on the path: what comes in goes out.',
        vars: { value: value, round: rounds, path: V(rawList(found.nodes.map(function (id) { return nm(N, id); }))), b: minRes }
      });
    }

    var result = { value: value, rounds: rounds, scans: scans, flow: flowMap(), cut: cut, paths: paths, algo: algoName, capped: rounds >= maxRounds };
    if (!want) {
      if (!cut) {
        // maxRounds hit: no cut computed
        result.cut = null;
      }
      return result;
    }
    steps.result = result;
    return steps;
  }

  /* Without steps: {value, rounds, scans, flow, cut: {S, T, edges, value}, paths}. */
  function maxFlow(net, opts) {
    var o = {};
    for (var k in (opts || {})) o[k] = opts[k];
    o.detail = 'none';
    var r = trace(net, o);
    if (!r.cut) {
      // maxRounds cut the run short: no minimum cut to report
      r.cut = null;
    }
    return r;
  }

  /* ================================================================== parsing */

  /* parseNetwork("s-a:10, s-b:5, a-t:7") -> {values: {nodes, edges, source: 's', sink: 't'}, error}
     Edges are u-v:capacity (also u->v 10, u>v=10). Names are letters, digits and underscores. The source must be
     called s and the sink t. */
  function parseNetwork(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.maxNodes, maxEdges = opts.maxEdges || LIMITS.maxEdges, maxCap = opts.maxCap || LIMITS.maxCap;
    var src = String(text === undefined || text === null ? '' : text).trim();
    if (!src) return { values: null, error: 'Type some pipes, for example s-a:10, s-b:5, a-t:7, b-t:8.' };
    var parts = src.split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    var ids = [], seen = {}, edges = [], keys = {};
    for (var i = 0; i < parts.length; i++) {
      var m = /^([A-Za-z0-9_]+)\s*(?:->|→|-|>)\s*([A-Za-z0-9_]+)\s*(?::|=|\s)\s*(\d+)$/.exec(parts[i]);
      if (!m) return { values: null, error: '“' + parts[i] + '” is not a pipe. Write it as from-to:capacity, like a-b:5.' };
      var u = m[1], v = m[2], cap = parseInt(m[3], 10);
      if (u === v) return { values: null, error: 'A pipe from ' + u + ' to itself carries nothing. Remove it.' };
      if (cap < 1) return { values: null, error: 'A capacity of 0 is a missing pipe. Use 1 or more (or leave the pipe out).' };
      if (cap > maxCap) return { values: null, error: 'Capacity ' + cap + ' is too large. Keep every capacity at ' + maxCap + ' or less.' };
      [u, v].forEach(function (id) { if (!seen[id]) { seen[id] = true; ids.push(id); } });
      var k = u + '-' + v;
      if (keys[k]) { keys[k][2] += cap; if (keys[k][2] > maxCap) return { values: null, error: 'The pipes ' + k + ' add up to more than ' + maxCap + '.' }; continue; }
      keys[k] = [u, v, cap];
      edges.push(keys[k]);
    }
    if (!seen.s) return { values: null, error: 'Name the source s: at least one pipe must start or end at s.' };
    if (!seen.t) return { values: null, error: 'Name the sink t: at least one pipe must start or end at t.' };
    if (ids.length > maxNodes) return { values: null, error: 'That is ' + ids.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' pipes. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: ids, edges: edges.map(function (e) { return { from: e[0], to: e[1], cap: e[2] }; }), source: 's', sink: 't' }, error: null };
  }

  /* ================================================================== bipartite matching as flow */

  /* matchingNetwork(pairs, {left, right}) -> {net, workers, jobs}
     pairs: [[worker, job], ...]. Node ids: 's', 't', 'w:NAME', 'j:NAME'; labels are the plain names.
     Every edge has capacity 1: a worker takes at most one job and a job at most one worker. */
  function matchingNetwork(pairs, opts) {
    opts = opts || {};
    var workers = opts.workers ? opts.workers.slice() : [], jobs = opts.jobs ? opts.jobs.slice() : [];
    var seenW = {}, seenJ = {};
    workers.forEach(function (w) { seenW[w] = true; });
    jobs.forEach(function (j) { seenJ[j] = true; });
    pairs.forEach(function (p) {
      var w = String(p[0]), j = String(p[1]);
      if (!seenW[w]) { seenW[w] = true; workers.push(w); }
      if (!seenJ[j]) { seenJ[j] = true; jobs.push(j); }
    });
    var W = 1000, H = 600, rows = Math.max(workers.length, jobs.length, 2);
    function ys(n) {
      var pad = 70, span = H - 2 * pad;
      return function (i) { return n === 1 ? H / 2 : pad + span * i / (n - 1); };
    }
    var yw = ys(workers.length), yj = ys(jobs.length);
    var nodes = [{ id: 's', x: 70, y: H / 2, label: 's' }];
    workers.forEach(function (w, i) { nodes.push({ id: 'w:' + w, x: 330, y: yw(i), label: w }); });
    jobs.forEach(function (j, i) { nodes.push({ id: 'j:' + j, x: 670, y: yj(i), label: j }); });
    nodes.push({ id: 't', x: 930, y: H / 2, label: 't' });
    var edges = [];
    workers.forEach(function (w) { edges.push({ from: 's', to: 'w:' + w, cap: 1 }); });
    var uniq = {};
    pairs.forEach(function (p) {
      var k = p[0] + '|' + p[1];
      if (uniq[k]) return;
      uniq[k] = true;
      edges.push({ from: 'w:' + p[0], to: 'j:' + p[1], cap: 1 });
    });
    jobs.forEach(function (j) { edges.push({ from: 'j:' + j, to: 't', cap: 1 }); });
    void W; void rows;
    return { net: { nodes: nodes, edges: edges, source: 's', sink: 't' }, workers: workers, jobs: jobs };
  }

  /* assignments(net, fl) -> [[worker name, job name]] for the middle edges that carry flow. */
  function assignments(net, fl) {
    var out = [];
    (net.edges || []).forEach(function (e) {
      var from = Array.isArray(e) ? e[0] : e.from, to = Array.isArray(e) ? e[1] : e.to;
      if (String(from).indexOf('w:') === 0 && String(to).indexOf('j:') === 0 && fl[edgeId(from, to)] > 0) out.push([String(from).slice(2), String(to).slice(2)]);
    });
    return out;
  }

  /* ================================================================== helpers for figures and tests */

  /* Feasibility check of a flow map: capacity and conservation. Returns null or a message. */
  function checkFlow(net, fl) {
    var N = net.byId ? net : normalize(net), bal = {};
    N.ids.forEach(function (id) { bal[id] = 0; });
    for (var i = 0; i < N.edges.length; i++) {
      var e = N.edges[i], g = fl[e.id] || 0;
      if (g < 0 || g > e.cap) return 'edge ' + e.id + ' carries ' + g + ' of ' + e.cap;
      bal[e.from] -= g; bal[e.to] += g;
    }
    for (var k = 0; k < N.ids.length; k++) {
      var id = N.ids[k];
      if (id !== N.source && id !== N.sink && bal[id] !== 0) return 'vertex ' + id + ' keeps ' + bal[id];
    }
    return null;
  }

  return {
    LIMITS: LIMITS, normalize: normalize, edgeId: edgeId, trace: trace, maxFlow: maxFlow, residual: residual,
    cutValue: cutValue, cutEdges: cutEdges, parseNetwork: parseNetwork, matchingNetwork: matchingNetwork,
    assignments: assignments, checkFlow: checkFlow, flowValue: function (net, fl) {
      var N = net.byId ? net : normalize(net), v = 0;
      N.edges.forEach(function (e) { if (e.from === N.source) v += fl[e.id] || 0; if (e.to === N.source) v -= fl[e.id] || 0; });
      return v;
    }
  };
}));
