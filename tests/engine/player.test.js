// Engine tests: pure logic from the player, code panel, variable watch and widgets.
// Run: node --test tests/engine/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const player = require(path.join(root, 'js/vdsa/player.js'));
const code = require(path.join(root, 'js/vdsa/code.js'));
const vars = require(path.join(root, 'js/vdsa/vars.js'));
const widgets = require(path.join(root, 'js/vdsa/widgets.js'));

const L = player.logic;

/* ------------------------------------------------------------------ player logic */
test('clamp keeps indices inside the step list', () => {
  assert.equal(L.clamp(5, 3), 2);
  assert.equal(L.clamp(-4, 3), 0);
  assert.equal(L.clamp(1.9, 3), 1);
  assert.equal(L.clamp(NaN, 3), 0);
  assert.equal(L.clamp('2', 3), 2);
  assert.equal(L.clamp(Infinity, 3), 2);
  assert.equal(L.clamp(0, 0), -1, 'no steps means no valid index');
});

test('timing: animation always fits inside the step interval', () => {
  for (const base of [300, 600, 900, 1500]) {
    for (const speed of [0.25, 0.5, 1, 2, 4]) {
      const t = L.timing({ baseStepMs: base, speed });
      assert.equal(t.interval, Math.round(base / speed));
      assert.ok(t.duration <= t.interval * 0.8 + 1, `duration ${t.duration} fits ${t.interval}`);
      assert.ok(t.duration > 0);
    }
  }
  assert.equal(L.timing({ baseStepMs: 900, speed: 1 }).duration, 600, 'default animMs caps at 600');
  assert.equal(L.timing({ baseStepMs: 500, speed: 1 }).duration, 400, '0.8 x base when base is short');
  assert.equal(L.timing({ baseStepMs: 900, speed: 2, animMs: 300 }).duration, 150);
  assert.equal(L.timing({ baseStepMs: 900, speed: 1, animMs: 5000 }).duration, 720, 'animMs is capped at 0.8 x base');
  assert.equal(L.timing({ baseStepMs: 900, speed: 1, instant: true }).duration, 0);
  assert.equal(L.timing({ baseStepMs: 900, speed: 1, reduced: true }).duration, 0);
  assert.equal(L.timing({ baseStepMs: 0, speed: 0 }).interval, 900, 'bad inputs fall back to defaults');
});

test('nearestSpeed picks the closest listed speed', () => {
  const speeds = [0.25, 0.5, 1, 2, 4];
  assert.equal(L.nearestSpeed(speeds, 1), 2);
  assert.equal(L.nearestSpeed(speeds, 3.1), 4);
  assert.equal(L.nearestSpeed(speeds, 0.1), 0);
});

test('checkpoints fire only on single forward steps into an armed index', () => {
  const cps = [{ index: 4, done: false }, { index: 7, done: true }];
  assert.equal(L.checkpointFor(cps, 3, 4), cps[0]);
  assert.equal(L.checkpointFor(cps, 2, 4), null, 'jumps skip checkpoints');
  assert.equal(L.checkpointFor(cps, 5, 4), null, 'going back skips checkpoints');
  assert.equal(L.checkpointFor(cps, 6, 7), null, 'answered checkpoints do not fire again');
  assert.equal(L.direction(-1, 0), 0);
  assert.equal(L.direction(2, 5), 1);
  assert.equal(L.direction(5, 2), -1);
  assert.equal(L.isSingleStep(3, 4), true);
  assert.equal(L.isSingleStep(-1, 0), false);
});

/* ------------------------------------------------------------------ code panel: labels */
test('labels are parsed and stripped in every language', () => {
  const js = code.parse(`
    function f(a) {
      if (a[j] > a[j + 1]) {   // @cmp
        swap(a, j, j + 1);     // @swap @write
      }
    }`, 'js');
  assert.deepEqual(js.labels.cmp, [1]);
  assert.deepEqual(js.labels.swap, [2]);
  assert.deepEqual(js.labels.write, [2]);
  assert.equal(js.lines[1].text, '  if (a[j] > a[j + 1]) {', 'label comment and trailing space removed; indentation dedented');
  assert.ok(!js.lines.some(l => l.text.includes('@')), 'no @label visible');

  const py = code.parse('def f(a):\n    if a[j] > a[j + 1]:  # @cmp\n        pass', 'python');
  assert.deepEqual(py.labels.cmp, [1]);
  assert.equal(py.lines[1].text, '    if a[j] > a[j + 1]:');

  const pseudo = code.parse('for i ← 1 to n   // @loop\n  x ← x + 1', 'pseudo');
  assert.deepEqual(pseudo.labels.loop, [0]);
  assert.equal(pseudo.lines[0].text, 'for i ← 1 to n');
});

