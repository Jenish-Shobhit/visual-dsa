/* Lesson 24 · Union-find — pure step generators (no DOM).

   Browser: VDSA.algos.unionFind.  Node: module.exports.
   Built to be reused by later lessons (30 · Minimum spanning trees uses DSU + kruskal, 25/27 use cycle detection):

     var UF = VDSA.algos.unionFind;
     new UF.DSU(n, {byRank, compress})         the structure itself. compress: 'none' | 'full' | 'halving' (true = 'full')
        .find(x) .union(a, b) .connected(a, b) .height() .groups() .depths()
        counters: hops (parent pointers followed), finds, unions (successful links), redundant, writes
     UF.trace(n, ops, opts)                    lab trace: one step per pointer move, with caption / line / vars / counters / flow
     UF.race(n, ops, [cfgA, cfgB])             the same operations run on two configurations, one frame per operation
     UF.workload(kind, n, rng)                 'random' | 'chain' | 'binomial' operation lists
     UF.curve(kind, n, cfg, rng)               running average hops per find and tallest tree, sampled ~60 times
     UF.percolation(rows, cols, order)         open sites one at a time; virtual top and bottom nodes; detects percolation
     UF.percolationThresholds(size, trials, rng)   Monte Carlo: fraction of open sites at which a random grid percolates
     UF.cycleDetect(n, edges, opts)            edge by edge: find both ends; equal roots = the edge closes a cycle
     UF.kruskal(n, weightedEdges)              sort, then keep an edge when union succeeds (for lesson 30)
     UF.gridComponents(rows, cols, cells)      label connected regions of a grid (image segmentation)
     UF.forestLayout(parent)                   tidy positions for a parent array (slot units)
     UF.alpha(n)                               inverse Ackermann (smallest k with A(k) >= n)
     UF.parseOps(text, n) / UF.parseEdges(text, opts) / UF.opsToText(ops)

   Link rule (CLRS): naive: parent[ra] = rb. By rank: the taller root wins; on a tie ra goes under rb and rank[rb]++.
   Ops: {type: 'union', a, b} | {type: 'find', a}.  Elements are 0..n-1.

   Every trace step: {kind, op, first, parent, rank, states, edgeStates, pointers, caption, line, vars, counters, flow}
     states      {node: 'active' | 'path' | 'found' | 'compare' | 'swap'}   (VDSA.STATES)
     edgeStates  {child: state}       the pointer child -> parent
     counters    {finds, unions, hops, height}   same keys on every step
     flow        'find:hop' … / 'union:link' …   ids of the two flowcharts
   Code labels used by `line`:
     find:  fdef fclimb fhop frepoint fret     union: udef ufinda ufindb usame ucmp ucmp2 ulink ulinka ulinkb utie ubump  */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.unionFind = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { labN: 12, labOps: 24, graphNodes: 10, graphEdges: 16 };

  function normOpts(o) {
    o = o || {};
    var c = o.compress;
    if (c === true) c = 'full';
    if (c !== 'full' && c !== 'halving') c = 'none';
    var out = { byRank: !!o.byRank, compress: c };
    if (o.parent) out.parent = o.parent.slice();
    if (o.rank) out.rank = o.rank.slice();
    return out;
  }

  /* ================================================================== the structure */
  function DSU(n, opts) {
    var o = normOpts(opts);
    this.n = n; this.byRank = o.byRank; this.compress = o.compress;
    this.parent = []; this.rank = [];
    for (var i = 0; i < n; i++) { this.parent.push(i); this.rank.push(0); }
    if (o.parent) { this.parent = o.parent.slice(); if (o.rank) this.rank = o.rank.slice(); }
    this.hops = 0; this.finds = 0; this.unions = 0; this.redundant = 0; this.writes = 0;
    this.hook = null;     // optional fn(event) for traces
    this.log = null;      // optional {paths: [], links: []} for races
  }
  DSU.prototype.emit = function (e) { if (this.hook) this.hook(e); };

  DSU.prototype.find = function (x) {
    var p = this.parent, self = this;
    this.finds++;
    this.emit({ type: 'find-start', x: x });
    var path = [x], r = x, c;
    if (this.compress === 'halving') {
      var cur = x;
      while (p[cur] !== cur) {
        var par = p[cur], g = p[par], was = cur;
        if (g !== par) { p[cur] = g; this.writes++; }
        cur = p[cur]; this.hops++; path.push(cur);
        this.emit({ type: 'repoint', node: was, from: par, to: g, changed: g !== par, halving: true, root: null });
      }
      r = cur;
      this.emit({ type: 'root', node: r, hops: path.length - 1 });
    } else {
      while (p[r] !== r) {
        var pr = p[r], was2 = r;
        r = pr; this.hops++; path.push(r);
        this.emit({ type: 'climb', node: was2, parent: pr, hop: this.hops });
      }
      this.emit({ type: 'root', node: r, hops: path.length - 1 });
      if (this.compress === 'full') {
        c = x;
        while (p[c] !== r) {
          var nx = p[c], old = nx;
          p[c] = r; this.writes++;
          this.emit({ type: 'repoint', node: c, from: old, to: r, changed: true, root: r });
          c = nx;
        }
      }
    }
    if (this.log) this.log.paths.push(path);
    this.emit({ type: 'find-end', x: x, root: r, path: path });
    return r;
  };

  DSU.prototype.link = function (ra, rb) {
    var p = this.parent, k = this.rank, rule, child, top;
    if (!this.byRank) { p[ra] = rb; rule = 'naive'; child = ra; top = rb; }
    else if (k[ra] < k[rb]) { p[ra] = rb; rule = 'lower'; child = ra; top = rb; }
    else if (k[ra] > k[rb]) { p[rb] = ra; rule = 'higher'; child = rb; top = ra; }
    else { p[ra] = rb; rule = 'tie'; child = ra; top = rb; }
    this.unions++;
    if (this.log) this.log.links.push({ child: child, parent: top });
    this.emit({ type: 'link', rule: rule, child: child, parent: top, ra: ra, rb: rb });
    if (rule === 'tie') { k[rb]++; this.emit({ type: 'bump', root: rb, rank: k[rb] }); }
  };

  DSU.prototype.union = function (a, b) {
    this.emit({ type: 'union-start', a: a, b: b });
    var ra = this.find(a);
    this.emit({ type: 'found', which: 'a', root: ra });
    var rb = this.find(b);
    this.emit({ type: 'found', which: 'b', root: rb });
    if (ra === rb) { this.redundant++; this.emit({ type: 'same', root: ra }); return false; }
    if (this.byRank) this.emit({ type: 'cmp', ra: ra, rb: rb, rankA: this.rank[ra], rankB: this.rank[rb] });
    this.link(ra, rb);
    return true;
  };
  DSU.prototype.connected = function (a, b) { return this.find(a) === this.find(b); };

  DSU.prototype.depths = function () {
    var p = this.parent, d = new Array(this.n), i, stack;
    for (i = 0; i < this.n; i++) d[i] = -1;
    for (i = 0; i < this.n; i++) {
      if (d[i] >= 0) continue;
      stack = [];
      var v = i;
      while (d[v] < 0 && p[v] !== v) { stack.push(v); v = p[v]; }
      if (d[v] < 0) d[v] = 0;
      for (var s = stack.length - 1; s >= 0; s--) d[stack[s]] = d[p[stack[s]]] + 1;
    }
    return d;
  };
  DSU.prototype.height = function () {
    var d = this.depths(), m = 0;
    for (var i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
    return m;
  };
  /* groups(): array of arrays of members, ordered by smallest member. Does not change the structure. */
  DSU.prototype.groups = function () { return groupsOf(this.parent); };

  function rootOf(parent, x) { while (parent[x] !== x) x = parent[x]; return x; }
  function groupsOf(parent) {
    var map = {}, out = [];
    for (var i = 0; i < parent.length; i++) {
      var r = rootOf(parent, i);
      if (!map[r]) { map[r] = []; out.push(map[r]); }
      map[r].push(i);
    }
    return out;
  }
  function heightOf(parent) {
    var d = new DSU(parent.length); d.parent = parent.slice(); return d.height();
  }

  /* ================================================================== the lab trace */
  function opText(op) { return op.type === 'union' ? 'union(' + op.a + ', ' + op.b + ')' : 'find(' + op.a + ')'; }
  function opsToText(ops) { return ops.map(function (o) { return o.type === 'union' ? 'union ' + o.a + ' ' + o.b : 'find ' + o.a; }).join(', '); }
  function plural(k, one, many) { return k + ' ' + (k === 1 ? one : many || one + 's'); }

  function trace(n, ops, opts) {
    var o = normOpts(opts), d = new DSU(n, o), steps = [];
    var quick = !!(opts && opts.quick), qh0 = 0, qLink = null, fh0 = 0;
    var opIdx = -1, curText = '', first = false;
    var x = null, ra = null, rb = null, phase = '';
    var seen = [], curNode = null, rootNode = null;
    var inUnion = false, whichFind = 'a', pending = null;
    function counters() { return { finds: d.finds, unions: d.unions, hops: d.hops, height: d.height() }; }
    function flush() {
      if (!pending) return;
      var pd = pending; pending = null;
      push('find-start', pd);
      var st = steps[steps.length - 1];
      st.parent = pd.snap.parent; st.rank = pd.snap.rank; st.counters = pd.snap.counters;
    }

    function pointers() {
      var out = [];
      if (curNode !== null) out.push({ name: 'x', node: curNode });
      if (ra !== null && (phase === 'cmp' || phase === 'link' || phase === 'b')) out.push({ name: 'ra', node: ra });
      if (rb !== null && (phase === 'cmp' || phase === 'link')) out.push({ name: 'rb', node: rb });
      return out;
    }
    function vars() {
      var v = { op: curText };
      v.x = curNode; v.ra = ra; v.rb = rb;
      return v;
    }
    function push(kind, extra) {
      var e = extra || {};
      steps.push({
        kind: kind, op: opIdx, opText: curText, first: first,
        parent: d.parent.slice(), rank: d.rank.slice(),
        states: e.states || {}, edgeStates: e.edgeStates || {}, pointers: e.pointers || pointers(),
        caption: e.caption, line: e.line === undefined ? null : e.line, vars: vars(),
        counters: counters(),
        flow: e.flow || null, n: n
      });
      first = false;
    }
    function pathStates(extra) {
      var s = {};
      seen.forEach(function (v) { s[v] = 'path'; });
      if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
      return s;
    }
    var side = function () { return inUnion ? (whichFind === 'a' ? 'a' : 'b') : 'x'; };
    var lineFor = { start: null };

    function pushQuick(e, newRank) {
      var hopsUsed = d.hops - qh0, tail = hopsUsed ? ' (the two finds took ' + plural(hopsUsed, 'hop') + ')' : '';
      var cap = '<b>' + curText + '</b>: the roots are ' + e.ra + ' and ' + e.rb + tail + '. ';
      if (e.rule === 'naive') cap += 'The naive rule hangs the first root under the second: <code>parent[' + e.ra + '] = ' + e.rb + '</code>.';
      else if (e.rule === 'lower') cap += 'rank[' + e.ra + '] &lt; rank[' + e.rb + '], so the shorter tree goes under the taller root: <code>parent[' + e.ra + '] = ' + e.rb + '</code>. No rank changes.';
      else if (e.rule === 'higher') cap += 'rank[' + e.ra + '] &gt; rank[' + e.rb + '], so the shorter tree goes under the taller root: <code>parent[' + e.rb + '] = ' + e.ra + '</code>. No rank changes.';
      else cap += 'Equal ranks, so ' + e.ra + ' goes under ' + e.rb + ' and rank[' + e.rb + '] grows to <b>' + newRank + '</b>: the merged tree is one level taller.';
      push('link', {
        states: { [e.parent]: 'found', [e.child]: 'swap' }, edgeStates: { [e.child]: 'swap' }, pointers: [],
        caption: cap, line: null
      });
    }
    d.hook = function (e) {
      if (quick) {
        if (e.type === 'union-start') { inUnion = true; whichFind = 'a'; qh0 = d.hops; return; }
        if (inUnion) {
          if (e.type === 'find-end') { if (whichFind === 'a') { ra = e.root; whichFind = 'b'; } else rb = e.root; return; }
          if (e.type === 'same') {
            push('same', { states: { [e.root]: 'found' }, pointers: [], caption: '<b>' + curText + '</b>: both finds return <b>' + e.root + '</b>, so the elements are already in one group. Nothing changes.', line: null });
            return;
          }
          if (e.type === 'link') { if (e.rule === 'tie') qLink = e; else pushQuick(e); return; }
          if (e.type === 'bump') { pushQuick(qLink, e.rank); return; }
          return;
        }
      }
      var nm = inUnion ? 'root of ' + (whichFind === 'a' ? 'a' : 'b') : 'the root of x';
      switch (e.type) {
        case 'union-start':
          inUnion = true; whichFind = 'a'; x = null; ra = rb = null; curNode = null; seen = []; phase = 'start';
          push('op-union', {
            caption: '<b>union(' + e.a + ', ' + e.b + ')</b> merges the group of ' + e.a + ' with the group of ' + e.b + '. Each group is named by its root, so first find both roots.',
            line: 'udef', flow: 'union:start'
          });
          break;
        case 'find-start':
          fh0 = d.hops;
          x = e.x; curNode = e.x; seen = []; rootNode = null;
          if (inUnion) {
            phase = whichFind === 'a' ? 'a' : 'b';
            pending = {
              states: { [e.x]: 'active' },
              caption: '<b>find(' + e.x + ')</b> for the ' + (whichFind === 'a' ? 'first' : 'second') + ' element: walk up from ' + e.x + ' until you reach a node that points to itself.',
              line: whichFind === 'a' ? 'ufinda' : 'ufindb', flow: 'union:find', x: e.x,
              snap: { parent: d.parent.slice(), rank: d.rank.slice(), counters: counters() }
            };
          } else {
            inUnion = false; phase = 'x'; ra = rb = null;
            push('op-find', {
              states: { [e.x]: 'active' },
              caption: '<b>find(' + e.x + ')</b> asks: which group is ' + e.x + ' in? The answer is the root, the node at the top that points to itself. Start at ' + e.x + ' and walk up.',
              line: 'fdef', flow: 'find:start'
            });
          }
          break;
        case 'climb': {
          // the reader sees the pointer at e.node, then it moves (halving also re-points first)
          flush();
          seen.push(e.node);
          curNode = e.parent;
          push('hop', {
            states: pathStates({ [e.parent]: 'active' }),
            edgeStates: { [e.node]: 'active' },
            caption: 'parent[' + e.node + '] = ' + e.parent + ', which is not ' + e.node + ', so ' + e.node + ' is not a root. Hop up to ' + e.parent + ' (hop ' + (e.hop - fh0) + ').',
            line: ['fclimb', 'fhop'], flow: 'find:hop'
          });
          break;
        }
        case 'hop': break;
        case 'root':
          rootNode = e.node; curNode = e.node;
          if (pending && e.hops === 0) break;
          flush();
          if (d.compress === 'halving') {
            push('root', {
              states: pathStates({ [e.node]: 'found' }),
              caption: 'parent[' + e.node + '] = ' + e.node + ': it points to itself, so <b>' + e.node + ' is the root</b>. ' + (e.hops === 0 ? 'No hop was needed.' : 'It took ' + plural(e.hops, 'hop') + '.'),
              line: 'fclimb', flow: 'find:root'
            });
          } else {
            push('root', {
              states: pathStates({ [e.node]: 'found' }),
              caption: 'parent[' + e.node + '] = ' + e.node + ': it points to itself, so <b>' + e.node + ' is the root</b> of ' + (e.hops === 0 ? 'its own group; no hop was needed.' : 'the group. Finding it took ' + plural(e.hops, 'hop') + ', the length of the path.'),
              line: 'fclimb', flow: 'find:root'
            });
          }
          break;
        case 'repoint':
          flush();
          if (e.halving) {
            seen.push(e.node);
            var onlyParent = !e.changed;
            curNode = e.to;
            push('repoint', {
              states: pathStates({ [e.to]: 'active', [e.node]: 'swap' }),
              edgeStates: { [e.node]: 'swap' },
              caption: onlyParent
                ? e.node + '’s parent ' + e.from + ' is already the root, so its grandparent is the same node. Nothing to change; hop to ' + e.from + '.'
                : '<b>Path halving:</b> parent[' + e.node + '] = ' + e.from + ' is not a root, so point ' + e.node + ' at its grandparent ' + e.to + ' and skip ' + e.from + '. Then continue from ' + e.to + '.',
              line: ['fclimb', 'frepoint', 'fhop'], flow: 'find:hop'
            });
          } else {
            var s = pathStates({ [rootNode]: 'found', [e.node]: 'swap' });
            push('repoint', {
              states: s, edgeStates: { [e.node]: 'swap' },
              caption: '<b>Path compression:</b> the root ' + e.to + ' is known now, so point ' + e.node + ' straight at it (it pointed at ' + e.from + '). The next find from ' + e.node + ' takes one hop instead of the whole climb.',
              line: 'frepoint', flow: 'find:repoint'
            });
          }
          break;
        case 'find-end': {
          var rt = e.root, hopsUsed = e.path.length - 1;
          seen = e.path.slice();
          if (inUnion) {
            if (whichFind === 'a') ra = rt; else rb = rt;
            if (pending) {
              var pd = pending; pending = null;
              push('find-end', {
                states: { [rt]: 'found' },
                caption: '<b>find(' + pd.x + ')</b>: parent[' + rt + '] = ' + rt + ', so ' + rt + ' already points to itself. It is the root of its group, found with no hops.' + (whichFind === 'a' ? ' Now the same for the second element.' : ''),
                line: pd.line, flow: 'find:root'
              });
              whichFind = 'b'; curNode = null;
              break;
            }
            push('find-end', {
              states: pathStates({ [rt]: 'found' }),
              caption: 'find returns <b>' + rt + '</b>: the ' + (whichFind === 'a' ? 'first' : 'second') + ' element belongs to the group whose root is ' + rt + '.' + (whichFind === 'a' ? ' Now the same for the second element.' : ''),
              line: 'fret', flow: 'find:return'
            });
            whichFind = 'b';
            curNode = null;
          } else {
            push('find-end', {
              states: pathStates({ [rt]: 'found' }),
              caption: '<b>find(' + e.x + ') returns ' + rt + '.</b> ' + (hopsUsed === 0 ? e.x + ' is a root itself.' : 'Any element that returns ' + rt + ' is in the same group as ' + e.x + '.'),
              line: 'fret', flow: 'find:return'
            });
            curNode = null; seen = [];
          }
          break;
        }
        case 'found': break;
        case 'same':
          phase = 'link'; curNode = null;
          push('same', {
            states: { [e.root]: 'found' }, pointers: [{ name: 'ra = rb', node: e.root }],
            caption: 'Both finds returned <b>' + e.root + '</b>: the two elements already share a root, so they are already in the same group. There is nothing to merge. (When the elements are the ends of a graph edge, this edge would close a cycle.)',
            line: 'usame', flow: 'union:same'
          });
          break;
        case 'cmp':
          phase = 'cmp'; curNode = null;
          push('cmp', {
            states: { [e.ra]: 'compare', [e.rb]: 'compare' },
            caption: 'Two different roots, so two separate groups. Union by rank compares their ranks: rank[' + e.ra + '] = ' + e.rankA + ' and rank[' + e.rb + '] = ' + e.rankB + '. The taller tree should stay on top.',
            line: e.rankA > e.rankB ? ['ucmp', 'ucmp2'] : 'ucmp', flow: 'union:cmp'
          });
          break;
        case 'link': {
          phase = 'link'; curNode = null;
          var cap, line;
          if (e.rule === 'naive') { cap = '<b>Link the roots:</b> parent[' + e.ra + '] = ' + e.rb + '. The naive rule hangs the first root under the second, whichever tree is taller. That is how tall chains appear.'; line = 'ulink'; }
          else if (e.rule === 'lower') { cap = 'rank[' + e.ra + '] &lt; rank[' + e.rb + ']: hang the shorter tree, root ' + e.ra + ', under ' + e.rb + '. Everything in ' + e.ra + '’s tree gets one level deeper, but the taller tree does not grow.'; line = 'ulinka'; }
          else if (e.rule === 'higher') { cap = 'rank[' + e.ra + '] &gt; rank[' + e.rb + ']: hang the shorter tree, root ' + e.rb + ', under ' + e.ra + '. The taller tree keeps its height.'; line = 'ulinkb'; }
          else { cap = 'Equal ranks: neither tree is shorter, so either root can win. Here ' + e.ra + ' goes under ' + e.rb + '. The merged tree will be one level taller.'; line = 'utie'; }
          push('link', {
            states: { [e.parent]: 'found', [e.child]: 'swap' }, edgeStates: { [e.child]: 'swap' },
            pointers: [], caption: cap, line: line, flow: e.rule === 'naive' ? 'union:link' : 'union:link'
          });
          break;
        }
        case 'bump':
          push('bump', {
            states: { [e.root]: 'found' }, pointers: [],
            caption: 'Two trees of the same rank merged, so the result is one level taller: rank[' + e.root + '] goes from ' + (e.rank - 1) + ' to <b>' + e.rank + '</b>. Any other merge leaves the taller tree’s rank alone.',
            line: 'ubump', flow: 'union:link'
          });
          break;
      }
    };

    var fromStart = !!o.parent;
    push('init', {
      caption: fromStart ? 'A forest built by earlier unions: ' + plural(d.groups().length, 'group') + ' over ' + n + ' elements. A node with a curl points to itself, so it is a root. The row of boxes is how the computer stores the same forest.' : n + ' elements, each alone in its own group. <b>parent[i] = i</b> means “i points to itself”, so every element is the root of a group of one.' + (o.byRank ? ' Every rank starts at 0: a single node is a tree of height 0.' : ''),
      line: null, pointers: [], flow: null
    });
    for (var i = 0; i < ops.length; i++) {
      opIdx = i; curText = opText(ops[i]); first = true; inUnion = false; ra = rb = null; curNode = null; seen = []; phase = '';
      if (ops[i].type === 'union') d.union(ops[i].a, ops[i].b);
      else d.find(ops[i].a);
      // closing step of a union
      if (ops[i].type === 'union') {
        var g = d.groups().length;
        var last = steps[steps.length - 1];
        // decorate the last step of the union with the running group count
        last.caption += ' <em>' + plural(g, 'group') + ' left.</em>';
      }
    }
    if (ops.length) {
      opIdx = ops.length; curText = 'done';
      var groups = d.groups().length;
      push('end', {
        pointers: [],
        caption: 'All ' + plural(ops.length, 'operation') + ' done: <b>' + plural(groups, 'group') + '</b>, tallest tree ' + d.height() + ', and ' + plural(d.hops, 'pointer hop') + ' followed in total.',
        line: null
      });
    }
    return steps;
  }

  /* ================================================================== race: same operations, two configurations */
  var CFG_NAIVE = { byRank: false, compress: 'none' };
  var CFG_BOTH = { byRank: true, compress: 'full' };

  function race(n, ops, cfgs) {
    cfgs = cfgs || [CFG_NAIVE, CFG_BOTH];
    var ds = cfgs.map(function (c) { return new DSU(n, c); });
    function frame(index, text, caption, logs) {
      return {
        index: index, opText: text, caption: caption, n: n,
        sides: ds.map(function (d, k) {
          var states = {}, edgeStates = {}, lg = logs && logs[k];
          if (lg) {
            lg.paths.forEach(function (p) { p.forEach(function (v) { states[v] = 'path'; }); });
            lg.links.forEach(function (l) { states[l.parent] = 'found'; states[l.child] = 'swap'; edgeStates[l.child] = 'swap'; });
          }
          return { parent: d.parent.slice(), rank: d.rank.slice(), states: states, edgeStates: edgeStates, hops: d.hops, height: d.height(), finds: d.finds };
        })
      };
    }
    var frames = [frame(0, 'start', n + ' singletons. Both structures start identical: every element is its own root.', null)];
    ops.forEach(function (op, i) {
      var before = ds.map(function (d) { return d.hops; });
      var logs = ds.map(function (d) { d.log = { paths: [], links: [] }; return d.log; });
      ds.forEach(function (d) { if (op.type === 'union') d.union(op.a, op.b); else d.find(op.a); });
      var delta = ds.map(function (d, k) { return d.hops - before[k]; });
      var cap;
      if (delta[0] === delta[1]) cap = '<b>' + opText(op) + '</b>: both climbed ' + plural(delta[0], 'hop') + '. Nothing to gain yet.';
      else cap = '<b>' + opText(op) + '</b>: the left side climbed ' + plural(delta[0], 'hop') + ', the right side ' + plural(delta[1], 'hop') + '.';
      frames.push(frame(i + 1, opText(op), cap, logs));
      ds.forEach(function (d) { d.log = null; });
    });
    return frames;
  }

  /* frames(n, ops, cfg, caption): one step per operation (no sub-steps), for figures that only need the result of each. */
  function frames(n, ops, cfg, captionFn) {
    var o = normOpts(cfg), d = new DSU(n, o), out = [];
    function push(text, cap, logs) {
      var states = {}, edgeStates = {};
      if (logs) {
        logs.paths.forEach(function (p) { p.forEach(function (v) { states[v] = 'path'; }); });
        logs.links.forEach(function (l) { states[l.parent] = 'found'; states[l.child] = 'swap'; edgeStates[l.child] = 'swap'; });
      }
      out.push({ parent: d.parent.slice(), rank: d.rank.slice(), states: states, edgeStates: edgeStates, pointers: [], caption: cap, opText: text, op: out.length,
        counters: { finds: d.finds, unions: d.unions, hops: d.hops, height: d.height() } });
    }
    push('start', o.parent ? 'The forest you start from.' : n + ' elements, each alone: every node is a root.', null);
    ops.forEach(function (op, i) {
      d.log = { paths: [], links: [] };
      var h0 = d.hops, ok = op.type === 'union' ? d.union(op.a, op.b) : (d.find(op.a), true);
      var info = { op: op, index: i, merged: ok, hops: d.hops - h0, height: d.height(), links: d.log.links.slice(), d: d };
      push(opText(op), captionFn ? captionFn(info) : '<b>' + opText(op) + '</b>' + (op.type === 'union' && !ok ? ': already connected.' : '.'), d.log);
      d.log = null;
    });
    return out;
  }

  /* ================================================================== workloads and cost curves */
  function workload(kind, n, rng) {
    var ops = [], i, a, b;
    if (kind === 'chain') {
      for (i = 0; i + 1 < n; i++) ops.push({ type: 'union', a: i, b: i + 1 });
      for (i = 0; i < 2 * n; i++) ops.push({ type: 'find', a: rng.int(0, Math.max(0, n - 1)) });
    } else if (kind === 'binomial') {
      for (var s = 1; s < n; s *= 2) for (i = 0; i + s < n; i += 2 * s) ops.push({ type: 'union', a: i, b: i + s });
      for (i = 0; i < 2 * n; i++) ops.push({ type: 'find', a: rng.int(0, n - 1) });
    } else {
      for (i = 0; i < 3 * n; i++) {
        if (rng() < 0.5) { a = rng.int(0, n - 1); b = rng.int(0, n - 1); ops.push({ type: 'union', a: a, b: b }); }
        else ops.push({ type: 'find', a: rng.int(0, n - 1) });
      }
    }
    return ops;
  }

  /* curve(): running average hops per find call, and the tallest tree, after every ~(ops/points) operations */
  function curve(ops, n, cfg, points) {
    var d = new DSU(n, cfg), out = { cost: [], height: [] }, points = points || 60;
    var every = Math.max(1, Math.floor(ops.length / points));
    ops.forEach(function (op, i) {
      if (op.type === 'union') d.union(op.a, op.b); else d.find(op.a);
      if ((i + 1) % every === 0 || i === ops.length - 1) {
        out.cost.push([i + 1, d.finds ? d.hops / d.finds : 0]);
        out.height.push([i + 1, d.height()]);
      }
    });
    out.hops = d.hops; out.finds = d.finds;
    return out;
  }

  /* inverse Ackermann, CLRS version: A_k(1) = 2, 3, 7, 2047, then A_4(1) = A_3(2047), a tower of 2s about 2000 levels high
     (A_2(2047) = 2^2059 - 1 alone has 620 digits).
     alpha(n) = smallest k with A_k(1) >= n. So n = 3 gives 1, 4..7 give 2, 8..2047 give 3, and everything from
     2048 to A_4(1) (far beyond the atoms in the universe) gives 4. */
  function alpha(n) {
    if (n <= 2) return 0; if (n <= 3) return 1; if (n <= 7) return 2; if (n <= 2047) return 3;
    return 4;   // every n that can ever be stored is below A_4(1)
  }

  /* ================================================================== percolation */
  function percolation(rows, cols, order) {
    /* Two structures, on purpose. `both` has virtual TOP and BOTTOM nodes and answers "does it percolate?".
       `real` has only the sites and answers "is this site connected to the top?": with the virtual bottom node
       in the same structure, every bottom-row site would look full the moment the grid percolates ("backwash"). */
    var N = rows * cols, TOP = N, BOT = N + 1;
    var both = new DSU(N + 2, { byRank: true, compress: 'full' });
    var real = new DSU(N, { byRank: true, compress: 'full' });
    var open = new Uint8Array(N), openCount = 0, steps = [], percolatesAt = -1;
    function isPerc() { return both.find(TOP) === both.find(BOT); }
    function fullRoots() {
      var m = {};
      for (var c = 0; c < cols; c++) if (open[c]) m[real.find(c)] = true;
      return m;
    }
    function codes(perc) {
      var full = fullRoots(), s = '';
      for (var i = 0; i < N; i++) s += !open[i] ? '#' : (full[real.find(i)] ? (perc ? 'p' : 'f') : 'o');
      return s;
    }
    function comps() {
      var seen = {}, k = 0;
      for (var i = 0; i < N; i++) if (open[i]) { var r = real.find(i); if (!seen[r]) { seen[r] = 1; k++; } }
      return k;
    }
    function snap(caption, cell, joined) {
      var perc = isPerc();
      if (perc && percolatesAt < 0) percolatesAt = steps.length;
      var g = comps();
      steps.push({
        rows: rows, cols: cols, codes: codes(perc), open: openCount, components: g, percolates: perc,
        cell: cell === undefined ? null : cell, joined: joined || 0, caption: caption,
        counters: { open: openCount, groups: g, percolates: perc ? 1 : 0 }
      });
    }
    snap('Every site is blocked. Two virtual nodes, TOP and BOTTOM, stand for “the row above the grid” and “the row below it”. Water can flow from top to bottom when they end up in the same group.', null, 0);
    for (var k = 0; k < order.length; k++) {
      var c = order[k];
      if (c < 0 || c >= N || open[c]) continue;
      open[c] = 1; openCount++;
      var r = Math.floor(c / cols), q = c % cols, joined = 0, touched = [];
      var join = function (o, label) {
        var moved = both.find(c) !== both.find(o);
        if (moved) { both.union(c, o); joined++; touched.push(label); }
        if (o < N && real.find(c) !== real.find(o)) real.union(c, o);
      };
      if (r === 0) join(TOP, 'the top edge');
      if (r === rows - 1) join(BOT, 'the bottom edge');
      if (r > 0 && open[c - cols]) join(c - cols, 'the site above');
      if (r < rows - 1 && open[c + cols]) join(c + cols, 'the site below');
      if (q > 0 && open[c - 1]) join(c - 1, 'the site on the left');
      if (q < cols - 1 && open[c + 1]) join(c + 1, 'the site on the right');
      var wasPerc = percolatesAt >= 0;
      var cap = 'Open site (' + r + ', ' + q + '). ' + (joined ? 'It joins ' + touched.join(', ').replace(/, ([^,]*)$/, ' and $1') + ', so ' + plural(joined + 1, 'group') + ' become one.' : 'None of its neighbours is open, so it starts a group of its own.');
      if (isPerc() && !wasPerc) cap += ' <b>TOP and BOTTOM now share a root: the grid percolates!</b>';
      snap(cap, [r, q], joined);
    }
    return steps;
  }

  /* Monte Carlo: for `trials` random opening orders, the count of open sites when the grid first percolates. */
  function percolationThresholds(size, trials, rng) {
    var N = size * size, out = [];
    for (var t = 0; t < trials; t++) {
      var order = []; for (var i = 0; i < N; i++) order.push(i);
      for (var j = N - 1; j > 0; j--) { var k = Math.floor(rng() * (j + 1)), tmp = order[j]; order[j] = order[k]; order[k] = tmp; }
      var d = new DSU(N + 2, { byRank: true, compress: 'full' }), open = new Uint8Array(N), TOP = N, BOT = N + 1, hit = N;
      for (var s = 0; s < N; s++) {
        var c = order[s], r = Math.floor(c / size), q = c % size;
        open[c] = 1;
        if (r === 0) d.union(c, TOP);
        if (r === size - 1) d.union(c, BOT);
        if (r > 0 && open[c - size]) d.union(c, c - size);
        if (r < size - 1 && open[c + size]) d.union(c, c + size);
        if (q > 0 && open[c - 1]) d.union(c, c - 1);
        if (q < size - 1 && open[c + 1]) d.union(c, c + 1);
        if (d.find(TOP) === d.find(BOT)) { hit = s + 1; break; }
      }
      out.push(hit / N);
    }
    return out;
  }

  /* ================================================================== cycle detection, edge by edge */
  function cycleDetect(n, edges, opts) {
    var d = new DSU(n, { byRank: true, compress: 'full' }), steps = [];
    var edgeStates = {}, accepted = [], nodeStates = {}, cycles = 0, checked = 0, cycleEdges = [];
    function counters() { return { checked: checked, merged: d.unions, cycles: cycles, hops: d.hops }; }
    function push(kind, caption, extra) {
      var s = {
        kind: kind, parent: d.parent.slice(), rank: d.rank.slice(), edgeStates: Object.assign({}, edgeStates),
        states: {}, caption: caption, counters: counters(), n: n, edge: null, cycle: cycleEdges.slice()
      };
      if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
      steps.push(s);
    }
    function pathBetween(u, v) {   // BFS over accepted edges: the cycle a redundant edge closes
      var adj = {}, prev = {}, q = [u], seen = {}; seen[u] = true;
      accepted.forEach(function (ei) { var e = edges[ei]; (adj[e[0]] = adj[e[0]] || []).push([e[1], ei]); (adj[e[1]] = adj[e[1]] || []).push([e[0], ei]); });
      while (q.length) {
        var x = q.shift();
        if (x === v) break;
        (adj[x] || []).forEach(function (p) { if (!seen[p[0]]) { seen[p[0]] = true; prev[p[0]] = [x, p[1]]; q.push(p[0]); } });
      }
      var path = [], nodes = [v], cur = v;
      while (cur !== u && prev[cur]) { path.push(prev[cur][1]); cur = prev[cur][0]; nodes.push(cur); }
      return { edges: path, nodes: nodes };
    }
    push('init', 'Start with ' + n + ' vertices, each alone. Take the edges one at a time: if both ends are already connected, the edge closes a cycle. If not, it joins two groups.', { flow: null });
    edges.forEach(function (e, i) {
      var u = e[0], v = e[1];
      checked++;
      edgeStates[i] = 'compare';
      push('look', 'Edge <b>' + u + '–' + v + '</b>: are ' + u + ' and ' + v + ' already connected through the edges kept so far? Ask find for the root of each.', { edge: i, states: { [u]: 'active', [v]: 'active' } });
      var ru = d.find(u), rv = d.find(v);
      push('roots', 'find(' + u + ') = <b>' + ru + '</b> and find(' + v + ') = <b>' + rv + '</b>. ' + (ru === rv ? 'Same root, so the same group.' : 'Different roots, so different groups.'), { edge: i, states: { [ru]: 'found', [rv]: 'found', [u]: 'active', [v]: 'active' } });
      if (ru === rv) {
        cycles++;
        var pb = pathBetween(u, v);
        cycleEdges = pb.edges.concat([i]);
        edgeStates[i] = 'error';
        pb.edges.forEach(function (ei) { edgeStates[ei] = 'error'; });
        var cyc = pb.nodes.slice().reverse();
        push('cycle', '<b>Cycle!</b> ' + u + ' and ' + v + ' were already connected, so this edge closes the loop ' + cyc.join(' → ') + ' → ' + cyc[0] + '. A cycle-free graph never has an edge with both ends in one group. The edge is left out of the forest.', { edge: i, states: (function () { var s = {}; pb.nodes.forEach(function (x) { s[x] = 'swap'; }); return s; }()), cycleNodes: pb.nodes });
        cycleEdges = [];
        pb.edges.forEach(function (ei) { edgeStates[ei] = 'done'; });
        edgeStates[i] = 'error';
      } else {
        d.link(ru, rv);
        accepted.push(i);
        edgeStates[i] = 'done';
        push('merge', 'Different groups, so the edge joins two separate pieces. Link the roots (union by rank) and keep the edge: the groups are now one.', { edge: i, states: { [d.parent[ru] === rv ? ru : rv]: 'swap', [d.parent[ru] === rv ? rv : ru]: 'found' } });
      }
    });
    push('end', cycles ? '<b>' + plural(cycles, 'edge') + ' closed a cycle</b>, so the graph has at least one cycle.' : '<b>No edge closed a cycle.</b> Every edge joined two different groups: the graph is a forest.', { hasCycle: cycles > 0 });
    return steps;
  }

  /* ================================================================== Kruskal (used again in lesson 30) */
  function kruskal(n, weighted) {
    var edges = weighted.map(function (e, i) { return { a: e[0], b: e[1], w: e[2], id: i }; });
    edges.sort(function (p, q) { return p.w - q.w || p.id - q.id; });
    var d = new DSU(n, { byRank: true, compress: 'full' }), steps = [], edgeStates = {}, total = 0, kept = 0;
    function push(kind, caption, cur) {
      steps.push({ kind: kind, caption: caption, edgeStates: Object.assign({}, edgeStates), cur: cur === undefined ? null : cur, total: total, kept: kept, parent: d.parent.slice(), rank: d.rank.slice(), counters: { kept: kept, weight: total, hops: d.hops } });
    }
    push('init', 'Sort the edges by weight. Then sweep from the lightest: keep an edge only if its ends are in different groups.');
    edges.forEach(function (e) {
      edgeStates[e.id] = 'compare';
      push('look', 'Lightest remaining edge: ' + e.a + '–' + e.b + ' (weight ' + e.w + '). Are the ends already connected?', e.id);
      if (d.union(e.a, e.b)) { kept++; total += e.w; edgeStates[e.id] = 'done'; push('keep', 'Different groups: keep it and merge the groups. Total weight ' + total + '.', e.id); }
      else { edgeStates[e.id] = 'muted'; push('skip', 'Already connected: this edge would close a cycle, so skip it.', e.id); }
    });
    push('end', 'Done: ' + plural(kept, 'edge') + (kept === 1 ? ' connects' : ' connect') + ' the graph with total weight ' + total + '.');
    return steps;
  }

  /* ================================================================== grid components (image segmentation) */
  function gridComponents(rows, cols, cells) {   // cells: array of colour values; equal neighbours join
    var d = new DSU(rows * cols, { byRank: true, compress: 'full' });
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var i = r * cols + c;
      if (c + 1 < cols && cells[i] === cells[i + 1]) d.union(i, i + 1);
      if (r + 1 < rows && cells[i] === cells[i + cols]) d.union(i, i + cols);
    }
    var label = [], map = {}, count = 0;
    for (i = 0; i < rows * cols; i++) { var root = d.find(i); if (!(root in map)) map[root] = count++; label.push(map[root]); }
    return { label: label, count: count };
  }

  /* ================================================================== forest layout (slot units) */
  function forestLayout(parent, opts) {
    opts = opts || {};
    var gap = opts.gap === undefined ? 0.6 : opts.gap, n = parent.length, i;
    var kids = [], mins = new Array(n), pos = new Array(n), roots = [];
    for (i = 0; i < n; i++) kids.push([]);
    for (i = 0; i < n; i++) { if (parent[i] === i) roots.push(i); else kids[parent[i]].push(i); }
    function minOf(v) {
      var m = v, st = [v];
      while (st.length) { var x = st.pop(); if (x < m) m = x; for (var k = 0; k < kids[x].length; k++) st.push(kids[x][k]); }
      return m;
    }
    roots.forEach(function (r) { mins[r] = minOf(r); });
    roots.sort(function (a, b) { return mins[a] - mins[b]; });
    var x = 0, maxDepth = 0;
    function place(v, depth) {
      if (depth > maxDepth) maxDepth = depth;
      var ks = kids[v];
      if (!ks.length) { pos[v] = { x: x + 0.5, y: depth }; x += 1; return; }
      ks.forEach(function (k) { place(k, depth + 1); });
      pos[v] = { x: (pos[ks[0]].x + pos[ks[ks.length - 1]].x) / 2, y: depth };
    }
    roots.forEach(function (r, k) { if (k > 0) x += gap; place(r, 0); });
    return { pos: pos, width: x, depth: maxDepth, roots: roots };
  }

  /* ================================================================== parsing */
  function parseOps(text, n, opts) {
    opts = opts || {};
    var maxOps = opts.maxOps || LIMITS.labOps, ops = [];
    var parts = String(text || '').split(/[;\n]+|,(?![^()]*\))/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return { values: [], error: 'Write at least one operation, for example: union 0 1, find 1' };
    if (parts.length > maxOps) return { values: null, error: 'That is ' + parts.length + ' operations. Keep it to ' + maxOps + ' or fewer so every step stays readable.' };
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i], m;
      if ((m = /^(?:union|u)\s*\(?\s*(\d+)\s*[,\s]\s*(\d+)\s*\)?$/i.exec(s)) || (m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(s))) ops.push({ type: 'union', a: +m[1], b: +m[2] });
      else if ((m = /^(?:find|f)\s*\(?\s*(\d+)\s*\)?$/i.exec(s))) ops.push({ type: 'find', a: +m[1] });
      else return { values: null, error: '“' + s + '” is not an operation. Write union 3 4 (or 3-4) to merge, or find 3 to look up.' };
      var op = ops[ops.length - 1];
      var bad = op.a >= n ? op.a : (op.type === 'union' && op.b >= n ? op.b : -1);
      if (bad >= 0) return { values: null, error: 'Element ' + bad + ' does not exist. With ' + n + ' elements, use 0 to ' + (n - 1) + '.' };
    }
    return { values: ops, error: null };
  }

  function parseEdges(text, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || LIMITS.graphNodes, maxEdges = opts.maxEdges || LIMITS.graphEdges;
    var parts = String(text || '').split(/[;\n]+|,(?![^()]*\))/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return { values: null, error: 'Write at least one edge, for example: 0-1, 1-2, 2-0' };
    if (parts.length > maxEdges) return { values: null, error: 'That is ' + parts.length + ' edges. Keep it to ' + maxEdges + ' or fewer.' };
    var edges = [], top = -1;
    for (var i = 0; i < parts.length; i++) {
      var m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(parts[i]);
      if (!m) return { values: null, error: '“' + parts[i] + '” is not an edge. Write two vertex numbers joined by a dash, like 3-4.' };
      var a = +m[1], b = +m[2];
      if (a === b) return { values: null, error: 'The edge ' + parts[i] + ' joins a vertex to itself. Use two different vertices.' };
      if (a >= maxNodes || b >= maxNodes) return { values: null, error: 'Vertex ' + Math.max(a, b) + ' is too big. Use vertices 0 to ' + (maxNodes - 1) + '.' };
      edges.push([a, b]); top = Math.max(top, a, b);
    }
    return { values: { n: top + 1, edges: edges }, error: null };
  }

  return {
    LIMITS: LIMITS, CFG_NAIVE: CFG_NAIVE, CFG_BOTH: CFG_BOTH,
    DSU: DSU, trace: trace, race: race, frames: frames, workload: workload, curve: curve, alpha: alpha,
    percolation: percolation, percolationThresholds: percolationThresholds,
    cycleDetect: cycleDetect, kruskal: kruskal, gridComponents: gridComponents, forestLayout: forestLayout,
    parseOps: parseOps, parseEdges: parseEdges, opsToText: opsToText, opText: opText,
    groupsOf: groupsOf, heightOf: heightOf, rootOf: rootOf
  };
}));
