/* Lesson 24 · Union-find — part 2: the mechanism figures (captain minis, forest in an array, find, union,
   the raw-element bug, the chain, union by rank, path compression).
   Needs js/lessons/24-union-find.js (VDSA.L24) and js/algos/24-union-find.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L = V.L24, UF = L.UF;

  var LEG = {
    plain: [
      { state: 'default', shape: 'outline', label: 'Element' },
      { state: 'active', label: 'Being examined' },
      { state: 'path', label: 'Climbed past' },
      { state: 'found', label: 'Root' },
      { state: 'swap', label: 'Re-pointed or linked' }
    ],
    rank: [
      { state: 'default', shape: 'outline', label: 'Element (badge = rank of a root)' },
      { state: 'found', label: 'Root that stays on top' },
      { state: 'swap', label: 'Root hung underneath' }
    ],
    link: [
      { state: 'default', shape: 'outline', label: 'Element' },
      { state: 'found', label: 'Root' },
      { state: 'swap', label: 'Root hung underneath' },
      { state: 'path', label: 'Climbed past' }
    ]
  };

  /* Register the checkpoint ids up front, so the page score total never jumps when a lazy figure starts. */
  ['uf-find-hops', 'uf-rank-root', 'uf-compress-target', 'uf-lab-root', 'uf-lab-repoint', 'uf-cycle-verdict'].forEach(function (id) { if (V.quizScore) V.quizScore.register(id); });

  function opsUnion(pairs) { return pairs.map(function (p) { return { type: 'union', a: p[0], b: p[1] }; }); }
  function finds(list) { return list.map(function (a) { return { type: 'find', a: a }; }); }

  /* ================================================================== the captain minis */
  function captainMinis(row) {
    function mini(cap, state, label) {
      var st = h('div', { class: 'mini__stage uf-mini' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      var view = L.forestView(st, { label: label, nodeR: 15, maxSlot: 46, pointers: false, showRank: false });
      view.render(state, { duration: 0 });
      return view;
    }
    var N = 6;
    mini('<b>1. Everyone is their own captain.</b> Each node points to itself.', { parent: [0, 1, 2, 3, 4, 5] }, 'Six people, each their own captain');
    var par = [1, 1, 1, 3, 3, 5];
    mini('<b>2. Merging.</b> Captain 0 and captain 2 start reporting to 1, and 4 reports to 3. Two groups, plus 5 alone.', { parent: par, colors: L.groupColors([par])[0], edgeStates: { 0: 'swap', 2: 'swap', 4: 'swap' } }, 'After merging: groups {0,1,2}, {3,4}, {5}');
    mini('<b>3. Who is my captain?</b> From 2 ask your boss: 1. Ask 1: their own boss. So the captain is 1.', { parent: par, colors: L.groupColors([par])[0], states: { 2: 'active', 1: 'found' }, edgeStates: { 2: 'active' }, pointers: [{ name: 'x', node: 2 }] }, 'find(2) climbs one step to the captain 1');
  }

  /* ================================================================== a forest in an array */
  function arrayFigure(fig) {
    var ops = opsUnion([[0, 1], [2, 3], [1, 3], [4, 5], [6, 7], [5, 3]]);
    var steps = UF.trace(8, ops, { byRank: false, compress: 'none', quick: true });
    steps.forEach(function (st) {
      if (st.kind === 'link') {
        var child = Object.keys(st.edgeStates)[0], g = UF.groupsOf(st.parent).filter(function (g) { return g.indexOf(+child) >= 0; })[0];
        st.caption += ' Only one number in the array changed, yet ' + g.length + ' elements now share a group.';
      }
    });
    L.pairFigure(fig, { steps: steps, label: 'Unions grow trees', showRank: false, legend: LEG.link, baseStepMs: 1400, controlsLabel: 'Forest and array controls' });
  }

  /* ================================================================== find */
  var START = [1, 2, 3, 3, 3, 3, 6, 7];   // 0 -> 1 -> 2 -> 3 (root), 4 -> 3, 5 -> 3, 6 and 7 alone
  function findFigure(fig) {
    var steps = UF.trace(8, finds([0, 5, 7]), { byRank: false, compress: 'none', parent: START });
    var f = L.pairFigure(fig, { steps: steps, label: 'find walks up to the root', showRank: false, legend: LEG.plain, baseStepMs: 1100, controlsLabel: 'find controls' });
    f.player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'hop' && s.op === 0; }); }, function (c) {
      var n = c.steps.filter(function (s) { return s.kind === 'hop' && s.op === c.step.op; }).length;
      return {
        question: '<b>find(0)</b> is about to climb from 0. Look at the parent array: how many hops will it take to reach the root?',
        options: [String(n - 1), String(n), String(n + 1)], answer: 1,
        explain: [
          'One short: count the pointers you follow, not the elements you visit. 0 → 1 → 2 → 3 follows three pointers.',
          'Three hops: parent[0] = 1, parent[1] = 2, parent[2] = 3, and parent[3] = 3 says stop. The root itself costs no hop.',
          'One too many: the root points to itself, but you do not follow that pointer. You stop when you arrive.'
        ]
      };
    }, { id: 'uf-find-hops' });
  }

  /* ================================================================== union */
  function unionFigure(fig) {
    var steps = UF.trace(8, opsUnion([[0, 6], [4, 5]]), { byRank: false, compress: 'none', parent: START });
    L.pairFigure(fig, { steps: steps, label: 'union links two roots', showRank: false, legend: LEG.link.concat([{ state: 'compare', label: 'Two roots' }]), baseStepMs: 1100, controlsLabel: 'union controls' });
  }

  /* ================================================================== the raw-element bug */
  function bugFigure(fig) {
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Element' }, { state: 'found', label: 'Root' }, { state: 'swap', label: 'Pointer just written' }, { state: 'pivot', label: 'Cut off from 1 and 0' }]);
    var view = L.forestView(stage, { label: 'Linking raw elements against linking roots', pointers: false, showRank: false, minWidth: 0, nodeR: 20 });
    var before = { parent: [1, 2, 2, 3] };
    var bug = { parent: [1, 3, 2, 3], states: { 1: 'swap', 2: 'error', 1.5: 'default' }, edgeStates: { 1: 'swap' } };
    bug.states = { 1: 'swap', 2: 'error' };
    var right = { parent: [1, 2, 3, 3], states: { 3: 'found', 2: 'swap' }, edgeStates: { 2: 'swap' } };
    before.colors = L.groupColors([before.parent])[0];
    view.prepare([before, bug, right]);
    var texts = {
      before: '<b>Before.</b> 0 → 1 → 2 is one group with root 2, and 3 stands alone. Question: <code>union(1, 3)</code>. Element 1 is not a root; its root is 2.',
      bug: '<b>Bug: <code>parent[1] = 3</code>.</b> Element 1 was in the middle of a chain, so writing to it cuts the chain. Now 1 and 0 hang under 3, while 2 is stranded on its own: <b>2 and 1 are no longer connected</b>, though they were before. Union must never break a group.',
      right: '<b>Correct: <code>parent[find(1)] = find(3)</code>, that is <code>parent[2] = 3</code>.</b> Only the root 2 changes, so everyone below it (1 and 0) moves along. All four elements share the root 3.'
    };
    function show(v, dur) {
      var st = v === 'before' ? before : v === 'bug' ? bug : right;
      var withCols = Object.assign({}, st, { colors: L.groupColors([st.parent])[0] });
      if (v === 'bug') withCols.colors = withCols.colors;
      view.render(withCols, { duration: dur });
      cap.innerHTML = texts[v];
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Which version', value: 'before',
      options: [{ value: 'before', label: 'Before union(1, 3)' }, { value: 'bug', label: 'Link the elements (bug)' }, { value: 'right', label: 'Link the roots (correct)' }],
      onChange: function (v) { show(v, 700); }
    });
    show('before', 0);
  }

  /* ================================================================== the chain */
  function chainFigure(fig) {
    var ops = opsUnion([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]).concat(finds([0]));
    var steps = UF.trace(7, ops, { byRank: false, compress: 'none', quick: true });
    L.pairFigure(fig, { steps: steps, label: 'A chain built by naive unions', showRank: false, legend: LEG.plain, baseStepMs: 1000, controlsLabel: 'Chain controls' });
  }

  /* ================================================================== union by rank */
  function rankFigure(fig) {
    var ops = opsUnion([[0, 1], [2, 3], [1, 3], [4, 5], [5, 3], [6, 7], [3, 7]]);
    var steps = UF.trace(8, ops, { byRank: true, compress: 'none', quick: true });
    var f = L.pairFigure(fig, { steps: steps, label: 'Union by rank', showRank: true, legend: LEG.rank, baseStepMs: 1500, controlsLabel: 'Union by rank controls' });
    f.player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'link' && s.op === 4; }); }, function () {
      return {
        question: 'Root <b>5</b> has rank 1 and root <b>3</b> has rank 2. <code>union(5, 3)</code> must link them. Which root ends up on top?',
        options: ['5 (rank 1)', '3 (rank 2)', 'Either: ranks do not matter'], answer: 1,
        explain: [
          'That would put the taller tree under the shorter one, and every element of the rank-2 tree would get one level deeper.',
          'Right. The shorter tree, rooted at 5, goes under the taller root 3. Its elements sink one level, but the taller tree does not grow, so rank[3] stays 2.',
          'Either choice keeps the groups correct, but only one keeps the trees short. Rank exists to make exactly this decision.'
        ]
      };
    }, { id: 'uf-rank-root' });
  }

  function binomialFigure(fig) {
    var ops = UF.workload('binomial', 16, V.rng(1)).filter(function (o) { return o.type === 'union'; });
    var steps = UF.trace(16, ops, { byRank: true, compress: 'none', quick: true });
    var count = 0, sizes = [8, 4, 2, 1], round = 0, inRound = 0;
    steps.forEach(function (st) {
      if (st.kind !== 'link') return;
      if (inRound === sizes[round]) { round++; inRound = 0; }
      inRound++;
      st.caption = '<b>Round ' + (round + 1) + ' of 4.</b> ' + st.caption + ' Tallest tree so far: ' + st.counters.height + '.';
    });
    L.pairFigure(fig, { steps: steps, label: 'Merging equal-rank trees in rounds', showRank: true, legend: LEG.rank, baseStepMs: 1000, minWidth: 520, controlsLabel: 'Binomial controls' });
  }

  /* ================================================================== path compression */
  var CHAIN8 = [1, 2, 3, 4, 5, 6, 7, 7];
  function compressFigure(fig) {
    var mode = 'full';
    function make(m) { return UF.trace(8, finds([0, 0]), { byRank: false, compress: m, parent: CHAIN8 }); }
    var f = L.pairFigure(fig, {
      steps: make(mode), label: 'Path compression', showRank: false, baseStepMs: 1000, controlsLabel: 'Compression controls',
      legend: [{ state: 'default', shape: 'outline', label: 'Element' }, { state: 'active', label: 'Climbing' }, { state: 'path', label: 'Climbed past' }, { state: 'found', label: 'Root' }, { state: 'swap', label: 'Pointer re-pointed' }]
    });
    f.player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'repoint' && s.op === 0; }); }, function (c) {
      if (c.step.parent[0] !== 7 && c.steps.every(function (s) { return s.kind !== 'repoint' || s.line !== 'frepoint'; })) return null;
      return {
        question: 'The find just reached the root <b>7</b>. Now path compression walks back over the path. To what will <b>parent[0]</b> be set?',
        options: ['1 (it stays)', '7 (the root)', '2 (the grandparent)'], answer: 1,
        explain: [
          'Nothing is saved that way: the next find(0) would climb all seven links again.',
          'Right. The walk just proved that 7 is the root above 0, so 0 can point straight at it. The next find(0) is a single hop.',
          'That is path halving, which points at the grandparent. Full compression goes all the way to the root.'
        ]
      };
    }, { id: 'uf-compress-target' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Compression', value: 'full',
      options: [{ value: 'full', label: 'Full compression' }, { value: 'halving', label: 'Path halving' }, { value: 'none', label: 'None' }],
      onChange: function (m) { mode = m; f.setSteps(make(m)); }
    });
  }

  V.ready(function () {
    L.lazy('#mini-captain', captainMinis);
    L.lazy('#fig-array', arrayFigure);
    L.lazy('#fig-find', findFigure);
    L.lazy('#fig-union', unionFigure);
    L.lazy('#fig-bug', bugFigure);
    L.lazy('#fig-chain', chainFigure);
    L.lazy('#fig-rank', rankFigure);
    L.lazy('#fig-binomial', binomialFigure);
    L.lazy('#fig-compress', compressFigure);
  });
  L.START = START;
}());
