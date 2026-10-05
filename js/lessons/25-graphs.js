/* Lesson 25 · Graphs & representations — shared helpers and the figures from the hero to the vocabulary explorer.
   Part 2 (graph builder, operations lab): js/lessons/25-graphs-builder.js
   Part 3 (memory chart, decision diagram, grid, gallery, colouring, checks, summary): js/lessons/25-graphs-more.js
   Step generators: js/algos/25-graphs.js (VDSA.algos.graphs). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var G = V.algos.graphs;
  var L = V.L25 = V.L25 || {};

  /* Layout stability: reserve the tallest height a panel reaches over every step of the current run, so playing never shifts the page.
     paint(step) must draw the panel with no animation; the player draws its own current step again straight after setSteps. */
  L.reserve = function (player, host, paint, first) {
    var set = player.setSteps;
    function measure(steps) {
      var top = 0;
      host.style.minHeight = '';
      steps.forEach(function (st) { paint(st); top = Math.max(top, host.offsetHeight); });
      if (top) host.style.minHeight = top + 'px';
      if (steps.length) paint(steps[0]);
    }
    player.setSteps = function (steps, o) { measure(steps); return set.call(player, steps, o); };
    if (first) measure(first);
    return measure;
  };
  L.reserveVars = function (player, vars, first) {
    return L.reserve(player, vars.el, function (st) { vars.update(st.vars || {}, st.varStates); }, first);
  };

  /* ================================================================== helpers shared by all three files */
  /* Build a figure when it comes within ~one screen of the viewport (or before printing). */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 25] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* VDSA.legend with working `color` overrides (custom properties are dropped by VDSA.h style objects). */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };

  /* data-id / data-label on graph view nodes so VDSA.clickQuiz can target them. */
  L.tagNodes = function (view, describe) {
    V.$$('.vz-gnode', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var id = t ? t.textContent : '';
      if (!id) return;
      g.setAttribute('data-id', id);
      g.setAttribute('data-label', describe ? describe(id) : 'Vertex ' + id);
    });
  };

  L.nodeIdAt = function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('.vz-gnode') : null;
    if (!el) return null;
    var t = el.querySelector('.vz-value');
    return t ? t.textContent : null;
  };

  L.list = function (a) { return a.join(', '); };
  L.pairKey = function (a, b) { return G.natCmp(a, b) <= 0 ? a + '-' + b : b + '-' + a; };

  /* ================================================================== lesson graphs */
  /* The vocabulary graph: two connected components; nine edges. Orientation below is used when "directed" is on. */
  L.EX_NODES = [['A', 110, 300], ['B', 290, 150], ['C', 290, 450], ['D', 520, 110], ['E', 545, 400], ['F', 750, 290], ['G', 925, 180], ['H', 700, 530], ['I', 905, 500]];
  L.EX_EDGES = [['A', 'B'], ['A', 'C'], ['C', 'B'], ['B', 'D'], ['D', 'E'], ['E', 'C'], ['E', 'F'], ['F', 'G'], ['H', 'I']];
  L.exGraph = function (directed) {
    return { nodes: L.EX_NODES.map(function (n) { return n[0]; }), edges: L.EX_EDGES, directed: !!directed };
  };

  /* ================================================================== hero teaser: a gently floating network */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var base = [[130, 250], [300, 120], [310, 400], [500, 250], [520, 70], [560, 460], [720, 150], [740, 360], [890, 250], [140, 500], [880, 480]];
    var ids = 'ABCDEFGHIJK'.split('');
    var edges = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 6], [3, 7], [2, 5], [5, 7], [6, 8], [7, 8], [4, 6], [2, 9], [5, 10], [8, 10]];
    var extra = [[9, 0], [10, 7], [4, 3], [6, 7]];
    var F = 16, rng = V.rng(9);
    var phase = base.map(function () { return rng() * Math.PI * 2; });
    var view = V.views.graph(stage, { bounds: { x: 60, y: 20, w: 900, h: 520 }, maxHeight: 360, nodeRadius: 26, minRadius: 13, label: 'A network of eleven dots, floating gently, with messages travelling along its lines' });
    function frame(f) {
      var t = f / F * Math.PI * 2;
      var pulse = f % edges.length;
      var pe = edges[(f * 5) % edges.length], from = pe[f % 2], to = pe[1 - f % 2];
      var nodes = base.map(function (p, i) {
        var st = i === from ? 'active' : i === to ? 'frontier' : 'default';
        return { id: ids[i], x: p[0] + Math.sin(t + phase[i]) * 26, y: p[1] + Math.cos(t * 1 + phase[i] * 1.3) * 22, state: st };
      });
      var list = edges.map(function (e) {
        var on = e === pe;
        return { id: ids[e[0]] + '-' + ids[e[1]], from: ids[on ? from : e[0]], to: ids[on ? to : e[1]], state: on ? 'active' : 'default', pulse: on };
      });
      extra.forEach(function (e, k) {
        if ((f + k * 4) % 16 < 9) list.push({ id: ids[e[0]] + '-' + ids[e[1]], from: ids[e[0]], to: ids[e[1]], state: 'visited' });
      });
      void pulse;
      return { nodes: nodes, edges: list };
    }
    var steps = [];
    for (var f = 0; f < F; f++) steps.push(frame(f));
    V.teaser(stage, { steps: steps, render: function (step, ctx) { view.render(step, { duration: ctx.duration }); }, stepMs: 620, holdMs: 400, instantWrap: false });
  }

  /* ================================================================== the problem: Königsberg morphs into a graph */
  function konigFigure(fig) {
    var W = 760, H = 430, R = 27;
    var K = G.KONIGSBERG, deg = G.konigsbergDegrees();
    var letter = { I: 'A', N: 'B', E: 'C', S: 'D' };
    var land = {
      N: { c: [380, 62], rx: 330, ry: 48, g: [385, 62], name: 'North bank', at: [380, 40] },
      I: { c: [250, 215], rx: 100, ry: 62, g: [175, 215], name: 'Kneiphof island', at: [250, 238] },
      E: { c: [560, 215], rx: 88, ry: 60, g: [590, 215], name: 'East island', at: [560, 238] },
      S: { c: [380, 368], rx: 330, ry: 48, g: [385, 368], name: 'South bank', at: [380, 392] }
    };
    var bridges = [
      { a: 'N', b: 'I', p0: [215, 104], p1: [215, 157], bend: 40 },
      { a: 'N', b: 'I', p0: [290, 108], p1: [290, 158], bend: -40 },
      { a: 'S', b: 'I', p0: [215, 273], p1: [215, 326], bend: -40 },
      { a: 'S', b: 'I', p0: [290, 272], p1: [290, 322], bend: 40 },
      { a: 'N', b: 'E', p0: [560, 102], p1: [560, 155], bend: 0 },
      { a: 'S', b: 'E', p0: [560, 275], p1: [560, 328], bend: 0 },
      { a: 'I', b: 'E', p0: [350, 215], p1: [472, 215], bend: 0 }
    ];
    var stage = fig.querySelector('[data-stage]');
    var svg = s('svg', { class: 'g25-konig', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Map of Königsberg with four land masses and seven bridges that turns into a graph with four vertices and seven edges.' });
    var river = s('rect', { class: 'g25-river', x: 0, y: 0, width: W, height: H, rx: 16 });
    svg.appendChild(river);
    var waves = s('g', { class: 'g25-waves' });
    [[70, 150], [430, 300], [640, 320], [70, 300], [670, 130]].forEach(function (p) { waves.appendChild(s('path', { d: 'M' + p[0] + ' ' + p[1] + ' q10 -8 20 0 t20 0 t20 0' })); });
    svg.appendChild(waves);
    var bEls = bridges.map(function (br) { var p = s('path', { class: 'g25-bridge', d: '' }); svg.appendChild(p); return p; });
    var lEls = {}, tEls = {}, nEls = {}, dEls = {};
    Object.keys(land).forEach(function (k) {
      var e = s('ellipse', { class: 'g25-land', cx: land[k].c[0], cy: land[k].c[1], rx: land[k].rx, ry: land[k].ry });
      svg.appendChild(e); lEls[k] = e;
    });
    Object.keys(land).forEach(function (k) {
      var t = s('text', { class: 'g25-landname', x: land[k].at[0], y: land[k].at[1], 'text-anchor': 'middle' }, land[k].name);
      var n = s('text', { class: 'g25-nodename', x: land[k].g[0], y: land[k].g[1], 'text-anchor': 'middle', 'dominant-baseline': 'central' }, letter[k]);
      var d = s('g', { class: 'g25-degbadge' }, s('circle', { r: 13 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, deg[k]));
      svg.appendChild(t); svg.appendChild(n); svg.appendChild(d);
      tEls[k] = t; nEls[k] = n; dEls[k] = d;
    });
    stage.appendChild(svg);

    function lerp(a, b, t) { return a + (b - a) * t; }
    var m = 0, tw = null;
    function draw(mm) {
      m = mm;
      var e = mm;
      Object.keys(land).forEach(function (k) {
        var L0 = land[k];
        var cx = lerp(L0.c[0], L0.g[0], e), cy = lerp(L0.c[1], L0.g[1], e);
        lEls[k].setAttribute('cx', cx); lEls[k].setAttribute('cy', cy);
        lEls[k].setAttribute('rx', lerp(L0.rx, R, e)); lEls[k].setAttribute('ry', lerp(L0.ry, R, e));
        tEls[k].style.opacity = String(Math.max(0, 1 - e * 2.6));
        nEls[k].style.opacity = String(Math.max(0, e * 2.2 - 1.2));
        nEls[k].setAttribute('x', cx); nEls[k].setAttribute('y', cy);
        dEls[k].setAttribute('transform', 'translate(' + (cx + R * 0.85) + ' ' + (cy - R * 0.9) + ')');
      });
      bridges.forEach(function (br, i) {
        var A = land[br.a].g, B = land[br.b].g;
        var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
        var gc = [mx - dy / len * br.bend, my + dx / len * br.bend];
        var mc = [(br.p0[0] + br.p1[0]) / 2, (br.p0[1] + br.p1[1]) / 2];
        var p0 = [lerp(br.p0[0], A[0], e), lerp(br.p0[1], A[1], e)], p1 = [lerp(br.p1[0], B[0], e), lerp(br.p1[1], B[1], e)];
        var c = [lerp(mc[0], gc[0], e), lerp(mc[1], gc[1], e)];
        bEls[i].setAttribute('d', 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' Q' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ' ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1));
        bEls[i].style.strokeWidth = lerp(11, 3.4, e).toFixed(2);
      });
      river.style.opacity = String(1 - e);
      waves.style.opacity = String(Math.max(0, 1 - e * 1.8));
    }
    draw(0);

    var steps = [
      { m: 0, deg: false, odd: false, caption: 'Königsberg in 1735: a river, two islands, four separate pieces of land and <b>seven bridges</b>. Can you walk a route that crosses every bridge exactly once? Citizens tried for years and always failed.' },
      { m: 1, deg: false, odd: false, caption: 'Leonhard Euler threw away everything that does not matter: shapes, sizes, distances. Each piece of land becomes a <b>vertex</b> (a dot). Each bridge becomes an <b>edge</b> (a line). Two pieces of land linked by two bridges get two parallel lines.' },
      { m: 1, deg: true, odd: false, oddBadge: true, caption: 'Count the edges touching each vertex: its <b>degree</b>. The island A has five bridges, and B, C and D have three each. Notice that all four numbers are odd.' },
      { m: 1, deg: true, odd: true, caption: 'A walk that crosses every bridge once passes <em>through</em> most vertices: it enters on one bridge and leaves on another, using bridges in pairs. So only the start and the finish can have an odd degree. Königsberg has <b>four</b> odd vertices, so no such walk exists.' }
    ];

    function target(step, dur) {
      if (tw) { tw.cancel(); tw = null; }
      var from = m, to = step.m;
      if (!dur || from === to) draw(to);
      else tw = V.tween(dur, function (t, ez) { draw(from + (to - from) * ez); }, { ease: 'inOut' });
      Object.keys(land).forEach(function (k) {
        lEls[k].classList.toggle('is-node', step.m > 0.5);
        lEls[k].classList.toggle('is-odd', step.odd && deg[k] % 2 === 1);
        dEls[k].classList.toggle('is-shown', step.deg);
        dEls[k].classList.toggle('is-odd', (step.odd || step.oddBadge) && deg[k] % 2 === 1);
      });
    }
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 2600, label: 'Königsberg bridges controls',
      render: function (step, ctx) { target(step, ctx.duration ? Math.max(ctx.duration, 1400) : 0); }
    });
    player.addCheckpoint(2, function () {
      return {
        question: 'Count the bridges that touch the island <b>A</b> (Kneiphof) in the drawing. What will its degree be?',
        options: ['3', '5', '7'], answer: 1,
        explain: ['Three is the number for each bank and for the east island, but the Kneiphof island has more bridges.',
          'Two bridges to the north bank, two to the south bank and one to the east island: five in all.',
          'There are only seven bridges in the whole city, and they cannot all touch one island.']
      };
    }, { id: 'konig-degree' });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Land mass / vertex' },
      { state: 'default', shape: 'line', color: 'color-mix(in srgb, var(--st-path) 55%, var(--ink-3))', label: 'Bridge / edge' },
      { state: 'compare', label: 'Odd degree' }
    ]);
  }

  /* ================================================================== one structure, three costumes */
  function costumesFigure(fig) {
    var pos = [[140, 300], [330, 130], [330, 470], [560, 130], [560, 470], [800, 300]];
    var costumes = {
      road: { directed: false, weighted: true, labels: ['Ayr', 'Bath', 'Cork', 'Deal', 'Ely', 'York'],
        edges: [[0, 1, 120], [0, 2, 90], [1, 3, 60], [2, 4, 75], [3, 5, 140], [4, 5, 110], [3, 4, 50]],
        chips: ['Vertex = a town', 'Edge = a road', 'Weight = kilometres'],
        text: 'A road map is an <b>undirected, weighted</b> graph: you can drive either way, and every road has a length.' },
      social: { directed: false, weighted: false, labels: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'],
        edges: [[0, 1], [0, 2], [1, 2], [1, 3], [3, 4], [4, 5], [2, 4]],
        chips: ['Vertex = a person', 'Edge = a friendship'],
        text: 'A friendship network is <b>undirected and unweighted</b>: if Ana knows Ben then Ben knows Ana, and a friendship is simply there or not.' },
      course: { directed: true, weighted: false, labels: ['CS1', 'Math', 'CS2', 'Logic', 'Algo', 'AI'],
        edges: [[0, 2], [1, 2], [2, 4], [3, 4], [4, 5], [1, 3]],
        chips: ['Vertex = a course', 'Edge = “must come before”'],
        text: 'Course prerequisites form a <b>directed</b> graph: an arrow says which course must come first, and it never points backwards.' }
    };
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { bounds: { x: 70, y: 70, w: 790, h: 460 }, maxHeight: 460, nodeRadius: 32, minRadius: 15, label: 'One graph drawn as a road map, a friendship network and a set of course prerequisites' });
    var meaning = fig.querySelector('[data-meaning]'), blurb = fig.querySelector('[data-blurb]');
    function show(key, dur) {
      var c = costumes[key];
      var nodes = c.labels.map(function (lb, i) { return { id: 'n' + i, label: lb, x: pos[i][0], y: pos[i][1] }; });
      var edges = c.edges.map(function (e) {
        var o = { id: 'n' + e[0] + '-n' + e[1], from: 'n' + e[0], to: 'n' + e[1], directed: c.directed };
        if (c.weighted) o.weight = e[2];
        return o;
      });
      view.render({ nodes: nodes, edges: edges }, { duration: dur });
      V.clear(meaning);
      c.chips.forEach(function (t) { meaning.appendChild(h('span', { class: 'chip chip--sm' }, t)); });
      blurb.innerHTML = c.text;
    }
    show('road', 0);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Costume', value: 'road',
      options: [{ value: 'road', label: 'Road map' }, { value: 'social', label: 'Social network' }, { value: 'course', label: 'Prerequisites' }],
      onChange: function (v) { show(v, 700); }
    });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Vertex' }, { state: 'default', shape: 'line', label: 'Edge' }]);
  }

  /* Four kinds of edge, as small static graphs. */
  function kindsMinis(row) {
    var nodes = [{ id: 'A', x: 120, y: 300 }, { id: 'B', x: 500, y: 110 }, { id: 'C', x: 880, y: 300 }, { id: 'D', x: 500, y: 490 }];
    function mini(cap, edges, directed, label) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      V.views.graph(st, { bounds: { x: 40, y: 40, w: 920, h: 520 }, maxHeight: 190, nodeRadius: 34, minRadius: 14, label: label, directed: directed })
        .render({ nodes: nodes, edges: edges }, { duration: 0 });
    }
    var plain = [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'A' }, { from: 'B', to: 'D' }];
    mini('<b>Undirected:</b> a line goes both ways.', plain, false, 'Undirected graph with four vertices');
    mini('<b>Directed:</b> an arrow goes one way.', [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'A' }, { from: 'B', to: 'D' }], true, 'Directed graph with four vertices');
    mini('<b>Weighted:</b> each edge carries a number.', [{ from: 'A', to: 'B', weight: 4 }, { from: 'B', to: 'C', weight: 2 }, { from: 'C', to: 'D', weight: 7 }, { from: 'D', to: 'A', weight: 3 }, { from: 'B', to: 'D', weight: 5 }], false, 'Weighted graph with four vertices');
    mini('<b>Both:</b> one-way roads with lengths.', [{ from: 'A', to: 'B', weight: 4 }, { from: 'B', to: 'C', weight: 2 }, { from: 'C', to: 'D', weight: 7 }, { from: 'D', to: 'A', weight: 3 }, { from: 'B', to: 'D', weight: 5 }], true, 'Directed weighted graph with four vertices');
  }

  /* ================================================================== the vocabulary explorer */
  function explorer(fig) {
    var stage = fig.querySelector('[data-stage]');
    var panel = fig.querySelector('[data-panel]');
    var directed = false, mode = 'degree', showDeg = true;
    var sel = null, pathSel = [], cycleIdx = 0;
    var view = V.views.graph(stage, { bounds: { x: 40, y: 50, w: 940, h: 540 }, maxHeight: 420, nodeRadius: 28, label: 'Vocabulary graph with nine vertices. Select vertices to see their degree, a path between two of them, or a cycle.' });
    var rep = null, cycles = [], comps = [], degs = null;
    var nextBtn = h('button', { type: 'button', class: 'btn btn--soft btn--sm g25-panel__btn' }, 'Show the next cycle');
    function rebuild() {
      rep = G.build(L.exGraph(directed));
      cycles = G.simpleCycles(rep);
      comps = G.components(rep);
      degs = G.degrees(rep);
      if (cycleIdx >= cycles.length) cycleIdx = 0;
    }
    rebuild();

    function readout(title, big, detail) {
      V.clear(panel);
      panel.appendChild(h('p', { class: 'g25-panel__title' }, title));
      panel.appendChild(h('p', { class: 'g25-panel__big', html: big }));
      panel.appendChild(h('p', { class: 'g25-panel__text', html: detail }));
      if (mode === 'cycles' && cycles.length > 1) panel.appendChild(nextBtn);
    }
    function handshakeLine() {
      if (directed) return 'Every edge leaves one vertex and enters another: <b>Σ in-degree = Σ out-degree = ' + rep.E + '</b> edges.';
      return 'Handshake lemma: <b>Σ degrees = ' + degs.sum + ' = 2 × ' + rep.E + '</b> edges. Each edge adds one to two vertices.';
    }
    function nb(id) { return rep.adj[id].map(function (e) { return e.to; }); }
    function inNb(id) { return rep.edgeList.filter(function (e) { return e.to === id; }).map(function (e) { return e.from; }); }
    function compOf(id) { return comps.filter(function (c) { return c.indexOf(id) >= 0; })[0]; }

    function draw(dur) {
      var ns = {}, es = {}, badges = {};
      rep.ids.forEach(function (id) { ns[id] = 'default'; });
      rep.edgeList.forEach(function (e) { es[L.pairKey(e.from, e.to)] = 'default'; });
      if (mode === 'degree') {
        if (showDeg) rep.ids.forEach(function (id) { badges[id] = directed ? degs.inDeg[id] + '/' + degs.outDeg[id] : degs.deg[id]; });
        if (sel) {
          ns[sel] = 'active';
          rep.edgeList.forEach(function (e) {
            var k = L.pairKey(e.from, e.to);
            if (e.from === sel) { es[k] = 'active'; ns[e.to] = 'frontier'; }
            else if (e.to === sel) { es[k] = directed ? 'compare' : 'active'; ns[e.from] = directed ? 'visited' : 'frontier'; }
          });
          var d = degs.deg[sel];
          if (directed) {
            var ins = inNb(sel), outs = nb(sel);
            readout('Vertex ' + sel, 'in ' + ins.length + ' · out ' + outs.length,
              'Arrows into <b>' + sel + '</b> come from ' + (ins.length ? ins.join(', ') : 'nowhere') + '. Arrows out of it go to ' + (outs.length ? outs.join(', ') : 'nowhere') + '. Its total degree is ' + d + '. ' + handshakeLine());
          } else {
            readout('Vertex ' + sel, 'degree ' + d,
              'Its <b>neighbours</b> are ' + (nb(sel).length ? nb(sel).join(', ') : 'none (it is isolated)') + '. The degree counts the edges touching it, which is the number of neighbours here. ' + handshakeLine());
          }
        } else {
          readout('Degree', 'Pick a vertex', 'Hover or click a vertex. Its <b>degree</b> is the number of edges that touch it' + (directed ? '; on a directed graph you count arrows in and arrows out separately' : '') + '. ' + handshakeLine());
        }
      } else if (mode === 'path') {
        var a = pathSel[0], bb = pathSel[1];
        if (a) ns[a] = 'active';
        if (a && bb) {
          var p = G.shortestPath(rep, a, bb);
          if (p) {
            p.forEach(function (id) { if (id !== a && id !== bb) ns[id] = 'path'; });
            ns[bb] = 'active';
            for (var i = 0; i + 1 < p.length; i++) es[L.pairKey(p[i], p[i + 1])] = 'path';
            readout('Path ' + a + ' to ' + bb, (p.length - 1) + (p.length === 2 ? ' edge' : ' edges'),
              'A <b>path</b> moves along edges without repeating a vertex: <b>' + p.join(' → ') + '</b>. This is a fewest-edge one; ' + (directed ? 'you may only follow arrows forwards.' : 'there may be longer paths too.'));
          } else {
            ns[bb] = 'error';
            var same = compOf(a) && compOf(a).indexOf(bb) >= 0;
            readout('Path ' + a + ' to ' + bb, 'no path',
              directed && same ? 'Both vertices are in the same piece, but the arrows only allow travel one way: ' + bb + ' cannot be reached from ' + a + '. Try the two vertices the other way round.'
                : a + ' and ' + bb + ' sit in different <b>connected components</b>: no chain of edges links them.');
          }
        } else if (a) readout('Path from ' + a, 'pick a second vertex', 'Click another vertex to find a path from <b>' + a + '</b> to it.');
        else readout('Path', 'pick two vertices', 'Click one vertex, then another. If a chain of edges links them, it lights up. Some pairs have no path at all.');
      } else if (mode === 'cycles') {
        if (!cycles.length) readout('Cycles', 'none', 'No cycle in this graph.');
        else {
          var cy = cycles[cycleIdx];
          cy.forEach(function (id) { ns[id] = 'path'; });
          for (var j = 0; j < cy.length; j++) es[L.pairKey(cy[j], cy[(j + 1) % cy.length])] = 'path';
          readout('Cycle ' + (cycleIdx + 1) + ' of ' + cycles.length, 'length ' + cy.length,
            'A <b>cycle</b> is a path that ends where it started: <b>' + cy.concat([cy[0]]).join(' → ') + '</b>. ' + (directed ? 'Following the arrows, you walk in a circle forever.' : 'Press the button to see the next one. The tail F–G and the pair H–I are on no cycle.'));
        }
      } else {
        comps.forEach(function (c, ci) { c.forEach(function (id) { ns[id] = ci % 2 ? 'path' : 'active'; }); });
        rep.edgeList.forEach(function (e) { var ci = comps.findIndex(function (c) { return c.indexOf(e.from) >= 0; }); es[L.pairKey(e.from, e.to)] = ci % 2 ? 'path' : 'active'; });
        readout('Components', comps.length + ' pieces',
          'A <b>connected component</b> is a maximal piece where every vertex can reach every other' + (directed ? ' (ignoring arrow directions)' : '') + ': ' +
          comps.map(function (c) { return '{' + c.join(', ') + '}'; }).join(' and ') + '.');
      }
      var nodes = L.EX_NODES.map(function (n) {
        var o = { id: n[0], x: n[1], y: n[2], state: ns[n[0]] };
        if (badges[n[0]] !== undefined) o.badge = badges[n[0]];
        return o;
      });
      var edges = rep.edgeList.map(function (e) {
        return { id: L.pairKey(e.from, e.to), from: e.from, to: e.to, directed: directed, state: es[L.pairKey(e.from, e.to)] };
      });
      view.render({ nodes: nodes, edges: edges }, { duration: dur === undefined ? 350 : dur });
      L.tagNodes(view, function (id) { return 'Vertex ' + id + (mode === 'degree' && degs ? ', degree ' + degs.deg[id] : ''); });
    }
    draw(0);

    function onPick(id) {
      if (mode === 'degree') sel = id;
      else if (mode === 'path') { if (pathSel.length >= 2) pathSel = [id]; else if (pathSel[0] === id) return; else pathSel.push(id); }
      draw();
    }
    view.on('click', function (e) { if (e.kind === 'node') onPick(String(e.id)); });
    stage.addEventListener('mouseover', function (ev) {
      if (mode !== 'degree') return;
      var id = L.nodeIdAt(ev);
      if (id && id !== sel) { sel = id; draw(200); }
    });

    var modeSeg = V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Explore', value: 'degree',
      options: [{ value: 'degree', label: 'Degree' }, { value: 'path', label: 'Paths' }, { value: 'cycles', label: 'Cycles' }, { value: 'parts', label: 'Components' }],
      onChange: function (v) { mode = v; sel = null; pathSel = []; draw(); }
    });
    void modeSeg;
    V.toggle(fig.querySelector('[data-directed]'), { label: 'Directed', checked: false, onChange: function (c) { directed = c; rebuild(); sel = null; pathSel = []; draw(500); } });
    V.toggle(fig.querySelector('[data-showdeg]'), { label: 'Show all degrees', checked: true, onChange: function (c) { showDeg = c; draw(200); } });
    nextBtn.addEventListener('click', function () { cycleIdx = (cycleIdx + 1) % Math.max(1, cycles.length); draw(); });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Selected' }, { state: 'frontier', label: 'Neighbour' }, { state: 'path', label: 'Path / cycle' }, { state: 'compare', shape: 'line', label: 'Arrow into vertex' }, { state: 'error', label: 'Unreachable' }
    ]);
  }

  /* ================================================================== boot */
  V.ready(function () {
    heroTeaser();
    konigFigure(V.$('#fig-konig'));
    L.lazy('#fig-costumes', costumesFigure);
    L.lazy('#mini-kinds', kindsMinis);
    L.lazy('#fig-explorer', explorer);
  });

  V.lessons = V.lessons || {};
  V.lessons.graphs = { G: G };
}());
