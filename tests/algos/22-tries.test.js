/* Lesson 22 · Tries — tests for the pure generators in js/algos/22-tries.js.
   Everything is compared with straightforward references (a Set of words, string startsWith, brute-force longest
   prefix), on random inputs from VDSA.rng and on edge cases: empty trie, single letters, duplicates, words that are
   prefixes of other words, absent words, deleting every word, unknown prefixes.
   Run: node --test tests/algos/22-tries.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const T = require(path.join(ROOT, 'js', 'algos', '22-tries.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));
const STATES = new Set(Object.keys(core.STATES));

/* ---------------------------------------------------------------- references */
function randWords(rng, n, alphabet = 'abc', maxLen = 5) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const len = rng.int(1, maxLen);
    let w = '';
    for (let k = 0; k < len; k++) w += alphabet[rng.int(0, alphabet.length - 1)];
    out.push(w);
  }
  return out;
}
const uniq = (a) => [...new Set(a)];
/* number of distinct non-empty prefixes = number of letter nodes */
const refNodes = (words) => new Set(words.flatMap((w) => [...w].map((_, i) => w.slice(0, i + 1)))).size;
const refRadix = (words) => {
  const prefixes = new Set(words.flatMap((w) => [...w].map((_, i) => w.slice(0, i + 1))));
  let c = 0;
  for (const p of prefixes) {
    const kids = new Set([...prefixes].filter((q) => q.length === p.length + 1 && q.startsWith(p)).map((q) => q[q.length - 1]));
    if (words.includes(p) || kids.size >= 2) c++;
  }
  return c;
};

/* every snapshot must be a valid tree state and truthful about the trie on screen */
function checkTree(tree, t, label) {
  const ids = new Map(tree.nodes.map((n) => [n.id, n]));
  assert.equal(ids.size, tree.nodes.length, label + ': duplicate node ids');
  assert.ok(ids.has(tree.root), label + ': root missing');
  tree.nodes.forEach((n) => {
    assert.ok(STATES.has(n.state), label + ': bad state ' + n.state);
    (n.children || []).forEach((c) => assert.ok(ids.has(c), label + ': dangling child ' + c));
  });
  return ids;
}

/* ---------------------------------------------------------------- the model */
test('build: node and word counts match the distinct prefixes and words', () => {
  const rng = core.rng(22);
  for (let round = 0; round < 60; round++) {
    const words = uniq(randWords(rng, rng.int(0, 12)));
    const t = T.build(words);
    assert.equal(t.nodes, refNodes(words));
    assert.equal(t.words, words.length);
    assert.deepEqual(T.wordsOf(t), words.slice().sort());
    assert.equal(T.radixCount(t), refRadix(words));
    words.forEach((w) => assert.ok(T.find(t, w).end));
  }
});

test('build: empty, single letter, duplicates and prefix words', () => {
  assert.equal(T.build([]).nodes, 0);
  assert.equal(T.build(['a']).nodes, 1);
  const dup = T.build(['car', 'car']);
  assert.equal(dup.words, 1);
  assert.equal(dup.nodes, 3);
  const pre = T.build(['car', 'card', 'care', 'cat']);
  assert.equal(pre.nodes, 6);
  assert.equal(T.find(pre, 'car').end, true);
  assert.equal(T.find(pre, 'ca').end, false);
  assert.equal(T.find(pre, 'cax'), null);
  assert.equal(T.find(pre, 'ca').cnt, 4, 'cnt counts the words that pass through a node');
});

test('removeWord prunes exactly the dead nodes and never breaks other words', () => {
  const rng = core.rng(5);
  for (let round = 0; round < 80; round++) {
    const words = uniq(randWords(rng, rng.int(1, 10)));
    const t = T.build(words);
    const order = core.shuffle(words.slice(), rng);
    const alive = new Set(words);
    for (const w of order) {
      assert.equal(T.removeWord(t, w), true);
      alive.delete(w);
      assert.equal(T.removeWord(t, w), false, 'second delete finds nothing');
      assert.deepEqual(T.wordsOf(t), [...alive].sort());
      assert.equal(t.nodes, refNodes([...alive]), 'no dead branches remain and no live one was cut');
      assert.equal(t.words, alive.size);
    }
    assert.equal(t.nodes, 0);
  }
});

