/* Segment trees and Fenwick trees: pure step generators. No DOM.
   UMD: in the browser it attaches to VDSA.algos.rangeTrees; in Node it exports the same API.

   Segment tree (recursive, heap numbering: root 1, children 2k and 2k + 1; segments [lo, hi], mid = (lo + hi) >> 1)
     rangeTrees.shape(n)                   -> {n, nodes, byId, root, maxDepth}   nodes: {id, lo, hi, depth, k, parent, left, right, leaf}
     rangeTrees.treeValues(op, arr)        -> {nodeId: value}    op: 'sum' | 'min' | 'max' | 'gcd'
     rangeTrees.segBuild(op, arr)          -> steps
     rangeTrees.segQuery(op, arr, l, r)    -> steps   (0-based, inclusive)
     rangeTrees.segUpdate(op, arr, i, v)   -> steps   (point assignment a[i] = v)
     rangeTrees.lazyRun(arr, ops)          -> steps   ops: [{type: 'add', l, r, v} | {type: 'query', l, r}]  (sum tree, lazy tags)
   Segment-tree snapshots:
     { type: 'seg', op, n, kind, arr, vals: {id: value | undefined}, states: {id: state}, ret: {id: value},
       tags: {id: pending add}, stale: {id: true}, cells: {index: state}, query: {l, r} | null,
       cur: id | null, move: {from, to, dir: 'down' | 'up'} | null,
       caption, line, vars, counters, flow, answer? }
   Fenwick tree (1-based indices; T[i] stores the sum of the lowbit(i) elements ending at i)
     rangeTrees.lowbit(i), rangeTrees.fenTree(arr) -> T (array of length n, T[k] belongs to index k + 1)
     rangeTrees.fenPrefix(arr, i)          -> steps   prefix(i) = a[1] + ... + a[i], 0 <= i <= n
     rangeTrees.fenRange(arr, l, r)        -> steps   a[l] + ... + a[r] = prefix(r) - prefix(l - 1), 1 <= l <= r <= n
     rangeTrees.fenUpdate(arr, i, delta)   -> steps   a[i] += delta
   Fenwick snapshots:
     { type: 'fen', n, kind, arr, tree, cursor: index | null, bars: {index: state}, cells: {index: state}, jumps: [{from, to, label, phase}],
       calc: {i, low, next, mode: 'sub' | 'add'} | null, acc, phase, caption, line, vars, counters, flow, answer? }
   Cost helpers (fast, no steps; tested against the step counters)
     rangeTrees.segQueryCost(n, l, r) -> {visited, used};  segUpdateCost(n, i) -> nodes on the root-to-leaf path
     rangeTrees.fenQueryCost(i), fenUpdateCost(n, i);  rangeTrees.costs(n, {samples, seed}) -> average costs of the approaches
   Code (labels match step.line): rangeTrees.segCode(kind, op) for kind 'build' | 'query' | 'update';
     rangeTrees.LAZY_CODE, rangeTrees.FEN_CODE.prefix | range | update

   Truth rules (tested in tests/algos/23-segment-and-fenwick-trees.test.js): a node is coloured 'done' only when its
   whole segment lies inside the query; the answer equals a naive loop; an update recomputes exactly the nodes on the
   root-to-leaf path; under lazy propagation a node is 'stale' exactly when some ancestor holds a non-zero pending tag;
   every Fenwick jump is i - (i & -i) for a query and i + (i & -i) for an update. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.rangeTrees = Object.assign(V.algos.rangeTrees || {}, api);
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  function copy(o) { return Object.assign({}, o); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function fmt(v) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '−∞';
    return v < 0 ? '−' + Math.abs(v) : String(v);
  }
  var OPS = {
    sum: { id: 0, f: function (a, b) { return a + b; }, word: 'sum' },
    min: { id: Infinity, f: function (a, b) { return Math.min(a, b); }, word: 'minimum' },
    max: { id: -Infinity, f: function (a, b) { return Math.max(a, b); }, word: 'maximum' },
    gcd: { id: 0, f: gcd, word: 'gcd' }
  };
  function opOf(op) { var o = OPS[op]; if (!o) throw new Error('Unknown operation: ' + op); return o; }
  function expr(op, a, b) { return op === 'sum' ? fmt(a) + ' + ' + fmt(b) : op + '(' + fmt(a) + ', ' + fmt(b) + ')'; }
  function seg(lo, hi) { return lo === hi ? '[' + lo + ']' : '[' + lo + ', ' + hi + ']'; }
  function checkArr(arr, min) {
    if (!Array.isArray(arr) || arr.length < (min || 1)) throw new Error('Need at least ' + (min || 1) + ' value(s).');
    arr.forEach(function (v) { if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) throw new Error('Values must be whole numbers.'); });
  }
  function checkRange(n, l, r) {
    if (Math.floor(l) !== l || Math.floor(r) !== r || l < 0 || r >= n || l > r) throw new Error('Need 0 ≤ l ≤ r ≤ ' + (n - 1) + '.');
  }

  /* ------------------------------------------------------------------ segment tree shape and values */
  function shape(n) {
    if (!(n >= 1)) throw new Error('n must be at least 1');
    var nodes = [], byId = {}, maxDepth = 0;
    function rec(lo, hi, depth, k, parent) {
      var id = 's' + lo + '_' + hi;
      var nd = { id: id, lo: lo, hi: hi, depth: depth, k: k, parent: parent, left: null, right: null, leaf: lo === hi };
      nodes.push(nd); byId[id] = nd;
      if (depth > maxDepth) maxDepth = depth;
      if (lo < hi) {
        var mid = (lo + hi) >> 1;
        nd.left = rec(lo, mid, depth + 1, 2 * k, id);
        nd.right = rec(mid + 1, hi, depth + 1, 2 * k + 1, id);
      }
      return id;
    }
    var rootId = rec(0, n - 1, 0, 1, null);
    return { n: n, nodes: nodes, byId: byId, root: rootId, maxDepth: maxDepth };
  }

  function treeValues(op, arr, shp) {
    var o = opOf(op); shp = shp || shape(arr.length);
    var vals = {};
    (function rec(id) {
      var nd = shp.byId[id];
      if (nd.leaf) { vals[id] = arr[nd.lo]; return vals[id]; }
      vals[id] = o.f(rec(nd.left), rec(nd.right));
      return vals[id];
    })(shp.root);
    return vals;
  }

  function staleOf(shp, tags) {
    var stale = {};
    Object.keys(tags).forEach(function (id) {
      if (!tags[id]) return;
      (function mark(x) {
        var nd = shp.byId[x];
        if (nd.left) { stale[nd.left] = true; stale[nd.right] = true; mark(nd.left); mark(nd.right); }
      })(id);
    });
    return stale;
  }

  /* A recorder holding the mutable picture; push() freezes a copy of it as a snapshot. */
  function recorder(op, shp, arr, counters) {
    var R = { op: op, shp: shp, arr: arr.slice(), vals: {}, states: {}, ret: {}, tags: {}, cells: {}, query: null, counters: counters, steps: [] };
    R.push = function (kind, caption, line, o) {
      o = o || {};
      var s = {
        type: 'seg', op: R.op, n: R.arr.length, kind: kind,
        arr: R.arr.slice(), vals: copy(R.vals), states: copy(R.states), ret: copy(R.ret), tags: copy(R.tags), stale: staleOf(shp, R.tags), cells: copy(R.cells),
        query: R.query ? { l: R.query.l, r: R.query.r } : null,
        cur: o.cur || null, move: o.move ? copy(o.move) : null,
        caption: caption, line: line, vars: o.vars || {}, counters: copy(R.counters), flow: o.flow
      };
      if (o.answer !== undefined) s.answer = o.answer;
      if (o.answers) s.answers = o.answers;
      if (o.opIndex !== undefined) s.opIndex = o.opIndex;
      R.steps.push(s);
    };
    return R;
  }

  /* ------------------------------------------------------------------ segment tree: build */
  function segBuild(op, arr) {
    checkArr(arr); var o = opOf(op), n = arr.length, shp = shape(n);
    var R = recorder(op, shp, arr, { written: 0 });
    var last = null;
    function mark(id) { if (last) R.states[last] = 'visited'; R.states[id] = 'swap'; last = id; }
    R.push('init', 'Build the tree for a <b>' + o.word + '</b> over ' + n + ' value' + (n > 1 ? 's' : '') + '. Every leaf will copy one cell; every other node will combine its two children, so the nodes are filled from the bottom up.', 'call', { flow: 'start' });
    (function rec(id) {
      var nd = shp.byId[id];
      if (nd.leaf) {
        R.vals[id] = arr[nd.lo]; R.counters.written++; mark(id);
        R.cells[nd.lo] = 'done';
        R.push('leaf', 'Leaf ' + seg(nd.lo, nd.hi) + ' copies a[' + nd.lo + '] = <b>' + fmt(arr[nd.lo]) + '</b>. A one-cell segment needs no combining.', 'bleaf', { cur: id, flow: 'leaf', vars: { node: nd.k, lo: nd.lo, hi: nd.hi } });
        return;
      }
      rec(nd.left); rec(nd.right);
      var a = R.vals[nd.left], b = R.vals[nd.right], v = o.f(a, b);
      R.vals[id] = v; R.counters.written++; mark(id);
      R.push('pull', 'Node ' + seg(nd.lo, nd.hi) + ' = its left half ' + seg(shp.byId[nd.left].lo, shp.byId[nd.left].hi) + ' and right half ' + seg(shp.byId[nd.right].lo, shp.byId[nd.right].hi) + ': ' + expr(op, a, b) + ' = <b>' + fmt(v) + '</b>. Both children were finished first, so their values can be trusted.', 'bpull', { cur: id, move: { from: nd.left, to: id, dir: 'up' }, flow: 'pull', vars: { node: nd.k, lo: nd.lo, hi: nd.hi, left: a, right: b } });
    })(shp.root);
    R.states[last] = 'visited';
    R.push('done', 'Built. ' + (2 * n - 1) + ' nodes for ' + n + ' cells: n leaves plus n − 1 internal nodes, each written exactly once.', 'call', { flow: 'end', answer: R.vals[shp.root] });
    return R.steps;
  }

  /* ------------------------------------------------------------------ segment tree: range query */
  function segQuery(op, arr, l, r) {
    checkArr(arr); var o = opOf(op), n = arr.length; checkRange(n, l, r);
    var shp = shape(n);
    var R = recorder(op, shp, arr, { visited: 0, used: 0 });
    R.vals = treeValues(op, arr, shp); R.query = { l: l, r: r };
    var idTxt = fmt(o.id);
    R.push('init', 'Ask for the <b>' + o.word + '</b> of <b>a[' + l + '..' + r + ']</b>. Start at the root: it covers the whole array ' + seg(0, n - 1) + ', which is more than the question, so it cannot answer alone.', 'call', { flow: 'start', vars: { l: l, r: r } });
    function go(id, parent) {
      var nd = shp.byId[id], down = parent ? { from: parent, to: id, dir: 'down' } : null;
      R.counters.visited++;
      var vars = { node: nd.k, lo: nd.lo, hi: nd.hi, l: l, r: r };
      if (nd.hi < l || r < nd.lo) {
        R.states[id] = 'muted'; R.ret[id] = o.id;
        R.push('outside', 'Segment ' + seg(nd.lo, nd.hi) + ' and [' + l + ', ' + r + '] share no cell, so nothing in this node can belong to the answer. Return the identity (' + idTxt + ') and never open the node.', 'outside', { cur: id, move: down, flow: 'outside', vars: Object.assign(vars, { returns: o.id }) });
        return o.id;
      }
      if (l <= nd.lo && nd.hi <= r) {
        R.states[id] = 'done'; R.ret[id] = R.vals[id]; R.counters.used++;
        R.push('inside', 'Segment ' + seg(nd.lo, nd.hi) + ' lies entirely inside [' + l + ', ' + r + '], so its stored ' + o.word + ' <b>' + fmt(R.vals[id]) + '</b> is exactly what we need. Take it and skip every node below.', 'inside', { cur: id, move: down, flow: 'inside', vars: Object.assign(vars, { returns: R.vals[id] }) });
        return R.vals[id];
      }
      R.states[id] = 'compare';
      R.push('split', 'Segment ' + seg(nd.lo, nd.hi) + ' overlaps [' + l + ', ' + r + '] only in part. Its stored value would include cells we do not want, so split at mid = ' + ((nd.lo + nd.hi) >> 1) + ' and ask both halves.', 'split', { cur: id, move: down, flow: 'split', vars: vars });
      var a = go(nd.left, id);
      R.push('left', 'The left half ' + seg(shp.byId[nd.left].lo, shp.byId[nd.left].hi) + ' answers <b>' + fmt(a) + '</b>. Now the right half.', 'left', { cur: id, move: { from: nd.left, to: id, dir: 'up' }, flow: 'split', vars: Object.assign({}, vars, { left: a }) });
      var b = go(nd.right, id);
      var c = o.f(a, b);
      R.ret[id] = c;
      R.push('combine', 'The right half answers <b>' + fmt(b) + '</b>. Combine the two answers: ' + expr(op, a, b) + ' = <b>' + fmt(c) + '</b>, and hand that up.', ['right', 'combine'], { cur: id, move: { from: nd.right, to: id, dir: 'up' }, flow: 'combine', vars: Object.assign({}, vars, { left: a, right: b, returns: c }) });
      return c;
    }
    var ans = go(shp.root, null);
    R.push('done', 'The answer is <b>' + fmt(ans) + '</b>. The query visited <b>' + R.counters.visited + '</b> of ' + shp.nodes.length + ' nodes and combined <b>' + R.counters.used + '</b> stored values; a plain loop would have read ' + (r - l + 1) + ' cell' + (r > l ? 's' : '') + '.', 'call', { flow: 'end', answer: ans, vars: { answer: ans } });
    return R.steps;
  }

  /* ------------------------------------------------------------------ segment tree: point update */
  function segUpdate(op, arr, i, v) {
    checkArr(arr); var o = opOf(op), n = arr.length;
    if (Math.floor(i) !== i || i < 0 || i >= n) throw new Error('Need 0 ≤ i ≤ ' + (n - 1) + '.');
    if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) throw new Error('The new value must be a whole number.');
    var shp = shape(n);
    var R = recorder(op, shp, arr, { visited: 0, written: 0 });
    R.vals = treeValues(op, arr, shp);
    var path = [shp.root];
    while (!shp.byId[path[path.length - 1]].leaf) {
      var nd0 = shp.byId[path[path.length - 1]], mid0 = (nd0.lo + nd0.hi) >> 1;
      path.push(i <= mid0 ? nd0.left : nd0.right);
    }
    R.cells[i] = 'compare';
    R.push('init', 'Set <b>a[' + i + ']</b> from ' + fmt(arr[i]) + ' to <b>' + fmt(v) + '</b>. Every node whose segment contains index ' + i + ' stores a value that used to include the old number, so exactly those ' + path.length + ' node' + (path.length > 1 ? 's' : '') + ' must change.', 'call', { flow: 'start', vars: { i: i, v: v } });
    path.forEach(function (id, k) {
      var nd = shp.byId[id];
      R.counters.visited++;
      R.states[id] = 'path';
      if (nd.leaf) return;
      var mid = (nd.lo + nd.hi) >> 1, goLeft = i <= mid;
      R.push('descend', 'Segment ' + seg(nd.lo, nd.hi) + ' contains index ' + i + '. Since ' + i + (goLeft ? ' ≤ ' : ' > ') + 'mid = ' + mid + ', the index lives in the <b>' + (goLeft ? 'left' : 'right') + '</b> half: go there. The other half cannot contain it, so it is never touched.', ['descend', goLeft ? 'goleft' : 'goright'], { cur: id, move: k ? { from: path[k - 1], to: id, dir: 'down' } : null, flow: 'descend', vars: { node: nd.k, lo: nd.lo, hi: nd.hi, i: i, mid: mid } });
    });
    var leaf = shp.byId[path[path.length - 1]];
    R.counters.visited = path.length;
    R.arr[i] = v; R.vals[leaf.id] = v; R.states[leaf.id] = 'swap'; R.cells[i] = 'swap'; R.counters.written++;
    R.push('leaf', 'Reached the leaf ' + seg(i, i) + '. Overwrite it with <b>' + fmt(v) + '</b>. Now the ancestors are out of date.', 'leaf', { cur: leaf.id, move: path.length > 1 ? { from: path[path.length - 2], to: leaf.id, dir: 'down' } : null, flow: 'leaf', vars: { node: leaf.k, lo: leaf.lo, hi: leaf.hi, i: i, v: v } });
    for (var k = path.length - 2; k >= 0; k--) {
      var nd = shp.byId[path[k]], a = R.vals[nd.left], b = R.vals[nd.right], old = R.vals[nd.id], nv = o.f(a, b);
      R.vals[nd.id] = nv; R.states[nd.id] = 'swap'; R.counters.written++;
      R.push('pull', 'Recompute ' + seg(nd.lo, nd.hi) + ' from its two children: ' + expr(op, a, b) + ' = <b>' + fmt(nv) + '</b>' + (nv === old ? ' (it happens to be unchanged)' : ' (was ' + fmt(old) + ')') + '. Then check the parent.', 'pull', { cur: nd.id, move: { from: path[k + 1], to: nd.id, dir: 'up' }, flow: 'pull', vars: { node: nd.k, lo: nd.lo, hi: nd.hi, left: a, right: b } });
    }
    R.push('done', 'Done: <b>' + path.length + '</b> node' + (path.length > 1 ? 's were' : ' was') + ' rewritten out of ' + shp.nodes.length + '. Everything off the path still describes segments that do not contain index ' + i + ', so it is still correct.', 'call', { flow: 'end', answer: R.vals[shp.root] });
    return R.steps;
  }

  /* ------------------------------------------------------------------ lazy propagation (sum tree, range add) */
  function lazyRun(arr, ops) {
    checkArr(arr); var n = arr.length, shp = shape(n);
    if (!Array.isArray(ops) || !ops.length) throw new Error('Need at least one operation.');
    ops.forEach(function (op) {
      checkRange(n, op.l, op.r);
      if (op.type === 'add' && (typeof op.v !== 'number' || Math.floor(op.v) !== op.v)) throw new Error('The amount to add must be a whole number.');
      if (op.type !== 'add' && op.type !== 'query') throw new Error('Unknown operation: ' + op.type);
    });
    var R = recorder('sum', shp, arr, { visited: 0, pushes: 0 });
    R.vals = treeValues('sum', arr, shp);
    var truth = arr.slice(), answers = [];
    function len(nd) { return nd.hi - nd.lo + 1; }
    function tagOf(id) { return R.tags[id] || 0; }
    function setTag(id, t) { if (t) R.tags[id] = t; else delete R.tags[id]; }
    function applyTo(nd, v) { R.vals[nd.id] += v * len(nd); setTag(nd.id, tagOf(nd.id) + v); }
    function pushDown(nd, vars, cause) {
      var t = tagOf(nd.id);
      if (!t) return false;
      var L = shp.byId[nd.left], Rt = shp.byId[nd.right];
      applyTo(L, t); applyTo(Rt, t); setTag(nd.id, 0); R.counters.pushes++;
      R.states[L.id] = 'swap'; R.states[Rt.id] = 'swap';
      R.push('push', 'Node ' + seg(nd.lo, nd.hi) + ' holds a pending <b>+' + fmt(t) + '</b>: its children never heard about it. Before ' + cause + ' we must look below, so hand it down: each child gains ' + fmt(t) + ' × its length and inherits the tag, and this node’s tag is cleared.', cause === 'reading' ? ['qpush', 'clear'] : ['apush', 'clear'], { cur: nd.id, flow: 'push', vars: Object.assign({}, vars, { tag: t }) });
      delete R.states[L.id]; delete R.states[Rt.id];
      return true;
    }
    R.push('init', 'A <b>range add</b> changes many cells at once. Instead of rewriting every leaf, the tree will leave a <b>pending tag</b> on the biggest fully covered nodes and only push it down when a later operation needs to look inside.', 'call', { flow: 'start' });
    var opIndex = 0;
    ops.forEach(function (op, oi) {
      opIndex = oi;
      R.query = { l: op.l, r: op.r }; R.states = {}; R.ret = {}; R.cells = {};
      var label = 'Operation ' + (oi + 1) + ' of ' + ops.length + ': ';
      if (op.type === 'add') {
        for (var k = op.l; k <= op.r; k++) { truth[k] += op.v; R.cells[k] = 'swap'; }
        R.arr = truth.slice();
        R.push('opstart', label + 'add <b>' + fmt(op.v) + '</b> to every cell of a[' + op.l + '..' + op.r + '] (the array row shows the true values). The tree must not pay one write per cell.', 'call', { flow: 'start', opIndex: oi, vars: { l: op.l, r: op.r, v: op.v } });
        (function add(id, parent) {
          var nd = shp.byId[id], down = parent ? { from: parent, to: id, dir: 'down' } : null;
          R.counters.visited++;
          var vars = { node: nd.k, lo: nd.lo, hi: nd.hi, l: op.l, r: op.r, v: op.v };
          if (nd.hi < op.l || op.r < nd.lo) {
            R.states[id] = 'muted';
            R.push('outside', 'Segment ' + seg(nd.lo, nd.hi) + ' does not overlap [' + op.l + ', ' + op.r + ']: skip it, and do not push anything into it.', 'aout', { cur: id, move: down, flow: 'outside', vars: vars });
            return;
          }
          if (op.l <= nd.lo && nd.hi <= op.r) {
            applyTo(nd, op.v); R.states[id] = 'swap';
            R.push('inside', 'Segment ' + seg(nd.lo, nd.hi) + ' is fully covered. Add ' + fmt(op.v) + ' × ' + len(nd) + ' = <b>' + fmt(op.v * len(nd)) + '</b> to its sum and leave a tag <b>+' + fmt(tagOf(id)) + '</b>. The children below are now <em>stale</em> (dashed): they still show the old numbers, and that is fine until someone looks.', ['ain', 'apply'], { cur: id, move: down, flow: 'inside', vars: vars });
            return;
          }
          R.states[id] = 'compare';
          if (!pushDown(nd, vars, 'updating')) R.push('split', 'Segment ' + seg(nd.lo, nd.hi) + ' overlaps the range only in part, and it has no pending tag, so both children are up to date. Recurse into both halves.', 'asplit', { cur: id, move: down, flow: 'split', vars: vars });
          R.states[id] = 'compare';
          add(nd.left, id); add(nd.right, id);
          var a = R.vals[nd.left], b = R.vals[nd.right];
          R.vals[id] = a + b; R.states[id] = 'compare';
          R.push('combine', 'Both halves are done, so recompute this node from them: ' + fmt(a) + ' + ' + fmt(b) + ' = <b>' + fmt(a + b) + '</b>. Its own tag stays zero.', 'apull', { cur: id, move: { from: nd.right, to: id, dir: 'up' }, flow: 'combine', vars: vars });
        })(shp.root, null);
        R.push('opdone', 'The add is finished. The tree did ' + R.counters.visited + ' node visits in total so far, not ' + (op.r - op.l + 1) + ' leaf writes. Tags still wait on the covered nodes.', 'call', { flow: 'end', opIndex: oi });
      } else {
        R.push('opstart', label + 'sum of a[' + op.l + '..' + op.r + ']. Stored values below a tag may be stale, so we push tags down whenever the walk must go through a tagged node.', 'call', { flow: 'start', opIndex: oi, vars: { l: op.l, r: op.r } });
        var ans = (function q(id, parent) {
          var nd = shp.byId[id], down = parent ? { from: parent, to: id, dir: 'down' } : null;
          R.counters.visited++;
          var vars = { node: nd.k, lo: nd.lo, hi: nd.hi, l: op.l, r: op.r };
          if (nd.hi < op.l || op.r < nd.lo) {
            R.states[id] = 'muted'; R.ret[id] = 0;
            R.push('outside', 'Segment ' + seg(nd.lo, nd.hi) + ' is outside the query: contributes 0.', 'qout', { cur: id, move: down, flow: 'outside', vars: vars });
            return 0;
          }
          if (op.l <= nd.lo && nd.hi <= op.r) {
            R.states[id] = 'done'; R.ret[id] = R.vals[id];
            R.push('inside', 'Segment ' + seg(nd.lo, nd.hi) + ' is fully inside the query. Its stored sum <b>' + fmt(R.vals[id]) + '</b> is correct even if a tag is waiting on it: the tag only describes what the children still owe.', 'qin', { cur: id, move: down, flow: 'inside', vars: vars });
            return R.vals[id];
          }
          R.states[id] = 'compare';
          if (!pushDown(nd, vars, 'reading')) R.push('split', 'Segment ' + seg(nd.lo, nd.hi) + ' overlaps the query in part and has no pending tag: its children are trustworthy. Ask both.', 'qsplit', { cur: id, move: down, flow: 'split', vars: vars });
          R.states[id] = 'compare';
          var a = q(nd.left, id), b = q(nd.right, id), c = a + b;
          R.ret[id] = c;
          R.push('combine', 'Combine the halves: ' + fmt(a) + ' + ' + fmt(b) + ' = <b>' + fmt(c) + '</b>.', 'qcomb', { cur: id, move: { from: nd.right, to: id, dir: 'up' }, flow: 'combine', vars: Object.assign({}, vars, { left: a, right: b }) });
          return c;
        })(shp.root, null);
        answers.push(ans);
        R.push('opdone', 'The sum of a[' + op.l + '..' + op.r + '] is <b>' + fmt(ans) + '</b>' + (ans === truth.slice(op.l, op.r + 1).reduce(function (x, y) { return x + y; }, 0) ? ', which matches the true values in the array row.' : '.'), 'call', { flow: 'end', opIndex: oi, answer: ans });
      }
    });
    R.push('done', 'All ' + ops.length + ' operations are done after <b>' + R.counters.visited + '</b> node visits and <b>' + R.counters.pushes + '</b> tag push' + (R.counters.pushes === 1 ? '' : 'es') + '.', 'call', { flow: 'end', answers: answers, opIndex: opIndex });
    return R.steps;
  }

  /* ------------------------------------------------------------------ Fenwick tree */
  function lowbit(i) { return i & -i; }
  function fenTree(arr) {
    var n = arr.length, T = [], k;
    for (k = 1; k <= n; k++) {
      var s = 0;
      for (var j = k - lowbit(k) + 1; j <= k; j++) s += arr[j - 1];
      T.push(s);
    }
    return T;
  }
  function fenRec(arr, counters) {
    var n = arr.length;
    var F = { n: n, arr: arr.slice(), tree: fenTree(arr), bars: {}, cells: {}, jumps: [], acc: 0, phase: '', counters: counters, steps: [] };
    F.push = function (kind, caption, line, o) {
      o = o || {};
      var s = {
        type: 'fen', n: n, kind: kind, arr: F.arr.slice(), tree: F.tree.slice(), cursor: o.cursor === undefined ? null : o.cursor,
        bars: copy(F.bars), cells: copy(F.cells), jumps: F.jumps.map(copy), calc: o.calc || null, acc: F.acc, phase: o.phase !== undefined ? o.phase : F.phase,
        caption: caption, line: line, vars: o.vars || {}, counters: copy(F.counters), flow: o.flow
      };
      if (o.answer !== undefined) s.answer = o.answer;
      F.steps.push(s);
    };
    return F;
  }
  function coverText(j) { var lo = j - lowbit(j) + 1; return lo === j ? 'a[' + j + ']' : 'a[' + lo + '..' + j + ']'; }
  function bin(x, w) { var s = x.toString(2); while (s.length < w) s = '0' + s; return s; }

  /* Adds T[j] for j = i, i - lowbit(i), ... > 0; sign +1 adds to F.acc, -1 subtracts. Shared by prefix and range. */
  function fenWalk(F, i, o) {
    var j = i, w = Math.max(3, F.n.toString(2).length);
    F.phase = o.phase;
    while (j > 0) {
      var low = lowbit(j);
      F.bars[j] = 'active';
      for (var c = j - low + 1; c <= j; c++) F.cells[c] = o.state;
      F.counters.steps++;
      var before = F.acc;
      F.acc += o.sign * F.tree[j - 1];
      F.push('add', 'Index ' + j + ' = ' + bin(j, w) + '<sub>2</sub>. Its lowest set bit is ' + low + ', so <b>T[' + j + ']</b> = ' + F.tree[j - 1] + ' covers ' + coverText(j) + ' (' + low + ' element' + (low > 1 ? 's' : '') + '). ' + (o.sign > 0 ? 'Add it: ' + before + ' + ' + F.tree[j - 1] + ' = <b>' + F.acc + '</b>.' : 'Take it away: ' + before + ' − ' + F.tree[j - 1] + ' = <b>' + F.acc + '</b>.'), 'add',
        { cursor: j, calc: { i: j, low: low, next: j - low, mode: 'sub' }, phase: o.phase, vars: { i: j, low: low, sum: F.acc } });
      F.bars[j] = o.barState;
      var nj = j - low;
      F.jumps.push({ from: j, to: nj, label: '−' + low, phase: o.phase });
      F.push('jump', 'Everything ' + coverText(j) + ' is counted. Strip the lowest set bit: ' + j + ' − ' + low + ' = <b>' + nj + '</b> (' + bin(nj, w) + '<sub>2</sub>). ' + (nj > 0 ? 'The remaining elements are a[1..' + nj + '].' : 'Nothing is left to add.'), 'jump',
        { cursor: nj, calc: { i: j, low: low, next: nj, mode: 'sub' }, phase: o.phase, vars: { i: nj, low: low, sum: F.acc } });
      j = nj;
    }
  }

  function fenPrefix(arr, i) {
    checkArr(arr); var n = arr.length;
    if (Math.floor(i) !== i || i < 0 || i > n) throw new Error('Need 0 ≤ i ≤ ' + n + '.');
    var F = fenRec(arr, { steps: 0 });
    F.push('init', 'Compute <b>prefix(' + i + ')</b> = a[1] + … + a[' + i + ']. ' + (i ? 'Write ' + i + ' in binary: each set bit names one block of the prefix.' : 'An empty prefix is 0.'), 'top', { cursor: i, flow: 'start', vars: { i: i, sum: 0 } });
    fenWalk(F, i, { sign: 1, state: 'done', barState: 'done', phase: 'prefix' });
    F.push('done', '<b>prefix(' + i + ') = ' + F.acc + '</b>, from ' + F.counters.steps + ' block' + (F.counters.steps === 1 ? '' : 's') + ' (one per set bit of ' + i + '). A loop over the array would have added ' + i + ' cell' + (i === 1 ? '' : 's') + '.', 'ret', { cursor: 0, flow: 'end', answer: F.acc, vars: { i: 0, sum: F.acc } });
    return F.steps;
  }

  function fenRange(arr, l, r) {
    checkArr(arr); var n = arr.length;
    if (Math.floor(l) !== l || Math.floor(r) !== r || l < 1 || r > n || l > r) throw new Error('Need 1 ≤ l ≤ r ≤ ' + n + '.');
    var F = fenRec(arr, { steps: 0 });
    F.push('init', 'Sum of <b>a[' + l + '..' + r + ']</b> = prefix(' + r + ') − prefix(' + (l - 1) + '). Two prefix walks, one subtracted from the other.', 'rtop', { cursor: r, flow: 'start', vars: { l: l, r: r } });
    fenWalk(F, r, { sign: 1, state: 'done', barState: 'done', phase: 'prefix(' + r + ')' });
    var p1 = F.acc;
    F.cells = {};
    F.push('mid', 'prefix(' + r + ') = <b>' + p1 + '</b>. It includes a[1..' + (l - 1) + '], which the question does not want. Subtract prefix(' + (l - 1) + ').', 'rsub', { cursor: l - 1, phase: 'prefix(' + (l - 1) + ')', vars: { l: l, r: r, sum: p1 } });
    var keep = F.acc;
    F.acc = 0;
    // second walk: prefix(l - 1) is computed on its own, then subtracted
    var acc2 = 0, j = l - 1, w = Math.max(3, n.toString(2).length);
    F.phase = 'prefix(' + (l - 1) + ')';
    while (j > 0) {
      var low = lowbit(j);
      F.bars[j] = 'active';
      for (var c = j - low + 1; c <= j; c++) F.cells[c] = 'compare';
      F.counters.steps++;
      acc2 += F.tree[j - 1];
      F.acc = acc2;
      F.push('add', 'Index ' + j + ' = ' + bin(j, w) + '<sub>2</sub>: <b>T[' + j + ']</b> = ' + F.tree[j - 1] + ' covers ' + coverText(j) + '. Add it to the second prefix: <b>' + acc2 + '</b> so far.', 'add', { cursor: j, calc: { i: j, low: low, next: j - low, mode: 'sub' }, vars: { i: j, low: low, sum: acc2 } });
      F.bars[j] = 'compare';
      var nj = j - low;
      F.jumps.push({ from: j, to: nj, label: '−' + low, phase: F.phase });
      F.push('jump', 'Strip the lowest set bit: ' + j + ' − ' + low + ' = <b>' + nj + '</b>.', 'jump', { cursor: nj, calc: { i: j, low: low, next: nj, mode: 'sub' }, vars: { i: nj, low: low, sum: acc2 } });
      j = nj;
    }
    F.acc = keep - acc2;
    F.push('done', '<b>' + p1 + ' − ' + acc2 + ' = ' + F.acc + '</b> is the sum of a[' + l + '..' + r + '], found by touching ' + F.counters.steps + ' blocks instead of ' + (r - l + 1) + ' cells.', 'rsub', { cursor: null, flow: 'end', answer: F.acc, vars: { l: l, r: r, sum: F.acc } });
    return F.steps;
  }

  function fenUpdate(arr, i, delta) {
    checkArr(arr); var n = arr.length;
    if (Math.floor(i) !== i || i < 1 || i > n) throw new Error('Need 1 ≤ i ≤ ' + n + '.');
    if (typeof delta !== 'number' || !isFinite(delta) || Math.floor(delta) !== delta) throw new Error('The amount to add must be a whole number.');
    var F = fenRec(arr, { steps: 0 });
    F.phase = 'update';
    F.arr[i - 1] += delta; F.cells[i] = 'swap';
    var j = i, w = Math.max(3, n.toString(2).length);
    F.push('init', 'Add <b>' + (delta >= 0 ? '+' : '−') + Math.abs(delta) + '</b> to <b>a[' + i + ']</b>. Every block that contains index ' + i + ' must grow by the same amount. Those blocks are T[' + i + '] and then whatever covers it next.', 'utop', { cursor: i, flow: 'start', vars: { i: i, delta: delta } });
    while (j <= n) {
      var low = lowbit(j), old = F.tree[j - 1];
      F.bars[j] = 'swap'; F.counters.steps++;
      F.tree[j - 1] = old + delta;
      F.push('write', 'Index ' + j + ' = ' + bin(j, w) + '<sub>2</sub>: <b>T[' + j + ']</b> covers ' + coverText(j) + ', which contains index ' + i + '. Update it: ' + old + ' → <b>' + F.tree[j - 1] + '</b>.', 'uadd', { cursor: j, calc: { i: j, low: low, next: j + low, mode: 'add' }, vars: { i: j, low: low, delta: delta } });
      var nj = j + low;
      F.jumps.push({ from: j, to: nj, label: '+' + low, phase: 'update' });
      F.push('jump', 'Add the lowest set bit: ' + j + ' + ' + low + ' = <b>' + nj + '</b>. ' + (nj > n ? nj + ' is past the end (n = ' + n + '), so no more blocks contain index ' + i + '.' : 'The block ending at ' + nj + ' is the next one that is big enough to contain index ' + i + '.'), 'ujump', { cursor: nj, calc: { i: j, low: low, next: nj, mode: 'add' }, vars: { i: nj, low: low, delta: delta } });
      j = nj;
    }
    F.push('done', 'Done: <b>' + F.counters.steps + '</b> block' + (F.counters.steps === 1 ? '' : 's') + ' updated, out of ' + n + '. The rest never covered index ' + i + '.', 'utop', { cursor: null, flow: 'end', vars: { i: i, delta: delta } });
    return F.steps;
  }

  /* ------------------------------------------------------------------ cost helpers */
  function segQueryCost(n, l, r) {
    var visited = 0, used = 0;
    (function rec(lo, hi) {
      visited++;
      if (hi < l || r < lo) return;
      if (l <= lo && hi <= r) { used++; return; }
      var mid = (lo + hi) >> 1;
      rec(lo, mid); rec(mid + 1, hi);
    })(0, n - 1);
    return { visited: visited, used: used };
  }
  function segUpdateCost(n, i) {
    var lo = 0, hi = n - 1, c = 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (i <= mid) hi = mid; else lo = mid + 1; c++; }
    return c;
  }
  function popcount(x) { var c = 0; while (x) { c += x & 1; x = Math.floor(x / 2); } return c; }
  function fenQueryCost(i) { return popcount(i); }
  function fenUpdateCost(n, i) { var c = 0; for (var j = i; j <= n; j += j & -j) c++; return c; }

  /* Average costs (elements read or written) of every approach on n cells, over `samples` random ranges/indices. */
  function costs(n, o) {
    o = o || {};
    var samples = o.samples || 200, s = (o.seed || 1) >>> 0;
    function rnd() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }
    var acc = { naiveQuery: 0, prefixQuery: 0, segQuery: 0, fenQuery: 0, naiveUpdate: 1, prefixUpdate: 0, segUpdate: 0, fenUpdate: 0 };
    for (var k = 0; k < samples; k++) {
      var a = Math.floor(rnd() * n), b = Math.floor(rnd() * n), l = Math.min(a, b), r = Math.max(a, b);
      var i = Math.floor(rnd() * n);
      acc.naiveQuery += r - l + 1;
      acc.prefixQuery += l === 0 ? 1 : 2;
      acc.segQuery += segQueryCost(n, l, r).visited;
      acc.fenQuery += fenQueryCost(r + 1) + (l > 0 ? fenQueryCost(l) : 0);
      acc.prefixUpdate += n - i;
      acc.segUpdate += segUpdateCost(n, i);
      acc.fenUpdate += fenUpdateCost(n, i + 1);
    }
    ['naiveQuery', 'prefixQuery', 'segQuery', 'fenQuery', 'prefixUpdate', 'segUpdate', 'fenUpdate'].forEach(function (key) { acc[key] /= samples; });
    return acc;
  }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE_OPS = {
    sum: { js: function (a, b) { return a + ' + ' + b; }, py: function (a, b) { return a + ' + ' + b; }, ps: function (a, b) { return a + ' + ' + b; }, id: '0', word: 'sum' },
    min: { js: function (a, b) { return 'Math.min(' + a + ', ' + b + ')'; }, py: function (a, b) { return 'min(' + a + ', ' + b + ')'; }, ps: function (a, b) { return 'min(' + a + ', ' + b + ')'; }, id: 'Infinity', word: 'minimum' },
    max: { js: function (a, b) { return 'Math.max(' + a + ', ' + b + ')'; }, py: function (a, b) { return 'max(' + a + ', ' + b + ')'; }, ps: function (a, b) { return 'max(' + a + ', ' + b + ')'; }, id: '-Infinity', word: 'maximum' },
    gcd: { js: function (a, b) { return 'gcd(' + a + ', ' + b + ')'; }, py: function (a, b) { return 'gcd(' + a + ', ' + b + ')'; }, ps: function (a, b) { return 'gcd(' + a + ', ' + b + ')'; }, id: '0', word: 'gcd' }
  };
  function segCode(kind, op) {
    var c = CODE_OPS[op || 'sum'];
    if (!c) throw new Error('Unknown operation: ' + op);
    var idPy = c.id === 'Infinity' ? 'float("inf")' : c.id === '-Infinity' ? 'float("-inf")' : c.id;
    if (kind === 'query') {
      return {
        pseudo: [
          'function query(node, lo, hi, l, r)                 // @enter',
          '  if [lo, hi] shares no cell with [l, r]:',
          '    return ' + c.id + '                           // @outside',
          '  if [lo, hi] lies inside [l, r]:',
          '    return tree[node]                             // @inside',
          '  mid = (lo + hi) / 2                             // @split',
          '  left  = query(2·node, lo, mid, l, r)            // @left',
          '  right = query(2·node + 1, mid + 1, hi, l, r)    // @right',
          '  return ' + c.ps('left', 'right') + '                        // @combine',
          '',
          'answer = query(1, 0, n − 1, l, r)                 // @call'
        ].join('\n'),
        js: [
          'function query(node, lo, hi, l, r) {              // @enter',
          '  if (r < lo || hi < l) return ' + c.id + ';        // @outside',
          '  if (l <= lo && hi <= r) return tree[node];      // @inside',
          '  const mid = (lo + hi) >> 1;                     // @split',
          '  const left = query(2 * node, lo, mid, l, r);    // @left',
          '  const right = query(2 * node + 1, mid + 1, hi, l, r);  // @right',
          '  return ' + c.js('left', 'right') + ';                    // @combine',
          '}',
          '',
          'const answer = query(1, 0, n - 1, l, r);         // @call'
        ].join('\n'),
        py: [
          'def query(node, lo, hi, l, r):                    # @enter',
          '    if r < lo or hi < l: return ' + idPy + '          # @outside',
          '    if l <= lo and hi <= r: return tree[node]     # @inside',
          '    mid = (lo + hi) // 2                          # @split',
          '    left = query(2 * node, lo, mid, l, r)         # @left',
          '    right = query(2 * node + 1, mid + 1, hi, l, r)  # @right',
          '    return ' + c.py('left', 'right') + '                        # @combine',
          '',
          'answer = query(1, 0, n - 1, l, r)                 # @call'
        ].join('\n')
      };
    }
    if (kind === 'update') {
      return {
        pseudo: [
          'function update(node, lo, hi, i, v)               // @enter',
          '  if lo = hi:                                     // @leaf',
          '    tree[node] = v ; return',
          '  mid = (lo + hi) / 2                             // @descend',
          '  if i ≤ mid: update(2·node, lo, mid, i, v)       // @goleft',
          '  else: update(2·node + 1, mid + 1, hi, i, v)     // @goright',
          '  tree[node] = ' + c.ps('tree[2·node]', 'tree[2·node + 1]') + '          // @pull',
          '',
          'update(1, 0, n − 1, i, v)                         // @call'
        ].join('\n'),
        js: [
          'function update(node, lo, hi, i, v) {             // @enter',
          '  if (lo === hi) { tree[node] = v; return; }      // @leaf',
          '  const mid = (lo + hi) >> 1;                     // @descend',
          '  if (i <= mid) update(2 * node, lo, mid, i, v);  // @goleft',
          '  else update(2 * node + 1, mid + 1, hi, i, v);   // @goright',
          '  tree[node] = ' + c.js('tree[2 * node]', 'tree[2 * node + 1]') + ';  // @pull',
          '}',
          '',
          'update(1, 0, n - 1, i, v);                       // @call'
        ].join('\n'),
        py: [
          'def update(node, lo, hi, i, v):                   # @enter',
          '    if lo == hi:',
          '        tree[node] = v; return                    # @leaf',
          '    mid = (lo + hi) // 2                          # @descend',
          '    if i <= mid: update(2 * node, lo, mid, i, v)  # @goleft',
          '    else: update(2 * node + 1, mid + 1, hi, i, v) # @goright',
          '    tree[node] = ' + c.py('tree[2 * node]', 'tree[2 * node + 1]') + '  # @pull',
          '',
          'update(1, 0, n - 1, i, v)                         # @call'
        ].join('\n')
      };
    }
    if (kind === 'build') {
      return {
        pseudo: [
          'function build(node, lo, hi)                      // @enter',
          '  if lo = hi:                                     // @bleaf',
          '    tree[node] = a[lo] ; return',
          '  mid = (lo + hi) / 2                             // @bmid',
          '  build(2·node, lo, mid)                          // @brec',
          '  build(2·node + 1, mid + 1, hi)',
          '  tree[node] = ' + c.ps('tree[2·node]', 'tree[2·node + 1]') + '          // @bpull',
          '',
          'build(1, 0, n − 1)                                // @call'
        ].join('\n'),
        js: [
          'function build(node, lo, hi) {                    // @enter',
          '  if (lo === hi) { tree[node] = a[lo]; return; }  // @bleaf',
          '  const mid = (lo + hi) >> 1;                     // @bmid',
          '  build(2 * node, lo, mid);                       // @brec',
          '  build(2 * node + 1, mid + 1, hi);',
          '  tree[node] = ' + c.js('tree[2 * node]', 'tree[2 * node + 1]') + ';  // @bpull',
          '}',
          '',
          'build(1, 0, n - 1);                              // @call'
        ].join('\n'),
        py: [
          'def build(node, lo, hi):                          # @enter',
          '    if lo == hi:',
          '        tree[node] = a[lo]; return                # @bleaf',
          '    mid = (lo + hi) // 2                          # @bmid',
          '    build(2 * node, lo, mid)                      # @brec',
          '    build(2 * node + 1, mid + 1, hi)',
          '    tree[node] = ' + c.py('tree[2 * node]', 'tree[2 * node + 1]') + '  # @bpull',
          '',
          'build(1, 0, n - 1)                                # @call'
        ].join('\n')
      };
    }
    throw new Error('Unknown kind: ' + kind);
  }

  var LAZY_CODE = {
    pseudo: [
      'function apply(node, lo, hi, v)                    // @apply',
      '  sum[node] = sum[node] + v × (hi − lo + 1)',
      '  lazy[node] = lazy[node] + v        // children still owe v',
      '',
      'function push(node, lo, hi)                        // @push',
      '  if lazy[node] ≠ 0:',
      '    apply(2·node, lo, mid, lazy[node])',
      '    apply(2·node + 1, mid + 1, hi, lazy[node])',
      '    lazy[node] = 0                                 // @clear',
      '',
      'function add(node, lo, hi, l, r, v)',
      '  if [lo, hi] is outside [l, r]: return             // @aout',
      '  if [lo, hi] is inside [l, r]:                    // @ain',
      '    apply(node, lo, hi, v) ; return',
      '  push(node, lo, hi)                                // @apush',
      '  recurse into both halves                          // @asplit',
      '  sum[node] = sum[2·node] + sum[2·node + 1]        // @apull',
      '',
      'function query(node, lo, hi, l, r)',
      '  if [lo, hi] is outside [l, r]: return 0           // @qout',
      '  if [lo, hi] is inside [l, r]: return sum[node]    // @qin',
      '  push(node, lo, hi)                                // @qpush',
      '  recurse into both halves                          // @qsplit',
      '  return left + right                               // @qcomb',
      '',
      'add(1, 0, n − 1, l, r, v)                          // @call'
    ].join('\n'),
    js: [
      'function apply(node, lo, hi, v) {                   // @apply',
      '  sum[node] += v * (hi - lo + 1);',
      '  lazy[node] += v;                  // children still owe v',
      '}',
      '',
      'function push(node, lo, hi) {                       // @push',
      '  if (lazy[node] === 0) return;',
      '  const mid = (lo + hi) >> 1;',
      '  apply(2 * node, lo, mid, lazy[node]);',
      '  apply(2 * node + 1, mid + 1, hi, lazy[node]);',
      '  lazy[node] = 0;                                   // @clear',
      '}',
      '',
      'function add(node, lo, hi, l, r, v) {',
      '  if (r < lo || hi < l) return;                     // @aout',
      '  if (l <= lo && hi <= r) { apply(node, lo, hi, v); return; }  // @ain',
      '  push(node, lo, hi);                               // @apush',
      '  const mid = (lo + hi) >> 1;                       // @asplit',
      '  add(2 * node, lo, mid, l, r, v);',
      '  add(2 * node + 1, mid + 1, hi, l, r, v);',
      '  sum[node] = sum[2 * node] + sum[2 * node + 1];    // @apull',
      '}',
      '',
      'function query(node, lo, hi, l, r) {',
      '  if (r < lo || hi < l) return 0;                   // @qout',
      '  if (l <= lo && hi <= r) return sum[node];         // @qin',
      '  push(node, lo, hi);                               // @qpush',
      '  const mid = (lo + hi) >> 1;                       // @qsplit',
      '  return query(2 * node, lo, mid, l, r)             // @qcomb',
      '       + query(2 * node + 1, mid + 1, hi, l, r);',
      '}',
      '',
      'add(1, 0, n - 1, l, r, v);                       // @call'
    ].join('\n'),
    py: [
      'def apply(node, lo, hi, v):                         # @apply',
      '    sum_[node] += v * (hi - lo + 1)',
      '    lazy[node] += v                  # children still owe v',
      '',
      'def push(node, lo, hi):                             # @push',
      '    if lazy[node] == 0: return',
      '    mid = (lo + hi) // 2',
      '    apply(2 * node, lo, mid, lazy[node])',
      '    apply(2 * node + 1, mid + 1, hi, lazy[node])',
      '    lazy[node] = 0                                 # @clear',
      '',
      'def add(node, lo, hi, l, r, v):',
      '    if r < lo or hi < l: return                    # @aout',
      '    if l <= lo and hi <= r:                        # @ain',
      '        apply(node, lo, hi, v); return',
      '    push(node, lo, hi)                             # @apush',
      '    mid = (lo + hi) // 2                           # @asplit',
      '    add(2 * node, lo, mid, l, r, v)',
      '    add(2 * node + 1, mid + 1, hi, l, r, v)',
      '    sum_[node] = sum_[2 * node] + sum_[2 * node + 1]  # @apull',
      '',
      'def query(node, lo, hi, l, r):',
      '    if r < lo or hi < l: return 0                  # @qout',
      '    if l <= lo and hi <= r: return sum_[node]      # @qin',
      '    push(node, lo, hi)                             # @qpush',
      '    mid = (lo + hi) // 2                           # @qsplit',
      '    return (query(2 * node, lo, mid, l, r)         # @qcomb',
      '          + query(2 * node + 1, mid + 1, hi, l, r))',
      '',
      'add(1, 0, n - 1, l, r, v)                        # @call'
    ].join('\n')
  };

  var FEN_CODE = {
    prefix: {
      pseudo: [
        'function prefix(i)                     // @top',
        '  s = 0',
        '  while i > 0:                         // @loop',
        '    s = s + T[i]                       // @add',
        '    i = i − (i AND −i)                 // @jump  (strip the lowest set bit)',
        '  return s                             // @ret'
      ].join('\n'),
      js: [
        'function prefix(i) {                   // @top',
        '  let s = 0;',
        '  while (i > 0) {                      // @loop',
        '    s += T[i];                         // @add',
        '    i -= i & -i;                       // @jump',
        '  }',
        '  return s;                            // @ret',
        '}'
      ].join('\n'),
      py: [
        'def prefix(i):                         # @top',
        '    s = 0',
        '    while i > 0:                       # @loop',
        '        s += T[i]                      # @add',
        '        i -= i & -i                    # @jump',
        '    return s                           # @ret'
      ].join('\n')
    },
    range: {
      pseudo: [
        'function prefix(i)',
        '  s = 0',
        '  while i > 0:',
        '    s = s + T[i]                       // @add',
        '    i = i − (i AND −i)                 // @jump',
        '  return s',
        '',
        'function rangeSum(l, r)                // @rtop',
        '  return prefix(r) − prefix(l − 1)     // @rsub'
      ].join('\n'),
      js: [
        'function prefix(i) {',
        '  let s = 0;',
        '  while (i > 0) {',
        '    s += T[i];                         // @add',
        '    i -= i & -i;                       // @jump',
        '  }',
        '  return s;',
        '}',
        '',
        'function rangeSum(l, r) {              // @rtop',
        '  return prefix(r) - prefix(l - 1);    // @rsub',
        '}'
      ].join('\n'),
      py: [
        'def prefix(i):',
        '    s = 0',
        '    while i > 0:',
        '        s += T[i]                      # @add',
        '        i -= i & -i                    # @jump',
        '    return s',
        '',
        'def range_sum(l, r):                   # @rtop',
        '    return prefix(r) - prefix(l - 1)   # @rsub'
      ].join('\n')
    },
    update: {
      pseudo: [
        'function update(i, delta)              // @utop',
        '  while i ≤ n:',
        '    T[i] = T[i] + delta                // @uadd',
        '    i = i + (i AND −i)                 // @ujump  (add the lowest set bit)'
      ].join('\n'),
      js: [
        'function update(i, delta) {            // @utop',
        '  while (i <= n) {',
        '    T[i] += delta;                     // @uadd',
        '    i += i & -i;                       // @ujump',
        '  }',
        '}'
      ].join('\n'),
      py: [
        'def update(i, delta):                  # @utop',
        '    while i <= n:',
        '        T[i] += delta                  # @uadd',
        '        i += i & -i                    # @ujump'
      ].join('\n')
    }
  };

  return {
    OPS: OPS, shape: shape, treeValues: treeValues, staleOf: staleOf,
    segBuild: segBuild, segQuery: segQuery, segUpdate: segUpdate, lazyRun: lazyRun,
    lowbit: lowbit, fenTree: fenTree, fenPrefix: fenPrefix, fenRange: fenRange, fenUpdate: fenUpdate,
    segQueryCost: segQueryCost, segUpdateCost: segUpdateCost, fenQueryCost: fenQueryCost, fenUpdateCost: fenUpdateCost, popcount: popcount,
    costs: costs, segCode: segCode, LAZY_CODE: LAZY_CODE, FEN_CODE: FEN_CODE, fmt: fmt, gcd: gcd
  };
}));
