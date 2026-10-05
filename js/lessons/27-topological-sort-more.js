/* Lesson 27 · Topological sort & cycles — part 3: critical path, patterns, cost charts, checks and the summary card.
   Needs js/lessons/27-topological-sort.js (VDSA.L27) and js/algos/27-topological-sort.js (VDSA.algos.topo). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var T = V.algos.topo;
  var L = V.L27;

  /* ================================================================== critical path */
  var WEEKS = { CS1: 3, MATH: 4, DISC: 3, DS: 4, ALG: 5, OS: 4, DB: 2, NET: 3, ML: 6 };
  function criticalFigure(fig) {
    var g = L.COURSES, pos = L.layeredPos(g, { pad: 80 });
    var steps = T.longestPath(L.plain(g), WEEKS);
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Not computed yet' }, { state: 'active', label: 'Computing now' }, { state: 'done', label: 'Finish time known' },
      { state: 'compare', shape: 'line', label: 'Prerequisite that finishes last' }, { state: 'path', label: 'Critical path' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: 'auto', minRadius: 17, uniformLabels: true, maxHeight: 400, label: 'Course graph with durations and earliest finish times' });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), baseStepMs: 1200, label: 'Critical path controls',
      counterLabels: { done: 'Courses scheduled', best: 'Latest finish (weeks)' }, counterStates: { done: 'done', best: 'path' },
      render: function (step, ctx) {
        view.render(L.gs(g, step, {
          pos: pos,
          mapNode: function (node) {
            node.sub = 'takes ' + WEEKS[node.id];
            var ef = step.ef ? step.ef[node.id] : null;
            if (ef !== null && ef !== undefined) { node.badge = 'week ' + ef; node.badgeState = step.states[node.id] === 'path' ? 'path' : 'default'; }
          }
        }), { duration: ctx.duration });
        /* the wide "week N" chips sit centred under their vertex (the duration moves below them), clear of every arrow */
        Array.prototype.forEach.call(fig.querySelectorAll('.vz-gnode'), function (nd) {
          var b = nd.querySelector('.vz-badge'), c = nd.querySelector('circle'), sub = nd.querySelector('.vz-gsub');
          if (!c) return;
          var r = +c.getAttribute('r') || 20;
          if (b) b.setAttribute('transform', 'translate(0 ' + (r + 12) + ')');
          if (sub) sub.setAttribute('y', String(r + (b ? 31 : 11)));
        });
      }
    });
    V.codeBlock(V.$('[data-code-block="critical"]'), [
      'const finish = {};',
      'for (const v of topoOrder) {                       // predecessors come first',
      '  let start = 0;',
      '  for (const u of preds[v]) start = Math.max(start, finish[u]);',
      '  finish[v] = start + duration[v];',
      '}',
      'const total = Math.max(...Object.values(finish));   // the whole project'
    ].join('\n'), 'js');
  }

  /* ================================================================== patterns: rounds, three rules, counting paths */
  function patterns() {
    var g = L.COURSES, plain = L.plain(g);
    // 1. rounds ("semesters")
    var lv = T.kahnLevels(plain), roundOf = {};
    lv.levels.forEach(function (Ly, i) { Ly.forEach(function (id) { roundOf[id] = i + 1; }); });
    var pos = L.layeredPos(g, { pad: 80 });
    var st1 = V.$('[data-mini="rounds"]');
    var v1 = V.views.graph(st1, { directed: true, bounds: 'auto', minRadius: 17, uniformLabels: true, maxHeight: 250, label: 'Courses grouped into rounds: everyone in a round can be taken together' });
    v1.render(L.gs(g, { states: (function () { var o = {}; g.nodes.forEach(function (n) { o[n.id] = L.ccState(roundOf[n.id]); }); return o; }()) }, {
      pos: pos, mapNode: function (n) { n.sub = 'round ' + roundOf[n.id]; }
    }), { duration: 0 });
    V.$('[data-rounds-note]').innerHTML = 'Round 1 holds every course with no prerequisites. After it, the vertices whose last prerequisite was in round 1 form round 2, and so on. Here that is <b>' + lv.rounds + ' rounds</b>, the same as the longest chain of courses.';
    V.codeBlock(V.$('[data-code-block="rounds"]'), [
      'let ready = nodes.filter((v) => indeg[v] === 0), rounds = 0;',
      'while (ready.length > 0) {',
      '  rounds++;                                  // everything in `ready` can run together',
      '  const next = [];',
      '  for (const u of ready)',
      '    for (const v of out[u]) if (--indeg[v] === 0) next.push(v);',
      '  ready = next;',
      '}'
    ].join('\n'), 'js');

    // 2. three rules, three valid orders
    var box = V.$('[data-rules]');
    [['fifo', 'Oldest first (queue)'], ['lifo', 'Newest first (stack)'], ['alpha', 'Smallest name first']].forEach(function (r) {
      var end = L.last(T.kahn(plain, { pick: r[0] }));
      var row = h('div', { class: 't27-rule' }, h('p', { class: 't27-rule__label' }, r[1]), h('div', { class: 't27-strip' }));
      box.appendChild(row);
      L.strip(row.querySelector('.t27-strip'), { label: r[1] })(end.order, 0);
    });

    // 3. counting paths
    var pg = L.graph([['A', 90, 300], ['B', 330, 130], ['C', 330, 470], ['D', 590, 300], ['E', 880, 300]], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['D', 'E']]);
    var pp = L.plain(pg), order = L.last(T.kahn(pp)).order, ways = {}, adj = T.adjacency(pp);
    order.forEach(function (v) { ways[v] = adj.pred[v].length ? adj.pred[v].reduce(function (a, u) { return a + ways[u]; }, 0) : 1; });
    var st3 = V.$('[data-mini="paths"]');
    var v3 = V.views.graph(st3, { directed: true, bounds: 'auto', maxHeight: 230, label: 'Number of paths from A to each vertex' });
    v3.render(L.gs(pg, { states: { A: 'done', B: 'done', C: 'done', D: 'done', E: 'path' } }, { mapNode: function (n) { n.badge = ways[n.id]; n.badgeState = n.id === 'E' ? 'path' : 'done'; } }), { duration: 0 });
    V.$('[data-paths-note]').innerHTML = 'ways[E] = ' + ways.E + ': the number of different routes from A to E. Each vertex adds up the counts of its predecessors, which is safe only because a topological order finishes them first.';
    V.codeBlock(V.$('[data-code-block="paths"]'), [
      'const ways = { [start]: 1 };',
      'for (const v of topoOrder) {',
      '  for (const u of preds[v]) ways[v] = (ways[v] || 0) + (ways[u] || 0);',
      '}',
      '// dynamic programming on a DAG: every subproblem is solved before it is needed'
    ].join('\n'), 'js');
    V.tabs('#patterns');
  }

  /* ================================================================== cost: measured work vs V + E */
  function costFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Kahn: V + 2E steps' }, { state: 'compare', shape: 'line', label: 'DFS: V + E steps' }
    ]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Measured topological sort steps against the number of vertices' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { v: 'Vertices', e: 'Arrows', kahn: 'Kahn steps', dfs: 'DFS steps' }, states: { kahn: 'active', dfs: 'compare' } });
    var k = 3, logScale = false, cache = {}, Ns = [];
    for (var n = 10; n <= 200; n += 10) Ns.push(n);
    function measure(deg) {
      if (cache[deg]) return cache[deg];
      var rng = V.rng(270 + deg), kahn = [], dfs = [], ref = [], last = null;
      Ns.forEach(function (n) {
        var m = Math.min(n * deg, n * (n - 1) / 2);
        var g = T.randomDag(n, m, rng), a = T.kahnResult(g), b = T.dfsResult(g);
        kahn.push([n, a.steps]); dfs.push([n, b.steps]); ref.push([n, n + g.edges.length]);
        last = { v: n, e: g.edges.length, kahn: a.steps, dfs: b.steps };
      });
      return (cache[deg] = { kahn: kahn, dfs: dfs, ref: ref, last: last });
    }
    function update(dur) {
      var d = measure(k), top = d.kahn[d.kahn.length - 1][1];
      chart.render({
        x: { label: 'vertices V', min: 0, max: 200 },
        y: logScale ? { label: 'steps (log scale)', scale: 'log', min: 10, max: 10000 } : { label: 'steps', min: 0, max: Math.ceil(top / 200) * 200 },
        series: [
          { id: 'kahn', label: 'Kahn', points: d.kahn, state: 'active' },
          { id: 'dfs', label: 'DFS', points: d.dfs, state: 'compare' }
        ],
        highlight: { series: 'kahn', x: 150, label: V.vz.fmt(d.kahn[14][1]) }
      }, { duration: dur });
      stats.update({ v: d.last.v, e: d.last.e, kahn: d.last.kahn.toLocaleString('en'), dfs: d.last.dfs.toLocaleString('en') });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Arrows per vertex, E / V', min: 1, max: 8, step: 1, value: k, onInput: function (v) { k = v; update(250); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (on) { logScale = on; update(700); } });
    update(0);
  }

  function ordersChart(fig) {
    var n = 8, counts = T.ordersAsEdgesGrow(n, V.rng(2780)), pts = counts.map(function (c, i) { return [i, c]; });
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Number of valid topological orders of eight tasks as arrows are added' });
    var say = fig.querySelector('[data-say]'), logScale = true, k = 6;
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', shape: 'line', label: 'Valid orders of 8 tasks' }]);
    function update(dur) {
      var c = counts[k];
      chart.render({
        x: { label: 'arrows added', min: 0, max: counts.length - 1 },
        y: logScale ? { label: 'valid orders (log scale)', scale: 'log', min: 1, max: 100000 } : { label: 'valid orders', min: 0, max: 40320 },
        series: [{ id: 'orders', label: 'orders', points: pts, state: 'pivot' }],
        highlight: { series: 'orders', x: k, y: c, label: c.toLocaleString('en') }
      }, { duration: dur });
      say.innerHTML = 'With <b>' + k + '</b> arrow' + (k === 1 ? '' : 's') + ' among 8 tasks, <b>' + c.toLocaleString('en') + '</b> of the 40,320 line-ups are valid' + (c === 1 ? ': the order is forced, and it is unique.' : '.');
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Arrows added', min: 0, max: counts.length - 1, step: 1, value: k, onInput: function (v) { k = v; update(200); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: true, onChange: function (on) { logScale = on; update(700); } });
    update(0);
  }

  /* ================================================================== checks */
  function checks() {
    // 1. click the vertex Kahn takes next
    var fig = V.$('#fig-quiz-kahn'), g = L.COURSES;
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Ready' }, { state: 'done', label: 'Placed' }, { state: 'default', shape: 'outline', label: 'Waiting (badge = in-degree)' }]);
    var steps = T.kahn(L.plain(g)), snap = null;
    for (var i = 2; i < steps.length; i++) if (steps[i].kind === 'take' && steps[i - 1].ready.length >= 3) { snap = steps[i - 1]; break; }
    if (!snap) for (i = 2; i < steps.length; i++) if (steps[i].kind === 'take' && steps[i - 1].ready.length >= 2) { snap = steps[i - 1]; break; }
    var state = Object.assign({}, snap, { states: Object.assign({}, snap.states), pulse: null });
    Object.keys(state.states).forEach(function (id) { if (state.states[id] === 'active') state.states[id] = 'done'; });
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, minRadius: 17, uniformLabels: true, label: 'Kahn paused mid-run', maxHeight: 340 });
    view.render(L.gs(g, state, { badge: 'indeg', sub: 'pos' }), { duration: 0 });
    L.tagNodes(view, function (id) { return L.COURSE_NAMES[id] + ' (' + id + ')'; });
    var qv = V.views.queue(fig.querySelector('[data-container]'), { cellSize: 58, label: 'Ready set' });
    qv.render(L.readyState(state), { duration: 0 });
    fig.querySelector('[data-order]').innerHTML = 'Placed so far: <b>' + (state.order.join(' → ') || 'nothing') + '</b>';
    var front = state.ready[0];
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-next-kahn', id: 'click-next-kahn',
      question: 'The ready set is a queue holding <code>' + state.ready.join(' ') + '</code>, oldest first. <b>Click the course Kahn places next.</b>',
      check: function (id) {
        if (id === front) return true;
        if (state.ready.indexOf(id) !== -1) return { correct: false, message: id + ' is ready, but it joined the queue after ' + front + '. A queue is first in, first out, so ' + front + ' goes first.' };
        if (state.states[id] === 'done') return { correct: false, message: id + ' is already placed. Kahn places each vertex exactly once.' };
        return { correct: false, message: id + ' still has in-degree ' + state.indeg[id] + ': it waits for something not placed yet, so it is not in the queue.' };
      },
      right: front + ' is at the front of the queue, so it is placed next. Every order Kahn produces is valid, and this queue rule just decides which one.'
    });

    // 0. which courses can start?
    var figF = V.$('#fig-quiz-first');
    L.legend(figF.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Course' }, { state: 'default', shape: 'line', label: 'Arrow: “before”' }]);
    var viewF = V.views.graph(figF.querySelector('[data-stage]'), { directed: true, minRadius: 17, uniformLabels: true, label: 'Course prerequisites', maxHeight: 340 });
    viewF.render(L.gs(g, null), { duration: 0 });
    L.tagNodes(viewF, function (id) { return L.COURSE_NAMES[id] + ' (' + id + ')'; });
    V.clickQuiz(figF.querySelector('[data-stage]'), {
      el: '#quiz-first-courses', id: 'click-first-courses',
      question: 'Which course could you take on <b>day one</b>, with nothing finished yet? Click one of them.',
      answer: ['CS1', 'MATH'],
      right: 'Yes: CS1 and MATH have no arrow pointing into them (in-degree 0). Every other course waits for at least one of them, directly or through a chain. Both are correct starting points.',
      wrong: 'That course has an arrow pointing into it, so something must come first. Look for a course that no arrow points to.'
    });

    // 2. click the arrow that points the wrong way
    var fig2 = V.$('#fig-quiz-order'), plain = L.plain(g);
    var bad = ['CS1', 'MATH', 'DISC', 'DS', 'ALG', 'NET', 'DB', 'OS', 'ML'];
    var line = L.orderLine(fig2.querySelector('[data-stage]'), plain, { order: bad, blind: true, maxArc: 92, label: 'A proposed course order' });
    var chk = T.isTopoOrder(plain, bad), wrongKey = chk.violations[0].key;
    var legend2 = fig2.querySelector('[data-legend]');
    L.legend(legend2, [{ state: 'default', shape: 'line', label: 'Prerequisite arrow: from the course that comes first' }]);
    V.clickQuiz(fig2.querySelector('[data-stage]'), {
      el: '#quiz-order-edge', id: 'click-bad-arrow',
      question: 'This line-up looks plausible, but <b>one arrow points left</b>. Click the arrow that breaks the order.',
      check: function (id) {
        if (id === wrongKey) {
          line.setBlind(false);
          L.legend(legend2, [{ state: 'default', shape: 'line', label: 'Arrow points right' }, { state: 'error', shape: 'line', label: 'Arrow points left' }]);
          return true;
        }
        return { correct: false, message: 'That arrow goes from an earlier course to a later one, so it is respected. Look for a prerequisite that appears after the course that needs it.' };
      },
      right: wrongKey.split('-').join(' → ') + ' is the culprit: OS is taken after NET, but Networks needs OS first. Every other arrow points right.'
    });

    // 3. how many components?
    var fig3 = V.$('#fig-quiz-scc');
    var sg = L.graph([['A', 90, 130], ['B', 250, 300], ['C', 400, 100], ['D', 590, 190], ['E', 470, 400], ['F', 760, 110], ['G', 890, 300], ['H', 780, 500]],
      [['A', 'B'], ['B', 'A'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'C'], ['E', 'F'], ['F', 'G'], ['G', 'F'], ['G', 'H']]);
    var tj = T.tarjanScc(L.plain(sg)), n = tj.comps.length;
    var sview = V.views.graph(fig3.querySelector('[data-stage]'), { directed: true, label: 'A directed graph with several loops', maxHeight: 340 });
    sview.render(L.gs(sg, null), { duration: 0 });
    L.legend(fig3.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Vertex' }, { state: 'default', shape: 'line', label: 'Arrow' }]);
    var opts = [n - 1, n, n + 1, sg.nodes.length];
    V.quiz('#quiz-scc', {
      id: 'quiz-scc-count',
      question: 'How many <b>strongly connected components</b> does this graph have? (A component is a largest group where every vertex can reach every other.)',
      options: opts.map(String), answer: 1,
      explain: [
        'Too few: the loops A and B, C D E and F G are each closed off from the others, and H is on no loop.',
        'Right: {A, B}, {C, D, E}, {F, G} and {H}. A, B go round in a loop; C → D → E → C is a loop; F and G point at each other; H is reached but never returns.',
        'Too many: a loop puts its vertices in the same component, so C, D and E count once.',
        'That would mean no vertex can return to another. Here A → B → A, and C → D → E → C, are loops.'
      ]
    });

    // 4. multiple choice
    V.quiz('#quiz-why-dfs', {
      id: 'quiz-why-dfs',
      question: 'Why does <b>reverse finish order</b> from DFS give a valid topological order on a DAG?',
      options: [
        'Because DFS always visits the vertices in alphabetical order',
        'For every arrow u → v, DFS finishes v before it finishes u, so v is later in the answer',
        'Because black vertices have in-degree 0',
        'Because DFS removes the arrows as it goes, like Kahn’s algorithm'
      ],
      answer: 1,
      explain: [
        'The visiting order depends on the names you happen to use; the answer stays valid whatever they are.',
        'When DFS examines u → v, v is white (it will finish inside u, so before u) or black (already finished). It cannot be grey, or there would be a cycle. So v always finishes first and is placed after u.',
        'Colours have nothing to do with in-degree. Black just means finished.',
        'DFS never removes arrows or counts in-degrees. That is Kahn’s bookkeeping.'
      ]
    });
    V.quiz('#quiz-stuck', {
      id: 'quiz-kahn-stuck',
      question: 'Kahn’s algorithm on a 10-vertex graph places 6 vertices and then the ready set is empty. What does this tell you?',
      options: ['The graph has a cycle, and the 4 unplaced vertices are on it or depend on it', 'The graph is fine; the other 4 vertices are simply unrelated', 'The algorithm has a bug: it must always place all vertices', 'The graph has exactly 4 cycles'],
      answer: 0,
      explain: [
        'Each of the 4 has an unplaced prerequisite, so following prerequisites backwards never stops, and in a finite graph that means going round a loop.',
        'Unrelated vertices would have no prerequisites, or only placed ones, so they would have reached in-degree 0 and been placed.',
        'Getting stuck is not a bug. It is the alarm: it is exactly how Kahn’s algorithm reports a cycle.',
        'The count of leftover vertices says nothing about how many cycles there are; even one cycle can trap many vertices behind it.'
      ]
    });
    V.quiz('#quiz-which-dag', {
      id: 'quiz-which-dag',
      question: 'Which of these dependency lists have a valid topological order? Pick all that apply.',
      options: ['A>B, B>C, A>C', 'A>B, B>C, C>A', 'A>A', 'A>B, C>D (two separate chains)'],
      answer: [0, 3],
      explain: 'A>B, B>C, A>C is a DAG: the order A, B, C satisfies all three. A>B, B>C, C>A is a cycle, so each task waits for the next. A>A means a task must come before itself, a cycle of length 1. Two separate chains are fine; every arrangement that keeps A before B and C before D works (6 of them).'
    });
  }

  /* ================================================================== summary card */
  function tiny(nodes, edges, o) {
    o = o || {};
    var svg = s('svg', { viewBox: '0 0 160 80', role: 'img', 'aria-label': o.label || '' });
    var P = {};
    nodes.forEach(function (n) { P[n[0]] = n; });
    edges.forEach(function (e) {
      var a = P[e[0]], b = P[e[1]], st = e[2], col = st ? 'var(--st-' + st + ')' : 'var(--el-edge-strong)';
      var ang = Math.atan2(b[2] - a[2], b[1] - a[1]), r = 8;
      var x1 = a[1] + Math.cos(ang) * r, y1 = a[2] + Math.sin(ang) * r, x2 = b[1] - Math.cos(ang) * (r + 3), y2 = b[2] - Math.sin(ang) * (r + 3);
      svg.appendChild(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, style: 'stroke:' + col + ';stroke-width:' + (st ? 2.2 : 1.5) }));
      svg.appendChild(s('path', { d: V.vz.arrowHead(x2 + Math.cos(ang) * 3.5, y2 + Math.sin(ang) * 3.5, ang, 6, 3.4), style: 'fill:' + col }));
    });
    nodes.forEach(function (n) {
      var st = n[3] || 'default';
      var fill = st === 'default' ? 'var(--el-fill)' : st === 'visited' ? 'color-mix(in srgb, var(--st-visited) 25%, var(--el-fill))' : st === 'grey' ? 'color-mix(in srgb, var(--ink) 30%, var(--el-fill))' : st === 'black' ? 'var(--ink)' : 'var(--st-' + st + ')';
      var stroke = st === 'default' ? 'var(--el-stroke)' : st === 'grey' || st === 'black' ? 'var(--ink)' : 'var(--st-' + st + ')';
      svg.appendChild(s('circle', { cx: n[1], cy: n[2], r: 8, style: 'fill:' + fill + ';stroke:' + stroke + ';stroke-width:1.5' }));
      if (n[4] !== undefined) svg.appendChild(s('text', { x: n[1], y: n[2] - 12, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font:700 9px var(--font-mono)' }, n[4]));
    });
    return svg;
  }
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: tiny([['a', 20, 40, 'done'], ['b', 60, 20, 'done'], ['c', 60, 60, 'done'], ['d', 105, 40, 'done'], ['e', 140, 40, 'done']], [['a', 'b', 'done'], ['a', 'c', 'done'], ['b', 'd', 'done'], ['c', 'd', 'done'], ['d', 'e', 'done']], { label: 'Every arrow points right' }),
        label: 'Topological order', text: 'A line-up of a DAG where every arrow points forward. Many DAGs have many valid orders.' },
      { svg: tiny([['a', 20, 40, 'done'], ['b', 65, 20, 'active', 0], ['c', 65, 62, 'frontier', 0], ['d', 115, 40, 'default', 2]], [['a', 'b', 'muted'], ['a', 'c', 'muted'], ['b', 'd'], ['c', 'd']], { label: 'In-degree badges' }),
        label: 'Kahn: peel in-degree 0', text: 'Place a vertex with no unplaced prerequisites, remove its arrows, repeat. O(V + E).' },
      { svg: tiny([['a', 25, 40, 'grey'], ['b', 70, 40, 'grey'], ['c', 115, 20, 'black'], ['d', 115, 62, 'default']], [['a', 'b', 'visited'], ['b', 'c', 'visited'], ['b', 'd']], { label: 'White, grey and black' }),
        label: 'DFS: reverse finish order', text: 'White, grey, black. Each vertex goes to the front of the answer when it turns black.' },
      { svg: tiny([['a', 30, 40, 'error'], ['b', 80, 18, 'error'], ['c', 130, 40, 'error'], ['d', 80, 64, 'compare']], [['a', 'b', 'error'], ['b', 'c', 'error'], ['c', 'a', 'error'], ['c', 'd']], { label: 'A cycle blocks every order' }),
        label: 'A cycle means no order', text: 'Kahn gets stuck with in-degree above 0; DFS meets a grey vertex (a back edge).' },
      { svg: tiny([['a', 22, 40, 'active'], ['b', 55, 20, 'active'], ['c', 55, 60, 'active'], ['d', 105, 40, 'compare'], ['e', 140, 40, 'done']], [['a', 'b', 'active'], ['b', 'c', 'active'], ['c', 'a', 'active'], ['b', 'd'], ['d', 'e']], { label: 'Components then a DAG' }),
        label: 'SCC + condensation', text: 'Kosaraju: DFS, reverse the arrows, DFS in reverse finish order. Contract each component: a DAG.' },
      { svg: tiny([['a', 20, 40, 'path', 3], ['b', 65, 20, 'path', 7], ['c', 65, 62, 'default', 5], ['d', 115, 40, 'path', 12], ['e', 145, 40, 'path', 15]], [['a', 'b', 'path'], ['a', 'c'], ['b', 'd', 'path'], ['c', 'd'], ['d', 'e', 'path']], { label: 'Critical path' }),
        label: 'Longest path = critical path', text: 'Process in topological order: finish[v] = duration[v] + max over its predecessors.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-critical', criticalFigure);
    L.lazy('#patterns', patterns);
    L.lazy('#fig-cost', costFigure);
    L.lazy('#fig-orders-chart', ordersChart);
    L.lazy('#check', checks);
    L.lazy('#summary-card', summaryCard);
  });
}());
