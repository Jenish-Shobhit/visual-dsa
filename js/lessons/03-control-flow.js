/* Lesson 03 · Decisions & loops — page wiring.
   Step generators: js/algos/03-control-flow.js (VDSA.algos.lesson03, tested in tests/algos/03-control-flow.test.js).
   Figures: js/lessons/03-control-flow-figs.js and -labs.js (VDSA.lessons.cf).
   Heavy figures start when they come near the viewport (whenNear), so the page opens fast. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos.lesson03;
  var CF = V.lessons.cf;
  var num = A.num;

  /* Run fn once, when el comes within about a screen of the viewport. A scroll check backs up the
     IntersectionObserver, and once the page is idle the remaining figures are built one at a time. */
  var jobs = [], io = null, idleStarted = false;
  function runJob(job) {
    if (job.ran) return;
    job.ran = true;
    if (io) io.unobserve(job.el);
    try { job.fn(job.el); } catch (e) { console.error('[03-control-flow] figure failed: #' + job.el.id, e); }
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
  function whenNear(sel, fn) {
    var el = V.$(sel);
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

  /* ================================================================== hero: a token circling a loop */
  function teaser() {
    var stage = V.$('#teaser');
    var flowHost = h('div', { class: 'cf-hero__flow' });
    var pips = [0, 1, 2].map(function (k) { return h('span', { class: 'cf-pip', 'aria-hidden': 'true' }); });
    var big = h('span', { class: 'cf-hero__n' }, '0');
    var wrap = h('div', { class: 'cf-hero' }, flowHost, h('div', { class: 'cf-hero__count' }, h('span', { class: 'cf-hero__k' }, 'count'), big, h('div', { class: 'cf-pips' }, pips)));
    stage.appendChild(wrap);
    /* Wide stage: spread the flowchart over the width it has (larger column and row gaps) so it does not sit as a
       small island beside the count tile; narrow stage: the view's own compact levels. */
    var flow = null, wide = null, lastState = { active: null };
    function mount() {
      var w = stage.clientWidth >= 640;
      if (w === wide && flow) return;
      wide = w; V.clear(flowHost);
      flow = V.views.flowchart(flowHost, CF.specs.hero, w ? { label: 'A loop drawn as a flowchart', colGap: 168, rowGap: 52 } : { label: 'A loop drawn as a flowchart' });
      if (lastState.active) flow.render(lastState, { duration: 0 });
    }
    mount();
    V.onResize(stage, mount);
    var last = -1;
    V.teaser(stage, {
      steps: A.countLoop(3), stepMs: 850, holdMs: 1500,
      render: function (st, ctx) {
        lastState = { active: st.active };
        flow.render({ active: st.active }, { duration: ctx.duration });
        big.textContent = st.count;
        if (st.count !== last && ctx.duration) { big.classList.remove('is-bump'); void big.offsetWidth; big.classList.add('is-bump'); }
        last = st.count;
        pips.forEach(function (p, k) { p.classList.toggle('is-on', k < st.count); });
        wrap.classList.toggle('is-done', st.active === 'done');
      }
    });
  }

  /* ================================================================== three building blocks (static flowcharts) */
  function blocks() {
    var row = V.$('#mini-blocks');
    [
      { spec: CF.specs.seq, name: 'Sequence', cap: '<b>Sequence.</b> Do A, then B, then C. Nothing is decided and nothing repeats.', label: 'Sequence: A then B then C' },
      { spec: CF.specs.choice, name: 'Choice', cap: '<b>Choice.</b> A test picks A or B, and both paths join again. This is <code>if / else</code>.', label: 'Choice: a test picks A or B, then both continue to C' },
      { spec: CF.specs.loopMini, name: 'Loop', cap: '<b>Loop.</b> While the test is true, do A and test again. This is <code>while</code>.', label: 'Loop: while the test is true do A, then leave to C' }
    ].forEach(function (b) {
      var stage = h('div', { class: 'mini__stage cf-mini-flow' });
      row.appendChild(h('figure', { class: 'mini' }, stage, h('figcaption', { html: b.cap })));
      V.views.flowchart(stage, b.spec, { label: b.label });
    });
  }

  /* ================================================================== the cost chart */
  function costFigure() {
    var fig = V.$('#fig-cost');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'How many times the innermost body runs, as n grows', height: 320 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'n', one: 'Single loop', two: 'Nested loop', tri: 'Triangle', log: 'Halving loop' }, states: { two: 'pivot', tri: 'path', log: 'done' } });
    var log = false, n = 12;
    var series = [
      { id: 'single', label: 'single loop: n', fn: A.ITER.single, state: 'active' },
      { id: 'triangle', label: 'triangle: n(n−1)/2', fn: A.ITER.triangle, state: 'path' },
      { id: 'nested', label: 'nested: n × n', fn: A.ITER.nested, state: 'pivot' },
      { id: 'halving', label: 'halving: ⌊log₂ n⌋ + 1', fn: A.ITER.halving, state: 'done' }
    ];
    function show(dur) {
      chart.render({
        x: { label: 'n (size of the input)', min: 2, max: 30 },
        y: log ? { label: 'body runs (log scale)', scale: 'log', min: 1, max: 1000 } : { label: 'body runs', min: 0, max: 900 },
        series: series,
        highlight: [{ series: 'single', x: n, label: '' + n }, { series: 'nested', x: n, label: '' + n * n }]
      }, { duration: dur });
      stats.update({ n: n, one: A.ITER.single(n), two: A.ITER.nested(n), tri: A.ITER.triangle(n), log: A.ITER.halving(n) });
    }
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'single loop' }, { state: 'path', shape: 'line', label: 'triangle' }, { state: 'pivot', shape: 'line', label: 'nested' }, { state: 'done', shape: 'line', label: 'halving' }]);
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: 30, value: n, onInput: function (v) { n = v; show(120); } });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Vertical scale', value: 'lin', options: [{ value: 'lin', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { log = v === 'log'; show(700); } });
    show(600);
  }

  /* ================================================================== variations */
  function chips(values, states) {
    return h('div', { class: 'cf-vchips', role: 'img', 'aria-label': 'Values of i: ' + values.join(', ') }, h('span', { class: 'cf-vchips__k' }, 'i ='),
      values.map(function (v, k) { return h('span', { class: 'cf-vchip' + (states && states[k] ? ' is-' + states[k] : '') }, num(v)); }));
  }
  function variations() {
    V.tabs('#variants');
    var minis = {
      same: chips(A.loopValues({ from: 0, to: 4 })),
      down: chips(A.loopValues({ from: 5, to: 1, step: -1 })),
      skip: chips(A.loopValues({ from: 0, to: 8, step: 2 })),
      stop: chips([3, 8, 5, 12, 7], ['visited', 'visited', 'visited', 'found', 'muted'])
    };
    var blocks = {
      same: 'for (let i = 0; i < 5; i++) { use(i); }\n\nlet i = 0;\nwhile (i < 5) { use(i); i++; }\n\nfor (const x of items) { use(x); }   // no i at all',
      down: 'for (let i = 5; i >= 1; i--) {\n  use(i);          // 5, 4, 3, 2, 1\n}',
      skip: 'for (let i = 0; i <= 8; i += 2) {\n  use(i);          // 0, 2, 4, 6, 8\n}',
      stop: 'let found = -1;\nfor (let i = 0; i < a.length; i++) {\n  if (a[i] > 10) { found = i; break; }\n}'
    };
    Object.keys(minis).forEach(function (k) {
      V.$('[data-mini="' + k + '"]').appendChild(minis[k]);
      V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js');
    });
  }

  /* ================================================================== checks */
  function simulateStops(step, start, target) {
    var i = start;
    for (var t = 0; t < 200; t++) { if (i === target) return true; i = step(i); if (Math.abs(i) > 1e6) return false; }
    return false;
  }
  function checks() {
    var cnt = A.loopCount({ from: 3, to: 10, step: 2 });
    var cOpts = [3, 4, 5, 8];
    V.quiz('#quiz-count', {
      id: 'cf-count-body', kicker: 'Predict',
      question: 'How many times does the body of <code>for (let i = 3; i &lt;= 10; i += 2)</code> run?',
      options: cOpts.map(String), answer: cOpts.indexOf(cnt),
      explain: cOpts.map(function (c) {
        return c === cnt ? 'i takes the values 3, 5, 7 and 9: four trips. Then i = 11 fails <code>i &lt;= 10</code> and the loop ends.'
          : c === 3 ? 'You stopped at 7. Is 9 &le; 10? Yes, so a fourth trip runs with i = 9.'
            : c === 5 ? 'That counts i = 11, but 11 &le; 10 is false: the loop stops before the body sees it.'
              : 'That is the number of integers from 3 to 10. The loop steps by 2, so it visits only every second one.';
      })
    });
    var truth = [[false, false], [true, false], [false, true], [true, true]];
    var tAns = truth.map(function (r) { return !A.truth('and', r[0], r[1]); }).indexOf(false);
    V.quiz('#quiz-truth', {
      id: 'cf-not-and', kicker: 'Truth table',
      question: 'For which inputs is <code>!(A &amp;&amp; B)</code> <b>false</b>?',
      options: truth.map(function (r) { return 'A = ' + r[0] + ', B = ' + r[1]; }), answer: tAns,
      explain: truth.map(function (r) {
        var and = A.truth('and', r[0], r[1]);
        return and ? 'A &amp;&amp; B is true here, and NOT flips it to false. Right.' : 'A &amp;&amp; B is false here, so <code>!(…)</code> is true, not false.';
      })
    });
    var ups = [{ t: 'i = i + 1', f: function (i) { return i + 1; } }, { t: 'i = i + 2', f: function (i) { return i + 2; } }, { t: 'i = i + 3', f: function (i) { return i + 3; } },
      { t: 'i = i − 1', f: function (i) { return i - 1; } }, { t: 'i = i * 2', f: function (i) { return i * 2; } }];
    var ok = []; ups.forEach(function (u, k) { if (simulateStops(u.f, 1, 10)) ok.push(k); });
    V.quiz('#quiz-stops', {
      id: 'cf-terminate', kicker: 'Progress',
      question: 'The loop is <code>let i = 1; while (i != 10) { … }</code>. Which update lines make it <b>stop</b>? Pick all that do.',
      options: ups.map(function (u) { return '<code>' + u.t + '</code>'; }), answer: ok,
      explain: 'Only updates that land exactly on 10 stop a <code>!=</code> loop. Adding 1 visits 2 … 10, and adding 3 visits 1, 4, 7, 10. Adding 2 gives 1, 3, 5, 7, 9, 11 and steps over 10; doubling gives 1, 2, 4, 8, 16 and jumps over it; subtracting 1 walks away. A test of <code>i &lt; 10</code> would be more forgiving.'
    });
    V.quiz('#quiz-battery', {
      id: 'cf-battery-order', kicker: 'Order matters',
      question: 'A chain tests <code>level &gt;= 20</code> first (amber), then <code>level &gt;= 50</code> (green), and otherwise shows red. What does it show for a level of 80?',
      options: ['green', 'amber', 'red'], answer: 1,
      explain: ['Green is the intent, but the chain never gets that far.', '80 &ge; 20 is true, so the first branch wins and every later test is skipped. Put the strictest test first.', 'Red is the last resort, reached only when every test above it is false.']
    });
  }

  function fourLoops() {
    var host = V.$('#fig-fourloops [data-stage]');
    var loops = [{ id: 'a', h: 'for (let i = 0; i <= n; i++)' }, { id: 'b', h: 'for (let i = 1; i < n; i++)' }, { id: 'c', h: 'for (let i = 0; i < n; i++)' }, { id: 'd', h: 'for (let i = 1; i <= n; i++)' }];
    var grid = h('div', { class: 'cf-four' });
    loops.forEach(function (l) {
      var card = h('div', { class: 'cf-four__card', 'data-id': l.id, 'data-label': l.h }, h('code', { class: 'cf-four__h' }, l.h), h('code', { class: 'cf-four__b' }, '  read(a[i]);'), h('code', {}, '}'));
      grid.appendChild(card);
    });
    host.appendChild(grid);
    V.clickQuiz(host, {
      el: '#quiz-fourloops', id: 'cf-four-loops',
      question: 'The array <code>a</code> has <code>n</code> boxes, <code>a[0]</code> to <code>a[n − 1]</code>. Click the loop that reads <b>every box exactly once</b>.',
      answer: 'c',
      right: 'Start at 0 and stop before n: the values are 0 … n − 1, which is exactly n trips.',
      wrong: 'Count the trips and check the first and last index. Two of these get the count wrong, and one gets it right for the wrong boxes.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function icon(kids) { return s('svg', { class: 'vz cf-icon', viewBox: '0 0 96 64', 'aria-hidden': 'true' }, kids); }
    var tiles = [
      { label: 'Decide', text: 'if / else if / else: the first true test wins, so put the strictest first.',
        svg: icon([s('path', { class: 'cf-ic-edge', d: 'M48 20 L26 42 M48 20 L70 42' }), s('path', { class: 'cf-ic-shape', d: 'M48 6 L62 20 L48 34 L34 20 Z' }),
          s('rect', { class: 'cf-ic-shape is-a', x: 12, y: 42, width: 28, height: 14, rx: 5 }), s('rect', { class: 'cf-ic-shape', x: 56, y: 42, width: 28, height: 14, rx: 5 })]) },
      { label: 'Combine', text: 'AND needs both, OR needs either, NOT flips. A truth table lists every case.',
        svg: icon([[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]].map(function (r, k) {
          return s('g', {}, s('rect', { class: 'cf-ic-cell' + (r[2] ? ' is-on' : ''), x: 14 + (k % 2) * 34, y: 8 + Math.floor(k / 2) * 26, width: 28, height: 20, rx: 5 }),
            s('text', { class: 'cf-ic-t', x: 28 + (k % 2) * 34, y: 22 + Math.floor(k / 2) * 26, 'text-anchor': 'middle' }, r[2]));
        })) },
      { label: 'Repeat', text: 'Test, body, update. The token goes round until the test is false.',
        svg: icon([s('path', { class: 'cf-ic-edge', d: 'M30 32 H66 C84 32 84 10 66 10 H30 C12 10 12 32 30 32 Z M48 32 V54', style: 'display:none' }),
          s('path', { class: 'cf-ic-edge', d: 'M62 50 C86 50 86 14 62 14 H34' }), s('path', { class: 'cf-ic-head', d: 'M36 8 L26 14 L36 20 Z' }),
          s('rect', { class: 'cf-ic-shape', x: 16, y: 40, width: 46, height: 16, rx: 6 }), s('circle', { class: 'cf-ic-tok', cx: 62, cy: 32, r: 5 })]) },
      { label: 'Make progress', text: 'Every trip must move a variable toward the test turning false, or the loop never ends.',
        svg: icon([0, 1, 2, 3, 4, 5].map(function (k) {
          return s('rect', { class: 'cf-ic-bar', x: 10 + k * 14, y: 8 + k * 7, width: 10, height: 48 - k * 7, rx: 3, style: 'opacity:' + (1 - k * 0.12) });
        }).concat([s('circle', { class: 'cf-ic-tok', cx: 88, cy: 56, r: 4 })])) },
      { label: 'Fence posts', text: '0 … n − 1 is n numbers. < and <= differ by exactly one trip.',
        svg: icon([0, 1, 2, 3].map(function (k) { return s('rect', { class: 'cf-ic-post', x: 12 + k * 22, y: 10, width: 6, height: 40, rx: 2 }); })
          .concat([0, 1, 2].map(function (k) { return s('rect', { class: 'cf-ic-rail', x: 20 + k * 22, y: 20, width: 14, height: 5, rx: 2 }); }))
          .concat([0, 1, 2].map(function (k) { return s('rect', { class: 'cf-ic-rail', x: 20 + k * 22, y: 34, width: 14, height: 5, rx: 2 }); }))) },
      { label: 'Loops multiply', text: 'A loop inside a loop runs n × m times: the doorway to n².',
        svg: icon((function () { var out = []; for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) out.push(s('rect', { class: 'cf-ic-cell' + ((r * 4 + c) < 7 ? ' is-on' : ''), x: 14 + c * 17, y: 8 + r * 17, width: 14, height: 14, rx: 3 })); return out; }())) },
      { label: 'Loop invariant', text: 'A fact that is true at every test: it explains why the loop’s answer is right.',
        svg: icon([1, 2, 3, 4].map(function (k) {
          var g = s('g', {});
          for (var q = 0; q < k; q++) g.appendChild(s('rect', { class: 'cf-ic-cell is-on', x: 12 + (k - 1) * 18, y: 50 - (q + 1) * 11, width: 14, height: 9, rx: 2 }));
          return g;
        })) }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    teaser();
    blocks();
    checks();
    fourLoops();
    summaryCard();
    variations();
    whenNear('#fig-lines', CF.linesFigure);
    whenNear('#fig-compare', CF.compareFigure);
    whenNear('#fig-logic', CF.logicFigure);
    whenNear('#fig-battery', CF.batteryFigure);
    whenNear('#fig-jumps', CF.jumpsFigure);
    whenNear('#fig-while', CF.ticketFigure);
    whenNear('#fig-anatomy', CF.anatomyFigure);
    whenNear('#fig-invariant', CF.invariantFigure);
    whenNear('#lab-fig', CF.loopLab);
    whenNear('#fig-fenceposts', CF.fencePostFigure);
    whenNear('#fig-fence', CF.fenceLab);
    whenNear('#fig-fuel', CF.fuelLab);
    whenNear('#fig-nested', CF.nestedLab);
    whenNear('#fig-break', CF.breakLab);
    whenNear('#fig-fizz', CF.fizzLab);
    whenNear('#fig-cost', costFigure);
  });
}());
