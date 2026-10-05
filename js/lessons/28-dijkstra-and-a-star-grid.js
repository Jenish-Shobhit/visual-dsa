/* Lesson 28 · Dijkstra & A* — part 4: f = g + h, the pathfinding lab, the heuristic explorer and the weight dial.
   Needs js/lessons/28-dijkstra-and-a-star.js (VDSA.L28) and js/algos/28-dijkstra-and-a-star.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SP = V.algos.shortestPaths;
  var L = V.L28;

  function key(r, c) { return r + ',' + c; }
  var HEAT_BAR = [
    { state: 'visited', label: 'Expanded (colour = cost from S)' }
  ];

  /* Put data-id / data-label on grid cells (the view has none) so VDSA.clickQuiz can target them. */
  function tagCells(view, R, C, describe) {
    var r0 = view.cellRect(0, 0);
    if (!r0) return;
    V.$$('.vz-gcell', view.el).forEach(function (el) {
      var x = parseFloat(el.getAttribute('x')), y = parseFloat(el.getAttribute('y'));
      var c = Math.floor((x - r0.x + 1) / r0.w), r = Math.floor((y - r0.y + 1) / r0.w);
      if (r < 0 || c < 0 || r >= R || c >= C) return;
      el.setAttribute('data-id', r + ',' + c);
      el.setAttribute('data-label', describe(r, c));
    });
  }

  /* ================================================================== f = g + h (a search paused) */
  function fghFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'visited', label: 'Expanded (number = g)' }, { state: 'active', label: 'Expanded last' },
      { state: 'frontier', label: fig.clientWidth < 520 ? 'Frontier (number = f)' : 'Frontier (big number = f, small = g + h)' }, { state: 'pivot', label: 'Target T' }
    ]);
    var R = 7, C = 11, S = [3, 1], T = [3, 9];
    var walls = [];
    for (var r = 1; r <= 5; r++) walls.push(key(r, 5));
    var grid = { rows: R, cols: C, walls: walls };
    var steps = SP.gridAStar(grid, S, T);
    var snapIdx = 3, snap = steps[snapIdx], next = steps[snapIdx + 1].current;
    var info = {}, cells = {};
    var g = new Array(R * C);
    for (var k = 0; k < g.length; k++) g[k] = snap.closedG[k];
    // g of a frontier cell = cheapest closed neighbour + 1 (no mud here)
    for (r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var code = snap.codes[r * C + c];
      var hh = Math.abs(r - T[0]) + Math.abs(c - T[1]);
      if (code === 'f') {
        var best = Infinity;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (nr < 0 || nc < 0 || nr >= R || nc >= C) return;
          var cg = snap.closedG[nr * C + nc];
          if (cg >= 0 && cg + 1 < best) best = cg + 1;
        });
        info[key(r, c)] = { g: best, h: hh, f: best + hh };
        cells[key(r, c)] = { state: 'frontier', text: best + hh, label: best + '+' + hh };
      } else if (code === 'v' || code === 'a') {
        cells[key(r, c)] = { state: code === 'a' ? 'active' : 'visited', text: r === S[0] && c === S[1] ? 'S' : snap.closedG[r * C + c] };
      }
    }
    cells[key(T[0], T[1])] = { state: 'pivot', text: 'T' };
    walls.forEach(function (k) { cells[k] = { wall: true, state: 'muted' }; });
    var view = V.views.grid(fig.querySelector('[data-stage]'), { mode: 'table', cellSize: 50, subLabelMinCell: 34, label: 'A search paused with its frontier labelled g plus h' });
    view.render({ rows: R, cols: C, walls: walls, cells: cells }, { duration: 0 });
    tagCells(view, R, C, function (r, c) {
      var i = info[key(r, c)];
      if (i) return 'Frontier cell row ' + r + ' column ' + c + ': g ' + i.g + ', h ' + i.h + ', f ' + i.f;
      return 'Cell row ' + r + ' column ' + c;
    });
    var nextKey = key(next[0], next[1]), ni = info[nextKey];
    var minG = Math.min.apply(null, Object.keys(info).map(function (k) { return info[k].g; }));
    fig.querySelector('[data-caption]').innerHTML = 'S = row ' + S[0] + ', column ' + S[1] + '; T is 8 columns to its right. Every frontier cell shows <code>f</code> big and <code>g + h</code> small.';
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-fgh', id: 'quiz-fgh',
      question: 'A* has expanded three cells. <b>Click the frontier cell it expands next.</b> (Dijkstra would ignore h and choose a cell with the smallest g, which is ' + minG + '.)',
      check: function (id) {
        if (id === nextKey) return true;
        var i = info[id];
        if (!i) {
          var rc = id.split(',').map(Number);
          if (walls.indexOf(id) >= 0) return { correct: false, message: 'That is a wall: nothing can be expanded there.' };
          if (snap.codes[rc[0] * C + rc[1]] === 'v' || snap.codes[rc[0] * C + rc[1]] === 'a') return { correct: false, message: 'That cell is already expanded. Pick a frontier cell: one of the cells showing a big f.' };
          return { correct: false, message: 'That cell has not been discovered yet, so it is not on the frontier.' };
        }
        return { correct: false, message: 'That cell has f = ' + i.g + ' + ' + i.h + ' = ' + i.f + '. Another frontier cell has a smaller f (' + ni.f + '), so A* prefers it.' + (i.g === minG ? ' It is close to S (small g), which is what Dijkstra would like, but far from T (large h).' : '') };
      },
      right: 'Row ' + next[0] + ', column ' + next[1] + ' has the smallest f: g + h = ' + ni.g + ' + ' + ni.h + ' = ' + ni.f + '. It is already 3 steps from S but only ' + ni.h + ' from T. Dijkstra would have taken a cell with g = ' + minG + ' next, right beside S, and wasted effort on the wrong side.'
    });
  }

  /* ================================================================== the pathfinding lab */
  var PRIORITY = {
    dijkstra: { pseudo: 'g[n]', js: 'g[n]', py: 'g[n]', name: 'Dijkstra', line: 'priority = the cost so far, g' },
    astar: { pseudo: 'g[n] + h(n)', js: 'g[n] + h(n)', py: 'g[n] + h(n)', name: 'A*', line: 'priority = g + h' },
    greedy: { pseudo: 'h(n)', js: 'h(n)', py: 'h(n)', name: 'Greedy best-first', line: 'priority = h only' }
  };
  function gridCode(algo) {
    var p = PRIORITY[algo], greedy = algo === 'greedy';
    var pseudo = [
      'gridSearch(grid, S, T)   // ' + p.line.replace('priority = ', 'order by '),
      '  g[S] ← 0; open ← priority queue {S}           // @init',
      '  while open is not empty                       // @loop',
      '    cell ← pop the smallest priority            // @pop',
      '    if cell = T: return the path via parents    // @found',
      '    for each open neighbour n of cell           // @neighbors',
      '      cost ← g[cell] + step cost (mud is dearer) // @cost',
      greedy ? '      if n has not been seen                    // @check' : '      if cost < g[n]                            // @check',
      '        g[n] ← cost; parent[n] ← cell           // @relax',
      '        push n with priority ' + p.pseudo + '   // @relax',
      '  return "no path"                              // @none'
    ].join('\n');
    var js = [
      'function gridSearch(grid, S, T) {',
      '  const g = new Map([[S, 0]]), parent = new Map();   // @init',
      '  const open = new MinHeap();                        // @init',
      '  open.push([priority(S), S]);                       // @init',
      '  while (open.size > 0) {                            // @loop',
      '    const [, cell] = open.pop();                     // @pop',
      '    if (cell === T) return pathTo(parent, T);        // @found',
      '    for (const n of openNeighbours(grid, cell)) {    // @neighbors',
      '      const cost = g.get(cell) + stepCost(n);        // @cost',
      greedy ? '      if (!g.has(n)) {                             // @check' : '      if (cost < (g.get(n) ?? Infinity)) {           // @check',
      '        g.set(n, cost); parent.set(n, cell);         // @relax',
      '        open.push([' + p.js + ', n]);' + (greedy ? '                     ' : '            ') + '// @relax',
      '      }',
      '    }',
      '  }',
      '  return null;                                       // @none',
      '}'
    ].join('\n');
    var py = [
      'def grid_search(grid, S, T):',
      '    g, parent = {S: 0}, {}                             # @init',
      '    open_ = [(priority(S), S)]                         # @init',
      '    while open_:                                       # @loop',
      '        _, cell = heapq.heappop(open_)                 # @pop',
      '        if cell == T: return path_to(parent, T)        # @found',
      '        for n in open_neighbours(grid, cell):          # @neighbors',
      '            cost = g[cell] + step_cost(n)              # @cost',
      greedy ? '            if n not in g:                             # @check' : '            if cost < g.get(n, float("inf")):          # @check',
      '                g[n], parent[n] = cost, cell           # @relax',
      '                heapq.heappush(open_, (' + p.py + ', n))' + (greedy ? '            ' : '   ') + '# @relax',
      '    return None                                        # @none'
    ].join('\n');
    return { pseudo: pseudo, js: js, py: py };
  }

  function gridLab(fig) {
    var SIZES = { std: { R: 15, C: 27, cell: 30, s: [7, 3], g: [7, 23] }, big: { R: 32, C: 56, cell: 24, s: [16, 6], g: [16, 49] } };
    var size = 'std', R = SIZES.std.R, C = SIZES.std.C;
    var algo = 'astar', heur = 'manhattan', brush = 'wall', heatOn = true;
    var walls = {}, mud = {}, start = SIZES.std.s.slice(), goal = SIZES.std.g.slice();
    var stage = fig.querySelector('[data-stage]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: gridCode(algo), default: 'pseudo', maxHeight: 340, title: 'gridSearch' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { cell: 'active', g: 'visited', h: 'compare', f: 'frontier', open: 'frontier' } });
    var view = V.views.grid(stage, { mode: 'path', paintable: true, paintValue: true, draggableMarkers: true, cellSize: SIZES.std.cell, label: 'Paintable pathfinding grid' });
    var ov = L.gridOverlay(view);

    function legend() {
      L.legend(fig.querySelector('[data-legend]'), [
        { state: 'default', color: 'var(--bg-sunken)', label: 'Open (cost 1)' },
        { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Wall' },
        { state: 'path', shape: 'line', label: 'Mud (cost 5, hatched)' },
        { state: 'frontier', label: 'Frontier' },
        { state: 'active', label: 'Expanding' },
        heatOn ? { state: 'visited', label: 'Expanded (heat = cost)' } : { state: 'visited', label: 'Expanded' },
        { state: 'path', label: 'Route' }
      ]);
    }
    function grid() { return { rows: R, cols: C, walls: Object.keys(walls), mud: Object.keys(mud) }; }
    function opts() { return { algo: algo, heuristic: heur }; }
    function generate() {
      var steps = SP['grid' + (algo === 'dijkstra' ? 'Dijkstra' : algo === 'astar' ? 'AStar' : 'Greedy')](grid(), start, goal, opts());
      return steps.map(function (st) {
        var o = Object.assign({}, st, { vars: Object.assign({}, st.vars) });
        if (o.vars.cell) o.vars.cell = V.vars.raw(o.vars.cell);
        ['h', 'f'].forEach(function (k) { if (o.vars[k] !== null && o.vars[k] !== undefined) o.vars[k] = Number(o.vars[k]); });
        return o;
      });
    }
    function blank() {
      var codes = '', mudStr = '', cl = [];
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) { var k = key(r, c); codes += walls[k] ? '#' : '.'; mudStr += mud[k] && !walls[k] ? '1' : '0'; cl.push(-1); }
      return { rows: R, cols: C, start: start, goal: goal, codes: codes, mud: mudStr, closedG: cl, maxG: 1 };
    }
    function render(step, ctx) {
      view.render(L.gridState(step, { heat: heatOn }), { duration: ctx.duration });
      ov.draw(step, { heat: heatOn });
    }
    V.onResize(stage, function () { requestAnimationFrame(function () { ov.redraw(); }); });

    /* ------------ presets (built from the current size) */
    function clearAll() { walls = {}; mud = {}; }
    function setStartGoal(s, g) { start = s; goal = g; }
    var rowMid = function () { return Math.floor(R / 2); };
    var colMid = function () { return Math.floor(C / 2); };
    function twoGaps() {
      clearAll(); setStartGoal([rowMid(), 3], [rowMid(), C - 4]);
      var cm = colMid();
      for (var r = 0; r < R; r++) if (r !== rowMid() && r !== R - 3) walls[key(r, cm)] = true;
      for (r = rowMid() - 2; r <= rowMid() + 2; r++) for (var c = cm - 4; c <= cm + 4; c++) if (c !== cm) mud[key(r, c)] = true;
    }
    function open() { clearAll(); setStartGoal([rowMid(), 3], [rowMid(), C - 4]); }
    function mudPond() {
      clearAll(); setStartGoal([rowMid(), 3], [rowMid(), C - 4]);
      for (var r = 2; r < R - 2; r++) for (var c = colMid() - 5; c <= colMid() + 5; c++) mud[key(r, c)] = true;
    }
    function trap() {
      clearAll(); setStartGoal([rowMid(), 3], [rowMid(), C - 4]);
      var cx = colMid() + 3, a = Math.max(3, Math.floor(R / 3));
      for (var r = rowMid() - a; r <= rowMid() + a; r++) walls[key(r, cx)] = true;
      for (var c = cx - 7; c <= cx; c++) { walls[key(rowMid() - a, c)] = true; walls[key(rowMid() + a, c)] = true; }
      delete walls[key(rowMid(), cx)];
      setStartGoal([rowMid(), 3], [rowMid(), cx + 5]);
      for (r = 1; r < R - 1; r++) if (Math.abs(r - rowMid()) > a + 1 && r % 2 === 0) walls[key(r, cx + 2)] = true;
    }
    function maze(seed) {
      clearAll();
      var rng = V.rng(seed), openC = {};
      var rr = R % 2 ? R : R - 1, cc = C % 2 ? C : C - 1;
      (function visit(r, c) {
        openC[key(r, c)] = true;
        V.shuffle([[0, 2], [2, 0], [0, -2], [-2, 0]], rng).forEach(function (d) {
          var nr = r + d[0], nc = c + d[1];
          if (nr < 0 || nc < 0 || nr >= rr || nc >= cc || openC[key(nr, nc)]) return;
          openC[key(r + d[0] / 2, c + d[1] / 2)] = true;
          visit(nr, nc);
        });
      }(1, 1));
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (!openC[key(r, c)]) walls[key(r, c)] = true;
      setStartGoal([1, 1], [rr - 2, cc - 2]);
    }
    function randomWalls(seed) {
      clearAll(); setStartGoal([rowMid(), 3], [rowMid(), C - 4]);
      var rng = V.rng(seed);
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var x = rng();
        if (x < 0.24) walls[key(r, c)] = true; else if (x < 0.34) mud[key(r, c)] = true;
      }
      delete walls[key(start[0], start[1])]; delete walls[key(goal[0], goal[1])]; delete mud[key(start[0], start[1])]; delete mud[key(goal[0], goal[1])];
    }
    var seed = 11;
    var presets = [
      { label: 'Wall, muddy gap', run: twoGaps }, { label: 'Open field', run: open }, { label: 'Mud pond', run: mudPond },
      { label: 'Cup trap', run: trap }, { label: 'Maze', run: function () { maze(seed++); } }, { label: 'Random', run: function () { randomWalls(seed++); } },
      { label: 'Clear', run: function () { clearAll(); setStartGoal(SIZES[size].s.slice(), SIZES[size].g.slice()); } }
    ];
    var presetBox = fig.querySelector('[data-presets]');
    presets.forEach(function (p) {
      presetBox.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { p.run(); reload(); } }, p.label));
    });

    /* ------------ comparison table: all three searches on the current map */
    var cmpHost = fig.querySelector('[data-compare]');
    var cmpRows = {};
    (function buildCompare() {
      var tbody = h('tbody');
      ['dijkstra', 'astar', 'greedy'].forEach(function (a) {
        var tr = h('tr', { 'data-algo': a }, h('th', { scope: 'row' }, PRIORITY[a].name), h('td', { class: 'dj-cmp__exp' }), h('td', { class: 'num dj-cmp__cost' }), h('td', { class: 'dj-cmp__note' }));
        cmpRows[a] = tr; tbody.appendChild(tr);
      });
      cmpHost.appendChild(h('p', { class: 'dj-cmp__cap' }, 'All three searches on this map (same heuristic setting)'));
      cmpHost.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table table--compact dj-cmp' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Search'), h('th', { scope: 'col' }, 'Cells expanded'), h('th', { scope: 'col', class: 'num' }, 'Route cost'), h('th', { scope: 'col' }, 'Verdict'))),
        tbody)));
    }());
    function updateCompare() {
      var cmp = SP.gridCompare(grid(), start, goal, { heuristic: heur });
      var maxE = Math.max(1, cmp.dijkstra.expanded, cmp.astar.expanded, cmp.greedy.expanded);
      ['dijkstra', 'astar', 'greedy'].forEach(function (a) {
        var r = cmp[a], tr = cmpRows[a];
        tr.classList.toggle('is-current', a === algo);
        tr.querySelector('.dj-cmp__exp').innerHTML = '<span class="dj-cmp__bar" style="--w:' + (100 * r.expanded / maxE).toFixed(1) + '%"></span><b>' + r.expanded + '</b>';
        tr.querySelector('.dj-cmp__cost').textContent = r.found ? r.cost : '–';
        var note;
        if (!r.found) note = 'no path';
        else if (r.cost === cmp.best) note = 'cheapest route';
        else note = '+' + (r.cost - cmp.best) + ' dearer than the best';
        tr.querySelector('.dj-cmp__note').textContent = note;
        tr.querySelector('.dj-cmp__note').classList.toggle('is-bad', r.found && r.cost !== cmp.best);
      });
    }

    var player = V.player({
      root: fig, steps: generate(), render: render, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { expanded: 'Cells expanded', frontier: 'Frontier size', cost: 'Route cost' },
      counterStates: { expanded: 'visited', frontier: 'frontier', cost: 'path' },
      baseStepMs: 220, animMs: 160, speeds: [0.5, 1, 2, 4, 8, 16, 32], label: 'Pathfinding lab controls'
    });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'found') return i;
      return -1;
    }, function (c) {
      var st = c.step, cost = st.counters.cost;
      if (algo === 'greedy') {
        return {
          question: 'Greedy best-first is about to stop at T with a route costing <b>' + cost + '</b>. Is that route guaranteed to be the cheapest?',
          options: ['Yes: it reached T first', 'No: greedy looked only at the estimate h and never at the cost already paid'], answer: 1,
          explain: ['Reaching T first only means T looked closest to the goal at each step. A cheaper route may exist, like one that goes around mud. The table below the grid shows when it does.',
            'Greedy ignores g, so it can walk straight through expensive mud because the goal “looks” closer. Its answer can be dearer than the best. Dijkstra and A* (with an admissible h) never are.']
        };
      }
      return {
        question: 'T is about to leave the frontier with cost <b>' + cost + '</b>. What does that prove?',
        options: ['This is the cheapest cost from S to T', 'A cheaper route may still hide in the frontier', 'Nothing yet: the path must be traced first'], answer: 0,
        explain: [algo === 'astar' ? 'Every other frontier cell has f = g + h of at least ' + cost + ', and h never overestimates, so no route through it can cost less. The cost is final.' : 'Every other frontier cell has a cost of at least ' + cost + ', and steps never subtract, so no route through it can be cheaper. The cost is final.',
          'That is the trap greedy falls into. Dijkstra and A* order by cost (plus an optimistic guess), so nothing waiting in the frontier can beat the cell they take.',
          'The number is already final: tracing parents only draws the route that has this cost.']
      };
    }, { id: 'dj-grid-found' });

    function reload() { player.setSteps(generate()); updateCompare(); }
    function recompute(instantBlank) { if (instantBlank) { view.render(L.gridState(blank(), { heat: heatOn }), { duration: 0 }); ov.draw(blank(), { heat: heatOn }); } }
    function setSize(sz) {
      size = sz; R = SIZES[sz].R; C = SIZES[sz].C;
      view.setOptions({ cellSize: SIZES[sz].cell });
      view.reset && view.reset();
      clearAll(); setStartGoal(SIZES[sz].s.slice(), SIZES[sz].g.slice());
      twoGaps();
      player.setSpeed && player.setSpeed(sz === 'big' ? 8 : 1);
      reload();
    }
    twoGaps();
    legend();
    reload();

    V.segmented(fig.querySelector('[data-algo]'), {
      label: 'Search', value: algo,
      options: [{ value: 'dijkstra', label: 'Dijkstra (g)' }, { value: 'astar', label: 'A* (g + h)' }, { value: 'greedy', label: 'Greedy (h)' }],
      onChange: function (v) { algo = v; code.setSource(gridCode(v)); reload(); }
    });
    var heurSel = fig.querySelector('[data-heur]');
    heurSel.addEventListener('change', function () { heur = heurSel.value; reload(); });
    V.segmented(fig.querySelector('[data-brush]'), {
      label: 'Paint with', value: brush,
      options: [{ value: 'wall', label: 'Wall' }, { value: 'mud', label: 'Mud' }, { value: 'erase', label: 'Erase' }],
      onChange: function (v) { brush = v; view.setOptions({ paintValue: v !== 'erase' }); }
    });
    V.toggle(fig.querySelector('[data-heat]'), { label: 'Heatmap', checked: true, onChange: function (on) { heatOn = on; fig.querySelector('[data-heatbar]').hidden = !on; legend(); player.refresh(); } });
    V.segmented(fig.querySelector('[data-size]'), {
      label: 'Grid size', value: size,
      options: [{ value: 'std', label: 'Standard 15 × 27' }, { value: 'big', label: 'Large 32 × 56 (canvas)' }],
      onChange: setSize
    });

    view.on('paint', function (e) {
      player.pause();
      e.cells.forEach(function (rc) {
        var k = key(rc[0], rc[1]);
        if (k === key(start[0], start[1]) || k === key(goal[0], goal[1])) return;
        if (brush === 'wall') { walls[k] = true; delete mud[k]; }
        else if (brush === 'mud') { mud[k] = true; delete walls[k]; }
        else { delete walls[k]; delete mud[k]; }
      });
      recompute(true);
    });
    view.on('paintend', function () { reload(); });
    view.on('move-marker', function (e) {
      player.pause();
      if (!e.done) return;
      var k = key(e.cell[0], e.cell[1]);
      if (walls[k]) { reload(); return; }
      delete mud[k];
      if (e.marker === 'start') { if (k !== key(goal[0], goal[1])) start = e.cell.slice(); }
      else if (e.marker === 'end') { if (k !== key(start[0], start[1])) goal = e.cell.slice(); }
      reload();
    });
  }

  /* ================================================================== the heuristic explorer (three searches race) */
  function exploreMap() {
    var R = 13, C = 23, walls = [], mud = [];
    for (var r = 0; r < R; r++) if (r !== 6 && r !== 11) walls.push(key(r, 11));
    for (r = 5; r <= 7; r++) for (var c = 8; c <= 14; c++) if (c !== 11) mud.push(key(r, c));
    return { rows: R, cols: C, walls: walls, mud: mud };
  }
  L.exploreMap = exploreMap;

  function heurFigure(fig) {
    var grid = exploreMap(), S = [6, 2], T = [6, 20];
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'var(--bg-sunken)', label: 'Open' },
      { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Wall' },
      { state: 'path', shape: 'line', label: 'Mud (cost 5)' },
      { state: 'frontier', label: 'Frontier' }, { state: 'visited', label: 'Expanded (darker = costlier)' }, { state: 'path', label: 'Route' }
    ]);
    var cfg = [
      { id: '0', name: 'Dijkstra (h = 0)', steps: SP.gridDijkstra(grid, S, T) },
      { id: '1', name: 'A* (Manhattan)', steps: SP.gridAStar(grid, S, T) },
      { id: '3', name: 'A* (3 × Manhattan)', steps: SP.gridAStar(grid, S, T, { hWeight: 3 }) }
    ];
    cfg.forEach(function (c) {
      c.view = V.views.grid(fig.querySelector('[data-stage="' + c.id + '"]'), { mode: 'path', cellSize: 18, showValues: false, label: c.name });
      c.ov = L.gridOverlay(c.view);
      c.tally = fig.querySelector('[data-tally="' + c.id + '"]');
      c.end = c.steps[c.steps.length - 1];
      c.cost = c.end.counters.cost;
    });
    var best = cfg[0].cost, PACE = 3;
    var maxLen = Math.max.apply(null, cfg.map(function (c) { return c.steps.length; }));
    var frames = [];
    for (var k = 0; k * PACE < maxLen + PACE; k++) frames.push({ k: k });
    frames.forEach(function (fr, i) {
      var ex = cfg.map(function (c) { return c.steps[Math.min(c.steps.length - 1, fr.k * PACE)].counters.expanded; });
      fr.caption = i === 0 ? 'Same map, same start S and target T, three priorities. Each panel advances three steps per frame.'
        : i === frames.length - 1 ? 'Done. Dijkstra expanded <b>' + cfg[0].end.counters.expanded + '</b> cells and paid <b>' + best + '</b>. A* with Manhattan expanded <b>' + cfg[1].end.counters.expanded + '</b> and paid the same <b>' + cfg[1].cost + '</b>. Three times Manhattan expanded only <b>' + cfg[2].end.counters.expanded + '</b> but paid <b>' + cfg[2].cost + '</b>, which is ' + (cfg[2].cost - best) + ' more: it rushed into the muddy gap.'
          : 'Expanded so far: Dijkstra <b>' + ex[0] + '</b>, A* <b>' + ex[1] + '</b>, 3 × Manhattan <b>' + ex[2] + '</b>.';
    });
    V.player({
      root: fig, steps: frames, caption: fig.querySelector('[data-caption]'), baseStepMs: 150, animMs: 110, speeds: [0.5, 1, 2, 4, 8], speed: 1, label: 'Heuristic race controls',
      render: function (fr, ctx) {
        cfg.forEach(function (c) {
          var st = c.steps[Math.min(c.steps.length - 1, fr.k * PACE)];
          c.view.render(L.gridState(st, { heat: true }), { duration: ctx.duration });
          c.ov.draw(st, { heat: true });
          var done = st === c.end;
          c.tally.innerHTML = '<b>' + st.counters.expanded + '</b> expanded' + (done ? ' · cost <b>' + c.cost + '</b>' + (c.cost === best ? ' <span class="is-good">optimal</span>' : ' <span class="is-bad">+' + (c.cost - best) + ' dearer</span>') : '');
        });
      }
    });
    cfg.forEach(function (c) { V.onResize(c.view.el.parentNode, function () { requestAnimationFrame(function () { c.ov.redraw(); }); }); });
  }

  /* ================================================================== the weight dial */
  function dialFigure(fig) {
    var grid = exploreMap(), S = [6, 2], T = [6, 20];
    var WEIGHTS = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 'greedy'];
    var LABELS = ['0', '0.5', '1', '1.5', '2', '3', '4', '6', '∞'];
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Cells expanded (% of Dijkstra)' }, { state: 'path', label: 'Route cost (% of the cheapest)' }
    ]);
    var results = WEIGHTS.map(function (w) {
      return w === 'greedy' ? { steps: SP.gridGreedy(grid, S, T), res: SP.gridSearchResult(grid, S, T, { algo: 'greedy' }) }
        : { steps: null, w: w, res: SP.gridSearchResult(grid, S, T, { algo: 'astar', hWeight: w }) };
    });
    var opt = results[2].res.cost, base = results[0].res.expanded;
    var gview = V.views.grid(fig.querySelector('[data-stage="grid"]'), { mode: 'path', cellSize: 18, showValues: false, label: 'Final search for the chosen weight' });
    var gov = L.gridOverlay(gview);
    var chart = V.views.chart(fig.querySelector('[data-stage="chart"]'), { type: 'bar', height: 250, label: 'Cells expanded and route cost against the heuristic weight' });
    var cap = fig.querySelector('[data-caption]');
    var shown = false;
    function lastStep(i) {
      var w = WEIGHTS[i];
      var steps = w === 'greedy' ? SP.gridGreedy(grid, S, T) : (w === 0 ? SP.gridDijkstra(grid, S, T) : SP.gridAStar(grid, S, T, { hWeight: w }));
      return steps[steps.length - 1];
    }
    function show(i, dur) {
      var r = results[i].res, st = lastStep(i);
      gview.render(L.gridState(st, { heat: true }), { duration: 0 });
      gov.draw(st, { heat: true });
      var pctE = Math.round(100 * r.expanded / base), pctC = Math.round(100 * r.cost / opt);
      cap.innerHTML = (i === 0 ? '<b>Weight 0 is Dijkstra.</b> ' : i === 2 ? '<b>Weight 1 is A*.</b> ' : i === 8 ? '<b>Greedy best-first.</b> ' : '<b>Weight ' + LABELS[i] + '.</b> ') +
        'Expanded <b>' + r.expanded + '</b> cells (' + pctE + '% of Dijkstra) and paid <b>' + r.cost + '</b> (' + pctC + '% of the cheapest' + (r.cost === opt ? ', optimal' : ', ' + (r.cost - opt) + ' too much') + ').';
      chart.render({
        categories: LABELS,
        series: [
          { id: 'exp', label: 'expanded, % of Dijkstra', values: results.map(function (x) { return Math.round(100 * x.res.expanded / base); }), state: 'active' },
          { id: 'cost', label: 'route cost, % of cheapest', values: results.map(function (x) { return Math.round(100 * x.res.cost / opt); }), state: 'path' }
        ],
        y: { label: 'percent', min: 0, max: 160 },
        highlight: { category: LABELS[i] }
      }, { duration: dur });
    }
    V.slider(fig.querySelector('[data-slider]'), {
      label: 'Weight on h', min: 0, max: WEIGHTS.length - 1, step: 1, value: 2,
      format: function (v) { return LABELS[v] + (v === 0 ? ' (Dijkstra)' : v === 2 ? ' (A*)' : v === 8 ? ' (greedy)' : ''); },
      onInput: function (v) { show(v, 350); }
    });
    show(2, 0);
    V.onVisible(fig, function (vis) { if (vis && !shown) { shown = true; show(2, 900); } });
    V.onResize(gview.el.parentNode, function () { requestAnimationFrame(function () { gov.redraw(); }); });
  }

  /* ================================================================== is the guess admissible? */
  function admissibleQuiz() {
    V.quiz('#quiz-admissible', {
      id: 'quiz-admissible',
      question: 'Your game lets characters move <em>diagonally</em>, and a diagonal step costs 1, like any other step. A* uses the Manhattan distance |Δrow| + |Δcol| as h. Does A* still guarantee the cheapest route?',
      options: [
        'Yes: Manhattan distance is always admissible',
        'No: one diagonal step covers Manhattan distance 2 for a cost of 1, so h can overestimate',
        'Yes, but only when there are no walls',
        'No: A* never guarantees the cheapest route'
      ],
      answer: 1,
      explain: [
        'Manhattan distance is admissible only when moves are up, down, left and right. With diagonals the true cost can be smaller than |Δrow| + |Δcol|.',
        'From (0, 0) to (1, 1) Manhattan says 2, but one diagonal step costs 1. Since h can exceed the true remaining cost, it is not admissible, and A* may return a route that costs more than the best. Use Chebyshev distance, max(|Δrow|, |Δcol|), instead.',
        'Walls only make true costs larger, which helps admissibility. The problem is the diagonal move, with or without walls.',
        'It does, with an admissible heuristic. The guarantee is exactly what admissibility buys.'
      ]
    });
  }

  V.ready(function () {
    L.lazy('#fig-fgh', fghFigure);
    L.lazy('#lab-grid', gridLab);
    L.lazy('#fig-heur', heurFigure);
    L.lazy('#fig-hweight', dialFigure);
    L.lazy('#quiz-admissible', admissibleQuiz);
    if (V.quizScore && V.quizScore.register) V.quizScore.register('dj-grid-found');
  });
}());
