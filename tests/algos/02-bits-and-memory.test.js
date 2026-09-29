/* node --test tests/algos/02-bits-and-memory.test.js
   Checks the lesson 02 step generators against straightforward reference implementations
   (Node's Buffer for byte layouts, plain arithmetic for counting and addition). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const B = require(path.join(__dirname, '../../js/algos/02-bits-and-memory.js'));
const VDSA = require(path.join(__dirname, '../../js/vdsa/core.js'));

function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

test('number helpers: bits, signed, hex, bytes', () => {
  const rng = VDSA.rng(2);
  for (let k = 0; k < 500; k++) {
    const w = rng.pick([4, 8, 16, 32]);
    const v = rng.int(-Math.pow(2, w - 1), Math.pow(2, w) - 1);
    const bits = B.bitsOf(v, w);
    assert.equal(bits.length, w);
    const u = B.fromBits(bits);
    assert.equal(u, ((v % 2 ** w) + 2 ** w) % 2 ** w);
    assert.equal(B.wrap(v, w), u);
    const s = B.toSigned(v, w);
    assert.ok(s >= -(2 ** (w - 1)) && s < 2 ** (w - 1));
    assert.equal(B.wrap(s, w), u);
  }
  assert.equal(B.toSigned(255, 8), -1);
  assert.equal(B.toSigned(128, 8), -128);
  assert.equal(B.toSigned(127, 8), 127);
  assert.equal(B.toSigned(-129, 8), 127);          // wraps
  assert.equal(B.wrap(-1, 32), 4294967295);
  assert.equal(B.hex(42, 2), '0x2A');
  assert.equal(B.hexByte(255), 'FF');
  assert.equal(B.bin(42, 8), '0010 1010');
  assert.equal(B.bin(5, 4, 0), '0101');
  assert.deepEqual(B.bitsOf(5, 4), [0, 1, 0, 1]);
  assert.equal(B.charName(65), 'A');
  assert.equal(B.charName(32), 'space');
  assert.equal(B.charName(10), 'LF (new line)');
  assert.equal(B.charName(200), null);
  assert.equal(B.charLiteral(0), "'\\0'");
  assert.equal(B.charLiteral(39), "'\\''");
  for (let k = 0; k < 300; k++) {
    const size = rng.pick([1, 2, 4]);
    const v = rng.int(-(2 ** (size * 8 - 1)), 2 ** (size * 8 - 1) - 1);
    const buf = Buffer.alloc(4);
    if (size === 4) buf.writeInt32LE(v); else if (size === 2) buf.writeInt16LE(v); else buf.writeInt8(v);
    assert.deepEqual(B.bytesLE(v, size), [...buf.subarray(0, size)]);
    assert.equal(B.fromBytesLE(B.bytesLE(v, size), true), v);
  }
});

test('increment: flips are exactly the bits that change', () => {
  for (const w of [4, 8]) {
    for (let v = 0; v < 2 ** w; v++) {
      const inc = B.increment(v, w);
      const next = (v + 1) % 2 ** w;
      assert.equal(inc.to, next);
      assert.equal(inc.flips.length, popcount(v ^ next), `v=${v}`);
      inc.flips.forEach((p, i) => assert.equal(p, i));          // a contiguous ripple from bit 0
      inc.flips.forEach((p) => assert.notEqual((v >> p) & 1, (next >> p) & 1));
      assert.equal(inc.carryOut, v === 2 ** w - 1);
    }
  }
});

test('counterSteps: counts up, wraps at 2^w, and total flips stay below 2 per step', () => {
  const steps = B.counterSteps(8, 0, 256);
  assert.equal(steps.length, 257);
  steps.forEach((s, k) => {
    assert.equal(s.value, k % 256);
    assert.deepEqual(s.bits, B.bitsOf(k % 256, 8));
    assert.ok(s.caption && s.caption.length > 10);
    assert.deepEqual(Object.keys(s.counters), ['value', 'flips', 'total', 'avg']);
    if (k) assert.ok(s.total < 2 * k);
  });
  assert.equal(steps[256].carryOut, true);
  assert.equal(steps[256].flips.length, 8);
  assert.match(steps[256].caption, /overflow/);
  assert.equal(steps[128].flips.length, 8);                     // 127 -> 128 flips all eight bits
  const from = B.counterSteps(4, 14, 3);
  assert.deepEqual(from.map((s) => s.value), [14, 15, 0, 1]);
  assert.deepEqual(B.flipCounts(8), [1, 2, 1, 3, 1, 2, 1, 4]);
});

test('patternSteps: 2^k distinct leaves, each a prefix-extension of the level above', () => {
  const steps = B.patternSteps(4);
  assert.equal(steps.length, 5);
  steps.forEach((s, k) => {
    const leaves = s.nodes.filter((n) => n.depth === k);
    assert.equal(leaves.length, 2 ** k);
    assert.equal(s.count, 2 ** k);
    assert.equal(new Set(leaves.map((n) => n.id)).size, 2 ** k);
    s.nodes.forEach((n) => {
      assert.equal(n.id.length, n.depth);
      if (n.depth) assert.ok(s.nodes.some((p) => p.id === n.id.slice(0, -1)));
    });
  });
});

test('nibbleSteps: hex digits match for every byte', () => {
  for (let v = 0; v < 256; v++) {
    const steps = B.nibbleSteps(v);
    const last = steps[steps.length - 1];
    assert.equal(last.hi * 16 + last.lo, v);
    assert.equal('0x' + B.HEX[last.hi] + B.HEX[last.lo], B.hex(v, 2));
    assert.ok(last.caption.indexOf(B.hex(v, 2)) !== -1);
  }
});

test('addSteps: matches (a + b) mod 256 and both overflow flags, column by column', () => {
  const rng = VDSA.rng(5);
  const cases = [[0, 0], [255, 1], [200, 100], [100, 50], [127, 1], [128, 128], [-1, 1], [-128, -1], [15, 1], [5, 2]];
  for (let k = 0; k < 300; k++) cases.push([rng.int(-128, 255), rng.int(-128, 255)]);
  for (const [a, b] of cases) {
    const ua = B.wrap(a, 8), ub = B.wrap(b, 8);
    const steps = B.addSteps(a, b, 8);
    assert.equal(steps.length, 2 + 2 * 8);
    const done = steps[steps.length - 1];
    assert.equal(done.result, (ua + ub) % 256);
    assert.equal(done.unsignedOverflow, ua + ub > 255);
    const ss = B.toSigned(ua, 8) + B.toSigned(ub, 8);
    assert.equal(done.signedOverflow, ss < -128 || ss > 127, `a=${a} b=${b}`);
    assert.equal(done.signedResult, B.toSigned(ua + ub, 8));
    // partial sums: after column p is written, the low p+1 bits equal the low bits of a + b
    steps.filter((s) => s.phase === 'write').forEach((s) => {
      const p = s.col, mask = 2 ** (p + 1);
      const low = s.sum.slice(8 - 1 - p).reduce((acc, bit) => acc * 2 + bit, 0);
      assert.equal(low, (ua + ub) % mask);
      assert.equal(s.carries[p + 1], ((ua % mask) + (ub % mask)) >= mask ? 1 : 0);
      assert.deepEqual(Object.keys(s.counters), ['columns', 'carries']);
    });
    steps.forEach((s) => assert.ok(s.caption && s.line));
  }
});

test('negateSteps: flip and add one negates (except the most negative value)', () => {
  for (let v = 0; v < 16; v++) {
    const st = B.negateSteps(v, 4);
    assert.equal(st[1].value, 15 - v);
    assert.equal(st[2].value, (16 - v) % 16);
    const s = B.toSigned(v, 4), r = B.toSigned(st[2].value, 4);
    if (s === -8) assert.equal(r, -8); else assert.equal(r, -s || 0);
  }
});

test('interpret: four bytes as int, chars and a colour', () => {
  const rng = VDSA.rng(9);
  for (let k = 0; k < 200; k++) {
    const bytes = [rng.int(0, 255), rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)];
    const buf = Buffer.from(bytes);
    const r = B.interpret(bytes);
    assert.equal(r.int32, buf.readInt32LE(0));
    assert.equal(r.uint32, buf.readUInt32LE(0));
    assert.deepEqual(r.rgba, { r: bytes[0], g: bytes[1], b: bytes[2], a: bytes[3] });
  }
  assert.deepEqual(B.interpret([72, 105, 33, 33]).chars, ['H', 'i', '!', '!']);
});

/* ------------------------------------------------------------ memory lab */
/* Reference interpreter: sequential allocation from 0x100, little-endian, char = unsigned byte. */
function reference(program, seed) {
  const mem = Buffer.from(B.garbage(program.size, seed));
  const vars = {};
  const base = program.base;
  const read = (d, k) => {
    const o = d.addr - base + (k || 0) * d.elemSize;
    if (d.ptr) return mem.readUInt32LE(o);
    if (d.type === 'int') return mem.readInt32LE(o);
    if (d.type === 'short') return mem.readInt16LE(o);
    return mem.readUInt8(o);
  };
  const write = (d, k, v, size) => {
    const o = d.addr - base + (k || 0) * d.elemSize;
    const s = size || d.elemSize;
    const u = ((v % 2 ** (8 * s)) + 2 ** (8 * s)) % 2 ** (8 * s);
    if (s === 4) mem.writeUInt32LE(u, o); else if (s === 2) mem.writeUInt16LE(u, o); else mem.writeUInt8(u, o);
  };
  const owner = (addr) => Object.values(vars).find((d) => d.addr === addr);
  const ev = (e) => {
    switch (e.k) {
      case 'num': case 'char': return e.v;
      case 'paren': return ev(e.e);
      case 'neg': return -ev(e.e);
      case 'bin': { const l = ev(e.l), r = ev(e.r); return e.op === '+' ? l + r : e.op === '-' ? l - r : l * r; }
      case 'var': return read(vars[e.name]);
      case 'index': return read(vars[e.name], ev(e.index));
      case 'addr': return vars[e.name].addr;
      case 'deref': return read(owner(read(vars[e.name])));
    }
    throw new Error('bad node ' + e.k);
  };
  for (const s of program.statements) {
    if (s.kind === 'decl') {
      vars[s.name] = s;
      if (!s.init) continue;
      if (s.init.k === 'str') s.init.codes.concat([0]).forEach((c, i) => write(s, i, c));
      else if (s.init.k === 'list') for (let i = 0; i < s.count; i++) write(s, i, i < s.init.items.length ? ev(s.init.items[i]) : 0);
      else write(s, 0, ev(s.init));
    } else {
      const t = s.target, d = vars[t.name], v = ev(s.expr);
      if (t.k === 'var') write(d, 0, v);
      else if (t.k === 'index') write(d, ev(t.index), v);
      else write(owner(read(d)), 0, v);
    }
  }
  return [...mem];
}

