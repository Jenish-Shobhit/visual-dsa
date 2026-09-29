/* VDSA.views.grid(container, options) — matrices, DP tables, adjacency matrices and pathfinding grids.

   const view = VDSA.views.grid('#dp', { mode: 'table' });
   view.render({
     rows: 3, cols: 4,
     cells: [[0, 1, 2, 3], [1, { value: 1, state: 'active' }, null, null], ...],   // dense, or sparse {'r,c': {...}}
     rowHeaders: ['', 'A', 'B'], colHeaders: ['', 'C', 'A', 'B'],
     arrows: [{ from: [0, 0], to: [1, 1] }],          // DP dependency arrows
     highlightRow: 1, highlightCol: { index: 1, state: 'compare' },
     cursor: [1, 1]
   }, { duration: ctx.duration });

   Pathfinding: mode 'path' draws colour-only cells. Walls are a flag (`cell.wall: true` or `walls: [[r,c]]`),
   progress is the usual state vocabulary (visited, frontier, path, active), and start/end are markers:
   view.render({ rows: 20, cols: 30, walls: [[3, 4]], cells: {'5,6': {state: 'visited'}}, markers: {start: [2, 2], end: [17, 27]} });

   Large grids (more than options.canvasThreshold cells, default 1200) switch to a canvas renderer with the same
   API, colour transitions, theme re-read and hit-testing. paintable: true lets users drag to paint walls
   (view.on('paint', ...)); draggableMarkers: true lets users drag start/end (view.on('move-marker', ...)).
   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> grid.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure helpers (Node-testable) */
  var L = {};
  var fmt = (root && root.VDSA && root.VDSA.vz) ? root.VDSA.vz.fmt
    : (typeof require === 'function' ? require('./base.js').fmt : function (v) { return v === null || v === undefined ? '' : String(v); });

  L.key = function (r, c) { return r + ',' + c; };

  function normCell(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') v = { value: v };
    return {
      value: v.value, text: v.text, state: v.state || 'default', label: v.label,
      wall: !!v.wall
    };
  }
  L.cellText = function (cell) {
    if (!cell) return '';
    if (cell.text !== undefined && cell.text !== null) return String(cell.text);
    return cell.value === undefined || cell.value === null ? '' : fmt(cell.value);
  };

  /* Normalise dense ([[...]]) or sparse ({'r,c': ...}) cells, walls and markers.
     Returns {rows, cols, cells: {'r,c': cell}, markers: [{id, kind, cell:[r,c], state, label}]} */
  L.normalize = function (state) {
    state = state || {};
    var src = state.cells, cells = {}, rows = state.rows, cols = state.cols, maxR = -1, maxC = -1;
    if (Array.isArray(src)) {
      for (var r = 0; r < src.length; r++) {
        var row = src[r] || [];
        if (row.length - 1 > maxC) maxC = row.length - 1;
        for (var c = 0; c < row.length; c++) {
          var o = normCell(row[c]);
          if (o) cells[r + ',' + c] = o;
        }
      }
      maxR = src.length - 1;
    } else if (src && typeof src === 'object') {
      Object.keys(src).forEach(function (k) {
        var m = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(k);
        if (!m) return;
        var rr = +m[1], cc = +m[2], o = normCell(src[k]);
        if (!o) return;
        cells[rr + ',' + cc] = o;
        if (rr > maxR) maxR = rr;
        if (cc > maxC) maxC = cc;
      });
    }
    (state.walls || []).forEach(function (w) {
      if (!w) return;
      var k = w[0] + ',' + w[1];
      var o = cells[k] || (cells[k] = { value: undefined, text: undefined, state: 'default', label: undefined, wall: false });
      o.wall = true;
      if (w[0] > maxR) maxR = w[0];
      if (w[1] > maxC) maxC = w[1];
    });
    var markers = [];
    var mk = state.markers;
    if (Array.isArray(mk)) {
      mk.forEach(function (m, i) {
        if (!m || !m.cell) return;
        markers.push({ id: String(m.id !== undefined ? m.id : (m.kind || 'marker') + i), kind: m.kind || 'dot', cell: [m.cell[0], m.cell[1]], state: m.state, label: m.label, draggable: m.draggable });
      });
    } else if (mk && typeof mk === 'object') {
      Object.keys(mk).forEach(function (id) {
        var v = mk[id];
        if (!v) return;
        var cell = Array.isArray(v) ? v : v.cell;
        if (!cell) return;
        var kind = (v && v.kind) || (id === 'start' || id === 'end' ? id : 'dot');
        markers.push({ id: id, kind: kind, cell: [cell[0], cell[1]], state: v.state, label: v.label, draggable: v.draggable });
      });
    }
    markers.forEach(function (m) { if (m.cell[0] > maxR) maxR = m.cell[0]; if (m.cell[1] > maxC) maxC = m.cell[1]; });
    return {
      rows: typeof rows === 'number' ? rows : maxR + 1,
      cols: typeof cols === 'number' ? cols : maxC + 1,
      cells: cells, markers: markers
    };
  };

  /* Header list: array as given, true -> indices, else null. */
  L.headers = function (h, n) {
    if (h === true) { var out = []; for (var i = 0; i < n; i++) out.push(String(i)); return out; }
    if (Array.isArray(h)) return h.map(function (x) { return x === null || x === undefined ? '' : String(x); });
    return null;
  };

  /* Cell geometry. o: {width, rows, cols, cellSize, minCell, pad, rowHeaderW, colHeaderH, rowPtrW, colPtrH}
     Square cells of size cs fitted to the width; the block (pointers + headers + cells) is centred. */
  L.geometry = function (o) {
    var pad = o.pad === undefined ? 6 : o.pad;
    var lead = (o.rowPtrW || 0) + (o.rowHeaderW || 0);
    var top = pad + (o.colPtrH || 0) + (o.colHeaderH || 0);
    var cols = Math.max(1, o.cols || 0), rows = Math.max(0, o.rows || 0);
    var avail = Math.max(10, o.width - 2 * pad - lead);
    var cs = Math.max(o.minCell || 2, Math.min(o.cellSize || 40, avail / cols));
    var gridW = cs * cols, gridH = cs * rows;
    var x0 = Math.max(pad, (o.width - lead - gridW) / 2) + lead;
    return { cs: cs, x0: x0, y0: top, gridW: gridW, gridH: gridH, rows: rows, cols: cols, lead: lead, pad: pad,
      rowHeaderW: o.rowHeaderW || 0, colHeaderH: o.colHeaderH || 0, rowPtrW: o.rowPtrW || 0, colPtrH: o.colPtrH || 0,
      height: top + gridH + pad };
  };
  L.cellRect = function (g, r, c, gap) {
    gap = gap || 0;
    return { x: g.x0 + c * g.cs + gap / 2, y: g.y0 + r * g.cs + gap / 2, w: Math.max(0.5, g.cs - gap), h: Math.max(0.5, g.cs - gap) };
  };
  L.center = function (g, r, c) { return { x: g.x0 + (c + 0.5) * g.cs, y: g.y0 + (r + 0.5) * g.cs }; };
  /* Hit test: SVG point -> [r, c] or null. */
  L.cellAt = function (g, x, y) {
    var c = Math.floor((x - g.x0) / g.cs), r = Math.floor((y - g.y0) / g.cs);
    if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) return null;
    return [r, c];
  };
  /* Cells on the straight line between two cells (inclusive), so fast drags leave no gaps. */
  L.line = function (r0, c0, r1, c1) {
    var out = [], dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0), sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1, err = dc - dr;
    var r = r0, c = c0, guard = 0;
    for (;;) {
      out.push([r, c]);
      if ((r === r1 && c === c1) || ++guard > 10000) break;
      var e2 = 2 * err;
      if (e2 > -dr) { err -= dr; c += sc; }
      if (e2 < dc) { err += dc; r += sr; }
    }
    return out;
  };
  /* Dependency arrow between two cells, drawn so it never covers the values:
     - axis-aligned arrows run beside the text line (rightward arrows below it, downward arrows to its right,
       leftward above, upward left), from 15% past the source centre to 24% before the target centre;
     - diagonal and other arrows start/end 45%/55% of the way from each centre to the cell border (a diagonal
       between neighbours passes through their shared corner) and long ones bend slightly.
     opts: {offset (fraction of cs, default 0.28), bend}. Returns {x1, y1, cx, cy, x2, y2, angle, length, d}. */
  L.arrowGeom = function (g, from, to, opts) {
    opts = opts || {};
    var a = L.center(g, from[0], from[1]), b = L.center(g, to[0], to[1]);
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var axis = Math.abs(ux) > 0.999 || Math.abs(uy) > 0.999;
    var sa, ea, ox = 0, oy = 0;
    if (axis) {
      var off = (opts.offset === undefined ? 0.28 : opts.offset) * g.cs;
      ox = uy * off; oy = ux * off;
      sa = 0.15 * g.cs; ea = 0.24 * g.cs;
    } else {
      var border = (g.cs / 2) / Math.max(Math.abs(ux), Math.abs(uy), 1e-6);
      sa = 0.45 * border; ea = 0.55 * border;
    }
    var x1 = a.x + ux * sa + ox, y1 = a.y + uy * sa + oy, x2 = b.x - ux * ea + ox, y2 = b.y - uy * ea + oy;
    var cells = len / g.cs;
    var bend = opts.bend !== undefined ? opts.bend : (cells > 1.6 ? 0.18 : 0);
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, seg = Math.hypot(x2 - x1, y2 - y1);
    var cx = mx - uy * seg * bend, cy = my + ux * seg * bend;
    var angle = Math.atan2(y2 - cy, x2 - cx);
    var n = function (v) { return Math.round(v * 100) / 100; };
    return { x1: x1, y1: y1, cx: cx, cy: cy, x2: x2, y2: y2, angle: angle, length: L.quadLength(x1, y1, cx, cy, x2, y2),
      d: 'M' + n(x1) + ' ' + n(y1) + 'Q' + n(cx) + ' ' + n(cy) + ' ' + n(x2) + ' ' + n(y2) };
  };
  L.quadLength = function (x1, y1, cx, cy, x2, y2) {
    var len = 0, px = x1, py = y1;
    for (var i = 1; i <= 12; i++) {
      var t = i / 12, u = 1 - t;
      var x = u * u * x1 + 2 * u * t * cx + t * t * x2, y = u * u * y1 + 2 * u * t * cy + t * t * y2;
      len += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return len;
  };
  /* Parse CSS colour strings produced by getComputedStyle: rgb(), rgba(), color(srgb ...), #hex.
     Returns [r, g, b, a] (0-255, a 0-1) or null when unknown. */
  L.parseColor = function (s) {
    if (!s) return null;
    s = String(s).trim();
    if (s === 'none' || s === 'transparent') return [0, 0, 0, 0];
    var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4])];
    m = /^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (m) return [Math.round(+m[1] * 255), Math.round(+m[2] * 255), Math.round(+m[3] * 255), m[4] === undefined ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4])];
    m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (x) { return x + x; }).join('');
      var a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
    }
    return null;
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, doc = root.document;
  var STATES = ['default', 'active', 'compare', 'swap', 'done', 'found', 'visited', 'frontier', 'path', 'pivot', 'key', 'error', 'muted'];
  var EMPTY = { value: undefined, text: undefined, state: 'default', label: undefined, wall: false };

  var DEFAULTS = {
    mode: 'table',            // 'table' (values) | 'path' (colour-only pathfinding cells)
    cellSize: null,           // max cell size px (table 46, path 28)
    minCell: 3,
    renderer: 'auto',         // 'auto' | 'svg' | 'canvas'
    canvasThreshold: 1200,    // 'auto' switches to canvas above this many cells
    showValues: true,
    countUp: false,           // numeric value changes count up/down
    pop: true,                // changed values pop briefly
    rowHeaders: null, colHeaders: null, corner: null,
    paintable: false,         // drag to paint walls: 'paint' / 'paintend' events
    paintValue: null,         // null: toggle from the first cell; true/false: always paint/erase
    draggableMarkers: false,  // drag start/end markers: 'move-marker' events
    onCellClick: null,
    reserve: null,            // {rowPointers: bool, colPointers: bool}
    label: null,
    duration: undefined
  };

  function gridView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var host = typeof container === 'string' ? doc.querySelector(container) : container;
    if (!host) throw new Error('VDSA.views.grid: container not found');
    var wrap = doc.createElement('div');
    wrap.className = 'vz-grid-host';
    host.appendChild(wrap);
    var interactive = !!(opts.paintable || opts.draggableMarkers || opts.onCellClick);
    var V = vz.createView(wrap, 'grid', {
      label: opts.label || (opts.mode === 'path' ? 'Grid' : 'Table'),
      className: 'vz-grid-' + opts.mode + (opts.paintable ? ' is-paintable' : ''),
      interactive: interactive, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr, svg = ctx.svg;
    ['cells', 'texts', 'bands', 'arrows', 'cursor', 'markers', 'headers', 'pointers', 'focus'].forEach(ctx.layer);

    var S = { cells: new vz.Store(), heads: new vz.Store(), bands: new vz.Store(), arrows: new vz.Store(), cursors: new vz.Store(), markers: new vz.Store(), ptrs: new vz.Store() };
    var G = null, N = null, lastGeomKey = '', canvasOn = false, clickable = !!opts.onCellClick;
    var reserve = Object.assign({ rowPointers: false, colPointers: false, rowPtrW: 0 }, opts.reserve || {});
    var previewDirty = false, first = true, drawId = 0, lastAnim = [];
    var textCache = new Map();
    function measure(str, px, weight, mono) {
      var k = str + '|' + px + '|' + weight + '|' + (mono ? 1 : 0);
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(str, px, mono, weight); textCache.set(k, w); }
      return w;
    }
    function gapFor(cs) { return opts.mode === 'path' ? (cs < 8 ? 0.5 : 1) : Math.max(1.5, Math.min(4, cs * 0.06)); }
    function cornerFor(cs) { return opts.mode === 'path' ? Math.min(3, cs * 0.16) : Math.min(6, cs * 0.14); }

    /* ---------------------------------------------------------- canvas renderer (large grids) */
    var canvas = null, c2d = null, dpr = 1, pal = null, probeG = null, fontSans = null;
    function ensureCanvas() {
      if (canvas) return;
      canvas = doc.createElement('canvas');
      canvas.className = 'vz-grid-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(canvas, svg);
      c2d = canvas.getContext('2d');
      pal = null;
    }
    function removeCanvas() { if (canvas) { canvas.remove(); canvas = null; c2d = null; } }
    var colorCtx = null;
    function resolveColor(str) {
      var c = L.parseColor(str);
      if (c) return c;
      try { // any other syntax (oklab(), lab()...): let the browser rasterise it
        colorCtx = colorCtx || doc.createElement('canvas').getContext('2d', { willReadFrequently: true });
        colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = '#000'; colorCtx.fillStyle = str; colorCtx.fillRect(0, 0, 1, 1);
        var d = colorCtx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      } catch (_) { return [128, 128, 128, 1]; }
    }
    /* Mirror css/viz.css exactly: create hidden probe cells with each state class and read computed colours. */
    function probePalette() {
      if (!probeG) probeG = vz.svg('g', { style: 'display:none', 'aria-hidden': 'true' }, svg);
      while (probeG.firstChild) probeG.removeChild(probeG.firstChild);
      pal = {};
      STATES.concat(['wall']).forEach(function (s) {
        var cls = 'vz-item vz-gcell is-' + (s === 'wall' ? 'default vz-wall' : s);
        var r = vz.svg('rect', { class: cls + ' vz-shape', style: 'transition:none' }, probeG);
        var t = vz.svg('text', { class: cls + ' vz-ink vz-gtext', style: 'transition:none' }, probeG);
        var cr = getComputedStyle(r), ct = getComputedStyle(t);
        pal[s] = { fill: resolveColor(cr.fill), stroke: resolveColor(cr.stroke), sw: parseFloat(cr.strokeWidth) || 0, ink: resolveColor(ct.fill) };
      });
      fontSans = VDSA.cssVar('--font-sans') || 'sans-serif';
    }
    function palTarget(rec) {
      var p = pal[rec.wall ? 'wall' : rec.st] || pal['default'];
      return { fr: p.fill[0], fg: p.fill[1], fb: p.fill[2], fa: p.fill[3], sr: p.stroke[0], sg: p.stroke[1], sb: p.stroke[2], sa: p.stroke[3], ir: p.ink[0], ig: p.ink[1], ib: p.ink[2], ia: p.ink[3] };
    }
    function sizeCanvas() {
      dpr = Math.min(2.5, root.devicePixelRatio || 1);
      var w = ctx.width, h = ctx.height;
      if (canvas.__w !== w || canvas.__h !== h || canvas.__d !== dpr) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        canvas.__w = w; canvas.__h = h; canvas.__d = dpr;
      }
    }
    function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')'; }
    function redraw() {
      if (!c2d || !G) return;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, ctx.width, ctx.height);
      var gap = gapFor(G.cs), rr = cornerFor(G.cs), w = Math.max(0.5, G.cs - gap);
      var useRound = rr >= 1.5 && typeof c2d.roundRect === 'function';
      var fs = valueFont(G.cs);
      var textFont = '600 ' + fs + 'px ' + fontSans, labFont = '500 ' + Math.max(7, Math.round(fs * 0.62)) + 'px ' + fontSans;
      c2d.textAlign = 'center'; c2d.textBaseline = 'middle';
      S.cells.each(function (rec) {
        var c = rec.cur, o = c.o === undefined ? 1 : c.o;
        if (o <= 0.003) return;
        var x = G.x0 + rec.c * G.cs + gap / 2, y = G.y0 + rec.r * G.cs + gap / 2;
        if (c.fa * o > 0.003) {
          c2d.fillStyle = rgba(c.fr, c.fg, c.fb, c.fa * o);
          if (useRound) { c2d.beginPath(); c2d.roundRect(x, y, w, w, rr); c2d.fill(); } else c2d.fillRect(x, y, w, w);
        }
        var sw = (pal[rec.wall ? 'wall' : rec.st] || pal['default']).sw;
        if (sw > 0 && c.sa * o > 0.003) {
          c2d.strokeStyle = rgba(c.sr, c.sg, c.sb, c.sa * o); c2d.lineWidth = sw;
          if (useRound) { c2d.beginPath(); c2d.roundRect(x + sw / 2, y + sw / 2, w - sw, w - sw, Math.max(0, rr - sw / 2)); c2d.stroke(); }
          else c2d.strokeRect(x + sw / 2, y + sw / 2, w - sw, w - sw);
        }
        var txt = rec.counting && c.v !== undefined ? fmt(Math.round(c.v)) : rec.shown;
        if (txt) {
          c2d.fillStyle = rgba(c.ir, c.ig, c.ib, c.ia * o);
          c2d.font = textFont;
          var p = c.p === undefined ? 1 : c.p;
          var sc = 1 + 0.22 * Math.sin(Math.PI * p);
          if (sc !== 1) { c2d.save(); c2d.translate(x + w / 2, y + w / 2); c2d.scale(sc, sc); c2d.fillText(txt, 0, 0.5); c2d.restore(); }
          else c2d.fillText(txt, x + w / 2, y + w / 2 + 0.5);
        }
        if (rec.lab) {
          c2d.fillStyle = rgba(c.ir, c.ig, c.ib, c.ia * o * 0.8);
          c2d.font = labFont;
          if (txt) { c2d.textAlign = 'left'; c2d.fillText(rec.lab, x + 3, y + fs * 0.5); c2d.textAlign = 'center'; }
          else c2d.fillText(rec.lab, x + w / 2, y + w / 2 + 0.5);
        }
      });
    }
    function valueFont(cs) { return vz.clamp(Math.round(cs * 0.36), 7, 15); }

    function switchRenderer(useCanvas) {
      S.cells.clear();
      canvasOn = useCanvas;
      if (useCanvas) { ensureCanvas(); probePalette(); } else removeCanvas();
      lastGeomKey = '';
    }
    ctx.onTheme(function () {
      if (!canvasOn) return;
      // wait a frame so the new token values are applied before probing
      root.requestAnimationFrame(function () {
        probePalette();
        S.cells.each(function (rec) { var t = palTarget(rec); for (var k in t) rec.cur[k] = t[k]; });
        redraw();
      });
    });

    /* ---------------------------------------------------------- SVG cell builders */
    function buildCell(rec) {
      if (canvasOn) { rec.el = null; rec.nodes = []; return; }
      rec.el = vz.svg('rect', { class: 'vz-item vz-shape vz-gcell' }, ctx.layers.cells);
      rec.txt = null; rec.labEl = null;
      rec.nodes = [rec.el];
    }
    function ensureText(rec, kind) {
      var prop = kind === 'lab' ? 'labEl' : 'txt';
      if (rec[prop]) return rec[prop];
      var t = vz.svg('text', { class: 'vz-item vz-ink ' + (kind === 'lab' ? 'vz-glabel' : 'vz-gtext'), 'text-anchor': kind === 'lab' ? 'start' : 'middle', dy: '.35em' }, ctx.layers.texts);
      rec[prop] = t; rec.nodes.push(t);
      t.__vzS = null;
      return t;
    }
    function dropText(rec, kind) {
      var prop = kind === 'lab' ? 'labEl' : 'txt';
      if (!rec[prop]) return;
      rec[prop].remove();
      rec.nodes = rec.nodes.filter(function (n) { return n !== rec[prop]; });
      rec[prop] = null;
    }
    function paintCell(rec) {
      var c = rec.cur;
      if (canvasOn) return; // canvas redraws everything once per frame
      var o = c.o === undefined ? 1 : c.o;
      vz.opacity(rec.el, o);
      if (rec.txt) {
        vz.opacity(rec.txt, o);
        var p = c.p === undefined ? 1 : c.p, sc = 1 + 0.22 * Math.sin(Math.PI * p);
        vz.place(rec.txt, rec.cx, rec.cy, sc);
        if (rec.counting) vz.text(rec.txt, fmt(Math.round(c.v)));
      }
      if (rec.labEl) vz.opacity(rec.labEl, o);
    }

    /* ---------------------------------------------------------- overlay builders */
    function buildHead(rec) {
      rec.el = vz.svg('text', { class: 'vz-ghead', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.headers);
      rec.paint = function (r) { vz.set(r.el, 'x', vz.n2(r.cur.x)); vz.set(r.el, 'y', vz.n2(r.cur.y)); vz.opacity(r.el, r.cur.o); };
    }
    function buildBand(rec) {
      rec.el = vz.svg('g', { class: 'vz-region vz-gband' }, ctx.layers.bands);
      rec.rect = vz.svg('rect', { class: 'vz-band', rx: 5, ry: 5 }, rec.el);
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        vz.set(r.rect, 'x', vz.n2(c.x)); vz.set(r.rect, 'y', vz.n2(c.y));
        vz.set(r.rect, 'width', vz.n2(Math.max(0, c.w))); vz.set(r.rect, 'height', vz.n2(Math.max(0, c.h)));
      };
    }
    function buildCursor(rec) {
      rec.el = vz.svg('g', { class: 'vz-cursor' }, ctx.layers.cursor);
      rec.rect = vz.svg('rect', { rx: 6, ry: 6 }, rec.el);
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        vz.set(r.rect, 'x', vz.n2(c.x)); vz.set(r.rect, 'y', vz.n2(c.y));
        vz.set(r.rect, 'width', vz.n2(c.w)); vz.set(r.rect, 'height', vz.n2(c.w));
        vz.set(r.rect, 'rx', vz.n2(Math.min(7, c.w * 0.2))); vz.set(r.rect, 'ry', vz.n2(Math.min(7, c.w * 0.2)));
      };
    }
    function buildArrow(rec) {
      rec.el = vz.svg('g', { class: 'vz-edge vz-garrow' }, ctx.layers.arrows);
      rec.halo = vz.svg('path', { class: 'vz-garrow-halo' }, rec.el);
      rec.line = vz.svg('path', { class: 'vz-line' }, rec.el);
      rec.head = vz.svg('path', { class: 'vz-head' }, rec.el);
      rec.lab = null;
      rec.paint = paintArrow;
    }
    function paintArrow(rec) {
      var c = rec.cur;
      var n = vz.n2;
      var d = 'M' + n(c.x1) + ' ' + n(c.y1) + 'Q' + n(c.cx) + ' ' + n(c.cy) + ' ' + n(c.x2) + ' ' + n(c.y2);
      vz.set(rec.line, 'd', d); vz.set(rec.halo, 'd', d);
      var len = L.quadLength(c.x1, c.y1, c.cx, c.cy, c.x2, c.y2);
      var drawn = c.d === undefined ? 1 : c.d;
      if (drawn < 0.999) {
        vz.set(rec.line, 'stroke-dasharray', n(len) + ' ' + n(len + 20));
        vz.set(rec.line, 'stroke-dashoffset', n(len * (1 - drawn)));
        vz.set(rec.halo, 'stroke-dasharray', n(len) + ' ' + n(len + 20));
        vz.set(rec.halo, 'stroke-dashoffset', n(len * (1 - drawn)));
      } else {
        vz.set(rec.line, 'stroke-dasharray', null); vz.set(rec.line, 'stroke-dashoffset', null);
        vz.set(rec.halo, 'stroke-dasharray', null); vz.set(rec.halo, 'stroke-dashoffset', null);
      }
      var angle = Math.atan2(c.y2 - c.cy, c.x2 - c.cx);
      var size = vz.clamp(G ? G.cs * 0.17 : 7, 4.5, 8);
      vz.set(rec.head, 'd', vz.arrowHead(c.x2, c.y2, angle, size));
      vz.set(rec.head, 'opacity', drawn > 0.85 ? null : '0');
      vz.opacity(rec.el, c.o);
      if (rec.lab) {
        var mx = 0.25 * c.x1 + 0.5 * c.cx + 0.25 * c.x2, my = 0.25 * c.y1 + 0.5 * c.cy + 0.25 * c.y2;
        var ll = Math.hypot(c.x2 - c.x1, c.y2 - c.y1) || 1, lux = (c.x2 - c.x1) / ll, luy = (c.y2 - c.y1) / ll, off = 8;
        var axisL = Math.abs(lux) > 0.99 || Math.abs(luy) > 0.99;
        // axis arrows: label further out on the arrow's side; diagonals: label beside the corner
        var lx = axisL ? luy * off : -luy * off, ly = axisL ? lux * off : lux * off;
        vz.set(rec.lab, 'x', n(mx + lx)); vz.set(rec.lab, 'y', n(my + ly));
        vz.set(rec.lab, 'opacity', drawn > 0.85 ? null : '0');
      }
    }
    function buildMarker(rec) {
      rec.el = vz.svg('g', { class: 'vz-marker' }, ctx.layers.markers);
      rec.outer = vz.svg('circle', { class: 'vz-marker-outer', cx: 0, cy: 0 }, rec.el);
      rec.inner = vz.svg('circle', { class: 'vz-marker-inner', cx: 0, cy: 0 }, rec.el);
      rec.txt = vz.svg('text', { class: 'vz-marker-text', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y, r.cur.s); vz.opacity(r.el, r.cur.o); };
    }
    function shapeMarker(rec, m) {
      var r = Math.max(4, G.cs * 0.36);
      vz.toggle(rec.el, 'is-end', m.kind === 'end');
      vz.toggle(rec.el, 'is-start', m.kind === 'start');
      if (m.kind === 'end') {
        vz.set(rec.outer, 'r', vz.n2(Math.max(2.5, r)));
        vz.set(rec.outer, 'stroke-width', vz.n2(Math.max(1.2, G.cs * 0.1)));
        vz.set(rec.inner, 'r', vz.n2(Math.max(1.2, G.cs * 0.12)));
        vz.set(rec.inner, 'opacity', m.label && G.cs >= 22 ? '0' : null);
      } else {
        vz.set(rec.outer, 'r', vz.n2(Math.max(2.5, r)));
        vz.set(rec.outer, 'stroke-width', vz.n2(G.cs >= 14 ? 1.5 : 0.75));
        vz.set(rec.inner, 'opacity', '0');
      }
      var showText = m.label && G.cs >= 22;
      vz.text(rec.txt, showText ? m.label : '');
      vz.set(rec.txt, 'font-size', vz.clamp(Math.round(G.cs * 0.34), 8, 13));
    }
    function buildPointer(rec) {
      rec.el = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head' }, rec.el);
      rec.label = vz.svg('text', { class: 'vz-ptr-label', dy: '.35em' }, rec.el);
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }

    /* ---------------------------------------------------------- layout */
    function computeLayout(state, norm) {
      var rh = L.headers(state.rowHeaders !== undefined ? state.rowHeaders : opts.rowHeaders, norm.rows);
      var ch = L.headers(state.colHeaders !== undefined ? state.colHeaders : opts.colHeaders, norm.cols);
      var ptrs = (state.pointers || []).filter(Boolean);
      var hasRowPtr = reserve.rowPointers || ptrs.some(function (p) { return typeof p.row === 'number'; });
      var hasColPtr = reserve.colPointers || ptrs.some(function (p) { return typeof p.col === 'number'; });
      if (hasRowPtr) reserve.rowPointers = true;
      if (hasColPtr) reserve.colPointers = true;
      var rowPtrW = 0;
      if (hasRowPtr) {
        ptrs.forEach(function (p) { if (typeof p.row === 'number') rowPtrW = Math.max(rowPtrW, measure(String(p.label || p.name), 12, 700, true)); });
        rowPtrW = Math.max(reserve.rowPtrW || 0, rowPtrW + 20);
        reserve.rowPtrW = rowPtrW;
      }
      // provisional cell size to decide header font; headers hide on tiny cells
      var headFs = 12;
      var rowHeaderW = 0;
      if (rh) rh.forEach(function (t) { rowHeaderW = Math.max(rowHeaderW, measure(t, headFs, 600, true)); });
      if (rh) rowHeaderW += 12;
      var colHeaderH = ch ? 20 : 0;
      var defCell = opts.mode === 'path' ? 28 : 46;
      var g = L.geometry({ width: ctx.width, rows: norm.rows, cols: norm.cols, cellSize: opts.cellSize || defCell, minCell: opts.minCell,
        rowHeaderW: rowHeaderW, colHeaderH: colHeaderH, rowPtrW: rowPtrW, colPtrH: hasColPtr ? 26 : 0 });
      if (g.cs < 12 && (rh || ch)) { // headers would be illegible: drop them
        rh = null; ch = null;
        g = L.geometry({ width: ctx.width, rows: norm.rows, cols: norm.cols, cellSize: opts.cellSize || defCell, minCell: opts.minCell, rowPtrW: rowPtrW, colPtrH: hasColPtr ? 26 : 0 });
      }
      g.rh = rh; g.ch = ch;
      g.headFs = g.cs < 22 ? Math.max(9, Math.round(g.cs * 0.5)) : headFs;
      if (opts.height) g.height = Math.max(g.height, opts.height);
      return g;
    }
    function bandsOf(state) {
      var out = [];
      function add(kind, v) {
        if (v === null || v === undefined || v === false) return;
        (Array.isArray(v) ? v : [v]).forEach(function (x) {
          if (typeof x === 'number') out.push({ kind: kind, index: x, state: 'active' });
          else if (x && typeof x.index === 'number') out.push({ kind: kind, index: x.index, state: x.state || 'active' });
        });
      }
      add('row', state.highlightRow); add('col', state.highlightCol);
      return out;
    }
    function cursorsOf(state) {
      var c = state.cursor, out = [];
      if (!c) return out;
      var list = Array.isArray(c) && typeof c[0] === 'number' ? [c] : (Array.isArray(c) ? c : [c]);
      list.forEach(function (x) {
        if (!x) return;
        if (Array.isArray(x)) out.push({ cell: x, state: 'active' });
        else if (x.cell) out.push({ cell: x.cell, state: x.state || 'active', id: x.id });
      });
      return out;
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var norm = L.normalize(state);
      N = norm;
      var useCanvas = opts.renderer === 'canvas' || (opts.renderer === 'auto' && norm.rows * norm.cols > opts.canvasThreshold);
      if (useCanvas !== canvasOn || (useCanvas && !canvas)) switchRenderer(useCanvas);
      G = computeLayout(state, norm);
      ctx.setHeight(G.height);
      var gk = [ctx.width, G.cs, G.x0, G.y0].map(vz.n2).join('|');
      var geomChanged = gk !== lastGeomKey;
      lastGeomKey = gk;
      if (canvasOn) { sizeCanvas(); if (!pal) probePalette(); }
      var anim = [], stamp = ++drawId;
      function push(rec) { rec.__stamp = stamp; anim.push(rec); }
      var animate = ms > 0;
      var intro = first && animate;
      first = false;
      var gap = gapFor(G.cs), corner = cornerFor(G.cs), fs = valueFont(G.cs);
      var span = norm.rows + norm.cols;

      /* cells */
      S.cells.begin();
      for (var r = 0; r < norm.rows; r++) {
        for (var c = 0; c < norm.cols; c++) {
          var k = r + ',' + c;
          var cell = norm.cells[k] || EMPTY;
          var rec = S.cells.use(k, buildCell);
          var isNew = rec.isNew;
          rec.r = r; rec.c = c;
          var st = cell.state || 'default', wall = !!cell.wall;
          var shown = opts.showValues ? L.cellText(cell) : '';
          var lab = cell.label === undefined || cell.label === null || cell.label === '' ? '' : String(cell.label);
          var target = null;
          var colorChanged = isNew || rec.st !== st || rec.wall !== wall;
          rec.st = st; rec.wall = wall;
          if (!canvasOn) {
            vz.state(rec.el, st);
            vz.toggle(rec.el, 'vz-wall', wall);
            if (isNew || geomChanged) {
              var R = L.cellRect(G, r, c, gap);
              vz.set(rec.el, 'x', vz.n2(R.x)); vz.set(rec.el, 'y', vz.n2(R.y));
              vz.set(rec.el, 'width', vz.n2(R.w)); vz.set(rec.el, 'height', vz.n2(R.h));
              vz.set(rec.el, 'rx', vz.n2(corner)); vz.set(rec.el, 'ry', vz.n2(corner));
              rec.cx = R.x + R.w / 2; rec.cy = R.y + R.h / 2;
            }
          }
          // value text
          var textChanged = shown !== (rec.shown || '');
          var prevShown = rec.shown || '';
          rec.shown = shown;
          rec.lab = lab;
          var willCount = false, willPop = false;
          if (animate && !isNew && textChanged && shown) {
            if (opts.countUp && /^[−-]?\d+$/.test(prevShown) && /^[−-]?\d+$/.test(shown)) willCount = true;
            else if (opts.pop) willPop = true;
          }
          rec.counting = willCount;
          if (!canvasOn) {
            if (shown) {
              var t = ensureText(rec, 'txt');
              vz.state(t, st);
              vz.toggle(t, 'vz-wall', wall);
              var tfs = fs, maxW = G.cs * 0.86;
              var tw = measure(shown, tfs, 600, false);
              if (tw > maxW) tfs = Math.max(6, Math.floor(tfs * maxW / tw));
              vz.set(t, 'font-size', tfs);
              if (!rec.counting) vz.text(t, shown);
              if (isNew || geomChanged || textChanged) vz.place(t, rec.cx, rec.cy);
            } else dropText(rec, 'txt');
            if (lab && G.cs >= 16) {
              var le = ensureText(rec, 'lab');
              vz.state(le, st);
              vz.text(le, lab);
              var lfs = Math.max(7, Math.round(fs * 0.62));
              vz.set(le, 'font-size', lfs);
              if (shown) { vz.set(le, 'text-anchor', 'start'); vz.set(le, 'x', vz.n2(rec.cx - G.cs / 2 + gap / 2 + 3)); vz.set(le, 'y', vz.n2(rec.cy - G.cs / 2 + gap / 2 + lfs * 0.75)); }
              else { vz.set(le, 'text-anchor', 'middle'); vz.set(le, 'x', vz.n2(rec.cx)); vz.set(le, 'y', vz.n2(rec.cy)); }
            } else dropText(rec, 'lab');
          }
          // animations: intro wave / fade in, count-up, pop, canvas colour lerp
          target = {};
          var needs = false;
          if (isNew) {
            rec.cur.o = animate ? 0 : 1;
            target.o = 1; needs = animate;
            rec.delay = intro ? 0.55 * (r + c) / Math.max(1, span) : 0;
          } else { rec.delay = 0; }
          if (willCount) {
            rec.cur.v = parseFloat(prevShown.replace('−', '-')); target.v = parseFloat(shown.replace('−', '-')); needs = true;
          } else if (willPop) { rec.cur.p = 0; target.p = 1; needs = true; }
          if (canvasOn) {
            var pt = palTarget(rec);
            if (isNew) { for (var kk in pt) rec.cur[kk] = pt[kk]; }
            else if (colorChanged) { Object.assign(target, pt); needs = needs || animate; if (!animate) for (var k2 in pt) rec.cur[k2] = pt[k2]; }
          }
          if (needs) { vz.retarget(rec, target); rec.paint = paintCell; push(rec); }
          else if (!canvasOn && (isNew || geomChanged)) { rec.cur.o = 1; paintCell(rec); }
        }
      }
      S.cells.end().forEach(function (rec) {
        rec.from = { o: rec.cur.o === undefined ? 1 : rec.cur.o }; rec.to = { o: 0 }; rec.cur.o = rec.from.o;
        rec.delay = 0; rec.paint = paintCell; push(rec);
      });

      /* headers */
      S.heads.begin();
      var bands = bandsOf(state);
      var hlRow = {}, hlCol = {};
      bands.forEach(function (b) { (b.kind === 'row' ? hlRow : hlCol)[b.index] = b.state; });
      function headUse(key, text, x, y, hl) {
        var rec = S.heads.use(key, buildHead);
        vz.text(rec.el, text);
        vz.set(rec.el, 'font-size', G.headFs);
        vz.state(rec.el, hl || 'default');
        vz.toggle(rec.el, 'is-hl', !!hl);
        var t = { x: x, y: y, o: 1 };
        if (rec.isNew) { rec.cur = { x: x, y: y, o: animate ? 0 : 1 }; }
        vz.retarget(rec, t); rec.delay = 0; push(rec);
      }
      if (G.rh) G.rh.forEach(function (t, i) { if (i < norm.rows) headUse('r' + i, t, G.x0 - G.rowHeaderW / 2 - 2, G.y0 + (i + 0.5) * G.cs, hlRow[i]); });
      if (G.ch) G.ch.forEach(function (t, j) { if (j < norm.cols) headUse('c' + j, t, G.x0 + (j + 0.5) * G.cs, G.y0 - G.colHeaderH / 2 - 1, hlCol[j]); });
      var corner0 = state.corner !== undefined ? state.corner : opts.corner;
      if (corner0 && G.rh && G.ch) headUse('corner', String(corner0), G.x0 - G.rowHeaderW / 2 - 2, G.y0 - G.colHeaderH / 2 - 1, null);
      S.heads.end().forEach(fadeOut);

      /* highlight bands */
      S.bands.begin();
      var bandCount = { row: 0, col: 0 };
      bands.forEach(function (b) {
        if (b.index < 0 || (b.kind === 'row' ? b.index >= norm.rows : b.index >= norm.cols)) return;
        var key = b.kind + (bandCount[b.kind]++);
        var rec = S.bands.use(key, buildBand);
        vz.state(rec.el, b.state);
        var t;
        if (b.kind === 'row') t = { x: G.x0 - G.rowHeaderW - 3, y: G.y0 + b.index * G.cs - 2, w: G.gridW + G.rowHeaderW + 6, h: G.cs + 4, o: 1 };
        else t = { x: G.x0 + b.index * G.cs - 2, y: G.y0 - G.colHeaderH - 3, w: G.cs + 4, h: G.gridH + G.colHeaderH + 6, o: 1 };
        if (rec.isNew) rec.cur = Object.assign({}, t, { o: 0 });
        vz.retarget(rec, t); rec.delay = 0; push(rec);
      });
      S.bands.end().forEach(fadeOut);

      /* dependency arrows */
      S.arrows.begin();
      (state.arrows || []).forEach(function (a, i) {
        if (!a || !a.from || !a.to) return;
        var key = a.id !== undefined ? String(a.id) : a.from.join(',') + '>' + a.to.join(',');
        var rec = S.arrows.use(key, buildArrow);
        vz.state(rec.el, a.state || 'default');
        var geo = L.arrowGeom(G, a.from, a.to, { bend: a.bend });
        var t = { x1: geo.x1, y1: geo.y1, cx: geo.cx, cy: geo.cy, x2: geo.x2, y2: geo.y2, o: 1, d: 1 };
        if (a.label !== undefined && a.label !== null && a.label !== '') {
          if (!rec.lab) rec.lab = vz.svg('text', { class: 'vz-garrow-label', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
          vz.text(rec.lab, a.label);
        } else if (rec.lab) { rec.lab.remove(); rec.lab = null; }
        if (rec.isNew) { rec.cur = Object.assign({}, t, { d: animate ? 0 : 1 }); rec.delay = animate ? Math.min(0.3, i * 0.08) : 0; }
        else rec.delay = 0;
        vz.retarget(rec, t); push(rec);
      });
      S.arrows.end().forEach(fadeOut);

      /* cursors */
      S.cursors.begin();
      cursorsOf(state).forEach(function (cu, i) {
        var rec = S.cursors.use(cu.id !== undefined ? String(cu.id) : 'cursor' + i, buildCursor);
        vz.state(rec.el, cu.state);
        var t = { x: G.x0 + cu.cell[1] * G.cs - 1, y: G.y0 + cu.cell[0] * G.cs - 1, w: G.cs + 2, o: 1 };
        if (rec.isNew) rec.cur = Object.assign({}, t, { o: 0, x: t.x - 3, y: t.y - 3, w: t.w + 6 });
        vz.retarget(rec, t); rec.delay = 0; push(rec);
      });
      S.cursors.end().forEach(fadeOut);

      /* markers */
      S.markers.begin();
      norm.markers.forEach(function (m) {
        var rec = S.markers.use(m.id, buildMarker);
        rec.data = m;
        shapeMarker(rec, m);
        vz.state(rec.el, m.state || (m.kind === 'end' ? 'found' : 'active'));
        var ctr = L.center(G, m.cell[0], m.cell[1]);
        var t = { x: ctr.x, y: ctr.y, o: 1, s: 1 };
        if (rec.isNew) { rec.cur = { x: ctr.x, y: ctr.y, o: animate ? 0 : 1, s: animate ? 0.3 : 1 }; rec.delay = intro ? 0.5 : 0; }
        else rec.delay = 0;
        vz.retarget(rec, t); push(rec);
      });
      S.markers.end().forEach(fadeOut);

      /* pointers (row / col) */
      S.ptrs.begin();
      (state.pointers || []).forEach(function (p) {
        if (!p) return;
        var isRow = typeof p.row === 'number', isCol = typeof p.col === 'number';
        if (!isRow && !isCol) return;
        var rec = S.ptrs.use(String(p.id !== undefined ? p.id : p.name), buildPointer);
        vz.state(rec.el, p.state || 'active');
        vz.text(rec.label, p.label !== undefined ? p.label : p.name);
        var t;
        if (isRow) {
          vz.set(rec.head, 'd', 'M0 0L-8 -5.5Q-6.4 0 -8 5.5Z');
          vz.set(rec.label, 'text-anchor', 'end'); vz.set(rec.label, 'x', -11); vz.set(rec.label, 'y', 0);
          t = { x: G.x0 - G.rowHeaderW - 4, y: G.y0 + (p.row + 0.5) * G.cs, o: 1 };
        } else {
          vz.set(rec.head, 'd', 'M0 0L-5.5 -8Q0 -6.4 5.5 -8Z');
          vz.set(rec.label, 'text-anchor', 'middle'); vz.set(rec.label, 'x', 0); vz.set(rec.label, 'y', -16);
          t = { x: G.x0 + (p.col + 0.5) * G.cs, y: G.y0 - G.colHeaderH - 3, o: 1 };
        }
        if (rec.isNew) rec.cur = Object.assign({}, t, { o: 0 });
        vz.retarget(rec, t); rec.delay = 0; push(rec);
      });
      S.ptrs.end().forEach(fadeOut);

      function fadeOut(rec) {
        rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 });
        rec.delay = 0; push(rec);
      }

      // records still animating from an interrupted transition continue to their targets
      lastAnim.forEach(function (rec) {
        if (rec.__stamp === stamp || !rec.to) return;
        if (S.cells.get(rec.id) !== rec) return;   // other stores re-push every record on every render
        vz.retarget(rec, rec.to); rec.delay = 0; push(rec);
      });
      lastAnim = anim;
      updateFocus();

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) {
          var rec = anim[i];
          vz.step(rec, vz.local(t, rec.delay));
          rec.paint(rec);
        }
        if (canvasOn) redraw();
      }, function () {
        lastAnim = [];
        Object.keys(S).forEach(function (k) { S[k].purge(); });
        if (canvasOn) redraw();
      });
    }

    /* ---------------------------------------------------------- interaction: click, paint, marker drag, keyboard */
    var drag = null, kf = null, kfEl = null, kbActive = false;
    function cellFromEvent(ev) { if (!G) return null; var p = vz.pointer(svg, ev); return L.cellAt(G, p.x, p.y); }
    function wallAt(r, c) { var rec = S.cells.get(r + ',' + c); return rec ? !!rec.wall : false; }
    function preview(cells, value) {
      cells.forEach(function (rc) {
        var rec = S.cells.get(rc[0] + ',' + rc[1]);
        if (!rec || rec.wall === value) return;
        rec.wall = value;
        if (canvasOn) { var t = palTarget(rec); for (var k in t) rec.cur[k] = t[k]; }
        else { vz.toggle(rec.el, 'vz-wall', value); if (rec.txt) vz.toggle(rec.txt, 'vz-wall', value); }
      });
      if (canvasOn) redraw();
      previewDirty = true;
    }
    function markerAt(r, c) {
      var found = null;
      S.markers.each(function (rec) { if (!rec.exiting && rec.data && rec.data.cell[0] === r && rec.data.cell[1] === c && rec.data.draggable !== false) found = rec; });
      return found;
    }
    function cellPayload(r, c) {
      var cell = (N && N.cells[r + ',' + c]) || EMPTY;
      return { row: r, col: c, cell: cell, value: cell.value, state: cell.state, wall: wallAt(r, c) };
    }
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      var rc = cellFromEvent(ev);
      if (!rc) return;
      var mrec = opts.draggableMarkers ? markerAt(rc[0], rc[1]) : null;
      if (mrec) {
        drag = { type: 'marker', rec: mrec, from: rc.slice(), last: rc.slice(), id: ev.pointerId };
      } else if (opts.paintable) {
        var value = opts.paintValue === null || opts.paintValue === undefined ? !wallAt(rc[0], rc[1]) : !!opts.paintValue;
        drag = { type: 'paint', value: value, last: rc.slice(), cells: [rc.slice()], id: ev.pointerId, start: rc.slice(), moved: false };
        preview([rc], value);
        em.emit('paint', { cells: [rc.slice()], value: value });
      } else if (clickable) {
        drag = { type: 'click', start: rc.slice(), id: ev.pointerId, moved: false };
      } else return;
      try { svg.setPointerCapture(ev.pointerId); } catch (_) {}
      ev.preventDefault();
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var rc = cellFromEvent(ev);
      if (!rc) return;
      if (drag.type === 'paint') {
        if (rc[0] === drag.last[0] && rc[1] === drag.last[1]) return;
        var seg = L.line(drag.last[0], drag.last[1], rc[0], rc[1]).slice(1);
        drag.last = rc.slice(); drag.moved = true;
        seg.forEach(function (x) { drag.cells.push(x); });
        preview(seg, drag.value);
        em.emit('paint', { cells: seg, value: drag.value });
      } else if (drag.type === 'marker') {
        if (rc[0] === drag.last[0] && rc[1] === drag.last[1]) return;
        drag.last = rc.slice();
        var ctr = L.center(G, rc[0], rc[1]);
        var rec = drag.rec;
        rec.cur.x = ctr.x; rec.cur.y = ctr.y; rec.cur.o = 1; rec.cur.s = 1;
        rec.data = Object.assign({}, rec.data, { cell: rc.slice() });
        rec.paint(rec);
        previewDirty = true;
        em.emit('move-marker', { marker: rec.id, cell: rc.slice(), from: drag.from.slice(), done: false });
      } else if (drag.type === 'click') {
        if (rc[0] !== drag.start[0] || rc[1] !== drag.start[1]) drag.moved = true;
      }
    });
    function endDrag(ev, cancelled) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      if (d.type === 'paint') {
        em.emit('paintend', { cells: d.cells, value: d.value });
        if (!d.moved && clickable && !cancelled) emitClick(d.start[0], d.start[1]);
      } else if (d.type === 'marker') {
        em.emit('move-marker', { marker: d.rec.id, cell: d.last.slice(), from: d.from.slice(), done: true });
      } else if (d.type === 'click' && !d.moved && !cancelled) emitClick(d.start[0], d.start[1]);
    }
    svg.addEventListener('pointerup', function (ev) { endDrag(ev, false); });
    svg.addEventListener('pointercancel', function (ev) { endDrag(ev, true); });
    svg.addEventListener('lostpointercapture', function (ev) { endDrag(ev, false); });
    function emitClick(r, c) {
      var payload = cellPayload(r, c);
      em.emit('click', payload);
      if (opts.onCellClick) opts.onCellClick(payload);
    }

    /* keyboard: roving focus cell on the SVG (scales to thousands of cells) */
    function setupKeyboard() {
      if (svg.getAttribute('tabindex') === '0') return;
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'group');
      svg.classList.add('vz-host-focus');
      var hint = opts.paintable ? 'Arrow keys move, Enter toggles a wall.' : 'Arrow keys move, Enter selects a cell.';
      svg.setAttribute('aria-label', (opts.label || (opts.mode === 'path' ? 'Grid' : 'Table')) + '. ' + hint);
      svg.addEventListener('focus', function () { if (!kf) kf = [0, 0]; });
      svg.addEventListener('blur', function () { kbActive = false; updateFocus(); });
      svg.addEventListener('pointerdown', function () { kbActive = false; updateFocus(); });
      svg.addEventListener('keydown', function (ev) {
        if (!N) return;
        var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
        kf = kf || [0, 0];
        if (d) {
          kf = [vz.clamp(kf[0] + d[0], 0, N.rows - 1), vz.clamp(kf[1] + d[1], 0, N.cols - 1)];
          kbActive = true; updateFocus(); ev.preventDefault();
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault(); kbActive = true;
          if (opts.paintable) {
            var v = opts.paintValue === null || opts.paintValue === undefined ? !wallAt(kf[0], kf[1]) : !!opts.paintValue;
            preview([kf], v);
            em.emit('paint', { cells: [kf.slice()], value: v });
            em.emit('paintend', { cells: [kf.slice()], value: v });
          }
          if (clickable) emitClick(kf[0], kf[1]);
          updateFocus();
        }
      });
    }
    function updateFocus() {
      if (!kbActive || !kf || !G) { if (kfEl) vz.set(kfEl, 'opacity', '0'); return; }
      if (!kfEl) kfEl = vz.svg('rect', { class: 'vz-kfocus', rx: 4, ry: 4 }, ctx.layers.focus);
      kf = [Math.min(kf[0], G.rows - 1), Math.min(kf[1], G.cols - 1)];
      vz.set(kfEl, 'x', vz.n2(G.x0 + kf[1] * G.cs - 1.5)); vz.set(kfEl, 'y', vz.n2(G.y0 + kf[0] * G.cs - 1.5));
      vz.set(kfEl, 'width', vz.n2(G.cs + 3)); vz.set(kfEl, 'height', vz.n2(G.cs + 3));
      vz.set(kfEl, 'opacity', null);
      var p = cellPayload(kf[0], kf[1]);
      ctx.setDescription('Row ' + kf[0] + ', column ' + kf[1] + (p.wall ? ', wall' : '') + (p.cell.state && p.cell.state !== 'default' ? ', ' + p.cell.state : '') + (L.cellText(p.cell) ? ', value ' + L.cellText(p.cell) : '') + '.');
    }
    if (interactive) setupKeyboard();

    /* ---------------------------------------------------------- public API */
    var baseRender = api.render;
    api.render = function (state, ropts) {
      if (previewDirty) { previewDirty = false; ropts = Object.assign({}, ropts || {}, { force: true }); }
      return baseRender(state, ropts);
    };
    api.describe = function (state) {
      var n = L.normalize(state);
      var total = n.rows * n.cols;
      var parts = [(opts.mode === 'path' ? 'Grid ' : 'Table ') + n.rows + ' by ' + n.cols + '.'];
      if (opts.mode === 'path') {
        var counts = {}, walls = 0;
        Object.keys(n.cells).forEach(function (k) { var c = n.cells[k]; if (c.wall) walls++; else if (c.state !== 'default') counts[c.state] = (counts[c.state] || 0) + 1; });
        var bits = [];
        if (walls) bits.push(walls + ' walls');
        Object.keys(counts).forEach(function (s) { bits.push(counts[s] + ' ' + s); });
        if (bits.length) parts.push(bits.join(', ') + '.');
      } else if (total <= 100) {
        for (var r = 0; r < n.rows; r++) {
          var row = [];
          for (var c = 0; c < n.cols; c++) { var t = L.cellText(n.cells[r + ',' + c]); row.push(t || '·'); }
          parts.push('Row ' + r + ': ' + row.join(', ') + '.');
        }
      }
      n.markers.forEach(function (m) { parts.push(m.id + ' at row ' + m.cell[0] + ', column ' + m.cell[1] + '.'); });
      var cu = cursorsOf(state || {});
      if (cu.length) parts.push('Cursor at row ' + cu[0].cell[0] + ', column ' + cu[0].cell[1] + '.');
      return parts.join(' ');
    };
    /* Scan a whole trace so pointer lanes are reserved up front (no height jumps). */
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        (st && st.pointers || []).forEach(function (p) {
          if (!p) return;
          if (typeof p.row === 'number') { reserve.rowPointers = true; reserve.rowPtrW = Math.max(reserve.rowPtrW || 0, measure(String(p.label || p.name), 12, 700, true) + 20); }
          if (typeof p.col === 'number') reserve.colPointers = true;
        });
      });
      api.refresh();
      return api;
    };
    api.reset = function () { reserve = Object.assign({ rowPointers: false, colPointers: false, rowPtrW: 0 }, opts.reserve || {}); return api; };
    api.setOptions = function (o) {
      var modeChange = o && o.mode && o.mode !== opts.mode;
      Object.assign(opts, o || {});
      if (modeChange || (o && o.renderer)) {
        S.cells.clear(); lastGeomKey = '';
        svg.setAttribute('class', 'vz vz-grid vz-grid-' + opts.mode + (opts.paintable ? ' is-paintable' : '') + (svg.classList.contains('vz-host-focus') ? ' vz-host-focus' : ''));
        pal = null;
      }
      if (opts.paintable || opts.draggableMarkers || opts.onCellClick) setupKeyboard();
      svg.classList.toggle('is-paintable', !!opts.paintable);
      api.refresh();
      return api;
    };
    /* Which renderer is active right now: 'svg' | 'canvas'. */
    api.renderer = function () { return canvasOn ? 'canvas' : 'svg'; };
    /* What a cell shows right now: {state, wall, text, label, fill: [r,g,b,a] (canvas only)} or null.
       Works for both renderers; handy for tests and for lesson logic after paint previews. */
    api.cellInfo = function (r, c) {
      var rec = S.cells.get(r + ',' + c);
      if (!rec || rec.exiting) return null;
      var out = { state: rec.st, wall: !!rec.wall, text: rec.shown || '', label: rec.lab || '' };
      if (canvasOn && rec.cur.fr !== undefined) out.fill = [Math.round(rec.cur.fr), Math.round(rec.cur.fg), Math.round(rec.cur.fb), +rec.cur.fa.toFixed(3)];
      return out;
    };
    /* SVG-unit rectangle of a cell (for lesson overlays). */
    api.cellRect = function (r, c) { return G ? L.cellRect(G, r, c, 0) : null; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) { clickable = true; setupKeyboard(); }
      if (evt === 'paint' || evt === 'paintend' || evt === 'move-marker') setupKeyboard();
      return baseOn(evt, fn);
    };
    var baseDestroy = api.destroy;
    api.destroy = function () { baseDestroy(); removeCanvas(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
    return api;
  }

  gridView.layout = L;
  gridView.defaults = DEFAULTS;
  VDSA.views.grid = gridView;
}(typeof window !== 'undefined' ? window : null));
