/* Lesson template wiring. Copy to js/lessons/NN-slug.js and replace the find-max example.

   Every lesson script has the same three parts:
     1. Pure step generators. No DOM. They turn an input into an array of snapshot steps.
        Real lessons put them in js/algos/<name>.js (UMD, registered on VDSA.algos) and test them in Node.
     2. Renderers. Real lessons use VDSA.views.* (docs/ENGINE.md → "Renderers (views)").
        This template draws its own tiny SVGs with VDSA.s + VDSA.animate so it has no renderer dependency,
        and to show the rule every renderer follows: keep elements alive between steps and MOVE them.
     3. Figures. One small function per figure, all started from VDSA.ready at the bottom.

   Step objects (docs/ENGINE.md → "Step conventions"):
     caption  plain-English reason for the step (inline HTML allowed; escape user text with VDSA.escape)
     line     code label ('cmp') highlighted in every language of the code panel
     vars     {name: value} shown in the variable watch (key order preserved)
     counters {comparisons: 3, updates: 1} shown as stat chips
     flow     flowchart node id lit during the trace
     …plus whatever state the renderer needs (here: values, i, best, scanned, states). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;

  /* ================================================================== 1. Pure step generator */
  /* findMaxSteps([5, 3, 9]) -> steps. Truthful on empty, single, duplicate and sorted inputs:
     the comparison is strict, so the FIRST copy of a repeated maximum is the one reported. */
  function findMaxSteps(input) {
    var a = input.slice(), n = a.length, steps = [];
    var cmp = 0, upd = 0, best = 0;
    function states(i, phase) {
      return a.map(function (_, k) {
        if (phase === 'done') return k === best ? 'found' : 'visited';
        if (k === best) return 'key';
        if (phase === 'cmp' && k === i) return 'compare';
        if (i !== null && k <= i) return 'visited';
        return 'default';
      });
    }
    function snap(kind, i, scanned, caption, line, flow, vars) {
      steps.push({ kind: kind, values: a, i: i, best: n ? best : null, scanned: scanned, states: states(i, kind),
        caption: caption, line: line, flow: flow, vars: vars, counters: { comparisons: cmp, updates: upd } });
    }
    if (!n) {
      snap('empty', null, 0, 'The list is empty, so there is no maximum to report. Real code must choose: return nothing, or raise an error.', null, 'init', {});
      return steps;
    }
    snap('init', null, 1, 'Hold the first value: <b>best = ' + a[0] + '</b>. Nothing else has been scanned, so it is the largest value <em>so far</em>.', 'init', 'init', { best: a[0] });
    for (var i = 1; i < n; i++) {
      cmp++;
      snap('cmp', i, i, 'Compare <b>a[' + i + '] = ' + a[i] + '</b> with <b>best = ' + a[best] + '</b>.', 'cmp', 'cmp', { best: a[best], i: i, 'a[i]': a[i] });
      if (a[i] > a[best]) {
        var old = a[best];
        best = i; upd++;
        snap('update', i, i + 1, a[i] + ' &gt; ' + old + ', so <b>' + a[i] + '</b> becomes the new best. The marker slides to index ' + i + '.', 'update', 'update', { best: a[i], i: i, 'a[i]': a[i] });
      } else {
        var why = a[i] === a[best]
          ? a[i] + ' equals best. Only a <em>strictly</em> larger value replaces it, so the first ' + a[best] + ' stays.'
          : a[i] + ' &lt; ' + a[best] + ', so best stays ' + a[best] + ' and the scan moves on.';
        snap('keep', i, i + 1, why, 'loop', 'inc', { best: a[best], i: i, 'a[i]': a[i] });
      }
    }
    snap('done', null, n, n === 1
      ? 'Only one value, so it is the maximum, found with zero comparisons.'
      : 'No values left. The scanned region is the whole list, so <b>best = ' + a[best] + '</b> is the maximum: ' + cmp + ' comparisons, ' + upd + ' update' + (upd === 1 ? '' : 's') + '.',
    'ret', 'ret', { best: a[best], i: n });
    return steps;
  }

  /* ================================================================== 2. Renderers */

  /* scanView(stage) -> render(step, ctx). Cells, a sliding "best" tag, a sliding i pointer and the scanned region.
     Identity: one <g> per cell, built once per input; the tag and pointer are single elements that MOVE. */
  function scanView(stage, opts) {
    opts = opts || {};
    var P = 64, C = 52, PAD = 22, TOP = 58;
    var svg = null, cells = [], tag, ptr, region, regionRect, n = -1, values = null, showRegion = opts.region !== false, last = null;
    function cx(k) { return PAD + k * P + C / 2; }
    function build(vals) {
      V.clear(stage);
      values = vals; n = vals.length;
      var W = Math.max(PAD * 2 + n * P - (P - C), 280), H = TOP + C + 80;
      svg = s('svg', { class: 'tp', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Array of ' + n + ' values: ' + vals.join(', ') });
      svg.style.maxWidth = (W * 1.25) + 'px';
      regionRect = s('rect', { x: PAD - 7, y: TOP - 7, height: C + 14, width: 0, rx: 14 });
      region = s('g', { class: 'region' }, regionRect, s('text', { x: PAD - 5, y: TOP + C + 72 }, 'scanned: all ≤ best'));
      svg.appendChild(region);
      cells = vals.map(function (v, k) {
        var g = s('g', { class: 'cell' },
          s('rect', { width: C, height: C, rx: 11 }),
          s('text', { class: 'val', x: C / 2, y: C / 2 + 1 }, v),
          s('text', { class: 'idx', x: C / 2, y: C + 17 }, k));
        V.place(g, { x: PAD + k * P, y: TOP });
        svg.appendChild(g);
        return g;
      });
      tag = s('g', { class: 'tag' }, s('rect', { x: -24, y: -34, width: 48, height: 22, rx: 11 }), s('text', { x: 0, y: -23 }, 'best'), s('path', { d: 'M-6 -12.5 L6 -12.5 L0 -5 Z' }));
      ptr = s('g', { class: 'ptr' }, s('path', { d: 'M0 0 L-7 11 L7 11 Z' }), s('text', { x: 0, y: 27 }, 'i'));
      svg.appendChild(tag); svg.appendChild(ptr);
      V.place(tag, { x: cx(0), y: TOP - 2, opacity: 0 });
      V.place(ptr, { x: cx(0), y: TOP + C + 24, opacity: 0 });
      stage.appendChild(svg);
    }
    function render(step, ctx) {
      last = step;
      if (!step.values.length) { V.clear(stage); svg = null; stage.appendChild(h('p', { class: 'muted' }, 'Empty list: nothing to scan.')); return; }
      if (!svg || step.values !== values) build(step.values);
      var d = ctx.duration;
      svg.style.setProperty('--t', d + 'ms');                       // CSS colour transitions follow the player
      cells.forEach(function (g, k) { g.setAttribute('class', 'cell is-' + (step.states[k] || 'default')); });
      if (step.best !== null) V.animate(tag, { x: cx(step.best), opacity: 1 }, { duration: d, ease: 'out' });
      if (step.i !== null) V.animate(ptr, { x: cx(step.i), opacity: 1 }, { duration: d, ease: 'out' });
      else V.animate(ptr, { opacity: 0 }, { duration: d });
      var w = step.scanned ? step.scanned * P - (P - C) + 14 : 0;
      V.animate(regionRect, { attr: { width: w } }, { duration: d, ease: 'out' });
      region.style.opacity = showRegion ? '1' : '0';
    }
    render.setRegion = function (on) { showRegion = on; if (region) region.style.opacity = on ? '1' : '0'; };
    return render;
  }

  /* barsView(stage) -> render(step, ctx). For the hero teaser: bars plus a dashed "best" level that rises. */
  function barsView(stage) {
    var W = 400, H = 320, L = 26, R = 26, T = 54, B = 34, GAP = 10, MAXV = 100;
    var svg = null, bars = [], level, levelText, ptr, n = -1;
    function geom(k, v) { var bw = (W - L - R - GAP * (n - 1)) / n; var hh = (H - T - B) * v / MAXV; return { x: L + k * (bw + GAP), w: bw, y: H - B - hh, h: hh }; }
    function build(vals) {
      V.clear(stage); n = vals.length;
      svg = s('svg', { class: 'tp', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
      bars = vals.map(function (v, k) { var g = geom(k, v); var r = s('rect', { class: 'bar', x: g.x, y: g.y, width: g.w, height: g.h, rx: 6 }); svg.appendChild(r); return r; });
      levelText = s('tspan', { class: 'v', dx: 8 }, '');
      svg.appendChild(s('text', { class: 'readout', x: L, y: 30 }, 'best so far', levelText));
      level = s('g', { class: 'level' }, s('line', { x1: L - 10, x2: W - R + 10, y1: 0, y2: 0 }));
      ptr = s('path', { class: 'ptr', d: 'M0 0 L-7 11 L7 11 Z', style: 'fill: var(--st-compare)' });
      svg.appendChild(level); svg.appendChild(ptr);
      V.place(level, { y: H - B, opacity: 0 }); V.place(ptr, { x: 0, y: H - B + 10, opacity: 0 });
      stage.appendChild(svg);
    }
    return function render(step, ctx) {
      if (!svg || step.values.length !== n) build(step.values);
      var d = ctx.duration;
      svg.style.setProperty('--t', d + 'ms');
      step.values.forEach(function (v, k) {
        var g = geom(k, v);
        bars[k].setAttribute('class', 'bar is-' + step.states[k]);
        V.animate(bars[k], { attr: { y: g.y, height: g.h } }, { duration: d, ease: 'inOut' });   // morphs to new data on loop
      });
      if (step.best !== null) {
        var bg = geom(step.best, step.values[step.best]);
        levelText.textContent = step.values[step.best];
        V.animate(level, { y: bg.y, opacity: 1 }, { duration: d, ease: 'out' });
      }
      if (step.i !== null) { var pg = geom(step.i, 0); V.animate(ptr, { x: pg.x + pg.w / 2, opacity: 1 }, { duration: d, ease: 'out' }); }
      else V.animate(ptr, { opacity: 0 }, { duration: d });
    };
  }

  /* miniCells(values, states, {size, pitch, index, ids, tags: [{at, text}], label}) -> static <svg> */
  function miniCells(values, states, o) {
    o = o || {};
    var C = o.size || 34, P = o.pitch || (C + 8), PAD = 8, TOP = o.tags ? 34 : 8;
    var W = PAD * 2 + values.length * P - (P - C), H = TOP + C + (o.index ? 22 : 8);
    var svg = s('svg', { class: 'tp', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Values ' + values.join(', ')) });
    svg.style.maxWidth = (W * (o.scale || 1.4)) + 'px';
    values.forEach(function (v, k) {
      var g = s('g', { class: 'cell is-' + ((states && states[k]) || 'default'), transform: 'translate(' + (PAD + k * P) + ' ' + TOP + ')',
          'data-id': o.ids ? String(k) : null, 'data-label': o.ids ? (o.idLabel ? o.idLabel(v, k) : 'Value ' + v) : null },
        s('rect', { width: C, height: C, rx: Math.round(C / 4.5) }),
        s('text', { class: 'val', x: C / 2, y: C / 2 + 1, style: 'font-size:' + Math.round(C * 0.4) + 'px' }, v));
      if (o.index) g.appendChild(s('text', { class: 'idx', x: C / 2, y: C + 16 }, k));
      svg.appendChild(g);
    });
    (o.tags || []).forEach(function (t) {
      var x = PAD + t.at * P + C / 2, w = Math.max(40, t.text.length * 7.5 + 16);
      svg.appendChild(s('g', { class: 'tag', transform: 'translate(' + x + ' ' + (TOP - 2) + ')' },
        s('rect', { x: -w / 2, y: -30, width: w, height: 20, rx: 10 }), s('text', { x: 0, y: -20, style: 'font-size:11px' }, t.text), s('path', { d: 'M-5 -10.5 L5 -10.5 L0 -4 Z' })));
    });
    return svg;
  }

  /* flowView(stage) -> {highlight(id)} — a hand-laid flowchart. Real lessons: VDSA.views.flowchart.
     The player calls highlight(step.flow) because the lab passes this object as its `flow` option. */
  function flowView(stage) {
    var nodes = [
      { id: 'init', shape: 'proc', x: 95, y: 90, w: 150, h: 54, label: ['best ← a[0]', 'i ← 1'] },
      { id: 'loop', shape: 'dec', x: 300, y: 90, w: 150, h: 86, label: ['i < n ?'] },
      { id: 'cmp', shape: 'dec', x: 510, y: 90, w: 176, h: 92, label: ['a[i] > best ?'] },
      { id: 'update', shape: 'proc', x: 715, y: 90, w: 140, h: 50, label: ['best ← a[i]'] },
      { id: 'inc', shape: 'proc', x: 510, y: 238, w: 140, h: 50, label: ['i ← i + 1'] },
      { id: 'ret', shape: 'term', x: 95, y: 238, w: 150, h: 50, label: ['return best'] }
    ];
    var edges = [
      { from: 'init', to: 'loop', d: 'M170 90 H221' },
      { from: 'loop', to: 'cmp', d: 'M375 90 H418', label: 'yes', lx: 384, ly: 80 },
      { from: 'cmp', to: 'update', d: 'M598 90 H641', label: 'yes', lx: 606, ly: 80 },
      { from: 'cmp', to: 'inc', d: 'M510 136 V209', label: 'no', lx: 518, ly: 178 },
      { from: 'update', to: 'inc', d: 'M715 115 V238 H584' },
      { from: 'inc', to: 'loop', d: 'M440 238 H346 V124' },
      { from: 'loop', to: 'ret', d: 'M300 133 V238 H174', label: 'no', lx: 308, ly: 178 }
    ];
    var svg = s('svg', { class: 'tp', viewBox: '0 0 800 290', role: 'img', 'aria-label': 'Flowchart of find-max' });
    svg.style.maxWidth = '860px';
    var defs = s('defs');
    function marker(id, color) {
      return s('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
        s('path', { d: 'M0 0 L10 5 L0 10 z', style: 'fill:' + color }));
    }
    var mid = V.uid('fa');
    defs.appendChild(marker(mid, 'var(--el-edge)')); defs.appendChild(marker(mid + 'a', 'var(--st-active)'));
    svg.appendChild(defs);
    var edgeEls = edges.map(function (e) {
      var g = s('g', { class: 'edge' }, s('path', { d: e.d, 'marker-end': 'url(#' + mid + ')' }));
      if (e.label) g.appendChild(s('text', { x: e.lx, y: e.ly }, e.label));
      svg.appendChild(g); e.el = g; return g;
    });
    var nodeEls = {};
    nodes.forEach(function (n) {
      var shape;
      if (n.shape === 'dec') shape = s('polygon', { points: [[0, -n.h / 2], [n.w / 2, 0], [0, n.h / 2], [-n.w / 2, 0]].map(function (p) { return p.join(','); }).join(' ') });
      else shape = s('rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: n.shape === 'term' ? n.h / 2 : 10 });
      var g = s('g', { class: 'node', transform: 'translate(' + n.x + ' ' + n.y + ')' }, shape);
      n.label.forEach(function (line, k) { g.appendChild(s('text', { x: 0, y: (k - (n.label.length - 1) / 2) * 19 }, line)); });
      svg.appendChild(g); nodeEls[n.id] = g;
    });
    stage.appendChild(svg);
    var current = null;
    return {
      highlight: function (id, ctx) {
        svg.style.setProperty('--t', (ctx ? ctx.duration : 0) + 'ms');
        Object.keys(nodeEls).forEach(function (k) { nodeEls[k].setAttribute('class', 'node' + (k === id ? ' is-active' : '')); });
        edges.forEach(function (e) {
          var on = current && id && e.from === current && e.to === id;
          e.el.setAttribute('class', 'edge' + (on ? ' is-active' : ''));
          e.el.firstChild.setAttribute('marker-end', 'url(#' + mid + (on ? 'a' : '') + ')');
        });
        current = id;
      }
    };
  }

  /* costChart(stage) -> {set(n, kase)} — comparisons (n − 1) vs updates for a case, with a cursor at n.
     Real lessons: VDSA.views.chart. Shows how to tween a path between two data series with VDSA.tween. */
  function costChart(stage) {
    var W = 660, H = 300, ML = 44, MR = 110, MT = 16, MB = 36, NMAX = 64;
    function X(n) { return ML + (n - 1) / (NMAX - 1) * (W - ML - MR); }
    function Y(v) { return H - MB - v / NMAX * (H - MT - MB); }
    function harmonic(n) { var t = 0; for (var k = 1; k <= n; k++) t += 1 / k; return t; }
    function series(kase) { var out = []; for (var n = 1; n <= NMAX; n++) out.push(kase === 'worst' ? n - 1 : kase === 'best' ? 0 : harmonic(n) - 1); return out; }
    function path(ys) { return ys.map(function (y, i) { return (i ? 'L' : 'M') + X(i + 1).toFixed(1) + ' ' + Y(y).toFixed(1); }).join(' '); }
    var svg = s('svg', { class: 'tp', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Line chart of comparisons and updates against list length' });
    svg.style.maxWidth = '780px';
    var grid = s('g', { class: 'grid' }), axis = s('g', { class: 'axis' });
    [0, 16, 32, 48, 64].forEach(function (v) {
      grid.appendChild(s('line', { x1: ML, x2: W - MR, y1: Y(v), y2: Y(v) }));
      axis.appendChild(s('text', { x: ML - 8, y: Y(v) + 4, 'text-anchor': 'end' }, v));
    });
    [1, 16, 32, 48, 64].forEach(function (n) { axis.appendChild(s('text', { x: X(n), y: H - MB + 18, 'text-anchor': 'middle' }, n)); });
    axis.appendChild(s('text', { x: W - MR, y: H - 2, 'text-anchor': 'end', style: 'font-family: var(--font-sans)' }, 'list length n'));
    axis.appendChild(s('path', { d: 'M' + ML + ' ' + MT + ' V' + (H - MB) + ' H' + (W - MR), fill: 'none' }));
    var cmpPath = s('path', { class: 'series-cmp', d: path(series('worst')) });
    var updPath = s('path', { class: 'series-upd' });
    var cmpLbl = s('text', { class: 'lbl', x: X(NMAX) + 8, y: Y(63) + 4, style: 'fill: var(--ink-2)' }, 'comparisons');
    var updLbl = s('text', { class: 'lbl', x: X(NMAX) + 8, y: 0, style: 'fill: color-mix(in srgb, var(--st-key) 75%, var(--ink))' }, 'updates');
    var cursor = s('g', { class: 'cursor' }, s('line', { x1: 0, x2: 0, y1: MT, y2: H - MB }),
      s('circle', { class: 'c-cmp', r: 5, cx: 0, cy: 0, style: 'fill: var(--ink-3)' }), s('circle', { class: 'c-upd', r: 6, cx: 0, cy: 0, style: 'fill: var(--st-key)' }));
    [grid, axis, cmpPath, updPath, cmpLbl, updLbl, cursor].forEach(function (el) { svg.appendChild(el); });
    stage.appendChild(svg);
    var ys = null, kase = null, n = 16, tw = null;
    function place(dur) {
      var cy = ys[n - 1];
      V.animate(cursor, { x: X(n) }, { duration: dur, ease: 'out' });
      V.animate(cursor.querySelector('.c-cmp'), { attr: { cy: Y(n - 1) } }, { duration: dur, ease: 'out' });
      V.animate(cursor.querySelector('.c-upd'), { attr: { cy: Y(cy) } }, { duration: dur, ease: 'out' });
      V.animate(updLbl, { attr: { y: Y(ys[NMAX - 1]) + (kase === 'worst' ? 18 : 4) } }, { duration: dur, ease: 'out' });
    }
    return {
      harmonic: harmonic,
      set: function (newN, newCase, dur) {
        dur = dur === undefined ? 450 : dur;
        n = newN;
        if (newCase !== kase) {
          var from = ys || series(newCase), to = series(newCase);
          kase = newCase;
          if (tw) tw.cancel();
          tw = V.tween(V.dur(dur), function (t, e) {
            ys = from.map(function (y, i) { return y + (to[i] - y) * e; });
            updPath.setAttribute('d', path(ys));
          });
          ys = ys || to;
          tw.promise.then(function () { ys = to; place(0); });
        }
        place(dur);
      }
    };
  }

  /* ================================================================== 3. Figures */
  var DEFAULT_INPUT = [5, 3, 9, 2, 9, 12, 4, 7];

  /* Shared code for the lab. Trailing // @label comments tie lines together across languages. */
  var CODE = {
    pseudo: [
      'function findMax(a)',
      '  best ← a[0]                   // @init',
      '  for i ← 1 to length(a) − 1     // @loop',
      '    if a[i] > best then          // @cmp',
      '      best ← a[i]               // @update',
      '  return best                    // @ret'
    ].join('\n'),
    js: [
      'function findMax(a) {',
      '  let best = a[0];                        // @init',
      '  for (let i = 1; i < a.length; i++) {    // @loop',
      '    if (a[i] > best) {                    // @cmp',
      '      best = a[i];                        // @update',
      '    }',
      '  }',
      '  return best;                            // @ret',
      '}'
    ].join('\n'),
    py: [
      'def find_max(a):',
      '    best = a[0]                  # @init',
      '    for i in range(1, len(a)):   # @loop',
      '        if a[i] > best:          # @cmp',
      '            best = a[i]          # @update',
      '    return best                  # @ret'
    ].join('\n')
  };

  /* Hero teaser: controller-less loop, new random data each lap, static frame under reduced motion. */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var rng = V.rng(7);
    function data() { return findMaxSteps(V.presets.random(9, { min: 18, max: 96, rng: rng })); }
    V.teaser(stage, { steps: data(), render: barsView(stage), stepMs: 700, holdMs: 1600, regenerate: data });
  }

  /* The problem: a static figure plus a click quiz on it. */
  function problemFigure() {
    var fig = V.$('#fig-problem');
    var temps = [14, 17, 21, 19, 24, 22, 18, 15];
    var stage = fig.querySelector('[data-stage]');
    stage.appendChild(miniCells(temps, null, { size: 52, pitch: 62, index: true, ids: true, scale: 1.25,
      idLabel: function (v, k) { return 'Hour ' + k + ': ' + v + ' degrees'; }, label: 'Eight temperature readings' }));
    V.clickQuiz(stage, {
      el: '#quiz-problem',
      question: 'Click the highest reading.',
      answer: String(temps.indexOf(Math.max.apply(null, temps))),
      right: '24 °C is the high. To be sure, you had to look at all eight readings: skipping any one could hide a higher value.',
      wrong: 'There is a higher reading. Scan left to right and keep the largest you have seen.'
    });
  }

  /* Intuition: a row of mini figures, one per idea. */
  function intuitionMinis() {
    var row = V.$('#mini-intuition');
    var items = [
      { vals: [5, 3, 9, 2], st: ['key'], tags: [{ at: 0, text: 'best' }], cap: '<b>Hold</b> the first value.' },
      { vals: [5, 3, 9, 2], st: ['key', 'compare'], tags: [{ at: 0, text: 'best' }], cap: '<b>Compare</b> each newcomer once.' },
      { vals: [5, 3, 9, 2], st: ['visited', 'visited', 'key'], tags: [{ at: 2, text: 'best' }], cap: '<b>Replace</b> only if strictly larger.' }
    ];
    items.forEach(function (it) {
      var stage = h('div', { class: 'mini__stage' }, miniCells(it.vals, it.st, { tags: it.tags }));
      row.appendChild(h('figure', { class: 'mini' }, stage, h('figcaption', { html: it.cap })));
    });
  }

  /* Mechanism: a small steppable figure (player without a code panel) with a toggle in the header. */
  function invariantFigure() {
    var fig = V.$('#fig-invariant');
    var render = scanView(fig.querySelector('[data-stage]'));
    V.player({ root: fig, steps: findMaxSteps([4, 8, 3, 8, 11, 6]), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100 });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show scanned region', checked: true, onChange: render.setRegion });
  }

  /* The lab: input row + presets, player, code panel, variable watch, counters, legend, checkpoint, flowchart sync. */
  function lab() {
    var fig = V.$('#lab-fig');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'compare', label: 'Comparing a[i]' },
      { state: 'key', label: 'best so far' },
      { state: 'visited', label: 'Scanned' },
      { state: 'found', label: 'Maximum' }
    ]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'pseudo' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { best: 'key', i: 'compare', 'a[i]': 'compare' } });
    var flowFig = V.$('#fig-flow');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }]);
    var flow = flowView(flowFig.querySelector('[data-stage]'));

    var player = V.player({
      root: fig,
      steps: findMaxSteps(DEFAULT_INPUT),
      render: scanView(fig.querySelector('[data-stage]')),
      code: code,
      vars: vars,
      flow: flow,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      baseStepMs: 1000
    });

    // Predict-before-reveal: stop before the first "update" step and ask what happens.
    player.addCheckpoint(
      function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'update') return k; return -1; },
      function (c) {
        var p = c.prev, x = p.values[p.i], b = p.values[p.best];
        return {
          question: '<code>a[' + p.i + '] = ' + x + '</code> and <code>best = ' + b + '</code>. What happens next?',
          options: ['best becomes ' + x, 'best stays ' + b, 'The scan stops: ' + x + ' must be the maximum'],
          answer: 0,
          explain: [x + ' is larger than ' + b + ', so the rule replaces best, and the scanned region grows by one.',
            'best only stays when the new value is not larger. ' + x + ' is larger.',
            'The scan never stops early. A later value could be larger still, so every value must be checked.']
        };
      },
      { id: 'lab-predict-update' });

    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (up to 12)',
      value: DEFAULT_INPUT,
      parse: { min: -99, max: 99, maxCount: 12, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(8, { min: 1, max: 60 }); } },
        { label: 'Ascending (worst)', value: function () { return V.presets.sorted(8, { min: 1, max: 40 }); } },
        { label: 'Descending (best)', value: function () { return V.presets.reversed(8, { min: 1, max: 40 }); } },
        { label: 'Duplicates', value: [7, 3, 7, 1, 7, 2] },
        { label: 'One value', value: [42] }
      ],
      onApply: function (values) { player.setSteps(findMaxSteps(values)); }
    });
  }

  /* Cost: segmented control + slider drive a chart and stat chips. */
  function costFigure() {
    var fig = V.$('#fig-cost');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', shape: 'line', label: 'Updates (best = a[i])' },
      { state: 'muted', shape: 'dash', label: 'Comparisons (a[i] > best)', color: 'var(--ink-3)' }
    ]);
    var chart = costChart(fig.querySelector('[data-stage]'));
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'List length n', cmp: 'Comparisons', upd: 'Updates' }, states: { upd: 'key' } });
    var kase = 'average', n = 16;
    function update(dur) {
      chart.set(n, kase, dur);
      var upd = kase === 'worst' ? n - 1 : kase === 'best' ? 0 : chart.harmonic(n) - 1;
      stats.update({ n: n, cmp: n - 1, upd: kase === 'average' ? '≈ ' + upd.toFixed(2) : upd });
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input order',
      options: [{ value: 'best', label: 'Best case' }, { value: 'average', label: 'Average' }, { value: 'worst', label: 'Worst case' }],
      value: kase,
      onChange: function (v) { kase = v; update(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: 64, value: n, onInput: function (v) { n = v; update(120); } });
    update(0);
  }

  /* Variations: tabs with a mini picture and a static code block each. */
  function variations() {
    V.tabs('#variants');
    var minis = {
      min: miniCells([5, 3, 9, 2, 6], ['visited', 'visited', 'visited', 'found', 'visited'], { tags: [{ at: 3, text: 'min' }] }),
      argmax: miniCells([5, 3, 9, 2, 6], ['visited', 'visited', 'found', 'visited', 'visited'], { index: true, tags: [{ at: 2, text: 'index 2' }] }),
      top2: miniCells([5, 3, 9, 2, 6], ['visited', 'visited', 'found', 'visited', 'key'], { tags: [{ at: 2, text: '1st' }, { at: 4, text: '2nd' }] })
    };
    var blocks = {
      min: 'let best = a[0];\nfor (let i = 1; i < a.length; i++)\n  if (a[i] < best) best = a[i];',
      argmax: 'let bestIndex = 0;\nfor (let i = 1; i < a.length; i++)\n  if (a[i] > a[bestIndex]) bestIndex = i;',
      top2: 'let first = -Infinity, second = -Infinity;\nfor (const x of a) {\n  if (x > first) { second = first; first = x; }\n  else if (x > second && x < first) second = x;\n}'
    };
    Object.keys(minis).forEach(function (k) {
      V.$('[data-mini="' + k + '"]').appendChild(minis[k]);
      V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js');
    });
  }

  /* Check yourself: a single-answer and a multi-answer quiz. */
  function checks() {
    V.quiz('#quiz-count', {
      question: 'How many comparisons does find-max make on a list of <em>n</em> values?',
      options: ['n − 1', 'n', 'About n / 2 on average', 'n log n'],
      answer: 0,
      explain: [
        'Every value except the first is compared with best exactly once, whatever the order.',
        'The first value is never compared: it starts as best.',
        'The scan cannot stop early, so the count never depends on the order.',
        'There is no halving or sorting here: one comparison per value.'
      ]
    });
    V.quiz('#quiz-updates', {
      question: 'Which inputs make <code>best</code> change at <em>every</em> comparison?',
      options: ['<code>1, 2, 3, 4</code>', '<code>4, 3, 2, 1</code>', '<code>2, 2, 2, 2</code>', '<code>−5, −3, 0, 8</code>'],
      answer: [0, 3],
      explain: 'best changes only when a value is strictly larger than every value before it, so the input must be strictly increasing. Negative numbers are fine; equal values never cause an update.'
    });
  }

  /* Summary card tiles: tiny picture, label, one line. */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: miniCells([5, 3, 9], ['key'], { tags: [{ at: 0, text: 'best' }], size: 28 }), label: 'Hold one value', text: 'Start with best = a[0].' },
      { svg: miniCells([5, 3, 9], ['key', 'compare'], { tags: [{ at: 1, text: 'a[i]' }], size: 28 }), label: 'Compare each once', text: 'n − 1 comparisons, in every case.' },
      { svg: miniCells([5, 5, 9], ['key', 'visited', 'default'], { tags: [{ at: 0, text: 'best' }], size: 28 }), label: 'Strictly larger wins', text: 'Equal values keep the first copy.' },
      { svg: miniCells([2, 5, 9], ['visited', 'visited', 'found'], { tags: [{ at: 2, text: 'max' }], size: 28 }), label: 'The invariant finishes it', text: 'Scanned everything, so best is the max.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    heroTeaser();
    problemFigure();
    intuitionMinis();
    invariantFigure();
    lab();
    costFigure();
    variations();
    checks();
    summaryCard();
  });

  // Exposed for tests and for the browser console while authoring.
  V.lessons = V.lessons || {};
  V.lessons.template = { findMaxSteps: findMaxSteps };
}());
