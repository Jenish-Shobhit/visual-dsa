/* Lesson 32 · Greedy algorithms — pure step generators and reference solvers (no DOM).

   Browser: VDSA.algos.greedy.  Node: module.exports.

   Interval scheduling (one room, pick as many non-overlapping requests as possible)
     G.makeIntervals([[s, e], ...])          -> [{id: 'A', s, e}, ...]   (half-open: [s, e) — touching ends do not clash)
     G.STRATEGIES                            start | short | conflicts | finish  (label, what, keyText)
     G.order(ivs, strat) / G.pick(ivs, strat)   sorted list / greedy's kept ids
     G.optimalPick(ivs)                      earliest finish (provably optimal)
     G.scoreboard(ivs)                       {start, short, conflicts, finish} = how many each strategy keeps
     G.findCounterexample(strat, seed)       small instance where the strategy keeps fewer than the optimum
     G.parseIntervals(text) / G.intervalsToText(ivs) / G.randomIntervals(n, rng)
     G.intervalTrace(ivs, strat)             lab trace (code labels: key sort loop cmp skip take ret)
     G.optimalSets(ivs)                      every maximum-size compatible set (exhaustive; small n only)
     G.exchangeTrace(ivs, optIds)            swap the optimum's picks for greedy's one by one
   Coins:      G.greedyCoins  G.optimalCoins  G.coinTrace  G.firstCoinFailure  G.parseCoins
   Knapsack:   G.fractionalKnap  G.greedyKnap01  G.optimalKnap01  G.knapTrace  G.parseItems
   Huffman:    G.freqTable  G.huffmanTrace  G.huffmanCodes  G.huffmanCost  G.bitsPerChar  G.entropy  G.parseText
   Deadlines:  G.jobTrace  G.parseJobs
   Analogy:    G.hillTrace  G.TERRAINS
   Cost:       G.growth(n) -> {subsets, greedy}

   Every trace step is a complete snapshot: {kind, caption, line, vars, counters, <figure state>}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.greedy = api;
  }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function mulberry(seed) {
    var a = (seed === undefined ? 1 : seed) >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
    return next;
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ================================================================== interval scheduling */
  var T_MAX = 24;
  var STRATEGIES = {
    start: { label: 'Earliest start', what: 'start time, smallest first', keyName: 'start', keyText: function (iv) { return 'start ' + iv.s; } },
    short: { label: 'Shortest', what: 'length, shortest first', keyName: 'length', keyText: function (iv) { return 'len ' + (iv.e - iv.s); } },
    conflicts: { label: 'Fewest conflicts', what: 'number of other requests it overlaps, fewest first', keyName: 'clashes', keyText: function (iv, all) { return 'clash ' + conflictCount(iv, all); } },
    finish: { label: 'Earliest finish', what: 'finish time, smallest first', keyName: 'finish', keyText: function (iv) { return 'end ' + iv.e; } }
  };
  var STRAT_IDS = ['start', 'short', 'conflicts', 'finish'];

  function makeIntervals(pairs) { return pairs.map(function (p, i) { return { id: LETTERS[i], s: p[0], e: p[1] }; }); }
  function overlaps(a, b) { return a.s < b.e && b.s < a.e; }
  function conflictCount(iv, all) { var c = 0; all.forEach(function (o) { if (o !== iv && o.id !== iv.id && overlaps(iv, o)) c++; }); return c; }
  function keyOf(strat, iv, all) {
    if (strat === 'start') return iv.s;
    if (strat === 'short') return iv.e - iv.s;
    if (strat === 'conflicts') return conflictCount(iv, all);
    return iv.e;
  }
  /* Sorted by key, ties keep the typed order (stable). */
  function order(ivs, strat) {
    return ivs.map(function (iv, i) { return { iv: iv, k: keyOf(strat, iv, ivs), i: i }; })
      .sort(function (a, b) { return a.k - b.k || a.i - b.i; }).map(function (x) { return x.iv; });
  }
  function pick(ivs, strat) {
    var chosen = [];
    order(ivs, strat).forEach(function (r) { if (!chosen.some(function (c) { return overlaps(r, c); })) chosen.push(r); });
    return chosen.map(function (c) { return c.id; });
  }
  function optimalPick(ivs) { return pick(ivs, 'finish'); }
  function scoreboard(ivs) {
    var o = {};
    STRAT_IDS.forEach(function (s) { o[s] = pick(ivs, s).length; });
    return o;
  }
  function randomIntervals(n, rng) {
    var pairs = [];
    for (var i = 0; i < n; i++) {
      var len = rng.int(2, 9), s = rng.int(0, T_MAX - len);
      pairs.push([s, s + len]);
    }
    return makeIntervals(pairs);
  }
  /* Small instance on which `strat` keeps fewer than the optimum; deterministic per (strat, seed). */
  function findCounterexample(strat, seed) {
    var rng = mulberry((seed || 0) * 7919 + STRAT_IDS.indexOf(strat) * 104729 + 17);
    var best = null, found = 0;
    for (var tries = 0; tries < 60000 && found < 25; tries++) {
      var n = rng.int(4, 8);
      var pairs = [];
      for (var i = 0; i < n; i++) { var len = rng.int(2, 8), s = rng.int(0, T_MAX - len); pairs.push([s, s + len]); }
      var ivs = makeIntervals(pairs);
      var bad = optimalPick(ivs).length - pick(ivs, strat).length;
      if (bad > 0) {
        found++;
        if (!best || n < best.ivs.length || (n === best.ivs.length && bad > best.bad)) best = { ivs: ivs, bad: bad };
      }
    }
    return best ? best.ivs : null;
  }
  function parseIntervals(text) {
    var tokens = String(text || '').split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    if (tokens.length < 2) return { intervals: [], error: 'Enter at least 2 requests, like “0-4, 3-8”.' };
    if (tokens.length > 9) return { intervals: [], error: 'Use at most 9 requests so every row stays readable.' };
    var pairs = [];
    for (var i = 0; i < tokens.length; i++) {
      var m = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(tokens[i]);
      if (!m) return { intervals: [], error: '“' + tokens[i] + '” should look like 3-8 (start-end).' };
      var s = +m[1], e = +m[2];
      if (e > T_MAX || s > T_MAX) return { intervals: [], error: 'Keep times between 0 and ' + T_MAX + '.' };
      if (s >= e) return { intervals: [], error: '“' + tokens[i] + '” must end after it starts.' };
      pairs.push([s, e]);
    }
    return { intervals: makeIntervals(pairs), error: null };
  }
  function intervalsToText(ivs) { return ivs.map(function (iv) { return iv.s + '-' + iv.e; }).join(', '); }

  function fmtIv(iv) { return '<b>' + iv.id + '</b> (' + iv.s + '–' + iv.e + ')'; }
  function idList(ids) { return ids.length ? ids.join(', ') : 'none'; }

  function intervalTrace(ivs, strat) {
    var S = STRATEGIES[strat];
    var ord = order(ivs, strat);
    var best = optimalPick(ivs);
    var byId = {}; ivs.forEach(function (iv) { byId[iv.id] = iv; });
    var states = {}; ivs.forEach(function (iv) { states[iv.id] = 'default'; });
    var chosen = [], checked = 0, steps = [];
    var origOrder = ivs.map(function (iv) { return iv.id; });
    function keys() { var k = {}; ivs.forEach(function (iv) { k[iv.id] = S.keyText(iv, ivs); }); return k; }
    function push(kind, caption, line, o) {
      o = o || {};
      steps.push({
        kind: kind, caption: caption, line: line, cand: o.cand || null,
        vars: { r: o.cand || null, chosen: chosen.map(function (c) { return c.id; }), clash: o.clash === undefined ? null : o.clash },
        counters: { kept: chosen.length, checked: checked },
        tl: {
          order: (o.sorted ? ord : ivs).map(function (iv) { return iv.id; }),
          states: copy(states),
          keys: o.sorted ? keys() : null,
          busy: chosen.map(function (c) { return { s: c.s, e: c.e }; }),
          clash: o.clashRegions || [],
          ghosts: o.ghosts || []
        }
      });
    }
    push('init', '<b>' + plural(ivs.length, 'request') + '</b>, one room. Greedy will sort them by <b>' + S.what + '</b>, then walk down the list and keep every request that fits.', 'key');
    push('sort', 'Sorted by ' + S.what + '. Ties keep the order you typed them. The rows just re-ordered: this is the only “planning” greedy does. Now it walks the list once and never revisits a decision.', ['key', 'sort'], { sorted: true });
    ord.forEach(function (r) {
      var clashes = chosen.filter(function (c) { return overlaps(r, c); });
      checked++;
      states[r.id] = 'active';
      var why;
      if (!chosen.length) why = 'Nothing is kept yet, so nothing can clash.';
      else if (clashes.length) why = 'It overlaps ' + clashes.map(function (c) { return '<b>' + c.id + '</b>'; }).join(' and ') + ' (' + clashes.map(function (c) { return c.s + '–' + c.e; }).join(', ') + '), which greedy already kept.';
      else why = 'It overlaps nothing that is kept, so it fits.';
      push('look', 'Next in the list: ' + fmtIv(r) + '. Does it fit with what is already kept? ' + why, ['loop', 'cmp'], { sorted: true, cand: r.id, clash: clashes.length > 0 });
      if (clashes.length) {
        states[r.id] = 'error';
        var regions = [];
        clashes.forEach(function (c) { regions.push({ id: r.id, s: Math.max(r.s, c.s), e: Math.min(r.e, c.e) }); });
        push('skip', 'Skip <b>' + r.id + '</b>. Keeping it would break the rule that two requests cannot share the room. Greedy will not undo an earlier pick to make space: that is the “never look back” part.', 'skip', { sorted: true, cand: r.id, clash: true, clashRegions: regions });
        states[r.id] = 'muted';
      } else {
        chosen.push(r);
        states[r.id] = 'done';
        push('take', 'Keep <b>' + r.id + '</b>. The room is now busy from ' + r.s + ' to ' + r.e + ' (the shaded column), and this pick is final.', 'take', { sorted: true, cand: r.id, clash: false });
      }
    });
    var got = chosen.length, ghosts = [];
    var cap;
    if (got < best.length) {
      ghosts = best.slice();
      cap = '<b>Greedy kept ' + got + ', but ' + best.length + ' fit</b> (' + idList(best) + ', dashed). ' + S.label + ' commits to a request that blocks more than it is worth, and nothing can undo it. This strategy is <b>not</b> safe.';
    } else if (strat === 'finish') {
      cap = '<b>Kept ' + got + ' request' + (got === 1 ? '' : 's') + ': ' + idList(chosen.map(function (c) { return c.id; })) + '.</b> No schedule of this input can fit more. Earliest finish leaves the most room for what comes after, and that is provable.';
    } else {
      cap = '<b>Kept ' + got + ' request' + (got === 1 ? '' : 's') + '</b>, which happens to match the best possible (' + best.length + ') on this input. That is luck, not a guarantee: try another input.';
    }
    push('end', cap, 'ret', { sorted: true, ghosts: ghosts });
    return steps;
  }

  /* ---------- exchange argument ---------- */
  function subsetsOf(n) { var out = []; for (var m = 0; m < (1 << n); m++) out.push(m); return out; }
  function optimalSets(ivs) {
    var n = ivs.length, bestSize = 0, sets = [];
    subsetsOf(n).forEach(function (m) {
      var pick_ = [];
      for (var i = 0; i < n; i++) if (m & (1 << i)) pick_.push(ivs[i]);
      for (var a = 0; a < pick_.length; a++) for (var b = a + 1; b < pick_.length; b++) if (overlaps(pick_[a], pick_[b])) return;
      if (pick_.length > bestSize) { bestSize = pick_.length; sets = []; }
      if (pick_.length === bestSize) sets.push(pick_.slice().sort(function (x, y) { return x.s - y.s; }).map(function (x) { return x.id; }));
    });
    return sets;
  }
  function validSchedule(ids, byId) {
    var list = ids.map(function (id) { return byId[id]; });
    for (var a = 0; a < list.length; a++) for (var b = a + 1; b < list.length; b++) if (overlaps(list[a], list[b])) return false;
    return true;
  }
  /* Rows: greedy G (top) and optimum O (bottom). Item ids are 'G:X' and 'O:X'. */
  function exchangeTrace(ivs, optIds) {
    var byId = {}; ivs.forEach(function (iv) { byId[iv.id] = iv; });
    var G = optimalPick(ivs).map(function (id) { return byId[id]; }).sort(function (a, b) { return a.s - b.s; }).map(function (x) { return x.id; });
    var O = optIds.slice().sort(function (a, b) { return byId[a].s - byId[b].s; });
    var m = O.length, bench = [], swaps = 0, steps = [];
    var focus = null, mark = {}; // mark: 'agree' per index
    function push(kind, caption, o) {
      o = o || {};
      steps.push({
        kind: kind, caption: caption,
        counters: { size: O.length, agree: countAgree(), swaps: swaps },
        valid: validSchedule(O, byId),
        ex: { g: G.slice(), o: O.slice(), bench: bench.slice(), focus: o.focus === undefined ? null : o.focus, agreeUpTo: countAgree(), cmp: o.cmp || null, verdict: o.verdict || null }
      });
    }
    function countAgree() { var k = 0; while (k < O.length && k < G.length && O[k] === G[k]) k++; return k; }
    push('init', 'Top row: what greedy picked (' + G.length + ' requests). Bottom row: some <b>optimal</b> schedule, also ' + O.length + ' requests. They differ. We will show the optimum can be turned into greedy’s schedule, one swap at a time, without ever losing a request.');
    for (var k = 0; k < G.length; k++) {
      if (O[k] === G[k]) {
        push('agree', 'Pick ' + (k + 1) + ': the optimum already uses <b>' + G[k] + '</b>, just like greedy. Nothing to swap.', { focus: k });
        continue;
      }
      var g = byId[G[k]], o = byId[O[k]];
      push('compare', 'Pick ' + (k + 1) + ': greedy chose <b>' + g.id + '</b> (ends at ' + g.e + '), the optimum chose <b>' + o.id + '</b> (ends at ' + o.e + '). Greedy takes the earliest finish, so <b>' + g.e + ' ≤ ' + o.e + '</b>.', { focus: k, cmp: { g: g.id, o: o.id } });
      var out = O[k];
      O[k] = G[k];
      bench.push(out);
      swaps++;
      var next = O[k + 1] ? byId[O[k + 1]] : null;
      push('swap', 'Swap: take <b>' + o.id + '</b> out of the optimum and put <b>' + g.id + '</b> in its place. Same number of requests (' + O.length + ').', { focus: k, cmp: { g: g.id, o: o.id } });
      push('check', next
        ? 'Still valid? The next request <b>' + next.id + '</b> starts at ' + next.s + ' ≥ ' + o.e + ' (where ' + o.id + ' ended) ≥ ' + g.e + ' (where ' + g.id + ' ends), so it still fits after ' + g.id + '. The swap cannot cause a clash.'
        : 'Still valid? Nothing comes after it, and ' + g.id + ' ends no later than ' + o.id + ' did. No clash.', { focus: k, verdict: true });
    }
    push('end', 'The optimum is now exactly greedy’s schedule, and it never lost a request. So <b>greedy’s ' + G.length + ' is as good as any optimum</b>. That trick is called an <b>exchange argument</b>.', { verdict: true });
    return steps;
  }

  /* ================================================================== coins */
  function greedyCoins(coins, amount) {
    var sorted = coins.slice().sort(function (a, b) { return b - a; });
    var picks = [], rem = amount;
    while (rem > 0) {
      var c = null;
      for (var i = 0; i < sorted.length; i++) if (sorted[i] <= rem) { c = sorted[i]; break; }
      if (c === null) return { picks: picks, remaining: rem };
      picks.push(c); rem -= c;
    }
    return { picks: picks, remaining: 0 };
  }
  function optimalCoins(coins, amount) {
    var INF = Infinity, dp = [0], from = [null];
    for (var a = 1; a <= amount; a++) {
      dp[a] = INF; from[a] = null;
      for (var i = 0; i < coins.length; i++) {
        var c = coins[i];
        if (c <= a && dp[a - c] + 1 < dp[a]) { dp[a] = dp[a - c] + 1; from[a] = c; }
      }
    }
    if (dp[amount] === INF) return null;
    var picks = [], a2 = amount;
    while (a2 > 0) { picks.push(from[a2]); a2 -= from[a2]; }
    return picks.sort(function (x, y) { return y - x; });
  }
  /* Smallest amount where greedy uses more coins than the optimum. Kozen & Zaks (1994): if greedy is ever wrong, it is wrong
     somewhere below c[k-1] + c[k] (the two largest coins), so checking that far is a proof. */
  function firstCoinFailure(coins) {
    var sorted = coins.slice().sort(function (a, b) { return a - b; }), k = sorted.length;
    var bound = k >= 2 ? sorted[k - 1] + sorted[k - 2] : 2;
    for (var a = 1; a < bound; a++) {
      var g = greedyCoins(sorted, a), o = optimalCoins(sorted, a);
      if (!o || g.picks.length > o.length) return { amount: a, greedy: g.picks, best: o, bound: bound };
    }
    return { amount: null, bound: bound };
  }
  function parseCoins(text) {
    var tokens = String(text || '').split(/[\s,;]+/).filter(Boolean), vals = [];
    if (tokens.length < 2) return { coins: [], error: 'Enter at least 2 coin values, like 1, 3, 4.' };
    if (tokens.length > 6) return { coins: [], error: 'Use at most 6 coin values.' };
    for (var i = 0; i < tokens.length; i++) {
      var n = Number(tokens[i]);
      if (!isFinite(n) || !Number.isInteger(n) || n < 1 || n > 60) return { coins: [], error: '“' + tokens[i] + '” is not a whole number from 1 to 60.' };
      if (vals.indexOf(n) !== -1) return { coins: [], error: 'Each coin value should appear once (' + n + ' is repeated).' };
      vals.push(n);
    }
    vals.sort(function (a, b) { return a - b; });
    if (vals[0] !== 1) return { coins: [], error: 'Include a coin worth 1 so every amount can be paid.' };
    return { coins: vals, error: null };
  }
  function coinTrace(coins, amount) {
    var sorted = coins.slice().sort(function (a, b) { return a - b; });
    var g = greedyCoins(sorted, amount), o = optimalCoins(sorted, amount);
    var steps = [];
    var gp = [], op = [], rem = amount, orem = amount;
    function push(kind, caption, o2) {
      o2 = o2 || {};
      steps.push({
        kind: kind, caption: caption,
        coins: sorted, amount: amount,
        greedy: { picks: gp.slice(), remaining: rem, active: o2.gActive === undefined ? null : o2.gActive },
        best: { picks: op.slice(), remaining: orem, active: o2.oActive === undefined ? null : o2.oActive, shown: !!o2.showBest },
        verdict: o2.verdict || null
      });
    }
    push('init', 'Pay <b>' + amount + '</b> with coins worth ' + sorted.join(', ') + '. The greedy rule: always hand over the <b>biggest coin that still fits</b>.');
    g.picks.forEach(function (c) {
      var before = rem;
      gp.push(c); rem -= c;
      push('gpick', 'Biggest coin that fits in ' + before + ' is <b>' + c + '</b>. ' + (rem ? rem + ' left to pay.' : 'Nothing left: paid.'), { gActive: c });
    });
    push('gdone', 'Greedy is done: <b>' + plural(gp.length, 'coin') + '</b> (' + gp.join(' + ') + '). It never reconsidered a coin once it was handed over.', { gActive: null });
    push('ostart', 'Now the true minimum, found by trying <em>every</em> way of paying (that is dynamic programming, lesson 34).', { showBest: true });
    o.forEach(function (c) {
      orem -= c; op.push(c);
      push('opick', 'Best answer uses a <b>' + c + '</b>. ' + (orem ? orem + ' left.' : 'Paid exactly.'), { oActive: c, showBest: true });
    });
    var verdict;
    if (gp.length > o.length) {
      verdict = { ok: false };
      push('verdict', '<b>Greedy fails here:</b> ' + gp.length + ' coins against ' + o.length + '. Grabbing the ' + g.picks[0] + ' looked best <em>right now</em>, but it locked out ' + o.join(' + ') + '. Locally best is not globally best.', { showBest: true, verdict: verdict });
    } else {
      verdict = { ok: true };
      push('verdict', '<b>Greedy is optimal here:</b> both use ' + plural(o.length, 'coin') + '. For this coin set every big coin is worth at least what the smaller coins could build, so taking the biggest never hurts.', { showBest: true, verdict: verdict });
    }
    return steps;
  }

  /* ================================================================== knapsack */
  function makeItems(pairs) { return pairs.map(function (p, i) { return { id: LETTERS[i], w: p[0], v: p[1] }; }); }
  function ratioOrder(items) {
    return items.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) { return b.it.v / b.it.w - a.it.v / a.it.w || a.i - b.i; }).map(function (x) { return x.it; });
  }
  function fractionalKnap(items, cap) {
    var rem = cap, value = 0, taken = [];
    ratioOrder(items).forEach(function (it) {
      if (rem <= 0) return;
      var take = Math.min(it.w, rem), f = take / it.w;
      taken.push({ id: it.id, w: take, frac: f, value: it.v * f });
      value += it.v * f; rem -= take;
    });
    return { taken: taken, value: value, used: cap - rem };
  }
  function greedyKnap01(items, cap) {
    var rem = cap, value = 0, taken = [];
    ratioOrder(items).forEach(function (it) { if (it.w <= rem) { taken.push(it.id); value += it.v; rem -= it.w; } });
    return { taken: taken, value: value, used: cap - rem };
  }
  function optimalKnap01(items, cap) {
    var n = items.length, dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(cap + 1).fill(0)); }
    for (i = 1; i <= n; i++) for (var c = 0; c <= cap; c++) {
      dp[i][c] = dp[i - 1][c];
      if (items[i - 1].w <= c) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - items[i - 1].w] + items[i - 1].v);
    }
    var taken = [], c2 = cap, used = 0;
    for (i = n; i >= 1; i--) if (dp[i][c2] !== dp[i - 1][c2]) { taken.push(items[i - 1].id); c2 -= items[i - 1].w; used += items[i - 1].w; }
    return { taken: taken.reverse(), value: dp[n][cap], used: used };
  }
  function parseItems(text) {
    var tokens = String(text || '').split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean), pairs = [];
    if (tokens.length < 2) return { items: [], error: 'Enter at least 2 items as weight:value, like 10:60, 20:100.' };
    if (tokens.length > 5) return { items: [], error: 'Use at most 5 items so the bags stay readable.' };
    for (var i = 0; i < tokens.length; i++) {
      var m = /^(\d+)\s*[:/]\s*(\d+)$/.exec(tokens[i]);
      if (!m) return { items: [], error: '“' + tokens[i] + '” should look like 10:60 (weight:value).' };
      var w = +m[1], v = +m[2];
      if (w < 1 || w > 60 || v < 1 || v > 300) return { items: [], error: 'Keep weights between 1 and 60 and values between 1 and 300.' };
      pairs.push([w, v]);
    }
    return { items: makeItems(pairs), error: null };
  }
  function knapTrace(items, cap) {
    var ord = ratioOrder(items), steps = [];
    var fr = { blocks: [], used: 0, value: 0 }, gr = { blocks: [], used: 0, value: 0 };
    var st = { frac: {}, g01: {} };
    ord.forEach(function (it) { st.frac[it.id] = 'pending'; st.g01[it.id] = 'pending'; });
    var opt = optimalKnap01(items, cap), byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    function r2(x) { return Math.round(x * 100) / 100; }
    function colState(c, status, focus) { return { blocks: c.blocks.map(function (b) { return { id: b.id, w: r2(b.w), frac: b.frac, value: r2(b.value) }; }), used: r2(c.used), value: r2(c.value), status: copy(status), focus: focus || null }; }
    function push(kind, caption, o) {
      o = o || {};
      steps.push({
        kind: kind, caption: caption, cap: cap, items: items.map(function (i) { return { id: i.id, w: i.w, v: i.v }; }),
        order: ord.map(function (i) { return i.id; }),
        showRatio: kind !== 'init',
        frac: colState(fr, st.frac, o.focus), g01: colState(gr, st.g01, o.focus),
        best: o.best ? { ids: opt.taken.slice(), value: opt.value, used: opt.used } : null,
        counters: { fractional: r2(fr.value), greedy01: r2(gr.value), best01: o.best ? opt.value : 0 }
      });
    }
    push('init', 'A bag holds <b>' + cap + '</b> kg. Each item has a weight and a value. Greedy idea: take items with the best <b>value per kg</b> first. We run it two ways side by side: items you may <b>pour</b> (fractional) and items you must take <b>whole</b> (0/1).');
    push('sort', 'Ratios (value ÷ weight) appear on each item: ' + ord.map(function (i) { return i.id + ' = ' + r2(i.v / i.w); }).join(', ') + '. Best ratio goes first in both bags.', { });
    var remF = cap, remG = cap;
    ord.forEach(function (it) {
      var cap1, cap2;
      if (remF <= 0) { st.frac[it.id] = 'skip'; cap1 = 'Fractional bag is full already.'; }
      else if (it.w <= remF) { fr.blocks.push({ id: it.id, w: it.w, frac: 1, value: it.v }); fr.used += it.w; fr.value += it.v; remF -= it.w; st.frac[it.id] = 'take'; cap1 = 'Fractional: all ' + it.w + ' kg fit, take it whole (+' + it.v + ').'; }
      else { var f = remF / it.w; fr.blocks.push({ id: it.id, w: remF, frac: f, value: it.v * f }); fr.used += remF; fr.value += it.v * f; cap1 = 'Fractional: only ' + remF + ' kg of room left, so <b>pour in ' + remF + ' of ' + it.w + ' kg</b> (' + r2(f * 100) + '%) and gain ' + r2(it.v * f) + '. The bag is full.'; remF = 0; st.frac[it.id] = 'part'; }
      if (it.w <= remG) { gr.blocks.push({ id: it.id, w: it.w, frac: 1, value: it.v }); gr.used += it.w; gr.value += it.v; remG -= it.w; st.g01[it.id] = 'take'; cap2 = '0/1: it fits, take it whole.'; }
      else { st.g01[it.id] = 'skip'; cap2 = '0/1: ' + it.w + ' kg does not fit in ' + remG + ' kg of room, and you cannot cut it, so it is <b>skipped</b>' + (remG > 0 ? ' and ' + remG + ' kg stay empty' : '') + '.'; }
      push('item', '<b>Item ' + it.id + '</b> (' + it.w + ' kg, value ' + it.v + '). ' + cap1 + ' ' + cap2, { focus: it.id });
    });
    var frac = r2(fr.value), g01 = r2(gr.value);
    if (opt.value > gr.value) push('best', '<b>0/1 greedy got ' + g01 + ', but the best whole-item choice is ' + opt.value + '</b> (' + opt.taken.join(' + ') + ', found with dynamic programming). Wasted room cannot be refilled with a slice. Fractional greedy reached ' + frac + ' and is provably the best for pouring.', { best: true });
    else push('best', '<b>0/1 greedy got ' + g01 + ', the same as the best whole-item choice (' + opt.value + ')</b> on this input, but that is luck: with items that fit awkwardly it loses. Fractional greedy reached ' + frac + ', which is always optimal for pouring.', { best: true });
    return steps;
  }

  /* ================================================================== Huffman */
  function showCh(c) { return c === ' ' ? '␣' : c; }
  function freqTable(text) {
    var map = {}, seq = [];
    for (var i = 0; i < text.length; i++) { var c = text[i]; if (!(c in map)) { map[c] = 0; seq.push(c); } map[c]++; }
    return seq.map(function (c) { return { ch: c, f: map[c] }; })
      .sort(function (a, b) { return a.f - b.f || (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : 0); });
  }
  function parseText(text) {
    var t = String(text || '');
    if (!t.length) return { text: '', error: 'Type some text to compress.' };
    if (t.length > 80) return { text: '', error: 'Use at most 80 characters so every step stays readable.' };
    var distinct = {}; t.split('').forEach(function (c) { distinct[c] = 1; });
    var k = Object.keys(distinct).length;
    if (k > 12) return { text: '', error: 'Use at most 12 different characters (you used ' + k + ') so the tree fits on screen.' };
    return { text: t, error: null };
  }
  function buildHuffman(freq) {
    var seq = 0, nodes = {}, queue = [];
    freq.forEach(function (x, i) { var n = { id: 'l' + i, w: x.f, ch: x.ch, left: null, right: null, seq: seq++ }; nodes[n.id] = n; queue.push(n); });
    var merges = [], m = 0;
    while (queue.length > 1) {
      var a = queue.shift(), b = queue.shift();
      var p = { id: 'm' + (++m), w: a.w + b.w, ch: null, left: a.id, right: b.id, seq: seq++ };
      nodes[p.id] = p;
      var idx = queue.length;
      for (var i = 0; i < queue.length; i++) if (queue[i].w > p.w) { idx = i; break; }
      queue.splice(idx, 0, p);
      merges.push({ a: a.id, b: b.id, p: p.id, queueAfter: queue.map(function (q) { return q.id; }) });
    }
    return { nodes: nodes, root: queue[0].id, merges: merges };
  }
  function codesFrom(nodes, rootId) {
    var codes = {};
    (function walk(id, prefix) {
      var n = nodes[id];
      if (n.left === null) { codes[n.ch] = prefix || '0'; return; }
      walk(n.left, prefix + '0'); walk(n.right, prefix + '1');
    }(rootId, ''));
    return codes;
  }
  function huffmanCodes(text) {
    var freq = freqTable(text), H = buildHuffman(freq);
    return codesFrom(H.nodes, H.root);
  }
  function huffmanCost(text) {
    var codes = huffmanCodes(text), bits = 0;
    for (var i = 0; i < text.length; i++) bits += codes[text[i]].length;
    return bits;
  }
  function entropy(text) {
    var f = freqTable(text), n = text.length, h = 0;
    f.forEach(function (x) { var p = x.f / n; h -= p * Math.log2(p); });
    return h;
  }
  function bitsPerChar(text) {
    var k = freqTable(text).length, n = text.length;
    var fixed = Math.max(1, Math.ceil(Math.log2(k)));
    return { n: n, k: k, ascii: 8, fixed: fixed, huffman: huffmanCost(text) / n, entropy: entropy(text) };
  }
  function huffmanTrace(text) {
    var freq = freqTable(text), n = text.length, k = freq.length;
    var H = buildHuffman(freq), nodes = H.nodes;
    var codes = codesFrom(nodes, H.root);
    var fixed = Math.max(1, Math.ceil(Math.log2(k)));
    var huff = 0; for (var i = 0; i < n; i++) huff += codes[text[i]].length;
    var steps = [];
    var present = [], queue = freq.map(function (_, i) { return 'l' + i; });
    var state = {}, edgeStates = {}, shown = {}, activeCode = null, bits = false, merges = 0, enc = null;
    queue.forEach(function (id) { present.push(id); state[id] = 'frontier'; });
    function qVars() { return queue.map(function (id) { var nd = nodes[id]; return (nd.ch !== null ? showCh(nd.ch) : '∑') + ':' + nd.w; }); }
    function push(kind, caption, line, extra) {
      extra = extra || {};
      steps.push({
        kind: kind, caption: caption, line: line,
        vars: extra.vars || { queue: qVars() },
        counters: { merges: merges, trees: queue.length },
        hf: {
          nodes: present.map(function (id) { var nd = nodes[id]; return { id: id, w: nd.w, ch: nd.ch, left: nd.left, right: nd.right, state: state[id] || 'default' }; }),
          queue: queue.slice(), bits: bits, edgeStates: copy(edgeStates),
          codes: copy(shown), activeCode: activeCode, enc: enc, text: text,
          freq: freq.map(function (x, j) { return { id: 'l' + j, ch: x.ch, f: x.f }; }),
          pair: extra.pair || null
        }
      });
    }
    push('init', '<b>' + plural(n, 'character') + '</b>, <b>' + plural(k, 'different symbol') + '</b>. The table counts each symbol; each one starts as a one-node tree, sorted by count in a priority queue (smallest first).', 'init');
    if (k === 1) {
      queue.forEach(function (id) { state[id] = 'active'; });
      push('single', 'Only one symbol, so there is nothing to merge. It still needs <b>one bit</b> per character, so its code is <b>0</b>.', 'assign');
      bits = true; state.l0 = 'found'; shown[freq[0].ch] = '0'; activeCode = freq[0].ch;
      push('code', 'Code for <b>' + showCh(freq[0].ch) + '</b>: <b>0</b> (a single symbol still needs a bit).', 'leaf');
      enc = { huff: huff, fixed: fixed, ascii: 8 * n, n: n, k: k };
      activeCode = null;
      push('encode', '<b>' + huff + ' bits</b> against ' + 8 * n + ' bits of plain 8-bit text. With one symbol the information content is zero, but a decoder still has to count characters.', 'ret');
      return steps;
    }
    H.merges.forEach(function (mg) {
      var a = nodes[mg.a], b = nodes[mg.b];
      state[mg.a] = 'active'; state[mg.b] = 'active';
      push('pick', 'Take the <b>two smallest</b> trees off the queue: <b>' + (a.ch !== null ? showCh(a.ch) : '∑') + ' (' + a.w + ')</b> and <b>' + (b.ch !== null ? showCh(b.ch) : '∑') + ' (' + b.w + ')</b>. The rarest things should end up deepest, where codes are longest.', 'pick', { pair: [mg.a, mg.b] });
      merges++;
      queue = mg.queueAfter.slice();
      present.push(mg.p);
      state[mg.a] = 'default'; state[mg.b] = 'default';
      state[mg.p] = 'frontier';
      var pp = nodes[mg.p];
      push('merge', 'Join them under a new node of weight <b>' + a.w + ' + ' + b.w + ' = ' + pp.w + '</b> and put it back in the queue' + (queue.length === 1 ? '. One tree is left: the code tree is finished.' : ' (it slots in by weight; equal weights go behind older trees).'), 'merge');
    });
    state[H.root] = 'active';
    bits = true;
    push('label', 'Label every left branch <b>0</b> and every right branch <b>1</b>. A symbol’s code is the sequence of labels from the root down to it. Nothing is a prefix of another code, because symbols only live at leaves.', 'assign');
    var leaves = freq.map(function (x, j) { return { id: 'l' + j, ch: x.ch }; }).sort(function (a, b) { return nodes[b.id].w - nodes[a.id].w || a.id.localeCompare(b.id); });
    leaves.forEach(function (lf) {
      // path root -> leaf
      var path = [];
      (function find(id, acc) {
        var nd = nodes[id];
        if (id === lf.id) { path = acc.slice(); return true; }
        if (nd.left === null) return false;
        acc.push(nd.left); if (find(nd.left, acc)) return true; acc.pop();
        acc.push(nd.right); if (find(nd.right, acc)) return true; acc.pop();
        return false;
      }(H.root, []));
      edgeStates = {};
      path.forEach(function (id) { edgeStates[id] = 'path'; });
      shown[lf.ch] = codes[lf.ch]; activeCode = lf.ch;
      state[lf.id] = 'found';
      push('code', 'Walk from the root to <b>' + showCh(lf.ch) + '</b>: <b>' + codes[lf.ch] + '</b> (' + codes[lf.ch].length + ' bit' + (codes[lf.ch].length === 1 ? '' : 's') + ', used ' + nodes[lf.id].w + '×' + (nodes[lf.id].w === 1 ? '' : ' in the text') + ').', 'leaf');
      state[lf.id] = 'done';
    });
    edgeStates = {}; activeCode = null; state[H.root] = 'default';
    enc = { huff: huff, fixed: fixed, ascii: 8 * n, n: n, k: k };
    push('encode', 'Replace every character by its code: <b>' + huff + ' bits</b> in total, against <b>' + fixed * n + '</b> for the shortest fixed-width code (' + fixed + ' bits each) and <b>' + 8 * n + '</b> for plain 8-bit text. Frequent symbols got short codes, rare ones long.', 'ret');
    return steps;
  }

  /* ================================================================== job scheduling with deadlines */
  function parseJobs(text) {
    var tokens = String(text || '').split(/[,;\n]+/).map(function (t) { return t.trim(); }).filter(Boolean), jobs = [];
    if (tokens.length < 2) return { jobs: [], error: 'Enter at least 2 jobs as deadline:profit, like 2:100, 1:19.' };
    if (tokens.length > 8) return { jobs: [], error: 'Use at most 8 jobs.' };
    for (var i = 0; i < tokens.length; i++) {
      var m = /^(\d+)\s*[:/]\s*(\d+)$/.exec(tokens[i]);
      if (!m) return { jobs: [], error: '“' + tokens[i] + '” should look like 2:100 (deadline:profit).' };
      var d = +m[1], p = +m[2];
      if (d < 1 || d > 6 || p < 1 || p > 999) return { jobs: [], error: 'Deadlines are 1 to 6; profits 1 to 999.' };
      jobs.push({ id: LETTERS[i], d: d, p: p });
    }
    return { jobs: jobs, error: null };
  }
  function jobTrace(jobs) {
    var T = 0; jobs.forEach(function (j) { T = Math.max(T, j.d); });
    var ord = jobs.map(function (j, i) { return { j: j, i: i }; }).sort(function (a, b) { return b.j.p - a.j.p || a.i - b.i; }).map(function (x) { return x.j; });
    var slots = []; for (var i = 0; i < T; i++) slots.push(null);
    var states = {}; jobs.forEach(function (j) { states[j.id] = 'default'; });
    var profit = 0, steps = [];
    function push(kind, caption, cur, slot) {
      steps.push({ kind: kind, caption: caption, jobs: jobs.map(function (j) { return { id: j.id, d: j.d, p: j.p }; }), order: ord.map(function (j) { return j.id; }),
        slots: slots.slice(), states: copy(states), cur: cur || null, slot: slot === undefined ? null : slot, T: T, counters: { profit: profit, placed: slots.filter(Boolean).length } });
    }
    push('init', '<b>' + plural(jobs.length, 'job') + '</b>, one machine, one job per hour. Each job has a deadline (finish by hour d) and a profit. Greedy considers jobs from the <b>highest profit</b> down.');
    ord.forEach(function (j) {
      states[j.id] = 'active';
      push('look', 'Job <b>' + j.id + '</b> pays ' + j.p + ' and must be done by hour ' + j.d + '. Look for the <b>latest free hour</b> at or before ' + j.d + ': that leaves earlier hours open for jobs with tighter deadlines.', j.id);
      var s = -1;
      for (var t = Math.min(j.d, T) - 1; t >= 0; t--) if (slots[t] === null) { s = t; break; }
      if (s >= 0) { slots[s] = j.id; profit += j.p; states[j.id] = 'done'; push('place', 'Hour ' + (s + 1) + ' is free: put <b>' + j.id + '</b> there. Profit so far ' + profit + '.', j.id, s); }
      else { states[j.id] = 'muted'; push('reject', 'Every hour up to ' + j.d + ' is taken by a job that pays at least as much, so <b>' + j.id + '</b> is dropped.', j.id); }
    });
    push('end', 'Total profit <b>' + profit + '</b> with ' + plural(slots.filter(Boolean).length, 'job') + '. Picking by profit is safe here because the feasible sets form a matroid: swapping in a better job never breaks feasibility.');
    return steps;
  }

  /* ================================================================== analogy: hill climbing */
  var TERRAINS = {
    one: [2, 3, 4, 6, 8, 10, 12, 14, 15, 16, 17, 17, 16, 14, 12, 10, 8, 7, 5, 4, 3, 2, 2, 1, 1],
    two: [2, 4, 6, 9, 11, 12, 12, 11, 9, 7, 5, 3, 3, 5, 8, 12, 15, 17, 18, 17, 14, 10, 7, 4, 2]
  };
  function hillTrace(heights, start) {
    var n = heights.length, pos = Math.max(0, Math.min(n - 1, start)), steps = [], path = [pos];
    var globalMax = Math.max.apply(null, heights);
    function push(kind, caption) { steps.push({ kind: kind, caption: caption, pos: pos, path: path.slice(), heights: heights, left: pos > 0 ? pos - 1 : null, right: pos < n - 1 ? pos + 1 : null, height: heights[pos], counters: { steps: path.length - 1, height: heights[pos] } }); }
    push('init', 'You stand at height <b>' + heights[pos] + '</b> in thick fog and can only see your two neighbours. Greedy rule: always step to the <b>higher</b> neighbour; stop when neither is higher.');
    for (var guard = 0; guard < 200; guard++) {
      var l = pos > 0 ? heights[pos - 1] : -Infinity, r = pos < n - 1 ? heights[pos + 1] : -Infinity, cur = heights[pos];
      if (Math.max(l, r) <= cur) break;
      var to = r > l ? pos + 1 : pos - 1;
      var msg = 'Neighbours are ' + (l === -Infinity ? 'a cliff' : l) + ' and ' + (r === -Infinity ? 'a cliff' : r) + '; step ' + (to > pos ? 'right' : 'left') + ' to height <b>' + heights[to] + '</b>.';
      pos = to; path.push(pos);
      push('move', msg);
    }
    var isTop = heights[pos] === globalMax;
    push('stop', isTop ? '<b>No neighbour is higher: you are on the summit</b> (height ' + heights[pos] + '). Here every local peak is the global one, so greedy is safe.' : '<b>Stuck at height ' + heights[pos] + '.</b> Both neighbours are lower, so greedy stops, but a taller peak (' + globalMax + ') exists across the valley. A local best is not the global best.');
    steps[steps.length - 1].summit = isTop;
    return steps;
  }

  /* ================================================================== cost */
  function growth(n) { return { subsets: Math.pow(2, n), greedy: n * Math.log2(Math.max(2, n)) }; }

  return {
    T_MAX: T_MAX, LETTERS: LETTERS, STRATEGIES: STRATEGIES, STRAT_IDS: STRAT_IDS,
    makeIntervals: makeIntervals, overlaps: overlaps, conflictCount: conflictCount, keyOf: keyOf, order: order, pick: pick, optimalPick: optimalPick,
    scoreboard: scoreboard, randomIntervals: randomIntervals, findCounterexample: findCounterexample, parseIntervals: parseIntervals,
    intervalsToText: intervalsToText, intervalTrace: intervalTrace, optimalSets: optimalSets, exchangeTrace: exchangeTrace, validSchedule: validSchedule,
    greedyCoins: greedyCoins, optimalCoins: optimalCoins, firstCoinFailure: firstCoinFailure, parseCoins: parseCoins, coinTrace: coinTrace,
    makeItems: makeItems, ratioOrder: ratioOrder, fractionalKnap: fractionalKnap, greedyKnap01: greedyKnap01, optimalKnap01: optimalKnap01,
    parseItems: parseItems, knapTrace: knapTrace,
    showCh: showCh, freqTable: freqTable, parseText: parseText, huffmanCodes: huffmanCodes, huffmanCost: huffmanCost, entropy: entropy,
    bitsPerChar: bitsPerChar, huffmanTrace: huffmanTrace, buildHuffman: buildHuffman,
    parseJobs: parseJobs, jobTrace: jobTrace, TERRAINS: TERRAINS, hillTrace: hillTrace, growth: growth
  };
}));
