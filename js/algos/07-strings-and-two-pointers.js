/* Lesson 07 · Strings, two pointers & windows — pure step generators (no DOM).

   Browser: VDSA.algos.strings.<fn>     Node: require('js/algos/07-strings-and-two-pointers.js').<fn>

   Every generator returns plain snapshot objects. Snapshots are complete pictures (never diffs) and are never
   mutated after they are pushed, so a player can step backwards, scrub and jump.

   Contents
     charInfo(text)                          characters, code points, UTF-16 code units, UTF-8 bytes
     concatSteps(n, mode)                    s += c in a loop (copies everything) vs a builder
     concatCost(n)                           {naive, builder} operation counts
     palindrome(text)                        converging pointers
     twoSum(sortedValues, target)            converging pointers on a sorted array (+ grid data)
     twoSumTrace / bruteTrace                the pairs each strategy looks at (the pair-grid race)
     reverse(text)                           swap from both ends
     dedupe(sortedValues)                    read / write pointers
     windowFixed(values, k, {recompute})     max sum of k consecutive values
     windowLongest(text)                     longest substring without a repeated character
     prefixSums(values, l, r)                build P, then answer sum(a[l..r]) = P[r+1] - P[l]
     anagram(a, b)                           two frequency tables, compared
     ops.*                                   operation counts for the cost chart (really run, not formulas)
     CODE.<name>                             {pseudo, js, py} with @labels that match step.line

   Truth rules (tested in tests/algos/07-strings-and-two-pointers.test.js): an item is 'done' only when it can
   never change again, 'muted' only when it is provably out of play, and in the pair grid a cell is ruled out
   only when sorted order proves it cannot sum to the target. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { var V = root.VDSA = root.VDSA || {}; V.algos = V.algos || {}; V.algos.strings = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var LIMITS = { chars: 18, values: 14, grid: 12, concat: 12 };

  /* ------------------------------------------------------------------ small helpers */
  function chars(input) { return typeof input === 'string' ? Array.from(input) : input.slice(); }
  function shown(c) { return c === ' ' ? '␣' : c; }
  function q(c) { return '“' + shown(c) + '”'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function item(id, value, state, extra) {
    var it = { id: id, value: value, state: state || 'default' };
    if (value === ' ') it.text = '␣';
    if (extra) for (var k in extra) it[k] = extra[k];
    return it;
  }
  function ptr(name, index, state, side) { return { name: name, index: index, state: state || 'active', side: side || 'below' }; }
  function raw(text) { return { __vdsaRaw: true, text: String(text), type: 'num' }; }

  /* ================================================================== characters */
  function utf8Bytes(cp) { return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4; }
  function charInfo(text) {
    var out = [], unit = 0;
    Array.from(text).forEach(function (ch, k) {
      var cp = ch.codePointAt(0), units = [];
      for (var u = 0; u < ch.length; u++) units.push(ch.charCodeAt(u));
      out.push({ index: k, ch: ch, codePoint: cp, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), units: units, unitStart: unit, bytes: utf8Bytes(cp) });
      unit += ch.length;
    });
    return out;
  }

  /* ================================================================== string building */
  /* mode 'naive':   s = s + c   allocates a new string and copies the old one every time.
     mode 'builder': push to a buffer, make the string once at the end. Cost unit: one character written. */
  function concatCost(n) {
    var naive = 0;
    for (var i = 0; i < n; i++) naive += i + 1;   // turn i copies i old characters and writes one new one
    return { naive: naive, builder: 2 * n };       // builder: n appends, then n characters copied once at the end
  }
  function concatSteps(n, mode) {
    if (n < 1 || n > LIMITS.concat) throw new RangeError('n must be between 1 and ' + LIMITS.concat);
    var text = 'abcdefghijkl'.slice(0, n).split(''), steps = [], cost = 0;
    function top(len) { return text.slice(0, len).map(function (c, k) { return item('a' + k, c, 'default'); }); }
    function push(kind, len, bottom, caption, line, extra) {
      var s = { kind: kind, mode: mode, i: len, cost: cost, length: len, rows: [
        { id: 'top', label: 'variable s', items: extra && extra.topItems ? extra.topItems : top(len), length: extra && extra.topLength },
        { id: 'bottom', label: mode === 'naive' ? 'new string' : 'buffer', items: bottom.items || [], length: bottom.length }
      ], caption: caption, line: line, vars: { i: len, cost: cost }, counters: { writes: cost, length: len } };
      steps.push(s);
      return s;
    }
    if (mode === 'naive') {
      push('start', 0, { items: [], length: 0 }, 'The string <code>s</code> is empty. The loop will run <code>s = s + c</code> ' + n + ' times, one character per turn. Counting one unit of cost for every character written into memory.', 'init');
      for (var i = 0; i < n; i++) {
        var c = text[i], ns = i + 1;
        push('alloc', i, { items: [], length: ns }, 'Strings cannot grow. <b>s + ' + q(c) + '</b> first asks for a brand-new block of <b>' + ns + '</b> slots.', 'concat');
        var copies = [];
        for (var k = 0; k < i; k++) copies.push(item('b' + k, text[k], 'swap', { from: 'a' + k }));
        cost += i;
        if (i > 0) push('copy', i, { items: copies, length: ns }, 'Then it copies all <b>' + i + '</b> old character' + (i === 1 ? '' : 's') + ' into the new block, one write each. Total cost so far: <b>' + cost + '</b>.', 'concat');
        cost += 1;
        var withNew = copies.concat([item('b' + i, c, 'key')]);
        push('append', i, { items: withNew, length: ns }, 'The new character ' + q(c) + ' goes in the last slot: one more write. Total cost so far: <b>' + cost + '</b>.', 'concat');
        var settled = top(ns).map(function (it, k) { return k === i ? Object.assign({}, it, { from: 'b' + i }) : it; });
        push('swapin', ns, { items: [], length: 0 }, 'The variable <code>s</code> now points at the new block; the old one is garbage. Length ' + ns + ', ' + (i === 0 ? 'and the cost was 1.' : 'and the whole turn cost <b>' + (i + 1) + '</b> writes.'), 'concat', { topItems: settled });
      }
      steps[steps.length - 1].caption += ' Final total: <b>' + cost + '</b> writes for ' + plural(n, 'character') + ', which is 1 + 2 + … + ' + n + ' = ' + (n * (n + 1) / 2) + '.';
    } else {
      push('start', 0, { items: [], length: 0 }, 'A builder keeps one growing buffer (a dynamic array, lesson 06). Appending a character writes only that character.', 'init');
      for (var j = 0; j < n; j++) {
        cost += 1;
        var buf = text.slice(0, j + 1).map(function (c2, k2) { return item('b' + k2, c2, k2 === j ? 'key' : 'default'); });
        var s2 = push('append', j + 1, { items: buf, length: n }, 'Append ' + q(text[j]) + ' to the buffer: <b>1</b> write. Total so far: <b>' + cost + '</b>.', 'concat', { topItems: [] });
        s2.rows[0].label = 'string';
      }
      cost += n;
      var fin = text.map(function (c3, k3) { return item('a' + k3, c3, 'swap', { from: 'b' + k3 }); });
      push('build', n, { items: [], length: 0 }, 'Finally the string is made once by copying the buffer: <b>' + n + '</b> writes. Total: <b>' + cost + '</b> = 2 × ' + n + '.', 'concat', { topItems: fin });
    }
    return steps;
  }

  /* ================================================================== palindrome: converging pointers */
  function palindrome(input) {
    var s = chars(input), n = s.length, steps = [], cmp = 0, l = 0, r = n - 1;
    function snap(kind, states, ptrs, caption, line, extra) {
      var st = {
        kind: kind, items: s.map(function (c, k) { return item('c' + k, c, states[k]); }), pointers: ptrs,
        l: l, r: r, caption: caption, line: line,
        vars: kind === 'cmp' || kind === 'miss' ? { l: l, r: r, 's[l]': s[l], 's[r]': s[r] } : { l: l, r: r },
        counters: { comparisons: cmp }
      };
      if (extra) for (var k in extra) st[k] = extra[k];
      steps.push(st);
    }
    var st0 = s.map(function () { return 'default'; });
    if (n === 0) {
      snap('end', [], [], 'The empty string reads the same both ways: there is nothing to compare, so it is a palindrome.', ['loop', 'ret'], { result: true, vars: { l: 0, r: -1 } });
      return steps;
    }
    snap('init', st0.slice(), [ptr('l', 0, 'active', 'below'), ptr('r', n - 1, 'active', 'above')],
      'Put <b>l</b> on the first character and <b>r</b> on the last. A palindrome reads the same from both ends, so the two characters under the pointers must be equal.', 'init');
    var states = st0.slice();
    while (l < r) {
      cmp++;
      var cur = states.slice(); cur[l] = 'compare'; cur[r] = 'compare';
      snap('cmp', cur, [ptr('l', l, 'compare', 'below'), ptr('r', r, 'compare', 'above')],
        'Compare <b>s[' + l + '] = ' + q(s[l]) + '</b> with <b>s[' + r + '] = ' + q(s[r]) + '</b>.', 'cmp');
      if (s[l] !== s[r]) {
        var bad = states.slice(); bad[l] = 'error'; bad[r] = 'error';
        snap('miss', bad, [ptr('l', l, 'error', 'below'), ptr('r', r, 'error', 'above')],
          q(s[l]) + ' ≠ ' + q(s[r]) + '. One pair that disagrees is enough to prove it: <b>not a palindrome</b>. The other characters never need to be looked at.', 'miss', { result: false });
        return steps;
      }
      states[l] = 'done'; states[r] = 'done';
      var pl = l, pr = r;
      l++; r--;
      var pts = [ptr('l', l, 'active', 'below'), ptr('r', r, 'active', 'above')];
      snap('match', states.slice(), pts,
        'Equal, so this pair is settled for good (green). Move <b>l</b> one step right and <b>r</b> one step left: the characters between them are all that is left to check.'.replace('this pair', 'the pair ' + q(s[pl]) + ' at ' + pl + ' and ' + pr), 'move');
    }
    var fin = states.slice();
    var mid = l === r;
    if (mid) fin[l] = 'done';
    snap('end', fin, [ptr('l', l, 'done', 'below'), ptr('r', r, 'done', 'above')],
      (mid ? 'The pointers meet on <b>' + q(s[l]) + '</b> at index ' + l + ': the middle character has no partner and always matches itself. ' : 'The pointers have crossed: every character has met its mirror image. ') +
      '<b>Palindrome</b>, after ' + plural(cmp, 'comparison') + ' for ' + plural(n, 'character') + ' (about n / 2).', ['loop', 'ret'], { result: true });
    return steps;
  }

  /* ================================================================== two-sum on a sorted array */
  function isSorted(a) { for (var i = 1; i < a.length; i++) if (a[i] < a[i - 1]) return false; return true; }
  function twoSumTrace(a, target) {
    var lo = 0, hi = a.length - 1, pairs = [], found = null;
    while (lo < hi) {
      var sum = a[lo] + a[hi];
      pairs.push([lo, hi, sum]);
      if (sum === target) { found = [lo, hi]; break; }
      if (sum < target) lo++; else hi--;
    }
    return { pairs: pairs, found: found };
  }
  function bruteTrace(a, target) {
    var pairs = [], found = null;
    for (var i = 0; i < a.length && !found; i++) for (var j = i + 1; j < a.length; j++) {
      pairs.push([i, j, a[i] + a[j]]);
      if (a[i] + a[j] === target) { found = [i, j]; break; }
    }
    return { pairs: pairs, found: found };
  }
  /* pairs (i < j) ruled out by sorted order once the window is [lo, hi], and how many of them were never looked at */
  function ruledOut(n, lo, hi, examined) {
    var count = 0;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) if ((i < lo || j > hi) && !examined[i + ',' + j]) count++;
    return count;
  }
  function twoSum(values, target) {
    var a = values.slice(), n = a.length;
    if (!isSorted(a)) throw new RangeError('two pointers need a sorted array');
    var steps = [], lo = 0, hi = n - 1, sums = 0, path = [], examined = {};
    function states(cur, found, over) {
      return a.map(function (_, k) {
        if (found && (k === found[0] || k === found[1])) return 'found';
        if (over) return 'muted';
        if (cur && (k === lo || k === hi) && lo < hi) return 'compare';
        if (k < lo || k > hi) return 'muted';
        return 'default';
      });
    }
    function snap(kind, cur, caption, line, extra) {
      var res = extra && extra.found ? extra.found : null;
      var stt = states(cur, res, kind === 'none');
      var s = {
        kind: kind, items: a.map(function (v, k) { return item('c' + k, v, stt[k]); }),
        pointers: lo < n && hi >= 0 ? [ptr('lo', Math.min(lo, n - 1), cur ? 'compare' : 'active', 'below'), ptr('hi', Math.max(hi, 0), cur ? 'compare' : 'active', 'above')] : [],
        regions: lo <= hi ? [{ from: lo, to: hi, state: 'visited', label: 'still possible' }] : [],
        lo: lo, hi: hi, n: n, target: target, path: path.slice(), found: res, sum: extra && extra.sum !== undefined ? extra.sum : null,
        caption: caption, line: line,
        vars: { lo: lo, hi: hi, 'a[lo]': a[lo] === undefined ? null : a[lo], 'a[hi]': a[hi] === undefined ? null : a[hi], sum: extra && extra.sum !== undefined ? extra.sum : null, target: target },
        counters: { sums: sums, ruledOut: ruledOut(n, lo, hi, examined) }
      };
      if (extra) for (var k in extra) if (k !== 'found' && k !== 'sum') s[k] = extra[k];
      steps.push(s);
    }
    if (n < 2) {
      snap('none', false, 'With fewer than two values there is no pair to add, so the answer is <b>none</b>.', ['loop', 'none'], { result: null });
      return steps;
    }
    snap('init', false, 'The array is <b>sorted</b>, and that is the whole trick. Put <b>lo</b> on the smallest value and <b>hi</b> on the largest, and look for two values that add up to <b>' + target + '</b>.', 'init');
    while (lo < hi) {
      var sum = a[lo] + a[hi];
      sums++; examined[lo + ',' + hi] = true; path = path.concat([[lo, hi]]);
      var rel = sum === target ? '=' : sum < target ? '&lt;' : '&gt;';
      snap('sum', true, '<b>a[' + lo + '] + a[' + hi + '] = ' + a[lo] + ' + ' + a[hi] + ' = ' + sum + '</b>, and ' + sum + ' ' + rel + ' ' + target + '.', 'sum', { sum: sum });
      if (sum === target) {
        snap('found', true, '<b>' + sum + ' = ' + target + '</b>: the pair is at indices ' + lo + ' and ' + hi + ' (values ' + a[lo] + ' and ' + a[hi] + '). It took ' + plural(sums, 'sum') + '.', 'hit', { found: [lo, hi], sum: sum, result: [lo, hi] });
        return steps;
      }
      if (sum < target) {
        var old = lo; lo++;
        snap('lo', false, '<b>' + sum + ' is too small.</b> Even with the largest value still in play (' + a[hi] + '), ' + a[old] + ' cannot reach ' + target + ', so it cannot reach it with anything smaller either. Index ' + old + ' is out: <b>lo moves right</b>, and a whole row of pairs is ruled out unseen.', ['cmp', 'low'], { moved: 'lo' });
      } else {
        var oldH = hi; hi--;
        snap('hi', false, '<b>' + sum + ' is too big.</b> Even with the smallest value still in play (' + a[lo] + '), ' + a[oldH] + ' overshoots ' + target + ', and so does anything larger. Index ' + oldH + ' is out: <b>hi moves left</b>, and a whole column of pairs is ruled out unseen.', 'high', { moved: 'hi' });
      }
    }
    snap('none', false, 'The pointers met, so every pair has been either checked or ruled out, and none adds up to ' + target + '. The answer is <b>none</b>, after ' + plural(sums, 'sum') + ' (at most n − 1 = ' + (n - 1) + ').', ['loop', 'none'], { result: null });
    return steps;
  }

  /* ================================================================== reverse in place */
  function reverse(input) {
    var s = chars(input), n = s.length, steps = [], swaps = 0;
    var order = s.map(function (c, k) { return { id: 'c' + k, value: c }; });
    var l = 0, r = n - 1, doneL = 0;
    function snap(kind, caption, line, pair, phase) {
      var fixed = {};
      for (var k = 0; k < l; k++) fixed[k] = fixed[n - 1 - k] = true;
      if (phase === 'swap') { fixed[pair[0]] = fixed[pair[1]] = true; }
      if (kind === 'move' && l === r) fixed[l] = true;
      steps.push({
        kind: kind,
        items: order.map(function (o, k) { return item(o.id, o.value, fixed[k] ? 'done' : pair && (k === pair[0] || k === pair[1]) ? 'compare' : 'default'); }),
        pointers: pair || n > 0 && l < n ? [ptr('l', Math.min(l, n - 1), phase === 'swap' ? 'done' : 'active', 'below'), ptr('r', Math.max(r, 0), phase === 'swap' ? 'done' : 'active', 'above')] : [],
        l: l, r: r, caption: caption, line: line, vars: { l: l, r: r }, counters: { swaps: swaps }
      });
    }
    if (n === 0) { snap('end', 'Nothing to reverse: an empty string is its own reverse.', ['loop', 'ret'], null); steps[0].pointers = []; return steps; }
    snap('init', 'Put <b>l</b> on the first character and <b>r</b> on the last. The first character belongs at the end and the last at the front, so they trade places.', 'init', n > 1 ? [0, n - 1] : null);
    while (l < r) {
      var a = order[l], b = order[r];
      order[l] = b; order[r] = a; swaps++;
      snap('swap', 'Swap <b>' + q(a.value) + '</b> and <b>' + q(b.value) + '</b>. Each now sits where it belongs in the reversed string: green means final.', 'swap', [l, r], 'swap');
      l++; r--;
      if (l < r) snap('move', 'Move <b>l</b> right and <b>r</b> left. The next pair, ' + q(order[l].value) + ' and ' + q(order[r].value) + ', are the outermost characters not yet swapped.', 'move', [l, r]);
      else snap('move', l === r ? 'The pointers meet on the middle character ' + q(order[l].value) + '. It is already in the middle of the reversed string, so it stays.' : 'The pointers crossed, so every character has been moved to its mirror position.', 'move', null);
    }
    var fixed = {};
    for (var k = 0; k < n; k++) fixed[k] = true;
    steps.push({
      kind: 'end', items: order.map(function (o, k) { return item(o.id, o.value, 'done'); }), pointers: [], l: l, r: r,
      caption: (n === 1 ? 'A single character is its own reverse: zero swaps. ' : '') + 'Reversed with <b>' + plural(swaps, 'swap') + '</b>, which is ⌊n / 2⌋ for ' + plural(n, 'character') + ', and no extra memory.',
      line: ['loop', 'ret'], vars: { l: l, r: r }, counters: { swaps: swaps }, result: order.map(function (o) { return o.value; })
    });
    return steps;
  }

  /* ================================================================== remove duplicates from a sorted array */
  function dedupe(values) {
    var a = values.slice(), n = a.length;
    if (!isSorted(a)) throw new RangeError('duplicates are only adjacent in a sorted array');
    var steps = [], w = 1, reads = 0, writes = 0, cur = a.slice();
    function snap(kind, r, caption, line, hot, extra) {
      var st = {
        kind: kind, items: cur.map(function (v, k) {
          var state = k < w ? 'done' : k > r && kind !== 'end' ? 'default' : 'muted';
          if (hot && hot.indexOf(k) !== -1) state = kind === 'write' ? 'swap' : 'compare';
          if (kind === 'end') state = k < w ? 'done' : 'muted';
          return item('c' + k, v, state);
        }),
        pointers: kind === 'end' || n === 0 ? [] : [ptr('r', r, kind === 'write' ? 'swap' : 'compare', 'above'), ptr('w', Math.min(w, n), 'active', 'below')],
        regions: n && w > 0 ? [{ from: 0, to: w - 1, state: 'done', label: 'unique so far' }] : [],
        w: w, r: r, caption: caption, line: line,
        vars: { r: r < n ? r : null, w: w, 'a[r]': r < n && r >= 0 ? cur[r] : null, 'a[w−1]': w > 0 ? cur[w - 1] : null },
        counters: { reads: reads, writes: writes }
      };
      if (extra) for (var k in extra) st[k] = extra[k];
      steps.push(st);
    }
    if (n === 0) { snap('end', 0, 'The array is empty, so the count of unique values is <b>0</b> and there is nothing to keep.', ['empty', 'ret'], null, { result: 0, vars: { w: 0 } }); return steps; }
    snap('init', 0, 'Two pointers, two jobs. <b>r</b> reads every value; <b>w</b> marks the next slot to write. The first value is always kept, so <b>w = 1</b>. In a sorted array, equal values sit side by side.', 'init');
    for (var r = 1; r < n; r++) {
      reads++;
      var last = cur[w - 1];
      snap('cmp', r, 'Compare <b>a[' + r + '] = ' + a[r] + '</b> with the last value we kept, <b>a[' + (w - 1) + '] = ' + last + '</b>.', 'cmp', [r, w - 1]);
      if (a[r] !== last) {
        var self = w === r;
        cur = cur.slice(); cur[w] = a[r]; writes++;
        var wOld = w; w++;
        snap('write', r, a[r] + ' is new, so write it at index ' + wOld + (self ? ' (that is where it already is, because nothing has been skipped yet)' : ', on top of a value we already read and no longer need') + ', then advance <b>w</b>. Everything left of <b>w</b> is unique and final.', ['write', 'grow'], [wOld, r]);
      } else {
        snap('skip', r, a[r] + ' equals the last kept value, so it is a duplicate. Skip it: <b>r</b> moves on and <b>w</b> stays, leaving a gap that a later value will fill.', 'loop', [r]);
      }
    }
    snap('end', n, 'Done: <b>w = ' + w + '</b> unique value' + (w === 1 ? '' : 's') + ' sit in <code>a[0..' + (w - 1) + ']</code>. The tail (grey) is leftover that callers must ignore. One pass, ' + plural(reads, 'read') + ' and ' + plural(writes, 'write') + ', no second array.', 'ret', null, { result: w });
    return steps;
  }

  /* ================================================================== sliding window: max sum of k */
  function windowFixed(values, k, opts) {
    opts = opts || {};
    var a = values.slice(), n = a.length;
    if (!(k >= 1 && k <= n)) throw new RangeError('k must be between 1 and n');
    var recompute = !!opts.recompute, steps = [], ops = 0, sum = 0, best = -Infinity, bestStart = 0;
    function cells(l, r, enter, leave) {
      return a.map(function (v, i) {
        var state = 'default';
        if (i < l) state = 'muted';
        if (i >= l && i <= r) state = 'visited';
        if (enter === i) state = 'active';
        if (leave === i) state = 'compare';
        return item('c' + i, v, state, enter === i ? { badge: '+' + v, badgeState: 'active' } : leave === i ? { badge: '−' + v, badgeState: 'compare' } : null);
      });
    }
    function bestRow() { return { id: 'best', label: 'best', offset: bestStart, items: best === -Infinity ? [] : a.slice(bestStart, bestStart + k).map(function (v, i) { return item('b' + bestStart + '_' + i, v, 'done'); }) }; }
    function snap(kind, l, r, enter, leave, caption, line, extra) {
      var s = {
        kind: kind, l: l, r: r, sum: sum, best: best === -Infinity ? null : best, bestStart: bestStart, k: k,
        rows: [{ id: 'a', label: 'values', items: cells(l, r, enter, leave),
          pointers: [ptr('l', l, 'active', 'below'), ptr('r', r, 'active', 'above')],
          regions: [{ from: l, to: r, state: 'active', label: 'window · sum ' + sum }] }, bestRow()],
        caption: caption, line: line,
        vars: { l: l, r: r, sum: sum, best: best === -Infinity ? null : best },
        counters: { ops: ops }
      };
      if (extra) for (var kk in extra) s[kk] = extra[kk];
      steps.push(s);
    }
    function firstWindow() {
      sum = 0;
      for (var i = 0; i < k; i++) sum += a[i];
      ops += k; best = sum; bestStart = 0;
      snap('first', 0, k - 1, null, null, 'Add the first ' + plural(k, 'value') + ' once: <b>' + a.slice(0, k).join(' + ') + ' = ' + sum + '</b>. That is the first window and, so far, the best one. Cost: ' + plural(k, 'addition') + '.', ['first', 'init']);
    }
    if (recompute) {
      for (var l = 0; l + k <= n; l++) {
        sum = 0;
        for (var i = l; i < l + k; i++) sum += a[i];
        ops += k;
        var improved = sum > best;
        if (improved) { best = sum; bestStart = l; }
        snap('window', l, l + k - 1, null, null, 'Window <b>[' + l + '..' + (l + k - 1) + ']</b>: add all ' + plural(k, 'value') + ' again, <b>' + sum + '</b>. ' + (improved ? 'New best.' : 'Not better than ' + best + '.') + ' Total additions so far: ' + ops + '.', 'sum');
      }
      steps.push(Object.assign({}, steps[steps.length - 1], { kind: 'end', caption: 'Best window sum: <b>' + best + '</b>, at indices ' + bestStart + '..' + (bestStart + k - 1) + '. Recomputing cost ' + plural(ops, 'addition') + ': k × (n − k + 1) = ' + k + ' × ' + (n - k + 1) + '.', line: 'ret' }));
      return steps;
    }
    firstWindow();
    if (opts.flow) steps[0].flow = 'init';
    for (var r = k; r < n; r++) {
      var leave = a[r - k], enter = a[r], before = sum;
      sum += enter - leave; ops += 2;
      snap('slide', r - k + 1, r, r, r - k, 'The window slides one step: <b>+' + enter + '</b> enters on the right, <b>−' + leave + '</b> leaves on the left. New sum = ' + before + ' + ' + enter + ' − ' + leave + ' = <b>' + sum + '</b>. Two operations, whatever k is.', 'slide', { flow: opts.flow ? 'slide' : undefined, delta: { before: before, enter: enter, leave: leave } });
      var better = sum > best;
      if (opts.flow) snap('cmp', r - k + 1, r, null, null, 'Is <b>sum = ' + sum + '</b> greater than <b>best = ' + best + '</b>? ' + (better ? 'Yes.' : 'No.'), 'best', { flow: 'better' });
      if (better) { best = sum; bestStart = r - k + 1; }
      if (better || !opts.flow) snap(better ? 'best' : 'keep', r - k + 1, r, null, null, better ? '<b>' + sum + '</b> beats the old best, so the best window moves here.' : sum + ' does not beat ' + best + ', so the best stays where it was.', 'best', { flow: opts.flow ? 'upd' : undefined });
      if (opts.flow) snap('more', r - k + 1, r, null, null, r < n - 1 ? 'Are there more values to the right? Yes: slide again.' : 'Are there more values to the right? No: the window has reached the end.', 'loop', { flow: 'more' });
    }
    steps.push(Object.assign({}, steps[steps.length - 1], { kind: 'end', flow: opts.flow ? 'ret' : undefined, delta: undefined, caption: 'The window has reached the end. Best sum: <b>' + best + '</b>, at indices ' + bestStart + '..' + (bestStart + k - 1) + '. Total: ' + plural(ops, 'operation') + ' = k + 2 × (n − k) = ' + k + ' + 2 × ' + (n - k) + '.', line: 'ret' }));
    return steps;
  }

  /* ================================================================== sliding window: longest substring without repeats */
  function windowLongest(input) {
    var s = chars(input), n = s.length, steps = [], counts = {}, l = 0, best = 0, bestStart = 0, adds = 0, drops = 0;
    var alphabet = [];
    s.forEach(function (c) { if (alphabet.indexOf(c) === -1) alphabet.push(c); });
    function snap(kind, r, caption, line, flow, o) {
      o = o || {};
      var dup = o.dup;   // the character that is duplicated inside the window
      var items = s.map(function (c, i) {
        var state = 'default';
        if (i < l) state = 'muted';
        else if (i <= r) state = 'visited';
        if (dup !== undefined && i >= l && i <= r && c === dup) state = 'error';
        if (o.entering === i) state = dup !== undefined ? 'error' : 'active';
        if (o.leaving === i) state = 'compare';
        return item('c' + i, c, state);
      });
      var best_items = best ? s.slice(bestStart, bestStart + best).map(function (c, i) { return item('b' + bestStart + '_' + i, c, 'done'); }) : [];
      var winLen = r >= l ? r - l + 1 : 0;
      steps.push({
        kind: kind, l: l, r: r, best: best, bestStart: bestStart, alphabet: alphabet, counts: Object.assign({}, counts), dup: dup === undefined ? null : dup,
        rows: [{ id: 'a', label: 'string', items: items,
          pointers: n ? [ptr('l', Math.min(l, n - 1), 'active', 'below')].concat(r >= 0 ? [ptr('r', r, 'active', 'above')] : []) : [],
          regions: winLen ? [{ from: l, to: r, state: dup !== undefined ? 'error' : 'active', label: 'window · ' + winLen }] : [] },
          { id: 'best', label: 'best', offset: bestStart, items: best_items }],
        caption: caption, line: line, flow: flow,
        vars: { l: l, r: r < 0 ? null : r, best: best, count: raw('{' + alphabet.filter(function (c) { return counts[c]; }).map(function (c) { return shown(c) + ':' + counts[c]; }).join(', ') + '}') },
        counters: { added: adds, dropped: drops, best: best }
      });
    }
    if (n === 0) {
      snap('end', -1, 'The string is empty: the window has nothing to hold, so the answer is <b>0</b>.', ['init', 'ret'], 'ret');
      return steps;
    }
    snap('init', -1, 'Keep a <b>window</b> <code>s[l..r]</code> in which every character is different, and a table that counts each character inside it. Start with an empty window and grow it by moving <b>r</b>.', 'init', 'init');
    for (var r = 0; r < n; r++) {
      var c = s[r];
      counts[c] = (counts[c] || 0) + 1; adds++;
      snap('add', r, '<b>r</b> reaches ' + q(c) + '. Add it to the window and to the table: count[' + q(c) + '] = <b>' + counts[c] + '</b>.', 'add', 'add', { entering: r });
      var isDup = counts[c] > 1;
      snap('dup', r, isDup
        ? 'Is <b>count[' + q(c) + '] &gt; 1</b>? Yes: ' + q(c) + ' now appears twice inside the window (red), so the window is broken. It has to shrink from the left until one copy is gone.'
        : 'Is <b>count[' + q(c) + '] &gt; 1</b>? No: every character in the window is still different, so the window is valid.', 'dup', 'dup', isDup ? { dup: c } : {});
      while (counts[c] > 1) {
        var out = s[l];
        counts[out]--; drops++;
        var leaving = l; l++;
        var still = counts[c] > 1;
        var why = out === c
          ? 'That was the older ' + q(c) + ', so the window is valid again.'
          : q(out) + ' is not the repeated character, but it sits left of the older ' + q(c) + '. A window is one unbroken stretch, so the only way to drop the older ' + q(c) + ' is to drop everything before it. Keep shrinking.';
        snap('shrink', r, 'Drop <b>s[' + leaving + '] = ' + q(out) + '</b> from the left and lower its count to ' + counts[out] + '. ' + why, 'shrink', 'shrink', { leaving: leaving });
        if (still) snap('dup', r, 'Is <b>count[' + q(c) + '] &gt; 1</b>? Still yes.', 'dup', 'dup', { dup: c });
        else snap('dup', r, 'Is <b>count[' + q(c) + '] &gt; 1</b>? No: the window <b>s[' + l + '..' + r + ']</b> has all different characters.', 'dup', 'dup');
      }
      var len = r - l + 1, better = len > best;
      if (better) { best = len; bestStart = l; }
      snap('update', r, better
        ? 'The window holds <b>' + len + '</b> different character' + (len === 1 ? '' : 's') + ': ' + q(s.slice(l, r + 1).join('')) + '. That beats the old best, so record it.'
        : 'The window holds ' + len + ' different character' + (len === 1 ? '' : 's') + ', which does not beat the best (' + best + '). Move on.', 'update', 'update');
    }
    snap('end', n - 1, 'The window has scanned the whole string. Longest substring without a repeat: <b>' + q(s.slice(bestStart, bestStart + best).join('')) + '</b>, length <b>' + best + '</b>. Each character was added once and dropped at most once: ' + adds + ' + ' + drops + ' ≤ 2n.', 'ret', 'ret');
    return steps;
  }

  /* ================================================================== prefix sums */
  function prefixSums(values, l, r) {
    var a = values.slice(), n = a.length;
    if (n > 0 && !(l >= 0 && l <= r && r < n)) throw new RangeError('need 0 ≤ l ≤ r < n');
    var P = [0], steps = [];
    for (var i = 0; i < n; i++) P.push(P[i] + a[i]);
    function snap(kind, built, caption, o) {
      o = o || {};
      var s = { kind: kind, values: a, P: P, built: built, l: n ? l : 0, r: n ? r : -1, caption: caption, focusL: !!o.focusL, focusR: !!o.focusR, answer: o.answer === undefined ? null : o.answer, active: o.active === undefined ? null : o.active,
        line: o.line || null,
        counters: { built: Math.max(0, built - 1), queryOps: o.queryOps || 0 },
        vars: o.vars || { built: Math.max(0, built - 1) } };
      steps.push(s);
    }
    snap('init', 1, 'Prefix sums start with <b>P[0] = 0</b>: the sum of zero values. <b>P[i]</b> will hold the sum of the first <i>i</i> values, <code>a[0..i−1]</code>.', { line: 'init', active: 0 });
    for (var k = 0; k < n; k++) snap('build', k + 2, '<b>P[' + (k + 1) + '] = P[' + k + '] + a[' + k + '] = ' + P[k] + ' + ' + a[k] + ' = ' + P[k + 1] + '</b>. Each entry reuses the one before it: one addition each.', { line: 'build', active: k + 1, vars: { i: k, 'P[i+1]': P[k + 1] } });
    if (n === 0) { steps[0].caption += ' The array is empty, so P is just [0] and every query is out of range.'; return steps; }
    var direct = 0;
    for (var d = l; d <= r; d++) direct += a[d];
    snap('queryL', n + 1, 'Query: what is the sum of <b>a[' + l + '..' + r + ']</b>? Look at <b>P[' + l + '] = ' + P[l] + '</b>: the sum of everything <em>before</em> index ' + l + '.', { line: 'query', focusL: true, active: l, vars: { l: l, r: r, 'P[l]': P[l] } });
    snap('queryR', n + 1, 'Now look at <b>P[' + (r + 1) + '] = ' + P[r + 1] + '</b>: the sum of everything up to and including index ' + r + '.', { line: 'query', focusL: true, focusR: true, active: r + 1, vars: { l: l, r: r, 'P[l]': P[l], 'P[r+1]': P[r + 1] } });
    snap('diff', n + 1, 'Subtract: <b>P[' + (r + 1) + '] − P[' + l + '] = ' + P[r + 1] + ' − ' + P[l] + ' = ' + (P[r + 1] - P[l]) + '</b>. The part shared by both bars cancels, leaving exactly <code>a[' + l + '..' + r + ']</code>. Adding them directly gives ' + direct + ' as well, but took ' + plural(r - l + 1, 'addition') + ' instead of one subtraction.', { line: 'query', focusL: true, focusR: true, answer: P[r + 1] - P[l], queryOps: 1, active: null, vars: { l: l, r: r, 'P[l]': P[l], 'P[r+1]': P[r + 1], answer: P[r + 1] - P[l] } });
    return steps;
  }

  /* ================================================================== anagram: two frequency tables */
  function anagram(a, b) {
    var A = Array.from(a), B = Array.from(b), steps = [], ca = {}, cb = {}, letters = [];
    A.concat(B).forEach(function (c) { if (letters.indexOf(c) === -1) letters.push(c); });
    letters.sort();
    function snap(kind, caption, t, extra) {
      var s = { kind: kind, letters: letters, ca: Object.assign({}, ca), cb: Object.assign({}, cb), a: a, b: b, t: t, caption: caption, diff: [], verdict: null, last: null, lastSeries: null, counters: { counted: Object.keys(ca).reduce(function (x, k) { return x + ca[k]; }, 0) + Object.keys(cb).reduce(function (x, k) { return x + cb[k]; }, 0) } };
      if (extra) for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }
    snap('init', 'Two words are <b>anagrams</b> when they use exactly the same letters the same number of times. Instead of sorting, count: one tally per word.', -1);
    A.forEach(function (c, t) {
      ca[c] = (ca[c] || 0) + 1;
      snap('countA', 'First word, letter ' + (t + 1) + ': tally <b>' + c + '</b>. Its bar grows to ' + ca[c] + '.', t, { last: c, lastSeries: 'a' });
    });
    B.forEach(function (c, t) {
      cb[c] = (cb[c] || 0) + 1;
      snap('countB', 'Second word, letter ' + (t + 1) + ': tally <b>' + c + '</b>. Its bar grows to ' + cb[c] + '.', t, { last: c, lastSeries: 'b' });
    });
    var T = A.length + B.length;
    var diff = letters.filter(function (c) { return (ca[c] || 0) !== (cb[c] || 0); });
    var ok = diff.length === 0;
    snap('compare', ok
      ? 'Compare the two tables letter by letter: every count matches. <b>Anagrams.</b> The work was ' + plural(A.length + B.length, 'tally') + ' plus one look at each of ' + plural(letters.length, 'distinct letter') + ': linear, no sorting.'
      : 'Compare the two tables: ' + diff.map(function (c) { return '<b>' + c + '</b> is ' + (ca[c] || 0) + ' vs ' + (cb[c] || 0); }).join(', ') + '. <b>Not anagrams.</b>' + (A.length !== B.length ? ' (The lengths differ, which already rules it out.)' : ''), T, { diff: diff, verdict: ok });
    return steps;
  }

  /* ================================================================== operation counts for the cost chart */
  var ops = {
    /* worst case for both: the target is absent */
    twoSum: function (n) {
      var a = []; for (var i = 0; i < n; i++) a.push(i);
      return { brute: bruteTrace(a, -1).pairs.length, pointers: twoSumTrace(a, -1).pairs.length };
    },
    /* string of n different characters (worst case for the brute force; the window adds each once) */
    longest: function (n) {
      var s = []; for (var i = 0; i < n; i++) s.push(String.fromCharCode(0x100 + i));
      var brute = 0;
      for (var st = 0; st < n; st++) { var seen = {}; for (var j = st; j < n; j++) { brute++; if (seen[s[j]]) break; seen[s[j]] = 1; } }
      var w = ops.longestFast(s);
      return { brute: brute, window: w.adds + w.drops };
    },
    /* n values, n queries that each cover the whole array */
    range: function (n) { return { brute: n * n, prefix: n + n }; },
    concat: function (n) { return concatCost(n); }
  };
  /* fast counting versions (no snapshots) for large n */
  ops.longestFast = function (str) {
    var count = {}, l = 0, adds = 0, drops = 0, best = 0;
    for (var r = 0; r < str.length; r++) {
      var c = str[r]; count[c] = (count[c] || 0) + 1; adds++;
      while (count[c] > 1) { count[str[l]]--; l++; drops++; }
      if (r - l + 1 > best) best = r - l + 1;
    }
    return { adds: adds, drops: drops, best: best };
  };

  /* ================================================================== code panels */
  var CODE = {
    palindrome: {
      pseudo: [
        'procedure isPalindrome(s)',
        '  l ← 0,  r ← length(s) − 1          // @init',
        '  while l < r                        // @loop',
        '    if s[l] ≠ s[r]                   // @cmp',
        '      return false                   // @miss',
        '    l ← l + 1,  r ← r − 1            // @move',
        '  return true                        // @ret'
      ].join('\n'),
      js: [
        'function isPalindrome(s) {',
        '  let l = 0, r = s.length - 1;   // @init',
        '  while (l < r) {                // @loop',
        '    if (s[l] !== s[r]) {         // @cmp',
        '      return false;              // @miss',
        '    }',
        '    l++; r--;                    // @move',
        '  }',
        '  return true;                   // @ret',
        '}'
      ].join('\n'),
      py: [
        'def is_palindrome(s):',
        '    l, r = 0, len(s) - 1     # @init',
        '    while l < r:             # @loop',
        '        if s[l] != s[r]:     # @cmp',
        '            return False     # @miss',
        '        l += 1; r -= 1       # @move',
        '    return True              # @ret'
      ].join('\n')
    },
    twoSum: {
      pseudo: [
        'procedure twoSumSorted(a, target)',
        '  lo ← 0,  hi ← n − 1                // @init',
        '  while lo < hi                      // @loop',
        '    sum ← a[lo] + a[hi]              // @sum',
        '    if sum = target                  // @check',
        '      return (lo, hi)                // @hit',
        '    else if sum < target             // @cmp',
        '      lo ← lo + 1                    // @low',
        '    else',
        '      hi ← hi − 1                    // @high',
        '  return none                        // @none'
      ].join('\n'),
      js: [
        'function twoSumSorted(a, target) {',
        '  let lo = 0, hi = a.length - 1;   // @init',
        '  while (lo < hi) {                // @loop',
        '    const sum = a[lo] + a[hi];     // @sum',
        '    if (sum === target) {          // @check',
        '      return [lo, hi];             // @hit',
        '    }',
        '    if (sum < target) {            // @cmp',
        '      lo++;                        // @low',
        '    } else {',
        '      hi--;                        // @high',
        '    }',
        '  }',
        '  return null;                     // @none',
        '}'
      ].join('\n'),
      py: [
        'def two_sum_sorted(a, target):',
        '    lo, hi = 0, len(a) - 1     # @init',
        '    while lo < hi:             # @loop',
        '        s = a[lo] + a[hi]      # @sum',
        '        if s == target:        # @check',
        '            return lo, hi      # @hit',
        '        if s < target:         # @cmp',
        '            lo += 1            # @low',
        '        else:',
        '            hi -= 1            # @high',
        '    return None                # @none'
      ].join('\n')
    },
    reverse: {
      pseudo: [
        'procedure reverse(a)',
        '  l ← 0,  r ← n − 1                  // @init',
        '  while l < r                        // @loop',
        '    swap a[l], a[r]                  // @swap',
        '    l ← l + 1,  r ← r − 1            // @move',
        '  return a                           // @ret'
      ].join('\n'),
      js: [
        'function reverse(a) {',
        '  let l = 0, r = a.length - 1;   // @init',
        '  while (l < r) {                // @loop',
        '    [a[l], a[r]] = [a[r], a[l]]; // @swap',
        '    l++; r--;                    // @move',
        '  }',
        '  return a;                      // @ret',
        '}'
      ].join('\n'),
      py: [
        'def reverse(a):',
        '    l, r = 0, len(a) - 1     # @init',
        '    while l < r:             # @loop',
        '        a[l], a[r] = a[r], a[l]   # @swap',
        '        l += 1; r -= 1       # @move',
        '    return a                 # @ret'
      ].join('\n')
    },
    dedupe: {
      pseudo: [
        'procedure removeDuplicates(sorted a)',
        '  if n = 0: return 0                 // @empty',
        '  w ← 1                              // @init',
        '  for r from 1 to n − 1              // @loop',
        '    if a[r] ≠ a[w − 1]               // @cmp',
        '      a[w] ← a[r]                    // @write',
        '      w ← w + 1                      // @grow',
        '  return w                           // @ret'
      ].join('\n'),
      js: [
        'function removeDuplicates(a) {   // sorted a',
        '  if (a.length === 0) return 0;      // @empty',
        '  let w = 1;                         // @init',
        '  for (let r = 1; r < a.length; r++) { // @loop',
        '    if (a[r] !== a[w - 1]) {         // @cmp',
        '      a[w] = a[r];                   // @write',
        '      w++;                           // @grow',
        '    }',
        '  }',
        '  return w;                          // @ret',
        '}'
      ].join('\n'),
      py: [
        'def remove_duplicates(a):   # sorted a',
        '    if not a: return 0               # @empty',
        '    w = 1                            # @init',
        '    for r in range(1, len(a)):       # @loop',
        '        if a[r] != a[w - 1]:         # @cmp',
        '            a[w] = a[r]              # @write',
        '            w += 1                   # @grow',
        '    return w                         # @ret'
      ].join('\n')
    },
    fixed: {
      pseudo: [
        'procedure maxSumOfK(a, k)',
        '  sum ← a[0] + … + a[k − 1]          // @first',
        '  best ← sum                         // @init',
        '  for r from k to n − 1              // @loop',
        '    sum ← sum + a[r] − a[r − k]      // @slide',
        '    best ← max(best, sum)            // @best',
        '  return best                        // @ret'
      ].join('\n'),
      js: [
        'function maxSumOfK(a, k) {',
        '  let sum = 0;',
        '  for (let i = 0; i < k; i++) sum += a[i];   // @first',
        '  let best = sum;                    // @init',
        '  for (let r = k; r < a.length; r++) {   // @loop',
        '    sum += a[r] - a[r - k];          // @slide',
        '    best = Math.max(best, sum);      // @best',
        '  }',
        '  return best;                       // @ret',
        '}'
      ].join('\n'),
      py: [
        'def max_sum_of_k(a, k):',
        '    total = sum(a[:k])               # @first',
        '    best = total                     # @init',
        '    for r in range(k, len(a)):       # @loop',
        '        total += a[r] - a[r - k]     # @slide',
        '        best = max(best, total)      # @best',
        '    return best                      # @ret'
      ].join('\n')
    },
    longest: {
      pseudo: [
        'procedure longestUnique(s)',
        '  count ← empty table;  l ← 0;  best ← 0   // @init',
        '  for r from 0 to n − 1                    // @loop',
        '    count[s[r]] ← count[s[r]] + 1          // @add',
        '    while count[s[r]] > 1                  // @dup',
        '      count[s[l]] ← count[s[l]] − 1        // @shrink',
        '      l ← l + 1                            // @shrink',
        '    best ← max(best, r − l + 1)            // @update',
        '  return best                              // @ret'
      ].join('\n'),
      js: [
        'function longestUnique(s) {',
        '  const count = new Map();               // @init',
        '  let l = 0, best = 0;                   // @init',
        '  for (let r = 0; r < s.length; r++) {   // @loop',
        '    const c = s[r];                      // @add',
        '    count.set(c, (count.get(c) || 0) + 1); // @add',
        '    while (count.get(c) > 1) {           // @dup',
        '      count.set(s[l], count.get(s[l]) - 1); // @shrink',
        '      l++;                               // @shrink',
        '    }',
        '    best = Math.max(best, r - l + 1);    // @update',
        '  }',
        '  return best;                           // @ret',
        '}'
      ].join('\n'),
      py: [
        'def longest_unique(s):',
        '    count = {}                           # @init',
        '    l = best = 0                         # @init',
        '    for r, c in enumerate(s):            # @loop',
        '        count[c] = count.get(c, 0) + 1   # @add',
        '        while count[c] > 1:              # @dup',
        '            count[s[l]] -= 1             # @shrink',
        '            l += 1                       # @shrink',
        '        best = max(best, r - l + 1)      # @update',
        '    return best                          # @ret'
      ].join('\n')
    },
    prefix: {
      pseudo: [
        'procedure buildPrefix(a)',
        '  P[0] ← 0                           // @init',
        '  for i from 0 to n − 1              // @loop',
        '    P[i + 1] ← P[i] + a[i]           // @build',
        '  return P',
        '',
        'procedure rangeSum(P, l, r)          // sum of a[l..r]',
        '  return P[r + 1] − P[l]             // @query'
      ].join('\n'),
      js: [
        'function buildPrefix(a) {',
        '  const P = [0];                     // @init',
        '  for (let i = 0; i < a.length; i++) {  // @loop',
        '    P.push(P[i] + a[i]);             // @build',
        '  }',
        '  return P;',
        '}',
        '',
        'function rangeSum(P, l, r) {',
        '  return P[r + 1] - P[l];            // @query',
        '}'
      ].join('\n'),
      py: [
        'def build_prefix(a):',
        '    P = [0]                          # @init',
        '    for i in range(len(a)):          # @loop',
        '        P.append(P[i] + a[i])        # @build',
        '    return P',
        '',
        'def range_sum(P, l, r):',
        '    return P[r + 1] - P[l]           # @query'
      ].join('\n')
    }
  };

  return {
    LIMITS: LIMITS, isSorted: isSorted, charInfo: charInfo,
    concatSteps: concatSteps, concatCost: concatCost,
    palindrome: palindrome, twoSum: twoSum, twoSumTrace: twoSumTrace, bruteTrace: bruteTrace, ruledOut: ruledOut,
    reverse: reverse, dedupe: dedupe, windowFixed: windowFixed, windowLongest: windowLongest,
    prefixSums: prefixSums, anagram: anagram, ops: ops, CODE: CODE
  };
}));