/* Random well-formed programs: scalars, arrays with in-range indices, pointers, overflow-prone values. */
function randomProgram(rng) {
  const lines = [], scalars = [], arrays = [], ptrs = [];
  let used = 0;
  const names = 'abcdefghijk'.split('');
  const lit = () => rng.pick([() => String(rng.int(-300, 300)), () => '0x' + rng.int(0, 255).toString(16), () => "'" + String.fromCharCode(rng.int(65, 90)) + "'", () => String(rng.int(0, 70000))])();
  const valueExpr = () => {
    const atoms = [lit];
    if (scalars.length) atoms.push(() => rng.pick(scalars).name);
    if (arrays.length) atoms.push(() => { const a = rng.pick(arrays); return a.name + '[' + rng.int(0, a.count - 1) + ']'; });
    if (ptrs.length) atoms.push(() => '*' + rng.pick(ptrs).name);
    const atom = () => rng.pick(atoms)();
    const shape = rng.int(0, 3);
    if (shape === 0) return atom();
    if (shape === 1) return atom() + ' + ' + atom();
    if (shape === 2) return atom() + ' - ' + String(rng.int(0, 9));
    return '(' + atom() + ' + 1) * ' + rng.int(-3, 3);
  };
  const n = rng.int(1, 8);
  for (let k = 0; k < n; k++) {
    const kind = rng.int(0, 9);
    const free = names.filter((x) => ![...scalars, ...arrays, ...ptrs].some((d) => d.name === x));
    if ((kind <= 3 || !scalars.length) && free.length) {
      const type = rng.pick(['int', 'short', 'char']), size = { int: 4, short: 2, char: 1 }[type];
      if (used + size > 32) continue;
      const name = free[0];
      lines.push(rng.int(0, 5) ? `${type} ${name} = ${valueExpr()};` : `${type} ${name};`);
      scalars.push({ name, type }); used += size;
    } else if (kind === 4 && free.length) {
      const type = rng.pick(['int', 'char', 'short']), size = { int: 4, short: 2, char: 1 }[type], count = rng.int(1, 4);
      if (used + size * count > 32) continue;
      const name = free[0];
      const items = []; for (let i = 0, m = rng.int(0, count); i < m; i++) items.push(valueExpr());
      lines.push(`${type} ${name}[${count}] = {${items.join(', ')}};`);
      arrays.push({ name, count, type }); used += size * count;
    } else if (kind === 5 && free.length && scalars.length && used + 4 <= 32) {
      const target = rng.pick(scalars), name = free[0];
      lines.push(`${target.type}* ${name} = &${target.name};`);
      ptrs.push({ name, type: target.type }); used += 4;
    } else if (kind === 6 && ptrs.length) {
      lines.push(`*${rng.pick(ptrs).name} = ${valueExpr()};`);
    } else if (kind === 7 && arrays.length) {
      const a = rng.pick(arrays);
      lines.push(`${a.name}[${rng.int(0, a.count - 1)}] = ${valueExpr()};`);
    } else if (scalars.length) {
      lines.push(`${rng.pick(scalars).name} = ${valueExpr()};`);
    }
  }
  return lines.join('\n');
}

