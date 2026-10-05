/* Lesson 32 · Greedy algorithms — custom figure views (all animated, all driven by snapshots from js/algos/32-greedy.js).
     VDSA.gr32.timeline(el, opts)   intervals on a time axis: rows, busy columns, clash overlays, dashed "best" rings, draggable bars
     VDSA.gr32.coins(el, opts)      two coin stacks (greedy vs best) with a tray of denominations
     VDSA.gr32.knap(el, opts)       three bags: pour (fractional), whole items (0/1 greedy), best whole items
     VDSA.gr32.forest(el, opts)     Huffman forest: nodes glide, edges follow, 0/1 labels, code chips
     VDSA.gr32.terrain(el, opts)    hill-climbing analogy
   Every view: render(snapshot, {duration}), prepare(snapshots), reset(), el, on(event, fn), destroy().
   Colours come only from the shared state classes (.vz-item.is-*, --st-* tokens), so both themes work. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var gr = V.gr32 = V.gr32 || {};

  function svgRoot(cls, label) {
    return s('svg', { class: 'vz ' + cls, role: 'img', 'aria-label': label || 'Figure', preserveAspectRatio: 'xMidYMin meet' });
  }
  function setDur(svg, dur) { svg.style.setProperty('--vz-dur', (dur || 0) + 'ms'); }
  function emitter() {
    var map = {};
    return {
      on: function (ev, fn) { (map[ev] = map[ev] || []).push(fn); return function () { map[ev] = map[ev].filter(function (f) { return f !== fn; }); }; },
      emit: function (ev, p) { (map[ev] || []).slice().forEach(function (f) { f(p); }); }
    };
  }

  /* Keyed sprite layer: create once per id, then glide. spec = {create(d) -> g, update(g, d, dur, isNew)}.
     d = {id, x, y, opacity?, scale?, from?: id of an existing sprite to fly out of}. */
  function layer(parent, spec) {
    var g0 = s('g', { class: 'gr-layer' });
    parent.appendChild(g0);
    var recs = {};
    function remove(id, dur) {
      var r = recs[id]; if (!r) return;
      delete recs[id];
      if (!dur) { if (r.g.parentNode) r.g.parentNode.removeChild(r.g); return; }
      V.animate(r.g, { opacity: 0 }, { duration: dur }).then(function () { if (r.g.parentNode && !recs[id]) r.g.parentNode.removeChild(r.g); });
    }
    return {
      g: g0,
      get: function (id) { return recs[id] || null; },
      render: function (list, dur) {
        var seen = {};
        list.forEach(function (d) {
          seen[d.id] = true;
          var r = recs[d.id], isNew = !r;
          if (!r) {
            var g = spec.create(d);
            g0.appendChild(g);
            r = recs[d.id] = { g: g, x: d.x, y: d.y };
            var src = d.from && recs[d.from];
            if (src) { V.place(g, { x: src.x, y: src.y, opacity: 0.0 }); }
            else V.place(g, { x: d.x, y: d.y + (d.enterDy || 0), opacity: 0 });
          }
          spec.update(r.g, d, dur, isNew);
          V.animate(r.g, { x: d.x, y: d.y, opacity: d.opacity === undefined ? 1 : d.opacity, scale: d.scale === undefined ? 1 : d.scale }, { duration: isNew ? Math.max(dur, 0) : dur });
          r.x = d.x; r.y = d.y;
        });
        Object.keys(recs).forEach(function (id) { if (!seen[id]) remove(id, dur ? Math.min(dur, 260) : 0); });
      },
      clear: function () { Object.keys(recs).forEach(function (id) { remove(id, 0); }); },
      ids: function () { return Object.keys(recs); }
    };
  }
  gr.layer = layer;

  function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /* ================================================================== timeline */
  gr.timeline = function (container, opts) {
    opts = opts || {};
    container = V.$(container);
    var T = opts.T || 24, rowH = opts.rowH || 32, barH = opts.barH || 24, gutter = opts.gutter === undefined ? 70 : opts.gutter, topPad = 24;
    var ev = emitter();
    var svg = svgRoot('gr-tl', opts.label || 'Timeline of requests');
    svg.style.width = '100%'; svg.style.display = 'block';
    container.appendChild(svg);
    var gGuides = s('g', { class: 'gr-guides', 'aria-hidden': 'true' });
    svg.appendChild(gGuides);
    var W = 320, rows = opts.rows || 1, u = 10, last = null;
    function xOf(t) { return gutter + t * u; }
    function yOf(row) { return topPad + row * rowH; }

    var busyL = layer(svg, {
      create: function () { var g = s('g', { class: 'gr-busy', 'aria-hidden': 'true' }); g.appendChild(s('rect', { rx: 4 })); return g; },
      update: function (g, d, dur) { var r = g.firstChild; V.animate(r, { attr: { width: d.w, height: d.h } }, { duration: dur }); r.setAttribute('y', 0); }
    });
    var itemL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-bar is-default', 'data-id': d.id, 'data-label': d.aria || d.label });
        var rect = s('rect', { class: 'vz-shape', x: 0, y: -barH / 2, height: barH, rx: 7, width: d.w });
        var lab = s('text', { class: 'vz-ink vz-value gr-bar__label', x: 9, y: 0, dy: '.35em' });
        var sub = s('text', { class: 'vz-ink gr-bar__sub', y: 0, dy: '.35em', 'text-anchor': 'end' });
        g.appendChild(rect); g.appendChild(lab); g.appendChild(sub);
        if (d.draggable) {
          g.classList.add('is-draggable');
          g.appendChild(s('rect', { class: 'gr-grip', x: 0, y: -barH / 2, width: 8, height: barH, rx: 4 }));
          g.appendChild(s('rect', { class: 'gr-grip gr-grip--end', x: 0, y: -barH / 2, width: 8, height: barH, rx: 4 }));
          g.setAttribute('tabindex', '0'); g.setAttribute('role', 'slider');
          bindDrag(g, d.id);
        } else if (opts.clickable) {
          g.classList.add('is-clickable'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
          g.addEventListener('click', function () { ev.emit('click', { id: d.id }); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ev.emit('click', { id: d.id }); } });
        }
        return g;
      },
      update: function (g, d, dur) {
        var cls = 'vz-item gr-bar is-' + (d.state || 'default') + (d.draggable ? ' is-draggable' : '') + (opts.clickable && !d.draggable ? ' is-clickable' : '') + (d.picked ? ' is-picked' : '');
        if (g.getAttribute('class') !== cls) g.setAttribute('class', cls);
        var kids = g.childNodes, rect = kids[0], lab = kids[1], sub = kids[2];
        V.animate(rect, { attr: { width: d.w } }, { duration: dur });
        lab.textContent = d.label || '';
        var showSub = d.sub && d.w > 84;
        sub.textContent = showSub ? d.sub : '';
        sub.setAttribute('x', Math.max(20, d.w - 9));
        if (d.draggable) {
          kids[3].setAttribute('x', 0); kids[4].setAttribute('x', d.w - 8);
          g.setAttribute('aria-valuetext', 'from ' + d.s + ' to ' + d.e);
          g.setAttribute('aria-label', 'Request ' + d.label + ' from ' + d.s + ' to ' + d.e + '. Arrow keys move it, Shift plus arrows change its end, Alt plus arrows change its start.');
        } else if (d.aria) g.setAttribute('aria-label', d.aria);
      }
    });
    var clashL = layer(svg, {
      create: function () { var g = s('g', { class: 'gr-clash', 'aria-hidden': 'true' }); g.appendChild(s('rect', { rx: 4, y: -barH / 2 - 2, height: barH + 4 })); return g; },
      update: function (g, d, dur) { V.animate(g.firstChild, { attr: { width: d.w } }, { duration: dur }); }
    });
    var ghostL = layer(svg, {
      create: function () { var g = s('g', { class: 'gr-ghost', 'aria-hidden': 'true' }); g.appendChild(s('rect', { rx: 9, y: -barH / 2 - 4, height: barH + 8, x: -3 })); g.appendChild(s('text', { class: 'gr-ghost__tag', y: -barH / 2 - 8, 'text-anchor': 'end' }, 'best')); return g; },
      update: function (g, d, dur) { V.animate(g.firstChild, { attr: { width: d.w + 6 } }, { duration: dur }); g.lastChild.setAttribute('x', d.w + 3); }
    });
    var labL = layer(svg, {
      create: function () {
        var g = s('g', { class: 'gr-rowlabel' });
        g.appendChild(s('text', { class: 'gr-rowlabel__main', x: 4, y: 0, dy: '.35em' }));
        g.appendChild(s('text', { class: 'gr-rowlabel__sub', x: 4, y: 0 }));
        return g;
      },
      update: function (g, d) {
        var a = g.firstChild, b = g.lastChild;
        a.textContent = d.text || ''; b.textContent = d.sub || '';
        if (d.sub) { a.setAttribute('dy', '-.1em'); a.setAttribute('y', -3); b.setAttribute('y', 10); a.setAttribute('class', 'gr-rowlabel__main is-two'); }
        else { a.setAttribute('y', 0); a.setAttribute('dy', '.35em'); a.setAttribute('class', 'gr-rowlabel__main'); }
        b.setAttribute('x', 4);
        a.style.fontSize = d.small ? '11.5px' : '';
      }
    });

    function drawGuides() {
      V.clear(gGuides);
      var h = topPad + rows * rowH + 4;
      var step = T <= 24 ? 4 : 5;
      for (var t = 0; t <= T; t += step) {
        gGuides.appendChild(s('line', { class: 'gr-tick', x1: xOf(t), x2: xOf(t), y1: topPad - 6, y2: h - 2 }));
        gGuides.appendChild(s('text', { class: 'gr-tick__label', x: xOf(t), y: 11, 'text-anchor': 'middle' }, String(t)));
      }
      gGuides.appendChild(s('line', { class: 'gr-axis', x1: xOf(0), x2: xOf(T), y1: topPad - 6, y2: topPad - 6 }));
      for (var r = 0; r < rows; r++) gGuides.appendChild(s('line', { class: 'gr-rowline', x1: xOf(0), x2: xOf(T), y1: yOf(r) + rowH / 2, y2: yOf(r) + rowH / 2, style: r === rows - 1 ? 'display:none' : '' }));
    }
    function size() {
      W = Math.max(260, container.clientWidth || 320);
      u = (W - gutter - 10) / T;
      var h = topPad + rows * rowH + 6;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + h);
      svg.setAttribute('width', W); svg.setAttribute('height', h);
      svg.style.height = 'auto';
      drawGuides();
    }

    var current = null; // items by id (geometry source while dragging)
    function render(state, o) {
      o = o || {};
      var dur = o.duration === undefined ? 450 : o.duration;
      setDur(svg, dur);
      last = state;
      var need = Math.max(opts.rows || 1, state.rows || 1);
      (state.items || []).forEach(function (it) { need = Math.max(need, it.row + 1); });
      if (need !== rows) { rows = need; size(); }
      var list = (state.items || []).map(function (it) {
        return { id: 'i:' + it.id, x: xOf(it.s), y: yOf(it.row) + rowH / 2, w: Math.max(4, (it.e - it.s) * u), from: it.from ? 'i:' + it.from : null, enterDy: 0,
          state: it.state, label: it.label, sub: it.sub, aria: it.aria, draggable: it.draggable, s: it.s, e: it.e, picked: it.picked, opacity: it.opacity, rawId: it.id };
      });
      itemL.render(list, dur);
      // rawId lookups for drag
      list.forEach(function (d) { var r = itemL.get(d.id); if (r) { r.g.__gid = d.rawId; r.g.__s = d.s; r.g.__e = d.e; } });
      busyL.render((state.busy || []).map(function (b, i) { return { id: 'b:' + b.s + '-' + b.e, x: xOf(b.s), y: topPad - 4, w: (b.e - b.s) * u, h: rows * rowH + 2 }; }), dur);
      clashL.render((state.clash || []).map(function (c, i) { return { id: 'c:' + c.id + ':' + c.s + '-' + c.e, x: xOf(c.s), y: yOf(rowOf(state, c.id)) + rowH / 2, w: (c.e - c.s) * u }; }), dur);
      ghostL.render((state.ghosts || []).map(function (id) { var it = (state.items || []).filter(function (x) { return x.id === id; })[0]; return it ? { id: 'g:' + id, x: xOf(it.s), y: yOf(it.row) + rowH / 2, w: (it.e - it.s) * u } : null; }).filter(Boolean), dur);
      labL.render((state.rowLabels || []).map(function (l) { return { id: 'l:' + l.id, x: 0, y: yOf(l.row) + rowH / 2, text: l.text, sub: l.sub, small: l.small }; }), dur);
    }
    function rowOf(state, id) { var it = (state.items || []).filter(function (x) { return x.id === id; })[0]; return it ? it.row : 0; }

    /* ---- dragging ---- */
    function bindDrag(g, uid) {
      var mode = null, x0 = 0, s0 = 0, e0 = 0, moved = false;
      function clampMove(ds) { var len = e0 - s0; var ns = Math.max(0, Math.min(T - len, s0 + ds)); return { s: ns, e: ns + len }; }
      g.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button > 0) return;
        var r = g.getBoundingClientRect(), lx = e.clientX - r.left;
        s0 = g.__s; e0 = g.__e;
        mode = lx > r.width - 12 ? 'end' : lx < 12 && r.width > 40 ? 'start' : 'move';
        x0 = e.clientX; moved = false;
        try { g.setPointerCapture(e.pointerId); } catch (_) {}
        g.classList.add('is-dragging'); e.preventDefault();
      });
      g.addEventListener('pointermove', function (e) {
        if (!mode) return;
        var ds = Math.round((e.clientX - x0) / u);
        var n;
        if (mode === 'move') n = clampMove(ds);
        else if (mode === 'end') n = { s: s0, e: Math.max(s0 + 1, Math.min(T, e0 + ds)) };
        else n = { s: Math.max(0, Math.min(e0 - 1, s0 + ds)), e: e0 };
        if (n.s !== g.__s || n.e !== g.__e) { moved = true; ev.emit('drag', { id: g.__gid, s: n.s, e: n.e, mode: mode }); }
      });
      function up() { if (!mode) return; mode = null; g.classList.remove('is-dragging'); if (moved) ev.emit('dragend', { id: g.__gid }); }
      g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
      g.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var s1 = g.__s, e1 = g.__e, len = e1 - s1;
        if (e.shiftKey) e1 = Math.max(s1 + 1, Math.min(T, e1 + d));
        else if (e.altKey) s1 = Math.max(0, Math.min(e1 - 1, s1 + d));
        else { var ns = Math.max(0, Math.min(T - len, s1 + d)); s1 = ns; e1 = ns + len; }
        if (s1 !== g.__s || e1 !== g.__e) { ev.emit('drag', { id: g.__gid, s: s1, e: e1, mode: 'key' }); ev.emit('dragend', { id: g.__gid }); }
        var self = g, id = uid;
        setTimeout(function () { var r = itemL.get(id); if (r) r.g.focus(); void self; }, 0);
      });
    }

    size();
    if (V.onResize) V.onResize(container, function () { var w = container.clientWidth; if (w && Math.abs(w - W) > 1 && last) { size(); render(last, { duration: 0 }); } });
    var api = {
      el: svg, render: render, on: ev.on,
      prepare: function (states) { var m = opts.rows || 1; states.forEach(function (st) { (st.items || []).forEach(function (it) { m = Math.max(m, it.row + 1); }); m = Math.max(m, st.rows || 1); }); if (m !== rows) { rows = m; size(); } },
      reset: function () { itemL.clear(); busyL.clear(); clashL.clear(); ghostL.clear(); labL.clear(); },
      destroy: function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
    return api;
  };

  /* ================================================================== coins */
  gr.coins = function (container, opts) {
    opts = opts || {};
    container = V.$(container);
    var W = 640, H = 360, baseY = 262;
    var svg = svgRoot('gr-coins', opts.label || 'Two stacks of coins');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.width = '100%'; svg.style.display = 'block';
    container.appendChild(svg);
    var cx = { g: 180, b: 460 };
    var maxPicks = 6;
    ['g', 'b'].forEach(function (k) {
      svg.appendChild(s('rect', { class: 'gr-plate', x: cx[k] - 90, y: baseY, width: 180, height: 8, rx: 4 }));
    });
    var slots = {};
    ['g', 'b'].forEach(function (k) {
      var sg = s('g', { class: 'gr-slot', 'aria-hidden': 'true' });
      sg.appendChild(s('rect', { x: cx[k] - 70, y: baseY - 176, width: 140, height: 170, rx: 12 }));
      sg.appendChild(s('text', { x: cx[k], y: baseY - 86, 'text-anchor': 'middle' }, 'coins stack up here'));
      svg.appendChild(sg); slots[k] = sg;
    });
    var titles = {};
    ['g', 'b'].forEach(function (k) {
      titles[k] = s('text', { class: 'gr-coins__title', x: cx[k], y: 26, 'text-anchor': 'middle' });
      svg.appendChild(titles[k]);
    });
    var meters = {};
    ['g', 'b'].forEach(function (k) {
      var gg = s('g', { class: 'gr-meter' });
      gg.appendChild(s('rect', { class: 'gr-meter__bg', x: cx[k] - 80, y: 316, width: 160, height: 10, rx: 5 }));
      var fill = s('rect', { class: 'gr-meter__fill', x: cx[k] - 80, y: 316, width: 160, height: 10, rx: 5 });
      gg.appendChild(fill);
      var t = s('text', { class: 'gr-meter__text', x: cx[k], y: 346, 'text-anchor': 'middle' });
      gg.appendChild(t); svg.appendChild(gg);
      meters[k] = { fill: fill, text: t, g: gg };
    });
    var sumText = {};
    ['g', 'b'].forEach(function (k) { sumText[k] = s('text', { class: 'gr-sum', x: cx[k], y: 56, 'text-anchor': 'middle' }); svg.appendChild(sumText[k]); });
    function coinW(v) { return 38 + 9 * Math.sqrt(v); }
    var trayL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-chip is-default' });
        g.appendChild(s('rect', { class: 'vz-shape', x: -21, y: -14, width: 42, height: 28, rx: 14 }));
        g.appendChild(s('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, String(d.v)));
        return g;
      },
      update: function (g, d) { g.setAttribute('class', 'vz-item gr-chip is-' + d.state); }
    });
    var coinL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-coin is-default' });
        g.appendChild(s('rect', { class: 'vz-shape', rx: 8 }));
        g.appendChild(s('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, String(d.v)));
        return g;
      },
      update: function (g, d, dur) {
        var r = g.firstChild, w = coinW(d.v);
        g.setAttribute('class', 'vz-item gr-coin is-' + d.state);
        r.setAttribute('x', -w / 2); r.setAttribute('y', -d.th / 2 + 1); r.setAttribute('width', w); r.setAttribute('height', Math.max(4, d.th - 2));
        r.setAttribute('rx', Math.min(8, d.th / 2));
        g.lastChild.style.display = d.th >= 17 ? '' : 'none';
        g.lastChild.style.fontSize = Math.min(16, d.th - 3) + 'px';
      }
    });
    var badge = s('g', { class: 'gr-verdict', opacity: 0 });
    badge.appendChild(s('text', { x: W / 2, y: 190, 'text-anchor': 'middle', class: 'gr-verdict__text' }));
    svg.appendChild(badge);

    var api = {
      el: svg,
      prepare: function (steps) { maxPicks = 4; steps.forEach(function (st) { maxPicks = Math.max(maxPicks, st.greedy.picks.length, st.best.picks.length); }); },
      reset: function () { trayL.clear(); coinL.clear(); },
      render: function (st, o) {
        o = o || {};
        var dur = o.duration === undefined ? 450 : o.duration;
        setDur(svg, dur);
        var th = Math.max(6, Math.min(34, 170 / Math.max(3, maxPicks)));
        var tray = [], coins = [];
        ['g', 'b'].forEach(function (k) {
          var side = k === 'g' ? st.greedy : st.best, hidden = k === 'b' && !side.shown;
          var n = st.coins.length, gap = Math.min(50, 170 / n);
          st.coins.forEach(function (c, i) {
            var x = cx[k] + (i - (n - 1) / 2) * gap;
            tray.push({ id: 't' + k + c, v: c, x: x, y: 292, state: side.active === c ? 'active' : 'default', opacity: hidden ? 0 : 1 });
          });
          side.picks.forEach(function (c, i) {
            coins.push({ id: 'c' + k + i, v: c, x: cx[k], y: baseY - th * (i + 0.5), th: th, from: 't' + k + c, state: (k === 'g' ? 'active' : 'done') });
          });
          slots[k].style.opacity = (hidden || side.picks.length) ? 0 : 1;
          var total = side.picks.reduce(function (a, b) { return a + b; }, 0);
          sumText[k].textContent = hidden ? '' : (side.picks.length ? side.picks.join(' + ') + ' = ' + total : '');
          var frac = st.amount ? side.remaining / st.amount : 0;
          V.animate(meters[k].fill, { attr: { width: Math.max(0, 160 * frac) } }, { duration: dur });
          meters[k].text.textContent = hidden ? '' : (side.remaining ? 'left to pay: ' + side.remaining : 'paid in full');
          meters[k].g.style.opacity = hidden ? 0 : 1;
          titles[k].textContent = k === 'g' ? 'Greedy: biggest coin first' + (side.picks.length ? '  ·  ' + side.picks.length + (side.picks.length === 1 ? ' coin' : ' coins') : '') : hidden ? '' : 'Best possible' + (side.picks.length ? '  ·  ' + side.picks.length + (side.picks.length === 1 ? ' coin' : ' coins') : '');
        });
        // the last greedy coin stays highlighted only while it is being picked; earlier ones settle
        coins.forEach(function (c) { if (c.id[1] === 'g') { var idx = +c.id.slice(2); c.state = (st.kind === 'gpick' && idx === st.greedy.picks.length - 1) ? 'active' : (st.verdict && !st.verdict.ok ? 'error' : 'done'); } else { c.state = 'done'; } });
        trayL.render(tray, dur);
        coinL.render(coins, dur);
        var txt = badge.firstChild;
        if (st.verdict) {
          txt.textContent = st.verdict.ok ? 'same count' : (st.greedy.picks.length + ' vs ' + st.best.picks.length + ' coins');
          txt.setAttribute('class', 'gr-verdict__text is-' + (st.verdict.ok ? 'ok' : 'bad'));
          V.animate(badge, { opacity: 1 }, { duration: dur });
        } else V.animate(badge, { opacity: 0 }, { duration: dur });
      },
      on: function () { return function () {}; },
      destroy: function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
    return api;
  };

  /* ================================================================== knapsack */
  gr.knap = function (container, opts) {
    opts = opts || {};
    container = V.$(container);
    var W = 720, H = 400, bagY0 = 168, bagH = 200;
    var svg = svgRoot('gr-knap', opts.label || 'Three knapsacks');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.width = '100%'; svg.style.display = 'block';
    container.appendChild(svg);
    var COLS = [{ k: 'frac', x: 10, title: 'Pour it in (fractional)' }, { k: 'g01', x: 250, title: 'Whole items only (greedy)' }, { k: 'best', x: 490, title: 'Best whole items (DP)' }];
    var colUI = {};
    COLS.forEach(function (c) {
      var g = s('g', { class: 'gr-col' });
      var title = s('text', { class: 'gr-col__title', x: c.x + 110, y: 16, 'text-anchor': 'middle' }, c.title);
      var bag = s('rect', { class: 'gr-bag', x: c.x + 40, y: bagY0, width: 140, height: bagH, rx: 10 });
      var free = s('text', { class: 'gr-col__free', x: c.x + 110, y: bagY0 - 8, 'text-anchor': 'middle' });
      var val = s('text', { class: 'gr-col__value', x: c.x + 110, y: bagY0 + bagH + 30, 'text-anchor': 'middle' });
      g.appendChild(title); g.appendChild(bag); g.appendChild(free); g.appendChild(val);
      svg.appendChild(g);
      colUI[c.k] = { g: g, free: free, val: val, x: c.x };
    });
    function bagPath(x, y, w, h, wave) {
      if (!wave) return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'z';
      var a = 3.2, seg = w / 6, d = 'M' + x + ' ' + (y + a);
      for (var i = 0; i < 6; i++) d += 'q' + (seg / 2) + ' ' + (i % 2 ? a * 2 : -a * 2) + ' ' + seg + ' 0';
      return d + 'v' + Math.max(0, h - a) + 'h' + (-w) + 'z';
    }
    var chipL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-item is-default' });
        g.appendChild(s('rect', { class: 'vz-shape', x: -19, y: -25, width: 38, height: 50, rx: 8 }));
        g.appendChild(s('text', { class: 'vz-ink vz-value gr-item__id', 'text-anchor': 'middle', y: -8 }, d.item));
        g.appendChild(s('text', { class: 'vz-ink gr-item__wv', 'text-anchor': 'middle', y: 6 }, d.w + ' kg'));
        g.appendChild(s('text', { class: 'vz-ink gr-item__wv', 'text-anchor': 'middle', y: 18 }, '$' + d.v));
        g.appendChild(s('text', { class: 'gr-item__ratio', 'text-anchor': 'middle', y: 40 }));
        return g;
      },
      update: function (g, d) { g.setAttribute('class', 'vz-item gr-item is-' + d.state + (d.focus ? ' is-focus' : '')); g.lastChild.textContent = d.ratio || ''; }
    });
    var blockL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-block is-done' });
        g.appendChild(s('path', { class: 'vz-shape' }));
        g.appendChild(s('text', { class: 'vz-ink vz-value gr-block__text', 'text-anchor': 'middle' }));
        return g;
      },
      update: function (g, d, dur, isNew) {
        g.setAttribute('class', 'vz-item gr-block is-' + d.state);
        var p = g.firstChild, t = g.lastChild;
        p.setAttribute('d', bagPath(-68, 0, 136, d.h, d.wave));
        t.setAttribute('y', d.h / 2 + 4);
        t.textContent = d.h >= 22 ? d.text : (d.h >= 13 ? d.item : '');
      }
    });
    var emptyTxt = s('text', { class: 'gr-empty', 'text-anchor': 'middle' });
    svg.appendChild(emptyTxt);

    function r2(x) { return Math.round(x * 10) / 10; }
    function ratioTxt(it) { return r2(it.v / it.w) + '/kg'; }
    var api = {
      el: svg,
      prepare: function () {}, reset: function () { chipL.clear(); blockL.clear(); },
      render: function (st, o) {
        o = o || {};
        var dur = o.duration === undefined ? 450 : o.duration;
        setDur(svg, dur);
        var byId = {}; st.items.forEach(function (it) { byId[it.id] = it; });
        var seq = st.showRatio ? st.order : st.items.map(function (i) { return i.id; });
        var chips = [], blocks = [];
        COLS.forEach(function (c) {
          var col = c.k === 'best' ? null : st[c.k];
          var hidden = c.k === 'best' && !st.best;
          var n = seq.length, gap = Math.min(44, 200 / n);
          seq.forEach(function (id, i) {
            var it = byId[id], stt = 'default';
            if (col) { var sx = col.status[id]; stt = sx === 'take' ? 'done' : sx === 'part' ? 'compare' : sx === 'skip' ? 'muted' : 'default'; if (sx === 'skip' && col.focus === id) stt = 'error'; }
            else if (st.best) stt = st.best.ids.indexOf(id) >= 0 ? 'key' : 'muted';
            chips.push({ id: 'ch' + c.k + id, item: id, w: it.w, v: it.v, x: c.x + 110 + (i - (n - 1) / 2) * gap - 0, y: 78, state: stt, focus: col && col.focus === id, ratio: st.showRatio ? ratioTxt(it) : '', opacity: hidden ? 0.0 : 1 });
          });
          // blocks
          var used = 0, y = bagY0 + bagH;
          var list = col ? col.blocks : (st.best ? st.best.ids.map(function (id) { return { id: id, w: byId[id].w, frac: 1, value: byId[id].v }; }) : []);
          list.forEach(function (b) {
            var h = b.w / st.cap * bagH;
            used += b.w; y -= h;
            blocks.push({ id: 'bl' + c.k + b.id, item: b.id, x: c.x + 110, y: y, h: h, wave: b.frac < 1, state: b.frac < 1 ? 'compare' : (c.k === 'best' ? 'key' : 'done'), from: 'ch' + c.k + b.id,
              text: b.id + ' · ' + r2(b.w) + ' kg' + (b.frac < 1 ? ' (' + Math.round(b.frac * 100) + '%)' : '') });
          });
          var ui = colUI[c.k];
          var value = col ? col.value : (st.best ? st.best.value : 0);
          var usedW = col ? col.used : (st.best ? st.best.used : 0);
          ui.g.style.opacity = hidden ? 0.35 : 1;
          ui.free.textContent = hidden ? '' : 'free ' + r2(st.cap - usedW) + ' of ' + st.cap + ' kg';
          ui.val.textContent = hidden ? '' : 'value ' + value;
          ui.val.setAttribute('class', 'gr-col__value' + (c.k === 'g01' && st.best && st.best.value > value ? ' is-bad' : ''));
        });
        chipL.render(chips, dur);
        blockL.render(blocks, dur);
        emptyTxt.textContent = '';
      },
      on: function () { return function () {}; },
      destroy: function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
    return api;
  };

  /* ================================================================== Huffman forest */
  gr.forest = function (container, opts) {
    opts = opts || {};
    container = V.$(container);
    var R = 17, DX = 46, DY = 62, PADX = 24, PADT = 26, PADB = 44, LG = 44;   // LG: left gutter for the level labels
    var svg = svgRoot('gr-forest', opts.label || 'Huffman forest');
    svg.style.display = 'block';
    container.appendChild(svg);
    var W = 300, H = 200, need = { slots: 2, depth: 1 };
    var edgeG = s('g', { class: 'gr-edges' });
    var laneG = s('g', { class: 'gr-lanes', 'aria-hidden': 'true' });
    svg.appendChild(laneG); svg.appendChild(edgeG);
    var edges = {}; // childId -> {g, line, txt, x1,y1,x2,y2, tw}
    var nodeL = layer(svg, {
      create: function (d) {
        var g = s('g', { class: 'vz-item gr-fnode is-default' });
        g.appendChild(s('circle', { class: 'vz-shape', r: R }));
        g.appendChild(s('text', { class: 'vz-ink vz-value gr-fnode__t', 'text-anchor': 'middle', dy: '.35em' }));
        g.appendChild(s('text', { class: 'gr-fnode__w', 'text-anchor': 'middle', y: R + 13 }));
        g.appendChild(s('text', { class: 'gr-fnode__code', 'text-anchor': 'middle', y: R + 28 }));
        return g;
      },
      update: function (g, d) {
        g.setAttribute('class', 'vz-item gr-fnode is-' + d.state + (d.leaf ? ' is-leaf' : ''));
        var k = g.childNodes;
        k[1].textContent = d.leaf ? d.ch : String(d.w);
        k[2].textContent = d.leaf ? '×' + d.w : '';
        k[3].textContent = d.code || '';
        k[3].setAttribute('class', 'gr-fnode__code' + (d.activeCode ? ' is-active' : ''));
      }
    });
    function setSize() {
      var natural = LG + PADX * 2 + need.slots * DX;
      W = Math.max(container.clientWidth || 300, natural);
      H = PADT + need.depth * DY + PADB;
      /* faint lanes, one per tree level: a level is a code length, so the frame is never blank */
      V.clear(laneG);
      for (var d = 0; d < need.depth; d++) {
        var ly = PADT + d * DY;
        laneG.appendChild(s('line', { class: 'gr-lane__line', x1: 6, x2: W - 6, y1: ly, y2: ly }));
        laneG.appendChild(s('text', { class: 'gr-lane__txt', x: 8, y: ly - 5 }, d === 0 ? 'top' : d + (d === 1 ? ' bit down' : ' bits down')));
      }
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    }
    function layout(st) {
      var byId = {}; st.nodes.forEach(function (n) { byId[n.id] = n; });
      var pos = {}, slot = 0, maxDepth = 0;
      function lay(id, depth) {
        var n = byId[id]; maxDepth = Math.max(maxDepth, depth);
        if (n.left === null || n.left === undefined) { pos[id] = { slot: slot++, depth: depth }; return; }
        lay(n.left, depth + 1); lay(n.right, depth + 1);
        pos[id] = { slot: (pos[n.left].slot + pos[n.right].slot) / 2, depth: depth };
      }
      st.queue.forEach(function (id) { lay(id, 0); });
      var total = need.slots;
      var offset = LG + (W - LG - (total - 1) * DX) / 2;
      var out = {};
      Object.keys(pos).forEach(function (id) { out[id] = { x: offset + pos[id].slot * DX, y: PADT + pos[id].depth * DY }; });
      return out;
    }
    var last = null;
    function edgeRec(id) {
      var e = edges[id];
      if (e) return e;
      var g = s('g', { class: 'vz-edge gr-fedge is-default' });
      var line = s('path', { class: 'vz-line' });
      var lab = s('g', { class: 'gr-fedge__lab' });
      lab.appendChild(s('circle', { r: 10 }));
      lab.appendChild(s('text', { 'text-anchor': 'middle', dy: '.35em' }));
      g.appendChild(line); g.appendChild(lab);
      edgeG.appendChild(g);
      e = edges[id] = { g: g, line: line, lab: lab, x1: null, tw: null };
      return e;
    }
    function drawEdge(e) {
      e.line.setAttribute('d', 'M' + e.x1.toFixed(1) + ' ' + (e.y1 + R).toFixed(1) + 'L' + e.x2.toFixed(1) + ' ' + (e.y2 - R).toFixed(1));
      e.lab.setAttribute('transform', 'translate(' + ((e.x1 + e.x2) / 2 + (e.side < 0 ? -9 : 9)).toFixed(1) + ' ' + ((e.y1 + e.y2) / 2).toFixed(1) + ')');
    }
    var api = {
      el: svg,
      prepare: function (steps) {
        need = { slots: 2, depth: 1 };
        steps.forEach(function (st) {
          var hf = st.hf, byId = {}; hf.nodes.forEach(function (n) { byId[n.id] = n; });
          var leaves = hf.nodes.filter(function (n) { return n.left === null; }).length;
          need.slots = Math.max(need.slots, leaves);
          (function dep(id, d) { var n = byId[id]; need.depth = Math.max(need.depth, d + 1); if (n.left !== null) { dep(n.left, d + 1); dep(n.right, d + 1); } });
          hf.queue.forEach(function (id) { (function dep(i, d) { var n = byId[i]; need.depth = Math.max(need.depth, d + 1); if (n.left !== null) { dep(n.left, d + 1); dep(n.right, d + 1); } }(id, 0)); });
        });
        setSize();
      },
      reset: function () { nodeL.clear(); Object.keys(edges).forEach(function (id) { var e = edges[id]; if (e.tw) e.tw.cancel(); if (e.g.parentNode) e.g.parentNode.removeChild(e.g); }); edges = {}; last = null; },
      render: function (st, o) {
        o = o || {};
        var dur = o.duration === undefined ? 450 : o.duration;
        setDur(svg, dur); last = st;
        var hf = st.hf, pos = layout(hf), byId = {};
        hf.nodes.forEach(function (n) { byId[n.id] = n; });
        var list = [];
        hf.nodes.forEach(function (n) {
          var p = pos[n.id]; if (!p) return;
          var leaf = n.left === null;
          var from = null;
          list.push({ id: n.id, x: p.x, y: p.y, leaf: leaf, ch: leaf ? V.algos.greedy.showCh(n.ch) : '', w: n.w, state: n.state, code: leaf && hf.codes[n.ch] ? hf.codes[n.ch] : '', activeCode: hf.activeCode === n.ch && leaf, enterDy: -20, from: from });
        });
        nodeL.render(list, dur);
        var seen = {};
        hf.nodes.forEach(function (n) {
          if (n.left === null) return;
          [['left', '0', -1], ['right', '1', 1]].forEach(function (c) {
            var cid = n[c[0]], pp = pos[n.id], cp = pos[cid];
            if (!pp || !cp) return;
            seen[cid] = true;
            var e = edgeRec(cid);
            var st2 = hf.edgeStates[cid] || 'default';
            e.g.setAttribute('class', 'vz-edge gr-fedge is-' + st2);
            e.lab.firstChild.nextSibling.textContent = c[1];
            e.lab.style.opacity = hf.bits ? 1 : 0;
            e.side = c[2];
            var nx1 = pp.x, ny1 = pp.y, nx2 = cp.x, ny2 = cp.y;
            e.g.style.opacity = 1;
            if (e.x1 === null || !dur) { e.x1 = nx1; e.y1 = ny1; e.x2 = nx2; e.y2 = ny2; if (e.tw) e.tw.cancel(); drawEdge(e); if (e.x1 === null) return; }
            else {
              if (e.tw) e.tw.cancel();
              var f = { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 };
              e.tw = V.tween(dur, function (t, k) {
                e.x1 = V.lerp(f.x1, nx1, k); e.y1 = V.lerp(f.y1, ny1, k); e.x2 = V.lerp(f.x2, nx2, k); e.y2 = V.lerp(f.y2, ny2, k); drawEdge(e);
              });
            }
          });
        });
        Object.keys(edges).forEach(function (id) { if (!seen[id]) { var e = edges[id]; if (e.tw) e.tw.cancel(); if (e.g.parentNode) e.g.parentNode.removeChild(e.g); delete edges[id]; } });
      },
      on: function () { return function () {}; },
      destroy: function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
    if (V.onResize) V.onResize(container, function () { var w = container.clientWidth; if (w && last && Math.abs(w - W) > 1 && w > LG + PADX * 2 + need.slots * DX - 1) { setSize(); api.render(last, { duration: 0 }); } });
    setSize();
    return api;
  };

  /* ================================================================== terrain */
  gr.terrain = function (container, opts) {
    opts = opts || {};
    container = V.$(container);
    var W = 640, H = 240, baseY = 222, unit = 9.6;
    var svg = svgRoot('gr-terrain', opts.label || 'Hill-climbing terrain');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.width = '100%'; svg.style.display = 'block';
    container.appendChild(svg);
    var ev = emitter();
    var heights = [], n = 0, dx = 1;
    var area = s('path', { class: 'gr-terrain__area' }), ridge = s('path', { class: 'gr-terrain__ridge' }), trail = s('path', { class: 'gr-terrain__trail' });
    var hits = s('g', { class: 'gr-terrain__hits' });
    var nb = [s('circle', { class: 'gr-terrain__nb', r: 6 }), s('circle', { class: 'gr-terrain__nb', r: 6 })];
    var hiker = s('g', { class: 'vz-item gr-hiker is-active' });
    hiker.appendChild(s('circle', { class: 'vz-shape', r: 10 })); hiker.appendChild(s('text', { class: 'vz-ink', 'text-anchor': 'middle', dy: '.35em' }, '▲'));
    var flag = s('g', { class: 'gr-flag', opacity: 0 });
    flag.appendChild(s('line', { x1: 0, y1: -22, x2: 0, y2: -52 })); flag.appendChild(s('text', { x: 6, y: -44 }));
    var goal = s('g', { class: 'gr-goal', opacity: 0 });
    goal.appendChild(s('text', { 'text-anchor': 'middle', y: -8 }, 'higher peak'));
    [area, ridge, trail, hits].concat(nb).concat([flag, goal, hiker]).forEach(function (el) { svg.appendChild(el); });
    function px(i) { return 20 + i * dx; }
    function py(h) { return baseY - h * unit; }
    function setTerrain(hs) {
      heights = hs; n = hs.length; dx = (W - 40) / (n - 1);
      var d = 'M' + px(0) + ' ' + py(hs[0]);
      for (var i = 1; i < n; i++) d += 'L' + px(i) + ' ' + py(hs[i]);
      ridge.setAttribute('d', d);
      area.setAttribute('d', d + 'L' + px(n - 1) + ' ' + baseY + 'L' + px(0) + ' ' + baseY + 'z');
      V.clear(hits);
      hs.forEach(function (h, i) {
        var c = s('circle', { class: 'gr-terrain__hit', cx: px(i), cy: py(h), r: 9, tabindex: 0, role: 'button', 'aria-label': 'Start at position ' + (i + 1) + ', height ' + h });
        c.addEventListener('click', function () { ev.emit('start', { index: i }); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ev.emit('start', { index: i }); } });
        hits.appendChild(c);
      });
      var gi = hs.indexOf(Math.max.apply(null, hs));
      V.place(goal, { x: px(gi), y: py(hs[gi]) - 24, opacity: 0 });
    }
    var terrainKey = '';
    return {
      el: svg, on: ev.on, prepare: function () {}, reset: function () { terrainKey = ''; },
      render: function (st, o) {
        o = o || {};
        var dur = o.duration === undefined ? 450 : o.duration;
        setDur(svg, dur);
        if (terrainKey !== st.heights.join(',')) { terrainKey = st.heights.join(','); setTerrain(st.heights); V.place(hiker, { x: px(st.pos), y: py(st.height) - 14, opacity: 1 }); }
        V.animate(hiker, { x: px(st.pos), y: py(st.height) - 14 }, { duration: dur });
        var d = '';
        st.path.forEach(function (p, i) { d += (i ? 'L' : 'M') + px(p) + ' ' + py(heights[p]); });
        trail.setAttribute('d', d);
        [st.left, st.right].forEach(function (p, i) {
          var c = nb[i];
          if (p === null || st.kind === 'stop') { c.style.opacity = 0; return; }
          c.style.opacity = 1; c.setAttribute('cx', px(p)); c.setAttribute('cy', py(heights[p]));
        });
        var stop = st.kind === 'stop';
        V.animate(flag, { x: px(st.pos), y: py(st.height), opacity: stop ? 1 : 0 }, { duration: dur });
        flag.lastChild.textContent = stop ? (st.summit ? 'summit!' : 'stuck here') : '';
        flag.setAttribute('class', 'gr-flag ' + (stop ? (st.summit ? 'is-ok' : 'is-bad') : ''));
        V.animate(goal, { opacity: stop && !st.summit ? 1 : 0 }, { duration: dur });
      },
      destroy: function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
  };
}());
