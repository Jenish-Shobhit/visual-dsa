/* Lesson 37 · P, NP & hard problems — part 2: the map view, the hero teaser, the TSP lab and the tour comparison.
   Needs js/lessons/37-p-vs-np.js (VDSA.L37) and js/algos/37-p-vs-np.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L = V.L37, A = L.A;

  /* ================================================================== the map view */
  /* L.tspView(stage) -> {render(step, {duration}), setCities(pts), onClick(fn), el}
     Draws cities and up to six edge layers keyed by city pair, so an edge that stays between steps stays, one that
     disappears fades, and a new one grows out of its first city. Step fields: pts?, path, closed, ghost, tree,
     remove, add, scan {from, to:[{id,d}], pick}, cur, flash, hud [{k, v}], kind. */
  L.tspView = function (stage, opts) {
    opts = opts || {};
    /* hero on a wide stage: the counters sit in a column to the left of the map instead of above it, so the map fills the card */
    var wideHero = !!opts.hero && stage.clientWidth > 0 && stage.clientHeight > 0 && stage.clientWidth / stage.clientHeight > 1.8;
    var svg = s('svg', { class: 'tsp' + (opts.hero ? ' tsp--hero' : '') + (wideHero ? ' tsp--wide' : ''), viewBox: wideHero ? '-690 -20 1710 640' : '0 -140 1000 740', role: 'img', 'aria-label': opts.label || 'Map of cities and the tour drawn so far' });
    var names = ['ghost', 'tree', 'path', 'remove', 'add', 'scan'];
    var layerEls = {}, layers = {};
    names.forEach(function (n) { layerEls[n] = s('g', { class: 'tsp-layer tsp-layer--' + n }); layers[n] = {}; svg.appendChild(layerEls[n]); });
    var gCity = s('g', { class: 'tsp-cities' }), gHud = s('g', { class: 'tsp-hud' });
    svg.appendChild(gCity); svg.appendChild(gHud);
    V.clear(stage); stage.appendChild(svg);
    var pts = [], cityEls = [], clickFn = null, lastRoles = '', hudX = 0, hudY = 0;

    function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
    function pairsOf(list, closed) {
      var out = [], n = list.length;
      for (var i = 0; i + 1 < n; i++) out.push([list[i], list[i + 1]]);
      if (closed && n > 2) out.push([list[n - 1], list[0]]);
      if (closed && n === 2) { /* the single edge is already there */ }
      return out;
    }
    function makeEntry(layer, w, mode, dur) {
      var a = pts[w.a], b = pts[w.b];
      if (!a || !b) return null;
      var line = s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'tsp-e' });
      var g = s('g', { class: 'tsp-eg' }, line);
      var entry = { el: g, line: line, label: null, a: w.a, b: w.b };
      layerEls[layer].appendChild(g);
      if (dur > 0 && mode === 'grow') {
        line.setAttribute('x2', a.x); line.setAttribute('y2', a.y);
        V.animate(line, { attr: { x2: b.x, y2: b.y } }, { duration: dur, ease: 'out' });
      } else if (dur > 0 && mode === 'fade') {
        g.style.opacity = '0';
        V.animate(g, { opacity: 1 }, { duration: dur * 0.6, ease: 'out' });
      }
      return entry;
    }
    function die(entry, dur) {
      if (dur > 0) V.animate(entry.el, { opacity: 0 }, { duration: dur * 0.6, ease: 'out' }).then(function () { entry.el.remove(); });
      else entry.el.remove();
    }
    function sync(layer, wanted, mode, dur) {
      var cur = layers[layer], seen = {};
      wanted.forEach(function (w) {
        var k = key(w.a, w.b); seen[k] = true;
        var e = cur[k];
        if (!e) { e = makeEntry(layer, w, mode, dur); if (!e) return; cur[k] = e; }
        e.el.setAttribute('class', 'tsp-eg' + (w.cls ? ' ' + w.cls : ''));
        if (w.label !== undefined) {
          if (!e.label) { e.label = s('text', { class: 'tsp-elabel', 'text-anchor': 'middle' }); e.el.appendChild(e.label); }
          e.label.setAttribute('x', (pts[w.a].x + pts[w.b].x) / 2); e.label.setAttribute('y', (pts[w.a].y + pts[w.b].y) / 2 - 8);
          e.label.textContent = w.label;
        }
      });
      Object.keys(cur).forEach(function (k) { if (!seen[k]) { die(cur[k], dur); delete cur[k]; } });
    }
    function clearLayers() {
      names.forEach(function (n) { Object.keys(layers[n]).forEach(function (k) { layers[n][k].el.remove(); }); layers[n] = {}; });
    }

    function setCities(list) {
      pts = list; lastRoles = '';
      if (wideHero && pts.length) {   // crop the view to the cities: counters column on the left, map on the right, both centred
        var bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9, HW = 500, ta = stage.clientWidth / stage.clientHeight;
        pts.forEach(function (p) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y); });
        bx0 -= 50; bx1 += 50; by0 -= 50; by1 += 50;
        var VW = Math.max(HW + 40 + (bx1 - bx0), (by1 - by0) * ta), VH = VW / ta, cy = (by0 + by1) / 2;
        var vx = bx1 - VW + 10;            // right edge of the map sits at the right edge of the view
        hudX = vx + 24; hudY = cy; svg.setAttribute('viewBox', [vx, cy - VH / 2, VW, VH].map(function (n) { return Math.round(n); }).join(' '));
      }
      else if (opts.hero && pts.length) {   // narrow hero: counters above the map, the view cropped to the cities and centred
        var nx0 = 1e9, nx1 = -1e9, ny0 = 1e9, ny1 = -1e9, nta = stage.clientWidth / stage.clientHeight;
        pts.forEach(function (p) { nx0 = Math.min(nx0, p.x); nx1 = Math.max(nx1, p.x); ny0 = Math.min(ny0, p.y); ny1 = Math.max(ny1, p.y); });
        nx0 -= 50; nx1 += 50; ny0 -= 40; ny1 += 40;
        var CH = 150 + (ny1 - ny0), NW = Math.max(nx1 - nx0, 780, CH * nta), NH = NW / nta;
        var nvx = (nx0 + nx1) / 2 - NW / 2, nvy = ny0 - 150 - (NH - CH) / 2;
        hudX = nvx + 20; hudY = ny0 - 108;
        svg.setAttribute('viewBox', [nvx, nvy, NW, NH].map(function (n) { return Math.round(n); }).join(' '));
      }
      clearLayers();
      V.clear(gCity); cityEls = [];
      pts.forEach(function (p, i) {
        var g = s('g', { class: 'tsp-city', transform: 'translate(' + p.x + ' ' + p.y + ')', 'data-city': i, tabindex: '0', role: 'button', 'aria-label': 'City ' + A.letter(i) + (opts.hero ? '' : '. Press Enter to remove it.') });
        var k = wideHero ? 1.1 : opts.hero ? 1.5 : 1;
        g.appendChild(s('circle', { r: 19 * k, class: 'tsp-start' }));
        g.appendChild(s('circle', { r: 15 * k, class: 'tsp-dot' }));
        g.appendChild(s('text', { class: 'tsp-name', 'text-anchor': 'middle', y: 1 }, A.letter(i)));
        gCity.appendChild(g); cityEls.push(g);
      });
    }
    function roles(step) {
      var r = new Array(pts.length).fill('');
      (step.path || []).forEach(function (c) { r[c] = 'vis'; });
      if (step.scan) step.scan.to.forEach(function (c) { r[c.id] = 'cand'; });
      if (step.scan && step.scan.pick !== undefined) r[step.scan.pick] = 'pick';
      (step.skipped || []).forEach(function (c) { r[c] = 'skip'; });
      if (step.cur !== undefined && step.cur !== null) r[step.cur] = 'cur';
      return r;
    }
    function render(step, ctx) {
      var dur = (ctx && ctx.duration) || 0;
      if (step.pts && step.pts !== pts) setCities(step.pts);
      svg.setAttribute('data-kind', step.kind || '');
      svg.style.setProperty('--t', dur + 'ms');
      var grow = { go: 1, edge: 1, visit: 1, shortcut: 1, close: 1, swap: 1, done: 0, init: 1 };
      var mode = step.kind === 'try' || step.kind === 'best' ? 'fade' : (grow[step.kind] ? 'grow' : 'fade');
      var ghost = step.ghost && step.kind !== 'done' ? pairsOf(step.ghost, true).map(function (p) { return { a: p[0], b: p[1] }; }) : [];
      sync('ghost', ghost, 'fade', dur);
      sync('tree', (step.tree || []).map(function (p) { return { a: p[0], b: p[1] }; }), 'grow', dur);
      var flash = {}; (step.flash || []).forEach(function (p) { flash[key(p[0], p[1])] = true; });
      sync('path', pairsOf(step.path || [], step.closed).map(function (p) { return { a: p[0], b: p[1], cls: flash[key(p[0], p[1])] ? 'is-flash' : '' }; }), mode, dur);
      sync('remove', (step.remove || []).map(function (p) { return { a: p[0], b: p[1] }; }), 'fade', dur);
      sync('add', (step.add || []).map(function (p) { return { a: p[0], b: p[1] }; }), 'grow', dur);
      sync('scan', step.scan ? step.scan.to.map(function (c) { return { a: step.scan.from, b: c.id, label: A.fmtLen(c.d), cls: c.id === step.scan.pick ? 'is-pick' : '' }; }) : [], 'grow', dur);
      var r = roles(step);
      cityEls.forEach(function (g, i) {
        g.setAttribute('class', 'tsp-city' + (r[i] ? ' is-' + r[i] : '') + (i === 0 ? ' is-home' : ''));
      });
      V.clear(gHud);
      (step.hud || []).forEach(function (row, i) {
        var t = s('text', wideHero ? { x: hudX, y: hudY + (i - ((step.hud || []).length - 1) / 2) * 60, class: 'tsp-hud-row' } : (opts.hero && hudY) ? { x: hudX, y: hudY + i * 50, class: 'tsp-hud-row' } : { x: 20, y: (opts.hero ? -108 : -100) + i * (opts.hero ? 46 : 36), class: 'tsp-hud-row' },
          s('tspan', { class: 'tsp-hud-k' }, row.k + '  '), s('tspan', { class: 'tsp-hud-v' }, String(row.v)));
        gHud.appendChild(t);
      });
    }
    function toLogical(ev) {
      var rect = svg.getBoundingClientRect();
      return { x: Math.round((ev.clientX - rect.left) / rect.width * 1000), y: Math.round((ev.clientY - rect.top) / rect.height * 740 - 140) };
    }
    svg.addEventListener('click', function (ev) {
      if (!clickFn) return;
      var c = ev.target.closest && ev.target.closest('.tsp-city');
      if (c) clickFn({ city: +c.getAttribute('data-city') });
      else clickFn(toLogical(ev));
    });
    svg.addEventListener('keydown', function (ev) {
      if (!clickFn || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      var c = ev.target.closest && ev.target.closest('.tsp-city');
      if (c) { ev.preventDefault(); ev.stopPropagation(); clickFn({ city: +c.getAttribute('data-city') }); }
    });
    return {
      el: svg, render: render, setCities: setCities, get cities() { return pts; },
      onClick: function (fn) { clickFn = fn; svg.classList.toggle('is-editable', !!fn); }
    };
  };

  /* ================================================================== code for the four methods */
  var CODE = {
    brute: {
      pseudo: [
        'function bruteForce(cities)',
        '  best ← ∞                                    // @init',
        '  for each ordering p of cities 1 … n−1       // @perm',
        '    tour ← city 0, then p                     // @tour',
        '    len ← length of tour, back to the start   // @len',
        '    if len < best then                        // @cmp',
        '      best ← len; bestTour ← tour             // @better',
        '  return bestTour                             // @ret'
      ].join('\n'),
      js: [
        'function bruteForce(pts) {',
        '  let best = Infinity, bestTour = null;                 // @init',
        '  for (const p of permutations(range(1, pts.length))) { // @perm',
        '    const tour = [0, ...p];                             // @tour',
        '    const len = tourLength(pts, tour);                  // @len',
        '    if (len < best) {                                   // @cmp',
        '      best = len; bestTour = tour;                      // @better',
        '    }',
        '  }',
        '  return bestTour;                                      // @ret',
        '}'
      ].join('\n'),
      py: [
        'def brute_force(pts):',
        '    best, best_tour = float("inf"), None                # @init',
        '    for p in permutations(range(1, len(pts))):          # @perm',
        '        tour = [0, *p]                                  # @tour',
        '        length = tour_length(pts, tour)                 # @len',
        '        if length < best:                               # @cmp',
        '            best, best_tour = length, tour              # @better',
        '    return best_tour                                    # @ret'
      ].join('\n')
    },
    nn: {
      pseudo: [
        'function nearestNeighbour(cities, start)',
        '  tour ← [start]; visited ← {start}           // @init',
        '  while tour has fewer than n cities',
        '    next ← closest unvisited city to the last // @scan',
        '    append next to tour; mark it visited      // @go',
        '  close the loop back to start                // @close',
        '  return tour                                 // @ret'
      ].join('\n'),
      js: [
        'function nearestNeighbour(pts, start = 0) {',
        '  const tour = [start], seen = new Set(tour);            // @init',
        '  while (tour.length < pts.length) {',
        '    const last = tour[tour.length - 1];',
        '    const next = closestUnvisited(pts, last, seen);      // @scan',
        '    tour.push(next); seen.add(next);                     // @go',
        '  }',
        '  return tour;   // the edge back to start closes it     // @close',
        '}                                                       // @ret'
      ].join('\n'),
      py: [
        'def nearest_neighbour(pts, start=0):',
        '    tour, seen = [start], {start}                       # @init',
        '    while len(tour) < len(pts):',
        '        nxt = closest_unvisited(pts, tour[-1], seen)    # @scan',
        '        tour.append(nxt); seen.add(nxt)                 # @go',
        '    # the edge back to start closes the tour            # @close',
        '    return tour                                         # @ret'
      ].join('\n')
    },
    twoopt: {
      pseudo: [
        'function twoOpt(tour)',
        '  improved ← true                              // @init',
        '  while improved',
        '    improved ← false',
        '    for each pair of positions i < j',
        '      a,b ← tour[i−1], tour[i];  c,d ← tour[j], tour[j+1]',
        '      if d(a,c) + d(b,d) < d(a,b) + d(c,d)     // @gain',
        '        reverse tour[i … j]                    // @swap',
        '        improved ← true',
        '  return tour                                  // @done'
      ].join('\n'),
      js: [
        'function twoOpt(pts, tour) {',
        '  let improved = true;                                    // @init',
        '  while (improved) {',
        '    improved = false;',
        '    for (let i = 1; i < tour.length - 1; i++) {',
        '      for (let j = i + 1; j < tour.length; j++) {',
        '        const a = tour[i - 1], b = tour[i];',
        '        const c = tour[j], d = tour[(j + 1) % tour.length];',
        '        if (dist(a, c) + dist(b, d) < dist(a, b) + dist(c, d)) { // @gain',
        '          reverseSegment(tour, i, j);                     // @swap',
        '          improved = true;',
        '        }',
        '      }',
        '    }',
        '  }',
        '  return tour;                                            // @done',
        '}'
      ].join('\n'),
      py: [
        'def two_opt(pts, tour):',
        '    improved = True                                      # @init',
        '    while improved:',
        '        improved = False',
        '        for i in range(1, len(tour) - 1):',
        '            for j in range(i + 1, len(tour)):',
        '                a, b = tour[i - 1], tour[i]',
        '                c, d = tour[j], tour[(j + 1) % len(tour)]',
        '                if dist(a, c) + dist(b, d) < dist(a, b) + dist(c, d):  # @gain',
        '                    tour[i:j + 1] = reversed(tour[i:j + 1])  # @swap',
        '                    improved = True',
        '    return tour                                          # @done'
      ].join('\n')
    },
    mst: {
      pseudo: [
        'function mstTwoApprox(cities)',
        '  T ← minimum spanning tree (Prim from city 0)      // @prim',
        '  order ← cities in depth-first order of T           // @walk',
        '  skip cities already visited, jump straight ahead   // @shortcut',
        '  close the loop back to city 0                      // @close',
        '  return order                                       // @ret'
      ].join('\n'),
      js: [
        'function mstTwoApprox(pts) {',
        '  const tree = primMST(pts);                       // @prim',
        '  const order = [];',
        '  (function dfs(u) {                               // @walk',
        '    order.push(u);        // first visit only: later visits are skipped  // @shortcut',
        '    for (const v of tree.children(u)) dfs(v);',
        '  })(0);',
        '  return order;           // the edge back to 0 closes it                // @close',
        '}                                                 // @ret'
      ].join('\n'),
      py: [
        'def mst_two_approx(pts):',
        '    tree = prim_mst(pts)                            # @prim',
        '    order = []',
        '    def dfs(u):                                     # @walk',
        '        order.append(u)   # first visit only: later ones are skipped   # @shortcut',
        '        for v in tree.children(u):',
        '            dfs(v)',
        '    dfs(0)',
        '    return order          # the edge back to 0 closes it               # @close  @ret'
      ].join('\n')
    }
  };
  L.TSP_CODE = CODE;
  var LEGENDS = {
    brute: [{ state: 'compare', shape: 'line', label: 'Tour being measured' }, { state: 'done', shape: 'line', label: 'Best tour so far' }, { state: 'key', shape: 'ring', label: 'Start city' }],
    nn: [{ state: 'active', shape: 'line', label: 'Tour so far' }, { state: 'compare', shape: 'dash', label: 'Distances measured' }, { state: 'found', shape: 'line', label: 'Nearest: chosen' }, { state: 'key', shape: 'ring', label: 'Start city' }],
    twoopt: [{ state: 'active', shape: 'line', label: 'Current tour' }, { state: 'swap', shape: 'dash', label: 'Edges cut' }, { state: 'done', shape: 'dash', label: 'Edges added' }, { state: 'key', shape: 'ring', label: 'Start city' }],
    mst: [{ state: 'frontier', shape: 'line', label: 'Spanning tree' }, { state: 'active', shape: 'line', label: 'Tour' }, { state: 'key', shape: 'ring', label: 'Start city' }]
  };
  var ALGS = [
    { value: 'brute', label: 'Brute force' }, { value: 'nn', label: 'Nearest neighbour' },
    { value: 'twoopt', label: '2-opt' }, { value: 'mst', label: 'MST 2-approximation' }
  ];

  /* ================================================================== hero teaser */
  function hero() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var view = L.tspView(stage, { hero: true, label: 'A tour flashing through different orders of seven cities' });
    var lap = 0;
    function make() {
      lap++;
      var pts = A.randomCities(7, 40 + lap * 7), r = A.bruteForce(pts), st = r.steps, pick = [st[0]];
      var want = 20, body = st.slice(1, st.length - 1);
      for (var k = 0; k < want && body.length; k++) pick.push(body[Math.floor(k * body.length / want)]);
      pick.push(st[st.length - 1]);
      var out = pick.map(function (x) { return Object.assign({}, x, { pts: pts }); });
      var last = st[st.length - 1];
      out.push(Object.assign({}, last, { pts: pts, kind: 'final', hud: [{ k: '7 cities:', v: A.fmtInt(r.total) + ' tours' }, { k: '20 cities:', v: A.fmtBig(A.factorial(19)) + ' tours' }] }));
      return out;
    }
    var steps = make();
    V.teaser(stage, {
      steps: steps, stepMs: 300, holdMs: 2800, loop: true, regenerate: make, instantWrap: true,
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); }
    });
  }

  /* ================================================================== the lab */
  var MAXC = A.MAX_CITIES;
  function lab(fig) {
    var stage = L.q(fig, '[data-stage]'), noteEl = L.q(fig, '[data-note]');
    var view = L.tspView(stage, { label: 'Cities on a map. Click to add a city.' });
    var pts = A.randomCities(7, 25), alg = 'brute', seed = 100;
    view.setCities(pts);
    var code = V.codePanel(L.q(fig, '[data-code]'), { languages: CODE.brute, default: 'pseudo', maxHeight: 330 });
    var vars = V.varsPanel(L.q(fig, '[data-vars]'), { title: 'Variables' });
    var legendEl = L.q(fig, '[data-legend]');
    function note(msg) { noteEl.textContent = msg || ''; }

    function rawVars(steps) {
      return steps.map(function (st) {
        if (!st.vars) return st;
        var v = {};
        Object.keys(st.vars).forEach(function (k) { v[k] = typeof st.vars[k] === 'string' ? V.vars.raw(st.vars[k]) : st.vars[k]; });
        return Object.assign({}, st, { vars: v });
      });
    }
    function generate() { return rawVars(generate0()); }
    function generate0() {
      if (alg === 'brute') {
        if (pts.length > A.MAX_BRUTE) {
          var n = pts.length;
          note('Brute force is capped at ' + A.MAX_BRUTE + ' cities: ' + n + ' cities mean ' + (n - 1) + '! = ' + A.fmtInt(A.factorial(n - 1)) + ' tours. Remove some cities, or try another method.');
          return [{ kind: 'cap', path: [], closed: false, caption: 'That is <b>' + A.fmtInt(A.factorial(n - 1)) + '</b> tours for ' + n + ' cities, too many to animate (and, at a million tours per second, about ' + A.fmtDuration(A.factorial(n - 1) / 1e6) + '). The cap is ' + A.MAX_BRUTE + ' cities: 8! = 40,320 tours.', line: null, vars: { cities: n, tours: A.fmtInt(A.factorial(n - 1)) }, counters: { tours: 0, improvements: 0 } }];
        }
        note('');
        return A.bruteForce(pts).steps;
      }
      note('');
      if (alg === 'nn') return A.nearestNeighbour(pts).steps;
      if (alg === 'twoopt') return A.twoOpt(pts).steps;
      return A.mstApprox(pts).steps;
    }
    var player = V.player({
      root: fig, steps: generate(), render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, caption: L.q(fig, '[data-caption]'), counters: L.q(fig, '[data-counters]'),
      counterLabels: { tours: 'Tours checked', improvements: 'New bests', moves: 'Moves', lookups: 'Distance lookups', tests: 'Swaps tested', swaps: 'Swaps made', treeEdges: 'Tree edges', tourEdges: 'Tour edges' },
      counterStates: { improvements: 'done', swaps: 'done', tests: 'compare', lookups: 'compare' },
      baseStepMs: 800, speed: 2, label: 'Travelling salesperson lab controls'
    });
    player.setSpeed(2);

    /* ---- predict before reveal ---- */
    player.addCheckpoint(function (steps) {
      var seen = 0;
      for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'scan' && ++seen === 2) return k;
      for (k = 1; k < steps.length; k++) if (steps[k].kind === 'scan') return k;
      return -1;
    }, function (c) {
      var sc = c.step.scan;
      if (!sc || sc.to.length < 2) return null;
      var sorted = sc.to.slice().sort(function (a, b) { return a.d - b.d; }).slice(0, 4);
      var opts = sorted.slice().sort(function (a, b) { return a.id - b.id; });
      var best = sorted[0];
      return {
        question: 'Nearest neighbour is standing at <b>' + A.letter(sc.from) + '</b>. Which unvisited city will it walk to next?',
        options: opts.map(function (o) { return 'City ' + A.letter(o.id); }),
        answer: opts.findIndex(function (o) { return o.id === best.id; }),
        explain: opts.map(function (o) {
          return o.id === best.id
            ? 'Right. ' + A.letter(o.id) + ' is the closest unvisited city (' + A.fmtLen(o.d) + '). Greedy always takes the minimum distance, without looking ahead.'
            : A.letter(o.id) + ' is ' + A.fmtLen(o.d) + ' away, but ' + A.letter(best.id) + ' is only ' + A.fmtLen(best.d) + '. The rule takes the smallest distance.';
        })
      };
    }, { id: 'l37-nn-next' });

    player.addCheckpoint(function (steps) {
      /* A test that follows a step with no overlay on the map (init or swap), so the picture shows only the tour. */
      var firstAny = -1;
      for (var k = 1; k < steps.length; k++) {
        var st = steps[k];
        if ((st.kind === 'test' || st.kind === 'test-gain') && (steps[k - 1].kind === 'init' || steps[k - 1].kind === 'swap')) {
          if (st.kind === 'test-gain') return k;
          if (firstAny < 0) firstAny = k;
        }
      }
      return firstAny;
    }, function (c) {
      var st = c.step, r = st.remove, ad = st.add;
      if (!r || !ad) return null;
      var oldE = A.dist(pts[r[0][0]], pts[r[0][1]]) + A.dist(pts[r[1][0]], pts[r[1][1]]);
      var newE = A.dist(pts[ad[0][0]], pts[ad[0][1]]) + A.dist(pts[ad[1][0]], pts[ad[1][1]]);
      var e = function (p) { return A.letter(p[0]) + '–' + A.letter(p[1]); };
      var shorter = newE < oldE - 1e-9;
      return {
        question: '2-opt is about to cut <b>' + e(r[0]) + '</b> and <b>' + e(r[1]) + '</b> and reconnect them as <b>' + e(ad[0]) + '</b> and <b>' + e(ad[1]) + '</b>. Will the tour get shorter?',
        options: ['No, the tour would get longer', 'Yes, the tour would get shorter'],
        answer: shorter ? 1 : 0,
        explain: shorter
          ? ['Compare the two pairs: the old edges total ' + A.fmtLen(oldE) + ', the new ones ' + A.fmtLen(newE) + '. The new pair is the shorter one.',
            'Right. The old edges total ' + A.fmtLen(oldE) + ', the new ones ' + A.fmtLen(newE) + ': ' + A.fmtLen(oldE - newE) + ' saved. Crossing edges are the classic case, since uncrossing them always helps.']
          : ['Right. The old edges total ' + A.fmtLen(oldE) + ' and the new ones ' + A.fmtLen(newE) + ', so the swap would cost ' + A.fmtLen(newE - oldE) + '. 2-opt only swaps when it saves distance.',
            'Add up both pairs: the old edges total ' + A.fmtLen(oldE) + ', the new ones ' + A.fmtLen(newE) + '. The new pair is longer, so 2-opt leaves the tour alone.']
      };
    }, { id: 'l37-2opt-gain' });

    player.addCheckpoint(function (steps) {
      for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'shortcut') return k;
      return -1;
    }, function (c) {
      var st = c.step, skipped = st.skipped || [], from = c.prev && c.prev.cur, to = st.cur;
      if (!skipped.length || from === undefined || from === null) return null;
      var Z = skipped.map(A.letter).join(', ');
      return {
        question: 'The depth-first walk must get from <b>' + A.letter(from) + '</b> to <b>' + A.letter(to) + '</b>, but along the tree it would pass back through <b>' + Z + '</b>, already visited. What does the tour do?',
        options: ['Retrace the tree edges through ' + Z, 'Visit ' + Z + ' a second time', 'Jump straight from ' + A.letter(from) + ' to ' + A.letter(to)],
        answer: 2,
        explain: [
          'Retracing would cost the full tree walk, which is where the factor 2 comes from. A tour need not follow tree edges.',
          'A tour must visit each city exactly once, so a repeat visit is not allowed.',
          'Right. Skipping already-visited cities is the "shortcut". By the triangle inequality the straight line is never longer than the detour, so the tour stays within 2 × tree.'
        ]
      };
    }, { id: 'l37-mst-shortcut' });

    /* ---- editing ---- */
    var chart = null;
    function rebuild(instantOnly) {
      view.setCities(pts);
      player.setSteps(generate());
      updateCompare();
      void instantOnly;
    }
    view.onClick(function (e) {
      if (e.city !== undefined) { pts = pts.filter(function (_, i) { return i !== e.city; }); rebuild(); return; }
      if (pts.length >= MAXC) { note('That is the limit: ' + MAXC + ' cities keeps the exact optimum (dynamic programming) quick in your browser.'); return; }
      pts = pts.concat([{ x: Math.max(30, Math.min(970, e.x)), y: Math.max(30, Math.min(570, e.y)) }]);
      rebuild();
    });
    function preset(fn) { return function () { pts = fn(); rebuild(); }; }
    var presetsEl = L.q(fig, '[data-presets]');
    [
      { label: 'Random 6', fn: function () { return A.randomCities(6, ++seed); } },
      { label: 'Random 9', fn: function () { return A.randomCities(9, ++seed); } },
      { label: 'Random 12', fn: function () { return A.randomCities(12, ++seed); } },
      { label: 'Three clusters', fn: function () { return A.clusterCities(11, ++seed); } },
      { label: 'Circle (8)', fn: function () { return A.circleCities(8); } },
      { label: 'Add a random city', fn: function () {
        if (pts.length >= MAXC) { note('That is the limit: ' + MAXC + ' cities.'); return pts; }
        var extra = A.randomCities(pts.length + 1, ++seed), pick = extra[extra.length - 1];
        return pts.concat([pick]);
      } },
      { label: 'Clear', fn: function () { return []; } }
    ].forEach(function (p) {
      presetsEl.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: preset(p.fn) }, p.label));
    });

    /* ---- algorithm tabs ---- */
    function select(name) {
      alg = name;
      code.setSource(CODE[name]);
      V.legend(legendEl, LEGENDS[name]);
      player.setSteps(generate());
      player.setSpeed(name === 'brute' ? 2 : 1);
    }
    V.segmented(L.q(fig, '[data-seg-alg]'), { label: 'Method', value: alg, options: ALGS, onChange: select });
    V.legend(legendEl, LEGENDS.brute);

    /* ---- comparison figure ---- */
    var cmpFig = V.$('#fig-tspcompare'), cmpChart = null, cmpTable = null;
    function updateCompare() {
      if (!cmpFig) return;
      if (!cmpChart) {
        cmpChart = V.views.chart(L.q(cmpFig, '[data-stage]'), {
          type: 'bar', height: 250, labels: false, label: 'Tour length found by each method', format: function (v) { return String(Math.round(v / 10)); },
          valueFormat: function (v) { return (v / 10).toFixed(1); }
        });
        cmpTable = L.q(cmpFig, '[data-table]');
        V.legend(L.q(cmpFig, '[data-legend]'), [
          { state: 'done', label: 'Optimal (exact)' }, { state: 'compare', label: 'Nearest neighbour' },
          { state: 'active', label: 'Nearest neighbour + 2-opt' }, { state: 'frontier', label: 'MST 2-approximation' }
        ]);
      }
      var c = pts.length >= 3 ? A.compareTours(pts) : null;
      V.clear(cmpTable);
      if (!c) {
        cmpTable.appendChild(h('p', { class: 'compare-empty' }, 'Place at least 3 cities to compare the methods.'));
        cmpChart.render({ categories: [''], series: [{ id: 'opt', label: 'Optimal', values: [0], state: 'done' }], y: { min: 0, max: 100 } }, { duration: 300 });
        return;
      }
      var rows = [
        { id: 'opt', label: 'Optimal (exact, dynamic programming)', v: c.optimal, state: 'done' },
        { id: 'nn', label: 'Nearest neighbour', v: c.nearest, state: 'compare' },
        { id: 'two', label: 'Nearest neighbour + 2-opt', v: c.twoOpt, state: 'active' },
        { id: 'mst', label: 'MST 2-approximation', v: c.mst, state: 'frontier' }
      ];
      cmpChart.render({
        categories: [''],
        series: rows.map(function (r) { return { id: r.id, label: r.label, values: [r.v], state: r.state }; }),
        y: { min: 0 }
      }, { duration: 500 });
      var tbl = h('table', { class: 'table table--compact' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Method'), h('th', { scope: 'col', class: 'num' }, 'Length'), h('th', { scope: 'col', class: 'num' }, 'Above optimal'))));
      var body = h('tbody');
      rows.forEach(function (r) {
        var over = (r.v / c.optimal - 1) * 100;
        body.appendChild(h('tr', null, h('th', { scope: 'row' }, r.label), h('td', { class: 'num' }, A.fmtLen(r.v)),
          h('td', { class: 'num' }, r.id === 'opt' ? '—' : (over < 0.05 ? 'optimal' : '+' + over.toFixed(1) + '%'))));
      });
      tbl.appendChild(body);
      cmpTable.appendChild(h('div', { class: 'table-wrap' }, tbl));
      cmpTable.appendChild(h('p', { class: 'compare-note' }, 'The MST tour is guaranteed to be at most 100% above optimal; in practice it is usually far closer. Nearest neighbour has no constant guarantee at all.'));
    }
    updateCompare();
    return { player: player };
  }

  V.ready(function () {
    hero();
    L.lazy('#lab-fig', lab);
    // Checkpoint ids counted from the start so the page score total does not jump when the lab starts lazily.
    ['l37-nn-next', 'l37-2opt-gain', 'l37-mst-shortcut'].forEach(function (id) { if (V.quizScore) V.quizScore.register(id); });
  });
}());