test('memory lab: the spec program lays out bytes as C would', () => {
  const { program, error } = B.parseProgram("int a = 5;\nint b = a;\nb = b + 1;\nchar c = 'A';");
  assert.equal(error, null);
  const steps = B.runProgram(program);
  const last = steps[steps.length - 1];
  assert.equal(last.kind, 'done');
  assert.deepEqual(last.bytes.slice(0, 9), [5, 0, 0, 0, 6, 0, 0, 0, 0x41]);
  assert.deepEqual(steps.map((s) => s.kind), ['start', 'alloc', 'write', 'alloc', 'read', 'write', 'read', 'write', 'alloc', 'write', 'done']);
  assert.deepEqual(last.brackets.map((b) => [b.name, b.from, b.to]), [['a', 0, 3], ['b', 4, 7], ['c', 8, 8]]);
  assert.deepEqual(last.counters, { used: 9, read: 8, written: 13 });
  // unallocated bytes are muted, allocated ones are not
  assert.equal(last.states[9], 'muted');
  assert.equal(last.states[0], 'default');
  const code = B.translate(program);
  ['pseudo', 'cpp', 'js', 'py'].forEach((lang) => {
    for (let i = 0; i < 4; i++) assert.ok(code[lang].indexOf('@s' + i) !== -1, lang + ' labels s' + i);
  });
  assert.ok(code.js.indexOf('write32(0x104, read32(0x104) + 1)') !== -1);
  assert.ok(code.py.indexOf("write8(0x108, ord('A'))") !== -1);
});

