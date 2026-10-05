/* Big-O explorer: pure model (no DOM). UMD: window.VDSA_BIGO and module.exports; tested in tests/labs/big-o-explorer.test.js.

   - CLASSES: the nine growth classes with ops(n), log10 of ops(n) (so 2ⁿ and n! never overflow), and a sparkline shape.
   - formatCount / formatDuration: from "12 ops" to "longer than the universe".
   - parseExpr / evaluate / analyze: a tiny recursive-descent parser for costs like `3n^2 + 5n + 100`. It never uses
     eval or Function: the input becomes an AST of five node types and only the tree is executed.
   - dominant term analysis is symbolic (c · n^a · (log n)^b · base^n · (n!)^f), with a numeric fallback for the rare
     expression the symbolic pass cannot express. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ numeric helpers */
  var LN10 = Math.log(10), LOG10_2 = Math.log10 ? Math.log10(2) : Math.log(2) / LN10;
  var G = 7, LC = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  /* ln Γ(x) for x > 0 (Lanczos); ln(n!) = lgamma(n + 1). */
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    var a = LC[0], t = x + G + 0.5;
    for (var i = 1; i < G + 2; i++) a += LC[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function factorial(x) { return x <= 170 && x >= 0 && x === Math.floor(x) ? Math.round(Math.exp(lgamma(x + 1))) : Math.exp(lgamma(x + 1)); }
  function log2(x) { return Math.log(x) / Math.LN2; }
  var CAP = 1e60;
  function cap(v) { return v > CAP ? CAP : v; }

  /* ------------------------------------------------------------------ the nine classes */
  /* `log10` gives log10(ops) and stays finite for any n; `f` is ops(n) clipped to 1e60 for charts. */
  var CLASSES = [
    { id: '1', o: '1', label: 'O(1)', tex: '1', name: 'constant', f: function () { return 1; }, log10: function () { return 0; } },
    { id: 'logn', o: 'logn', label: 'O(log n)', tex: 'log n', name: 'logarithmic', f: function (n) { return log2(Math.max(n, 1)); }, log10: function (n) { return Math.log10(Math.max(log2(Math.max(n, 1)), 1e-12)); } },
    { id: 'sqrtn', o: 'sqrtn', label: 'O(√n)', tex: '√n', name: 'square root', f: function (n) { return Math.sqrt(n); }, log10: function (n) { return 0.5 * Math.log10(n); } },
    { id: 'n', o: 'n', label: 'O(n)', tex: 'n', name: 'linear', f: function (n) { return n; }, log10: function (n) { return Math.log10(n); } },
    { id: 'nlogn', o: 'nlogn', label: 'O(n log n)', tex: 'n log n', name: 'linearithmic', f: function (n) { return n * log2(Math.max(n, 1)); }, log10: function (n) { return Math.log10(Math.max(n * log2(Math.max(n, 1)), 1e-12)); } },
    { id: 'n2', o: 'n2', label: 'O(n²)', tex: 'n²', name: 'quadratic', f: function (n) { return n * n; }, log10: function (n) { return 2 * Math.log10(n); } },
    { id: 'n3', o: 'n3', label: 'O(n³)', tex: 'n³', name: 'cubic', f: function (n) { return n * n * n; }, log10: function (n) { return 3 * Math.log10(n); } },
    { id: '2n', o: '2n', label: 'O(2ⁿ)', tex: '2ⁿ', name: 'exponential', f: function (n) { return cap(Math.pow(2, n)); }, log10: function (n) { return n * LOG10_2; } },
    { id: 'nfact', o: 'nfact', label: 'O(n!)', tex: 'n!', name: 'factorial', f: function (n) { return cap(Math.exp(lgamma(n + 1))); }, log10: function (n) { return lgamma(n + 1) / LN10; } }
  ];
  function byId(id) { for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].id === id) return CLASSES[i]; return null; }

  /* ------------------------------------------------------------------ formatting */
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '.': '·' };
  function sup(v) { return String(v).split('').map(function (c) { return SUP[c] || c; }).join(''); }
  function group(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function sig(v, d) { var s = v.toPrecision(d || 3); return s.indexOf('e') >= 0 ? String(+s) : String(+s); }

  /* Operation count from its log10: exact with separators below 10¹², else "3.2 × 10¹⁵". */
  function formatCount(log10ops) {
    if (!isFinite(log10ops)) return '∞';
    if (log10ops < -1) return '0';
    if (log10ops < 12) return group(Math.pow(10, log10ops));
    var e = Math.floor(log10ops), m = Math.pow(10, log10ops - e);
    if (m >= 9.995) { m = 1; e += 1; }
    var ms = sig(m, 2);
    if (ms === '10') { ms = '1'; e += 1; }
    return ms + ' × 10' + sup(e);
  }
  var UNIVERSE_S = 13.8e9 * 365.25 * 86400, LOG_UNIVERSE = Math.log10(UNIVERSE_S);
  /* Seconds (as log10) to a friendly duration. Returns { text, long, log10, tier } where `long` means beyond the age of the universe. */
  function formatDuration(log10s) {
    if (log10s < -12) return { text: '0 ns', log10: log10s, tier: 'ns', long: false };
    if (log10s > LOG_UNIVERSE) {
      var k = Math.floor(log10s - LOG_UNIVERSE);
      return { text: 'longer than the universe', sub: k >= 1 ? '≈ 10' + sup(k) + ' × its age' : 'more than its age', log10: log10s, tier: 'forever', long: true };
    }
    var s = Math.pow(10, log10s), t, tier;
    function fmt(v, unit) { return (v >= 100 ? group(v) : sig(v, v >= 10 ? 3 : 2)) + ' ' + unit; }
    if (s < 1e-6) { t = fmt(s * 1e9, 'ns'); tier = 'ns'; }
    else if (s < 1e-3) { t = fmt(s * 1e6, 'µs'); tier = 'µs'; }
    else if (s < 1) { t = fmt(s * 1e3, 'ms'); tier = 'ms'; }
    else if (s < 60) { t = fmt(s, 's'); tier = 's'; }
    else if (s < 3600) { t = fmt(s / 60, 'min'); tier = 'min'; }
    else if (s < 86400) { t = fmt(s / 3600, 'hours'); tier = 'hours'; }
    else if (s < 86400 * 365.25) { t = fmt(s / 86400, 'days'); tier = 'days'; }
    else {
      var y = s / (86400 * 365.25); tier = 'years';
      if (y < 1e3) t = fmt(y, 'years');
      else if (y < 1e6) t = group(y) + ' years';
      else if (y < 1e9) t = sig(y / 1e6, 3) + ' million years';
      else t = sig(y / 1e9, 3) + ' billion years';
    }
    return { text: t, log10: log10s, tier: tier, long: false };
  }
  /* A number of doublings to a multiplier such as "×4", "×1.5" or "×10³⁰". */
  function formatRatio(log10r) {
    if (!isFinite(log10r)) return '×∞';
    if (log10r < 4) { var r = Math.pow(10, log10r); return '×' + (r >= 100 ? group(r) : sig(r, 3)); }
    var e = Math.floor(log10r), m = Math.pow(10, log10r - e);
    return '×' + sig(m, 2) + ' × 10' + sup(e);
  }

  /* Sparkline shape: y in 0..1 for x in 0..1 (each class normalised to its own maximum, so only the shape shows). */
  var LF = [0, 0, Math.log(2), Math.log(6), Math.log(24), Math.log(120), Math.log(720), Math.log(5040), Math.log(40320)];
  function shape(id, x) {
    x = Math.max(0, Math.min(1, x));
    switch (id) {
      case '1': return 0.12;
      case 'logn': return Math.log(1 + 15 * x) / Math.log(16);
      case 'sqrtn': return Math.sqrt(x);
      case 'n': return x;
      case 'nlogn': return x * Math.log(1 + 15 * x) / Math.log(16) * 1.0;
      case 'nk': return Math.pow(x, 1.5);
      case 'n2': return x * x;
      case 'n3': return x * x * x;
      case '2n': return (Math.pow(2, 8 * x) - 1) / 255;
      case 'nfact': var t = 8 * x, i = Math.min(7, Math.floor(t)), fr = t - i; return Math.exp(LF[i] + (LF[i + 1] - LF[i]) * fr - LF[8]);
      default: return x;
    }
  }

  /* ------------------------------------------------------------------ tokenizer and parser */
  var FUNCS = { log: 'log2', log2: 'log2', lg: 'log2', log10: 'log10', ln: 'ln', sqrt: 'sqrt', exp: 'exp' };
  var FN_NAMES = ['log10', 'log2', 'sqrt', 'log', 'exp', 'lg', 'ln'];
  var SUPERS = { '²': '2', '³': '3', '⁴': '4', '⁵': '5', '¹': '1', '⁰': '0', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  var MAX_LEN = 160, MAX_DEPTH = 40;

  function fail(msg, pos) { var e = new Error(msg); e.pos = pos; e.isParseError = true; throw e; }

  function tokenize(src) {
    var s = String(src).replace(/^\s*(?:[TtFf]\s*\(\s*n\s*\)\s*=|=)/, '').replace(/^\s*[OoΘΩ]\s*\(([\s\S]*)\)\s*$/, '$1');
    if (s.length > MAX_LEN) fail('That expression is too long (limit ' + MAX_LEN + ' characters).', MAX_LEN);
    var t = [], i = 0, m;
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i)))) {
        var nv = parseFloat(m[0]);
        if (!isFinite(nv)) fail('That number is too large (the limit is about 10^308).', i);
        t.push({ k: 'num', v: nv, pos: i }); i += m[0].length; continue;
      }
      if (/[A-Za-z]/.test(c)) {
        var lower = s.slice(i).toLowerCase(), hit = null;
        for (var f = 0; f < FN_NAMES.length; f++) if (lower.indexOf(FN_NAMES[f]) === 0) { hit = FN_NAMES[f]; break; }
        if (hit) { t.push({ k: 'fn', v: FUNCS[hit], pos: i }); i += hit.length; continue; }
        if (c === 'n' || c === 'N') { t.push({ k: 'n', pos: i }); i++; continue; }
        if (lower.indexOf('pi') === 0) { t.push({ k: 'num', v: Math.PI, pos: i }); i += 2; continue; }
        if (c === 'e' && !/[A-Za-z]/.test(s[i + 1] || '')) { t.push({ k: 'num', v: Math.E, pos: i }); i++; continue; }
        fail('I only know the variable n, and the functions log, log2, ln, sqrt and exp (not “' + s.slice(i).match(/^[A-Za-z]+/)[0] + '”).', i);
      }
      if (SUPERS[c]) { t.push({ k: 'op', v: '^', pos: i }); t.push({ k: 'num', v: +SUPERS[c], pos: i }); i++; continue; }
      if (c === 'ⁿ') { t.push({ k: 'op', v: '^', pos: i }); t.push({ k: 'n', pos: i }); i++; continue; }
      if (c === '*' && s[i + 1] === '*') { t.push({ k: 'op', v: '^', pos: i }); i += 2; continue; }
      if (c === '√') { t.push({ k: 'fn', v: 'sqrt', pos: i }); i++; continue; }
      if (c === '×' || c === '·' || c === '⋅') { t.push({ k: 'op', v: '*', pos: i }); i++; continue; }
      if (c === '−' || c === '–') { t.push({ k: 'op', v: '-', pos: i }); i++; continue; }
      if (c === '÷') { t.push({ k: 'op', v: '/', pos: i }); i++; continue; }
      if ('+-*/^!()'.indexOf(c) >= 0) { t.push({ k: c === '(' || c === ')' ? c : c === '!' ? '!' : 'op', v: c, pos: i }); i++; continue; }
      fail('I don’t understand “' + c + '”. Try something like 3n^2 + 5n + 100.', i);
    }
    return t;
  }

  function parseExpr(src) {
    var toks = tokenize(src), p = 0, depth = 0;
    if (!toks.length) fail('Type a cost, for example 3n^2 + 5n + 100.', 0);
    function peek() { return toks[p]; }
    function enter() { if (++depth > MAX_DEPTH) fail('That expression is nested too deeply.', peek() ? peek().pos : 0); }
    function leave() { depth--; }
    function startsFactor(t) { return t && (t.k === 'num' || t.k === 'n' || t.k === 'fn' || t.k === '('); }
    function expr() {
      enter();
      var a = term();
      while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) { var op = toks[p++].v; a = { t: 'bin', op: op, a: a, b: term() }; }
      leave(); return a;
    }
    function term() {
      var a = unary();
      for (;;) {
        var t = peek();
        if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) { p++; a = { t: 'bin', op: t.v, a: a, b: unary() }; }
        else if (startsFactor(t)) a = { t: 'bin', op: '*', a: a, b: unary() };   /* implicit: 3n, n log n, 5(n + 1) */
        else break;
      }
      return a;
    }
    function unary() {
      var t = peek();
      if (t && t.k === 'op' && (t.v === '-' || t.v === '+')) { enter(); p++; var a = unary(); leave(); return t.v === '-' ? { t: 'neg', a: a } : a; }
      return power();
    }
    function power() {
      var base = postfix(), t = peek();
      if (t && t.k === 'op' && t.v === '^') {
        p++; enter();
        var s = peek(), sign = 1;
        if (s && s.k === 'op' && (s.v === '-' || s.v === '+')) { p++; if (s.v === '-') sign = -1; }
        var ex = power(); leave();
        return { t: 'bin', op: '^', a: base, b: sign < 0 ? { t: 'neg', a: ex } : ex };
      }
      return base;
    }
    function postfix() {
      var a = atom();
      while (peek() && peek().k === '!') { p++; a = { t: 'fact', a: a }; }
      return a;
    }
    function atom() {
      var t = toks[p];
      if (!t) fail('The expression ends too early: something is missing after the last symbol.', toks[toks.length - 1].pos + 1);
      if (t.k === 'num') { p++; return { t: 'num', v: t.v }; }
      if (t.k === 'n') { p++; return { t: 'n' }; }
      if (t.k === '(') {
        p++; enter(); var e = expr(); leave();
        if (!peek() || peek().k !== ')') fail('A parenthesis is not closed.', t.pos);
        p++; return e;
      }
      if (t.k === 'fn') {
        p++; var arg;
        if (peek() && peek().k === '(') { p++; enter(); arg = expr(); leave(); if (!peek() || peek().k !== ')') fail('A parenthesis is not closed.', t.pos); p++; }
        else if (startsFactor(peek()) || (peek() && peek().k === 'op' && peek().v === '-')) arg = unary();
        else fail('“' + src.slice(t.pos, t.pos + 4).replace(/[^A-Za-z0-9√]+.*/, '') + '” needs something to work on, like log n or log(n).', t.pos);
        return { t: 'fn', name: t.v, a: arg };
      }
      if (t.k === ')') fail('There is a closing parenthesis with no opening one.', t.pos);
      fail('I did not expect “' + t.v + '” here.', t.pos);
    }
    var ast = expr();
    if (p < toks.length) {
      var t = toks[p];
      fail(t.k === ')' ? 'There is a closing parenthesis with no opening one.' : 'I did not expect “' + (t.v !== undefined ? t.v : 'n') + '” here.', t.pos);
    }
    return ast;
  }
  /* Result object for UI code: never throws. */
  function tryParse(src) {
    try { return { ok: true, ast: parseExpr(src) }; }
    catch (e) { if (e && e.isParseError) return { ok: false, error: e.message, pos: e.pos }; return { ok: false, error: 'I could not read that expression.', pos: 0 }; }
  }

  function evaluate(ast, n) {
    switch (ast.t) {
      case 'num': return ast.v;
      case 'n': return n;
      case 'neg': return -evaluate(ast.a, n);
      case 'fact': var x = evaluate(ast.a, n); return x < 0 ? NaN : factorial(x);
      case 'fn':
        var v = evaluate(ast.a, n);
        switch (ast.name) {
          case 'log2': return v > 0 ? Math.log(v) / Math.LN2 : NaN;
          case 'log10': return v > 0 ? Math.log(v) / LN10 : NaN;
          case 'ln': return v > 0 ? Math.log(v) : NaN;
          case 'sqrt': return v >= 0 ? Math.sqrt(v) : NaN;
          case 'exp': return Math.exp(v);
        }
        return NaN;
      case 'bin':
        var a = evaluate(ast.a, n), b = evaluate(ast.b, n);
        switch (ast.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '^': return Math.pow(a, b);
        }
    }
    return NaN;
  }
  /* log10 of |f(n)| when f is a product of huge pieces would overflow: use the symbolic terms instead (see termLog10). */

  /* ------------------------------------------------------------------ symbolic analysis */
  /* term: { c, a, b, e, f, g } = c · n^a · (log₂ n)^b · e^n · (n!)^f · (log₂ log₂ n)^g */
  function T(c, a, b, e, f, g) { return { c: c, a: a || 0, b: b || 0, e: e === undefined ? 1 : e, f: f || 0, g: g || 0 }; }
  function Unsupported(why) { this.why = why; }
  function isConst(t) { return t.a === 0 && t.b === 0 && t.e === 1 && t.f === 0 && t.g === 0; }
  function keyOfTerm(t) { return [Math.round(t.a * 1e6), Math.round(t.b * 1e6), Math.round(Math.log(t.e) * 1e6), Math.round(t.f * 1e6), Math.round(t.g * 1e6)].join('|'); }
  function combine(list) {
    var map = {}, order = [];
    list.forEach(function (t) { var k = keyOfTerm(t); if (map[k]) map[k].c += t.c; else { map[k] = T(t.c, t.a, t.b, t.e, t.f, t.g); order.push(k); } });
    return order.map(function (k) { if (!isFinite(map[k].c)) throw new Unsupported('a number too large to hold'); return map[k]; }).filter(function (t) { return t.c !== 0; });
  }
  function mulT(x, y) { return T(x.c * y.c, x.a + y.a, x.b + y.b, x.e * y.e, x.f + y.f, x.g + y.g); }
  function mulL(A, B) {
    var out = [];
    if (A.length * B.length > 400) throw new Unsupported('too many terms');
    A.forEach(function (x) { B.forEach(function (y) { out.push(mulT(x, y)); }); });
    return combine(out);
  }
  function constOf(L) { if (L.length === 0) return 0; if (L.length === 1 && isConst(L[0])) return L[0].c; return null; }
  function sym(ast) {
    switch (ast.t) {
      case 'num': return ast.v === 0 ? [] : [T(ast.v)];
      case 'n': return [T(1, 1)];
      case 'neg': return sym(ast.a).map(function (t) { return T(-t.c, t.a, t.b, t.e, t.f, t.g); });
      case 'fact':
        var A = sym(ast.a);
        if (A.length === 1 && A[0].c === 1 && A[0].a === 1 && A[0].b === 0 && A[0].e === 1 && A[0].f === 0 && A[0].g === 0) return [T(1, 0, 0, 1, 1)];
        var k = constOf(A); if (k !== null && k >= 0) return [T(factorial(k))];
        throw new Unsupported('factorial');
      case 'fn': return symFn(ast);
      case 'bin':
        var L = sym(ast.a), R;
        if (ast.op === '+') return combine(L.concat(sym(ast.b)));
        if (ast.op === '-') return combine(L.concat(sym(ast.b).map(function (t) { return T(-t.c, t.a, t.b, t.e, t.f, t.g); })));
        if (ast.op === '*') return mulL(L, sym(ast.b));
        if (ast.op === '/') {
          R = sym(ast.b);
          if (R.length !== 1) throw new Unsupported('division by a sum');
          var d = R[0], inv = T(1 / d.c, -d.a, -d.b, 1 / d.e, -d.f, -d.g);
          if (d.f !== 0) throw new Unsupported('division by a factorial');
          return mulL(L, [inv]);
        }
        return symPow(L, ast.b);
    }
    throw new Unsupported('node');
  }
  function symPow(L, exAst) {
    var E = sym(exAst), p = constOf(E);
    if (p !== null) {
      if (L.length === 0) return p > 0 ? [] : (function () { throw new Unsupported('0 to a power'); }());
      if (L.length === 1) {
        var t = L[0];
        if (t.c < 0 && p !== Math.floor(p)) throw new Unsupported('root of a negative');
        return [T(Math.pow(t.c, p), t.a * p, t.b * p, Math.pow(t.e, p), t.f * p, t.g * p)];
      }
      if (p === Math.floor(p) && p >= 0 && p <= 8) { var out = [T(1)], i; for (i = 0; i < p; i++) out = mulL(out, L); return out; }
      throw new Unsupported('power of a sum');
    }
    /* base^(expression in n): base must be a positive constant and the exponent c·n + d */
    var base = constOf(L);
    if (base !== null && base > 0) {
      var c = 1, e = 1;
      for (var j = 0; j < E.length; j++) {
        var u = E[j];
        if (isConst(u)) c *= Math.pow(base, u.c);
        else if (u.a === 1 && u.b === 0 && u.e === 1 && u.f === 0 && u.g === 0) e *= Math.pow(base, u.c);
        else throw new Unsupported('exponent');
      }
      return e === 1 ? [T(c)] : [T(c, 0, 0, e, 0)];
    }
    throw new Unsupported('variable exponent');
  }
  function dominantOf(L) {
    var best = null;
    L.forEach(function (t) { if (!best || cmpGrowth(t, best) > 0) best = t; });
    return best;
  }
  function growthKey(t) { return [t.f, Math.log(t.e), t.a, t.b, t.g]; }
  function cmpGrowth(x, y) {
    var a = growthKey(x), b = growthKey(y);
    for (var i = 0; i < 5; i++) { var d = a[i] - b[i]; if (Math.abs(d) > 1e-9) return d > 0 ? 1 : -1; }
    return 0;
  }
  function symFn(ast) {
    var A = sym(ast.a), exact = true;
    function single() {
      if (A.length === 1) return A[0];
      if (A.length === 0) throw new Unsupported('log of 0');
      approx = true; return dominantOf(A);
    }
    switch (ast.name) {
      case 'sqrt': return symPow(A, { t: 'num', v: 0.5 });
      case 'exp': return symPow([T(Math.E)], ast.a);
      default:
        var t = single(), lg = ast.name === 'ln' ? Math.LN2 : ast.name === 'log10' ? Math.LN2 / LN10 : 1;   /* log_b x = log2 x · (log_b 2) */
        if (t.c <= 0) throw new Unsupported('log of a non-positive');
        var out = [];
        if (t.g !== 0) throw new Unsupported('log of log log');
        if (t.f !== 0 && t.a === 0 && t.b === 0 && t.e === 1) out.push(T(t.f * lg, 1, 1));
        else if (t.b !== 0 && t.a === 0 && t.e === 1 && t.f === 0) {   /* log(c · (log n)^b) = b · log log n + log c */
          out.push(T(t.b * lg, 0, 0, 1, 0, 1));
          out.push(T(log2(t.c) * lg));
        }
        else if (t.b !== 0) throw new Unsupported('log of log');
        else {
          if (t.a !== 0) out.push(T(t.a * lg, 0, 1));
          if (t.e !== 1) out.push(T(log2(t.e) * lg, 1));
          if (t.f !== 0) out.push(T(t.f * lg, 1, 1));
          out.push(T(log2(t.c) * lg));
        }
        return combine(out);
    }
  }
  var approx = false;

  function fmtCoef(c) { var s = Math.abs(c) >= 1e6 || (Math.abs(c) < 1e-3 && c !== 0) ? c.toExponential(1).replace('e+', ' × 10^') : String(+c.toPrecision(4)); return s; }
  function powStr(a) {
    if (a === 1) return 'n';
    if (a === 0.5) return '√n';
    if (a === Math.floor(a) && a >= 2 && a <= 9) return 'n' + sup(a);
    if (a === Math.floor(a) && a < 0 && a >= -9) return 'n' + sup(a);
    return 'n' + '^' + +a.toPrecision(3);
  }
  function logStr(b) { return b === 1 ? 'log n' : b === Math.floor(b) && b <= 9 ? 'log' + sup(b) + ' n' : 'log^' + +b.toPrecision(3) + ' n'; }
  /* "5n² log n" for a term; the coefficient is dropped when 1 and the constant term shows just the number. */
  function termText(t, withCoef) {
    var parts = [];
    if (t.f) parts.push(t.f === 1 ? 'n!' : '(n!)' + sup(t.f));
    if (Math.abs(Math.log(t.e)) > 1e-9) parts.push((Math.abs(t.e - Math.round(t.e)) < 1e-9 ? String(Math.round(t.e)) : '(' + +t.e.toPrecision(3) + ')') + 'ⁿ');
    if (t.a) parts.push(powStr(t.a));
    if (t.b) parts.push(logStr(t.b));
    if (t.g) parts.push(t.g === 1 ? 'log log n' : '(log log n)' + sup(t.g));
    var body = parts.join(' ');
    if (withCoef === false) return body || '1';
    var c = t.c;
    if (!body) return fmtCoef(c);
    if (c === 1) return body;
    if (c === -1) return '−' + body;
    var cs = fmtCoef(c);
    return cs + (cs.indexOf('×') >= 0 ? ' ' : /^[n√]/.test(body) ? '' : /^[a-z]/.test(body) ? ' ' : ' · ') + body;
  }
  /* The growth class of a dominant term: { id (for badge colour), label }. */
  function classOfTerm(t) {
    if (t.f > 0) return { id: 'nfact', label: 'O(' + (t.f === 1 ? 'n!' : '(n!)' + sup(t.f)) + ')' };
    if (t.e > 1 + 1e-9) return { id: '2n', label: 'O(' + (Math.abs(t.e - Math.round(t.e)) < 1e-9 ? Math.round(t.e) : '(' + +t.e.toPrecision(3) + ')') + 'ⁿ' + (t.a || t.b || t.g ? ' ' + termText(T(1, t.a, t.b, 1, 0, t.g), false) : '') + ')' };
    if (t.e < 1 - 1e-9) return { id: '1', label: 'O(1)' };
    var a = t.a, b = t.b, g = t.g, s;
    if (a === 0 && b === 0 && g > 0) return { id: 'logn', label: 'O(' + termText(T(1, 0, 0, 1, 0, g), false) + ')' };
    if (a < 0 || (a === 0 && b === 0) || (a === 0 && b < 0)) return { id: '1', label: 'O(1)' };
    if (a === 0) return { id: 'logn', label: 'O(' + termText(T(1, 0, b, 1, 0, g), false) + ')' };
    s = termText(T(1, a, b, 1, 0, g), false);
    if (g !== 0) return { id: 'nk', label: 'O(' + s + ')' };
    if (a === 0.5 && b === 0) return { id: 'sqrtn', label: 'O(√n)' };
    if (a === 1 && b === 0) return { id: 'n', label: 'O(n)' };
    if (a === 1 && b === 1) return { id: 'nlogn', label: 'O(n log n)' };
    if (a === 2 && b === 0) return { id: 'n2', label: 'O(n²)' };
    if (a === 3 && b === 0) return { id: 'n3', label: 'O(n³)' };
    return { id: 'nk', label: 'O(' + s + ')' };
  }
  /* log10 |term(n)| without overflow. */
  function termLog10(t, n) {
    if (t.c === 0) return -Infinity;
    return Math.log10(Math.abs(t.c)) + t.a * Math.log10(n) + (t.b ? t.b * Math.log10(Math.max(log2(n), 1e-12)) : 0) + n * Math.log10(t.e) + t.f * lgamma(n + 1) / LN10
      + (t.g ? t.g * Math.log10(Math.max(log2(Math.max(log2(n), 1e-12)), 1e-12)) : 0);
  }
  function termValue(t, n) {
    var l = termLog10(t, n);
    if (l > 300) return t.c < 0 ? -Infinity : Infinity;
    return (t.c < 0 ? -1 : 1) * Math.pow(10, l);
  }

  /* Numeric fallback when the symbolic pass cannot express the formula: growth exponent between n = 4096 and 8192. */
  function numericClass(ast) {
    var n1 = 4096, y1 = evaluate(ast, n1), y2 = evaluate(ast, n1 * 2);
    if (!isFinite(y1) || !isFinite(y2) || y1 <= 0 || y2 <= 0) return { id: 'nfact', label: 'grows faster than any polynomial (or is undefined)' };
    var r = y2 / y1;
    if (r < 1.02) return { id: '1', label: 'O(1)' };
    if (r < 1.3) return { id: 'logn', label: 'O(log n)' };
    if (r < 1.5) return { id: 'sqrtn', label: 'O(√n)' };
    if (r < 2.1) return { id: 'n', label: 'O(n)' };
    if (r < 2.4) return { id: 'nlogn', label: 'O(n log n)' };
    if (r < 3.9) return { id: 'nk', label: '≈ O(n^' + +log2(r).toPrecision(2) + ')' };
    if (r < 4.2) return { id: 'n2', label: 'O(n²)' };
    if (r < 7.5) return { id: 'nk', label: '≈ O(n^' + +log2(r).toPrecision(2) + ')' };
    if (r < 8.5) return { id: 'n3', label: 'O(n³)' };
    if (r < 1000) return { id: 'nk', label: '≈ O(n^' + +log2(r).toPrecision(2) + ')' };
    return { id: '2n', label: 'exponential or worse' };
  }

  /* analyze(ast) → { terms, dominant (term), id, label, exact, dominantText, approx } */
  function analyze(ast) {
    approx = false;
    try {
      var L = sym(ast);
      if (!L.length) return { terms: [], dominant: null, id: '1', label: 'O(1)', dominantText: '0', exact: true, zero: true };
      var d = dominantOf(L), cls = classOfTerm(d);
      L.sort(function (x, y) { return cmpGrowth(y, x); });
      if (d.c < 0) return { terms: L, dominant: d, id: 'invalid', label: 'Not a valid cost', magnitudeLabel: cls.label, magnitudeId: cls.id, dominantText: termText(d), exact: !approx, negative: true };
      return { terms: L, dominant: d, id: cls.id, label: cls.label, dominantText: termText(d), exact: !approx, negative: false };
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      var c = numericClass(ast);
      return { terms: [], dominant: null, id: c.id, label: c.label, dominantText: '', exact: false, estimated: true, why: e.why };
    }
  }
  /* Human text for a term list: "3n² + 5n + 100". */
  function termsText(terms) {
    return terms.map(function (t, i) {
      var s = termText(t);
      if (i === 0) return s;
      return s.charAt(0) === '−' ? '− ' + s.slice(1) : '+ ' + s;
    }).join(' ');
  }
  /* Each term's share of the total (of absolute values) at n, largest first; null when values overflow. */
  function shares(terms, n) {
    var ls = terms.map(function (t) { return termLog10(t, n); });
    var mx = Math.max.apply(null, ls);
    if (!isFinite(mx)) return null;
    var w = ls.map(function (l) { return Math.pow(10, l - mx); }), sum = w.reduce(function (a, b) { return a + b; }, 0);
    return terms.map(function (t, i) { return { term: t, share: w[i] / sum, log10: ls[i] }; });
  }

  var api = {
    CLASSES: CLASSES, byId: byId, lgamma: lgamma, factorial: factorial, cap: cap, CAP: CAP,
    sup: sup, group: group, formatCount: formatCount, formatDuration: formatDuration, formatRatio: formatRatio, shape: shape,
    LOG_UNIVERSE: LOG_UNIVERSE,
    parseExpr: parseExpr, tryParse: tryParse, evaluate: evaluate, analyze: analyze, termsText: termsText, termText: termText,
    termLog10: termLog10, termValue: termValue, shares: shares
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_BIGO = api;
}(typeof window !== 'undefined' ? window : null));
