/* Lesson 08 · Linked lists — custom figures the renderer library does not cover.

     huntView(stage)          the scavenger-hunt analogy (steppable: walker, clue cards, revealed links)
     huntSteps()              its story, as snapshots
     memoryView(stage, opts)  nodes scattered over addressed memory cells; morphs into a box-and-arrow row
     rhoView(stage, opts)     Floyd's tortoise and hare on a rho-shaped list (tail + loop), tokens glide along arrows
     miniSvg(kind)            tiny static diagrams for the summary card

   Every figure builds its SVG once per input and then MOVES the same elements between steps
   (VDSA.animate / VDSA.tween / vz.Transition), so back, forward and scrub all animate or snap cleanly.
   Colours come from tokens via css/lessons/08-linked-lists.css. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var TAU = Math.PI * 2;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAngle(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * t;
  }
  function hex(n) { return '0x' + n.toString(16).toUpperCase(); }
  function arrowHead(x, y, ang, size) { return V.vz.arrowHead(x, y, ang, size || 8); }

  /* ================================================================== scavenger hunt */
  var HUNT = [
    { id: 'mailbox', name: 'Mailbox', clue: 'next: oak tree' },
    { id: 'oak', name: 'Oak tree', clue: 'next: bench' },
    { id: 'bench', name: 'Bench', clue: 'next: fountain' },
    { id: 'fountain', name: 'Fountain', clue: 'next: lamp post' },
    { id: 'lamp', name: 'Lamp post', clue: 'next: none, the end' }
  ];
  var HUNT_LAYOUT = {
    wide: { w: 780, h: 292, hand: [82, 150], spots: [[222, 84], [352, 206], [482, 84], [612, 206], [704, 84]], card: [[0, 52], [0, 52], [0, 52], [0, 52], [0, 52]], name: -38 },
    narrow: { w: 380, h: 580, hand: [92, 44], spots: [[272, 110], [112, 216], [272, 322], [112, 428], [272, 520]], card: [[0, 50], [0, 50], [0, 50], [0, 50], [-64, 50]], name: -36 }
  };
  function huntSteps() {
    var st = [];
    st.push({ at: -1, open: -1, caption: 'You start with one clue in your hand. It says the hunt begins at the <b>mailbox</b>. That first clue is the <b>head</b>: the only location you are given.' });
    var why = [
      'At the mailbox you find clue 2. It names the next spot, <b>the oak tree</b>, and nothing else. You could not have guessed it.',
      'The oak tree’s clue sends you to the <b>bench</b>. Notice the spots are not in a neat row: order lives only on the cards.',
      'The bench points to the <b>fountain</b>. To reach this fourth clue you had to read the first three: there is no shortcut.',
      'The fountain points to the <b>lamp post</b>.',
      'The lamp post’s card says “the end”. In a linked list that is <b>null</b>: no next node.'
    ];
    for (var k = 0; k < HUNT.length; k++) st.push({ at: k, open: k, caption: why[k] });
    st.push({ at: HUNT.length - 1, open: HUNT.length - 1, all: true, caption: 'Drawn as arrows it is a linked list: head → mailbox → oak → bench → fountain → lamp post → null. Rewrite one card and you change the route without moving a single spot.' });
    return st;
  }
  function huntIcon(id) {
    var g = s('g', { class: 'llh-icon-g' });
    function line(d) { g.appendChild(s('path', { class: 'llh-icon', d: d })); }
    if (id === 'mailbox') { line('M-9 -7 h18 v10 h-18 z'); line('M0 3 V13'); line('M9 -7 V-13 h5'); }
    else if (id === 'oak') { g.appendChild(s('circle', { class: 'llh-icon-fill', cx: 0, cy: -4, r: 9 })); line('M0 4 V13'); }
    else if (id === 'bench') { line('M-11 -5 H11'); line('M-11 2 H11'); line('M-9 2 V10'); line('M9 2 V10'); }
    else if (id === 'fountain') { line('M-12 6 Q0 15 12 6 Z'); line('M0 6 V-9'); line('M0 -9 Q-8 -9 -9 1'); line('M0 -9 Q8 -9 9 1'); }
    else { line('M0 -5 V13'); line('M-5 13 H5'); g.appendChild(s('rect', { class: 'llh-icon-fill', x: -5, y: -13, width: 10, height: 8, rx: 2 })); }
    return g;
  }
  function huntView(stage) {
    var svg = null, mode = null, els = null, last = null;
    function build(m) {
      V.clear(stage); mode = m;
      var Lo = HUNT_LAYOUT[m];
      svg = s('svg', { viewBox: '0 0 ' + Lo.w + ' ' + Lo.h, role: 'img', 'aria-label': 'Scavenger hunt map with five spots' });
      svg.style.maxWidth = (Lo.w * 1.12) + 'px';
      var links = s('g'), spots = s('g'), cards = s('g');
      svg.appendChild(links); svg.appendChild(spots); svg.appendChild(cards);
      els = { spots: [], cards: [], links: [], lo: Lo };
      var pts = [Lo.hand].concat(Lo.spots);
      for (var k = 0; k < HUNT.length; k++) {
        var a = pts[k], b = pts[k + 1];
        var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        var sx = a[0] + Math.cos(ang) * (k === 0 ? 50 : 30), sy = a[1] + Math.sin(ang) * (k === 0 ? 20 : 30);
        var ex = b[0] - Math.cos(ang) * 32, ey = b[1] - Math.sin(ang) * 32;
        var p = s('path', { class: 'llh-link', d: 'M' + sx + ' ' + sy + ' L' + (ex - Math.cos(ang) * 6) + ' ' + (ey - Math.sin(ang) * 6) });
        var hd = s('path', { class: 'llh-link-head', d: arrowHead(ex, ey, ang, 10) });
        var lg = s('g', {}, p, hd);
        V.place(lg, { opacity: 0 });
        links.appendChild(lg); els.links.push(lg);
      }
      HUNT.forEach(function (sp, k) {
        var x = Lo.spots[k][0], y = Lo.spots[k][1];
        var g = s('g', { class: 'llh-spot', transform: 'translate(' + x + ' ' + y + ')' },
          s('circle', { class: 'llh-disc', r: 25 }), huntIcon(sp.id),
          s('text', { class: 'llh-name', y: Lo.name }, sp.name));
        spots.appendChild(g); els.spots.push(g);
        var cx = x + Lo.card[k][0], cy = y + Lo.card[k][1];
        var w = 140;
        var t = s('text', { x: 0, y: 0 }, '?');
        var c = s('g', { class: 'llh-card', transform: 'translate(' + cx + ' ' + cy + ')' }, s('rect', { x: -w / 2, y: -15, width: w, height: 30, rx: 8 }), t);
        c.__text = t;
        cards.appendChild(c); els.cards.push(c);
      });
      var hand = s('g', { class: 'llh-hand', transform: 'translate(' + Lo.hand[0] + ' ' + Lo.hand[1] + ')' },
        s('rect', { x: -58, y: -24, width: 116, height: 48, rx: 10 }),
        s('text', { class: 'llh-hand-k', x: 0, y: -10 }, 'HEAD CLUE'),
        s('text', { x: 0, y: 9 }, 'start: mailbox'));
      svg.appendChild(hand);
      els.walker = s('g', { class: 'llh-walker' }, s('circle', { r: 13 }), s('text', {}, 'you'));
      svg.appendChild(els.walker);
      V.place(els.walker, { x: Lo.hand[0], y: Lo.hand[1] - 44 });
      stage.appendChild(svg);
    }
    function walkerPos(at) {
      var Lo = els.lo;
      if (at < 0) return { x: Lo.hand[0], y: Lo.hand[1] - 44 };
      return { x: Lo.spots[at][0] - 30, y: Lo.spots[at][1] - 22 };
    }
    function render(step, ctx) {
      last = step;
      var m = stage.clientWidth && stage.clientWidth < 560 ? 'narrow' : 'wide';
      if (!svg || m !== mode) { build(m); ctx = { duration: 0 }; }
      var d = ctx.duration || 0;
      svg.style.setProperty('--t', d + 'ms');
      els.spots.forEach(function (g, k) { g.setAttribute('class', 'llh-spot' + (k === step.at ? ' is-active' : k < step.at || (step.all && k <= step.at) ? ' is-visited' : '')); });
      if (step.all) els.spots[step.at].setAttribute('class', 'llh-spot is-visited');
      els.cards.forEach(function (c, k) {
        var open = k <= step.open;
        c.setAttribute('class', 'llh-card' + (open ? ' is-open' : '') + (open && k === HUNT.length - 1 ? ' is-end' : ''));
        c.__text.textContent = open ? HUNT[k].clue : '?';
      });
      els.links.forEach(function (g, k) { V.animate(g, { opacity: k <= step.at ? 1 : 0 }, { duration: d }); });
      var p = walkerPos(step.at);
      V.animate(els.walker, { x: p.x, y: p.y }, { duration: d, ease: 'inOut' });
    }
    V.onResize(stage, function () { if (last) { var m = stage.clientWidth < 560 ? 'narrow' : 'wide'; if (m !== mode) render(last, { duration: 0 }); } });
    return render;
  }

  /* ================================================================== scattered memory */
  var MEM_BASE = 0x100, MEM_CELLS = 24, CELL_BYTES = 8;
  function memoryView(stage, opts) {
    var vz = V.vz;
    var values = opts.values, N = values.length;
    var junkRng = V.rng(opts.seed || 11);
    var junk = [];
    for (var j = 0; j < MEM_CELLS; j++) junk.push(junkRng() < 0.35 ? '··' : ('0' + junkRng.int(0, 255).toString(16).toUpperCase()).slice(-2));
    var view = vz.createView(stage, 'llm', { label: opts.label || 'Linked list nodes in memory', duration: 700 }, draw);
    var ctx = view.ctx, api = view.api, tr = view.tr;
    ctx.svg.classList.add('llm');
    var gGrid = ctx.layer('grid'), gArrows = ctx.layer('arrows'), gNodes = ctx.layer('nodes'), gHead = ctx.layer('head');
    var cellEls = [], rowAddrEls = [];
    for (j = 0; j < MEM_CELLS; j++) {
      var r = vz.svg('rect', { rx: 4, ry: 4 }, gGrid), t = vz.svg('text', { class: 'llm-junk' }, gGrid);
      t.textContent = junk[j];
      cellEls.push({ r: r, t: t });
    }
    gGrid.classList.add('llm-grid');
    var recs = values.map(function (v, k) {
      var g = vz.svg('g', { class: 'llm-node', 'data-id': 'm' + k }, gNodes);
      var rec = {
        k: k, g: g,
        val: vz.svg('rect', { class: 'llm-val', rx: 5, ry: 5 }, g),
        nxt: vz.svg('rect', { class: 'llm-nxt', rx: 5, ry: 5 }, g),
        v: vz.svg('text', { class: 'llm-v' }, g),
        p: vz.svg('text', { class: 'llm-p' }, g),
        dot: vz.svg('circle', { class: 'llm-dot', r: 3.2 }, g),
        addr: vz.svg('text', { class: 'llm-addr' }, g),
        cur: null
      };
      rec.v.textContent = v;
      return rec;
    });
    var arrows = [];
    for (var k = 0; k <= N - 1; k++) {
      if (k === N - 1) break;
      var ag = vz.svg('g', { class: 'llm-arrow' }, gArrows);
      arrows.push({ from: k, to: k + 1, g: ag, halo: vz.svg('path', { class: 'llm-halo' }, ag), line: vz.svg('path', { class: 'llm-line' }, ag), head: vz.svg('path', { class: 'llm-head' }, ag) });
    }
    var hg = vz.svg('g', { class: 'llm-headvar' }, gHead);
    var hRect = vz.svg('rect', { rx: 7, ry: 7, height: 30, width: 124 }, hg);
    var hK = vz.svg('text', { class: 'llm-hk', x: 10, y: 15 }, hg); hK.textContent = 'head';
    var hV = vz.svg('text', { x: 52, y: 15 }, hg);
    var hA = { g: vz.svg('g', { class: 'llm-arrow' }, gArrows) };
    hA.halo = vz.svg('path', { class: 'llm-halo' }, hA.g); hA.line = vz.svg('path', { class: 'llm-line' }, hA.g); hA.head = vz.svg('path', { class: 'llm-head' }, hA.g);
    var mCur = 0, gridO = 1;

    function geometry(state) {
      var W = ctx.width, cols = W < 560 ? 4 : 8;
      var cw = Math.min(84, (W - 64 - 12) / cols), ch = 40, rowGap = 36, top = 58;
      var gutter = Math.max(12, (W - cols * cw) / 2 - 20);
      var rows = Math.ceil(MEM_CELLS / cols);
      var H = top + rows * (ch + rowGap) + 12;
      function cellXY(c) { return { x: gutter + (c % cols) * cw, y: top + Math.floor(c / cols) * (ch + rowGap) + rowGap }; }
      var mem = state.cells.map(function (c) { var p = cellXY(c); return { x: p.x, y: p.y, cw: cw }; });
      var gap = 26, pad = 14;
      var nw = Math.min(2 * 60, (W - 2 * pad - (N - 1) * gap) / N);
      var totalW = N * nw + (N - 1) * gap, x0 = (W - totalW) / 2;
      var ly = top + (H - top) / 2 - ch / 2;
      var list = values.map(function (_, i) { return { x: x0 + i * (nw + gap), y: ly, cw: nw / 2 }; });
      return { W: W, H: H, cols: cols, cw: cw, ch: ch, top: top, rowGap: rowGap, gutter: gutter, cellXY: cellXY, mem: mem, list: list };
    }
    var G = null;
    function paint() {
      var ch = G.ch;
      vz.set(gGrid, 'opacity', gridO > 0.995 ? null : gridO.toFixed(3));
      recs.forEach(function (rec) {
        var c = rec.cur, cw = c.cw;
        vz.set(rec.val, 'x', c.x); vz.set(rec.val, 'y', c.y); vz.set(rec.val, 'width', cw); vz.set(rec.val, 'height', ch);
        vz.set(rec.nxt, 'x', c.x + cw); vz.set(rec.nxt, 'y', c.y); vz.set(rec.nxt, 'width', cw); vz.set(rec.nxt, 'height', ch);
        vz.set(rec.v, 'x', c.x + cw / 2); vz.set(rec.v, 'y', c.y + ch / 2);
        vz.set(rec.p, 'x', c.x + 1.5 * cw); vz.set(rec.p, 'y', c.y + ch / 2 + (rec.k < N - 1 ? 9 : 0));
        var fs = Math.max(8, Math.min(10.5, cw * 0.17));
        vz.set(rec.p, 'font-size', fs.toFixed(1));
        var pO = rec.k < N - 1 ? Math.max(0, 1 - mCur * 1.6) : 1;
        vz.set(rec.p, 'opacity', pO > 0.995 ? null : pO.toFixed(2));
        vz.set(rec.dot, 'cx', c.x + 1.5 * cw); vz.set(rec.dot, 'cy', c.y + ch / 2 - (rec.k < N - 1 ? 7 * (1 - mCur) : 0));
        vz.set(rec.dot, 'opacity', rec.k < N - 1 ? null : '0');
        vz.set(rec.addr, 'x', c.x + cw / 2); vz.set(rec.addr, 'y', c.y - 6);
      });
      arrows.forEach(function (a) { route(a, recs[a.from].cur, recs[a.to].cur); });
      var h0 = recs[0].cur;
      var hx = G.gutter, hy = 12;
      vz.set(hg, 'transform', 'translate(' + hx + ' ' + hy + ')');
      var P0 = [hx + 124, hy + 15], P3 = [h0.x, h0.y + G.ch / 2];
      var mem1 = [P0[0] + 60, P0[1]], mem2 = [P3[0] - 60, P3[1] - 20];
      var lis1 = [P0[0] + 40, P0[1]], lis2 = [P3[0] - 40, P3[1] - 10];
      drawCurve(hA, P0, [lerp(mem1[0], lis1[0], mCur), lerp(mem1[1], lis1[1], mCur)], [lerp(mem2[0], lis2[0], mCur), lerp(mem2[1], lis2[1], mCur)], P3);
    }
    function route(a, s0, t0) {
      var ch = G.ch;
      var P0 = [s0.x + 1.5 * s0.cw, s0.y + ch / 2 - 7 * (1 - mCur)];
      var P3 = [t0.x, t0.y + ch / 2];
      var lift = ch / 2 + 16 + 6 * a.from, dx = Math.max(36, Math.min(90, Math.abs(P3[0] - P0[0]) * 0.35));
      var m1 = [P0[0] + 6, P0[1] - lift], m2 = [P3[0] - dx, P3[1] - (P3[1] < P0[1] ? -10 : 18)];
      var l1 = [P0[0] + 14, P0[1]], l2 = [P3[0] - 14, P3[1]];
      drawCurve(a, P0, [lerp(m1[0], l1[0], mCur), lerp(m1[1], l1[1], mCur)], [lerp(m2[0], l2[0], mCur), lerp(m2[1], l2[1], mCur)], P3);
    }
    function drawCurve(a, P0, P1, P2, P3) {
      var ang = Math.atan2(P3[1] - P2[1], P3[0] - P2[0]);
      var E = [P3[0] - Math.cos(ang) * 6, P3[1] - Math.sin(ang) * 6];
      var d = 'M' + P0[0].toFixed(1) + ' ' + P0[1].toFixed(1) + ' C' + P1[0].toFixed(1) + ' ' + P1[1].toFixed(1) + ' ' + P2[0].toFixed(1) + ' ' + P2[1].toFixed(1) + ' ' + E[0].toFixed(1) + ' ' + E[1].toFixed(1);
      vz.set(a.line, 'd', d); vz.set(a.halo, 'd', d);
      vz.set(a.head, 'd', arrowHead(P3[0], P3[1], ang, 8));
    }
    function draw(state, ms) {
      G = geometry(state);
      ctx.setHeight(G.H);
      for (var c = 0; c < MEM_CELLS; c++) {
        var p = G.cellXY(c);
        vz.set(cellEls[c].r, 'x', p.x + 1); vz.set(cellEls[c].r, 'y', p.y + 1); vz.set(cellEls[c].r, 'width', G.cw - 2); vz.set(cellEls[c].r, 'height', G.ch - 2);
        vz.set(cellEls[c].t, 'x', p.x + G.cw / 2); vz.set(cellEls[c].t, 'y', p.y + G.ch / 2);
      }
      var rows = Math.ceil(MEM_CELLS / G.cols);
      while (rowAddrEls.length < 8) { var tt = vz.svg('text', { class: 'llm-rowaddr' }, gGrid); rowAddrEls.push(tt); }
      rowAddrEls.forEach(function (el, r) {
        if (r < rows) { el.textContent = hex(MEM_BASE + r * G.cols * CELL_BYTES); vz.set(el, 'x', G.gutter + G.cols * G.cw + 8); vz.set(el, 'y', G.top + r * (G.ch + G.rowGap) + G.rowGap + G.ch / 2); vz.set(el, 'display', null); }
        else vz.set(el, 'display', 'none');
      });
      var addrOf = state.cells.map(function (cc) { return MEM_BASE + cc * CELL_BYTES; });
      recs.forEach(function (rec, k) {
        rec.addr.textContent = hex(addrOf[k]);
        rec.p.textContent = k < N - 1 ? hex(addrOf[k + 1]) : 'null';
        rec.g.setAttribute('data-label', 'Node holding ' + values[k] + ' at address ' + hex(addrOf[k]));
        vz.toggle(rec.g, 'is-hi', state.hi === k);
      });
      hV.textContent = '= ' + hex(addrOf[0]);
      var targets = state.mode === 'list' ? G.list : G.mem;
      var mTo = state.mode === 'list' ? 1 : 0, gTo = state.mode === 'list' ? 0 : 1;
      var from = recs.map(function (rec, k) { return rec.cur ? Object.assign({}, rec.cur) : Object.assign({}, targets[k]); });
      var mFrom = mCur, gFrom = gridO;
      tr.run(ms, function (t) {
        var e = vz.easeInOut ? vz.easeInOut(t) : t;
        recs.forEach(function (rec, k) {
          var f = from[k], to = targets[k], sk = k * 0.06, le = Math.max(0, Math.min(1, (t - sk) / (1 - 0.3))), ee = vz.easeInOut ? vz.easeInOut(le) : le;
          rec.cur = { x: lerp(f.x, to.x, ee), y: lerp(f.y, to.y, ee) - Math.sin(Math.PI * ee) * (state.mode === 'memory' && mFrom === 0 ? 26 : 0), cw: lerp(f.cw, to.cw, ee) };
        });
        mCur = lerp(mFrom, mTo, e); gridO = lerp(gFrom, gTo, e);
        paint();
      });
    }
    api.describe = function (state) {
      return 'List ' + values.join(' → ') + ' → null, stored at addresses ' + state.cells.map(function (c) { return hex(MEM_BASE + c * CELL_BYTES); }).join(', ') + '.';
    };
    api.addresses = function (state) { return state.cells.map(function (c) { return hex(MEM_BASE + c * CELL_BYTES); }); };
    api.randomCells = function (rng, avoid) {
      var slots = [];
      for (var c = 0; c < MEM_CELLS; c += 2) slots.push(c);
      for (var tries = 0; tries < 50; tries++) {
        var pick = V.shuffle(slots, rng).slice(0, N);
        var same = avoid ? pick.filter(function (p, i) { return p === avoid[i]; }).length : 0;
        var sorted = pick.slice().sort(function (a, b) { return a - b; });
        var inOrder = pick.every(function (p, i) { return p === sorted[i]; });
        if (same <= 1 && !inOrder) return pick;
      }
      return pick;
    };
    return api;
  }

  /* ================================================================== rho: tortoise and hare */
  function tortoiseGlyph() {
    var g = s('g', { class: 'llr-glyph' });
    g.appendChild(s('path', { class: 'llr-body', d: 'M-13 4 C-13 -10 11 -10 11 4 Z' }));
    g.appendChild(s('path', { class: 'llr-shell-line', d: 'M-6 3 L-3 -5 M4 3 L1 -5 M-9 -1 H8' }));
    g.appendChild(s('circle', { class: 'llr-body', cx: 15, cy: 0, r: 4.3 }));
    g.appendChild(s('circle', { class: 'llr-eye', cx: 16.4, cy: -0.9, r: 1.1 }));
    g.appendChild(s('rect', { class: 'llr-body', x: -11, y: 3, width: 5, height: 5.5, rx: 2 }));
    g.appendChild(s('rect', { class: 'llr-body', x: 4, y: 3, width: 5, height: 5.5, rx: 2 }));
    g.appendChild(s('path', { class: 'llr-body', d: 'M-13 2 L-17 4 L-13 5 Z' }));
    return g;
  }
  function hareGlyph() {
    var g = s('g', { class: 'llr-glyph' });
    g.appendChild(s('ellipse', { class: 'llr-body', cx: -2, cy: 2, rx: 11, ry: 6.5 }));
    g.appendChild(s('circle', { class: 'llr-body', cx: 9, cy: -4, r: 5.2 }));
    g.appendChild(s('ellipse', { class: 'llr-body', cx: 7, cy: -13, rx: 2.1, ry: 7, transform: 'rotate(-16 7 -13)' }));
    g.appendChild(s('ellipse', { class: 'llr-body', cx: 11.5, cy: -12.5, rx: 2.1, ry: 7, transform: 'rotate(14 11.5 -12.5)' }));
    g.appendChild(s('circle', { class: 'llr-eye', cx: 11, cy: -5, r: 1.1 }));
    g.appendChild(s('circle', { class: 'llr-body', cx: -13.5, cy: 0, r: 3 }));
    g.appendChild(s('rect', { class: 'llr-body', x: -9, y: 6, width: 8, height: 3.5, rx: 1.6 }));
    g.appendChild(s('rect', { class: 'llr-body', x: 3, y: 6, width: 6, height: 3.5, rx: 1.6 }));
    return g;
  }
  function rhoView(stage, opts) {
    opts = opts || {};
    var R_NODE = 17, GAP = 64, MARGIN = 48, DIST = R_NODE + 19, SPREAD = 0.72;
    var svg = null, key = null, geo = null, nodeEls = [], edgeEls = {}, tokens = {}, jump = null, tags = {}, center = null, centerSub = null;
    var tw = null, shown = { slow: null, fast: null }, facing = { slow: 1, fast: 1 };

    function layout(mu, lambda) {
      var N = mu + lambda, pos = [], ang = [];
      var R = lambda >= 2 ? Math.max(42, lambda * GAP / TAU) : 0;
      var x0 = MARGIN + R_NODE, xE = x0 + mu * GAP;
      var top = 64 + (lambda >= 2 ? R : 24), cy = top;
      for (var k = 0; k < mu; k++) { pos.push([x0 + k * GAP, cy]); ang.push(-Math.PI / 2); }
      var cx = xE + R;
      for (var j = 0; j < lambda; j++) {
        var th = Math.PI + TAU * j / lambda;
        if (lambda >= 2) pos.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
        else pos.push([xE, cy]);
        ang.push(j === 0 ? -Math.PI / 2 : th);
      }
      var nullPos = null, right;
      if (lambda === 0) { nullPos = [x0 + Math.max(0, mu) * GAP - (mu ? GAP * 0.25 : 0), cy]; right = nullPos[0] + 30 + MARGIN; }
      else if (lambda === 1) right = xE + R_NODE + 70 + MARGIN;
      else right = cx + R + R_NODE + MARGIN;
      var bottom = cy + Math.max(lambda >= 2 ? R + R_NODE + 44 : 0, R_NODE + 60);
      return { N: N, mu: mu, lambda: lambda, pos: pos, ang: ang, R: R, cx: cx, cy: cy, xE: xE, x0: x0, nullPos: nullPos, W: Math.max(right, 240), H: bottom };
    }
    function P(k) { return k === null ? geo.nullPos : geo.pos[k]; }
    function A(k) { return k === null ? -Math.PI / 2 : geo.ang[k]; }
    /* Points along the arrow from node a to node b (centre line), each with the token offset angle. */
    function hopPoints(a, b) {
      var pts = [], SAMP = 18, i;
      if (a === b && a !== null && geo.lambda === 1) {
        var p = geo.pos[a];
        for (i = 0; i <= SAMP; i++) {
          var t = i / SAMP, th = -Math.PI * 0.75 + TAU * t;
          pts.push({ x: p[0] + 34 + 34 * Math.cos(th + Math.PI), y: p[1] - 28 * Math.sin(th + Math.PI) * 0.9, a: -Math.PI / 2 });
        }
        pts[0] = { x: p[0], y: p[1], a: -Math.PI / 2 }; pts[pts.length - 1] = { x: p[0], y: p[1], a: -Math.PI / 2 };
        return pts;
      }
      var onLoop = a !== null && b !== null && geo.lambda >= 2 && a >= geo.mu && b >= geo.mu;
      if (onLoop) {
        var ja = a - geo.mu, jb = b - geo.mu;
        var t0 = Math.PI + TAU * ja / geo.lambda, t1 = Math.PI + TAU * (ja + 1) / geo.lambda;
        void jb;
        for (i = 0; i <= SAMP; i++) {
          var tt = lerp(t0, t1, i / SAMP);
          pts.push({ x: geo.cx + geo.R * Math.cos(tt), y: geo.cy + geo.R * Math.sin(tt), a: lerpAngle(A(a), A(b), i / SAMP) });
        }
        return pts;
      }
      var pa = P(a), pb = P(b);
      for (i = 0; i <= SAMP; i++) { var u = i / SAMP; pts.push({ x: lerp(pa[0], pb[0], u), y: lerp(pa[1], pb[1], u), a: lerpAngle(A(a), A(b), u) }); }
      return pts;
    }
    function pathPoints(path) {
      var out = [];
      for (var i = 0; i + 1 < path.length; i++) { var seg = hopPoints(path[i], path[i + 1]); if (out.length) seg.shift(); out = out.concat(seg); }
      return out;
    }
    function jumpPoints(a, b) {
      var pa = P(a), pb = P(b), top = Math.min(pa[1], pb[1]) - 70 - (geo.R || 0) * 0.3, pts = [];
      for (var i = 0; i <= 24; i++) {
        var u = i / 24, x = (1 - u) * (1 - u) * pa[0] + 2 * (1 - u) * u * ((pa[0] + pb[0]) / 2) + u * u * pb[0];
        var y = (1 - u) * (1 - u) * pa[1] + 2 * (1 - u) * u * top + u * u * pb[1];
        pts.push({ x: x, y: y, a: lerpAngle(A(a), A(b), u) });
      }
      return pts;
    }
    function samplePath(pts, f) {
      if (pts.length === 1) return pts[0];
      var L = [0];
      for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      var target = f * L[L.length - 1];
      for (i = 1; i < pts.length; i++) {
        if (L[i] >= target || i === pts.length - 1) {
          var seg = L[i] - L[i - 1], u = seg ? (target - L[i - 1]) / seg : 0;
          return { x: lerp(pts[i - 1].x, pts[i].x, u), y: lerp(pts[i - 1].y, pts[i].y, u), a: lerpAngle(pts[i - 1].a, pts[i].a, u), dx: pts[i].x - pts[i - 1].x };
        }
      }
      return pts[pts.length - 1];
    }
    function tokenXY(pt, who) {
      var off = who === 'slow' ? -SPREAD : SPREAD;
      return { x: pt.x + DIST * Math.cos(pt.a + off), y: pt.y + DIST * Math.sin(pt.a + off) };
    }
    function placeToken(who, pt) {
      var q = tokenXY(pt, who);
      if (pt.dx !== undefined && Math.abs(pt.dx) > 0.3) facing[who] = pt.dx < 0 ? -1 : 1;
      tokens[who].setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')');
      tokens[who].__glyph.setAttribute('transform', facing[who] < 0 ? 'scale(-1 1)' : '');
    }
    function nodePoint(k) { var p = P(k); return { x: p[0], y: p[1], a: A(k) }; }

    function build(step) {
      V.clear(stage);
      geo = layout(step.mu, step.lambda);
      key = step.mu + ':' + step.lambda;
      svg = s('svg', { class: 'llr', viewBox: '0 0 ' + geo.W.toFixed(0) + ' ' + geo.H.toFixed(0), role: 'img',
        'aria-label': opts.label || ('List with a tail of ' + step.mu + ' nodes and a loop of ' + step.lambda + ' nodes') });
      svg.style.maxWidth = Math.round(geo.W * 1.45) + 'px';
      svg.style.minWidth = Math.round(Math.min(geo.W * 0.64, 700)) + 'px';
      var gEdges = s('g'), gNodes = s('g'), gLabels = s('g'), gTok = s('g');
      [gLabels, gEdges, gNodes, gTok].forEach(function (g) { svg.appendChild(g); });
      edgeEls = {};
      var nx = step.next;
      for (var k = 0; k < geo.N; k++) {
        var b = nx[k], pts;
        if (b === null) pts = hopPoints(k, null);
        else pts = hopPoints(k, b);
        var trimmed = trimPath(pts, R_NODE + 1, b === null ? 14 : R_NODE + 2);
        var d = 'M' + trimmed.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L');
        var e = trimmed[trimmed.length - 1], e0 = trimmed[trimmed.length - 2] || trimmed[0];
        var ang = Math.atan2(e.y - e0.y, e.x - e0.x);
        var ex = e.x + Math.cos(ang) * 1, ey = e.y + Math.sin(ang) * 1;
        var g = s('g', { class: 'llr-e' }, s('path', { class: 'llr-edge', d: d }), s('path', { class: 'llr-head', d: arrowHead(ex, ey, ang, 8) }));
        gEdges.appendChild(g);
        edgeEls[k + '>' + b] = g;
      }
      if (geo.nullPos) gLabels.appendChild(s('text', { class: 'llr-null', x: geo.nullPos[0] + 10, y: geo.nullPos[1] }, 'null'));
      nodeEls = [];
      for (k = 0; k < geo.N; k++) {
        var p = geo.pos[k];
        var ng = s('g', { class: 'llr-node' + (k >= geo.mu && geo.lambda ? ' is-loop' : ''), transform: 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')', 'data-id': String(k), 'data-label': 'Node ' + k },
          s('circle', { r: R_NODE }), s('text', {}, String(k)));
        gNodes.appendChild(ng); nodeEls.push(ng);
      }
      // distance labels
      var by = geo.cy + R_NODE + 16;
      if (geo.mu > 0 && geo.lambda > 0) {
        gLabels.appendChild(s('path', { class: 'llr-brace', d: 'M' + geo.x0 + ' ' + (by - 5) + ' V' + by + ' H' + geo.xE + ' V' + (by - 5) }));
        var tl = s('text', { class: 'llr-dist', x: (geo.x0 + geo.xE) / 2, y: by + 17 });
        tl.appendChild(s('tspan', { class: 'llr-sym' }, 'μ')); tl.appendChild(document.createTextNode(' = ' + geo.mu + ' to the loop'));
        gLabels.appendChild(tl);
      }
      if (geo.lambda >= 3) {
        center = s('text', { class: 'llr-dist', x: geo.cx, y: geo.cy - 2 });
        center.appendChild(s('tspan', { class: 'llr-sym' }, 'λ')); center.appendChild(document.createTextNode(' = ' + geo.lambda));
        centerSub = s('text', { class: 'llr-center', x: geo.cx, y: geo.cy + 15 }, 'loop');
        gLabels.appendChild(center); gLabels.appendChild(centerSub);
      } else if (geo.lambda > 0) {
        var ll = s('text', { class: 'llr-dist', x: geo.xE + (geo.lambda === 2 ? geo.R : 24), y: geo.lambda === 2 ? geo.cy + 5 : geo.cy + R_NODE + 34 });
        ll.appendChild(s('tspan', { class: 'llr-sym' }, 'λ')); ll.appendChild(document.createTextNode(' = ' + geo.lambda + (geo.lambda === 1 ? ' (self-loop)' : '')));
        gLabels.appendChild(ll);
        centerSub = null; center = null;
      } else { center = null; centerSub = null; }
      if (geo.mu === 0 && geo.lambda > 0) {
        gLabels.appendChild(s('text', { class: 'llr-center', x: geo.xE, y: geo.cy + R_NODE + 50 + (geo.lambda === 1 ? 14 : 0), 'text-anchor': 'middle' }, 'μ = 0: the loop starts at the head'));
      }
      tags = {};
      ['meet', 'entry'].forEach(function (nm) {
        var tg = s('g', { class: 'llr-tag' + (nm === 'entry' ? ' is-found' : '') }, s('rect', { x: -22, y: -9, width: 44, height: 18, rx: 9 }), s('text', {}, nm));
        tg.setAttribute('opacity', '0');
        gLabels.appendChild(tg); tags[nm] = tg;
      });
      jump = s('path', { class: 'llr-jump', d: '' });
      jump.setAttribute('opacity', '0');
      gTok.appendChild(jump);
      tokens = {};
      [['slow', tortoiseGlyph(), 'slow'], ['fast', hareGlyph(), 'fast']].forEach(function (t) {
        var g = s('g', { class: 'llr-token llr-' + t[0] }, t[1], s('text', { class: 'llr-lbl', y: 21 }, t[2]));
        g.__glyph = t[1];
        gTok.appendChild(g); tokens[t[0]] = g;
      });
      shown = { slow: null, fast: null };
      stage.appendChild(svg);
    }
    function trimPath(pts, a, b) {
      // drop points within a of the start and b of the end
      var p0 = pts[0], p1 = pts[pts.length - 1];
      var out = pts.filter(function (p) { return Math.hypot(p.x - p0.x, p.y - p0.y) >= a && Math.hypot(p.x - p1.x, p.y - p1.y) >= b; });
      if (out.length < 2) {
        var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        out = [{ x: p0.x + Math.cos(ang) * a, y: p0.y + Math.sin(ang) * a }, { x: p1.x - Math.cos(ang) * b, y: p1.y - Math.sin(ang) * b }];
      }
      return out;
    }
    function tagPlace(tg, k) {
      if (k === null || k === undefined) { tg.setAttribute('opacity', '0'); return; }
      var p = geo.pos[k], a = geo.ang[k];
      var inward = a + Math.PI, dx = Math.cos(inward), dy = Math.sin(inward);
      var x = p[0] + dx * (R_NODE + 16), y = p[1] + dy * (R_NODE + 14);
      if (k < geo.mu || k === geo.mu) { x = p[0]; y = p[1] + R_NODE + 16; }
      tg.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      tg.setAttribute('opacity', '1');
    }
    function render(step, ctx) {
      ctx = ctx || { duration: 0 };
      if (!svg || key !== step.mu + ':' + step.lambda || !step.n) {
        if (!step.n) { V.clear(stage); svg = null; key = null; stage.appendChild(V.h('p', { class: 'muted' }, 'Empty list: head is null.')); return; }
        build(step);
        ctx = { duration: 0 };
      }
      var d = ctx.duration || 0;
      svg.style.setProperty('--t', d + 'ms');
      var trail = {};
      (step.trail || []).forEach(function (t) { trail[t] = true; });
      Object.keys(edgeEls).forEach(function (k) { edgeEls[k].setAttribute('class', 'llr-e' + (trail[k] ? ' is-path' : '')); });
      nodeEls.forEach(function (g, k) {
        var cls = 'llr-node' + (k >= geo.mu && geo.lambda ? ' is-loop' : '');
        if (step.entry === k) cls += ' is-found';
        else if (step.meet === k && step.phase === 1) cls += ' is-pivot';
        g.setAttribute('class', cls);
      });
      tagPlace(tags.meet, step.meet !== null && step.kind === 'meet' ? step.meet : (step.meet !== null && step.phase === 2 && step.entry === null ? step.meet : null));
      tagPlace(tags.entry, step.entry);
      if (tags.meet && step.meet !== null && step.entry !== null && step.meet === step.entry) tags.meet.setAttribute('opacity', '0');
      if (centerSub) centerSub.textContent = step.meet !== null && step.phase === 1 && step.kind === 'meet' ? 'met ' + ((step.meet - step.mu + step.lambda) % step.lambda) + ' past the entry' : 'loop';
      // tokens
      if (tw) { tw.cancel(); tw = null; }
      var prev = ctx.prev;
      var sPts = null, fPts = null;
      if (d > 0 && prev && ctx.direction === 1 && step.sPath) {
        sPts = step.sPath === 'jump' ? jumpPoints(step.jumpFrom, step.slow) : pathPoints(step.sPath);
        fPts = step.fPath ? pathPoints(step.fPath) : [nodePoint(step.fast)];
      } else if (d > 0 && prev && ctx.direction === -1 && prev.sPath) {
        sPts = prev.sPath === 'jump' ? jumpPoints(prev.slow, prev.jumpFrom) : pathPoints(prev.sPath.slice().reverse());
        fPts = prev.fPath ? pathPoints(prev.fPath.slice().reverse()) : [nodePoint(step.fast)];
      }
      var showJump = step.sPath === 'jump' || (ctx.direction === -1 && prev && prev.sPath === 'jump');
      if (showJump) {
        var jp = step.sPath === 'jump' ? jumpPoints(step.jumpFrom, step.slow) : jumpPoints(prev.slow, prev.jumpFrom);
        jump.setAttribute('d', 'M' + jp.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L'));
      }
      jump.setAttribute('opacity', step.sPath === 'jump' ? '0.9' : '0');
      if (!sPts || !fPts) {
        placeToken('slow', nodePoint(step.slow)); placeToken('fast', nodePoint(step.fast));
      } else {
        tw = V.tween(d, function (t, e) { placeToken('slow', samplePath(sPts, e)); placeToken('fast', samplePath(fPts, e)); }, { ease: 'inOut' });
      }
      shown.slow = step.slow; shown.fast = step.fast;
    }
    return { render: render, el: function () { return svg; }, nodes: function () { return nodeEls; } };
  }

  /* ================================================================== summary mini diagrams */
  function miniSvg(kind) {
    var svg = s('svg', { class: 'llmini', viewBox: '0 0 220 96', role: 'img' });
    function node(x, y, v, cls) {
      var g = s('g', { class: 'n' + (cls ? ' is-' + cls : '') },
        s('rect', { x: x, y: y, width: 40, height: 24, rx: 5 }), s('line', { x1: x + 27, x2: x + 27, y1: y, y2: y + 24 }),
        s('text', { x: x + 13.5, y: y + 12.5 }, String(v)), s('circle', { cx: x + 33.5, cy: y + 12, r: 2.4 }));
      svg.appendChild(g);
    }
    function arr(x1, y1, x2, y2, cls, bend) {
      var ang, d;
      if (bend) { var mx = (x1 + x2) / 2, my = Math.min(y1, y2) + bend; d = 'M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2; ang = Math.atan2(y2 - my, x2 - mx); }
      else { d = 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2; ang = Math.atan2(y2 - y1, x2 - x1); }
      svg.appendChild(s('path', { class: 'a' + (cls ? ' is-' + cls : ''), d: d }));
      svg.appendChild(s('path', { class: 'ah' + (cls ? ' is-' + cls : ''), d: arrowHead(x2, y2, ang, 6.5) }));
    }
    function chip(x, y, t, cls) {
      var w = t.length * 6.2 + 12;
      svg.appendChild(s('g', { class: 'chip' + (cls ? ' is-' + cls : '') }, s('rect', { x: x - w / 2, y: y - 8, width: w, height: 16, rx: 8 }), s('text', { x: x, y: y + 0.5 }, t)));
    }
    function num(x, y, n) { svg.appendChild(s('g', { class: 'num' }, s('circle', { cx: x, cy: y, r: 7 }), s('text', { x: x, y: y + 0.5 }, String(n)))); }
    function lbl(x, y, t) { svg.appendChild(s('text', { class: 'lbl', x: x, y: y }, t)); }
    if (kind === 'node') {
      node(70, 36, 7); lbl(83.5, 30, 'value'); lbl(110, 30, 'next');
      arr(103.5, 48, 150, 48); lbl(170, 52, 'null');
      chip(40, 48, 'head'); arr(56, 48, 69, 48);
    } else if (kind === 'walk') {
      [4, 7, 9, 12].forEach(function (v, i) { node(8 + i * 52, 44, v, i === 3 ? 'active' : i < 3 ? 'visited' : null); if (i < 3) arr(41.5 + i * 52, 56, 59 + i * 52, 56); });
      chip(170, 26, 'curr', 'active'); arr(170, 34, 170, 43);
      lbl(110, 90, '3 hops to reach index 3');
    } else if (kind === 'splice') {
      node(20, 58, 7); node(150, 58, 9); node(86, 10, 8, 'key');
      arr(53.5, 70, 148, 70, null); svg.lastChild.previousSibling.setAttribute('stroke-dasharray', '3 3');
      arr(119.5, 22, 150, 57, 'swap'); num(142, 36, 1);
      arr(53.5, 66, 85, 30, 'swap'); num(60, 40, 2);
    } else if (kind === 'bypass') {
      node(8, 50, 4); node(88, 50, 9, 'muted'); node(168, 50, 12);
      arr(41.5, 58, 167, 58, 'swap', -44); arr(121.5, 62, 167, 62);
      lbl(108, 92, 'prev.next = prev.next.next');
    } else if (kind === 'reverse') {
      [1, 2, 3, 4].forEach(function (v, i) { node(8 + i * 52, 44, v, i < 2 ? 'visited' : i === 2 ? 'active' : null); });
      arr(60 + 33.5 - 52, 64, 8 + 20, 69, 'visited', 26);
      arr(112 + 33.5 - 52, 64, 60 + 20, 69, 'visited', 26);
      arr(145.5, 56, 163, 56);
      chip(80, 26, 'prev', 'visited'); chip(132, 26, 'curr', 'active'); chip(184, 26, 'next', 'compare');
    } else if (kind === 'rho') {
      var cx = 150, cy = 50, R = 30;
      svg.appendChild(s('circle', { class: 'ring', cx: cx, cy: cy, r: R }));
      [[40, 50], [80, 50]].forEach(function (p) { svg.appendChild(s('circle', { class: 'dotn', cx: p[0], cy: p[1], r: 8 })); });
      arr(49, 50, 70, 50); arr(89, 50, 111, 50);
      for (var j = 0; j < 5; j++) { var th = Math.PI + TAU * j / 5; svg.appendChild(s('circle', { class: 'dotn', cx: cx + R * Math.cos(th), cy: cy + R * Math.sin(th), r: 8 })); }
      svg.appendChild(s('circle', { class: 'tok-s', cx: cx + R * Math.cos(Math.PI + TAU * 3 / 5), cy: cy + R * Math.sin(Math.PI + TAU * 3 / 5) - 14, r: 5 }));
      svg.appendChild(s('circle', { class: 'tok-f', cx: cx + R * Math.cos(Math.PI + TAU * 3 / 5) + 10, cy: cy + R * Math.sin(Math.PI + TAU * 3 / 5) - 12, r: 5 }));
      lbl(60, 80, 'μ'); lbl(150, 54, 'λ');
    }
    return svg;
  }

  V.lessons = V.lessons || {};
  V.lessons.ll08figs = { huntView: huntView, huntSteps: huntSteps, memoryView: memoryView, rhoView: rhoView, miniSvg: miniSvg, MEM_BASE: MEM_BASE };
}());
