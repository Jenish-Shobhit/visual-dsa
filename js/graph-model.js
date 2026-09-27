/* Pure, deterministic traces for one six-node undirected weighted graph. */
(function (global) {
  'use strict';

  var nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
  var edges = [
    { id: 'A-B', a: 'A', b: 'B', weight: 2 },
    { id: 'B-C', a: 'B', b: 'C', weight: 2 },
    { id: 'C-F', a: 'C', b: 'F', weight: 2 },
    { id: 'A-D', a: 'A', b: 'D', weight: 3 },
    { id: 'D-E', a: 'D', b: 'E', weight: 2 },
    { id: 'E-F', a: 'E', b: 'F', weight: 3 },
    { id: 'A-F', a: 'A', b: 'F', weight: 14 }
  ];
  var adjacency = Object.create(null);
  nodes.forEach(function (node) { adjacency[node] = []; });
  edges.forEach(function (edge) {
    adjacency[edge.a].push({ to: edge.b, weight: edge.weight, edge: edge.id });
    adjacency[edge.b].push({ to: edge.a, weight: edge.weight, edge: edge.id });
  });
  nodes.forEach(function (node) {
    adjacency[node].sort(function (a, b) { return a.to.localeCompare(b.to); });
  });

  function pathFrom(parent, start, target) {
    var path = [];
    var at = target;
    while (at !== undefined) {
      path.unshift(at);
      if (at === start) return path;
      at = parent[at];
    }
    return [];
  }

  function weightOf(path) {
    var total = 0;
    for (var i = 1; i < path.length; i++) {
      var edge = adjacency[path[i - 1]].find(function (neighbor) { return neighbor.to === path[i]; });
      if (!edge) throw new Error('Path contains a missing edge');
      total += edge.weight;
    }
    return total;
  }

  function makeRecorder(kind, start, target) {
    var frames = [];
    var parent = Object.create(null);
    var distance = Object.create(null);
    var discovered = new Set();
    var processed = new Set();
    var frontier = [];
    var visits = 0;
    var inspections = 0;

    function add(caption, current, edge, route) {
      var copy = {};
      nodes.forEach(function (node) {
        copy[node] = Number.isFinite(distance[node]) ? distance[node] : null;
      });
      frames.push({
        kind: kind, caption: caption, current: current || '', edge: edge || '',
        route: route ? route.slice() : [],
        frontier: frontier.slice(), discovered: Array.from(discovered),
        processed: Array.from(processed), distance: copy,
        parent: Object.assign({}, parent), visits: visits, inspections: inspections
      });
    }

    nodes.forEach(function (node) { distance[node] = Infinity; });
    distance[start] = 0;
    discovered.add(start);
    frontier.push(start);
    add('Start at ' + start + '. Target: ' + target + '.', '', '', []);

    return {
      frames: frames, parent: parent, distance: distance,
      discovered: discovered, processed: processed, frontier: frontier,
      inspect: function () { inspections++; },
      visit: function () { visits++; },
      add: add
    };
  }

  function bfs(start, target) {
    var r = makeRecorder('bfs', start, target);
    while (r.frontier.length) {
      var node = r.frontier.shift();
      r.processed.add(node);
      r.visit();
      r.add('Take ' + node + ' from the front of the queue. It is ' + r.distance[node] + ' edge(s) from ' + start + '.', node);
      if (node === target) break;
      adjacency[node].forEach(function (neighbor) {
        r.inspect();
        r.add('Inspect ' + node + ' → ' + neighbor.to + '. BFS counts one edge, regardless of its weight ' + neighbor.weight + '.', node, neighbor.edge);
        if (r.discovered.has(neighbor.to)) {
          r.add(neighbor.to + ' was already discovered; do not enqueue it again.', node, neighbor.edge);
          return;
        }
        r.discovered.add(neighbor.to);
        r.parent[neighbor.to] = node;
        r.distance[neighbor.to] = r.distance[node] + 1;
        r.frontier.push(neighbor.to);
        r.add('Enqueue ' + neighbor.to + '. Its first route uses ' + r.distance[neighbor.to] + ' edge(s).', node, neighbor.edge);
      });
    }
    var path = pathFrom(r.parent, start, target);
    r.add('BFS chose ' + path.join(' → ') + ': ' + (path.length - 1) + ' edge(s), total weight ' + weightOf(path) + '.', target, '', path);
    return { kind: 'bfs', frames: r.frames, result: { path: path, hops: path.length - 1, cost: weightOf(path) } };
  }

  function dijkstra(start, target) {
    var r = makeRecorder('dijkstra', start, target);
    while (r.frontier.length) {
      r.frontier.sort(function (a, b) { return r.distance[a] - r.distance[b] || a.localeCompare(b); });
      var node = r.frontier.shift();
      r.processed.add(node);
      r.visit();
      r.add('Finalize ' + node + ' at total weight ' + r.distance[node] + '. No cheaper route to it can appear with non-negative edges.', node);
      if (node === target) break;
      adjacency[node].forEach(function (neighbor) {
        r.inspect();
        if (r.processed.has(neighbor.to)) {
          r.add(neighbor.to + ' is already final. Ignore this return edge.', node, neighbor.edge);
          return;
        }
        var candidate = r.distance[node] + neighbor.weight;
        r.add('Try ' + node + ' → ' + neighbor.to + ': ' + r.distance[node] + ' + ' + neighbor.weight + ' = ' + candidate + '.', node, neighbor.edge);
        if (candidate < r.distance[neighbor.to]) {
          r.distance[neighbor.to] = candidate;
          r.parent[neighbor.to] = node;
          if (!r.discovered.has(neighbor.to)) {
            r.discovered.add(neighbor.to);
            r.frontier.push(neighbor.to);
          }
          r.add('Improve the best known weight to ' + neighbor.to + ': now ' + candidate + '.', node, neighbor.edge);
        } else {
          r.add('Keep the existing weight to ' + neighbor.to + '; ' + candidate + ' is no better.', node, neighbor.edge);
        }
      });
    }
    var path = pathFrom(r.parent, start, target);
    r.add('Dijkstra chose ' + path.join(' → ') + ': total weight ' + weightOf(path) + ' across ' + (path.length - 1) + ' edge(s).', target, '', path);
    return { kind: 'dijkstra', frames: r.frames, result: { path: path, hops: path.length - 1, cost: weightOf(path) } };
  }

  function trace(kind, start, target) {
    if (nodes.indexOf(start) < 0 || nodes.indexOf(target) < 0) throw new Error('Choose nodes A–F.');
    if (kind === 'bfs') return bfs(start, target);
    if (kind === 'dijkstra') return dijkstra(start, target);
    throw new Error('Choose BFS or Dijkstra.');
  }

  global.GraphExplorerModel = { nodes: nodes, edges: edges, trace: trace, weightOf: weightOf };
}(typeof window !== 'undefined' ? window : globalThis));
