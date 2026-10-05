/* Lesson 25 · Graphs & representations — pure step generators and helpers (no DOM).

   Browser: VDSA.algos.graphs.  Node: module.exports.

     var G = VDSA.algos.graphs;
     G.parseEdgeList('A-B, B-C, D', {directed})   -> {values: {nodes, edges, directed}, error}
     G.build(graph)                               -> rep: ids, V, E, has[i][j], matrix[i][j], adj {id: [{to, w}]},
                                                     edgeList [{from, to, w}], directed, weighted, index {id: i}
     G.degrees(rep)                               -> {deg, inDeg, outDeg, sum, edges}   (handshake lemma: sum = 2E)
     G.memory(V, E, directed)                     -> cells for matrix / list / edge list
     G.density(V, E, directed)                    -> E divided by the most edges a simple graph on V vertices can have
     G.components(rep)                            -> weakly connected components (arrays of ids)
     G.shortestPath(rep, s, t)                    -> fewest-edge path following edge directions, or null
     G.simpleCycles(rep, max)                     -> simple cycles as arrays of ids (undirected: length >= 3)
     G.opsSteps(rep, op, u, v)                    -> steps comparing matrix and list ('edge' | 'neighbours' | 'all')
     G.biColorSteps(graph, start)                 -> BFS two-colouring steps (odd cycle -> conflict)
     G.isBipartiteRef(graph)                      -> brute-force reference (for tests)
     G.gridNeighbours(rows, cols, walls, r, c, diag)   neighbours of a grid cell, computed on demand
     G.KONIGSBERG                                 the four land masses and seven bridges

   Graph input: {nodes: ['A', ...] | [{id}], edges: [['A', 'B'] | ['A', 'B', weight] | {from, to, weight}], directed}.
   Repeated edges and self-loops are dropped (a simple graph); undirected edges are stored both ways.
   Every ops / colouring step: {kind, caption (why), line (code label(s)), vars, counters (same keys on every step), ...}. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) {
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.graphs = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { maxNodes: 12, maxEdges: 40 };

  /* ================================================================== small helpers */
  function natCmp(a, b) {
    a = String(a); b = String(b);
    var ra = a.match(/\d+|\D+/g) || [], rb = b.match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ra.length, rb.length); i++) {
      var x = ra[i], y = rb[i];
      if (/^\d/.test(x) && /^\d/.test(y)) { var d = parseInt(x, 10) - parseInt(y, 10); if (d) return d < 0 ? -1 : 1; }
      if (x !== y) return x < y ? -1 : 1;
    }
    return ra.length - rb.length;
  }
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(x) { return '<b>' + esc(x) + '</b>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ================================================================== parsing */
  /* "A-B, B-C, D" -> vertices in order of first mention; a lone name is a vertex with no edges. */
  function parseEdgeList(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.maxNodes, maxEdges = opts.maxEdges || LIMITS.maxEdges;
    var directed = !!opts.directed;
    var nodes = [], seenN = {}, edges = [], seenE = {};
    var parts = String(text === undefined || text === null ? '' : text).split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) return { values: null, error: 'Type at least one vertex or edge, for example A-B, B-C.' };
    function add(id) { if (!seenN[id]) { seenN[id] = true; nodes.push(id); } }
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var m = /^([A-Za-z0-9_]{1,4})\s*(?:->|→|-|–|—|>)\s*([A-Za-z0-9_]{1,4})$/.exec(p);
      if (m) {
        if (m[1] === m[2]) return { values: null, error: '"' + p + '" joins a vertex to itself. Self-loops are left out of this lesson: remove it.' };
        add(m[1]); add(m[2]);
        var k = directed ? m[1] + '>' + m[2] : (natCmp(m[1], m[2]) <= 0 ? m[1] + '-' + m[2] : m[2] + '-' + m[1]);
        if (!seenE[k]) { seenE[k] = true; edges.push([m[1], m[2]]); }
      } else if (/^[A-Za-z0-9_]{1,4}$/.test(p)) add(p);
      else return { values: null, error: 'Could not read "' + p + '". Write edges as A-B and separate them with commas (names of up to 4 letters or digits).' };
      if (nodes.length > maxNodes) return { values: null, error: 'That is more than ' + maxNodes + ' vertices. Keep it to ' + maxNodes + ' so the matrix stays readable.' };
    }
    if (edges.length > maxEdges) return { values: null, error: 'That is more than ' + maxEdges + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    return { values: { nodes: nodes, edges: edges, directed: directed }, error: null };
  }

  /* ================================================================== representations */
  function build(graph) {
    var directed = !!(graph && graph.directed);
    var ids = [], seen = {};
    function add(id) { id = String(id); if (!seen[id]) { seen[id] = true; ids.push(id); } }
    ((graph && graph.nodes) || []).forEach(function (n) { if (n !== null && n !== undefined) add(typeof n === 'object' ? n.id : n); });
    var raw = [];
    ((graph && graph.edges) || []).forEach(function (e) {
      if (!e) return;
      var from = Array.isArray(e) ? e[0] : e.from, to = Array.isArray(e) ? e[1] : e.to;
      var w = Array.isArray(e) ? e[2] : e.weight;
      if (from === undefined || to === undefined || from === null || to === null) return;
      from = String(from); to = String(to);
      add(from); add(to);
      raw.push({ from: from, to: to, w: w === undefined || w === null || w === '' ? null : +w });
    });
    ids.sort(natCmp);
    var index = {};
    ids.forEach(function (id, i) { index[id] = i; });
    var V = ids.length;
    var has = ids.map(function () { return ids.map(function () { return false; }); });
    var matrix = ids.map(function () { return ids.map(function () { return 0; }); });
    var adjMap = {}; ids.forEach(function (id) { adjMap[id] = []; });
    var edgeList = [], keys = {}, weighted = false;
    raw.forEach(function (e) {
      if (e.from === e.to) return;
      var a = e.from, c = e.to;
      var k = directed ? a + '>' + c : (natCmp(a, c) <= 0 ? a + '-' + c : c + '-' + a);
      if (keys[k]) return;
      keys[k] = true;
      if (e.w !== null) weighted = true;
      edgeList.push({ from: a, to: c, w: e.w });
    });
    edgeList.forEach(function (e) {
      var w = e.w === null ? 1 : e.w, i = index[e.from], j = index[e.to];
      has[i][j] = true; matrix[i][j] = w; adjMap[e.from].push({ to: e.to, w: e.w === null ? 1 : e.w });
      if (!directed) { has[j][i] = true; matrix[j][i] = w; adjMap[e.to].push({ to: e.from, w: e.w === null ? 1 : e.w }); }
    });
    ids.forEach(function (id) { adjMap[id].sort(function (p, q) { return natCmp(p.to, q.to); }); });
    return { ids: ids, index: index, V: V, E: edgeList.length, has: has, matrix: matrix, adj: adjMap, edgeList: edgeList, directed: directed, weighted: weighted };
  }

  function degrees(rep) {
    var deg = {}, inDeg = {}, outDeg = {}, sum = 0;
    rep.ids.forEach(function (id) { deg[id] = 0; inDeg[id] = 0; outDeg[id] = 0; });
    rep.edgeList.forEach(function (e) {
      outDeg[e.from]++; inDeg[e.to]++;
      deg[e.from]++; deg[e.to]++;
    });
    rep.ids.forEach(function (id) { sum += deg[id]; });
    return { deg: deg, inDeg: inDeg, outDeg: outDeg, sum: sum, edges: rep.E };
  }

  /* Cells of memory: an adjacency matrix has V x V entries; an adjacency list has V heads plus one entry per edge end;
     an edge list has one pair per edge (2 numbers). */
  function memory(V, E, directed) {
    return { matrix: V * V, list: V + (directed ? E : 2 * E), edgeList: 2 * E };
  }
  function density(V, E, directed) {
    var max = directed ? V * (V - 1) : V * (V - 1) / 2;
    return max > 0 ? E / max : 0;
  }

  /* ================================================================== structure: components, paths, cycles */
  function components(rep) {
    var nb = {};
    rep.ids.forEach(function (id) { nb[id] = []; });
    rep.edgeList.forEach(function (e) { nb[e.from].push(e.to); nb[e.to].push(e.from); });
    var seen = {}, out = [];
    rep.ids.forEach(function (s) {
      if (seen[s]) return;
      var comp = [], q = [s]; seen[s] = true;
      while (q.length) {
        var u = q.shift(); comp.push(u);
        nb[u].sort(natCmp).forEach(function (w) { if (!seen[w]) { seen[w] = true; q.push(w); } });
      }
      comp.sort(natCmp);
      out.push(comp);
    });
    return out;
  }

  function shortestPath(rep, s, t) {
    if (rep.index[s] === undefined || rep.index[t] === undefined) return null;
    if (s === t) return [s];
    var parent = {}; parent[s] = null;
    var q = [s];
    while (q.length) {
      var u = q.shift();
      var nbrs = rep.adj[u];
      for (var i = 0; i < nbrs.length; i++) {
        var w = nbrs[i].to;
        if (w in parent) continue;
        parent[w] = u;
        if (w === t) {
          var path = [t], x = t;
          while (parent[x] !== null) { x = parent[x]; path.push(x); }
          return path.reverse();
        }
        q.push(w);
      }
    }
    return null;
  }

  /* Simple cycles: start at the smallest-index vertex and only visit larger ones, so each cycle is found once
     (undirected cycles once per direction: keep the direction whose second vertex is smaller than its last). */
  function simpleCycles(rep, max) {
    max = max || 60;
    var out = [], V = rep.V, ids = rep.ids;
    function nbrs(i) { return rep.adj[ids[i]].map(function (e) { return rep.index[e.to]; }); }
    for (var s = 0; s < V && out.length < max; s++) {
      (function dfs(u, path, on) {
        if (out.length >= max) return;
        nbrs(u).forEach(function (w) {
          if (out.length >= max) return;
          if (w === s) {
            if (rep.directed) { if (path.length >= 2) out.push(path.map(function (i) { return ids[i]; })); }
            else if (path.length >= 3 && path[1] < path[path.length - 1]) out.push(path.map(function (i) { return ids[i]; }));
            return;
          }
          if (w < s || on[w]) return;
          on[w] = true; path.push(w);
          dfs(w, path, on);
          path.pop(); on[w] = false;
        });
      }(s, [s], (function () { var o = {}; o[s] = true; return o; }())));
    }
    return out;
  }

  /* Euler: a connected graph has a walk using every edge once iff it has 0 or 2 odd-degree vertices. */
  function oddVertices(rep) {
    var d = degrees(rep).deg;
    return rep.ids.filter(function (id) { return d[id] % 2 === 1; });
  }
  function eulerKind(rep) {
    var edgeVerts = rep.ids.filter(function (id) { return rep.adj[id].length > 0 || rep.edgeList.some(function (e) { return e.to === id; }); });
    var comps = components(rep).filter(function (c) { return c.some(function (id) { return edgeVerts.indexOf(id) >= 0; }); });
    if (comps.length > 1) return 'none';
    var odd = oddVertices(rep).length;
    return odd === 0 ? 'circuit' : odd === 2 ? 'trail' : 'none';
  }

  /* Königsberg, 1735: four land masses, seven bridges (two pairs are parallel). */
  var KONIGSBERG = {
    lands: ['N', 'I', 'E', 'S'],
    names: { N: 'North bank', I: 'Kneiphof island', E: 'East island', S: 'South bank' },
    bridges: [['N', 'I'], ['N', 'I'], ['S', 'I'], ['S', 'I'], ['N', 'E'], ['S', 'E'], ['I', 'E']]
  };
  function konigsbergDegrees() {
    var d = {};
    KONIGSBERG.lands.forEach(function (l) { d[l] = 0; });
    KONIGSBERG.bridges.forEach(function (br) { d[br[0]]++; d[br[1]]++; });
    return d;
  }

  /* ================================================================== matrix vs list: operation traces */
  /* opsSteps(rep, op, u, v): the matrix and the list answer the same question side by side, round by round.
     op = 'edge' (is there an edge u -> v?), 'neighbours' (list u's neighbours), 'all' (visit every edge).
     Snapshot fields: mCell [r, c] | null, mSeen [[r, c]] (cells read so far), mHit [[r, c]] (cells holding an edge),
     lRow (row of u, or null), lCur [row, k] | null, lSeen {row: entries read}, lHit [[row, k]], mDone, lDone. */
  function opsSteps(rep, op, u, v) {
    var steps = [], V = rep.V, ids = rep.ids;
    var iu = rep.index[u], iv = rep.index[v];
    var mSeen = [], mHit = [], lSeen = {}, lHit = [], mCount = 0, lCount = 0;
    var arrow = rep.directed ? '→' : '–';
    function snap(kind, o, caption, line, vars, mDone, lDone) {
      steps.push({
        kind: kind, op: op, u: u === undefined ? null : u, v: v === undefined ? null : v,
        mCell: o.mCell || null, mRow: o.mRow === undefined ? null : o.mRow, mSeen: mSeen.slice(), mHit: mHit.slice(),
        lRow: o.lRow === undefined ? null : o.lRow, lCur: o.lCur || null, lSeen: JSON.parse(JSON.stringify(lSeen)), lHit: lHit.slice(),
        mDone: !!mDone, lDone: !!lDone,
        caption: caption, line: line || null, vars: vars || {},
        counters: { matrix: mCount, list: lCount }
      });
    }
    if (op === 'edge') {
      var items = rep.adj[u], target = -1;
      for (var k = 0; k < items.length; k++) if (items[k].to === v) { target = k; break; }
      var found = rep.has[iu][iv];
      var listRounds = found ? target + 1 : items.length;
      var rounds = Math.max(1, listRounds);
      snap('start', { lRow: iu }, 'Question: is there an edge ' + b(u) + arrow + b(v) + '? The matrix and the list will both answer it. Count how many memory entries each has to read.',
        null, { u: u, v: v }, false, false);
      for (var r = 1; r <= rounds; r++) {
        var mDoneNow = true, lDoneNow, caps = [], line = [];
        var o = { lRow: iu };
        if (r === 1) {
          mSeen.push([iu, iv]); mCount++;
          if (found) mHit.push([iu, iv]);
          o.mCell = [iu, iv]; o.mRow = iu;
          caps.push('<b>Matrix:</b> read the single cell <code>M[' + u + '][' + v + ']</code>. It holds ' + (found ? '<b>1</b>, so the edge exists' : '<b>0</b>, so there is no edge') + '. One read, however big the graph.');
          line.push('mcheck');
        } else caps.push('<b>Matrix:</b> already answered.');
        if (r <= listRounds) {
          lSeen[iu] = r; lCount++;
          o.lCur = [iu, r - 1];
          var here = items[r - 1].to;
          if (here === v) { lHit.push([iu, r - 1]); caps.push('<b>List:</b> entry ' + r + ' of ' + esc(u) + '’s list is ' + b(here) + ', the vertex we wanted. Found after ' + plural(r, 'read') + '.'); line.push('lhit'); lDoneNow = true; }
          else { caps.push('<b>List:</b> entry ' + r + ' is ' + b(here) + ', not ' + esc(v) + '. The list is unordered, so the scan must continue.'); line.push('lcmp'); lDoneNow = r === listRounds && !found; if (lDoneNow) caps[caps.length - 1] += ' That was the last entry: no edge.'; }
        } else if (listRounds === 0) {
          lDoneNow = true; caps.push('<b>List:</b> ' + esc(u) + ' has no neighbours, so its list is empty. Zero reads settle it.'); line.push('lnone');
        } else lDoneNow = true;
        snap(r === rounds ? 'answer' : 'probe', o, caps.join(' '), line, { u: u, v: v }, mDoneNow, lDoneNow || r >= listRounds);
      }
      snap('done', { lRow: iu }, 'Both agree: ' + (found ? 'the edge exists' : 'no such edge') + '. Matrix reads: <b>' + mCount + '</b>. List reads: <b>' + lCount + '</b>' +
        (lCount > mCount ? ', and the list gets slower as ' + esc(u) + ' gains neighbours.' : '.'), null, { u: u, v: v }, true, true);
      return steps;
    }
    if (op === 'neighbours') {
      var nb = rep.adj[u], deg = nb.length;
      var jlist = {};
      snap('start', { lRow: iu, mRow: iu }, 'Question: which vertices does ' + b(u) + ' point to' + (rep.directed ? '' : ' (its neighbours)') + '? The matrix must scan row ' + esc(u) + ' cell by cell; the list simply holds them.',
        null, { u: u, v: '–' }, false, false);
      var lRounds = deg;
      for (var j = 0; j < V; j++) {
        var oo = { mCell: [iu, j], mRow: iu, lRow: iu };
        mSeen.push([iu, j]); mCount++;
        var hit = rep.has[iu][j];
        if (hit) mHit.push([iu, j]);
        var cp = ['<b>Matrix:</b> read <code>M[' + u + '][' + ids[j] + ']</code> = ' + (hit ? '<b>1</b>: ' + b(ids[j]) + ' is a neighbour.' : '0: nothing here.')];
        var ln = ['mtest'];
        var mFinished = j === V - 1;
        if (j < lRounds) {
          lSeen[iu] = j + 1; lCount++; oo.lCur = [iu, j]; lHit.push([iu, j]);
          cp.push('<b>List:</b> entry ' + (j + 1) + ' is ' + b(nb[j].to) + ': a neighbour, with no empty cells to skip.');
          ln.push('lvisit');
        } else if (j === lRounds) cp.push('<b>List:</b> finished after ' + plural(lCount, 'read') + '.');
        else cp.push('<b>List:</b> finished.');
        snap(mFinished ? 'answer' : 'probe', oo, cp.join(' '), ln, { u: u, v: ids[j] }, mFinished, j >= lRounds - 1 || lRounds === 0);
      }
      snap('done', { mRow: iu, lRow: iu }, 'Same answer, different work. The matrix read <b>' + mCount + '</b> cells (one per vertex, mostly zeros); the list read <b>' + lCount + '</b> entries (one per real neighbour).', null,
        { u: u, v: '–' }, true, true);
      return steps;
    }
    /* op === 'all': visit every edge, one vertex at a time */
    snap('start', {}, 'Question: visit every edge once. The matrix must look at all ' + V + '×' + V + ' = ' + (V * V) + ' cells; the list only touches real edges.', null, { row: '–' }, false, false);
    for (var i = 0; i < V; i++) {
      var nbrs = rep.adj[ids[i]];
      var mh = 0;
      for (var jj = 0; jj < V; jj++) { mSeen.push([i, jj]); mCount++; if (rep.has[i][jj]) { mHit.push([i, jj]); mh++; } }
      lSeen[i] = nbrs.length; lCount += nbrs.length;
      nbrs.forEach(function (_, kk) { lHit.push([i, kk]); });
      snap(i === V - 1 ? 'answer' : 'probe', { mRow: i, lRow: i },
        '<b>Row ' + esc(ids[i]) + '.</b> Matrix: scanned ' + V + ' cells and found ' + plural(mh, 'edge end') + '. List: read ' + plural(nbrs.length, 'entry', 'entries') + ', every one a real edge end.',
        ['mloop', 'lloop'], { row: ids[i] }, i === V - 1, i === V - 1);
    }
    snap('done', {}, 'Totals: matrix <b>' + mCount + '</b> reads (always V²), list <b>' + lCount + '</b> reads (V + ' + (lCount) + ' edge ends: about V + E' + (rep.directed ? '' : ', counting each undirected edge twice') + ').', null,
      { row: '–' }, true, true);
    return steps;
  }

  /* ================================================================== bipartite two-colouring (BFS) */
  /* biColorSteps(graph, start): colour start 0, give every neighbour the opposite colour, and stop with a conflict
     the moment an edge joins two vertices of the same colour (an odd cycle). Edge directions are ignored. */
  function biColorSteps(graph, start) {
    var rep = build(Object.assign({}, graph, { directed: false }));
    var steps = [], colour = {}, queue = [], edgeSt = {}, checked = 0, coloured = 0;
    var s = start !== undefined && rep.index[start] !== undefined ? String(start) : rep.ids[0];
    function ekey(a, c) { return natCmp(a, c) <= 0 ? a + '-' + c : c + '-' + a; }
    function snap(kind, extra, caption, line, vars) {
      steps.push(Object.assign({
        kind: kind, colour: Object.assign({}, colour), queue: queue.slice(), edges: Object.assign({}, edgeSt),
        cur: null, conflict: null, columns: false, caption: caption, line: line || null, vars: vars || {},
        counters: { coloured: coloured, checked: checked }
      }, extra));
    }
    if (s === undefined) { snap('empty', {}, 'No vertices to colour.', null, {}); return steps; }
    colour[s] = 0; coloured = 1; queue.push(s);
    snap('init', { cur: s }, 'Give the start vertex ' + b(s) + ' the first colour (blue) and put it in the queue. Its neighbours must get the <em>other</em> colour.', 'start', { queue: queue.slice() });
    while (queue.length) {
      var u = queue.shift();
      snap('dequeue', { cur: u }, 'Take ' + b(u) + ' out of the queue. Every neighbour of ' + esc(u) + ' has to wear the opposite colour.', 'pop', { u: u, queue: queue.slice() });
      var nbrs = rep.adj[u];
      for (var i = 0; i < nbrs.length; i++) {
        var w = nbrs[i].to, k = ekey(u, w);
        checked++;
        if (colour[w] === undefined) {
          colour[w] = 1 - colour[u]; coloured++; queue.push(w); edgeSt[k] = 'visited';
          snap('colour', { cur: u }, esc(w) + ' has no colour yet, so it gets the opposite of ' + esc(u) + ': <b>' + (colour[w] === 0 ? 'blue' : 'orange') + '</b>. It joins the queue.', 'colour', { u: u, w: w, queue: queue.slice() });
        } else if (colour[w] !== colour[u]) {
          edgeSt[k] = 'visited';
          snap('ok', { cur: u }, esc(w) + ' is already ' + (colour[w] === 0 ? 'blue' : 'orange') + ', the opposite of ' + esc(u) + '. The edge ' + esc(u) + '–' + esc(w) + ' is consistent.', 'check', { u: u, w: w, queue: queue.slice() });
        } else {
          edgeSt[k] = 'error';
          snap('conflict', { cur: u, conflict: [u, w] }, '<b>Conflict.</b> ' + esc(u) + ' and ' + esc(w) + ' are joined by an edge but both are ' + (colour[u] === 0 ? 'blue' : 'orange') + '. No two-colouring can fix that: the graph has an odd cycle, so it is <b>not bipartite</b>.', 'conflict', { u: u, w: w, queue: queue.slice() });
          return steps;
        }
      }
    }
    var unreachable = rep.ids.filter(function (id) { return colour[id] === undefined; });
    snap('done', { columns: true }, 'The queue is empty and no edge joined two vertices of the same colour. The graph is <b>bipartite</b>: slide the blue vertices to one side and the orange ones to the other, and every edge crosses between the sides.' +
      (unreachable.length ? ' (' + unreachable.map(esc).join(', ') + ' are not reachable from ' + esc(s) + ', so this run did not colour them.)' : ''), 'done', { coloured: coloured });
    return steps;
  }

  /* Brute force: try every 2-colouring (small graphs only). */
  function isBipartiteRef(graph) {
    var rep = build(Object.assign({}, graph, { directed: false }));
    var n = rep.V;
    if (n > 16) throw new Error('reference is exponential');
    for (var mask = 0; mask < (1 << n); mask++) {
      var ok = true;
      for (var e = 0; e < rep.edgeList.length && ok; e++) {
        var x = rep.index[rep.edgeList[e].from], y = rep.index[rep.edgeList[e].to];
        if (((mask >> x) & 1) === ((mask >> y) & 1)) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }

  /* ================================================================== implicit graphs */
  /* The neighbours of grid cell (r, c), computed from arithmetic alone. walls: array of 'r,c' or object {'r,c': true}. */
  function gridNeighbours(rows, cols, walls, r, c, diag) {
    var W = {};
    if (Array.isArray(walls)) walls.forEach(function (k) { W[k] = true; }); else if (walls) Object.keys(walls).forEach(function (k) { if (walls[k]) W[k] = true; });
    if (r < 0 || c < 0 || r >= rows || c >= cols || W[r + ',' + c]) return [];
    var dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    if (diag) dirs = dirs.concat([[-1, 1], [1, 1], [1, -1], [-1, -1]]);
    var out = [];
    dirs.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || W[nr + ',' + nc]) return;
      out.push([nr, nc]);
    });
    return out;
  }

  return {
    LIMITS: LIMITS, natCmp: natCmp, parseEdgeList: parseEdgeList, build: build, degrees: degrees, memory: memory, density: density,
    components: components, shortestPath: shortestPath, simpleCycles: simpleCycles, oddVertices: oddVertices, eulerKind: eulerKind,
    KONIGSBERG: KONIGSBERG, konigsbergDegrees: konigsbergDegrees, opsSteps: opsSteps, biColorSteps: biColorSteps, isBipartiteRef: isBipartiteRef,
    gridNeighbours: gridNeighbours
  };
}));