/* ---------------------------------------------------------------- lab traces */
test('opTrace matches a Set-of-words reference for insert, search, prefix and delete', () => {
  const rng = core.rng(11);
  for (let round = 0; round < 200; round++) {
    const words = uniq(randWords(rng, rng.int(0, 8)));
    const probe = randWords(rng, 1)[0];
    const set = new Set(words);
    const ins = T.opTrace(words, 'insert', probe);
    assert.equal(ins.result, !set.has(probe));
    assert.deepEqual(ins.words, uniq([...words, probe]).sort());
    const se = T.opTrace(words, 'search', probe);
    assert.equal(se.result, set.has(probe));
    assert.deepEqual(se.words, words.slice().sort());
    const pf = T.opTrace(words, 'prefix', probe);
    assert.equal(pf.result, words.some((w) => w.startsWith(probe)));
    const del = T.opTrace(words, 'delete', probe);
    assert.equal(del.result, set.has(probe));
    assert.deepEqual(del.words, words.filter((w) => w !== probe).sort());
    assert.equal(del.trie.nodes, refNodes(del.words));
  }
});

test('every step of every trace is a complete, truthful snapshot', () => {
  const rng = core.rng(3);
  for (let round = 0; round < 120; round++) {
    const words = uniq(randWords(rng, rng.int(0, 7)));
    const probe = randWords(rng, 1)[0];
    for (const op of ['insert', 'search', 'prefix', 'delete']) {
      const { steps } = T.opTrace(words, op, probe);
      assert.ok(steps.length >= 2);
      const keys = Object.keys(steps[0].counters).join();
      steps.forEach((s, k) => {
        const ids = checkTree(s.tree, null, op + ' ' + probe + ' #' + k);
        assert.equal(typeof s.caption, 'string');
        assert.ok(s.caption.length > 10);
        assert.equal(Object.keys(s.counters).join(), keys, 'counter keys are stable');
        // counters describe the tree on screen
        assert.equal(s.tree.nodes.length - 1, s.counters.nodes, 'node counter = letter nodes drawn');
        assert.equal(s.tree.nodes.filter((n) => n.badge === '✓').length, s.counters.words, 'end badges = words counter');
        // the pointer sits on a node that is drawn
        s.tree.pointers.forEach((p) => assert.ok(ids.has(p.target)));
        // a node is only "found" when the query really succeeds there
        if (s.tree.nodes.some((n) => n.state === 'found') && (op === 'search' || op === 'prefix')) {
          assert.ok(['found'].includes(s.kind));
        }
      });
      // counters only grow for insert, only shrink for delete
      const nodes = steps.map((s) => s.counters.nodes);
      for (let i = 1; i < nodes.length; i++) {
        if (op === 'insert') assert.ok(nodes[i] >= nodes[i - 1]);
        if (op === 'delete') assert.ok(nodes[i] <= nodes[i - 1]);
        if (op === 'search' || op === 'prefix') assert.equal(nodes[i], nodes[0]);
      }
      const visited = steps.map((s) => s.counters.visited);
      for (let i = 1; i < visited.length; i++) assert.ok(visited[i] >= visited[i - 1], 'visited never shrinks');
    }
  }
});

test('search reports word vs prefix vs absent with the right final step', () => {
  const words = ['car', 'card', 'care', 'cat'];
  const last = (op, w) => T.opTrace(words, op, w).steps.slice(-1)[0];
  assert.equal(last('search', 'car').kind, 'found');
  assert.equal(last('search', 'ca').kind, 'prefixonly');
  assert.equal(last('search', 'cax').kind, 'miss');
  assert.equal(last('search', 'cards').kind, 'miss');
  assert.equal(last('prefix', 'ca').kind, 'found');
  assert.equal(last('prefix', 'cab').kind, 'miss');
  const f = last('prefix', 'ca');
  const tinted = f.tree.nodes.filter((n) => n.state === 'visited').length;
  assert.equal(tinted, 4, 'the subtree under "ca" is car, card, care, cat');
});

