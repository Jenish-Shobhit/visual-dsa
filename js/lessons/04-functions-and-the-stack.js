/* Lesson 04 · Functions & the call stack — page wiring.
   Step generators: js/algos/04-functions-and-the-stack.js (VDSA.algos.functions, tested in tests/algos/04-functions-and-the-stack.test.js).
   Custom figures:  js/lessons/04-functions-and-the-stack-figs.js (VDSA.lessons.fn).
   Heavy figures start when they come near the viewport (whenNear), so the page opens fast. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var FN = V.lessons.fn;
  var A = V.algos.functions;

  /* ------------------------------------------------------------------ lazy start */
  var jobs = [], io = null, idleStarted = false;
  function runJob(job) {
    if (job.ran) return;
    job.ran = true;
    if (io) io.unobserve(job.el);
    try { job.fn(job.el); } catch (e) { console.error('[04-functions] figure failed: #' + (job.el && job.el.id), e); }
  }
  function near(el) { var r = el.getBoundingClientRect(), vh = window.innerHeight || 800; return r.bottom > -vh && r.top < vh * 2; }
  function checkJobs() { jobs.forEach(function (j) { if (!j.ran && near(j.el)) runJob(j); }); }
  function idleBuild() {
    if (idleStarted) return; idleStarted = true;
    (function next() {
      var job = jobs.filter(function (j) { return !j.ran; })[0];
      if (!job) return;
      runJob(job);
      setTimeout(next, 140);
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
  window.addEventListener('load', function () { setTimeout(idleBuild, 1600); });

  /* ------------------------------------------------------------------ small helpers */
  function stable(seed, arr) {           // deterministic shuffle that remembers where the right answer went
    var idx = V.shuffle(arr.map(function (_, i) { return i; }), V.rng(seed));
    return { options: idx.map(function (i) { return arr[i]; }), answer: idx.indexOf(0) };
  }
  /* VDSA.legend, plus working `color` overrides. */
  function legend(el, items) {
    el = V.$(el);
    V.legend(el, items);
    items.forEach(function (it, i) {
      if (typeof it === 'object' && it.color && el.children[i]) el.children[i].firstChild.style.setProperty('--sw', it.color);
    });
    return el;
  }
  function code(text) { return '<code>' + text + '</code>'; }
  function block(src) { return '<pre class="fn-quiz-code">' + V.escape(src) + '</pre>'; }
  function setConsole(el, lines) {
    el.classList.toggle('is-empty', !lines.length);
    el.querySelector('.fn-console__out').textContent = lines.length ? lines.join('\n') : 'nothing printed yet';
  }
  var MEM_LEGEND = [
    { state: 'active', label: 'Running frame' },
    { state: 'frontier', label: 'Paused, waiting' },
    { state: 'swap', label: 'Just written' },
    { state: 'done', label: 'Returning a value' },
    { state: 'muted', shape: 'outline', label: 'Unreachable array' }
  ];

  /* ================================================================== hero teaser */
  function teaser() {
    var stage = V.$('#teaser');
    var steps = A.teaser(3, 4);
    /* The memory view reserves room for the tallest state and draws from the top. Centre every state in that room:
       the shorter the stack, the further the drawing slides down (frame height mirrors the view: 28 + 26/row + 6). */
    function stackH(step) { var h = 0; step.frames.forEach(function (f) { h += 28 + f.vars.length * 26 + (f.vars.length ? 6 : 8) + 10; }); return Math.max(0, h - 10); }
    var tallest = Math.max.apply(null, steps.map(stackH));
    var mf = FN.memFig(stage, { label: 'Stack and heap', frameWidth: window.innerWidth > 900 ? 380 : undefined,
      shiftFor: function (step) { return Math.round((tallest - stackH(step)) / 2); } });
    mf.prepare(steps);
    V.teaser(stage, { steps: steps, render: function (step, ctx) { mf.render(step, ctx); }, stepMs: 1150, holdMs: 1800 });
  }

  /* ================================================================== the problem: where does a function return to? */
  function jumps() {
    var fig = V.$('#fig-jumps');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Line running now' },
      { state: 'key', label: 'Return note' },
      { state: 'done', shape: 'line', label: 'Jump back' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    var view = FN.jumpsFig(stage, A.JUMP_LINES);
    V.player({ root: fig, steps: A.jumps(), render: function (step, ctx) { view.render(step, ctx); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, label: 'Function and callers controls' });
    // make the code lines clickable for the check below
    V.$$('.fn-codeline', stage).forEach(function (g, i) { g.setAttribute('data-id', 'L' + (i + 1)); g.setAttribute('data-label', 'Line ' + (i + 1) + ': ' + A.JUMP_LINES[i]); });
    V.clickQuiz(stage, {
      el: '#quiz-jump',
      kicker: 'Predict first',
      question: 'Suppose <code>area(2, 5)</code> has just finished computing 10. Which line does the program continue on? Click it in the figure.',
      check: function (id) {
        var n = +id.slice(1);
        if (n === 6) return true;
        if (n === 5) return { correct: false, message: 'Line 5 is the first call, and it already finished. The note left by <em>this</em> call names the line that made it.' };
        if (n === 2) return { correct: false, message: 'Line 2 is inside the function. The function is done, so control has to leave it.' };
        if (n === 7) return { correct: false, message: 'Line 7 comes after the call, but the call’s own line still has work left: it must store 10 in <code>hall</code>.' };
        return { correct: false, message: 'That line does not call <code>area</code>. Follow the note: which line asked for this result?' };
      },
      right: 'Line 6 made this call, so line 6 is where the note points. The same <code>return</code> sent us to line 5 the first time: the destination is not in the function, it is in the note.'
    });
  }

  /* ================================================================== intuition: a pile of notes */
  function notes() {
    var fig = V.$('#fig-notes');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'Top note: where to go back' },
      { state: 'frontier', label: 'Older notes, waiting' }
    ]);
    var steps = A.notes();
    var view = FN.notesFig(fig.querySelector('[data-stage]'));
    view.prepare(steps);
    V.player({ root: fig, steps: steps, render: function (step, ctx) { view.render(step, ctx); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1700, label: 'Pile of notes controls' });
  }

  /* ================================================================== a call, piece by piece */
  function anatomy() {
    var fig = V.$('#fig-args');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Argument (a value)' },
      { state: 'key', label: 'Parameter (a slot, now filled)' },
      { state: 'compare', label: 'Value used in the body' },
      { state: 'done', label: 'Return value' }
    ]);
    var view = FN.argsFig(fig.querySelector('[data-stage]'));
    var sel = { w: 3, h: 4 };
    var player = V.player({ root: fig, steps: A.argFlight(3, 4), render: view, caption: fig.querySelector('[data-caption]'), baseStepMs: 1700, label: 'Call anatomy controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Arguments', value: '3,4', options: [{ value: '3,4', label: 'area(3, 4)' }, { value: '0,9', label: 'area(0, 9)' }, { value: '-2,5', label: 'area(−2, 5)' }],
      onChange: function (v) { var p = v.split(',').map(Number); sel.w = p[0]; sel.h = p[1]; player.setSteps(A.argFlight(sel.w, sel.h)); }
    });
  }

  /* ================================================================== the call stack: nested calls + timeline */
  function nested() {
    var fig = V.$('#fig-nested');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running (top frame)' },
      { state: 'frontier', label: 'Paused, waiting' },
      { state: 'done', label: 'Returning a value' }
    ]);
    var steps = A.nested();
    var cs = V.views.callstack(fig.querySelector('[data-cs]'), { label: 'Call stack', frameWidth: 230, maxVisible: 6 });
    cs.prepare(steps.map(function (st) { return { frames: st.frames }; }));
    var tl = FN.timelineFig(fig.querySelector('[data-timeline]'), { total: steps.length, rows: 3 });
    var codePanel = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: A.NESTED_CODE.pseudo, js: A.NESTED_CODE.js, py: A.NESTED_CODE.py }, default: 'js', maxHeight: 280 });
    var player = V.player({
      root: fig, steps: steps, code: codePanel, caption: fig.querySelector('[data-caption]'), baseStepMs: 1400, label: 'Nested calls controls',
      render: function (step, ctx) { cs.render({ frames: step.frames }, { duration: ctx.duration }); tl.render(step, ctx); }
    });
    player.addCheckpoint(function (st) { for (var i = 1; i < st.length; i++) if (st[i].kind === 'pop') return i; return -1; }, {
      question: 'square(3) has just returned 9. How many frames are on the stack right after it pops?',
      options: ['1 frame', '2 frames', '3 frames', '0 frames'],
      answer: 1,
      explain: ['main is still there, but it is not alone: hyp2 has not finished.', 'main and hyp2. The square frame is gone; hyp2 resumes, holding 9, and will call square again for b.', 'That was the count a moment ago, with square on top. Its frame has popped.', 'Nothing has finished except square(3). The stack is only empty when main returns.']
    }, { id: 'nested-frames-after-pop' });
  }

  /* ================================================================== scope bubbles */
  function scope() {
    var root = V.$('#fig-scope');
    var api = FN.scopeFig(root);
    V.codeBlock(root.querySelector('[data-src]'), [
      'const rate = 3;',
      '',
      'function double(n) {',
      '  const result = n * rate;',
      '  return result;',
      '}',
      '',
      'function main() {',
      '  const x = 5;',
      '  const y = double(x);',
      '  console.log(y);',
      '}'
    ].join('\n'), 'js');
    return api;
  }

  /* ================================================================== values, references, and the heap */
  function valueVsRef() {
    var fig = V.$('#fig-vvr');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'swap', label: 'Just written' },
      { state: 'compare', label: 'Just read / copied' },
      { state: 'default', shape: 'dot', label: 'Reference (dot + arrow)' }
    ]);
    var steps = A.valueVsRef();
    var L = FN.memFig(fig.querySelector('[data-left]'), { label: 'Numbers: stack only', frameWidth: 150 });
    var R = FN.memFig(fig.querySelector('[data-right]'), { label: 'Arrays: stack and heap', frameWidth: 150 });
    L.prepare(steps.map(function (s) { return s.left; })); R.prepare(steps.map(function (s) { return s.right; }));
    var cl = V.codePanel(fig.querySelector('[data-code-left]'), { languages: { js: A.VVR_CODE.left.join('\n') }, default: 'js', numbers: true });
    var cr = V.codePanel(fig.querySelector('[data-code-right]'), { languages: { js: A.VVR_CODE.right.join('\n') }, default: 'js', numbers: true });
    var oL = fig.querySelector('[data-out-left]'), oR = fig.querySelector('[data-out-right]');
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1600, label: 'Value versus reference controls',
      render: function (step, ctx) {
        L.render(step.left, ctx); R.render(step.right, ctx);
        cl.highlight(step.lineL); cr.highlight(step.lineR);
        setConsole(oL, step.outL ? [step.outL] : []); setConsole(oR, step.outR ? [step.outR] : []);
      }
    });
    player.addCheckpoint(function (st) { return 3; }, {
      question: '<code>ys.push(3)</code> is about to run on the right. What does <code>xs</code> hold afterwards?',
      options: ['[1, 2] (untouched: only ys changes)', '[1, 2, 3] (xs sees it too)', 'An error: xs is not allowed to change'],
      answer: 1,
      explain: ['That would be true if ys held its own array. But ys = xs copied the reference, so there is only one array.', 'One array, two arrows. push follows ys’s arrow to the array, and xs’s arrow leads to the same place.', 'Nothing stops it: xs is only a name for the array. It does not know who else is pushing.']
    }, { id: 'vvr-predict' });
  }

  /* ================================================================== passing into a function */
  var PASS_TITLES = { number: 'Pass a number', mutate: 'Pass an array and mutate it', rebind: 'Pass an array and rebind the parameter' };
  var PASS_PREDICT = {
    number: { question: 'The call is done. What does <code>print(count, r)</code> show?', options: ['5 6', '6 6', '5 5', '6 5'], answer: 0, explain: ['count is still 5: bump changed its own copy, and the 6 came back through the return value into r.', 'That needs bump to change count, but it only ever saw a copy.', 'r received the returned 6, so r is not 5.', 'The order is (count, r). count kept 5 and r got 6.'] },
    mutate: { question: 'The call is done. What does <code>print(list)</code> show?', options: ['[1, 2, 9]', '[1, 2]', '[9]', 'Nothing: add returned nothing'], answer: 0, explain: ['xs and list pointed at the same array, so the push is visible.', 'That would mean add worked on a copy. It got a copy of the reference, not of the array.', '[9] would need list to be replaced. push appends; it does not replace.', 'Returning nothing does not matter: the change was made to the shared array.'] },
    rebind: { question: 'The call is done. What does <code>print(list)</code> show?', options: ['[1, 2]', '[9]', '[1, 2, 9]', 'An error'], answer: 0, explain: ['xs = [9] moved only the local arrow. list still points at the original array.', 'That would need replace to change list itself, and a function cannot rebind its caller’s variable.', 'Nothing was pushed to either array here.', 'Rebinding a parameter is legal and simply local.'] }
  };
  function passing() {
    var fig = V.$('#fig-pass');
    legend(fig.querySelector('[data-legend]'), MEM_LEGEND.slice(0, 3).concat([{ state: 'muted', shape: 'outline', label: 'Unreachable array' }]));
    var kind = 'number', title = fig.querySelector('[data-title]');
    var mf = FN.memFig(fig.querySelector('[data-stage]'), { label: 'Passing into a function' });
    var cp = V.codePanel(fig.querySelector('[data-code]'), { languages: { js: A.PASS_CODE.number.join('\n') }, default: 'js', numbers: true });
    var con = fig.querySelector('[data-console]');
    var steps0 = A.passing(kind); mf.prepare(steps0);
    var player = V.player({
      root: fig, steps: steps0, code: cp, caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, label: 'Passing into a function controls',
      counters: fig.querySelector('[data-counters]'), counterLabels: { depth: 'Frames now', deepest: 'Deepest stack', calls: 'Calls made', returns: 'Returns' }, counterStates: { depth: 'frontier', deepest: 'active' },
      render: function (step, ctx) { mf.render(step, ctx); setConsole(con, step.output); }
    });
    player.addCheckpoint(function (st) { for (var i = 0; i < st.length; i++) if (st[i].kind === 'print') return i; return -1; }, function () {
      var p = PASS_PREDICT[kind];
      return { question: p.question, options: p.options.map(function (o) { return '<code>' + V.escape(o) + '</code>'; }), answer: p.answer, explain: p.explain };
    }, { id: 'pass-predict' });
    function load(k) {
      kind = k;
      title.textContent = PASS_TITLES[k];
      cp.setSource({ js: A.PASS_CODE[k].join('\n') });
      var st = A.passing(k); mf.prepare(st); player.setSteps(st);
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'What is passed', value: kind,
      options: [{ value: 'number', label: 'A number' }, { value: 'mutate', label: 'An array, mutated' }, { value: 'rebind', label: 'An array, rebound' }],
      onChange: load
    });
    title.textContent = PASS_TITLES[kind];
  }

  /* ================================================================== the lab */
  var LAB_INPUT = {
    area: { label: 'Width and height (two whole numbers)', value: '3, 4', placeholder: 'e.g. 3, 4', hint: 'Between −99 and 99. Zero and negatives work too.', presets: [{ label: '3, 4', value: '3, 4' }, { label: '0, 9 (zero)', value: '0, 9' }, { label: '−2, 6 (negative)', value: '-2, 6' }, { label: '12, 12', value: '12, 12' }] },
    total: { label: 'A list of up to 6 whole numbers', value: '4, 7, 1', placeholder: 'e.g. 4, 7, 1', hint: 'An empty list is allowed: the loop simply never runs.', presets: [{ label: '4, 7, 1', value: '4, 7, 1' }, { label: 'Empty', value: '' }, { label: 'One item', value: '9' }, { label: 'Random', value: function () { return V.presets.random(5, { min: -9, max: 20 }).join(', '); } }] },
    grow: { label: 'A list of up to 5 whole numbers', value: '4, 7', placeholder: 'e.g. 4, 7', hint: 'grow appends 5, then rebinds its parameter, then appends 5 again.', presets: [{ label: '4, 7', value: '4, 7' }, { label: 'Empty', value: '' }, { label: 'One item', value: '3' }, { label: 'Five items', value: '1, 2, 3, 4, 5' }] }
  };
  var CALL_FLOW = {
    nodes: [
      { id: 'call', type: 'start', text: 'A call is reached: f(a, b)', col: 0, row: 0 },
      { id: 'eval', type: 'process', text: '1 · Evaluate the arguments', col: 0, row: 1 },
      { id: 'push', type: 'process', text: '2 · Push a frame and note where to return', col: 0, row: 2 },
      { id: 'bind', type: 'process', text: '3 · Copy the arguments into the parameters', col: 0, row: 3 },
      { id: 'run', type: 'process', text: '4 · Run the body, line by line', col: 0, row: 4 },
      { id: 'nested', type: 'decision', text: 'Next line is another call?', col: 0, row: 5 },
      { id: 'ret', type: 'process', text: '5 · Reach return: the value is ready', col: 1, row: 5 },
      { id: 'pop', type: 'process', text: '6 · Pop the frame: its locals vanish', col: 1, row: 6 },
      { id: 'resume', type: 'end', text: '7 · Resume the caller: the value replaces the call', col: 0, row: 6 }
    ],
    edges: [
      { from: 'call', to: 'eval' }, { from: 'eval', to: 'push' }, { from: 'push', to: 'bind' }, { from: 'bind', to: 'run', via: { fromSide: 'bottom', toSide: 'top' } },
      { from: 'run', to: 'nested' },
      { from: 'nested', to: 'eval', label: 'yes', via: { fromSide: 'left', toSide: 'left' } },
      { from: 'nested', to: 'ret', label: 'no' },
      { from: 'ret', to: 'pop', via: { fromSide: 'bottom', toSide: 'top' } },
      { from: 'pop', to: 'resume' },
      { from: 'resume', to: 'nested', label: 'caller carries on', via: { fromSide: 'top', toSide: 'bottom' } }
    ]
  };

  /* Phones: one column, so the boxes keep their full text size. */
  var CALL_FLOW_NARROW = {
    nodes: CALL_FLOW.nodes.map(function (n) {
      var row = { call: 0, eval: 1, push: 2, bind: 3, run: 4, nested: 5, ret: 6, pop: 7, resume: 8 }[n.id];
      return Object.assign({}, n, { col: 0, row: row });
    }),
    edges: CALL_FLOW.edges.map(function (e) {
      return e.from === 'resume' ? Object.assign({}, e, { via: { fromSide: 'right', toSide: 'right' } }) : e;
    })
  };

  function lab() {
    var fig = V.$('#lab-fig');
    legend(fig.querySelector('[data-legend]'), MEM_LEGEND);
    var prog = 'area', input = A.PROGRAMS.area.input.slice();
    var mf = FN.memFig(fig.querySelector('[data-stage]'), { label: 'Call stack and heap' });
    var con = fig.querySelector('[data-console]');
    var srcs = A.labCode(prog, input);
    var cp = V.codePanel(fig.querySelector('[data-code]'), { languages: { pseudo: srcs.pseudo, js: srcs.js, py: srcs.py }, default: 'js', maxHeight: 330 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { running: 'active', waiting: 'frontier', returned: 'done' } });

    // the flowchart, lit by this player
    var flowFig = V.$('#fig-flow');
    legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already used' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), window.innerWidth < 640 ? CALL_FLOW_NARROW : CALL_FLOW, { label: 'What happens on a function call' });
    var flow = {
      highlight: function (id, ctx) {
        var seen = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var i = 0; i < ctx.index; i++) if (st[i].flow && seen.indexOf(st[i].flow) === -1 && st[i].flow !== id) seen.push(st[i].flow);
        }
        flowView.render({ active: id || undefined, visited: seen }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    var steps0 = A.lab(prog, input); mf.prepare(steps0);
    var player = V.player({
      root: fig, steps: steps0, code: cp, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { depth: 'Frames now', deepest: 'Deepest stack', calls: 'Calls made', returns: 'Returns' },
      counterStates: { depth: 'frontier', deepest: 'active', returns: 'done' },
      baseStepMs: 1400, speeds: [0.5, 1, 2, 4], label: 'Call stack lab controls',
      render: function (step, ctx) { mf.render(step, ctx); setConsole(con, step.output); }
    });

    // checkpoint 1: what happens to a frame's variables when it pops
    player.addCheckpoint(function (steps) { for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'pop' && steps[i].fly) return i; return steps.findIndex(function (s) { return s.kind === 'pop' && s.frames.length > 0; }); }, function (c) {
      var callee = c.prev.frames[c.prev.frames.length - 1];
      var name = callee ? callee.fn : 'the function';
      return {
        question: name + ' has computed its answer and is about to return. What happens to its local variables when its frame pops?',
        options: ['They vanish: only the return value is kept', 'They stay in memory until the program ends', 'They are copied into the caller’s frame'],
        answer: 0,
        explain: ['The frame is the home of its parameters and locals. When it pops they are gone; the one thing that crosses back is the return value.', 'They are not kept: the same stack space is reused by the next call. That is why you can call a function a million times without running out of memory.', 'Nothing is copied automatically. The caller receives only the value that <code>return</code> hands back.']
      };
    }, { id: 'lab-pop' });
    // checkpoint 2: the reference program-specific one
    player.addCheckpoint(function (steps) {
      if (prog === 'total') return steps.findIndex(function (s) { return s.kind === 'bind' && s.frames.length === 2; });
      if (prog === 'grow') return steps.findIndex(function (s) { return s.kind === 'mutate'; });
      return -1;
    }, function (c) {
      if (prog === 'total') return {
        question: 'total(scores) is being called and <code>xs</code> receives its argument. How many arrays are on the heap once <code>xs</code> exists?',
        options: ['One: xs shares scores’s array', 'Two: xs gets its own copy', 'One per item in the list'],
        answer: 0,
        explain: ['A reference is copied, not the array. Two arrows, one array.', 'A copy would cost time proportional to the list. Passing a reference is O(1).', 'The items live inside the one array. Nothing here creates a new array per item.']
      };
      return {
        question: '<code>xs.push(' + A.GROW_V + ')</code> is about to run inside <code>grow</code>. Will <code>main</code>’s <code>scores</code> see the new value?',
        options: ['Yes: xs and scores refer to one array', 'No: grow works on its own copy'],
        answer: 0,
        explain: ['push follows xs’s arrow to the array that scores also points at. That is mutation through a shared reference.', 'grow got a copy of the reference, not a copy of the array. Only <em>rebinding</em> xs (the next statement) would break the link.']
      };
    }, { id: 'lab-ref' });

    var seg, inputRow;
    function makeInput() {
      var cfg = LAB_INPUT[prog];
      V.clear(fig.querySelector('[data-input]'));
      inputRow = V.inputRow(fig.querySelector('[data-input]'), {
        label: cfg.label, value: cfg.value, placeholder: cfg.placeholder, hint: cfg.hint, presets: cfg.presets,
        parse: function (text) { return A.parseLabInput(prog, text); },
        onApply: function (values) { input = values; var s = A.labCode(prog, input); cp.setSource({ pseudo: s.pseudo, js: s.js, py: s.py }); var st = A.lab(prog, input); mf.prepare(st); player.setSteps(st); }
      });
    }
    makeInput();
    seg = V.segmented(fig.querySelector('[data-kind]'), {
      label: 'Program to trace', value: prog,
      options: [{ value: 'area', label: 'Nested calls' }, { value: 'total', label: 'Pass an array' }, { value: 'grow', label: 'Mutate, then rebind' }],
      onChange: function (v) { prog = v; makeInput(); var vals = A.parseLabInput(prog, LAB_INPUT[prog].value).values; inputRow.set && inputRow.set(vals); input = vals; var s = A.labCode(prog, input); cp.setSource({ pseudo: s.pseudo, js: s.js, py: s.py }); var st = A.lab(prog, input); mf.prepare(st); player.setSteps(st); }
    });
    return player;
  }

  /* ================================================================== where frames live, and what happens when they run out */
  function layout() {
    var fig = V.$('#fig-layout');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Stack frames' },
      { state: 'visited', label: 'Heap objects' },
      { state: 'error', label: 'Stack full' }
    ]);
    var view = FN.layoutFig(fig.querySelector('[data-stage]'), fig.querySelector('[data-info]'));
    var st = { frames: 1, objs: 0 };
    var fs, os;
    function apply(dur) { view.set(st.frames, st.objs, false, dur); }
    fs = V.slider(fig.querySelector('[data-frames]'), { label: 'Calls in progress', min: 1, max: view.stackMax, value: 1, step: 1, onInput: function (v) { st.frames = v; apply(350); } });
    os = V.slider(fig.querySelector('[data-objs]'), { label: 'Objects on the heap', min: 0, max: 8, value: 0, step: 1, onInput: function (v) { st.objs = v; apply(350); } });
    V.segmented(fig.querySelector('[data-preset]'), {
      label: 'Phase', value: 'start',
      options: [{ value: 'start', label: 'Program starts' }, { value: 'busy', label: 'Busy program' }, { value: 'deep', label: 'Runaway recursion' }],
      onChange: function (v) {
        var t = v === 'start' ? [1, 0] : v === 'busy' ? [4, 5] : [view.stackMax, 3];
        st.frames = t[0]; st.objs = t[1]; fs.set(t[0]); os.set(t[1]); apply(700);
      }
    });
  }

  function overflow() {
    var fig = V.$('#fig-overflow');
    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running' },
      { state: 'frontier', label: 'Waiting' },
      { state: 'done', label: 'Returning' },
      { state: 'error', label: 'Does not fit' }
    ]);
    var CAP = 8, withBase = true;
    var view = V.views.stack(fig.querySelector('[data-stage]'), { label: 'Call stack region with room for ' + CAP + ' frames', capacity: CAP, cellWidth: 200, cellSize: 34 });
    var cp = V.codePanel(fig.querySelector('[data-code]'), { languages: A.OVERFLOW_CODE.base, default: 'js', maxHeight: 260 });
    var con = fig.querySelector('[data-console]');
    function state(step) {
      return { items: step.frames.map(function (f) { return { id: f.id, value: 'countdown(' + (f.n < 0 ? '−' + Math.abs(f.n) : f.n) + ')', state: f.state }; }), capacity: CAP, overflow: step.overflow, label: 'stack region', markers: !step.overflow };
    }
    function gen() { return A.overflow(withBase, CAP); }
    var steps0 = gen(); view.prepare(steps0.map(state));
    var player = V.player({
      root: fig, steps: steps0, code: cp, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { frames: 'Frames on the stack', limit: 'Stack limit' }, counterStates: { frames: 'active', limit: 'error' },
      baseStepMs: 1000, speeds: [0.5, 1, 2, 4], label: 'Stack overflow controls',
      render: function (step, ctx) { view.render(state(step), { duration: ctx.duration }); setConsole(con, step.output); fig.classList.toggle('is-crashed', !!step.overflow); }
    });
    player.addCheckpoint(function (st) { return withBase ? -1 : st.findIndex(function (s) { return s.overflow; }); }, {
      question: 'The stack has room for ' + CAP + ' frames and this function never stops calling itself. What happens when the 9th call starts?',
      options: ['The program crashes with a stack overflow', 'The stack quietly grows to fit', 'The oldest frame is thrown away to make room', 'countdown(0) is reached and it stops'],
      answer: 0,
      explain: ['The region has a fixed size. A frame that does not fit means the program cannot continue, so the runtime stops it with an error.', 'The stack is a fixed-size region set aside before the program runs. It does not resize itself in mid-call.', 'Discarding a waiting frame would lose where to return to. Nothing may be discarded.', 'Without a base case, n just keeps going below 0: −1, −2, −3, … The number never triggers a stop.']
    }, { id: 'overflow-predict' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Version', value: 'with', options: [{ value: 'with', label: 'With a base case' }, { value: 'without', label: 'Base case missing' }],
      onChange: function (v) { withBase = v === 'with'; cp.setSource(withBase ? A.OVERFLOW_CODE.base : A.OVERFLOW_CODE.none); var st = gen(); view.reset(); view.prepare(st.map(state)); player.setSteps(st); }
    });
    var btn = fig.querySelector('[data-measure]'), res = fig.querySelector('[data-measure-out]');
    btn.addEventListener('click', function () {
      var depth = 0;
      function probe() { depth++; probe(); }
      try { probe(); } catch (e) {
        res.innerHTML = 'This browser allowed about <b>' + (Math.round(depth / 100) * 100).toLocaleString('en-US') + '</b> nested calls of a tiny function before throwing <code>' + V.escape(e && e.name ? e.name : 'an error') + '</code>.';
      }
    });
  }

  /* ================================================================== cost: charts */
  function costCharts() {
    var fig = V.$('#fig-cost-depth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Stack frames used by a recursive countdown and by a loop, as n grows' });
    var lin = true;
    function pts(f, max, k) { var out = []; for (var i = 0; i <= k; i++) { var n = Math.round(1 + (max - 1) * i / k); out.push([n, f(n)]); } return out; }
    function draw(dur) {
      var max = lin ? 20000 : 1e6;
      chart.render({
        x: { label: 'countdown(n)', min: 1, max: max, scale: 'linear' },
        y: lin ? { label: 'frames on the stack at once', min: 0, max: 22000 } : { label: 'frames on the stack at once (log scale)', scale: 'log', min: 1, max: 3e6 },
        series: [
          { id: 'rec', label: 'recursive', points: pts(function (n) { return n + 1; }, max, 24), state: 'active' },
          { id: 'loop', label: 'loop', points: pts(function () { return 1; }, max, 24), state: 'done' }
        ],
        annotations: lin ? [{ y: 10000, text: 'a typical limit: about 10,000 frames', state: 'error' }] : [{ y: 10000, text: 'a typical limit: about 10,000 frames', state: 'error' }, { y: 1000, text: 'Python’s default: 1,000', state: 'pivot' }]
      }, { duration: dur });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Range', value: 'lin', options: [{ value: 'lin', label: 'Up to 20,000' }, { value: 'log', label: 'Up to a million (log)' }], onChange: function (v) { lin = v === 'lin'; draw(800); } });
    draw(0);

    var fig2 = V.$('#fig-cost-copy');
    var c2 = V.views.chart(fig2.querySelector('[data-stage]'), { type: 'line', label: 'Values copied when passing an array of n items: a reference versus a full copy' });
    var stats = V.stats(fig2.querySelector('[data-stats]'), { labels: { ref: 'Passing a reference', copy: 'Passing a full copy' }, states: { ref: 'done', copy: 'error' } });
    var n = 50;
    function draw2(dur) {
      c2.render({
        x: { label: 'items in the array (n)', min: 1, max: 100 },
        y: { label: 'values copied per call', min: 0, max: 100 },
        series: [
          { id: 'copy', label: 'copy the array', points: [[1, 1], [100, 100]], state: 'error' },
          { id: 'ref', label: 'copy a reference', points: [[1, 1], [100, 1]], state: 'done' }
        ],
        highlight: [{ series: 'copy', x: n, y: n, label: n + ' values' }, { series: 'ref', x: n, y: 1, label: '1 value' }]
      }, { duration: dur });
      stats.update({ ref: 1, copy: n });
    }
    V.slider(fig2.querySelector('[data-slider]'), { label: 'Array size n', min: 1, max: 100, value: n, onInput: function (v) { n = v; draw2(250); } });
    draw2(0);
  }

  /* ================================================================== variations: pure, impure, copy, swap */
  var VAR_PREDICT = {
    swap: { question: 'The function has run its three lines. What does <code>print(a, b)</code> show?', options: ['1 2', '2 1', '2 2', '1 1'], answer: 0, explain: ['swap changed x and y, which are copies. a and b were never touched.', 'That is what you would hope for, but the swap happened in the wrong boxes.', 'Neither variable could become 2 twice: only the local x and y changed.', 'a stays 1 and b stays 2: the numbers were copied on the way in.'] },
    effect: { question: 'The second call is finished. What does <code>print(a, b)</code> show?', options: ['1 2', '1 1', '2 2', '0 0'], answer: 0, explain: ['Each call bumped the global count once: the first returned 1, the second returned 2.', 'That would need count to reset between calls. It does not: it is global.', 'a was stored after the first call, when count was 1.', 'count starts at 0 but is incremented before it is returned.'] }
  };
  function variants() {
    var fig = V.$('#fig-variants');
    legend(fig.querySelector('[data-legend]'), MEM_LEGEND);
    var kind = 'pure', title = fig.querySelector('[data-title]');
    var mf = FN.memFig(fig.querySelector('[data-stage]'), { label: 'Pure and impure functions' });
    var cp = V.codePanel(fig.querySelector('[data-code]'), { languages: { js: A.VARIANT_CODE.pure.join('\n') }, default: 'js', numbers: true });
    var con = fig.querySelector('[data-console]');
    var st0 = A.variant(kind); mf.prepare(st0);
    var player = V.player({
      root: fig, steps: st0, code: cp, caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, label: 'Function variations controls',
      render: function (step, ctx) { mf.render(step, ctx); setConsole(con, step.output); }
    });
    player.addCheckpoint(function (st) { if (!VAR_PREDICT[kind]) return -1; for (var i = 0; i < st.length; i++) if (st[i].kind === 'print') return i; return -1; }, function () {
      var p = VAR_PREDICT[kind];
      return { question: p.question, options: p.options.map(function (o) { return '<code>' + V.escape(o) + '</code>'; }), answer: p.answer, explain: p.explain };
    }, { id: 'variant-predict' });
    function load(k) {
      kind = k; title.textContent = A.VARIANT_TITLES[k];
      cp.setSource({ js: A.VARIANT_CODE[k].join('\n') });
      var st = A.variant(k); mf.prepare(st); player.setSteps(st);
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Function', value: kind,
      options: [{ value: 'pure', label: 'Pure' }, { value: 'effect', label: 'Impure (global)' }, { value: 'copy', label: 'Copy first' }, { value: 'swap', label: 'Swap numbers' }, { value: 'swapArr', label: 'Swap in an array' }],
      onChange: load
    });
    title.textContent = A.VARIANT_TITLES[kind];
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-print', {
      question: 'What does this print?' + block('function change(n, list) {\n  n = n + 1;\n  list.push(n);\n}\nlet n = 10;\nlet nums = [1];\nchange(n, nums);\nprint(n, nums);'),
      options: ['10 [1]', '11 [1, 11]', '10 [1, 11]', '11 [1]'],
      answer: 2,
      explain: [
        'The push does reach the caller: nums and list are two names for one array.',
        'n is a number, so the caller’s n is a separate box. Only the local n became 11.',
        'The local n becomes 11 and is pushed onto the shared array. The caller’s n is still 10, but the array now holds 11.',
        'The number cannot change in the caller, and the array does change. This has both backwards.'
      ],
      id: 'fn-print'
    });
    V.quiz('#quiz-depth', {
      question: 'How many frames are on the stack at the deepest moment, counting only calls to <code>a</code>, <code>b</code> and <code>c</code>?' + block('function c() { return 1; }\nfunction b() { return c() + c(); }\nfunction a() { return b(); }\na();'),
      options: ['1', '2', '3', '4'],
      answer: 2,
      explain: ['Only one function is running at a time, but its callers wait underneath it.', 'At the deepest moment c is running, b is waiting for it, and a is waiting for b.', 'a calls b, and b calls c: three frames at once. b calls c twice, but one after the other, so the two c frames never coexist.', 'There are four calls in total (a, b, c, c), but the stack never holds all four: the first c is popped before the second starts.'],
      id: 'fn-depth'
    });
    V.quiz('#quiz-survive', {
      question: 'A function finishes and returns. Which of these still exist afterwards? Select all that apply.',
      options: ['Its local variables', 'The value it returned', 'An array it created and returned', 'An array it created and did <em>not</em> return or store anywhere'],
      answer: [1, 2],
      explain: 'Locals live in the frame, and the frame pops on return. The returned value is handed to the caller. An array on the heap survives if something still refers to it, such as the caller’s variable holding the returned reference. An array nobody refers to is unreachable garbage and will be reclaimed.',
      id: 'fn-survive'
    });
    // click-on-figure: the timeline
    var stage = V.$('#fig-check-timeline [data-stage]');
    var steps = A.nested();
    var tl = FN.timelineFig(stage, { total: steps.length, rows: 3, plain: true, label: 'Timeline of the calls made by main: hyp2 and its two square calls' });
    tl.render(steps[steps.length - 1], { duration: 0 });
    V.clickQuiz(stage, {
      el: '#quiz-timeline',
      kicker: 'Click the figure',
      question: 'Which call was already running, and waiting, the whole time <em>both</em> <code>square</code> calls ran? (Not <code>main</code>: click the one <code>main</code> called.)',
      answer: 'h',
      right: '<code>hyp2(3, 4)</code> called square twice, so its bar contains both. Its frame sat under each square frame, waiting for the value.',
      check: function (id, el) {
        if (id === 'h') return true;
        if (id === 'm') return { correct: false, message: 'main is right too, but it called hyp2, not square directly. Click the call that main made.' };
        return { correct: false, message: 'A square call cannot contain both squares: they run one after the other. Look for the bar that spans both.' };
      }
    });
  }

  /* ================================================================== summary */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    FN.summaryTiles().forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    teaser();
    jumps();
    notes();
    anatomy();
    whenNear('#fig-nested', nested);
    whenNear('#fig-scope', scope);
    whenNear('#fig-vvr', valueVsRef);
    whenNear('#fig-pass', passing);
    whenNear('#lab-fig', lab);
    whenNear('#fig-layout', layout);
    whenNear('#fig-overflow', overflow);
    whenNear('#fig-cost-depth', costCharts);
    whenNear('#fig-variants', variants);
    // check ids that always fire are registered now so the page score total does not jump when figures start lazily
    ['nested-frames-after-pop', 'vvr-predict', 'pass-predict', 'lab-pop', 'lab-ref', 'overflow-predict', 'variant-predict'].forEach(function (id) { V.quizScore.register(id); });
    checks();
    summary();
  });
}());
