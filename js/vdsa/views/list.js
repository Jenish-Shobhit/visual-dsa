/* VDSA.views.list(container, options) — singly, doubly and circular linked lists.

   Two-part node boxes (value | next) or three-part (prev | value | next) with arrows that leave from a dot in the
   pointer cell. Arrows are recomputed every frame from the current (animated) node positions, so when a node's
   `next` changes the arrow swings from the old target to the new one instead of jumping. Pointer variables
   (head, curr, prev, slow, fast ...) are chips that slide from node to node.

   const view = VDSA.views.list('#fig');
   view.render({
     nodes: [
       { id: 'a', value: 3, next: 'b' },
       { id: 'b', value: 7, next: 'c', state: 'active' },
       { id: 'c', value: 9, next: null },
       { id: 'n', value: 5, next: 'c', detached: 'above' }      // not in the row yet
     ],
     head: 'a',                                                 // adds a "head" chip unless one is given
     pointers: [{ name: 'curr', target: 'b', state: 'active' }]
   }, { duration: ctx.duration });

   Layout order: the order of `nodes` (default, stable), or state.order = [ids] | 'follow' (walk next from head).
   Null links draw an arrow to a "null" terminator when there is room to the right of the node, otherwise a
   slash in the pointer cell (CLRS style).
   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> list.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function str(v) { return v === undefined || v === null ? null : String(v); }

  /* Normalise state into {nodes, byId, row: [ids], slot: {id: k}, free: [{id, x, y}], doubly, pointers}. */
  L.model = function (state, opts) {
    state = state || {}; opts = opts || {};
    var nodes = [];
    (state.nodes || []).forEach(function (n, i) {
      if (n === null || n === undefined) return;
      if (typeof n !== 'object') n = { value: n };
      nodes.push({
        id: String(n.id !== undefined ? n.id : 'n' + i), value: n.value, text: n.text, state: n.state || 'default',
        next: str(n.next), prev: str(n.prev), hasPrev: n.prev !== undefined,
        x: typeof n.x === 'number' ? n.x : undefined, y: typeof n.y === 'number' ? n.y : undefined,
        detached: n.detached === 'below' ? 'below' : n.detached ? 'above' : null,
        label: n.label, address: n.address, badge: n.badge,
        nextState: n.nextState || 'default', prevState: n.prevState || 'default', index: nodes.length
      });
    });
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    nodes.forEach(function (n) {
      if (n.next !== null && !byId[n.next]) n.next = null;
      if (n.prev !== null && !byId[n.prev]) n.prev = null;
    });
    var doubly = opts.doubly === true || (opts.doubly !== false && nodes.some(function (n) { return n.hasPrev; }));
    function isFree(n) { return !!n.detached || n.x !== undefined || n.y !== undefined; }
    var head = str(state.head);
    if (head !== null && !byId[head]) head = null;
    var order = state.order !== undefined ? state.order : opts.order;
    var row = [], inRow = {};
    function push(id) { var n = byId[id]; if (n && !inRow[id] && !isFree(n)) { inRow[id] = true; row.push(id); } }
    if (order === 'follow') {
      var seen = {}, cur = head;
      while (cur !== null && byId[cur] && !seen[cur]) { seen[cur] = true; push(cur); cur = byId[cur].next; }
    } else if (Array.isArray(order)) order.forEach(function (id) { push(String(id)); });
    nodes.forEach(function (n) { push(n.id); });
    var slot = {};
    row.forEach(function (id, k) { slot[id] = k; });
    var free = [];
    nodes.forEach(function (n) {
      if (!isFree(n)) return;
      var x = n.x;
      if (x === undefined) {
        if (n.next !== null && slot[n.next] !== undefined) x = slot[n.next] - 0.5;
        else {
          var pred = null;
          row.forEach(function (id) { if (pred === null && byId[id].next === n.id) pred = id; });
          if (pred !== null) x = slot[pred] + 0.5;
          else {
            var before = 0;
            nodes.forEach(function (m) { if (m.index < n.index && slot[m.id] !== undefined) before++; });
            x = before - 0.5;
          }
        }
      }
      var y = n.y !== undefined ? n.y : (n.detached === 'below' ? 1 : -1);
      if (y === 0) y = -1;
      free.push({ id: n.id, x: x, y: y });
    });
    var pointers = [];
    (state.pointers || []).forEach(function (p) {
      if (!p) return;
      var t = str(p.target);
      if (t !== null && !byId[t]) t = null;
      pointers.push({ key: String(p.id !== undefined ? p.id : p.name), name: String(p.name), label: p.label, target: t, state: p.state || 'active', side: p.side, style: p.style, nullSide: p.nullSide === 'left' ? 'left' : 'right' });
    });
    if (head !== null && opts.headPointer !== false && !pointers.some(function (p) { return p.name === 'head'; })) {
      pointers.unshift({ key: 'head', name: 'head', target: head, state: 'default', nullSide: 'left' });
    }
    return { nodes: nodes, byId: byId, row: row, slot: slot, free: free, doubly: doubly, head: head, pointers: pointers };
  };

  /* Node dimensions interpolated between compact (t=0) and comfortable (t=1). */
  L.dims = function (t, doubly) {
    t = clamp(t, 0, 1);
    var v = lerp(doubly ? 22 : 24, doubly ? 40 : 44, t), n = lerp(11, 21, t);
    var d = { t: t, v: v, n: n, nodeW: v + n * (doubly ? 2 : 1), h: lerp(30, 40, t), gap: lerp(14, 36, t), font: lerp(11.5, 15, t) };
    d.slotW = d.nodeW + d.gap;
    d.nullW = lerp(26, 30, t);
    d.off = doubly ? d.h * 0.2 : 0;
    return d;
  };

  /* Choose t (and wrapping) so `span` slots + null margins fit `avail` px.
     Returns {t, perRow, wrapped}. extraL/extraR: whether a null terminator sits left/right of the row. */
  L.fit = function (avail, span, doubly, extraL, extraR, allowWrap) {
    function width(t, s) {
      var d = L.dims(t, doubly);
      var extra = (extraL ? d.gap * 0.85 + d.nullW : 0) + (extraR ? d.gap * 0.85 + d.nullW : 0);
      return s * d.nodeW + Math.max(0, s - 1) * d.gap + extra;
    }
    span = Math.max(1, span);
    var w0 = width(0, span), w1 = width(1, span);
    var t = w1 === w0 ? 1 : (avail - w0) / (w1 - w0);
    if (t >= 0 || !allowWrap) return { t: clamp(t, 0, 1), perRow: Math.ceil(span), wrapped: false };
    var d0 = L.dims(0, doubly);
    var extra0 = (extraL ? d0.gap * 0.85 + d0.nullW : 0) + (extraR ? d0.gap * 0.85 + d0.nullW : 0);
    var perRow = Math.max(1, Math.floor((avail - extra0 + d0.gap) / d0.slotW));
    var a = width(0, perRow), b = width(1, perRow);
    return { t: clamp(b === a ? 1 : (avail - a) / (b - a), 0, 1), perRow: perRow, wrapped: true };
  };

  var ZERO = { a1: 0, a2: 0, h1: 0, h2: 0, x1: 0, y1: 0, x2: 0, y2: 0 };
  function params(o) { var p = {}; for (var k in ZERO) p[k] = o && o[k] !== undefined ? o[k] : 0; return p; }

  /* Route an arrow from a source node to a target node, given their layout info:
     src/dst = {id, slot (row index or undefined when free), rowIdx, cx, cy}; dir = 1 (next) or -1 (prev).
     Returns {anchor: {side, dx, dy}, params, above, below} where above/below are px the curve extends beyond the
     node's top/bottom (for lane reservation). */
  L.route = function (src, dst, dir, d, o) {
    o = o || {};
    var off = dir === 1 ? -d.off : d.off;
    var inRow = src.slot !== undefined && dst.slot !== undefined && src.rowIdx === dst.rowIdx;
    if (src.id === dst.id) {
      return dir === 1
        ? { anchor: { side: 'top', dx: d.nodeW * 0.3, dy: 0 }, params: params({ x1: 22, y1: -40, y2: -40 }), above: 32 - d.h / 2 + 8, below: 0, kind: 'self' }
        : { anchor: { side: 'bottom', dx: d.nodeW * 0.7, dy: 0 }, params: params({ x1: -22, y1: 40, y2: 40 }), above: 0, below: 32 - d.h / 2 + 8, kind: 'self' };
    }
    if (inRow) {
      var ds = (dst.slot - src.slot) * dir;
      if (ds === 1) return { anchor: { side: dir === 1 ? 'left' : 'right', dx: 0, dy: off }, params: params({ a1: 1 / 3, a2: 1 / 3 }), above: 0, below: 0, kind: 'adjacent' };
      if (o.circular && dir === 1 && dst.slot === o.firstSlot && src.slot === o.lastSlot && o.lastSlot > 0) {
        var ext = 24, Y = (d.h / 2 + ext) / 0.75;
        return { anchor: { side: 'left', dx: 0, dy: off }, params: params({ x1: 46, y1: Y, x2: -46, y2: Y }), above: 0, below: ext + 4, kind: 'loop' };
      }
      var dist = Math.abs(ds);
      if (ds > 1) { // forward skip: next arcs above (into the top), prev arcs below (into the bottom)
        var e1 = Math.min(52, 14 + 9 * (dist - 2));
        var h1 = (d.h / 4 + e1) / 0.75;
        return dir === 1
          ? { anchor: { side: 'top', dx: d.nodeW * 0.3, dy: 0 }, params: params({ h1: h1, h2: h1 }), above: e1 + 4, below: 0, kind: 'skip' }
          : { anchor: { side: 'bottom', dx: d.nodeW * 0.7, dy: 0 }, params: params({ h1: h1, h2: h1 }), above: 0, below: e1 + 4, kind: 'skip' };
      }
      // backward: next arcs below (into the bottom), prev arcs above (into the top)
      var e2 = Math.min(58, 16 + 10 * (dist - 1));
      var h2 = (d.h / 4 + e2) / 0.75;
      return dir === 1
        ? { anchor: { side: 'bottom', dx: d.nodeW * 0.62, dy: 0 }, params: params({ h1: h2, h2: h2 }), above: 0, below: e2 + 4, kind: 'back' }
        : { anchor: { side: 'top', dx: d.nodeW * 0.38, dy: 0 }, params: params({ h1: h2, h2: h2 }), above: e2 + 4, below: 0, kind: 'back' };
    }
    // between wrapped rows: leave the pointer cell, run along the gap between the rows, enter from the gap side
    if (src.slot !== undefined && dst.slot !== undefined && src.rowIdx !== dst.rowIdx) {
      var below = dst.rowIdx > src.rowIdx;
      var edgeS = src.cy + (below ? d.h / 2 : -d.h / 2), edgeD = dst.cy + (below ? -d.h / 2 : d.h / 2);
      var gapY = Math.abs(dst.rowIdx - src.rowIdx) === 1 ? (edgeS + edgeD) / 2 : edgeS + (below ? 12 : -12);
      var P0y = src.cy + (dir === 1 ? -d.off : d.off);
      return {
        anchor: { side: below ? 'top' : 'bottom', dx: d.nodeW / 2, dy: 0 },
        params: params({ x1: 24 * dir, y1: (gapY - P0y) * 1.25, y2: (gapY - edgeD) * 1.4 }),
        above: 0, below: 0, kind: 'wrap'
      };
    }
    // a free (detached) node: smooth S-curves
    var dotX = src.cx + dir * (d.nodeW / 2 - d.n / 2);
    var entryX = dir === 1 ? dst.cx - d.nodeW / 2 : dst.cx + d.nodeW / 2;
    var dx = entryX - dotX, k = clamp(Math.abs(dx) * 0.55, 18, 60);
    if (dx * dir > 8) return { anchor: { side: dir === 1 ? 'left' : 'right', dx: 0, dy: off }, params: params({ x1: k * dir, x2: -k * dir }), above: 0, below: 0, kind: 'cross' };
    var kv = clamp(Math.abs(dst.cy - src.cy) * 0.6, 18, 60);
    if (dst.cy < src.cy) return { anchor: { side: 'bottom', dx: d.nodeW / 2, dy: 0 }, params: params({ x1: 26 * dir, y2: kv }), above: 0, below: 0, kind: 'cross' };
    return { anchor: { side: 'top', dx: d.nodeW / 2, dy: 0 }, params: params({ x1: 26 * dir, y2: -kv }), above: 0, below: 0, kind: 'cross' };
  };

  /* Cubic control points from endpoints + params (perp = chord rotated -90deg: "up" for a rightward chord). */
  L.cubic = function (P0, P3, p) {
    var cx = P3[0] - P0[0], cy = P3[1] - P0[1], len = Math.hypot(cx, cy) || 1;
    var px = cy / len, py = -cx / len;
    var P1 = [P0[0] + p.a1 * cx + p.h1 * px + p.x1, P0[1] + p.a1 * cy + p.h1 * py + p.y1];
    var P2 = [P3[0] - p.a2 * cx + p.h2 * px + p.x2, P3[1] - p.a2 * cy + p.h2 * py + p.y2];
    return [P0, P1, P2, P3];
  };
  L.params = params;

  /* Interpolate a point from A to B around a pivot D in polar coordinates (radius and angle), the short way
     round; a near-half-turn goes via `prefer` (+1 = clockwise on screen, i.e. through "below" for a rightward
     start). Falls back to a straight lerp when either end sits on the pivot (grow / retract). */
  L.sweep = function (D, A, B, m, prefer) {
    var ax = A[0] - D[0], ay = A[1] - D[1], bx = B[0] - D[0], by = B[1] - D[1];
    var ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
    if (ra < 2 || rb < 2) return [lerp(A[0], B[0], m), lerp(A[1], B[1], m)];
    var a0 = Math.atan2(ay, ax), a1 = Math.atan2(by, bx), diff = a1 - a0;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > 2.9 && prefer && diff * prefer < 0) diff += prefer * 2 * Math.PI;
    var ang = a0 + diff * m, r = lerp(ra, rb, m) * (1 - 0.45 * Math.sin(Math.PI * m) * Math.min(1, Math.abs(diff) / 2));
    return [D[0] + Math.cos(ang) * r, D[1] + Math.sin(ang) * r];
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, fmt = vz.fmt, n2 = vz.n2;

  var DEFAULTS = {
    doubly: 'auto',        // true | false | 'auto' (auto = any node has a prev field)
    circular: false,       // route tail -> first-node links as a return loop under the row
    showNull: true,        // "null" terminators (false = always a slash in the pointer cell)
    showAddresses: false,  // small hex address under each node (node.address or derived from the id)
    order: undefined,      // default layout order: 'follow' walks next from head (state.order overrides)
    wrap: true,            // wrap into several rows when even compact nodes do not fit
    headPointer: true,     // auto "head" chip from state.head
    pointerStyle: 'chip',  // 'chip' | 'arrow'
    reserve: null,         // {above, below, arcAbove, arcBelow, detachedAbove, detachedBelow}
    labelFormatter: null,
    onNodeClick: null,
    duration: undefined
  };

  function hashAddr(id) {
    var h = 2166136261;
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return '0x' + (0x1a0 + ((h >>> 0) % 96) * 16).toString(16).toUpperCase();
  }

  function listView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var V = vz.createView(container, 'list', {
      label: opts.label || 'Linked list figure', interactive: !!opts.onNodeClick,
      duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('nodes'); ctx.layer('nulls'); ctx.layer('edges'); ctx.layer('pointers');
    var S = { nodes: new vz.Store(true), nulls: new vz.Store(), edges: new vz.Store(), ptrs: new vz.Store() };
    var clickable = !!opts.onNodeClick;
    var reserve = Object.assign({ above: 0, below: 0, aboveF: 0, belowF: 0, arcA: 0, arcB: 0, detA: 0, detB: 0, caption: false, nullL: false, nullR: false }, opts.reserve || {});
    var G = null, lastDimKey = '';
    var textCache = new Map();
    function measure(s, px, w) { var k = s + '|' + px + '|' + w; var v = textCache.get(k); if (v === undefined) { v = vz.textWidth(s, px, true, w); textCache.set(k, v); } return v; }
    function valueText(n) { return n.text !== undefined ? String(n.text) : opts.labelFormatter ? String(opts.labelFormatter(n.value, n)) : fmt(n.value); }

    /* ---------------------------------------------------------- geometry */
    function geometry(M) {
      var W = ctx.width, pad = 10;
      var rowLen = M.row.length;
      var minX = 0, maxX = Math.max(0, rowLen - 1);
      M.free.forEach(function (f) { minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x); });
      // null terminators and null-targeted pointers
      var nullR = false, nullL = false;
      if (opts.showNull !== false && rowLen) {
        var tail = M.byId[M.row[rowLen - 1]], first = M.byId[M.row[0]];
        if (tail.next === null) nullR = true;
        if (M.doubly && first.prev === null) nullL = true;
      }
      M.pointers.forEach(function (p) { if (p.target === null) { if (p.nullSide === 'left') nullL = true; else nullR = true; } });
      reserve.nullL = reserve.nullL || nullL; reserve.nullR = reserve.nullR || nullR;
      var span = maxX - minX + 1;
      var fit = L.fit(W - 2 * pad, span, M.doubly, reserve.nullL, reserve.nullR, opts.wrap !== false && !M.free.length);
      var d = L.dims(fit.t, M.doubly);
      var g = { d: d, perRow: fit.wrapped ? fit.perRow : Math.max(1, Math.ceil(span) + 1), wrapped: fit.wrapped, rowLen: rowLen, M: M };
      var rowsN = fit.wrapped ? Math.ceil(rowLen / fit.perRow) : 1;
      var nullSpan = d.gap * 0.85 + d.nullW;
      var contentW = (fit.wrapped ? Math.min(fit.perRow, rowLen) : span) * d.nodeW + Math.max(0, (fit.wrapped ? Math.min(fit.perRow, rowLen) : span) - 1) * d.gap
        + (reserve.nullL ? nullSpan : 0) + (reserve.nullR ? nullSpan : 0);
      var x0 = (W - contentW) / 2 + (reserve.nullL ? nullSpan : 0);  // left edge of slot minX
      g.slotCx = function (k) {
        var c = fit.wrapped ? k % fit.perRow : k - minX;
        return x0 + c * d.slotW + d.nodeW / 2;
      };
      g.rowOf = function (k) { return fit.wrapped ? Math.floor(k / fit.perRow) : 0; };

      // routes first (they decide arc lanes)
      var pos = {};
      M.row.forEach(function (id, k) { pos[id] = { id: id, slot: k, rowIdx: g.rowOf(k), cx: g.slotCx(k), cy: 0 }; });
      M.free.forEach(function (f) { pos[f.id] = { id: f.id, slot: undefined, rowIdx: -1, free: f, cx: x0 + (f.x - minX) * d.slotW + d.nodeW / 2, cy: f.y * 1000 }; });
      M.row.forEach(function (id) { pos[id].cy = pos[id].rowIdx * 100; });
      var routes = {}, arcA = 0, arcB = 0;
      var ro = { circular: opts.circular, firstSlot: 0, lastSlot: rowLen - 1 };
      M.nodes.forEach(function (n) {
        [['n', n.next, 1], ['p', n.prev, -1]].forEach(function (e) {
          if (e[0] === 'p' && !M.doubly) return;
          if (e[1] === null) return;
          var r = L.route(pos[n.id], pos[e[1]], e[2], d, ro);
          routes[n.id + ':' + e[0]] = r;
          if (pos[n.id].slot !== undefined && pos[e[1]].slot !== undefined) { arcA = Math.max(arcA, r.above); arcB = Math.max(arcB, r.below); }
        });
      });
      var detA = 0, detB = 0, caption = false;
      M.free.forEach(function (f) { if (f.y < 0) detA = Math.max(detA, -f.y); else detB = Math.max(detB, f.y); });
      M.nodes.forEach(function (n) { if (n.label !== undefined && n.label !== null && n.label !== '') caption = true; });
      if (opts.showAddresses) caption = true;
      // pointer levels (row-node chips sit just above/below the row; chips of free nodes sit next to them)
      var levels = {}, lvA = 0, lvB = 0, lvAF = 0, lvBF = 0, freeSide = {};
      M.free.forEach(function (f) { freeSide[f.id] = f.y > 0 ? 'below' : 'above'; });
      M.pointers.forEach(function (p) {
        var side = p.side || (p.target !== null && freeSide[p.target] === 'below' ? 'below' : 'above');
        var k = side + '|' + (p.target === null ? '#null' + p.nullSide : p.target);
        var lv = levels[k] || 0;
        levels[k] = lv + 1;
        p._side = side; p._level = lv;
        p._free = p.target !== null && freeSide[p.target] !== undefined;
        if (p._free) { if (freeSide[p.target] === 'above' && side === 'above') lvAF = Math.max(lvAF, lv + 1); else if (freeSide[p.target] === 'below' && side === 'below') lvBF = Math.max(lvBF, lv + 1); }
        else if (side === 'above') lvA = Math.max(lvA, lv + 1); else lvB = Math.max(lvB, lv + 1);
      });
      reserve.above = Math.max(reserve.above, lvA); reserve.below = Math.max(reserve.below, lvB);
      reserve.aboveF = Math.max(reserve.aboveF || 0, lvAF); reserve.belowF = Math.max(reserve.belowF || 0, lvBF);
      reserve.arcA = Math.max(reserve.arcA, arcA); reserve.arcB = Math.max(reserve.arcB, arcB);
      reserve.detA = Math.max(reserve.detA, detA); reserve.detB = Math.max(reserve.detB, detB);
      reserve.caption = reserve.caption || caption;

      // vertical lanes, top to bottom:
      // [chips of free-above nodes] [detached-above lane] [row chips] [arcs above] ROW [arcs below / captions]
      // [row chips below] [detached-below lane] [chips of free-below nodes]
      var y = 6, chip = 18, lane = 22;
      var detLaneA = d.h + 24, detLaneB = d.h + 24;
      if (reserve.detA && reserve.aboveF) y += chip + (reserve.aboveF - 1) * lane + 8;
      g.freeTopCy = y + d.h / 2 + 4 + (reserve.detA - 1) * detLaneA;
      y += reserve.detA * detLaneA;
      g.chipA = []; g.chipB = [];                 // chip centre (level 0) above / below each wrapped row
      var rowBlock = function (r) {
        if (r) y += 26;
        if (reserve.above) y += chip + (reserve.above - 1) * lane + 14;
        g.chipA.push(y - 14 - chip / 2);
        y += reserve.arcA;
        var cy = y + d.h / 2;
        y += d.h + Math.max(reserve.arcB, reserve.caption ? 17 : 0);
        g.chipB.push(y + 14 + chip / 2);
        if (reserve.below && r < rowsN - 1) y += 14 + chip + (reserve.below - 1) * lane;
        return cy;
      };
      g.rowCy = [];
      for (var r = 0; r < Math.max(1, rowsN); r++) g.rowCy.push(rowBlock(r));
      g.chipBaseA = g.chipA[0];
      g.chipBaseB = g.chipB[g.chipB.length - 1];
      if (reserve.below) y += 14 + chip + (reserve.below - 1) * lane;
      g.freeBotCy = y + (reserve.detB ? 20 : 0) + d.h / 2;
      y += reserve.detB * detLaneB;
      if (reserve.detB && reserve.belowF) y += chip + (reserve.belowF - 1) * lane + 8;
      g.height = y + 6;
      if (opts.height) g.height = Math.max(g.height, opts.height);

      // final positions
      M.row.forEach(function (id) { pos[id].cy = g.rowCy[pos[id].rowIdx]; });
      M.free.forEach(function (f) {
        var p = pos[f.id];
        p.cy = f.y < 0 ? g.freeTopCy + (f.y + 1) * detLaneA : g.freeBotCy + (f.y - 1) * detLaneB;
        if (reserve.detA === 0 && f.y < 0) p.cy = g.rowCy[0] - d.h - 20;
      });
      // re-route cross arrows with real y (S-curve strength depends on it)
      M.nodes.forEach(function (n) {
        [['n', n.next, 1], ['p', n.prev, -1]].forEach(function (e) {
          if (e[0] === 'p' && !M.doubly) return;
          if (e[1] === null) return;
          if (pos[n.id].slot === undefined || pos[e[1]].slot === undefined || pos[n.id].rowIdx !== pos[e[1]].rowIdx) routes[n.id + ':' + e[0]] = L.route(pos[n.id], pos[e[1]], e[2], d, ro);
        });
      });
      g.pos = pos; g.routes = routes;
      var lastK = rowLen - 1;
      g.nullRx = rowLen ? g.slotCx(lastK) + d.nodeW / 2 + d.gap * 0.85 + d.nullW / 2 : W / 2;
      g.nullRy = rowLen ? g.rowCy[g.rowOf(lastK)] : g.rowCy[0];
      g.nullLx = rowLen ? g.slotCx(0) - d.nodeW / 2 - d.gap * 0.85 - d.nullW / 2 : W / 2;
      g.nullLy = g.rowCy[0];
      return g;
    }

    /* ---------------------------------------------------------- nodes */
    function buildNode(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-lnode' }, ctx.layers.nodes);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.div1 = vz.svg('line', { class: 'vz-divider' }, g);
      rec.div2 = vz.svg('line', { class: 'vz-divider' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.dotN = vz.svg('circle', { class: 'vz-dot', r: 3 }, g);
      rec.dotP = vz.svg('circle', { class: 'vz-dot', r: 3 }, g);
      rec.slashN = vz.svg('line', { class: 'vz-slash' }, g);
      rec.slashP = vz.svg('line', { class: 'vz-slash' }, g);
      rec.cap = vz.svg('text', { class: 'vz-label vz-lcaption', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.badge = null;
      rec.el = g;
      rec.paint = paintNode;
      if (clickable) makeClickable(rec);
    }
    function makeClickable(rec) {
      vz.clickable(rec.el, null, function () {
        var n = rec.data || {};
        var payload = { id: rec.id, value: n.value, index: G && G.M.slot[rec.id], node: n };
        em.emit('click', payload);
        if (opts.onNodeClick) opts.onNodeClick(payload);
      });
    }
    function sizeNode(rec, doubly) {
      var d = G.d, w = d.nodeW, h = d.h;
      vz.set(rec.shape, 'x', n2(-w / 2)); vz.set(rec.shape, 'y', n2(-h / 2));
      vz.set(rec.shape, 'width', n2(w)); vz.set(rec.shape, 'height', n2(h));
      vz.set(rec.shape, 'rx', n2(Math.min(7, h * 0.18))); vz.set(rec.shape, 'ry', n2(Math.min(7, h * 0.18)));
      var xn = w / 2 - d.n, xp = -w / 2 + d.n;
      vz.set(rec.div1, 'x1', n2(xn)); vz.set(rec.div1, 'x2', n2(xn)); vz.set(rec.div1, 'y1', n2(-h / 2)); vz.set(rec.div1, 'y2', n2(h / 2));
      vz.set(rec.div2, 'x1', n2(xp)); vz.set(rec.div2, 'x2', n2(xp)); vz.set(rec.div2, 'y1', n2(-h / 2)); vz.set(rec.div2, 'y2', n2(h / 2));
      vz.set(rec.div2, 'display', doubly ? null : 'none');
      vz.set(rec.dotP, 'display', doubly ? null : 'none');
      vz.set(rec.slashP, 'display', doubly ? null : 'none');
      var cn = w / 2 - d.n / 2, cp = -w / 2 + d.n / 2;
      vz.set(rec.dotN, 'cx', n2(cn)); vz.set(rec.dotN, 'cy', n2(-d.off));
      vz.set(rec.dotP, 'cx', n2(cp)); vz.set(rec.dotP, 'cy', n2(d.off));
      var r = Math.max(2.2, d.n * 0.14);
      vz.set(rec.dotN, 'r', n2(r)); vz.set(rec.dotP, 'r', n2(r));
      var sx = d.n * 0.28, sy = h * 0.3;
      vz.set(rec.slashN, 'x1', n2(cn - sx)); vz.set(rec.slashN, 'y1', n2(sy)); vz.set(rec.slashN, 'x2', n2(cn + sx)); vz.set(rec.slashN, 'y2', n2(-sy));
      vz.set(rec.slashP, 'x1', n2(cp - sx)); vz.set(rec.slashP, 'y1', n2(sy)); vz.set(rec.slashP, 'x2', n2(cp + sx)); vz.set(rec.slashP, 'y2', n2(-sy));
      vz.set(rec.txt, 'x', n2(doubly ? 0 : -d.n / 2));
      vz.set(rec.cap, 'y', n2(h / 2 + 10));
      vz.set(rec.cap, 'x', n2(doubly ? 0 : -d.n / 2));
    }
    function paintNode(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      vz.set(rec.slashN, 'opacity', c.sn > 0.995 ? null : c.sn.toFixed(3));
      vz.set(rec.dotN, 'opacity', c.sn < 0.005 ? null : (1 - c.sn).toFixed(3));
      vz.set(rec.slashP, 'opacity', c.sp > 0.995 ? null : c.sp.toFixed(3));
      vz.set(rec.dotP, 'opacity', c.sp < 0.005 ? null : (1 - c.sp).toFixed(3));
    }
    function setBadge(rec, text) {
      if (text === undefined || text === null || text === '') { if (rec.badge) { rec.badge.g.remove(); rec.badge = null; } return; }
      if (!rec.badge) {
        var bg = vz.svg('g', { class: 'vz-badge' }, rec.el);
        rec.badge = { g: bg, rect: vz.svg('rect', { rx: 7, ry: 7, height: 14, y: -7 }, bg), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, bg) };
      }
      var t = String(text), w = Math.max(14, measure(t, 10, 650) + 8);
      vz.text(rec.badge.text, t);
      vz.set(rec.badge.rect, 'width', n2(w)); vz.set(rec.badge.rect, 'x', n2(-w / 2));
      vz.place(rec.badge.g, -G.d.nodeW / 2 + 4, -G.d.h / 2 - 2);
    }

    /* ---------------------------------------------------------- null terminators */
    function buildNull(rec) {
      var g = vz.svg('g', { class: 'vz-lnull' }, ctx.layers.nulls);
      rec.txt = vz.svg('text', { class: 'vz-null-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      vz.text(rec.txt, 'null');
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }

    /* ---------------------------------------------------------- arrows */
    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge vz-link' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.head = vz.svg('path', { class: 'vz-head' }, g);
      rec.el = g;
      rec.paint = paintEdge;
      rec.arrow = true;
    }
    function dotPoint(nrec, kind) {
      var c = nrec.cur, d = G.d, s = c.s === undefined ? 1 : c.s;
      if (kind === 'n') return [c.x + (d.nodeW / 2 - d.n / 2) * s, c.y - d.off * s];
      return [c.x - (d.nodeW / 2 - d.n / 2) * s, c.y + d.off * s];
    }
    function anchorPoint(a, srcRec, kind) {
      if (!a) return null;
      if (a.type === 'retract') return dotPoint(srcRec, kind);
      if (a.type === 'rel') { var p = dotPoint(srcRec, kind); return [p[0] + a.dx, p[1] + a.dy]; }
      if (a.type === 'null') {
        var nr = S.nulls.get(a.id);
        if (!nr) return dotPoint(srcRec, kind);
        var hw = G.d.nullW / 2 + 3;
        return a.left ? [nr.cur.x + hw, nr.cur.y] : [nr.cur.x - hw, nr.cur.y];
      }
      var r = S.nodes.get(a.id);
      if (!r) return dotPoint(srcRec, kind);
      var c = r.cur, s = c.s === undefined ? 1 : c.s, d = G.d, w = d.nodeW * s, h = d.h * s;
      switch (a.side) {
        case 'left': return [c.x - w / 2, c.y + a.dy * s];
        case 'right': return [c.x + w / 2, c.y + a.dy * s];
        case 'top': return [c.x - w / 2 + a.dx * s, c.y - h / 2];
        default: return [c.x - w / 2 + a.dx * s, c.y + h / 2];
      }
    }
    /* The tip moves in polar coordinates around the source dot, so a re-pointed arrow sweeps like a clock
       hand (next links swing through "below", prev links through "above") instead of cutting across nodes. */
    function endPoint(rec) {
      var src = S.nodes.get(rec.src);
      var A = anchorPoint(rec.aFrom, src, rec.kind), B = anchorPoint(rec.aTo, src, rec.kind);
      if (!A) A = B; if (!B) B = A;
      var m = rec.cur.m;
      if (m <= 0) return A;
      if (m >= 1) return B;
      var D = dotPoint(src, rec.kind);
      return L.sweep(D, A, B, m, rec.kind === 'n' ? 1 : -1);
    }
    function paintEdge(rec) {
      var src = S.nodes.get(rec.src);
      if (!src) { vz.opacity(rec.el, 0); return; }
      var P0 = dotPoint(src, rec.kind), P3 = endPoint(rec);
      var len = Math.hypot(P3[0] - P0[0], P3[1] - P0[1]);
      var c = rec.cur;
      var pts = L.cubic(P0, P3, c);
      var P2 = pts[2];
      var dx = P3[0] - P2[0], dy = P3[1] - P2[1];
      if (Math.hypot(dx, dy) < 1) { dx = P3[0] - pts[1][0]; dy = P3[1] - pts[1][1]; }
      if (Math.hypot(dx, dy) < 1) { dx = P3[0] - P0[0]; dy = P3[1] - P0[1]; }
      var ang = Math.atan2(dy, dx), hs = Math.min(8.5, 4 + len * 0.2);
      var back = hs * 0.72, ux = Math.cos(ang) * back, uy = Math.sin(ang) * back;
      var E = [P3[0] - ux, P3[1] - uy], E2 = [P2[0] - ux, P2[1] - uy];
      var p1 = pts[1];
      vz.set(rec.line, 'd', 'M' + n2(P0[0]) + ' ' + n2(P0[1]) + 'C' + n2(p1[0]) + ' ' + n2(p1[1]) + ' ' + n2(E2[0]) + ' ' + n2(E2[1]) + ' ' + n2(E[0]) + ' ' + n2(E[1]));
      vz.set(rec.head, 'd', vz.arrowHead(P3[0], P3[1], ang, hs));
      var o = c.o * (src.cur.o === undefined ? 1 : src.cur.o) * Math.min(1, len / 10);
      vz.opacity(rec.el, o);
    }
    function sameAnchor(a, b) {
      if (!a || !b || a.type !== b.type) return false;
      if (a.type === 'retract') return true;
      if (a.type === 'null') return a.id === b.id;
      if (a.type === 'rel') return false;
      return a.id === b.id && a.side === b.side && Math.abs(a.dx - b.dx) < 0.5 && Math.abs(a.dy - b.dy) < 0.5;
    }

    /* ---------------------------------------------------------- pointers */
    function buildPtr(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.stem = vz.svg('line', { class: 'vz-ptr-stem' }, g);
      rec.head = vz.svg('path', { class: 'vz-ptr-head' }, g);
      rec.chip = vz.svg('rect', { class: 'vz-ptr-chip', height: 18, rx: 9, ry: 9, y: -9 }, g);
      rec.label = vz.svg('text', { class: 'vz-ptr-chip-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.nul = vz.svg('text', { class: 'vz-null-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      vz.text(rec.nul, 'null');
      rec.el = g;
      rec.paint = paintPtr;
    }
    function shapePtr(rec, p) {
      var text = p.label !== undefined ? String(p.label) : p.name;
      vz.text(rec.label, text);
      var chip = (p.style || opts.pointerStyle) === 'chip';
      vz.set(rec.chip, 'display', chip ? null : 'none');
      rec.label.setAttribute('class', chip ? 'vz-ptr-chip-text' : 'vz-ptr-label');
      var w = measure(text, 11.5, 700) + 14;
      vz.set(rec.chip, 'width', n2(w)); vz.set(rec.chip, 'x', n2(-w / 2));
      rec.chipH = chip ? 9 : 7;
    }
    function paintPtr(rec) {
      var c = rec.cur, up = c.dir < 0; // dir -1 = label above the tip
      vz.opacity(rec.el, c.o);
      vz.place(rec.el, c.x, 0);
      vz.set(rec.chip, 'y', n2(c.ly - 9)); vz.set(rec.label, 'y', n2(c.ly));
      var y1 = c.ly + (up ? rec.chipH + 1 : -rec.chipH - 1), y2 = c.ty + (up ? -7 : 7);
      vz.set(rec.stem, 'x1', 0); vz.set(rec.stem, 'x2', 0);
      vz.set(rec.stem, 'y1', n2(y1)); vz.set(rec.stem, 'y2', n2(y2));
      vz.set(rec.head, 'd', up ? 'M0 ' + n2(c.ty) + 'L-5 ' + n2(c.ty - 8) + 'Q0 ' + n2(c.ty - 6.4) + ' 5 ' + n2(c.ty - 8) + 'Z'
        : 'M0 ' + n2(c.ty) + 'L-5 ' + n2(c.ty + 8) + 'Q0 ' + n2(c.ty + 6.4) + ' 5 ' + n2(c.ty + 8) + 'Z');
      vz.set(rec.nul, 'y', n2(c.ty + (up ? 11 : -11)));
      vz.set(rec.nul, 'opacity', c.nl < 0.005 ? 0 : c.nl.toFixed(3));
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var M = L.model(state, opts);
      G = geometry(M);
      ctx.setHeight(G.height);
      var d = G.d;
      var dk = [d.nodeW, d.h, d.n, M.doubly].join('|');
      var resized = dk !== lastDimKey;
      lastDimKey = dk;
      var anim = [], edges = [];
      var first = !api._drawn;
      api._drawn = true;

      /* null terminators (needed before arrows) */
      S.nulls.begin();
      var nullFor = {};
      if (opts.showNull !== false && M.row.length) {
        var tail = M.byId[M.row[M.row.length - 1]];
        if (tail.next === null) nullFor[tail.id + ':n'] = { x: G.nullRx, y: G.nullRy, left: false };
        var firstN = M.byId[M.row[0]];
        if (M.doubly && firstN.prev === null) nullFor[firstN.id + ':p'] = { x: G.nullLx, y: G.nullLy, left: true };
      }
      Object.keys(nullFor).forEach(function (key) {
        var rec = S.nulls.use(key, buildNull);
        var t = { x: nullFor[key].x, y: nullFor[key].y, o: 1 };
        if (rec.isNew) { rec.cur = Object.assign({}, t, { o: 0 }); vz.retarget(rec, t); rec.delay = 0.25; }
        else { vz.retarget(rec, t); rec.delay = 0; }
        anim.push(rec);
      });
      S.nulls.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      /* nodes */
      S.nodes.begin();
      var enterIdx = 0;
      M.nodes.forEach(function (n) {
        var rec = S.nodes.use(n.id, buildNode);
        rec.data = n;
        var p = G.pos[n.id];
        vz.state(rec.el, n.state);
        if (rec.isNew || resized) sizeNode(rec, M.doubly);
        var txt = valueText(n), fs = d.font, maxW = d.v * 0.86;
        var w = vz.textWidth(txt, fs, false, 650);
        if (w > maxW) fs = Math.max(8, Math.floor(fs * maxW / w));
        vz.text(rec.txt, txt); vz.set(rec.txt, 'font-size', n2(fs));
        var cap = n.label !== undefined && n.label !== null && n.label !== '' ? String(n.label) : opts.showAddresses ? (n.address !== undefined ? String(n.address) : hashAddr(n.id)) : '';
        vz.text(rec.cap, cap);
        setBadge(rec, n.badge);
        var slashN = n.next === null && !nullFor[n.id + ':n'] ? 1 : 0;
        var slashP = M.doubly && n.prev === null && !nullFor[n.id + ':p'] ? 1 : 0;
        if (clickable) vz.set(rec.el, 'aria-label', 'node ' + txt + (n.state !== 'default' ? ', ' + n.state : ''));
        var t = { x: p.cx, y: p.cy, o: 1, s: 1, sn: slashN, sp: slashP };
        if (rec.isNew) {
          rec.cur = Object.assign({}, t, first ? { o: 0, s: 0.7, y: p.cy + 6 } : { o: 0, s: 0.6 });
          vz.retarget(rec, t);
          rec.delay = ms > 0 ? Math.min(0.3, enterIdx++ * (first ? 0.05 : 0.06)) : 0;
        } else { vz.retarget(rec, t); rec.delay = 0; }
        anim.push(rec);
      });
      S.nodes.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0, s: 0.8 }); rec.delay = 0; anim.push(rec); });

      /* arrows */
      S.edges.begin();
      M.nodes.forEach(function (n) {
        [['n', n.next, n.nextState], ['p', n.prev, n.prevState]].forEach(function (e) {
          if (e[0] === 'p' && !M.doubly) return;
          var key = n.id + ':' + e[0];
          var spec, prm, vis = 1;
          if (e[1] !== null) {
            var r = G.routes[key];
            spec = { type: 'node', id: e[1], side: r.anchor.side, dx: r.anchor.dx, dy: r.anchor.dy };
            prm = r.params;
          } else if (nullFor[key]) {
            spec = { type: 'null', id: key, left: nullFor[key].left };
            prm = L.params({ a1: 1 / 3, a2: 1 / 3 });
          } else {
            spec = { type: 'retract' };
            prm = L.params({ a1: 1 / 3, a2: 1 / 3 });
            vis = 0;
          }
          var rec = S.edges.use(key, buildEdge);
          rec.src = n.id; rec.kind = e[0];
          vz.state(rec.el, e[2]);
          var target = Object.assign({ m: 1, o: vis }, prm);
          if (rec.isNew || rec.revived) {
            rec.aFrom = { type: 'retract' }; rec.aTo = spec;
            rec.cur = Object.assign({}, target, { m: 0, o: vis });
            vz.retarget(rec, target);
            rec.delay = ms > 0 ? (first ? 0.3 : 0.2) : 0;
          } else {
            if (!sameAnchor(rec.aTo, spec)) {
              if (rec.cur.m < 0.999 && !sameAnchor(rec.aFrom, rec.aTo)) {
                var src = S.nodes.get(n.id), E = endPoint(rec), D = dotPoint(src, e[0]);
                rec.aFrom = { type: 'rel', dx: E[0] - D[0], dy: E[1] - D[1] };
              } else rec.aFrom = rec.aTo;
              rec.aTo = spec;
              rec.cur.m = 0;
            } else if (rec.cur.m >= 0.999) rec.aFrom = spec;
            vz.retarget(rec, target);
            rec.delay = 0;
          }
          edges.push(rec);
        });
      });
      S.edges.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; edges.push(rec); });

      /* pointers */
      S.ptrs.begin();
      M.pointers.forEach(function (p) {
        var rec = S.ptrs.use(p.key, buildPtr);
        shapePtr(rec, p);
        vz.state(rec.el, p.state);
        var up = p._side !== 'below';
        var x, ty, ly, nl = 0;
        if (p.target === null) {
          var left = p.nullSide === 'left';
          x = left ? G.nullLx : G.nullRx;
          var yy = left ? G.nullLy : G.nullRy;
          var hasMarker = Object.keys(nullFor).some(function (k) { return nullFor[k].left === left; });
          ty = up ? yy - 10 : yy + 10;
          nl = hasMarker ? 0 : 1;
          var nr = left ? 0 : G.rowOf(Math.max(0, G.rowLen - 1));
          ly = up ? G.chipA[nr] - p._level * 22 : G.chipB[nr] + p._level * 22;
        } else {
          var pp = G.pos[p.target];
          x = pp.cx;
          ty = up ? pp.cy - d.h / 2 - 3 : pp.cy + d.h / 2 + 3;
          if (pp.slot === undefined) ly = up ? ty - 22 - p._level * 22 : ty + 22 + p._level * 22;
          else ly = up ? G.chipA[pp.rowIdx] - p._level * 22 : G.chipB[pp.rowIdx] + p._level * 22;
          if (up && ly > ty - 22) ly = ty - 22;
          if (!up && ly < ty + 22) ly = ty + 22;
        }
        var t = { x: x, ty: ty, ly: ly, o: 1, nl: nl, dir: up ? -1 : 1 };
        if (rec.isNew) {
          rec.cur = Object.assign({}, t, { o: 0, ly: ly + (up ? -10 : 10) });
          vz.retarget(rec, t);
          rec.delay = ms > 0 ? (first ? 0.35 : 0.1) : 0;
        } else { vz.retarget(rec, t); rec.delay = 0; }
        anim.push(rec);
      });
      S.ptrs.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      tr.run(ms, function (t) {
        var i, rec;
        for (i = 0; i < anim.length; i++) { rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
        for (i = 0; i < edges.length; i++) { rec = edges[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
      }, function () {
        S.edges.each(function (rec) { if (rec.cur.m >= 0.999) rec.aFrom = rec.aTo; });
        Object.keys(S).forEach(function (k) { S[k].purge(); });
      });
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var M = L.model(state, opts);
      if (!M.nodes.length) return 'Empty list' + (state && state.head === null ? ': head is null.' : '.');
      var parts = [];
      if (M.head !== null) {
        var seen = {}, cur = M.head, chain = [];
        while (cur !== null && !seen[cur]) { seen[cur] = true; chain.push(valueText(M.byId[cur])); cur = M.byId[cur].next; }
        parts.push('List from head: ' + chain.join(' → ') + (cur === null ? ' → null' : ' → back to ' + valueText(M.byId[cur]) + ' (cycle)'));
      } else {
        parts.push('Nodes: ' + M.nodes.map(function (n) { return valueText(n) + ' → ' + (n.next === null ? 'null' : valueText(M.byId[n.next])); }).join(', '));
      }
      var ps = M.pointers.filter(function (p) { return p.name !== 'head'; }).map(function (p) { return p.name + ' at ' + (p.target === null ? 'null' : valueText(M.byId[p.target])); });
      if (ps.length) parts.push(ps.join(', '));
      var det = M.free.map(function (f) { return valueText(M.byId[f.id]) + ' (detached)'; });
      if (det.length) parts.push(det.join(', '));
      return parts.join('. ') + '.';
    };
    /* Reserve lanes for every snapshot of a trace so the figure keeps one height. */
    api.prepare = function (states) {
      var keep = ctx.width;
      (states || []).forEach(function (st) { geometry(L.model(st, opts)); });
      ctx.width = keep;
      api.refresh();
      return api;
    };
    api.reset = function () { reserve = Object.assign({ above: 0, below: 0, aboveF: 0, belowF: 0, arcA: 0, arcB: 0, detA: 0, detB: 0, caption: false, nullL: false, nullR: false }, opts.reserve || {}); return api; };
    api.setOptions = function (o) { Object.assign(opts, o || {}); lastDimKey = ''; api.refresh(); return api; };
    api.positionOf = function (id) { var r = S.nodes.get(String(id)); return r ? { x: r.cur.x, y: r.cur.y } : null; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        ctx.svg.setAttribute('role', 'group');
        S.nodes.each(function (rec) { makeClickable(rec); });
      }
      return baseOn(evt, fn);
    };
    return api;
  }

  listView.layout = L;
  listView.defaults = DEFAULTS;
  VDSA.views.list = listView;
}(typeof window !== 'undefined' ? window : null));