test('insert shares prefixes: created nodes = new letters only', () => {
  const t = T.build(['car', 'card', 'care']);
  const r = T.opTrace(['car', 'card', 'care'], 'insert', 'cart');
  const kinds = r.steps.map((s) => s.kind);
  assert.deepEqual(kinds, ['start', 'follow', 'follow', 'follow', 'create', 'mark']);
  assert.equal(r.trie.nodes, t.nodes + 1);
  const dup = T.opTrace(['car'], 'insert', 'car');
  assert.equal(dup.steps.slice(-1)[0].kind, 'mark');
  assert.equal(dup.result, false);
  assert.equal(dup.trie.nodes, 3);
  // inserting an existing prefix only sets the flag
  const pre = T.opTrace(['card'], 'insert', 'car');
  assert.deepEqual(pre.steps.map((s) => s.kind), ['start', 'follow', 'follow', 'follow', 'mark']);
  assert.equal(pre.result, true);
  assert.equal(pre.trie.nodes, 4);
});

test('delete: leaf chain is pruned, shared nodes and word ends stay', () => {
  let r = T.opTrace(['car', 'card', 'cat'], 'delete', 'card');
  assert.deepEqual(r.steps.map((s) => s.kind), ['start', 'follow', 'follow', 'follow', 'follow', 'unmark', 'cut', 'up', 'keep']);
  assert.equal(r.trie.nodes, 4); // c ca car cat
  r = T.opTrace(['car', 'card'], 'delete', 'car');
  assert.equal(r.steps.slice(-1)[0].kind, 'keep');
  assert.equal(r.trie.nodes, 4, 'car stays as a plain prefix of card');
  assert.equal(T.find(r.trie, 'car').end, false);
  r = T.opTrace(['dog'], 'delete', 'dog');
  assert.equal(r.steps.slice(-1)[0].kind, 'end');
  assert.equal(r.trie.nodes, 0);
  r = T.opTrace(['car'], 'delete', 'ca');
  assert.equal(r.steps.slice(-1)[0].kind, 'notword');
  assert.equal(r.result, false);
  r = T.opTrace(['car'], 'delete', 'cow');
  assert.equal(r.steps.slice(-1)[0].kind, 'miss');
  r = T.opTrace([], 'search', 'a');
  assert.equal(r.steps.slice(-1)[0].kind, 'miss');
});

test('code labels used by steps exist in every language', () => {
  for (const op of ['insert', 'search', 'prefix', 'delete']) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(T.CODE[op][lang], lang);
    const words = ['car', 'card', 'cat'];
    for (const probe of ['car', 'card', 'ca', 'cow', 'dog', 'cart', 'c']) {
      T.opTrace(words, op, probe).steps.forEach((s) => {
        if (!s.line) return;
        [].concat(s.line).forEach((label) => {
          for (const lang of ['pseudo', 'js', 'py']) assert.ok(parsed[lang].labels[label], `${op}/${lang} lacks @${label}`);
        });
      });
    }
  }
});

test('restStep shows the trie at rest', () => {
  const s = T.restStep(['a', 'ab']);
  assert.equal(s.counters.words, 2);
  assert.equal(s.counters.nodes, 2);
  assert.equal(T.restStep([]).counters.nodes, 0);
});

