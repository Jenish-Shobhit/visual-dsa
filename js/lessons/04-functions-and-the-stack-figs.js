/* Lesson 04 · Functions & the call stack — custom figures.
   Registered on VDSA.lessons.fn and started by js/lessons/04-functions-and-the-stack.js.

   Every figure follows the renderer contract (docs/ENGINE.md §13): elements are built once and keyed, each render
   moves them (VDSA.animate) instead of redrawing, colours come from state classes (.vz .is-<state>) and tokens, and
   durations come from the player's ctx.duration, so speed and reduced motion work for free. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s, h = V.h;
  var FN = (V.lessons = V.lessons || {}).fn = (V.lessons && V.lessons.fn) || {};

  /* ------------------------------------------------------------------ helpers */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mv(el, props, dur, ease) { return V.animate(el, props, { duration: dur, ease: ease || 'inOut' }); }
  function cls(el, base, state) { el.setAttribute('class', base + (state ? ' is-' + state : '')); }
  function tw(text, px, mono, weight) { return V.vz ? V.vz.textWidth(String(text), px, !!mono, weight || 600) : String(text).length * px * (mono ? 0.6 : 0.55); }
  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }

  /* A figure drawn in CSS pixels: the viewBox width equals the rendered width, so text stays crisp at every size.
     draw(state, dur, W, arg) builds/updates and returns the height. Re-laid out (instantly) when the width changes. */
  function pxFig(stage, opts) {
    var svg = s('svg', { class: 'vz fn ' + (opts.cls || ''), role: 'img', 'aria-label': opts.label || '' });
    stage.appendChild(svg);
    var W = 0, last = null, lastArg = null;
    function measure() {
      var w = svg.getBoundingClientRect().width;
      if (!w) w = (stage.clientWidth || 640) - 32;
      W = Math.max(opts.minWidth || 260, Math.round(w));
    }
    function render(state, dur, arg) {
      last = state; lastArg = arg;
      measure();
      svg.style.setProperty('--vz-dur', (dur || 0) + 'ms');
      var H = opts.draw(state, dur || 0, W, arg, svg);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.round(H));
      svg.style.height = Math.round(H) + 'px';
    }
    V.onResize(stage, function () {
      if (last === null) return;
      var old = W; measure();
      if (Math.abs(old - W) > 2) render(last, 0, lastArg);
    });
    return { svg: svg, render: render, width: function () { return W; } };
  }
  FN.pxFig = pxFig;

  /* Keyed element store: use(id, build) returns the element, sweep() returns whatever was not used this render. */
  function Keyed(parent) { this.parent = parent; this.map = {}; this.seen = null; }
  Keyed.prototype.begin = function () { this.seen = {}; };
  Keyed.prototype.use = function (id, build) {
    this.seen[id] = true;
    var el = this.map[id];
    if (!el) { el = build(); el.__new = true; this.parent.appendChild(el); this.map[id] = el; } else el.__new = false;
    return el;
  };
  Keyed.prototype.sweep = function () {
    var out = [], self = this;
    Object.keys(this.map).forEach(function (id) { if (!self.seen[id]) { out.push(self.map[id]); delete self.map[id]; } });
    return out;
  };

  /* A little chip: rounded rect + centred text, state class on the group. */
  function chip(w, hh, text, state, extra) {
    var g = s('g', { class: 'vz-item fn-chip is-' + (state || 'default') + (extra ? ' ' + extra : '') });
    g.rect = s('rect', { class: 'vz-shape', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: Math.min(9, hh / 2) });
    g.text = s('text', { class: 'vz-ink vz-mono', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 14 }, text);
    g.appendChild(g.rect); g.appendChild(g.text);
    return g;
  }

  /* ================================================================== stack-and-heap figure (memory view + flying return value) */
  FN.memFig = function (stage, o) {
    o = o || {};
    stage.classList.add('fn-memstage');
    var view = V.views.memory(stage, { mode: 'stackheap', label: o.label || 'Call stack and heap', stackLabel: 'Call stack', heapLabel: 'Heap', frameWidth: o.frameWidth });
    var flyEl = h('span', { class: 'fn-fly', 'aria-hidden': 'true' });
    stage.appendChild(flyEl);
    V.place(flyEl, { x: 0, y: 0, opacity: 0 });
    function frameByTitle(title) {
      var all = V.$$('.vz-mem-frame', stage), hit = null;
      all.forEach(function (g) { var t = g.querySelector('.vz-mem-frame-title'); if (t && t.textContent === title) hit = g; });
      return hit;
    }
    /* Optional vertical centring (o.shiftFor(step) -> px): the memory view reserves room for its tallest state and draws
       from the top, so shorter states slide down by half the spare room. Eased with the step; the flying value
       is told how far its target will have moved. */
    var shiftNow = 0, svgEl = null;
    function fly(step, dur, delta) {
      var from = frameByTitle(step.fly.from), to = frameByTitle(step.fly.to);
      if (!from || !to) return;
      var target = null;
      V.$$('.vz-mem-varrow', to).forEach(function (row) { var n = row.querySelector('.vz-mem-varname2'); if (n && n.textContent === step.fly.name) target = row.querySelector('.vz-mem-val'); });
      var sr = stage.getBoundingClientRect(), fr = (from.querySelector('.vz-mem-frame-head') || from).getBoundingClientRect(), tr = (target || to).getBoundingClientRect();
      flyEl.textContent = '→ ' + (typeof step.fly.value === 'number' ? num(step.fly.value) : String(step.fly.value).replace(/^→ /, ''));
      var sx = fr.left + fr.width - 30 - sr.left, sy = fr.top + fr.height / 2 - sr.top;
      var tx = tr.left + tr.width / 2 - sr.left, ty = tr.top + tr.height / 2 - sr.top + (delta || 0);
      V.place(flyEl, { x: sx, y: sy, opacity: 1, scale: 1 });
      mv(flyEl, { x: tx, y: ty }, dur * 0.9, 'inOut').then(function () { return mv(flyEl, { opacity: 0, scale: 0.8 }, 160, 'out'); });
    }
    return {
      view: view,
      prepare: function (steps) { view.reset(); view.prepare(steps); },
      render: function (step, ctx) {
        V.place(flyEl, { opacity: 0 });
        var want = o.shiftFor ? o.shiftFor(step) : 0, delta = want - shiftNow;
        view.render(step, { duration: ctx.duration });
        if (step.fly && ctx.duration > 0 && ctx.direction === 1 && ctx.prev) fly(step, ctx.duration, delta);
        if (o.shiftFor) {
          svgEl = svgEl || stage.querySelector('svg');
          if (svgEl) {
            svgEl.style.transition = ctx.duration > 0 ? 'transform ' + ctx.duration + 'ms ease-in-out' : 'none';
            svgEl.style.transform = want ? 'translateY(' + want + 'px)' : '';
          }
          shiftNow = want;
        }
      }
    };
  };

  /* ================================================================== the problem: where does a function return to? */
  FN.jumpsFig = function (stage, lines) {
    var ROW = 30, D = null;
    var gLines = null, hl = null, gArrow = null, gPanel = null, built = false;
    var noteEls = {}, varEls = {}, paramEl = null, resEl = null, tokEl = null, arrowPath = null, arrowHead = null;
    var lastStep = null;
    var fig = pxFig(stage, { label: 'Program with a function called from two lines; a note records where each call must return to.', cls: 'fn-jumps', minWidth: 300, draw: draw });
    var root = null;

    function geom(W) {
      var wide = W >= 560;
      var codeW = wide ? Math.min(360, W * 0.56) : W - 8;
      var codeH = lines.length * ROW + 8;
      var px = wide ? codeW + 56 : 4, py = wide ? 4 : codeH + 18;
      return {
        wide: wide, codeW: codeW, codeH: codeH, px: px, py: py, pw: wide ? W - px - 4 : W - 8,
        H: wide ? Math.max(codeH + 8, 250) : codeH + 18 + 246
      };
    }
    function yOf(line) { return 4 + (line - 1) * ROW + ROW / 2; }
    function build(svg) {
      root = s('g'); svg.appendChild(root);
      var bg = s('g'); gLines = s('g'); gArrow = s('g', { class: 'fn-arrow' }); gPanel = s('g');
      root.appendChild(bg); root.appendChild(gLines); root.appendChild(gArrow); root.appendChild(gPanel);
      hl = s('rect', { class: 'fn-hl', rx: 6, height: ROW - 4 });
      gLines.appendChild(hl);
      lines.forEach(function (t, i) {
        var g = s('g', { class: 'fn-codeline' + (t.trim() === '' ? ' is-blank' : '') });
        g.appendChild(s('text', { class: 'fn-ln', x: 10, y: 0, 'dominant-baseline': 'central' }, String(i + 1)));
        g.appendChild(s('text', { class: 'fn-code vz-mono', x: 34, y: 0, 'dominant-baseline': 'central', 'xml:space': 'preserve' }, t));
        g.setAttribute('data-line', i + 1);
        gLines.appendChild(g);
      });
      D = { bg: bg };
      // panel
      gPanel.appendChild(s('text', { class: 'fn-ptitle', x: 0, y: 0, 'data-k': 'tn' }, 'Return notes'));
      gPanel.appendChild(s('text', { class: 'fn-ptitle', x: 0, y: 0, 'data-k': 'tv' }, 'Variables'));
      [5, 6].forEach(function (ln) {
        var n = chip(112, 26, '↩ line ' + ln, 'key', 'fn-note'); n.setAttribute('data-note', ln);
        gPanel.appendChild(n); noteEls[ln] = n; V.place(n, { x: 0, y: 0, opacity: 0 });
      });
      paramEl = s('g', { class: 'fn-params' });
      paramEl.rect = s('rect', { class: 'fn-params__bg', rx: 8, width: 130, height: 28 });
      paramEl.text = s('text', { class: 'fn-params__t vz-mono', x: 10, y: 14, 'dominant-baseline': 'central' }, '');
      paramEl.appendChild(paramEl.rect); paramEl.appendChild(paramEl.text); gPanel.appendChild(paramEl); V.place(paramEl, { opacity: 0 });
      ['kitchen', 'hall', 'total'].forEach(function (nm) {
        var g = chip(124, 24, nm + ' = ?', 'default', 'fn-var'); g.__name = nm; gPanel.appendChild(g); varEls[nm] = g; V.place(g, { x: 0, y: 0, opacity: 0 });
      });
      resEl = chip(58, 22, '= 12', 'done', 'fn-res'); gLines.appendChild(resEl); V.place(resEl, { x: 0, y: 0, opacity: 0 });
      tokEl = s('circle', { class: 'fn-token', r: 6, cx: 0, cy: 0 }); gArrow.appendChild(tokEl); tokEl.style.opacity = 0;
      arrowPath = s('path', { class: 'fn-arrow__line', d: 'M0 0' }); arrowHead = s('path', { class: 'fn-arrow__head', d: 'M0 0' });
      gArrow.insertBefore(arrowPath, tokEl); gArrow.insertBefore(arrowHead, tokEl);
      built = true;
    }
    function draw(step, dur, W, arg, svg) {
      if (!built) build(svg);
      var G = geom(W);
      // definition / caller bands
      V.clear(D.bg);
      D.bg.appendChild(s('rect', { class: 'fn-band fn-band--def', x: 2, y: 4, width: G.codeW, height: 3 * ROW, rx: 8 }));
      if (G.wide) D.bg.appendChild(s('text', { class: 'fn-band__t', x: G.codeW - 10, y: 4 + 12, 'text-anchor': 'end' }, 'the function'));
      D.bg.appendChild(s('rect', { class: 'fn-band fn-band--use', x: 2, y: 4 + 4 * ROW, width: G.codeW, height: 3 * ROW, rx: 8 }));
      if (G.wide) D.bg.appendChild(s('text', { class: 'fn-band__t', x: G.codeW - 10, y: 4 + 4 * ROW + 12, 'text-anchor': 'end' }, 'its callers'));
      V.$$('.fn-codeline', gLines).forEach(function (g, i) {
        g.setAttribute('transform', 'translate(0 ' + yOf(i + 1) + ')');
        g.querySelector('.fn-code').setAttribute('font-size', G.codeW < 260 ? 11.5 : 13.5);
      });
      hl.setAttribute('x', 2); hl.setAttribute('width', G.codeW);
      var ly = step.line ? yOf(step.line) - (ROW - 4) / 2 : -40;
      if (!lastStep) V.place(hl, { y: ly, opacity: step.line ? 1 : 0 }); else mv(hl, { y: ly, opacity: step.line ? 1 : 0 }, dur);
      // panel: notes, the running call's parameters, then variables (stacked, same in both layouts)
      var px = G.px, py = G.py;
      var tn = gPanel.querySelector('[data-k="tn"]'), tv = gPanel.querySelector('[data-k="tv"]');
      tn.setAttribute('x', px); tn.setAttribute('y', py + 14);
      var slotY = py + 26 + 18;
      [5, 6].forEach(function (ln) {
        var el = noteEls[ln], on = step.notes.indexOf(ln) >= 0;
        var tx = px + 60, ty = slotY;
        if (on) {
          if (!el.__on) { V.place(el, { x: G.codeW + 8, y: yOf(ln), opacity: 0, scale: 0.6 }); }
          mv(el, { x: tx, y: ty, opacity: 1, scale: 1 }, dur, 'out');
        } else if (el.__on) {
          mv(el, { x: G.codeW + 8, y: yOf(ln), opacity: 0, scale: 0.6 }, dur, 'in');
        } else V.place(el, { x: G.codeW + 8, y: yOf(ln), opacity: 0 });
        el.__on = on;
      });
      var pt = step.params ? 'inside area:  w = ' + step.params.w + '   h = ' + step.params.h : '';
      paramEl.text.textContent = pt;
      paramEl.rect.setAttribute('width', Math.max(120, tw(pt, 12.5, true, 600) + 22));
      V.place(paramEl, { x: px, y: py + 26 + 42 });
      mv(paramEl, { opacity: step.params ? 1 : 0 }, dur);
      tv.setAttribute('x', px); tv.setAttribute('y', py + 26 + 42 + 50);
      ['kitchen', 'hall', 'total'].forEach(function (nm, i) {
        var g = varEls[nm], v = step.values[nm], shown = v !== undefined;
        var vx = px + 62, vy = py + 26 + 42 + 50 + 18 + i * 28;
        g.text.textContent = nm + ' = ' + (shown ? v : '?');
        cls(g, 'vz-item fn-chip fn-var', shown ? 'done' : 'default');
        V.place(g, { x: vx, y: vy });
        mv(g, { opacity: shown ? 1 : 0.4 }, dur);
        if (shown && g.__val !== v && dur) { mv(g, { scale: 1.12 }, dur * 0.35, 'out').then(function () { return mv(g, { scale: 1 }, dur * 0.4, 'inOut'); }); }
        g.__val = shown ? v : undefined;
      });
      // result badge next to the return line
      if (step.result !== null) {
        resEl.text.textContent = '= ' + step.result;
        V.place(resEl, { x: Math.min(G.codeW - 44, 34 + tw(lines[1], 13.5, true) + 46), y: yOf(2) });
        mv(resEl, { opacity: 1 }, dur);
      } else mv(resEl, { opacity: 0 }, dur * 0.6);
      // the jump
      if (step.arrow) {
        var x0 = G.codeW - 4, y1 = yOf(step.arrow.from), y2 = yOf(step.arrow.to), bulge = 26 + Math.abs(y1 - y2) * 0.05;
        var d = 'M' + x0 + ' ' + y1 + ' C' + (x0 + bulge) + ' ' + y1 + ' ' + (x0 + bulge) + ' ' + y2 + ' ' + x0 + ' ' + y2;
        arrowPath.setAttribute('d', d);
        arrowHead.setAttribute('d', 'M' + x0 + ' ' + y2 + ' l10 -5 l0 10 z');
        arrowPath.setAttribute('class', 'fn-arrow__line is-' + step.arrow.kind); arrowHead.setAttribute('class', 'fn-arrow__head is-' + step.arrow.kind); tokEl.setAttribute('class', 'fn-token is-' + step.arrow.kind);
        arrowPath.style.opacity = 1; arrowHead.style.opacity = 1;
        if (dur && arg !== 'instant') {
          var len = arrowPath.getTotalLength();
          tokEl.style.opacity = 1;
          arrowPath.__tw && arrowPath.__tw.cancel();
          arrowPath.__tw = V.tween(dur * 1.1, function (t, e) {
            var p = arrowPath.getPointAtLength(len * e);
            tokEl.setAttribute('cx', p.x); tokEl.setAttribute('cy', p.y);
            arrowPath.style.strokeDasharray = len; arrowPath.style.strokeDashoffset = len * (1 - e);
            if (t >= 1) { tokEl.style.opacity = 0; arrowPath.style.strokeDasharray = ''; arrowPath.style.strokeDashoffset = ''; }
          }, { ease: 'inOut' });
        } else { tokEl.style.opacity = 0; arrowPath.style.strokeDasharray = ''; arrowPath.style.strokeDashoffset = ''; }
      } else {
        arrowPath.__tw && arrowPath.__tw.cancel();
        arrowPath.style.opacity = 0; arrowHead.style.opacity = 0; tokEl.style.opacity = 0;
      }
      lastStep = step;
      return G.H;
    }
    return {
      render: function (step, ctx) { fig.render(step, ctx.duration, ctx.instant ? 'instant' : undefined); }
    };
  };

  /* ================================================================== intuition: a pile of notes (stack view + what you are doing) */
  FN.notesFig = function (stage) {
    stage.classList.add('fn-notes');
    var now = h('div', { class: 'fn-now', role: 'status' }, h('span', { class: 'fn-now__label' }, 'You are doing'), h('span', { class: 'fn-now__what' }));
    var pileHost = h('div', { class: 'fn-notes__pile' });
    stage.appendChild(now); stage.appendChild(pileHost);
    var view = V.views.stack(pileHost, { label: 'Pile of notes, newest on top', cellWidth: 190, cellSize: 36, capacity: 3 });
    var what = now.querySelector('.fn-now__what');
    return {
      prepare: function (steps) { view.reset(); view.prepare(steps.map(toState)); },
      render: function (step, ctx) {
        what.textContent = step.now;
        now.setAttribute('data-state', step.nowState);
        view.render(toState(step), { duration: ctx.duration });
      }
    };
    function toState(step) {
      return { items: step.items.map(function (it, i) { return { id: it.id, value: it.value, state: i === step.items.length - 1 ? 'key' : 'frontier' }; }), capacity: 3, label: 'notes' };
    }
  };

  /* ================================================================== a call, piece by piece */
  FN.argsFig = function (stage) {
    var VW = 340, MONO = 9.6, FS = 16;
    var svg = s('svg', { class: 'vz fn fn-args', viewBox: '0 0 ' + VW + ' 304', role: 'img', 'aria-label': 'A function definition with two parameters, and a call whose arguments are copied into them; the returned value replaces the call.' });
    stage.appendChild(svg);
    function T(x, y, text, cl, anchor) { var t = s('text', { class: 'fn-t vz-mono ' + (cl || ''), x: x, y: y, 'font-size': FS, 'dominant-baseline': 'central', 'text-anchor': anchor || 'start' }, text); svg.appendChild(t); return t; }
    function label(x, y, text) { var t = s('text', { class: 'fn-sec', x: x, y: y, 'dominant-baseline': 'central' }, text); svg.appendChild(t); return t; }
    function slot(x, y, w, hh, st, text) { var g = chip(w, hh, text, st); V.place(g, { x: x, y: y }); svg.appendChild(g); return g; }
    svg.appendChild(s('rect', { class: 'fn-panel', x: 6, y: 34, width: VW - 12, height: 122, rx: 12 }));
    svg.appendChild(s('rect', { class: 'fn-panel fn-panel--call', x: 6, y: 194, width: VW - 12, height: 96, rx: 12 }));
    label(20, 18, 'DEFINITION · a recipe with empty slots');
    label(20, 178, 'CALL · the moment it runs');
    // definition, line 1:  function area( [w] , [h] ) {
    var x = 22, y1 = 66, y2 = 112;
    T(x, y1, 'function area(');
    var pxW = x + 14 * MONO + 24, pxH = pxW + 16 + 20 + 22;
    var slotW = slot(pxW, y1, 34, 28, 'default', 'w'), slotH = slot(pxH, y1, 34, 28, 'default', 'h');
    T(pxW + 22, y1, ',');
    T(pxH + 26, y1, ') {');
    T(x + 22, y2, 'return');
    var bodyX = x + 22 + 6 * MONO + 30;
    var bodyW = slot(bodyX, y2, 34, 28, 'default', 'w'), bodyH = slot(bodyX + 34 + 26 + 14, y2, 34, 28, 'default', 'h');
    T(bodyX + 33, y2, '×', 'fn-op');
    T(bodyX + 34 + 26 + 14 + 26, y2, ';  }');
    var slotNameW = T(pxW, y1 - 26, 'w', 'fn-slotname'), slotNameH = T(pxH, y1 - 26, 'h', 'fn-slotname');
    slotNameW.setAttribute('text-anchor', 'middle'); slotNameH.setAttribute('text-anchor', 'middle');
    slotNameW.setAttribute('font-size', 12.5); slotNameH.setAttribute('font-size', 12.5);
    // call:  kitchen = area( [3] , [4] )
    var yc = 240, kx = 22;
    T(kx, yc, 'kitchen =');
    var callX = kx + 10 * MONO + 8;
    var callG = s('g', { class: 'fn-callgroup' }); svg.appendChild(callG);
    var callTxt = s('text', { class: 'fn-t vz-mono', x: callX, y: yc, 'font-size': FS, 'dominant-baseline': 'central' }, 'area(');
    callG.appendChild(callTxt);
    var ax = callX + 5 * MONO + 22, bx = ax + 22 + 16 + 24;
    callG.appendChild(s('text', { class: 'fn-t vz-mono', x: ax + 22, y: yc, 'font-size': FS, 'dominant-baseline': 'central' }, ','));
    callG.appendChild(s('text', { class: 'fn-t vz-mono', x: bx + 24, y: yc, 'font-size': FS, 'dominant-baseline': 'central' }, ')'));
    var argA = chip(34, 28, '3', 'default'), argB = chip(34, 28, '4', 'default');
    V.place(argA, { x: ax, y: yc }); V.place(argB, { x: bx, y: yc });
    callG.appendChild(argA); callG.appendChild(argB);
    var argNote = T(ax + 12, yc + 30, 'arguments', 'fn-slotname'); argNote.setAttribute('text-anchor', 'middle'); argNote.setAttribute('font-size', 12.5); argNote.style.opacity = 0;
    argNote.setAttribute('x', (ax + bx) / 2);
    var copyA = chip(34, 28, '3', 'active'), copyB = chip(34, 28, '4', 'active'); svg.appendChild(copyA); svg.appendChild(copyB);
    V.place(copyA, { x: ax, y: yc, opacity: 0 }); V.place(copyB, { x: bx, y: yc, opacity: 0 });
    var resX = kx + 10 * MONO + 8 + 20;
    var res = chip(46, 28, '12', 'done'); svg.appendChild(res); V.place(res, { x: bodyX + 34 + 26 + 14 + 80, y: y2, opacity: 0 });
    var prod = T(bodyX + 34 + 26 + 14 + 68, y2 + 26, '', 'fn-prod'); prod.setAttribute('font-size', 12); prod.style.opacity = 0;
    prod.setAttribute('x', bodyX + 2); prod.setAttribute('y', y2 + 30);
    var callLabelNote = T(VW / 2, yc + 30, '', 'fn-slotname', 'middle'); callLabelNote.setAttribute('font-size', 12.5);

    function fill(el, text, st, name) { el.text.textContent = text; cls(el, 'vz-item fn-chip', st); }
    return function render(step, ctx) {
      var d = ctx.duration, p = step.phase, w = step.w, hh = step.h, pr = step.p;
      svg.style.setProperty('--vz-dur', d + 'ms');
      var inst = ctx.instant || !d;
      // parameters and body
      var filled = p >= 2 && p <= 4, bodyFilled = p >= 3 && p <= 4;
      fill(slotW, filled ? num(w) : 'w', filled ? 'key' : 'default'); fill(slotH, filled ? num(hh) : 'h', filled ? 'key' : 'default');
      slotNameW.style.opacity = filled ? 1 : 0; slotNameH.style.opacity = filled ? 1 : 0;
      fill(bodyW, bodyFilled ? num(w) : 'w', bodyFilled ? 'compare' : 'default'); fill(bodyH, bodyFilled ? num(hh) : 'h', bodyFilled ? 'compare' : 'default');
      slotW.rect.classList.toggle('is-empty', !filled); slotH.rect.classList.toggle('is-empty', !filled);
      // arguments
      fill(argA, num(w), p === 1 ? 'active' : 'default'); fill(argB, num(hh), p === 1 ? 'active' : 'default');
      mv(argNote, { opacity: p >= 1 && p <= 2 ? 1 : 0 }, d);
      // copies fly during phase 2, then vanish once the slots are filled
      copyA.text.textContent = num(w); copyB.text.textContent = num(hh);
      if (p === 2 && !inst && ctx.direction >= 0) {
        V.place(copyA, { x: ax, y: yc, opacity: 1 }); V.place(copyB, { x: bx, y: yc, opacity: 1 });
        mv(copyA, { x: pxW, y: y1 }, d * 0.95, 'inOut').then(function () { return mv(copyA, { opacity: 0 }, 120); });
        mv(copyB, { x: pxH, y: y1 }, d * 0.95, 'inOut').then(function () { return mv(copyB, { opacity: 0 }, 120); });
      } else { V.place(copyA, { opacity: 0, x: ax, y: yc }); V.place(copyB, { opacity: 0, x: bx, y: yc }); }
      // product and the returned value
      prod.textContent = p >= 3 && p <= 4 ? num(w) + ' × ' + num(hh) + ' = ' + num(pr) : '';
      mv(prod, { opacity: p >= 3 && p <= 4 ? 1 : 0 }, d);
      res.text.textContent = num(pr);
      var bodyPos = { x: bodyX + 34 + 26 + 14 + 96, y: y2 }, callPos = { x: callX + 30, y: yc };
      if (p < 3) { V.place(res, { opacity: 0, x: bodyPos.x, y: bodyPos.y }); }
      else if (p === 3) { if (ctx.direction <= 0 || inst) V.place(res, { x: bodyPos.x, y: bodyPos.y, opacity: 0 }); mv(res, { opacity: 0, x: bodyPos.x, y: bodyPos.y }, d); }
      else if (p === 4) { if (res.style.opacity === '0' || inst) V.place(res, { x: bodyPos.x, y: bodyPos.y, opacity: 1 }); else V.place(res, { x: bodyPos.x, y: bodyPos.y, opacity: 1 }); if (!inst) { mv(res, { x: callPos.x, y: callPos.y }, d * 0.95, 'inOut'); } else V.place(res, { x: callPos.x, y: callPos.y }); }
      else { V.place(res, { x: callPos.x, y: callPos.y, opacity: 1 }); }
      if (p === 3) { V.place(res, { x: bodyPos.x, y: bodyPos.y }); mv(res, { opacity: 1 }, d); }
      // the call expression disappears when its value takes its place
      mv(callG, { opacity: p >= 4 ? 0.0 : (p === 0 ? 0.45 : 1) }, d);
      callLabelNote.textContent = p === 5 ? 'the call is replaced by its value' : '';
    };
  };

  /* ================================================================== nested calls: a timeline of who was running when */
  FN.timelineFig = function (stage, opts) {
    opts = opts || {};
    var store = null, gBars, playhead, axis, rowLbls = [], built = false;
    var fig = pxFig(stage, { label: opts.label || 'Timeline of calls: every call sits inside the bar of its caller', cls: 'fn-timeline', minWidth: 260, draw: draw });
    var ROWH = 34, TOP = 26;
    function draw(state, dur, W, arg, svg) {
      var step = state, n = opts.total || 14, maxD = opts.rows || 3;
      if (!built) {
        built = true;
        gBars = s('g'); axis = s('g', { class: 'fn-axis' });
        svg.appendChild(axis); svg.appendChild(gBars);
        playhead = s('line', { class: 'fn-playhead', y1: 4 }); svg.appendChild(playhead);
        store = new Keyed(gBars);
        for (var r = 0; r < maxD; r++) rowLbls.push(s('text', { class: 'fn-rowlbl', x: 0, 'dominant-baseline': 'central' }, r === 0 ? 'caller' : r === 1 ? 'callee' : 'deeper'));
        rowLbls.forEach(function (t) { axis.appendChild(t); });
        axis.appendChild(s('text', { class: 'fn-axis__t', 'text-anchor': 'end', 'dominant-baseline': 'central', 'data-k': 'time' }, 'time →'));
        for (var k = 0; k < maxD; k++) axis.appendChild(s('line', { class: 'fn-lane', 'data-lane': k }));
      }
      var left = 6, right = W - 10, u = (right - left) / n;
      var H = TOP + maxD * ROWH + 26;
      rowLbls.forEach(function (t) { t.style.display = 'none'; });
      V.$$('.fn-lane', axis).forEach(function (ln) { var k = +ln.getAttribute('data-lane'); ln.setAttribute('x1', left); ln.setAttribute('x2', right); ln.setAttribute('y1', TOP + k * ROWH + ROWH); ln.setAttribute('y2', TOP + k * ROWH + ROWH); });
      var tt = axis.querySelector('[data-k="time"]'); tt.setAttribute('x', right); tt.setAttribute('y', H - 8);
      var top = step.frames && step.frames.length ? step.frames[step.frames.length - 1].id : null;
      store.begin();
      step.bars.forEach(function (b) {
        var g = store.use(b.id, function () {
          var e = s('g', { class: 'vz-item fn-bar' });
          e.rect = s('rect', { class: 'vz-shape', height: ROWH - 8, rx: 8 });
          e.text = s('text', { class: 'vz-ink vz-mono', 'dominant-baseline': 'central', 'font-size': 12.5 });
          e.appendChild(e.rect); e.appendChild(e.text);
          e.setAttribute('data-id', b.id); e.setAttribute('data-label', b.label);
          return e;
        });
        var open = b.end === null, endU = open ? step.now + 0.7 : b.end;
        var x = left + b.start * u, w = Math.max(6, (endU - b.start) * u - 3), y = TOP + b.depth * ROWH + 4;
        var st = open ? (b.id === top ? 'active' : 'frontier') : (opts.plain ? 'visited' : 'done');
        cls(g, 'vz-item fn-bar' + (open ? ' is-open' : ''), st);
        var short = b.label.replace(/\(.*$/, '');
        var full = tw(b.label, 12.5, true, 650) + 14 < w, name = tw(short, 12.5, true, 650) + 12 < w;
        g.text.textContent = full ? b.label : (name ? short : '');
        g.text.setAttribute('x', 8); g.text.setAttribute('y', (ROWH - 8) / 2);
        V.place(g, { x: x, y: y });
        if (g.__new && dur) { g.rect.setAttribute('width', 6); }
        mv(g.rect, { attr: { width: w } }, dur, 'out');
        if (!dur) g.rect.setAttribute('width', w);
      });
      store.sweep().forEach(function (g) { g.remove(); });
      var px = left + (step.now + (step.bars.some(function (b) { return b.end === null; }) ? 0.35 : 0)) * u;
      playhead.setAttribute('y2', TOP + maxD * ROWH + 4);
      if (opts.plain) playhead.style.opacity = 0; else mv(playhead, { x: px }, dur);
      return H;
    }
    return { render: function (step, ctx) { fig.render(step, ctx.duration); } };
  };

  /* ================================================================== scope bubbles */
  FN.scopeFig = function (root, sel) {
    var scopes = {
      global: { label: 'global', names: ['rate', 'double', 'main'] },
      main: { label: 'main()', names: ['x', 'y'] },
      double: { label: 'double(n)', names: ['n', 'result'] }
    };
    var owner = {};
    Object.keys(scopes).forEach(function (k) { scopes[k].names.forEach(function (n) { owner[n] = k; }); });
    var running = 'main', chips = {}, bubbles = {}, busy = null;
    var out = root.querySelector('[data-out]');
    var world = root.querySelector('[data-world]');
    function bubble(key, children) {
      var b = h('div', { class: 'fn-bubble fn-bubble--' + key, 'data-scope': key, role: 'group', 'aria-label': 'Scope of ' + scopes[key].label },
        h('div', { class: 'fn-bubble__head' }, h('span', { class: 'fn-bubble__name' }, scopes[key].label), h('span', { class: 'fn-bubble__tag' }, key === 'global' ? 'visible everywhere' : 'visible inside only')),
        h('div', { class: 'fn-bubble__names' }, scopes[key].names.map(function (n) {
          var isFn = n === 'double' || n === 'main';
          var c = h('button', { class: 'fn-name', type: 'button', 'data-name': n, 'aria-label': 'Look up ' + n + ' from the running code', onclick: function () { lookup(n); } }, h('span', { class: 'fn-name__t' }, n + (isFn ? '()' : '')), h('span', { class: 'fn-name__v' }, ''));
          chips[n] = c; return c;
        })), children || null);
      bubbles[key] = b; return b;
    }
    V.clear(world);
    world.appendChild(bubble('global', h('div', { class: 'fn-bubble__inner' }, bubble('main'), bubble('double'))));
    var vals = { rate: '3', x: '5', y: '15', n: '5', result: '15' };
    Object.keys(vals).forEach(function (n) { chips[n].querySelector('.fn-name__v').textContent = vals[n]; });
    function visible(name) { return owner[name] === running || owner[name] === 'global'; }
    function paint() {
      Object.keys(chips).forEach(function (n) { chips[n].classList.toggle('is-visible', visible(n)); chips[n].classList.toggle('is-hidden', !visible(n)); chips[n].classList.remove('is-hit', 'is-miss'); });
      Object.keys(bubbles).forEach(function (k) { bubbles[k].classList.toggle('is-running', k === running); bubbles[k].classList.remove('is-looking'); });
      root.classList.toggle('is-idle', true);
    }
    function say(html, kind) { out.innerHTML = html; out.setAttribute('data-kind', kind || ''); }
    function lookup(name) {
      if (busy) { busy.forEach(clearTimeout); busy = null; paint(); }
      paint();
      var own = running, path = own === 'global' ? ['global'] : [own, 'global'];
      var inOwn = owner[name] === own, inGlobal = owner[name] === 'global';
      var seq = [], t = 0, step = V.reducedMotion() ? 0 : 520;
      function at(fn) { seq.push(setTimeout(fn, t)); t += step; }
      say('Looking up <code>' + name + '</code> from code running in <b>' + scopes[running].label + '</b>…', 'search');
      var found = inOwn ? own : (inGlobal ? 'global' : null);
      path.forEach(function (k) {
        at(function () { Object.keys(bubbles).forEach(function (b) { bubbles[b].classList.remove('is-looking'); }); bubbles[k].classList.add('is-looking'); });
        if (found === k) return;
      });
      // stop the search once found: only scopes up to `found` are searched
      seq.forEach(clearTimeout); seq = []; t = 0;
      var searched = [];
      for (var i = 0; i < path.length; i++) { searched.push(path[i]); if (path[i] === found) break; }
      searched.forEach(function (k) { at(function () { Object.keys(bubbles).forEach(function (b) { bubbles[b].classList.remove('is-looking'); }); bubbles[k].classList.add('is-looking'); }); });
      at(function () {
        Object.keys(bubbles).forEach(function (b) { bubbles[b].classList.remove('is-looking'); });
        if (found) {
          chips[name].classList.add('is-hit');
          say('<b>Found</b> <code>' + name + '</code> in <b>' + scopes[found].label + '</b>' + (found === 'global' && own !== 'global' ? ' after checking <b>' + scopes[own].label + '</b> first' : '') + '. Its value is <b>' + vals[name] + '</b>.', 'hit');
        } else {
          chips[name].classList.add('is-miss');
          say('<b>Not found.</b> The search checked ' + searched.map(function (k) { return '<b>' + scopes[k].label + '</b>'; }).join(' and then ') + ' and stopped. <code>' + name + '</code> belongs to <b>' + scopes[owner[name]].label + '</b>, whose frame is not part of this search: <code>ReferenceError: ' + name + ' is not defined</code>.', 'miss');
        }
        busy = null;
      });
      busy = seq;
    }
    var seg = V.segmented(root.querySelector('[data-seg]'), {
      label: 'Code running in', value: running, options: [{ value: 'main', label: 'main()' }, { value: 'double', label: 'double(n)' }, { value: 'global', label: 'global code' }],
      onChange: function (v) { running = v; if (busy) { busy.forEach(clearTimeout); busy = null; } paint(); say('Now the running code is in <b>' + scopes[v].label + '</b>. Green names can be read from here; dashed ones cannot. Click any name to look it up.', ''); }
    });
    paint();
    say('Green names can be read from the running code; dashed ones cannot. Click a name to look it up, or change where the code is running.', '');
    return { seg: seg, lookup: lookup, setRunning: function (v) { seg.set(v); } };
  };

  /* ================================================================== process memory layout */
  FN.layoutFig = function (stage, info) {
    var VW = 426, VH = 458, cx = 130, cw = 200, top = 30, bottom = 416;
    var svg = s('svg', { class: 'vz fn fn-layout', viewBox: '0 0 ' + VW + ' ' + VH, role: 'group', 'aria-label': 'Address space of a running program: code and globals at low addresses, the heap growing up, the stack growing down from high addresses.' });
    stage.appendChild(svg);
    var stackMax = 12, heapMax = 8, SL = 22;
    var regions = {}, order = ['stack', 'free', 'heap', 'globals', 'code'];
    var infoEl = info;
    var texts = {
      stack: '<b>Stack.</b> One frame per call still running: parameters, locals and the return address. It grows <em>down</em> toward the heap when you call, and shrinks when calls return. Its size is limited.',
      free: '<b>Free space.</b> Unused address space between the two growing regions. If the stack grows all the way across it, the program crashes with a stack overflow.',
      heap: '<b>Heap.</b> Arrays and objects live here. They outlive the call that made them, and are reached through references. It grows <em>up</em> as more objects are made.',
      globals: '<b>Globals.</b> Variables declared outside every function. They exist for the whole run and every function can see them.',
      code: '<b>Code.</b> The program itself, as instructions. The return address stored in a frame points back into this region.'
    };
    function box(key, y, hh, extra) {
      var g = s('g', { class: 'vz-item fn-region fn-region--' + key + ' is-default', tabindex: 0, role: 'button', 'aria-label': key + ' region. ' + texts[key].replace(/<[^>]+>/g, ''), 'data-key': key });
      g.rect = s('rect', { class: 'vz-shape', x: cx, y: y, width: cw, height: hh, rx: 6 });
      g.appendChild(g.rect);
      return g;
    }
    var gR = s('g'); svg.appendChild(gR);
    var y0 = top, hStack = 0;
    var defs = { code: 24, globals: 24 };
    var regionOrder = [['stack', 'Stack'], ['free', 'Free space'], ['heap', 'Heap'], ['globals', 'Globals'], ['code', 'Code']];
    regionOrder.forEach(function (r) { var g = box(r[0], 0, 10); regions[r[0]] = g; gR.appendChild(g); });
    // region labels on the right
    var labels = {};
    regionOrder.forEach(function (r) { var t = s('text', { class: 'fn-rl', x: cx + cw + 14, 'dominant-baseline': 'central' }, r[1]); svg.appendChild(t); labels[r[0]] = t; });
    // address ticks
    svg.appendChild(s('text', { class: 'fn-addr', x: cx, y: top - 10 }, 'high addresses'));
    svg.appendChild(s('text', { class: 'fn-addr', x: cx, y: bottom + 18 }, 'low addresses'));
    // slabs: frames in the stack, blocks in the heap
    var slabs = [], blocks = [];
    for (var i = 0; i < stackMax; i++) { var sl = chip(cw - 16, SL - 3, i === 0 ? 'main' : 'call ' + i, 'frontier', 'fn-slab'); gR.appendChild(sl); slabs.push(sl); V.place(sl, { x: cx + cw / 2, y: 0, opacity: 0 }); }
    for (var j = 0; j < heapMax; j++) { var bl = chip(cw - 16, SL - 3, 'object ' + (j + 1), 'visited', 'fn-slab'); gR.appendChild(bl); blocks.push(bl); V.place(bl, { x: cx + cw / 2, y: 0, opacity: 0 }); }
    // growth arrows
    var arrS = s('path', { class: 'fn-grow fn-grow--stack', d: 'M0 0' }), arrH = s('path', { class: 'fn-grow fn-grow--heap', d: 'M0 0' });
    svg.appendChild(arrS); svg.appendChild(arrH);
    var txS = s('text', { class: 'fn-gt', x: cx - 30, 'text-anchor': 'end', 'dominant-baseline': 'central' }, 'grows down'), txH = s('text', { class: 'fn-gt', x: cx - 30, 'text-anchor': 'end', 'dominant-baseline': 'central' }, 'grows up');
    svg.appendChild(txS); svg.appendChild(txH);
    var crash = s('g', { class: 'fn-crash' }, s('text', { x: cx + cw + 14, y: 0, 'dominant-baseline': 'central' }, '◀ OVERFLOW'));
    svg.appendChild(crash); crash.style.opacity = 0;
    var cur = null;

    function layout(frames, objs, crashed, dur) {
      var fixedCode = 30, fixedGlob = 30, gap = 4;
      var total = bottom - top;
      var hStackR = Math.max(SL * frames + 8, 26), hHeapR = Math.max(SL * objs + 8, 26);
      var rawFree = total - fixedCode - fixedGlob - hStackR - hHeapR;
      if (rawFree <= 2) { crashed = true; if (rawFree < 0) hStackR += rawFree; }
      var hFree = Math.max(rawFree, 0);
      var y = top, R = {};
      R.stack = { y: y, h: hStackR }; y += hStackR;
      R.free = { y: y, h: hFree }; y += hFree;
      R.heap = { y: y, h: hHeapR }; y += hHeapR;
      R.globals = { y: y, h: fixedGlob }; y += fixedGlob;
      R.code = { y: y, h: fixedCode };
      var stateOf = { stack: crashed ? 'error' : 'frontier', free: 'default', heap: 'visited', globals: 'key', code: 'compare' };
      regionOrder.forEach(function (r) {
        var k = r[0], g = regions[k];
        cls(g, 'vz-item fn-region fn-region--' + k + (g.classList.contains('is-selected') ? ' is-selected' : ''), stateOf[k]);
        if (g.classList.contains('is-selected')) g.classList.add('is-selected');
        g.classList.toggle('is-tiny', R[k].h < 18);
        mv(g.rect, { attr: { y: R[k].y, height: Math.max(R[k].h, 0) } }, dur);
        mv(labels[k], { attr: { y: R[k].y + R[k].h / 2 } }, dur);
        labels[k].style.opacity = R[k].h < 8 ? 0 : 1;
      });
      slabs.forEach(function (sl, i) { var on = i < frames; mv(sl, { x: cx + cw / 2, y: R.stack.y + 4 + SL * i + SL / 2, opacity: on ? 1 : 0 }, dur, 'out'); cls(sl, 'vz-item fn-chip fn-slab', crashed && i === frames - 1 ? 'error' : 'frontier'); });
      blocks.forEach(function (bl, j) { var on = j < objs; mv(bl, { x: cx + cw / 2, y: R.heap.y + R.heap.h - 4 - SL * j - SL / 2, opacity: on ? 1 : 0 }, dur, 'out'); });
      var sy = R.stack.y + R.stack.h + 4, hy = R.heap.y - 4;
      arrS.setAttribute('d', 'M' + (cx - 16) + ' ' + (R.stack.y + 6) + ' V' + (R.stack.y + R.stack.h - 4) + ' m-5 -7 l5 8 l5 -8');
      arrH.setAttribute('d', 'M' + (cx - 16) + ' ' + (R.heap.y + R.heap.h - 6) + ' V' + (R.heap.y + 4) + ' m-5 7 l5 -8 l5 8');
      txS.setAttribute('y', R.stack.y + R.stack.h / 2); txH.setAttribute('y', R.heap.y + R.heap.h / 2);
      arrS.style.opacity = R.stack.h < 24 ? 0 : 1; arrH.style.opacity = R.heap.h < 24 ? 0 : 1; txS.style.opacity = arrS.style.opacity; txH.style.opacity = arrH.style.opacity;
      crash.querySelector('text').setAttribute('y', R.heap.y - 12);
      mv(crash, { opacity: crashed ? 1 : 0 }, dur);
      cur = { frames: frames, objs: objs, crashed: crashed };
      return crashed;
    }
    function select(key) {
      Object.keys(regions).forEach(function (k) { regions[k].classList.toggle('is-selected', k === key); });
      if (infoEl) infoEl.innerHTML = texts[key];
    }
    Object.keys(regions).forEach(function (k) {
      var g = regions[k];
      g.addEventListener('click', function () { select(k); });
      g.addEventListener('mouseenter', function () { select(k); });
      g.addEventListener('focus', function () { select(k); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(k); } });
    });
    layout(1, 0, false, 0);
    if (infoEl) infoEl.innerHTML = 'Hover, tap or focus a region to read what lives there. Then change the phase and watch the two growing regions.';
    return {
      set: function (frames, objs, crashed, dur) {
        var c = layout(frames, objs, !!crashed, dur === undefined ? 600 : dur);
        if (c && infoEl) infoEl.innerHTML = '<b>Stack overflow.</b> The stack has grown across the free space and reached the heap. The program cannot make another call, so the runtime stops it with an error.';
        return c;
      },
      select: select,
      stackMax: stackMax
    };
  };

  /* ================================================================== summary tiles */
  FN.summaryTiles = function () {
    function sv(label, kids) { var e = s('svg', { class: 'vz fn', viewBox: '0 0 120 64', role: 'img', 'aria-label': label }); [].concat.apply([], kids).forEach(function (k) { e.appendChild(k); }); return e; }
    function bar(x, y, w, t, st) { return s('g', { class: 'vz-item is-' + st }, s('rect', { class: 'vz-shape', x: x, y: y, width: w, height: 13, rx: 5 }), s('text', { class: 'vz-ink vz-mono', x: x + w / 2, y: y + 6.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 9.5 }, t)); }
    function arr(x, y, vals, st) { return vals.map(function (v, i) { return s('g', { class: 'vz-item is-' + (st || 'default') }, s('rect', { class: 'vz-shape', x: x + i * 14, y: y, width: 14, height: 14 }), s('text', { class: 'vz-ink vz-mono', x: x + i * 14 + 7, y: y + 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 9.5 }, String(v))); }); }
    function line(d, cl) { return s('path', { class: 'fn-sum-line ' + (cl || ''), d: d }); }
    return [
      { svg: sv('frames stacked on a call stack', [bar(26, 47, 68, 'main', 'frontier'), bar(26, 32, 68, 'area', 'frontier'), bar(26, 17, 68, 'multiply', 'active'), line('M100 22 V52', 'is-ret'), s('path', { class: 'fn-sum-head', d: 'M100 54 l-4 -7 h8 z' })]), label: 'A call pushes a frame', text: 'Frames stack up. Only the top one runs, and the last call is the first to finish.' },
      { svg: sv('a frame holds parameters and locals', [s('rect', { class: 'fn-sum-frame', x: 20, y: 8, width: 80, height: 48, rx: 7 }), s('text', { class: 'fn-sum-t', x: 28, y: 18, 'font-size': 9.5 }, 'area(w, h)'), bar(28, 25, 30, 'w  3', 'swap'), bar(62, 25, 30, 'h  4', 'swap'), bar(28, 41, 64, '↩ to main', 'default')]), label: 'A frame is private', text: 'Parameters, locals and where to resume. All of it is gone when the call returns.' },
      { svg: sv('two variables refer to one heap array', [bar(6, 12, 34, 'xs', 'key'), bar(6, 38, 34, 'ys', 'key'), line('M42 18 C60 18 64 30 76 30'), line('M42 44 C60 44 64 34 76 34'), arr(76, 24, [1, 2, 3], 'visited')]), label: 'References share', text: 'Copying a reference copies the arrow, not the array. A change through one is seen through both.' },
      { svg: sv('copying a number makes two separate boxes', [bar(6, 12, 34, 'a  5', 'swap'), bar(6, 38, 34, 'b  5', 'swap'), s('text', { class: 'fn-sum-t', x: 60, y: 36, 'text-anchor': 'middle', 'font-size': 9.5 }, 'b += 1'), line('M43 45 H77', 'is-ret'), bar(80, 12, 34, 'a  5', 'default'), bar(80, 38, 34, 'b  6', 'done')]), label: 'Numbers are copied', text: 'A function cannot change its caller’s number variables. It can only return a new value.' },
      { svg: sv('rebinding breaks the link', [bar(6, 8, 34, 'list', 'key'), bar(6, 42, 34, 'xs', 'key'), line('M42 14 C56 14 60 20 72 20'), line('M42 48 C58 48 66 52 78 52', 'is-new'), s('g', {}, arr(72, 14, [1, 2], 'visited')), s('g', {}, arr(78, 46, [9], 'muted'))]), label: 'Mutate or rebind?', text: 'push follows the arrow and changes the shared array. xs = […] only moves your own arrow.' },
      { svg: sv('stack and heap growing toward each other', [s('rect', { class: 'fn-sum-region is-stack', x: 22, y: 4, width: 76, height: 22, rx: 4 }), s('rect', { class: 'fn-sum-region is-heap', x: 22, y: 40, width: 76, height: 20, rx: 4 }), s('path', { class: 'fn-sum-line', d: 'M48 28 V36 m-3 -3 l3 4 l3 -4' }), s('path', { class: 'fn-sum-line', d: 'M72 38 V30 m-3 3 l3 -4 l3 4' }), s('text', { class: 'fn-sum-t', x: 28, y: 15, 'font-size': 8.5, 'dominant-baseline': 'central' }, 'stack ↓'), s('text', { class: 'fn-sum-t', x: 28, y: 50, 'font-size': 8.5, 'dominant-baseline': 'central' }, 'heap ↑')]), label: 'The stack is finite', text: 'Too many nested calls with no base case fill it, and the program crashes.' }
    ];
  };
}());