test('a comment with words keeps the words, only the @label goes', () => {
  const p = code.parse('x = 1  // set x first @init', 'js');
  assert.deepEqual(p.labels.init, [0]);
  assert.equal(p.lines[0].text, 'x = 1  // set x first');
});

test('a label-only line labels the next non-blank line and disappears', () => {
  const p = code.parse('a = 1\n# @step\n\nb = 2\nc = 3', 'py');
  assert.equal(p.lines.length, 4, 'label line removed, blank line kept');
  assert.deepEqual(p.labels.step, [2]);
  assert.equal(p.lines[2].text, 'b = 2');
});

test('@ inside strings is never a label', () => {
  const p = code.parse('const email = "me@cmp.com"; // real comment', 'js');
  assert.equal(p.labels.cmp, undefined);
  assert.ok(p.lines[0].text.includes('me@cmp.com'));
  const q = code.parse('print("# @nope")  # @yes', 'py');
  assert.equal(q.labels.nope, undefined);
  assert.deepEqual(q.labels.yes, [0]);
  assert.equal(q.lines[0].text, 'print("# @nope")');
});

test('resolve accepts labels, numbers, per-language objects and arrays', () => {
  const p = code.parse('a\nb // @x\nc // @y\nd', 'js');
  assert.deepEqual(code.resolve(p, 'x'), [1]);
  assert.deepEqual(code.resolve(p, 3), [2]);
  assert.deepEqual(code.resolve(p, '4'), [3]);
  assert.deepEqual(code.resolve(p, ['y', 'x', 'x']), [1, 2], 'sorted and unique');
  assert.deepEqual(code.resolve(p, { js: 'y', py: 'x' }, 'js'), [2]);
  assert.deepEqual(code.resolve(p, { javascript: 1 }, 'js'), [0], 'language aliases work in objects');
  assert.deepEqual(code.resolve(p, { py: 'x' }, 'js'), [], 'missing language highlights nothing');
  assert.deepEqual(code.resolve(p, null), []);
  assert.deepEqual(code.resolve(p, 99), [], 'out-of-range line numbers are ignored');
  assert.deepEqual(code.resolve(p, 'missing'), []);
});

/* ------------------------------------------------------------------ code panel: tokenizer */
test('tokenizer classifies keywords, strings, numbers, comments and function names', () => {
  const [line] = code.tokenize('function go(x) { return "hi" + 42; } // done', 'js');
  const byType = t => line.filter(k => k.t === t).map(k => k.v);
  assert.deepEqual(byType('kw'), ['function', 'return']);
  assert.deepEqual(byType('fn'), ['go']);
  assert.deepEqual(byType('str'), ['"hi"']);
  assert.deepEqual(byType('num'), ['42']);
  assert.deepEqual(byType('com'), ['// done']);
  const [py] = code.tokenize('def find_max(a): return None', 'py');
  assert.ok(py.some(k => k.t === 'fn' && k.v === 'find_max'), 'name after def is a function');
  assert.ok(py.some(k => k.t === 'lit' && k.v === 'None'));
  const [ps] = code.tokenize('IF x > 1 THEN return TRUE', 'pseudo');
  assert.ok(ps.filter(k => k.t === 'kw').length >= 3, 'pseudocode keywords are case-insensitive');
});

test('comment markers inside strings stay strings; escapes are honoured', () => {
  const [a] = code.tokenize('const u = "http://x.y"; // c', 'js');
  assert.ok(a.some(k => k.t === 'str' && k.v === '"http://x.y"'));
  assert.equal(a.filter(k => k.t === 'com').length, 1);
  const [b] = code.tokenize('s = "a \\" # b"  # real', 'py');
  assert.ok(b.some(k => k.t === 'str' && k.v === '"a \\" # b"'));
  assert.ok(b.some(k => k.t === 'com' && k.v === '# real'));
});

