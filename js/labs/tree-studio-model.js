/* Tree studio · pure model (no DOM). Browser: VDSA.labs.treeStudio. Node: require('js/labs/tree-studio-model.js').

   One "structure" per kind: BST, AVL, red-black, min-heap, max-heap, trie. Every operation delegates to the tested lesson
   generators (lessons 19, 20, 21, 22) and returns the same normalised frames, whatever the kind:

     run(S, {op, value}, {quick}) -> {state, frames, ok, message}
     bulk(S, 'insert', values, {quick}) -> {state, frames, done, skipped}
     idle(S) -> one resting frame          replay(kind, keys) -> S         create(kind) -> S

   S (a structure state) is plain data and is never mutated: {kind, data, keys, cmp, rot, recol, uid, heights, counts}
     heights / counts: tree height and node count after every operation (the lab's height-over-time chart)..
     data: a tree (BST/AVL/RB) | heap items | word list (trie).   keys: what is stored, in insertion order (the URL).
   A frame: {view, caption, kind, cmp, rot, recol, height, nodes}. `view` is a VDSA.views.tree snapshot.
   cmp/rot are totals for the whole session (they carry over from one operation to the next).
   rot is "rotations" for trees and "swaps" for heaps; it is 0 for tries.

   Red-black deletion has no generator (lesson 20 explains why it is the hardest algorithm in the chapter): the lab
   removes the key and rebuilds from the remaining keys in their original order, and says so in the caption.
   Heaps only give up their root, so "delete" on a heap is refused and points to extract. */
