/* Lesson 12 · Recursion — page wiring.
   Step generators: js/algos/12-recursion.js (VDSA.algos.recursion, tested in tests/algos/12-recursion.test.js).
   Custom figures:  js/lessons/12-recursion-figs.js and js/lessons/12-recursion-hanoi.js (VDSA.lessons.rec).
   Heavy figures start when they come near the viewport (whenNear), so the page opens fast. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var RC = V.lessons.rec;
  var A = V.algos.recursion;

  /* Run fn once, when el comes within about a screen of the viewport. A scroll check backs up the
     IntersectionObserver (fast scrolls can skip it), and once the page is idle the remaining figures are
     built one at a time, so everything is ready before the reader gets there. */
  var jobs = [], io = null, idleStarted = false;
  function runJob(job) {
    if (job.ran) return;
    job.ran = true;
    if (io) io.unobserve(job.el);
    try { job.fn(job.el); } catch (e) { console.error('[12-recursion] figure failed: #' + job.el.id, e); }
  }
  function near(el) { var r = el.getBoundingClientRect(), vh = window.innerHeight || 800; return r.bottom > -vh && r.top < vh * 2; }
  function checkJobs() { jobs.forEach(function (j) { if (!j.ran && near(j.el)) runJob(j); }); }
  function idleBuild() {
    if (idleStarted) return; idleStarted = true;
    (function next() {
      var job = jobs.filter(function (j) { return !j.ran; })[0];
      if (!job) return;
      runJob(job);
      setTimeout(next, 120);
    }());
  }
  function whenNear(el, fn) {
    el = V.$(el);
    if (!el) return;
    var job = { el: el, fn: fn, ran: false };
    jobs.push(job);
    if ('IntersectionObserver' in window) {
      if (!io) io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { var j = jobs.filter(function (x) { return x.el === en.target; })[0]; if (j) runJob(j); } });
      }, { rootMargin: '700px 0px 700px 0px' });
      io.observe(el);
    } else runJob(job);
  }
  var scrollQueued = false;
  window.addEventListener('scroll', function () {
    if (scrollQueued) return; scrollQueued = true;
    setTimeout(function () { scrollQueued = false; checkJobs(); }, 100);
  }, { passive: true });
  window.addEventListener('load', function () { setTimeout(idleBuild, 1500); });

  function stable(seed, arr) {           // deterministic shuffle that remembers where the right answer went
    var idx = V.shuffle(arr.map(function (_, i) { return i; }), V.rng(seed));
    return { options: idx.map(function (i) { return arr[i]; }), answer: idx.indexOf(0) };
  }
  /* VDSA.legend with working `color` overrides (see report: widgets.js sets --sw through Object.assign, which
     browsers ignore for custom properties). */
  function legend(el, items) {
    el = V.$(el);
    V.legend(el, items);
    items.forEach(function (it, i) {
      if (typeof it === 'object' && it.color && el.children[i]) el.children[i].firstChild.style.setProperty('--sw', it.color);
    });
    return el;
  }
  function hash(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }

  function sup(n) { return String(n).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }).join(''); }

  /* ================================================================== hero teaser */
  function teaser() {
    var stage = V.$('#teaser');
    V.teaser(stage, { steps: A.dolls(4), render: RC.dollsView(stage), stepMs: 950, holdMs: 2200 });
  }

  /* ================================================================== the problem */
  function folders() {
    var fig = V.$('#fig-folders');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Counting now' },
      { state: 'frontier', label: 'Waiting for subfolders' },
      { state: 'done', label: 'Total known' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    V.player({ root: fig, steps: A.folders(), render: RC.foldersView(stage), caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'Folder counting controls' });
    V.clickQuiz(stage, {
      el: '#quiz-folders',
      kicker: 'Predict first',
      question: 'The folders are opened top to bottom. Which folder reports its total <em>first</em>? Click it.',
      check: function (id, el) {
        var name = (el.getAttribute('data-label') || '').replace('Folder ', '');
        if (name === '2023') return true;
        if (name === 'home') return { correct: false, message: 'home/ is asked first, but it must wait for every subfolder, so it answers last.' };
        if (name === 'music' || name === 'drafts' || name === '2024') return { correct: false, message: name + '/ has no subfolders, so it could answer at once, but it is not asked first. The folders are visited top to bottom, and photos/ is opened before music/.' };
        return { correct: false, message: name + '/ has subfolders, so it has to wait for their totals first.' };
      },
      right: '2023/ has no subfolders, so its total is just its own 4 files. It is also the first such folder reached: home/ asks photos/, and photos/ asks 2023/ first. Step through to confirm.'
    });
  }

  /* ================================================================== intuition */
  function rows() {
    var fig = V.$('#fig-rows');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Asking now' },
      { state: 'frontier', label: 'Waiting for an answer' },
      { state: 'done', label: 'Knows their row' },
      { state: 'key', label: 'You' }
    ]);
    var steps = A.rows(5);
    var player = V.player({ root: fig, steps: steps, render: RC.rowsView(fig.querySelector('[data-stage]')), caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'Cinema rows controls' });
    player.addCheckpoint(function (st) { for (var i = 1; i < st.length; i++) if (st[i].known[3] !== undefined) return i; return -1; }, {
      question: 'Row 2 now knows it is in row 2 and passes that back. What does the person in row 3 say?',
      options: ['“I’m in row 3”', '“I’m in row 2”', '“I’m in row 5”'],
      answer: 0,
      explain: ['Right: each person adds one to the answer from the row in front.', 'Row 3 must add one to the answer it received: 2 + 1 = 3.', 'Row 3 only knows the answer from row 2; it adds one to get 3. Only you are in row 5.']
    }, { id: 'rows-predict' });
  }

  /* ================================================================== two parts */
  function parts() {
    RC.partsMinis(V.$('#mini-parts'));
    var fig = V.$('#fig-unfold');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'outline', label: 'A call still to expand' },
      { state: 'done', label: 'A known value' }
    ]);
    V.player({ root: fig, steps: A.unfold(4), render: RC.unfoldView(fig.querySelector('[data-stage]')), caption: fig.querySelector('[data-caption]'), baseStepMs: 1400, label: 'Substitution controls' });
  }

  /* ================================================================== call stack */
  function callStack() {
    var fig = V.$('#fig-stack');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running (top frame)' },
      { state: 'done', label: 'Returning a value' }
    ]);
    var steps = A.lab('factorial', 4);
    var cs = V.views.callstack(fig.querySelector('[data-cs]'), { label: 'Call stack for fact(4)', frameWidth: 250, maxVisible: 7 });
    cs.prepare(steps.map(function (st) { return { frames: st.frames }; }));
    var mountain = RC.mountainView(fig.querySelector('[data-mountain]'), steps);
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: 'Call stack controls',
      render: function (step, ctx) { cs.render({ frames: step.frames }, { duration: ctx.duration }); mountain.render(ctx.index, ctx); }
    });
  }

  /* ================================================================== leap of faith */
  function leap() {
    var fig = V.$('#fig-leap');
    var list = [3, 1, 4, 1, 5];
    legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'Closed box: trusted' },
      { state: 'active', shape: 'outline', label: 'Open box: same rule inside' },
      { state: 'done', shape: 'outline', label: 'Base case' }
    ]);
    var view = RC.leapView(fig.querySelector('[data-stage]'), list);
    var note = fig.querySelector('[data-note]');
    function update(k, dur) {
      view.render(k, dur);
      note.innerHTML = k === 0
        ? 'All closed: you trust <code>total([1, 4, 1, 5])</code> to return 11, and check one level only: 3 + 11 = <b>14</b>.'
        : k < list.length
          ? k + ' box' + (k === 1 ? '' : 'es') + ' open. Each open box does the same one-line job and trusts the next box. The top still says 3 + 11 = <b>14</b>.'
          : 'Fully open: the base case <code>total([]) = 0</code> anchors every level, and each level is right because the one below it is. The top never changed: <b>14</b>.';
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Boxes opened', min: 0, max: list.length, value: 0, onInput: function (v) { update(v, 450); } });
    update(0, 0);
  }

  /* ================================================================== the lab */
  var LAB_CODE = {
    factorial: {
      title: 'fact',
      pseudo: 'function fact(n)                 // @sig\n  if n = 0 then                  // @base\n    return 1                     // @baseRet\n  sub ← fact(n − 1)              // @recurse\n  return n × sub                 // @combine',
      js: 'function fact(n) {               // @sig\n  if (n === 0) {                 // @base\n    return 1;                    // @baseRet\n  }\n  const sub = fact(n - 1);       // @recurse\n  return n * sub;                // @combine\n}',
      py: 'def fact(n):                     # @sig\n    if n == 0:                   # @base\n        return 1                 # @baseRet\n    sub = fact(n - 1)            # @recurse\n    return n * sub               # @combine'
    },
    total: {
      title: 'total',
      pseudo: 'function total(a)                     // @sig\n  if a is empty then                  // @base\n    return 0                          // @baseRet\n  rest ← total(a without a[0])        // @recurse\n  return a[0] + rest                  // @combine',
      js: 'function total(a) {                   // @sig\n  if (a.length === 0) {               // @base\n    return 0;                         // @baseRet\n  }\n  const rest = total(a.slice(1));     // @recurse\n  return a[0] + rest;                 // @combine\n}',
      py: 'def total(a):                         # @sig\n    if len(a) == 0:                   # @base\n        return 0                      # @baseRet\n    rest = total(a[1:])               # @recurse\n    return a[0] + rest                # @combine'
    },
    power: {
      title: 'power',
      pseudo: 'function power(x, n)                  // @sig\n  if n = 0 then                       // @base\n    return 1                          // @baseRet\n  half ← power(x, ⌊n / 2⌋)            // @recurse\n  if n is even then\n    return half × half                // @even\n  return half × half × x              // @odd',
      js: 'function power(x, n) {                // @sig\n  if (n === 0) {                      // @base\n    return 1;                         // @baseRet\n  }\n  const half = power(x, Math.floor(n / 2));  // @recurse\n  if (n % 2 === 0) {\n    return half * half;               // @even\n  }\n  return half * half * x;             // @odd\n}',
      py: 'def power(x, n):                      # @sig\n    if n == 0:                        # @base\n        return 1                      # @baseRet\n    half = power(x, n // 2)           # @recurse\n    if n % 2 == 0:\n        return half * half            # @even\n    return half * half * x            # @odd'
    },
    reverse: {
      title: 'reverse',
      pseudo: 'function reverse(s)                   // @sig\n  if length(s) ≤ 1 then               // @base\n    return s                          // @baseRet\n  rest ← reverse(s without s[0])      // @recurse\n  return rest + s[0]                  // @combine',
      js: 'function reverse(s) {                 // @sig\n  if (s.length <= 1) {                // @base\n    return s;                         // @baseRet\n  }\n  const rest = reverse(s.slice(1));   // @recurse\n  return rest + s[0];                 // @combine\n}',
      py: 'def reverse(s):                       # @sig\n    if len(s) <= 1:                   # @base\n        return s                      # @baseRet\n    rest = reverse(s[1:])             # @recurse\n    return rest + s[0]                # @combine'
    },
    fib: {
      title: 'fib',
      pseudo: 'function fib(n)                  // @sig\n  if n < 2 then                  // @base\n    return n                     // @baseRet\n  a ← fib(n − 1)                 // @left\n  b ← fib(n − 2)                 // @right\n  return a + b                   // @combine',
      js: 'function fib(n) {                // @sig\n  if (n < 2) {                   // @base\n    return n;                    // @baseRet\n  }\n  const a = fib(n - 1);          // @left\n  const b = fib(n - 2);          // @right\n  return a + b;                  // @combine\n}',
      py: 'def fib(n):                      # @sig\n    if n < 2:                    # @base\n        return n                 # @baseRet\n    a = fib(n - 1)               # @left\n    b = fib(n - 2)               # @right\n    return a + b                 # @combine'
    }
  };
  var LAB_INPUT = {
    factorial: { label: 'n (0 to 10)', value: '4', placeholder: 'e.g. 4', hint: 'fact(n) makes n + 1 calls.', presets: [{ label: '0 (base case)', value: '0' }, { label: '4', value: '4' }, { label: '7', value: '7' }, { label: '10 (deepest)', value: '10' }] },
    total: { label: 'A list of up to 7 whole numbers', value: '3, 1, 4, 2', placeholder: 'e.g. 3, 1, 4, 2', hint: 'An empty list is allowed: it is the base case.', presets: [{ label: 'Empty list', value: '' }, { label: 'One item', value: '5' }, { label: '3, 1, 4, 2', value: '3, 1, 4, 2' }, { label: 'Random', value: function () { return V.presets.random(6, { min: -9, max: 20 }).join(', '); } }] },
    power: { label: 'x, n (x from −9 to 9, n ≥ 0)', value: '2, 10', placeholder: 'e.g. 2, 10', hint: 'Halving n means about log₂ n calls.', presets: [{ label: '2, 10', value: '2, 10' }, { label: '3, 5 (odd n)', value: '3, 5' }, { label: '2, 0 (base case)', value: '2, 0' }, { label: '2, 50', value: '2, 50' }] },
    reverse: { label: 'A word of up to 8 characters', value: 'stack', placeholder: 'e.g. stack', hint: 'The empty string and single characters are base cases.', presets: [{ label: 'Empty', value: '' }, { label: 'a', value: 'a' }, { label: 'stack', value: 'stack' }, { label: 'racecar', value: 'racecar' }] },
    fib: { label: 'n (0 to 6)', value: '4', placeholder: 'e.g. 4', hint: 'Two calls per call: watch the tree branch and repeat work.', presets: [{ label: '1 (base case)', value: '1' }, { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' }] }
  };

  var FLOW_SPEC = {
    nodes: [
      { id: 'call', type: 'start', text: 'Call f(input)', col: 1, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'test', type: 'decision', text: 'Base case?', col: 1, row: 1, narrow: { col: 0, row: 1 } },
      { id: 'base', type: 'end', text: 'Return the answer directly', col: 2, row: 1, narrow: { col: 1, row: 1 } },
      { id: 'shrink', type: 'process', text: 'Call f on a smaller input', col: 1, row: 2, narrow: { col: 0, row: 2 } },
      { id: 'combine', type: 'process', text: 'Combine its answer with your part', col: 1, row: 3, narrow: { col: 0, row: 3 } },
      { id: 'ret', type: 'end', text: 'Return the combined answer', col: 1, row: 4, narrow: { col: 0, row: 4 } }
    ],
    edges: [
      { from: 'call', to: 'test' },
      { from: 'test', to: 'base', label: 'yes' },
      { from: 'test', to: 'shrink', label: 'no' },
      { from: 'shrink', to: 'call', label: '↺', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'shrink', to: 'combine', label: 'returns' },
      { from: 'combine', to: 'ret' },
    ]
  };

  function lab() {
    var fig = V.$('#lab-fig');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running now' },
      { state: 'frontier', label: 'Waiting for a call to return' },
      { state: 'done', label: 'Returned (value in the chip)' }
    ]);
    var kind = 'factorial';
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: LAB_CODE[kind].pseudo, js: LAB_CODE[kind].js, py: LAB_CODE[kind].py }, default: 'pseudo', maxHeight: 296 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { n: 'active', a: 'active', s: 'active', x: 'active', sub: 'done', rest: 'done', half: 'done', b: 'done', result: 'done', depth: 'frontier' } });
    var tree = V.views.tree(fig.querySelector('[data-tree]'), { label: 'Recursion tree', nodeSize: 34 });
    var cs = V.views.callstack(fig.querySelector('[data-cs]'), { label: 'Call stack', frameWidth: 340, maxVisible: 5 });

    // the recipe flowchart, lit by this player
    var flowFig = V.$('#fig-flow');
    legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Used so far' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_SPEC, { label: 'Recipe for a recursive function' });
    var flow = {
      highlight: function (id, ctx) {
        var seen = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var i = 0; i < ctx.index; i++) if (st[i].flow && seen.indexOf(st[i].flow) === -1) seen.push(st[i].flow);
        }
        flowView.render({ active: id || undefined, visited: seen }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function prep(steps) {
      tree.reset(); cs.reset();
      tree.prepare(steps);
      cs.prepare(steps.map(function (st) { return { frames: st.frames }; }));
      return steps;
    }
    var player = V.player({
      root: fig,
      steps: prep(A.lab(kind, 4)),
      render: function (step, ctx) {
        tree.render(step, { duration: ctx.duration });
        cs.render({ frames: step.frames }, { duration: ctx.duration });
      },
      code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: { calls: 'Calls made', depth: 'Frames now', deepest: 'Deepest stack', repeats: 'Repeated calls' },
      counterStates: { depth: 'frontier', deepest: 'active', repeats: 'error' },
      baseStepMs: 1100,
      speeds: [0.5, 1, 2, 4, 8],
      label: 'Recursion lab controls'
    });

    // predict a return value: the call right under the root, else the root itself
    player.addCheckpoint(function (steps) {
      var at = -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].quiz && steps[i].frames.length === 3) { at = i; break; }
      if (at < 0) for (var j = 1; j < steps.length; j++) if (steps[j].quiz) { at = j; break; }
      return at;
    }, function (c) {
      var q = c.step.quiz;
      var sh = stable(hash(q.label), q.options.map(String));
      return {
        question: q.question,
        options: sh.options.map(function (o) { return '<code>' + o + '</code>'; }),
        answer: sh.answer,
        explain: sh.options.map(function (o, i) { return i === sh.answer ? q.explain : 'Not this one. ' + q.explain; })
      };
    }, { id: 'lab-predict-return' });

    var input = null;
    function makeInput() {
      var cfg = LAB_INPUT[kind];
      input = V.inputRow(fig.querySelector('[data-input]'), {
        label: cfg.label, value: cfg.value, placeholder: cfg.placeholder, hint: cfg.hint,
        presets: cfg.presets,
        parse: function (text) { var r = A.parseLabInput(kind, text); return { values: r.value, error: r.error }; },
        onApply: function (value) { player.setSteps(prep(A.lab(kind, value))); }
      });
    }
    makeInput();
    V.segmented(fig.querySelector('[data-kind]'), {
      label: 'Function to trace',
      options: [
        { value: 'factorial', label: 'Factorial' },
        { value: 'total', label: 'Sum of a list' },
        { value: 'power', label: 'Power' },
        { value: 'reverse', label: 'Reverse' },
        { value: 'fib', label: 'Fibonacci' }
      ],
      value: kind,
      onChange: function (v) {
        kind = v;
        code.setSource({ pseudo: LAB_CODE[v].pseudo, js: LAB_CODE[v].js, py: LAB_CODE[v].py });
        makeInput();
        input.apply();
      }
    });
    return player;
  }

  /* ================================================================== fib explosion + chart */
  function fib() {
    var fig = V.$('#fig-fib');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { calls: 'Calls', distinct: 'Different arguments', wasted: 'Recomputed calls' }, states: { wasted: 'error', distinct: 'done' } });
    var note = fig.querySelector('[data-note]');
    var chipsHost = fig.querySelector('[data-chips]');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'dot', label: 'One call (colour = its argument)', color: 'var(--st-compare)' },
      { state: 'default', shape: 'ring', label: 'Remembered answer (lookup)', color: 'var(--st-compare)' }
    ]);
    var n = 5, memo = false, sel = null, chart = null;
    var view = RC.fibView(fig.querySelector('[data-stage]'), {
      onProgress: function (shown, total) { if (shown < total) stats.update({ calls: shown, distinct: n + 1, wasted: Math.max(0, shown - (n + 1)) }); else update(); }
    });
    function update() {
      var list = A.fibTree(n, memo), calls = list.length;
      stats.update({ calls: calls, distinct: n + 1, wasted: memo ? 0 : calls - (n + 1) });
      var hits = list.filter(function (x) { return x.hit; }).length;
      note.innerHTML = memo
        ? 'With remembered answers, fib(' + n + ') makes <b>' + calls + '</b> call' + (calls === 1 ? '' : 's') + ': ' + (calls - hits) + ' computed once each, plus ' + hits + ' instant lookup' + (hits === 1 ? '' : 's') + '. Naive recursion would make ' + A.fibCalls(n) + '.'
        : 'Naive fib(' + n + ') makes <b>' + calls + '</b> calls, but there are only ' + (n + 1) + ' different arguments (0 to ' + n + '). The other <b>' + (calls - n - 1) + '</b> calls redo work that was already done.';
      // colour chips, one per argument, with how often it is called
      V.clear(chipsHost);
      var count = {};
      list.forEach(function (x) { count[x.n] = (count[x.n] || 0) + 1; });
      for (var k = n; k >= 0; k--) {
        (function (k) {
          var b = h('button', { type: 'button', class: 'rc-chip rc-fn-' + k + (sel === k ? ' is-on' : ''), 'aria-pressed': sel === k ? 'true' : 'false', title: 'Highlight every fib(' + k + ') call' },
            h('span', { class: 'rc-chip__sw', 'aria-hidden': 'true' }), 'fib(' + k + ') ×' + count[k]);
          b.addEventListener('click', function () { sel = sel === k ? null : k; view.highlight(sel); update(); var again = chipsHost.querySelector('.rc-fn-' + k); if (again) again.focus(); });
          chipsHost.appendChild(b);
        }(k));
      }
      if (chart) chart.setN(n);
    }
    var slider = V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 1, max: 9, value: n, format: function (v) { return 'fib(' + v + ')'; },
      onInput: function (v) { n = v; if (sel !== null && sel > n) { sel = null; view.highlight(null); } view.set({ n: n, memo: memo }, 500); update(); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Remember answers', checked: false, onChange: function (on) { memo = on; view.set({ n: n, memo: memo }, 900); update(); } });
    fig.querySelector('[data-replay]').addEventListener('click', function () { view.set({ n: n, memo: memo, grow: true }, 1); });
    void slider;
    view.set({ n: n, memo: memo }, 0);
    update();

    // the chart: naive vs memoised calls, log or linear
    var cfig = V.$('#fig-fibchart');
    var cv = V.views.chart(cfig.querySelector('[data-stage]'), { type: 'line', label: 'Calls made by naive and memoised fib' });
    var naive = [], mem = [];
    for (var k = 0; k <= 30; k++) { naive.push([k, A.fibCalls(k)]); mem.push([k, A.fibMemoCalls(k)]); }
    var logScale = true, curN = n;
    function draw(dur) {
      cv.render({
        x: { label: 'n', min: 0, max: 30 },
        y: logScale ? { label: 'calls (log scale)', scale: 'log', min: 1, max: 1e7 } : { label: 'calls', min: 0, max: 2800000 },
        series: [
          { id: 'naive', label: 'naive', points: naive, state: 'swap' },
          { id: 'memo', label: 'remembered', points: mem, state: 'done' }
        ],
        highlight: { series: 'naive', x: curN, label: A.fibCalls(curN).toLocaleString('en-US') + ' calls' }
      }, { duration: dur });
    }
    V.segmented(cfig.querySelector('[data-seg]'), { label: 'Scale', options: [{ value: 'log', label: 'Log scale' }, { value: 'lin', label: 'Linear' }], value: 'log', onChange: function (v) { logScale = v === 'log'; draw(900); } });
    chart = { setN: function (v) { if (v !== curN) { curN = v; draw(400); } } };
    draw(0);
  }

  /* ================================================================== overflow */
  var COUNTDOWN = {
    with: 'function countdown(n) {\n  if (n === 0) {          // base case\n    print("liftoff");\n    return;\n  }\n  print(n);\n  countdown(n - 1);\n}',
    without: 'function countdown(n) {\n  // base case deleted!\n  print(n);\n  countdown(n - 1);\n}'
  };
  function overflow() {
    var fig = V.$('#fig-overflow');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running call' },
      { state: 'done', label: 'Returning' },
      { state: 'error', label: 'Does not fit: overflow' }
    ]);
    var stackEl = fig.querySelector('[data-stackview]');
    var view = V.views.stack(stackEl, { capacity: 8, label: 'Call stack with room for 8 frames', cellWidth: 150 });
    var src = fig.querySelector('[data-src]'), out = fig.querySelector('[data-console]');
    function steps(withBase) { return A.countdown(3, withBase, 8); }
    var player = V.player({
      root: fig, steps: steps(true), caption: fig.querySelector('[data-caption]'), baseStepMs: 900, label: 'Stack overflow controls',
      render: function (step, ctx) {
        view.render({ items: step.items, capacity: 8, overflow: step.overflow, label: 'call stack (8 frames)' }, { duration: ctx.duration });
        V.clear(out);
        out.appendChild(h('span', { class: 'rc-console__title' }, 'output'));
        step.output.forEach(function (line) { out.appendChild(h('span', { class: 'rc-console__line' }, line)); });
        if (step.overflow) out.appendChild(h('span', { class: 'rc-console__err' }, 'RangeError: Maximum call stack size exceeded'));
        out.classList.toggle('is-crashed', !!step.overflow);
        out.scrollTop = out.scrollHeight;
      }
    });
    function showSrc(which) { V.codeBlock(src, COUNTDOWN[which], 'js'); src.classList.toggle('is-broken', which === 'without'); }
    showSrc('with');
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Version', options: [{ value: 'with', label: 'With a base case' }, { value: 'without', label: 'Base case missing' }], value: 'with',
      onChange: function (v) { showSrc(v); player.setSteps(steps(v === 'with')); } });

    var box = V.$('#measure'), btn = box.querySelector('[data-measure]'), res = box.querySelector('[data-out]');
    btn.addEventListener('click', function () {
      var depth = 0;
      function probe() { depth++; probe(); }
      try { probe(); } catch (e) {
        var kind = e && e.name ? e.name : 'error';
        res.innerHTML = 'This browser allowed about <b>' + (Math.round(depth / 100) * 100).toLocaleString('en-US') + '</b> nested calls of a tiny function before throwing <code>' + V.escape(kind) + '</code>.';
      }
    });
  }

  /* ================================================================== lanes + decision tree */
  function lanes() {
    var fig = V.$('#fig-lanes');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running frame' },
      { state: 'frontier', label: 'Waiting with pending work' },
      { state: 'done', label: 'Returning' }
    ]);
    V.player({ root: fig, steps: A.compare(5), render: RC.lanesView(fig.querySelector('[data-stage]')), caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'), counterLabels: { recursion: 'Frames: recursion', tailCall: 'Frames: tail call', loop: 'Frames: loop' }, counterStates: { recursion: 'frontier' },
      baseStepMs: 900, label: 'Recursion versus loop controls' });
  }
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Nested data, or splits into parts?', col: 0, row: 0 },
      { id: 'loop', type: 'end', text: 'A loop: same work, one frame', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Do subproblems repeat?', col: 0, row: 1 },
      { id: 'memo', type: 'end', text: 'Recursion + remembered answers', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Could the depth reach thousands?', col: 0, row: 2 },
      { id: 'stack', type: 'end', text: 'A loop with your own stack', col: 1, row: 2 },
      { id: 'rec', type: 'end', text: 'Plain recursion: clearest code', col: 0, row: 3 }
    ],
    edges: [
      { from: 'q1', to: 'loop', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
      { from: 'q2', to: 'memo', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'stack', label: 'yes' }, { from: 'q3', to: 'rec', label: 'no' }
    ]
  };
  var CHOOSE_NOTE = {
    q1: 'Start here. Folders, trees, expressions and divide-and-conquer problems are nested or split into parts.',
    loop: '<b>Use a loop.</b> Summing a list or counting down shrinks by one each step; a loop does it in one frame.',
    memo: '<b>Recursion with remembered answers.</b> Fibonacci and grid paths repeat subproblems: store each answer once (dynamic programming, lesson 34).',
    stack: '<b>A loop with your own stack.</b> A 100,000-level linked structure would overflow the call stack; an explicit stack lives in the heap and can grow.',
    rec: '<b>Plain recursion.</b> Tree walks, Hanoi and merge sort read best recursively, and their depth is small (about log n, or the tree height).'
  };
  function choose() {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'When to use recursion' });
    var note = fig.querySelector('[data-note]');
    var path = ['q1'], taken = {};
    function show(dur) {
      var cur = path[path.length - 1];
      var states = {}; if (!/^q/.test(cur)) states[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: taken, states: states }, { duration: dur });
      note.innerHTML = CHOOSE_NOTE[cur];
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(600); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(0); });
    show(0);
  }

  /* ================================================================== fractal */
  function fractal() {
    var fig = V.$('#fig-fractal');
    legend(fig.querySelector('[data-legend]'), [{ state: 'path', shape: 'line', label: 'Trunk (depth 0)' }, { state: 'done', shape: 'line', label: 'Deepest branches' }]);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { depth: 'Depth', calls: 'Calls (segments)', newest: 'Newest branches' }, states: { calls: 'active' } });
    var st = { depth: 5, angle: 26 };
    var view = RC.fractalView(fig.querySelector('[data-stage]'), function (count, d) { stats.update({ depth: d, calls: count + ' = 2' + sup(d + 1) + ' − 1', newest: Math.pow(2, d) }); });
    V.slider(fig.querySelector('[data-depth]'), { label: 'Depth', min: 0, max: 10, value: st.depth, onInput: function (v) { st.depth = v; view.render(st, 520); } });
    V.slider(fig.querySelector('[data-angle]'), { label: 'Angle', min: 5, max: 60, value: st.angle, format: function (v) { return v + '°'; }, onInput: function (v) { st.angle = v; view.render(st, 0); } });
    view.render(st, 0);
  }

  /* ================================================================== cost: time vs space tree, chart */
  function space() {
    var fig = V.$('#fig-space');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'visited', label: 'A call you pay time for' },
      { state: 'path', label: 'Frames on the stack together' },
      { state: 'muted', label: 'Not on the stack at that moment' }
    ]);
    var list = A.fibTree(5, false);
    var view = V.views.tree(fig.querySelector('[data-stage]'), { label: 'Call tree of fib(5)', nodeSize: 36 });
    var deep = {}; ['r', 'rL', 'rLL', 'rLLL', 'rLLLL'].forEach(function (id) { deep[id] = true; });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { calls: 'Calls (time)', frames: 'Most frames at once (space)' }, states: { calls: 'visited', frames: 'path' } });
    function state(mode) {
      var edges = {};
      var nodes = list.map(function (x) {
        var kids = list.filter(function (y) { return y.parent === x.id; }).map(function (y) { return y.id; });
        if (mode === 'space' && x.parent && deep[x.id]) edges[x.parent + '-' + x.id] = 'path';
        return { id: x.id, label: 'fib(' + x.n + ')', children: kids, state: mode === 'time' ? 'visited' : (deep[x.id] ? 'path' : 'muted') };
      });
      return { root: 'r', nodes: nodes, edges: edges };
    }
    var st = state('time');
    view.prepare([st]);
    function show(mode, dur) { view.render(state(mode), { duration: dur }); stats.update({ calls: 15, frames: mode === 'space' ? 5 : '—' }); }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Measure', options: [{ value: 'time', label: 'Time: all calls' }, { value: 'space', label: 'Space: one path' }], value: 'time', onChange: function (v) { show(v, 600); } });
    show('time', 0);
    stats.update({ calls: 15, frames: 5 });
  }
  function costChart() {
    var fig = V.$('#fig-cost');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Total calls against n for five recursive functions', height: (fig.querySelector('[data-stage]').clientWidth || 800) < 520 ? 300 : undefined });
    function pts(f) { var out = []; for (var n = 1; n <= 20; n++) out.push([n, f(n)]); return out; }
    var series = [
      { id: 'hanoi', label: 'hanoi', points: pts(function (n) { return Math.pow(2, n) - 1; }), state: 'pivot' },
      { id: 'fib', label: 'fib, naive', points: pts(A.fibCalls), state: 'swap' },
      { id: 'memo', label: 'fib, remembered', points: pts(A.fibMemoCalls), state: 'done' },
      { id: 'fact', label: 'factorial', points: pts(function (n) { return n + 1; }), state: 'active' },
      { id: 'pow', label: 'power', points: pts(function (n) { return Math.floor(Math.log2(n)) + 2; }), state: 'compare' }
    ];
    var log = true;
    function draw(dur) {
      chart.render({
        x: { label: 'n', min: 1, max: 20 },
        y: log ? { label: 'calls (log scale)', scale: 'log', min: 1, max: 2e6 } : { label: 'calls', min: 0, max: 60 },
        series: series
      }, { duration: dur });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Scale', options: [{ value: 'log', label: 'Log scale' }, { value: 'lin', label: 'Linear (zoomed)' }], value: 'log', onChange: function (v) { log = v === 'log'; draw(900); } });
    draw(0);
  }

  /* ================================================================== variations */
  var BLOCKS = {
    pal: 'function isPal(s, lo = 0, hi = s.length - 1) {\n  if (lo >= hi) return true;          // 0 or 1 characters\n  if (s[lo] !== s[hi]) return false;  // outer pair differs\n  return isPal(s, lo + 1, hi - 1);    // check the inside\n}',
    bs: 'function search(a, t, lo = 0, hi = a.length - 1) {\n  if (lo > hi) return -1;             // empty range\n  const mid = lo + Math.floor((hi - lo) / 2);\n  if (a[mid] === t) return mid;       // found\n  return a[mid] < t\n    ? search(a, t, mid + 1, hi)       // right half only\n    : search(a, t, lo, mid - 1);      // left half only\n}',
    dc: 'function mergeSort(a) {\n  if (a.length <= 1) return a;        // base case\n  const mid = Math.floor(a.length / 2);\n  const left = mergeSort(a.slice(0, mid));\n  const right = mergeSort(a.slice(mid));\n  return merge(left, right);          // combine\n}',
    tail: '// pending work: n × (…) waits in every frame\nfunction fact(n) {\n  if (n === 0) return 1;\n  return n * fact(n - 1);\n}\n\n// tail call: the running product rides along\nfunction factT(n, acc = 1) {\n  if (n === 0) return acc;\n  return factT(n - 1, n * acc);\n}'
  };
  function arrayMini(fig, gen, options, value, label) {
    var view = V.views.array(fig.querySelector('[data-stage]'), { label: label, cellSize: 42 });
    var player;
    function load(v) {
      var st = gen(v);
      view.reset(); view.prepare(st);
      if (player) player.setSteps(st);
      return st;
    }
    player = V.player({ root: fig, steps: load(value), render: function (step, ctx) { view.render(step, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: label + ' controls' });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Input', options: options, value: value, onChange: load });
  }
  function variations() {
    V.tabs('#variants');
    Object.keys(BLOCKS).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), BLOCKS[k], 'js'); });
    V.$('[data-mini="tail"]').appendChild(RC.tailMini());
    whenNear('#fig-pal', function (fig) {
      arrayMini(fig, A.palindrome, [{ value: 'racecar', label: 'racecar' }, { value: 'abba', label: 'abba' }, { value: 'rocket', label: 'rocket' }, { value: 'a', label: 'a' }], 'racecar', 'Palindrome check');
    });
    whenNear('#fig-bs', function (fig) {
      var arr = [2, 5, 8, 12, 16, 23, 38, 42, 56, 72, 91];
      arrayMini(fig, function (t) { return A.binarySearch(arr, t); }, [{ value: 23, label: 'find 23' }, { value: 91, label: 'find 91' }, { value: 40, label: 'find 40 (absent)' }], 23, 'Recursive binary search');
    });
    whenNear('#fig-dc', function (fig) {
      var view = V.views.tree(fig.querySelector('[data-stage]'), { label: 'Merge sort split tree', nodeSize: 30, gap: 0.3 });
      var input = [5, 2, 8, 4, 1, 6, 3, 7];
      function tree(mode) {
        var nodes = [];
        (function go(a, id) {
          var kids = a.length > 1 ? [id + 'L', id + 'R'] : [];
          var shown = mode === 'merge' ? a.slice().sort(function (x, y) { return x - y; }) : a;
          nodes.push({ id: id, label: shown.join(' '), children: kids, state: mode === 'merge' ? 'done' : (a.length === 1 ? 'frontier' : 'default') });
          if (a.length > 1) { var m = a.length >> 1; go(a.slice(0, m), id + 'L'); go(a.slice(m), id + 'R'); }
        }(input, 'm'));
        return { root: 'm', nodes: nodes };
      }
      view.prepare([tree('split')]);
      view.render(tree('split'), { duration: 0 });
      V.segmented(fig.querySelector('[data-seg]'), { label: 'Phase', options: [{ value: 'split', label: 'Split down' }, { value: 'merge', label: 'Merge back up' }], value: 'split', onChange: function (v) { view.render(tree(v), { duration: 700 }); } });
    });
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-digits', {
      question: 'What does <code>f(472)</code> return?<pre class="rc-quiz-code">function f(n) {\n  if (n &lt; 10) return n;\n  return (n % 10) + f(Math.floor(n / 10));\n}</pre>',
      options: ['472', '13', '274', '2'],
      answer: 1,
      explain: [
        'Each call peels off the last digit with n % 10 and adds it; nothing puts the digits back together.',
        'f(472) = 2 + f(47) = 2 + 7 + f(4) = 2 + 7 + 4 = 13. It adds up the digits.',
        'Reversing would need to shift digits by powers of ten. Here each digit is simply added.',
        '2 is only the first digit peeled off. The recursive call adds the rest: 7 and 4.'
      ],
      id: 'rec-digits'
    });
    V.quiz('#quiz-fib5', {
      question: 'How many calls does naive <code>fib(5)</code> make, counting the first one?',
      options: ['5', '8', '15', '32'],
      answer: 2,
      explain: [
        'That is the number of levels, not calls: fib(5) and fib(4) each branch into two more calls.',
        '8 is fib(6), a Fibonacci number, not the call count.',
        'calls(n) = calls(n − 1) + calls(n − 2) + 1: 1, 1, 3, 5, 9, 15. In general 2·fib(n + 1) − 1.',
        'The tree is not a full binary tree: the fib(n − 2) branch is shallower, so there are fewer than 2⁵ calls.'
      ],
      id: 'rec-fib5'
    });
    V.quiz('#quiz-hanoi5', {
      question: 'What is the fewest number of moves that solves the Tower of Hanoi with <b>5</b> discs?',
      options: ['10', '25', '31', '32'],
      answer: 2,
      explain: [
        'Two moves per disc is not enough: the smaller discs must move out of the way and back for every larger disc.',
        '25 = 5² would be a quadratic cost; Hanoi doubles with every disc.',
        'M(5) = 2·M(4) + 1 = 2·15 + 1 = 31 = 2⁵ − 1.',
        'Close: 2⁵ − 1 = 31. The single biggest-disc move is counted once, not twice.'
      ],
      id: 'rec-hanoi5'
    });
    V.quiz('#quiz-progress', {
      question: 'Which calls finish? Select all that apply.<pre class="rc-quiz-code">function g(n) {\n  if (n === 0) return 0;\n  return g(n - 2);\n}</pre>',
      options: ['<code>g(4)</code>', '<code>g(3)</code>', '<code>g(0)</code>', '<code>g(−2)</code>'],
      answer: [0, 2],
      explain: 'g(4) → g(2) → g(0) hits the base case, and g(0) is the base case. g(3) → g(1) → g(−1) → … jumps over 0 and never stops, and g(−2) moves further away. Every path must actually land on a base case, not just move toward it.',
      id: 'rec-progress'
    });
    V.quiz('#quiz-space', {
      question: 'Naive <code>fib(30)</code> makes 2,692,537 calls. At most how many of its frames are on the stack at the same time?',
      options: ['2,692,537', 'About 1.3 million', '30', '60'],
      answer: 2,
      explain: [
        'Frames are popped as soon as their call returns; they are not all alive together.',
        'Half the calls are never alive together either: a call’s frame is gone before its sibling starts.',
        'Only one root-to-leaf path is on the stack at once, and the longest path is fib(30), fib(29), …, fib(1): 30 frames.',
        'The two recursive calls happen one after the other, not at the same time, so they never double the depth.'
      ],
      id: 'rec-space'
    });
  }

  /* ================================================================== summary */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    RC.summaryTiles().forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    teaser();
    folders();
    rows();
    parts();
    whenNear('#fig-stack', callStack);
    whenNear('#fig-leap', leap);
    whenNear('#lab-fig', lab);
    whenNear('#fig-fib', fib);
    whenNear('#fig-hanoi', RC.hanoiLab);
    whenNear('#fig-overflow', overflow);
    whenNear('#fig-lanes', lanes);
    whenNear('#fig-choose', choose);
    whenNear('#fig-fractal', fractal);
    whenNear('#fig-space', space);
    whenNear('#fig-cost', costChart);
    variations();
    checks();
    summary();
  });
}());