/* ---------------------------------------------------------------- autocomplete */
test('complete matches filter + sort on random dictionaries', () => {
  const rng = core.rng(41);
  for (let round = 0; round < 100; round++) {
    const words = uniq(randWords(rng, rng.int(1, 12)));
    const freqs = words.map(() => rng.int(1, 9));
    const t = T.build(words, freqs);
    const prefix = randWords(rng, 1, 'abc', 3)[0].slice(0, rng.int(0, 2));
    const c = T.complete(t, prefix, 3);
    const ref = words.map((w, i) => ({ word: w, freq: freqs[i] })).filter((r) => r.word.startsWith(prefix))
      .sort((a, b) => b.freq - a.freq || (a.word < b.word ? -1 : 1));
    assert.equal(c.ok, ref.length > 0 || words.some((w) => w.startsWith(prefix)));
    assert.deepEqual(c.ranked.map((r) => r.word), ref.map((r) => r.word));
    assert.deepEqual(c.top.map((r) => r.word), ref.slice(0, 3).map((r) => r.word));
    assert.deepEqual(c.all.map((r) => r.word), ref.map((r) => r.word).sort());
    if (c.ok) assert.ok(c.visited >= ref.length, 'the DFS visits at least every result node');
  }
});

test('complete: unknown prefix, empty prefix, prefix that is itself a word', () => {
  const t = T.build(['car', 'card', 'care', 'cat', 'dog'], [5, 3, 4, 9, 1]);
  let c = T.complete(t, 'cx');
  assert.equal(c.ok, false);
  assert.equal(c.failChar, 'x');
  assert.equal(c.node.prefix, 'c');
  assert.equal(c.top.length, 0);
  c = T.complete(t, '');
  assert.equal(c.ok, true);
  assert.equal(c.all.length, 5);
  assert.equal(c.top[0].word, 'cat');
  c = T.complete(t, 'car');
  assert.deepEqual(c.all.map((r) => r.word), ['car', 'card', 'care'], 'car is its own completion');
  const v = T.completeView(t, 'car', { k: 2 });
  assert.equal(v.showing.length, 2);
  checkTree(v.tree, t, 'completeView');
  const carNode = v.tree.nodes.find((n) => n.id === 'p:car');
  assert.equal(carNode.state, v.showing.some((r) => r.word === 'car') ? 'found' : 'active');
});

/* ---------------------------------------------------------------- hash set vs trie race */
test('raceSteps: trie count equals a full scan, and each side does the work it claims', () => {
  const words = ['tea', 'team', 'tear', 'ten', 'tent', 'ted', 'tab', 'tan', 'tap', 'car', 'card', 'cart', 'cat', 'dog', 'dot', 'do'];
  for (const prefix of ['t', 'te', 'tea', 'ca', 'do', 'x', 'tex', 'cards', 'dog']) {
    const steps = T.raceSteps(words, prefix);
    const last = steps[steps.length - 1];
    const expected = words.filter((w) => w.startsWith(prefix)).length;
    assert.equal(last.hashCount, expected, prefix + ': hash total');
    assert.equal(last.trieCount, expected, prefix + ': trie total');
    assert.equal(last.counters.keys, words.length, 'the hash set had to look at every key');
    assert.ok(last.counters.nodes <= prefix.length, 'the trie never visits more nodes than the prefix has letters');
    steps.forEach((s) => { checkTree(s.tree, null, 'race'); assert.equal(s.keyStates.length, words.length); });
    const keys = steps.map((s) => s.counters.keys);
    keys.forEach((k, i) => { if (i) assert.ok(k >= keys[i - 1]); });
  }
  const one = T.raceSteps(['a'], 'a');
  assert.equal(one[one.length - 1].trieCount, 1);
});

