/* Lesson 02 · Bits, bytes & memory — pure step generators (no DOM).

   Browser: VDSA.algos.bits.<fn>     Node: require('js/algos/02-bits-and-memory.js').<fn>

   Number helpers   wrap, toSigned, bitsOf, fromBits, hex, hexByte, bin, charName, charLiteral, bytesLE, fromBytesLE
   Figures          increment, counterSteps, patternSteps, nibbleSteps, addSteps, negateSteps, interpret
   Memory lab       parseProgram(text), runProgram(program), translate(program)

   Conventions
   - Bit arrays are MSB first (display order): bitsOf(5, 4) -> [0, 1, 0, 1]. Bit positions count from the
     least significant bit: position 0 is worth 1, position 7 is worth 128.
   - Every step is a complete snapshot with a `caption` that says why; generators never mutate a pushed step.
   - Byte arrays are in address order (index 0 = lowest address). Multi-byte values are little-endian. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.VDSA = root.VDSA || {}; root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos.bits = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var B = {};

  /* ================================================================== number helpers */
  function pow2(w) { return Math.pow(2, w); }
  B.pow2 = pow2;
  /* Unsigned value of v kept to w bits (what a w-bit register would hold). Exact for |v| < 2^53. */
  B.wrap = function (v, w) { var m = pow2(w), r = Math.round(v) % m; return r < 0 ? r + m : r + 0; };
  /* Two's complement reading of the w-bit pattern of v. */
  B.toSigned = function (v, w) { var u = B.wrap(v, w); return u >= pow2(w - 1) ? u - pow2(w) : u; };
  B.bitsOf = function (v, w) {
    var u = B.wrap(v, w), out = [];
    for (var i = w - 1; i >= 0; i--) out.push(Math.floor(u / pow2(i)) % 2);
    return out;
  };
  B.fromBits = function (bits) { return bits.reduce(function (acc, b) { return acc * 2 + (b ? 1 : 0); }, 0); };
  B.bit = function (v, pos) { return Math.floor(Math.abs(Math.round(v)) / pow2(pos)) % 2; };   // v >= 0
  B.hex = function (v, digits) {
    var s = Math.max(0, Math.round(v)).toString(16).toUpperCase();
    while (s.length < (digits || 1)) s = '0' + s;
    return '0x' + s;
  };
  B.hexByte = function (v) { return B.hex(B.wrap(v, 8), 2).slice(2); };
  /* '0010 1010' — grouped in fours from the right. */
  B.bin = function (v, w, group) {
    var s = B.bitsOf(v, w).join(''), g = group === undefined ? 4 : group;
    if (!g) return s;
    var out = '';
    for (var i = 0; i < s.length; i++) { if (i && (s.length - i) % g === 0) out += ' '; out += s[i]; }
    return out;
  };
  var CONTROL = { 0: 'NUL', 7: 'BEL (beep)', 8: 'BS (backspace)', 9: 'TAB', 10: 'LF (new line)', 13: 'CR (return)', 27: 'ESC', 127: 'DEL' };
  /* How ASCII reads a byte: 'A', 'space', 'LF (new line)', 'control', or null outside ASCII (128–255). */
  B.charName = function (code) {
    code = B.wrap(code, 8);
    if (code >= 33 && code <= 126) return String.fromCharCode(code);
    if (code === 32) return 'space';
    if (CONTROL[code]) return CONTROL[code];
    if (code < 32) return 'control';
    return null;
  };
  /* A C character literal for a byte, or null when it has no printable form. */
  B.charLiteral = function (code) {
    code = B.wrap(code, 8);
    if (code === 39) return "'\\''";
    if (code === 92) return "'\\\\'";
    if (code >= 32 && code <= 126) return "'" + String.fromCharCode(code) + "'";
    if (code === 0) return "'\\0'";
    if (code === 10) return "'\\n'";
    if (code === 9) return "'\\t'";
    return null;
  };
  /* Little-endian bytes of v in `size` bytes (lowest address first). */
  B.bytesLE = function (v, size) {
    var u = B.wrap(v, size * 8), out = [];
    for (var i = 0; i < size; i++) { out.push(u % 256); u = Math.floor(u / 256); }
    return out;
  };
  B.fromBytesLE = function (bytes, signed) {
    var u = 0;
    for (var i = bytes.length - 1; i >= 0; i--) u = u * 256 + bytes[i];
    return signed ? B.toSigned(u, bytes.length * 8) : u;
  };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  B.esc = esc;
  function aType(t) { return (/^[aeiou]/.test(t) ? 'an ' : 'a ') + t; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function fmtNum(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  B.fmtNum = fmtNum;

  /* Deterministic PRNG (mulberry32), so garbage bytes are the same on every visit. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  B.garbage = function (n, seed) {
    var r = rng(seed === undefined ? 7 : seed), out = [];
    for (var i = 0; i < n; i++) out.push(Math.floor(r() * 256));
    return out;
  };

  /* ================================================================== counting */
  /* +1 on a w-bit counter: flips = bit positions that change, from bit 0 upward (the carry ripple). */
  B.increment = function (v, w) {
    var u = B.wrap(v, w), flips = [], i = 0;
    while (i < w && B.bit(u, i) === 1) { flips.push(i); i++; }
    var carryOut = i === w;
    if (!carryOut) flips.push(i);
    return { from: u, to: B.wrap(u + 1, w), flips: flips, carryOut: carryOut };
  };

  /* Odometer: counting from `start`, `count` times, on a w-bit counter.
     Step k shows the value after k increments and which bits the k-th increment flipped. */
  B.counterSteps = function (w, start, count) {
    w = w || 8;
    var v = B.wrap(start || 0, w), total = 0, steps = [];
    steps.push({ value: v, bits: B.bitsOf(v, w), flips: [], carryOut: false, incs: 0, total: 0,
      caption: 'The counter shows <b>' + v + '</b>. Press play: each step adds 1, and you can watch which switches have to move.',
      counters: { value: v, flips: 0, total: 0, avg: '—' } });
    for (var k = 1; k <= count; k++) {
      var inc = B.increment(v, w), n = inc.flips.length, caption;
      total += n;
      if (inc.carryOut) caption = 'All ' + w + ' bits were 1. Each one rolls over to 0 and passes a carry left, and the last carry falls off the end: <b>' + inc.from + ' + 1 wraps to 0</b>. That is overflow.';
      else if (n === 1) caption = 'Bit 0 was 0, so +1 only switches it on: <b>' + inc.from + ' → ' + inc.to + '</b>, one flip.';
      else caption = '+1 meets ' + plural(n - 1, 'one') + ' in a row. Each rolls over to 0 and carries left, until the carry lands on a 0: <b>' + plural(n, 'bit') + ' flip</b>, ' + inc.from + ' → ' + inc.to + '.';
      v = inc.to;
      steps.push({ value: v, bits: B.bitsOf(v, w), flips: inc.flips, carryOut: inc.carryOut, incs: k, total: total, caption: caption,
        counters: { value: v, flips: n, total: total, avg: (total / k).toFixed(2) } });
    }
    return steps;
  };

  /* Flips needed by each of the first n increments starting at 0 (the "ruler" sequence 1, 2, 1, 3, 1, 2, 1, 4 …). */
  B.flipCounts = function (n, w) {
    w = w || 16;
    var out = [], v = 0;
    for (var k = 1; k <= n; k++) { var inc = B.increment(v, w); out.push(inc.flips.length); v = inc.to; }
    return out;
  };

  /* Decode tree of every pattern of up to maxBits bits. Step k holds all prefixes of length <= k. */
  B.patternSteps = function (maxBits) {
    var steps = [];
    for (var k = 0; k <= maxBits; k++) {
      var nodes = [];
      for (var d = 0; d <= k; d++) {
        for (var i = 0; i < pow2(d); i++) {
          var id = d ? B.bitsOf(i, d).join('') : '';
          nodes.push({ id: id, depth: d, fresh: d === k && k > 0 });
        }
      }
      var count = pow2(k), caption;
      if (k === 0) caption = 'Before any bit is chosen there is exactly <b>one</b> possibility: nothing yet.';
      else if (k === 1) caption = 'One bit is one choice: <b>0 or 1</b>. That makes <b>2</b> patterns.';
      else caption = 'Bit ' + k + ' splits each of the ' + pow2(k - 1) + ' patterns into two, one ending in 0 and one in 1: <b>' + pow2(k - 1) + ' × 2 = ' + count + ' = 2<sup>' + k + '</sup></b> patterns.';
      steps.push({ bits: k, count: count, nodes: nodes, caption: caption });
    }
    return steps;
  };

  /* Byte -> two hex digits, one nibble at a time. */
  var HEX = '0123456789ABCDEF';
  B.nibbleSteps = function (byte) {
    var v = B.wrap(byte, 8), bits = B.bitsOf(v, 8), hi = Math.floor(v / 16), lo = v % 16;
    function sumText(n) {
      var parts = [];
      [8, 4, 2, 1].forEach(function (p) { if (n & p) parts.push(p); });
      return parts.length ? parts.join(' + ') + (parts.length > 1 ? ' = ' + n : '') : '0';
    }
    var base = { value: v, bits: bits, hi: hi, lo: lo };
    function step(phase, caption) { return Object.assign({ phase: phase, caption: caption }, base); }
    return [
      step('byte', 'One byte: eight bits, <b>' + B.bin(v, 8, 0) + '</b>. Reading eight bits at a glance is hard, so programmers write bytes in base 16.'),
      step('split', 'Split the byte into two halves of four bits, called <b>nibbles</b>. Four bits make 2<sup>4</sup> = 16 patterns, exactly one hex digit.'),
      step('places', 'Inside each nibble the places are worth <b>8, 4, 2, 1</b>. The left nibble counts sixteens and the right nibble counts ones.'),
      step('hi', 'Left nibble <b>' + B.bin(hi, 4, 0) + '</b>: ' + sumText(hi) + '. Hex digit <b>' + HEX[hi] + '</b>' + (hi > 9 ? ' (digits past 9 are the letters A–F)' : '') + '.'),
      step('lo', 'Right nibble <b>' + B.bin(lo, 4, 0) + '</b>: ' + sumText(lo) + '. Hex digit <b>' + HEX[lo] + '</b>' + (lo > 9 ? ' (A = 10 … F = 15)' : '') + '.'),
      step('join', 'Together: <b>0x' + HEX[hi] + HEX[lo] + '</b> = ' + hi + ' × 16 + ' + lo + ' = <b>' + v + '</b>. Every byte is exactly two hex digits, from 0x00 to 0xFF.')
    ];
  };
  B.HEX = HEX;

  /* ================================================================== binary addition */
  /* Column-by-column addition of two w-bit patterns (a and b may be given signed or unsigned).
     Two steps per column: 'sum' (add the column) and 'write' (write the bit, pass the carry).
     carries[p] = carry INTO column p (carries[w] is the carry out of the top bit). */
  B.addSteps = function (a, b, w) {
    w = w || 8;
    var ua = B.wrap(a, w), ub = B.wrap(b, w), ab = B.bitsOf(ua, w), bb = B.bitsOf(ub, w);
    var carries = [], sum = [], steps = [], i;
    for (i = 0; i <= w; i++) carries.push(null);
    for (i = 0; i < w; i++) sum.push(null);
    carries[0] = 0;
    var nCarries = 0;
    function bitAt(arr, p) { return arr[w - 1 - p]; }
    function snap(extra) {
      var s = Object.assign({ w: w, a: ua, b: ub, aBits: ab, bBits: bb, carries: carries.slice(), sum: sum.slice() }, extra);
      s.counters = { columns: extra.columns, carries: nCarries };
      steps.push(s);
    }
    snap({ phase: 'setup', col: -1, columns: 0, line: 'init', vars: { a: B.bin(ua, w), b: B.bin(ub, w), carry: 0 },
      caption: 'Line the two bytes up by place value, like column addition in decimal. Work right to left, starting with the ones column; the first carry is 0.' });
    var c = 0, carryIntoTop = 0;
    for (var p = 0; p < w; p++) {
      var x = bitAt(ab, p), y = bitAt(bb, p), s = x + y + c;
      var place = pow2(p);
      snap({ phase: 'sum', col: p, colSum: s, columns: p, line: 'sum',
        vars: { i: p, 'a[i]': x, 'b[i]': y, carry: c, s: s },
        caption: 'Column ' + p + ' (worth ' + place + '): ' + x + ' + ' + y + ' + carry ' + c + ' = <b>' + s + '</b>' + (s >= 2 ? ', which is <b>' + (s === 2 ? '10' : '11') + '</b> in binary: too big for one bit.' : ', which fits in one bit.') });
      if (p === w - 1) carryIntoTop = c;
      sum[w - 1 - p] = s % 2;
      c = s >= 2 ? 1 : 0;
      carries[p + 1] = c;
      if (c) nCarries++;
      snap({ phase: 'write', col: p, colSum: s, columns: p + 1, line: ['write', 'carry'],
        vars: { i: p, 'a[i]': x, 'b[i]': y, carry: c, s: s },
        caption: 'Write <b>' + (s % 2) + '</b> under column ' + p + (c ? ' and carry <b>1</b> into column ' + (p + 1) + (p + 1 === w ? ', which a ' + w + '-bit byte does not have' : '') + '.' : '. Nothing to carry.') });
    }
    var u = B.fromBits(sum), sa = B.toSigned(ua, w), sb = B.toSigned(ub, w), ss = B.toSigned(u, w);
    var unsignedOverflow = c === 1, signedOverflow = carryIntoTop !== c;
    var cap;
    if (unsignedOverflow) cap = 'The carry out of the top bit has nowhere to go, so it is dropped. Unsigned: ' + ua + ' + ' + ub + ' should be ' + (ua + ub) + ', but the byte keeps ' + (ua + ub) + ' − ' + pow2(w) + ' = <b>' + u + '</b>: <b>unsigned overflow</b>.';
    else cap = 'No carry leaves the top bit, so the unsigned answer fits: ' + ua + ' + ' + ub + ' = <b>' + u + '</b>.';
    if (signedOverflow) cap += ' Read as signed, ' + fmtNum(sa) + ' + ' + fmtNum(sb) + ' gives <b>' + fmtNum(ss) + '</b>: two numbers with the same sign produced the other sign, so this is <b>signed overflow</b> too' + (unsignedOverflow ? '' : ', even though no carry was lost') + '.';
    else if (unsignedOverflow) cap += ' Read as signed, ' + fmtNum(sa) + ' + ' + fmtNum(sb) + ' = <b>' + fmtNum(ss) + '</b> is correct: for signed numbers this dropped carry is harmless.';
    else if (sa < 0 || sb < 0) cap += ' Read as signed it is ' + fmtNum(sa) + ' + ' + fmtNum(sb) + ' = ' + fmtNum(ss) + ', also correct.';
    snap({ phase: 'done', col: w, columns: w, line: 'done', vars: { sum: B.bin(u, w), carry: c, overflow: unsignedOverflow },
      result: u, signedResult: ss, unsignedOverflow: unsignedOverflow, signedOverflow: signedOverflow, carryIntoTop: carryIntoTop, caption: cap });
    return steps;
  };

  /* Two's complement negation on the 4-bit wheel: flip every bit, then add 1. */
  B.negateSteps = function (v, w) {
    w = w || 4;
    var u = B.wrap(v, w), flipped = pow2(w) - 1 - u, result = B.wrap(flipped + 1, w);
    var s = B.toSigned(u, w), r = B.toSigned(result, w);
    var steps = [
      { phase: 'start', value: u, caption: 'Start at <b>' + B.bin(u, w, 0) + '</b> = ' + fmtNum(s) + '.' },
      { phase: 'flip', value: flipped, caption: 'Flip every bit: <b>' + B.bin(flipped, w, 0) + '</b>. On the wheel that is the mirror image, ' + fmtNum(B.toSigned(flipped, w)) + ' = −' + (s) + ' − 1.' },
      { phase: 'add', value: result, caption: 'Add 1: <b>' + B.bin(result, w, 0) + '</b> = ' + fmtNum(r) + '. ' + (s === -pow2(w - 1) ? 'The most negative number is its own negative: +' + pow2(w - 1) + ' does not fit in ' + w + ' bits.' : 'That is −(' + fmtNum(s) + '), so flip-and-add-one negates.') }
    ];
    return steps;
  };

  /* Four bytes read three ways. bytes[0] is the lowest address. */
  B.interpret = function (bytes) {
    var b = bytes.map(function (x) { return B.wrap(x, 8); });
    return {
      uint32: B.fromBytesLE(b, false),
      int32: B.fromBytesLE(b, true),
      hex: B.hex(B.fromBytesLE(b, false), 8),
      chars: b.map(B.charName),
      rgba: { r: b[0], g: b[1], b: b[2], a: b[3] }
    };
  };

  /* ================================================================== memory lab: a tiny C-like language
     Statements (separated by ';' or new lines, // comments allowed):
       int a = 5;   short s = -2;   char c = 'A';          scalars (4, 2, 1 bytes; char is 0–255 here)
       int arr[4] = {1, 2, 3};   char s[4] = "hi!";         arrays (missing elements are filled with 0, like C)
       int* p = &a;   *p = *p + 1;   p = &b;                pointers (4-byte addresses)
       a = b + 2 * c;   arr[i] = 7;                         assignment; expressions use + - * ( ) and unary -
  */
  var TYPES = { int: 4, short: 2, char: 1 };
  B.MEM = { base: 0x100, size: 32, maxStatements: 10, maxArray: 8 };

  function LabError(msg) { this.message = msg; }

  function tokenize(src) {
    var toks = [], i = 0, n = src.length, lineNo = 1;
    function push(t, v, text) { toks.push({ t: t, v: v, text: text, line: lineNo, start: i, end: i + text.length }); }
    while (i < n) {
      var c = src[i];
      if (c === '\n') { push('sep', '\n', '\n'); lineNo++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === ';') { push('sep', ';', ';'); i++; continue; }
      if (/[0-9]/.test(c)) {
        var m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)/.exec(src.slice(i));
        var txt = m[1];
        if (/[A-Za-z_]/.test(src[i + txt.length] || '')) throw new LabError('“' + src.slice(i).split(/[\s;,)\]]/)[0] + '” is not a number I can read. Use decimal (42), hex (0x2A) or binary (0b101010).');
        var val = /^0[xX]/.test(txt) ? parseInt(txt.slice(2), 16) : /^0[bB]/.test(txt) ? parseInt(txt.slice(2), 2) : parseInt(txt, 10);
        push('num', val, txt); i += txt.length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0];
        push('id', id, id); i += id.length; continue;
      }
      if (c === "'") {
        var j = i + 1, code;
        if (src[j] === '\\') {
          var e = src[j + 1], map = { n: 10, t: 9, '0': 0, '\\': 92, "'": 39, '"': 34 };
          if (!(e in map)) throw new LabError('Unknown escape “\\' + (e || '') + '”. Use \\n, \\t, \\0, \\\\ or \\\'.');
          code = map[e]; j += 2;
        } else {
          code = src.charCodeAt(j);
          if (isNaN(code) || src[j] === "'" || src[j] === '\n') throw new LabError('An empty character literal: put one character between the quotes, like \'A\'.');
          if (code < 32 || code > 126) throw new LabError('Use plain ASCII characters (letters, digits, punctuation) inside \' \'.');
          j += 1;
        }
        if (src[j] !== "'") throw new LabError('A character literal holds exactly one character, like \'A\'. For text, use a char array: char s[4] = "hi!";');
        push('char', code, src.slice(i, j + 1)); i = j + 1; continue;
      }
      if (c === '"') {
        var k = i + 1, codes = [];
        while (k < n && src[k] !== '"' && src[k] !== '\n') {
          var cc = src.charCodeAt(k);
          if (src[k] === '\\') {
            var e2 = src[k + 1], map2 = { n: 10, t: 9, '0': 0, '\\': 92, "'": 39, '"': 34 };
            if (!(e2 in map2)) throw new LabError('Unknown escape “\\' + (e2 || '') + '” in a string.');
            codes.push(map2[e2]); k += 2; continue;
          }
          if (cc < 32 || cc > 126) throw new LabError('Use plain ASCII characters inside " ".');
          codes.push(cc); k++;
        }
        if (src[k] !== '"') throw new LabError('A string is missing its closing ".');
        push('str', codes, src.slice(i, k + 1)); i = k + 1; continue;
      }
      if ('=+-*&[]{}(),'.indexOf(c) !== -1) { push('op', c, c); i++; continue; }
      throw new LabError('I do not understand “' + c + '”. The lab knows int, short, char, arrays, pointers, = + − * & and brackets.');
    }
    return toks;
  }

  /* Parse one statement's tokens. syms: name -> declaration (for types and validation). */
  function parseStatement(toks, syms) {
    var pos = 0;
    function peek(o) { return toks[pos + (o || 0)]; }
    function isOp(t, v) { return t && t.t === 'op' && t.v === v; }
    function expectOp(v, what) {
      if (!isOp(peek(), v)) throw new LabError('Expected “' + v + '”' + (what ? ' ' + what : '') + (peek() ? ' but found “' + peek().text + '”' : ' at the end of the statement') + '.');
      pos++;
    }
    function ident(what) {
      var t = peek();
      if (!t || t.t !== 'id') throw new LabError('Expected ' + (what || 'a name') + (t ? ' but found “' + t.text + '”' : '') + '.');
      if (TYPES[t.v]) throw new LabError('“' + t.v + '” is a type, so it cannot be a variable name.');
      pos++;
      return t.v;
    }
    function lookup(name) {
      var s = syms[name];
      if (!s && name === declaring) throw new LabError(name + ' cannot appear in its own starting value: it holds only leftover bits at that moment.');
      if (!s) throw new LabError('“' + name + '” has not been declared yet. Declare it first, e.g. int ' + name + ' = 0;');
      return s;
    }
    /* expressions */
    function expr() {
      var l = term();
      while (isOp(peek(), '+') || isOp(peek(), '-')) { var op = peek().v; pos++; l = { k: 'bin', op: op, l: l, r: term() }; }
      return l;
    }
    function term() {
      var l = factor();
      while (isOp(peek(), '*')) { pos++; l = { k: 'bin', op: '*', l: l, r: factor() }; }
      return l;
    }
    function factor() {
      var t = peek();
      if (!t) throw new LabError('The statement ends too early: a value is missing.');
      if (t.t === 'num') { pos++; return { k: 'num', v: t.v, text: t.text }; }
      if (t.t === 'char') { pos++; return { k: 'char', v: t.v, text: t.text }; }
      if (t.t === 'str') throw new LabError('A string can only initialise a char array, e.g. char s[4] = "hi!";');
      if (isOp(t, '-')) { pos++; return { k: 'neg', e: factor() }; }
      if (isOp(t, '(')) { pos++; var e = expr(); expectOp(')', 'to close the bracket'); return { k: 'paren', e: e }; }
      if (isOp(t, '&')) {
        pos++;
        var an = ident('a variable name after &');
        var as = lookup(an);
        if (isOp(peek(), '[')) throw new LabError('This lab takes the address of whole variables only, like &' + an + '.');
        if (as.count) throw new LabError('&' + an + ' would be the address of the whole array. This lab keeps pointers to single variables.');
        if (as.ptr) throw new LabError('A pointer to a pointer is beyond this lab. Point at an int, short or char.');
        return { k: 'addr', name: an };
      }
      if (isOp(t, '*')) {
        pos++;
        var dn = ident('a pointer name after *');
        var ds = lookup(dn);
        if (!ds.ptr) throw new LabError('*' + dn + ' needs ' + dn + ' to be a pointer, but it is ' + aType(ds.type) + '.');
        return { k: 'deref', name: dn };
      }
      if (t.t === 'id') {
        var name = ident();
        var s = lookup(name);
        if (isOp(peek(), '[')) {
          if (!s.count) throw new LabError(name + ' is not an array, so ' + name + '[…] has no meaning.');
          pos++; var idx = expr(); expectOp(']', 'to close the index');
          return { k: 'index', name: name, index: idx };
        }
        if (s.count) throw new LabError(name + ' is an array. Pick one element, like ' + name + '[0].');
        return { k: 'var', name: name };
      }
      throw new LabError('Unexpected “' + t.text + '”.');
    }
    function checkValue(e, targetPtr, targetType, targetName) {
      // pointers only take &x or another pointer of the same base type; ints never take pointers
      var usesPtr = false;
      (function walk(n) {
        if (!n) return;
        if (n.k === 'addr') usesPtr = true;
        if (n.k === 'var' && syms[n.name].ptr) usesPtr = true;
        if (n.k === 'bin') { walk(n.l); walk(n.r); }
        if (n.k === 'neg' || n.k === 'paren') walk(n.e);
        if (n.k === 'index') walk(n.index);
      }(e));
      var inner = e.k === 'paren' ? e.e : e;
      if (targetPtr) {
        if (inner.k === 'addr') {
          var t = syms[inner.name];
          if (t.type !== targetType) throw new LabError(targetName + ' is ' + aType(targetType + '*') + ', so it must point at ' + aType(targetType) + '. ' + inner.name + ' is ' + aType(t.type) + '.');
          return;
        }
        if (inner.k === 'var' && syms[inner.name].ptr) {
          if (syms[inner.name].type !== targetType) throw new LabError(inner.name + ' points at ' + aType(syms[inner.name].type) + ', but ' + targetName + ' points at ' + aType(targetType) + '.');
          return;
        }
        throw new LabError(targetName + ' is a pointer: give it an address, like &' + firstScalar(targetType) + '.');
      }
      if (usesPtr) throw new LabError('Addresses and pointers only go into pointer variables here. Pointer arithmetic is a story for a later lesson.');
    }
    function firstScalar(type) {
      var names = Object.keys(syms).filter(function (k) { return !syms[k].ptr && !syms[k].count && syms[k].type === type; });
      return names[0] || 'x';
    }

    var t0 = peek(), declaring = null;
    if (!t0) return null;
    var stmt;
    if (t0.t === 'id' && TYPES[t0.v]) {
      pos++;
      var type = t0.v, ptr = false;
      if (t0.v === 'unsigned' || t0.v === 'long') throw new LabError('This lab knows int, short and char.');
      if (isOp(peek(), '*')) { ptr = true; pos++; }
      var name = ident('a variable name');
      if (syms[name]) throw new LabError('“' + name + '” is already declared. Each name can own only one location.');
      var count = null;
      if (isOp(peek(), '[')) {
        if (ptr) throw new LabError('Arrays of pointers are beyond this lab.');
        pos++;
        var ct = peek();
        if (!ct || ct.t !== 'num') throw new LabError('An array size must be a number, like ' + name + '[4].');
        pos++;
        count = ct.v;
        if (count < 1 || count > B.MEM.maxArray) throw new LabError('Keep array sizes between 1 and ' + B.MEM.maxArray + ' so everything fits on screen.');
        expectOp(']', 'after the array size');
      }
      var decl = { kind: 'decl', type: type, ptr: ptr, name: name, count: count, init: null };
      declaring = name;
      syms[name] = decl; // visible to its own initialiser checks below (reads of itself are rejected)
      if (isOp(peek(), '=')) {
        pos++;
        if (count) {
          if (peek() && peek().t === 'str') {
            if (type !== 'char') { delete syms[name]; throw new LabError('A string can only fill a char array.'); }
            var codes = peek().v; pos++;
            if (codes.length + 1 > count) { delete syms[name]; throw new LabError('"' + String.fromCharCode.apply(null, codes) + '" needs ' + (codes.length + 1) + ' bytes including the final \\0, but ' + name + ' has ' + count + '.'); }
            decl.init = { k: 'str', codes: codes, text: toks[pos - 1].text };
          } else {
            expectOp('{', 'to start the list of elements');
            var list = [];
            delete syms[name];
            if (!isOp(peek(), '}')) {
              list.push(expr());
              while (isOp(peek(), ',')) { pos++; list.push(expr()); }
            }
            syms[name] = decl;
            expectOp('}', 'to close the list');
            if (list.length > count) { delete syms[name]; throw new LabError(name + ' has ' + count + ' elements but the list has ' + list.length + '.'); }
            list.forEach(function (e) { checkValue(e, false, type, name); });
            decl.init = { k: 'list', items: list };
          }
        } else {
          delete syms[name];
          try {
            decl.init = expr();
            checkValue(decl.init, ptr, type, name);
          } catch (err) { throw err; }
          syms[name] = decl;
        }
      }
      stmt = decl;
    } else {
      var target;
      if (isOp(t0, '*')) {
        pos++;
        var pn = ident('a pointer name after *');
        var ps = lookup(pn);
        if (!ps.ptr) throw new LabError('*' + pn + ' needs ' + pn + ' to be a pointer, but it is ' + aType(ps.type) + '.');
        target = { k: 'deref', name: pn };
      } else {
        if (t0.t !== 'id') throw new LabError('A statement starts with a type (int, short, char) or a name to assign to, not “' + t0.text + '”.');
        var tn = ident();
        var ts = lookup(tn);
        if (isOp(peek(), '[')) {
          if (!ts.count) throw new LabError(tn + ' is not an array, so ' + tn + '[…] has no meaning.');
          pos++; var ix = expr(); expectOp(']', 'to close the index');
          target = { k: 'index', name: tn, index: ix };
        } else {
          if (ts.count) throw new LabError(tn + ' is an array: assign one element at a time, like ' + tn + '[0] = 1;');
          target = { k: 'var', name: tn };
        }
      }
      expectOp('=', 'in an assignment');
      var rhs = expr();
      var tdecl = syms[target.name];
      var tPtr = target.k === 'var' && tdecl.ptr;
      checkValue(rhs, tPtr, tdecl.type, target.k === 'deref' ? '*' + target.name : target.name);
      stmt = { kind: 'assign', target: target, expr: rhs };
    }
    if (pos < toks.length) throw new LabError('Unexpected “' + toks[pos].text + '” — did you forget a ; between statements?');
    return stmt;
  }

  function sizeOf(d) { return d.ptr ? 4 : TYPES[d.type] * (d.count || 1); }
  function elemSize(d) { return d.ptr ? 4 : TYPES[d.type]; }
  function typeLabel(d) { return d.type + (d.ptr ? '*' : '') + (d.count ? '[' + d.count + ']' : ''); }
  B.typeLabel = typeLabel;

  /* Normalised source text of expressions and statements (used for C and pseudocode). */
  function exprText(e) {
    switch (e.k) {
      case 'num': return e.text;
      case 'char': return e.text;
      case 'var': return e.name;
      case 'index': return e.name + '[' + exprText(e.index) + ']';
      case 'addr': return '&' + e.name;
      case 'deref': return '*' + e.name;
      case 'neg': return '-' + exprText(e.e);
      case 'paren': return '(' + exprText(e.e) + ')';
      case 'bin': return exprText(e.l) + ' ' + e.op + ' ' + exprText(e.r);
    }
    return '?';
  }
  function targetText(t) { return t.k === 'var' ? t.name : t.k === 'deref' ? '*' + t.name : t.name + '[' + exprText(t.index) + ']'; }
  function stmtText(s) {
    if (s.kind === 'decl') {
      var head = s.type + (s.ptr ? '* ' : ' ') + s.name + (s.count ? '[' + s.count + ']' : '');
      if (!s.init) return head + ';';
      if (s.init.k === 'str') return head + ' = ' + s.init.text + ';';
      if (s.init.k === 'list') return head + ' = {' + s.init.items.map(exprText).join(', ') + '};';
      return head + ' = ' + exprText(s.init) + ';';
    }
    return targetText(s.target) + ' = ' + exprText(s.expr) + ';';
  }
  B.stmtText = stmtText;

  /* parseProgram(text) -> {program: {statements, vars, used, base, size}, error: string|null} */
  B.parseProgram = function (text, opts) {
    opts = opts || {};
    var base = opts.base === undefined ? B.MEM.base : opts.base, size = opts.size || B.MEM.size;
    try {
      var toks = tokenize(String(text || ''));
      var groups = [], cur = [];
      toks.forEach(function (t) { if (t.t === 'sep') { if (cur.length) groups.push(cur); cur = []; } else cur.push(t); });
      if (cur.length) groups.push(cur);
      if (!groups.length) return { program: null, error: 'Write at least one statement, e.g. int a = 5;' };
      if (groups.length > B.MEM.maxStatements) return { program: null, error: 'Use at most ' + B.MEM.maxStatements + ' statements so every step stays readable.' };
      var syms = {}, statements = [], vars = [], next = base;
      for (var g = 0; g < groups.length; g++) {
        var s;
        try { s = parseStatement(groups[g], syms); }
        catch (err) { if (err instanceof LabError) throw new LabError('Statement ' + (g + 1) + ' (' + String(text).slice(groups[g][0].start, groups[g][groups[g].length - 1].end).replace(/\s+/g, ' ') + '): ' + err.message); throw err; }
        if (!s) continue;
        s.index = statements.length;
        if (s.kind === 'decl') {
          s.size = sizeOf(s); s.elemSize = elemSize(s); s.addr = next; next += s.size;
          if (next - base > size) throw new LabError('Out of memory: this toy RAM has ' + size + ' bytes, and ' + s.name + ' would need bytes up to ' + B.hex(next - 1, 3) + '. Use fewer or smaller variables.');
          vars.push(s);
        }
        s.text = stmtText(s);
        statements.push(s);
      }
      // literal range check (friendly limit: what fits in 32 bits, signed or unsigned)
      var bad = null;
      statements.forEach(function (s) {
        (function walk(n) {
          if (!n || bad) return;
          if (n.k === 'num' && n.v > 4294967295) bad = n.text;
          if (n.k === 'bin') { walk(n.l); walk(n.r); }
          if (n.k === 'neg' || n.k === 'paren') walk(n.e);
          if (n.k === 'index') walk(n.index);
          if (n.k === 'list') n.items.forEach(walk);
        }(s.kind === 'decl' ? s.init : s.expr));
        if (s.kind === 'assign' && s.target.k === 'index') (function walk(n) { if (n && n.k === 'num' && n.v > 4294967295) bad = n.text; }(s.target.index));
      });
      if (bad) throw new LabError(bad + ' is bigger than 32 bits can hold. Keep numbers below 4294967296.');
      return { program: { statements: statements, vars: vars, used: next - base, base: base, size: size }, error: null };
    } catch (err) {
      if (err instanceof LabError) return { program: null, error: err.message };
      throw err;
    }
  };

  /* runProgram(program, {seed}) -> steps for the memory lab.
     Step: {kind, stmt, line, flow, bytes[], states[], brackets[], pointers[], watch[], caption, counters} */
  B.runProgram = function (program, opts) {
    opts = opts || {};
    var base = program.base, size = program.size;
    var mem = B.garbage(size, opts.seed === undefined ? 7 : opts.seed);
    var written = mem.map(function () { return false; });
    var declared = [];       // decl objects in order of allocation
    var reads = 0, writes = 0;
    var steps = [];
    var trail = [], curStmt = null;

    function idx(addr) { return addr - base; }
    function A(addr) { return B.hex(addr, 3); }
    function bytesText(from, n) { var out = []; for (var i = 0; i < n; i++) out.push(B.hexByte(mem[from + i])); return out.join(' '); }
    function readRaw(addr, n, signed) { var i = idx(addr); return B.fromBytesLE(mem.slice(i, i + n), signed); }
    function readVar(d, k) { // value of scalar d (or element k of array d)
      var a = d.addr + (k || 0) * d.elemSize;
      if (d.ptr) return readRaw(a, 4, false);
      return readRaw(a, d.elemSize, d.type !== 'char');
    }
    function allocated(i) { return declared.some(function (d) { return i >= idx(d.addr) && i < idx(d.addr) + d.size; }); }
    function owner(addr) {
      for (var k = 0; k < declared.length; k++) {
        var d = declared[k];
        if (addr >= d.addr && addr < d.addr + d.size) return d;
      }
      return null;
    }
    function valueText(d, v) {
      if (d.ptr) { var o = owner(v); return B.hex(v, 3) + (o && o.addr === v ? ' → ' + o.name : ''); }
      if (d.type === 'char') { var lit = B.charLiteral(v); return lit ? lit + ' (' + v + ')' : String(v); }
      return fmtNum(v);
    }
    function uninit(d, k) {
      var a = idx(d.addr + (k || 0) * d.elemSize), n = d.elemSize;
      for (var i = 0; i < n; i++) if (!written[a + i]) return true;
      return false;
    }
    function watch() {
      return declared.map(function (d) {
        var v;
        if (d.count) {
          var parts = [];
          for (var k = 0; k < d.count; k++) parts.push(d.type === 'char' ? (B.charLiteral(readVar(d, k)) || readVar(d, k)) : fmtNum(readVar(d, k)));
          v = '[' + parts.join(', ') + ']';
        } else v = valueText(d, readVar(d));
        var garbage = d.count ? false : uninit(d);
        return { name: d.name, type: typeLabel(d), addr: A(d.addr), value: v, garbage: garbage };
      });
    }
    function pointers(extraState) {
      var out = [];
      declared.forEach(function (d) {
        if (!d.ptr || uninit(d)) return;
        var target = readVar(d);
        if (target >= base && target < base + size) out.push({ from: idx(d.addr), to: idx(target), state: (extraState && extraState[d.name]) || 'default', id: 'ptr-' + d.name });
      });
      return out;
    }
    function snap(kind, o) {
      var states = mem.map(function (_, i) { return allocated(i) ? 'default' : 'muted'; });
      (o.cells || []).forEach(function (c) { for (var i = c.from; i <= c.to; i++) if (i >= 0 && i < size) states[i] = c.state; });
      var brackets = [];
      declared.forEach(function (d) {
        var from = idx(d.addr), st = (o.varStates && o.varStates[d.name]) || 'default';
        if (d.count && o.split === d.name) {
          for (var k = 0; k < d.count; k++) {
            var ef = from + k * d.elemSize;
            brackets.push({ id: d.name + '[' + k + ']', name: d.name + '[' + k + ']', type: '', from: ef, to: ef + d.elemSize - 1, state: k === o.splitIndex ? (o.splitState || 'active') : 'default' });
          }
        } else brackets.push({ id: d.name, name: d.name, type: typeLabel(d), from: from, to: from + d.size - 1, state: st });
      });
      steps.push({
        kind: kind, stmt: o.stmt === undefined ? null : o.stmt, line: o.stmt === undefined || o.stmt === null ? null : 's' + o.stmt,
        flow: o.flow || { active: null, trail: [] },
        bytes: mem.slice(), states: states, written: written.slice(), brackets: brackets, pointers: pointers(o.ptrStates),
        watch: watch(), caption: o.caption,
        counters: { used: declared.reduce(function (s, d) { return s + d.size; }, 0), read: reads, written: writes },
        error: !!o.error
      });
    }
    function flow(active) { if (trail[trail.length - 1] !== active) trail.push(active); return { active: active, trail: trail.slice() }; }

    /* evaluate an expression, collecting the memory it reads */
    function evaluate(e, acc) {
      switch (e.k) {
        case 'num': return e.v;
        case 'char': return e.v;
        case 'paren': return evaluate(e.e, acc);
        case 'neg': return -evaluate(e.e, acc);
        case 'bin': {
          var l = evaluate(e.l, acc), r = evaluate(e.r, acc);
          return e.op === '+' ? l + r : e.op === '-' ? l - r : l * r;
        }
        case 'addr': return symbol(e.name).addr;
        case 'var': {
          var d = symbol(e.name);
          var v = readVar(d);
          acc.push({ what: e.name, addr: d.addr, n: d.elemSize, value: v, uninit: uninit(d), d: d });
          return v;
        }
        case 'index': {
          var da = symbol(e.name), k = evaluate(e.index, acc);
          if (k < 0 || k >= da.count) throw { oob: true, d: da, k: k, reading: true };
          var va = readVar(da, k);
          acc.push({ what: e.name + '[' + k + ']', addr: da.addr + k * da.elemSize, n: da.elemSize, value: va, uninit: uninit(da, k), d: da, k: k });
          return va;
        }
        case 'deref': {
          var dp = symbol(e.name), pa = readVar(dp);
          acc.push({ what: e.name, addr: dp.addr, n: 4, value: pa, uninit: uninit(dp), d: dp, isPtr: true });
          var o = owner(pa);
          if (uninit(dp) || !o || o.addr !== pa || o.ptr || o.count || o.type !== dp.type) throw { badPtr: true, d: dp, addr: pa };
          var vd = readVar(o);
          acc.push({ what: '*' + e.name, addr: o.addr, n: o.elemSize, value: vd, uninit: uninit(o), d: o, via: e.name });
          return vd;
        }
      }
      return 0;
    }
    var symtab = {};
    function symbol(name) { return symtab[name]; }
    function readCells(acc) { return acc.map(function (r) { return { from: idx(r.addr), to: idx(r.addr) + r.n - 1, state: 'compare' }; }); }
    function readText(acc) {
      return acc.map(function (r) {
        var t = '<b>' + r.what + '</b> at ' + A(r.addr) + ': ' + bytesText(idx(r.addr), r.n) + ' → ' + (r.isPtr ? A(r.value) : r.d.type === 'char' && B.charLiteral(r.value) ? B.charLiteral(r.value) + ' = ' + r.value : fmtNum(r.value));
        if (r.uninit) t += ' <em>(never written: leftover bits!)</em>';
        return t;
      }).join('; ');
    }
    function writeBytes(addr, bytes) {
      var i = idx(addr);
      bytes.forEach(function (b, k) { mem[i + k] = b; written[i + k] = true; });
      writes += bytes.length;
    }
    function encodeCaption(d, v, size, place) {
      var width = size * 8, stored = B.wrap(v, width), bytes = B.bytesLE(v, size);
      var bt = bytes.map(B.hexByte).join(' ');
      var shown = d.type === 'char' && !d.ptr ? B.wrap(v, 8) : d.ptr ? v : B.toSigned(v, width);
      var parts = [];
      var lo = d.type === 'char' && !d.ptr ? 0 : d.ptr ? 0 : -pow2(width - 1), hi = d.type === 'char' || d.ptr ? pow2(width) - 1 : pow2(width - 1) - 1;
      if (d.ptr) parts.push('Store the address ' + A(v) + ' in ' + place + '\'s 4 bytes, lowest byte first: <b>' + bt + '</b>.');
      else if (v < lo || v > hi) parts.push(fmtNum(v) + ' does not fit in ' + plural(size, 'byte') + ' (' + fmtNum(lo) + ' to ' + hi + '): only the low ' + width + ' bits are kept, so ' + place + ' becomes <b>' + fmtNum(shown) + '</b>. That is <b>overflow</b>. Bytes: <b>' + bt + '</b>.');
      else if (size === 1) parts.push('Store ' + (d.type === 'char' && B.charLiteral(stored) ? B.charLiteral(stored) + ', ASCII code ' + stored + ' = ' + B.hex(stored, 2) + ',' : stored + ' = ' + B.hex(stored, 2)) + ' in ' + place + '\'s single byte: <b>' + bt + '</b>.');
      else parts.push('Store ' + fmtNum(v) + ' = ' + B.hex(stored, size * 2) + (v < 0 ? ' (two\'s complement)' : '') + ' in ' + place + '\'s ' + size + ' bytes, lowest byte first: <b>' + bt + '</b>.');
      return parts.join(' ');
    }

    snap('start', { caption: size + ' bytes of RAM, addresses ' + A(base) + ' to ' + A(base + size - 1) + '. Every byte always holds some pattern: these greyed bytes are leftovers from whatever used the memory before.', flow: { active: null, trail: [] } });

    try {
      program.statements.forEach(function (s) {
        trail = s.index > 0 ? ['next', 'more'] : ['more'];
        var st = s.index;
        curStmt = st;
        if (s.kind === 'decl') {
          declared.push(s); symtab[s.name] = s;
          var from = idx(s.addr), to = from + s.size - 1;
          var what = s.count ? s.count + ' ' + s.type + 's × ' + plural(s.elemSize, 'byte') + ' = ' + s.size + ' bytes' : s.ptr ? 'room for an address, which takes 4 bytes' : (s.type === 'int' ? 'an ' : 'a ') + s.type + ', which takes ' + plural(s.size, 'byte');
          snap('alloc', { stmt: st, cells: [{ from: from, to: to, state: 'active' }], varStates: (function () { var o = {}; o[s.name] = 'active'; return o; }()),
            flow: (trail.push('decl'), flow('alloc')),
            caption: '<code>' + esc(s.text) + '</code> needs ' + what + '. The next free ' + (s.size > 1 ? 'bytes are ' + A(s.addr) + '–' + A(s.addr + s.size - 1) : 'byte is ' + A(s.addr)) + ', so the name <b>' + s.name + '</b> now stands for address <b>' + A(s.addr) + '</b>.' + (s.init ? '' : ' Nothing is written, so they keep their leftover bits.') });
          if (!s.init) return;
          trail.push('init');
          if (s.init.k === 'str' || s.init.k === 'list') {
            var codes;
            if (s.init.k === 'str') codes = s.init.codes.concat([0]);
            else { var accL = []; codes = s.init.items.map(function (e) { return evaluate(e, accL); }); reads += accL.reduce(function (t, r) { return t + r.n; }, 0); if (accL.length) snap('read', { stmt: st, cells: readCells(accL), flow: flow('eval'), caption: 'Evaluate the list first: ' + readText(accL) + '.' }); }
            while (codes.length < s.count) codes.push(0);
            var allBytes = [];
            codes.forEach(function (c) { allBytes = allBytes.concat(B.bytesLE(c, s.elemSize)); });
            writeBytes(s.addr, allBytes);
            var cap;
            if (s.init.k === 'str') cap = esc(s.init.text) + ' is ' + plural(s.init.codes.length, 'character') + ', one ASCII byte each, plus a <b>0 byte</b> that marks where the text ends: <b>' + allBytes.map(B.hexByte).join(' ') + '</b>.';
            else cap = 'The ' + s.count + ' elements go one after another, ' + plural(s.elemSize, 'byte') + ' each, element i at ' + A(s.addr) + ' + i × ' + s.elemSize + '.' + (s.init.items.length < s.count ? ' Missing elements are filled with 0, as in C.' : '') + ' Bytes: <b>' + allBytes.map(B.hexByte).join(' ') + '</b>.';
            snap('write', { stmt: st, cells: [{ from: from, to: to, state: 'swap' }], flow: (flow('eval'), flow('write')), caption: cap });
            return;
          }
          var acc = [];
          var v = evaluate(s.init, acc);
          reads += acc.reduce(function (t, r) { return t + r.n; }, 0);
          if (acc.length) snap('read', { stmt: st, cells: readCells(acc), flow: flow('eval'), caption: 'Evaluate the right side before writing: ' + readText(acc) + (acc.length > 1 || s.init.k === 'bin' || s.init.k === 'neg' ? '. Result: <b>' + fmtNum(v) + '</b>.' : '.') });
          else flow('eval');
          writeBytes(s.addr, B.bytesLE(v, s.elemSize));
          snap('write', { stmt: st, cells: [{ from: from, to: to, state: 'swap' }], flow: flow('write'),
            ptrStates: s.ptr ? (function () { var o = {}; o[s.name] = 'swap'; return o; }()) : null,
            caption: (s.init.k === 'addr' ? '<b>&amp;' + s.init.name + '</b> means “the address of ' + s.init.name + '”, which is ' + A(v) + '. ' : '') + encodeCaption(s, v, s.elemSize, s.name) });
          return;
        }
        // assignment
        trail.push('decl'); trail.push('addr');
        var t = s.target, td = symtab[t.name], taddr, tsize, tdecl = td, place;
        var accA = [];
        if (t.k === 'var') { taddr = td.addr; tsize = td.elemSize; place = t.name; }
        else if (t.k === 'index') {
          var k = evaluate(t.index, accA);
          reads += accA.reduce(function (sum, r) { return sum + r.n; }, 0);
          if (k < 0 || k >= td.count) throw { oob: true, d: td, k: k, st: st, acc: accA };
          taddr = td.addr + k * td.elemSize; tsize = td.elemSize; place = t.name + '[' + k + ']';
          var ti = idx(taddr);
          snap('addr', { stmt: st, cells: readCells(accA).concat([{ from: ti, to: ti + tsize - 1, state: 'active' }]), split: t.name, splitIndex: k, flow: flow('addr'),
            caption: (accA.length ? 'The index reads ' + readText(accA) + '. ' : '') + '<b>' + t.name + '[' + k + ']</b> lives at the start of ' + t.name + ' plus ' + k + ' elements of ' + td.elemSize + ' bytes: ' + A(td.addr) + ' + ' + k + ' × ' + td.elemSize + ' = <b>' + A(taddr) + '</b>. One multiply and one add, however long the array.' });
        } else {
          var pv = readVar(td);
          reads += 4;
          var o = owner(pv);
          if (uninit(td) || !o || o.addr !== pv || o.ptr || o.count || o.type !== td.type) throw { badPtr: true, d: td, addr: pv, st: st };
          taddr = o.addr; tsize = o.elemSize; tdecl = o; place = o.name;
          var pi = idx(td.addr), oi = idx(o.addr);
          snap('addr', { stmt: st, cells: [{ from: pi, to: pi + 3, state: 'compare' }, { from: oi, to: oi + tsize - 1, state: 'active' }], varStates: (function () { var x = {}; x[o.name] = 'active'; return x; }()),
            ptrStates: (function () { var x = {}; x[t.name] = 'active'; return x; }()), flow: flow('addr'),
            caption: '<b>' + t.name + '</b> holds ' + bytesText(pi, 4) + ' = address ' + A(pv) + '. So <b>*' + t.name + '</b> means the ' + o.type + ' stored at ' + A(pv) + ', which is <b>' + o.name + '</b>. Writing through the pointer changes ' + o.name + ' itself.' });
        }
        var acc2 = [];
        var val = evaluate(s.expr, acc2);
        reads += acc2.reduce(function (sum, r) { return sum + r.n; }, 0);
        var keepSplit = t.k === 'index' ? { split: t.name, splitIndex: (taddr - td.addr) / td.elemSize, splitState: 'active' } : {};
        if (acc2.length) {
          var tiA = idx(taddr);
          snap('read', Object.assign({ stmt: st, cells: [{ from: tiA, to: tiA + tsize - 1, state: 'active' }].concat(readCells(acc2)), flow: flow('eval'),
            caption: 'Evaluate the right side before writing: ' + readText(acc2) + (acc2.length > 1 || s.expr.k === 'bin' || s.expr.k === 'neg' || s.expr.k === 'deref' ? '. Result: <b>' + (tdecl.ptr ? A(val) : fmtNum(val)) + '</b>.' : '.') }, keepSplit));
        } else flow('eval');
        var bytesW = B.bytesLE(val, tsize);
        var ti2 = idx(taddr);
        var changed = [];
        bytesW.forEach(function (b, q) { if (mem[ti2 + q] !== b) changed.push(q); });
        writeBytes(taddr, bytesW);
        var capW = (s.expr.k === 'addr' ? '<b>&amp;' + s.expr.name + '</b> is ' + A(val) + ', so ' + t.name + ' now points at ' + s.expr.name + '. ' : '') + encodeCaption(tdecl.ptr && t.k === 'var' ? tdecl : tdecl, val, tsize, place);
        if (tsize > 1 && changed.length && changed.length < tsize) capW += ' Only ' + plural(changed.length, 'byte') + ' actually change' + (changed.length === 1 ? 's' : '') + '.';
        if (!changed.length) capW += ' The bytes already held this value, so nothing visibly changes.';
        snap('write', Object.assign({ stmt: st, cells: [{ from: ti2, to: ti2 + tsize - 1, state: 'swap' }], flow: flow('write'),
          ptrStates: tdecl.ptr && t.k === 'var' ? (function () { var x = {}; x[t.name] = 'swap'; return x; }()) : null, caption: capW }, keepSplit));
      });
      trail = program.statements.length ? ['next', 'more'] : ['more'];
      var used = declared.reduce(function (s, d) { return s + d.size; }, 0);
      snap('done', { flow: flow('done'), caption: 'No statements left. The program used <b>' + used + ' of ' + size + ' bytes</b>: ' + declared.map(function (d) { return d.name + ' at ' + A(d.addr); }).join(', ') + '. Each name is only a label for an address.' });
    } catch (err) {
      if (err && err.oob) {
        var bad = err.d.addr + err.k * err.d.elemSize, bi = idx(bad);
        var cells = [{ from: idx(err.d.addr), to: idx(err.d.addr) + err.d.size - 1, state: 'compare' }];
        if (bi >= 0 && bi < size) cells.push({ from: bi, to: Math.min(size - 1, bi + err.d.elemSize - 1), state: 'error' });
        snap('error', { stmt: err.st === undefined ? curStmt : err.st, cells: cells, flow: { active: 'addr', trail: trail.concat(['addr']), error: true }, error: true,
          caption: '<b>' + err.d.name + '[' + fmtNum(err.k) + ']</b> would be at ' + A(err.d.addr) + ' + ' + fmtNum(err.k) + ' × ' + err.d.elemSize + ' = ' + (bad >= 0 ? A(bad) : 'below ' + A(base)) + ', outside ' + err.d.name + ' (' + A(err.d.addr) + '–' + A(err.d.addr + err.d.size - 1) + '). C would not stop you: it would quietly ' + (err.reading ? 'read' : 'overwrite') + ' whatever lives there. This lab stops instead.' });
      } else if (err && err.badPtr) {
        var pc = idx(err.d.addr);
        snap('error', { stmt: err.st === undefined ? curStmt : err.st, cells: [{ from: pc, to: pc + 3, state: 'error' }], flow: { active: 'addr', trail: trail.concat(['addr']), error: true }, error: true,
          caption: '<b>' + err.d.name + '</b> holds ' + A(err.addr) + (uninit(err.d) ? ', leftover bits that were never set' : '') + ', which is not the address of ' + aType(err.d.type) + ' this program owns. Following it would read or corrupt random memory (in C: undefined behaviour), so the lab stops here.' });
      } else throw err;
    }
    return steps;
  };

  /* translate(program) -> {pseudo, cpp, js, py}: one labelled line per statement (@s0, @s1, …). */
  B.translate = function (program) {
    var base = program.base, used = {};
    var syms = {};
    program.vars.forEach(function (d) { syms[d.name] = d; });
    function A(a) { return B.hex(a, 3); }
    function fn(kind, d) { var n = d.ptr ? 32 : TYPES[d.type] * 8; used[kind + n] = true; return kind + n; }
    function prec(e) { return e.k === 'bin' ? (e.op === '*' ? 2 : 1) : 3; }
    function code(e, lang) {
      switch (e.k) {
        case 'num': return e.text;
        case 'char': return lang === 'py' ? 'ord(' + e.text + ')' : String(e.v);
        case 'paren': return '(' + code(e.e, lang) + ')';
        case 'neg': return '-' + (prec(e.e) < 3 ? '(' + code(e.e, lang) + ')' : code(e.e, lang));
        case 'bin': {
          var l = code(e.l, lang), r = code(e.r, lang);
          if (prec(e.l) < prec(e)) l = '(' + l + ')';
          if (prec(e.r) < prec(e) || (prec(e.r) === prec(e) && e.op === '-')) r = '(' + r + ')';
          return l + ' ' + e.op + ' ' + r;
        }
        case 'addr': return A(syms[e.name].addr);
        case 'var': { var d = syms[e.name]; return fn('read', d) + '(' + A(d.addr) + ')'; }
        case 'index': { var da = syms[e.name]; return fn('read', da) + '(' + A(da.addr) + ' + ' + wrapIdx(code(e.index, lang), e.index) + ' * ' + da.elemSize + ')'; }
        case 'deref': { var dp = syms[e.name]; used.read32 = true; return fn('read', { type: dp.type }) + '(read32(' + A(dp.addr) + '))'; }
      }
      return '?';
    }
    function wrapIdx(c, e) { return prec(e) < 2 ? '(' + c + ')' : c; }
    function pseudoExpr(e) { return exprText(e).replace(/&(\w+)/g, 'address of $1'); }
    var P = [], C = [], J = [], Y = [];
    program.statements.forEach(function (s) {
      var lab = 's' + s.index, text = s.text;
      if (s.kind === 'decl') {
        var tl = s.type + (s.ptr ? '* ' : ' ') + s.name + (s.count ? '[' + s.count + ']' : ''), at = A(s.addr);
        if (!s.init) {
          P.push(tl + ' at ' + at + '   (bytes not written)   // @' + lab);
          C.push(text + '   // @' + lab);
          J.push('// ' + text + '  →  ' + at + (s.size > 1 ? '–' + A(s.addr + s.size - 1) : '') + ', bytes left as they were @' + lab);
          Y.push('# ' + text + '  ->  ' + at + (s.size > 1 ? '-' + A(s.addr + s.size - 1) : '') + ', bytes left as they were @' + lab);
          return;
        }
        if (s.init.k === 'str' || s.init.k === 'list') {
          var vals;
          if (s.init.k === 'str') vals = s.init.codes.concat([0]);
          else vals = s.init.items.slice();
          var jsVals = vals.map(function (v) { return typeof v === 'number' ? String(v) : code(v, 'js'); });
          var pyVals = vals.map(function (v) { return typeof v === 'number' ? String(v) : code(v, 'py'); });
          while (jsVals.length < s.count) { jsVals.push('0'); pyVals.push('0'); }
          var w = fn('write', s), step = s.elemSize === 1 ? 'i' : 'i * ' + s.elemSize;
          P.push(tl + ' at ' + at + ' ← ' + (s.init.k === 'str' ? s.init.text : '{' + s.init.items.map(pseudoExpr).join(', ') + '}') + '   // @' + lab);
          C.push(text + '   // @' + lab);
          J.push('[' + jsVals.join(', ') + '].forEach((v, i) => ' + w + '(' + at + ' + ' + step + ', v));  // ' + text + ' @' + lab);
          Y.push('for i, v in enumerate([' + pyVals.join(', ') + ']): ' + w + '(' + at + ' + ' + step + ', v)  # ' + text + ' @' + lab);
          return;
        }
        var wr = fn('write', s);
        P.push(tl + ' at ' + at + ' ← ' + pseudoExpr(s.init) + '   // @' + lab);
        C.push(text + '   // @' + lab);
        J.push(wr + '(' + at + ', ' + code(s.init, 'js') + ');  // ' + text + ' @' + lab);
        Y.push(wr + '(' + at + ', ' + code(s.init, 'py') + ')  # ' + text + ' @' + lab);
        return;
      }
      var t = s.target, d = syms[t.name], addrJ, addrY, wfn, ptarget;
      if (t.k === 'var') { addrJ = addrY = A(d.addr); wfn = fn('write', d); ptarget = t.name; }
      else if (t.k === 'index') {
        addrJ = A(d.addr) + ' + ' + wrapIdx(code(t.index, 'js'), t.index) + ' * ' + d.elemSize;
        addrY = A(d.addr) + ' + ' + wrapIdx(code(t.index, 'py'), t.index) + ' * ' + d.elemSize;
        wfn = fn('write', d); ptarget = t.name + '[' + exprText(t.index) + ']';
      } else {
        used.read32 = true;
        addrJ = addrY = 'read32(' + A(d.addr) + ')'; wfn = fn('write', { type: d.type }); ptarget = 'the ' + d.type + ' at address ' + t.name;
      }
      P.push(ptarget + ' ← ' + pseudoExpr(s.expr) + '   // @' + lab);
      C.push(text + '   // @' + lab);
      J.push(wfn + '(' + addrJ + ', ' + code(s.expr, 'js') + ');  // ' + text + ' @' + lab);
      Y.push(wfn + '(' + addrY + ', ' + code(s.expr, 'py') + ')  # ' + text + ' @' + lab);
    });
    var jh = ['const ram = new DataView(new ArrayBuffer(' + program.size + '));  // ' + program.size + ' bytes of RAM', 'const BASE = ' + A(base) + ';  // address of the first byte'];
    var yh = ['ram = bytearray(' + program.size + ')  # ' + program.size + ' bytes of RAM', 'BASE = ' + A(base) + '  # address of the first byte'];
    var JS_FN = {
      write32: 'const write32 = (addr, v) => ram.setInt32(addr - BASE, v, true);  // true: little-endian',
      read32: 'const read32 = (addr) => ram.getInt32(addr - BASE, true);',
      write16: 'const write16 = (addr, v) => ram.setInt16(addr - BASE, v, true);',
      read16: 'const read16 = (addr) => ram.getInt16(addr - BASE, true);',
      write8: 'const write8 = (addr, v) => ram.setUint8(addr - BASE, v);  // keeps v mod 256',
      read8: 'const read8 = (addr) => ram.getUint8(addr - BASE);'
    };
    var PY_FN = {
      write32: "def write32(addr, v): ram[addr - BASE:addr - BASE + 4] = (v % 2**32).to_bytes(4, 'little')",
      read32: "def read32(addr): return int.from_bytes(ram[addr - BASE:addr - BASE + 4], 'little', signed=True)",
      write16: "def write16(addr, v): ram[addr - BASE:addr - BASE + 2] = (v % 2**16).to_bytes(2, 'little')",
      read16: "def read16(addr): return int.from_bytes(ram[addr - BASE:addr - BASE + 2], 'little', signed=True)",
      write8: 'def write8(addr, v): ram[addr - BASE] = v % 256',
      read8: 'def read8(addr): return ram[addr - BASE]'
    };
    ['write32', 'read32', 'write16', 'read16', 'write8', 'read8'].forEach(function (k) { if (used[k]) { jh.push(JS_FN[k]); yh.push(PY_FN[k]); } });
    return {
      pseudo: P.join('\n'),
      cpp: C.join('\n'),
      js: jh.join('\n') + '\n' + J.join('\n'),
      py: yh.join('\n') + '\n' + Y.join('\n')
    };
  };

  return B;
}));
