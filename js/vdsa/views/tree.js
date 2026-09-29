/* VDSA.views.tree(container, options) — binary and n-ary trees with a tidy layout, animated re-layout
   (rotations swing, inserts grow out of the parent, deletions fade), edge states, null stubs, red-black
   colouring, badges, sub-labels, return-value chips (recursion trees) and sliding pointers.

   const view = VDSA.views.tree('#fig', { label: 'Binary search tree' });
   view.render({
     root: 'n8',
     nodes: [
       { id: 'n8', value: 8, left: 'n3', right: 'n10', state: 'active', badge: 'h=2' },
       { id: 'n3', value: 3 },
       { id: 'n10', value: 10, color: 'red' }
     ],
     edges: { 'n8-n3': 'path' },                 // or [{ from: 'n8', to: 'n3', state: 'path' }]
     pointers: [{ name: 'curr', target: 'n3', state: 'active' }]
   }, { duration: ctx.duration });

   n-ary / recursion trees: give nodes `children: [ids]` instead of left/right, and a `label` such as 'fib(3)';
   nodes widen into pills to fit their text. Return values: `returnValue: 2` hangs a chip under the node.

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> tree.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var layout = {};

  function str(v) { return v === undefined || v === null ? null : String(v); }

  /* Index nodes by id; accepts an array or an {id: node} map. */
  layout.index = function (nodes) {
    var map = {};
    if (Array.isArray(nodes)) nodes.forEach(function (n) { if (n && n.id !== undefined && n.id !== null) map[String(n.id)] = n; });
    else if (nodes) Object.keys(nodes).forEach(function (k) { var n = nodes[k]; if (n) map[String(n.id !== undefined ? n.id : k)] = n; });
    return map;
  };
  /* Binary unless some node has a children array. */
  layout.isBinary = function (map) {
    for (var k in map) if (Array.isArray(map[k].children)) return false;
    return true;
  };
  /* Root: explicit, else the first node that is nobody's child. */
  layout.findRoot = function (map, rootId, binary) {
    if (rootId !== undefined && rootId !== null) return map[String(rootId)] ? String(rootId) : null;
    var child = {};
    Object.keys(map).forEach(function (k) {
      var n = map[k];
      if (binary) { if (str(n.left)) child[str(n.left)] = 1; if (str(n.right)) child[str(n.right)] = 1; }
      else (n.children || []).forEach(function (c) { if (str(c)) child[str(c)] = 1; });
    });
    var ids = Object.keys(map);
    for (var i = 0; i < ids.length; i++) if (!child[ids[i]]) return ids[i];
    return ids.length ? ids[0] : null;
  };

  /* Tidy layout.
     layout.tidy(nodes, rootId, opts) -> {pos: {id: {x, y, depth}}, nulls: [{parent, side, x, y, depth}],
                                          parent: {id: parentId}, width, depth, minX, maxX}
     Units: a default node is 1 wide; levels are 1 apart (y = depth). x is the node centre; minX..maxX are
     the outer edges (so width = maxX - minX).
     opts: binary (auto), gap (0.5, between siblings), subtreeGap (gap, between cousins deeper down),
           width(id) -> node width in units (default 1), showNulls (binary: stubs for missing children),
           nullWidth (0.5), order: 'tidy' (parents centred over children, Reingold–Tilford contours, left/right
           packings averaged so small subtrees are not pushed to one side) or 'inorder' (binary: every node of a
           left subtree lies left of its ancestor and every node of a right subtree right of it, so x order is
           the in-order sequence — handy for BSTs).
     A lone child sits to its own side (a phantom sibling reserves the other side). Cycles and repeated ids are
     ignored after the first visit. Deterministic. */
  layout.tidy = function (nodes, rootId, opts) {
    opts = opts || {};
    var map = layout.index(nodes);
    var binary = opts.binary !== undefined ? !!opts.binary : layout.isBinary(map);
    var out = { pos: {}, nulls: [], parent: {}, width: 0, depth: 0, minX: 0, maxX: 0 };
    var rid = layout.findRoot(map, rootId, binary);
    if (rid === null) return out;
    var gap = opts.gap === undefined ? 0.5 : opts.gap;
    var sgap = opts.subtreeGap === undefined ? gap : opts.subtreeGap;
    var nullW = opts.nullWidth === undefined ? 0.5 : opts.nullWidth;
    var showNulls = !!opts.showNulls && binary;
    var inorder = binary && opts.order === 'inorder';
    var wOf = typeof opts.width === 'function' ? function (id) { var w = +opts.width(id); return w > 0 ? w : 1; } : function () { return 1; };
    var seen = {};

    function valid(c) { c = str(c); return c !== null && map[c] && !seen[c] ? c : null; }
    function build(id, depth) {
      seen[id] = true;
      var n = map[id], t = { id: id, w: wOf(id), kids: [], depth: depth };
      if (binary) {
        var l = valid(n.left);
        var lt = l ? build(l, depth + 1) : null;
        var r = valid(n.right);
        var rt = r ? build(r, depth + 1) : null;
        if (lt || rt || showNulls) {
          t.kids.push(lt || { phantom: true, side: 'left', w: showNulls ? nullW : t.w, real: showNulls });
          t.kids.push(rt || { phantom: true, side: 'right', w: showNulls ? nullW : t.w, real: showNulls });
        }
      } else {
        (n.children || []).forEach(function (c) { var v = valid(c); if (v) t.kids.push(build(v, depth + 1)); });
      }
      return t;
    }
    var tree = build(rid, 0);

    function gapAt(d) { return d === 0 ? gap : sgap; }
    function place(t) {
      if (!t.kids.length) return { L: [-t.w / 2], R: [t.w / 2] };
      var subs = t.kids.map(function (k) { return k.phantom ? { L: [-k.w / 2], R: [k.w / 2] } : place(k); });
      var n = subs.length, i, d, s, v;
      var off;
      if (inorder && n === 2) {
        var maxR = Math.max.apply(null, subs[0].R), minL = Math.min.apply(null, subs[1].L);
        // the whole left subtree ends gap/2 left of the parent's centre, the right subtree starts gap/2 right of it
        // (for leaf children this is the classic ±(w + gap) / 2)
        off = [-gap / 2 - maxR, gap / 2 - minL];
      } else {
        var offL = [0], accR = subs[0].R.slice();
        for (i = 1; i < n; i++) {
          s = subs[i]; var sh = -Infinity;
          for (d = 0; d < Math.min(accR.length, s.L.length); d++) sh = Math.max(sh, accR[d] + gapAt(d) - s.L[d]);
          offL[i] = sh;
          for (d = 0; d < s.R.length; d++) { v = s.R[d] + sh; accR[d] = d < accR.length ? Math.max(accR[d], v) : v; }
        }
        var offR = []; offR[n - 1] = 0;
        var accL = subs[n - 1].L.slice();
        for (i = n - 2; i >= 0; i--) {
          s = subs[i]; var sh2 = Infinity;
          for (d = 0; d < Math.min(accL.length, s.R.length); d++) sh2 = Math.min(sh2, accL[d] - gapAt(d) - s.R[d]);
          offR[i] = sh2;
          for (d = 0; d < s.L.length; d++) { v = s.L[d] + sh2; accL[d] = d < accL.length ? Math.min(accL[d], v) : v; }
        }
        var cL = (offL[0] + offL[n - 1]) / 2, cR = (offR[0] + offR[n - 1]) / 2;
        off = offL.map(function (x, k) { return ((x - cL) + (offR[k] - cR)) / 2; });
      }
      t.off = off;
      var L = [-t.w / 2], R = [t.w / 2];
      subs.forEach(function (sb, k) {
        for (var dd = 0; dd < sb.L.length; dd++) {
          var lv = sb.L[dd] + off[k], rv = sb.R[dd] + off[k];
          L[dd + 1] = L[dd + 1] === undefined ? lv : Math.min(L[dd + 1], lv);
          R[dd + 1] = R[dd + 1] === undefined ? rv : Math.max(R[dd + 1], rv);
        }
      });
      return { L: L, R: R };
    }
    place(tree);

    var minX = Infinity, maxX = -Infinity, maxD = 0;
    function assign(t, x, parentId) {
      out.pos[t.id] = { x: x, y: t.depth, depth: t.depth, w: t.w };
      if (parentId !== null) out.parent[t.id] = parentId;
      minX = Math.min(minX, x - t.w / 2); maxX = Math.max(maxX, x + t.w / 2); maxD = Math.max(maxD, t.depth);
      (t.kids || []).forEach(function (k, i) {
        var cx = x + t.off[i];
        if (k.phantom) {
          if (k.real) {
            out.nulls.push({ parent: t.id, side: k.side, x: cx, y: t.depth + 1, depth: t.depth + 1, w: k.w });
            minX = Math.min(minX, cx - k.w / 2); maxX = Math.max(maxX, cx + k.w / 2); maxD = Math.max(maxD, t.depth + 1);
          }
        } else assign(k, cx, t.id);
      });
    }
    assign(tree, 0, null);
    // shift so the left edge is 0
    Object.keys(out.pos).forEach(function (id) { out.pos[id].x -= minX; });
    out.nulls.forEach(function (nl) { nl.x -= minX; });
    out.maxX = maxX - minX; out.minX = 0; out.width = maxX - minX; out.depth = maxD;
    out.root = rid; out.binary = binary;
    return out;
  };

  /* In-order sequence of a binary tree (for tests and describe()). */
  layout.inorder = function (nodes, rootId) {
    var map = layout.index(nodes), out = [], seen = {};
    var rid = layout.findRoot(map, rootId, true);
    (function walk(id) {
      if (id === null || !map[id] || seen[id]) return;
      seen[id] = true;
      walk(str(map[id].left)); out.push(id); walk(str(map[id].right));
    }(rid));
    return out;
  };

  /* Bend for a node moving during a re-layout, so rotations read as a swing around the rotating pair:
     given start s, end e and the centroid c of all depth-changing movers, returns {arc, arcX} such that
     the path bulges away from c like an arc around it (sagitta capped at 35% of the chord). */
  layout.swingBend = function (s, e, c) {
    var dx = e.x - s.x, dy = e.y - s.y, chord = Math.hypot(dx, dy);
    if (chord < 1) return { arc: 0, arcX: 0 };
    var a1 = Math.atan2(s.y - c.y, s.x - c.x), a2 = Math.atan2(e.y - c.y, e.x - c.x);
    var th = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
    var R = (Math.hypot(s.x - c.x, s.y - c.y) + Math.hypot(e.x - c.x, e.y - c.y)) / 2;
    var sag = Math.min(R * (1 - Math.cos(th / 2)), chord * 0.35);
    if (!(sag > 0.5)) return { arc: 0, arcX: 0 };
    var nx = -dy / chord, ny = dx / chord;                       // unit normal
    var mx = (s.x + e.x) / 2 - c.x, my = (s.y + e.y) / 2 - c.y;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }            // point away from the centroid
    return { arcX: nx * sag, arc: -ny * sag };                    // vz.step: y -= arc*sin, x += arcX*sin
  };

  if (typeof module === 'object' && module.exports) module.exports = layout;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, fmt = vz.fmt;

  var DEFAULTS = {
    nodeSize: 40,          // max node diameter / pill height in px (shrinks to fit the width)
    minNodeSize: 12,       // below ~16 px labels hide and nodes become dots
    levelHeight: null,     // px between levels (default: from node size)
    gap: 0.5,              // horizontal gap between siblings, in node widths
    order: 'tidy',         // 'tidy' | 'inorder' (binary only)
    showNulls: false,
    height: null,          // fixed SVG height (levels compress to fit)
    shape: 'auto',         // 'auto' (circle, pill when the label is wider) | 'circle' | 'pill'
    swing: true,           // curved paths for re-parented nodes (rotations)
    labelFormatter: null,  // (value, node) -> string
    onNodeClick: null,
    duration: undefined
  };

  function treeView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var V = vz.createView(container, 'tree', {
      label: opts.label || 'Tree figure', interactive: !!opts.onNodeClick, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('edges'); ctx.layer('nulls'); ctx.layer('nodes'); ctx.layer('pointers');
    var S = { nodes: new vz.Store(), edges: new vz.Store(), nulls: new vz.Store(), ptrs: new vz.Store() };
    var clickable = !!opts.onNodeClick;
    var prepared = { units: 0, dotUnits: 0, depth: 0, ptr: false };
    var maxSeen = { depth: 0 };
    var textCache = new Map();
    var G = null;

    function measure(s, px, weight) {
      var k = s + '|' + px + '|' + (weight || 650);
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(s, px, false, weight || 650); textCache.set(k, w); }
      return w;
    }
    function labelOf(n) {
      if (n.label !== undefined && n.label !== null) return String(n.label);
      if (opts.labelFormatter) return String(opts.labelFormatter(n.value, n));
      return fmt(n.value);
    }
    function fontFor(k) { return vz.clamp(Math.round(k * 0.4), 9, 16); }
    /* node width in units (1 = circle) for a given diameter k */
    function unitsFor(n, k, dots) {
      if (opts.shape === 'circle' || dots) return 1;
      var fs = fontFor(k), t = labelOf(n);
      if (!t) return 1;
      var need = (measure(t, fs) + Math.max(10, k * 0.5)) / k;
      if (opts.shape === 'pill') return Math.max(1.25, need);
      return need > 0.94 ? Math.max(1, need) : 1;
    }
    function runLayout(map, rid, k, dots) {
      return layout.tidy(map, rid, {
        gap: opts.gap, showNulls: opts.showNulls, order: opts.order,
        width: function (id) { return unitsFor(map[id], k, dots); }
      });
    }

    /* ---------------------------------------------------------- geometry */
    function geometry(state) {
      var map = layout.index(state.nodes || []);
      var binary = layout.isBinary(map);
      var rid = layout.findRoot(map, state.root, binary);
      var W = ctx.width, pad = 16;
      var k = opts.nodeSize, avail = W - 2 * pad;
      var lay = runLayout(map, rid, k);
      var units = Math.max(lay.width, prepared.units || 0, 1);
      if (avail / units < k) {
        k = Math.max(opts.minNodeSize, avail / units);
        var dots = k < 16;                               // labels will hide: lay out plain dots
        lay = runLayout(map, rid, k, dots);              // label widths depend on the font at this size
        if (dots) k = Math.min(15.9, Math.max(k, avail / Math.max(lay.width, prepared.dotUnits || 0, 1)));
        else if (lay.width * k > avail) k = Math.max(opts.minNodeSize, avail / lay.width);
      }
      var hasSub = false, hasRet = false, hasPtr = (state.pointers || []).length > 0, hasBadge = false;
      Object.keys(map).forEach(function (id) {
        var n = map[id];
        if (n.sub !== undefined && n.sub !== null && n.sub !== '') hasSub = true;
        if (n.returnValue !== undefined && n.returnValue !== null) hasRet = true;
        if (n.badge !== undefined && n.badge !== null && n.badge !== '') hasBadge = true;
      });
      var depth = Math.max(lay.depth, prepared.depth || 0, maxSeen.depth);
      if (!opts.height) maxSeen.depth = depth;
      var extraBelow = (hasSub ? 13 : 0) + (hasRet ? 9 : 0);
      var levelH = opts.levelHeight || vz.clamp(Math.round(k * 1.55), 40, 74) + extraBelow;
      var top = pad + (hasBadge ? 6 : 0);
      var bottom = pad + extraBelow + (hasPtr || prepared.ptr ? 30 : 0);
      var height = top + k + depth * levelH + bottom;
      if (opts.height) {
        var avail = opts.height - top - bottom - k;
        if (depth > 0 && avail / depth < levelH) levelH = Math.max(k + 8, avail / depth);
        height = opts.height;
      }
      // root anchored at the centre when it fits; otherwise shift to keep the whole tree inside
      var ox = 0;
      if (rid !== null) {
        var rootX = lay.pos[rid].x;
        ox = W / 2 - rootX * k;
        var left = ox + lay.minX * k, right = ox + lay.maxX * k;
        if (right - left <= W - 2 * pad) {
          if (left < pad) ox += pad - left;
          if (right > W - pad) ox -= right - (W - pad);
        } else ox = (W - (lay.maxX - lay.minX) * k) / 2 - lay.minX * k;
      }
      return {
        map: map, rid: rid, lay: lay, k: k, levelH: levelH, top: top, height: height, ox: ox,
        font: fontFor(k), showText: k >= 16, showBadges: k >= 20,
        px: function (p) { return { x: ox + p.x * k, y: top + k / 2 + p.depth * levelH }; }
      };
    }

    /* ---------------------------------------------------------- nodes */
    function buildNode(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-node' }, ctx.layers.nodes);
      rec.halo = vz.svg('rect', { class: 'vz-halo' }, g);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintNode;
      if (clickable) makeClickable(rec);
    }
    function makeClickable(rec) {
      var d = rec.data;
      vz.clickable(rec.el, d ? 'node ' + labelOf(d) + (d.state && d.state !== 'default' ? ', ' + d.state : '') : null, function () {
        var n = rec.data || {};
        var payload = { id: rec.id, value: n.value, label: n.label, node: n };
        em.emit('click', payload);
        if (opts.onNodeClick) opts.onNodeClick(payload);
      });
    }
    function chip(rec, key, cls, text, state) {
      var has = text !== undefined && text !== null && text !== '';
      if (!has) { if (rec[key]) { rec[key].g.remove(); rec[key] = null; } return null; }
      if (!rec[key]) {
        var g = vz.svg('g', { class: 'vz-badge ' + cls }, rec.el);
        rec[key] = { g: g, rect: vz.svg('rect', { rx: 7, ry: 7, height: 14, y: -7 }, g), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g) };
      }
      var t = String(text), w = Math.max(14, measure(t, 10, 650) + 9);
      vz.text(rec[key].text, t);
      vz.set(rec[key].rect, 'width', vz.n2(w)); vz.set(rec[key].rect, 'x', vz.n2(-w / 2));
      vz.state(rec[key].g, state || 'default');
      rec[key].w = w;
      return rec[key];
    }
    function setNodeContent(rec, n) {
      var label = labelOf(n);
      vz.text(rec.txt, G.showText ? label : '');
      var fs = G.font;
      if (G.showText && label) {
        var maxW = rec.to.w - Math.max(6, G.k * 0.22);
        var w = measure(label, fs);
        if (w > maxW) fs = Math.max(8, Math.floor(fs * maxW / w));
      }
      vz.set(rec.txt, 'font-size', fs);
      // one deterministic class string (state + colour flags), so history never changes token order
      var st = n.state || 'default';
      vz.set(rec.el, 'class', 'vz-item vz-node is-' + st + (n.color === 'red' ? ' rb-red' : n.color === 'black' ? ' rb-black' : '') +
        (n.color && st !== 'default' ? ' has-halo' : '') + (clickable ? ' is-clickable' : ''));
      var b = chip(rec, 'badge', 'vz-node-badge', G.showBadges ? n.badge : null, n.badgeState);
      var ret = n.returnValue !== undefined && n.returnValue !== null ? (n.returnPrefix !== undefined ? n.returnPrefix : '= ') + fmt(n.returnValue) : null;
      var rc = chip(rec, 'ret', 'vz-ret', G.showBadges ? ret : null, n.returnState || 'done');
      if (n.sub !== undefined && n.sub !== null && n.sub !== '' && G.showText) {
        if (!rec.sub) rec.sub = vz.svg('text', { class: 'vz-label vz-node-sub', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
        vz.text(rec.sub, n.sub);
      } else if (rec.sub) { rec.sub.remove(); rec.sub = null; }
      rec.hasRet = !!rc;
      if (clickable) vz.set(rec.el, 'aria-label', 'node ' + label + ((n.state && n.state !== 'default') ? ', ' + n.state : ''));
      return b;
    }
    function paintNode(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      var w = Math.max(1, c.w), h = Math.max(1, c.h), r = h / 2;
      vz.set(rec.shape, 'x', vz.n2(-w / 2)); vz.set(rec.shape, 'y', vz.n2(-h / 2));
      vz.set(rec.shape, 'width', vz.n2(w)); vz.set(rec.shape, 'height', vz.n2(h));
      vz.set(rec.shape, 'rx', vz.n2(r)); vz.set(rec.shape, 'ry', vz.n2(r));
      var hw = w + 9, hh = h + 9;
      vz.set(rec.halo, 'x', vz.n2(-hw / 2)); vz.set(rec.halo, 'y', vz.n2(-hh / 2));
      vz.set(rec.halo, 'width', vz.n2(hw)); vz.set(rec.halo, 'height', vz.n2(hh));
      vz.set(rec.halo, 'rx', vz.n2(hh / 2)); vz.set(rec.halo, 'ry', vz.n2(hh / 2));
      if (rec.badge) {
        var circ = Math.abs(w - h) < 1;
        var bx = circ ? r * 0.78 + rec.badge.w / 2 - 5 : w / 2 - 4, by = circ ? -r * 0.78 : -h / 2 - 1;
        vz.place(rec.badge.g, bx, by);
      }
      if (rec.ret) vz.place(rec.ret.g, 0, h / 2 + 2);
      if (rec.sub) vz.set(rec.sub, 'y', vz.n2(h / 2 + (rec.ret ? 19 : 10)));
    }

    /* ---------------------------------------------------------- edges (keyed by child id) */
    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.grab = vz.svg('circle', { class: 'vz-head vz-edge-grab', r: 3, opacity: 0 }, g);
      rec.el = g; rec.paint = paintEdge;
    }
    function nodePos(id) { var r = S.nodes.get(id); return r ? r.cur : null; }
    function paintEdge(rec) {
      var c = rec.cur, child = nodePos(rec.id);
      var pa = nodePos(rec.pFrom), pb = nodePos(rec.pTo);
      if (!child || (!pa && !pb)) return;
      pa = pa || pb; pb = pb || pa;
      var ax = vz.lerp(pa.x, pb.x, c.m), ay = vz.lerp(pa.y, pb.y, c.m);
      vz.opacity(rec.el, Math.min(c.o, child.o === undefined ? 1 : Math.max(child.o, 0)));
      // start at the parent's bottom edge, end at the child's top edge (shapes also cover the ends)
      var pr = vz.lerp(pa.h || 0, pb.h || 0, c.m) / 2 * 0.92, cr = (child.h || 0) / 2 * (child.s || 1) * 0.92;
      var dx = child.x - ax, dy = child.y - ay, d = Math.hypot(dx, dy) || 1;
      var sx = ax + dx / d * Math.min(pr, d / 2), sy = ay + dy / d * Math.min(pr, d / 2);
      var ex = child.x - dx / d * Math.min(cr, d / 2), ey = child.y - dy / d * Math.min(cr, d / 2);
      vz.set(rec.line, 'd', 'M' + vz.n2(sx) + ' ' + vz.n2(sy) + 'L' + vz.n2(ex) + ' ' + vz.n2(ey));
      // while the parent end is being handed to a new parent, mark it with a small grab dot
      var moving = rec.pFrom !== rec.pTo && c.m > 0.04 && c.m < 0.96;
      vz.set(rec.grab, 'opacity', moving ? (Math.min(1, Math.min(c.m, 1 - c.m) * 8)).toFixed(2) : 0);
      vz.set(rec.grab, 'cx', vz.n2(sx)); vz.set(rec.grab, 'cy', vz.n2(sy));
    }

    /* ---------------------------------------------------------- null stubs */
    function buildNull(rec) {
      var g = vz.svg('g', { class: 'vz-null' }, ctx.layers.nulls);
      rec.line = vz.svg('path', { class: 'vz-null-line' }, g);
      rec.box = vz.svg('rect', { class: 'vz-null-box' }, g);
      rec.txt = vz.svg('text', { class: 'vz-null-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintNull;
    }
    function paintNull(rec) {
      var c = rec.cur, p = nodePos(rec.parent);
      vz.opacity(rec.el, c.o);
      var sz = Math.max(8, G.k * 0.42);
      vz.set(rec.box, 'x', vz.n2(c.x - sz / 2)); vz.set(rec.box, 'y', vz.n2(c.y - sz / 2));
      vz.set(rec.box, 'width', vz.n2(sz)); vz.set(rec.box, 'height', vz.n2(sz));
      vz.set(rec.box, 'rx', 3);
      vz.set(rec.txt, 'x', vz.n2(c.x)); vz.set(rec.txt, 'y', vz.n2(c.y));
      vz.set(rec.txt, 'font-size', vz.clamp(Math.round(sz * 0.62), 7, 11));
      if (p) {
        var dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1, pr = (p.h || 0) / 2;
        vz.set(rec.line, 'd', 'M' + vz.n2(p.x + dx / d * pr) + ' ' + vz.n2(p.y + dy / d * pr) + 'L' + vz.n2(c.x - dx / d * sz * 0.6) + ' ' + vz.n2(c.y - dy / d * sz * 0.6));
      }
    }

    /* ---------------------------------------------------------- pointers (slide between nodes) */
    function buildPointer(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head', d: 'M0 0L-5 7Q0 5.6 5 7Z' }, g);
      rec.chipEl = vz.svg('rect', { class: 'vz-ptr-chip', height: 17, rx: 8.5, ry: 8.5, y: 7 }, g);
      rec.label = vz.svg('text', { class: 'vz-ptr-chip-text', 'text-anchor': 'middle', dy: '.35em', y: 15.5 }, g);
      rec.el = g; rec.paint = paintPointer;
    }
    function paintPointer(rec) {
      var c = rec.cur, a = nodePos(rec.tFrom), b = nodePos(rec.tTo);
      if (!a && !b) return;
      a = a || b; b = b || a;
      var x = vz.lerp(a.x, b.x, c.m), y = vz.lerp(a.y, b.y, c.m), h = vz.lerp(a.h || 0, b.h || 0, c.m);
      var below = h / 2 + 3 + (vz.lerp(a.below || 0, b.below || 0, c.m));
      vz.place(rec.el, x + c.lv * 0, y + below + c.lv * 20);
      vz.opacity(rec.el, c.o);
      vz.set(rec.head, 'opacity', c.lv > 0.5 ? 0 : null);
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      G = geometry(state);
      ctx.setHeight(G.height);
      var map = G.map, lay = G.lay, k = G.k;
      var anim = [], later = [];

      function push(rec, target, from, list) {
        if (from) rec.cur = Object.assign({}, target, from);
        vz.retarget(rec, target);
        rec.delay = rec.delay || 0;
        (list || anim).push(rec);
      }

      /* nodes */
      var prev = {};
      S.nodes.each(function (rec, id) { if (!rec.exiting) prev[id] = { x: rec.cur.x, y: rec.cur.y, depth: rec.depth }; });
      var targets = {};
      Object.keys(lay.pos).forEach(function (id) {
        var p = G.px(lay.pos[id]);
        var h = k, w = lay.pos[id].w * k;
        targets[id] = { x: p.x, y: p.y, w: w, h: h, s: 1, o: 1 };
      });
      // swing bends: centroid of movers whose depth changes
      var movers = [];
      Object.keys(targets).forEach(function (id) {
        var pv = prev[id];
        if (pv && pv.depth !== undefined && pv.depth !== lay.pos[id].depth) movers.push(id);
      });
      var centroid = null;
      if (opts.swing && movers.length >= 2 && ms > 0) {
        var cx = 0, cy = 0;
        movers.forEach(function (id) { cx += prev[id].x + targets[id].x; cy += prev[id].y + targets[id].y; });
        centroid = { x: cx / (2 * movers.length), y: cy / (2 * movers.length) };
      }
      S.nodes.begin();
      var enterOrder = 0;
      Object.keys(targets).forEach(function (id) {
        var n = map[id], t = targets[id];
        var rec = S.nodes.use(id, buildNode);
        rec.data = n;
        rec.to = { w: t.w };
        setNodeContent(rec, n);
        rec.cur.below = (rec.hasRet ? 11 : 0) + (rec.sub ? 13 : 0);
        t.below = rec.cur.below;
        var parentId = lay.parent[id];
        rec.depth = lay.pos[id].depth;
        if (rec.isNew) {
          var pp = parentId !== undefined ? (S.nodes.get(parentId) && !S.nodes.get(parentId).isNew ? S.nodes.get(parentId).cur : targets[parentId]) : null;
          var from = pp ? { x: pp.x, y: pp.y, s: 0.35, o: 0 } : { s: 0.5, o: 0 };
          rec.delay = ms > 0 ? Math.min(0.35, 0.12 + enterOrder * 0.03) : 0;
          enterOrder++;
          rec.arc = 0; rec.arcX = 0;
          push(rec, t, from);
        } else {
          rec.delay = 0; rec.arc = 0; rec.arcX = 0;
          if (centroid && movers.indexOf(id) !== -1) {
            var bend = layout.swingBend(prev[id], t, centroid);
            rec.arc = bend.arc; rec.arcX = bend.arcX;
          }
          push(rec, t);
        }
      });
      S.nodes.end().forEach(function (rec) {
        rec.delay = 0; rec.arc = 0; rec.arcX = 0;
        push(rec, Object.assign({}, rec.cur, { o: 0, s: 0.6 }));
      });

      /* edges */
      var edgeState = {};
      if (Array.isArray(state.edges)) state.edges.forEach(function (e) { if (e) edgeState[String(e.from) + '-' + String(e.to)] = e.state || 'default'; });
      else if (state.edges) Object.keys(state.edges).forEach(function (key) { edgeState[key] = state.edges[key]; });
      S.edges.begin();
      Object.keys(lay.parent).forEach(function (cid) {
        var pid = lay.parent[cid];
        var rec = S.edges.use(cid, buildEdge);
        vz.state(rec.el, edgeState[pid + '-' + cid] || 'default');
        if (rec.isNew) { rec.pFrom = pid; rec.pTo = pid; rec.cur = { m: 1, o: 0 }; push(rec, { m: 1, o: 1 }, null, later); }
        else {
          if (rec.pTo !== pid) {
            // re-parented: the parent end slides from the old parent to the new one
            var curPA = nodePos(rec.pFrom), curPB = nodePos(rec.pTo);
            rec.pFrom = rec.pTo; rec.pTo = pid;
            if (!curPA || !curPB) rec.pFrom = pid;
            rec.cur.m = 0;
          }
          push(rec, { m: 1, o: 1 }, null, later);
        }
      });
      S.edges.end().forEach(function (rec) { push(rec, { m: 1, o: 0 }, null, later); });

      /* null stubs */
      S.nulls.begin();
      lay.nulls.forEach(function (nl) {
        var rec = S.nulls.use(nl.parent + '|' + nl.side, buildNull);
        rec.parent = nl.parent;
        vz.text(rec.txt, G.k >= 22 ? '∅' : '');
        var p = G.px(nl);
        var t = { x: p.x, y: p.y - k * 0.15, o: 1 };
        if (rec.isNew) { var pp = targets[nl.parent]; push(rec, t, { o: 0, x: pp ? pp.x : t.x, y: pp ? pp.y : t.y }, later); }
        else push(rec, t, null, later);
      });
      S.nulls.end().forEach(function (rec) { push(rec, Object.assign({}, rec.cur, { o: 0 }), null, later); });

      /* pointers */
      S.ptrs.begin();
      var perTarget = {};
      (state.pointers || []).forEach(function (p) {
        if (!p) return;
        var tid = str(p.target);
        if (tid === null || !targets[tid]) return;
        var key = String(p.id !== undefined ? p.id : p.name);
        var rec = S.ptrs.use(key, buildPointer);
        var text = p.label !== undefined ? String(p.label) : String(p.name);
        vz.text(rec.label, text);
        var w = measure(text, 11.5, 700) + 14;
        vz.set(rec.chipEl, 'width', vz.n2(w)); vz.set(rec.chipEl, 'x', vz.n2(-w / 2));
        vz.state(rec.el, p.state || 'active');
        var lv = perTarget[tid] || 0;
        perTarget[tid] = lv + 1;
        if (rec.isNew) { rec.tFrom = tid; rec.tTo = tid; rec.cur = { m: 1, o: 0, lv: lv }; }
        else if (rec.tTo !== tid) { rec.tFrom = rec.tTo; rec.tTo = tid; rec.cur.m = 0; }
        push(rec, { m: 1, o: 1, lv: lv }, null, later);
      });
      S.ptrs.end().forEach(function (rec) { push(rec, Object.assign({}, rec.cur, { o: 0 }), null, later); });

      /* one transition */
      var all = anim.concat(later);
      tr.run(ms, function (t) {
        var i, rec;
        for (i = 0; i < anim.length; i++) { rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
        for (i = 0; i < later.length; i++) { rec = later[i]; vz.step(rec, vz.local(t, rec.delay)); }
        // edges/stubs/pointers read node positions, so paint them after every node moved this frame
        S.edges.each(function (r) { r.paint(r); });
        S.nulls.each(function (r) { r.paint(r); });
        S.ptrs.each(function (r) { r.paint(r); });
      }, function () {
        S.edges.each(function (r) { if (!r.exiting) r.pFrom = r.pTo; });
        S.ptrs.each(function (r) { if (!r.exiting) r.tFrom = r.tTo; });
        Object.keys(S).forEach(function (key) { S[key].purge(); });
      });
      void all;
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      state = state || {};
      var map = layout.index(state.nodes || []);
      var binary = layout.isBinary(map);
      var rid = layout.findRoot(map, state.root, binary);
      if (rid === null) return 'Empty tree.';
      var lay = layout.tidy(map, rid, { binary: binary });
      var levels = [];
      Object.keys(lay.pos).sort(function (a, b) { return lay.pos[a].x - lay.pos[b].x; }).forEach(function (id) {
        var d = lay.pos[id].depth, n = map[id];
        (levels[d] = levels[d] || []).push(labelOf(n) + (n.state && n.state !== 'default' ? ' (' + n.state + ')' : '') + (n.color ? ' ' + n.color : ''));
      });
      var s = 'Tree with ' + Object.keys(lay.pos).length + ' nodes, root ' + labelOf(map[rid]) + '. ' +
        levels.map(function (l, d) { return 'Level ' + d + ': ' + l.join(', '); }).join('. ') + '.';
      var ps = (state.pointers || []).filter(function (p) { return p && map[str(p.target)]; }).map(function (p) { return (p.label || p.name) + ' at ' + labelOf(map[str(p.target)]); });
      if (ps.length) s += ' ' + ps.join(', ') + '.';
      return s;
    };
    /* Scan all snapshots so scale and height stay fixed while the trace plays. */
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        var map = layout.index((st && st.nodes) || []);
        var rid = layout.findRoot(map, st && st.root, layout.isBinary(map));
        if (rid === null) return;
        var lay = runLayout(map, rid, opts.nodeSize);
        prepared.units = Math.max(prepared.units, lay.width);
        prepared.dotUnits = Math.max(prepared.dotUnits || 0, runLayout(map, rid, opts.nodeSize, true).width);
        prepared.depth = Math.max(prepared.depth, lay.depth);
        if ((st.pointers || []).some(Boolean)) prepared.ptr = true;
      });
      api.refresh();
      return api;
    };
    api.reset = function () { prepared = { units: 0, dotUnits: 0, depth: 0, ptr: false }; maxSeen = { depth: 0 }; return api; };
    api.setOptions = function (o) { Object.assign(opts, o || {}); textCache.clear(); api.refresh(); return api; };
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

  treeView.layout = layout;
  treeView.defaults = DEFAULTS;
  VDSA.views.tree = treeView;
}(typeof window !== 'undefined' ? window : null));