/* ---------------------------------------------------------------- radix compression */
test('compressSteps: final node count equals the radix count and shrinks one node per merge', () => {
  const rng = core.rng(77);
  for (let round = 0; round < 80; round++) {
    const words = uniq(randWords(rng, rng.int(1, 9), 'abcd', 6));
    const steps = T.compressSteps(words);
    const plain = refNodes(words);
    assert.equal(steps[0].counters.nodes, plain);
    for (let i = 1; i < steps.length - 1; i++) assert.equal(steps[i].counters.nodes, steps[i - 1].counters.nodes - 1);
    const last = steps[steps.length - 1];
    assert.equal(last.counters.nodes, refRadix(words));
    assert.equal(last.counters.saved, plain - refRadix(words));
    // the letters are all still there: labels concatenated along each root-to-word path spell the word
    const byId = new Map(last.tree.nodes.map((n) => [n.id, n]));
    const spelled = [];
    (function rec(id, acc) {
      const n = byId.get(id);
      const s = id === last.tree.root ? '' : acc + n.label;
      if (n.badge === '✓') spelled.push(s);
      (n.children || []).forEach((c) => rec(c, s));
    }(last.tree.root, ''));
    assert.deepEqual(spelled.sort(), words.slice().sort());
    steps.forEach((s) => checkTree(s.tree, null, 'compress'));
  }
  // single word: one node holds it all
  const single = T.compressSteps(['banana']);
  assert.equal(single[single.length - 1].counters.nodes, 1);
  assert.equal(single[single.length - 1].tree.nodes[1].label, 'banana');
  // nothing to compress: every node is a fork or a word end
  const flat = T.compressSteps(['a', 'b', 'c']);
  assert.equal(flat.length, 2);
});

/* ---------------------------------------------------------------- longest prefix match */
test('lpmSteps returns the longest matching route, like a brute-force scan', () => {
  const rng = core.rng(101);
  for (let round = 0; round < 200; round++) {
    const routes = [];
    const n = rng.int(0, 7);
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      let p = '';
      for (let k = rng.int(0, 5); k > 0; k--) p += rng.int(0, 1);
      if (!seen.has(p)) { seen.add(p); routes.push([p, String.fromCharCode(65 + i)]); }
    }
    let addr = '';
    for (let k = rng.int(1, 8); k > 0; k--) addr += rng.int(0, 1);
    const steps = T.lpmSteps(routes, addr);
    const ref = T.lpmRef(routes, addr);
    const last = steps[steps.length - 1];
    assert.equal(last.kind, 'result');
    assert.equal(last.bestHop, ref ? ref[1] : null);
    assert.equal(last.bestPrefix, ref ? ref[0] : null);
    const ids = new Map();
    steps.forEach((s, k) => {
      s.tree.nodes.forEach((nd) => assert.ok(STATES.has(nd.state)));
      const found = s.tree.nodes.filter((nd) => nd.state === 'found');
      assert.ok(found.length <= 1, 'at most one node is the current best');
      if (s.bestId) assert.equal(found[0].id, s.bestId);
      assert.equal(Object.keys(s.counters).join(), 'read,bestLen');
      if (k) assert.ok(s.counters.bestLen >= steps[k - 1].counters.bestLen, 'the best match only gets longer');
      void ids;
    });
    assert.ok(last.counters.read <= addr.length);
  }
});

test('lpmSteps on the lesson routing table', () => {
  const R = T.ROUTES;
  const hop = (a) => { const s = T.lpmSteps(R, a); return s[s.length - 1].bestHop; };
  assert.equal(hop('10111001'), 'D');
  assert.equal(hop('10100101'), 'C');
  assert.equal(hop('11010000'), 'E');
  assert.equal(hop('01100110'), 'A');
  assert.equal(hop('00100000'), 'F');
  assert.equal(hop('11110000'), 'G', 'nothing specific matches: the default route');
  assert.equal(hop('1'), 'G');
  const noDefault = T.lpmSteps([['1', 'X']], '0111');
  assert.equal(noDefault[noDefault.length - 1].bestHop, null);
  assert.match(noDefault[noDefault.length - 1].caption, /drop/);
  const empty = T.lpmSteps([], '1');
  assert.equal(empty[empty.length - 1].bestHop, null);
  assert.equal(T.lpmSteps(R, '10111001')[0].tree.nodes[0].badge, 'G');
});

