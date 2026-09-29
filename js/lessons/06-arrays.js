/* Lesson 06 · Arrays & dynamic arrays — figure wiring.

   Data: js/algos/06-arrays.js (VDSA.algos.arrays, pure, tested in tests/algos/06-arrays.test.js).
   Custom renderers: js/lessons/06-arrays-views.js (VDSA.a6).
   Engine views: array (teaser, shifting, growth, lab, shrink), chart (doubling race), flowchart (lab logic, cost tree).

   Heavy figures start when they come near the viewport (whenNear); VDSA.lessons['06-arrays'].initAll() starts
   everything at once (used for full-page screenshots). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A, a6;

  /* ------------------------------------------------------------------ lazy start */
  var pending = [];
  function whenNear(el, fn) {
    el = V.$(el);
    if (!el) return;
    var job = { el: el, fn: fn, done: false };
    pending.push(job);
    function run() { if (job.done) return; job.done = true; try { fn(el); } catch (e) { console.error('[06-arrays]', e); } }
    job.run = run;
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
  }
  function initAll() { pending.forEach(function (j) { if (j.run) j.run(); }); }
  function stageOf(fig) { return fig.querySelector('[data-stage]'); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function nextPow2(n) { var c = 1; while (c < n) c *= 2; return c; }

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var host = V.$('#teaser'), lbl = V.$('.a6-hero__label');
    if (!host) return;
    var view = V.views.array(host, { mode: 'boxes', cellSize: 44, rowLabels: 'above', label: 'Array teaser', reserve: { held: true } });
    var rng = V.rng(6);
    function lap() {
      var vals = V.presets.random(3, { min: 1, max: 9, rng: rng, unique: true });
      var st = A.makeState(vals, 4), steps = [];
      var ops = [
        { type: 'insert', index: rng.int(0, 2), value: rng.int(10, 19) },
        { type: 'append', value: rng.int(20, 29) },
        { type: 'insert', index: rng.int(0, 1), value: rng.int(30, 39) }
      ];
      ops.forEach(function (op) {
        var r = A.arrayOp(st, op);
        var text = op.type === 'append' ? 'append ' + op.value + (st.items.length === st.cap ? ': full, so double' : '') : 'insert ' + op.value + ' at index ' + op.index + (st.items.length === st.cap ? ': full, so double first' : '');
        r.steps.forEach(function (s) {
          if (s.kind === 'copy' && s.vars && s.vars.j > 0 && s.vars.j < st.items.length - 1) return;   // keep the teaser brisk
          steps.push({ rows: s.rows, held: s.held, pointers: [], label: text });
        });
        st = r.state;
      });
      view.reset(); view.prepare(steps);
      return steps;
    }
    V.teaser(host, {
      steps: lap(), regenerate: lap, stepMs: 820, holdMs: 1600,
      render: function (step, ctx) {
        view.render({ rows: step.rows, held: step.held, pointers: [] }, { duration: ctx.duration });
        if (lbl) lbl.textContent = step.label;
      }
    });
  }

  /* ================================================================== the problem: access race */
  function raceFigure(fig) {
    var values = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    var k = 6, seed = 28;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Current node' }, { state: 'visited', label: 'Already visited' },
      { state: 'found', label: 'Reached element k' }, { state: 'compare', shape: 'ring', label: 'Target' }]);
    var layout = A.accessRace(8, k, seed, 24);
    var view = a6.raceView(stageOf(fig), { values: values, nodeCell: layout.nodeCell, cells: 24, base: A.BASE });
    function steps(kk) {
      var r = A.accessRace(8, kk, seed, 24);
      return r.steps.map(function (s) {
        var cap;
        if (s.t === 0) cap = 'Find element <b>' + kk + '</b> (value ' + values[kk] + '). The linked list only knows where node 0 (the head) is. The array knows its base address, ' + A.hex(A.BASE) + '.';
        else if (kk === 0) cap = 'Element 0 is the head, and ' + A.hex(A.BASE) + ' + 0 × 4 is the base: both are there at once. Try a larger k.';
        else if (s.listAt < kk) cap = 'Array: <b>done</b>, one calculation: ' + A.hex(A.BASE) + ' + ' + kk + ' × 4 = ' + A.hex(A.BASE + 4 * kk) + '. List: read node ' + (s.listAt - 1) + '’s next link and hop to node ' + s.listAt + ' (hop ' + s.listHops + ' of ' + kk + '). It cannot skip ahead: the address of node ' + kk + ' is written only inside node ' + (kk - 1) + '.';
        else cap = 'Both reached element ' + kk + '. The array needed <b>1</b> calculation; the list needed <b>' + plural(kk, 'hop') + '</b>. For element 7,342 of 10,000 songs that is still 1 against 7,342.';
        return Object.assign({}, s, { k: kk, caption: cap, counters: { listHops: s.listHops, arrayCalcs: s.arrayJumps } });
      });
    }
    var player = V.player({
      root: fig, steps: steps(k), baseStepMs: 900, autoplay: true, label: 'Race controls',
      render: function (step, ctx) { view.render(step, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { listHops: 'Linked list: hops', arrayCalcs: 'Array: calculations' }, counterStates: { listHops: 'visited', arrayCalcs: 'found' }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Target index k', value: k,
      options: [0, 1, 2, 3, 4, 5, 6, 7].map(function (v) { return { value: v, label: String(v), title: 'k = ' + v }; }),
      onChange: function (v) { k = v; player.setSteps(steps(k)); player.play(); }
    });
  }

  /* ================================================================== intuition: bookshelf */
  function shelfFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Reached' }, { state: 'key', label: 'New book in hand' }, { state: 'swap', label: 'Moving' }]);
    var S1 = { id: 's1', cap: 4, row: 0 }, S1w = { id: 's1', cap: 4, row: 0, wall: true }, S1g = { id: 's1', cap: 4, row: 0, gone: true }, S2 = { id: 's2', cap: 8, row: 1 }, S2top = { id: 's2', cap: 8, row: 0 };
    function b(id, shelf, slot, st, lifted) { return { id: id, label: id, shelf: shelf, slot: slot, state: st || 'default', lifted: !!lifted }; }
    var steps = [
      { shelves: [S1], books: [b('A', 's1', 0), b('B', 's1', 1), b('C', 's1', 2)], caption: 'Three books of equal width, packed from the left edge of a shelf with room for four.' },
      { shelves: [S1], books: [b('A', 's1', 0), b('B', 's1', 1), b('C', 's1', 2, 'active')], ruler: { shelf: 's1', to: 2 }, caption: 'Where is the book at position 2? Measure two book-widths from the edge and reach straight for it. No scanning, however long the shelf is.' },
      { shelves: [S1], books: [b('A', 's1', 0), b('B', 's1', 1), b('C', 's1', 2), b('N', 's1', 1, 'key', true)], caption: 'A new book, N, has to go at position 1, between A and B. There is no gap there.' },
      { shelves: [S1], books: [b('A', 's1', 0), b('B', 's1', 2, 'swap'), b('C', 's1', 3, 'swap'), b('N', 's1', 1, 'key', true)], caption: 'Slide every book from position 1 onward one width to the right, starting with the rightmost one (C), so no book bumps into the next.' },
      { shelves: [S1], books: [b('A', 's1', 0), b('B', 's1', 2), b('C', 's1', 3), b('N', 's1', 1, 'swap')], caption: 'Drop N into the gap. The shelf is now full: four books in four places.' },
      { shelves: [S1w], books: [b('A', 's1', 0), b('B', 's1', 2), b('C', 's1', 3), b('N', 's1', 1), b('E', 's1', 4, 'key', true)], caption: 'Book E arrives. The shelf is full, and a wall stops it from getting any longer.' },
      { shelves: [S1w, S2], books: [b('A', 's1', 0), b('B', 's1', 2), b('C', 's1', 3), b('N', 's1', 1), b('E', 's1', 4, 'key', true)], caption: 'Buy a shelf twice as long and put it where there is space.' },
      { shelves: [S1g, S2], books: [b('A', 's2', 0, 'swap'), b('N', 's2', 1, 'swap'), b('B', 's2', 2, 'swap'), b('C', 's2', 3, 'swap'), b('E', 's2', 4, 'key', true)], caption: 'Move every book to the new shelf. This is the expensive moment: four moves just to add one book.' },
      { shelves: [S2top], books: [b('A', 's2', 0), b('N', 's2', 1), b('B', 's2', 2), b('C', 's2', 3), b('E', 's2', 4, 'swap')], caption: 'Put E in its place. Three empty places remain, so the next three books cost one move each.' }
    ];
    var view = a6.shelfView(stageOf(fig));
    stageOf(fig).appendChild(view.svg);
    V.player({ root: fig, steps: steps, baseStepMs: 1400, label: 'Bookshelf controls',
      render: function (st, ctx) { view.render(st, ctx); }, caption: fig.querySelector('[data-caption]') });
  }

  /* ================================================================== address calculator + click quiz */
  function addressFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'a[0], at the base' }, { state: 'found', label: 'Element you picked' }]);
    var cap = fig.querySelector('[data-caption]');
    var calc = a6.addressView(stageOf(fig), { size: 4, index: 5 });
    function say(i, sz) {
      cap.innerHTML = '<b>a[' + i + ']</b> starts ' + i + ' × ' + sz + ' = ' + (i * sz) + ' bytes after the base: ' + A.hex(A.BASE) + ' + ' + (i * sz) + ' = <b>' + A.hex(A.BASE + i * sz) + '</b>. ' +
        (i === 0 ? 'Index 0 is the base itself, which is why arrays count from 0.' : 'One calculation lands there directly; a walk from a[0] would take ' + plural(i, 'step') + '.');
    }
    calc.onSelect(say);
    say(calc.index, calc.size);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Element size', value: 4,
      options: [{ value: 2, label: '2-byte short' }, { value: 4, label: '4-byte int' }, { value: 8, label: '8-byte double' }],
      onChange: function (v) { calc.setSize(v); }
    });
  }
  function addressQuiz() {
    var fig = V.$('#fig-addrquiz');
    var addrs = [0x200C, 0x2010, 0x2014, 0x2018, 0x201C, 0x2020, 0x2024, 0x2028];
    var vals = [31, 8, 57, 14, 90, 26, 3, 45];
    var stage = stageOf(fig);
    stage.appendChild(a6.cellStrip(vals, { size: 46, gap: 12, addrs: addrs.map(function (x) { return A.hex(x); }), ids: vals.map(function (_, k) { return 'q' + k; }),
      idLabel: function (k) { return 'Cell at address ' + A.hex(addrs[k]) + ' holding ' + vals[k]; }, label: 'Eight memory cells labelled by address', scale: 1.25 }));
    V.clickQuiz(stage, {
      el: '#quiz-addr', id: 'addr-a5',
      question: 'Array <code>a</code> holds 4-byte integers and starts at <code>0x2000</code>, off to the left of this window. Click the cell that holds <code>a[5]</code>.',
      answer: 'q2',
      right: 'Yes: 0x2000 + 5 × 4 = 0x2000 + 20 = <b>0x2014</b> (20 is 0x14 in hexadecimal). You found it without looking at a[0] to a[4].',
      wrong: 'Use the formula: base + i × size = 0x2000 + 5 × 4. Remember that 20 in hexadecimal is 0x14.'
    });
  }

  /* ================================================================== shifting */
  var SHIFT_VALUES = [3, 8, 5, 1, 6];
  function shiftFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'New value in hand' }, { state: 'swap', label: 'Moving' }, { state: 'error', label: 'Overwriting' }, { state: 'muted', label: 'Removed' }]);
    var view = V.views.array(stageOf(fig), { mode: 'boxes', label: 'Shifting an array', reserve: { held: true }, cellSize: 52 });
    var mode = 'insert';
    function steps() {
      var s = mode === 'delete' ? A.shiftDemo(SHIFT_VALUES, 8, 'delete', 1) : A.shiftDemo(SHIFT_VALUES, 8, mode, 1, 4);
      return s.map(function (x) { return Object.assign({}, x, { counters: { moves: x.moves, lost: x.lost.length } }); });
    }
    var st = steps();
    view.prepare(st);
    var player = V.player({
      root: fig, steps: st, baseStepMs: 1100, label: 'Shifting controls',
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { moves: 'Elements moved', lost: 'Values lost' }, counterStates: { moves: 'swap', lost: 'error' }
    });
    player.addCheckpoint(function (all) { return all.length && all[0].kind === 'start' && all.some(function (x) { return x.kind === 'shift'; }) && mode === 'insert' ? all.findIndex(function (x) { return x.kind === 'shift'; }) : -1; },
      function () {
        return { question: 'Insert 4 at index 1 of <code>[3, 8, 5, 1, 6]</code>. Which value moves first?',
          options: ['6, the last value', '8, the value at index 1', 'All of them at the same moment', '3, the first value'], answer: 0,
          explain: ['Right. 6 moves into the free slot 5; then 1 can move into the slot 6 just left, and so on back to index 1.',
            'Moving 8 first copies it onto 5, and 5 is lost. The shift has to start from the far end.',
            'A computer moves one element at a time. The order decides whether values survive.',
            '3 sits before index 1 and never moves.'] };
      }, { id: 'shift-first-mover' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Mode', value: mode,
      options: [{ value: 'insert', label: 'Insert' }, { value: 'wrong', label: 'Insert, wrong order' }, { value: 'delete', label: 'Delete' }],
      onChange: function (v) { mode = v; var s2 = steps(); view.reset(); view.prepare(s2); player.setSteps(s2); }
    });
  }

  /* ================================================================== capacity: the neighbours mini-row */
  function neighboursMini() {
    var row = V.$('#mini-neighbours');
    function mem(fill, caption, extra) {
      var svg = a6.miniSvg(320, 104, caption.replace(/<[^>]+>/g, ''), function (svg, t) {
        var labels = fill;
        labels.forEach(function (c, k) {
          var x = 12 + k * 37 + 17, y = 52;
          if (c === 'x') svg.appendChild(t.s('rect', { class: 'a6-foreign', x: x - 17, y: y - 17, width: 34, height: 34, rx: 6 }));
          else if (c === '.') svg.appendChild(t.s('rect', { class: 'vz-slot is-solid', x: x - 17, y: y - 17, width: 34, height: 34, rx: 6 }));
          else { var g = t.cell(svg, 34, 34, c, { font: 14 }); V.place(g, { x: x, y: y }); if (extra && extra.states && extra.states[k]) a6.setState(g, extra.states[k]); }
        });
        if (extra && extra.draw) extra.draw(svg, t);
      });
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, svg), h('figcaption', { html: caption })));
    }
    mem(['3', '8', '5', '1', 'x', 'x', 'x', 'x'], '<b>Full:</b> 4 of 4 slots used, and the bytes right after the block belong to another object.', {
      draw: function (svg, t) {
        t.label(svg, 12, 16, 'your array', 'vz-caption', 'start');
        t.label(svg, 12 + 4 * 37, 16, 'someone else’s data', 'vz-caption', 'start');
        svg.appendChild(t.s('path', { class: 'a6-bracket', d: 'M12 28 H156' }));
      }
    });
    mem(['3', '8', '5', '1', '.', '.', '.', '.'], '<b>Grow:</b> a new block of 8 elsewhere, with the 4 values copied in and 4 free slots of runway.', {
      draw: function (svg, t) { t.label(svg, 12, 16, 'new block · capacity 8', 'vz-caption', 'start'); }
    });
  }

  /* ================================================================== growth by doubling */
  function growthFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Value being appended' }, { state: 'swap', label: 'Written or copied' }, { state: 'muted', label: 'Old block, already copied' }]);
    var view = V.views.array(stageOf(fig), { mode: 'boxes', cellSize: 46, label: 'Dynamic array growing', reserve: { held: true }, height: 290 });
    var steps = A.growthSteps([4, 7, 1, 9, 3, 8, 2, 6, 5]).map(function (s) {
      return Object.assign({}, s, { pointers: s.meta.cap ? s.pointers.filter(function (p) { return p.name === 'size'; }) : [],
        counters: { appendNo: s.meta.appendNo, thisAppend: s.meta.appendCost, copies: s.meta.totalCopies } });
    });
    view.prepare(steps);
    var meters = fig.querySelector('[data-meters]');
    var sizeFill = h('i', { class: 'a6-meter__fill' });
    var sizeText = h('span', { class: 'a6-meter__text' });
    var slotsRow = h('span', { class: 'a6-meter__slots' });
    meters.appendChild(h('div', { class: 'a6-meter', role: 'img', 'aria-label': 'Size and capacity meter' },
      h('span', { class: 'a6-meter__label' }, 'size / capacity'),
      h('span', { class: 'a6-meter__track' }, sizeFill, slotsRow), sizeText));
    var lastCap = -1;
    function meter(size, cap) {
      if (cap !== lastCap) {
        V.clear(slotsRow);
        for (var k = 0; k < Math.max(cap, 1); k++) slotsRow.appendChild(h('b', null));
        slotsRow.style.setProperty('--n', Math.max(cap, 1));
        lastCap = cap;
      }
      sizeFill.style.width = cap ? (size / 16 * 100) + '%' : '0%';
      slotsRow.style.width = (Math.max(cap, 0) / 16 * 100) + '%';
      sizeText.innerHTML = '<b>' + size + '</b> / ' + cap + (cap && size === cap ? ' <em>full</em>' : '');
    }
    var player = V.player({
      root: fig, steps: steps, baseStepMs: 950, label: 'Growth controls',
      render: function (step, ctx) { view.render(step, { duration: ctx.duration }); meter(step.meta.size, step.meta.cap); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { appendNo: 'Append #', thisAppend: 'Work in this append', copies: 'Copies so far' }, counterStates: { thisAppend: 'swap', copies: 'swap' }
    });
    player.addCheckpoint(function (all) { return all.findIndex(function (s) { return s.meta.appendNo === 9 && s.kind === 'alloc'; }); }, function () {
      return { question: 'The array holds 8 values in 8 slots. How many elements will append #9 copy?', options: ['8', '1', '9', '16'], answer: 0,
        explain: ['Every existing value moves to the new block of 16: 8 copies, then 1 write for the new value.',
          'Only a cheap append costs 1. This one finds the array full.',
          'The new value is written, not copied: 8 copies plus 1 write is 9 units of work, but only 8 copies.',
          '16 is the new capacity. Only the 8 values that exist are copied.'] };
    }, { id: 'growth-ninth' });
  }

  /* ================================================================== the lab */
  var CODE = {
    read: {
      pseudo: 'function get(i)\n  if i < 0 or i ≥ size then error     // @bounds\n  return a[i]    // address = base + i × 4   @read',
      js: 'get(i) {\n  if (i < 0 || i >= this.size) throw new RangeError(i);  // @bounds\n  return this.a[i];   // address = base + i × 4   @read\n}',
      py: 'def get(self, i):\n    if i < 0 or i >= self.size: raise IndexError(i)   # @bounds\n    return self.a[i]   # address = base + i × 4   @read'
    },
    search: {
      pseudo: 'function indexOf(x)\n  for j ← 0 to size − 1\n    if a[j] = x then       // @cmp\n      return j             // @found\n  return −1                // @none',
      js: 'indexOf(x) {\n  for (let j = 0; j < this.size; j++) {\n    if (this.a[j] === x) {   // @cmp\n      return j;              // @found\n    }\n  }\n  return -1;                 // @none\n}',
      py: 'def index_of(self, x):\n    for j in range(self.size):\n        if self.a[j] == x:   # @cmp\n            return j         # @found\n    return -1                # @none'
    },
    append: {
      pseudo: 'function append(x)\n  if size = capacity then        // @full\n    grow()\n  a[size] ← x                    // @write\n  size ← size + 1                // @size\n\nfunction grow()\n  newCap ← max(1, 2 × capacity)  // @alloc\n  b ← new array of newCap slots\n  for j ← 0 to size − 1\n    b[j] ← a[j]                  // @copy\n  free a; a ← b                  // @free\n  capacity ← newCap',
      js: 'append(x) {\n  if (this.size === this.capacity) {   // @full\n    this.grow();\n  }\n  this.a[this.size] = x;               // @write\n  this.size++;                         // @size\n}\n\ngrow() {\n  const cap = Math.max(1, 2 * this.capacity);   // @alloc\n  const b = new Array(cap);\n  for (let j = 0; j < this.size; j++) {\n    b[j] = this.a[j];                           // @copy\n  }\n  this.a = b;   // the old block becomes garbage   @free\n  this.capacity = cap;\n}',
      py: 'def append(self, x):\n    if self.size == self.capacity:   # @full\n        self.grow()\n    self.a[self.size] = x            # @write\n    self.size += 1                   # @size\n\ndef grow(self):\n    cap = max(1, 2 * self.capacity)  # @alloc\n    b = [None] * cap\n    for j in range(self.size):\n        b[j] = self.a[j]             # @copy\n    self.a = b                       # @free\n    self.capacity = cap'
    },
    insert: {
      pseudo: 'function insert(i, x)\n  if size = capacity then        // @full\n    grow()\n  for j ← size down to i + 1\n    a[j] ← a[j − 1]              // @shift\n  a[i] ← x                       // @write\n  size ← size + 1                // @size\n\nfunction grow()\n  newCap ← max(1, 2 × capacity)  // @alloc\n  b ← new array of newCap slots\n  for j ← 0 to size − 1\n    b[j] ← a[j]                  // @copy\n  free a; a ← b                  // @free\n  capacity ← newCap',
      js: 'insert(i, x) {\n  if (this.size === this.capacity) {   // @full\n    this.grow();\n  }\n  for (let j = this.size; j > i; j--) {\n    this.a[j] = this.a[j - 1];         // @shift\n  }\n  this.a[i] = x;                       // @write\n  this.size++;                         // @size\n}\n\ngrow() {\n  const cap = Math.max(1, 2 * this.capacity);   // @alloc\n  const b = new Array(cap);\n  for (let j = 0; j < this.size; j++) {\n    b[j] = this.a[j];                           // @copy\n  }\n  this.a = b;   // the old block becomes garbage   @free\n  this.capacity = cap;\n}',
      py: 'def insert(self, i, x):\n    if self.size == self.capacity:   # @full\n        self.grow()\n    for j in range(self.size, i, -1):\n        self.a[j] = self.a[j - 1]    # @shift\n    self.a[i] = x                    # @write\n    self.size += 1                   # @size\n\ndef grow(self):\n    cap = max(1, 2 * self.capacity)  # @alloc\n    b = [None] * cap\n    for j in range(self.size):\n        b[j] = self.a[j]             # @copy\n    self.a = b                       # @free\n    self.capacity = cap'
    },
    delete: {
      pseudo: 'function removeAt(i)\n  removed ← a[i]                 // @take\n  for j ← i to size − 2\n    a[j] ← a[j + 1]              // @shift\n  size ← size − 1                // @size\n  return removed                 // @ret',
      js: 'removeAt(i) {\n  const removed = this.a[i];           // @take\n  for (let j = i; j < this.size - 1; j++) {\n    this.a[j] = this.a[j + 1];         // @shift\n  }\n  this.size--;                         // @size\n  return removed;                      // @ret\n}',
      py: 'def remove_at(self, i):\n    removed = self.a[i]              # @take\n    for j in range(i, self.size - 1):\n        self.a[j] = self.a[j + 1]    # @shift\n    self.size -= 1                   # @size\n    return removed                   # @ret'
    }
  };
  var FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'insert(i, x)', col: 0, row: 0 },
      { id: 'full', type: 'decision', text: 'size = capacity ?', col: 0, row: 1, maxWidth: 150 },
      { id: 'grow', type: 'process', text: 'grow: allocate 2×,\ncopy all, free old', col: 1, row: 1, maxWidth: 170 },
      { id: 'cond', type: 'decision', text: 'j > i ?\n(j starts at size)', col: 0, row: 2, maxWidth: 150 },
      { id: 'shift', type: 'process', text: 'a[j] ← a[j − 1]\nj ← j − 1', col: 1, row: 2, maxWidth: 140 },
      { id: 'write', type: 'process', text: 'a[i] ← x\nsize ← size + 1', col: 0, row: 3, maxWidth: 140 },
      { id: 'done', type: 'end', text: 'done', col: 0, row: 4 }
    ],
    edges: [
      { from: 'start', to: 'full' },
      { from: 'full', to: 'grow', label: 'yes' },
      { from: 'full', to: 'cond', label: 'no' },
      { from: 'grow', to: 'cond' },
      { from: 'cond', to: 'shift', label: 'yes' },
      { from: 'shift', to: 'cond' },
      { from: 'cond', to: 'write', label: 'no' },
      { from: 'write', to: 'done' }
    ]
  };
  var labState = null, labPlayer = null;
  function labFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'New value in hand' }, { state: 'swap', label: 'Moving, copying, writing' }, { state: 'muted', label: 'Old block (copied)' },
      { state: 'compare', label: 'Comparing' }, { state: 'active', label: 'Index i' }, { state: 'found', label: 'Result' }]);
    var view = V.views.array(stageOf(fig), { mode: 'boxes', cellSize: 48, label: 'Array operations lab', reserve: { held: true }, height: 310 });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.insert, default: 'pseudo', maxHeight: 360 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', j: 'swap', x: 'key', 'a[j]': 'compare', removed: 'muted', newCap: 'swap' } });
    var flowFig = V.$('#fig-flow');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already passed' }]);
    var flow = V.views.flowchart(stageOf(flowFig), FLOW, { label: 'Insert and append decision flow' });
    var flowNote = flowFig.querySelector('[data-note]');
    var status = fig.querySelector('[data-status]'), errEl = fig.querySelector('[data-error]');
    var fI = fig.querySelector('#lab-i'), fX = fig.querySelector('#lab-x');
    var op = 'insert', startValues = [3, 8, 5, 1, 6, 9, 2, 7];
    function capFor(vals) { return vals.length ? Math.max(2, nextPow2(vals.length)) : 0; }
    labState = A.makeState(startValues, capFor(startValues));
    function showStatus() {}
    function syncFields() {
      fig.querySelector('[data-idx-wrap]').hidden = !(op === 'read' || op === 'insert' || op === 'delete');
      fig.querySelector('[data-x-wrap]').hidden = !(op === 'search' || op === 'append' || op === 'insert');
    }
    function idle(msg) {
      return [{ rows: [{ id: 'b' + labState.gen, label: 'capacity ' + labState.cap, items: labState.items.map(function (it, k) { return { id: it.id, value: it.value, index: k }; }), length: labState.cap }],
        pointers: [{ name: 'size', index: labState.items.length, state: 'default' }], held: null, caption: msg, line: null, vars: { size: labState.items.length, capacity: labState.cap },
        counters: { reads: 0, writes: 0, shifts: 0, copies: 0 }, flow: null, flowVisited: [], kind: 'idle', meta: { op: op, size: labState.items.length, cap: labState.cap } }];
    }
    function render(step, ctx) {
      if (step.meta) status.innerHTML = 'size <b>' + step.meta.size + '</b> · capacity <b>' + step.meta.cap + '</b>';
      view.render({ rows: step.rows, held: step.held, pointers: step.pointers }, { duration: ctx.duration });
      var usesFlow = step.meta && (step.meta.op === 'append' || step.meta.op === 'insert');
      flow.render({ active: usesFlow ? step.flow : null, visited: usesFlow ? step.flowVisited : [] }, { duration: ctx.duration });
      flowNote.textContent = usesFlow ? (step.flow ? 'Lab step: ' + ({ full: 'is the array full?', grow: 'growing the array', shift: 'shifting one element right', write: 'writing the new value', done: 'finished' })[step.flow] : '') : 'The lab is running ' + ({ read: 'a read', search: 'a search', delete: 'a delete', idle: 'nothing yet' })[step.kind === 'idle' ? 'idle' : step.meta.op] + '. This chart lights up for append and insert.';
    }
    labPlayer = V.player({
      root: fig, steps: idle('Press <b>Run</b> to insert 4 at index 2. The array is full (8 of 8), so watch it grow first.'), render: render, code: code, vars: vars, baseStepMs: 1000, label: 'Lab controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { reads: 'Reads', writes: 'Writes', shifts: 'Shifts', copies: 'Copies' }, counterStates: { reads: 'compare', shifts: 'swap', copies: 'swap' }
    });
    labPlayer.addCheckpoint(function (all) { return all.findIndex(function (s, k) { return s.kind === 'alloc' && all[k - 1] && all[k - 1].meta.size > 0; }); }, function (c) {
      var n = c.prev.meta.size;
      return { question: 'size = capacity = ' + n + '. What has to happen before the new value can be written?',
        options: ['Allocate a block of ' + (2 * n) + ' slots and copy all ' + n + ' values', 'Overwrite the last value', 'Write just past the end of the block', 'Allocate one more slot next to the block'], answer: 0,
        explain: ['Right: a bigger block elsewhere, a copy of every value, then the old block is freed.',
          'That would destroy data. The array has to make room, not reuse a slot.',
          'The bytes after the block belong to something else; writing there corrupts it.',
          'The neighbouring bytes are usually taken, and growing by one slot at a time would copy everything on every append.'] };
    }, { id: 'lab-grow' });
    labPlayer.addCheckpoint(function (all) { return all.findIndex(function (s) { return s.kind === 'insert' && s.line === 'shift'; }); }, function (c) {
      var s0 = c.steps[0], n = s0.meta.size, i = s0.vars.i;
      var opts = [n - i, i, n, 1].map(String);
      var uniq = []; opts.forEach(function (o) { if (uniq.indexOf(o) === -1) uniq.push(o); });
      if (uniq.length < 3) return null;
      return { question: 'Inserting at index ' + i + ' of ' + n + ' values. How many values will shift right?', options: uniq, answer: 0,
        explain: uniq.map(function (o, k) { return k === 0 ? 'Every value from index ' + i + ' to ' + (n - 1) + ' moves: ' + n + ' − ' + i + ' = ' + (n - i) + '.' : 'Count the values from index ' + i + ' to the end: there are ' + (n - i) + '.'; }) };
    }, { id: 'lab-shifts' });
    function run(autoplay) {
      var o = { type: op };
      function num(el) { var t = el.value.trim(); return t === '' ? NaN : Number(t); }
      if (!fig.querySelector('[data-idx-wrap]').hidden) o.index = num(fI);
      if (!fig.querySelector('[data-x-wrap]').hidden) o.value = num(fX);
      var r = A.arrayOp(labState, o);
      if (r.error) { errEl.textContent = r.error; return; }
      errEl.textContent = '';
      code.setSource(CODE[op]);
      view.reset(); view.prepare(r.steps);
      labState = r.state;
      labPlayer.setSteps(r.steps);
      if (autoplay !== false) labPlayer.play();
      showStatus();
      // suggest a sensible next index
      if (autoplay !== false && (op === 'insert' || op === 'append')) { fX.value = String(((Number(fX.value) || 0) % 40) + 3); }
    }
    V.segmented(fig.querySelector('[data-op]'), {
      label: 'Operation', value: op,
      options: [{ value: 'read', label: 'Read a[i]' }, { value: 'search', label: 'Search x' }, { value: 'append', label: 'Append x' }, { value: 'insert', label: 'Insert x at i' }, { value: 'delete', label: 'Delete a[i]' }],
      onChange: function (v) { op = v; syncFields(); errEl.textContent = ''; code.setSource(CODE[op]); }
    });
    fig.querySelector('[data-run]').addEventListener('click', function () { run(true); });
    [fI, fX].forEach(function (f) { f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(true); } }); f.addEventListener('input', function () { errEl.textContent = ''; }); });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Start array (up to 12 values; capacity = next power of two)', value: startValues,
      parse: { min: -99, max: 99, maxCount: 12, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(5, { min: 1, max: 60 }); } },
        { label: 'Full (8 of 8)', value: function () { return V.presets.random(8, { min: 1, max: 40 }); } },
        { label: 'Sorted', value: function () { return V.presets.sorted(6, { min: 1, max: 50 }); } },
        { label: 'Duplicates', value: [7, 3, 7, 1, 7, 2] },
        { label: 'One value', value: [42] },
        { label: 'Empty (capacity 0)', value: [] }
      ],
      applyLabel: 'Load',
      onApply: function (values) {
        labState = A.makeState(values, capFor(values));
        view.reset();
        labPlayer.setSteps(idle(values.length ? 'Loaded ' + plural(values.length, 'value') + ' into a block of ' + labState.cap + ' slots. Pick an operation and press <b>Run</b>.' : 'An empty array with no storage at all (capacity 0). Append something: it will allocate its first block.'));
        showStatus();
      }
    });
    syncFields();
    run(false);   // preload the default operation: insert 4 at index 2 of a full array
    showStatus();
  }

  /* ================================================================== amortized: spikes vs average */
  var SPIKE_N = 40;
  function spikeSteps(policy) {
    var costs = A.appendCosts(SPIKE_N, policy === 'add1' ? { type: 'add', k: 1 } : { type: 'double' });
    var out = [{ k: 0, costs: costs, policy: policy, caption: policy === 'add1' ? 'Now the array grows by <b>one slot</b> each time it is full. Press play.' : 'An empty array that <b>doubles</b> when full. Press play and watch each append’s real cost appear as a bar.', counters: { k: 0, cost: '–', total: 0, avg: '–' } }];
    costs.forEach(function (c) {
      var cap;
      if (policy === 'add1') cap = 'Append #' + c.k + ' finds the array full again and copies all ' + c.copies + ' elements: cost ' + c.cost + '. The average is ' + c.avg.toFixed(1) + ' and keeps climbing, about k / 2.';
      else if (c.copies > 0) cap = 'Append #' + c.k + ' is a <b>spike</b>: the array was full, so it copied ' + c.copies + ' elements and wrote 1, cost <b>' + c.cost + '</b>. But the new capacity (' + c.cap + ') buys ' + (c.cap - c.size) + ' cheap appends. Average so far: ' + c.avg.toFixed(2) + '.';
      else if (c.k === 1) cap = 'Append #1 allocates a first slot and writes: cost 1.';
      else cap = 'Append #' + c.k + ' has room: cost 1. The average drifts down to ' + c.avg.toFixed(2) + ' as the last spike is spread over more appends.';
      out.push({ k: c.k, costs: costs, policy: policy, caption: cap, counters: { k: c.k, cost: c.cost, total: c.total, avg: c.avg.toFixed(2) } });
    });
    out[out.length - 1].caption += policy === 'add1' ? ' 40 appends did ' + costs[SPIKE_N - 1].total + ' units of work.' : ' After 40 appends: ' + costs[SPIKE_N - 1].total + ' units of work, under 3 × 40 = 120.';
    return out;
  }
  function spikesFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'default', label: 'Cheap append (1)', shape: 'outline' }, { state: 'swap', label: 'Append that copied' }, { state: 'active', shape: 'line', label: 'Average so far' }, { state: 'muted', shape: 'dash', label: '3 per append', color: 'var(--ink-3)' }]);
    var view = a6.spikesView(stageOf(fig));
    var policy = 'double';
    var player = V.player({
      root: fig, steps: spikeSteps(policy), baseStepMs: 520, animMs: 380, label: 'Append cost chart controls',
      render: function (st, ctx) { view.render(st, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { k: 'Appends', cost: 'Cost of this one', total: 'Total work', avg: 'Average' }, counterStates: { cost: 'swap', avg: 'active' }
    });
    player.addCheckpoint(function (all) { return all[0].policy === 'double' ? all.findIndex(function (s) { return s.k === 17; }) : -1; }, function () {
      return { question: 'After 16 appends the array holds 16 values in 16 slots. What will append #17 cost?', options: ['17', '1', '3', '16'], answer: 0,
        explain: ['The array is full: copy 16 values into a block of 32, then write 1. The average barely moves because it is spread over 17 appends.',
          'Only an append with a free slot costs 1. There is none.',
          '3 is the amortized charge, a bound on the average, not the cost of any single append.',
          '16 copies plus the write of the new value makes 17.'] };
    }, { id: 'spike-17' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Growth rule', value: policy,
      options: [{ value: 'double', label: 'Double when full' }, { value: 'add1', label: 'Grow by 1 when full' }],
      onChange: function (v) { policy = v; var i = player.index; player.setSteps(spikeSteps(policy), { index: i }); }
    });
  }

  /* ================================================================== bank account */
  function bankFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Coin: one prepaid unit of work', color: 'var(--st-compare)', shape: 'dot' }, { state: 'swap', label: 'Written or copied now' }, { state: 'muted', label: 'Old block' }]);
    var view = a6.bankView(stageOf(fig));
    var raw = A.bankSteps(9), maxB = Math.max.apply(null, raw.map(function (s) { return s.balance; }));
    var steps = raw.map(function (s, i) {
      return Object.assign({}, s, { history: raw.slice(0, i + 1).map(function (b) { return b.balance; }), total: raw.length, maxBalance: maxB,
        counters: { paid: s.charged, work: s.work, bank: s.balance } });
    });
    var player = V.player({
      root: fig, steps: steps, baseStepMs: 1200, label: 'Bank account controls',
      render: function (st, ctx) { view.render(st, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { paid: 'Coins paid (3 per append)', work: 'Real work done', bank: 'Coins in the bank' }, counterStates: { bank: 'compare', work: 'swap' }
    });
    player.addCheckpoint(function (all) { return all.findIndex(function (s) { return s.k === 9 && s.phase === 'copy'; }); }, function () {
      return { question: 'Append #9 must copy 8 elements. Which coins pay for those 8 copies?',
        options: ['The 2 coins stored on each of elements 5, 6, 7 and 8', 'The 3 coins append #9 just paid', 'None: the bank goes negative this time', 'One coin from each of the 8 elements'], answer: 0,
        explain: ['Right. The four elements added since the last doubling carry 2 coins each: 8 coins for 8 copies. The new append’s own coins pay for its write and its future.',
          'Those 3 coins cover this append’s write and 2 coins of savings on the new element; they cannot also pay for 8 copies.',
          'Never: this is the point of charging 3. The bank only dips to its low point right after a doubling.',
          'Elements 1 to 4 already spent their coins on the previous doubling (element 1 still holds one spare coin from the very first append).'] };
    }, { id: 'bank-ninth' });
  }

  /* ================================================================== why double: the copy race */
  function doublingFigure(fig) {
    var N = 100, chart = V.views.chart(stageOf(fig), { type: 'line', label: 'Total copies against number of appends for four growth rules' });
    var rules = [
      { id: 'add1', label: '+1 slot', p: { type: 'add', k: 1 }, state: 'swap' },
      { id: 'add10', label: '+10 slots', p: { type: 'add', k: 10 }, state: 'compare' },
      { id: 'f15', label: '×1.5', p: { type: 'factor', a: 1.5 }, state: 'active' },
      { id: 'x2', label: '×2', p: { type: 'double' }, state: 'done' }
    ];
    rules.forEach(function (r) { r.costs = A.appendCosts(N, r.p); });
    var log = false, steps = [];
    for (var n = 5; n <= N; n += 5) {
      (function (n) {
        var counters = {};
        rules.forEach(function (r) { counters[r.id] = r.costs[n - 1].totalCopies; });
        steps.push({ n: n, caption: 'After <b>' + n + '</b> appends: +1 has copied ' + counters.add1.toLocaleString('en-US') + ' elements, +10 has copied ' + counters.add10 + ', ×1.5 ' + counters.f15 + ' and ×2 ' + counters.x2 + '. ' +
          (n === N ? 'Double n and the +k totals roughly quadruple; the ×2 total only doubles.' : n >= 50 ? 'The adders curve upward like n²; the multipliers stay close to straight lines.' : 'Early on the rules look similar.'), counters: counters });
      }(n));
    }
    function state(st) {
      return {
        x: { label: 'appends n', min: 0, max: N },
        y: log ? { label: 'elements copied (log scale)', scale: 'log', min: 1, max: 10000 } : { label: 'elements copied', min: 0, max: 5000 },
        series: rules.map(function (r) {
          var pts = [];
          for (var k = 1; k <= st.n; k++) pts.push([k, log ? Math.max(1, r.costs[k - 1].totalCopies) : r.costs[k - 1].totalCopies]);
          return { id: r.id, label: r.label, points: pts, state: r.state };
        })
      };
    }
    var player = V.player({
      root: fig, steps: steps, baseStepMs: 700, label: 'Copy race controls',
      render: function (st, ctx) { chart.render(state(st), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { add1: '+1: copies', add10: '+10: copies', f15: '×1.5: copies', x2: '×2: copies' }, counterStates: { add1: 'swap', add10: 'compare', f15: 'active', x2: 'done' }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale (see the small numbers)', checked: false, onChange: function (v) { log = v; chart.render(state(player.step), { duration: 700 }); } });
  }

  /* ================================================================== cost decision tree */
  var TREE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Do you know\nthe index?', col: 0, row: 0 },
      { id: 'search', type: 'end', text: 'Search by value\nO(n)', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Adding or removing\nan element?', col: 0, row: 1 },
      { id: 'rw', type: 'end', text: 'Read or overwrite a[i]\nO(1)', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'At the end?', col: 0, row: 2 },
      { id: 'end', type: 'end', text: 'append / pop\nO(1) amortized', col: 1, row: 2 },
      { id: 'mid', type: 'end', text: 'insert / delete at i\nO(n − i) shifts', col: 0, row: 3 }
    ],
    edges: [
      { from: 'q1', to: 'search', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
      { from: 'q2', to: 'rw', label: 'no' }, { from: 'q2', to: 'q3', label: 'yes' },
      { from: 'q3', to: 'end', label: 'yes' }, { from: 'q3', to: 'mid', label: 'no' }
    ]
  };
  var TREE_TEXT = {
    q1: 'Start here. Click <b>yes</b> or <b>no</b> on an arrow.',
    q2: 'You know the index. Are you changing how many elements there are?',
    q3: 'Where does the element go in or come out?',
    search: '<b>O(n)</b>: without an index, the only way to find a value is to compare element after element (lesson 13 shows how sorting lets binary search do better).',
    rw: '<b>O(1)</b>: one address calculation, one memory access. This is what arrays are for.',
    end: '<b>O(1) amortized</b>: usually one write; occasionally a copy of everything, paid for by the cheap appends before it.',
    mid: '<b>O(n − i)</b>: every element after position i shifts by one slot. Near the front, that is almost all of them.'
  };
  function costTree(fig) {
    var cap = fig.querySelector('[data-caption]');
    var tree = V.views.flowchart(stageOf(fig), TREE, { interactive: true, label: 'Decision tree for the cost of an array operation' });
    var path = ['q1'], taken = {};
    function show() {
      var at = path[path.length - 1];
      var states = {}; if (TREE_TEXT[at] && ['search', 'rw', 'end', 'mid'].indexOf(at) !== -1) states[at] = 'found';
      tree.render({ active: at, visited: path.slice(0, -1), edgeStates: taken, states: states }, { duration: 500 });
      cap.innerHTML = TREE_TEXT[at];
    }
    tree.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    show();
  }

  /* ================================================================== shrinking */
  function shrinkFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Used slot', shape: 'outline' }, { state: 'muted', label: 'Free slot', color: 'var(--bg-sunken)', shape: 'outline' }, { state: 'swap', label: 'Copied in this step' }]);
    var ops = ['push', 'pop', 'push', 'pop', 'push', 'pop', 'push', 'pop'];
    var runs = { half: A.resizePolicy(ops, 'half', 8, 8), quarter: A.resizePolicy(ops, 'quarter', 8, 8) };
    var lanes = {};
    ['half', 'quarter'].forEach(function (k) {
      var el = fig.querySelector('[data-lane="' + k + '"]');
      lanes[k] = { el: el, view: V.views.array(el.querySelector('[data-arr]'), { mode: 'boxes', cellSize: 30, showValues: false, showIndices: false, outerPointers: false, label: 'Array under the ' + k + ' rule' }),
        copies: el.querySelector('[data-copies]'), load: el.querySelector('[data-load]') };
    });
    var steps = runs.half.map(function (hr, i) {
      var qr = runs.quarter[i];
      function describe(r, name) {
        if (!r.op) return '';
        var what = r.op === 'push' ? 'push' : 'pop';
        if (r.event === 'grow') return name + ': ' + what + ' finds it full, doubles to ' + r.cap + ' and copies ' + r.copies + '.';
        if (r.event === 'shrink') return name + ': ' + what + ' leaves ' + r.n + ' of ' + (r.cap * 2) + ', half full, so it halves to ' + r.cap + ' and copies ' + r.copies + '.';
        return name + ': ' + what + ', now ' + r.n + ' of ' + r.cap + '. No copy.';
      }
      var cap = i === 0 ? 'Both arrays start full: 8 of 8. The same operations go to both: push, pop, push, pop…' :
        describe(hr, '<b>½ rule</b>') + ' ' + describe(qr, '<b>¼ rule</b>') + (i === ops.length ? ' Totals: ' + hr.total + ' copies against ' + qr.total + '.' : '');
      return { half: hr, quarter: qr, caption: cap };
    });
    function laneState(r, prev) {
      var items = [];
      for (var k = 0; k < r.n; k++) items.push({ id: 'p' + k, value: '', state: r.event ? 'swap' : (prev && k >= prev.n ? 'swap' : 'default') });
      return { items: items, length: r.cap };
    }
    Object.keys(lanes).forEach(function (k) { lanes[k].view.prepare(steps.map(function (s) { return laneState(s[k]); })); });
    V.player({
      root: fig, steps: steps, baseStepMs: 1300, label: 'Shrink rule controls',
      render: function (st, ctx) {
        ['half', 'quarter'].forEach(function (k) {
          var r = st[k], ln = lanes[k];
          ln.view.render(laneState(r), { duration: ctx.duration });
          ln.copies.innerHTML = 'copies so far: <b>' + r.total + '</b>' + (r.copies ? ' <span class="a6-plus">+' + r.copies + '</span>' : '');
          ln.el.classList.toggle('is-copying', !!r.copies);
          ln.load.style.setProperty('--load', (r.n / r.cap * 100).toFixed(1) + '%');
          ln.load.querySelector('.a6-load__mark').textContent = r.n + ' / ' + r.cap;
          ln.load.style.setProperty('--dur', (ctx.duration || 0) + 'ms');
        });
      },
      caption: fig.querySelector('[data-caption]')
    });
  }

  /* ================================================================== 2D row-major */
  function rowMajorFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Selected element' }, { state: 'visited', label: 'Same row (or column)' }]);
    var cap = fig.querySelector('[data-caption]');
    var rm = a6.rowMajorView(stageOf(fig));
    function say(sel, order) {
      var i = order === 'row' ? A.rowMajorIndex(sel.r, sel.c, 3, 4) : A.colMajorIndex(sel.r, sel.c, 3, 4);
      cap.innerHTML = order === 'row'
        ? '<b>m[' + sel.r + '][' + sel.c + ']</b>: skip ' + sel.r + ' full ' + (sel.r === 1 ? 'row' : 'rows') + ' of 4, then ' + sel.c + ' more: index ' + sel.r + ' × 4 + ' + sel.c + ' = <b>' + i + '</b>, address ' + A.hex(A.BASE) + ' + ' + i + ' × 4 = <b>' + A.hex(A.BASE + 4 * i) + '</b>. Each row is a contiguous run.'
        : 'Column-major (Fortran, MATLAB, R): whole columns are stored one after another, so <b>m[' + sel.r + '][' + sel.c + ']</b> is at index ' + sel.c + ' × 3 + ' + sel.r + ' = <b>' + i + '</b>. Same grid, different memory order.';
    }
    rm.onSelect(say);
    say(rm.selected, rm.order);
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Memory order', value: 'row', options: [{ value: 'row', label: 'Row-major' }, { value: 'col', label: 'Column-major' }], onChange: function (v) { rm.setOrder(v); } });
    fig.querySelector('[data-replay]').addEventListener('click', function () { rm.replay(); });
    V.onVisible(fig, function (vis) { if (vis && !fig.__played) { fig.__played = true; setTimeout(function () { rm.replay(); }, 250); } });
  }

  /* ================================================================== cache walk */
  function cacheFigure(fig) {
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Miss: load a line' }, { state: 'done', label: 'Hit: already cached' }, { state: 'visited', label: 'Read earlier' }, { state: 'frontier', shape: 'outline', label: 'Line in cache' }]);
    var view = a6.cacheView(stageOf(fig));
    var rowW = A.cacheWalk(4, 4, 'row', 4, 2), colW = A.cacheWalk(4, 4, 'col', 4, 2);
    function withVisited(walk) {
      var seen = {};
      return walk.map(function (s) { var v = Object.assign({}, seen); if (s.index !== null) seen[s.index] = true; return Object.assign({}, s, { visitedSet: v }); });
    }
    rowW = withVisited(rowW); colW = withVisited(colW);
    var steps = rowW.map(function (r, k) {
      var c = colW[k], cap;
      if (k === 0) cap = 'Both walks read all 16 numbers of a 4 × 4 grid stored row-major. A cache line holds 4 numbers, and the cache keeps only the 2 most recent lines.';
      else cap = 'Row walk reads m[' + r.r + '][' + r.c + '] (address slot ' + r.index + '): ' + (r.hit ? '<b>hit</b>, its line is already cached.' : '<b>miss</b>, load line ' + r.line + '.') + ' Column walk reads m[' + c.r + '][' + c.c + '] (slot ' + c.index + '): ' + (c.hit ? 'hit.' : '<b>miss</b>, load line ' + c.line + (c.cache.length === 2 && k > 2 ? ', evicting the oldest line' : '') + '.');
      if (k === 16) cap = 'Row walk: <b>' + r.misses + ' line loads</b>, every number in each line used. Column walk: <b>' + c.misses + ' line loads</b>, one number used per load. Same 16 reads, four times the memory traffic.';
      return { row: r, col: c, caption: cap, counters: { rowLoads: r.misses, colLoads: c.misses } };
    });
    V.player({
      root: fig, steps: steps, baseStepMs: 800, label: 'Cache walk controls',
      render: function (st, ctx) { view.render(st, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { rowLoads: 'Row walk: line loads', colLoads: 'Column walk: line loads' }, counterStates: { rowLoads: 'done', colLoads: 'swap' }
    });
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    // swap-with-last delete: a small looping animation
    var host = V.$('[data-mini="swap"]');
    var view = V.views.array(host, { mode: 'boxes', cellSize: 40, label: 'Delete by swapping with the last element', reserve: { held: true } });
    var base = [5, 9, 2, 7, 4];
    function it(k, v, st, idx) { return { id: 'w' + k, value: v, index: idx === undefined ? k : idx, state: st || 'default' }; }
    var loop = [
      { items: base.map(function (v, k) { return it(k, v); }), length: 5, pointers: [{ name: 'size', index: 5, state: 'default' }] },
      { items: [it(0, 5), it(2, 2), it(3, 7), it(4, 4, 'swap')], held: { id: 'w1', value: 9, over: 1, state: 'muted' }, ghosts: [1], length: 5, pointers: [{ name: 'size', index: 5, state: 'default' }] },
      { items: [it(0, 5), it(4, 4, 'swap', 1), it(2, 2), it(3, 7)], length: 5, pointers: [{ name: 'size', index: 4, state: 'default' }] },
      { items: [it(0, 5), it(4, 4, 'default', 1), it(2, 2), it(3, 7)], length: 5, pointers: [{ name: 'size', index: 4, state: 'default' }] }
    ];
    view.prepare(loop);
    V.teaser(host, { steps: loop, stepMs: 1000, holdMs: 1400, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, staticIndex: 2 });
    host.setAttribute('role', 'img'); host.setAttribute('aria-label', 'Animation: the value at index 1 is removed and the last value moves into its place; size drops from 5 to 4.');
    V.codeBlock(V.$('[data-code-block="swap"]'), '// order does not matter: O(1) delete\nfunction removeUnordered(a, i) {\n  a[i] = a[a.length - 1];   // move the last value into the hole\n  a.pop();                  // shrink by one, no shifting\n}', 'js');
    // reserve: copies with and without
    var rv = V.$('[data-mini="reserve"]');
    rv.appendChild(a6.miniSvg(300, 120, 'Bar comparison: 1,023 copies without reserve, 0 copies with reserve', function (svg, t) {
      var copies = A.totalCopies(1000, { type: 'double' });
      t.label(svg, 8, 26, 'grow as you go', 'vz-caption', 'start');
      var bar = t.s('rect', { class: 'a6-rbar is-bad', x: 120, y: 16, width: 150, height: 20, rx: 5 }); svg.appendChild(bar);
      t.label(svg, 276, 26, copies.toLocaleString('en-US'), 'a6-rnum', 'start').setAttribute('text-anchor', 'end');
      t.label(svg, 8, 74, 'reserve(1000)', 'vz-caption', 'start');
      svg.appendChild(t.s('rect', { class: 'a6-rbar is-good', x: 120, y: 64, width: 3, height: 20, rx: 1.5 }));
      t.label(svg, 130, 74, '0 copies', 'a6-rnum', 'start');
      t.label(svg, 8, 108, 'elements copied while appending 1,000 values', 'vz-label', 'start');
    }));
    V.codeBlock(V.$('[data-code-block="reserve"]'), 'std::vector<int> v;\nv.reserve(1000);          // one allocation up front\nfor (int k = 0; k < 1000; k++)\n  v.push_back(k);         // every push: one write', 'cpp');
    // growth factor slider
    var fv = V.$('[data-mini="factor"]'), capEl = V.$('[data-factor-cap]');
    var fstats = V.stats(V.$('[data-factor-stats]'), { labels: { copies: 'Copies per append (at most)', empty: 'Empty just after growing' }, states: { copies: 'swap', empty: 'muted' } });
    var fsvg = a6.miniSvg(300, 96, 'Capacity block right after growing: used part and empty part', function () {});
    fv.appendChild(fsvg);
    var used = V.s('rect', { class: 'a6-fused', x: 10, y: 34, height: 30, rx: 6 }), empty = V.s('rect', { class: 'a6-fempty', y: 34, height: 30, rx: 6 });
    var ut = V.s('text', { class: 'vz-label', y: 80, 'text-anchor': 'middle' }), et = V.s('text', { class: 'vz-label', y: 80, 'text-anchor': 'middle' });
    var tt = V.s('text', { class: 'vz-caption', x: 10, y: 20 }, 'right after a resize');
    [tt, used, empty, ut, et].forEach(function (e) { fsvg.appendChild(e); });
    function setFactor(a) {
      var total = 280, uw = total / a;
      V.animate(used, { attr: { width: uw } }, { duration: 200 });
      empty.setAttribute('x', 10 + uw + 2); V.animate(empty, { attr: { width: Math.max(0, total - uw - 2) } }, { duration: 200 });
      ut.setAttribute('x', 10 + uw / 2); ut.textContent = 'used ' + Math.round(100 / a) + '%';
      et.setAttribute('x', 10 + uw + (total - uw) / 2); et.textContent = a > 1.05 ? 'empty ' + Math.round(100 - 100 / a) + '%' : '';
      capEl.textContent = 'Growth factor ' + a.toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + '.';
      fstats.update({ copies: (a / (a - 1)).toFixed(2), empty: Math.round(100 - 100 / a) + '%' });
    }
    V.slider(V.$('[data-factor-slider]'), { label: 'Factor a', min: 1.1, max: 4, step: 0.05, value: 2, format: function (v) { return v.toFixed(2) + '×'; }, onInput: setFactor });
    setFactor(2);
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-insert0', {
      id: 'insert-front-1000',
      question: 'A dynamic array holds 1,000 values and has spare capacity. How many values must move to insert a new value at index 0?',
      options: ['1,000', '1', 'About 500 on average', '0, because there is spare capacity'], answer: 0,
      explain: ['Every existing value shifts one slot right to open index 0: 1,000 moves, then 1 write.',
        'Only the new value is written, but all 1,000 old values must move first.',
        '500 is the average over random positions. Index 0 is the worst position.',
        'Spare capacity avoids a copy into a new block. It does not open a gap at the front.']
    });
    V.quiz('#quiz-copies17', {
      id: 'copies-17',
      question: 'Start from an empty dynamic array (capacity 0) that doubles when full. How many element copies do 17 appends make in total?',
      options: ['31', '17', '16', '136', '63'], answer: 0,
      explain: ['Copies happen at appends 2, 3, 5, 9 and 17, copying 1 + 2 + 4 + 8 + 16 = 31 elements: fewer than 2 × 17.',
        '17 counts appends, not copies.',
        '16 is only the last, biggest copy. The earlier doublings copied 1 + 2 + 4 + 8 = 15 more.',
        '136 = 0 + 1 + … + 16 is what growing by one slot each time would cost.',
        '63 would include a doubling from 32 to 64, which 17 appends never reach.']
    });
    V.quiz('#quiz-amortized', {
      id: 'amortized-truths',
      question: 'Which statements about a dynamic array that doubles when full are true? Pick all that apply.',
      options: ['Any sequence of n appends from empty costs fewer than 3n units of work.', 'Every single append costs O(1).', 'The O(1) amortized bound assumes the input values are random.', 'Growing by 100 slots each time would also give O(1) amortized appends.', 'Growing by 1.5× instead of 2× still gives O(1) amortized appends.'],
      answer: [0, 4],
      explain: 'True: fewer than 3n in total (n writes plus fewer than 2n copies), and any factor above 1 keeps appends O(1) amortized. False: one append can copy the whole array; amortized bounds involve no randomness at all; and adding a constant makes the total copies grow like n², so each append costs O(n) amortized.'
    });
    V.quiz('#quiz-shrink', {
      id: 'shrink-rule',
      question: 'An array doubles when full. Which shrink rule keeps push and pop O(1) amortized <em>and</em> gives memory back?',
      options: ['Halve the capacity when it is ¼ full', 'Halve the capacity when it is ½ full', 'Shrink to exactly size after every pop', 'Remove one slot after every pop'], answer: 0,
      explain: ['After any resize the array is half full, far from both triggers, so many cheap operations come before the next copy.',
        'At the boundary, push doubles and pop halves: every operation copies everything.',
        'Then the very next push finds the array full and copies everything again.',
        'Shrinking by one slot copies the whole array on every pop.']
    });
    V.quiz('#quiz-2d', {
      id: 'row-major-address',
      question: '<code>int m[3][4]</code> is stored row-major at address <code>0x1000</code> with 4-byte integers. Where does <code>m[2][1]</code> start?',
      options: ['<code>0x1024</code>', '<code>0x1014</code>', '<code>0x1018</code>', '<code>0x1009</code>'], answer: 0,
      explain: ['Index 2 × 4 + 1 = 9, and 9 × 4 = 36 = 0x24 bytes after the base.',
        'That is the column-major index (1 × 3 + 2 = 5). C stores rows together.',
        'That is m[1][2]: row and column swapped.',
        'You found index 9 but forgot to multiply by the 4-byte element size.']
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tile(svg, lbl, text) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, svg), h('p', { class: 'summary__label' }, lbl), h('p', { class: 'summary__text', html: text })));
    }
    tile(a6.cellStrip([7, 42, 13, 5], { size: 30, gap: 3, addrs: ['1000', '1004', '1008', '100C'], label: 'Contiguous elements with addresses' }), 'Contiguous', 'Equal-size elements in one unbroken run of memory.');
    tile(a6.cellStrip([7, 42, 13, 5], { size: 30, gap: 3, states: [0, 0, 'found'], tags: [{ at: 2, text: 'a[2]', state: 'found' }], label: 'Direct access to a[2]' }), 'O(1) index', 'address = base + i × size.');
    tile(a6.cellStrip([7, null, 42, 13, 5], { size: 28, gap: 3, states: [0, 0, 'swap', 'swap', 'swap'], tags: [{ at: 1, text: 'insert', state: 'key' }], label: 'Elements shifted right to open a gap' }), 'O(n − i) insert, delete', 'Everything after i shifts one slot.');
    tile(a6.miniSvg(200, 80, 'A full block of 4 and a block of 8 after doubling', function (svg, t) {
      for (var k = 0; k < 4; k++) { var g = t.cell(svg, 20, 20, '', {}); V.place(g, { x: 14 + k * 23, y: 18 }); }
      for (k = 0; k < 8; k++) { if (k < 4) { var g2 = t.cell(svg, 20, 20, '', {}); a6.setState(g2, 'swap'); V.place(g2, { x: 14 + k * 23, y: 58 }); } else svg.appendChild(t.s('rect', { class: 'vz-slot is-solid', x: 4 + k * 23, y: 48, width: 20, height: 20, rx: 4 })); }
      t.label(svg, 110, 18, 'full', 'vz-caption', 'start');
      svg.appendChild(t.s('path', { class: 'a6-mini-arrow', d: 'M50 31 L50 44' }));
    }), 'Grow by doubling', 'Full? Allocate 2×, copy all, free the old block.');
    tile(a6.miniSvg(200, 80, 'Spiky bars with a flat average line', function (svg, t) {
      var costs = A.appendCosts(18, { type: 'double' });
      costs.forEach(function (c, k) { var hgt = c.cost * 3.3; svg.appendChild(t.s('rect', { class: 'a6-sbar' + (c.copies ? ' is-spike' : ''), x: 8 + k * 10.3, y: 72 - hgt, width: 7, height: hgt, rx: 1.5 })); });
      svg.appendChild(t.s('line', { class: 'a6-savg', x1: 6, x2: 194, y1: 72 - 3 * 3.3, y2: 72 - 3 * 3.3 }));
    }), 'O(1) amortized append', 'Spikes are rare; n appends cost under 3n.');
    tile(a6.miniSvg(200, 80, 'A small grid flattened row by row', function (svg, t) {
      var L = 'ABCDEF';
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) { var g = t.cell(svg, 18, 18, L[r * 3 + c], { font: 10 }); if (r === 1) a6.setState(g, 'visited'); V.place(g, { x: 16 + c * 20, y: 16 + r * 20 }); }
      for (var k = 0; k < 6; k++) { var g3 = t.cell(svg, 18, 18, L[k], { font: 10 }); if (k >= 3) a6.setState(g3, 'visited'); V.place(g3, { x: 90 + k * 18.5, y: 62 }); }
      svg.appendChild(t.s('path', { class: 'a6-mini-arrow', d: 'M72 30 Q86 34 92 48' }));
    }), 'Row-major 2D', 'm[r][c] lives at index r × cols + c.');
  }

  V.ready(function () {
    A = V.algos.arrays; a6 = V.a6;
    heroTeaser();
    addressQuiz();
    neighboursMini();
    checks();
    summaryCard();
    whenNear('#fig-race', raceFigure);
    whenNear('#fig-shelf', shelfFigure);
    whenNear('#fig-address', addressFigure);
    whenNear('#fig-shift', shiftFigure);
    whenNear('#fig-growth', growthFigure);
    var labOnce = function () { if (!labPlayer) labFigure(V.$('#lab-fig')); };
    whenNear('#lab-fig', labOnce);
    whenNear('#fig-flow', labOnce);
    whenNear('#fig-spikes', spikesFigure);
    whenNear('#fig-bank', bankFigure);
    whenNear('#fig-doubling', doublingFigure);
    whenNear('#fig-costtree', costTree);
    whenNear('#fig-shrink', shrinkFigure);
    whenNear('#fig-rowmajor', rowMajorFigure);
    whenNear('#fig-cache', cacheFigure);
    whenNear('#variants', variations);
  });

  V.lessons = V.lessons || {};
  V.lessons['06-arrays'] = { initAll: initAll, get labPlayer() { return labPlayer; }, get labState() { return labState; } };
}());
