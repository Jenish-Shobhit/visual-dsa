/* Lesson 19 · Binary search trees — the lesson's BST view and static mini trees.

   Why a lesson view instead of VDSA.views.tree? A BST lesson needs things the shared tree view does not draw:
     - a key "in hand" that floats above the node it is compared with, travels down the tree along a path,
       and lands in an empty link, becoming the new node (same id, one continuous motion);
     - a copied key flying from the successor to the node it replaces (two-child delete);
     - shaded whole subtrees (hulls) for "every key here is < 50", ruled-out halves and pruned ranges;
     - empty child links as targets ("where does 7 go?"), and a number line under the tree that nodes
       drop onto (in-order walk) or rise from (binary search folded into a tree).
   It reuses the shared plumbing (VDSA.vz: keyed records, one rAF transition, resize) and the tree view's
   pure layout (VDSA.views.tree.layout.tidy), and it draws with the same classes (.vz-node, .vz-edge,
   .vz-pointer, is-<state>) so colours and both themes come from css/viz.css.

   const view = VDSA.lesson19.bstView(el, {label: 'BST'});
   view.prepare(steps);                           // fixes scale and height for a whole trace
   view.render(step, {duration: ctx.duration});   // step: see js/algos/19-binary-search-trees.js

   VDSA.lesson19.miniTree(spec, opts) -> SVG markup string (quiz options, summary tiles, variation minis). */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz;
  var L = V.views.tree.layout;
  var ns = V.lesson19 = V.lesson19 || {};

  function str(v) { return v === undefined || v === null ? null : String(v); }
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : (v === null || v === undefined ? '' : String(v)); }

  var DEFAULTS = {
    nodeSize: 38, minNodeSize: 18, gap: 0.5, order: 'tidy', showNulls: false,
    levelHeight: null, maxLevel: 64, colGap: 0.95, pad: 14,
    height: null, maxHeight: null, dataIds: false, label: 'Binary search tree',
    onNodeClick: null, onSlotClick: null, describe: true
  };

  function bstView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var interactive = !!(opts.onNodeClick || opts.onSlotClick);
    var made = vz.createView(container, 'tree', { label: opts.label, interactive: interactive, className: 'bst', describe: opts.describe ? undefined : false }, draw);
    var ctx = made.ctx, api = made.api, em = made.em, tr = made.tr;
    ['hulls', 'strip', 'edges', 'slots', 'nodes', 'pointers', 'floats'].forEach(ctx.layer);
    var S = { nodes: new vz.Store(), edges: new vz.Store(), slots: new vz.Store(), hulls: new vz.Store(), ptrs: new vz.Store(), strip: new vz.Store(), floats: new vz.Store() };
    var prepared = { units: 0, depth: 0 }, pf = {};
    var G = null, frameT = 1;
    var stripG = vz.svg('g', { class: 'bst-strip-axis', opacity: 0 }, ctx.layers.strip);
    var stripLine = vz.svg('path', { class: 'bst-strip-line' }, stripG);
    var stripLabel = vz.svg('text', { class: 'bst-strip-label' }, stripG);
    var stripSlots = vz.svg('g', { class: 'bst-strip-slots' }, stripG);
    var emptyText = vz.svg('text', { class: 'vz-empty', 'text-anchor': 'middle', opacity: 0 }, ctx.layers.floats);
    vz.text(emptyText, 'empty tree');

    /* ---------------------------------------------------------- structure and layout */
    function features(state) {
      var f = { probe: !!state.probe, ptr: (state.pointers || []).length > 0, strip: !!state.strip,
        hullLabel: (state.hulls || []).some(function (h) { return h && h.label; }), sub: false, badge: false };
      (state.nodes || []).forEach(function (n) {
        if (n.sub !== undefined && n.sub !== null && n.sub !== '') f.sub = true;
        if (n.badge !== undefined && n.badge !== null && n.badge !== '') f.badge = true;
      });
      return f;
    }
    function measure(state) {
      var map = {};
      (state.nodes || []).forEach(function (n) { if (n && n.id !== undefined && n.id !== null) map[String(n.id)] = n; });
      var rid = state.root !== undefined && state.root !== null && map[String(state.root)] ? String(state.root) : null;
      var lay;
      if (state.cols !== undefined && state.cols !== null) {
        lay = { pos: {}, nulls: [], parent: {}, depth: 0, columns: true };
        var s = opts.colGap;
        if (rid !== null) {
          var stack = [[rid, 0, null]], seen = {};
          while (stack.length) {
            var e = stack.pop(), id = e[0];
            if (seen[id] || !map[id]) continue;
            seen[id] = true;
            var n = map[id];
            lay.pos[id] = { x: 0.5 + (n.col || 0) * s, depth: e[1] };
            if (e[2] !== null) lay.parent[id] = e[2];
            if (e[1] > lay.depth) lay.depth = e[1];
            if (str(n.right)) stack.push([str(n.right), e[1] + 1, id]);
            if (str(n.left)) stack.push([str(n.left), e[1] + 1, id]);
          }
        }
        lay.width = Math.max(1, (state.cols - 1) * s + 1);
      } else if (rid !== null) {
        var tl = L.tidy(map, rid, { gap: opts.gap, showNulls: opts.showNulls, order: opts.order });
        lay = { pos: {}, nulls: tl.nulls, parent: tl.parent, depth: tl.depth, width: tl.width };
        Object.keys(tl.pos).forEach(function (id) { lay.pos[id] = { x: tl.pos[id].x, depth: tl.pos[id].depth }; });
      } else {
        lay = { pos: {}, nulls: [], parent: {}, depth: 0, width: 1 };
      }
      lay.map = map; lay.rid = rid;
      return lay;
    }
    function geometry(state) {
      var lay = measure(state);
      var f = features(state);
      Object.keys(pf).forEach(function (k) { if (pf[k]) f[k] = true; });
      var W = ctx.width, pad = opts.pad;
      var units = lay.columns ? lay.width : Math.max(lay.width, prepared.units || 0, 1);
      var k = Math.max(opts.minNodeSize, Math.min(opts.nodeSize, (W - 2 * pad) / units));
      var depth = Math.max(lay.depth, prepared.depth || 0);
      if (opts.height) {
        var kH = (opts.height - 2 * pad - 8 - (f.ptr ? 24 : 0) - (f.strip ? 36 : 0) - (f.hullLabel ? 20 : 0)) / ((f.probe ? 0.84 : 0) + 1 + depth * 1.2 + (f.strip ? 0.8 : 0));
        k = Math.max(opts.minNodeSize, Math.min(k, kH));
      }
      var levelH = opts.levelHeight || vz.clamp(Math.round(k * 1.5), 34, opts.maxLevel);
      if (f.sub) levelH += 12;
      var probeR = k * 0.42;
      var lane = f.probe ? Math.round(probeR * 2 + 7) : 0;
      var top = pad + lane + (f.badge ? 6 : 0);
      var below = (f.ptr ? 24 : 0) + (f.hullLabel ? 20 : 0) + (f.sub ? 4 : 0);
      var stripH = f.strip ? Math.round(k * 0.78) + 36 : 0;
      var fixed = top + k + below + stripH + pad;
      if (opts.height) {
        if (depth > 0) levelH = Math.max(k * 1.08, Math.min(levelH, (opts.height - fixed) / depth));
      } else if (opts.maxHeight && depth > 0 && fixed + depth * levelH > opts.maxHeight) {
        levelH = Math.max(k * 1.12, (opts.maxHeight - fixed) / depth);
      }
      var treeBottom = top + k + depth * levelH;
      var height = Math.max(opts.height || 0, treeBottom + below + stripH + pad);
      var ox;
      if (lay.columns) ox = (W - units * k) / 2;
      else if (lay.rid !== null) {
        var rootX = lay.pos[lay.rid].x;
        ox = W / 2 - rootX * k;
        var left = ox, right = ox + lay.width * k;
        if (right - left <= W - 2 * pad) {
          if (left < pad) ox += pad - left;
          if (right > W - pad) ox -= right - (W - pad);
        } else ox = (W - lay.width * k) / 2;
      } else ox = W / 2 - k / 2;
      return {
        lay: lay, k: k, levelH: levelH, top: top, ox: ox, W: W, height: height, probeR: probeR,
        stripY: treeBottom + below + Math.round(k * 0.39) + 22, font: vz.clamp(Math.round(k * 0.48), 10, 16),
        pos: function (id) { var p = lay.pos[id]; return p ? { x: ox + p.x * k, y: top + k / 2 + p.depth * levelH } : null; },
        colX: function (col) { return ox + (0.5 + col * opts.colGap) * k; }
      };
    }
    function slotPos(parent, side) {
      if (parent === null || parent === undefined || side === 'root') {
        var rp = G.lay.rid !== null ? G.pos(G.lay.rid) : null;
        return { x: rp ? rp.x : G.W / 2, y: G.top + G.k / 2 };
      }
      parent = String(parent);
      if (opts.showNulls) {
        for (var i = 0; i < G.lay.nulls.length; i++) {
          var nl = G.lay.nulls[i];
          if (nl.parent === parent && nl.side === side) return { x: G.ox + nl.x * G.k, y: G.top + G.k / 2 + nl.depth * G.levelH };
        }
      }
      var p = G.pos(parent);
      if (!p) return null;
      var dx = G.k * (G.lay.columns ? opts.colGap : (1 + opts.gap) / 2);
      return { x: p.x + (side === 'left' ? -dx : dx), y: p.y + G.levelH };
    }
    function probeAbove(p) { return { x: p.x, y: p.y - (G.k / 2 + G.probeR + 6) }; }
    function curPos(id) {
      id = str(id);
      if (id === null) return null;
      var r = S.nodes.get(id);
      if (r && !r.exiting) return { x: r.cur.x, y: r.cur.y };
      r = S.strip.get(id);
      if (r && !r.exiting) return { x: r.cur.x, y: r.cur.y };
      r = S.floats.get(id);
      if (r && !r.exiting && r.px !== undefined) return { x: r.px, y: r.py };
      return null;
    }

    /* ---------------------------------------------------------- nodes */
    function buildNode(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-node' }, ctx.layers.nodes);
      rec.shape = vz.svg('circle', { class: 'vz-shape', cx: 0, cy: 0 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintNode;
      if (opts.dataIds) g.setAttribute('data-id', rec.id);
      if (opts.onNodeClick) {
        vz.clickable(g, null, function () {
          var n = rec.data || {};
          var payload = { id: rec.id, value: n.value, node: n };
          em.emit('click', payload);
          opts.onNodeClick(payload);
        });
      }
    }
    function chip(rec, key, cls, text, state, parent) {
      var has = text !== undefined && text !== null && text !== '';
      if (!has) { if (rec[key]) { rec[key].g.remove(); rec[key] = null; } return null; }
      if (!rec[key]) {
        var g = vz.svg('g', { class: 'vz-badge ' + cls }, parent || rec.el);
        rec[key] = { g: g, rect: vz.svg('rect', { rx: 7, ry: 7, height: 14, y: -7 }, g), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g) };
      }
      var t = String(text), w = Math.max(14, vz.textWidth(t, 10, true, 650) + 9);
      vz.text(rec[key].text, t);
      vz.set(rec[key].rect, 'width', vz.n2(w)); vz.set(rec[key].rect, 'x', vz.n2(-w / 2));
      vz.state(rec[key].g, state || 'default');
      rec[key].w = w;
      return rec[key];
    }
    function setNodeContent(rec, n) {
      var label = n.label !== undefined && n.label !== null ? String(n.label) : fmt(n.value);
      if (rec.label !== undefined && rec.label !== label && !rec.isNew) { rec.cur.b = 0; }
      rec.label = label;
      vz.text(rec.txt, G.k >= 16 ? label : '');
      var fs = G.font, maxW = G.k * 0.86, w = vz.textWidth(label, fs, false, 650);
      if (w > maxW) fs = Math.max(8, Math.floor(fs * maxW / w));
      vz.set(rec.txt, 'font-size', fs);
      vz.set(rec.el, 'class', 'vz-item vz-node is-' + (n.state || 'default') + (opts.onNodeClick ? ' is-clickable' : ''));
      chip(rec, 'badge', 'bst-node-badge', n.badge, n.badgeState);
      if (n.sub !== undefined && n.sub !== null && n.sub !== '') {
        if (!rec.sub) rec.sub = vz.svg('text', { class: 'vz-label bst-node-sub', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
        vz.text(rec.sub, n.sub);
      } else if (rec.sub) { rec.sub.remove(); rec.sub = null; }
      var aria = 'node ' + label + (n.state && n.state !== 'default' ? ', ' + n.state : '');
      if (opts.dataIds) vz.set(rec.el, 'data-label', n.dataLabel || ('Node ' + label));
      else if (opts.onNodeClick) vz.set(rec.el, 'aria-label', aria);
    }
    function paintNode(rec) {
      var c = rec.cur, bump = 1 + 0.2 * Math.sin(Math.PI * vz.clamp(c.b === undefined ? 1 : c.b, 0, 1));
      vz.place(rec.el, c.x, c.y, c.s * bump);
      vz.opacity(rec.el, c.o);
      vz.set(rec.shape, 'r', vz.n2(Math.max(1, G.k / 2)));
      if (rec.badge) vz.place(rec.badge.g, G.k * 0.39 + rec.badge.w / 2 - 5, -G.k * 0.39);
      if (rec.sub) vz.set(rec.sub, 'y', vz.n2(G.k / 2 + 9));
    }

    /* ---------------------------------------------------------- edges (keyed by child id) */
    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.el = g; rec.paint = paintEdge;
    }
    function paintEdge(rec) {
      var c = rec.cur, ch = S.nodes.get(rec.id);
      var pa = S.nodes.get(rec.pFrom), pb = S.nodes.get(rec.pTo);
      if (!ch || (!pa && !pb)) return;
      pa = (pa || pb).cur; pb = (pb || pa).cur;
      var chc = ch.cur;
      var ax = vz.lerp(pa.x, pb.x, c.m), ay = vz.lerp(pa.y, pb.y, c.m);
      vz.opacity(rec.el, Math.min(c.o, Math.max(0, chc.o)));
      var r = G.k / 2;
      var dx = chc.x - ax, dy = chc.y - ay, d = Math.hypot(dx, dy) || 1;
      var sr = Math.min(r * 0.95, d / 2), er = Math.min(r * (chc.s || 1) * 0.95, d / 2);
      vz.set(rec.line, 'd', 'M' + vz.n2(ax + dx / d * sr) + ' ' + vz.n2(ay + dy / d * sr) + 'L' + vz.n2(chc.x - dx / d * er) + ' ' + vz.n2(chc.y - dy / d * er));
    }

    /* ---------------------------------------------------------- empty child slots */
    function buildSlot(rec) {
      var g = vz.svg('g', { class: 'bst-slot' }, ctx.layers.slots);
      rec.stub = vz.svg('path', { class: 'bst-slot-stub' }, g);
      rec.hit = vz.svg('g', { class: 'bst-slot-hit' }, g);
      rec.ring = vz.svg('circle', { class: 'bst-slot-ring' }, rec.hit);
      rec.txt = vz.svg('text', { class: 'bst-slot-text', 'text-anchor': 'middle', dy: '.35em' }, rec.hit);
      rec.el = g; rec.paint = paintSlot;
      if (opts.dataIds) {
        rec.hit.setAttribute('data-id', 'slot-' + rec.parent + '-' + rec.side);
      }
      if (opts.onSlotClick) {
        vz.clickable(rec.hit, 'empty ' + rec.side + ' link', function () {
          var payload = { parent: rec.parent, side: rec.side };
          em.emit('slot', payload);
          opts.onSlotClick(payload);
        });
      }
    }
    function paintSlot(rec) {
      var c = rec.cur, p = S.nodes.get(rec.parent);
      vz.opacity(rec.el, c.o);
      var r = Math.max(7, G.k * 0.33);
      vz.set(rec.ring, 'cx', vz.n2(c.x)); vz.set(rec.ring, 'cy', vz.n2(c.y)); vz.set(rec.ring, 'r', vz.n2(r));
      vz.set(rec.txt, 'x', vz.n2(c.x)); vz.set(rec.txt, 'y', vz.n2(c.y));
      vz.set(rec.txt, 'font-size', vz.clamp(Math.round(r * 0.9), 8, 12));
      if (p) {
        var pc = p.cur, dx = c.x - pc.x, dy = c.y - pc.y, d = Math.hypot(dx, dy) || 1, pr = G.k / 2;
        vz.set(rec.stub, 'd', 'M' + vz.n2(pc.x + dx / d * pr) + ' ' + vz.n2(pc.y + dy / d * pr) + 'L' + vz.n2(c.x - dx / d * (r + 1)) + ' ' + vz.n2(c.y - dy / d * (r + 1)));
      } else vz.set(rec.stub, 'd', '');
    }

    /* ---------------------------------------------------------- hulls: a shaded whole subtree */
    function buildHull(rec) {
      var g = vz.svg('g', { class: 'bst-hull' }, ctx.layers.hulls);
      rec.path = vz.svg('path', { class: 'bst-hull-shape' }, g);
      rec.txt = vz.svg('text', { class: 'bst-hull-label', 'text-anchor': 'middle' }, g);
      rec.el = g; rec.paint = paintHull;
    }
    function paintHull(rec) {
      vz.opacity(rec.el, rec.cur.o);
      var levels = {};
      rec.members.forEach(function (m) {
        var nr = S.nodes.get(m.id);
        if (!nr) return;
        var c = nr.cur, lv = levels[m.depth] || (levels[m.depth] = { minX: Infinity, maxX: -Infinity, y: 0, n: 0 });
        lv.minX = Math.min(lv.minX, c.x); lv.maxX = Math.max(lv.maxX, c.x); lv.y += c.y; lv.n += 1;
      });
      var ds = Object.keys(levels).map(Number).sort(function (a, b) { return a - b; });
      if (!ds.length) { vz.set(rec.path, 'd', ''); return; }
      var r = G.k / 2 + 6;
      var rows = ds.map(function (d) { var lv = levels[d]; return { a: lv.minX - r, b: lv.maxX + r, y: lv.y / lv.n }; });
      var f = rows[0], l = rows[rows.length - 1], mid = (f.a + f.b) / 2, pts = [[mid, f.y - r], [f.b, f.y - r]];
      rows.forEach(function (row) { pts.push([row.b, row.y]); });
      pts.push([l.b, l.y + r]); pts.push([l.a, l.y + r]);
      for (var i = rows.length - 1; i >= 0; i--) pts.push([rows[i].a, rows[i].y]);
      pts.push([f.a, f.y - r]);
      pts.push([mid, f.y - r]);
      vz.set(rec.path, 'd', vz.roundedPath(pts, r * 0.85) + 'Z');
      var cx = (l.a + l.b) / 2;
      vz.set(rec.txt, 'x', vz.n2(cx)); vz.set(rec.txt, 'y', vz.n2(l.y + r + 14));
    }

    /* ---------------------------------------------------------- pointers (chips under a node) */
    function buildPointer(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head', d: 'M0 0L-5 7Q0 5.6 5 7Z' }, g);
      rec.chipEl = vz.svg('rect', { class: 'vz-ptr-chip', height: 17, rx: 8.5, ry: 8.5, y: 7 }, g);
      rec.label = vz.svg('text', { class: 'vz-ptr-chip-text', 'text-anchor': 'middle', dy: '.35em', y: 15.5 }, g);
      rec.el = g; rec.paint = paintPointer;
    }
    function paintPointer(rec) {
      var a = S.nodes.get(rec.tFrom), b = S.nodes.get(rec.tTo), c = rec.cur;
      if (!a && !b) return;
      a = (a || b).cur; b = (b || a).cur;
      var x = vz.lerp(a.x, b.x, c.m), y = vz.lerp(a.y, b.y, c.m);
      vz.place(rec.el, x, y + G.k / 2 + 2 + c.lv * 19);
      vz.opacity(rec.el, c.o);
      vz.set(rec.head, 'opacity', c.lv > 0.5 ? 0 : null);
    }

    /* ---------------------------------------------------------- number line */
    function buildStripItem(rec) {
      var g = vz.svg('g', { class: 'vz-item bst-cell' }, ctx.layers.strip);
      rec.shape = vz.svg('rect', { class: 'vz-shape', rx: 5, ry: 5 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintStripItem;
    }
    function paintStripItem(rec) {
      var c = rec.cur, w = G.k * Math.min(0.92, opts.colGap) - 3, h = G.k * 0.78;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      vz.set(rec.shape, 'x', vz.n2(-w / 2)); vz.set(rec.shape, 'y', vz.n2(-h / 2));
      vz.set(rec.shape, 'width', vz.n2(w)); vz.set(rec.shape, 'height', vz.n2(h));
    }

    /* ---------------------------------------------------------- floats: the probe (key in hand) and copied keys */
    function buildFloat(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-node bst-float' }, ctx.layers.floats);
      rec.shadow = vz.svg('ellipse', { class: 'vz-lift-shadow' }, g);
      rec.shape = vz.svg('circle', { class: 'vz-shape', cx: 0, cy: 0 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.noteG = vz.svg('g', { class: 'bst-note', opacity: 0 }, g);
      rec.noteRect = vz.svg('rect', { rx: 8, ry: 8, height: 18, y: -9 }, rec.noteG);
      rec.noteTxt = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, rec.noteG);
      rec.el = g; rec.paint = paintFloat;
    }
    function paintFloat(rec) {
      var c = rec.cur;
      var p = rec.pts && rec.pts.length > 1 ? vz.pointOnPolyline(rec.pts, vz.clamp(c.m, 0, 1)) : (rec.pts ? { x: rec.pts[0][0], y: rec.pts[0][1] } : { x: 0, y: 0 });
      rec.px = p.x; rec.py = p.y;
      vz.place(rec.el, p.x, p.y, c.s);
      vz.opacity(rec.el, c.o);
      var r = rec.big ? G.k / 2 : G.probeR;
      vz.set(rec.shape, 'r', vz.n2(r));
      vz.set(rec.shadow, 'cx', 1.5); vz.set(rec.shadow, 'cy', vz.n2(r * 0.55)); vz.set(rec.shadow, 'rx', vz.n2(r * 0.95)); vz.set(rec.shadow, 'ry', vz.n2(r * 0.55));
      var noteO = rec.note ? vz.clamp((frameT - 0.55) / 0.35, 0, 1) : 0;
      if (rec.noteShown) noteO = rec.note ? 1 : 0;
      vz.set(rec.noteG, 'opacity', noteO.toFixed(2));
    }
    function setFloatContent(rec, f, big) {
      rec.big = big;
      var label = fmt(f.value);
      vz.text(rec.txt, label);
      var r = big ? G.k / 2 : G.probeR, fs = Math.max(9, Math.round(r * 0.9)), w = vz.textWidth(label, fs, false, 650);
      if (w > r * 1.7) fs = Math.max(8, Math.floor(fs * r * 1.7 / w));
      vz.set(rec.txt, 'font-size', fs);
      vz.set(rec.el, 'class', 'vz-item vz-node bst-float ' + (big ? 'bst-chip' : 'bst-probe') + ' is-' + (f.state || 'key'));
      var note = f.note || null;
      if (note !== rec.note) { rec.noteShown = false; rec.note = note; }
      if (note) {
        vz.text(rec.noteTxt, note);
        var nw = vz.textWidth(note, 11.5, true, 700) + 14;
        vz.set(rec.noteRect, 'width', vz.n2(nw));
        var right = note.charAt(0) !== '>';
        var off = r + 5 + nw / 2;
        vz.set(rec.noteRect, 'x', vz.n2(-nw / 2));
        vz.place(rec.noteG, right ? off : -off, 0);
      }
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      G = geometry(state);
      ctx.setHeight(G.height);
      var lay = G.lay, k = G.k, map = lay.map;
      var anim = [], later = [];
      function push(rec, target, from, list) {
        if (from) rec.cur = Object.assign({}, target, from);
        vz.retarget(rec, target);
        rec.delay = rec.delay || 0;
        (list || anim).push(rec);
      }
      vz.set(emptyText, 'x', vz.n2(G.W / 2)); vz.set(emptyText, 'y', vz.n2(G.top + k / 2 + 4));
      vz.set(emptyText, 'opacity', lay.rid === null && !state.probe && !state.strip ? 1 : 0);

      /* floats first: remember where the probe was, so a node with its id can land from there */
      var floatWas = {};
      S.floats.each(function (rec, id) { if (!rec.exiting && rec.px !== undefined) floatWas[id] = { x: rec.px, y: rec.py, s: rec.cur.s }; });
      var stripWas = {};
      S.strip.each(function (rec, id) { if (!rec.exiting) stripWas[id] = { x: rec.cur.x, y: rec.cur.y }; });

      /* nodes */
      S.nodes.begin();
      var enterOrder = 0, targets = {};
      Object.keys(lay.pos).forEach(function (id) { targets[id] = G.pos(id); });
      Object.keys(targets).forEach(function (id) {
        var n = map[id], t = targets[id];
        var rec = S.nodes.use(id, buildNode);
        rec.data = n;
        if (rec.cur.b === undefined) rec.cur.b = 1;
        setNodeContent(rec, n);
        var target = { x: t.x, y: t.y, s: 1, o: 1, b: 1 };
        rec.arc = 0; rec.arcX = 0; rec.delay = 0;
        if (rec.isNew || rec.revived) {
          var src = null, fromS = 0.4;
          if (floatWas[id]) { src = floatWas[id]; fromS = 0.84; }
          else if (n.from && (stripWas[n.from] || curPos(n.from))) { src = stripWas[n.from] || curPos(n.from); fromS = 0.8; }
          if (src) push(rec, target, { x: src.x, y: src.y, s: fromS, o: 1, b: 1 });
          else {
            var pid = lay.parent[id], pp = pid !== undefined ? (S.nodes.get(pid) && !S.nodes.get(pid).isNew ? S.nodes.get(pid).cur : targets[pid]) : null;
            rec.delay = ms > 0 ? Math.min(0.35, 0.12 + enterOrder * 0.03) : 0;
            enterOrder += 1;
            push(rec, target, pp ? { x: pp.x, y: pp.y, s: 0.35, o: 0, b: 1 } : { s: 0.5, o: 0, b: 1 });
          }
        } else push(rec, target);
      });
      S.nodes.end().forEach(function (rec) { rec.delay = 0; push(rec, Object.assign({}, rec.cur, { o: 0, s: 0.55, b: 1 })); });

      /* edges */
      var edgeState = state.edges || {};
      S.edges.begin();
      Object.keys(lay.parent).forEach(function (cid) {
        var pid = lay.parent[cid];
        var rec = S.edges.use(cid, buildEdge);
        vz.state(rec.el, edgeState[pid + '-' + cid] || 'default');
        if (rec.isNew || rec.revived) { rec.pFrom = pid; rec.pTo = pid; rec.cur = { m: 1, o: 0 }; }
        else if (rec.pTo !== pid) { rec.pFrom = S.nodes.get(rec.pTo) ? rec.pTo : pid; rec.pTo = pid; rec.cur.m = 0; }
        push(rec, { m: 1, o: 1 }, null, later);
      });
      S.edges.end().forEach(function (rec) { push(rec, { m: 1, o: 0 }, null, later); });

      /* slots */
      var slotList = [], slotState = {};
      (state.slots || []).forEach(function (s) { if (s) slotState[(s.parent === null ? 'root' : s.parent) + '|' + s.side] = s; });
      if (opts.showNulls) lay.nulls.forEach(function (nl) { slotList.push({ parent: nl.parent, side: nl.side }); });
      Object.keys(slotState).forEach(function (key) {
        var s = slotState[key];
        if (s.parent === null) return;
        if (!slotList.some(function (x) { return x.parent === String(s.parent) && x.side === s.side; })) slotList.push({ parent: String(s.parent), side: s.side });
      });
      S.slots.begin();
      slotList.forEach(function (sl) {
        if (!targets[sl.parent]) return;
        var key = sl.parent + '|' + sl.side;
        var rec = S.slots.use(key, function (r) { r.parent = sl.parent; r.side = sl.side; buildSlot(r); });
        var info = slotState[key] || {};
        vz.set(rec.el, 'class', 'bst-slot is-' + (info.state || 'default'));
        vz.text(rec.txt, info.label !== undefined ? info.label : (k >= 26 ? '∅' : ''));
        if (opts.dataIds) {
          var pn = map[sl.parent];
          vz.set(rec.hit, 'data-label', 'Empty ' + sl.side + ' link of ' + (pn ? fmt(pn.value) : 'node'));
        }
        var p = slotPos(sl.parent, sl.side);
        var t = { x: p.x, y: p.y, o: 1 };
        if (rec.isNew || rec.revived) { var pp = targets[sl.parent]; push(rec, t, { o: 0, x: pp.x, y: pp.y }, later); }
        else push(rec, t, null, later);
      });
      S.slots.end().forEach(function (rec) { push(rec, Object.assign({}, rec.cur, { o: 0 }), null, later); });

      /* hulls */
      S.hulls.begin();
      (state.hulls || []).forEach(function (h) {
        if (!h || !targets[str(h.root)]) return;
        var key = String(h.id !== undefined ? h.id : 'h-' + h.root);
        var rec = S.hulls.use(key, buildHull);
        var members = [], stack = [str(h.root)];
        while (stack.length) {
          var id = stack.pop(); if (id === null || !map[id] || !lay.pos[id]) continue;
          members.push({ id: id, depth: lay.pos[id].depth });
          stack.push(str(map[id].left)); stack.push(str(map[id].right));
        }
        rec.members = members;
        vz.state(rec.el, h.state || 'active');
        vz.text(rec.txt, h.label || '');
        push(rec, { o: 1 }, rec.isNew || rec.revived ? { o: 0 } : null, later);
      });
      S.hulls.end().forEach(function (rec) { push(rec, { o: 0 }, null, later); });

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
        var w = vz.textWidth(text, 11.5, true, 700) + 14;
        vz.set(rec.chipEl, 'width', vz.n2(w)); vz.set(rec.chipEl, 'x', vz.n2(-w / 2));
        vz.state(rec.el, p.state || 'active');
        var lv = perTarget[tid] || 0;
        perTarget[tid] = lv + 1;
        if (rec.isNew || rec.revived) { rec.tFrom = tid; rec.tTo = tid; rec.cur = { m: 1, o: 0, lv: lv }; }
        else if (rec.tTo !== tid) { rec.tFrom = rec.tTo; rec.tTo = tid; rec.cur.m = 0; }
        push(rec, { m: 1, o: 1, lv: lv }, null, later);
      });
      S.ptrs.end().forEach(function (rec) { push(rec, Object.assign({}, rec.cur, { o: 0 }), null, later); });

      /* number line */
      if (state.strip) {
        var x0 = G.colX(0) - k * 0.6, x1 = G.colX(Math.max(0, (state.cols || 1) - 1)) + k * 0.6, ly = G.stripY + k * 0.39 + 7;
        vz.set(stripLine, 'd', 'M' + vz.n2(x0) + ' ' + vz.n2(ly) + 'H' + vz.n2(x1));
        vz.text(stripLabel, state.strip.label || '');
        vz.set(stripLabel, 'x', vz.n2(x0)); vz.set(stripLabel, 'y', vz.n2(ly + 15));
        vz.set(stripG, 'opacity', 1);
        var cols = state.cols || 0, sw = k * Math.min(0.92, opts.colGap) - 3, sh = k * 0.78;
        while (stripSlots.childNodes.length > cols) stripSlots.removeChild(stripSlots.lastChild);
        while (stripSlots.childNodes.length < cols) vz.svg('rect', { class: 'vz-slot', rx: 5, ry: 5 }, stripSlots);
        for (var ci = 0; ci < cols; ci++) {
          var sr = stripSlots.childNodes[ci];
          vz.set(sr, 'x', vz.n2(G.colX(ci) - sw / 2)); vz.set(sr, 'y', vz.n2(G.stripY - sh / 2));
          vz.set(sr, 'width', vz.n2(sw)); vz.set(sr, 'height', vz.n2(sh));
        }
      } else vz.set(stripG, 'opacity', 0);
      S.strip.begin();
      ((state.strip && state.strip.items) || []).forEach(function (it) {
        var rec = S.strip.use(String(it.id), buildStripItem);
        vz.text(rec.txt, fmt(it.value));
        vz.set(rec.txt, 'font-size', vz.clamp(Math.round(k * 0.36), 9, 14));
        vz.set(rec.el, 'class', 'vz-item bst-cell is-' + (it.state || 'default'));
        var t = { x: G.colX(it.col || 0), y: G.stripY, s: 1, o: 1 };
        if (rec.isNew || rec.revived) {
          var src = it.from ? curPos(it.from) : null;
          rec.delay = 0;
          push(rec, t, src ? { x: src.x, y: src.y, s: 1.05, o: 1 } : { o: 0, s: 0.8 });
        } else push(rec, t);
      });
      S.strip.end().forEach(function (rec) { push(rec, Object.assign({}, rec.cur, { o: 0 })); });

      /* floats: probe + chips */
      var floats = [];
      if (state.probe) floats.push({ f: state.probe, big: false });
      (state.chips || []).forEach(function (c) { if (c) floats.push({ f: c, big: true }); });
      S.floats.begin();
      floats.forEach(function (item) {
        var f = item.f, id = String(f.id);
        var rec = S.floats.use(id, buildFloat);
        setFloatContent(rec, f, item.big);
        function spot(w) {
          if (!w) return null;
          if (w.node !== undefined) { var p = targets[str(w.node)]; return p ? (item.big ? p : probeAbove(p)) : null; }
          if (w.slot) return slotPos(w.slot.parent, w.slot.side);
          return null;
        }
        var end = f.at !== undefined && f.at !== null ? spot({ node: f.at }) : (f.slot ? spot({ slot: f.slot }) : null);
        if (!end) end = { x: G.W / 2, y: G.top - k };
        var way = (f.path || []).map(spot).filter(Boolean);
        var start;
        if (rec.isNew || rec.revived || rec.px === undefined) {
          if (item.big && f.from !== undefined && targets[str(f.from)]) start = curPos(f.from) || targets[str(f.from)];
          else { var first = way[0] || end; start = { x: first.x, y: first.y - k * 0.9 }; }
          rec.cur = { m: 0, o: item.big ? 1 : 0, s: 1 };
        } else start = { x: rec.px, y: rec.py };
        var pts = [[start.x, start.y]];
        way.concat([end]).forEach(function (p) { var last = pts[pts.length - 1]; if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.5) pts.push([p.x, p.y]); });
        rec.pts = pts;
        rec.cur.m = 0;
        push(rec, { m: 1, o: 1, s: 1 });
      });
      S.floats.end().forEach(function (rec) {
        // a probe whose id became a node has landed: hide it at once (the node takes over from its position)
        if (targets[rec.id]) { rec.cur.o = 0; push(rec, { m: 1, o: 0, s: 1 }); return; }
        push(rec, { m: 1, o: 0, s: rec.big ? 1 : 0.7 });
      });

      tr.run(ms, function (t) {
        frameT = ms > 0 ? t : 1;
        var i, rec;
        for (i = 0; i < anim.length; i++) { rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
        for (i = 0; i < later.length; i++) { rec = later[i]; vz.step(rec, vz.local(t, rec.delay)); }
        S.edges.each(function (r) { r.paint(r); });
        S.slots.each(function (r) { r.paint(r); });
        S.hulls.each(function (r) { r.paint(r); });
        S.ptrs.each(function (r) { r.paint(r); });
      }, function () {
        frameT = 1;
        S.edges.each(function (r) { if (!r.exiting) r.pFrom = r.pTo; });
        S.ptrs.each(function (r) { if (!r.exiting) r.tFrom = r.tTo; });
        S.floats.each(function (r) { if (!r.exiting) { r.noteShown = true; r.paint(r); } });
        Object.keys(S).forEach(function (key) { S[key].purge(); });
      });
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      state = state || {};
      var nodes = state.nodes || [];
      if (!nodes.length || state.root === null || state.root === undefined) return 'Empty binary search tree.' + (state.probe ? ' Key in hand: ' + fmt(state.probe.value) + '.' : '');
      var lay = measure(state), map = lay.map;
      var byDepth = [];
      Object.keys(lay.pos).forEach(function (id) { var d = lay.pos[id].depth; (byDepth[d] = byDepth[d] || []).push(id); });
      var s = 'Binary search tree with ' + Object.keys(lay.pos).length + ' nodes, root ' + fmt(map[lay.rid].value) + ', height ' + lay.depth + '. ' +
        byDepth.map(function (ids, d) {
          return 'Level ' + d + ': ' + ids.sort(function (a, b) { return map[a].value - map[b].value; }).map(function (id) {
            var n = map[id]; return fmt(n.value) + (n.state && n.state !== 'default' ? ' (' + n.state + ')' : '');
          }).join(', ');
        }).join('. ') + '.';
      if (state.probe) s += ' Key in hand: ' + fmt(state.probe.value) + '.';
      return s;
    };
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        if (!st) return;
        var lay = measure(st);
        if (!lay.columns) prepared.units = Math.max(prepared.units, lay.width);
        prepared.depth = Math.max(prepared.depth, lay.depth);
        var f = features(st);
        Object.keys(f).forEach(function (k) { if (f[k]) pf[k] = true; });
      });
      api.refresh();
      return api;
    };
    api.reset = function () { prepared = { units: 0, depth: 0 }; pf = {}; return api; };
    api.setOptions = function (o) { Object.assign(opts, o || {}); api.refresh(); return api; };
    api.positionOf = function (id) { var r = S.nodes.get(String(id)); return r ? { x: r.cur.x, y: r.cur.y } : null; };
    api.geometry = function () { return G; };
    return api;
  }

  /* ================================================================== static mini trees (SVG markup) */
  /* miniTree(spec, {size, gap, states: {value: state}, edges: {'pv-cv': state}, badges: {value: text},
                     subs: {value: text}, label, hullOf: value, hullState, pad})
     spec: nested [value, left, right] (numbers for leaves) or a lesson19 tree object. */
  function miniTree(spec, o) {
    o = o || {};
    var map = {}, root = null, counter = 0;
    function add(s) {
      if (s === null || s === undefined) return null;
      if (typeof s === 'number') s = [s];
      var id = 'm' + (counter++);
      map[id] = { id: id, value: s[0], left: null, right: null };
      map[id].left = add(s[1]); map[id].right = add(s[2]);
      return id;
    }
    if (spec && spec.nodes && spec.root !== undefined) {
      Object.keys(spec.nodes).forEach(function (k) { var n = spec.nodes[k]; map[k] = { id: k, value: n.value, left: n.left, right: n.right }; });
      root = spec.root;
    } else root = add(spec);
    var K = o.size || 24, gap = o.gap === undefined ? 0.45 : o.gap, pad = o.pad === undefined ? 6 : o.pad;
    var lay = root !== null ? L.tidy(map, root, { gap: gap, order: o.order || 'tidy' }) : { pos: {}, parent: {}, width: 1, depth: 0 };
    var lvl = K * (o.level || 1.45);
    var stripH = o.strip ? K * 1.35 : 0;
    var W = lay.width * K + pad * 2, H = K + lay.depth * lvl + pad * 2 + (o.subs ? 12 : 0) + stripH;
    function P(id) { var p = lay.pos[id]; return { x: pad + p.x * K, y: pad + K / 2 + p.depth * lvl }; }
    var byVal = {};
    Object.keys(map).forEach(function (id) { byVal[map[id].value] = id; });
    var out = [];
    out.push('<svg class="vz vz-tree bst-mini" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vz.n2(W) + ' ' + vz.n2(H) + '" width="' + vz.n2(W) + '" role="img" aria-label="' + V.escape(o.label || 'Tree') + '" focusable="false">');
    if (o.hullOf !== undefined && byVal[o.hullOf] !== undefined) {
      var ids = [], st = [byVal[o.hullOf]];
      while (st.length) { var x = st.pop(); if (x === null || !map[x]) continue; ids.push(x); st.push(map[x].left); st.push(map[x].right); }
      var xs = ids.map(function (i) { return P(i); });
      var minX = Math.min.apply(null, xs.map(function (p) { return p.x; })) - K / 2 - 4, maxX = Math.max.apply(null, xs.map(function (p) { return p.x; })) + K / 2 + 4;
      var minY = Math.min.apply(null, xs.map(function (p) { return p.y; })) - K / 2 - 4, maxY = Math.max.apply(null, xs.map(function (p) { return p.y; })) + K / 2 + 4;
      out.push('<g class="bst-hull is-' + (o.hullState || 'active') + '"><rect class="bst-hull-shape" x="' + vz.n2(minX) + '" y="' + vz.n2(minY) + '" width="' + vz.n2(maxX - minX) + '" height="' + vz.n2(maxY - minY) + '" rx="' + vz.n2(K * 0.6) + '"/></g>');
    }
    Object.keys(lay.parent).forEach(function (cid) {
      var pid = lay.parent[cid], a = P(pid), b = P(cid);
      var est = (o.edges && o.edges[map[pid].value + '-' + map[cid].value]) || 'default';
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, r = K / 2;
      out.push('<g class="vz-edge is-' + est + '"><path class="vz-line" d="M' + vz.n2(a.x + dx / d * r) + ' ' + vz.n2(a.y + dy / d * r) + 'L' + vz.n2(b.x - dx / d * r) + ' ' + vz.n2(b.y - dy / d * r) + '"/></g>');
    });
    Object.keys(lay.pos).forEach(function (id) {
      var n = map[id], p = P(id), stt = (o.states && o.states[n.value]) || 'default';
      var label = fmt(n.value), fs = Math.max(8, Math.round(K * 0.42));
      out.push('<g class="vz-item vz-node is-' + stt + '" transform="translate(' + vz.n2(p.x) + ' ' + vz.n2(p.y) + ')"><circle class="vz-shape" r="' + vz.n2(K / 2) + '"/>' +
        '<text class="vz-ink vz-value" text-anchor="middle" dy=".35em" font-size="' + fs + '">' + V.escape(label) + '</text>');
      if (o.badges && o.badges[n.value] !== undefined) {
        var bt = String(o.badges[n.value]), bw = Math.max(13, bt.length * 6 + 7);
        out.push('<g class="vz-badge bst-node-badge is-default" transform="translate(' + vz.n2(K * 0.42 + bw / 2 - 4) + ' ' + vz.n2(-K * 0.4) + ')"><rect x="' + vz.n2(-bw / 2) + '" y="-6.5" width="' + bw + '" height="13" rx="6.5"/><text text-anchor="middle" dy=".35em" style="font-size:9px">' + V.escape(bt) + '</text></g>');
      }
      if (o.subs && o.subs[n.value] !== undefined) out.push('<text class="vz-label bst-node-sub" text-anchor="middle" y="' + vz.n2(K / 2 + 9) + '" dy=".35em">' + V.escape(String(o.subs[n.value])) + '</text>');
      out.push('</g>');
    });
    if (o.strip) {
      var sy = pad + K / 2 + lay.depth * lvl + K * 1.2, cw = K * 0.86, chh = K * 0.72;
      out.push('<path class="bst-strip-line" d="M' + vz.n2(pad) + ' ' + vz.n2(sy + chh / 2 + 3) + 'H' + vz.n2(W - pad) + '"/>');
      Object.keys(lay.pos).forEach(function (id) {
        var p = P(id), v = map[id].value;
        out.push('<line class="bst-drop" x1="' + vz.n2(p.x) + '" y1="' + vz.n2(p.y + K / 2 + 2) + '" x2="' + vz.n2(p.x) + '" y2="' + vz.n2(sy - chh / 2 - 2) + '"/>');
        out.push('<g class="vz-item bst-cell is-done" transform="translate(' + vz.n2(p.x) + ' ' + vz.n2(sy) + ')"><rect class="vz-shape" x="' + vz.n2(-cw / 2) + '" y="' + vz.n2(-chh / 2) + '" width="' + vz.n2(cw) + '" height="' + vz.n2(chh) + '" rx="3"/><text class="vz-ink vz-value" text-anchor="middle" dy=".35em" font-size="' + Math.max(7, Math.round(K * 0.36)) + '">' + V.escape(fmt(v)) + '</text></g>');
      });
    }
    out.push('</svg>');
    return out.join('');
  }

  ns.bstView = bstView;
  ns.miniTree = miniTree;
}());