test('memory lab: random programs match the reference interpreter', () => {
  const rng = VDSA.rng(42);
  let checked = 0;
  for (let k = 0; k < 400; k++) {
    const src = randomProgram(rng);
    if (!src) continue;
    const { program, error } = B.parseProgram(src);
    assert.equal(error, null, src + '\n' + error);
    const steps = B.runProgram(program);
    const last = steps[steps.length - 1];
    assert.notEqual(last.kind, 'error', src + '\n' + last.caption);
    assert.deepEqual(last.bytes, reference(program, 7), src);
    // every step is a complete, readable snapshot
    steps.forEach((s) => {
      assert.equal(s.bytes.length, 32);
      assert.equal(s.states.length, 32);
      assert.ok(s.caption.length > 10);
      assert.deepEqual(Object.keys(s.counters), ['used', 'read', 'written']);
      if (s.line) assert.match(s.line, /^s\d+$/);
    });
    // line labels exist in every language
    const code = B.translate(program);
    new Set(steps.map((s) => s.line).filter(Boolean)).forEach((lab) => {
      ['pseudo', 'cpp', 'js', 'py'].forEach((lang) => assert.ok(code[lang].indexOf('@' + lab) !== -1, lang + ' ' + lab + '\n' + src));
    });
    checked++;
  }
  assert.ok(checked > 350);
});

