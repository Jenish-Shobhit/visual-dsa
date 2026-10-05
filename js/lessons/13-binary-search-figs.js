/* Lesson 13 — the first half of the lesson's figures: hero teaser, linear-search baseline, the guess-the-number game,
   halving a million, "where should you probe?", and the one-search walkthrough. Step generators live in
   js/algos/13-binary-search.js (VDSA.algos.binarySearch). Heavy figures start lazily (L13.whenNear in 13-binary-search.js). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L13 = V.lessons.l13;
  function B() { return V.algos.binarySearch; }
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  L13.fmt = fmt;

  var SORTED15 = [3, 8, 12, 17, 23, 29, 34, 41, 47, 55, 62, 68, 74, 81, 90];
  L13.SORTED15 = SORTED15;
  var SORTED16 = [4, 9, 15, 21, 28, 34, 41, 47, 55, 61, 67, 72, 80, 86, 91, 97];

  /* ================================================================== hero teaser: bars, half of them dimming */
  L13.heroTeaser = function () {
    var stage = V.$('#teaser');
    var view = V.views.array(stage, { mode: 'bars', showIndices: false, showValues: false, maxValue: 100, minValue: 0, label: 'Binary search animation', cellSize: 22, outerPointers: false, barHeight: 250 });
    var rng = V.rng(13);
    function data() {
      var vals = V.presets.sorted(31, { min: 6, max: 98, rng: rng });
      var x = vals[rng.int(0, 30)];
      var st = B().search(vals, x).filter(function (s) { return s.kind === 'start' || s.kind === 'compare' || s.kind === 'discard' || s.kind === 'found'; })
        .map(function (s) {
          return Object.assign({}, s, {
            items: s.items.map(function (it) { return it.state === 'default' ? Object.assign({}, it, { state: 'active' }) : it; }),
            regions: [],
            pointers: s.pointers.filter(function (p) { return p.name !== 'lo' && p.name !== 'hi'; }).map(function (p) { return Object.assign({}, p, { label: '' }); })
          });
        });
      view.reset(); view.prepare(st);
      return st;
    }
    var first = data();
    V.teaser(stage, { steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 780, holdMs: 1800, regenerate: data, staticIndex: Math.max(0, first.length - 5) });
  };

  /* ================================================================== linear search baseline */
  L13.linearFigure = function () {
    var fig = V.$('#fig-linear');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', label: 'Linear search over sixteen sorted values', cellSize: 52 });
    var TARGETS = { front: 15, middle: 55, end: 97, absent: 50 };
    function steps(k) { return B().linear(SORTED16, TARGETS[k]); }
    var cur = steps('middle');
    view.prepare(cur);
    var player = V.player({ root: fig, steps: cur, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons' }, counterStates: { comparisons: 'compare' }, baseStepMs: 520, speed: 1, speeds: [0.5, 1, 2, 4, 8], label: 'Linear search controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Target', value: 'middle',
      options: [{ value: 'front', label: '15 (near the front)' }, { value: 'middle', label: '55 (middle)' }, { value: 'end', label: '97 (last)' }, { value: 'absent', label: '50 (not there)' }],
      onChange: function (k) { cur = steps(k); view.reset(); view.prepare(cur); player.setSteps(cur); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Being checked' }, { state: 'visited', label: 'Checked, not it' }, { state: 'found', label: 'Found' }]);
  };

  /* ================================================================== guess the number */
  L13.guessFigure = function () {
    var fig = V.$('#fig-guess');
    var barHost = fig.querySelector('[data-bar]');
    var bar = L13.rangeBar(barHost, { min: 1, max: 100, ticks: [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], height: 112, label: 'Numbers 1 to 100: the bright part is still possible' });
    var input = fig.querySelector('[data-input]'), caption = fig.querySelector('[data-caption]'), logEl = fig.querySelector('[data-log]');
    var playEl = fig.querySelector('[data-play]'), controlsEl = fig.querySelector('[data-controls]');
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { guesses: 'Guesses', left: 'Numbers still possible', best: 'Halving needs at most' }, states: { guesses: 'compare', left: 'active', best: 'done' } });
    var rng = V.rng(Date.now() % 100000);
    var secret, lo, hi, guesses, over, mode = 'play', player = null;
    var HALVING_MAX = B().worstCase(100);

    function newGame() {
      secret = rng.int(1, 100); lo = 1; hi = 100; guesses = []; over = false;
      input.value = 50;
      renderPlay(0);
      say('I picked a number from 1 to 100. Type a guess and press <kbd>Enter</kbd>, or click the bar.');
      if (mode === 'watch') startWatch();
    }
    function say(html, state) { caption.innerHTML = html; if (state) caption.setAttribute('data-state', state); else caption.removeAttribute('data-state'); }
    function marksOf(list, activeLast) {
      return list.map(function (g, k) {
        var label = g.v + (g.verdict === 'higher' ? ' ↑' : g.verdict === 'lower' ? ' ↓' : g.verdict === 'hit' ? ' ✓' : '');
        var state = g.verdict === 'hit' ? 'found' : (activeLast && k === list.length - 1) ? 'compare' : 'muted';
        return { id: 'g' + k, at: g.v, label: label, state: state, side: k % 2 ? 'below' : 'above' };
      });
    }
    function renderPlay(ms) {
      bar.render({ live: over ? [secret, secret] : [lo, hi], marks: marksOf(guesses, true), hit: over ? secret : null,
        describe: over ? 'Found ' + secret + ' in ' + guesses.length + ' guesses.' : 'Still possible: ' + lo + ' to ' + hi + '.' }, { duration: ms === undefined ? 420 : ms });
      stats.update({ guesses: guesses.length, left: over ? 1 : hi - lo + 1, best: HALVING_MAX });
      V.clear(logEl);
      guesses.forEach(function (g, k) {
        logEl.appendChild(h('span', { class: 'l13-chip', 'data-verdict': g.verdict }, (k + 1) + '. ' + g.v + (g.verdict === 'higher' ? ' → higher' : g.verdict === 'lower' ? ' → lower' : ' ✓')));
      });
      playEl.querySelector('[data-guess]').disabled = over;
      input.disabled = over;
    }
    function submit(v) {
      if (over) return;
      if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v || v < 1 || v > 100) { say('Enter a whole number from 1 to 100.', 'error'); return; }
      var wasted = v < lo || v > hi;
      var verdict = v === secret ? 'hit' : v < secret ? 'higher' : 'lower';
      guesses.push({ v: v, verdict: verdict });
      if (verdict === 'hit') { over = true; }
      else if (verdict === 'higher') lo = Math.max(lo, v + 1);
      else hi = Math.min(hi, v - 1);
      renderPlay();
      var left = hi - lo + 1, mid = lo + Math.floor((hi - lo) / 2);
      if (over) {
        var k = guesses.length;
        say('<b>Found it: ' + secret + ' in ' + k + ' guess' + (k === 1 ? '' : 'es') + '.</b> ' + (k <= HALVING_MAX ? 'Halving would need at most ' + HALVING_MAX + ', so that is a great run.' : 'Halving would have needed at most ' + HALVING_MAX + '. Next time, always guess the middle of what is left.') + ' Press <em>Watch halving play</em> to see it.', 'done');
      } else if (wasted) {
        say('“' + (verdict === 'higher' ? 'Higher' : 'Lower') + '.” But you had <b>already ruled out</b> ' + v + ', so that guess taught you nothing. ' + left + ' numbers are still possible, ' + lo + ' to ' + hi + '.', 'compare');
      } else {
        say('“' + (verdict === 'higher' ? 'Higher' : 'Lower') + '.” Everything ' + (verdict === 'higher' ? 'up to ' + v : 'from ' + v + ' up') + ' is out: <b>' + left + ' numbers left</b>, ' + lo + ' to ' + hi + '. The middle of that range is <b>' + mid + '</b>: a guess there would rule out about half of them.');
        input.value = mid;
      }
    }
    fig.querySelector('[data-guess]').addEventListener('click', function () { submit(parseFloat(input.value)); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(parseFloat(input.value)); } });
    fig.querySelector('[data-newgame]').addEventListener('click', newGame);
    bar.el.addEventListener('click', function (e) {
      if (mode !== 'play' || over) return;
      var r = bar.el.getBoundingClientRect(), x = (e.clientX - r.left) * (bar.width() / r.width);
      var v = 1 + Math.floor((x - 14) / (bar.width() - 28) * 100);
      if (v >= 1 && v <= 100) { input.value = v; submit(v); }
    });
    bar.el.style.cursor = 'pointer';

    /* ---- watch mode: the halving strategy on the same secret ---- */
    function watchSteps() {
      var raw = B().guessSteps(secret, 1, 100), list = [];
      raw.forEach(function (st) {
        if (st.kind === 'guess' || st.kind === 'verdict' || st.kind === 'hit') list.push({ v: st.guess, verdict: st.kind === 'guess' ? null : st.verdict });
      });
      var seen = [], out = [];
      raw.forEach(function (st) {
        if (st.kind === 'guess') seen.push({ v: st.guess, verdict: null });
        else if (st.kind === 'verdict' || st.kind === 'hit') seen[seen.length - 1] = { v: st.guess, verdict: st.verdict };
        var marks = marksOf(seen.map(function (g) { return { v: g.v, verdict: g.verdict }; }), st.kind === 'guess');
        out.push({ live: [st.lo, st.hi], marks: marks, hit: st.kind === 'hit' ? st.guess : null, caption: st.caption, counters: { guesses: st.guesses, left: st.remaining, best: HALVING_MAX }, kind: st.kind });
      });
      return out;
    }
    function startWatch() {
      if (player) { player.destroy(); player = null; }
      playEl.hidden = true; controlsEl.hidden = false;
      var steps = watchSteps();
      player = V.player({ root: fig, steps: steps, render: function (st, ctx) { if (mode !== 'watch') return; bar.render({ live: st.live, marks: st.marks, hit: st.hit, describe: 'Halving strategy: ' + st.live[0] + ' to ' + st.live[1] + ' still possible.' }, { duration: ctx.duration }); },
        caption: caption, onStep: function (st) { if (mode === 'watch') stats.update(st.counters); },
        baseStepMs: 1300, label: 'Halving strategy controls' });
    }
    function stopWatch() {
      if (player) { player.destroy(); player = null; }
      playEl.hidden = false; controlsEl.hidden = true;
      V.clear(controlsEl);
      renderPlay(0);
      say(over ? 'You found ' + secret + '. Start a new number to play again.' : 'Your game, where you left it. Keep guessing.');
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Mode', value: 'play',
      options: [{ value: 'play', label: 'You play' }, { value: 'watch', label: 'Watch halving play' }],
      onChange: function (m) { mode = m; if (m === 'watch') startWatch(); else stopWatch(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Still possible' }, { state: 'muted', label: 'Ruled out' }, { state: 'compare', shape: 'dot', label: 'Latest guess (↑ higher, ↓ lower)' }, { state: 'found', label: 'The number' }]);
    newGame();
  };

  /* ================================================================== halving a million */
  L13.halvingFigure = function () {
    var fig = V.$('#fig-halving');
    var N = 1000000;
    var bar = L13.rangeBar(fig.querySelector('[data-bar]'), { min: 1, max: 1000, ticks: [], height: 84, label: 'Candidates that could still hold the target' });
    var ladder = fig.querySelector('[data-ladder]');
    var player = null;
    function build(n) {
      var seq = B().halving(n), out = [];
      seq.forEach(function (r, k) {
        var a = 1 + (n - r) / 2;
        var cap;
        if (k === 0) cap = '<b>' + L13.num(n) + (n === 1 ? ' candidate.' : ' candidates.') + '</b> ' + (n === 1 ? 'It' : 'Any of them') + ' could hold the target, so before the first comparison the whole bar is bright.';
        else if (r === 0) cap = 'After <b>' + k + (k === 1 ? ' comparison' : ' comparisons') + '</b> nothing is left: the target has been found or ruled out. That is ⌊log₂ ' + L13.num(n) + '⌋ + 1 = <b>' + k + '</b> ' + (k === 1 ? 'comparison' : 'comparisons') + ', from ' + L13.num(n) + (n === 1 ? ' candidate.' : ' candidates.');
        else cap = 'After <b>' + k + ' comparison' + (k === 1 ? '' : 's') + '</b>, at most <b>' + L13.num(r) + '</b> ' + (r === 1 ? 'candidate' : 'candidates') + ' can remain: each comparison keeps at most half.' + (k === 10 && n >= 1e6 ? ' Ten comparisons took us from ' + L13.num(n) + ' down to about a thousand.' : '');
        out.push({ k: k, r: r, n: n, caption: cap, live: r > 0 ? [a, a + r - 1] : null, counters: { comparisons: k, left: L13.num(r) }, seq: seq });
      });
      return out;
    }
    function render(st, ctx) {
      // the bar is a fixed 1000-wide picture of the candidates: r / n of it is bright
      var frac = st.r / st.n, w = frac * 1000, a = 1 + (1000 - w) / 2;
      bar.render({ live: st.r > 0 ? [a, a + Math.max(w, 0.6) - 1] : null, note: st.r > 0 ? L13.num(st.r) + ' left' : 'none left', describe: L13.num(st.r) + ' of ' + L13.num(st.n) + (st.n === 1 ? ' candidate remains.' : ' candidates remain.') }, { duration: ctx.duration });
      // ladder chips
      V.clear(ladder);
      st.seq.forEach(function (r, k) {
        ladder.appendChild(h('span', { class: 'l13-ladder__chip' + (k < st.k ? ' is-past' : k === st.k ? ' is-now' : '') }, L13.compact(r)));
      });
    }
    var steps = build(N);
    player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', left: 'Candidates left (worst case)' }, counterStates: { comparisons: 'compare', left: 'active' },
      baseStepMs: 700, speeds: [0.5, 1, 2, 4], label: 'Halving controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Candidates', value: N,
      options: [{ value: 1000, label: '1,000' }, { value: 1000000, label: '1,000,000' }, { value: 1000000000, label: '1,000,000,000' }],
      onChange: function (n) { N = n; player.setSteps(build(n)); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Could still hold the target' }, { state: 'muted', label: 'Ruled out' }]);
  };

  /* ================================================================== where should you probe? */
  L13.probeFigure = function () {
    var fig = V.$('#fig-probe');
    var A = SORTED15, n = A.length;
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 50, label: 'Fifteen sorted values; click one to probe it' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { probed: 'You probed index', out: 'Ruled out', left: 'Left in the worst case' }, states: { probed: 'compare', out: 'muted', left: 'active' } });
    var caption = fig.querySelector('[data-caption]');
    var target = 29, probe = null, badges = false;
    function state() {
      var ruled = [], regs = [], v = probe === null ? null : A[probe], cmp = null;
      if (probe !== null && v !== target) {
        if (v < target) { for (var i = 0; i <= probe; i++) ruled.push(i); regs.push({ id: 'rl', from: 0, to: probe, state: 'muted', label: '< ' + target }); cmp = 'lt'; }
        else { for (var j = probe; j < n; j++) ruled.push(j); regs.push({ id: 'rr', from: probe, to: n - 1, state: 'muted', label: '> ' + target }); cmp = 'gt'; }
      }
      var items = A.map(function (val, i) {
        var st = 'default';
        if (ruled.indexOf(i) >= 0) st = 'muted';
        if (i === probe) st = v === target ? 'found' : 'compare';
        var it = { id: 'p' + i, value: val, state: st, aria: 'Value ' + val + ' at index ' + i };
        if (badges) { it.badge = String(Math.max(i, n - 1 - i)); it.badgeState = i === (n - 1) / 2 ? 'done' : 'muted'; }
        return it;
      });
      return { items: items, regions: regs, pointers: probe === null ? [] : [{ name: 'probe', index: probe, state: v === target ? 'found' : 'compare', side: 'above', id: 'pp' }], ruled: ruled.length, cmp: cmp };
    }
    function draw(ms) {
      var st = state();
      view.render(st, { duration: ms === undefined ? 450 : ms });
      var worst = probe === null ? 0 : Math.max(probe, n - 1 - probe);
      stats.update({ probed: probe === null ? '–' : probe, out: probe === null ? 0 : (A[probe] === target ? 'none' : st.ruled), left: probe === null ? n : (A[probe] === target ? 'found' : n - st.ruled) });
      var mid = (n - 1) / 2;
      if (probe === null) caption.innerHTML = 'The target is <b>' + target + '</b>. Click any value to probe it and see what it rules out. Turn on <em>Show worst-case leftovers</em> first if you want a hint.';
      else if (A[probe] === target) caption.innerHTML = '<b>Lucky: a[' + probe + '] = ' + target + ' is the target.</b> A blind probe hits with chance 1 in ' + n + ', so plan for a miss. Try another value.';
      else {
        var v = A[probe], left = n - st.ruled;
        caption.innerHTML = '<code>a[' + probe + '] = ' + v + '</code> is ' + (st.cmp === 'lt' ? 'smaller' : 'bigger') + ' than ' + target + '. Sorted order means ' + (st.cmp === 'lt' ? 'everything to its left is smaller still' : 'everything to its right is bigger still') + ', so <b>' + st.ruled + (st.ruled === 1 ? ' value is out</b> and ' : ' values are out</b> and ') + left + ' remain. ' +
          (probe === mid ? 'This is the middle: whichever way the comparison goes, at most ' + mid + (mid === 1 ? ' value is left.' : ' values are left.') + ' No probe guarantees more.' : 'Unlucky answers here could leave ' + worst + (worst === 1 ? ' value' : ' values') + '; the middle (index ' + mid + ') could never leave more than ' + mid + '.');
      }
    }
    view.on('click', function (e) { probe = e.index; draw(); });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Target', value: 29,
      options: [{ value: 29, label: 'x = 29' }, { value: 62, label: 'x = 62' }, { value: 8, label: 'x = 8' }, { value: 50, label: 'x = 50 (absent)' }],
      onChange: function (v) { target = v; probe = null; draw(); }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show worst-case leftovers', checked: false, onChange: function (on) { badges = on; draw(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Probe' }, { state: 'muted', label: 'Ruled out' }, { state: 'found', label: 'Match' }]);
    view.prepare([state()]);
    draw(0);
  };

  /* ================================================================== one search, step by step */
  L13.walkFigure = function () {
    var fig = V.$('#fig-walk');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 50, label: 'Binary search over fifteen values' });
    var UNSORTED = [3, 8, 62, 17, 23, 29, 34, 41, 47, 55, 12, 68, 74, 81, 90];
    var CASES = {
      found: { values: SORTED15, x: 62 },
      absent: { values: SORTED15, x: 50 },
      small: { values: SORTED15, x: 1 },
      unsorted: { values: UNSORTED, x: 62 }
    };
    function steps(k) { return B().search(CASES[k].values, CASES[k].x); }
    var cur = steps('found');
    view.prepare(cur);
    var player = V.player({ root: fig, steps: cur, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', left: 'Candidates left' }, counterStates: { comparisons: 'compare', left: 'active' }, baseStepMs: 1250, label: 'Binary search walkthrough controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Example', value: 'found',
      options: [{ value: 'found', label: 'Found (62)' }, { value: 'absent', label: 'Absent (50)' }, { value: 'small', label: 'Smaller than all (1)' }, { value: 'unsorted', label: 'Unsorted (breaks it)' }],
      onChange: function (k) { cur = steps(k); view.reset(); view.prepare(cur); player.setSteps(cur); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Candidates' }, { state: 'compare', label: 'Probe (mid)' }, { state: 'muted', label: 'Ruled out' }, { state: 'found', label: 'Found' }, { state: 'error', label: 'Missed target' }]);
    return player;
  };
}());
