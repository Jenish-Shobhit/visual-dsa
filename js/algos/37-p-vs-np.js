/* Lesson 37 · P, NP & hard problems — pure step generators and references (no DOM).

   Loaded in the browser as a classic script (registers VDSA.algos['37-p-vs-np'] and VDSA.algos.pnp) and in Node via
   require() for tests/algos/37-p-vs-np.test.js.

   Contents
   - Growth:      factorial, lgamma, factorialF, opsFor(kind, n), fmtInt, fmtBig, fmtDuration, firstN, AGE_OF_UNIVERSE_S
   - TSP:         dist, tourLength, heldKarp (exact, n <= 15), bruteForce (trace, n <= 9), nearestNeighbour (trace),
                  twoOpt (trace), mstApprox (trace), compareTours, randomCities, circleCities, clusterCities, MAX_BRUTE
   - Sudoku:      PUZZLES, parseGrid, solveNaive (node counter), verifyGrid, verifySteps, raceSteps
   - Reductions:  complementGraph, isIndependent, isVertexCover, isClique, maxIndependentSet, minVertexCover, maxClique,
                  reductionSteps, missingEdge
   - 3-SAT:       evalClause, evalFormula, satisfiedClauses, bruteForceSat, satSteps, randomFormula, parseFormula,
                  countSolutions, FORMULAS
   - Vertex cover: parseEdges, graphFromEdges, vcApprox (maximal-matching 2-approximation trace), vcBranchNodes (FPT)
   - Web:         WEB (NP-complete reductions drawn in the lesson), ancestors(id)
   - Cook-Levin:  tableau, tableauWindows, tableauSteps

   Every step is a complete snapshot; nothing is mutated after it is pushed. Lab steps carry
   {kind, caption, line, vars, counters} plus what their renderer needs. Distances are in "logical units";
   displayed lengths are units / 10 (one decimal) so numbers stay readable. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) {
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos['37-p-vs-np'] = api;
    root.VDSA.algos.pnp = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var EPS = 1e-9;
  var MAX_BRUTE = 9;          // brute-force TSP animation cap: (9-1)! = 40,320 tours
  var MAX_CITIES = 14;        // every other TSP method
  var AGE_OF_UNIVERSE_S = 4.35e17;   // 13.8 billion years in seconds

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function letter(i) { return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + (i % 26)) + Math.floor(i / 26); }
  function fmtLen(x) { return (x / 10).toFixed(1); }
  function sup(n) {
    var m = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    return String(n).split('').map(function (c) { return m[c] || c; }).join('');
  }

  /* ================================================================== growth */
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  /* Lanczos approximation of ln Γ(x) for x > 0. */
  function lgamma(x) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function factorialF(x) { return Math.exp(lgamma(x + 1)); }
  /* Operation counts for the three curves in the lesson. */
  function opsFor(kind, n) {
    if (kind === 'poly' || kind === 'n3') return Math.pow(n, 3);
    if (kind === 'exp' || kind === '2n') return Math.pow(2, n);
    if (kind === 'fact' || kind === 'n!') return n === Math.floor(n) ? factorial(n) : factorialF(n);
    throw new Error('unknown curve ' + kind);
  }
  /* Smallest integer n >= 1 with opsFor(kind, n) > limit, or Infinity when none below 2000. */
  function firstN(kind, limit) {
    for (var n = 1; n < 2000; n++) if (opsFor(kind, n) > limit) return n;
    return Infinity;
  }
  function fmtInt(v) {
    if (!isFinite(v)) return '∞';
    if (v >= 1e15) return fmtBig(v);
    return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtBig(v) {
    if (!isFinite(v)) return '∞';
    if (v < 1e6) return fmtInt(v);
    var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    var mm = m.toFixed(1);
    if (mm === '10.0') { mm = '1.0'; e += 1; }
    return mm + ' × 10' + sup(e);
  }
  /* Seconds -> "8 µs", "3.2 minutes", "77 years", "1.2 × 10⁴ ages of the universe". */
  function fmtDuration(sec) {
    if (!isFinite(sec)) return 'forever';
    if (sec < 1e-6) return (sec * 1e9 < 1 ? '< 1 ns' : (sec * 1e9).toFixed(0) + ' ns');
    if (sec < 1e-3) return (sec * 1e6).toFixed(sec * 1e6 < 10 ? 1 : 0) + ' µs';
    if (sec < 1) return (sec * 1e3).toFixed(sec * 1e3 < 10 ? 1 : 0) + ' ms';
    if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' seconds';
    if (sec < 3600) return (sec / 60).toFixed(sec / 60 < 10 ? 1 : 0) + ' minutes';
    if (sec < 86400) return (sec / 3600).toFixed(sec / 3600 < 10 ? 1 : 0) + ' hours';
    var day = 86400, year = 3.156e7;
    if (sec < year) return (sec / day).toFixed(sec / day < 10 ? 1 : 0) + ' days';
    if (sec < AGE_OF_UNIVERSE_S / 10) return sec / year < 1000 ? (sec / year).toFixed(sec / year < 10 ? 1 : 0) + ' years' : fmtBig(sec / year) + ' years';
    if (sec < AGE_OF_UNIVERSE_S) return 'a sizeable fraction of the age of the universe';
    return fmtBig(sec / AGE_OF_UNIVERSE_S) + ' × the age of the universe';
  }

  /* ================================================================== TSP: geometry and references */
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function tourLength(pts, tour) {
    var n = tour.length, s = 0;
    if (n < 2) return 0;
    for (var i = 0; i < n; i++) s += dist(pts[tour[i]], pts[tour[(i + 1) % n]]);
    return s;
  }
  function pathLabel(tour, closed) {
    return tour.map(letter).join(' → ') + (closed && tour.length ? ' → ' + letter(tour[0]) : '');
  }
  /* Exact optimum by Held-Karp dynamic programming, n <= 15. Returns {length, tour} starting at city 0. */
  function heldKarp(pts) {
    var n = pts.length;
    if (n > 15) throw new RangeError('heldKarp: at most 15 cities');
    if (n === 0) return { length: 0, tour: [] };
    if (n === 1) return { length: 0, tour: [0] };
    if (n === 2) return { length: 2 * dist(pts[0], pts[1]), tour: [0, 1] };
    var m = n - 1, full = 1 << m, i, j, mask;
    var d = []; for (i = 0; i < n; i++) { d.push([]); for (j = 0; j < n; j++) d[i].push(dist(pts[i], pts[j])); }
    var dp = new Float64Array(full * m).fill(Infinity), par = new Int8Array(full * m).fill(-1);
    for (i = 0; i < m; i++) dp[(1 << i) * m + i] = d[0][i + 1];
    for (mask = 1; mask < full; mask++) {
      for (i = 0; i < m; i++) {
        if (!(mask & (1 << i))) continue;
        var cur = dp[mask * m + i];
        if (cur === Infinity) continue;
        for (j = 0; j < m; j++) {
          if (mask & (1 << j)) continue;
          var nm = mask | (1 << j), v = cur + d[i + 1][j + 1];
          if (v < dp[nm * m + j]) { dp[nm * m + j] = v; par[nm * m + j] = i; }
        }
      }
    }
    var best = Infinity, last = -1;
    for (i = 0; i < m; i++) { var t = dp[(full - 1) * m + i] + d[i + 1][0]; if (t < best) { best = t; last = i; } }
    var tour = [], mk = full - 1, c = last;
    while (c !== -1) { tour.push(c + 1); var p = par[mk * m + c]; mk &= ~(1 << c); c = p; }
    tour.push(0); tour.reverse();
    return { length: best, tour: tour };
  }
  /* Deterministic city layouts in the 1000 × 600 logical box. */
  function randomCities(n, seed) {
    var rng = mulberry(seed || 1), pts = [], tries = 0;
    while (pts.length < n && tries < 20000) {
      tries++;
      var p = { x: 70 + rng() * 860, y: 60 + rng() * 480 };
      var ok = pts.every(function (q) { return dist(p, q) > (tries < 5000 ? 95 : 55); });
      if (ok) pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
    return pts;
  }
  function circleCities(n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pts.push({ x: Math.round(500 + 380 * Math.cos(a)), y: Math.round(300 + 230 * Math.sin(a)) });
    }
    return pts;
  }
  function clusterCities(n, seed) {
    var rng = mulberry(seed || 3), centres = [[210, 170], [780, 150], [500, 460]], pts = [], tries = 0;
    while (pts.length < n && tries < 20000) {
      tries++;
      var c = centres[pts.length % 3];
      var p = { x: c[0] + (rng() - 0.5) * 300, y: c[1] + (rng() - 0.5) * 210 };
      if (p.x < 50 || p.x > 950 || p.y < 45 || p.y > 555) continue;
      if (pts.every(function (q) { return dist(p, q) > 62; })) pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
    return pts;
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- brute force: every ordering of cities 1..n-1 after fixing city 0 ---- */
  function nextPermutation(a) {
    var i = a.length - 2;
    while (i >= 0 && a[i] >= a[i + 1]) i--;
    if (i < 0) return false;
    var j = a.length - 1;
    while (a[j] <= a[i]) j--;
    var t = a[i]; a[i] = a[j]; a[j] = t;
    for (var l = i + 1, r = a.length - 1; l < r; l++, r--) { t = a[l]; a[l] = a[r]; a[r] = t; }
    return true;
  }
  /* Reference: the optimum by plain enumeration (used by the tests; also returns the number of tours). */
  function bruteForceBest(pts) {
    var n = pts.length;
    if (n > MAX_BRUTE + 1) throw new RangeError('bruteForceBest: at most ' + (MAX_BRUTE + 1) + ' cities');
    if (n <= 1) return { length: 0, tour: n ? [0] : [], tours: 1 };
    var p = []; for (var i = 1; i < n; i++) p.push(i);
    var best = Infinity, bt = null, count = 0;
    do {
      count++;
      var tour = [0].concat(p), len = tourLength(pts, tour);
      if (len < best - EPS) { best = len; bt = tour; }
    } while (nextPermutation(p));
    return { length: best, tour: bt, tours: count };
  }
  /* Trace of brute force. Every tour is checked (and counted); only about 80 of them are drawn, always including
     every new best. Returns {steps, best, length, total}. Throws RangeError beyond MAX_BRUTE cities. */
  function bruteForce(pts) {
    var n = pts.length, steps = [];
    if (n > MAX_BRUTE) throw new RangeError('brute force is capped at ' + MAX_BRUTE + ' cities');
    var total = n <= 1 ? 1 : factorial(n - 1);
    var counters = function (tried, imp) { return { tours: tried, improvements: imp }; };
    if (n === 0) {
      steps.push({ kind: 'empty', path: [], closed: false, caption: 'There are no cities yet. Click the map to add some.', line: null, vars: {}, counters: counters(0, 0) });
      return { steps: steps, best: [], length: 0, total: 0 };
    }
    if (n <= 2) {
      var t0 = n === 1 ? [0] : [0, 1], L0 = tourLength(pts, t0);
      steps.push({ kind: 'done', path: t0, closed: true, ghost: t0, caption: n === 1 ? 'One city: the only tour is to stay home, length 0.' : 'Two cities: go there and come back. There is exactly one tour, length ' + fmtLen(L0) + '.', line: 'ret', vars: { best: fmtLen(L0) }, counters: counters(1, 1), hud: [{ k: 'Tours', v: '1 of 1' }, { k: 'Best', v: fmtLen(L0) }] });
      return { steps: steps, best: t0, length: L0, total: 1 };
    }
    var p = []; for (var i = 1; i < n; i++) p.push(i);
    var stride = Math.max(1, Math.floor(total / 80)), best = Infinity, bestTour = null, tried = 0, imp = 0;
    steps.push({
      kind: 'init', path: [], closed: false, caption: 'Fix city A as the start. The other ' + (n - 1) + ' cities can follow in ' + (n - 1) + '! = <b>' + fmtInt(total) + '</b> different orders. Brute force will measure every one of them.',
      line: 'init', vars: { cities: n, tours: fmtInt(total), best: '∞' }, counters: counters(0, 0), hud: [{ k: 'Tours', v: '0 of ' + fmtInt(total) }, { k: 'Best', v: '—' }]
    });
    do {
      tried++;
      var tour = [0].concat(p), len = tourLength(pts, tour), better = len < best - EPS;
      var show = better || tried <= 8 || tried % stride === 0 || tried === total;
      if (better) { best = len; bestTour = tour; imp++; }
      if (show) {
        var note = better
          ? (tried === 1 ? 'The first tour is the best so far.' : 'Shorter than the old best, so it becomes the new best. Its ghost stays on the map.')
          : 'Not shorter than the best (' + fmtLen(best) + '), so it is thrown away.';
        steps.push({
          kind: better ? 'best' : 'try', path: tour, closed: true, ghost: bestTour, tourId: tried,
          caption: 'Tour <b>#' + fmtInt(tried) + '</b>: ' + pathLabel(tour, true) + ' has length <b>' + fmtLen(len) + '</b>. ' + note +
            (better || tried <= 8 || total <= 80 ? '' : ' <em>(Every ' + stride + 'th tour is drawn; the counter counts all of them.)</em>'),
          line: better ? 'better' : 'cmp', vars: { perm: tour.map(letter).join(''), length: fmtLen(len), best: fmtLen(best), tried: fmtInt(tried) },
          counters: counters(tried, imp), hud: [{ k: 'Tours', v: fmtInt(tried) + ' of ' + fmtInt(total) }, { k: 'This tour', v: fmtLen(len) }, { k: 'Best', v: fmtLen(best) }]
        });
      }
    } while (nextPermutation(p));
    steps.push({
      kind: 'done', path: bestTour, closed: true, ghost: bestTour,
      caption: 'All <b>' + fmtInt(total) + '</b> tours have been measured, so the best one is <b>certainly optimal</b>: length <b>' + fmtLen(best) + '</b>. The price was ' + fmtInt(total) + ' tour measurements; every extra city multiplies that by the number of cities so far.',
      line: 'ret', vars: { best: fmtLen(best), tried: fmtInt(tried) }, counters: counters(tried, imp), hud: [{ k: 'Tours', v: fmtInt(tried) + ' of ' + fmtInt(total) }, { k: 'Optimal', v: fmtLen(best) }]
    });
    return { steps: steps, best: bestTour, length: best, total: total };
  }

  /* ---- nearest neighbour ---- */
  function nearestNeighbour(pts, start) {
    var n = pts.length, s0 = start || 0, steps = [];
    var counters = function (m, look) { return { moves: m, lookups: look }; };
    if (n === 0) {
      steps.push({ kind: 'empty', path: [], closed: false, caption: 'There are no cities yet. Click the map to add some.', line: null, vars: {}, counters: counters(0, 0) });
      return { steps: steps, tour: [], length: 0 };
    }
    var visited = new Array(n).fill(false), tour = [s0], cur = s0, look = 0;
    visited[s0] = true;
    steps.push({
      kind: 'init', path: tour.slice(), closed: false, cur: cur,
      caption: 'Start at city <b>' + letter(s0) + '</b>. The rule is greedy: always walk to the closest city you have not visited yet.',
      line: 'init', vars: { current: letter(cur), visited: 1, length: '0.0' }, counters: counters(0, 0), hud: [{ k: 'Length so far', v: '0.0' }]
    });
    var len = 0;
    while (tour.length < n) {
      var cands = [], bestJ = -1, bestD = Infinity;
      for (var j = 0; j < n; j++) {
        if (visited[j]) continue;
        var d = dist(pts[cur], pts[j]);
        cands.push({ to: j, d: d }); look++;
        if (d < bestD - EPS) { bestD = d; bestJ = j; }
      }
      steps.push({
        kind: 'scan', path: tour.slice(), closed: false, cur: cur, scan: { from: cur, to: cands.map(function (c) { return { id: c.to, d: c.d }; }), pick: bestJ },
        caption: 'From <b>' + letter(cur) + '</b>, measure the distance to each of the ' + cands.length + ' unvisited cit' + (cands.length === 1 ? 'y' : 'ies') + '. The closest is <b>' + letter(bestJ) + '</b> at ' + fmtLen(bestD) + '.',
        line: 'scan', vars: { current: letter(cur), candidates: cands.length, nearest: letter(bestJ) + ' (' + fmtLen(bestD) + ')', length: fmtLen(len) },
        counters: counters(tour.length - 1, look), hud: [{ k: 'Length so far', v: fmtLen(len) }]
      });
      len += bestD; tour.push(bestJ); visited[bestJ] = true; cur = bestJ;
      steps.push({
        kind: 'go', path: tour.slice(), closed: false, cur: cur,
        caption: 'Walk to <b>' + letter(cur) + '</b>. It is now visited, so it can never be chosen again. The tour so far has length ' + fmtLen(len) + '.',
        line: 'go', vars: { current: letter(cur), visited: tour.length, length: fmtLen(len) }, counters: counters(tour.length - 1, look), hud: [{ k: 'Length so far', v: fmtLen(len) }]
      });
    }
    var total = tourLength(pts, tour);
    if (n >= 2) {
      steps.push({
        kind: 'close', path: tour.slice(), closed: true, cur: cur,
        caption: 'Every city is visited, so walk back to <b>' + letter(s0) + '</b>. That last edge is whatever it happens to be: greedy never planned for it. Total <b>' + fmtLen(total) + '</b>.',
        line: 'close', vars: { current: letter(s0), length: fmtLen(total) }, counters: counters(n - 1, look), hud: [{ k: 'Tour length', v: fmtLen(total) }]
      });
    }
    steps.push({
      kind: 'done', path: tour.slice(), closed: n >= 2, cur: null,
      caption: 'Done after only ' + look + ' distance lookups, but nothing says this tour is best. It is a heuristic: fast, and sometimes far from optimal.',
      line: 'ret', vars: { length: fmtLen(total) }, counters: counters(n - 1, look), hud: [{ k: 'Tour length', v: fmtLen(total) }]
    });
    return { steps: steps, tour: tour, length: total };
  }

  /* ---- 2-opt local search ---- */
  function isLocalOptimum(pts, tour) {
    var n = tour.length;
    for (var i = 1; i < n - 1; i++) for (var j = i + 1; j < n; j++) {
      if (i === 1 && j === n - 1) continue;
      var a = tour[i - 1], b = tour[i], c = tour[j], d = tour[(j + 1) % n];
      if (dist(pts[a], pts[c]) + dist(pts[b], pts[d]) - dist(pts[a], pts[b]) - dist(pts[c], pts[d]) < -EPS) return false;
    }
    return true;
  }
  /* Repeatedly reverse a segment when that shortens the tour. Starts from `start` (default: nearest-neighbour tour).
     Every improving swap is traced; rejected pairs are traced until the step budget (cap) runs out. */
  function twoOpt(pts, start, opts) {
    opts = opts || {};
    var n = pts.length, cap = opts.cap || 170, steps = [];
    var tour = (start ? start.slice() : nearestNeighbour(pts).tour);
    var tests = 0, swaps = 0, passes = 0;
    var counters = function () { return { tests: tests, swaps: swaps }; };
    if (n < 4) {
      var Lx = tourLength(pts, tour);
      steps.push({ kind: 'done', path: tour.slice(), closed: n >= 2, caption: n === 0 ? 'There are no cities yet. Click the map to add some.' : 'With ' + n + ' or fewer cities every tour is the same cycle, so there is nothing to improve.', line: 'done', vars: { length: fmtLen(Lx) }, counters: counters(), hud: [{ k: 'Length', v: fmtLen(Lx) }] });
      return { steps: steps, tour: tour, length: Lx, swaps: 0, tests: 0 };
    }
    var len = tourLength(pts, tour), startLen = len;
    steps.push({
      kind: 'init', path: tour.slice(), closed: true, caption: 'Start from any tour (here the nearest-neighbour one), length <b>' + fmtLen(len) + '</b>. 2-opt looks for two edges that cross or waste distance, and reconnects them the other way.',
      line: 'init', vars: { length: fmtLen(len), pass: 0 }, counters: counters(), hud: [{ k: 'Length', v: fmtLen(len) }]
    });
    var improved = true;
    while (improved) {
      improved = false; passes++;
      for (var i = 1; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
          if (i === 1 && j === n - 1) continue;
          var a = tour[i - 1], b = tour[i], c = tour[j], d = tour[(j + 1) % n];
          var oldE = dist(pts[a], pts[b]) + dist(pts[c], pts[d]), newE = dist(pts[a], pts[c]) + dist(pts[b], pts[d]), delta = newE - oldE;
          tests++;
          var gain = delta < -EPS;
          var overlay = { remove: [[a, b], [c, d]], add: [[a, c], [b, d]] };
          if (gain || steps.length < cap) {
            steps.push(Object.assign({
              kind: gain ? 'test-gain' : 'test', path: tour.slice(), closed: true, pair: [i, j],
              caption: 'Cut edges <b>' + letter(a) + '–' + letter(b) + '</b> and <b>' + letter(c) + '–' + letter(d) + '</b> (' + fmtLen(oldE) + ' together) and reconnect as <b>' + letter(a) + '–' + letter(c) + '</b> and <b>' + letter(b) + '–' + letter(d) + '</b> (' + fmtLen(newE) + '). ' +
                (gain ? 'The tour would get <b>' + fmtLen(-delta) + ' shorter</b>, so make the swap.' : 'That is ' + (delta > EPS ? fmtLen(delta) + ' longer' : 'no shorter') + ', so leave the tour alone.'),
              line: 'gain', vars: { i: i, j: j, delta: (delta >= 0 ? '+' : '−') + fmtLen(Math.abs(delta)), length: fmtLen(len) }, counters: counters(),
              hud: [{ k: 'Length', v: fmtLen(len) }, { k: 'Change if swapped', v: (delta >= 0 ? '+' : '−') + fmtLen(Math.abs(delta)) }]
            }, overlay));
          }
          if (gain) {
            var seg = tour.slice(i, j + 1).reverse();
            tour = tour.slice(0, i).concat(seg, tour.slice(j + 1));
            len += delta; swaps++; improved = true;
            steps.push({
              kind: 'swap', path: tour.slice(), closed: true, flash: [[a, c], [b, d]],
              caption: 'The cities from <b>' + letter(b) + '</b> to <b>' + letter(c) + '</b> now run in reverse order. The new tour has length <b>' + fmtLen(len) + '</b>. Every swap shortens the tour, so this loop must end.',
              line: 'swap', vars: { i: i, j: j, length: fmtLen(len), swaps: swaps }, counters: counters(), hud: [{ k: 'Length', v: fmtLen(len) }, { k: 'Swaps', v: swaps }]
            });
          }
        }
      }
    }
    steps.push({
      kind: 'done', path: tour.slice(), closed: true,
      caption: 'A full pass found no improving swap: the tour is <b>2-opt optimal</b> (a local optimum), length <b>' + fmtLen(len) + '</b>, down from ' + fmtLen(startLen) + ' after ' + swaps + ' swap' + (swaps === 1 ? '' : 's') + ' and ' + tests + ' tests. Local optimum does not mean global optimum.',
      line: 'done', vars: { length: fmtLen(len), swaps: swaps, tests: tests }, counters: counters(), hud: [{ k: 'Length', v: fmtLen(len) }, { k: 'Swaps', v: swaps }]
    });
    return { steps: steps, tour: tour, length: tourLength(pts, tour), swaps: swaps, tests: tests };
  }

  /* ---- MST-based 2-approximation (metric TSP) ---- */
  function primMST(pts) {
    var n = pts.length, inTree = new Array(n).fill(false), key = new Array(n).fill(Infinity), from = new Array(n).fill(-1), edges = [], total = 0;
    if (!n) return { edges: [], length: 0 };
    key[0] = 0;
    for (var it = 0; it < n; it++) {
      var u = -1;
      for (var v = 0; v < n; v++) if (!inTree[v] && (u < 0 || key[v] < key[u] - EPS)) u = v;
      inTree[u] = true;
      if (from[u] >= 0) { edges.push({ a: from[u], b: u, d: key[u] }); total += key[u]; }
      for (var w = 0; w < n; w++) { var d = dist(pts[u], pts[w]); if (!inTree[w] && d < key[w] - EPS) { key[w] = d; from[w] = u; } }
    }
    return { edges: edges, length: total };
  }
  function mstApprox(pts) {
    var n = pts.length, steps = [];
    var counters = function (m, t) { return { treeEdges: m, tourEdges: t }; };
    if (n === 0) {
      steps.push({ kind: 'empty', path: [], closed: false, caption: 'There are no cities yet. Click the map to add some.', line: null, vars: {}, counters: counters(0, 0) });
      return { steps: steps, tour: [], length: 0, mst: { edges: [], length: 0 } };
    }
    if (n === 1) {
      steps.push({ kind: 'done', path: [0], closed: false, caption: 'One city: the tree and the tour are both empty.', line: 'ret', vars: {}, counters: counters(0, 0) });
      return { steps: steps, tour: [0], length: 0, mst: { edges: [], length: 0 } };
    }
    var tree = [], mstLen = 0, inTree = new Array(n).fill(false), key = new Array(n).fill(Infinity), from = new Array(n).fill(-1);
    key[0] = 0;
    steps.push({
      kind: 'init', path: [], closed: false, tree: [], cur: 0,
      caption: 'Step 1: build a <b>minimum spanning tree</b> (lesson 30), the cheapest set of roads that connects every city. Start at <b>A</b>.',
      line: 'prim', vars: { tree: 0, mst: '0.0' }, counters: counters(0, 0), hud: [{ k: 'Tree weight', v: '0.0' }]
    });
    for (var it = 0; it < n; it++) {
      var u = -1;
      for (var v = 0; v < n; v++) if (!inTree[v] && (u < 0 || key[v] < key[u] - EPS)) u = v;
      inTree[u] = true;
      if (from[u] >= 0) {
        tree.push([from[u], u]); mstLen += key[u];
        steps.push({
          kind: 'edge', path: [], closed: false, tree: tree.map(function (e) { return e.slice(); }), cur: u,
          caption: 'Add the cheapest edge that leaves the tree: <b>' + letter(from[u]) + '–' + letter(u) + '</b> (' + fmtLen(key[u]) + '). Prim always grows the tree by its cheapest crossing edge.',
          line: 'prim', vars: { tree: tree.length, mst: fmtLen(mstLen) }, counters: counters(tree.length, 0), hud: [{ k: 'Tree weight', v: fmtLen(mstLen) }]
        });
      }
      for (var w = 0; w < n; w++) { var d = dist(pts[u], pts[w]); if (!inTree[w] && d < key[w] - EPS) { key[w] = d; from[w] = u; } }
    }
    var adj = []; for (var i = 0; i < n; i++) adj.push([]);
    tree.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    adj.forEach(function (l) { l.sort(function (x, y) { return x - y; }); });
    steps.push({
      kind: 'mst', path: [], closed: false, tree: tree.map(function (e) { return e.slice(); }),
      caption: 'The tree is done: weight <b>' + fmtLen(mstLen) + '</b>. Delete any one edge from an optimal tour and you get a spanning path, so <b>tree weight ≤ optimal tour</b>. That is the lower bound the guarantee rests on.',
      line: 'prim', vars: { mst: fmtLen(mstLen) }, counters: counters(tree.length, 0), hud: [{ k: 'Tree weight', v: fmtLen(mstLen) }, { k: 'Optimal tour ≥', v: fmtLen(mstLen) }]
    });
    /* preorder walk with shortcuts */
    var order = [], parent = new Array(n).fill(-1), seen = new Array(n).fill(false);
    (function dfs(u) { seen[u] = true; order.push(u); adj[u].forEach(function (v) { if (!seen[v]) { parent[v] = u; dfs(v); } }); }(0));
    function treePath(a, b) {   // vertices strictly between a and b along the tree
      var up = function (x) { var r = [x]; while (parent[x] >= 0) { x = parent[x]; r.push(x); } return r; };
      var pa = up(a), pb = up(b), setB = {}; pb.forEach(function (x) { setB[x] = true; });
      var lca = pa.find(function (x) { return setB[x]; });
      var left = pa.slice(0, pa.indexOf(lca)), right = pb.slice(0, pb.indexOf(lca)).reverse();
      return left.concat([lca], right);
    }
    var walked = [0];
    steps.push({
      kind: 'walk-start', path: [0], closed: false, tree: tree.map(function (e) { return e.slice(); }), cur: 0,
      caption: 'Step 2: walk around the tree, visiting cities in depth-first order. Walking every edge twice costs exactly <b>2 × ' + fmtLen(mstLen) + ' = ' + fmtLen(2 * mstLen) + '</b>.',
      line: 'walk', vars: { walked: 1, bound: fmtLen(2 * mstLen) }, counters: counters(tree.length, 0), hud: [{ k: 'Walk budget', v: fmtLen(2 * mstLen) }]
    });
    for (var k = 1; k < order.length; k++) {
      var a = order[k - 1], b = order[k], tp = treePath(a, b), short = tp.length > 2;
      walked.push(b);
      var openLen = 0; for (var q = 1; q < walked.length; q++) openLen += dist(pts[walked[q - 1]], pts[walked[q]]);
      steps.push({
        kind: short ? 'shortcut' : 'visit', path: walked.slice(), closed: false, tree: tree.map(function (e) { return e.slice(); }), cur: b,
        skipped: short ? tp.slice(1, -1) : [],
        caption: short
          ? 'The tree walk would climb back through <b>' + tp.slice(1, -1).map(letter).join(', ') + '</b>, which are already visited. <b>Shortcut</b>: go straight from ' + letter(a) + ' to ' + letter(b) + '. By the triangle inequality a straight line is never longer than the detour.'
          : 'Next city in the walk: <b>' + letter(b) + '</b>, one tree edge away, so the walk and the tour agree.',
        line: short ? 'shortcut' : 'walk', vars: { walked: walked.length, path: fmtLen(openLen) }, counters: counters(tree.length, walked.length - 1), hud: [{ k: 'Tour so far', v: fmtLen(openLen) }, { k: 'Walk budget', v: fmtLen(2 * mstLen) }]
      });
    }
    var tourLen = tourLength(pts, order);
    steps.push({
      kind: 'close', path: order.slice(), closed: true, tree: tree.map(function (e) { return e.slice(); }),
      caption: 'Close the loop back to A. The tour is <b>' + fmtLen(tourLen) + '</b>: at most 2 × ' + fmtLen(mstLen) + ' = ' + fmtLen(2 * mstLen) + ', and the optimum is at least ' + fmtLen(mstLen) + ' (the tree). So this tour is <b>never more than twice the optimum</b>, on any map that obeys the triangle inequality.',
      line: 'close', vars: { tour: fmtLen(tourLen), bound: fmtLen(2 * mstLen) }, counters: counters(tree.length, n), hud: [{ k: 'Tour', v: fmtLen(tourLen) }, { k: 'Guarantee ≤', v: fmtLen(2 * mstLen) }]
    });
    steps.push({
      kind: 'done', path: order.slice(), closed: true, tree: [],
      caption: 'The tree is removed; the tour remains. Straight-line distances satisfy the triangle inequality, which is exactly what made the shortcuts safe. With arbitrary edge weights this trick fails.',
      line: 'ret', vars: { tour: fmtLen(tourLen) }, counters: counters(tree.length, n), hud: [{ k: 'Tour', v: fmtLen(tourLen) }]
    });
    return { steps: steps, tour: order, length: tourLen, mst: { edges: tree, length: mstLen } };
  }

  /* Lengths of every method on the same cities (exact optimum for up to 15 cities). */
  function compareTours(pts) {
    var n = pts.length, out = {};
    if (n < 3) return null;
    var nn = nearestNeighbour(pts), opt = twoOpt(pts, nn.tour, { cap: 0 }), ms = mstApprox(pts);
    out.nearest = nn.length; out.twoOpt = opt.length; out.mst = ms.length; out.mstLength = ms.mst.length;
    out.optimal = n <= 15 ? heldKarp(pts).length : null;
    return out;
  }

  /* ================================================================== Sudoku: solve vs verify */
  var PUZZLES = {
    gentle: { name: 'Gentle', grid: '530070000600195000098000060800060003400803001700020006060000280000419005000080079' },
    nasty: { name: 'Nasty', grid: '800000000003600000070090200050007000000045700000100030001000068008500010090000400' }
  };
  function parseGrid(str) {
    var g = String(str).replace(/[^0-9.]/g, '').replace(/\./g, '0').split('').map(Number);
    if (g.length !== 81) throw new Error('a Sudoku grid needs 81 cells');
    return g;
  }
  function unitCells(kind, k) {
    var out = [], i;
    if (kind === 'row') for (i = 0; i < 9; i++) out.push(k * 9 + i);
    else if (kind === 'col') for (i = 0; i < 9; i++) out.push(i * 9 + k);
    else { var br = Math.floor(k / 3) * 3, bc = (k % 3) * 3; for (i = 0; i < 9; i++) out.push((br + Math.floor(i / 3)) * 9 + bc + (i % 3)); }
    return out;
  }
  /* First rule violation of a (complete or partial) grid, or null. {kind, index, cells, digit}. */
  function verifyGrid(grid) {
    var kinds = ['row', 'col', 'box'];
    for (var ki = 0; ki < 3; ki++) for (var k = 0; k < 9; k++) {
      var cells = unitCells(kinds[ki], k), seen = {};
      for (var c = 0; c < 9; c++) {
        var d = grid[cells[c]];
        if (d === 0) return { kind: kinds[ki], index: k, cells: cells, digit: 0, empty: true };
        if (seen[d] !== undefined) return { kind: kinds[ki], index: k, cells: [cells[seen[d]], cells[c]], digit: d };
        seen[d] = c;
      }
    }
    return null;
  }
  /* Naive backtracking: first empty cell, digits 1..9. Counts placements ("nodes"). If onNode is given it is called
     after every placement with (nodes, gridCopyGetter). Stops at nodeCap. Returns {solved, nodes, grid, backtracks}. */
  function solveNaive(grid, onNode, nodeCap) {
    var g = grid.slice(), nodes = 0, back = 0, cap = nodeCap || 5e6, aborted = false;
    function ok(i, d) {
      var r = Math.floor(i / 9), c = i % 9, k;
      for (k = 0; k < 9; k++) if (g[r * 9 + k] === d || g[k * 9 + c] === d) return false;
      var br = r - (r % 3), bc = c - (c % 3);
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === d) return false;
      return true;
    }
    function rec() {
      var i = g.indexOf(0);
      if (i < 0) return true;
      for (var d = 1; d <= 9; d++) {
        if (!ok(i, d)) continue;
        g[i] = d; nodes++;
        if (onNode) onNode(nodes, g, i, back);
        if (nodes >= cap) { aborted = true; return false; }
        if (rec()) return true;
        if (aborted) return false;
        g[i] = 0; back++;
      }
      return false;
    }
    var solved = rec();
    return { solved: solved, nodes: nodes, grid: g, backtracks: back, aborted: aborted };
  }
  /* The solution of a puzzle by the naive solver (null if unsolvable). */
  function solvedGrid(grid) { var r = solveNaive(grid); return r.solved ? r.grid : null; }
  /* Verification trace: one step per unit (9 rows, 9 columns, 9 boxes), 9 cell reads each. `given` are the clues. */
  function verifySteps(candidate, given) {
    var steps = [], reads = 0, kinds = ['row', 'col', 'box'], names = { row: 'row', col: 'column', box: 'box' };
    steps.push({ kind: 'start', unit: null, reads: 0, unitsDone: 0, ok: null, cells: [], caption: 'Someone hands you a filled grid and claims it is a solution. To verify it, check every row, column and box for the digits 1–9, each exactly once.' });
    var clueOk = true;
    for (var i = 0; i < 81; i++) if (given[i] && given[i] !== candidate[i]) clueOk = false;
    if (!clueOk) {
      steps.push({ kind: 'reject', unit: null, reads: 81, unitsDone: 0, ok: false, cells: [], caption: 'A given clue has been changed, so this is not a solution to <em>this</em> puzzle. Rejected after one pass over the 81 cells.' });
      return steps;
    }
    var done = 0;
    for (var ki = 0; ki < 3; ki++) for (var k = 0; k < 9; k++) {
      var cells = unitCells(kinds[ki], k), seen = {}, bad = null;
      for (var c = 0; c < 9; c++) {
        var d = candidate[cells[c]]; reads++;
        if (d < 1 || d > 9 || seen[d] !== undefined) { bad = { a: seen[d] === undefined ? cells[c] : cells[seen[d]], b: cells[c], digit: d }; break; }
        seen[d] = c;
      }
      done++;
      if (bad) {
        steps.push({ kind: 'reject', unit: { kind: kinds[ki], index: k }, reads: reads, unitsDone: done, ok: false, cells: cells, clash: [bad.a, bad.b],
          caption: 'The ' + names[kinds[ki]] + ' ' + (k + 1) + ' contains the digit ' + bad.digit + ' twice. <b>Rejected</b> after ' + reads + ' cell reads: one witness of a mistake is enough.' });
        return steps;
      }
      steps.push({ kind: 'unit', unit: { kind: kinds[ki], index: k }, reads: reads, unitsDone: done, ok: true, cells: cells,
        caption: 'The ' + names[kinds[ki]] + ' ' + (k + 1) + ' holds 1–9 once each. ' + done + ' of 27 units checked.' });
    }
    steps.push({ kind: 'accept', unit: null, reads: reads, unitsDone: 27, ok: true, cells: [], caption: 'All 27 units pass after only <b>' + reads + '</b> cell reads. Verifying cost a few hundred operations, however hard the puzzle was to solve.' });
    return steps;
  }
  /* The race: verify and solve advance on one operation clock. First 27 steps: one unit (9 reads) per step, and the
     solver has made 9 placements per step too. After that the clock is compressed (log-spaced) until the solver ends. */
  function raceSteps(puzzleKey, wrong) {
    var P = PUZZLES[puzzleKey] || PUZZLES.gentle, given = parseGrid(P.grid), sol = solvedGrid(given);
    var cand = sol.slice();
    if (wrong) { var i0 = 40; cand[i0] = (cand[i0] % 9) + 1; cand[i0 + 1] = cand[i0 + 1]; }   // a single wrong digit
    var vs = verifySteps(cand, given);
    var dry = solveNaive(given), N = dry.nodes;
    var targets = [], j;
    var verifyUnits = vs.length - 2;           // unit/reject steps between start and accept
    for (j = 1; j <= Math.min(verifyUnits + 1, 28); j++) targets.push(Math.min(N, 9 * j));
    var last = targets[targets.length - 1], F = 42;
    if (N > last) {
      for (j = 1; j <= F; j++) { var t = Math.round(last * Math.pow(N / last, j / F)); if (t > targets[targets.length - 1]) targets.push(t); }
    }
    if (targets[targets.length - 1] !== N) targets.push(N);
    var frames = {}, ti = 0;
    solveNaive(given, function (nodes, g, cell, back) {
      while (ti < targets.length && nodes === targets[ti]) { frames[nodes] = { grid: g.slice(), cell: cell, back: back }; ti++; }
    });
    var steps = [];
    steps.push({ kind: 'start', vstep: 0, verify: vs[0], solveNodes: 0, solveGrid: given.slice(), cell: -1, back: 0, given: given, cand: cand, N: N, done: false,
      caption: 'Same puzzle, two jobs. <b>Left</b>: check a filled grid someone gives you. <b>Right</b>: find a solution from the clues alone. Both run on one operation clock.', counters: { verifyOps: 0, solveOps: 0 } });
    for (var s = 0; s < targets.length; s++) {
      var nodes = targets[s], fr = frames[nodes];
      var vi = Math.min(s + 1, vs.length - 1);
      var v = vs[vi];
      var finishedV = vi >= vs.length - 1;
      var isLast = s === targets.length - 1;
      var reads = v.reads;
      var cap, concludes = vi === vs.length - 1 && s === vs.length - 2;
      if (isLast) cap = 'The solver finally reaches a full grid after <b>' + fmtInt(N) + '</b> placements, including ' + fmtInt(dry.backtracks) + ' that it had to undo. The verifier needed ' + fmtInt(vs[vs.length - 1].reads) + ' cell reads. That gap is the whole story of NP, in miniature.';
      else if (!finishedV) cap = v.caption + ' In the same time the solver has made ' + fmtInt(nodes) + ' placements.';
      else if (concludes) cap = v.caption + ' The solver is still searching: ' + fmtInt(nodes) + ' placements so far.';
      else cap = 'The verifier finished long ago. The solver has made ' + fmtInt(nodes) + ' placements and is still backtracking. The clock is now compressed: each step skips more placements than the one before.';
      steps.push({ kind: isLast ? 'end' : 'tick', vstep: vi, verify: v, solveNodes: nodes, solveGrid: fr ? fr.grid : given.slice(), cell: fr ? fr.cell : -1, back: fr ? fr.back : 0,
        given: given, cand: cand, N: N, done: isLast, caption: cap, counters: { verifyOps: reads, solveOps: nodes } });
    }
    return { steps: steps, nodes: N, backtracks: dry.backtracks, verifyReads: vs[vs.length - 1].reads, verifyLength: vs.length };
  }

  /* ================================================================== graph reductions */
  function edgeKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
  function complementGraph(g) {
    var have = {}; g.edges.forEach(function (e) { have[edgeKey(e[0], e[1])] = true; });
    var ids = g.nodes.map(function (n) { return n.id; }), edges = [];
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) if (!have[edgeKey(ids[i], ids[j])]) edges.push([ids[i], ids[j]]);
    return { nodes: g.nodes, edges: edges };
  }
  function toSet(list) { var s = {}; list.forEach(function (x) { s[x] = true; }); return s; }
  function isIndependent(g, S) { var s = toSet(S); return !g.edges.some(function (e) { return s[e[0]] && s[e[1]]; }); }
  function isVertexCover(g, C) { var s = toSet(C); return g.edges.every(function (e) { return s[e[0]] || s[e[1]]; }); }
  function isClique(g, S) {
    var have = {}; g.edges.forEach(function (e) { have[edgeKey(e[0], e[1])] = true; });
    for (var i = 0; i < S.length; i++) for (var j = i + 1; j < S.length; j++) if (!have[edgeKey(S[i], S[j])]) return false;
    return true;
  }
  /* First pair of S with no edge (a witness that S is not a clique), or null. */
  function missingEdge(g, S) {
    var have = {}; g.edges.forEach(function (e) { have[edgeKey(e[0], e[1])] = true; });
    for (var i = 0; i < S.length; i++) for (var j = i + 1; j < S.length; j++) if (!have[edgeKey(S[i], S[j])]) return [S[i], S[j]];
    return null;
  }
  function subsetsBy(g, pred, wantMax) {
    var ids = g.nodes.map(function (n) { return n.id; }), n = ids.length, best = null;
    if (n > 16) throw new RangeError('at most 16 vertices for the exact search');
    for (var m = 0; m < (1 << n); m++) {
      var S = []; for (var i = 0; i < n; i++) if (m & (1 << i)) S.push(ids[i]);
      if (best && (wantMax ? S.length <= best.length : S.length >= best.length)) continue;
      if (pred(g, S)) best = S;
    }
    return best || [];
  }
  function maxIndependentSet(g) { return subsetsBy(g, isIndependent, true); }
  function maxClique(g) { return subsetsBy(g, isClique, true); }
  function minVertexCover(g) { return subsetsBy(g, isVertexCover, false); }

  /* The one-graph story: independent set I -> vertex cover V \ I -> clique I in the complement graph. */
  function reductionSteps(g) {
    var ids = g.nodes.map(function (n) { return n.id; }), I = maxIndependentSet(g), Iset = toSet(I);
    var C = ids.filter(function (id) { return !Iset[id]; }), gc = complementGraph(g), k = I.length, steps = [];
    var list = function (a) { return a.length ? a.join(', ') : 'none'; };
    steps.push({ kind: 'graph', view: 'G', sel: [], role: null, caption: 'One graph, three questions. Here is <b>G</b> with ' + ids.length + ' vertices and ' + g.edges.length + ' edges. Everything below happens to this single picture.', counters: { size: 0 } });
    steps.push({ kind: 'is', view: 'G', sel: I, role: 'is', caption: 'Question 1, <b>independent set</b>: pick vertices with no edge between any two of them. The biggest one here is <b>{' + list(I) + '}</b>, size ' + k + '. No drawn edge joins two green vertices.', counters: { size: k } });
    steps.push({ kind: 'cover', view: 'G', sel: C, role: 'vc', caption: 'Question 2, <b>vertex cover</b>: pick vertices so that every edge touches at least one of them. Take everyone <em>outside</em> the independent set: <b>{' + list(C) + '}</b>, size ' + C.length + '. Every edge has an endpoint there, because an edge with both ends in I would contradict independence.', counters: { size: C.length } });
    steps.push({ kind: 'flip', view: 'Gc', sel: I, role: 'is', caption: 'Now <b>flip the graph</b>: erase every edge and draw exactly the edges that were missing. This is the complement graph <b>Ḡ</b>. Pairs that never touched in G are now connected.', counters: { size: k } });
    steps.push({ kind: 'clique', view: 'Gc', sel: I, role: 'clique', caption: 'Question 3, <b>clique</b>: pick vertices that are all joined to each other. In Ḡ, the old independent set <b>{' + list(I) + '}</b> is a clique of size ' + k + ': every pair was unconnected in G, so every pair is connected in Ḡ.', counters: { size: k } });
    steps.push({ kind: 'sum', view: 'Gc', sel: I, role: 'clique', caption: 'The same set answers all three questions: independent set of size ' + k + ' in G, vertex cover of size ' + ids.length + ' − ' + k + ' = ' + C.length + ' in G, clique of size ' + k + ' in Ḡ. Building Ḡ or taking the complement takes only polynomial time, so an algorithm for any one of the three would solve the other two.', counters: { size: k } });
    return { steps: steps, independent: I, cover: C, complement: gc };
  }

  /* ================================================================== 3-SAT */
  /* A clause is an array of non-zero integers: +i means x_i, -i means NOT x_i. assign[i-1] is true/false. */
  function evalLiteral(lit, assign) { var v = assign[Math.abs(lit) - 1]; return lit > 0 ? !!v : !v; }
  function evalClause(clause, assign) { for (var i = 0; i < clause.length; i++) if (evalLiteral(clause[i], assign)) return true; return false; }
  function satisfiedClauses(formula, assign) { return formula.map(function (c) { return evalClause(c, assign); }); }
  function evalFormula(formula, assign) { return formula.every(function (c) { return evalClause(c, assign); }); }
  function assignFromIndex(n, idx) { var a = []; for (var i = 0; i < n; i++) a.push(!!(idx & (1 << i))); return a; }   // bit i = x_{i+1}
  function countSolutions(formula, n) { var c = 0; for (var m = 0; m < (1 << n); m++) if (evalFormula(formula, assignFromIndex(n, m))) c++; return c; }
  function bruteForceSat(formula, n) {
    for (var m = 0; m < (1 << n); m++) { var a = assignFromIndex(n, m); if (evalFormula(formula, a)) return { sat: true, assign: a, tried: m + 1 }; }
    return { sat: false, assign: null, tried: 1 << n };
  }
  function clauseText(c) { return c.map(function (l) { return (l < 0 ? '¬' : '') + 'x' + Math.abs(l); }).join(' ∨ '); }
  function bits(a) { return a.map(function (v) { return v ? 1 : 0; }).join(''); }
  /* Enumerates assignments in counting order (x1 is the lowest bit). Stops at the first satisfying one unless all=true. */
  function satSteps(formula, n, opts) {
    opts = opts || {};
    var steps = [], total = 1 << n, found = 0, m;
    var counters = function (t) { return { tried: t, total: total, solutions: found }; };
    steps.push({ kind: 'start', assign: assignFromIndex(n, 0), sat: satisfiedClauses(formula, assignFromIndex(n, 0)), index: -1, tried: 0, ok: false,
      caption: 'A formula with <b>' + n + '</b> variables has 2<sup>' + n + '</sup> = <b>' + total + '</b> possible assignments. Brute force tries them one by one, in counting order, and checks all ' + formula.length + ' clauses each time.', counters: counters(0), vars: { tried: 0 } });
    for (m = 0; m < total; m++) {
      var a = assignFromIndex(n, m), sat = satisfiedClauses(formula, a), ok = sat.every(Boolean), fails = sat.filter(function (x) { return !x; }).length;
      if (ok) found++;
      var caption = ok
        ? 'Assignment <b>' + bits(a) + '</b> (x₁ is the leftmost digit): <b>every clause is satisfied</b>. That is a certificate: anyone can check it with one pass over the clauses.'
        : 'Assignment <b>' + bits(a) + '</b>: ' + fails + ' clause' + (fails === 1 ? ' is' : 's are') + ' false, so it fails. On to the next of the ' + (total - m - 1) + ' left.';
      steps.push({ kind: ok ? 'sat' : 'try', assign: a, sat: sat, index: m, tried: m + 1, ok: ok, caption: caption, counters: counters(m + 1), vars: { assignment: bits(a), tried: m + 1, falseClauses: fails } });
      if (ok && !opts.all) break;
    }
    var last = steps[steps.length - 1];
    if (!last.ok) {
      steps.push({ kind: 'unsat', assign: last.assign, sat: last.sat, index: last.index, tried: total, ok: false, caption: 'All ' + total + ' assignments fail, so this formula is <b>unsatisfiable</b>. Notice how different that answer is: "yes" comes with a short certificate, but "no" seems to need the whole search (as far as anyone knows).', counters: counters(total), vars: { tried: total } });
    }
    return steps;
  }
  function randomFormula(n, m, seed) {
    var rng = mulberry(seed || 1), f = [];
    for (var i = 0; i < m; i++) {
      var vars = [];
      while (vars.length < Math.min(3, n)) { var v = 1 + Math.floor(rng() * n); if (vars.indexOf(v) < 0) vars.push(v); }
      f.push(vars.sort(function (a, b) { return a - b; }).map(function (v) { return rng() < 0.5 ? -v : v; }));
    }
    return f;
  }
  /* "1 -2 3, -1 2 4" -> {formula, n, error}. Up to 6 variables, 12 clauses, 1 to 3 literals per clause. */
  function parseFormula(text) {
    var parts = String(text).split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return { formula: null, n: 0, error: 'Type at least one clause, e.g. 1 -2 3, -1 2 4.' };
    if (parts.length > 12) return { formula: null, n: 0, error: 'Use at most 12 clauses.' };
    var formula = [], n = 0;
    for (var i = 0; i < parts.length; i++) {
      var toks = parts[i].split(/\s+/), c = [];
      for (var t = 0; t < toks.length; t++) {
        var tok = toks[t].replace(/^[¬~!]/, '-').replace(/^(-?)x/i, '$1');
        if (!/^-?\d+$/.test(tok) || +tok === 0) return { formula: null, n: 0, error: '“' + toks[t] + '” is not a literal. Use numbers like 3 or -3 (negative means NOT).' };
        var v = Math.abs(+tok);
        if (v > 6) return { formula: null, n: 0, error: 'Variables go up to x6 here (2⁶ = 64 assignments).' };
        c.push(+tok); n = Math.max(n, v);
      }
      if (c.length > 3) return { formula: null, n: 0, error: 'Clause ' + (i + 1) + ' has ' + c.length + ' literals; 3-SAT allows at most 3.' };
      formula.push(c);
    }
    return { formula: formula, n: Math.max(n, 3), error: null };
  }
  var FORMULAS = {
    sat: { name: 'Satisfiable', n: 4, clauses: [[1, 2, -3], [-1, 3, 4], [-2, -3, -4], [1, -2, 4], [-1, -3, 2], [2, 3, 4]] },
    unsat: { name: 'Unsatisfiable', n: 3, clauses: [[1, 2, 3], [1, 2, -3], [1, -2, 3], [1, -2, -3], [-1, 2, 3], [-1, 2, -3], [-1, -2, 3], [-1, -2, -3]] },
    tight: { name: 'Exactly one solution', n: 4, clauses: [[1, 3, -4], [2, 3, 4], [-1, 3, -4], [-2, 3, 4], [1, 2, -4], [-1, -2, -3], [-1, 2, -3], [1, -3, 4]] }
  };

  /* ================================================================== vertex cover: 2-approximation */
  /* "A-B, B-C, C-D" -> {graph, error}. Up to 9 vertices, 16 edges. Vertices are labelled with letters or digits. */
  function parseEdges(text) {
    var parts = String(text).split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return { graph: null, error: 'Type some edges like A-B, B-C, C-D.' };
    if (parts.length > 16) return { graph: null, error: 'Use at most 16 edges.' };
    var edges = [], ids = [], seen = {};
    for (var i = 0; i < parts.length; i++) {
      var m = /^([A-Za-z0-9]{1,2})\s*[-–—]\s*([A-Za-z0-9]{1,2})$/.exec(parts[i]);
      if (!m) return { graph: null, error: '“' + parts[i] + '” is not an edge. Write it like A-B.' };
      var a = m[1].toUpperCase(), b = m[2].toUpperCase();
      if (a === b) return { graph: null, error: 'Edge ' + a + '-' + b + ' joins a vertex to itself.' };
      var k = edgeKey(a, b);
      if (seen[k]) continue;
      seen[k] = true; edges.push([a, b]);
      [a, b].forEach(function (x) { if (ids.indexOf(x) < 0) ids.push(x); });
    }
    if (ids.length > 9) return { graph: null, error: 'Use at most 9 vertices.' };
    return { graph: graphFromEdges(edges, ids), error: null };
  }
  function graphFromEdges(edges, ids) {
    ids = ids || (function () { var s = []; edges.forEach(function (e) { e.forEach(function (x) { if (s.indexOf(x) < 0) s.push(x); }); }); return s; }());
    var n = ids.length, nodes = ids.map(function (id, i) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
      return { id: id, x: Math.round(500 + (n === 1 ? 0 : 330) * Math.cos(a)), y: Math.round(300 + (n === 1 ? 0 : 205) * Math.sin(a)) };
    });
    return { nodes: nodes, edges: edges.map(function (e) { return [e[0], e[1]]; }) };
  }
  /* Maximal-matching 2-approximation: while an edge is uncovered, take both its endpoints. */
  function vcApprox(g) {
    var steps = [], cover = {}, matching = [], edgeState = {}, order = g.edges.slice();
    var coverList = function () { return g.nodes.map(function (n) { return n.id; }).filter(function (id) { return cover[id]; }); };
    var opt = minVertexCover(g), optSize = opt.length;
    var snap = function (kind, active, caption, line, extra) {
      steps.push(Object.assign({
        kind: kind, cover: coverList(), matching: matching.map(function (e) { return e.slice(); }), edgeState: Object.assign({}, edgeState), active: active || null,
        caption: caption, line: line, vars: { cover: '{' + coverList().join(',') + '}', matching: matching.length, size: coverList().length },
        counters: { cover: coverList().length, matching: matching.length, optimal: '?' }
      }, extra || {}));
    };
    g.edges.forEach(function (e) { edgeState[edgeKey(e[0], e[1])] = 'open'; });
    snap('init', null, 'Vertex cover: choose vertices so every edge has an endpoint in the set. Finding the <em>smallest</em> cover is NP-hard, but there is a very simple rule that is never worse than <b>twice</b> the optimum.', 'init');
    order.forEach(function (e) {
      var k = edgeKey(e[0], e[1]);
      if (cover[e[0]] || cover[e[1]]) {
        edgeState[k] = 'covered';
        snap('skip', null, 'Edge <b>' + e[0] + '–' + e[1] + '</b> already touches the cover, so skip it. Skipping is what keeps the cover from growing needlessly.', 'skip');
        return;
      }
      snap('pick', e, 'Edge <b>' + e[0] + '–' + e[1] + '</b> is not covered yet. Any cover must contain <em>one</em> of its endpoints, so the optimum pays at least 1 for it.', 'pick', { activeEdge: k });
      cover[e[0]] = true; cover[e[1]] = true; matching.push(e);
      g.edges.forEach(function (f) { var kk = edgeKey(f[0], f[1]); if ((cover[f[0]] || cover[f[1]]) && edgeState[kk] === 'open') edgeState[kk] = 'covered'; });
      edgeState[k] = 'matched';
      snap('take', e, 'Take <b>both</b> ' + e[0] + ' and ' + e[1] + '. We pay 2 where the optimum pays at least 1. Every edge touching them is now covered. These picked edges share no vertex, so they form a <b>matching</b>.', 'take', { activeEdge: k });
    });
    var size = coverList().length;
    snap('valid', null, 'No uncovered edge is left, so the ' + size + ' chosen vertices are a valid cover. They were built from ' + matching.length + ' disjoint edges: the cover has exactly <b>2 × ' + matching.length + ' = ' + size + '</b> vertices.', 'ret');
    steps[steps.length - 1].counters.optimal = '?';
    var ratio = optSize ? size / optSize : 1;
    snap('compare', null, 'For comparison, the true optimum (found by trying all subsets) is <b>' + optSize + '</b>. Our cover has ' + size + ', a ratio of ' + ratio.toFixed(2) + '. Why never worse than 2? The ' + matching.length + ' matched edges share no vertex, so any cover needs ≥ ' + matching.length + ' vertices: optimum ≥ ' + matching.length + ' and ours = 2 × ' + matching.length + '.', 'ret', { optimum: opt });
    steps[steps.length - 1].counters.optimal = optSize;
    steps[steps.length - 1].vars.optimal = optSize;
    return { steps: steps, cover: coverList(), matching: matching, optimum: opt, size: size, optimalSize: optSize };
  }
  /* Fixed-parameter search: does g have a vertex cover of size <= k? Counts recursion nodes (at most 2^(k+1) - 1). */
  function vcBranchNodes(g, k) {
    var nodes = 0;
    function rec(edges, budget) {
      nodes++;
      if (!edges.length) return true;
      if (budget === 0) return false;
      var e = edges[0];
      return [e[0], e[1]].some(function (v) { return rec(edges.filter(function (f) { return f[0] !== v && f[1] !== v; }), budget - 1); });
    }
    var found = rec(g.edges, k);
    return { found: found, nodes: nodes };
  }

  /* ================================================================== the web of NP-complete problems */
  var WEB = {
    nodes: [
      { id: 'NP', label: 'Any problem in NP', x: 100, y: 90 },
      { id: 'SAT', label: 'SAT', x: 100, y: 300 },
      { id: '3SAT', label: '3-SAT', x: 320, y: 300 },
      { id: 'IS', label: 'Independent set', x: 560, y: 130 },
      { id: 'CLQ', label: 'Clique', x: 850, y: 90 },
      { id: 'VC', label: 'Vertex cover', x: 850, y: 250 },
      { id: 'HAM', label: 'Hamiltonian cycle', x: 850, y: 420 },
      { id: 'TSP', label: 'TSP (decision)', x: 850, y: 550 },
      { id: 'COL', label: '3-colouring', x: 560, y: 380 },
      { id: 'SUB', label: 'Subset sum', x: 320, y: 520 }
    ],
    edges: [['NP', 'SAT'], ['SAT', '3SAT'], ['3SAT', 'IS'], ['IS', 'CLQ'], ['IS', 'VC'], ['VC', 'HAM'], ['HAM', 'TSP'], ['3SAT', 'COL'], ['3SAT', 'SUB']]
  };
  /* Problems that reduce to `id` through the drawn edges (A -> B means A reduces to B), excluding id itself. */
  function ancestors(id) {
    var seen = {}, stack = [id];
    while (stack.length) {
      var x = stack.pop();
      WEB.edges.forEach(function (e) { if (e[1] === x && !seen[e[0]]) { seen[e[0]] = true; stack.push(e[0]); } });
    }
    return Object.keys(seen);
  }

  /* ================================================================== Cook-Levin: computation as a table of local windows */
  /* A tiny machine: the head flips each bit and moves right; it halts on a blank. Cells: '0','1','_' or head-marked 'h0','h1','h_'. */
  function tableauNext(l, m, r) {
    void r;
    if (m[0] === 'h') return m[1] === '_' ? m : (m[1] === '0' ? '1' : '0');
    if (l && l[0] === 'h' && l[1] !== '_') return 'h' + m;
    return m;
  }
  function tableau() {
    var rows = [['h1', '0', '1', '1', '_', '_']];
    for (var r = 0; r < 4; r++) {
      var prev = rows[r], nxt = [];
      for (var c = 0; c < prev.length; c++) nxt.push(tableauNext(c ? prev[c - 1] : '#', prev[c], c + 1 < prev.length ? prev[c + 1] : '#'));
      rows.push(nxt);
    }
    return rows;
  }
  /* Every window (row r, column c) that decides cell (r+1, c): legal iff the cell equals the machine's rule. */
  function tableauWindows(rows) {
    var out = [];
    for (var r = 0; r + 1 < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var l = c ? rows[r][c - 1] : '#', m = rows[r][c], rr = c + 1 < rows[r].length ? rows[r][c + 1] : '#';
      out.push({ r: r, c: c, legal: rows[r + 1][c] === tableauNext(l, m, rr), expected: tableauNext(l, m, rr) });
    }
    return out;
  }
  /* corrupt = {r, c, value} replaces one cell (r >= 1). */
  function tableauSteps(corrupt) {
    var rows = tableau().map(function (r) { return r.slice(); });
    if (corrupt) rows[corrupt.r][corrupt.c] = corrupt.value;
    var wins = tableauWindows(rows), steps = [], bad = 0, checked = 0;
    steps.push({ kind: 'start', rows: rows, win: null, checked: 0, bad: 0, caption: 'Each row is the machine\'s whole tape at one moment; the row below is the next moment. The head (the purple cell) flips a bit and moves right. Cook and Levin\'s trick: a computation is <b>valid exactly when every small window of the table is legal</b>.' });
    wins.forEach(function (w) {
      checked++;
      if (!w.legal) bad++;
      steps.push({ kind: w.legal ? 'legal' : 'illegal', rows: rows, win: w, checked: checked, bad: bad,
        caption: w.legal
          ? 'Window at row ' + (w.r + 1) + ', column ' + (w.c + 1) + ': the three cells above force the cell below to be <b>' + w.expected.replace('h', 'head on ').replace('_', 'blank') + '</b>, and it is. One small clause, satisfied.'
          : 'Window at row ' + (w.r + 1) + ', column ' + (w.c + 1) + ': the rule demands <b>' + w.expected.replace('h', 'head on ').replace('_', 'blank') + '</b> but the table says <b>' + rows[w.r + 1][w.c].replace('h', 'head on ').replace('_', 'blank') + '</b>. This clause is <b>false</b>, and one false clause makes the whole formula false.' });
    });
    steps.push({ kind: 'end', rows: rows, win: null, checked: checked, bad: bad,
      caption: bad === 0
        ? 'All ' + checked + ' windows are legal, so the formula (one clause group per window, polynomially many in total) is satisfied: <b>the computation is valid</b>. Turn "run the verifier on a certificate" into a SAT instance this way and SAT is at least as hard as anything in NP.'
        : bad + ' window' + (bad === 1 ? ' is' : 's are') + ' illegal, so the formula cannot be satisfied with this table: the corrupted computation is rejected. (A corrupted cell also changes what its neighbours below expect, so it can break more than one window.)' });
    return steps;
  }

  return {
    MAX_BRUTE: MAX_BRUTE, MAX_CITIES: MAX_CITIES, AGE_OF_UNIVERSE_S: AGE_OF_UNIVERSE_S,
    esc: esc, letter: letter, fmtLen: fmtLen, fmtInt: fmtInt, fmtBig: fmtBig, fmtDuration: fmtDuration, sup: sup,
    factorial: factorial, lgamma: lgamma, factorialF: factorialF, opsFor: opsFor, firstN: firstN,
    dist: dist, tourLength: tourLength, heldKarp: heldKarp, bruteForceBest: bruteForceBest, bruteForce: bruteForce,
    nearestNeighbour: nearestNeighbour, twoOpt: twoOpt, isLocalOptimum: isLocalOptimum, primMST: primMST, mstApprox: mstApprox, compareTours: compareTours,
    randomCities: randomCities, circleCities: circleCities, clusterCities: clusterCities, nextPermutation: nextPermutation,
    PUZZLES: PUZZLES, parseGrid: parseGrid, unitCells: unitCells, verifyGrid: verifyGrid, solveNaive: solveNaive, solvedGrid: solvedGrid,
    verifySteps: verifySteps, raceSteps: raceSteps,
    edgeKey: edgeKey, complementGraph: complementGraph, isIndependent: isIndependent, isVertexCover: isVertexCover, isClique: isClique, missingEdge: missingEdge,
    maxIndependentSet: maxIndependentSet, maxClique: maxClique, minVertexCover: minVertexCover, reductionSteps: reductionSteps,
    evalClause: evalClause, evalFormula: evalFormula, satisfiedClauses: satisfiedClauses, assignFromIndex: assignFromIndex, countSolutions: countSolutions,
    bruteForceSat: bruteForceSat, satSteps: satSteps, randomFormula: randomFormula, parseFormula: parseFormula, clauseText: clauseText, bits: bits, FORMULAS: FORMULAS,
    parseEdges: parseEdges, graphFromEdges: graphFromEdges, vcApprox: vcApprox, vcBranchNodes: vcBranchNodes,
    WEB: WEB, ancestors: ancestors,
    tableau: tableau, tableauNext: tableauNext, tableauWindows: tableauWindows, tableauSteps: tableauSteps
  };
}));
