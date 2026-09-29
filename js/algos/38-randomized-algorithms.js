/* Randomized algorithms: pure generators and models for lesson 38. No DOM. UMD: attaches to VDSA.algos.randomized in
   the browser, module.exports in Node. Every random draw goes through one `rnd` function (VDSA.rng(seed) or a seed number),
   so a seed reproduces a run exactly.

   Monte Carlo pi
     piThrower(seed)                  -> {throwDarts(n) -> [{x, y, inside}], total, inside, estimate()}
     piDarts(n, seed)                 -> {darts, inside, estimate}
     piSeries(darts, count)           -> [[k, estimate]] at ~count log-spaced dart counts
     piStd(n)                         -> standard deviation of the estimate after n darts  (4 sqrt(p(1-p)/n), p = pi/4)
     piMeanError(n, trials, seed)     -> mean |estimate - pi| over independent runs
     piSteps(total, seed, opts)       -> steps {k, darts: [{x, y, inside}], estimate}   (hero teaser)

   Shuffles
     shuffleNaive(a, rnd) / fisherYates(a, rnd)             -> new shuffled array
     shuffleSteps(kind, values, seed)  kind 'naive' | 'fisher-yates'  -> steps (array-view snapshots)
     shuffleMatrix(kind, n, runs, seed)-> {counts[item][position], probs, runs, bias}
     naiveExact(n)                     -> exact probability matrix [item][position] of the naive shuffle (no sampling)
     matrixBias(probs)                 -> max |p - 1/n|

   Reservoir sampling (Algorithm R)
     reservoirSteps(stream, k, seed)   -> steps;  reservoirReference(stream, k, rnd) -> the final reservoir
     reservoirInclusion(n, k, runs, seed) -> counts[item] over many runs

   Skip lists
     skipInsert(list, key, rnd)        -> {list, height, flips, added}      pure model, list = {keys: [{key, h}]}
     skipBuild(keys, seed, maxH)       -> list
     skipSearchSteps(list, key)        -> {steps, found, cost}             cost = {compares, hops, drops, plain}
     skipInsertSteps(list, key, rnd, maxH) -> {steps, list}
     skipCost(list, key)               -> {compares, hops, drops, plain, found}   (no steps)
     skipAverageCost(n, trials, seed)  -> {skip, plain, height}  mean comparisons per search, mean tower height (max)
     skipExpectedHeight(n)             -> exact expected tallest tower for n keys (uncapped, fair coins)

   Bloom filters
     bloomIndexes(word, m, k)          -> k bit positions (double hashing on two 32-bit hashes)
     bloomStart(m, k) ; bloomOpSteps(state, op, word) -> {steps, state}     op 'add' | 'check'
     bloomFpRate(m, k, n)              -> (1 - e^(-kn/m))^k
     bloomEmpiricalFp(m, k, n, queries, seed) -> measured false-positive rate with the real hash
     bloomBestK(m, n)                  -> (m / n) ln 2

   Quicksort against an adversary (uses js/algos/16-quick-sort.js)
     quickComparisons(values, pivot, seed)       -> comparisons
     adversaryInput(n, pivot, seed, iterations)  -> permutation of 1..n that hill-climbs toward the worst case for a fixed pivot rule
     quickInputs(kind, n, seed)                  -> 'sorted' | 'reversed' | 'random' | 'equal'

   CODE.<name> = {pseudo, js, py} with // @labels matching step.line. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.randomized = api;
  }
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  function mulberry(seed) {
    var s = (seed === undefined ? 1 : seed) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngOf(x) { return typeof x === 'function' ? x : mulberry(x); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plural(n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }
  function seqTo(n) { var o = []; for (var i = 0; i < n; i++) o.push(i); return o; }

  /* ------------------------------------------------------------------ Monte Carlo pi */
  function piThrower(seed) {
    var rnd = rngOf(seed), total = 0, inside = 0;
    return {
      throwDarts: function (n) {
        var out = [];
        for (var i = 0; i < n; i++) {
          var x = rnd(), y = rnd(), ins = x * x + y * y <= 1;
          total++; if (ins) inside++;
          out.push({ x: x, y: y, inside: ins });
        }
        return out;
      },
      get total() { return total; },
      get inside() { return inside; },
      estimate: function () { return total ? 4 * inside / total : 0; }
    };
  }
  function piDarts(n, seed) {
    var t = piThrower(seed), darts = t.throwDarts(n);
    return { darts: darts, inside: t.inside, estimate: t.estimate() };
  }
  function piSeries(darts, count) {
    var n = darts.length, out = [], inside = 0, want = {}, k;
    count = count || 60;
    for (var i = 0; i < count; i++) want[Math.max(1, Math.round(Math.pow(n, i / (count - 1))))] = true;
    for (k = 1; k <= n; k++) {
      if (darts[k - 1].inside) inside++;
      if (want[k]) out.push([k, 4 * inside / k]);
    }
    return out;
  }
  var PI_P = Math.PI / 4;
  function piStd(n) { return 4 * Math.sqrt(PI_P * (1 - PI_P) / n); }
  function piMeanError(n, trials, seed) {
    var rnd = rngOf(seed), sum = 0;
    for (var t = 0; t < trials; t++) {
      var inside = 0;
      for (var i = 0; i < n; i++) { var x = rnd(), y = rnd(); if (x * x + y * y <= 1) inside++; }
      sum += Math.abs(4 * inside / n - Math.PI);
    }
    return sum / trials;
  }
  /* Growing batches (roughly geometric) up to `total` darts, one step per batch. */
  function piSteps(total, seed, opts) {
    opts = opts || {};
    var th = piThrower(seed), all = [], nb = opts.batches || 36, prev = 0;
    var steps = [{ k: 0, darts: [], newDarts: 0, estimate: 0, inside: 0 }];
    for (var i = 0; i < nb; i++) {
      var target = Math.min(total, Math.max(prev + 1, Math.round(Math.pow(total, (i + 1) / nb))));
      if (target <= prev) continue;
      var got = th.throwDarts(target - prev);
      all = all.concat(got); prev = target;
      steps.push({ k: prev, darts: all.slice(), newDarts: got.length, estimate: th.estimate(), inside: th.inside });
    }
    return steps;
  }

  /* ------------------------------------------------------------------ shuffles */
  function shuffleNaive(a, rnd) {
    var out = a.slice(), n = out.length;
    for (var i = 0; i < n; i++) {
      var j = Math.floor(rnd() * n), t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function fisherYates(a, rnd) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function shuffleSteps(kind, values, seed) {
    var rnd = rngOf(seed), n = values.length, fy = kind === 'fisher-yates';
    var ids = seqTo(n).map(function (k) { return 'x' + k; });
    var order = ids.slice();                       // order[slot] = id
    var val = {}; ids.forEach(function (id, k) { val[id] = values[k]; });
    var steps = [], swaps = 0, draws = 0;
    var finalFrom = n;                             // slots >= finalFrom are proven final (Fisher-Yates only)

    function snap(kind2, i, j, extra) {
      extra = extra || {};
      var marks = extra.marks || {};
      var items = order.map(function (id, slot) {
        var st = marks[slot] || (fy && slot >= finalFrom ? 'done' : 'default');
        return { id: id, value: val[id], state: st };
      });
      var pointers = [];
      if (i !== null && i !== undefined) pointers.push({ name: 'i', index: i, state: 'active' });
      if (j !== null && j !== undefined) pointers.push({ name: 'j', index: j, state: 'compare', side: 'above' });
      var regions = [];
      if (extra.region) regions.push(extra.region);
      var arr = order.map(function (id) { return val[id]; });
      return {
        kind: kind2, algo: kind, i: i === undefined ? null : i, j: j === undefined ? null : j,
        items: items, pointers: pointers, regions: regions, order: order.slice(),
        caption: extra.caption, line: extra.line === undefined ? null : extra.line,
        vars: { i: i === undefined || i === null ? null : i, j: j === undefined || j === null ? null : j, a: arr },
        varStates: { i: 'active', j: 'compare' },
        counters: { draws: draws, swaps: swaps }
      };
    }
    steps.push(snap('start', null, null, {
      caption: fy ? 'Start with ' + plural(n, 'item') + ' in order. Fisher–Yates fixes the <b>last</b> slot first, then the one before it, and so on.'
        : 'Start with ' + plural(n, 'item') + ' in order. The naive shuffle visits every slot once, left to right.'
    }));
    if (n === 0) { steps[0].caption = 'Nothing to shuffle.'; return steps; }
    var lo = fy ? n - 1 : 0, hi = fy ? 1 : n - 1;
    function each(cb) { if (fy) { for (var i = n - 1; i >= 1; i--) cb(i); } else { for (var q = 0; q < n; q++) cb(q); } }
    each(function (i) {
      var pool = fy ? i + 1 : n;
      var region = fy ? { from: 0, to: i, state: 'active', label: 'j is drawn from here (' + pool + ')' }
        : { from: 0, to: n - 1, state: 'active', label: 'j is drawn from anywhere (' + pool + ')' };
      steps.push(snap('pick', i, null, {
        line: 'loop', region: region,
        caption: fy ? 'Slot <b>' + i + '</b> is next. Only slots 0 to ' + i + ' are still up for grabs; everything to the right is already final.'
          : 'Slot <b>' + i + '</b> is next. The naive shuffle will swap it with a slot chosen from <em>all</em> ' + n + '.'
      }));
      var j = Math.floor(rnd() * pool); draws++;
      steps.push(snap('draw', i, j, {
        line: 'draw', region: region, marks: (function () { var m = {}; m[i] = 'compare'; m[j] = 'compare'; return m; }()),
        caption: 'Random draw: <b>j = ' + j + '</b>, one of ' + pool + ' equally likely slots' + (j === i ? '. It picked its own slot, so nothing will move (that is allowed, and needed for fairness).' : '.')
      }));
      var a = order[i], b = order[j];
      order[i] = b; order[j] = a;
      if (j !== i) swaps++;
      if (fy) finalFrom = i;
      var mk = {}; if (j !== i) { mk[i] = 'swap'; mk[j] = 'swap'; }
      steps.push(snap('swap', i, j, {
        line: 'swap', region: fy ? null : region, marks: mk,
        caption: (j === i ? 'Swapping a slot with itself changes nothing.' : 'Swap slots <b>' + i + '</b> and <b>' + j + '</b>.') +
          (fy ? ' Slot ' + i + ' is now <b>final</b>: later draws can never reach it.' : ' Later draws can still reach slot ' + i + ' and move this item again.')
      }));
    });
    if (fy) finalFrom = 0;
    steps.push(snap('done', null, null, {
      caption: fy ? 'Every slot is fixed. All ' + n + '! orders were equally likely: slot i was drawn from exactly the items not yet placed.'
        : 'Done. It looks shuffled, but the ' + n + '<sup>' + n + '</sup> equally likely sequences of draws cannot split evenly among the ' + n + '! orders, so some orders are more likely than others.'
    }));
    return steps;
  }
  function shuffleMatrix(kind, n, runs, seed) {
    var rnd = rngOf(seed), fn = kind === 'fisher-yates' ? fisherYates : shuffleNaive;
    var counts = [], base = seqTo(n), r, i;
    for (i = 0; i < n; i++) counts.push(new Array(n).fill(0));
    for (r = 0; r < runs; r++) {
      var p = fn(base, rnd);
      for (i = 0; i < n; i++) counts[p[i]][i]++;       // item p[i] landed in position i
    }
    var probs = counts.map(function (row) { return row.map(function (c) { return c / runs; }); });
    return { counts: counts, probs: probs, runs: runs, bias: matrixBias(probs) };
  }
  function naiveExact(n) {
    var P = [], x, p, i, j;
    for (x = 0; x < n; x++) { P.push(new Array(n).fill(0)); P[x][x] = 1; }
    for (i = 0; i < n; i++) {
      for (x = 0; x < n; x++) {
        var row = P[x], nr = new Array(n).fill(0);
        for (p = 0; p < n; p++) {
          if (p === i) nr[p] = 1 / n;                                // slot i receives the item at a uniform j
          else nr[p] = row[p] * (1 - 1 / n) + row[i] / n;            // stays put, or item at i lands in slot p (j = p)
        }
        P[x] = nr;
      }
    }
    return P;
  }
  function matrixBias(P) {
    var n = P.length, worst = 0;
    for (var x = 0; x < n; x++) for (var p = 0; p < n; p++) worst = Math.max(worst, Math.abs(P[x][p] - 1 / n));
    return worst;
  }

  /* ------------------------------------------------------------------ reservoir sampling (Algorithm R) */
  function reservoirReference(stream, k, rnd) {
    var R = [], i = 0;
    for (var t = 0; t < stream.length; t++) {
      i++;
      if (i <= k) R.push(stream[t]);
      else {
        var j = 1 + Math.floor(rnd() * i);
        if (j <= k) R[j - 1] = stream[t];
      }
    }
    return R;
  }
  function reservoirSteps(stream, k, seed) {
    var rnd = rngOf(seed), n = stream.length;
    var items = stream.map(function (label, t) { return { id: 's' + t, label: String(label) }; });
    var slots = new Array(k).fill(null);                    // ids
    var seen = 0, kept = 0, replaced = 0, dropped = 0;
    var status = {};                                        // id -> 'kept' | 'dropped' | 'evicted'
    var steps = [];

    function snap(kind, cur, extra) {
      extra = extra || {};
      var st = {};
      items.forEach(function (it, t) {
        var s = 'upcoming';
        if (t < seen) s = status[it.id] || 'dropped';
        if (cur !== null && cur !== undefined && t === cur) s = extra.tokenState || 'current';
        st[it.id] = s;
      });
      return {
        kind: kind, stream: items, tokenStates: st, seen: seen, cur: cur === undefined ? null : cur,
        reservoir: slots.slice(), k: k, roll: extra.roll || null, hot: extra.hot === undefined ? null : extra.hot,
        caption: extra.caption, line: extra.line === undefined ? null : extra.line, flow: extra.flow || null,
        vars: { i: seen, item: cur === null || cur === undefined ? null : items[cur].label, k: k, 'P(keep)': seen ? (seen <= k ? '1' : k + '/' + seen) : null, j: extra.roll ? extra.roll.j : null, R: slots.map(function (id) { return id === null ? '·' : label(id); }) },
        varStates: { i: 'active', item: 'key', j: 'compare', 'P(keep)': 'done' },
        counters: { seen: seen, kept: kept, replaced: replaced, dropped: dropped }
      };
    }
    function label(id) { return items[+id.slice(1)].label; }

    steps.push(snap('start', null, {
      caption: 'A stream of ' + plural(n, 'item') + ' will flow past once. The reservoir has room for <b>' + k + '</b>. The goal: when the stream ends, every item had the same chance to be in the reservoir, and you never needed to know <em>n</em> in advance.',
      flow: 'start'
    }));
    for (var t = 0; t < n; t++) {
      var it = items[t], i = t + 1;
      seen = i;
      steps.push(snap('arrive', t, {
        line: 'arrive', flow: 'room',
        caption: 'Item <b>' + esc(it.label) + '</b> arrives as number <b>' + i + '</b>. You cannot look ahead and you cannot go back, so decide now.'
      }));
      if (i <= k) {
        var slot = slots.indexOf(null);
        slots[slot] = it.id; status[it.id] = 'kept'; kept++;
        steps.push(snap('fill', t, {
          line: ['room', 'fill'], flow: 'fill', tokenState: 'kept', hot: slot,
          caption: 'Only ' + i + ' of ' + k + ' places are used, so <b>' + esc(it.label) + '</b> goes straight in. Probability of keeping it so far: 1.'
        }));
      } else {
        var j = 1 + Math.floor(rnd() * i);
        var roll = { i: i, j: j, k: k };
        steps.push(snap('roll', t, {
          line: 'roll', flow: 'roll', roll: roll,
          caption: 'The reservoir is full. Roll a fair die with <b>' + i + '</b> faces: <b>j = ' + j + '</b>. Faces 1 to ' + k + ' mean “keep”, so the chance of keeping this item is <b>' + k + '/' + i + '</b>.'
        }));
        if (j <= k) {
          var old = slots[j - 1];
          status[old] = 'evicted'; slots[j - 1] = it.id; status[it.id] = 'kept'; kept++; replaced++;
          steps.push(snap('replace', t, {
            line: ['test', 'replace'], flow: 'replace', roll: roll, tokenState: 'kept', hot: j - 1,
            caption: 'j = ' + j + ' ≤ ' + k + ', so <b>' + esc(it.label) + '</b> takes slot ' + j + ' and <b>' + esc(label(old)) + '</b> is evicted. Old items are evicted just often enough to keep the odds equal.'
          }));
        } else {
          status[it.id] = 'dropped'; dropped++;
          steps.push(snap('skip', t, {
            line: ['test', 'skip'], flow: 'skip', roll: roll, tokenState: 'dropped',
            caption: 'j = ' + j + ' > ' + k + ', so <b>' + esc(it.label) + '</b> is dropped. The reservoir stays as it was.'
          }));
        }
      }
    }
    var lastSnap = snap('end', null, {
      flow: 'end',
      caption: n === 0 ? 'The stream was empty, so the reservoir is empty.' :
        'The stream ended. Each of the ' + plural(n, 'item') + ' had probability <b>' + Math.min(1, k / n).toString().slice(0, 6) + '</b> (' + Math.min(k, n) + '/' + n + ') of being in the reservoir: item <em>i</em> gets in with probability k/i and then survives every later roll.'
    });
    lastSnap.seen = n;
    lastSnap.tokenStates = {};
    items.forEach(function (it) { lastSnap.tokenStates[it.id] = status[it.id] === 'kept' ? 'kept' : (status[it.id] || 'dropped'); });
    steps.push(lastSnap);
    return steps;
  }
  function reservoirInclusion(n, k, runs, seed) {
    var rnd = rngOf(seed), counts = new Array(n).fill(0), stream = seqTo(n);
    for (var r = 0; r < runs; r++) reservoirReference(stream, k, rnd).forEach(function (x) { counts[x]++; });
    return counts;
  }

  /* ------------------------------------------------------------------ skip lists */
  var MAXH = 5;
  function flipTower(rnd, maxH) {
    var h = 1, flips = [];
    maxH = maxH || MAXH;
    while (h < maxH) {
      var heads = rnd() < 0.5;
      flips.push(heads);
      if (!heads) break;
      h++;
    }
    return { h: h, flips: flips };
  }
  function skipTop(list) { var t = 1; list.keys.forEach(function (n) { if (n.h > t) t = n.h; }); return t; }
  function skipNext(list, curKey, level) {          // first node right of curKey (null = head) that reaches `level`
    for (var i = 0; i < list.keys.length; i++) {
      var n = list.keys[i];
      if ((curKey === null || n.key > curKey) && n.h >= level) return n;
    }
    return null;
  }
  function skipInsert(list, key, rnd, maxH) {
    var exists = list.keys.some(function (n) { return n.key === key; });
    if (exists) return { list: list, added: false, height: null, flips: [] };
    var t = flipTower(rnd, maxH), keys = list.keys.concat([{ key: key, h: t.h }]).sort(function (a, b) { return a.key - b.key; });
    return { list: { keys: keys }, added: true, height: t.h, flips: t.flips };
  }
  function skipBuild(keys, seed, maxH) {
    var rnd = rngOf(seed), list = { keys: [] };
    keys.forEach(function (k) { list = skipInsert(list, k, rnd, maxH).list; });
    return list;
  }
  function plainCost(list, key) {
    var lt = 0, more = false;
    list.keys.forEach(function (n) { if (n.key < key) lt++; else more = true; });
    return lt + (more ? 1 : 0);
  }
  /* The search walk shared by search and insert. Returns the steps' raw material. */
  function skipWalk(list, key) {
    var top = skipTop(list), cur = null, level = top, walk = [], path = [{ key: null, level: top }];
    var compares = 0, hops = 0, drops = 0, update = {};
    while (level >= 1) {
      for (;;) {
        var nx = skipNext(list, cur, level);
        compares++;
        if (nx !== null && nx.key < key) {
          walk.push({ type: 'peek', cur: cur, level: level, nx: nx, go: true, compares: compares, hops: hops, drops: drops });
          cur = nx.key; hops++; path.push({ key: cur, level: level });
          walk.push({ type: 'right', cur: cur, level: level, nx: nx, compares: compares, hops: hops, drops: drops, path: path.slice() });
        } else {
          walk.push({ type: 'peek', cur: cur, level: level, nx: nx, go: false, compares: compares, hops: hops, drops: drops });
          break;
        }
      }
      update[level] = cur;
      if (level > 1) {
        drops++; level--; path.push({ key: cur, level: level });
        walk.push({ type: 'down', cur: cur, level: level, compares: compares, hops: hops, drops: drops, path: path.slice() });
      } else break;
    }
    var fin = skipNext(list, cur, 1);
    return { walk: walk, top: top, update: update, found: fin !== null && fin.key === key, final: fin, endKey: cur, path: path, cost: { compares: compares, hops: hops, drops: drops, plain: plainCost(list, key) } };
  }
  function skipCost(list, key) { var w = skipWalk(list, key); return { compares: w.cost.compares, hops: w.cost.hops, drops: w.cost.drops, plain: w.cost.plain, found: w.found }; }

  function skipSnap(list, extra) {
    extra = extra || {};
    var st = extra.states || {};
    var nodes = list.keys.map(function (n) {
      var o = { key: n.key, h: n.h, state: st[n.key] || 'default' };
      if (extra.linked && extra.linked[n.key] !== undefined) o.linked = extra.linked[n.key];
      return o;
    });
    if (extra.extra) nodes.push(extra.extra);
    nodes.sort(function (a, b) { return a.key - b.key; });
    var levels = 1;
    nodes.forEach(function (n) { if (n.h > levels) levels = n.h; });
    var c = extra.cost || { compares: 0, hops: 0, drops: 0, plain: 0 };
    return {
      kind: extra.kind, nodes: nodes, levels: levels, target: extra.target === undefined ? null : extra.target,
      cur: extra.cur || null, peek: extra.peek || null, path: extra.path || [], found: extra.found === undefined ? null : extra.found,
      flips: extra.flips || null,
      caption: extra.caption, line: extra.line === undefined ? null : extra.line,
      vars: extra.vars || {}, varStates: { x: 'active', level: 'compare', target: 'key' },
      counters: { compares: c.compares, hops: c.hops, drops: c.drops, plain: c.plain }
    };
  }
  function nm(k) { return k === null ? 'head' : String(k); }

  function walkSteps(list, key, w, opts) {
    opts = opts || {};
    var steps = [], plain = w.cost.plain, insertMode = !!opts.insert;
    var states = {};
    var base = { target: key, cost: { compares: 0, hops: 0, drops: 0, plain: plain } };
    steps.push(skipSnap(list, {
      kind: 'start', target: key, cur: { key: null, level: w.top }, path: [{ key: null, level: w.top }], cost: base.cost, line: insertMode ? 'search' : 'start',
      vars: { x: 'head', level: w.top, target: key },
      caption: (insertMode ? 'To insert <b>' + key + '</b> you first search for where it belongs' : 'Search for <b>' + key + '</b>') + '. Start at the head on the top level (' + w.top + '), where the towers are sparse and one hop covers a lot of ground.'
    }));
    w.walk.forEach(function (s) {
      var cost = { compares: s.compares, hops: s.hops, drops: s.drops, plain: plain };
      var pathNow = s.path || null;
      var st = {};
      if (s.cur !== null) st[s.cur] = 'active';
      var cur = { key: s.cur, level: s.level };
      if (s.type === 'peek') {
        var nx = s.nx;
        if (nx) st[nx.key] = 'compare';
        var cap;
        if (nx === null) cap = 'Level ' + s.level + ': nothing to the right of ' + nm(s.cur) + ' on this level. Don’t go right: <b>drop down</b>' + (s.level > 1 ? '.' : ', and this is the bottom, so the search is at its end.');
        else if (s.go) cap = 'Level ' + s.level + ': the next tower is <b>' + nx.key + '</b>, and ' + nx.key + ' &lt; ' + key + '. Still short of the target, so hop right.';
        else cap = 'Level ' + s.level + ': the next tower is <b>' + nx.key + '</b>, and ' + nx.key + ' ' + (nx.key === key ? '=' : '&ge;') + ' ' + key + '. ' + (nx.key === key ? 'The target is right there, but the search still goes to the bottom level to confirm.' : 'Hopping would overshoot') + (s.level > 1 ? ', so <b>drop down</b> a level.' : '.');
        steps.push(skipSnap(list, {
          kind: 'peek', target: key, cur: cur, peek: { key: nx ? nx.key : null, level: s.level, go: s.go }, path: s.path || lastPath(steps), states: st, cost: cost,
          line: insertMode ? 'search' : 'peek', vars: { x: nm(s.cur), level: s.level, target: key }, caption: cap
        }));
      } else if (s.type === 'right') {
        st[s.cur] = 'active';
        steps.push(skipSnap(list, {
          kind: 'right', target: key, cur: cur, path: pathNow, states: st, cost: cost, line: insertMode ? 'search' : 'right',
          vars: { x: nm(s.cur), level: s.level, target: key },
          caption: 'Hop to <b>' + s.cur + '</b>. One hop skipped every tower between here and the last stop.'
        }));
      } else {
        steps.push(skipSnap(list, {
          kind: 'down', target: key, cur: cur, path: pathNow, states: st, cost: cost, line: insertMode ? 'search' : 'down',
          vars: { x: nm(s.cur), level: s.level, target: key },
          caption: 'Drop to level <b>' + s.level + '</b>, still standing on ' + nm(s.cur) + '. The next level down has more towers, so it moves in finer steps.'
        }));
      }
    });
    return steps;
  }
  function lastPath(steps) { return steps.length ? steps[steps.length - 1].path : []; }

  function skipSearchSteps(list, key) {
    var w = skipWalk(list, key), steps = walkSteps(list, key, w, {});
    var cost = { compares: w.cost.compares, hops: w.cost.hops, drops: w.cost.drops, plain: w.cost.plain };
    var st = {};
    if (w.endKey !== null) st[w.endKey] = 'active';
    if (w.found) st[key] = 'found';
    steps.push(skipSnap(list, {
      kind: 'final', target: key, cur: { key: w.endKey, level: 1 }, peek: w.final ? { key: w.final.key, level: 1, go: false } : null, path: w.path, states: st, cost: cost, line: 'final',
      vars: { x: nm(w.endKey), level: 1, target: key },
      caption: w.final ? 'The tower after ' + nm(w.endKey) + ' on level 1 is <b>' + w.final.key + '</b>. ' + (w.found ? 'That is the target.' : w.final.key + ' is not ' + key + ', so ' + key + ' is not in the list.') :
        'There is no tower after ' + nm(w.endKey) + ' on level 1, so ' + key + ' is not in the list.'
    }));
    var kase = 'The skip list used <b>' + plural(w.cost.compares, 'comparison') + '</b> (' + plural(w.cost.hops, 'hop') + ', ' + plural(w.cost.drops, 'drop') + '); a plain linked list would have needed <b>' + w.cost.plain + '</b>.';
    steps.push(skipSnap(list, {
      kind: 'end', target: key, cur: { key: w.endKey, level: 1 }, path: w.path, states: st, cost: cost, found: w.found, line: 'ret',
      vars: { x: nm(w.endKey), level: 1, target: key, found: w.found },
      caption: (w.found ? '<b>Found ' + key + '.</b> ' : '<b>' + key + ' is not in the list.</b> ') + kase
    }));
    return { steps: steps, found: w.found, cost: cost };
  }
  function skipInsertSteps(list, key, rnd, maxH) {
    maxH = maxH || MAXH;
    var w = skipWalk(list, key), steps = walkSteps(list, key, w, { insert: true }), plain = w.cost.plain;
    var cost = { compares: w.cost.compares, hops: w.cost.hops, drops: w.cost.drops, plain: plain };
    if (w.found) {
      steps.push(skipSnap(list, {
        kind: 'end', target: key, cur: { key: w.endKey, level: 1 }, path: w.path, states: (function () { var s = {}; s[key] = 'found'; return s; }()), cost: cost, found: true, line: 'search',
        vars: { x: nm(w.endKey), level: 1, target: key },
        caption: '<b>' + key + ' is already in the list.</b> A skip list holds each key once, so nothing changes.'
      }));
      return { steps: steps, list: list, added: false };
    }
    var flips = [], h = 1, flipCost = { compares: cost.compares, hops: cost.hops, drops: cost.drops, plain: plain };
    var newNode = function (hh, state, linked) { return { key: key, h: hh, state: state, linked: linked }; };
    var stPath = {};
    steps.push(skipSnap(list, {
      kind: 'place', target: key, cur: null, path: w.path, cost: flipCost, line: 'search', extra: newNode(1, 'key', 0),
      vars: { target: key, h: 1 },
      caption: 'The search stopped between ' + nm(w.endKey) + ' and ' + (w.final ? w.final.key : 'the end') + ': that is where <b>' + key + '</b> goes on the bottom level. Now decide how tall its tower will be with coin flips.'
    }));
    while (h < maxH) {
      var heads = rnd() < 0.5;
      flips.push(heads);
      if (heads) {
        h++;
        steps.push(skipSnap(list, {
          kind: 'flip', target: key, path: w.path, cost: flipCost, line: 'flip', extra: newNode(h, 'key', 0), flips: flips.slice(),
          vars: { target: key, h: h },
          caption: 'Flip ' + flips.length + ': <b>heads</b>. The tower grows to <b>' + h + '</b> levels' + (h === maxH ? '. That is the tallest allowed (' + maxH + '), so it stops flipping.' : ', and you flip again.')
        }));
      } else {
        steps.push(skipSnap(list, {
          kind: 'flip', target: key, path: w.path, cost: flipCost, line: 'flip', extra: newNode(h, 'key', 0), flips: flips.slice(),
          vars: { target: key, h: h },
          caption: 'Flip ' + flips.length + ': <b>tails</b>. The tower stops at <b>' + h + '</b> ' + (h === 1 ? 'level' : 'levels') + '. Half of all towers stop at level 1, a quarter at level 2, an eighth at level 3.'
        }));
        break;
      }
    }
    var next = list.keys.concat([{ key: key, h: h }]).sort(function (a, b) { return a.key - b.key; });
    var newList = { keys: next };
    for (var lv = 1; lv <= h; lv++) {
      var pred = w.update[lv] === undefined ? null : w.update[lv];
      var linked = {}; linked[key] = lv;
      var extraNode = null;
      steps.push(skipSnap(newList, {
        kind: 'link', target: key, path: w.path, cost: flipCost, line: 'link', linked: linked, flips: flips.slice(),
        states: (function () { var s = {}; s[key] = 'key'; if (pred !== null) s[pred] = 'active'; return s; }()),
        cur: { key: pred, level: lv },
        vars: { target: key, h: h, level: lv },
        caption: 'Level ' + lv + ': splice <b>' + key + '</b> in after ' + nm(pred) + '. Its pointer takes over ' + nm(pred) + '’s old pointer, and ' + nm(pred) + ' now points at ' + key + '. Two pointer changes, nothing else moves.'
      }));
    }
    var endStates = {}; endStates[key] = 'done';
    steps.push(skipSnap(newList, {
      kind: 'end', target: key, path: [], cost: flipCost, line: 'link', found: true, states: endStates, flips: flips.slice(),
      vars: { target: key, h: h },
      caption: '<b>' + key + ' is in</b>, with a tower of height ' + h + '. Nothing was rebalanced: the coins alone keep the list shallow, on average.'
    }));
    return { steps: steps, list: newList, added: true, height: h, flips: flips };
  }
  function skipExpectedHeight(n) {
    var e = 0;
    for (var h = 0; h < 200; h++) {
      var p = 1 - Math.pow(1 - Math.pow(2, -h), n);
      e += p;
      if (p < 1e-12) break;
    }
    return e;
  }
  function skipAverageCost(n, trials, seed) {
    var rnd = rngOf(seed), sumSkip = 0, sumPlain = 0, sumH = 0, cnt = 0;
    for (var t = 0; t < trials; t++) {
      var keys = [], hs = [], i;
      for (i = 0; i < n; i++) { keys.push(i); hs.push(flipTower(rnd, 40).h); }
      var top = Math.max.apply(null, hs); sumH += top;
      // next pointers per level
      var nextAt = [null];
      for (var lv = 1; lv <= top; lv++) {
        var arr = new Array(n + 1).fill(-1), nx = -1;
        for (i = n - 1; i >= -1; i--) { arr[i + 1] = nx; if (i >= 0 && hs[i] >= lv) nx = i; }
        nextAt.push(arr);
      }
      for (var q = 0; q < 8; q++) {
        var target = Math.floor(rnd() * n), cur = -1, comps = 0;
        for (var level = top; level >= 1; level--) {
          for (;;) {
            var nx2 = nextAt[level][cur + 1];
            comps++;
            if (nx2 !== -1 && nx2 < target) cur = nx2; else break;
          }
        }
        sumSkip += comps; sumPlain += target + 1; cnt++;
      }
    }
    return { skip: sumSkip / cnt, plain: sumPlain / cnt, height: sumH / trials };
  }

  /* ------------------------------------------------------------------ Bloom filters */
  function hash32(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }
  function bloomIndexes(word, m, k) {
    var h1 = hash32(word, 2166136261), h2 = (hash32(word, 0x9e3779b9) | 1) >>> 0, out = [];
    for (var i = 0; i < k; i++) out.push((h1 + i * h2) % m);
    return out;
  }
  function bloomStart(m, k) { return { m: m, k: k, bits: new Array(m).fill(0), words: [], adds: 0, queries: 0, fps: 0 }; }
  function bloomFpRate(m, k, n) { return Math.pow(1 - Math.exp(-k * n / m), k); }
  function bloomBestK(m, n) { return n ? (m / n) * Math.LN2 : 1; }
  function bloomEmpiricalFp(m, k, n, queries, seed) {
    var rnd = rngOf(seed), bits = new Array(m).fill(0), i, salt = Math.floor(rnd() * 1e6);
    for (i = 0; i < n; i++) bloomIndexes('in' + salt + '-' + i, m, k).forEach(function (b) { bits[b] = 1; });
    var fp = 0;
    for (i = 0; i < queries; i++) {
      if (bloomIndexes('out' + salt + '-' + i, m, k).every(function (b) { return bits[b] === 1; })) fp++;
    }
    return fp / queries;
  }
  function bloomSnap(state, kind, extra) {
    extra = extra || {};
    var ones = state.bits.reduce(function (a, b) { return a + b; }, 0);
    var idx = extra.idx || [];
    var states = {};
    (extra.bitStates || []).forEach(function (o) { states[o.bit] = o.state; });
    var arrows = idx.map(function (b, i) {
      var shown = extra.shown === undefined ? idx.length : extra.shown;
      return { n: i + 1, bit: b, state: (extra.arrowStates && extra.arrowStates[i]) || 'compare', show: i < shown };
    });
    return {
      kind: kind, m: state.m, k: state.k, bits: state.bits.slice(), bitStates: states, word: extra.word === undefined ? null : extra.word,
      arrows: arrows, verdict: extra.verdict || null, words: state.words.slice(),
      caption: extra.caption, line: extra.line === undefined ? null : extra.line,
      vars: extra.vars || { word: extra.word === undefined ? null : extra.word, 'bits set': ones + ' / ' + state.m, 'FP rate ≈': state.words.length ? pct(bloomFpRate(state.m, state.k, state.words.length), 1) : '0%' },
      varStates: { word: 'key', 'FP rate ≈': 'error' },
      counters: { added: state.adds, checks: state.queries, falsePositives: state.fps, bitsSet: ones }
    };
  }
  function bloomIdle(state, caption) { return bloomSnap(state, 'start', { caption: caption }); }
  /* One operation on a filter, as steps. `state` is not mutated; the returned state is the filter afterwards. */
  function bloomOpSteps(state, op, word) {
    var st = { m: state.m, k: state.k, bits: state.bits.slice(), words: state.words.slice(), adds: state.adds, queries: state.queries, fps: state.fps };
    var idx = bloomIndexes(word, st.m, st.k), steps = [], w = esc(word);
    var list = idx.join(', ');
    var dups = idx.length - new Set(idx).size;
    if (op === 'add') {
      steps.push(bloomSnap(st, 'hash', {
        word: word, idx: idx, line: 'hash', bitStates: idx.map(function (b) { return { bit: b, state: 'compare' }; }),
        caption: 'Adding <b>' + w + '</b>. Each of the ' + st.k + ' hash functions turns the word into a bit position: <b>' + list + '</b>' + (dups ? ' (two of them landed on the same bit, which is allowed)' : '') + '.'
      }));
      var already = idx.filter(function (b, i) { return st.bits[b] === 1 && idx.indexOf(b) === i; }).length;
      idx.forEach(function (b) { st.bits[b] = 1; });
      if (st.words.indexOf(word) < 0) st.words.push(word);
      st.adds++;
      steps.push(bloomSnap(st, 'set', {
        word: word, idx: idx, line: 'set', bitStates: idx.map(function (b) { return { bit: b, state: 'swap' }; }),
        caption: 'Set those bits to 1. ' + (already ? already + ' of them ' + (already === 1 ? 'was' : 'were') + ' already 1 because of earlier words: that sharing is exactly what makes the filter small, and what causes false positives later.' : 'All were 0 before. Bits are never turned back to 0, so a word can never be “un-added”.')
      }));
      steps.push(bloomSnap(st, 'end', {
        word: word, idx: idx, line: null,
        caption: '<b>' + w + '</b> is in. The filter stores no words at all: only ' + st.m + ' bits, ' + st.bits.reduce(function (a, b) { return a + b; }, 0) + ' of them set.'
      }));
      return { steps: steps, state: st };
    }
    var truly = st.words.indexOf(word) >= 0;
    st.queries++;
    steps.push(bloomSnap(st, 'hash', {
      word: word, idx: idx, line: 'hashc', shown: idx.length, bitStates: idx.map(function (b) { return { bit: b, state: 'compare' }; }),
      caption: 'Is <b>' + w + '</b> in the set? Hash it the same way: bits <b>' + list + '</b>. Look at each one.'
    }));
    var zero = -1;
    for (var i = 0; i < idx.length; i++) {
      var b = idx[i], on = st.bits[b] === 1;
      var marks = idx.map(function (bb, q) { return { bit: bb, state: q < i ? 'done' : (q === i ? (on ? 'active' : 'error') : 'compare') }; });
      steps.push(bloomSnap(st, 'probe', {
        word: word, idx: idx, line: 'probe', bitStates: marks,
        caption: 'Bit <b>' + b + '</b> is <b>' + (on ? '1' : '0') + '</b>. ' + (on ? (i === idx.length - 1 ? 'That was the last one.' : 'Consistent with “present”, so check the next bit.') : 'An added word would have set this bit, and bits never clear. So <b>' + w + '</b> was never added.')
      }));
      if (!on) { zero = b; break; }
    }
    if (zero >= 0) {
      steps.push(bloomSnap(st, 'end', {
        word: word, idx: idx, line: 'no', verdict: 'no', bitStates: [{ bit: zero, state: 'error' }],
        caption: '<b>Definitely not in the set.</b> One 0 is proof. A Bloom filter never gives a false negative.'
      }));
    } else if (truly) {
      steps.push(bloomSnap(st, 'end', {
        word: word, idx: idx, line: 'maybe', verdict: 'maybe', bitStates: idx.map(function (b) { return { bit: b, state: 'done' }; }),
        caption: '<b>Maybe.</b> Every bit is 1, and this word really was added, so the “maybe” is right this time. The filter cannot tell that apart from a lucky overlap.'
      }));
    } else {
      st.fps++;
      steps.push(bloomSnap(st, 'end', {
        word: word, idx: idx, line: 'maybe', verdict: 'false-positive', bitStates: idx.map(function (b) { return { bit: b, state: 'error' }; }),
        caption: '<b>Maybe... but it is wrong.</b> ' + w + ' was never added; other words happened to set all ' + st.k + ' of its bits. This is a <b>false positive</b>.'
      }));
    }
    return { steps: steps, state: st };
  }

  /* ------------------------------------------------------------------ quicksort against an adversary */
  function quick() {
    if (typeof require === 'function' && typeof module === 'object') return require('./16-quick-sort.js');
    return root && root.VDSA && root.VDSA.algos && root.VDSA.algos.sorting;
  }
  function quickComparisons(values, pivot, seed) {
    return quick().quickCount(values, { pivot: pivot, seed: seed === undefined ? 1 : seed }).comparisons;
  }
  function quickInputs(kind, n, seed) {
    var a = seqTo(n).map(function (i) { return i + 1; });
    if (kind === 'reversed') return a.reverse();
    if (kind === 'equal') return a.map(function () { return 7; });
    if (kind === 'random') { var rnd = rngOf(seed), out = a.slice(); for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; } return out; }
    return a;
  }
  /* Hill-climb: swap two values whenever it makes the fixed rule slower. Deterministic for a seed. */
  function adversaryInput(n, pivot, seed, iterations) {
    var rnd = rngOf(seed === undefined ? 1 : seed), cur = quickInputs('random', n, rnd()), best = quickComparisons(cur, pivot, 1);
    iterations = iterations || 1500;
    for (var it = 0; it < iterations; it++) {
      var i = Math.floor(rnd() * n), j = Math.floor(rnd() * n);
      if (i === j) continue;
      var t = cur[i]; cur[i] = cur[j]; cur[j] = t;
      var c = quickComparisons(cur, pivot, 1);
      if (c > best) best = c; else { t = cur[i]; cur[i] = cur[j]; cur[j] = t; }
    }
    return cur;
  }

  /* ------------------------------------------------------------------ code (labels match step.line) */
  var CODE = {
    shuffleNaive: {
      pseudo: ['procedure naiveShuffle(a)', '  n ← length(a)', '  for i ← 0 to n − 1                 // @loop', '    j ← random integer in 0 … n − 1   // @draw', '    swap a[i] and a[j]               // @swap'].join('\n'),
      js: ['function naiveShuffle(a) {', '  const n = a.length;', '  for (let i = 0; i < n; i++) {                 // @loop', '    const j = Math.floor(Math.random() * n);    // @draw', '    [a[i], a[j]] = [a[j], a[i]];                // @swap', '  }', '}'].join('\n'),
      py: ['import random', '', 'def naive_shuffle(a):', '    n = len(a)', '    for i in range(n):                  # @loop', '        j = random.randrange(n)         # @draw', '        a[i], a[j] = a[j], a[i]         # @swap'].join('\n')
    },
    fisherYates: {
      pseudo: ['procedure fisherYates(a)', '  for i ← n − 1 down to 1            // @loop', '    j ← random integer in 0 … i       // @draw', '    swap a[i] and a[j]               // @swap'].join('\n'),
      js: ['function fisherYates(a) {', '  for (let i = a.length - 1; i >= 1; i--) {      // @loop', '    const j = Math.floor(Math.random() * (i + 1)); // @draw', '    [a[i], a[j]] = [a[j], a[i]];                 // @swap', '  }', '}'].join('\n'),
      py: ['import random', '', 'def fisher_yates(a):', '    for i in range(len(a) - 1, 0, -1):   # @loop', '        j = random.randint(0, i)         # @draw', '        a[i], a[j] = a[j], a[i]          # @swap'].join('\n')
    },
    reservoir: {
      pseudo: ['procedure reservoirSample(stream, k)', '  R ← empty list', '  for each item as it arrives, i ← 1, 2, 3 …     // @arrive', '    if i ≤ k then                                // @room', '      append item to R                           // @fill', '    else', '      j ← random integer in 1 … i                // @roll', '      if j ≤ k then                              // @test', '        R[j] ← item                              // @replace', '      // otherwise the item is dropped           // @skip', '  return R'].join('\n'),
      js: ['function reservoirSample(stream, k) {', '  const R = [];', '  let i = 0;', '  for (const item of stream) {                    // @arrive', '    i++;', '    if (i <= k) {                                 // @room', '      R.push(item);                               // @fill', '    } else {', '      const j = 1 + Math.floor(Math.random() * i); // @roll', '      if (j <= k) R[j - 1] = item;                // @test @replace', '      // otherwise the item is dropped            // @skip', '    }', '  }', '  return R;', '}'].join('\n'),
      py: ['import random', '', 'def reservoir_sample(stream, k):', '    R = []', '    for i, item in enumerate(stream, 1):          # @arrive', '        if i <= k:                                # @room', '            R.append(item)                        # @fill', '        else:', '            j = random.randint(1, i)              # @roll', '            if j <= k:                            # @test', '                R[j - 1] = item                   # @replace', '            # otherwise the item is dropped       # @skip', '    return R'].join('\n')
    },
    skipSearch: {
      pseudo: ['procedure search(list, key)', '  x ← list.head; level ← top level                    // @start', '  while level ≥ 1', '    while x.next[level] exists and x.next[level].key < key   // @peek', '      x ← x.next[level]                                // @right', '    level ← level − 1                                  // @down', '  x ← x.next[1]                                        // @final', '  return x exists and x.key = key                      // @ret'].join('\n'),
      js: ['function search(list, key) {', '  let x = list.head;                                  // @start', '  for (let level = list.top; level >= 1; level--) {', '    while (x.next[level] && x.next[level].key < key)  // @peek', '      x = x.next[level];                              // @right', '    // no more hops on this level: drop down          // @down', '  }', '  x = x.next[1];                                      // @final', '  return x !== null && x.key === key;                 // @ret', '}'].join('\n'),
      py: ['def search(lst, key):', '    x = lst.head                                      # @start', '    for level in range(lst.top, 0, -1):', '        while x.next[level] and x.next[level].key < key:   # @peek', '            x = x.next[level]                         # @right', '        # no more hops on this level: drop down       # @down', '    x = x.next[1]                                     # @final', '    return x is not None and x.key == key             # @ret'].join('\n')
    },
    skipInsert: {
      pseudo: ['procedure insert(list, key)', '  update[level] ← last node before key on every level   // @search', '  h ← 1', '  while h < maxLevel and coin flip is heads            // @flip', '    h ← h + 1', '  for level ← 1 to h                                    // @link', '    node.next[level] ← update[level].next[level]', '    update[level].next[level] ← node'].join('\n'),
      js: ['function insert(list, key) {', '  const update = findPredecessors(list, key);       // @search', '  let h = 1;', '  while (h < MAX_LEVEL && Math.random() < 0.5) h++;  // @flip', '  const node = { key, next: [] };', '  for (let level = 1; level <= h; level++) {         // @link', '    node.next[level] = update[level].next[level];', '    update[level].next[level] = node;', '  }', '}'].join('\n'),
      py: ['def insert(lst, key):', '    update = find_predecessors(lst, key)              # @search', '    h = 1', '    while h < MAX_LEVEL and random.random() < 0.5:    # @flip', '        h += 1', '    node = Node(key)', '    for level in range(1, h + 1):                     # @link', '        node.next[level] = update[level].next[level]', '        update[level].next[level] = node'].join('\n')
    },
    bloomAdd: {
      pseudo: ['procedure add(word)', '  for each hash function h₁ … h_k       // @hash', '    bits[ h_i(word) mod m ] ← 1         // @set'].join('\n'),
      js: ['function add(word) {', '  for (const h of hashes) {              // @hash', '    bits[h(word) % m] = 1;               // @set', '  }', '}'].join('\n'),
      py: ['def add(word):', '    for h in hashes:                     # @hash', '        bits[h(word) % m] = 1            # @set'].join('\n')
    },
    bloomCheck: {
      pseudo: ['procedure mightContain(word)', '  for each hash function h₁ … h_k       // @hashc', '    if bits[ h_i(word) mod m ] = 0 then // @probe', '      return “definitely not”           // @no', '  return “maybe”                        // @maybe'].join('\n'),
      js: ['function mightContain(word) {', '  for (const h of hashes) {              // @hashc', '    if (bits[h(word) % m] === 0) {       // @probe', '      return false;                      // @no', '    }', '  }', '  return true;   // only “maybe”          // @maybe', '}'].join('\n'),
      py: ['def might_contain(word):', '    for h in hashes:                     # @hashc', '        if bits[h(word) % m] == 0:       # @probe', '            return False                 # @no', '    return True   # only "maybe"         # @maybe'].join('\n')
    }
  };

  return {
    piThrower: piThrower, piDarts: piDarts, piSeries: piSeries, piStd: piStd, piMeanError: piMeanError, piSteps: piSteps,
    shuffleNaive: shuffleNaive, fisherYates: fisherYates, shuffleSteps: shuffleSteps, shuffleMatrix: shuffleMatrix, naiveExact: naiveExact, matrixBias: matrixBias,
    reservoirSteps: reservoirSteps, reservoirReference: reservoirReference, reservoirInclusion: reservoirInclusion,
    skipInsert: skipInsert, skipBuild: skipBuild, skipSearchSteps: skipSearchSteps, skipInsertSteps: skipInsertSteps, skipCost: skipCost,
    skipAverageCost: skipAverageCost, skipExpectedHeight: skipExpectedHeight, skipTop: skipTop, flipTower: flipTower, MAX_LEVEL: MAXH,
    bloomIndexes: bloomIndexes, bloomStart: bloomStart, bloomIdle: bloomIdle, bloomOpSteps: bloomOpSteps, bloomFpRate: bloomFpRate, bloomEmpiricalFp: bloomEmpiricalFp, bloomBestK: bloomBestK,
    quickComparisons: quickComparisons, quickInputs: quickInputs, adversaryInput: adversaryInput,
    CODE: CODE
  };
}));
