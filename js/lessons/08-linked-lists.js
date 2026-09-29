/* Lesson 08 · Linked lists — figure wiring.
   Step generators: js/algos/08-linked-lists.js (VDSA.algos.linkedLists, tested in Node).
   Custom figures:  js/lessons/08-linked-lists-figs.js (VDSA.lessons.ll08figs).
   Everything else draws with VDSA.views.list / array / chart / flowchart. Heavy figures start when they come
   near the viewport (lazy); checks that live inside lazy figures register their ids with the score up front. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var ALG, F;

  /* ------------------------------------------------------------------ helpers */
  /* Figures start when they come near the viewport, and the rest start one per idle slot after load, so the
     page reaches its final height within a moment (no layout shift under a reader who jumps via the contents). */
  var idleQueue = [];
  function lazy(sel, init) {
    var el = V.$(sel);
    if (!el) return;
    var started = false;
    function run() { if (started) return; started = true; try { init(el); } catch (e) { console.error('[lesson 08] ' + sel, e); } }
    idleQueue.push(run);
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '900px 0px' });
    io.observe(el);
  }
  function drainIdle() {
    var ric = window.requestIdleCallback || function (fn) { return setTimeout(function () { fn({ timeRemaining: function () { return 12; }, didTimeout: false }); }, 60); };
    function pump(deadline) {
      while (idleQueue.length && (deadline.didTimeout || deadline.timeRemaining() > 6)) idleQueue.shift()();
      if (idleQueue.length) ric(pump, { timeout: 800 });
    }
    ric(pump, { timeout: 800 });
  }
  /* A list view + player pair whose trace can be replaced (reset + prepare keeps the height stable). */
  function listPlayer(fig, o) {
    var view = V.views.list(fig.querySelector(o.stage || '[data-stage]'), Object.assign({ label: o.label || 'Linked list' }, o.view || {}));
    var player = V.player(Object.assign({
      root: fig,
      steps: o.steps,
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); if (o.onRender) o.onRender(step, ctx); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]') || undefined,
      baseStepMs: o.baseStepMs || 1300,
      label: (o.label || 'Figure') + ' controls'
    }, o.player || {}));
    view.prepare(o.prepare || o.steps);
    player.refresh();
    return {
      view: view, player: player,
      load: function (steps, prepareAlso) { view.reset(); view.prepare(prepareAlso || steps); player.setSteps(steps); }
    };
  }
  function vals(a) { return a.length ? a.join(' → ') + ' → null' : 'null (empty)'; }

  /* ------------------------------------------------------------------ code for the labs */
  var CODE = {
    insertHead: {
      title: 'insertHead',
      pseudo: [
        'function insertHead(list, x)',
        '  node ← new Node(x)          // @alloc',
        '  node.next ← list.head       // @link',
        '  list.head ← node            // @head'].join('\n'),
      js: [
        'function insertHead(list, x) {',
        '  const node = new Node(x);   // @alloc',
        '  node.next = list.head;      // @link',
        '  list.head = node;           // @head',
        '}'].join('\n'),
      py: [
        'def insert_head(lst, x):',
        '    node = Node(x)            # @alloc',
        '    node.next = lst.head      # @link',
        '    lst.head = node           # @head'].join('\n')
    },
    insertAt: {
      title: 'insertAt',
      pseudo: [
        'function insertAt(list, i, x)',
        '  node ← new Node(x)              // @alloc',
        '  if i = 0 then                   // @check0',
        '    node.next ← list.head         // @link0',
        '    list.head ← node              // @head',
        '    return',
        '  prev ← list.head                // @start',
        '  for k ← 1 to i − 1              // @walk',
        '    prev ← prev.next              // @hop',
        '  node.next ← prev.next           // @link',
        '  prev.next ← node                // @splice'].join('\n'),
      js: [
        'function insertAt(list, i, x) {',
        '  const node = new Node(x);           // @alloc',
        '  if (i === 0) {                      // @check0',
        '    node.next = list.head;            // @link0',
        '    list.head = node;                 // @head',
        '    return;',
        '  }',
        '  let prev = list.head;               // @start',
        '  for (let k = 1; k < i; k++) {       // @walk',
        '    prev = prev.next;                 // @hop',
        '  }',
        '  node.next = prev.next;              // @link',
        '  prev.next = node;                   // @splice',
        '}'].join('\n'),
      py: [
        'def insert_at(lst, i, x):',
        '    node = Node(x)                    # @alloc',
        '    if i == 0:                        # @check0',
        '        node.next = lst.head          # @link0',
        '        lst.head = node               # @head',
        '        return',
        '    prev = lst.head                   # @start',
        '    for k in range(1, i):             # @walk',
        '        prev = prev.next              # @hop',
        '    node.next = prev.next             # @link',
        '    prev.next = node                  # @splice'].join('\n')
    },
    appendWalk: {
      title: 'append',
      pseudo: [
        'function append(list, x)',
        '  node ← new Node(x)              // @alloc',
        '  if list.head = null then        // @empty',
        '    list.head ← node              // @head',
        '    return',
        '  curr ← list.head                // @start',
        '  while curr.next ≠ null          // @walk',
        '    curr ← curr.next              // @hop',
        '  curr.next ← node                // @splice'].join('\n'),
      js: [
        'function append(list, x) {',
        '  const node = new Node(x);           // @alloc',
        '  if (list.head === null) {           // @empty',
        '    list.head = node;                 // @head',
        '    return;',
        '  }',
        '  let curr = list.head;               // @start',
        '  while (curr.next !== null) {        // @walk',
        '    curr = curr.next;                 // @hop',
        '  }',
        '  curr.next = node;                   // @splice',
        '}'].join('\n'),
      py: [
        'def append(lst, x):',
        '    node = Node(x)                    # @alloc',
        '    if lst.head is None:              # @empty',
        '        lst.head = node               # @head',
        '        return',
        '    curr = lst.head                   # @start',
        '    while curr.next is not None:      # @walk',
        '        curr = curr.next              # @hop',
        '    curr.next = node                  # @splice'].join('\n')
    },
    appendTail: {
      title: 'append (tail pointer)',
      pseudo: [
        'function append(list, x)',
        '  node ← new Node(x)              // @alloc',
        '  if list.head = null then        // @empty',
        '    list.head ← node              // @head',
        '  else',
        '    list.tail.next ← node         // @splice',
        '  list.tail ← node                // @tail'].join('\n'),
      js: [
        'function append(list, x) {',
        '  const node = new Node(x);           // @alloc',
        '  if (list.head === null) {           // @empty',
        '    list.head = node;                 // @head',
        '  } else {',
        '    list.tail.next = node;            // @splice',
        '  }',
        '  list.tail = node;                   // @tail',
        '}'].join('\n'),
      py: [
        'def append(lst, x):',
        '    node = Node(x)                    # @alloc',
        '    if lst.head is None:              # @empty',
        '        lst.head = node               # @head',
        '    else:',
        '        lst.tail.next = node          # @splice',
        '    lst.tail = node                   # @tail'].join('\n')
    },
    delete: {
      title: 'delete',
      pseudo: [
        'function delete(list, x)',
        '  if list.head = null then        // @empty',
        '    return false                  // @none',
        '  if list.head.value = x then     // @checkHead',
        '    list.head ← list.head.next    // @dropHead',
        '    return true                   // @doneHead',
        '  prev ← list.head                // @start',
        '  while prev.next ≠ null          // @walk',
        '    if prev.next.value = x then   // @cmp',
        '      prev.next ← prev.next.next  // @bypass',
        '      return true                 // @done',
        '    prev ← prev.next              // @hop',
        '  return false                    // @absent'].join('\n'),
      js: [
        'function remove(list, x) {',
        '  if (list.head === null)             // @empty',
        '    return false;                     // @none',
        '  if (list.head.value === x) {        // @checkHead',
        '    list.head = list.head.next;       // @dropHead',
        '    return true;                      // @doneHead',
        '  }',
        '  let prev = list.head;               // @start',
        '  while (prev.next !== null) {        // @walk',
        '    if (prev.next.value === x) {      // @cmp',
        '      prev.next = prev.next.next;     // @bypass',
        '      return true;                    // @done',
        '    }',
        '    prev = prev.next;                 // @hop',
        '  }',
        '  return false;                       // @absent',
        '}'].join('\n'),
      py: [
        'def remove(lst, x):',
        '    if lst.head is None:              # @empty',
        '        return False                  # @none',
        '    if lst.head.value == x:           # @checkHead',
        '        lst.head = lst.head.next      # @dropHead',
        '        return True                   # @doneHead',
        '    prev = lst.head                   # @start',
        '    while prev.next is not None:      # @walk',
        '        if prev.next.value == x:      # @cmp',
        '            prev.next = prev.next.next  # @bypass',
        '            return True               # @done',
        '        prev = prev.next              # @hop',
        '    return False                      # @absent'].join('\n')
    },
    search: {
      title: 'search',
      pseudo: [
        'function search(list, x)',
        '  curr ← list.head                // @start',
        '  i ← 0                           // @start',
        '  while curr ≠ null               // @walk',
        '    if curr.value = x then        // @cmp',
        '      return i                    // @found',
        '    curr ← curr.next              // @hop',
        '    i ← i + 1                     // @hop',
        '  return −1                       // @absent'].join('\n'),
      js: [
        'function search(list, x) {',
        '  let curr = list.head;               // @start',
        '  let i = 0;                          // @start',
        '  while (curr !== null) {             // @walk',
        '    if (curr.value === x) {           // @cmp',
        '      return i;                       // @found',
        '    }',
        '    curr = curr.next;                 // @hop',
        '    i++;                              // @hop',
        '  }',
        '  return -1;                          // @absent',
        '}'].join('\n'),
      py: [
        'def search(lst, x):',
        '    curr = lst.head                   # @start',
        '    i = 0                             # @start',
        '    while curr is not None:           # @walk',
        '        if curr.value == x:           # @cmp',
        '            return i                  # @found',
        '        curr = curr.next              # @hop',
        '        i += 1                        # @hop',
        '    return -1                         # @absent'].join('\n')
    },
    reverse: {
      title: 'reverse',
      pseudo: [
        'function reverse(list)',
        '  prev ← null                     // @init',
        '  curr ← list.head                // @init',
        '  while curr ≠ null               // @loop',
        '    next ← curr.next              // @save',
        '    curr.next ← prev              // @flip',
        '    prev ← curr                   // @advPrev',
        '    curr ← next                   // @advCurr',
        '  list.head ← prev                // @head'].join('\n'),
      js: [
        'function reverse(list) {',
        '  let prev = null;                    // @init',
        '  let curr = list.head;               // @init',
        '  while (curr !== null) {             // @loop',
        '    const next = curr.next;           // @save',
        '    curr.next = prev;                 // @flip',
        '    prev = curr;                      // @advPrev',
        '    curr = next;                      // @advCurr',
        '  }',
        '  list.head = prev;                   // @head',
        '}'].join('\n'),
      py: [
        'def reverse(lst):',
        '    prev = None                       # @init',
        '    curr = lst.head                   # @init',
        '    while curr is not None:           # @loop',
        '        nxt = curr.next               # @save',
        '        curr.next = prev              # @flip',
        '        prev = curr                   # @advPrev',
        '        curr = nxt                    # @advCurr',
        '    lst.head = prev                   # @head'].join('\n')
    }
  };
  function sources(op) { var c = CODE[op]; return { pseudo: c.pseudo, js: c.js, py: c.py }; }

  var CHECK_IDS = ['ll-lab-first-write', 'll-rev-save', 'll-rev-head', 'll-floyd-meet'];

  /* ================================================================== 1. hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var title = h('p', { class: 'll-teaser__title', 'aria-hidden': 'true' }, 'reverse(list)');
    var host = h('div', { class: 'll-teaser__view' });
    var note = h('p', { class: 'll-teaser__note', 'aria-hidden': 'true' });
    stage.appendChild(title); stage.appendChild(host); stage.appendChild(note);
    var view = V.views.list(host, { label: 'A linked list reversing itself', describe: false });
    var steps = ALG.teaserSteps([3, 7, 1, 9, 4]);
    view.prepare(steps);
    var reversedAt = steps.findIndex(function (st) { return st.note && st.note.indexOf('4 → 9') === 0; });
    V.teaser(stage, {
      steps: steps, stepMs: 1050, holdMs: 1500,
      staticIndex: reversedAt > 0 ? reversedAt - 1 : 0,
      render: function (st, ctx) {
        view.render(st, { duration: ctx.duration });
        note.textContent = st.note;
        note.classList.toggle('is-flip', st.flips > 0 && st.note.indexOf('curr.next') === 0);
      }
    });
  }

  /* ================================================================== 2. the problem: insert at the front */
  function problemFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'New song' }, { state: 'swap', label: 'Moved or written now' }, { state: 'done', label: 'Just inserted' }
    ]);
    var arr = V.views.array(fig.querySelector('[data-array]'), { label: 'Queue stored in an array', cellSize: 46, outerPointers: false });
    var lst = V.views.list(fig.querySelector('[data-list]'), { label: 'Queue stored in a linked list' });
    var caption = fig.querySelector('[data-caption]');
    var btn = fig.querySelector('[data-act="insert"]');
    var stats = V.stats(fig.querySelector('[data-stats]'), {
      labels: { am: 'Array moves (this insert)', at: 'Array moves (total)', lw: 'List writes (this insert)', lt: 'List writes (total)' },
      states: { am: 'swap', lw: 'swap' }
    });
    var CAP = 8, START = ['F', 'G', 'H'], NEXT = ['E', 'D', 'C', 'B', 'A'];
    var songs, queue, totA, totL, busy = false, token = 0;
    function arrItems(list, states) { return list.map(function (v, i) { return { id: 's' + v, value: v, index: i, state: states && states[i] }; }); }
    function listNodes(list, extra) {
      var nodes = list.map(function (v, i) { return { id: 'l' + v, value: v, next: i + 1 < list.length ? 'l' + list[i + 1] : null }; });
      return extra ? [extra].concat(nodes) : nodes;
    }
    function reset() {
      token++; busy = false;
      songs = START.slice(); queue = NEXT.slice(); totA = 0; totL = 0;
      arr.render({ items: arrItems(songs), length: CAP }, { duration: 0 });
      lst.render({ nodes: listNodes(songs), head: 'l' + songs[0] }, { duration: 0 });
      stats.update({ am: 0, at: 0, lw: 0, lt: 0 });
      caption.innerHTML = 'Three songs are queued. Press the button to put a new song at the front of both structures.';
      btn.disabled = false;
    }
    function wait(ms) { return V.wait(ms); }
    function runArray(x, my) {
      var n = songs.length, items = arrItems(songs), moves = 0;
      arr.render({ items: items, length: CAP, held: { id: 's' + x, value: x, over: 0, state: 'key' } }, { duration: 320 });
      var p = wait(380);
      for (var j = n - 1; j >= 0; j--) {
        (function (jj) {
          p = p.then(function () {
            if (my !== token) return;
            items = items.map(function (it, k) { return k === jj ? Object.assign({}, it, { index: jj + 1, state: 'swap' }) : Object.assign({}, it, { state: undefined }); });
            moves++; totA++;
            arr.render({ items: items, length: CAP, held: { id: 's' + x, value: x, over: 0, state: 'key' } }, { duration: 230 });
            stats.update({ am: moves, at: totA });
            return wait(250);
          });
        }(j));
      }
      return p.then(function () {
        if (my !== token) return;
        items = items.map(function (it) { return Object.assign({}, it, { state: undefined }); });
        items.unshift({ id: 's' + x, value: x, index: 0, state: 'done' });
        arr.render({ items: items, length: CAP }, { duration: 320 });
        return moves;
      });
    }
    function runList(x, my) {
      var nid = 'l' + x, oldHead = 'l' + songs[0];
      var base = listNodes(songs);
      lst.render({ nodes: [{ id: nid, value: x, next: null, detached: 'above', state: 'key' }].concat(base), head: oldHead }, { duration: 380 });
      return wait(480).then(function () {
        if (my !== token) return;
        totL++;
        lst.render({ nodes: [{ id: nid, value: x, next: oldHead, detached: 'above', state: 'key', nextState: 'swap' }].concat(base), head: oldHead }, { duration: 420 });
        stats.update({ lw: 1, lt: totL });
        return wait(520);
      }).then(function () {
        if (my !== token) return;
        totL++;
        lst.render({ nodes: [{ id: nid, value: x, next: oldHead, detached: 'above', state: 'key' }].concat(base), head: nid }, { duration: 420 });
        stats.update({ lw: 2, lt: totL });
        return wait(520);
      }).then(function () {
        if (my !== token) return;
        lst.render({ nodes: [{ id: nid, value: x, next: oldHead, state: 'done' }].concat(base), head: nid }, { duration: 450 });
      });
    }
    btn.addEventListener('click', function () {
      if (busy || !queue.length) return;
      busy = true; btn.disabled = true;
      var x = queue.shift(), my = token, n = songs.length;
      stats.update({ am: 0, lw: 0 });
      caption.innerHTML = 'Inserting <b>' + x + '</b>. The array must open slot 0, so it moves the last song first, then the next, and so on. The list only allocates a node and re-points two arrows.';
      Promise.all([runArray(x, my), runList(x, my)]).then(function () {
        if (my !== token) return;
        songs.unshift(x); busy = false;
        caption.innerHTML = 'Inserted <b>' + x + '</b>: the array moved <b>' + n + '</b> song' + (n === 1 ? '' : 's') + ', the list made <b>2</b> pointer writes. Next time the array will move ' + (n + 1) + '.' + (queue.length ? '' : ' The array is now full: press Reset to start again.');
        btn.disabled = !queue.length;
      });
    });
    fig.querySelector('[data-act="reset"]').addEventListener('click', reset);
    reset();
  }

  /* ================================================================== 3. intuition: scavenger hunt and memory */
  function huntFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'You', shape: 'dot' }, { state: 'active', label: 'Current spot' }, { state: 'visited', label: 'Visited' }
    ]);
    var render = F.huntView(fig.querySelector('[data-stage]'));
    V.player({ root: fig, steps: F.huntSteps(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1900, label: 'Scavenger hunt controls' });
  }

  function memoryFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'next pointer' }, { state: 'key', label: 'head variable' }, { state: 'frontier', shape: 'dot', label: 'node’s own address' }
    ]);
    var values = [4, 7, 9, 12, 15];
    var rng = V.rng(21);
    var mem = F.memoryView(fig.querySelector('[data-stage]'), { values: values, label: 'Linked list nodes scattered in memory' });
    var state = { mode: 'memory', cells: [14, 2, 20, 8, 16] };
    var cap = fig.querySelector('[data-caption]');
    function say(shuffled) {
      var ad = mem.addresses(state);
      if (shuffled) cap.innerHTML = 'Every node moved and every stored address changed (4 is now at <code>' + ad[0] + '</code>), yet head still leads to 4 → 7 → 9 → 12 → 15. The order is in the pointers, not in the positions.';
      else if (state.mode === 'memory') cap.innerHTML = 'Node 4 lives at <code>' + ad[0] + '</code>, 7 at <code>' + ad[1] + '</code>, 9 at <code>' + ad[2] + '</code>: unrelated addresses. Each node’s grey cell stores the address of the next node; the last stores <code>null</code>.';
      else cap.innerHTML = 'The same five nodes drawn as boxes and arrows. Each arrow is nothing more than the address stored in the grey half of a node.';
    }
    mem.render(state, { duration: 0 });
    say(false);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Picture', value: 'memory',
      options: [{ value: 'memory', label: 'Memory view' }, { value: 'list', label: 'Box-and-arrow view' }],
      onChange: function (v) { state = { mode: v, cells: state.cells }; mem.render(state, { duration: 1000 }); say(false); }
    });
    fig.querySelector('[data-act="shuffle"]').addEventListener('click', function () {
      state = { mode: state.mode, cells: mem.randomCells(rng, state.cells) };
      mem.render(state, { duration: 1000 });
      say(true);
    });
    V.clickQuiz(mem.el, {
      el: '#quiz-memory',
      question: 'Follow the pointers: which node comes right after <b>9</b> in the list? Click it in the figure above.',
      answer: 'm3',
      right: 'Yes: 12. The grey cell of 9’s node holds 12’s address, so 12 is next, even though it sits elsewhere in memory.',
      wrong: 'Not that one. Find 9, read the address in its grey pointer cell, then find the node whose own address (the small label on top) matches.'
    });
  }

  /* ================================================================== 4. anatomy */
  function anatomyFigure(fig) {
    var view = V.views.list(fig.querySelector('[data-stage]'), { label: 'Anatomy of a singly linked list' });
    var cap = fig.querySelector('[data-caption]');
    var TERMS = [
      ['node', 'node', '<b>node</b>: one value and one next pointer, stored together somewhere in memory. Here, the node holding 7.', { st: { b: 'active' }, lab: { b: 'node' } }],
      ['value', 'value', '<b>value</b>: the data a node carries: a number here, but it could be a string or a whole record.', { st: { a: 'compare', b: 'compare', c: 'compare' }, lab: { a: 'value', b: 'value', c: 'value' } }],
      ['next', 'next', '<b>next</b>: the address of the following node, drawn as an arrow leaving the dot.', { ns: { a: 'active', b: 'active' } }],
      ['head', 'head', '<b>head</b>: a variable outside the nodes that holds the address of the first node. Lose it and you lose the whole list.', { head: 'active' }],
      ['tail', 'tail', '<b>tail</b>: the last node. Some lists keep a tail pointer to it, so appending needs no walk.', { st: { c: 'visited' }, tail: true }],
      ['null', 'null', '<b>null</b>: “no node”. The tail’s next is null, which is how a walk knows where to stop.', { ns: { c: 'error' } }],
      ['empty', 'empty list', '<b>empty list</b>: no nodes at all, so head itself is null.', { empty: true }]
    ];
    function stateFor(t) {
      var o = t[3];
      if (o.empty) return { nodes: [], head: null, pointers: [{ name: 'head', target: null, state: 'active', nullSide: 'left' }] };
      var base = [{ id: 'a', value: 4, next: 'b' }, { id: 'b', value: 7, next: 'c' }, { id: 'c', value: 9, next: null }];
      var nodes = base.map(function (n) {
        var m = Object.assign({}, n);
        if (o.st && o.st[n.id]) m.state = o.st[n.id];
        if (o.ns && o.ns[n.id]) m.nextState = o.ns[n.id];
        if (o.lab && o.lab[n.id]) m.label = o.lab[n.id];
        return m;
      });
      var ptrs = [{ name: 'head', target: 'a', state: o.head || 'default' }];
      if (o.tail) ptrs.push({ name: 'tail', target: 'c', state: 'visited', side: 'below' });
      return { nodes: nodes, head: 'a', pointers: ptrs };
    }
    view.prepare(TERMS.map(stateFor).concat([stateFor(['', '', '', { lab: { a: 'value' } }])]));
    var host = fig.querySelector('[data-terms]'), buttons = [];
    function select(k, animate) {
      buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
      view.render(stateFor(TERMS[k]), { duration: animate ? 450 : 0 });
      cap.innerHTML = TERMS[k][2];
    }
    TERMS.forEach(function (t, k) {
      var b = h('button', { class: 'll-term', type: 'button', 'aria-pressed': 'false', onclick: function () { select(k, true); } }, t[1]);
      host.appendChild(b); buttons.push(b);
    });
    select(0, false);
  }

  /* ================================================================== 5. walking */
  function walkFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'curr' }, { state: 'visited', label: 'Walked past' }, { state: 'found', label: 'Index reached' }]);
    var values = [4, 7, 9, 12, 15, 21];
    var lp = listPlayer(fig, { steps: ALG.opGet(values, 3), label: 'Walking to index i', baseStepMs: 1000, player: { counterLabels: { hops: 'Hops (curr = curr.next)' }, counterStates: { hops: 'active' } } });
    lp.view.prepare(values.map(function (_, i) { return ALG.opGet(values, i); }).reduce(function (a, b) { return a.concat(b); }, []));
    V.slider(fig.querySelector('[data-slider]'), {
      label: 'Index to read, i', min: 0, max: values.length - 1, value: 3,
      onChange: function (v) { lp.load(ALG.opGet(values, v)); lp.player.play(); }
    });
  }

  /* ================================================================== 6. wrong order vs right order */
  function orderFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'prev' }, { state: 'key', label: 'New node' }, { state: 'swap', shape: 'line', label: 'Pointer written now' },
      { state: 'muted', label: 'Unreachable' }, { state: 'error', label: 'Broken' }
    ]);
    var values = [4, 7, 9, 12, 15];
    var wrong = ALG.spliceOrderSteps(values, 2, 8, 'wrong'), right = ALG.spliceOrderSteps(values, 2, 8, 'right');
    var lp = listPlayer(fig, {
      steps: wrong, prepare: wrong.concat(right), label: 'Insert 8 after 7', baseStepMs: 1700,
      player: { counterLabels: { writes: 'Pointer writes', reachable: 'Nodes reachable from head', lost: 'Nodes lost' }, counterStates: { lost: 'error', writes: 'swap' } }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Order of the two writes', value: 'wrong',
      options: [{ value: 'wrong', label: 'Wrong order: prev.next first' }, { value: 'right', label: 'Right order: node.next first' }],
      onChange: function (v) { lp.load(v === 'wrong' ? wrong : right, wrong.concat(right)); lp.player.play(); }
    });
  }

  /* ================================================================== 7. delete + flowchart */
  var DELETE_FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'delete(x)', col: 0, row: 0 },
      { id: 'empty', type: 'decision', text: 'head = null ?', col: 0, row: 1 },
      { id: 'none', type: 'end', text: 'return false', col: 1, row: 1 },
      { id: 'head', type: 'decision', text: 'head.value = x ?', col: 0, row: 2 },
      { id: 'dropHead', type: 'process', text: 'head ← head.next\nreturn true', col: 1, row: 2 },
      { id: 'init', type: 'process', text: 'prev ← head', col: 0, row: 3 },
      { id: 'walk', type: 'decision', text: 'prev.next ≠ null ?', col: 0, row: 4 },
      { id: 'absent', type: 'end', text: 'return false', col: 1, row: 4 },
      { id: 'cmp', type: 'decision', text: 'prev.next.value = x ?', col: 0, row: 5 },
      { id: 'bypass', type: 'process', text: 'prev.next ← prev.next.next\nreturn true', col: 1, row: 5 },
      { id: 'hop', type: 'process', text: 'prev ← prev.next', col: 0, row: 6 }
    ],
    edges: [
      { from: 'start', to: 'empty' },
      { from: 'empty', to: 'none', label: 'yes' }, { from: 'empty', to: 'head', label: 'no' },
      { from: 'head', to: 'dropHead', label: 'yes' }, { from: 'head', to: 'init', label: 'no' },
      { from: 'init', to: 'walk' },
      { from: 'walk', to: 'cmp', label: 'yes' }, { from: 'walk', to: 'absent', label: 'no' },
      { from: 'cmp', to: 'bypass', label: 'yes' }, { from: 'cmp', to: 'hop', label: 'no' },
      { from: 'hop', to: 'walk' }
    ]
  };
  function deleteFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'prev / current box' }, { state: 'compare', label: 'Compared' }, { state: 'error', label: 'Being deleted' }, { state: 'swap', shape: 'line', label: 'Pointer written' }
    ]);
    var base = [4, 7, 9, 12, 15];
    var CASES = {
      mid: [base, 9], head: [base, 4], tail: [base, 15], absent: [base, 99], empty: [[], 4]
    };
    function stepsFor(k) { return ALG.opDelete(CASES[k][0], CASES[k][1]); }
    var flow = V.views.flowchart(fig.querySelector('[data-flow]'), DELETE_FLOW, { label: 'Delete-by-value decisions', decisionShape: 'hexagon' });
    var current = stepsFor('mid');
    var flowObj = {
      highlight: function (id, ctx) {
        var idx = ctx && typeof ctx.index === 'number' ? ctx.index : 0, seen = [];
        for (var k = 0; k < idx; k++) { var f = current[k] && current[k].flow; if (f && seen.indexOf(f) === -1) seen.push(f); }
        flow.render({ active: id, visited: seen }, { duration: ctx ? ctx.duration : 0 });
      }
    };
    var all = Object.keys(CASES).map(stepsFor).reduce(function (a, b) { return a.concat(b); }, []);
    var lp = listPlayer(fig, {
      steps: current, prepare: all, label: 'Delete by value', baseStepMs: 1400,
      player: { flow: flowObj, counterLabels: { hops: 'Hops', compares: 'Compares', writes: 'Pointer writes' }, counterStates: { writes: 'swap' } }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Case', value: 'mid',
      options: [{ value: 'mid', label: 'Delete 9 (middle)' }, { value: 'head', label: 'Delete 4 (head)' }, { value: 'tail', label: 'Delete 15 (tail)' }, { value: 'absent', label: 'Delete 99 (absent)' }, { value: 'empty', label: 'Empty list' }],
      onChange: function (v) { current = stepsFor(v); lp.load(current, all); lp.player.play(); }
    });
  }

  /* ================================================================== 8. operations lab */
  function opsLab(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'prev / curr' }, { state: 'key', label: 'New node' }, { state: 'compare', label: 'Compared' },
      { state: 'swap', shape: 'line', label: 'Pointer written' }, { state: 'error', label: 'Deleted' }, { state: 'found', label: 'Found' }
    ]);
    var opSel = fig.querySelector('[data-op]'), xIn = fig.querySelector('[data-x]'), iIn = fig.querySelector('[data-i]');
    var iWrap = fig.querySelector('[data-iwrap]'), err = fig.querySelector('[data-err]'), result = fig.querySelector('[data-result]');
    var list = [3, 9, 1, 7, 5];
    var op = opSel.value;
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: sources(op), default: 'pseudo', maxHeight: 360 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { prev: 'active', curr: 'active', 'node.next': 'key', x: 'key', head: 'default', tail: 'default' } });
    var view = V.views.list(fig.querySelector('[data-stage]'), { label: 'Linked list operations' });
    function args() { return { x: xIn.value === '' ? NaN : Number(xIn.value), i: iIn.value === '' ? NaN : Number(iIn.value) }; }
    var steps = ALG.labSteps(op, list, args());
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { hops: 'Hops (walking)', compares: 'Compares', writes: 'Pointer writes' },
      counterStates: { hops: 'active', writes: 'swap' },
      baseStepMs: 1200, label: 'Operations lab controls'
    });
    view.prepare(steps); player.refresh();
    player.addCheckpoint(
      function (st) { return st.findIndex(function (s) { return s.firstWrite; }); },
      function (c) {
        var line = c.step.line;
        if (line === 'link0' || (line === 'link' && op === 'insertHead')) {
          return { question: 'The new node is allocated. Which pointer do you write first?',
            options: ['<code>head ← node</code>', '<code>node.next ← head</code>'], answer: 1,
            explain: ['If head moves first, nothing points to the old first node any more: the whole list is lost, and node.next ← head would then point the node at itself.',
              'Right: hook the new node onto the list first, while head still names the old first node. Then move head.'] };
        }
        if (line === 'link') {
          return { question: 'prev is in place. Which pointer do you write first?',
            options: ['<code>prev.next ← node</code>', '<code>node.next ← prev.next</code>'], answer: 1,
            explain: ['prev.next is the only pointer to the rest of the list. Overwrite it first and the tail is unreachable; node.next ← prev.next would then copy node’s own address.',
              'Right: copy the successor’s address into the new node first. Then prev.next can safely be redirected.'] };
        }
        if (line === 'splice' && op === 'appendTail') {
          return { question: 'Two writes remain: <code>tail.next ← node</code> and <code>tail ← node</code>. Which comes first?',
            options: ['<code>tail ← node</code>', '<code>tail.next ← node</code>'], answer: 1,
            explain: ['Move tail first and tail.next ← node sets the new node’s next to itself, while the old last node never links to it.',
              'Right: link the old last node to the new one while tail still names it, then move tail.'] };
        }
        return null;
      },
      { id: 'll-lab-first-write' });
    function showResult() {
      var last = steps[steps.length - 1];
      V.clear(result);
      if (op === 'search') { result.appendChild(h('span', { html: 'Returns <b>' + last.result + '</b>. The list is unchanged.' })); return; }
      var r = last.result || list;
      result.appendChild(h('span', { html: 'After this operation: <code>' + V.escape(vals(r)) + '</code>' }));
      if (JSON.stringify(r) !== JSON.stringify(list)) {
        result.appendChild(h('button', { class: 'btn btn--soft btn--sm', type: 'button', onclick: function () { input.set(r, false); list = r.slice(); run(); } }, 'Continue from this list'));
      }
    }
    function syncControls() {
      op = opSel.value;
      var needI = op === 'insertAt';
      iIn.disabled = !needI; iWrap.setAttribute('aria-disabled', needI ? 'false' : 'true');
      iIn.max = String(list.length);
    }
    function run() {
      syncControls();
      var a = args();
      var e = ALG.validateOp(op, list, a);
      if (e) { err.textContent = e; err.hidden = false; return; }
      err.hidden = true;
      code.setSource(sources(op));
      steps = ALG.labSteps(op, list, a);
      view.reset(); view.prepare(steps);
      player.setSteps(steps);
      showResult();
    }
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your list (up to 8 values)', value: list, placeholder: 'e.g. 3, 9, 1, 7',
      parse: { min: -99, max: 99, maxCount: 8, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(5, { min: 1, max: 30 }); } },
        { label: 'Two nodes', value: [3, 9] },
        { label: 'One node', value: [42] },
        { label: 'Empty', value: [] },
        { label: 'Duplicates', value: [5, 2, 5, 8] }
      ],
      applyLabel: 'Apply', hint: 'Whole numbers from −99 to 99.',
      onApply: function (values) { list = values.slice(); run(); }
    });
    opSel.addEventListener('change', function () {
      syncControls();
      if (op === 'delete' && list.length) xIn.value = String(list[Math.min(2, list.length - 1)]);
      if (op === 'search' && list.length) xIn.value = String(list[list.length - 1]);
      run();
    });
    fig.querySelector('[data-run]').addEventListener('click', function () { run(); player.play(); });
    [xIn, iIn].forEach(function (f) { f.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); run(); player.play(); } }); });
    syncControls(); showResult();
  }

  /* ================================================================== 9. doubly linked */
  function doublyFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'curr' }, { state: 'key', label: 'New node' }, { state: 'swap', shape: 'line', label: 'Pointer written' }, { state: 'error', label: 'Being deleted' }
    ]);
    var values = [2, 5, 11, 14];
    var ins = ALG.doublyInsertSteps(values, 1, 8), del = ALG.doublyDeleteSteps(values, 2);
    var lp = listPlayer(fig, { steps: ins, prepare: ins.concat(del), label: 'Doubly linked list', baseStepMs: 1500,
      player: { counterLabels: { writes: 'Pointer writes' }, counterStates: { writes: 'swap' } } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: 'ins',
      options: [{ value: 'ins', label: 'Insert 8 after 5' }, { value: 'del', label: 'Delete 11' }],
      onChange: function (v) { lp.load(v === 'ins' ? ins : del, ins.concat(del)); lp.player.play(); }
    });
  }

  /* ================================================================== 10. reversal lab */
  function reverseLab(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'visited', label: 'prev / reversed part' }, { state: 'active', label: 'curr' }, { state: 'compare', label: 'next' },
      { state: 'swap', shape: 'line', label: 'Arrow being flipped' }, { state: 'done', label: 'Reversed' }
    ]);
    var list = [3, 7, 1, 9, 4];
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: sources('reverse'), default: 'pseudo', maxHeight: 320 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { prev: 'visited', curr: 'active', next: 'compare' } });
    var lp = listPlayer(fig, {
      steps: ALG.reverseSteps(list), label: 'Reversal lab', baseStepMs: 1150,
      player: { code: code, vars: vars, counterLabels: { loops: 'Iterations', writes: 'Pointer writes' }, counterStates: { writes: 'swap' } }
    });
    lp.player.addCheckpoint(
      function (st) { return st.findIndex(function (s) { return s.kind === 'save'; }); },
      function (c) {
        var v = c.prev.vars.curr;
        return { question: 'Next, curr.next (the arrow out of ' + v + ') will be overwritten. What must happen first?',
          options: ['Nothing: flip it right away', 'Save <code>curr.next</code> in <code>next</code>', 'Move <code>head</code> to curr'], answer: 1,
          explain: ['After the flip, nothing would point to the rest of the list: the loop would have nowhere to go, and the tail would be lost.',
            'Right. <code>next</code> becomes the only grip on the rest of the list once the arrow flips.',
            'head only moves once, at the very end, when the whole list is reversed.'] };
      }, { id: 'll-rev-save' });
    lp.player.addCheckpoint(
      function (st) { return st.length > 4 ? st.findIndex(function (s) { return s.kind === 'head'; }) : -1; },
      function (c) {
        var p = c.prev.vars.prev, first = c.steps[0].nodes.length ? c.steps[0].nodes[0].value : null;
        if (p === null || c.steps[0].nodes.length < 2) return null;
        return { question: 'curr is null and the loop has ended. Which node becomes the new head?',
          options: ['<code>curr</code> (null)', 'The old head (' + first + ')', '<code>prev</code> (' + p + ')'], answer: 2,
          explain: ['curr has run off the end; making head null would empty the list.', 'The old head is now the last node: its next is null.', 'Right: prev stopped on the old tail, which now leads the reversed chain.'] };
      }, { id: 'll-rev-head' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your list (up to 8 values)', value: list, placeholder: 'e.g. 3, 7, 1, 9',
      parse: { min: -99, max: 99, maxCount: 8, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(5, { min: 1, max: 30 }); } },
        { label: 'Two nodes', value: [1, 2] },
        { label: 'One node', value: [5] },
        { label: 'Empty', value: [] },
        { label: 'Eight nodes', value: [1, 2, 3, 4, 5, 6, 7, 8] }
      ],
      applyLabel: 'Apply', hint: 'Empty and single-node lists are fine: see what the loop does.',
      onApply: function (values) { lp.load(ALG.reverseSteps(values)); }
    });
  }

  /* ================================================================== 11. fast & slow */
  function middleFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'slow (1 step)' }, { state: 'compare', label: 'fast (2 steps)' }, { state: 'found', label: 'Middle' }]);
    var odd = ALG.middleSteps([3, 8, 1, 6, 9, 2, 5]), even = ALG.middleSteps([3, 8, 1, 6, 9, 2]);
    var lp = listPlayer(fig, { steps: odd, prepare: odd.concat(even), label: 'Middle node', baseStepMs: 1300 });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Length', value: 'odd',
      options: [{ value: 'odd', label: 'Seven nodes' }, { value: 'even', label: 'Six nodes' }],
      onChange: function (v) { lp.load(v === 'odd' ? odd : even, odd.concat(even)); lp.player.play(); }
    });
  }

  function predictFigure(fig) {
    var rho = F.rhoView(fig.querySelector('[data-stage]'), { label: 'A tail of 2 nodes leading into a loop of 5 nodes; both animals at node 0' });
    var steps = ALG.floydSteps(2, 5);
    rho.render(steps[0], { duration: 0 });
    var meet = steps.find(function (s) { return s.kind === 'meet'; }).meet;
    V.clickQuiz(rho.el(), {
      el: '#quiz-meet',
      question: 'The tortoise moves 1 node per turn, the hare 2. Both start at node 0. Click the node where they first land together.',
      answer: String(meet),
      right: 'Node ' + meet + '. The hare goes 0, 2, 4, 6, 3, 5 and the tortoise 0, 1, 2, 3, 4, 5: together after 5 turns. Play the figure below to watch it.',
      wrong: 'Not there. Trace turn by turn: the tortoise visits 1, 2, 3 …; the hare visits 2, 4, 6, then wraps round the loop (6 → 2 → 3 …).'
    });
  }

  function floydFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'dot', label: 'Tortoise (slow)' }, { state: 'compare', shape: 'dot', label: 'Hare (fast)' },
      { state: 'pivot', label: 'Meeting point' }, { state: 'found', label: 'Loop entry' }, { state: 'path', shape: 'line', label: 'Phase 2 walk' }
    ]);
    var rho = F.rhoView(fig.querySelector('[data-stage]'), {});
    var mu = 3, lambda = 5;
    var player = V.player({
      root: fig, steps: ALG.floydSteps(mu, lambda),
      render: function (step, ctx) { rho.render(step, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { slow: 'Tortoise steps', fast: 'Hare steps', gap: 'Gap (hare behind)' },
      counterStates: { slow: 'active', fast: 'compare' },
      baseStepMs: 1500, animMs: 1000, label: 'Tortoise and hare controls'
    });
    player.addCheckpoint(
      function (st) { return st.findIndex(function (s) { return s.kind === 'meet'; }); },
      function (c) {
        if (c.prev.gap !== 1) return null;
        return { question: 'Both are on the loop and the hare is <b>1 step</b> behind the tortoise. What happens on the next turn?',
          options: ['The hare jumps over the tortoise', 'They land on the same node', 'The gap stays at 1'], answer: 1,
          explain: ['It cannot: the tortoise moves 1 and the hare 2, so the hare gains exactly one node, never two.', 'Right. The gap shrinks by exactly one per turn: 1 becomes 0, so they meet.', 'The hare gains one node every turn; the gap always shrinks while both are on the loop.'] };
      }, { id: 'll-floyd-meet' });
    var muS, laS;
    function load() { player.setSteps(ALG.floydSteps(mu, lambda)); }
    muS = V.slider(fig.querySelector('[data-mu]'), { label: 'Tail length μ', min: 0, max: 6, value: mu, onChange: function (v) { mu = v; load(); } });
    laS = V.slider(fig.querySelector('[data-lambda]'), { label: 'Loop length λ', min: 0, max: 9, value: lambda, format: function (v) { return v === 0 ? '0 (no cycle)' : String(v); }, onChange: function (v) { lambda = v; load(); } });
    var presets = fig.querySelector('[data-presets]');
    [['Classic (μ 3, λ 5)', 3, 5], ['Cycle at the head', 0, 6], ['Self-loop', 3, 1], ['Long tail', 6, 3], ['No cycle', 5, 0]].forEach(function (p) {
      presets.appendChild(h('button', { class: 'btn btn--soft btn--sm', type: 'button', onclick: function () { mu = p[1]; lambda = p[2]; muS.set(mu); laS.set(lambda); load(); player.play(); } }, p[0]));
    });
  }

  /* ================================================================== 12. cost: race and chart */
  var RACE_OPS = [
    { value: 'access', label: 'Read index 4' }, { value: 'insertFront', label: 'Insert at front' }, { value: 'insertMiddle', label: 'Insert in the middle' },
    { value: 'append', label: 'Append' }, { value: 'deleteLast', label: 'Delete last' }
  ];
  function raceFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Pointer / index' }, { state: 'swap', label: 'Moved or written' }, { state: 'visited', label: 'Walked past' }, { state: 'done', label: 'Result' }
    ]);
    var values = [5, 8, 2, 9, 4, 7];
    var arr = V.views.array(fig.querySelector('[data-array]'), { label: 'Array side of the race', cellSize: 44 });
    var lst = V.views.list(fig.querySelector('[data-list]'), { label: 'Linked list side of the race' });
    var aDone = fig.querySelector('[data-adone]'), lDone = fig.querySelector('[data-ldone]');
    function stepsFor(op) { return ALG.raceSteps(op, values, 1, 4); }
    var steps = stepsFor('insertFront');
    function prep(st) { arr.reset(); lst.reset(); arr.prepare(st.map(function (s) { return s.array; })); lst.prepare(st.map(function (s) { return s.list; })); }
    var allSteps = RACE_OPS.map(function (o) { return stepsFor(o.value); }).reduce(function (a, b) { return a.concat(b); }, []);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        arr.render(step.array, { duration: ctx.duration });
        lst.render(step.list, { duration: ctx.duration });
        aDone.hidden = !step.arrayDone; lDone.hidden = !step.listDone;
      },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { array: 'Array steps', list: 'Linked list steps' },
      baseStepMs: 850, label: 'Race controls'
    });
    prep(allSteps); player.refresh();
    var seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: 'insertFront', options: RACE_OPS,
      onChange: function (v) { go(v); }
    });
    function go(v) { steps = stepsFor(v); prep(allSteps); player.setSteps(steps); player.play(); }
    V.$$('#cost-table tr[data-race]').forEach(function (tr) {
      tr.tabIndex = 0; tr.classList.add('ll-racerow'); tr.title = 'Race this operation above';
      function pick() { var v = tr.getAttribute('data-race'); seg.set(v); go(v); fig.scrollIntoView({ behavior: V.reducedMotion() ? 'auto' : 'smooth', block: 'nearest' }); }
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  function chartFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Array' }, { state: 'compare', shape: 'line', label: 'Linked list' }]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Basic steps against list length for an array and a linked list' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Items n', array: 'Array steps', list: 'Linked list steps' } });
    var op = 'access', n = 24;
    function show(dur) {
      var c = ALG.costOf(op, n);
      var arrFn = op === 'access' ? function () { return 1; } : function (x) { return x + 1; };
      var lstFn = op === 'access' ? function (x) { return x - 1; } : function () { return 2; };
      chart.render({
        x: { label: 'items in the list, n', min: 1, max: 64 },
        y: { label: op === 'access' ? 'steps to read the last item' : 'steps to insert at the front', min: 0, max: 66 },
        series: [{ id: 'arr', label: 'array', fn: arrFn, color: 0 }, { id: 'list', label: 'linked list', fn: lstFn, color: 1 }],
        highlight: [{ series: 'arr', x: n, label: String(c.array) }, { series: 'list', x: n, label: String(c.list) }]
      }, { duration: dur });
      stats.update({ n: n, array: c.array, list: c.list });
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: op,
      options: [{ value: 'access', label: 'Read the last item' }, { value: 'insertFront', label: 'Insert at the front' }],
      onChange: function (v) { op = v; show(800); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: 64, value: n, onInput: function (v) { n = v; show(120); } });
    show(0);
  }

  /* ================================================================== 13. variations */
  function variations() {
    V.tabs('#variants');
    var dfig = V.$('#fig-dummy');
    var without = ALG.opDelete([4, 7, 9], 4), withD = ALG.dummyDeleteSteps([4, 7, 9], 4);
    var dl = listPlayer(dfig, { steps: withD, prepare: without.concat(withD), label: 'Dummy head node', baseStepMs: 1300 });
    V.segmented(dfig.querySelector('[data-seg]'), {
      label: 'Version', value: 'with',
      options: [{ value: 'with', label: 'With a dummy node' }, { value: 'without', label: 'Without' }],
      onChange: function (v) { dl.load(v === 'with' ? withD : without, without.concat(withD)); dl.player.play(); }
    });
    var cfig = V.$('#fig-circular');
    listPlayer(cfig, { steps: ALG.circularSteps([3, 8, 5, 1, 6]), label: 'Circular list', view: { circular: true }, baseStepMs: 1000 });
    var pfig = V.$('#fig-copy');
    var mid = ALG.copyDeleteSteps([4, 7, 9, 12], 1), tail = ALG.copyDeleteSteps([4, 7, 9, 12], 3);
    var cl = listPlayer(pfig, { steps: mid, prepare: mid.concat(tail), label: 'Delete the node you hold', baseStepMs: 1400 });
    V.segmented(pfig.querySelector('[data-seg]'), {
      label: 'Node you hold', value: 'mid',
      options: [{ value: 'mid', label: 'p = 7 (middle)' }, { value: 'tail', label: 'p = 12 (tail)' }],
      onChange: function (v) { cl.load(v === 'mid' ? mid : tail, mid.concat(tail)); cl.player.play(); }
    });
  }

  /* ================================================================== 14. checks */
  function checks() {
    V.quiz('#quiz-first', {
      kicker: 'Which pointer first?',
      question: 'You hold <code>prev</code> and a new node. Which assignment must come first to insert the node after prev?',
      options: ['<code>prev.next = node</code>', '<code>node.next = prev.next</code>', 'Either order works', '<code>head = node</code>'],
      answer: 1,
      explain: [
        'This overwrites the only pointer to the rest of the list. Afterwards node.next = prev.next would point the node at itself.',
        'Copy the successor’s address into the new node while prev.next still holds it. Then redirect prev.next.',
        'The order matters: the first write destroys information the second one needs, unless it is the copy.',
        'head only changes when inserting at the front. Here there is a prev.'
      ]
    });
    V.quiz('#quiz-tail', {
      kicker: 'Cost check',
      question: 'A singly linked list keeps both a <code>head</code> and a <code>tail</code> pointer, with <em>n</em> nodes. What does deleting the last node cost?',
      options: ['O(1): tail points right at it', 'O(n): you must find the node before the tail', 'O(log n)', 'O(1) if the values are sorted'],
      answer: 1,
      explain: [
        'tail finds the victim, but the change happens in its predecessor, whose next must become null, and the new tail must be that predecessor. A singly linked node cannot see who points at it.',
        'Right. You walk from head to the second-to-last node: n − 2 hops. A doubly linked list makes this O(1) with tail.prev.',
        'Nothing halves here: the only route to the predecessor is the walk from head.',
        'Sorting changes the values, not the pointers. The predecessor is still found only by walking.'
      ]
    });
    V.quiz('#quiz-o1', {
      kicker: 'Pick all that apply',
      question: 'Which operations take O(1) time on a singly linked list that keeps only a <code>head</code> pointer?',
      options: ['Insert at the front', 'Delete the first node', 'Read the item at index n / 2', 'Append at the end', 'Insert after a node you already hold'],
      answer: [0, 1, 4],
      explain: 'Anything that touches only the head, or a node you already hold, is a constant number of pointer writes. Reading the middle and appending both need a walk from head: O(n). (A tail pointer would make appending O(1).)'
    });
    V.quiz('#quiz-cycle', {
      kicker: 'Tortoise and hare',
      question: 'A list has a tail of μ = 4 nodes and a loop of λ = 3. After the first meeting, the tortoise restarts at the head and both move one node per turn. How many turns until they meet again?',
      options: ['3, the loop length', '4, the tail length', '7, the total number of nodes', 'It depends on where they first met'],
      answer: 1,
      explain: [
        'λ decides how fast the hare catches up in phase 1, not how far phase 2 walks.',
        'Right. The tortoise needs μ = 4 steps to reach the entry, and the hare, walking from the meeting point, also reaches the entry after exactly μ steps (possibly after extra whole laps).',
        'Phase 2 only needs the tortoise to walk the tail.',
        'The meeting point is always μ steps (plus whole laps) before the entry, so the answer is always μ.'
      ]
    });
  }

  /* ================================================================== 15. summary */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    [
      ['node', 'A node = value + next', 'head holds the first address; the tail’s next is null.'],
      ['walk', 'Walk to arrive', 'Reaching index i takes i hops: O(i), no arithmetic shortcut.'],
      ['splice', 'Copy, then redirect', 'node.next = prev.next, then prev.next = node. O(1) once you hold prev.'],
      ['bypass', 'Bypass, then let go', 'prev.next = prev.next.next; the skipped node becomes unreachable.'],
      ['reverse', 'Reverse with three pointers', 'Save next, flip, advance prev and curr. O(n) time, O(1) space.'],
      ['rho', 'Tortoise and hare', 'They meet only if there is a loop; restart one at head to find its entry.']
    ].forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, F.miniSvg(t[0])),
        h('p', { class: 'summary__label' }, t[1]),
        h('p', { class: 'summary__text' }, t[2])));
    });
  }

  V.ready(function () {
    ALG = V.algos.linkedLists; F = V.lessons.ll08figs;
    if (V.quizScore) CHECK_IDS.forEach(function (id) { V.quizScore.register(id); });
    heroTeaser();
    lazy('#fig-problem', problemFigure);
    lazy('#fig-hunt', huntFigure);
    memoryFigure(V.$('#fig-memory'));
    lazy('#fig-anatomy', anatomyFigure);
    lazy('#fig-walk', walkFigure);
    lazy('#fig-order', orderFigure);
    lazy('#fig-delete', deleteFigure);
    lazy('#lab-ops', opsLab);
    lazy('#fig-doubly', doublyFigure);
    lazy('#lab-reverse', reverseLab);
    lazy('#fig-middle', middleFigure);
    predictFigure(V.$('#fig-predict'));
    lazy('#fig-floyd', floydFigure);
    lazy('#fig-race', raceFigure);
    lazy('#fig-chart', chartFigure);
    lazy('#variants', variations);
    checks();
    summaryCard();
    drainIdle();
  });
}());
