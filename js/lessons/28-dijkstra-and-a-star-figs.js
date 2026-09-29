/* Lesson 28 · Dijkstra & A* — part 2: relaxation, the cut argument, the hand run and lazy deletion.
   Needs js/lessons/28-dijkstra-and-a-star.js (VDSA.L28) and js/algos/28-dijkstra-and-a-star.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SP = V.algos.shortestPaths;
  var L = V.L28;

  /* A graph + priority-queue figure driven by Dijkstra steps (used by the hand run, lazy deletion and the negative edge). */
  L.dijkstraFigure = function (fig, g, steps, o) {
    o = o || {};
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: o.bounds || { w: 1000, h: 600 }, maxHeight: o.maxHeight || 360, nodeRadius: o.nodeRadius || 22, minRadius: 14, label: o.label || 'Dijkstra on a weighted graph' });
    var pq = L.pqPanel(fig.querySelector('[data-pq]'));
    var opts = {
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: o.baseStepMs || 1300,
      label: o.controlsLabel || 'Dijkstra controls',
      render: function (step, ctx) {
        view.render(L.graphState(g, step, o.state), { duration: ctx.duration });
        pq.render(step, ctx.duration);
        if (o.tag) L.tagNodes(view);
      }
    };
    var counters = fig.querySelector('[data-counters]');
    if (counters) {
      opts.counters = counters;
      opts.counterLabels = { settled: 'Vertices settled', relaxations: 'Relaxations', pushes: 'Heap pushes', stale: 'Stale pops' };
      opts.counterStates = { settled: 'done', relaxations: 'active', stale: 'muted' };
    }
    var player = V.player(opts);
    return { player: player, view: view, pq: pq };
  };

  /* ================================================================== relaxation in isolation */
  function relaxFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'done', label: 'Known distance' },
      { state: 'compare', label: 'Candidate: dist[u] + w' },
      { state: 'done', shape: 'line', label: 'Shorter: relax' },
      { state: 'error', shape: 'line', label: 'Not shorter: keep' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    var vals = { du: 5, w: 3, dv: 12 };   // dv null = ∞
    var W = 680, H = 300, U = { x: 150, y: 160 }, P = { x: 530, y: 160 }, R = 34, mid = (U.x + P.x) / 2;
    var mid_id = V.uid('rx');
    var svg = s('svg', { class: 'dj-rx', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Two vertices u and v joined by an edge; a candidate distance travels from u to v and is compared with the distance v already has.' });
    svg.appendChild(s('defs', {}, s('marker', { id: mid_id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 13, markerHeight: 13, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 z', class: 'rx-arrowhead' }))));
    var edge = s('line', { class: 'rx-edge', x1: U.x + R, y1: U.y, x2: P.x - R - 3, y2: P.y, 'marker-end': 'url(#' + mid_id + ')' });
    svg.appendChild(edge);
    function pill(cls, mono) {
      var rect = s('rect', { class: 'rx-pill__rect', rx: 10, ry: 10, height: 30, y: -15 });
      var text = s('text', { class: 'rx-pill__text' + (mono ? ' is-mono' : ''), 'text-anchor': 'middle', y: 1, 'dominant-baseline': 'central' });
      var g = s('g', { class: 'rx-pill ' + cls }, rect, text);
      g.setText = function (t) {
        text.textContent = t;
        var w = V.vz.textWidth(t, 15, true, 700) + 26;
        rect.setAttribute('width', w.toFixed(1)); rect.setAttribute('x', (-w / 2).toFixed(1));
      };
      return g;
    }
    function node(id, x, y) {
      var g = s('g', { class: 'rx-node' }, s('circle', { r: R, cx: 0, cy: 0 }), s('text', { class: 'rx-node__text', 'text-anchor': 'middle', y: 1, 'dominant-baseline': 'central' }, id));
      svg.appendChild(g); V.place(g, { x: x, y: y });
      return g;
    }
    var nu = node('u', U.x, U.y), nv = node('v', P.x, P.y);
    var wPill = pill('rx-w', true); svg.appendChild(wPill); V.place(wPill, { x: mid, y: U.y });
    var parent = s('path', { class: 'rx-parent', d: 'M ' + (P.x - 18) + ' ' + (P.y + R + 2) + ' C ' + (P.x - 90) + ' ' + (P.y + 96) + ', ' + (U.x + 90) + ' ' + (U.y + 96) + ', ' + (U.x + 18) + ' ' + (U.y + R + 6), 'marker-end': 'url(#' + mid_id + ')' });
    var parentLbl = s('text', { class: 'rx-parent__text', x: mid, y: U.y + 84, 'text-anchor': 'middle' }, 'parent[v] = u');
    svg.appendChild(parent); svg.appendChild(parentLbl);
    var lu = pill('rx-lab', true), lv = pill('rx-lab', true), token = pill('rx-token', true), verdict = pill('rx-verdict', false);
    [lu, lv, token, verdict].forEach(function (g) { svg.appendChild(g); });
    V.place(lu, { x: U.x, y: 60 }); V.place(lv, { x: P.x, y: 60 });
    V.place(token, { x: U.x, y: 100, opacity: 0 }); V.place(verdict, { x: mid, y: 268, opacity: 0 });
    parent.style.opacity = 0; parentLbl.style.opacity = 0;
    stage.appendChild(svg);

    function txt(d) { return d === null ? '∞' : String(d); }
    function build() {
      var du = vals.du, w = vals.w, dv = vals.dv, cand = du + w;
      var better = dv === null || cand < dv;
      var dvTxt = dv === null ? '∞' : String(dv);
      var eq = dv !== null && cand === dv;
      return [
        { phase: 'setup', du: du, w: w, dv: dv, cand: cand, better: better, caption: 'The edge <b>u → v</b> has weight <b>' + w + '</b>. The best known way to <b>u</b> costs <b>' + du + '</b>; <b>v</b> currently has ' + (dv === null ? '<b>∞</b>, so it has not been reached yet' : '<b>' + dv + '</b>') + '.' },
        { phase: 'try', du: du, w: w, dv: dv, cand: cand, better: better, caption: 'Try the route that goes through <b>u</b>: ' + du + ' to reach u, plus ' + w + ' for this edge is <b>' + cand + '</b>.' },
        { phase: 'compare', du: du, w: w, dv: dv, cand: cand, better: better, caption: better
          ? (dv === null ? cand + ' is less than ∞: any route beats none.' : cand + ' is <b>less than</b> ' + dv + ', so the route through u is shorter.')
          : (eq ? cand + ' equals ' + dv + '. A tie is not an improvement, so the old route stays.' : cand + ' is <b>not less than</b> ' + dv + ': the route through u is longer.') },
        { phase: 'apply', du: du, w: w, dv: dv, cand: cand, better: better, caption: better
          ? '<b>Relax:</b> dist[v] becomes ' + cand + ' and v remembers u as its parent, the vertex its best route came from.'
          : 'Nothing changes. dist[v] stays ' + dvTxt + ' and v keeps the parent it already had. The edge was examined, that is all.' }
      ];
    }
    var pendingCp = null;
    var player = V.player({
      root: fig, steps: build(), caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, animMs: 800, label: 'Relaxation controls',
      render: function (step, ctx) {
        var dur = ctx.duration, ph = step.phase;
        var applied = ph === 'apply';
        lu.setText('dist[u] = ' + step.du);
        lv.setText('dist[v] = ' + (applied && step.better ? step.cand : txt(step.dv)));
        wPill.setText(String(step.w));
        token.setText(step.du + ' + ' + step.w + ' = ' + step.cand);
        svg.classList.toggle('is-better', ph === 'compare' || applied ? step.better : false);
        svg.classList.toggle('is-worse', (ph === 'compare' || applied) && !step.better);
        svg.classList.toggle('is-try', ph === 'try' || ph === 'compare' || applied);
        svg.classList.toggle('is-applied', applied);
        lv.classList.toggle('is-new', applied && step.better);
        // token: appears at u, travels along the edge to v, then flies into the label (better) or fades (not better)
        if (ph === 'try' && ctx.prev && ctx.prev.phase === 'setup' && dur > 0) V.place(token, { x: U.x, y: 100, opacity: 0 });
        if (ph === 'setup') V.animate(token, { x: U.x, y: 100, opacity: 0 }, { duration: dur, ease: 'inOut' });
        else if (ph === 'apply') V.animate(token, { x: P.x, y: step.better ? 64 : 124, opacity: 0 }, { duration: dur, ease: 'inOut' });
        else V.animate(token, { x: P.x, y: 100, opacity: 1 }, { duration: dur, ease: 'inOut' });
        // verdict
        var vt = ph === 'compare' || applied ? (step.better ? (step.dv === null ? step.cand + ' < ∞ : shorter' : step.cand + ' < ' + step.dv + ' : shorter') : (step.cand === step.dv ? step.cand + ' = ' + step.dv + ' : not shorter' : step.cand + ' ≥ ' + step.dv + ' : not shorter')) : '';
        if (vt) verdict.setText(vt);
        V.animate(verdict, { opacity: vt ? 1 : 0 }, { duration: dur });
        // parent arrow
        var showParent = applied && step.better;
        V.animate(parent, { opacity: showParent ? 1 : 0 }, { duration: dur });
        V.animate(parentLbl, { opacity: showParent ? 1 : 0 }, { duration: dur });
      }
    });
    player.addCheckpoint(function (steps) { return steps.length === 4 ? 3 : -1; }, function (c) {
      var st = c.step, oldTxt = txt(st.dv), candTxt = String(st.cand);
      var right = st.better ? candTxt : oldTxt;
      var opts = [oldTxt, candTxt];
      if (oldTxt === candTxt) opts = [oldTxt, String(st.du)];
      opts.push(String(st.du + st.w + st.w));
      var seen = {}; opts = opts.filter(function (o) { if (seen[o]) return false; seen[o] = true; return true; });
      var ans = opts.indexOf(right);
      return {
        question: 'dist[u] = ' + st.du + ', w = ' + st.w + ' and dist[v] = ' + oldTxt + '. After relaxing u → v, what is dist[v]?',
        options: opts.map(function (o) { return '<b>' + o + '</b>'; }), answer: ans,
        explain: opts.map(function (o) {
          if (o === right) return st.better ? oldTxt + ' is replaced: ' + st.du + ' + ' + st.w + ' = ' + candTxt + (st.dv === null ? ' beats ∞.' : ' is smaller than ' + oldTxt + '.') : candTxt + ' is not smaller than ' + oldTxt + ', so the old value stays. Relaxation only ever lowers a distance.';
          if (o === oldTxt) return 'That would be right only if the new route were not shorter. Here ' + candTxt + ' < ' + oldTxt + ', so it is replaced.';
          if (o === candTxt) return candTxt + ' would win only if it were smaller than ' + oldTxt + '. It is not, so nothing changes.';
          return 'That adds w twice. A relaxation adds w once: dist[u] + w.';
        })
      };
    }, { id: 'dj-relax-predict' });

    function reload(replay) {
      player.setSteps(build(), { keepIndex: !replay });
      if (replay) { player.reset(); player.play(); }
    }
    var sl = {};
    function makeSlider(name, label, min, max, fmt) {
      sl[name] = V.slider(fig.querySelector('[data-slider="' + name + '"]'), {
        label: label, min: min, max: max, step: 1, value: name === 'dv' ? (vals.dv === null ? 31 : vals.dv) : vals[name], format: fmt,
        onInput: function (v) { vals[name] = name === 'dv' ? (v > 30 ? null : v) : v; reload(false); }
      });
    }
    makeSlider('du', 'dist[u]', 0, 20, function (v) { return String(v); });
    makeSlider('w', 'weight w', 0, 12, function (v) { return String(v); });
    makeSlider('dv', 'dist[v]', 0, 31, function (v) { return v > 30 ? '∞' : String(v); });
    var presets = [
      { label: '∞ → improves', v: [5, 3, null] }, { label: '12 → improves', v: [5, 3, 12] },
      { label: '6 → keeps', v: [5, 3, 6] }, { label: 'A tie', v: [5, 3, 8] }
    ];
    presets.forEach(function (p) {
      fig.querySelector('[data-presets]').appendChild(h('button', {
        type: 'button', class: 'btn btn--sm',
        onclick: function () {
          vals.du = p.v[0]; vals.w = p.v[1]; vals.dv = p.v[2];
          sl.du.set(vals.du); sl.w.set(vals.w); sl.dv.set(vals.dv === null ? 31 : vals.dv);
          reload(true);
        }
      }, p.label));
    });
    // start with the "improves" example so the first look shows the whole move
    lv.setText('dist[v] = 12'); lu.setText('dist[u] = 5'); wPill.setText('3');
    // quiz
    V.quiz('#quiz-relax', {
      id: 'quiz-relax',
      question: 'Edge <code>u → v</code> has weight 4. Right now dist[u] = 6 and dist[v] = 9. After relaxing that edge, what are the two distances?',
      options: ['dist[u] = 6, dist[v] = 9', 'dist[u] = 6, dist[v] = 10', 'dist[u] = 5, dist[v] = 9', 'dist[u] = 6, dist[v] = 4'],
      answer: 0,
      explain: [
        'The candidate is 6 + 4 = 10, which is not less than 9. So dist[v] stays 9. Relaxing never changes dist[u], and it never raises anything.',
        'The candidate 10 is larger than 9, and a distance only ever goes down, so 9 stays.',
        'dist[u] does not change when you relax an edge out of u. Only the target v can be updated.',
        'That mixes up w and dist[u] + w. The candidate is 6 + 4 = 10, not 4.'
      ]
    });
  }

  /* ================================================================== the cut argument */
  function cutFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'done', label: 'Settled' }, { state: 'frontier', label: 'Waiting, with a tentative distance' },
      { state: 'active', label: 'Closest waiting vertex' }, { state: 'compare', shape: 'line', label: 'Another route to X' },
      { state: 'error', shape: 'line', label: 'Negative edge' }
    ]);
    var g = L.graph([['S', 90, 300], ['A', 320, 130], ['B', 320, 470], ['X', 620, 130], ['Y', 620, 470], ['Z', 900, 300]],
      [['S', 'A', 2], ['S', 'B', 3], ['A', 'X', 2], ['B', 'Y', 3], ['X', 'Z', 5], ['Y', 'Z', 3], ['Y', 'X', 1]], true);
    var dist = { S: 0, A: 2, B: 3, X: 4, Y: 6, Z: null };
    var parent = { S: null, A: 'S', B: 'S', X: 'A', Y: 'B', Z: null };
    var base = { S: 'done', A: 'done', B: 'done', X: 'frontier', Y: 'frontier', Z: 'default' };
    var tree = { 'S-A': 'done', 'S-B': 'done', 'A-X': 'frontier', 'B-Y': 'frontier' };
    function st(over, edges, extra) {
      var states = Object.assign({}, base, over || {});
      return Object.assign({ states: states, edges: Object.assign({}, tree, edges || {}), dist: dist, parent: parent }, extra || {});
    }
    var steps = [
      Object.assign(st(), { caption: 'Dijkstra is part-way through. <b>S, A, B</b> are settled (green): 0, 2 and 3 are final. <b>X</b> and <b>Y</b> are waiting with tentative distances 4 and 6. <b>Z</b> has not been reached.' }),
      Object.assign(st({ X: 'active' }), { caption: 'The closest waiting vertex is <b>X</b> at 4. Dijkstra settles it next. Why is 4 already the true distance?' }),
      Object.assign(st({ X: 'active', Y: 'compare' }, { 'S-B': 'compare', 'B-Y': 'compare', 'Y-X': 'compare' }), { alt: '7', caption: 'A different route to X would have to leave the settled set through the only other waiting vertex, <b>Y</b>, which already costs 6. Even with the short edge Y → X, that route costs 6 + 1 = <b>7</b>. Every edge on the way only adds, so it cannot beat 4.' }),
      Object.assign(st({ X: 'error', Y: 'compare' }, { 'S-B': 'compare', 'B-Y': 'compare', 'Y-X': 'error' }), { alt: '1', neg: true, caption: 'Now break the rule: give Y → X a weight of <b>−5</b>. The same route costs 6 − 5 = <b>1</b>, less than 4. The argument “every later edge only adds” is gone, and so is Dijkstra’s guarantee.' })
    ];
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 380, directed: true, label: 'The cut between settled and waiting vertices' });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 2200, label: 'Cut argument controls',
      render: function (step, ctx) {
        view.render(L.graphState(g, step, {
          mapNode: function (node) { if (node.id === 'X' && step.alt) node.sub = 'other route: ' + step.alt; },
          mapEdge: function (e) { if (e.id === 'Y-X' && step.neg) e.weight = -5; }
        }), { duration: ctx.duration });
      }
    });
  }

  /* ================================================================== Dijkstra by hand */
  function handFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), L.LEGEND_DIJKSTRA);
    var steps = SP.dijkstra(L.MAP, 'S', { target: 'T' });
    var fx = L.dijkstraFigure(fig, L.MAP, steps, { label: 'Dijkstra on the lesson map', baseStepMs: 1400, controlsLabel: 'Dijkstra by hand controls' });
    fx.player.addCheckpoint(function (all) {
      for (var i = 3; i < all.length; i++) {
        if (all[i].kind !== 'settle') continue;
        var live = all[i - 1].pq.filter(function (e) { return !e.stale; });
        if (live.length >= 3) return i;
      }
      return -1;
    }, function (c) {
      var prev = c.prev, nextU = c.step.u;
      var live = prev.pq.filter(function (e) { return !e.stale; });
      if (live.length < 2) return null;
      var opts = live.slice(0, 3).map(function (e) { return { v: e.v, d: e.d }; });
      var ans = opts.findIndex(function (o) { return o.v === nextU; });
      if (ans < 0) return null;
      return {
        question: 'The queue holds ' + live.map(function (e) { return '(' + e.d + ', ' + e.v + ')'; }).join(', ') + '. Which vertex does Dijkstra settle next?',
        options: opts.map(function (o) { return '<b>' + o.v + '</b>, at ' + o.d; }), answer: ans,
        explain: opts.map(function (o, i) {
          return i === ans ? o.v + ' has the smallest distance in the queue (' + o.d + '). Nothing else can reach it more cheaply, so it is settled.'
            : o.v + ' is waiting at ' + o.d + ', but a vertex with a smaller number is still in the queue. Dijkstra always takes the smallest, not the newest or the alphabetically first.';
        })
      };
    }, { id: 'dj-hand-next' });
  }

  /* ================================================================== lazy deletion */
  function lazyFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), L.LEGEND_DIJKSTRA);
    var g = L.graph([['S', 100, 300], ['A', 440, 130], ['B', 440, 470], ['T', 830, 300]], [['S', 'A', 4], ['S', 'B', 1], ['B', 'A', 2], ['A', 'T', 1]]);
    var steps = SP.dijkstra(g, 'S');
    L.dijkstraFigure(fig, g, steps, { label: 'Lazy deletion on four vertices', maxHeight: 300, baseStepMs: 1500, controlsLabel: 'Lazy deletion controls' });
  }

  V.ready(function () {
    L.lazy('#fig-relax', relaxFigure);
    L.lazy('#fig-cut', cutFigure);
    L.lazy('#fig-hand', handFigure);
    L.lazy('#fig-lazy', lazyFigure);
  });
}());