(function (root, factory) {
  'use strict';
  var deps;
  if (typeof module === 'object' && module.exports) {
    var p = require('path');
    var a = function (f) { return require(p.join(__dirname, '..', 'algos', f)); };
    deps = { B: a('19-binary-search-trees.js'), A: a('20-balanced-trees.js'), H: a('21-heaps.js'), T: a('22-tries.js') };
    module.exports = factory(deps);
  } else if (root && root.VDSA && root.VDSA.algos) {
    var al = root.VDSA.algos;
    deps = { B: al.lesson19, A: al.lesson20, H: al.heap, T: al.tries };
    root.VDSA.labs = root.VDSA.labs || {};
    root.VDSA.labs.treeStudio = factory(deps);
  }
}(typeof window !== 'undefined' ? window : null, function (D) {
  'use strict';
  var B = D.B, A = D.A, H = D.H, T = D.T;

  var KINDS = {
    bst: { label: 'BST', name: 'Binary search tree', lesson: '19-binary-search-trees', cap: 127, word: false },
    avl: { label: 'AVL', name: 'AVL tree', lesson: '20-balanced-trees', cap: 127, word: false },
    rb: { label: 'Red-black', name: 'Red-black tree', lesson: '20-balanced-trees', cap: 127, word: false },
    minheap: { label: 'Min-heap', name: 'Min-heap', lesson: '21-heaps', cap: 63, word: false, heap: 'min' },
    maxheap: { label: 'Max-heap', name: 'Max-heap', lesson: '21-heaps', cap: 63, word: false, heap: 'max' },
    trie: { label: 'Trie', name: 'Trie', lesson: '22-tries', cap: 40, word: true }
  };
  var ORDER = ['bst', 'avl', 'rb', 'minheap', 'maxheap', 'trie'];
  var VALUE_MIN = -99, VALUE_MAX = 999, MAX_WORD = 8;
  var SAMPLE_WORDS = ['tea', 'ten', 'to', 'inn', 'in', 'i', 'team', 'tent', 'ted', 'sea', 'sun', 'sung'];

  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isTree(kind) { return kind === 'bst' || kind === 'avl' || kind === 'rb'; }
  function isHeap(kind) { return kind === 'minheap' || kind === 'maxheap'; }
  function fmtVal(kind, v) { return KINDS[kind].word ? '“' + esc(v) + '”' : num(v); }

  /* ------------------------------------------------------------------ parsing */
  function parseValue(kind, text) {
    var s = String(text === undefined || text === null ? '' : text).trim();
    if (KINDS[kind].word) {
      if (!s) return { value: null, error: 'Type a word first (letters a to z).' };
      s = s.toLowerCase();
      if (!/^[a-z]+$/.test(s)) return { value: null, error: 'Use only the letters a to z.' };
      if (s.length > MAX_WORD) return { value: null, error: 'Keep words to ' + MAX_WORD + ' letters or fewer.' };
      return { value: s, error: null };
    }
    if (!s) return { value: null, error: 'Type a whole number first.' };
    if (!/^[-−]?\d+$/.test(s)) return { value: null, error: '“' + s + '” is not a whole number.' };
    var n = parseInt(s.replace('−', '-'), 10);
    if (n < VALUE_MIN || n > VALUE_MAX) return { value: null, error: 'Keep numbers between ' + VALUE_MIN + ' and ' + VALUE_MAX + '.' };
    return { value: n, error: null };
  }
  /* "5, 3 8" -> values, validated one by one; used by the URL and the bulk field */
  function parseList(kind, text) {
    var toks = String(text || '').split(/[\s,;]+/).filter(Boolean), out = [];
    for (var i = 0; i < toks.length; i++) {
      var r = parseValue(kind, toks[i]);
      if (r.error) return { values: null, error: r.error };
      out.push(r.value);
    }
    return { values: out, error: null };
  }

  /* ------------------------------------------------------------------ view statistics (any snapshot) */
  function kidsOf(n) {
    if (n.children) return n.children;
    var out = [];
    if (n.left !== null && n.left !== undefined) out.push(n.left);
    if (n.right !== null && n.right !== undefined) out.push(n.right);
    return out;
  }
  function indexView(view) {
    var by = {};
    (view.nodes || []).forEach(function (n) { by[n.id] = n; });
    return by;
  }
  /* {height (links; empty tree -1), count} over the nodes reachable from the root */
  function viewStats(view) {
    if (!view || view.root === null || view.root === undefined) return { height: -1, count: 0 };
    var by = indexView(view), seen = {}, best = 0, count = 0, stack = [[view.root, 0]];
    while (stack.length) {
      var e = stack.pop();
      if (seen[e[0]] || !by[e[0]]) continue;
      seen[e[0]] = true; count++;
      if (e[1] > best) best = e[1];
      kidsOf(by[e[0]]).forEach(function (k) { stack.push([k, e[1] + 1]); });
    }
    return { height: best, count: count };
  }
  /* pre / in / post / level order of a snapshot: [{id, label, state}]. n-ary trees have no in-order. */
  function orders(view) {
    var out = { pre: [], inorder: [], post: [], level: [] };
    if (!view || view.root === null || view.root === undefined) return out;
    var by = indexView(view), nary = (view.nodes || []).some(function (n) { return !!n.children; });
    function item(n) { return { id: n.id, label: n.label !== undefined ? String(n.label) : String(n.value), state: n.state || 'default' }; }
    var seen = {};
    (function pre(id) {
      var n = by[id]; if (!n || seen[id]) return; seen[id] = true;
      out.pre.push(item(n));
      kidsOf(n).forEach(pre);
    }(view.root));
    seen = {};
    (function post(id) {
      var n = by[id]; if (!n || seen[id]) return; seen[id] = true;
      kidsOf(n).forEach(post);
      out.post.push(item(n));
    }(view.root));
    if (!nary) {
      var stack = [], cur = view.root, guard = 0;
      while ((cur !== null && cur !== undefined || stack.length) && guard++ < 100000) {
        while (cur !== null && cur !== undefined && by[cur]) { stack.push(cur); cur = by[cur].left; }
        if (!stack.length) break;
        cur = stack.pop();
        out.inorder.push(item(by[cur]));
        cur = by[cur].right;
      }
    }
    var q = [view.root], qi = 0; seen = {};
    while (qi < q.length) {
      var id = q[qi++], n2 = by[id];
      if (!n2 || seen[id]) continue; seen[id] = true;
      out.level.push(item(n2));
      kidsOf(n2).forEach(function (k) { q.push(k); });
    }
    return out;
  }

  /* ------------------------------------------------------------------ views of a resting structure */
  function treeView(tree, kind, marks) {
    var bf = kind === 'avl' ? A.bfTable(tree) : null;
    var nodes = Object.keys(tree.nodes).map(function (id) {
      var n = tree.nodes[id], o = { id: id, value: n.value, left: n.left, right: n.right };
      if (kind === 'rb' && n.color) o.color = n.color;
      if (bf) o.badge = A.bfText(bf[id]);
      if (marks && marks[id]) o.state = marks[id];
      return o;
    });
    return { root: tree.root, nodes: nodes, edges: {}, pointers: [] };
  }
  function heapView(items, marks) {
    var n = items.length;
    return {
      root: n ? items[0].id : null,
      nodes: items.map(function (it, p) {
        var o = { id: it.id, value: it.value, sub: String(p) };
        if (2 * p + 1 < n) o.left = items[2 * p + 1].id;
        if (2 * p + 2 < n) o.right = items[2 * p + 2].id;
        if (marks && marks[it.id]) o.state = marks[it.id];
        return o;
      }),
      edges: [], pointers: []
    };
  }
  function trieView(words) { return T.treeView(T.build(words), {}); }
  function dataView(S, marks) {
    if (isTree(S.kind)) return treeView(S.data, S.kind, marks);
    if (isHeap(S.kind)) return heapView(S.data, marks);
    return trieView(S.data);
  }

  /* ------------------------------------------------------------------ frames */
  function mkFrame(view, o) {
    var st = viewStats(view);
    return {
      view: view, caption: o.caption || '', kind: o.kind || '',
      cmp: o.cmp, rot: o.rot || 0, recol: o.recol || 0,
      height: st.height, nodes: o.nodes !== undefined ? o.nodes : st.count
    };
  }
  /* turn one generator step into a frame; `S` is the state the operation started from (totals carry over) */
  function fromStep(S, step, extra) {
    var kind = S.kind, view, c = step.counters || {}, cmp, rot = 0, recol = 0, nodes;
    if (isTree(kind)) {
      if (kind === 'bst' && !extra.native) {
        var ptrs = (step.pointers || []).slice();
        var pr = step.probe;
        if (pr) {
          var pv = 'key ' + num(pr.value);
          if (pr.at) ptrs.push({ name: pv, target: pr.at, state: 'key' });
          else if (pr.slot && pr.slot.parent) ptrs.push({ name: pv + ' → ∅', target: pr.slot.parent, state: 'error' });
        }
        view = {
          root: step.root,
          nodes: step.nodes.map(function (n) {
            var o = { id: n.id, value: n.value, left: n.left, right: n.right };
            if (n.state) o.state = n.state;
            if (n.sub !== undefined) o.sub = n.sub;
            if (n.badge !== undefined) o.badge = n.badge;
            return o;
          }),
          edges: step.edges || {}, pointers: ptrs
        };
        if (extra.colours) view.nodes.forEach(function (n) { if (extra.colours[n.id]) n.color = extra.colours[n.id]; });
      } else {
        view = { root: step.root, nodes: step.nodes, edges: step.edges || {}, pointers: step.pointers || [] };
      }
      cmp = c.comparisons; rot = c.rotations || 0; recol = c.recolours || 0;
    } else if (isHeap(kind)) {
      view = H.treeState(step);
      cmp = c.comparisons; rot = c.swaps || 0;
    } else {
      view = step.tree;
      cmp = c.visited || 0;
    }
    var f = mkFrame(view, { caption: step.caption, kind: step.kind, cmp: S.cmp + (cmp || 0), rot: S.rot + rot, recol: S.recol + recol });
    if (kind === 'trie') f.nodes = viewStats(view).count - 1;
    if (extra.height !== undefined) f.height = extra.height;
    void nodes;
    return f;
  }
  /* the tallest frame's counters are the operation's totals */
  function totals(S, frames) {
    var last = frames[frames.length - 1];
    return { cmp: last.cmp, rot: last.rot, recol: last.recol };
  }

  /* ------------------------------------------------------------------ states */
  function create(kind) {
    var data = isTree(kind) ? A.empty() : isHeap(kind) ? [] : [];
    return { kind: kind, data: data, keys: [], cmp: 0, rot: 0, recol: 0, uid: 0, heights: [], counts: [] };
  }
  function size(S) { return isTree(S.kind) ? A.size(S.data) : isHeap(S.kind) ? S.data.length : T.build(S.data).nodes; }
  function count(S) { return isTree(S.kind) ? A.size(S.data) : isHeap(S.kind) ? S.data.length : S.data.length; }
  function heightOf(S) { return viewStats(dataView(S)).height - (S.kind === 'trie' ? 0 : 0); }
  function withData(S, o) {
    var n = {};
    Object.keys(S).forEach(function (k) { n[k] = S[k]; });
    Object.keys(o).forEach(function (k) { n[k] = o[k]; });
    return n;
  }
  function idle(S, caption) {
    var f = mkFrame(dataView(S), { caption: caption || '', kind: 'idle', cmp: S.cmp, rot: S.rot, recol: S.recol });
    if (S.kind === 'trie') f.nodes = viewStats(f.view).count - 1;
    return f;
  }
  function removeFirst(list, v) {
    var i = list.indexOf(v);
    if (i < 0) return list.slice();
    var out = list.slice(); out.splice(i, 1); return out;
  }
  function keepOnly(frames, kinds) {
    var out = frames.filter(function (f, i) { return i === frames.length - 1 || kinds.indexOf(f.kind) !== -1; });
    return out.length ? out : frames.slice(-1);
  }

  /* ------------------------------------------------------------------ operations */
  function refuse(S, message) { return { state: S, frames: [idle(S, message)], ok: false, message: message }; }
  function done(S2, frames, ok, message) {
    var t = totals(S2, frames);
    var out = withData(S2, { cmp: t.cmp, rot: t.rot, recol: t.recol });
    var st = viewStats(dataView(out));
    out.heights = S2.heights.concat([st.height]);
    out.counts = S2.counts.concat([out.kind === 'trie' ? st.count - 1 : st.count]);
    return { state: out, frames: frames, ok: ok, message: message || '' };
  }

  function insert(S, v, o) {
    var k = S.kind, cap = KINDS[k].cap;
    if (KINDS[k].word && S.data.indexOf(v) === -1 && S.data.length >= cap) return refuse(S, 'This trie already holds ' + cap + ' words. Clear it or delete one first.');
    if (!KINDS[k].word && !isHeap(k) && count(S) >= cap && !hasKey(S, v)) return refuse(S, 'The studio stops at ' + cap + ' nodes so every step stays readable. Clear it or delete a key first.');
    if (isHeap(k) && S.data.length >= cap) return refuse(S, 'The studio stops at ' + cap + ' values in a heap so the tree stays readable. Extract some or clear it.');
    var res, frames, S2, ok = true;
    if (k === 'bst') res = B.insertSteps(S.data, v, { quick: o.quick });
    else if (k === 'avl') res = A.avlInsertSteps(S.data, v, { quick: o.quick });
    else if (k === 'rb') res = A.rbInsertSteps(S.data, v, { quick: o.quick });
    if (res) {
      frames = res.steps.map(function (s) { return fromStep(S, s, {}); });
      ok = res.inserted;
      S2 = withData(S, { data: res.tree, keys: ok ? S.keys.concat([v]) : S.keys });
      return done(S2, frames, ok, ok ? '' : num(v) + ' is already stored: a tree here is a set, so nothing changed.');
    }
    if (isHeap(k)) {
      var id = 'h' + (S.uid + 1);
      var hr = H.insert(S.data, v, { kind: KINDS[k].heap, id: id });
      frames = hr.steps.map(function (s) { return fromStep(S, s, {}); });
      if (o.compress) frames = keepOnly(frames, ['place', 'swap', 'done']);
      S2 = withData(S, { data: hr.items, keys: S.keys.concat([v]), uid: S.uid + 1 });
      return done(S2, frames, true);
    }
    var tr = T.opTrace(S.data, 'insert', v);
    frames = tr.steps.map(function (s) { return fromStep(S, s, {}); });
    ok = !(S.data.indexOf(v) !== -1);
    if (o.compress) frames = keepOnly(frames, ['create', 'mark']);
    S2 = withData(S, { data: tr.words, keys: ok ? S.keys.concat([v]) : S.keys });
    return done(S2, frames, ok, ok ? '' : '“' + v + '” is already stored.');
  }
  function hasKey(S, v) { return S.keys.indexOf(v) !== -1; }

  function del(S, v, o) {
    var k = S.kind;
    if (isHeap(k)) return refuse(S, 'A heap only gives up its root, so there is no delete-by-value. Use Extract to remove the ' + (k === 'minheap' ? 'smallest' : 'largest') + ' value.');
    var res, frames, S2;
    if (k === 'bst' || k === 'avl') {
      res = k === 'bst' ? B.deleteSteps(S.data, v, {}) : A.avlDeleteSteps(S.data, v, {});
      var removed = k === 'bst' ? res.deleted : res.removed;
      frames = res.steps.map(function (s) { return fromStep(S, s, {}); });
      S2 = withData(S, { data: res.tree, keys: removed ? removeFirst(S.keys, v) : S.keys });
      return done(S2, frames, removed, removed ? '' : num(v) + ' is not in the tree, so nothing was deleted.');
    }
    if (k === 'rb') {
      if (A.findId(S.data, v) === null) {
        var sr = B.searchSteps(S.data, v, { prune: false });
        var cols = colours(S.data);
        frames = sr.steps.map(function (s) { return fromStep(S, s, { native: false, colours: cols }); });
        return done(S, frames, false, num(v) + ' is not in the tree, so nothing was deleted.');
      }
      var keys2 = removeFirst(S.keys, v), t = A.empty(), cmpAdd = 0;
      keys2.forEach(function (x) { var r = A.rbInsertSteps(t, x, { quick: true }); t = r.tree; });
      var mark = {}; mark[A.findId(S.data, v)] = 'swap';
      var f1 = mkFrame(treeView(S.data, 'rb', mark), {
        kind: 'remove', cmp: S.cmp, rot: S.rot, recol: S.recol,
        caption: 'Delete <b>' + num(v) + '</b>. Red-black deletion has six repair cases and this lab does not animate them (lesson 20 walks through why). It removes the key and rebuilds the tree by re-inserting the remaining keys in their original order.'
      });
      var S1 = withData(S, { data: t, keys: keys2 });
      var f2 = mkFrame(treeView(t, 'rb'), { kind: 'rebuilt', cmp: S.cmp, rot: S.rot, recol: S.recol, caption: 'Rebuilt without ' + num(v) + '. A real delete keeps most nodes where they are; the counters stay as they were.' });
      void cmpAdd;
      return done(S1, [f1, f2], true);
    }
    var tr = T.opTrace(S.data, 'delete', v);
    frames = tr.steps.map(function (s) { return fromStep(S, s, {}); });
    var had = S.data.indexOf(v) !== -1;
    S2 = withData(S, { data: tr.words, keys: had ? removeFirst(S.keys, v) : S.keys });
    return done(S2, frames, had, had ? '' : '“' + v + '” is not stored, so nothing was deleted.');
  }
  function colours(tree) {
    var out = {};
    Object.keys(tree.nodes).forEach(function (id) { if (tree.nodes[id].color) out[id] = tree.nodes[id].color; });
    return out;
  }

  function search(S, v) {
    var k = S.kind, frames, found;
    if (isTree(k)) {
      var res = B.searchSteps(S.data, v, { prune: false });
      var cols = k === 'rb' ? colours(S.data) : null, bf = k === 'avl' ? A.bfTable(S.data) : null;
      frames = res.steps.map(function (s) {
        var f = fromStep(S, s, { colours: cols });
        if (bf) f.view.nodes.forEach(function (n) { if (bf[n.id] !== undefined) n.badge = A.bfText(bf[n.id]); });
        return f;
      });
      found = res.found !== null;
      return done(S, frames, found, found ? '' : num(v) + ' is not in the tree.');
    }
    if (isHeap(k)) {
      frames = [];
      var items = S.data, n = items.length, c = 0, hit = -1, seen = {};
      if (!n) return done(S, [idle(S, 'The heap is empty, so ' + num(v) + ' is not in it.')], false, num(v) + ' is not in the heap.');
      frames.push(mkFrame(heapView(items), { kind: 'start', cmp: S.cmp, rot: S.rot, caption: 'Search for <b>' + num(v) + '</b>. A heap only promises that a parent beats its children: there is no left-or-right rule to follow, so the only way is to scan the array, slot by slot.' }));
      for (var i = 0; i < n; i++) {
        c++;
        var marks = {};
        Object.keys(seen).forEach(function (id) { marks[id] = 'visited'; });
        var hitHere = items[i].value === v;
        marks[items[i].id] = hitHere ? 'found' : 'compare';
        frames.push(mkFrame(heapView(items, marks), {
          kind: hitHere ? 'found' : 'scan', cmp: S.cmp + c, rot: S.rot,
          caption: hitHere ? 'Slot ' + i + ' holds <b>' + num(v) + '</b>: found after ' + c + ' comparison' + (c === 1 ? '' : 's') + '.' : 'Slot ' + i + ' holds ' + num(items[i].value) + ', not ' + num(v) + '. Keep scanning.'
        }));
        seen[items[i].id] = true;
        if (hitHere) { hit = i; break; }
      }
      if (hit < 0) {
        var allMarks = {}; items.forEach(function (it) { allMarks[it.id] = 'visited'; });
        frames.push(mkFrame(heapView(items, allMarks), { kind: 'absent', cmp: S.cmp + c, rot: S.rot, caption: 'All ' + n + ' slots checked: <b>' + num(v) + '</b> is not in the heap. An absent key costs the full n comparisons.' }));
      }
      return done(S, frames, hit >= 0, hit >= 0 ? '' : num(v) + ' is not in the heap.');
    }
    var tr = T.opTrace(S.data, 'search', v);
    frames = tr.steps.map(function (s) { return fromStep(S, s, {}); });
    found = !!tr.result;
    return done(S, frames, found, found ? '' : '“' + v + '” is not stored as a whole word.');
  }

  function extract(S) {
    var k = S.kind;
    if (!isHeap(k)) return refuse(S, 'Only heaps have extract.');
    if (!S.data.length) return refuse(S, 'The heap is empty, so there is nothing to extract.');
    var r = H.extract(S.data, { kind: KINDS[k].heap });
    var frames = r.steps.map(function (s) { return fromStep(S, s, {}); });
    var S2 = withData(S, { data: r.items, keys: removeFirst(S.keys, r.value) });
    return done(S2, frames, true);
  }

  function run(S, req, o) {
    o = o || {};
    if (req.op === 'insert') return insert(S, req.value, o);
    if (req.op === 'delete') return del(S, req.value, o);
    if (req.op === 'search') return search(S, req.value);
    if (req.op === 'extract') return extract(S);
    return refuse(S, 'Unknown operation.');
  }

  /* insert many values; frames are the concatenation. compress: cheap frames only, and at most one per key
     when the run is long, so a bulk insert stays watchable. */
  function bulk(S, values, o) {
    o = o || {};
    var cur = S, frames = [], skipped = [], n = 0, limit = 90;
    var perKey = [];
    values.forEach(function (v) {
      var r = insert(cur, v, { quick: true, compress: true });
      if (r.state === cur && !r.ok && /studio stops|already holds/.test(r.message)) { skipped.push(v); return; }
      if (!r.ok) skipped.push(v); else n++;
      perKey.push(r.frames);
      cur = r.state;
    });
    var total = perKey.reduce(function (a, f) { return a + f.length; }, 0);
    perKey.forEach(function (f) { frames = frames.concat(total > limit ? f.slice(-1) : f); });
    if (!frames.length) frames = [idle(cur)];
    return { state: cur, frames: frames, done: n, skipped: skipped };
  }

  function replay(kind, keys) {
    var S = create(kind);
    keys.forEach(function (v) { var r = insert(S, v, { quick: true, compress: true }); S = r.state; });
    return S;
  }

  /* ------------------------------------------------------------------ inputs and URL state */
  function randomValues(kind, S, n, rng) {
    var out = [], have = {}, tries = 0;
    (S ? S.keys : []).forEach(function (k) { have[k] = true; });
    if (KINDS[kind].word) {
      var words = T.randomWords(Math.floor(rng() * 1e9), Math.max(n, 1), 3 + Math.floor(rng() * 3));
      words.forEach(function (w) { if (!have[w] && out.length < n) out.push(w); });
      return out;
    }
    while (out.length < n && tries++ < 2000) {
      var v = 1 + Math.floor(rng() * 99);
      if (!have[v]) { have[v] = true; out.push(v); }
    }
    return out;
  }
  function inOrderValues(kind, S, n) {
    if (KINDS[kind].word) return SAMPLE_WORDS.filter(function (w) { return !S || S.keys.indexOf(w) === -1; });
    var have = {}, out = [];
    (S ? S.keys : []).forEach(function (k) { have[k] = true; });
    for (var v = 1; out.length < n && v <= VALUE_MAX; v++) if (!have[v]) out.push(v);
    return out;
  }

  /* ?s=avl&k=50,30,70&c=1   s = structure, k = stored keys in insertion order, c = compare mode */
  function encode(o) {
    var q = [];
    q.push('s=' + (o.kind || 'bst'));
    if (o.keys && o.keys.length) q.push('k=' + o.keys.join(','));
    if (o.compare) q.push('c=1');
    return q.join('&');
  }
  function decode(search) {
    var p = {}, out = { kind: 'bst', keys: [], compare: false };
    String(search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var key = i < 0 ? kv : kv.slice(0, i), val = i < 0 ? '' : kv.slice(i + 1);
      try { p[key] = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (e) { p[key] = val; }
    });
    if (p.s && KINDS[p.s]) out.kind = p.s;
    if (p.c === '1') out.compare = true;
    if (p.k) {
      var kindForKeys = out.compare ? 'bst' : out.kind;
      var r = parseList(kindForKeys, p.k);
      if (!r.error) {
        var seen = {}, cap = KINDS[kindForKeys].cap;
        r.values.forEach(function (v) {
          if (isHeap(kindForKeys) || !seen[v]) { seen[v] = true; if (out.keys.length < cap) out.keys.push(v); }
        });
      }
    }
    return out;
  }

  return {
    KINDS: KINDS, ORDER: ORDER, SAMPLE_WORDS: SAMPLE_WORDS, VALUE_MIN: VALUE_MIN, VALUE_MAX: VALUE_MAX,
    create: create, idle: idle, run: run, bulk: bulk, replay: replay, size: size, count: count, heightOf: heightOf,
    parseValue: parseValue, parseList: parseList, viewStats: viewStats, orders: orders,
    randomValues: randomValues, inOrderValues: inOrderValues, encode: encode, decode: decode,
    isTree: isTree, isHeap: isHeap, fmtVal: fmtVal
  };
}));
