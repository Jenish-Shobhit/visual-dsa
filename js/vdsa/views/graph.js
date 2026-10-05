/* VDSA.views.graph(container, options) — node-link graphs in a logical coordinate space.

   const view = VDSA.views.graph('#fig', { directed: true, bounds: { w: 1000, h: 600 } });
   view.render({
     nodes: [{ id: 'A', x: 120, y: 300, state: 'active', badge: 0 },
             { id: 'B', x: 420, y: 140, badge: '∞', sub: 'prev A' }],
     edges: [{ from: 'A', to: 'B', weight: 4, state: 'compare' },
             { from: 'B', to: 'A', weight: 2 },                 // reverse pair: both curve apart
             { from: 'B', to: 'B', label: 'loop' },             // self-loop
             { from: 'A', to: 'C', flow: 3, capacity: 5 }]      // "3/5" + a pipe filled to 60 %
   }, { duration: ctx.duration });

   - Coordinates are logical (default 0..1000 × 0..600) and scale to the container width (aspect kept,
     height capped by maxHeight). Nodes without x/y are placed on a circle; `layout: 'force'|'circle'|'layered'|'grid'`
     computes every position for you.
   - Edges are recomputed from the *current* animated node positions every frame, so they stay attached while
     nodes glide. New edges draw from source to target; `pulse: true` sends a dot along an edge during the step.
   - draggable: true -> drag nodes ('move' events). editable: true -> editor (add nodes/edges, edit weights,
     delete) with 'change' events, getGraph() and setGraph().
   - Layout helpers (pure): VDSA.views.graph.layouts.circle / grid / force / layered.

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> graph.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};
  var TAU = Math.PI * 2;
  function r2(v) { return Math.round(v * 100) / 100; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rng(seed) {
    var a = (seed === undefined ? 1 : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function boundsOf(b) {
    b = b || {};
    return { x: +b.x || 0, y: +b.y || 0, w: +b.w || 1000, h: +b.h || 600 };
  }

  /* Edge identity: explicit id, else "from-to" (directed) or the sorted pair "a-b" (undirected). */
  L.edgeKey = function (e, directedDefault) {
    if (e.id !== undefined && e.id !== null) return String(e.id);
    var d = e.directed !== undefined ? !!e.directed : !!directedDefault;
    var a = String(e.from), b = String(e.to);
    if (!d && b < a) { var t = a; a = b; b = t; }
    return a + '-' + b;
  };

  /* Map a logical box into a pixel width. Returns {k (px per unit), ox, oy, height}. */
  L.fit = function (bounds, width, opts) {
    opts = opts || {};
    var b = boundsOf(bounds);
    var pad = opts.pad === undefined ? 40 : opts.pad;
    var k = Math.max(0.02, (width - 2 * pad) / b.w);
    var height;
    if (opts.height) {
      height = opts.height;
      k = Math.max(0.02, Math.min(k, (height - 2 * pad) / b.h));
    } else {
      var maxH = opts.maxHeight || 440;
      if (b.h * k + 2 * pad > maxH) k = Math.max(0.02, (maxH - 2 * pad) / b.h);
      height = b.h * k + 2 * pad;
    }
    return { k: k, ox: (width - b.w * k) / 2 - b.x * k, oy: (height - b.h * k) / 2 - b.y * k, height: Math.ceil(height) };
  };

  /* Give parallel edges (same unordered pair) symmetric bends. Each edge gets .bend in "units"
     (multiply by a pixel spacing), measured to the left of its own direction, so u->v and v->u
     both bow outwards. Self-loops get 0. Mutates and returns the array. */
  L.assignBends = function (edges) {
    var groups = {};
    edges.forEach(function (e) {
      e.bend = 0;
      if (String(e.from) === String(e.to)) return;
      var a = String(e.from), b = String(e.to), k = a < b ? a + '\u0000' + b : b + '\u0000' + a;
      (groups[k] = groups[k] || []).push(e);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      var canonFrom = k.split('\u0000')[0];
      g.forEach(function (e, i) {
        var off = i - (g.length - 1) / 2;
        e.bend = String(e.from) === canonFrom ? off : -off;
      });
    });
    return edges;
  };

  /* Geometry of an edge between circles (x1,y1,r1) -> (x2,y2,r2), bowed `bend` px to the left of its
     direction (0 = straight). `arrow` = arrowhead length (0 = none): the line stops short so the head's
     tip lands exactly on the target circle. Returns start s, control c, line end e, head tip t, the head
     angle, the label point m (curve midpoint) and `degenerate` when the circles overlap. */
  L.edgeGeometry = function (x1, y1, r1, x2, y2, r2, bend, arrow) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) return { degenerate: true, sx: x1, sy: y1, cx: x1, cy: y1, ex: x2, ey: y2, tx: x2, ty: y2, angle: 0, mx: x1, my: y1 };
    var ux = dx / len, uy = dy / len, nx = uy, ny = -ux;
    var b = bend || 0;
    var cx = (x1 + x2) / 2 + nx * 2 * b, cy = (y1 + y2) / 2 + ny * 2 * b;
    var a1 = Math.atan2(cy - y1, cx - x1), a2 = Math.atan2(y2 - cy, x2 - cx);
    var sx = x1 + Math.cos(a1) * r1, sy = y1 + Math.sin(a1) * r1;
    var tx = x2 - Math.cos(a2) * r2, ty = y2 - Math.sin(a2) * r2;
    var back = arrow ? arrow * 0.7 : 0;
    var ex = tx - Math.cos(a2) * back, ey = ty - Math.sin(a2) * back;
    var mx = 0.25 * sx + 0.5 * cx + 0.25 * tx, my = 0.25 * sy + 0.5 * cy + 0.25 * ty;
    return {
      degenerate: len < r1 + r2 + (arrow ? arrow * 0.5 : 0) + 2,
      straight: Math.abs(b) < 0.5, sx: sx, sy: sy, cx: cx, cy: cy, ex: ex, ey: ey, tx: tx, ty: ty, angle: a2, mx: mx, my: my
    };
  };

  /* Point and tangent angle at parameter t on the quadratic (sx,sy)-(cx,cy)-(ex,ey). */
  L.quadAt = function (g, t) {
    var u = 1 - t;
    var x = u * u * g.sx + 2 * u * t * g.cx + t * t * g.ex, y = u * u * g.sy + 2 * u * t * g.cy + t * t * g.ey;
    var dx = 2 * u * (g.cx - g.sx) + 2 * t * (g.ex - g.cx), dy = 2 * u * (g.cy - g.sy) + 2 * t * (g.ey - g.cy);
    return { x: x, y: y, angle: Math.atan2(dy, dx) };
  };

  /* Self-loop teardrop on a circle (x, y, r), centred on `angle` (default: straight up). */
  L.selfLoop = function (x, y, r, arrow, angle) {
    var a = angle === undefined ? -Math.PI / 2 : angle, spread = 0.6, hgt = r * 3.1;
    var a1 = a - spread, a2 = a + spread;
    var sx = x + Math.cos(a1) * r, sy = y + Math.sin(a1) * r;
    var tx = x + Math.cos(a2) * r, ty = y + Math.sin(a2) * r;
    var c1x = x + Math.cos(a - 0.85) * (r + hgt), c1y = y + Math.sin(a - 0.85) * (r + hgt);
    var c2x = x + Math.cos(a + 0.85) * (r + hgt), c2y = y + Math.sin(a + 0.85) * (r + hgt);
    var ang = Math.atan2(ty - c2y, tx - c2x);
    var back = arrow ? arrow * 0.7 : 0;
    var ex = tx - Math.cos(ang) * back, ey = ty - Math.sin(ang) * back;
    return { sx: sx, sy: sy, c1x: c1x, c1y: c1y, c2x: c2x, c2y: c2y, ex: ex, ey: ey, tx: tx, ty: ty, angle: ang,
      mx: x + Math.cos(a) * (r + hgt * 0.78), my: y + Math.sin(a) * (r + hgt * 0.78) };
  };

  /* ---- layout helpers: all return positions in the logical space (default 1000 × 600) ---- */

  /* circle(n | ids, {w, h, pad, cx, cy, r, start}) -> [{x,y}] for a count, {id:{x,y}} for ids. Starts at 12 o'clock, clockwise. */
  L.circle = function (n, opts) {
    opts = opts || {};
    var ids = Array.isArray(n) ? n.map(function (v) { return typeof v === 'object' ? String(v.id) : String(v); }) : null;
    var N = ids ? ids.length : Math.max(0, n | 0);
    var w = opts.w || 1000, h = opts.h || 600, pad = opts.pad === undefined ? 70 : opts.pad;
    var cx = opts.cx === undefined ? w / 2 : opts.cx, cy = opts.cy === undefined ? h / 2 : opts.cy;
    var rad = opts.r === undefined ? Math.max(0, Math.min(w, h) / 2 - pad) : opts.r;
    var start = opts.start === undefined ? -Math.PI / 2 : opts.start;
    var pts = [];
    for (var i = 0; i < N; i++) {
      if (N === 1) { pts.push({ x: r2(cx), y: r2(cy) }); continue; }
      var a = start + TAU * i / N;
      pts.push({ x: r2(cx + Math.cos(a) * rad), y: r2(cy + Math.sin(a) * rad) });
    }
    if (!ids) return pts;
    var out = {};
    ids.forEach(function (id, i) { out[id] = pts[i]; });
    return out;
  };

  /* grid(rows, cols, {w, h, pad, ids}) -> row-major [{x,y,row,col}] (square spacing, centred);
     with ids (row-major array) returns {id:{x,y}}. */
  L.grid = function (rows, cols, opts) {
    opts = opts || {};
    var w = opts.w || 1000, h = opts.h || 600, pad = opts.pad === undefined ? 70 : opts.pad;
    var sx = cols > 1 ? (w - 2 * pad) / (cols - 1) : 0, sy = rows > 1 ? (h - 2 * pad) / (rows - 1) : 0;
    var s = cols > 1 && rows > 1 ? Math.min(sx, sy) : cols > 1 ? sx : sy;
    var x0 = w / 2 - s * (cols - 1) / 2, y0 = h / 2 - s * (rows - 1) / 2;
    var pts = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) pts.push({ x: r2(x0 + c * s), y: r2(y0 + r * s), row: r, col: c });
    if (!opts.ids) return pts;
    var out = {};
    opts.ids.forEach(function (id, i) { if (pts[i]) out[String(id)] = { x: pts[i].x, y: pts[i].y }; });
    return out;
  };

  /* force(nodes, edges, {w, h, pad, iterations=300, seed=1, linkLength}) -> {id:{x,y}}
     Deterministic Fruchterman–Reingold with gravity, then fitted into the box (unless some node is `fixed`).
     nodes: ids or {id, x?, y?, fixed?}; edges: {from, to}. */
  L.force = function (nodes, edges, opts) {
    opts = opts || {};
    var w = opts.w || 1000, h = opts.h || 600, pad = opts.pad === undefined ? 70 : opts.pad;
    var iters = opts.iterations || 300, rand = rng(opts.seed === undefined ? 1 : opts.seed);
    var list = (nodes || []).map(function (n) { return typeof n === 'object' ? n : { id: n }; });
    var N = list.length, out = {};
    if (!N) return out;
    var idx = {};
    list.forEach(function (n, i) { idx[String(n.id)] = i; });
    var anyFixed = false;
    var P = list.map(function (n, i) {
      if (isFinite(n.x) && isFinite(n.y)) { if (n.fixed) anyFixed = true; return { x: +n.x, y: +n.y, fixed: !!n.fixed }; }
      var a = TAU * i / N;
      return { x: w / 2 + Math.cos(a) * w * 0.28 + (rand() - 0.5) * 20, y: h / 2 + Math.sin(a) * h * 0.28 + (rand() - 0.5) * 20, fixed: false };
    });
    var E = [];
    (edges || []).forEach(function (e) {
      var a = idx[String(e.from)], b = idx[String(e.to)];
      if (a !== undefined && b !== undefined && a !== b) E.push([a, b]);
    });
    var area = Math.max(1, (w - 2 * pad) * (h - 2 * pad));
    var k = opts.linkLength || Math.sqrt(area / N) * 0.72;
    var t0 = Math.min(w, h) / 8;
    var dx = new Float64Array(N), dy = new Float64Array(N);
    for (var it = 0; it < iters; it++) {
      dx.fill(0); dy.fill(0);
      for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) {
        var vx = P[i].x - P[j].x, vy = P[i].y - P[j].y, d2 = vx * vx + vy * vy;
        if (d2 < 1e-4) { vx = (rand() - 0.5) * 0.1; vy = (rand() - 0.5) * 0.1; d2 = vx * vx + vy * vy + 1e-4; }
        var d = Math.sqrt(d2), f = k * k / d;
        dx[i] += vx / d * f; dy[i] += vy / d * f; dx[j] -= vx / d * f; dy[j] -= vy / d * f;
      }
      for (var e = 0; e < E.length; e++) {
        var a = E[e][0], b = E[e][1];
        var ex = P[a].x - P[b].x, ey = P[a].y - P[b].y, dd = Math.sqrt(ex * ex + ey * ey) || 0.01, fa = dd * dd / k;
        dx[a] -= ex / dd * fa; dy[a] -= ey / dd * fa; dx[b] += ex / dd * fa; dy[b] += ey / dd * fa;
      }
      var temp = t0 * (1 - it / iters) + 0.5;
      for (i = 0; i < N; i++) {
        if (P[i].fixed) continue;
        dx[i] -= (P[i].x - w / 2) * 0.06 * k / 100; dy[i] -= (P[i].y - h / 2) * 0.06 * k / 100;
        var m = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
        P[i].x += dx[i] / m * Math.min(m, temp); P[i].y += dy[i] / m * Math.min(m, temp);
      }
    }
    if (!anyFixed) {
      // rotate onto the principal axis so the long side of the drawing matches the long side of the box
      var mx = 0, my = 0;
      P.forEach(function (p) { mx += p.x; my += p.y; });
      mx /= N; my /= N;
      var sxx = 0, syy = 0, sxy = 0;
      P.forEach(function (p) { var ax = p.x - mx, ay = p.y - my; sxx += ax * ax; syy += ay * ay; sxy += ax * ay; });
      var theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);          // major axis angle
      if (w < h) theta -= Math.PI / 2;
      var ct = Math.cos(-theta), st = Math.sin(-theta);
      P.forEach(function (p) { var ax = p.x - mx, ay = p.y - my; p.x = ax * ct - ay * st; p.y = ax * st + ay * ct; });
      // canonical orientation (first node left of and above the centre) so small changes don't flip the drawing
      var fxs = P[0].x > 1e-6 ? -1 : 1, fys = P[0].y > 1e-6 ? -1 : 1;
      P.forEach(function (p) { p.x *= fxs; p.y *= fys; });
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      P.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      var bw = maxX - minX, bh = maxY - minY;
      var fx = bw > 1e-6 ? (w - 2 * pad) / bw : Infinity, fy = bh > 1e-6 ? (h - 2 * pad) / bh : Infinity;
      var s = Math.min(fx, fy);
      if (!isFinite(s)) s = 1;
      var kx = Math.min(isFinite(fx) ? fx : s, s * 1.35), ky = Math.min(isFinite(fy) ? fy : s, s * 1.35);  // mild stretch into spare room
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      P.forEach(function (p) { p.x = w / 2 + (p.x - cx) * kx; p.y = h / 2 + (p.y - cy) * ky; });
    }
    list.forEach(function (n, i) { out[String(n.id)] = { x: r2(clamp(P[i].x, 0, w)), y: r2(clamp(P[i].y, 0, h)) }; });
    return out;
  };

  /* layered(dag, opts) or layered(nodes, edges, opts) -> {id:{x,y}}
     Sugiyama-lite for DAGs (topological sort, dependency graphs): longest-path layering from the sources,
     a few barycenter sweeps to reduce crossings, even spacing. opts: {w, h, pad, direction: 'TB'|'LR', sweeps, strict}.
     Cycles: back edges (found by DFS) are ignored for layering; pass strict: true to throw instead.
     The result has a non-enumerable `layers` (array of id arrays) and `cyclic` flag. */
  L.layered = function (a, b, c) {
    var nodes, edges, opts;
    if (Array.isArray(a)) { nodes = a; edges = b || []; opts = c || {}; }
    else { nodes = (a && a.nodes) || []; edges = (a && a.edges) || []; opts = b || {}; }
    var w = opts.w || 1000, h = opts.h || 600, pad = opts.pad === undefined ? 70 : opts.pad;
    var ids = nodes.map(function (n) { return typeof n === 'object' ? String(n.id) : String(n); });
    var has = {};
    ids.forEach(function (id) { has[id] = true; });
    var succ = {}, pred = {};
    ids.forEach(function (id) { succ[id] = []; pred[id] = []; });
    var E = edges.filter(function (e) { return has[String(e.from)] && has[String(e.to)] && String(e.from) !== String(e.to); })
      .map(function (e) { return [String(e.from), String(e.to)]; });
    // find back edges with an iterative DFS
    var color = {}, back = {}, cyclic = false;
    var adj = {};
    ids.forEach(function (id) { adj[id] = []; });
    E.forEach(function (e) { adj[e[0]].push(e[1]); });
    ids.forEach(function (s) {
      if (color[s]) return;
      var stack = [[s, 0]];
      color[s] = 1;
      while (stack.length) {
        var top = stack[stack.length - 1], u = top[0];
        if (top[1] < adj[u].length) {
          var v = adj[u][top[1]++];
          if (color[v] === 1) { back[u + '\u0000' + v] = true; cyclic = true; }
          else if (!color[v]) { color[v] = 1; stack.push([v, 0]); }
        } else { color[u] = 2; stack.pop(); }
      }
    });
    if (cyclic && opts.strict) throw new Error('layered(): graph has a cycle');
    E.forEach(function (e) {
      if (back[e[0] + '\u0000' + e[1]]) return;
      succ[e[0]].push(e[1]); pred[e[1]].push(e[0]);
    });
    // longest-path layering via Kahn order
    var indeg = {}, layer = {}, q = [], order = [];
    ids.forEach(function (id) { indeg[id] = pred[id].length; layer[id] = 0; if (!indeg[id]) q.push(id); });
    while (q.length) {
      var u = q.shift();
      order.push(u);
      succ[u].forEach(function (v) { layer[v] = Math.max(layer[v], layer[u] + 1); if (--indeg[v] === 0) q.push(v); });
    }
    var nL = 0;
    ids.forEach(function (id) { nL = Math.max(nL, layer[id] + 1); });
    var layers = [];
    for (var i = 0; i < nL; i++) layers.push([]);
    order.forEach(function (id) { layers[layer[id]].push(id); });
    // barycenter sweeps
    var pos = {};
    function index() { layers.forEach(function (Ly) { Ly.forEach(function (id, j) { pos[id] = Ly.length > 1 ? j / (Ly.length - 1) : 0.5; }); }); }
    index();
    var sweeps = opts.sweeps === undefined ? 6 : opts.sweeps;
    for (var s = 0; s < sweeps; s++) {
      var down = s % 2 === 0;
      for (var li = down ? 1 : nL - 2; down ? li < nL : li >= 0; li += down ? 1 : -1) {
        var bc = {};
        layers[li].forEach(function (id) {
          var nb = down ? pred[id] : succ[id];
          bc[id] = nb.length ? nb.reduce(function (acc, v) { return acc + pos[v]; }, 0) / nb.length : pos[id];
        });
        layers[li].sort(function (x, y) { return bc[x] - bc[y] || pos[x] - pos[y]; });
        layers[li].forEach(function (id, j) { pos[id] = layers[li].length > 1 ? j / (layers[li].length - 1) : 0.5; });
      }
    }
    var lr = opts.direction === 'LR';
    var along = lr ? w : h, across = lr ? h : w;
    var maxCount = 1;
    layers.forEach(function (Ly) { maxCount = Math.max(maxCount, Ly.length); });
    var gap = maxCount > 1 ? (across - 2 * pad) / (maxCount - 1) : 0;
    var out = {};
    layers.forEach(function (Ly, li) {
      var main = nL > 1 ? pad + li * (along - 2 * pad) / (nL - 1) : along / 2;
      Ly.forEach(function (id, j) {
        var cross = across / 2 + (j - (Ly.length - 1) / 2) * gap;
        out[id] = lr ? { x: r2(main), y: r2(cross) } : { x: r2(cross), y: r2(main) };
      });
    });
    Object.defineProperty(out, 'layers', { value: layers, enumerable: false });
    Object.defineProperty(out, 'cyclic', { value: cyclic, enumerable: false });
    return out;
  };

  /* Bounding box of nodes {x, y} padded by `margin` (default 8 % of the larger side, at least 40 units). */
  L.contentBounds = function (nodes, margin) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    (nodes || []).forEach(function (n) {
      if (!isFinite(n.x) || !isFinite(n.y)) return;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    if (!isFinite(minX)) return { x: 0, y: 0, w: 1000, h: 600 };
    var m = margin === undefined ? Math.max(40, 0.08 * Math.max(maxX - minX, maxY - minY)) : margin;
    return { x: minX - m, y: minY - m, w: Math.max(1, maxX - minX + 2 * m), h: Math.max(1, maxY - minY + 2 * m) };
  };

  /* Next free editor label: A..Z, then N27, N28 ... */
  L.nextId = function (taken) {
    var used = {};
    (taken || []).forEach(function (id) { used[String(id)] = true; });
    for (var i = 0; i < 26; i++) { var c = String.fromCharCode(65 + i); if (!used[c]) return c; }
    for (var n = 27; ; n++) if (!used['N' + n]) return 'N' + n;
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, doc = root.document;

  var DEFAULTS = {
    bounds: { w: 1000, h: 600 },   // logical space {x?, y?, w, h}
    directed: false,               // default for edges without `directed`
    nodeRadius: 22,                // px at full scale; shrinks with the layout (sqrt), never below minRadius
    minRadius: 13,
    maxHeight: 440,                // cap on the auto height
    height: null,                  // fixed height in px
    layout: null,                  // null | 'circle' | 'force' | 'layered' | 'grid' (computes positions)
    layoutOptions: null,           // passed to the layout helper
    showWeights: true,
    flowStyle: 'pipe',             // 'pipe' | 'label' for edges with capacity
    draggable: false,
    keepDragged: true,             // dragged positions override snapshot positions until resetPositions()
    editable: false,
    allowSelfLoops: false,         // editor
    defaultWeight: undefined,      // editor: weight for new edges (default 1 when the graph is weighted)
    weighted: undefined,           // editor: force weights on/off for new edges
    label: null,
    duration: undefined
  };

  function graphView(container, options) {
    options = options || {};
    var opts = Object.assign({}, DEFAULTS, options);
    var autoBounds = opts.bounds === 'auto';
    opts.bounds = autoBounds ? boundsOf(null) : boundsOf(opts.bounds);
    var interactive = !!(opts.editable || opts.draggable);
    var V = vz.createView(container, 'graph', {
      label: opts.label || (opts.editable ? 'Graph editor. Click empty space to add a node, drag from one node to another to connect them, click an edge to edit its weight, press Delete to remove the selection.' : 'Graph figure'),
      interactive: interactive, duration: opts.duration, describe: opts.describe,
      className: (opts.editable ? 'is-editing ' : '') + (opts.draggable ? 'is-draggable' : '')
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr, svg = ctx.svg;
    ctx.layer('edges'); ctx.layer('weights'); ctx.layer('nodes'); ctx.layer('overlay');

    var S = { nodes: new vz.Store(true), edges: new vz.Store() };
    var F = { k: 1, ox: 0, oy: 0, height: 300 };
    var R = opts.nodeRadius, AS = 9, PIPE = 9, PF = 11;
    var dragged = {};
    var model = { nodes: [], edges: [] };
    var selection = null;             // {kind: 'node'|'edge', id}
    var tool = opts.editable ? 'edge' : null;
    var clickable = false;
    var last = { nodes: [], edges: [] };
    var layoutCache = { key: null, pos: null };
    var textCache = new Map();
    var input = null;

    function measure(str, px, weight) {
      var k = str + '|' + px + '|' + weight;
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(str, px, true, weight); textCache.set(k, w); }
      return w;
    }
    function measureSans(str, px, weight) {
      var k = 's|' + str + '|' + px + '|' + weight;
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(str, px, false, weight); textCache.set(k, w); }
      return w;
    }
    function toPx(x, y) { return [F.ox + x * F.k, F.oy + y * F.k]; }
    function toLogical(px, py) { return [(px - F.ox) / F.k, (py - F.oy) / F.k]; }
    function clampLogical(p) {
      var b = opts.bounds;
      return [r2(clamp(p[0], b.x, b.x + b.w)), r2(clamp(p[1], b.y, b.y + b.h))];
    }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* ---------------------------------------------------------- normalise */
    function normalize(state) {
      var nodes = [], seenN = {};
      (state.nodes || []).forEach(function (n) {
        if (!n || n.id === undefined || seenN[String(n.id)]) return;
        seenN[String(n.id)] = true;
        nodes.push({ id: String(n.id), label: n.label !== undefined ? n.label : String(n.id), x: +n.x, y: +n.y, state: n.state || 'default',
          badge: n.badge, badgeState: n.badgeState, sub: n.sub, raw: n });
      });
      var edges = [], seenE = {};
      (state.edges || []).forEach(function (e) {
        if (!e || e.from === undefined || e.to === undefined) return;
        if (!seenN[String(e.from)] || !seenN[String(e.to)]) return;
        var key = L.edgeKey(e, opts.directed);
        if (seenE[key]) return;
        seenE[key] = true;
        edges.push({ key: key, from: String(e.from), to: String(e.to), directed: e.directed !== undefined ? !!e.directed : !!opts.directed,
          weight: e.weight, label: e.label, flow: e.flow, capacity: e.capacity, state: e.state || 'default', pulse: !!e.pulse, dashed: !!e.dashed, raw: e });
      });
      L.assignBends(edges);
      // positions (layouts work in the declared box; with bounds: 'auto' in the default 1000 × 600)
      var b = autoBounds ? boundsOf(null) : opts.bounds, lopts = Object.assign({ w: b.w, h: b.h }, opts.layoutOptions || {});
      var pos = null;
      if (opts.layout) {
        var key = opts.layout + '|' + nodes.map(function (n) { return n.id; }).join(',') + '|' + edges.map(function (e) { return e.from + '>' + e.to; }).join(',');
        if (layoutCache.key !== key) {
          var ids = nodes.map(function (n) { return n.id; });
          var p = opts.layout === 'force' ? L.force(ids, edges, lopts)
            : opts.layout === 'layered' ? L.layered(ids, edges, lopts)
            : opts.layout === 'grid' ? (function () { var c = lopts.cols || Math.ceil(Math.sqrt(ids.length)); return L.grid(Math.ceil(ids.length / c), c, Object.assign({ ids: ids }, lopts)); })()
            : L.circle(ids, lopts);
          layoutCache = { key: key, pos: p };
        }
        pos = layoutCache.pos;
      }
      var missing = nodes.filter(function (n) { return !isFinite(n.x) || !isFinite(n.y); });
      var circ = missing.length && !pos ? L.circle(nodes.map(function (n) { return n.id; }), lopts) : null;
      nodes.forEach(function (n) {
        if (pos && pos[n.id]) { n.x = pos[n.id].x + b.x; n.y = pos[n.id].y + b.y; }
        else if (!isFinite(n.x) || !isFinite(n.y)) { n.x = circ[n.id].x + b.x; n.y = circ[n.id].y + b.y; }
        if (opts.keepDragged && dragged[n.id]) { n.x = dragged[n.id][0]; n.y = dragged[n.id][1]; }
      });
      return { nodes: nodes, edges: edges };
    }

    /* ---------------------------------------------------------- DOM: nodes */
    function buildNode(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-gnode' }, ctx.layers.nodes);
      rec.focus = vz.svg('circle', { class: 'vz-focus' }, g);
      rec.shape = vz.svg('circle', { class: 'vz-shape' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.sub = null; rec.badge = null;
      rec.el = g; rec.paint = paintNode;
      if (interactive || clickable) wireNode(rec);
    }
    function paintNode(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
    }
    function labelFs(label) {
      var f = clamp(Math.round(R * 0.72), 10, 15), maxW = R * (opts.uniformLabels ? 1.9 : 1.7);
      if (label) { var w = measureSans(label, f, 650); if (w > maxW) f = Math.max(8, Math.floor(f * maxW / w)); }
      return f;
    }
    function nodeContent(rec, n) {
      vz.set(rec.shape, 'r', r2(R));
      vz.set(rec.focus, 'r', r2(R + 4));
      var label = n.label === null || n.label === undefined ? '' : String(n.label);
      var fs = labelFs(label);
      if (opts.uniformLabels && last && last.nodes) {   // opt-in: every label in the graph uses the size the widest one needs
        last.nodes.forEach(function (o) { var f = labelFs(o.label === null || o.label === undefined ? '' : String(o.label)); if (f < fs) fs = f; });
      }
      vz.text(rec.txt, label);
      vz.set(rec.txt, 'font-size', fs);
      if (n.sub !== undefined && n.sub !== null && n.sub !== '') {
        if (!rec.sub) rec.sub = vz.svg('text', { class: 'vz-gsub', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
        vz.text(rec.sub, n.sub);
        vz.set(rec.sub, 'y', r2(R + 11));
      } else if (rec.sub) { rec.sub.remove(); rec.sub = null; }
      if (n.badge !== undefined && n.badge !== null && n.badge !== '') {
        if (!rec.badge) {
          var bg = vz.svg('g', { class: 'vz-badge' }, rec.el);
          rec.badge = { g: bg, rect: vz.svg('rect', { rx: 8, ry: 8, height: 16, y: -8 }, bg), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, bg) };
        }
        var bf = PF + 1, bh = bf + 6, t = vz.fmt(n.badge), bw = Math.max(bh, measure(t, bf, 650) + 9);
        vz.text(rec.badge.text, t);
        vz.set(rec.badge.rect, 'width', r2(bw)); vz.set(rec.badge.rect, 'x', r2(-bw / 2));
        vz.set(rec.badge.rect, 'height', bh); vz.set(rec.badge.rect, 'y', -bh / 2); vz.set(rec.badge.rect, 'rx', bh / 2); vz.set(rec.badge.rect, 'ry', bh / 2);
        vz.place(rec.badge.g, R * 0.72 + bw / 2 - 5, -R * 0.86);
        vz.state(rec.badge.g, n.badgeState || 'default');
      } else if (rec.badge) { rec.badge.g.remove(); rec.badge = null; }
      if (interactive || clickable) {
        vz.set(rec.el, 'aria-label', 'node ' + label + (n.state !== 'default' ? ', ' + n.state : '') + (n.badge !== undefined && n.badge !== null ? ', ' + vz.fmt(n.badge) : ''));
      }
    }

    /* ---------------------------------------------------------- DOM: edges */
    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge vz-gedge' }, ctx.layers.edges);
      rec.pipe = null; rec.hit = null; rec.pulseEl = null;
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.head = vz.svg('path', { class: 'vz-head' }, g);
      var wg = vz.svg('g', { class: 'vz-edge vz-weight' }, ctx.layers.weights);
      rec.wrect = vz.svg('rect', { rx: 9, ry: 9, height: 18, y: -9 }, wg);
      rec.wtext = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, wg);
      rec.wg = wg; rec.el = g; rec.nodes = [g, wg]; rec.paint = paintEdge;
      rec.pt = null;
      if (interactive || clickable) wireEdge(rec);
    }
    function edgeContent(rec, e) {
      var text = e.label !== undefined && e.label !== null ? String(e.label)
        : e.capacity !== undefined ? (e.flow === undefined ? 0 : e.flow) + '/' + e.capacity
        : e.weight !== undefined && e.weight !== null ? vz.fmt(e.weight) : '';
      rec.hasLabel = !!text && opts.showWeights !== false;
      vz.text(rec.wtext, rec.hasLabel ? text : '');
      var ph = PF + 7, w = Math.max(ph, measure(text, PF, 650) + 10);
      vz.set(rec.wrect, 'width', r2(w)); vz.set(rec.wrect, 'x', r2(-w / 2));
      vz.set(rec.wrect, 'height', ph); vz.set(rec.wrect, 'y', -ph / 2); vz.set(rec.wrect, 'rx', ph / 2); vz.set(rec.wrect, 'ry', ph / 2);
      rec.pillW = w;
      var pipe = e.capacity !== undefined && opts.flowStyle === 'pipe';
      if (pipe && !rec.pipe) { rec.pipe = vz.svg('path', { class: 'vz-pipe' }, rec.el); rec.el.insertBefore(rec.pipe, rec.line); rec.line.classList.add('vz-flow'); }
      else if (!pipe && rec.pipe) { rec.pipe.remove(); rec.pipe = null; rec.line.classList.remove('vz-flow'); rec.line.style.strokeWidth = ''; rec.lastSW = null; }
      if (rec.pipe) { var pw = r2(PIPE + 5) + 'px'; if (rec.pipe.style.strokeWidth !== pw) rec.pipe.style.strokeWidth = pw; }
      if (rec.hit) vz.set(rec.hit, 'aria-label', 'edge ' + e.from + (e.directed ? ' to ' : ' – ') + e.to + (text ? ', ' + text : '') + (e.state !== 'default' ? ', ' + e.state : ''));
    }
    function paintEdge(rec) {
      var a = S.nodes.get(rec.src), b = S.nodes.get(rec.dst), c = rec.cur;
      if (!a || !b) { hideEdge(rec, null, null); return; }
      var o = c.o * Math.min(a.cur.o, b.cur.o);
      var d = clamp(c.d, 0, 1), dAll = d >= 0.999;
      var headSize = rec.pipe ? PIPE + 7 : AS;
      var arrow = rec.directed ? headSize : 0;
      var dStr, head = null, lx, ly, pulse = null;
      if (rec.loop) {
        var sl = L.selfLoop(a.cur.x, a.cur.y, R * a.cur.s, arrow);
        dStr = 'M' + r2(sl.sx) + ' ' + r2(sl.sy) + 'C' + r2(sl.c1x) + ' ' + r2(sl.c1y) + ' ' + r2(sl.c2x) + ' ' + r2(sl.c2y) + ' ' + r2(sl.ex) + ' ' + r2(sl.ey);
        if (arrow) head = vz.arrowHead(sl.tx, sl.ty, sl.angle, headSize);
        lx = sl.mx; ly = sl.my;
        o *= d;
        if (rec.pt !== null) { pulse = { x: sl.mx, y: sl.my }; }
      } else {
        var g = L.edgeGeometry(a.cur.x, a.cur.y, R * a.cur.s, b.cur.x, b.cur.y, R * b.cur.s, c.b, arrow);
        if (g.degenerate) { hideEdge(rec, (a.cur.x + b.cur.x) / 2, (a.cur.y + b.cur.y) / 2); return; }
        if (dAll) {
          dStr = g.straight ? 'M' + r2(g.sx) + ' ' + r2(g.sy) + 'L' + r2(g.ex) + ' ' + r2(g.ey)
            : 'M' + r2(g.sx) + ' ' + r2(g.sy) + 'Q' + r2(g.cx) + ' ' + r2(g.cy) + ' ' + r2(g.ex) + ' ' + r2(g.ey);
          if (arrow) head = vz.arrowHead(g.tx, g.ty, g.angle, headSize);
        } else {
          // partial curve [0, d] by de Casteljau
          var q1x = g.sx + (g.cx - g.sx) * d, q1y = g.sy + (g.cy - g.sy) * d;
          var p = L.quadAt(g, d);
          dStr = 'M' + r2(g.sx) + ' ' + r2(g.sy) + 'Q' + r2(q1x) + ' ' + r2(q1y) + ' ' + r2(p.x) + ' ' + r2(p.y);
          if (arrow && d > 0.02) {
            var back = arrow * 0.7;
            head = vz.arrowHead(p.x + Math.cos(p.angle) * back, p.y + Math.sin(p.angle) * back, p.angle, headSize * Math.min(1, d * 3));
          }
        }
        lx = g.mx; ly = g.my;
        if (rec.pt !== null) { var pp = L.quadAt(g, vz.easeInOut(rec.pt)); pulse = pp; }
      }
      vz.opacity(rec.el, o);
      vz.set(rec.line, 'd', dStr);
      if (rec.pipe) {
        vz.set(rec.pipe, 'd', dStr);
        var sw = r2(PIPE * clamp(c.f, 0, 1));
        if (rec.lastSW !== sw) { rec.lastSW = sw; rec.line.style.strokeWidth = sw + 'px'; }
        vz.set(rec.line, 'opacity', sw < 0.3 ? 0 : null);
      }
      if (rec.hit) vz.set(rec.hit, 'd', dStr);
      vz.set(rec.head, 'd', head || '');
      rec.px = lx; rec.py = ly;
      vz.place(rec.wg, lx, ly);
      vz.opacity(rec.wg, rec.hasLabel ? o * clamp((d - 0.45) * 2.5, 0, 1) : 0);
      if (pulse) {
        if (!rec.pulseEl) rec.pulseEl = vz.svg('circle', { class: 'vz-pulse', r: 4.5 }, rec.el);
        vz.set(rec.pulseEl, 'cx', r2(pulse.x)); vz.set(rec.pulseEl, 'cy', r2(pulse.y));
        vz.set(rec.pulseEl, 'opacity', Math.sin(Math.PI * rec.pt).toFixed(3));
      } else if (rec.pulseEl) { rec.pulseEl.remove(); rec.pulseEl = null; }
    }

    /* Overlapping endpoints (or a missing node): hide, with the same attributes whatever came before. */
    function hideEdge(rec, x, y) {
      vz.opacity(rec.el, 0); vz.opacity(rec.wg, 0);
      vz.set(rec.line, 'd', ''); vz.set(rec.head, 'd', '');
      if (rec.pipe) vz.set(rec.pipe, 'd', '');
      if (rec.hit) vz.set(rec.hit, 'd', '');
      if (x !== null) { rec.px = x; rec.py = y; vz.place(rec.wg, x, y); }
      if (rec.pulseEl) { rec.pulseEl.remove(); rec.pulseEl = null; }
    }

    /* ---------------------------------------------------------- draw */
    var lastAnim = { nodes: [], edges: [] };
    function draw(state, ms) {
      if (input) closeWeightEditor(false);
      var N = normalize(state);
      if (opts.editable) model = { nodes: clone(state.nodes || []), edges: clone(state.edges || []) };
      last = N;
      // geometry
      if (autoBounds) opts.bounds = L.contentBounds(N.nodes, opts.boundsMargin);
      var b = opts.bounds;
      var kx = Math.max(0.02, (ctx.width - 80) / b.w);
      var rEst = clamp(opts.nodeRadius * Math.sqrt(Math.min(1, kx)), opts.minRadius, opts.nodeRadius);
      F = L.fit(b, ctx.width, { pad: rEst + 18, maxHeight: opts.maxHeight, height: opts.height });
      R = clamp(opts.nodeRadius * Math.sqrt(Math.min(1, F.k)), opts.minRadius, opts.nodeRadius);
      AS = clamp(R * 0.56, 8, 11.5);
      PIPE = clamp(R * 0.55, 7, 12);
      PF = Math.round(clamp(R * 0.6, 10, 11) * 2) / 2;      // pill / badge font size
      var pfv = PF + 'px';
      if (svg.style.getPropertyValue('--vz-gf') !== pfv) svg.style.setProperty('--vz-gf', pfv);
      ctx.setHeight(F.height);
      var first = !api._drawn;
      api._drawn = true;
      var stagger = ms > 0;
      var nodeAnim = [], edgeAnim = [];

      S.nodes.begin();
      var newNodes = {};
      N.nodes.forEach(function (n, i) {
        var rec = S.nodes.use(n.id, buildNode);
        rec.data = n;
        vz.state(rec.el, n.state);
        nodeContent(rec, n);
        var p = toPx(n.x, n.y);
        var t = { x: p[0], y: p[1], o: 1, s: 1 };
        if (rec.isNew) {
          newNodes[n.id] = true;
          rec.cur = { x: t.x, y: t.y, o: 0, s: 0.4 };
          vz.retarget(rec, t);
          rec.delay = stagger && first ? Math.min(0.35, i * 0.04) : 0;
          rec.span = first ? 0.6 : undefined;
        } else {
          vz.retarget(rec, t);
          rec.delay = 0; rec.span = undefined;
        }
        nodeAnim.push(rec);
      });
      S.nodes.end().forEach(function (rec) {
        vz.retarget(rec, Object.assign({}, rec.cur, { o: 0, s: 0.6 }));
        rec.delay = 0; rec.span = undefined;
        nodeAnim.push(rec);
      });

      S.edges.begin();
      var spacing = R * 2.3;
      N.edges.forEach(function (e, i) {
        var rec = S.edges.use(e.key, buildEdge);
        rec.src = e.from; rec.dst = e.to; rec.directed = e.directed; rec.loop = e.from === e.to; rec.data = e;
        vz.state(rec.el, e.state); vz.state(rec.wg, e.state);
        vz.toggle(rec.el, 'is-dashed', e.dashed);
        edgeContent(rec, e);
        var t = { o: 1, d: 1, b: e.bend * spacing, f: e.capacity ? clamp((+e.flow || 0) / e.capacity, 0, 1) : 0 };
        if (rec.isNew) {
          rec.cur = { o: 1, d: 0, b: t.b, f: 0 };
          vz.retarget(rec, t);
          rec.delay = !stagger ? 0 : first ? Math.min(0.55, 0.3 + i * 0.015) : (newNodes[e.from] || newNodes[e.to] ? 0.25 : 0);
        } else {
          vz.retarget(rec, t);
          rec.delay = 0;
        }
        rec.span = undefined;
        rec.pt = null;
        rec.wantPulse = e.pulse && ms > 0;
        edgeAnim.push(rec);
      });
      S.edges.end().forEach(function (rec) {
        vz.retarget(rec, Object.assign({}, rec.cur, { o: 0 }));
        rec.delay = 0; rec.span = undefined; rec.pt = null; rec.wantPulse = false;
        edgeAnim.push(rec);
      });
      applySelection();
      lastAnim = { nodes: nodeAnim, edges: edgeAnim };
      tr.run(ms, function (t) {
        var i;
        for (i = 0; i < nodeAnim.length; i++) { var r = nodeAnim[i]; vz.step(r, vz.local(t, r.delay, r.span)); r.paint(r); }
        for (i = 0; i < edgeAnim.length; i++) {
          var er = edgeAnim[i];
          vz.step(er, vz.local(t, er.delay, er.span));
          er.pt = er.wantPulse && t < 1 ? t : null;
          er.paint(er);
        }
      }, function () {
        S.nodes.purge(); S.edges.purge();
      });
    }
    /* Jump every running animation to its end (before a drag starts). */
    function settle() {
      if (!tr.running) return;
      if (tr.finish) { tr.finish(); return; }
      tr.cancel();
      lastAnim.nodes.forEach(function (r) { vz.step(r, 1); r.paint(r); });
      lastAnim.edges.forEach(function (r) { vz.step(r, 1); r.pt = null; r.paint(r); });
      S.nodes.purge(); S.edges.purge();
    }
    function repaintEdges() { S.edges.each(function (r) { if (!r.exiting) r.paint(r); }); }

    /* ---------------------------------------------------------- selection */
    function applySelection() {
      S.nodes.each(function (r) { vz.toggle(r.el, 'is-selected', !!selection && selection.kind === 'node' && selection.id === r.id); });
      S.edges.each(function (r) {
        var on = !!selection && selection.kind === 'edge' && selection.id === r.id;
        vz.toggle(r.el, 'is-selected', on); vz.toggle(r.wg, 'is-selected', on);
      });
    }
    function select(kind, id) {
      selection = kind ? { kind: kind, id: String(id) } : null;
      applySelection();
      em.emit('select', selection ? { kind: selection.kind, id: selection.id } : null);
    }

    /* ---------------------------------------------------------- interaction wiring */
    function wireNode(rec) {
      if (rec.wired) return;
      rec.wired = true;
      rec.el.setAttribute('tabindex', '0');
      rec.el.setAttribute('role', 'button');
      rec.el.classList.add('is-clickable');
      rec.el.addEventListener('pointerdown', function (ev) { onDown(ev, 'node', rec); });
      rec.el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); nodeClick(rec); }
      });
    }
    function wireEdge(rec) {
      if (rec.hit) return;
      rec.hit = vz.svg('path', { class: 'vz-hit', tabindex: '0', role: 'button' }, rec.el);
      rec.hit.addEventListener('pointerdown', function (ev) { onDown(ev, 'edge', rec); });
      rec.hit.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); edgeClick(rec); }
      });
      rec.wg.addEventListener('pointerdown', function (ev) { onDown(ev, 'edge', rec); });
      rec.wg.classList.add('is-clickable');
    }

    var gesture = null;
    function onDown(ev, kind, rec) {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (kind !== 'bg') ev.stopPropagation();
      if (input && kind !== 'bg') closeWeightEditor(true);
      var p = vz.pointer(svg, ev);
      gesture = { kind: kind, rec: rec, x0: p.x, y0: p.y, moved: false, mode: null, id: ev.pointerId, shift: ev.shiftKey };
      try { svg.setPointerCapture(ev.pointerId); } catch (_) {}
      if (kind === 'node') ev.preventDefault();
    }
    svg.addEventListener('pointerdown', function (ev) {
      if (!opts.editable || gesture) return;
      if (input) { closeWeightEditor(true); return; }
      onDown(ev, 'bg', null);
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!gesture || ev.pointerId !== gesture.id) return;
      var p = vz.pointer(svg, ev);
      if (!gesture.moved && Math.hypot(p.x - gesture.x0, p.y - gesture.y0) > 5) {
        gesture.moved = true;
        if (gesture.kind === 'node') {
          if (opts.editable && tool === 'edge' && !gesture.shift) gesture.mode = 'edge';
          else if (opts.draggable || opts.editable) { gesture.mode = 'move'; settle(); gesture.rec.el.classList.add('is-dragging'); }
        }
      }
      if (!gesture.moved) return;
      if (gesture.mode === 'move') moveNode(gesture.rec, p, false);
      else if (gesture.mode === 'edge') rubber(gesture.rec, p);
    });
    function endGesture(ev, cancelled) {
      if (!gesture || (ev && ev.pointerId !== gesture.id)) return;
      var g = gesture;
      gesture = null;
      try { svg.releasePointerCapture(g.id); } catch (_) {}
      var p = ev ? vz.pointer(svg, ev) : { x: g.x0, y: g.y0 };
      if (g.mode === 'move') {
        g.rec.el.classList.remove('is-dragging');
        moveNode(g.rec, p, true);
        return;
      }
      if (g.mode === 'edge') {
        clearRubber();
        var target = cancelled ? null : nodeAt(p);
        if (target && (target !== g.rec || opts.allowSelfLoops)) addEdge(g.rec.id, target.id);
        return;
      }
      if (cancelled || g.moved) return;
      if (g.kind === 'node') nodeClick(g.rec);
      else if (g.kind === 'edge') edgeClick(g.rec);
      else if (g.kind === 'bg' && opts.editable) {
        var lp = clampLogical(toLogical(p.x, p.y));
        if (selection) { select(null); }
        addNode(lp[0], lp[1]);
      }
    }
    svg.addEventListener('pointerup', function (ev) { endGesture(ev, false); });
    svg.addEventListener('pointercancel', function (ev) { endGesture(ev, true); });

    function nodeAt(p) {
      var best = null, bd = Infinity;
      S.nodes.each(function (r) {
        if (r.exiting) return;
        var d = Math.hypot(r.cur.x - p.x, r.cur.y - p.y);
        if (d <= R + 6 && d < bd) { bd = d; best = r; }
      });
      return best;
    }
    function moveNode(rec, p, final) {
      var lp = clampLogical(toLogical(p.x, p.y));
      dragged[rec.id] = lp;
      var px = toPx(lp[0], lp[1]);
      rec.cur.x = px[0]; rec.cur.y = px[1];
      rec.to.x = px[0]; rec.to.y = px[1]; rec.from.x = px[0]; rec.from.y = px[1];
      rec.paint(rec);
      repaintEdges();
      if (rec.data) { rec.data.x = lp[0]; rec.data.y = lp[1]; }
      model.nodes.forEach(function (n) { if (String(n.id) === rec.id) { n.x = lp[0]; n.y = lp[1]; } });
      var st = api.state();
      if (st && st.nodes) st.nodes.forEach(function (n) { if (String(n.id) === rec.id && !opts.editable) { /* snapshot stays immutable */ } });
      em.emit('move', { id: rec.id, x: lp[0], y: lp[1], final: !!final });
      if (final && opts.editable) change('move', rec.id);
    }
    var rubberEl = null, rubberTarget = null;
    function rubber(rec, p) {
      if (!rubberEl) rubberEl = vz.svg('path', { class: 'vz-rubber' }, ctx.layers.overlay);
      var target = nodeAt(p);
      if (target === rec && !opts.allowSelfLoops) target = null;
      if (rubberTarget !== target) {
        if (rubberTarget) rubberTarget.el.classList.remove('is-target');
        rubberTarget = target;
        if (target) target.el.classList.add('is-target');
      }
      var ex = p.x, ey = p.y;
      var sx = rec.cur.x, sy = rec.cur.y, d = Math.hypot(ex - sx, ey - sy) || 1;
      if (target) { var g = L.edgeGeometry(sx, sy, R, target.cur.x, target.cur.y, R, 0, opts.directed ? AS : 0); ex = g.tx; ey = g.ty; }
      var x0 = sx + (ex - sx) / d * R, y0 = sy + (ey - sy) / d * R;
      if (target) { var gg = L.edgeGeometry(sx, sy, R, target.cur.x, target.cur.y, R, 0, 0); x0 = gg.sx; y0 = gg.sy; }
      vz.set(rubberEl, 'd', 'M' + r2(x0) + ' ' + r2(y0) + 'L' + r2(ex) + ' ' + r2(ey));
    }
    function clearRubber() {
      if (rubberEl) { rubberEl.remove(); rubberEl = null; }
      if (rubberTarget) { rubberTarget.el.classList.remove('is-target'); rubberTarget = null; }
    }

    function nodeClick(rec) {
      var payload = { id: rec.id, kind: 'node', node: rec.data ? rec.data.raw : null };
      em.emit('click', payload);
      if (opts.onNodeClick) opts.onNodeClick(payload);
      if (!opts.editable) return;
      if (selection && selection.kind === 'node' && selection.id !== rec.id) {
        var from = selection.id;
        select(null);
        addEdge(from, rec.id);
        return;
      }
      if (selection && selection.kind === 'node' && selection.id === rec.id) select(null);
      else select('node', rec.id);
    }
    function edgeClick(rec) {
      var payload = { id: rec.id, kind: 'edge', edge: rec.data ? rec.data.raw : null, from: rec.src, to: rec.dst };
      em.emit('click', payload);
      if (opts.onEdgeClick) opts.onEdgeClick(payload);
      if (!opts.editable) return;
      select('edge', rec.id);
      openWeightEditor(rec);
    }

    /* keyboard for the editor / draggable figure */
    svg.addEventListener('keydown', function (ev) {
      if (!interactive) return;
      var k = ev.key;
      if (opts.editable && (k === 'Delete' || k === 'Backspace') && selection) { ev.preventDefault(); removeSelection(); return; }
      if (k === 'Escape' && selection) { select(null); return; }
      if (opts.editable && (k === 'n' || k === 'N') && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); var p = freeSpot(); addNode(p[0], p[1]); return; }
      var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (dir) {
        var id = selection && selection.kind === 'node' ? selection.id : (doc.activeElement && findNodeByEl(doc.activeElement));
        var rec = id && S.nodes.get(id);
        if (!rec || !rec.data) return;
        ev.preventDefault();
        var step = ev.shiftKey ? 50 : 10;
        settle();
        var np = toPx(rec.data.x + dir[0] * step, rec.data.y + dir[1] * step);
        moveNode(rec, { x: np[0], y: np[1] }, true);
      }
    });
    function findNodeByEl(el) {
      var found = null;
      S.nodes.each(function (r) { if (r.el === el) found = r.id; });
      return found;
    }
    function freeSpot() {
      var b = opts.bounds, best = [b.x + b.w / 2, b.y + b.h / 2], bestD = -1;
      for (var gx = 1; gx < 10; gx++) for (var gy = 1; gy < 6; gy++) {
        var x = b.x + b.w * gx / 10, y = b.y + b.h * gy / 6, dmin = Infinity;
        model.nodes.forEach(function (n) { dmin = Math.min(dmin, Math.hypot(n.x - x, n.y - y)); });
        if (dmin > bestD) { bestD = dmin; best = [x, y]; }
      }
      return [r2(best[0]), r2(best[1])];
    }

    /* ---------------------------------------------------------- editor model operations */
    function isWeighted() {
      if (opts.weighted !== undefined) return !!opts.weighted;
      return model.edges.some(function (e) { return e.weight !== undefined && e.weight !== null; });
    }
    function change(type, id) {
      var g = api.getGraph();
      em.emit('change', { type: type, id: id, nodes: g.nodes, edges: g.edges });
      if (opts.onChange) opts.onChange({ type: type, id: id, nodes: g.nodes, edges: g.edges });
    }
    function commit(type, id, ms) {
      api.render(clone(model), { duration: ms === undefined ? 320 : ms });
      change(type, id);
    }
    function addNode(x, y) {
      var id = L.nextId(model.nodes.map(function (n) { return n.id; }));
      model.nodes.push({ id: id, label: id, x: x, y: y });
      selection = { kind: 'node', id: id };
      commit('add-node', id);
      var rec = S.nodes.get(id);
      if (rec && rec.el.focus) try { rec.el.focus({ preventScroll: true }); } catch (_) {}
    }
    function addEdge(from, to) {
      var e = { from: from, to: to };
      if (opts.directed) e.directed = true;
      var key = L.edgeKey(e, opts.directed);
      if (model.edges.some(function (x) { return L.edgeKey(x, opts.directed) === key; })) { select('edge', key); return; }
      if (isWeighted()) e.weight = opts.defaultWeight !== undefined ? opts.defaultWeight : 1;
      else if (opts.defaultWeight !== undefined) e.weight = opts.defaultWeight;
      model.edges.push(e);
      selection = { kind: 'edge', id: key };
      commit('add-edge', key);
    }
    function removeSelection() {
      if (!selection) return;
      var sel = selection;
      selection = null;
      if (sel.kind === 'node') {
        model.nodes = model.nodes.filter(function (n) { return String(n.id) !== sel.id; });
        model.edges = model.edges.filter(function (e) { return String(e.from) !== sel.id && String(e.to) !== sel.id; });
        delete dragged[sel.id];
      } else {
        model.edges = model.edges.filter(function (e) { return L.edgeKey(e, opts.directed) !== sel.id; });
      }
      commit('remove', sel.id);
      try { svg.focus({ preventScroll: true }); } catch (_) {}
    }
    function setWeight(key, value) {
      model.edges.forEach(function (e) {
        if (L.edgeKey(e, opts.directed) !== key) return;
        if (value === undefined) delete e.weight; else e.weight = value;
      });
      commit('weight', key, 200);
    }

    /* inline weight editor (HTML input over the pill) */
    function openWeightEditor(rec) {
      closeWeightEditor(false);
      var host = ctx.host;
      try { if (root.getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (_) {}
      var el = doc.createElement('input');
      el.type = 'text';
      el.className = 'vz-graph-input';
      el.setAttribute('inputmode', 'decimal');
      el.setAttribute('aria-label', 'Weight of edge ' + rec.src + (rec.directed ? ' to ' : ' – ') + rec.dst + '. Enter to save, Escape to cancel.');
      el.value = rec.data && rec.data.weight !== undefined && rec.data.weight !== null ? String(rec.data.weight) : '';
      var sr = svg.getBoundingClientRect(), hr = host.getBoundingClientRect();
      var scale = sr.width / ctx.width;
      var x = (rec.px === undefined ? 0 : rec.px) * scale + sr.left - hr.left + host.scrollLeft;
      var y = (rec.py === undefined ? 0 : rec.py) * scale + sr.top - hr.top + host.scrollTop;
      el.style.left = Math.round(x - 26) + 'px';
      el.style.top = Math.round(y - 14) + 'px';
      host.appendChild(el);
      input = { el: el, key: rec.id, done: false };
      el.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); closeWeightEditor(true); try { svg.focus({ preventScroll: true }); } catch (_) {} }
        else if (ev.key === 'Escape') { ev.preventDefault(); closeWeightEditor(false); try { svg.focus({ preventScroll: true }); } catch (_) {} }
      });
      el.addEventListener('blur', function () { closeWeightEditor(true); });
      el.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      try { el.focus({ preventScroll: true }); el.select(); } catch (_) {}
    }
    function closeWeightEditor(save) {
      if (!input || input.done) return;
      var cur = input;
      cur.done = true;
      input = null;
      var raw = cur.el.value.trim();
      if (cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
      if (!save) return;
      if (raw === '') { setWeight(cur.key, undefined); return; }
      var v = Number(raw.replace('−', '-'));
      if (isFinite(v)) setWeight(cur.key, v);
    }

    if (opts.editable) {
      svg.setAttribute('tabindex', '0');
      svg.classList.add('vz-host-focus');
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var n = (state && state.nodes) || [], e = (state && state.edges) || [];
      var parts = ['Graph with ' + n.length + ' node' + (n.length === 1 ? '' : 's') + ' and ' + e.length + ' edge' + (e.length === 1 ? '' : 's')];
      var groups = {};
      n.forEach(function (x) {
        if (!x) return;
        var s = x.state || 'default';
        if (s === 'default') return;
        (groups[s] = groups[s] || []).push(String(x.label !== undefined ? x.label : x.id) + (x.badge !== undefined && x.badge !== null ? ' (' + vz.fmt(x.badge) + ')' : ''));
      });
      Object.keys(groups).forEach(function (s) { parts.push(s + ': ' + groups[s].join(', ')); });
      var eg = {};
      e.forEach(function (x) {
        if (!x || !x.state || x.state === 'default') return;
        (eg[x.state] = eg[x.state] || []).push(x.from + (x.directed || opts.directed ? '→' : '–') + x.to);
      });
      Object.keys(eg).forEach(function (s) { parts.push(s + ' edges: ' + eg[s].join(', ')); });
      return parts.join('. ') + '.';
    };
    /* {nodes, edges} in logical coordinates (editor model, or the last snapshot plus dragged positions). */
    api.getGraph = function () {
      if (opts.editable) return clone(model);
      var st = api.state() || { nodes: [], edges: [] };
      var g = clone({ nodes: st.nodes || [], edges: st.edges || [] });
      g.nodes.forEach(function (nd) {
        var d = dragged[String(nd.id)];
        var ln = last.nodes.filter(function (x) { return x.id === String(nd.id); })[0];
        if (d) { nd.x = d[0]; nd.y = d[1]; } else if (ln) { nd.x = ln.x; nd.y = ln.y; }
      });
      return g;
    };
    api.setGraph = function (g, ropts) {
      model = clone({ nodes: (g && g.nodes) || [], edges: (g && g.edges) || [] });
      dragged = {};
      selection = null;
      api.render(clone(model), ropts);
      return api;
    };
    api.setTool = function (t) { tool = t === 'move' ? 'move' : 'edge'; vz.toggle(svg, 'is-move-tool', tool === 'move'); return api; };
    api.getTool = function () { return tool; };
    api.select = function (kind, id) { select(kind, id); return api; };
    api.selection = function () { return selection ? { kind: selection.kind, id: selection.id } : null; };
    api.resetPositions = function () { dragged = {}; api.refresh(); return api; };
    api.positionOf = function (id) { var r = S.nodes.get(String(id)); return r ? { x: r.cur.x, y: r.cur.y } : null; };
    api.toLogical = function (x, y) { var p = toLogical(x, y); return { x: p[0], y: p[1] }; };
    api.toScreen = function (x, y) { var p = toPx(x, y); return { x: p[0], y: p[1] }; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        if (!interactive) svg.setAttribute('role', 'group');
        S.nodes.each(function (r) { wireNode(r); });
        S.edges.each(function (r) { wireEdge(r); r.paint(r); });
      }
      return baseOn(evt, fn);
    };
    var baseDestroy = api.destroy;
    api.destroy = function () { closeWeightEditor(false); baseDestroy(); };
    ctx.onResize(function () { textCache.clear(); });
    return api;
  }

  graphView.layout = L;
  graphView.layouts = { circle: L.circle, grid: L.grid, force: L.force, layered: L.layered };
  graphView.defaults = DEFAULTS;
  VDSA.views.graph = graphView;
}(typeof window !== 'undefined' ? window : null));
