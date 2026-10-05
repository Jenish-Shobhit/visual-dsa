/* Pathfinder lab (labs/pathfinder.html). Big paintable grid, five searches, compare table and a race.
   Step generators: lesson 26 (BFS, DFS) and lesson 28 (Dijkstra, A*, greedy) through js/labs/pathfinder-model.js.
   Playback is a small loop of its own so turbo can batch steps; frames[0] is the blank map, frames[i] is step i.
   State lives in the URL: ?algo=astar&h=manhattan&hw=1&mc=5&sz=m&r=25&c=45&s=12.2&g=12.42&m=<map> */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, P = window.Pathfinder;
  var key = P.key;
  var narrow = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;

  var SIZES = narrow
    ? { s: { R: 12, C: 15, cell: 40, label: 'Small' }, m: { R: 18, C: 21, cell: 30, label: 'Medium' }, l: { R: 26, C: 30, cell: 24, label: 'Large' } }
    : { s: { R: 15, C: 27, cell: 44, label: 'Small' }, m: { R: 25, C: 45, cell: 32, label: 'Medium' }, l: { R: 40, C: 70, cell: 24, label: 'Large' } };
  var SPS = [2, 4, 8, 15, 30, 60, 120, 240, 480, 960];           // steps per second for speed 1..10
  var DEFAULT_SPEED = { s: 5, m: 7, l: 8 };
  var URL_MAX_CELLS = 1200;
  var NOTES = {
    bfs: 'BFS spreads in a diamond and finds the route with the fewest steps. It does not know mud costs more.',
    dfs: 'DFS dives down one corridor at a time. It finds a route if one exists, but rarely a short one.',
    dijkstra: 'Dijkstra expands the cheapest cell first, so it spreads in rings of equal cost and always finds the cheapest route.',
    astar: 'A* adds a guess of the distance left to the cost so far. With weight 1 the route is still the cheapest; raise the weight to expand fewer cells.',
    greedy: 'Greedy best-first looks only at the guess of distance left. It is fast on open ground and easy to fool with walls and mud.'
  };

  var S = {
    algo: 'astar', heur: 'manhattan', hw: 1, mudCost: 5, size: narrow ? 's' : 'm', R: narrow ? 12 : 25, C: narrow ? 15 : 45,
    walls: {}, mud: {}, start: [12, 2], goal: [12, 42], brush: 'wall', heat: true, turbo: false, speed: 7, preset: 'twogaps',
    density: 0.25, loops: 0.06
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var fig = $('#stage-fig'), stage = $('[data-stage]', fig);
  var frames = [], steps = [], run = null, idx = 0, last = 0, playing = false, raf = 0, acc = 0, lastT = 0;
  var painting = false, wasEnd = false, seedCounter = 1 + (Date.now() % 9973);

  /* ================================================================== URL state */
  function parseCell(str, R, C) {
    var m = /^(\d+)\.(\d+)$/.exec(str || '');
    if (!m) return null;
    var r = +m[1], c = +m[2];
    return r < R && c < C ? [r, c] : null;
  }
  function readUrl() {
    var q = new URLSearchParams(location.search), sz = q.get('sz');
    if (sz && SIZES[sz]) S.size = sz;
    S.R = SIZES[S.size].R; S.C = SIZES[S.size].C;
    var r = parseInt(q.get('r'), 10), c = parseInt(q.get('c'), 10);
    if (r && c) { var d = P.clampSize(r, c); S.R = d.R; S.C = d.C; }
    if (P.ALGOS.some(function (a) { return a.id === q.get('algo'); })) S.algo = q.get('algo');
    if (q.get('h') === 'euclid' || q.get('h') === 'manhattan') S.heur = q.get('h');
    var hw = parseFloat(q.get('hw')); if (hw >= 1 && hw <= 5) S.hw = hw;
    var mc = parseInt(q.get('mc'), 10); if (mc >= 2 && mc <= 10) S.mudCost = mc;
    S.speed = DEFAULT_SPEED[S.size];
    var map = q.get('m') ? P.decodeMap(q.get('m'), S.R, S.C) : null;
    var st = parseCell(q.get('s'), S.R, S.C), go = parseCell(q.get('g'), S.R, S.C);
    if (map) {
      S.walls = {}; S.mud = {}; map.walls.forEach(function (k) { S.walls[k] = true; }); map.mud.forEach(function (k) { S.mud[k] = true; });
      S.start = st || [Math.floor(S.R / 2), 2]; S.goal = go || [Math.floor(S.R / 2), S.C - 3];
      delete S.walls[key(S.start[0], S.start[1])]; delete S.walls[key(S.goal[0], S.goal[1])];
      S.preset = null;
      return true;
    }
    return false;
  }
  var urlTimer = 0;
  function urlString() {
    var q = new URLSearchParams();
    q.set('algo', S.algo); q.set('sz', S.size);
    if (S.heur !== 'manhattan') q.set('h', S.heur);
    if (S.hw !== 1) q.set('hw', String(S.hw));
    if (S.mudCost !== 5) q.set('mc', String(S.mudCost));
    q.set('r', S.R); q.set('c', S.C);
    q.set('s', S.start[0] + '.' + S.start[1]); q.set('g', S.goal[0] + '.' + S.goal[1]);
    if (S.R * S.C <= URL_MAX_CELLS) q.set('m', P.encodeMap(S.R, S.C, S.walls, S.mud));
    return location.pathname + '?' + q.toString();
  }
  function writeUrl(now) {
    clearTimeout(urlTimer);
    function go() { try { history.replaceState(null, '', urlString()); } catch (e) { /* file:// or sandbox */ } }
    if (now) go(); else urlTimer = setTimeout(go, 350);
  }

  /* ================================================================== views */
  var view = V.views.grid(stage, { mode: 'path', paintable: true, paintValue: true, draggableMarkers: true, cellSize: SIZES[S.size].cell, minCell: 3, canvasThreshold: 700, label: 'Pathfinding grid: paint walls and mud, drag S and T' });
  var ov = P.overlay(view);
  V.onResize(stage, function () { requestAnimationFrame(function () { ov.redraw(); }); });

  var stats = V.stats($('[data-stats]', fig), {
    labels: { expanded: 'Cells expanded', frontier: 'Waiting', length: 'Route length', cost: 'Route cost', verdict: 'Compared with the cheapest' },
    states: { expanded: 'visited', frontier: 'frontier', length: 'path', cost: 'path', verdict: 'done' }
  });
  var caption = $('[data-caption]', fig), scrub = $('[data-scrub]', fig), stepnum = $('[data-stepnum]', fig);
  var playBtn = $('[data-act="play"]', fig), bar = $('.pf-bar', fig);

  function legend() {
    V.legend($('[data-legend]', fig), [
      { state: 'default', color: 'var(--bg-sunken)', shape: 'outline', label: 'Open (cost 1)' },
      { state: 'default', color: 'color-mix(in srgb, var(--st-default) 78%, var(--el-fill))', label: 'Wall' },
      { state: 'path', shape: 'line', label: 'Mud (cost ' + S.mudCost + ')' },
      { state: 'frontier', label: 'Waiting' },
      { state: 'active', label: 'Expanding' },
      S.heat ? { state: 'visited', label: 'Expanded (darker = later)' } : { state: 'visited', label: 'Expanded' },
      { state: 'path', label: 'Route' }
    ]);
  }

  /* ================================================================== the run */
  function mudString() {
    var s = '';
    for (var r = 0; r < S.R; r++) for (var c = 0; c < S.C; c++) { var k = key(r, c); s += S.mud[k] && !S.walls[k] ? '1' : '0'; }
    return s;
  }
  function blankFrame(mudStr) {
    var codes = '';
    for (var r = 0; r < S.R; r++) for (var c = 0; c < S.C; c++) codes += S.walls[key(r, c)] ? '#' : '.';
    return { rows: S.R, cols: S.C, start: S.start, goal: S.goal, codes: codes, mud: mudStr, counters: { expanded: 0, frontier: 0 }, kind: 'blank', found: false };
  }
  function opts() { return { mudCost: S.mudCost, heuristic: S.heur, hWeight: S.hw }; }

  function build() {
    var grid = P.toGrid(S.R, S.C, Object.keys(S.walls), Object.keys(S.mud).filter(function (k) { return !S.walls[k]; }));
    var mudStr = mudString();
    steps = P.runSteps(S.algo, grid, S.start, S.goal, opts());
    var ex = P.expandOrder(steps, S.R, S.C);
    var res = P.analyze(steps, grid, S.start, S.goal, S.mudCost);
    var best = null;
    if (res.found) {
      best = window.VDSA.algos.shortestPaths.gridSearchResult(grid, S.start, S.goal, { algo: 'dijkstra', mudCost: S.mudCost }).cost;
    }
    run = { grid: grid, mud: mudStr, ord: ex.ord, total: ex.total, res: res, best: best };
    frames = [blankFrame(mudStr)].concat(steps);
    last = frames.length - 1;
    scrub.max = String(last);
    var a = P.ALGOS.filter(function (x) { return x.id === S.algo; })[0];
    $('[data-title]', fig).textContent = a.name + ' on a ' + S.R + ' × ' + S.C + ' grid';
    var learn = $('[data-learn]', fig);
    learn.href = '../lessons/' + a.lesson + '.html'; learn.textContent = 'Learn how ' + a.name + ' works →';
  }

  var routeAnimate = false;
  function show(i, o) {
    o = o || {};
    idx = Math.max(0, Math.min(last, i));
    var st = frames[idx], atEnd = idx === last && last > 0;
    var line = atEnd && run.res.found;
    view.render(P.gridState(st, { heat: S.heat, line: line }), { duration: o.duration || 0 });
    ov.draw({ rows: S.R, cols: S.C, codes: st.codes, mud: run.mud, ord: run.ord, total: run.total, line: line }, { heat: S.heat });
    ov.route(atEnd && run.res.found ? run.res.path : null, { animate: !!o.animateRoute });
    scrub.value = String(idx); scrub.style.setProperty('--p', (last ? 100 * idx / last : 0) + '%');
    stepnum.textContent = idx + ' / ' + last;
    var cn = st.counters, ex = cn.expanded !== undefined ? cn.expanded : cn.visited;
    var o2 = { expanded: ex, frontier: cn.frontier, length: atEnd && run.res.found ? run.res.pathLen : '–', cost: atEnd && run.res.found ? run.res.cost : '–' };
    if (atEnd) o2.verdict = run.res.found ? (run.res.cost === run.best ? 'Cheapest route' : '+' + (run.res.cost - run.best) + ' dearer') : 'No path';
    stats.update(o2);
    if (idx === 0) caption.textContent = last <= 1 ? 'The start cell is walled in or the map is empty.' : 'Press Run, or drag on the grid to change the map. Turn on Turbo to see the answer at once.';
    else caption.innerHTML = st.caption || '';
    $('[data-act="back"]', fig).disabled = idx === 0;
    $('[data-act="restart"]', fig).disabled = idx === 0;
    $('[data-act="fwd"]', fig).disabled = idx === last;
    $('[data-act="end"]', fig).disabled = idx === last;
  }

  function setPlaying(on) {
    playing = on;
    bar.classList.toggle('is-playing', on);
    playBtn.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Pause (Space)' : 'Run (Space)');
    cancelAnimationFrame(raf);
    if (on) { lastT = performance.now(); acc = 0; raf = requestAnimationFrame(loop); }
  }
  function loop(now) {
    if (!playing) return;
    var dt = Math.max(0, Math.min(80, now - lastT)); lastT = now;
    var sps = S.turbo ? Math.max(300, last * 1.5) : SPS[S.speed - 1];
    acc += dt * sps / 1000;
    var n = Math.floor(acc); acc -= n;
    if (V.reducedMotion()) n = Math.max(n, 1);
    if (n > 0) {
      var next = Math.min(last, idx + n), dur = !S.turbo && sps <= 30 && !V.reducedMotion() ? Math.round(Math.min(140, 900 / sps)) : 0;
      show(next, { duration: dur, animateRoute: next === last && !S.turbo });
      if (next >= last) { setPlaying(false); return; }
    }
    raf = requestAnimationFrame(loop);
  }
  function play() {
    if (playing) { setPlaying(false); return; }
    if (idx >= last) show(0);
    if (last <= 1) { show(last); return; }
    setPlaying(true);
  }
  function pause() { if (playing) setPlaying(false); }

  /* rebuild after the map or the search changed; keep the finished picture if that is what was showing */
  function reload(o) {
    o = o || {};
    var keepEnd = o.keepEnd !== undefined ? o.keepEnd : (idx === last && last > 0);
    pause();
    build();
    show(keepEnd ? last : 0);
    afterChange();
  }
  var cmpTimer = 0;
  function afterChange() {
    writeUrl();
    if (cmpOpen) { clearTimeout(cmpTimer); cmpTimer = setTimeout(updateCompare, 250); }
    if (raceOpen) race.invalidate();
  }

  /* ================================================================== maps */
  function clearAll() { S.walls = {}; S.mud = {}; }
  function setMap(m) {
    clearAll();
    m.walls.forEach(function (k) { S.walls[k] = true; });
    (m.mud || []).forEach(function (k) { S.mud[k] = true; });
    S.start = m.start.slice(); S.goal = m.goal.slice();
  }
  function applyPreset(id) { S.preset = id; setMap(P.presetMap(id, S.R, S.C, seedCounter++)); reload({ keepEnd: false }); }
  function setSize(sz) {
    S.size = sz; S.R = SIZES[sz].R; S.C = SIZES[sz].C; S.speed = DEFAULT_SPEED[sz];
    view.setOptions({ cellSize: SIZES[sz].cell });
    if (view.reset) view.reset();
    speedCtl.set(S.speed);
    setMap(P.presetMap(S.preset || 'twogaps', S.R, S.C, seedCounter++));
    reload({ keepEnd: false });
  }
  function generate(kind) {
    var m;
    seedCounter += 1 + Math.floor(Math.random() * 1000);
    if (kind === 'backtracker') m = P.backtracker(S.R, S.C, seedCounter, { loops: S.loops });
    else if (kind === 'division') m = P.division(S.R, S.C, seedCounter);
    else if (kind === 'random') m = P.randomWalls(S.R, S.C, S.density, seedCounter, { start: S.start, goal: S.goal });
    else if (kind === 'mud') {
      var mud = P.scatterMud(S.R, S.C, S.walls, seedCounter, { keep: Object.keys(S.mud), avoid: [S.start, S.goal] });
      S.mud = {}; mud.forEach(function (k) { S.mud[k] = true; }); S.preset = null;
      reload({ keepEnd: false }); return;
    }
    S.preset = null;
    var mudKeep = kind === 'random' ? Object.keys(S.mud).filter(function (k) { return !m.walls.includes(k); }) : [];
    setMap({ walls: m.walls, mud: mudKeep, start: m.start, goal: m.goal });
    reload({ keepEnd: false });
  }

  /* ================================================================== paint and markers */
  view.on('paint', function (e) {
    if (!painting) { painting = true; wasEnd = idx === last && last > 0; pause(); }
    e.cells.forEach(function (rc) {
      var k = key(rc[0], rc[1]);
      if (k === key(S.start[0], S.start[1]) || k === key(S.goal[0], S.goal[1])) return;
      if (S.brush === 'wall') { S.walls[k] = true; delete S.mud[k]; }
      else if (S.brush === 'mud') { S.mud[k] = true; delete S.walls[k]; }
      else { delete S.walls[k]; delete S.mud[k]; }
    });
    var m = mudString(), b = blankFrame(m);
    view.render(P.gridState(b, { heat: S.heat }), { duration: 0 });
    ov.draw({ rows: S.R, cols: S.C, codes: b.codes, mud: m, ord: run.ord, total: run.total }, { heat: S.heat });
    ov.route(null);
    caption.textContent = 'Painting…';
  });
  view.on('paintend', function () { painting = false; S.preset = null; reload({ keepEnd: wasEnd }); });
  view.on('move-marker', function (e) {
    if (!e.done) { pause(); return; }
    var k = key(e.cell[0], e.cell[1]), was = idx === last && last > 0;
    if (S.walls[k]) { reload({ keepEnd: was }); return; }
    delete S.mud[k];
    if (e.marker === 'start') { if (k !== key(S.goal[0], S.goal[1])) S.start = e.cell.slice(); }
    else if (e.marker === 'end') { if (k !== key(S.start[0], S.start[1])) S.goal = e.cell.slice(); }
    reload({ keepEnd: was });
  });

  /* ================================================================== controls */
  function note() {
    var a = P.ALGOS.filter(function (x) { return x.id === S.algo; })[0], t = NOTES[S.algo];
    if (S.algo === 'astar' && S.hw > 1) t = 'Weight ' + S.hw + ': the guess counts ' + S.hw + ' times over. Fewer cells are expanded, but the route may no longer be the cheapest.';
    $('[data-note]').textContent = t;
    $('[data-astar-ctl]').hidden = !(S.algo === 'astar' || S.algo === 'greedy');
    $('[data-weight-ctl]').hidden = S.algo !== 'astar';
  }
  var algoCtl = V.segmented($('[data-algo]'), {
    label: 'Search algorithm', value: S.algo,
    options: P.ALGOS.map(function (a, i) { return { value: a.id, label: a.name.replace(' best-first', ''), title: a.name + ' (' + (i + 1) + ')' }; }),
    onChange: function (v) { S.algo = v; note(); reload(); }
  });
  var heurSel = $('[data-heur]');
  heurSel.value = S.heur;
  heurSel.addEventListener('change', function () { S.heur = heurSel.value; reload(); });
  var weightCtl = V.slider($('[data-weight]'), { label: 'A* weight', min: 1, max: 5, step: 0.5, value: S.hw, format: function (v) { return v === 1 ? '1 (cheapest)' : String(v); }, onInput: function (v) { S.hw = v; note(); }, onChange: function () { reload(); } });
  weightCtl.set(S.hw);
  var mudCtl = V.slider($('[data-mudcost]'), { label: 'Mud costs', min: 2, max: 10, step: 1, value: S.mudCost, format: function (v) { return v + '×'; }, onInput: function (v) { S.mudCost = v; }, onChange: function () { legend(); reload(); } });
  mudCtl.set(S.mudCost);
  V.segmented($('[data-brush]'), {
    label: 'Paint with', value: S.brush,
    options: [{ value: 'wall', label: 'Wall' }, { value: 'mud', label: 'Mud' }, { value: 'erase', label: 'Erase' }],
    onChange: function (v) { S.brush = v; view.setOptions({ paintValue: v !== 'erase' }); }
  });
  var sizeCtl = V.segmented($('[data-size]'), {
    label: 'Grid size', value: S.size,
    options: ['s', 'm', 'l'].map(function (k) { return { value: k, label: SIZES[k].label, title: SIZES[k].R + ' × ' + SIZES[k].C + ' cells' }; }),
    onChange: setSize
  });
  var presetBox = $('[data-presets]');
  P.PRESETS.forEach(function (p) { presetBox.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { applyPreset(p.id); } }, p.label)); });
  V.$$('[data-gen]').forEach(function (b) { b.addEventListener('click', function () { generate(b.getAttribute('data-gen')); }); });
  V.slider($('[data-density]'), { label: 'Random density', min: 5, max: 50, step: 5, value: Math.round(S.density * 100), format: function (v) { return v + '%'; }, onInput: function (v) { S.density = v / 100; }, onChange: function () { generate('random'); } });
  V.slider($('[data-loops]'), { label: 'Maze loops', min: 0, max: 30, step: 2, value: Math.round(S.loops * 100), format: function (v) { return v === 0 ? 'none (one route)' : v + '%'; }, onInput: function (v) { S.loops = v / 100; }, onChange: function () { generate('backtracker'); } });
  function clearPath() { pause(); show(0); }
  function clearWalls() {
    clearAll(); S.preset = null; S.start = [Math.floor(S.R / 2), 2]; S.goal = [Math.floor(S.R / 2), S.C - 3];
    reload({ keepEnd: false });
  }
  $('[data-clear="path"]').addEventListener('click', clearPath);
  $('[data-clear="walls"]').addEventListener('click', clearWalls);

  var speedCtl = V.slider($('[data-speed]'), { label: 'Speed', min: 1, max: 10, step: 1, value: S.speed, format: function (v) { return SPS[v - 1] + '/s'; }, onInput: function (v) { S.speed = v; } });
  V.toggle($('[data-turbo]'), { label: 'Turbo', checked: S.turbo, onChange: function (on) { S.turbo = on; } });
  V.toggle($('[data-heat]'), { label: 'Heatmap', checked: S.heat, onChange: function (on) { S.heat = on; legend(); show(idx); } });
  scrub.addEventListener('input', function () { pause(); show(+scrub.value); });
  fig.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'play') play();
    else if (a === 'restart') { pause(); show(0); }
    else if (a === 'back') { pause(); show(idx - 1); }
    else if (a === 'fwd') { pause(); show(idx + 1); }
    else if (a === 'end') { pause(); show(last, { animateRoute: true }); }
  });

  /* share */
  $('[data-share]').addEventListener('click', function () {
    writeUrl(true);
    var msg = $('[data-share-msg]'), url = location.href;
    function done(ok) { msg.textContent = ok ? (S.R * S.C > URL_MAX_CELLS ? 'Copied. Maps this large are not stored in the link, only the settings.' : 'Link copied.') : 'Copy the address bar to share this map.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  /* ================================================================== compare + race */
  var cmpOpen = false, raceOpen = false;
  var cmpBody = $('[data-cmp-body]'), cmpBtn = $('[data-compare]'), raceBtn = $('[data-race]'), tbody = $('[data-table] tbody');
  var race = P.race($('[data-lanes]'), {
    getMap: function () { return { R: S.R, C: S.C, grid: run.grid, start: S.start, goal: S.goal, mudCost: S.mudCost, heuristic: S.heur, hWeight: S.hw }; },
    onState: function (on) { $('[data-race-go]').textContent = on ? 'Pause' : 'Start race'; }
  });
  function updateCompare() {
    var cmp = P.compareAll(run.grid, S.start, S.goal, opts());
    var maxE = 1, maxC = 1;
    cmp.rows.forEach(function (r) { maxE = Math.max(maxE, r.expanded || 0); if (r.found) maxC = Math.max(maxC, r.cost); });
    V.clear(tbody);
    cmp.rows.forEach(function (r) {
      var verdict = !r.found ? h('span', { class: 'pf-tag is-none' }, 'no path') : r.optimal ? h('span', { class: 'pf-tag is-good' }, 'cheapest') : h('span', { class: 'pf-tag is-bad' }, '+' + (r.cost - cmp.best) + ' dearer');
      var tr = h('tr', { class: r.algo === S.algo ? 'is-current' : null, 'data-algo': r.algo },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'pf-linkbtn', title: 'Show ' + r.name + ' on the grid', onclick: function () { S.algo = r.algo; algoCtl.set(r.algo); note(); reload({ keepEnd: true }); pause(); show(last, { animateRoute: true }); document.getElementById('stage-fig').scrollIntoView({ block: 'nearest', behavior: V.reducedMotion() ? 'auto' : 'smooth' }); } }, r.name)),
        h('td', null, h('span', { class: 'pf-bar-cell', style: { '--w': (100 * (r.expanded || 0) / maxE).toFixed(1) + '%', '--c': 'var(--st-visited)' } }, h('i'), h('b', null, String(r.expanded)))),
        h('td', { class: 'num' }, r.found ? String(r.pathLen) : '–'),
        h('td', null, r.found ? h('span', { class: 'pf-bar-cell', style: { '--w': (100 * r.cost / maxC).toFixed(1) + '%', '--c': 'var(--st-path)' } }, h('i'), h('b', null, String(r.cost))) : '–'),
        h('td', null, verdict));
      tbody.appendChild(tr);
    });
    var by = {}; cmp.rows.forEach(function (r) { by[r.algo] = r; });
    var txt = '';
    if (cmp.best === null) txt = 'No search can reach T: walls cut it off.';
    else {
      var bad = cmp.rows.filter(function (r) { return r.found && !r.optimal; }).map(function (r) { return r.name; });
      txt = bad.length ? bad.join(', ') + (bad.length === 1 ? ' does' : ' do') + ' not find the cheapest route on this map. ' : 'Every search found a cheapest route on this map. Add mud or walls and compare again. ';
      txt += 'A* expanded ' + by.astar.expanded + ' cells against Dijkstra’s ' + by.dijkstra.expanded + '.';
    }
    $('[data-cmp-note]').textContent = txt;
  }
  function toggleCompare(force) {
    cmpOpen = force === undefined ? !cmpOpen : force;
    cmpBody.hidden = !cmpOpen; raceBtn.hidden = !cmpOpen;
    var cmpHint = $('[data-cmp-hint]'); if (cmpHint) cmpHint.hidden = cmpOpen;
    cmpBtn.setAttribute('aria-expanded', String(cmpOpen));
    cmpBtn.textContent = cmpOpen ? 'Hide comparison' : 'Compare on this map';
    if (cmpOpen) updateCompare();
    if (!cmpOpen && raceOpen) toggleRace(false);
  }
  function toggleRace(force) {
    raceOpen = force === undefined ? !raceOpen : force;
    $('[data-race-box]').hidden = !raceOpen;
    raceBtn.textContent = raceOpen ? 'Hide race' : 'Race them';
    if (raceOpen) race.prepare(); else race.pause();
  }
  cmpBtn.addEventListener('click', function () { toggleCompare(); });
  raceBtn.addEventListener('click', function () { toggleRace(); });
  $('[data-race-go]').addEventListener('click', function () { if ($('[data-race-go]').textContent === 'Pause') race.pause(); else race.start(); });
  $('[data-race-reset]').addEventListener('click', function () { if (race.prepared) race.reset(); else race.prepare(); });

  /* ================================================================== lessons + keys */
  (function lessons() {
    var host = $('[data-lessons]'), C = window.VDSA_CURRICULUM;
    [['26-bfs-and-dfs', 'BFS & DFS'], ['28-dijkstra-and-a-star', 'Dijkstra & A*']].forEach(function (p) {
      var l = C && C.byId ? C.byId(p[0]) : null;
      if (l && l.status !== 'live') return;
      host.appendChild(h('a', { class: 'btn btn--secondary btn--sm', href: '../lessons/' + p[0] + '.html' }, 'Lesson: ' + p[1] + ' →'));
    });
  }());
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' && t.type !== 'range' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    if (t && t.closest && t.closest('[role="dialog"]')) return;
    var inGrid = t && t.closest && t.closest('.vz-grid-host'), inSeg = t && t.closest && t.closest('.seg'), onRange = tag === 'INPUT';
    var k = e.key;
    if (k === ' ' && !inGrid && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); play(); }
    else if (k === 'ArrowRight' && !inGrid && !inSeg && !onRange) { e.preventDefault(); pause(); show(idx + 1); }
    else if (k === 'ArrowLeft' && !inGrid && !inSeg && !onRange) { e.preventDefault(); pause(); show(idx - 1); }
    else if (k === 'End') { e.preventDefault(); pause(); show(last, { animateRoute: true }); }
    else if (k === 'Home') { e.preventDefault(); pause(); show(0); }
    else if (k === 'r' || k === 'R') { pause(); show(0); }
    else if (k === 'w' || k === 'W') clearWalls();
    else if (k === 'c' || k === 'C') toggleCompare();
    else if (k === 't' || k === 'T') { S.turbo = !S.turbo; var box = $('[data-turbo] input'); if (box) box.checked = S.turbo; }
    else if (/^[1-5]$/.test(k) && !inGrid) { var a = P.ALGOS[+k - 1]; S.algo = a.id; algoCtl.set(a.id); note(); reload(); }
  });

  /* ================================================================== start */
  var fromUrl = readUrl();
  algoCtl.set(S.algo); sizeCtl.set(S.size); heurSel.value = S.heur; weightCtl.set(S.hw); mudCtl.set(S.mudCost); speedCtl.set(S.speed);
  view.setOptions({ cellSize: SIZES[S.size].cell });
  if (!fromUrl) setMap(P.presetMap(S.preset, S.R, S.C, 5));
  legend(); note();
  build(); show(0);
  if (new URLSearchParams(location.search).get('run') === '1') show(last);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { ov.redraw(); });
  }
}());
