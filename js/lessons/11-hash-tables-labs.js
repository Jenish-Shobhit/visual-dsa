/* Lesson 11 — Hash tables: the two big labs (chaining, open addressing) and the flowchart lit by the open lab.
   Both labs keep a script of operations (insert / search / delete / grow), regenerate the whole trace from it
   with VDSA.algos.hashing.chaining / .probing, and play the newest operation. Started lazily by
   js/lessons/11-hash-tables.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L11 = V.lessons.l11;
  function A() { return V.algos.hashing; }
  var MAX_OPS = 26;
  var KEY_ERROR = 'Use a whole number from 0 to 99999, or a word of up to 8 letters (a to z).';

  function opText(o) { return o.op === 'resize' ? 'grow' : o.op + ' ' + o.key; }

  /* The shared lab machinery. cfg: {root, mode, initial: {ops, opts}, generate(ops, opts), presets, legend, code, vars, flow?, checkpoint(player, opts)} */
  function makeLab(cfg) {
    var fig = V.$(cfg.root), A11 = A();
    var stage = fig.querySelector('[data-stage]');
    var state = { ops: cfg.initial.ops.slice(), opts: Object.assign({}, cfg.initial.opts) };
    var run = null, player = null, view;
    var keyEl = fig.querySelector('[data-key]'), hint = fig.querySelector('[data-hint]'), scriptEl = fig.querySelector('[data-script]');
    var hintDefault = hint.textContent, ctl = {};

    view = V.views.hashtable(stage, { mode: cfg.mode, threshold: cfg.threshold, label: cfg.label });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: cfg.code(state.opts), default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { key: 'key', 'h(key)': 'active', home: 'active', slot: 'compare', i: 'compare', m: 'muted', size: 'muted' } });
    V.legend(fig.querySelector('[data-legend]'), cfg.legend);

    function compute() { run = cfg.generate(state.ops, state.opts); return run; }
    function say(msg, bad) { hint.textContent = msg || hintDefault; hint.classList.toggle('is-bad', !!bad); if (bad) hint.setAttribute('role', 'alert'); else hint.removeAttribute('role'); }

    function renderScript() {
      V.clear(scriptEl);
      scriptEl.appendChild(h('span', { class: 'l11-script__label' }, 'Operations so far'));
      if (!state.ops.length) scriptEl.appendChild(h('span', { class: 'l11-script__none' }, 'none yet: insert a key'));
      state.ops.forEach(function (o, i) {
        scriptEl.appendChild(h('button', { type: 'button', class: 'l11-op l11-op--' + o.op, title: 'Jump to this operation', 'aria-label': 'Jump to operation ' + (i + 1) + ': ' + opText(o),
          onclick: function () { if (run && run.opStart[i] !== undefined) { player.pause(); player.goto(run.opStart[i]); } } }, opText(o)));
      });
      var undo = h('button', { type: 'button', class: 'btn btn--sm btn--ghost', disabled: state.ops.length ? null : 'disabled', onclick: function () { state.ops.pop(); rebuild(null, false); } }, 'Undo');
      var clear = h('button', { type: 'button', class: 'btn btn--sm btn--ghost', disabled: state.ops.length ? null : 'disabled', onclick: function () { state.ops = []; rebuild(0, false); } }, 'Clear');
      scriptEl.appendChild(h('span', { class: 'l11-script__btns' }, undo, clear));
      fig.querySelectorAll('[data-op]').forEach(function (b) { b.disabled = state.ops.length >= MAX_OPS; });
    }

    /* index: step to show (null = last); play: animate from there */
    function rebuild(index, play) {
      compute();
      view.reset(); view.prepare(run.steps);
      var at = index === null || index === undefined ? run.steps.length - 1 : Math.min(index, run.steps.length - 1);
      if (!player) {
        player = V.player({ root: fig, steps: run.steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, code: code, vars: vars, flow: cfg.flow || null,
          caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L11.COUNTER_LABELS, counterStates: L11.COUNTER_STATES,
          baseStepMs: 950, startAt: at, label: cfg.label + ' controls' });
        cfg.checkpoint(player, state.opts);
      } else player.setSteps(run.steps, { index: at });
      renderScript();
      if (play) player.play();
    }
    function addOp(op) {
      if (state.ops.length >= MAX_OPS) { say('The script is full (' + MAX_OPS + ' operations). Press Clear or Undo.', true); return; }
      var o = { op: op };
      if (op !== 'resize') {
        var k = A11.parseKey(keyEl.value);
        if (k === null) { say(KEY_ERROR, true); keyEl.setAttribute('aria-invalid', 'true'); keyEl.focus(); return; }
        o.key = k;
      }
      keyEl.removeAttribute('aria-invalid'); say('');
      state.ops.push(o);
      var before = state.ops.length - 1;
      compute();
      rebuildAt(before);
      if (op !== 'resize') { keyEl.select(); }
    }
    function rebuildAt(opIndex) {
      compute();
      view.reset(); view.prepare(run.steps);
      var at = run.opStart[opIndex];
      if (!player) rebuild(at, true);
      else { player.setSteps(run.steps, { index: at }); renderScript(); player.play(); }
    }
    fig.querySelectorAll('[data-op]').forEach(function (b) { b.addEventListener('click', function () { addOp(b.getAttribute('data-op')); }); });
    keyEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addOp('insert'); } });
    keyEl.addEventListener('input', function () { if (hint.classList.contains('is-bad')) { say(''); keyEl.removeAttribute('aria-invalid'); } });

    /* option controls: each rebuilds the whole script with the new option */
    function optionChanged() { rebuild(null, false); }
    var api = { fig: fig, state: state, rebuild: rebuild, ctl: ctl, view: view, code: code, get player() { return player; }, optionChanged: optionChanged, renderScript: renderScript, say: say };
    (cfg.controls || function () {})(api);

    /* presets */
    var pre = fig.querySelector('[data-presets]');
    pre.appendChild(h('span', { class: 'l11-script__label' }, 'Try'));
    cfg.presets.forEach(function (p) {
      pre.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title || null, onclick: function () {
        state.ops = p.ops.slice(); Object.assign(state.opts, p.opts || {});
        if (p.opts && ctl.sync) ctl.sync();
        say(''); rebuild(0, false);
      } }, p.label));
    });
    rebuild(0, false);
    return api;
  }

  var ins = function () { return [].slice.call(arguments).map(function (k) { return { op: 'insert', key: k }; }); };

  /* ================================================================== chaining lab */
  L11.chainLab = function () {
    var A11 = A();
    return makeLab({
      root: '#lab-chain', mode: 'chaining', threshold: 0.75, label: 'Hash table with separate chaining',
      code: function () { return A11.CODE.chaining; },
      legend: [{ state: 'active', label: 'New key / target bucket' }, { state: 'compare', label: 'Compared' }, { state: 'found', label: 'Found' }, { state: 'error', label: 'Removed / not found' }, { state: 'swap', label: 'Moved by a resize' }],
      initial: { ops: ins(10, 24, 15, 9).concat([{ op: 'search', key: 24 }]), opts: { m: 7, hash: 'mod', autoResize: false } },
      generate: function (ops, opts) { return A11.chaining(ops, { m: opts.m, hash: opts.hash, autoResize: opts.autoResize, threshold: 0.75 }); },
      presets: [
        { label: 'Collisions', ops: ins(10, 24, 15, 9).concat([{ op: 'search', key: 24 }]), opts: { m: 7, hash: 'mod', autoResize: false }, title: 'Keys 10 and 24 share bucket 3' },
        { label: 'All in one bucket', ops: ins(7, 14, 21, 28, 35).concat([{ op: 'search', key: 42 }]), opts: { m: 7, hash: 'mod', autoResize: false }, title: 'Worst case: every key is a multiple of 7' },
        { label: 'Fill and grow', ops: ins(12, 27, 8, 33, 41, 5, 19, 2, 60), opts: { m: 5, hash: 'mod', autoResize: true }, title: 'Watch the table grow twice' },
        { label: 'Words', ops: ins('cat', 'dog', 'bee', 'owl', 'ant', 'cow', 'hen').concat([{ op: 'search', key: 'dog' }, { op: 'delete', key: 'bee' }]), opts: { m: 7, hash: 'mod', autoResize: false } },
        { label: 'Bad hash: first letter', ops: ins('apple', 'apricot', 'avocado', 'almond', 'banana').concat([{ op: 'search', key: 'avocado' }]), opts: { m: 7, hash: 'first', autoResize: false }, title: 'Every fruit starting with a lands in one bucket' }
      ],
      controls: function (lab) {
        var fig = lab.fig, st = lab.state;
        var mSeg = V.segmented(fig.querySelector('[data-m]'), { label: 'Number of buckets', value: st.opts.m, options: [5, 7, 11].map(function (v) { return { value: v, label: String(v) }; }), onChange: function (v) { st.opts.m = v; lab.optionChanged(); } });
        var fnSeg = V.segmented(fig.querySelector('[data-fn]'), { label: 'Hash function', value: st.opts.hash, options: [{ value: 'mod', label: 'k mod m' }, { value: 'first', label: 'First character' }], onChange: function (v) { st.opts.hash = v; lab.optionChanged(); } });
        var auto = V.toggle(fig.querySelector('[data-auto]'), { label: 'Automatic', checked: st.opts.autoResize, onChange: function (on) { st.opts.autoResize = on; lab.optionChanged(); } });
        lab.ctl.sync = function () { mSeg.set(st.opts.m); fnSeg.set(st.opts.hash); auto.set(st.opts.autoResize); };
      },
      checkpoint: function (player) {
        player.addCheckpoint(function (steps) {
          for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'cmp' && steps[i].opName === 'insert' && steps[i - 1].kind === 'hash') return i;
          return -1;
        }, function (c) {
          var v = c.prev.vars, chain = v.chain || [], key = v.key, b = v['h(key)'];
          return { question: 'The key <b>' + key + '</b> hashes to bucket <b>' + b + '</b>, which already holds ' + chain.join(', ') + '. With chaining, what happens to <b>' + key + '</b>?',
            options: ['It joins the end of the chain in bucket ' + b, 'It goes to the next empty bucket', 'It replaces ' + chain[0]], answer: 0,
            explain: ['Yes. A chain absorbs a collision: the table walks the chain to make sure ' + key + ' is not already there, then links it on at the end. Nothing else moves.',
              'That is open addressing, the other plan. Chaining never leaves the bucket the hash chose.',
              'That would lose a stored key. A chain keeps every key that hashes here.'] };
        }, { id: 'l11-lab-chain-collision' });
      }
    });
  };

  /* ================================================================== open-addressing lab */
  L11.openLab = function () {
    var A11 = A();
    var flowView = null;
    var FLOW = {
      nodes: [
        { id: 'start', type: 'start', text: 'h = hash(key)\ni = 0', col: 0, row: 0 },
        { id: 'probe', type: 'process', text: 's = probe(key, i)', col: 0, row: 1 },
        { id: 'empty', type: 'decision', text: 'slot s empty?', col: 0, row: 2 },
        { id: 'match', type: 'decision', text: 'slot s holds key?', col: 0, row: 3 },
        { id: 'next', type: 'process', text: 'i = i + 1\n(other key or tombstone)', col: 0, row: 4 },
        { id: 'limit', type: 'decision', text: 'i < m ?', col: 0, row: 5 },
        { id: 'miss', type: 'end', text: 'return false', col: 1, row: 2, narrow: { col: 1, row: 2 } },
        { id: 'hit', type: 'end', text: 'return true', col: 1, row: 3, narrow: { col: 1, row: 3 } },
        { id: 'miss2', type: 'end', text: 'return false\n(all m slots probed)', col: 1, row: 5, narrow: { col: 1, row: 5 } }
      ],
      edges: [
        { from: 'start', to: 'probe' }, { from: 'probe', to: 'empty' },
        { from: 'empty', to: 'miss', label: 'yes' }, { from: 'empty', to: 'match', label: 'no' },
        { from: 'match', to: 'hit', label: 'yes' }, { from: 'match', to: 'next', label: 'no' },
        { from: 'next', to: 'limit' }, { from: 'limit', to: 'probe', label: 'yes' }, { from: 'limit', to: 'miss2', label: 'no' }
      ]
    };
    var flowFig = V.$('#fig-flow');
    flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW, { label: 'Flowchart of a search with open addressing', narrowWidth: 420 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the open-addressing lab' }]);
    var flow = L11.flowAdapter(flowView);
    var tabs;

    var lab = makeLab({
      root: '#lab-open', mode: 'open', threshold: 0.7, label: 'Hash table with open addressing',
      code: function (opts) { return A11.openCode(opts.kind); },
      legend: [{ state: 'active', label: 'New key / home slot' }, { state: 'compare', label: 'Probed: slot taken' }, { state: 'found', label: 'Found' }, { state: 'error', label: 'Deleted / not found' }, { state: 'pivot', label: 'Cluster (3+ filled in a row)' }, { state: 'swap', label: 'Moved by a resize' }, { state: 'muted', shape: 'dash', label: '† Tombstone' }],
      initial: { ops: ins(22, 33, 44, 15, 26).concat([{ op: 'search', key: 26 }]), opts: { m: 11, kind: 'linear', autoResize: true, clusters: true } },
      flow: flow,
      generate: function (ops, opts) { return A11.probing(ops, { m: opts.m, kind: opts.kind, autoResize: opts.autoResize, threshold: 0.7, clusters: opts.clusters }); },
      presets: [
        { label: 'Same home slot', ops: ins(22, 33, 44, 15, 26).concat([{ op: 'search', key: 26 }]), opts: { m: 11, autoResize: true, clusters: true }, title: '22, 33 and 44 all start at slot 0' },
        { label: 'Build a cluster', ops: ins(11, 22, 33, 44, 55, 66), opts: { m: 11, autoResize: true, clusters: true }, title: 'Six keys with home slot 0' },
        { label: 'Delete, then search', ops: ins(10, 17, 24).concat([{ op: 'delete', key: 10 }, { op: 'search', key: 24 }]), opts: { m: 7, autoResize: true, clusters: true }, title: 'A tombstone in action' },
        { label: 'Fill and grow', ops: ins(3, 8, 13, 4, 9), opts: { m: 5, autoResize: true, clusters: true }, title: 'Load passes 0.7 and the table doubles' },
        { label: 'Quadratic gets stuck', ops: ins(7, 14, 21, 28, 35), opts: { m: 7, kind: 'quadratic', autoResize: true, clusters: false }, title: 'Quadratic probing revisits the same 4 slots' }
      ],
      controls: function (l) {
        var fig = l.fig, st = l.state;
        var mSeg = V.segmented(fig.querySelector('[data-m]'), { label: 'Number of slots', value: st.opts.m, options: [5, 7, 11].map(function (v) { return { value: v, label: String(v) }; }), onChange: function (v) { st.opts.m = v; l.optionChanged(); } });
        var auto = V.toggle(fig.querySelector('[data-auto]'), { label: 'Automatic', checked: st.opts.autoResize, onChange: function (on) { st.opts.autoResize = on; l.optionChanged(); } });
        var cl = V.toggle(fig.querySelector('[data-clusters]'), { label: 'Highlight', checked: st.opts.clusters, onChange: function (on) { st.opts.clusters = on; l.optionChanged(); } });
        tabs = V.tabs(fig.querySelector('#open-tabs'), { onChange: function (name) { st.opts.kind = name; l.code.setSource(A11.openCode(name)); l.optionChanged(); } });
        l.ctl.sync = function () { mSeg.set(st.opts.m); auto.set(st.opts.autoResize); cl.set(st.opts.clusters); if (tabs.value !== st.opts.kind) { tabs.select(st.opts.kind); } l.code.setSource(A11.openCode(st.opts.kind)); };
        l.ctl.sync();
      },
      checkpoint: function (player, opts) {
        player.addCheckpoint(function (steps) {
          var first = -1, second = -1;
          for (var i = 1; i < steps.length; i++) {
            var st = steps[i];
            if (st.kind === 'probe' && st.opName === 'insert' && st.vars && st.vars.i === 1 && first < 0) first = i;
            if (st.kind === 'probe' && st.opName === 'insert' && st.vars && st.vars.i === 2 && second < 0) second = i;
          }
          return second > 0 ? second : first;
        }, function (c) {
          var st = c.step, v = st.vars, kind = st.probeKind, m = st.buckets, i = v.i, prevSlot = c.prev.vars.slot, key = v.key;
          var home = v.home, correct = v.slot;
          var cand = [correct, (prevSlot + 1) % m, (prevSlot + 2) % m, (home + i) % m, (home + 2 * i) % m, (prevSlot + m - 1) % m, (home + i * i) % m], opts2 = [];
          cand.forEach(function (x) { if (opts2.indexOf(x) < 0) opts2.push(x); });
          opts2 = opts2.slice(0, 3);
          if (opts2.indexOf(correct) < 0) opts2[2] = correct;
          var order = opts2.slice().sort(function (a, b) { return ((a * 7 + i * 3) % 11) - ((b * 7 + i * 3) % 11); });
          var formula = A11.probeFormula(kind, home, A11.secondHash(isNaN(+key) ? key : +key, m), m, i);
          var rule = kind === 'linear' ? 'linear probing moves one slot at a time' : kind === 'quadratic' ? 'quadratic probing uses (h + i²) mod m' : 'double hashing hops by the key’s own step h₂';
          return { question: 'Key <b>' + key + '</b> has home slot <b>' + home + '</b>, and the slots probed so far are taken. Where does <b>' + (kind === 'linear' ? 'linear' : kind === 'quadratic' ? 'quadratic' : 'double-hashing') + '</b> probe number <b>' + i + '</b> look?',
            options: order.map(function (x) { return 'Slot ' + x; }), answer: order.indexOf(correct),
            explain: order.map(function (x) { return x === correct ? 'Yes: probe ' + i + ' is <code>' + formula + '</code>. (' + rule + '.)' : 'Not slot ' + x + '. Probe ' + i + ' is <code>' + formula + '</code>.'; }) };
        }, { id: 'l11-lab-open-probe' });
      }
    });
    return lab;
  };
}());
