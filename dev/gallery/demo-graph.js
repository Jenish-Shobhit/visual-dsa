/* Gallery demos: VDSA.views.graph */
(function () {
  'use strict';
  var G = Gallery;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- BFS on an undirected graph ---------- */
  var BFS_NODES = [
    ['A', 100, 300], ['B', 280, 140], ['C', 280, 460], ['D', 490, 80], ['E', 490, 300],
    ['F', 490, 520], ['G', 700, 190], ['H', 700, 420], ['I', 900, 300]
  ];
  var BFS_EDGES = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'], ['D', 'G'], ['E', 'G'], ['E', 'H'], ['F', 'H'], ['G', 'I'], ['H', 'I']];

  function bfsSteps() {
    var adj = {};
    BFS_NODES.forEach(function (n) { adj[n[0]] = []; });
    BFS_EDGES.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    var st = {}, dist = {}, edgeSt = {}, queue = [], steps = [];
    BFS_NODES.forEach(function (n) { st[n[0]] = 'default'; });
    function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
    function snap(caption, pulse) {
      steps.push({
        nodes: BFS_NODES.map(function (n) {
          var q = queue.indexOf(n[0]);
          return { id: n[0], x: n[1], y: n[2], state: st[n[0]], badge: q >= 0 ? q + 1 : undefined, badgeState: q === 0 ? 'frontier' : undefined, sub: dist[n[0]] !== undefined ? 'd=' + dist[n[0]] : undefined };
        }),
        edges: BFS_EDGES.map(function (e) { var k = key(e[0], e[1]); return { from: e[0], to: e[1], state: edgeSt[k] || 'default', pulse: pulse === k }; }),
        caption: caption
      });
    }
    snap('Start BFS from A.');
    queue.push('A'); st.A = 'frontier'; dist.A = 0;
    snap('A enters the queue (badge = queue position).');
    while (queue.length) {
      var u = queue.shift();
      st[u] = 'active';
      snap('Dequeue ' + u + ' and look at its neighbours.');
      adj[u].forEach(function (v) {
        var k = key(u, v);
        if (st[v] === 'default') {
          st[v] = 'frontier'; dist[v] = dist[u] + 1; queue.push(v); edgeSt[k] = 'visited';
          snap(v + ' is new: distance ' + dist[v] + ', joins the back of the queue.', k);
        }
      });
      st[u] = 'visited';
    }
    snap('Queue empty: every node reached, tree edges show the BFS tree.');
    return steps;
  }

  G.demo('graph', {
    id: 'graph-bfs', title: 'BFS — frontier, visited, queue badges',
    note: 'Node states active / frontier / visited; badges show queue order; tree edges turn "visited"; new discoveries pulse along the edge.',
    duration: 560, hold: 420,
    build: function (host) {
      var view = VDSA.views.graph(host, { label: 'Breadth-first search' });
      var steps = bfsSteps();
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- Dijkstra on a weighted directed graph ---------- */
  var DJ_NODES = [['S', 90, 300], ['A', 330, 120], ['B', 330, 480], ['C', 610, 120], ['D', 610, 480], ['T', 900, 300]];
  var DJ_EDGES = [['S', 'A', 4], ['S', 'B', 1], ['B', 'A', 2], ['A', 'B', 5], ['A', 'C', 3], ['B', 'D', 7], ['C', 'D', 1], ['C', 'T', 6], ['D', 'T', 2]];

  function dijkstraSteps() {
    var dist = {}, st = {}, prev = {}, steps = [], eSt = {};
    DJ_NODES.forEach(function (n) { dist[n[0]] = Infinity; st[n[0]] = 'default'; });
    function snap(caption, hot) {
      steps.push({
        nodes: DJ_NODES.map(function (n) { return { id: n[0], x: n[1], y: n[2], state: st[n[0]], badge: dist[n[0]], badgeState: st[n[0]] === 'path' ? 'path' : undefined }; }),
        edges: DJ_EDGES.map(function (e) { var k = e[0] + '-' + e[1]; return { from: e[0], to: e[1], weight: e[2], state: (hot && hot.k === k ? hot.state : eSt[k]) || 'default', pulse: !!hot && hot.k === k }; }),
        caption: caption
      });
    }
    snap('Every distance starts at ∞.');
    dist.S = 0; st.S = 'frontier';
    snap('The source S has distance 0.');
    for (;;) {
      var u = null;
      DJ_NODES.forEach(function (n) { if (st[n[0]] === 'frontier' && (u === null || dist[n[0]] < dist[u])) u = n[0]; });
      if (u === null) break;
      st[u] = 'active';
      snap('Settle ' + u + ': the smallest tentative distance (' + dist[u] + ').');
      DJ_EDGES.forEach(function (e) {
        if (e[0] !== u || st[e[1]] === 'done') return;
        var v = e[1], k = u + '-' + v, nd = dist[u] + e[2];
        if (nd < dist[v]) {
          if (prev[v]) eSt[prev[v] + '-' + v] = 'default';
          dist[v] = nd; prev[v] = u; st[v] = 'frontier'; eSt[k] = 'visited';
          snap('Relax ' + u + '→' + v + ': ' + (nd - e[2]) + ' + ' + e[2] + ' = ' + nd + ' improves the distance.', { k: k, state: 'active' });
        } else {
          snap('Relax ' + u + '→' + v + ': ' + dist[u] + ' + ' + e[2] + ' = ' + nd + ' is no better than ' + dist[v] + '.', { k: k, state: 'compare' });
        }
      });
      st[u] = 'done';
    }
    var path = [], v = 'T';
    while (v) { path.unshift(v); v = prev[v]; }
    path.forEach(function (n, i) { st[n] = 'path'; if (i) eSt[path[i - 1] + '-' + n] = 'path'; });
    Object.keys(eSt).forEach(function (k) { if (eSt[k] === 'visited') eSt[k] = 'default'; });
    snap('Shortest path S→T costs ' + dist.T + ': ' + path.join(' → ') + '.');
    return steps;
  }

  G.demo('graph', {
    id: 'graph-dijkstra', title: 'Dijkstra — weighted directed, distance badges, path',
    note: 'directed: true; badges go ∞ → numbers; A⇄B is a reverse pair so both edges curve apart; the final path uses state "path".',
    duration: 600, hold: 520,
    build: function (host) {
      var view = VDSA.views.graph(host, { directed: true, bounds: 'auto', label: 'Dijkstra shortest paths' });
      var steps = dijkstraSteps();
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- editor ---------- */
  G.demo('graph', {
    id: 'graph-editor', title: 'Editor mode — build your own graph',
    note: 'Click empty space: add node. Drag node→node (or click one, then another): add edge. Click an edge: edit weight. Delete: remove selection. Shift-drag or the Move tool: move nodes. N: add node, arrows: nudge.',
    build: function (host, card) {
      var view = VDSA.views.graph(host, { editable: true, directed: true, label: 'Graph editor' });
      var start = {
        nodes: [{ id: 'A', x: 160, y: 300 }, { id: 'B', x: 420, y: 150 }, { id: 'C', x: 420, y: 450 }, { id: 'D', x: 700, y: 300 }],
        edges: [{ from: 'A', to: 'B', weight: 3 }, { from: 'A', to: 'C', weight: 1 }, { from: 'C', to: 'B', weight: 1 }, { from: 'B', to: 'D', weight: 4 }]
      };
      view.on('change', function (e) { G.log(card, e.type + (e.id ? ' ' + e.id : '') + ' → ' + e.nodes.length + ' nodes, ' + e.edges.length + ' edges'); });
      G.button(card, 'Print graph', function () {
        var g = view.getGraph();
        G.log(card, JSON.stringify({ nodes: g.nodes.map(function (n) { return [n.id, Math.round(n.x), Math.round(n.y)]; }), edges: g.edges.map(function (e) { return e.from + '→' + e.to + (e.weight !== undefined ? ':' + e.weight : ''); }) }));
      });
      var moveBtn = G.button(card, 'Move tool', function (b) {
        var on = view.getTool() !== 'move';
        view.setTool(on ? 'move' : 'edge');
        b.setAttribute('aria-pressed', String(on));
      }, false);
      G.button(card, 'Reset', function () { view.setGraph(start); view.setTool('edge'); moveBtn.setAttribute('aria-pressed', 'false'); G.log(card, 'reset'); });
      return { steps: [start], render: function (s, c) { view.render(clone(s), { duration: c.duration }); } };
    }
  });

  /* ---------- topological sort on a layered DAG ---------- */
  var TOPO_NODES = ['CS1', 'MATH', 'DS', 'DISC', 'ALG', 'OS', 'DB', 'NET', 'ML'];
  var TOPO_EDGES = [['CS1', 'DS'], ['MATH', 'DISC'], ['DS', 'ALG'], ['DISC', 'ALG'], ['DS', 'OS'], ['DS', 'DB'], ['OS', 'NET'], ['ALG', 'ML'], ['MATH', 'ML']];

  function topoSteps(pos) {
    var indeg = {}, st = {}, order = {}, eSt = {}, steps = [], queue = [];
    TOPO_NODES.forEach(function (n) { indeg[n] = 0; st[n] = 'default'; });
    TOPO_EDGES.forEach(function (e) { indeg[e[1]]++; });
    function snap(caption, hot) {
      steps.push({
        nodes: TOPO_NODES.map(function (n) { return { id: n, x: pos[n].x, y: pos[n].y, state: st[n], badge: st[n] === 'done' ? undefined : indeg[n], sub: order[n] ? '#' + order[n] : undefined }; }),
        edges: TOPO_EDGES.map(function (e) { var k = e[0] + '-' + e[1]; return { from: e[0], to: e[1], state: eSt[k] || 'default', pulse: hot === k }; }),
        caption: caption
      });
    }
    snap('Badges show in-degree: how many prerequisites remain.');
    TOPO_NODES.forEach(function (n) { if (!indeg[n]) { queue.push(n); st[n] = 'frontier'; } });
    snap('Courses with no prerequisites join the queue.');
    var k = 0;
    while (queue.length) {
      var u = queue.shift();
      st[u] = 'active'; order[u] = ++k;
      snap('Take ' + u + ' (position ' + k + ').');
      TOPO_EDGES.forEach(function (e) {
        if (e[0] !== u) return;
        var key = e[0] + '-' + e[1];
        indeg[e[1]]--; eSt[key] = 'muted';
        if (!indeg[e[1]]) { queue.push(e[1]); st[e[1]] = 'frontier'; }
        snap('Remove ' + u + '→' + e[1] + '; ' + e[1] + ' now needs ' + indeg[e[1]] + '.', key);
      });
      st[u] = 'done';
    }
    snap('A valid order: ' + TOPO_NODES.slice().sort(function (a, b) { return order[a] - order[b]; }).join(', ') + '.');
    return steps;
  }

  G.demo('graph', {
    id: 'graph-topo', title: 'Topological sort — layered DAG layout',
    note: 'Positions from VDSA.views.graph.layouts.layered(nodes, edges, {direction: "LR"}); in-degree badges; removed edges turn "muted".',
    duration: 520, hold: 380,
    build: function (host) {
      var view = VDSA.views.graph(host, { directed: true, label: 'Topological sort', nodeRadius: 24 });
      var pos = VDSA.views.graph.layouts.layered(TOPO_NODES, TOPO_EDGES.map(function (e) { return { from: e[0], to: e[1] }; }), { direction: 'LR', pad: 80 });
      var steps = topoSteps(pos);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- force layout: a growing graph re-lays itself out ---------- */
  G.demo('graph', {
    id: 'graph-force', title: 'Force layout — the graph re-lays out as it grows',
    note: 'layout: "force" (deterministic). Each step adds a node; existing nodes glide to their new positions and edges stay attached.',
    duration: 800, hold: 500,
    build: function (host) {
      var view = VDSA.views.graph(host, { layout: 'force', label: 'Force-directed layout' });
      var add = [['1', null], ['2', '1'], ['3', '1'], ['4', '2'], ['5', '2'], ['6', '3'], ['7', '3'], ['8', '5'], ['9', '6'], ['10', '4']];
      var extra = [['7', '9'], ['8', '4'], ['10', '5']];
      var nodes = [], edges = [], steps = [];
      add.forEach(function (a, i) {
        nodes.push({ id: a[0], state: 'active' });
        if (a[1]) edges.push({ from: a[1], to: a[0], state: 'active' });
        steps.push({ nodes: clone(nodes), edges: clone(edges), caption: 'Add node ' + a[0] + (a[1] ? ' linked to ' + a[1] : '') + '.' });
        nodes.forEach(function (n) { n.state = 'default'; });
        edges.forEach(function (e) { e.state = 'default'; });
      });
      extra.forEach(function (e) {
        edges.push({ from: e[0], to: e[1], state: 'compare' });
        steps.push({ nodes: clone(nodes), edges: clone(edges), caption: 'Add a cross edge ' + e[0] + '–' + e[1] + '.' });
        edges.forEach(function (x) { x.state = 'default'; });
      });
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- curves, self-loop, flow pipes, dragging ---------- */
  G.demo('graph', {
    id: 'graph-flow', title: 'Flow network — pipes "3/5", reverse pair, self-loop, draggable',
    note: 'capacity + flow draw a pipe filled to flow/capacity with a "3/5" pill; draggable: true (try dragging a node).',
    duration: 650, hold: 700,
    build: function (host, card) {
      var view = VDSA.views.graph(host, { directed: true, draggable: true, label: 'Flow network' });
      view.on('move', function (e) { if (e.final) G.log(card, 'moved ' + e.id + ' to (' + Math.round(e.x) + ', ' + Math.round(e.y) + ')'); });
      var N = [{ id: 's', x: 90, y: 300 }, { id: 'a', x: 360, y: 130 }, { id: 'b', x: 360, y: 470 }, { id: 'c', x: 640, y: 130 }, { id: 't', x: 910, y: 300 }];
      var caps = [['s', 'a', 5], ['s', 'b', 4], ['a', 'b', 2], ['b', 'a', 3], ['a', 'c', 4], ['b', 't', 3], ['c', 't', 6], ['c', 'c', 0]];
      var paths = [[['s', 'a'], ['a', 'c'], ['c', 't']], [['s', 'b'], ['b', 't']], [['s', 'b'], ['b', 'a'], ['a', 'c'], ['c', 't']]];
      var push = [3, 3, 1];
      var flow = {}, steps = [];
      caps.forEach(function (c) { flow[c[0] + '-' + c[1]] = 0; });
      function snap(caption, hot) {
        var hk = {};
        (hot || []).forEach(function (e) { hk[e[0] + '-' + e[1]] = true; });
        steps.push({
          nodes: N.map(function (n) { return { id: n.id, x: n.x, y: n.y, state: n.id === 's' || n.id === 't' ? 'key' : hot && hot.some(function (e) { return e[0] === n.id || e[1] === n.id; }) ? 'path' : 'default' }; }),
          edges: caps.map(function (c) {
            var k = c[0] + '-' + c[1];
            if (c[0] === c[1]) return { from: c[0], to: c[1], label: 'loop' };
            return { from: c[0], to: c[1], flow: flow[k], capacity: c[2], state: hk[k] ? 'path' : flow[k] === c[2] ? 'done' : 'default', pulse: !!hk[k] };
          }),
          caption: caption
        });
      }
      snap('Every pipe starts empty: flow/capacity.');
      var total = 0;
      paths.forEach(function (p, i) {
        p.forEach(function (e) { flow[e[0] + '-' + e[1]] += push[i]; });
        total += push[i];
        snap('Push ' + push[i] + ' along ' + p.map(function (e) { return e[0]; }).join('→') + '→t (total ' + total + '). Full pipes turn "done".', p);
      });
      snap('No augmenting path left: max flow = ' + total + '.');
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
