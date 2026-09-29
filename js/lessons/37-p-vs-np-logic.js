/* Lesson 37 · P, NP & hard problems — part 3: reductions, the 3-SAT playground, Cook-Levin, the web of hardness and
   the vertex cover 2-approximation lab.
   Needs js/lessons/37-p-vs-np.js (VDSA.L37) and js/algos/37-p-vs-np.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L = V.L37, A = L.A;

  function toSet(list) { var o = {}; list.forEach(function (x) { o[x] = true; }); return o; }

  /* ================================================================== 1. one graph, three problems */
  var G = {
    nodes: [['A', 500, 60], ['B', 860, 190], ['C', 860, 410], ['D', 500, 540], ['E', 140, 410], ['F', 140, 190]],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A'], ['A', 'C'], ['C', 'E']]
  };
  var GRAPH = { nodes: G.nodes.map(function (n) { return { id: n[0] }; }), edges: G.edges };
  var COMP = A.complementGraph(GRAPH);
  L.REDUCE_GRAPH = GRAPH;

  function roleState(role) { return role === 'is' ? 'done' : role === 'vc' ? 'pivot' : role === 'clique' ? 'key' : 'default'; }
  function reduceState(step) {
    var sel = toSet(step.sel), edges = step.view === 'G' ? G.edges : COMP.edges, ns = roleState(step.role);
    return {
      nodes: G.nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], state: sel[n[0]] ? ns : 'default' }; }),
      edges: edges.map(function (e) {
        var st = 'default';
        if (step.view === 'G' && step.role === 'vc') st = 'visited';
        else if (step.view === 'Gc' && step.kind === 'flip') st = 'frontier';
        else if (step.view === 'Gc' && sel[e[0]] && sel[e[1]] && step.role === 'clique') st = 'key';
        return { from: e[0], to: e[1], state: st };
      })
    };
  }
  function reduceFigure(fig) {
    var view = V.views.graph(L.q(fig, '[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 380, nodeRadius: 26, label: 'One graph shown as an independent set, a vertex cover and a clique' });
    V.legend(L.q(fig, '[data-legend]'), [
      { state: 'done', label: 'Independent set' }, { state: 'pivot', label: 'Vertex cover' }, { state: 'key', label: 'Clique (in the complement)' }, { state: 'frontier', shape: 'line', label: 'Flipped edges' }
    ]);
    var steps = A.reductionSteps(GRAPH).steps;
    V.player({
      root: fig, steps: steps, render: function (st, ctx) { view.render(reduceState(st), { duration: ctx.duration }); },
      caption: L.q(fig, '[data-caption]'), counters: L.q(fig, '[data-counters]'), counterLabels: { size: 'Size of the highlighted set' },
      baseStepMs: 2300, animMs: 900, label: 'Reduction story controls'
    });
  }

  /* ================================================================== 2. playground: build a set S */
  function playFigure(fig) {
    var view = V.views.graph(L.q(fig, '[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 380, nodeRadius: 26, label: 'Click vertices to build a set S' });
    var sel = {}, mode = 'G', checks = L.q(fig, '[data-checks]');
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'active', label: 'In S' }, { state: 'default', shape: 'outline', label: 'Not in S' }, { state: 'error', shape: 'line', label: 'Edge that breaks the property' }]);
    function chosen() { return G.nodes.map(function (n) { return n[0]; }).filter(function (id) { return sel[id]; }); }
    function draw(dur) {
      var S = chosen(), edges = mode === 'G' ? G.edges : COMP.edges;
      var bad = null;
      var sset = toSet(S);
      if (mode === 'G') bad = G.edges.filter(function (e) { return sset[e[0]] && sset[e[1]]; });
      view.render({
        nodes: G.nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], state: sel[n[0]] ? 'active' : 'default' }; }),
        edges: edges.map(function (e) {
          var st = 'default';
          if (mode === 'G' && sset[e[0]] && sset[e[1]]) st = 'error';
          else if (mode === 'Gc' && sset[e[0]] && sset[e[1]]) st = 'active';
          return { from: e[0], to: e[1], state: st };
        })
      }, { duration: dur === undefined ? 350 : dur });
      var rest = G.nodes.map(function (n) { return n[0]; }).filter(function (id) { return !sset[id]; });
      var okIS = A.isIndependent(GRAPH, S), okVC = A.isVertexCover(GRAPH, rest), okCl = A.isClique(COMP, S);
      var witness = G.edges.filter(function (e) { return sset[e[0]] && sset[e[1]]; })[0];
      var miss = A.missingEdge(COMP, S);
      V.clear(checks);
      function row(ok, title, why) {
        return h('div', { class: 'rchk ' + (ok ? 'is-yes' : 'is-no') }, h('span', { class: 'rchk__mark', 'aria-hidden': 'true' }, ok ? '✓' : '✗'),
          h('div', null, h('b', null, title), h('span', { class: 'rchk__why' }, ok ? 'yes' : 'no: ' + why)));
      }
      checks.appendChild(h('div', { class: 'rchk-head' }, 'S = {' + S.join(', ') + '}   ·   V∖S = {' + rest.join(', ') + '}'));
      checks.appendChild(row(okIS, 'S is an independent set of G', witness ? witness[0] + '–' + witness[1] + ' is an edge inside S' : ''));
      checks.appendChild(row(okVC, 'V∖S is a vertex cover of G', witness ? 'edge ' + witness[0] + '–' + witness[1] + ' has no endpoint outside S' : ''));
      checks.appendChild(row(okCl, 'S is a clique in the complement Ḡ', miss ? miss[0] + '–' + miss[1] + ' is not an edge of Ḡ (it is an edge of G)' : ''));
      checks.appendChild(h('p', { class: 'rchk-sum' }, okIS === okVC && okVC === okCl ? 'All three agree, always: they are one question.' : 'The three disagree (this never happens: check the edge cases!)'));
    }
    view.on('click', function (e) {
      if (e.kind !== 'node') return;
      if (sel[e.id]) delete sel[e.id]; else sel[e.id] = true;
      draw();
    });
    V.segmented(L.q(fig, '[data-seg-view]'), {
      label: 'Show', value: mode,
      options: [{ value: 'G', label: 'Graph G' }, { value: 'Gc', label: 'Complement graph Ḡ' }],
      onChange: function (v) { mode = v; draw(800); }
    });
    var acts = L.q(fig, '[data-actions]');
    [
      { label: 'Clear S', fn: function () { sel = {}; } },
      { label: 'Best independent set', fn: function () { sel = toSet(A.maxIndependentSet(GRAPH)); } },
      { label: 'Try a bad set', fn: function () { sel = toSet(['A', 'B', 'D']); } }
    ].forEach(function (a) { acts.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { a.fn(); draw(); } }, a.label)); });
    sel = toSet(['B', 'D']);
    draw(0);
  }

  /* ================================================================== 3. 3-SAT playground */
  function satFigure(fig) {
    var stage = L.q(fig, '[data-stage]'), countersEl = L.q(fig, '[data-counters]');
    var formula = A.FORMULAS.sat.clauses, n = A.FORMULAS.sat.n, mode = 'hand', hand = [], visited = {}, solved = {}, seed = 4;
    var varsEl = h('div', { class: 'sat-vars', role: 'group', 'aria-label': 'Variables' });
    var clausesEl = h('div', { class: 'sat-clauses' });
    var verdict = h('div', { class: 'sat-verdict', 'aria-live': 'polite' });
    V.clear(stage); stage.appendChild(varsEl); stage.appendChild(clausesEl); stage.appendChild(verdict);
    var stats = V.stats(countersEl, { labels: { tried: 'Assignments tried', total: 'All possible (2ⁿ)', solutions: 'Solutions found' }, states: { solutions: 'done' } });
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'done', label: 'Clause satisfied' }, { state: 'error', shape: 'outline', label: 'Clause false' }, { state: 'key', label: 'Literal that is true' }]);
    var ctl = L.q(fig, '[data-controls]'), capEl = L.q(fig, '[data-caption]');
    var varBtns = [];

    function buildVars() {
      V.clear(varsEl); varBtns = [];
      for (var i = 0; i < n; i++) (function (i) {
        var b = h('button', { type: 'button', class: 'sat-var', role: 'switch', 'aria-checked': 'false', 'aria-label': 'x' + (i + 1),
          onclick: function () { if (mode !== 'hand') return; hand[i] = !hand[i]; visit(); drawHand(); } });
        varsEl.appendChild(b); varBtns.push(b);
      }(i));
    }
    function litNode(l, assign) {
      var val = A.evalClause([l], assign);
      return h('span', { class: 'sat-lit' + (val ? ' is-true' : ''), title: (l < 0 ? 'NOT x' : 'x') + Math.abs(l) + ' is ' + (val ? 'true' : 'false') }, (l < 0 ? '¬' : '') + 'x' + Math.abs(l));
    }
    function draw(assign, sat, step) {
      varBtns.forEach(function (b, i) {
        var on = !!assign[i];
        b.textContent = 'x' + (i + 1) + ' = ' + (on ? '1' : '0');
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.classList.toggle('is-on', on);
        b.disabled = mode !== 'hand';
      });
      V.clear(clausesEl);
      var ok = 0;
      formula.forEach(function (c, ci) {
        var isSat = sat[ci]; if (isSat) ok++;
        var card = h('div', { class: 'sat-clause ' + (isSat ? 'is-sat' : 'is-unsat') });
        c.forEach(function (l, k) { if (k) card.appendChild(h('span', { class: 'sat-or', 'aria-hidden': 'true' }, '∨')); card.appendChild(litNode(l, assign)); });
        card.appendChild(h('span', { class: 'sat-mark', 'aria-label': isSat ? 'satisfied' : 'false' }, isSat ? '✓' : '✗'));
        clausesEl.appendChild(card);
      });
      var all = ok === formula.length;
      verdict.className = 'sat-verdict ' + (all ? 'is-sat' : '');
      verdict.innerHTML = all ? '<b>All ' + formula.length + ' clauses are satisfied.</b> This assignment is a solution, and you verified it in one pass over the clauses.'
        : '<b>' + ok + ' of ' + formula.length + ' clauses satisfied.</b> ' + (step && step.kind === 'unsat' ? 'No assignment works.' : 'Keep flipping variables.');
    }
    function visit() {
      var key = A.bits(hand);
      visited[key] = true;
      if (A.evalFormula(formula, hand)) solved[key] = true;
    }
    function drawHand() {
      draw(hand, A.satisfiedClauses(formula, hand));
      stats.update({ tried: Object.keys(visited).length, total: 1 << n, solutions: Object.keys(solved).length });
      capEl.innerHTML = 'By hand: click the switches. Each new assignment you visit is counted. There are ' + (1 << n) + ' in all' + (A.countSolutions(formula, n) ? ', and ' + A.countSolutions(formula, n) + ' of them satisfy every clause.' : ', and none of them satisfies every clause.');
    }
    var steps = A.satSteps(formula, n);
    var player = V.player({
      root: fig, steps: steps, render: function (st) {
        if (mode !== 'brute') return;
        draw(st.assign, st.sat, st);
        stats.update({ tried: st.tried, total: 1 << n, solutions: st.counters.solutions });
      }, caption: capEl, baseStepMs: 520, animMs: 200, speed: 1, label: 'Brute-force search controls'
    });
    function setMode(m) {
      mode = m;
      ctl.hidden = m === 'hand';
      if (m === 'hand') { player.pause(); drawHand(); }
      else { player.goto(0); }
    }
    function load(f, nn) {
      formula = f; n = nn; hand = new Array(n).fill(false); visited = {}; solved = {};
      buildVars(); visit();
      player.setSteps(A.satSteps(formula, n));
      if (mode === 'hand') drawHand(); else player.goto(0);
    }
    var seg = V.segmented(L.q(fig, '[data-seg-mode]'), {
      label: 'Mode', value: mode, options: [{ value: 'hand', label: 'Play by hand' }, { value: 'brute', label: 'Watch brute force search' }],
      onChange: setMode
    });
    var input = null;
    var formulaSeg = V.segmented(L.q(fig, '[data-seg-formula]'), {
      label: 'Formula', value: 'sat',
      options: [{ value: 'sat', label: 'Satisfiable' }, { value: 'unsat', label: 'Unsatisfiable' }, { value: 'tight', label: 'Exactly one solution' }, { value: 'random', label: 'Random 3-SAT' }],
      onChange: function (v) {
        var f;
        if (v === 'random') f = { clauses: A.randomFormula(5, 13, ++seed), n: 5 }; else f = A.FORMULAS[v];
        input.set(f.clauses.map(function (c) { return c.join(' '); }).join(', '), false);
        load(f.clauses, f.n);
      }
    });
    input = V.inputRow(L.q(fig, '[data-input]'), {
      label: 'Your formula: clauses separated by commas, negative = NOT (up to 6 variables, 12 clauses)',
      value: A.FORMULAS.sat.clauses.map(function (c) { return c.join(' '); }).join(', '),
      parse: function (text) { var r = A.parseFormula(text); return r.error ? { error: r.error } : { values: r }; },
      applyLabel: 'Use formula',
      onApply: function (r) { load(r.formula, r.n); }
    });
    hand = new Array(n).fill(false); buildVars(); visit();
    ctl.hidden = true;
    drawHand();
    void seg; void formulaSeg;
  }

  /* ================================================================== 4. Cook-Levin: a table of legal windows */
  function tableauView(stage) {
    var CW = 66, CH = 60, X0 = 74, Y0 = 26, COLS = 6, ROWS = 5;
    var svg = s('svg', { class: 'tab', viewBox: '0 0 ' + (X0 + COLS * CW + 20) + ' ' + (Y0 + ROWS * CH + 66), role: 'img', 'aria-label': 'Table of a small computation, one row per moment in time' });
    var gCells = s('g'), gWin = s('g'), gHud = s('g');
    var win = s('rect', { class: 'tab-win', rx: 8, width: 0, height: 0, x: 0, y: 0 });
    var tgt = s('rect', { class: 'tab-tgt', rx: 8, width: CW - 6, height: CH - 6, x: 0, y: 0 });
    var arrow = s('path', { class: 'tab-arrow', d: '' });
    gWin.appendChild(win); gWin.appendChild(tgt); gWin.appendChild(arrow);
    svg.appendChild(gCells); svg.appendChild(gWin); svg.appendChild(gHud);
    V.clear(stage); stage.appendChild(svg);
    var cells = [], base = A.tableau(), rowsRef = null;
    function name(v) { return v === '_' ? '␣' : v[0] === 'h' ? (v[1] === '_' ? '␣' : v[1]) : v; }
    function build(rows) {
      V.clear(gCells); cells = [];
      for (var r = 0; r < ROWS; r++) {
        gCells.appendChild(s('text', { x: X0 - 14, y: Y0 + r * CH + CH / 2 + 5, class: 'tab-rowlab', 'text-anchor': 'end' }, 'time ' + r));
        cells.push([]);
        for (var c = 0; c < COLS; c++) {
          var v = rows[r][c], head = v[0] === 'h', edited = v !== base[r][c];
          var g = s('g', { class: 'tab-cell' + (head ? ' is-head' : '') + (edited ? ' is-edited' : '') },
            s('rect', { x: X0 + c * CW + 3, y: Y0 + r * CH + 3, width: CW - 6, height: CH - 6, rx: 8 }),
            s('text', { x: X0 + c * CW + CW / 2, y: Y0 + r * CH + CH / 2 + 10, 'text-anchor': 'middle' }, name(v)));
          if (head) g.appendChild(s('text', { x: X0 + c * CW + CW / 2, y: Y0 + r * CH + 15, class: 'tab-headlab', 'text-anchor': 'middle' }, 'head'));
          if (edited) g.appendChild(s('text', { x: X0 + c * CW + CW / 2, y: Y0 + r * CH + CH - 9, class: 'tab-editlab', 'text-anchor': 'middle' }, 'edited'));
          gCells.appendChild(g); cells[r].push(g);
        }
      }
      rowsRef = rows;
    }
    function render(step, ctx) {
      var dur = (ctx && ctx.duration) || 0;
      if (rowsRef !== step.rows) build(step.rows);
      var w = step.win;
      V.clear(gHud);
      var msg = s('text', { x: X0, y: Y0 + ROWS * CH + 34, class: 'tab-hud' },
        s('tspan', { class: 'tab-hud-k' }, 'windows checked '), s('tspan', { class: 'tab-hud-v' }, String(step.checked)),
        s('tspan', { class: 'tab-hud-k', dx: 22 }, 'illegal '), s('tspan', { class: 'tab-hud-v' + (step.bad ? ' is-bad' : '') }, String(step.bad)));
      gHud.appendChild(msg);
      if (!w) {
        win.setAttribute('width', 0); win.setAttribute('height', 0); tgt.setAttribute('class', 'tab-tgt'); tgt.style.opacity = 0; win.style.opacity = 0; arrow.setAttribute('d', '');
        return;
      }
      var c0 = Math.max(0, w.c - 1), c1 = Math.min(COLS - 1, w.c + 1);
      var tx = X0 + c0 * CW + 1, ty = Y0 + w.r * CH + 1, tw = (c1 - c0 + 1) * CW - 2, th = CH - 2;
      win.style.opacity = 1; tgt.style.opacity = 1;
      var cls = w.legal ? 'is-legal' : 'is-illegal';
      win.setAttribute('class', 'tab-win ' + cls); tgt.setAttribute('class', 'tab-tgt ' + cls);
      V.animate(win, { attr: { x: tx, y: ty, width: tw, height: th } }, { duration: dur, ease: 'out' });
      V.animate(tgt, { attr: { x: X0 + w.c * CW + 3, y: Y0 + (w.r + 1) * CH + 3 } }, { duration: dur, ease: 'out' });
      var ax = X0 + w.c * CW + CW / 2, ay0 = Y0 + w.r * CH + CH - 2, ay1 = Y0 + (w.r + 1) * CH + 4;
      arrow.setAttribute('d', 'M' + ax + ' ' + ay0 + ' V' + ay1 + ' m-5 -7 l5 7 l5 -7');
      arrow.setAttribute('class', 'tab-arrow ' + cls);
    }
    return { render: render };
  }
  function cookFigure(fig) {
    var view = tableauView(L.q(fig, '[data-stage]'));
    var corrupt = false;
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'compare', shape: 'outline', label: 'Window of three cells' }, { state: 'done', label: 'Legal: clause true' }, { state: 'error', label: 'Illegal: clause false' }, { state: 'key', label: 'Machine head' }]);
    function gen() { return A.tableauSteps(corrupt ? { r: 2, c: 3, value: '0' } : null); }
    var player = V.player({
      root: fig, steps: gen(), render: function (st, ctx) { view.render(st, ctx); },
      caption: L.q(fig, '[data-caption]'), baseStepMs: 900, animMs: 500, label: 'Cook-Levin table controls'
    });
    V.segmented(L.q(fig, '[data-seg-corrupt]'), {
      label: 'The table', value: 'ok', options: [{ value: 'ok', label: 'A valid computation' }, { value: 'bad', label: 'One cell corrupted' }],
      onChange: function (v) { corrupt = v === 'bad'; player.setSteps(gen()); }
    });
  }

  /* ================================================================== 5. web of hardness */
  var NODE_LABEL = { NP: 'NP', SAT: 'SAT', '3SAT': '3SAT', IS: 'IS', CLQ: 'CLQ', VC: 'VC', HAM: 'HAM', TSP: 'TSP', COL: '3COL', SUB: 'SUB' };
  function webFigure(fig) {
    var W = A.WEB, stage = L.q(fig, '[data-stage]'), cap = L.q(fig, '[data-caption]');
    var view = V.views.graph(stage, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 440, nodeRadius: 30, label: 'Web of reductions between NP-complete problems. Click a problem.' });
    V.legend(L.q(fig, '[data-legend]'), [
      { state: 'active', label: 'The problem you clicked' }, { state: 'done', label: 'Reduces to it through the drawn arrows' },
      { state: 'frontier', label: 'Falls too, via Cook–Levin' }, { state: 'path', shape: 'line', label: 'Reduction chain' }
    ]);
    var key = h('p', { class: 'web-key' });
    [['NP', 'any problem in NP'], ['IS', 'independent set'], ['CLQ', 'clique'], ['VC', 'vertex cover'], ['HAM', 'Hamiltonian cycle'], ['3COL', '3-colouring'], ['SUB', 'subset sum'], ['TSP', 'travelling salesperson (decision)']].forEach(function (kv, i) {
      if (i) key.appendChild(document.createTextNode(' · '));
      key.appendChild(h('b', null, kv[0])); key.appendChild(document.createTextNode(' ' + kv[1]));
    });
    cap.parentNode.insertBefore(key, cap);
    var timers = [];
    function stateFor(clicked, level, phase) {
      var anc = A.ancestors(clicked), depth = {};
      var frontier = [clicked]; depth[clicked] = 0;
      while (frontier.length) {
        var nxt = [];
        frontier.forEach(function (x) { W.edges.forEach(function (e) { if (e[1] === x && depth[e[0]] === undefined) { depth[e[0]] = depth[x] + 1; nxt.push(e[0]); } }); });
        frontier = nxt;
      }
      var maxD = Math.max.apply(null, anc.map(function (a) { return depth[a]; }).concat([0]));
      return {
        nodes: W.nodes.map(function (n) {
          var st = 'default';
          if (clicked) {
            if (n.id === clicked) st = 'active';
            else if (anc.indexOf(n.id) >= 0) st = depth[n.id] <= level ? 'done' : 'default';
            else if (phase >= 2 && clicked !== 'NP') st = 'frontier';
          }
          return { id: n.id, x: n.x, y: n.y, label: NODE_LABEL[n.id], state: st };
        }),
        edges: W.edges.map(function (e) {
          var onChain = clicked && (e[1] === clicked || anc.indexOf(e[1]) >= 0) && anc.indexOf(e[0]) >= 0 && depth[e[1]] !== undefined && depth[e[1]] <= level;
          return { from: e[0], to: e[1], state: onChain ? 'path' : 'default', pulse: !!onChain && depth[e[1]] === level };
        })
      };
    }
    view.render(stateFor(null, 0, 0), { duration: 0 });
    cap.innerHTML = 'Click a problem. Arrows point from the problem being reduced <em>to</em> the problem it reduces to.';
    view.on('click', function (e) {
      if (e.kind !== 'node') return;
      timers.forEach(clearTimeout); timers = [];
      var id = e.id, anc = A.ancestors(id), maxD = 0;
      var depth = {}; (function () { var fr = [id]; depth[id] = 0; while (fr.length) { var nx = []; fr.forEach(function (x) { W.edges.forEach(function (ed) { if (ed[1] === x && depth[ed[0]] === undefined) { depth[ed[0]] = depth[x] + 1; nx.push(ed[0]); maxD = Math.max(maxD, depth[ed[0]]); } }); }); fr = nx; } }());
      var nm = NODE_LABEL[id], full = W.nodes.filter(function (n) { return n.id === id; })[0].label;
      if (id === 'NP') {
        view.render(stateFor(id, 0, 0), { duration: 300 });
        cap.innerHTML = '“Any problem in NP” is a whole class, not one problem. Making one NP problem fast helps only that problem. To drag the others down with it, a problem has to be <b>NP-hard</b>: every problem in NP must reduce to it.';
        return;
      }
      var reduced = V.reducedMotion();
      var step = 380;
      for (var lv = 0; lv <= maxD; lv++) (function (lv) {
        var run = function () { view.render(stateFor(id, lv, 1), { duration: reduced ? 0 : 320 }); };
        if (lv === 0 || reduced) run(); else timers.push(setTimeout(run, lv * step));
      }(lv));
      var last = function () {
        view.render(stateFor(id, maxD, 2), { duration: reduced ? 0 : 400 });
        cap.innerHTML = 'Suppose <b>' + full + '</b> had a polynomial-time algorithm. ' + (anc.length ? 'Follow the arrows backwards: ' + anc.map(function (a) { return NODE_LABEL[a]; }).join(', ') + ' each reduce to it (directly or through others), so they fall. ' : 'Nothing in the drawn web reduces to it directly. ') +
          'Every other problem here falls as well, because <b>' + nm + ' is NP-hard</b>: by Cook–Levin, everything in NP reduces to SAT, and SAT reduces to ' + nm + ' (through the reductions of the web). <b>All of NP would be in P.</b>';
      };
      if (reduced || maxD === 0) last(); else timers.push(setTimeout(last, (maxD + 1) * step));
      cap.innerHTML = 'Solving <b>' + full + '</b> fast… follow the reductions.';
    });
  }

  /* ================================================================== 6. vertex cover 2-approximation lab */
  var VC_CODE = {
    pseudo: [
      'function vertexCover2Approx(G)',
      '  cover ← ∅                                  // @init',
      '  for each edge (u, v) of G',
      '    if u ∉ cover and v ∉ cover then          // @pick',
      '      cover ← cover ∪ {u, v}                 // @take',
      '    otherwise the edge is already covered    // @skip',
      '  return cover                               // @ret'
    ].join('\n'),
    js: [
      'function vertexCover2Approx(edges) {',
      '  const cover = new Set();                       // @init',
      '  for (const [u, v] of edges) {',
      '    if (!cover.has(u) && !cover.has(v)) {        // @pick',
      '      cover.add(u); cover.add(v);                // @take',
      '    }                                            // @skip',
      '  }',
      '  return cover;                                  // @ret',
      '}'
    ].join('\n'),
    py: [
      'def vertex_cover_2approx(edges):',
      '    cover = set()                                # @init',
      '    for u, v in edges:',
      '        if u not in cover and v not in cover:    # @pick',
      '            cover |= {u, v}                      # @take',
      '        # otherwise the edge is already covered  # @skip',
      '    return cover                                 # @ret'
    ].join('\n')
  };
  var VC_PRESETS = [
    { label: 'Star (worst case)', value: 'C-A, C-B, C-D, C-E, C-F' },
    { label: 'Path of five', value: 'A-B, B-C, C-D, D-E' },
    { label: 'Six-cycle', value: 'A-B, B-C, C-D, D-E, E-F, F-A' },
    { label: 'Two triangles + bridge', value: 'A-B, B-C, C-A, D-E, E-F, F-D, C-D' },
    { label: 'Perfect matching', value: 'A-B, C-D, E-F, G-H' },
    { label: 'Complete bipartite K3,3', value: 'A-D, A-E, A-F, B-D, B-E, B-F, C-D, C-E, C-F' }
  ];
  function vcState(g, st) {
    var cover = toSet(st.cover), act = st.active ? toSet(st.active) : {}, optSet = st.optimum ? toSet(st.optimum) : {};
    return {
      nodes: g.nodes.map(function (n) {
        var state = 'default';
        if (cover[n.id]) state = 'pivot'; else if (act[n.id]) state = 'compare';
        var node = { id: n.id, x: n.x, y: n.y, state: state };
        if (optSet[n.id]) { node.badge = 'opt'; node.badgeState = 'done'; }
        return node;
      }),
      edges: g.edges.map(function (e) {
        var k = A.edgeKey(e[0], e[1]), es = st.edgeState[k], state = 'default';
        if (es === 'matched') state = 'path';
        else if (es === 'covered') state = 'visited';
        if (st.activeEdge === k && st.kind === 'pick') state = 'compare';
        return { from: e[0], to: e[1], id: k, state: state };
      })
    };
  }
  function vcFigure(fig) {
    var view = V.views.graph(L.q(fig, '[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 420, nodeRadius: 26, label: 'Graph being covered' });
    var code = V.codePanel(L.q(fig, '[data-code]'), { languages: VC_CODE, default: 'pseudo', maxHeight: 260 });
    var vars = V.varsPanel(L.q(fig, '[data-vars]'), { title: 'Variables', states: { cover: 'pivot' } });
    V.legend(L.q(fig, '[data-legend]'), [
      { state: 'pivot', label: 'In our cover' }, { state: 'compare', label: 'Edge being examined' }, { state: 'path', shape: 'line', label: 'Matching edge' },
      { state: 'visited', shape: 'line', label: 'Covered edge' }, { state: 'done', shape: 'ring', label: 'opt: in an optimal cover' }
    ]);
    var g = A.parseEdges(VC_PRESETS[0].value).graph;
    function gen() {
      return A.vcApprox(g).steps.map(function (st) {
        var v = {};
        Object.keys(st.vars).forEach(function (k) { v[k] = typeof st.vars[k] === 'string' ? V.vars.raw(st.vars[k]) : st.vars[k]; });
        return Object.assign({}, st, { vars: v });
      });
    }
    var player = V.player({
      root: fig, steps: gen(), render: function (st, ctx) { view.render(vcState(g, st), { duration: ctx.duration }); },
      code: code, vars: vars, caption: L.q(fig, '[data-caption]'), counters: L.q(fig, '[data-counters]'),
      counterLabels: { cover: 'Our cover', matching: 'Matching edges', optimal: 'Optimal cover' }, counterStates: { cover: 'pivot', optimal: 'done' },
      baseStepMs: 1500, animMs: 700, label: 'Vertex cover approximation controls'
    });
    player.addCheckpoint(function (steps) {
      for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'take') return k;
      return -1;
    }, function (c) {
      var e = c.step.active;
      if (!e) return null;
      return {
        question: 'The algorithm has picked the uncovered edge <b>' + e[0] + '–' + e[1] + '</b>. What does it add to the cover?',
        options: ['Both ' + e[0] + ' and ' + e[1], 'Only ' + e[0], 'Only whichever endpoint touches more edges'],
        answer: 0,
        explain: [
          'Right. Any cover must contain at least one endpoint, but the algorithm does not try to guess which. Taking both costs at most twice what the optimum pays for this edge, and it needs no lookahead.',
          'That would be a guess. If the optimum contains the other endpoint instead, you would be forced to cover more edges later, and the "twice the optimum" proof breaks.',
          'That is a different (greedy) rule, and it has no constant guarantee. The matching rule is deliberately blind: it just takes both endpoints.'
        ]
      };
    }, { id: 'l37-vc-take' });
    V.inputRow(L.q(fig, '[data-input]'), {
      label: 'Your graph as edges, e.g. A-B, B-C (up to 9 vertices, 16 edges)', value: VC_PRESETS[0].value,
      parse: function (text) { var r = A.parseEdges(text); return r.error ? { error: r.error } : { values: r.graph }; },
      presets: VC_PRESETS,
      hint: 'The edges are examined in the order you type them. Try reordering a preset: the cover changes, the 2× guarantee does not.',
      onApply: function (graph) { g = graph; player.setSteps(gen()); }
    });
  }

  V.ready(function () {
    L.lazy('#fig-reduce', reduceFigure);
    L.lazy('#fig-reduce-play', playFigure);
    L.lazy('#fig-sat', satFigure);
    L.lazy('#fig-cook', cookFigure);
    L.lazy('#fig-web', webFigure);
    L.lazy('#fig-vc', vcFigure);
    if (V.quizScore) V.quizScore.register('l37-vc-take');
  });
}());
