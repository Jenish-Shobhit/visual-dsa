/* Lesson 38 — custom views shared by the lesson's figures. Loaded before 38-randomized-algorithms-labs.js and
   38-randomized-algorithms.js. Every view takes a snapshot from js/algos/38-randomized-algorithms.js and follows the
   engine contract: build once, keep elements alive, move them with one tween per render.

     L38.dartBoard(stage, opts)      canvas: darts in a unit square with a quarter disc (Monte Carlo pi)
     L38.reservoirView(stage)        {prepare(steps), render(step, {duration})}   stream row, die strip, reservoir slots
     L38.skipView(stage)             {prepare(steps), render(step, {duration})}   towers, arrows per level, search path
     L38.bloomView(stage)            {prepare(steps), render(step, {duration})}   bit row, hash arrows, verdict pill
     L38.heatmap(stage, opts)        {render(probs, {duration}), set(...)}         n x n position-probability grid
     L38.whenNear(el, fn)            run fn once when el comes within ~700px of the viewport
     L38.mover()                     tiny keyed tween helper used by the views above */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L38 = (V.lessons = V.lessons || {}).l38 = (V.lessons.l38 || {});

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function f2(x) { return Math.round(x * 100) / 100; }

  L38.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 38] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ mover: one tween for many records */
  L38.mover = function () {
    var recs = [], tw = null;
    return {
      add: function (cur, apply, remove) {
        var r = { cur: cur, from: Object.assign({}, cur), to: Object.assign({}, cur), apply: apply, remove: remove, dead: false };
        recs.push(r); apply(r.cur); return r;
      },
      kill: function (r) { r.dead = true; },
      go: function (dur) {
        if (tw) tw.cancel();
        recs.forEach(function (r) { r.from = Object.assign({}, r.cur); });
        function sweep() {
          recs = recs.filter(function (r) {
            if (r.dead && (!r.to.op || r.cur.op <= 0.001)) { if (r.remove) r.remove(); return false; }
            return true;
          });
        }
        function frame(t, e) {
          recs.forEach(function (r) {
            for (var k in r.to) if (Object.prototype.hasOwnProperty.call(r.to, k)) r.cur[k] = r.from[k] + (r.to[k] - r.from[k]) * e;
            r.apply(r.cur);
          });
        }
        if (!dur) { frame(1, 1); sweep(); return; }
        tw = V.tween(dur, frame);
        tw.promise.then(function (ok) { if (ok) sweep(); });
      },
      count: function () { return recs.length; }
    };
  };

  /* ------------------------------------------------------------------ dart board (canvas) */
  L38.dartBoard = function (stage, opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'rz-board', role: 'img', 'aria-label': opts.label || 'A unit square with a quarter circle. Random darts land in it; the ones inside the circle are blue.' });
    var base = h('canvas', { class: 'rz-board__layer' }), over = h('canvas', { class: 'rz-board__layer' });
    wrap.appendChild(base); wrap.appendChild(over); stage.appendChild(wrap);
    var bx = base.getContext('2d'), ox = over.getContext('2d');
    var darts = [], side = 0, dpr = 1, pulses = [], raf = 0, drawn = 0, PAD = 12;

    function colors() {
      return { inside: V.cssVar('--st-active'), outside: V.cssVar('--st-path'), edge: V.cssVar('--el-edge-strong'), ink: V.cssVar('--ink-3'), fill: V.cssVar('--bg-elev') };
    }
    function size() {
      var w = Math.max(80, Math.round(wrap.clientWidth));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === side && base.width === Math.round(w * dpr)) return false;
      side = w;
      [base, over].forEach(function (c) { c.width = Math.round(w * dpr); c.height = Math.round(w * dpr); });
      return true;
    }
    function px(x) { return PAD + x * (side - 2 * PAD); }
    function py(y) { return side - PAD - y * (side - 2 * PAD); }
    function radius(cnt) { cnt = cnt === undefined ? darts.length : cnt; return cnt > 6000 ? 1.1 : cnt > 2500 ? 1.5 : cnt > 800 ? 1.9 : 2.6; }
    function drawFrame() {
      var c = colors(), R = side - 2 * PAD;
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bx.clearRect(0, 0, side, side);
      bx.fillStyle = c.fill; bx.globalAlpha = 1; bx.fillRect(PAD, PAD, R, R);
      bx.beginPath(); bx.moveTo(PAD, side - PAD); bx.arc(PAD, side - PAD, R, -Math.PI / 2, 0); bx.closePath();
      bx.globalAlpha = 0.09; bx.fillStyle = c.inside; bx.fill(); bx.globalAlpha = 1;
      bx.lineWidth = 1.5; bx.strokeStyle = c.edge; bx.strokeRect(PAD, PAD, R, R);
      bx.beginPath(); bx.arc(PAD, side - PAD, R, -Math.PI / 2, 0); bx.strokeStyle = c.inside; bx.lineWidth = 2; bx.stroke();
      bx.fillStyle = c.ink; bx.font = '11px ui-monospace, monospace'; bx.textAlign = 'left';
      bx.fillText('(0, 0)', PAD + 4, side - PAD - 5);
      bx.textAlign = 'right'; bx.fillText('1', side - PAD - 4, side - PAD - 5);
      bx.textAlign = 'left'; bx.fillText('1', PAD + 4, PAD + 13);
    }
    function dot(d, r, c) {
      bx.beginPath(); bx.arc(px(d.x), py(d.y), r, 0, 6.2832);
      bx.fillStyle = d.inside ? c.inside : c.outside; bx.fill();
    }
    function redraw() {
      size(); drawFrame();
      var c = colors(), r = radius();
      bx.globalAlpha = 0.85;
      for (var i = 0; i < drawn; i++) dot(darts[i], r, c);
      bx.globalAlpha = 1;
    }
    function loop(now) {
      raf = 0;
      ox.setTransform(dpr, 0, 0, dpr, 0, 0); ox.clearRect(0, 0, side, side);
      var c = colors(), alive = [];
      pulses.forEach(function (p) {
        if (!p.t0) p.t0 = now;
        var t = clamp((now - p.t0) / 420, 0, 1);
        if (t < 1) alive.push(p);
        var e = 1 - Math.pow(1 - t, 3);
        ox.beginPath(); ox.arc(px(p.d.x), py(p.d.y), 3 + (1 - e) * 9, 0, 6.2832);
        ox.strokeStyle = p.d.inside ? c.inside : c.outside; ox.globalAlpha = 1 - e; ox.lineWidth = 2; ox.stroke();
      });
      ox.globalAlpha = 1;
      pulses = alive;
      if (pulses.length) raf = requestAnimationFrame(loop);
    }
    var api = {
      el: wrap,
      add: function (list, animate) {
        size();
        var oldR = radius(), newR = radius(darts.length + list.length);
        list.forEach(function (d) { darts.push(d); });
        if (newR !== oldR) { drawn = darts.length; redraw(); }
        else {
          var c = colors(); bx.globalAlpha = 0.85;
          for (var q = drawn; q < darts.length; q++) dot(darts[q], newR, c);
          bx.globalAlpha = 1;
        }
        drawn = darts.length;
        if (animate !== false && !V.reducedMotion()) {
          list.slice(-24).forEach(function (d) { pulses.push({ d: d, t0: 0 }); });
          if (!raf) raf = requestAnimationFrame(loop);
        }
      },
      clear: function () { darts = []; drawn = 0; pulses = []; redraw(); ox.clearRect(0, 0, over.width, over.height); },
      set: function (list) { darts = list.slice(); drawn = darts.length; redraw(); },
      get count() { return darts.length; },
      redraw: redraw
    };
    V.onResize(wrap, function () { size(); redraw(); });
    V.theme.onChange(function () { setTimeout(redraw, 30); });
    redraw();
    return api;
  };

  /* ------------------------------------------------------------------ reservoir view */
  L38.reservoirView = function (stage) {
    var W = 560, PAD = 18, built = null, svg, mv = L38.mover(), tokens = {}, die = null, marker = null, readout, resTitle, dieHint;
    var geo = {};

    function build(step) {
      if (svg) svg.remove();
      var n = step.stream.length, k = step.k;
      built = n + ':' + k;
      var sw = clamp((W - 2 * PAD) / Math.max(1, n), 28, 56), tw = sw - 6, th = 42;
      var yDie = 34, yStream = 120, yRes = 252, H = 322;
      var rw = 68, rgap = 12, resW = k * rw + (k - 1) * rgap, resX0 = W / 2 - resW / 2;
      var x0 = W / 2 - (n * sw) / 2;
      geo = { n: n, k: k, sw: sw, tw: tw, th: th, yStream: yStream, yRes: yRes, yDie: yDie, rw: rw,
        sx: function (t) { return x0 + sw * (t + 0.5); }, rx: function (i) { return resX0 + rw / 2 + i * (rw + rgap); } };
      svg = s('svg', { class: 'rz rz-res', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Reservoir sampling: a stream of ' + n + ' items flows past; a reservoir of ' + k + ' slots keeps a uniform random sample.' });
      var g0 = s('g', { class: 'rz-slots' });
      for (var t = 0; t < n; t++) {
        g0.appendChild(s('rect', { class: 'rz-slot', x: geo.sx(t) - tw / 2, y: yStream - th / 2, width: tw, height: th, rx: 8 }));
        g0.appendChild(s('text', { class: 'rz-idx', x: geo.sx(t), y: yStream + th / 2 + 14, 'text-anchor': 'middle' }, String(t + 1)));
      }
      g0.appendChild(s('text', { class: 'rz-head', x: x0, y: yStream + th / 2 + 42 }, 'THE STREAM  ·  numbers are arrival order'));
      for (var q = 0; q < k; q++) {
        g0.appendChild(s('rect', { class: 'rz-slot rz-slot--res', x: geo.rx(q) - rw / 2, y: yRes - th / 2 - 4, width: rw, height: th + 8, rx: 10 }));
        g0.appendChild(s('text', { class: 'rz-idx', x: geo.rx(q), y: yRes + th / 2 + 18, 'text-anchor': 'middle' }, 'slot ' + (q + 1)));
      }
      resTitle = s('text', { class: 'rz-head', x: W / 2, y: yRes - th / 2 - 20, 'text-anchor': 'middle' }, 'THE RESERVOIR  ·  keeps ' + k);
      g0.appendChild(resTitle);
      dieHint = s('text', { class: 'rz-head', x: PAD, y: yDie + 4 }, 'THE DIE  ·  item i rolls a number from 1 to i');
      g0.appendChild(dieHint);
      svg.appendChild(g0);
      die = s('g', { class: 'rz-die' });
      svg.appendChild(die);
      marker = s('g', { class: 'rz-marker' }, s('path', { d: 'M-7 -9 L7 -9 L0 1 Z' }));
      svg.appendChild(marker);
      var mrec = mv.add({ x: PAD, op: 0 }, function (c) { marker.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + (yDie - 4) + ')'); marker.style.opacity = c.op; });
      marker.__rec = mrec;
      readout = s('text', { class: 'rz-readout', x: W - PAD, y: yDie + 5, 'text-anchor': 'end' });
      svg.appendChild(readout);
      tokens = {};
      step.stream.forEach(function (it, t2) {
        var g = s('g', { class: 'rz-token is-upcoming' },
          s('rect', { x: -tw / 2, y: -th / 2, width: tw, height: th, rx: 8 }),
          s('text', { class: 'rz-token__t', x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.label));
        var badge = s('text', { class: 'rz-token__x', x: tw / 2 - 2, y: -th / 2 + 4, 'text-anchor': 'middle' }, '×');
        g.appendChild(badge);
        svg.appendChild(g);
        var rec = mv.add({ x: geo.sx(t2), y: yStream }, function (c) { g.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + f2(c.y) + ')'); });
        tokens[it.id] = { g: g, rec: rec, t: t2 };
      });
      stage.appendChild(svg);
    }

    function drawDie(roll, dur) {
      V.clear(die);
      if (dieHint) dieHint.style.opacity = roll ? 0 : 1;
      if (!roll) { marker.__rec.to.op = 0; return; }
      var n = roll.i, dw = Math.min(30, (W - 2 * PAD - 150) / Math.max(n, 1)), x0 = PAD, y = geo.yDie;
      for (var c = 1; c <= n; c++) {
        var keep = c <= roll.k, hit = c === roll.j;
        die.appendChild(s('rect', { class: 'rz-face' + (keep ? ' is-keep' : ' is-out') + (hit ? ' is-hit' : ''), x: x0 + (c - 1) * dw + 1, y: y - 13, width: dw - 2, height: 26, rx: 5 }));
        die.appendChild(s('text', { class: 'rz-face__t' + (hit ? ' is-hit' : ''), x: x0 + (c - 0.5) * dw, y: y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(c)));
      }
      var mx = x0 + (roll.j - 0.5) * dw;
      marker.__rec.to.x = mx; marker.__rec.to.op = 1;
      if (marker.__rec.cur.op < 0.5) marker.__rec.cur.x = mx;
    }

    var api = {
      el: null,
      prepare: function (steps) { if (steps && steps.length) { build(steps[0]); api.el = svg; } },
      render: function (step, opts) {
        var dur = opts && opts.duration || 0;
        if (!svg || built !== step.stream.length + ':' + step.k) build(step);
        svg.style.setProperty('--t', dur + 'ms');
        step.stream.forEach(function (it, t) {
          var tk = tokens[it.id], st = step.tokenStates[it.id] || 'upcoming', x = geo.sx(t), y = geo.yStream;
          if (st === 'current') y = geo.yStream - 30;
          if (st === 'kept') { var idx = step.reservoir.indexOf(it.id); if (idx >= 0) { x = geo.rx(idx); y = geo.yRes; } }
          tk.rec.to.x = x; tk.rec.to.y = y;
          tk.g.setAttribute('class', 'rz-token is-' + st + (step.hot !== null && st === 'kept' && step.reservoir[step.hot] === it.id ? ' is-hot' : ''));
        });
        drawDie(step.roll, dur);
        var pk = step.vars && step.vars['P(keep)'];
        readout.textContent = step.roll ? 'keep chance  ' + step.roll.k + '/' + step.roll.i : (pk && step.cur !== null ? 'keep chance  ' + pk : '');
        mv.go(dur);
        svg.querySelectorAll('.rz-slot--res').forEach(function (r, i) { r.setAttribute('class', 'rz-slot rz-slot--res' + (step.hot === i ? ' is-hot' : '')); });
      }
    };
    return api;
  };

  /* ------------------------------------------------------------------ skip list view */
  L38.skipView = function (stage) {
    var W = 620, PAD = 22, svg, mv = L38.mover(), G = {}, nodes = {}, arrows = {}, head = null, built = '', headCells = [];
    var readout, targetText, flipsG, pathEl, curEl, peekEl, curRec, peekRec, gArrow, gCell, gLabels;
    var maxL = 3, maxN = 8, colW = 50, cellW = 30, rowH = 44;

    function X(col) { return PAD + 34 + col * colW; }
    function Y(l) { return 40 + (maxL - l) * rowH + rowH / 2; }

    function build() {
      if (svg) svg.remove();
      mv = L38.mover(); nodes = {}; arrows = {}; headCells = [];
      colW = clamp((W - 2 * PAD - 50) / (maxN + 1), 34, 62);
      cellW = Math.min(34, colW - 12);
      var H = 40 + maxL * rowH + 62;
      built = maxL + ':' + maxN;
      svg = s('svg', { class: 'rz rz-skip', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A skip list: towers of different heights linked level by level. The search path is drawn in orange.' });
      var lv = s('g', { class: 'rz-levels' });
      for (var l = 1; l <= maxL; l++) {
        lv.appendChild(s('line', { class: 'rz-lane', x1: PAD - 4, x2: W - PAD, y1: Y(l), y2: Y(l) }));
        lv.appendChild(s('text', { class: 'rz-idx', x: 2, y: Y(l) + 4 }, 'L' + l));
      }
      svg.appendChild(lv);
      gArrow = s('g'); svg.appendChild(gArrow);
      pathEl = s('path', { class: 'rz-path', d: '' }); svg.appendChild(pathEl);
      gCell = s('g'); svg.appendChild(gCell);
      gLabels = s('g'); svg.appendChild(gLabels);
      // head
      var hg = s('g', { class: 'rz-node rz-head-node' });
      for (var hl = 1; hl <= maxL; hl++) {
        var r = s('rect', { class: 'rz-cell is-head', x: -cellW / 2, y: Y(hl) - 15, width: cellW, height: 30, rx: 7 });
        hg.appendChild(r); headCells.push(r);
      }
      gCell.appendChild(hg);
      gLabels.appendChild(s('text', { class: 'rz-key rz-key--head', x: X(0), y: 40 + maxL * rowH + 20, 'text-anchor': 'middle' }, 'head'));
      hg.setAttribute('transform', 'translate(' + X(0) + ' 0)');
      head = hg;
      curEl = s('rect', { class: 'rz-ring rz-ring--cur', x: -cellW / 2 - 5, y: -20, width: cellW + 10, height: 40, rx: 11 });
      peekEl = s('rect', { class: 'rz-ring rz-ring--peek', x: -cellW / 2 - 5, y: -20, width: cellW + 10, height: 40, rx: 11 });
      svg.appendChild(peekEl); svg.appendChild(curEl);
      curRec = mv.add({ x: X(0), y: Y(1), op: 0 }, function (c) { curEl.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + f2(c.y) + ')'); curEl.style.opacity = c.op; });
      peekRec = mv.add({ x: X(0), y: Y(1), op: 0 }, function (c) { peekEl.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + f2(c.y) + ')'); peekEl.style.opacity = c.op; });
      targetText = s('text', { class: 'rz-readout rz-readout--l', x: PAD + 30, y: 22 });
      readout = s('text', { class: 'rz-readout', x: W - PAD, y: 22, 'text-anchor': 'end' });
      flipsG = s('g', { class: 'rz-flips' });
      svg.appendChild(targetText); svg.appendChild(readout); svg.appendChild(flipsG);
      stage.appendChild(svg);
    }

    function arrowRec(id, x1, x2, y, nul) {
      var line = s('path', { class: 'rz-arrow', d: '' }), headP = s('path', { class: 'rz-arrow__head', d: 'M-7 -4.5 L0 0 L-7 4.5 Z' }), bar = s('path', { class: 'rz-arrow__bar', d: 'M0 -6 L0 6' });
      var g = s('g', { class: 'rz-link' }, line, headP, bar);
      gArrow.appendChild(g);
      var a = { g: g, y: y, nul: nul, line: line, head: headP, bar: bar };
      a.rec = mv.add({ x1: x1, x2: x2, op: 0 }, function (c) {
        line.setAttribute('d', 'M' + f2(c.x1) + ' ' + y + ' L' + f2(c.x2) + ' ' + y);
        headP.setAttribute('transform', 'translate(' + f2(c.x2) + ' ' + y + ')');
        bar.setAttribute('transform', 'translate(' + f2(c.x2) + ' ' + y + ')');
        g.style.opacity = c.op;
      }, function () { g.remove(); });
      a.rec.cur.x1 = x1; a.rec.cur.x2 = x2;
      return a;
    }

    function nodeGroup(n, dur, first) {
      var g = s('g', { class: 'rz-node' }), cells = {};
      for (var l = 1; l <= maxL; l++) {
        var r = s('rect', { class: 'rz-cell', x: -cellW / 2, y: Y(l) - 15, width: cellW, height: 30, rx: 7 });
        g.appendChild(r); cells[l] = r;
      }
      var label = s('text', { class: 'rz-key', x: 0, y: 40 + maxL * rowH + 20, 'text-anchor': 'middle' }, String(n.key));
      g.appendChild(label);
      gCell.appendChild(g);
      var rec = mv.add({ x: 0, y: first ? 0 : -18, op: first ? 1 : 0 }, function (c) {
        g.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + f2(c.y) + ')'); g.style.opacity = c.op;
      }, function () { g.remove(); });
      return { g: g, cells: cells, label: label, rec: rec };
    }

    var api = {
      el: null,
      prepare: function (steps) {
        var L = 3, N = 6;
        steps.forEach(function (st) { if (st.levels > L) L = st.levels; if (st.nodes.length > N) N = st.nodes.length; });
        maxL = L; maxN = N; build(); api.el = svg;
      },
      render: function (step, opts) {
        var dur = opts && opts.duration || 0, first = !svg;
        if (!svg || step.levels > maxL || step.nodes.length > maxN) { var oldL = maxL, oldN = maxN; maxL = Math.max(maxL, step.levels); maxN = Math.max(maxN, step.nodes.length, oldN); build(); first = true; }
        svg.style.setProperty('--t', dur + 'ms');
        var rank = {}, present = {};
        step.nodes.forEach(function (n, i) { rank[n.key] = i + 1; present[n.key] = true; });
        function cx(key) { return key === null || key === undefined ? X(0) : X(rank[key]); }
        // nodes
        step.nodes.forEach(function (n) {
          var o = nodes[n.key];
          var fresh = !o;
          if (fresh) { o = nodes[n.key] = nodeGroup(n, dur, first); o.rec.cur.x = X(rank[n.key]); o.rec.cur.y = first ? 0 : -16; }
          o.rec.dead = false; o.rec.to.x = X(rank[n.key]); o.rec.to.y = 0; o.rec.to.op = 1;
          for (var l = 1; l <= maxL; l++) {
            var on = l <= n.h, pending = n.linked !== undefined && l > n.linked;
            o.cells[l].setAttribute('class', 'rz-cell is-' + n.state + (pending ? ' is-pending' : ''));
            o.cells[l].style.display = on ? '' : 'none';
          }
          o.label.setAttribute('class', 'rz-key is-' + n.state);
        });
        Object.keys(nodes).forEach(function (k) {
          if (!present[k]) { nodes[k].rec.dead = true; nodes[k].rec.to.op = 0; delete nodes[k]; }
        });
        for (var hl = 1; hl <= maxL; hl++) headCells[hl - 1].style.display = hl <= step.levels ? '' : 'none';
        // arrows
        var want = {};
        for (var l = 1; l <= step.levels; l++) {
          var chain = [{ key: null, x: X(0) }];
          step.nodes.forEach(function (n) { if (n.h >= l && (n.linked === undefined || n.linked >= l)) chain.push({ key: n.key, x: X(rank[n.key]) }); });
          for (var i = 0; i < chain.length; i++) {
            var a = chain[i], b = chain[i + 1], id = l + ':' + (a.key === null ? 'head' : a.key);
            var x1 = a.x + cellW / 2, x2 = b ? b.x - cellW / 2 - 1 : a.x + cellW / 2 + Math.min(20, colW * 0.4), nul = !b;
            want[id] = { x1: x1, x2: x2, nul: nul, level: l, from: a.key, to: b ? b.key : null };
          }
        }
        var onPath = {};
        var pp = step.path || [];
        for (var pi = 1; pi < pp.length; pi++) if (pp[pi].level === pp[pi - 1].level) onPath[pp[pi].level + ':' + (pp[pi - 1].key === null ? 'head' : pp[pi - 1].key)] = true;
        Object.keys(want).forEach(function (id) {
          var w = want[id], a = arrows[id];
          if (!a) { a = arrows[id] = arrowRec(id, w.x1, w.x2, Y(w.level), w.nul); a.rec.cur.op = 0; a.rec.cur.x1 = w.x1; a.rec.cur.x2 = w.x1; }
          a.rec.dead = false; a.rec.to.x1 = w.x1; a.rec.to.x2 = w.x2; a.rec.to.op = 1;
          a.g.setAttribute('class', 'rz-link' + (w.nul ? ' is-null' : '') + (onPath[id] ? ' is-path' : ''));
        });
        Object.keys(arrows).forEach(function (id) { if (!want[id]) { arrows[id].rec.dead = true; arrows[id].rec.to.op = 0; delete arrows[id]; } });
        // path
        var pts = pp.map(function (p) { return f2(cx(p.key)) + ' ' + f2(Y(p.level)); });
        pathEl.setAttribute('d', pts.length > 1 ? 'M' + pts.join(' L') : '');
        pathEl.style.opacity = step.kind === 'flip' || step.kind === 'link' || step.kind === 'place' ? 0.35 : 1;
        // markers
        if (step.cur && step.cur.level <= maxL) { curRec.to.x = cx(step.cur.key); curRec.to.y = Y(step.cur.level); curRec.to.op = 1; } else curRec.to.op = 0;
        if (step.peek) {
          var chainX;
          if (step.peek.key === null) {
            var last = null; step.nodes.forEach(function (n) { if (n.h >= step.peek.level) last = n; });
            chainX = (last ? X(rank[last.key]) : X(0)) + colW * 0.42;
          } else chainX = cx(step.peek.key);
          peekRec.to.x = chainX; peekRec.to.y = Y(step.peek.level); peekRec.to.op = 1;
          if (peekRec.cur.op < 0.3) { peekRec.cur.x = chainX; peekRec.cur.y = Y(step.peek.level); }
          peekEl.setAttribute('class', 'rz-ring rz-ring--peek' + (step.peek.go ? ' is-go' : ''));
        } else peekRec.to.op = 0;
        mv.go(dur);
        // readouts
        targetText.textContent = step.target === null ? '' : 'target ' + step.target;
        var c = step.counters;
        readout.textContent = 'comparisons ' + c.compares + '   ·   plain list would need ' + c.plain;
        V.clear(flipsG);
        if (step.flips && step.flips.length) {
          flipsG.appendChild(s('text', { class: 'rz-head', x: W - PAD - step.flips.length * 26 - 8, y: 46, 'text-anchor': 'end' }, 'COIN FLIPS'));
          step.flips.forEach(function (hd, i) {
            var gx = W - PAD - (step.flips.length - i) * 26 + 10;
            flipsG.appendChild(s('circle', { class: 'rz-coin ' + (hd ? 'is-heads' : 'is-tails'), cx: gx, cy: 42, r: 11 }));
            flipsG.appendChild(s('text', { class: 'rz-coin__t', x: gx, y: 43, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, hd ? 'H' : 'T'));
          });
        }
      }
    };
    return api;
  };

  /* ------------------------------------------------------------------ Bloom filter view */
  L38.bloomView = function (stage) {
    var W = 600, PAD = 18, svg, mv = L38.mover(), bits = [], arrowEls = [], chip, chipText, verdict, verdictText, built = '';
    var cw = 20, yBits = 176, H = 258, chipX = W / 2, chipY = 44, chipRec, idxEls = [];

    function bx(i, m) { var total = m * cw; return W / 2 - total / 2 + cw * (i + 0.5); }

    function build(m, k) {
      if (svg) svg.remove();
      mv = L38.mover(); bits = []; arrowEls = []; idxEls = [];
      cw = clamp((W - 2 * PAD) / m, 13, 26);
      built = m + ':' + k;
      svg = s('svg', { class: 'rz rz-bloom', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A Bloom filter: a row of ' + m + ' bits. Hash arrows from a word point at the bits it sets or checks.' });
      var gA = s('g'); svg.appendChild(gA);
      for (var j = 0; j < k; j++) {
        var p = s('path', { class: 'rz-harrow', d: '', pathLength: 1, 'stroke-dasharray': '1', 'stroke-dashoffset': 1 });
        var hd = s('path', { class: 'rz-harrow__head', d: 'M-5 -8 L0 0 L5 -8 Z' });
        var lab = s('text', { class: 'rz-hlabel', 'text-anchor': 'middle' }, 'h' + (j + 1));
        gA.appendChild(p); gA.appendChild(hd); gA.appendChild(lab);
        arrowEls.push({ p: p, head: hd, lab: lab, shown: false, bit: -1 });
      }
      var gb = s('g');
      for (var i = 0; i < m; i++) {
        var g = s('g', { class: 'rz-bit', transform: 'translate(' + f2(bx(i, m)) + ' ' + yBits + ')' },
          s('rect', { class: 'rz-bitbox', x: -cw / 2 + 1.2, y: -17, width: cw - 2.4, height: 34, rx: 5 }),
          s('text', { class: 'rz-bit__v', x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '0'));
        gb.appendChild(g);
        if (cw >= 22 || i % 4 === 0 || i === m - 1) gb.appendChild(s('text', { class: 'rz-idx' + (cw < 18 ? ' is-tiny' : ''), x: bx(i, m), y: yBits + 32, 'text-anchor': 'middle' }, String(i)));
        bits.push(g);
      }
      svg.appendChild(gb);
      gb.appendChild(s('text', { class: 'rz-head', x: W / 2 - m * cw / 2, y: yBits + 52 }, 'THE BIT ARRAY  ·  m = ' + m + ' bits, all this filter stores'));
      chip = s('g', { class: 'rz-wordchip' }, s('rect', { x: -70, y: -19, width: 140, height: 38, rx: 19 }), s('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ''));
      chipText = chip.querySelector('text');
      svg.appendChild(chip);
      chip.setAttribute('transform', 'translate(' + chipX + ' ' + chipY + ')');
      verdict = s('g', { class: 'rz-verdict' }, s('rect', { x: 0, y: -16, width: 170, height: 32, rx: 16 }), s('text', { x: 85, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ''));
      verdictText = verdict.querySelector('text');
      verdict.style.opacity = 0;
      svg.appendChild(verdict);
      stage.appendChild(svg);
    }

    var api = {
      el: null,
      prepare: function (steps) { if (steps && steps.length) { build(steps[0].m, steps[0].k); api.el = svg; } },
      render: function (step, opts) {
        var dur = opts && opts.duration || 0;
        if (!svg || built !== step.m + ':' + step.k) build(step.m, step.k);
        svg.style.setProperty('--t', dur + 'ms');
        bits.forEach(function (g, i) {
          var on = step.bits[i] === 1, st = step.bitStates[i];
          g.setAttribute('class', 'rz-bit' + (on ? ' is-on' : '') + (st ? ' is-' + st : ''));
          g.lastChild.textContent = on ? '1' : '0';
        });
        chipText.textContent = step.word === null ? '' : step.word;
        var wLen = Math.max(84, 26 + (step.word || '').length * 11);
        chip.firstChild.setAttribute('width', wLen); chip.firstChild.setAttribute('x', -wLen / 2);
        chip.style.opacity = step.word === null ? 0.25 : 1;
        var n = step.arrows.length;
        var order = step.arrows.map(function (a, i) { return { i: i, bit: a.bit }; }).sort(function (p, q) { return p.bit - q.bit || p.i - q.i; });
        var rankOf = {}; order.forEach(function (o, r) { rankOf[o.i] = r; });
        arrowEls.forEach(function (a, j) {
          var ar = step.arrows[j];
          if (!ar || !ar.show) {
            if (a.shown) { V.animate(a.p, { attr: { 'stroke-dashoffset': 1 } }, { duration: dur }); a.head.style.opacity = 0; a.lab.style.opacity = 0; a.shown = false; }
            return;
          }
          var x1 = chipX + (rankOf[j] - (n - 1) / 2) * 36, y1 = chipY + 20, x2 = bx(ar.bit, step.m), y2 = yBits - 19;
          var c1y = y1 + 34, c2y = y2 - 34;
          a.p.setAttribute('d', 'M' + f2(x1) + ' ' + y1 + ' C' + f2(x1) + ' ' + c1y + ' ' + f2(x2) + ' ' + c2y + ' ' + f2(x2) + ' ' + (y2 - 1));
          a.p.setAttribute('class', 'rz-harrow is-' + ar.state);
          a.head.setAttribute('transform', 'translate(' + f2(x2) + ' ' + (y2 + 2) + ')');
          a.head.setAttribute('class', 'rz-harrow__head is-' + ar.state);
          a.lab.setAttribute('x', f2(x1)); a.lab.setAttribute('y', y1 + 16);
          a.lab.textContent = 'h' + ar.n;
          if (!a.shown || a.bit !== ar.bit) {
            a.p.setAttribute('stroke-dashoffset', a.shown ? 0 : 1);
            V.animate(a.p, { attr: { 'stroke-dashoffset': 0 } }, { duration: dur ? dur * 1.1 : 0, delay: dur ? j * 90 : 0 });
          }
          a.head.style.opacity = 1; a.lab.style.opacity = 1;
          a.shown = true; a.bit = ar.bit;
        });
        var v = step.verdict;
        if (v) {
          var txt = v === 'no' ? 'DEFINITELY NOT' : v === 'maybe' ? 'MAYBE' : 'FALSE POSITIVE';
          var cls = v === 'no' ? 'is-done' : v === 'maybe' ? 'is-compare' : 'is-error';
          verdictText.textContent = txt;
          verdict.setAttribute('class', 'rz-verdict ' + cls);
          var vw = 24 + txt.length * 10.5;
          verdict.firstChild.setAttribute('width', vw); verdictText.setAttribute('x', vw / 2);
          verdict.setAttribute('transform', 'translate(' + (chipX + wLen / 2 + 22) + ' ' + chipY + ')');
          verdict.style.opacity = 1;
        } else verdict.style.opacity = 0;
      }
    };
    return api;
  };

  /* ------------------------------------------------------------------ heatmap of position probabilities */
  L38.heatmap = function (stage, opts) {
    opts = opts || {};
    var n = opts.n || 6, scale = opts.scale || 0.05, svg, cells = [], letters = 'ABCDEFGHIJKL';
    var CS = 48, LM = 34, TM = 34, BM = 64;
    function build() {
      if (svg) svg.remove();
      var W = LM + n * CS + 10, H = TM + n * CS + BM;
      svg = s('svg', { class: 'rz rz-heat', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'Heatmap: how often each item ends up in each position' });
      var defs = s('defs', {}, s('linearGradient', { id: 'hg' + V.uid(''), x1: 0, x2: 1, y1: 0, y2: 0 }));
      var gid = defs.firstChild.id;
      defs.firstChild.appendChild(s('stop', { offset: '0%', style: 'stop-color: var(--st-active)' }));
      defs.firstChild.appendChild(s('stop', { offset: '50%', style: 'stop-color: var(--el-fill)' }));
      defs.firstChild.appendChild(s('stop', { offset: '100%', style: 'stop-color: var(--st-path)' }));
      svg.appendChild(defs);
      svg.appendChild(s('text', { class: 'rz-head', x: LM + n * CS / 2, y: 14, 'text-anchor': 'middle' }, 'FINAL POSITION →'));
      cells = [];
      for (var c = 0; c < n; c++) svg.appendChild(s('text', { class: 'rz-idx', x: LM + c * CS + CS / 2, y: TM - 8, 'text-anchor': 'middle' }, String(c + 1)));
      for (var r = 0; r < n; r++) {
        svg.appendChild(s('text', { class: 'rz-idx rz-idx--row', x: LM - 8, y: TM + r * CS + CS / 2 + 4, 'text-anchor': 'end' }, letters[r]));
        var row = [];
        for (var c2 = 0; c2 < n; c2++) {
          var g = s('g', { class: 'rz-hcell', 'data-id': r + '-' + c2, 'data-label': 'Item ' + letters[r] + ' in position ' + (c2 + 1) },
            s('rect', { x: LM + c2 * CS + 1.5, y: TM + r * CS + 1.5, width: CS - 3, height: CS - 3, rx: 7 }),
            s('text', { x: LM + c2 * CS + CS / 2, y: TM + r * CS + CS / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '–'));
          svg.appendChild(g); row.push(g);
        }
        cells.push(row);
      }
      var by = TM + n * CS + 16, bw = Math.min(n * CS, 240), bx0 = LM + (n * CS - bw) / 2;
      svg.appendChild(s('rect', { class: 'rz-scale', x: bx0, y: by, width: bw, height: 10, rx: 5, fill: 'url(#' + gid + ')' }));
      svg.appendChild(s('text', { class: 'rz-idx', x: bx0, y: by + 24 }, 'rarer'));
      svg.appendChild(s('text', { class: 'rz-idx', x: bx0 + bw / 2, y: by + 44, 'text-anchor': 'middle' }, 'fair: 1/' + n));
      svg.appendChild(s('text', { class: 'rz-idx', x: bx0 + bw, y: by + 24, 'text-anchor': 'end' }, 'more likely'));
      stage.appendChild(svg);
    }
    build();
    function paint(probs, dur, exactText) {
      svg.style.setProperty('--t', (dur || 0) + 'ms');
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var g = cells[r][c], rect = g.firstChild, t = g.lastChild;
        if (!probs) { rect.style.fill = ''; t.textContent = '–'; g.setAttribute('class', 'rz-hcell is-empty'); continue; }
        var p = probs[r][c], d = p - 1 / n, a = Math.min(1, Math.abs(d) / scale);
        rect.style.fill = 'color-mix(in srgb, var(' + (d > 0 ? '--st-path' : '--st-active') + ') ' + Math.round(a * 54) + '%, var(--el-fill))';
        t.textContent = (p * 100).toFixed(1) + '%';
        g.setAttribute('class', 'rz-hcell' + (a > 0.55 ? ' is-strong' : ''));
      }
    }
    paint(null);
    return {
      el: null,
      n: n,
      render: function (probs, o) { paint(probs, o && o.duration); },
      setN: function (m) { n = m; build(); paint(null); return this; }
    };
  };
}());
