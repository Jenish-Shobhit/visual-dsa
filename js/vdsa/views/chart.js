/* VDSA.views.chart(container, options) — line, bar and scatter charts for growth curves, operation counts and
   races. Minimal by design: thin gridlines, quiet axes, direct labels at line ends, one accent per series.

   const chart = VDSA.views.chart('#growth', { type: 'line' });
   chart.render({
     x: { label: 'n', min: 1, max: 64 },
     y: { label: 'steps', max: 1000, scale: 'linear' },            // scale: 'linear' | 'log'
     series: [
       { id: 'n',  label: 'n',  fn: n => n },                       // function series are sampled
       { id: 'n2', label: 'n²', fn: n => n * n },
       { id: 'bubble', label: 'bubble sort', points: [[8, 28], [16, 120], [32, 496]], markers: true }
     ],
     highlight: { series: 'bubble', x: 16 },                         // ringed point + value label
     annotations: [{ x: 32, text: 'n = 32' }, { y: 500, text: 'budget', state: 'error' }]
   }, { duration: ctx.duration });

   Bar:     { categories: ['bubble', 'insertion'], series: [{ id: 'cmp', label: 'comparisons', values: [45, 30] }, ...] }
   Scatter: { series: [{ id: 'runs', label: 'runtime', points: [[x, y], ...] }] }
   Switching y.scale between 'linear' and 'log' morphs lines and ticks. Hover (or focus + arrow keys) shows a
   crosshair with every series' value. Full schema: docs/ENGINE.md -> "Renderers (views)" -> chart.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure helpers (Node-testable) */
  var L = {};
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sup(n) { return String(n).split('').map(function (c) { return SUP[c] || c; }).join(''); }
  function trim(v, d) { return String(parseFloat(v.toFixed(d === undefined ? 2 : d))); }

  /* Nice 1-2-5 number near `range` (Heckbert). */
  L.niceNum = function (range, round) {
    if (!(range > 0) || !isFinite(range)) return 1;
    var exp = Math.floor(Math.log10(range)), f = range / Math.pow(10, exp), nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  };
  /* Ticks on 1-2-5 steps covering [min, max]. Returns {min, max, step, ticks} with the domain widened to whole steps.
     Handles negatives, zero-width ranges and tiny ranges (float noise is rounded away). */
  L.niceTicks = function (min, max, count) {
    count = count || 5;
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min > max) { var t = min; min = max; max = t; }
    if (min === max) { var pad = min === 0 ? 1 : Math.abs(min) * 0.5; min -= pad; max += pad; }
    var step = L.niceNum((max - min) / Math.max(1, count - 1), true);
    var decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    var lo = +(Math.floor(min / step + 1e-9) * step).toFixed(decimals), hi = +(Math.ceil(max / step - 1e-9) * step).toFixed(decimals);
    var ticks = [];
    for (var i = 0, v = lo; v <= hi + step * 1e-6 && i < 1000; i++, v = lo + i * step) ticks.push(+v.toFixed(decimals));
    return { min: lo, max: hi, step: step, ticks: ticks };
  };
  /* Decade ticks for a log axis. Returns {min, max, major:[10^k], minor:[2..9 x 10^k], labelEvery}. */
  L.logTicks = function (min, max) {
    if (!(min > 0)) min = 1;
    if (!(max > min)) max = min * 10;
    var lo = Math.floor(Math.log10(min) + 1e-9), hi = Math.ceil(Math.log10(max) - 1e-9);
    if (hi <= lo) hi = lo + 1;
    var major = [], minor = [];
    for (var k = lo; k <= hi; k++) {
      major.push(+Math.pow(10, k).toPrecision(12));
      if (k < hi) for (var m = 2; m <= 9; m++) minor.push(+(m * Math.pow(10, k)).toPrecision(12));
    }
    var decades = hi - lo;
    return { min: Math.pow(10, lo), max: Math.pow(10, hi), major: major, minor: decades <= 6 ? minor : [], labelEvery: decades > 12 ? 3 : decades > 7 ? 2 : 1 };
  };
  L.scaleLinear = function (d0, d1, r0, r1) {
    var k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
    var f = function (v) { return r0 + (v - d0) * k; };
    f.invert = function (p) { return k === 0 ? d0 : d0 + (p - r0) / k; };
    f.type = 'linear'; f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  };
  L.scaleLog = function (d0, d1, r0, r1) {
    var l0 = Math.log10(d0), l1 = Math.log10(d1), k = l1 === l0 ? 0 : (r1 - r0) / (l1 - l0);
    var f = function (v) { return v > 0 ? r0 + (Math.log10(v) - l0) * k : NaN; };
    f.invert = function (p) { return Math.pow(10, k === 0 ? l0 : l0 + (p - r0) / k); };
    f.type = 'log'; f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  };
  /* Compact, readable tick labels: 0, 2.5, 500, 1k, 1.5k, 20M, 3B, 10¹², 2×10¹⁵, 0.25, 10⁻⁴. */
  L.formatTick = function (v) {
    if (v === 0) return '0';
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    var p10 = Math.round(Math.log10(a)), isPow = Math.abs(a - Math.pow(10, p10)) < Math.pow(10, p10) * 1e-9;
    if (a >= 1e12 || (a < 0.01)) {
      if (isPow) return s + '10' + sup(p10);
      var e = Math.floor(Math.log10(a)), m = a / Math.pow(10, e);
      return s + trim(m, 1) + '×10' + sup(e);
    }
    if (a >= 1e9) return s + trim(a / 1e9) + 'B';
    if (a >= 1e6) return s + trim(a / 1e6) + 'M';
    if (a >= 1e3) return s + trim(a / 1e3) + 'k';
    return s + trim(a, a >= 1 ? 2 : 3);
  };
  /* Tooltip values: 12,345 · 1.25M · 0.0312 · ∞ */
  L.formatValue = function (v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e15) return L.formatTick(v);
    if (a >= 1e6) return s + trim(a / (a >= 1e12 ? 1e12 : a >= 1e9 ? 1e9 : 1e6)) + (a >= 1e12 ? 'T' : a >= 1e9 ? 'B' : 'M');
    if (Number.isInteger(v)) return s + a.toLocaleString('en-US');
    if (a >= 100) return s + a.toLocaleString('en-US', { maximumFractionDigits: 1 });
    return s + String(+a.toPrecision(3));
  };
  /* Sample y = fn(x) at n points (log-spaced when log is true). Non-finite results become NaN (path breaks). */
  L.sampleFn = function (fn, x0, x1, n, log) {
    var out = [];
    n = Math.max(2, n || 64);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = log ? Math.pow(10, Math.log10(x0) + t * (Math.log10(x1) - Math.log10(x0))) : x0 + t * (x1 - x0);
      var y;
      try { y = fn(x); } catch (_) { y = NaN; }
      out.push([x, isFinite(y) ? y : NaN]);
    }
    return out;
  };
  /* Resample a polyline to n points by index fraction (so two lines with different sample counts can morph). */
  L.resample = function (pts, n) {
    if (!pts || !pts.length) { var z = []; for (var i = 0; i < n; i++) z.push([0, 0]); return z; }
    if (pts.length === n) return pts.map(function (p) { return [p[0], p[1]]; });
    var out = [];
    for (var j = 0; j < n; j++) {
      var f = n === 1 ? 0 : j / (n - 1) * (pts.length - 1), k = Math.floor(f), u = f - k;
      var a = pts[k], b = pts[Math.min(pts.length - 1, k + 1)];
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return out;
  };
  /* SVG path through screen points; NaN points break the line. */
  L.linePath = function (pts) {
    var d = '', pen = false;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!isFinite(p[0]) || !isFinite(p[1])) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + (Math.round(p[0] * 100) / 100) + ' ' + (Math.round(p[1] * 100) / 100);
      pen = true;
    }
    return d;
  };
  /* Spread labels vertically so none overlap. items: [{id, y, h}] (desired centre y). Keeps them within [lo, hi].
     Returns {id: y}. */
  L.labelLayout = function (items, lo, hi, gap) {
    gap = gap === undefined ? 2 : gap;
    var list = items.filter(function (it) { return isFinite(it.y); }).map(function (it) { return { id: it.id, y: it.y, h: it.h || 12 }; });
    list.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < list.length; i++) {
      var min = i === 0 ? lo + list[i].h / 2 : list[i - 1].y + (list[i - 1].h + list[i].h) / 2 + gap;
      if (list[i].y < min) list[i].y = min;
    }
    for (i = list.length - 1; i >= 0; i--) {
      var max = i === list.length - 1 ? hi - list[i].h / 2 : list[i + 1].y - (list[i + 1].h + list[i].h) / 2 - gap;
      if (list[i].y > max) list[i].y = max;
    }
    var out = {};
    list.forEach(function (it) { out[it.id] = it.y; });
    return out;
  };
  /* y of a points series at x by linear interpolation (null outside its x range). */
  L.valueAt = function (pts, x) {
    if (!pts.length) return null;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][0] === x) return pts[i][1];
      if (pts[i][0] > x) {
        if (i === 0) return null;
        var a = pts[i - 1], b = pts[i], u = (x - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return null;
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, doc = root.document;
  var N2 = vz.n2;
  var CATS = 8; // categorical order: active, compare, done, pivot, frontier, visited, path, error (see viz.css)

  var DEFAULTS = {
    type: 'line',             // 'line' | 'bar' | 'scatter'
    height: null,             // px; default responsive (220-360)
    labels: 'auto',           // line: 'auto' (direct labels, legend when narrow) | 'direct' | 'legend' | false
    hover: true,              // crosshair tooltip (pointer + keyboard)
    samples: 72,              // points per function series
    pointRadius: 3.5,
    xGrid: false,             // vertical gridlines
    valueLabels: true,        // bar: numbers above bars
    format: null,             // (v, axis) -> string for tick labels
    valueFormat: null,        // (v, series) -> string for tooltips / value labels
    label: null,
    duration: 600
  };

  function chartView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var V = vz.createView(container, 'chart', {
      label: opts.label || (opts.type === 'bar' ? 'Bar chart' : opts.type === 'scatter' ? 'Scatter plot' : 'Line chart'),
      className: 'vz-chart-' + opts.type, duration: opts.duration, describe: opts.describe, interactive: false
    }, draw);
    var ctx = V.ctx, api = V.api, tr = V.tr, svg = ctx.svg, em = V.em;
    var clipId = (VDSA.uid ? VDSA.uid('vzclip') : 'vzclip' + Math.random().toString(36).slice(2));
    var clip = vz.svg('clipPath', { id: clipId }, ctx.defs);
    var clipRect = vz.svg('rect', { x: 0, y: 0, width: 0, height: 0 }, clip);
    ['grid', 'annot', 'axes', 'plot', 'labels', 'legend', 'hl', 'hover'].forEach(ctx.layer);
    ctx.layers.plot.setAttribute('clip-path', 'url(#' + clipId + ')');

    var S = { yt: new vz.Store(), xt: new vz.Store(), series: new vz.Store(), bars: new vz.Store(), cats: new vz.Store(), dots: new vz.Store(), legend: new vz.Store(), annots: new vz.Store(), hls: new vz.Store(), misc: new vz.Store() };
    var P = null, lastScales = null, first = true, model = null;
    var textCache = new Map();
    function measure(str, px, weight, mono) {
      var k = str + '|' + px + '|' + weight + '|' + (mono ? 1 : 0), w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(str, px, mono, weight); textCache.set(k, w); }
      return w;
    }
    function tickText(v, axis) { return opts.format ? String(opts.format(v, axis)) : L.formatTick(v); }
    function valueText(v, s) { return opts.valueFormat ? String(opts.valueFormat(v, s)) : L.formatValue(v); }
    /* Series colour: an explicit semantic `state` (is-<state>) or the categorical slot vz-cat-<n>. */
    function colorClass(el, s, i) {
      var cls = s.state ? 'is-' + s.state : 'vz-cat-' + ((s.color !== undefined ? s.color : i) % CATS);
      if (el.__vzCat === cls) return;
      if (el.__vzCat) el.classList.remove(el.__vzCat);
      el.classList.add(cls);
      el.__vzCat = cls;
    }

    /* ---------------------------------------------------------- data model */
    function buildModel(state) {
      var type = opts.type;
      var xs = state.x || {}, ys = state.y || {};
      var series = (state.series || []).filter(Boolean).map(function (s, i) {
        var fn = typeof s.fn === 'function' ? s.fn : null;
        return { id: String(s.id !== undefined ? s.id : 's' + i), label: s.label !== undefined ? String(s.label) : String(s.id !== undefined ? s.id : 's' + i), raw: s, index: i, state: s.state, color: s.color, dashed: !!s.dashed, markers: s.markers, fn: fn,
          asLine: type === 'line' || (type === 'scatter' && (!!fn || s.line === true)) };
      });
      var m = { type: type, series: series, xs: xs, ys: ys, state: state };
      if (type === 'bar') {
        m.categories = (state.categories || []).map(String);
        var vals = [];
        series.forEach(function (s) { (s.raw.values || []).forEach(function (v) { if (isFinite(v)) vals.push(+v); }); });
        var lo = Math.min.apply(null, vals.concat([0])), hi = Math.max.apply(null, vals.concat([0]));
        if (ys.min !== undefined) lo = ys.min;
        if (ys.max !== undefined) hi = ys.max;
        var nt = L.niceTicks(lo, hi === lo ? lo + 1 : hi, ys.ticks || 5);
        m.y = { type: 'linear', min: ys.min !== undefined ? ys.min : nt.min, max: ys.max !== undefined ? ys.max : nt.max, ticks: nt.ticks.filter(function (t) { return t >= (ys.min !== undefined ? ys.min : nt.min) - 1e-9 && t <= (ys.max !== undefined ? ys.max : nt.max) + 1e-9; }), minor: [] };
        return m;
      }
      // x domain
      var xlog = xs.scale === 'log', ylog = ys.scale === 'log';
      var xmin = xs.min, xmax = xs.max;
      var dataX = [];
      series.forEach(function (s) { if (!s.fn) (s.raw.points || []).forEach(function (p) { var x = Array.isArray(p) ? p[0] : p.x; if (isFinite(x) && (!xlog || x > 0)) dataX.push(+x); }); });
      if (xmin === undefined) xmin = dataX.length ? Math.min.apply(null, dataX) : (xlog ? 1 : 0);
      if (xmax === undefined) xmax = dataX.length ? Math.max.apply(null, dataX) : (xlog ? 100 : 1);
      if (xmax <= xmin) xmax = xmin + (xlog ? xmin * 9 : 1);
      series.forEach(function (s) {
        var pts;
        if (s.fn) {
          var dom = s.raw.domain || [xmin, xmax];
          pts = L.sampleFn(s.fn, Math.max(dom[0], xlog ? 1e-12 : -Infinity), dom[1], s.raw.samples || opts.samples, xlog);
        } else {
          pts = (s.raw.points || []).map(function (p, k) {
            return Array.isArray(p) ? [+p[0], +p[1], p[2] !== undefined ? String(p[2]) : String(k)] : [+p.x, +p.y, p.id !== undefined ? String(p.id) : String(k)];
          });
          if (s.asLine) pts.sort(function (a, b) { return a[0] - b[0]; });
        }
        s.pts = pts;
      });
      // y domain
      var dataY = [];
      series.forEach(function (s) { s.pts.forEach(function (p) { if (p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9 && isFinite(p[1]) && (!ylog || p[1] > 0)) dataY.push(p[1]); }); });
      var zero = ys.zero !== undefined ? ys.zero : type !== 'scatter';
      var ymin = ys.min, ymax = ys.max;
      if (ymin === undefined) ymin = dataY.length ? Math.min.apply(null, dataY) : (ylog ? 1 : 0);
      if (ymax === undefined) ymax = dataY.length ? Math.max.apply(null, dataY) : (ylog ? 10 : 1);
      if (!ylog && zero && ys.min === undefined) ymin = Math.min(0, ymin);
      var yinfo;
      if (ylog) {
        var lt = L.logTicks(ys.min !== undefined ? ys.min : Math.max(ymin, 1e-12), ymax);
        var ya = ys.min !== undefined ? ys.min : lt.min, yb = ys.max !== undefined ? ys.max : lt.max;
        yinfo = { type: 'log', min: ya, max: yb, ticks: lt.major.filter(function (t) { return t >= ya * 0.999 && t <= yb * 1.001; }), minor: lt.minor.filter(function (t) { return t > ya && t < yb; }), every: lt.labelEvery };
      } else {
        var nt2 = L.niceTicks(ymin, ymax, ys.ticks || 5);
        var y0 = ys.min !== undefined ? ys.min : nt2.min, y1 = ys.max !== undefined ? ys.max : nt2.max;
        yinfo = { type: 'linear', min: y0, max: y1, ticks: nt2.ticks.filter(function (t) { return t >= y0 - 1e-9 && t <= y1 + 1e-9; }), minor: [] };
      }
      var xinfo;
      if (xlog) {
        var lx = L.logTicks(xmin, xmax);
        xinfo = { type: 'log', min: xs.min !== undefined ? xmin : lx.min, max: xs.max !== undefined ? xmax : lx.max, ticks: lx.major, minor: [], every: lx.labelEvery };
        xinfo.ticks = xinfo.ticks.filter(function (t) { return t >= xinfo.min * 0.999 && t <= xinfo.max * 1.001; });
      } else {
        var ntx = L.niceTicks(xmin, xmax, xs.ticks || 6);
        var niceDomain = xs.nice === true;
        var xa = niceDomain ? ntx.min : xmin, xb = niceDomain ? ntx.max : xmax;
        xinfo = { type: 'linear', min: xa, max: xb, ticks: ntx.ticks.filter(function (t) { return t >= xa - 1e-9 && t <= xb + 1e-9; }), minor: [] };
      }
      if (Array.isArray(xs.ticks)) xinfo.ticks = xs.ticks.slice();
      if (Array.isArray(ys.ticks)) yinfo.ticks = ys.ticks.slice();
      m.x = xinfo; m.y = yinfo;
      return m;
    }

    /* ---------------------------------------------------------- layout */
    function layout(m) {
      var W = ctx.width;
      var H = opts.height || vz.clamp(Math.round(W * 0.56), 220, 360);
      var yTickW = 0;
      m.y.ticks.forEach(function (t, i) { if (!m.y.every || i % m.y.every === 0) yTickW = Math.max(yTickW, measure(tickText(t, 'y'), 11, 500)); });
      var top = 12 + (m.ys.label ? 18 : 0);
      var left = Math.max(28, Math.ceil(yTickW) + 12);
      var bottom = 24 + (m.xs.label ? 18 : 0) + (m.type === 'bar' ? 8 : 0);
      var mode = opts.labels;
      var multi = m.series.length > 1;
      var labelW = 0;
      if (m.type === 'line' && mode !== false && mode !== 'legend') {
        m.series.forEach(function (s) { labelW = Math.max(labelW, measure(s.label, 12, 650)); });
        labelW += 12;
      }
      var legend = false;
      if (m.type !== 'line') legend = multi && mode !== false;
      else if (mode === 'legend') legend = multi || m.series.length === 1;
      else if (mode === 'auto' && labelW > W * 0.3) { legend = true; labelW = 0; }
      if (mode === false || m.type !== 'line') labelW = 0;
      var right = Math.max(14, labelW);
      var legendH = 0, legendItems = [];
      if (legend) {
        var x = left, rowY = 0, rowH = 18;
        m.series.forEach(function (s) {
          var w = 16 + measure(s.label, 12, 600) + 16;
          if (x + w > W - 8 && x > left) { x = left; rowY += rowH; }
          legendItems.push({ s: s, x: x, y: rowY });
          x += w;
        });
        legendH = rowY + rowH + 6;
        top += legendH;
      }
      var p = { W: W, H: H, left: left, top: top, right: W - right, bottom: H - bottom, legend: legend, legendItems: legendItems, legendTop: 8 + (m.ys.label ? 18 : 0), labelW: labelW };
      p.pw = Math.max(20, p.right - p.left); p.ph = Math.max(20, p.bottom - p.top);
      if (m.type === 'bar') {
        p.x = null;
        p.band = p.pw / Math.max(1, m.categories.length);
      } else {
        p.x = m.x.type === 'log' ? L.scaleLog(m.x.min, m.x.max, p.left, p.right) : L.scaleLinear(m.x.min, m.x.max, p.left, p.right);
      }
      p.y = m.y.type === 'log' ? L.scaleLog(m.y.min, m.y.max, p.bottom, p.top) : L.scaleLinear(m.y.min, m.y.max, p.bottom, p.top);
      return p;
    }
    /* Soft clamp: values beyond the plot compress smoothly into a band just outside it (tanh), so steep
       curves keep their exit angle at rest and morph between scales without flat plateaus or kinks. */
    function clampY(y) {
      var k = P.ph * 0.6;
      if (y < P.top) return P.top - k * Math.tanh((P.top - y) / k);
      if (y > P.bottom) return P.bottom + k * Math.tanh((y - P.bottom) / k);
      return y;
    }
    function sy(v) { var y = P.y(v); return isFinite(y) ? clampY(y) : (v <= 0 && P.y.type === 'log' ? P.bottom + 2 * P.ph : NaN); }

    /* ---------------------------------------------------------- builders */
    function buildTick(rec, axis) {
      rec.el = vz.svg('g', { class: 'vz-tick vz-tick-' + axis }, axis === 'y' ? ctx.layers.grid : ctx.layers.axes);
      rec.line = vz.svg('line', { class: 'vz-gridline' }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-tick-label', dy: '.35em' }, rec.el);
      rec.paint = axis === 'y' ? paintYTick : paintXTick;
    }
    function paintYTick(rec) {
      var y = Math.round(rec.cur.y) + 0.5;
      vz.opacity(rec.el, rec.cur.o);
      vz.set(rec.line, 'x1', N2(P.left)); vz.set(rec.line, 'x2', N2(P.right)); vz.set(rec.line, 'y1', N2(y)); vz.set(rec.line, 'y2', N2(y));
      vz.set(rec.text, 'x', N2(P.left - 8)); vz.set(rec.text, 'y', N2(y));
    }
    function paintXTick(rec) {
      var x = Math.round(rec.cur.x) + 0.5;
      vz.opacity(rec.el, rec.cur.o);
      if (rec.grid) { vz.set(rec.line, 'x1', N2(x)); vz.set(rec.line, 'x2', N2(x)); vz.set(rec.line, 'y1', N2(P.top)); vz.set(rec.line, 'y2', N2(P.bottom)); }
      else { vz.set(rec.line, 'x1', N2(x)); vz.set(rec.line, 'x2', N2(x)); vz.set(rec.line, 'y1', N2(P.bottom)); vz.set(rec.line, 'y2', N2(P.bottom + 4)); }
      vz.set(rec.text, 'x', N2(x)); vz.set(rec.text, 'y', N2(P.bottom + 14));
    }
    function buildSeries(rec) {
      rec.el = vz.svg('g', { class: 'vz-series' }, ctx.layers.plot);
      rec.path = vz.svg('path', { class: 'vz-series-line' }, rec.el);
      rec.label = vz.svg('text', { class: 'vz-series-label', dy: '.35em' }, ctx.layers.labels);
      rec.dotsG = null;
      rec.nodes = [rec.el, rec.label];
      rec.paint = paintSeries;
      rec.fromPts = []; rec.toPts = []; rec.curPts = [];
    }
    function paintSeries(rec) {
      var e = rec.cur.t === undefined ? 1 : rec.cur.t;
      var n = rec.toPts.length, pts = [];
      for (var i = 0; i < n; i++) {
        var a = rec.fromPts[i] || rec.toPts[i], b = rec.toPts[i];
        var ax = a[0], ay = a[1], bx = b[0], by = b[1];
        if (!isFinite(ay)) ay = by; if (!isFinite(by)) { pts.push([NaN, NaN]); continue; }
        pts.push([ax + (bx - ax) * e, ay + (by - ay) * e]);
      }
      rec.curPts = pts;
      vz.set(rec.path, 'd', L.linePath(pts));
      vz.opacity(rec.el, rec.cur.o);
      vz.opacity(rec.label, rec.cur.lo === undefined ? rec.cur.o : Math.min(rec.cur.o, rec.cur.lo));
      vz.set(rec.label, 'x', N2(rec.cur.lx)); vz.set(rec.label, 'y', N2(rec.cur.ly));
      if (rec.dots) {
        for (var k = 0; k < rec.dots.length; k++) {
          var p = pts[k], d = rec.dots[k];
          if (!p || !isFinite(p[1])) { vz.set(d, 'opacity', '0'); continue; }
          vz.set(d, 'cx', N2(p[0])); vz.set(d, 'cy', N2(p[1])); vz.set(d, 'opacity', null);
        }
      }
    }
    function buildBar(rec) {
      rec.el = vz.svg('g', { class: 'vz-bar-g' }, ctx.layers.plot);
      rec.rect = vz.svg('rect', { class: 'vz-bar-rect', rx: 2.5, ry: 2.5 }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-bar-label', 'text-anchor': 'middle' }, ctx.layers.labels);
      rec.nodes = [rec.el, rec.text];
      rec.paint = function (r) {
        var c = r.cur, y0 = P.y(Math.max(P.y.domain[0], Math.min(0, P.y.domain[1])));
        var yTop = Math.min(c.y, y0), h = Math.abs(y0 - c.y);
        vz.set(r.rect, 'x', N2(c.x)); vz.set(r.rect, 'width', N2(Math.max(0, c.w)));
        vz.set(r.rect, 'y', N2(yTop)); vz.set(r.rect, 'height', N2(Math.max(0, h)));
        vz.opacity(r.el, c.o);
        vz.set(r.text, 'x', N2(c.x + c.w / 2)); vz.set(r.text, 'y', N2(c.y <= y0 ? c.y - 5 : c.y + 13));
        vz.opacity(r.text, Math.min(c.o, c.lo === undefined ? 1 : c.lo));
        if (r.counting) vz.text(r.text, valueText(r.intCount ? Math.round(c.v) : c.v, r.series));
      };
    }
    function buildCat(rec) {
      rec.el = vz.svg('text', { class: 'vz-tick-label vz-cat-label', 'text-anchor': 'middle' }, ctx.layers.axes);
      rec.paint = function (r) { vz.set(r.el, 'x', N2(r.cur.x)); vz.set(r.el, 'y', N2(P.bottom + 15)); vz.opacity(r.el, r.cur.o); };
    }
    function buildDot(rec) {
      rec.el = vz.svg('circle', { class: 'vz-scatter-dot', r: opts.pointRadius }, ctx.layers.plot);
      rec.paint = function (r) { vz.set(r.el, 'cx', N2(r.cur.x)); vz.set(r.el, 'cy', N2(r.cur.y)); vz.set(r.el, 'r', N2(Math.max(0, opts.pointRadius * r.cur.s))); vz.opacity(r.el, r.cur.o); };
    }
    function buildLegend(rec) {
      rec.el = vz.svg('g', { class: 'vz-lg-item' }, ctx.layers.legend);
      rec.sw = vz.svg('rect', { class: 'vz-lg-swatch', width: 10, height: 10, rx: 2.5, ry: 2.5, y: -5 }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-lg-text', x: 15, dy: '.35em' }, rec.el);
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function buildAnnot(rec) {
      rec.el = vz.svg('g', { class: 'vz-annot' }, ctx.layers.annot);
      rec.line = vz.svg('line', { class: 'vz-annot-line' }, rec.el);
      rec.dot = vz.svg('circle', { class: 'vz-annot-dot', r: 3.5 }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-annot-text', dy: '.35em' }, rec.el);
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        vz.set(r.line, 'x1', N2(c.x1)); vz.set(r.line, 'x2', N2(c.x2)); vz.set(r.line, 'y1', N2(c.y1)); vz.set(r.line, 'y2', N2(c.y2));
        vz.set(r.text, 'x', N2(c.tx)); vz.set(r.text, 'y', N2(c.ty));
        vz.set(r.dot, 'cx', N2(c.x2)); vz.set(r.dot, 'cy', N2(c.y2));
      };
    }
    function buildHl(rec) {
      rec.el = vz.svg('g', { class: 'vz-hl' }, ctx.layers.hl);
      rec.ring = vz.svg('circle', { class: 'vz-hl-ring', r: 9 }, rec.el);
      rec.dot = vz.svg('circle', { class: 'vz-hl-dot', r: 4.5 }, rec.el);
      rec.pill = vz.svg('rect', { class: 'vz-hl-pill', height: 20, rx: 10, ry: 10 }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-hl-text', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
      rec.paint = function (r) {
        var c = r.cur;
        vz.place(r.el, c.x, c.y);
        vz.opacity(r.el, c.o);
        vz.set(r.ring, 'r', N2(9 * c.s));
      };
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var m = buildModel(state);
      model = m;
      P = layout(m);
      ctx.setHeight(P.H);
      var animate = ms > 0, intro = first && animate;
      first = false;
      var anim = [];
      var old = lastScales;
      function push(rec) { anim.push(rec); }
      function fade(rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; push(rec); }
      vz.set(clipRect, 'x', N2(P.left - 6)); vz.set(clipRect, 'y', N2(P.top - 8));
      vz.set(clipRect, 'height', N2(P.ph + 14));
      var fullClipW = P.pw + 12;
      if (!intro) vz.set(clipRect, 'width', N2(fullClipW));

      /* axis baseline */
      S.misc.begin();
      var base = S.misc.use('baseline', function (r) { r.el = vz.svg('line', { class: 'vz-axis-line' }, ctx.layers.axes); r.paint = function () {}; });
      var baseY = m.type === 'bar' || (m.y.type === 'linear' && m.y.min <= 0 && m.y.max >= 0) ? P.y(m.y.type === 'linear' ? Math.max(m.y.min, Math.min(0, m.y.max)) : m.y.min) : P.bottom;
      baseY = Math.round(baseY) + 0.5;
      vz.set(base.el, 'x1', N2(P.left)); vz.set(base.el, 'x2', N2(P.right)); vz.set(base.el, 'y1', N2(baseY)); vz.set(base.el, 'y2', N2(baseY));
      /* axis titles */
      var yTitle = S.misc.use('ytitle', function (r) { r.el = vz.svg('text', { class: 'vz-axis-title', 'text-anchor': 'start' }, ctx.layers.axes); r.paint = function () {}; });
      vz.text(yTitle.el, m.ys.label || '');
      vz.set(yTitle.el, 'x', 4); vz.set(yTitle.el, 'y', 14);
      var xTitle = S.misc.use('xtitle', function (r) { r.el = vz.svg('text', { class: 'vz-axis-title', 'text-anchor': 'end' }, ctx.layers.axes); r.paint = function () {}; });
      vz.text(xTitle.el, m.type === 'bar' ? '' : (m.xs.label || ''));
      vz.set(xTitle.el, 'x', N2(P.right)); vz.set(xTitle.el, 'y', N2(P.H - 6));
      S.misc.end();

      /* y ticks (major + minor) */
      S.yt.begin();
      function yTick(v, minor, labelIt) {
        var key = (minor ? 'm' : 'M') + v;
        var rec = S.yt.use(key, function (r) { buildTick(r, 'y'); });
        vz.toggle(rec.el, 'is-minor', minor);
        vz.text(rec.text, labelIt ? tickText(v, 'y') : '');
        var ty = P.y(v);
        var t = { y: ty, o: 1 };
        if (rec.isNew) {
          var fy = old && old.y ? old.y(v) : ty;
          if (!isFinite(fy)) fy = ty;
          rec.cur = { y: vz.clamp(fy, P.top - 40, P.bottom + 40), o: animate ? 0 : 1 };
          rec.oDelay = old ? 0.4 : 0;   // appear once the old labels have mostly gone
        } else rec.oDelay = 0;
        rec.oSpan = 0;
        vz.retarget(rec, t); rec.delay = 0; push(rec);
      }
      m.y.ticks.forEach(function (v, i) { yTick(v, false, !m.y.every || i % m.y.every === 0); });
      (m.y.minor || []).forEach(function (v) { yTick(v, true, false); });
      S.yt.end().forEach(function (rec) {
        var v = parseFloat(rec.id.slice(1));
        var ny = P.y(v);
        rec.from = Object.assign({}, rec.cur);
        rec.to = { y: isFinite(ny) ? vz.clamp(ny, P.top - 40, P.bottom + 40) : rec.cur.y, o: 0 };
        rec.delay = 0; rec.oDelay = 0; rec.oSpan = 0.55; push(rec);
      });

      /* x ticks / categories */
      S.xt.begin(); S.cats.begin();
      if (m.type === 'bar') {
        m.categories.forEach(function (c, i) {
          var rec = S.cats.use(c, buildCat);
          var cx = P.left + P.band * (i + 0.5);
          var maxW = P.band - 4, txt = c;
          if (measure(txt, 11, 500) > maxW) { while (txt.length > 1 && measure(txt + '…', 11, 500) > maxW) txt = txt.slice(0, -1); txt += '…'; }
          vz.text(rec.el, txt);
          var t = { x: cx, o: 1 };
          if (rec.isNew) rec.cur = { x: cx, o: animate ? 0 : 1 };
          vz.retarget(rec, t); rec.delay = 0; push(rec);
        });
      } else {
        m.x.ticks.forEach(function (v, i) {
          var rec = S.xt.use('x' + v, function (r) { buildTick(r, 'x'); });
          rec.grid = !!opts.xGrid;
          vz.toggle(rec.el, 'is-grid', rec.grid);
          vz.text(rec.text, !m.x.every || i % m.x.every === 0 ? tickText(v, 'x') : '');
          vz.set(rec.text, 'text-anchor', 'middle');
          var tx = P.x(v), t = { x: tx, o: 1 };
          if (rec.isNew) { var fx = old && old.x ? old.x(v) : tx; if (!isFinite(fx)) fx = tx; rec.cur = { x: vz.clamp(fx, P.left - 40, P.right + 40), o: animate ? 0 : 1 }; }
          vz.retarget(rec, t); rec.delay = 0; push(rec);
        });
      }
      S.xt.end().forEach(fade); S.cats.end().forEach(fade);

      /* series */
      S.series.begin(); S.bars.begin(); S.dots.begin();
      var labelItems = [], labelTargets = {};
      if (m.type === 'line' || m.type === 'scatter') {
        m.series.forEach(function (s) {
          if (!s.asLine) return;
          var rec = S.series.use(s.id, buildSeries);
          rec.series = s;
          colorClass(rec.el, s, s.index); colorClass(rec.label, s, s.index);
          vz.toggle(rec.path, 'is-dashed', s.dashed);
          vz.toggle(rec.el, 'is-dim', state.focus !== undefined && state.focus !== null && String(state.focus) !== s.id);
          vz.toggle(rec.label, 'is-dim', state.focus !== undefined && state.focus !== null && String(state.focus) !== s.id);
          vz.text(rec.label, P.labelW > 0 ? s.label : '');
          var target = s.pts.map(function (p) { return [P.x(p[0]), isFinite(p[1]) ? sy(p[1]) : NaN]; });
          rec.data = s.pts;
          // markers (data points)
          var wantDots = s.markers === true || (s.markers === undefined && !s.fn && s.pts.length <= 24);
          if (wantDots) {
            if (!rec.dotsG) { rec.dotsG = vz.svg('g', { class: 'vz-series-dots' }, rec.el); rec.dots = []; }
            while (rec.dots.length < target.length) rec.dots.push(vz.svg('circle', { class: 'vz-series-dot', r: 3 }, rec.dotsG));
            while (rec.dots.length > target.length) rec.dots.pop().remove();
          } else if (rec.dotsG) { rec.dotsG.remove(); rec.dotsG = null; rec.dots = null; }
          // morph from what is on screen (resampled to the new point count)
          if (rec.isNew || !rec.curPts.length) {
            rec.fromPts = intro || !animate ? target.map(function (p) { return p.slice(); }) : target.map(function (p) { return [p[0], P.bottom]; });
          } else rec.fromPts = L.resample(rec.curPts.map(function (p) { return [p[0], isFinite(p[1]) ? p[1] : P.bottom]; }), target.length);
          rec.toPts = target;
          // direct label anchor: last visible point, or where the line leaves the top of the plot
          var anchor = null, inside = false;
          for (var i = 0; i < target.length; i++) {
            var p = target[i];
            if (!isFinite(p[1])) continue;
            if (p[1] >= P.top - 0.5 && p[1] <= P.bottom + 0.5) { anchor = { x: p[0], y: p[1], out: false }; inside = true; }
            else if (inside && p[1] < P.top) {
              var q = target[i - 1];
              var u = (q[1] - P.top) / Math.max(1e-6, q[1] - p[1]);
              anchor = { x: q[0] + (p[0] - q[0]) * u, y: P.top, out: true };
              break;
            }
          }
          var lx, ly;
          if (!anchor) { lx = P.right + 8; ly = P.top; rec.labelHidden = true; }
          else if (anchor.out && anchor.x < P.left + P.pw * 0.86) {
            lx = anchor.x + 6; ly = P.top + 8; vz.set(rec.label, 'text-anchor', 'start'); rec.labelHidden = false;
            vz.toggle(rec.label, 'is-inside', true);
          } else {
            lx = Math.min(P.right, anchor.x) + 8; ly = anchor.y; vz.set(rec.label, 'text-anchor', 'start'); rec.labelHidden = false;
            vz.toggle(rec.label, 'is-inside', anchor.x < P.right - 20);
            labelItems.push({ id: s.id, y: ly, h: 14 });
          }
          labelTargets[s.id] = { x: lx, y: ly };
          var t = { t: 1, o: 1, lx: lx, ly: ly, lo: rec.labelHidden || P.labelW <= 0 ? 0 : 1 };
          if (rec.isNew) rec.cur = { t: 0, o: animate && !intro ? 0 : 1, lx: lx, ly: ly, lo: 0 };
          else rec.cur.t = 0;
          rec.delay = 0;
          rec.pending = t;
          push(rec);
        });
        var resolved = L.labelLayout(labelItems, P.top, P.bottom + 8, 2);
        S.series.each(function (rec) {
          if (!rec.pending) return;
          if (resolved[rec.id] !== undefined) rec.pending.ly = resolved[rec.id];
          vz.retarget(rec, rec.pending);
          if (intro) rec.labelDelay = true;
          rec.pending = null;
        });
      } else if (m.type === 'bar') {
        var ns = Math.max(1, m.series.length), inner = P.band * 0.78, bw = Math.max(2, inner / ns - (ns > 1 ? 3 : 0));
        var showVals = opts.valueLabels && bw >= 16;
        var y0 = P.y(Math.max(m.y.min, Math.min(0, m.y.max)));
        var hlBar = state.highlight && state.highlight.category !== undefined ? state.highlight : null;
        m.series.forEach(function (s, si) {
          (m.categories || []).forEach(function (c, ci) {
            var v = s.raw.values ? s.raw.values[ci] : undefined;
            if (v === undefined || v === null || !isFinite(v)) return;
            var rec = S.bars.use(s.id + '|' + c, buildBar);
            rec.series = s;
            colorClass(rec.el, s, s.index); colorClass(rec.text, s, s.index);
            var isHl = hlBar && String(hlBar.category) === c && (hlBar.series === undefined || String(hlBar.series) === s.id);
            vz.toggle(rec.el, 'is-dim', !!hlBar && !isHl);
            vz.toggle(rec.el, 'is-hl', !!isHl);
            var x = P.left + P.band * ci + (P.band - inner) / 2 + si * (inner / ns) + (ns > 1 ? 1.5 : 0);
            var prevV = rec.value;
            rec.value = +v;
            rec.counting = animate && !rec.isNew && prevV !== undefined && prevV !== +v && showVals;
            rec.intCount = Number.isInteger(prevV) && Number.isInteger(+v);
            if (!rec.counting) vz.text(rec.text, showVals ? valueText(+v, s) : '');
            var t = { x: x, w: bw, y: P.y(+v), o: 1, lo: showVals ? 1 : 0, v: +v };
            if (rec.isNew) { rec.cur = { x: x, w: bw, y: y0, o: 1, lo: 0, v: 0 }; rec.delay = animate ? Math.min(0.35, (ci * ns + si) * 0.04) : 0; }
            else { rec.delay = 0; if (prevV !== undefined) rec.cur.v = prevV; }
            vz.retarget(rec, t); push(rec);
          });
        });
      }
      if (m.type === 'scatter') {
        m.series.forEach(function (s) {
          if (s.asLine) return;
          s.pts.forEach(function (p, k) {
            if (!isFinite(p[0]) || !isFinite(p[1])) return;
            var rec = S.dots.use(s.id + '|' + p[2], buildDot);
            colorClass(rec.el, s, s.index);
            vz.toggle(rec.el, 'is-dim', state.focus !== undefined && state.focus !== null && String(state.focus) !== s.id);
            var t = { x: P.x(p[0]), y: sy(p[1]), o: 1, s: 1 };
            if (rec.isNew) { rec.cur = { x: t.x, y: t.y, o: animate ? 0 : 1, s: animate ? 0.2 : 1 }; rec.delay = animate ? Math.min(0.4, k * 0.012) : 0; }
            else rec.delay = 0;
            vz.retarget(rec, t); push(rec);
          });
        });
      }
      S.series.end().forEach(fade);
      S.bars.end().forEach(function (rec) {
        var y0 = P.y(Math.max(P.y.domain[0], Math.min(0, P.y.domain[1])));
        rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { y: y0, o: 0, lo: 0 }); rec.delay = 0; rec.counting = false; push(rec);
      });
      S.dots.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0, s: 0.2 }); rec.delay = 0; push(rec); });

      /* legend */
      S.legend.begin();
      if (P.legend) {
        P.legendItems.forEach(function (li) {
          var rec = S.legend.use(li.s.id, buildLegend);
          colorClass(rec.el, li.s, li.s.index);
          vz.toggle(rec.el, 'is-line', !!li.s.asLine);
          vz.set(rec.sw, 'height', li.s.asLine ? 3 : 10); vz.set(rec.sw, 'y', li.s.asLine ? -1.5 : -5);
          vz.text(rec.text, li.s.label);
          var t = { x: li.x, y: P.legendTop + li.y + 6, o: 1 };
          if (rec.isNew) rec.cur = Object.assign({}, t, { o: animate ? 0 : 1 });
          vz.retarget(rec, t); rec.delay = 0; push(rec);
        });
      }
      S.legend.end().forEach(fade);

      /* annotations */
      S.annots.begin();
      (state.annotations || []).forEach(function (a, i) {
        if (!a) return;
        var rec = S.annots.use(a.id !== undefined ? String(a.id) : 'a' + i, buildAnnot);
        vz.state(rec.el, a.state || 'default');
        vz.text(rec.text, a.text || '');
        var hasX = a.x !== undefined && a.x !== null && m.type !== 'bar', hasY = a.y !== undefined && a.y !== null;
        var t;
        var X = hasX ? P.x(a.x) : null, Y = hasY ? sy(a.y) : null;
        if (hasX && hasY) {
          var right = X < P.left + P.pw * 0.7;
          t = { x1: X, y1: Y, x2: X, y2: Y, tx: X + (right ? 10 : -10), ty: Y - 12, o: 1 };
          vz.set(rec.text, 'text-anchor', right ? 'start' : 'end');
          vz.set(rec.dot, 'opacity', null); vz.toggle(rec.el, 'is-point', true);
        } else if (hasX) {
          t = { x1: X, y1: P.top, x2: X, y2: P.bottom, tx: X + 5, ty: P.top + 7, o: 1 };
          vz.set(rec.text, 'text-anchor', X > P.left + P.pw * 0.75 ? 'end' : 'start');
          if (X > P.left + P.pw * 0.75) t.tx = X - 5;
          vz.set(rec.dot, 'opacity', '0'); vz.toggle(rec.el, 'is-point', false);
        } else if (hasY) {
          t = { x1: P.left, y1: Y, x2: P.right, y2: Y, tx: P.left + 6, ty: Y - 9, o: 1 };
          vz.set(rec.text, 'text-anchor', 'start');
          vz.set(rec.dot, 'opacity', '0'); vz.toggle(rec.el, 'is-point', false);
        } else return;
        if (rec.isNew) rec.cur = Object.assign({}, t, { o: animate ? 0 : 1 });
        vz.retarget(rec, t); rec.delay = intro ? 0.6 : 0; push(rec);
      });
      S.annots.end().forEach(fade);

      /* highlighted points (line / scatter) */
      S.hls.begin();
      var hls = state.highlight ? (Array.isArray(state.highlight) ? state.highlight : [state.highlight]) : [];
      if (m.type !== 'bar') hls.forEach(function (h, i) {
        if (!h || h.x === undefined) return;
        var s = null;
        m.series.forEach(function (x) { if (x.id === String(h.series)) s = x; });
        if (!s && m.series.length === 1) s = m.series[0];
        if (!s) return;
        var yv = h.y !== undefined ? h.y : (s.fn ? s.fn(h.x) : L.valueAt(s.pts, h.x));
        if (yv === null || !isFinite(yv)) return;
        var rec = S.hls.use('h' + i, buildHl);
        rec.dv = { x: h.x, y: yv };
        colorClass(rec.el, s, s.index);
        var txt = h.label !== undefined ? String(h.label) : valueText(yv, s);
        vz.text(rec.text, txt);
        var tw = measure(txt, 11.5, 700) + 16;
        vz.set(rec.pill, 'width', N2(tw)); vz.set(rec.pill, 'x', N2(-tw / 2));
        var X = P.x(h.x), Y = sy(yv);
        var above = Y - 34 > P.top - 10;
        vz.set(rec.pill, 'y', above ? -34 : 14); vz.set(rec.text, 'y', above ? -24 : 24);
        var t = { x: X, y: Y, o: Y >= P.top - 2 && Y <= P.bottom + 2 ? 1 : 0, s: 1 };
        if (rec.isNew) { rec.cur = { x: X, y: Y, o: animate ? 0 : t.o, s: animate ? 2 : 1 }; rec.delay = intro ? 0.7 : 0; }
        else rec.delay = 0;
        vz.retarget(rec, t); push(rec);
      });
      S.hls.end().forEach(function (rec) {
        rec.from = Object.assign({}, rec.cur);
        rec.to = Object.assign({}, rec.cur, { o: 0 });
        if (rec.dv && m.type !== 'bar' && P.x) { var nx = P.x(rec.dv.x), ny = sy(rec.dv.y); if (isFinite(nx) && isFinite(ny)) { rec.to.x = nx; rec.to.y = ny; } }
        rec.delay = 0; push(rec);
      });

      lastScales = { x: P.x, y: P.y };
      if (hoverX !== null && m.type !== 'bar') showHoverAt(hoverX); else hideHover();

      /* run */
      var total = intro ? ms * 1.6 : ms;
      var introT = { w: 0 };
      tr.run(total, function (t) {
        if (intro) { introT.w = vz.easeInOut(Math.min(1, t / 0.8)); vz.set(clipRect, 'width', N2(fullClipW * introT.w)); }
        for (var i = 0; i < anim.length; i++) {
          var rec = anim[i];
          var e = vz.local(t, rec.delay);
          if (rec.labelDelay) {
            // labels wait for the reveal to reach the end of the line
            var le = vz.local(t, 0.7);
            vz.step(rec, e); rec.cur.lo = rec.from.lo + (rec.to.lo - rec.from.lo) * le;
          } else vz.step(rec, e);
          if (rec.oDelay || rec.oSpan) rec.cur.o = rec.from.o + (rec.to.o - rec.from.o) * vz.local(t, rec.oDelay || 0, rec.oSpan || undefined);
          rec.paint(rec);
        }
      }, function () {
        if (intro) vz.set(clipRect, 'width', N2(fullClipW));
        S.series.each(function (r) { r.labelDelay = false; });
        Object.keys(S).forEach(function (k) { S[k].purge(); });
      });
    }

    /* ---------------------------------------------------------- hover crosshair + keyboard */
    var hov = null, hoverX = null, live = null;
    function ensureHover() {
      if (hov) return hov;
      var g = vz.svg('g', { class: 'vz-hover', opacity: '0' }, ctx.layers.hover);
      hov = { g: g, line: vz.svg('line', { class: 'vz-crosshair' }, g), dots: vz.svg('g', null, g), tip: vz.svg('g', { class: 'vz-tip' }, g) };
      hov.tipShadow = vz.svg('rect', { class: 'vz-tip-shadow', rx: 8, ry: 8 }, hov.tip);
      hov.tipRect = vz.svg('rect', { class: 'vz-tip-box', rx: 8, ry: 8 }, hov.tip);
      hov.rows = vz.svg('g', null, hov.tip);
      return hov;
    }
    function hideHover() { if (hov) vz.set(hov.g, 'opacity', '0'); hoverX = null; }
    function snapXs() {
      if (!model || model.type === 'bar') return null;
      var any = model.series.some(function (s) { return !!s.fn; });
      if (any) return null;
      var set = {};
      model.series.forEach(function (s) { s.pts.forEach(function (p) { if (isFinite(p[0])) set[p[0]] = true; }); });
      return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    }
    function showHoverAt(xv) {
      if (!model || !P || model.type === 'bar') return;
      var xs = snapXs();
      if (xs && xs.length) { var best = xs[0]; xs.forEach(function (v) { if (Math.abs(v - xv) < Math.abs(best - xv)) best = v; }); xv = best; }
      else {
        xv = vz.clamp(xv, model.x.min, model.x.max);
        var span = model.x.max - model.x.min;
        if (model.x.type !== 'log' && span >= 10) xv = Math.round(xv);
        else if (model.x.type !== 'log') xv = +xv.toPrecision(3);
        else xv = +xv.toPrecision(2);
      }
      hoverX = xv;
      var h = ensureHover();
      var X = P.x(xv);
      vz.set(h.g, 'opacity', null);
      vz.set(h.line, 'x1', N2(Math.round(X) + 0.5)); vz.set(h.line, 'x2', N2(Math.round(X) + 0.5));
      vz.set(h.line, 'y1', N2(P.top)); vz.set(h.line, 'y2', N2(P.bottom));
      while (h.dots.firstChild) h.dots.removeChild(h.dots.firstChild);
      while (h.rows.firstChild) h.rows.removeChild(h.rows.firstChild);
      var rows = [];
      model.series.forEach(function (s) {
        var v = s.fn ? (function () { try { return s.fn(xv); } catch (_) { return NaN; } })() : (model.type === 'scatter' ? nearestY(s, xv) : L.valueAt(s.pts, xv));
        if (v === null || v === undefined) return;
        rows.push({ s: s, v: v });
        var Y = P.y(v);
        if (isFinite(Y) && Y >= P.top - 1 && Y <= P.bottom + 1) {
          var d = vz.svg('circle', { class: 'vz-hover-dot', cx: N2(X), cy: N2(Y), r: 4 }, h.dots);
          colorClass(d, s, s.index);
        }
      });
      rows.sort(function (a, b) { return (isFinite(b.v) ? b.v : -Infinity) - (isFinite(a.v) ? a.v : -Infinity); });
      var title = (model.xs.label || 'x') + ' = ' + L.formatValue(xv);
      var lineH = 17, pad = 9, w = measure(title, 12, 700);
      var tt = vz.svg('text', { class: 'vz-tip-title', x: pad, y: pad + 7, dy: '.35em' }, h.rows);
      tt.textContent = title;
      rows.forEach(function (r, i) {
        var y = pad + 7 + (i + 1) * lineH;
        var sw = vz.svg('circle', { class: 'vz-tip-swatch', cx: pad + 4, cy: y, r: 4 }, h.rows);
        colorClass(sw, r.s, r.s.index);
        var lab = vz.svg('text', { class: 'vz-tip-label', x: pad + 13, y: y, dy: '.35em' }, h.rows);
        lab.textContent = r.s.label;
        var val = valueText(r.v, r.s);
        var vt = vz.svg('text', { class: 'vz-tip-value', y: y, dy: '.35em', 'text-anchor': 'end' }, h.rows);
        vt.textContent = val;
        r.vt = vt;
        w = Math.max(w, 13 + measure(r.s.label, 12, 500) + 18 + measure(val, 12, 700));
      });
      var bw = w + pad * 2, bh = pad * 2 + 14 + rows.length * lineH - 3;
      rows.forEach(function (r) { vz.set(r.vt, 'x', N2(bw - pad)); });
      vz.set(h.tipRect, 'width', N2(bw)); vz.set(h.tipRect, 'height', N2(bh));
      vz.set(h.tipShadow, 'width', N2(bw)); vz.set(h.tipShadow, 'height', N2(bh)); vz.set(h.tipShadow, 'y', 2);
      var tx = X + 12;
      if (tx + bw > ctx.width - 4) tx = X - 12 - bw;
      if (tx < 2) tx = 2;
      vz.place(h.tip, tx, P.top + 4);
      if (live) live.textContent = title + '. ' + rows.map(function (r) { return r.s.label + ' ' + valueText(r.v, r.s); }).join(', ') + '.';
      em.emit('hover', { x: xv, values: rows.map(function (r) { return { series: r.s.id, value: r.v }; }) });
    }
    function nearestY(s, x) {
      var best = null, bd = Infinity;
      s.pts.forEach(function (p) { var d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = p[1]; } });
      return best;
    }
    function onMove(ev) {
      if (!opts.hover || !P || !model || model.type === 'bar') return;
      var p = vz.pointer(svg, ev);
      if (p.x < P.left - 4 || p.x > P.right + 4 || p.y < P.top - 10 || p.y > P.bottom + 10) { hideHover(); return; }
      showHoverAt(P.x.invert(vz.clamp(p.x, P.left, P.right)));
    }
    if (opts.hover && opts.type !== 'bar') {
      svg.addEventListener('pointermove', onMove);
      svg.addEventListener('pointerdown', onMove);
      svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hideHover(); });
      svg.setAttribute('tabindex', '0');
      svg.classList.add('vz-host-focus', 'is-hoverable');
      svg.setAttribute('role', 'img');
      live = doc.createElement('div');
      live.className = 'vz-sr';
      live.setAttribute('aria-live', 'polite');
      ctx.host.appendChild(live);
      svg.addEventListener('keydown', function (ev) {
        if (!model || !P) return;
        var xs = snapXs();
        var cur = hoverX === null ? (state0HighlightX() !== null ? state0HighlightX() : model.x.min) : hoverX;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          var dir = ev.key === 'ArrowRight' ? 1 : -1;
          if (hoverX === null) { showHoverAt(cur); return; }
          if (xs && xs.length) {
            var i = 0; while (i < xs.length - 1 && xs[i] < cur - 1e-9) i++;
            var j = vz.clamp(i + dir, 0, xs.length - 1);
            showHoverAt(xs[j]);
          } else if (model.x.type === 'log') showHoverAt(cur * Math.pow(10, dir * (Math.log10(model.x.max / model.x.min) / 24)));
          else { var stepX = (model.x.max - model.x.min) / 24; if (model.x.max - model.x.min >= 24) stepX = Math.max(1, Math.round(stepX)); showHoverAt(cur + dir * stepX); }
        } else if (ev.key === 'Escape') hideHover();
        else if (ev.key === 'Home') { ev.preventDefault(); showHoverAt(model.x.min); }
        else if (ev.key === 'End') { ev.preventDefault(); showHoverAt(model.x.max); }
      });
      svg.addEventListener('blur', hideHover);
    }
    function state0HighlightX() {
      var st = api.state && api.state();
      var h = st && st.highlight;
      if (Array.isArray(h)) h = h[0];
      return h && h.x !== undefined ? h.x : null;
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var m;
      try { m = buildModel(state || {}); } catch (_) { return ''; }
      if (m.type === 'bar') {
        return 'Bar chart: ' + m.series.map(function (s) {
          return s.label + ' — ' + m.categories.map(function (c, i) { return c + ' ' + L.formatValue(s.raw.values ? s.raw.values[i] : NaN); }).join(', ');
        }).join('; ') + '.';
      }
      var parts = [(m.type === 'scatter' ? 'Scatter plot' : 'Line chart') + (m.ys.label ? ' of ' + m.ys.label : '') + (m.xs.label ? ' against ' + m.xs.label : '') + (m.y.type === 'log' ? ' (log scale)' : '') + '.'];
      m.series.forEach(function (s) {
        var vis = s.pts.filter(function (p) { return isFinite(p[1]) && p[0] >= m.x.min && p[0] <= m.x.max; });
        if (!vis.length) return;
        var last = vis[vis.length - 1];
        parts.push(s.label + ': ' + vis.length + ' points, reaching ' + L.formatValue(last[1]) + ' at ' + (m.xs.label || 'x') + ' = ' + L.formatValue(last[0]) + '.');
      });
      return parts.join(' ');
    };
    api.hover = function (x) { if (x === null || x === undefined) hideHover(); else showHoverAt(x); return api; };
    api.setOptions = function (o) {
      Object.assign(opts, o || {});
      textCache.clear();
      api.refresh();
      return api;
    };
    var baseDestroy = api.destroy;
    api.destroy = function () { baseDestroy(); if (live && live.parentNode) live.parentNode.removeChild(live); };
    return api;
  }

  chartView.layout = L;
  chartView.defaults = DEFAULTS;
  VDSA.views.chart = chartView;
}(typeof window !== 'undefined' ? window : null));
