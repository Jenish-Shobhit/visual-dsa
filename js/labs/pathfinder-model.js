/* Pathfinder lab: pure model (no DOM). UMD: browser -> window.Pathfinder, Node -> module.exports.

   Reuses the lesson generators: VDSA.algos.graphSearch (gridBfs, gridDfs, lesson 26) and
   VDSA.algos.shortestPaths (gridDijkstra, gridAStar, gridGreedy, gridSearchResult, lesson 28).
   Grid format {rows, cols, walls: ['r,c'], mud: ['r,c']}; cells are [row, col].

   New logic in this file:
     mazes         backtracker(R, C, seed, {loops}), division(R, C, seed), randomWalls(R, C, density, seed, o)
     scatterMud    blobs of mud that avoid walls and the two markers
     presets       named starting maps scaled to any size
     map codec     encodeMap / decodeMap: 3 cells per URL-safe character (open, wall, mud)
     run helpers   runSteps, analyze (path length, cost, ordered path), expandOrder (heatmap ranks), compareAll */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Pathfinder = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  var ALGOS = [
    { id: 'bfs', name: 'BFS', lesson: '26-bfs-and-dfs', weighted: false, blurb: 'Fewest steps. Ignores mud, so its route can cost more than the cheapest.' },
    { id: 'dfs', name: 'DFS', lesson: '26-bfs-and-dfs', weighted: false, blurb: 'Dives and backtracks. Finds a path, rarely a short one.' },
    { id: 'dijkstra', name: 'Dijkstra', lesson: '28-dijkstra-and-a-star', weighted: true, blurb: 'Cheapest route, expanding in rings of equal cost.' },
    { id: 'astar', name: 'A*', lesson: '28-dijkstra-and-a-star', weighted: true, blurb: 'Dijkstra plus a guess of the distance left. Still cheapest when the guess is optimistic.' },
    { id: 'greedy', name: 'Greedy best-first', lesson: '28-dijkstra-and-a-star', weighted: true, blurb: 'Heads straight for the goal. Fast, but can be fooled and is not optimal.' }
  ];
  var LIMITS = { maxRows: 40, maxCols: 70, minRows: 5, minCols: 5, mudCost: [2, 10] };

  function libs() {
    var A = root && root.VDSA && root.VDSA.algos;
    if (!A || !A.graphSearch || !A.shortestPaths) throw new Error('Pathfinder needs the lesson 26 and 28 generators');
    return { GS: A.graphSearch, SP: A.shortestPaths };
  }

  /* ---------------------------------------------------------------- basics */
  function rngOf(seed) {
    var a = (seed | 0) >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function key(r, c) { return r + ',' + c; }
  function parseKey(k) { var p = String(k).split(','); return [parseInt(p[0], 10), parseInt(p[1], 10)]; }
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clampSize(R, C) { return { R: Math.max(LIMITS.minRows, Math.min(LIMITS.maxRows, R | 0)), C: Math.max(LIMITS.minCols, Math.min(LIMITS.maxCols, C | 0)) }; }
  function setOf(list) { var s = {}; (list || []).forEach(function (k) { s[k] = true; }); return s; }

  /* Is there a path (walls block, mud does not)? */
  function hasPath(R, C, walls, start, goal) {
    var w = Array.isArray(walls) ? setOf(walls) : walls;
    if (w[key(start[0], start[1])] || w[key(goal[0], goal[1])]) return false;
    var seen = {}, q = [start], head = 0;
    seen[key(start[0], start[1])] = true;
    while (head < q.length) {
      var u = q[head++];
      if (u[0] === goal[0] && u[1] === goal[1]) return true;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var r = u[0] + d[0], c = u[1] + d[1], k = key(r, c);
        if (r < 0 || c < 0 || r >= R || c >= C || w[k] || seen[k]) return;
        seen[k] = true; q.push([r, c]);
      });
    }
    return false;
  }

  /* ---------------------------------------------------------------- mazes (all return {walls: [keys], start, goal}) */
  function oddDims(R, C) { return { rr: R % 2 ? R : R - 1, cc: C % 2 ? C : C - 1 }; }

  /* Recursive backtracker on the odd cells. `loops` (0..0.5) knocks out that share of the remaining inner walls that
     separate two open cells, so the maze has several routes and the algorithms can disagree. */
  function backtracker(R, C, seed, o) {
    o = o || {};
    var rng = rngOf(seed), d = oddDims(R, C), rr = d.rr, cc = d.cc, open = {};
    var stack = [[1, 1]];
    open[key(1, 1)] = true;
    while (stack.length) {
      var top = stack[stack.length - 1], opts = [];
      [[0, 2], [2, 0], [0, -2], [-2, 0]].forEach(function (dd) {
        var nr = top[0] + dd[0], nc = top[1] + dd[1];
        if (nr > 0 && nc > 0 && nr <= rr - 2 && nc <= cc - 2 && !open[key(nr, nc)]) opts.push(dd);
      });
      if (!opts.length) { stack.pop(); continue; }
      var pick = opts[Math.floor(rng() * opts.length)];
      open[key(top[0] + pick[0] / 2, top[1] + pick[1] / 2)] = true;
      open[key(top[0] + pick[0], top[1] + pick[1])] = true;
      stack.push([top[0] + pick[0], top[1] + pick[1]]);
    }
    var loops = Math.max(0, Math.min(0.5, o.loops === undefined ? 0.06 : o.loops));
    if (loops > 0) {
      var cand = [];
      for (var r = 1; r < rr - 1; r++) for (var c = 1; c < cc - 1; c++) {
        if (open[key(r, c)]) continue;
        if ((r % 2 === 0 && c % 2 === 1 && open[key(r - 1, c)] && open[key(r + 1, c)]) || (r % 2 === 1 && c % 2 === 0 && open[key(r, c - 1)] && open[key(r, c + 1)])) cand.push(key(r, c));
      }
      shuffle(cand, rng).slice(0, Math.round(cand.length * loops)).forEach(function (k) { open[k] = true; });
    }
    var walls = [];
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) if (!open[key(r, c)]) walls.push(key(r, c));
    return { walls: walls, start: [1, 1], goal: [rr - 2, cc - 2] };
  }

  /* Recursive division: start with an open field, split every chamber with a wall that has one gap. Walls sit on odd
     rows/columns and gaps on even ones, so a later wall can never close an earlier gap. */
  function division(R, C, seed) {
    var rng = rngOf(seed), d = oddDims(R, C), rr = d.rr, cc = d.cc, wall = {};
    function even(lo, hi) { var n = Math.floor((hi - lo) / 2) + 1; return lo + 2 * Math.floor(rng() * n); }
    function odd(lo, hi) { var n = Math.floor((hi - lo - 1) / 2) + 1; return lo + 1 + 2 * Math.floor(rng() * n); }
    (function split(r0, r1, c0, c1) {
      var h = r1 - r0, w = c1 - c0;
      if (h < 2 && w < 2) return;
      var horizontal = h > w ? true : w > h ? false : rng() < 0.5;
      if (horizontal && h < 2) horizontal = false;
      if (!horizontal && w < 2) horizontal = true;
      if (horizontal) {
        var wr = odd(r0, r1), gc = even(c0, c1);
        for (var c = c0; c <= c1; c++) if (c !== gc) wall[key(wr, c)] = true;
        split(r0, wr - 1, c0, c1); split(wr + 1, r1, c0, c1);
      } else {
        var wc = odd(c0, c1), gr = even(r0, r1);
        for (var r = r0; r <= r1; r++) if (r !== gr) wall[key(r, wc)] = true;
        split(r0, r1, c0, wc - 1); split(r0, r1, wc + 1, c1);
      }
    }(0, rr - 1, 0, cc - 1));
    return { walls: Object.keys(wall), start: [0, 0], goal: [rr - 1, cc - 1] };
  }

  /* Random walls at `density` (0..0.6). With guarantee (default) the cheapest wall-breaking route between start and goal
     is carved (0-1 BFS: open cells cost 0, walls cost 1), so a path always exists and as few walls as possible go. */
  function randomWalls(R, C, density, seed, o) {
    o = o || {};
    var rng = rngOf(seed), start = o.start || [Math.floor(R / 2), 2], goal = o.goal || [Math.floor(R / 2), C - 3];
    var dens = Math.max(0, Math.min(0.6, density)), wall = {}, r, c;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) if (rng() < dens) wall[key(r, c)] = true;
    delete wall[key(start[0], start[1])]; delete wall[key(goal[0], goal[1])];
    if (o.guarantee !== false && !hasPath(R, C, wall, start, goal)) {
      var N = R * C, dist = new Array(N), prev = new Array(N), dq = [start[0] * C + start[1]], front = [];
      for (var i = 0; i < N; i++) { dist[i] = Infinity; prev[i] = -1; }
      dist[dq[0]] = 0;
      // deque as two arrays: `front` (reversed) and `dq`
      while (dq.length || front.length) {
        var u = front.length ? front.pop() : dq.shift();
        var ur = Math.floor(u / C), uc = u % C;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
          var nr = ur + dd[0], nc = uc + dd[1];
          if (nr < 0 || nc < 0 || nr >= R || nc >= C) return;
          var v = nr * C + nc, w = wall[key(nr, nc)] ? 1 : 0;
          if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; if (w) dq.push(v); else front.push(v); }
        });
      }
      var t = goal[0] * C + goal[1];
      while (t !== -1) { delete wall[key(Math.floor(t / C), t % C)]; t = prev[t]; }
    }
    return { walls: Object.keys(wall), start: start, goal: goal };
  }

  /* Blobs of mud on open cells (never on walls or the markers). */
  function scatterMud(R, C, walls, seed, o) {
    o = o || {};
    var rng = rngOf(seed), w = Array.isArray(walls) ? setOf(walls) : walls, mud = o.keep ? setOf(o.keep) : {};
    var avoid = setOf((o.avoid || []).map(function (p) { return key(p[0], p[1]); }));
    var blobs = o.blobs || Math.max(2, Math.round(R * C / 220));
    for (var b = 0; b < blobs; b++) {
      var cr = Math.floor(rng() * R), cc = Math.floor(rng() * C), rad = 1.5 + rng() * Math.max(1.5, Math.min(R, C) / 8);
      for (var r = Math.max(0, Math.floor(cr - rad)); r <= Math.min(R - 1, Math.ceil(cr + rad)); r++) for (var c = Math.max(0, Math.floor(cc - rad)); c <= Math.min(C - 1, Math.ceil(cc + rad)); c++) {
        var k = key(r, c);
        if (w[k] || avoid[k]) continue;
        if ((r - cr) * (r - cr) + (c - cc) * (c - cc) <= rad * rad * (0.55 + 0.45 * rng())) mud[k] = true;
      }
    }
    return Object.keys(mud);
  }

  /* ---------------------------------------------------------------- presets */
  var PRESETS = [
    { id: 'open', label: 'Open field' },
    { id: 'gap', label: 'Wall with a gap' },
    { id: 'pond', label: 'Mud pond' },
    { id: 'twogaps', label: 'Muddy shortcut' },
    { id: 'cup', label: 'Cup trap' },
    { id: 'maze', label: 'Maze' }
  ];
  function presetMap(id, R, C, seed) {
    var mr = Math.floor(R / 2), cm = Math.floor(C / 2), walls = {}, mud = {}, r, c;
    var start = [mr, 2], goal = [mr, C - 3];
    switch (id) {
      case 'gap':
        for (r = 0; r < R; r++) if (Math.abs(r - Math.floor(R * 0.22)) > 0) walls[key(r, cm)] = true;
        delete walls[key(Math.floor(R * 0.22), cm)];
        break;
      case 'pond':
        for (r = 2; r < R - 2; r++) for (c = cm - Math.max(2, Math.floor(C / 8)); c <= cm + Math.max(2, Math.floor(C / 8)); c++) mud[key(r, c)] = true;
        break;
      case 'twogaps':
        for (r = 0; r < R; r++) if (r !== mr && r !== R - 3) walls[key(r, cm)] = true;
        for (r = mr - 2; r <= mr + 2; r++) for (c = cm - 4; c <= cm + 4; c++) if (c !== cm) mud[key(r, c)] = true;
        break;
      case 'cup': {
        /* A long, narrow cup around the goal. Its mouth faces the start but a short baffle covers it, so the way in
           is a small sidestep that points away from the goal. Greedy hugs the cup's outside walls (they are the cells
           closest to the goal) and floods the whole neighbourhood before it tries the sidestep; A* walks to the door. */
        var gc = C - 3, xl = Math.max(7, gc - Math.max(4, C - 9)), bx = xl - 2, ba = 1;
        for (c = xl; c <= gc + 1; c++) { walls[key(mr - 1, c)] = true; walls[key(mr + 1, c)] = true; }
        walls[key(mr, gc + 1)] = true;
        for (r = mr - ba; r <= mr + ba; r++) walls[key(r, bx)] = true;
        break;
      }
      case 'maze': {
        var m = backtracker(R, C, seed === undefined ? 7 : seed, { loops: 0.06 });
        return { walls: m.walls, mud: [], start: m.start, goal: m.goal };
      }
      default: break;
    }
    delete walls[key(start[0], start[1])]; delete walls[key(goal[0], goal[1])];
    delete mud[key(start[0], start[1])]; delete mud[key(goal[0], goal[1])];
    return { walls: Object.keys(walls), mud: Object.keys(mud), start: start, goal: goal };
  }

  /* ---------------------------------------------------------------- map codec (URL state)
     One base-4 digit per cell: 0 open, 1 wall, 2 mud. Three cells per character of the URL-safe base-64 alphabet. */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function encodeMap(R, C, walls, mud) {
    var w = Array.isArray(walls) ? setOf(walls) : walls, m = Array.isArray(mud) ? setOf(mud) : mud || {}, out = '', acc = 0, n = 0;
    for (var i = 0; i < R * C; i++) {
      var k = key(Math.floor(i / C), i % C);
      acc = acc * 3 + (w[k] ? 1 : m[k] ? 2 : 0); n++;
      if (n === 3) { out += B64[acc]; acc = 0; n = 0; }   // 27 values fit in 64
    }
    if (n) { while (n < 3) { acc = acc * 3; n++; } out += B64[acc]; }
    // run-length: "~<count>" replaces 4 or more identical characters (mostly the all-open letter A)
    return out.replace(/(.)\1{3,}/g, function (m0, ch) { return ch + '~' + m0.length.toString(36) + '.'; });
  }
  function decodeMap(str, R, C) {
    var s = String(str || '').replace(/(.)~([0-9a-z]+)\./g, function (m0, ch, n) { return new Array(parseInt(n, 36) + 1).join(ch); });
    var need = Math.ceil(R * C / 3);
    if (s.length !== need) return null;
    var walls = [], mud = [], idx = 0;
    for (var p = 0; p < s.length; p++) {
      var v = B64.indexOf(s[p]);
      if (v < 0 || v >= 27) return null;
      var d = [Math.floor(v / 9), Math.floor(v / 3) % 3, v % 3];
      for (var j = 0; j < 3 && idx < R * C; j++, idx++) {
        var k = key(Math.floor(idx / C), idx % C);
        if (d[j] === 1) walls.push(k); else if (d[j] === 2) mud.push(k); else if (d[j] > 2) return null;
      }
    }
    return { walls: walls, mud: mud };
  }

  /* ---------------------------------------------------------------- running */
  function toGrid(R, C, walls, mud) {
    return { rows: R, cols: C, walls: Array.isArray(walls) ? walls : Object.keys(walls), mud: Array.isArray(mud) ? mud : Object.keys(mud || {}) };
  }
  /* Steps of one algorithm. o: {mudCost, heuristic: 'manhattan'|'euclid', hWeight} */
  function runSteps(algo, grid, start, goal, o) {
    var L = libs(); o = o || {};
    var opts = { mudCost: o.mudCost, heuristic: o.heuristic || 'manhattan', hWeight: o.hWeight === undefined ? 1 : o.hWeight };
    switch (algo) {
      case 'bfs': return L.GS.gridBfs(grid, start, goal);
      case 'dfs': return L.GS.gridDfs(grid, start, goal);
      case 'dijkstra': return L.SP.gridDijkstra(grid, start, goal, opts);
      case 'astar': return L.SP.gridAStar(grid, start, goal, opts);
      case 'greedy': return L.SP.gridGreedy(grid, start, goal, opts);
      default: throw new Error('unknown algorithm ' + algo);
    }
  }

  /* The cells of a route in order. `codes` marks route cells 'p'; the route is a simple path start -> goal through
     exactly those cells (searched with backtracking, capped; falls back to a plain walk). */
  function orderPath(codes, C, start, goal) {
    var cells = {}, count = 0;
    for (var i = 0; i < codes.length; i++) if (codes[i] === 'p') { cells[i] = true; count++; }
    var s = start[0] * C + start[1], g = goal[0] * C + goal[1];
    if (!count) return [];
    var R = Math.ceil(codes.length / C), used = {}, path = [], budget = 200000;
    function nbrs(u) {
      var r = Math.floor(u / C), c = u % C, out = [];
      if (r > 0) out.push(u - C); if (c < C - 1) out.push(u + 1); if (r < R - 1) out.push(u + C); if (c > 0) out.push(u - 1);
      return out;
    }
    function dfs(u) {
      if (--budget < 0) return false;
      used[u] = true; path.push(u);
      if (path.length === count) { if (u === g) return true; }
      else for (var q = nbrs(u), j = 0; j < q.length; j++) if (cells[q[j]] && !used[q[j]] && dfs(q[j])) return true;
      used[u] = false; path.pop();
      return false;
    }
    var ok = cells[s] ? dfs(s) : false;
    if (!ok) { path = Object.keys(cells).map(Number); }
    return path.map(function (u) { return [Math.floor(u / C), u % C]; });
  }
  function pathCost(path, mud, mudCost) {
    var m = Array.isArray(mud) ? setOf(mud) : mud || {}, cost = 0;
    for (var i = 1; i < path.length; i++) cost += m[key(path[i][0], path[i][1])] ? mudCost : 1;
    return cost;
  }
  /* Result of a finished trace: {found, expanded, pathLen, cost, path}. */
  function analyze(steps, grid, start, goal, mudCost) {
    var last = steps[steps.length - 1], C = grid.cols, cn = last.counters || {};
    var expanded = cn.expanded !== undefined ? cn.expanded : cn.visited;
    if (last.kind === 'none' || last.kind === 'empty' || !last.found) return { found: false, expanded: expanded || 0, pathLen: null, cost: null, path: [] };
    var path = orderPath(last.codes, C, start, goal);
    return { found: true, expanded: expanded, pathLen: path.length - 1, cost: pathCost(path, grid.mud, mudCost === undefined ? 5 : mudCost), path: path };
  }
  /* Heatmap ranks: ord[cell] = order in which the cell was first expanded (-1 = never). */
  function expandOrder(steps, R, C) {
    var ord = new Int32Array(R * C).fill(-1), n = 0;
    steps.forEach(function (st) {
      if (!st.current) return;
      var k = st.current[0] * C + st.current[1];
      if (ord[k] < 0) ord[k] = n++;
    });
    return { ord: ord, total: Math.max(1, n) };
  }

  /* Every algorithm on the same map. rows: [{algo, name, found, expanded, pathLen, cost, optimal, path}] */
  function compareAll(grid, start, goal, o) {
    var L = libs(); o = o || {};
    var mudCost = o.mudCost === undefined ? 5 : o.mudCost;
    var rows = ALGOS.map(function (a) {
      var res;
      if (a.id === 'bfs' || a.id === 'dfs') {
        res = analyze(runSteps(a.id, grid, start, goal, o), grid, start, goal, mudCost);
      } else {
        var r = L.SP.gridSearchResult(grid, start, goal, { algo: a.id, mudCost: mudCost, heuristic: o.heuristic || 'manhattan', hWeight: o.hWeight === undefined ? 1 : o.hWeight });
        res = { found: r.found, expanded: r.expanded, pathLen: r.pathLen, cost: r.cost, path: r.path };
      }
      return { algo: a.id, name: a.name, found: res.found, expanded: res.expanded, pathLen: res.pathLen, cost: res.cost, path: res.path, optimal: false };
    });
    var best = Infinity;
    rows.forEach(function (r) { if (r.found && r.cost < best) best = r.cost; });
    rows.forEach(function (r) { r.optimal = r.found && r.cost === best; });
    return { rows: rows, best: best === Infinity ? null : best };
  }

  return {
    ALGOS: ALGOS, LIMITS: LIMITS, PRESETS: PRESETS,
    key: key, parseKey: parseKey, rngOf: rngOf, clampSize: clampSize, hasPath: hasPath,
    backtracker: backtracker, division: division, randomWalls: randomWalls, scatterMud: scatterMud, presetMap: presetMap,
    encodeMap: encodeMap, decodeMap: decodeMap, toGrid: toGrid,
    runSteps: runSteps, orderPath: orderPath, pathCost: pathCost, analyze: analyze, expandOrder: expandOrder, compareAll: compareAll
  };
}));
