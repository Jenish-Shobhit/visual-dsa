/* Lesson 34 · custom views, built on the VDSA.vz toolkit (keyed records, one rAF loop, resize, state classes).

   VDSA.dp34.table(container, opts)   a DP table (boxes) or a subproblem DAG (circles) with dependency arcs:
                                      same-row arcs bow above or below the row (height grows with the distance, so
                                      nested arcs never cross), 'between' arrows join rows, 'mid' arrows join
                                      neighbouring circles. Arcs draw themselves in; cell values pop; a cursor ring
                                      slides; colours follow the shared state vocabulary (viz.css .vz-item/.vz-edge).
   VDSA.dp34.collapse(container, opts) the fib(n) recursion tree that collapses into a row of cached cells: every
                                      call flies to cell k, duplicate calls merge and fade, tree edges bend into DAG
                                      arrows. Driven by collapseSteps() from js/algos/34-dynamic-programming.js.
   Why custom: the engine grid view draws long same-row dependencies along one line beside the values, so several
   of them (LIS, coin change) overlap; here they nest as arcs. The tree view cannot merge nodes into a row. */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz;
  V.dp34 = V.dp34 || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function n2(v) { return Math.round(v * 100) / 100; }
  function fmtText(cell) {
    if (!cell) return '';
    if (cell.text !== undefined && cell.text !== null) return String(cell.text);
    return cell.value === undefined || cell.value === null ? '' : vz.fmt(cell.value);
  }

  /* ================================================================== DP table / DAG view */
  function tableView(container, opts) {
    opts = Object.assign({
      shape: 'box', cellMax: 50, cellMin: 24, gap: 6, labels: true, arcLabels: true,
      indexPos: 'below', subPos: 'below', dataIds: false, label: 'DP table', idPrefix: 'cell'
    }, opts || {});
    var reserve = { above: {}, below: {}, between: {}, sub: {}, cols: 0, rows: 0 };
    var host = typeof container === 'string' ? document.querySelector(container) : container;
    var made = vz.createView(host, 'dp34', { label: opts.label, className: 'dp34-table dp34-' + opts.shape, interactive: !!opts.dataIds, layers: ['bands', 'arcs', 'cells', 'cursor', 'text'] }, draw);
    var ctx = made.ctx, tr = made.tr, api = made.api;
    var cells = new vz.Store(), arcs = new vz.Store(), heads = new vz.Store(), cursorRec = null, G = null;

    function spanOf(a) { return Math.abs(a.to[1] - a.from[1]); }
    function sideOf(a) {
      if (a.side === 'between' || a.from[0] !== a.to[0]) return 'between';
      if (a.side === 'mid') return spanOf(a) === 1 ? 'mid' : 'above';
      return a.side === 'below' ? 'below' : 'above';
    }
    /* Scan a whole trace so lanes never grow mid-animation. */
    api.prepare = function (states) {
      reserve = { above: {}, below: {}, between: {}, sub: {}, index: {}, cols: 0, rows: 0 };
      (states || []).forEach(function (st) {
        if (!st) return;
        reserve.rows = Math.max(reserve.rows, st.rows.length);
        st.rows.forEach(function (r, ri) {
          reserve.cols = Math.max(reserve.cols, r.cells.length);
          if (r.cells.some(function (c) { return c && c.sub; })) reserve.sub[ri] = true;
          if (r.index) reserve.index[ri] = true;
        });
        (st.arcs || []).forEach(function (a) {
          var side = sideOf(a), r = a.to[0];
          if (side === 'above' || side === 'below') reserve[side][r] = Math.max(reserve[side][r] || 0, spanOf(a));
          if (side === 'between') reserve.between[Math.max(a.from[0], a.to[0])] = true;
        });
      });
      return api;
    };
    api.reset = function () { reserve = { above: {}, below: {}, between: {}, sub: {}, index: {}, cols: 0, rows: 0 }; cells.clear(); arcs.clear(); return api; };

    function arcH(span) {
      if (opts.shape === 'node') return 12 + span * G.pitch * 0.2;
      return clamp(10 + (span - 1) * G.cs * 0.36 + (span > 1 ? 6 : 0), 10, G.cs * 1.7 + 10);
    }
    function lane(side, r, st) {
      var span = reserve[side][r] || 0;
      (st.arcs || []).forEach(function (a) { if (sideOf(a) === side && a.to[0] === r) span = Math.max(span, spanOf(a)); });
      if (!span) return side === 'above' ? 6 : 4;
      return arcH(span) + (opts.arcLabels ? 14 : 4) + 6;
    }

    function layout(st) {
      var W = ctx.width, cols = Math.max(reserve.cols, 1), nrows = st.rows.length;
      st.rows.forEach(function (r) { cols = Math.max(cols, r.cells.length); });
      var narrow = W < 520;
      var labelW = opts.labels ? (narrow ? 36 : 62) : 0, padX = opts.shape === 'node' ? (narrow ? 8 : 16) : (narrow ? 4 : 8);
      var gap = narrow ? Math.min(opts.gap, 3) : opts.gap, cmin = narrow ? Math.min(opts.cellMin, 22) : opts.cellMin;
      var nf = narrow ? 1.45 : 1.9;
      var pitchMax = opts.shape === 'node' ? opts.cellMax * nf : opts.cellMax + gap;
      var pitch = Math.min(pitchMax, (W - labelW - padX * 2) / cols);
      var cs = opts.shape === 'node' ? pitch / nf : pitch - gap;
      var needed = 0;
      if (cs < cmin) {
        cs = cmin; pitch = opts.shape === 'node' ? cs * nf : cs + gap;
        needed = Math.ceil(labelW + padX * 2 + cols * pitch);
      }
      ctx.svg.style.minWidth = needed ? needed + 'px' : '';
      if (needed && needed > W) W = needed;
      var gridW = cols * pitch;
      var x0 = labelW + Math.max(padX, (W - labelW - gridW) / 2);
      if (opts.labels && !narrow) x0 = Math.max(labelW + padX, (W - gridW) / 2 + labelW / 2);
      G = { W: W, cs: cs, pitch: pitch, x0: x0, rows: [], labelW: labelW, narrow: narrow };
      var y = opts.shape === 'node' ? 8 : 6;
      for (var r = 0; r < nrows; r++) {
        var row = st.rows[r], R = { y: 0 };
        if (opts.indexPos === 'top' && (row.index || reserve.index[r])) { R.indexY = y + 10; y += 18; }
        if (r > 0 && (reserve.between[r] || (st.arcs || []).some(function (a) { return sideOf(a) === 'between' && a.to[0] === r; }))) y += 20;
        y += lane('above', r, st);
        R.top = y; R.cy = y + cs / 2; y += cs;
        R.bottom = y;
        if (opts.indexPos !== 'top' && (row.index || reserve.index[r])) { R.indexY = y + 16; y += 20; }
        var hasSub = reserve.sub[r] || row.cells.some(function (c) { return c && c.sub; });
        if (hasSub && opts.subPos !== 'outer') { R.subY = y + 12; y += 16; }
        R.belowTop = y;
        y += lane('below', r, st);
        if (hasSub && opts.subPos === 'outer') { R.subY = y + 11; y += 18; }
        y += 6;
        G.rows.push(R);
      }
      G.H = y + 2;
      return G;
    }
    function cx(c) { return G.x0 + c * G.pitch + G.pitch / 2; }

    function buildCell(rec) {
      rec.el = vz.svg('g', { class: 'vz-item dp34-cell' }, ctx.layers.cells);
      rec.slot = vz.svg(opts.shape === 'node' ? 'circle' : 'rect', { class: 'vz-slot' }, rec.el);
      rec.shape = vz.svg(opts.shape === 'node' ? 'circle' : 'rect', { class: 'vz-shape' }, rec.el);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
      rec.idx = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle' }, ctx.layers.text);
      rec.sub = vz.svg('text', { class: 'dp34-sub', 'text-anchor': 'middle' }, ctx.layers.text);
      rec.nodes = [rec.el, rec.idx, rec.sub];
      rec.cur = { x: 0, y: 0, s: 1, o: 1, e: 0 };
    }
    function paintCell(rec) {
      var c = rec.cur, h = G.cs * c.s;
      vz.place(rec.el, c.x, c.y);
      if (opts.shape === 'node') {
        vz.set(rec.shape, 'r', n2(h / 2)); vz.set(rec.slot, 'r', n2(G.cs / 2));
      } else {
        vz.set(rec.shape, 'x', n2(-h / 2)); vz.set(rec.shape, 'y', n2(-h / 2)); vz.set(rec.shape, 'width', n2(h)); vz.set(rec.shape, 'height', n2(h));
        vz.set(rec.shape, 'rx', n2(Math.min(9, h * 0.2)));
        vz.set(rec.slot, 'x', n2(-G.cs / 2)); vz.set(rec.slot, 'y', n2(-G.cs / 2)); vz.set(rec.slot, 'width', n2(G.cs)); vz.set(rec.slot, 'height', n2(G.cs)); vz.set(rec.slot, 'rx', n2(Math.min(9, G.cs * 0.2)));
      }
      vz.opacity(rec.shape, c.e); vz.opacity(rec.txt, c.e);
      vz.opacity(rec.slot, 1 - c.e);
      vz.opacity(rec.el, c.o);
    }

    function buildArc(rec) {
      rec.el = vz.svg('g', { class: 'vz-edge dp34-arc' }, ctx.layers.arcs);
      rec.halo = vz.svg('path', { class: 'dp34-arc-halo' }, rec.el);
      rec.line = vz.svg('path', { class: 'vz-line' }, rec.el);
      rec.head = vz.svg('path', { class: 'vz-head' }, rec.el);
      rec.lab = null;
      rec.cur = { d: 0, o: 1 };
    }
    /* geometry of an arc in SVG units: quadratic from (x1,y1) via (qx,qy) to (x2,y2) */
    function arcGeom(a, rank) {
      var side = sideOf(a), fr = G.rows[a.from[0]], tr_ = G.rows[a.to[0]], cs = G.cs;
      var x1 = cx(a.from[1]), x2 = cx(a.to[1]), dir = x2 >= x1 ? 1 : -1, g;
      if (side === 'between') {
        var down = a.to[0] > a.from[0], off = opts.shape === 'node' ? 0 : cs * 0.26;
        var sy = down ? fr.bottom + 2 + (fr.indexY && opts.indexPos !== 'top' ? 0 : 0) : fr.top - 2;
        var ey = down ? tr_.top - 3 : tr_.bottom + 3;
        var sx = x1 + off, ex = x2 + off;
        g = { x1: sx, y1: sy, x2: ex, y2: ey, qx: (sx + ex) / 2 + (x1 === x2 ? 0 : 0), qy: (sy + ey) / 2 };
      } else if (side === 'mid') {
        var r0 = cs / 2 + 3;
        g = { x1: x1 + dir * r0, y1: fr.cy, x2: x2 - dir * (r0 + 1), y2: tr_.cy, qx: (x1 + x2) / 2, qy: fr.cy };
      } else {
        var up = side === 'above', span = spanOf(a), h = arcH(span);
        var baseY = up ? fr.top - 3 : fr.bottom + 3;
        if (opts.shape === 'node') {
          var rr = cs / 2 + 2, ang = up ? -1 : 1;
          var sa = 0.9, ea = 0.9 - rank * 0.12;
          g = { x1: x1 + dir * rr * Math.sin(sa * 0.9), y1: fr.cy + ang * rr * Math.cos(sa * 0.9), x2: x2 - dir * rr * Math.sin(ea), y2: tr_.cy + ang * rr * Math.cos(ea) };
        } else {
          g = { x1: x1 + dir * cs * 0.12, y1: baseY, x2: x2 - dir * (cs * 0.3 - rank * 4), y2: baseY };
        }
        g.qx = (g.x1 + g.x2) / 2; g.qy = baseY + (up ? -2 * h : 2 * h);
      }
      g.angle = Math.atan2(g.y2 - g.qy, g.x2 - g.qx);
      // labels sit a third of the way along, near the source, so arcs that share a target keep their labels apart
      var lt = side === 'above' || side === 'below' ? 0.34 : 0.5, lu = 1 - lt;
      g.lx = lu * lu * g.x1 + 2 * lu * lt * g.qx + lt * lt * g.x2; g.ly = lu * lu * g.y1 + 2 * lu * lt * g.qy + lt * lt * g.y2;
      return g;
    }
    function paintArc(rec) {
      var c = rec.cur, g = rec.geo; if (!g) return;
      var d = 'M' + n2(g.x1) + ' ' + n2(g.y1) + 'Q' + n2(g.qx) + ' ' + n2(g.qy) + ' ' + n2(g.x2) + ' ' + n2(g.y2);
      vz.set(rec.line, 'd', d); vz.set(rec.halo, 'd', d);
      var len = g.len, drawn = c.d;
      if (drawn < 0.999 && !rec.dashed) {
        vz.set(rec.line, 'stroke-dasharray', n2(len) + ' ' + n2(len + 20)); vz.set(rec.line, 'stroke-dashoffset', n2(len * (1 - drawn)));
        vz.set(rec.halo, 'stroke-dasharray', n2(len) + ' ' + n2(len + 20)); vz.set(rec.halo, 'stroke-dashoffset', n2(len * (1 - drawn)));
      } else {
        vz.set(rec.line, 'stroke-dasharray', rec.dashed ? '5 5' : null); vz.set(rec.line, 'stroke-dashoffset', null);
        vz.set(rec.halo, 'stroke-dasharray', null); vz.set(rec.halo, 'stroke-dashoffset', null);
      }
      vz.set(rec.head, 'd', vz.arrowHead(g.x2, g.y2, g.angle, clamp(G.cs * 0.17, 5, 8)));
      vz.set(rec.head, 'opacity', drawn > 0.85 ? null : '0');
      if (rec.lab) { vz.set(rec.lab, 'x', n2(g.lx - (g.qy < g.y1 || g.qy > g.y1 ? 9 : 0))); vz.set(rec.lab, 'y', n2(g.ly + (g.qy < g.y1 ? -3 : g.qy > g.y1 ? 11 : -6))); vz.set(rec.lab, 'opacity', drawn > 0.85 ? null : '0'); }
      vz.opacity(rec.el, c.o);
    }
    function quadLen(g) {
      var len = 0, px = g.x1, py = g.y1;
      for (var i = 1; i <= 14; i++) { var t = i / 14, u = 1 - t; var x = u * u * g.x1 + 2 * u * t * g.qx + t * t * g.x2, y = u * u * g.y1 + 2 * u * t * g.qy + t * t * g.y2; len += Math.hypot(x - px, y - py); px = x; py = y; }
      return len;
    }

    function draw(st, ms, ro) {
      st = st || { rows: [] };
      layout(st);
      ctx.setHeight(G.H);
      var animate = ms > 0;
      var list = [];

      /* row labels */
      if (!api._labels) api._labels = [];
      api._labels.forEach(function (t) { t.remove(); });
      api._labels = [];
      if (opts.labels) st.rows.forEach(function (row, ri) {
        if (!row.label) return;
        var t = vz.svg('text', { class: 'dp34-rowlabel', x: n2(G.x0 - 10), y: n2(G.rows[ri].cy), 'text-anchor': 'end', dy: '.35em' }, ctx.layers.text);
        t.textContent = row.label;
        api._labels.push(t);
      });

      /* cells */
      cells.begin();
      st.rows.forEach(function (row, ri) {
        var R = G.rows[ri];
        row.cells.forEach(function (cell, ci) {
          var rec = cells.use((row.id || ri) + ':' + ci, buildCell);
          var txt = fmtText(cell);
          var filled = !!cell;
          vz.state(rec.el, filled ? (cell.state || 'default') : 'default');
          vz.toggle(rec.el, 'is-empty', !filled);
          var changed = rec.lastText !== undefined && rec.lastText !== txt && txt !== '' && txt !== '?';
          rec.lastText = txt;
          vz.text(rec.txt, txt);
          var fs = opts.shape === 'node' ? clamp(G.cs * 0.42, 11, 17) : clamp(G.cs * (txt.length > 2 ? 0.3 : 0.38), 11, 18);
          vz.set(rec.txt, 'style', 'font-size:' + n2(fs) + 'px');
          // index and sub labels
          var il = row.index ? row.index[ci] : null;
          vz.text(rec.idx, il === null || il === undefined ? '' : il);
          if (R.indexY !== undefined) { vz.set(rec.idx, 'x', n2(cx(ci))); vz.set(rec.idx, 'y', n2(R.indexY)); }
          vz.text(rec.sub, cell && cell.sub ? cell.sub : '');
          if (R.subY !== undefined) { vz.set(rec.sub, 'x', n2(cx(ci))); vz.set(rec.sub, 'y', n2(R.subY)); }
          if (cell && cell.sub) vz.state(rec.sub, cell.state || 'default');
          if (opts.dataIds) {
            rec.el.setAttribute('data-id', String(ci));
            rec.el.setAttribute('data-label', (opts.cellLabel ? opts.cellLabel(ci, cell) : 'Cell ' + ci));
          }
          var t = { x: cx(ci), y: R.cy, s: 1, o: 1, e: filled ? 1 : 0 };
          if (rec.isNew) rec.cur = Object.assign({}, t, { e: animate ? 0 : t.e });
          vz.retarget(rec, t);
          rec.pop = changed && animate;
          rec.paint = paintCell;
          list.push(rec);
        });
      });
      cells.end().forEach(function (rec) { vz.retarget(rec, { o: 0 }); rec.paint = paintCell; list.push(rec); });

      /* arcs */
      var rankMap = {};
      var sorted = (st.arcs || []).slice().sort(function (a, b) { return spanOf(a) - spanOf(b); });
      sorted.forEach(function (a) { var k = a.to.join(',') + sideOf(a); rankMap[a.id] = rankMap[k] = (rankMap[k] === undefined ? 0 : rankMap[k] + 1); a._rank = rankMap[k]; });
      arcs.begin();
      (st.arcs || []).forEach(function (a, i) {
        var rec = arcs.use(String(a.id), buildArc);
        vz.state(rec.el, a.state || 'default');
        rec.dashed = !!a.dashed;
        vz.toggle(rec.el, 'is-dashed', rec.dashed);
        var rank = sorted.filter(function (b) { return b.to.join(',') === a.to.join(',') && sideOf(b) === sideOf(a) && spanOf(b) < spanOf(a); }).length;
        rec.geo = arcGeom(a, rank); rec.geo.len = quadLen(rec.geo);
        if (a.label && opts.arcLabels) {
          if (!rec.lab) rec.lab = vz.svg('text', { class: 'dp34-arclabel', 'text-anchor': 'middle' }, rec.el);
          vz.text(rec.lab, a.label);
        } else if (rec.lab) { rec.lab.remove(); rec.lab = null; }
        var t = { d: 1, o: 1 };
        if (rec.isNew || rec.revived) { rec.cur = { d: animate && !rec.dashed ? 0 : 1, o: rec.dashed && animate ? 0 : 1 }; rec.delay = animate ? Math.min(0.35, i * 0.07) : 0; }
        else rec.delay = 0;
        vz.retarget(rec, t);
        rec.paint = paintArc;
        list.push(rec);
      });
      arcs.end().forEach(function (rec) { rec.delay = 0; vz.retarget(rec, { o: 0 }); rec.paint = paintArc; list.push(rec); });

      /* cursor */
      if (!cursorRec) {
        cursorRec = { el: vz.svg(opts.shape === 'node' ? 'circle' : 'rect', { class: 'dp34-cursor' }, ctx.layers.cursor), cur: { x: 0, y: 0, o: 0 } };
      }
      if (st.cursor) {
        var ct = { x: cx(st.cursor[1]), y: G.rows[st.cursor[0]].cy, o: 1 };
        if (cursorRec.cur.o < 0.05) { cursorRec.cur.x = ct.x; cursorRec.cur.y = ct.y; }
        vz.retarget(cursorRec, ct);
      } else vz.retarget(cursorRec, { o: 0 });
      cursorRec.paint = function (rec) {
        var c = rec.cur, s = G.cs + 8;
        if (opts.shape === 'node') { vz.set(rec.el, 'cx', n2(c.x)); vz.set(rec.el, 'cy', n2(c.y)); vz.set(rec.el, 'r', n2(s / 2)); }
        else { vz.set(rec.el, 'x', n2(c.x - s / 2)); vz.set(rec.el, 'y', n2(c.y - s / 2)); vz.set(rec.el, 'width', n2(s)); vz.set(rec.el, 'height', n2(s)); vz.set(rec.el, 'rx', n2(Math.min(12, s * 0.25))); }
        vz.opacity(rec.el, c.o);
      };
      list.push(cursorRec);

      tr.run(ms, function (t) {
        list.forEach(function (rec) {
          var e = vz.local(t, rec.delay || 0, undefined, vz.easeInOut);
          vz.step(rec, e);
          if (rec.pop) rec.cur.s = 1 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.4));
          rec.paint(rec);
        });
      }, function () { cells.purge(); arcs.purge(); });
    }

    api.describe = function (st) {
      if (!st || !st.rows) return '';
      return st.rows.map(function (r) { return (r.label ? r.label + ': ' : '') + r.cells.map(function (c) { return c ? fmtText(c) || '?' : '_'; }).join(' '); }).join('; ');
    };
    api.cellRect = function (r, c) { if (!G) return null; return { x: cx(c) - G.cs / 2, y: G.rows[r].cy - G.cs / 2, w: G.cs, h: G.cs }; };
    return api;
  }
  V.dp34.table = tableView;

  /* ================================================================== the collapse view */
  function collapseView(container, opts) {
    opts = Object.assign({ label: 'Recursion tree of fib(n) collapsing into a row of cells', fitHeight: false, counter: true }, opts || {});
    var host = typeof container === 'string' ? document.querySelector(container) : container;
    var made = vz.createView(host, 'dp34c', { label: opts.label, className: 'dp34-collapse', layers: ['slots', 'edges', 'nodes', 'labels', 'hud'] }, draw);
    var ctx = made.ctx, tr = made.tr, api = made.api;
    var A = V.algos['34-dynamic-programming'];
    var N = -1, tree = null, nodes = new vz.Store(), edges = new vz.Store(), slots = [], G = null, hud = null, maxDepth = 0, lastRow = null;
    var ROW = { collapse: 1, dag: 1, fill: 1 };

    function build(n) {
      nodes.clear(); edges.clear();
      slots.forEach(function (sl) { sl.el.remove(); }); slots = [];
      N = n; tree = A.fibTree(n); lastRow = null;
      maxDepth = tree.reduce(function (m, t) { return Math.max(m, t.depth); }, 0);
      var leaf = 0;
      (function lay(t) {
        if (!t.children.length) { t.lx = leaf++; return; }
        t.children.forEach(function (c) { lay(tree[+c.slice(1)]); });
        t.lx = t.children.reduce(function (acc, c) { return acc + tree[+c.slice(1)].lx; }, 0) / t.children.length;
      }(tree[0]));
      G = { leaves: leaf };
      for (var k = 0; k <= n; k++) {
        var g = vz.svg('g', { class: 'dp34-slot' }, ctx.layers.slots);
        var rec = { el: g, r: vz.svg('rect', { class: 'vz-slot' }, g), lab: vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle' }, g), cur: {}, from: {}, to: {}, k: k };
        rec.lab.textContent = 'fib(' + k + ')';
        slots.push(rec);
      }
      if (!hud && opts.counter) {
        hud = vz.svg('g', { class: 'dp34-hud' }, ctx.layers.hud);
        hud.num = vz.svg('text', { class: 'dp34-hud-num', x: 0, y: 0 }, hud);
        hud.lab = vz.svg('text', { class: 'dp34-hud-lab', x: 0, y: 0 }, hud);
      }
    }
    function layout() {
      var W = ctx.width;
      var H = Math.round(clamp(W * 0.46, 300, 470));
      if (opts.fitHeight) { var hs = getComputedStyle(host); H = Math.max(200, host.clientHeight - parseFloat(hs.paddingTop) - parseFloat(hs.paddingBottom) - 4); }
      var padX = 14, top = opts.counter ? 48 : 18;
      // tree mode: the cache row waits, small, under the tree
      var rowHt = clamp(W / (N + 1) * 0.5, 22, 40);
      var rowYt = H - rowHt / 2 - 24;
      var treeBottom = rowYt - rowHt / 2 - clamp(H * 0.1, 22, 52);
      var spacing = (W - padX * 2) / Math.max(1, G.leaves);
      var r = clamp(spacing * 0.4, 7, 17);
      var levelH = maxDepth ? (treeBottom - top - r) / maxDepth : 0;
      var pitchT = Math.min((W - padX * 2) / (N + 1), rowHt * 2);
      // row mode: the row is the star, larger and centred in the space the tree used
      var pitchR = Math.min((W - padX * 2) / (N + 1), 108);
      var rowHr = clamp(pitchR * 0.6, 26, 60);
      var rowYr = Math.round(top + (H - top) * 0.62);
      G.W = W; G.H = H; G.r = r;
      G.tree = { rowH: rowHt, rowY: rowYt, pitch: pitchT, x0: (W - pitchT * (N + 1)) / 2 + pitchT / 2 };
      G.row = { rowH: rowHr, rowY: rowYr, pitch: pitchR, x0: (W - pitchR * (N + 1)) / 2 + pitchR / 2 };
      G.treePos = function (t) { return { x: padX + spacing * (t.lx + 0.5), y: top + r + t.depth * levelH }; };
      G.cellPos = function (k, row) { var m = row ? G.row : G.tree; return { x: m.x0 + k * m.pitch, y: m.rowY }; };
      return G;
    }

    function stateOf(t, st) {
      var ph = st.phase;
      if (ph === 'grow') return t.depth === st.depth ? 'active' : 'default';
      if (ph === 'tree') return 'default';
      if (ph === 'group') return t.k === st.focus ? 'pivot' : 'muted';
      if (ph === 'repeats' || ph === 'collapse') return t.rep > 0 ? 'pivot' : 'visited';
      if (ph === 'dag') return st.values ? 'visited' : 'default';
      if (ph === 'fill') {
        if (t.k === st.fill) return 'active';
        if (st.fill >= 2 && (t.k === st.fill - 1 || t.k === st.fill - 2)) return 'compare';
        return t.k < st.fill ? 'visited' : 'default';
      }
      return 'default';
    }
    function buildNode(rec) {
      rec.el = vz.svg('g', { class: 'vz-item dp34-cnode' }, ctx.layers.nodes);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, rec.el);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
      rec.cur = { x: 0, y: 0, w: 0, rx: 0, o: 0 };
    }
    function buildEdge(rec) {
      rec.el = vz.svg('g', { class: 'vz-edge dp34-cedge' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, rec.el);
      rec.head = vz.svg('path', { class: 'vz-head' }, rec.el);
      rec.cur = { m: 0, o: 0, ho: 0 };
    }
    function paintNode(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y);
      vz.set(rec.shape, 'x', n2(-c.w / 2)); vz.set(rec.shape, 'y', n2(-c.w / 2)); vz.set(rec.shape, 'width', n2(Math.max(0, c.w))); vz.set(rec.shape, 'height', n2(Math.max(0, c.w)));
      vz.set(rec.shape, 'rx', n2(Math.max(0, c.rx)));
      vz.opacity(rec.el, c.o);
    }
    function paintSlot(rec) {
      var c = rec.cur;
      vz.set(rec.r, 'x', n2(c.x - c.w / 2)); vz.set(rec.r, 'y', n2(c.y - c.w / 2)); vz.set(rec.r, 'width', n2(c.w)); vz.set(rec.r, 'height', n2(c.w)); vz.set(rec.r, 'rx', n2(c.w * 0.2));
      vz.set(rec.lab, 'x', n2(c.x)); vz.set(rec.lab, 'y', n2(c.y + c.w / 2 + 16));
      vz.set(rec.lab, 'style', 'font-size:' + n2(clamp(c.w * 0.3, 11, 13)) + 'px');
      vz.opacity(rec.r, c.so);
    }
    function paintEdge(rec) {
      var p = nodes.get(rec.pid), ch = nodes.get(rec.cid);
      if (!p || !ch) return;
      var P = p.cur, C = ch.cur, m = rec.cur.m, R = G.row;
      var dx = P.x - C.x, dy = P.y - C.y, L = Math.hypot(dx, dy) || 1, rr = P.w / 2 + 1, rc = C.w / 2 + 1;
      var tx1 = C.x + dx / L * rc, ty1 = C.y + dy / L * rc, tx2 = P.x - dx / L * rr, ty2 = P.y - dy / L * rr;
      // row geometry: an arc above the row from cell k-1 or k-2 into cell k; shorter arcs end further left, so arcs nest
      var span = Math.max(1, Math.round(Math.abs(P.x - C.x) / R.pitch)), h = 12 + span * R.rowH * 0.45;
      var topY = P.y - P.w / 2 - 3;
      var ax1 = C.x + P.w * (span === 1 ? 0.28 : 0.06), ax2 = P.x - P.w * (span === 1 ? 0.28 : 0.06);
      var x1 = vz.lerp(tx1, ax1, m), y1 = vz.lerp(ty1, topY, m), x2 = vz.lerp(tx2, ax2, m), y2 = vz.lerp(ty2, topY, m);
      var qx = (x1 + x2) / 2, qy = vz.lerp((y1 + y2) / 2, topY - 2 * h, m);
      vz.set(rec.line, 'd', 'M' + n2(x1) + ' ' + n2(y1) + 'Q' + n2(qx) + ' ' + n2(qy) + ' ' + n2(x2) + ' ' + n2(y2));
      vz.set(rec.head, 'd', vz.arrowHead(x2, y2, Math.atan2(y2 - qy, x2 - qx), clamp(R.rowH * 0.14, 6, 8)));
      vz.set(rec.head, 'opacity', rec.cur.ho > 0.02 ? rec.cur.ho.toFixed(3) : '0');
      vz.opacity(rec.el, rec.cur.o);
    }

    function draw(st, ms) {
      if (st.n !== N) build(st.n);
      layout();
      ctx.setHeight(G.H);
      var ph = st.phase, row = !!ROW[ph];
      var switching = lastRow !== null && lastRow !== row && ms > 0;
      lastRow = row;
      var list = [];
      slots.forEach(function (sl) {
        var p = G.cellPos(sl.k, row), w = row ? G.row.rowH : G.tree.rowH;
        var t = { x: p.x, y: p.y, w: w, so: 1 };
        if (sl.cur.x === undefined) sl.cur = Object.assign({}, t);
        vz.retarget(sl, t); sl.delay = 0; sl.paint = paintSlot; list.push(sl);
      });
      nodes.begin();
      tree.forEach(function (t) {
        var rec = nodes.use(t.id, buildNode);
        var visible = ph !== 'grow' || t.depth <= st.depth;
        vz.state(rec.el, stateOf(t, st));
        var pos = row ? G.cellPos(t.k, true) : G.treePos(t);
        var w = row ? G.row.rowH : G.r * 2;
        var o = visible ? (row && t.rep > 0 ? 0 : 1) : 0;
        var txt;
        if (ph === 'fill') txt = t.k <= st.fill ? String(A.fib(t.k)) : '';
        else if (ph === 'dag') txt = st.values ? String(A.fib(t.k)) : '';
        else txt = String(t.k);
        vz.text(rec.txt, txt);
        vz.set(rec.txt, 'style', 'font-size:' + n2(clamp(w * (row ? 0.4 : 0.62), 11, 20)) + 'px');
        var target = { x: pos.x, y: pos.y, w: w, rx: row ? w * 0.2 : w / 2, o: o };
        if (rec.isNew) {
          var par = t.parent ? G.treePos(tree[+t.parent.slice(1)]) : pos;
          rec.cur = { x: row ? pos.x : par.x, y: row ? pos.y : par.y, w: w, rx: target.rx, o: 0 };
        } else if (!visible && ph === 'grow' && t.parent) {
          var pp = G.treePos(tree[+t.parent.slice(1)]); target.x = pp.x; target.y = pp.y;
        }
        vz.retarget(rec, target);
        // the collapse: deeper calls lift off first
        rec.delay = switching ? (row ? (maxDepth - t.depth) : t.depth) / Math.max(1, maxDepth) * 0.3 : 0;
        rec.paint = paintNode;
        list.push(rec);
      });
      nodes.end();
      edges.begin();
      tree.forEach(function (t) {
        if (!t.parent) return;
        var rec = edges.use(t.parent + '>' + t.id, buildEdge);
        rec.pid = t.parent; rec.cid = t.id;
        var par = tree[+t.parent.slice(1)];
        var visible = ph !== 'grow' || t.depth <= st.depth;
        var keep = par.rep === 0; // the first call of each k keeps its two edges: exactly the DAG
        var es = 'default';
        if (ph === 'group') es = t.k === st.focus || par.k === st.focus ? 'default' : 'muted';
        if (ph === 'fill' && keep && par.k === st.fill && st.fill >= 2) es = 'key';
        vz.state(rec.el, es);
        vz.retarget(rec, { m: row ? 1 : 0, o: !visible ? 0 : row ? (keep ? 1 : 0) : 1, ho: ph === 'dag' || ph === 'fill' ? 1 : 0 });
        rec.dip = switching; // tree edges retract while the calls fly; the DAG arrows grow in when they land
        rec.delay = 0;
        rec.paint = paintEdge;
        list.push(rec);
      });
      edges.end();
      if (hud) {
        vz.text(hud.num, String(st.counter));
        vz.text(hud.lab, row ? (st.counter === 1 ? 'cell' : 'cells') + ' · one per question' : (st.counter === 1 ? 'call' : 'calls') + ' of fib(' + N + ')');
        vz.set(hud.num, 'x', 14); vz.set(hud.num, 'y', 32);
        vz.set(hud.lab, 'x', n2(14 + vz.textWidth(String(st.counter), 26, false, 780) + 8)); vz.set(hud.lab, 'y', 31);
        vz.state(hud, row ? 'done' : ph === 'repeats' || ph === 'group' ? 'pivot' : 'active');
      }
      tr.run(ms, function (t) {
        list.forEach(function (rec) {
          var e = vz.local(t, rec.delay || 0, undefined, vz.easeInOut);
          vz.step(rec, e);
          var f = rec.from.o, g = rec.to.o;
          if (rec.dip) rec.cur.o = e < 0.25 ? vz.lerp(f, 0, e / 0.25) : e > 0.8 ? vz.lerp(0, g, (e - 0.8) / 0.2) : 0;
          else if (f !== undefined && g !== undefined && f !== g) rec.cur.o = g < f ? (e < 0.78 ? f : vz.lerp(f, g, (e - 0.78) / 0.22)) : (e > 0.2 ? g : vz.lerp(f, g, e / 0.2));
          rec.paint(rec);
        });
        edges.each(function (rec) { if (rec.paint) rec.paint(rec); });
      });
    }
    api.describe = function (st) {
      if (!st) return '';
      if (ROW[st.phase]) return 'A row of ' + (st.n + 1) + ' cells, fib(0) to fib(' + st.n + '), each reading the two cells to its left.';
      return 'The recursion tree of fib(' + st.n + ') with ' + st.calls + ' calls.';
    };
    return api;
  }
  V.dp34.collapse = collapseView;

  /* ================================================================== the recurrence strip (HTML) */
  /* eq: {lhs, fn: 'min'|'max'|'+', pre, terms: [{sym, num, val, state}], tail, result, note} */
  V.dp34.renderEq = function (el, eq) {
    V.clear(el);
    if (!eq) { el.hidden = true; return; }
    el.hidden = false;
    var h = V.h;
    function block(top, bottom, cls, state) {
      return h('span', { class: 'dp-eq__b' + (cls ? ' ' + cls : ''), 'data-state': state || null },
        h('span', { class: 'dp-eq__sym', html: top }), h('span', { class: 'dp-eq__num', html: bottom === undefined || bottom === null ? '&nbsp;' : bottom }));
    }
    var row = h('div', { class: 'dp-eq__row' });
    if (eq.note && !eq.terms) {
      row.classList.add('is-flat');
      row.appendChild(h('span', { class: 'dp-eq__flat dp-eq__lhs' }, eq.lhs));
      row.appendChild(h('span', { class: 'dp-eq__flat dp-eq__op' }, eq.result !== undefined ? '=' : ':'));
      if (eq.result !== undefined) row.appendChild(h('span', { class: 'dp-eq__flat dp-eq__res' }, eq.result));
      row.appendChild(h('span', { class: 'dp-eq__note' }, (eq.result !== undefined ? '(' + eq.note + ')' : eq.note)));
      el.appendChild(row);
      return;
    }
    row.appendChild(block(V.escape(eq.lhs), '', 'dp-eq__lhs'));
    row.appendChild(block('=', '=', 'dp-eq__op'));
    if (eq.pre) row.appendChild(block(V.escape(eq.pre), V.escape(eq.pre), 'dp-eq__op'));
    var sum = eq.fn === '+';
    if (!sum) row.appendChild(block(eq.fn + '(', eq.fn + '(', 'dp-eq__op dp-eq__fn'));
    (eq.terms || []).forEach(function (t, i) {
      if (i) row.appendChild(block(sum ? '+' : ',', sum ? '+' : ',', 'dp-eq__op'));
      var bottom = V.escape(t.num || '');
      if (t.val !== undefined && eq.result !== '?' && t.state !== 'muted' && t.num !== t.val) bottom += ' <span class="dp-eq__val">= ' + V.escape(t.val) + '</span>';
      row.appendChild(block(V.escape(t.sym), bottom, 'dp-eq__term' + (t.state === 'muted' ? ' is-muted' : ''), t.state));
    });
    if (!sum) row.appendChild(block(')', ')', 'dp-eq__op dp-eq__fn'));
    if (eq.tail) row.appendChild(h('span', { class: 'dp-eq__note' }, eq.tail));
    if (eq.result !== undefined) {
      row.appendChild(block('', '=', 'dp-eq__op'));
      row.appendChild(block('', V.escape(eq.result), 'dp-eq__res' + (eq.result === '?' ? ' is-pending' : '')));
    }
    el.appendChild(row);
  };
}());