/* ---------------------------------------------------------------- growth chart data */
test('growth: nodes never exceed letters, sharing keeps dictionary growth below random growth', () => {
  const dict = T.shuffled(T.DICTIONARY, 4).slice(0, 60);
  const g = T.growth(dict);
  assert.equal(g.nodes.length, 61);
  for (let i = 1; i <= 60; i++) {
    assert.ok(g.nodes[i] >= g.nodes[i - 1]);
    assert.ok(g.nodes[i] <= g.letters[i]);
    assert.ok(g.radix[i] <= g.nodes[i]);
  }
  assert.equal(g.nodes[60], refNodes(dict));
  assert.equal(g.radix[60], refRadix(dict));
  const rnd = T.growth(T.randomWords(9, 60, 6));
  assert.ok(rnd.nodes[60] / rnd.letters[60] > g.nodes[60] / g.letters[60], 'random strings share less than words do');
  assert.deepEqual(T.growth([]).nodes, [0]);
});

test('randomLike keeps the length profile and shares little', () => {
  const dict = T.shuffled(T.DICTIONARY, 4);
  const like = T.randomLike(dict, 6);
  assert.deepEqual(like.map((w) => w.length), dict.map((w) => w.length));
  assert.equal(uniq(like).length, like.length);
  const gd = T.growth(dict), gl = T.growth(like);
  assert.equal(gd.letters[dict.length], gl.letters[dict.length], 'same number of letters typed');
  assert.ok(gl.nodes[dict.length] > gd.nodes[dict.length], 'random strings need more nodes than real words');
});

test('randomWords and shuffled are deterministic and unique', () => {
  assert.deepEqual(T.randomWords(1, 5, 4), T.randomWords(1, 5, 4));
  assert.equal(uniq(T.randomWords(2, 30, 3)).length, 30);
  assert.deepEqual(T.shuffled([1, 2, 3, 4, 5], 3).slice().sort(), [1, 2, 3, 4, 5]);
  assert.equal(uniq(T.DICTIONARY).length, T.DICTIONARY.length, 'the dictionary has no repeated words');
});

/* ---------------------------------------------------------------- layout + validation */
test('layoutTrie puts parents over their children and leaves in distinct columns', () => {
  const t = T.build(['car', 'card', 'care', 'cat', 'dog']);
  const L = T.layoutTrie(t);
  assert.equal(Object.keys(L.pos).length, t.nodes + 1);
  assert.equal(L.depth, 4);
  const leaves = ['p:card', 'p:care', 'p:cat', 'p:dog'].map((id) => L.pos[id].x);
  assert.deepEqual(leaves, [0, 1, 2, 3]);
  const car = L.pos['p:car'].x;
  assert.equal(car, (L.pos['p:card'].x + L.pos['p:care'].x) / 2);
  assert.equal(T.layoutTrie(T.build([])).width, 1);
});

test('parseWords, parseWord and parseBits give friendly errors', () => {
  assert.deepEqual(T.parseWords('Car, card  care;cat').values, ['car', 'card', 'care', 'cat']);
  assert.deepEqual(T.parseWords('a a a').values, ['a']);
  assert.deepEqual(T.parseWords('').values, []);
  assert.match(T.parseWords('car, c4t').error, /a to z/);
  assert.match(T.parseWords('abcdefghijk').error, /too long/);
  assert.match(T.parseWords(Array.from({ length: 13 }, (_, i) => 'w' + String.fromCharCode(97 + i)).join(' ')).error, /or fewer/);
  assert.match(T.parseWords('', { minCount: 1 }).error, /at least/);
  const many = Array.from({ length: 12 }, (_, i) => 'abcdefg' + String.fromCharCode(97 + i)).join(' ');
  assert.match(T.parseWords(many).error, /letters in total/);
  assert.equal(T.parseWord('  Cat ').value, 'cat');
  assert.match(T.parseWord('').error, /Type a word/);
  assert.match(T.parseWord('c-t').error, /a to z/);
  assert.equal(T.parseWord('', { allowEmpty: true }).value, '');
  assert.equal(T.parseBits('1011 0010').value, '10110010');
  assert.match(T.parseBits('102').error, /0 and 1/);
  assert.match(T.parseBits('101010101').error, /8 bits/);
  assert.match(T.parseBits('').error, /at least/);
});
