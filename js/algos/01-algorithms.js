/* Lesson 01 · What is an algorithm? — pure step generators (no DOM).

   Browser: VDSA.algos.lesson01.findMaxTrace([5, 3, 9]) … (loaded after js/vdsa/core.js)
   Node:    require('js/algos/01-algorithms.js').findMaxTrace([5, 3, 9])

   Every generator returns plain snapshot objects (docs/ENGINE.md → "Step conventions"): a step is a complete
   picture (never a diff), items keep stable ids, and colours only claim what is true:
     default  face down / not looked at yet      compare  being looked at right now
     key      the card held as "best so far"     visited  looked at and passed over
     found    the answer, shown only when the algorithm has finished
     muted    ruled out (guessing game)

   Contents
     findMaxTrace(values)            find the largest card: lab, flowchart, "state" figure, hero teaser
     pipelineSteps(values)           input → algorithm → output conveyor
     scanPattern(values, kind, t)    the same scan holding something else: 'min' | 'sum' | 'count'
     runFindMax(values, variant)     correct and buggy versions for the test bench
     benchResults(variant, inputs)   the test bench table
     guessCountUp / guessHalving     guess-my-number strategies
     raceSteps(secret, n)            both strategies side by side, one guess per step
     guessStats(n), worstHalving(n)  guesses for every secret 1..n; worst case ⌈log₂(n + 1)⌉
     euclidSteps(w, h)               Euclid's GCD by cutting squares off a w × h rectangle
*/
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.lesson01 = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Minus sign for captions: "−4" reads better than "-4". */
  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function plural(k, word) { return k + ' ' + word + (k === 1 ? '' : 's'); }
  function guesses(k) { return k + (k === 1 ? ' guess' : ' guesses'); }

  /* ================================================================ find the largest card

     The algorithm, written the same way in every figure:
       take    best ← cards[0]; i ← 1          (turn over the first card and hold it)
       more    while i < n                      (any cards still face down?)
       bigger  if cards[i] > best               (turn over card i and compare)
       update  best ← cards[i]                  (hold the bigger card instead)
       next    i ← i + 1                        (move to the next card)
       output  return best                      (say the card you hold)

     Each step carries: kind, cards [{id, value, up, state}], ptr (index of i, n = past the end, null = hidden),
     best (index or null), line (code label), flow (flowchart node id), eng (English step 1–6, 0 = none),
     caption, vars, counters {flips, comparisons, updates}. The comparison is strict (>), so with equal cards
     the FIRST copy stays best. */
  function findMaxTrace(input) {
    var a = (input || []).slice(), n = a.length, steps = [];
    var up = a.map(function () { return false; });
    var best = null, i = null, flips = 0, cmp = 0, upd = 0;

    function cards(phase, cur) {
      return a.map(function (v, k) {
        var st = up[k] ? 'visited' : 'default';
        if (k === best) st = phase === 'done' ? 'found' : 'key';
        else if (phase === 'cmp' && k === cur) st = 'compare';
        return { id: 'c' + k, value: v, up: up[k], state: st };
      });
    }
    function vars(withCard) {
      var o = {};
      if (i !== null) o.i = i;
      if (withCard && i !== null && i < n) o['cards[i]'] = a[i];
      if (best !== null) o.best = a[best];
      return o;
    }
    function push(kind, o) {
      steps.push({
        kind: kind, values: a, n: n,
        cards: cards(o.phase, o.cur), ptr: o.ptr === undefined ? i : o.ptr, best: best,
        line: o.line, flow: o.flow, eng: o.eng,
        caption: o.caption, vars: o.vars || vars(false),
        counters: { flips: flips, comparisons: cmp, updates: upd }
      });
    }

    if (!n) {
      push('empty', { ptr: null, line: null, flow: 'start', eng: 0, vars: {},
        caption: 'There are no cards, so there is no largest card. This algorithm needs at least one card as input.' });
      return steps;
    }

    push('start', { ptr: null, line: null, flow: 'start', eng: 0, vars: {},
      caption: plural(n, 'card') + ' lie face down. The goal: say the largest number, turning over one card at a time.' });

    up[0] = true; flips = 1; best = 0; i = 1;
    push('take', { line: 'take', flow: 'take', eng: 1,
      caption: 'Turn over the first card: <b>' + num(a[0]) + '</b>. There is nothing to compare it with yet, so it is the largest <em>so far</em>. Hold it as <b>best</b>.' });

    for (;;) {
      if (i < n) {
        push('more', { line: 'more', flow: 'more', eng: 2,
          caption: 'Is any card still face down? Yes: card ' + i + ' has not been turned over (i = ' + i + ' is less than n = ' + n + '), so the scan goes on.' });
      } else {
        push('more', { line: 'more', flow: 'more', eng: 2,
          caption: n === 1
            ? 'Is any card still face down? No: there was only one card, so the loop never runs.'
            : 'Is any card still face down? No: i = ' + i + ' has reached n = ' + n + ', every card has been turned over, so the loop ends.' });
        break;
      }

      var x = a[i], held = a[best];
      up[i] = true; flips++; cmp++;
      push('cmp', { phase: 'cmp', cur: i, line: 'bigger', flow: 'bigger', eng: 3, vars: vars(true),
        caption: 'Turn over card ' + i + ': <b>' + num(x) + '</b>. Is it bigger than <b>best = ' + num(held) + '</b>?' });

      var why;
      if (x > held) {
        best = i; upd++;
        push('update', { line: 'update', flow: 'update', eng: 4, vars: vars(true),
          caption: 'Yes: ' + num(x) + ' &gt; ' + num(held) + '. Hold <b>' + num(x) + '</b> instead. The old best can never be the answer now, because ' + num(x) + ' beats it.' });
        why = 'Move on to the next card.';
      } else if (x === held) {
        why = 'No: ' + num(x) + ' only <em>equals</em> best. A card must be strictly bigger to replace it, so the first ' + num(held) + ' stays. Move on to the next card.';
      } else {
        why = 'No: ' + num(x) + ' &lt; ' + num(held) + ', so keep holding ' + num(held) + '. Move on to the next card.';
      }
      i++;
      push('next', { line: 'next', flow: 'next', eng: 5, caption: why + ' Now i = ' + i + '.' });
    }

    i = null;
    push('done', { phase: 'done', ptr: null, line: 'output', flow: 'output', eng: 6, vars: { best: a[best] },
      caption: n === 1
        ? 'Say <b>' + num(a[best]) + '</b>. With a single card, that card is the largest: zero comparisons needed.'
        : 'Say <b>' + num(a[best]) + '</b>. Every other card was compared with best and none beat it, so it is the largest. That took ' + plural(cmp, 'comparison') + ' for ' + n + ' cards.' });
    return steps;
  }

  /* Reference answer for tests and the test bench. */
  function trueMax(values) {
    var m = values[0];
    for (var k = 1; k < values.length; k++) if (values[k] > m) m = values[k];
    return m;
  }

  /* ================================================================ input → algorithm → output
     Cards travel from the input tray into the machine one by one; the machine's "best" display updates;
     then the output card comes out. Step: {tray: [ids still waiting], taken: k, best: value|null,
     bestFrom: id|null, out: value|null, caption}. */
  function pipelineSteps(input) {
    var a = (input || []).slice(), n = a.length, steps = [], best = null, bestFrom = null;
    var ids = a.map(function (_, k) { return 'p' + k; });
    function push(taken, out, caption) {
      steps.push({ values: a, ids: ids, tray: ids.slice(taken), taken: taken, best: best, bestFrom: bestFrom, out: out, caption: caption });
    }
    push(0, null, n
      ? 'Input: a list of ' + plural(n, 'number') + '. The machine does not know them yet.'
      : 'Input: an empty list. The machine has nothing to read.');
    for (var k = 0; k < n; k++) {
      var v = a[k], prev = best;
      if (best === null || v > best) { best = v; bestFrom = ids[k]; }
      push(k + 1, null, prev === null
        ? 'The first number, ' + num(v) + ', goes in. It becomes the best so far.'
        : v > prev
          ? num(v) + ' goes in. It beats ' + num(prev) + ', so the best so far becomes ' + num(v) + '.'
          : num(v) + ' goes in. It does not beat ' + num(prev) + ', so the best so far stays ' + num(prev) + '.');
    }
    if (n) push(n, best, 'Output: <b>' + num(best) + '</b>. Same steps, different input, different output.');
    else push(0, null, 'No output: the input broke the rule "at least one number".');
    return steps;
  }

  /* ================================================================ the same scan, holding something else
     kind 'min': hold the smallest so far. 'sum': hold a running total. 'count': count cards equal to target.
     Step: {cards [{id, value, up: true, state}], ptr, best (index, 'min' only), hand: {label, value}, caption}. */
  function scanPattern(input, kind, target) {
    var a = (input || []).slice(), n = a.length, steps = [];
    var hand = kind === 'min' ? null : 0, best = null, labels = { min: 'smallest', sum: 'total', count: 'count of ' + num(target) };
    function cards(cur, done) {
      return a.map(function (v, k) {
        var st = k < cur ? 'visited' : 'default';
        if (k === cur) st = 'compare';
        if (kind === 'min' && k === best) st = done ? 'found' : 'key';
        if (kind === 'count' && v === target && k <= cur) st = done ? 'found' : 'key';
        return { id: 'q' + k, value: v, up: true, state: st };
      });
    }
    steps.push({ kind: 'start', cards: cards(-1), ptr: null, best: null, hand: { label: labels[kind], value: hand }, caption: 'Start.' });
    for (var k = 0; k < n; k++) {
      var v = a[k];
      if (kind === 'min') { if (hand === null || v < hand) { hand = v; best = k; } }
      else if (kind === 'sum') hand += v;
      else if (v === target) hand++;
      steps.push({ kind: 'scan', cards: cards(k), ptr: k, best: best, hand: { label: labels[kind], value: hand }, caption: 'Card ' + k + ': ' + num(v) + '.' });
    }
    steps.push({ kind: 'done', cards: cards(n, true), ptr: null, best: best, hand: { label: labels[kind], value: hand }, caption: 'Done.' });
    return steps;
  }

  /* ================================================================ correct and buggy versions
     runFindMax(values, variant, maxSteps) -> {result, halted, loops}
       correct   best ← cards[0]; i ← 1; while i < n: if cards[i] > best: best ← cards[i]; i ← i + 1
       zero      best ← 0 and scan every card: wrong when every card is negative
       early     returns the first card bigger than the first one: wrong when a bigger card comes later
       skipLast  while i < n − 1: never looks at the last card
       stuck     forgets i ← i + 1: never stops once there are two or more cards
     `halted: false` means the loop was still running after maxSteps iterations (it never ends). */
  var VARIANTS = ['correct', 'zero', 'early', 'skipLast', 'stuck'];
  function runFindMax(values, variant, maxSteps) {
    var a = values, n = a.length, limit = maxSteps || 1000, loops = 0, best, i;
    if (!n) return { result: null, halted: true, loops: 0 };
    switch (variant) {
      case 'zero':
        best = 0;
        for (i = 0; i < n; i++) { loops++; if (a[i] > best) best = a[i]; }
        return { result: best, halted: true, loops: loops };
      case 'early':
        best = a[0];
        for (i = 1; i < n; i++) { loops++; if (a[i] > best) return { result: a[i], halted: true, loops: loops }; }
        return { result: best, halted: true, loops: loops };
      case 'skipLast':
        best = a[0];
        for (i = 1; i < n - 1; i++) { loops++; if (a[i] > best) best = a[i]; }
        return { result: best, halted: true, loops: loops };
      case 'stuck':
        best = a[0]; i = 1;
        while (i < n) {
          if (loops >= limit) return { result: null, halted: false, loops: loops };
          loops++;
          if (a[i] > best) best = a[i];
          // bug: i never changes
        }
        return { result: best, halted: true, loops: loops };
      default:
        best = a[0];
        for (i = 1; i < n; i++) { loops++; if (a[i] > best) best = a[i]; }
        return { result: best, halted: true, loops: loops };
    }
  }

  var BENCH = [
    { id: 'mixed', label: 'Mixed', values: [3, 8, 5] },
    { id: 'first', label: 'Largest first', values: [9, 4, 1] },
    { id: 'last', label: 'Largest last', values: [2, 5, 7] },
    { id: 'equal', label: 'All equal', values: [6, 6, 6] },
    { id: 'one', label: 'One card', values: [42] },
    { id: 'negative', label: 'All negative', values: [-7, -2, -5] }
  ];
  function benchResults(variant, inputs) {
    return (inputs || BENCH).map(function (t) {
      var r = runFindMax(t.values, variant, 1000), expected = trueMax(t.values);
      return { id: t.id, label: t.label, values: t.values, expected: expected, result: r.result, halted: r.halted, loops: r.loops,
        pass: r.halted && r.result === expected };
    });
  }

  /* ================================================================ guess my number (secret in 1..n)
     guessCountUp: say 1, 2, 3, … until right.  guessHalving: always guess the middle of what is left.
     Each guess: {guess, lo, hi, reply: 'higher' | 'lower' | 'correct'} where lo..hi is the range still
     possible when the guess is made. */
  function checkSecret(secret, n) {
    if (!(n >= 1) || Math.floor(n) !== n) throw new RangeError('n must be a positive whole number');
    if (Math.floor(secret) !== secret || secret < 1 || secret > n) throw new RangeError('secret must be a whole number from 1 to n');
  }
  function guessCountUp(secret, n) {
    checkSecret(secret, n);
    var out = [];
    for (var g = 1; g <= secret; g++) out.push({ guess: g, lo: g, hi: n, reply: g === secret ? 'correct' : 'higher' });
    return out;
  }
  function guessHalving(secret, n) {
    checkSecret(secret, n);
    var out = [], lo = 1, hi = n;
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (mid === secret) { out.push({ guess: mid, lo: lo, hi: hi, reply: 'correct' }); break; }
      if (mid < secret) { out.push({ guess: mid, lo: lo, hi: hi, reply: 'higher' }); lo = mid + 1; }
      else { out.push({ guess: mid, lo: lo, hi: hi, reply: 'lower' }); hi = mid - 1; }
    }
    return out;
  }
  /* Worst case for halving: ⌈log₂(n + 1)⌉ guesses (each guess splits what is left roughly in half). */
  function worstHalving(n) {
    var k = 0, covered = 0;             // k guesses can tell apart 2^k − 1 secrets
    while (covered < n) { k++; covered = covered * 2 + 1; }
    return k;
  }
  /* guessStats(n) -> {countUp: [guesses for secret 1..n], halving: [...], avgCountUp, avgHalving, maxHalving} */
  function guessStats(n) {
    var cu = [], hv = [], sc = 0, sh = 0, mh = 0;
    for (var s = 1; s <= n; s++) {
      var h = guessHalving(s, n).length;
      cu.push(s); hv.push(h); sc += s; sh += h; if (h > mh) mh = h;
    }
    return { n: n, countUp: cu, halving: hv, avgCountUp: sc / n, avgHalving: sh / n, maxHalving: mh };
  }

  /* raceSteps(secret, n): both players guess once per step until both have found the secret.
     Step: {t, secret, n, up: {guess, count, done, reply}, half: {guess, lo, hi, count, done, reply}, caption}.
     `lo..hi` in `half` is the range still possible when that guess is made (the band on screen). */
  function raceSteps(secret, n) {
    var A = guessCountUp(secret, n), B = guessHalving(secret, n), steps = [];
    var T = Math.max(A.length, B.length);
    steps.push({ t: 0, secret: secret, n: n,
      up: { guess: null, count: 0, done: false, reply: null },
      half: { guess: null, lo: 1, hi: n, count: 0, done: false, reply: null },
      caption: 'The secret is ' + secret + ', somewhere in 1 to ' + n + '. Each player hears “higher”, “lower” or “got it” after every guess.' });
    for (var t = 1; t <= T; t++) {
      var ua = A[Math.min(t, A.length) - 1], hb = B[Math.min(t, B.length) - 1];
      var up = { guess: ua.guess, count: Math.min(t, A.length), done: t >= A.length, reply: ua.reply };
      var half = { guess: hb.guess, lo: hb.lo, hi: hb.hi, count: Math.min(t, B.length), done: t >= B.length, reply: hb.reply };
      var parts = [];
      if (t <= A.length) parts.push('Count-up guesses <b>' + ua.guess + '</b>' + (ua.reply === 'correct' ? ': got it after ' + guesses(A.length) + '.' : ', “higher”.'));
      else parts.push('Count-up is already done, after ' + guesses(A.length) + '.');
      if (t <= B.length) {
        parts.push(hb.reply === 'correct'
          ? 'Halving guesses <b>' + hb.guess + '</b>, the middle of ' + hb.lo + '–' + hb.hi + ': got it after ' + guesses(B.length) + '.'
          : 'Halving guesses <b>' + hb.guess + '</b>, the middle of ' + hb.lo + '–' + hb.hi + ': “' + hb.reply + '”, so ' +
            (hb.reply === 'higher' ? (hb.guess + 1) + '–' + hb.hi : hb.lo + '–' + (hb.guess - 1)) + ' is all that is left.');
      } else parts.push('Halving is already done, after ' + guesses(B.length) + '.');
      steps.push({ t: t, secret: secret, n: n, up: up, half: half, caption: parts.join(' ') });
    }
    return steps;
  }

  /* ================================================================ Euclid's rectangle
     euclidSteps(w, h): repeatedly cut the biggest square off a w × h rectangle (Euclid, Elements VII.1–2:
     subtract the smaller from the larger). When the leftover piece is itself a square, its side is the
     greatest common divisor: squares of that size tile every piece, and so the whole rectangle.
     Step: {kind: 'start'|'cut'|'done', W, H, w, h (leftover size), rem: {x, y, w, h}, squares: [{id, x, y, size, last?}],
            gcd?, line, caption, vars, counters: {cuts}} — coordinates in rectangle units, origin top-left. */
  function euclidSteps(W, H) {
    if (Math.floor(W) !== W || Math.floor(H) !== H || W < 1 || H < 1) throw new RangeError('width and height must be positive whole numbers');
    var w = W, h = H, x = 0, y = 0, squares = [], steps = [], cuts = 0;
    function push(kind, line, caption, extra) {
      var s = { kind: kind, W: W, H: H, w: w, h: h, rem: { x: x, y: y, w: w, h: h }, squares: squares, line: line, caption: caption,
        vars: { w: w, h: h }, counters: { cuts: cuts } };
      if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
      steps.push(s);
    }
    push('start', 'loop', W === H
      ? 'A ' + W + ' × ' + H + ' rectangle is already a square. Nothing to cut.'
      : 'A ' + W + ' × ' + H + ' rectangle. Is it a square? No (' + W + ' ≠ ' + H + '), so start cutting squares off it.');
    while (w !== h) {
      var sq, before = w + ' × ' + h, line;
      cuts++;
      if (w > h) { sq = { id: 's' + cuts, x: x, y: y, size: h }; x += h; w -= h; line = 'cutw'; }
      else { sq = { id: 's' + cuts, x: x, y: y, size: w }; y += w; h -= w; line = 'cuth'; }
      squares = squares.concat([sq]);
      push('cut', line, 'The piece is ' + before + '. Cut the biggest square that fits, ' + sq.size + ' × ' + sq.size + ', off its ' +
        (line === 'cutw' ? 'side' : 'top') + '. Left over: ' + w + ' × ' + h + (w === h ? ', a square.' : '.'), { cut: sq });
    }
    squares = squares.concat([{ id: 'last', x: x, y: y, size: w, last: true }]);
    push('done', 'ret', 'The leftover ' + w + ' × ' + w + ' piece is a square, so stop. <b>gcd(' + W + ', ' + H + ') = ' + w + '</b>: squares of side ' + w +
      ' tile every piece, and so the whole ' + W + ' × ' + H + ' rectangle.', { gcd: w });
    return steps;
  }
  /* Reference: gcd by remainders. */
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  return {
    findMaxTrace: findMaxTrace, trueMax: trueMax,
    pipelineSteps: pipelineSteps,
    scanPattern: scanPattern,
    VARIANTS: VARIANTS, runFindMax: runFindMax, BENCH: BENCH, benchResults: benchResults,
    guessCountUp: guessCountUp, guessHalving: guessHalving, worstHalving: worstHalving, guessStats: guessStats, raceSteps: raceSteps,
    euclidSteps: euclidSteps, gcd: gcd,
    num: num
  };
}));
