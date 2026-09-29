/* Visual DSA renderer toolkit: VDSA.vz
   Shared plumbing for every view in js/vdsa/views/*.js (and for lesson authors who draw custom figures).
   Load order: js/vdsa/core.js -> js/vdsa/views/base.js -> the views you need.

   Why a toolkit instead of VDSA.animate per element?
   Connected diagrams (trees, graphs, lists, pointers) must redraw their edges from the *current* animated
   node positions on every frame, swaps must travel along arcs, and a view with 60 moving items should run one
   requestAnimationFrame loop, not 60. So every view keeps plain "records" with numeric `cur` values, and one
   transition per render interpolates them (vz.Transition). Interrupting a transition simply starts the next one
   from wherever the records are now, which is what makes back/forward scrubbing smooth.

   Contents
   - pure (Node-testable): fmt, clamp, lerp, local, textWidth, wrap, roundedPath, arrowHead, pointOnPolyline,
     polylineLength, shorten, sameJSON
   - DOM: mount(), Store, Transition, set/text/state/place helpers, emitter(), legend()
*/
(function (root, factory) {
  'use strict';
  var api = factory(root && root.document ? root : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) root.VDSA.vz = api;
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  var vz = {};
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ pure helpers */
  vz.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  vz.lerp = function (a, b, t) { return a + (b - a) * t; };
  vz.easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  vz.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* Local progress for a staggered item inside one transition: t in [0,1], item starts at `delay` (0..1)
     and lasts `span` (0..1, default: the rest). Returns eased progress in [0,1]. */
  vz.local = function (t, delay, span, ease) {
    delay = delay || 0;
    var s = span === undefined ? 1 - delay : span;
    var x = s <= 0 ? (t >= delay ? 1 : 0) : vz.clamp((t - delay) / s, 0, 1);
    return (ease || vz.easeInOut)(x);
  };

  /* Display a value: Infinity -> ∞, floats trimmed, null/undefined -> ''. */
  vz.fmt = function (v, digits) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
      if (v === Infinity) return '∞';
      if (v === -Infinity) return '−∞';
      if (isNaN(v)) return 'NaN';
      if (Number.isInteger(v)) return v < 0 ? '−' + Math.abs(v) : String(v);
      var s = v.toFixed(digits === undefined ? 2 : digits).replace(/\.?0+$/, '');
      return v < 0 ? '−' + s.slice(1) : s;
    }
    return String(v);
  };

  /* Approximate text width in px without touching the DOM (used in Node and as a fallback).
     Proportional widths for sans; 0.6em for monospace. */
  var NARROW = 'iljtf!|.,:;\'`()[]{}I1 ', WIDE = 'mwMW@%', CAPS = /[A-Z0-9]/;
  vz.approxWidth = function (text, px, mono) {
    text = String(text);
    if (mono) return text.length * px * 0.6;
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      w += NARROW.indexOf(c) !== -1 ? 0.3 : WIDE.indexOf(c) !== -1 ? 0.85 : CAPS.test(c) ? 0.64 : 0.54;
    }
    return w * px;
  };

  /* Greedy word wrap. measure(text) -> px (defaults to approxWidth). Long words are hard-broken. */
  vz.wrap = function (text, maxWidth, px, measure) {
    measure = measure || function (s) { return vz.approxWidth(s, px); };
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], line = '';
    words.forEach(function (w) {
      var tryLine = line ? line + ' ' + w : w;
      if (measure(tryLine) <= maxWidth || !line) {
        if (!line && measure(w) > maxWidth) {
          // hard-break a single long word
          var chunk = '';
          for (var i = 0; i < w.length; i++) {
            if (measure(chunk + w[i]) > maxWidth && chunk) { lines.push(chunk); chunk = ''; }
            chunk += w[i];
          }
          line = chunk;
        } else line = tryLine;
      } else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  /* Polyline with rounded corners: points [[x,y],...], radius r -> SVG path d. */
  vz.roundedPath = function (pts, r) {
    if (!pts || pts.length < 2) return '';
    var d = 'M' + n2(pts[0][0]) + ' ' + n2(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      var d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var rr = Math.min(r, d1 / 2, d2 / 2);
      if (rr < 0.5 || d1 === 0 || d2 === 0) { d += 'L' + n2(p1[0]) + ' ' + n2(p1[1]); continue; }
      var ax = p1[0] + (p0[0] - p1[0]) * rr / d1, ay = p1[1] + (p0[1] - p1[1]) * rr / d1;
      var bx = p1[0] + (p2[0] - p1[0]) * rr / d2, by = p1[1] + (p2[1] - p1[1]) * rr / d2;
      d += 'L' + n2(ax) + ' ' + n2(ay) + 'Q' + n2(p1[0]) + ' ' + n2(p1[1]) + ' ' + n2(bx) + ' ' + n2(by);
    }
    var last = pts[pts.length - 1];
    return d + 'L' + n2(last[0]) + ' ' + n2(last[1]);
  };

  /* Arrowhead triangle with its tip at (x, y) pointing along `angle` (radians). */
  vz.arrowHead = function (x, y, angle, size, width) {
    size = size || 9; width = width === undefined ? size * 0.62 : width;
    var bx = x - Math.cos(angle) * size, by = y - Math.sin(angle) * size;
    var nx = -Math.sin(angle) * width, ny = Math.cos(angle) * width;
    // slightly concave back for a crafted look
    var cx = x - Math.cos(angle) * size * 0.72, cy = y - Math.sin(angle) * size * 0.72;
    return 'M' + n2(x) + ' ' + n2(y) + 'L' + n2(bx + nx) + ' ' + n2(by + ny) + 'Q' + n2(cx) + ' ' + n2(cy) + ' ' + n2(bx - nx) + ' ' + n2(by - ny) + 'Z';
  };

  vz.polylineLength = function (pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  };
  /* Point (and direction angle) at fraction f (0..1) along a polyline. */
  vz.pointOnPolyline = function (pts, f) {
    var total = vz.polylineLength(pts), target = vz.clamp(f, 0, 1) * total, acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + seg >= target || i === pts.length - 1) {
        var u = seg ? (target - acc) / seg : 0;
        return { x: vz.lerp(pts[i - 1][0], pts[i][0], u), y: vz.lerp(pts[i - 1][1], pts[i][1], u), angle: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) };
      }
      acc += seg;
    }
    return { x: pts[0][0], y: pts[0][1], angle: 0 };
  };
  /* Move point (x2,y2) towards (x1,y1) by `by` px. */
  vz.shorten = function (x1, y1, x2, y2, by) {
    var d = Math.hypot(x2 - x1, y2 - y1) || 1;
    return [x2 - (x2 - x1) * by / d, y2 - (y2 - y1) * by / d];
  };
  vz.sameJSON = function (a, b) {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
  };
  function n2(v) { return Math.round(v * 100) / 100; }
  vz.n2 = n2;

  if (!win) return vz; // Node stops here.

  /* ------------------------------------------------------------------ DOM helpers */
  var doc = win.document;
  var VDSA = win.VDSA;

  vz.svg = function (tag, attrs, parent) {
    var el = doc.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) {
      if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(el);
    return el;
  };
  /* Cached attribute write: skips the DOM when the value is unchanged. */
  vz.set = function (el, name, val) {
    var c = el.__vzA || (el.__vzA = {});
    if (c[name] === val) return;
    c[name] = val;
    if (val === null || val === undefined) el.removeAttribute(name); else el.setAttribute(name, val);
  };
  vz.text = function (el, s) {
    s = s === null || s === undefined ? '' : String(s);
    if (el.__vzT === s) return;
    el.__vzT = s; el.textContent = s;
  };
  /* Semantic state class: is-<state>. Only touches classList when it changes. */
  vz.state = function (el, state) {
    state = state || 'default';
    if (el.__vzS === state) return;
    if (el.__vzS) el.classList.remove('is-' + el.__vzS);
    el.classList.add('is-' + state);
    el.__vzS = state;
  };
  vz.toggle = function (el, cls, on) {
    var k = '__vzC_' + cls;
    on = !!on;
    if (el[k] === on) return;
    el[k] = on; el.classList.toggle(cls, on);
  };
  /* Position a <g>: translate + optional uniform scale. */
  vz.place = function (el, x, y, s) {
    vz.set(el, 'transform', 'translate(' + n2(x) + ' ' + n2(y) + ')' + (s !== undefined && Math.abs(s - 1) > 1e-3 ? ' scale(' + Math.max(0, s).toFixed(3) + ')' : ''));
  };
  vz.opacity = function (el, o) { vz.set(el, 'opacity', o >= 0.999 ? null : Math.max(0, o).toFixed(3)); };

  /* Effective duration in ms for a render: opts.duration (already speed-scaled by the player) or the view
     default, then VDSA.dur() so reduced motion gives 0. */
  vz.dur = function (opts, def) {
    var d = opts && opts.duration !== undefined && opts.duration !== null ? opts.duration : (def === undefined ? 450 : def);
    return VDSA && VDSA.dur ? VDSA.dur(d) : d;
  };

  /* Tiny event emitter used by every view: view.on('click', fn) -> unsubscribe. */
  vz.emitter = function () {
    var map = {};
    return {
      on: function (evt, fn) { (map[evt] = map[evt] || []).push(fn); return function () { map[evt] = (map[evt] || []).filter(function (f) { return f !== fn; }); }; },
      emit: function (evt, data) { (map[evt] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); },
      has: function (evt) { return !!(map[evt] && map[evt].length); }
    };
  };

  /* Text measurement with a shared offscreen canvas (no layout, no reflow). */
  var measureCtx = null, fontCache = {};
  function fontFamily(kind) {
    if (fontCache[kind]) return fontCache[kind];
    var v = VDSA && VDSA.cssVar ? VDSA.cssVar(kind === 'mono' ? '--font-mono' : '--font-sans') : '';
    return (fontCache[kind] = v || (kind === 'mono' ? 'monospace' : 'sans-serif'));
  }
  vz.textWidth = function (text, px, mono, weight) {
    try {
      measureCtx = measureCtx || doc.createElement('canvas').getContext('2d');
      measureCtx.font = (weight || 400) + ' ' + px + 'px ' + fontFamily(mono ? 'mono' : 'sans');
      return measureCtx.measureText(String(text)).width;
    } catch (_) { return vz.approxWidth(text, px, mono); }
  };

  /* ------------------------------------------------------------------ mount
     Creates <svg class="vz vz-<kind>"> inside the container with ordered layers and a <desc>.
     The viewBox width always equals the rendered pixel width, so 1 unit = 1 CSS px and type stays crisp.
     ctx.onResize(fn(width)) fires (debounced) when the width really changes. */
  vz.mount = function (container, kind, opts) {
    opts = opts || {};
    var host = typeof container === 'string' ? doc.querySelector(container) : container;
    if (!host) throw new Error('VDSA.views.' + kind + ': container not found');
    var svg = vz.svg('svg', {
      class: 'vz vz-' + kind + (opts.className ? ' ' + opts.className : ''),
      xmlns: SVG_NS, width: '100%', role: opts.interactive ? 'group' : 'img',
      'aria-label': opts.label || opts.ariaLabel || (kind + ' figure'),
      focusable: 'false'
    });
    var desc = vz.svg('desc', { id: (VDSA && VDSA.uid ? VDSA.uid('vzd') : 'vzd' + Math.random().toString(36).slice(2)) }, svg);
    svg.setAttribute('aria-describedby', desc.id);
    var defs = vz.svg('defs', null, svg);
    host.appendChild(svg);

    var ctx = { host: host, svg: svg, desc: desc, defs: defs, kind: kind, width: 0, height: 0, layers: {} };
    ctx.layer = function (name) {
      if (!ctx.layers[name]) ctx.layers[name] = vz.svg('g', { class: 'vz-layer vz-layer-' + name }, svg);
      return ctx.layers[name];
    };
    (opts.layers || []).forEach(ctx.layer);

    function measure() {
      var w = 0;
      try { w = svg.getBoundingClientRect().width; } catch (_) {}
      if (!w) w = host.clientWidth || 0;
      return Math.round(w);
    }
    ctx.width = measure() || opts.fallbackWidth || 640;
    ctx.measured = measure() > 0;

    ctx.setHeight = function (h) {
      h = Math.max(1, Math.ceil(h));
      if (h === ctx.height && ctx._vbw === ctx.width) return;
      ctx.height = h; ctx._vbw = ctx.width;
      svg.setAttribute('viewBox', '0 0 ' + ctx.width + ' ' + h);
      svg.style.height = h + 'px';
    };
    ctx.setDescription = function (text) { vz.text(desc, text || ''); };
    ctx.setDuration = function (ms) {
      var v = Math.round(ms) + 'ms';
      if (ctx._dur !== v) { ctx._dur = v; svg.style.setProperty('--vz-dur', v); }
    };

    var resizeFns = [];
    ctx.onResize = function (fn) { resizeFns.push(fn); };
    var unResize = VDSA && VDSA.onResize ? VDSA.onResize(svg, function () {
      var w = measure();
      if (!w || Math.abs(w - ctx.width) < 1) { if (w) ctx.measured = true; return; }
      ctx.width = w; ctx.measured = true;
      resizeFns.forEach(function (fn) { fn(w); });
    }) : function () {};
    var themeFns = [];
    ctx.onTheme = function (fn) { themeFns.push(fn); };
    var unTheme = VDSA && VDSA.theme ? VDSA.theme.onChange(function (t) { themeFns.forEach(function (fn) { fn(t); }); }) : function () {};

    ctx.destroy = function () {
      unResize(); unTheme();
      if (svg.parentNode) svg.parentNode.removeChild(svg);
    };
    return ctx;
  };

  /* ------------------------------------------------------------------ Store: keyed records
     store.begin();  rec = store.use(id, createFn)  ...  exits = store.end();
     - use() returns the existing record (reviving it if it was fading out) or a fresh one with rec.isNew = true.
     - end() marks unseen records as exiting and returns them; call store.purge() when their fade finished.
     Reserved record fields (used by Store / retarget / step / purge — do not reuse them for your own data):
       id, cur, from, to, isNew, exiting, revived, el, nodes, paint, arc, arcX, delay.
     Keep view data under other names (e.g. rec.data, rec.src/rec.dst for edge endpoints). */
  /* new vz.Store(true) tags each record's root element with data-id (so VDSA.clickQuiz and hover code can find it). */
  vz.Store = function (tagIds) { this.map = new Map(); this.seen = null; this.tagIds = !!tagIds; };
  vz.Store.prototype.begin = function () { this.seen = new Set(); };
  vz.Store.prototype.use = function (id, create) {
    var rec = this.map.get(id);
    this.seen.add(id);
    if (rec) { rec.isNew = false; rec.revived = !!rec.exiting; rec.exiting = false; return rec; }
    rec = { id: id, cur: {}, from: {}, to: {}, isNew: true, exiting: false };
    create(rec);
    if (this.tagIds && rec.el && rec.el.setAttribute && !rec.el.hasAttribute('data-id')) rec.el.setAttribute('data-id', id);
    this.map.set(id, rec);
    return rec;
  };
  vz.Store.prototype.get = function (id) { return this.map.get(id); };
  vz.Store.prototype.end = function () {
    var out = [], seen = this.seen;
    this.map.forEach(function (rec, id) { if (!seen.has(id)) { rec.exiting = true; out.push(rec); } });
    return out;
  };
  vz.Store.prototype.each = function (fn) { this.map.forEach(fn); };
  /* Remove exiting records (their DOM nodes too). */
  vz.Store.prototype.purge = function () {
    var map = this.map;
    map.forEach(function (rec, id) {
      if (rec.exiting) {
        (rec.nodes || [rec.el]).forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
        map.delete(id);
      }
    });
  };
  vz.Store.prototype.clear = function () {
    this.map.forEach(function (rec) { (rec.nodes || [rec.el]).forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); }); });
    this.map.clear();
  };

  /* Prepare a record for the next transition: from = copy of cur, to = target (numbers only). */
  vz.retarget = function (rec, target) {
    rec.from = {}; rec.to = {};
    for (var k in target) {
      if (rec.cur[k] === undefined) rec.cur[k] = target[k];
      rec.from[k] = rec.cur[k];
      rec.to[k] = target[k];
    }
  };
  /* Interpolate a record at local eased progress e. rec.arc (px, signed) bends the path: positive = up. */
  vz.step = function (rec, e) {
    var f = rec.from, t = rec.to, c = rec.cur;
    for (var k in t) c[k] = f[k] + (t[k] - f[k]) * e;
    if (rec.arc && c.y !== undefined) c.y -= rec.arc * Math.sin(Math.PI * e);
    if (rec.arcX && c.x !== undefined) c.x += rec.arcX * Math.sin(Math.PI * e);
  };
  vz.moved = function (rec, eps) {
    eps = eps || 0.5;
    for (var k in rec.to) if (Math.abs(rec.to[k] - rec.from[k]) > eps) return true;
    return false;
  };

  /* ------------------------------------------------------------------ Transition
     One rAF loop per view. tr.run(ms, frame(t), done) cancels the previous run; frame receives raw t 0..1
     (use vz.local for per-record easing/stagger). ms <= 0 calls frame(1) and done() synchronously.
     Rule for views that skip unchanged records for speed (grid.js): a new run cancels the old one, so
     records that were still moving must be carried into the next run (retarget them to their unchanged
     target) or they freeze part-way. Views that retarget every record each render get this for free. */
  vz.Transition = function () { this.raf = 0; this.token = 0; this.running = false; this.frame = null; this.done = null; };
  vz.Transition.prototype.run = function (ms, frame, done) {
    var self = this, token = ++this.token;
    if (this.raf) { win.cancelAnimationFrame(this.raf); this.raf = 0; }
    this.frame = frame; this.done = done || null;
    if (!ms || ms <= 0 || doc.hidden) {
      this.running = false;
      frame(1); if (done) done();
      return;
    }
    var start = 0;
    this.running = true;
    function tick(now) {
      if (token !== self.token) return;
      if (!start) start = now;
      var t = Math.min(1, (now - start) / ms);
      frame(t);
      if (t < 1) self.raf = win.requestAnimationFrame(tick);
      else { self.raf = 0; self.running = false; if (done) done(); }
    }
    this.raf = win.requestAnimationFrame(tick);
  };
  /* Jump the running transition to its end state (frame(1) + done). */
  vz.Transition.prototype.finish = function () {
    if (!this.running) return;
    this.token++;
    if (this.raf) win.cancelAnimationFrame(this.raf);
    this.raf = 0; this.running = false;
    if (this.frame) this.frame(1);
    if (this.done) this.done();
  };
  vz.Transition.prototype.cancel = function () { this.token++; if (this.raf) win.cancelAnimationFrame(this.raf); this.raf = 0; this.running = false; };

  /* Make an SVG element keyboard/click interactive. handler(ev) is called for click, Enter and Space. */
  vz.clickable = function (el, label, handler) {
    if (el.__vzClick) { el.__vzClick = handler; if (label) vz.set(el, 'aria-label', label); return; }
    el.__vzClick = handler;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    if (label) vz.set(el, 'aria-label', label);
    el.classList.add('is-clickable');
    el.addEventListener('click', function (ev) { el.__vzClick(ev); });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.__vzClick(ev); }
    });
  };

  /* Convert a pointer event to SVG user coordinates (viewBox units). */
  vz.pointer = function (svg, ev) {
    var r = svg.getBoundingClientRect();
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var sx = vb && r.width ? vb.width / r.width : 1, sy = vb && r.height ? vb.height / r.height : 1;
    return { x: (ev.clientX - r.left) * sx, y: (ev.clientY - r.top) * sy };
  };

  /* Optional HTML legend: vz.legend(el, ['active', 'compare', {state:'done', label:'sorted'}]).
     Returns the <div class="vz-legend">. (VDSA.legend from widgets.js is the richer site-wide widget.) */
  vz.legend = function (container, entries) {
    var host = typeof container === 'string' ? doc.querySelector(container) : container;
    var div = doc.createElement('div');
    div.className = 'vz-legend';
    div.setAttribute('aria-label', 'Colour legend');
    (entries || []).forEach(function (e) {
      if (typeof e === 'string') e = { state: e };
      var item = doc.createElement('span');
      item.className = 'vz-legend-item is-' + e.state + (e.shape ? ' vz-legend-' + e.shape : '');
      var sw = doc.createElement('span'); sw.className = 'vz-legend-swatch'; sw.setAttribute('aria-hidden', 'true');
      item.appendChild(sw);
      item.appendChild(doc.createTextNode(e.label || (VDSA && VDSA.STATES && VDSA.STATES[e.state] ? e.state : e.state)));
      div.appendChild(item);
    });
    if (host) host.appendChild(div);
    return div;
  };

  /* Shared view scaffolding: returns {ctx, emitter, tr, api} with api.render implementing the
     "same snapshot twice is a no-op" rule and resize re-layout. `draw(state, ms, info)` does the work. */
  vz.createView = function (container, kind, opts, draw) {
    var ctx = vz.mount(container, kind, opts);
    var em = vz.emitter();
    var tr = new vz.Transition();
    var last = null, lastJSON = null, destroyed = false;
    var api = {
      el: ctx.svg, ctx: ctx, kind: kind,
      on: em.on,
      render: function (state, ropts) {
        if (destroyed) return api;
        state = state || {};
        var json = null;
        try { json = JSON.stringify(state); } catch (_) {}
        if (json !== null && json === lastJSON && !(ropts && ropts.force)) {
          // Same snapshot: a no-op, except that an instant render finishes a running animation.
          if (tr.running && vz.dur(ropts, 1) === 0) { ctx.setDuration(0); tr.finish(); }
          return api;
        }
        last = state; lastJSON = json;
        var ms = vz.dur(ropts, opts.duration === undefined ? 450 : opts.duration);
        ctx.setDuration(ms);
        draw(state, ms, ropts || {});
        if (opts.describe !== false && api.describe) ctx.setDescription(api.describe(state));
        return api;
      },
      /* Re-draw the current snapshot instantly (e.g. after changing options). */
      refresh: function () { if (last) { lastJSON = null; api.render(last, { duration: 0 }); } return api; },
      state: function () { return last; },
      destroy: function () { destroyed = true; tr.cancel(); ctx.destroy(); }
    };
    ctx.onResize(function () { if (last) { lastJSON = null; api.render(last, { duration: 0 }); } });
    return { ctx: ctx, em: em, tr: tr, api: api };
  };

  return vz;
}));
