/* Hash tables: pure step generators and simulations for lesson 11. No DOM. UMD: in the browser it attaches to
   VDSA.algos.hashing; in Node it exports the same API.

     hashing.rawHash(key)                  integer key -> itself; word -> polynomial hash (Horner, base 31), exact up to 8 letters
     hashing.hashOf(key, m, kind)          bucket of a key: kind 'mod' (rawHash mod m) or 'first' (first character's code mod m)
     hashing.secondHash(key, m)            1 + rawHash mod (m - 1): the step of double hashing (m prime keeps it coprime to m)
     hashing.parseKey(text)                '24' -> 24, 'cat' -> 'cat', anything else -> null
     hashing.machine(text, kind, m)        steps for the hash-function machine (characters -> number -> bucket)
     hashing.chaining(ops, opts)           {steps, opStart, final} — separate chaining: insert / search / delete / resize
     hashing.probing(ops, opts)            {steps, opStart, final} — open addressing: linear / quadratic / double, tombstones
     hashing.clusterRace(keys, m)          frames that insert the same keys with linear / quadratic / double probing
     hashing.tombstoneDemo(naive)          the failure (naive delete) and the fix (tombstone) as a probing trace
     hashing.distribution(keys, m, kind)   how keys spread over m buckets: {counts, max, empty, bucketOf}
     hashing.birthdayRun(m, rng)           throw random keys at m slots until the first collision
     hashing.birthdayProb(n, m)            exact probability of at least one collision among n keys
     hashing.birthdayHistogram(m, trials, rng)
     hashing.expectedProbes(kind, alpha)   {found, missing} textbook formulas
     hashing.simulateProbes(kind, m, alphas, trials, rng)   measured average probes
     hashing.growthCosts(n, policy)        per-insert cost of a growing table: doubling vs adding a constant
     hashing.runs(slots)                   maximal runs of consecutive filled slots (cyclic)
     hashing.CODE.chaining / hashing.openCode(kind)          {pseudo, js, py} with // @labels matching step.line

   Truth rules (tested in tests/algos/11-hash-tables.test.js): the table always equals a plain reference set; a slot
   holds one key; an entry shows found only on a successful search; tombstones never overlap entries; counters only grow. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.hashing = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ keys and hash functions */
  var PRIMES = [5, 7, 11, 13, 17, 23, 29, 37, 47, 59, 71, 89, 107, 131, 163, 197, 251, 307];
  function nextPrime(n) {
    for (var i = 0; i < PRIMES.length; i++) if (PRIMES[i] >= n) return PRIMES[i];
    return n;
  }
  function isInt(k) { return typeof k === 'number'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function keyText(k) { return String(k); }
  function keyId(k) { return 'k' + k; }
  function kb(k) { return '<b>' + esc(keyText(k)) + '</b>'; }

  /* '24' -> 24, 'cat' -> 'cat'; up to 8 letters, integers 0..99999; anything else -> null. */
  function parseKey(text) {
    var t = String(text).trim();
    if (/^\d{1,5}$/.test(t)) return parseInt(t, 10);
    if (/^[A-Za-z]{1,8}$/.test(t)) return t.toLowerCase();
    return null;
  }
  /* Horner's rule with base 31: exact in doubles for 8 characters of ASCII. */
  function polyOf(str, base) {
    var acc = 0;
    for (var i = 0; i < str.length; i++) acc = acc * base + str.charCodeAt(i);
    return acc;
  }
  function rawHash(key) { return isInt(key) ? key : polyOf(String(key), 31); }
  function firstCode(key) { return String(key).charCodeAt(0); }
  function mod(a, m) { return ((a % m) + m) % m; }
  function hashOf(key, m, kind) { return mod(kind === 'first' ? firstCode(key) : rawHash(key), m); }
  function secondHash(key, m) { return 1 + mod(rawHash(key), Math.max(1, m - 1)); }
  function hashNumber(key, kind) { return kind === 'first' ? firstCode(key) : rawHash(key); }
  /* The line the hash box shows: "24 mod 7 = 3". */
  function hashCalc(key, m, kind) {
    var n = hashNumber(key, kind);
    return (kind === 'first' ? 'code ' : '') + n + ' mod ' + m + ' = ' + mod(n, m);
  }
  function hashLabel(intOnly, m, kind) {
    if (kind === 'first') return 'h(k) = first(k) mod ' + m;
    return intOnly ? 'h(k) = k mod ' + m : 'h(k) = hash(k) mod ' + m;
  }
  /* A short reminder for text keys: the word is turned into a number before mod (see the machine figure). */
  function strNote(key, kind) {
    if (isInt(key)) return '';
    return kind === 'first' ? ' (the code of ' + esc(String(key).charAt(0)) + ', the first letter)' : ' (the word ' + esc(String(key)) + ' becomes the number ' + rawHash(key) + ' first)';
  }
  function allInts(ops) { return ops.every(function (o) { return o.key === undefined || isInt(o.key); }); }

  /* Position of probe i. kind: linear | quadratic | double. */
  function probeSlot(kind, home, step, m, i) {
    if (kind === 'quadratic') return mod(home + i * i, m);
    if (kind === 'double') return mod(home + i * step, m);
    return mod(home + i, m);
  }
  function probeFormula(kind, home, step, m, i) {
    var s = probeSlot(kind, home, step, m, i);
    if (kind === 'quadratic') return '(' + home + ' + ' + i + '²) mod ' + m + ' = ' + s;
    if (kind === 'double') return '(' + home + ' + ' + i + '·' + step + ') mod ' + m + ' = ' + s;
    return '(' + home + ' + ' + i + ') mod ' + m + ' = ' + s;
  }

  /* ------------------------------------------------------------------ the hash-function machine */
  /* Steps: the text, one step per character that joins the running number, then "mod m". kind: first | sum | poly. */
  function machine(text, kind, m) {
    text = String(text === undefined || text === null ? '' : text);
    m = Math.max(2, m || 10);
    var name = { first: 'first letter', sum: 'sum of codes', poly: 'polynomial (base 31)' }[kind] || 'polynomial (base 31)';
    var steps = [], chars = [], i;
    for (i = 0; i < text.length; i++) chars.push({ ch: text.charAt(i), code: text.charCodeAt(i) });
    function snap(stage, upto, acc, bucket, caption, extra) {
      steps.push(Object.assign({ kind: stage, text: text, chars: chars, upto: upto, acc: acc, m: m, fn: kind, bucket: bucket, caption: caption,
        line: null, vars: { text: text, i: upto, acc: acc, m: m } }, extra || {}));
    }
    if (!chars.length) {
      snap('empty', 0, 0, null, 'Type a word above. The machine turns its characters into one number, then folds that number into one of ' + m + ' buckets.');
      return steps;
    }
    snap('text', 0, 0, null, 'The key <b>' + esc(text) + '</b> is just characters. A computer stores each character as a number (its code), so we can do arithmetic on them.');
    var acc = 0;
    if (kind === 'first') {
      acc = chars[0].code;
      snap('char', 1, acc, null, 'Function <b>' + name + '</b>: only the first character counts. <b>' + esc(chars[0].ch) + '</b> has code ' + acc + '. Every other character is ignored, which is exactly what makes this a bad hash function.', { active: 0 });
    } else {
      for (i = 0; i < chars.length; i++) {
        var before = acc, c = chars[i].code;
        acc = kind === 'sum' ? before + c : before * 31 + c;
        var math = kind === 'sum' ? before + ' + ' + c + ' = ' + acc : before + ' × 31 + ' + c + ' = ' + acc;
        snap('char', i + 1, acc, null,
          '<b>' + esc(chars[i].ch) + '</b> has code ' + c + '. ' + (kind === 'sum' ? 'Add it to the total: ' : 'Multiply the number so far by 31 and add the code: ') + '<b>' + math + '</b>.' +
          (kind === 'poly' && i > 0 ? ' Multiplying by 31 gives each position its own weight, so order matters.' : ''), { active: i });
      }
    }
    var b = mod(acc, m);
    snap('mod', chars.length, acc, b, acc + ' mod ' + m + ' = <b>' + b + '</b>: the remainder is always between 0 and ' + (m - 1) + ', so it is a valid bucket. Same text, same number, same bucket, every time.', { active: -1 });
    return steps;
  }

  /* ------------------------------------------------------------------ separate chaining */
  function emptyChains(m) { var c = []; for (var i = 0; i < m; i++) c.push([]); return c; }
  function nextSize(m, maxM) { var n = nextPrime(m * 2); return n > maxM ? null : n; }

  /* ops: [{op: 'insert' | 'search' | 'delete' | 'resize', key, value?}]
     opts: {m: 7, hash: 'mod' | 'first', autoResize: false, threshold: 0.75, maxBuckets: 23}
     Returns {steps, opStart: [first step of each op], final: {m, chains: [[key]], size, values}} */
  function chaining(ops, opts) {
    opts = opts || {};
    var m = opts.m || 7, kind = opts.hash || 'mod', auto = !!opts.autoResize, thr = opts.threshold || 0.75, maxM = opts.maxBuckets || 23;
    var intOnly = allInts(ops);
    var chains = emptyChains(m), size = 0, cmpTotal = 0, collisions = 0;
    var steps = [], opStart = [];
    var opi = 0, opName = '', hv = null;

    function entries(marks) {
      var out = [];
      chains.forEach(function (chain, b) {
        chain.forEach(function (e, pos) {
          var en = { id: keyId(e.key), key: e.key, bucket: b, pos: pos, state: (marks && marks[keyId(e.key)]) || 'default' };
          if (e.value !== undefined) en.value = e.value;
          out.push(en);
        });
      });
      return out;
    }
    function chainKeys(b) { return chains[b].map(function (e) { return e.key; }); }
    function snap(k, caption, line, o) {
      o = o || {};
      var st = {
        kind: k, mode: 'chaining', op: opi, opName: opName, buckets: m, hashFn: hashLabel(intOnly, m, kind), threshold: thr,
        entries: entries(o.marks), caption: caption, line: line, flow: null,
        vars: o.vars || {}, counters: { entries: size, buckets: m, load: (size / m).toFixed(2), compares: cmpTotal, collisions: collisions }
      };
      if (o.incoming) st.incoming = o.incoming;
      if (o.hash) st.hashValue = o.hash;
      if (o.bucketStates) st.bucketStates = o.bucketStates;
      if (o.resizing) st.resizing = o.resizing;
      steps.push(st);
    }
    function grow(to, why) {
      var from = m, old = chains, moved = {};
      snap('growStart', why, 'growNew', { resizing: { from: from, to: to }, vars: { m: from, 'new m': to, size: size } });
      var longestBefore = 0; chains.forEach(function (c) { longestBefore = Math.max(longestBefore, c.length); });
      m = to; chains = emptyChains(to);
      old.forEach(function (chain) {
        chain.forEach(function (e) { chains[hashOf(e.key, to, kind)].push(e); moved[keyId(e.key)] = 'swap'; });
      });
      var longestAfter = 0; chains.forEach(function (c) { longestAfter = Math.max(longestAfter, c.length); });
      snap('growMove', 'Every key is hashed again with <b>m = ' + to + '</b> and appended to its new chain. The old buckets are thrown away. Keys that shared a bucket often part ways, because <code>k mod ' + from + '</code> and <code>k mod ' + to + '</code> are different functions.',
        'growPush', { marks: moved, resizing: { from: from, to: to }, vars: { m: to, size: size } });
      snap('growDone', 'Done: α fell from ' + (size / from).toFixed(2) + ' to <b>' + (size / to).toFixed(2) + '</b> and the longest chain went from ' + longestBefore + ' to ' + longestAfter + '. That was ' + size + ' re-insertions in one go, so this single insert was expensive, but it will not happen again for a long time.',
        'growLoop', { vars: { m: to, size: size } });
    }

    ops.forEach(function (o, index) {
      opi = index; opName = o.op; hv = null; opStart.push(steps.length);
      var key = o.key, id = key === undefined ? null : keyId(key);
      if (o.op === 'resize') {
        var to = nextSize(m, maxM);
        if (!to) { snap('resizeMax', 'This lab stops growing at ' + m + ' buckets so the picture stays readable. Real tables keep doubling.', null, { vars: { m: m } }); return; }
        grow(to, 'Grow on demand: allocate <b>' + to + '</b> buckets (about double, and prime). Rehashing costs one pass over all ' + size + ' key' + (size === 1 ? '' : 's') + '.');
        return;
      }
      var opWord = { insert: 'Insert', search: 'Search for', delete: 'Delete' }[o.op];
      var inId = o.op === 'insert' ? id : 'q' + index;
      var b = hashOf(key, m, kind);
      hv = hashCalc(key, m, kind);
      var inc = function (stage, state) { return { id: inId, key: key, stage: stage, bucket: stage === 'input' ? undefined : b, op: o.op, state: state || 'key' }; };
      var L = { insert: ['addHash', 'addScan', 'addCmp', 'addPush', 'addGrow'], search: ['hasHash', 'hasScan', 'hasCmp', 'hasNo'], delete: ['delHash', 'delScan', 'delCmp', 'delCut', 'delNo'] }[o.op];
      var baseVars = { key: keyText(key), m: m };
      snap('input', opWord + ' ' + kb(key) + '. Before anything else the table must decide <em>where to look</em>, and it has ' + m + ' buckets to choose from.', null,
        { incoming: inc('input'), vars: baseVars });
      snap('hash', 'Feed the key to the hash function: <b>' + hv + '</b>' + strNote(key, kind) + '. Bucket <b>' + b + '</b> is the only place ' + kb(key) + ' can be, so we never look anywhere else.', L[0],
        { incoming: inc('hash'), hash: hv, bucketStates: (function () { var s = {}; s[b] = 'active'; return s; }()), vars: { key: keyText(key), 'h(key)': b, m: m, chain: chainKeys(b) } });
      var chain = chains[b], at = -1, j;
      var seen = {};
      for (j = 0; j < chain.length; j++) {
        cmpTotal++;
        var same = chain[j].key === key, marks = {};
        Object.keys(seen).forEach(function (k) { marks[k] = 'visited'; });
        marks[keyId(chain[j].key)] = same ? (o.op === 'delete' ? 'error' : 'found') : 'compare';
        snap('cmp', same ? kb(chain[j].key) + ' equals ' + kb(key) + '.' + (o.op === 'insert' ? ' It is already stored.' : o.op === 'search' ? ' Found it.' : ' This is the entry to remove.')
          : kb(chain[j].key) + ' is not ' + kb(key) + ', so follow the next pointer. The chain is the only thing we walk: its length, not the table size, is the cost.',
        [L[1], L[2]], { marks: marks, incoming: inc('hash', same && o.op === 'search' ? 'found' : 'key'), hash: hv, vars: { key: keyText(key), 'h(key)': b, chain: chainKeys(b), 'chain[j]': keyText(chain[j].key), j: j } });
        seen[keyId(chain[j].key)] = true;
        if (same) { at = j; break; }
      }
      if (o.op === 'insert') {
        if (at >= 0) {
          if (o.value !== undefined && chain[at].value !== o.value) {
            chain[at].value = o.value;
            var mk = {}; mk[id] = 'swap';
            snap('update', kb(key) + ' is already here, so a map overwrites its value with <b>' + esc(String(o.value)) + '</b> instead of storing a second copy.', L[2], { marks: mk, hash: hv, vars: baseVars });
          } else {
            snap('dup', kb(key) + ' is already in the table. A set stores each key once, so nothing changes.', L[2], { marks: (function () { var s = {}; s[id] = 'found'; return s; }()), hash: hv, vars: baseVars });
          }
          return;
        }
        var wasEmpty = chain.length === 0;
        chain.push(o.value === undefined ? { key: key } : { key: key, value: o.value });
        size++; if (!wasEmpty) collisions++;
        var pm = {}; pm[id] = 'active';
        snap('push', wasEmpty
          ? 'Bucket ' + b + ' was empty, so ' + kb(key) + ' starts a new chain. Load factor α = n / m is now ' + size + ' / ' + m + ' = <b>' + (size / m).toFixed(2) + '</b>.'
          : '<b>Collision.</b> Bucket ' + b + ' already holds ' + (chain.length - 1) + ' key' + (chain.length === 2 ? '' : 's') + ', so ' + kb(key) + ' joins the end of the chain. Chains absorb collisions without moving anything. α = ' + size + ' / ' + m + ' = <b>' + (size / m).toFixed(2) + '</b>.',
        'addPush', { marks: pm, hash: hv, bucketStates: (function () { var s = {}; s[b] = 'active'; return s; }()), vars: { key: keyText(key), 'h(key)': b, chain: chainKeys(b), size: size, m: m } });
        if (auto && size / m > thr) {
          var to2 = nextSize(m, maxM);
          if (to2) grow(to2, 'α = ' + size + ' / ' + m + ' = <b>' + (size / m).toFixed(2) + '</b> is above the limit ' + thr + '. Chains are getting long, so the table grows before lookups slow down.');
          else snap('growMax', 'α is above ' + thr + ', but this lab stops growing at ' + m + ' buckets.', 'addGrow', { hash: hv, vars: { m: m, size: size } });
        }
        return;
      }
      if (o.op === 'search') {
        if (at >= 0) {
          snap('hit', 'Found ' + kb(key) + ' after examining bucket ' + b + ' and ' + (at + 1) + ' entr' + (at === 0 ? 'y' : 'ies') + '. Nothing outside bucket ' + b + ' was touched.', 'hasCmp',
            { marks: (function () { var s = {}; for (var q = 0; q <= at; q++) s[keyId(chain[q].key)] = q === at ? 'found' : 'visited'; return s; }()), incoming: inc('hash', 'found'), hash: hv, vars: { key: keyText(key), 'h(key)': b, found: true } });
        } else {
          snap('miss', chain.length
            ? 'End of the chain: ' + kb(key) + ' is not in the table. An absent key costs a full walk of its chain (' + chain.length + ' comparison' + (chain.length === 1 ? '' : 's') + ').'
            : 'Bucket ' + b + ' is empty, so ' + kb(key) + ' cannot be in the table. An absent key here cost zero comparisons.', 'hasNo',
          { marks: (function () { var s = {}; chain.forEach(function (e) { s[keyId(e.key)] = 'visited'; }); return s; }()), incoming: inc('hash', 'error'), hash: hv, vars: { key: keyText(key), 'h(key)': b, found: false } });
        }
        return;
      }
      // delete
      if (at >= 0) {
        chain.splice(at, 1); size--;
        snap('cut', 'Unlink ' + kb(key) + ': the arrow before it now skips to the next entry. In a chain a delete just relinks, and no other key moves.', 'delCut',
          { hash: hv, bucketStates: (function () { var s = {}; s[b] = 'active'; return s; }()), vars: { key: keyText(key), 'h(key)': b, chain: chainKeys(b), size: size } });
      } else {
        snap('miss', kb(key) + ' is not in bucket ' + b + ', so it is not in the table and there is nothing to delete.', 'delNo',
          { marks: (function () { var s = {}; chain.forEach(function (e) { s[keyId(e.key)] = 'visited'; }); return s; }()), incoming: inc('hash', 'error'), hash: hv, vars: { key: keyText(key), 'h(key)': b, found: false } });
      }
    });
    if (!steps.length) snap('empty', 'An empty table: ' + m + ' buckets, each the start of a chain that has no entries yet.', null, { vars: { m: m, size: 0 } });
    var values = {};
    chains.forEach(function (c) { c.forEach(function (e) { if (e.value !== undefined) values[e.key] = e.value; }); });
    return { steps: steps, opStart: opStart, final: { m: m, chains: chains.map(function (c) { return c.map(function (e) { return e.key; }); }), size: size, values: values, compares: cmpTotal, collisions: collisions } };
  }

  /* ------------------------------------------------------------------ open addressing */
  var TOMB = '†';

  /* Maximal runs of consecutive filled slots, cyclic. Returns [{start, length}] (start is the first slot of the run). */
  function runs(slots) {
    var m = slots.length, out = [], i, filled = function (k) { return !!slots[k]; };
    var all = true; for (i = 0; i < m; i++) if (!filled(i)) { all = false; break; }
    if (all) return m ? [{ start: 0, length: m }] : [];
    var first = 0; while (filled(first)) first++;          // an empty slot to start counting from
    for (i = 1; i <= m; i++) {
      var s = (first + i) % m;
      if (filled(s) && !filled((s - 1 + m) % m)) {
        var len = 0; while (filled((s + len) % m)) len++;
        out.push({ start: s, length: len });
      }
    }
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  /* ops: [{op: 'insert' | 'search' | 'delete' | 'resize', key}]
     opts: {m: 7, kind: 'linear' | 'quadratic' | 'double', hash: 'mod' | 'first', autoResize: true, threshold: 0.7,
            maxBuckets: 23, tombstones: true (false = the naive delete that breaks lookups), clusters: false} */
  function probing(ops, opts) {
    opts = opts || {};
    var m = opts.m || 7, pk = opts.kind || 'linear', hk = opts.hash || 'mod', auto = opts.autoResize !== false, thr = opts.threshold || 0.7;
    var maxM = opts.maxBuckets || 23, useTomb = opts.tombstones !== false, clusters = !!opts.clusters;
    var intOnly = allInts(ops);
    var slots = []; for (var q = 0; q < m; q++) slots.push(null);
    var tomb = {};            // slot -> true
    var live = 0, probesTotal = 0, collisions = 0;
    var steps = [], opStart = [], opi = 0, opName = '';
    var truth = {};           // what the table SHOULD contain (for the naive-delete warning)

    function tombList() { return Object.keys(tomb).map(Number).sort(function (a, b) { return a - b; }); }
    function used() { return live + tombList().length; }
    function entries(marks) {
      var out = [];
      slots.forEach(function (e, s) { if (e) out.push({ id: keyId(e.key), key: e.key, bucket: s, state: (marks && marks[keyId(e.key)]) || 'default' }); });
      return out;
    }
    function clusterStates(bs) {
      if (!clusters) return bs;
      var out = Object.assign({}, bs || {});
      runs(slots).forEach(function (r) {
        if (r.length < 3) return;
        for (var k = 0; k < r.length; k++) { var s = (r.start + k) % slots.length; if (out[s] === undefined) out[s] = 'pivot'; }
      });
      return out;
    }
    function snap(k, caption, line, o) {
      o = o || {};
      var u = used();
      var st = {
        kind: k, mode: 'open', probeKind: pk, op: opi, opName: opName, buckets: m, hashFn: hashLabel(intOnly, m, hk), threshold: thr,
        entries: entries(o.marks), tombstones: tombList(), caption: caption, line: line, flow: o.flow || null,
        loadFactor: u / m, vars: o.vars || {},
        counters: { entries: live, buckets: m, load: (u / m).toFixed(2), probes: probesTotal, collisions: collisions }
      };
      if (o.incoming) st.incoming = o.incoming;
      if (o.hash) st.hashValue = o.hash;
      if (o.probe) st.probe = o.probe;
      var bs = clusterStates(o.bucketStates);
      if (bs && Object.keys(bs).length) st.bucketStates = bs;
      if (o.resizing) st.resizing = o.resizing;
      steps.push(st);
    }

    /* Insert without narration (used to rebuild after a resize): returns the slot. */
    function quietInsert(key, into, size) {
      var home = hashOf(key, size, hk), step = secondHash(key, size);
      for (var i = 0; i < size; i++) {
        var s = probeSlot(pk, home, step, size, i);
        if (!into[s]) { into[s] = { key: key }; return s; }
      }
      return -1;
    }
    function grow(to, why) {
      var from = m, tCount = tombList().length;
      snap('growStart', why, 'growNew', { resizing: { from: from, to: to }, vars: { m: from, 'new m': to, size: live } });
      var old = slots, ns = []; for (var i = 0; i < to; i++) ns.push(null);
      var moved = {}, ok = true;
      old.forEach(function (e) { if (e) { if (quietInsert(e.key, ns, to) < 0) ok = false; moved[keyId(e.key)] = 'swap'; } });
      slots = ns; m = to; tomb = {};
      snap('growMove', 'Each key is hashed again with <b>m = ' + to + '</b> and probes into the new array from scratch' + (tCount ? '. The ' + tCount + ' tombstone' + (tCount === 1 ? ' is' : 's are') + ' gone: only live keys are copied' : '') + '. A key can land in a very different slot, because <code>k mod ' + from + '</code> is not <code>k mod ' + to + '</code>.',
        'growPush', { marks: moved, resizing: { from: from, to: to }, vars: { m: to, size: live } });
      snap('growDone', 'The new table has α = ' + live + ' / ' + to + ' = <b>' + (live / to).toFixed(2) + '</b>. Probe sequences are short again.', null, { vars: { m: to, size: live } });
      return ok;
    }
    function highlightRun(list) { var s = {}; list.forEach(function (x) { s[x] = 'compare'; }); return s; }

    /* one probing walk; returns {slot, free, found, probed, empty?, wrongMiss?, exhausted?}. */
    function walk(o, inId, home, step, hv, L) {
      var key = o.key, probed = [], free = -1, key0 = keyText(key);
      var seen = {};
      var fl = function (id) { return o.op === 'search' ? id : null; };
      for (var i = 0; i < m; i++) {
        var s = probeSlot(pk, home, step, m, i);
        probed.push(s); probesTotal++;
        var cell = slots[s], isTomb = !cell && tomb[s];
        var marks = {}; Object.keys(seen).forEach(function (k) { marks[k] = 'visited'; });
        var vars = { key: key0, home: home, i: i, slot: s, m: m };
        var pr = function (stt) { return { slots: probed.slice(), current: s, state: stt }; };
        var inc = function (stt) { return { id: inId, key: key, stage: 'hash', bucket: s, op: o.op, state: stt || 'key' }; };
        var more = i ? ['probe'] : [];
        var nextTxt = '';
        var where = i === 0 ? 'Home slot ' + s : 'Probe ' + i + ' → slot ' + s + ' (<code>' + probeFormula(pk, home, step, m, i) + '</code>)';
        if (cell && cell.key === key) {
          marks[keyId(cell.key)] = o.op === 'delete' ? 'error' : 'found';
          snap('probe', where + ' holds ' + kb(cell.key) + ': a match.' + (o.op === 'insert' ? ' The key is already stored.' : ''), L.match.concat(more),
            { marks: marks, incoming: inc(o.op === 'search' ? 'found' : 'key'), hash: hv, probe: pr(o.op === 'search' ? 'found' : 'compare'), vars: vars, flow: fl('match') });
          return { slot: s, free: free, found: true, probed: probed };
        }
        if (cell) {
          if (i === 0 && o.op === 'insert') collisions++;
          marks[keyId(cell.key)] = 'compare'; seen[keyId(cell.key)] = true;
          snap('probe', where + ' holds ' + kb(cell.key) + ', not ' + kb(key) + '. The slot is taken' + (i === 0 && o.op === 'insert' ? ': a <b>collision</b>' : '') + '. Keep probing.' + nextTxt, L.other.concat(more),
            { marks: marks, incoming: inc(), hash: hv, probe: pr('compare'), vars: vars, flow: fl('next') });
          continue;
        }
        if (isTomb) {
          if (free < 0 && o.op === 'insert') free = s;
          snap('probe', where + ' is a <b>tombstone</b> (†): a key used to live here. ' + (o.op === 'insert'
            ? (free === s ? 'Remember it as a place to reuse, but keep looking: ' : 'Keep looking: ') + kb(key) + ' could still be stored further along.'
            : 'It is not a match, but it is <em>not</em> a dead end either: the key you want may have been stored past it. Keep probing.') + nextTxt, L.tomb.concat(more),
            { marks: marks, incoming: inc(), hash: hv, probe: pr('compare'), vars: vars, flow: fl('next') });
          continue;
        }
        // a truly empty slot ends the walk
        if (o.op === 'insert' && free < 0) free = s;
        var wrong = !!truth[key] && o.op !== 'insert';
        var caption;
        if (o.op === 'insert') caption = where + ' is empty, and a probe that reaches an empty slot proves ' + kb(key) + ' is not stored further along. ' + (free === s ? 'This is the place for it.' : 'The tombstone remembered earlier is the place for it.');
        else caption = where + ' is empty. A probe sequence never jumps over a hole, so ' + kb(key) + ' cannot be further along: it is <b>absent</b>.' + (wrong ? ' <b>But it is not absent.</b> It sits further along this very probe sequence, behind the slot we emptied. The lookup gave a wrong answer.' : '');
        if (wrong) marks[keyId(key)] = 'error';
        snap('probe', caption, L.empty.concat(more), { marks: marks, incoming: inc(o.op === 'insert' ? 'key' : 'error'), hash: hv, probe: pr('active'), vars: vars, flow: fl('empty') });
        return { slot: s, free: free, found: false, probed: probed, empty: s, wrongMiss: wrong };
      }
      return { slot: -1, free: free, found: false, probed: probed, exhausted: true };
    }

    function doOp(o, index) {
      opi = index; opName = o.op; opStart.push(steps.length);
      if (o.op === 'resize') {
        var to = nextSize(m, maxM);
        if (!to) { snap('resizeMax', 'This lab stops growing at ' + m + ' slots so the picture stays readable. Real tables keep doubling.', null, { vars: { m: m } }); return; }
        grow(to, 'Grow on demand: allocate <b>' + to + '</b> slots (about double, and prime), then re-insert every live key.');
        return;
      }
      var key = o.key, id = keyId(key), inId = o.op === 'insert' ? id : 'q' + index;
      var opWord = { insert: 'Insert', search: 'Search for', delete: 'Delete' }[o.op];
      var L = o.op === 'insert'
        ? { loop: 'addLoop', match: ['addProbe', 'addSame'], other: ['addProbe', 'addSame'], tomb: ['addProbe', 'addTomb'], empty: ['addProbe', 'addEmpty'] }
        : o.op === 'search'
          ? { loop: 'hasLoop', match: ['hasProbe', 'hasCmp'], other: ['hasProbe', 'hasCmp'], tomb: ['hasProbe', 'hasCmp'], empty: ['hasProbe', 'hasEmpty'] }
          : { loop: 'delLoop', match: ['delProbe', 'delCut'], other: ['delProbe', 'delCut'], tomb: ['delProbe', 'delCut'], empty: ['delProbe', 'delEmpty'] };
      function attempt(again) {
        var home = hashOf(key, m, hk), step = secondHash(key, m);
        var hv = hashCalc(key, m, hk);
        var extra = pk === 'double' ? ' Second hash: <code>h₂ = 1 + (k mod ' + (m - 1) + ') = ' + step + '</code>, the size of every hop.' : '';
        var vars0 = { key: keyText(key), home: home, m: m };
        if (!again) snap('input', opWord + ' ' + kb(key) + '. The table is one array: every key lives in a slot, and nothing hangs off it.', null, { incoming: { id: inId, key: key, stage: 'input', op: o.op, state: 'key' }, vars: { key: keyText(key), m: m } });
        var bstates = {}; bstates[home] = 'active';
        snap('hash', 'Hash it: <b>' + hv + '</b>' + strNote(key, hk) + '. Slot <b>' + home + '</b> is the key\'s <em>home</em>: the first place to try.' + extra, L.loop, { incoming: { id: inId, key: key, stage: 'hash', bucket: home, op: o.op, state: 'key' }, hash: hv, bucketStates: bstates, vars: vars0, flow: o.op === 'search' ? 'start' : null });
        var w = walk(o, inId, home, step, hv, L);
        var hvOn = hv;
        if (o.op === 'search') {
          if (w.found) snap('hit', 'Found ' + kb(key) + ' in slot ' + w.slot + ' after ' + w.probed.length + ' probe' + (w.probed.length === 1 ? '' : 's') + '.', L.match,
            { marks: (function () { var s = {}; s[id] = 'found'; return s; }()), incoming: { id: inId, key: key, stage: 'hash', bucket: w.slot, op: 'search', state: 'found' }, hash: hvOn, probe: { slots: w.probed, current: w.slot, state: 'found' }, vars: { key: keyText(key), slot: w.slot, found: true }, flow: 'hit' });
          else snap('miss', w.exhausted ? 'Every slot in the probe sequence was checked and ' + kb(key) + ' is not there: absent after ' + w.probed.length + ' probes.' : 'Search over: ' + kb(key) + ' is <b>' + (w.wrongMiss ? 'reported absent (wrongly!)' : 'absent') + '</b> after ' + w.probed.length + ' probe' + (w.probed.length === 1 ? '' : 's') + '.', L.empty,
            { incoming: { id: inId, key: key, stage: 'hash', bucket: w.slot < 0 ? home : w.slot, op: 'search', state: 'error' }, hash: hvOn, probe: { slots: w.probed, current: w.slot < 0 ? undefined : w.slot, state: 'error' }, marks: w.wrongMiss ? (function () { var s = {}; s[id] = 'error'; return s; }()) : undefined, vars: { key: keyText(key), found: false }, flow: 'miss' });
          return;
        }
        if (o.op === 'delete') {
          if (w.found) {
            live--; delete truth[key];
            slots[w.slot] = null;
            if (useTomb) {
              tomb[w.slot] = true;
              snap('tomb', 'Do not just empty slot ' + w.slot + '. Leave a <b>tombstone</b> (†): a marker that says "something was here, keep probing". Later searches that pass through will not stop early.', 'delCut',
                { hash: hvOn, probe: { slots: w.probed, current: w.slot, state: 'active' }, vars: { key: keyText(key), slot: w.slot, tombstones: tombList().length } });
            } else {
              snap('cut', 'Slot ' + w.slot + ' is now empty, exactly as if nothing had ever been there. Watch what that does to any key that was probing <em>through</em> this slot.', 'delCut',
                { hash: hvOn, probe: { slots: w.probed, current: w.slot, state: 'active' }, vars: { key: keyText(key), slot: w.slot } });
            }
          } else snap('miss', kb(key) + ' is not in the table (probing hit ' + (w.exhausted ? 'the end of its sequence' : 'an empty slot') + '), so there is nothing to delete.', L.empty,
            { incoming: { id: inId, key: key, stage: 'hash', bucket: w.slot < 0 ? home : w.slot, op: 'delete', state: 'error' }, hash: hvOn, probe: { slots: w.probed, current: w.slot < 0 ? undefined : w.slot, state: 'error' }, vars: { key: keyText(key), found: false } });
          return;
        }
        // insert
        if (w.found) { snap('dup', kb(key) + ' is already stored in slot ' + w.slot + '. A set keeps one copy, so nothing changes.', L.match, { marks: (function () { var s = {}; s[id] = 'found'; return s; }()), hash: hvOn, vars: { key: keyText(key), slot: w.slot } }); return; }
        if (w.free < 0) {
          var to = auto ? nextSize(m, maxM) : null;
          var why = pk === 'quadratic' && live < m
            ? 'The probe sequence <code>(h + i²) mod ' + m + '</code> only ever visits ' + new Set(w.probed).size + ' of the ' + m + ' slots, all taken, although ' + (m - live) + ' slots are free. Quadratic probing can miss free slots once the table is more than half full.'
            : 'Every slot in the probe sequence is taken: the table is full.';
          if (to) { snap('fail', why + ' Grow the table and try again.', 'addFull', { hash: hvOn, probe: { slots: w.probed, state: 'error' }, vars: { key: keyText(key), m: m } }); grow(to, 'Allocate <b>' + to + '</b> slots and re-insert every key, then retry ' + kb(key) + '.'); attempt(true); }
          else snap('full', why + (auto ? ' This lab cannot grow further, so ' : ' Auto-resize is off, so ') + kb(key) + ' is not stored.', 'addFull', { hash: hvOn, probe: { slots: w.probed, state: 'error' }, vars: { key: keyText(key), m: m } });
          return;
        }
        var reuse = !!tomb[w.free];
        if (reuse) delete tomb[w.free];
        slots[w.free] = { key: key }; live++; truth[key] = true;
        var pm = {}; pm[id] = 'active';
        var hops = w.probed.length;
        snap('place', kb(key) + ' goes into slot <b>' + w.free + '</b>' + (reuse ? ', reusing the tombstone' : '') + (hops > 1 ? ' after ' + hops + ' probes. It is not in its home slot ' + home + ', so lookups for it will also probe ' + hops + ' times.' : ', its home slot, on the first probe.') + ' Load: ' + (used() / m).toFixed(2) + (tombList().length ? ' (live keys + tombstones)' : '') + '.', 'addPlace',
          { marks: pm, hash: hvOn, probe: hops > 1 ? { slots: w.probed, current: w.free, state: 'active' } : undefined, vars: { key: keyText(key), slot: w.free, size: live, m: m } });
        if (auto && used() / m > thr) {
          var to2 = nextSize(m, maxM);
          if (to2) grow(to2, 'Load is ' + used() + ' / ' + m + ' = <b>' + (used() / m).toFixed(2) + '</b>, above the limit ' + thr + '. Probe sequences are getting long, so the table grows now' + (tombList().length ? ' (tombstones count as load too)' : '') + '.');
          else snap('growMax', 'Load is above ' + thr + ', but this lab stops growing at ' + m + ' slots.', 'addGrow', { vars: { m: m } });
        }
      }
      attempt(false);
    }
    ops.forEach(doOp);
    if (!steps.length) snap('empty', 'An empty table: ' + m + ' slots, all free.', null, { vars: { m: m } });
    return { steps: steps, opStart: opStart, final: { m: m, slots: slots.map(function (e) { return e ? e.key : null; }), tombstones: tombList(), size: live, probes: probesTotal, collisions: collisions } };
  }

  /* The bug and its fix: three keys with the same home, delete the first, then search the last. */
  function tombstoneDemo(naive) {
    var ops = [{ op: 'insert', key: 10 }, { op: 'insert', key: 17 }, { op: 'insert', key: 24 }, { op: 'delete', key: 10 }, { op: 'search', key: 24 }];
    return probing(ops, { m: 7, kind: 'linear', tombstones: !naive, autoResize: false });
  }

  /* ------------------------------------------------------------------ probing race (clustering) */
  /* frames[k] = after inserting keys[k]: {key, kinds: {linear: {slots, probes, total, longest, slot, probed}, ...}} */
  function clusterRace(keys, m) {
    var kinds = ['linear', 'quadratic', 'double'], tables = {}, totals = {}, frames = [];
    kinds.forEach(function (k) { tables[k] = []; for (var i = 0; i < m; i++) tables[k].push(null); totals[k] = 0; });
    keys.forEach(function (key) {
      var frame = { key: key, kinds: {} };
      kinds.forEach(function (kind) {
        var t = tables[kind], home = hashOf(key, m, 'mod'), step = secondHash(key, m), probed = [], slot = -1;
        for (var i = 0; i < m; i++) {
          var s = probeSlot(kind, home, step, m, i);
          probed.push(s);
          if (t[s] === null) { t[s] = key; slot = s; break; }
        }
        totals[kind] += probed.length;
        var longest = 0; runs(t).forEach(function (r) { longest = Math.max(longest, r.length); });
        frame.kinds[kind] = { slots: t.slice(), probes: probed.length, total: totals[kind], longest: longest, slot: slot, probed: probed, home: home };
      });
      frames.push(frame);
    });
    return frames;
  }

  /* ------------------------------------------------------------------ how well does a hash spread keys? */
  function distribution(keys, m, kind) {
    var counts = []; for (var i = 0; i < m; i++) counts.push(0);
    var bucketOf = keys.map(function (k) {
      var s = String(k), n;
      if (kind === 'first') n = s.charCodeAt(0);
      else if (kind === 'sum') { n = 0; for (var j = 0; j < s.length; j++) n += s.charCodeAt(j); }
      else n = polyOf(s, 31);
      return mod(n, m);
    });
    bucketOf.forEach(function (b) { counts[b]++; });
    var max = 0, empty = 0;
    counts.forEach(function (c) { if (c > max) max = c; if (!c) empty++; });
    return { counts: counts, max: max, empty: empty, bucketOf: bucketOf };
  }

  /* ------------------------------------------------------------------ the birthday paradox */
  /* Throw keys at m slots until one lands on an occupied slot. Returns {throws, slots: [slot per throw], collidedWith}. */
  function birthdayRun(m, rng) {
    var taken = {}, slots = [];
    for (;;) {
      var s = Math.floor(rng() * m);
      slots.push(s);
      if (taken[s] !== undefined) return { throws: slots.length, slots: slots, slot: s, first: taken[s] };
      taken[s] = slots.length - 1;
    }
  }
  function birthdayProb(n, m) {
    if (n > m) return 1;
    var p = 1;
    for (var i = 0; i < n; i++) p *= (m - i) / m;
    return 1 - p;
  }
  function birthdayHistogram(m, trials, rng) {
    var counts = {}, sum = 0, max = 0;
    for (var t = 0; t < trials; t++) {
      var r = birthdayRun(m, rng).throws;
      counts[r] = (counts[r] || 0) + 1; sum += r; if (r > max) max = r;
    }
    return { counts: counts, mean: sum / trials, max: max, trials: trials };
  }

  /* ------------------------------------------------------------------ expected probes */
  /* Cost = keys (chaining) or slots (open addressing) examined by one search; found / missing are the averages at load
   factor alpha (0 <= alpha < 1). Hashing the key and reaching the bucket is one more O(1) step in every scheme. */
  function expectedProbes(kind, alpha) {
    if (kind === 'chaining') return { found: 1 + alpha / 2, missing: alpha };
    if (kind === 'linear') return { found: 0.5 * (1 + 1 / (1 - alpha)), missing: 0.5 * (1 + 1 / ((1 - alpha) * (1 - alpha))) };
    return { found: alpha === 0 ? 1 : (1 / alpha) * Math.log(1 / (1 - alpha)), missing: 1 / (1 - alpha) };   // uniform / double hashing
  }
  /* Measured: fill a table of m slots to each alpha with random keys, average over trials.
     Chaining counts entries compared; open addressing counts slots examined. */
  function simulateProbes(kind, m, alphas, trials, rng) {
    return alphas.map(function (alpha) {
      var n = Math.round(alpha * m), foundSum = 0, foundCnt = 0, missSum = 0, missCnt = 0;
      for (var t = 0; t < trials; t++) {
        if (kind === 'chaining') {
          var lens = []; for (var b = 0; b < m; b++) lens.push(0);
          for (var i = 0; i < n; i++) { var h = Math.floor(rng() * m); lens[h]++; foundSum += lens[h]; foundCnt++; }
          lens.forEach(function (len) { missSum += len; missCnt++; });
        } else {
          var table = []; for (var s = 0; s < m; s++) table.push(false);
          var draw = function () { return { h: Math.floor(rng() * m), d: 1 + Math.floor(rng() * (m - 1)) }; };
          var at = function (p, i2) { return kind === 'linear' ? (p.h + i2) % m : (p.h + i2 * p.d) % m; };
          for (var k = 0; k < n; k++) {
            var p = draw(), j = 0;
            while (table[at(p, j)]) j++;
            table[at(p, j)] = true; foundSum += j + 1; foundCnt++;
          }
          for (var q = 0; q < m; q++) {
            var p2 = draw(), j2 = 0;
            while (table[at(p2, j2)] && j2 < m) j2++;
            missSum += j2 + 1; missCnt++;
          }
        }
      }
      return { alpha: alpha, found: foundCnt ? foundSum / foundCnt : 1, missing: missCnt ? missSum / missCnt : 1 };
    });
  }

  /* ------------------------------------------------------------------ growing a table: amortised cost */
  /* Cost of each of n inserts into a table that starts at capacity 4 and is full when size = capacity.
     policy 'double' doubles the capacity; 'plus' adds 8. A resize costs one unit per key moved, plus 1 for the insert. */
  function growthCosts(n, policy) {
    var cap = 4, size = 0, costs = [], avg = [], total = 0, resizes = [];
    for (var i = 1; i <= n; i++) {
      var c = 1;
      if (size === cap) { c += size; cap = policy === 'plus' ? cap + 8 : cap * 2; resizes.push(i); }
      size++; total += c;
      costs.push(c); avg.push(total / i);
    }
    return { costs: costs, avg: avg, resizes: resizes, total: total };
  }

  /* ------------------------------------------------------------------ code for the labs */
  var CHAIN_JS = [
    'class ChainedSet {',
    '  constructor(m = 7) { this.m = m; this.chains = Array.from({ length: m }, () => []); this.size = 0; }',
    '  // hash(key) returns a non-negative integer',
    '  add(key) {',
    '    const chain = this.chains[hash(key) % this.m];      // @addHash',
    '    for (const k of chain) {                            // @addScan',
    '      if (k === key) return false;                      // @addCmp',
    '    }',
    '    chain.push(key); this.size++;                       // @addPush',
    '    if (this.size / this.m > 0.75) this.grow();         // @addGrow',
    '    return true;',
    '  }',
    '  has(key) {',
    '    const chain = this.chains[hash(key) % this.m];      // @hasHash',
    '    for (const k of chain) {                            // @hasScan',
    '      if (k === key) return true;                       // @hasCmp',
    '    }',
    '    return false;                                       // @hasNo',
    '  }',
    '  delete(key) {',
    '    const chain = this.chains[hash(key) % this.m];      // @delHash',
    '    for (let j = 0; j < chain.length; j++) {            // @delScan',
    '      if (chain[j] === key) {                           // @delCmp',
    '        chain.splice(j, 1); this.size--;                // @delCut',
    '        return true;',
    '      }',
    '    }',
    '    return false;                                       // @delNo',
    '  }',
    '  grow() {',
    '    const old = this.chains;',
    '    this.m = nextPrime(this.m * 2);                     // @growNew',
    '    this.chains = Array.from({ length: this.m }, () => []);',
    '    for (const chain of old)                            // @growLoop',
    '      for (const k of chain) this.chains[hash(k) % this.m].push(k);   // @growPush',
    '  }',
    '}'
  ].join('\n');
  var CHAIN_PY = [
    'class ChainedSet:',
    '    def __init__(self, m=7):',
    '        self.m, self.size = m, 0',
    '        self.chains = [[] for _ in range(m)]',
    '',
    '    # hash(key) returns a non-negative integer',
    '    def add(self, key):',
    '        chain = self.chains[hash(key) % self.m]     # @addHash',
    '        for k in chain:                             # @addScan',
    '            if k == key: return False               # @addCmp',
    '        chain.append(key); self.size += 1           # @addPush',
    '        if self.size / self.m > 0.75: self.grow()   # @addGrow',
    '        return True',
    '',
    '    def has(self, key):',
    '        chain = self.chains[hash(key) % self.m]     # @hasHash',
    '        for k in chain:                             # @hasScan',
    '            if k == key: return True                # @hasCmp',
    '        return False                                # @hasNo',
    '',
    '    def delete(self, key):',
    '        chain = self.chains[hash(key) % self.m]     # @delHash',
    '        for j in range(len(chain)):                 # @delScan',
    '            if chain[j] == key:                     # @delCmp',
    '                del chain[j]; self.size -= 1        # @delCut',
    '                return True',
    '        return False                                # @delNo',
    '',
    '    def grow(self):',
    '        old = self.chains',
    '        self.m = next_prime(self.m * 2)             # @growNew',
    '        self.chains = [[] for _ in range(self.m)]',
    '        for chain in old:                           # @growLoop',
    '            for k in chain: self.chains[hash(k) % self.m].append(k)   # @growPush'
  ].join('\n');
  var CHAIN_PSEUDO = [
    'add(key):',
    '  chain ← chains[hash(key) mod m]        // @addHash',
    '  for each k in chain                    // @addScan',
    '    if k = key then return               // @addCmp',
    '  append key to chain; size ← size + 1   // @addPush',
    '  if size / m > 0.75 then grow()         // @addGrow',
    '',
    'has(key):',
    '  chain ← chains[hash(key) mod m]        // @hasHash',
    '  for each k in chain                    // @hasScan',
    '    if k = key then return true          // @hasCmp',
    '  return false                           // @hasNo',
    '',
    'delete(key):',
    '  chain ← chains[hash(key) mod m]        // @delHash',
    '  for each position j in chain           // @delScan',
    '    if chain[j] = key then               // @delCmp',
    '      remove chain[j]; size ← size − 1   // @delCut',
    '      return',
    '  (key not present)                      // @delNo',
    '',
    'grow():',
    '  m ← next prime ≥ 2m                    // @growNew',
    '  for each old chain, for each key k     // @growLoop',
    '    append k to chains[hash(k) mod m]    // @growPush'
  ].join('\n');

  function openCode(kind) {
    var probeJs = kind === 'quadratic' ? '(hash(key) + i * i) % this.slots.length;'
      : kind === 'double' ? '(hash(key) + i * (1 + hash(key) % (this.slots.length - 1))) % this.slots.length;'
        : '(hash(key) + i) % this.slots.length;';
    var probePy = kind === 'quadratic' ? '(hash(key) + i * i) % len(self.slots)'
      : kind === 'double' ? '(hash(key) + i * (1 + hash(key) % (len(self.slots) - 1))) % len(self.slots)'
        : '(hash(key) + i) % len(self.slots)';
    var probePs = kind === 'quadratic' ? '(hash(key) + i²) mod m' : kind === 'double' ? '(hash(key) + i · h₂(key)) mod m, with h₂(key) = 1 + hash(key) mod (m − 1)' : '(hash(key) + i) mod m';
    var js = [
      'const EMPTY = null, TOMB = Symbol("tombstone");',
      'class ProbingSet {',
      '  constructor(m = 7) { this.slots = new Array(m).fill(EMPTY); this.used = 0; }   // used = keys + tombstones',
      '  probe(key, i) {                                       // i = 0, 1, 2, ... is the attempt number',
      '    return ' + probeJs + '   // @probe',
      '  }',
      '  add(key) {',
      '    let free = -1;',
      '    for (let i = 0; i < this.slots.length; i++) {       // @addLoop',
      '      const s = this.probe(key, i);                     // @addProbe',
      '      const v = this.slots[s];',
      '      if (v === key) return false;                      // @addSame',
      '      if (v === TOMB && free < 0) free = s;             // @addTomb',
      '      if (v === EMPTY) { if (free < 0) free = s; break; }   // @addEmpty',
      '    }',
      '    if (free < 0) { this.grow(); return this.add(key); }    // @addFull',
      '    if (this.slots[free] === EMPTY) this.used++;',
      '    this.slots[free] = key;                             // @addPlace',
      '    if (this.used / this.slots.length > 0.7) this.grow();   // @addGrow',
      '    return true;',
      '  }',
      '  has(key) {',
      '    for (let i = 0; i < this.slots.length; i++) {       // @hasLoop',
      '      const s = this.probe(key, i);                     // @hasProbe',
      '      const v = this.slots[s];',
      '      if (v === EMPTY) return false;                    // @hasEmpty',
      '      if (v === key) return true;                       // @hasCmp',
      '    }                                                   // a tombstone falls through: keep probing',
      '    return false;',
      '  }',
      '  delete(key) {',
      '    for (let i = 0; i < this.slots.length; i++) {       // @delLoop',
      '      const s = this.probe(key, i);                     // @delProbe',
      '      const v = this.slots[s];',
      '      if (v === EMPTY) return false;                    // @delEmpty',
      '      if (v === key) { this.slots[s] = TOMB; return true; }   // @delCut',
      '    }',
      '    return false;',
      '  }',
      '  grow() {',
      '    const old = this.slots;',
      '    this.slots = new Array(nextPrime(old.length * 2)).fill(EMPTY);   // @growNew',
      '    this.used = 0;',
      '    for (const k of old) if (k !== EMPTY && k !== TOMB) this.add(k);   // @growPush',
      '  }',
      '}'
    ].join('\n');
    var py = [
      'EMPTY, TOMB = None, object()',
      'class ProbingSet:',
      '    def __init__(self, m=7):',
      '        self.slots, self.used = [EMPTY] * m, 0        # used = keys + tombstones',
      '',
      '    def probe(self, key, i):                          # i = 0, 1, 2, ... is the attempt number',
      '        return ' + probePy + '   # @probe',
      '',
      '    def add(self, key):',
      '        free = -1',
      '        for i in range(len(self.slots)):              # @addLoop',
      '            s = self.probe(key, i)                    # @addProbe',
      '            v = self.slots[s]',
      '            if v == key: return False                 # @addSame',
      '            if v is TOMB and free < 0: free = s       # @addTomb',
      '            if v is EMPTY:                            # @addEmpty',
      '                if free < 0: free = s',
      '                break',
      '        if free < 0:                                  # @addFull',
      '            self.grow(); return self.add(key)',
      '        if self.slots[free] is EMPTY: self.used += 1',
      '        self.slots[free] = key                        # @addPlace',
      '        if self.used / len(self.slots) > 0.7: self.grow()   # @addGrow',
      '        return True',
      '',
      '    def has(self, key):',
      '        for i in range(len(self.slots)):              # @hasLoop',
      '            s = self.probe(key, i)                    # @hasProbe',
      '            v = self.slots[s]',
      '            if v is EMPTY: return False               # @hasEmpty',
      '            if v == key: return True                  # @hasCmp',
      '        return False                                  # a tombstone falls through: keep probing',
      '',
      '    def delete(self, key):',
      '        for i in range(len(self.slots)):              # @delLoop',
      '            s = self.probe(key, i)                    # @delProbe',
      '            v = self.slots[s]',
      '            if v is EMPTY: return False               # @delEmpty',
      '            if v == key:                              # @delCut',
      '                self.slots[s] = TOMB; return True',
      '        return False',
      '',
      '    def grow(self):',
      '        old = self.slots',
      '        self.slots, self.used = [EMPTY] * next_prime(len(old) * 2), 0   # @growNew',
      '        for k in old:',
      '            if k is not EMPTY and k is not TOMB: self.add(k)   # @growPush'
    ].join('\n');
    var pseudo = [
      'probe(key, i) = ' + probePs + '          // @probe',
      '',
      'add(key):',
      '  free ← none',
      '  for i ← 0 to m − 1                     // @addLoop',
      '    s ← probe(key, i)                    // @addProbe',
      '    if slot[s] = key then return         // @addSame',
      '    if slot[s] is a tombstone: free ← s (first one)   // @addTomb',
      '    if slot[s] is empty: free ← free or s; stop   // @addEmpty',
      '  if free is none: grow, then add again  // @addFull',
      '  slot[free] ← key                       // @addPlace',
      '  if (keys + tombstones) / m > 0.7 then grow()   // @addGrow',
      '',
      'has(key):',
      '  for i ← 0 to m − 1                     // @hasLoop',
      '    s ← probe(key, i)                    // @hasProbe',
      '    if slot[s] is empty then return false    // @hasEmpty',
      '    if slot[s] = key then return true    // @hasCmp',
      '  return false',
      '',
      'delete(key):',
      '  for i ← 0 to m − 1                     // @delLoop',
      '    s ← probe(key, i)                    // @delProbe',
      '    if slot[s] is empty then return      // @delEmpty',
      '    if slot[s] = key then slot[s] ← tombstone; return   // @delCut',
      '',
      'grow():',
      '  m ← next prime ≥ 2m; new empty slots   // @growNew',
      '  add every live key again               // @growPush'
    ].join('\n');
    return { pseudo: pseudo, js: js, py: py };
  }

  /* ------------------------------------------------------------------ example key sets */
  var USERNAMES = []; for (var u = 1; u <= 36; u++) USERNAMES.push('user' + (u < 10 ? '0' : '') + u);
  var WORDS = ['apple', 'bread', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'house', 'ivory', 'juice', 'knife', 'lemon', 'mango', 'night', 'ocean', 'piano', 'queen', 'river', 'stone', 'tiger', 'union', 'vivid', 'water', 'xenon', 'yacht', 'zebra',
    'seven', 'sugar', 'swift', 'shade', 'spice', 'smile', 'sleep', 'south', 'crane', 'coral', 'craft', 'plant', 'pearl', 'paint'];
  var ANAGRAMS = ['team', 'meat', 'mate', 'tame', 'care', 'race', 'acre', 'stale', 'least', 'steal', 'slate', 'tales', 'bread', 'beard', 'bared', 'debit', 'bited', 'brag', 'grab', 'dear', 'dare', 'read', 'loop', 'pool', 'polo', 'below', 'elbow', 'bowel'];
  var KEYSETS = { usernames: USERNAMES, words: WORDS, anagrams: ANAGRAMS };

  return {
    PRIMES: PRIMES, nextPrime: nextPrime, parseKey: parseKey, keyId: keyId, rawHash: rawHash, hashOf: hashOf, secondHash: secondHash,
    hashCalc: hashCalc, probeSlot: probeSlot, probeFormula: probeFormula, polyOf: polyOf, machine: machine, runs: runs,
    chaining: chaining, probing: probing, tombstoneDemo: tombstoneDemo, clusterRace: clusterRace, distribution: distribution,
    birthdayRun: birthdayRun, birthdayProb: birthdayProb, birthdayHistogram: birthdayHistogram,
    expectedProbes: expectedProbes, simulateProbes: simulateProbes, growthCosts: growthCosts,
    CODE: { chaining: { pseudo: CHAIN_PSEUDO, js: CHAIN_JS, py: CHAIN_PY } }, openCode: openCode, KEYSETS: KEYSETS, TOMB: TOMB
  };
}));
