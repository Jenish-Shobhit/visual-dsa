/* Lesson 22 · Tries — the lab (insert / search / starts-with / delete on your own words) and the flowchart that
   follows it. The trie persists between operations: each operation produces a trace from the current words
   (js/algos/22-tries.js), the player shows it, and the result becomes the new trie.
   Checkpoints are registered at page load, so the page score total does not jump. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, T = V.algos.tries, L = V.lesson22;

  var DEFAULT_WORDS = ['car', 'card', 'care', 'cat', 'dog'];
  var OPS = [
    { value: 'insert', label: 'Insert', word: 'Word to insert', run: 'Insert', quick: ['cart', 'ca', 'cat', 'do', 'zoo'] },
    { value: 'search', label: 'Search', word: 'Word to search for', run: 'Search', quick: ['car', 'ca', 'cards', 'dog', 'cow'] },
    { value: 'prefix', label: 'Starts with', word: 'Prefix to look for', run: 'Check', quick: ['ca', 'car', 'do', 'x'] },
    { value: 'delete', label: 'Delete', word: 'Word to delete', run: 'Delete', quick: ['card', 'car', 'dog', 'ca', 'cow'] }
  ];

  /* ================================================================== flowchart specs */
  function walkSpec(retText) {
    return {
      nodes: [
        { id: 'start', type: 'start', text: 'node ← root', col: 0, row: 0 },
        { id: 'more', type: 'decision', text: 'letters left?', col: 0, row: 1 },
        { id: 'ret', type: 'end', text: retText, col: 1, row: 1 },
        { id: 'has', type: 'decision', text: 'child ch exists?', col: 0, row: 2 },
        { id: 'miss', type: 'end', text: 'return false', col: 1, row: 2 },
        { id: 'follow', type: 'process', text: 'node ← child ch', col: 0, row: 3 }
      ],
      edges: [
        { from: 'start', to: 'more' },
        { from: 'more', to: 'has', label: 'yes' },
        { from: 'more', to: 'ret', label: 'no' },
        { from: 'has', to: 'follow', label: 'yes' },
        { from: 'has', to: 'miss', label: 'no' },
        { from: 'follow', to: 'more' }
      ]
    };
  }
  var SPECS = {
    insert: {
      nodes: [
        { id: 'start', type: 'start', text: 'node ← root', col: 0, row: 0 },
        { id: 'more', type: 'decision', text: 'letters left?', col: 0, row: 1 },
        { id: 'mark', type: 'end', text: 'node.isEnd ← true', col: 1, row: 1 },
        { id: 'has', type: 'decision', text: 'child ch exists?', col: 0, row: 2 },
        { id: 'create', type: 'process', text: 'create child ch', col: 1, row: 2 },
        { id: 'follow', type: 'process', text: 'node ← child ch', col: 0, row: 3 }
      ],
      edges: [
        { from: 'start', to: 'more' },
        { from: 'more', to: 'has', label: 'yes' },
        { from: 'more', to: 'mark', label: 'no' },
        { from: 'has', to: 'follow', label: 'yes' },
        { from: 'has', to: 'create', label: 'no' },
        { from: 'create', to: 'follow' },
        { from: 'follow', to: 'more' }
      ]
    },
    search: walkSpec('return node.isEnd'),
    prefix: walkSpec('return true'),
    delete: {
      nodes: [
        { id: 'start', type: 'start', text: 'path ← [root]', col: 1, row: 0 },
        { id: 'more', type: 'decision', text: 'letters left?', col: 1, row: 1 },
        { id: 'has', type: 'decision', text: 'child ch exists?', col: 1, row: 2 },
        { id: 'miss', type: 'end', text: 'return false', col: 0, row: 2 },
        { id: 'follow', type: 'process', text: 'push child on path', col: 1, row: 3 },
        { id: 'isEnd', type: 'decision', text: 'last.isEnd ?', col: 2, row: 1 },
        { id: 'notword', type: 'end', text: 'return false', col: 3, row: 1 },
        { id: 'unmark', type: 'process', text: 'last.isEnd ← false', col: 2, row: 2 },
        { id: 'keep', type: 'decision', text: 'node still needed?', col: 2, row: 3 },
        { id: 'stop', type: 'end', text: 'stop: return true', col: 3, row: 3 },
        { id: 'cut', type: 'process', text: 'cut node from parent', col: 2, row: 4 }
      ],
      edges: [
        { from: 'start', to: 'more' },
        { from: 'more', to: 'has', label: 'yes' },
        { from: 'more', to: 'isEnd', label: 'no' },
        { from: 'has', to: 'follow', label: 'yes' },
        { from: 'has', to: 'miss', label: 'no' },
        { from: 'follow', to: 'more', via: { fromSide: 'left', toSide: 'left', points: [[0.5, 3], [0.5, 1]] } },
        { from: 'isEnd', to: 'notword', label: 'no' },
        { from: 'isEnd', to: 'unmark', label: 'yes' },
        { from: 'unmark', to: 'keep' },
        { from: 'keep', to: 'stop', label: 'yes' },
        { from: 'keep', to: 'cut', label: 'no' },
        { from: 'cut', to: 'keep', via: { fromSide: 'left', toSide: 'left', points: [[1.5, 4], [1.5, 3]] } }
      ]
    }
  };
  var ROUTES = {
    insert: { start: ['start'], follow: ['more', 'has', 'follow'], create: ['more', 'has', 'create'], mark: ['more', 'mark'] },
    search: { start: ['start'], follow: ['more', 'has', 'follow'], miss: ['more', 'has', 'miss'], ret: ['more', 'ret'] },
    prefix: { start: ['start'], follow: ['more', 'has', 'follow'], miss: ['more', 'has', 'miss'], ret: ['more', 'ret'] },
    delete: {
      start: ['start'], follow: ['more', 'has', 'follow'], miss: ['more', 'has', 'miss'], notword: ['more', 'isEnd', 'notword'],
      unmark: ['more', 'isEnd', 'unmark'], keep: ['unmark', 'keep', 'stop'], cut: ['keep', 'cut'], up: ['cut', 'keep'], ret: ['cut', 'keep', 'stop']
    }
  };
  var TITLES = { insert: 'Insert', search: 'Search', prefix: 'Starts with', delete: 'Delete' };
  var FOOTS = {
    insert: 'Text alternative: start at the root. While letters remain, look for a child for the next letter; if it does not exist, create it; then step onto it. When the letters run out, set the end-of-word flag.',
    search: 'Text alternative: start at the root. For each letter, if there is no child for it return false; otherwise step onto the child. After the last letter, return the end-of-word flag.',
    prefix: 'Text alternative: start at the root. For each letter, if there is no child for it return false; otherwise step onto the child. After the last letter return true, whatever the flag says.',
    delete: 'Text alternative: walk down the word, pushing each node on a path; return false if a letter is missing or the last node is not flagged. Clear the flag, then climb the path: stop at the first node that is flagged or has children, otherwise cut it from its parent and continue with its parent.'
  };

  var current = { op: 'insert', words: DEFAULT_WORDS.slice() };
  var flow = null, seg = null, labApi = null;

  function flowFigure() {
    var fig = V.$('#fig-flow');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Boxes passed on the way' }]);
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), SPECS.insert, { label: 'Trie operation flowchart' });
    var title = fig.querySelector('[data-flow-title]'), foot = fig.querySelector('[data-flow-foot]');
    var op = 'insert';
    function nodeIds() { return SPECS[op].nodes.map(function (n) { return n.id; }); }
    function setOp(next) {
      if (next === op && flow) return;
      op = next;
      view.setSpec(SPECS[op]);
      view.render({}, { duration: 0 });
      title.textContent = TITLES[op] + ' as a flowchart';
      foot.textContent = FOOTS[op];
      if (segF && segF.value !== op) segF.set(op);
    }
    var segF = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operation', value: 'insert',
      options: OPS.map(function (o) { return { value: o.value, label: o.label }; }),
      onChange: function (v) { if (labApi) labApi.setOp(v); else setOp(v); }
    });
    foot.textContent = FOOTS.insert;
    flow = {
      setOp: setOp,
      highlight: function (id, ctx) {
        var ids = nodeIds(), route = (ROUTES[op] && ROUTES[op][id]) || (id ? [id] : []);
        route = route.filter(function (r) { return ids.indexOf(r) !== -1; });
        view.render({ active: route.length ? route[route.length - 1] : null, visited: route.slice(0, -1) }, { duration: ctx ? ctx.duration : 0 });
      }
    };
  }

  /* ================================================================== the lab */
  function lab() {
    var fig = V.$('#lab-fig');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'path', label: 'Path walked' },
      { state: 'active', label: 'Current node' },
      { state: 'frontier', label: 'New node' },
      { state: 'found', shape: 'ring', label: 'Word ends here (✓)' },
      { state: 'compare', label: 'Reached, not a word' },
      { state: 'error', label: 'Dead end / cut' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    var view = L.treeView(stage, { nodeSize: 40, label: 'Trie being traced' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: T.CODE.insert, default: 'pseudo', maxHeight: 360 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { word: 'key', ch: 'compare', node: 'active' } });

    var first = [T.restStep(current.words)];
    view.prepare(first.map(function (st) { return st.tree; }));
    var player = V.player({
      root: fig, steps: first, baseStepMs: 1000, animMs: 620, label: 'Trie lab controls',
      render: function (step, ctx) { view.render(step.tree, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flow || undefined,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: { nodes: 'Letter nodes', words: 'Words stored', visited: 'Visited by this op' },
      counterStates: { nodes: 'frontier', words: 'found', visited: 'path' }
    });

    /* predict before reveal: walking down (insert / search / starts-with) and pruning (delete) */
    player.addCheckpoint(
      function (steps) {
        var s0 = steps[0];
        if (!s0 || s0.op === 'rest' || s0.op === 'delete') return -1;
        for (var k = 1; k < steps.length; k++) {
          var st = steps[k];
          if (s0.op === 'insert' && (st.kind === 'follow' || st.kind === 'create') && st.i >= 1) return k;
          if (s0.op !== 'insert' && (st.kind === 'miss' || st.kind === 'found' || st.kind === 'prefixonly')) return k;
        }
        return -1;
      },
      function (c) {
        var op = c.step.op, at = c.prev.vars.node, w = c.step.word;
        var where = at ? '<code>' + at + '</code>' : 'the root';
        if (op === 'insert') {
          var ch = c.step.vars.ch, follow = c.step.kind === 'follow';
          return {
            question: 'Inserting <code>' + w + '</code>. The walk stands at ' + where + ' and the next letter is <code>' + ch + '</code>. What happens?',
            options: ['Follow the child <code>' + ch + '</code> that already exists', 'Create a new node <code>' + ch + '</code>'],
            answer: follow ? 0 : 1,
            explain: follow
              ? ['Yes: some earlier word already spelled <code>' + at + ch + '</code>, so its node exists. Sharing it is the whole point of a trie.', 'There is no need: a child <code>' + ch + '</code> already hangs under ' + where + '. It was made by an earlier word.']
              : ['No such child exists yet: no stored word starts with <code>' + at + ch + '</code>. Following needs a node to follow.', 'Right: no stored word starts with <code>' + at + ch + '</code>, so the trie must grow here.']
          };
        }
        if (c.step.kind === 'miss') {
          var mc = c.step.vars.ch;
          return {
            question: 'The walk stands at ' + where + ' and the next letter is <code>' + mc + '</code>. Is there a child <code>' + mc + '</code>?',
            options: ['Yes, step onto it', 'No, the walk falls off the trie'],
            answer: 1,
            explain: ['Look at the children of ' + where + ' in the figure: none is labelled <code>' + mc + '</code>.', 'Right: no stored word starts with <code>' + at + mc + '</code>, so the query fails here without reading another letter.']
          };
        }
        var isWord = c.step.kind === 'found' && op === 'search';
        if (op === 'prefix') {
          return {
            question: 'Every letter of <code>' + w + '</code> matched a child. Does the answer depend on the end-of-word flag?',
            options: ['Yes: the node must be flagged', 'No: reaching the node is enough'],
            answer: 1,
            explain: ['That is the rule for <em>search</em>. Starts-with only asks whether any word continues from here, and the node exists, so some word does.', 'Right: a prefix query only needs the path to exist. The subtree below holds the words.']
          };
        }
        return {
          question: 'Every letter of <code>' + w + '</code> matched a child. Is <code>' + w + '</code> a stored word?',
          options: ['Yes, because the path exists', 'Not necessarily: it depends on the ✓ flag'],
          answer: 1,
          explain: ['A path only shows that some word <em>starts</em> with <code>' + w + '</code>; it may be just a prefix, so the path alone does not settle it. Only the flag does.', isWord ? 'Right: the path is not enough, the flag decides. Here the flag is set, so it is a word.' : 'Right: the path is not enough, the flag decides. Here the flag is not set: <code>' + w + '</code> is only a prefix, so the answer is false.']
        };
      },
      { id: 'tries-lab-walk' });
    player.addCheckpoint(
      function (steps) {
        var s0 = steps[0];
        if (!s0 || s0.op !== 'delete') return -1;
        for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'cut' || steps[k].kind === 'keep') return k;
        return -1;
      },
      function (c) {
        var node = c.step.vars.node, cut = c.step.kind === 'cut';
        return {
          question: 'The flag on <code>' + c.step.word + '</code> is now clear. Should delete also remove the node <code>' + node + '</code>?',
          options: ['Yes: it has no children and ends no word', 'No: something still needs it'],
          answer: cut ? 0 : 1,
          explain: cut
            ? ['Right: with no flag and no children, nothing can be reached through <code>' + node + '</code>, so it only wastes memory. It is cut, and its parent is checked next.', 'Something would need it only if it had a child or a flag. It has neither.']
            : ['A node is dead weight only if it has no children and no flag. This one does.', 'Right: <code>' + node + '</code> still ' + (c.step.tree.nodes.find(function (n) { return n.id === 'p:' + node; }).badge ? 'ends a word' : 'has children') + ', so other words depend on it and pruning stops.']
        };
      },
      { id: 'tries-lab-prune' });

    /* ---- controls */
    var parseWordsText = L.parseAdapter(T.parseWords);
    var wordsRow = V.inputRow(fig.querySelector('[data-words]'), {
      label: 'Words in the trie (up to ' + T.MAX_WORDS + ', a to z)', value: DEFAULT_WORDS, placeholder: 'e.g. car, card, cat',
      parse: function (text) {
        var r = parseWordsText(text);
        /* a failed or blank Build keeps its error, but the field goes back to the words the lab really holds */
        if (r.error) {
          wordsRow.field.value = current.words.join(', ');
          r = { error: r.error + ' The lab still holds: ' + (current.words.length ? current.words.join(', ') : 'no words') + '.' };
        }
        return r;
      }, applyLabel: 'Build',
      presets: [
        { label: 'car · card · care · cat · dog', value: DEFAULT_WORDS },
        { label: 'tea · team · ten · tap', value: ['tea', 'team', 'ten', 'tap'] },
        { label: 'play family', value: ['play', 'played', 'player', 'plan', 'plant'] },
        { label: 'One word', value: ['banana'] },
        { label: 'Empty', value: '' }
      ],
      onApply: function (words) { rest(words); wordsRow.set(words, false); /* show the cleaned list the lab holds */ }
    });
    var opSeg = V.segmented(fig.querySelector('[data-op]'), {
      label: 'Operation', value: 'insert',
      options: OPS.map(function (o) { return { value: o.value, label: o.label }; }),
      onChange: function (v) { setOp(v); }
    });
    var wordRow = V.inputRow(fig.querySelector('[data-word]'), {
      label: OPS[0].word, value: 'cart', placeholder: 'a word', applyLabel: OPS[0].run,
      parse: L.parseAdapter(T.parseWord, { maxLen: T.MAX_LEN }), onApply: function (w) { runOp(w); }
    });
    var quick = fig.querySelector('[data-quick]');
    function drawQuick() {
      V.clear(quick);
      quick.appendChild(h('span', { class: 'tr-quick__label' }, 'Try:'));
      OPS.filter(function (o) { return o.value === current.op; })[0].quick.forEach(function (w) {
        quick.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { wordRow.set(w); } }, w));
      });
    }
    function setOp(op) {
      current.op = op;
      var o = OPS.filter(function (x) { return x.value === op; })[0];
      code.setSource(T.CODE[op]);
      wordRow.el.querySelector('label').textContent = o.word;
      wordRow.el.querySelector('.btn--primary').textContent = o.run;
      opSeg.set(op);
      if (flow) flow.setOp(op);
      drawQuick();
    }
    function load(steps) {
      view.reset();
      view.prepare(steps.map(function (st) { return st.tree; }));
      player.setSteps(steps);
    }
    function rest(words) {
      current.words = words;
      load([T.restStep(words)]);
    }
    function runOp(word) {
      var op = current.op;
      if (op === 'insert') {
        var t = T.build(current.words);
        if (!T.find(t, word) || !T.find(t, word).end) {
          if (current.words.length >= T.MAX_WORDS) { wordRow.setError('The lab holds up to ' + T.MAX_WORDS + ' words. Delete one first, or press Build with a shorter list.'); return; }
          var letters = current.words.join('').length + word.length;
          if (letters > T.MAX_LETTERS) { wordRow.setError('That would go past ' + T.MAX_LETTERS + ' letters in total. Delete a word first.'); return; }
        }
      }
      var r = T.opTrace(current.words, op, word);
      current.words = r.words;
      load(r.steps);
      wordsRow.set(r.words, false);
      player.play();
    }
    L.centerScroll(stage);
    labApi = { setOp: setOp };
    drawQuick();
    L.lab = { player: player, view: view, run: runOp, setOp: setOp };
  }

  V.ready(function () {
    flowFigure();
    lab();
  });
}());
