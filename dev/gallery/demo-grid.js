/* Gallery demos: VDSA.views.grid */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- edit distance DP with dependency arrows ---------- */
  function editSteps(a, b) {
    var R = a.length + 1, C = b.length + 1, dp = [], steps = [];
    for (var i = 0; i < R; i++) { dp.push([]); for (var j = 0; j < C; j++) dp[i].push(null); }
    var rowH = [''].concat(a.split('')), colH = [''].concat(b.split(''));
    function cellsOf(mark, path) {
      return dp.map(function (row, r) {
        return row.map(function (v, c) {
          if (v === null) return null;
          var st = (mark && mark[r + ',' + c]) || (path && path[r + ',' + c] ? 'path' : 'default');
          return { value: v, state: st };
        });
      });
    }
    function snap(o) {
      steps.push({
        rows: R, cols: C, rowHeaders: rowH.map(function (x, k) { return k === 0 ? 'ε' : x; }), colHeaders: colH.map(function (x, k) { return k === 0 ? 'ε' : x; }),
        cells: cellsOf(o.mark, o.path), arrows: o.arrows || [], cursor: o.cursor || null,
        highlightRow: o.hr === undefined ? null : o.hr, highlightCol: o.hc === undefined ? null : o.hc, caption: o.caption
      });
    }
    for (i = 0; i < R; i++) dp[i][0] = i;
    for (j = 0; j < C; j++) dp[0][j] = j;
    snap({ caption: 'Base cases: turning a prefix into the empty string costs its length.' });
    for (i = 1; i < R; i++) {
      for (j = 1; j < C; j++) {
        var same = a[i - 1] === b[j - 1];
        var del = dp[i - 1][j] + 1, ins = dp[i][j - 1] + 1, rep = dp[i - 1][j - 1] + (same ? 0 : 1);
        var best = Math.min(del, ins, rep);
        dp[i][j] = best;
        var src = best === rep ? [i - 1, j - 1] : best === del ? [i - 1, j] : [i, j - 1];
        var mark = {}; mark[i + ',' + j] = 'active';
        mark[(i - 1) + ',' + j] = 'compare'; mark[i + ',' + (j - 1)] = 'compare'; mark[(i - 1) + ',' + (j - 1)] = 'compare';
        mark[src[0] + ',' + src[1]] = 'key';
        snap({
          mark: mark, cursor: [i, j], hr: i, hc: j,
          arrows: [[i - 1, j], [i, j - 1], [i - 1, j - 1]].map(function (s) { return { from: s, to: [i, j], state: s[0] === src[0] && s[1] === src[1] ? 'key' : 'default' }; }),
          caption: (same ? a[i - 1] + ' = ' + b[j - 1] + ': the diagonal is free. ' : a[i - 1] + ' ≠ ' + b[j - 1] + '. ') + 'min(' + del + ', ' + ins + ', ' + rep + ') = ' + best + '.'
        });
      }
    }
    // trace back the optimal path
    var path = {}, r = R - 1, c = C - 1;
    path[r + ',' + c] = true;
    while (r > 0 || c > 0) {
      if (r > 0 && c > 0 && dp[r][c] === dp[r - 1][c - 1] + (a[r - 1] === b[c - 1] ? 0 : 1)) { r--; c--; }
      else if (r > 0 && dp[r][c] === dp[r - 1][c] + 1) r--;
      else c--;
      path[r + ',' + c] = true;
    }
    snap({ path: path, caption: 'Distance ' + dp[R - 1][C - 1] + '. The highlighted cells trace one cheapest edit sequence.' });
    return steps;
  }

  G.demo('grid', {
    id: 'grid-dp', title: 'Edit distance — DP table with dependency arrows',
    note: 'mode "table": character headers, row/col highlight bands, cursor ring, arrows from the three source cells (chosen one in "key").',
    duration: 520, hold: 380,
    build: function (host) {
      var view = VDSA.views.grid(host, { mode: 'table', label: 'Edit distance table', cellSize: 44 });
      var steps = editSteps('horse', 'ros');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- BFS on a grid (layer by layer) ---------- */
  function bfsSteps(R, C, walls, start, end, opts) {
    opts = opts || {};
    var key = function (r, c) { return r + ',' + c; };
    var wallList = Object.keys(walls).map(function (k) { return k.split(',').map(Number); });
    var dist = {}, parent = {}, visited = {}, steps = [];
    var frontier = [start];
    dist[key(start[0], start[1])] = 0;
    function snap(cur, pathCells, caption) {
      var cells = {};
      Object.keys(visited).forEach(function (k) { cells[k] = { state: 'visited', label: opts.labels ? dist[k] : undefined }; });
      frontier.forEach(function (p) { cells[key(p[0], p[1])] = { state: 'frontier', label: opts.labels ? dist[key(p[0], p[1])] : undefined }; });
      (pathCells || []).forEach(function (k) { cells[k] = { state: 'path', label: opts.labels ? dist[k] : undefined }; });
      steps.push({ rows: R, cols: C, walls: wallList, cells: cells, markers: { start: { cell: start, label: 'S' }, end: { cell: end, label: 'T' } }, caption: caption });
    }
    snap(null, null, 'Start: the queue holds only S.');
    var found = false;
    while (frontier.length && !found) {
      var next = [];
      frontier.forEach(function (p) {
        visited[key(p[0], p[1])] = true;
        if (p[0] === end[0] && p[1] === end[1]) found = true;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var r = p[0] + d[0], c = p[1] + d[1], k = key(r, c);
          if (r < 0 || c < 0 || r >= R || c >= C || walls[k] || dist[k] !== undefined) return;
          dist[k] = dist[key(p[0], p[1])] + 1; parent[k] = key(p[0], p[1]); next.push([r, c]);
        });
      });
      frontier = found ? [] : next;
      snap(null, null, found ? 'Reached T.' : 'Layer ' + (dist[key(next[0] ? next[0][0] : 0, next[0] ? next[0][1] : 0)] || '') + ': ' + next.length + ' cells discovered.');
    }
    if (found) {
      var path = [], k = key(end[0], end[1]);
      while (k) { path.unshift(k); k = parent[k]; }
      var chunk = Math.max(1, Math.ceil(path.length / 6));
      for (var n = chunk; n < path.length + chunk; n += chunk) snap(null, path.slice(0, Math.min(n, path.length)), 'Follow parent links: shortest path of ' + (path.length - 1) + ' moves.');
    } else snap(null, null, 'T is unreachable.');
    return steps;
  }

  G.demo('grid', {
    id: 'grid-path', title: 'Pathfinding — BFS with paint mode and draggable markers', wide: true,
    note: 'mode "path", paintable, draggableMarkers. Pause, then drag on the grid to draw or erase walls, or drag S / T. The demo re-traces BFS on every change.',
    duration: 360, hold: 160,
    build: function (host, card) {
      var R = 20, C = 30, walls = {}, start = [10, 4], end = [9, 25];
      for (var r = 3; r < 17; r++) walls[r + ',14'] = true;
      for (var c = 18; c < 27; c++) walls['5,' + c] = true;
      for (c = 18; c < 27; c++) walls['14,' + c] = true;
      var view = VDSA.views.grid(host, { mode: 'path', label: 'Pathfinding grid', paintable: true, draggableMarkers: true, cellSize: 26 });
      var steps = bfsSteps(R, C, walls, start, end);
      var player = null;
      function retrace() {
        var fresh = bfsSteps(R, C, walls, start, end);
        steps.length = 0; fresh.forEach(function (s) { steps.push(s); });
        if (player) player.go(Math.min(player.index, steps.length - 1), true);
      }
      var painted = 0;
      view.on('paint', function (e) {
        if (player) player.setPlaying(false);
        e.cells.forEach(function (rc) { var k = rc[0] + ',' + rc[1]; if (e.value) walls[k] = true; else delete walls[k]; painted++; });
        G.log(card, 'paint ' + (e.value ? 'wall' : 'erase') + ' ' + JSON.stringify(e.cells) + '  (total ' + painted + ')');
      });
      view.on('paintend', function (e) { retrace(); G.log(card, 'paintend: ' + e.cells.length + ' cells ' + (e.value ? 'walled' : 'cleared')); });
      view.on('move-marker', function (e) {
        if (player) player.setPlaying(false);
        if (walls[e.cell[0] + ',' + e.cell[1]]) return;
        if (e.marker === 'start') start = e.cell; else end = e.cell;
        G.log(card, 'move-marker ' + e.marker + ' → ' + JSON.stringify(e.cell) + (e.done ? ' (done)' : ''));
        if (e.done) retrace();
      });
      G.button(card, 'Clear walls', function () { walls = {}; retrace(); });
      G.button(card, 'Random walls', function () {
        var rnd = VDSA.rng(Date.now() % 1000); walls = {};
        for (var i = 0; i < R * C * 0.28; i++) { var k = rnd.int(0, R - 1) + ',' + rnd.int(0, C - 1); if (k !== start.join(',') && k !== end.join(',')) walls[k] = true; }
        retrace();
      });
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); }, ready: function (p) { player = p; } };
    }
  });

  G.demo('grid', {
    id: 'grid-big', title: '60 × 40 grid — canvas renderer, BFS flood',
    note: 'renderer "auto" switches to canvas above 1200 cells: same API, colour transitions, theme re-read, hit-testing.',
    duration: 260, hold: 60,
    build: function (host) {
      var R = 40, C = 60, walls = {}, rnd = VDSA.rng(42);
      for (var i = 0; i < R * C * 0.3; i++) walls[rnd.int(0, R - 1) + ',' + rnd.int(0, C - 1)] = true;
      var start = [20, 3], end = [21, 56];
      delete walls[start.join(',')]; delete walls[end.join(',')];
      var view = VDSA.views.grid(host, { mode: 'path', label: 'Large pathfinding grid', cellSize: 14 });
      var steps = bfsSteps(R, C, walls, start, end);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- adjacency matrix ---------- */
  G.demo('grid', {
    id: 'grid-adj', title: 'Adjacency matrix — scanning neighbours',
    note: 'Node labels as headers; 0/1 cells; highlightRow walks the matrix; neighbours light up as "active".',
    duration: 480, hold: 700,
    build: function (host) {
      var names = ['A', 'B', 'C', 'D', 'E', 'F'];
      var edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [2, 5]];
      var M = names.map(function () { return names.map(function () { return 0; }); });
      edges.forEach(function (e) { M[e[0]][e[1]] = 1; M[e[1]][e[0]] = 1; });
      var view = VDSA.views.grid(host, { mode: 'table', label: 'Adjacency matrix', cellSize: 40 });
      var steps = [{ cells: M, rowHeaders: names, colHeaders: names, corner: '', caption: 'M[u][v] = 1 when u and v share an edge. The matrix is symmetric.' }];
      names.forEach(function (n, u) {
        var nbrs = [];
        steps.push({
          cells: M.map(function (row, r) { return row.map(function (v, c) { if (r === u && v) nbrs.push(names[c]); return { value: v, state: r === u ? (v ? 'active' : 'default') : (v ? 'default' : 'muted') }; }); }),
          rowHeaders: names, colHeaders: names, highlightRow: u,
          caption: 'Row ' + n + ': neighbours ' + nbrs.join(', ') + ' (scanning a row costs V cells).'
        });
      });
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- 2D prefix sums with count-up and row/col pointers ---------- */
  G.demo('grid', {
    id: 'grid-prefix', title: '2D prefix sums — count-up values, row/col pointers',
    note: 'countUp: true animates numeric changes; pointers {name, row} / {name, col} slide along the headers.',
    duration: 560, hold: 420,
    build: function (host) {
      var A = [[3, 1, 4, 1], [5, 9, 2, 6], [5, 3, 5, 8]];
      var P = A.map(function (r) { return r.slice(); });
      var view = VDSA.views.grid(host, { mode: 'table', label: 'Prefix sums', countUp: true, cellSize: 48, rowHeaders: true, colHeaders: true });
      var steps = [];
      function snap(i, j, caption, arrows) {
        steps.push({
          cells: P.map(function (row, r) { return row.map(function (v, c) { return { value: v, state: r === i && c === j ? 'active' : (r < i || (r === i && c < j)) ? 'visited' : 'default' }; }); }),
          pointers: i === null ? [] : [{ name: 'i', row: i }, { name: 'j', col: j, state: 'compare' }],
          cursor: i === null ? null : [i, j], arrows: arrows || [], caption: caption
        });
      }
      snap(null, null, 'Each cell will become the sum of everything above and to its left.');
      for (var i = 0; i < 3; i++) for (var j = 0; j < 4; j++) {
        var up = i > 0 ? P[i - 1][j] : 0, left = j > 0 ? P[i][j - 1] : 0, diag = i > 0 && j > 0 ? P[i - 1][j - 1] : 0;
        P[i][j] = A[i][j] + up + left - diag;
        var arrows = [];
        if (i > 0) arrows.push({ from: [i - 1, j], to: [i, j], label: '+', state: 'active' });
        if (j > 0) arrows.push({ from: [i, j - 1], to: [i, j], label: '+', state: 'active' });
        if (i > 0 && j > 0) arrows.push({ from: [i - 1, j - 1], to: [i, j], state: 'swap', label: '−' });
        snap(i, j, 'P[' + i + '][' + j + '] = ' + A[i][j] + (i ? ' + ' + up : '') + (j ? ' + ' + left : '') + (i && j ? ' − ' + diag : '') + ' = ' + P[i][j] + '.', arrows);
      }
      snap(null, null, 'Any rectangle sum is now four lookups.');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
