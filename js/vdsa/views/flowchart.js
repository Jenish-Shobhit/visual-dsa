/* VDSA.views.flowchart(container, spec, options) — flowcharts and decision diagrams on a grid, with
   orthogonal rounded edge routing, a token that travels along the edge the trace takes, and an interactive
   decision-tree mode.

   const flow = VDSA.views.flowchart('#flow', {
     nodes: [
       { id: 'start', type: 'start', text: 'Start', col: 0, row: 0 },
       { id: 'test', type: 'decision', text: 'i < n ?', col: 0, row: 1 },
       { id: 'body', type: 'process', text: 'i = i + 1', col: 0, row: 2 },
       { id: 'stop', type: 'end', text: 'Return −1', col: 1, row: 1 }
     ],
     edges: [
       { from: 'start', to: 'test' },
       { from: 'test', to: 'body', label: 'yes' },
       { from: 'test', to: 'stop', label: 'no' },
       { from: 'body', to: 'test' }                       // loop back: routed around the side
     ]
   });
   flow.render({ active: 'test', visited: ['start'] }, { duration: ctx.duration });  // token travels start -> test

   Node types: start | end (pill), process (rounded rect), decision (diamond; hexagon when compact),
   io (parallelogram), note (dashed box). Edge `via`: { fromSide, toSide } ('top'|'right'|'bottom'|'left')
   and/or `points: [[col,row], ...]` waypoints in grid units (x.5 = the channel between two columns/rows).

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> flowchart.
*/
(function (root) {
  'use strict';

  var vzp = (root && root.VDSA && root.VDSA.vz) ||
    (typeof module === 'object' && module.exports && typeof require === 'function' ? require('./base.js') : null);

  /* ================================================================== pure layout + routing (Node-testable) */
  var L = {};
  var SIDES = ['bottom', 'right', 'left', 'top'];
  var NORMAL = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
  var STUB = 16;
  /* Fit levels, tried in order until the chart fits the width. */
  var LEVELS = [
    { font: 13, maxText: 150, colGap: 56, rowGap: 38 },
    { font: 12.5, maxText: 124, colGap: 46, rowGap: 34 },
    { font: 12, maxText: 104, colGap: 38, rowGap: 30 },
    { font: 11.5, maxText: 86, colGap: 30, rowGap: 28 },
    { font: 11, maxText: 72, colGap: 24, rowGap: 26 },
    { font: 10.5, maxText: 60, colGap: 20, rowGap: 24 }
  ];
  L.LEVELS = LEVELS;
  L.LABEL_FONT = 10.5;

  function defaultMeasure(text, px, weight) {
    return vzp.approxWidth(text, px) * (weight && weight >= 600 ? 1.06 : 1);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function r2(v) { return Math.round(v * 100) / 100; }

  /* Size one node for a fit level: wrapped lines and outer w/h. */
  L.sizeNode = function (n, lv, decisionShape, measure) {
    var type = n.type || 'process';
    var font = lv.font, lineH = Math.round(font * 1.32 * 10) / 10;
    var mt = n.maxWidth || lv.maxText;
    if (type === 'decision') mt *= decisionShape === 'diamond' ? 0.86 : 0.95;
    var m = function (s) { return measure(s, font, 550); };
    var lines = [];
    String(n.text === undefined ? '' : n.text).split('\n').forEach(function (part) { lines = lines.concat(vzp.wrap(part, mt, font, m)); });
    var widths = lines.map(m);
    var tw = Math.max.apply(null, widths.concat([0])), th = lines.length * lineH;
    var out = { id: String(n.id), type: type, lines: lines, lineH: lineH, font: font, shape: type, skew: 0 };
    if (type === 'start' || type === 'end') {
      out.h = Math.max(th + 14, 30); out.w = Math.max(tw + out.h * 0.9 + 8, 64); out.shape = 'pill';
    } else if (type === 'decision') {
      if (decisionShape === 'diamond') {
        // every line must fit inside the diamond at its own height: a >= w_i/2 + pad + r*(|y_i| + lineH/2)
        var r = 2, pad = 7, a = 0;
        widths.forEach(function (w, i) {
          var yi = Math.abs((i - (lines.length - 1) / 2) * lineH);
          a = Math.max(a, w / 2 + pad + r * (yi + lineH / 2 + 2));
        });
        a = Math.max(a, 40);
        out.w = 2 * a; out.h = Math.max(2 * a / r, 44); out.shape = 'diamond';
      } else {
        out.h = Math.max(th + 14, 32); out.skew = Math.min(out.h * 0.42, 16);
        out.w = Math.max(tw + 18 + 2 * out.skew, 64); out.shape = 'hexagon';
      }
    } else if (type === 'io') {
      out.h = Math.max(th + 16, 32); out.skew = Math.min(out.h * 0.32, 14);
      out.w = Math.max(tw + 24 + out.skew, 64); out.shape = 'io';
    } else {
      out.h = Math.max(th + 16, 32); out.w = Math.max(tw + 24, 60); out.shape = type === 'note' ? 'note' : 'rect';
    }
    out.w = Math.ceil(out.w); out.h = Math.ceil(out.h);
    return out;
  };

  function layoutAt(spec, lv, li, opts) {
    var measure = opts.measure || defaultMeasure;
    var shapeOpt = opts.decisionShape || 'auto';
    var decShape = shapeOpt === 'auto' ? (li >= 3 ? 'hexagon' : 'diamond') : shapeOpt;
    var nodes = spec.nodes || [], edges = spec.edges || [];
    var sized = {}, ncols = 1, nrows = 1;
    nodes.forEach(function (n) {
      sized[n.id] = L.sizeNode(n, lv, decShape, measure);
      ncols = Math.max(ncols, Math.round(n.col || 0) + 1);
      nrows = Math.max(nrows, Math.round(n.row || 0) + 1);
    });
    var colW = [], rowH = [], c, r;
    for (c = 0; c < ncols; c++) colW[c] = 0;
    for (r = 0; r < nrows; r++) rowH[r] = 0;
    nodes.forEach(function (n) {
      var s = sized[n.id], ci = Math.round(n.col || 0), ri = Math.round(n.row || 0);
      if (Math.abs((n.col || 0) - ci) < 1e-6) colW[ci] = Math.max(colW[ci], s.w);
      if (Math.abs((n.row || 0) - ri) < 1e-6) rowH[ri] = Math.max(rowH[ri], s.h);
    });
    for (c = 0; c < ncols; c++) if (!colW[c]) colW[c] = 40;
    for (r = 0; r < nrows; r++) if (!rowH[r]) rowH[r] = 30;
    var labelW = 0;
    edges.forEach(function (e) { if (e.label !== undefined && e.label !== null && e.label !== '') labelW = Math.max(labelW, measure(String(e.label), L.LABEL_FONT, 650) + 14); });
    var colGap = opts.colGap || Math.max(lv.colGap, labelW ? labelW + (li >= 3 ? 12 : 30) : 0);
    var rowGap = opts.rowGap || Math.max(lv.rowGap, labelW ? 36 : 0);
    var padX = Math.max(18, colGap * 0.5 + 4), padY = Math.max(12, rowGap * 0.4 + 4);
    var colX = [], rowY = [], x = padX, y = padY;
    for (c = 0; c < ncols; c++) { colX[c] = x + colW[c] / 2; x += colW[c] + (c < ncols - 1 ? colGap : 0); }
    for (r = 0; r < nrows; r++) { rowY[r] = y + rowH[r] / 2; y += rowH[r] + (r < nrows - 1 ? rowGap : 0); }
    var width = x + padX, height = y + padY;
    var xs = [padX * 0.5], ys = [padY * 0.5];
    for (c = 0; c < ncols - 1; c++) xs.push(((colX[c] + colW[c] / 2) + (colX[c + 1] - colW[c + 1] / 2)) / 2);
    xs.push(width - padX * 0.5);
    for (r = 0; r < nrows - 1; r++) ys.push(((rowY[r] + rowH[r] / 2) + (rowY[r + 1] - rowH[r + 1] / 2)) / 2);
    ys.push(height - padY * 0.5);

    function axis(v, centers, channels) {
      var n = centers.length;
      var fl = Math.floor(v), fr = v - fl;
      if (Math.abs(fr - 0.5) < 1e-6) return channels[clamp(fl + 1, 0, channels.length - 1)];
      if (fr < 1e-6 && fl >= 0 && fl < n) return centers[fl];
      if (fr > 1 - 1e-6 && fl + 1 >= 0 && fl + 1 < n) return centers[fl + 1];
      var a = centers[clamp(fl, 0, n - 1)], b = centers[clamp(fl + 1, 0, n - 1)];
      if (fl < 0) return centers[0] - (centers[0] - channels[0]) * Math.min(1, -v * 2);
      if (fl >= n - 1) return centers[n - 1] + (channels[channels.length - 1] - centers[n - 1]) * Math.min(1, (v - (n - 1)) * 2);
      return a + (b - a) * fr;
    }
    var g = {
      width: width, height: height, level: li, font: lv.font, decisionShape: decShape,
      cols: colX.map(function (cx, i) { return { x: cx, w: colW[i] }; }),
      rows: rowY.map(function (cy, i) { return { y: cy, h: rowH[i] }; }),
      colGap: colGap, rowGap: rowGap, padX: padX, padY: padY, labelW: labelW,
      channels: { xs: xs, ys: ys }, nodes: {}
    };
    g.gx = function (col) { return axis(col, colX, xs); };
    g.gy = function (row) { return axis(row, rowY, ys); };
    nodes.forEach(function (n) {
      var s = sized[n.id];
      s.x = g.gx(n.col || 0); s.y = g.gy(n.row || 0);
      g.nodes[String(n.id)] = s;
    });
    return g;
  }

  /* Geometry for a spec at a container width. Tries the fit levels; if even the most compact one is too wide
     it sets `scale` (never below opts.minScale, default .55) and the view scales the drawing. */
  L.compute = function (spec, width, opts) {
    opts = opts || {};
    spec = spec || {};
    var narrow = !!width && width < (opts.narrowWidth || 480) && (spec.nodes || []).some(function (n) { return n.narrow; });
    if (narrow) {
      spec = { edges: spec.edges, nodes: spec.nodes.map(function (n) { return n.narrow ? Object.assign({}, n, n.narrow) : n; }) };
    }
    var start = opts.compact ? 3 : 0, g = null;
    for (var li = start; li < LEVELS.length; li++) {
      g = layoutAt(spec, LEVELS[li], li, opts);
      if (!width || g.width <= width) break;
    }
    g.narrow = narrow;
    g.scale = width && g.width > width ? Math.max(opts.minScale || 0.55, width / g.width) : 1;
    g.offsetX = width ? Math.max(0, (width - g.width * g.scale) / 2) : 0;
    return g;
  };

  /* Point on a node's boundary for a side, shifted along the side by `off` px (parallel edges). */
  L.portPoint = function (n, side, off) {
    off = off || 0;
    var x = n.x, y = n.y, hw = n.w / 2, hh = n.h / 2, sh = n.shape;
    var horiz = side === 'left' || side === 'right', sgn = side === 'left' || side === 'top' ? -1 : 1;
    if (sh === 'diamond') {
      if (horiz) { var oy = clamp(off, -hh * 0.6, hh * 0.6); return [x + sgn * hw * (1 - Math.abs(oy) / hh), y + oy]; }
      var ox = clamp(off, -hw * 0.6, hw * 0.6); return [x + ox, y + sgn * hh * (1 - Math.abs(ox) / hw)];
    }
    if (sh === 'pill') {
      var rr = hh;
      if (horiz) { var o = clamp(off, -rr * 0.75, rr * 0.75); return [x + sgn * (hw - rr + Math.sqrt(rr * rr - o * o)), y + o]; }
      return [x + clamp(off, -(hw - rr), hw - rr), y + sgn * hh];
    }
    if (sh === 'hexagon') {
      if (horiz) { var o2 = clamp(off, -hh * 0.7, hh * 0.7); return [x + sgn * (hw - n.skew * Math.abs(o2) / hh), y + o2]; }
      return [x + clamp(off, -(hw - n.skew), hw - n.skew), y + sgn * hh];
    }
    if (sh === 'io') {
      if (horiz) {
        var o3 = clamp(off, -hh * 0.7, hh * 0.7), t = (hh - o3) / (2 * hh);  // 0 at bottom, 1 at top
        return side === 'left' ? [x - hw + n.skew * t, y + o3] : [x + hw - n.skew + n.skew * t, y + o3];
      }
      var lim = hw - n.skew;
      return [x + clamp(off, -lim, lim), y + sgn * hh];
    }
    if (horiz) return [x + sgn * hw, y + clamp(off, -hh + 4, hh - 4)];
    return [x + clamp(off, -hw + 6, hw - 6), y + sgn * hh];
  };

  function box(n) { return { x1: n.x - n.w / 2, y1: n.y - n.h / 2, x2: n.x + n.w / 2, y2: n.y + n.h / 2 }; }
  function segHits(p, q, b, m) {
    var minx = Math.min(p[0], q[0]), maxx = Math.max(p[0], q[0]), miny = Math.min(p[1], q[1]), maxy = Math.max(p[1], q[1]);
    return maxx > b.x1 - m && minx < b.x2 + m && maxy > b.y1 - m && miny < b.y2 + m;
  }
  L.segHits = segHits;
  function sgn(v) { return v > 0.25 ? 1 : v < -0.25 ? -1 : 0; }

  /* Remove duplicate and collinear points; null if the path doubles back on itself. */
  L.simplify = function (pts) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], last = out[out.length - 1];
      if (Math.abs(p[0] - last[0]) < 0.5 && Math.abs(p[1] - last[1]) < 0.5) continue;
      if (out.length >= 2) {
        var prev = out[out.length - 2];
        var d1 = [sgn(last[0] - prev[0]), sgn(last[1] - prev[1])], d2 = [sgn(p[0] - last[0]), sgn(p[1] - last[1])];
        if ((d1[0] === 0 && d2[0] === 0) || (d1[1] === 0 && d2[1] === 0)) {
          if (d1[0] === d2[0] && d1[1] === d2[1]) { out[out.length - 1] = p; continue; }
          return null;
        }
      }
      out.push(p);
    }
    return out;
  };

  function candidates(a, b, xs, ys) {
    var out = [];
    if (Math.abs(a[0] - b[0]) < 0.5 || Math.abs(a[1] - b[1]) < 0.5) out.push([a, b]);
    out.push([a, [b[0], a[1]], b], [a, [a[0], b[1]], b]);
    xs.forEach(function (x) { out.push([a, [x, a[1]], [x, b[1]], b]); });
    ys.forEach(function (y) { out.push([a, [a[0], y], [b[0], y], b]); });
    ys.forEach(function (y) {
      xs.forEach(function (x) {
        out.push([a, [a[0], y], [x, y], [x, b[1]], b]);
        out.push([a, [x, a[1]], [x, y], [b[0], y], b]);
      });
    });
    return out;
  }
  function orthogonalize(a, wps, b) {
    var pts = [a], cur = a, vertical = null;
    wps.concat([b]).forEach(function (p) {
      if (Math.abs(p[0] - cur[0]) > 0.5 && Math.abs(p[1] - cur[1]) > 0.5) {
        var corner = vertical ? [cur[0], p[1]] : [p[0], cur[1]];
        pts.push(corner);
        vertical = !vertical;
      } else vertical = Math.abs(p[0] - cur[0]) < 0.5;
      pts.push(p); cur = p;
    });
    return pts;
  }
  function pathLen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); return s; }
  function segsOf(pts) {
    var out = [];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i], h = Math.abs(p[1] - q[1]) < 0.5;
      out.push({ h: h, c: h ? p[1] : p[0], lo: h ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), hi: h ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]) });
    }
    return out;
  }
  function overlapCost(pts, placed) {
    var cost = 0, mine = segsOf(pts);
    for (var i = 0; i < mine.length; i++) {
      var s = mine[i];
      for (var j = 0; j < placed.length; j++) {
        var t = placed[j];
        if (s.h === t.h) {
          if (Math.abs(s.c - t.c) < 4) { var o = Math.min(s.hi, t.hi) - Math.max(s.lo, t.lo); if (o > 1) cost += 30 + o * 0.5; }
        } else if (t.c > s.lo + 1 && t.c < s.hi - 1 && s.c > t.lo + 1 && s.c < t.hi - 1) cost += 10; // crossing
      }
    }
    return cost;
  }
  function sidePenalty(A, B, s1, s2) {
    var vx = B.x - A.x, vy = B.y - A.y, p = 0;
    var d1 = NORMAL[s1], d2 = [-NORMAL[s2][0], -NORMAL[s2][1]];
    if (A === B) return s1 === s2 ? 200 : 0;
    if (d1[0] * vx + d1[1] * vy < -1) p += 90;
    if (d2[0] * vx + d2[1] * vy < -1) p += 90;
    if (s1 === 'top') p += 22;
    if (s2 === 'bottom') p += 22;
    var below = vy > (A.h + B.h) / 2;
    if (below && (s2 === 'left' || s2 === 'right')) p += 60;      // downward flow enters from the top
    if (below && Math.abs(vx) < A.w / 2 && s1 !== 'bottom') p += 30; // ...and leaves from the bottom when aligned
    if (vy < -1 && (s1 === 'right' || s2 === 'right')) p += 8;   // loop-backs prefer the left side
    return p;
  }

  /* Route every edge orthogonally. Returns [{index, from, to, label, points:[[x,y]...], fromSide, toSide, labelAt}]
     (null for edges whose nodes are missing). Points start and end on node boundaries; consecutive points
     share an x or a y; interior segments avoid every node box. */
  L.route = function (spec, geo) {
    var edges = (spec && spec.edges) || [], nodes = geo.nodes;
    var boxes = [];
    Object.keys(nodes).forEach(function (id) { boxes.push({ id: id, b: box(nodes[id]) }); });
    var off = function (v) { return [v, v - 7, v + 7]; };
    var xs = [], ys = [];
    geo.channels.xs.forEach(function (x) { xs = xs.concat(off(x)); });
    geo.channels.ys.forEach(function (y) { ys = ys.concat(off(y)); });

    function routeOne(e, i, placed, used, fixed) {
      var A = nodes[String(e.from)], B = nodes[String(e.to)];
      if (!A || !B) return null;
      var via = e.via || {};
      var wps = Array.isArray(via) ? via : via.points;
      wps = wps ? wps.map(function (p) { return [geo.gx(p[0]), geo.gy(p[1])]; }) : null;
      var s1s = fixed ? [fixed.s1] : via.fromSide ? [via.fromSide] : SIDES;
      var s2s = fixed ? [fixed.s2] : via.toSide ? [via.toSide] : SIDES;
      var best = null, bestScore = Infinity, fallback = null, fallbackScore = Infinity;
      s1s.forEach(function (s1) {
        s2s.forEach(function (s2) {
          var P = L.portPoint(A, s1, fixed ? fixed.o1 : 0), Q = L.portPoint(B, s2, fixed ? fixed.o2 : 0);
          var n1 = NORMAL[s1], n2 = NORMAL[s2];
          var a = [P[0] + n1[0] * STUB, P[1] + n1[1] * STUB], b = [Q[0] + n2[0] * STUB, Q[1] + n2[1] * STUB];
          var pen = sidePenalty(A, B, s1, s2);
          var u1 = used[A.id + '|' + s1], u2 = used[B.id + '|' + s2];
          if (u1) pen += u1.inn ? 45 : (A.type === 'decision' ? 45 : 10);
          if (u2) pen += u2.out ? 45 : 6;
          var mids = wps ? [orthogonalize(a, wps, b)] : candidates(a, b, xs, ys);
          mids.forEach(function (mid) {
            var pts = L.simplify([P].concat(mid, [Q]));
            if (!pts || pts.length < 2) return;
            var score = pathLen(pts) + 26 * (pts.length - 2) + pen;
            if (score >= bestScore && score >= fallbackScore) return;
            var ok = pathClear(pts, A.id, B.id);
            if (ok) {
              score += overlapCost(pts, placed);
              if (score < bestScore) { bestScore = score; best = { pts: pts, s1: s1, s2: s2 }; }
            } else if (score + 5000 < fallbackScore) { fallbackScore = score + 5000; fallback = { pts: pts, s1: s1, s2: s2 }; }
          });
        });
      });
      var pick = best || fallback;
      if (!pick) return null;
      return { index: i, from: String(e.from), to: String(e.to), label: e.label, points: pick.pts, fromSide: pick.s1, toSide: pick.s2, clear: !!best };
    }
    function pathClear(pts, idA, idB) {
      var last = pts.length - 2;
      for (var i = 0; i < pts.length - 1; i++) {
        for (var k = 0; k < boxes.length; k++) {
          var id = boxes[k].id;
          if ((i === 0 && id === idA) || (i === last && id === idB)) continue;
          var m = id === idA || id === idB ? 2 : 6;
          if (segHits(pts[i], pts[i + 1], boxes[k].b, m)) return false;
        }
      }
      return true;
    }
    function register(r, placed, used) {
      if (!r) return;
      placed.push.apply(placed, segsOf(r.points));
      var k1 = r.from + '|' + r.fromSide, k2 = r.to + '|' + r.toSide;
      (used[k1] = used[k1] || {}).out = true;
      (used[k2] = used[k2] || {}).inn = true;
    }

    // pass 1: choose sides and routes with centred ports
    var placed = [], used = {}, routes = [];
    edges.forEach(function (e, i) { var r = routeOne(e, i, placed, used, null); routes[i] = r; register(r, placed, used); });

    // pass 2: spread edges that share a node side, then re-route with fixed sides
    var groups = {};
    routes.forEach(function (r) {
      if (!r) return;
      (groups[r.from + '|' + r.fromSide] = groups[r.from + '|' + r.fromSide] || []).push({ r: r, end: 'from' });
      (groups[r.to + '|' + r.toSide] = groups[r.to + '|' + r.toSide] || []).push({ r: r, end: 'to' });
    });
    var offsets = {};
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      var id = k.slice(0, k.lastIndexOf('|')), side = k.slice(k.lastIndexOf('|') + 1), n = nodes[id];
      var horiz = side === 'top' || side === 'bottom';
      g.sort(function (p, q) {
        var op = nodes[p.end === 'from' ? p.r.to : p.r.from], oq = nodes[q.end === 'from' ? q.r.to : q.r.from];
        var d = horiz ? op.x - oq.x : op.y - oq.y;
        return d || p.r.index - q.r.index;
      });
      var len = horiz ? n.w : n.h;
      var spacing = Math.min(12, len * 0.5 / (g.length - 1));
      // an edge that is a straight line keeps the centre of the side; the others spread around it
      var centre = (g.length - 1) / 2;
      for (var j = 0; j < g.length; j++) if (g[j].r.points.length === 2) { centre = j; break; }
      g.forEach(function (it, j) { offsets[it.r.index + ':' + it.end] = (j - centre) * spacing; });
    });
    if (Object.keys(offsets).length) {
      placed = []; used = {};
      routes = routes.map(function (r, i) {
        if (!r) return null;
        var nr = routeOne(edges[i], i, placed, used, { s1: r.fromSide, s2: r.toSide, o1: offsets[i + ':from'] || 0, o2: offsets[i + ':to'] || 0 });
        register(nr, placed, used);
        return nr;
      });
    }
    routes.forEach(function (r) {
      if (!r) return;
      var total = vzp.polylineLength(r.points);
      var d = clamp(total * 0.34, 12, 24);
      var p = vzp.pointOnPolyline(r.points, total ? d / total : 0);
      r.labelAt = [r2(p.x), r2(p.y)];
    });
    return routes;
  };

  /* Closed polygon with rounded corners. */
  function roundedPolygon(pts, r) {
    var d = '', n = pts.length;
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var rr = Math.min(r, d1 / 2, d2 / 2);
      var ax = p1[0] + (p0[0] - p1[0]) * rr / d1, ay = p1[1] + (p0[1] - p1[1]) * rr / d1;
      var bx = p1[0] + (p2[0] - p1[0]) * rr / d2, by = p1[1] + (p2[1] - p1[1]) * rr / d2;
      d += (i === 0 ? 'M' : 'L') + r2(ax) + ' ' + r2(ay) + 'Q' + r2(p1[0]) + ' ' + r2(p1[1]) + ' ' + r2(bx) + ' ' + r2(by);
    }
    return d + 'Z';
  }
  /* SVG path for a sized, positioned node. */
  L.shapePath = function (n) {
    var x1 = n.x - n.w / 2, x2 = n.x + n.w / 2, y1 = n.y - n.h / 2, y2 = n.y + n.h / 2, k = n.skew;
    switch (n.shape) {
      case 'pill':
        var r = n.h / 2;
        return 'M' + r2(x1 + r) + ' ' + r2(y1) + 'H' + r2(x2 - r) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x2 - r) + ' ' + r2(y2) +
          'H' + r2(x1 + r) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x1 + r) + ' ' + r2(y1) + 'Z';
      case 'diamond': return roundedPolygon([[n.x, y1], [x2, n.y], [n.x, y2], [x1, n.y]], 5);
      case 'hexagon': return roundedPolygon([[x1 + k, y1], [x2 - k, y1], [x2, n.y], [x2 - k, y2], [x1 + k, y2], [x1, n.y]], 4);
      case 'io': return roundedPolygon([[x1 + k, y1], [x2, y1], [x2 - k, y2], [x1, y2]], 4);
      default: return roundedPolygon([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], 8);
    }
  };

  /* Resolve an edge reference ({from,to[,label]} | index | 'a->b' | edge id) to an index, or -1. */
  L.edgeIndex = function (spec, ref) {
    var edges = (spec && spec.edges) || [];
    if (ref === null || ref === undefined) return -1;
    if (typeof ref === 'number') return ref >= 0 && ref < edges.length ? ref : -1;
    if (typeof ref === 'string') {
      for (var i = 0; i < edges.length; i++) if (edges[i].id !== undefined && String(edges[i].id) === ref) return i;
      var m = ref.split('->');
      if (m.length === 2) ref = { from: m[0], to: m[1] }; else return -1;
    }
    for (var j = 0; j < edges.length; j++) {
      var e = edges[j];
      if (String(e.from) === String(ref.from) && String(e.to) === String(ref.to) && (ref.label === undefined || e.label === ref.label)) return j;
    }
    return -1;
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz;

  var DEFAULTS = {
    compact: false,           // start at the compact fit levels (smaller type, hexagon decisions)
    decisionShape: 'auto',    // 'auto' (diamond, hexagon when compact) | 'diamond' | 'hexagon'
    minScale: 0.55,           // if even compact does not fit, scale the drawing down to at least this
    interactive: false,       // decision-tree mode: labelled edges become buttons, nodes clickable
    token: true,              // animate a token along the taken edge
    colGap: null, rowGap: null,
    onChoose: null, onNodeClick: null,
    label: null, duration: undefined
  };

  function flowchartView(container, spec, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    spec = spec || { nodes: [], edges: [] };
    var V = vz.createView(container, 'flowchart', {
      label: opts.label || 'Flowchart', interactive: !!opts.interactive, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    var content = vz.svg('g', { class: 'vz-flow-content' }, ctx.svg);
    var layers = {};
    ['edges', 'nodes', 'labels', 'token'].forEach(function (n) { layers[n] = vz.svg('g', { class: 'vz-layer vz-layer-' + n }, content); });
    var trail = null, token = null;     // exist only while a token is travelling
    function removeToken() {
      if (trail) { trail.remove(); trail = null; }
      if (token) { token.remove(); token = null; }
    }

    var S = { nodes: new vz.Store(), edges: new vz.Store() };
    var geo = null, routes = [], builtW = -1, dirty = true;
    var shownActive = null, pending = [], nodeClicks = !!opts.interactive, chooseClicks = !!opts.interactive;
    var measureCache = new Map();

    function measure(text, px, weight) {
      var k = text + '|' + px + '|' + weight;
      var w = measureCache.get(k);
      if (w === undefined) { w = vz.textWidth(text, px, false, weight); measureCache.set(k, w); }
      return w;
    }
    function specNode(id) { var ns = spec.nodes || []; for (var i = 0; i < ns.length; i++) if (String(ns[i].id) === String(id)) return ns[i]; return null; }
    function nodeText(id) { var n = specNode(id); return n ? String(n.text).replace(/\n/g, ' ') : String(id); }

    /* ---------------------------------------------------------- build (spec or width changed) */
    function build() {
      geo = L.compute(spec, ctx.width, { compact: opts.compact, decisionShape: opts.decisionShape, minScale: opts.minScale, colGap: opts.colGap, rowGap: opts.rowGap, measure: measure });
      routes = L.route(spec, geo);
      builtW = ctx.width; dirty = false;
      ctx.setHeight(geo.height * geo.scale);
      vz.set(content, 'transform', 'translate(' + vz.n2(geo.offsetX) + ' 0)' + (geo.scale < 1 ? ' scale(' + geo.scale.toFixed(4) + ')' : ''));

      S.nodes.begin();
      (spec.nodes || []).forEach(function (n) {
        var g = geo.nodes[String(n.id)];
        var rec = S.nodes.use(String(n.id), buildNode);
        rec.spec = n;
        rec.el.setAttribute('class', 'vz-item vz-flow-node vz-flow-' + (n.type || 'process') + (rec.el.__vzS ? ' is-' + rec.el.__vzS : '') + (rec.clickable ? ' is-clickable' : ''));
        vz.set(rec.shape, 'd', L.shapePath(g));
        setLines(rec, g);
        if (nodeClicks) makeNodeClickable(rec);
      });
      S.nodes.end(); S.nodes.purge();

      S.edges.begin();
      (spec.edges || []).forEach(function (e, i) {
        var r = routes[i];
        var rec = S.edges.use('e' + i, buildEdge);
        rec.spec = e; rec.index = i; rec.route = r;
        vz.toggle(rec.el, 'is-dashed', !!e.dashed);
        vz.toggle(rec.el, 'is-noarrow', e.arrow === false);
        if (!r) { vz.set(rec.el, 'display', 'none'); vz.set(rec.lab, 'display', 'none'); return; }
        vz.set(rec.el, 'display', null);
        var pts = r.points.slice(), n = pts.length;
        var end = pts[n - 1], prev = pts[n - 2];
        var ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
        var cut = vz.shorten(prev[0], prev[1], end[0], end[1], 6);
        pts[n - 1] = cut;
        vz.set(rec.line, 'd', vz.roundedPath(pts, 10));
        vz.set(rec.head, 'd', vz.arrowHead(end[0], end[1], ang, 9));
        var has = e.label !== undefined && e.label !== null && e.label !== '';
        vz.set(rec.lab, 'display', has ? null : 'none');
        if (has) {
          var t = String(e.label), w = Math.ceil(measure(t, L.LABEL_FONT, 650) + 14);
          vz.text(rec.labText, t);
          vz.set(rec.labRect, 'width', w); vz.set(rec.labRect, 'x', -w / 2);
          vz.place(rec.lab, r.labelAt[0], r.labelAt[1]);
          if (chooseClicks) makeChoice(rec);
        }
      });
      S.edges.end(); S.edges.purge();
    }
    function buildNode(rec) {
      rec.el = vz.svg('g', { class: 'vz-item vz-flow-node' }, layers.nodes);
      rec.shape = vz.svg('path', { class: 'vz-shape' }, rec.el);
      rec.text = vz.svg('text', { class: 'vz-ink vz-flow-text', 'text-anchor': 'middle' }, rec.el);
      rec.tspans = [];
      vz.state(rec.el, 'default');
    }
    function setLines(rec, g) {
      vz.set(rec.text, 'font-size', g.font);
      var lines = g.lines;
      while (rec.tspans.length < lines.length) rec.tspans.push(vz.svg('tspan', { dy: '.35em' }, rec.text));
      while (rec.tspans.length > lines.length) rec.text.removeChild(rec.tspans.pop());
      lines.forEach(function (ln, i) {
        var ts = rec.tspans[i];
        vz.text(ts, ln);
        vz.set(ts, 'x', vz.n2(g.x));
        vz.set(ts, 'y', vz.n2(g.y + (i - (lines.length - 1) / 2) * g.lineH));
      });
    }
    function buildEdge(rec) {
      rec.el = vz.svg('g', { class: 'vz-edge vz-flow-edge' }, layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, rec.el);
      rec.head = vz.svg('path', { class: 'vz-head' }, rec.el);
      rec.lab = vz.svg('g', { class: 'vz-flow-label' }, layers.labels);
      rec.labRect = vz.svg('rect', { class: 'vz-flow-pill', y: -8.5, height: 17, rx: 8.5, ry: 8.5 }, rec.lab);
      rec.labText = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, rec.lab);
      rec.nodes = [rec.el, rec.lab];
      vz.state(rec.el, 'default'); vz.state(rec.lab, 'default');
    }
    function makeNodeClickable(rec) {
      if (rec.clickable) return;
      rec.clickable = true;
      vz.clickable(rec.el, nodeText(rec.id), function () {
        var payload = { id: rec.id, node: rec.spec };
        em.emit('click', payload);
        if (opts.onNodeClick) opts.onNodeClick(payload);
      });
    }
    function makeChoice(rec) {
      if (rec.choice) return;
      rec.choice = true;
      var e = rec.spec;
      vz.clickable(rec.lab, 'Choose “' + e.label + '” at: ' + nodeText(e.from), function () {
        if (rec.lab.classList.contains('is-disabled')) return;
        var payload = { node: String(e.from), to: String(e.to), label: e.label, edge: rec.index };
        em.emit('choose', payload);
        if (opts.onChoose) opts.onChoose(payload);
      });
    }

    /* ---------------------------------------------------------- draw (every render) */
    function flush() {
      var p = pending; pending = [];
      p.forEach(function (fn) { fn(); });
    }
    function edgeStateOf(state, i, e) {
      var es = state.edgeStates || {};
      var keys = [i, String(i), e.id !== undefined ? String(e.id) : null, e.from + '->' + e.to];
      for (var k = 0; k < keys.length; k++) if (keys[k] !== null && es[keys[k]] !== undefined) return es[keys[k]];
      return null;
    }
    function draw(state, ms) {
      flush();
      if (dirty || builtW !== ctx.width) build();
      var active = state.active !== undefined && state.active !== null ? String(state.active) : null;
      var visited = {};
      (state.visited || []).forEach(function (id) { visited[String(id)] = true; });
      var states = state.states || {};

      // which edge (if any) does the token travel?
      var travel = null;
      var explicitIdx = L.edgeIndex(spec, state.activeEdge);
      // 1) an edge shownActive -> active (forward step), 2) active -> shownActive (stepping back: travel it in
      // reverse), 3) the explicit activeEdge into `active` (a jump from an unconnected node).
      if (active !== shownActive && shownActive !== null && active !== null) {
        var ex = explicitIdx >= 0 ? spec.edges[explicitIdx] : null;
        var fwd = ex && String(ex.from) === shownActive && String(ex.to) === active ? explicitIdx : L.edgeIndex(spec, { from: shownActive, to: active });
        var back = L.edgeIndex(spec, { from: active, to: shownActive });
        if (fwd >= 0 && routes[fwd]) travel = { idx: fwd, reverse: false };
        else if (back >= 0 && routes[back]) travel = { idx: back, reverse: true };
        else if (ex && String(ex.to) === active && routes[explicitIdx]) travel = { idx: explicitIdx, reverse: false };
      }
      var animate = travel && ms > 0 && opts.token !== false;
      shownActive = active;

      // node states (the arriving node lights when the token reaches it)
      S.nodes.each(function (rec, id) {
        var st = states[id] || (id === active ? 'active' : visited[id] ? 'visited' : 'default');
        if (animate && id === active && rec.el.__vzS !== st) {
          pending.push(function () {
            rec.el.style.setProperty('--vz-dur', Math.round(ms * 0.35) + 'ms');
            vz.state(rec.el, st);
          });
        } else {
          rec.el.style.removeProperty('--vz-dur');
          vz.state(rec.el, st);
        }
      });
      // edge states: edgeStates wins; an explicit activeEdge is 'active'
      S.edges.each(function (rec) {
        var st = edgeStateOf(state, rec.index, rec.spec) || (rec.index === explicitIdx ? 'active' : 'default');
        vz.state(rec.el, st); vz.state(rec.lab, st);
        if (rec.choice) {
          var enabled = !active || String(rec.spec.from) === active;
          vz.toggle(rec.lab, 'is-disabled', !enabled);
          vz.set(rec.lab, 'tabindex', enabled ? '0' : '-1');
          vz.set(rec.lab, 'aria-disabled', enabled ? null : 'true');
        }
      });

      if (!animate) { tr.run(0, removeToken); return; }
      removeToken();
      trail = vz.svg('path', { class: 'vz-flow-trail' + (travel.reverse ? ' is-reverse' : '') }, layers.token);
      token = vz.svg('g', { class: 'vz-flow-token', opacity: 0 }, layers.token);
      vz.svg('circle', { class: 'vz-flow-halo', r: 11 }, token);
      vz.svg('circle', { class: 'vz-flow-dot', r: 5.5 }, token);
      var pts = routes[travel.idx].points.slice();
      if (travel.reverse) pts.reverse();
      vz.set(trail, 'd', vz.roundedPath(pts, 10));
      var len = 0;
      try { len = trail.getTotalLength(); } catch (_) { len = vz.polylineLength(pts); }
      vz.set(trail, 'stroke-dasharray', vz.n2(len) + ' ' + vz.n2(len + 4));
      var lit = false, myTrail = trail, myToken = token;
      tr.run(ms, function (t) {
        if (trail !== myTrail) return;
        var e = vz.easeInOut(t);
        var p;
        try { p = trail.getPointAtLength(e * len); } catch (_) { var q = vz.pointOnPolyline(pts, e); p = { x: q.x, y: q.y }; }
        vz.place(token, p.x, p.y);
        vz.set(token, 'opacity', (t < 0.08 ? t / 0.08 : t > 0.86 ? Math.max(0, (1 - t) / 0.14) : 1).toFixed(3));
        vz.set(trail, 'stroke-dashoffset', vz.n2(len * (1 - e)));
        vz.set(trail, 'opacity', (t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1).toFixed(3));
        if (!lit && t >= 0.62) { lit = true; flush(); }
      }, function () { flush(); if (trail === myTrail) removeToken(); });
      void myToken;
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      state = state || {};
      var n = (spec.nodes || []).length;
      var s = 'Flowchart with ' + n + ' step' + (n === 1 ? '' : 's') + '.';
      if (state.active !== undefined && state.active !== null) s += ' Current step: ' + nodeText(state.active) + '.';
      if (state.visited && state.visited.length) s += ' Visited: ' + state.visited.map(nodeText).join(', ') + '.';
      return s;
    };
    /* Replace the diagram (instant re-layout). */
    api.setSpec = function (s) { spec = s || { nodes: [], edges: [] }; dirty = true; shownActive = null; measureCache.clear(); api.render(api.state() || {}, { duration: 0, force: true }); return api; };
    api.spec = function () { return spec; };
    /* Light one node, e.g. as a player's `flow` target: player calls highlight(step.flow, ctx). */
    api.highlight = function (id, c) { var st = Object.assign({}, api.state() || {}, { active: id === undefined ? null : id }); api.render(st, { duration: c && c.duration !== undefined ? c.duration : undefined }); return api; };
    /* Layout + routes in SVG units (before offset/scale): {geo, routes}. */
    api.geometry = function () { return { geo: geo, routes: routes }; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !nodeClicks) { nodeClicks = true; ctx.svg.setAttribute('role', 'group'); S.nodes.each(makeNodeClickable); }
      if (evt === 'choose' && !chooseClicks) { chooseClicks = true; ctx.svg.setAttribute('role', 'group'); dirty = true; api.refresh(); }
      return baseOn(evt, fn);
    };

    api.render({}, { duration: 0 });   // a flowchart is useful before any trace runs
    return api;
  }

  flowchartView.layout = L;
  flowchartView.defaults = DEFAULTS;
  VDSA.views.flowchart = flowchartView;
}(typeof window !== 'undefined' ? window : null));
