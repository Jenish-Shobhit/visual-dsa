/* Lesson 35 · Dynamic programming II — custom views (VDSA.dp35.*).
   pairStrip   two strings as letter tiles, prefix tint, match links and a "common subsequence" slot row
   candBar     the candidate cards under a table ("take" vs "skip", "↖ ↑ ←")
   knapStage   item cards on a shelf and a bag whose bar is the capacity; cards fly into the bag
   staticGrid  a one-shot grid render for minis and the summary card
   All views follow the renderer contract: render(state, {duration}), prepare-free, colours only from tokens. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, vz = V.vz;
  var D = V.dp35 = V.dp35 || {};

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* Move a <g> along a lifted arc (record kept in the same slot VDSA.animate uses, so both can be mixed). */
  function fly(g, x, y, ms, lift) {
    var st = g.__vdsa || (g.__vdsa = { x: 0, y: 0, scale: 1, rotate: 0, opacity: null, attr: {} });
    if (st.anim) st.anim.cancel();
    var x0 = st.x, y0 = st.y;
    function put(px, py) { st.x = px; st.y = py; g.setAttribute('transform', 'translate(' + px.toFixed(2) + ' ' + py.toFixed(2) + ')'); }
    if (!ms || ms <= 0 || (Math.abs(x0 - x) < 0.5 && Math.abs(y0 - y) < 0.5)) { put(x, y); return; }
    st.anim = V.tween(V.dur(ms), function (t) {
      var e = ease(t);
      put(lerp(x0, x, e), lerp(y0, y, e) - Math.sin(Math.PI * e) * (lift || 0));
    }, { ease: function (t) { return t; } });
  }
  function sizeTo(el, w, hh, ms) {
    var attrs = {};
    if (w !== null) attrs.width = w;
    if (hh !== null) attrs.height = hh;
    V.animate(el, { attr: attrs }, { duration: ms });
  }
  function textTo(el, x, ms) { V.animate(el, { attr: { x: x } }, { duration: ms }); }

  /* ================================================================== pairStrip */
  /* state: {a, b, i, j (1-based cursor, 0 = none), links: [[i, j]], result, L, bad, trace} */
  D.pairStrip = function (host, o) {
    o = o || {};
    var svg = null, built = null, lastW = 0, geo = null, A = [], B = [], links = {}, linkLayer = null, slots = [], N = 1;
    function clearAll() { V.clear(host); svg = null; A = []; B = []; links = {}; slots = []; }
    function tile(parent, ch, ts, fs) {
      var g = s('g', { class: 'vz-item is-default' }, s('rect', { class: 'vz-shape', width: ts, height: ts, rx: 7 }),
        s('text', { class: 'vz-ink vz-value', x: ts / 2, y: ts / 2, 'text-anchor': 'middle', dy: '.35em', style: 'font-size:' + fs + 'px' }, ch));
      parent.appendChild(g);
      return g;
    }
    function build(a, b, Wd) {
      clearAll();
      var m = a.length, n = b.length; N = Math.max(m, n, 1);
      var labelW = 46, t = Math.max(20, Math.min(36, Math.floor((Wd - labelW - 14) / N))), ts = t - 4, fs = Math.max(11, Math.round(ts * 0.5));
      var yA = 6, yB = yA + ts + 34, yR = yB + ts + 22, Ht = yR + ts + 8;
      geo = { t: t, ts: ts, yA: yA, yB: yB, yR: yR, labelW: labelW, Wd: Wd, xa0: labelW + (Wd - labelW - m * t) / 2, xb0: labelW + (Wd - labelW - n * t) / 2 };
      svg = s('svg', { class: 'vz dp35-strip', viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img', 'aria-label': o.label || 'Two strings and their common subsequence' });
      svg.style.width = '100%'; svg.style.maxWidth = Wd + 'px'; svg.style.height = 'auto';
      [['A', yA], ['B', yB]].forEach(function (p) { svg.appendChild(s('text', { class: 'dp35-rowname', x: 6, y: p[1] + ts / 2, dy: '.35em' }, p[0])); });
      svg.appendChild(s('text', { class: 'dp35-rowname is-sub', x: 6, y: yR + ts / 2, dy: '.35em' }, 'common'));
      linkLayer = s('g', { class: 'dp35-links' }); svg.appendChild(linkLayer);
      for (var q = 0; q < m; q++) { var g = tile(svg, a[q], ts, fs); vz.place(g, geo.xa0 + q * t + 2, yA); A.push(g); }
      for (q = 0; q < n; q++) { var g2 = tile(svg, b[q], ts, fs); vz.place(g2, geo.xb0 + q * t + 2, yB); B.push(g2); }
      for (q = 0; q < N; q++) {
        var sg = tile(svg, '', ts, fs);
        sg.classList.add('dp35-slot'); sg.style.opacity = '0';
        slots.push(sg);
      }
      V.clear(host); host.appendChild(svg);
      built = { a: a, b: b };
      lastW = Wd;
    }
    function linkEl(i, j) {
      var key = i + ',' + j;
      if (links[key]) return links[key];
      var x1 = geo.xa0 + (i - 1) * geo.t + 2 + geo.ts / 2, y1 = geo.yA + geo.ts, x2 = geo.xb0 + (j - 1) * geo.t + 2 + geo.ts / 2, y2 = geo.yB, my = (y1 + y2) / 2;
      var g = s('g', { class: 'vz-edge is-path dp35-link' }, s('path', { class: 'vz-line', d: 'M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2 }));
      g.style.opacity = '0';
      linkLayer.appendChild(g);
      links[key] = g;
      return g;
    }
    function render(st, ctx) {
      var dur = ctx && ctx.duration || 0;
      var Wd = Math.max(240, Math.round(host.clientWidth || lastW || 600));
      if (!built || built.a !== st.a || built.b !== st.b || Math.abs(Wd - lastW) > 60) build(st.a, st.b, Wd);
      svg.style.setProperty('--vz-dur', dur + 'ms');
      var linkedA = {}, linkedB = {}, keys = {};
      (st.links || []).forEach(function (p) { linkedA[p[0]] = true; linkedB[p[1]] = true; keys[p[0] + ',' + p[1]] = true; });
      var i = st.i || 0, j = st.j || 0, live = !st.trace && !st.bad;
      var same = i > 0 && j > 0 && st.a[i - 1] === st.b[j - 1];
      A.forEach(function (g, k) {
        var idx = k + 1, state = 'default';
        if (linkedA[idx]) state = 'path';
        else if (live && idx === i) state = same ? 'found' : 'active';
        else if (live && idx < i) state = 'visited';
        vz.state(g, state);
      });
      B.forEach(function (g, k) {
        var idx = k + 1, state = 'default';
        if (linkedB[idx]) state = 'path';
        else if (live && idx === j) state = same ? 'found' : 'active';
        else if (live && idx < j) state = 'visited';
        vz.state(g, state);
      });
      (st.links || []).forEach(function (p) { linkEl(p[0], p[1]); });
      Object.keys(links).forEach(function (k) {
        var on = !!keys[k], g = links[k];
        if (g.__on === on) return;
        g.__on = on;
        V.animate(g, { opacity: on ? 1 : 0 }, { duration: dur, delay: on ? dur * 0.25 : 0 });
      });
      // the "common subsequence" slot row
      var res = st.result || '', L = st.bad ? res.length : (st.L === null || st.L === undefined ? 0 : st.L);
      var x0 = geo.labelW + (geo.Wd - geo.labelW - L * geo.t) / 2 + 2;
      slots.forEach(function (g, k) {
        var show = k < L;
        var filled = show && k >= L - res.length;
        vz.state(g, filled ? (st.bad ? 'error' : 'path') : 'default');
        vz.toggle(g, 'is-empty', show && !filled);
        var txt = g.querySelector('text');
        vz.text(txt, filled ? res[k - (L - res.length)] : '');
        if (show) fly(g, x0 + k * geo.t, geo.yR, g.__shown ? dur * 0.6 : 0, 0);
        else fly(g, geo.labelW + (geo.Wd - geo.labelW) / 2, geo.yR, 0, 0);
        if (g.__shown !== show) { g.__shown = show; V.animate(g, { opacity: show ? 1 : 0 }, { duration: dur }); }
      });
    }
    var lastSt = null, baseRender = render;
    render = function (st, ctx) { lastSt = st; baseRender(st, ctx); };
    V.onResize(host, function () { if (lastSt && built && Math.abs((host.clientWidth || 0) - lastW) > 60) baseRender(lastSt, { duration: 0 }); });
    return { el: host, render: function (st, ctx) { render(st, ctx); }, reset: function () { built = null; } };
  };

  /* ================================================================== candBar */
  /* cands: [{tag, title, expr, val, win, off}] or null. */
  D.candBar = function (host, o) {
    o = o || {};
    host.classList.add('dp2-cands');
    host.setAttribute('aria-hidden', 'true');
    var sig = '', cards = [], hint = h('p', { class: 'dp2-cands__hint' }, o.hint || 'Each cell weighs its options here.');
    host.appendChild(hint);
    function render(cands, hintText) {
      if (hintText !== undefined && hint.textContent !== hintText) hint.textContent = hintText;
      if (!cands || !cands.length) {
        if (sig !== '') { V.clear(host); host.appendChild(hint); sig = ''; cards = []; }
        hint.hidden = false;
        return;
      }
      hint.hidden = true;
      var nsig = cands.map(function (c) { return c.tag + '|' + c.title + '|' + c.expr; }).join('¦');
      if (nsig !== sig) {
        V.clear(host); host.appendChild(hint); hint.hidden = true; cards = [];
        cands.forEach(function (c) {
          var card = h('div', { class: 'dp2-cand', 'data-tag': c.tag },
            h('span', { class: 'dp2-cand__title' }, c.title), h('span', { class: 'dp2-cand__expr' }, c.expr), h('span', { class: 'dp2-cand__val' }, ''));
          host.appendChild(card); cards.push(card);
        });
        sig = nsig;
      }
      cands.forEach(function (c, k) {
        var card = cards[k];
        card.classList.toggle('is-off', !!c.off);
        card.classList.toggle('is-win', !!c.win);
        card.querySelector('.dp2-cand__val').textContent = c.off ? '—' : String(c.val) + (c.win ? '  ✓' : '');
      });
    }
    return { el: host, render: render };
  };

  /* ================================================================== knapStage */
  /* state: {items: [{id, no, w, v, state, slot}], W, bagW, bagV} */
  D.knapStage = function (host, o) {
    o = o || {};
    var svg = null, built = '', lastW = 0, geo = null, cards = {}, statText = null;
    function build(items, W, Wd) {
      V.clear(host); cards = {};
      var n = items.length, pad = 10;
      var cw = Wd < 420 ? 52 : 62, chh = 52, gap = 8;
      var u = Math.max(14, Math.min(46, Math.floor((Wd - 2 * pad - 16) / Math.max(1, W))));
      var barW = u * W, barH = 46;
      var shelfY = 8, bagY = shelfY + chh + 44, Ht = bagY + barH + 40;
      var shelfW = n * (cw + gap) - gap, shelfX0 = Math.max(pad, Math.min((Wd - shelfW) / 2, Wd - pad - shelfW));
      geo = { cw: cw, ch: chh, gap: gap, u: u, barW: barW, barH: barH, shelfY: shelfY, bagY: bagY, shelfX0: shelfX0, barX: Math.max(pad + 8, (Wd - barW) / 2), Ht: Ht, Wd: Wd };
      svg = s('svg', { class: 'vz dp35-knap', viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img', 'aria-label': o.label || 'Items on a shelf and a bag with room for ' + W + ' units' });
      svg.style.width = '100%'; svg.style.maxWidth = Wd + 'px'; svg.style.height = 'auto';
      // shelf slots
      for (var q = 0; q < n; q++) svg.appendChild(s('rect', { class: 'vz-slot', x: shelfX0 + q * (cw + gap), y: shelfY, width: cw, height: chh, rx: 8 }));
      svg.appendChild(s('text', { class: 'vz-caption', x: geo.barX, y: bagY - 12 }, 'BAG · ROOM FOR ' + W));
      // bag: capacity bar with unit ticks
      svg.appendChild(s('rect', { class: 'dp35-bag', x: geo.barX - 4, y: bagY - 4, width: barW + 8, height: barH + 8, rx: 10 }));
      for (q = 1; q < W; q++) svg.appendChild(s('line', { class: 'dp35-tick', x1: geo.barX + q * u, x2: geo.barX + q * u, y1: bagY + barH - 7, y2: bagY + barH }));
      statText = s('text', { class: 'dp35-bagstat', x: geo.barX + barW, y: bagY + barH + 26, 'text-anchor': 'end' }, '');
      svg.appendChild(statText);
      items.forEach(function (it, k) {
        var g = s('g', { class: 'vz-item is-default dp35-card', 'data-id': it.id, 'data-label': 'Item ' + it.no + ', weight ' + it.w + ', value ' + it.v },
          s('rect', { class: 'vz-shape', x: 0, y: 0, width: cw, height: chh, rx: 8 }),
          s('text', { class: 'vz-ink vz-value dp35-c1', x: cw / 2, y: chh * 0.36, 'text-anchor': 'middle', dy: '.35em' }, '#' + it.no),
          s('text', { class: 'vz-ink dp35-c2', x: cw / 2, y: chh * 0.72, 'text-anchor': 'middle', dy: '.35em' }, 'w' + it.w + ' · v' + it.v));
        svg.appendChild(g);
        cards[it.id] = { g: g, rect: g.querySelector('rect'), t1: g.querySelector('.dp35-c1'), t2: g.querySelector('.dp35-c2'), k: k, inBag: null };
        V.place(g, { x: shelfX0 + k * (cw + gap), y: shelfY });
      });
      host.appendChild(svg);
      built = items.map(function (i) { return i.w + ':' + i.v; }).join(',') + '/' + W;
      lastW = Wd;
    }
    function render(st, ctx) {
      var dur = ctx && ctx.duration || 0;
      var Wd = Math.max(260, Math.round(host.clientWidth || lastW || 600));
      var key = st.items.map(function (i) { return i.w + ':' + i.v; }).join(',') + '/' + st.W;
      if (!svg || key !== built || Math.abs(Wd - lastW) > 60) build(st.items, st.W, Wd);
      svg.style.setProperty('--vz-dur', dur + 'ms');
      var taken = st.items.filter(function (i) { return i.slot >= 0; }).sort(function (a, b) { return a.slot - b.slot; });
      var xs = {}, acc = 0;
      taken.forEach(function (it) { xs[it.id] = geo.barX + acc * geo.u; acc += it.w; });
      st.items.forEach(function (it) {
        var c = cards[it.id], inBag = it.slot >= 0;
        vz.state(c.g, it.state);
        var x, y, w, hh;
        if (inBag) { x = xs[it.id] + 1; y = geo.bagY + 3; w = it.w * geo.u - 2; hh = geo.barH - 6; }
        else { x = geo.shelfX0 + c.k * (geo.cw + geo.gap); y = geo.shelfY; w = geo.cw; hh = geo.ch; }
        var first = c.inBag === null, changed = c.inBag !== inBag;
        c.inBag = inBag;
        var ms = first ? 0 : dur;
        fly(c.g, x, y, ms, inBag ? 46 : 30);
        sizeTo(c.rect, w, hh, ms);
        textTo(c.t1, w / 2, ms); textTo(c.t2, w / 2, ms);
        c.t1.setAttribute('y', (hh * (inBag ? 0.36 : 0.36)).toFixed(1)); c.t2.setAttribute('y', (hh * 0.72).toFixed(1));
        vz.text(c.t2, inBag ? (w >= 30 ? 'v' + it.v : '') : 'w' + it.w + ' · v' + it.v);
        c.t2.style.opacity = inBag && w < 30 ? '0' : '1';
        if (changed && !first && inBag) c.g.parentNode.appendChild(c.g);   // keep flying cards on top
      });
      vz.text(statText, 'weight ' + st.bagW + ' / ' + st.W + '  ·  value ' + st.bagV);
    }
    var lastSt = null, baseRender = render;
    render = function (st, ctx) { lastSt = st; baseRender(st, ctx); };
    V.onResize(host, function () { if (lastSt && svg && Math.abs((host.clientWidth || 0) - lastW) > 60) baseRender(lastSt, { duration: 0 }); });
    return { el: host, render: function (st, ctx) { render(st, ctx); }, reset: function () { built = ''; } };
  };

  /* ================================================================== staticGrid */
  D.staticGrid = function (host, state, opts) {
    var view = V.views.grid(host, Object.assign({ mode: 'table', cellSize: 34, minCell: 14, pop: false, label: 'Table' }, opts || {}));
    view.render(state, { duration: 0 });
    return view;
  };
  /* Tiny grid states for minis: rows of values ('.' = empty), states by letter map. */
  D.miniState = function (rows, o) {
    o = o || {};
    var cells = rows.map(function (row, r) {
      return row.map(function (v, c) {
        var st = o.states && o.states[r + ',' + c];
        if (v === null || v === undefined) return st || (o.text && o.text[r + ',' + c]) ? { text: o.text && o.text[r + ',' + c], state: st || 'default' } : null;
        return { value: typeof v === 'number' || typeof v === 'string' ? v : undefined, text: o.text && o.text[r + ',' + c], state: st || 'visited' };
      });
    });
    var out = { rows: rows.length, cols: rows[0].length, cells: cells, rowHeaders: o.rowHeaders || null, colHeaders: o.colHeaders || null, arrows: o.arrows || [] };
    if (o.cursor) out.cursor = o.cursor;
    if (o.walls) out.walls = o.walls;
    return out;
  };
}());
