/* Lesson 27 · Topological sort & cycles — pure step generators (no DOM).

   Browser: VDSA.algos.topo.  Node: module.exports.

     var T = VDSA.algos.topo;
     T.kahn(graph, {pick})            Kahn's algorithm: in-degree badges, ready set, output order; stuck = cycle
     T.dfsTopo(graph)                 DFS with white / grey / black colours, finish stack, reverse postorder;
                                      the first back edge (grey -> grey) is a cycle
     T.kosaraju(graph)                strongly connected components, two DFS passes, then the condensation DAG
     T.longestPath(graph, weights)    critical path: earliest finish times in topological order
     T.isTopoOrder(graph, order)      does this order respect every edge?  -> {valid, violations, ...}
     T.countOrders(graph)             how many valid orders exist (bitmask DP, up to 20 vertices)
     T.randomValidOrder(graph, rng)   a random valid order (Kahn with a random pick)
     T.findCycle(graph)               one directed cycle as [v0, v1, ...] (edges v0->v1 ... vk->v0) or null
     T.tarjanScc(graph)               reference SCCs (Tarjan), used to cross-check Kosaraju
     T.kahnLevels(graph)              "semesters": Kahn in rounds
     T.kahnResult / dfsResult         plain results with operation counts (charts, tests)
     T.parseEdgeList(text, opts)      "A>B, B>C>D, E" -> {values: graph, error}
     T.randomDag(n, m, rng)           reproducible random DAG on V0..V(n-1)

   Graph input: {nodes: ['A', 'B'] | [{id, x, y}], edges: [['A', 'B']] | [{from, to}]}. Always directed.
   Repeated edges are merged; a self-loop A->A is kept (it is a cycle of length 1).
   Ties are always broken in natural order (A < B, 2 < 10), so every trace is deterministic.

   Every step: {algo, kind, caption (why), line (code label), vars, counters (same keys on every step), flow, ...}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.topo = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 12, maxEdges: 24 };

  /* ================================================================== helpers */
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
  function edgeKey(a, b) { return String(a) + '-' + String(b); }
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function joinNames(ids) {
    ids = ids.map(esc);
    if (ids.length <= 1) return ids.join('');
    return ids.slice(0, -1).join(', ') + ' and ' + ids[ids.length - 1];
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

  /* adjacency(graph) -> {ids, succ, pred, edges: [{from, to, key}]}; successors and predecessors in natural order. */
  function adjacency(graph) {
    var ids = nodeIds(graph), succ = {}, pred = {}, keys = {}, edges = [];
    ids.forEach(function (id) { succ[id] = []; pred[id] = []; });
    edgeList(graph).forEach(function (e) {
      var k = edgeKey(e.from, e.to);
      if (keys[k]) return;
      keys[k] = true;
      edges.push({ from: e.from, to: e.to, key: k });
      succ[e.from].push(e.to);
      pred[e.to].push(e.from);
    });
    ids.forEach(function (id) { succ[id].sort(natCmp); pred[id].sort(natCmp); });
    return { ids: ids, succ: succ, pred: pred, edges: edges };
  }

  /* ================================================================== parsing */
  /* "A>B, B>C>D; E" -> {values: {nodes, edges}, error}. Accepts >, -> and →. A lone name is a vertex with no edges. */
  function parseEdgeList(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.maxNodes, maxEdges = opts.maxEdges || LIMITS.maxEdges;
    var raw = String(text === undefined || text === null ? '' : text).trim();
    if (!raw) return { values: null, error: 'Type at least one dependency, such as A>B (A must come before B).' };
    var nodes = [], seen = {}, edges = [], keys = {};
    function node(id) { if (!seen[id]) { seen[id] = true; nodes.push(id); } }
    var parts = raw.split(/[,;\n]+/);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      if (/[<=]/.test(part)) return { values: null, error: 'Write dependencies as A>B, meaning A comes before B. “' + part + '” points the other way.' };
      var chain = part.split(/\s*(?:->|→|>)\s*/);
      for (var j = 0; j < chain.length; j++) {
        var id = chain[j].trim();
        if (!id) return { values: null, error: 'Something is missing next to an arrow in “' + part + '”. Write it like A>B.' };
        if (!/^[A-Za-z0-9_]{1,8}$/.test(id)) {
          return { values: null, error: id.length > 8
            ? '“' + id + '” is longer than 8 characters. Short names keep the picture readable.'
            : '“' + id + '” has a character I cannot use. Names are letters, digits and underscores, and an arrow is >.' };
        }
        node(id);
        if (j > 0) {
          var k = edgeKey(chain[j - 1].trim(), id);
          if (!keys[k]) { keys[k] = true; edges.push([chain[j - 1].trim(), id]); }
        }
      }
    }
    if (nodes.length > maxNodes) return { values: null, error: 'That is ' + nodes.length + ' vertices. Keep it to ' + maxNodes + ' or fewer so every step stays readable.' };
    if (edges.length > maxEdges) return { values: null, error: 'That is ' + edges.length + ' dependencies. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges }, error: null };
  }

  /* ================================================================== order checks (pure) */
  /* isTopoOrder(graph, order) -> {valid, complete, violations: [{from, to, key}], missing, extra, duplicates} */
  function isTopoOrder(graph, order) {
    var G = adjacency(graph), pos = {}, dup = [], extra = [];
    order = (order || []).map(String);
    order.forEach(function (id, i) {
      if (!(id in G.succ)) { extra.push(id); return; }
      if (id in pos) { dup.push(id); return; }
      pos[id] = i;
    });
    var missing = G.ids.filter(function (id) { return !(id in pos); });
    var violations = [];
    G.edges.forEach(function (e) {
      if (!(e.from in pos) || !(e.to in pos)) return;
      if (pos[e.from] >= pos[e.to]) violations.push({ from: e.from, to: e.to, key: e.key });
    });
    var complete = !missing.length && !extra.length && !dup.length;
    return { valid: complete && !violations.length, complete: complete, violations: violations, missing: missing, extra: extra, duplicates: dup };
  }

  /* countOrders(graph) -> number of valid topological orders (0 with a cycle). Bitmask DP; null above 20 vertices. */
  function countOrders(graph) {
    var G = adjacency(graph), n = G.ids.length;
    if (n > 20) return null;
    if (!n) return 1;
    var idx = {}, pm = [];
    G.ids.forEach(function (id, i) { idx[id] = i; });
    G.ids.forEach(function (id, i) { pm[i] = 0; G.pred[id].forEach(function (p) { pm[i] |= (1 << idx[p]); }); });
    var full = (1 << n) - 1, dp = new Array(full + 1);
    for (var m = 0; m <= full; m++) dp[m] = 0;
    dp[0] = 1;
    for (m = 0; m < full; m++) {
      if (!dp[m]) continue;
      for (var v = 0; v < n; v++) {
        if (m & (1 << v)) continue;
        if ((pm[v] & m) === pm[v]) dp[m | (1 << v)] += dp[m];
      }
    }
    return dp[full];
  }

  function randomValidOrder(graph, rng) {
    var G = adjacency(graph), indeg = {}, ready = [], out = [];
    G.ids.forEach(function (id) { indeg[id] = G.pred[id].length; if (!indeg[id]) ready.push(id); });
    while (ready.length) {
      var i = Math.floor((rng ? rng() : Math.random()) * ready.length);
      var u = ready.splice(i, 1)[0];
      out.push(u);
      G.succ[u].forEach(function (v) { if (--indeg[v] === 0) ready.push(v); });
    }
    return out.length === G.ids.length ? out : null;
  }

  /* findCycle(graph) -> [v0, v1, ..., vk] with edges v0->v1 ... vk->v0, or null. Iterative DFS, natural order. */
  function findCycle(graph) {
    var G = adjacency(graph), color = {}, found = null;
    for (var s = 0; s < G.ids.length && !found; s++) {
      var root0 = G.ids.slice().sort(natCmp)[s];
      if (color[root0]) continue;
      var stack = [[root0, 0]], path = [root0];
      color[root0] = 1;
      while (stack.length && !found) {
        var top = stack[stack.length - 1], u = top[0];
        if (top[1] < G.succ[u].length) {
          var v = G.succ[u][top[1]++];
          if (color[v] === 1) found = path.slice(path.indexOf(v));
          else if (!color[v]) { color[v] = 1; stack.push([v, 0]); path.push(v); }
        } else { color[u] = 2; stack.pop(); path.pop(); }
      }
    }
    return found;
  }

  /* ================================================================== Kahn */
  /* kahn(graph, {pick: 'fifo' | 'lifo' | 'alpha'}) -> steps
     Step extras: current, states {id: default|frontier|active|done|error|compare}, indeg {id: n}, ready [ids] (the
     ready set, leftmost = next out for fifo), order [ids], edges {key: 'muted' (removed)}, pulse {from, to} | null,
     stuck [ids], cycle {nodes, edges} | null, layered (true on the final morph step), acyclic, pick. */
  function kahn(graph, opts) {
    opts = opts || {};
    var pick = opts.pick === 'lifo' || opts.pick === 'alpha' ? opts.pick : 'fifo';
    var G = adjacency(graph), ids = G.ids.slice().sort(natCmp), n = ids.length;
    var steps = [];
    var states = {}, indeg = {}, edgeSt = {}, ready = [], order = [], removed = 0, current = null, stuck = [], cycle = null, layered = false, acyclic = null;
    ids.forEach(function (id) { states[id] = 'default'; indeg[id] = G.pred[id].length; });
    var pickName = { fifo: 'oldest first, like a queue', lifo: 'newest first, like a stack', alpha: 'smallest name first' }[pick];

    function snap(kind, o) {
      o = o || {};
      steps.push({
        algo: 'kahn', kind: kind, pick: pick, current: current,
        states: copy(states), indeg: copy(indeg), ready: ready.slice(), order: order.slice(),
        edges: copy(edgeSt), pulse: o.pulse || null, stuck: stuck.slice(), cycle: cycle,
        layered: layered, acyclic: acyclic, n: n,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, counters: { emitted: order.length, removed: removed, ready: ready.length }
      });
    }
    function vars(o) { o.ready = ready.slice(); o.order = order.slice(); return o; }
    function settle() { if (current !== null && states[current] === 'active') states[current] = 'done'; }

    if (!n) { snap('empty', { caption: 'The graph has no vertices, so there is nothing to order. The empty order is valid.', flow: 'ok' }); return steps; }

    snap('init', {
      caption: 'Each badge counts the prerequisites a vertex still waits for: its <b>in-degree</b>, the number of arrows pointing into it. A vertex with badge 0 can be placed right now.',
      line: 'init', flow: 'init', vars: vars({ u: null, v: null })
    });
    ids.forEach(function (id) { if (indeg[id] === 0) { ready.push(id); states[id] = 'frontier'; } });
    if (ready.length) {
      snap('sources', {
        caption: ready.length === 1
          ? b(ready[0]) + ' is the only vertex with in-degree 0: nothing has to come before it, so it goes into the ready set first.'
          : joinNames(ready) + ' all have in-degree 0. Nothing has to come before any of them, so they all go into the ready set.',
        line: 'sources', flow: 'sources', vars: vars({ u: null, v: null })
      });
    } else {
      snap('sources', {
        caption: 'Every vertex has at least one arrow pointing into it, so nothing can go first. That already proves a cycle: follow arrows backwards and you never run out.',
        line: 'sources', flow: 'sources', vars: vars({ u: null, v: null })
      });
    }

    while (ready.length) {
      settle();
      var u;
      if (pick === 'lifo') u = ready.pop();
      else if (pick === 'alpha') { var bi = 0; for (var q = 1; q < ready.length; q++) if (natCmp(ready[q], ready[bi]) < 0) bi = q; u = ready.splice(bi, 1)[0]; }
      else u = ready.shift();
      current = u; states[u] = 'active'; order.push(u);
      snap('take', {
        caption: 'Take ' + b(u) + ' (' + pickName + '). Its in-degree is 0, so every vertex it depends on is already in the order: placing it now can never put it before a prerequisite. It becomes position ' + order.length + '.',
        line: 'take', flow: 'take', vars: vars({ u: u, v: null, 'indeg[u]': 0 })
      });
      var outs = G.succ[u];
      for (var i = 0; i < outs.length; i++) {
        var v = outs[i];
        indeg[v]--; removed++;
        edgeSt[edgeKey(u, v)] = 'muted';
        var zero = indeg[v] === 0;
        if (zero) { ready.push(v); states[v] = 'frontier'; }
        snap('relax', {
          pulse: { from: u, to: v },
          caption: 'Remove the arrow ' + b(u + ' → ' + v) + ': ' + esc(u) + ' is placed, so ' + esc(v) + ' waits for one prerequisite fewer. Its in-degree drops to ' + indeg[v] + (zero ? ', so it is ready and joins the ready set.' : ', so it still has to wait.'),
          line: zero ? 'ready' : 'dec', flow: zero ? 'push' : 'dec', vars: vars({ u: u, v: v, 'indeg[v]': indeg[v] })
        });
      }
    }
    settle();
    current = null;

    if (order.length === n) {
      acyclic = true;
      snap('done', {
        caption: 'The ready set is empty and all ' + n + ' vertices are in the order. <b>' + order.map(esc).join(' → ') + '</b> is a valid topological order: every arrow removed had its tail placed first.',
        line: 'done', flow: 'ok', vars: vars({ u: null, v: null })
      });
      layered = true;
      snap('layered', {
        caption: 'Now redraw the same graph in layers: each vertex sits one column to the right of its latest prerequisite. Every arrow points right, which is what a topological order means.',
        line: 'done', flow: 'ok', vars: vars({ u: null, v: null })
      });
    } else {
      acyclic = false;
      ids.forEach(function (id) { if (states[id] !== 'done') { stuck.push(id); states[id] = 'error'; } });
      snap('stuck', {
        caption: 'The ready set is empty, but only ' + order.length + ' of ' + n + ' vertices are placed. ' + joinNames(stuck) + ' still ' + (stuck.length === 1 ? 'has' : 'have') + ' in-degree above 0: each waits for something that is also waiting. That is a <b>cycle</b>, so no order exists.',
        line: 'stuck', flow: 'cycle', vars: vars({ u: null, v: null })
      });
      // walk backwards through unplaced predecessors until a vertex repeats: that loop is a cycle
      var left = {};
      stuck.forEach(function (id) { left[id] = true; });
      var walk = [stuck[0]], at = {}; at[stuck[0]] = 0;
      for (;;) {
        var cur = walk[walk.length - 1], p = null;
        for (var k = 0; k < G.pred[cur].length; k++) if (left[G.pred[cur][k]]) { p = G.pred[cur][k]; break; }
        if (p === null) break; // cannot happen: every unplaced vertex has an unplaced predecessor
        if (p in at) { walk = walk.slice(at[p]); break; }
        at[p] = walk.length; walk.push(p);
      }
      var cyc = walk.slice().reverse(), ce = [];
      cyc.forEach(function (id, j) { ce.push(edgeKey(id, cyc[(j + 1) % cyc.length])); });
      cycle = { nodes: cyc, edges: ce };
      var onCycle = {};
      cyc.forEach(function (id) { onCycle[id] = true; });
      stuck.forEach(function (id) { states[id] = onCycle[id] ? 'error' : 'compare'; });
      snap('cycle', {
        caption: 'Follow the arrows backwards through the stuck vertices and you go round in a circle: <b>' + cyc.concat([cyc[0]]).map(esc).join(' → ') + '</b>. ' +
          (stuck.length > cyc.length ? joinNames(stuck.filter(function (id) { return !onCycle[id]; })) + ' ' + (stuck.length - cyc.length === 1 ? 'is' : 'are') + ' not on the loop, but ' + (stuck.length - cyc.length === 1 ? 'it depends' : 'they depend') + ' on it, so ' + (stuck.length - cyc.length === 1 ? 'it is' : 'they are') + ' stuck too.' : 'Every stuck vertex is on the loop.'),
        line: 'stuck', flow: 'cycle', vars: vars({ u: null, v: null })
      });
    }
    return steps;
  }

  /* ================================================================== DFS topological order */
  /* dfsTopo(graph) -> steps. Colours: white (unseen), grey (on the DFS stack), black (finished).
     Step extras: current, stack [ids], color {id}, states {id: default|active|grey|black|error}, disc, fin,
     finished [ids in finish order], order [ids: reverse finish order so far, front first], edges {key: state},
     pulse, cycle {nodes, edges} | null, edgeClass ('tree'|'back'|'forward'|'cross'|null), acyclic. */
  function dfsTopo(graph) {
    var G = adjacency(graph), ids = G.ids.slice().sort(natCmp), n = ids.length;
    var steps = [];
    var color = {}, disc = {}, fin = {}, stack = [], finished = [], edgeSt = {}, time = 0, checks = 0, current = null, cycle = null, acyclic = null;
    ids.forEach(function (id) { color[id] = 'white'; disc[id] = null; fin[id] = null; });

    function states() {
      var st = {};
      ids.forEach(function (id) { st[id] = color[id] === 'white' ? 'default' : color[id]; });
      if (current !== null && color[current] === 'grey') st[current] = 'active';
      if (cycle) cycle.nodes.forEach(function (id) { st[id] = 'error'; });
      return st;
    }
    function snap(kind, o) {
      o = o || {};
      steps.push({
        algo: 'dfs', kind: kind, current: current, stack: stack.slice(), color: copy(color), states: states(),
        disc: copy(disc), fin: copy(fin), finished: finished.slice(), order: finished.slice().reverse(),
        edges: copy(edgeSt), pulse: o.pulse || null, cycle: cycle, edgeClass: o.edgeClass || null, acyclic: acyclic, n: n,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, counters: { finished: finished.length, checks: checks, depth: stack.length }
      });
    }
    function vars(o) { o.stack = stack.slice(); o.order = finished.slice().reverse(); o.time = time; return o; }

    if (!n) { snap('empty', { caption: 'The graph has no vertices, so there is nothing to order.', flow: 'done' }); return steps; }
    snap('init', {
      caption: 'Every vertex starts <b>white</b>: not seen yet. DFS will turn it <b>grey</b> when it enters and <b>black</b> when it leaves for good. Each time a vertex turns black it goes to the front of the answer.',
      line: 'init', flow: 'init', vars: vars({ u: null, v: null })
    });

    var stop = false;
    function visit(u) {
      color[u] = 'grey'; disc[u] = ++time; stack.push(u); current = u;
      snap('enter', {
        caption: 'Enter ' + b(u) + ': white → grey (clock ' + disc[u] + '). Grey means <em>on the current route</em>: ' + esc(u) + ' is waiting for everything it points to.',
        line: 'enter', flow: 'enter', vars: vars({ u: u, v: null })
      });
      var outs = G.succ[u];
      for (var i = 0; i < outs.length && !stop; i++) {
        var v = outs[i];
        checks++;
        current = u;
        if (color[v] === 'white') {
          edgeSt[edgeKey(u, v)] = 'visited';
          snap('look', {
            pulse: { from: u, to: v }, edgeClass: 'tree',
            caption: 'Look along ' + b(u + ' → ' + v) + '. ' + esc(v) + ' is white, so it is new: dive into it. ' + esc(u) + ' will stay grey until ' + esc(v) + ' and everything after it is done.',
            line: 'edge', flow: 'edge', vars: vars({ u: u, v: v, 'color[v]': 'white' })
          });
          visit(v);
          current = u;
        } else if (color[v] === 'grey') {
          edgeSt[edgeKey(u, v)] = 'error';
          var at = stack.indexOf(v), nodes = stack.slice(at), es = [];
          nodes.forEach(function (id, j) { es.push(edgeKey(id, nodes[(j + 1) % nodes.length])); });
          cycle = { nodes: nodes, edges: es };
          acyclic = false; stop = true;
          snap('back', {
            pulse: { from: u, to: v }, edgeClass: 'back',
            caption: 'Look along ' + b(u + ' → ' + v) + '. ' + esc(v) + ' is <b>grey</b>: it is still on the route that led here, so ' + esc(u) + ' depends on something that depends on ' + esc(u) + '. This <b>back edge</b> closes the cycle ' + nodes.concat([nodes[0]]).map(esc).join(' → ') + '. No order exists.',
            line: 'back', flow: 'back', vars: vars({ u: u, v: v, 'color[v]': 'grey' })
          });
        } else {
          var cls = disc[v] > disc[u] ? 'forward' : 'cross';
          edgeSt[edgeKey(u, v)] = 'muted';
          snap('skip', {
            pulse: { from: u, to: v }, edgeClass: cls,
            caption: 'Look along ' + b(u + ' → ' + v) + '. ' + esc(v) + ' is already <b>black</b>: it and everything it leads to are finished, and ' + esc(v) + ' is already in the answer. So ' + esc(u) + ' will end up in front of it. Nothing to do.',
            line: 'edge', flow: 'skip', vars: vars({ u: u, v: v, 'color[v]': 'black' })
          });
        }
      }
      if (stop) return;
      color[u] = 'black'; fin[u] = ++time; stack.pop(); finished.push(u);
      current = stack.length ? stack[stack.length - 1] : null;
      snap('finish', {
        caption: 'Every vertex ' + esc(u) + ' points to is black, so ' + b(u) + ' turns black (clock ' + fin[u] + ') and goes to the <b>front</b> of the answer. Everything already in the answer is something ' + esc(u) + ' must come before, or is unrelated to it.',
        line: 'finish', flow: 'finish', vars: vars({ u: u, v: null })
      });
    }
    for (var s = 0; s < ids.length && !stop; s++) {
      var r = ids[s];
      if (color[r] !== 'white') continue;
      if (finished.length || s > 0) {
        current = null;
        snap('scan', {
          caption: 'Back at the top-level loop: ' + b(r) + ' is still white, so nothing reached it yet. Start a fresh dive from it.',
          line: 'scan', flow: 'scan', vars: vars({ u: r, v: null })
        });
      }
      visit(r);
    }
    if (stop) {
      snap('cycle', {
        caption: 'Stop: a cycle means the dependencies contradict each other, and no order can satisfy them all. (Finishing the search would only give an order that breaks the cycle arrow.)',
        line: 'back', flow: 'back', vars: vars({ u: null, v: null })
      });
      return steps;
    }
    acyclic = true; current = null;
    var ord = finished.slice().reverse();
    snap('done', {
      caption: 'All ' + n + ' vertices are black and no back edge appeared. Read the answer from the front: <b>' + ord.map(esc).join(' → ') + '</b>. For every arrow u → v, v finished first (it is black when u is examined, or finishes inside u), so u sits in front of v.',
      line: 'done', flow: 'done', vars: vars({ u: null, v: null })
    });
    return steps;
  }

  /* ================================================================== Kosaraju SCC */
  /* kosaraju(graph) -> steps. Phases: 1 = DFS on the graph (finish order), 2 = DFS on the reversed graph in
     decreasing finish order (each tree is one component), 3 = condensation.
     Step extras: phase, transposed, current, color, comp {id: k|null}, comps [[ids]] (finished), open [ids] (component
     being built), finished [ids in finish order], remaining [ids not yet popped in pass 2, top last], edges {key: state},
     pulse, disc/fin, condensation {nodes: [{id, members}], edges: [[a, b]], order} | null, stage. */
  function kosaraju(graph) {
    var G = adjacency(graph), ids = G.ids.slice().sort(natCmp), n = ids.length;
    var steps = [];
    var color = {}, disc = {}, fin = {}, comp = {}, comps = [], open = [], finished = [], remaining = [], edgeSt = {};
    var time = 0, phase = 1, transposed = false, current = null, stack = [], condensation = null, stage = null, visits = 0;
    ids.forEach(function (id) { color[id] = 'white'; disc[id] = null; fin[id] = null; comp[id] = null; });

    function states() {
      var st = {};
      ids.forEach(function (id) {
        if (phase === 1) st[id] = color[id] === 'white' ? 'default' : color[id];
        else st[id] = comp[id] !== null ? 'cc' : 'default';
      });
      if (current !== null && phase === 1 && color[current] === 'grey') st[current] = 'active';
      return st;
    }
    function snap(kind, o) {
      o = o || {};
      steps.push({
        algo: 'scc', kind: kind, phase: phase, transposed: transposed, current: current, stack: stack.slice(),
        color: copy(color), comp: copy(comp), states: states(), disc: copy(disc), fin: copy(fin),
        comps: comps.map(function (c) { return c.slice(); }), open: open.slice(), finished: finished.slice(), remaining: remaining.slice(),
        edges: copy(edgeSt), pulse: o.pulse || null, condensation: condensation, stage: stage, n: n,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, counters: { components: comps.length, visited: visits, finished: finished.length }
      });
    }
    function vars(o) { o.phase = phase; o.finishStack = finished.slice(); o.components = comps.length; return o; }

    if (!n) { snap('empty', { caption: 'The graph has no vertices, so there are no components.', flow: 'done' }); return steps; }

    snap('init', {
      caption: 'Two passes. Pass 1 runs an ordinary DFS and records the order in which vertices <b>finish</b>. Pass 2 walks the graph with every arrow reversed, starting from the latest finisher each time. Each walk in pass 2 collects exactly one component.',
      line: 'init', flow: 'init', vars: vars({ u: null })
    });

    function visit1(u) {
      color[u] = 'grey'; disc[u] = ++time; stack.push(u); current = u; visits++;
      snap('enter', {
        caption: 'Pass 1: enter ' + b(u) + ' (white → grey). Follow its arrows to anything new before finishing it.',
        line: 'enter1', flow: 'enter1', vars: vars({ u: u })
      });
      G.succ[u].forEach(function (v) {
        if (color[v] === 'white') {
          edgeSt[edgeKey(u, v)] = 'visited';
          snap('look', { pulse: { from: u, to: v }, caption: 'Pass 1: ' + b(u + ' → ' + v) + ' leads to a white vertex, so dive into ' + esc(v) + '.', line: 'enter1', flow: 'enter1', vars: vars({ u: u }) });
          visit1(v);
          current = u;
        }
      });
      color[u] = 'black'; fin[u] = ++time; stack.pop(); finished.push(u);
      current = stack.length ? stack[stack.length - 1] : null;
      snap('finish', {
        caption: 'Pass 1: ' + b(u) + ' has nothing new left, so it finishes and is pushed on the finish stack (position ' + finished.length + ').',
        line: 'finish1', flow: 'finish1', vars: vars({ u: u })
      });
    }
    ids.forEach(function (r) { if (color[r] === 'white') visit1(r); });
    current = null;
    snap('pass1done', {
      caption: 'Pass 1 is done. The finish stack holds ' + finished.map(esc).join(', ') + ' (last finished on top). The vertex on top finished last, so it lies in a component that nothing else can reach.',
      line: 'flip', flow: 'finish1', vars: vars({ u: null })
    });

    // pass 2
    phase = 2; transposed = true; edgeSt = {}; remaining = finished.slice();
    snap('flip', {
      caption: 'Reverse every arrow. Inside a cycle you can still get from any vertex to any other, but between two components the arrows now point the other way, so a walk cannot leak out of the component it starts in.',
      line: 'flip', flow: 'flip', vars: vars({ u: null })
    });
    var k = 0;
    function visit2(u) {
      comp[u] = k; open.push(u); visits++; current = u;
      snap('visit', {
        caption: 'Pass 2: add ' + b(u) + ' to component ' + k + '. Follow the reversed arrows to vertices that have no component yet.',
        line: 'visit', flow: 'visit', vars: vars({ u: u })
      });
      var back = G.pred[u]; // successors in the reversed graph
      back.forEach(function (v) {
        if (comp[v] === null) {
          edgeSt[edgeKey(v, u)] = 'visited';
          snap('look', { pulse: { from: u, to: v }, caption: 'Pass 2: follow the arrow ' + b(v + ' → ' + u) + ' backwards, from ' + esc(u) + ' to ' + esc(v) + '. ' + esc(v) + ' has no component yet, so it joins too.', line: 'visit', flow: 'visit', vars: vars({ u: u }) });
          visit2(v);
          current = u;
        }
      });
    }
    while (remaining.length) {
      var top = remaining.pop();
      if (comp[top] !== null) {
        current = null;
        snap('skip', { caption: 'Pop ' + b(top) + ': it already belongs to component ' + comp[top] + ', so skip it.', line: 'pop', flow: 'pop', vars: vars({ u: top }) });
        continue;
      }
      k++; open = []; current = top;
      snap('take', {
        caption: 'Pop ' + b(top) + ' from the finish stack: no component yet, so start component ' + k + ' with a DFS on the reversed graph.',
        line: 'pop', flow: 'pop', vars: vars({ u: top })
      });
      visit2(top);
      comps.push(open.slice());
      current = null;
      snap('compdone', {
        caption: 'The walk cannot go further: component ' + k + ' is <b>{' + open.map(esc).join(', ') + '}</b>. Everyone in it can reach everyone else; nobody outside it can do both.',
        line: 'comp', flow: 'comp', vars: vars({ u: null })
      });
      open = [];
    }

    // phase 3: condensation
    phase = 3; transposed = false; edgeSt = {};
    var cn = comps.map(function (mem, i) { return { id: 'C' + (i + 1), members: mem.slice().sort(natCmp) }; });
    var ce = [], ck = {};
    G.edges.forEach(function (e) {
      var a = comp[e.from], c = comp[e.to];
      if (a !== c) { var key = 'C' + a + '-C' + c; if (!ck[key]) { ck[key] = true; ce.push(['C' + a, 'C' + c]); } }
    });
    var singles = cn.filter(function (c) { return c.members.length === 1; }).length;
    stage = 'gather';
    snap('gather', {
      caption: 'Each component is a knot of mutual dependence, so pull each one together. Nothing inside a knot can be ordered, but the knots themselves can be.',
      line: 'condense', flow: 'condense', vars: vars({ u: null })
    });
    condensation = { nodes: cn, edges: ce, order: null };
    stage = 'condense';
    snap('condense', {
      caption: 'Replace each component by a single vertex and keep one arrow between two components if any arrow went between their members. That is the <b>condensation</b>: ' + plural(cn.length, 'vertex', 'vertices') + ' and ' + plural(ce.length, 'arrow') + ', and it can never contain a cycle' + (singles === cn.length ? ' (here every component is one vertex, so the graph was already acyclic)' : '') + '.',
      line: 'condense', flow: 'condense', vars: vars({ u: null })
    });
    condensation = { nodes: cn, edges: ce, order: cn.map(function (c) { return c.id; }) };
    stage = 'layout';
    snap('layout', {
      caption: 'Because the condensation is a DAG, it has a topological order, and pass 2 already produced it: components were found source first, so ' + cn.map(function (c) { return c.id; }).join(' → ') + ' is a valid order. Every arrow points right.',
      line: 'condense', flow: 'condense', vars: vars({ u: null })
    });
    return steps;
  }

  /* ================================================================== Tarjan (reference) */
  /* tarjanScc(graph) -> {comps: [[ids]] each sorted, comp: {id: index}} with components sorted by their first id. */
  function tarjanScc(graph) {
    var G = adjacency(graph), ids = G.ids.slice().sort(natCmp);
    var index = 0, idx = {}, low = {}, on = {}, st = [], out = [];
    function strong(v) {
      idx[v] = low[v] = index++; st.push(v); on[v] = true;
      G.succ[v].forEach(function (w) {
        if (idx[w] === undefined) { strong(w); low[v] = Math.min(low[v], low[w]); }
        else if (on[w]) low[v] = Math.min(low[v], idx[w]);
      });
      if (low[v] === idx[v]) {
        var c = [], w;
        do { w = st.pop(); on[w] = false; c.push(w); } while (w !== v);
        out.push(c.sort(natCmp));
      }
    }
    ids.forEach(function (v) { if (idx[v] === undefined) strong(v); });
    out.sort(function (a, c) { return natCmp(a[0], c[0]); });
    var comp = {};
    out.forEach(function (c, i) { c.forEach(function (id) { comp[id] = i; }); });
    return { comps: out, comp: comp };
  }

  /* ================================================================== critical path */
  /* longestPath(graph, weights) -> steps. weights {id: duration} (default 1). Vertices are processed in a topological
     order; ef[v] = weight[v] + max(ef[u] for u -> v). Ends by tracing the critical path back. */
  function longestPath(graph, weights) {
    var G = adjacency(graph), n = G.ids.length, steps = [];
    weights = weights || {};
    function w(id) { return weights[id] === undefined ? 1 : weights[id]; }
    var kh = kahn(graph);
    var order = kh.length && kh[kh.length - 1].acyclic ? kh[kh.length - 1].order : null;
    var ef = {}, via = {}, states = {}, edgeSt = {}, current = null, path = null, done = 0, latest = 0;
    G.ids.forEach(function (id) { ef[id] = null; via[id] = null; states[id] = 'default'; });
    function snap(kind, o) {
      o = o || {};
      if (o.best === undefined) o.best = latest;
      steps.push({
        algo: 'path', kind: kind, current: current, states: copy(states), ef: copy(ef), via: copy(via), weights: copy(weights),
        edges: copy(edgeSt), path: path ? path.slice() : null, order: order ? order.slice() : [], pulse: o.pulse || null,
        caption: o.caption || '', line: o.line === undefined ? null : o.line, vars: o.vars || {}, counters: { done: done, best: o.best === undefined ? 0 : o.best }
      });
    }
    if (!n) { snap('empty', { caption: 'No tasks, no schedule.' }); return steps; }
    if (!order) { snap('cyclic', { caption: 'These tasks contain a cycle, so there is no earliest finish time: each one waits for itself.' }); return steps; }
    snap('init', { caption: 'Each task shows how long it takes. A task can start only when all its prerequisites have finished, so its earliest finish is its own time plus the latest finish among its prerequisites.', line: 'init' });
    order.forEach(function (v) {
      current = v; states[v] = 'active';
      var best = 0, from = null;
      G.pred[v].forEach(function (u) { if (from === null || ef[u] > best) { best = ef[u]; from = u; } });
      ef[v] = best + w(v); via[v] = from;
      done++; latest = Math.max(latest, ef[v]);
      if (from !== null) G.pred[v].forEach(function (u) { edgeSt[edgeKey(u, v)] = u === from ? 'compare' : 'muted'; });
      snap('eval', {
        caption: from === null
          ? b(v) + ' has no prerequisites, so it can start at time 0 and finishes at ' + ef[v] + '.'
          : G.pred[v].length === 1
            ? b(v) + ' waits for ' + esc(from) + ' (finishes at ' + ef[from] + '), then takes ' + w(v) + ': it finishes at ' + ef[v] + '.'
            : b(v) + ' must wait for all of ' + joinNames(G.pred[v]) + '. The last one to finish is ' + esc(from) + ' at ' + ef[from] + ', so ' + esc(v) + ' starts then and finishes at ' + ef[v] + '.',
        line: 'eval', vars: { v: v, wait: from === null ? 0 : ef[from], 'ef[v]': ef[v] }
      });
      states[v] = 'done';
    });
    current = null;
    var endNode = null;
    G.ids.slice().sort(natCmp).forEach(function (id) { if (endNode === null || ef[id] > ef[endNode]) endNode = id; });
    snap('finish', { caption: 'All tasks have a finish time. The whole project cannot finish before <b>' + ef[endNode] + '</b>, the largest value, at ' + b(endNode) + '.', line: 'best', vars: { total: ef[endNode] } });
    path = [];
    for (var at = endNode; at !== null; at = via[at]) path.unshift(at);
    Object.keys(edgeSt).forEach(function (k) { edgeSt[k] = 'muted'; });
    path.forEach(function (id, i) { states[id] = 'path'; if (i) edgeSt[edgeKey(path[i - 1], id)] = 'path'; });
    snap('path', { caption: 'Follow the “waits for” choices backwards from ' + b(endNode) + ': <b>' + path.map(esc).join(' → ') + '</b> is the <b>critical path</b>. Delay any task on it and the whole project slips; tasks off it have slack.', line: 'trace', vars: { total: ef[endNode] } });
    return steps;
  }

  /* ================================================================== levels ("semesters") */
  function kahnLevels(graph) {
    var G = adjacency(graph), indeg = {}, cur = [], levels = [], seen = 0;
    G.ids.slice().sort(natCmp).forEach(function (id) { indeg[id] = G.pred[id].length; if (!indeg[id]) cur.push(id); });
    while (cur.length) {
      levels.push(cur.slice()); seen += cur.length;
      var next = [];
      cur.forEach(function (u) { G.succ[u].forEach(function (v) { if (--indeg[v] === 0) next.push(v); }); });
      cur = next.sort(natCmp);
    }
    return { levels: levels, rounds: levels.length, cyclic: seen < G.ids.length };
  }

  /* ================================================================== plain results with operation counts */
  /* Steps counted: Kahn reads every edge once to count in-degrees, takes every vertex once, and removes every edge once. */
  function kahnResult(graph) {
    var G = adjacency(graph), indeg = {}, ready = [], order = [], ops = { indegree: G.edges.length, takes: 0, removals: 0 };
    G.ids.slice().sort(natCmp).forEach(function (id) { indeg[id] = G.pred[id].length; if (!indeg[id]) ready.push(id); });
    while (ready.length) {
      var u = ready.shift(); order.push(u); ops.takes++;
      G.succ[u].forEach(function (v) { ops.removals++; if (--indeg[v] === 0) ready.push(v); });
    }
    return { order: order, cyclic: order.length < G.ids.length, n: G.ids.length, m: G.edges.length, ops: ops, steps: ops.indegree + ops.takes + ops.removals };
  }
  function dfsResult(graph) {
    var G = adjacency(graph), color = {}, fin = [], enters = 0, checks = 0, cyclic = false;
    G.ids.forEach(function (id) { color[id] = 0; });
    function visit(u) {
      color[u] = 1; enters++;
      G.succ[u].forEach(function (v) {
        checks++;
        if (color[v] === 1) cyclic = true;
        else if (color[v] === 0) visit(v);
      });
      color[u] = 2; fin.push(u);
    }
    G.ids.slice().sort(natCmp).forEach(function (id) { if (color[id] === 0) visit(id); });
    return { order: fin.slice().reverse(), cyclic: cyclic, n: G.ids.length, m: G.edges.length, enters: enters, checks: checks, steps: enters + checks };
  }

  /* ================================================================== generators of inputs */
  /* randomDag(n, m, rng) -> {nodes: ['V0', ...], edges}: a random permutation is the hidden order; every edge goes forward in it. */
  function randomDag(n, m, rng) {
    rng = rng || Math.random;
    var ids = [], perm = [];
    for (var i = 0; i < n; i++) { ids.push('V' + i); perm.push(i); }
    for (i = n - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    var pairs = [];
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) pairs.push([perm[i], perm[j]]);
    for (i = pairs.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = pairs[i]; pairs[i] = pairs[j]; pairs[j] = t; }
    m = Math.min(m, pairs.length);
    var edges = pairs.slice(0, m).map(function (p) { return ['V' + p[0], 'V' + p[1]]; });
    return { nodes: ids, edges: edges, hidden: perm.map(function (p) { return 'V' + p; }) };
  }

  /* ordersAsEdgesGrow(n, rng) -> [count of valid orders after 0, 1, 2 ... edges], adding edges of a random DAG one by one. */
  function ordersAsEdgesGrow(n, rng, maxEdges) {
    var full = randomDag(n, n * (n - 1) / 2, rng), out = [], edges = [];
    var limit = Math.min(maxEdges === undefined ? full.edges.length : maxEdges, full.edges.length);
    for (var k = 0; k <= limit; k++) { out.push(countOrders({ nodes: full.nodes, edges: edges.slice() })); if (k < limit) edges.push(full.edges[k]); }
    return out;
  }

  return {
    LIMITS: LIMITS, natCmp: natCmp, edgeKey: edgeKey, adjacency: adjacency,
    parseEdgeList: parseEdgeList, isTopoOrder: isTopoOrder, countOrders: countOrders, randomValidOrder: randomValidOrder,
    findCycle: findCycle, kahn: kahn, dfsTopo: dfsTopo, kosaraju: kosaraju, tarjanScc: tarjanScc,
    longestPath: longestPath, kahnLevels: kahnLevels, kahnResult: kahnResult, dfsResult: dfsResult,
    randomDag: randomDag, ordersAsEdgesGrow: ordersAsEdgesGrow
  };
}));
