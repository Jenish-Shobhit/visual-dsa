/* VDSA.views.callstack(container, options) — a stack of call frames for recursion lessons.
   Frames push (drop in from above onto the stack) and pop (lift off and fade); a returning frame's value
   flies down to the caller. The top frame is highlighted (state 'active' unless you set one).
   Pairs with VDSA.views.tree for recursion trees: drive both from the same step.

   const stack = VDSA.views.callstack('#calls', { maxVisible: 6 });
   stack.render({ frames: [                       // bottom (oldest) first, top (newest) last
     { id: 'c0', fn: 'fact', args: 'n=3', locals: { n: 3 } },
     { id: 'c1', fn: 'fact', args: 'n=2', locals: [['n', 2]], line: 4 },
     { id: 'c2', fn: 'fact', args: { n: 1 }, returnValue: 1, state: 'done' }
   ] }, { duration: ctx.duration });

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> callstack.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var layout = {};

  /* Normalise frames: accepts {frames:[...]} or an array. Locals become [{name, value, state}]. */
  layout.normalize = function (state) {
    var frames = Array.isArray(state) ? state : (state && state.frames) || [];
    return frames.filter(Boolean).map(function (f, i) {
      var locals = [];
      if (Array.isArray(f.locals)) f.locals.forEach(function (l) {
        if (Array.isArray(l)) locals.push({ name: String(l[0]), value: l[1] });
        else if (l && typeof l === 'object') locals.push({ name: String(l.name), value: l.value, state: l.state });
      });
      else if (f.locals && typeof f.locals === 'object') Object.keys(f.locals).forEach(function (k) { locals.push({ name: k, value: f.locals[k] }); });
      var args = f.args;
      if (args && typeof args === 'object' && !Array.isArray(args)) args = Object.keys(args).map(function (k) { return k + '=' + args[k]; }).join(', ');
      else if (Array.isArray(args)) args = args.join(', ');
      return {
        id: String(f.id !== undefined ? f.id : 'frame' + i), fn: f.fn === undefined ? '' : String(f.fn),
        args: args === undefined || args === null ? '' : String(args), locals: locals, state: f.state,
        returnValue: f.returnValue, hasReturn: f.returnValue !== undefined, line: f.line
      };
    });
  };

  /* Heights of each frame card (px) for a given row height. */
  layout.frameHeight = function (frame, opts) {
    opts = opts || {};
    var head = opts.head || 32, row = opts.row || 20;
    var n = opts.showLocals === false ? 0 : frame.locals.length;
    return head + (n ? n * row + 8 : 0);
  };

  /* Stack layout. Returns {cards:[{id, y, h}], collapsed: n, more: {y, h}|null, total}
     'up': frames[0] at the bottom (y measured from the top of a box of height `height`); 'down': frames[0] at
     the top. With more than maxVisible frames, the oldest are collapsed into one "n more" bar. */
  layout.stack = function (frames, opts) {
    opts = opts || {};
    var gap = opts.gap === undefined ? 6 : opts.gap, pad = opts.pad === undefined ? 8 : opts.pad, moreH = 24;
    var maxVisible = opts.maxVisible || Infinity;
    var collapsed = Math.max(0, frames.length - maxVisible);
    var shown = frames.slice(collapsed);
    var hs = shown.map(function (f) { return layout.frameHeight(f, opts); });
    var total = hs.reduce(function (a, b) { return a + b; }, 0) + Math.max(0, hs.length - 1) * gap + (collapsed ? moreH + gap : 0);
    var height = Math.max(opts.height || 0, total + 2 * pad);
    var cards = [], more = null, y;
    if (opts.direction === 'down') {
      y = pad;
      if (collapsed) { more = { y: y, h: moreH }; y += moreH + gap; }
      shown.forEach(function (f, i) { cards.push({ id: f.id, y: y, h: hs[i] }); y += hs[i] + gap; });
    } else {
      y = height - pad;
      if (collapsed) { more = { y: y - moreH, h: moreH }; y -= moreH + gap; }
      shown.forEach(function (f, i) { y -= hs[i]; cards.push({ id: f.id, y: y, h: hs[i] }); y -= gap; });
    }
    return { cards: cards, collapsed: collapsed, more: more, total: total + 2 * pad, height: height };
  };

  if (typeof module === 'object' && module.exports) module.exports = layout;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, fmt = vz.fmt;

  var DEFAULTS = {
    direction: 'up',        // 'up': newest frame on top (default); 'down': newest at the bottom
    maxVisible: 8,          // older frames collapse into "… n more frames"
    frameWidth: 300,        // max card width in px
    align: 'center',        // 'center' | 'left'
    showLocals: true,
    height: null,           // fixed height (else grows to the tallest stack seen / prepared)
    activeTop: true,        // top frame gets state 'active' when it has no state
    onFrameClick: null,
    duration: undefined
  };
  var HEAD = 32, ROW = 20;

  function topRounded(x, y, w, h, r) {
    return 'M' + vz.n2(x) + ' ' + vz.n2(y + h) + 'V' + vz.n2(y + r) + 'Q' + vz.n2(x) + ' ' + vz.n2(y) + ' ' + vz.n2(x + r) + ' ' + vz.n2(y) +
      'H' + vz.n2(x + w - r) + 'Q' + vz.n2(x + w) + ' ' + vz.n2(y) + ' ' + vz.n2(x + w) + ' ' + vz.n2(y + r) + 'V' + vz.n2(y + h) + 'Z';
  }

  function callstackView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var V = vz.createView(container, 'callstack', {
      label: opts.label || 'Call stack', interactive: !!opts.onFrameClick, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('frames'); ctx.layer('flyers');
    var S = { frames: new vz.Store(true), more: new vz.Store(), flyers: new vz.Store() };
    var clickable = !!opts.onFrameClick;
    var prepared = { height: 0 };
    var textCache = new Map();
    var G = null;

    function measure(s, px, weight, mono) {
      var k = s + '|' + px + '|' + weight + '|' + (mono ? 1 : 0);
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(s, px, !!mono, weight); textCache.set(k, w); }
      return w;
    }
    function fit(s, px, weight, maxW) {
      s = String(s);
      if (measure(s, px, weight, true) <= maxW) return s;
      while (s.length > 1 && measure(s + '…', px, weight, true) > maxW) s = s.slice(0, -1);
      return s + '…';
    }
    function layOpts() { return { direction: opts.direction, maxVisible: opts.maxVisible, showLocals: opts.showLocals, head: HEAD, row: ROW }; }

    /* ---------------------------------------------------------- frames */
    function buildFrame(rec) {
      var g = vz.svg('g', { class: 'vz-frame' }, ctx.layers.frames);
      rec.card = vz.svg('rect', { class: 'vz-frame-card vz-shape', rx: 9, ry: 9 }, g);
      rec.head = vz.svg('path', { class: 'vz-frame-head' }, g);
      rec.title = vz.svg('text', { class: 'vz-frame-title', dy: '.35em' }, g);
      rec.meta = vz.svg('text', { class: 'vz-frame-meta', 'text-anchor': 'end', dy: '.35em' }, g);
      rec.locals = vz.svg('g', { class: 'vz-frame-locals' }, g);
      rec.rows = {};
      rec.el = g; rec.paint = paintFrame;
      if (clickable) makeClickable(rec);
    }
    function makeClickable(rec) {
      var d = rec.data;
      vz.clickable(rec.el, d ? d.fn + '(' + d.args + ')' : null, function () {
        var f = rec.data || {};
        var payload = { id: rec.id, fn: f.fn, args: f.args, frame: f };
        em.emit('click', payload);
        if (opts.onFrameClick) opts.onFrameClick(payload);
      });
    }
    function chip(rec, key, text, state) {
      var has = text !== undefined && text !== null && text !== '';
      if (!has) { if (rec[key]) { rec[key].g.remove(); rec[key] = null; } return null; }
      if (!rec[key]) {
        var g = vz.svg('g', { class: 'vz-badge vz-frame-ret' }, rec.el);
        rec[key] = { g: g, rect: vz.svg('rect', { rx: 8, ry: 8, height: 17, y: -8.5 }, g), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g) };
      }
      var t = String(text), w = Math.max(18, measure(t, 11, 650, true) + 12);
      vz.text(rec[key].text, t);
      vz.set(rec[key].rect, 'width', vz.n2(w)); vz.set(rec[key].rect, 'x', vz.n2(-w / 2));
      vz.state(rec[key].g, state || 'done');
      rec[key].w = w;
      return rec[key];
    }
    /* Lay out the static content of a card (in card-local coordinates). */
    function fillFrame(rec, f, fw, h, flash) {
      rec.newRows = [];
      var ret = f.hasReturn ? 'returns ' + fmt(f.returnValue) : null;
      var rc = chip(rec, 'ret', ret, 'done');
      var metaText = !rc && f.line !== undefined && f.line !== null ? 'line ' + f.line : '';
      vz.text(rec.meta, metaText);
      vz.set(rec.meta, 'x', vz.n2(fw - 12)); vz.set(rec.meta, 'y', HEAD / 2);
      var titleMax = fw - 26 - (rc ? rc.w + 10 : metaText ? measure(metaText, 11, 500, true) + 12 : 0);
      vz.text(rec.title, fit(f.fn + '(' + f.args + ')', 13, 650, Math.max(30, titleMax)));
      vz.set(rec.title, 'x', 14); vz.set(rec.title, 'y', HEAD / 2);
      if (rc) vz.place(rc.g, fw - 12 - rc.w / 2, HEAD / 2);
      vz.set(rec.card, 'width', vz.n2(fw));
      vz.set(rec.card, 'x', 0); vz.set(rec.card, 'y', 0);
      vz.set(rec.head, 'd', topRounded(0.75, 0.75, fw - 1.5, HEAD - 0.75, 8.5));
      // locals rows keyed by name
      var seen = {};
      var list = opts.showLocals ? f.locals : [];
      list.forEach(function (l, i) {
        seen[l.name] = true;
        var row = rec.rows[l.name];
        if (!row) {
          var g = vz.svg('g', { class: 'vz-frame-row' }, rec.locals);
          if (flash) { g.setAttribute('opacity', 0); rec.newRows.push(g); }
          row = rec.rows[l.name] = { g: g, bg: vz.svg('rect', { class: 'vz-frame-flash', rx: 4, ry: 4, height: ROW - 3, y: -(ROW - 3) / 2 }, g), k: vz.svg('text', { class: 'vz-frame-key', dy: '.35em' }, g), v: vz.svg('text', { class: 'vz-frame-val', 'text-anchor': 'end', dy: '.35em' }, g) };
        }
        var vt = fmt(l.value);
        if (flash && row.last !== undefined && row.last !== vt) row.g.classList.add('is-changed');
        row.last = vt;
        vz.state(row.g, l.state || 'default');
        vz.text(row.k, l.name);
        vz.text(row.v, fit(vt, 12, 650, fw * 0.55));
        vz.set(row.k, 'x', 14); vz.set(row.v, 'x', vz.n2(fw - 14));
        vz.set(row.bg, 'x', 8); vz.set(row.bg, 'width', vz.n2(fw - 16));
        vz.place(row.g, 0, HEAD + 4 + ROW / 2 + i * ROW);
      });
      Object.keys(rec.rows).forEach(function (k) { if (!seen[k]) { rec.rows[k].g.remove(); delete rec.rows[k]; } });
    }
    function paintFrame(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      if (rec.card && c.h !== undefined) vz.set(rec.card, 'height', vz.n2(c.h));
      if (rec.newRows && rec.newRows.length) {
        var o = vz.clamp((c.hp - 0.45) / 0.55, 0, 1).toFixed(3);
        rec.newRows.forEach(function (g) { g.setAttribute('opacity', o); });
      }
    }

    function buildMore(rec) {
      var g = vz.svg('g', { class: 'vz-frame-more' }, ctx.layers.frames);
      rec.bg = vz.svg('rect', { class: 'vz-frame-more-bg', rx: 8, ry: 8 }, g);
      rec.txt = vz.svg('text', { class: 'vz-frame-more-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintFrame;
    }
    function buildFlyer(rec) {
      var g = vz.svg('g', { class: 'vz-badge vz-frame-ret vz-flyer is-done' }, ctx.layers.flyers);
      rec.rect = vz.svg('rect', { rx: 8, ry: 8, height: 17, y: -8.5 }, g);
      rec.txt = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) {
        var c = r.cur;
        vz.place(r.el, c.x, c.y);
        vz.opacity(r.el, c.p < 0.65 ? Math.min(1, c.p * 6) : Math.max(0, 1 - (c.p - 0.65) / 0.35));
      };
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var frames = layout.normalize(state);
      var W = ctx.width, pad = 8;
      var fw = Math.max(120, Math.min(opts.frameWidth, W - 2 * pad));
      var x0 = opts.align === 'left' ? pad : Math.round((W - fw) / 2);
      var lo = layOpts();
      lo.height = Math.max(opts.height || 0, prepared.height || 0);
      var L = layout.stack(frames, lo);
      if (!opts.height) prepared.height = Math.max(prepared.height, L.height);
      G = { W: W, fw: fw, x0: x0, height: opts.height || L.height };
      ctx.setHeight(G.height);
      var up = opts.direction !== 'down';
      var anim = [];
      var byId = {};
      L.cards.forEach(function (c) { byId[c.id] = c; });
      var topId = frames.length ? frames[frames.length - 1].id : null;

      // transient flyers never outlive one render
      S.flyers.clear();
      S.flyers.begin();

      var prevTop = null;
      S.frames.each(function (rec, id) { if (!rec.exiting && rec.isTop) prevTop = rec; });

      S.frames.begin();
      frames.forEach(function (f, i) {
        var card = byId[f.id];
        if (!card) return; // collapsed
        var rec = S.frames.use(f.id, buildFrame);
        rec.data = f;
        rec.isTop = f.id === topId;
        var st = f.state || (opts.activeTop && rec.isTop ? 'active' : 'default');
        vz.set(rec.el, 'class', 'vz-frame is-' + st + (rec.isTop ? ' is-top' : '') + (clickable ? ' is-clickable' : ''));
        fillFrame(rec, f, fw, card.h, ms > 0 && !rec.isNew);
        if (clickable) vz.set(rec.el, 'aria-label', f.fn + '(' + f.args + ')' + (f.hasReturn ? ' returns ' + fmt(f.returnValue) : ''));
        var t = { x: x0, y: card.y, o: 1, s: 1, h: card.h, hp: 1 };
        rec.delay = 0;
        if (rec.isNew) {
          var fromY = card.y + (up ? -38 : 38);
          if (i < frames.length - 1 || !ms) fromY = card.y + (up ? 14 : -14); // revealed from the collapsed bar
          rec.cur = { x: x0, y: fromY, o: 0, s: 1, h: card.h, hp: 1 };
        } else rec.cur.hp = rec.newRows.length ? 0 : 1;
        vz.retarget(rec, t);
        anim.push(rec);
      });
      S.frames.end().forEach(function (rec) {
        var d = rec.data || {};
        var isPop = rec.isTop;
        var lift = isPop ? (up ? -34 : 34) : (up ? 14 : -14);
        rec.isTop = false;
        vz.retarget(rec, { x: rec.cur.x, y: rec.cur.y + lift, o: 0, s: 1 });
        rec.delay = 0;
        anim.push(rec);
        // return value flies to the new top frame
        if (isPop && ms > 0 && d.hasReturn && topId && byId[topId]) {
          var fl = S.flyers.use(rec.id, buildFlyer);
          var txt = fmt(d.returnValue), w = Math.max(18, measure(txt, 11, 650, true) + 12);
          vz.text(fl.txt, txt);
          vz.set(fl.rect, 'width', vz.n2(w)); vz.set(fl.rect, 'x', vz.n2(-w / 2));
          var sx = rec.cur.x + fw - 12 - (rec.ret ? rec.ret.w : 60) / 2, sy = rec.cur.y + HEAD / 2;
          var target = byId[topId];
          fl.cur = { x: sx, y: sy, p: 0 };
          vz.retarget(fl, { x: x0 + fw * 0.62, y: target.y + HEAD / 2, p: 1 });
          fl.delay = 0;
          anim.push(fl);
        }
      });

      // collapsed bar
      S.more.begin();
      if (L.more) {
        var mrec = S.more.use('more', buildMore);
        vz.text(mrec.txt, '… ' + L.collapsed + ' more frame' + (L.collapsed === 1 ? '' : 's'));
        vz.set(mrec.bg, 'width', vz.n2(fw)); vz.set(mrec.bg, 'height', L.more.h);
        vz.set(mrec.txt, 'x', vz.n2(fw / 2)); vz.set(mrec.txt, 'y', vz.n2(L.more.h / 2));
        var mt = { x: x0, y: L.more.y, o: 1, s: 1 };
        if (mrec.isNew) mrec.cur = Object.assign({}, mt, { o: 0 });
        vz.retarget(mrec, mt); mrec.delay = 0;
        anim.push(mrec);
      }
      S.more.end().forEach(function (rec) { vz.retarget(rec, Object.assign({}, rec.cur, { o: 0 })); rec.delay = 0; anim.push(rec); });

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) { var rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
      }, function () {
        S.frames.purge(); S.more.purge(); S.flyers.clear();
        S.frames.each(function (rec) {
          Object.keys(rec.rows).forEach(function (k) { rec.rows[k].g.classList.remove('is-changed'); rec.rows[k].g.removeAttribute('opacity'); });
          rec.newRows = [];
        });
      });
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var frames = layout.normalize(state);
      if (!frames.length) return 'Call stack is empty.';
      return 'Call stack with ' + frames.length + ' frame' + (frames.length === 1 ? '' : 's') + ', top first: ' +
        frames.slice().reverse().map(function (f) {
          return f.fn + '(' + f.args + ')' + (f.hasReturn ? ' returning ' + fmt(f.returnValue) : '') +
            (f.locals.length ? ' [' + f.locals.map(function (l) { return l.name + '=' + fmt(l.value); }).join(', ') + ']' : '');
        }).join('; ') + '.';
    };
    /* Scan all snapshots so the figure keeps one height for the whole trace. */
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        var L = layout.stack(layout.normalize(st), layOpts());
        prepared.height = Math.max(prepared.height, L.height);
      });
      api.refresh();
      return api;
    };
    api.reset = function () { prepared = { height: 0 }; return api; };
    api.setOptions = function (o) { Object.assign(opts, o || {}); textCache.clear(); api.refresh(); return api; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        ctx.svg.setAttribute('role', 'group');
        S.frames.each(function (rec) { makeClickable(rec); });
      }
      return baseOn(evt, fn);
    };
    return api;
  }

  callstackView.layout = layout;
  callstackView.defaults = DEFAULTS;
  VDSA.views.callstack = callstackView;
}(typeof window !== 'undefined' ? window : null));
