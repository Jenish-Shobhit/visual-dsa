/* Gallery demos: VDSA.views.chart */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- Big-O growth curves with an animated linear/log toggle ---------- */
  var GROWTH = [
    { id: 'c', label: '1', fn: function () { return 1; } },
    { id: 'log', label: 'log n', fn: function (n) { return Math.log2(n); } },
    { id: 'n', label: 'n', fn: function (n) { return n; } },
    { id: 'nlog', label: 'n log n', fn: function (n) { return n * Math.log2(n); } },
    { id: 'n2', label: 'n²', fn: function (n) { return n * n; } },
    { id: 'exp', label: '2ⁿ', fn: function (n) { return Math.pow(2, n); } }
  ];
  function growthState(log, hl) {
    return {
      x: { label: 'input size n', min: 1, max: 40 },
      y: log ? { label: 'steps (log scale)', scale: 'log', min: 1, max: 1e12 } : { label: 'steps', min: 0, max: 400 },
      series: GROWTH,
      highlight: hl ? { series: 'n2', x: 16, label: '16² = 256' } : null,
      caption: log ? 'Log scale: every curve becomes readable; 2ⁿ is a straight line that outruns the rest.' : hl ? 'At n = 16, n² already needs 256 steps.' : 'Linear scale: 2ⁿ and n² leave the chart almost at once.'
    };
  }
  G.demo('chart', {
    id: 'chart-growth', title: 'Growth rates — linear ↔ log morph', wide: true,
    note: 'Function series (fn) are sampled; y.scale "log" morphs lines and ticks; direct labels sit at line ends or where a line leaves the top. Hover or focus + arrow keys for the crosshair.',
    duration: 900, hold: 1800,
    build: function (host, card) {
      var chart = VDSA.views.chart(host, { type: 'line', label: 'Growth rates chart' });
      var steps = [growthState(false), growthState(false, true), growthState(true)];
      var player = null;
      var btn = G.button(card, 'Log scale', function () {
        if (player) player.setPlaying(false);
        var log = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(log));
        chart.render(growthState(log), { duration: Math.round(900 / G.speed) });
      }, false);
      return {
        steps: steps, ready: function (p) { player = p; },
        render: function (s, c) { btn.setAttribute('aria-pressed', String(s.y.scale === 'log')); chart.render(s, { duration: c.duration }); }
      };
    }
  });

  /* ---------- measured operation counts ---------- */
  function countSorts(n, seed) {
    var rnd = VDSA.rng(seed), a = [];
    for (var i = 0; i < n; i++) a.push(rnd.int(0, 999));
    var b = a.slice(), cmpB = 0;
    for (var e = b.length - 1; e > 0; e--) for (var j = 0; j < e; j++) { cmpB++; if (b[j] > b[j + 1]) { var t = b[j]; b[j] = b[j + 1]; b[j + 1] = t; } }
    var c = a.slice(), cmpI = 0;
    for (i = 1; i < c.length; i++) { var key = c[i], k = i - 1; while (k >= 0) { cmpI++; if (c[k] <= key) break; c[k + 1] = c[k]; k--; } c[k + 1] = key; }
    var cmpM = 0;
    (function ms(x) {
      if (x.length < 2) return x;
      var m = x.length >> 1, L = ms(x.slice(0, m)), R = ms(x.slice(m)), out = [], p = 0, q = 0;
      while (p < L.length && q < R.length) { cmpM++; out.push(L[p] <= R[q] ? L[p++] : R[q++]); }
      return out.concat(L.slice(p), R.slice(q));
    })(a);
    return { bubble: cmpB, insertion: cmpI, merge: cmpM };
  }
  G.demo('chart', {
    id: 'chart-ops', title: 'Comparisons vs n — measured from real sorts',
    note: 'Points series with markers grow one size at a time; highlight rings the newest bubble-sort point; a y-annotation marks a budget.',
    duration: 520, hold: 380,
    build: function (host) {
      var chart = VDSA.views.chart(host, { type: 'line', label: 'Comparisons chart' });
      var sizes = [], data = { bubble: [], insertion: [], merge: [] };
      for (var n = 4; n <= 64; n += 4) {
        var r = countSorts(n, n * 7);
        sizes.push(n);
        data.bubble.push([n, r.bubble]); data.insertion.push([n, r.insertion]); data.merge.push([n, r.merge]);
      }
      var steps = [];
      for (var k = 2; k <= sizes.length; k++) {
        steps.push({
          x: { label: 'n', min: 0, max: 64 }, y: { label: 'comparisons', min: 0, max: 2100 },
          series: [
            { id: 'bubble', label: 'bubble', points: data.bubble.slice(0, k), markers: true },
            { id: 'insertion', label: 'insertion', points: data.insertion.slice(0, k), markers: true },
            { id: 'merge', label: 'merge', points: data.merge.slice(0, k), markers: true }
          ],
          highlight: { series: 'bubble', x: sizes[k - 1] },
          annotations: [{ y: 1000, text: '1,000 comparisons', state: 'error' }],
          caption: 'n = ' + sizes[k - 1] + ': bubble ' + data.bubble[k - 1][1] + ', insertion ' + data.insertion[k - 1][1] + ', merge ' + data.merge[k - 1][1] + '.'
        });
      }
      return { steps: steps, render: function (s, c) { chart.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- grouped bars switching datasets ---------- */
  G.demo('chart', {
    id: 'chart-bars', title: 'Grouped bars — comparisons and swaps per input shape',
    note: 'type "bar": categories × series, value labels count up, datasets morph; highlight {series, category} dims the rest.',
    duration: 700, hold: 1400,
    build: function (host) {
      var chart = VDSA.views.chart(host, { type: 'bar', label: 'Sort costs bar chart' });
      var cats = ['bubble', 'insertion', 'selection', 'merge'];
      var sets = [
        { name: 'random', cmp: [190, 101, 190, 64], swp: [96, 96, 18, 0] },
        { name: 'sorted', cmp: [19, 19, 190, 48], swp: [0, 0, 0, 0] },
        { name: 'reversed', cmp: [190, 190, 190, 40], swp: [190, 190, 10, 0] }
      ];
      var steps = sets.map(function (d) {
        return {
          categories: cats, y: { label: 'operations (n = 20, ' + d.name + ')', min: 0, max: 200 },
          series: [{ id: 'cmp', label: 'comparisons', values: d.cmp }, { id: 'swp', label: 'swaps / moves', values: d.swp }],
          caption: d.name + ' input.'
        };
      });
      steps.push(Object.assign({}, steps[1], { highlight: { series: 'cmp', category: 'selection' }, caption: 'Selection sort compares every pair even when the input is already sorted.' }));
      return { steps: steps, render: function (s, c) { chart.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- scatter ---------- */
  G.demo('chart', {
    id: 'chart-scatter', title: 'Scatter — noisy runtime samples',
    note: 'type "scatter": points keyed by id fade in as samples arrive; a dashed function series overlays the model.',
    duration: 600, hold: 700,
    build: function (host) {
      var chart = VDSA.views.chart(host, { type: 'scatter', label: 'Runtime samples' });
      var rnd = VDSA.rng(11), lin = [], bin = [];
      for (var i = 0; i < 48; i++) {
        var n = rnd.int(100, 10000);
        lin.push([n, n * 0.004 * (0.8 + rnd() * 0.5), 'l' + i]);
        bin.push([n, Math.log2(n) * 0.35 * (0.8 + rnd() * 0.5), 'b' + i]);
      }
      var steps = [12, 24, 36, 48].map(function (k) {
        return {
          x: { label: 'n', min: 0, max: 10000 }, y: { label: 'time (µs)', min: 0, max: 50 },
          series: [{ id: 'lin', label: 'linear search', points: lin.slice(0, k) }, { id: 'bin', label: 'binary search', points: bin.slice(0, k) },
            { id: 'model', label: 'model: 0.0045 n', fn: function (n) { return 0.0045 * n; }, dashed: true, state: 'muted' }],
          caption: k + ' samples of each.'
        };
      });
      return { steps: steps, render: function (s, c) { chart.render(s, { duration: c.duration }); } };
    }
  });
}());
