/* Lesson 24 · Union-find — part 3: the code-synced lab and the two flowcharts it lights.
   Needs js/lessons/24-union-find.js (VDSA.L24) and js/algos/24-union-find.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L = V.L24, UF = L.UF;

  /* ================================================================== code (labels tie lines across languages) */
  function findCode(compress) {
    var P = {}, J = {}, Y = {};
    if (compress === 'full') {
      P = [
        'find(x)                                    // @fdef',
        '  root ← x',
        '  while parent[root] ≠ root                // @fclimb',
        '    root ← parent[root]                    // @fhop',
        '  while parent[x] ≠ root:  (second walk)',
        '    next ← parent[x]',
        '    parent[x] ← root                       // @frepoint',
        '    x ← next',
        '  return root                              // @fret'
      ];
      J = [
        'find(x) {                                           // @fdef',
        '  let root = x;',
        '  while (this.parent[root] !== root) {              // @fclimb',
        '    root = this.parent[root];                       // @fhop',
        '  }',
        '  while (this.parent[x] !== root) {                 // second walk',
        '    const next = this.parent[x];',
        '    this.parent[x] = root;                          // @frepoint',
        '    x = next;',
        '  }',
        '  return root;                                      // @fret',
        '}'
      ];
      Y = [
        'def find(self, x):                                   # @fdef',
        '    root = x',
        '    while self.parent[root] != root:                 # @fclimb',
        '        root = self.parent[root]                     # @fhop',
        '    while self.parent[x] != root:                    # second walk',
        '        nxt = self.parent[x]',
        '        self.parent[x] = root                        # @frepoint',
        '        x = nxt',
        '    return root                                      # @fret'
      ];
    } else if (compress === 'halving') {
      P = [
        'find(x)                                    // @fdef',
        '  while parent[x] ≠ x                      // @fclimb',
        '    parent[x] ← parent[parent[x]]          // @frepoint',
        '    x ← parent[x]                          // @fhop',
        '  return x                                 // @fret'
      ];
      J = [
        'find(x) {                                           // @fdef',
        '  while (this.parent[x] !== x) {                    // @fclimb',
        '    this.parent[x] = this.parent[this.parent[x]];   // @frepoint',
        '    x = this.parent[x];                             // @fhop',
        '  }',
        '  return x;                                         // @fret',
        '}'
      ];
      Y = [
        'def find(self, x):                                   # @fdef',
        '    while self.parent[x] != x:                       # @fclimb',
        '        self.parent[x] = self.parent[self.parent[x]] # @frepoint',
        '        x = self.parent[x]                           # @fhop',
        '    return x                                         # @fret'
      ];
    } else {
      P = [
        'find(x)                                    // @fdef',
        '  while parent[x] ≠ x                      // @fclimb',
        '    x ← parent[x]                          // @fhop',
        '  return x                                 // @fret'
      ];
      J = [
        'find(x) {                                           // @fdef',
        '  while (this.parent[x] !== x) {                    // @fclimb',
        '    x = this.parent[x];                             // @fhop',
        '  }',
        '  return x;                                         // @fret',
        '}'
      ];
      Y = [
        'def find(self, x):                                   # @fdef',
        '    while self.parent[x] != x:                       # @fclimb',
        '        x = self.parent[x]                           # @fhop',
        '    return x                                         # @fret'
      ];
    }
    return { pseudo: P, js: J, py: Y };
  }
  function unionCode(byRank) {
    if (byRank) return {
      pseudo: [
        'union(a, b)                                // @udef',
        '  ra ← find(a)                             // @ufinda',
        '  rb ← find(b)                             // @ufindb',
        '  if ra = rb: return  (already together)   // @usame',
        '  if rank[ra] < rank[rb]                   // @ucmp',
        '    parent[ra] ← rb                        // @ulinka',
        '  else if rank[ra] > rank[rb]              // @ucmp2',
        '    parent[rb] ← ra                        // @ulinkb',
        '  else',
        '    parent[ra] ← rb                        // @utie',
        '    rank[rb] ← rank[rb] + 1                // @ubump'
      ],
      js: [
        'union(a, b) {                                       // @udef',
        '  const ra = this.find(a);                          // @ufinda',
        '  const rb = this.find(b);                          // @ufindb',
        '  if (ra === rb) return false;                      // @usame',
        '  if (this.rank[ra] < this.rank[rb]) {              // @ucmp',
        '    this.parent[ra] = rb;                           // @ulinka',
        '  } else if (this.rank[ra] > this.rank[rb]) {       // @ucmp2',
        '    this.parent[rb] = ra;                           // @ulinkb',
        '  } else {',
        '    this.parent[ra] = rb;                           // @utie',
        '    this.rank[rb]++;                                // @ubump',
        '  }',
        '  return true;',
        '}'
      ],
      py: [
        'def union(self, a, b):                               # @udef',
        '    ra, rb = self.find(a), self.find(b)              # @ufinda @ufindb',
        '    if ra == rb: return False                        # @usame',
        '    if self.rank[ra] < self.rank[rb]:                # @ucmp',
        '        self.parent[ra] = rb                         # @ulinka',
        '    elif self.rank[ra] > self.rank[rb]:              # @ucmp2',
        '        self.parent[rb] = ra                         # @ulinkb',
        '    else:',
        '        self.parent[ra] = rb                         # @utie',
        '        self.rank[rb] += 1                           # @ubump',
        '    return True'
      ]
    };
    return {
      pseudo: [
        'union(a, b)                                // @udef',
        '  ra ← find(a)                             // @ufinda',
        '  rb ← find(b)                             // @ufindb',
        '  if ra = rb: return  (already together)   // @usame',
        '  parent[ra] ← rb        (naive link)      // @ulink'
      ],
      js: [
        'union(a, b) {                                       // @udef',
        '  const ra = this.find(a);                          // @ufinda',
        '  const rb = this.find(b);                          // @ufindb',
        '  if (ra === rb) return false;                      // @usame',
        '  this.parent[ra] = rb;                             // @ulink',
        '  return true;',
        '}'
      ],
      py: [
        'def union(self, a, b):                               # @udef',
        '    ra, rb = self.find(a), self.find(b)              # @ufinda @ufindb',
        '    if ra == rb: return False                        # @usame',
        '    self.parent[ra] = rb                             # @ulink',
        '    return True'
      ]
    };
  }
  function codeFor(byRank, compress) {
    var f = findCode(compress), u = unionCode(byRank);
    var headJs = 'class DSU {\n  constructor(n) {\n    this.parent = Array.from({ length: n }, (_, i) => i);\n    this.rank = new Array(n).fill(0);\n  }\n';
    var headPy = 'class DSU:\n    def __init__(self, n):\n        self.parent = list(range(n))\n        self.rank = [0] * n\n\n';
    return {
      pseudo: f.pseudo.join('\n') + '\n\n' + u.pseudo.join('\n'),
      js: headJs + '\n' + f.js.map(function (l) { return '  ' + l; }).join('\n') + '\n\n' + u.js.map(function (l) { return '  ' + l; }).join('\n') + '\n}',
      py: headPy + f.py.map(function (l) { return '    ' + l; }).join('\n') + '\n\n' + u.py.map(function (l) { return '    ' + l; }).join('\n')
    };
  }

  /* ================================================================== flowcharts (ids mapped from step.flow below) */
  function findSpec(compress) {
    var nodes = [
      { id: 'start', type: 'start', text: 'find(x)', col: 0, row: 0 },
      { id: 'isroot', type: 'decision', text: 'parent[x] = x ?', col: 0, row: 1 },
      { id: 'hop', text: compress === 'halving' ? 'parent[x] ← grandparent\nx ← parent[x]' : 'x ← parent[x]\n(one hop)', col: 1, row: 1, maxWidth: 170 }
    ];
    var edges = [
      { from: 'start', to: 'isroot' },
      { from: 'isroot', to: 'hop', label: 'no' },
      { from: 'hop', to: 'isroot', via: { fromSide: 'top', toSide: 'top' } }
    ];
    if (compress === 'full') {
      nodes.push({ id: 'compress', text: 'walk the path again:\npoint every node\nat the root', col: 0, row: 2, maxWidth: 190 });
      nodes.push({ id: 'ret', type: 'end', text: 'return root', col: 0, row: 3 });
      edges.push({ from: 'isroot', to: 'compress', label: 'yes' }, { from: 'compress', to: 'ret' });
    } else {
      nodes.push({ id: 'ret', type: 'end', text: compress === 'halving' ? 'return x' : 'return x (the root)', col: 0, row: 2 });
      edges.push({ from: 'isroot', to: 'ret', label: 'yes' });
    }
    return { nodes: nodes, edges: edges };
  }
  function unionSpec(byRank) {
    var nodes = [
      { id: 'ustart', type: 'start', text: 'union(a, b)', col: 0, row: 0 },
      { id: 'ufind', text: 'ra ← find(a)\nrb ← find(b)', col: 0, row: 1 },
      { id: 'same', type: 'decision', text: 'ra = rb ?', col: 0, row: 2 },
      { id: 'nothing', type: 'end', text: 'already together:\ndo nothing', col: 1, row: 2, maxWidth: 150 }
    ];
    var edges = [{ from: 'ustart', to: 'ufind' }, { from: 'ufind', to: 'same' }, { from: 'same', to: 'nothing', label: 'yes' }];
    if (!byRank) {
      nodes.push({ id: 'link', text: 'parent[ra] ← rb', col: 0, row: 3 });
      edges.push({ from: 'same', to: 'link', label: 'no' });
    } else {
      nodes.push({ id: 'cmp', type: 'decision', text: 'rank[ra] < rank[rb] ?', col: 0, row: 3 });
      nodes.push({ id: 'linka', text: 'parent[ra] ← rb', col: 1, row: 3 });
      nodes.push({ id: 'cmp2', type: 'decision', text: 'rank[ra] > rank[rb] ?', col: 0, row: 4 });
      nodes.push({ id: 'linkb', text: 'parent[rb] ← ra', col: 1, row: 4 });
      nodes.push({ id: 'tie', text: 'parent[ra] ← rb\nrank[rb] ← rank[rb] + 1', col: 0, row: 5, maxWidth: 190 });
      edges.push({ from: 'same', to: 'cmp', label: 'no' }, { from: 'cmp', to: 'linka', label: 'yes' }, { from: 'cmp', to: 'cmp2', label: 'no' },
        { from: 'cmp2', to: 'linkb', label: 'yes' }, { from: 'cmp2', to: 'tie', label: 'no' });
    }
    return { nodes: nodes, edges: edges };
  }
  var FIND_MAP = {
    'find:start': ['start', []], 'find:hop': ['hop', ['start', 'isroot']], 'find:root': ['isroot', ['start', 'hop']],
    'find:repoint': ['compress', ['start', 'isroot']], 'find:return': ['ret', ['start', 'isroot', 'compress']]
  };
  function unionId(step) {
    var f = step.flow, ln = [].concat(step.line || []);
    if (f === 'union:start') return ['ustart', []];
    if (f === 'union:find') return ['ufind', ['ustart']];
    if (f === 'union:same') return ['nothing', ['ustart', 'ufind', 'same']];
    if (f === 'union:cmp') return ln.indexOf('ucmp2') >= 0 ? ['cmp2', ['ustart', 'ufind', 'same', 'cmp']] : ['cmp', ['ustart', 'ufind', 'same']];
    if (f === 'union:link') {
      if (ln[0] === 'ulinka') return ['linka', ['ustart', 'ufind', 'same', 'cmp']];
      if (ln[0] === 'ulinkb') return ['linkb', ['ustart', 'ufind', 'same', 'cmp', 'cmp2']];
      if (ln[0] === 'utie' || ln[0] === 'ubump') return ['tie', ['ustart', 'ufind', 'same', 'cmp', 'cmp2']];
      return ['link', ['ustart', 'ufind', 'same']];
    }
    return null;
  }

  /* ================================================================== the lab */
  var PRESETS = [
    { label: 'Tour', n: 8, text: 'union 0 1, union 2 3, union 0 3, union 4 5, union 4 0, find 5, union 6 7, union 6 1, find 7', byRank: true, compress: 'full' },
    { label: 'Chain (worst for naive)', n: 8, text: 'union 0 1, union 1 2, union 2 3, union 3 4, union 4 5, union 5 6, union 6 7, find 0, find 0', byRank: false, compress: 'none' },
    { label: 'Same chain, both tricks', n: 8, text: 'union 0 1, union 1 2, union 2 3, union 3 4, union 4 5, union 5 6, union 6 7, find 0, find 0', byRank: true, compress: 'full' },
    { label: 'Balanced merges', n: 8, text: 'union 0 1, union 2 3, union 4 5, union 6 7, union 0 2, union 4 6, union 0 4, find 7', byRank: true, compress: 'none' },
    { label: 'Compression demo', n: 8, text: 'union 0 1, union 1 2, union 2 3, union 3 4, union 4 5, find 0, find 0', byRank: false, compress: 'full' },
    { label: 'Already connected', n: 6, text: 'union 0 1, union 1 2, union 0 2, find 2', byRank: true, compress: 'full' }
  ];

  function lab(fig) {
    var stage = fig.querySelector('[data-stage]');
    var selA = fig.querySelector('[data-a]'), selB = fig.querySelector('[data-b]'), selN = fig.querySelector('[data-n]');
    var p0 = PRESETS[0];
    var n = p0.n, byRank = p0.byRank, compress = p0.compress, ops = UF.parseOps(p0.text, n).values;
    var pending = null;

    var pair = L.pair(stage, { label: 'Union-find forest', nodeR: 17, showRank: true, levelH: 58, minWidth: 430 });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: codeFor(byRank, compress), default: 'pseudo', title: 'DSU', maxHeight: 330 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { x: 'active', ra: 'compare', rb: 'compare' } });

    // the two flowcharts live in their own figure
    var flowFig = V.$('#fig-flow');
    var findView = V.views.flowchart(flowFig.querySelector('[data-stage="find"]'), findSpec(compress), { label: 'find flowchart, lit by the lab' });
    var unionView = V.views.flowchart(flowFig.querySelector('[data-stage="union"]'), unionSpec(byRank), { label: 'union flowchart, lit by the lab' });
    L.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Box running in the lab' }, { state: 'visited', label: 'Already passed' }]);
    var flow = {
      highlight: function (f, ctx) {
        var d = ctx ? ctx.duration : 0;
        if (!f) { findView.render({}, { duration: d }); unionView.render({}, { duration: d }); return; }
        var fi = f.find ? FIND_MAP[f.find] : null;
        findView.render(fi ? { active: fi[0], visited: fi[1] } : {}, { duration: d });
        var ui = f.union;
        unionView.render(ui ? { active: ui[0], visited: ui[1] } : {}, { duration: d });
      }
    };

    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Element (curl = root, badge = rank)' },
      { state: 'active', label: 'x, being examined' },
      { state: 'path', label: 'Climbed past' },
      { state: 'found', label: 'Root' },
      { state: 'compare', label: 'Two roots compared' },
      { state: 'swap', label: 'Pointer written' }
    ]);

    function fillSelects() {
      [selA, selB].forEach(function (sel, k) {
        var keep = sel.value;
        V.clear(sel);
        for (var i = 0; i < n; i++) sel.appendChild(h('option', { value: i }, String(i)));
        sel.value = keep !== '' && +keep < n ? keep : (k === 0 ? '0' : String(Math.min(1, n - 1)));
      });
    }
    function build() {
      var steps = UF.trace(n, ops, { byRank: byRank, compress: compress });
      steps.forEach(function (st) {
        if (!byRank) st.rank = null;
        st.vars = { op: V.vars.raw(st.opText === '' ? '—' : st.opText), x: st.vars.x, ra: st.vars.ra, rb: st.vars.rb };
        var f = st.flow;
        if (typeof f === 'string') {
          if (f.indexOf('find:') === 0) st.flow = { find: f, union: st.opText.indexOf('union') === 0 ? ['ufind', ['ustart']] : null };
          else st.flow = { find: null, union: unionId(st) };
        } else st.flow = null;
      });
      L.annotate(steps);
      pair.reset(); pair.prepare(steps);
      return steps;
    }
    var player = V.player({
      root: fig, steps: build(), render: function (st, ctx) { pair.render(st, ctx); }, code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: L.COUNTER_LABELS, counterStates: L.COUNTER_STATES, baseStepMs: 1000, label: 'Union-find lab controls'
    });

    /* ---- predictions ---- */
    player.addCheckpoint(function (steps) {
      var pick = -1, first = -1;
      steps.forEach(function (st, i) {
        if (st.kind !== 'link') return;
        if (first < 0) first = i;
        if (pick < 0 && byRank) { var a = st.vars.ra, b = st.vars.rb; if (a !== null && b !== null && steps[i - 1].rank && st.rank && steps[i - 1].rank[a] !== steps[i - 1].rank[b]) pick = i; }
      });
      return pick >= 0 ? pick : first;
    }, function (c) {
      var st = c.step, a = st.vars.ra, b = st.vars.rb, prev = c.prev, ranks = prev.rank;
      if (a === null || b === null || a === undefined) return null;
      var rk = function (r) { return ranks ? ' (rank ' + ranks[r] + ')' : ''; };
      var winner = st.parent[a] === b ? b : a, loser = winner === a ? b : a;
      var opts = ['<b>' + a + '</b>' + rk(a), '<b>' + b + '</b>' + rk(b), 'Neither: they merge into a new node'];
      var ans = winner === a ? 0 : 1;
      var why;
      if (!ranks) why = ['The naive rule always hangs the first root under the second, so ' + a + ' would be the child.', 'Right: naive linking sets parent[ra] = rb, so ' + b + ' becomes the parent whatever the tree heights are.'];
      else if (ranks[a] === ranks[b]) why = ['Equal ranks: this lab breaks ties by hanging ra under rb, so ' + a + ' cannot be the parent.', 'Right: with equal ranks either root may win; the lab hangs ra under rb, so ' + b + ' becomes the parent and its rank grows.'];
      else if (ranks[a] > ranks[b]) why = ['Right: ' + a + ' has the higher rank, so the shorter tree, rooted at ' + b + ', goes under it. The taller tree does not grow.', b + ' has the lower rank: hanging the taller tree under it would make every element of the taller tree deeper.'];
      else why = [a + ' has the lower rank, so ' + a + ' is the one that goes underneath.', 'Right: ' + b + ' has the higher rank, so the shorter tree rooted at ' + a + ' goes under it and the taller tree stays as tall as it was.'];
      var correct = why.filter(function (t) { return t.indexOf('Right') === 0; })[0];
      var wrong = why.filter(function (t) { return t.indexOf('Right') !== 0; })[0];
      var none = 'A link never creates a new node. One existing root becomes the parent of the other.';
      var expl = winner === a ? [correct, wrong, none] : [wrong, correct, none];
      return { question: 'Two different roots, <b>' + a + '</b> and <b>' + b + '</b>, are about to be linked. Which one becomes the <em>parent</em>?', options: opts, answer: ans, explain: expl };
    }, { id: 'uf-lab-root' });

    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'repoint' && steps[i].edgeStates && compress !== 'none') {
        var ch = Object.keys(steps[i].edgeStates)[0];
        if (steps[i].parent[ch] !== steps[i - 1].parent[ch]) return i;
      }
      return -1;
    }, function (c) {
      var st = c.step, prev = c.prev, child = +Object.keys(st.edgeStates)[0];
      var oldP = prev.parent[child], newP = st.parent[child];
      var root = UF.rootOf(st.parent, child);
      var opts = [String(oldP) + ' (unchanged)', String(newP), 'Somewhere else'];
      var expl;
      if (compress === 'full') expl = ['If nothing changed, the next find(' + child + ') would climb the whole path again. The point of compression is to shorten it.', 'Right: the find has just learned that ' + root + ' is the root above ' + child + ', so ' + child + ' can point straight at it.', 'It has exactly one sensible target: the root the find just discovered.'];
      else expl = ['Halving moves the pointer, so it will not stay at ' + oldP + '.', 'Right: path halving points ' + child + ' at its grandparent ' + newP + ', skipping its parent ' + oldP + '.', 'The grandparent is the target: one step higher than the parent, no further.'];
      return { question: 'A find on this tree just walked the path. <b>' + (compress === 'full' ? 'Path compression' : 'Path halving') + '</b> is about to re-point <b>' + child + '</b>, which now points to ' + oldP + '. Where will <code>parent[' + child + ']</code> point afterwards?', options: opts, answer: 1, explain: expl };
    }, { id: 'uf-lab-repoint' });

    /* ---- reload / operation builder ---- */
    function reload(o) {
      o = o || {};
      var steps = build();
      if (o.playFrom !== undefined) {
        var first = steps.findIndex(function (s) { return s.op === o.playFrom && s.first; });
        player.setSteps(steps, { index: Math.max(0, first - 1) });
        player.next();
        player.play();
      } else player.setSteps(steps, { keepCheckpoints: false });
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Operations (up to ' + UF.LIMITS.labOps + ')',
      value: p0.text,
      placeholder: 'e.g. union 0 1, union 2 3, find 1',
      parse: function (text) { return UF.parseOps(text, n); },
      presets: PRESETS.map(function (p) { return { label: p.label, value: function () { pending = p; return p.text; } }; }).concat([{ label: 'Random', value: function () { pending = null; return randomText(); } }]),
      hint: 'Write union 3 4 (or 3-4) to merge, find 3 to look up. Separate operations with commas.',
      onApply: function (values) {
        var p = pending; pending = null;
        if (p) {
          if (p.n !== n) { n = p.n; selN.value = String(n); fillSelects(); }
          byRank = p.byRank; compress = p.compress; syncOpts();
        }
        ops = values;
        reload();
      }
    });
    function randomText() {
      var rng = V.rng(Date.now() % 1e6), out = [];
      for (var i = 0; i < 9; i++) {
        if (rng() < 0.7) out.push('union ' + rng.int(0, n - 1) + ' ' + rng.int(0, n - 1)); else out.push('find ' + rng.int(0, n - 1));
      }
      return out.join(', ');
    }
    function add(op) {
      if (ops.length >= UF.LIMITS.labOps) { input.setError('That is ' + (ops.length + 1) + ' operations. The lab keeps at most ' + UF.LIMITS.labOps + '.'); return; }
      input.setError('');
      ops = ops.concat([op]);
      input.field.value = UF.opsToText(ops);
      reload({ playFrom: ops.length - 1 });
    }
    fig.querySelector('[data-add-union]').addEventListener('click', function () { add({ type: 'union', a: +selA.value, b: +selB.value }); });
    fig.querySelector('[data-add-find]').addEventListener('click', function () { add({ type: 'find', a: +selA.value }); });
    fig.querySelector('[data-undo]').addEventListener('click', function () {
      if (!ops.length) return;
      ops = ops.slice(0, -1); input.field.value = UF.opsToText(ops); input.setError(''); reload();
    });

    /* ---- toggles ---- */
    var tRank = V.toggle(fig.querySelector('[data-toggle-rank]'), { label: 'Union by rank', checked: byRank, onChange: function (v) { byRank = v; optsChanged(); } });
    var seg = V.segmented(fig.querySelector('[data-seg-compress]'), {
      label: 'Path compression', value: compress,
      options: [{ value: 'none', label: 'No compression' }, { value: 'full', label: 'Full compression' }, { value: 'halving', label: 'Path halving' }],
      onChange: function (v) { compress = v; optsChanged(); }
    });
    function syncOpts() {
      tRank.set(byRank); seg.set(compress);
      code.setSource(codeFor(byRank, compress));
      findView.setSpec(findSpec(compress)); unionView.setSpec(unionSpec(byRank));
    }
    function optsChanged() {
      code.setSource(codeFor(byRank, compress));
      findView.setSpec(findSpec(compress)); unionView.setSpec(unionSpec(byRank));
      reload();
    }
    for (var k = 4; k <= 12; k += 2) selN.appendChild(h('option', { value: k, selected: k === n }, String(k)));
    fillSelects();
    selN.addEventListener('change', function () {
      n = +selN.value; fillSelects();
      var r = UF.parseOps(UF.opsToText(ops), n);
      if (r.error) { ops = UF.parseOps('union 0 1, find 1', n).values; input.setError('Some operations mention elements that no longer exist, so the lab started a short sequence again.'); input.field.value = UF.opsToText(ops); }
      else { input.setError(''); ops = r.values; }
      reload();
    });
    L.lab = { player: player, get ops() { return ops; } };
  }

  V.ready(function () { L.lazy('#lab-fig', lab); });
}());
