/* Lesson 33 · Backtracking — the four code-synced labs (N-Queens, choose sets, Sudoku, word search)
   and the code listings they share. Registered helpers live on VDSA.bt33. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A = V.algos['33-backtracking'], B = V.bt33;
  var $ = V.$;

  /* ================================================================== code listings (labels shared by every language) */
  var CODE = {};
  CODE.queens = {
    pseudo: [
      'function solve(row)                                  // @head',
      '  if row = n                                         // @done',
      '    record the solution; stop if we only want one    // @done',
      '  for col ← 0 to n − 1                               // @loop',
      '    if col ∈ cols or row+col ∈ d1 or row−col ∈ d2    // @check',
      '      skip this square                               // @check',
      '    add col, row+col, row−col to the sets            // @choose',
      '    solve(row + 1)                                   // @recurse',
      '    delete col, row+col, row−col from the sets       // @unchoose'
    ].join('\n'),
    js: [
      'function solveQueens(n, findAll) {',
      '  const cols = new Set(), d1 = new Set(), d2 = new Set();',
      '  const queens = [], solutions = [];',
      '  function solve(row) {                                  // @head',
      '    if (row === n) {                                     // @done',
      '      solutions.push([...queens]);                       // @done',
      '      return !findAll;                                   // @done',
      '    }',
      '    for (let col = 0; col < n; col++) {                  // @loop',
      '      if (cols.has(col) || d1.has(row + col) || d2.has(row - col))',
      '        continue;                                        // @check',
      '      cols.add(col); d1.add(row + col); d2.add(row - col);   // @choose',
      '      queens.push(col);                                  // @choose',
      '      if (solve(row + 1)) return true;                   // @recurse',
      '      queens.pop();                                      // @unchoose',
      '      cols.delete(col); d1.delete(row + col); d2.delete(row - col);   // @unchoose',
      '    }',
      '    return false;',
      '  }',
      '  solve(0);',
      '  return solutions;',
      '}'
    ].join('\n'),
    py: [
      'def solve_queens(n, find_all=False):',
      '    cols, d1, d2 = set(), set(), set()',
      '    queens, solutions = [], []',
      '    def solve(row):                                      # @head',
      '        if row == n:                                     # @done',
      '            solutions.append(queens[:])                  # @done',
      '            return not find_all                          # @done',
      '        for col in range(n):                             # @loop',
      '            if col in cols or row + col in d1 or row - col in d2:',
      '                continue                                 # @check',
      '            cols.add(col); d1.add(row + col); d2.add(row - col)   # @choose',
      '            queens.append(col)                           # @choose',
      '            if solve(row + 1): return True               # @recurse',
      '            queens.pop()                                 # @unchoose',
      '            cols.remove(col); d1.remove(row + col); d2.remove(row - col)   # @unchoose',
      '        return False',
      '    solve(0)',
      '    return solutions'
    ].join('\n')
  };
  CODE.subsets = {
    pseudo: [
      'function go(i)                                 // @head',
      '  if i = n: record a copy of path; return      // @leaf',
      '  push items[i] onto path                      // @include',
      '  go(i + 1)                                    // @include',
      '  pop path                                     // @unchoose',
      '  go(i + 1)                                    // @exclude'
    ].join('\n'),
    js: [
      'function subsets(items) {',
      '  const out = [], path = [];',
      '  function go(i) {                       // @head',
      '    if (i === items.length) {            // @leaf',
      '      out.push([...path]);               // @leaf',
      '      return;                            // @leaf',
      '    }',
      '    path.push(items[i]);                 // @include',
      '    go(i + 1);                           // @include',
      '    path.pop();                          // @unchoose',
      '    go(i + 1);                           // @exclude',
      '  }',
      '  go(0);',
      '  return out;',
      '}'
    ].join('\n'),
    py: [
      'def subsets(items):',
      '    out, path = [], []',
      '    def go(i):                           # @head',
      '        if i == len(items):              # @leaf',
      '            out.append(path[:])          # @leaf',
      '            return                       # @leaf',
      '        path.append(items[i])            # @include',
      '        go(i + 1)                        # @include',
      '        path.pop()                       # @unchoose',
      '        go(i + 1)                        # @exclude',
      '    go(0)',
      '    return out'
    ].join('\n')
  };
  CODE.permutations = {
    pseudo: [
      'function go()                                  // @head',
      '  if length(path) = n: record path; return     // @leaf',
      '  for i ← 0 to n − 1',
      '    if used[i]: skip                           // @skip',
      '    used[i] ← true; push items[i]              // @choose',
      '    go()                                       // @recurse',
      '    pop; used[i] ← false                       // @unchoose'
    ].join('\n'),
    js: [
      'function permutations(items) {',
      '  const n = items.length, out = [], path = [];',
      '  const used = new Array(n).fill(false);',
      '  function go() {                              // @head',
      '    if (path.length === n) {                   // @leaf',
      '      out.push([...path]);                     // @leaf',
      '      return;                                  // @leaf',
      '    }',
      '    for (let i = 0; i < n; i++) {',
      '      if (used[i]) continue;                   // @skip',
      '      used[i] = true; path.push(items[i]);     // @choose',
      '      go();                                    // @recurse',
      '      path.pop(); used[i] = false;             // @unchoose',
      '    }',
      '  }',
      '  go();',
      '  return out;',
      '}'
    ].join('\n'),
    py: [
      'def permutations(items):',
      '    n, out, path = len(items), [], []',
      '    used = [False] * n',
      '    def go():                                  # @head',
      '        if len(path) == n:                     # @leaf',
      '            out.append(path[:])                # @leaf',
      '            return                             # @leaf',
      '        for i in range(n):',
      '            if used[i]: continue               # @skip',
      '            used[i] = True; path.append(items[i])   # @choose',
      '            go()                               # @recurse',
      '            path.pop(); used[i] = False        # @unchoose',
      '    go()',
      '    return out'
    ].join('\n')
  };
  CODE.combinations = {
    pseudo: [
      'function go(start)                             // @head',
      '  if length(path) = k: record path; return     // @leaf',
      '  if n − start < k − length(path): return      // @prune',
      '  for i ← start to n − 1',
      '    push items[i]                              // @choose',
      '    go(i + 1)                                  // @recurse',
      '    pop                                        // @unchoose'
    ].join('\n'),
    js: [
      'function combinations(items, k) {',
      '  const n = items.length, out = [], path = [];',
      '  function go(start) {                                   // @head',
      '    if (path.length === k) {                             // @leaf',
      '      out.push([...path]);                               // @leaf',
      '      return;                                            // @leaf',
      '    }',
      '    if (n - start < k - path.length) return;             // @prune',
      '    for (let i = start; i < n; i++) {',
      '      path.push(items[i]);                               // @choose',
      '      go(i + 1);                                         // @recurse',
      '      path.pop();                                        // @unchoose',
      '    }',
      '  }',
      '  go(0);',
      '  return out;',
      '}'
    ].join('\n'),
    py: [
      'def combinations(items, k):',
      '    n, out, path = len(items), [], []',
      '    def go(start):                                       # @head',
      '        if len(path) == k:                               # @leaf',
      '            out.append(path[:])                          # @leaf',
      '            return                                       # @leaf',
      '        if n - start < k - len(path): return             # @prune',
      '        for i in range(start, n):',
      '            path.append(items[i])                        # @choose',
      '            go(i + 1)                                    # @recurse',
      '            path.pop()                                   # @unchoose',
      '    go(0)',
      '    return out'
    ].join('\n')
  };
  CODE.sudoku = {
    pseudo: [
      'function solve()                                      // @head',
      '  cell ← next empty cell (reading order, or fewest candidates)   // @pick',
      '  if no empty cell: return true                       // @done',
      '  options ← digits not in its row, column or box      // @pick',
      '  if options is empty: return false                   // @dead',
      '  for each digit d in options                         // @loop',
      '    grid[cell] ← d                                    // @choose',
      '    if solve(): return true                           // @recurse',
      '    grid[cell] ← 0                                    // @unchoose',
      '  return false'
    ].join('\n'),
    js: [
      'function solveSudoku(grid, mostConstrained) {',
      '  function solve() {                                  // @head',
      '    const cell = pickCell(grid, mostConstrained);     // @pick',
      '    if (cell === null) return true;                   // @done',
      '    const options = candidates(grid, cell);           // @pick',
      '    if (options.length === 0) return false;           // @dead',
      '    for (const d of options) {                        // @loop',
      '      grid[cell] = d;                                 // @choose',
      '      if (solve()) return true;                       // @recurse',
      '      grid[cell] = 0;                                 // @unchoose',
      '    }',
      '    return false;',
      '  }',
      '  return solve();',
      '}',
      'function candidates(g, i) {          // digits missing from row, column and box',
      '  const r = Math.floor(i / 9), c = i % 9, used = new Set();',
      '  for (let k = 0; k < 9; k++) {',
      '    used.add(g[r * 9 + k]); used.add(g[k * 9 + c]);',
      '    used.add(g[(r - r % 3 + Math.floor(k / 3)) * 9 + c - c % 3 + k % 3]);',
      '  }',
      '  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d));',
      '}',
      'function pickCell(g, mrv) {          // first empty cell, or the one with fewest candidates',
      '  let best = null, bestN = 10;',
      '  for (let i = 0; i < 81; i++) {',
      '    if (g[i] !== 0) continue;',
      '    if (!mrv) return i;',
      '    const n = candidates(g, i).length;',
      '    if (n < bestN) { best = i; bestN = n; }',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    py: [
      'def solve_sudoku(grid, most_constrained=True):',
      '    def solve():                                      # @head',
      '        cell = pick_cell(grid, most_constrained)      # @pick',
      '        if cell is None: return True                  # @done',
      '        options = candidates(grid, cell)              # @pick',
      '        if not options: return False                  # @dead',
      '        for d in options:                             # @loop',
      '            grid[cell] = d                            # @choose',
      '            if solve(): return True                   # @recurse',
      '            grid[cell] = 0                            # @unchoose',
      '        return False',
      '    return solve()',
      '',
      'def candidates(g, i):       # digits missing from row, column and box',
      '    r, c = divmod(i, 9)',
      '    used = set(g[r * 9 + k] for k in range(9)) | set(g[k * 9 + c] for k in range(9))',
      '    used |= {g[(r - r % 3 + a) * 9 + c - c % 3 + b] for a in range(3) for b in range(3)}',
      '    return [d for d in range(1, 10) if d not in used]',
      '',
      'def pick_cell(g, mrv):      # first empty cell, or the one with fewest candidates',
      '    empty = [i for i in range(81) if g[i] == 0]',
      '    if not empty: return None',
      '    return min(empty, key=lambda i: len(candidates(g, i))) if mrv else empty[0]'
    ].join('\n')
  };
  CODE.word = {
    pseudo: [
      'for each cell (r, c): if dfs(r, c, 0) return true    // @start',
      'function dfs(r, c, k)                                // @head',
      '  if off the grid, already used, or grid[r][c] ≠ word[k]   // @reject',
      '    return false                                     // @reject',
      '  if k = last letter: return true                    // @found',
      '  mark (r, c) as used                                // @choose',
      '  for each of the 4 neighbours                       // @recurse',
      '    if dfs(neighbour, k + 1): return true            // @recurse',
      '  mark (r, c) as free                                // @unchoose',
      '  return false'
    ].join('\n'),
    js: [
      'function exist(board, word) {',
      '  const R = board.length, C = board[0].length;',
      '  const used = board.map(row => row.map(() => false));',
      '  function dfs(r, c, k) {                                        // @head',
      '    if (r < 0 || c < 0 || r >= R || c >= C) return false;        // @reject',
      '    if (used[r][c] || board[r][c] !== word[k]) return false;     // @reject',
      '    if (k === word.length - 1) return true;                      // @found',
      '    used[r][c] = true;                                           // @choose',
      '    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { // @recurse',
      '      if (dfs(r + dr, c + dc, k + 1)) return true;               // @recurse',
      '    }',
      '    used[r][c] = false;                                          // @unchoose',
      '    return false;',
      '  }',
      '  for (let r = 0; r < R; r++)',
      '    for (let c = 0; c < C; c++)',
      '      if (dfs(r, c, 0)) return true;                             // @start',
      '  return false;',
      '}'
    ].join('\n'),
    py: [
      'def exist(board, word):',
      '    R, C = len(board), len(board[0])',
      '    used = [[False] * C for _ in range(R)]',
      '    def dfs(r, c, k):                                            # @head',
      '        if not (0 <= r < R and 0 <= c < C): return False        # @reject',
      '        if used[r][c] or board[r][c] != word[k]: return False    # @reject',
      '        if k == len(word) - 1: return True                       # @found',
      '        used[r][c] = True                                        # @choose',
      '        for dr, dc in ((0, 1), (1, 0), (0, -1), (-1, 0)):        # @recurse',
      '            if dfs(r + dr, c + dc, k + 1): return True           # @recurse',
      '        used[r][c] = False                                       # @unchoose',
      '        return False',
      '    return any(dfs(r, c, 0) for r in range(R) for c in range(C)) # @start'
    ].join('\n')
  };
  B.CODE = CODE;

  /* ================================================================== shared helpers */
  var fmt = A.fmtInt;
  /* Prediction options: shuffle with a seeded rng so the right answer is not always first. */
  var optRng = V.rng(33);
  function shuffled(pairs) {
    var order = V.shuffle(pairs.map(function (_, i) { return i; }), optRng);
    return {
      options: order.map(function (i) { return pairs[i].text; }),
      explain: order.map(function (i) { return pairs[i].why; }),
      answer: order.findIndex(function (i) { return pairs[i].right; })
    };
  }
  B.shuffled = shuffled;
  function findKind(kind, from) { return function (steps) { for (var i = from || 1; i < steps.length; i++) if (steps[i].kind === kind) return i; return -1; }; }
  function jumpButtons(host, player, defs) {
    defs.forEach(function (d) {
      host.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { d.fn(); } }, d.label));
    });
  }
  function nextOfKind(player, kinds) {
    var steps = player.steps, i = player.index + 1;
    for (; i < steps.length; i++) if (kinds.indexOf(steps[i].kind) >= 0) break;
    player.pause();
    player.goto(Math.min(i, steps.length - 1), { animate: i - player.index === 1 });
  }
  var TURBO = [0.5, 1, 2, 4, 8, 16, 32, 64];
  function turboButton(host, player) {
    var b = h('button', { type: 'button', class: 'btn btn--sm btn--soft', title: 'Play at 32× speed' }, 'Turbo ▸▸');
    b.addEventListener('click', function () { player.setSpeed(32); if (player.index >= player.steps.length - 1) player.reset(); player.play(); });
    host.appendChild(b);
  }
  function endButton(host, player) {
    host.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { player.pause(); player.goto(player.steps.length - 1); } }, 'Skip to the end'));
  }

  /* ================================================================== lab 1: N-Queens */
  B.queensLab = function (flowView) {
    var fig = $('#lab-queens');
    if (!fig) return null;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Queen' }, { state: 'error', label: 'Attacked square / conflict' }, { state: 'compare', label: 'Row being filled' },
      { state: 'found', label: 'Solution' }, { state: 'frontier', label: 'Tree: on the current path' }, { state: 'muted', label: 'Tree: finished branch (size)' }
    ]);
    var boardV = B.boardView(fig.querySelector('[data-board]'), { label: 'N-Queens board' });
    var treeV = V.views.tree(fig.querySelector('[data-tree]'), { label: 'State-space tree of queen placements', nodeSize: 34, minNodeSize: 9, levelHeight: 46, gap: 0.35 });
    var guides = B.levelGuides(fig.querySelector('[data-tree]'), { levels: function () { return cfg.n + 1; }, step: 46, label: function (d) { return d === 0 ? 'start: empty board' : 'row ' + (d - 1); } });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.queens, default: 'pseudo', title: 'solveQueens', maxHeight: 360 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { row: 'compare', col: 'compare', cols: 'active', d1: 'pivot', d2: 'frontier' } });
    var cfg = { n: 6, all: false, collapse: true };
    var gen = A.queens(cfg.n, cfg);
    function render(step, ctx) {
      var pieces = step.cols.map(function (c, r) { return [r, c]; });
      var cand = null;
      if (step.kind === 'conflict') cand = { r: step.row, c: step.col, state: 'bad' };
      else if (step.kind === 'place') cand = { r: step.row, c: step.col, state: 'ok' };
      boardV.render({ n: step.n, pieces: pieces, row: step.kind === 'start' ? 0 : step.row, cand: cand, attacker: step.attacker, mark: step.attacker ? [[step.attacker.r, step.attacker.c]] : [], solved: step.kind === 'solution' }, { duration: ctx.duration });
      treeV.render(B.toTree(step.tree), { duration: ctx.duration });
      guides.update(step.kind === 'start' ? 0 : step.row + 1);
    }
    var player = V.player({
      root: fig, steps: gen.steps, render: render, code: code, vars: vars, flow: flowView || null,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { nodes: 'Nodes explored', checks: 'Squares checked', backtracks: 'Backtracks', solutions: 'Solutions' },
      counterStates: { backtracks: 'swap', solutions: 'found' },
      baseStepMs: 700, speeds: TURBO, label: 'N-Queens lab controls'
    });
    function load(keepIndex) {
      gen = A.queens(cfg.n, { all: cfg.all, collapse: cfg.collapse, cap: 5000 });
      treeV.reset();
      B.prepareTree(treeV, gen.steps, function (s) { return s.tree; }, fig.querySelector('[data-tree]'));
      player.setSteps(gen.steps);
      fig.querySelector('[data-note]').textContent = gen.capped ? 'This search has more than 5,000 steps, so the trace stops early and summarises the rest.' :
        gen.steps.length + ' steps. ' + (gen.steps.length > 300 ? 'Try Turbo or the 64× speed.' : '');
    }
    player.addCheckpoint(findKind('conflict'), function (c) {
      var st = c.step, kind = st.reason, r = st.row, col = st.col, a = st.attacker;
      var pairs = [
        { text: 'Safe: place a queen there', right: false, why: 'Not safe. A queen already covers this square, so placing here would create an attack.' },
        { text: 'Attacked: same column', right: kind === 'column', why: kind === 'column' ? 'Yes: the queen in row ' + a.r + ' sits in column ' + col + ', so col ∈ cols.' : 'Not a column clash: no earlier queen is in column ' + col + '.' },
        { text: 'Attacked: same diagonal', right: kind !== 'column', why: kind !== 'column' ? 'Yes: the queen at row ' + a.r + ', column ' + a.c + ' is on the same diagonal (' + (kind === 'd1' ? 'row + col = ' + (r + col) : 'row − col = ' + (r - col)) + ').' : 'Not a diagonal clash here; the column is what is taken.' }
      ];
      var sh = shuffled(pairs);
      return { question: 'The search tries <b>row ' + r + ', column ' + col + '</b>. What happens?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'queens-first-conflict' });
    player.addCheckpoint(findKind('backtrack'), function (c) {
      var st = c.step;
      var sh = shuffled([
        { text: 'Take back the last queen and try its next column', right: true, why: 'That is backtracking: unchoose the most recent decision, then continue with its next option.' },
        { text: 'Clear the board and start again from row 0', right: false, why: 'That throws away all the work in the earlier rows. Backtracking only undoes the latest choice.' },
        { text: 'Put a queen on an attacked square anyway', right: false, why: 'Never: a placed queen must be safe, that is the whole constraint.' },
        { text: 'Stop: no solution exists', right: false, why: 'One dead end proves nothing. Earlier queens can still move, so the search continues.' }
      ]);
      return { question: 'Row ' + (st.row + 1) + ' has no safe square left. What does the search do next?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'queens-first-backtrack' });

    // controls
    var nSlider = V.slider(fig.querySelector('[data-n]'), { label: 'Board size n', min: 2, max: 10, value: cfg.n, onChange: function (v) { cfg.n = v; syncAll(); load(); } });
    var modeSeg = V.segmented(fig.querySelector('[data-mode]'), { label: 'Search', value: 'first', options: [{ value: 'first', label: 'First solution' }, { value: 'all', label: 'All solutions' }], onChange: function (v) { cfg.all = v === 'all'; load(); } });
    V.toggle(fig.querySelector('[data-collapse]'), { label: 'Collapse dead branches', checked: true, onChange: function (on) { cfg.collapse = on; load(); } });
    function syncAll() { /* all-solutions traces for n > 7 are capped, which the note explains */ }
    var presets = fig.querySelector('[data-presets]');
    [['n = 4', 4, false], ['n = 6', 6, false], ['n = 8', 8, false], ['n = 10', 10, false], ['n = 3: no solution', 3, true], ['n = 5: all 10', 5, true]].forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        cfg.n = p[1]; cfg.all = p[2]; nSlider.set(p[1]); modeSeg.set(p[2] ? 'all' : 'first'); load();
      } }, p[0]));
    });
    var jumps = fig.querySelector('[data-jumps]');
    jumpButtons(jumps, player, [
      { label: 'Next backtrack', fn: function () { nextOfKind(player, ['backtrack']); } },
      { label: 'Next solution', fn: function () { nextOfKind(player, ['solution', 'done', 'capped']); } }
    ]);
    turboButton(jumps, player); endButton(jumps, player);
    load();
    return { player: player, cfg: cfg };
  };

  /* ================================================================== lab 2: subsets / permutations / combinations */
  B.chooseLab = function () {
    var fig = $('#lab-choose');
    if (!fig) return null;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Call running' }, { state: 'frontier', label: 'Waiting for its children' }, { state: 'done', label: 'Returned' },
      { state: 'found', label: 'Result recorded' }, { state: 'muted', label: 'Pruned' }
    ]);
    var treeV = V.views.tree(fig.querySelector('[data-tree]'), { label: 'Recursion tree', nodeSize: 34, minNodeSize: 8, levelHeight: 50, gap: 0.3 });
    var partialV = V.views.array(fig.querySelector('[data-partial]'), { mode: 'boxes', cellSize: 40, showIndices: false, emptyText: 'nothing chosen yet', label: 'The partial solution' });
    var chips = fig.querySelector('[data-results]'), countEl = fig.querySelector('[data-rescount]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.subsets, default: 'pseudo', title: 'subsets', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { path: 'key', used: 'muted', i: 'compare', start: 'compare' } });
    var cfg = { kind: 'subsets', items: ['a', 'b', 'c'], k: 2 };
    var TITLE = { subsets: 'subsets', permutations: 'permutations', combinations: 'combinations' };
    var LIMIT = { subsets: 5, permutations: 4, combinations: 6 };
    function gen() {
      if (cfg.kind === 'subsets') return A.subsetsTrace(cfg.items);
      if (cfg.kind === 'permutations') return A.permutationsTrace(cfg.items);
      return A.combinationsTrace(cfg.items, cfg.k);
    }
    var total = gen();
    function render(step, ctx) {
      treeV.render(B.toTree(step.tree), { duration: ctx.duration });
      partialV.render({ items: step.path.map(function (x) { return { id: x, value: x, state: 'key' }; }) }, { duration: ctx.duration });
      // results chips: sync by count, new chips pop in
      var have = chips.children.length, want = step.results.length;
      while (chips.children.length > want) chips.removeChild(chips.lastChild);
      for (var i = have; i < want; i++) chips.appendChild(h('span', { class: 'bt-chip' + (ctx.instant ? '' : ' is-new') }, step.results[i].length ? step.results[i].join('') : '∅'));
      if (!want && chips.children.length === 0) chips.setAttribute('data-empty', 'true'); else chips.removeAttribute('data-empty');
      countEl.textContent = want + ' of ' + expected();
    }
    function expected() { return cfg.kind === 'subsets' ? Math.pow(2, cfg.items.length) : cfg.kind === 'permutations' ? A.factorial(cfg.items.length) : A.binom(cfg.items.length, cfg.k); }
    var player = V.player({
      root: fig, steps: total.steps, render: render, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { calls: 'Calls', results: 'Results', pruned: 'Pruned calls' }, counterStates: { results: 'found', pruned: 'muted' },
      baseStepMs: 800, speeds: TURBO, label: 'Choose-set lab controls'
    });
    player.addCheckpoint(findKind('unchoose'), function (c) {
      var st = c.step, lastItem = c.prev && c.prev.path.length ? c.prev.path[c.prev.path.length - 1] : null;
      var after = st.path.join('') || '∅';
      var sh = shuffled([
        { text: 'Remove the item just chosen (pop it)', right: true, why: 'Unchoose restores the state exactly as it was before the choice, so the next branch starts clean. The path becomes ' + after + '.' },
        { text: 'Keep it: the path only grows', right: false, why: 'If choices were never undone, later branches would inherit items they never chose and results would be wrong.' },
        { text: 'Empty the whole path', right: false, why: 'Only the latest choice is undone. Earlier choices still describe where in the tree we are.' },
        { text: 'Add the next item as well', right: false, why: 'Adding happens only when a new branch is entered, which is a separate step.' }
      ]);
      return { question: 'The branch below ' + (lastItem ? '“' + lastItem + '”' : 'the last choice') + ' is finished. What must happen to the path before the next branch?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'choose-unchoose' });

    function load() {
      total = gen();
      treeV.reset();
      B.prepareTree(treeV, total.steps, function (s) { return s.tree; }, fig.querySelector('[data-tree]'));
      code.setSource(CODE[cfg.kind]);
      var title = fig.querySelector('.fig__title');
      title.textContent = 'Recursion tree of the ' + TITLE[cfg.kind] + ' of ' + cfg.items.join(' ') + (cfg.kind === 'combinations' ? ', choose ' + cfg.k : '');
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      player.setSteps(total.steps);
      fig.querySelector('.fig__foot').textContent = expected() + ' results expected.';
    }
    var kSlider;
    var seg = V.segmented(fig.querySelector('[data-kind]'), { label: 'Problem', value: 'subsets', options: [{ value: 'subsets', label: 'Subsets' }, { value: 'permutations', label: 'Permutations' }, { value: 'combinations', label: 'Combinations' }],
      onChange: function (v) {
        cfg.kind = v;
        var lim = LIMIT[v];
        if (cfg.items.length > lim) { cfg.items = cfg.items.slice(0, lim); input.set(cfg.items, false); }
        fig.querySelector('[data-kwrap]').hidden = v !== 'combinations';
        if (v === 'combinations') { cfg.k = Math.min(cfg.k, cfg.items.length); kSlider.set(cfg.k); }
        load();
      } });
    kSlider = V.slider(fig.querySelector('[data-k]'), { label: 'k (items per set)', min: 0, max: 6, value: cfg.k, onChange: function (v) { cfg.k = Math.min(v, cfg.items.length); kSlider.set(cfg.k); load(); } });
    fig.querySelector('[data-kwrap]').hidden = true;
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Items (up to 5 for subsets, 4 for permutations, 6 for combinations)', value: cfg.items, placeholder: 'e.g. a b c',
      parse: function (t) { return A.parseItems(t, { max: LIMIT[cfg.kind] }); },
      presets: [{ label: 'a b c', value: ['a', 'b', 'c'] }, { label: 'a b c d', value: ['a', 'b', 'c', 'd'] }, { label: 'One item', value: ['x'] }, { label: 'Five items', value: ['a', 'b', 'c', 'd', 'e'] }],
      onApply: function (values) { cfg.items = values; if (cfg.k > values.length) { cfg.k = values.length; kSlider.set(cfg.k); } load(); }
    });
    var jumps = fig.querySelector('[data-jumps]');
    jumpButtons(jumps, player, [
      { label: 'Next result', fn: function () { nextOfKind(player, ['record']); } },
      { label: 'Next unchoose', fn: function () { nextOfKind(player, ['unchoose']); } }
    ]);
    turboButton(jumps, player); endButton(jumps, player);
    load();
    return { player: player, cfg: cfg, seg: seg };
  };

  /* ================================================================== lab 3: Sudoku */
  B.sudokuLab = function () {
    var fig = $('#lab-sudoku');
    if (!fig) return null;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'compare', label: 'Cell being chosen' }, { state: 'active', label: 'Digit tried' }, { state: 'error', label: 'Dead end / erased' }, { state: 'default', shape: 'outline', label: 'Given clue' }
    ]);
    var view = B.sudokuView(fig.querySelector('[data-stage-grid]'));
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.sudoku, default: 'pseudo', title: 'solveSudoku', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { cell: 'compare', digit: 'active', candidates: 'key' } });
    var cfg = { order: 'mrv', puzzle: 'medium', grid: A.textToGrid(A.PUZZLES.medium.text) };
    var gen = A.sudoku(cfg.grid, { order: cfg.order });
    var player = V.player({
      root: fig, steps: gen.steps, render: function (st, ctx) { view.render(st, ctx); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { attempts: 'Digits placed', backtracks: 'Erased', empty: 'Empty cells' }, counterStates: { backtracks: 'swap' },
      baseStepMs: 650, speeds: TURBO, label: 'Sudoku lab controls'
    });
    player.addCheckpoint(function (steps) {
      var seen = 0;
      for (var i = 2; i < steps.length; i++) if (steps[i].kind === 'pick' && steps[i].count > 0) { if (++seen >= 2) return i; }
      return -1;
    }, function (c) {
      var st = c.step, order = st.order, g = st.grid, cand = st.cand, cnt = function (i) { var m = cand[i], k = 0; while (m) { k++; m &= m - 1; } return k; };
      var empties = []; for (var i = 0; i < 81; i++) if (!g[i]) empties.push(i);
      var first = empties[0], picked = st.focus;
      var name = function (i) { return 'row ' + Math.floor(i / 9) + ', column ' + (i % 9); };
      var pool = empties.filter(function (i) { return i !== picked && i !== first; });
      var rr = V.rng(picked + 7), others = V.shuffle(pool, rr).slice(0, 2);
      var opts = [{ text: name(picked), right: true, why: order === 'mrv' ? name(picked) + ' has ' + cnt(picked) + ' candidate' + (cnt(picked) === 1 ? '' : 's') + ', the fewest of any empty cell (ties go to the first).' : 'Naive order takes the first empty cell in reading order.' }];
      if (first !== picked) opts.push({ text: name(first), right: false, why: order === 'mrv' ? 'That is just the first empty cell; it has ' + cnt(first) + ' candidates, more than the winner. Most-constrained-first ignores reading order.' : 'Reading order starts at the top-left, so this cell would already have been chosen earlier.' });
      others.forEach(function (i) { opts.push({ text: name(i), right: false, why: order === 'mrv' ? 'It has ' + cnt(i) + ' candidates, not fewer than the winner’s ' + cnt(picked) + '.' : 'Naive order never jumps ahead to this cell.' }); });
      var sh = shuffled(opts);
      return { question: (order === 'mrv' ? 'Most-constrained-first: ' : 'Naive order: ') + 'which empty cell does the solver pick next?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'sudoku-next-cell' });

    function load(grid) {
      cfg.grid = grid;
      gen = A.sudoku(grid, { order: cfg.order });
      player.setSteps(gen.steps);
      var s0 = fig.querySelector('[data-note]');
      s0.textContent = gen.steps.length + ' steps' + (gen.capped ? ' (the trace stops early and summarises the rest)' : '') + '. Solved: ' + (gen.solved ? 'yes' : gen.aborted ? 'not within the search limit' : 'no solution') + ', ' + fmt(gen.attempts) + ' digits placed.';
      B.onSudokuLoaded && B.onSudokuLoaded(cfg);
    }
    V.segmented(fig.querySelector('[data-order]'), { label: 'Cell order', value: 'mrv', options: [{ value: 'naive', label: 'Naive: reading order' }, { value: 'mrv', label: 'Most constrained first' }], onChange: function (v) { cfg.order = v; load(cfg.grid); } });
    V.toggle(fig.querySelector('[data-marks]'), { label: 'Pencil marks', checked: true, onChange: function (on) { view.setCandidates(on); player.refresh(); } });
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Puzzle (81 cells: digits, 0 or . for blank)', value: A.PUZZLES.medium.text, placeholder: '530070000600195000…',
      parse: function (t) { var r = A.parseSudoku(t); return { values: r.grid, error: r.error }; },
      presets: Object.keys(A.PUZZLES).map(function (k) { return { label: A.PUZZLES[k].label, value: A.PUZZLES[k].text }; }),
      onApply: function (grid) { load(grid); }
    });
    var jumps = fig.querySelector('[data-jumps]');
    jumpButtons(jumps, player, [{ label: 'Next erase', fn: function () { nextOfKind(player, ['erase']); } }]);
    turboButton(jumps, player); endButton(jumps, player);
    load(cfg.grid);
    return { player: player, cfg: cfg, load: load, input: input };
  };

  /* ================================================================== lab 4: word search */
  B.wordLab = function () {
    var fig = $('#lab-word');
    if (!fig) return null;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'On the path' }, { state: 'error', label: 'Rejected cell' }, { state: 'compare', label: 'Cell being tried' }, { state: 'found', label: 'Word found' }
    ]);
    var grid = V.views.grid(fig.querySelector('[data-grid]'), { mode: 'table', cellSize: 52, label: 'Letter grid', showValues: true });
    var wordV = V.views.array(fig.querySelector('[data-word]'), { mode: 'boxes', cellSize: 36, showIndices: false, label: 'The word being matched' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.word, default: 'pseudo', title: 'exist', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { r: 'compare', c: 'compare', k: 'key', path: 'active' } });
    var cfg = { rows: ['ABCE', 'SFCS', 'ADEE'], word: 'ABCCED' };
    var gen = A.wordSearch(cfg.rows, cfg.word);
    function render(st, ctx) {
      var onPath = {}; st.path.forEach(function (p, i) { onPath[p[0] + ',' + p[1]] = i; });
      var cells = st.rows.map(function (row, r) {
        return row.split('').map(function (ch, c) {
          var state = 'default', key = r + ',' + c;
          if (st.found && onPath[key] !== undefined) state = 'found';
          else if (st.bad && st.bad[0] === r && st.bad[1] === c) state = 'error';
          else if (st.cursor && st.cursor[0] === r && st.cursor[1] === c && st.kind !== 'backtrack') state = st.kind === 'match' ? 'active' : 'compare';
          else if (onPath[key] !== undefined) state = 'active';
          return { value: ch, state: state };
        });
      });
      grid.render({ rows: st.rows.length, cols: st.rows[0].length, cells: cells, cursor: st.cursor ? { cell: st.cursor, state: st.kind === 'reject' ? 'error' : 'compare' } : [] }, { duration: ctx.duration });
      wordV.render({ items: st.word.split('').map(function (ch, i) {
        var state = i < st.matched ? (st.found ? 'found' : 'active') : (i === st.matched && st.kind !== 'done' && !st.found ? 'compare' : 'default');
        return { id: 'w' + i, value: ch, state: state };
      }) }, { duration: ctx.duration });
    }
    var player = V.player({
      root: fig, steps: gen.steps, render: render, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { calls: 'dfs calls', matches: 'Letters matched', backtracks: 'Backtracks' }, counterStates: { backtracks: 'swap' },
      baseStepMs: 750, speeds: TURBO, label: 'Word search lab controls'
    });
    player.addCheckpoint(function (steps) { for (var i = 2; i < steps.length; i++) if (steps[i].kind === 'reject' && steps[i - 1].kind === 'match') return i; return -1; }, function (c) {
      var st = c.step, r = st.bad[0], cc = st.bad[1], letter = st.rows[r][cc], k = c.prev.matched, need = st.word[k];
      var used = c.prev.path.some(function (p) { return p[0] === r && p[1] === cc; });
      var sh = shuffled([
        { text: 'It matches: extend the path', right: false, why: 'It cannot match: ' + (used ? 'that cell is already on the path.' : letter + ' is not ' + need + '.') },
        { text: 'Rejected: wrong letter', right: !used, why: !used ? letter + ' ≠ ' + need + ', so this neighbour cannot continue the word.' : 'The letter would not be the issue here; the cell is already used.' },
        { text: 'Rejected: cell already used', right: used, why: used ? 'A cell on the current path cannot be used twice.' : 'That cell is not on the path; the letter simply does not fit.' }
      ]);
      return { question: 'The path is <b>' + c.prev.path.map(function (p) { return st.rows[p[0]][p[1]]; }).join('') + '</b> and the next letter needed is <b>' + need + '</b>. The search looks at cell (' + r + ', ' + cc + '), which holds <b>' + letter + '</b>. What happens?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'word-first-reject' });
    function load(rows, word) {
      cfg.rows = rows; cfg.word = word;
      gen = A.wordSearch(rows, word);
      grid.reset && grid.reset();
      player.setSteps(gen.steps);
      fig.querySelector('[data-note]').textContent = gen.steps.length + ' steps. ' + (gen.capped ? 'The trace stops early and summarises the rest. ' : '') + (gen.found ? 'Found.' : gen.aborted ? 'Search stopped at the call limit.' : 'Not in the grid.');
    }
    var presets = [
      { label: 'Found: ABCCED', value: 'ABCE, SFCS, ADEE | ABCCED' }, { label: 'Found: SEE', value: 'ABCE, SFCS, ADEE | SEE' },
      { label: 'Absent: ABCB', value: 'ABCE, SFCS, ADEE | ABCB' }, { label: 'Worst case: AAAAAAAB', value: 'AAAAA, AAAAA, AAAAA, AAAAA, AAAAA | AAAAAAAAAB' }
    ];
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Grid | word (rows separated by commas, then | and the word)', value: 'ABCE, SFCS, ADEE | ABCCED', placeholder: 'ABCE, SFCS, ADEE | SEE',
      parse: function (t) {
        var parts = String(t).split('|');
        if (parts.length !== 2) return { values: null, error: 'Write the grid, then a | and the word. Example: ABCE, SFCS, ADEE | SEE' };
        var r = A.parseWordGrid(parts[0], parts[1]);
        return { values: r.error ? null : r, error: r.error };
      },
      presets: presets, hint: 'Up to 6×6 letters and a word of up to 12 letters.',
      onApply: function (r) { load(r.rows, r.word); }
    });
    var jumps = fig.querySelector('[data-jumps]');
    jumpButtons(jumps, player, [{ label: 'Next backtrack', fn: function () { nextOfKind(player, ['backtrack']); } }]);
    turboButton(jumps, player); endButton(jumps, player);
    load(cfg.rows, cfg.word);
    return { player: player };
  };
}());
