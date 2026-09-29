/* Heaps & priority queues: pure step generators. No DOM. UMD: in the browser it attaches to VDSA.algos.heap and
   merges heap sort into VDSA.algos.sorting (lessons 14, 15 and 16 add their own names to the same object, so only
   NEW names are exported there: heap, heapCount, CODE_HEAP, META_HEAP). In Node it exports the same API.

     H.insert(items, value, opts)      -> {steps, items}   one insert: append, then sift up
     H.extract(items, opts)            -> {steps, items, value}   remove the root: last -> root, then sift down
     H.peek(items, opts)               -> {steps, items}
     H.build(values, opts)             -> {steps, items}   bottom-up (Floyd) build-heap
     H.buildByInsert(values, opts)     -> {steps, items}   repeated insert (the slow way), for comparison
     H.sort(values, opts)              -> steps            heap sort (max-heap, in place); same as sorting.heap
     H.chain(initial, ops, opts)       -> {steps, items}   several ops in one trace: [{op:'insert', value} | {op:'extract'}]
     H.decreaseKey(items, pos, value)  -> {steps, items}
     H.topK(stream, k, opts)           -> steps            size-k min-heap keeps the k largest of a stream
     H.mergeK(lists, opts)             -> steps            heap of list heads merges k sorted lists
     H.pqRun(kind, initial, ops)       -> steps            'unsorted' | 'sorted' | 'heap' priority queue, micro-steps
     H.pqFrames(initial, ops)          -> frames           one frame per operation, all three implementations
     H.pqWorkloadCost(kind, values)    -> cost             insert all, then extract all (count only, fast)
     H.count.*                         fast counters for charts (buildBottomUp, buildByInsert, sort)
     H.treeState(step, opts)           -> state for VDSA.views.tree (the same ids as the array view)
     H.isHeap(values, kind)  H.parent(i)  H.left(i)  H.right(i)  H.height(n)  H.levelOf(i)  H.CODE(op, kind)  H.META

   values: numbers. items: [{id, value, label?, sub?}] in heap (array) order. opts: {kind: 'min' | 'max', prefix: 'h'}.

   Every step is a complete snapshot that VDSA.views.array can draw directly (items in array order, pointers, regions)
   and that H.treeState turns into a VDSA.views.tree snapshot with the same ids:
     { algo, kind, items: [{id, value, state, label?}], order: [id], size, pointers: [{name, index, state}],
       regions, edges: [[posA, posB, state]], final: [pos],
       caption, line, flow, vars, varStates, counters: {comparisons, swaps}, ops: {comparisons, swaps, shifts, writes} }
   Truth rules (tested in tests/algos/21-heaps.test.js): the heap property holds at the end of every operation;
   comparisons are strict, so equal values never swap; 'done' appears only on positions that can never change again
   (the sorted suffix of heap sort, the k largest at the very end of a top-k run); counters only ever grow. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.heap = api;
    V.algos.sorting = Object.assign(V.algos.sorting || {}, {
      heap: api.sort, heapCount: api.count.sort, CODE_HEAP: api.CODE_SORT, META_HEAP: api.META.sort
    });
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ index arithmetic (0-based) */
  function parent(i) { return (i - 1) >> 1; }
  function left(i) { return 2 * i + 1; }
  function right(i) { return 2 * i + 2; }
  function height(n) { return n < 1 ? 0 : Math.floor(Math.log2(n)); }              // levels below the root of an n-node heap
  function levelOf(i) { return Math.floor(Math.log2(i + 1)); }                      // depth of index i
  function isHeap(values, kind, size) {
    var n = size === undefined ? values.length : size;
    for (var i = 1; i < n; i++) {
      var p = values[parent(i)], c = values[i];
      if (kind === 'max' ? p < c : p > c) return false;
    }
    return true;
  }

  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function b(it) { return '<b>' + fmt(it.value) + '</b>'; }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }

  function normalize(values, prefix) {
    prefix = prefix === undefined ? 'h' : prefix;
    return (values || []).map(function (v, i) {
      if (v !== null && typeof v === 'object') {
        var o = { id: v.id !== undefined ? String(v.id) : prefix + i, value: v.value };
        if (v.label !== undefined) o.label = v.label;
        if (v.sub !== undefined) o.sub = v.sub;
        if (v.list !== undefined) o.list = v.list;
        return o;
      }
      return { id: prefix + i, value: v };
    });
  }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  function sd(cmp) {   // siftDown code for both orders; cmp is '<' (min-heap) or '>' (max-heap)
    return {
      pseudo: [
        'procedure siftDown(a, i, n)',
        '  loop                                    // @loop',
        '    c ← 2i + 1                            // @child',
        '    if c ≥ n then stop                    // @leaf',
        '    if c + 1 < n and a[c + 1] ' + cmp + ' a[c] then c ← c + 1   // @pick',
        '    if a[c] ' + cmp + ' a[i] then                // @cmp',
        '      swap a[i] and a[c]                  // @swap',
        '      i ← c                               // @move',
        '    else stop                             // @stop'
      ],
      js: [
        'function siftDown(a, i, n) {',
        '  while (true) {                                    // @loop',
        '    let c = 2 * i + 1;                              // @child',
        '    if (c >= n) break;                              // @leaf',
        '    if (c + 1 < n && a[c + 1] ' + cmp + ' a[c]) c++;         // @pick',
        '    if (a[c] ' + cmp + ' a[i]) {                           // @cmp',
        '      [a[i], a[c]] = [a[c], a[i]];                  // @swap',
        '      i = c;                                        // @move',
        '    } else break;                                   // @stop',
        '  }',
        '}'
      ],
      py: [
        'def sift_down(a, i, n):',
        '    while True:                                     # @loop',
        '        c = 2 * i + 1                               # @child',
        '        if c >= n: break                            # @leaf',
        '        if c + 1 < n and a[c + 1] ' + cmp + ' a[c]:          # @pick',
        '            c += 1                                  # @pick',
        '        if a[c] ' + cmp + ' a[i]:                          # @cmp',
        '            a[i], a[c] = a[c], a[i]                 # @swap',
        '            i = c                                   # @move',
        '        else: break                                 # @stop'
      ]
    };
  }
  function join(parts) { return { pseudo: parts.pseudo.join('\n'), js: parts.js.join('\n'), py: parts.py.join('\n') }; }
  function cat(x, y) { return { pseudo: x.pseudo.concat([''], y.pseudo), js: x.js.concat([''], y.js), py: x.py.concat([''], y.py) }; }

  /* CODE(op, kind) -> {pseudo, js, py} for 'insert' | 'extract' | 'build' | 'sort'. */
  function CODE(op, kind) {
    var mx = kind === 'max', cmp = mx ? '>' : '<', top = mx ? 'Max' : 'Min';
    var s = sd(cmp), out;
    if (op === 'insert') {
      out = {
        pseudo: [
          'procedure insert(heap, x)',
          '  append x to the end of heap          // @place',
          '  i ← last index                       // @place',
          '  while i > 0 do                       // @loop',
          '    p ← ⌊(i − 1) / 2⌋                  // @parent',
          '    if heap[i] ' + cmp + ' heap[p] then        // @cmp',
          '      swap heap[i] and heap[p]         // @swap',
          '      i ← p                            // @move',
          '    else stop                          // @stop'
        ],
        js: [
          'function insert(heap, x) {',
          '  heap.push(x);                                   // @place',
          '  let i = heap.length - 1;                        // @place',
          '  while (i > 0) {                                 // @loop',
          '    const p = (i - 1) >> 1;                       // @parent',
          '    if (heap[i] ' + cmp + ' heap[p]) {                    // @cmp',
          '      [heap[i], heap[p]] = [heap[p], heap[i]];    // @swap',
          '      i = p;                                      // @move',
          '    } else break;                                 // @stop',
          '  }',
          '}'
        ],
        py: [
          'def insert(heap, x):',
          '    heap.append(x)                               # @place',
          '    i = len(heap) - 1                            # @place',
          '    while i > 0:                                 # @loop',
          '        p = (i - 1) // 2                         # @parent',
          '        if heap[i] ' + cmp + ' heap[p]:                  # @cmp',
          '            heap[i], heap[p] = heap[p], heap[i]  # @swap',
          '            i = p                                # @move',
          '        else: break                              # @stop'
        ]
      };
      return join(out);
    }
    if (op === 'extract') {
      out = {
        pseudo: [
          'procedure extract' + top + '(heap)',
          '  top ← heap[0]                        // @take',
          '  last ← remove the last element       // @lift',
          '  if heap is not empty then            // @lift',
          '    heap[0] ← last                     // @lift',
          '    siftDown(heap, 0, size)            // @start',
          '  return top                           // @ret'
        ],
        js: [
          'function extract' + top + '(heap) {',
          '  const top = heap[0];                 // @take',
          '  const last = heap.pop();             // @lift',
          '  if (heap.length > 0) {               // @lift',
          '    heap[0] = last;                    // @lift',
          '    siftDown(heap, 0, heap.length);    // @start',
          '  }',
          '  return top;                          // @ret',
          '}'
        ],
        py: [
          'def extract_' + top.toLowerCase() + '(heap):',
          '    top = heap[0]                      # @take',
          '    last = heap.pop()                  # @lift',
          '    if heap:                           # @lift',
          '        heap[0] = last                 # @lift',
          '        sift_down(heap, 0, len(heap))  # @start',
          '    return top                         # @ret'
        ]
      };
      return join(cat(out, s));
    }
    if (op === 'build') {
      out = {
        pseudo: [
          'procedure buildHeap(a)',
          '  for i ← ⌊n / 2⌋ − 1 down to 0        // @bfor',
          '    siftDown(a, i, n)                  // @bsift'
        ],
        js: [
          'function buildHeap(a) {',
          '  const n = a.length;',
          '  for (let i = (n >> 1) - 1; i >= 0; i--)   // @bfor',
          '    siftDown(a, i, n);                       // @bsift',
          '}'
        ],
        py: [
          'def build_heap(a):',
          '    n = len(a)',
          '    for i in range(n // 2 - 1, -1, -1):  # @bfor',
          '        sift_down(a, i, n)               # @bsift'
        ]
      };
      return join(cat(out, s));
    }
    /* sort: always a max-heap, ascending output */
    var sm = sd('>');
    out = {
      pseudo: [
        'procedure heapSort(a)',
        '  for i ← ⌊n / 2⌋ − 1 down to 0        // @bfor',
        '    siftDown(a, i, n)                  // @bsift',
        '  for end ← n − 1 down to 1            // @sfor',
        '    swap a[0] and a[end]               // @sswap',
        '    siftDown(a, 0, end)                // @ssift'
      ],
      js: [
        'function heapSort(a) {',
        '  const n = a.length;',
        '  for (let i = (n >> 1) - 1; i >= 0; i--)   // @bfor',
        '    siftDown(a, i, n);                       // @bsift',
        '  for (let end = n - 1; end > 0; end--) {    // @sfor',
        '    [a[0], a[end]] = [a[end], a[0]];         // @sswap',
        '    siftDown(a, 0, end);                     // @ssift',
        '  }',
        '}'
      ],
      py: [
        'def heap_sort(a):',
        '    n = len(a)',
        '    for i in range(n // 2 - 1, -1, -1):  # @bfor',
        '        sift_down(a, i, n)               # @bsift',
        '    for end in range(n - 1, 0, -1):      # @sfor',
        '        a[0], a[end] = a[end], a[0]      # @sswap',
        '        sift_down(a, 0, end)             # @ssift'
      ]
    };
    return join(cat(out, sm));
  }
  var CODE_SORT = CODE('sort', 'max');

  var META = {
    sort: {
      title: 'Heap sort', verb: 'swaps', moveLabel: 'Swaps',
      idea: 'Build a max-heap in place, then repeatedly swap the root (the largest value) to the end and repair the shrinking heap.',
      invariant: 'After k extractions, the last k positions hold the k largest values in their final places, and the rest is still a max-heap.',
      best: 'about n log n comparisons (the heap does the same work whatever the order)', worst: 'about 2 n log n comparisons',
      stable: false, inPlace: true, adaptive: false
    }
  };

  /* ------------------------------------------------------------------ the tracer: one heap, many operations */
  var VAR_STATES = { i: 'key', parent: 'compare', c: 'compare', 'a[i]': 'key', 'a[parent]': 'compare', 'a[c]': 'compare', top: 'found', x: 'key' };

  function tracer(cfg) {
    cfg = cfg || {};
    var kind = cfg.kind === 'max' ? 'max' : 'min';
    var a = normalize(cfg.items, cfg.prefix);
    var size = cfg.size === undefined ? a.length : cfg.size;
    var outState = cfg.outState || 'muted';
    var algo = cfg.algo || 'heap';
    var outHold = null;                       // a value waiting outside the heap to be returned: {pos, state}
    var decorate = cfg.decorate || null;
    var uid = cfg.uid || 0;
    var ops = { comparisons: 0, swaps: 0, shifts: 0, writes: 0 };
    var steps = [];
    var rule = kind === 'max' ? 'parent ≥ child' : 'parent ≤ child';
    var gt = kind === 'max' ? '&gt;' : '&lt;';           // "beats" in HTML
    var winWord = kind === 'max' ? 'larger' : 'smaller';
    var T = { steps: steps, ops: ops, kind: kind };

    function beats(x, y) { return kind === 'max' ? x.value > y.value : x.value < y.value; }
    T.beats = beats;
    T.items = function () { return a; };
    T.size = function () { return size; };
    T.setSize = function (n) { size = n; };
    T.nextId = function (prefix) { return (prefix || 'n') + (uid++); };

    function snap(k, o) {
      o = o || {};
      var mark = o.mark || {};
      var items = a.map(function (it, pos) {
        var st = mark[pos] || (outHold && pos === outHold.pos ? outHold.state : (pos >= size ? outState : 'default'));
        var x = { id: it.id, value: it.value, state: st };
        if (it.label !== undefined) x.label = it.label;
        return x;
      });
      var regions = [];
      if (size < a.length && size > 0) regions.push({ id: 'heap', from: 0, to: size - 1, state: 'active', label: o.heapLabel || 'heap' });
      if (outState === 'done' && size < a.length) regions.push({ id: 'sorted', from: size, to: a.length - 1, state: 'done', label: 'sorted' });
      var final = [];
      if (outState === 'done') for (var p = size; p < a.length; p++) final.push(p);
      var step = {
        algo: algo, kind: k, items: items, order: a.map(function (it) { return it.id; }), size: size,
        pointers: o.pointers || [], regions: regions, edges: o.edges || [], final: final,
        heapKind: kind, caption: o.caption || '', line: o.line === undefined ? null : o.line, flow: o.flow === undefined ? null : o.flow,
        vars: o.vars || {}, varStates: VAR_STATES,
        counters: { comparisons: ops.comparisons, swaps: ops.swaps },
        ops: { comparisons: ops.comparisons, swaps: ops.swaps, shifts: 0, writes: ops.writes }
      };
      if (o.extra) Object.keys(o.extra).forEach(function (key) { step[key] = o.extra[key]; });
      if (decorate) decorate(step, k, o);
      steps.push(step);
      return step;
    }
    T.snap = snap;

    function ptr(name, index, state) { return { name: name, index: index, state: state || 'active' }; }
    T.ptr = ptr;

    /* ---- sift up: the item at pos climbs while it beats its parent */
    T.siftUp = function (pos, o) {
      o = o || {};
      var moved = a[pos];
      for (;;) {
        var vars;
        if (pos === 0) {
          snap('root', { mark: mk(0, 'key'), pointers: [ptr('i', 0, 'key')], line: 'loop', flow: 'up:test',
            vars: { i: 0, 'a[i]': a[0].value },
            caption: b(moved) + ' has reached the root. There is no parent above it, so it cannot climb any further.' });
          return pos;
        }
        var p = parent(pos);
        ops.comparisons++;
        var wins = beats(a[pos], a[p]);
        vars = { i: pos, parent: p, 'a[i]': a[pos].value, 'a[parent]': a[p].value };
        var m = {}; m[pos] = 'key'; m[p] = 'compare';
        snap('compare', { mark: m, edges: [[p, pos, 'compare']], pointers: [ptr('i', pos, 'key'), ptr('parent', p, 'compare')], line: 'cmp', flow: 'up:test', vars: vars,
          caption: 'Compare ' + b(a[pos]) + ' with its parent ' + b(a[p]) + ' at index ' + p + ' = ⌊(' + pos + ' − 1) / 2⌋. ' +
            (wins ? fmt(a[pos].value) + ' ' + gt + ' ' + fmt(a[p].value) + ' breaks the rule ' + rule + ', so they must trade places.'
                  : 'The rule ' + rule + ' already holds (' + fmt(a[p].value) + ' is not ' + (kind === 'max' ? 'smaller' : 'larger') + ' than ' + fmt(a[pos].value) + '), so the climb stops here.') });
        if (!wins) {
          var m2 = {}; m2[pos] = 'key';
          snap('settle', { mark: m2, pointers: [ptr('i', pos, 'key')], line: 'stop', flow: 'up:done', vars: { i: pos, 'a[i]': a[pos].value },
            caption: b(a[pos]) + ' settles at index ' + pos + '. Every parent is ' + (kind === 'max' ? '≥' : '≤') + ' its children again, and nothing outside this one path was touched.' });
          return pos;
        }
        var t = a[pos]; a[pos] = a[p]; a[p] = t; ops.swaps++;
        var m3 = {}; m3[p] = 'key'; m3[pos] = 'swap';
        snap('swap', { mark: m3, edges: [[p, pos, 'swap']], pointers: [ptr('i', p, 'key')], line: ['swap', 'move'], flow: 'up:swap', vars: { i: p, 'a[i]': a[p].value },
          caption: 'Swap: ' + b(a[p]) + ' moves up to index ' + p + ', and ' + b(a[pos]) + ' drops to index ' + pos + '. The tree and the array change together.' });
        pos = p;
      }
    };
    function mk(pos, st) { var m = {}; m[pos] = st; return m; }

    /* ---- sift down: the item at pos sinks while a child beats it */
    T.siftDown = function (pos, o) {
      o = o || {};
      var sortPhase = !!o.sortPhase;
      var n = size;
      var start = pos;
      for (;;) {
        var l = left(pos), r = right(pos), hasChild = l < n;
        var vars = { i: pos, n: n, 'a[i]': a[pos].value };
        if (!hasChild) {
          snap('leaf', { mark: mk(pos, 'key'), pointers: [ptr('i', pos, 'key')], line: 'leaf', flow: 'down:done', vars: vars,
            caption: 'Index ' + pos + ' would have children at ' + l + ' and ' + r + ', but ' + (l >= n ? l + ' ≥ n = ' + n + ', so there are none' : 'there are none') + '. It is a leaf, so ' + b(a[pos]) + ' cannot sink further.' });
          return pos;
        }
        var m1 = mk(pos, 'key'); m1[l] = 'compare'; if (r < n) m1[r] = 'compare';
        snap('haschild', { mark: m1, edges: r < n ? [[pos, l, 'compare'], [pos, r, 'compare']] : [[pos, l, 'compare']], pointers: [ptr('i', pos, 'key')], line: ['loop', 'child'], flow: 'down:haschild',
          vars: vars,
          caption: 'Children of index ' + pos + ': ' + l + (r < n ? ' and ' + r : ' only') + '. ' + (r < n ? 'A ' + (kind === 'max' ? 'max' : 'min') + '-heap only needs the parent to beat both, so look for the ' + winWord + ' child first.' : 'Only a left child exists, so it is the one to check.') });
        var c = l;
        if (r < n) {
          ops.comparisons++;
          if (beats(a[r], a[l])) c = r;
          var mp = mk(pos, 'key'); mp[l] = c === l ? 'compare' : 'default'; mp[r] = c === r ? 'compare' : 'default'; mp[c] = 'compare';
          snap('pick', { mark: mp, edges: [[pos, c, 'compare']], pointers: [ptr('i', pos, 'key'), ptr('c', c, 'compare')], line: 'pick', flow: 'down:pick',
            vars: { i: pos, c: c, 'a[i]': a[pos].value, 'a[c]': a[c].value },
            caption: 'Compare the children: ' + b(a[l]) + ' (index ' + l + ') against ' + b(a[r]) + ' (index ' + r + '). The ' + winWord + ' one, ' + b(a[c]) + ', is the candidate. It must be the one to move up: if the other child moved up, it would sit above a ' + winWord + ' sibling and break the rule.' });
        } else {
          snap('pick', { mark: (function () { var q = mk(pos, 'key'); q[l] = 'compare'; return q; }()), edges: [[pos, l, 'compare']], pointers: [ptr('i', pos, 'key'), ptr('c', l, 'compare')], line: 'pick', flow: 'down:pick',
            vars: { i: pos, c: l, 'a[i]': a[pos].value, 'a[c]': a[l].value },
            caption: 'Only one child, ' + b(a[l]) + ' at index ' + l + ', so it is the candidate. No comparison between siblings is needed.' });
        }
        ops.comparisons++;
        var wins = beats(a[c], a[pos]);
        var m2 = mk(pos, 'key'); m2[c] = 'compare';
        snap('compare', { mark: m2, edges: [[pos, c, 'compare']], pointers: [ptr('i', pos, 'key'), ptr('c', c, 'compare')], line: 'cmp', flow: 'down:cmp',
          vars: { i: pos, c: c, 'a[i]': a[pos].value, 'a[c]': a[c].value },
          caption: 'Compare ' + b(a[pos]) + ' with its ' + winWord + ' child ' + b(a[c]) + '. ' +
            (wins ? fmt(a[c].value) + ' ' + gt + ' ' + fmt(a[pos].value) + ' would sit below the root of its own subtree, which breaks ' + rule + ', so swap.'
                  : fmt(a[pos].value) + ' already beats or ties both children, so the rule holds and the sinking stops. Equal values never swap.') });
        if (!wins) {
          snap('settle', { mark: mk(pos, 'key'), pointers: [ptr('i', pos, 'key')], line: 'stop', flow: 'down:done', vars: { i: pos, 'a[i]': a[pos].value },
            caption: b(a[pos]) + ' settles at index ' + pos + '. ' + (pos === start ? 'It did not have to move at all.' : 'It sank ' + plural(levelOf(pos) - levelOf(start), 'level') + '.') });
          return pos;
        }
        var t = a[pos]; a[pos] = a[c]; a[c] = t; ops.swaps++;
        var m3 = mk(c, 'key'); m3[pos] = 'swap';
        snap('swap', { mark: m3, edges: [[pos, c, 'swap']], pointers: [ptr('i', c, 'key')], line: ['swap', 'move'], flow: 'down:swap', vars: { i: c, n: n, 'a[i]': a[c].value },
          caption: 'Swap: ' + b(a[c]) + ' moves down to index ' + c + ', and its ' + winWord + ' child ' + b(a[pos]) + ' moves up to index ' + pos + '. Now the subtree on the other side is untouched, and still valid.' });
        pos = c;
      }
    };

    /* ---- whole operations */
    T.insert = function (value, o) {
      o = o || {};
      var it = { id: o.id !== undefined ? o.id : T.nextId('n'), value: value };
      if (o.intro !== false) {
        snap('start', { caption: 'A ' + (kind === 'max' ? 'max' : 'min') + '-heap of ' + plural(size, 'value') + '. To insert <b>' + fmt(value) + '</b>, first keep the tree complete: the new value must go in the first free slot.',
          line: null, flow: null, vars: { n: size, x: value } });
      }
      a.splice(size, 0, it); size++;
      ops.writes++;
      snap('place', { mark: mk(size - 1, 'key'), pointers: [ptr('i', size - 1, 'key')], line: 'place', flow: 'up:place', vars: { n: size, i: size - 1, x: value },
        edges: size > 1 ? [[parent(size - 1), size - 1, 'compare']] : [],
        caption: 'Put <b>' + fmt(value) + '</b> at index ' + (size - 1) + ', the end of the array and the next open slot of the last tree level. The shape stays complete, but the new value may break the rule ' + rule + ' with its parent.' });
      T.siftUp(size - 1);
      snap('done', { mark: {}, line: null, flow: 'up:done', vars: { n: size },
        caption: 'Done: <b>' + fmt(value) + '</b> is in. So far ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + '. A heap of ' + size + ' values is at most ' + plural(height(size), 'level') + ' tall, so an insert never costs more than that many swaps.' });
      return it;
    };

    T.peek = function () {
      if (!size) { snap('empty', { caption: 'The heap is empty, so there is no ' + (kind === 'max' ? 'maximum' : 'minimum') + ' to look at.' }); return null; }
      snap('peek', { mark: mk(0, 'found'), pointers: [ptr('top', 0, 'found')], line: null, flow: null, vars: { n: size, top: a[0].value },
        caption: '<b>peek</b>: the ' + (kind === 'max' ? 'largest' : 'smallest') + ' value is always at index 0, the root, because every path down from it can only ' + (kind === 'max' ? 'shrink' : 'grow') + '. Reading it costs one step, whatever the size of the heap.' });
      return a[0];
    };

    T.extract = function (o) {
      o = o || {};
      if (!size) { snap('empty', { caption: 'The heap is empty, so there is nothing to extract.' }); return null; }
      var top = a[0];
      var noun = kind === 'max' ? 'largest' : 'smallest';
      snap('take', { mark: mk(0, 'found'), pointers: [ptr('top', 0, 'found')], line: 'take', flow: null, vars: { n: size, top: top.value },
        caption: 'The ' + noun + ' value, <b>' + fmt(top.value) + '</b>, is the root. That is the one to return. Removing it leaves a hole at the top, but the tree may only lose its <em>last</em> slot.' });
      if (size === 1) {
        size = 0; a.pop();
        snap('done', { line: 'ret', flow: null, vars: { n: 0, top: top.value }, caption: 'It was the only value, so the heap is now empty. Returned <b>' + fmt(top.value) + '</b>.' });
        return top;
      }
      var last = a[size - 1];
      var t = a[0]; a[0] = a[size - 1]; a[size - 1] = t; ops.writes++;
      size--;
      var m = mk(0, 'key'); m[size] = 'found';
      snap('lift', { mark: m, pointers: [ptr('i', 0, 'key')], line: 'lift', flow: 'down:start', vars: { n: size, top: top.value, i: 0 },
        caption: 'Lift the last value, <b>' + fmt(last.value) + '</b>, up to the root to fill the hole, and shrink the heap by one. The shape is complete again, but ' + fmt(last.value) + ' is probably too ' + (kind === 'max' ? 'small' : 'large') + ' for the top. <b>' + fmt(top.value) + '</b> waits outside the heap to be returned.',
        heapLabel: 'heap' });
      outHold = { pos: size, state: 'found' };
      T.siftDown(0);
      outHold = null;
      if (o.keepOut) return top;
      a.pop();
      snap('done', { line: 'ret', flow: 'down:done', vars: { n: size, top: top.value },
        caption: 'Return <b>' + fmt(top.value) + '</b>. The heap has ' + plural(size, 'value') + ' and its new ' + noun + ' is <b>' + (size ? fmt(a[0].value) : '–') + '</b>. This extract cost ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + ' so far.' });
      return top;
    };


    T.sortPhase = function () {
      var n = size;
      var firstLeaf = n >> 1;
      snap('sortStart', { line: null, flow: null, vars: { n: n },
        caption: 'The max-heap is built: the largest value, <b>' + (n ? fmt(a[0].value) : '–') + '</b>, is at the root. Now repeat: swap the root with the last heap slot (its final place), shrink the heap, and sift the new root down.' });
      for (var end = n - 1; end > 0; end--) {
        var m = mk(0, 'compare'); m[end] = 'compare';
        snap('sfor', { mark: m, pointers: [ptr('end', end, 'compare')], line: 'sfor', flow: null, vars: { end: end, n: end + 1 },
          caption: 'The largest value left, <b>' + fmt(a[0].value) + '</b>, is at the root. The last slot of the heap is index ' + end + ', holding <b>' + fmt(a[end].value) + '</b>. Swap them.' });
        var t = a[0]; a[0] = a[end]; a[end] = t; ops.swaps++;
        size = end;
        var m2 = mk(0, 'key'); m2[end] = 'done';
        snap('sswap', { mark: m2, pointers: [ptr('end', end, 'done')], line: 'sswap', flow: null, vars: { end: end, n: end },
          caption: '<b>' + fmt(a[end].value) + '</b> is in its final place at index ' + end + ': everything left in the heap is ≤ it, so it can never move again. The heap shrinks to ' + plural(end, 'value') + ', and ' + fmt(a[0].value) + ' at the root is probably too small.' });
        T.siftDown(0, { sortPhase: true });
      }
      size = 0;
      snap('done', { line: null, flow: null, vars: { n: 0 },
        caption: n ? 'Sorted: the heap shrank to nothing and the array reads in order. In total ' + plural(ops.comparisons, 'comparison') + ' and ' + plural(ops.swaps, 'swap') + ', with no extra array.' : 'Nothing to sort.' });
    };

    return T;
  }

  /* makeTracer adds two hooks used by the bottom-up build: a tint map (positions that are already finished
     sub-heaps show as 'visited' unless the step marks them itself) and a stamp function (per-height work). */
  function makeTracer(cfg) {
    var base = null, stamp = null;
    var userDecorate = cfg && cfg.decorate;
    var T = tracer(Object.assign({}, cfg, {
      decorate: function (step, k, o) {
        if (base) Object.keys(base).forEach(function (key) {
          var pos = +key;
          if (pos < step.size && step.items[pos].state === 'default') step.items[pos].state = base[key];
        });
        if (stamp) stamp(step);
        if (userDecorate) userDecorate(step, k, o);
      }
    }));
    T.setBase = function (m) { base = m; };
    T.setStamp = function (f) { stamp = f; };
    return T;
  }

  /* ------------------------------------------------------------------ public operations */
  function itemsOf(T) { return T.items().slice(0, T.size()).map(function (it) { return Object.assign({}, it); }); }
  function optsOf(o) { return o || {}; }

  function insert(items, value, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: items, kind: opts.kind, prefix: opts.prefix, uid: opts.uid });
    T.insert(value, { id: opts.id });
    return { steps: T.steps, items: itemsOf(T) };
  }
  function extract(items, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: items, kind: opts.kind, prefix: opts.prefix });
    var top = T.extract();
    return { steps: T.steps, items: itemsOf(T), value: top ? top.value : null };
  }
  /* one resting snapshot of a heap (a lab's idle state) */
  function snapshot(items, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: items, kind: opts.kind, prefix: opts.prefix });
    T.snap('idle', { caption: opts.caption || '', mark: opts.mark || {}, line: null, flow: null, vars: opts.vars || { n: T.size() } });
    return { steps: T.steps, items: itemsOf(T) };
  }
  function peek(items, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: items, kind: opts.kind, prefix: opts.prefix });
    T.peek();
    return { steps: T.steps, items: itemsOf(T) };
  }
  function build(values, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: values, kind: opts.kind, prefix: opts.prefix });
    buildInto(T);
    return { steps: T.steps, items: itemsOf(T) };
  }
  /* Bottom-up build on a tracer whose items are the loose array. Every step carries byHeight: swaps so far,
     grouped by the height of the node being sifted (0 = leaves), for the per-level work figure. */
  function buildInto(T) {
    var n = T.size(), firstLeaf = n >> 1;
    var done = {}, curH = null, before = 0;
    function copyOf(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
    T.setStamp(function (step) {
      var bh = copyOf(done);
      if (curH !== null && step.kind !== 'done') bh[curH] = (bh[curH] || 0) + (step.ops.swaps - before);
      step.byHeight = bh; step.firstLeaf = firstLeaf;
    });
    var leaves = {}; for (var p = firstLeaf; p < n; p++) leaves[p] = 'visited';
    T.setBase(leaves);
    T.snap('start', {
      line: null, flow: null, vars: { n: n },
      caption: n < 2 ? 'A heap of ' + plural(n, 'value') + ' is already valid.' :
        'Read the array as a complete tree, in any order. The <b>' + (n - firstLeaf) + ' leaves</b> (indices ' + firstLeaf + ' to ' + (n - 1) + ') are one-node heaps already, so they need no work. Start at the last node that has a child, index ' + (firstLeaf - 1) + ', and work backwards.'
    });
    for (var i = firstLeaf - 1; i >= 0; i--) {
      var h = height(n) - levelOf(i);
      var finished = {}; for (var q = i + 1; q < n; q++) finished[q] = 'visited';
      T.setBase(finished);
      curH = h; before = T.ops.swaps;
      T.snap('bfor', { mark: mk1(i, 'key'), pointers: [T.ptr('i', i, 'key')], line: 'bfor', flow: null, vars: { i: i, n: n, height: h },
        caption: 'Index <b>' + i + '</b>' + (i === 0 ? ', the root,' : '') + ' is ' + (h === 0 ? 'at height 0' : plural(h, 'level') + ' above the leaves') + '. Both of its subtrees are already valid heaps, so only <b>' + fmt(T.items()[i].value) + '</b> can be out of place. Sift it down.' });
      T.siftDown(i);
      done[h] = (done[h] || 0) + (T.ops.swaps - before);
      curH = null;
    }
    T.setBase(null);
    T.snap('done', { line: null, flow: 'down:done', vars: { n: n },
      caption: n < 2 ? 'Nothing to do.' : 'Done: every parent beats its children. That took ' + plural(T.ops.comparisons, 'comparison') + ' and ' + plural(T.ops.swaps, 'swap') + ' for ' + plural(n, 'value') + '. Sifting down from the bottom is cheap because half the nodes are leaves (no work), a quarter can sink one level, an eighth two levels, and so on.' });
    T.setStamp(null);
    return T;
  }
  /* number of nodes at each height h (0 = leaves) in an n-node heap */
  function nodesAtHeight(n) {
    var byH = {};
    for (var i = 0; i < n; i++) {
      var hh = 0, j = i;
      while (left(j) < n) { j = left(j); hh++; }
      byH[hh] = (byH[hh] || 0) + 1;
    }
    return byH;
  }
  /* most swaps a bottom-up build can spend at each height: (nodes at that height) × height */
  function maxWork(n) {
    var out = {}, nh = nodesAtHeight(n);
    Object.keys(nh).forEach(function (hh) { out[hh] = nh[hh] * hh; });
    return out;
  }

  function mk1(pos, st) { var m = {}; m[pos] = st; return m; }
  function buildByInsert(values, opts) {
    opts = optsOf(opts);
    var vals = normalize(values, opts.prefix);
    var T = makeTracer({ items: [], kind: opts.kind, prefix: opts.prefix });
    vals.forEach(function (v) { T.insert(v.value, { id: v.id, intro: false }); });
    return { steps: T.steps, items: itemsOf(T) };
  }

  /* several operations in one trace (hero teaser and demos): [{op: 'insert', value}, {op: 'extract'}, {op: 'peek'}] */
  function chain(initial, ops, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: initial, kind: opts.kind, prefix: opts.prefix, uid: 1000 });
    (ops || []).forEach(function (o) {
      if (o.op === 'insert') T.insert(o.value, { intro: opts.intro !== false });
      else if (o.op === 'extract') T.extract();
      else if (o.op === 'peek') T.peek();
    });
    return { steps: T.steps, items: itemsOf(T) };
  }

  function decreaseKey(items, pos, value, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: items, kind: opts.kind, prefix: opts.prefix });
    var a = T.items();
    if (pos < 0 || pos >= a.length) throw new Error('No such index: ' + pos);
    var old = a[pos].value, better = opts.kind === 'max' ? value >= old : value <= old;
    if (!better) throw new Error('The new key must ' + (opts.kind === 'max' ? 'not be smaller' : 'not be larger') + ' than the old one.');
    T.snap('start', { mark: mk1(pos, 'active'), pointers: [T.ptr('i', pos, 'active')], vars: { i: pos, 'a[i]': old },
      caption: 'A task at index ' + pos + ' just became more urgent: its key drops from <b>' + fmt(old) + '</b> to <b>' + fmt(value) + '</b>. Only its own parent can now be wrong, so the repair is a sift-up.' });
    a[pos] = Object.assign({}, a[pos], { value: value });
    T.snap('change', { mark: mk1(pos, 'key'), pointers: [T.ptr('i', pos, 'key')], line: null, flow: 'up:place', vars: { i: pos, 'a[i]': value },
      caption: 'Overwrite the key in place. The node keeps its identity and its slot, but its value may now beat its parent.' });
    T.siftUp(pos);
    T.snap('done', { line: null, flow: 'up:done', vars: {}, caption: 'Done: the lowered key climbed as far as it needed to. Note that finding the index <code>pos</code> in the first place is not free: a heap has no search, so real implementations keep a map from item to index.' });
    return { steps: T.steps, items: itemsOf(T) };
  }

  /* ------------------------------------------------------------------ heap sort (sorting.heap) */
  function sort(values, opts) {
    opts = optsOf(opts);
    var T = makeTracer({ items: normalize(values, opts.idPrefix || 'v'), kind: 'max', outState: 'done', algo: 'heap' });
    var n = T.size();
    if (!n) { T.snap('done', { caption: 'Nothing to sort.' }); return T.steps; }
    buildInto(T);
    T.sortPhase();
    // mark the phase and round on each step
    var phase = 'build';
    T.steps.forEach(function (s) {
      if (s.kind === 'sortStart') phase = 'sort';
      s.phase = phase;
      s.round = 0;
    });
    return T.steps;
  }

  /* ------------------------------------------------------------------ fast counters (no steps) */
  function cSiftDown(a, i, n, kind, c) {
    for (;;) {
      var l = 2 * i + 1;
      if (l >= n) return;
      var m = l;
      if (l + 1 < n) { c.comparisons++; if (kind === 'max' ? a[l + 1] > a[l] : a[l + 1] < a[l]) m = l + 1; }
      c.comparisons++;
      if (kind === 'max' ? a[m] > a[i] : a[m] < a[i]) { var t = a[i]; a[i] = a[m]; a[m] = t; c.swaps++; i = m; } else return;
    }
  }
  function cSiftUp(a, i, kind, c) {
    while (i > 0) {
      var p = (i - 1) >> 1;
      c.comparisons++;
      if (kind === 'max' ? a[i] > a[p] : a[i] < a[p]) { var t = a[i]; a[i] = a[p]; a[p] = t; c.swaps++; i = p; } else return;
    }
  }
  var count = {
    buildBottomUp: function (values, kind) {
      var a = values.slice(), c = { comparisons: 0, swaps: 0 };
      for (var i = (a.length >> 1) - 1; i >= 0; i--) cSiftDown(a, i, a.length, kind || 'min', c);
      return c;
    },
    buildByInsert: function (values, kind) {
      var a = [], c = { comparisons: 0, swaps: 0 };
      values.forEach(function (v) { a.push(v); cSiftUp(a, a.length - 1, kind || 'min', c); });
      return c;
    },
    sort: function (values) {
      var a = values.slice(), n = a.length, c = { comparisons: 0, swaps: 0 };
      for (var i = (n >> 1) - 1; i >= 0; i--) cSiftDown(a, i, n, 'max', c);
      for (var end = n - 1; end > 0; end--) { var t = a[0]; a[0] = a[end]; a[end] = t; c.swaps++; cSiftDown(a, 0, end, 'max', c); }
      return { comparisons: c.comparisons, swaps: c.swaps, shifts: 0, writes: 2 * c.swaps, rounds: Math.max(0, n - 1) };
    }
  };

  /* ------------------------------------------------------------------ top-k over a stream */
  function topK(stream, k, opts) {
    opts = optsOf(opts);
    var S = normalize(stream, 's');
    var inHeap = {}, dropped = {}, cur = -1, finalAll = false;
    var T;
    function streamItems() {
      return S.map(function (it, idx) {
        var st = 'default';
        if (dropped[it.id]) st = 'muted';
        else if (inHeap[it.id]) st = finalAll ? 'done' : 'frontier';
        if (idx === cur) st = 'key';
        return { id: it.id, value: it.value, state: st };
      });
    }
    T = makeTracer({ items: [], kind: 'min', prefix: 's', decorate: function (step) {
      step.stream = { items: streamItems(), next: cur };
      step.k = k;
      if (finalAll) step.items.forEach(function (it) { it.state = 'done'; });
    } });
    var a = T.items();
    if (k < 1) throw new Error('k must be at least 1');
    T.snap('start', { line: null, vars: { k: k, size: 0 }, caption: 'A stream of ' + plural(S.length, 'value') + ' will flow past, one at a time. Keep a <b>min-heap of size ' + k + '</b>: its root is the smallest of the ' + k + ' largest values seen so far, which makes it the bar a newcomer must clear.' });
    S.forEach(function (it, idx) {
      cur = idx;
      var full = T.size() >= k;
      var base = { k: k, size: T.size(), x: it.value };
      if (!full) {
        T.snap('next', { line: null, vars: base, caption: 'Next value: <b>' + fmt(it.value) + '</b>. The heap holds ' + T.size() + ' of ' + k + ' so far, so there is room: push it in.' });
        a.splice(T.size(), 0, { id: it.id, value: it.value }); T.setSize(T.size() + 1);
        inHeap[it.id] = true;
        T.ops.writes++;
        T.snap('place', { mark: mk1(T.size() - 1, 'key'), pointers: [T.ptr('i', T.size() - 1, 'key')], line: null, flow: null, vars: base,
          caption: 'Append <b>' + fmt(it.value) + '</b> at index ' + (T.size() - 1) + ' and sift it up to restore the rule parent ≤ child.' });
        T.siftUp(T.size() - 1);
      } else {
        T.snap('next', { mark: mk1(0, 'compare'), pointers: [T.ptr('top', 0, 'compare')], line: null, vars: base,
          caption: 'Next value: <b>' + fmt(it.value) + '</b>. The heap is full, and its root <b>' + fmt(a[0].value) + '</b> is the smallest of the current top ' + k + '. Can the newcomer beat it?' });
        T.ops.comparisons++;
        if (it.value > a[0].value) {
          var old = a[0];
          T.snap('compare', { mark: mk1(0, 'compare'), pointers: [T.ptr('top', 0, 'compare')], line: null, vars: base,
            caption: fmt(it.value) + ' &gt; ' + fmt(old.value) + ': the newcomer belongs in the top ' + k + ' and the old root does not. Evict the root.' });
          dropped[old.id] = true; delete inHeap[old.id]; inHeap[it.id] = true;
          a[0] = { id: it.id, value: it.value }; T.ops.writes++;
          T.snap('replace', { mark: mk1(0, 'key'), pointers: [T.ptr('i', 0, 'key')], line: null, vars: base,
            caption: '<b>' + fmt(old.value) + '</b> leaves; <b>' + fmt(it.value) + '</b> takes the root slot directly (no need to remove and insert separately). It may be too big for the top of a min-heap, so sift it down.' });
          T.siftDown(0);
        } else {
          dropped[it.id] = true;
          T.snap('discard', { mark: mk1(0, 'compare'), pointers: [T.ptr('top', 0, 'compare')], line: null, vars: base,
            caption: fmt(it.value) + ' ≤ ' + fmt(a[0].value) + ': at least ' + k + ' values already beat it, so it can never be in the top ' + k + '. Discarded after one comparison; the heap did not change.' });
        }
      }
    });
    cur = -1; finalAll = true;
    var res = a.slice(0, T.size()).map(function (x) { return x.value; }).sort(function (x, y) { return y - x; });
    T.snap('done', { line: null, vars: { k: k, size: T.size() },
      caption: 'The stream is over. The heap holds the ' + k + ' largest values: <b>' + res.map(fmt).join(', ') + '</b>. That took at most one heap operation per value, O(log ' + k + ') each, and memory for only ' + k + ' values, however long the stream.' });
    return T.steps;
  }

  /* ------------------------------------------------------------------ merging k sorted lists */
  var LIST_NAMES = ['A', 'B', 'C', 'D', 'E'];
  function mergeK(lists, opts) {
    opts = optsOf(opts);
    var L = lists.map(function (l) { return l.slice(); });
    var K = L.length, total = L.reduce(function (s, l) { return s + l.length; }, 0);
    var head = L.map(function () { return 0; });         // index of each list's head
    var out = [];                                        // {id, value, from}
    var inHeap = {};
    function cid(r, i) { return LIST_NAMES[r] + i; }
    function rowsState(activeRow) {
      var rows = L.map(function (l, r) {
        return {
          id: 'L' + r, label: 'list ' + LIST_NAMES[r],
          items: l.map(function (v, i) {
            var st = 'default';
            if (i < head[r]) st = 'muted';
            else if (i === head[r]) st = 'frontier';
            if (r === activeRow && i === head[r] - 1) st = 'done';
            return { id: cid(r, i), value: v, state: st };
          }),
          pointers: head[r] < l.length ? [{ name: 'head', index: head[r], state: 'frontier', id: 'hd' + r }] : [],
          length: l.length
        };
      });
      rows.push({ id: 'out', label: 'merged', length: total, items: out.map(function (o, k) { return { id: 'o' + k, value: o.value, state: 'done', from: o.from }; }) });
      return rows;
    }
    var activeRow = -1;
    var T = makeTracer({ items: [], kind: 'min', prefix: 'H', decorate: function (step) {
      step.rows = rowsState(activeRow);
      step.total = total; step.k = K; step.outCount = out.length;
      step.items.forEach(function (it) { var src = T.items().filter(function (x) { return x.id === it.id; })[0]; if (src && src.list !== undefined) it.label = LIST_NAMES[src.list]; });
    } });
    var a = T.items();
    function headItem(r) { return { id: 'H' + cid(r, head[r]), value: L[r][head[r]], list: r, sub: LIST_NAMES[r] }; }
    T.snap('start', { line: null, vars: { k: K, out: 0 }, caption: 'Merge ' + K + ' sorted lists into one sorted list. Only the <b>first unused value of each list</b> can be the next output, so a min-heap of those ' + K + ' heads always exposes it.' });
    for (var r = 0; r < K; r++) {
      if (!L[r].length) continue;
      var it = headItem(r);
      a.splice(T.size(), 0, it); T.setSize(T.size() + 1); inHeap[it.id] = true;
      T.snap('place', { mark: mk1(T.size() - 1, 'key'), pointers: [T.ptr('i', T.size() - 1, 'key')], line: null, vars: { k: K, out: 0 },
        caption: 'Push the head of list ' + LIST_NAMES[r] + ', <b>' + fmt(it.value) + '</b>, into the heap.' });
      T.siftUp(T.size() - 1);
    }
    while (T.size() > 0) {
      var top = a[0], r0 = top.list;
      out.push({ value: top.value, from: cid(r0, head[r0]) });
      activeRow = r0;
      head[r0]++;
      T.snap('take', { mark: mk1(0, 'found'), pointers: [T.ptr('top', 0, 'found')], line: null, vars: { out: out.length, root: top.value },
        caption: 'The root is the smallest head: <b>' + fmt(top.value) + '</b> from list ' + LIST_NAMES[r0] + '. Every other value, in the heap or still waiting in a list, is at least this big, so it is next in the output.' });
      if (head[r0] < L[r0].length) {
        var nx = headItem(r0);
        a[0] = nx; T.ops.writes++;
        T.snap('replace', { mark: mk1(0, 'key'), pointers: [T.ptr('i', 0, 'key')], line: null, vars: { out: out.length },
          caption: 'List ' + LIST_NAMES[r0] + ' offers its next value, <b>' + fmt(nx.value) + '</b>, which takes the root slot. It may be too large for the top, so sift it down.' });
        T.siftDown(0);
      } else {
        var lastIt = a[T.size() - 1];
        if (T.size() === 1) { a.pop(); T.setSize(0); T.snap('exhaust', { line: null, vars: { out: out.length }, caption: 'List ' + LIST_NAMES[r0] + ' is used up and the heap is empty.' }); }
        else {
          a[0] = lastIt; a.pop(); T.setSize(T.size() - 1); T.ops.writes++;
          T.snap('exhaust', { mark: mk1(0, 'key'), pointers: [T.ptr('i', 0, 'key')], line: null, vars: { out: out.length },
            caption: 'List ' + LIST_NAMES[r0] + ' is used up, so the heap shrinks: its last node fills the root and sifts down.' });
          T.siftDown(0);
        }
      }
    }
    activeRow = -1;
    T.snap('done', { line: null, vars: { out: out.length }, caption: 'All ' + total + ' values are merged in order. The heap never held more than ' + K + ' values, so each output value cost O(log ' + K + ') instead of a scan of all ' + K + ' heads.' });
    return T.steps;
  }

  /* ------------------------------------------------------------------ priority queue implementations */
  function pqRun(kind, initial, ops) {
    var vals = normalize(initial, 'p');
    var pre = kind === 'unsorted' ? 'u' : kind === 'sorted' ? 's' : 'h';
    vals = vals.map(function (v, i) { return { id: pre + i, value: v.value }; });
    var uidn = vals.length;
    var steps = [];
    var opIndex = -1;
    var cost = 0, cmp = 0;
    var opLabel = '';
    var a;
    if (kind === 'sorted') a = vals.slice().sort(function (x, y) { return y.value - x.value; });     // descending: minimum at the end
    else if (kind === 'heap') { var t0 = makeTracer({ items: vals, kind: 'min', prefix: pre }); buildInto(t0); a = itemsOf(t0); }
    else a = vals.slice();
    function snap(k, o) {
      o = o || {};
      var mark = o.mark || {};
      steps.push({
        algo: 'pq-' + kind, kind: k, opIndex: opIndex, opLabel: opLabel,
        items: a.map(function (it, pos) { return { id: it.id, value: it.value, state: mark[pos] || 'default' }; }),
        order: a.map(function (it) { return it.id; }), size: a.length, pointers: o.pointers || [], regions: o.regions || [], edges: o.edges || [], final: [],
        caption: o.caption || '', line: null, flow: null, vars: {}, counters: { cost: cost }, ops: { comparisons: cmp, swaps: 0, shifts: 0, writes: 0 }, touched: o.touched || []
      });
    }
    (ops || []).forEach(function (op, oi) {
      opIndex = oi;
      if (op.op === 'insert') {
        opLabel = 'insert ' + fmt(op.value);
        var id = pre + (uidn++);
        if (kind === 'unsorted') {
          a.push({ id: id, value: op.value }); cost++;
          snap('insert', { mark: mk1(a.length - 1, 'key'), touched: [a.length - 1], caption: 'Unsorted array: append <b>' + fmt(op.value) + '</b> at the end. One write, whatever the size: cost 1.' });
        } else if (kind === 'sorted') {
          a.push({ id: id, value: op.value }); cost++;
          var pos = a.length - 1;
          snap('insert', { mark: mk1(pos, 'key'), touched: [pos], caption: 'Sorted array (largest first): the new value <b>' + fmt(op.value) + '</b> lands at the end, then walks left to its place.' });
          var touchedS = [pos];
          while (pos > 0) {
            cost++; cmp++;
            var wins = a[pos - 1].value < op.value;
            var m = mk1(pos, 'key'); m[pos - 1] = 'compare'; touchedS.push(pos - 1);
            snap('compare', { mark: m, touched: touchedS.slice(), caption: 'Compare with the left neighbour <b>' + fmt(a[pos - 1].value) + '</b>: ' + (wins ? 'it is smaller, so it must slide right to make room (cost so far ' + cost + ').' : 'it is not smaller, so this is the place.') });
            if (!wins) break;
            cost++;
            var t = a[pos]; a[pos] = a[pos - 1]; a[pos - 1] = t;
            var m2 = mk1(pos - 1, 'key'); m2[pos] = 'swap';
            pos--;
            snap('shift', { mark: m2, touched: touchedS.slice(), caption: 'Shift: <b>' + fmt(a[pos + 1].value) + '</b> moves one slot right (cost so far ' + cost + ').' });
          }
          snap('done', { mark: mk1(pos, 'key'), touched: touchedS, caption: 'Placed. Insert cost ' + cost + ' in total so far: on average about half the array moves.' });
        } else {
          var T = makeTracer({ items: a, kind: 'min', prefix: pre, uid: uidn });
          T.insert(op.value, { id: id, intro: false });
          var base = cost;
          var touchedH = {};
          T.steps.forEach(function (s) {
            s.items.forEach(function (it, p) { if (it.state !== 'default' && it.state !== 'muted') touchedH[p] = true; });
            s.opIndex = opIndex; s.opLabel = opLabel; s.algo = 'pq-heap';
            s.counters = { cost: base + s.ops.comparisons + s.ops.swaps + s.ops.writes };
            s.touched = Object.keys(touchedH).map(Number);
            steps.push(s);
          });
          cost = base + T.ops.comparisons + T.ops.swaps + T.ops.writes; cmp += T.ops.comparisons;
          a = itemsOf(T);
        }
      } else {
        opLabel = 'extract-min';
        if (!a.length) { snap('empty', { caption: 'Nothing to extract: the queue is empty.' }); return; }
        if (kind === 'unsorted') {
          var best = 0, seen = [0];
          snap('scan', { mark: mk1(0, 'key'), pointers: [{ name: 'i', index: 0, state: 'compare' }], touched: [0], caption: 'Unsorted array: the minimum could be anywhere, so every value must be looked at. Start by holding <b>' + fmt(a[0].value) + '</b>.' });
          for (var j = 1; j < a.length; j++) {
            cost++; cmp++; seen.push(j);
            if (a[j].value < a[best].value) best = j;
            var mm = mk1(best, 'key'); if (j !== best) mm[j] = 'compare';
            snap('scan', { mark: mm, pointers: [{ name: 'i', index: j, state: 'compare' }], touched: seen.slice(), caption: 'Compare <b>' + fmt(a[j].value) + '</b> with the smallest so far, <b>' + fmt(a[best].value) + '</b> (cost so far ' + cost + ').' });
          }
          var last = a.length - 1, tt = a[best]; a[best] = a[last]; a[last] = tt; cost++;
          var mo = mk1(last, 'found');
          snap('remove', { mark: mo, touched: seen.slice(), caption: 'The minimum <b>' + fmt(a[last].value) + '</b> swaps with the last slot and is removed. Every extract scans all n values: cost about n (' + cost + ' so far).' });
          a.pop();
          snap('done', { touched: seen.slice(), caption: 'Extracted. This operation touched all the cells it started with.' });
        } else if (kind === 'sorted') {
          cost++;
          var lastS = a.length - 1;
          snap('remove', { mark: mk1(lastS, 'found'), touched: [lastS], caption: 'Sorted array (largest first): the minimum is the last cell. Pop it: cost 1.' });
          a.pop();
          snap('done', { touched: [lastS], caption: 'Extracted in one step.' });
        } else {
          var T2 = makeTracer({ items: a, kind: 'min', prefix: pre, uid: uidn });
          T2.extract();
          var base2 = cost, touchedE = {};
          T2.steps.forEach(function (s) {
            s.items.forEach(function (it, p) { if (it.state !== 'default' && it.state !== 'muted') touchedE[p] = true; });
            s.opIndex = opIndex; s.opLabel = opLabel; s.algo = 'pq-heap';
            s.counters = { cost: base2 + s.ops.comparisons + s.ops.swaps + s.ops.writes };
            s.touched = Object.keys(touchedE).map(Number);
            steps.push(s);
          });
          cost = base2 + T2.ops.comparisons + T2.ops.swaps + T2.ops.writes; cmp += T2.ops.comparisons;
          a = itemsOf(T2);
        }
      }
    });
    return steps;
  }
  /* One frame per operation for the three implementations side by side. */
  function pqFrames(initial, ops) {
    var kinds = ['unsorted', 'sorted', 'heap'];
    var runs = {};
    kinds.forEach(function (k) { runs[k] = pqRun(k, initial, ops); });
    var base = {};
    kinds.forEach(function (k) {
      var pre = k === 'unsorted' ? 'u' : k === 'sorted' ? 's' : 'h';
      var a = normalize(initial, 'p').map(function (v, i) { return { id: pre + i, value: v.value }; });
      if (k === 'sorted') a.sort(function (x, y) { return y.value - x.value; });
      if (k === 'heap') { var t0 = makeTracer({ items: a, kind: 'min', prefix: pre }); buildInto(t0); a = itemsOf(t0); }
      base[k] = a;
    });
    var frames = [{ op: null, label: 'start', rows: {}, cost: {}, total: {} }];
    kinds.forEach(function (k) {
      frames[0].rows[k] = base[k].map(function (it) { return { id: it.id, value: it.value, state: 'default' }; });
      frames[0].cost[k] = 0; frames[0].total[k] = 0;
    });
    var prevTotal = { unsorted: 0, sorted: 0, heap: 0 };
    (ops || []).forEach(function (op, oi) {
      var fr = { op: op, label: op.op === 'insert' ? 'insert ' + fmt(op.value) : 'extract-min', rows: {}, cost: {}, total: {}, opIndex: oi };
      kinds.forEach(function (k) {
        var st = runs[k].filter(function (s) { return s.opIndex === oi; });
        var last = st[st.length - 1];
        var touched = {};
        st.forEach(function (s) { (s.touched || []).forEach(function (p) { touched[p] = true; }); });
        // rows show the state AFTER the operation; touched cells are tinted in the state before removal if the
        // array shrank (positions past the end are gone), so tint only existing ones
        fr.rows[k] = last ? last.items.map(function (it, pos) { return { id: it.id, value: it.value, state: touched[pos] ? 'compare' : 'default' }; }) : frames[frames.length - 1].rows[k];
        fr.total[k] = last ? last.counters.cost : prevTotal[k];
        fr.cost[k] = fr.total[k] - prevTotal[k];
        prevTotal[k] = fr.total[k];
        fr.touchedCount = fr.touchedCount || {};
        fr.touchedCount[k] = Object.keys(touched).length;
      });
      frames.push(fr);
    });
    return frames;
  }

  /* insert every value, then extract everything: total cost by implementation (count only) */
  function pqWorkloadCost(kind, values) {
    var n = values.length, cost = 0, i, j;
    if (kind === 'unsorted') {
      for (i = 0; i < n; i++) cost++;                       // appends
      for (var m = n; m >= 1; m--) cost += (m - 1) + 1;     // scan m values, then remove
      return cost;
    }
    if (kind === 'sorted') {
      var a = [];
      values.forEach(function (x) {
        a.push(x); cost++;
        var pos = a.length - 1;
        while (pos > 0) { cost++; if (a[pos - 1] < x) { cost++; a[pos] = a[pos - 1]; a[pos - 1] = x; pos--; } else break; }
      });
      cost += n;                                            // n pops
      return cost;
    }
    var h = [], c = { comparisons: 0, swaps: 0 }, writes = 0;
    values.forEach(function (x) { h.push(x); writes++; cSiftUp(h, h.length - 1, 'min', c); });
    while (h.length) {
      if (h.length === 1) { h.pop(); continue; }
      h[0] = h.pop(); writes++;
      cSiftDown(h, 0, h.length, 'min', c);
    }
    void i; void j;
    return c.comparisons + c.swaps + writes;
  }

  /* ------------------------------------------------------------------ tree snapshot with the same ids */
  function treeState(step, opts) {
    opts = opts || {};
    var n = step.size === undefined ? step.items.length : step.size;
    var showIndex = opts.index !== false;
    var byPos = step.items;
    var nodes = [];
    for (var p = 0; p < n; p++) {
      var it = byPos[p];
      var node = { id: it.id, value: it.value, state: it.state };
      if (it.label !== undefined && opts.label !== false && typeof it.label === 'string' && it.label !== '') node.sub = it.label;
      else if (showIndex) node.sub = String(p);
      if (2 * p + 1 < n) node.left = byPos[2 * p + 1].id;
      if (2 * p + 2 < n) node.right = byPos[2 * p + 2].id;
      nodes.push(node);
    }
    var edges = [];
    (step.edges || []).forEach(function (e) {
      var pa = Math.min(e[0], e[1]), ch = Math.max(e[0], e[1]);
      if (ch < n && byPos[pa] && byPos[ch]) edges.push({ from: byPos[pa].id, to: byPos[ch].id, state: e[2] });
    });
    var pointers = [];
    if (opts.pointers !== false) (step.pointers || []).forEach(function (q) {
      if (q.index !== null && q.index >= 0 && q.index < n && byPos[q.index]) pointers.push({ name: q.name, target: byPos[q.index].id, state: q.state || 'active' });
    });
    var st = { root: n ? byPos[0].id : null, nodes: nodes, edges: edges };
    if (pointers.length) st.pointers = pointers;
    return st;
  }

  return {
    parent: parent, left: left, right: right, height: height, levelOf: levelOf, isHeap: isHeap, normalize: normalize,
    insert: insert, extract: extract, peek: peek, snapshot: snapshot, build: build, buildByInsert: buildByInsert, chain: chain, decreaseKey: decreaseKey,
    sort: sort, topK: topK, mergeK: mergeK, pqRun: pqRun, pqFrames: pqFrames, pqWorkloadCost: pqWorkloadCost,
    count: count, CODE: CODE, CODE_SORT: CODE_SORT, META: META, maxWork: maxWork, nodesAtHeight: nodesAtHeight,
    treeState: treeState, tracer: makeTracer, LIST_NAMES: LIST_NAMES
  };

}));