test('memory lab: overflow, negatives, strings, pointers', () => {
  const run = (src) => { const r = B.parseProgram(src); assert.equal(r.error, null, r.error); return B.runProgram(r.program); };
  let st = run('char k = 250; k = k + 10;');
  assert.equal(st[st.length - 1].bytes[0], 4);
  assert.ok(st.some((s) => /overflow/.test(s.caption)));
  st = run('char k = 255; k = k + 1;');
  assert.equal(st[st.length - 1].bytes[0], 0);
  st = run('int n = -1; short s = -32768; short t = 32767; t = t + 1;');
  assert.deepEqual(st[st.length - 1].bytes.slice(0, 8), [255, 255, 255, 255, 0x00, 0x80, 0x00, 0x80]);
  st = run('char s[4] = "hi!";');
  assert.deepEqual(st[st.length - 1].bytes.slice(0, 4), [0x68, 0x69, 0x21, 0]);
  st = run('int a = 7; int* p = &a; *p = *p + 1; int b = 1; p = &b; *p = 5;');
  const last = st[st.length - 1];
  assert.equal(B.fromBytesLE(last.bytes.slice(0, 4), true), 8);
  assert.equal(B.fromBytesLE(last.bytes.slice(8, 12), true), 5);
  assert.deepEqual(last.pointers.map((p) => [p.from, p.to]), [[4, 8]]);
  st = run('int big = 1000000;');
  assert.deepEqual(st[st.length - 1].bytes.slice(0, 4), [0x40, 0x42, 0x0F, 0x00]);
  st = run('int arr[4] = {1, 2}; arr[3] = 9;');
  assert.deepEqual(st[st.length - 1].bytes.slice(0, 16), [1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0]);
  assert.ok(st.some((s) => s.kind === 'addr' && /0x100 \+ 3 × 4 = <b>0x10C/.test(s.caption)));
});

test('memory lab: uninitialised reads are flagged, out-of-range and wild pointers stop the trace', () => {
  let r = B.parseProgram('int x; int y = x + 1;');
  let st = B.runProgram(r.program);
  assert.ok(st.some((s) => /never written/.test(s.caption)));
  assert.equal(st[st.length - 1].watch[0].garbage, true);
  r = B.parseProgram('int arr[2] = {1, 2}; int i = 2; arr[i] = 5;');
  st = B.runProgram(r.program);
  const last = st[st.length - 1];
  assert.equal(last.kind, 'error');
  assert.equal(last.error, true);
  assert.equal(last.states[8], 'error');                        // arr[2] would land on i
  assert.deepEqual(last.bytes.slice(8, 12), [2, 0, 0, 0]);       // and nothing was written
  r = B.parseProgram('int arr[2]; int x = arr[-1];');
  st = B.runProgram(r.program);
  assert.equal(st[st.length - 1].kind, 'error');
  r = B.parseProgram('int* p; *p = 3;');
  st = B.runProgram(r.program);
  assert.equal(st[st.length - 1].kind, 'error');
  assert.match(st[st.length - 1].caption, /never set/);
});

test('memory lab: friendly parse errors', () => {
  const err = (src) => B.parseProgram(src).error;
  assert.match(err(''), /at least one statement/);
  assert.match(err('   \n // just a comment'), /at least one statement/);
  assert.match(err('a = 5;'), /not been declared/);
  assert.match(err('int a = 5; int a = 6;'), /already declared/);
  assert.match(err('int arr[9];'), /between 1 and 8/);
  assert.match(err('int a[4]; int b[4]; int c;'), /Out of memory/);
  assert.match(err("char c = 'AB';"), /exactly one character/);
  assert.match(err('int a = 1; int* p = a;'), /pointer/);
  assert.match(err('int a = 1; short* p = &a;'), /must point at a short/);
  assert.match(err('int a = 99999999999;'), /32 bits/);
  assert.match(err('char s[3] = "hello";'), /needs 6 bytes/);
  assert.match(err('int a = 1 +;'), /ends too early/);
  assert.match(err('int a = 3; a[0] = 1;'), /not an array/);
  assert.match(err('int b = b;'), /own starting value/);
  assert.match(err('int a = 5 int b = 2'), /forget a ;/);
  assert.match(err('int x = 12ab;'), /not a number/);
  assert.match(err('int arr[2]; int y = arr;'), /Pick one element/);
  assert.match(err('int a; int b; int c; int d; int e; int f; int g; int h; char i; char j; char k;'), /at most 10/);
  assert.match(err('float f = 1;'), /not been declared|type/);
});
