/* Lesson 06 · Arrays & dynamic arrays — pure step generators (no DOM).

   Browser: VDSA.algos.arrays.<fn>     Node: require('js/algos/06-arrays.js').<fn>

   Every generator returns plain snapshot objects. Snapshots are complete pictures (never diffs) and are
   never mutated after they are pushed, so players can step backwards, scrub and jump.

   Cost model (the one the lesson and the study dsa-02 use):
     - writing a value into a free slot costs 1,
     - moving (shifting) one element one slot costs 1,
     - copying one element into a new block costs 1.
   So an append that does not grow costs 1, and an append into a full array of n elements costs n + 1.

   Contents
     hex, addressOf, rowMajorIndex, colMajorIndex         address arithmetic
     nextCapacity, appendCosts, totalCopies                dynamic-array growth and the amortized ledger
     makeState, validateOp, arrayOp, growthSteps           the operations lab (read, search, append, insert, delete)
     shiftDemo                                             insert / delete shifting, and the wrong shifting order
     bankSteps                                             the accounting (bank-account) method with coins
     resizePolicy                                          shrink at 1/2 (thrashes) vs shrink at 1/4
     cacheWalk                                             row-order vs column-order walks through cache lines
     accessRace                                            reading index k: pointer hops vs one address calculation
*/
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) { root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos.arrays = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var BASE = 0x1000, WORD = 4, MAX_ITEMS = 16;

  /* ------------------------------------------------------------------ address arithmetic */
  function hex(n, pad) {
    var s = Math.max(0, Math.round(n)).toString(16).toUpperCase();
    while (s.length < (pad || 4)) s = '0' + s;
    return '0x' + s;
  }
  function addressOf(base, i, size) { return base + i * size; }
  function rowMajorIndex(r, c, rows, cols) { return r * cols + c; }
  function colMajorIndex(r, c, rows, cols) { return c * rows + r; }
  /* A value the variable watch shows without quotes (same shape as VDSA.vars.raw). */
  function raw(text) { return { __vdsaRaw: true, text: String(text), type: 'num' }; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* ------------------------------------------------------------------ growth policies and costs */
  /* policy: {type: 'double'} | {type: 'factor', a: 1.5} | {type: 'add', k: 4}. Capacity 0 grows to 1 (add: k). */
  function nextCapacity(cap, policy) {
    policy = policy || { type: 'double' };
    if (policy.type === 'add') return cap + Math.max(1, policy.k || 1);
    if (cap === 0) return 1;
    if (policy.type === 'factor') return Math.max(cap + 1, Math.floor(cap * (policy.a || 2)));
    return cap * 2;
  }

  /* appendCosts(n, policy) -> one record per append k = 1..n, starting from an empty array with capacity 0.
     cost = copies + 1; bank = 3k − total (the accounting method charges 3 per append);
     phi = 2·size − capacity (the potential function, meaningful for doubling). */
  function appendCosts(n, policy) {
    var out = [], size = 0, cap = 0, total = 0, copiesTotal = 0;
    for (var k = 1; k <= n; k++) {
      var capBefore = cap, grew = size === cap, copies = 0;
      if (grew) { copies = size; cap = nextCapacity(cap, policy); }
      size++;
      var cost = copies + 1;
      total += cost; copiesTotal += copies;
      out.push({ k: k, sizeBefore: size - 1, size: size, capBefore: capBefore, cap: cap, grew: grew, copies: copies, cost: cost,
        total: total, totalCopies: copiesTotal, avg: total / k, bank: 3 * k - total, phi: 2 * size - cap });
    }
    return out;
  }
  function totalCopies(n, policy) {
    var c = appendCosts(n, policy);
    return c.length ? c[c.length - 1].totalCopies : 0;
  }

  /* ------------------------------------------------------------------ the operations lab */
  /* A lab state: {items: [{id, value}], cap, uid, gen}. uid numbers new element ids; gen numbers memory blocks. */
  function makeState(values, cap) {
    var st = { items: [], cap: cap === undefined ? values.length : cap, uid: 0, gen: 0 };
    values.forEach(function (v) { st.items.push({ id: 'v' + st.uid, value: v }); st.uid++; });
    if (st.cap < st.items.length) st.cap = st.items.length;
    return st;
  }
  function cloneState(s) { return { items: s.items.map(function (it) { return { id: it.id, value: it.value }; }), cap: s.cap, uid: s.uid, gen: s.gen }; }

  /* op: {type: 'read'|'search'|'append'|'insert'|'delete', index?, value?}. Returns an error message or null. */
  function validateOp(state, op) {
    var n = state.items.length;
    var t = op && op.type;
    if (['read', 'search', 'append', 'insert', 'delete'].indexOf(t) === -1) return 'Pick an operation.';
    function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
    if (t === 'search' || t === 'append' || t === 'insert') {
      if (!isInt(op.value)) return 'Enter a whole number for x.';
      if (op.value < -99 || op.value > 99) return 'Keep x between −99 and 99.';
    }
    if (t === 'read' || t === 'delete') {
      if (!n) return 'The array is empty: there is no index to ' + (t === 'read' ? 'read' : 'delete') + '. Append something first.';
      if (!isInt(op.index) || op.index < 0 || op.index > n - 1) return 'Index must be between 0 and ' + (n - 1) + ' (size − 1).';
    }
    if (t === 'insert') {
      if (!isInt(op.index) || op.index < 0 || op.index > n) return 'Index must be between 0 and ' + n + ' (inserting at ' + n + ' is an append).';
    }
    if ((t === 'append' || t === 'insert') && n >= MAX_ITEMS) return 'The lab holds at most ' + MAX_ITEMS + ' values so every step stays readable. Delete one first.';
    return null;
  }

  /* arrayOp(state, op) -> {steps, state, error}. Steps are array-view snapshots plus caption, line, vars, counters,
     flow, flowVisited and meta {size, cap, op, cost}. The returned state is the array after the operation. */
  function arrayOp(state, op) {
    var err = validateOp(state, op);
    if (err) return { steps: [], state: state, error: err };
    var st = cloneState(state);
    var slots = [];                                  // slots of the live block: item or null
    for (var s = 0; s < st.cap; s++) slots.push(st.items[s] || null);
    var n = st.items.length, cap = st.cap, gen = st.gen, uid = st.uid;
    var marks = {}, ghosts = [], held = null, ptrs = [], nb = null;   // nb: new block during growth
    var cnt = { reads: 0, writes: 0, shifts: 0, copies: 0 };
    var steps = [], visitedFlow = [], lastFlow = null, cost = 0;
    var t = op.type, x = op.value, idx = op.index;

    function rowOf(cells, rid, rcap, label, rowMarks, rowGhosts) {
      var items = [];
      cells.forEach(function (it, k) {
        if (!it) return;
        var o = { id: it.id, value: it.value, index: k, state: (rowMarks && rowMarks[it.id]) || 'default' };
        if (it.from) o.from = it.from;
        items.push(o);
      });
      return { id: rid, label: label, items: items, length: rcap, ghosts: (rowGhosts || []).slice() };
    }
    function snap(o) {
      var liveId = 'b' + gen;
      var rows = [rowOf(slots, liveId, cap, nb ? 'old · ' + cap : 'capacity ' + cap, marks, ghosts)];
      if (nb) rows.push(rowOf(nb.slots, 'b' + nb.gen, nb.cap, 'new · ' + nb.cap, nb.marks, []));
      if (o.dropOld && nb) rows = [rowOf(nb.slots, 'b' + nb.gen, nb.cap, 'capacity ' + nb.cap, nb.marks, [])];
      var sizeRow = o.dropOld && nb ? 'b' + nb.gen : liveId;
      var pointers = ptrs.map(function (p) { return Object.assign({ row: sizeRow }, p); });
      if (o.sizePtr !== false) pointers.push({ name: 'size', index: n, row: sizeRow, state: 'default' });
      var flow = o.flow || null;
      if (flow && lastFlow !== flow) { if (visitedFlow.indexOf(flow) === -1) visitedFlow.push(flow); }
      if (flow) lastFlow = flow;
      steps.push({
        rows: rows,
        held: held ? { id: held.id, value: held.value, over: held.over, state: held.state || 'key', row: held.row || sizeRow } : null,
        pointers: pointers,
        caption: o.caption, line: o.line === undefined ? null : o.line,
        vars: o.vars || {}, counters: { reads: cnt.reads, writes: cnt.writes, shifts: cnt.shifts, copies: cnt.copies },
        flow: flow, flowVisited: visitedFlow.filter(function (f) { return f !== flow; }),
        kind: o.kind || t,
        meta: { size: n, cap: o.dropOld && nb ? nb.cap : cap, op: t, cost: cost }
      });
    }
    function clearMarks() { marks = {}; ghosts = []; ptrs = []; }

    /* grow(): allocate a block twice as big, copy every element one by one, free the old block. */
    function grow(vars) {
      var newCap = cap === 0 ? 1 : cap * 2;
      nb = { gen: gen + 1, cap: newCap, slots: [], marks: {} };
      for (var k = 0; k < newCap; k++) nb.slots.push(null);
      snap({ caption: (cap === 0
          ? 'The array has no storage yet, so it allocates its first block: <b>1 slot</b>.'
          : 'Allocate a new block of <b>' + newCap + ' slots</b>, twice the old capacity, somewhere else in memory. The old block cannot stretch in place: the bytes right after it may already belong to something else.'),
        line: 'alloc', flow: 'grow', vars: Object.assign({}, vars, { newCap: newCap }), kind: 'alloc' });
      for (var j = 0; j < n; j++) {
        var src = slots[j];
        var copy = { id: 'v' + uid, value: src.value, from: src.id };
        uid++;
        nb.slots[j] = copy;
        nb.marks = {}; nb.marks[copy.id] = 'swap';
        marks[src.id] = 'muted';
        cnt.copies++; cost++;
        snap({ caption: 'Copy <b>a[' + j + '] = ' + src.value + '</b> into the new block (copy ' + (j + 1) + ' of ' + n + '). Each copy is one unit of work, so this append now costs ' + cost + ' so far.',
          line: 'copy', flow: 'grow', vars: Object.assign({}, vars, { newCap: newCap, j: j }), kind: 'copy' });
        delete nb.slots[j].from;
      }
      nb.marks = {};
      snap({ dropOld: true, caption: 'Free the old block. The new block holds all ' + plural(n, 'value') + ' and has <b>' + (newCap - n) + ' free slot' + (newCap - n === 1 ? '' : 's') + '</b> of runway, so the next appends are cheap again.',
        line: 'free', flow: 'grow', vars: Object.assign({}, vars, { capacity: newCap }), kind: 'free' });
      // the new block becomes the live block
      slots = nb.slots; cap = newCap; gen = nb.gen; nb = null; marks = {};
      if (held) held.row = null;
    }

    if (t === 'read') {
      ptrs = [{ name: 'i', index: idx, state: 'active' }];
      snap({ caption: 'Is <b>' + idx + '</b> a valid index? It must satisfy 0 ≤ i &lt; size = ' + n + '. It does.', line: 'bounds', vars: { i: idx, size: n } });
      var addr = addressOf(BASE, idx, WORD);
      marks[slots[idx].id] = 'active';
      cnt.reads++; cost = 1;
      snap({ caption: 'a[' + idx + '] lives at base + i × 4 = ' + hex(BASE) + ' + ' + idx + ' × 4 = <b>' + hex(addr) + '</b>. One multiplication, one addition, one read: <b>' + slots[idx].value + '</b>. No other element is touched.',
        line: 'read', vars: { i: idx, address: raw(hex(addr)), 'a[i]': slots[idx].value } });
      marks = {}; marks[slots[idx].id] = 'found';
      snap({ caption: 'Done: reading any index costs the same, whether the array holds 5 values or 5 million.', line: null, vars: { i: idx, address: raw(hex(addr)), 'a[i]': slots[idx].value } });
    } else if (t === 'search') {
      var found = -1;
      if (!n) snap({ caption: 'The array is empty, so ' + x + ' cannot be in it. Return −1 without looking at anything.', line: 'none', vars: { x: x } });
      for (var j = 0; j < n; j++) {
        marks = {};
        for (var q = 0; q < j; q++) marks[slots[q].id] = 'visited';
        marks[slots[j].id] = 'compare';
        ptrs = [{ name: 'j', index: j, state: 'compare' }];
        cnt.reads++; cost++;
        var eq = slots[j].value === x;
        snap({ caption: 'Compare <b>a[' + j + '] = ' + slots[j].value + '</b> with x = ' + x + '. ' + (eq ? 'They match.' : (j === 0 ? 'An index cannot help here: you are looking for a value, so the only way is to look.' : 'Not it; move right.')),
          line: 'cmp', vars: { x: x, j: j, 'a[j]': slots[j].value } });
        if (eq) { found = j; break; }
      }
      if (found >= 0) {
        marks = {};
        for (q = 0; q < found; q++) marks[slots[q].id] = 'visited';
        marks[slots[found].id] = 'found';
        ptrs = [{ name: 'j', index: found, state: 'found' }];
        snap({ caption: 'Found ' + x + ' at index <b>' + found + '</b> after ' + plural(found + 1, 'comparison') + '. Searching by value is linear: in the worst case every element is checked.', line: 'found', vars: { x: x, j: found, result: found } });
      } else if (n) {
        marks = {};
        slots.forEach(function (it) { if (it) marks[it.id] = 'visited'; });
        ptrs = [];
        snap({ caption: x + ' is not in the array. All ' + plural(n, 'element') + ' were compared before you could be sure: return <b>−1</b>.', line: 'none', vars: { x: x, result: -1 } });
      }
    } else if (t === 'append' || t === 'insert') {
      var at = t === 'append' ? n : idx;
      var newId = 'v' + uid; uid++;
      held = { id: newId, value: x, over: at, state: 'key' };
      var full = n === cap;
      var baseVars = t === 'append' ? { x: x, size: n, capacity: cap } : { i: at, x: x, size: n, capacity: cap };
      var moves = n - at;
      var intro = t === 'append'
        ? 'Append <b>' + x + '</b>: the new value goes into slot <b>size = ' + n + '</b>.'
        : 'Insert <b>' + x + '</b> at index <b>' + at + '</b>: ' + (moves ? 'the ' + plural(moves, 'value') + ' from index ' + at + ' to the end must each move one slot right to open a gap.' : 'index ' + at + ' is the end, so nothing has to move.');
      snap({ caption: intro + ' ' + (full ? 'But size = capacity = ' + cap + ': there is no free slot. The array must grow first.' : 'size ' + n + ' &lt; capacity ' + cap + ', so there is room.'),
        line: 'full', flow: 'full', vars: baseVars });
      if (full) grow(baseVars);
      if (t === 'insert' && moves) {
        for (var jj = n; jj > at; jj--) {
          var mover = slots[jj - 1];
          slots[jj] = mover; slots[jj - 1] = null;
          marks = {}; marks[mover.id] = 'swap';
          ghosts = [jj - 1];
          ptrs = [{ name: 'j', index: jj, state: 'swap' }];
          cnt.shifts++; cost++;
          snap({ caption: 'Shift <b>' + mover.value + '</b> from slot ' + (jj - 1) + ' to slot ' + jj + ' (a[' + jj + '] ← a[' + (jj - 1) + ']). ' + (jj === n ? 'Start at the end, where the slot to the right is free, so nothing gets overwritten.' : 'Slot ' + jj + ' was freed by the previous move.'),
            line: 'shift', flow: 'shift', vars: { i: at, x: x, j: jj, size: n, capacity: cap } });
        }
      }
      // write the new value
      slots[at] = { id: newId, value: x };
      held = null; marks = {}; marks[newId] = 'swap'; ghosts = []; ptrs = [];
      cnt.writes++; cost++;
      n++;
      snap({ caption: 'Write <b>' + x + '</b> into slot ' + at + ' and add one to size, which is now ' + n + '. ' +
          (cost === 1 ? 'Total work: <b>1</b>, a single write.' : 'Total work for this ' + t + ': <b>' + cost + '</b> (' + [cnt.copies ? plural(cnt.copies, 'copy').replace('copys', 'copies') : '', cnt.shifts ? plural(cnt.shifts, 'shift') : '', '1 write'].filter(Boolean).join(' + ') + ').'),
        line: ['write', 'size'], flow: 'write', vars: t === 'append' ? { x: x, size: n, capacity: cap } : { i: at, x: x, size: n, capacity: cap } });
      marks = {};
      snap({ caption: (t === 'append' ? 'Append' : 'Insert') + ' finished. ' + (full ? 'This one was expensive because it had to copy every element, but it doubled the room, so the next ' + (cap - n) + ' appends cost 1 each.' : (t === 'insert' && moves ? 'The cost grew with the number of values after index ' + at + '.' : 'Cheap: spare capacity was waiting.')),
        line: null, flow: 'done', vars: t === 'append' ? { x: x, size: n, capacity: cap } : { i: at, x: x, size: n, capacity: cap } });
    } else if (t === 'delete') {
      var victim = slots[idx];
      slots[idx] = null;
      held = { id: victim.id, value: victim.value, over: idx, state: 'muted' };
      ghosts = [idx];
      ptrs = [{ name: 'i', index: idx, state: 'active' }];
      cnt.reads++; cost++;
      snap({ caption: 'Delete index <b>' + idx + '</b>: remember the removed value <b>' + victim.value + '</b>. Slot ' + idx + ' is now a gap, and an array may not have gaps: element k must stay at base + k × 4.',
        line: 'take', vars: { i: idx, removed: victim.value, size: n } });
      for (var jd = idx; jd < n - 1; jd++) {
        var mv = slots[jd + 1];
        slots[jd] = mv; slots[jd + 1] = null;
        marks = {}; marks[mv.id] = 'swap';
        ghosts = [jd + 1];
        ptrs = [{ name: 'j', index: jd, state: 'swap' }];
        cnt.shifts++; cost++;
        snap({ caption: 'Shift <b>' + mv.value + '</b> left from slot ' + (jd + 1) + ' to slot ' + jd + ' (a[' + jd + '] ← a[' + (jd + 1) + ']). Work from the gap towards the end so each value lands in a slot that was just emptied.',
          line: 'shift', vars: { i: idx, j: jd, removed: victim.value, size: n } });
      }
      held = null; marks = {}; ghosts = []; ptrs = [];
      n--;
      snap({ caption: 'Subtract one from size (now ' + n + ') and return ' + victim.value + '. ' + (cnt.shifts ? plural(cnt.shifts, 'element') + ' had to move: deleting near the front of an array is expensive.' : 'Nothing had to move because it was the last element: deleting at the end is cheap.'),
        line: ['size', 'ret'], vars: { i: idx, removed: victim.value, size: n } });
    }

    var items = [];
    slots.forEach(function (it, k) { if (it && k < n) items.push({ id: it.id, value: it.value }); });
    return { steps: steps, state: { items: items, cap: cap, uid: uid, gen: gen }, error: null, cost: cost, counters: cnt };
  }

  /* growthSteps(values) -> steps: append each value to an array that starts with capacity 0 and doubles.
     Each step carries meta {size, cap, appendNo, appendCost, totalCost, totalCopies}. */
  function growthSteps(values) {
    var st = makeState([], 0), all = [], total = 0, copies = 0;
    values.forEach(function (v, k) {
      var r = arrayOp(st, { type: 'append', value: v });
      r.steps.forEach(function (s, j) {
        var last = j === r.steps.length - 1;
        s.meta = Object.assign({}, s.meta, { appendNo: k + 1, appendCost: s.meta.cost, totalCost: total + s.meta.cost, totalCopies: copies + s.counters.copies });
        if (!last || k === values.length - 1) all.push(s);
      });
      total += r.cost; copies += r.counters.copies;
      st = r.state;
    });
    return all;
  }

  /* ------------------------------------------------------------------ shifting (mechanism figure) */
  /* shiftDemo(values, cap, mode, i, x): mode 'insert' (shift from the back), 'wrong' (shift from the front:
     every later value is overwritten by a copy), or 'delete' (close the gap). Array-view snapshots + caption + kind. */
  function shiftDemo(values, cap, mode, i, x) {
    var slots = [], uid = 0, steps = [], n = values.length;
    for (var s = 0; s < cap; s++) slots.push(s < n ? { id: 'd' + (uid++), value: values[s] } : null);
    var marks = {}, ghosts = [], held = null, ptrs = [], moves = 0, lost = [];
    function snap(caption, kind) {
      var items = [];
      slots.forEach(function (it, k) { if (it) { var o = { id: it.id, value: it.value, index: k, state: marks[it.id] || 'default' }; if (it.from) o.from = it.from; items.push(o); } });
      steps.push({ items: items, length: cap, ghosts: ghosts.slice(), held: held ? Object.assign({}, held) : null,
        pointers: ptrs.map(function (p) { return Object.assign({}, p); }).concat([{ name: 'size', index: n, state: 'default' }]),
        caption: caption, kind: kind, moves: moves, lost: lost.slice() });
      slots.forEach(function (it) { if (it) delete it.from; });
    }
    if (mode === 'delete') {
      var victim = slots[i];
      snap('Delete index <b>' + i + '</b> (the value ' + victim.value + ') from ' + n + ' values.', 'start');
      slots[i] = null; held = { id: victim.id, value: victim.value, over: i, state: 'muted' }; ghosts = [i];
      snap('Take ' + victim.value + ' out. The gap at slot ' + i + ' breaks the rule that element k sits at base + k × size, so everything after it must slide left.', 'take');
      for (var j = i; j < n - 1; j++) {
        var mv = slots[j + 1]; slots[j] = mv; slots[j + 1] = null;
        marks = {}; marks[mv.id] = 'swap'; ghosts = [j + 1]; ptrs = [{ name: 'j', index: j, state: 'swap' }];
        moves++;
        snap('Move ' + mv.value + ' left into slot ' + j + '. Moves so far: <b>' + moves + '</b>.', 'shift');
      }
      held = null; marks = {}; ghosts = []; ptrs = []; n--;
      snap('Gap closed with <b>' + plural(moves, 'move') + '</b>: one for every element after index ' + i + '. size is now ' + n + '.', 'done');
      return steps;
    }
    var newId = 'd' + (uid++);
    held = { id: newId, value: x, over: i, state: 'key' };
    snap('Insert <b>' + x + '</b> at index <b>' + i + '</b>. Slots ' + i + ' to ' + (n - 1) + ' are full, so ' + plural(n - i, 'value') + ' must make room.', 'start');
    if (mode === 'wrong') {
      for (var jw = i + 1; jw <= n; jw++) {
        var srcIt = slots[jw - 1], dst = slots[jw];
        var copy = { id: 'd' + (uid++), value: srcIt.value, from: srcIt.id };
        if (dst) lost.push(dst.value);
        slots[jw] = copy;
        marks = {}; marks[copy.id] = 'error'; ghosts = []; ptrs = [{ name: 'j', index: jw, state: 'error' }];
        moves++;
        snap('Copy a[' + (jw - 1) + '] = ' + srcIt.value + ' into slot ' + jw + '. ' + (dst ? 'The <b>' + dst.value + '</b> that lived there is <b>overwritten</b>, and nothing kept a copy of it.' : 'Slot ' + jw + ' was free, but the damage is done.'), 'copy');
      }
      slots[i] = { id: newId, value: x }; held = null; marks = {}; marks[newId] = 'key'; ptrs = []; n++;
      snap('Write ' + x + ' into slot ' + i + '. Result: <b>' + slots.filter(Boolean).map(function (it) { return it.value; }).join(', ') + '</b>. Going front to back smeared one value over the rest: ' + plural(lost.length, 'value') + ' (' + lost.join(', ') + ') ' + (lost.length === 1 ? 'is' : 'are') + ' lost.', 'done');
      return steps;
    }
    for (var jj = n; jj > i; jj--) {
      var m = slots[jj - 1]; slots[jj] = m; slots[jj - 1] = null;
      marks = {}; marks[m.id] = 'swap'; ghosts = [jj - 1]; ptrs = [{ name: 'j', index: jj, state: 'swap' }];
      moves++;
      snap('Move ' + m.value + ' right into slot ' + jj + '. ' + (jj === n ? 'Start from the end: the slot to its right is free, so nothing is overwritten.' : 'Slot ' + jj + ' was emptied by the previous move.') + ' Moves: <b>' + moves + '</b>.', 'shift');
    }
    slots[i] = { id: newId, value: x }; held = null; marks = {}; marks[newId] = 'key'; ghosts = []; ptrs = []; n++;
    snap('Drop ' + x + ' into the gap at index ' + i + '. Total: <b>' + plural(moves, 'move') + '</b> + 1 write. Inserting at index 0 would have moved every element.', 'done');
    return steps;
  }

  /* ------------------------------------------------------------------ the accounting method (coins) */
  /* bankSteps(n): n appends to an empty doubling array; every append pays 3 coins.
     1 coin pays the write, 2 stay on the new element. When the array doubles, each copy is paid with one stored
     coin: copying element j is paid by element C/2 + (j mod C/2) (the "new half" pays for itself and for one
     "old half" element). Snapshot: {k, blocks: [{id, cap, role}], items: [{id, value, block, slot, state}],
     coins: [{id, owner|null, level, at?: {block, slot, lane}, state}], balance, charged, work, caption, phase}. */
  function bankSteps(n) {
    var steps = [], cap = 0, gen = 0, cells = [], coinSeq = 0, itemSeq = 0;
    var stash = {};            // item id -> [coin ids], bottom first
    var charged = 0, work = 0, k = 0;
    var newBlock = null;       // {gen, cap, cells}
    var incoming = [];         // coin ids waiting above the target slot
    var spent = [];            // [{id, block, slot}] coins spent in this step (drawn on the paid cell, then gone)
    var marks = {};
    function balance() { var b = 0; Object.keys(stash).forEach(function (id) { b += stash[id].length; }); return b + incoming.length; }
    function snap(caption, phase) {
      var blocks = [{ id: 'k' + gen, cap: cap, role: newBlock ? 'old' : 'live' }];
      if (newBlock) blocks.push({ id: 'k' + newBlock.gen, cap: newBlock.cap, role: 'new' });
      var items = [];
      cells.forEach(function (it, s) { if (it) items.push({ id: it.id, value: it.value, block: 'k' + gen, slot: s, state: marks[it.id] || (newBlock ? 'muted' : 'default') }); });
      if (newBlock) newBlock.cells.forEach(function (it, s) { if (it) items.push({ id: it.id, value: it.value, block: 'k' + newBlock.gen, slot: s, state: marks[it.id] || 'default', from: it.from }); });
      var coins = [];
      Object.keys(stash).forEach(function (owner) { stash[owner].forEach(function (cid, lv) { coins.push({ id: cid, owner: owner, level: lv, state: 'stored' }); }); });
      incoming.forEach(function (cid, lv) { coins.push({ id: cid, owner: null, level: lv, at: { block: newBlock ? 'k' + newBlock.gen : 'k' + gen, slot: cells.filter(Boolean).length, lane: 'in' }, state: 'incoming' }); });
      spent.forEach(function (sp) { coins.push({ id: sp.id, owner: null, level: 0, at: { block: sp.block, slot: sp.slot, lane: 'cell' }, state: 'spent' }); });
      steps.push({ k: k, blocks: blocks, items: items, coins: coins, balance: balance(), charged: charged, work: work,
        size: cells.filter(Boolean).length, cap: newBlock ? newBlock.cap : cap, caption: caption, phase: phase });
      items.forEach(function (it) { delete it.from; });
      if (newBlock) newBlock.cells.forEach(function (it) { if (it) delete it.from; });
    }
    snap('An empty dynamic array with capacity 0. The rule: <b>every append pays 3 coins</b>, whatever it really costs. One coin buys one unit of work: one write or one copy.', 'start');
    for (k = 1; k <= n; k++) {
      var size = cells.filter(Boolean).length;
      marks = {}; spent = [];
      incoming = ['c' + coinSeq++, 'c' + coinSeq++, 'c' + coinSeq++];
      charged += 3;
      var full = size === cap;
      snap('Append #' + k + ' pays <b>3 coins</b> up front. ' + (full ? 'The array is full (' + size + ' of ' + cap + '), so this append will also have to copy ' + plural(size, 'element') + '.' : 'There is a free slot, so the real work will be one write.'), 'pay');
      if (full) {
        var newCap = cap === 0 ? 1 : cap * 2;
        newBlock = { gen: gen + 1, cap: newCap, cells: [] };
        for (var q = 0; q < newCap; q++) newBlock.cells.push(null);
        if (size) {
          snap('Allocate a block of ' + newCap + ' slots. Copying ' + plural(size, 'element') + ' will cost ' + plural(size, 'coin') + ', and they are already sitting on the array.', 'alloc');
          var half = Math.max(1, cap / 2);
          for (var j = 0; j < size; j++) {
            var payer = cap === 1 ? cells[0] : cells[half + (j % half)];
            var pile = stash[payer.id];
            if (!pile || !pile.length) throw new Error('bankSteps: no coin to pay for copy ' + j);
            var coin = pile.pop();
            var copy = { id: 'm' + itemSeq++, value: cells[j].value, from: cells[j].id };
            newBlock.cells[j] = copy;
            spent.push({ id: coin, block: 'k' + newBlock.gen, slot: j });
            marks[copy.id] = 'swap';
            work++;
          }
          snap('Copy all ' + plural(size, 'element') + '. Each copy spends one stored coin: every element added since the last doubling pays for copying itself and one older element. ' + plural(size, 'copy').replace('copys', 'copies') + ', ' + plural(size, 'coin') + ' spent.', 'copy');
          spent = []; marks = {};
          // coins still stored on old elements move with their element to its copy
          var moved = {};
          cells.forEach(function (it, s) { if (it && stash[it.id]) { if (stash[it.id].length) moved[newBlock.cells[s].id] = stash[it.id]; delete stash[it.id]; } });
          Object.keys(moved).forEach(function (id) { stash[id] = moved[id]; });
        } else {
          snap('The array has no storage yet: allocate a first block of 1 slot. Nothing to copy, so nothing to pay.', 'alloc');
        }
        cells = newBlock.cells; cap = newCap; gen = newBlock.gen; newBlock = null; marks = {};
        snap('Free the old block. The new one is ' + (cap === 1 ? 'ready' : 'exactly half full') + ', and the array keeps whatever coins were left.', 'free');
      }
      // write: one coin pays, two stay on the new element
      var slot = size;
      var item = { id: 'm' + itemSeq++, value: k };
      cells[slot] = item;
      var pay = incoming.shift();
      spent = [{ id: pay, block: 'k' + gen, slot: slot }];
      stash[item.id] = incoming.slice();
      incoming = [];
      marks = {}; marks[item.id] = 'swap';
      work++;
      var bal = balance();
      snap('Write the new element: <b>1 coin</b> pays for the write and <b>2 coins stay on it</b> for the future. Paid so far ' + charged + ', real work ' + work + ', bank <b>' + bal + '</b>. The bank never goes below zero.', 'write');
      spent = []; marks = {};
    }
    k = n;
    snap(plural(n, 'append') + ' paid ' + charged + ' coins and did ' + work + ' units of work. The ' + balance() + ' coins left over are prepaid copies for the next doubling. So 3 per append is enough: <b>O(1) amortized</b>.', 'end');
    return steps;
  }

  /* ------------------------------------------------------------------ shrinking policies */
  /* resizePolicy(ops, rule, n0, c0): ops is a list of 'push'/'pop'; rule 'half' shrinks when size falls to C/2,
     'quarter' when it falls to C/4 (both halve C). Growth doubles when a push finds the array full.
     Returns [{i, op, n, cap, copies, total, event}] with a leading record for the start state. */
  function resizePolicy(ops, rule, n0, c0) {
    var n = n0, cap = c0, total = 0, out = [{ i: 0, op: null, n: n, cap: cap, copies: 0, total: 0, event: null }];
    ops.forEach(function (op, k) {
      var copies = 0, event = null;
      if (op === 'push') {
        if (n === cap) { copies = n; cap = cap === 0 ? 1 : cap * 2; event = 'grow'; }
        n++;
      } else if (op === 'pop' && n > 0) {
        n--;
        var limit = rule === 'half' ? cap / 2 : cap / 4;
        if (cap > 1 && n <= limit) { copies = n; cap = Math.max(1, cap / 2); event = 'shrink'; }
      }
      total += copies;
      out.push({ i: k + 1, op: op, n: n, cap: cap, copies: copies, total: total, event: event });
    });
    return out;
  }

  /* ------------------------------------------------------------------ cache lines */
  /* cacheWalk(rows, cols, order, lineCells, cacheLines): visit every cell of a rows×cols row-major array in
     'row' or 'col' order. Memory is cut into lines of lineCells cells; the cache holds cacheLines lines (LRU).
     Steps: {k, r, c, index, line, hit, cache: [lines, most recent last], misses, hits}; step 0 is the start. */
  function cacheWalk(rows, cols, order, lineCells, cacheLines) {
    var steps = [{ k: 0, r: null, c: null, index: null, line: null, hit: null, cache: [], misses: 0, hits: 0 }];
    var cache = [], misses = 0, hits = 0, k = 0;
    function visit(r, c) {
      var index = rowMajorIndex(r, c, rows, cols), line = Math.floor(index / lineCells);
      var pos = cache.indexOf(line), hit = pos !== -1;
      if (hit) { cache.splice(pos, 1); hits++; } else { misses++; if (cache.length >= cacheLines) cache.shift(); }
      cache.push(line);
      k++;
      steps.push({ k: k, r: r, c: c, index: index, line: line, hit: hit, cache: cache.slice(), misses: misses, hits: hits });
    }
    if (order === 'col') { for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) visit(r, c); }
    else { for (var r2 = 0; r2 < rows; r2++) for (var c2 = 0; c2 < cols; c2++) visit(r2, c2); }
    return steps;
  }

  /* ------------------------------------------------------------------ access race */
  /* accessRace(n, k, seed): n elements stored two ways. The linked copy scatters its nodes over a memory of
     `cells` slots (deterministic shuffle); the array copy is contiguous. Steps t = 0..max(k, 1): the linked
     token sits on node min(t, k) after t hops; the array needs one address calculation (done from step 1).
     Returns {n, k, cells, nodeCell: [cell of node i], base, steps: [{t, listAt, listHops, arrayAt, arrayJumps, done}]}. */
  function accessRace(n, k, seed, cells) {
    cells = cells || 24;
    var a = (seed === undefined ? 7 : seed) >>> 0;
    function rnd() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var pool = [];
    for (var i = 0; i < cells; i++) pool.push(i);
    for (i = pool.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    var nodeCell = pool.slice(0, n);
    var last = Math.max(k, 1), steps = [];
    for (var t = 0; t <= last; t++) {
      var listAt = Math.min(t, k);
      steps.push({ t: t, listAt: listAt, listHops: listAt, arrayAt: t >= 1 ? k : 0, arrayJumps: t >= 1 ? 1 : 0, arrayDone: t >= 1, listDone: listAt === k && t >= 1 || (k === 0 && t >= 1) });
    }
    return { n: n, k: k, cells: cells, nodeCell: nodeCell, base: BASE, steps: steps };
  }

  return {
    BASE: BASE, WORD: WORD, MAX_ITEMS: MAX_ITEMS,
    hex: hex, addressOf: addressOf, rowMajorIndex: rowMajorIndex, colMajorIndex: colMajorIndex,
    nextCapacity: nextCapacity, appendCosts: appendCosts, totalCopies: totalCopies,
    makeState: makeState, validateOp: validateOp, arrayOp: arrayOp, growthSteps: growthSteps,
    shiftDemo: shiftDemo, bankSteps: bankSteps, resizePolicy: resizePolicy, cacheWalk: cacheWalk, accessRace: accessRace
  };
}));
