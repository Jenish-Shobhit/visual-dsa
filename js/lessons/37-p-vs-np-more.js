/* Lesson 37 · P, NP & hard problems — part 4: the class map, the decision guide, patterns and traps, checks, summary.
   Needs js/lessons/37-p-vs-np.js (VDSA.L37) and js/algos/37-p-vs-np.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L = V.L37, A = L.A;

  /* ================================================================== 1. the class map (Venn) */
  var PROBLEMS = [
    { id: 'sort', name: 'Sorting', x: 200, y: 230, where: 'P', kind: 'proven', text: 'In <b>P</b>: merge sort takes O(n log n) time. <em>Proven.</em>' },
    { id: 'sp', name: 'Shortest path', x: 290, y: 265, where: 'P', kind: 'proven', text: 'In <b>P</b>: Dijkstra takes O(E log V) with a heap. <em>Proven.</em>' },
    { id: 'match', name: 'Matching', x: 215, y: 315, where: 'P', kind: 'proven', text: 'In <b>P</b>: maximum matching is solvable in polynomial time (Edmonds, 1965). <em>Proven.</em>' },
    { id: 'prime', name: 'Primality', x: 300, y: 335, where: 'P', kind: 'proven', text: 'In <b>P</b>: the AKS algorithm (2002) tests primality in polynomial time in the number of digits. <em>Proven.</em>' },
    { id: 'factor', name: 'Factoring', x: 245, y: 130, where: 'NP', kind: 'believed', text: 'In <b>NP</b>: a factor is a certificate. No polynomial algorithm is known, and it is <em>believed</em> to be neither in P nor NP-complete. <em>Believed, not proven.</em>' },
    { id: 'gi', name: 'Graph isomorphism', x: 265, y: 415, where: 'NP', kind: 'believed', text: 'In <b>NP</b>. Babai (2015) found a quasi-polynomial algorithm, so it is very unlikely to be NP-complete, yet it is not known to be in P. <em>Open.</em>' },
    { id: 'sat', name: 'SAT', x: 475, y: 200, where: 'NPC', kind: 'proven', text: '<b>NP-complete</b> (Cook 1971, Levin 1973). <em>Proven.</em> Whether it has a polynomial algorithm is exactly the open question.' },
    { id: 'clique', name: 'Clique', x: 585, y: 235, where: 'NPC', kind: 'proven', text: '<b>NP-complete</b> (Karp, 1972), through 3-SAT and independent set. <em>Proven.</em>' },
    { id: 'tsp', name: 'TSP (tour ≤ k?)', x: 505, y: 295, where: 'NPC', kind: 'proven', text: '<b>NP-complete</b> in its decision form, through Hamiltonian cycle. <em>Proven.</em>' },
    { id: 'subset', name: 'Subset sum', x: 610, y: 320, where: 'NPC', kind: 'proven', text: '<b>NP-complete</b>. It has a pseudo-polynomial dynamic programme, but that is exponential in the number of bits. <em>Proven.</em>' },
    { id: 'col', name: '3-colouring', x: 505, y: 365, where: 'NPC', kind: 'proven', text: '<b>NP-complete</b> (from 3-SAT). Two colours is easy (bipartite test), three is hard. <em>Proven.</em>' },
    { id: 'opt', name: 'Shortest tour (find it)', x: 830, y: 355, where: 'NPH', kind: 'proven', text: '<b>NP-hard</b> but not in NP as stated: the answer is a tour, not yes or no. Its decision version is the NP-complete problem above. <em>Proven.</em>' },
    { id: 'halt', name: 'Halting problem', x: 820, y: 200, where: 'NPH', kind: 'proven', text: '<b>NP-hard</b> and <b>undecidable</b>: no algorithm at all decides it (Turing, 1936), so it is not in NP. <em>Proven.</em>' }
  ];
  var REGION_TEXT = {
    P: 'P: solvable in polynomial time.', NP: 'NP: checkable in polynomial time.', NPC: 'NP-complete: in NP and NP-hard.', NPH: 'NP-hard: at least as hard as everything in NP.'
  };
  function vennFigure(fig) {
    var stage = L.q(fig, '[data-stage]'), info = L.q(fig, '[data-info]');
    var svg = s('svg', { class: 'venn', viewBox: '0 0 1000 520', role: 'group', 'aria-label': 'Map of complexity classes. Problems are placed inside P, NP, NP-complete and NP-hard.' });
    var defs = s('defs', null, s('clipPath', { id: 'venn-clip' }, s('ellipse', { cx: 420, cy: 270, rx: 330, ry: 205 })));
    var eNP = s('ellipse', { class: 'v-np', cx: 420, cy: 270, rx: 330, ry: 205 });
    var eNPH = s('ellipse', { class: 'v-nph', cx: 700, cy: 270, rx: 300, ry: 205 });
    var eBoth = s('ellipse', { class: 'v-npc', cx: 700, cy: 270, rx: 300, ry: 205, 'clip-path': 'url(#venn-clip)' });
    var eP = s('ellipse', { class: 'v-p', cx: 250, cy: 275, rx: 145, ry: 118 });
    svg.appendChild(defs);
    [eNPH, eNP, eBoth, eP].forEach(function (e) { svg.appendChild(e); });
    var labNP = s('text', { class: 'v-lab v-lab--np', x: 150, y: 95 }, 'NP');
    var labNPH = s('text', { class: 'v-lab v-lab--nph', x: 880, y: 100, 'text-anchor': 'end' }, 'NP-hard');
    var labNPC = s('text', { class: 'v-lab v-lab--npc', x: 555, y: 130, 'text-anchor': 'middle' }, 'NP-complete');
    var labP = s('text', { class: 'v-lab v-lab--p', x: 250, y: 178, 'text-anchor': 'middle' }, 'P');
    [labNP, labNPH, labNPC, labP].forEach(function (t) { svg.appendChild(t); });
    var dots = {};
    PROBLEMS.forEach(function (p) {
      var g = s('g', { class: 'v-dot v-dot--' + p.where, transform: 'translate(' + p.x + ' ' + p.y + ')', tabindex: '0', role: 'button', 'aria-label': p.name + ' (' + p.where + ')', 'data-pid': p.id },
        s('circle', { r: 9 }), s('text', { x: 15, y: 5, class: 'v-dot__t' }, p.name));
      svg.appendChild(g); dots[p.id] = g;
    });
    V.clear(stage); stage.appendChild(svg);
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'active', label: 'P' }, { state: 'visited', label: 'NP' }, { state: 'done', label: 'NP-complete' }, { state: 'compare', label: 'NP-hard' }]);
    var equal = false, current = null;
    var DEFAULT = 'Hover, focus or tap a dot. The region it sits in tells you what is <em>proven</em>; the note says what is only <em>believed</em>.';
    function show(p) {
      current = p;
      Object.keys(dots).forEach(function (k) { dots[k].classList.toggle('is-on', !!p && p.id === k); });
      svg.setAttribute('data-hot', p ? p.where : '');
      if (!p) { info.innerHTML = equal ? PEQ : DEFAULT; return; }
      var where = p.where;
      var txt = p.text;
      if (equal && (where === 'NPC' || where === 'NP')) txt += ' <b>If P = NP:</b> it would be in P, solvable in polynomial time.';
      else if (equal && where === 'NPH') txt += ' <b>If P = NP:</b> nothing changes for it: it stays outside NP' + (p.id === 'halt' ? ', still undecidable.' : '.');
      info.innerHTML = '<span class="venn-tag venn-tag--' + p.kind + '">' + (p.kind === 'proven' ? 'proven' : 'believed') + '</span> <b>' + p.name + '</b>. ' + txt;
    }
    var PEQ = '<b>If P = NP</b> (which nobody has proven or refuted): P swells to fill NP, and every problem in NP, SAT and TSP included, is solvable in polynomial time. The NP-complete region collapses into P. Problems outside NP, like the halting problem, are unaffected.';
    var info2 = info; void info2;
    svg.addEventListener('pointerover', function (e) { var d = e.target.closest && e.target.closest('.v-dot'); if (d) show(PROBLEMS.filter(function (p) { return p.id === d.getAttribute('data-pid'); })[0]); });
    svg.addEventListener('focusin', function (e) { var d = e.target.closest && e.target.closest('.v-dot'); if (d) show(PROBLEMS.filter(function (p) { return p.id === d.getAttribute('data-pid'); })[0]); });
    svg.addEventListener('click', function (e) { var d = e.target.closest && e.target.closest('.v-dot'); if (d) show(PROBLEMS.filter(function (p) { return p.id === d.getAttribute('data-pid'); })[0]); });
    svg.addEventListener('pointerleave', function () { show(null); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(null); });
    function setEqual(on, instant) {
      equal = on;
      var dur = instant ? 0 : 900;
      V.animate(eP, { attr: on ? { cx: 420, cy: 270, rx: 330, ry: 205 } : { cx: 250, cy: 275, rx: 145, ry: 118 } }, { duration: dur, ease: 'inout' });
      V.animate(labP, { attr: on ? { x: 420, y: 62 } : { x: 250, y: 178 } }, { duration: dur, ease: 'inout' });
      labP.textContent = on ? 'P = NP' : 'P';
      labNP.style.opacity = on ? 0 : 1;
      svg.classList.toggle('is-equal', on);
      labNPC.textContent = on ? 'NP-complete (now inside P)' : 'NP-complete';
      show(current);
    }
    V.toggle(L.q(fig, '[data-toggle]'), { label: 'Show the world where P = NP', checked: false, onChange: function (v) { setEqual(v); } });
    info.innerHTML = DEFAULT;
    // region legend text for screen readers
    stage.setAttribute('aria-describedby', 'venn-desc');
    var d = h('p', { id: 'venn-desc', class: 'sr-only' }, Object.keys(REGION_TEXT).map(function (k) { return REGION_TEXT[k]; }).join(' '));
    fig.appendChild(d);
  }

  /* ================================================================== 2. decision guide */
  var FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'My problem looks NP-hard', col: 0, row: 0 },
      { id: 'q0', type: 'decision', text: 'Easy problem in disguise?', col: 0, row: 1 },
      { id: 'q1', type: 'decision', text: 'Input tiny (n ≲ 25)?', col: 0, row: 2 },
      { id: 'q2', type: 'decision', text: 'Special structure?', col: 0, row: 3 },
      { id: 'q3', type: 'decision', text: 'Small parameter k?', col: 0, row: 4 },
      { id: 'q4', type: 'decision', text: 'Need a guarantee?', col: 0, row: 5 },
      { id: 'a0', type: 'end', text: 'Use the polynomial algorithm', col: 1, row: 1 },
      { id: 'a1', type: 'end', text: 'Exhaustive search, or branch and bound', col: 1, row: 2 },
      { id: 'a2', type: 'end', text: 'Exploit the structure', col: 1, row: 3 },
      { id: 'a3', type: 'end', text: 'Fixed-parameter algorithm', col: 1, row: 4 },
      { id: 'a4', type: 'end', text: 'Approximation algorithm', col: 1, row: 5 },
      { id: 'a5', type: 'end', text: 'Heuristics or a SAT / ILP solver', col: 0, row: 6 },
      { id: 'n0', type: 'note', text: 'shortest path, matching, max flow, DP', col: 2, row: 1 },
      { id: 'n1', type: 'note', text: '2ⁿ or n! is still feasible at this size', col: 2, row: 2 },
      { id: 'n2', type: 'note', text: 'trees, planar or bipartite graphs, 2-SAT', col: 2, row: 3 },
      { id: 'n3', type: 'note', text: 'O(2ᵏ · poly n), e.g. vertex cover', col: 2, row: 4 },
      { id: 'n4', type: 'note', text: 'vertex cover 2×, metric TSP 1.5×', col: 2, row: 5 },
      { id: 'n5', type: 'note', text: '2-opt, simulated annealing, local search', col: 1, row: 6 }
    ],
    edges: [
      { from: 'start', to: 'q0' },
      { from: 'q0', to: 'a0', label: 'yes' }, { from: 'q0', to: 'q1', label: 'no' },
      { from: 'q1', to: 'a1', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'a2', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'a4', label: 'yes' }, { from: 'q4', to: 'a5', label: 'no' },
      { from: 'a0', to: 'n0', dashed: true, arrow: false }, { from: 'a1', to: 'n1', dashed: true, arrow: false },
      { from: 'a2', to: 'n2', dashed: true, arrow: false }, { from: 'a3', to: 'n3', dashed: true, arrow: false },
      { from: 'a4', to: 'n4', dashed: true, arrow: false }, { from: 'a5', to: 'n5', dashed: true, arrow: false }
    ]
  };
  var ADVICE = {
    q0: 'Before you fight NP-hardness, check you are not looking at an easy problem in disguise: shortest path, matching, flow, minimum spanning tree, dynamic programming. Many problems only <em>sound</em> hard. To be sure it is hard, reduce a known NP-complete problem <em>to</em> yours.',
    q1: 'If n is tiny, exponential is fine: 2ⁿ at n = 25 is about 33 million steps.',
    q2: 'NP-hardness is a worst-case claim over all inputs. Your real inputs may be trees, planar, bipartite or otherwise tame.',
    q3: 'If the exponential blow-up can be confined to a small parameter k (solution size, treewidth), the problem is fixed-parameter tractable.',
    q4: 'Do you need an answer provably within a known factor of optimal? If so, look for an approximation algorithm.',
    a0: '<b>Use the polynomial algorithm.</b> Good news: the problem was never hard. Model it as shortest path, matching, flow or a DP.',
    a1: '<b>Exhaustive search or branch and bound.</b> Backtracking with good pruning (lesson 33) solves surprisingly large instances when n is small.',
    a2: '<b>Exploit the structure.</b> Independent set on a tree is a simple DP; 2-SAT is linear time; bipartite vertex cover is matching (König).',
    a3: '<b>Fixed-parameter algorithm.</b> Branch on the parameter: vertex cover of size k costs about 2<sup>k</sup> times a polynomial, however big the graph.',
    a4: '<b>Approximation algorithm.</b> Vertex cover: 2× via a maximal matching. Metric TSP: 2× via the MST, 1.5× via Christofides. Some problems have no constant-factor approximation unless P = NP (general TSP).',
    a5: '<b>Heuristics or a solver.</b> No guarantee, but often excellent: 2-opt and simulated annealing for tours, modern SAT and integer-programming solvers for real-world instances.'
  };
  function flowFigure(fig) {
    var flow = V.views.flowchart(L.q(fig, '[data-stage]'), FLOW, { interactive: true, label: 'Decision guide for NP-hard problems. Choose yes or no at each question.' });
    var cap = L.q(fig, '[data-caption]'), path, taken, ends = { a0: 1, a1: 1, a2: 1, a3: 1, a4: 1, a5: 1 };
    V.legend(L.q(fig, '[data-legend]'), [{ state: 'active', label: 'You are here' }, { state: 'visited', label: 'Your path' }, { state: 'path', shape: 'line', label: 'Answers you gave' }, { state: 'found', label: 'Where you end up' }]);
    function reset() {
      path = ['q0']; taken = { 'start->q0': 'path' };
      flow.render({ active: 'q0', visited: ['start'], edgeStates: taken }, { duration: 250 });
      cap.innerHTML = ADVICE.q0;
    }
    flow.on('choose', function (e) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      var vis = path.slice(0, -1).concat(['start']);
      flow.render({ active: e.to, visited: vis, edgeStates: taken, states: ends[e.to] ? (function () { var o = {}; o[e.to] = 'found'; return o; }()) : undefined }, { duration: 500 });
      cap.innerHTML = ADVICE[e.to] || '';
    });
    L.q(fig, '[data-actions]').appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: reset }, 'Start over'));
    reset();
  }

  /* ================================================================== 3. patterns and traps: minis */
  function variationMinis() {
    V.tabs('#variants');
    // FPT: search-tree size 2^(k+1) - 1
    var svgP = s('svg', { viewBox: '0 0 300 160', class: 'l37-mini', role: 'img', 'aria-label': 'Bar chart: the search tree for vertex cover of size k has at most 3, 7, 15, 31, 63 or 127 nodes for k from 1 to 6, whatever the size of the graph' });
    var mx = 127;
    for (var k = 1; k <= 6; k++) {
      var v = Math.pow(2, k + 1) - 1, bh = Math.max(6, v / mx * 100), x = 24 + (k - 1) * 46;
      svgP.appendChild(s('rect', { x: x, y: 118 - bh, width: 32, height: bh, rx: 4, class: 'lm-bar' }));
      svgP.appendChild(L.txt(x + 16, 112 - bh, 'lm-k', String(v), { 'text-anchor': 'middle' }));
      svgP.appendChild(L.txt(x + 16, 136, 'lm-k', 'k=' + k, { 'text-anchor': 'middle' }));
    }
    svgP.appendChild(L.txt(150, 155, 'lm-k', 'same bars for 10 vertices or 10,000', { 'text-anchor': 'middle' }));
    V.$('[data-mini="param"]').appendChild(svgP);
    // special cases: a general graph vs a tree
    var svgS = s('svg', { viewBox: '0 0 300 150', class: 'l37-mini', role: 'img', 'aria-label': 'A tangled graph labelled hard next to a tree labelled easy' });
    var gp = [[40, 40], [110, 30], [140, 85], [70, 110], [20, 90]], ge = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3], [1, 4], [2, 4]];
    ge.forEach(function (e) { svgS.appendChild(s('line', { x1: gp[e[0]][0], y1: gp[e[0]][1], x2: gp[e[1]][0], y2: gp[e[1]][1], class: 'lm-edge' })); });
    gp.forEach(function (p) { svgS.appendChild(s('circle', { cx: p[0], cy: p[1], r: 9, class: 'lm-node' })); });
    var tp = [[230, 25], [195, 70], [265, 70], [175, 118], [215, 118], [285, 118]], te = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]];
    te.forEach(function (e) { svgS.appendChild(s('line', { x1: tp[e[0]][0], y1: tp[e[0]][1], x2: tp[e[1]][0], y2: tp[e[1]][1], class: 'lm-edge is-on' })); });
    tp.forEach(function (p) { svgS.appendChild(s('circle', { cx: p[0], cy: p[1], r: 9, class: 'lm-node is-on' })); });
    svgS.appendChild(L.txt(80, 141, 'lm-k', 'general: NP-hard', { 'text-anchor': 'middle' }));
    svgS.appendChild(L.txt(230, 141, 'lm-k', 'tree: easy DP', { 'text-anchor': 'middle' }));
    V.$('[data-mini="special"]').appendChild(svgS);
    // pseudo-polynomial: 20 bits vs a million columns
    var svgD = s('svg', { viewBox: '0 0 300 150', class: 'l37-mini', role: 'img', 'aria-label': 'The number one million is written with 20 bits, but a table with one column per possible sum has a million columns' });
    for (var i = 0; i < 20; i++) svgD.appendChild(s('rect', { x: 20 + i * 13, y: 24, width: 10, height: 16, rx: 2, class: 'lm-bit' }));
    svgD.appendChild(L.txt(150, 60, 'lm-k', 'T = 1,000,000 is written with 20 bits', { 'text-anchor': 'middle' }));
    svgD.appendChild(s('path', { d: 'M150 68 V88 m-6 -7 l6 7 l6 -7', class: 'lm-arrow' }));
    svgD.appendChild(s('rect', { x: 20, y: 96, width: 260, height: 26, rx: 4, class: 'lm-big' }));
    svgD.appendChild(L.txt(150, 114, 'lm-t is-onbig', 'DP table with 1,000,000 columns', { 'text-anchor': 'middle' }));
    svgD.appendChild(L.txt(150, 143, 'lm-k', 'work n · T = n · 2²⁰: exponential in bits', { 'text-anchor': 'middle' }));
    V.$('[data-mini="pseudo"]').appendChild(svgD);
    // undecidable vs NP-complete
    var svgU = s('svg', { viewBox: '0 0 300 150', class: 'l37-mini', role: 'img', 'aria-label': 'Two timelines: an NP-complete search takes very long but ends with an answer; an undecidable question never has an algorithm that always finishes' });
    svgU.appendChild(L.txt(14, 30, 'lm-k', 'NP-complete', { 'text-anchor': 'start' }));
    svgU.appendChild(s('line', { x1: 14, y1: 46, x2: 200, y2: 46, class: 'lm-line' }));
    svgU.appendChild(s('circle', { cx: 200, cy: 46, r: 11, class: 'lm-dot is-ok' })); svgU.appendChild(L.txt(200, 51, 'lm-tick', '✓', { 'text-anchor': 'middle' }));
    svgU.appendChild(L.txt(220, 51, 'lm-k', 'then done', { 'text-anchor': 'start' }));
    svgU.appendChild(L.txt(14, 92, 'lm-k', 'Undecidable', { 'text-anchor': 'start' }));
    svgU.appendChild(s('line', { x1: 14, y1: 108, x2: 270, y2: 108, class: 'lm-line is-bad' }));
    svgU.appendChild(L.txt(283, 113, 'lm-t', '…', { 'text-anchor': 'middle' }));
    svgU.appendChild(L.txt(150, 138, 'lm-k', 'no algorithm is guaranteed to stop', { 'text-anchor': 'middle' }));
    V.$('[data-mini="undec"]').appendChild(svgU);
  }

  /* ================================================================== 4. checks */
  function checks() {
    V.quiz('#quiz-direction', {
      question: 'You know that independent set is NP-hard, and you want to prove that a new problem H is NP-hard. Which reduction do you build?',
      options: ['From H to independent set: H ≤ₚ independent set', 'From independent set to H: independent set ≤ₚ H', 'Any direction works, as long as it runs in polynomial time', 'Neither: you must show H needs exponential time'],
      answer: 1,
      explain: [
        'This shows H is <em>no harder than</em> independent set, which says nothing about H being hard. Every easy problem reduces to some hard one.',
        'Right. If H had a fast algorithm, you could convert any independent-set instance into an H-instance, solve it fast, and read the answer off. So H is at least as hard as independent set.',
        'The direction is the whole point. Reducing the wrong way proves nothing about hardness.',
        'Nobody can prove exponential lower bounds for NP-complete problems yet; NP-hardness is a <em>relative</em> statement, proved by reduction.'
      ],
      id: 'l37-quiz-direction'
    });
    V.quiz('#quiz-approx', {
      question: 'The matching-based algorithm is a 2-approximation for minimum vertex cover. Could the cover it returns ever be <em>smaller</em> than the true minimum?',
      options: ['Yes, if the algorithm gets lucky', 'Yes, but only on very small graphs', 'No: the minimum is the smallest cover that exists, so the output is at least as big, and at most twice as big', 'Only when the graph is bipartite'],
      answer: 2,
      explain: [
        'Luck cannot beat the minimum: by definition no valid cover is smaller than the smallest one.',
        'Size does not matter. The optimum is a lower bound on every valid cover of the graph, big or small.',
        'Right. "2-approximation" is a guarantee from above: optimum ≤ output ≤ 2 × optimum. The output is always a valid cover, so it can equal the optimum but never beat it.',
        'On bipartite graphs the exact optimum is easy to find (König), but the approximation still cannot go below it.'
      ],
      id: 'l37-quiz-approx'
    });
    V.quiz('#quiz-pnp', {
      question: 'Which of these statements is <em>proven</em>?',
      options: ['P ⊆ NP: every problem solvable in polynomial time can be verified in polynomial time', 'P ≠ NP: NP-complete problems provably need exponential time', 'NP stands for "not polynomial"', 'Factoring is NP-complete'],
      answer: 0,
      explain: [
        'Right. To verify, just solve the problem yourself and ignore the certificate. P ⊆ NP is easy and proven. Whether the two are <em>equal</em> is open.',
        'Believed by most researchers, but unproven. No one has a proof that any NP-complete problem needs exponential time.',
        'NP is nondeterministic polynomial time: problems whose yes-answers have short, quickly checkable certificates. Many NP problems are in P.',
        'Not known, and widely believed <em>not</em> to be. Factoring is in NP and no polynomial algorithm is known, but it is not known to be NP-complete.'
      ],
      id: 'l37-quiz-pnp'
    });
    V.quiz('#quiz-hard', {
      question: 'Which of these problems are <em>NP-hard</em>? Select all that apply.',
      options: ['SAT', 'Sorting n numbers', 'The halting problem', 'Shortest path with non-negative weights', 'Finding the shortest tour (optimisation TSP)'],
      answer: [0, 2, 4],
      explain: 'SAT is NP-complete, hence NP-hard. The halting problem is NP-hard too (every problem in NP reduces to it) even though it is not in NP: undecidable problems are at least as hard as anything. The shortest-tour problem is NP-hard (its decision version is NP-complete). Sorting and shortest path are in P, so they are only NP-hard if P = NP, which is not known.',
      id: 'l37-quiz-hard'
    });
  }

  /* ================================================================== 5. summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tile(svg, label, text) { return h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, svg), h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text)); }
    function svgOf(children) { return s.apply(null, ['svg', { viewBox: '0 0 160 90', class: 'l37-mini', role: 'img', 'aria-hidden': 'true' }].concat(children)); }
    var t1 = svgOf([s('rect', { x: 14, y: 20, width: 56, height: 50, rx: 8, class: 'lm-card is-ok' }), L.txt(42, 51, 'lm-t', '✓', { 'text-anchor': 'middle' }),
      s('rect', { x: 90, y: 20, width: 56, height: 50, rx: 8, class: 'lm-card' }), L.txt(118, 52, 'lm-t', '?', { 'text-anchor': 'middle' }),
      L.txt(42, 85, 'lm-k', 'check', { 'text-anchor': 'middle' }), L.txt(118, 85, 'lm-k', 'find', { 'text-anchor': 'middle' })]);
    var t2 = svgOf([s('ellipse', { cx: 80, cy: 45, rx: 66, ry: 36, class: 'lm-ell np' }), s('ellipse', { cx: 62, cy: 48, rx: 30, ry: 18, class: 'lm-ell p' }),
      L.txt(62, 52, 'lm-k', 'P', { 'text-anchor': 'middle' }), L.txt(110, 30, 'lm-k', 'NP', { 'text-anchor': 'middle' })]);
    var t3 = svgOf([s('rect', { x: 10, y: 30, width: 46, height: 30, rx: 8, class: 'lm-card' }), L.txt(33, 50, 'lm-t', 'A', { 'text-anchor': 'middle' }),
      s('path', { d: 'M62 45 H98 m-7 -6 l7 6 l-7 6', class: 'lm-arrow' }),
      s('rect', { x: 104, y: 30, width: 46, height: 30, rx: 8, class: 'lm-card is-key' }), L.txt(127, 50, 'lm-t is-key', 'B', { 'text-anchor': 'middle' }),
      L.txt(80, 82, 'lm-k', 'B is at least as hard', { 'text-anchor': 'middle' })]);
    var t4 = svgOf([s('circle', { cx: 80, cy: 30, r: 15, class: 'lm-node is-on' }), L.txt(80, 35, 'lm-k', 'SAT', { 'text-anchor': 'middle' }),
      s('line', { x1: 80, y1: 45, x2: 30, y2: 68, class: 'lm-edge is-on' }), s('line', { x1: 80, y1: 45, x2: 80, y2: 68, class: 'lm-edge is-on' }), s('line', { x1: 80, y1: 45, x2: 130, y2: 68, class: 'lm-edge is-on' }),
      s('circle', { cx: 30, cy: 72, r: 9, class: 'lm-node is-on' }), s('circle', { cx: 80, cy: 72, r: 9, class: 'lm-node is-on' }), s('circle', { cx: 130, cy: 72, r: 9, class: 'lm-node is-on' })]);
    var t5 = svgOf([s('rect', { x: 12, y: 24, width: 50, height: 16, rx: 4, class: 'lm-bar' }), L.txt(70, 37, 'lm-k', 'opt', { 'text-anchor': 'start' }),
      s('rect', { x: 12, y: 52, width: 100, height: 16, rx: 4, class: 'lm-bar is-app' }), L.txt(118, 65, 'lm-k', '≤ 2×', { 'text-anchor': 'start' })]);
    var t6 = svgOf([L.txt(80, 46, 'lm-t is-big', 'P = NP ?', { 'text-anchor': 'middle' }), L.txt(80, 70, 'lm-k', 'open · Clay prize $1M', { 'text-anchor': 'middle' })]);
    grid.appendChild(tile(t1, 'Verify vs solve', 'Checking a certificate is fast; finding one seems slow.'));
    grid.appendChild(tile(t2, 'P ⊆ NP', 'Proven. Whether P = NP is open.'));
    grid.appendChild(tile(t3, 'A ≤ₚ B', 'Reduce the known hard problem to the new one.'));
    grid.appendChild(tile(t4, 'NP-complete', 'One fast algorithm for any of them would solve all of NP.'));
    grid.appendChild(tile(t5, 'Approximate', 'Vertex cover: within 2× of optimal, fast.'));
    grid.appendChild(tile(t6, 'Open', 'Most researchers believe P ≠ NP. Nobody can prove it.'));
  }

  V.ready(function () {
    L.lazy('#fig-venn', vennFigure);
    L.lazy('#fig-flow', flowFigure);
    variationMinis();
    checks();
    summaryCard();
  });
}());
