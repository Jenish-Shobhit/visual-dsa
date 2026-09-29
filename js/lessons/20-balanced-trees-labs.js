/* Lesson 20 · Balanced trees — the rebalancing flowcharts, the AVL lab and the red-black lab.
   Each lab keeps one tree across operations: an operation makes a trace from the current tree
   (js/algos/20-balanced-trees.js), the player shows it, and the result becomes the new tree.
   The flowchart section follows whichever lab ran last, with the current step lit. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A = V.algos.lesson20, L = V.lesson20;
  var num = A.num, nearView = L.nearView;
  var MAX_AVL = 20, MAX_RB = 24;

  /* ================================================================== flowchart specs and routes */
  var SPECS = {
    avl: {
      nodes: [
        { id: 'start', type: 'start', text: 'Walk back up: visit node v', col: 1.5, row: 0 },
        { id: 'upd', type: 'process', text: 'Update height(v), then bf ← height(left) − height(right)', col: 1.5, row: 1, maxWidth: 200 },
        { id: 'dec1', type: 'decision', text: 'bf = ±2 ?', col: 1.5, row: 2 },
        { id: 'ok', type: 'end', text: 'Balanced here: go on to the parent', col: 3.3, row: 2, maxWidth: 150 },
        { id: 'dec2', type: 'decision', text: 'v leans left ?', col: 1.5, row: 3 },
        { id: 'dec3', type: 'decision', text: 'left child leans right ?', col: 0.5, row: 4, maxWidth: 130 },
        { id: 'dec4', type: 'decision', text: 'right child leans left ?', col: 2.5, row: 4, maxWidth: 130 },
        { id: 'LL', type: 'process', text: 'LL: rotate right at v', col: 0, row: 5, maxWidth: 120 },
        { id: 'LR', type: 'process', text: 'LR: rotate left at the child, then right at v', col: 1, row: 5, maxWidth: 150 },
        { id: 'RL', type: 'process', text: 'RL: rotate right at the child, then left at v', col: 2, row: 5, maxWidth: 150 },
        { id: 'RR', type: 'process', text: 'RR: rotate left at v', col: 3, row: 5, maxWidth: 120 },
        { id: 'done', type: 'end', text: 'Height restored: go on to the parent', col: 1.5, row: 6.3, maxWidth: 200 }
      ],
      edges: [
        { from: 'start', to: 'upd' },
        { from: 'upd', to: 'dec1' },
        { from: 'dec1', to: 'ok', label: 'no' },
        { from: 'dec1', to: 'dec2', label: 'yes' },
        { from: 'dec2', to: 'dec3', label: 'yes' },
        { from: 'dec2', to: 'dec4', label: 'no' },
        { from: 'dec3', to: 'LR', label: 'yes' },
        { from: 'dec3', to: 'LL', label: 'no' },
        { from: 'dec4', to: 'RL', label: 'yes' },
        { from: 'dec4', to: 'RR', label: 'no' },
        { from: 'LL', to: 'done' }, { from: 'LR', to: 'done' }, { from: 'RL', to: 'done' }, { from: 'RR', to: 'done' }
      ]
    },
    rb: {
      nodes: [
        { id: 'start', type: 'start', text: 'Insert z as a red leaf', col: 1, row: 0 },
        { id: 'decA', type: 'decision', text: 'z’s parent is red ?', col: 1, row: 1 },
        { id: 'ok', type: 'end', text: 'Stop: no two reds in a row', col: 2, row: 1, maxWidth: 140 },
        { id: 'decU', type: 'decision', text: 'uncle is red ?', col: 1, row: 2 },
        { id: 'recolor', type: 'process', text: 'Recolour parent and uncle black, grandparent red; z ← grandparent', col: 1, row: 3, maxWidth: 190 },
        { id: 'decT', type: 'decision', text: 'z is the inner child (a triangle) ?', col: 2, row: 2, maxWidth: 150 },
        { id: 'rotP', type: 'process', text: 'Rotate the parent: the bend becomes a line; z ← old parent', col: 2, row: 3, maxWidth: 170 },
        { id: 'fix', type: 'process', text: 'Recolour parent black, grandparent red', col: 2, row: 4, maxWidth: 170 },
        { id: 'rotG', type: 'process', text: 'Rotate the grandparent away from z', col: 2, row: 5, maxWidth: 170 },
        { id: 'root', type: 'end', text: 'Finally: colour the root black', col: 2, row: 6, maxWidth: 170 }
      ],
      edges: [
        { from: 'start', to: 'decA' },
        { from: 'decA', to: 'ok', label: 'no' },
        { from: 'decA', to: 'decU', label: 'yes' },
        { from: 'decU', to: 'recolor', label: 'yes' },
        { from: 'decU', to: 'decT', label: 'no' },
        { from: 'recolor', to: 'decA', via: { fromSide: 'left', toSide: 'left', points: [[0.5, 3], [0.5, 1]] } },
        { from: 'decT', to: 'rotP', label: 'yes' },
        { from: 'decT', to: 'fix', label: 'no', via: { fromSide: 'right', toSide: 'right', points: [[2.5, 2], [2.5, 4]] } },
        { from: 'rotP', to: 'fix' },
        { from: 'fix', to: 'rotG' },
        { from: 'rotG', to: 'root' }
      ]
    }
  };
  var TITLES = { avl: 'AVL rebalance at one node', rb: 'Red-black insert fix-up' };
  var FOOTS = {
    avl: 'Text alternative: after an insert or delete, walk back up. At each node update its height and compute the balance factor. If it is 0 or ±1, move on. If it is ±2, look at which side is heavy and at which way that child leans: leaning the same way (or level) is a straight line, fixed by one rotation; leaning the other way is a bend, fixed by two.',
    rb: 'Text alternative: colour the new node red. While its parent is red: if the uncle is red, recolour parent and uncle black and the grandparent red and continue from the grandparent. If the uncle is black, first rotate the parent when z is the inner child, then recolour the parent black and the grandparent red and rotate the grandparent. At the end, colour the root black.'
  };
  function routeAvl(s) {
    var top = ['start', 'upd', 'dec1'];
    if (s.kind === 'check') return top.concat(['ok']);
    if (s.kind === 'flag') return top.concat(['dec2', s.case.name === 'LL' || s.case.name === 'LR' ? 'dec3' : 'dec4']);
    if (s.kind === 'rotate') return [s.case.name === 'LL' || s.case.name === 'LR' ? 'dec3' : 'dec4', s.case.name];
    if (s.kind === 'settle') return [s.case.name, 'done'];
    if (s.kind === 'done') return ['done'];
    return ['start'];
  }
  function routeRb(s) {
    if (s.kind === 'ok') return ['decA', 'ok'];
    if (s.kind === 'check') return s.flow === 'root' ? ['root'] : (s.flow === 'uncleRed' ? ['decA', 'decU'] : ['decA', 'decU', 'decT']);
    if (s.kind === 'recolor') return s.flow === 'recolor' ? ['decU', 'recolor', 'decA'] : ['decT', 'fix'];
    if (s.kind === 'rotate') return s.flow === 'triangle' ? ['decT', 'rotP'] : ['fix', 'rotG'];
    if (s.kind === 'root') return ['rotG', 'root'];
    if (s.kind === 'done') return ['root'];
    return ['start'];
  }
  var flow = null;
  function flowFigure() {
    if (flow) return flow;
    var fig = V.$('#fig-flow');
    if (!fig) return null;
    L.legend(fig, [{ state: 'active', label: 'current step in the lab' }, { state: 'visited', label: 'just before' }]);
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), SPECS.avl, { label: 'Balancing flowchart' });
    var title = fig.querySelector('[data-flow-title]'), foot = fig.querySelector('[data-flow-foot]');
    var current = 'avl', seg;
    function setKind(k) {
      if (k === current) return;
      current = k;
      view.setSpec(SPECS[k]); view.render({}, { duration: 0 });
      title.textContent = TITLES[k]; foot.textContent = FOOTS[k];
      if (seg && seg.value !== k) seg.set(k);
    }
    seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Tree kind', value: 'avl',
      options: [{ value: 'avl', label: 'AVL' }, { value: 'rb', label: 'Red-black' }],
      onChange: setKind
    });
    title.textContent = TITLES.avl; foot.textContent = FOOTS.avl;
    flow = {
      show: function (kind, steps, idx, duration) {
        if (kind !== current) setKind(kind);
        var s = steps[idx];
        if (!s) return;
        var route = (kind === 'avl' ? routeAvl : routeRb)(s);
        var prevRoute = idx > 0 ? (kind === 'avl' ? routeAvl : routeRb)(steps[idx - 1]) : [];
        var edges = {};
        for (var i = 1; i < route.length; i++) edges[route[i - 1] + '->' + route[i]] = 'active';
        var active = route[route.length - 1];
        var visited = prevRoute.filter(function (n) { return n !== active; });
        view.render({ active: active, visited: visited, edgeStates: edges }, { duration: duration || 0 });
      }
    };
    return flow;
  }

  /* ================================================================== the AVL lab */
  var CASE_FIX = {
    LL: 'one rotation right at the flashing node', RR: 'one rotation left at the flashing node',
    LR: 'rotate left at the child, then right at the flashing node', RL: 'rotate right at the child, then left at the flashing node'
  };
  function avlLab() {
    var fig = V.$('#lab-fig');
    L.legend(fig, [
      { state: 'key', label: 'new key' }, { state: 'compare', label: 'being checked' }, { state: 'visited', label: 'already checked' },
      { state: 'error', label: 'out of balance (±2)' }, { state: 'pivot', label: 'heavy child' }, { state: 'active', label: 'just rotated' }, { state: 'swap', label: 'being removed' }
    ]);
    var C = A.CODE;
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: C.avlInsert.pseudo, js: C.avlInsert.js, py: C.avlInsert.py }, default: 'pseudo', maxHeight: 400 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { key: 'key', node: 'compare', hl: 'frontier', hr: 'compare', bf: 'error', s: 'pivot', height: 'done' } });
    var view = V.views.tree(fig.querySelector('[data-stage]'), {
      nodeSize: 40, gap: 0.5, label: 'AVL tree lab: click a node to copy its key',
      onNodeClick: function (e) { keyField.value = e.value; setErr(''); keyField.focus({ preventScroll: true }); }
    });
    var tree = A.empty(), op = 'build', keyField;
    var casePanel = fig.querySelector('[data-case]');
    var caseName = casePanel.querySelector('.bt-case__name'), caseFix = casePanel.querySelector('.bt-case__fix');
    function showCase(s) {
      var n = '–', f = 'Insert or delete a key to see the case named here.';
      if (s.case) { n = s.case.name; f = CASE_FIX[s.case.name]; casePanel.dataset.state = 'error'; }
      else if (s.kind === 'check') { n = '–'; f = 'this node’s balance factor is within ±1: no repair here'; casePanel.dataset.state = 'ok'; }
      else if (s.kind === 'done') { n = '–'; f = 'every balance factor is within ±1'; casePanel.dataset.state = 'ok'; }
      else if (s.kind === 'absent' || s.kind === 'dup') { n = '–'; f = 'nothing changed, so nothing to rebalance'; casePanel.dataset.state = ''; }
      else casePanel.dataset.state = '';
      caseName.textContent = n; caseFix.textContent = f;
    }
    function setCode(which) {
      var c = which === 'delete' ? C.avlDelete : C.avlInsert;
      code.setSource({ pseudo: c.pseudo, js: c.js, py: c.py });
    }
    var player = V.player({
      root: fig, steps: [A.avlBuildSteps([]).steps[0]],
      render: function (s, c) { view.render(s, { duration: c.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: L.LABELS, counterStates: { rotations: 'active', comparisons: 'compare' },
      baseStepMs: 1300, label: 'AVL lab controls',
      onStep: function (s, i, c) { showCase(s); if (flow && c.player) flow.show('avl', c.player.steps, i, c.duration); }
    });
    function load(which, steps, o) {
      o = o || {};
      op = which; setCode(which);
      view.reset(); view.prepare(steps);
      player.setSteps(steps, { index: o.index || 0 });
      if (flow) flow.show('avl', steps, o.index || 0, 0);
      if (o.play && !V.reducedMotion()) player.play();
    }
    /* prediction: name the case before it is revealed (asked once) */
    var asked = false;
    player.addCheckpoint(function (steps) {
      if (asked || op === 'delete') return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'flag') return i;
      return -1;
    }, function (c) {
      var s = c.step, name = s.case.name;
      var top = s.nodes.filter(function (n) { return n.id === s.case.top; })[0];
      if (!top) return null;
      var opts = ['LL', 'LR', 'RR', 'RL'];
      var why = {
        LL: 'Left, then left again: a straight line down the left side. One rotation right.',
        RR: 'Right, then right again: a straight line down the right side. One rotation left.',
        LR: 'Left, then right: the path bends. It needs a double rotation (left at the child, then right at the top).',
        RL: 'Right, then left: the path bends. It needs a double rotation (right at the child, then left at the top).'
      };
      return {
        question: 'The walk back up reaches node <b>' + num(top.value) + '</b>, which is now out of balance. Follow the tall path down from it: which case is this?',
        options: opts.map(function (o) { return o + (o === 'LL' || o === 'RR' ? ' (straight)' : ' (bend)'); }),
        answer: opts.indexOf(name),
        explain: opts.map(function (o) { return o === name ? 'Yes. ' + why[o] : 'Not this one. The tall path is ' + name[0] + ' then ' + name[1] + ' (' + (name === 'LL' || name === 'RR' ? 'straight' : 'a bend') + '). ' + why[name]; })
      };
    }, { id: 'avl-lab-case' });
    player.on('checkpointdone', function () { asked = true; });

    function build(keys, o) {
      var res = A.avlBuildSteps(keys, { brief: true, caption: keys.length ? 'An empty AVL tree. Keys go in one at a time.' : 'An empty AVL tree: nothing to draw yet. Insert a key below.' });
      tree = res.tree;
      load('build', res.steps, o);
    }
    var rng = V.rng(2020);
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Build a tree from these keys, in this order (up to 15)',
      value: [30, 10, 20, 40, 50], parse: { min: 1, max: 99, maxCount: 15, minCount: 0 }, applyLabel: 'Build',
      presets: [
        { label: 'Random', value: function () { return V.presets.random(10, { min: 1, max: 99, unique: true, rng: rng }); } },
        { label: 'Sorted', title: 'Sorted input made a plain BST a stick', value: [10, 20, 30, 40, 50, 60, 70] },
        { label: 'Reversed', value: [70, 60, 50, 40, 30, 20, 10] },
        { label: 'Force a double rotation', title: '30, 10, 20 is the LR case', value: [30, 10, 20] },
        { label: 'Zig-zag', value: [50, 10, 90, 20, 80, 30, 70] },
        { label: 'One key', value: [42] },
        { label: 'Empty', value: [] }
      ],
      hint: 'Duplicates are skipped: the tree stores a set. Build replaces the whole tree.',
      onApply: function (values) { build(values, { play: true }); }
    });
    var err = h('p', { class: 'bt-ops__err', role: 'alert', id: 'bt-lab-err' });
    function setErr(m) { err.textContent = m || ''; keyField.setAttribute('aria-invalid', m ? 'true' : 'false'); }
    keyField = h('input', { class: 'field', id: 'bt-lab-key', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: '25', 'aria-describedby': 'bt-lab-err' });
    function readKey() {
      var txt = keyField.value.trim();
      if (!/^\d+$/.test(txt)) { setErr('Type a whole number from 1 to 99, for example 25.'); return null; }
      var k = parseInt(txt, 10);
      if (k < 1 || k > 99) { setErr('Keys must be between 1 and 99 so they fit in a node.'); return null; }
      setErr(''); return k;
    }
    function run(which) {
      var k = readKey();
      if (k === null) { keyField.focus(); return; }
      var res;
      if (which === 'insert') {
        if (A.size(tree) >= MAX_AVL && A.findId(tree, k) === null) { setErr('The lab holds up to ' + MAX_AVL + ' keys so every node stays readable. Delete one first, or build a new tree.'); return; }
        res = A.avlInsertSteps(tree, k); tree = res.tree;
      } else { res = A.avlDeleteSteps(tree, k); tree = res.tree; }
      load(which, res.steps, { play: true });
    }
    var btns = [['insert', 'Insert', true], ['delete', 'Delete']].map(function (b) {
      return h('button', { type: 'button', class: 'btn' + (b[2] ? ' btn--primary' : ''), onclick: function () { run(b[0]); } }, b[1]);
    });
    keyField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run('insert'); } });
    keyField.addEventListener('input', function () { if (err.textContent) setErr(''); });
    fig.querySelector('[data-ops]').appendChild(h('div', { class: 'bt-ops' },
      h('div', { class: 'bt-ops__key' }, h('label', { class: 'field-label', for: 'bt-lab-key' }, 'Key'), keyField),
      h('div', { class: 'bt-ops__btns', role: 'group', 'aria-label': 'Operations' }, btns),
      err,
      h('p', { class: 'bt-ops__hint' }, 'Tip: click a node to copy its key, then press Delete. Enter inserts.')));
    build([30, 10, 20, 40, 50], { index: 0 });
    player.goto(player.steps.length - 1);
  }

  /* ================================================================== the red-black lab */
  function rbLab() {
    var fig = V.$('#rb-fig');
    L.legend(fig, [
      { state: 'default', label: 'red node', color: 'var(--st-error)' }, { state: 'default', label: 'black node', color: 'var(--ink)' },
      { state: 'error', label: 'breaks a rule', shape: 'ring' }, { state: 'key', label: 'z (new / current)', shape: 'ring' },
      { state: 'pivot', label: 'uncle', shape: 'ring' }, { state: 'active', label: 'grandparent, rotating', shape: 'ring' }
    ]);
    var C = A.CODE;
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: C.rbInsert.pseudo, js: C.rbInsert.js, py: C.rbInsert.py }, default: 'pseudo', maxHeight: 400 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { key: 'key', z: 'key' } });
    var showBh = false, keyField, tree = A.empty();
    var view = V.views.tree(fig.querySelector('[data-stage]'), {
      nodeSize: 40, gap: 0.5, label: 'Red-black tree lab: click a node to copy its key',
      onNodeClick: function (e) { keyField.value = e.value; setErr(''); keyField.focus({ preventScroll: true }); }
    });
    /* rule checker */
    var checker = fig.querySelector('[data-checker]');
    var rows = [];
    var RULES = [
      'Every node is red or black.', 'The root is black.', 'NIL leaves are black.',
      'A red node has no red child.', 'Every path down has the same number of black nodes.'
    ];
    checker.appendChild(h('p', { class: 'bt-checker__title' }, 'Rule checker', h('span', { class: 'bt-checker__sub' }, 'reads the tree on screen')));
    RULES.forEach(function (t, i) {
      var dot = h('span', { class: 'bt-rule__dot', 'aria-hidden': 'true' });
      var note = h('span', { class: 'bt-rule__note' });
      var row = h('div', { class: 'bt-rule', 'data-rule': i + 1 }, dot, h('span', { class: 'bt-rule__n' }, String(i + 1)), h('span', { class: 'bt-rule__t' }, t), note);
      rows.push({ row: row, note: note }); checker.appendChild(row);
    });
    var live = h('p', { class: 'bt-checker__live', 'aria-live': 'polite' });
    checker.appendChild(live);
    function showRules(s) {
      var r = s.rules;
      if (!r) return;
      var bad = [];
      r.ok.forEach(function (ok, i) {
        rows[i].row.classList.toggle('is-bad', !ok);
        rows[i].row.classList.toggle('is-ok', ok);
        rows[i].note.textContent = ok ? (i === 0 || i === 2 ? 'always true' : 'holds') : (i === 1 ? 'the root is red' : r.nodes[i].length + ' node' + (r.nodes[i].length === 1 ? '' : 's') + ' at fault');
        if (!ok) bad.push(i + 1);
      });
      live.textContent = bad.length ? 'Broken: rule ' + bad.join(', rule ') + '.' : 'All five rules hold. Black height ' + r.blackHeight + '.';
    }
    var player = V.player({
      root: fig, steps: [A.rbBuildSteps([]).steps[0]],
      render: function (s, c) { view.render(s, { duration: c.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: L.LABELS, counterStates: { rotations: 'active', recolours: 'swap', comparisons: 'compare' },
      baseStepMs: 1400, label: 'Red-black lab controls',
      onStep: function (s, i, c) { showRules(s); if (flow && c.player) flow.show('rb', c.player.steps, i, c.duration); }
    });
    function load(steps, o) {
      o = o || {};
      view.reset(); view.prepare(steps);
      player.setSteps(steps, { index: o.index || 0 });
      if (flow) flow.show('rb', steps, o.index || 0, 0);
      if (o.play && !V.reducedMotion()) player.play();
    }
    var asked = false;
    player.addCheckpoint(function (steps) {
      if (asked) return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'check' && steps[i].flow !== 'root') return i;
      return -1;
    }, function (c) {
      var s = c.step, f = s.flow;
      var opts = ['Only recolour: the uncle is red', 'Rotate the parent first, then recolour and rotate the grandparent (a triangle)', 'Recolour, then rotate the grandparent once (a straight line)'];
      var ans = f === 'uncleRed' ? 0 : f === 'triangle' ? 1 : 2;
      var z = s.nodes.filter(function (n) { return n.sub === 'z'; })[0];
      var u = s.nodes.filter(function (n) { return n.sub === 'uncle'; })[0];
      return {
        question: 'A red node' + (z ? ' <b>' + num(z.value) + '</b>' : '') + ' has a red parent (rule 4). Look at its uncle' + (u ? '' : ' (an empty child counts as black)') + ' and at whether z bends or lines up with its parent. What repairs it?',
        options: opts, answer: ans,
        explain: [
          ans === 0 ? 'Yes: a red uncle means recolouring parent, uncle and grandparent is enough, and no rotation happens.' : 'Not here: recolouring alone works only when the uncle is red.',
          ans === 1 ? 'Yes: the uncle is black and z is the inner child, so the bend must be straightened by rotating the parent first.' : 'Not here: this only happens when z is the inner child of a red parent with a black uncle.',
          ans === 2 ? 'Yes: the uncle is black and z is the outer child, so the line is fixed by recolouring and one rotation at the grandparent.' : 'Not here: this is the fix when z is on the outside and the uncle is black.'
        ]
      };
    }, { id: 'rb-lab-uncle' });
    player.on('checkpointdone', function () { asked = true; });

    var ops = { keys: [] };
    function build(keys, o) {
      var res = A.rbBuildSteps(keys, { blackHeights: showBh });
      tree = res.tree; ops.keys = keys.slice();
      load(res.steps, o);
    }
    var rng = V.rng(1978);
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Build a tree from these keys, in this order (up to 15)',
      value: [10, 5, 15, 1], parse: { min: 1, max: 99, maxCount: 15, minCount: 0 }, applyLabel: 'Build',
      presets: [
        { label: 'Uncle red: recolour', title: 'Insert 1 under red 5 with red uncle 15', value: [10, 5, 15, 1] },
        { label: 'Line: one rotation', value: [10, 5, 1] },
        { label: 'Triangle: two rotations', value: [10, 5, 7] },
        { label: 'Sorted', value: [1, 2, 3, 4, 5, 6, 7, 8] },
        { label: 'Random', value: function () { return V.presets.random(10, { min: 1, max: 99, unique: true, rng: rng }); } },
        { label: 'Empty', value: [] }
      ],
      hint: 'Insert only: red-black deletion has more cases than fit in a lab. Duplicates are skipped.',
      onApply: function (values) { build(values, { play: true }); }
    });
    var err = h('p', { class: 'bt-ops__err', role: 'alert', id: 'bt-rb-err' });
    function setErr(m) { err.textContent = m || ''; keyField.setAttribute('aria-invalid', m ? 'true' : 'false'); }
    keyField = h('input', { class: 'field', id: 'bt-rb-key', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: '7', 'aria-describedby': 'bt-rb-err' });
    function insert() {
      var txt = keyField.value.trim();
      if (!/^\d+$/.test(txt) || +txt < 1 || +txt > 99) { setErr('Type a whole number from 1 to 99, for example 7.'); keyField.focus(); return; }
      var k = parseInt(txt, 10);
      if (A.size(tree) >= MAX_RB && A.findId(tree, k) === null) { setErr('The lab holds up to ' + MAX_RB + ' keys so every node stays readable. Build a new tree.'); return; }
      setErr('');
      var res = A.rbInsertSteps(tree, k, { blackHeights: showBh });
      tree = res.tree;
      if (res.inserted && ops.keys.indexOf(k) === -1) ops.keys.push(k);
      load(res.steps, { play: true });
    }
    keyField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); insert(); } });
    keyField.addEventListener('input', function () { if (err.textContent) setErr(''); });
    var togHost = h('div', { class: 'bt-ops__tog' });
    fig.querySelector('[data-ops]').appendChild(h('div', { class: 'bt-ops' },
      h('div', { class: 'bt-ops__key' }, h('label', { class: 'field-label', for: 'bt-rb-key' }, 'Key'), keyField),
      h('div', { class: 'bt-ops__btns', role: 'group', 'aria-label': 'Operations' }, h('button', { type: 'button', class: 'btn btn--primary', onclick: insert }, 'Insert')),
      togHost, err,
      h('p', { class: 'bt-ops__hint' }, 'Tip: click a node to copy its key. The badge, when shown, is the node’s black height.')));
    V.toggle(togHost, { label: 'Show black heights', checked: false, onChange: function (on) {
      showBh = on;
      /* rebuild the whole history with the badges switched, and show its final state */
      var res = A.rbBuildSteps(ops.keys, { blackHeights: on });
      view.reset(); view.prepare(res.steps);
      player.setSteps(res.steps, { index: res.steps.length - 1 });
    } });
    build([10, 5, 15, 1], { index: 0 });
    player.goto(player.steps.length - 1);
  }

  V.ready(function () {
    nearView(V.$('#fig-flow'), flowFigure);
    nearView(V.$('#lab-fig'), function () { flowFigure(); avlLab(); });
    nearView(V.$('#rb-fig'), function () { flowFigure(); rbLab(); });
  });
}());
