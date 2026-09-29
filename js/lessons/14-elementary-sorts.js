/* Lesson 14 — Bubble, selection & insertion sort: figure wiring.
   Step generators: js/algos/14-elementary-sorts.js (VDSA.algos.sorting.bubble / selection / insertion).
   Custom views + helpers: js/lessons/14-elementary-sorts-views.js. Lab, race, charts, chooser:
   js/lessons/14-elementary-sorts-lab.js. Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L14 = V.lessons.l14;
  function S() { return V.algos.sorting; }
  function fmt(v) { return L14.fmt(v); }
  var TITLE = { bubble: 'Bubble sort', selection: 'Selection sort', insertion: 'Insertion sort' };

  /* ================================================================== hero teaser: bars bubbling into order */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = V.views.array(stage, { mode: 'bars', showIndices: false, showValues: false, maxValue: 100, minValue: 0, label: 'Bubble sort animation', cellSize: 34 });
    var rng = V.rng(14);
    function data() {
      var st = S().bubble(V.presets.random(11, { min: 12, max: 98, rng: rng })).filter(function (s) { return s.kind !== 'pass'; });
      st = st.map(function (s) { return Object.assign({}, s, { regions: s.regions.map(function (r) { return Object.assign({}, r, { label: undefined }); }) }); });
      view.reset(); view.prepare(st);
      return st;
    }
    var first = data();
    // under reduced motion show a telling mid-run frame: the third finished pass, with its green final suffix
    var ends = [];
    first.forEach(function (s, k) { if (s.kind === 'passEnd') ends.push(k); });
    V.teaser(stage, { steps: first, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 300, holdMs: 1700, regenerate: data,
      staticIndex: ends.length > 2 ? ends[2] : first.length - 1 });
  }

  /* ================================================================== the problem: sort it yourself */
  function pairsFigure() {
    var fig = V.$('#fig-pairs');
    var row = L14.tokenRow(fig.querySelector('[data-stage]'), { look: 'box', cellSize: 60, gaps: true, arcs: true, label: 'Six values you can reorder by swapping neighbours' });
    var showArcs = false;
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show every out-of-order pair', checked: false, onChange: function (on) { showArcs = on; draw(); } });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { swaps: 'Your swaps', left: 'Out-of-order pairs left', best: 'Fewest possible' }, states: { swaps: 'swap', left: 'error', best: 'done' } });
    var msg = fig.querySelector('[data-msg]');
    var START = [5, 2, 6, 1, 4, 3];
    var items, swaps, best, rng = V.rng(3);
    function reset(vals) {
      items = vals.map(function (v, i) { return { id: 'p' + i, value: v }; });
      swaps = 0; best = S().inversions(vals).count;
      draw(0);
    }
    function draw(dur) {
      var vals = items.map(function (it) { return it.value; });
      var inv = S().inversions(vals).count, sorted = inv === 0;
      var descents = {};
      for (var k = 0; k + 1 < items.length; k++) if (vals[k] > vals[k + 1]) descents[k] = true;
      var arcs = [];
      if (showArcs) S().inversions(vals).pairs.forEach(function (p) { arcs.push({ a: items[p[0]].id, b: items[p[1]].id, state: p[1] === p[0] + 1 ? 'swap' : 'error' }); });
      row.render({
        arcs: arcs,
        items: items.map(function (it, k) { return { id: it.id, value: it.value, state: sorted ? 'done' : 'default', aria: 'Value ' + it.value + ' at index ' + k }; }),
        gaps: sorted ? [] : items.slice(0, -1).map(function (it, k) {
          return { index: k, state: descents[k] ? 'swap' : 'default', text: descents[k] ? '⇄' : '≤',
            label: (descents[k] ? 'Out of order: swap ' : 'In order: swap anyway ') + items[k].value + ' and ' + items[k + 1].value };
        })
      }, { duration: dur === undefined ? 420 : dur });
      stats.update({ swaps: swaps, left: inv, best: best });
      if (sorted) {
        msg.innerHTML = swaps === best
          ? '<b>Sorted in ' + swaps + ' swaps, the fewest possible.</b> Every neighbour swap of an out-of-order pair fixes exactly one out-of-order pair, and you started with ' + best + '.'
          : '<b>Sorted in ' + swaps + ' swaps.</b> The fewest possible was ' + best + ': each swap of an in-order pair created a new out-of-order pair that you then had to undo.';
        msg.setAttribute('data-state', swaps === best ? 'done' : 'compare');
      } else {
        msg.textContent = 'Click a ⇄ button between two neighbours to swap them. Red buttons mark neighbours that are out of order.';
        msg.removeAttribute('data-state');
      }
    }
    row.on('gap', function (e) {
      var k = e.index;
      if (!items[k + 1] || S().inversions(items.map(function (it) { return it.value; })).count === 0) return;
      var t = items[k]; items[k] = items[k + 1]; items[k + 1] = t;
      swaps++;
      draw();
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { reset(START); });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () {
      var vals;
      do { vals = V.shuffle([1, 2, 3, 4, 5, 6], rng); } while (S().inversions(vals).count < 5);
      reset(vals);
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', shape: 'dot', label: 'Neighbours out of order' }, { state: 'error', shape: 'line', label: 'Out-of-order pair' }, { state: 'done', label: 'Sorted' }]);
    reset(START);
  }

  /* ================================================================== intuition: three quiet mini loops */
  function intuitionMinis() {
    var host = V.$('#mini-intuition');
    var MINIS = [
      { algo: 'bubble', cap: '<b>Bubbles rise.</b> Neighbours trade places, and the biggest value floats to the end, pass after pass.' },
      { algo: 'selection', cap: '<b>Pick the shortest.</b> Line people up by repeatedly calling the shortest one left to the front.' },
      { algo: 'insertion', cap: '<b>Sort a hand of cards.</b> Pick up one card at a time and slide it into place among the cards you hold.' }
    ];
    MINIS.forEach(function (m, k) {
      var stage = h('div', { class: 'mini__stage l14-mini-stage', role: 'img', 'aria-label': TITLE[m.algo] + ' on five values, looping' });
      var figEl = h('figure', { class: 'mini' }, h('p', { class: 'l14-mini-title' }, TITLE[m.algo]), stage, h('figcaption', { html: m.cap }));
      host.appendChild(figEl);
      var view = V.views.array(stage, { mode: 'boxes', cellSize: 40, showIndices: false, label: TITLE[m.algo] + ' mini' });
      var rng = V.rng(40 + k);
      function data() {
        var st = S().run(m.algo, V.presets.random(5, { min: 1, max: 9, unique: true, rng: rng }))
          .filter(function (s) { return s.kind !== 'pass'; })
          .map(function (s) { return Object.assign({}, s, { regions: [], pointers: s.pointers.filter(function (p) { return p.name !== 'i'; }).map(function (p) { return Object.assign({}, p, { label: '' }); }) }); });
        view.reset(); view.prepare(st);
        return st;
      }
      var first = data();
      var tell = { bubble: 'swap', selection: 'newMin', insertion: 'shift' }[m.algo];
      var si = first.findIndex(function (s) { return s.kind === tell && s.round >= 2; });
      V.teaser(stage, { steps: first, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 620, holdMs: 1500, regenerate: data,
        staticIndex: si > 0 ? si : first.length - 1 });
    });
  }

  /* ================================================================== mechanism figures (sliced traces) */
  function slicedFigure(figSel, variants, legend) {
    var fig = V.$(figSel);
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 64, label: fig.querySelector('.fig__title').textContent });
    var cur = variants[0];
    var steps = cur.steps();
    view.prepare(steps);
    var player = V.player({ root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterStates: { comparisons: 'compare', swaps: 'swap', shifts: 'swap' }, baseStepMs: 1150 });
    if (variants.length > 1) {
      V.segmented(fig.querySelector('[data-seg]'), {
        label: 'Show', value: variants[0].id,
        options: variants.map(function (v) { return { value: v.id, label: v.label }; }),
        onChange: function (id) {
          cur = variants.filter(function (v) { return v.id === id; })[0];
          var st = cur.steps();
          view.reset(); view.prepare(st);
          player.setSteps(st);
        }
      });
    }
    V.legend(fig.querySelector('[data-legend]'), legend);
    return player;
  }
  function upTo(steps, pred) { for (var k = 0; k < steps.length; k++) if (pred(steps[k])) return steps.slice(0, k + 1); return steps; }

  function bubbleFigure() {
    slicedFigure('#fig-bubble', [
      { id: 'pass', label: 'First pass', steps: function () { return upTo(S().bubble([5, 1, 4, 2, 8, 3]), function (s) { return s.kind === 'passEnd'; }); } },
      { id: 'all', label: 'All passes', steps: function () { return S().bubble([5, 1, 4, 2, 8, 3]); } },
      { id: 'early', label: 'Sorted input', steps: function () { return S().bubble([1, 2, 3, 5, 7, 9]); } }
    ], L14.LEGENDS.bubble);
  }
  function selectionFigure() {
    slicedFigure('#fig-selection', [
      { id: 'pass', label: 'First pass', steps: function () { return upTo(S().selection([7, 4, 9, 2, 6, 5]), function (s) { return s.roundEnd; }); } },
      { id: 'all', label: 'All passes', steps: function () { return S().selection([7, 4, 9, 2, 6, 5]); } }
    ], L14.LEGENDS.selection);
  }
  function insertionFigure() {
    slicedFigure('#fig-insertion', [
      { id: 'one', label: 'One insertion', steps: function () {
        var all = S().insertion([2, 5, 7, 9, 4, 8]);
        var startAt = all.findIndex(function (s) { return s.kind === 'insert' && s.round === 3; });
        var endAt = all.findIndex(function (s) { return s.kind === 'insert' && s.round === 4; });
        var first = L14.restyle(all[startAt], { prefixTo: 3, line: null, caption: 'The prefix 2, 5, 7, 9 is already sorted. The next value to place is <b>4</b>, at index 4. The counters below count this insertion only.' });
        var base = all[startAt].counters;
        return [first].concat(all.slice(startAt + 1, endAt + 1)).map(function (s) {
          return Object.assign({}, s, { counters: { comparisons: s.counters.comparisons - base.comparisons, shifts: s.counters.shifts - base.shifts } });
        });
      } },
      { id: 'all', label: 'All rounds', steps: function () { return S().insertion([2, 5, 7, 9, 4, 8]); } },
      { id: 'sorted', label: 'Sorted input', steps: function () { return S().insertion([1, 3, 4, 6, 8, 9]); } }
    ], L14.LEGENDS.insertion);
  }

  /* ================================================================== invariant spotlight: three rows, k rounds */
  function spotlightFigure() {
    var fig = V.$('#fig-spotlight');
    var INPUT = [5, 8, 3, 6, 2, 7, 1, 4], n = INPUT.length;
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 44, label: 'Bubble, selection and insertion sort after the same number of rounds' });
    var frames = {};
    ['bubble', 'selection', 'insertion'].forEach(function (a) { frames[a] = S().roundFrames(S().run(a, INPUT, { idPrefix: a[0] })); });
    var finalIndexOf = {};
    INPUT.slice().map(function (v, i) { return { v: v, i: i }; }).sort(function (x, y) { return x.v - y.v || x.i - y.i; }).forEach(function (e, k) { finalIndexOf[e.i] = k; });
    var steps = [];
    for (var k = 0; k < n; k++) steps.push(stepFor(k));
    function stepFor(k) {
      var all = k === n - 1, rows = [], moving = 0;
      ['bubble', 'selection', 'insertion'].forEach(function (a) {
        var f = frames[a][k];
        var byId = {}; f.items.forEach(function (it) { byId[it.id] = it; });
        if (f.held) byId[f.held.id] = f.held;
        var fin = {}; f.final.forEach(function (i) { fin[i] = true; });
        var items = f.order.map(function (id, slot) {
          var it = byId[id], st = 'default', badge;
          if (all || fin[slot] || f.final.length === n) st = 'done';
          else if (a === 'insertion' && slot <= k) {
            st = 'visited';
            if (finalIndexOf[+id.slice(1)] !== slot) { badge = '→'; moving++; }
          }
          var o = { id: id, value: it.value, state: st };
          if (badge) { o.badge = badge; o.badgeState = 'compare'; }
          return o;
        });
        var region = null;
        if (all || f.final.length === n) region = { from: 0, to: n - 1, state: 'done', label: 'sorted' };
        else if (a === 'bubble' && k > 0) region = { from: n - k, to: n - 1, state: 'done', label: 'final' };
        else if (a === 'selection' && k > 0) region = { from: 0, to: k - 1, state: 'done', label: 'final' };
        else if (a === 'insertion') region = { from: 0, to: k, state: 'visited', label: 'sorted, not final' };
        rows.push({ id: a, label: TITLE[a].replace(' sort', ''), items: items, regions: region ? [Object.assign({ id: a + '-r' }, region)] : [], showIndices: a === 'insertion' });
      });
      var cap;
      if (k === 0) cap = 'Before any rounds. Nothing is guaranteed yet, except that insertion sort treats the first value as a sorted prefix of length 1.';
      else if (all) cap = 'After ' + k + ' rounds all three are sorted. The last value never needs a round of its own.';
      else cap = '<b>After ' + k + ' round' + (k === 1 ? '' : 's') + '.</b> Bubble: the ' + (k === 1 ? 'largest value is' : k + ' largest values are') + ' final at the right. Selection: the ' + (k === 1 ? 'smallest value is' : k + ' smallest are') + ' final at the left. Insertion: the first ' + (k + 1) + ' values are sorted among themselves, but ' + (moving ? moving + ' of them (→) will still move.' : 'none of them happens to need moving.');
      return { rows: rows, caption: cap };
    }
    view.prepare(steps);
    V.player({ root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 1700, label: 'Rounds completed' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Final' }, { state: 'visited', label: 'Sorted, not final' }, { state: 'compare', shape: 'dot', label: '→ will still move' }]);
  }

  /* ================================================================== stability: playing cards */
  var HAND = [{ value: 5, label: '♠' }, { value: 8, label: '♦' }, { value: 5, label: '♥' }, { value: 2, label: '♣' }, { value: 8, label: '♣' }];
  function cardName(c) { return fmt(c.value) + c.label; }
  function stabilityFigure() {
    var fig = V.$('#fig-stability');
    var rowsEl = {
      selection: { stage: fig.querySelector('[data-row="selection"] [data-cards]'), check: fig.querySelector('[data-row="selection"] [data-check]') },
      insertion: { stage: fig.querySelector('[data-row="insertion"] [data-cards]'), check: fig.querySelector('[data-row="insertion"] [data-check]') }
    };
    var views = {
      selection: L14.tokenRow(rowsEl.selection.stage, { look: 'card', cellSize: 58, showIndices: false, label: 'Cards sorted by selection sort' }),
      insertion: L14.tokenRow(rowsEl.insertion.stage, { look: 'card', cellSize: 58, showIndices: false, label: 'Cards sorted by insertion sort' })
    };
    var player = null, rng = V.rng(52);
    function build(hand) {
      var n = hand.length;
      var fr = {
        selection: S().roundFrames(S().selection(hand, { idPrefix: 'c' })),
        insertion: S().roundFrames(S().insertion(hand, { idPrefix: 'c' }))
      };
      var byId = {};
      hand.forEach(function (c, i) { byId['c' + i] = c; });
      // equal-rank pairs in original order
      var pairs = [];
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) if (hand[i].value === hand[j].value) pairs.push(['c' + i, 'c' + j]);
      function order(f) { return f.order.map(function (id) { return id === null && f.held ? f.held.id : id; }); }
      function flipped(ord, p) { return ord.indexOf(p[0]) > ord.indexOf(p[1]); }
      var steps = [], flippedAt = {};
      for (var k = 0; k < n; k++) {
        var st = { rows: {}, caption: '' }, notes = [];
        ['selection', 'insertion'].forEach(function (a) {
          var ord = order(fr[a][k]), prev = k ? order(fr[a][k - 1]) : ord;
          var moved = {};
          ord.forEach(function (id, slot) { if (prev[slot] !== id) moved[id] = true; });
          var bad = {};
          pairs.forEach(function (p) {
            if (flipped(ord, p)) { bad[p[0]] = bad[p[1]] = true; if (!flippedAt[a + p]) { flippedAt[a + p] = k; notes.push(TITLE[a] + ' just moved ' + cardName(byId[p[0]]) + ' behind ' + cardName(byId[p[1]]) + ': the two ' + rankWord(byId[p[0]].value) + ' have swapped order.'); } }
          });
          st.rows[a] = {
            items: ord.map(function (id) { var c = byId[id]; return { id: id, value: c.value, label: c.label, state: bad[id] ? 'error' : moved[id] ? 'swap' : 'default', aria: 'Card ' + cardName(c) }; }),
            checks: pairs.map(function (p) { return { a: byId[p[0]], b: byId[p[1]], ok: !flipped(ord, p) }; })
          };
        });
        if (k === 0) st.caption = 'Two cards share each duplicated rank. Watch their suits: a stable sort keeps ' + pairs.map(function (p) { return cardName(byId[p[0]]) + ' before ' + cardName(byId[p[1]]); }).join(' and ') + '.';
        else st.caption = '<b>Round ' + k + '.</b> ' + (notes.length ? notes.join(' ') : 'No equal cards changed order this round.');
        steps.push(st);
      }
      var last = steps[steps.length - 1];
      var verdict = { rows: {}, caption: '' };
      ['selection', 'insertion'].forEach(function (a) {
        var r = last.rows[a], badIds = {};
        r.checks.forEach(function (c, i) { if (!c.ok) { badIds['c' + hand.indexOf(c.a)] = badIds['c' + hand.indexOf(c.b)] = true; } });
        verdict.rows[a] = {
          items: r.items.map(function (it) {
            var inPair = pairs.some(function (p) { return p[0] === it.id || p[1] === it.id; });
            return Object.assign({}, it, { state: inPair ? (badIds[it.id] ? 'error' : 'done') : 'default' });
          }),
          checks: r.checks
        };
      });
      var selBad = verdict.rows.selection.checks.some(function (c) { return !c.ok; });
      verdict.caption = selBad
        ? 'Both rows are sorted by rank, but only insertion sort kept every pair of equal ranks in their original order. Selection sort’s long-distance swaps broke the order of at least one pair: it is <b>not stable</b>.'
        : 'This hand happened to survive selection sort, but that was luck: its long swaps can jump a card over an equal one, so selection sort is <b>not stable</b>. Deal another hand to see it fail.';
      steps.push(verdict);
      return steps;
    }
    function rankWord(v) { return { 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes', 7: 'sevens', 8: 'eights', 9: 'nines' }[v] || v + 's'; }
    function render(step, ctx) {
      ['selection', 'insertion'].forEach(function (a) {
        views[a].render({ items: step.rows[a].items }, { duration: ctx.duration });
        var el = rowsEl[a].check;
        V.clear(el);
        step.rows[a].checks.forEach(function (c) {
          el.appendChild(h('span', { class: 'l14-check', 'data-state': c.ok ? 'done' : 'error' },
            h('span', { class: 'l14-check__mark', 'aria-hidden': 'true' }, c.ok ? '✓' : '✗'),
            (c.ok ? cardName(c.a) + ' before ' + cardName(c.b) : cardName(c.b) + ' before ' + cardName(c.a)) + (c.ok ? ', order kept' : ', order broken')));
        });
      });
    }
    player = V.player({ root: fig, steps: build(HAND), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1800, label: 'Stability demo controls' });
    fig.querySelector('[data-deal]').addEventListener('click', function () {
      var suits = ['♠', '♥', '♦', '♣'], hand = [], used = {};
      var dup = rng.int(2, 9);
      var ranks = [dup, dup];
      while (ranks.length < 5) ranks.push(rng.int(2, 9));
      ranks = V.shuffle(ranks, rng);
      ranks.forEach(function (r) {
        var s; do { s = rng.pick(suits); } while (used[r + s]);
        used[r + s] = true; hand.push({ value: r, label: s });
      });
      player.setSteps(build(hand));
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { player.setSteps(build(HAND)); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Moved this round' }, { state: 'error', label: 'Equal cards out of order' }, { state: 'done', label: 'Equal cards in order' }]);
  }

  /* ================================================================== inversions: arcs that insertion sort removes one by one */
  function inversionFigure() {
    var fig = V.$('#fig-inversions');
    var row = L14.tokenRow(fig.querySelector('[data-stage]'), { look: 'box', cellSize: 54, arcs: true, lift: true, label: 'Values with every out-of-order pair joined by an arc' });
    var algo = 'insertion', values = [4, 1, 5, 3, 2];
    function derive() {
      var src = S().run(algo, values, { idPrefix: 'q' });
      var start = S().inversions(values).count;
      var byVal = {};
      src[0].items.forEach(function (it) { byVal[it.id] = it.value; });
      return src.filter(function (s) { return s.kind !== 'pass'; }).map(function (s, k, arr) {
        var ord = s.order.map(function (id) { return id === null && s.held ? s.held.id : id; });
        var keyId = s.held ? s.held.id : null;
        var stateOf = {};
        s.items.forEach(function (it) { stateOf[it.id] = it.state; });
        var cmp = ord.filter(function (id) { return stateOf[id] === 'compare'; });
        var arcs = [];
        for (var i = 0; i < ord.length; i++) for (var j = i + 1; j < ord.length; j++) {
          if (byVal[ord[i]] > byVal[ord[j]]) {
            var hot = (keyId && ((ord[i] === cmp[0] && ord[j] === keyId))) || (!keyId && cmp.length === 2 && ord[i] === cmp[0] && ord[j] === cmp[1]);
            arcs.push({ a: ord[i], b: ord[j], state: hot ? 'compare' : 'error' });
          }
        }
        var left = arcs.length;
        // the pair this step just fixed: drawn once more, dashed and green
        if (s.kind === 'shift' && keyId) {
          var moved = s.items.filter(function (it) { return it.state === 'swap'; })[0];
          if (moved) arcs.push({ a: keyId, b: moved.id, state: 'done', dashed: true });
        }
        if (s.kind === 'swap') {
          var sw = s.items.filter(function (it) { return it.state === 'swap'; }).map(function (it) { return it.id; });
          if (sw.length === 2) arcs.push({ a: sw[0], b: sw[1], state: 'done', dashed: true });
        }
        var moves = s.ops.shifts + s.ops.swaps;
        var items = ord.map(function (id) {
          var st = id === keyId ? 'key' : stateOf[id] === 'done' ? 'done' : stateOf[id] === 'compare' ? 'compare' : stateOf[id] === 'swap' ? 'swap' : 'default';
          return { id: id, value: byVal[id], state: st, lift: id === keyId };
        });
        var cap;
        if (s.kind === 'shift' || s.kind === 'swap') cap = 'One move fixed exactly one out-of-order pair (the dashed green arc). ' + left + ' left.';
        else if (s.kind === 'start') cap = start + ' arcs: every pair of values that sits in the wrong order gets one. ' + (algo === 'insertion' ? 'Insertion sort treats the key as sitting in the hole, so each shift is the key trading places with one larger neighbour.' : 'Each bubble swap trades two neighbours.');
        else if (s.kind === 'done') cap = 'No arcs left: sorted. ' + (algo === 'insertion' ? 'Shifts' : 'Swaps') + ': ' + moves + ', the same as the ' + start + ' arcs at the start.';
        else cap = s.caption;
        return { items: items, arcs: arcs, caption: cap, counters: { left: left, moves: moves, total: start } };
      });
    }
    var player = V.player({ root: fig, steps: derive(), render: function (s, ctx) { row.render(s, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { left: 'Out-of-order pairs left', moves: 'Moves so far', total: 'Pairs at the start' }, counterStates: { left: 'error', moves: 'swap', total: 'default' }, baseStepMs: 1050, label: 'Inversions demo controls' });
    function reload() { row.reset(); player.setSteps(derive()); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Algorithm', value: algo,
      options: [{ value: 'insertion', label: 'Insertion sort' }, { value: 'bubble', label: 'Bubble sort' }],
      onChange: function (v) { algo = v; reload(); }
    });
    var presets = fig.querySelector('[data-presets]');
    [['Example', [4, 1, 5, 3, 2]], ['Reversed', [6, 5, 4, 3, 2, 1]], ['Nearly sorted', [1, 2, 4, 3, 5, 6]], ['Random', null]].forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { values = p[1] ? p[1].slice() : V.presets.random(6, { min: 1, max: 9 }); reload(); } }, p[0]));
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Out-of-order pair' }, { state: 'compare', shape: 'line', label: 'Pair being compared' }, { state: 'done', shape: 'dash', label: 'Just fixed' }, { state: 'key', label: 'Key' }]);
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    var m = L14.miniCells;
    var minis = {
      early: m([1, 2, 4, 5, 7, 9], { states: ['done', 'done', 'done', 'done', 'done', 'done'], region: { from: 0, to: 5, state: 'done', label: 'one pass, 0 swaps: stop' }, label: 'A sorted array confirmed in one pass' }),
      binary: m([1, 3, 5, 8, 9, 4], { states: ['visited', 'visited', 'compare', 'visited', 'visited', 'key'], lift: 5, liftOver: 5, ghost: 5, tags: [{ at: 0, text: 'lo', state: 'active' }, { at: 2, text: 'mid', state: 'compare' }, { at: 5, text: 'hi', state: 'active' }], label: 'Binary search for the key’s slot in the sorted prefix' }),
      shell: m([9, 6, 2, 7, 1, 8, 4, 3], { arcs: [[0, 4, 'active'], [1, 5, 'active'], [2, 6, 'active'], [3, 7, 'active']], states: ['compare', 'default', 'default', 'default', 'compare'], label: 'Shell sort compares values four apart' }),
      topk: m([1, 2, 3, 9, 7, 5, 8, 6], { states: ['done', 'done', 'done'], region: { from: 0, to: 2, state: 'done', label: 'k = 3 passes' }, label: 'Three passes of selection sort give the three smallest' })
    };
    var blocks = {
      early: 'let end = n - 1;\nwhile (end > 0) {\n  let lastSwap = 0;\n  for (let j = 0; j < end; j++)\n    if (a[j] > a[j + 1]) {\n      swap(a, j, j + 1);\n      lastSwap = j;\n    }\n  end = lastSwap;   // after it: final\n}',
      cocktail: 'let lo = 0, hi = n - 1;\nwhile (lo < hi) {\n  for (let j = lo; j < hi; j++) if (a[j] > a[j + 1]) swap(a, j, j + 1);\n  hi--;                       // largest is final\n  for (let j = hi; j > lo; j--) if (a[j - 1] > a[j]) swap(a, j - 1, j);\n  lo++;                       // smallest is final\n}',
      binary: 'const key = a[i];\nlet lo = 0, hi = i;          // find the first slot with a[slot] > key\nwhile (lo < hi) {\n  const mid = (lo + hi) >> 1;\n  if (a[mid] > key) hi = mid; else lo = mid + 1;\n}\na.copyWithin(lo + 1, lo, i);  // same shifts as before\na[lo] = key;',
      shell: 'for (let gap = n >> 1; gap > 0; gap >>= 1)\n  for (let i = gap; i < n; i++) {\n    const key = a[i]; let j = i;\n    while (j >= gap && a[j - gap] > key) { a[j] = a[j - gap]; j -= gap; }\n    a[j] = key;\n  }',
      topk: 'for (let i = 0; i < k; i++) {      // only k passes\n  let min = i;\n  for (let j = i + 1; j < n; j++) if (a[j] < a[min]) min = j;\n  swap(a, i, min);\n}                                   // a[0..k-1] = the k smallest'
    };
    Object.keys(minis).forEach(function (k) { V.$('[data-mini="' + k + '"]').appendChild(minis[k]); });
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
    // cocktail shaker: a live mini loop showing the "turtle" 1 riding home in one backward sweep
    var stage = V.$('[data-mini="cocktail"]');
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 34, showIndices: false, label: 'Cocktail shaker sort moving a small value home' });
    var steps = S().cocktail([2, 3, 4, 5, 6, 1]).map(function (s) { return Object.assign({}, s, { pointers: [] }); });
    view.prepare(steps);
    V.teaser(stage, { steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 560, holdMs: 1800 });
    var bub = S().count('bubble', [2, 3, 4, 5, 6, 1]), ck = S().count('cocktail', [2, 3, 4, 5, 6, 1]);
    V.$('[data-cocktail-note]').textContent = 'On 2, 3, 4, 5, 6, 1 bubble sort needs ' + bub.rounds + ' passes and ' + bub.comparisons + ' comparisons; cocktail shaker sort needs ' + ck.rounds + ' sweeps and ' + ck.comparisons + ' comparisons.';
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-pass1', {
      kicker: 'Predict', id: 'l14-pass1',
      question: 'Bubble sort runs one pass over <code>6, 2, 8, 1, 5</code>. What does the array look like after that single pass?',
      options: ['<code>2, 6, 1, 5, 8</code>', '<code>1, 2, 8, 6, 5</code>', '<code>1, 2, 5, 6, 8</code>', '<code>2, 6, 8, 1, 5</code>'],
      answer: 0,
      explain: [
        'Right. 6 and 2 swap; 6 and 8 are in order; then 8 rides right past 1 and 5. One pass guarantees only that the largest value, 8, is at the end.',
        'That is one pass of selection sort: it swapped the minimum, 1, to the front. Bubble sort only swaps neighbours.',
        'One pass is not enough to sort this input. The 1 moves left only one step per pass, so it needs three passes to reach the front.',
        'The pass does not stop after its first swap. It keeps comparing neighbours all the way to the end, carrying 8 along.'
      ]
    });
    V.quiz('#quiz-reversed', {
      id: 'l14-reversed-swaps',
      question: 'You sort the reversed array <code>6, 5, 4, 3, 2, 1</code>. Which algorithm makes the fewest swaps (or shifts)?',
      options: ['Bubble sort', 'Selection sort', 'Insertion sort', 'They tie: reversed input is the worst case for all three'],
      answer: 1,
      explain: [
        'Bubble sort swaps once per out-of-order pair, and reversed input has all 15 pairs out of order: 15 swaps.',
        'Right. Selection sort makes at most one swap per pass. Here it swaps 6↔1, 5↔2 and 4↔3, then finds everything in place: 3 swaps.',
        'Insertion sort shifts once per out-of-order pair: 15 shifts, the same as bubble sort’s swaps.',
        'They tie on comparisons (15 each), not on moves. Selection sort needs only 3 swaps.'
      ]
    });
    V.quiz('#quiz-stable', {
      id: 'l14-selection-stable',
      question: 'Is selection sort stable?',
      options: ['Yes: it never swaps two equal values with each other', 'No: a long-distance swap can jump a value over an equal one', 'Yes, as long as the comparison is strict (<code>&lt;</code>, not <code>≤</code>)', 'Only on inputs without duplicates'],
      answer: 1,
      explain: [
        'It never swaps equal values with each other, but it swaps a value with a far-away minimum, and that jump can carry it past an equal value in between. Look at 5♠ in the card figure.',
        'Right. Swapping a[i] with the minimum sends a[i] far to the right, past everything in between, including an equal key. With 5♠, 8♦, 5♥, 2♣ the first swap sends 5♠ behind 5♥.',
        'The strict test makes it pick the first of several equal minimums, which helps, but the swap still sends a[i] on a long jump. 5♠ still lands behind 5♥.',
        'Without duplicates, stability means nothing: there are no equal keys whose order could change. The question is about inputs with duplicates.'
      ]
    });
    V.quiz('#quiz-inversions', {
      id: 'l14-count-shifts',
      question: 'How many shifts will insertion sort make on <code>4, 1, 3, 2</code>?',
      options: ['3', '4', '6', '2'],
      answer: 1,
      explain: [
        'Count the out-of-order pairs: (4,1), (4,3), (4,2) and (3,2). There are four, and each shift fixes exactly one.',
        'Right. There are 4 out-of-order pairs, (4,1), (4,3), (4,2) and (3,2), and every shift removes exactly one of them.',
        'Six is the number of pairs in total (4 · 3 / 2). Only the out-of-order ones cost a shift.',
        'Key 1 needs one shift, key 3 needs one, and key 2 needs two more. That makes four.'
      ]
    });
    // click-the-answer on a frozen selection sort
    var host = V.$('#fig-click [data-stage]');
    var row = L14.tokenRow(host, { look: 'box', cellSize: 54, label: 'Selection sort after two passes' });
    var vals = [1, 2, 8, 5, 9, 4, 7];
    row.render({ items: vals.map(function (v, k) { return { id: 'k' + k, value: v, state: k < 2 ? 'done' : 'default', aria: 'Value ' + v + ' at index ' + k }; }) }, { duration: 0 });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l14-click-selection',
      question: 'Selection sort has finished two passes; the green values are final. Click the value it will swap into index 2 next.',
      check: function (id) {
        var v = vals[+id.slice(1)];
        if (id === 'k5') return true;
        if (v <= 2) return { correct: false, message: v + ' is already final. Pass 3 only scans the unsorted part, a[2..6].' };
        if (id === 'k2') return { correct: false, message: '8 is at index 2 now, but it is the largest value there. Pass 3 finds the smallest of a[2..6] and swaps it in.' };
        return { correct: false, message: v + ' is not the smallest of 8, 5, 9, 4, 7. Look for the minimum of the unsorted part.' };
      },
      right: 'Pass 3 scans 8, 5, 9, 4, 7, finds the minimum 4 at index 5, and swaps it with the 8 at index 2.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid'), m = L14.miniCells;
    var tiles = [
      { svg: m([3, 1, 2, 8, 9], { states: ['default', 'default', 'default', 'done', 'done'], region: { from: 3, to: 4, state: 'done', label: 'final' }, size: 26 }), label: 'Bubble sort', text: 'Swap out-of-order neighbours. After pass k, the k largest are final. Stops early on sorted input.' },
      { svg: m([1, 2, 9, 5, 7], { states: ['done', 'done', 'default', 'default', 'key'], region: { from: 0, to: 1, state: 'done', label: 'final' }, size: 26 }), label: 'Selection sort', text: 'Swap the minimum to the front. Always n(n − 1)/2 comparisons, at most n − 1 swaps. Not stable.' },
      { svg: m([2, 5, 8, 9, 4], { states: ['visited', 'visited', 'visited', 'visited', 'key'], lift: 4, ghost: 4, size: 26 }), label: 'Insertion sort', text: 'Slide each key into a sorted prefix. n − 1 comparisons when sorted: adaptive and stable.' },
      { svg: m([5, 5], { labels: ['♠', '♥'], states: ['done', 'done'], size: 30 }), label: 'Stability', text: 'Equal keys keep their order in bubble and insertion sort. Selection sort’s long swaps can break it.' },
      { svg: m([3, 1, 2], { arcs: [[0, 1], [0, 2]], size: 28 }), label: 'Inversions', text: 'Out-of-order pairs. Insertion shifts = bubble swaps = number of inversions.' },
      { svg: m([4, 3, 2, 1], { states: ['swap', 'swap', 'swap', 'swap'], size: 26, tags: [{ at: 0, text: 'n²/2', state: 'swap' }] }), label: 'Worst case O(n²)', text: 'Reversed input: n(n − 1)/2 comparisons for all three. All sort in place with O(1) extra space.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // the lab starts lazily; register its three predictions now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l14-lab-bubble-pass2', 'l14-lab-selection-jump', 'l14-lab-insertion-land'].forEach(V.quizScore.register);
    heroTeaser();
    checks();
    summaryCard();
    L14.whenNear('#fig-pairs', pairsFigure);
    L14.whenNear('#mini-intuition', intuitionMinis);
    L14.whenNear('#fig-bubble', bubbleFigure);
    L14.whenNear('#fig-selection', selectionFigure);
    L14.whenNear('#fig-insertion', insertionFigure);
    L14.whenNear('#fig-spotlight', spotlightFigure);
    L14.whenNear('#fig-stability', stabilityFigure);
    L14.whenNear('#fig-inversions', inversionFigure);
    L14.whenNear('#lab-fig', function () { L14.lab = L14.initLab(); });
    L14.whenNear('#fig-race', function () { L14.race = L14.initRace(); });
    L14.whenNear('#fig-bars', L14.initBars);
    L14.whenNear('#fig-growth', L14.initGrowth);
    L14.whenNear('#variants', variations);
    L14.whenNear('#fig-choose', L14.initChooser);
  });
}());
