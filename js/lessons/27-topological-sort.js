/* Lesson 27 · Topological sort & cycles — shared helpers and the figures from the hero to the cycle figure.
   Part 2 (Kahn lab, DFS lab, SCC lab, flowcharts, decision tree): js/lessons/27-topological-sort-labs.js
   Part 3 (critical path, patterns, cost charts, checks, summary):   js/lessons/27-topological-sort-more.js
   Step generators: js/algos/27-topological-sort.js (VDSA.algos.topo). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var T = V.algos.topo;
  var L = V.L27 = V.L27 || {};

  /* ================================================================== data */
  function graph(nodes, edges) {
    return { nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], label: n[3] }; }), edges: edges, directed: true };
  }
  L.graph = graph;
  L.last = function (a) { return a[a.length - 1]; };

  /* The running example: a small computer-science degree. The layout is deliberately tangled. */
  L.COURSES = graph(
    [['CS1', 790, 80], ['MATH', 150, 430], ['DISC', 560, 520], ['DS', 340, 150], ['ALG', 700, 330], ['OS', 110, 120], ['DB', 900, 470], ['NET', 420, 320], ['ML', 920, 210]],
    [['CS1', 'DS'], ['MATH', 'DISC'], ['DISC', 'ALG'], ['DS', 'ALG'], ['DS', 'OS'], ['DS', 'DB'], ['OS', 'NET'], ['ALG', 'ML'], ['MATH', 'ML']]);
  L.COURSE_NAMES = { CS1: 'Intro programming', MATH: 'Calculus', DISC: 'Discrete math', DS: 'Data structures', ALG: 'Algorithms', OS: 'Operating systems', DB: 'Databases', NET: 'Networks', ML: 'Machine learning' };

  L.plain = function (g) { return { nodes: g.nodes.map(function (n) { return n.id; }), edges: g.edges }; };

  /* Layered left-to-right positions for a graph (same logical box the views use). */
  L.layeredPos = function (g, o) {
    o = o || {};
    var ids = g.nodes.map(function (n) { return n.id; });
    var edges = g.edges.map(function (e) { return { from: e[0], to: e[1] }; });
    return V.views.graph.layouts.layered(ids, edges, { direction: 'LR', w: 1000, h: 600, pad: o.pad || 90, sweeps: 8 });
  };

  /* ================================================================== lazy init */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 27] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };

  /* ================================================================== graph snapshots */
  var CC = ['cc1', 'cc2', 'cc3', 'cc4', 'cc5', 'cc6'];
  L.ccState = function (k) { return CC[(k - 1) % CC.length]; };
  L.ccColor = function (k) { return ['var(--u1)', 'var(--u2)', 'var(--u3)', 'var(--u4)', 'var(--u6)', 'var(--u7)'][(k - 1) % 6]; };

  /* gs(graph, step, opts) -> graph view state for any generator step.
     opts.pos {id: {x, y}}; opts.badge 'indeg'; opts.sub 'pos' | 'times' | 'fin'; opts.mapNode / opts.mapEdge. */
  L.gs = function (g, step, o) {
    o = o || {};
    var nodes = g.nodes.map(function (n) {
      var p = o.pos && o.pos[n.id] ? o.pos[n.id] : n;
      var st = step && step.states ? (step.states[n.id] || 'default') : 'default';
      if (st === 'cc') st = L.ccState(step.comp[n.id] || 1);
      var node = { id: n.id, x: p.x, y: p.y, state: st };
      if (n.label) node.label = n.label;
      if (step && o.badge === 'indeg' && step.indeg && st !== 'active' && st !== 'done') {
        var d = step.indeg[n.id];
        node.badge = d; node.badgeState = d === 0 ? 'done' : 'default';
      }
      if (step && o.sub === 'pos' && step.order) { var i = step.order.indexOf(n.id); if (i >= 0) node.sub = '#' + (i + 1); }
      if (step && o.sub === 'times' && step.disc && step.disc[n.id] !== null && step.disc[n.id] !== undefined) {
        node.sub = step.disc[n.id] + '/' + (step.fin[n.id] === null || step.fin[n.id] === undefined ? '–' : step.fin[n.id]);
      }
      if (step && o.sub === 'fin' && step.finished) { var fi = step.finished.indexOf(n.id); if (fi >= 0) node.sub = 'f' + (fi + 1); }
      if (o.mapNode) o.mapNode(node, step);
      return node;
    });
    var inCycle = {};
    if (step && step.cycle && step.cycle.edges) step.cycle.edges.forEach(function (k) { inCycle[k] = true; });
    var edges = g.edges.map(function (e) {
      var key = T.edgeKey(e[0], e[1]);
      var edge = { id: key, from: e[0], to: e[1], directed: true, state: (step && step.edges && step.edges[key]) || 'default' };
      if (inCycle[key] && step.kind !== 'relax') edge.state = 'error';
      if (step && step.layered) edge.state = 'done';
      var pk = step && step.pulse ? (step.transposed ? T.edgeKey(step.pulse.to, step.pulse.from) : T.edgeKey(step.pulse.from, step.pulse.to)) : null;
      if (pk === key) {
        edge.state = step.kind === 'back' ? 'error' : 'compare';
        edge.pulse = true;
      }
      if (o.mapEdge) o.mapEdge(edge, step);
      return edge;
    });
    return { nodes: nodes, edges: edges };
  };

  /* Put data-id / data-label on graph view nodes so VDSA.clickQuiz can target them. */
  L.tagNodes = function (view, describe) {
    V.$$('.vz-gnode', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var id = t ? t.textContent : '';
      if (!id) return;
      g.setAttribute('data-id', id);
      g.setAttribute('data-label', describe ? describe(id) : 'Course ' + id);
    });
  };

  /* Ready set as queue / stack view states. */
  L.readyState = function (step) {
    return { items: (step.ready || []).map(function (id) { return { id: id, value: id, state: 'frontier' }; }) };
  };

  /* A keyed strip of chips with arrows between them: new chips pop in, removed ones disappear.
     strip(items, dur, {newest: id}) -- items are ids in display order. */
  L.strip = function (el, o) {
    o = o || {};
    var chips = {};
    return function (items, dur, opt) {
      opt = opt || {};
      el.style.setProperty('--t27-dur', Math.max(1, dur || 0) + 'ms');
      var want = {};
      items.forEach(function (id) { want[id] = true; });
      Object.keys(chips).forEach(function (id) { if (!want[id]) { chips[id].remove(); delete chips[id]; } });
      V.$$('.t27-strip__arrow, .t27-strip__empty', el).forEach(function (n) { n.remove(); });
      if (!items.length) el.appendChild(h('span', { class: 't27-strip__empty' }, o.empty || 'nothing yet'));
      items.forEach(function (id, i) {
        var c = chips[id];
        if (!c) c = chips[id] = h('span', { class: 't27-strip__chip' + (opt.states && opt.states[id] ? ' is-' + opt.states[id] : '') }, id);
        c.classList.toggle('is-new', opt.newest === id);
        el.appendChild(c);
        if (i < items.length - 1) el.appendChild(h('span', { class: 't27-strip__arrow', 'aria-hidden': 'true' }, '→'));
      });
      el.setAttribute('aria-label', (o.label || 'Order') + ': ' + (items.join(', ') || 'none yet'));
    };
  };

  /* ================================================================== order line: chips on a line, arcs for the arrows */
  /* orderLine(host, graph, opts) -> {render(order, {duration}) -> isTopoOrder result, select(id), el}
     Forward arrows arch over the line, backward arrows (violations) hang below it in red.
     opts: {slotW, movable, onChange(newOrder), onSelect(id), label}. Self-loops are ignored. */
  L.orderLine = function (host, g, o) {
    o = o || {};
    var G = T.adjacency(g), ids = G.ids.slice(), n = ids.length;
    var slotW = o.slotW || 72, padX = 26, chipW = slotW - 16, chipH = 36, maxArc = Math.min(120, 26 + n * 11);
    var topH = maxArc + 14, botH = Math.round(maxArc * 0.5) + 14;
    var lineY = topH + chipH / 2, W = padX * 2 + n * slotW, H = topH + chipH + botH;
    var svg = s('svg', { class: 't27-order', viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Vertices in a line with arrows between them' });
    svg.style.setProperty('--w', W + 'px');
    var arcG = s('g'), chipG = s('g');
    svg.appendChild(s('line', { class: 't27-order__axis', x1: padX / 2, x2: W - padX / 2, y1: lineY, y2: lineY }));
    svg.appendChild(arcG); svg.appendChild(chipG);
    host.appendChild(svg);

    var edges = G.edges.filter(function (e) { return e.from !== e.to; });
    var arcs = {}, chips = {};
    edges.forEach(function (e) {
      var g2 = s('g', { class: 't27-arc', 'data-id': e.key, 'data-label': 'Arrow ' + e.from + ' to ' + e.to });
      var hit = s('path', { class: 't27-arc__hit' }), line = s('path', { class: 't27-arc__line' }), head = s('path', { class: 't27-arc__head' });
      g2.appendChild(hit); g2.appendChild(line); g2.appendChild(head);
      arcG.appendChild(g2);
      arcs[e.key] = { g: g2, hit: hit, line: line, head: head, e: e, side: 'top', so: 0, eo: 0 };
    });
    ids.forEach(function (id) {
      var c = s('g', { class: 't27-chip', 'data-node': id });
      c.appendChild(s('rect', { x: -chipW / 2, y: -chipH / 2, width: chipW, height: chipH, rx: 10 }));
      c.appendChild(s('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, id));
      if (o.movable) { c.setAttribute('tabindex', '0'); c.setAttribute('role', 'button'); c.setAttribute('aria-label', id); }
      chipG.appendChild(c);
      chips[id] = { g: c, x: padX + slotW / 2, id: id };
    });

    var order = ids.slice(), cx = {}, sel = null, anim = null, dragging = null, lastCheck = null, blind = !!o.blind;
    ids.forEach(function (id, i) { cx[id] = slotX(i); });
    function slotX(i) { return padX + i * slotW + slotW / 2; }

    function pathFor(a, k) {
      var A = arcs[k], e = A.e, x1 = cx[e.from] + A.so, x2 = cx[e.to] + A.eo, top = A.side === 'top';
      var y = lineY + (top ? -chipH / 2 : chipH / 2), dx = Math.abs(x2 - x1);
      var hgt = Math.min(top ? maxArc : maxArc * 0.5, 18 + dx * 0.3);
      var ctlY = y + (top ? -2 : 2) * hgt, mx = (x1 + x2) / 2;
      var ang = Math.atan2(y - ctlY, x2 - mx);
      // end the line a little before the tip so the head sits cleanly on it
      var ex = x2 - Math.cos(ang) * 7, ey = y - Math.sin(ang) * 7;
      var d = 'M' + x1.toFixed(1) + ' ' + y + 'Q' + mx.toFixed(1) + ' ' + ctlY.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1);
      A.line.setAttribute('d', d); A.hit.setAttribute('d', d);
      A.head.setAttribute('d', V.vz.arrowHead(x2, y, ang, 10, 5.5));
    }
    function draw() {
      ids.forEach(function (id) { chips[id].g.setAttribute('transform', 'translate(' + cx[id].toFixed(1) + ' ' + lineY + ')'); });
      Object.keys(arcs).forEach(function (k) { pathFor(null, k); });
    }
    function assign(pos) {
      // decide the side of every arrow and spread arrow ends along the chip so they do not pile up
      var slots = {};
      Object.keys(arcs).forEach(function (k) {
        var A = arcs[k], e = A.e;
        A.side = blind || pos[e.to] > pos[e.from] ? 'top' : 'bot';
        [['s', e.from, e.to], ['e', e.to, e.from]].forEach(function (t) {
          var key = t[1] + ':' + A.side;
          (slots[key] = slots[key] || []).push({ k: k, end: t[0], other: pos[t[2]] });
        });
      });
      Object.keys(slots).forEach(function (key) {
        var list = slots[key].sort(function (a, b) { return a.other - b.other || (a.end < b.end ? -1 : 1); });
        var step = list.length > 1 ? Math.min(11, (chipW - 22) / (list.length - 1)) : 0;
        list.forEach(function (it, i) { arcs[it.k][it.end === 's' ? 'so' : 'eo'] = (i - (list.length - 1) / 2) * step; });
      });
    }
    function classes(check) {
      var bad = {}, badNode = {};
      check.violations.forEach(function (v) { bad[v.key] = true; badNode[v.from] = badNode[v.to] = true; });
      Object.keys(arcs).forEach(function (k) {
        arcs[k].g.classList.toggle('is-bad', !blind && !!bad[k]);
        arcs[k].g.classList.toggle('is-ok', blind || !bad[k]);
      });
      ids.forEach(function (id) {
        chips[id].g.classList.toggle('is-bad', !blind && !!badNode[id]);
        chips[id].g.classList.toggle('is-valid', !blind && check.valid);
        chips[id].g.classList.toggle('is-selected', sel === id);
      });
    }
    function render(newOrder, ro) {
      ro = ro || {};
      order = newOrder.slice();
      var pos = {};
      order.forEach(function (id, i) { pos[id] = i; });
      assign(pos);
      var check = lastCheck = T.isTopoOrder(g, order);
      classes(check);
      var from = {}, to = {};
      ids.forEach(function (id) { from[id] = cx[id]; to[id] = slotX(pos[id]); });
      if (anim) { anim.cancel(); anim = null; }
      var dur = ro.duration === undefined ? 380 : ro.duration;
      if (!dur || V.reducedMotion()) { ids.forEach(function (id) { cx[id] = to[id]; }); draw(); }
      else {
        anim = V.tween(V.dur(dur), function (t, e) {
          ids.forEach(function (id) { cx[id] = from[id] + (to[id] - from[id]) * e; });
          draw();
        });
      }
      // reading order for assistive tech
      svg.setAttribute('aria-label', (o.label || 'Vertices in a line') + ': ' + order.join(', ') + (check.valid ? '. Every arrow points right.' : '. ' + check.violations.length + ' arrow' + (check.violations.length === 1 ? '' : 's') + ' point left.'));
      return check;
    }
    function select(id) {
      sel = id;
      ids.forEach(function (x) { chips[x].g.classList.toggle('is-selected', sel === x); });
    }

    if (o.movable) {
      // pointer drag (move to a new slot) or click (select; click another to swap); arrow keys move the focused chip
      var svgPoint = function (ev) {
        var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      };
      chipG.addEventListener('pointerdown', function (ev) {
        var gEl = ev.target.closest('.t27-chip');
        if (!gEl) return;
        var id = gEl.getAttribute('data-node'), p0 = svgPoint(ev);
        dragging = { id: id, x0: p0.x, off: cx[id] - p0.x, moved: false };
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      });
      svg.addEventListener('pointermove', function (ev) {
        if (!dragging) return;
        var p = svgPoint(ev);
        if (!dragging.moved && Math.abs(p.x - dragging.x0) < 6) return;
        if (!dragging.moved) { dragging.moved = true; if (anim) { anim.cancel(); anim = null; } chips[dragging.id].g.classList.add('is-dragging'); chipG.appendChild(chips[dragging.id].g); }
        cx[dragging.id] = Math.max(padX + slotW / 2 - 10, Math.min(W - padX - slotW / 2 + 10, p.x + dragging.off));
        draw();
      });
      var endDrag = function (ev, cancel) {
        if (!dragging) return;
        var d = dragging; dragging = null;
        chips[d.id].g.classList.remove('is-dragging');
        try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        if (d.moved && !cancel) {
          var slot = Math.max(0, Math.min(n - 1, Math.round((cx[d.id] - padX - slotW / 2) / slotW)));
          var rest = order.filter(function (x) { return x !== d.id; });
          rest.splice(slot, 0, d.id);
          if (o.onChange) o.onChange(rest, 'drag'); else render(rest);
        } else if (d.moved) render(order, { duration: 200 });
        else if (o.onSelect) o.onSelect(d.id);
      };
      svg.addEventListener('pointerup', function (ev) { endDrag(ev, false); });
      svg.addEventListener('pointercancel', function (ev) { endDrag(ev, true); });
      chipG.addEventListener('keydown', function (ev) {
        var gEl = ev.target.closest('.t27-chip');
        if (!gEl) return;
        var id = gEl.getAttribute('data-node'), i = order.indexOf(id);
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (o.onSelect) o.onSelect(id); return; }
        if ((ev.key === 'ArrowLeft' && i > 0) || (ev.key === 'ArrowRight' && i < n - 1)) {
          ev.preventDefault();
          var j = ev.key === 'ArrowLeft' ? i - 1 : i + 1, next = order.slice();
          next[i] = next[j]; next[j] = id;
          if (o.onChange) o.onChange(next, 'key'); else render(next);
        }
      });
    }
    render(o.order || ids, { duration: 0 });
    function setBlind(b) { blind = !!b; render(order, { duration: 500 }); }
    return { render: render, select: select, setBlind: setBlind, el: svg, check: function () { return lastCheck; }, order: function () { return order.slice(); } };
  };

  /* ================================================================== hero teaser: a tangle becomes a line */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var view = V.views.graph(stage, { directed: true, bounds: { w: 1000, h: 600 }, nodeRadius: 30, minRadius: 18, showWeights: false, maxHeight: 460, label: 'A tangle of tasks' });
    var lap = 0;
    function build() {
      var rng = V.rng(2700 + lap++ * 7);
      var dag = T.randomDag(11, 15, rng);
      var names = 'ABCDEFGHIJK'.split(''), map = {};
      dag.nodes.forEach(function (id, i) { map[id] = names[i]; });
      var ids = names.slice(), edges = dag.edges.map(function (e) { return { from: map[e[0]], to: map[e[1]] }; });
      var order = V.shuffle(ids.slice(), rng);
      var tangle = {};
      order.forEach(function (id, i) {
        var a = -Math.PI / 2 + (2 * Math.PI * i) / order.length;
        tangle[id] = { x: 500 + 400 * Math.cos(a), y: 300 + 225 * Math.sin(a) };
      });
      var lay = V.views.graph.layouts.layered(ids, edges, { direction: 'LR', w: 1000, h: 600, pad: 70, sweeps: 8 });
      var layerOf = {};
      lay.layers.forEach(function (Ly, i) { Ly.forEach(function (id) { layerOf[id] = i; }); });
      var steps = [{ j: 0 }];
      lay.layers.forEach(function (Ly, i) { steps.push({ j: i + 1 }); });
      steps.push({ j: lay.layers.length + 1, final: true });
      steps.forEach(function (st) { st.ids = ids; st.edges = edges; st.tangle = tangle; st.lay = lay; st.layerOf = layerOf; });
      return steps;
    }
    V.teaser(stage, {
      steps: build(), stepMs: 620, holdMs: 2200, regenerate: build, instantWrap: false,
      render: function (st, ctx) {
        var nodes = st.ids.map(function (id) {
          var p = st.final ? st.lay[id] : st.tangle[id], L2 = st.layerOf[id];
          var state = st.final ? 'done' : st.j === 0 ? 'default' : L2 < st.j - 1 ? 'done' : L2 === st.j - 1 ? 'frontier' : 'default';
          return { id: id, x: p.x, y: p.y, state: state };
        });
        var es = st.edges.map(function (e) {
          var a = st.layerOf[e.from], state = st.final ? 'done' : st.j > 0 && a < st.j - 1 ? 'muted' : 'default';
          return { from: e.from, to: e.to, directed: true, state: state };
        });
        view.render({ nodes: nodes, edges: es }, { duration: ctx.duration });
      }
    });
  }

  /* ================================================================== the problem: explore prerequisites */
  function ancestors(G, id) {
    var seen = {}, stack = [id];
    while (stack.length) { var u = stack.pop(); G.pred[u].forEach(function (p) { if (!seen[p]) { seen[p] = true; stack.push(p); } }); }
    return seen;
  }
  function descendants(G, id) {
    var seen = {}, stack = [id];
    while (stack.length) { var u = stack.pop(); G.succ[u].forEach(function (p) { if (!seen[p]) { seen[p] = true; stack.push(p); } }); }
    return seen;
  }
  function problemFigure(fig) {
    var g = L.COURSES, G = T.adjacency(L.plain(g));
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Course you picked' },
      { state: 'frontier', label: 'Must come first' },
      { state: 'path', label: 'Waits for it' },
      { state: 'default', shape: 'line', label: 'Arrow: “before”' }
    ]);
    var view = V.views.graph(stage, { directed: true, minRadius: 16, label: 'Course prerequisites: an arrow from a to b means take a before b', maxHeight: 400 });
    var picked = null;
    var DEFAULT_CAP = 'Click a course to light up everything that must come before it and everything that waits for it.';
    function show(dur) {
      var anc = picked ? ancestors(G, picked) : {}, des = picked ? descendants(G, picked) : {};
      var states = {}, edges = {};
      g.nodes.forEach(function (n) { states[n.id] = n.id === picked ? 'active' : anc[n.id] ? 'frontier' : des[n.id] ? 'path' : picked ? 'muted' : 'default'; });
      g.edges.forEach(function (e) {
        var k = T.edgeKey(e[0], e[1]);
        edges[k] = !picked ? 'default' : (anc[e[0]] || e[0] === picked) && (anc[e[1]] || e[1] === picked) ? 'frontier' : (des[e[0]] || e[0] === picked) && des[e[1]] ? 'path' : 'muted';
      });
      view.render(L.gs(g, { states: states, edges: edges }), { duration: dur });
      L.tagNodes(view, function (id) { return L.COURSE_NAMES[id] + ' (' + id + ')'; });
      if (!picked) { cap.textContent = DEFAULT_CAP; return; }
      var a = Object.keys(anc).sort(T.natCmp), d = Object.keys(des).sort(T.natCmp);
      cap.innerHTML = '<b>' + picked + '</b> (' + L.COURSE_NAMES[picked] + ') ' + (a.length ? 'needs <b>' + a.join(', ') + '</b> first' : 'needs nothing: you can start here') + (d.length ? ', and it holds up <b>' + d.join(', ') + '</b>.' : ', and nothing waits for it.');
    }
    view.on('click', function (e) {
      if (e.kind !== 'node') return;
      picked = picked === e.id ? null : e.id;
      show(350);
    });
    show(0);
  }

  /* Four places the same question hides (static mini graphs). */
  function usesMinis(row) {
    function mini(cap, nodes, edges, labelFn) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      var g = { nodes: nodes.map(function (id) { return { id: id }; }), edges: edges };
      var pos = V.views.graph.layouts.layered(nodes, edges.map(function (e) { return { from: e[0], to: e[1] }; }), { direction: 'LR', w: 1000, h: 600, pad: 90 });
      g.nodes.forEach(function (n) { n.x = pos[n.id].x; n.y = pos[n.id].y; });
      var v = V.views.graph(st, { directed: true, bounds: 'auto', nodeRadius: 30, minRadius: 17, maxHeight: 200, label: labelFn });
      v.render(L.gs(Object.assign({ directed: true }, g), null), { duration: 0 });
    }
    mini('<b>Spreadsheet:</b> a cell is recalculated after the cells it reads.', ['A1', 'B1', 'C1', 'D1'], [['A1', 'B1'], ['A1', 'C1'], ['B1', 'D1'], ['C1', 'D1']], 'Spreadsheet cells: D1 reads B1 and C1, which read A1');
    mini('<b>Build system:</b> compile every file after the files it includes.', ['a.h', 'a.o', 'b.o', 'app'], [['a.h', 'a.o'], ['a.h', 'b.o'], ['a.o', 'app'], ['b.o', 'app']], 'Build: a.h before a.o and b.o, both before app');
    mini('<b>Installing packages:</b> install a library after the libraries it needs.', ['libc', 'zlib', 'png', 'app'], [['libc', 'zlib'], ['zlib', 'png'], ['png', 'app'], ['libc', 'app']], 'Packages: libc before zlib, zlib before png, png before app');
    mini('<b>Getting dressed:</b> socks before shoes, shirt before tie.', ['sock', 'pant', 'shoe', 'shirt', 'tie', 'coat'], [['sock', 'shoe'], ['pant', 'shoe'], ['shirt', 'tie'], ['tie', 'coat'], ['pant', 'coat']], 'Clothes: sock and pant before shoe, shirt before tie before coat');
  }

  /* White, grey, black: three tiny snapshots of one chain. */
  function colorMinis(row) {
    var items = [
      { st: { A: 'default', B: 'default', C: 'default' }, cap: '<b>White:</b> not seen yet. DFS has not reached this vertex.', label: 'Chain A to B to C, all white' },
      { st: { A: 'grey', B: 'active', C: 'default' }, cap: '<b>Grey:</b> entered but not finished. The grey vertices are the route DFS is on right now (blue is the current one).', label: 'A is grey, B is the current vertex, C is white' },
      { st: { A: 'grey', B: 'black', C: 'black' }, cap: '<b>Black:</b> finished for good. Everything it points to is finished too, so it is placed in the answer.', label: 'A is grey, B and C are black' }
    ];
    var g = graph([['A', 130, 300], ['B', 500, 300], ['C', 870, 300]], [['A', 'B'], ['B', 'C']]);
    items.forEach(function (it) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: it.cap })));
      V.views.graph(st, { directed: true, bounds: 'auto', nodeRadius: 26, minRadius: 16, maxHeight: 110, label: it.label }).render(L.gs(g, { states: it.st }), { duration: 0 });
    });
  }

  /* ================================================================== intuition: draw dependencies, see the verdict */
  function playFigure(fig) {
    var stage = fig.querySelector('[data-stage]'), verdict = fig.querySelector('[data-verdict]'), strip = L.strip(fig.querySelector('[data-strip]'), { label: 'A valid order', empty: 'no order' });
    var cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Task' },
      { state: 'error', label: 'On a cycle' },
      { state: 'default', shape: 'line', label: 'Arrow: “before”' }
    ]);
    var START = {
      nodes: [{ id: 'A', x: 110, y: 300 }, { id: 'B', x: 340, y: 130 }, { id: 'C', x: 340, y: 470 }, { id: 'D', x: 620, y: 300 }, { id: 'E', x: 880, y: 450 }],
      edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'B', to: 'D' }, { from: 'C', to: 'D' }, { from: 'D', to: 'E' }]
    };
    var view = V.views.graph(stage, { directed: true, editable: true, bounds: { w: 1000, h: 600 }, maxHeight: 360, label: 'Dependency editor. Click empty space to add a task, drag from one task to another to add an arrow, select and press Delete to remove.' });
    var busy = false;
    function analyse(gr) {
      var plain = { nodes: gr.nodes.map(function (n) { return String(n.id); }), edges: gr.edges.map(function (e) { return [String(e.from), String(e.to)]; }) };
      var cyc = T.findCycle(plain);
      if (cyc) {
        var on = {}; cyc.forEach(function (id) { on[id] = true; });
        var eon = {};
        cyc.forEach(function (id, i) { eon[T.edgeKey(id, cyc[(i + 1) % cyc.length])] = true; });
        verdict.className = 't27-verdict is-bad';
        verdict.innerHTML = '<b>Cycle: no order exists.</b> ' + cyc.concat([cyc[0]]).join(' → ') + ' each waits for the next.';
        strip([], 0);
        cap.textContent = 'Every task on the loop waits for another task on the loop, so none of them can ever go first.';
        return { on: on, eon: eon };
      }
      var order = T.kahn(plain).filter(function (x) { return x.layered || x.kind === 'empty'; })[0];
      var ord = order && order.order ? order.order : [];
      verdict.className = 't27-verdict is-ok';
      verdict.innerHTML = plain.nodes.length ? '<b>No cycle: this is a DAG.</b> ' + T.countOrders(plain).toLocaleString('en') + ' valid ' + (T.countOrders(plain) === 1 ? 'order exists' : 'orders exist') + '. One of them:' : '<b>Empty graph.</b> Add a task.';
      strip(ord, 250);
      cap.textContent = plain.nodes.length ? 'No cycle means at least one task has nothing in front of it, and so on, all the way down.' : 'Click empty space to add a task.';
      return null;
    }
    function refresh() {
      if (busy) return;
      var gr = view.getGraph();
      var res = analyse(gr);
      busy = true;
      try {
        view.render({
          nodes: gr.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, state: res && res.on[n.id] ? 'error' : 'default' }; }),
          edges: gr.edges.map(function (e) { return { from: e.from, to: e.to, directed: true, state: res && res.eon[T.edgeKey(e.from, e.to)] ? 'error' : 'default' }; })
        }, { duration: 220 });
      } finally { busy = false; }
    }
    view.setGraph(START, { duration: 0 });
    view.on('change', function () { refresh(); });
    refresh();
    var btns = fig.querySelector('[data-buttons]');
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: function () { view.setGraph(START, { duration: 300 }); refresh(); } }, 'Start over'));
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--soft btn--sm', onclick: function () {
      var gr = view.getGraph(), has = gr.edges.some(function (e) { return e.from === 'E' && e.to === 'A'; });
      if (!has && gr.nodes.some(function (n) { return n.id === 'A'; }) && gr.nodes.some(function (n) { return n.id === 'E'; })) {
        gr.edges.push({ from: 'E', to: 'A' });
        view.setGraph(gr, { duration: 300 }); refresh();
      }
    } }, 'Add the arrow E → A'));
  }

  /* ================================================================== in-degree, one node at a time (uses Kahn's generator) */
  L.kahnRender = function (view, g, pos, layeredPos) {
    return function (step, ctx) {
      var use = step.layered ? layeredPos : pos;
      view.render(L.gs(g, step, { badge: 'indeg', sub: 'pos', pos: use }), { duration: ctx.duration });
    };
  };
  function indegreeFigure(fig) {
    /* The two real prerequisites of ALG in L.COURSES (DISC and DS); their own prerequisites are left out to keep the picture small. */
    var g = graph([['DISC', 100, 200], ['DS', 100, 400], ['ALG', 800, 300]], [['DISC', 'ALG'], ['DS', 'ALG']]);
    var steps = T.kahn(L.plain(g)).filter(function (st) { return !st.layered; });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Waiting (badge > 0)' }, { state: 'frontier', label: 'Ready (badge 0)' },
      { state: 'active', label: 'Placed now' }, { state: 'done', label: 'Placed' }, { state: 'muted', shape: 'line', label: 'Arrow removed' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: 'auto', nodeRadius: 30, maxHeight: 300, label: 'Two courses point into Algorithms; its in-degree badge counts down as they are placed' });
    var strip = L.strip(fig.querySelector('[data-strip]'), { label: 'Order so far', empty: 'nothing placed yet' });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: 'In-degree controls',
      render: function (step, ctx) {
        L.kahnRender(view, g, null, null)(step, ctx);
        strip(step.order, ctx.duration, { newest: step.kind === 'take' ? step.current : null });
      }
    });
  }

  /* ================================================================== many valid orders */
  function ordersFigure(fig) {
    var g = L.COURSES, plain = L.plain(g), rng = V.rng(2727);
    var total = T.countOrders(plain), fact = 1;
    for (var i = 2; i <= g.nodes.length; i++) fact *= i;
    var status = fig.querySelector('[data-status]'), cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'line', label: 'Arrow points right: fine' },
      { state: 'error', shape: 'line', label: 'Arrow points left: broken' },
      { state: 'done', shape: 'outline', label: 'Valid order' }
    ]);
    var order = ['CS1', 'MATH', 'DISC', 'DS', 'ALG', 'OS', 'DB', 'NET', 'ML'], selected = null;
    var line;
    function report(check) {
      if (check.valid) {
        status.className = 't27-verdict is-ok';
        status.innerHTML = '<b>Valid.</b> Every arrow points right. This is 1 of <b>' + total.toLocaleString('en') + '</b> valid orders, out of ' + fact.toLocaleString('en') + ' ways to line up nine courses (' + (100 * total / fact).toFixed(total / fact < 0.001 ? 3 : 1) + '%).';
        cap.textContent = 'Nothing forces CS1 before MATH, so swapping them keeps the order valid. That freedom is why there are many answers.';
      } else {
        var v = check.violations;
        status.className = 't27-verdict is-bad';
        status.innerHTML = '<b>Broken.</b> ' + v.length + ' arrow' + (v.length === 1 ? ' points' : 's point') + ' left: ' + v.map(function (x) { return x.from + ' → ' + x.to; }).join(', ') + '. You would take ' + v[0].to + ' before ' + v[0].from + '.';
        cap.textContent = 'A backwards arrow is a prerequisite you have not met yet. Drag courses, or press the arrow keys on a focused one, until none hang below the line.';
      }
    }
    function apply(next, dur) { order = next; selected = null; line.select(null); report(line.render(next, { duration: dur === undefined ? 420 : dur })); }
    line = L.orderLine(fig.querySelector('[data-stage]'), plain, {
      movable: true, order: order, label: 'Course order',
      onChange: function (next) { apply(next); },
      onSelect: function (id) {
        if (selected === null) { selected = id; line.select(id); return; }
        if (selected === id) { selected = null; line.select(null); return; }
        var next = order.slice(), a = next.indexOf(selected), b = next.indexOf(id);
        next[a] = id; next[b] = selected;
        apply(next);
      }
    });
    report(line.check());
    var bar = fig.querySelector('[data-buttons]');
    function btn(label, kind, fn) { bar.appendChild(h('button', { type: 'button', class: 'btn btn--' + kind + ' btn--sm', onclick: fn }, label)); }
    btn('Shuffle at random', 'secondary', function () { apply(V.shuffle(order.slice(), rng), 700); });
    btn('Another valid order', 'primary', function () { apply(T.randomValidOrder(plain, rng), 700); });
    btn('A-to-Z', 'soft', function () { apply(order.slice().sort(T.natCmp), 600); });
    btn('Reset', 'ghost', function () { apply(['CS1', 'MATH', 'DISC', 'DS', 'ALG', 'OS', 'DB', 'NET', 'ML'], 500); });
  }

  /* ================================================================== the cycle: Kahn gets stuck */
  function cycleFigure(fig) {
    var base = L.COURSES;
    var VARIANTS = {
      ok: { label: 'As planned', g: base },
      loop: { label: 'Add ML → DS', g: graph(base.nodes.map(function (n) { return [n.id, n.x, n.y]; }), base.edges.concat([['ML', 'DS']])) },
      self: { label: 'Add OS → OS', g: graph(base.nodes.map(function (n) { return [n.id, n.x, n.y]; }), base.edges.concat([['OS', 'OS']])) }
    };
    var mode = 'loop';
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Waiting' }, { state: 'frontier', label: 'Ready' }, { state: 'done', label: 'Placed' },
      { state: 'compare', label: 'Stuck behind the cycle' }, { state: 'error', label: 'Stuck / on the cycle' }, { state: 'muted', shape: 'line', label: 'Arrow removed' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, allowSelfLoops: true, minRadius: 16, maxHeight: 400, label: 'Kahn on the course graph with an extra arrow' });
    var strip = L.strip(fig.querySelector('[data-strip]'), { label: 'Order so far', empty: 'nothing placed yet' });
    var steps, pos;
    function gen() {
      var v = VARIANTS[mode];
      steps = T.kahn(L.plain(v.g));
      pos = null;
    }
    gen();
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), baseStepMs: 900, label: 'Cycle figure controls',
      counterLabels: { emitted: 'Placed', removed: 'Arrows removed', ready: 'Ready set' }, counterStates: { emitted: 'done', ready: 'frontier' },
      render: function (step, ctx) {
        var g = VARIANTS[mode].g;
        view.render(L.gs(g, step, { badge: 'indeg', sub: 'pos', pos: step.layered ? L.layeredPos(g) : null }), { duration: ctx.duration });
        strip(step.order, ctx.duration, { newest: step.kind === 'take' ? step.current : null });
      }
    });
    // jump to just before the stuck moment so the first thing you press is meaningful
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Extra prerequisite', value: mode,
      options: Object.keys(VARIANTS).map(function (k) { return { value: k, label: VARIANTS[k].label }; }),
      onChange: function (v) { mode = v; gen(); player.setSteps(steps); }
    });
  }

  V.ready(function () {
    // register lazily built checks now so the page score total does not jump when they appear
    ['click-first-courses', 'lab-kahn-next', 'lab-dfs-edge', 'lab-scc-pop', 'click-next-kahn', 'click-bad-arrow', 'quiz-scc-count', 'quiz-why-dfs', 'quiz-kahn-stuck', 'quiz-which-dag']
      .forEach(function (id) { if (V.quizScore && V.quizScore.register) V.quizScore.register(id); });
    heroTeaser();
    L.lazy('#fig-problem', problemFigure);
    L.lazy('#mini-uses', usesMinis);
    L.lazy('#mini-colors', colorMinis);
    L.lazy('#fig-dagplay', playFigure);
    L.lazy('#fig-indegree', indegreeFigure);
    L.lazy('#fig-orders', ordersFigure);
    L.lazy('#fig-cycle', cycleFigure);
  });
}());
