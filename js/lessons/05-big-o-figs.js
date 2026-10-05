/* Lesson 05 · Complexity & Big-O — shared helpers and the section figures.
   Loaded after js/algos/05-big-o.js; exposes VDSA.L05 (helpers + figure builders). js/lessons/05-big-o.js wires
   everything up lazily. Custom SVG figures follow the engine contract (docs/ENGINE.md §13): build the drawing once
   per size, keep references, and animate the same elements with VDSA.animate / VDSA.tween. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, B = V.algos.bigO;
  var L = V.L05 = V.L05 || {};

  /* ================================================================== helpers */
  function col(id) { return 'var(--st-' + B.cls(id).color + ')'; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* Content width of an element (clientWidth minus padding). */
  function innerWidth(el) {
    var cs = getComputedStyle(el);
    return Math.max(0, el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
  }
  /* An SVG sized 1:1 in CSS pixels (so text stays crisp), rebuilt when the host's width changes.
     build(W) returns the svg; update(ms) animates the dynamic parts. */
  function responsive(host, build, update, minW) {
    var W = 0, api = { svg: null };
    function rebuild(force) {
      var w = Math.max(minW || 260, Math.floor(innerWidth(host)));
      if (!force && w === W && api.svg) return;
      W = w;
      V.clear(host);
      api.svg = build(W);
      api.svg.classList.add('l05-svg');
      host.appendChild(api.svg);
      update(0, true);
    }
    rebuild(true);
    V.onResize(host, function () { rebuild(false); });
    api.rebuild = function () { rebuild(true); };
    api.width = function () { return W; };
    return api;
  }
  function svgRoot(W, H, label, cls) {
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: cls || '', role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true' });
    svg.style.width = '100%'; svg.style.height = 'auto';
    return svg;
  }
  function text(x, y, str, attrs) { var t = s('text', Object.assign({ x: x, y: y }, attrs || {})); t.textContent = str; return t; }
  /* Count a number up/down inside an element over ms. */
  function countTo(el, from, to, ms, fmt) {
    fmt = fmt || function (v) { return B.withCommas(v); };
    if (el.__count) el.__count.cancel();
    var d = V.dur(ms);
    el.__count = V.tween(d, function (t, e) { el.textContent = fmt(Math.round(lerp(from, to, e))); }, { ease: 'out' });
  }
  /* Initialise fn once the element approaches the viewport. */
  function lazy(el, fn) {
    if (!el) return;
    var go = function () { try { fn(); } catch (err) { console.error('[lesson 05]', err); } };
    if (!('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); }
    }, { rootMargin: '360px 0px 360px 0px' });
    io.observe(el);
  }
  /* A seeded list of distinct sorted values. */
  function sortedUnique(n, seed, lo, hi) {
    var r = V.rng(seed), set = {};
    var out = [];
    while (out.length < n) { var v = r.int(lo, hi); if (!set[v]) { set[v] = 1; out.push(v); } }
    return out.sort(function (a, b) { return a - b; });
  }
  /* Continuous ln Γ (Lanczos) — only for drawing n! smoothly between whole numbers. */
  function lnGamma(z) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1; var x = c[0];
    for (var i = 1; i < g + 2; i++) x += c[i] / (z + i);
    var t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function smoothF(id, n) {
    if (id === 'nfact') return Math.exp(lnGamma(n + 1));
    return B.cls(id).f(n);
  }
  /* Class chip text: coloured dot + label */
  function classDot(id) { return h('span', { class: 'cls-dot', style: '--cc:' + col(id), 'aria-hidden': 'true' }); }

  L.col = col; L.clamp = clamp; L.lerp = lerp; L.responsive = responsive; L.svgRoot = svgRoot; L.text = text;
  L.countTo = countTo; L.lazy = lazy; L.sortedUnique = sortedUnique; L.smoothF = smoothF; L.classDot = classDot; L.innerWidth = innerWidth;

  /* ================================================================== hero teaser: seven curves racing */
  L.teaser = function () {
    var stage = V.$('#teaser');
    if (!stage) return;
    var W = 400, H = 320, PL = 26, PR = 142, PT = 42, PB = 28, XMAX = 36, YMAX = 130;
    var IDS = ['1', 'logn', 'n', 'nlogn', 'n2', '2n', 'nfact'];
    var ORDER = IDS.slice().reverse();
    function X(n) { return PL + (n - 1) / (XMAX - 1) * (W - PL - PR); }
    function Y(v) { return H - PB - v / YMAX * (H - PT - PB); }
    var rec = {}, nText = null, cur = 1, tw = null, builtH = 0;
    /* The stage is 5:4 on wide screens and 16:10 on phones: draw at the stage's own ratio so text keeps its size. */
    function build() {
      var box = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
      var cw = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ch = box.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      W = clamp(Math.round(cw || 400), 300, 420);
      H = clamp(Math.round(W * (ch > 0 && cw > 0 ? ch / cw : 0.8)), 180, 340);
      var compact = (H - PT - PB + 8) / 7 < 30;
      PR = compact ? 132 : 142;
      if (W + 'x' + H === builtH) return;
      builtH = W + 'x' + H;
      V.clear(stage);
      var svg = svgRoot(W, H, null, 'l05-teaser');
      svg.style.height = '100%';
      var clipId = V.uid('tclip');
      svg.appendChild(s('defs', null, s('clipPath', { id: clipId }, s('rect', { x: PL, y: PT, width: W - PL - PR, height: H - PT - PB }))));
      [0, 32, 64, 96, 128].forEach(function (v) { svg.appendChild(s('line', { class: 't-grid', x1: PL, x2: W - PR, y1: Y(v), y2: Y(v) })); });
      svg.appendChild(s('path', { class: 't-axis', d: 'M' + PL + ' ' + PT + ' V' + (H - PB) + ' H' + (W - PR) }));
      svg.appendChild(text(W - PR, H - 8, 'input size n →', { class: 't-axis-label', 'text-anchor': 'end' }));
      svg.appendChild(text(PL, PT - 10, 'operations ↑', { class: 't-axis-label' }));
      nText = text(PL + 96, PT - 10, '', { class: 't-n' });
      svg.appendChild(nText);
      var plot = s('g', { 'clip-path': 'url(#' + clipId + ')' });
      svg.appendChild(plot);
      rec = {};
      IDS.forEach(function (id) {
        var path = s('path', { class: 't-line', style: '--cc:' + col(id) });
        plot.appendChild(path);
        var head = s('circle', { class: 't-head', r: 4.5, style: '--cc:' + col(id) });
        var exit = s('path', { class: 't-exit', d: 'M-5 4 L0 -3 L5 4', style: '--cc:' + col(id), opacity: 0 });
        svg.appendChild(head); svg.appendChild(exit);
        rec[id] = { path: path, head: head, exit: exit };
      });
      var px = W - PR + 14, rowH = (H - PT - PB + 8) / ORDER.length;
      svg.appendChild(s('rect', { class: 't-panel', x: px - 6, y: PT - 6, width: PR - 14, height: rowH * ORDER.length + 4, rx: 10 }));
      ORDER.forEach(function (id, k) {
        var y = PT + k * rowH;
        if (compact) {       // one line per class: label left, value right
          svg.appendChild(text(px + 2, y + rowH / 2, B.cls(id).label, { class: 't-lab', dy: '.35em', style: '--cc:' + col(id) }));
          rec[id].val = text(W - 12, y + rowH / 2, '', { class: 't-val is-compact', dy: '.35em', 'text-anchor': 'end' });
        } else {
          svg.appendChild(text(px + 2, y + rowH * 0.36, B.cls(id).label, { class: 't-lab', style: '--cc:' + col(id) }));
          rec[id].val = text(px + 2, y + rowH * 0.36 + 13.5, '', { class: 't-val' });
        }
        svg.appendChild(rec[id].val);
      });
      stage.appendChild(svg);
      draw(cur);
    }
    function exitAt(id, n) {       // n where the curve crosses the top of the plot, or null
      if (smoothF(id, n) <= YMAX) return null;
      var lo = 1, hi = n;
      if (smoothF(id, lo) > YMAX) return 1;
      for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (smoothF(id, m) > YMAX) hi = m; else lo = m; }
      return lo;
    }
    function draw(n) {
      if (!nText) return;
      var ni = Math.max(1, Math.round(n));
      nText.textContent = 'n = ' + ni;
      IDS.forEach(function (id) {
        var r = rec[id], d = '', step = 0.25;
        var ex = exitAt(id, n), end = ex === null ? n : Math.min(n, ex + 0.6);
        for (var t = 1; t <= end + 1e-9; t += step) d += (d ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Math.max(PT - 60, Y(smoothF(id, t))).toFixed(1);
        d += 'L' + X(end).toFixed(1) + ' ' + Math.max(PT - 60, Y(smoothF(id, end))).toFixed(1);
        r.path.setAttribute('d', d);
        if (ex === null) {
          r.head.setAttribute('cx', X(n).toFixed(1)); r.head.setAttribute('cy', Y(smoothF(id, n)).toFixed(1)); r.head.setAttribute('opacity', 1);
          r.exit.setAttribute('opacity', 0);
        } else {
          r.head.setAttribute('opacity', 0);
          r.exit.setAttribute('transform', 'translate(' + X(ex).toFixed(1) + ' ' + (PT - 4) + ')'); r.exit.setAttribute('opacity', 1);
        }
        r.val.textContent = (ex !== null ? '↑ ' : '') + (id === 'logn' ? B.trimNum(B.cls(id).f(ni), 1) : B.formatBig(B.log10Work(id, ni)));
        r.val.classList.toggle('is-off', ex !== null);
      });
    }
    function render(step, ctx) {
      if (tw) tw.cancel();
      var from = cur, to = step.n;
      if (ctx.instant || !ctx.duration) { cur = to; draw(to); return; }
      tw = V.tween(ctx.duration, function (t, e) { cur = lerp(from, to, e); draw(cur); }, { ease: 'linear' });
    }
    build();
    V.onResize(stage, build);
    var steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30, 36].map(function (n) { return { n: n }; });
    V.teaser(stage, { steps: steps, render: render, stepMs: 620, holdMs: 2200, instantWrap: true });
  };

  /* ================================================================== problem: the race */
  L.race = function () {
    var fig = V.$('#fig-race'), stage = fig.querySelector('[data-stage]');
    var values = sortedUnique(32, 42, 3, 99);
    var missing = 50; while (values.indexOf(missing) !== -1) missing++;
    var TARGETS = { last: values[31], middle: values[15], first: values[0], missing: missing };
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'compare', label: 'Being compared' }, { state: 'visited', label: 'Ruled out by the scan' },
      { state: 'muted', label: 'Thrown away by halving' }, { state: 'found', label: 'Found' }
    ]);
    var view = V.views.array(stage, { mode: 'cells', cellSize: 30, label: 'Linear scan and binary search on 32 sorted numbers', rowLabels: 'above', showIndices: false });
    function toView(st) {
      var a = st.values, lin = st.lin, bin = st.bin;
      var rowL = a.map(function (v, k) {
        var sx = 'default';
        if (lin.state === 'found' && k === lin.i) sx = 'found';
        else if (lin.state === 'absent' || k < lin.i) sx = 'visited';
        else if (k === lin.i) sx = 'compare';
        return { id: 'l' + k, value: v, state: sx };
      });
      var rowR = a.map(function (v, k) {
        var sx = 'default';
        if (bin.state === 'found' && k === bin.mid) sx = 'found';
        else if (bin.state === 'run' && k === bin.mid) sx = 'compare';
        else if (bin.state === 'absent' || k < bin.lo || k > bin.hi) sx = 'muted';
        return { id: 'r' + k, value: v, state: sx };
      });
      var pointers = [], regions = [];
      if (lin.i >= 0) pointers.push({ name: 'i', index: lin.i, row: 'lin', state: lin.state === 'found' ? 'found' : 'compare' });
      if (bin.mid >= 0) pointers.push({ name: 'mid', index: bin.mid, row: 'bin', state: bin.state === 'found' ? 'found' : 'compare' });
      if (bin.state === 'run' && bin.lo <= bin.hi) regions.push({ from: bin.lo, to: bin.hi, row: 'bin', state: 'active', label: (bin.hi - bin.lo + 1) + ' still possible' });
      return { rows: [{ id: 'lin', label: 'Linear scan: check the next value', items: rowL }, { id: 'bin', label: 'Binary search: check the middle, drop half', items: rowR }], pointers: pointers, regions: regions };
    }
    var steps = B.raceSteps(values, TARGETS.last);
    view.prepare(steps.map(toView));
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { linear: 'Linear scan comparisons', binary: 'Binary search comparisons' },
      counterStates: { linear: 'compare', binary: 'active' },
      baseStepMs: 700, label: 'Race controls'
    });
    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].counters.binary === 2 && st[k - 1].counters.binary === 1) return k;
      return -1;
    }, function (c) {
      var p = c.prev.bin, left = p.hi - p.lo + 1;
      var opts = [31, left, Math.max(1, Math.floor(left / 2))];
      if (opts[2] === opts[1]) opts[2] = left + 4;
      return {
        question: 'Binary search’s first probe ruled out one side of the middle. How many values are still possible for its second probe?',
        options: opts.map(String), answer: 1,
        explain: ['The scan rules out one value per comparison; the probe rules out a whole half, not just one value.',
          'One comparison with the middle value throws away the middle and everything on its wrong side: ' + left + ' remain.',
          'Only one halving has happened so far, not two.']
      };
    }, { id: 'race-halving' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Where is the target?', value: 'last',
      options: [{ value: 'last', label: 'Last' }, { value: 'middle', label: 'Middle' }, { value: 'first', label: 'First' }, { value: 'missing', label: 'Missing' }],
      onChange: function (v) { var st = B.raceSteps(values, TARGETS[v]); view.prepare(st.map(toView)); player.setSteps(st); }
    });

    /* Scale readout: the same two methods on a real directory */
    var host = fig.querySelector('[data-scale]');
    var STOPS = [32, 1000, 1e6, 1e9, 8e9];
    var head = h('p', { class: 'race-scale__head' });
    var bars = h('div', { class: 'race-scale__bars' });
    function bar(cls, label) {
      var fill = h('span', { class: 'race-bar__fill' }), val = h('span', { class: 'race-bar__val' });
      var row = h('div', { class: 'race-bar ' + cls }, h('span', { class: 'race-bar__label' }, label), h('span', { class: 'race-bar__track' }, fill), val);
      bars.appendChild(row);
      return { fill: fill, val: val };
    }
    var bl = bar('is-linear', 'Linear scan'), bb = bar('is-binary', 'Binary search');
    host.appendChild(h('div', { class: 'race-scale__slider' }));
    host.appendChild(head); host.appendChild(bars);
    host.appendChild(h('p', { class: 'race-scale__note' }, 'Worst-case comparisons. Bars use a log scale; times assume a billion comparisons per second.'));
    function showScale(i) {
      var n = STOPS[i], lin = n, bin = Math.floor(Math.log2(n)) + 1, max = Math.log10(8e9);
      head.innerHTML = 'Directory of <b>' + B.formatCount(n) + '</b> names';
      bl.fill.style.width = (Math.log10(lin) / max * 100) + '%';
      bb.fill.style.width = (Math.log10(Math.max(2, bin)) / max * 100) + '%';
      bl.val.textContent = B.formatCount(lin) + ' · ' + B.secondsText(Math.log10(lin) - 9);
      bb.val.textContent = bin + ' · ' + B.secondsText(Math.log10(bin) - 9);
    }
    V.slider(host.querySelector('.race-scale__slider'), {
      label: 'Directory size', min: 0, max: STOPS.length - 1, value: 0,
      format: function (i) { return B.formatCount(STOPS[i]); },
      onInput: showScale
    });
    showScale(0);
  };

  /* ================================================================== one job, three machines */
  L.machines = function () {
    var fig = V.$('#fig-machines'), stage = fig.querySelector('[data-stage]');
    var MACH = [{ name: '1980s PC', speed: 1e6, sub: 'a million ops/s' }, { name: 'Phone', speed: 3e8, sub: '300 million ops/s' }, { name: 'Laptop', speed: 1e9, sub: 'a billion ops/s' }];
    var LMIN = -7, LMAX = 7;
    var MARKS = [[-6, '1 µs'], [-3, '1 ms'], [0, '1 s'], [Math.log10(60), '1 min'], [Math.log10(3600), '1 hour'], [Math.log10(86400), '1 day']];
    var job = 'scan', k = 0, prevOps = null;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'dot', label: 'Time to finish' }, { state: 'muted', shape: 'dot', label: 'Before you changed n' }]);
    function ops() { var n = 1000 * Math.pow(2, k); return job === 'scan' ? n : n * n; }
    var els = null;
    var fig2 = responsive(stage, function (W) {
      var narrow = W < 560, LW = narrow ? 0 : 150, rowH = narrow ? 74 : 54, top = 14, H = top + rowH * MACH.length + 42;
      var x0 = LW + 10, x1 = W - 18;
      function X(l) { return x0 + (clamp(l, LMIN, LMAX) - LMIN) / (LMAX - LMIN) * (x1 - x0); }
      var svg = svgRoot(W, H, 'Three machines on a log time axis', 'l05-mach');
      MARKS.forEach(function (m, k) {
        svg.appendChild(s('line', { class: 'm-mark', x1: X(m[0]), x2: X(m[0]), y1: top - 4, y2: H - 30 }));
        if (!narrow || k === 0 || k === 1 || k === 2 || k === 4) svg.appendChild(text(X(m[0]), H - 12, m[1], { class: 'm-mark-label', 'text-anchor': 'middle' }));
      });
      els = { X: X, rows: [], narrow: narrow };
      MACH.forEach(function (m, i) {
        var y = top + i * rowH + (narrow ? 26 : 24);
        if (narrow) svg.appendChild(text(x0, y - 13, m.name + ' · ' + m.sub, { class: 'm-name' }));
        else { svg.appendChild(text(10, y - 3, m.name, { class: 'm-name' })); svg.appendChild(text(10, y + 13, m.sub, { class: 'm-sub' })); }
        svg.appendChild(s('line', { class: 'm-track', x1: x0, x2: x1, y1: y, y2: y }));
        var ghost = s('circle', { class: 'm-ghost', r: 6, cx: 0, cy: y, opacity: 0 });
        var dot = s('circle', { class: 'm-dot', r: 7, cx: 0, cy: y });
        var lab = text(0, narrow ? y + 21 : y - 12, '', { class: 'm-time', 'text-anchor': 'middle' });
        svg.appendChild(ghost); svg.appendChild(dot); svg.appendChild(lab);
        els.rows.push({ ghost: ghost, dot: dot, lab: lab, y: y });
      });
      return svg;
    }, update);
    function update(ms) {
      if (!els) return;
      var o = ops();
      MACH.forEach(function (m, i) {
        var r = els.rows[i], l = Math.log10(o / m.speed), x = els.X(l);
        V.animate(r.dot, { attr: { cx: x } }, { duration: ms, ease: 'out' });
        V.animate(r.lab, { attr: { x: clamp(x, 40, fig2 ? fig2.width() - 40 : 9999) } }, { duration: ms, ease: 'out' });
        r.lab.textContent = B.secondsText(l);
        if (prevOps !== null && prevOps !== o) { V.place(r.ghost, { attr: { cx: els.X(Math.log10(prevOps / m.speed)) } }); r.ghost.setAttribute('opacity', 1); }
        else r.ghost.setAttribute('opacity', 0);
      });
    }
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Input size n', ops: 'Operations, on every machine', change: 'Last change' }, states: { ops: 'active' } });
    function refresh(ms, changed) {
      var o = ops();
      var ratio = prevOps ? o / prevOps : 1;
      stats.update({ n: B.formatCount(1000 * Math.pow(2, k)), ops: B.formatCount(o), change: changed ? '×' + B.trimNum(ratio, 2) + ' work, ×' + B.trimNum(ratio, 2) + ' time' : '—' });
      update(ms);
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Job', value: job,
      options: [{ value: 'scan', label: 'Scan: n steps' }, { value: 'pairs', label: 'All pairs: n² steps' }],
      onChange: function (v) { prevOps = ops(); job = v; refresh(600, true); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 0, max: 10, value: 0,
      format: function (i) { return B.formatCount(1000 * Math.pow(2, i)); },
      onInput: function (v) { prevOps = ops(); k = v; refresh(450, true); } });
    refresh(0, false);
  };

  /* ================================================================== intuition: the party */
  L.party = function () {
    var fig = V.$('#fig-party'), host = fig.querySelector('[data-stage]');
    var n = 5, prevN = 5, MAXN = 12;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'dot', label: 'Guest' }, { state: 'swap', label: 'Newest guest’s work' }, { state: 'compare', label: 'Card looked at' }]);
    var panels = [
      { id: 'greet', title: 'Greet each guest', o: 'n', count: function (n) { return n; }, unit: 'greetings' },
      { id: 'shake', title: 'Everyone shakes hands', o: 'n2', count: function (n) { return n * (n - 1) / 2; }, unit: 'handshakes' },
      { id: 'find', title: 'Find a card by halving', o: 'logn', count: function (n) { return n ? Math.floor(Math.log2(n)) + 1 : 0; }, unit: 'looks' }
    ];
    var counts = {};
    panels.forEach(function (p) {
      var num = h('span', { class: 'party__num' }, '0');
      var st = h('div', { class: 'party__stage stage-grid' });
      var el = h('div', { class: 'party__panel' },
        h('div', { class: 'party__head' }, h('span', { class: 'party__title' }, p.title), h('span', { class: 'big-o', 'data-o': p.o })),
        st, h('p', { class: 'party__count' }, num, ' ', p.unit));
      host.appendChild(el);
      p.stage = st; p.num = num; counts[p.id] = 0;
    });
    // fill badge text (shell fills empty .big-o only at load)
    V.$$('.big-o', host).forEach(function (b) { var o = b.getAttribute('data-o'); b.textContent = { n: 'O(n)', n2: 'O(n²)', logn: 'O(log n)' }[o]; });

    /* greet: dots in rows of 6, each with a wave tick */
    var greet = { dots: [], svg: null };
    var R = 170;   // drawing size (square viewBox, scaled to the panel)
    function greetPos(k) { var cols = 6, gap = R / (cols + 0.5); return { x: gap * 0.75 + (k % cols) * gap, y: 62 + Math.floor(k / cols) * 56 }; }
    greet.svg = svgRoot(R, R, 'Guests greeted one by one', 'l05-party');
    panels[0].stage.appendChild(greet.svg);
    greet.svg.appendChild(s('path', { class: 'p-door', d: 'M8 ' + (R - 18) + ' H' + (R - 8) }));
    /* shake: circle */
    var shake = { svg: svgRoot(R, R, 'Guests on a circle with a line for every handshake', 'l05-party'), dots: [], chords: {}, pos: [] };
    panels[1].stage.appendChild(shake.svg);
    shake.chordG = s('g'); shake.dotG = s('g');
    shake.svg.appendChild(shake.chordG); shake.svg.appendChild(shake.dotG);
    /* find: a pile of cards + halving brackets */
    var FH = 204;   // the card pile is taller than the other two drawings so its labels stay readable
    var find = { svg: svgRoot(R, FH, 'A sorted pile of name cards halved until one is left', 'l05-party'), cards: [], brackets: [] };
    panels[2].stage.appendChild(find.svg);
    var NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai', 'Liv'];

    function circlePos(k, m) { var a = -Math.PI / 2 + (m ? k / m : 0) * Math.PI * 2, r = R / 2 - 20; return { x: R / 2 + (m === 1 ? 0 : r * Math.cos(a)), y: R / 2 + (m === 1 ? 0 : r * Math.sin(a)) }; }
    var tw = null;
    function render(ms) {
      var grow = n > prevN;
      /* greet */
      while (greet.dots.length < n) {
        var k = greet.dots.length, p = greetPos(k);
        var g = s('g', { class: 'p-guest' }, s('circle', { r: 10 }), text(0, -16, 'hi', { class: 'p-hi', 'text-anchor': 'middle' }));
        V.place(g, { x: p.x, y: p.y, scale: 0.2, opacity: 0 });
        greet.svg.appendChild(g); greet.dots.push(g);
      }
      greet.dots.forEach(function (g, k) {
        var on = k < n, fresh = k >= prevN && on;
        g.classList.toggle('is-new', fresh && grow);
        V.animate(g, { scale: on ? 1 : 0.2, opacity: on ? 1 : 0 }, { duration: ms, ease: on ? 'back' : 'out', delay: fresh ? (k - prevN) * 40 : 0 });
      });
      /* shake: dots glide to their new angles, chords follow every frame */
      var fromPos = shake.pos.slice(), toPos = [];
      for (var i = 0; i < MAXN; i++) toPos.push(circlePos(Math.min(i, n - 1), n));
      while (shake.dots.length < MAXN) {
        var d = s('circle', { class: 'p-dot', r: 8, cx: R / 2, cy: R / 2, opacity: 0 });
        shake.dotG.appendChild(d); shake.dots.push(d);
      }
      var need = {};
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) need[a + '-' + b] = [a, b];
      Object.keys(shake.chords).forEach(function (key) {
        if (need[key]) return;
        var c = shake.chords[key];
        delete shake.chords[key];
        V.animate(c.el, { opacity: 0 }, { duration: ms * 0.6 }).then(function () { c.el.remove(); });
      });
      Object.keys(need).forEach(function (key) {
        if (shake.chords[key]) { shake.chords[key].el.classList.remove('is-new'); return; }
        var el = s('line', { class: 'p-chord' + (need[key][1] >= prevN && grow ? ' is-new' : '') });
        shake.chordG.appendChild(el);
        shake.chords[key] = { el: el, a: need[key][0], b: need[key][1] };
        V.place(el, { opacity: 0 });
        V.animate(el, { opacity: 1 }, { duration: ms, delay: ms * 0.35 });
      });
      if (!fromPos.length) fromPos = toPos;
      fromPos = fromPos.slice();
      for (var q = prevN; q < n; q++) fromPos[q] = toPos[q];      // new guests appear in place, then fade in
      if (tw) tw.cancel();
      function frame(e) {
        var cur = toPos.map(function (p, i) { var f = fromPos[i] || p; return { x: lerp(f.x, p.x, e), y: lerp(f.y, p.y, e) }; });
        shake.pos = cur;
        shake.dots.forEach(function (dd, i) { dd.setAttribute('cx', cur[i].x.toFixed(1)); dd.setAttribute('cy', cur[i].y.toFixed(1)); });
        Object.keys(shake.chords).forEach(function (key) {
          var c = shake.chords[key];
          c.el.setAttribute('x1', cur[c.a].x.toFixed(1)); c.el.setAttribute('y1', cur[c.a].y.toFixed(1));
          c.el.setAttribute('x2', cur[c.b].x.toFixed(1)); c.el.setAttribute('y2', cur[c.b].y.toFixed(1));
        });
      }
      shake.dots.forEach(function (dd, i) { V.animate(dd, { opacity: i < n ? 1 : 0 }, { duration: ms }); dd.classList.toggle('is-new', grow && i >= prevN && i < n); });
      tw = V.tween(V.dur(ms), function (t, e) { frame(e); });
      if (!V.dur(ms)) frame(1);
      /* find: cards + brackets for the worst case (the last card) */
      var ch = Math.min(17, (FH - 16) / MAXN), cw = 70, top = (FH - n * ch) / 2;
      while (find.cards.length < MAXN) {
        var cg = s('g', { class: 'p-card' }, s('rect', { x: 0, y: 0, width: cw, height: ch - 2, rx: 2.5 }), text(cw / 2, (ch - 2) / 2, '', { class: 'p-card-t', 'text-anchor': 'middle', dy: '.35em' }));
        V.place(cg, { x: 18, y: FH, opacity: 0 });
        find.svg.appendChild(cg); find.cards.push(cg);
      }
      var lo = 0, hi = n - 1, looks = [];
      while (lo <= hi) { var mid = Math.floor((lo + hi) / 2); looks.push({ lo: lo, hi: hi, mid: mid }); if (mid === n - 1) break; lo = mid + 1; }
      var looked = {}; looks.forEach(function (lk) { looked[lk.mid] = true; });
      find.cards.forEach(function (cg, k) {
        cg.lastChild.textContent = NAMES[k];
        cg.setAttribute('class', 'p-card' + (looked[k] && k < n ? ' is-looked' : ''));
        V.animate(cg, { x: 18, y: top + k * ch, opacity: k < n ? 1 : 0 }, { duration: ms, ease: 'out' });
      });
      while (find.brackets.length < 5) {
        var bg = s('g', { class: 'p-bracket' }, s('path', { d: '' }));
        V.place(bg, { opacity: 0 });
        find.svg.appendChild(bg); find.brackets.push(bg);
      }
      find.brackets.forEach(function (bg, i) {
        var lk = looks[i], x = 18 + cw + 14 + i * 15;
        if (!lk || !n) { V.animate(bg, { opacity: 0 }, { duration: ms }); return; }
        var y1 = top + lk.lo * ch + 1, y2 = top + (lk.hi + 1) * ch - 3;
        bg.firstChild.setAttribute('d', 'M' + (x - 6) + ' ' + y1 + ' H' + x + ' V' + y2 + ' H' + (x - 6));
        V.animate(bg, { opacity: 1 }, { duration: ms, delay: i * 60 });
      });
      /* counts */
      panels.forEach(function (p) { var to = p.count(n); countTo(p.num, counts[p.id], to, ms); counts[p.id] = to; });
      prevN = n;
    }
    var slider = V.slider(fig.querySelector('[data-slider]'), { label: 'Guests n', min: 1, max: MAXN, value: n,
      onInput: function (v) { n = v; render(520); } });
    fig.querySelector('[data-add]').addEventListener('click', function () { if (n < MAXN) { n++; slider.set(n); render(620); } });
    fig.querySelector('[data-reset]').addEventListener('click', function () { n = 1; slider.set(n); render(420); });
    render(0);
  };

  /* ================================================================== four snippets, one clock */
  L.counter = function () {
    var fig = V.$('#fig-counter'), cardsHost = fig.querySelector('[data-cards]'), plotHost = fig.querySelector('[data-plot]');
    var n = 8, MAXN = 24;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Operation done' }, { state: 'muted', label: 'Out of the loop’s range' }]);
    var SN = [
      { id: 'constant', o: '1', title: 'One line', code: 'return a[0];' },
      { id: 'halving', o: 'logn', title: 'Halving loop', code: 'let i = n;\nwhile (i > 1) {\n  i = Math.floor(i / 2); ops++;\n}' },
      { id: 'linear', o: 'n', title: 'One loop', code: 'for (let i = 0; i < n; i++)\n  ops++;' },
      { id: 'nested', o: 'n2', title: 'Nested loops', code: 'for (let i = 0; i < n; i++)\n  for (let j = 0; j < n; j++)\n    ops++;' }
    ];
    var measured = { constant: {}, halving: {}, linear: {}, nested: {} };
    /* On narrow figures the four cards stack, so a strip of live counters keeps the race in view. */
    var strip = h('div', { class: 'ctr-strip', 'aria-hidden': 'true' });
    cardsHost.parentNode.insertBefore(strip, cardsHost);
    SN.forEach(function (sn) {
      var num = h('span', { class: 'ctr__num' }, '0');
      var vis = h('div', { class: 'ctr__vis' });
      var pre = h('pre', { class: 'ctr__code' });
      var badge = h('span', { class: 'big-o', 'data-o': sn.o }, B.cls(sn.o).o);
      var card = h('div', { class: 'ctr', style: '--cc:' + col(sn.o) },
        h('div', { class: 'ctr__head' }, h('span', { class: 'ctr__title' }, sn.title), badge), pre, vis,
        h('p', { class: 'ctr__count' }, num, h('span', { class: 'ctr__unit' }, ' operations')), h('div', { class: 'ctr__bar' }, h('span')));
      cardsHost.appendChild(card);
      V.codeBlock(pre, sn.code, 'js');
      sn.stripNum = h('b', null, '0');
      strip.appendChild(h('span', { class: 'ctr-strip__item', style: '--cc:' + col(sn.o) }, h('span', { class: 'ctr-strip__o' }, B.cls(sn.o).o), sn.stripNum));
      sn.num = num; sn.vis = vis; sn.card = card; sn.barFill = card.querySelector('.ctr__bar > span'); sn.unit = card.querySelector('.ctr__unit');
    });
    /* visuals: cells */
    function buildVis(sn) {
      V.clear(sn.vis);
      var w = Math.max(160, Math.floor(innerWidth(sn.vis)) || 240);
      sn.cells = [];
      if (sn.id === 'nested') {
        var c = Math.min(11, Math.floor((Math.min(w, 250)) / n)), size = c * n;
        var svg = svgRoot(size + 2, size + 2, null, 'l05-cells');
        svg.style.width = (size + 2) + 'px';
        for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
          var r = s('rect', { class: 'c-cell', x: 1 + j * c, y: 1 + i * c, width: c - 1.2, height: c - 1.2, rx: Math.min(2, c / 5) });
          svg.appendChild(r); sn.cells.push(r);
        }
        sn.vis.appendChild(svg);
      } else {
        var cw = Math.min(20, Math.floor((w - 4) / n)), H = cw + 18;
        var svg2 = svgRoot(cw * n + 4, H, null, 'l05-cells');
        svg2.style.width = (cw * n + 4) + 'px';
        for (var k = 0; k < n; k++) {
          var rr = s('rect', { class: 'c-cell', x: 2 + k * cw, y: 2, width: cw - 2, height: cw - 2, rx: Math.min(3, cw / 5) });
          svg2.appendChild(rr); sn.cells.push(rr);
        }
        if (sn.id === 'halving') { sn.bracket = s('path', { class: 'c-window', d: '' }); svg2.appendChild(sn.bracket); sn.cw = cw; }
        sn.vis.appendChild(svg2);
      }
    }
    function paint(sn, done) {
      var total = B.snippetOps(sn.id, n);
      sn.num.textContent = B.withCommas(done);
      sn.stripNum.textContent = B.withCommas(done);
      sn.unit.textContent = done === 1 ? ' operation' : ' operations';
      sn.barFill.style.width = (total ? done / (n * n) * 100 : 0) + '%';
      sn.card.classList.toggle('is-done', done >= total);
      if (sn.id === 'constant') sn.cells.forEach(function (c, k) { c.setAttribute('class', 'c-cell' + (k === 0 && done ? ' is-on' : '')); });
      else if (sn.id === 'linear' || sn.id === 'nested') sn.cells.forEach(function (c, k) { c.setAttribute('class', 'c-cell' + (k < done ? ' is-on' : '')); });
      else {
        var trail = B.halvingTrail(n), size = done < trail.length ? trail[done] : 1;
        sn.cells.forEach(function (c, k) { c.setAttribute('class', 'c-cell' + (k >= size ? ' is-out' : '')); });
        var x2 = 2 + size * sn.cw - 2;
        sn.bracket.setAttribute('d', 'M2 ' + (sn.cw + 4) + ' V' + (sn.cw + 10) + ' H' + x2 + ' V' + (sn.cw + 4));
      }
    }
    var raf = 0, running = false, runStart = 0;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; running = false; }
    function finish() {
      stop();
      SN.forEach(function (sn) { paint(sn, B.snippetOps(sn.id, n)); measured[sn.id][n] = B.snippetOps(sn.id, n); });
      plotUpdate(500);
    }
    function run() {
      stop();
      SN.forEach(function (sn) { buildVis(sn); paint(sn, 0); });
      var total = n * n, T = clamp(total * 14, 1200, 5200);
      if (!V.dur(T)) { finish(); return; }
      running = true; runStart = 0;
      raf = requestAnimationFrame(function tick(now) {
        if (!runStart) runStart = now;
        var t = clamp((now - runStart) / T, 0, 1), ticks = Math.floor(t * total);
        SN.forEach(function (sn) { paint(sn, Math.min(ticks, B.snippetOps(sn.id, n))); });
        if (t >= 1) { finish(); return; }
        raf = requestAnimationFrame(tick);
      });
    }
    /* plot: log-y, linear x, theory curves + measured dots */
    var pl = null;
    function plotBuild(W) {
      var H = clamp(Math.round(W * 0.42), 200, 280), ML = 44, MR = 58, MT = 14, MB = 30;
      var svg = svgRoot(W, H, 'Operations against n for the four snippets, log scale', 'l05-plot');
      function X(v) { return ML + (v - 1) / (MAXN - 1) * (W - ML - MR); }
      function Y(v) { return H - MB - (Math.log10(Math.max(1, v)) / Math.log10(MAXN * MAXN)) * (H - MT - MB); }
      [1, 10, 100, 576].forEach(function (v) {
        svg.appendChild(s('line', { class: 'pl-grid', x1: ML, x2: W - MR, y1: Y(v), y2: Y(v) }));
        svg.appendChild(text(ML - 8, Y(v), B.withCommas(v), { class: 'pl-tick', 'text-anchor': 'end', dy: '.35em' }));
      });
      [1, 8, 16, 24].forEach(function (v) { svg.appendChild(text(X(v), H - MB + 16, v, { class: 'pl-tick', 'text-anchor': 'middle' })); });
      svg.appendChild(text(W - MR, H - 4, 'n', { class: 'pl-tick', 'text-anchor': 'end' }));
      svg.appendChild(text(ML + 8, MT + 4, 'operations', { class: 'pl-tick', 'text-anchor': 'start' }));
      svg.appendChild(s('path', { class: 'pl-axis', d: 'M' + ML + ' ' + MT + ' V' + (H - MB) + ' H' + (W - MR) }));
      pl = { X: X, Y: Y, dots: {}, svg: svg, g: s('g') };
      SN.forEach(function (sn) {
        var d = '';
        for (var v = 1; v <= MAXN; v++) d += (d ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(Math.max(1, B.snippetOps(sn.id, v))).toFixed(1);
        svg.appendChild(s('path', { class: 'pl-line', d: d, style: '--cc:' + col(sn.o) }));
        svg.appendChild(text(W - MR + 6, Y(Math.max(1, B.snippetOps(sn.id, MAXN))), B.cls(sn.o).label, { class: 'pl-label', dy: '.35em', style: '--cc:' + col(sn.o) }));
      });
      svg.appendChild(pl.g);
      return svg;
    }
    function plotUpdate(ms) {
      if (!pl) return;
      SN.forEach(function (sn) {
        Object.keys(measured[sn.id]).forEach(function (key) {
          var id = sn.id + '-' + key;
          if (pl.dots[id]) return;
          var dot = s('circle', { class: 'pl-dot', r: 4.5, cx: pl.X(+key), cy: pl.Y(Math.max(1, measured[sn.id][key])), style: '--cc:' + col(sn.o) });
          pl.g.appendChild(dot); pl.dots[id] = dot;
          if (ms) { V.place(dot, { scale: 1, opacity: 0 }); V.animate(dot, { opacity: 1 }, { duration: ms }); }
        });
      });
      V.$$('.pl-dot.is-latest', pl.svg).forEach(function (d) { d.classList.remove('is-latest'); });
      SN.forEach(function (sn) { var d = pl.dots[sn.id + '-' + n]; if (d) d.classList.add('is-latest'); });
    }
    responsive(plotHost, plotBuild, plotUpdate, 280);
    var deb = 0;
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 1, max: MAXN, value: n,
      onInput: function (v) { n = v; stop(); SN.forEach(function (sn) { buildVis(sn); paint(sn, 0); }); clearTimeout(deb); deb = setTimeout(run, 380); } });
    fig.querySelector('[data-run]').addEventListener('click', run);
    fig.querySelector('[data-skip]').addEventListener('click', finish);
    SN.forEach(function (sn) { buildVis(sn); paint(sn, 0); });
    var unVis = V.onVisible(fig, function (vis) { if (vis) { unVis(); run(); } }, { threshold: 0.3 });
    V.onResize(cardsHost, function () { if (!running) SN.forEach(function (sn) { var d = +sn.num.textContent.replace(/,/g, '') || 0; buildVis(sn); paint(sn, d); }); });
  };
  /* ================================================================== the growth ladder (engine chart) */
  L.growth = function () {
    var fig = V.$('#fig-growth'), stage = fig.querySelector('[data-stage]');
    var chart = V.views.chart(stage, { type: 'line', label: 'Operations against n for each growth class',
      valueFormat: function (v) { return v >= 1e300 ? 'more than 10³⁰⁰' : B.formatCount(v); } });
    var on = { '1': true, logn: true, n: true, nlogn: true, n2: true, n3: false, '2n': true, nfact: true };
    var STOPS = [10, 20, 50, 100, 1000, 1e4, 1e5, 1e6], stop = 1, log = false;
    var chipsHost = fig.querySelector('[data-chips]');
    B.CLASSES.forEach(function (c) {
      var b = h('button', { type: 'button', class: 'class-chip', 'aria-pressed': String(on[c.id]), style: '--cc:' + col(c.id) }, classDot(c.id), c.label);
      b.addEventListener('click', function () {
        var count = Object.keys(on).filter(function (k) { return on[k]; }).length;
        if (on[c.id] && count === 1) return;           // keep at least one curve
        on[c.id] = !on[c.id]; b.setAttribute('aria-pressed', String(on[c.id])); show(700);
      });
      chipsHost.appendChild(b);
    });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: {} });
    function capped(id) { return function (x) { var v = smoothF(id, x); return isFinite(v) ? Math.min(v, 1e300) : 1e300; }; }
    function show(ms) {
      var nmax = STOPS[stop], sel = B.CLASSES.filter(function (c) { return on[c.id]; });
      var poly = sel.filter(function (c) { return c.id !== '2n' && c.id !== 'nfact'; });
      var ref = poly.length ? poly : sel;
      var ymax = Math.max.apply(null, ref.map(function (c) { return Math.min(1e300, B.work(c.id, nmax)); }));
      if (!poly.length) ymax = Math.min(ymax, 1e6);
      var y;
      if (log) y = { label: 'operations (log scale)', scale: 'log', min: 1, max: Math.pow(10, Math.max(2, Math.ceil(Math.log10(Math.max(10, ymax)) + (poly.length ? 0.3 : 0)))) };
      else y = { label: 'operations', min: 0, max: Math.max(10, ymax * 1.05) };
      var series = sel.map(function (c) {
        // exponentials: sample only up to just past where they leave the plot, so their steep rise is drawn
        var end = nmax;
        if (c.id === '2n' || c.id === 'nfact') {
          var lim = y.max * 50, x = 1;
          while (x < nmax && B.work(c.id, x) < lim) x = x < 64 ? x + 0.25 : x * 1.2;
          end = Math.min(nmax, Math.max(2, x));
        }
        return { id: c.id, label: c.label, fn: capped(c.id), state: c.color, domain: [1, end], samples: c.id === '2n' || c.id === 'nfact' ? 120 : 90 };
      });
      chart.render({ x: { label: 'input size n', min: 1, max: nmax }, y: y, series: series }, { duration: ms });
      var obj = {}, labels = {};
      sel.forEach(function (c) {
        var l = B.log10Work(c.id, nmax);
        obj[c.id] = c.id === 'logn' ? B.trimNum(B.cls('logn').f(nmax), 1) : B.formatBig(l);
        labels[c.id] = c.label + ' at n = ' + B.formatCount(nmax);
      });
      V.clear(stats.el);
      stats = V.stats(stats.el, { labels: labels });
      stats.update(obj);
      V.$$('.stat', stats.el).forEach(function (st, i) { st.style.setProperty('--sw', col(sel[i].id)); st.setAttribute('data-state', ''); });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Y axis', value: 'lin', options: [{ value: 'lin', label: 'Linear axis' }, { value: 'log', label: 'Log axis' }],
      onChange: function (v) { log = v === 'log'; show(900); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Largest n', min: 0, max: STOPS.length - 1, value: stop,
      format: function (i) { return B.formatCount(STOPS[i]); }, onInput: function (v) { stop = v; show(500); } });
    show(900);
  };

  /* ================================================================== the doubling game */
  L.doubling = function () {
    var fig = V.$('#fig-doubling'), stage = fig.querySelector('[data-stage]'), nOut = fig.querySelector('[data-n]');
    var IDS = ['1', 'logn', 'n', 'nlogn', 'n2', '2n'], DEC = 10;
    var n = 8, prev = null;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'muted', label: 'Work at the old n' }, { state: 'active', label: 'Work at the new n' }]);
    var els = null;
    var fig2 = responsive(stage, function (W) {
      var narrow = W < 700, LW = narrow ? 0 : 92, RW = narrow ? 0 : 290, rowH = narrow ? 70 : 46, top = 26, H = top + rowH * IDS.length + 26;
      var x0 = LW + 6, x1 = W - RW - 16;
      function X(l) { return x0 + clamp(l, 0, DEC) / DEC * (x1 - x0); }
      var svg = svgRoot(W, H, 'Work per growth class before and after doubling n', 'l05-dbl');
      [0, 3, 6, 9].forEach(function (d) {
        svg.appendChild(s('line', { class: 'd-tick', x1: X(d), x2: X(d), y1: top - 6, y2: H - 22 }));
        svg.appendChild(text(X(d), H - 8, d === 0 ? '1' : d === 3 ? '1,000' : d === 6 ? '1 million' : '1 billion', { class: 'd-tick-label', 'text-anchor': 'middle' }));
      });
      svg.appendChild(text(x1, top - 12, 'off the chart →', { class: 'd-tick-label', 'text-anchor': 'end' }));
      if (!narrow) { svg.appendChild(text(W - RW + 4, top - 12, 'work ×', { class: 'd-head' })); svg.appendChild(text(W - RW + 136, top - 12, 'if n took 1 s, 2n takes', { class: 'd-head' })); }
      els = { X: X, rows: {}, narrow: narrow, x1: x1 };
      IDS.forEach(function (id, i) {
        var y = top + i * rowH + (narrow ? 30 : 14), c = col(id);
        var g = s('g', { style: '--cc:' + c });
        if (narrow) g.appendChild(text(x0, y - 14, B.cls(id).o, { class: 'd-label' }));
        else g.appendChild(text(10, y + 5, B.cls(id).o, { class: 'd-label' }));
        g.appendChild(s('rect', { class: 'd-track', x: x0, y: y - 6, width: x1 - x0, height: 12, rx: 6 }));
        var ghost = s('rect', { class: 'd-ghost', x: x0, y: y - 6, width: 0, height: 12, rx: 6 });
        var bar = s('rect', { class: 'd-bar', x: x0, y: y - 6, width: 0, height: 12, rx: 6 });
        var val = text(x0, y + 4, '', { class: 'd-val' });
        var arrow = s('path', { class: 'd-arrow', d: 'M0 -7 L9 0 L0 7 Z', opacity: 0 });
        var mult = text(narrow ? W - 12 : W - RW + 4, narrow ? y - 14 : y + 5, '', { class: 'd-mult', 'text-anchor': narrow ? 'end' : 'start' });
        var time = text(narrow ? x0 : W - RW + 136, narrow ? y + 26 : y + 5, '', { class: 'd-time' });
        [ghost, bar, arrow, val, mult, time].forEach(function (e) { g.appendChild(e); });
        svg.appendChild(g);
        els.rows[id] = { ghost: ghost, bar: bar, val: val, arrow: arrow, mult: mult, time: time, y: y };
      });
      return svg;
    }, update);
    function update(ms) {
      if (!els) return;
      IDS.forEach(function (id) {
        var r = els.rows[id], l = B.log10Work(id, n), x0 = els.X(0);
        var w = els.X(l) - x0, off = l > DEC;
        V.animate(r.bar, { attr: { width: Math.max(4, w) } }, { duration: ms, ease: 'out' });
        r.bar.classList.toggle('is-off', off);
        V.animate(r.arrow, { x: els.x1 + 3, y: r.y, opacity: off ? 1 : 0 }, { duration: ms });
        if (prev !== null) {
          var lp = B.log10Work(id, prev);
          V.animate(r.ghost, { attr: { width: Math.max(4, els.X(lp) - x0) }, opacity: 1 }, { duration: ms * 0.3 });
          var dd = B.doubling(id, Math.min(prev, n));
          var grew = n > prev;
          r.mult.textContent = grew ? dd.text : (id === 'logn' ? '−1 step' : id === '1' ? '×1' : '÷' + dd.text.slice(1));
          r.mult.classList.remove('is-pop'); void r.mult.getBoundingClientRect(); r.mult.classList.add('is-pop');
        } else { r.ghost.setAttribute('width', 0); r.mult.textContent = ''; }
        var valText = id === 'logn' ? B.trimNum(B.cls('logn').f(n), 1) : B.formatBig(l);
        r.val.textContent = valText;
        var vx = els.X(Math.min(l, DEC)) + 8, inside = false;
        if (vx + 90 > els.x1) { vx = els.X(Math.min(l, DEC)) - 8; inside = true; }
        V.animate(r.val, { attr: { x: vx } }, { duration: ms, ease: 'out' });
        r.val.setAttribute('text-anchor', inside ? 'end' : 'start');
        r.val.classList.toggle('is-inside', inside);
        var tl = B.log10Work(id, 2 * n) - B.log10Work(id, n);
        r.time.textContent = (els.narrow ? '1 s at n → ' : '') + B.secondsText(tl) + (els.narrow ? ' at 2n' : '');
      });
      nOut.innerHTML = prev !== null ? 'n: ' + B.withCommas(prev) + ' → <b>' + B.withCommas(n) + '</b>' : 'n = <b>' + n + '</b>';
    }
    function set(v) { prev = n; n = v; update(700); }
    fig.querySelector('[data-double]').addEventListener('click', function () { if (n < 4096) set(n * 2); });
    fig.querySelector('[data-halve]').addEventListener('click', function () { if (n > 2) set(n / 2); });
    fig.querySelector('[data-reset]').addEventListener('click', function () { prev = null; n = 8; update(500); });
    void fig2;
  };

  /* ================================================================== keep the biggest term */
  L.constants = function () {
    var fig = V.$('#fig-constants'), stage = fig.querySelector('[data-stage]');
    var a = 3, b = 5, zoom = 10, loglog = false;
    var chart = V.views.chart(stage, { type: 'line', label: 'a·n + b compared with n and n squared' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { ratio: 'Ratio (a·n + b) / n', share: 'Share of + b', cross: 'n² passes a·n + b at' }, states: { ratio: 'active', cross: 'compare' } });
    function show(ms) {
      var cross = (a + Math.sqrt(a * a + 4 * b)) / 2;
      var f = function (x) { return a * x + b; };
      var x = loglog ? { label: 'n (log scale)', scale: 'log', min: 1, max: zoom } : { label: 'n', min: 0, max: zoom };
      var top = Math.max(f(zoom), zoom);
      var y = loglog ? { label: 'steps (log scale)', scale: 'log', min: 1, max: Math.pow(10, Math.ceil(Math.log10(Math.max(zoom * zoom, top)))) } : { label: 'steps', min: 0, max: top * 1.15 };
      chart.render({
        x: x, y: y,
        series: [
          { id: 'f', label: a + 'n + ' + b, fn: f, state: 'active' },
          { id: 'n', label: 'n', fn: function (v) { return v; }, state: 'muted', dashed: true },
          { id: 'n2', label: 'n²', fn: function (v) { return v * v; }, state: 'compare' }
        ],
        annotations: cross <= zoom && cross >= (loglog ? 1 : 0) ? [{ id: 'x', x: cross, text: 'n ≈ ' + B.trimNum(cross, 1), state: 'compare' }] : []
      }, { duration: ms });
      stats.update({ ratio: B.trimNum(f(zoom) / zoom, 3) + ' at n = ' + B.formatCount(zoom), share: (function (v) { return (v === 0 ? '0' : v < 0.01 ? String(+v.toPrecision(2)) : B.trimNum(v, 2)) + ' %'; }(100 * b / f(zoom))), cross: 'n ≈ ' + B.trimNum(cross, 1) });
    }
    V.slider(fig.querySelector('[data-a]'), { label: 'a', min: 1, max: 100, value: a, onInput: function (v) { a = v; show(250); } });
    V.slider(fig.querySelector('[data-b]'), { label: 'b', min: 0, max: 1000, step: 5, value: b, onInput: function (v) { b = v; show(250); } });
    V.segmented(fig.querySelector('[data-zoom]'), { label: 'Zoom out to', value: 10, options: [{ value: 10, label: 'n ≤ 10' }, { value: 100, label: '100' }, { value: 1000, label: '1,000' }, { value: 1e6, label: '10⁶' }],
      onChange: function (v) { zoom = v; show(800); } });
    V.toggle(fig.querySelector('[data-loglog]'), { label: 'Log–log axes', checked: false, onChange: function (c) { loglog = c; show(900); } });
    show(800);
  };

  /* ================================================================== O, Ω, Θ */
  L.bounds = function () {
    var fig = V.$('#fig-bounds'), stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var mode = 'theta', c1 = 0.25, c2 = 1, NMAX = 60;
    function f(n) { return n * n / 2 + 8 * n + 20; }
    var chart = V.views.chart(stage, { type: 'line', label: 'f(n) between two multiples of n squared' });
    function n0Ceil(c) { if (c <= 0.5) return null; var k = c - 0.5, r = (8 + Math.sqrt(64 + 80 * k)) / (2 * k); return Math.max(1, Math.ceil(r - 1e-9)); }
    function lastFloor(c) { if (c <= 0.5) return Infinity; var k = c - 0.5; return Math.floor((8 + Math.sqrt(64 + 80 * k)) / (2 * k) + 1e-9); }
    function show(ms) {
      var series = [{ id: 'f', label: 'f(n)', fn: f, state: 'active' }], ann = [], parts = [];
      var up = mode !== 'omega', down = mode !== 'o';
      if (up) series.push({ id: 'up', label: B.trimNum(c2, 2) + '·n²', fn: function (n) { return c2 * n * n; }, state: 'compare', dashed: true });
      if (down) series.push({ id: 'down', label: B.trimNum(c1, 2) + '·n²', fn: function (n) { return c1 * n * n; }, state: 'done', dashed: true });
      var n0u = up ? n0Ceil(c2) : 1, okDown = !down || c1 <= 0.5;
      if (up) {
        if (n0u === null) parts.push('<b>Ceiling fails:</b> with c₂ = ' + B.trimNum(c2, 2) + ', c₂·n² grows no faster than the n²/2 inside f, so it never gets above f for good. Raise c₂ above ½.');
        else parts.push('<b>Ceiling:</b> f(n) ≤ ' + B.trimNum(c2, 2) + '·n² for every n ≥ ' + n0u + ' (f(' + n0u + ') = ' + B.trimNum(f(n0u), 1) + ', ' + B.trimNum(c2, 2) + '·' + n0u + '² = ' + B.trimNum(c2 * n0u * n0u, 1) + ').');
      }
      if (down) {
        if (okDown) parts.push('<b>Floor:</b> ' + B.trimNum(c1, 2) + '·n² ≤ f(n) for every n ≥ 1, because ' + B.trimNum(c1, 2) + ' ≤ ½.');
        else parts.push('<b>Floor fails:</b> ' + B.trimNum(c1, 2) + '·n² passes f(n) after n = ' + lastFloor(c1) + ' and stays above. Lower c₁ to ½ or less.');
      }
      var n0 = Math.max(up && n0u !== null ? n0u : 1, 1);
      var ok = (!up || n0u !== null) && okDown;
      if (ok && n0 <= NMAX) ann.push({ id: 'n0', x: n0, text: 'n₀ = ' + n0, state: 'pivot' });
      var verdict = !ok ? '' : mode === 'o' ? ' So <b>f(n) = O(n²)</b>.' : mode === 'omega' ? ' So <b>f(n) = Ω(n²)</b>.' : ' Trapped from both sides: <b>f(n) = Θ(n²)</b>.';
      cap.innerHTML = parts.join(' ') + verdict;
      chart.render({ x: { label: 'n', min: 1, max: NMAX }, y: { label: 'steps', min: 0, max: 4000 }, series: series, annotations: ann }, { duration: ms });
      c1s.el.hidden = !down; c2s.el.hidden = !up;
    }
    var c1s = V.slider(fig.querySelector('[data-c1]'), { label: 'c₁ (floor)', min: 0.05, max: 1, step: 0.05, value: c1, format: function (v) { return B.trimNum(v, 2); }, onInput: function (v) { c1 = v; show(200); } });
    var c2s = V.slider(fig.querySelector('[data-c2]'), { label: 'c₂ (ceiling)', min: 0.3, max: 2, step: 0.05, value: c2, format: function (v) { return B.trimNum(v, 2); }, onInput: function (v) { c2 = v; show(200); } });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Bound', value: mode, options: [{ value: 'o', label: 'O: ceiling' }, { value: 'omega', label: 'Ω: floor' }, { value: 'theta', label: 'Θ: both' }],
      onChange: function (v) { mode = v; show(600); } });
    show(800);
  };

  /* ================================================================== best / average / worst */
  L.cases = function () {
    var fig = V.$('#fig-cases');
    var values = [23, 8, 42, 15, 4, 16, 31, 9, 27, 12];
    var mode = 'best', rng = V.rng(7), pos = 0;
    V.legend(fig.querySelector('[data-legend]'), ['compare', { state: 'visited', label: 'Ruled out' }, 'found', { state: 'active', label: 'Comparisons for this case' }]);
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', label: 'Linear search on ten values' });
    var hist = V.views.chart(fig.querySelector('[data-hist]'), { type: 'bar', label: 'Comparisons for every target position', height: 230, valueLabels: true });
    var H = B.searchHistogram(values.length);
    function target() { return mode === 'worst' ? 99 : values[pos]; }
    function showHist(ms) {
      var cat = mode === 'worst' ? '✕' : String(pos);
      hist.render({ categories: H.map(function (x, k) { return k < values.length ? String(k) : '✕'; }),
        series: [{ id: 'c', label: 'comparisons', values: H.map(function (x) { return x.comparisons; }), state: 'active' }],
        y: { label: 'comparisons', min: 0, max: 11 },
        highlight: { category: cat, series: 'c' },
        annotations: [{ id: 'avg', y: 5.5, text: 'average 5.5', state: 'pivot' }]
      }, { duration: ms });
    }
    function steps() { return B.linearSearchSteps(values, target()); }
    var st = steps();
    view.prepare(st.map(function (x) { return x.view; }));
    var player = V.player({ root: fig.querySelector('.cases__scan'), steps: st,
      render: function (x, ctx) { view.render(x.view, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), baseStepMs: 750, label: 'Linear search controls' });
    function reload() { var s2 = steps(); view.reset(); view.prepare(s2.map(function (x) { return x.view; })); player.setSteps(s2); showHist(600); }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Where is the target?', value: mode,
      options: [{ value: 'best', label: 'Front (best)' }, { value: 'random', label: 'Random' }, { value: 'worst', label: 'Missing (worst)' }],
      onChange: function (v) { mode = v; pos = v === 'best' ? 0 : v === 'random' ? rng.int(1, values.length - 1) : pos; reroll.hidden = v !== 'random'; reload(); } });
    var reroll = fig.querySelector('[data-reroll]');
    reroll.hidden = true;
    reroll.addEventListener('click', function () { var p = pos; while (p === pos) p = rng.int(0, values.length - 1); pos = p; reload(); });
    showHist(800);
  };

  /* ================================================================== space */
  L.space = function () {
    var fig = V.$('#fig-space'), host = fig.querySelector('[data-stage]');
    var n = 6, MAXN = 12;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Extra memory in use' }, { state: 'frontier', label: 'Stack frame' }]);
    var P = [
      { id: 'max', title: 'Running maximum', o: '1', unit: function () { return '2 variables'; } },
      { id: 'copy', title: 'Copy of the input', o: 'n', unit: function (n) { return n + ' cells'; } },
      { id: 'rec', title: 'Recursion n calls deep', o: 'n', unit: function (n) { return n + ' frames'; } },
      { id: 'pairs', title: 'Table of all pairs', o: 'n2', unit: function (n) { return (n * n) + ' cells'; } }
    ];
    var S = 150;
    P.forEach(function (p) {
      var cnt = h('span', { class: 'space__count' });
      var svg = svgRoot(S, S, p.title + ': extra memory', 'l05-space');
      var el = h('div', { class: 'space__panel' },
        h('div', { class: 'party__head' }, h('span', { class: 'party__title' }, p.title), h('span', { class: 'big-o', 'data-o': p.o }, B.cls(p.o).o)),
        h('div', { class: 'space__stage stage-grid' }, svg), h('p', { class: 'party__count' }, cnt));
      host.appendChild(el);
      p.svg = svg; p.cnt = cnt; p.cells = [];
    });
    function cell(p, cls, labelText) {
      var g = s('g', { class: 's-cell ' + cls }, s('rect', { x: 0, y: 0, width: 10, height: 10, rx: 2 }));
      if (labelText !== undefined) g.appendChild(text(0, 0, labelText, { class: 's-cell-t', 'text-anchor': 'middle', dy: '.35em' }));
      V.place(g, { x: S / 2, y: S / 2, opacity: 0 });
      p.svg.appendChild(g); p.cells.push(g);
      return g;
    }
    function place(g, x, y, w, hh, on, ms, delay) {
      var r = g.firstChild;
      V.animate(r, { attr: { width: w, height: hh } }, { duration: ms, ease: 'out' });
      if (g.childNodes[1]) V.animate(g.childNodes[1], { attr: { x: w / 2, y: hh / 2 } }, { duration: ms, ease: 'out' });
      V.animate(g, { x: x, y: y, opacity: on ? 1 : 0 }, { duration: ms, ease: 'out', delay: delay || 0 });
    }
    function render(ms) {
      P.forEach(function (p) {
        p.cnt.textContent = p.unit(n);
        if (p.id === 'max') {
          if (!p.cells.length) { cell(p, 'is-key', 'best'); cell(p, 'is-key', 'i'); }
          place(p.cells[0], S / 2 - 48, S / 2 - 18, 44, 36, true, ms); place(p.cells[1], S / 2 + 4, S / 2 - 18, 44, 36, true, ms);
        } else if (p.id === 'copy') {
          while (p.cells.length < MAXN) cell(p, 'is-key');
          var perRow = 6, cw = (S - 16) / perRow;
          p.cells.forEach(function (g, k) { place(g, 8 + (k % perRow) * cw, 40 + Math.floor(k / perRow) * (cw + 6), cw - 4, cw - 4, k < n, ms, k >= n ? 0 : 20 * k); });
        } else if (p.id === 'rec') {
          while (p.cells.length < MAXN) cell(p, 'is-frontier', 'sum(' + (MAXN - p.cells.length) + ')');
          var fh = (S - 14) / MAXN;
          // frames stack from the bottom: the outermost call sum(n) at the bottom, the deepest on top
          p.cells.forEach(function (g, k) {
            var depth = k - (MAXN - n);            // cells hold sum(12) … sum(1); only the last n are live
            var live = depth >= 0, yy = S - 8 - (live ? depth + 1 : 0) * fh;
            g.childNodes[1].textContent = live ? 'sum(' + (n - depth) + ')' : '';
            place(g, 28, yy, S - 56, fh - 2, live, ms, live ? depth * 25 : 0);
          });
        } else {
          while (p.cells.length < MAXN * MAXN) cell(p, 'is-key');
          var c = Math.min(22, (S - 12) / n), off = (S - c * n) / 2;
          p.cells.forEach(function (g, k) {
            var i = Math.floor(k / MAXN), j = k % MAXN, on = i < n && j < n;
            place(g, off + Math.min(j, n - 1) * c, off + Math.min(i, n - 1) * c, Math.max(1, c - 1.5), Math.max(1, c - 1.5), on, ms);
          });
        }
      });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 1, max: MAXN, value: n, onInput: function (v) { n = v; render(450); } });
    render(0);
  };
}());
