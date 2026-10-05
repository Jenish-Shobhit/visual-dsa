/* Lesson 10 — shared helpers and custom views.
   Loaded before the figure scripts (js/lessons/10-queues-figs.js, -labs.js) and js/lessons/10-queues.js.

     L10.whenNear(el, fn)          run fn once when el comes within ~700px of the viewport (lazy figures)
     L10.ticketLine(stage, opts)   a line of people at a ticket window: view with render(step, {duration})
     L10.slotRow(host, opts)       a static row of numbered slots whose slots carry data-id (click quiz)
     L10.tiles                     tiny static SVG pictures for the summary card
     L10.opsInput(el, opts)        an operations input row (numbers enqueue, d dequeues) with presets
     L10.chip(text, state)         small status pill for figures */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L10 = V.lessons = V.lessons || {};
  L10 = V.lessons.l10 = V.lessons.l10 || {};

  L10.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };

  /* ------------------------------------------------------------------ lazy init */
  L10.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 10] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ ticket line */
  /* snapshot: {line: [{id, n}], serving: id | null}. People join at the right and are served at the left window. */
  L10.ticketLine = function (stage, opts) {
    opts = opts || {};
    var narrow = (stage.clientWidth || 999) < 480;   /* phones: a tighter line so the picture is not shrunk to half size */
    var W = narrow ? 430 : 600, H = opts.height || 230, GROUND = H - 46, X0 = narrow ? 156 : 190, STEP = narrow ? 36 : 52, MAXV = 8;
    V.clear(stage);
    var svg = s('svg', { class: 'l10-tl' + (narrow ? ' is-narrow' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'A line of people waiting at a ticket window' });
    var booth = s('g', { class: 'l10-booth' },
      s('rect', { class: 'l10-booth__wall', x: 6, y: GROUND - 132, width: 122, height: 132, rx: 14 }),
      s('rect', { class: 'l10-booth__window', x: 22, y: GROUND - 96, width: 90, height: 50, rx: 8 }),
      s('rect', { class: 'l10-booth__shelf', x: 14, y: GROUND - 48, width: 106, height: 9, rx: 4 }),
      s('rect', { class: 'l10-booth__sign', x: 6, y: GROUND - 178, width: 122, height: 38, rx: 10 }));
    var signSmall = s('text', { class: 'l10-booth__small', x: 67, y: GROUND - 162, 'text-anchor': 'middle' }, 'NOW SERVING');
    var signNum = s('text', { class: 'l10-booth__num', x: 67, y: GROUND - 145, 'text-anchor': 'middle' }, '–');
    var ground = s('line', { class: 'l10-ground', x1: 0, x2: W, y1: GROUND, y2: GROUND });
    var front = s('g', { class: 'l10-tag l10-tag--front' }, s('rect', { x: -26, y: -13, width: 52, height: 22, rx: 11 }), s('text', { x: 0, y: 3, 'text-anchor': 'middle' }, 'front'), s('path', { d: 'M-5 9 L5 9 L0 16 Z' }));
    var back = s('g', { class: 'l10-tag l10-tag--back' }, s('path', { d: 'M-5 -9 L5 -9 L0 -16 Z' }), s('rect', { x: -22, y: -9, width: 44, height: 22, rx: 11 }), s('text', { x: 0, y: 7, 'text-anchor': 'middle' }, 'back'));
    var hint = s('text', { class: 'l10-hint', x: W - 6, y: H - 8, 'text-anchor': 'end' }, 'new arrivals join here →');
    svg.appendChild(booth); svg.appendChild(signSmall); svg.appendChild(signNum); svg.appendChild(ground); svg.appendChild(hint);
    svg.appendChild(front); svg.appendChild(back);
    V.place(front, { x: X0, y: GROUND - 82, opacity: 0 });
    V.place(back, { x: X0, y: GROUND + 20, opacity: 0 });
    stage.appendChild(svg);
    var people = {};
    function slotX(i) { return X0 + i * STEP; }
    function person(p) {
      var g = s('g', { class: 'l10-p is-c' + (p.n % 6) },
        s('circle', { class: 'l10-p__head', cx: 0, cy: -46, r: 12 }),
        s('rect', { class: 'l10-p__body', x: -16, y: -32, width: 32, height: 34, rx: 13 }),
        s('text', { class: 'l10-p__num', x: 0, y: -10, 'text-anchor': 'middle' }, String(p.n)));
      svg.insertBefore(g, front);
      var rec = { g: g, n: p.n, x: slotX(MAXV) + 40 };
      V.place(g, { x: rec.x, y: GROUND, opacity: 0 });
      return rec;
    }
    function render(step, ctx) {
      var d = ctx && ctx.duration !== undefined ? ctx.duration : 400;
      var idx = {};
      step.line.forEach(function (p, i) { idx[p.id] = i; });
      Object.keys(people).forEach(function (id) {
        if (id in idx) return;
        var rec = people[id]; delete people[id];
        var served = step.serving === id;
        if (served) signNum.textContent = '#' + rec.n;
        if (d <= 0) { rec.g.remove(); return; }
        V.animate(rec.g, served ? { x: 66, opacity: 0 } : { opacity: 0 }, { duration: d, ease: 'inOut' }).then(function () { rec.g.remove(); });
      });
      step.line.forEach(function (p, i) {
        var rec = people[p.id];
        if (!rec) { rec = people[p.id] = person(p); }
        rec.x = slotX(i);
        V.animate(rec.g, { x: rec.x, y: GROUND, opacity: 1 }, { duration: d, ease: 'out' });
      });
      if (step.nowServing !== undefined) signNum.textContent = step.nowServing === null ? '–' : '#' + step.nowServing;
      var n = step.line.length;
      V.animate(front, { x: slotX(0), opacity: n ? 1 : 0 }, { duration: d, ease: 'out' });
      V.animate(back, { x: slotX(Math.max(0, n - 1)), opacity: n ? 1 : 0 }, { duration: d, ease: 'out' });
      svg.setAttribute('aria-label', (opts.label || 'A line of people at a ticket window') + '. ' + (n ? n + ' waiting: ' + step.line.map(function (p) { return '#' + p.n; }).join(', ') + ', front first.' : 'Nobody is waiting.'));
    }
    return { render: render, el: svg, reset: function () { Object.keys(people).forEach(function (id) { people[id].g.remove(); }); people = {}; signNum.textContent = '–'; } };
  };

  /* ------------------------------------------------------------------ slot row (click quiz) */
  /* opts: {cap, head, values: {slot: value}, label}. Each slot is a <g data-id="slot-i">. */
  L10.slotRow = function (host, opts) {
    var cap = opts.cap, S = 52, PAD = 20, TOP = 34, W = PAD * 2 + cap * S, H = 130;
    V.clear(host);
    var svg = s('svg', { class: 'l10-slots', viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': opts.label || 'Ring buffer slots' });
    svg.style.maxWidth = (W * 1.2) + 'px';
    for (var i = 0; i < cap; i++) {
      var v = opts.values[i];
      var g = s('g', { class: 'l10-slot' + (v === undefined ? ' is-free' : ' is-filled'), 'data-id': 'slot-' + i, 'data-label': 'Slot ' + i + (v === undefined ? ', empty' : ', holds ' + v) },
        s('rect', { x: PAD + i * S + 3, y: TOP, width: S - 6, height: S - 6, rx: 9 }),
        s('text', { class: 'l10-slot__v', x: PAD + i * S + S / 2, y: TOP + (S - 6) / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, v === undefined ? '' : String(v)),
        s('text', { class: 'l10-slot__i', x: PAD + i * S + S / 2, y: TOP + S + 12, 'text-anchor': 'middle' }, String(i)));
      svg.appendChild(g);
    }
    if (opts.head !== undefined) {
      var hx = PAD + opts.head * S + S / 2;
      svg.appendChild(s('g', { class: 'l10-slot__ptr', transform: 'translate(' + hx + ',' + (TOP - 8) + ')' }, s('path', { d: 'M0 0 L-6 -9 L6 -9 Z' }), s('text', { y: -13, 'text-anchor': 'middle' }, 'head')));
    }
    host.appendChild(svg);
    return svg;
  };

  /* ------------------------------------------------------------------ summary tiles (tiny static pictures) */
  L10.tiles = {
    queue: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      for (var i = 0; i < 4; i++) g.appendChild(s('rect', { class: 'l10-tile__box' + (i === 0 ? ' is-front' : i === 3 ? ' is-rear' : ''), x: 22 + i * 24, y: 22, width: 21, height: 21, rx: 5 }));
      g.appendChild(s('path', { class: 'l10-tile__arrow', d: 'M4 32 H16 M12 28 L16 32 L12 36' }));
      g.appendChild(s('path', { class: 'l10-tile__arrow is-in', d: 'M126 32 H114 M118 28 L114 32 L118 36' }));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 32, y: 60, 'text-anchor': 'middle' }, 'front'));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 104, y: 60, 'text-anchor': 'middle' }, 'rear'));
      return g;
    },
    ring: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      var cx = 65, cy = 36, R = 26;
      for (var i = 0; i < 8; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 4;
        var live = i === 5 || i === 6 || i === 7 || i === 0;
        g.appendChild(s('circle', { class: 'l10-tile__dot' + (live ? ' is-live' : ''), cx: cx + Math.cos(a) * R, cy: cy + Math.sin(a) * R, r: 7.5 }));
      }
      g.appendChild(s('text', { class: 'l10-tile__t', x: cx, y: cy + 4, 'text-anchor': 'middle' }, 'mod C'));
      return g;
    },
    deque: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      for (var i = 0; i < 4; i++) g.appendChild(s('rect', { class: 'l10-tile__box', x: 22 + i * 24, y: 26, width: 21, height: 21, rx: 5 }));
      g.appendChild(s('path', { class: 'l10-tile__arrow', d: 'M3 36 H16 M7 32 L3 36 L7 40 M12 32 L16 36 L12 40' }));
      g.appendChild(s('path', { class: 'l10-tile__arrow is-in', d: 'M127 36 H114 M123 32 L127 36 L123 40 M118 32 L114 36 L118 40' }));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 65, y: 63, 'text-anchor': 'middle' }, 'both ends O(1)'));
      return g;
    },
    window: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      var hs = [18, 30, 22, 38, 26, 44, 20];
      hs.forEach(function (v, i) { g.appendChild(s('rect', { class: 'l10-tile__bar' + (i === 3 ? ' is-max' : i >= 2 && i <= 4 ? ' is-in' : ''), x: 12 + i * 15, y: 52 - v, width: 11, height: v, rx: 3 })); });
      g.appendChild(s('rect', { class: 'l10-tile__win', x: 40, y: 4, width: 50, height: 52, rx: 6 }));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 65, y: 67, 'text-anchor': 'middle' }, 'max at the front'));
      return g;
    },
    stack: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      [0, 1, 2].forEach(function (i) { g.appendChild(s('rect', { class: 'l10-tile__box' + (i === 2 ? ' is-rear' : ''), x: 30 + i * 24, y: 22, width: 21, height: 21, rx: 5 })); });
      g.appendChild(s('path', { class: 'l10-tile__arrow is-in', d: 'M101 32 H113 M109 28 L113 32 L109 36' }));
      g.appendChild(s('path', { class: 'l10-tile__arrow', d: 'M4 32 H24 M20 28 L24 32 L20 36', style: 'opacity:.25' }));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 65, y: 60, 'text-anchor': 'middle' }, 'stack: same end in and out'));
      return g;
    },
    cost: function () {
      var g = s('svg', { viewBox: '0 0 130 70', class: 'l10-tile', 'aria-hidden': 'true' });
      g.appendChild(s('path', { class: 'l10-tile__axis', d: 'M14 8 V52 H120' }));
      g.appendChild(s('path', { class: 'l10-tile__line is-bad', d: 'M16 50 L116 10' }));
      g.appendChild(s('path', { class: 'l10-tile__line is-good', d: 'M16 48 H116' }));
      g.appendChild(s('text', { class: 'l10-tile__t', x: 65, y: 65, 'text-anchor': 'middle' }, 'shift vs ring dequeue'));
      return g;
    }
  };

  /* ------------------------------------------------------------------ small pieces */
  L10.chip = function (text, state) {
    return h('span', { class: 'l10-chip', 'data-state': state || 'default' }, text);
  };

  /* Operations input: numbers enqueue, d dequeues. opts: {label, value, presets:[{label, value}], maxOps, maxEnq, onApply(ops, text)} */
  L10.opsInput = function (el, opts) {
    var Q = V.algos.queues;
    return V.inputRow(el, {
      label: opts.label || 'Operations (a number enqueues it, d dequeues)',
      value: opts.value,
      placeholder: 'e.g. 4 7 1 d d 9',
      parse: function (text) {
        var r = Q.parseOps(text, { maxOps: opts.maxOps || 20 });
        if (r.error) return { values: null, error: r.error };
        if (opts.maxEnq && r.ops.filter(function (o) { return o.type === 'enq'; }).length > opts.maxEnq) return { values: null, error: 'Please use at most ' + opts.maxEnq + ' enqueues in this figure.' };
        return { values: r.ops, error: null };
      },
      presets: opts.presets, hint: opts.hint,
      onApply: opts.onApply
    });
  };
}());
