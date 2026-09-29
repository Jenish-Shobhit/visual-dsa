/* Lesson 22 · Tries — pure step generators (no DOM). UMD: VDSA.algos.tries in the browser, module.exports in Node.

     T.build(words, freqs?)                 -> trie {root, nodes, words}   (nodes = letter nodes; the root is not counted)
     T.opTrace(words, op, word, opts)       -> {steps, words, result}      op: 'insert' | 'search' | 'prefix' | 'delete'
     T.complete(trie, prefix, k)            -> {ok, path, node, failChar, all, top, subtree, visited}   autocomplete
     T.completeView(trie, prefix, opts)     -> tree view state lit for a prefix query (path, subtree, top results)
     T.raceSteps(words, prefix)             -> steps: hash set scanning every key vs the trie walking the prefix
     T.compressSteps(words)                 -> steps: plain trie folding into a radix (compressed) trie
     T.lpmSteps(routes, addr)               -> steps: longest-prefix match on a binary trie of routes
     T.growth(words)                        -> {nodes, letters, radix}     arrays after 0..n insertions
     T.layoutTrie(trie)                     -> {pos: {id: {x, depth}}, width, depth}   (leaf-spaced tidy layout)
     T.parseWords / T.parseWord / T.parseBits   friendly validation for custom input
     T.CODE[op]                             -> {pseudo, js, py} with // @labels matching step.line
     T.DICTIONARY, T.STEMS, T.randomWords(seed, n, len), T.ROUTES

   Every step is a complete snapshot: `tree` is a VDSA.views.tree state (n-ary for tries, binary for the route trie),
   plus the player fields caption, line, vars, counters, flow. Truth rules (tested): a node is 'found' only when the
   query really succeeds there, a node carries the end-of-word badge exactly when it ends a stored word, delete prunes
   only nodes that are neither word ends nor ancestors of other words, and counters only describe the trie on screen. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.tries = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var MAX_WORDS = 12, MAX_LEN = 8, MAX_LETTERS = 70;

  /* ------------------------------------------------------------------ helpers */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function code(s) { return '<code>' + esc(s) + '</code>'; }
  function where(prefix) { return prefix ? code(prefix) : 'the root'; }
  function plural(n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); }
  function idOf(prefix) { return 'p:' + prefix; }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ the trie model */
  function mk(prefix) {
    return { id: idOf(prefix), prefix: prefix, ch: prefix ? prefix[prefix.length - 1] : '', kids: {}, end: false, cnt: 0, freq: 0 };
  }
  function create() { return { root: mk(''), nodes: 0, words: 0 }; }
  function sortedKids(n) { return Object.keys(n.kids).sort().map(function (k) { return n.kids[k]; }); }

  function insertWord(t, w, freq) {
    var node = t.root, created = 0, chain = [t.root];
    for (var i = 0; i < w.length; i++) {
      var ch = w[i];
      if (!node.kids[ch]) { node.kids[ch] = mk(node.prefix + ch); created++; t.nodes++; }
      node = node.kids[ch]; chain.push(node);
    }
    var isNew = !node.end;
    if (isNew) { node.end = true; t.words++; chain.forEach(function (n) { n.cnt++; }); }
    if (freq !== undefined) node.freq = freq;
    return { created: created, isNew: isNew };
  }
  function find(t, prefix) {
    var node = t.root;
    for (var i = 0; i < prefix.length; i++) { node = node.kids[prefix[i]]; if (!node) return null; }
    return node;
  }
  function removeWord(t, w) {
    var path = [t.root], node = t.root;
    for (var i = 0; i < w.length; i++) { node = node.kids[w[i]]; if (!node) return false; path.push(node); }
    if (!node.end) return false;
    node.end = false; t.words--;
    path.forEach(function (n) { n.cnt--; });
    for (var j = w.length; j >= 1; j--) {
      var nd = path[j];
      if (nd.end || Object.keys(nd.kids).length) break;
      delete path[j - 1].kids[w[j - 1]]; t.nodes--;
    }
    return true;
  }
  function build(words, freqs) {
    var t = create();
    (words || []).forEach(function (w, i) { insertWord(t, w, freqs ? freqs[i] : undefined); });
    return t;
  }
  function wordsOf(t) {
    var out = [];
    (function rec(n) { if (n.end) out.push(n.prefix); sortedKids(n).forEach(rec); }(t.root));
    return out;
  }
  function radixCount(t) {
    var c = 0;
    (function rec(n) { if (n !== t.root && (n.end || Object.keys(n.kids).length >= 2)) c++; sortedKids(n).forEach(rec); }(t.root));
    return c;
  }

  /* ------------------------------------------------------------------ view state builder */
  /* o: {states: {id: state}, edgeStates: {childId: state}, pointers, badge: 'end'|'freq'|'count'|'none', badgeStates: {id: state}} */
  function treeView(t, o) {
    o = o || {};
    var st = o.states || {}, nodes = [], ids = {}, edges = [];
    (function rec(n) {
      var ks = sortedKids(n);
      var d = { id: n.id, label: n.prefix ? n.ch : 'root', children: ks.map(function (k) { return k.id; }), state: st[n.id] || 'default' };
      var mode = o.badge || 'end';
      if (mode === 'end' && n.end) { d.badge = '✓'; d.badgeState = 'found'; }
      else if (mode === 'freq' && n.end) { d.badge = String(n.freq); d.badgeState = (o.badgeStates && o.badgeStates[n.id]) || 'default'; }
      else if (mode === 'count' && n.prefix) { d.badge = String(n.cnt); d.badgeState = (o.badgeStates && o.badgeStates[n.id]) || 'default'; }
      nodes.push(d); ids[n.id] = true;
      ks.forEach(rec);
    }(t.root));
    var es = o.edgeStates || {};
    Object.keys(es).forEach(function (childId) {
      if (!ids[childId] || childId === idOf('')) return;
      edges.push({ from: idOf(childId.slice(2, -1)), to: childId, state: es[childId] });
    });
    return { root: idOf(''), nodes: nodes, edges: edges, pointers: o.pointers || [] };
  }

  function layoutTrie(t) {
    var x = 0, pos = {}, maxD = 0;
    (function rec(n, d) {
      var ks = sortedKids(n);
      if (d > maxD) maxD = d;
      if (!ks.length) { pos[n.id] = { x: x++, depth: d }; return; }
      ks.forEach(function (k) { rec(k, d + 1); });
      pos[n.id] = { x: (pos[ks[0].id].x + pos[ks[ks.length - 1].id].x) / 2, depth: d };
    }(t.root, 0));
    return { pos: pos, width: Math.max(x, 1), depth: maxD };
  }

  /* ------------------------------------------------------------------ input validation */
  function parseWords(text, o) {
    o = Object.assign({ maxCount: MAX_WORDS, maxLen: MAX_LEN, maxLetters: MAX_LETTERS, minCount: 0 }, o || {});
    var toks = String(text || '').toLowerCase().split(/[\s,;]+/).filter(Boolean), out = [], seen = {}, letters = 0;
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i];
      if (!/^[a-z]+$/.test(w)) return { values: null, error: 'Use only the letters a to z: “' + w + '” has something else in it.' };
      if (w.length > o.maxLen) return { values: null, error: '“' + w + '” is too long. Keep every word to ' + o.maxLen + ' letters or fewer.' };
      if (!seen[w]) { seen[w] = true; out.push(w); letters += w.length; }
    }
    if (out.length < o.minCount) return { values: null, error: 'Enter at least ' + plural(o.minCount, 'word') + '.' };
    if (out.length > o.maxCount) return { values: null, error: 'That is ' + out.length + ' words. Keep it to ' + o.maxCount + ' or fewer so the tree stays readable.' };
    if (letters > o.maxLetters) return { values: null, error: 'That is ' + letters + ' letters in total. Keep it under ' + o.maxLetters + ' so the tree fits.' };
    return { values: out, error: null };
  }
  function parseWord(text, o) {
    o = Object.assign({ maxLen: MAX_LEN, allowEmpty: false }, o || {});
    var w = String(text || '').trim().toLowerCase();
    if (!w) return o.allowEmpty ? { value: '', error: null } : { value: null, error: 'Type a word first.' };
    if (!/^[a-z]+$/.test(w)) return { value: null, error: 'Use only the letters a to z.' };
    if (w.length > o.maxLen) return { value: null, error: 'Keep it to ' + o.maxLen + ' letters or fewer.' };
    return { value: w, error: null };
  }
  function parseBits(text, o) {
    o = Object.assign({ min: 1, max: 8 }, o || {});
    var s = String(text || '').replace(/[\s.]/g, '');
    if (s.length < o.min) return { value: null, error: 'Type at least ' + o.min + ' bit.' };
    if (!/^[01]+$/.test(s)) return { value: null, error: 'An address is made of the bits 0 and 1 only.' };
    if (s.length > o.max) return { value: null, error: 'Keep it to ' + o.max + ' bits or fewer.' };
    return { value: s, error: null };
  }

  /* ------------------------------------------------------------------ code (pseudo / js / py) with // @labels */
  var CODE = {
    insert: {
      pseudo: [
        'insert(word)',
        '  node ← root                          // @init',
        '  for each letter ch in word           // @loop',
        '    if node has no child ch            // @check',
        '      node.child[ch] ← new node        // @create',
        '    node ← node.child[ch]              // @follow',
        '  node.isEnd ← true                    // @mark'
      ].join('\n'),
      js: [
        'function insert(root, word) {',
        '  let node = root;                                  // @init',
        '  for (const ch of word) {                          // @loop',
        '    if (!node.children.has(ch)) {                   // @check',
        '      node.children.set(ch, new TrieNode());        // @create',
        '    }',
        '    node = node.children.get(ch);                   // @follow',
        '  }',
        '  node.isEnd = true;                                // @mark',
        '}'
      ].join('\n'),
      py: [
        'def insert(root, word):',
        '    node = root                            # @init',
        '    for ch in word:                        # @loop',
        '        if ch not in node.children:        # @check',
        '            node.children[ch] = TrieNode() # @create',
        '        node = node.children[ch]           # @follow',
        '    node.is_end = True                     # @mark'
      ].join('\n')
    },
    search: {
      pseudo: [
        'search(word)',
        '  node ← root                          // @init',
        '  for each letter ch in word           // @loop',
        '    if node has no child ch            // @miss',
        '      return false',
        '    node ← node.child[ch]              // @follow',
        '  return node.isEnd                    // @ret'
      ].join('\n'),
      js: [
        'function search(root, word) {',
        '  let node = root;                              // @init',
        '  for (const ch of word) {                      // @loop',
        '    if (!node.children.has(ch)) return false;   // @miss',
        '    node = node.children.get(ch);               // @follow',
        '  }',
        '  return node.isEnd;                            // @ret',
        '}'
      ].join('\n'),
      py: [
        'def search(root, word):',
        '    node = root                        # @init',
        '    for ch in word:                    # @loop',
        '        if ch not in node.children:    # @miss',
        '            return False',
        '        node = node.children[ch]       # @follow',
        '    return node.is_end                 # @ret'
      ].join('\n')
    },
    prefix: {
      pseudo: [
        'startsWith(prefix)',
        '  node ← root                          // @init',
        '  for each letter ch in prefix         // @loop',
        '    if node has no child ch            // @miss',
        '      return false',
        '    node ← node.child[ch]              // @follow',
        '  return true                          // @ret'
      ].join('\n'),
      js: [
        'function startsWith(root, prefix) {',
        '  let node = root;                              // @init',
        '  for (const ch of prefix) {                    // @loop',
        '    if (!node.children.has(ch)) return false;   // @miss',
        '    node = node.children.get(ch);               // @follow',
        '  }',
        '  return true;                                  // @ret',
        '}'
      ].join('\n'),
      py: [
        'def starts_with(root, prefix):',
        '    node = root                        # @init',
        '    for ch in prefix:                  # @loop',
        '        if ch not in node.children:    # @miss',
        '            return False',
        '        node = node.children[ch]       # @follow',
        '    return True                        # @ret'
      ].join('\n')
    },
    delete: {
      pseudo: [
        'delete(word)',
        '  path ← [root]                        // @init',
        '  for each letter ch in word           // @loop',
        '    if last(path) has no child ch      // @miss',
        '      return false',
        '    push last(path).child[ch] onto path // @follow',
        '  if not last(path).isEnd              // @notword',
        '    return false',
        '  last(path).isEnd ← false             // @unmark',
        '  for i ← length(word) down to 1       // @prune',
        '    if path[i].isEnd or has children   // @keep',
        '      stop',
        '    remove path[i] from path[i−1]      // @cut',
        '  return true                          // @ret'
      ].join('\n'),
      js: [
        'function remove(root, word) {',
        '  const path = [root];                                  // @init',
        '  for (const ch of word) {                              // @loop',
        '    const next = path[path.length - 1].children.get(ch);',
        '    if (!next) return false;                            // @miss',
        '    path.push(next);                                    // @follow',
        '  }',
        '  const end = path[path.length - 1];',
        '  if (!end.isEnd) return false;                         // @notword',
        '  end.isEnd = false;                                    // @unmark',
        '  for (let i = word.length; i >= 1; i--) {              // @prune',
        '    const node = path[i];',
        '    if (node.isEnd || node.children.size > 0) break;    // @keep',
        '    path[i - 1].children.delete(word[i - 1]);           // @cut',
        '  }',
        '  return true;                                          // @ret',
        '}'
      ].join('\n'),
      py: [
        'def remove(root, word):',
        '    path = [root]                                    # @init',
        '    for ch in word:                                  # @loop',
        '        nxt = path[-1].children.get(ch)',
        '        if nxt is None:                              # @miss',
        '            return False',
        '        path.append(nxt)                             # @follow',
        '    if not path[-1].is_end:                          # @notword',
        '        return False',
        '    path[-1].is_end = False                          # @unmark',
        '    for i in range(len(word), 0, -1):                # @prune',
        '        node = path[i]',
        '        if node.is_end or node.children:             # @keep',
        '            break',
        '        del path[i - 1].children[word[i - 1]]        # @cut',
        '    return True                                      # @ret'
      ].join('\n')
    }
  };

  /* ------------------------------------------------------------------ lab traces: insert, search, prefix, delete */
  function opTrace(words, op, word, o) {
    o = o || {};
    var t = build(words), steps = [], path = [t.root], cur = t.root, visited = 1, result = false;
    var nodesBefore = t.nodes;

    function push(x) {
      var states = {}, edgeStates = {};
      path.forEach(function (n, k) { states[n.id] = 'path'; if (k > 0) edgeStates[n.id] = 'path'; });
      var here = x.cur || cur;
      states[here.id] = x.curState || 'active';
      if (x.states) Object.keys(x.states).forEach(function (k) { states[k] = x.states[k]; });
      var ptr = x.noPointer ? [] : [{ name: 'node', target: here.id, state: x.curState || 'active' }];
      var pos = x.i === undefined ? 0 : x.i;
      steps.push({
        kind: x.kind, op: op, word: word,
        tree: treeView(t, { states: states, edgeStates: edgeStates, pointers: ptr }),
        caption: x.caption, line: x.line, flow: x.flow || x.kind,
        vars: { word: word, ch: x.ch === undefined ? '' : x.ch, node: (x.cur || cur).prefix },
        varStates: { node: 'active', ch: 'compare' },
        counters: { nodes: t.nodes, words: t.words, visited: visited },
        i: pos
      });
    }

    var verb = { insert: 'Insert', search: 'Search for', prefix: 'Does any word start with', delete: 'Delete' }[op];
    if (!o.brief) {
      var startCap = {
        insert: verb + ' ' + code(word) + '. Each letter will either follow an existing child or create a new one, starting at the root.',
        search: verb + ' ' + code(word) + '. Spell it one letter at a time from the root; every letter must find a matching child.',
        prefix: verb + ' ' + code(word) + '? Spell it from the root. If every letter finds a child, the answer is yes, and the flag does not matter.',
        delete: verb + ' ' + code(word) + '. First walk down to its last letter and remember the path, so we can climb back up and prune.'
      }[op];
      push({ kind: 'start', caption: startCap, line: 'init', flow: 'start', cur: t.root, noPointer: false });
    }

    /* walk down: shared by all four operations */
    var dead = false;
    for (var i = 0; i < word.length && !dead; i++) {
      var ch = word[i], node = cur, child = node.kids[ch], spelled = word.slice(0, i + 1);
      if (child) {
        cur = child; path.push(cur); visited++;
        push({
          kind: 'follow', ch: ch, i: i, line: op === 'insert' ? ['loop', 'check', 'follow'] : ['loop', 'follow'],
          caption: op === 'insert'
            ? code(ch) + ' already hangs under ' + where(node.prefix) + ', so follow it. No new node: words that share the prefix ' + code(spelled) + ' share this node.'
            : 'The letter ' + code(ch) + ' matches a child of ' + where(node.prefix) + '. Step down to ' + code(spelled) + '; one letter costs one hop, however many words are stored.',
          flow: 'follow'
        });
      } else if (op === 'insert') {
        var made = mk(node.prefix + ch);
        node.kids[ch] = made; t.nodes++;
        cur = made; path.push(cur); visited++;
        push({
          kind: 'create', ch: ch, i: i, curState: 'frontier', line: ['loop', 'check', 'create', 'follow'],
          caption: where(node.prefix).replace(/^the root$/, 'The root') + ' has no child ' + code(ch) + ', so create one. From here on nothing is shared: the rest of ' + code(word) + ' needs its own nodes.',
          flow: 'create'
        });
        // every further letter also creates
      } else {
        push({
          kind: 'miss', ch: ch, i: i, curState: 'error', line: ['loop', 'miss'],
          caption: where(node.prefix).replace(/^the root$/, 'The root') + ' has no child ' + code(ch) + ', so no stored word starts with ' + code(spelled) + '. ' +
            (op === 'delete' ? code(word) + ' is not in the trie: nothing to delete.' : (op === 'search' ? code(word) + ' is absent.' : 'The answer is no.')),
          flow: 'miss'
        });
        dead = true;
      }
    }

    if (!dead) {
      if (op === 'insert') {
        var wasEnd = cur.end;
        if (!wasEnd) {
          cur.end = true; t.words++;
          path.forEach(function (n) { n.cnt++; });
        }
        result = !wasEnd;
        push({
          kind: 'mark', curState: wasEnd ? 'done' : 'found', line: 'mark',
          caption: wasEnd
            ? code(word) + ' is already flagged as a word, so nothing changes. A trie is a set: each word is stored once.'
            : 'Set the end-of-word flag on ' + code(word) + '. This flag is what makes it a stored word instead of just a prefix of longer words.',
          flow: 'mark'
        });
      } else if (op === 'search') {
        result = cur.end;
        push({
          kind: cur.end ? 'found' : 'prefixonly', curState: cur.end ? 'found' : 'compare', line: 'ret', flow: 'ret',
          caption: cur.end
            ? 'Every letter matched and the flag is set: ' + code(word) + ' is a stored word.'
            : 'Every letter matched, but the flag is not set: ' + code(word) + ' is only a <em>prefix</em> of longer words. The answer is false.'
        });
      } else if (op === 'prefix') {
        result = true;
        var sub = {};
        (function rec(n) { Object.keys(n.kids).forEach(function (k) { sub[n.kids[k].id] = 'visited'; rec(n.kids[k]); }); }(cur));
        push({
          kind: 'found', curState: 'found', states: sub, line: 'ret', flow: 'ret',
          caption: 'Every letter matched, so at least one stored word starts with ' + code(word) + '. The tinted subtree holds all of them.'
        });
      } else { /* delete */
        if (!cur.end) {
          push({
            kind: 'notword', curState: 'compare', line: 'notword', flow: 'notword',
            caption: code(word) + ' is only a prefix here: the flag is not set, so it was never stored. Nothing to delete.'
          });
        } else {
          result = true;
          cur.end = false; t.words--;
          path.forEach(function (n) { n.cnt--; });
          var last = path.length - 1, keepGoing = true;
          push({
            kind: 'unmark', curState: 'compare', line: 'unmark', flow: 'unmark',
            caption: 'Clear the flag: ' + code(word) + ' is no longer a word. But the nodes may still be needed by other words, so check before removing anything.'
          });
          for (var j = last; j >= 1 && keepGoing; j--) {
            var nd = path[j], hasKids = Object.keys(nd.kids).length > 0;
            cur = nd;
            if (nd.end || hasKids) {
              push({
                kind: 'keep', curState: 'done', line: ['prune', 'keep'], flow: 'keep',
                caption: code(nd.prefix) + (nd.end ? ' still ends the word ' + code(nd.prefix) : ' still has children') + ', so other words depend on it. Stop pruning here.'
              });
              keepGoing = false;
            } else {
              push({
                kind: 'cut', curState: 'error', line: ['prune', 'keep', 'cut'], flow: 'cut',
                caption: code(nd.prefix) + ' has no children and ends no word: nothing needs it any more. Cut it from ' + where(path[j - 1].prefix) + '.'
              });
              delete path[j - 1].kids[word[j - 1]]; t.nodes--;
              path = path.slice(0, j);
              cur = path[j - 1];
              if (j - 1 >= 1) {
                // the parent gets inspected next
                push({
                  kind: 'up', curState: 'active', line: 'prune', flow: 'up',
                  caption: 'Back at ' + code(cur.prefix) + '. Does it still earn its place?'
                });
              } else {
                push({
                  kind: 'end', curState: 'active', line: 'ret', flow: 'ret',
                  caption: 'Back at the root: every node that only served ' + code(word) + ' is gone, and the rest of the trie is untouched.'
                });
              }
            }
          }
          if (keepGoing === false) { /* finished by keep */ }
        }
      }
    }
    return { steps: steps, words: wordsOf(t), result: result, nodesBefore: nodesBefore, nodesAfter: t.nodes, trie: t };
  }

  /* one-step snapshot of a trie at rest (after typing a new word list) */
  function restStep(words, caption) {
    var t = build(words);
    return {
      kind: 'rest', op: 'rest', word: '',
      tree: treeView(t, { states: {}, edgeStates: {}, pointers: [] }),
      caption: caption || (t.words ? 'The trie holds ' + plural(t.words, 'word') + ' in ' + plural(t.nodes, 'letter node') + '. Pick an operation and press Run.' : 'An empty trie is just the root. Insert a word to grow it.'),
      line: null, flow: 'start',
      vars: { word: '', ch: '', node: '' }, varStates: {},
      counters: { nodes: t.nodes, words: t.words, visited: 0 }
    };
  }

  /* ------------------------------------------------------------------ autocomplete */
  function complete(t, prefix, k) {
    k = k === undefined ? 5 : k;
    var node = t.root, path = [t.root], failChar = null, matched = 0;
    for (var i = 0; i < prefix.length; i++) {
      var nx = node.kids[prefix[i]];
      if (!nx) { failChar = prefix[i]; break; }
      node = nx; path.push(node); matched++;
    }
    var ok = failChar === null, all = [], subtree = [];
    if (ok) {
      (function rec(n) {
        subtree.push(n.id);
        if (n.end) all.push({ word: n.prefix, freq: n.freq, id: n.id });
        sortedKids(n).forEach(rec);
      }(node));
    }
    var ranked = all.slice().sort(function (a, b) { return b.freq - a.freq || (a.word < b.word ? -1 : 1); });
    return { ok: ok, path: path, node: ok ? node : path[path.length - 1], failChar: failChar, matched: matched, all: all, ranked: ranked, top: ranked.slice(0, k), subtree: subtree, visited: subtree.length };
  }
  function completeView(t, prefix, o) {
    o = o || {};
    var c = complete(t, prefix, o.k === undefined ? 5 : o.k), states = {}, edgeStates = {}, badgeStates = {};
    var showing = o.order === 'dfs' ? c.all.slice(0, o.k === undefined ? 5 : o.k) : c.top;
    if (c.ok) c.subtree.forEach(function (id) { states[id] = 'visited'; });
    c.path.forEach(function (n, i) { states[n.id] = 'path'; if (i > 0) edgeStates[n.id] = 'path'; });
    states[c.node.id] = c.ok ? 'active' : 'error';
    showing.forEach(function (r) { states[r.id] = 'found'; badgeStates[r.id] = 'found'; });
    return { c: c, showing: showing, tree: treeView(t, { states: states, edgeStates: edgeStates, pointers: [], badge: 'freq', badgeStates: badgeStates }) };
  }

  /* ------------------------------------------------------------------ trie vs hash set: prefix count race */
  function raceSteps(words, prefix) {
    var t = build(words), n = words.length, L = prefix.length, steps = [];
    var walk = [t.root], missAt = -1;
    for (var i = 0; i < L; i++) {
      var ch = walk[walk.length - 1].kids[prefix[i]];
      if (!ch) { missAt = i; break; }
      walk.push(ch);
    }
    var trieTicks = missAt < 0 ? L + 1 : missAt + 1;
    var total = Math.max(n, trieTicks), expected = words.filter(function (w) { return w.indexOf(prefix) === 0; }).length;
    for (var tick = 0; tick <= total; tick++) {
      var checked = Math.min(tick, n), matches = 0, keyStates = [];
      for (var k = 0; k < n; k++) {
        if (k < checked) {
          var hit = words[k].indexOf(prefix) === 0;
          if (hit) matches++;
          keyStates.push(k === checked - 1 && tick <= n ? (hit ? 'found' : 'compare') : (hit ? 'found' : 'visited'));
        } else keyStates.push('default');
      }
      var tt = Math.min(tick, trieTicks), stepped = Math.min(tt, walk.length - 1), states = {}, edgeStates = {};
      var cur = walk[stepped];
      for (var p = 0; p <= stepped; p++) { states[walk[p].id] = 'path'; if (p > 0) edgeStates[walk[p].id] = 'path'; }
      states[cur.id] = tick === 0 ? 'default' : 'active';
      var trieDone = tt === trieTicks && tick > 0;
      if (trieDone) states[cur.id] = missAt < 0 ? 'found' : 'error';
      var hashDone = tick >= n && n > 0;
      var hashCap = tick === 0 ? 'Both sides start with the same words and the same question.' :
        (tick <= n ? 'The hash set tests ' + code(words[tick - 1]) + ' against the prefix: ' + (words[tick - 1].indexOf(prefix) === 0 ? 'a match (' + matches + ' so far).' : 'no match.') : 'The hash set is done.');
      var trieCap = tick === 0 ? '' :
        (tick <= (missAt < 0 ? L : missAt) ? ' The trie steps down ' + code(prefix.slice(0, tick)) + '.' :
          (missAt < 0 ? (tick === trieTicks ? ' The trie has arrived at ' + code(prefix) + ' and reads its stored count: <b>' + cur.cnt + '</b>. Done.' : ' The trie is done.') :
            (tick === trieTicks ? ' The trie finds no child ' + code(prefix[missAt]) + ': the count is <b>0</b>. Done.' : ' The trie is done.')));
      steps.push({
        kind: 'tick', tick: tick,
        keyStates: keyStates,
        tree: treeView(t, { states: states, edgeStates: edgeStates, pointers: [], badge: 'count', badgeStates: {} }),
        caption: hashCap + trieCap,
        counters: { keys: checked, nodes: stepped },
        matches: matches, expected: expected, trieDone: trieDone, hashDone: hashDone,
        trieCount: trieDone ? (missAt < 0 ? cur.cnt : 0) : null,
        hashCount: hashDone ? matches : null
      });
    }
    return steps;
  }

  /* ------------------------------------------------------------------ plain trie -> radix (compressed) trie */
  function compressSteps(words) {
    var t = build(words), steps = [], plain = t.nodes;
    var letters = 0; words.forEach(function (w) { letters += w.length; });
    function conv(n) { return { id: n.id, label: n.prefix ? n.ch : 'root', end: n.end, kids: sortedKids(n).map(conv) }; }
    var rt = conv(t.root);
    function count(n, isRoot) { var c = isRoot ? 0 : 1; n.kids.forEach(function (k) { c += count(k, false); }); return c; }
    function view(states) {
      var nodes = [];
      (function rec(n) {
        var d = { id: n.id, label: n.label, children: n.kids.map(function (k) { return k.id; }), state: (states && states[n.id]) || 'default' };
        if (n.end) { d.badge = '✓'; d.badgeState = 'found'; }
        nodes.push(d); n.kids.forEach(rec);
      }(rt));
      return { root: idOf(''), nodes: nodes, edges: [], pointers: [] };
    }
    function push(kind, caption, states) {
      var c = count(rt, true);
      steps.push({ kind: kind, tree: view(states), caption: caption, counters: { nodes: c, saved: plain - c, letters: letters } });
    }
    push('plain', 'The plain trie for these words: one node per letter, ' + plural(plain, 'node') + ' in all. Look for chains where a node has exactly one child and ends no word.');
    for (;;) {
      var cand = null;
      (function find1(n, isRoot) {
        if (cand) return;
        if (!isRoot && n.kids.length === 1 && !n.end) { cand = n; return; }
        n.kids.forEach(function (k) { find1(k, false); });
      }(rt, true));
      if (!cand) break;
      var child = cand.kids[0], left = cand.label, right = child.label;
      cand.label = left + right; cand.kids = child.kids; cand.end = child.end;
      var states = {}; states[cand.id] = 'frontier';
      push('merge', code(left) + ' has one child and does not end a word, so nothing ever branches or stops between ' + code(left) + ' and ' + code(right) + '. Fold them into one node ' + code(cand.label) + '.', states);
    }
    var fin = count(rt, true);
    push('done', 'No chain is left. The same words now take ' + plural(fin, 'node') + ' instead of ' + plain + ': every remaining node is a word end or a fork. The letters are all still stored, just packed into labels.', {});
    return steps;
  }

  /* ------------------------------------------------------------------ longest-prefix match on a binary trie */
  var ROUTES = [['', 'G'], ['0', 'A'], ['00', 'F'], ['10', 'B'], ['101', 'C'], ['1011', 'D'], ['110', 'E']];

  function buildBits(routes) {
    var rootN = { id: idOf(''), prefix: '', kids: {}, hop: null };
    routes.forEach(function (r) {
      var n = rootN, p = r[0];
      for (var i = 0; i < p.length; i++) {
        var b = p[i];
        if (!n.kids[b]) n.kids[b] = { id: idOf(n.prefix + b), prefix: n.prefix + b, kids: {}, hop: null };
        n = n.kids[b];
      }
      n.hop = r[1];
    });
    return rootN;
  }
  function lpmRef(routes, addr) {
    var best = null;
    routes.forEach(function (r) {
      if (addr.indexOf(r[0]) === 0 && (best === null || r[0].length > best[0].length)) best = r;
    });
    return best;
  }
  function bitsView(rootN, states, edgeStates, ptrs) {
    var nodes = [];
    (function rec(n) {
      var d = { id: n.id, label: n.prefix ? n.prefix[n.prefix.length - 1] : 'root', state: (states && states[n.id]) || 'default' };
      if (n.kids['0']) d.left = n.kids['0'].id;
      if (n.kids['1']) d.right = n.kids['1'].id;
      if (n.hop) { d.badge = n.hop; d.badgeState = (states && states[n.id] === 'found') ? 'found' : 'default'; }
      nodes.push(d);
      if (n.kids['0']) rec(n.kids['0']);
      if (n.kids['1']) rec(n.kids['1']);
    }(rootN));
    var edges = [];
    Object.keys(edgeStates || {}).forEach(function (childId) { edges.push({ from: idOf(childId.slice(2, -1)), to: childId, state: edgeStates[childId] }); });
    return { root: idOf(''), nodes: nodes, edges: edges, pointers: ptrs || [] };
  }
  function lpmSteps(routes, addr) {
    var rootN = buildBits(routes), steps = [], cur = rootN, path = [rootN], best = rootN.hop ? rootN : null;
    function bitsState(i, cursorOn) {
      return {
        items: addr.split('').map(function (b, k) { return { id: 'b' + k, value: b, state: k < i ? 'visited' : (k === i && cursorOn ? 'active' : 'default') }; }),
        pointers: cursorOn && i < addr.length ? [{ name: 'next bit', index: i, state: 'active' }] : [],
        label: 'address bits'
      };
    }
    function push(kind, i, caption, line, flow, o) {
      o = o || {};
      var states = {}, edgeStates = {};
      path.forEach(function (n, k) { states[n.id] = 'path'; if (k > 0) edgeStates[n.id] = 'path'; });
      if (best) states[best.id] = 'found';
      if (!best || cur.id !== best.id) states[cur.id] = o.curState || 'active';
      steps.push({
        kind: kind, i: i, tree: bitsView(rootN, states, edgeStates, [{ name: 'node', target: cur.id, state: 'active' }]),
        bits: bitsState(i, !o.noCursor),
        caption: caption, line: line, flow: flow,
        vars: { bit: i < addr.length ? addr[i] : '–', node: cur.prefix, best: best ? (best.prefix || 'default') + ' → ' + best.hop : 'none' },
        varStates: { node: 'active', best: 'found' },
        counters: { read: i, bestLen: best ? best.prefix.length : -1 },
        bestId: best ? best.id : null, bestHop: best ? best.hop : null, bestPrefix: best ? best.prefix : null
      });
    }
    push('start', 0, 'Start at the root, before reading any bit. ' + (best ? 'The root carries the default route ' + code(best.hop) + ': that is the answer if nothing more specific matches.' : 'There is no default route, so unless a longer prefix matches the packet is dropped.'), 'init', 'start');
    var i = 0, stopped = false;
    while (i < addr.length && !stopped) {
      var b = addr[i], nx = cur.kids[b];
      if (!nx) {
        push('stop', i, 'No child for bit ' + code(b) + ' below ' + (cur.prefix ? code(cur.prefix) : 'the root') + '. Nothing longer can match, so the walk ends. The last route we remembered wins.', ['loop', 'follow', 'stop'], 'stop', { curState: 'error' });
        stopped = true; break;
      }
      cur = nx; path.push(cur); i++;
      if (cur.hop) {
        var better = !best || cur.prefix.length > best.prefix.length;
        best = better ? cur : best;
        push('route', i, 'Bit ' + code(b) + ' leads to ' + code(cur.prefix) + ', which holds a route to ' + code(cur.hop) + '. It is longer than any route seen so far, so it becomes the new best.', ['loop', 'follow', 'update'], 'route');
      } else {
        push('follow', i, 'Bit ' + code(b) + ' leads to ' + code(cur.prefix) + '. No route stored here, but longer routes may lie below, so keep reading.', ['loop', 'follow'], 'follow');
      }
    }
    var res = best;
    push('result', i, res ? 'Longest matching prefix: ' + code((res.prefix || 'default') + (res.prefix ? '*' : '')) + ' (' + res.prefix.length + ' bits). Forward the packet to ' + code(res.hop) + '.' : 'No route matches: drop the packet.', 'ret', 'result', { noCursor: true });
    return steps;
  }

  /* ------------------------------------------------------------------ growth: nodes created vs words inserted */
  function growth(words) {
    var t = create(), nodes = [0], letters = [0], radix = [0], L = 0;
    words.forEach(function (w) {
      insertWord(t, w);
      L += w.length;
      nodes.push(t.nodes); letters.push(L); radix.push(radixCount(t));
    });
    return { nodes: nodes, letters: letters, radix: radix };
  }

  /* ------------------------------------------------------------------ word lists */
  var DICTIONARY = ('car card care careful cart cat cats catch cab cabin can candy cap cape capital captain ' +
    'dog dot done door down draw dream drink drive dry ' +
    'sea seat second secret see seed seem sell send sense set ' +
    'tea team tear tell ten tent term test text than that the then there they thing think ' +
    'star start state stay step stick still stone stop store story ' +
    'mad make man many map mark match may meet men mind miss').split(' ');
  var STEMS = ['play', 'played', 'player', 'players', 'playing', 'plays', 'playful', 'plan', 'planet', 'plant', 'planted', 'planting'];
  function randomWords(seed, n, len) {
    var r = mulberry(seed), out = [], seen = {};
    while (out.length < n) {
      var w = '';
      for (var i = 0; i < len; i++) w += String.fromCharCode(97 + Math.floor(r() * 26));
      if (!seen[w]) { seen[w] = true; out.push(w); }
    }
    return out;
  }
  /* random strings with exactly the same length profile as `words` (a fair "no shared prefixes" baseline) */
  function randomLike(words, seed) {
    var r = mulberry(seed), out = [], seen = {};
    words.forEach(function (w) {
      var x;
      do { x = ''; for (var i = 0; i < w.length; i++) x += String.fromCharCode(97 + Math.floor(r() * 26)); } while (seen[x]);
      seen[x] = true; out.push(x);
    });
    return out;
  }
  function shuffled(arr, seed) {
    var a = arr.slice(), r = mulberry(seed);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  return {
    MAX_WORDS: MAX_WORDS, MAX_LEN: MAX_LEN, MAX_LETTERS: MAX_LETTERS,
    create: create, insertWord: insertWord, removeWord: removeWord, find: find, build: build, wordsOf: wordsOf,
    radixCount: radixCount, sortedKids: sortedKids, treeView: treeView, layoutTrie: layoutTrie, idOf: idOf,
    parseWords: parseWords, parseWord: parseWord, parseBits: parseBits,
    CODE: CODE, opTrace: opTrace, restStep: restStep,
    complete: complete, completeView: completeView, raceSteps: raceSteps, compressSteps: compressSteps,
    ROUTES: ROUTES, buildBits: buildBits, lpmSteps: lpmSteps, lpmRef: lpmRef,
    growth: growth, DICTIONARY: DICTIONARY, STEMS: STEMS, randomWords: randomWords, randomLike: randomLike, shuffled: shuffled,
    esc: esc
  };
}));
