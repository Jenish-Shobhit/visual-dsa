/* String matching: pure step generators for lesson 36 (no DOM). UMD: in the browser they attach to
   VDSA.algos.stringMatch; in Node the module exports the same API.

     naive(text, pat, opts)          -> steps   slide the pattern one place at a time
     kmp(text, pat, opts)            -> steps   Knuth-Morris-Pratt search using the failure table
     prefixSteps(pat, opts)          -> steps   building the failure table (the pattern compared against itself)
     rabinKarp(text, pat, opts)      -> steps   rolling hash; opts {base: 10, mod: 13}
     zSteps(pat, text, opts)         -> steps   Z-array of pat + '#' + text with the sliding Z-box
     boyerMoore(text, pat, opts)     -> steps   bad-character rule only (right-to-left comparison)
     prefixTable(pat)                -> [pi]    pi[i] = length of the longest proper border of pat[0..i]
     zArray(s)                       -> [z]     z[i] = length of the longest common prefix of s and s[i..]
     find(text, pat)                 -> [start] every occurrence (overlapping), reference implementation
     count.naive / count.kmp / count.rabinKarp / count.z (text, pat, opts) -> counters without building steps
     CODE.{naive,kmp,prefix,rk,z}    -> {pseudo, js, py} with // @label / # @label lines matching step.line

   opts.countOnly: return the final counters instead of steps (used by the charts, so no snapshots are built).

   Every step is a complete snapshot for the lesson's match view (js/lessons/36-string-matching-view.js):
     { algo, kind, text, pat, offset,                 pattern p[j] sits under text column offset + j
       tStates: {textIndex: state}, pStates: {patIndex: state},
       cmp: {t, p, state} | null,                     the pair being compared (a link between the two cells)
       ghost: offset | null,                          where the pattern was before it moved
       table: {label, values, under: 'pat'|'text', states, active} | null,
       bands: [{from, to, state, label, dashed}], arrows: [{from: {row, index}, to: {row, index}, label, state}],
       pointers: [{name, row: 'text'|'pat', index, state}], clip: bool,
       hash: {...} (Rabin-Karp only),
       caption, line, flow, vars, counters, work, matches }
   Truth rules (tested): a cell is 'found' only when the two characters it shows really are equal, 'done' only
   inside a confirmed occurrence, and counters never decrease. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.stringMatch = Object.assign(V.algos.stringMatch || {}, api);
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ small helpers */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function code(c) { return '<code>' + esc(c) + '</code>'; }
  function quoted(c) { return '<code>' + esc(c) + '</code>'; }
  function rangeStates(map, from, to, state) { for (var q = from; q <= to; q++) map[q] = state; return map; }
  function val(c) { return c.charCodeAt(0) - 96; }          // a = 1 ... z = 26
  function mod(x, q) { return ((x % q) + q) % q; }

  /* Reference: every occurrence, overlapping ones included. */
  function find(text, pat) {
    var out = [];
    if (!pat.length) return out;
    for (var s = 0; s + pat.length <= text.length; s++) if (text.substr(s, pat.length) === pat) out.push(s);
    return out;
  }

  /* pi[i] = length of the longest proper prefix of pat[0..i] that is also its suffix (a "border"). */
  function prefixTable(p) {
    var pi = [], i = 1, k = 0, cmp = 0;
    if (p.length) pi[0] = 0;
    while (i < p.length) {
      cmp++;
      if (p[i] === p[k]) { k++; pi[i] = k; i++; }
      else if (k > 0) k = pi[k - 1];
      else { pi[i] = 0; i++; }
    }
    prefixTable.lastComparisons = cmp;
    return pi;
  }
  function prefixCost(p) { prefixTable(p); return prefixTable.lastComparisons; }

  function zArray(s) {
    var n = s.length, z = [], l = 0, r = 0, i, k;
    for (i = 0; i < n; i++) z.push(0);
    for (i = 1; i < n; i++) {
      if (i < r && z[i - l] < r - i) z[i] = z[i - l];
      else {
        k = Math.max(0, r - i);
        while (i + k < n && s[k] === s[i + k]) k++;
        z[i] = k; l = i; r = i + k;
      }
    }
    if (n) z[0] = n;
    return z;
  }

  /* ------------------------------------------------------------------ a tiny snapshot builder */
  function Tracer(algo, text, pat, want) {
    var t = { algo: algo, text: text, pat: pat, want: want, steps: want ? [] : null, done: {}, matches: [], c: {} };
    t.push = function (kind, o) {
      if (!t.steps) return;
      var ts = {}, k;
      for (k in t.done) ts[k] = 'done';
      if (o.t) for (k in o.t) ts[k] = o.t[k];
      var counters = {};
      for (k in t.c) counters[k] = t.c[k];
      t.steps.push({
        algo: algo, kind: kind, text: text, pat: o.pat === undefined ? pat : o.pat, offset: o.offset === undefined ? null : o.offset,
        tStates: ts, pStates: o.p || {}, cmp: o.cmp || null, ghost: o.ghost === undefined ? null : o.ghost,
        table: o.table || null, bands: o.bands || [], arrows: o.arrows || [], pointers: o.pointers || [],
        clip: !!o.clip, hash: o.hash || null, pulse: o.pulse || null,
        caption: o.caption, line: o.line === undefined ? null : o.line, flow: o.flow || null,
        vars: o.vars || {}, varStates: o.varStates || undefined,
        counters: counters, work: o.work === undefined ? 0 : o.work, matches: t.matches.slice()
      });
    };
    return t;
  }

  /* ================================================================== naive */
  function naive(text, pat, opts) {
    opts = opts || {};
    var n = text.length, m = pat.length;
    var T = Tracer('naive', text, pat, !opts.countOnly);
    var c = T.c; c.comparisons = 0; c.shifts = 0;
    function work() { return c.comparisons; }
    if (n < m || !m) {
      T.push('start', { offset: 0, line: 'align', flow: 'start', vars: { s: 0, j: 0, matches: [] }, work: 0,
        caption: m ? 'The pattern (' + m + ' characters) is longer than the text (' + n + '), so it cannot fit at any alignment.' : 'Type a pattern to search for.' });
      return opts.countOnly ? c : T.steps;
    }
    T.push('start', { offset: 0, line: 'align', flow: 'start', vars: { s: 0, j: 0, matches: [] }, work: 0,
      caption: 'The pattern ' + code(pat) + ' sits under the start of the text. Naive search checks it character by character, left to right, and slides it one place after every failure.' });
    for (var s = 0; s + m <= n; s++) {
      if (s > 0) {
        c.shifts++;
        T.push('slide', { offset: s, ghost: s - 1, line: 'align', flow: 'next', work: work(), vars: { s: s, j: 0, matches: T.matches.slice() },
          caption: 'Slide the pattern one place right, to alignment ' + s + ', and restart at <code>pat[0]</code>. Whatever the last alignment learned is thrown away, so characters get compared again.' });
      }
      var j = 0;
      while (j < m) {
        var ok = text[s + j] === pat[j];
        c.comparisons++;
        if (T.steps) {
          var t = {}, p = {};
          rangeStates(t, s, s + j - 1, 'found'); rangeStates(p, 0, j - 1, 'found');
          t[s + j] = ok ? 'found' : 'error'; p[j] = ok ? 'found' : 'error';
          var cap;
          if (ok) cap = '<code>text[' + (s + j) + ']</code> = ' + quoted(text[s + j]) + ' equals <code>pat[' + j + ']</code>. ' + (j === m - 1 ? 'That was the last pattern character.' : 'This alignment is still alive, so check the next pair.');
          else cap = '<code>text[' + (s + j) + ']</code> = ' + quoted(text[s + j]) + ' but <code>pat[' + j + ']</code> = ' + quoted(pat[j]) + '. ' + (j === 0 ? 'The first character already differs, so this alignment is dead.' : 'One wrong character kills the alignment, and the ' + j + ' matched character' + (j > 1 ? 's are' : ' is') + ' forgotten.');
          T.push('cmp', { offset: s, t: t, p: p, cmp: { t: s + j, p: j, state: ok ? 'found' : 'error' }, line: ok ? ['cmp', 'adv'] : 'cmp', flow: ok ? 'adv' : 'cmp', work: work(),
            vars: { s: s, j: j, 'text[s+j]': text[s + j], 'pat[j]': pat[j] }, varStates: { 'text[s+j]': ok ? 'found' : 'error', 'pat[j]': ok ? 'found' : 'error' }, caption: cap });
        }
        if (!ok) break;
        j++;
      }
      if (j === m) {
        T.matches.push(s);
        for (var q = 0; q < m; q++) T.done[s + q] = true;
        if (T.steps) {
          var pf = {}; rangeStates(pf, 0, m - 1, 'found');
          T.push('found', { offset: s, p: pf, line: 'found', flow: 'report', work: work(), vars: { s: s, j: m, matches: T.matches.slice() },
            caption: 'All ' + m + ' characters match, so <b>the pattern occurs at index ' + s + '</b>. Naive search records it and slides on by one place, so overlapping matches are found too.' });
        }
      }
    }
    var worst = (n - m + 1) * m;
    T.push('end', { offset: null, pat: null, line: null, flow: 'done', work: work(), vars: { matches: T.matches.slice() },
      caption: 'Every alignment has been tried: ' + (T.matches.length ? '<b>' + T.matches.length + ' match' + (T.matches.length > 1 ? 'es' : '') + '</b> (index ' + T.matches.join(', ') + ')' : '<b>no match</b>') + ', using ' + c.comparisons + ' comparisons. The most naive search can ever need here is ' + (n - m + 1) + ' alignments × ' + m + ' = ' + worst + '.' });
    return opts.countOnly ? c : T.steps;
  }

  /* ================================================================== KMP search */
  function kmp(text, pat, opts) {
    opts = opts || {};
    var n = text.length, m = pat.length;
    var T = Tracer('kmp', text, pat, !opts.countOnly);
    var c = T.c; c.comparisons = 0; c.shifts = 0;
    var tableCost = prefixCost(pat);
    var pi = prefixTable(pat);
    function work() { return tableCost + c.comparisons; }
    var table = function (states) { return { label: 'π', values: pi, under: 'pat', states: states || {}, active: null }; };
    if (n < m || !m) {
      T.push('start', { offset: 0, table: table(), line: 'table', flow: 'start', work: tableCost, vars: { i: 0, j: 0, matches: [] },
        caption: m ? 'The pattern (' + m + ' characters) is longer than the text (' + n + '), so it cannot occur.' : 'Type a pattern to search for.' });
      return opts.countOnly ? { comparisons: c.comparisons, shifts: c.shifts, tableCost: tableCost, work: tableCost } : T.steps;
    }
    var i = 0, j = 0;
    function ptrs(ii, jj, sj) { return [{ name: 'i', row: 'text', index: ii, state: 'active' }, { name: 'j', row: 'pat', index: jj, state: sj || 'active' }]; }
    T.push('start', { offset: 0, table: table(), pointers: ptrs(0, 0), line: 'table', flow: 'start', work: tableCost, vars: { i: 0, j: 0, matches: [] },
      caption: 'First build the failure table <b>π</b> from the pattern alone (the next figure shows how; it costs at most ' + (2 * m) + ' comparisons). <code>π[k]</code> says how much of the pattern still matches after a failure at position ' + '<code>k + 1</code>. The text pointer <code>i</code> will never move left.' });
    while (i < n) {
      var ok = text[i] === pat[j];
      c.comparisons++;
      if (T.steps) {
        var t = {}, p = {};
        rangeStates(t, i - j, i - 1, 'found'); rangeStates(p, 0, j - 1, 'found');
        t[i] = ok ? 'found' : 'error'; p[j] = ok ? 'found' : 'error';
        var cap;
        if (ok) cap = '<code>text[' + i + ']</code> = ' + quoted(text[i]) + ' equals <code>pat[' + j + ']</code>, so ' + (j + 1) + ' pattern character' + (j ? 's' : '') + ' match now. Both pointers move right.';
        else cap = '<code>text[' + i + ']</code> = ' + quoted(text[i]) + ' ≠ <code>pat[' + j + ']</code> = ' + quoted(pat[j]) + '. ' + (j > 0 ? 'The ' + j + ' green characters are known text, and the table will tell us how much of them the pattern can keep.' : 'Nothing has matched yet, so there is nothing to reuse.');
        T.push('cmp', { offset: i - j, t: t, p: p, cmp: { t: i, p: j, state: ok ? 'found' : 'error' }, table: table(), pointers: ptrs(i, j, ok ? 'found' : 'error'),
          line: ok ? ['cmp', 'adv'] : (j > 0 ? 'cmp' : 'cmp'), flow: ok ? 'adv' : 'cmp', work: work(),
          vars: { i: i, j: j, 'text[i]': text[i], 'pat[j]': pat[j] }, varStates: { 'text[i]': ok ? 'found' : 'error', 'pat[j]': ok ? 'found' : 'error' }, caption: cap });
      }
      if (ok) {
        i++; j++;
        if (j === m) {
          T.matches.push(i - m);
          for (var q = 0; q < m; q++) T.done[i - m + q] = true;
          if (T.steps) {
            var pf = {}; rangeStates(pf, 0, m - 1, 'found');
            T.push('found', { offset: i - m, p: pf, table: table(), pointers: ptrs(i, j - 1, 'found'), line: 'found', flow: 'adv', work: work(), vars: { i: i, j: j, matches: T.matches.slice() },
              caption: 'The whole pattern matched: <b>an occurrence starts at index ' + (i - m) + '</b>. Do not restart: the pattern\'s own border may already be the beginning of the next occurrence.' });
          }
          if (i < n) {
            var kk = pi[m - 1], oldOff = i - m;
            c.shifts++; j = kk;
            if (T.steps) {
              var tj = {}, pj = {};
              rangeStates(tj, i - kk, i - 1, 'found'); rangeStates(pj, 0, kk - 1, 'found');
              T.push('jump', { offset: i - kk, ghost: oldOff, t: tj, p: pj, table: table(rangeStates({}, m - 1, m - 1, 'key')),
                arrows: [{ from: { row: 'table', index: m - 1 }, to: { row: 'pat', index: kk }, label: 'π[' + (m - 1) + '] = ' + kk, state: 'key' }],
                pointers: ptrs(i, kk), line: 'fall', flow: 'adv', work: work(), vars: { i: i, j: kk, matches: T.matches.slice() },
                caption: '<code>π[' + (m - 1) + '] = ' + kk + '</code>: the last ' + kk + ' matched character' + (kk === 1 ? ' is' : 's are') + ' also the pattern\'s first ' + kk + ', so the pattern slides ' + (m - kk) + ' place' + (m - kk > 1 ? 's' : '') + ' and resumes at <code>pat[' + kk + ']</code> without re-reading the text.' });
            }
          }
        }
      } else if (j > 0) {
        var k2 = pi[j - 1], old = i - j;
        c.shifts++;
        var oj = j; j = k2;
        if (T.steps) {
          var t2 = {}, p2 = {};
          rangeStates(t2, i - k2, i - 1, 'found'); rangeStates(p2, 0, k2 - 1, 'found');
          t2[i] = 'compare';
          T.push('jump', { offset: i - j, ghost: old, t: t2, p: p2, table: table(rangeStates({}, oj - 1, oj - 1, 'key')),
            arrows: [{ from: { row: 'table', index: oj - 1 }, to: { row: 'pat', index: k2 }, label: 'π[' + (oj - 1) + '] = ' + k2, state: 'key' }],
            pointers: ptrs(i, j), line: ['jumpq', 'jump'], flow: 'jump', work: work(), vars: { i: i, j: j, matches: T.matches.slice() },
            caption: '<code>π[' + (oj - 1) + '] = ' + k2 + '</code>: of the ' + oj + ' matched characters, the last ' + k2 + ' equal the pattern\'s first ' + k2 + '. Slide the pattern ' + (oj - k2) + ' place' + (oj - k2 > 1 ? 's' : '') + ' right and keep going from <code>pat[' + k2 + ']</code>. The alignments in between cannot match, and <code>text[' + i + ']</code> is not re-read.' });
        }
      } else {
        i++;
        if (i < n) {
          c.shifts++;
          T.push('skip', { offset: i, ghost: i - 1, table: table(), pointers: ptrs(i, 0), line: 'skip', flow: 'skip', work: work(), vars: { i: i, j: 0, matches: T.matches.slice() },
            caption: 'With <code>j = 0</code> the failed text character cannot start a match, so only the text pointer moves: the pattern slides one place right.' });
        }
      }
    }
    T.push('end', { offset: null, pat: null, table: null, line: null, flow: 'done', work: work(), vars: { matches: T.matches.slice() },
      caption: 'The text pointer reached the end: ' + (T.matches.length ? '<b>' + T.matches.length + ' match' + (T.matches.length > 1 ? 'es' : '') + '</b> (index ' + T.matches.join(', ') + ')' : '<b>no match</b>') + ' with ' + c.comparisons + ' comparisons on a text of ' + n + ' characters. <code>i</code> only ever moved right, so this can never exceed 2n = ' + (2 * n) + '.' });
    return opts.countOnly ? { comparisons: c.comparisons, shifts: c.shifts, tableCost: tableCost, work: work() } : T.steps;
  }

  /* ================================================================== the failure-table builder */
  function prefixSteps(p, opts) {
    opts = opts || {};
    var m = p.length;
    var T = Tracer('prefix', p, p, !opts.countOnly);
    var c = T.c; c.comparisons = 0; c.fallbacks = 0;
    var pi = [];
    if (m) pi[0] = 0;
    function tbl(active, states) {
      var vals = [];
      for (var q = 0; q < m; q++) vals.push(q < pi.length ? pi[q] : null);
      return { label: 'π', values: vals, under: 'text', states: states || {}, active: active === undefined ? null : active };
    }
    if (!m) { T.push('start', { offset: null, pat: null, caption: 'Type a pattern to build its table.', vars: {} }); return opts.countOnly ? c : T.steps; }
    var i = 1, k = 0;
    function ptrs(ii, kk, sk) { return [{ name: 'i', row: 'text', index: ii, state: 'active' }, { name: 'k', row: 'pat', index: kk, state: sk || 'active' }]; }
    var doneP = function () { var o = {}; return o; };
    if (m === 1) {
      T.push('start', { offset: null, pat: null, table: tbl(undefined, { 0: 'done' }), line: 'start', vars: { i: 1, k: 0, pi: pi.slice() },
        caption: 'A one-character pattern has only the empty border: <code>π[0] = 0</code>. There is nothing else to compute.' });
      return opts.countOnly ? c : T.steps;
    }
    T.push('start', { offset: 1, pat: p, clip: true, table: tbl(undefined, { 0: 'done' }), pointers: ptrs(1, 0), line: 'start', vars: { i: 1, k: 0, pi: pi.slice() },
      caption: 'The pattern is compared <b>against itself</b>: the top row is the pattern as text, the lower row is a second copy. <code>π[i]</code> is the length of the longest proper prefix of <code>p[0..i]</code> that is also its suffix. A single character has no proper border, so <code>π[0] = 0</code>.' });
    while (i < m) {
      var ok = p[i] === p[k];
      c.comparisons++;
      if (T.steps) {
        var t = {}, q = {};
        rangeStates(t, i - k, i - 1, 'found'); rangeStates(q, 0, k - 1, 'found');
        t[i] = ok ? 'found' : 'error'; q[k] = ok ? 'found' : 'error';
        T.push('cmp', { offset: i - k, pat: p, clip: true, t: t, p: q, cmp: { t: i, p: k, state: ok ? 'found' : 'error' }, table: tbl(i, { }), pointers: ptrs(i, k, ok ? 'found' : 'error'),
          line: 'cmp', flow: 'cmp', vars: { i: i, k: k, 'p[i]': p[i], 'p[k]': p[k], pi: pi.slice() }, varStates: { 'p[i]': ok ? 'found' : 'error', 'p[k]': ok ? 'found' : 'error' },
          caption: ok ? 'The current border has length ' + k + ' and <code>p[' + i + ']</code> = ' + quoted(p[i]) + ' equals <code>p[' + k + ']</code>: the border can grow by one.'
            : (k > 0 ? '<code>p[' + i + ']</code> = ' + quoted(p[i]) + ' ≠ <code>p[' + k + ']</code> = ' + quoted(p[k]) + ': the border of length ' + k + ' cannot be extended. The next-longest border is already in the table.'
              : '<code>p[' + i + ']</code> = ' + quoted(p[i]) + ' ≠ <code>p[0]</code> = ' + quoted(p[0]) + ' and no border is left to fall back to.') });
      }
      if (ok) {
        k++; pi[i] = k;
        if (T.steps) {
          var t2 = {}, q2 = {};
          rangeStates(t2, i - k + 1, i, 'done'); rangeStates(q2, 0, k - 1, 'done');
          T.push('set', { offset: i - k + 1, pat: p, clip: true, t: t2, p: q2, table: tbl(i, rangeStates({}, i, i, 'done')), pointers: ptrs(i, k - 1, 'done'), line: 'ext', flow: 'ext',
            vars: { i: i, k: k, pi: pi.slice() }, pulse: 'set' + i,
            caption: '<code>π[' + i + '] = ' + k + '</code>: the prefix ' + quoted(p.slice(0, k)) + ' (lower row) is also the suffix of <code>p[0..' + i + ']</code> (top row). The longest border of ' + quoted(p.slice(0, i + 1)) + ' has length ' + k + '.' });
        }
        i++;
      } else if (k > 0) {
        var newk = pi[k - 1], oldk = k;
        c.fallbacks++;
        k = newk;
        if (T.steps) {
          var t3 = {}, q3 = {};
          rangeStates(t3, i - k, i - 1, 'found'); rangeStates(q3, 0, k - 1, 'found');
          T.push('fallback', { offset: i - k, ghost: i - oldk, pat: p, clip: true, t: t3, p: q3, table: tbl(i, rangeStates({}, oldk - 1, oldk - 1, 'key')),
            arrows: [{ from: { row: 'table', index: oldk - 1 }, to: { row: 'pat', index: k }, label: 'π[' + (oldk - 1) + '] = ' + k, state: 'key' }],
            pointers: ptrs(i, k), line: 'fallback', flow: 'fallback', vars: { i: i, k: k, pi: pi.slice() },
            caption: 'Fall back: <code>π[' + (oldk - 1) + '] = ' + k + '</code> is the next-longest border of the matched part, so slide the lower copy to keep only ' + k + ' character' + (k === 1 ? '' : 's') + ' aligned and compare again.' });
        }
      } else {
        pi[i] = 0;
        if (T.steps) {
          T.push('set', { offset: i, pat: p, clip: true, t: rangeStates({}, i, i, 'error'), p: rangeStates({}, 0, 0, 'error'), table: tbl(i, rangeStates({}, i, i, 'done')), pointers: ptrs(i, 0), line: 'zero', flow: 'zero',
            vars: { i: i, k: 0, pi: pi.slice() }, pulse: 'set' + i,
            caption: '<code>π[' + i + '] = 0</code>: no proper prefix of the pattern is a suffix of <code>p[0..' + i + ']</code>, because even the single character ' + quoted(p[i]) + ' differs from ' + quoted(p[0]) + '.' });
        }
        i++;
      }
    }
    var allS = {};
    for (var z = 0; z < m; z++) allS[z] = 'done';
    T.push('end', { offset: null, pat: null, table: tbl(undefined, {}), line: null, vars: { pi: pi.slice() },
      caption: 'The table is complete: <b>π = [' + pi.join(', ') + ']</b>, built with ' + c.comparisons + ' comparisons for a pattern of ' + m + ' characters (never more than 2m). The pointer <code>i</code> only moved right, and <code>k</code> can only fall as far as it has risen.' });
    return opts.countOnly ? c : T.steps;
  }

  /* ================================================================== Rabin-Karp */
  function rabinKarp(text, pat, opts) {
    opts = opts || {};
    var B = opts.base || 10, Q = opts.mod || 13;
    var n = text.length, m = pat.length;
    var T = Tracer('rk', text, pat, !opts.countOnly);
    var c = T.c; c.windows = 0; c.hits = 0; c.spurious = 0; c.comparisons = 0;
    var ticks = 0;                       // work: characters read into a hash, rolling updates, verification comparisons
    if (n < m || !m) {
      T.push('start', { offset: 0, line: 'init', vars: { matches: [] }, caption: m ? 'The pattern (' + m + ' characters) is longer than the text (' + n + ').' : 'Type a pattern to search for.' });
      return opts.countOnly ? { windows: 0, hits: 0, spurious: 0, comparisons: 0, work: 0 } : T.steps;
    }
    var P = 1, ii;
    for (ii = 1; ii < m; ii++) P = (P * B) % Q;
    function horner(str) { var h = 0; for (var q = 0; q < str.length; q++) h = (h * B + val(str[q])) % Q; return h; }
    function digitsOf(str) { return str.split('').map(function (ch) { return ch + '=' + val(ch); }).join(', '); }
    function poly(str) {
      var parts = [], total = 0;
      for (var q = 0; q < str.length; q++) { var pw = str.length - 1 - q; parts.push(val(str[q]) + (pw ? '·' + B + (pw > 1 ? '^' + pw : '') : '')); total = total * B + val(str[q]); }
      return { expr: parts.join(' + '), total: total };
    }
    var hp = horner(pat), h;
    function hs(o) { return Object.assign({ B: B, q: Q, P: P, hp: hp, h: h === undefined ? null : h, phase: 'idle' }, o); }
    T.push('start', { offset: 0, line: 'init', work: 0, hash: hs({ h: null, phase: 'idle' }), vars: { B: B, q: Q, P: P, matches: [] },
      caption: 'Rabin–Karp turns every window of ' + m + ' characters into one small number, its <b>hash</b>. It reads each letter as a digit (<code>a = 1, b = 2, …</code>) in base ' + B + ', works modulo <code>q = ' + Q + '</code> so the numbers stay small, and compares numbers instead of strings.' });
    ticks += m; var pp = poly(pat);
    T.push('patHash', { offset: 0, line: 'hash', work: ticks, hash: hs({ phase: 'pattern', h: null, expr: pp.expr, total: pp.total }), vars: { B: B, q: Q, P: P, 'pattern hash': hp, matches: [] },
      caption: 'Hash the pattern once: ' + digitsOf(pat) + ', so it reads as ' + pp.expr + ' = ' + pp.total + ', and ' + pp.total + ' mod ' + Q + ' = <b>' + hp + '</b>. Any window with a different hash is certainly a different string.' });
    ticks += m; h = horner(text.slice(0, m)); var wp = poly(text.slice(0, m));
    c.windows++;
    var bandOf = function (s, state, label) { return [{ from: s, to: s + m - 1, state: state, label: label || '' }]; };
    T.push('winHash', { offset: 0, bands: bandOf(0, 'active', 'window'), line: 'hash', work: ticks, hash: hs({ phase: 'window', expr: wp.expr, total: wp.total }), vars: { s: 0, 'window hash': h, 'pattern hash': hp, matches: [] },
      caption: 'Hash the first window ' + quoted(text.slice(0, m)) + ' the same way: ' + wp.expr + ' = ' + wp.total + ', and ' + wp.total + ' mod ' + Q + ' = <b>' + h + '</b>. From here on every new window costs one small update, not ' + m + ' character reads.' });
    for (var s = 0; s + m <= n; s++) {
      var hit = h === hp;
      if (hit) c.hits++;
      T.push('hashcmp', { offset: s, bands: bandOf(s, hit ? 'compare' : 'active', 'window'), line: 'cmp', flow: 'cmp', work: ticks, hash: hs({ phase: 'compare', hit: hit }),
        vars: { s: s, 'window hash': h, 'pattern hash': hp, matches: T.matches.slice() }, varStates: { 'window hash': hit ? 'found' : 'default' },
        caption: hit ? 'Window hash <b>' + h + '</b> = pattern hash <b>' + hp + '</b>: a <b>hash hit</b>. Equal hashes do not prove equal strings (different strings can share a hash), so the characters must be checked.'
          : 'Window hash <b>' + h + '</b> ≠ pattern hash <b>' + hp + '</b>. Different hashes prove the strings differ, so this window is discarded without reading a single character.' });
      if (hit) {
        var j = 0, allOk = true;
        while (j < m) {
          var ok = text[s + j] === pat[j];
          c.comparisons++; ticks++;
          if (T.steps) {
            var t = {}, p = {};
            rangeStates(t, s, s + j - 1, 'found'); rangeStates(p, 0, j - 1, 'found');
            t[s + j] = ok ? 'found' : 'error'; p[j] = ok ? 'found' : 'error';
            T.push('verify', { offset: s, bands: bandOf(s, 'compare', 'window'), t: t, p: p, cmp: { t: s + j, p: j, state: ok ? 'found' : 'error' }, line: 'verify', flow: 'verify', work: ticks, hash: hs({ phase: 'verify', hit: true }),
              vars: { s: s, j: j, 'window hash': h, 'pattern hash': hp, matches: T.matches.slice() },
              caption: ok ? 'Verify: <code>text[' + (s + j) + ']</code> = ' + quoted(text[s + j]) + ' equals <code>pat[' + j + ']</code>.'
                : '<code>text[' + (s + j) + ']</code> = ' + quoted(text[s + j]) + ' ≠ <code>pat[' + j + ']</code> = ' + quoted(pat[j]) + '. The hashes agreed but the strings differ.' });
          }
          if (!ok) { allOk = false; break; }
          j++;
        }
        if (allOk) {
          T.matches.push(s);
          for (var q = 0; q < m; q++) T.done[s + q] = true;
          if (T.steps) {
            var pf = {}; rangeStates(pf, 0, m - 1, 'found');
            T.push('verified', { offset: s, bands: bandOf(s, 'done', 'match'), p: pf, line: 'verify', flow: 'report', work: ticks, hash: hs({ phase: 'verified', hit: true }), pulse: 'ok' + s,
              vars: { s: s, matches: T.matches.slice() }, caption: 'All ' + m + ' characters agree: <b>a verified match at index ' + s + '</b>. The hash gave the candidate, the character check confirmed it.' });
          }
        } else {
          c.spurious++;
          T.push('spurious', { offset: s, bands: bandOf(s, 'error', 'spurious'), line: 'verify', flow: 'verify', work: ticks, hash: hs({ phase: 'spurious', hit: true }), pulse: 'bad' + s,
            vars: { s: s, matches: T.matches.slice() }, caption: '<b>Spurious hit.</b> Both windows hash to ' + h + ' by coincidence, a <em>collision</em>. Verification caught it. With a larger modulus these become rare, and the hash test almost always settles a window on its own.' });
        }
      }
      if (s + m < n) {
        var lead = text[s], trail = text[s + m], lv = val(lead), tv = val(trail);
        var sub = mod(h - lv * P, Q), mul = mod(sub * B, Q), add = mod(mul + tv, Q);
        ticks++; c.windows++;
        var base = { lead: lead, trail: trail, lv: lv, tv: tv, prev: h, sub: sub, mul: mul, add: add };
        if (T.steps) {
          T.push('rollSub', { offset: s, bands: bandOf(s, 'active', 'window'), t: rangeStates({}, s, s, 'swap'), line: 'roll', flow: 'roll', work: ticks - 1, hash: hs(Object.assign({ phase: 'sub' }, base)),
            vars: { s: s, 'window hash': h, lead: lead, trail: trail, matches: T.matches.slice() },
            caption: '<b>Subtract the leading letter.</b> ' + quoted(lead) + ' (value ' + lv + ') is about to leave the window, and it sits in the highest digit, worth ' + lv + ' × ' + P + ' (where <code>' + B + '^' + (m - 1) + '</code> mod ' + Q + ' = ' + P + '). ' + h + ' − ' + (lv * P) + ' ≡ <b>' + sub + '</b> (mod ' + Q + ').' });
          T.push('rollMul', { offset: s, bands: bandOf(s, 'active', 'window'), t: rangeStates({}, s, s, 'swap'), line: 'roll', flow: 'roll', work: ticks - 1, hash: hs(Object.assign({ phase: 'mul' }, base)),
            vars: { s: s, 'window hash': sub, lead: lead, trail: trail, matches: T.matches.slice() },
            caption: '<b>Multiply by the base.</b> Every remaining digit moves one place up, to make room for the new letter at the bottom: ' + sub + ' × ' + B + ' = ' + (sub * B) + ' ≡ <b>' + mul + '</b> (mod ' + Q + ').' });
        }
        h = add;
        if (T.steps) {
          T.push('rollAdd', { offset: s + 1, ghost: s, bands: bandOf(s + 1, 'active', 'window'), t: rangeStates({}, s + m, s + m, 'active'), line: 'roll', flow: 'roll', work: ticks, hash: hs(Object.assign({ phase: 'add' }, base, { h: h })),
            vars: { s: s + 1, 'window hash': h, lead: lead, trail: trail, matches: T.matches.slice() },
            caption: '<b>Add the trailing letter.</b> ' + quoted(trail) + ' (value ' + tv + ') enters the lowest digit: ' + mul + ' + ' + tv + ' = ' + (mul + tv) + ' ≡ <b>' + add + '</b> (mod ' + Q + '). One O(1) update produced the hash of ' + quoted(text.slice(s + 1, s + 1 + m)) + '.' });
        }
      }
    }
    T.push('end', { offset: null, pat: null, line: null, flow: 'done', work: ticks, hash: hs({ phase: 'idle', h: null }), vars: { matches: T.matches.slice() },
      caption: 'Done: ' + (T.matches.length ? '<b>' + T.matches.length + ' verified match' + (T.matches.length > 1 ? 'es' : '') + '</b> (index ' + T.matches.join(', ') + ')' : '<b>no match</b>') + '. ' + c.windows + ' windows were hashed, ' + c.hits + ' hash hit' + (c.hits === 1 ? '' : 's') + ', of which ' + c.spurious + ' spurious, and only ' + c.comparisons + ' characters were compared.' });
    return opts.countOnly ? { windows: c.windows, hits: c.hits, spurious: c.spurious, comparisons: c.comparisons, work: ticks } : T.steps;
  }

  /* ================================================================== Z algorithm */
  function zSteps(pat, text, opts) {
    opts = opts || {};
    text = text || '';
    var m = pat.length;
    var s = pat + '#' + text, n = s.length;
    var T = Tracer('z', s, s, !opts.countOnly);
    var c = T.c; c.comparisons = 0; c.copies = 0;
    var z = [], i, k;
    for (i = 0; i < n; i++) z.push(null);
    z[0] = '–';
    var l = 0, r = 0;
    function tbl(active, states) { return { label: 'Z', values: z.slice(), under: 'text', states: states || {}, active: active === undefined ? null : active }; }
    function boxBands(mirrorCopy) {
      if (r - l <= 0) return [];
      var b = [{ from: l, to: r - 1, state: 'active', label: 'Z-box [' + l + ', ' + r + ')' }];
      if (mirrorCopy) b.push({ from: 0, to: r - l - 1, state: 'active', label: 'same text', dashed: true });
      return b;
    }
    T.push('start', { offset: null, pat: null, clip: true, table: tbl(undefined, { 0: 'muted' }), line: 'start', vars: { l: 0, r: 0, z: [] },
      caption: 'Search for ' + quoted(pat) + ' in ' + quoted(text || '(empty)') + ' by gluing them into <code>s = pattern + "#" + text</code> (the <code>#</code> stops a match from crossing the seam). <code>Z[i]</code> is how many characters starting at <code>i</code> equal the beginning of <code>s</code>; wherever <code>Z[i] = ' + m + '</code>, the pattern occurs.' });
    for (i = 1; i < n; i++) {
      if (i < r && z[i - l] < r - i) {
        z[i] = z[i - l]; c.copies++;
        if (T.steps) {
          var t = rangeStates({}, i, i + z[i] - 1, 'found'), p = rangeStates({}, 0, z[i] - 1, 'found');
          var arr = [{ from: { row: 'table', index: i - l }, to: { row: 'table', index: i }, label: 'copy', state: 'key' }];
          var st = rangeStates({}, i - l, i - l, 'key'); st[i] = 'done';
          T.push('copy', { offset: i, pat: s, clip: true, t: t, p: p, table: tbl(i, st), bands: boxBands(true), arrows: arr, line: 'copy', flow: 'copy', pulse: 'z' + i, vars: { i: i, l: l, r: r, 'Z[i-l]': z[i], z: z.slice(0, i + 1) },
            caption: '<code>i = ' + i + '</code> lies inside the Z-box [' + l + ', ' + r + '). Its mirror <code>i − l = ' + (i - l) + '</code> has <code>Z = ' + z[i] + '</code>, and that match ends before the box does (' + z[i] + ' &lt; ' + (r - i) + '), so <b><code>Z[' + i + '] = ' + z[i] + '</code> with zero comparisons</b>.' });
        }
      } else {
        k = Math.max(0, r - i);
        if (T.steps) {
          var st0 = {}; st0[i] = 'compare';
          T.push('start_i', { offset: i, pat: s, clip: true, t: rangeStates({}, i, i + k - 1, 'found'), p: rangeStates({}, 0, k - 1, 'found'), table: tbl(i, st0), bands: boxBands(i < r), line: 'free', flow: 'free', vars: { i: i, l: l, r: r, k: k, z: z.slice(0, i) },
            caption: i < r ? '<code>i = ' + i + '</code> is inside the box, but its mirror\'s match reaches the box edge or beyond, so the first <b>' + k + '</b> character' + (k === 1 ? '' : 's') + ' are known to match for free. Only characters beyond <code>r</code> need checking.'
              : (i === r && r > 0 ? '<code>i = ' + i + '</code> is exactly at the end of the box: nothing is known, so compare from scratch.' : '<code>i = ' + i + '</code> is outside every box, so nothing is known: compare from the start of <code>s</code>.') });
        }
        while (i + k < n) {
          var ok = s[k] === s[i + k];
          c.comparisons++;
          if (T.steps) {
            var t2 = rangeStates({}, i, i + k - 1, 'found'), p2 = rangeStates({}, 0, k - 1, 'found');
            t2[i + k] = ok ? 'found' : 'error'; p2[k] = ok ? 'found' : 'error';
            var st2 = {}; st2[i] = 'compare';
            T.push('cmp', { offset: i, pat: s, clip: true, t: t2, p: p2, cmp: { t: i + k, p: k, state: ok ? 'found' : 'error' }, table: tbl(i, st2), bands: boxBands(i < r), line: 'cmp', flow: 'cmp',
              vars: { i: i, k: k, 's[k]': s[k], 's[i+k]': s[i + k], l: l, r: r, z: z.slice(0, i) }, varStates: { 's[k]': ok ? 'found' : 'error', 's[i+k]': ok ? 'found' : 'error' },
              caption: ok ? '<code>s[' + k + ']</code> = ' + quoted(s[k]) + ' equals <code>s[' + (i + k) + ']</code>: the match at <code>i</code> is now ' + (k + 1) + ' long.'
                : '<code>s[' + k + ']</code> = ' + quoted(s[k]) + ' ≠ <code>s[' + (i + k) + ']</code> = ' + quoted(s[i + k]) + ': the match stops after ' + k + ' character' + (k === 1 ? '' : 's') + '.' });
          }
          if (!ok) break;
          k++;
        }
        z[i] = k;
        var prevL = l, prevR = r;
        l = i; r = i + k;
        if (T.steps) {
          var st3 = {}; st3[i] = 'done';
          var isMatch = k === m && i > m;
          T.push('set', { offset: i, pat: s, clip: true, t: rangeStates({}, i, i + k - 1, 'found'), p: rangeStates({}, 0, k - 1, 'found'), table: tbl(i, st3), bands: boxBands(false), line: ['set', 'box'], flow: 'set', pulse: 'z' + i,
            vars: { i: i, l: l, r: r, z: z.slice(0, i + 1) },
            caption: '<code>Z[' + i + '] = ' + k + '</code>. ' + (k > 0 ? 'The new Z-box is [' + l + ', ' + r + '): <code>s[' + l + '..' + (r - 1) + ']</code> equals the start of <code>s</code>, and later positions can reuse it.' : 'Nothing matches at <code>' + i + '</code>, so the box is empty here.') + (isMatch ? ' <b>Z = ' + m + ' = pattern length: the pattern occurs in the text at index ' + (i - m - 1) + '.</b>' : '') });
        }
      }
    }
    for (i = 1; i < n; i++) if (z[i] === m && i > m) T.matches.push(i - m - 1);
    if (T.steps) {
      var st4 = {};
      T.matches.forEach(function (ms) { st4[ms + m + 1] = 'found'; for (var q = 0; q < m; q++) T.done[ms + m + 1 + q] = true; });
      T.push('end', { offset: null, pat: null, clip: true, table: tbl(undefined, st4), line: null, vars: { z: z.slice() },
        caption: 'The Z-array is complete after ' + c.comparisons + ' comparisons on a string of ' + n + ' characters (' + c.copies + ' positions were filled by copying). ' + (T.matches.length ? '<b>The pattern occurs at index ' + T.matches.join(', ') + '</b> of the text: those are the positions where Z equals ' + m + '.' : '<b>No position has Z = ' + m + '</b>, so the pattern does not occur.') });
    }
    return opts.countOnly ? { comparisons: c.comparisons, copies: c.copies, z: z } : T.steps;
  }

  /* ================================================================== Boyer-Moore bad character (simplified) */
  function boyerMoore(text, pat, opts) {
    opts = opts || {};
    var n = text.length, m = pat.length;
    var T = Tracer('bm', text, pat, !opts.countOnly);
    var c = T.c; c.comparisons = 0; c.shifts = 0;
    var last = {}, q;
    for (q = 0; q < m; q++) last[pat[q]] = q;
    var lastTxt = Object.keys(last).sort().map(function (ch) { return ch + ':' + last[ch]; }).join(' ');
    if (n < m || !m) { T.push('start', { offset: 0, vars: {}, caption: 'The pattern does not fit.' }); return opts.countOnly ? c : T.steps; }
    T.push('start', { offset: 0, vars: { s: 0, 'last index': VDSA_raw(lastTxt) },
      caption: 'Boyer–Moore compares the pattern <b>right to left</b>. It prepares a table of the last position of every pattern letter (' + esc(lastTxt) + '); on a mismatch, that table says how far the pattern can safely slide.' });
    var s = 0;
    while (s + m <= n) {
      var j = m - 1;
      while (j >= 0) {
        var ok = pat[j] === text[s + j];
        c.comparisons++;
        if (T.steps) {
          var t = {}, p = {};
          rangeStates(t, s + j + 1, s + m - 1, 'found'); rangeStates(p, j + 1, m - 1, 'found');
          t[s + j] = ok ? 'found' : 'error'; p[j] = ok ? 'found' : 'error';
          T.push('cmp', { offset: s, t: t, p: p, cmp: { t: s + j, p: j, state: ok ? 'found' : 'error' }, vars: { s: s, j: j },
            caption: ok ? '<code>pat[' + j + ']</code> = ' + quoted(pat[j]) + ' matches <code>text[' + (s + j) + ']</code>. Move one place left.' :
              '<code>pat[' + j + ']</code> = ' + quoted(pat[j]) + ' ≠ <code>text[' + (s + j) + ']</code> = ' + quoted(text[s + j]) + '. Look up ' + quoted(text[s + j]) + ' in the pattern.' });
        }
        if (!ok) break;
        j--;
      }
      var shift;
      if (j < 0) {
        T.matches.push(s);
        for (q = 0; q < m; q++) T.done[s + q] = true;
        shift = 1;
        if (T.steps) { var pf = rangeStates({}, 0, m - 1, 'found'); T.push('found', { offset: s, p: pf, vars: { s: s }, caption: 'Every character matched: <b>an occurrence at index ' + s + '</b>. (This simplified version then slides by one.)' }); }
      } else {
        var li = last[text[s + j]] === undefined ? -1 : last[text[s + j]];
        shift = Math.max(1, j - li);
        var mm = text[s + j];
        if (T.steps) {
          var ns = {}; ns[s + j] = 'compare';
          T.push('slide', { offset: s + shift, ghost: s, t: ns, vars: { s: s + shift, shift: shift },
            caption: li < 0 ? 'The letter ' + quoted(mm) + ' appears nowhere in the pattern, so no alignment that still covers it can work: slide the pattern <b>' + shift + '</b> place' + (shift > 1 ? 's' : '') + ', right past it.'
              : (j - li > 0 ? 'The letter ' + quoted(mm) + ' last appears at pattern index ' + li + '. Slide by ' + j + ' − ' + li + ' = <b>' + shift + '</b> so that occurrence lines up under the text letter.' : 'The last ' + quoted(mm) + ' in the pattern is to the right of the mismatch, so the safe slide is only <b>1</b>.') });
        }
      }
      c.shifts++;
      s += shift;
      if (j < 0 && T.steps && s + m <= n) T.push('slide', { offset: s, ghost: s - 1, vars: { s: s }, caption: 'Slide by one and continue.' });
    }
    T.push('end', { offset: null, pat: null, vars: { matches: T.matches.slice() }, caption: 'Finished: ' + (T.matches.length ? 'match at index ' + T.matches.join(', ') : 'no match') + ' with only ' + c.comparisons + ' comparisons on ' + n + ' characters; on ordinary text the bad-character rule often skips most of the text.' });
    return opts.countOnly ? c : T.steps;
  }
  function VDSA_raw(s) { return typeof window !== 'undefined' && window.VDSA && window.VDSA.vars && window.VDSA.vars.raw ? window.VDSA.vars.raw(s) : s; }

  /* ------------------------------------------------------------------ counters without snapshots */
  var count = {
    naive: function (t, p) { return naive(t, p, { countOnly: true }); },
    kmp: function (t, p) { return kmp(t, p, { countOnly: true }); },
    rabinKarp: function (t, p, o) { return rabinKarp(t, p, Object.assign({ countOnly: true }, o || {})); },
    z: function (p, t) { return zSteps(p, t, { countOnly: true }); }
  };

  /* ------------------------------------------------------------------ code for the labs */
  var CODE = {
    naive: {
      pseudo: [
        'procedure naiveSearch(text, pat)',
        '  for s ← 0 to n − m                    // @align',
        '    j ← 0',
        '    while j < m and text[s + j] = pat[j]   // @cmp',
        '      j ← j + 1                        // @adv',
        '    if j = m then report s             // @found',
        '  done                                 // @done'
      ].join('\n'),
      js: [
        'function naiveSearch(text, pat) {',
        '  const out = [];',
        '  for (let s = 0; s + pat.length <= text.length; s++) {   // @align',
        '    let j = 0;',
        '    while (j < pat.length && text[s + j] === pat[j]) {    // @cmp',
        '      j++;                                                // @adv',
        '    }',
        '    if (j === pat.length) out.push(s);                    // @found',
        '  }',
        '  return out;                                             // @done',
        '}'
      ].join('\n'),
      py: [
        'def naive_search(text, pat):',
        '    out = []',
        '    for s in range(len(text) - len(pat) + 1):   # @align',
        '        j = 0',
        '        while j < len(pat) and text[s + j] == pat[j]:   # @cmp',
        '            j += 1                              # @adv',
        '        if j == len(pat):                       # @found',
        '            out.append(s)                       # @found',
        '    return out                                  # @done'
      ].join('\n')
    },
    kmp: {
      pseudo: [
        'procedure kmpSearch(text, pat)',
        '  π ← prefixTable(pat)                 // @table',
        '  i ← 0;  j ← 0                        // @init',
        '  while i < n do                       // @loop',
        '    if text[i] = pat[j] then           // @cmp',
        '      i ← i + 1;  j ← j + 1            // @adv',
        '      if j = m then                    // @found',
        '        report i − m                   // @found',
        '        j ← π[j − 1]                   // @fall',
        '    else if j > 0 then                 // @jumpq',
        '      j ← π[j − 1]                     // @jump',
        '    else',
        '      i ← i + 1                        // @skip',
        '  done                                 // @done'
      ].join('\n'),
      js: [
        'function kmpSearch(text, pat) {',
        '  const pi = prefixTable(pat), out = [];      // @table',
        '  let i = 0, j = 0;                            // @init',
        '  while (i < text.length) {                    // @loop',
        '    if (text[i] === pat[j]) {                  // @cmp',
        '      i++; j++;                                // @adv',
        '      if (j === pat.length) {                  // @found',
        '        out.push(i - j);                       // @found',
        '        j = pi[j - 1];                         // @fall',
        '      }',
        '    } else if (j > 0) {                        // @jumpq',
        '      j = pi[j - 1];                           // @jump',
        '    } else {',
        '      i++;                                     // @skip',
        '    }',
        '  }',
        '  return out;                                  // @done',
        '}'
      ].join('\n'),
      py: [
        'def kmp_search(text, pat):',
        '    pi = prefix_table(pat)                # @table',
        '    out, i, j = [], 0, 0                  # @init',
        '    while i < len(text):                  # @loop',
        '        if text[i] == pat[j]:             # @cmp',
        '            i += 1; j += 1                # @adv',
        '            if j == len(pat):             # @found',
        '                out.append(i - j)         # @found',
        '                j = pi[j - 1]             # @fall',
        '        elif j > 0:                       # @jumpq',
        '            j = pi[j - 1]                 # @jump',
        '        else:',
        '            i += 1                        # @skip',
        '    return out                            # @done'
      ].join('\n')
    },
    prefix: {
      pseudo: [
        'procedure prefixTable(p)',
        '  π[0] ← 0;  k ← 0;  i ← 1             // @start',
        '  while i < m do',
        '    if p[i] = p[k] then                // @cmp',
        '      k ← k + 1                        // @ext',
        '      π[i] ← k;  i ← i + 1             // @ext',
        '    else if k > 0 then                 // @fallback',
        '      k ← π[k − 1]                     // @fallback',
        '    else',
        '      π[i] ← 0;  i ← i + 1             // @zero',
        '  return π                             // @done'
      ].join('\n'),
      js: [
        'function prefixTable(p) {',
        '  const pi = [0];                          // @start',
        '  let k = 0, i = 1;                        // @start',
        '  while (i < p.length) {',
        '    if (p[i] === p[k]) {                   // @cmp',
        '      k++; pi[i] = k; i++;                 // @ext',
        '    } else if (k > 0) {                    // @fallback',
        '      k = pi[k - 1];                       // @fallback',
        '    } else {',
        '      pi[i] = 0; i++;                      // @zero',
        '    }',
        '  }',
        '  return pi;                               // @done',
        '}'
      ].join('\n'),
      py: [
        'def prefix_table(p):',
        '    pi, k, i = [0], 0, 1                   # @start',
        '    while i < len(p):',
        '        if p[i] == p[k]:                   # @cmp',
        '            k += 1; pi.append(k); i += 1   # @ext',
        '        elif k > 0:                        # @fallback',
        '            k = pi[k - 1]                  # @fallback',
        '        else:',
        '            pi.append(0); i += 1           # @zero',
        '    return pi                              # @done'
      ].join('\n')
    },
    rk: {
      pseudo: [
        'procedure rabinKarp(text, pat, B, q)',
        '  P ← B^(m − 1) mod q                  // @init',
        '  hp ← hash(pat);  h ← hash(text[0..m))   // @hash',
        '  for s ← 0 to n − m                   // @loop',
        '    if h = hp then                     // @cmp',
        '      if text[s..s+m) = pat then report s   // @verify',
        '    if s < n − m then',
        '      h ← ((h − text[s]·P)·B + text[s+m]) mod q   // @roll',
        '  done                                 // @done'
      ].join('\n'),
      js: [
        'function rabinKarp(text, pat, B = 10, q = 13) {',
        '  const n = text.length, m = pat.length, out = [];',
        '  const v = c => c.charCodeAt(0) - 96;                 // a=1 ... z=26',
        '  let P = 1;',
        '  for (let i = 1; i < m; i++) P = (P * B) % q;         // @init',
        '  let hp = 0, h = 0;',
        '  for (let i = 0; i < m; i++) {                        // @hash',
        '    hp = (hp * B + v(pat[i])) % q;',
        '    h = (h * B + v(text[i])) % q;',
        '  }',
        '  for (let s = 0; s + m <= n; s++) {                   // @loop',
        '    if (h === hp) {                                    // @cmp',
        '      if (text.startsWith(pat, s)) out.push(s);        // @verify',
        '    }',
        '    if (s + m < n) {',
        '      h = (h - v(text[s]) * P) * B + v(text[s + m]);   // @roll',
        '      h = ((h % q) + q) % q;                           // @roll',
        '    }',
        '  }',
        '  return out;                                          // @done',
        '}'
      ].join('\n'),
      py: [
        'def rabin_karp(text, pat, B=10, q=13):',
        '    n, m, out = len(text), len(pat), []',
        '    v = lambda c: ord(c) - 96                # a=1 ... z=26',
        '    P = pow(B, m - 1, q)                     # @init',
        '    hp = h = 0',
        '    for i in range(m):                       # @hash',
        '        hp = (hp * B + v(pat[i])) % q',
        '        h = (h * B + v(text[i])) % q',
        '    for s in range(n - m + 1):               # @loop',
        '        if h == hp:                          # @cmp',
        '            if text.startswith(pat, s):      # @verify',
        '                out.append(s)                # @verify',
        '        if s + m < n:',
        '            h = ((h - v(text[s]) * P) * B + v(text[s + m])) % q   # @roll',
        '    return out                               # @done'
      ].join('\n')
    },
    z: {
      pseudo: [
        'procedure zArray(s)',
        '  l ← 0;  r ← 0                         // @start',
        '  for i ← 1 to n − 1                    // @loop',
        '    if i < r and Z[i − l] < r − i then  // @copy',
        '      Z[i] ← Z[i − l]                   // @copy',
        '    else',
        '      k ← max(0, r − i)                 // @free',
        '      while i + k < n and s[k] = s[i + k]   // @cmp',
        '        k ← k + 1',
        '      Z[i] ← k                          // @set',
        '      l ← i;  r ← i + k                 // @box',
        '  return Z                              // @done'
      ].join('\n'),
      js: [
        'function zArray(s) {',
        '  const n = s.length, z = new Array(n).fill(0);',
        '  let l = 0, r = 0;                                // @start',
        '  for (let i = 1; i < n; i++) {                    // @loop',
        '    if (i < r && z[i - l] < r - i) {               // @copy',
        '      z[i] = z[i - l];                             // @copy',
        '    } else {',
        '      let k = Math.max(0, r - i);                  // @free',
        '      while (i + k < n && s[k] === s[i + k]) k++;  // @cmp',
        '      z[i] = k;                                    // @set',
        '      l = i; r = i + k;                            // @box',
        '    }',
        '  }',
        '  return z;                                        // @done',
        '}'
      ].join('\n'),
      py: [
        'def z_array(s):',
        '    n = len(s); z = [0] * n',
        '    l = r = 0                                 # @start',
        '    for i in range(1, n):                     # @loop',
        '        if i < r and z[i - l] < r - i:        # @copy',
        '            z[i] = z[i - l]                   # @copy',
        '        else:',
        '            k = max(0, r - i)                 # @free',
        '            while i + k < n and s[k] == s[i + k]:   # @cmp',
        '                k += 1',
        '            z[i] = k                          # @set',
        '            l, r = i, i + k                   # @box',
        '    return z                                  # @done'
      ].join('\n')
    }
  };

  return {
    naive: naive, kmp: kmp, prefixSteps: prefixSteps, rabinKarp: rabinKarp, zSteps: zSteps, boyerMoore: boyerMoore,
    prefixTable: prefixTable, prefixCost: prefixCost, zArray: zArray, find: find, count: count, CODE: CODE, val: val,
    ALPHABET: /^[a-z]*$/
  };
}));
