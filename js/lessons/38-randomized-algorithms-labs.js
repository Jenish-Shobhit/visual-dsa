/* Lesson 38 — the three code-synced labs: reservoir sampling, skip list, Bloom filter.
   Each lab: custom input + presets, player, code panel (pseudocode, JavaScript, Python), variable watch, counters,
   legend, and a predict-before-reveal checkpoint. Exposes L38.labs.{reservoir, skip, bloom} = init functions.
   Loaded after js/lessons/38-randomized-algorithms-views.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L38 = V.lessons.l38;
  var R = V.algos.randomized;
  var esc = V.escape;

  L38.labs = {};
  function combine(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k] + '\n\n' + b[k]; }); return o; }

  function seedChip(seed) { return 'seed ' + seed; }
  function newSeed() { return 1 + Math.floor(Math.random() * 99998); }

  function toolbarButton(label, onclick, cls) {
    return h('button', { type: 'button', class: 'btn btn--sm ' + (cls || 'btn--secondary'), onclick: onclick }, label);
  }
  function errorLine() { return h('p', { class: 'field-error', role: 'alert', style: { margin: '4px 0 0', color: 'var(--st-error)', fontSize: '13px', fontWeight: '600', minHeight: '0' } }); }

  /* ================================================================== reservoir sampling */
  L38.labs.reservoir = function () {
    var fig = V.$('#lab-res');
    if (!fig) return;
    var stage = fig.querySelector('[data-stage]');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'key', label: 'Item arriving' },
      { state: 'done', label: 'In the reservoir' },
      { state: 'compare', label: 'The die roll j' },
      { state: 'swap', label: 'Evicted', shape: 'outline' },
      { state: 'muted', label: 'Dropped' }
    ]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: R.CODE.reservoir, default: 'pseudo', title: 'reservoirSample' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', item: 'key', j: 'compare', 'P(keep)': 'done' } });
    var view = L38.reservoirView(stage);
    var flowFig = V.$('#fig-res-flow'), flow = null;
    if (flowFig) {
      V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }]);
      flow = V.views.flowchart(flowFig.querySelector('[data-stage]'), {
        nodes: [
          { id: 'start', type: 'start', text: 'Start: empty reservoir', col: 0, row: 0 },
          { id: 'room', type: 'decision', text: 'Item number i arrives.\ni ≤ k ?', col: 0, row: 1, maxWidth: 150 },
          { id: 'fill', text: 'Put it in the next free slot', col: 1, row: 1 },
          { id: 'roll', type: 'decision', text: 'Roll j in 1…i.\nj ≤ k ?', col: 0, row: 2, maxWidth: 150 },
          { id: 'replace', text: 'Replace slot j, evict its item', col: 1, row: 2 },
          { id: 'skip', text: 'Drop the new item', col: 0, row: 3 },
          { id: 'more', type: 'decision', text: 'More items?', col: 1, row: 3 },
          { id: 'end', type: 'end', text: 'Return the reservoir', col: 1, row: 4 }
        ],
        edges: [
          { from: 'start', to: 'room' },
          { from: 'room', to: 'fill', label: 'yes' }, { from: 'room', to: 'roll', label: 'no' },
          { from: 'roll', to: 'replace', label: 'yes' }, { from: 'roll', to: 'skip', label: 'no' },
          { from: 'fill', to: 'more', via: { fromSide: 'right', toSide: 'right' } },
          { from: 'replace', to: 'more', via: { fromSide: 'right', toSide: 'right' } },
          { from: 'skip', to: 'more' },
          { from: 'more', to: 'room', label: 'yes', via: { fromSide: 'right', toSide: 'left', points: [[2.5, 3], [2.5, 0.5], [-0.5, 0.5], [-0.5, 1]] } },
          { from: 'more', to: 'end', label: 'no' }
        ]
      }, { label: 'Reservoir sampling decision flow' });
    }

    var stream = 'ABCDEFGHIJ'.split(''), k = 3, seed = 7, err = errorLine();
    function steps() { return R.reservoirSteps(stream, k, seed); }
    var first = steps();
    view.prepare(first);
    var player = V.player({
      root: fig, steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flow, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { seen: 'Seen', kept: 'Entered reservoir', replaced: 'Replacements', dropped: 'Dropped' }, counterStates: { kept: 'done', dropped: 'muted', replaced: 'swap' },
      baseStepMs: 1100, label: 'Reservoir sampling controls'
    });
    player.addCheckpoint(function (all) {
      var i = all.findIndex(function (s, x) { return (s.kind === 'replace' || s.kind === 'skip') && all[x - 1] && all[x - 1].kind === 'roll'; });
      return i;
    }, function (c) {
      var r = c.prev.roll, item = c.prev.stream[c.prev.cur].label, replace = c.step.kind === 'replace';
      var opts = replace ? ['<b>' + esc(item) + '</b> is dropped', '<b>' + esc(item) + '</b> replaces the item in slot ' + r.j, '<b>' + esc(item) + '</b> goes into a brand-new slot']
        : ['<b>' + esc(item) + '</b> replaces the item in slot 1', '<b>' + esc(item) + '</b> goes into a brand-new slot', '<b>' + esc(item) + '</b> is dropped'];
      var ans = replace ? 1 : 2;
      return {
        question: 'The reservoir holds ' + r.k + ' items and the die (' + r.i + ' faces) just showed <b>j = ' + r.j + '</b>. What happens to <b>' + esc(item) + '</b>?',
        options: opts, answer: ans,
        explain: replace ? ['Not this time: the roll landed on a keep face.', 'Yes: j = ' + r.j + ' is at most ' + r.k + ', so it takes slot ' + r.j + ' and the old item leaves.', 'The reservoir never grows past ' + r.k + ' items, so something must leave.']
          : ['Slot numbers only matter when j ≤ ' + r.k + '. Here j = ' + r.j + ' is larger.', 'The reservoir is already full, so there is no free slot.', 'Yes: j = ' + r.j + ' is greater than ' + r.k + ', so the new item is dropped and the reservoir is unchanged.']
      };
    }, { id: 'lab-res-predict' });

    var chip = h('span', { class: 'chip chip--sm', 'aria-live': 'off' }, seedChip(seed));
    function regen() { var s = steps(); view.prepare(s); player.setSteps(s); chip.textContent = seedChip(seed); }
    var inputHost = fig.querySelector('[data-input]');
    var inputEl = h('div', { class: 'rz-grow', style: { flexBasis: '100%' } });
    var sliderEl = h('div', { style: { flex: '0 1 240px' } });
    inputHost.appendChild(inputEl); inputHost.appendChild(sliderEl);
    inputHost.appendChild(h('div', { class: 'btn-row' }, toolbarButton('New seed', function () { seed = newSeed(); regen(); }), chip));
    inputHost.appendChild(err);
    var slider = V.slider(sliderEl, { label: 'Reservoir size k', min: 1, max: 6, value: k, onChange: function (v) { k = v; regen(); } });
    V.inputRow(inputEl, {
      label: 'Stream items (1 to 16, up to 3 characters each)', value: stream.join(' '), placeholder: 'e.g. A B C D E',
      parse: function (text) {
        var toks = String(text).split(/[\s,]+/).filter(Boolean);
        if (!toks.length) return { values: null, error: 'Type at least one item, separated by spaces.' };
        if (toks.length > 16) return { values: null, error: 'That is ' + toks.length + ' items. The lab shows up to 16 so every step stays readable.' };
        var bad = toks.filter(function (t) { return t.length > 3; })[0];
        if (bad) return { values: null, error: '“' + bad + '” is longer than 3 characters. Use short labels like A, B, 7.' };
        return { values: toks, error: null };
      },
      presets: [
        { label: 'Letters A–J', value: 'A B C D E F G H I J'.split(' ') },
        { label: 'Numbers 1–14', value: V.range(14, 1).map(String) },
        { label: 'Short stream (4)', value: 'W X Y Z'.split(' ') },
        { label: 'One item', value: ['Q'] }
      ],
      onApply: function (values) { stream = values; regen(); }
    });
    L38.res = { player: player, regen: regen };
  };

  /* ================================================================== skip list */
  L38.labs.skip = function () {
    var fig = V.$('#lab-skip');
    if (!fig) return;
    var MAXKEYS = 14;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Where the search stands', shape: 'ring' },
      { state: 'compare', label: 'Next tower (being compared)', shape: 'outline' },
      { state: 'path', label: 'Search path', shape: 'line' },
      { state: 'key', label: 'New tower' },
      { state: 'found', label: 'Found' }
    ]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: combine(R.CODE.skipSearch, R.CODE.skipInsert), default: 'pseudo', title: 'skiplist' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { x: 'active', level: 'compare', target: 'key', h: 'key' } });
    var view = L38.skipView(fig.querySelector('[data-stage]'));
    var seed = 3, rnd = V.rng(seed), list = R.skipBuild([6, 14, 21, 29, 35, 42, 50, 57, 63, 71, 80, 92], 49), mode = 'search', lastOp = 'search';
    var initial = R.skipSearchSteps(list, 71).steps;
    view.prepare(initial);
    var player = V.player({
      root: fig, steps: initial, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { compares: 'Comparisons', hops: 'Hops right', drops: 'Drops down', plain: 'Plain list needs' }, counterStates: { hops: 'path', drops: 'active', plain: 'muted' },
      baseStepMs: 1000, label: 'Skip list controls', onStep: function (st) { setInfo(st); }
    });
    player.addCheckpoint(function (all) {
      return all.findIndex(function (s) { return s.kind === 'down' || s.kind === 'flip'; });
    }, function (c) {
      if (c.step.kind === 'flip') {
        return {
          question: 'A new tower starts one level tall. Each flip of a fair coin grows it by one level on heads and stops on tails. What is the chance it reaches <b>level 3</b> or more?',
          options: ['1/8', '1/2', '1/4'], answer: 2,
          explain: ['1/8 would need three heads and gets a tower to level 4.', '1/2 is the chance of reaching level 2: one head.', 'Yes: two heads in a row, 1/2 × 1/2 = 1/4. Half of the towers stop at level 1, a quarter at level 2, and a quarter go higher.']
        };
      }
      var p = c.prev, pk = p.peek ? p.peek.key : null;
      return {
        question: 'On level ' + p.peek.level + ' the next tower is <b>' + (pk === null ? 'nothing (the end)' : pk) + '</b> and you are looking for <b>' + p.target + '</b>. What does the search do next?',
        options: ['Drop down one level', 'Hop right to ' + (pk === null ? 'the next tower' : pk), 'Stop: ' + p.target + ' is not in the list'], answer: 0,
        explain: ['Yes: never hop past the target. Drop to the finer level and keep going from the same tower.', 'Hopping would jump to ' + (pk === null ? 'nothing' : pk + ', which is not below ' + p.target) + ', so it would overshoot.', 'Not yet: a lower level may still hold ' + p.target + '. Only the bottom level can rule it out.']
      };
    }, { id: 'lab-skip-predict' });

    var err = errorLine();
    var seg, keyField = h('input', { class: 'field', type: 'text', inputmode: 'numeric', 'aria-label': 'Key (1 to 99)', placeholder: '1–99', style: { width: '5.5em' }, maxlength: 2, value: '71' });
    var goBtn = h('button', { type: 'button', class: 'btn btn--primary btn--sm' }, 'Search');
    var info = h('span', { class: 'rz-note', 'aria-live': 'polite' });
    function setInfo(st) { if (!info) return; var n = st ? st.nodes.length : list.keys.length, lv = st ? st.levels : R.skipTop(list); info.textContent = n + (n === 1 ? ' key' : ' keys') + ' · tallest tower ' + lv; }
    function load(steps, op) {
      view.prepare(steps); player.setSteps(steps); setInfo(steps[0]);
    }
    function parseKey() {
      var t = keyField.value.trim();
      if (!/^\d{1,2}$/.test(t) || +t < 1) { err.textContent = 'Type a whole number from 1 to 99.'; return null; }
      err.textContent = '';
      return +t;
    }
    function go() {
      var key = parseKey(); if (key === null) return;
      if (mode === 'insert') {
        if (list.keys.length >= MAXKEYS && !list.keys.some(function (n) { return n.key === key; })) { err.textContent = 'The lab holds up to ' + MAXKEYS + ' keys so the picture stays readable. Press “Start over”.'; return; }
        var res = R.skipInsertSteps(list, key, rnd);
        list = res.list; load(res.steps, 'insert');
      } else {
        load(R.skipSearchSteps(list, key).steps, 'search');
      }
    }
    goBtn.addEventListener('click', go);
    keyField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    function reset(keys) {
      seed = newSeed(); rnd = V.rng(seed);
      list = keys && keys.length ? R.skipBuild(keys, seed) : { keys: [] };
      var st = R.skipSearchSteps(list, keys && keys.length ? keys[Math.floor(keys.length / 2)] : 50).steps;
      if (!keys || !keys.length) st = [st[0]];
      load(st, 'search'); err.textContent = '';
    }
    var host = fig.querySelector('[data-input]');
    var segHost = h('div');
    host.appendChild(segHost);
    seg = V.segmented(segHost, { label: 'Operation', value: mode, options: [{ value: 'search', label: 'Search' }, { value: 'insert', label: 'Insert' }], onChange: function (v) { mode = v; goBtn.textContent = v === 'insert' ? 'Insert' : 'Search'; } });
    host.appendChild(h('label', { class: 'rz-toolrow', style: { gap: '8px', alignItems: 'center' } }, h('span', { class: 'field-label' }, 'Key'), keyField, goBtn));
    host.appendChild(h('div', { class: 'btn-row' },
      toolbarButton('Random 10 keys', function () { var r = V.rng(newSeed()), ks = {}; while (Object.keys(ks).length < 10) ks[r.int(1, 99)] = 1; reset(Object.keys(ks).map(Number)); }),
      toolbarButton('Keys 1–12 in order', function () { reset(V.range(12, 1)); }),
      toolbarButton('Start over', function () { reset([]); }),
      toolbarButton('New coins', function () { seed = newSeed(); rnd = V.rng(seed); err.textContent = ''; info.textContent = 'New coins: the next insert flips a fresh sequence.'; })));
    host.appendChild(info); host.appendChild(err);
    setInfo();
    L38.skip = { player: player };
  };

  /* ================================================================== Bloom filter */
  L38.labs.bloom = function () {
    var fig = V.$('#lab-bloom');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Bit is 1' },
      { state: 'compare', label: 'Hash target', shape: 'outline' },
      { state: 'swap', label: 'Bit just set' },
      { state: 'done', label: 'Checked: 1', shape: 'outline' },
      { state: 'error', label: 'Bit is 0 / false positive', shape: 'outline' }
    ]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: combine(R.CODE.bloomAdd, R.CODE.bloomCheck), default: 'pseudo', title: 'bloom' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { word: 'key', 'FP rate ≈': 'error' } });
    var view = L38.bloomView(fig.querySelector('[data-stage]'));
    var wordsEl = fig.querySelector('[data-words]');
    var m = 32, k = 3, state = R.bloomStart(m, k), lastOp = 'add', err = errorLine();

    var initial = R.bloomOpSteps(state, 'add', 'cat'); state = initial.state;
    var second = R.bloomOpSteps(state, 'check', 'dog'); state = second.state; initial.steps = initial.steps.concat(second.steps);
    view.prepare(initial.steps);
    function showWords(st) {
      V.clear(wordsEl);
      wordsEl.appendChild(h('span', {}, st.words && st.words.length ? 'Added so far:' : 'Nothing added yet.'));
      (st.words || []).forEach(function (w) { wordsEl.appendChild(h('span', { class: 'pill' }, w)); });
    }
    var player = V.player({
      root: fig, steps: initial.steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); showWords(st); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { added: 'Words added', checks: 'Checks', falsePositives: 'False positives', bitsSet: 'Bits set' }, counterStates: { falsePositives: 'error', bitsSet: 'frontier' },
      baseStepMs: 1000, label: 'Bloom filter controls'
    });
    player.addCheckpoint(function (all) {
      var i = all.findIndex(function (s) { return s.kind === 'probe'; });
      return i;
    }, function (c) {
      var p = c.prev, bitsOfWord = p.arrows.map(function (a) { return a.bit; });
      var allOn = bitsOfWord.every(function (b) { return p.bits[b] === 1; });
      return {
        question: '<b>' + esc(p.word) + '</b> hashes to bits <b>' + bitsOfWord.join(', ') + '</b>. Look at the bit row: what will the filter answer?',
        options: ['Definitely not in the set', 'Maybe in the set'], answer: allOn ? 1 : 0,
        explain: allOn ? ['One 0 would prove it is absent, but every one of these bits is 1.', 'All ' + bitsOfWord.length + ' bits are 1, so it says maybe. Whether that is true depends on whether some word really set them.']
          : ['Yes: at least one of its bits is 0. An added word would have set every one of its bits, and bits never clear, so it was never added.', 'A 0 among the bits is proof of absence, so the answer cannot be “maybe”.']
      };
    }, { id: 'lab-bloom-predict' });

    function load(steps, op) {
      view.prepare(steps); player.setSteps(steps);
    }
    function newFilter(mm, kk) {
      m = mm; k = kk; state = R.bloomStart(m, k);
      load([R.bloomIdle(state, 'An empty filter: <b>' + m + ' bits, all 0</b>, and <b>' + k + '</b> hash functions. Add a word to see the hash arrows.')], 'add');
    }
    function parseWord() {
      var t = wordField.value.trim().toLowerCase();
      if (!/^[a-z0-9]{1,12}$/.test(t)) { err.textContent = 'Use 1 to 12 letters or digits.'; return null; }
      err.textContent = ''; return t;
    }
    function addWords(words) {
      var all = [];
      words.forEach(function (w) { var r = R.bloomOpSteps(state, 'add', w); state = r.state; all = all.concat(r.steps); });
      load(all, 'add');
    }
    var wordField = h('input', { class: 'field rz-wordfield', type: 'text', 'aria-label': 'Word', placeholder: 'a word', maxlength: 12, value: 'owl', autocomplete: 'off', spellcheck: 'false' });
    var addBtn = h('button', { type: 'button', class: 'btn btn--primary btn--sm' }, 'Add');
    var chkBtn = h('button', { type: 'button', class: 'btn btn--secondary btn--sm' }, 'Check');
    addBtn.addEventListener('click', function () {
      var w = parseWord(); if (w === null) return;
      if (state.words.length >= 30) { err.textContent = 'That is plenty for a demo. Press Reset.'; return; }
      addWords([w]);
    });
    chkBtn.addEventListener('click', function () { var w = parseWord(); if (w === null) return; var r = R.bloomOpSteps(state, 'check', w); state = r.state; load(r.steps, 'check'); });
    wordField.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    var WORDS = ['cat', 'dog', 'fox', 'owl', 'bee', 'ant', 'elk', 'yak', 'emu', 'gnu', 'hen', 'pig', 'ram', 'cow', 'bat', 'eel'];
    function findFalsePositive() {
      if (state.words.length < 6) { var need = WORDS.filter(function (w) { return state.words.indexOf(w) < 0; }).slice(0, 8 - state.words.length); need.forEach(function (w) { state = R.bloomOpSteps(state, 'add', w).state; }); }
      for (var i = 1; i < 3000; i++) {
        var w = 'q' + i;
        if (state.words.indexOf(w) >= 0) continue;
        if (R.bloomIndexes(w, state.m, state.k).every(function (b) { return state.bits[b] === 1; })) { var r = R.bloomOpSteps(state, 'check', w); state = r.state; load(r.steps, 'check'); err.textContent = ''; return; }
      }
      err.textContent = 'No false positive yet: this filter is too empty. Add more words first.';
    }
    var host = fig.querySelector('[data-input]');
    host.appendChild(h('div', { class: 'rz-toolrow' }, h('label', { class: 'rz-toolrow', style: { gap: '8px', alignItems: 'center' } }, h('span', { class: 'field-label' }, 'Word'), wordField), h('div', { class: 'btn-row' }, addBtn, chkBtn)));
    var sm = h('div', { style: { flex: '1 1 170px' } }), sk = h('div', { style: { flex: '1 1 170px' } });
    host.appendChild(sm); host.appendChild(sk);
    V.slider(sm, { label: 'Bits m', min: 16, max: 40, step: 8, value: m, onChange: function (v) { newFilter(v, k); } });
    V.slider(sk, { label: 'Hash functions k', min: 1, max: 5, value: k, onChange: function (v) { newFilter(m, v); } });
    host.appendChild(h('div', { class: 'btn-row' },
      toolbarButton('Add 6 animals', function () { addWords(WORDS.filter(function (w) { return state.words.indexOf(w) < 0; }).slice(0, 6)); }),
      toolbarButton('Show a false positive', findFalsePositive),
      toolbarButton('Reset', function () { newFilter(m, k); err.textContent = ''; })));
    host.appendChild(err);
    showWords(state);
    L38.bloomLab = { player: player };
  };
}());
