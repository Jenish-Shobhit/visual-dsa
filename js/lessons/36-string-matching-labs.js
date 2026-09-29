/* Lesson 36 — the code-synced labs: failure-table builder, naive vs KMP (with its flowchart),
   Rabin–Karp with the rolling-hash strip, and the Z-algorithm. Started by js/lessons/36-string-matching.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SM = V.lessons.l36;
  function S() { return V.algos.stringMatch; }
  function esc(t) { return V.escape(t); }

  var LEG = SM.LEG;

  /* ================================================================== the failure-table builder */
  SM.initBuild = function () {
    var fig = V.$('#lab-build');
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 46, gapY: 42, textLabel: 'pattern', patLabel: 'copy', label: 'Failure table builder: the pattern compared against itself' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE.prefix, default: 'pseudo', maxHeight: 300 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var pat = 'ababaca';
    function generate() { return S().prefixSteps(pat); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', fallbacks: 'Fall-backs' }, counterStates: { comparisons: 'compare', fallbacks: 'swap' },
      baseStepMs: 1150, label: 'Failure table builder controls'
    });
    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'fallback') return k;
      return -1;
    }, function (c) {
      var s = c.step, prev = c.prev;
      var k = null, i = null;
      prev.pointers.forEach(function (p) { if (p.name === 'k') k = p.index; if (p.name === 'i') i = p.index; });
      var next = s.arrows[0] ? +s.arrows[0].label.split('= ')[1] : null;
      if (k === null || next === null) return null;
      if (k - 1 === next) return null;
      var opts = ['Length ' + (k - 1) + ': just one shorter', 'Length ' + next + ': π[' + (k - 1) + '], the next-longest border', 'Length ' + k + ' again, on the next letter'];
      return {
        question: 'The border of length <b>' + k + '</b> cannot be extended: <code>p[' + i + ']</code> ≠ <code>p[' + k + ']</code>. Which border length does the builder try next?',
        options: opts, answer: 1,
        explain: [
          'A border one shorter than the current one is not necessarily a border at all. Only the borders of the matched part count, and the table already lists them.',
          'Right. The matched part is a copy of <code>p[0..' + (k - 1) + ']</code>, so its shorter borders are exactly the borders of that prefix. Its longest is <code>π[' + (k - 1) + '] = ' + next + '</code>, already in the table.',
          'The same length just failed on this very letter, so trying it again would fail again.'
        ]
      };
    }, { id: 'l36-lab-build-fallback' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your pattern (1 to 12 lowercase letters)', value: pat, placeholder: 'e.g. ababaca',
      parse: function (text) { var r = SM.parseWord(text, 'pattern', { max: 12 }); return r.error ? { error: r.error } : { values: r.value }; },
      presets: [
        { label: 'ababaca', value: 'ababaca' }, { label: 'aabaaab', value: 'aabaaab' }, { label: 'abcabcabd', title: 'Two borders at once', value: 'abcabcabd' },
        { label: 'aaaaa', title: 'Worst case for the fall-back chain? No: every step is a match', value: 'aaaaa' },
        { label: 'aaaab', title: 'Long fall-backs at the last letter', value: 'aaaab' }, { label: 'abcd', title: 'No borders at all', value: 'abcd' }, { label: 'One letter', value: 'a' }
      ],
      hint: 'Try aaaab: the last letter falls back through the whole chain of borders, but the total work still stays under 2m.',
      onApply: function (value) { pat = value; steps = generate(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    });
    V.legend(fig.querySelector('[data-legend]'), [LEG.found, LEG.error, { state: 'done', label: 'Border found / π written' }, { state: 'key', label: 'π entry used to fall back' }]);
    return { player: player };
  };

  /* ================================================================== naive vs KMP lab + flowchart */
  var FLOWS = {
    naive: {
      nodes: [
        { id: 'start', type: 'start', text: 's = 0', col: 0, row: 0 },
        { id: 'outer', type: 'decision', text: 's ≤ n − m ?', col: 0, row: 1 },
        { id: 'init', type: 'process', text: 'j = 0', col: 0, row: 2 },
        { id: 'cmp', type: 'decision', text: 'j < m and\ntext[s+j] = pat[j] ?', col: 0, row: 3 },
        { id: 'adv', type: 'process', text: 'j = j + 1', col: 1, row: 3 },
        { id: 'full', type: 'decision', text: 'j = m ?', col: 0, row: 4 },
        { id: 'report', type: 'process', text: 'report s', col: 1, row: 4 },
        { id: 'next', type: 'process', text: 's = s + 1', col: 0, row: 5 },
        { id: 'done', type: 'end', text: 'done', col: 1, row: 1 }
      ],
      edges: [
        { from: 'start', to: 'outer' },
        { from: 'outer', to: 'init', label: 'yes' }, { from: 'outer', to: 'done', label: 'no' },
        { from: 'init', to: 'cmp' },
        { from: 'cmp', to: 'adv', label: 'yes' }, { from: 'adv', to: 'cmp', via: { fromSide: 'top', toSide: 'top' } },
        { from: 'cmp', to: 'full', label: 'no' },
        { from: 'full', to: 'report', label: 'yes' }, { from: 'full', to: 'next', label: 'no' },
        { from: 'report', to: 'next' },
        { from: 'next', to: 'outer' }
      ]
    },
    kmp: {
      nodes: [
        { id: 'start', type: 'start', text: 'build π\ni = 0, j = 0', col: 1, row: 0 },
        { id: 'loop', type: 'decision', text: 'i < n ?', col: 1, row: 1 },
        { id: 'done', type: 'end', text: 'done', col: 0, row: 1 },
        { id: 'cmp', type: 'decision', text: 'text[i] = pat[j] ?', col: 1, row: 2 },
        { id: 'adv', type: 'process', text: 'i = i + 1, j = j + 1\nif j = m: report i − m,\nj = π[j − 1]', col: 2, row: 2 },
        { id: 'jq', type: 'decision', text: 'j > 0 ?', col: 1, row: 3 },
        { id: 'jump', type: 'process', text: 'j = π[j − 1]', col: 0, row: 3 },
        { id: 'skip', type: 'process', text: 'i = i + 1', col: 2, row: 3 }
      ],
      edges: [
        { from: 'start', to: 'loop' },
        { from: 'loop', to: 'cmp', label: 'yes' }, { from: 'loop', to: 'done', label: 'no' },
        { from: 'cmp', to: 'adv', label: 'yes' }, { from: 'cmp', to: 'jq', label: 'no' },
        { from: 'jq', to: 'jump', label: 'yes' }, { from: 'jq', to: 'skip', label: 'no' },
        { from: 'jump', to: 'cmp', via: { fromSide: 'top', toSide: 'left' } },
        { from: 'adv', to: 'loop', via: { fromSide: 'right', toSide: 'right', points: [[2.5, 2], [2.5, 1.2]] } },
        { from: 'skip', to: 'loop', via: { fromSide: 'right', toSide: 'right', points: [[2.5, 3], [2.5, 1.2]] } }
      ]
    }
  };
  var FLOW_ALT = {
    naive: 'Text alternative: for each alignment s up to n − m, set j to 0 and, while j < m and the characters agree, increase j. If j reached m, report s. Then add one to s and repeat.',
    kmp: 'Text alternative: while the text pointer i is before the end, compare text[i] with pat[j]. If equal, move both pointers, and after a full match report it and set j = π[j − 1]. If different and j is above zero, set j = π[j − 1] and compare again; if j is zero, move i.'
  };
  var TITLES = { naive: 'Naive search', kmp: 'KMP search' };
  var LEGENDS = {
    naive: [LEG.found, LEG.error, LEG.done, LEG.pattern],
    kmp: [LEG.found, LEG.error, LEG.done, { state: 'key', label: 'π entry used for the jump' }, { state: 'default', shape: 'dash', label: 'Where the pattern was' }]
  };
  var DEFAULT = { text: 'abababacabababaca', pat: 'ababaca' };

  SM.initLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var algo = 'naive', text = DEFAULT.text, pat = DEFAULT.pat;
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 44, minCell: 17, gapY: 46, label: 'Text and pattern being matched' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE.naive, default: 'pseudo', maxHeight: 330 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var legendEl = fig.querySelector('[data-legend]');

    var flowStage = flowFig.querySelector('[data-stage]');
    var flowView = V.views.flowchart(flowStage, FLOWS.naive, { label: 'Flowchart of the search running in the lab', narrowWidth: 420 });
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = 0; k < ctx.index && k < st.length; k++) if (st[k].flow && visited.indexOf(st[k].flow) === -1 && st[k].flow !== id) visited.push(st[k].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);

    function generate() { return algo === 'naive' ? S().naive(text, pat) : S().kmp(text, pat); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flowAdapter, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', shifts: 'Pattern shifts' }, counterStates: { comparisons: 'compare', shifts: 'swap' },
      baseStepMs: 950, label: 'Search lab controls'
    });

    /* ---- predictions ---- */
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'naive') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'slide' && st[k - 1].kind === 'cmp' && st[k - 1].cmp.p >= 2) return k;
      return -1;
    }, function (c) {
      var j = c.prev.cmp.p;
      return {
        question: 'The pattern just failed after <b>' + j + '</b> matching characters. Naive search now slides one place. How many of those ' + j + ' matches does it <em>reuse</em> at the new alignment?',
        options: ['All ' + j + ': they are still in the text', 'Only the last one', 'None: it restarts at <code>pat[0]</code> and compares them again'],
        answer: 2,
        explain: [
          'That is what KMP does, not naive search. Naive search keeps no memory of the previous alignment.',
          'Naive search keeps nothing at all. It even re-reads the last matched character.',
          'Right. Naive search restarts at <code>pat[0]</code>, so the ' + j + ' characters it just matched get compared all over again. That repeated work is what makes it O(nm).'
        ]
      };
    }, { id: 'l36-lab-naive-restart' });
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'kmp') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'jump' && st[k - 1].kind === 'cmp') return k;
      return -1;
    }, function (c) {
      var j = c.prev.vars.j, k = c.step.vars.j;
      var options = ['<code>j = 0</code>: start the pattern over', '<code>j = ' + j + '</code>: retry the same pattern character', '<code>j = ' + k + '</code>: the value π[' + (j - 1) + '] stored in the table'];
      if (k === 0) options[2] = '<code>j = 0</code>: π[' + (j - 1) + '] is 0, so nothing is kept';
      if (k === 0) return null;
      return {
        question: 'KMP just failed at <code>j = ' + j + '</code> (<code>text[' + c.prev.vars.i + ']</code> ≠ <code>pat[' + j + ']</code>). What is <code>j</code> after the jump?',
        options: options, answer: 2,
        explain: [
          'Restarting would ignore the ' + j + ' characters already matched. The table says ' + k + ' of them are also the start of the pattern.',
          'The same pair would fail again: the text has not changed, and neither has that pattern character.',
          'Right. <code>π[' + (j - 1) + '] = ' + k + '</code>: the last ' + k + ' matched characters are the pattern\'s first ' + k + ', so the pattern slides and the text pointer stays. Comparison resumes at <code>pat[' + k + ']</code>.'
        ]
      };
    }, { id: 'l36-lab-kmp-resume' });
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].algo !== 'kmp') return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'jump' && st[k - 1].kind === 'found') return k;
      return -1;
    }, function (c) {
      var m = c.prev.pat.length, kk = c.step.vars.j;
      return {
        question: 'KMP has just found a full match of the ' + m + '-letter pattern. To keep looking for <em>overlapping</em> matches, what does it set <code>j</code> to?',
        options: ['<code>j = 0</code>, then start again', '<code>j = ' + kk + '</code>, the value π[' + (m - 1) + '] of the whole pattern', '<code>j = ' + m + '</code>, it stays where it is'],
        answer: 1,
        explain: [
          'Starting from zero could miss an occurrence that overlaps the one just found: the pattern\'s own border may already be the start of the next match.',
          'Right. The longest border of the whole pattern is the part that may already be the start of the next occurrence, so <code>j = π[m − 1] = ' + kk + '</code>.',
          'With <code>j = m</code> there is no pattern character left to compare, so the next comparison would read past the end of the pattern.'
        ]
      };
    }, { id: 'l36-lab-kmp-after-match' });

    /* ---- tabs and the flowchart's own switch, synced ---- */
    var tabs = V.tabs('#lab-tabs', { onChange: function (name) { select(name, true); } });
    var flowSeg;
    function select(name, fromTabs, force) {
      if (name === algo && !force) return;
      algo = name;
      if (!fromTabs) tabs.select(name);
      code.setSource(S().CODE[algo]);
      V.legend(legendEl, LEGENDS[algo]);
      flowView.setSpec(FLOWS[algo]);
      var ft = flowFig.querySelector('[data-flow-title]'); if (ft) ft.textContent = TITLES[algo] + ' as a flowchart';
      var alt = flowFig.querySelector('[data-flow-alt]'); if (alt) alt.textContent = FLOW_ALT[algo];
      if (flowSeg && flowSeg.value !== algo) flowSeg.set(algo);
      reload();
    }
    function reload() { steps = generate(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    flowSeg = V.segmented(flowFig.querySelector('[data-seg]'), {
      label: 'Algorithm', value: algo, options: [{ value: 'naive', label: 'Naive' }, { value: 'kmp', label: 'KMP' }],
      onChange: function (v) { select(v, false); }
    });

    /* ---- input + presets ---- */
    var strIn = SM.strInputs(fig.querySelector('[data-input]'), {
      text: text, pat: pat, textLabel: 'Text (up to 26 letters)', patLabel: 'Pattern (up to 9)', maxText: 26, maxPat: 9,
      presets: [
        { label: 'Default', value: DEFAULT },
        { label: 'aaa…ab', title: 'Worst case for naive search', value: { text: 'aaaaaaaaaaaaaaaaaab', pat: 'aaaab' } },
        { label: 'Repeats', title: 'Long partial matches everywhere', value: { text: 'abcabcabcabcabd', pat: 'abcabd' } },
        { label: 'DNA', value: { text: 'gattacagattacagcgattaca', pat: 'gattaca' } },
        { label: 'Overlapping', title: 'aaa occurs six times in aaaaaaaa', value: { text: 'aaaaaaaa', pat: 'aaa' } },
        { label: 'No match', value: { text: 'abcdefghijklmnopq', pat: 'xyz' } },
        { label: 'Pattern = text', value: { text: 'abcabc', pat: 'abcabc' } },
        { label: 'One letter', value: { text: 'banana', pat: 'a' } }
      ],
      hint: 'Only lowercase letters a to z. Try the aaa…ab preset under both tabs and compare the comparison counters.',
      check: function (t, p) { return p.length > t.length ? 'The pattern (' + p.length + ' letters) is longer than the text (' + t.length + '), so it can never occur. Shorten the pattern or lengthen the text.' : ''; },
      onApply: function (t, p) { text = t; pat = p; reload(); }
    });
    V.legend(legendEl, LEGENDS[algo]);
    select('naive', true, true);
    return { select: function (n) { select(n, false); }, player: player, set: strIn.set };
  };

  /* ================================================================== Rabin–Karp lab */
  SM.initRK = function () {
    var fig = V.$('#lab-rk');
    var text = 'abdcabccaabdcbdab', pat = 'abd', q = 13;
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 44, minCell: 17, gapY: 40, label: 'Rolling window over the text' });
    var strip = SM.hashStrip(fig.querySelector('[data-hash]'));
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    function langs() {
      var c = S().CODE.rk, o = {};
      Object.keys(c).forEach(function (k) { o[k] = c[k].replace('q = 13', 'q = ' + q); });
      return o;
    }
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: langs(), default: 'pseudo', maxHeight: 320 });
    function generate() { return S().rabinKarp(text, pat, { mod: q }); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { view.render(s, { duration: ctx.duration }); strip.render(s.hash); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { windows: 'Windows hashed', hits: 'Hash hits', spurious: 'Spurious hits', comparisons: 'Letters compared' },
      counterStates: { hits: 'compare', spurious: 'error', comparisons: 'compare' }, baseStepMs: 1000, label: 'Rabin–Karp lab controls'
    });
    player.addCheckpoint(function (st) { for (var k = 1; k < st.length; k++) if (st[k].kind === 'rollAdd') return k; return -1; }, function (c) {
      var hs = c.prev.hash;
      if (!hs || hs.mul === undefined) return null;
      var ans = hs.add;
      var cand = [hs.mul, ans, hs.mul + hs.tv !== ans ? hs.mul + hs.tv : (ans + 1) % hs.q];
      var seen = {}; cand = cand.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
      if (cand.length < 3) cand.push((ans + 2) % hs.q === ans ? ans + 3 : (ans + 2) % hs.q);
      cand = cand.slice(0, 3);
      var idx = cand.indexOf(ans);
      return {
        question: 'After subtracting the leading letter and multiplying by ' + hs.B + ' the hash is <b>' + hs.mul + '</b>. Now the trailing letter <code>' + hs.trail + '</code> (value ' + hs.tv + ') joins the window. What is the new window hash (mod ' + hs.q + ')?',
        options: cand.map(String), answer: idx,
        explain: cand.map(function (x) {
          if (x === ans) return 'Right. ' + hs.mul + ' + ' + hs.tv + ' = ' + (hs.mul + hs.tv) + ', and ' + (hs.mul + hs.tv) + ' mod ' + hs.q + ' = ' + ans + '. One O(1) update.';
          if (x === hs.mul) return 'That forgets the new letter. The trailing letter\'s value ' + hs.tv + ' must be added.';
          return 'Add the trailing letter\'s value (' + hs.tv + ') to ' + hs.mul + ' and reduce modulo ' + hs.q + '.';
        })
      };
    }, { id: 'l36-lab-rk-roll' });
    player.addCheckpoint(function (st) { for (var k = 1; k < st.length; k++) if (st[k].kind === 'hashcmp' && st[k].hash.hit) return k; return -1; }, function (c) {
      var hs = c.step.hash;
      return {
        question: 'The window\'s hash is <b>' + hs.h + '</b> and the pattern\'s hash is <b>' + hs.hp + '</b>: they are equal. What should Rabin–Karp do?',
        options: ['Skip the window: equal hashes mean it is probably a false alarm', 'Report a match at once: equal hashes mean equal strings', 'Compare the letters to confirm before reporting'],
        answer: 2,
        explain: [
          'Backwards: unequal hashes prove a difference, but equal hashes only make a match possible. Skipping would miss real matches.',
          'Different strings can collide (a spurious hit). Reporting now could give a false match.',
          'Right. A hash hit is only a candidate. The letter-by-letter check settles it, and it is needed rarely.'
        ]
      };
    }, { id: 'l36-lab-rk-hit' });
    var strIn = SM.strInputs(fig.querySelector('[data-input]'), {
      text: text, pat: pat, textLabel: 'Text (up to 24 letters)', patLabel: 'Pattern (up to 6)', maxText: 24, maxPat: 6,
      presets: [
        { label: 'Default', value: { text: 'abdcabccaabdcbdab', pat: 'abd' } },
        { label: 'Many hits', title: 'Repetitive text: every window is a true match', value: { text: 'aaaaaaaaaaaa', pat: 'aaa' } },
        { label: 'No hits', value: { text: 'abcdefghijklmn', pat: 'xyz' } },
        { label: 'DNA', value: { text: 'gattacagattacagcgattaca', pat: 'gatt' } },
        { label: 'Anagram', title: 'Same letters, different order', value: { text: 'abcbacbcabcab', pat: 'abc' } }
      ],
      hint: 'Small alphabet, small modulus: collisions are easy to see. Use the modulus buttons to trade spurious hits for bigger numbers.',
      check: function (t, p) { return p.length > t.length ? 'The pattern (' + p.length + ' letters) is longer than the text (' + t.length + ').' : ''; },
      onApply: function (t, p) { text = t; pat = p; reload(); }
    });
    function reload() { steps = generate(); view.reset(); view.prepare(steps); code.setSource(langs()); player.setSteps(steps); }
    V.segmented(fig.querySelector('[data-mod]'), {
      label: 'Modulus', value: String(q),
      options: [{ value: '7', label: '7 (tiny)' }, { value: '13', label: '13' }, { value: '101', label: '101' }, { value: '1009', label: '1009' }],
      onChange: function (v) { q = +v; reload(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Window' }, { state: 'compare', label: 'Hash hit: to verify' }, LEG.found, LEG.error, { state: 'done', label: 'Verified match' }, { state: 'swap', label: 'Leaving letter' }]);
    return { player: player, set: strIn.set };
  };

  /* ================================================================== Z-algorithm lab */
  SM.initZ = function () {
    var fig = V.$('#lab-z');
    var text = 'aabxaabaab', pat = 'aab';
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 42, minCell: 22, gapY: 44, textLabel: 's', patLabel: 'prefix copy', label: 'Z-array of pattern#text' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE.z, default: 'pseudo', maxHeight: 300 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    function generate() { return S().zSteps(pat, text); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', copies: 'Copied from the box' }, counterStates: { comparisons: 'compare', copies: 'key' },
      baseStepMs: 950, label: 'Z-algorithm lab controls'
    });
    player.addCheckpoint(function (st) { for (var k = 1; k < st.length; k++) if (st[k].kind === 'copy') return k; return -1; }, function (c) {
      var v = c.step.vars;
      return {
        question: '<code>i = ' + v.i + '</code> lies inside the Z-box [' + v.l + ', ' + v.r + '). Its mirror position <code>i − l = ' + (v.i - v.l) + '</code> has <code>Z = ' + v['Z[i-l]'] + '</code>, which ends before the box does. How many comparisons does <code>Z[' + v.i + ']</code> need?',
        options: ['About ' + v['Z[i-l]'] + ' (one per matching character)', 'None: it copies <code>Z[' + (v.i - v.l) + '] = ' + v['Z[i-l]'] + '</code> from the mirror', 'A full comparison from the start of <code>s</code>'],
        answer: 1,
        explain: [
          'That would be the naive way. Inside the box the text is a copy of the prefix, so the answer is already known.',
          'Right. The box says <code>s[l..r)</code> equals the start of <code>s</code>, so position <code>i</code> sees exactly what its mirror sees, and the mirror\'s match stops inside the box. Zero comparisons.',
          'That would repeat work the box already did.'
        ]
      };
    }, { id: 'l36-lab-z-copy' });
    var strIn = SM.strInputs(fig.querySelector('[data-input]'), {
      text: text, pat: pat, textLabel: 'Text (up to 14 letters, may be empty)', patLabel: 'Pattern (up to 6)', maxText: 14, maxPat: 6, allowEmptyText: true,
      presets: [
        { label: 'Default', value: { text: 'aabxaabaab', pat: 'aab' } },
        { label: 'aaaaaa', title: 'One big box that keeps being reused', value: { text: 'aaaaaaaa', pat: 'aaa' } },
        { label: 'Periodic', value: { text: 'abababababab', pat: 'abab' } },
        { label: 'No match', value: { text: 'xyzxyzxy', pat: 'abc' } },
        { label: 'Just Z of a word', title: 'Empty text: the Z-array of pattern#', value: { text: '', pat: 'abacaba' } }
      ],
      hint: 'The glued string is pattern + “#” + text. The # never matches a letter, so no Z value can run across the seam.',
      onApply: function (t, p) { text = t; pat = p; steps = generate(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Z-box [l, r)' }, LEG.found, LEG.error, { state: 'key', label: 'Mirror entry' }, { state: 'done', label: 'Z value written / match' }]);
    return { player: player, set: strIn.set };
  };
}());
