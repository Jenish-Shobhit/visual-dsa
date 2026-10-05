/* Lesson 01 · What is an algorithm? — figure wiring.
   Step generators: js/algos/01-algorithms.js (VDSA.algos.lesson01). Custom views: js/lessons/01-algorithms-views.js (C1).
   Figures below the fold are built lazily as they approach the viewport (append ?eager to build everything at once). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, A = V.algos.lesson01, C1 = window.C1, num = A.num;

  /* ------------------------------------------------------------------ helpers */
  var EAGER = /[?&]eager\b/.test(location.search);
  var pending = [];
  function lazy(sel, fn) {
    var el = V.$(sel);
    if (!el) return;
    var done = false;
    function go() { if (done) return; done = true; try { fn(el); } catch (e) { console.error('[lesson 01] ' + sel, e); } }
    pending.push(go);
    if (EAGER || !('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); }
    }, { rootMargin: '700px 0px' });
    io.observe(el);
  }
  window.addEventListener('beforeprint', function () { pending.forEach(function (go) { go(); }); });
  function cardState(step) { return { cards: step.cards, ptr: step.ptr, best: step.best, readout: step.readout, readout2: step.readout2, note: step.note }; }
  function VDSA_esc(t) { return V.escape(t); }
  function uniq(list) { var out = []; list.forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); }); return out; }
  var BACK = { state: 'default', label: 'Face down', color: 'var(--c1-back)' };
  /* VDSA.legend passes `color` through a style object, which cannot set a custom property (--sw); set it here. */
  function legend(el, items) {
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  }
  var CP = ['c1-state-next', 'c1-lab-update', 'c1-lab-output', 'c1-flow-equal', 'c1-race-next', 'c1-euclid-next'];

  /* ================================================================== 1. hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = C1.cardView(stage, { maxCard: 76, minCard: window.innerWidth < 560 ? 30 : 44, gap: window.innerWidth < 560 ? 7 : 12, readout: true, note: true, ptrLabel: '', raise: 14, label: 'Seven cards' });
    var rng = V.rng(20), lap = 0;
    function data() {
      var vals = lap++ ? V.presets.random(7, { min: 1, max: 99, unique: true, rng: rng }) : [31, 58, 24, 72, 45, 96, 60];
      var all = A.findMaxTrace(vals);
      return all.map(function (st, k) {
        var b = st.best === null ? null : num(vals[st.best]), note = '';
        if (st.kind === 'start') note = 'Seven cards, face down. Which is largest?';
        else if (st.kind === 'take') note = 'Turn over the first card. Hold it.';
        else if (st.kind === 'cmp') note = 'Is ' + num(vals[st.ptr]) + ' bigger than ' + b + '?' + (all[k + 1].kind === 'update' ? '' : ' No.');
        else if (st.kind === 'update') note = 'Yes! ' + b + ' is the new best.';
        else if (st.kind === 'done') note = 'No cards left: ' + b + ' is the largest.';
        return Object.assign({}, st, { note: note, readout2: st.counters.comparisons + (st.counters.comparisons === 1 ? ' comparison' : ' comparisons') });
      }).filter(function (st) { return st.kind !== 'more' && st.kind !== 'next'; });
    }
    V.teaser(stage, { steps: data(), render: function (st, ctx) { view.render(cardState(st), ctx); }, stepMs: 760, holdMs: 2200, regenerate: data, instantWrap: true });
  }

  /* ================================================================== 2. be the computer */
  function playFigure() {
    var fig = V.$('#fig-play');
    var stage = fig.querySelector('[data-stage]'), caption = fig.querySelector('[data-caption]');
    var bestEl = fig.querySelector('[data-best]'), flipsEl = fig.querySelector('[data-flips]');
    var claimBtn = fig.querySelector('[data-claim]'), machineBtn = fig.querySelector('[data-machine]'), dealBtn = fig.querySelector('[data-deal]');
    var controls = fig.querySelector('[data-controls]'), compare = fig.querySelector('[data-compare]');
    legend(fig.querySelector('[data-legend]'), [BACK, { state: 'compare', label: 'Just turned over' }, { state: 'key', label: 'Largest so far' }, { state: 'visited', label: 'Seen' }, { state: 'found', label: 'The largest' }]);
    var values, up, best, lastFlip, flips, phase, player = null, you = null;
    var view = C1.cardView(stage, { maxCard: 92, minCard: 38, gap: 14, showPtr: true, ptrLabel: 'i', clickable: true, raise: 12, label: 'Seven face-down cards', onCardClick: onCard });
    function deal() {
      values = V.presets.random(7, { min: 1, max: 99, unique: true });
      up = values.map(function () { return false; }); best = null; lastFlip = null; flips = 0; phase = 'play'; you = null;
      stopMachine();
      compare.hidden = true;
      claimBtn.disabled = true;
      machineBtn.classList.remove('btn--primary'); machineBtn.classList.add('btn--soft');
      caption.innerHTML = 'Click any card. Turn over as few or as many as you like, then press <b>That’s the largest!</b>';
      show(0);
    }
    function stateNow(reveal) {
      return {
        cards: values.map(function (v, k) {
          var st = up[k] ? 'visited' : 'default';
          if (k === lastFlip && up[k]) st = 'compare';
          if (k === best) st = 'key';
          if (reveal && reveal.found === k) st = 'found';
          if (reveal && reveal.claimed === k && reveal.found !== k) st = 'key';
          return { id: 'c' + k, value: v, up: up[k], state: st };
        }),
        ptr: null, best: reveal ? null : best
      };
    }
    function show(d, reveal) {
      view.render(stateNow(reveal), { duration: V.dur(d) });
      bestEl.textContent = best === null ? '–' : num(values[best]);
      flipsEl.textContent = flips;
    }
    function onCard(i) {
      if (phase !== 'play' || up[i]) return;
      up[i] = true; flips++; lastFlip = i;
      var beat = best === null || values[i] > values[best];
      var prev = best;
      if (beat) best = i;
      claimBtn.disabled = false;
      show(460);
      if (flips === values.length) { finish(); return; }
      caption.innerHTML = prev === null
        ? 'You turned over <b>' + num(values[i]) + '</b>. It is the only card you have seen, so it is the largest so far.'
        : beat ? '<b>' + num(values[i]) + '</b> beats ' + num(values[prev]) + ', so it becomes the largest so far.'
          : num(values[i]) + ' does not beat ' + num(values[best]) + '. Keep ' + num(values[best]) + ' in mind. ' + (values.length - flips) + ' card' + (values.length - flips === 1 ? '' : 's') + ' still face down.';
    }
    function finish() {
      phase = 'done';
      var maxI = values.indexOf(Math.max.apply(null, values));
      var hidden = values.length - flips, claimed = best, right = claimed === maxI;
      you = { flips: flips, right: right };
      up = up.map(function () { return true; }); lastFlip = null;
      show(hidden ? 520 : 0, { found: maxI, claimed: claimed });
      if (!hidden) caption.innerHTML = 'You turned over all ' + values.length + ' cards, and <b>' + num(values[maxI]) + '</b> is the largest. That was the only way to be sure. Now press <b>Let the machine try</b>.';
      else if (right) caption.innerHTML = 'Lucky! The ' + hidden + ' face-down card' + (hidden === 1 ? ' was' : 's were') + ' all smaller than ' + num(values[claimed]) + '. But you could not have known without looking. A correct method must look at every card.';
      else caption.innerHTML = 'Risky! One of the ' + hidden + ' face-down card' + (hidden === 1 ? '' : 's') + ' was <b>' + num(values[maxI]) + '</b>, bigger than your ' + num(values[claimed]) + '. Any card you skip could be the largest.';
      claimBtn.disabled = true;
      machineBtn.classList.add('btn--primary'); machineBtn.classList.remove('btn--soft');
    }
    function stopMachine() {
      if (player) { player.destroy(); player = null; }
      controls.hidden = true; V.clear(controls);
    }
    function machine() {
      stopMachine();
      phase = 'machine';
      claimBtn.disabled = true;
      up = values.map(function () { return false; });
      controls.hidden = false;
      var steps = A.findMaxTrace(values);
      player = V.player({
        root: fig, steps: steps, caption: caption, controls: true, baseStepMs: 820, speed: 1, label: 'Machine replay controls',
        render: function (st, ctx) { view.render(cardState(st), ctx); bestEl.textContent = st.best === null ? '–' : num(values[st.best]); flipsEl.textContent = st.counters.flips; }
      });
      player.on('end', function () {
        var last = steps[steps.length - 1];
        V.clear(compare); compare.hidden = false;
        compare.appendChild(h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, 'You'), h('span', { class: 'stat__value' }, you ? you.flips + ' of 7 cards' + (you.right ? '' : ', wrong answer') : 'did not play')));
        compare.appendChild(h('div', { class: 'stat', 'data-state': 'active' }, h('span', { class: 'stat__label' }, 'Machine'), h('span', { class: 'stat__value' }, last.counters.flips + ' of 7 cards, ' + last.counters.comparisons + ' comparisons')));
        compare.appendChild(h('p', { class: 'c1-compare__note' }, 'Same answer, ' + num(last.vars.best) + '. The machine never guesses and never skips a card, so it is right on every deal.'));
      });
      if (!V.reducedMotion()) setTimeout(function () { if (player) player.play(); }, 350);
    }
    claimBtn.addEventListener('click', function () { if (phase === 'play' && flips) finish(); });
    machineBtn.addEventListener('click', machine);
    dealBtn.addEventListener('click', deal);
    deal();
  }

  /* ================================================================== 3. recipe robot */
  var RECIPES = {
    vague: { title: 'Pancakes, the way a cook writes them', lines: [
      { html: 'Put <mark>some flour</mark> in a bowl.', ask: 'How much flour?', why: '“Some flour” gives no amount. A cook guesses; the robot stops and asks.' },
      { html: 'Add <mark>a pinch of salt</mark> and <mark>some milk</mark>.', ask: 'How big is a pinch?', why: '“A pinch” and “some milk” have no size the robot can measure.' },
      { html: 'Stir <mark>for a while</mark>.', ask: 'How long is a while?', why: '“For a while” never says when to stop stirring.' },
      { html: 'Pour the batter into a <mark>hot</mark> pan.', ask: 'How hot is hot?', why: '“Hot” is not a temperature the robot can check.' },
      { html: 'Cook <mark>until done</mark>, then serve.', ask: 'When is it done?', why: '“Until done” is a test with no rule for passing it.' }
    ] },
    exact: { title: 'Pancakes, the way an algorithm is written', lines: [
      { html: 'Put <b>150 g</b> of flour in a bowl.', why: '150 g is an amount the robot can weigh.' },
      { html: 'Add <b>1 g</b> of salt and <b>250 ml</b> of milk.', why: 'Two measured amounts: nothing to guess.' },
      { html: 'Stir <b>40 times</b>.', why: '“40 times” is a count, so the robot knows exactly when to stop.' },
      { html: 'Heat the pan on setting <b>6</b> for <b>3 minutes</b>, then pour in <b>60 ml</b> of batter.', why: 'A heat setting and a time replace “hot”.' },
      { html: 'Cook <b>90 seconds</b>, flip, cook <b>60 seconds</b> more, then serve.', why: 'Times in seconds replace “until done”.' }
    ] }
  };
  function recipeSteps(mode) {
    var r = RECIPES[mode], n = r.lines.length, steps = [], vague = mode === 'vague';
    function statuses(k) { return r.lines.map(function (_, i) { return i < k ? (vague ? 'stuck' : 'ok') : 'todo'; }); }
    steps.push({ mode: mode, title: r.title, lines: r.lines, line: 0, statuses: statuses(0), face: 'idle', say: 'Ready to cook!',
      caption: 'The robot reads one line at a time and does exactly what the words say. Nothing more, nothing less.' });
    r.lines.forEach(function (ln, i) {
      steps.push({ mode: mode, title: r.title, lines: r.lines, line: i + 1, statuses: statuses(i + 1), face: vague ? 'confused' : 'happy', say: vague ? ln.ask : 'Line ' + (i + 1) + ': done.',
        caption: 'Line ' + (i + 1) + ': ' + ln.why });
    });
    steps.push({ mode: mode, title: r.title, lines: r.lines, line: n + 1, statuses: statuses(n), face: vague ? 'sad' : 'done', say: vague ? 'I am stuck.' : 'Pancakes!',
      caption: vague ? 'Stuck on all ' + n + ' lines. A human cook would fill each gap with a guess. A machine cannot guess, so a recipe like this is not an algorithm.'
        : 'Every step says exactly what to do, so the robot finishes and gets the same pancakes every time. That precision is what makes a list of steps an algorithm.' });
    return steps;
  }
  function recipeFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Reading now' }, { state: 'error', label: 'Vague: robot is stuck' }, { state: 'done', label: 'Exact: done' }]);
    var view = C1.recipeView(fig.querySelector('[data-stage]'));
    var player = V.player({ root: fig, steps: recipeSteps('vague'), render: view.render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1700, label: 'Recipe reading controls' });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Which recipe', value: 'vague',
      options: [{ value: 'vague', label: 'Vague recipe' }, { value: 'exact', label: 'Exact recipe' }],
      onChange: function (m) { player.setSteps(recipeSteps(m)); if (!V.reducedMotion()) player.play(); } });
  }

  /* ================================================================== 4. which step is ambiguous (click quiz) */
  function ambiguityQuiz() {
    var msgs = {
      s1: 'Step 1 is exact: one card, turn it over, keep it.',
      s2: '“The next card” is exact: the one just after the last card you turned over.',
      s3: '“Bigger than” is a test a machine can check: 9 &gt; 5 is true, 3 &gt; 5 is false.',
      s5: 'Saying the number on the card you hold is exact.'
    };
    V.clickQuiz('#ambiguous-steps', {
      el: '#quiz-ambiguous', id: 'c1-ambiguous',
      question: 'Which step would leave a machine stuck?',
      check: function (id) { return id === 's4' ? true : { correct: false, message: msgs[id] || 'That step is exact.' }; },
      right: '“For a while” never says when to stop. The exact version is “Repeat steps 2 and 3 until no card is face down.”'
    });
  }

  /* ================================================================== 5. input → steps → output */
  function pipelineFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Best so far' }, { state: 'found', label: 'Output' }]);
    var view = C1.pipelineView(fig.querySelector('[data-stage]'));
    var inputs = [
      { label: '5, 3, 9, 2', v: [5, 3, 9, 2] },
      { label: '−4, −9, −2, −7', v: [-4, -9, -2, -7] },
      { label: '7, 7, 7', v: [7, 7, 7] },
      { label: '42', v: [42] },
      { label: 'Random', v: null }
    ];
    var player = V.player({ root: fig, steps: A.pipelineSteps(inputs[0].v), render: view.render, caption: fig.querySelector('[data-caption]'), baseStepMs: 950, autoplay: true, label: 'Input machine controls' });
    var row = fig.querySelector('[data-inputs]'), btns = [], log = fig.querySelector('[data-log]'), seen = {};
    player.on('end', function () {
      var st = player.steps[player.steps.length - 1], k = st.values.join(',');
      if (seen[k] || st.out === null) return;
      seen[k] = true;
      if (!log.childNodes.length) log.appendChild(h('span', null, 'Tried so far:'));
      log.appendChild(h('span', { class: 'c1-io', html: VDSA_esc(st.values.map(num).join(', ')) + ' → <b>' + num(st.out) + '</b>' }));
    });
    inputs.forEach(function (inp, i) {
      var b = h('button', { type: 'button', class: 'btn btn--sm', 'aria-pressed': i === 0 ? 'true' : 'false', onclick: function () {
        var v = inp.v || V.presets.random(V.rng().int(3, 8), { min: -20, max: 60 });
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        player.setSteps(A.pipelineSteps(v));
        if (!V.reducedMotion()) player.play();
      } }, inp.label);
      btns.push(b); row.appendChild(b);
    });
  }

  /* ================================================================== 6. state and the next-step pointer */
  var ENGLISH = [
    'Turn over the first card and hold it as <b>best</b>.',
    'If no card is face down, go to step 6.',
    'Turn over the next card. If it is not bigger than <b>best</b>, go to step 5.',
    'Hold it instead: it is the new <b>best</b>.',
    'Move to the next card and go back to step 2.',
    'Say <b>best</b>, and stop.'
  ];
  function stateFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Next-step pointer', shape: 'dot' }, BACK, { state: 'compare', label: 'Turned over now' }, { state: 'key', label: 'Best so far' }]);
    var prog = fig.querySelector('[data-program]'), box = fig.querySelector('[data-statebox]');
    var arrow = h('span', { class: 'c1-program__ptr', 'aria-hidden': 'true' });
    var items = ENGLISH.map(function (t, i) {
      var li = h('li', { class: 'c1-program__line' }, h('span', { class: 'c1-program__n' }, String(i + 1)), h('span', { html: t }));
      prog.appendChild(li); return li;
    });
    prog.appendChild(arrow);
    var rows = {};
    [['step', 'Step running'], ['i', 'Card i'], ['best', 'Best so far'], ['down', 'Cards face down']].forEach(function (r) {
      var dd = h('dd', { class: 'c1-state-box__v' }, '–');
      box.appendChild(h('div', { class: 'c1-state-box__row', 'data-k': r[0] }, h('dt', null, r[1]), dd));
      rows[r[0]] = dd;
    });
    var view = C1.cardView(fig.querySelector('[data-cards]'), { maxCard: 54, minCard: 34, showIndex: true, ptrLabel: 'i', raise: 8, label: 'Five cards' });
    var values = [4, 7, 2, 9, 5], steps = A.findMaxTrace(values);
    function setRow(k, text, d) {
      var el = rows[k]; if (el.textContent === text) return;
      el.textContent = text;
      if (d) { el.parentNode.classList.remove('is-changed'); void el.offsetWidth; el.parentNode.classList.add('is-changed'); }
    }
    function seat() {
      var cur = prog.querySelector('.is-current');
      if (!cur) { arrow.style.opacity = '0'; return; }
      arrow.style.opacity = '1';
      arrow.style.transform = 'translateY(' + (cur.offsetTop + cur.offsetHeight / 2 - 11) + 'px)';
    }
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'State figure controls',
      render: function (st, ctx) {
        fig.style.setProperty('--t', ctx.duration + 'ms');
        items.forEach(function (li, i) { li.classList.toggle('is-current', st.eng === i + 1); });
        seat();
        view.render(cardState(st), ctx);
        var d = ctx.duration;
        setRow('step', st.eng ? 'Step ' + st.eng : 'not started', d);
        setRow('i', st.ptr === null || st.ptr === undefined ? '–' : st.ptr >= st.n ? st.ptr + ' (past the last card)' : String(st.ptr), d);
        setRow('best', st.best === null ? '–' : num(values[st.best]), d);
        setRow('down', String(st.cards.filter(function (c) { return !c.up; }).length), d);
      }
    });
    V.onResize(prog, seat);
    player.addCheckpoint(function (all) {
      for (var k = 1; k < all.length; k++) if (all[k].kind === 'next' && all[k - 1].kind === 'cmp') return k;
      return -1;
    }, function (c) {
      var p = c.prev, x = values[p.ptr], b = values[p.best];
      return {
        question: 'Card ' + p.ptr + ' shows <b>' + num(x) + '</b> and best is <b>' + num(b) + '</b>. The pointer is on step 3. Which step runs next?',
        options: ['Step 4: hold it as the new best', 'Step 5: move to the next card', 'Step 6: say best'],
        answer: 1,
        explain: [num(x) + ' is not bigger than ' + num(b) + ', so step 3 says “go to step 5”, skipping step 4.',
          'Right: ' + num(x) + ' is not bigger than ' + num(b) + ', so step 3 jumps to step 5.',
          'Step 6 only runs when step 2 finds no face-down cards. Some are still face down.']
      };
    }, { id: 'c1-state-next' });
  }

  /* ================================================================== 7. building blocks */
  var BLOCKS = {
    sequence: {
      spec: { nodes: [
        { id: 'a', type: 'process', text: 'Turn over a card', col: 0, row: 0 },
        { id: 'b', type: 'process', text: 'Read its number', col: 0, row: 1 },
        { id: 'c', type: 'process', text: 'Put it down', col: 0, row: 2 }
      ], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] },
      steps: [{ active: 'a' }, { active: 'b' }, { active: 'c' }]
    },
    choice: {
      spec: { nodes: [
        { id: 'q', type: 'decision', text: 'Bigger than best?', col: 0.5, row: 0 },
        { id: 'y', type: 'process', text: 'Hold it', col: 0, row: 1 },
        { id: 'n', type: 'process', text: 'Skip it', col: 1, row: 1 },
        { id: 'e', type: 'process', text: 'Next card', col: 0.5, row: 2 }
      ], edges: [{ from: 'q', to: 'y', label: 'yes', via: { fromSide: 'left', toSide: 'top' } }, { from: 'q', to: 'n', label: 'no', via: { fromSide: 'right', toSide: 'top' } },
        { from: 'y', to: 'e', via: { fromSide: 'bottom', toSide: 'left' } }, { from: 'n', to: 'e', via: { fromSide: 'bottom', toSide: 'right' } }] },
      steps: [{ active: 'q', note: 'card 8, best 5' }, { active: 'y', note: '8 > 5: yes' }, { active: 'e', note: 'best is now 8' },
        { active: 'q', note: 'card 3, best 8' }, { active: 'n', note: '3 > 8: no' }, { active: 'e', note: 'best stays 8' }]
    },
    loop: {
      spec: { nodes: [
        { id: 'q', type: 'decision', text: 'Cards left?', col: 0, row: 0 },
        { id: 't', type: 'process', text: 'Turn one over', col: 0, row: 1 },
        { id: 'x', type: 'end', text: 'Stop', col: 1, row: 0 }
      ], edges: [{ from: 'q', to: 't', label: 'yes' }, { from: 't', to: 'q' }, { from: 'q', to: 'x', label: 'no' }] },
      steps: [{ active: 'q', note: '3 cards left' }, { active: 't', note: '3 cards left' }, { active: 'q', note: '2 cards left' }, { active: 't', note: '2 cards left' },
        { active: 'q', note: '1 card left' }, { active: 't', note: '1 card left' }, { active: 'q', note: '0 cards left' }, { active: 'x', note: 'stopped' }]
    }
  };
  function blocksFigure(row) {
    Object.keys(BLOCKS).forEach(function (k) {
      var fig = row.querySelector('[data-block="' + k + '"]'), stage = fig.querySelector('.mini__stage');
      var b = BLOCKS[k], note = fig.querySelector('[data-' + k + '-note]');
      var flow = V.views.flowchart(stage, b.spec, { label: k + ' flowchart' });
      V.teaser(stage, { steps: b.steps, stepMs: 1050, holdMs: 1500, instantWrap: true,
        render: function (st, ctx) { flow.render({ active: st.active }, { duration: ctx.duration }); if (note) note.textContent = st.note || ''; } });
    });
  }
  var MAP_TAGS = [['sequence'], ['loop'], ['choice'], ['choice'], ['loop'], ['sequence']];
  var TAG_LABEL = { sequence: 'sequence', choice: 'choice', loop: 'repetition' };
  function blocksMap(fig) {
    var stage = fig.querySelector('[data-stage]');
    var list = h('ol', { class: 'c1-map' });
    var lines = ENGLISH.map(function (t, i) {
      var li = h('li', { class: 'c1-map__line', 'data-tags': MAP_TAGS[i].join(' ') },
        h('span', { class: 'c1-map__n' }, String(i + 1)), h('span', { class: 'c1-map__t', html: t }),
        h('span', { class: 'c1-map__tags' }, MAP_TAGS[i].map(function (tg) { return h('span', { class: 'c1-tag-chip is-' + tg }, TAG_LABEL[tg]); })));
      list.appendChild(li); return li;
    });
    var loopArc = h('span', { class: 'c1-map__loop', 'aria-hidden': 'true' }, h('span', { class: 'c1-map__loop-lbl' }, 'back to 2'));
    stage.appendChild(h('div', { class: 'c1-map-wrap' }, list, loopArc));
    function seatLoop() {
      var a = lines[1], b = lines[4];
      loopArc.style.top = (a.offsetTop + a.offsetHeight / 2) + 'px';
      loopArc.style.height = (b.offsetTop + b.offsetHeight / 2 - a.offsetTop - a.offsetHeight / 2) + 'px';
    }
    function pick(v) {
      stage.setAttribute('data-filter', v);
      lines.forEach(function (li) { li.classList.toggle('is-dim', v !== 'all' && li.getAttribute('data-tags').split(' ').indexOf(v) === -1); });
      loopArc.classList.toggle('is-on', v === 'all' || v === 'loop');
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Highlight a building block', value: 'all',
      options: [{ value: 'all', label: 'All' }, { value: 'sequence', label: 'Sequence' }, { value: 'choice', label: 'Choice' }, { value: 'loop', label: 'Repetition' }], onChange: pick });
    pick('all');
    seatLoop();
    V.onResize(stage, seatLoop);
  }

  /* ================================================================== 8. the lab */
  var CODE = {
    pseudo: [
      'function findLargest(cards)',
      '  best ← cards[0]              // @take',
      '  i ← 1                        // @take',
      '  while i < length(cards)      // @more',
      '    if cards[i] > best then    // @bigger',
      '      best ← cards[i]          // @update',
      '    i ← i + 1                  // @next',
      '  return best                  // @output'
    ].join('\n'),
    js: [
      'function findLargest(cards) {',
      '  let best = cards[0];           // @take',
      '  let i = 1;                     // @take',
      '  while (i < cards.length) {     // @more',
      '    if (cards[i] > best) {       // @bigger',
      '      best = cards[i];           // @update',
      '    }',
      '    i = i + 1;                   // @next',
      '  }',
      '  return best;                   // @output',
      '}'
    ].join('\n'),
    py: [
      'def find_largest(cards):',
      '    best = cards[0]           # @take',
      '    i = 1                     # @take',
      '    while i < len(cards):     # @more',
      '        if cards[i] > best:   # @bigger',
      '            best = cards[i]   # @update',
      '        i = i + 1             # @next',
      '    return best               # @output'
    ].join('\n')
  };
  function labFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [BACK, { state: 'compare', label: 'Turned over now' }, { state: 'key', label: 'best' }, { state: 'visited', label: 'Already seen' }, { state: 'found', label: 'The answer' }]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'pseudo' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { best: 'key', i: 'active', 'cards[i]': 'compare' } });
    var view = C1.cardView(fig.querySelector('[data-stage]'), { maxCard: 62, minCard: 38, showIndex: true, ptrLabel: 'i', raise: 10, label: 'Your cards' });
    var start = [5, 3, 9, 2, 9, 12, 4];
    var player = V.player({
      root: fig, steps: A.findMaxTrace(start), code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { flips: 'Cards turned', comparisons: 'Comparisons', updates: 'Best changed' },
      counterStates: { comparisons: 'compare', updates: 'key' },
      baseStepMs: 1000, label: 'Lab controls',
      render: function (st, ctx) { view.render(cardState(st), ctx); }
    });
    player.addCheckpoint(function (all) { for (var k = 1; k < all.length; k++) if (all[k].kind === 'update') return k; return -1; }, function (c) {
      var p = c.prev, x = p.values[p.ptr], b = p.values[p.best];
      return {
        question: '<code>cards[' + p.ptr + '] = ' + num(x) + '</code> and <code>best = ' + num(b) + '</code>. What happens next?',
        options: ['best becomes ' + num(x), 'best stays ' + num(b), 'The loop stops: ' + num(x) + ' must be the largest'],
        answer: 0,
        explain: [num(x) + ' &gt; ' + num(b) + ', so the if-test is true and best is replaced.',
          'best only stays when the new card is not bigger, and ' + num(x) + ' is bigger than ' + num(b) + '.',
          'The loop never stops early. A later card could be bigger still, so every card must be checked.']
      };
    }, { id: 'c1-lab-update' });
    player.addCheckpoint(function (all) { return all.length > 3 ? all.length - 1 : -1; }, function (c) {
      var v = c.step.values, max = Math.max.apply(null, v), first = v[0], lastV = v[v.length - 1];
      var opts = uniq([max, first, lastV]);
      if (opts.length < 2) return null;
      var why = {};
      why[max] = num(max) + ' is the largest card: every other card was compared with best and none beat it.';
      if (why[first] === undefined) why[first] = num(first) + ' is only the first card, the starting guess.';
      if (why[lastV] === undefined) why[lastV] = num(lastV) + ' is just the last card compared. Being last does not make it biggest.';
      var shuffled = opts.slice().sort(function (a, b) { return a - b; });
      return {
        question: 'Every card has been turned over. What will <code>findLargest</code> return?',
        options: shuffled.map(num), answer: shuffled.indexOf(max),
        explain: shuffled.map(function (o) { return why[o]; })
      };
    }, { id: 'c1-lab-output' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your cards (1 to 12 whole numbers, −99 to 99)',
      value: start,
      parse: { min: -99, max: 99, minCount: 1, maxCount: 12 },
      hint: 'The algorithm needs at least one card: with none, there is no largest.',
      presets: [
        { label: 'Random', value: function () { return V.presets.random(8, { min: 1, max: 60 }); } },
        { label: 'Ascending (best changes every time)', value: function () { return V.presets.sorted(7, { min: 1, max: 40 }); } },
        { label: 'Descending (best never changes)', value: function () { return V.presets.reversed(7, { min: 1, max: 40 }); } },
        { label: 'All equal', value: [6, 6, 6, 6, 6] },
        { label: 'One card', value: [42] },
        { label: 'All negative', value: [-4, -9, -2, -7] }
      ],
      onApply: function (values) { player.setSteps(A.findMaxTrace(values)); }
    });
  }

  /* ================================================================== 9. flowchart synced with cards */
  var FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'Start: cards face down', col: 0, row: 0 },
      { id: 'take', type: 'process', text: 'Turn over the first card\nbest = that card', col: 0, row: 1 },
      { id: 'more', type: 'decision', text: 'Any card face down?', col: 0, row: 2 },
      { id: 'bigger', type: 'decision', text: 'Next card bigger than best?', col: 0, row: 3 },
      { id: 'update', type: 'process', text: 'best = this card', col: 1, row: 3 },
      { id: 'next', type: 'process', text: 'Move to the next card', col: 0, row: 4 },
      { id: 'output', type: 'end', text: 'Say best', col: 1, row: 2 }
    ],
    edges: [
      { from: 'start', to: 'take' }, { from: 'take', to: 'more' },
      { from: 'more', to: 'bigger', label: 'yes' }, { from: 'more', to: 'output', label: 'no' },
      { from: 'bigger', to: 'update', label: 'yes' }, { from: 'bigger', to: 'next', label: 'no' },
      { from: 'update', to: 'next' }, { from: 'next', to: 'more' }
    ]
  };
  function flowFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running now' }, { state: 'compare', label: 'Turned over now' }, { state: 'key', label: 'best' }]);
    var chart = V.views.flowchart(fig.querySelector('[data-chart]'), FLOW, { label: 'Flowchart of find the largest' });
    var view = C1.cardView(fig.querySelector('[data-cards]'), { maxCard: 60, minCard: 32, gap: 10, showIndex: true, ptrLabel: 'i', raise: 8, label: 'Five cards' });
    var values = [6, 2, 8, 8, 3], steps = A.findMaxTrace(values);
    var player = V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1150, label: 'Flowchart controls',
      render: function (st, ctx) {
        view.render(cardState(st), ctx);
        chart.render({ active: st.flow }, { duration: ctx.duration });
      }
    });
    player.addCheckpoint(function (all) {
      for (var k = 1; k < all.length; k++) {
        var p = all[k - 1];
        if (p.kind === 'cmp' && p.values[p.ptr] === p.values[p.best]) return k;
      }
      return -1;
    }, function (c) {
      var p = c.prev, x = p.values[p.ptr];
      return {
        question: 'Card ' + p.ptr + ' shows <b>' + num(x) + '</b> and best is also <b>' + num(x) + '</b>. Which arrow does the token take out of the diamond?',
        options: ['yes → best = this card', 'no → move to the next card'],
        answer: 1,
        explain: ['The question is “bigger than best?”, and ' + num(x) + ' is equal, not bigger. So the answer is no.',
          'Right: equal is not bigger, so the first ' + num(x) + ' stays best and the token takes the “no” arrow.']
      };
    }, { id: 'c1-flow-equal' });
  }

  /* ================================================================== 10. test bench, termination minis, zero-bug quiz */
  var VARIANT_UI = {
    correct: { label: 'Correct', bug: -1, why: 'All six pass, including one card, equal cards and negatives. Passing tests is encouraging, but the reason below is what shows it works for every input.' },
    zero: { label: 'Bug: best starts at 0', bug: 1, why: 'Starting at 0 assumes some card is at least 0. With all-negative cards, 0 wins, and 0 is not even one of the cards.' },
    early: { label: 'Bug: stops too early', bug: 5, why: 'It returns the first card that beats the first card, without looking at the rest. It fails only when a bigger card comes later, as in 2, 5, 7.' },
    skipLast: { label: 'Bug: skips the last card', bug: 3, why: 'The loop stops one card short (i &lt; n − 1), so the last card is never turned over. Only “largest last” catches it.' },
    stuck: { label: 'Bug: forgets to move on', bug: 7, why: 'Without <code>i = i + 1</code> the loop checks the same card forever. Only the one-card input finishes, because its loop never starts.' }
  };
  var VARIANT_CODE = {
    correct: 'let best = cards[0];\nlet i = 1;\nwhile (i < cards.length) {\n  if (cards[i] > best) best = cards[i];\n  i = i + 1;\n}\nreturn best;',
    zero: 'let best = 0;\nlet i = 0;\nwhile (i < cards.length) {\n  if (cards[i] > best) best = cards[i];\n  i = i + 1;\n}\nreturn best;',
    early: 'let best = cards[0];\nlet i = 1;\nwhile (i < cards.length) {\n  if (cards[i] > best) return cards[i];\n  i = i + 1;\n}\nreturn best;',
    skipLast: 'let best = cards[0];\nlet i = 1;\nwhile (i < cards.length - 1) {\n  if (cards[i] > best) best = cards[i];\n  i = i + 1;\n}\nreturn best;',
    stuck: 'let best = cards[0];\nlet i = 1;\nwhile (i < cards.length) {\n  if (cards[i] > best) best = cards[i];\n  // (i = i + 1 is missing)\n}\nreturn best;'
  };
  var BUG_LINE = { correct: -1, zero: 0, early: 3, skipLast: 2, stuck: 4 };
  function benchFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Pass' }, { state: 'error', label: 'Wrong answer' }, { state: 'compare', label: 'Never stops' }]);
    var stage = fig.querySelector('[data-stage]'), caption = fig.querySelector('[data-caption]'), diff = fig.querySelector('[data-code-diff]');
    var table = h('div', { class: 'c1-bench', role: 'table', 'aria-label': 'Test results' });
    table.appendChild(h('div', { class: 'c1-bench__row c1-bench__head', role: 'row' },
      h('span', { role: 'columnheader' }, 'Test'), h('span', { role: 'columnheader' }, 'Input'), h('span', { role: 'columnheader' }, 'Returns'), h('span', { role: 'columnheader' }, 'Should be'), h('span', { role: 'columnheader' }, 'Result')));
    var rows = A.BENCH.map(function (t) {
      var ret = h('span', { class: 'c1-bench__ret' }, '–'), verdict = h('span', { class: 'c1-verdict' }, '');
      var r = h('div', { class: 'c1-bench__row', role: 'row' },
        h('span', { class: 'c1-bench__label', role: 'cell' }, t.label),
        h('span', { class: 'c1-bench__input', role: 'cell' }, t.values.map(function (v) { return h('span', { class: 'c1-minicard' }, num(v)); })),
        h('span', { role: 'cell', class: 'c1-bench__cell' }, ret),
        h('span', { role: 'cell', class: 'c1-bench__cell' }, h('span', { class: 'c1-bench__exp' }, num(A.trueMax(t.values)))),
        h('span', { role: 'cell', class: 'c1-bench__cell' }, verdict));
      table.appendChild(r);
      return { el: r, ret: ret, verdict: verdict, timers: [] };
    });
    stage.appendChild(table);
    var runId = 0;
    function run(variant) {
      var my = ++runId, results = A.benchResults(variant), reduce = V.reducedMotion();
      V.codeBlock(diff, VARIANT_CODE[variant], 'js');
      var cl = diff.querySelectorAll('.cl');
      if (BUG_LINE[variant] >= 0 && cl[BUG_LINE[variant]]) cl[BUG_LINE[variant]].classList.add('is-bug');
      var pass = results.filter(function (r) { return r.pass; }).length;
      results.forEach(function (res, i) {
        var row = rows[i];
        row.timers.forEach(clearTimeout); row.timers = [];
        row.el.className = 'c1-bench__row is-running';
        row.ret.textContent = '…'; row.verdict.textContent = ''; row.verdict.className = 'c1-verdict';
        function settle() {
          if (my !== runId) return;
          row.el.className = 'c1-bench__row ' + (res.pass ? 'is-pass' : res.halted ? 'is-fail' : 'is-loop');
          row.ret.textContent = res.halted ? num(res.result) : '∞';
          row.verdict.textContent = res.pass ? '✓ pass' : res.halted ? '✗ wrong' : '↻ never stops';
          row.verdict.className = 'c1-verdict ' + (res.pass ? 'is-pass' : res.halted ? 'is-fail' : 'is-loop');
        }
        if (reduce) { settle(); return; }
        if (!res.halted) {
          var t0 = 140 * i, count = 0;
          row.timers.push(setTimeout(function tick() {
            if (my !== runId) return;
            count = Math.min(1000, count + 83);
            row.ret.textContent = count + '…';
            if (count < 1000) row.timers.push(setTimeout(tick, 45)); else settle();
          }, t0));
        } else row.timers.push(setTimeout(settle, 140 * i + 260));
      });
      caption.innerHTML = '<b>' + pass + ' of 6 tests pass.</b> ' + VARIANT_UI[variant].why;
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Which version', value: 'correct',
      options: A.VARIANTS.map(function (v) { return { value: v, label: VARIANT_UI[v].label }; }), onChange: run });
    run('correct');
  }
  function stopsFigure(row) {
    var vals = [3, 8, 5, 1, 9, 4];
    // correct: one more card per trip, cards left 6 → 0
    var good = [], k;
    for (k = 0; k <= vals.length; k++) {
      good.push({ cards: vals.map(function (v, i) { return { id: 'g' + i, value: v, up: i < k, state: i < k ? (i === k - 1 ? 'compare' : 'visited') : 'default' }; }),
        ptr: Math.min(k, vals.length), best: null, left: vals.length - k });
    }
    var bad = [];
    for (k = 0; k <= 24; k++) {
      bad.push({ cards: vals.map(function (v, i) { return { id: 'b' + i, value: v, up: i <= 1, state: i === 1 ? 'compare' : i === 0 ? 'key' : 'default' }; }),
        ptr: 1, best: 0, trips: k });
    }
    var gFig = row.querySelector('[data-stop="correct"]'), bFig = row.querySelector('[data-stop="stuck"]');
    var gv = C1.cardView(gFig.querySelector('.mini__stage'), { maxCard: 34, minCard: 24, gap: 6, showBest: false, raise: 0, ptrLabel: 'i', label: 'Progressing loop' });
    var bv = C1.cardView(bFig.querySelector('.mini__stage'), { maxCard: 34, minCard: 24, gap: 6, showBest: true, raise: 6, ptrLabel: 'i', label: 'Stuck loop' });
    var left = gFig.querySelector('[data-left]'), trips = bFig.querySelector('[data-trips]');
    V.teaser(gFig.querySelector('.mini__stage'), { steps: good, stepMs: 700, holdMs: 1800, instantWrap: true, staticIndex: good.length - 1,
      render: function (st, ctx) { gv.render(st, ctx); left.textContent = st.left + (st.left === 0 ? ': stop' : ''); } });
    V.teaser(bFig.querySelector('.mini__stage'), { steps: bad, stepMs: 380, holdMs: 900, instantWrap: true, staticIndex: bad.length - 1,
      render: function (st, ctx) { bv.render(st, ctx); trips.textContent = st.trips + (st.trips >= 24 ? ' and counting' : ''); } });
  }
  function zeroBugQuiz() {
    V.quiz('#quiz-zero-bug', {
      id: 'c1-zero-bug', kicker: 'Find the failing inputs',
      question: 'The “best starts at 0” version gives a wrong answer on which inputs? Pick all that apply.',
      options: ['<code>−7, −2, −5</code>', '<code>−1</code>', '<code>0, −1</code>', '<code>−3, 4</code>'],
      answer: [0, 1],
      explain: 'It returns the larger of 0 and the true largest card. So it is wrong exactly when every card is negative: −7, −2, −5 and the single −1. With 0, −1 the answer 0 is right, and with −3, 4 the 4 beats 0.'
    });
  }

  /* ================================================================== 11. guessing race, all-secrets bars, growth chart */
  var raceApi = null;
  function raceWithCounters(secret) {
    return A.raceSteps(secret, 100).map(function (st) { st.counters = { countUp: st.up.count, halving: st.half.count }; return st; });
  }
  function raceFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Count-up guess' }, { state: 'active', label: 'Halving guess' }, { state: 'active', shape: 'outline', label: 'Still possible' }, { state: 'muted', label: 'Ruled out' }, { state: 'found', label: 'Found' }]);
    var view = C1.raceView(fig.querySelector('[data-stage]'));
    var secret = 73;
    var player = V.player({
      root: fig, steps: raceWithCounters(secret), render: view.render, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { countUp: 'Count-up guesses', halving: 'Halving guesses' }, counterStates: { countUp: 'compare', halving: 'active' },
      baseStepMs: 700, speeds: [0.5, 1, 2, 4, 8], speed: 2, label: 'Guessing race controls'
    });
    player.addCheckpoint(function (all) { return all.length > 2 && all[1].half.reply !== 'correct' && all[2].half.count === 2 ? 2 : -1; }, function (c) {
      var g1 = c.steps[1].half, g2 = c.steps[2].half.guess;
      var lo = g1.reply === 'higher' ? g1.guess + 1 : 1, hi = g1.reply === 'higher' ? 100 : g1.guess - 1;
      var near = g1.reply === 'higher' ? g1.guess + 1 : g1.guess - 1, ten = g1.reply === 'higher' ? g1.guess + 10 : g1.guess - 10;
      var opts = uniq([g2, near, ten]).sort(function (a, b) { return a - b; });
      return {
        question: 'Halving guessed <b>' + g1.guess + '</b> and heard “' + g1.reply + '”. What does it guess next?',
        options: opts.map(String), answer: opts.indexOf(g2),
        explain: opts.map(function (o) {
          if (o === g2) return 'Only ' + lo + '–' + hi + ' is still possible, and ' + g2 + ' is its middle, so the answer throws away half again.';
          if (o === near) return o + ' is the next number over. Guessing it throws away just one number, which is what counting does.';
          return o + ' is a step of ten. Halving always picks the middle of what is left: ' + g2 + '.';
        })
      };
    }, { id: 'c1-race-next' });
    var slider = V.slider(fig.querySelector('[data-slider]'), { label: 'Secret', min: 1, max: 100, value: secret,
      onChange: function (v) { setSecret(v, 'slider'); } });
    function setSecret(v, from) {
      secret = v;
      player.setSteps(raceWithCounters(v));
      if (from !== 'slider') slider.set(v);
      if (from !== 'bars' && raceApi && raceApi.bars) raceApi.bars.select(v);
    }
    fig.querySelector('[data-random]').addEventListener('click', function () { setSecret(V.rng().int(1, 100)); if (!V.reducedMotion()) player.play(); });
    raceApi = raceApi || {};
    raceApi.setSecret = setSecret;
  }
  function barsFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Count up' }, { state: 'active', label: 'Halve the range' }]);
    var stats = A.guessStats(100);
    fig.querySelector('[data-avg-half]').textContent = stats.avgHalving.toFixed(1);
    var bars = C1.barsView(fig.querySelector('[data-stage]'), stats, function (k) {
      if (raceApi && raceApi.setSecret) raceApi.setSecret(k, 'bars');
      var race = V.$('#fig-race');
      if (race && race.getBoundingClientRect().bottom < 0) race.scrollIntoView({ block: 'center' });
    });
    bars.select(73);
    raceApi = raceApi || {};
    raceApi.bars = bars;
  }
  function halvingPoints(max) {
    var pts = [[1, 1]];
    for (var k = 1; Math.pow(2, k) <= max; k++) {
      var a = Math.pow(2, k) - 1, b = Math.pow(2, k);
      if (a > 1) pts.push([a, k]);
      pts.push([b, k + 1]);
    }
    if (pts[pts.length - 1][0] < max) pts.push([max, A.worstHalving(max)]);
    return pts;
  }
  function growthFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'compare', shape: 'line', label: 'Count up: n guesses' }, { state: 'active', shape: 'line', label: 'Halving: ⌈log₂(n + 1)⌉ guesses' }]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Worst-case guesses against the size of the range', labels: 'direct' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Numbers in the range', up: 'Count up (worst case)', half: 'Halving (worst case)' }, states: { up: 'compare', half: 'active' } });
    var range = 1000, log = false;
    function fmt(n) { return n.toLocaleString('en-US'); }
    function draw(d) {
      chart.render({
        x: { label: 'numbers in the range, n', min: 1, max: range, scale: log ? 'log' : 'linear' },
        y: log ? { label: 'worst-case guesses (log scale)', scale: 'log', min: 1, max: range } : { label: 'worst-case guesses', min: 0, max: range },
        series: [
          { id: 'up', label: 'count up', fn: function (n) { return n; }, color: 1 },
          { id: 'half', label: 'halving', points: halvingPoints(range), color: 0, markers: false }
        ],
        highlight: [{ series: 'up', x: range, label: fmt(range) }, { series: 'half', x: range, label: String(A.worstHalving(range)) }]
      }, { duration: d === undefined ? 700 : d });
      stats.update({ n: fmt(range), up: fmt(range), half: String(A.worstHalving(range)) });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Size of the range', value: '1000',
      options: [{ value: '100', label: '1 to 100' }, { value: '1000', label: '1 to 1,000' }, { value: '1000000', label: '1 to 1,000,000' }],
      onChange: function (v) { range = Number(v); draw(); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (c) { log = c; draw(); } });
    draw(0);
  }
  function halvingQuiz() {
    V.quiz('#quiz-halving', {
      id: 'c1-halving-1000',
      question: 'The secret is somewhere from 1 to 1,000. What is the most guesses halving could ever need?',
      options: ['10', '100', '500', '1,000'],
      answer: 0,
      explain: [
        'Each guess cuts what is left roughly in half: 9 guesses can tell apart at most 511 numbers, 10 guesses 1,023. So 10 is enough for 1,000, and some secret needs all 10.',
        '100 guesses would mean each answer rules out about 10 numbers. Halving rules out about half of what is left.',
        '500 is roughly what counting up needs on average, not halving’s worst case.',
        '1,000 is the worst case for counting up (secret = 1,000), not for halving.'
      ]
    });
  }

  /* ================================================================== 12. Euclid */
  var EUCLID_CODE = {
    pseudo: [
      'function gcd(w, h)',
      '  while w ≠ h                // @loop',
      '    if w > h then            // @test',
      '      w ← w − h             // @cutw',
      '    else',
      '      h ← h − w             // @cuth',
      '  return w                   // @ret'
    ].join('\n'),
    js: [
      'function gcd(w, h) {',
      '  while (w !== h) {          // @loop',
      '    if (w > h) {             // @test',
      '      w = w - h;             // @cutw',
      '    } else {',
      '      h = h - w;             // @cuth',
      '    }',
      '  }',
      '  return w;                  // @ret',
      '}'
    ].join('\n'),
    py: [
      'def gcd(w, h):',
      '    while w != h:            # @loop',
      '        if w > h:            # @test',
      '            w = w - h        # @cutw',
      '        else:',
      '            h = h - w        # @cuth',
      '    return w                 # @ret'
    ].join('\n')
  };
  function euclid(W, H) {
    var st = A.euclidSteps(W, H), last = st[st.length - 1], sizes = [];
    last.squares.forEach(function (q) { if (!q.last && sizes.indexOf(q.size) === -1) sizes.push(q.size); });
    st.forEach(function (x) { x.allSizes = sizes; x.gcdFinal = last.gcd; });
    return st;
  }
  function parseWH(text) {
    var parts = String(text || '').split(/[^0-9.\-]+/).filter(Boolean);
    if (parts.length !== 2) return { values: [], error: 'Type two whole numbers, a width and a height, e.g. 21, 12.' };
    var v = parts.map(Number);
    for (var i = 0; i < 2; i++) {
      if (!Number.isInteger(v[i])) return { values: [], error: '“' + parts[i] + '” is not a whole number.' };
      if (v[i] < 1 || v[i] > 60) return { values: [], error: 'Keep both sides between 1 and 60 so every square stays visible.' };
    }
    return { values: v, error: null };
  }
  function euclidFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'outline', label: 'Piece still to cut' }, { state: 'pivot', label: 'Squares cut (one colour per size)' }, { state: 'found', label: 'Last square: the GCD' }]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: EUCLID_CODE, default: 'pseudo' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { w: 'active', h: 'active' } });
    var view = C1.euclidView(fig.querySelector('[data-stage]'));
    var player = V.player({
      root: fig, steps: euclid(21, 12), code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { cuts: 'Squares cut' }, counterStates: { cuts: 'pivot' }, baseStepMs: 1100, label: 'Euclid controls', render: view.render
    });
    player.addCheckpoint(function (all) {
      for (var k = 2; k < all.length; k++) if (all[k].kind === 'cut' && all[k - 1].cut && all[k].cut.size !== all[k - 1].cut.size) return k;
      return -1;
    }, function (c) {
      var p = c.prev, lo = Math.min(p.w, p.h), hi = Math.max(p.w, p.h);
      var opts = uniq([lo, hi, hi - lo]).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
      if (opts.length < 2) return null;
      return {
        question: 'The piece left is <b>' + p.w + ' × ' + p.h + '</b>. What size is the next square cut from it?',
        options: opts.map(function (o) { return o + ' × ' + o; }), answer: opts.indexOf(lo),
        explain: opts.map(function (o) {
          if (o === lo) return 'The biggest square that fits is as big as the short side: ' + lo + '.';
          if (o === hi) return 'A ' + hi + ' × ' + hi + ' square would stick out: the piece is only ' + lo + ' on its short side.';
          return hi - lo + ' is what is left after the cut, not the size of the square.';
        })
      };
    }, { id: 'c1-euclid-next' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Width and height (1 to 60)', value: [21, 12], placeholder: 'e.g. 21, 12', parse: parseWH,
      presets: [
        { label: '21 × 12', value: [21, 12] }, { label: '48 × 27', value: [48, 27] }, { label: '13 × 8', value: [13, 8] },
        { label: '17 × 1 (skinny)', value: [17, 1] }, { label: '12 × 12 (square)', value: [12, 12] }, { label: '34 × 21', value: [34, 21] }
      ],
      onApply: function (v) { player.setSteps(euclid(v[0], v[1])); }
    });
  }

  /* ================================================================== 13. variations */
  var VARIANT_BLOCKS = {
    min: 'let smallest = cards[0];\nfor (let i = 1; i < cards.length; i++) {\n  if (cards[i] < smallest) smallest = cards[i];\n}',
    sum: 'let total = 0;\nfor (const card of cards) {\n  total = total + card;\n}',
    count: 'let count = 0;\nfor (const card of cards) {\n  if (card === 7) count = count + 1;\n}'
  };
  function variationsFigure(tabsEl) {
    V.tabs(tabsEl);
    var data = { min: { vals: [6, 3, 8, 2, 5], label: 'smallest so far' }, sum: { vals: [4, 7, 1, 7, 3], label: 'total so far' }, count: { vals: [7, 2, 7, 5, 7], label: 'count of 7s' } };
    Object.keys(data).forEach(function (k) {
      var stage = tabsEl.querySelector('[data-mini="' + k + '"]');
      var view = C1.cardView(stage, { maxCard: 46, minCard: 30, gap: 8, readout: true, readoutLabel: data[k].label, showBest: k === 'min', bestLabel: 'smallest', ptrLabel: '', raise: k === 'min' ? 8 : 0, label: data[k].label });
      var steps = A.scanPattern(data[k].vals, k, 7).map(function (st) {
        st.readout = st.hand.value === null ? '–' : num(st.hand.value);
        return st;
      });
      V.teaser(stage, { steps: steps, stepMs: 900, holdMs: 1800, instantWrap: true, render: function (st, ctx) { view.render(cardState(st), ctx); } });
      V.codeBlock(tabsEl.querySelector('[data-code-block="' + k + '"]'), VARIANT_BLOCKS[k], 'js');
    });
  }

  /* ================================================================== 14. check yourself */
  function checks() {
    V.$('#predict-row').appendChild(C1.tiny.cards([-4, -9, -2, -7], null, { size: 42 }));
    V.quiz('#quiz-predict', {
      id: 'c1-predict-negatives', kicker: 'Predict the output',
      question: 'Run find-the-largest on the cards above: <code>−4, −9, −2, −7</code>. What does it say?',
      options: ['−2', '0', '−9', '−4'],
      answer: 0,
      explain: [
        '−2 is the largest: it is the closest to zero. The algorithm holds −4, keeps it against −9, swaps to −2, and keeps −2 against −7.',
        '0 is not one of the cards. The “best starts at 0” bug from the test bench would say this.',
        '−9 is the smallest. For negative numbers, a bigger digit means a smaller number.',
        '−4 is only the first card, the starting guess. −2 beats it.'
      ]
    });
    V.quiz('#quiz-which', {
      id: 'c1-which-algorithms',
      question: 'Which of these are algorithms? Pick all that apply.',
      options: ['Long division, as taught at school', '“Cook until golden, then season to taste.”', '“Start at 1 and keep adding 1.” (no rule for stopping)', 'Find a word in a dictionary: open it in the middle, keep the half the word must be in, repeat'],
      answer: [0, 3],
      explain: 'Long division and the dictionary search are precise and always finish. “Until golden” and “to taste” are not precise, and “keep adding 1” never stops, so neither is an algorithm.'
    });
    V.quiz('#quiz-count', {
      id: 'c1-count-comparisons',
      question: 'How many comparisons does find-the-largest make on 10 cards?',
      options: ['9', '10', 'It depends on the order of the cards', '45'],
      answer: 0,
      explain: [
        'The first card is taken without comparing. Each of the other 9 is compared with best exactly once.',
        'The first card is never compared: it starts as best.',
        'How often best <em>changes</em> depends on the order. How many comparisons does not: every card after the first is compared once.',
        '45 would be comparing every pair of cards. The algorithm only compares each card with best.'
      ]
    });
  }

  /* ================================================================== 15. summary card and timeline */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid'), T = C1.tiny;
    var tiles = [
      { svg: T.svg(150, 64, '<g class="c1-sum-recipe"><rect x="4" y="6" width="142" height="22" rx="6" class="is-bad"/><text x="12" y="21">some flour</text><text x="132" y="22" class="c1-sum-mark is-bad" text-anchor="end">?</text>' +
          '<rect x="4" y="36" width="142" height="22" rx="6" class="is-good"/><text x="12" y="51">150 g flour</text><text x="132" y="52" class="c1-sum-mark is-good" text-anchor="end">✓</text></g>'),
        label: 'Precise steps', text: 'Every step says exactly what to do. No “some”, no “until done”.' },
      { svg: T.svg(160, 64, '<g class="c1-sum-pipe"><rect x="2" y="14" width="46" height="36" rx="8" class="box"/><text x="25" y="37" text-anchor="middle">5 3 9</text>' +
          '<path d="M52 32 H62" class="arr"/><path d="M62 28 L68 32 L62 36 Z" class="arrh"/><rect x="70" y="10" width="42" height="44" rx="10" class="mach"/><text x="91" y="36" text-anchor="middle" class="mt">steps</text>' +
          '<path d="M116 32 H126" class="arr"/><path d="M126 28 L132 32 L126 36 Z" class="arrh"/><rect x="134" y="16" width="24" height="32" rx="5" class="out"/><text x="146" y="37" text-anchor="middle" class="ot">9</text></g>'),
        label: 'Input → steps → output', text: 'Same steps for every input; the output depends on the input.' },
      { svg: T.cards([5, 3, 9, null], ['visited', 'visited', 'key', 'default'], { tag: 2, ptr: 3, size: 26 }), label: 'State, one step at a time', text: 'Which step is next, and what you know so far.' },
      { svg: T.svg(170, 64, '<g class="c1-sum-blocks"><rect x="4" y="8" width="34" height="14" rx="4" class="b seq"/><rect x="4" y="42" width="34" height="14" rx="4" class="b seq"/><path d="M21 23 V40" class="l"/>' +
          '<path d="M85 6 L108 32 L85 58 L62 32 Z" class="b cho"/><text x="85" y="36" text-anchor="middle">?</text>' +
          '<rect x="128" y="36" width="36" height="16" rx="4" class="b rep"/><path d="M164 44 C176 44 176 14 146 14 C126 14 124 24 126 34" class="l rep"/><path d="M122 30 L126 37 L130 30 Z" class="arrh rep"/></g>'),
        label: 'Sequence, choice, repetition', text: 'Three building blocks are enough for any algorithm.' },
      { svg: T.svg(150, 64, '<g class="c1-sum-check"><text x="6" y="18">every input</text><text x="132" y="18" class="ok" text-anchor="end">✓</text><text x="6" y="38">right answer</text><text x="132" y="38" class="ok" text-anchor="end">✓</text><text x="6" y="58">always stops</text><text x="132" y="58" class="ok" text-anchor="end">✓</text></g>'),
        label: 'Correct and finite', text: 'Right for every valid input, and it always stops.' },
      { svg: T.svg(160, 64, '<g class="c1-sum-bars"><rect x="8" y="6" width="120" height="18" rx="4" class="up"/><text x="134" y="20">100</text><rect x="8" y="36" width="10" height="18" rx="3" class="half"/><text x="24" y="50">7</text></g>'),
        label: 'Same answer, different work', text: 'Halving needs 7 guesses where counting may need 100.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }
  function timeline() {
    var host = V.$('#timeline');
    var ev = [['c. 300 BCE', 'Euclid’s GCD'], ['c. 825', 'al-Khwarizmi'], ['1843', 'Lovelace, Note G'], ['1936', 'Turing makes it precise']];
    var ol = h('ol', { class: 'c1-timeline__list' });
    ev.forEach(function (e, i) { ol.appendChild(h('li', { class: 'c1-timeline__item' + (i === 1 ? ' is-here' : '') }, h('span', { class: 'c1-timeline__year' }, e[0]), h('span', { class: 'c1-timeline__what' }, e[1]))); });
    host.appendChild(ol);
  }

  function miniLegends() {
    var L = {
      blocks: [{ state: 'active', label: 'Step running now' }, { state: 'default', shape: 'outline', label: 'Step waiting' }],
      stops: [BACK, { state: 'compare', label: 'Card being checked' }, { state: 'visited', label: 'Already checked' }, { state: 'key', label: 'best' }],
      variants: [{ state: 'compare', label: 'Looking at now' }, { state: 'visited', label: 'Already scanned' }, { state: 'key', label: 'Held or counted' }, { state: 'found', label: 'Final answer' }]
    };
    Object.keys(L).forEach(function (k) { var el = V.$('[data-legend-for="' + k + '"]'); if (el) legend(el, L[k]); });
  }

  /* ================================================================== start */
  V.ready(function () {
    miniLegends();
    if (V.quizScore) CP.forEach(function (id) { V.quizScore.register(id); });   // lazily built figures: keep the page total stable
    heroTeaser();
    playFigure();
    ambiguityQuiz();
    zeroBugQuiz();
    halvingQuiz();
    checks();
    summaryCard();
    timeline();
    lazy('#fig-recipe', recipeFigure);
    lazy('#fig-pipeline', pipelineFigure);
    lazy('#fig-state', stateFigure);
    lazy('#blocks', blocksFigure);
    lazy('#fig-blocks-map', blocksMap);
    lazy('#lab-fig', labFigure);
    lazy('#fig-flow', flowFigure);
    lazy('#fig-bench', benchFigure);
    lazy('#stops', stopsFigure);
    lazy('#fig-race', raceFigure);
    lazy('#fig-bars', barsFigure);
    lazy('#fig-growth', growthFigure);
    lazy('#fig-euclid', euclidFigure);
    lazy('#variants', variationsFigure);
  });
}());
