/* Lesson 33 · Backtracking — page wiring: hero, problem, intuition, mechanism figures, flowchart, cost, variations,
   checks and summary. The labs live in 33-backtracking-labs.js, the board/Sudoku views in 33-backtracking-views.js,
   and the pure step generators in js/algos/33-backtracking.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, $ = V.$;
  var A = V.algos['33-backtracking'], B = V.bt33;
  var fmt = A.fmtInt;

  function lazy(el, fn) {   // run fn once, when the figure first approaches the viewport
    var done = false, off = V.onVisible(el, function (vis) { if (vis && !done) { done = true; off && off(); fn(); } }, { threshold: 0.01 });
  }
  function figEl(id) { return $('#' + id); }

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = $('#teaser');
    if (!stage) return;
    var gen = A.queens(6);
    var steps = gen.steps.filter(function (st) { return st.kind !== 'conflict'; }).map(function (st) {
      return Object.assign({}, st, { hud: 'queens ' + st.cols.length + ' / 6 · backtracks ' + st.counters.backtracks });
    });
    var view = B.boardView(stage, { cell: 44, label: 'Chessboard' });
    V.teaser(stage, {
      steps: steps, stepMs: 300, holdMs: 2200,
      render: function (st, ctx) {
        view.render({ n: 6, pieces: st.cols.map(function (c, r) { return [r, c]; }), row: st.kind === 'solution' ? null : st.row, solved: st.kind === 'solution', hud: st.hud,
          cand: st.kind === 'place' ? { r: st.row, c: st.col, state: 'ok' } : null }, { duration: ctx.duration });
      }
    });
  }

  /* ================================================================== problem: place queens by hand */
  function handFigure() {
    var fig = figEl('fig-hand'), stage = fig.querySelector('[data-stage]');
    var n = 6, pieces = [], shade = true;
    var status = fig.querySelector('[data-status]');
    var view = B.boardView(stage, { cell: 58, label: 'Six by six board: click squares to place or remove queens', onCell: toggle });
    function toggle(r, c) {
      var k = pieces.findIndex(function (p) { return p[0] === r && p[1] === c; });
      if (k >= 0) pieces.splice(k, 1); else pieces.push([r, c]);
      draw(250);
    }
    function draw(d) {
      var pairs = A.pairsAttacking(pieces), marks = {};
      pairs.forEach(function (pr) { marks[pr[0]] = pieces[pr[0]]; marks[pr[1]] = pieces[pr[1]]; });
      view.render({ n: n, pieces: pieces, shade: shade, pairs: pairs.map(function (pr) { return [pieces[pr[0]], pieces[pr[1]]]; }), mark: Object.keys(marks).map(function (k) { return marks[k]; }),
        solved: pieces.length === n && !pairs.length }, { duration: d });
      var solved = pieces.length === n && !pairs.length;
      status.innerHTML = '<b>' + pieces.length + '</b> of ' + n + ' queens · <b>' + pairs.length + '</b> clash' + (pairs.length === 1 ? '' : 'es') + (solved ? ' · <b class="bt-win">Solved!</b>' : (pieces.length === n ? ' · not yet, keep moving them' : ''));
    }
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Queen' }, { state: 'error', label: 'Attacked square / clash' }, { state: 'found', label: 'Solved' }]);
    fig.querySelector('[data-clear]').addEventListener('click', function () { pieces = []; draw(200); });
    V.toggle(fig.querySelector('[data-shade]'), { label: 'Show attacked squares', checked: true, onChange: function (on) { shade = on; draw(0); } });
    draw(0);
  }

  function quizBoard() {
    var fig = figEl('fig-quizboard'), stage = fig.querySelector('[data-stage]');
    var view = B.boardView(stage, { n: 4, cell: 62, hitIds: true, label: 'Four by four board with queens at row 0 column 1 and row 1 column 3' });
    view.render({ n: 4, pieces: [[0, 1], [1, 3]], row: 2, shade: false }, { duration: 0 });
    V.clickQuiz(stage, {
      el: '#quiz-click', question: 'Two queens are placed. Click the <b>only safe square in row 2</b>.', answer: '2,0',
      check: function (id) {
        var p = id.split(',').map(Number), r = p[0], c = p[1];
        if (r !== 2) return { correct: false, message: 'Look at row 2, the row with the highlighted band.' };
        if (id === '2,0') return true;
        var a = A.attackerOf([1, 3], 2, c);
        return { correct: false, message: 'Column ' + c + ' is attacked by the queen at row ' + a.r + ', column ' + a.c + (a.kind === 'column' ? ' (same column).' : ' (same diagonal).') + ' Only one square in row 2 is free.' };
      },
      right: 'Column 0 is the only free square: columns 1 and 3 are taken, and column 2 is on the diagonal of the queen at row 1, column 3. Checking a partial placement means asking this question for every square of the next row.'
    });
  }

  /* ================================================================== intuition: the maze of forks */
  function mazeFigure() {
    var fig = figEl('fig-maze'), stage = fig.querySelector('[data-stage]');
    var gen = A.mazeWalk();
    var view = V.views.tree(stage, { label: 'A maze drawn as a tree of forks', nodeSize: 34, levelHeight: 58, gap: 0.5 });
    function toState(st) {
      var kids = {};
      st.nodes.forEach(function (n) { if (n.parent) (kids[n.parent] = kids[n.parent] || []).push(n.id); });
      var edges = [];
      for (var i = 1; i < st.path.length; i++) edges.push({ from: st.path[i - 1], to: st.path[i], state: st.kind === 'exit' ? 'found' : 'active' });
      return { root: 'f', nodes: st.nodes.map(function (n) { return { id: n.id, label: n.goal ? 'exit' : (n.kids.length ? '' : ''), children: kids[n.id] || [], state: n.state }; }),
        edges: edges, pointers: st.at ? [{ name: 'you', target: st.at, state: st.kind === 'dead' ? 'error' : 'active' }] : [] };
    }
    view.prepare(gen.steps.map(toState));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'You are here' }, { state: 'frontier', label: 'Fork on your route' }, { state: 'muted', label: 'Dead end, chalked off' }, { state: 'done', label: 'Fork fully explored' }, { state: 'found', label: 'Exit' }]);
    V.player({
      root: fig, steps: gen.steps, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { visited: 'Corridors entered', deadEnds: 'Dead ends', backtracks: 'Steps back' }, counterStates: { deadEnds: 'error' },
      render: function (st, ctx) { view.render(toState(st), { duration: ctx.duration }); }, baseStepMs: 1100, label: 'Maze walk controls'
    });
  }

  function templateMinis() {
    var row = $('#mini-template');
    var frames = [
      { pieces: [[0, 1]], cand: { r: 0, c: 1, state: 'ok' }, row: 0, title: 'Choose', text: 'Put a queen on a safe square. The state changes.' },
      { pieces: [[0, 1], [1, 3]], cand: { r: 1, c: 3, state: 'ok' }, row: 2, title: 'Explore', text: 'Recurse: solve the smaller problem that is left, rows 2 and 3.' },
      { pieces: [[0, 1]], cand: null, row: 1, title: 'Unchoose', text: 'It went nowhere. Lift the queen off and restore the state exactly.' }
    ];
    frames.forEach(function (f) {
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, B.miniBoard(4, f.pieces, { cell: 40, cand: f.cand, row: f.row, label: f.title + ' step on a four by four board' })),
        h('figcaption', { html: '<b>' + f.title + '.</b> ' + f.text })));
    });
  }

  /* ================================================================== mechanism: the state-space tree explorer */
  function explorer() {
    var fig = figEl('fig-explorer');
    var T = A.queensTrees(4), last = T.steps[T.steps.length - 1];
    var list = last.pruned.map(function (p) { return { id: p.id, parent: p.parent, label: p.label, state: p.badge ? 'error' : 'done', badge: p.badge }; });
    var view = V.views.tree(fig.querySelector('[data-tree]'), { label: 'State-space tree of four queens. Click a node.', nodeSize: 30, levelHeight: 46, gap: 0.25, onNodeClick: null });
    var boardHost = fig.querySelector('[data-board]'), text = fig.querySelector('[data-text]');
    var board = B.boardView(boardHost, { cell: 46, label: 'Board for the selected tree node' });
    var sel = 'r1302';
    function pick(id) {
      sel = id;
      var digits = id.slice(1).split('').map(Number), node = list.find(function (n) { return n.id === id; });
      var cut = node.state === 'error', cols = cut ? digits.slice(0, -1) : digits, row = digits.length - 1;
      var st = { n: 4, pieces: cols.map(function (c, r) { return [r, c]; }), shade: true, row: cut ? row : (digits.length < 4 ? digits.length : null), solved: !cut && digits.length === 4 };
      if (cut) { st.cand = { r: row, c: digits[row], state: 'bad' }; st.attacker = A.attackerOf(cols, row, digits[row]); st.mark = st.attacker ? [[st.attacker.r, st.attacker.c]] : []; }
      board.render(st, { duration: 250 });
      var msg;
      if (!id.slice(1)) msg = '<b>The root</b>: an empty board. Nothing is decided yet.';
      else if (cut) msg = '<b>Pruned.</b> Row ' + row + ', column ' + digits[row] + ' is attacked by the queen at row ' + st.attacker.r + ', column ' + st.attacker.c + '. This node is never expanded, so the ' + node.badge.slice(1) + ' nodes that would hang below it in the brute-force tree are never built.';
      else if (digits.length === 4) msg = '<b>A solution.</b> Four queens, columns ' + digits.join(', ') + ', and no clash. A leaf at full depth.';
      else {
        var kids = list.filter(function (n) { return n.parent === id; }), safe = kids.filter(function (n) { return n.state === 'done'; }).length;
        msg = '<b>A partial solution</b> with ' + digits.length + ' queen' + (digits.length === 1 ? '' : 's') + '. Of the 4 squares in row ' + digits.length + ', ' + safe + ' are safe' + (safe === 0 ? ': a <b>dead end</b>, so the search must backtrack from here.' : ', so this node has ' + safe + ' child' + (safe === 1 ? '' : 'ren') + ' (red leaves are the rejected squares).');
      }
      text.innerHTML = msg;
      view.render(B.toTree(list, { pathEdges: false }), { duration: 0 });
      view.render(Object.assign(B.toTree(list, { pathEdges: false }), { pointers: [{ name: 'you', target: id, state: 'active' }] }), { duration: 250 });
    }
    view.prepare([B.toTree(list, { pathEdges: false })]);
    view.on('click', function (e) { pick(e.id); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Safe placement (a node)' }, { state: 'error', label: 'Rejected square (pruned, with the size of what it saves)' }, { state: 'active', label: 'Selected' }]);
    pick(sel);
    return { list: list };
  }

  /* ================================================================== mechanism: three constraint sets */
  function setsFigure() {
    var fig = figEl('fig-sets'), stage = fig.querySelector('[data-board]'), panel = fig.querySelector('[data-panel]');
    var cols = [1, 3, 5], n = 6, probe = { r: 4, c: 0 };
    var view = B.boardView(stage, { cell: 50, label: 'Six by six board with three queens; click a square in rows 3 to 5', onCell: function (r, c) { if (r < cols.length) { note(true); return; } probe = { r: r, c: c }; draw(200); } });
    var d1 = cols.map(function (c, r) { return r + c; }), d2 = cols.map(function (c, r) { return r - c; });
    var noteEl = fig.querySelector('[data-note]');
    function note(on) { noteEl.textContent = on ? 'Rows 0 to 2 already hold queens. Pick a square in rows 3 to 5.' : ''; }
    function list(a) { return '{' + a.map(function (v) { return v < 0 ? '−' + Math.abs(v) : v; }).join(', ') + '}'; }
    function draw(d) {
      note(false);
      var r = probe.r, c = probe.c, keyD1 = r + c, keyD2 = r - c;
      var inCol = cols.indexOf(c) >= 0, inD1 = d1.indexOf(keyD1) >= 0, inD2 = d2.indexOf(keyD2) >= 0, bad = inCol || inD1 || inD2;
      var att = A.attackerOf(cols, r, c);
      view.render({ n: n, pieces: cols.map(function (cc, rr) { return [rr, cc]; }), probe: probe, cand: { r: r, c: c, state: bad ? 'bad' : 'ok' }, attacker: att, mark: att ? [[att.r, att.c]] : [], shade: false, row: r }, { duration: d });
      function row(cls, label, key, set, hit) {
        return '<div class="bt-key ' + cls + (hit ? ' is-hit' : '') + '"><span class="bt-key__name">' + label + '</span><span class="bt-key__test"><code>' + key + ' ∈ ' + set + '</code></span><span class="bt-key__res">' + (hit ? 'yes: attacked' : 'no') + '</span></div>';
      }
      panel.innerHTML = '<p class="bt-key__cell">Testing <b>row ' + r + ', column ' + c + '</b></p>' +
        row('p0', 'column', 'col = ' + c, 'cols ' + list(cols), inCol) +
        row('p1', '“/” diagonal', 'row + col = ' + keyD1, 'd1 ' + list(d1), inD1) +
        row('p2', '“\\” diagonal', 'row − col = ' + (keyD2 < 0 ? '−' + Math.abs(keyD2) : keyD2), 'd2 ' + list(d2), inD2) +
        '<p class="bt-key__verdict ' + (bad ? 'is-bad' : 'is-ok') + '">' + (bad ? 'At least one lookup hits: the square is attacked, so prune it.' : 'Three misses: the square is safe, so choose it.') + '</p>';
    }
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Column' }, { state: 'compare', label: '“/” diagonal (row + col)' }, { state: 'pivot', label: '“\\” diagonal (row − col)' }, { state: 'error', label: 'Attacking queen' }]);
    draw(0);
  }

  /* ================================================================== cost: two trees, level by level */
  function treesFigure() {
    var fig = figEl('fig-trees');
    var T = A.queensTrees(4);
    var full = V.views.tree(fig.querySelector('[data-full]'), { label: 'Brute-force tree for four queens, every column in every row', nodeSize: 14, minNodeSize: 2.5, levelHeight: 30, gap: 0.12, shape: 'circle' });
    var pruned = V.views.tree(fig.querySelector('[data-pruned]'), { label: 'Backtracking tree for four queens, safe squares only', nodeSize: 22, minNodeSize: 6, levelHeight: 46, gap: 0.55 });
    var fullStates = T.steps.map(function (st) { return B.toTree(st.full, { pathEdges: false }); });
    var prunedStates = T.steps.map(function (st) { return B.toTree(st.pruned, { pathEdges: false }); });
    full.prepare(fullStates); pruned.prepare(prunedStates);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Explored' }, { state: 'error', label: 'Rejected square (cut point)' }, { state: 'muted', label: 'Never built by backtracking' }, { state: 'done', label: 'Kept at the end' }]);
    var player = V.player({
      root: fig, steps: T.steps, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { full: 'Brute-force nodes', pruned: 'Backtracking nodes', cut: 'Nodes cut off' }, counterStates: { pruned: 'done', cut: 'error' },
      render: function (st, ctx) {
        var i = T.steps.indexOf(st);
        full.render(fullStates[i], { duration: ctx.duration }); pruned.render(prunedStates[i], { duration: ctx.duration });
      }, baseStepMs: 1500, label: 'Brute force versus backtracking controls'
    });
    return player;
  }

  /* ================================================================== cost: nodes vs n */
  function costChart() {
    var fig = figEl('fig-chart'), stage = fig.querySelector('[data-stage]');
    var chart = V.views.chart(stage, { type: 'line', label: 'Work needed to solve N-Queens against board size, log scale', height: 340 });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'muted', shape: 'dash', label: 'Brute force' }, { state: 'done', shape: 'line', label: 'Backtracking' }]);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { rows: 'One queen per row: nⁿ boards', perms: 'n! boards', bt: 'Backtracking, all solutions: nodes', first: 'Backtracking, first solution: nodes', sols: 'Solutions' }, states: { bt: 'done', first: 'done' } });
    var data = null, n = 8, log = true;
    function compute() {
      var rows = [];
      for (var k = 1; k <= 12; k++) { var c = A.queensCount(k, true), b = A.bruteForce(k); rows.push({ n: k, choose: b.choose, rows: b.rows, perms: b.perms, bt: c.nodes, first: c.firstNodes || c.nodes, sols: c.solutions }); }
      return rows;
    }
    function pts(key) { return data.map(function (r) { return [r.n, r[key]]; }); }
    function draw(d) {
      chart.render({
        x: { label: 'board size n', min: 1, max: 12, ticks: 11 },
        y: log ? { label: 'boards checked or nodes visited (log scale)', scale: 'log', min: 1, max: 1e17 } : { label: 'boards checked or nodes visited', min: 0, max: 40000 },
        series: [
          { id: 'choose', label: 'any n squares', points: pts('choose'), state: 'muted', dashed: true },
          { id: 'rows', label: 'one per row: nⁿ', points: pts('rows'), color: 1, dashed: true },
          { id: 'perms', label: 'one per row and column: n!', points: pts('perms'), color: 3, dashed: true },
          { id: 'bt', label: 'backtracking, all solutions', points: pts('bt'), state: 'done' },
          { id: 'first', label: 'backtracking, first solution', points: pts('first'), state: 'found' }
        ],
        highlight: { series: 'bt', x: n, label: fmt(data[n - 1].bt) + ' nodes' }
      }, { duration: d });
      var r = data[n - 1];
      stats.update({ rows: fmt(r.rows), perms: fmt(r.perms), bt: fmt(r.bt), first: fmt(r.first), sols: fmt(r.sols) });
    }
    lazy(fig, function () {
      data = compute();
      V.segmented(fig.querySelector('[data-seg]'), { label: 'Vertical axis', value: 'log', options: [{ value: 'log', label: 'Log scale' }, { value: 'linear', label: 'Linear scale' }], onChange: function (v) { log = v === 'log'; draw(900); } });
      V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: 12, value: n, onInput: function (v) { n = v; draw(150); } });
      draw(900);
    });
  }

  /* ================================================================== Sudoku race */
  function sudokuRace(labCfgGetter) {
    var fig = figEl('fig-race'), stage = fig.querySelector('[data-stage]');
    var CAP = 1e6, MAXLOG = 6.4;
    function bar(label, state) {
      var fill = h('div', { class: 'bt-bar__fill', 'data-state': state }), val = h('span', { class: 'bt-bar__val' });
      return { fill: fill, val: val, row: h('div', { class: 'bt-bar' }, h('span', { class: 'bt-bar__label' }, label), h('div', { class: 'bt-bar__track' }, fill), val) };
    }
    var naive = bar('Naive order', 'error'), mrv = bar('Most constrained first', 'found');
    var ticks = h('div', { class: 'bt-bar bt-bar--ticks', 'aria-hidden': 'true' }, h('span', { class: 'bt-bar__label' }),
      h('div', { class: 'bt-bar__track bt-bar__track--ticks' }, [[0, '1'], [1, '10'], [2, '100'], [3, '1k'], [4, '10k'], [5, '100k'], [6, '1M']].map(function (t) {
        return h('span', { class: 'bt-tick', style: { left: (t[0] / MAXLOG * 100) + '%' } }, t[1]);
      })), h('span', { class: 'bt-bar__val' }));
    stage.appendChild(h('div', { class: 'bt-bars' }, naive.row, mrv.row, ticks));
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { ratio: 'Naive ÷ constrained', bt: 'Erased by constrained', bn: 'Erased by naive' }, states: { ratio: 'compare' } });
    var current = 'medium';
    function run(key) {
      current = key;
      var grid = key === 'lab' ? labCfgGetter().grid : A.textToGrid(A.PUZZLES[key].text);
      var a = A.sudokuCount(grid, 'naive', CAP), b = A.sudokuCount(grid, 'mrv', CAP);
      function set(x, r) {
        var v = Math.max(1, r.attempts);
        x.fill.style.width = Math.max(1.2, Math.log10(v) / MAXLOG * 100) + '%';
        x.val.textContent = (r.aborted ? 'gave up after ' : '') + fmt(r.attempts) + ' digits placed';
      }
      set(naive, a); set(mrv, b);
      stats.update({ ratio: a.aborted ? '> ' + fmt(Math.floor(a.attempts / Math.max(1, b.attempts))) + '×' : (b.attempts ? (a.attempts / b.attempts).toFixed(a.attempts / b.attempts >= 10 ? 0 : 1) + '×' : '—'), bt: fmt(b.backtracks), bn: (a.aborted ? '> ' : '') + fmt(a.backtracks) });
    }
    var seg = V.segmented(fig.querySelector('[data-seg]'), { label: 'Puzzle', value: 'medium', options: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard for naive' }, { value: 'lab', label: 'Puzzle in the lab' }], onChange: run });
    lazy(fig, function () { run('medium'); });
    return { rerun: function () { if (current === 'lab') run('lab'); } };
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    var perm = A.permutationsTrace(['a', 'b', 'c']), comb = A.combinationsTrace(['a', 'b', 'c', 'd'], 3);
    function staticTree(host, list, o) {
      var view = V.views.tree(host, Object.assign({ nodeSize: 26, minNodeSize: 8, levelHeight: 40, gap: 0.2, label: 'Recursion tree' }, o || {}));
      view.render(B.toTree(list, { pathEdges: false }), { duration: 0 });
    }
    staticTree($('[data-mini="swap"]'), perm.steps[perm.steps.length - 1].tree, { label: 'Permutation tree of a b c' });
    staticTree($('[data-mini="bound"]'), comb.steps[comb.steps.length - 1].tree, { label: 'Combination tree with pruned calls in grey' });
    $('[data-mini="dups"]').appendChild(h('div', { class: 'bt-dups' },
      h('div', { class: 'bt-dups__row' }, h('span', {}, 'sorted'), ['a', 'a', 'b'].map(function (x, i) { return h('b', { class: 'bt-tile' }, x); })),
      h('div', { class: 'bt-dups__row' }, h('span', {}, 'skip if'), h('code', {}, 'i > start && items[i] === items[i−1]')),
      h('p', { class: 'muted' }, 'Sorted duplicates sit side by side, so a repeat at the same level is easy to spot.')));
    var blocks = {
      swap: 'function permute(a, i = 0, out = []) {\n  if (i === a.length) { out.push([...a]); return out; }\n  for (let j = i; j < a.length; j++) {\n    [a[i], a[j]] = [a[j], a[i]];   // choose: swap item j into place i\n    permute(a, i + 1, out);        // explore\n    [a[i], a[j]] = [a[j], a[i]];   // unchoose: swap back\n  }\n  return out;\n}',
      bound: 'function subsetSum(nums, target) {          // nums sorted, all positive\n  const out = [], path = [];\n  function go(start, sum) {\n    if (sum === target) { out.push([...path]); return; }\n    for (let i = start; i < nums.length; i++) {\n      if (sum + nums[i] > target) break;      // bound: sorted, so nothing later fits either\n      path.push(nums[i]);\n      go(i + 1, sum + nums[i]);\n      path.pop();\n    }\n  }\n  go(0, 0);\n  return out;\n}',
      dups: 'function uniqueSubsets(nums) {\n  nums.sort((a, b) => a - b);\n  const out = [], path = [];\n  function go(start) {\n    out.push([...path]);\n    for (let i = start; i < nums.length; i++) {\n      if (i > start && nums[i] === nums[i - 1]) continue;   // same value at this level: skip\n      path.push(nums[i]);\n      go(i + 1);\n      path.pop();\n    }\n  }\n  go(0);\n  return out;\n}'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock($('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
  }

  /* ================================================================== checks */
  function checks() {
    var quizHost = $('#fig-safe-board .fig__stage');
    quizHost.appendChild(B.miniBoard(5, [[0, 1], [1, 3], [2, 2]], { cell: 46, shade: false, label: 'Five by five board with queens at row 0 column 1, row 1 column 3 and row 2 column 2' }));
    V.quiz('#quiz-safe', {
      question: 'Three queens stand at (row 0, column 1), (row 1, column 3) and (row 2, column 2). Is this partial placement safe?',
      options: ['Yes: no two queens attack each other', 'No: two queens share a column', 'No: two queens share a diagonal', 'It depends on where the next queen goes'],
      answer: 2,
      explain: ['Check every pair, not just neighbours. The queens at (1, 3) and (2, 2) touch corners: one row down, one column left. That is a diagonal.',
        'The columns are 1, 3 and 2, all different, so no column is shared.',
        'Correct. (1, 3) and (2, 2) both have row + col = 4, the same “/” diagonal, so they attack. A placement with a clash is dead whatever comes next.',
        'Safety of what is already placed does not depend on future queens. A clash now stays a clash, so the search can prune immediately.'],
      id: 'safe-partial'
    });
    V.quiz('#quiz-subsets', {
      question: 'How many subsets does a set of <em>n</em> = 4 items have, counting the empty set and the full set?', options: ['8', '16', '4', '24'], answer: 1,
      explain: ['That is 2³. There are four items, so four doublings.', 'Each of the 4 items is independently in or out: 2 × 2 × 2 × 2 = 16 leaves in the include/exclude tree.', 'That is only the number of single-item subsets.', '24 is 4!, the number of permutations of 4 items, not subsets.'],
      id: 'subsets-count'
    });
    V.quiz('#quiz-pruning', {
      question: 'What does <b>pruning</b> change about a backtracking search?', options: ['It makes each step cheaper to run', 'It finds solutions that brute force would miss', 'It skips whole subtrees that cannot contain a solution', 'It changes the order in which solutions appear'],
      answer: 2, explain: ['Steps cost about the same; there are simply far fewer of them.', 'Both find exactly the same solutions. Pruning never discards a valid one.', 'Right: one rejected choice removes every node below it, which is why the tree shrinks so much.', 'The order comes from the order of choices, not from pruning.'],
      id: 'pruning-meaning'
    });
    V.quiz('#quiz-unchoose', {
      question: 'Which bugs come from <b>forgetting to unchoose</b>? Pick all that apply.', options: ['A later branch starts with items from an earlier branch', 'Results contain too many items', 'The search visits fewer nodes than it should', 'Two queens share a column in a “solution”'],
      answer: [0, 1, 2], explain: 'Without unchoose the state keeps every past choice. Later branches inherit stale items, and result lists grow too long. A stale used-set also blocks choices that are really free, so the search prunes too much: it visits fewer nodes and can miss real solutions. It never puts two queens in one column. A stale column mark blocks that column instead.',
      id: 'forgot-unchoose'
    });
  }

  /* ================================================================== summary */
  function summary() {
    var grid = $('#summary-card .summary__grid');
    var T = A.queensTrees(3);
    var tiles = [
      { viz: B.miniBoard(4, [[0, 1], [1, 3]], { cell: 30, cand: { r: 1, c: 3, state: 'ok' }, row: 2 }), label: 'Choose, explore, unchoose', text: 'Change the state, recurse, restore it exactly.' },
      { viz: B.miniBoard(4, [[0, 1], [1, 3], [2, 0], [3, 2]], { cell: 30, solved: true }), label: 'Prune early', text: 'Reject a partial solution the moment it breaks a rule.' },
      { viz: B.miniSudoku(A.textToGrid(A.PUZZLES.medium.text), { focus: 4, count: 2 }), label: 'Most constrained first', text: 'Branch on the cell with the fewest options.' },
      { viz: h('div', { class: 'bt-sumtree' }, [1, 2, 4, 8, 16].map(function (v, i) { return h('span', { class: 'bt-sumtree__bar', style: { height: (10 + i * 12) + 'px' } }, i === 4 ? '2ⁿ' : ''); })), label: 'Still exponential', text: 'Worst case is the whole tree: 2ⁿ subsets, n! orders.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.viz), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== flowchart */
  function flowchart() {
    var fig = figEl('fig-flow');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the N-Queens lab' }]);
    return V.views.flowchart(fig.querySelector('[data-stage]'), {
      nodes: [
        { id: 'start', type: 'start', text: 'solve(state)', col: 0, row: 0 },
        { id: 'complete', type: 'decision', text: 'state complete?', col: 0, row: 1 },
        { id: 'record', text: 'record the solution', col: 1, row: 1 },
        { id: 'more', type: 'decision', text: 'a choice left?', col: 0, row: 2 },
        { id: 'ret', type: 'end', text: 'return', col: 1, row: 2 },
        { id: 'valid', type: 'decision', text: 'choice valid?', col: 0, row: 3 },
        { id: 'skip', text: 'skip it (prune)', col: 1, row: 3 },
        { id: 'choose', text: 'choose: add to state', col: 0, row: 4 },
        { id: 'recurse', text: 'explore: solve(state)', col: 0, row: 5 },
        { id: 'unchoose', text: 'unchoose: remove from state', col: 0, row: 6 }
      ],
      edges: [
        { from: 'start', to: 'complete' }, { from: 'complete', to: 'record', label: 'yes' }, { from: 'complete', to: 'more', label: 'no' },
        { from: 'record', to: 'ret' }, { from: 'more', to: 'ret', label: 'no' }, { from: 'more', to: 'valid', label: 'yes' },
        { from: 'valid', to: 'skip', label: 'no' }, { from: 'valid', to: 'choose', label: 'yes' }, { from: 'skip', to: 'more' },
        { from: 'choose', to: 'recurse' }, { from: 'recurse', to: 'unchoose' }, { from: 'unchoose', to: 'more' }
      ]
    }, { label: 'Backtracking template flowchart' });
  }

  V.ready(function () {
    heroTeaser();
    handFigure();
    quizBoard();
    mazeFigure();
    templateMinis();
    explorer();
    setsFigure();
    var flow = flowchart();
    B.queensLab(flow);
    B.chooseLab();
    var sud = B.sudokuLab();
    var race = sudokuRace(function () { return sud.cfg; });
    B.onSudokuLoaded = function () { race.rerun(); };
    B.wordLab();
    treesFigure();
    costChart();
    variations();
    checks();
    summary();
  });
}());