test('block comments and python triple quotes span lines', () => {
  const lines = code.tokenize('a = 1 /* start\nstill comment\nend */ b = 2', 'js');
  assert.ok(lines[1].every(k => k.t === 'com'));
  assert.ok(lines[2].some(k => k.t === 'id' && k.v === 'b'));
  const py = code.tokenize('x = """one\ntwo\nthree""" + y', 'py');
  assert.ok(py[1].every(k => k.t === 'str'));
  assert.ok(py[2].some(k => k.t === 'id' && k.v === 'y'));
});

test('HTML output is escaped', () => {
  const p = code.parse('if (a < b && s === "<script>alert(1)</script>") {}', 'js');
  const html = code.toHtml(p);
  assert.ok(!html.includes('<script>'), 'no raw script tag');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;&amp;'));
  assert.ok(!/<(?!\/?span)/.test(html.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')), 'only span tags are emitted');
});

test('tokenizer is linear on pathological input', () => {
  const nasty = [
    '/'.repeat(50000),
    '"'.repeat(50001),
    ' '.repeat(50000) + '@',
    '*'.repeat(50000),
    '\\'.repeat(50000),
    '// ' + '@a '.repeat(10000),
    'x'.repeat(50000) + '(',
    '1e+'.repeat(20000)
  ];
  for (const src of nasty) {
    for (const lang of ['js', 'py', 'pseudo', 'cpp']) {
      const t0 = Date.now();
      code.toHtml(code.parse(src, lang));
      assert.ok(Date.now() - t0 < 500, `fast on ${JSON.stringify(src.slice(0, 6))}… (${lang})`);
    }
  }
});

test('dedent removes shared indentation and blank edges', () => {
  assert.deepEqual(code.dedent('\n    a\n      b\n\n    c\n  \n'), ['a', '  b', '', 'c']);
  assert.deepEqual(code.dedent('\tx'), ['x']);
  assert.deepEqual(code.dedent(''), []);
});

/* ------------------------------------------------------------------ variable watch */
test('vars.format renders values compactly and clearly', () => {
  const f = v => vars.format(v).text;
  assert.equal(f([3, 5, 8]), '[3, 5, 8]');
  assert.equal(f([[1, 2], [3]]), '[[1, 2], [3]]');
  assert.equal(f(null), 'null');
  assert.equal(f(undefined), 'undefined');
  assert.equal(vars.format(undefined).type, 'undef');
  assert.equal(f('ab'), '"ab"');
  assert.equal(f(Infinity), '∞');
  assert.equal(f(-Infinity), '−∞');
  assert.equal(f(0.1 + 0.2), '0.3');
  assert.equal(f(true), 'true');
  assert.equal(f({ a: 1, b: [2] }), '{a: 1, b: [2]}');
  assert.equal(f({ a: 1, b: 2, c: 3, d: 4, e: 5 }), '{a: 1, b: 2, c: 3, d: 4, …}');
  assert.match(f(Array.from({ length: 20 }, (_, i) => i)), /^\[0, 1, .*11, … 8 more\]$/);
  assert.equal(f(new Set([1, 2])), 'Set{1, 2}');
  assert.equal(f(new Map([['k', 1]])), 'Map{"k" → 1}');
  assert.equal(f(vars.raw('lo..hi')), 'lo..hi');
});

/* ------------------------------------------------------------------ presets */
test('presets are deterministic with a seed and honour their shape', () => {
  const P = widgets.presets;
  assert.deepEqual(P.random(8, { seed: 3 }), P.random(8, { seed: 3 }));
  const s = P.sorted(10, { seed: 1 });
  assert.deepEqual(s, s.slice().sort((a, b) => a - b));
  assert.equal(new Set(s).size, 10, 'sorted uses distinct values');
  const r = P.reversed(10, { seed: 1 });
  assert.deepEqual(r, s.slice().reverse());
  const ns = P.nearlySorted(12, { seed: 2 });
  assert.equal(ns.length, 12);
  const fu = P.fewUnique(30, { seed: 4, k: 3 });
  assert.ok(new Set(fu).size <= 3);
  const u = P.random(20, { seed: 5, unique: true, min: 1, max: 20 });
  assert.equal(new Set(u).size, 20);
  assert.ok(P.random(50, { seed: 6, min: -5, max: 5 }).every(v => v >= -5 && v <= 5));
  assert.deepEqual(P.allEqual(3, { value: 7 }), [7, 7, 7]);
});
