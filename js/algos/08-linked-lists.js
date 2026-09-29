/* Lesson 08 · Linked lists — pure step generators (no DOM).

   Browser: VDSA.algos.linkedLists.<fn>     Node: require('js/algos/08-linked-lists.js').<fn>

   Every generator returns plain snapshot objects that VDSA.views.list can draw directly:
     { nodes: [{id, value, next, prev?, state?, nextState?, prevState?, detached?, x?, y?, label?, text?}],
       head, pointers: [{name, target, state, side?, nullSide?}],
       kind, caption, line, vars, counters, flow? }
   Node ids are stable for a node's whole life, so the view moves nodes and re-routes arrows instead of
   redrawing. Snapshots are complete pictures and are never mutated after they are pushed.

   State vocabulary used here (VDSA.STATES):
     active   the node a cursor (curr / prev / slow) sits on      visited  already walked past or reversed
     compare  value being compared, or the `next` / `fast` cursor key      the new node, still in your hand
     swap     (link colour) the pointer written in this step         error    node being deleted, or broken
     muted    unreachable: nothing points to it any more             found    search hit / cycle entry
     done     a node settled in its final place

   Cost model: a "hop" is one `p = p.next`; a "write" is one assignment to a next/prev/head/tail pointer of
   the list (allocating a node, whose next starts as null, is not counted); a "compare" is one value test.

   Contents
     mkList, chainIds, listValues                       model helpers
     opInsertHead, opInsertAt, opAppend,
     opDelete, opSearch, opGet, labSteps, validateOp    the operations lab (+ the delete flowchart ids)
     spliceOrderSteps                                   wrong order loses the tail / right order
     reverseSteps, teaserSteps                          in-place reversal (lab) and the hero loop
     middleSteps                                        fast & slow pointers: the middle node
     rhoNext, floydSteps, floydRef                      tortoise and hare on a rho-shaped list
     doublyInsertSteps, doublyDeleteSteps               doubly linked list surgery
     dummyDeleteSteps, circularSteps, copyDeleteSteps   variations
     raceSteps, costOf                                  array vs linked list, per operation
*/
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.VDSA = root.VDSA || {}; root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos.linkedLists = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var MAX_LAB = 8, MIN_V = -99, MAX_V = 99;

  /* ================================================================== model helpers */
  function mkList(values, prefix) {
    prefix = prefix || 'n';
    var L = { order: [], byId: {}, head: null, tail: null, doubly: false };
    for (var i = 0; i < values.length; i++) {
      var id = prefix + i;
      L.order.push(id);
      L.byId[id] = { id: id, value: values[i], next: null, prev: null };
    }
    for (i = 0; i + 1 < values.length; i++) {
      L.byId[L.order[i]].next = L.order[i + 1];
      L.byId[L.order[i + 1]].prev = L.order[i];
    }
    if (values.length) { L.head = L.order[0]; L.tail = L.order[values.length - 1]; }
    return L;
  }
  /* ids reachable from head, stopping at the first repeat (so a cycle is listed once). */
  function chainIds(L) {
    var out = [], seen = {}, c = L.head;
    while (c !== null && c !== undefined && L.byId[c] && !seen[c]) { seen[c] = true; out.push(c); c = L.byId[c].next; }
    return out;
  }
  function listValues(L) { return chainIds(L).map(function (id) { return L.byId[id].value; }); }
  function arrow(vals) { return vals.length ? vals.join(' → ') + ' → null' : 'null (empty list)'; }
  function val(L, id) { return id === null || id === undefined || !L.byId[id] ? null : L.byId[id].value; }
  function vis() { return { st: {}, ns: {}, ps: {}, det: {}, pos: {}, lab: {}, txt: {} }; }
  function copy(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }
  function removeNode(L, id) {
    delete L.byId[id];
    L.order = L.order.filter(function (x) { return x !== id; });
  }

  /* One list snapshot in VDSA.views.list format. */
  function snap(L, v, ptrs) {
    var nodes = [];
    L.order.forEach(function (id) {
      var n = L.byId[id];
      if (!n) return;
      var s = { id: id, value: n.value, next: n.next };
      if (L.doubly) s.prev = n.prev;
      if (v.st[id]) s.state = v.st[id];
      if (v.ns[id]) s.nextState = v.ns[id];
      if (L.doubly && v.ps[id]) s.prevState = v.ps[id];
      if (v.det[id]) s.detached = v.det[id];
      if (v.pos[id]) { s.x = v.pos[id].x; s.y = v.pos[id].y; }
      if (v.lab[id]) s.label = v.lab[id];
      if (v.txt[id] !== undefined) s.text = v.txt[id];
      nodes.push(s);
    });
    var pointers = (ptrs || []).filter(Boolean).map(copy);
    if (L.head === null && !pointers.some(function (p) { return p.name === 'head'; })) {
      pointers.unshift({ name: 'head', target: null, state: 'default', nullSide: 'left' });
    }
    return { nodes: nodes, head: L.head, pointers: pointers };
  }

  function counters(h, c, w) { return { hops: h, compares: c, writes: w }; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* ================================================================== operations lab */
  var NEW = 'x';

  /* Insert x at the front: 2 writes, 0 hops. */
  function opInsertHead(values, x) {
    var L = mkList(values), steps = [], w = 0, v = vis(), node = null;
    function P() { return node ? [{ name: 'node', target: node, state: 'key', side: 'below' }] : []; }
    function push(kind, cap, line, extra) {
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: counters(0, 0, w),
        vars: { x: x, head: val(L, L.head), 'node.next': node ? val(L, L.byId[node].next) : null } }, extra || {}));
    }
    push('start', 'Insert <b>' + x + '</b> at the front of ' + arrow(listValues(L)) + '. The head pointer is all you need: no walking.', null);
    L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
    L.order.unshift(NEW); node = NEW; v.det[NEW] = 'above'; v.st[NEW] = 'key';
    push('alloc', 'Allocate a node holding ' + x + '. Its next is null and nothing points to it yet, so the list itself has not changed.', 'alloc');
    var old = L.head;
    L.byId[NEW].next = old; w++; v.ns[NEW] = 'swap';
    push('link', old === null
      ? 'node.next ← head. head is null (the list is empty), so node.next stays null.'
      : 'node.next ← head: the new node now points at ' + val(L, old) + '. head still points at ' + val(L, old) + ' too, so nothing is lost.', 'link', { firstWrite: true });
    delete v.ns[NEW];
    L.head = NEW; w++;
    push('head', 'head ← node: the head chip moves to ' + x + '. That is the second and last pointer write.', 'head');
    delete v.det[NEW]; v.st[NEW] = 'done'; node = null;
    push('done', 'Done: ' + arrow(listValues(L)) + '. 2 pointer writes and 0 hops, whether the list holds 3 nodes or 3 million: <b>O(1)</b>.', null, { result: listValues(L) });
    return steps;
  }

  /* Insert x so that it ends up at index i (0 ≤ i ≤ n). */
  function opInsertAt(values, i, x) {
    var L = mkList(values), n = values.length, steps = [], h = 0, w = 0, v = vis();
    var prev = null, node = null, k = null;
    function P() {
      var p = [];
      if (prev !== null) p.push({ name: 'prev', target: prev, state: 'active' });
      if (node) p.push({ name: 'node', target: node, state: 'key', side: 'below' });
      return p;
    }
    function push(kind, cap, line, extra) {
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: counters(h, 0, w),
        vars: { x: x, i: i, k: k, prev: val(L, prev), 'node.next': node ? val(L, L.byId[node].next) : null } }, extra || {}));
    }
    push('start', 'Insert <b>' + x + '</b> so it becomes index ' + i + ' of ' + arrow(listValues(L)) + '.', null);
    L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
    L.order.splice(i, 0, NEW); node = NEW; v.det[NEW] = 'above'; v.st[NEW] = 'key';
    push('alloc', 'Allocate the new node first. It floats above the gap it will fill; nothing points to it yet.', 'alloc');
    if (i === 0) {
      push('check0', 'i is 0, so the new node becomes the head. There is no predecessor to find.', 'check0');
      var old = L.head;
      L.byId[NEW].next = old; w++; v.ns[NEW] = 'swap';
      push('link', old === null ? 'node.next ← head. The list is empty, so node.next stays null.'
        : 'node.next ← head: point the new node at ' + val(L, old) + ' first, so the whole list hangs off it.', 'link0', { firstWrite: true });
      delete v.ns[NEW];
      L.head = NEW; w++;
      push('head', 'head ← node. Two writes and the new node is the front of the list.', 'head');
    } else {
      push('check0', 'i = ' + i + ' is not 0, so the new node goes after the node at index ' + (i - 1) + '. Find that node, prev, first.', 'check0');
      prev = L.head; v.st[prev] = 'active'; k = 1;
      push('start', 'prev ← head: prev is at index 0.', 'start');
      for (; k < i; k++) {
        push('walk', 'k = ' + k + ' < i = ' + i + ': prev (index ' + (k - 1) + ') is not yet the node before the gap.', 'walk');
        v.st[prev] = 'visited';
        prev = L.byId[prev].next; v.st[prev] = 'active'; h++;
        push('hop', 'prev ← prev.next: one hop, to index ' + k + ' (' + val(L, prev) + ').', 'hop');
      }
      push('walk', 'k = ' + k + ' is not < ' + i + ': prev (' + val(L, prev) + ', index ' + (i - 1) + ') is the node the new one goes after.', 'walk');
      var succ = L.byId[prev].next;
      L.byId[NEW].next = succ; w++; v.ns[NEW] = 'swap';
      push('link', succ === null
        ? 'node.next ← prev.next. prev is the last node, so prev.next is null and the new node will be the new tail.'
        : 'node.next ← prev.next: copy the address of ' + val(L, succ) + ' into the new node <em>before</em> touching prev. Now two arrows point at ' + val(L, succ) + '.', 'link', { firstWrite: true });
      delete v.ns[NEW]; v.ns[prev] = 'swap';
      L.byId[prev].next = NEW; w++;
      push('splice', 'prev.next ← node: the arrow from ' + val(L, prev) + ' swings to ' + x + '. The old successor is still reachable through the new node.', 'splice');
      delete v.ns[prev];
    }
    Object.keys(v.st).forEach(function (id) { delete v.st[id]; });
    delete v.det[NEW]; v.st[NEW] = 'done'; prev = null; node = null;
    push('done', 'Inserted: ' + arrow(listValues(L)) + '. ' + plural(h, 'hop') + ' to find the spot, then ' + plural(w, 'pointer write') + '. The writes are O(1); the walk is O(i).', null, { result: listValues(L) });
    void n;
    return steps;
  }

  /* Append x at the end, walking from head (useTail = false) or through a tail pointer (useTail = true). */
  function opAppend(values, x, useTail) {
    var L = mkList(values), steps = [], h = 0, w = 0, v = vis();
    var curr = null, node = null;
    function P() {
      var p = [];
      if (useTail) p.push({ name: 'tail', target: L.tail, state: 'default', side: 'below' });
      if (curr !== null) p.push({ name: 'curr', target: curr, state: 'active' });
      if (node) p.push({ name: 'node', target: node, state: 'key', side: useTail ? 'above' : 'below' });
      return p;
    }
    function push(kind, cap, line, extra) {
      var vars = { x: x, head: val(L, L.head) };
      if (useTail) vars.tail = val(L, L.tail); else vars.curr = val(L, curr);
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: counters(h, 0, w), vars: vars }, extra || {}));
    }
    push('start', useTail
      ? 'Append <b>' + x + '</b> to ' + arrow(listValues(L)) + '. The list keeps a <b>tail</b> pointer to its last node, so there is nothing to walk.'
      : 'Append <b>' + x + '</b> to ' + arrow(listValues(L)) + ' with only a head pointer. The last node has to be found first.', null);
    L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
    L.order.push(NEW); node = NEW; v.det[NEW] = 'above'; v.st[NEW] = 'key';
    push('alloc', 'Allocate a node holding ' + x + '. Its next is null, which is right for a new last node.', 'alloc');
    if (L.head === null) {
      push('empty', 'head is null: the list is empty, so the new node is both the first and the last node.', 'empty');
      L.head = NEW; w++;
      push('head', 'head ← node.', 'head', { firstWrite: true });
      if (useTail) { L.tail = NEW; w++; push('tail', 'tail ← node. With one node, head and tail point at the same place.', 'tail'); }
    } else if (useTail) {
      push('empty', 'head is not null, so the new node goes after the current tail (' + val(L, L.tail) + ').', 'empty');
      var t = L.tail;
      L.byId[t].next = NEW; w++; v.ns[t] = 'swap';
      push('splice', 'tail.next ← node: the arrow from ' + val(L, t) + ' swings to ' + x + '. Do this before moving tail, while tail still names the old last node.', 'splice', { firstWrite: true });
      delete v.ns[t];
      L.tail = NEW; w++;
      push('tail', 'tail ← node: the tail chip slides to ' + x + '. Two writes, no hops: <b>O(1)</b>.', 'tail');
    } else {
      push('empty', 'head is not null, so walk to the last node: the one whose next is null.', 'empty');
      curr = L.head; v.st[curr] = 'active';
      push('start', 'curr ← head.', 'start');
      while (L.byId[curr].next !== null) {
        push('walk', 'curr.next is ' + val(L, L.byId[curr].next) + ', not null: ' + val(L, curr) + ' is not the last node.', 'walk');
        v.st[curr] = 'visited'; curr = L.byId[curr].next; v.st[curr] = 'active'; h++;
        push('hop', 'curr ← curr.next.', 'hop');
      }
      push('walk', 'curr.next is null: ' + val(L, curr) + ' is the last node.', 'walk');
      L.byId[curr].next = NEW; w++; v.ns[curr] = 'swap';
      push('splice', 'curr.next ← node: the null at the end becomes an arrow to ' + x + '.', 'splice', { firstWrite: true });
      delete v.ns[curr];
    }
    Object.keys(v.st).forEach(function (id) { delete v.st[id]; });
    delete v.det[NEW]; v.st[NEW] = 'done'; curr = null; node = null;
    push('done', 'Appended: ' + arrow(listValues(L)) + '. ' + plural(h, 'hop') + ' + ' + plural(w, 'write') + (useTail ? ': constant time.' : ': the walk makes it O(n). A tail pointer would make it O(1).'), null, { result: listValues(L) });
    return steps;
  }

  /* Delete the first node holding x. Flow ids match the delete flowchart. */
  function opDelete(values, x) {
    var L = mkList(values), steps = [], h = 0, c = 0, w = 0, v = vis();
    var prev = null, victim = null;
    function P() {
      var p = [];
      if (prev !== null) p.push({ name: 'prev', target: prev, state: 'active' });
      if (victim !== null) p.push({ name: 'victim', target: victim, state: 'error', side: 'below' });
      return p;
    }
    function push(kind, cap, line, flow, extra) {
      var pn = prev !== null && L.byId[prev] ? L.byId[prev].next : null;
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, flow: flow, counters: counters(h, c, w),
        vars: { x: x, head: val(L, L.head), prev: val(L, prev), 'prev.next': prev === null ? null : val(L, pn) } }, extra || {}));
    }
    push('start', 'Delete the first node holding <b>' + x + '</b> from ' + arrow(listValues(L)) + '.', null, 'start');
    push('empty', L.head === null ? 'head is null: the list is empty.' : 'head is not null, so there is at least one node to check.', 'empty', 'empty');
    if (L.head === null) {
      push('none', 'return false: an empty list cannot contain ' + x + '. Nothing changes.', 'none', 'none', { result: [], deleted: false });
      return steps;
    }
    var hd = L.head; c++; v.st[hd] = 'compare';
    push('checkHead', 'Compare the head’s value ' + val(L, hd) + ' with ' + x + '. The head is special: no node points to it, only the head pointer does.', 'checkHead', 'head');
    if (val(L, hd) === x) {
      victim = hd; v.st[hd] = 'error';
      L.head = L.byId[hd].next; w++;
      push('dropHead', 'Match, and it is the head. There is no prev.next to change, so move the head pointer instead: head ← head.next.', 'dropHead', 'dropHead');
      removeNode(L, hd); victim = null;
      push('release', 'return true. Nothing points to the old head any more, so it is unreachable and its memory is reclaimed. List: ' + arrow(listValues(L)) + '.', 'doneHead', 'dropHead', { result: listValues(L), deleted: true });
      return steps;
    }
    v.st[hd] = 'active'; prev = hd;
    push('init', val(L, hd) + ' ≠ ' + x + '. To delete a later node you must change its <em>predecessor’s</em> next, so walk with prev one node behind the candidate.', 'start', 'init');
    for (;;) {
      var pn = L.byId[prev].next;
      push('walk', pn === null ? 'prev.next is null: no candidates left.' : 'prev.next is ' + val(L, pn) + ', so there is a candidate to check.', 'walk', 'walk');
      if (pn === null) break;
      c++; v.st[pn] = 'compare';
      push('cmp', 'Compare prev.next.value ' + val(L, pn) + ' with ' + x + '.', 'cmp', 'cmp');
      if (val(L, pn) === x) {
        victim = pn; v.st[pn] = 'error';
        var after = L.byId[pn].next;
        L.byId[prev].next = after; w++; v.ns[prev] = 'swap';
        push('bypass', 'Match. One write: prev.next ← prev.next.next. The arrow from ' + val(L, prev) + ' swings over ' + x + ' and lands on ' + (after === null ? 'null' : val(L, after)) + '. Reading ' + x + '’s next before the write is what keeps your grip on the tail.', 'bypass', 'bypass');
        removeNode(L, pn); victim = null; delete v.ns[prev];
        push('release', 'return true. Nothing points to ' + x + ' now, so it is unreachable and reclaimed; the rest close the gap. List: ' + arrow(listValues(L)) + '.', 'done', 'bypass', { result: listValues(L), deleted: true });
        return steps;
      }
      v.st[prev] = 'visited'; prev = pn; v.st[prev] = 'active'; h++;
      push('hop', val(L, pn) + ' ≠ ' + x + '. prev ← prev.next: move one node along.', 'hop', 'hop');
    }
    push('absent', 'return false: ' + x + ' is not in the list. ' + plural(c, 'value') + ' checked, nothing changed.', 'absent', 'absent', { result: listValues(L), deleted: false });
    return steps;
  }

  /* Search for x: returns its index or −1. */
  function opSearch(values, x) {
    var L = mkList(values), steps = [], h = 0, c = 0, v = vis(), curr = null, i = null;
    function P() { return i === null ? [] : [{ name: 'curr', target: curr, state: 'active' }]; }
    function push(kind, cap, line, extra) {
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: counters(h, c, 0),
        vars: { x: x, curr: val(L, curr), i: i } }, extra || {}));
    }
    push('start', 'Search ' + arrow(listValues(L)) + ' for <b>' + x + '</b>. There is no index arithmetic: start at the head and follow next.', null);
    curr = L.head; i = 0;
    if (curr !== null) v.st[curr] = 'active';
    push('init', 'curr ← head, i ← 0.', 'start');
    for (;;) {
      push('walk', curr === null ? 'curr is null: you walked off the end.' : 'curr is not null, so there is a value to check.', 'walk');
      if (curr === null) break;
      c++; v.st[curr] = 'compare';
      push('cmp', 'Is curr.value ' + val(L, curr) + ' equal to ' + x + '?', 'cmp');
      if (val(L, curr) === x) {
        v.st[curr] = 'found';
        push('found', 'Yes: return ' + i + '. It took ' + plural(h, 'hop') + ' to get here, one per node before it.', 'found', { result: i });
        return steps;
      }
      v.st[curr] = 'visited'; curr = L.byId[curr].next; i++; h++;
      if (curr !== null) v.st[curr] = 'active';
      push('hop', 'No. curr ← curr.next, i ← ' + i + '.', 'hop');
    }
    push('absent', 'return −1: ' + x + ' is not in the list. Every node was visited: ' + plural(c, 'comparison') + '.', 'absent', { result: -1 });
    return steps;
  }

  /* Reach index i by walking (the traversal figure). */
  function opGet(values, i) {
    var L = mkList(values), steps = [], h = 0, v = vis(), curr = L.head, k = 0;
    function P() { return [{ name: 'curr', target: curr, state: 'active' }]; }
    function push(kind, cap, extra) { steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: null, counters: { hops: h } }, extra || {})); }
    if (curr !== null) v.st[curr] = 'active';
    push('start', 'Read index ' + i + '. The only address you know is the head’s, so curr starts there, at index 0.');
    while (k < i && curr !== null) {
      v.st[curr] = 'visited'; curr = L.byId[curr].next; k++; h++;
      if (curr !== null) v.st[curr] = 'active';
      push('hop', 'curr ← curr.next: the address of index ' + k + ' was stored inside index ' + (k - 1) + '. ' + plural(h, 'hop') + ' so far.');
    }
    if (curr !== null) v.st[curr] = 'found';
    push('done', curr === null ? 'Index ' + i + ' does not exist: you fell off the end.'
      : 'Index ' + i + ' holds <b>' + val(L, curr) + '</b>, after ' + plural(h, 'hop') + '. Reaching index i always costs i hops: O(i), O(n) in the worst case.', { result: val(L, curr) });
    return steps;
  }

  /* Friendly validation for the lab. Returns an error string or null. */
  function validateOp(op, values, args) {
    args = args || {};
    if (!Array.isArray(values)) return 'The list must be a list of numbers.';
    if (values.length > MAX_LAB) return 'Use at most ' + MAX_LAB + ' values so every node stays readable.';
    var inserting = op === 'insertHead' || op === 'insertAt' || op === 'appendWalk' || op === 'appendTail';
    if (inserting && values.length >= MAX_LAB) return 'The list is full for this lab (' + MAX_LAB + ' nodes). Delete a value or use a shorter list.';
    var x = args.x;
    if (typeof x !== 'number' || !isFinite(x) || Math.floor(x) !== x) return 'The value must be a whole number.';
    if (x < MIN_V || x > MAX_V) return 'Keep the value between ' + MIN_V + ' and ' + MAX_V + '.';
    if (op === 'insertAt') {
      var i = args.i;
      if (typeof i !== 'number' || Math.floor(i) !== i) return 'The index must be a whole number.';
      if (i < 0 || i > values.length) return 'The index must be between 0 and ' + values.length + ' (the length of the list).';
    }
    return null;
  }

  function labSteps(op, values, args) {
    args = args || {};
    switch (op) {
      case 'insertHead': return opInsertHead(values, args.x);
      case 'insertAt': return opInsertAt(values, args.i, args.x);
      case 'appendWalk': return opAppend(values, args.x, false);
      case 'appendTail': return opAppend(values, args.x, true);
      case 'delete': return opDelete(values, args.x);
      case 'search': return opSearch(values, args.x);
      default: throw new Error('unknown op ' + op);
    }
  }

  /* ================================================================== wrong order loses the tail */
  /* values: the list; i: index the new node should take (1..n-1, so there is a prev and a successor). */
  function spliceOrderSteps(values, i, x, order) {
    var L = mkList(values), steps = [], w = 0, v = vis();
    var prev = L.order[i - 1], node = NEW;
    L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
    L.order.splice(i, 0, NEW); v.det[NEW] = 'above'; v.st[NEW] = 'key'; v.st[prev] = 'active';
    var originals = values.map(function (_, j) { return 'n' + j; });
    function reach() { return chainIds(L).length; }
    function lost() { var ch = chainIds(L); return originals.filter(function (id) { return ch.indexOf(id) === -1; }).length; }
    var nodeSide = 'above';
    function P() { return [{ name: 'prev', target: prev, state: 'active' }, { name: 'node', target: node, state: 'key', side: nodeSide }]; }
    function push(kind, cap, line, extra) {
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: { writes: w, reachable: reach(), lost: lost() } }, extra || {}));
    }
    var succ = L.byId[prev].next;
    var lostIds = [];
    for (var c = succ; c !== null; c = L.byId[c].next) lostIds.push(c);
    var lostVals = lostIds.map(function (id) { return val(L, id); });
    // the new node is not reachable yet: count it as "not in the list" rather than lost
    push('setup', 'You hold <b>prev</b> (' + val(L, prev) + ') and a new node <b>node</b> (' + x + '). Two writes will splice it in: <code>node.next ← prev.next</code> and <code>prev.next ← node</code>.' + (order === 'wrong' ? ' Try them in the wrong order.' : ''), null);
    if (order === 'wrong') {
      L.byId[prev].next = NEW; w++; v.ns[prev] = 'swap';
      push('wrong1', 'Wrong order: <code>prev.next ← node</code> first. The arrow from ' + val(L, prev) + ' swings to ' + x + ', and it was the <em>only</em> pointer to ' + val(L, succ) + '.', 'splice');
      delete v.ns[prev]; delete v.det[NEW]; nodeSide = 'below';
      lostIds.forEach(function (id, j) { v.st[id] = 'muted'; v.pos[id] = { x: i + 1 + j * 1.08 + 0.35, y: 1 + j * 0.28 }; v.lab[id] = 'lost'; });
      push('lost', lostVals.join(' → ') + ' → null ' + (lostIds.length === 1 ? 'is' : 'are') + ' now unreachable: no variable and no reachable node holds ' + (lostIds.length === 1 ? 'its' : 'their') + ' address. The tail floats away: leaked memory in C, garbage in Java, JavaScript or Python.', null, { lostIds: lostIds.slice() });
      L.byId[NEW].next = L.byId[prev].next; w++; v.ns[NEW] = 'error'; v.st[NEW] = 'error';
      push('wrong2', 'Now <code>node.next ← prev.next</code> copies the address in prev.next, which is the new node itself. ' + x + ' points at ' + x + ': a walk from head loops forever, and the tail is still gone.', 'link');
      push('broken', 'Broken: the list reads ' + listValues(L).join(' → ') + ' → ' + x + ' → ' + x + ' … forever, and ' + lostVals.join(', ') + ' are lost. The fix: copy the old address into node.next <em>before</em> you overwrite prev.next.', null, { result: null });
    } else {
      L.byId[NEW].next = succ; w++; v.ns[NEW] = 'swap';
      push('right1', 'Copy first: <code>node.next ← prev.next</code>. Now two arrows point at ' + val(L, succ) + ', so the tail has two grips.', 'link');
      delete v.ns[NEW]; v.ns[prev] = 'swap';
      L.byId[prev].next = NEW; w++;
      push('right2', 'Then redirect: <code>prev.next ← node</code>. The arrow from ' + val(L, prev) + ' swings to ' + x + '; ' + val(L, succ) + ' is still reachable through the new node.', 'splice');
      delete v.ns[prev]; delete v.det[NEW]; v.st[NEW] = 'done'; delete v.st[prev];
      push('joined', 'Spliced in: ' + arrow(listValues(L)) + '. Two writes, in the right order, O(1) once you hold prev. Nothing was lost.', null, { result: listValues(L) });
    }
    return steps;
  }

  /* ================================================================== reversal */
  function reverseSteps(values) {
    var L = mkList(values), steps = [], loops = 0, w = 0, v = vis();
    var prev = null, curr = L.head, nxt = null, flipped = {}, showNext = false;
    function paint(flipId) {
      v.st = {}; v.ns = {};
      L.order.forEach(function (id) { if (id === curr) v.st[id] = 'active'; else if (flipped[id]) v.st[id] = 'visited'; });
      if (flipId) v.ns[flipId] = 'swap';
    }
    function P() {
      var p = [{ name: 'prev', target: prev, state: 'visited', nullSide: 'left' }, { name: 'curr', target: curr, state: 'active' }];
      if (showNext) p.push({ name: 'next', target: nxt, state: 'compare' });
      return p;
    }
    function push(kind, cap, line, flipId, extra) {
      paint(flipId);
      steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: line, counters: { loops: loops, writes: w },
        vars: { prev: val(L, prev), curr: val(L, curr), next: showNext ? val(L, nxt) : null } }, extra || {}));
    }
    push('init', 'prev ← null, curr ← head. prev will lead the reversed part (empty so far); curr is the first node still pointing forward.', 'init');
    while (true) {
      push('loop', curr === null ? 'curr is null: every link has been flipped.' : 'curr (' + val(L, curr) + ') is not null, so there is a link left to flip.', 'loop');
      if (curr === null) break;
      nxt = L.byId[curr].next; showNext = true;
      push('save', 'next ← curr.next (' + (nxt === null ? 'null' : val(L, nxt)) + '). The flip is about to overwrite curr.next, and next is then the only grip on the rest of the list.', 'save');
      L.byId[curr].next = prev; w++; flipped[curr] = true;
      push('flip', 'Flip: curr.next ← prev. ' + val(L, curr) + ' now points back to ' + (prev === null ? 'null (it will be the last node)' : val(L, prev)) + '. The rest of the list is still reachable through next.', 'flip', curr);
      prev = curr;
      push('advPrev', 'prev ← curr: the reversed part now starts at ' + val(L, prev) + '.', 'advPrev');
      curr = nxt; loops++;
      push('advCurr', 'curr ← next: move to ' + (curr === null ? 'null' : val(L, curr)) + ', the first node not yet flipped.', 'advCurr');
    }
    L.head = prev; w++; showNext = false;
    var done = {};
    L.order.forEach(function (id) { done[id] = 'done'; });
    steps.push(Object.assign(snap(L, { st: done, ns: {}, ps: {}, det: {}, pos: {}, lab: {}, txt: {} }, P()), {
      kind: 'head', line: 'head', counters: { loops: loops, writes: w }, vars: { prev: val(L, prev), curr: null, next: null },
      caption: prev === null ? 'head ← prev, which is null: an empty list reversed is still empty.'
        : 'head ← prev: ' + val(L, prev) + ', the old tail, is the new head. ' + arrow(listValues(L)) + ', using O(1) extra space and ' + plural(w, 'pointer write') + '.',
      result: listValues(L)
    }));
    return steps;
  }

  /* Hero loop: reverse (one iteration per step), re-lay the nodes in reading order, reverse back. */
  function teaserSteps(values) {
    var L = mkList(values), steps = [];
    function push(ptrs, st, ns, note, flips) {
      var v = vis(); v.st = st || {}; v.ns = ns || {};
      steps.push(Object.assign(snap(L, v, ptrs), { order: L.order.slice(), note: note, flips: flips || 0 }));
    }
    function pass() {
      var prev = null, curr = L.head, flips = 0, flipped = {};
      function st() { var s = {}; L.order.forEach(function (id) { if (id === curr) s[id] = 'active'; else if (flipped[id]) s[id] = 'visited'; }); return s; }
      function P() { return [{ name: 'prev', target: prev, state: 'visited', nullSide: 'left' }, { name: 'curr', target: curr, state: 'active' }]; }
      push(P(), st(), {}, 'prev = null, curr = head', 0);
      while (curr !== null) {
        var nxt = L.byId[curr].next;
        L.byId[curr].next = prev; flipped[curr] = true; flips++;
        var ns = {}; ns[curr] = 'swap';
        prev = curr; curr = nxt;
        push(P(), st(), ns, 'curr.next = prev   (' + flips + ' of ' + L.order.length + ' flipped)', flips);
      }
      L.head = prev;
      var all = {}; L.order.forEach(function (id) { all[id] = 'done'; });
      push([], all, {}, 'head = prev: reversed', flips);
      L.order = chainIds(L);
      push([], {}, {}, arrow(listValues(L)), 0);
    }
    push([], {}, {}, arrow(listValues(L)), 0);
    pass(); pass();
    return steps;
  }

  /* ================================================================== fast & slow: middle node */
  function middleSteps(values) {
    var L = mkList(values), steps = [], moves = 0, v = vis();
    var slow = L.head, fast = L.head;
    function P() { return [{ name: 'slow', target: slow, state: 'active' }, { name: 'fast', target: fast, state: 'compare', side: 'below' }]; }
    function paint(final) {
      v.st = {};
      L.order.forEach(function (id) { if (id === slow) v.st[id] = final ? 'found' : 'active'; else if (id === fast) v.st[id] = 'compare'; });
    }
    function push(kind, cap, extra) { paint(kind === 'done'); steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: null, counters: { moves: moves } }, extra || {})); }
    var n = values.length;
    if (!n) { push('done', 'An empty list has no middle.', { result: null }); return steps; }
    push('start', 'slow and fast both start at the head. Each turn slow takes 1 step and fast takes 2.');
    while (fast !== null && L.byId[fast].next !== null) {
      slow = L.byId[slow].next; fast = L.byId[L.byId[fast].next].next; moves++;
      push('move', 'Turn ' + moves + ': slow has walked ' + moves + ', fast ' + (2 * moves) + '. fast is always twice as far along.');
    }
    var idx = L.order.indexOf(slow);
    push('done', (fast === null ? 'fast fell off the end (even length, ' + n + ' nodes)' : 'fast is on the last node (odd length, ' + n + ' nodes)') +
      ', so slow has walked half the way: index ' + idx + ', value <b>' + val(L, slow) + '</b>.' + (n % 2 === 0 ? ' With an even length this is the second of the two middle nodes.' : ''), { result: idx });
    return steps;
  }

  /* ================================================================== Floyd: tortoise and hare */
  /* next[] for a rho: a tail of mu nodes (0 .. mu-1) then a loop of lambda nodes (mu .. mu+lambda-1)
     whose last node points back to node mu. lambda = 0 means no cycle: the last node points to null. */
  function rhoNext(mu, lambda) {
    var N = mu + lambda, nx = [];
    for (var k = 0; k < N; k++) nx.push(k + 1 < N ? k + 1 : (lambda > 0 ? mu : null));
    return nx;
  }
  function floydSteps(mu, lambda) {
    var nx = rhoNext(mu, lambda), N = nx.length, steps = [];
    var slow = N ? 0 : null, fast = N ? 0 : null, sS = 0, fS = 0, meet = null, entry = null, phase = 1, moves2 = 0, trail = [];
    function inLoop(k) { return lambda > 0 && k !== null && k >= mu; }
    function gap() {
      if (phase !== 1 || !inLoop(slow) || !inLoop(fast)) return null;
      return (((slow - mu) - (fast - mu)) % lambda + lambda) % lambda;
    }
    function push(kind, cap, extra) {
      var g = kind === 'start' ? null : gap();   // nobody compares before the first move
      steps.push(Object.assign({ kind: kind, phase: phase, mu: mu, lambda: lambda, n: N, next: nx, slow: slow, fast: fast, meet: meet, entry: entry,
        sPath: null, fPath: null, gap: g, trail: trail.slice(), caption: cap,
        counters: { slow: sS, fast: fS, gap: g === null ? '–' : g } }, extra || {}));
    }
    if (!N) { push('nocycle', 'An empty list: head is null, so there is nothing to loop.'); return steps; }
    push('start', 'Both start at the head, node 0. Each turn the tortoise takes 1 step and the hare takes 2.');
    for (;;) {
      if (fast === null || nx[fast] === null) {
        push('nocycle', 'The hare ' + (fast === null ? 'ran off the end' : 'is on the last node, whose next is null') + '. A list with an end has no cycle: stop.');
        break;
      }
      var s0 = slow, f0 = fast, f1 = nx[fast];
      slow = nx[slow]; fast = nx[f1]; sS++; fS += 2;
      if (fast !== null && slow === fast) {
        meet = slow;
        push('meet', 'They meet at node ' + meet + '. On the loop the hare gains exactly 1 step per turn, so a gap of 1 became 0: it could not jump over. A meeting proves there is a cycle.', { sPath: [s0, slow], fPath: [f0, f1, fast] });
        break;
      }
      var g = gap(), cap;
      if (fast === null) cap = 'Tortoise 1 step, hare 2. The hare stepped past the last node onto null.';
      else if (g !== null) cap = 'Tortoise 1 step, hare 2. Both are on the loop: the hare is ' + plural(g, 'step') + ' behind, and each turn closes that gap by exactly one.';
      else if (inLoop(fast)) cap = 'Tortoise 1 step, hare 2. The hare is already circling the loop; the tortoise is still on the tail.';
      else cap = 'Tortoise 1 step, hare 2. The hare is pulling ahead.';
      push('move', cap, { sPath: [s0, slow], fPath: [f0, f1, fast] });
    }
    if (meet === null) return steps;
    phase = 2;
    var from = slow; slow = 0;
    push('reset', 'Phase 2: send the tortoise back to the head; the hare waits at the meeting point. Now both take 1 step per turn.', { sPath: 'jump', jumpFrom: from });
    if (slow === fast) {
      entry = slow;
      push('entry', 'They are already together: the head itself is where the loop begins (μ = 0).', { result: entry });
      return steps;
    }
    while (slow !== fast) {
      var a = slow, b = fast;
      slow = nx[slow]; fast = nx[fast]; sS++; fS++; moves2++;
      trail.push(a + '>' + slow); trail.push(b + '>' + fast);
      if (slow === fast) {
        entry = slow;
        push('entry', 'Both land on node ' + entry + ' after ' + plural(moves2, 'step') + ': that is where the loop begins (μ = ' + mu + '). At the meeting the tortoise had walked μ + k steps and the hare twice that; the extra μ + k is a whole number of laps, so μ more steps from the meeting point also end at the entry.', { sPath: [a, slow], fPath: [b, fast], result: entry });
      } else {
        push('move2', 'Both take 1 step (' + moves2 + ' so far). They are walking the same distance to the same node.', { sPath: [a, slow], fPath: [b, fast] });
      }
    }
    return steps;
  }
  /* Reference: the cycle entry by remembering visited nodes, and the first meeting by brute force. */
  function floydRef(mu, lambda) {
    var nx = rhoNext(mu, lambda), seen = {}, c = nx.length ? 0 : null, entry = null;
    while (c !== null) { if (seen[c]) { entry = c; break; } seen[c] = true; c = nx[c]; }
    var meet = null, t = null;
    if (entry !== null) {
      var s = 0, f = 0;
      for (t = 1; t < 10000; t++) { s = nx[s]; f = nx[nx[f]]; if (s === f) { meet = s; break; } }
    }
    return { entry: entry, meet: meet, slowSteps: t };
  }

  /* ================================================================== doubly linked lists */
  function mkDoubly(values) { var L = mkList(values, 'd'); L.doubly = true; return L; }
  function doublyInsertSteps(values, afterIdx, x) {
    var L = mkDoubly(values), steps = [], w = 0, v = vis();
    var curr = L.order[afterIdx], succ = L.byId[curr].next, node = NEW;
    function P() { return [{ name: 'curr', target: curr, state: 'active' }, { name: 'node', target: node, state: 'key', side: 'below' }]; }
    function push(kind, cap, extra) { steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: null, counters: { writes: w } }, extra || {})); }
    v.st[curr] = 'active';
    L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
    L.order.splice(afterIdx + 1, 0, NEW); v.det[NEW] = 'below'; v.st[NEW] = 'key';
    push('alloc', 'Insert ' + x + ' after ' + val(L, curr) + '. Every node has two pointers now: <b>next</b> (arrows above the centre) and <b>prev</b> (arrows below).');
    L.byId[NEW].prev = curr; w++; v.ps[NEW] = 'swap';
    push('w1', 'node.prev ← curr: the new node points back at ' + val(L, curr) + '. Wiring the new node first is always safe: nothing in the list has changed yet.');
    delete v.ps[NEW]; L.byId[NEW].next = succ; w++; v.ns[NEW] = 'swap';
    push('w2', 'node.next ← curr.next: and forward at ' + (succ === null ? 'null' : val(L, succ)) + '.');
    delete v.ns[NEW];
    if (succ !== null) {
      L.byId[succ].prev = NEW; w++; v.ps[succ] = 'swap';
      push('w3', 'curr.next.prev ← node: ' + val(L, succ) + '’s back pointer now names ' + x + '. Do this while curr.next still reaches ' + val(L, succ) + '.');
      delete v.ps[succ];
    } else {
      L.tail = NEW;
      push('w3', 'curr.next is null: there is no successor whose prev needs fixing (update a tail pointer here if the list keeps one).');
    }
    L.byId[curr].next = NEW; w++; v.ns[curr] = 'swap';
    push('w4', 'curr.next ← node: last, because it was your route to ' + (succ === null ? 'the end' : val(L, succ)) + '.');
    delete v.ns[curr]; delete v.det[NEW]; v.st[NEW] = 'done'; delete v.st[curr];
    push('done', 'Linked in both directions with ' + plural(w, 'write') + ': ' + arrow(listValues(L)) + '. Walk it forwards or backwards.', { result: listValues(L) });
    return steps;
  }
  function doublyDeleteSteps(values, idx) {
    var L = mkDoubly(values), steps = [], w = 0, v = vis();
    var victim = L.order[idx], p = L.byId[victim].prev, s = L.byId[victim].next;
    function P() { return victim ? [{ name: 'victim', target: victim, state: 'error', side: 'below' }] : []; }
    function push(kind, cap, extra) { steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: null, counters: { writes: w } }, extra || {})); }
    v.st[victim] = 'error';
    push('start', 'Delete ' + val(L, victim) + ', given only a pointer to it. Its prev pointer names its predecessor, so there is nothing to walk.');
    if (p !== null) { L.byId[p].next = s; v.ns[p] = 'swap'; } else L.head = s;
    w++;
    push('w1', p !== null ? 'victim.prev.next ← victim.next: ' + val(L, p) + ' now skips forward to ' + (s === null ? 'null' : val(L, s)) + '.'
      : 'The victim is the head: head ← victim.next.');
    if (p !== null) delete v.ns[p];
    if (s !== null) { L.byId[s].prev = p; v.ps[s] = 'swap'; w++; }
    push('w2', s !== null ? 'victim.next.prev ← victim.prev: ' + val(L, s) + ' now points back to ' + (p === null ? 'null' : val(L, p)) + '.'
      : 'The victim is the tail, so no successor needs a new prev (a tail pointer would move to ' + val(L, p) + ').');
    if (s !== null) delete v.ps[s];
    var gone = val(L, victim);
    removeNode(L, victim); victim = null;
    push('done', gone + ' is unreachable in both directions and is reclaimed. ' + plural(w, 'write') + ', no walk: O(1). A singly linked list would need an O(n) walk to find the predecessor.', { result: listValues(L) });
    return steps;
  }

  /* ================================================================== variations */
  /* Delete x using a dummy (sentinel) node in front of the real first node: no special case for the head. */
  function dummyDeleteSteps(values, x) {
    var L = mkList(values), steps = [], c = 0, w = 0, v = vis();
    var D = 'dummy';
    L.byId[D] = { id: D, value: null, next: L.head, prev: null };
    L.order.unshift(D); L.head = D; v.txt[D] = 'D'; v.lab[D] = 'dummy'; v.st[D] = 'muted';
    var prev = D, victim = null;
    function P() { var p = [{ name: 'prev', target: prev, state: 'active' }]; if (victim) p.push({ name: 'victim', target: victim, state: 'error', side: 'below' }); return p; }
    function push(kind, cap, extra) { steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, line: null, counters: { compares: c, writes: w } }, extra || {})); }
    function real() { return listValues(L).slice(1); }
    push('start', 'A dummy node sits in front of the first real node and is never deleted. prev starts at the dummy, so even the first real node has a predecessor.');
    for (;;) {
      var pn = L.byId[prev].next;
      if (pn === null) break;
      c++; v.st[pn] = 'compare';
      push('cmp', 'Compare prev.next.value ' + val(L, pn) + ' with ' + x + '.');
      if (val(L, pn) === x) {
        victim = pn; v.st[pn] = 'error';
        L.byId[prev].next = L.byId[pn].next; w++; v.ns[prev] = 'swap';
        push('bypass', 'Match: prev.next ← prev.next.next. ' + (prev === D ? 'This is the first real node, and it was deleted by the same line as any other node: no special case.' : 'The same line as always.'));
        removeNode(L, pn); victim = null; delete v.ns[prev];
        push('done', 'Deleted. The real list is dummy.next: ' + arrow(real()) + '.', { result: real() });
        return steps;
      }
      v.st[pn] = 'default';
      if (prev !== D) v.st[prev] = 'visited';
      prev = pn; v.st[prev] = 'active';
      push('hop', 'No match: prev ← prev.next.');
    }
    push('done', x + ' is not in the list; nothing changes.', { result: real() });
    return steps;
  }

  /* Walk a circular list once: do { visit } while (curr != head). */
  function circularSteps(values) {
    var L = mkList(values, 'c'), steps = [], v = vis(), visits = 0;
    if (!values.length) return [Object.assign(snap(L, v, []), { kind: 'done', caption: 'An empty circular list: head is null.', counters: { visits: 0 } })];
    L.byId[L.tail].next = L.head;
    var curr = L.head, seen = {};
    function push(kind, cap) {
      v.st = {};
      L.order.forEach(function (id) { if (id === curr) v.st[id] = 'active'; else if (seen[id]) v.st[id] = 'visited'; });
      steps.push(Object.assign(snap(L, v, [{ name: 'curr', target: curr, state: 'active' }]), { kind: kind, caption: cap, counters: { visits: visits } }));
    }
    push('start', 'The tail points back to the head, so there is no null to stop at. Start at head and stop when you come back to it.');
    do {
      seen[curr] = true; visits++;
      var nx = L.byId[curr].next;
      if (nx === L.head) { curr = nx; v.ns = {}; v.ns[L.tail] = 'active'; push('back', 'curr.next is head again: every node was visited exactly once (' + visits + '). Stop, or keep going round for a round-robin schedule.'); v.ns = {}; break; }
      curr = nx;
      push('visit', 'Visited ' + visits + '. curr ← curr.next.');
    } while (curr !== L.head);
    return steps;
  }

  /* The copy trick: delete the node you hold (not the tail) by copying its successor into it. */
  function copyDeleteSteps(values, idx) {
    var L = mkList(values), steps = [], w = 0, v = vis();
    var p = L.order[idx], q = L.byId[p].next;
    function P() { return [{ name: 'p', target: p, state: 'active' }]; }
    function push(kind, cap, extra) { steps.push(Object.assign(snap(L, v, P()), { kind: kind, caption: cap, counters: { writes: w } }, extra || {})); }
    v.st[p] = 'active';
    push('start', 'You hold p (' + val(L, p) + ') and want it gone, but you have no pointer to its predecessor.');
    if (q === null) { v.st[p] = 'error'; push('fail', 'p is the tail: there is no successor to copy. The trick fails; you must walk from head.'); return steps; }
    var old = val(L, p);
    L.byId[p].value = val(L, q); v.st[q] = 'error'; v.st[p] = 'swap';
    push('copy', 'Copy the successor’s value into p: p now reads ' + val(L, q) + '. The value ' + old + ' is gone from the list.');
    L.byId[p].next = L.byId[q].next; w++; v.ns[p] = 'swap';
    push('bypass', 'p.next ← p.next.next: splice out the successor, which now holds a duplicate.');
    removeNode(L, q); delete v.ns[p]; v.st[p] = 'done';
    push('done', 'Deleted ' + old + ' in O(1): ' + arrow(listValues(L)) + '. Catch: any pointer someone held to the old successor now dangles.', { result: listValues(L) });
    return steps;
  }

  /* ================================================================== array vs linked list */
  function arrState(items, cap, extra) {
    return Object.assign({ items: items.map(copy), length: cap }, extra || {});
  }
  /* Build per-side sequences, then zip them into race steps. */
  function raceSteps(op, values, x, k) {
    var n = values.length;
    var A = [], B = [], aOps = [], bOps = [], aCap = [], bCap = [];
    var cap = n + 1;
    var items = values.map(function (vv, i) { return { id: 'a' + i, value: vv, index: i }; });
    function aPush(its, ops, caption, extra) { A.push(arrState(its, cap, extra)); aOps.push(ops); aCap.push(caption); }
    var L = mkList(values, 'l'), v = vis();
    function bPush(ptrs, ops, caption) { B.push(snap(L, v, ptrs)); bOps.push(ops); bCap.push(caption); }
    aPush(items, 0, ''); bPush([], 0, '');
    var intro = '', m, j, curr, hops;
    if (op === 'access') {
      k = k === undefined ? n - 2 : k;
      intro = 'Read index ' + k + '.';
      var hit = items.map(function (it, i) { return i === k ? Object.assign({}, it, { state: 'found' }) : it; });
      aPush(hit, 1, 'address = base + ' + k + ' × size: one jump', { pointers: [{ name: 'i', index: k, state: 'active' }] });
      curr = L.head; v.st[curr] = 'active';
      bPush([{ name: 'curr', target: curr, state: 'active' }], 0, 'curr ← head');
      for (j = 0; j < k; j++) { v.st[curr] = 'visited'; curr = L.byId[curr].next; v.st[curr] = 'active'; bPush([{ name: 'curr', target: curr, state: 'active' }], j + 1, 'hop ' + (j + 1)); }
      v.st[curr] = 'found'; B[B.length - 1] = snap(L, v, [{ name: 'curr', target: curr, state: 'active' }]);
    } else if (op === 'insertFront' || op === 'insertMiddle') {
      m = op === 'insertFront' ? 0 : Math.floor(n / 2);
      intro = op === 'insertFront' ? 'Insert ' + x + ' at the front.' : 'Insert ' + x + ' at index ' + m + '.';
      var cur = items.map(copy), ops = 0;
      for (j = n - 1; j >= m; j--) {
        cur = cur.map(function (it) { return it.id === 'a' + j ? Object.assign({}, it, { index: j + 1, state: 'swap' }) : Object.assign({}, it, { state: it.state === 'swap' ? 'visited' : it.state }); });
        ops++;
        aPush(cur, ops, 'shift ' + values[j] + ' right');
      }
      cur = cur.map(function (it) { return Object.assign({}, it, { state: undefined }); });
      cur.push({ id: 'ax', value: x, index: m, state: 'done' });
      ops++;
      aPush(cur, ops, 'write ' + x + ' into the hole');
      // list side
      hops = 0; var bw = 0, prev = null;
      L.byId[NEW] = { id: NEW, value: x, next: null, prev: null };
      if (m > 0) {
        prev = L.head; v.st[prev] = 'active';
        bPush([{ name: 'prev', target: prev, state: 'active' }], 0, 'prev ← head');
        for (j = 1; j < m; j++) { v.st[prev] = 'visited'; prev = L.byId[prev].next; v.st[prev] = 'active'; hops++; bPush([{ name: 'prev', target: prev, state: 'active' }], hops, 'hop ' + hops); }
      }
      L.order.splice(m, 0, NEW); v.det[NEW] = 'above'; v.st[NEW] = 'key';
      L.byId[NEW].next = m === 0 ? L.head : L.byId[prev].next; bw++; v.ns[NEW] = 'swap';
      var pp = prev === null ? [] : [{ name: 'prev', target: prev, state: 'active' }];
      bPush(pp, hops + bw, 'node.next ← ' + (m === 0 ? 'head' : 'prev.next'));
      delete v.ns[NEW];
      if (m === 0) L.head = NEW; else { L.byId[prev].next = NEW; v.ns[prev] = 'swap'; }
      bw++;
      delete v.det[NEW]; v.st[NEW] = 'done';
      bPush(pp, hops + bw, m === 0 ? 'head ← node' : 'prev.next ← node');
      if (prev !== null) delete v.ns[prev];
    } else if (op === 'append') {
      intro = 'Append ' + x + '.';
      var ap = items.concat([{ id: 'ax', value: x, index: n, state: 'done' }]);
      aPush(ap, 1, 'write into the next free slot (spare capacity)');
      curr = L.head; v.st[curr] = 'active'; hops = 0;
      bPush([{ name: 'curr', target: curr, state: 'active' }], 0, 'curr ← head');
      while (L.byId[curr].next !== null) { v.st[curr] = 'visited'; curr = L.byId[curr].next; v.st[curr] = 'active'; hops++; bPush([{ name: 'curr', target: curr, state: 'active' }], hops, 'hop ' + hops); }
      L.byId[NEW] = { id: NEW, value: x, next: null, prev: null }; L.order.push(NEW);
      L.byId[curr].next = NEW; v.ns[curr] = 'swap'; v.st[NEW] = 'done';
      bPush([{ name: 'curr', target: curr, state: 'active' }], hops + 1, 'curr.next ← node');
      delete v.ns[curr];
    } else if (op === 'deleteLast') {
      intro = 'Delete the last item.';
      var dl = items.slice(0, n - 1);
      aPush(dl, 1, 'length ← length − 1: forget the last slot');
      curr = L.head; v.st[curr] = 'active'; hops = 0;
      bPush([{ name: 'prev', target: curr, state: 'active' }], 0, 'prev ← head');
      while (L.byId[L.byId[curr].next].next !== null) { v.st[curr] = 'visited'; curr = L.byId[curr].next; v.st[curr] = 'active'; hops++; bPush([{ name: 'prev', target: curr, state: 'active' }], hops, 'hop ' + hops); }
      var last = L.byId[curr].next;
      L.byId[curr].next = null; removeNode(L, last); v.ns[curr] = 'swap';
      bPush([{ name: 'prev', target: curr, state: 'active' }], hops + 1, 'prev.next ← null');
      delete v.ns[curr];
    } else throw new Error('unknown race op ' + op);
    var T = Math.max(A.length, B.length), steps = [];
    for (var t = 0; t < T; t++) {
      var ai = Math.min(t, A.length - 1), bi = Math.min(t, B.length - 1);
      var aDone = t >= A.length - 1, bDone = t >= B.length - 1;
      var parts = [];
      if (t === 0) parts.push(intro + ' Both sides start together; one frame = one basic operation.');
      else {
        if (t <= A.length - 1) parts.push('<b>Array:</b> ' + aCap[ai] + '.');
        else if (t === A.length) parts.push('<b>Array</b> finished in ' + plural(aOps[A.length - 1], 'step') + '.');
        if (t <= B.length - 1) parts.push('<b>List:</b> ' + bCap[bi] + '.');
        else if (t === B.length) parts.push('<b>List</b> finished in ' + plural(bOps[B.length - 1], 'step') + '.');
      }
      if (t === T - 1) parts = ['Array: <b>' + plural(aOps[A.length - 1], 'step') + '</b>. Linked list: <b>' + plural(bOps[B.length - 1], 'step') + '</b>.'];
      steps.push({ array: A[ai], list: B[bi], caption: parts.join(' '), counters: { array: aOps[ai], list: bOps[bi] }, arrayDone: aDone && t > 0, listDone: bDone && t > 0 });
    }
    steps.totals = { array: aOps[A.length - 1], list: bOps[B.length - 1] };
    return steps;
  }

  /* Steps for the cost chart (the lesson's cost model, n items). */
  function costOf(op, n) {
    switch (op) {
      case 'access': return { array: 1, list: Math.max(0, n - 1) };        // read the last item
      case 'insertFront': return { array: n + 1, list: 2 };                // n shifts + 1 write vs 2 writes
      case 'append': return { array: 1, list: n };                         // spare capacity vs walk + write
      case 'deleteLast': return { array: 1, list: Math.max(1, n - 1) };    // walk to the predecessor
      default: throw new Error('unknown op ' + op);
    }
  }

  return {
    MAX_LAB: MAX_LAB, NEW_ID: NEW,
    mkList: mkList, chainIds: chainIds, listValues: listValues,
    opInsertHead: opInsertHead, opInsertAt: opInsertAt, opAppend: opAppend, opDelete: opDelete, opSearch: opSearch, opGet: opGet,
    labSteps: labSteps, validateOp: validateOp,
    spliceOrderSteps: spliceOrderSteps,
    reverseSteps: reverseSteps, teaserSteps: teaserSteps,
    middleSteps: middleSteps,
    rhoNext: rhoNext, floydSteps: floydSteps, floydRef: floydRef,
    doublyInsertSteps: doublyInsertSteps, doublyDeleteSteps: doublyDeleteSteps,
    dummyDeleteSteps: dummyDeleteSteps, circularSteps: circularSteps, copyDeleteSteps: copyDeleteSteps,
    raceSteps: raceSteps, costOf: costOf
  };
}));
