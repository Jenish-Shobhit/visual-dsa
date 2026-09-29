/* Lesson 02 · Bits, bytes & memory — figures, part 1.
   Pure generators live in js/algos/02-bits-and-memory.js (VDSA.algos.bits). Part 2 (addition lab, memory lab,
   flowchart, cost chart, variations, checks, summary) is js/lessons/02-bits-and-memory-lab.js.

   Figures here: hero teaser (light bulbs), the problem (raw vs mapped memory), intuition minis, the switch
   explorer, the binary odometer, the pattern tree, the 2ⁿ bar chart, byte → hex, one byte many meanings,
   the two's complement wheel, and the tape-vs-RAM race.

   Every custom figure follows the engine rule: build the SVG once, keep elements by id, and MOVE them. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, B = V.algos.bits;

  /* ================================================================== shared helpers */
  var L = V.lessons = V.lessons || {};
  var X = L.bits02 = {};

  /* Run fn once when el comes within ~500px of the viewport (heavy figures start lazily). */
  function lazy(el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function go() { if (done) return; done = true; try { fn(el); } catch (e) { console.error(e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); go(); }
    }, { rootMargin: '500px 0px 500px 0px' });
    io.observe(el);
  }
  function svg(W, H, cls, label) {
    var el = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'b2 ' + (cls || ''), role: 'img', 'aria-label': label || '' });
    el.style.maxWidth = Math.round(W * 1.3) + 'px';
    return el;
  }
  function setT(el, ms) { el.style.setProperty('--t', Math.max(0, ms || 0) + 'ms'); }
  function txt(x, y, str, cls, extra) { return s('text', Object.assign({ x: x, y: y, class: cls || '' }, extra || {}), str); }
  function cls(el, name, on) { el.classList.toggle(name, !!on); }
  /* Move an element along a quadratic arc (lift px above the straight line). Interrupt-safe. */
  function arcTo(el, to, ms, lift, delay) {
    var st = el.__arc || (el.__arc = { x: to.x, y: to.y });
    if (st.tw) st.tw.cancel();
    var fx = st.x, fy = st.y, cx = (fx + to.x) / 2, cy = Math.min(fy, to.y) - (lift || 30);
    function put(x, y) { st.x = x; st.y = y; el.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'); }
    st.tw = V.tween(V.dur(ms), function (t, e) {
      var u = 1 - e;
      put(u * u * fx + 2 * u * e * cx + e * e * to.x, u * u * fy + 2 * u * e * cy + e * e * to.y);
    }, { ease: 'inOut', delay: delay || 0 });
    return st.tw.promise;
  }
  /* Build a figure for the container's width class (narrow phones get their own layout at 1:1 scale, so text
     stays readable), rebuilding when the class changes. build(narrow) -> render(step, ctx). */
  function responsive(stage, build, narrowBelow) {
    var mode = null, render = null, last = null;
    function ensure() {
      var narrow = (stage.clientWidth || 800) < narrowBelow;
      if (narrow === mode) return false;
      mode = narrow; V.clear(stage); render = build(narrow);
      return true;
    }
    V.onResize(stage, function () { if (last && ensure()) render(last, { duration: 0, instant: true, prev: null, direction: 0, index: 0 }); });
    return function (step, ctx) {
      last = step;
      if (ensure()) ctx = Object.assign({}, ctx, { duration: 0, instant: true, prev: null });
      render(step, ctx);
    };
  }
  X.responsive = responsive;
  function placeAt(el, x, y) { var st = el.__arc || (el.__arc = {}); if (st.tw) st.tw.cancel(); st.x = x; st.y = y; el.setAttribute('transform', 'translate(' + x + ' ' + y + ')'); }
  function fmt(v) { return B.fmtNum(v); }
  function grey(v) { return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  /* VDSA.legend with working colour overrides: widgets.js assigns `--sw` through el.style['--sw'], which browsers
     ignore for custom properties, so a swatch's `color` never shows. Re-apply it with setProperty. */
  function legend(el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = V.$$('.legend__swatch', el);
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  }
  X.legend = legend;
  X.lazy = lazy; X.svg = svg; X.setT = setT; X.txt = txt; X.arcTo = arcTo; X.placeAt = placeAt;

  /* A tiny row of bit cells for minis and summary tiles. */
  function bitCells(bits, o) {
    o = o || {};
    var C = o.size || 22, P = C + (o.gap === undefined ? 4 : o.gap), W = bits.length * P - (P - C) + 8, H = C + (o.labels ? 18 : 8);
    var el = svg(W, H, 'b2-mini', o.label || ('Bits ' + bits.join('')));
    el.style.maxWidth = (W * (o.scale || 1.6)) + 'px';
    bits.forEach(function (b, i) {
      var g = s('g', { class: 'b2-cell' + (b ? ' is-on' : ''), transform: 'translate(' + (4 + i * P) + ' 4)' },
        s('rect', { width: C, height: C, rx: 5 }), txt(C / 2, C / 2 + 1, String(b), 'b2-cell__t'));
      if (o.labels) g.appendChild(txt(C / 2, C + 12, o.labels[i], 'b2-cell__l'));
      el.appendChild(g);
    });
    return el;
  }
  X.bitCells = bitCells;

  /* ================================================================== hero teaser: eight bulbs count */
  function bulbsView(stage) {
    var W = 400, H = 320, P = 44, X0 = (W - 7 * P) / 2, BY = 168;
    var el = svg(W, H, 'b2-bulbs', 'Eight bulbs counting in binary');
    el.setAttribute('aria-hidden', 'true');
    el.style.maxWidth = 'none';
    var dec = txt(28, 74, '0', 'b2-bulbs__dec'), decL = txt(30, 34, 'decimal', 'b2-bulbs__lab');
    var hexT = txt(W - 28, 74, '0x00', 'b2-bulbs__hex', { 'text-anchor': 'end' }), hexL = txt(W - 28, 34, 'hex', 'b2-bulbs__lab', { 'text-anchor': 'end' });
    var binT = txt(W / 2, 290, '0000 0000', 'b2-bulbs__bin', { 'text-anchor': 'middle' });
    [dec, decL, hexT, hexL, binT].forEach(function (t) { el.appendChild(t); });
    var wire = s('path', { class: 'b2-bulbs__wire', d: 'M' + (X0 - 16) + ' ' + (BY - 30) + 'H' + (X0 + 7 * P + 16) });
    el.appendChild(wire);
    var bulbs = [];
    for (var i = 0; i < 8; i++) {
      var x = X0 + i * P, pos = 7 - i;
      var g = s('g', { class: 'b2-bulb', transform: 'translate(' + x + ' ' + BY + ')' },
        s('line', { class: 'b2-bulb__stem', x1: 0, x2: 0, y1: -30, y2: -16 }),
        s('circle', { class: 'b2-bulb__glow', r: 23 }),
        s('circle', { class: 'b2-bulb__glass', r: 15 }),
        s('path', { class: 'b2-bulb__fil', d: 'M-5 3 Q-2.5 -5 0 3 Q2.5 -5 5 3' }),
        txt(0, 42, '0', 'b2-bulb__bit'),
        txt(0, 64, String(Math.pow(2, pos)), 'b2-bulb__place'));
      el.appendChild(g);
      bulbs.push({ g: g, bit: g.querySelector('.b2-bulb__bit'), pos: pos });
    }
    var carry = s('g', { class: 'b2-carry', opacity: 0 }, s('circle', { r: 8 }), txt(0, 1, '1', 'b2-carry__t'));
    el.appendChild(carry);
    placeAt(carry, X0 + 7 * P, BY - 48);
    stage.appendChild(el);
    var shownValue = 0;
    return function render(step, ctx) {
      var d = ctx.duration, v = step.value, bits = B.bitsOf(v, 8);
      setT(el, Math.max(120, d * 0.5));
      var flips = step.flips || [], n = flips.length, gap = n ? d / (n + 1) : 0;
      bulbs.forEach(function (b, i) {
        var k = flips.indexOf(b.pos);
        b.g.style.setProperty('--delay', (ctx.instant || k < 0 ? 0 : Math.round(k * gap)) + 'ms');
        cls(b.g, 'is-on', bits[i]);
        b.bit.textContent = bits[i];
      });
      dec.textContent = v; hexT.textContent = B.hex(v, 2); binT.textContent = B.bin(v, 8);
      if (!ctx.instant && n > 1 && ctx.direction >= 0 && d > 0) {
        var last = flips[n - 1], fromX = X0 + 7 * P, toX = X0 + (7 - Math.min(7, step.carryOut ? 7 : last)) * P;
        placeAt(carry, fromX, BY - 48);
        carry.setAttribute('opacity', 1);
        V.animate(carry, {}, { duration: 0 });
        arcTo(carry, { x: step.carryOut ? X0 - 30 : toX, y: BY - 48 }, d * 0.9, 6).then(function (ok) { if (ok) carry.setAttribute('opacity', 0); });
      } else carry.setAttribute('opacity', 0);
      cls(el, 'is-overflow', !!step.carryOut && !ctx.instant);
      shownValue = v;
    };
  }
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var laps = [[0, 9], [13, 5], [125, 5], [251, 5]], lap = 0;
    function data() {
      var L0 = laps[lap % laps.length]; lap++;
      return B.counterSteps(8, L0[0], L0[1]);
    }
    V.teaser(stage, { steps: data(), render: bulbsView(stage), stepMs: 820, holdMs: 1500, regenerate: data, instantWrap: true, staticIndex: 5 });
  }

  /* ================================================================== the problem: raw bytes vs the program's map */
  var PROBLEM = {
    bytes: [0x41, 0, 0, 0, 0x41, 0xFB, 0xFF, 0x9C, 0x42, 0x6F, 0x62, 0x00, 0xFF, 0x88, 0x00, 0x3D],
    vars: [
      { name: 'score', type: 'int', from: 0, to: 3, reading: 'score = 65', chip: 'int' },
      { name: 'grade', type: 'char', from: 4, to: 4, reading: "grade = 'A'", chip: 'char' },
      { name: 'temp', type: 'short', from: 5, to: 6, reading: 'temp = −5', chip: 'short' },
      { name: 'name', type: 'char[4]', from: 8, to: 11, reading: 'name = "Bob"', chip: 'char[4]' },
      { name: 'colour', type: 'RGB', from: 12, to: 14, reading: 'colour = ', chip: 'RGB', swatch: 'rgb(255,136,0)' }
    ]
  };
  function problemFigure() {
    var fig = V.$('#fig-problem');
    var stage = fig.querySelector('[data-stage]'), out = fig.querySelector('[data-decoded]');
    legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Byte in use' }, { state: 'muted', label: 'Leftover byte' }]);
    var view = V.views.memory(stage, { mode: 'ram', perRow: 8, addrDigits: 3, label: 'Sixteen bytes of memory', format: function (v) { return B.hexByte(v); } });
    function state(mapped) {
      var owned = {};
      PROBLEM.vars.forEach(function (v) { for (var i = v.from; i <= v.to; i++) owned[i] = true; });
      return {
        base: 0x100,
        cells: PROBLEM.bytes.map(function (b, i) { return { value: b, state: mapped && !owned[i] ? 'muted' : 'default' }; }),
        vars: mapped ? PROBLEM.vars.map(function (v) { return { name: v.from === v.to ? v.name : v.name + ' : ' + v.type, from: v.from, to: v.to }; }) : []
      };
    }
    view.prepare([state(true)]);
    function show(mapped, dur) {
      view.render(state(mapped), { duration: dur });
      V.clear(out);
      if (!mapped) { out.appendChild(h('p', { class: 'decode-row__hint' }, 'Just bytes. Where does one value end and the next begin? Switch on the program’s map.')); return; }
      PROBLEM.vars.forEach(function (v) {
        out.appendChild(h('span', { class: 'decode-chip' }, h('span', { class: 'decode-chip__type' }, v.chip), v.reading,
          v.swatch ? h('span', { class: 'swatch', style: { background: v.swatch } }) : null));
      });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'View', value: 'raw',
      options: [{ value: 'raw', label: 'Raw bytes' }, { value: 'map', label: 'With the program’s map' }],
      onChange: function (v) { show(v === 'map', 600); } });
    show(false, 0);
    V.quiz('#quiz-meaning', {
      question: 'Memory holds the byte <code>0100 0001</code> (hex <code>41</code>). What does it mean?',
      options: ['The number 65', 'The letter A', 'It depends on what the program agreed to store there', 'Nothing: bytes only mean something once they are printed'],
      answer: 2,
      explain: [
        'It is 65 if the program reads it as a number, but the same byte in the figure is also a letter.',
        'ASCII reads 65 as A, but that is only one agreement. Inside score, the same byte is part of the number 65.',
        'Right. Bits carry no label. The program’s types decide whether 41 is a number, a letter, part of a colour or part of a bigger number.',
        'Bytes mean something whenever a program reads them, printed or not. What they mean depends on the agreement.'
      ],
      id: 'b02-meaning'
    });
  }

  /* ================================================================== intuition minis */
  function intuitionMinis() {
    var row = V.$('#mini-intuition');
    // 1. one switch
    var sw = svg(170, 80, 'b2-mini', 'A switch off, meaning 0, and on, meaning 1');
    [[0, 30], [1, 110]].forEach(function (p) {
      var g = s('g', { class: 'b2-sw' + (p[0] ? ' is-on' : ''), transform: 'translate(' + p[1] + ' 8)' },
        s('rect', { class: 'b2-sw__track', x: 0, y: 0, width: 30, height: 48, rx: 15 }),
        s('circle', { class: 'b2-sw__knob', cx: 15, cy: p[0] ? 15 : 33, r: 11 }),
        txt(15, 68, p[0] ? '1 = on' : '0 = off', 'b2-sw__l'));
      sw.appendChild(g);
    });
    // 2. a byte
    var byte = bitCells([0, 1, 0, 0, 0, 0, 0, 1], { size: 20, labels: ['128', '64', '32', '16', '8', '4', '2', '1'], label: 'Eight switches 0100 0001 make one byte' });
    // 3. lockers
    var lk = svg(230, 96, 'b2-mini', 'Five lockers numbered 0x100 to 0x104; a note says score is locker 0x100');
    for (var i = 0; i < 5; i++) {
      var g = s('g', { class: 'b2-locker' + (i === 0 ? ' is-named' : ''), transform: 'translate(' + (8 + i * 44) + ' 30)' },
        s('rect', { width: 38, height: 44, rx: 5 }), s('circle', { cx: 30, cy: 22, r: 2.2, class: 'b2-locker__knob' }),
        txt(19, 60, B.hex(0x100 + i, 3), 'b2-locker__n'));
      lk.appendChild(g);
    }
    lk.appendChild(s('g', { class: 'b2-note', transform: 'translate(14 4) rotate(-6)' }, s('rect', { width: 52, height: 20, rx: 3 }), txt(26, 14, 'score', 'b2-note__t')));
    [[sw, '<b>A bit</b> is one switch: off or on, 0 or 1.'], [byte, '<b>Eight switches</b> make a byte: 256 possible patterns.'], [lk, '<b>Numbered lockers</b> are memory: the number is the address.']].forEach(function (it) {
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, it[0]), h('figcaption', { html: it[1] })));
    });
  }

  /* ================================================================== the switch explorer */
  var TARGETS = [42, 99, 170, 7, 128, 200, 77, 255];
  function switchesFigure() {
    var fig = V.$('#fig-switches'), stage = fig.querySelector('[data-stage]');
    legend(fig.querySelector('[data-legend]'), [{ state: 'default', label: '1: switch on', color: 'var(--accent)' }, { state: 'default', shape: 'outline', label: '0: switch off' }]);
    var value = 0;
    var wrap = h('div', { class: 'sw' });
    var rowEl = h('div', { class: 'sw__row', role: 'group', 'aria-label': 'Eight bits, most significant first' });
    var btns = [];
    for (var i = 0; i < 8; i++) {
      (function (pos) {
        var place = Math.pow(2, pos);
        var b = h('button', { type: 'button', class: 'sw__bit', 'aria-pressed': 'false' },
          h('span', { class: 'sw__place' }, String(place)),
          h('span', { class: 'sw__toggle', 'aria-hidden': 'true' }, h('span', { class: 'sw__knob' })),
          h('span', { class: 'sw__digit', 'aria-hidden': 'true' }, '0'));
        b.addEventListener('click', function () { set(value ^ place, 'user'); });
        rowEl.appendChild(b);
        btns.push({ el: b, pos: pos, place: place, digit: b.querySelector('.sw__digit') });
      }(7 - i));
    }
    var sum = h('p', { class: 'sw__sum', 'aria-hidden': 'true' });
    function card(label, cls2) { var v = h('span', { class: 'sw-card__v' }), sub = h('span', { class: 'sw-card__s' }); return { el: h('div', { class: 'sw-card ' + (cls2 || '') }, h('span', { class: 'sw-card__k' }, label), v, sub), v: v, sub: sub }; }
    var cDec = card('Decimal', 'sw-card--big'), cHex = card('Hex'), cSig = card('Signed'), cChr = card('ASCII'), cCol = card('As a grey level');
    var swatch = h('span', { class: 'sw-swatch' });
    cCol.v.appendChild(swatch);
    var cards = h('div', { class: 'sw__cards', 'aria-live': 'polite' }, cDec.el, cHex.el, cSig.el, cChr.el, cCol.el);
    var tools = h('div', { class: 'btn-row sw__tools' },
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { set(0, 'user'); } }, 'All off'),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { set(B.wrap(value + 1, 8), 'user'); } }, '+1'),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { set(B.wrap(value - 1, 8), 'user'); } }, '−1'),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { set(value ^ 32, 'user'); } }, 'Flip case (32)'),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { set(Math.floor(Math.random() * 256), 'user'); } }, 'Random'));
    wrap.appendChild(rowEl); wrap.appendChild(sum); wrap.appendChild(cards); wrap.appendChild(tools);
    stage.appendChild(wrap);

    function set(v, why) {
      value = B.wrap(v, 8);
      var bits = B.bitsOf(value, 8), terms = [];
      btns.forEach(function (b, i) {
        var on = !!bits[i];
        b.el.classList.toggle('is-on', on);
        b.el.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.el.setAttribute('aria-label', 'Bit worth ' + b.place + ': ' + (on ? 'on' : 'off'));
        b.digit.textContent = bits[i];
        if (on) terms.push(b.place);
      });
      V.clear(sum);
      if (!terms.length) sum.appendChild(h('span', { class: 'sw__term is-zero' }, 'all off = 0'));
      terms.forEach(function (t, k) { if (k) sum.appendChild(document.createTextNode(' + ')); sum.appendChild(h('span', { class: 'sw__term' }, String(t))); });
      if (terms.length > 1) sum.appendChild(document.createTextNode(' = ' + value));
      else if (terms.length === 1) sum.appendChild(document.createTextNode(' = ' + value));
      cDec.v.textContent = value; cDec.sub.textContent = B.bin(value, 8);
      cHex.v.textContent = B.hex(value, 2); cHex.sub.textContent = B.bin(value >> 4, 4, 0) + ' → ' + B.HEX[value >> 4] + ', ' + B.bin(value & 15, 4, 0) + ' → ' + B.HEX[value & 15];
      var sg = B.toSigned(value, 8);
      cSig.v.textContent = fmt(sg); cSig.sub.textContent = value >= 128 ? 'top bit on: ' + value + ' − 256' : 'top bit off: same as unsigned';
      var ch = B.charName(value);
      cChr.v.textContent = ch === null ? '—' : ch.length === 1 ? ch : ch.split(' ')[0];
      cChr.v.classList.toggle('is-word', !(ch && ch.length === 1));
      cChr.sub.textContent = ch === null ? 'not ASCII (128–255)' : ch.length === 1 || ch === 'space' ? 'character code ' + value : 'control code ' + value + (ch.indexOf('(') > 0 ? ' ' + ch.slice(ch.indexOf('(')) : '');
      swatch.style.background = grey(value);
      cCol.sub.textContent = value + ' / 255 brightness';
      if (why === 'user' && challenge) challenge.onChange(value);
    }
    var challenge = makeChallenge(fig.querySelector('[data-challenge]'), function () { return value; });
    set(0);
  }
  /* "Set the switches to make N" — a check registered with the page score. */
  function makeChallenge(host, getValue) {
    var id = 'b02-make-42', ti = 0, target = TARGETS[0], solvedThis = false, attemptsThis = 0;
    V.quizScore.register(id);
    var q = h('p', { class: 'sw-challenge__q' });
    var fb = h('p', { class: 'sw-challenge__fb', 'aria-live': 'polite' });
    var check = h('button', { type: 'button', class: 'btn btn--primary btn--sm' }, 'Check');
    var next = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', hidden: true }, 'Another target');
    host.appendChild(h('span', { class: 'sw-challenge__kicker' }, h('i', { class: 'ico', 'data-ico': 'target', 'aria-hidden': 'true' }), 'Challenge'));
    host.appendChild(q); host.appendChild(h('div', { class: 'btn-row' }, check, next)); host.appendChild(fb);
    function render() { q.innerHTML = 'Set the switches to make <b>' + target + '</b>.'; fb.textContent = ''; fb.className = 'sw-challenge__fb'; next.hidden = true; solvedThis = false; attemptsThis = 0; }
    check.addEventListener('click', function () {
      var v = getValue(), ok = v === target;
      attemptsThis++;
      if (ti === 0) V.quizScore.record(id, ok);
      fb.className = 'sw-challenge__fb ' + (ok ? 'is-good' : 'is-bad');
      if (ok) {
        var parts = []; [128, 64, 32, 16, 8, 4, 2, 1].forEach(function (p) { if (target & p) parts.push(p); });
        fb.innerHTML = '<b>Correct.</b> ' + target + ' = ' + parts.join(' + ') + ', so the switches worth ' + parts.join(', ') + ' are on: <code>' + B.bin(target, 8) + '</code>.';
        solvedThis = true; next.hidden = false;
      } else {
        var diff = target - v;
        fb.innerHTML = '<b>Not yet:</b> the switches make ' + v + ', ' + Math.abs(diff) + (diff > 0 ? ' too few' : ' too many') + '. Hint: start with the largest place that still fits, ' + [128, 64, 32, 16, 8, 4, 2, 1].filter(function (p) { return p <= target; })[0] + ', then fill in the rest.';
      }
    });
    next.addEventListener('click', function () { ti = (ti + 1) % TARGETS.length; if (ti === 0) ti = 1; target = TARGETS[ti]; render(); });
    render();
    return { onChange: function () { if (!solvedThis && fb.textContent) { fb.textContent = ''; fb.className = 'sw-challenge__fb'; } } };
  }

  /* ================================================================== binary odometer */
  function odometerView(stage) {
    var W = 560, H = 236, DW = 52, GAP = 10, X0 = (W - (8 * DW + 7 * GAP)) / 2, WY = 78, WH = 62;
    var el = svg(W, H, 'b2-odo', 'Binary odometer with eight digit wheels');
    var defs = s('defs'); el.appendChild(defs);
    var drums = [];
    for (var i = 0; i < 8; i++) {
      var pos = 7 - i, x = X0 + i * (DW + GAP), cid = V.uid('odo');
      defs.appendChild(s('clipPath', { id: cid }, s('rect', { x: 0, y: 0, width: DW, height: WH, rx: 9 })));
      var strip = s('g', { class: 'b2-odo__strip' }, txt(DW / 2, WH / 2, '0', 'b2-odo__d'), txt(DW / 2, WH / 2 + WH, '1', 'b2-odo__d is-one'), txt(DW / 2, WH / 2 + 2 * WH, '0', 'b2-odo__d'));
      var g = s('g', { class: 'b2-odo__drum', transform: 'translate(' + x + ' ' + WY + ')' },
        s('rect', { class: 'b2-odo__win', x: 0, y: 0, width: DW, height: WH, rx: 9 }),
        s('g', { 'clip-path': 'url(#' + cid + ')' }, strip),
        s('rect', { class: 'b2-odo__shade', x: 0, y: 0, width: DW, height: WH, rx: 9 }),
        s('rect', { class: 'b2-odo__ring', x: -3, y: -3, width: DW + 6, height: WH + 6, rx: 11 }));
      el.appendChild(txt(x + DW / 2, WY - 16, String(Math.pow(2, pos)), 'b2-odo__place'));
      el.appendChild(txt(x + DW / 2, WY + WH + 22, 'bit ' + pos, 'b2-odo__idx'));
      el.appendChild(g);
      V.place(strip, { y: 0 });
      drums.push({ g: g, strip: strip, pos: pos, x: x, bit: 0 });
    }
    var lost = s('g', { class: 'b2-odo__lost', opacity: 0 }, txt(0, 0, 'carry lost', 'b2-odo__lostt', { 'text-anchor': 'middle' }));
    placeAt(lost, X0 - 4 + DW / 2 - 30, WY - 42);
    el.appendChild(lost);
    var chips = [];
    for (var c = 0; c < 8; c++) {
      var chip = s('g', { class: 'b2-chip', opacity: 0 }, s('circle', { r: 10 }), txt(0, 1, '1', 'b2-chip__t'));
      el.appendChild(chip); chips.push(chip);
    }
    var readout = txt(W / 2, H - 14, '= 0', 'b2-odo__read', { 'text-anchor': 'middle' });
    el.appendChild(readout);
    stage.appendChild(el);
    function drumX(pos) { return X0 + (7 - pos) * (DW + GAP) + DW / 2; }
    function setBit(d, b) { d.bit = b; V.place(d.strip, { y: -b * WH }); d.g.classList.toggle('is-one', !!b); }
    return function render(step, ctx) {
      var dur = ctx.duration, prev = ctx.prev;
      setT(el, dur);
      var bits = step.bits;
      var single = prev && !ctx.instant && dur > 0 && Math.abs(step.incs - prev.incs) === 1;
      drums.forEach(function (d) { d.g.classList.remove('is-flip'); });
      chips.forEach(function (ch) { ch.setAttribute('opacity', 0); });
      el.classList.remove('is-overflow');
      lost.setAttribute('opacity', 0);
      readout.textContent = '= ' + step.value;
      if (!single) {
        drums.forEach(function (d, i) { setBit(d, bits[i]); });
        (step.flips || []).forEach(function (p) { drums[7 - p].g.classList.add('is-flip'); });
        if (step.carryOut) { el.classList.add('is-overflow'); lost.setAttribute('opacity', 1); }
        return;
      }
      var forward = step.incs > prev.incs;
      var flips = forward ? step.flips : prev.flips.slice().reverse();
      var n = flips.length, per = dur / Math.max(1, n), rollDur = Math.max(per * 1.1, Math.min(dur, 160));
      flips.forEach(function (p, k) {
        var d = drums[7 - p], delay = k * per * 0.85;
        var to = bits[7 - p];
        d.g.classList.add('is-flip');
        d.g.style.setProperty('--delay', Math.round(delay) + 'ms');
        if (forward) {
          if (to === 0) { // 1 -> 0 rolls on to the second 0, then snaps back
            V.animate(d.strip, { y: -2 * WH }, { duration: rollDur, delay: delay, ease: 'inOut' }).then(function (ok) { if (ok) V.place(d.strip, { y: 0 }); });
            var chip = chips[p];
            if (p < 7 || step.carryOut) {
              placeAt(chip, drumX(p), WY - 16);
              chip.setAttribute('opacity', 0);
              setTimeout(function () { chip.setAttribute('opacity', 1); }, V.dur(delay));
              arcTo(chip, { x: p < 7 ? drumX(p + 1) : drumX(7) - 70, y: WY - 16 }, rollDur, 16, delay).then(function (ok) { if (ok) chip.setAttribute('opacity', 0); });
            }
          } else V.animate(d.strip, { y: -WH }, { duration: rollDur, delay: delay, ease: 'inOut' });
        } else {
          if (to === 1) { V.place(d.strip, { y: -2 * WH }); V.animate(d.strip, { y: -WH }, { duration: rollDur, delay: delay, ease: 'inOut' }); }
          else V.animate(d.strip, { y: 0 }, { duration: rollDur, delay: delay, ease: 'inOut' });
        }
        d.bit = to;
        d.g.classList.toggle('is-one', !!to);
      });
      if (forward && step.carryOut) setTimeout(function () { el.classList.add('is-overflow'); lost.setAttribute('opacity', 1); }, V.dur(dur * 0.9));
    };
  }
  function odometerFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'swap', shape: 'ring', label: 'Flipped by this +1' }, { state: 'key', shape: 'dot', label: 'Carry' }, { state: 'error', label: 'Overflow' }]);
    var steps = B.counterSteps(8, 0, 256);
    var speeds = [0.5, 1, 2, 4, 8, 16];
    var player = V.player({
      root: fig, steps: steps, render: odometerView(fig.querySelector('[data-stage]')),
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { value: 'Value', flips: 'Flipped this step', total: 'Total flips', avg: 'Average per +1' },
      counterStates: { flips: 'swap' },
      baseStepMs: 1000, speeds: speeds, speed: 1, label: 'Odometer controls'
    });
    var slider = V.slider(fig.querySelector('[data-speed]'), { label: 'Speed', min: 0, max: speeds.length - 1, value: 1,
      format: function (i) { return speeds[i] + '×'; }, onInput: function (i) { player.setSpeed(speeds[i]); } });
    player.on('speed', function (sp) { var i = speeds.indexOf(sp); if (i >= 0) slider.set(i); });
    var jumps = fig.querySelector('[data-jumps]');
    [['Start at 0', 0], ['7 → 8', 7], ['15 → 16', 15], ['127 → 128', 127], ['255 → 0', 255]].forEach(function (j) {
      jumps.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { player.pause(); player.goto(j[1]); } }, j[0]));
    });
  }

  /* ================================================================== the pattern tree */
  function treeView(stage) {
    var W = 440, H = 356, TOP = 34, HH = 306, DX = 78, X0 = 26;
    var el = svg(W, H, 'b2-tree', 'Decode tree of bit patterns');
    el.style.maxWidth = '520px';
    var gE = s('g'), gN = s('g'), gL = s('g');
    el.appendChild(gE); el.appendChild(gN); el.appendChild(gL);
    var heads = [];
    for (var d = 1; d <= 4; d++) { var ht = txt(X0 + d * DX, 16, 'bit ' + d, 'b2-tree__head', { 'text-anchor': 'middle', opacity: 0 }); el.appendChild(ht); heads.push(ht); }
    var count = txt(4, H - 10, '', 'b2-tree__count', { 'text-anchor': 'start' });
    el.appendChild(count);
    stage.appendChild(el);
    var recs = {};
    function pos(id) {
      var dd = id.length, idx = dd ? parseInt(id, 2) : 0;
      return { x: X0 + dd * DX, y: TOP + (idx + 0.5) * HH / Math.pow(2, dd) };
    }
    function make(id) {
      var r = { id: id };
      r.edge = id.length ? s('path', { class: 'b2-tree__edge' }) : null;
      r.elab = id.length ? txt(0, 0, id.slice(-1), 'b2-tree__elab', { 'text-anchor': 'middle' }) : null;
      r.node = s('circle', { class: 'b2-tree__node', r: id.length ? 5.5 : 7 });
      r.lab = txt(0, 0, id || 'start', 'b2-tree__lab', { dy: '.35em' });
      if (r.edge) { gE.appendChild(r.edge); gE.appendChild(r.elab); }
      gN.appendChild(r.node); gL.appendChild(r.lab);
      return r;
    }
    function paint(r) {
      var c = r.cur;
      r.node.setAttribute('cx', c.x.toFixed(1)); r.node.setAttribute('cy', c.y.toFixed(1));
      r.node.setAttribute('opacity', c.o.toFixed(3));
      r.lab.setAttribute('x', (c.x + 11).toFixed(1)); r.lab.setAttribute('y', c.y.toFixed(1));
      r.lab.setAttribute('opacity', (c.o * c.lo).toFixed(3));
      if (r.edge) {
        var p = recs[r.id.slice(0, -1)], px = p ? p.cur.x : c.x, py = p ? p.cur.y : c.y;
        var mx = (px + c.x) / 2;
        r.edge.setAttribute('d', 'M' + px.toFixed(1) + ' ' + py.toFixed(1) + 'C' + mx.toFixed(1) + ' ' + py.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + c.x.toFixed(1) + ' ' + c.y.toFixed(1));
        r.edge.setAttribute('opacity', c.o.toFixed(3));
        r.elab.setAttribute('x', (c.x - 13).toFixed(1)); r.elab.setAttribute('y', (c.y + (r.id.slice(-1) === '0' ? -5 : 11)).toFixed(1));
        r.elab.setAttribute('opacity', (c.o * c.eo).toFixed(3));
      }
    }
    var tw = null;
    return function render(step, ctx) {
      var dur = ctx.duration, k = step.bits;
      setT(el, dur);
      var want = {};
      step.nodes.forEach(function (n) { want[n.id] = n; });
      Object.keys(want).forEach(function (id) {
        var n = want[id], r = recs[id], p = pos(id), leaf = n.depth === k;
        var target = { x: p.x, y: p.y, o: 1, lo: leaf || id === '' && k === 0 ? 1 : 0, eo: id.length < 4 ? 1 : 0 };
        if (!r) {
          r = recs[id] = make(id);
          var par = recs[id.slice(0, -1)];
          r.cur = par && !ctx.instant ? { x: par.cur.x, y: par.cur.y, o: 0, lo: 0, eo: 0 } : Object.assign({}, target);
        }
        r.from = Object.assign({}, r.cur); r.to = target; r.dead = false;
        r.node.setAttribute('class', 'b2-tree__node' + (n.fresh ? ' is-fresh' : '') + (leaf ? ' is-leaf' : ''));
        if (r.edge) r.edge.setAttribute('class', 'b2-tree__edge' + (n.fresh ? ' is-fresh' : ''));
        r.lab.setAttribute('class', 'b2-tree__lab' + (leaf && k ? ' is-leaf' : ''));
        r.lab.textContent = id || (k ? '' : 'start');
      });
      Object.keys(recs).forEach(function (id) {
        if (want[id]) return;
        var r = recs[id], par = recs[id.slice(0, -1)];
        r.from = Object.assign({}, r.cur); r.to = { x: par ? par.to.x : r.cur.x, y: par ? par.to.y : r.cur.y, o: 0, lo: 0, eo: 0 }; r.dead = true;
      });
      heads.forEach(function (ht, i) { ht.setAttribute('opacity', i < k ? 1 : 0); });
      count.textContent = k ? '2' + ['', '¹', '²', '³', '⁴'][k] + ' = ' + step.count + ' patterns' : '1 possibility';
      if (tw) tw.cancel();
      var list = Object.keys(recs).map(function (id) { return recs[id]; });
      function frame(e) {
        list.forEach(function (r) { ['x', 'y', 'o', 'lo', 'eo'].forEach(function (q) { r.cur[q] = r.from[q] + (r.to[q] - r.from[q]) * e; }); });
        list.forEach(paint);
      }
      tw = V.tween(dur, function (t, e) { frame(e); });
      tw.promise.then(function (ok) {
        if (!ok) return;
        list.forEach(function (r) { if (r.dead && recs[r.id] === r) { [r.edge, r.elab, r.node, r.lab].forEach(function (x) { if (x) x.remove(); }); delete recs[r.id]; } });
      });
    };
  }
  function treeFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'dot', label: 'New this step' }, { state: 'default', shape: 'dot', label: 'Earlier choices' }]);
    V.player({ root: fig, steps: B.patternSteps(4), render: treeView(fig.querySelector('[data-stage]')), caption: fig.querySelector('[data-caption]'), baseStepMs: 1400, label: 'Pattern tree controls' });
  }

  /* ================================================================== 2ⁿ bar chart */
  function growthFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Values that fit (2ⁿ)' }]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', label: 'Values that fit in n bits', height: 280,
      valueFormat: function (v) { return v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v).toLocaleString('en-US'); } });
    var cap = fig.querySelector('[data-caption]');
    var small = { categories: ['1 bit', '2', '3', '4', '5', '6', '7', '8 bits'], series: [{ id: 'n', label: 'values', values: [2, 4, 8, 16, 32, 64, 128, 256], state: 'active' }], y: { label: 'different values', min: 0, max: 256 } };
    var big = { categories: ['8 bits', '16 bits', '24 bits', '32 bits'], series: [{ id: 'n', label: 'values', values: [256, 65536, 16777216, 4294967296], state: 'active' }], y: { label: 'different values', min: 0 } };
    var caps = {
      small: 'Each bar is twice the one before: one more bit, twice the patterns. Eight bits reach <b>256</b>.',
      big: 'Every 8 more bits multiply the count by 256. The 8-bit bar (256) and even the 16-bit bar (65,536) vanish next to <b>4,294,967,296</b> for 32 bits.'
    };
    function show(which, dur) { chart.render(which === 'big' ? big : small, { duration: dur }); cap.innerHTML = caps[which]; }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Range', value: 'small', options: [{ value: 'small', label: '1 to 8 bits' }, { value: 'big', label: '8, 16, 24, 32 bits' }], onChange: function (v) { show(v, 800); } });
    show('small', 0);
  }

  /* ================================================================== byte → hex */
  function hexView(stage) { return responsive(stage, function (narrow) { return hexBuild(stage, narrow); }, 470); }
  function hexBuild(stage, narrow) {
    var W = narrow ? 350 : 560, H = narrow ? 356 : 312, C = narrow ? 34 : 40, P = narrow ? 38 : 46, Y = 30, GAP = narrow ? 12 : 20;
    var el = svg(W, H, 'b2-hex' + (narrow ? ' is-narrow' : ''), 'A byte converted to two hex digits');
    function bitX(i, split) { var base = (W - (8 * P - (P - C))) / 2; return base + i * P + (split ? (i < 4 ? -GAP : GAP) : 0); }
    var cells = [], places = [];
    for (var i = 0; i < 8; i++) {
      var g = s('g', { class: 'b2-cell b2-hex__bit' }, s('rect', { width: C, height: C, rx: 7 }), txt(C / 2, C / 2 + 1, '0', 'b2-cell__t'));
      el.appendChild(g); V.place(g, { x: bitX(i, false), y: Y });
      var pl = txt(0, 0, String([8, 4, 2, 1][i % 4]), 'b2-hex__place', { 'text-anchor': 'middle', opacity: 0 });
      el.appendChild(pl); V.place(pl, { x: bitX(i, true) + C / 2, y: Y + C + 20 });
      cells.push(g); places.push(pl);
    }
    var brackets = [0, 1].map(function (k) {
      var g = s('g', { class: 'b2-hex__br', opacity: 0 }, s('path', { d: 'M0 0 V-6 H' + (4 * P - (P - C)) + ' V0' }), txt((4 * P - (P - C)) / 2, -12, k ? 'low nibble' : 'high nibble', 'b2-hex__brt', { 'text-anchor': 'middle' }));
      el.appendChild(g); V.place(g, { x: bitX(k * 4, true), y: Y - 4 });
      return g;
    });
    var sums = [0, 1].map(function (k) { var t = txt(0, 0, '', 'b2-hex__sum', { 'text-anchor': 'middle', opacity: 0 }); el.appendChild(t); V.place(t, { x: bitX(k * 4, true) + (4 * P - (P - C)) / 2, y: Y + C + 46 }); return t; });
    var digits = [0, 1].map(function (k) {
      var g = s('g', { class: 'b2-hex__digit', opacity: 0 }, s('rect', { x: -22, y: -24, width: 44, height: 44, rx: 10 }), txt(0, 0, '0', 'b2-hex__dt'));
      el.appendChild(g); V.place(g, { x: bitX(k * 4, true) + (4 * P - (P - C)) / 2, y: Y + C + 86 });
      return g;
    });
    var joined = txt(W / 2, Y + C + 150, '', 'b2-hex__join', { 'text-anchor': 'middle', opacity: 0 });
    el.appendChild(joined);
    var strip = [], perRow = narrow ? 8 : 16, KP = narrow ? 42 : 33, KW = narrow ? 38 : 30, SX = (W - perRow * KP + (KP - KW)) / 2, SY = H - (narrow ? 96 : 50);
    for (var d = 0; d < 16; d++) {
      var kx = SX + (d % perRow) * KP, ky = SY + Math.floor(d / perRow) * 48;
      var sg = s('g', { class: 'b2-hex__key', transform: 'translate(' + kx + ' ' + ky + ')' }, s('rect', { width: KW, height: 42, rx: 6 }), txt(KW / 2, 16, B.HEX[d], 'b2-hex__kd'), txt(KW / 2, 33, B.bin(d, 4, 0), 'b2-hex__kb'));
      el.appendChild(sg); strip.push(sg);
    }
    stage.appendChild(el);
    var ORDER = ['byte', 'split', 'places', 'hi', 'lo', 'join'];
    return function render(step, ctx) {
      var d = ctx.duration, ph = ORDER.indexOf(step.phase);
      setT(el, d);
      step.bits.forEach(function (b, i) {
        cells[i].querySelector('text').textContent = b;
        cells[i].setAttribute('class', 'b2-cell b2-hex__bit' + (b ? ' is-on' : '') + ((ph === 3 && i < 4) || (ph === 4 && i >= 4) ? ' is-focus' : ''));
        V.animate(cells[i], { x: bitX(i, ph >= 1), y: Y }, { duration: d, ease: 'inOut' });
        V.animate(places[i], { opacity: ph >= 2 ? 1 : 0 }, { duration: d });
        places[i].setAttribute('class', 'b2-hex__place' + (ph >= 2 && b ? ' is-on' : ''));
      });
      brackets.forEach(function (g) { V.animate(g, { opacity: ph >= 1 ? 1 : 0 }, { duration: d }); });
      var vals = [step.hi, step.lo];
      [0, 1].forEach(function (k) {
        var shown = ph >= 3 + k;
        var parts = []; [8, 4, 2, 1].forEach(function (p) { if (vals[k] & p) parts.push(p); });
        sums[k].textContent = parts.length > 1 ? parts.join(' + ') + ' = ' + vals[k] : parts.length ? String(vals[k]) : 'all 0 = 0';
        V.animate(sums[k], { opacity: shown ? 1 : 0 }, { duration: d });
        digits[k].querySelector('text').textContent = B.HEX[vals[k]];
        digits[k].setAttribute('class', 'b2-hex__digit' + (ph === 3 + k ? ' is-focus' : ''));
        V.animate(digits[k], { opacity: shown ? 1 : 0, scale: shown ? 1 : 0.6 }, { duration: d, ease: 'out' });
      });
      joined.textContent = '0x' + B.HEX[step.hi] + B.HEX[step.lo] + ' = ' + step.value;
      V.animate(joined, { opacity: ph >= 5 ? 1 : 0 }, { duration: d });
      strip.forEach(function (g, dgt) {
        var on = (ph === 3 && dgt === step.hi) || (ph === 4 && dgt === step.lo) || (ph === 5 && (dgt === step.hi || dgt === step.lo));
        g.setAttribute('class', 'b2-hex__key' + (on ? ' is-on' : ''));
      });
    };
  }
  function parseByte(text) {
    var t = String(text || '').trim().replace(/[\s_]/g, '');
    if (!t) return { values: [], error: 'Type a number from 0 to 255 (decimal, 0x… or 0b…).' };
    var v = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t.slice(2), 16) : /^0b[01]+$/i.test(t) ? parseInt(t.slice(2), 2) : /^\d+$/.test(t) ? parseInt(t, 10) : NaN;
    if (isNaN(v)) return { values: [], error: '“' + text + '” is not a number I can read. Try 42, 0x2A or 0b101010.' };
    if (v > 255) return { values: [], error: v + ' needs more than 8 bits. A byte holds 0 to 255.' };
    return { values: [v], error: null };
  }
  X.parseByte = parseByte;
  function hexFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'default', label: '1 bit', color: 'var(--accent)' }, { state: 'compare', label: 'Nibble being read' }, { state: 'compare', shape: 'outline', label: 'Its hex digit' }]);
    var player = V.player({ root: fig, steps: B.nibbleSteps(42), render: hexView(fig.querySelector('[data-stage]')), caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'Hex conversion controls' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'A byte (0–255)', value: '42', placeholder: 'e.g. 42, 0x2A, 0b101010', parse: parseByte,
      presets: [{ label: '42', value: '42' }, { label: '255', value: '255' }, { label: '0b10100111', value: '0b10100111' }, { label: 'Random', value: function () { return String(Math.floor(Math.random() * 256)); } }],
      hint: 'Decimal, hex (0x…) or binary (0b…).',
      onApply: function (vals) { player.setSteps(B.nibbleSteps(vals[0])); }
    });
  }

  /* ================================================================== one byte, many meanings */
  function meaningFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Byte just changed' }, { state: 'default', shape: 'outline', label: 'Byte' }]);
    var bytes = [72, 105, 33, 33], mode = 'int', changed = [];
    var view = V.views.memory(fig.querySelector('[data-stage]'), { mode: 'ram', perRow: 4, cellWidth: 118, addressMode: 'cell', addrDigits: 3, showBits: true, bitWidth: 8, label: 'Four bytes of memory',
      format: function (v) { return B.hexByte(v); } });
    var readings = fig.querySelector('[data-readings]');
    function rcard(key, title) { var body = h('div', { class: 'reading__body' }); var el = h('div', { class: 'reading', 'data-key': key }, h('p', { class: 'reading__k' }, title), body); readings.appendChild(el); return { el: el, body: body }; }
    var rInt = rcard('int', 'As one int (little-endian)'), rChr = rcard('chars', 'As four ASCII characters'), rCol = rcard('rgba', 'As an RGBA colour');
    function brackets() {
      if (mode === 'int') return [{ id: 'int', name: 'one int : 4 bytes, lowest first', from: 0, to: 3 }];
      if (mode === 'chars') return bytes.map(function (b, i) { var c = B.charName(b); return { id: 'c' + i, name: c === null ? '?' : c.length === 1 ? "'" + c + "'" : c.split(' ')[0], from: i, to: i }; });
      return ['R', 'G', 'B', 'A'].map(function (n, i) { return { id: 'k' + i, name: n + (i < 3 ? (['ed', 'reen', 'lue'][i]) : 'lpha'), from: i, to: i }; });
    }
    function state() {
      return { base: 0x100, cells: bytes.map(function (b, i) { return { value: b, state: changed.indexOf(i) >= 0 ? 'swap' : 'default' }; }), vars: brackets() };
    }
    view.prepare([state()]);
    function paint(dur) {
      view.render(state(), { duration: dur });
      var r = B.interpret(bytes);
      V.clear(rInt.body); V.clear(rChr.body); V.clear(rCol.body);
      rInt.body.appendChild(h('p', { class: 'reading__big' }, fmt(r.int32)));
      rInt.body.appendChild(h('p', { class: 'reading__sub' }, r.hex + ' = ' + B.hexByte(bytes[3]) + ' ' + B.hexByte(bytes[2]) + ' ' + B.hexByte(bytes[1]) + ' ' + B.hexByte(bytes[0]) + ' read backwards'));
      var row = h('div', { class: 'reading__chars' });
      r.chars.forEach(function (c, i) { row.appendChild(h('span', { class: 'reading__char' + (c && c.length === 1 ? '' : ' is-word'), title: 'byte ' + bytes[i] }, c === null ? '—' : c.length === 1 ? c : c.split(' ')[0])); });
      rChr.body.appendChild(row);
      rChr.body.appendChild(h('p', { class: 'reading__sub' }, bytes.join(', ') + ' in the ASCII table'));
      var a = (r.rgba.a / 255);
      rCol.body.appendChild(h('div', { class: 'reading__swatch' }, h('span', { style: { background: 'rgba(' + r.rgba.r + ',' + r.rgba.g + ',' + r.rgba.b + ',' + a.toFixed(3) + ')' } })));
      rCol.body.appendChild(h('p', { class: 'reading__sub' }, 'rgba(' + r.rgba.r + ', ' + r.rgba.g + ', ' + r.rgba.b + ', ' + a.toFixed(2) + ')'));
      [rInt, rChr, rCol].forEach(function (c) { c.el.classList.toggle('is-on', c.el.getAttribute('data-key') === mode); });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Read the bytes as', value: 'int',
      options: [{ value: 'int', label: 'One int' }, { value: 'chars', label: 'Four chars' }, { value: 'rgba', label: 'A colour' }],
      onChange: function (v) { mode = v; changed = []; paint(550); } });
    var presets = fig.querySelector('[data-presets]');
    function setBytes(nb) { changed = []; nb.forEach(function (b, i) { if (b !== bytes[i]) changed.push(i); }); bytes = nb; paint(550); }
    [['"Hi!!"', [72, 105, 33, 33]], ['Orange', [255, 136, 0, 255]], ['1,000,000', [64, 66, 15, 0]], ['−1', [255, 255, 255, 255]],
      ['Random', function () { return [0, 0, 0, 0].map(function () { return Math.floor(Math.random() * 256); }); }]].forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { setBytes(typeof p[1] === 'function' ? p[1]() : p[1].slice()); } }, p[0]));
    });
    presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', title: 'Add 1 to the int and re-encode the bytes', onclick: function () { setBytes(B.bytesLE(B.interpret(bytes).int32 + 1, 4)); } }, '+1 to the int'));
    paint(0);
  }

  /* ================================================================== two's complement wheel */
  function wheelFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current pattern' }, { state: 'error', shape: 'dash', label: 'Overflow seam' }, { state: 'muted', label: 'Negative half (top bit 1)' }]);
    var W = 440, H = 440, CX = 220, CY = 220, R = 150;
    var el = svg(W, H, 'b2-wheel', 'Wheel of all sixteen 4-bit patterns');
    el.setAttribute('role', 'group');
    function ang(k) { return (-90 + k * 22.5) * Math.PI / 180; }
    function pt(k, r) { return { x: CX + r * Math.cos(ang(k)), y: CY + r * Math.sin(ang(k)) }; }
    function arc(r0, r1, k0, k1) {
      var a0 = ang(k0), a1 = ang(k1), large = (k1 - k0) * 22.5 > 180 ? 1 : 0;
      var p0 = [CX + r1 * Math.cos(a0), CY + r1 * Math.sin(a0)], p1 = [CX + r1 * Math.cos(a1), CY + r1 * Math.sin(a1)];
      var q1 = [CX + r0 * Math.cos(a1), CY + r0 * Math.sin(a1)], q0 = [CX + r0 * Math.cos(a0), CY + r0 * Math.sin(a0)];
      return 'M' + p0.join(' ') + 'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + p1.join(' ') + 'L' + q1.join(' ') + 'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + q0.join(' ') + 'Z';
    }
    el.appendChild(s('path', { class: 'b2-wheel__neg', d: arc(98, 204, 7.5, 15.5) }));
    el.appendChild(s('circle', { class: 'b2-wheel__ring', cx: CX, cy: CY, r: R }));
    // seams
    [[15.5, 'unsigned wrap', 'b2-wheel__seam--u'], [7.5, 'signed overflow', 'b2-wheel__seam--s']].forEach(function (sm) {
      var a = pt(sm[0], 96), b = pt(sm[0], 206), t = pt(sm[0], 214);
      el.appendChild(s('line', { class: 'b2-wheel__seam ' + sm[2], x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      el.appendChild(txt(t.x + (sm[0] > 8 ? 6 : 6), t.y + (sm[0] > 8 ? -6 : 14), sm[1], 'b2-wheel__seamt', { 'text-anchor': sm[0] > 8 ? 'start' : 'start' }));
    });
    var hand = s('g', { class: 'b2-wheel__hand' }, s('line', { x1: 0, y1: -55, x2: 0, y2: -84 }), s('path', { d: 'M0 -93 L-6.5 -81 L6.5 -81 Z' }));
    V.place(hand, { x: CX, y: CY, rotate: 0 });
    el.appendChild(hand);
    var pills = [], uLabs = [], sLabs = [];
    for (var k = 0; k < 16; k++) {
      (function (k) {
        var p = pt(k, R), u = pt(k, 186), sg = pt(k, 114);
        var g = s('g', { class: 'b2-wheel__pill', transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')', tabindex: '0', role: 'button', 'aria-label': 'Pattern ' + B.bin(k, 4, 0) + ': unsigned ' + k + ', signed ' + fmt(B.toSigned(k, 4)) },
          s('rect', { x: -25, y: -12, width: 50, height: 24, rx: 12 }), txt(0, 1, B.bin(k, 4, 0), 'b2-wheel__pt'));
        g.addEventListener('click', function () { go(k, 'jump'); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(k, 'jump'); } });
        el.appendChild(g); pills.push(g);
        var ut = txt(u.x, u.y + 4, String(k), 'b2-wheel__u'), st = txt(sg.x, sg.y + 5, fmt(B.toSigned(k, 4)), 'b2-wheel__s' + (k >= 8 ? ' is-neg' : ''));
        el.appendChild(ut); el.appendChild(st); uLabs.push(ut); sLabs.push(st);
      }(k));
    }
    el.appendChild(s('circle', { class: 'b2-wheel__hub', cx: CX, cy: CY, r: 52 }));
    var hubP = txt(CX, CY - 12, '0000', 'b2-wheel__hp'), hubU = txt(CX, CY + 12, 'unsigned 0', 'b2-wheel__hv'), hubS = txt(CX, CY + 28, 'signed 0', 'b2-wheel__hv');
    [hubP, hubU, hubS].forEach(function (t) { el.appendChild(t); });
    el.appendChild(txt(6, 12, 'outside: unsigned', 'b2-wheel__key', { 'text-anchor': 'start' }));
    el.appendChild(txt(6, 28, 'inside: signed', 'b2-wheel__key', { 'text-anchor': 'start' }));
    fig.querySelector('[data-stage]').appendChild(el);
    var cap = fig.querySelector('[data-caption]');
    var stats = V.stats(fig.querySelector('[data-counters]'), { labels: { steps: 'Steps', wraps: 'Unsigned wraps', over: 'Signed overflows' }, states: { wraps: 'error', over: 'error' } });
    var cur = 0, angle = 0, counts = { steps: 0, wraps: 0, over: 0 }, pending = null;
    function paint(dur) {
      pills.forEach(function (p, k) { p.classList.toggle('is-on', k === cur); });
      hubP.textContent = B.bin(cur, 4, 0); hubU.textContent = 'unsigned ' + cur; hubS.textContent = 'signed ' + fmt(B.toSigned(cur, 4));
      V.animate(hand, { rotate: angle }, { duration: dur, ease: 'inOut' });
      stats.update(counts);
    }
    function go(k, why, captionOverride) {
      if (pending && why !== 'negate2') { clearTimeout(pending); pending = null; }
      var from = cur, delta = ((k - from) % 16 + 16) % 16;
      if (delta > 8) delta -= 16;
      if (why === 'flip') delta = ((k - from) % 16 + 16) % 16 <= 8 ? ((k - from) % 16 + 16) % 16 : ((k - from) % 16 + 16) % 16 - 16;
      angle += delta * 22.5;
      cur = k;
      var su = B.toSigned(from, 4), sv = B.toSigned(k, 4), text;
      if (why === 'inc' || why === 'dec') {
        counts.steps++;
        var wrapU = why === 'inc' ? from === 15 : from === 0, over = why === 'inc' ? from === 7 : from === 8;
        if (wrapU) counts.wraps++;
        if (over) counts.over++;
        text = B.bin(from, 4, 0) + (why === 'inc' ? ' + 1 = ' : ' − 1 = ') + B.bin(k, 4, 0) + '. Unsigned ' + from + ' → ' + k + (wrapU ? ': <b>wrapped around</b>, because ' + (why === 'inc' ? '16 needs a fifth bit' : '−1 is below 0') + '.' : ', fine.') +
          ' Signed ' + fmt(su) + ' → ' + fmt(sv) + (over ? ': <b>signed overflow</b>, because ' + (why === 'inc' ? '8' : '−9') + ' does not fit in −8…7.' : ', fine.');
        el.classList.toggle('is-flash', wrapU || over);
      } else text = captionOverride || ('Pattern <b>' + B.bin(k, 4, 0) + '</b>: unsigned ' + k + ', signed ' + fmt(sv) + '.' + (k >= 8 ? ' The top bit is 1, so the signed reading is ' + k + ' − 16 = ' + fmt(sv) + '.' : ''));
      cap.innerHTML = text;
      paint(why === 'jump' ? 500 : 420);
    }
    var btns = fig.querySelector('[data-buttons]');
    function b(label, fn, extra) { var x = h('button', Object.assign({ type: 'button', class: 'btn btn--sm', onclick: fn }, extra || {}), label); btns.appendChild(x); return x; }
    b('−1', function () { go(B.wrap(cur - 1, 4), 'dec'); }, { 'aria-label': 'Subtract 1' });
    b('+1', function () { go(B.wrap(cur + 1, 4), 'inc'); }, { class: 'btn btn--sm btn--primary', 'aria-label': 'Add 1' });
    b('Negate: flip, then +1', function () {
      if (pending) { clearTimeout(pending); pending = null; }
      var steps = B.negateSteps(cur, 4);
      go(steps[1].value, 'flip', steps[1].caption);
      pending = setTimeout(function () { pending = null; go(steps[2].value, 'negate2', steps[2].caption); }, V.reducedMotion() ? 0 : 1300);
    });
    b('Reset', function () { counts = { steps: 0, wraps: 0, over: 0 }; go(0, 'jump', 'Back at <b>0000</b>. Press +1 until the hand crosses the red seams.'); });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Labels', value: 'both', options: [{ value: 'both', label: 'Both' }, { value: 'u', label: 'Unsigned' }, { value: 's', label: 'Signed' }],
      onChange: function (v) { el.classList.toggle('hide-s', v === 'u'); el.classList.toggle('hide-u', v === 's'); } });
    angle = 0; cur = 0;
    cap.innerHTML = 'Start at <b>0000</b>. Press <b>+1</b> and walk clockwise: past 0111 = 7 the signed reading jumps to −8, and past 1111 = 15 the unsigned reading wraps to 0.';
    paint(0);
  }

  /* ================================================================== tape vs RAM race */
  function raceFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Head / selected address' }, { state: 'found', label: 'Byte read' }, { state: 'visited', label: 'Passed over' }]);
    var N = 16, W = 600, H = 272, P = 34, C = 30, X0 = (W - (N * P - (P - C))) / 2, TY = 62, RY = 174;
    var data = B.garbage(N, 3);
    var el = svg(W, H, 'b2-race', 'A tape and a RAM with sixteen bytes each');
    el.setAttribute('role', 'group');
    el.appendChild(txt(X0 - 8, TY - 44, 'Tape: walk to the byte', 'b2-race__title'));
    el.appendChild(txt(X0 - 8, RY - 30, 'RAM: jump to the address', 'b2-race__title'));
    el.appendChild(s('rect', { class: 'b2-race__tape', x: X0 - 8, y: TY - 8, width: N * P - (P - C) + 16, height: C + 16, rx: 6 }));
    function row(y, key) {
      var out = [];
      for (var i = 0; i < N; i++) {
        (function (i) {
          var g = s('g', { class: 'b2-race__cell', transform: 'translate(' + (X0 + i * P) + ' ' + y + ')', tabindex: '0', role: 'button', 'aria-label': 'Read address ' + B.hex(0x100 + i, 3) },
            s('rect', { width: C, height: C, rx: 5 }), txt(C / 2, C / 2 + 1, B.hexByte(data[i]), 'b2-race__v'), txt(C / 2, C + 14, B.hex(0x100 + i, 3).slice(-2), 'b2-race__a'));
          g.addEventListener('click', function () { read(i); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); read(i); } });
          el.appendChild(g); out.push(g);
        }(i));
      }
      return out;
    }
    var tape = row(TY), ram = row(RY);
    var head = s('g', { class: 'b2-race__head' }, s('path', { d: 'M0 0 L-8 -12 L8 -12 Z' }));
    el.appendChild(head); placeAt(head, X0 + C / 2, TY - 10);
    var decoder = s('g', { class: 'b2-race__dec' }, s('rect', { x: -44, y: -13, width: 88, height: 26, rx: 13 }), txt(0, 1, 'address ?', 'b2-race__dt'));
    el.appendChild(decoder); placeAt(decoder, W / 2, RY + C + 50);
    var wire = s('path', { class: 'b2-race__wire', opacity: 0 });
    el.appendChild(wire);
    fig.querySelector('[data-stage]').appendChild(el);
    var cap = fig.querySelector('[data-caption]');
    var stats = V.stats(fig.querySelector('[data-counters]'), { labels: { tape: 'Tape moves (this read)', ram: 'RAM steps (this read)', tapeTotal: 'Tape total', ramTotal: 'RAM total' }, states: { tape: 'visited', ram: 'active' } });
    var headAt = 0, timer = null, totals = { tape: 0, ram: 0 };
    var stageEl = fig.querySelector('[data-stage]');
    function follow(x) {   // keep the tape head in view when the stage scrolls sideways on phones
      if (stageEl.scrollWidth <= stageEl.clientWidth + 2) return;
      var k = el.getBoundingClientRect().width / W;
      stageEl.scrollLeft = Math.max(0, x * k - stageEl.clientWidth / 2);
    }
    stats.update({ tape: 0, ram: 0, tapeTotal: 0, ramTotal: 0 });
    function read(target) {
      if (timer) { clearInterval(timer); timer = null; }
      var start = headAt, dir = target >= start ? 1 : -1, moves = Math.abs(target - start), done = 0;
      tape.forEach(function (g) { g.setAttribute('class', 'b2-race__cell'); });
      ram.forEach(function (g, i) { g.setAttribute('class', 'b2-race__cell' + (i === target ? ' is-found' : '')); });
      totals.ram += 1;
      var tx = X0 + target * P + C / 2;
      decoder.querySelector('text').textContent = 'address ' + B.hex(0x100 + target, 3);
      wire.setAttribute('d', 'M' + (W / 2) + ' ' + (RY + C + 37) + ' C' + (W / 2) + ' ' + (RY + C + 20) + ' ' + tx + ' ' + (RY + C + 30) + ' ' + tx + ' ' + (RY + C + 2));
      wire.setAttribute('opacity', 1);
      var tick = V.reducedMotion() ? 0 : 110;
      function stepTape() {
        if (done < moves) { tape[headAt].classList.remove('is-active'); tape[headAt].classList.add('is-visited'); headAt += dir; done++; }
        placeAt(head, X0 + headAt * P + C / 2, TY - 10);
        tape[headAt].classList.remove('is-visited');
        tape[headAt].classList.add('is-active');
        follow(X0 + headAt * P + C / 2);
        stats.update({ tape: done, ram: 1, tapeTotal: totals.tape + done, ramTotal: totals.ram });
        if (done >= moves) {
          if (timer) { clearInterval(timer); timer = null; }
          totals.tape += moves;
          tape[headAt].setAttribute('class', 'b2-race__cell is-found');
          cap.innerHTML = 'Reading <b>' + B.hex(0x100 + target, 3) + '</b> (value ' + B.hexByte(data[target]) + '). The tape moved <b>' + moves + ' cell' + (moves === 1 ? '' : 's') + '</b> from where it stopped last time; the RAM took <b>1 step</b>, as it does for every address.';
          return true;
        }
        return false;
      }
      cap.innerHTML = 'RAM: the address goes straight to the right byte in one step. Tape: the head has to pass every cell in between…';
      if (!tick) { while (!stepTape()) { /* instant under reduced motion */ } return; }
      if (!stepTape()) timer = setInterval(function () { if (stepTape()) { clearInterval(timer); timer = null; } }, tick);
    }
    var btns = fig.querySelector('[data-buttons]');
    [['Read 0x10E', 14], ['Read 0x103', 3], ['Read 0x10F', 15], ['Read 0x100', 0]].forEach(function (bb) {
      btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { read(bb[1]); } }, bb[0]));
    });
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { read(Math.floor(Math.random() * N)); } }, 'Random address'));
    cap.innerHTML = 'Both rows hold the same 16 bytes, addresses 0x100 to 0x10F. The tape head starts at 0x100. Click a byte to read it.';
    tape[0].classList.add('is-active');
  }

  /* ================================================================== start */
  V.ready(function () {
    // Register every check up front so the page score shows its full total before lazy figures load.
    ['b02-meaning', 'b02-make-42', 'b02-add-predict', 'b02-lab-endian', 'b02-lab-where', 'b02-signed', 'b02-bits10', 'b02-click-arr3', 'b02-overflow'].forEach(function (id) { V.quizScore.register(id); });
    heroTeaser();
    problemFigure();
    intuitionMinis();
    switchesFigure();
    lazy('#fig-odometer', odometerFigure);
    lazy('#fig-tree', treeFigure);
    lazy('#fig-growth', growthFigure);
    lazy('#fig-hex', hexFigure);
    lazy('#fig-meaning', meaningFigure);
    lazy('#fig-wheel', wheelFigure);
    lazy('#fig-race', raceFigure);
  });
}());
