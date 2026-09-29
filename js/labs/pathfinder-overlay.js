/* Pathfinder lab: grid state adapter and SVG overlay (heatmap, mud hatching, the final route as a line).
   Adapted from the lesson 28 pathfinding lab (copied, not imported). Needs VDSA core and views/grid.js.

     Pathfinder.gridState(step, {heat})   grid view state for a generator step (expanded cells are left to the heat layer)
     Pathfinder.overlay(view)             {draw(frame, {heat}), route(cells | null, {animate}), redraw(), destroy()}
       frame = {rows, cols, codes, mud, ord: Int32Array, total}  (ord = expansion rank of every cell, -1 = never) */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var P = window.Pathfinder = window.Pathfinder || {};

  var CODE_STATE = { f: 'frontier', a: 'active', v: 'visited', p: 'path' };
  P.gridState = function (step, o) {
    o = o || {};
    var cells = {}, walls = [], C = step.cols, codes = step.codes;
    for (var k = 0; k < codes.length; k++) {
      var ch = codes[k];
      if (ch === '#') { walls.push([Math.floor(k / C), k % C]); continue; }
      if (ch === '.') continue;
      if (ch === 'v' && o.heat) continue;
      if (ch === 'p' && o.line) continue;
      cells[Math.floor(k / C) + ',' + (k % C)] = { state: CODE_STATE[ch] || 'default' };
    }
    return {
      rows: step.rows, cols: C, walls: walls, cells: cells,
      markers: { start: { cell: step.start, label: 'S' }, end: { cell: step.goal, label: 'T' } }
    };
  };

  var uid = 0;
  P.overlay = function (view) {
    var layer = view.ctx.layers.texts, pid = 'pf-hatch-' + (++uid);
    var line = s('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'pf-hatch__line' });
    var pattern = s('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, line);
    var heatG = s('g', { class: 'pf-heat' }), mudG = s('g', { class: 'pf-mud' }), routeG = s('g', { class: 'pf-route' });
    var g = s('g', { class: 'pf-overlay', 'pointer-events': 'none', 'aria-hidden': 'true' }, s('defs', {}, pattern), heatG, mudG, routeG);
    layer.parentNode.insertBefore(g, layer);
    var heat = {}, geomKey = '', mudKey = '', last = null, lastOpts = {}, routeCells = null, routeEl = null, routeKey = '';

    function rectOf(r, c) { return view.cellRect(r, c); }
    function draw(f, o) {
      last = f; lastOpts = o || {};
      if (!f) return;
      var R = f.rows, C = f.cols, r0 = rectOf(0, 0);
      if (!r0) return;
      var cs = r0.w, gk = [cs.toFixed(2), r0.x.toFixed(1), r0.y.toFixed(1), R, C].join('|');
      var geomChanged = gk !== geomKey; geomKey = gk;
      var rx = Math.max(1, cs * 0.14).toFixed(1), hp = Math.max(3, cs / 3.2).toFixed(1);
      pattern.setAttribute('width', hp); pattern.setAttribute('height', hp); line.setAttribute('y2', hp);
      line.style.strokeWidth = Math.max(1, cs / 9).toFixed(1);
      var codes = f.codes, want = {}, k, t;
      if (lastOpts.heat) {
        for (k = 0; k < codes.length; k++) {
          if ((codes[k] !== 'v' && !(codes[k] === 'p' && f.line)) || f.ord[k] < 0) continue;
          t = f.ord[k] / f.total;
          want[k] = 16 + Math.round(t * 17) * 4;   // 16 .. 84 percent in steps of 4
        }
      }
      Object.keys(heat).forEach(function (kk) { if (want[kk] === undefined) { heat[kk].el.remove(); delete heat[kk]; } });
      Object.keys(want).forEach(function (kk) {
        var rec = heat[kk], rr = rectOf(Math.floor(kk / C), kk % C);
        if (!rr) return;
        if (!rec) { rec = heat[kk] = { el: s('rect', { class: 'pf-heat__cell' }), p: -1, geom: '' }; heatG.appendChild(rec.el); }
        if (rec.p !== want[kk]) { rec.el.style.fill = 'color-mix(in srgb, var(--st-visited) ' + want[kk] + '%, var(--bg-sunken))'; rec.p = want[kk]; }
        var gg = gk;
        if (rec.geom !== gg) {
          rec.geom = gg; var pad = cs > 6 ? 0.5 : 0;
          rec.el.setAttribute('x', (rr.x + pad).toFixed(1)); rec.el.setAttribute('y', (rr.y + pad).toFixed(1));
          rec.el.setAttribute('width', (rr.w - 2 * pad).toFixed(1)); rec.el.setAttribute('height', (rr.h - 2 * pad).toFixed(1)); rec.el.setAttribute('rx', rx);
        }
      });
      var mk = (f.mud || '') + '|' + gk;
      if (mk !== mudKey) {
        mudKey = mk;
        while (mudG.firstChild) mudG.removeChild(mudG.firstChild);
        var mstr = f.mud || '';
        for (var m = 0; m < mstr.length; m++) {
          if (mstr[m] !== '1' || codes[m] === '#') continue;
          var mr = rectOf(Math.floor(m / C), m % C);
          if (!mr) continue;
          mudG.appendChild(s('rect', { class: 'pf-mud__cell', x: mr.x.toFixed(1), y: mr.y.toFixed(1), width: mr.w.toFixed(1), height: mr.h.toFixed(1), rx: rx, style: 'fill:url(#' + pid + ')' }));
        }
      }
      if (routeCells) drawRoute(false);
    }

    /* The route: a polyline through the cell centres that draws itself in. */
    function drawRoute(animate) {
      var r0 = rectOf(0, 0);
      if (!routeCells || !routeCells.length || !r0) { if (routeEl) { routeEl.remove(); routeEl = null; routeKey = ''; } return; }
      var cs = r0.w, pts = routeCells.map(function (rc) { var r = rectOf(rc[0], rc[1]); return (r.x + r.w / 2).toFixed(1) + ',' + (r.y + r.h / 2).toFixed(1); }).join(' ');
      var rk = pts + '|' + cs.toFixed(2);
      if (rk === routeKey && routeEl) return;
      routeKey = rk;
      if (!routeEl) { routeEl = s('polyline', { class: 'pf-route__line', fill: 'none' }); routeG.appendChild(routeEl); }
      routeEl.setAttribute('points', pts);
      routeEl.style.strokeWidth = Math.max(2, cs * 0.3).toFixed(1);
      if (animate && !V.reducedMotion()) {
        var len = 0; try { len = routeEl.getTotalLength(); } catch (e) { len = 0; }
        if (len) {
          routeEl.style.transition = 'none'; routeEl.style.strokeDasharray = len + ' ' + len; routeEl.style.strokeDashoffset = len;
          void routeEl.getBoundingClientRect();
          routeEl.style.transition = 'stroke-dashoffset ' + Math.min(900, 250 + routeCells.length * 6) + 'ms var(--ease-out)';
          routeEl.style.strokeDashoffset = 0;
          return;
        }
      }
      routeEl.style.transition = 'none'; routeEl.style.strokeDasharray = 'none'; routeEl.style.strokeDashoffset = 0;
    }
    function route(cells, o) {
      var had = !!routeCells;
      routeCells = cells && cells.length > 1 ? cells : null;
      if (!routeCells) { if (had) { if (routeEl) { routeEl.remove(); routeEl = null; routeKey = ''; } } return; }
      drawRoute(!!(o && o.animate));
    }
    return {
      draw: draw, route: route,
      redraw: function () { geomKey = ''; mudKey = ''; routeKey = ''; Object.keys(heat).forEach(function (k) { heat[k].geom = ''; }); draw(last, lastOpts); },
      destroy: function () { g.remove(); }
    };
  };
}());
