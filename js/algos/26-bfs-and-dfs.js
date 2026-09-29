/* Lesson 26 · BFS & DFS — pure step generators (no DOM).

   Browser: VDSA.algos.graphSearch.  Node: module.exports.
   Reused by later labs (pathfinder, graph studio), so the names are generic:

     var GS = VDSA.algos.graphSearch;
     GS.bfs(graph, 'A', {target: 'I'})          BFS with a queue, distances, parents, path reconstruction
     GS.bfs(graph, 'A', {mark: 'dequeue'})      the classic bug: mark vertices when dequeued (queue fills with copies)
     GS.dfs(graph, 'A', {all, target, classify}) recursive DFS (explicit frame stack), discovery / finish times,
                                                edge classes (tree / back / forward / cross) and cycles
     GS.components(graph)                       connected components by repeated BFS
     GS.bipartite(graph)                        BFS two-colouring; an odd cycle is reported as a conflict
     GS.gridBfs(grid, start, goal, opts)        BFS on a grid of open cells and walls (goal null = flood fill)
     GS.gridDfs(grid, start, goal)              DFS on a grid (the stack is the path)
     GS.gridLayers(grid, start)                 one step per BFS distance layer (a wave)
     GS.bfsResult / GS.dfsResult                plain results with operation counts (for charts and tests)
     GS.visitFrames(steps)                      one frame per visited vertex (for side-by-side races)
     GS.parseEdgeList(text, opts)               "A-B, B-C, D" -> {values: graph, error}
     GS.randomGraph(n, m, rng, opts)            reproducible random graphs (rng from VDSA.rng)

   Graph input: {nodes: ['A', 'B'] | [{id, x, y}], edges: [['A', 'B']] | [{from, to}], directed: false}.
   Neighbours are always visited in natural order (A < B < … , 2 < 10), so every trace is deterministic.

   Grid input: {rows, cols, walls: ['r,c', …]}; cells are [row, col]. Grid steps carry `codes`, a string with one
   character per cell (row-major): '#' wall, '.' unseen, 'f' frontier (queued / on the stack), 'a' active (being
   expanded), 'v' visited (expanded / dead end), 'p' path. `dist` is shared by every step of one trace; show a
   cell's distance only when its code is not '.' (BFS distances never change after discovery).

   Every step: {algo, kind, caption (why), line (code label), vars, counters (same keys on every step), flow, …}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.graphSearch = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 14, maxEdges: 30, maxGridCells: 1600 };

  /* ================================================================== graph helpers */

  /* Natural order: 'A' < 'B', '2' < '10', 'N2' < 'N10'. Locale independent. */
  function natCmp(a, b) {
    a = String(a); b = String(b);
    var ra = a.match(/\d+|\D+/g) || [], rb = b.match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ra.length, rb.length); i++) {
      var x = ra[i], y = rb[i];
      var nx = /^\d/.test(x), ny = /^\d/.test(y);
      if (nx && ny) { var d = parseInt(x, 10) - parseInt(y, 10); if (d) return d < 0 ? -1 : 1; }
      if (x !== y) return x < y ? -1 : 1;
    }
    return ra.length - rb.length;
  }

  /* Edge identity, the same rule as the graph view: "from-to" when directed, the sorted pair otherwise. */
  function edgeKey(a, b, directed) {
    a = String(a); b = String(b);
    if (!directed && b < a) { var t = a; a = b; b = t; }
    return a + '-' + b;
  }

  function nodeIds(graph) {
    var out = [], seen = {};
    function add(id) { id = String(id); if (!seen[id]) { seen[id] = true; out.push(id); } }
    ((graph && graph.nodes) || []).forEach(function (n) { if (n !== null && n !== undefined) add(typeof n === 'object' ? n.id : n); });
    edgeList(graph).forEach(function (e) { add(e.from); add(e.to); });
    return out;
  }

  function edgeList(graph) {
    var out = [];
    ((graph && graph.edges) || []).forEach(function (e) {
      if (!e) return;
      var from = Array.isArray(e) ? e[0] : e.from, to = Array.isArray(e) ? e[1] : e.to;
      if (from === undefined || from === null || to === undefined || to === null) return;
      out.push({ from: String(from), to: String(to) });
    });
    return out;
  }

  /* adjacency(graph) -> {ids, adj: {id: [neighbours in natural order]}, directed, edges: [{from, to, key}]}
     Undirected edges are stored in both lists. Self-loops and repeated edges are dropped. */
  function adjacency(graph) {
    var directed = !!(graph && graph.directed);
    var ids = nodeIds(graph), adj = {}, keys = {}, edges = [];
    ids.forEach(function (id) { adj[id] = []; });
    edgeList(graph).forEach(function (e) {
      if (e.from === e.to) return;
      var k = edgeKey(e.from, e.to, directed);
      if (keys[k]) return;
      keys[k] = true;
      edges.push({ from: e.from, to: e.to, key: k });
      adj[e.from].push(e.to);
      if (!directed) adj[e.to].push(e.from);
    });
    ids.forEach(function (id) { adj[id].sort(natCmp); });
    return { ids: ids, adj: adj, directed: directed, edges: edges };
  }

  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function list(a) { return a.slice(); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function joinNames(ids) {
    ids = ids.map(esc);
    if (ids.length <= 1) return ids.join('');
    return ids.slice(0, -1).join(', ') + ' and ' + ids[ids.length - 1];
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* Walk parent pointers from `to` back to the root. Returns [root, …, to]. */
  function pathTo(parent, to) {
    var out = [], guard = 0, at = to;
    while (at !== null && at !== undefined && guard++ < 10000) { out.unshift(at); at = parent[at]; }
    return out;
  }

  /* ================================================================== BFS */

  /* bfs(graph, start, {target, mark: 'discover' | 'dequeue'}) -> steps
     Step extras: current, checking, states, dist, parent, queue [{t, v}] (front -> rear; t = unique entry id),
     order (dequeue order), edges {key: state}, pulse {from, to} | null, path [ids] | null, target. */
  function bfs(graph, start, opts) {
    opts = opts || {};
    var G = adjacency(graph), ids = G.ids, adj = G.adj, directed = G.directed;
    var lazy = opts.mark === 'dequeue';
    var target = opts.target !== undefined && opts.target !== null && opts.target !== '' ? String(opts.target) : null;
    start = start === undefined || start === null ? null : String(start);
    var steps = [];
    var states = {}, dist = {}, parent = {}, seen = {}, done = {}, edgeSt = {};
    var queue = [], order = [], checks = 0, visited = 0, entries = 0, current = null, path = null;
    ids.forEach(function (id) { states[id] = 'default'; dist[id] = null; parent[id] = null; });

    function snap(kind, o) {
      o = o || {};
      steps.push({
        algo: 'bfs', kind: kind, start: start, target: target, lazy: lazy,
        current: current, checking: o.checking === undefined ? null : o.checking,
        states: copy(states), dist: copy(dist), parent: copy(parent),
        queue: queue.map(function (q) { return { t: q.t, v: q.v }; }), order: list(order),
        edges: copy(edgeSt), pulse: o.pulse || null, path: path ? list(path) : null,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, counters: { visited: visited, checks: checks, frontier: queue.length, entries: entries }
      });
    }
    function qvals() { return queue.map(function (q) { return q.v; }); }

    if (!ids.length) { snap('empty', { caption: 'The graph has no vertices, so there is nothing to explore.', flow: 'done' }); return steps; }
    if (start === null || !adj[start]) { snap('empty', { caption: 'The start vertex ' + b(start === null ? '?' : start) + ' is not in the graph. Pick one of ' + joinNames(ids) + '.', flow: 'done' }); return steps; }

    dist[start] = 0; states[start] = 'frontier';
    if (!lazy) seen[start] = true;
    queue.push({ t: 'q' + (++entries), v: start });
    snap('init', {
      caption: 'Start at ' + b(start) + '. Its distance is 0 and it is the only vertex in the queue.' + (lazy ? '' : ' Marking it seen now means nothing can add it again.'),
      line: 'init', flow: 'init', vars: { u: null, v: null, queue: qvals() }
    });

    while (queue.length) {
      var entry = queue.shift(), u = entry.v;
      if (current !== null && states[current] === 'active') states[current] = 'visited';
      if (lazy && done[u]) {
        current = null;
        snap('stale', {
          caption: 'This copy of ' + b(u) + ' is out of date: ' + esc(u) + ' was already visited, so it is thrown away. Wasted work.',
          line: 'dequeue', flow: 'take', vars: { u: u, v: null, queue: qvals() }
        });
        continue;
      }
      if (lazy) done[u] = true;
      current = u; states[u] = 'active'; visited++; order.push(u);
      snap('dequeue', {
        caption: 'Take ' + b(u) + ' from the front of the queue (distance ' + dist[u] + '). ' + (visited === 1
          ? 'It is the only vertex waiting.'
          : 'First in, first out: everything found before ' + esc(u) + ' has already left, so no closer vertex is still waiting.'),
        line: 'dequeue', flow: 'take', vars: { u: u, v: null, 'dist[u]': dist[u], queue: qvals() }
      });
      if (target !== null && u === target) {
        path = pathTo(parent, u);
        states[u] = 'found';
        snap('found', {
          caption: b(u) + ' leaves the queue with distance ' + dist[u] + '. Nothing still in the queue is closer to ' + esc(start) + ', so this distance is final. Stop and rebuild the path.',
          line: 'found', flow: 'target', vars: { u: u, v: null, 'dist[u]': dist[u], queue: qvals() }
        });
        var shown = [];
        for (var p = path.length - 1; p >= 0; p--) {
          shown.unshift(path[p]);
          if (path[p] !== u) states[path[p]] = 'path';
          if (p < path.length - 1) edgeSt[edgeKey(path[p], path[p + 1], directed)] = 'path';
          var at = path[p];
          snap('path', {
            caption: p === path.length - 1
              ? 'Follow the parent pointers backwards from ' + b(u) + '.'
              : p === 0
                ? 'Reached the start. The shortest path is ' + b(path.join(' → ')) + ': ' + plural(path.length - 1, 'edge') + ', exactly dist[' + esc(u) + '].'
                : esc(path[p + 1]) + ' was discovered from ' + b(at) + ', so step back to ' + esc(at) + '.',
            line: 'found', flow: 'path', vars: { u: u, v: at, path: list(shown) }
          });
        }
        return steps;
      }
      var nb = adj[u];
      for (var i = 0; i < nb.length; i++) {
        var v = nb[i], key = edgeKey(u, v, directed);
        checks++;
        var isSeen = lazy ? done[v] : seen[v];
        if (!isSeen) {
          if (!lazy) seen[v] = true;
          var copies = 0;
          queue.forEach(function (q) { if (q.v === v) copies++; });
          if (dist[v] === null) { dist[v] = dist[u] + 1; parent[v] = u; edgeSt[key] = 'visited'; }
          states[v] = 'frontier';
          queue.push({ t: 'q' + (++entries), v: v });
          snap('discover', {
            checking: v, pulse: { from: u, to: v },
            caption: lazy && copies
              ? b(v) + ' is not marked yet, so it goes into the queue again. The queue now holds ' + (copies + 1) + ' copies of ' + esc(v) + '.'
              : b(v) + ' is new. It is one edge further than ' + esc(u) + ', so dist[' + esc(v) + '] = ' + dist[v] + '. Record ' + esc(u) + ' as its parent and add it to the back of the queue.',
            line: 'discover', flow: 'add', vars: { u: u, v: v, 'dist[u]': dist[u], 'dist[v]': dist[v], queue: qvals() }
          });
        } else {
          snap('skip', {
            checking: v, pulse: { from: u, to: v },
            caption: b(v) + ' was found earlier (distance ' + dist[v] + '), so skip it. The first route BFS finds to a vertex is already a shortest one.',
            line: 'check', flow: 'seen', vars: { u: u, v: v, 'dist[u]': dist[u], 'dist[v]': dist[v], queue: qvals() }
          });
        }
      }
    }
    if (current !== null && states[current] === 'active') states[current] = 'visited';
    current = null;
    var unreached = ids.filter(function (id) { return dist[id] === null; });
    var msg = 'The queue is empty: every vertex reachable from ' + esc(start) + ' has its distance.';
    if (target !== null) msg = b(target) + ' never left the queue, so it cannot be reached from ' + esc(start) + '.';
    if (unreached.length) msg += ' ' + joinNames(unreached) + (unreached.length === 1 ? ' was' : ' were') + ' never reached, so ' + (unreached.length === 1 ? 'its' : 'their') + ' distance stays ∞.';
    if (lazy) msg += ' The queue took ' + entries + ' entries for ' + visited + ' vertices.';
    snap('done', { caption: msg, line: 'done', flow: 'done', vars: { u: null, v: null, queue: [] } });
    return steps;
  }

  /* ================================================================== DFS */

  /* dfs(graph, start, {all, target, classify}) -> steps (recursive DFS, simulated with an explicit frame stack)
     all: after the start, restart from every still-unvisited vertex in natural order (a DFS forest).
     classify: label every examined edge tree / back / forward / cross (default: on for directed graphs).
     Step extras: current, checking, states (default = white, frontier = grey on the stack, active = top,
     visited = finished), disc, fin, time, parent, stack [ids] (bottom -> top), order (discovery order),
     edges {key: state}, edgeClass {key: class}, pulse {from, to}, cycle [ids] | null, path [ids] | null,
     roots [ids] (tree roots), hasCycle. */
  function dfs(graph, start, opts) {
    opts = opts || {};
    var G = adjacency(graph), ids = G.ids, adj = G.adj, directed = G.directed;
    var classify = opts.classify === undefined ? directed : !!opts.classify;
    var target = opts.target !== undefined && opts.target !== null && opts.target !== '' ? String(opts.target) : null;
    start = start === undefined || start === null ? (ids[0] === undefined ? null : ids[0]) : String(start);
    var steps = [];
    var color = {}, states = {}, disc = {}, fin = {}, parent = {}, edgeSt = {}, edgeClass = {};
    var stack = [], order = [], roots = [], time = 0, checks = 0, current = null, cycle = null, hasCycle = false, path = null;
    ids.forEach(function (id) { color[id] = 0; states[id] = 'default'; disc[id] = null; fin[id] = null; parent[id] = null; });

    function snap(kind, o) {
      o = o || {};
      steps.push({
        algo: 'dfs', kind: kind, start: start, target: target, directed: directed,
        current: current, checking: o.checking === undefined ? null : o.checking,
        states: copy(states), disc: copy(disc), fin: copy(fin), time: time, parent: copy(parent),
        stack: list(stack), order: list(order), roots: list(roots),
        edges: copy(edgeSt), edgeClass: copy(edgeClass), pulse: o.pulse || null,
        cycle: o.cycle ? list(o.cycle) : null, hasCycle: hasCycle, path: path ? list(path) : null,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, counters: { visited: order.length, checks: checks, frontier: stack.length }
      });
    }
    function vars(u, v) { return { u: u, v: v === undefined ? null : v, time: time, stack: list(stack) }; }
    function restate() {
      stack.forEach(function (id, k) { states[id] = k === stack.length - 1 ? 'active' : 'frontier'; });
      current = stack.length ? stack[stack.length - 1] : null;
    }

    if (!ids.length) { snap('empty', { caption: 'The graph has no vertices, so there is nothing to explore.', flow: 'done' }); return steps; }
    if (start === null || !adj[start]) { snap('empty', { caption: 'The start vertex ' + b(start === null ? '?' : start) + ' is not in the graph. Pick one of ' + joinNames(ids) + '.', flow: 'done' }); return steps; }

    function enter(u, from) {
      color[u] = 1; time++; disc[u] = time; order.push(u);
      stack.push(u); restate();
      var cap;
      if (from === null) cap = (roots.length > 1
        ? b(u) + ' is still unvisited, so a new search tree starts here. Discovery time ' + time + '.'
        : 'Call dfs(' + b(u) + '). Mark it seen and stamp its discovery time: ' + time + '.');
      else cap = 'Enter ' + b(u) + ' from ' + esc(from) + ': discovery time ' + time + '. The stack now holds the whole route from ' + esc(stack[0]) + ' down to ' + esc(u) + '.';
      snap('enter', { caption: cap, line: from === null ? ['call', 'enter'] : 'enter', flow: 'enter', vars: vars(u) });
    }
    function visitFrom(root) {
      roots.push(root);
      enter(root, null);
      if (target !== null && root === target) return found(root);
      var frames = [{ u: root, i: 0, parentSkipped: false }];
      while (frames.length) {
        var f = frames[frames.length - 1], u = f.u, nb = adj[u];
        if (f.i < nb.length) {
          var v = nb[f.i++], key = edgeKey(u, v, directed);
          checks++;
          if (!directed && v === parent[u] && !f.parentSkipped) {
            f.parentSkipped = true;
            snap('skip', {
              checking: v, pulse: { from: u, to: v },
              caption: b(v) + ' is where you came from (the parent of ' + esc(u) + '). It is already seen, so skip it.',
              line: 'check', flow: 'seen', vars: vars(u, v)
            });
            continue;
          }
          if (color[v] === 0) {
            snap('check', {
              checking: v, pulse: { from: u, to: v },
              caption: b(v) + ' has not been seen, so dive into it now. ' + esc(u) + ' waits on the stack with its remaining neighbours.',
              line: ['check', 'recurse'], flow: 'dive', vars: vars(u, v)
            });
            parent[v] = u; edgeSt[key] = 'visited';
            if (classify) edgeClass[key] = 'tree';
            enter(v, u);
            frames.push({ u: v, i: 0, parentSkipped: false });
            if (target !== null && v === target) return found(v);
            continue;
          }
          if (color[v] === 1) {
            if (classify || !directed) {
              hasCycle = true;
              if (classify) edgeClass[key] = 'back';
              var cyc = stack.slice(stack.indexOf(v));
              cycle = cyc;
              snap('back', {
                checking: v, pulse: { from: u, to: v }, cycle: cyc,
                caption: b(v) + ' is still on the stack: it is an ancestor of ' + esc(u) + '. This <em>back edge</em> closes a cycle ' + b(cyc.concat([v]).join(' → ')) + '.',
                line: 'check', flow: 'seen', vars: vars(u, v)
              });
            } else {
              snap('skip', { checking: v, pulse: { from: u, to: v }, caption: b(v) + ' is already seen, so skip it.', line: 'check', flow: 'seen', vars: vars(u, v) });
            }
            continue;
          }
          // color[v] === 2: finished
          if (classify && directed) {
            var fwd = disc[u] < disc[v];
            edgeClass[key] = fwd ? 'forward' : 'cross';
            snap(fwd ? 'forward' : 'cross', {
              checking: v, pulse: { from: u, to: v },
              caption: fwd
                ? b(v) + ' is finished and was discovered after ' + esc(u) + ' (' + disc[u] + ' &lt; ' + disc[v] + '): it is a descendant. A <em>forward edge</em>, no cycle.'
                : b(v) + ' is finished and belongs to another branch (discovered at ' + disc[v] + ', before ' + esc(u) + '). A <em>cross edge</em>, no cycle.',
              line: 'check', flow: 'seen', vars: vars(u, v)
            });
          } else {
            snap('skip', {
              checking: v, pulse: { from: u, to: v },
              caption: b(v) + ' is already finished, so skip it.',
              line: 'check', flow: 'seen', vars: vars(u, v)
            });
          }
          continue;
        }
        // no neighbours left: finish u
        frames.pop();
        color[u] = 2; time++; fin[u] = time; stack.pop(); states[u] = 'visited';
        restate();
        snap('finish', {
          caption: b(u) + ' has no unseen neighbours left. Finish it at time ' + time + ' and ' +
            (stack.length ? 'back up to ' + esc(stack[stack.length - 1]) + ', which carries on with its next neighbour.' : 'return: this search tree is complete.'),
          line: 'finish', flow: 'finish', vars: vars(u)
        });
      }
      return false;
    }
    function found(v) {
      path = list(stack);
      states[v] = 'found';
      path.slice(0, -1).forEach(function (id) { states[id] = 'path'; });
      for (var k = 1; k < path.length; k++) edgeSt[edgeKey(path[k - 1], path[k], directed)] = 'path';
      var best = bfsResult(G, start).dist[v], len = path.length - 1;
      snap('found', {
        caption: 'Reached ' + b(v) + '. The stack is the route DFS took: ' + b(path.join(' → ')) + ', ' + plural(len, 'edge') + '. ' + (best === len
          ? 'That happens to be a shortest route here, but DFS never checks: it stops at the first route it finds.'
          : 'The shortest route has only ' + plural(best, 'edge') + ': DFS stops at the first route it finds.'),
        line: 'found', flow: 'found', vars: vars(v)
      });
      return true;
    }

    var stop = visitFrom(start);
    if (!stop && opts.all) {
      for (var k = 0; k < ids.length && !stop; k++) {
        if (color[ids[k]] !== 0) continue;
        stop = visitFrom(ids[k]);
      }
    }
    if (stop) return steps;
    current = null;
    var unreached = ids.filter(function (id) { return color[id] === 0; });
    var msg = target !== null ? b(target) + ' was never reached from ' + esc(start) + '.' : 'Every vertex reachable from ' + esc(start) + ' is finished.';
    if (opts.all) msg = 'Every vertex is finished: ' + plural(roots.length, 'search tree') + ' in the DFS forest.';
    if (classify) msg += hasCycle ? ' A back edge was found, so the graph has a cycle.' : ' No back edge appeared, so the graph has no cycle.';
    if (unreached.length && !opts.all) msg += ' ' + joinNames(unreached) + (unreached.length === 1 ? ' was' : ' were') + ' never reached.';
    snap('done', { caption: msg, line: opts.all ? 'outer' : null, flow: 'done', vars: { u: null, v: null, time: time, stack: [] } });
    return steps;
  }

  /* ================================================================== components & bipartite */

  /* components(graph) -> steps. Repeated BFS from each unlabelled vertex, in natural order.
     Step extras: current, states, comp {id: k | null} (1-based), count, queue [ids], sizes [n per component]. */
  function components(graph) {
    var G = adjacency(Object.assign({}, graph, { directed: false })), ids = G.ids.slice().sort(natCmp), adj = G.adj;
    var steps = [], comp = {}, states = {}, queue = [], sizes = [], count = 0, current = null, labelled = 0;
    ids.forEach(function (id) { comp[id] = null; states[id] = 'default'; });
    function snap(kind, o) {
      steps.push({ algo: 'components', kind: kind, current: current, scan: o.scan === undefined ? null : o.scan,
        states: copy(states), comp: copy(comp), count: count, queue: list(queue), sizes: list(sizes),
        caption: o.caption, line: o.line || null, flow: o.flow || null, vars: o.vars || {},
        counters: { components: count, labelled: labelled } });
    }
    if (!ids.length) { snap('empty', { caption: 'No vertices, so there are no components.' }); return steps; }
    snap('init', { caption: 'Scan the vertices in order. Each one that has no component yet starts a new search.', line: 'outer', vars: { s: null, count: 0 } });
    ids.forEach(function (s) {
      if (comp[s] !== null) {
        snap('scan', { scan: s, caption: b(s) + ' already belongs to component ' + comp[s] + ', so move on.', line: 'outer', vars: { s: s, count: count } });
        return;
      }
      count++; sizes.push(1); comp[s] = count; labelled++; states[s] = 'frontier'; queue = [s];
      snap('new', { scan: s, caption: b(s) + ' has no component yet: start component ' + count + ' here and search everything it can reach.', line: 'new', vars: { s: s, count: count } });
      while (queue.length) {
        var u = queue.shift();
        if (current !== null && states[current] === 'active') states[current] = 'visited';
        current = u; states[u] = 'active';
        var found = [];
        adj[u].forEach(function (v) {
          if (comp[v] === null) { comp[v] = count; labelled++; sizes[count - 1]++; states[v] = 'frontier'; queue.push(v); found.push(v); }
        });
        snap('visit', { scan: s, caption: 'Take ' + b(u) + ' from the queue. ' + (found.length ? joinNames(found) + ' join' + (found.length === 1 ? 's' : '') + ' component ' + count + '.' : 'Every neighbour is already labelled.'),
          line: 'visit', vars: { s: s, u: u, count: count, queue: list(queue) } });
      }
      if (current !== null) states[current] = 'visited';
      current = null;
      snap('close', { scan: s, caption: 'The queue is empty: component ' + count + ' is complete with ' + plural(sizes[count - 1], 'vertex', 'vertices') + '. No edge leaves it.', line: 'outer', vars: { s: s, count: count } });
    });
    snap('done', { caption: 'Every vertex is labelled: ' + plural(count, 'connected component') + '. One BFS per component, so the whole scan is still O(V + E).', line: 'done', vars: { s: null, count: count } });
    return steps;
  }

  /* bipartite(graph) -> steps. BFS two-colouring; stops at the first edge whose ends share a side.
     Step extras: current, states, side {id: 0 | 1 | null}, queue, conflict edge key | null, cycle [ids] | null
     (the odd cycle), edges {key: state}, pulse, bipartite (true / false / null while running). */
  function bipartite(graph) {
    var G = adjacency(Object.assign({}, graph, { directed: false })), ids = G.ids.slice().sort(natCmp), adj = G.adj;
    var steps = [], side = {}, states = {}, parent = {}, depth = {}, queue = [], edgeSt = {}, current = null, result = null;
    ids.forEach(function (id) { side[id] = null; states[id] = 'default'; parent[id] = null; depth[id] = null; });
    function snap(kind, o) {
      steps.push({ algo: 'bipartite', kind: kind, current: current, checking: o.checking === undefined ? null : o.checking,
        states: copy(states), side: copy(side), queue: list(queue), edges: copy(edgeSt), pulse: o.pulse || null,
        conflict: o.conflict || null, cycle: o.cycle ? list(o.cycle) : null, bipartite: result,
        caption: o.caption, line: o.line || null, vars: o.vars || {},
        counters: { coloured: ids.filter(function (id) { return side[id] !== null; }).length, checks: o.checks } });
    }
    var checks = 0;
    if (!ids.length) { result = true; snap('empty', { caption: 'No vertices: trivially two-colourable.', checks: 0 }); return steps; }
    for (var si = 0; si < ids.length; si++) {
      var s = ids[si];
      if (side[s] !== null) continue;
      side[s] = 0; depth[s] = 0; queue = [s];
      snap('start', { caption: 'Give ' + b(s) + ' side A. ' + (si === 0 ? 'Every neighbour must then go on side B, their neighbours on side A, and so on.' : 'It was not reached before, so it starts a new piece of the graph.'), line: 'start', checks: checks, vars: { u: s, v: null, queue: list(queue) } });
      while (queue.length) {
        var u = queue.shift();
        current = u;
        var nb = adj[u];
        for (var i = 0; i < nb.length; i++) {
          var v = nb[i], key = edgeKey(u, v, false);
          if (v === parent[u]) continue;
          checks++;
          if (side[v] === null) {
            side[v] = 1 - side[u]; parent[v] = u; depth[v] = depth[u] + 1; queue.push(v); edgeSt[key] = 'visited';
            snap('colour', { checking: v, pulse: { from: u, to: v }, caption: b(v) + ' is a neighbour of ' + esc(u) + ' (side ' + 'AB'[side[u]] + '), so it goes on side ' + 'AB'[side[v]] + '.', line: 'colour', checks: checks, vars: { u: u, v: v, queue: list(queue) } });
          } else if (side[v] === side[u]) {
            // odd cycle: climb from u and v to their lowest common ancestor in the BFS tree
            var a = u, c = v, left = [a], right = [c];
            while (a !== c) {
              if (depth[a] >= depth[c]) { a = parent[a]; left.push(a); } else { c = parent[c]; right.push(c); }
            }
            right.pop();
            var cyc = left.concat(right.reverse());
            result = false; edgeSt[key] = 'error';
            cyc.forEach(function (id) { states[id] = 'error'; });
            snap('conflict', { checking: v, pulse: { from: u, to: v }, conflict: key, cycle: cyc,
              caption: b(u) + ' and ' + b(v) + ' are neighbours on the same side. Their cycle ' + b(cyc.concat([cyc[0]]).join(' → ')) + ' has ' + cyc.length + ' edges, an odd number, so no two-colouring exists.',
              line: 'conflict', checks: checks, vars: { u: u, v: v, queue: list(queue) } });
            return steps;
          } else {
            snap('ok', { checking: v, pulse: { from: u, to: v }, caption: b(v) + ' is already on side ' + 'AB'[side[v]] + ', opposite ' + esc(u) + '. This edge is fine.', line: 'ok', checks: checks, vars: { u: u, v: v, queue: list(queue) } });
          }
        }
      }
    }
    current = null; result = true;
    snap('done', { caption: 'Every edge joins side A to side B: the graph is bipartite. Any cycle in it has an even number of edges.', line: 'done', checks: checks, vars: { u: null, v: null, queue: [] } });
    return steps;
  }

  /* ================================================================== plain results (for charts and tests) */

  /* bfsResult(graph, start) -> {order, dist, parent, checks, peak (largest queue), visited} */
  function bfsResult(graph, start) {
    var G = graph && graph.adj ? graph : adjacency(graph), adj = G.adj;
    start = String(start);
    var dist = {}, parent = {}, order = [], checks = 0, peak = 0;
    if (!adj[start]) return { order: order, dist: dist, parent: parent, checks: 0, peak: 0, visited: 0 };
    var q = [start], head = 0;
    dist[start] = 0; parent[start] = null;
    while (head < q.length) {
      peak = Math.max(peak, q.length - head);
      var u = q[head++];
      order.push(u);
      var nb = adj[u];
      for (var i = 0; i < nb.length; i++) {
        checks++;
        var v = nb[i];
        if (dist[v] === undefined) { dist[v] = dist[u] + 1; parent[v] = u; q.push(v); }
      }
    }
    return { order: order, dist: dist, parent: parent, checks: checks, peak: peak, visited: order.length };
  }

  /* dfsResult(graph, start) -> {order, disc, fin, parent, checks, maxDepth (largest stack)} — iterative, same
     order as the recursive DFS above. */
  function dfsResult(graph, start) {
    var G = graph && graph.adj ? graph : adjacency(graph), adj = G.adj;
    start = String(start);
    var disc = {}, fin = {}, parent = {}, order = [], checks = 0, maxDepth = 0, time = 0;
    if (!adj[start]) return { order: order, disc: disc, fin: fin, parent: parent, checks: 0, maxDepth: 0 };
    var frames = [{ u: start, i: 0 }];
    disc[start] = ++time; parent[start] = null; order.push(start);
    while (frames.length) {
      maxDepth = Math.max(maxDepth, frames.length);
      var f = frames[frames.length - 1];
      var nb = adj[f.u];
      if (f.i < nb.length) {
        var v = nb[f.i++];
        checks++;
        if (disc[v] === undefined) { disc[v] = ++time; parent[v] = f.u; order.push(v); frames.push({ u: v, i: 0 }); }
      } else { fin[f.u] = ++time; frames.pop(); }
    }
    return { order: order, disc: disc, fin: fin, parent: parent, checks: checks, maxDepth: maxDepth };
  }

  /* visitFrames(steps) -> one frame per visited vertex, plus the first and the last step.
     BFS: the state just after a vertex has been expanded (all its neighbours discovered).
     DFS: the moment a vertex is entered. Frames are the original step objects (not copies). */
  function visitFrames(steps) {
    if (!steps || !steps.length) return [];
    var out = [steps[0]], algo = steps[0].algo;
    for (var i = 1; i < steps.length; i++) {
      var s = steps[i];
      if (algo === 'bfs' && (s.kind === 'dequeue' || s.kind === 'stale') && out[out.length - 1] !== steps[i - 1]) out.push(steps[i - 1]);
      if (algo === 'dfs' && s.kind === 'enter') out.push(s);
    }
    if (out[out.length - 1] !== steps[steps.length - 1]) out.push(steps[steps.length - 1]);
    return out;
  }

  /* ================================================================== grids */

  var DIRS = [[-1, 0, 'up'], [0, 1, 'right'], [1, 0, 'down'], [0, -1, 'left']];

  function gridModel(grid) {
    var R = Math.max(0, grid.rows | 0), C = Math.max(0, grid.cols | 0), wall = new Array(R * C);
    for (var i = 0; i < wall.length; i++) wall[i] = false;
    (grid.walls || []).forEach(function (w) {
      var rc = typeof w === 'string' ? w.split(',').map(Number) : w;
      if (!rc || rc.length < 2) return;
      var r = rc[0], c = rc[1];
      if (r >= 0 && c >= 0 && r < R && c < C) wall[r * C + c] = true;
    });
    return { R: R, C: C, wall: wall };
  }
  function cellName(rc) { return '(' + rc[0] + ', ' + rc[1] + ')'; }
  function baseCodes(M) { var s = ''; for (var i = 0; i < M.R * M.C; i++) s += M.wall[i] ? '#' : '.'; return s.split(''); }

  /* gridBfs(grid, start, goal, {fill}) -> steps. One step per expanded cell (its new neighbours join the queue
     in the same step), then the path, drawn back from the goal a few cells at a time. goal null = flood fill.
     Step extras: codes, dist (shared), rows, cols, start, goal, current [r, c] | null, found, pathCells. */
  function gridBfs(grid, start, goal, opts) {
    opts = opts || {};
    var M = gridModel(grid), R = M.R, C = M.C, N = R * C;
    var fill = goal === null || goal === undefined || opts.fill;
    var steps = [], codes = baseCodes(M), dist = new Array(N), parent = new Array(N);
    for (var i = 0; i < N; i++) { dist[i] = -1; parent[i] = -1; }
    var visited = 0, queue = [], head = 0, current = null, found = false, pathLen = null;
    var s = start ? start[0] * C + start[1] : -1, g = !fill && goal ? goal[0] * C + goal[1] : -1;
    function rc(k) { return [Math.floor(k / C), k % C]; }
    function snap(kind, o) {
      steps.push({
        algo: 'gridbfs', kind: kind, rows: R, cols: C, start: start, goal: fill ? null : goal,
        codes: codes.join(''), dist: dist, current: current === null ? null : rc(current), found: found,
        caption: o.caption, line: o.line || null, flow: o.flow || null, vars: o.vars || {},
        counters: { visited: visited, frontier: queue.length - head, path: pathLen === null ? '–' : pathLen }
      });
    }
    if (!R || !C) { snap('empty', { caption: 'The grid has no cells.' }); return steps; }
    if (s < 0 || start[0] < 0 || start[1] < 0 || start[0] >= R || start[1] >= C || M.wall[s]) { snap('empty', { caption: 'The start cell must be an open cell inside the grid.' }); return steps; }
    if (!fill && (goal[0] < 0 || goal[1] < 0 || goal[0] >= R || goal[1] >= C || M.wall[g])) { snap('empty', { caption: 'The goal cell must be an open cell inside the grid.' }); return steps; }
    dist[s] = 0; queue.push(s); codes[s] = 'f';
    snap('init', { caption: fill
      ? 'Pour the paint at ' + cellName(start) + '. The queue holds just that cell, at distance 0.'
      : 'Start at S ' + cellName(start) + ', distance 0. The queue holds just this cell.', line: 'init', vars: { cell: null, dist: 0, queue: 1 } });
    while (head < queue.length) {
      var u = queue[head++];
      if (current !== null && codes[current] === 'a') codes[current] = 'v';
      current = u; codes[u] = 'a'; visited++;
      if (!fill && u === g) {
        found = true;
        var path = [], k = u;
        while (k !== -1) { path.unshift(k); k = parent[k]; }
        pathLen = path.length - 1;
        snap('found', { caption: 'The goal T leaves the queue at distance ' + dist[u] + '. Everything still queued is at least as far, so no shorter route exists. Now walk the parents back to S.', line: 'found', vars: { cell: cellName(rc(u)), dist: dist[u], queue: queue.length - head } });
        var chunk = Math.max(1, Math.ceil(path.length / 8));
        for (var e = path.length - 1; e >= 0; e -= chunk) {
          for (var q = e; q > e - chunk && q >= 0; q--) codes[path[q]] = 'p';
          var reached = Math.max(0, e - chunk + 1);
          snap('path', { caption: reached === 0
            ? 'Back at S. The shortest path takes ' + plural(pathLen, 'step') + ', and every cell on it is one step further from S than the last.'
            : 'Each cell remembers the neighbour that discovered it. Follow those parents from T towards S (' + (path.length - reached) + ' of ' + path.length + ' cells).',
          line: 'found', vars: { cell: cellName(rc(path[reached])), dist: dist[path[reached]], queue: queue.length - head } });
        }
        return steps;
      }
      var added = 0;
      for (var d = 0; d < 4; d++) {
        var r = Math.floor(u / C) + DIRS[d][0], c = u % C + DIRS[d][1];
        if (r < 0 || c < 0 || r >= R || c >= C) continue;
        var v = r * C + c;
        if (M.wall[v] || dist[v] !== -1) continue;
        dist[v] = dist[u] + 1; parent[v] = u; queue.push(v); codes[v] = 'f'; added++;
      }
      snap('expand', { caption: 'Expand ' + cellName(rc(u)) + ' (distance ' + dist[u] + '): ' + (added ? plural(added, 'new neighbour') + ' join' + (added === 1 ? 's' : '') + ' the back of the queue at distance ' + (dist[u] + 1) + '.' : 'no new neighbours, only walls, edges or cells already found.'),
        line: ['dequeue', 'discover'], vars: { cell: cellName(rc(u)), dist: dist[u], queue: queue.length - head } });
    }
    if (current !== null && codes[current] === 'a') codes[current] = 'v';
    current = null;
    snap('none', { caption: fill
      ? 'The queue is empty: the paint filled all ' + plural(visited, 'cell') + ' connected to the start. Walls stopped it everywhere else.'
      : 'The queue emptied without reaching T: walls cut it off, so there is no path. BFS proves this after ' + plural(visited, 'cell') + '.', line: 'none', vars: { cell: null, dist: null, queue: 0 } });
    return steps;
  }

  /* gridDfs(grid, start, goal) -> steps. The stack holds the current route; each step pushes the first open,
     unseen neighbour (up, right, down, left) or pops a dead end. When the goal is pushed, the stack is the path. */
  function gridDfs(grid, start, goal) {
    var M = gridModel(grid), R = M.R, C = M.C, N = R * C;
    var fill = goal === null || goal === undefined;
    var steps = [], codes = baseCodes(M), seen = new Array(N), stack = [], seenCount = 0, pathLen = null, found = false;
    for (var i = 0; i < N; i++) seen[i] = false;
    var s = start ? start[0] * C + start[1] : -1, g = !fill ? goal[0] * C + goal[1] : -1;
    function rc(k) { return [Math.floor(k / C), k % C]; }
    function snap(kind, o) {
      steps.push({
        algo: 'griddfs', kind: kind, rows: R, cols: C, start: start, goal: fill ? null : goal,
        codes: codes.join(''), dist: null, current: stack.length ? rc(stack[stack.length - 1]) : null, found: found,
        caption: o.caption, line: o.line || null, vars: o.vars || {},
        counters: { visited: seenCount, frontier: stack.length, path: pathLen === null ? '–' : pathLen }
      });
    }
    if (!R || !C) { snap('empty', { caption: 'The grid has no cells.' }); return steps; }
    if (s < 0 || start[0] < 0 || start[1] < 0 || start[0] >= R || start[1] >= C || M.wall[s]) { snap('empty', { caption: 'The start cell must be an open cell inside the grid.' }); return steps; }
    if (!fill && (goal[0] < 0 || goal[1] < 0 || goal[0] >= R || goal[1] >= C || M.wall[g])) { snap('empty', { caption: 'The goal cell must be an open cell inside the grid.' }); return steps; }
    seen[s] = true; seenCount = 1; stack.push(s); codes[s] = 'a';
    snap('init', { caption: 'Start at S ' + cellName(start) + '. The stack holds the route so far: just S.', line: 'init', vars: { cell: cellName(start), depth: 1 } });
    function paint() { stack.forEach(function (k, j) { codes[k] = j === stack.length - 1 ? 'a' : 'f'; }); }
    while (stack.length) {
      var u = stack[stack.length - 1];
      if (!fill && u === g) {
        found = true; pathLen = stack.length - 1;
        stack.forEach(function (k) { codes[k] = 'p'; });
        var best = bfsDistance(M, s, g);
        snap('found', { caption: 'T is on top of the stack. The stack <em>is</em> the route: ' + plural(pathLen, 'step') + '. ' + (best === pathLen
          ? 'The shortest route also has ' + plural(best, 'step') + ', so this time DFS got lucky; nothing in DFS promises that.'
          : 'The shortest route has only ' + plural(best, 'step') + ': DFS took the first route it stumbled on.'), line: 'found', vars: { cell: cellName(rc(u)), depth: stack.length } });
        return steps;
      }
      var next = -1, dir = '';
      for (var d = 0; d < 4; d++) {
        var r = Math.floor(u / C) + DIRS[d][0], c = u % C + DIRS[d][1];
        if (r < 0 || c < 0 || r >= R || c >= C) continue;
        var v = r * C + c;
        if (M.wall[v] || seen[v]) continue;
        next = v; dir = DIRS[d][2]; break;
      }
      if (next !== -1) {
        seen[next] = true; seenCount++; stack.push(next); paint();
        snap('push', { caption: 'Step ' + dir + ' to ' + cellName(rc(next)) + ' and push it: keep diving while there is somewhere new to go.', line: 'push', vars: { cell: cellName(rc(next)), depth: stack.length } });
      } else {
        stack.pop(); codes[u] = 'v'; paint();
        snap('pop', { caption: cellName(rc(u)) + ' is a dead end: every neighbour is a wall or already seen. Pop it and back up' + (stack.length ? ' to ' + cellName(rc(stack[stack.length - 1])) + '.' : '.'), line: 'pop', vars: { cell: stack.length ? cellName(rc(stack[stack.length - 1])) : null, depth: stack.length } });
      }
    }
    snap('none', { caption: fill ? 'The stack is empty: DFS reached all ' + plural(seenCount, 'cell') + ' connected to the start.' : 'The stack is empty and T was never reached: there is no path.', line: 'none', vars: { cell: null, depth: 0 } });
    return steps;
  }

  /* Plain BFS distance between two cells of a grid model (-1 when unreachable). */
  function bfsDistance(M, s, g) {
    var R = M.R, C = M.C, dist = new Array(R * C), q = [s], head = 0;
    for (var i = 0; i < dist.length; i++) dist[i] = -1;
    dist[s] = 0;
    while (head < q.length) {
      var u = q[head++];
      if (u === g) return dist[u];
      for (var d = 0; d < 4; d++) {
        var r = Math.floor(u / C) + DIRS[d][0], c = u % C + DIRS[d][1];
        if (r < 0 || c < 0 || r >= R || c >= C) continue;
        var v = r * C + c;
        if (M.wall[v] || dist[v] !== -1) continue;
        dist[v] = dist[u] + 1; q.push(v);
      }
    }
    return -1;
  }

  /* gridLayers(grid, start) -> one step per BFS layer: cells at distance < d are visited, distance d is the frontier. */
  function gridLayers(grid, start) {
    var M = gridModel(grid), R = M.R, C = M.C, N = R * C, steps = [];
    var s = start[0] * C + start[1];
    if (!R || !C || M.wall[s]) return steps;
    var dist = new Array(N), q = [s], head = 0;
    for (var i = 0; i < N; i++) dist[i] = -1;
    dist[s] = 0;
    var maxD = 0;
    while (head < q.length) {
      var u = q[head++];
      maxD = Math.max(maxD, dist[u]);
      for (var d = 0; d < 4; d++) {
        var r = Math.floor(u / C) + DIRS[d][0], c = u % C + DIRS[d][1];
        if (r < 0 || c < 0 || r >= R || c >= C) continue;
        var v = r * C + c;
        if (M.wall[v] || dist[v] !== -1) continue;
        dist[v] = dist[u] + 1; q.push(v);
      }
    }
    for (var layer = 0; layer <= maxD + 1; layer++) {
      var codes = baseCodes(M), n = 0;
      for (var k = 0; k < N; k++) {
        if (dist[k] === -1) continue;
        if (dist[k] < layer) codes[k] = 'v';
        else if (dist[k] === layer) { codes[k] = 'f'; n++; }
      }
      steps.push({ algo: 'gridlayers', kind: layer > maxD ? 'done' : 'layer', layer: layer, rows: R, cols: C, start: start, codes: codes.join(''), dist: dist,
        caption: layer > maxD ? 'Every reachable cell is visited.' : 'Layer ' + layer + ': ' + plural(n, 'cell') + ' at distance ' + layer + '.' });
    }
    return steps;
  }

  /* ================================================================== input */

  /* parseEdgeList("A-B, A-C, B-D, E", {maxNodes, maxEdges}) -> {values: {nodes, edges, directed: false}, error}
     Tokens are separated by commas, semicolons or new lines. "A-B" (or "A B") is an edge; a lone name is an
     isolated vertex. Names: letters and digits, up to 3 characters. */
  function parseEdgeList(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || 12, maxEdges = opts.maxEdges || 24;
    var src = String(text === undefined || text === null ? '' : text).trim();
    if (!src) return { values: null, error: 'Type at least one vertex or edge, for example A-B, B-C.' };
    var tokens = src.split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    var nodes = [], seenN = {}, edges = [], seenE = {};
    function addNode(n) { if (!seenN[n]) { seenN[n] = true; nodes.push(n); } }
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var parts = t.split(/\s*(?:-+>?|–|—|\s)\s*/).filter(Boolean);
      for (var p = 0; p < parts.length; p++) {
        if (!/^[A-Za-z0-9]{1,3}$/.test(parts[p])) return { values: null, error: '“' + t + '” is not an edge. Use names of up to 3 letters or digits, like A-B.' };
        parts[p] = parts[p].toUpperCase();
      }
      if (parts.length === 1) { addNode(parts[0]); continue; }
      if (parts.length !== 2) return { values: null, error: '“' + t + '” should join exactly two vertices, like A-B.' };
      if (parts[0] === parts[1]) return { values: null, error: '“' + t + '” joins a vertex to itself. Self-loops are not allowed here.' };
      addNode(parts[0]); addNode(parts[1]);
      var k = edgeKey(parts[0], parts[1], false);
      if (seenE[k]) continue;
      seenE[k] = true;
      edges.push([parts[0], parts[1]]);
    }
    if (nodes.length > maxNodes) return { values: null, error: 'That is ' + nodes.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges, directed: false }, error: null };
  }

  /* randomGraph(n, m, rng, {directed, connected, names}) -> {nodes, edges, directed}
     rng() -> [0, 1). connected: first builds a random spanning tree (needs m >= n - 1). Names: V0, V1 … by default. */
  function randomGraph(n, m, rng, opts) {
    opts = opts || {};
    var names = opts.names || [];
    var nodes = [];
    for (var i = 0; i < n; i++) nodes.push(names[i] || (opts.letters ? String.fromCharCode(65 + i) : 'V' + i));
    var edges = [], keys = {}, directed = !!opts.directed;
    var maxM = directed ? n * (n - 1) : n * (n - 1) / 2;
    m = Math.max(0, Math.min(m, maxM));
    function add(a, b) {
      if (a === b) return false;
      var k = edgeKey(nodes[a], nodes[b], directed);
      if (keys[k]) return false;
      keys[k] = true; edges.push([nodes[a], nodes[b]]); return true;
    }
    if (opts.connected) for (var j = 1; j < n && edges.length < m; j++) add(Math.floor(rng() * j), j);
    var guard = 0;
    while (edges.length < m && guard++ < m * 50 + 1000) add(Math.floor(rng() * n), Math.floor(rng() * n));
    return { nodes: nodes, edges: edges, directed: directed };
  }

  return {
    LIMITS: LIMITS,
    natCmp: natCmp, edgeKey: edgeKey, nodeIds: nodeIds, adjacency: adjacency, pathTo: pathTo,
    bfs: bfs, dfs: dfs, components: components, bipartite: bipartite,
    bfsResult: bfsResult, dfsResult: dfsResult, visitFrames: visitFrames,
    gridBfs: gridBfs, gridDfs: gridDfs, gridLayers: gridLayers, gridModel: gridModel,
    parseEdgeList: parseEdgeList, randomGraph: randomGraph
  };
}));
