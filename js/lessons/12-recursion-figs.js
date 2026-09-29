/* Lesson 12 · Recursion — custom figures (SVG drawn in CSS pixels, re-laid out on resize).
   Registered on VDSA.lessons.rec and started by js/lessons/12-recursion.js.

   Every figure follows the renderer contract (docs/ENGINE.md §13): elements are built once per input and
   keyed by id; each render moves them (VDSA.animate / one tween) instead of redrawing; colours come from
   state classes (.vz .is-<state>, css/viz.css) or the lesson's --st-* based classes; durations come from
   the player's ctx.duration, so reduced motion and speed work for free. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s, h = V.h;
  var RC = (V.lessons = V.lessons || {}).rec = (V.lessons && V.lessons.rec) || {};

  /* ------------------------------------------------------------------ helpers */
  function tw(text, px, mono, weight) { return V.vz ? V.vz.textWidth(String(text), px, !!mono, weight || 600) : String(text).length * px * 0.6; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mv(el, props, dur, ease) { return V.animate(el, props, { duration: dur, ease: ease || 'inOut' }); }
  function setState(el, base, state) { el.setAttribute('class', base + ' is-' + (state || 'default')); }

  /* A figure drawn in CSS pixels: viewBox width = rendered width, so text stays crisp at every size. */
  function pxFig(stage, opts) {
    var svg = s('svg', { class: 'vz rc ' + (opts.cls || ''), role: 'img', 'aria-label': opts.label || '' });
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
      var H = opts.draw(state, dur || 0, W, arg);
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
  RC.pxFig = pxFig;
  RC.tw = tw;

  /* Keyed element store for custom figures: use(id, build) returns the element, sweep() returns the leftovers. */
  function Keyed(parent) { this.parent = parent; this.map = {}; this.seen = null; }
  Keyed.prototype.begin = function () { this.seen = {}; };
  Keyed.prototype.use = function (id, build) {
    this.seen[id] = true;
    var el = this.map[id];
    if (!el) { el = build(); el.__new = true; this.parent.appendChild(el); this.map[id] = el; }
    else el.__new = false;
    return el;
  };
  Keyed.prototype.sweep = function () {
    var out = [], self = this;
    Object.keys(this.map).forEach(function (id) { if (!self.seen[id]) { out.push(self.map[id]); delete self.map[id]; } });
    return out;
  };
  function fadeOut(el, dur, props) {
    var p = Object.assign({ opacity: 0 }, props || {});
    if (!dur) { el.remove(); return; }
    mv(el, p, dur).then(function () { el.remove(); });
  }
  RC.Keyed = Keyed;

  /* ================================================================== hero teaser: nested frames */
  RC.dollsView = function (stage, count) {
    var svg = s('svg', { class: 'vz rc rc-dolls', 'aria-hidden': 'true' });
    stage.appendChild(svg);
    var layer = s('g'), fly = s('g');
    svg.appendChild(layer); svg.appendChild(fly);
    var store = new Keyed(layer);
    var W = 480, H = 380, N = (count || 4) + 1;
    function geom(level) {
      var bandY = clamp(H * 0.085, 18, 34), inX = W * 0.07;
      var x = W * 0.04 + level * inX, y = H * 0.05 + level * bandY;
      var w = W * 0.92 - 2 * level * inX, hh = H * 0.9 - 2 * level * bandY;
      return { x: x, y: y, w: w, h: Math.max(20, hh), band: bandY };
    }
    function build(d) {
      var g = s('g', { class: 'rc-doll' });
      g.rect = s('rect', { rx: 14, ry: 14 });
      g.label = s('text', { class: 'rc-doll__label' });
      g.val = s('text', { class: 'rc-doll__val', 'text-anchor': 'end' });
      g.big = s('text', { class: 'rc-doll__big', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      g.appendChild(g.rect); g.appendChild(g.label); g.appendChild(g.val); g.appendChild(g.big);
      return g;
    }
    return function render(step, ctx) {
      var r = stage.getBoundingClientRect();
      W = Math.max(200, Math.round(r.width - 2 * parseFloat(getComputedStyle(stage).paddingLeft || 0))) || 480;
      H = Math.max(150, Math.round(r.height - 2 * parseFloat(getComputedStyle(stage).paddingTop || 0))) || 380;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var d = ctx.duration;
      svg.style.setProperty('--vz-dur', d + 'ms');
      var fs = clamp(Math.round(H * 0.048), 10, 16);
      store.begin();
      step.dolls.forEach(function (doll) {
        var level = N - 1 - doll.k;
        var gm = geom(level);
        var g = store.use(doll.id, function () { return build(doll); });
        setState(g, 'rc-doll', doll.state);
        g.label.textContent = doll.label;
        g.label.setAttribute('font-size', fs);
        g.val.setAttribute('font-size', fs);
        var innermost = doll === step.dolls[step.dolls.length - 1];
        g.val.textContent = doll.value !== null && !innermost ? '= ' + doll.value : (doll.value !== null && doll.expr ? '= ' + doll.value : '');
        g.big.textContent = innermost && doll.value !== null ? (doll.expr ? doll.expr + ' = ' + doll.value : String(doll.value)) : '';
        g.big.setAttribute('font-size', clamp(Math.round(Math.min(gm.w, gm.h) * 0.22), 14, 40));
        if (g.__new) {
          V.place(g.rect, { attr: { x: gm.x + gm.w * 0.25, y: gm.y + gm.h * 0.25, width: gm.w * 0.5, height: gm.h * 0.5 } });
          V.place(g, { opacity: 0 });
        }
        mv(g, { opacity: 1 }, d);
        mv(g.rect, { attr: { x: gm.x, y: gm.y, width: gm.w, height: gm.h } }, d, 'out');
        g.label.setAttribute('x', gm.x + 12); g.label.setAttribute('y', gm.y + gm.band * 0.66);
        g.val.setAttribute('x', gm.x + gm.w - 12); g.val.setAttribute('y', gm.y + gm.band * 0.66);
        g.big.setAttribute('x', gm.x + gm.w / 2); g.big.setAttribute('y', gm.y + gm.band + (gm.h - gm.band) / 2);
      });
      store.sweep().forEach(function (g) {
        var x = +g.rect.getAttribute('x'), y = +g.rect.getAttribute('y'), w = +g.rect.getAttribute('width'), hh = +g.rect.getAttribute('height');
        if (!d) { g.remove(); return; }
        mv(g.rect, { attr: { x: x + w / 2 - 4, y: y + hh / 2 - 4, width: 8, height: 8 } }, d * 0.8, 'in');
        fadeOut(g, d);
      });
      V.clear(fly);
      if (step.bubble && d && ctx.direction > 0) {
        var level = N - 1 - (+step.bubble.to.slice(1));
        var from = geom(level + 1), to = geom(level);
        var chip = s('g', { class: 'rc-bubble' }, s('rect', { x: -18, y: -12, width: 36, height: 24, rx: 12 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(step.bubble.value)));
        fly.appendChild(chip);
        V.place(chip, { x: from.x + from.w / 2, y: from.y + from.h / 2, opacity: 1 });
        mv(chip, { x: to.x + to.w - 40, y: to.y + to.band * 0.55, opacity: 0.2 }, d, 'inOut').then(function () { chip.remove(); });
      }
    };
  };

  /* ================================================================== the problem: counting files */
  RC.foldersView = function (stage) {
    var fig = pxFig(stage, { cls: 'rc-folders', label: 'Folder tree with file counts', draw: draw });
    var gGuides = s('g', { class: 'rc-guides' }), gRows = s('g'), gFly = s('g');
    fig.svg.appendChild(gGuides); fig.svg.appendChild(gRows); fig.svg.appendChild(gFly);
    var rowsEls = {}, prevStep = null;
    function folderIcon() { return s('path', { class: 'rc-ficon', d: 'M0 3.5a2 2 0 0 1 2-2h4.2l2 2.2H16a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z' }); }
    function draw(step, dur, W) {
      var rows = step.rows, narrow = W < 480;
      var RH = narrow ? 52 : 44, IND = narrow ? 20 : 28, top = 6;
      var H = top + rows.length * RH + 6;
      var yOf = {};
      rows.forEach(function (r, i) { yOf[r.id] = top + i * RH; });
      // guides (static per width)
      V.clear(gGuides);
      rows.forEach(function (r) {
        if (!r.parent) return;
        var px = 14 + (rows.filter(function (q) { return q.id === r.parent; })[0].depth) * IND + 9, py = yOf[r.parent] + RH / 2 + 9;
        var cx = 14 + r.depth * IND - 3, cy = yOf[r.id] + RH / 2;
        gGuides.appendChild(s('path', { d: 'M' + px + ' ' + py + 'V' + cy + 'H' + cx }));
      });
      rows.forEach(function (r) {
        var g = rowsEls[r.id];
        if (!g) {
          g = s('g', { class: 'rc-frow', 'data-id': r.id, 'data-label': 'Folder ' + r.name });
          g.bg = s('rect', { class: 'rc-frow__bg', rx: 10, ry: 10 });
          g.icon = s('g', { class: 'rc-frow__icon' }, folderIcon());
          g.name = s('text', { class: 'rc-frow__name', 'dominant-baseline': 'central' });
          g.own = s('g', { class: 'rc-pill' }, s('rect', { rx: 9, ry: 9, height: 18, y: -9 }), s('text', { 'dominant-baseline': 'central', 'text-anchor': 'middle' }));
          g.tally = s('text', { class: 'rc-frow__tally', 'dominant-baseline': 'central', 'text-anchor': 'end' });
          g.total = s('g', { class: 'rc-total' }, s('rect', { rx: 11, ry: 11, height: 22, y: -11 }), s('text', { 'dominant-baseline': 'central', 'text-anchor': 'middle' }));
          [g.bg, g.icon, g.name, g.own, g.tally, g.total].forEach(function (e) { g.appendChild(e); });
          gRows.appendChild(g);
          rowsEls[r.id] = g;
        }
        var st = step.states[r.id];
        g.setAttribute('class', 'rc-frow is-' + st);
        var y = yOf[r.id], x0 = 14 + r.depth * IND;
        g.bg.setAttribute('x', 2); g.bg.setAttribute('y', y + 3); g.bg.setAttribute('width', W - 4); g.bg.setAttribute('height', RH - 6);
        g.icon.setAttribute('transform', 'translate(' + x0 + ' ' + (y + (narrow ? 14 : RH / 2) - 8) + ')');
        var ny = y + (narrow ? 17 : RH / 2);
        g.name.setAttribute('x', x0 + 26); g.name.setAttribute('y', ny); g.name.textContent = r.name + '/';
        var nameW = tw(r.name + '/', 14, true, 650);
        var ownText = r.files + ' file' + (r.files === 1 ? '' : 's'), ow = tw(ownText, 11, true, 600) + 14;
        var orect = g.own.firstChild, otext = g.own.lastChild;
        orect.setAttribute('width', ow); orect.setAttribute('x', 0); otext.setAttribute('x', ow / 2); otext.textContent = ownText;
        g.own.setAttribute('transform', 'translate(' + (x0 + 34 + nameW) + ' ' + ny + ')');
        // total chip on the right
        var tot = step.totals[r.id], tText = tot === undefined ? (st === 'frontier' ? 'waiting…' : st === 'active' ? 'counting…' : '') : '= ' + tot;
        var tww = tText ? tw(tText, 12, true, 700) + 18 : 0;
        var trect = g.total.firstChild, ttext = g.total.lastChild;
        trect.setAttribute('width', tww); trect.setAttribute('x', -tww); ttext.setAttribute('x', -tww / 2); ttext.textContent = tText;
        g.total.setAttribute('transform', 'translate(' + (W - 12) + ' ' + ny + ')');
        g.total.setAttribute('data-kind', tot === undefined ? 'wait' : 'done');
        // running tally: own files + each reported subfolder
        var t = step.tally[r.id] || [];
        var tallyText = r.kids.length && t.length && st !== 'default' ? t.join(' + ') + (t.length < r.kids.length + 1 ? ' + …' : '') : '';
        g.tally.textContent = tallyText;
        if (narrow) { g.tally.setAttribute('x', W - 12); g.tally.setAttribute('y', y + RH - 14); g.tally.setAttribute('text-anchor', 'end'); }
        else { g.tally.setAttribute('x', W - 24 - Math.max(tww, 60)); g.tally.setAttribute('y', ny); g.tally.setAttribute('text-anchor', 'end'); }
        g.__x = W - 12 - tww / 2; g.__y = ny;
      });
      // answers fly from a subfolder to its parent when the parent's tally grows
      V.clear(gFly);
      if (prevStep && dur && prevStep !== step) {
        rows.forEach(function (r) {
          var now = step.tally[r.id] || [], before = prevStep.tally[r.id] || [];
          if (now.length > before.length && step.states[r.id] !== 'default') {
            for (var j = Math.max(1, before.length); j < now.length; j++) {
              var kid = rowsEls[r.kids[j - 1]], par = rowsEls[r.id];
              if (!kid || !par) continue;
              var chip = s('g', { class: 'rc-fly' }, s('rect', { x: -16, y: -11, width: 32, height: 22, rx: 11 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(now[j])));
              gFly.appendChild(chip);
              V.place(chip, { x: kid.__x, y: kid.__y, opacity: 1 });
              mv(chip, { x: par.__x - 40, y: par.__y, opacity: 0 }, dur, 'inOut');
            }
          }
        });
      }
      prevStep = step;
      return H;
    }
    return function render(step, ctx) { if (ctx.instant) prevStep = null; fig.render(step, ctx.duration); };
  };

  /* ================================================================== intuition: the cinema */
  RC.rowsView = function (stage) {
    var fig = pxFig(stage, { cls: 'rc-rows', label: 'Seats in a cinema, row 1 nearest the screen', draw: draw });
    var gScreen = s('g', { class: 'rc-screen' }), gSeats = s('g'), gFly = s('g');
    fig.svg.appendChild(gScreen); fig.svg.appendChild(gSeats); fig.svg.appendChild(gFly);
    var seats = [], k = 0, bubble = null, answer = null;
    function build(n) {
      V.clear(gSeats); V.clear(gScreen); seats = []; k = n;
      gScreen.appendChild(s('rect', { class: 'rc-screen__glow', rx: 6 }));
      gScreen.appendChild(s('rect', { class: 'rc-screen__bar', rx: 3 }));
      gScreen.appendChild(s('text', { class: 'rc-screen__label', 'text-anchor': 'middle' }, 'screen'));
      for (var r = 1; r <= n; r++) {
        var g = s('g', { class: 'rc-seat' });
        g.back = s('rect', { class: 'rc-seat__back', rx: 12 });
        g.cush = s('rect', { class: 'rc-seat__cush', rx: 6 });
        g.body = s('path', { class: 'rc-seat__body' });
        g.head = s('circle', { class: 'rc-seat__head', r: 11 });
        g.row = s('text', { class: 'rc-seat__row', 'text-anchor': 'middle' });
        g.tag = s('text', { class: 'rc-seat__tag', 'text-anchor': 'middle' });
        g.wait = s('text', { class: 'rc-seat__wait', 'text-anchor': 'middle' }, 'waiting');
        [g.back, g.body, g.head, g.cush, g.row, g.tag, g.wait].forEach(function (e) { g.appendChild(e); });
        gSeats.appendChild(g);
        seats.push(g);
      }
      bubble = s('g', { class: 'rc-speech' }, s('rect', { rx: 10 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'which row?'));
      answer = s('g', { class: 'rc-answer' }, s('circle', { r: 13 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '1'));
      gFly.appendChild(bubble); gFly.appendChild(answer);
      V.place(bubble, { opacity: 0 }); V.place(answer, { opacity: 0 });
    }
    function draw(step, dur, W) {
      if (step.k !== k) build(step.k);
      var H = 200, floor = 150, left = 46;
      var gap = (W - left - 20) / k;
      gScreen.children[0].setAttribute('x', 6); gScreen.children[0].setAttribute('y', 30); gScreen.children[0].setAttribute('width', 22); gScreen.children[0].setAttribute('height', 130);
      gScreen.children[1].setAttribute('x', 12); gScreen.children[1].setAttribute('y', 36); gScreen.children[1].setAttribute('width', 8); gScreen.children[1].setAttribute('height', 118);
      gScreen.children[2].setAttribute('x', 17); gScreen.children[2].setAttribute('y', 180);
      function cx(r) { return left + gap * (r - 0.5); }
      seats.forEach(function (g, i) {
        var r = i + 1, x = cx(r), you = r === k;
        var known = step.known[r] !== undefined, waiting = step.waiting.indexOf(r) !== -1, asking = step.asking === r;
        var st = known ? (you ? 'found' : 'done') : asking ? 'active' : waiting ? 'frontier' : you ? 'key' : 'default';
        g.setAttribute('class', 'rc-seat is-' + st);
        var k2 = Math.min(1, gap / 64);
        g.back.setAttribute('x', x - 25 * k2); g.back.setAttribute('y', floor - 62 * k2); g.back.setAttribute('width', 50 * k2); g.back.setAttribute('height', 56 * k2);
        g.cush.setAttribute('x', x - 28 * k2); g.cush.setAttribute('y', floor - 14 * k2); g.cush.setAttribute('width', 56 * k2); g.cush.setAttribute('height', 14 * k2);
        g.head.setAttribute('cx', x); g.head.setAttribute('cy', floor - 64 * k2); g.head.setAttribute('r', 11 * k2);
        g.body.setAttribute('d', 'M' + (x - 17 * k2) + ' ' + (floor - 14 * k2) + 'v' + (-16 * k2) + 'q0 ' + (-20 * k2) + ' ' + (17 * k2) + ' ' + (-20 * k2) + 'q' + (17 * k2) + ' 0 ' + (17 * k2) + ' ' + (20 * k2) + 'v' + (16 * k2) + 'z');
        g.row.setAttribute('x', x); g.row.setAttribute('y', floor + 20);
        g.row.textContent = known ? 'row ' + step.known[r] : 'row ?';
        g.tag.setAttribute('x', x); g.tag.setAttribute('y', floor + 38);
        g.tag.textContent = you ? 'you' : '';
        g.wait.setAttribute('x', x); g.wait.setAttribute('y', floor - 84);
        g.wait.style.opacity = waiting && !asking ? 1 : 0;
      });
      // speech bubble: from the asker toward the person in front
      var bw = Math.min(96, gap * 1.6), rect = bubble.firstChild;
      rect.setAttribute('x', -bw / 2); rect.setAttribute('y', -13); rect.setAttribute('width', bw); rect.setAttribute('height', 26);
      bubble.lastChild.setAttribute('font-size', bw < 80 ? 11 : 12);
      if (step.asking) {
        var fromX = cx(step.asking), toX = cx(step.asking - 1);
        if (dur) V.place(bubble, { x: fromX, y: 22, opacity: 1 });
        mv(bubble, { x: (fromX + toX) / 2, y: 22, opacity: 1 }, dur, 'out');
      } else mv(bubble, { opacity: 0 }, dur);
      if (step.passing) {
        answer.lastChild.textContent = String(step.passing.value);
        if (dur) V.place(answer, { x: cx(step.passing.from), y: floor - 90, opacity: 1 });
        mv(answer, { x: cx(step.passing.to), y: floor - 90, opacity: 1 }, dur, 'inOut').then(function () { if (fig) mv(answer, { opacity: 0 }, 200); });
        if (!dur) V.place(answer, { opacity: 0 });
      } else if (step.phase === 'base') {
        answer.lastChild.textContent = '1';
        V.place(answer, { x: cx(1), y: floor - 90 });
        mv(answer, { opacity: 1 }, dur);
      } else mv(answer, { opacity: 0 }, dur);
      return H;
    }
    return function render(step, ctx) { fig.render(step, ctx.duration); };
  };

  /* ================================================================== two parts: static minis */
  RC.partsMinis = function (row) {
    function mini(svg, cap) {
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, svg), h('figcaption', { html: cap })));
    }
    function box(x, y, w, text, cls) {
      return s('g', { class: 'vz-item ' + (cls || 'is-default') }, s('rect', { class: 'vz-shape', x: x, y: y, width: w, height: 30, rx: 15 }), s('text', { class: 'vz-ink vz-value', x: x + w / 2, y: y + 15, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 13 }, text));
    }
    function arrow(x1, y1, x2, y2) {
      return s('g', { class: 'rc-arrow' }, s('path', { d: 'M' + x1 + ' ' + y1 + 'L' + (x2 - 6) + ' ' + y2 }), s('path', { class: 'rc-arrow__head', d: 'M' + x2 + ' ' + y2 + 'l-8 -4.5v9z' }));
    }
    function note(x, y, t, anchor) { return s('text', { class: 'rc-mini-note', x: x, y: y, 'text-anchor': anchor || 'middle' }, t); }
    var a = s('svg', { class: 'vz rc', viewBox: '0 0 220 90', role: 'img', 'aria-label': 'fact(0) returns 1 directly, with no further call' });
    a.appendChild(box(10, 30, 76, 'fact(0)', 'is-active'));
    a.appendChild(arrow(90, 45, 140, 45));
    a.appendChild(box(146, 30, 60, '1', 'is-done'));
    a.appendChild(note(115, 24, 'returns'));
    a.appendChild(note(110, 80, 'no further call'));
    mini(a, '<b>Base case</b>: answer directly. It is where the calls stop.');
    var b = s('svg', { class: 'vz rc', viewBox: '0 0 220 90', role: 'img', 'aria-label': 'fact(4) equals 4 times fact(3), a smaller copy of the same problem' });
    b.appendChild(box(4, 30, 64, 'fact(4)', 'is-active'));
    b.appendChild(s('text', { class: 'rc-mini-expr', x: 78, y: 45, 'dominant-baseline': 'central' }, '= 4 ×'));
    b.appendChild(box(136, 30, 64, 'fact(3)', 'is-frontier'));
    b.appendChild(note(214, 80, 'same problem, smaller', 'end'));
    mini(b, '<b>Recursive case</b>: build the answer from the same problem, smaller.');
    var c = s('svg', { class: 'vz rc', viewBox: '0 0 220 90', role: 'img', 'aria-label': 'arguments 4, 3, 2, 1, 0 shrinking toward the base case 0' });
    [4, 3, 2, 1, 0].forEach(function (v, i) {
      var x = 16 + i * 44, sz = 34 - i * 3;
      c.appendChild(s('g', { class: 'vz-item ' + (v === 0 ? 'is-done' : 'is-visited') }, s('rect', { class: 'vz-shape', x: x - sz / 2 + 12, y: 42 - sz / 2, width: sz, height: sz, rx: 8 }), s('text', { class: 'vz-ink vz-value', x: x + 12, y: 42, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 14 }, String(v))));
    });
    c.appendChild(note(110, 82, 'n shrinks with every call → base case'));
    mini(c, '<b>Progress</b>: every call moves closer to a base case, so the calls must end.');
  };

  /* ================================================================== substitution: tokens that expand and merge */
  RC.unfoldView = function (stage) {
    var fig = pxFig(stage, { cls: 'rc-unfold', label: 'fact(4) rewritten step by step', draw: draw });
    var gTok = s('g'), gInfo = s('g', { class: 'rc-unfold__info' });
    fig.svg.appendChild(gTok); fig.svg.appendChild(gInfo);
    var store = new Keyed(gTok), pos = {};
    var info = s('text', { class: 'rc-unfold__pending', 'text-anchor': 'middle' });
    gInfo.appendChild(info);
    var dots = s('g', { class: 'rc-unfold__dots' });
    gInfo.appendChild(dots);
    function build(t) {
      var g = s('g', { class: 'rc-tok' });
      g.rect = s('rect', { rx: 10, ry: 10 });
      g.text = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      g.appendChild(g.rect); g.appendChild(g.text);
      return g;
    }
    function draw(step, dur, W) {
      var H = 150, cy = 58;
      var fs = 22, pad = 12, gap = 8;
      function widths(f) { return step.tokens.map(function (t) { return t.kind === 'op' ? tw('×', f, false, 500) + 2 : tw(t.text, f, t.kind === 'call', 700) + (t.kind === 'num' && !t.state ? 6 : pad * 2); }); }
      var ws = widths(fs), total = ws.reduce(function (a, b) { return a + b + gap; }, -gap);
      while (total > W - 24 && fs > 12) { fs -= 1; ws = widths(fs); total = ws.reduce(function (a, b) { return a + b + gap; }, -gap); }
      var x = (W - total) / 2, newPos = {};
      store.begin();
      step.tokens.forEach(function (t, i) {
        var w = ws[i], g = store.use(t.id, function () { return build(t); });
        g.setAttribute('class', 'rc-tok rc-tok--' + t.kind + (t.state ? ' is-' + t.state : ''));
        g.text.textContent = t.text;
        g.text.setAttribute('font-size', fs);
        var boxed = t.kind === 'call' || t.state;
        g.rect.setAttribute('x', -w / 2); g.rect.setAttribute('y', -fs * 0.9); g.rect.setAttribute('width', w); g.rect.setAttribute('height', fs * 1.8);
        g.rect.style.display = boxed ? '' : 'none';
        var tx = x + w / 2;
        newPos[t.id] = tx;
        if (g.__new) {
          var fromId = t.from || (t.mergeOf ? t.mergeOf[1] : null);
          var fx = fromId && pos[fromId] !== undefined ? pos[fromId] : tx;
          V.place(g, { x: fx, y: cy, scale: 0.6, opacity: 0 });
        }
        mv(g, { x: tx, y: cy, scale: 1, opacity: 1 }, dur, 'out');
        x += w + gap;
      });
      store.sweep().forEach(function (g) {
        var target = null;
        if (step.merge && step.merge.of) {
          var id = Object.keys(store.map).filter(function (k) { return k === step.merge.into; })[0];
          if (id) target = newPos[id];
        }
        fadeOut(g, dur, target !== null ? { x: target, scale: 0.5 } : { scale: 0.7 });
      });
      pos = newPos;
      info.setAttribute('x', W / 2); info.setAttribute('y', 124);
      info.textContent = step.pending ? 'multiplications waiting: ' + step.pending : 'no multiplications waiting';
      V.clear(dots);
      for (var p = 0; p < step.pending; p++) dots.appendChild(s('circle', { cx: W / 2 - (step.pending - 1) * 9 + p * 18, cy: 102, r: 6 }));
      return H;
    }
    return function render(step, ctx) { fig.render(step, ctx.duration); };
  };

  /* ================================================================== call stack section: the depth "mountain" */
  RC.mountainView = function (stage, steps) {
    var fig = pxFig(stage, { cls: 'rc-mountain', label: 'Stack depth over time', draw: draw, minWidth: 220 });
    var gGrid = s('g', { class: 'rc-mgrid' }), area = s('path', { class: 'rc-marea' }), ghost = s('path', { class: 'rc-mghost' }), line = s('path', { class: 'rc-mline' });
    var cur = s('g', { class: 'rc-mcur' }, s('line', {}), s('circle', { r: 6 }));
    var lab = s('g', { class: 'rc-mlabels' });
    [gGrid, ghost, area, line, lab, cur].forEach(function (e) { fig.svg.appendChild(e); });
    var data = steps;
    function draw(index, dur, W) {
      var H = 230, L = 34, R = 12, T = 18, B = 34;
      var n = data.length, maxD = Math.max.apply(null, data.map(function (x) { return x.depth; })) || 1;
      function X(i) { return L + (n > 1 ? i / (n - 1) : 0) * (W - L - R); }
      function Y(d) { return T + (1 - d / maxD) * (H - T - B); }
      V.clear(gGrid);
      for (var d = 0; d <= maxD; d++) {
        gGrid.appendChild(s('line', { x1: L, x2: W - R, y1: Y(d), y2: Y(d) }));
        gGrid.appendChild(s('text', { x: L - 8, y: Y(d) + 4, 'text-anchor': 'end' }, String(d)));
      }
      gGrid.appendChild(s('text', { class: 'rc-maxis', x: L, y: H - 8 }, 'time (steps) →'));
      gGrid.appendChild(s('text', { class: 'rc-maxis', x: 4, y: 10 }, 'depth'));
      function path(upTo) {
        var p = '';
        for (var i = 0; i <= upTo; i++) {
          var y = Y(data[i].depth);
          p += (i ? 'L' + X(i) + ' ' + (i ? Y(data[i - 1].depth) : y) + 'L' : 'M') + X(i) + ' ' + y;
        }
        return p;
      }
      ghost.setAttribute('d', path(n - 1));
      var p = path(index);
      line.setAttribute('d', p);
      area.setAttribute('d', p + 'L' + X(index) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(0) + 'Z');
      var peak = -1, peakEnd = 0;
      data.forEach(function (x, i) { if (x.depth === maxD) { if (peak < 0) peak = i; peakEnd = i; } });
      V.clear(lab);
      var fsL = W < 380 ? 10.5 : 11.5, ly = Y(maxD - 0.45);
      lab.appendChild(s('text', { x: X(peak) - 8, y: ly, 'text-anchor': 'end', class: 'is-down', 'font-size': fsL }, 'calls pile up'));
      lab.appendChild(s('text', { x: X(peakEnd + 1) + 8, y: ly, class: 'is-up', 'font-size': fsL }, 'returns unwind'));
      lab.appendChild(s('text', { x: (X(peak) + X(peakEnd + 1)) / 2, y: T - 4, 'text-anchor': 'middle', class: 'is-base' }, 'base case'));
      cur.firstChild.setAttribute('x1', 0); cur.firstChild.setAttribute('x2', 0); cur.firstChild.setAttribute('y1', T); cur.firstChild.setAttribute('y2', H - B);
      mv(cur, { x: X(index), y: 0 }, dur, 'out');
      mv(cur.lastChild, { attr: { cy: Y(data[index].depth) } }, dur, 'out');
      return H;
    }
    return { render: function (index, ctx) { fig.render(index, ctx.duration); }, setSteps: function (st) { data = st; } };
  };

  /* ================================================================== the leap of faith: nested boxes */
  RC.leapView = function (stage, list) {
    var fig = pxFig(stage, { cls: 'rc-leap', label: 'Nested boxes for total of a list', draw: draw });
    var gBoxes = s('g');
    fig.svg.appendChild(gBoxes);
    var store = new Keyed(gBoxes);
    var sums = [];
    for (var i = 0; i <= list.length; i++) sums.push(list.slice(i).reduce(function (a, b) { return a + b; }, 0));
    function lbl(i) { return 'total([' + list.slice(i).join(', ') + '])'; }
    function build() {
      var g = s('g', { class: 'rc-box' });
      g.rect = s('rect', { rx: 12, ry: 12 });
      g.name = s('text', { class: 'rc-box__name', 'dominant-baseline': 'central' });
      g.math = s('text', { class: 'rc-box__math', 'dominant-baseline': 'central', 'text-anchor': 'end' });
      g.hint = s('text', { class: 'rc-box__hint', 'dominant-baseline': 'central', 'text-anchor': 'middle' });
      g.appendChild(g.rect); g.appendChild(g.name); g.appendChild(g.math); g.appendChild(g.hint);
      return g;
    }
    function draw(opened, dur, W) {
      var n = list.length, narrow = W < 520;
      var RH = narrow ? 56 : 50, IN = narrow ? 8 : 14, PADB = narrow ? 6 : 8, HEAD = RH - 10;
      var last = Math.min(opened + 1, n);          // levels 0..last are drawn; level opened + 1 is sealed
      var H = n * RH + HEAD + n * PADB + 10;
      store.begin();
      for (var j = 0; j <= last; j++) {
        var g = store.use('b' + j, build);
        var sealed = j === opened + 1, isBase = j === n && !sealed;
        var x = j * IN + 2, y = j * RH + 2, w = W - 2 * j * IN - 4;
        var hh = H - 2 - j * PADB - y;               // every box reaches down to the bottom, nested
        g.setAttribute('class', 'rc-box' + (sealed ? ' is-sealed' : ' is-open') + (isBase ? ' is-base' : '') + (j === 0 ? ' is-root' : ''));
        if (g.__new) { V.place(g.rect, { attr: { x: x, y: y, width: w, height: hh } }); V.place(g, { opacity: 0 }); }
        mv(g, { opacity: 1 }, dur);
        mv(g.rect, { attr: { x: x, y: y, width: w, height: hh } }, dur, 'out');
        var fs = narrow ? 12 : 14;
        g.name.textContent = lbl(j);
        g.math.textContent = sealed ? 'trust it: returns ' + sums[j] : isBase ? '= 0 · base case' : '= ' + list[j] + ' + ' + sums[j + 1] + ' = ' + sums[j];
        g.name.setAttribute('font-size', fs); g.math.setAttribute('font-size', fs);
        if (narrow) {
          g.name.setAttribute('x', x + 12); g.name.setAttribute('y', y + HEAD * 0.32);
          g.math.setAttribute('x', x + 12); g.math.setAttribute('y', y + HEAD * 0.74); g.math.setAttribute('text-anchor', 'start');
        } else {
          g.name.setAttribute('x', x + 14); g.name.setAttribute('y', y + HEAD / 2 + 1);
          g.math.setAttribute('x', x + w - 14); g.math.setAttribute('y', y + HEAD / 2 + 1); g.math.setAttribute('text-anchor', 'end');
        }
        g.hint.textContent = sealed && hh > 90 ? 'closed: ' + (n - j) + ' more level' + (n - j === 1 ? '' : 's') + ' inside' + (narrow ? '' : ', all following the same rule') : '';
        g.hint.setAttribute('x', x + w / 2); g.hint.setAttribute('y', y + HEAD + (hh - HEAD) / 2);
        g.hint.setAttribute('font-size', narrow ? 11.5 : 13);
      }
      store.sweep().forEach(function (g) { fadeOut(g, dur); });
      return H;
    }
    return { render: function (opened, dur) { fig.render(opened, dur); } };
  };

  /* ================================================================== fib call explosion */
  var FIB_STATES = ['muted', 'visited', 'frontier', 'compare', 'pivot', 'done', 'active', 'path', 'key', 'swap'];
  RC.FIB_STATES = FIB_STATES;
  RC.fibView = function (stage, opts) {
    opts = opts || {};
    var A = V.algos.recursion;
    var fig = pxFig(stage, { cls: 'rc-fib', label: 'Call tree of fib(n)', draw: draw, minWidth: 300 });
    var gEdges = s('g', { class: 'rc-fib__edges' }), gNodes = s('g', { class: 'rc-fib__nodes' });
    fig.svg.appendChild(gEdges); fig.svg.appendChild(gNodes);
    var recs = {}, tween = null, highlight = null;
    var state = { n: 5, memo: false, grow: false };
    function layout(list, W, H) {
      var byId = {}; list.forEach(function (x) { byId[x.id] = { node: x, kids: [] }; });
      list.forEach(function (x) { if (x.parent && byId[x.parent]) byId[x.parent].kids.push(x.id); });
      var leaves = list.filter(function (x) { return !byId[x.id].kids.length; });
      var maxDepth = list.reduce(function (m, x) { return Math.max(m, x.depth); }, 0);
      var pad = 18, slot = (W - 2 * pad) / Math.max(1, leaves.length);
      var levelH = maxDepth ? Math.min(80, (H - 2 * pad) / maxDepth) : 0;
      var pos = {}, li = 0;
      (function place(id) {
        var e = byId[id];
        if (!e.kids.length) { pos[id] = { x: pad + slot * (li + 0.5), y: pad + e.node.depth * levelH }; li++; return; }
        e.kids.forEach(place);
        var xs = e.kids.map(function (k) { return pos[k].x; });
        pos[id] = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: pad + e.node.depth * levelH };
      }(list[0].id));
      var r = clamp(Math.min(slot * 0.42, levelH * 0.36 || 16), 3.2, 16);
      return { pos: pos, r: r, byId: byId };
    }
    function build(node) {
      var g = s('g', { class: 'rc-fn' });
      g.c = s('circle', {});
      g.t = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      g.appendChild(g.c); g.appendChild(g.t);
      gNodes.appendChild(g);
      var e = s('line', { class: 'rc-fe' });
      gEdges.appendChild(e);
      return { g: g, e: e, c: g.c, t: g.t, cur: null, from: null, to: null, node: node };
    }
    function paint(rec) {
      var c = rec.cur;
      rec.g.setAttribute('transform', 'translate(' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ')');
      rec.c.setAttribute('r', Math.max(0, c.r).toFixed(2));
      rec.g.style.opacity = c.o.toFixed(3);
      var p = rec.parentRec;
      if (p && p.cur) {
        rec.e.setAttribute('x1', p.cur.x.toFixed(1)); rec.e.setAttribute('y1', p.cur.y.toFixed(1));
        rec.e.setAttribute('x2', c.x.toFixed(1)); rec.e.setAttribute('y2', c.y.toFixed(1));
        rec.e.style.opacity = Math.min(c.o, p.cur.o).toFixed(3);
      } else rec.e.style.opacity = 0;
    }
    function draw(st, dur, W) {
      var H = clamp(Math.round(W * 0.34), 250, 380);
      var list = A.fibTree(st.n, st.memo);
      var L = layout(list, W, H);
      var showText = L.r >= 9.5;
      var keep = {};
      list.forEach(function (node, i) {
        keep[node.id] = true;
        var rec = recs[node.id];
        if (!rec) { rec = recs[node.id] = build(node); rec.fresh = true; }
        else rec.fresh = false;
        rec.node = node;
        rec.order = i;
        rec.g.setAttribute('class', 'rc-fn rc-fn-' + node.n + (node.hit ? ' is-hit' : '') + (highlight !== null ? (node.n === highlight ? ' is-hl' : ' is-dim') : ''));
        rec.t.textContent = showText ? String(node.n) : '';
        rec.t.setAttribute('font-size', clamp(Math.round(L.r * 0.95), 9, 14));
        rec.to = { x: L.pos[node.id].x, y: L.pos[node.id].y, r: node.hit ? L.r * 0.82 : L.r, o: 1 };
      });
      list.forEach(function (node) { var rec = recs[node.id]; rec.parentRec = node.parent ? recs[node.parent] : null; });
      Object.keys(recs).forEach(function (id) {
        var rec = recs[id];
        if (keep[id]) return;
        // collapse into the nearest ancestor that survives
        var anc = id.slice(0, -1);
        while (anc && !keep[anc]) anc = anc.slice(0, -1);
        var tgt = anc && L.pos[anc] ? L.pos[anc] : { x: W / 2, y: 18 };
        rec.to = { x: tgt.x, y: tgt.y, r: 0, o: 0 };
        rec.dying = true;
      });
      Object.keys(recs).forEach(function (id) {
        var rec = recs[id];
        if (rec.fresh || !rec.cur) {
          var p = rec.parentRec && rec.parentRec.cur && !rec.parentRec.fresh ? rec.parentRec.cur : (rec.parentRec ? rec.parentRec.to : rec.to);
          rec.cur = { x: p.x, y: p.y, r: 0, o: 0 };
        }
        rec.from = Object.assign({}, rec.cur);
      });
      if (tween) tween.cancel();
      var ids = Object.keys(recs), count = list.length;
      var grow = st.grow && dur > 0;
      var total = grow ? clamp(300 + count * 28, 700, 4200) : dur;
      function frame(t) {
        ids.forEach(function (id) {
          var rec = recs[id], lt;
          if (grow && !rec.dying) {
            var start = (rec.order / Math.max(1, count)) * (1 - 260 / total);
            lt = clamp((t - start) / (260 / total), 0, 1);
          } else lt = t;
          var e = V.ease.inOut(lt);
          rec.cur = { x: V.lerp(rec.from.x, rec.to.x, e), y: V.lerp(rec.from.y, rec.to.y, e), r: V.lerp(rec.from.r, rec.to.r, e), o: V.lerp(rec.from.o, rec.to.o, e) };
        });
        ids.forEach(function (id) { paint(recs[id]); });
        if (opts.onProgress && grow) {
          var shown = 0; ids.forEach(function (id) { if (!recs[id].dying && recs[id].cur.o > 0.5) shown++; });
          opts.onProgress(shown, count);
        }
      }
      function done() {
        ids.forEach(function (id) { var rec = recs[id]; if (rec.dying) { rec.g.remove(); rec.e.remove(); delete recs[id]; } });
        if (opts.onProgress) opts.onProgress(count, count);
      }
      if (grow) {
        // restart from nothing: every node starts at the root
        ids.forEach(function (id) { var rec = recs[id]; if (!rec.dying) { var root = recs.r ? recs.r.to : rec.to; rec.from = { x: rec.parentRec ? rec.parentRec.to.x : root.x, y: rec.parentRec ? rec.parentRec.to.y : root.y, r: 0, o: 0 }; } });
      }
      if (!total) { frame(1); done(); }
      else { tween = V.tween(V.dur(total), function (t) { frame(t); }, { ease: 'linear' }); tween.promise.then(function (ok) { if (ok) done(); }); }
      return H;
    }
    return {
      set: function (o, dur) { Object.assign(state, o); fig.render(Object.assign({}, state), dur === undefined ? 600 : dur); state.grow = false; },
      highlight: function (n) { highlight = n; fig.render(Object.assign({}, state, { grow: false }), 0); },
      state: state
    };
  };

  /* ================================================================== recursion vs tail call vs loop */
  RC.lanesView = function (stage) {
    var fig = pxFig(stage, { cls: 'rc-lanes', label: 'Frames used by three versions of factorial', draw: draw });
    var gStatic = s('g'), gFrames = s('g');
    fig.svg.appendChild(gStatic); fig.svg.appendChild(gFrames);
    var store = new Keyed(gFrames);
    var TITLES = [['Plain recursion', 'fact(n) = n × fact(n − 1)', 'Recursion'], ['Tail call, frame reused', 'factT(n, acc)', 'Tail call'], ['Loop', 'for i = 2 … n', 'Loop']];
    function build() {
      var g = s('g', { class: 'rc-lframe' });
      g.rect = s('rect', { rx: 8, ry: 8 });
      g.a = s('text', { class: 'rc-lframe__a', 'text-anchor': 'middle' });
      g.b = s('text', { class: 'rc-lframe__b', 'text-anchor': 'middle' });
      g.appendChild(g.rect); g.appendChild(g.a); g.appendChild(g.b);
      return g;
    }
    function draw(step, dur, W) {
      var FH = 40, GAP = 5, maxF = 7, top = W < 520 ? 34 : 58, floor = top + maxF * (FH + GAP) + 6, H = floor + 44;
      var colW = (W - 16) / 3, fw = Math.min(colW - 14, 190);
      V.clear(gStatic);
      TITLES.forEach(function (t, i) {
        var cx = 8 + colW * (i + 0.5);
        var narrowL = colW < 170;
        gStatic.appendChild(s('text', { class: 'rc-lane__title', x: cx, y: 18, 'text-anchor': 'middle' }, narrowL ? t[2] : t[0]));
        if (!narrowL) gStatic.appendChild(s('text', { class: 'rc-lane__sub', x: cx, y: 36, 'text-anchor': 'middle' }, t[1]));
        gStatic.appendChild(s('line', { class: 'rc-lane__floor', x1: cx - fw / 2 - 6, x2: cx + fw / 2 + 6, y1: floor, y2: floor }));
        var lane = step.lanes[i];
        gStatic.appendChild(s('text', { class: 'rc-lane__count', x: cx, y: floor + 20, 'text-anchor': 'middle' }, narrowL ? lane.frames.length + ' now · peak ' + step.peaks[i] : lane.frames.length + ' frame' + (lane.frames.length === 1 ? '' : 's') + ' now · peak ' + step.peaks[i]));
        if (lane.result !== undefined) gStatic.appendChild(s('text', { class: 'rc-lane__result', x: cx, y: floor + 38, 'text-anchor': 'middle' }, 'returned ' + lane.result));
        if (i) gStatic.appendChild(s('line', { class: 'rc-lane__sep', x1: 8 + colW * i, x2: 8 + colW * i, y1: 8, y2: floor + 30 }));
      });
      store.begin();
      step.lanes.forEach(function (lane, i) {
        var cx = 8 + colW * (i + 0.5);
        lane.frames.forEach(function (f, k) {
          var g = store.use(f.id, build);
          g.setAttribute('class', 'rc-lframe vz-item is-' + (f.state || 'default'));
          g.rect.setAttribute('class', 'vz-shape');
          g.a.setAttribute('class', 'rc-lframe__a vz-ink'); g.b.setAttribute('class', 'rc-lframe__b vz-ink');
          g.rect.setAttribute('x', -fw / 2); g.rect.setAttribute('y', -FH / 2); g.rect.setAttribute('width', fw); g.rect.setAttribute('height', FH);
          g.a.textContent = f.label; g.a.setAttribute('y', -3);
          g.b.textContent = f.note; g.b.setAttribute('y', 13);
          var small = fw < 120;
          g.a.setAttribute('font-size', small ? 11 : 12.5); g.b.setAttribute('font-size', small ? 9.5 : 11);
          var y = floor - 4 - FH / 2 - k * (FH + GAP);
          if (g.__new) V.place(g, { x: cx, y: y - 26, opacity: 0 });
          mv(g, { x: cx, y: y, opacity: 1 }, dur, 'out');
        });
      });
      store.sweep().forEach(function (g) { var st = g.__vdsa || { x: 0, y: 0 }; fadeOut(g, dur, { y: st.y - 26 }); });
      return H;
    }
    return function render(step, ctx) { fig.render(step, ctx.duration); };
  };

  /* ================================================================== fractal tree */
  RC.fractalView = function (stage, onStats) {
    var A = V.algos.recursion;
    var fig = pxFig(stage, { cls: 'rc-fractal', label: 'A recursive tree drawing', draw: draw });
    var g = s('g', { class: 'rc-branches' });
    fig.svg.appendChild(g);
    var lines = {}, anim = null, prevDepth = -1;
    function draw(st, dur, W) {
      var H = clamp(Math.round(W * 0.5), 240, 400);
      var segs = A.fractal(st.depth, st.angle, 0.7);
      var L0 = H * 0.3, ox = W / 2, oy = H - 12;
      var keep = {}, fresh = [];
      segs.forEach(function (sg) {
        keep[sg.id] = true;
        var el = lines[sg.id];
        var x1 = ox + sg.x1 * L0, y1 = oy + sg.y1 * L0, x2 = ox + sg.x2 * L0, y2 = oy + sg.y2 * L0;
        if (!el) { el = lines[sg.id] = s('line', {}); g.appendChild(el); el.__fresh = true; }
        el.setAttribute('class', 'rc-br');
        el.style.setProperty('--q', Math.round(100 * sg.depth / Math.max(1, st.depth)) + '%');
        el.setAttribute('stroke-width', Math.max(1, 9 * Math.pow(0.68, sg.depth)).toFixed(2));
        el.setAttribute('x1', x1.toFixed(1)); el.setAttribute('y1', y1.toFixed(1));
        el.__to = [x2, y2]; el.__from = [x1, y1]; el.__depth = sg.depth;
        if (el.__fresh && dur && prevDepth >= 0) { el.setAttribute('x2', x1.toFixed(1)); el.setAttribute('y2', y1.toFixed(1)); fresh.push(el); }
        else { el.setAttribute('x2', x2.toFixed(1)); el.setAttribute('y2', y2.toFixed(1)); }
        el.__fresh = false;
      });
      Object.keys(lines).forEach(function (id) { if (!keep[id]) { lines[id].remove(); delete lines[id]; } });
      if (anim) anim.cancel();
      if (fresh.length) {
        var minD = Math.min.apply(null, fresh.map(function (e) { return e.__depth; })), span = Math.max(1, st.depth - minD + 1);
        anim = V.tween(V.dur(dur), function (t) {
          fresh.forEach(function (el) {
            var k = el.__depth - minD, lt = clamp(t * span - k, 0, 1), e = V.ease.out(lt);
            el.setAttribute('x2', V.lerp(el.__from[0], el.__to[0], e).toFixed(1));
            el.setAttribute('y2', V.lerp(el.__from[1], el.__to[1], e).toFixed(1));
          });
        }, { ease: 'linear' });
      }
      prevDepth = st.depth;
      if (onStats) onStats(segs.length, st.depth);
      return H;
    }
    return { render: function (st, dur) { fig.render(st, dur); } };
  };

  /* ================================================================== small static pictures */
  RC.tailMini = function () {
    var svg = s('svg', { class: 'vz rc', viewBox: '0 0 300 150', role: 'img', 'aria-label': 'Left: four stacked frames each waiting to multiply. Right: one frame whose arguments change.' });
    ['fact(1): 1 × ?', 'fact(2): 2 × ?', 'fact(3): 3 × ?', 'fact(4): 4 × ?'].forEach(function (t, i) {
      svg.appendChild(s('g', { class: 'vz-item ' + (i === 0 ? 'is-active' : 'is-frontier') }, s('rect', { class: 'vz-shape', x: 10, y: 14 + i * 30, width: 128, height: 26, rx: 7 }), s('text', { class: 'vz-ink', x: 74, y: 27 + i * 30, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 12 }, t)));
    });
    svg.appendChild(s('g', { class: 'vz-item is-active' }, s('rect', { class: 'vz-shape', x: 162, y: 104, width: 128, height: 26, rx: 7 }), s('text', { class: 'vz-ink', x: 226, y: 117, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 12 }, 'factT(1, 12)')));
    svg.appendChild(s('text', { class: 'vz-label', x: 226, y: 90, 'text-anchor': 'middle' }, 'one frame, reused'));
    svg.appendChild(s('text', { class: 'vz-label', x: 74, y: 146, 'text-anchor': 'middle' }, 'pending work stacks up'));
    return svg;
  };

  /* tiny pictures for the summary card */
  RC.summaryTiles = function () {
    function sv(label, kids) { var e = s('svg', { class: 'vz rc', viewBox: '0 0 120 64', role: 'img', 'aria-label': label }); kids.forEach(function (k) { e.appendChild(k); }); return e; }
    function node(x, y, w, t, st) { return s('g', { class: 'vz-item is-' + st }, s('rect', { class: 'vz-shape', x: x, y: y, width: w, height: 14, rx: 7 }), s('text', { class: 'vz-ink', x: x + w / 2, y: y + 7, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 8.5 }, t)); }
    function edge(x1, y1, x2, y2, st) { return s('line', { class: 'rc-sum-edge' + (st ? ' is-' + st : ''), x1: x1, y1: y1, x2: x2, y2: y2 }); }
    return [
      { svg: sv('base case returns directly', [node(8, 23, 50, 'fact(0)', 'active'), edge(62, 32, 78, 32), node(80, 23, 32, '1', 'done')]), label: 'Base case', text: 'An input answered directly. Every path must reach one.' },
      { svg: sv('a call uses a smaller copy', [node(10, 6, 56, 'fact(4)', 'frontier'), edge(38, 24, 60, 40), node(52, 40, 60, '4 × fact(3)', 'active')]), label: 'Smaller self', text: 'Build the answer from the same problem, smaller. Trust it.' },
      { svg: sv('frames stacked', [node(30, 46, 60, 'main', 'default'), node(30, 31, 60, 'fact(3)', 'frontier'), node(30, 16, 60, 'fact(2)', 'frontier'), node(30, 1, 60, 'fact(1)', 'active')]), label: 'Call stack', text: 'One frame per waiting call. Last in, first out.' },
      { svg: sv('recursion tree, one path is the stack', [edge(60, 10, 30, 32, 'path'), edge(60, 10, 90, 32), edge(30, 32, 16, 54, 'path'), edge(30, 32, 44, 54), s('circle', { class: 'rc-sum-dot is-path', cx: 60, cy: 10, r: 6 }), s('circle', { class: 'rc-sum-dot is-path', cx: 30, cy: 32, r: 6 }), s('circle', { class: 'rc-sum-dot', cx: 90, cy: 32, r: 6 }), s('circle', { class: 'rc-sum-dot is-path', cx: 16, cy: 54, r: 6 }), s('circle', { class: 'rc-sum-dot', cx: 44, cy: 54, r: 6 })]), label: 'Time vs space', text: 'Time = nodes of the tree. Space = its height.' },
      { svg: sv('repeated subproblems', [s('circle', { class: 'rc-sum-dot rc-fn-3', cx: 22, cy: 32, r: 9 }), s('circle', { class: 'rc-sum-dot rc-fn-3', cx: 52, cy: 32, r: 9 }), s('circle', { class: 'rc-sum-dot rc-fn-3', cx: 82, cy: 32, r: 9 }), s('text', { class: 'vz-label', x: 60, y: 58, 'text-anchor': 'middle' }, 'fib(3) × 3 → store it')]), label: 'Repeats → remember', text: 'Naive fib makes 2·fib(n + 1) − 1 calls; memoized, 2n − 1.' },
      { svg: sv('three pegs', [s('line', { class: 'rc-sum-peg', x1: 20, y1: 12, x2: 20, y2: 54 }), s('line', { class: 'rc-sum-peg', x1: 60, y1: 12, x2: 60, y2: 54 }), s('line', { class: 'rc-sum-peg', x1: 100, y1: 12, x2: 100, y2: 54 }), s('rect', { class: 'rc-sum-disc', x: 4, y: 46, width: 32, height: 8, rx: 3 }), s('rect', { class: 'rc-sum-disc is-2', x: 9, y: 37, width: 22, height: 8, rx: 3 }), s('rect', { class: 'rc-sum-disc is-3', x: 90, y: 46, width: 20, height: 8, rx: 3 })]), label: 'Hanoi: 2ⁿ − 1', text: 'Solve n − 1, move 1, solve n − 1. Minimal, and exponential.' }
    ];
  };
}());
