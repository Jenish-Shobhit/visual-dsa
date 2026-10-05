/* Lesson 36 — String matching: figure wiring for the first half of the page (hero teaser, slide-it-yourself,
   the KMP idea, borders) plus the checks, the summary card and the boot sequence.
   Generators: js/algos/36-string-matching.js (VDSA.algos.stringMatch). The view: js/lessons/36-string-matching-view.js.
   Labs (table builder, naive/KMP, Rabin–Karp, Z): 36-string-matching-labs.js. Race, chart, decision diagram,
   Boyer–Moore: 36-string-matching-more.js. Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SM = V.lessons.l36;
  function A() { return V.algos.stringMatch; }

  var LEG = SM.LEG;

  /* ================================================================== hero teaser: KMP jumping along a text */
  function heroTeaser() {
    var stage = V.$('#teaser');
    var view = SM.view(stage, { cell: 46, minCell: 12, labels: false, indices: false, label: 'KMP search animation', gapY: 30 });
    var steps = A().kmp(stage.clientWidth < 520 ? 'abababacaba' : 'abababacabababaca', 'ababaca');   // a shorter text on phones keeps the cells (and letters) readable
    view.prepare(steps);
    var jump = steps.findIndex(function (s) { return s.kind === 'jump'; });
    V.teaser(stage, { steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, stepMs: 620, holdMs: 1900,
      staticIndex: jump > 0 ? jump : steps.length - 1 });
  }

  /* ================================================================== the problem: slide the pattern yourself */
  function slideFigure() {
    var fig = V.$('#fig-slide');
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 38, gapY: 38, label: 'A pattern you can slide along a text' });
    var EX = {
      plain: { text: 'thecatsatonthemat', pat: 'mat' },
      rep: { text: 'aaaaaaaaab', pat: 'aaab' }
    };
    var ex = 'plain', off = 0, visited = {};
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { alignments: 'Alignments tried', comparisons: 'Comparisons so far', worst: 'Worst case (n−m+1)·m' }, states: { comparisons: 'compare', alignments: 'active' } });
    var msg = fig.querySelector('[data-msg]');
    var left = fig.querySelector('[data-left]'), right = fig.querySelector('[data-right]');
    function lead(text, pat, o) { var j = 0; while (j < pat.length && text[o + j] === pat[j]) j++; return j; }
    function draw(dur) {
      var E = EX[ex], text = E.text, pat = E.pat, n = text.length, m = pat.length;
      visited[off] = true;
      var t = {}, p = {}, done = {};
      Object.keys(visited).forEach(function (k) { k = +k; if (lead(text, pat, k) === m) for (var q = 0; q < m; q++) done[k + q] = true; });
      Object.keys(done).forEach(function (k) { t[k] = 'done'; });
      var j = lead(text, pat, off), full = j === m, cmp = null;
      for (var q = 0; q < j; q++) { t[off + q] = full ? 'done' : 'found'; p[q] = 'found'; }
      if (!full) { t[off + j] = 'error'; p[j] = 'error'; cmp = { t: off + j, p: j, state: 'error' }; }
      view.render({ text: text, pat: pat, offset: off, tStates: t, pStates: p, cmp: cmp, ghost: null, table: null, bands: [], arrows: [], pointers: [] }, { duration: dur === undefined ? 380 : dur });
      var comps = 0, count = 0;
      Object.keys(visited).forEach(function (k) { k = +k; count++; var jj = lead(text, pat, k); comps += jj === m ? m : jj + 1; });
      var total = n - m + 1;
      stats.update({ alignments: count + ' / ' + total, comparisons: comps, worst: total * m });
      left.disabled = off === 0; right.disabled = off === n - m;
      var txt;
      if (full) txt = '<b>Alignment ' + off + ': all ' + m + ' characters agree</b>, so the pattern occurs here. It took ' + m + ' comparisons.';
      else if (j === 0) txt = 'Alignment ' + off + ': <code>' + text[off] + '</code> ≠ <code>' + pat[0] + '</code>. The very first comparison fails, so this alignment costs 1 comparison.';
      else txt = 'Alignment ' + off + ': ' + j + ' characters agree, then <code>' + text[off + j] + '</code> ≠ <code>' + pat[j] + '</code>. That is ' + (j + 1) + ' comparisons spent on one alignment.';
      if (count === total) {
        txt += ' <b>All ' + total + ' alignments tried: ' + comps + ' comparisons.</b>' + (ex === 'rep' ? ' Nearly every alignment matched most of the pattern before failing: that is the n × m trap.' : ' Most alignments died at the first letter, so naive search is fine on text like this.');
        msg.setAttribute('data-state', ex === 'rep' ? 'compare' : 'done');
      } else { txt += ' Slide right for the next alignment.'; msg.removeAttribute('data-state'); }
      msg.innerHTML = txt;
    }
    function reset() { off = 0; visited = {}; draw(0); }
    left.addEventListener('click', function () { if (off > 0) { off--; draw(); } });
    right.addEventListener('click', function () { if (off < EX[ex].text.length - EX[ex].pat.length) { off++; draw(); } });
    fig.querySelector('[data-reset]').addEventListener('click', reset);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Text', value: ex,
      options: [{ value: 'plain', label: 'Ordinary text' }, { value: 'rep', label: 'Repetitive text' }],
      onChange: function (v) { ex = v; view.reset(); reset(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [LEG.found, LEG.error, LEG.done, LEG.pattern]);
    reset();
  }

  /* ================================================================== the KMP idea: one mismatch, one jump */
  function ideaFigure() {
    var fig = V.$('#fig-idea');
    var steps = A().kmp('abababac', 'ababac');
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 50, gapY: 40, label: 'KMP searching abababac for ababac' });
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', shifts: 'Pattern shifts' }, counterStates: { comparisons: 'compare', shifts: 'swap' },
      baseStepMs: 1300, label: 'KMP idea controls'
    });
    player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'jump'; }); }, function (c) {
      var mismatchAt = c.prev.vars.j;
      return {
        question: 'Five pattern characters matched, and then the pair at <code>pat[' + mismatchAt + ']</code> mismatched. Where in the pattern does the very next comparison happen?',
        options: ['<code>pat[0]</code>: start the pattern over', '<code>pat[3]</code>: the last three matched characters are also its first three', '<code>pat[5]</code> again, with the text pointer moved right'],
        answer: 1,
        explain: [
          'Starting over would throw away work. The text under the pattern already spells <code>ababa</code>, and its last three letters <code>aba</code> are the first three letters of the pattern.',
          'Right. π[4] = 3: the border <code>aba</code> stays aligned, so the pattern slides two places and the comparison resumes at <code>pat[3]</code>. The text pointer does not move.',
          'The text pointer does not move on a mismatch when j is above zero, and comparing <code>pat[5]</code> again would repeat the same failing pair.'
        ]
      };
    }, { id: 'l36-idea-jump' });
    V.legend(fig.querySelector('[data-legend]'), [LEG.found, LEG.error, LEG.done, { state: 'key', label: 'Table entry used' }]);
  }

  /* ================================================================== borders: longest border of every prefix */
  function borderFigure() {
    var fig = V.$('#fig-border');
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 46, gapY: 36, label: 'Borders of the prefixes of a pattern', textLabel: 'prefix', patLabel: 'copy' });
    var caption = fig.querySelector('[data-caption]');
    var PATS = ['ababaca', 'aabaaab', 'abcabc', 'aaaa'];
    var p = PATS[0], len = 5, slider = null;
    function chain(pi, k) { var out = []; while (k > 0) { out.push(k); k = pi[k - 1]; } return out; }
    function snap(p, len) {
      var pi = A().prefixTable(p), k = pi[len - 1], t = {}, ps = {}, q;
      for (q = 0; q < p.length; q++) t[q] = q < len ? 'visited' : 'muted';
      if (k > 0) { for (q = len - k; q < len; q++) t[q] = 'done'; for (q = 0; q < p.length; q++) ps[q] = q < k ? 'done' : 'muted'; }
      var vals = pi.map(function (v, i) { return i < len ? v : null; });
      var st = {}; st[len - 1] = 'done';
      return { pi: pi, k: k, state: {
        text: p, pat: k > 0 ? p : null, offset: k > 0 ? len - k : null, clip: true, tStates: t, pStates: ps, cmp: null, ghost: null,
        table: { label: 'π', values: vals, under: 'text', states: st, active: len - 1 },
        bands: k > 0 ? [{ from: len - k, to: len - 1, state: 'done', label: 'suffix' }, { from: 0, to: k - 1, state: 'done', label: 'prefix', dashed: true }] : [], arrows: [], pointers: []
      } };
    }
    function draw(dur) {
      var r = snap(p, len), pre = p.slice(0, len), k = r.k, ch = chain(r.pi, k);
      view.render(r.state, { duration: dur === undefined ? 420 : dur });
      caption.innerHTML = k > 0
        ? 'Prefix <code>' + pre + '</code> (' + len + ' letters): its longest border is <code>' + pre.slice(0, k) + '</code> (length <b>' + k + '</b>), the same letters at the start and at the end. So <b>π[' + (len - 1) + '] = ' + k + '</b>. All its borders: ' + ch.map(function (b) { return '<code>' + pre.slice(0, b) + '</code>'; }).join(', ') + (ch.length > 1 ? ' (the fall-back chain KMP walks)' : '') + '.'
        : 'Prefix <code>' + pre + '</code> (' + len + ' letters) has <b>no border</b>: no proper prefix equals a suffix, so <b>π[' + (len - 1) + '] = 0</b>. After a failure here, KMP has nothing to reuse and starts the pattern over.';
    }
    function mountSlider() {
      var host = fig.querySelector('[data-slider]');
      V.clear(host); host.className = 'sm-slider';
      slider = V.slider(host, { label: 'Prefix length', min: 1, max: p.length, value: len, onInput: function (v) { len = v; draw(); } });
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Pattern', value: p, options: PATS.map(function (x) { return { value: x, label: x }; }),
      onChange: function (v) { p = v; len = Math.min(p.length, Math.max(2, len)); view.reset(); mountSlider(); draw(0); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'Prefix' }, { state: 'done', label: 'Border (start = end)' }, { state: 'muted', label: 'Not in this prefix' }]);
    mountSlider(); draw(0);
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-pi', {
      id: 'l36-quiz-pi', question: 'For the pattern <code>abcabd</code>, what is <code>π[4]</code>, the longest border of the prefix <code>abcab</code>?',
      options: ['5, the whole prefix', '3', '2', '0'], answer: 2,
      explain: [
        'A border must be a <em>proper</em> prefix, shorter than the string itself. Otherwise every string would be its own border.',
        'The first three letters are <code>abc</code>, but the last three are <code>cab</code>. They differ.',
        'Right. The first two letters <code>ab</code> equal the last two letters <code>ab</code>, and no longer prefix matches a suffix.',
        '<code>ab</code> appears both at the start and at the end, so there is a border of length 2. Zero would mean no border at all.'
      ]
    });
    V.quiz('#quiz-roll', {
      id: 'l36-quiz-roll', question: 'Base 10, modulus 13, window length 3 (so <code>10² mod 13 = 9</code>), <code>a = 1, b = 2, …</code>. The window <code>bcd</code> has hash <b>0</b>. Slide to <code>cde</code>: what is its hash?',
      options: ['2', '5', '7', '12'], answer: 2,
      explain: [
        'That is what is left after subtracting <code>b·9</code> and multiplying by 10, but the trailing letter <code>e = 5</code> has not been added yet.',
        '5 is the value of the new letter alone: you must roll the old hash first. Subtract 2·9 = 18, giving 8 (mod 13); multiply by 10, giving 2; then add 5.',
        'Right. (0 − 2·9) mod 13 = 8, then 8 · 10 mod 13 = 2, then 2 + 5 = 7. Directly: 345 mod 13 = 7.',
        'Try the three steps in order: subtract the leading letter times 9, multiply by 10, add the trailing letter, all mod 13.'
      ]
    });
    V.quiz('#quiz-cost', {
      id: 'l36-quiz-cost', question: 'The text is 1,000 letters <code>a</code>. The pattern is 99 letters <code>a</code> followed by one <code>b</code>. About how many comparisons does <em>naive</em> search make?',
      options: ['About 1,000', 'About 2,000', 'About 90,000', 'About 1,000,000'], answer: 2,
      explain: [
        'That is about how many KMP needs. Naive search re-compares the 99 matching letters at every alignment.',
        '2n is KMP\'s upper bound. Naive search has no such bound.',
        'Right. There are 1,000 − 100 + 1 = 901 alignments, and each one compares all 100 characters before failing at the <code>b</code>: 901 × 100 ≈ 90,000.',
        'n × n would be a million, but the pattern only has 100 letters, so the product is n × m, not n².'
      ]
    });
    V.quiz('#quiz-hit', {
      id: 'l36-quiz-hit', question: 'Rabin–Karp finds a window whose hash equals the pattern\'s hash. What must it do next?',
      options: ['Report a match: equal hashes mean equal strings', 'Compare the characters of the window with the pattern', 'Discard the window and roll on', 'Double the modulus and start again'],
      answer: 1,
      explain: [
        'Different strings can share a hash (a collision), so equal hashes only make a match <em>likely</em>.',
        'Right. A hash hit is only a candidate. Comparing the characters costs up to m, but it happens rarely, and it rules out spurious hits.',
        'That would miss real matches: a real match always has an equal hash.',
        'A bigger modulus makes collisions rarer, but it does not remove them, and there is no need to restart.'
      ]
    });
    /* click the answer on a frozen KMP mismatch */
    var host = V.$('#fig-click [data-stage]');
    var st = A().kmp('abababac', 'ababac').filter(function (s) { return s.kind === 'cmp' && s.vars.i === 5; })[0];
    var view = SM.view(host, { cell: 50, gapY: 34, ids: true, link: true, label: 'KMP at a mismatch', pointersOnly: false });
    view.render(st, { duration: 0 });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l36-click-next',
      question: 'The pair joined by the red ≠ just mismatched. After KMP slides the pattern using π, which <strong>text</strong> character does it compare next? Click it.',
      check: function (id) {
        if (id === 't5') return true;
        if (id[0] === 'p') return { correct: false, message: 'Click a character of the text row (the top row). The question asks which text character is compared next.' };
        var i = +id.slice(1);
        if (i < 5) return { correct: false, message: 'The text pointer never moves left: that is the whole point of KMP. Characters before index 5 are already known.' };
        return { correct: false, message: 'Index ' + i + ' comes later. On a mismatch with j > 0 the text pointer stays put, and only the pattern moves.' };
      },
      right: 'Right. <code>text[5]</code> = <code>b</code> is compared again, now against <code>pat[3]</code> = <code>b</code>. On a mismatch the text pointer stays, and only the pattern slides.'
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid'), S = A();
    var kmpSteps = S.kmp('abababac', 'ababac');
    var jump = kmpSteps.filter(function (s) { return s.kind === 'jump'; })[0];
    var rk = S.rabinKarp('bddaeccdcaaacada', 'cad', { mod: 13 });
    var rkStep = rk.filter(function (s) { return s.kind === 'hashcmp' && s.hash.hit; })[0] || rk[3];
    var zs = S.zSteps('aab', 'aabxaab');
    var zStep = zs.filter(function (s) { return s.kind === 'copy'; })[0] || zs[zs.length - 2];
    var naive = S.naive('aaaaab', 'aab');
    var nStep = naive.filter(function (s) { return s.kind === 'cmp' && s.cmp.state === 'error'; })[1] || naive[3];
    var tiles = [
      { el: SM.tile(Object.assign({}, nStep, { ghost: null }), { cell: 30, width: 250 }), label: 'Naive: O(nm)', text: 'Slide one place after every mismatch and forget what matched. Re-reads characters; worst on repetitive text.' },
      { el: SM.tile({ text: 'ababaca', pat: null, offset: null, tStates: { 2: 'done', 3: 'done', 4: 'done' }, pStates: {}, table: { label: 'π', values: [0, 0, 1, 2, 3, 0, 1], under: 'text', states: { 4: 'done' }, active: 4 }, bands: [], arrows: [], pointers: [] }, { cell: 30, width: 250 }), label: 'Failure table π', text: 'Longest proper prefix that is also a suffix, for every prefix of the pattern. Built in O(m).' },
      { el: SM.tile(jump, { cell: 26, width: 250, gapY: 34 }), label: 'KMP: O(n + m)', text: 'On a mismatch, jump by π. The text pointer never moves left, so at most 2n comparisons.' },
      { el: SM.tile(rkStep, { cell: 28, width: 250 }), label: 'Rabin–Karp: O(n + m) expected', text: 'Roll a hash along the text: subtract leading, multiply, add trailing. Verify every hash hit.' },
      { el: SM.tile(zStep, { cell: 24, width: 250, gapY: 30 }), label: 'Z-algorithm: O(n + m)', text: 'Z[i] = how far the start repeats at i. The Z-box lets new positions copy from a mirror.' },
      { el: h('div', { class: 'sm-costs' }, h('span', { class: 'sm-tag' }, 'naive  n·m'), h('span', { class: 'sm-tag' }, 'KMP  2n + 2m'), h('span', { class: 'sm-tag' }, 'Z  2n'), h('span', { class: 'sm-tag' }, 'Rabin–Karp  n + m')), label: 'Pick by guarantee', text: 'Need a worst-case bound: KMP or Z. Many equal-length patterns: Rabin–Karp. Ordinary text: Boyer–Moore or the library.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.el), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // labs start lazily; register their prediction ids now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l36-idea-jump', 'l36-lab-naive-restart', 'l36-lab-kmp-resume', 'l36-lab-kmp-after-match', 'l36-lab-build-fallback', 'l36-lab-rk-roll', 'l36-lab-rk-hit', 'l36-lab-z-copy'].forEach(V.quizScore.register);
    heroTeaser();
    checks();
    summaryCard();
    SM.whenNear('#fig-slide', slideFigure);
    SM.whenNear('#fig-idea', ideaFigure);
    SM.whenNear('#fig-border', borderFigure);
    SM.whenNear('#lab-build', function () { SM.build = SM.initBuild(); });
    SM.whenNear('#lab-fig', function () { SM.lab = SM.initLab(); });
    SM.whenNear('#lab-rk', function () { SM.rk = SM.initRK(); });
    SM.whenNear('#lab-z', function () { SM.z = SM.initZ(); });
    SM.whenNear('#fig-race', function () { SM.race = SM.initRace(); });
    SM.whenNear('#fig-growth', SM.initGrowth);
    SM.whenNear('#variants', SM.initVariants);
    SM.whenNear('#fig-choose', SM.initChooser);
  });
}());
