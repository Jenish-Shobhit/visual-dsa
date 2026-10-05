/* Lesson 20 · Balanced trees: AVL & red-black — pure step generators (no DOM).

   Browser: VDSA.algos.lesson20.avlInsertSteps(tree, 42) …   (loaded after js/vdsa/core.js)
   Node:    require('js/algos/20-balanced-trees.js')

   A tree is plain data: {root: id | null, nodes: {id: {id, value, left, right, color}}, next: n}.
   Node ids ('n1', 'n2', …) are never reused and never change when a node rotates, so the tree view can
   swing the same node from one place to another. color is 'red' | 'black' | null (null for BST / AVL).
   Every operation takes a tree and returns {steps, tree, …} without touching its input.

   A step is a complete snapshot for VDSA.views.tree:
     root, nodes: [{id, value, left, right, color?, state?, badge?, badgeState?, sub?}], edges, pointers
   plus the player fields: caption (why), line (code label), vars, counters, flow (flowchart node id), kind,
   and for red-black steps rules: {ok: [5 booleans], nodes: [[ids] × 5], blackHeight}.
   Balance-factor badges are honest about time: after a node is attached, the badges of its ancestors keep
   their OLD values until the walk back up reaches them, one node per step.

   Height is counted in links (edges): an empty subtree is −1, a single node 0.
   Balance factor = height(left) − height(right).

   Duplicate policy: every tree here is a set. Inserting a key that is already present changes nothing. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.lesson20 = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ================================================================== small helpers */
  function num(v) { return v === null || v === undefined ? '∅' : (v < 0 ? '−' + Math.abs(v) : String(v)); }
  function bfText(b) { return b > 0 ? '+' + b : b < 0 ? '−' + Math.abs(b) : '0'; }
  function copy(o) { var out = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k]; return out; }
  function other(side) { return side === 'left' ? 'right' : 'left'; }
  function cmpHtml(a, b) { return '<b>' + num(a) + ' ' + (a < b ? '&lt;' : a > b ? '&gt;' : '=') + ' ' + num(b) + '</b>'; }
  function plural(k, word) { return k + ' ' + word + (k === 1 ? '' : 's'); }
  function hword(h) { return h < 0 ? 'empty (−1)' : String(h); }

  /* ================================================================== tree data */
  function empty() { return { root: null, nodes: {}, next: 1 }; }
  function clone(t) {
    var nodes = {};
    Object.keys(t.nodes).forEach(function (k) { var n = t.nodes[k]; nodes[k] = { id: n.id, value: n.value, left: n.left, right: n.right, color: n.color || null }; });
    return { root: t.root, nodes: nodes, next: t.next };
  }
  function newNode(t, value, color) {
    var id = 'n' + t.next;
    t.next += 1;
    t.nodes[id] = { id: id, value: value, left: null, right: null, color: color || null };
    return id;
  }
  function size(t) { return Object.keys(t.nodes).length; }
  function findId(t, value) {
    var cur = t.root;
    while (cur !== null) {
      var n = t.nodes[cur];
      if (value === n.value) return cur;
      cur = value < n.value ? n.left : n.right;
    }
    return null;
  }
  function parentOf(t, id) {
    for (var k in t.nodes) { var n = t.nodes[k]; if (n.left === id || n.right === id) return k; }
    return null;
  }
  /* height of every node (links; leaf 0), iterative so a 1000-node stick is fine */
  function heightsOf(t) {
    var H = {};
    if (t.root === null) return H;
    var order = [], stack = [t.root];
    while (stack.length) {
      var id = stack.pop(), n = t.nodes[id];
      order.push(id);
      if (n.left !== null) stack.push(n.left);
      if (n.right !== null) stack.push(n.right);
    }
    for (var i = order.length - 1; i >= 0; i--) {
      var m = t.nodes[order[i]];
      var hl = m.left === null ? -1 : H[m.left], hr = m.right === null ? -1 : H[m.right];
      H[order[i]] = 1 + Math.max(hl, hr);
    }
    return H;
  }
  function height(t) { return t.root === null ? -1 : heightsOf(t)[t.root]; }
  function hOf(t, H, id) { return id === null || id === undefined ? -1 : H[id]; }
  function bfOf(t, H, id) { var n = t.nodes[id]; return hOf(t, H, n.left) - hOf(t, H, n.right); }
  function bfTable(t) {
    var H = heightsOf(t), out = {};
    Object.keys(t.nodes).forEach(function (id) { out[id] = bfOf(t, H, id); });
    return out;
  }
  function inorderIds(t, from) {
    var out = [], stack = [], cur = from === undefined ? t.root : from;
    while (cur !== null || stack.length) {
      while (cur !== null) { stack.push(cur); cur = t.nodes[cur].left; }
      cur = stack.pop();
      out.push(cur);
      cur = t.nodes[cur].right;
    }
    return out;
  }
  function inorder(t) { return inorderIds(t).map(function (id) { return t.nodes[id].value; }); }
  function subtreeIds(t, id) { return id === null || id === undefined ? [] : inorderIds(t, id); }
  function depths(t) {
    var out = {};
    if (t.root === null) return out;
    var stack = [[t.root, 0]];
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      out[e[0]] = e[1];
      if (n.left !== null) stack.push([n.left, e[1] + 1]);
      if (n.right !== null) stack.push([n.right, e[1] + 1]);
    }
    return out;
  }
  function isBst(t) {
    if (t.root === null) return true;
    var stack = [[t.root, -Infinity, Infinity]], seen = {};
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      if (!n || seen[e[0]]) return false;
      seen[e[0]] = true;
      if (!(n.value > e[1] && n.value < e[2])) return false;
      if (n.left !== null) stack.push([n.left, e[1], n.value]);
      if (n.right !== null) stack.push([n.right, n.value, e[2]]);
    }
    return Object.keys(seen).length === size(t);
  }
  function isAvl(t) {
    if (!isBst(t)) return false;
    var H = heightsOf(t);
    return Object.keys(t.nodes).every(function (id) { return Math.abs(bfOf(t, H, id)) <= 1; });
  }
  function shape(t, id) {
    if (id === undefined) id = t.root;
    if (id === null) return null;
    var n = t.nodes[id];
    return [n.value, shape(t, n.left), shape(t, n.right)];
  }
  function shapeColored(t, id) {
    if (id === undefined) id = t.root;
    if (id === null) return null;
    var n = t.nodes[id];
    return [n.value, shapeColored(t, n.left), shapeColored(t, n.right), n.color === 'red' ? 'r' : 'b'];
  }
  /* Build an exact shape: [50, [30, [20], [40]], [70, null, [80]]]  → value, left, right, optional colour 'r' | 'b'. */
  function fromShape(spec) {
    var t = empty();
    function build(s) {
      if (s === null || s === undefined) return null;
      if (typeof s === 'number') s = [s];
      var color = s[3] === 'r' ? 'red' : s[3] === 'b' ? 'black' : null;
      var id = newNode(t, s[0], color);
      var l = build(s[1]), r = build(s[2]);
      t.nodes[id].left = l; t.nodes[id].right = r;
      return id;
    }
    t.root = build(spec);
    return t;
  }
  function mirrorShape(s, axis) {
    if (s === null || s === undefined) return null;
    if (typeof s === 'number') s = [s];
    return [axis - s[0], mirrorShape(s[2], axis), mirrorShape(s[1], axis), s[3]];
  }

  /* ---------------------------------------------------------------- rotation (data only) */
  /* rotate(t, id, 'right'): id's LEFT child moves up, id becomes its right child, and the child's old right
     subtree becomes id's left subtree. 'left' is the mirror image. Returns the id that is now on top. */
  function rotate(t, id, dir, parentId) {
    var z = t.nodes[id], side = dir === 'right' ? 'left' : 'right', opp = other(side);
    var y = z[side];
    if (y === null) throw new Error('rotate: node has no ' + side + ' child');
    if (parentId === undefined) parentId = parentOf(t, id);
    z[side] = t.nodes[y][opp];
    t.nodes[y][opp] = id;
    if (parentId === null) t.root = y;
    else { var p = t.nodes[parentId]; if (p.left === id) p.left = y; else p.right = y; }
    return y;
  }
  /* Rotate node id up over its parent (the move a reader makes by clicking a node). */
  function rotateUp(tree, id) {
    var t = clone(tree), p = parentOf(t, id);
    if (p === null) return null;
    rotate(t, p, t.nodes[p].left === id ? 'right' : 'left');
    return t;
  }

  /* The symbolic rotation figure: x and y with subtrees A, B, C. which = 'left' (x on top) | 'right' (y on top). */
  function xyState(which, opts) {
    opts = opts || {};
    var ids = { x: 'x', y: 'y', A: 'A', B: 'B', C: 'C' };
    var st = opts.states || {};
    function nd(id, label, left, right, extra) {
      var o = { id: id, label: label, left: left || null, right: right || null };
      if (st[id]) o.state = st[id];
      if (id === 'A' || id === 'B' || id === 'C') o.sub = 'subtree';
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    }
    var nodes;
    if (which === 'left') {
      nodes = [nd('x', 'x', 'A', 'y'), nd('y', 'y', 'B', 'C'), nd('A', 'A'), nd('B', 'B'), nd('C', 'C')];
      return { root: 'x', nodes: nodes, ids: ids };
    }
    nodes = [nd('y', 'y', 'x', 'C'), nd('x', 'x', 'A', 'B'), nd('A', 'A'), nd('B', 'B'), nd('C', 'C')];
    return { root: 'y', nodes: nodes, ids: ids };
  }

  /* ================================================================== red-black rules */
  /* rbCheck(t) -> {ok: [r1..r5], nodes: [[ids]×5], valid, blackHeight}
     1 every node is red or black · 2 the root is black · 3 every empty (NIL) leaf is black (always true)
     4 a red node has no red child · 5 every path from a node down to a NIL has the same number of black nodes.
     Black height of v = black nodes on a path from v down to NIL, counting v itself when black. */
  function rbCheck(t) {
    var nodes = [[], [], [], [], []];
    var ids = Object.keys(t.nodes);
    ids.forEach(function (id) { var c = t.nodes[id].color; if (c !== 'red' && c !== 'black') nodes[0].push(id); });
    if (t.root !== null && t.nodes[t.root].color !== 'black') nodes[1].push(t.root);
    ids.forEach(function (id) {
      var n = t.nodes[id];
      if (n.color !== 'red') return;
      [n.left, n.right].forEach(function (c) {
        if (c !== null && t.nodes[c].color === 'red') { if (nodes[3].indexOf(id) === -1) nodes[3].push(id); if (nodes[3].indexOf(c) === -1) nodes[3].push(c); }
      });
    });
    var bhOf = {};
    function bh(id) {
      if (id === null) return 0;
      if (bhOf[id] !== undefined) return bhOf[id];
      var n = t.nodes[id], l = bh(n.left), r = bh(n.right);
      if (l !== r) nodes[4].push(id);
      var v = Math.min(l, r) + (n.color === 'black' ? 1 : 0);
      bhOf[id] = v;
      return v;
    }
    var bhRoot = t.root === null ? 0 : bh(t.root);
    var ok = nodes.map(function (a) { return a.length === 0; });
    return { ok: ok, nodes: nodes, valid: ok.every(Boolean), blackHeight: bhRoot, bh: bhOf };
  }
  function isRedBlack(t) { return isBst(t) && rbCheck(t).valid; }

  /* ================================================================== reference implementations */
  /* Independent, straightforward versions used by the tests and by the chart (no steps). */
  function bstInsertRaw(t, value) {
    if (t.root === null) { t.root = newNode(t, value); return t.root; }
    var cur = t.root;
    for (;;) {
      var n = t.nodes[cur];
      if (value === n.value) return null;
      var side = value < n.value ? 'left' : 'right';
      if (n[side] === null) { var id = newNode(t, value); n[side] = id; return id; }
      cur = n[side];
    }
  }
  function fromKeys(keys) { var t = empty(); (keys || []).forEach(function (k) { bstInsertRaw(t, k); }); return t; }

  /* recursive AVL with stored heights: the textbook version */
  function avlRef(keys, deletes) {
    var t = empty();
    var hs = {};
    function h(id) { return id === null ? -1 : hs[id]; }
    function upd(id) { var n = t.nodes[id]; hs[id] = 1 + Math.max(h(n.left), h(n.right)); }
    function bal(id) { var n = t.nodes[id]; return h(n.left) - h(n.right); }
    function rotR(id) { var y = t.nodes[id].left; t.nodes[id].left = t.nodes[y].right; t.nodes[y].right = id; upd(id); upd(y); return y; }
    function rotL(id) { var y = t.nodes[id].right; t.nodes[id].right = t.nodes[y].left; t.nodes[y].left = id; upd(id); upd(y); return y; }
    function rebalance(id) {
      upd(id);
      var b = bal(id), n = t.nodes[id];
      if (b > 1) { if (bal(n.left) < 0) n.left = rotL(n.left); return rotR(id); }
      if (b < -1) { if (bal(n.right) > 0) n.right = rotR(n.right); return rotL(id); }
      return id;
    }
    function ins(id, key) {
      if (id === null) { var nid = newNode(t, key); hs[nid] = 0; return nid; }
      var n = t.nodes[id];
      if (key < n.value) n.left = ins(n.left, key);
      else if (key > n.value) n.right = ins(n.right, key);
      else return id;
      return rebalance(id);
    }
    function del(id, key) {
      if (id === null) return null;
      var n = t.nodes[id];
      if (key < n.value) n.left = del(n.left, key);
      else if (key > n.value) n.right = del(n.right, key);
      else {
        if (n.left === null) { delete t.nodes[id]; return n.right; }
        if (n.right === null) { delete t.nodes[id]; return n.left; }
        var s = n.right;
        while (t.nodes[s].left !== null) s = t.nodes[s].left;
        n.value = t.nodes[s].value;
        n.right = del(n.right, n.value);
      }
      return rebalance(id);
    }
    keys.forEach(function (k) { t.root = ins(t.root, k); });
    (deletes || []).forEach(function (k) { t.root = del(t.root, k); });
    return t;
  }

  /* CLRS red-black insertion with parent pointers: the textbook version */
  function rbRef(keys) {
    var t = empty();
    var par = {};
    function rot(id, dir) {
      var side = dir === 'right' ? 'left' : 'right', opp = other(side);
      var y = t.nodes[id][side];
      t.nodes[id][side] = t.nodes[y][opp];
      if (t.nodes[y][opp] !== null) par[t.nodes[y][opp]] = id;
      par[y] = par[id];
      if (par[id] === null) t.root = y;
      else if (t.nodes[par[id]].left === id) t.nodes[par[id]].left = y;
      else t.nodes[par[id]].right = y;
      t.nodes[y][opp] = id;
      par[id] = y;
    }
    keys.forEach(function (key) {
      var cur = t.root, p = null;
      while (cur !== null) { if (key === t.nodes[cur].value) return; p = cur; cur = key < t.nodes[cur].value ? t.nodes[cur].left : t.nodes[cur].right; }
      var z = newNode(t, key, 'red');
      par[z] = p;
      if (p === null) t.root = z; else if (key < t.nodes[p].value) t.nodes[p].left = z; else t.nodes[p].right = z;
      while (par[z] !== null && t.nodes[par[z]].color === 'red') {
        var pp = par[z], g = par[pp];
        var left = t.nodes[g].left === pp;
        var u = left ? t.nodes[g].right : t.nodes[g].left;
        if (u !== null && t.nodes[u].color === 'red') {
          t.nodes[pp].color = 'black'; t.nodes[u].color = 'black'; t.nodes[g].color = 'red'; z = g;
        } else {
          if (z === (left ? t.nodes[pp].right : t.nodes[pp].left)) { z = pp; rot(z, left ? 'left' : 'right'); }
          t.nodes[par[z]].color = 'black'; t.nodes[g].color = 'red';
          rot(g, left ? 'right' : 'left');
        }
      }
      t.nodes[t.root].color = 'black';
    });
    return t;
  }

  /* ================================================================== step recorder */
  function Rec(t, o) {
    this.t = t; this.o = o || {}; this.steps = [];
    var b = (o && o.base) || {};
    this.cmp = b.cmp || 0; this.rot = b.rot || 0; this.recol = b.recol || 0;
    this.marks = {}; this.edges = {}; this.subs = {}; this.bf = null; this.pointers = []; this.bhBadges = false;
  }
  Rec.prototype.val = function (id) { return id === null || id === undefined || !this.t.nodes[id] ? null : this.t.nodes[id].value; };
  Rec.prototype.snap = function (meta) {
    var t = this.t, self = this;
    var rules = this.o.rules ? rbCheck(t) : null;
    var bad = {};
    if (rules) [1, 3, 4].forEach(function (i) { rules.nodes[i].forEach(function (id) { bad[id] = true; }); });
    var nodes = Object.keys(t.nodes).map(function (id) {
      var n = t.nodes[id];
      var o = { id: id, value: n.value, left: n.left, right: n.right };
      if (n.color) o.color = n.color;
      var st = self.marks[id];
      if (bad[id]) st = 'error';
      if (st && st !== 'default') o.state = st;
      if (self.subs[id] !== undefined) o.sub = self.subs[id];
      if (self.bf && self.bf[id] !== undefined) { o.badge = bfText(self.bf[id]); if (Math.abs(self.bf[id]) > 1) o.badgeState = 'error'; }
      if (rules && self.bhBadges && rules.bh[id] !== undefined) o.badge = 'bh ' + rules.bh[id];
      return o;
    });
    var edges = {};
    Object.keys(this.edges).forEach(function (key) {
      var p = key.split('-');
      var pn = t.nodes[p[0]];
      if (pn && (pn.left === p[1] || pn.right === p[1])) edges[key] = self.edges[key];
    });
    var step = {
      root: t.root, nodes: nodes, edges: edges,
      pointers: this.pointers.filter(function (p) { return t.nodes[p.target]; }).map(copy)
    };
    if (rules) step.rules = { ok: rules.ok, nodes: rules.nodes, blackHeight: rules.blackHeight, valid: rules.valid };
    Object.keys(meta || {}).forEach(function (k) { step[k] = meta[k]; });
    var c = { comparisons: this.cmp, rotations: this.rot };
    if (this.o.rules) c.recolours = this.recol;
    c.height = height(t);
    c.nodes = size(t);
    step.counters = c;
    this.steps.push(step);
    return step;
  };
  Rec.prototype.markPath = function (path, state) { var self = this; path.forEach(function (id) { self.marks[id] = state || 'visited'; }); };
  Rec.prototype.clearMarks = function () { this.marks = {}; this.edges = {}; this.subs = {}; this.pointers = []; };
  /* refresh the balance-factor badges of a whole subtree (after a rotation changed its shape) */
  Rec.prototype.refresh = function (top) {
    var t = this.t, H = heightsOf(t), self = this;
    subtreeIds(t, top).forEach(function (id) { self.bf[id] = bfOf(t, H, id); });
  };

  /* ================================================================== code panels */
  var COMMON_JS = `
const height = n => (n ? n.h : -1);
const update = n => { n.h = 1 + Math.max(height(n.left), height(n.right)); };
const balance = n => height(n.left) - height(n.right);
`;
  var REBAL_JS = `
function rebalance(node) {
  update(node);                                       // @update
  const bf = balance(node);                           // @bf
  if (bf > 1) {                                       // @heavyL
    if (balance(node.left) < 0)                       // @caseLR
      node.left = rotateLeft(node.left);              // @rotLR
    return rotateRight(node);                         // @rotR
  }
  if (bf < -1) {                                      // @heavyR
    if (balance(node.right) > 0)                      // @caseRL
      node.right = rotateRight(node.right);           // @rotRL
    return rotateLeft(node);                          // @rotL
  }
  return node;                                        // @ok
}
`;
  var REBAL_PY = `
def rebalance(node):
    update(node)                                      # @update
    bf = balance(node)                                # @bf
    if bf > 1:                                        # @heavyL
        if balance(node.left) < 0:                    # @caseLR
            node.left = rotate_left(node.left)        # @rotLR
        return rotate_right(node)                     # @rotR
    if bf < -1:                                       # @heavyR
        if balance(node.right) > 0:                   # @caseRL
            node.right = rotate_right(node.right)     # @rotRL
        return rotate_left(node)                      # @rotL
    return node                                       # @ok
`;
  var REBAL_PSEUDO = `
rebalance(node):
  update height(node)                                 // @update
  bf ← height(left) − height(right)                   // @bf
  if bf > 1:                                          // @heavyL
    if balance(node.left) < 0:                        // @caseLR
      node.left ← rotateLeft(node.left)               // @rotLR
    return rotateRight(node)                          // @rotR
  if bf < −1:                                         // @heavyR
    if balance(node.right) > 0:                       // @caseRL
      node.right ← rotateRight(node.right)            // @rotRL
    return rotateLeft(node)                           // @rotL
  return node                                         // @ok
`;
  var CODE = {
    avlInsert: {
      title: 'AVL insert',
      pseudo: `
insert(node, key):
  if node is empty: return new node(key)              // @attach
  if key < node.key:
    node.left ← insert(node.left, key)                // @goL
  else if key > node.key:
    node.right ← insert(node.right, key)              // @goR
  else:
    return node                                       // @dup
  return rebalance(node)                              // @retrace
` + REBAL_PSEUDO,
      js: COMMON_JS + `
function insert(node, key) {
  if (node === null)
    return { key, left: null, right: null, h: 0 };    // @attach
  if (key < node.key)
    node.left = insert(node.left, key);               // @goL
  else if (key > node.key)
    node.right = insert(node.right, key);             // @goR
  else
    return node;                                      // @dup
  return rebalance(node);                             // @retrace
}
` + REBAL_JS,
      py: `
def height(n): return n.h if n else -1
def update(n): n.h = 1 + max(height(n.left), height(n.right))
def balance(n): return height(n.left) - height(n.right)

def insert(node, key):
    if node is None:
        return Node(key)                              # @attach
    if key < node.key:
        node.left = insert(node.left, key)            # @goL
    elif key > node.key:
        node.right = insert(node.right, key)          # @goR
    else:
        return node                                   # @dup
    return rebalance(node)                            # @retrace
` + REBAL_PY
    },
    avlDelete: {
      title: 'AVL delete',
      pseudo: `
remove(node, key):
  if node is empty: return empty                      // @absent
  if key < node.key:
    node.left ← remove(node.left, key)                // @goL
  else if key > node.key:
    node.right ← remove(node.right, key)              // @goR
  else:                                               // @found
    if node.left is empty: return node.right          // @leafR
    if node.right is empty: return node.left          // @leafL
    s ← node.right                                    // @succ
    while s.left is not empty:
      s ← s.left                                      // @succ2
    node.key ← s.key                                  // @copy
    node.right ← remove(node.right, s.key)            // @delSucc
  return rebalance(node)                              // @retrace
` + REBAL_PSEUDO,
      js: COMMON_JS + `
function remove(node, key) {
  if (node === null) return null;                     // @absent
  if (key < node.key)
    node.left = remove(node.left, key);               // @goL
  else if (key > node.key)
    node.right = remove(node.right, key);             // @goR
  else {                                              // @found
    if (node.left === null) return node.right;        // @leafR
    if (node.right === null) return node.left;        // @leafL
    let s = node.right;                               // @succ
    while (s.left !== null)
      s = s.left;                                     // @succ2
    node.key = s.key;                                 // @copy
    node.right = remove(node.right, s.key);           // @delSucc
  }
  return rebalance(node);                             // @retrace
}
` + REBAL_JS,
      py: `
def height(n): return n.h if n else -1
def update(n): n.h = 1 + max(height(n.left), height(n.right))
def balance(n): return height(n.left) - height(n.right)

def remove(node, key):
    if node is None: return None                      # @absent
    if key < node.key:
        node.left = remove(node.left, key)            # @goL
    elif key > node.key:
        node.right = remove(node.right, key)          # @goR
    else:                                             # @found
        if node.left is None: return node.right       # @leafR
        if node.right is None: return node.left       # @leafL
        s = node.right                                # @succ
        while s.left is not None:
            s = s.left                                # @succ2
        node.key = s.key                              # @copy
        node.right = remove(node.right, s.key)        # @delSucc
    return rebalance(node)                            # @retrace
` + REBAL_PY
    },
    rbInsert: {
      title: 'Red-black insert',
      pseudo: `
insert(key):
  z ← ordinary BST insert of key                      // @attach
  colour z red                                        // @red
  while z has a red parent:                           // @loop
    p ← parent(z), g ← parent(p)
    u ← the other child of g (the uncle)              // @uncle
    if u is red:                                      // @uncleRed
      colour p and u black, colour g red              // @recolor
      z ← g                                           // @climb
    else:
      if z is the inner child of p (a triangle):      // @triangle
        z ← p; rotate p toward the outside            // @rotP
      colour parent(z) black, colour g red            // @fixColors
      rotate g away from z                            // @rotG
  colour the root black                               // @rootBlack
`,
      js: `
function insert(tree, key) {
  let z = bstInsert(tree, key);                        // @attach
  z.color = RED;                                       // @red
  while (z.parent && z.parent.color === RED) {         // @loop
    const p = z.parent, g = p.parent;
    const left = p === g.left;
    const u = left ? g.right : g.left;                 // @uncle
    if (u && u.color === RED) {                        // @uncleRed
      p.color = BLACK; u.color = BLACK; g.color = RED; // @recolor
      z = g;                                           // @climb
    } else {
      if (z === (left ? p.right : p.left)) {           // @triangle
        z = p; rotate(tree, z, left ? 'left' : 'right');   // @rotP
      }
      z.parent.color = BLACK; g.color = RED;           // @fixColors
      rotate(tree, g, left ? 'right' : 'left');        // @rotG
    }
  }
  tree.root.color = BLACK;                             // @rootBlack
}
`,
      py: `
def insert(tree, key):
    z = bst_insert(tree, key)                          # @attach
    z.color = RED                                      # @red
    while z.parent and z.parent.color == RED:          # @loop
        p = z.parent; g = p.parent
        left = p is g.left
        u = g.right if left else g.left                # @uncle
        if u and u.color == RED:                       # @uncleRed
            p.color = u.color = BLACK; g.color = RED   # @recolor
            z = g                                      # @climb
        else:
            if z is (p.right if left else p.left):     # @triangle
                z = p; rotate(tree, z, 'left' if left else 'right')   # @rotP
            z.parent.color = BLACK; g.color = RED      # @fixColors
            rotate(tree, g, 'right' if left else 'left')   # @rotG
    tree.root.color = BLACK                            # @rootBlack
`
    }
  };

  /* ================================================================== AVL: retrace + rotations (shared by insert and delete) */
  function caseName(t, H, v) {
    var b = bfOf(t, H, v), n = t.nodes[v];
    if (b > 1) return bfOf(t, H, n.left) < 0 ? 'LR' : 'LL';
    return bfOf(t, H, n.right) > 0 ? 'RL' : 'RR';
  }
  var CASE_TEXT = {
    LL: 'the left child leans left too (or is level): a straight line down the left side. <b>One rotation right</b> at the top node fixes it.',
    RR: 'the right child leans right too (or is level): a straight line down the right side. <b>One rotation left</b> at the top node fixes it.',
    LR: 'the left child leans <em>right</em>: a bend, left then right. A single rotation would only move the bend, so it takes <b>two</b>: rotate left at the child, then right at the top node.',
    RL: 'the right child leans <em>left</em>: a bend, right then left. It takes <b>two</b> rotations: rotate right at the child, then left at the top node.'
  };

  /* Walk back up `path` (ancestors of the changed spot, root first) checking every balance factor and rotating
     where it is ±2. mode: 'insert' | 'delete'. */
  function retrace(r, path, mode, quick) {
    var t = r.t;
    for (var i = path.length - 1; i >= 0; i--) {
      var v = path[i], parent = i > 0 ? path[i - 1] : null;
      var H = heightsOf(t), n = t.nodes[v];
      var hl = hOf(t, H, n.left), hr = hOf(t, H, n.right), bf = hl - hr;
      r.bf[v] = bf;
      r.subs[v] = 'h ' + H[v];
      var vv = { node: n.value, hl: hl, hr: hr, bf: bf };
      if (Math.abs(bf) <= 1) {
        r.marks[v] = 'compare';
        r.snap({
          kind: 'check', line: ['update', 'bf', 'ok'], flow: 'ok', vars: vv, at: v,
          caption: 'Back at <b>' + num(n.value) + '</b>: left height ' + hword(hl) + ', right height ' + hword(hr) + '. Balance factor = ' + hl + ' − ' + hr + ' = <b>' + bfText(bf) + '</b>, within ±1, so nothing to repair here.'
        });
        r.marks[v] = 'visited';
        continue;
      }
      /* imbalance: name the case */
      var cs = caseName(t, H, v), heavy = bf > 0 ? 'left' : 'right';
      var ch = n[heavy], gc = cs === 'LL' || cs === 'RR' ? t.nodes[ch][heavy] : t.nodes[ch][other(heavy)];
      var chBf = bfOf(t, H, ch);
      r.marks[v] = 'error'; r.marks[ch] = 'pivot'; r.subs[ch] = 'bf ' + bfText(chBf);
      if (gc !== null && gc !== undefined && (cs === 'LR' || cs === 'RL' || mode === 'insert')) r.marks[gc] = 'pivot';
      var heavyLine = heavy === 'left' ? ['update', 'bf', 'heavyL'] : ['update', 'bf', 'heavyR'];
      if (cs === 'LR') heavyLine.push('caseLR'); if (cs === 'RL') heavyLine.push('caseRL');
      var whyLevel = mode === 'delete' && chBf === 0 ? ' Its ' + heavy + ' child is level (balance factor 0): that can happen after a delete, and one rotation still works.' : '';
      r.snap({
        kind: 'flag', line: heavyLine, flow: cs, vars: vv, at: v, case: { name: cs, top: v, child: ch, grand: gc || null },
        caption: '<b>' + num(n.value) + '</b> has balance factor <b>' + bfText(bf) + '</b> (left ' + hword(hl) + ', right ' + hword(hr) + '): its ' + heavy + ' side is two levels taller. This is the <b>' + cs + '</b> case, because ' + CASE_TEXT[cs] + whyLevel
      });
      var top;
      var rotDir = heavy === 'left' ? 'right' : 'left';
      if (cs === 'LR' || cs === 'RL') {
        /* first rotation: at the child, away from the bend */
        var firstDir = cs === 'LR' ? 'left' : 'right';
        var chVal = t.nodes[ch].value, gcVal = t.nodes[gc].value;
        var y1 = rotate(t, ch, firstDir, v);
        r.rot += 1;
        r.refresh(v);
        r.marks = {}; r.subs = {}; r.edges = {};
        r.marks[y1] = 'active'; r.marks[ch] = 'active'; r.marks[v] = 'error';
        r.snap({
          kind: 'rotate', line: cs === 'LR' ? 'rotLR' : 'rotRL', flow: cs, vars: vv, at: y1, case: { name: cs, top: v, child: ch, grand: gc, step: 1 },
          caption: 'First rotation: rotate ' + firstDir + ' at <b>' + num(chVal) + '</b>. Its ' + (firstDir === 'left' ? 'right' : 'left') + ' child <b>' + num(gcVal) + '</b> rises, and the bend becomes a straight line. The in-order order has not changed. <b>' + num(n.value) + '</b> still has balance factor ' + bfText(r.bf[v]) + ', but now it is the ' + (cs === 'LR' ? 'LL' : 'RR') + ' shape.'
        });
        top = rotate(t, v, rotDir, parent);
        r.rot += 1;
        r.refresh(top);
        r.marks = {}; r.subs = {}; r.edges = {};
        r.marks[top] = 'active'; r.marks[v] = 'active'; r.marks[ch] = 'active';
        r.snap({
          kind: 'rotate', line: cs === 'LR' ? 'rotR' : 'rotL', flow: cs, vars: vv, at: top, case: { name: cs, top: v, child: ch, grand: gc, step: 2 },
          caption: 'Second rotation: rotate ' + rotDir + ' at <b>' + num(n.value) + '</b>. <b>' + num(gcVal) + '</b> is now the top of this subtree, with <b>' + num(chVal) + '</b> on one side and <b>' + num(n.value) + '</b> on the other.'
        });
      } else {
        var chVal2 = t.nodes[ch].value;
        top = rotate(t, v, rotDir, parent);
        r.rot += 1;
        r.refresh(top);
        r.marks = {}; r.subs = {}; r.edges = {};
        r.marks[top] = 'active'; r.marks[v] = 'active';
        var moved = t.nodes[v][heavy];
        r.snap({
          kind: 'rotate', line: rotDir === 'right' ? 'rotR' : 'rotL', flow: cs, vars: vv, at: top, case: { name: cs, top: v, child: ch, grand: gc || null, step: 1 },
          caption: 'Rotate ' + rotDir + ' at <b>' + num(n.value) + '</b>: its ' + heavy + ' child <b>' + num(chVal2) + '</b> rises into its place and <b>' + num(n.value) + '</b> sinks to the ' + rotDir + '. The middle subtree' + (moved !== null ? ' (under <b>' + num(t.nodes[moved].value) + '</b>)' : '') + ' changes parent, which keeps the in-order order intact.'
        });
      }
      r.marks = {}; r.subs = {}; r.edges = {};
      r.marks[top] = mode === 'insert' ? 'found' : 'active';
      r.snap({
        kind: 'settle', line: 'ok', flow: 'done', vars: { node: t.nodes[top].value, hl: hOf(t, heightsOf(t), t.nodes[top].left), hr: hOf(t, heightsOf(t), t.nodes[top].right), bf: r.bf[top] }, at: top, case: { name: cs, top: v, child: ch, grand: gc || null, done: true },
        caption: mode === 'insert'
          ? 'Balanced again. The subtree is exactly as tall as it was before the insert, so no node above it changes height; the check continues upward, but nothing more will need repairing.'
          : 'This subtree is balanced again, but a delete can shorten it, which may unbalance a node higher up. Keep walking to the root.'
      });
      r.marks = {}; r.subs = {}; r.edges = {};
      /* the rotation may have changed which node sits on top: later steps use the parent's id, which is unchanged */
      if (mode === 'insert') { r.marks[top] = 'visited'; }
    }
    void quick;
  }

  function finishStep(r, kind, verb) {
    r.bf = bfTable(r.t);
    r.clearMarks();
    var h = height(r.t), n = size(r.t);
    r.snap({
      kind: 'done', line: null, flow: 'done', vars: { height: h, nodes: n },
      caption: verb + ' Every balance factor is now within ±1: the tree has <b>' + plural(n, 'node') + '</b> and height <b>' + h + '</b>' + (n > 1 ? ', and no AVL tree of ' + n + ' nodes can be taller than 1.44·log₂(n + 2) − 1.33 ≈ ' + (1.4405 * Math.log(n + 2) / Math.LN2 - 1.3277).toFixed(1) + '.' : '.')
    });
  }

  /* ================================================================== AVL insert */
  /* avlInsertSteps(tree, key, {quick}) -> {steps, tree, inserted, id, rotations}
     Steps: start, one compare per node on the way down, attach, one check per ancestor on the way back up,
     and (at most one) rebalance: flag → rotate (→ rotate) → settle. quick skips the start and the compares. */
  function avlInsertSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, { base: o.base });
    r.bf = bfTable(t);
    var newId = 'n' + t.next;
    if (t.root === null) {
      var rid = newNode(t, key);
      t.root = rid; r.bf[rid] = 0; r.marks[rid] = 'key';
      r.snap({ kind: 'attach', line: 'attach', flow: 'start', vars: { key: key, node: null }, caption: 'Insert <b>' + num(key) + '</b>. The tree is empty, so it becomes the root: a single node has height 0 and balance factor 0.' });
      finishStep(r, 'insert', 'Insert finished.');
      return { steps: r.steps, tree: t, inserted: true, id: rid, rotations: 0 };
    }
    var cur = t.root, path = [], side = null;
    if (!o.quick) {
      r.marks[cur] = 'compare';
      r.snap({ kind: 'start', line: null, flow: 'start', vars: { key: key, node: t.nodes[cur].value }, caption: 'Insert <b>' + num(key) + '</b>. First an ordinary binary-search-tree insert: walk down to the empty link where it belongs. Then walk back up and repair the balance.' });
    }
    while (cur !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      if (key === n.value) {
        r.markPath(path); r.marks[cur] = 'found';
        r.snap({ kind: 'dup', line: 'dup', flow: 'start', vars: { key: key, node: n.value }, caption: cmpHtml(key, n.value) + ': ' + num(key) + ' is already in the tree. This tree stores a set, so nothing changes.' });
        return { steps: r.steps, tree: t, inserted: false, id: cur, rotations: 0 };
      }
      side = key < n.value ? 'left' : 'right';
      if (!o.quick) {
        r.markPath(path); r.marks[cur] = 'compare';
        r.snap({
          kind: 'compare', line: side === 'left' ? 'goL' : 'goR', flow: 'start', vars: { key: key, node: n.value }, at: cur,
          caption: cmpHtml(key, n.value) + '. ' + (side === 'left' ? 'Every key in the right subtree is larger than ' + num(n.value) + ', so go <b>left</b>.' : 'Every key in the left subtree is smaller than ' + num(n.value) + ', so go <b>right</b>.')
        });
      }
      path.push(cur);
      if (n[side] !== null) r.edges[cur + '-' + n[side]] = 'path';
      cur = n[side];
    }
    var parent = path[path.length - 1];
    var id = newNode(t, key);
    t.nodes[parent][side] = id;
    r.bf[id] = 0;
    r.clearMarks(); r.markPath(path); r.marks[id] = 'key'; r.edges[parent + '-' + id] = 'path';
    r.snap({
      kind: 'attach', line: 'attach', flow: 'start', vars: { key: key, node: null }, inserted: id,
      caption: 'The ' + side + ' link of <b>' + num(t.nodes[parent].value) + '</b> is empty: hang <b>' + num(key) + '</b> there as a leaf (balance factor 0). The badges above still show the old values; the walk back up refreshes them one node at a time.'
    });
    r.clearMarks();
    var rot0 = r.rot;
    retrace(r, path, 'insert', o.quick);
    finishStep(r, 'insert', 'Insert finished.');
    void newId;
    return { steps: r.steps, tree: t, inserted: true, id: id, rotations: r.rot - rot0 };
  }

  /* ================================================================== AVL delete */
  function avlDeleteSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, {});
    r.bf = bfTable(t);
    if (t.root === null) {
      r.snap({ kind: 'absent', line: 'absent', flow: 'start', vars: { key: key, node: null }, caption: 'The tree is empty, so <b>' + num(key) + '</b> is not in it. Nothing to delete.' });
      return { steps: r.steps, tree: t, removed: false, rotations: 0 };
    }
    var cur = t.root, path = [];
    if (!o.quick) {
      r.marks[cur] = 'compare';
      r.snap({ kind: 'start', line: null, flow: 'start', vars: { key: key, node: t.nodes[cur].value }, caption: 'Delete <b>' + num(key) + '</b>. First find it, exactly as in a search. Then remove it like an ordinary binary-search-tree node, and walk back up repairing the balance.' });
    }
    while (cur !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      if (key === n.value) break;
      var side = key < n.value ? 'left' : 'right';
      if (!o.quick) {
        r.markPath(path); r.marks[cur] = 'compare';
        r.snap({ kind: 'compare', line: side === 'left' ? 'goL' : 'goR', flow: 'start', vars: { key: key, node: n.value }, at: cur, caption: cmpHtml(key, n.value) + '. ' + (side === 'left' ? 'The key can only be in the left subtree: go <b>left</b>.' : 'The key can only be in the right subtree: go <b>right</b>.') });
      }
      path.push(cur);
      if (n[side] !== null) r.edges[cur + '-' + n[side]] = 'path';
      cur = n[side];
    }
    if (cur === null) {
      r.clearMarks(); r.markPath(path, 'muted');
      r.snap({ kind: 'absent', line: 'absent', flow: 'start', vars: { key: key, node: null }, caption: 'The walk fell off the tree: <b>' + num(key) + '</b> is not here, so nothing changes.' });
      return { steps: r.steps, tree: t, removed: false, rotations: 0 };
    }
    var X = cur, nx = t.nodes[X];
    r.clearMarks(); r.markPath(path); r.marks[X] = 'swap';
    var kids = (nx.left !== null ? 1 : 0) + (nx.right !== null ? 1 : 0);
    var parentId = path.length ? path[path.length - 1] : null;
    function link(pid, oldId, newId) {
      if (pid === null) t.root = newId;
      else if (t.nodes[pid].left === oldId) t.nodes[pid].left = newId; else t.nodes[pid].right = newId;
    }
    if (kids < 2) {
      var child = nx.left !== null ? nx.left : nx.right;
      r.snap({
        kind: 'found', line: 'found', flow: 'start', vars: { key: key, node: nx.value }, at: X,
        caption: 'Found <b>' + num(key) + '</b>. It has ' + (kids === 0 ? 'no children, so it can simply be removed.' : 'one child, so that child takes its place.')
      });
      link(parentId, X, child);
      delete t.nodes[X]; delete r.bf[X];
      r.clearMarks(); if (child !== null) r.marks[child] = 'active';
      r.snap({
        kind: 'remove', line: nx.left === null ? 'leafR' : 'leafL', flow: 'start', vars: { key: key, node: null }, at: child,
        caption: kids === 0 ? 'The leaf is gone. Its parent now has one fewer child, so its subtree may have become shorter: the badges above are out of date until the walk back up refreshes them.' : 'The child moved up into the hole. That subtree is shorter by one level, so the badges above are out of date until the walk back up refreshes them.'
      });
    } else {
      r.snap({
        kind: 'found', line: 'found', flow: 'start', vars: { key: key, node: nx.value }, at: X,
        caption: 'Found <b>' + num(key) + '</b>. It has two children, so it cannot just be removed. Its <em>successor</em>, the smallest key in its right subtree, fits the hole exactly.'
      });
      var anc = [X], cs = nx.right;
      while (t.nodes[cs].left !== null) { anc.push(cs); cs = t.nodes[cs].left; }
      var S = cs, sp = anc[anc.length - 1];
      r.clearMarks(); r.markPath(path); r.marks[X] = 'swap'; r.marks[S] = 'pivot';
      r.snap({
        kind: 'succ', line: ['succ', 'succ2'], flow: 'start', vars: { key: key, node: nx.value, s: t.nodes[S].value }, at: S,
        caption: 'Step right once, then left as far as possible: the successor is <b>' + num(t.nodes[S].value) + '</b>. It is larger than everything in the left subtree and smaller than everything else in the right subtree.'
      });
      var sVal = t.nodes[S].value;
      nx.value = sVal;
      r.marks = {}; r.marks[X] = 'pivot'; r.marks[S] = 'swap';
      r.snap({
        kind: 'copy', line: 'copy', flow: 'start', vars: { key: key, node: sVal, s: sVal }, at: X,
        caption: 'Copy <b>' + num(sVal) + '</b> into the node. The order is unchanged, because <b>' + num(sVal) + '</b> is the very next key after <b>' + num(key) + '</b>. Now the old successor node has to go.'
      });
      link(sp, S, t.nodes[S].right);
      delete t.nodes[S]; delete r.bf[S];
      r.clearMarks();
      r.snap({
        kind: 'remove', line: 'delSucc', flow: 'start', vars: { key: key, node: sVal }, at: X,
        caption: 'The successor had no left child, so its right child (if any) took its place. That removal is easy. The badges from here up to the root may be out of date.'
      });
      path = path.concat(anc);
    }
    var rot0 = r.rot;
    r.clearMarks();
    retrace(r, path, 'delete', o.quick);
    finishStep(r, 'delete', 'Delete finished.');
    return { steps: r.steps, tree: t, removed: true, rotations: r.rot - rot0 };
  }

  /* build a tree by inserting keys (AVL), optionally recording brief steps for a hero animation */
  function avlBuildSteps(keys, o) {
    o = o || {};
    var t = empty(), steps = [], rotations = 0;
    var first = new Rec(t, {}); first.bf = {};
    first.snap({ kind: 'start', line: null, caption: o.caption === undefined ? 'An empty AVL tree.' : o.caption });
    steps.push(first.steps[0]);
    var base = { cmp: 0, rot: 0, recol: 0 };
    keys.forEach(function (k) {
      var res = avlInsertSteps(t, k, { quick: true, base: base });
      var lastC = res.steps[res.steps.length - 1].counters;
      base = { cmp: lastC.comparisons, rot: lastC.rotations, recol: 0 };
      var list = res.steps;
      if (o.brief) list = list.filter(function (s) { return s.kind === 'attach' || s.kind === 'flag' || s.kind === 'rotate' || s.kind === 'done'; });
      list.forEach(function (s) { steps.push(s); });
      t = res.tree; rotations += res.rotations;
    });
    return { steps: steps, tree: t, rotations: rotations };
  }

  /* the four cases as small self-contained animations: a base tree, the key that breaks it, the steps */
  var CASE_BASES = {
    LL: { shape: [50, [30, [20], [35]], [70]], key: 10, title: 'LL: left, left', fix: 'rotate right at the top node' },
    LR: { shape: [50, [20, [10], [30]], [70]], key: 25, title: 'LR: left, right', fix: 'rotate left at the child, then right at the top' },
    RR: { shape: mirrorShape([50, [30, [20], [35]], [70]], 100), key: 90, title: 'RR: right, right', fix: 'rotate left at the top node' },
    RL: { shape: mirrorShape([50, [20, [10], [30]], [70]], 100), key: 75, title: 'RL: right, left', fix: 'rotate right at the child, then left at the top' }
  };
  function avlCaseSteps(name) {
    var c = CASE_BASES[name];
    var t = fromShape(c.shape);
    var res = avlInsertSteps(t, c.key, { quick: true });
    var base = new Rec(clone(t), {}); base.bf = bfTable(t);
    var s0 = base.snap({ kind: 'start', caption: 'Start from a balanced tree.' });
    var steps = [s0];
    res.steps.forEach(function (s) { if (s.kind === 'attach' || s.kind === 'flag' || s.kind === 'rotate' || s.kind === 'settle' || s.kind === 'done') steps.push(s); });
    return { steps: steps, tree: res.tree, base: t, key: c.key, title: c.title, fix: c.fix };
  }

  /* ================================================================== red-black insert */
  var RB_TEXT = {
    r1: 'Every node is red or black.',
    r2: 'The root is black.',
    r3: 'Every empty (NIL) leaf counts as black.',
    r4: 'A red node never has a red child.',
    r5: 'Every path from a node down to a NIL has the same number of black nodes.'
  };
  function rbInsertSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, { rules: true, base: o.base });
    r.bhBadges = !!o.blackHeights;
    var quick = !!o.quick;
    function V(z) { return { key: key, z: z === null ? null : r.val(z) }; }
    if (t.root === null) {
      var rid = newNode(t, key, 'red');
      t.root = rid; r.marks[rid] = 'key';
      r.snap({ kind: 'attach', line: ['attach', 'red'], flow: 'attach', vars: V(rid), caption: 'Insert <b>' + num(key) + '</b>. The tree is empty, so the new node is the root. Every new node starts <b>red</b>, which breaks rule 2 (the root is black), and the checker lights up.' });
      t.nodes[rid].color = 'black'; r.recol += 1;
      r.marks = {};
      r.snap({ kind: 'root', line: 'rootBlack', flow: 'root', vars: V(rid), caption: 'Recolour the root black. Rule 2 holds again, and this cannot break any other rule: a black root adds one black node to every path equally.' });
      r.clearMarks();
      return { steps: r.steps, tree: t, inserted: true, id: rid, rotations: 0, recolours: 1 };
    }
    var cur = t.root, path = [], side = null;
    if (!quick) {
      r.marks[cur] = 'compare';
      r.snap({ kind: 'start', line: null, flow: 'attach', vars: V(null), caption: 'Insert <b>' + num(key) + '</b>. Step one is an ordinary binary-search-tree insert. Step two recolours and rotates until all five rules hold again.' });
    }
    while (cur !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      if (key === n.value) {
        r.markPath(path); r.marks[cur] = 'found';
        r.snap({ kind: 'dup', line: 'attach', flow: 'attach', vars: V(cur), caption: cmpHtml(key, n.value) + ': ' + num(key) + ' is already in the tree. Nothing changes.' });
        return { steps: r.steps, tree: t, inserted: false, id: cur, rotations: 0, recolours: 0 };
      }
      side = key < n.value ? 'left' : 'right';
      if (!quick) {
        r.markPath(path); r.marks[cur] = 'compare';
        r.snap({ kind: 'compare', line: 'attach', flow: 'attach', vars: V(null), at: cur, caption: cmpHtml(key, n.value) + ': go <b>' + side + '</b>.' });
      }
      path.push(cur);
      if (n[side] !== null) r.edges[cur + '-' + n[side]] = 'path';
      cur = n[side];
    }
    var parent = path[path.length - 1];
    var z = newNode(t, key, 'red');
    t.nodes[parent][side] = z;
    r.clearMarks(); r.marks[z] = 'key'; r.edges[parent + '-' + z] = 'path';
    var pRed = t.nodes[parent].color === 'red';
    r.snap({
      kind: 'attach', line: ['attach', 'red'], flow: 'attach', vars: V(z), inserted: z,
      caption: 'Hang <b>' + num(key) + '</b> under <b>' + num(t.nodes[parent].value) + '</b> and colour it <b>red</b>. Red is the safe colour: it adds no black node to any path, so rule 5 cannot break.' +
        (pRed ? ' But its parent is red too, so rule 4 <em>is</em> broken.' : ' Its parent is black, so rule 4 holds too: no repair needed.')
    });
    r.clearMarks();
    var rot0 = r.rot, rec0 = r.recol;
    function nameOf(id) { return '<b>' + num(t.nodes[id].value) + '</b>'; }
    for (;;) {
      var p = parentOf(t, z);
      if (p === null) break;
      if (t.nodes[p].color !== 'red') {
        r.marks[z] = 'key'; r.marks[p] = 'compare';
        r.snap({ kind: 'ok', line: 'loop', flow: 'okParent', vars: V(z), caption: 'The parent ' + nameOf(p) + ' is black, so there are no two reds in a row. The loop stops.' });
        r.clearMarks();
        break;
      }
      var g = parentOf(t, p);
      if (g === null) break;
      var leftSide = t.nodes[g].left === p;
      var u = leftSide ? t.nodes[g].right : t.nodes[g].left;
      var uRed = u !== null && t.nodes[u].color === 'red';
      r.clearMarks();
      r.marks[z] = 'key'; r.marks[p] = 'compare'; if (u !== null) r.marks[u] = 'pivot'; r.marks[g] = 'active';
      r.subs[z] = 'z'; r.subs[p] = 'parent'; r.subs[g] = 'grandparent'; if (u !== null) r.subs[u] = 'uncle';
      if (uRed) {
        r.snap({ kind: 'check', line: ['loop', 'uncle', 'uncleRed'], flow: 'uncleRed', vars: V(z), caption: 'Red node ' + nameOf(z) + ' has a red parent ' + nameOf(p) + ' (rule 4). Its uncle ' + nameOf(u) + ' is <b>red</b> too, so recolouring is enough: no rotation.' });
        t.nodes[p].color = 'black'; t.nodes[u].color = 'black'; t.nodes[g].color = 'red';
        r.recol += 3;
        r.clearMarks(); r.marks[g] = 'key'; r.subs[g] = 'z';
        r.snap({ kind: 'recolor', line: ['recolor', 'climb'], flow: 'recolor', vars: V(g), caption: 'Recolour parent and uncle black, and grandparent ' + nameOf(g) + ' red. Every path through the grandparent still has the same number of black nodes (it gave its black to both children). The red-red problem may have moved up two levels: ' + nameOf(g) + ' is the new z.' });
        r.clearMarks();
        z = g;
        continue;
      }
      var inner = z === (leftSide ? t.nodes[p].right : t.nodes[p].left);
      r.snap({
        kind: 'check', line: inner ? ['loop', 'uncle', 'triangle'] : ['loop', 'uncle'], flow: inner ? 'triangle' : 'line', vars: V(z),
        caption: 'Red node ' + nameOf(z) + ' has a red parent ' + nameOf(p) + '. The uncle is <b>black</b>' + (u === null ? ' (empty)' : '') + ', so recolouring alone cannot help: this needs a rotation. ' +
          (inner ? 'z is the <em>inner</em> child, so g → p → z bends like a triangle. First rotate the parent to straighten it into a line.' : 'z is the <em>outer</em> child: g → p → z is a straight line. Recolour, then one rotation at the grandparent.')
      });
      if (inner) {
        var pVal = t.nodes[p].value;
        var dir1 = leftSide ? 'left' : 'right';
        rotate(t, p, dir1, g);
        r.rot += 1;
        r.clearMarks(); r.marks[z] = 'active'; r.marks[p] = 'key'; r.marks[g] = 'active';
        r.subs[p] = 'z'; r.subs[z] = 'parent'; r.subs[g] = 'grandparent';
        r.snap({ kind: 'rotate', line: 'rotP', flow: 'triangle', vars: V(p), caption: 'Rotate ' + dir1 + ' at ' + nameOf(p) + ' (' + num(pVal) + ' sinks, ' + num(t.nodes[z].value) + ' rises). The bend is now a straight line, and the old parent is the new z. Still red-red, but now it is the easy shape.' });
        z = p; p = parentOf(t, z);
        r.clearMarks();
      }
      /* now z, p, g form a line: recolour, then rotate g away from z */
      var pNow = parentOf(t, z), gVal = t.nodes[g].value;
      t.nodes[pNow].color = 'black'; t.nodes[g].color = 'red';
      r.recol += 2;
      r.marks[pNow] = 'compare'; r.marks[g] = 'active'; r.marks[z] = 'key';
      r.subs[pNow] = 'parent'; r.subs[g] = 'grandparent'; r.subs[z] = 'z';
      r.snap({ kind: 'recolor', line: 'fixColors', flow: 'line', vars: V(z), caption: 'Recolour the parent ' + nameOf(pNow) + ' black and the grandparent ' + nameOf(g) + ' red. The red-red pair is gone, but the grandparent\'s two sides now have different black counts (rule 5): the rotation restores it.' });
      var dir2 = t.nodes[g].left === pNow ? 'right' : 'left';
      var topId = rotate(t, g, dir2, parentOf(t, g));
      r.rot += 1;
      r.clearMarks(); r.marks[topId] = 'active'; r.marks[g] = 'active';
      r.snap({ kind: 'rotate', line: 'rotG', flow: 'line', vars: V(z), caption: 'Rotate ' + dir2 + ' at the grandparent ' + '<b>' + num(gVal) + '</b>: the black parent ' + nameOf(topId) + ' becomes the top of this subtree with a red child on each side. Black counts are equal again, and no red node has a red child.' });
      r.clearMarks();
      break;
    }
    if (t.nodes[t.root].color === 'red') {
      r.marks[t.root] = 'active';
      r.snap({ kind: 'check', line: 'rootBlack', flow: 'root', vars: V(t.root), caption: 'The red-red problem climbed all the way to the root, and the root is red (rule 2).' });
      t.nodes[t.root].color = 'black'; r.recol += 1;
      r.marks = {};
      r.snap({ kind: 'root', line: 'rootBlack', flow: 'root', vars: V(t.root), caption: 'Recolour the root black. That adds one black node to <em>every</em> path, so rule 5 still holds, and it is the only way the black height of the whole tree ever grows.' });
    }
    r.clearMarks();
    r.snap({ kind: 'done', line: 'rootBlack', flow: 'done', vars: V(null), caption: 'Insert finished. All five rules hold again: black height <b>' + rbCheck(t).blackHeight + '</b>, tree height <b>' + height(t) + '</b>. At most two rotations and a few recolourings were needed.' });
    return { steps: r.steps, tree: t, inserted: true, id: z, rotations: r.rot - rot0, recolours: r.recol - rec0 };
  }
  function rbBuildSteps(keys, o) {
    o = o || {};
    var t = empty(), steps = [];
    var first = new Rec(t, { rules: true });
    first.snap({ kind: 'start', caption: 'An empty red-black tree.' });
    steps.push(first.steps[0]);
    var base = { cmp: 0, rot: 0, recol: 0 };
    keys.forEach(function (k) {
      var res = rbInsertSteps(t, k, { quick: true, blackHeights: o.blackHeights, base: base });
      var lastC = res.steps[res.steps.length - 1].counters;
      base = { cmp: lastC.comparisons, rot: lastC.rotations, recol: lastC.recolours };
      res.steps.forEach(function (s) { steps.push(s); });
      t = res.tree;
    });
    return { steps: steps, tree: t };
  }

  /* ================================================================== red-black: walk every root-to-NIL path */
  /* rbPathSteps(tree) → one step per NIL slot, left to right: the path lights up and the black nodes on it are
     counted; then the shortest and the longest path. */
  function rbPathSteps(tree) {
    var t = clone(tree), steps = [];
    var paths = [];
    (function walk(id, acc) {
      var n = t.nodes[id];
      var here = acc.concat([id]);
      ['left', 'right'].forEach(function (side) {
        if (n[side] === null) paths.push({ ids: here, side: side, end: id });
        else walk(n[side], here);
      });
    }(t.root, []));
    function blacks(ids) { return ids.filter(function (id) { return t.nodes[id].color === 'black'; }).length; }
    function mk(p, caption, kind, extra) {
      var edges = {};
      for (var i = 1; i < p.ids.length; i++) edges[p.ids[i - 1] + '-' + p.ids[i]] = 'path';
      var marks = {};
      p.ids.forEach(function (id) { if (t.nodes[id].color === 'black') marks[id] = 'path'; });
      var nodes = Object.keys(t.nodes).map(function (id) {
        var n = t.nodes[id], o = { id: id, value: n.value, left: n.left, right: n.right, color: n.color };
        if (p.ids.indexOf(id) !== -1) o.state = 'path';
        return o;
      });
      var b = blacks(p.ids);
      var s = { root: t.root, nodes: nodes, edges: edges, pointers: [{ name: 'NIL', target: p.end, state: 'path' }], kind: kind, caption: caption,
        counters: { blackNodes: b, pathLength: p.ids.length }, path: p.ids.slice(), blacks: b };
      if (extra) for (var k in extra) s[k] = extra[k];
      steps.push(s);
      return s;
    }
    var rc = rbCheck(t);
    paths.forEach(function (p, i) {
      var vals = p.ids.map(function (id) { return num(t.nodes[id].value) + (t.nodes[id].color === 'black' ? '●' : '○'); });
      mk(p, 'Path ' + (i + 1) + ' of ' + paths.length + ': ' + vals.join(' → ') + ' → NIL (the ' + p.side + ' child slot of ' + num(t.nodes[p.end].value) + '). It has <b>' + blacks(p.ids) + '</b> black node' + (blacks(p.ids) === 1 ? '' : 's') + ' (● black, ○ red)' + (rc.valid ? ', the same as every other path.' : '.'), 'path');
    });
    var short = paths.reduce(function (a, b) { return b.ids.length < a.ids.length ? b : a; });
    var long = paths.reduce(function (a, b) { return b.ids.length > a.ids.length ? b : a; });
    mk(short, 'The <b>shortest</b> path has ' + short.ids.length + ' nodes: as few as it can have with ' + blacks(short.ids) + ' black ones.', 'short', { tag: 'short' });
    mk(long, 'The <b>longest</b> path has ' + long.ids.length + ' nodes. Red nodes cannot touch, so at most every other node is red: at most ' + blacks(long.ids) + ' black + ' + (long.ids.length - blacks(long.ids)) + ' red. No path can be more than twice as long as another.', 'long', { tag: 'long' });
    return { steps: steps, paths: paths.length, blackHeight: rc.blackHeight };
  }

  /* ================================================================== race: the same keys into three trees */
  function viewOf(t, keyId) {
    return {
      root: t.root,
      nodes: Object.keys(t.nodes).map(function (id) {
        var n = t.nodes[id], o = { id: id, value: n.value, left: n.left, right: n.right };
        if (n.color) o.color = n.color;
        if (id === keyId) o.state = 'key';
        return o;
      })
    };
  }
  function raceSteps(keys) {
    var b = empty(), a = empty(), c = empty(), steps = [], rotA = 0, rotC = 0, recC = 0;
    steps.push({ kind: 'start', caption: 'Three empty trees, one stream of keys. Each key goes into all three.',
      trees: { bst: viewOf(b), avl: viewOf(a), rb: viewOf(c) }, heights: { bst: -1, avl: -1, rb: -1 }, counters: { rotationsAvl: 0, rotationsRb: 0, n: 0 } });
    keys.forEach(function (k, i) {
      var idB = bstInsertRaw(b, k);
      var ra = avlInsertSteps(a, k, { quick: true }); a = ra.tree; rotA += ra.rotations;
      var rc = rbInsertSteps(c, k, { quick: true }); c = rc.tree; rotC += rc.rotations; recC += rc.recolours;
      var hb = height(b), ha = height(a), hc = height(c);
      var idA = findId(a, k), idC = findId(c, k);
      var notes = [];
      var rbRepair = rc.rotations ? 'rotated ' + plural(rc.rotations, 'time') : rc.recolours && i > 0 ? 'only recoloured' : '';
      if (ra.rotations || rbRepair) {
        notes.push(ra.rotations ? 'AVL rotated ' + plural(ra.rotations, 'time') : 'AVL needed no rotation');
        notes.push(rbRepair ? 'red-black ' + rbRepair : 'red-black needed no repair');
      }
      steps.push({
        kind: 'insert', key: k,
        caption: 'Insert <b>' + num(k) + '</b>. The plain tree hangs it at the far end (height <b>' + hb + '</b>). ' +
          (notes.length ? notes.join('; ') + ', ' : 'Neither balanced tree had to repair anything, ') + 'so they are at heights <b>' + ha + '</b> and <b>' + hc + '</b>.',
        trees: { bst: viewOf(b, idB), avl: viewOf(a, idA), rb: viewOf(c, idC) },
        heights: { bst: hb, avl: ha, rb: hc }, rotations: { avl: rotA, rb: rotC },
        counters: { rotationsAvl: rotA, rotationsRb: rotC, n: i + 1 }
      });
    });
    return { steps: steps, trees: { bst: b, avl: a, rb: c } };
  }

  /* heights for the chart: n keys inserted in `order` ('sorted' | 'random' with a seed) */
  function heightCurves(maxN, order, rng) {
    var keys = [];
    for (var i = 1; i <= maxN; i++) keys.push(i);
    if (order === 'random') {
      for (var j = keys.length - 1; j > 0; j--) { var k = Math.floor((rng ? rng() : Math.random()) * (j + 1)); var tmp = keys[j]; keys[j] = keys[k]; keys[k] = tmp; }
    }
    var b = empty(), a = empty(), c = empty(), out = { bst: [], avl: [], rb: [] };
    keys.forEach(function (key, idx) {
      bstInsertRaw(b, key);
      a = avlRefInsertOne(a, key);
      c = rbRefInsertOne(c, key);
      out.bst.push([idx + 1, height(b)]); out.avl.push([idx + 1, height(a)]); out.rb.push([idx + 1, height(c)]);
    });
    return out;
  }
  /* incremental versions of the references (the tests compare them with the steps) */
  function avlRefInsertOne(t, key) {
    var res = avlInsertSteps(t, key, { quick: true });
    return res.tree;
  }
  function rbRefInsertOne(t, key) {
    var res = rbInsertSteps(t, key, { quick: true });
    return res.tree;
  }
  function avlKeysHeight(keys) { var t = empty(); keys.forEach(function (k) { t = avlInsertSteps(t, k, { quick: true }).tree; }); return height(t); }


  /* ================================================================== the search race: stick vs balanced */
  /* stickRace(n): keys 1..n inserted in order into a plain BST (a stick) and into an AVL tree; both then search for n.
     Step i shows both walks after i comparisons. Each side is {root, nodes, edges}. */
  function stickRace(n) {
    n = n || 15;
    var keys = [];
    for (var i = 1; i <= n; i++) keys.push(i);
    var a = fromKeys(keys), b = empty();
    keys.forEach(function (k) { b = avlInsertSteps(b, k, { quick: true }).tree; });
    function walk(t, key) {
      var out = [], cur = t.root;
      while (cur !== null) { out.push(cur); if (t.nodes[cur].value === key) break; cur = key < t.nodes[cur].value ? t.nodes[cur].left : t.nodes[cur].right; }
      return out;
    }
    var pa = walk(a, n), pb = walk(b, n);
    function side(t, path, k, found) {
      var edges = {}, marks = {};
      for (var j = 0; j < k; j++) marks[path[j]] = 'visited';
      for (var j2 = 1; j2 < k; j2++) edges[path[j2 - 1] + '-' + path[j2]] = 'path';
      if (k > 0) marks[path[k - 1]] = found ? 'found' : 'compare';
      var v = viewOf(t);
      v.nodes.forEach(function (nd) { if (marks[nd.id]) nd.state = marks[nd.id]; });
      v.edges = edges;
      return v;
    }
    var steps = [], total = Math.max(pa.length, pb.length);
    steps.push({ kind: 'start', a: side(a, pa, 0), b: side(b, pb, 0), counters: { plain: 0, balanced: 0 }, heights: { a: height(a), b: height(b) },
      caption: 'The same ' + n + ' keys, inserted in sorted order. The plain tree hangs every key off the right end (height <b>' + height(a) + '</b>). The AVL tree repaired itself after each insert (height <b>' + height(b) + '</b>). Now search for the largest key, <b>' + n + '</b>.' });
    for (var s = 1; s <= total; s++) {
      var ka = Math.min(s, pa.length), kb = Math.min(s, pb.length);
      var doneA = s >= pa.length, doneB = s >= pb.length;
      var msg = [];
      if (s <= pa.length) msg.push('Plain tree: at <b>' + a.nodes[pa[s - 1]].value + '</b>' + (s === pa.length ? ': found, after ' + plural(s, 'comparison') + '.' : ': not it, go right.'));
      if (s <= pb.length) msg.push('AVL tree: at <b>' + b.nodes[pb[s - 1]].value + '</b>' + (s === pb.length ? ': found, after ' + plural(s, 'comparison') + '.' : ': not it, go right.'));
      else msg.push('AVL tree: already done, after ' + plural(pb.length, 'comparison') + '.');
      steps.push({ kind: 'search', a: side(a, pa, ka, doneA), b: side(b, pb, kb, doneB), counters: { plain: ka, balanced: kb }, heights: { a: height(a), b: height(b) }, caption: msg.join(' ') });
    }
    return { steps: steps, plain: pa.length, balanced: pb.length, trees: { a: a, b: b } };
  }

  /* ================================================================== minimal AVL trees (Fibonacci trees) */
  /* minimalAvlSteps(maxH) → steps h = 0 … maxH. T(h) = a root with T(h−1) on the left and T(h−2) on the right.
     Every step is a complete snapshot; the T(h−1) subtree keeps its node ids, so it stays put while the new
     root and the T(h−2) copy arrive. */
  function minimalCount(h) { var a = 1, b = 2; if (h === 0) return 1; if (h === 1) return 2; for (var i = 2; i <= h; i++) { var c = a + b + 1; a = b; b = c; } return b; }
  function minimalAvlSteps(maxH) {
    var steps = [], seq = 0;
    var prev = null;                     // {nodes: [...], root}
    function fresh(h, store) {          // a brand new T(h) with fresh ids; returns root id
      var id = 'm' + (++seq);
      var node = { id: id, left: null, right: null, h: h, fresh: true };
      store.push(node);
      if (h >= 1) node.left = fresh(h - 1, store);
      if (h >= 2) node.right = fresh(h - 2, store);
      return id;
    }
    var counts = [];
    for (var h = 0; h <= maxH; h++) {
      var store, rootId;
      if (h === 0) { store = []; rootId = fresh(0, store); }
      else {
        store = prev.nodes.map(function (n) { return { id: n.id, left: n.left, right: n.right, h: n.h }; });
        var newRoot = 'm' + (++seq);
        var sub = [], subRoot = h >= 2 ? fresh(h - 2, sub) : null;
        store = store.concat(sub);
        store.push({ id: newRoot, left: prev.root, right: subRoot, h: h, fresh: true });
        rootId = newRoot;
      }
      var t = { root: rootId, nodes: {}, next: 1 };
      store.forEach(function (n) { t.nodes[n.id] = { id: n.id, value: 0, left: n.left, right: n.right }; });
      var order = inorderIds(t), key = {};
      order.forEach(function (id, i) { key[id] = i + 1; });
      var H = heightsOf(t);
      var freshIds = {};
      store.forEach(function (n) { if (n.fresh) freshIds[n.id] = true; });
      var nodes = store.map(function (n) {
        var o = { id: n.id, value: key[n.id], left: n.left, right: n.right };
        var b = hOf(t, H, n.left) - hOf(t, H, n.right);
        if (n.left !== null || n.right !== null) { o.badge = bfText(b); }
        if (freshIds[n.id]) o.state = 'key';
        return o;
      });
      var cnt = store.length;
      counts.push(cnt);
      var cap = h === 0 ? 'Height 0: one node. This is the thinnest AVL tree of height 0.'
        : h === 1 ? 'Height 1: the root plus one child. A second child would only make it fuller, not taller.'
        : 'Height ' + h + ': a new root, the height-' + (h - 1) + ' tree on its taller side, and the height-' + (h - 2) + ' tree on the shorter side. That is the fewest nodes any AVL tree of height ' + h + ' can have: <b>' + cnt + '</b> = ' + counts[h - 1] + ' + ' + counts[h - 2] + ' + 1.';
      steps.push({ root: rootId, nodes: nodes, edges: {}, pointers: [], kind: 'minimal', h: h, caption: cap, counters: { height: h, minNodes: cnt } });
      prev = { root: rootId, nodes: store.map(function (n) { return { id: n.id, left: n.left, right: n.right, h: n.h }; }) };
    }
    return { steps: steps, counts: counts };
  }

  /* ================================================================== B-tree (and 2-3 tree) insert */
  /* A B-tree is {root, nodes: {id: {id, keys: [{id, v}], kids: [ids]}}, max, nextNode}. `max` = the most keys a node
     may hold (3 → a B-tree of order 4, a "2-3-4 tree"; 2 → a 2-3 tree). Keys keep their identity when they are
     promoted, so a view can lift the same key into the parent. */
  function bEmpty(max) { return { root: null, nodes: {}, max: max, nextNode: 1 }; }
  function bClone(t) {
    var nodes = {};
    Object.keys(t.nodes).forEach(function (k) { var n = t.nodes[k]; nodes[k] = { id: n.id, keys: n.keys.map(function (x) { return { id: x.id, v: x.v }; }), kids: n.kids.slice() }; });
    return { root: t.root, nodes: nodes, max: t.max, nextNode: t.nextNode };
  }
  function bNewNode(t, keys, kids) { var id = 'b' + t.nextNode; t.nextNode += 1; t.nodes[id] = { id: id, keys: keys, kids: kids || [] }; return id; }
  function bView(t, marks, keyMarks, extra) {
    var out = { root: t.root, nodes: Object.keys(t.nodes).map(function (id) {
      var n = t.nodes[id];
      var o = { id: id, keys: n.keys.map(function (x) { var k = { id: x.id, v: x.v }; if (keyMarks && keyMarks[x.id]) k.state = keyMarks[x.id]; return k; }), children: n.kids.slice() };
      if (marks && marks[id]) o.state = marks[id];
      return o;
    }), max: t.max };
    if (extra) for (var k in extra) out[k] = extra[k];
    return out;
  }
  function bInorder(t, id) {
    if (id === undefined) id = t.root;
    if (id === null) return [];
    var n = t.nodes[id], out = [];
    for (var i = 0; i < n.keys.length; i++) { if (n.kids.length) out = out.concat(bInorder(t, n.kids[i])); out.push(n.keys[i].v); }
    if (n.kids.length) out = out.concat(bInorder(t, n.kids[n.keys.length]));
    return out;
  }
  function bHeight(t) { var h = 0, id = t.root; if (id === null) return -1; while (t.nodes[id].kids.length) { id = t.nodes[id].kids[0]; h++; } return h; }
  function bDepthsOfLeaves(t) {
    var out = [];
    (function walk(id, d) { var n = t.nodes[id]; if (!n.kids.length) out.push(d); else n.kids.forEach(function (c) { walk(c, d + 1); }); }(t.root, 0));
    return out;
  }
  function bInsertSteps(tree, key, o) {
    o = o || {};
    var t = bClone(tree), steps = [], max = t.max;
    function snap(meta, marks, keyMarks) {
      var s = bView(t, marks, keyMarks);
      s.counters = { splits: splits, keys: countKeys(), height: bHeight(t) + 1 };
      for (var k in meta) s[k] = meta[k];
      steps.push(s); return s;
    }
    function countKeys() { var c = 0; Object.keys(t.nodes).forEach(function (id) { c += t.nodes[id].keys.length; }); return c; }
    var splits = o.splitsBase || 0;
    var kid = 'k' + key;
    if (t.root === null) {
      var rid = bNewNode(t, [{ id: kid, v: key }], []);
      t.root = rid;
      snap({ kind: 'insert', caption: 'The tree is empty: the key goes into a new root node, which is also a leaf.' }, {}, (function () { var m = {}; m[kid] = 'key'; return m; }()));
      snap({ kind: 'done', caption: 'One node, one key.' }, {}, {});
      return { steps: steps, tree: t, inserted: true, splits: 0 };
    }
    var path = [], cur = t.root;
    while (true) {
      var n = t.nodes[cur];
      var dup = n.keys.some(function (x) { return x.v === key; });
      if (dup) {
        snap({ kind: 'dup', caption: '<b>' + num(key) + '</b> is already stored. A set keeps one copy, so nothing changes.' }, (function () { var m = {}; m[cur] = 'found'; return m; }()), {});
        return { steps: steps, tree: t, inserted: false, splits: 0 };
      }
      var idx = 0;
      while (idx < n.keys.length && key > n.keys[idx].v) idx++;
      path.push({ id: cur, idx: idx });
      var mk = {}; mk[cur] = 'compare';
      path.slice(0, -1).forEach(function (p) { mk[p.id] = 'visited'; });
      if (!n.kids.length) {
        if (!o.quick) snap({ kind: 'descend', caption: 'Reached a leaf. The key belongs between ' + (idx > 0 ? '<b>' + num(n.keys[idx - 1].v) + '</b>' : 'the left edge') + ' and ' + (idx < n.keys.length ? '<b>' + num(n.keys[idx].v) + '</b>' : 'the right edge') + ', so it slots in here.' }, mk, {});
        break;
      }
      if (!o.quick) {
        var lo = idx > 0 ? num(n.keys[idx - 1].v) : null, hi = idx < n.keys.length ? num(n.keys[idx].v) : null;
        snap({ kind: 'descend', caption: 'Compare <b>' + num(key) + '</b> with the keys in this node: it lies ' + (lo && hi ? 'between <b>' + lo + '</b> and <b>' + hi + '</b>' : lo ? 'above <b>' + lo + '</b>' : 'below <b>' + hi + '</b>') + ', so follow child ' + (idx + 1) + ' of ' + (n.kids.length) + '.' }, mk, {});
      }
      cur = n.kids[idx];
    }
    var leaf = t.nodes[cur];
    leaf.keys.splice(path[path.length - 1].idx, 0, { id: kid, v: key });
    var km = {}; km[kid] = 'key';
    var mm = {}; mm[cur] = 'compare';
    snap({ kind: 'insert', caption: 'Insert <b>' + num(key) + '</b> into the leaf, keeping its keys sorted. ' + (leaf.keys.length > max ? 'The node now holds ' + leaf.keys.length + ' keys, one more than the ' + max + ' allowed: it overflows.' : 'It holds ' + leaf.keys.length + ' of at most ' + max + ' keys: there is room, so nothing else changes.') }, leaf.keys.length > max ? (function () { var e = {}; e[cur] = 'error'; return e; }()) : mm, km);
    var level = path.length - 1;
    while (t.nodes[path[level].id].keys.length > max) {
      var nid = path[level].id, node = t.nodes[nid];
      var m = Math.floor((node.keys.length - 1) / 2);
      var median = node.keys[m];
      var em = {}; em[nid] = 'error';
      var pk = {}; pk[median.id] = 'pivot';
      snap({ kind: 'overflow', caption: 'The node overflows with ' + node.keys.length + ' keys. Split it around the middle key <b>' + num(median.v) + '</b>: the smaller keys stay, the larger keys move to a new sibling, and <b>' + num(median.v) + '</b> is promoted into the parent.' }, em, pk);
      var leftKeys = node.keys.slice(0, m), rightKeys = node.keys.slice(m + 1);
      var leftKids = node.kids.slice(0, m + 1), rightKids = node.kids.slice(m + 1);
      node.keys = leftKeys; node.kids = leftKids;
      var rightId = bNewNode(t, rightKeys, rightKids);
      splits += 1;
      var parentEntry = level > 0 ? path[level - 1] : null;
      var mk2 = {}; mk2[nid] = 'active'; mk2[rightId] = 'active';
      var pm = {}; pm[median.id] = 'pivot';
      if (parentEntry === null) {
        var newRoot = bNewNode(t, [median], [nid, rightId]);
        t.root = newRoot;
        mk2[newRoot] = 'active';
        snap({ kind: 'split', caption: 'That was the root, so there is no parent to promote into: a new root is created to hold <b>' + num(median.v) + '</b>. This is the only way a B-tree grows taller, and it grows at the <em>top</em>, so every leaf stays at the same depth.' }, mk2, pm);
        path.unshift({ id: newRoot, idx: 0 });
        level = 0;
        break;
      }
      var par = t.nodes[parentEntry.id];
      par.keys.splice(parentEntry.idx, 0, median);
      par.kids.splice(parentEntry.idx + 1, 0, rightId);
      mk2[parentEntry.id] = par.keys.length > max ? 'error' : 'active';
      snap({ kind: 'split', caption: 'Split done: two nodes, and <b>' + num(median.v) + '</b> now sits in the parent between them, separating the two halves. ' + (par.keys.length > max ? 'The parent now overflows too, so the same repair runs one level up.' : 'The parent had room, so the repair stops here.') }, mk2, pm);
      level -= 1;
    }
    snap({ kind: 'done', caption: 'Insert finished. Every leaf is still at the same depth (height ' + (bHeight(t) + 1) + ' levels), and no node holds more than ' + max + ' keys.' }, {}, {});
    return { steps: steps, tree: t, inserted: true, splits: splits - (o.splitsBase || 0) };
  }
  function bBuildSteps(keys, max, o) {
    var t = bEmpty(max), steps = [], splits = 0;
    keys.forEach(function (k) { var res = bInsertSteps(t, k, Object.assign({}, o, { splitsBase: splits })); res.steps.forEach(function (s) { steps.push(s); }); t = res.tree; splits += res.splits; });
    if (!steps.length) steps.push(Object.assign(bView(t, {}, {}), { kind: 'start', caption: 'An empty tree.', counters: { splits: 0, keys: 0, height: 0 } }));
    return { steps: steps, tree: t, splits: splits };
  }

  return {
    CODE: CODE, RB_TEXT: RB_TEXT, CASE_BASES: CASE_BASES,
    num: num, bfText: bfText,
    empty: empty, clone: clone, size: size, height: height, heightsOf: heightsOf, bfTable: bfTable, findId: findId, parentOf: parentOf,
    inorder: inorder, inorderIds: inorderIds, depths: depths, shape: shape, shapeColored: shapeColored, fromShape: fromShape, mirrorShape: mirrorShape,
    isBst: isBst, isAvl: isAvl, isRedBlack: isRedBlack, rbCheck: rbCheck,
    rotate: rotate, rotateUp: rotateUp, xyState: xyState, viewOf: viewOf,
    bstInsertRaw: bstInsertRaw, fromKeys: fromKeys, avlRef: avlRef, rbRef: rbRef,
    avlInsertSteps: avlInsertSteps, avlDeleteSteps: avlDeleteSteps, avlBuildSteps: avlBuildSteps, avlCaseSteps: avlCaseSteps,
    rbInsertSteps: rbInsertSteps, rbBuildSteps: rbBuildSteps, rbPathSteps: rbPathSteps,
    stickRace: stickRace, raceSteps: raceSteps, heightCurves: heightCurves, avlKeysHeight: avlKeysHeight,
    minimalAvlSteps: minimalAvlSteps, minimalCount: minimalCount,
    bEmpty: bEmpty, bInsertSteps: bInsertSteps, bBuildSteps: bBuildSteps, bInorder: bInorder, bHeight: bHeight, bDepthsOfLeaves: bDepthsOfLeaves, bView: bView
  };
}));
