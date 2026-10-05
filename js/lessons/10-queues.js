/* Lesson 10 — Queues & deques: hero, intuition minis, checks, summary card and boot.
   Step generators: js/algos/10-queues.js. Custom views/helpers: js/lessons/10-queues-views.js.
   Mechanism figures: 10-queues-figs.js. Labs: 10-queues-labs.js. Heavy figures start lazily near the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L10 = V.lessons.l10;
  function Q() { return V.algos.queues; }

  /* ================================================================== hero teaser: a ticket line */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var steps = Q().ticketLine('j j j s j j s j s s s s'.split(' '));
    var maxLine = steps.reduce(function (m, st) { return Math.max(m, st.line.length); }, 1);
    var narrow = (stage.clientWidth || 999) < 480, x0 = narrow ? 156 : 190;
    var cs = getComputedStyle(stage), H = 232;
    var availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    /* Crop the picture to the stage's own shape (so it is never scaled taller than the stage), give it an even margin, and
       spread the longest line this loop shows across the width so the stage is used instead of hugging the left edge. */
    var margin = narrow ? 12 : 24, minStep = narrow ? 36 : 52, maxStep = narrow ? 44 : 112;
    var W = Math.max(narrow ? 400 : 0, x0 + (maxLine - 1) * minStep + 24 + margin * 2, availW > 0 && availH > 0 ? Math.ceil(H * availW / availH) : 0);
    var step = Math.max(minStep, Math.min(maxStep, (W - margin * 2 - 24 - x0) / Math.max(1, maxLine - 1)));
    var view = L10.ticketLine(stage, { height: H, label: 'A ticket line', width: W, step: step, offset: margin });
    V.teaser(stage, {
      steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      stepMs: 900, holdMs: 1400, staticIndex: 6
    });
  }

  /* ================================================================== intuition: three disciplines as tiny loops */
  function stackSteps(script) {
    var st = [], n = 0, steps = [];
    function snap() { steps.push({ items: st.map(function (x) { return { id: x.id, value: x.value }; }) }); }
    snap();
    script.forEach(function (c) { if (c === '-') st.pop(); else st.push({ id: 's' + (n++), value: c }); snap(); });
    return steps;
  }
  function intuitionMinis() {
    var host = V.$('#mini-intuition');
    var Qs = Q();
    var MINIS = [
      { title: 'Queue', sub: 'first in, first out', cap: '<b>Join at the rear, leave at the front.</b> The value that has waited longest goes next.',
        build: function (stage) {
          var v = V.views.queue(stage, { cellSize: 40, label: 'Queue' });
          var st = Qs.queueOps(Qs.parseOps('1 2 3 d 4 d d d').ops).map(function (s) { return { items: s.items }; });
          v.prepare(st); return { st: st, r: function (s, ctx) { v.render(s, { duration: ctx.duration }); }, still: 3 };
        } },
      { title: 'Stack', sub: 'last in, first out', cap: '<b>Join and leave at the same end.</b> The value that arrived last is the first to go.',
        build: function (stage) {
          var v = V.views.stack(stage, { orientation: 'horizontal', cellSize: 40, capacity: 4, label: 'Stack' });
          var st = stackSteps(['1', '2', '3', '-', '4', '-', '-', '-']);
          v.prepare(st); return { st: st, r: function (s, ctx) { v.render(s, { duration: ctx.duration }); }, still: 3 };
        } },
      { title: 'Deque', sub: 'double-ended', cap: '<b>Join and leave at either end.</b> It can behave as a stack or as a queue, and more.',
        build: function (stage) {
          var v = V.views.deque(stage, { cellSize: 40, label: 'Deque' });
          var m = Qs.dequeCreate(8), st = [{ items: [] }], nx = 1;
          ['pushBack', 'pushBack', 'pushFront', 'pushFront', 'popBack', 'popFront', 'pushBack', 'popFront', 'popFront', 'popBack'].forEach(function (op) {
            var r = Qs.dequeApply(m, op, nx); if (r.ok) { m = r.model; if (op.indexOf('push') === 0) nx++; }
            st.push(Qs.dequeView(m, r.hot).deque);
          });
          v.prepare(st); return { st: st, r: function (s, ctx) { v.render(s, { duration: ctx.duration }); }, still: 4 };
        } }
    ];
    MINIS.forEach(function (m) {
      var stage = h('div', { class: 'mini__stage l10-mini-stage', role: 'img', 'aria-label': m.title + ', ' + m.sub + ': a looping animation' });
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l10-mini-title' }, m.title, h('span', null, ' · ' + m.sub)), stage, h('figcaption', { html: m.cap })));
      var b = m.build(stage);
      V.teaser(stage, { steps: b.st, render: b.r, stepMs: 640, holdMs: 900, staticIndex: b.still });
    });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-headtail', {
      kicker: 'Predict', id: 'l10-head-tail',
      question: 'A ring buffer with capacity <b>5</b> starts empty (head = 0, size = 0). You run <code>enqueue</code> four times, <code>dequeue</code> three times, then <code>enqueue</code> three more times. Where are <code>head</code> and the next write slot <code>tail</code>?',
      options: ['head = 3, tail = 2', 'head = 3, tail = 7', 'head = 0, tail = 2', 'head = 2, tail = 3'],
      answer: 0,
      explain: [
        'Right. Four enqueues write slots 0–3 (tail 4). Three dequeues move head to 3. Three more enqueues write slots 4, 0 and 1, so tail = (3 + 4) mod 5 = 2. The buffer holds 4 values: slots 3, 4, 0, 1.',
        'That is head + size = 3 + 4 = 7 without the wrap. Slot 7 does not exist in a 5-slot array: mod 5 gives 2.',
        'Head moves forward on every dequeue, so after three dequeues it cannot still be 0.',
        'Head and tail are swapped, and each is one off. Count again: head advances once per dequeue (3), tail once per enqueue (7 in total, and 7 mod 5 = 2).'
      ]
    });
    V.quiz('#quiz-spare', {
      id: 'l10-spare-slot',
      question: 'A ring buffer of capacity <b>8</b> keeps only <code>head</code> and <code>tail</code>. To tell full from empty it declares “full” when <code>(tail + 1) mod 8 = head</code>. How many values can it hold?',
      options: ['8', '7', '4', 'It depends on where head is'],
      answer: 1,
      explain: [
        'With 8 values in 8 slots, tail would wrap all the way round to equal head, and the buffer would look empty. The rule prevents that by stopping one value earlier.',
        'Right. The buffer stops one slot early so that head = tail can only ever mean empty. You trade one slot of memory for an unambiguous test.',
        'Half the slots are not needed. Only a single slot is sacrificed.',
        'The test <code>(tail + 1) mod 8 = head</code> is true after exactly 7 values, wherever head happens to be, because tail is always head + count (mod 8).'
      ]
    });
    V.quiz('#quiz-undo', {
      id: 'l10-which-structure', kicker: 'Sort them out',
      question: 'Which of these need a <b>queue</b> (first in, first out) rather than a stack? Pick all that apply.',
      options: ['Print jobs sent to one shared printer', 'The undo history of a text editor', 'Customers waiting for a support agent', 'The browser’s back button', 'Exploring a maze level by level (breadth-first search)'],
      answer: [0, 2, 4],
      explain: [
        'Yes: jobs should print in the order they were sent. A stack would print the newest document first and could leave the oldest waiting forever.',
        'Undo must reverse the <em>latest</em> change first, which is last in, first out: a stack.',
        'Yes: fairness means the person who has waited longest is served first.',
        'Back returns to the page you visited most recently: a stack.',
        'Yes: BFS expands cells in the order they were discovered, so all cells at distance d come before any at distance d + 1.'
      ]
    });
    V.quiz('#quiz-window', {
      id: 'l10-why-pop-back',
      question: 'In the sliding window maximum, a new value arrives that is <b>larger</b> than the value at the back of the deque. Why is it safe to pop that older value?',
      options: ['The new value stays in the window at least as long, and it is bigger, so the older value can never be the maximum again', 'Smaller values are never useful for anything', 'The deque has to stay sorted so binary search works', 'It saves memory, though it might lose the correct answer'],
      answer: 0,
      explain: [
        'Right. The older value leaves the window first, and until it does, the newer, larger value beats it. Once the old value is gone, the new value is still there. So it is dominated for its whole life.',
        'Smaller values are needed when they are the largest <em>remaining</em> in a window. The rule only removes values dominated by a later, larger one.',
        'No binary search is used. The deque is decreasing so that the <em>front</em> is always the maximum, found in O(1).',
        'The answer is exact: only values that can never be the maximum are removed.'
      ]
    });
    // click the answer on a frozen ring
    var host = V.$('#fig-click [data-stage]');
    L10.slotRow(host, { cap: 6, head: 4, values: { 4: 'a', 5: 'b', 0: 'c' }, label: 'A ring buffer of six slots. Slots 4, 5 and 0 hold a, b and c; head is slot 4.' });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l10-click-next-slot',
      question: 'This ring has capacity 6. Its front value <b>a</b> is in slot 4, and the queue holds three values that wrap round the end (a, b, c). Click the slot where the next <code>enqueue</code> will write.',
      check: function (id) {
        var slot = +id.replace('slot-', '');
        if (slot === 1) return true;
        if ({ 4: 1, 5: 1, 0: 1 }[slot]) return { correct: false, message: 'Slot ' + slot + ' already holds an unread value. A write there would destroy it.' };
        if (slot === 3) return { correct: false, message: 'Slot 3 is just before head. It is free, but it is the <em>last</em> slot the queue will reach, not the next.' };
        return { correct: false, message: 'Slot ' + slot + ' is free, but the next write goes to (head + size) mod C = (4 + 3) mod 6, not here.' };
      },
      right: '(head + size) mod C = (4 + 3) mod 6 = 7 mod 6 = 1. The sum 7 runs off the end of the array, and mod 6 wraps it back to slot 1.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: L10.tiles.queue(), label: 'FIFO', text: 'Join at the rear, leave at the front. First in, first out keeps arrival order: fair service.' },
      { svg: L10.tiles.ring(), label: 'Circular buffer', text: 'Index arithmetic mod C reuses freed slots. Full and empty both look like head = tail: keep a size or a spare slot.' },
      { svg: L10.tiles.cost(), label: 'Shifting is O(n)', text: 'Sliding every value left on each dequeue costs O(n). Move an index (ring) or a pointer (linked list): O(1).' },
      { svg: L10.tiles.deque(), label: 'Deque', text: 'Push and pop at both ends in O(1). Head can step backwards: head = (head − 1 + C) mod C.' },
      { svg: L10.tiles.window(), label: 'Monotonic deque', text: 'Sliding window maximum in O(n): drop expired indices at the front, dominated ones at the back.' },
      { svg: L10.tiles.stack(), label: 'Stack vs queue', text: 'Same arrivals, opposite service: a stack can starve the oldest value, a queue never does.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // labs and figures with predictions start lazily: register their check ids now so the page score is stable
    if (V.quizScore && V.quizScore.register) ['l10-ops-deq', 'l10-naive-nospace', 'l10-lab-wrap', 'l10-lab-fullempty', 'l10-win-pops'].forEach(V.quizScore.register);
    heroTeaser();
    checks();
    summaryCard();
    var w = L10.whenNear;
    w('#fig-line', L10.initLine);
    w('#mini-intuition', intuitionMinis);
    w('#fig-ops', L10.initOps);
    w('#fig-naive', L10.initNaive);
    w('#fig-mod', L10.initMod);
    w('#lab-fig', function () { L10.ringLab = L10.initRingLab(); });
    w('#fig-linked', L10.initLinked);
    w('#fig-deque', L10.initDeque);
    w('#fig-svq', L10.initSvq);
    w('#win-fig', function () { L10.winLab = L10.initWindowLab(); });
    w('#fig-twostacks', L10.initTwoStacks);
    w('#fig-bfs', L10.initBfs);
    w('#mini-uses', L10.initUses);
    w('#fig-choose', L10.initChooser);
    w('#fig-cost', L10.initCost);
  });
}());
