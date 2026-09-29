/* Lesson 01 · What is an algorithm? — custom figures that no shared renderer covers.

   Every view here follows the renderer contract (docs/ENGINE.md §13):
   - build the SVG once per input (and once per container width: 1 SVG unit = 1 CSS pixel, so text stays crisp),
   - on every render update the kept elements (classes for state, VDSA.animate / VDSA.tween for motion),
   - colours only from --st-* and surface tokens (css/lessons/01-algorithms.css), transitions follow --t.

   Exposes window.C1 = {cardView, pipelineView, raceView, barsView, euclidView, recipeView, tiny} for js/lessons/01-algorithms.js. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s, h = V.h;
  var num = function (v) { return v < 0 ? '−' + Math.abs(v) : String(v); };

  /* Content width of a stage (clientWidth minus padding); falls back when hidden. */
  function contentWidth(el, fallback) {
    var cs = getComputedStyle(el);
    var w = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    return w > 40 ? Math.floor(w) : (fallback || 320);
  }
  function sizeSvg(svg, w, hgt) {
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);
    svg.setAttribute('width', w); svg.setAttribute('height', hgt);
    svg.style.width = '100%'; svg.style.maxWidth = w + 'px'; svg.style.height = 'auto';
  }
  function setT(svg, d) { svg.style.setProperty('--t', Math.max(0, d || 0) + 'ms'); }
  function watchWidth(el, onChange) {
    var last = 0;
    return V.onResize(el, function () { var w = contentWidth(el, 0); if (w && Math.abs(w - last) > 1) { last = w; onChange(w); } });
  }
  /* Move an element along an arc (a hop): x/y are tweened, y lifts by `arc` px at the midpoint. */
  function hop(el, to, d, arc) {
    var st = el.__hop || (el.__hop = { x: to.x, y: to.y, anim: null });
    if (st.anim) st.anim.cancel();
    var x0 = st.x, y0 = st.y;
    function put(x, y) { st.x = x; st.y = y; el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')'); }
    if (!d || (Math.abs(x0 - to.x) < 0.5 && Math.abs(y0 - to.y) < 0.5)) { put(to.x, to.y); return; }
    var lift = Math.abs(to.x - x0) > 4 ? arc : 0;
    st.anim = V.tween(d, function (t, e) { put(x0 + (to.x - x0) * e, y0 + (to.y - y0) * e - lift * Math.sin(Math.PI * e)); }, { ease: 'inOut' });
  }

  /* ================================================================== cards
     cardView(stage, opts).render({cards: [{id, value, up, state}], ptr, best}, {duration})
     opts: maxCard, minCard, gap, showPtr, ptrLabel, showBest, bestLabel, showIndex, raise (px a held card lifts),
           readout ('largest so far' text on top), clickable + onCardClick(index), label */
  function cardView(stage, opts) {
    opts = Object.assign({ maxCard: 62, minCard: 38, gap: 10, showPtr: true, ptrLabel: 'i', showBest: true, bestLabel: 'best',
      showIndex: false, raise: 10, readout: false, readoutLabel: 'largest so far', note: false, clickable: false, onCardClick: null, label: 'Cards' }, opts || {});
    var PAD = 8;
    var svg = s('svg', { class: 'c1-cards' + (opts.clickable ? ' is-clickable-cards' : ''), role: opts.clickable ? 'group' : 'img', 'aria-label': opts.label });
    stage.appendChild(svg);
    var patId = V.uid('c1pat');
    var recs = {}, order = [], L = null, key = '', width = 0, tag = null, ptr = null, readVal = null, read2 = null, noteEl = null, last = null;

    function layout(n, w) {
      var gap = opts.gap, endRoom = opts.showPtr ? 30 : 0, avail = w - 2 * PAD - endRoom;
      var perRow = Math.max(1, n), cw = (avail + gap) / perRow - gap;
      if (cw < opts.minCard && n > 1) {
        perRow = Math.max(1, Math.min(n, Math.floor((avail + gap) / (opts.minCard + gap))));
        var rows0 = Math.ceil(n / perRow); perRow = Math.ceil(n / rows0);
        cw = (avail + gap) / perRow - gap;
      }
      cw = Math.max(22, Math.min(opts.maxCard, cw));
      var ch = Math.round(cw * 1.36), rows = Math.ceil(Math.max(1, n) / perRow);
      var readH = opts.readout ? 46 : 0;
      var top = (opts.showBest ? 34 : 6) + opts.raise, bottom = (opts.showIndex ? 18 : 2) + (opts.showPtr ? 34 : 6);
      var rowH = top + ch + bottom;
      var used = perRow * (cw + gap) - gap, x0 = Math.max(PAD, (w - used - endRoom) / 2) + cw / 2;
      return {
        n: n, cw: cw, ch: ch, perRow: perRow, rows: rows, rowH: rowH, top: top, readH: readH, x0: x0, left: x0 - cw / 2, right: x0 - cw / 2 + used, H: readH + rows * rowH + (opts.note ? 30 : 0),
        pos: function (i) {
          if (n && i >= n) { var p = this.pos(n - 1); return { x: p.x + cw / 2 + 18, y: p.y, end: true }; }
          var r = Math.floor(i / perRow), inRow = Math.min(perRow, n - r * perRow), shift = (perRow - inRow) * (cw + gap) / 2;
          return { x: x0 + shift + (i % perRow) * (cw + gap), y: readH + r * rowH + top + ch / 2 };
        }
      };
    }

    function build(state, w) {
      V.clear(svg); recs = {}; width = w;
      var cards = state.cards;
      L = layout(cards.length, w);
      sizeSvg(svg, w, Math.max(L.H, 60));
      var defs = s('defs', null,
        s('pattern', { id: patId, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
          s('rect', { class: 'c1-pat-bg', width: 7, height: 7 }), s('line', { class: 'c1-pat-line', x1: 0, y1: 0, x2: 0, y2: 7 })));
      svg.appendChild(defs);
      if (opts.readout) {
        readVal = s('tspan', { class: 'c1-readout-v', dx: 8 }, '–');
        svg.appendChild(s('text', { class: 'c1-readout-t', x: L.left, y: 28 }, opts.readoutLabel, readVal));
        read2 = s('text', { class: 'c1-readout-2', x: L.right, y: 28, 'text-anchor': 'end' }, '');
        svg.appendChild(read2);
      }
      if (opts.note) { noteEl = s('text', { class: 'c1-note', x: (L.left + L.right) / 2, y: L.H - 8, 'text-anchor': 'middle' }, ''); svg.appendChild(noteEl); }
      if (!cards.length) {
        svg.appendChild(s('text', { class: 'c1-empty', x: w / 2, y: 36, 'text-anchor': 'middle' }, 'No cards'));
        return;
      }
      var cw = L.cw, ch = L.ch, r = Math.round(cw * 0.14), fs = Math.min(26, Math.round(cw * 0.42));
      order = cards.map(function (c) { return c.id; });
      cards.forEach(function (c, i) {
        var body = s('rect', { class: 'c1-card__body', x: -cw / 2, y: -ch / 2, width: cw, height: ch, rx: r });
        var back = s('g', { class: 'c1-card__back' },
          s('rect', { class: 'c1-card__pat', x: -cw / 2 + 4, y: -ch / 2 + 4, width: cw - 8, height: ch - 8, rx: Math.max(2, r - 3), fill: 'url(#' + patId + ')' }),
          s('circle', { class: 'c1-card__seal', cx: 0, cy: 0, r: Math.round(cw * 0.2) }),
          s('text', { class: 'c1-card__q', x: 0, y: 1, style: 'font-size:' + Math.round(cw * 0.26) + 'px' }, '?'));
        var val = s('text', { class: 'c1-card__val', x: 0, y: 1, style: 'font-size:' + fs + 'px' }, num(c.value));
        var front = s('g', { class: 'c1-card__front' }, val);
        var inner = s('g', { class: 'c1-card__inner' }, body, back, front);
        var g = s('g', { class: 'c1-card', 'data-id': opts.clickable ? String(i) : null }, inner);
        if (opts.showIndex) g.appendChild(s('text', { class: 'c1-card__idx', x: 0, y: ch / 2 + 14 }, i));
        if (opts.clickable) {
          g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
          g.addEventListener('click', function () { if (opts.onCardClick) opts.onCardClick(i); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts.onCardClick) opts.onCardClick(i); } });
        }
        svg.appendChild(g);
        var p = L.pos(i);
        V.place(g, { x: p.x, y: p.y });
        recs[c.id] = { g: g, inner: inner, val: val, up: null, state: null, raised: 0, index: i, anim: null };
      });
      tag = s('g', { class: 'c1-tag' }, s('rect', { x: -26, y: -24, width: 52, height: 21, rx: 10.5 }),
        s('text', { x: 0, y: -13 }, opts.bestLabel), s('path', { d: 'M-5 -3.5 L5 -3.5 L0 3 Z' }));
      ptr = s('g', { class: 'c1-ptr' }, s('path', { d: 'M0 0 L-8 12 L8 12 Z' }), s('text', { x: 0, y: 27 }, opts.ptrLabel));
      if (opts.showBest) svg.appendChild(tag);
      if (opts.showPtr) svg.appendChild(ptr);
      tag.style.opacity = '0'; ptr.style.opacity = '0';
      tag.__hop = null; hop(tag, { x: L.pos(0).x, y: L.pos(0).y - ch / 2 - 6 }, 0);
      V.place(ptr, { x: L.pos(0).x, y: L.pos(0).y + ch / 2 + (opts.showIndex ? 22 : 6), opacity: 0 });
    }

    function setFlip(rec, sx, lift) {
      rec.inner.setAttribute('transform', 'translate(0 ' + lift.toFixed(2) + ') scale(' + Math.max(0.002, sx).toFixed(3) + ' 1)');
    }
    function flip(rec, up, d) {
      if (rec.anim) { rec.anim.cancel(); rec.anim = null; }
      rec.up = up;
      if (!d) { rec.g.classList.toggle('is-up', up); setFlip(rec, 1, 0); return; }
      var swapped = false;
      rec.anim = V.tween(Math.max(160, d), function (t) {
        if (!swapped && t >= 0.5) { swapped = true; rec.g.classList.toggle('is-up', up); }
        setFlip(rec, Math.abs(Math.cos(Math.PI * t)), -9 * Math.sin(Math.PI * t));
      }, { ease: 'linear' });
    }

    function render(state, ctx) {
      last = state;
      var d = ctx && ctx.duration ? ctx.duration : 0;
      var w = contentWidth(stage);
      var k = state.cards.map(function (c) { return c.id + ':' + c.value; }).join('|');
      if (k !== key || Math.abs(w - width) > 1) { key = k; build(state, w); d = 0; }
      setT(svg, d);
      if (!state.cards.length) return;
      state.cards.forEach(function (c, i) {
        var rec = recs[c.id]; if (!rec) return;
        var st = c.state || 'default';
        if (rec.state !== st) { rec.g.setAttribute('class', 'c1-card is-' + st + (rec.up ? ' is-up' : '')); rec.state = st; }
        if (rec.up !== !!c.up) flip(rec, !!c.up, rec.up === null ? 0 : d);
        else rec.g.classList.toggle('is-up', !!c.up);
        var raised = (st === 'key' || st === 'found') ? opts.raise : 0;
        if (rec.raised !== raised || d === 0) {
          var p = L.pos(i);
          V.animate(rec.g, { x: p.x, y: p.y - raised }, { duration: d, ease: raised ? 'back' : 'out' });
          rec.raised = raised;
        }
        if (opts.clickable) rec.g.setAttribute('aria-label', 'Card ' + (i + 1) + ', ' + (c.up ? 'shows ' + num(c.value) : 'face down'));
      });
      if (opts.showBest) {
        if (state.best !== null && state.best !== undefined) {
          var bp = L.pos(state.best);
          hop(tag, { x: bp.x, y: bp.y - L.ch / 2 - opts.raise - 6 }, tag.style.opacity === '0' ? 0 : d, 30);
          tag.style.opacity = '1';
          tag.setAttribute('class', 'c1-tag' + (state.cards[state.best] && state.cards[state.best].state === 'found' ? ' is-found' : ''));
        } else tag.style.opacity = '0';
      }
      if (opts.showPtr) {
        if (state.ptr !== null && state.ptr !== undefined) {
          var pp = L.pos(state.ptr), wasHidden = ptr.style.opacity === '0';
          V.animate(ptr, { x: pp.x, y: pp.y + L.ch / 2 + (opts.showIndex ? 22 : 6), opacity: pp.end ? 0.55 : 1 }, { duration: wasHidden ? 0 : d, ease: 'out' });
          ptr.style.opacity = pp.end ? '0.55' : '1';
          ptr.lastChild.textContent = opts.ptrLabel;
        } else { V.animate(ptr, { opacity: 0 }, { duration: d }); ptr.style.opacity = '0'; }
      }
      if (readVal) {
        var bv = state.readout !== undefined ? String(state.readout) : state.best !== null && state.best !== undefined ? num(state.cards[state.best].value) : '–';
        if (readVal.textContent !== bv) readVal.textContent = bv;
        if (read2) read2.textContent = state.readout2 || '';
      }
      if (noteEl) noteEl.textContent = state.note || '';
    }
    watchWidth(stage, function () { if (last) render(last, { duration: 0 }); });
    return { el: svg, render: render, cardEl: function (i) { var id = order[i]; return id ? recs[id].g : null; }, refresh: function () { if (last) { key = ''; render(last, { duration: 0 }); } } };
  }

  /* ================================================================== input → algorithm → output */
  function pipelineView(stage) {
    var svg = s('svg', { class: 'c1-pipe', role: 'img', 'aria-label': 'Input tray, algorithm machine and output slot' });
    stage.appendChild(svg);
    var width = 0, key = '', last = null, G = null, cards = {}, outCard = null, bestText = null, machine = null, win = null;

    function geometry(w, n) {
      var vertical = w < 560, g = { vertical: vertical, w: w };
      if (!vertical) {
        var H = 214;
        g.H = H;
        g.tray = { x: 4, y: 34, w: Math.round(w * 0.36), h: H - 52 };
        g.mach = { x: Math.round(w * 0.43), y: 26, w: Math.round(w * 0.27), h: H - 36 };
        g.out = { x: Math.round(w * 0.77), y: 34, w: w - Math.round(w * 0.77) - 4, h: H - 52 };
      } else {
        var trayH = n > 4 ? 132 : 92;
        g.tray = { x: 4, y: 26, w: w - 8, h: trayH };
        g.mach = { x: Math.round(w * 0.14), y: 26 + trayH + 36, w: Math.round(w * 0.72), h: 150 };
        g.out = { x: Math.round(w * 0.3), y: g.mach.y + g.mach.h + 50, w: Math.round(w * 0.4), h: 86 };
        g.H = g.out.y + g.out.h + 6;
      }
      var cols = vertical ? Math.min(n, 4) : Math.min(n, 4), rows = Math.ceil(n / Math.max(1, cols));
      var cs = Math.min(46, Math.floor((g.tray.w - 16) / Math.max(1, cols)) - 8, Math.floor((g.tray.h - 12) / Math.max(1, rows) / 1.3) - 6);
      g.cs = Math.max(26, cs); g.cols = cols;
      g.slot = function (k) {
        var r = Math.floor(k / cols), c = k % cols, inRow = Math.min(cols, n - r * cols);
        var pitch = g.cs + 8, rowsH = rows * (g.cs * 1.3 + 8) - 8;
        return { x: g.tray.x + g.tray.w / 2 + (c - (inRow - 1) / 2) * pitch, y: g.tray.y + g.tray.h / 2 - rowsH / 2 + g.cs * 0.65 + r * (g.cs * 1.3 + 8) };
      };
      g.intake = vertical ? { x: g.mach.x + g.mach.w / 2, y: g.mach.y + 10 } : { x: g.mach.x + 12, y: g.mach.y + g.mach.h / 2 };
      g.exit = vertical ? { x: g.mach.x + g.mach.w / 2, y: g.mach.y + g.mach.h - 8 } : { x: g.mach.x + g.mach.w - 12, y: g.mach.y + g.mach.h / 2 };
      g.outAt = { x: g.out.x + g.out.w / 2, y: g.out.y + g.out.h / 2 + 4 };
      return g;
    }
    function arrow(x1, y1, x2, y2) {
      var ang = Math.atan2(y2 - y1, x2 - x1), a = 7;
      return s('g', { class: 'c1-pipe__arrow' },
        s('line', { x1: x1, y1: y1, x2: x2 - Math.cos(ang) * 4, y2: y2 - Math.sin(ang) * 4 }),
        s('path', { d: 'M' + x2 + ' ' + y2 + ' L' + (x2 - a * Math.cos(ang - 0.45)) + ' ' + (y2 - a * Math.sin(ang - 0.45)) + ' L' + (x2 - a * Math.cos(ang + 0.45)) + ' ' + (y2 - a * Math.sin(ang + 0.45)) + ' Z' }));
    }
    function gear(x, y, r) {
      var teeth = r > 9 ? 9 : 7, d = '', ro = r, ri = r * 0.74;
      for (var t = 0; t < teeth; t++) {
        var a0 = (t / teeth) * Math.PI * 2, a1 = a0 + Math.PI / teeth * 0.55, a2 = a0 + Math.PI / teeth, a3 = a2 + Math.PI / teeth * 0.45;
        [[ri, a0], [ro, a0 + 0.08], [ro, a1], [ri, a1 + 0.08], [ri, a2], [ri, a3]].forEach(function (p, i) {
          d += (t === 0 && i === 0 ? 'M' : 'L') + (p[0] * Math.cos(p[1])).toFixed(2) + ' ' + (p[0] * Math.sin(p[1])).toFixed(2) + ' ';
        });
      }
      return s('g', { transform: 'translate(' + x + ' ' + y + ')' }, s('g', { class: 'c1-gear' },
        s('path', { d: d + 'Z', class: 'c1-gear__body' }), s('circle', { r: r * 0.3, class: 'c1-gear__hole' })));
    }
    function card(value, size) {
      var g = s('g', { class: 'c1-pcard' },
        s('rect', { x: -size / 2, y: -size * 0.65, width: size, height: size * 1.3, rx: size * 0.16 }),
        s('text', { x: 0, y: 1, style: 'font-size:' + Math.round(size * 0.42) + 'px' }, num(value)));
      return g;
    }
    function build(step, w) {
      V.clear(svg); cards = {}; width = w;
      var n = step.values.length;
      G = geometry(w, n);
      sizeSvg(svg, w, G.H);
      function region(r, label, cls) {
        var g = s('g', { class: 'c1-pipe__region ' + cls },
          s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 14 }),
          s('text', { class: 'c1-pipe__label', x: r.x + 4, y: r.y - 9 }, label));
        svg.appendChild(g); return g;
      }
      region(G.tray, 'INPUT', 'is-tray');
      region(G.out, 'OUTPUT', 'is-out');
      var m = G.mach;
      machine = s('g', { class: 'c1-pipe__machine' },
        s('rect', { class: 'c1-pipe__body', x: m.x, y: m.y, width: m.w, height: m.h, rx: 18 }),
        s('text', { class: 'c1-pipe__title', x: m.x + m.w / 2, y: m.y + 24 }, 'find the largest'));
      var ww = Math.min(m.w - 36, 150), wx = m.x + (m.w - ww) / 2, wy = m.y + 38;
      win = s('g', { class: 'c1-pipe__window' }, s('rect', { x: wx, y: wy, width: ww, height: 62, rx: 10 }),
        s('text', { class: 'c1-pipe__wlabel', x: wx + ww / 2, y: wy + 17 }, 'best so far'));
      bestText = s('text', { class: 'c1-pipe__best', x: wx + ww / 2, y: wy + 44 }, '–');
      win.appendChild(bestText);
      machine.appendChild(win);
      machine.appendChild(gear(m.x + 30, m.y + m.h - 26, 15));
      machine.appendChild(gear(m.x + 55, m.y + m.h - 37, 10));
      machine.appendChild(gear(m.x + m.w - 32, m.y + m.h - 26, 15));
      svg.appendChild(machine);
      if (G.vertical) {
        svg.appendChild(arrow(w / 2, G.tray.y + G.tray.h + 6, w / 2, m.y - 6));
        svg.appendChild(arrow(w / 2, m.y + m.h + 6, w / 2, G.out.y - 16));
      } else {
        svg.appendChild(arrow(G.tray.x + G.tray.w + 6, G.tray.y + G.tray.h / 2, m.x - 6, G.tray.y + G.tray.h / 2));
        svg.appendChild(arrow(m.x + m.w + 6, G.tray.y + G.tray.h / 2, G.out.x - 6, G.tray.y + G.tray.h / 2));
      }
      step.values.forEach(function (v, k) {
        var sp = G.slot(k);
        svg.appendChild(s('rect', { class: 'c1-pipe__slot', x: sp.x - G.cs / 2, y: sp.y - G.cs * 0.65, width: G.cs, height: G.cs * 1.3, rx: G.cs * 0.16 }));
      });
      step.values.forEach(function (v, k) {
        var g = card(v, G.cs); svg.appendChild(g);
        var p = G.slot(k); V.place(g, { x: p.x, y: p.y, opacity: 1, scale: 1 });
        cards[step.ids[k]] = { g: g, k: k };
      });
      outCard = card(0, Math.max(G.cs, 40)); outCard.classList.add('is-out');
      svg.appendChild(outCard);
      V.place(outCard, { x: G.exit.x, y: G.exit.y, opacity: 0, scale: 0.6 });
    }
    function render(step, ctx) {
      last = step;
      var d = ctx && ctx.duration || 0, w = contentWidth(stage);
      var k = step.values.join(',');
      if (k !== key || Math.abs(w - width) > 1) { key = k; build(step, w); d = 0; }
      setT(svg, d);
      step.ids.forEach(function (id, idx) {
        var c = cards[id]; if (!c) return;
        var inside = idx < step.taken;
        var p = inside ? G.intake : G.slot(idx);
        V.animate(c.g, { x: p.x, y: p.y, opacity: inside ? 0 : 1, scale: inside ? 0.45 : 1 }, { duration: d, ease: 'inOut' });
        c.g.setAttribute('class', 'c1-pcard' + (id === step.bestFrom && inside ? ' is-best' : '') + (idx === step.taken - 1 && step.out === null ? ' is-last' : ''));
      });
      var bt = step.best === null ? '–' : num(step.best);
      if (bestText.textContent !== bt) { bestText.textContent = bt; win.classList.remove('is-bump'); void win.getBBox(); if (d) win.classList.add('is-bump'); }
      machine.classList.toggle('is-running', d > 0 && step.taken > 0 && step.out === null);
      if (step.out !== null && step.out !== undefined) {
        outCard.lastChild.textContent = num(step.out);
        V.animate(outCard, { x: G.outAt.x, y: G.outAt.y, opacity: 1, scale: 1 }, { duration: d, ease: 'back' });
      } else V.animate(outCard, { x: G.exit.x, y: G.exit.y, opacity: 0, scale: 0.6 }, { duration: d });
    }
    watchWidth(stage, function () { if (last) { key = ''; render(last, { duration: 0 }); } });
    return { el: svg, render: render };
  }

  /* ================================================================== guessing race */
  function raceView(stage) {
    var svg = s('svg', { class: 'c1-race', role: 'img', 'aria-label': 'Two strips of numbers from 1 to 100, one per guessing strategy' });
    stage.appendChild(svg);
    var width = 0, n = 0, last = null, lanes = {}, X0 = 0, CW = 0, secretLine = null, secretLbl = null;
    var LANE = [{ key: 'up', title: 'Count up from 1' }, { key: 'half', title: 'Halve the range' }];
    function build(step, w) {
      V.clear(svg); width = w; n = step.n; lanes = {};
      var laneH = 106, H = laneH * 2 + 22;
      sizeSvg(svg, w, H);
      X0 = 10; CW = (w - 20) / n;
      LANE.forEach(function (ln, li) {
        var y = li * laneH;
        var g = s('g', { class: 'c1-lane is-' + ln.key });
        g.appendChild(s('text', { class: 'c1-lane__title', x: X0, y: y + 15 }, ln.title));
        var status = s('text', { class: 'c1-lane__status', x: w - 10, y: y + 15, 'text-anchor': 'end' }, '');
        g.appendChild(status);
        var trackY = y + 54, cells = [];
        var band = s('rect', { class: 'c1-band', x: X0 - 3, y: trackY - 5, width: w - 14, height: 32, rx: 7 });
        if (ln.key === 'half') g.appendChild(band);
        for (var k = 1; k <= n; k++) {
          var c = s('rect', { class: 'c1-cell', x: X0 + (k - 1) * CW + (CW > 5 ? 0.6 : 0.2), y: trackY, width: Math.max(0.8, CW - (CW > 5 ? 1.2 : 0.4)), height: 22, rx: CW > 6 ? 2 : 0.5 });
          g.appendChild(c); cells.push(c);
        }
        [1, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n].forEach(function (t) {
          g.appendChild(s('text', { class: 'c1-axis', x: X0 + (t - 0.5) * CW, y: trackY + 38, 'text-anchor': 'middle' }, t));
        });
        var marker = s('g', { class: 'c1-marker' }, s('rect', { x: -19, y: -21, width: 38, height: 19, rx: 9.5 }), s('text', { x: 0, y: -11.5 }, ''), s('path', { d: 'M-4 -2.5 L4 -2.5 L0 3 Z' }));
        g.appendChild(marker);
        V.place(marker, { x: X0, y: trackY - 3, opacity: 0 });
        svg.appendChild(g);
        lanes[ln.key] = { g: g, status: status, cells: cells, band: band, marker: marker, trackY: trackY, states: [] };
      });
      secretLine = s('line', { class: 'c1-secret', x1: 0, x2: 0, y1: 44, y2: laneH + 82 });
      secretLbl = s('text', { class: 'c1-secret__lbl', x: 0, y: H - 4, 'text-anchor': 'middle' }, 'secret');
      svg.appendChild(secretLine); svg.appendChild(secretLbl);
    }
    function cx(k) { return X0 + (k - 0.5) * CW; }
    function setCells(lane, fn) {
      for (var k = 1; k <= n; k++) {
        var st = fn(k);
        if (lane.states[k] !== st) { lane.cells[k - 1].setAttribute('class', 'c1-cell is-' + st); lane.states[k] = st; }
      }
    }
    function marker(lane, guess, done, d) {
      if (guess === null) { V.animate(lane.marker, { opacity: 0 }, { duration: d }); return; }
      var x = Math.max(X0 + 19, Math.min(width - 29, cx(guess)));
      lane.marker.childNodes[1].textContent = guess;
      lane.marker.setAttribute('class', 'c1-marker' + (done ? ' is-found' : ''));
      V.animate(lane.marker, { x: x, y: lane.trackY - 3, opacity: 1 }, { duration: d, ease: 'out' });
    }
    function render(step, ctx) {
      last = step;
      var d = ctx && ctx.duration || 0, w = contentWidth(stage);
      if (!lanes.up || step.n !== n || Math.abs(w - width) > 1) { build(step, w); d = 0; }
      setT(svg, d);
      var sx = cx(step.secret);
      V.animate(secretLine, { attr: { x1: sx, x2: sx } }, { duration: d });
      V.animate(secretLbl, { attr: { x: Math.max(24, Math.min(width - 24, sx)) } }, { duration: d });
      var up = step.up, hv = step.half;
      setCells(lanes.up, function (k) {
        if (up.guess === null) return 'default';
        if (k === up.guess) return up.reply === 'correct' ? 'found' : 'compare';
        return k < up.guess ? 'muted' : 'default';
      });
      setCells(lanes.half, function (k) {
        if (hv.guess === null) return 'default';
        if (hv.reply === 'correct') return k === hv.guess ? 'found' : 'muted';
        if (k === hv.guess) return 'active';
        return (k < hv.lo || k > hv.hi) ? 'muted' : 'default';
      });
      marker(lanes.up, up.guess, up.reply === 'correct', d);
      marker(lanes.half, hv.guess, hv.reply === 'correct', d);
      var lo = hv.reply === 'correct' ? hv.guess : hv.lo, hi = hv.reply === 'correct' ? hv.guess : hv.hi;
      V.animate(lanes.half.band, { attr: { x: X0 + (lo - 1) * CW - 3, width: (hi - lo + 1) * CW + 6 } }, { duration: d, ease: 'inOut' });
      lanes.up.status.textContent = up.count ? up.count + (up.count === 1 ? ' guess' : ' guesses') + (up.reply === 'correct' ? ' · got it!' : '') : '';
      lanes.half.status.textContent = hv.count ? hv.count + (hv.count === 1 ? ' guess' : ' guesses') + (hv.reply === 'correct' ? ' · got it!' : ' · “' + hv.reply + '”') : '';
      lanes.up.status.classList.toggle('is-done', up.reply === 'correct');
      lanes.half.status.classList.toggle('is-done', hv.reply === 'correct');
    }
    watchWidth(stage, function () { if (last) { width = 0; render(last, { duration: 0 }); } });
    return { el: svg, render: render };
  }

  /* ================================================================== guesses for every secret 1..n */
  function barsView(stage, stats, onSelect) {
    var svg = s('svg', { class: 'c1-bars', tabindex: '0', role: 'img', 'aria-label': 'Bar chart: guesses needed for each secret from 1 to ' + stats.n + '. Count-up rises in a straight ramp to ' + stats.n + '; halving stays at ' + stats.maxHalving + ' or fewer.' });
    stage.appendChild(svg);
    var width = 0, sel = 50, bars = [], hi = null, tip = null, tipText = null, P = null, N = stats.n;
    function build(w) {
      V.clear(svg); width = w; bars = [];
      var H = w < 520 ? 220 : 260;
      sizeSvg(svg, w, H);
      P = { l: 34, r: w - 10, t: 34, b: H - 26 };
      var cw = (P.r - P.l) / N, ymax = N;
      function Y(v) { return P.b - v / ymax * (P.b - P.t); }
      P.cw = cw; P.Y = Y;
      var grid = s('g', { class: 'c1-bars__grid' });
      [0, 25, 50, 75, 100].forEach(function (v) {
        grid.appendChild(s('line', { x1: P.l, x2: P.r, y1: Y(v), y2: Y(v) }));
        grid.appendChild(s('text', { x: P.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, v));
      });
      [1, 25, 50, 75, 100].forEach(function (v) { grid.appendChild(s('text', { x: P.l + (v - 0.5) * cw, y: P.b + 16, 'text-anchor': 'middle' }, v)); });
      grid.appendChild(s('text', { class: 'c1-bars__axis', x: P.r, y: P.b + 16, 'text-anchor': 'end', dy: 0 }, ''));
      svg.appendChild(grid);
      hi = s('rect', { class: 'c1-bars__hi', x: 0, y: P.t - 6, width: cw, height: P.b - P.t + 6, rx: 2 });
      svg.appendChild(hi);
      for (var k = 1; k <= N; k++) {
        var x = P.l + (k - 1) * cw, gap = cw > 5 ? 1 : 0.3;
        var a = s('rect', { class: 'c1-bar is-up', x: x + gap / 2, y: Y(stats.countUp[k - 1]), width: Math.max(0.6, cw - gap), height: P.b - Y(stats.countUp[k - 1]) });
        var bw = Math.max(0.8, (cw - gap) * 0.62);
        var b = s('rect', { class: 'c1-bar is-half', x: x + (cw - bw) / 2, y: Y(stats.halving[k - 1]), width: bw, height: P.b - Y(stats.halving[k - 1]) });
        svg.appendChild(a); svg.appendChild(b); bars.push([a, b]);
      }
      var avgU = stats.avgCountUp, avgH = stats.avgHalving;
      svg.appendChild(s('line', { class: 'c1-avg is-up', x1: P.l, x2: P.r, y1: Y(avgU), y2: Y(avgU) }));
      svg.appendChild(s('text', { class: 'c1-avg__lbl is-up', x: P.l + 6, y: Y(avgU) - 6 }, 'count-up average ' + avgU.toFixed(1)));
      svg.appendChild(s('line', { class: 'c1-avg is-half', x1: P.l, x2: P.r, y1: Y(avgH), y2: Y(avgH) }));
      svg.appendChild(s('text', { class: 'c1-avg__lbl is-half', x: P.r - 4, y: Y(avgH) - 8, 'text-anchor': 'end' }, 'halving average ' + avgH.toFixed(1)));
      tip = s('g', { class: 'c1-bars__tip' }, s('rect', { x: 0, y: 0, width: 10, height: 22, rx: 11 }), tipText = s('text', { x: 0, y: 15 }, ''));
      svg.appendChild(tip);
      select(sel, 0, true);
    }
    function select(k, d, silent) {
      k = Math.max(1, Math.min(N, k));
      var prev = sel; sel = k;
      if (bars[prev - 1]) bars[prev - 1].forEach(function (b) { b.classList.remove('is-sel'); });
      bars[k - 1].forEach(function (b) { b.classList.add('is-sel'); });
      var x = P.l + (k - 1) * P.cw;
      V.animate(hi, { attr: { x: x - 1.5, width: P.cw + 3 } }, { duration: d === undefined ? 180 : d });
      tipText.textContent = 'secret ' + k + ': count-up ' + stats.countUp[k - 1] + ', halving ' + stats.halving[k - 1];
      var tw = tipText.getComputedTextLength ? tipText.getComputedTextLength() + 20 : 200;
      var tx = Math.max(P.l, Math.min(width - tw - 4, x + P.cw / 2 - tw / 2));
      tip.firstChild.setAttribute('width', tw); tipText.setAttribute('x', tw / 2);
      tip.setAttribute('transform', 'translate(' + tx.toFixed(1) + ' 4)');
      svg.setAttribute('aria-valuetext', tipText.textContent);
      if (!silent && onSelect) onSelect(k);
    }
    function pick(e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (width / r.width);
      var k = Math.floor((x - P.l) / P.cw) + 1;
      if (k >= 1 && k <= N) select(k);
    }
    svg.addEventListener('click', pick);
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); select(sel + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); select(sel - 1); }
      else if (e.key === 'Home') { e.preventDefault(); select(1); }
      else if (e.key === 'End') { e.preventDefault(); select(N); }
    });
    build(contentWidth(stage));
    watchWidth(stage, function (w) { if (Math.abs(w - width) > 1) build(w); });
    return { el: svg, select: function (k) { select(k, 180, true); } };
  }

  /* ================================================================== Euclid's rectangle */
  var SIZE_STATES = ['active', 'compare', 'pivot', 'frontier', 'path', 'visited', 'swap', 'key'];
  function euclidView(stage) {
    var svg = s('svg', { class: 'c1-eu', role: 'img', 'aria-label': 'A rectangle being cut into squares' });
    stage.appendChild(svg);
    var width = 0, key = '', last = null, geo = null, sqs = {}, rem = null, remLbl = null, grid = null, colours = {}, layer = null;
    function build(step, w) {
      V.clear(svg); sqs = {}; width = w; colours = {};
      var availH = Math.min(340, Math.max(200, w * 0.62)), pad = 10, side = 54;
      var sc = Math.min((w - 2 * side) / step.W, (availH - 2 * pad) / step.H);
      var rw = step.W * sc, rh = step.H * sc, H = rh + 2 * pad + 18;
      sizeSvg(svg, w, H);
      geo = { sc: sc, ox: (w - rw) / 2, oy: pad + 16, rw: rw, rh: rh };
      svg.appendChild(s('text', { class: 'c1-eu__dim', x: geo.ox + rw / 2, y: geo.oy - 5, 'text-anchor': 'middle' }, step.W + ' wide'));
      svg.appendChild(s('text', { class: 'c1-eu__dim', x: geo.ox - 6, y: geo.oy + rh / 2, 'text-anchor': 'end', 'dominant-baseline': 'central' }, step.H + ' tall'));
      svg.appendChild(s('rect', { class: 'c1-eu__frame', x: geo.ox, y: geo.oy, width: rw, height: rh, rx: 3 }));
      layer = s('g'); svg.appendChild(layer);
      // colour by size, in order of first appearance over the whole trace
      (step.allSizes || []).forEach(function (sz, i) { colours[sz] = SIZE_STATES[i % SIZE_STATES.length]; });
      rem = s('rect', { class: 'c1-eu__rem', x: geo.ox, y: geo.oy, width: rw, height: rh, rx: 3 });
      remLbl = s('text', { class: 'c1-eu__remlbl', x: geo.ox + rw / 2, y: geo.oy + rh / 2 + 5, 'text-anchor': 'middle' }, '');
      svg.appendChild(rem); svg.appendChild(remLbl);
      var g = step.gcdFinal * sc, d = '';
      if (g >= 5) {
        for (var x = g; x < rw - 0.5; x += g) d += 'M' + (geo.ox + x).toFixed(1) + ' ' + geo.oy + ' V' + (geo.oy + rh).toFixed(1);
        for (var y = g; y < rh - 0.5; y += g) d += 'M' + geo.ox + ' ' + (geo.oy + y).toFixed(1) + ' H' + (geo.ox + rw).toFixed(1);
      }
      grid = s('path', { class: 'c1-eu__grid', d: d || 'M0 0' });
      svg.appendChild(grid);
    }
    function render(step, ctx) {
      last = step;
      var d = ctx && ctx.duration || 0, w = contentWidth(stage);
      var k = step.W + 'x' + step.H;
      if (k !== key || Math.abs(w - width) > 1) { key = k; build(step, w); d = 0; }
      setT(svg, d);
      var sc = geo.sc, keep = {};
      step.squares.forEach(function (q) {
        keep[q.id] = true;
        var rec = sqs[q.id], sz = q.size * sc;
        if (!rec) {
          var r = s('rect', { x: -sz / 2, y: -sz / 2, width: sz, height: sz, rx: Math.min(4, sz / 6) });
          var t = s('text', { x: 0, y: Math.min(sz * 0.18, 6), 'text-anchor': 'middle', style: 'font-size:' + Math.max(10, Math.min(22, sz * 0.32)).toFixed(0) + 'px' }, sz >= 22 ? q.size : '');
          var g = s('g', { class: 'c1-sq' }, r, t);
          layer.appendChild(g);
          V.place(g, { x: geo.ox + (q.x + q.size / 2) * sc, y: geo.oy + (q.y + q.size / 2) * sc, scale: d ? 0.4 : 1, opacity: d ? 0 : 1 });
          V.animate(g, { scale: 1, opacity: 1 }, { duration: d, ease: 'back' });
          rec = sqs[q.id] = { g: g };
        }
        var st = q.last ? (step.kind === 'done' ? 'found' : 'default') : (colours[q.size] || 'active');
        rec.g.setAttribute('class', 'c1-sq is-' + st + (step.cut && step.cut.id === q.id ? ' is-new' : ''));
      });
      Object.keys(sqs).forEach(function (id) {
        if (!keep[id]) { var g = sqs[id].g; delete sqs[id]; V.animate(g, { opacity: 0, scale: 0.6 }, { duration: d }).then(function () { if (g.parentNode) g.parentNode.removeChild(g); }); }
      });
      var r = step.rem, done = step.kind === 'done';
      V.animate(rem, { attr: { x: geo.ox + r.x * sc, y: geo.oy + r.y * sc, width: r.w * sc, height: r.h * sc } }, { duration: d, ease: 'inOut' });
      rem.style.opacity = done ? '0' : '1';
      var lblFits = r.w * sc >= 54 && r.h * sc >= 22 && !done;
      remLbl.textContent = lblFits ? r.w + ' × ' + r.h : '';
      V.animate(remLbl, { attr: { x: geo.ox + (r.x + r.w / 2) * sc, y: geo.oy + (r.y + r.h / 2) * sc + 5 } }, { duration: d, ease: 'inOut' });
      grid.style.opacity = done ? '1' : '0';
    }
    watchWidth(stage, function () { if (last) { key = ''; render(last, { duration: 0 }); } });
    return { el: svg, render: render };
  }

  /* ================================================================== robot cook reading a recipe (HTML) */
  var ROBOT = '<svg viewBox="0 0 120 132" aria-hidden="true" class="c1-robot__svg">' +
    '<line x1="60" y1="14" x2="60" y2="30" class="c1-robot__ant"/><circle cx="60" cy="11" r="6" class="c1-robot__bulb"/>' +
    '<rect x="16" y="30" width="88" height="68" rx="20" class="c1-robot__head"/>' +
    '<rect x="27" y="44" width="66" height="36" rx="12" class="c1-robot__visor"/>' +
    '<g class="c1-robot__eyes"><circle cx="46" cy="61" r="6" class="c1-robot__eye"/><circle cx="74" cy="61" r="6" class="c1-robot__eye"/></g>' +
    '<g class="c1-robot__q"><text x="46" y="67" text-anchor="middle">?</text><text x="74" y="67" text-anchor="middle">?</text></g>' +
    '<path d="M46 88 Q60 96 74 88" class="c1-robot__mouth"/>' +
    '<rect x="8" y="54" width="8" height="20" rx="4" class="c1-robot__ear"/><rect x="104" y="54" width="8" height="20" rx="4" class="c1-robot__ear"/>' +
    '<rect x="34" y="102" width="52" height="26" rx="10" class="c1-robot__body"/>' +
    '<circle cx="60" cy="115" r="5" class="c1-robot__light"/></svg>';
  /* recipeView(stage, recipes) → {render(step, ctx)}; recipes = {vague: [{html, ask}], exact: [...]}
     step: {mode, line (0 = not started, 1..n reading, n+1 finished), statuses: ['todo'|'ok'|'stuck'], say} */
  function recipeView(stage) {
    var wrap = h('div', { class: 'c1-recipe' });
    var robot = h('div', { class: 'c1-robot', html: ROBOT });
    var say = h('p', { class: 'c1-robot__say', 'aria-hidden': 'true' });
    var card = h('div', { class: 'c1-recipe__card' });
    var title = h('p', { class: 'c1-recipe__title' });
    var list = h('ol', { class: 'c1-recipe__list' });
    var pointer = h('span', { class: 'c1-recipe__ptr', 'aria-hidden': 'true' });
    card.appendChild(title); card.appendChild(list); card.appendChild(pointer);
    wrap.appendChild(h('div', { class: 'c1-robot-col' }, robot, say));
    wrap.appendChild(card);
    stage.appendChild(wrap);
    var mode = null, items = [];
    function build(step) {
      mode = step.mode; V.clear(list); items = [];
      title.textContent = step.title;
      step.lines.forEach(function (ln, i) {
        var li = h('li', { class: 'c1-recipe__line' }, h('span', { class: 'c1-recipe__num' }, String(i + 1)), h('span', { class: 'c1-recipe__text', html: ln.html }),
          ln.ask ? h('span', { class: 'c1-ask', role: 'note' }, ln.ask) : h('span', { class: 'c1-ok', 'aria-hidden': 'true' }, '✓'));
        list.appendChild(li); items.push(li);
      });
    }
    function render(step, ctx) {
      var d = ctx && ctx.duration || 0;
      if (step.mode !== mode) { build(step); d = 0; }
      wrap.style.setProperty('--t', d + 'ms');
      items.forEach(function (li, i) {
        var st = step.statuses[i];
        li.className = 'c1-recipe__line is-' + st + (step.line === i + 1 ? ' is-current' : '');
      });
      var cur = items[Math.min(items.length, Math.max(1, step.line)) - 1];
      if (step.line >= 1 && step.line <= items.length && cur) {
        pointer.style.opacity = '1';
        pointer.style.transform = 'translateY(' + (cur.offsetTop + cur.offsetHeight / 2 - 9) + 'px)';
      } else pointer.style.opacity = '0';
      robot.className = 'c1-robot is-' + step.face;
      say.textContent = step.say || '';
    }
    V.onResize(stage, function () { /* re-seat the pointer after reflow */ var cur = list.querySelector('.is-current'); if (cur) pointer.style.transform = 'translateY(' + (cur.offsetTop + cur.offsetHeight / 2 - 9) + 'px)'; });
    return { el: wrap, render: render };
  }

  /* ================================================================== tiny static pictures (summary, timeline) */
  var tiny = {
    cards: function (vals, states, o) {
      o = o || {};
      var C = o.size || 26, P = C + 6, W = vals.length * P - 6 + 8, H = C * 1.36 + (o.tag !== undefined ? 24 : 6) + (o.ptr !== undefined ? 16 : 0);
      var svg = s('svg', { class: 'c1-tiny', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
      svg.style.maxWidth = (W * 1.6) + 'px';
      var top = o.tag !== undefined ? 22 : 3;
      vals.forEach(function (v, k) {
        var st = (states && states[k]) || 'default', up = v !== null;
        var g = s('g', { class: 'c1-card is-' + st + (up ? ' is-up' : ''), transform: 'translate(' + (4 + k * P + C / 2) + ' ' + (top + C * 0.68) + ')' },
          s('rect', { class: 'c1-card__body', x: -C / 2, y: -C * 0.68, width: C, height: C * 1.36, rx: 4 }));
        if (up) g.appendChild(s('text', { class: 'c1-card__val', x: 0, y: 1, style: 'font-size:' + Math.round(C * 0.45) + 'px' }, num(v)));
        else g.appendChild(s('rect', { class: 'c1-tiny__back', x: -C / 2 + 3, y: -C * 0.68 + 3, width: C - 6, height: C * 1.36 - 6, rx: 2.5 }));
        svg.appendChild(g);
      });
      if (o.tag !== undefined) {
        var x = 4 + o.tag * P + C / 2;
        svg.appendChild(s('g', { class: 'c1-tag', transform: 'translate(' + x + ' 19)' }, s('rect', { x: -19, y: -17, width: 38, height: 15, rx: 7.5 }), s('text', { x: 0, y: -9, style: 'font-size:9.5px' }, o.tagText || 'best'), s('path', { d: 'M-4 -2.5 L4 -2.5 L0 2 Z' })));
      }
      if (o.ptr !== undefined) {
        var px = 4 + o.ptr * P + C / 2;
        svg.appendChild(s('g', { class: 'c1-ptr', transform: 'translate(' + px + ' ' + (top + C * 1.36 + 3) + ')' }, s('path', { d: 'M0 0 L-5 8 L5 8 Z' })));
      }
      return svg;
    },
    svg: function (w, hgt, inner) {
      var el = s('svg', { class: 'c1-tiny', viewBox: '0 0 ' + w + ' ' + hgt, 'aria-hidden': 'true' });
      el.innerHTML = inner; el.style.maxWidth = (w * 1.5) + 'px';
      return el;
    }
  };

  window.C1 = { cardView: cardView, pipelineView: pipelineView, raceView: raceView, barsView: barsView, euclidView: euclidView, recipeView: recipeView, tiny: tiny, contentWidth: contentWidth, num: num };
}());
