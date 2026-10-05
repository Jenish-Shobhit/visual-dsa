/* Big-O explorer lab (labs/big-o-explorer.html). Model, parser and snippets live in big-o-explorer-model.js and
   big-o-explorer-snippets.js (pure, tested); this file is the wiring: chart, timeline, doubling game, cost box, guessing game.
   State is mirrored to the URL: ?n=1000&y=log&x=lin&on=n,n2,2n&rate=8&expr=3n%5E2%2B5n%2B100 */
(function () {
  'use strict';
  var h = VDSA.h, $ = VDSA.$;
  var B = window.VDSA_BIGO, SN = window.VDSA_SNIPPETS;
  var CLASSES = B.CLASSES;

  /* semantic colour per class: the same hues as the .big-o badge ramp */
  var STATE_OF = { '1': 'done', logn: 'frontier', sqrtn: 'visited', n: 'active', nlogn: 'key', n2: 'compare', n3: 'path', '2n': 'swap', nfact: 'pivot' };
  var SHORT = { '1': '1', logn: 'log n', sqrtn: '√n', n: 'n', nlogn: 'n log n', n2: 'n²', n3: 'n³', '2n': '2ⁿ', nfact: 'n!' };
  var DEFAULT_ON = ['1', 'logn', 'n', 'nlogn', 'n2', 'n3', '2n', 'nfact'];
  var N_MIN = 2, N_MAX = 1e6;

  var S = { n: 1000, y: 'lin', x: 'lin', on: DEFAULT_ON.slice(), user: false, rate: 8, expr: '3n^2 + 5n + 100', ownMode: 'log', ownX: 1000 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtN(n) { return B.group(n); }
  function badge(id, text) { return h('span', { class: 'big-o', 'data-o': id === 'nk' ? 'nk' : id }, text || B.byId(id).label); }
  /* Unicode superscripts (10³⁰¹) render at ~8px in mono; show them as real <sup> so they stay 10px or more. */
  var SUPCH = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻', PLAIN = '0123456789-';
  function setRich(el, str) {
    str = String(str);
    if (!/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(str)) { el.textContent = str; return; }
    el.textContent = '';
    str.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/).forEach(function (part, i) {
      if (!part) return;
      if (i % 2) el.appendChild(h('sup', { class: 'bx-sup' }, part.split('').map(function (c) { return PLAIN.charAt(SUPCH.indexOf(c)); }).join('')));
      else el.appendChild(document.createTextNode(part));
    });
  }
  /* The chart packs end-of-line labels ~13px apart; open them up to a readable pitch. */
  function spreadLabels(host) {
    var busy = false;
    function run() {
      if (busy) return; busy = true;
      var list = [].slice.call(host.querySelectorAll('.vz-series-label')).filter(function (t) { return t.textContent && !t.classList.contains('is-inside') && +getComputedStyle(t).opacity > 0.05; })
        .map(function (t) { return { t: t, y: parseFloat(t.getAttribute('y')) }; }).filter(function (o) { return isFinite(o.y); }).sort(function (a, b) { return a.y - b.y; });
      var PITCH = 19, i;
      for (i = 1; i < list.length; i++) if (list[i].y < list[i - 1].y + PITCH) list[i].y = list[i - 1].y + PITCH;
      var svg = host.querySelector('svg'), maxY = svg ? svg.getBoundingClientRect().height - 18 : Infinity;
      for (i = list.length - 1; i >= 0; i--) { var cap = i === list.length - 1 ? maxY : list[i + 1].y - PITCH; if (list[i].y > cap) list[i].y = cap; }
      list.forEach(function (o) { var v = String(Math.round(o.y * 100) / 100); if (o.t.getAttribute('y') !== v) o.t.setAttribute('y', v); });
      obs.takeRecords();
      busy = false;
    }
    var obs = new MutationObserver(function () { run(); });
    obs.observe(host, { subtree: true, attributes: true, attributeFilter: ['y'] });
  }
  function rateLabel() { return '10' + B.sup(S.rate); }

  /* ------------------------------------------------------------------ URL state */
  function readUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('n')) S.n = clamp(Math.round(+q.get('n')) || S.n, N_MIN, N_MAX);
      if (q.get('y') === 'log' || q.get('y') === 'lin') S.y = q.get('y');
      if (q.get('x') === 'log' || q.get('x') === 'lin') S.x = q.get('x');
      if (q.get('on')) { var ids = q.get('on').split(',').filter(function (id) { return B.byId(id); }); if (ids.length) S.on = ids; }
      if (q.get('rate')) { var r = +q.get('rate'); if (r === 6 || r === 8 || r === 9) S.rate = r; }
      if (q.get('expr') != null && q.get('expr') !== '') { S.expr = q.get('expr').slice(0, 160); S.user = true; }
      if (q.get('u') === '1') S.user = true;
    } catch (e) { /* file:// or old browser */ }
  }
  var urlTimer = 0;
  function writeUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      try {
        var q = new URLSearchParams();
        q.set('n', S.n); if (S.y !== 'lin') q.set('y', S.y); if (S.x !== 'lin') q.set('x', S.x);
        var same = S.on.length === DEFAULT_ON.length && S.on.every(function (id) { return DEFAULT_ON.indexOf(id) >= 0; });
        if (!same) q.set('on', CLASSES.filter(function (c) { return S.on.indexOf(c.id) >= 0; }).map(function (c) { return c.id; }).join(','));
        if (S.rate !== 8) q.set('rate', S.rate);
        if (S.expr !== '3n^2 + 5n + 100' || S.user) { q.set('expr', S.expr); }
        history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
      } catch (e) { /* ignore */ }
    }, 250);
  }

  /* ------------------------------------------------------------------ your cost (parsed once per edit) */
  var own = { ok: false, ast: null, an: null, error: '', pos: 0 };
  function parseOwn() {
    var r = B.tryParse(S.expr);
    own.ok = r.ok; own.error = r.error || ''; own.pos = r.pos || 0;
    if (r.ok) {
      own.ast = r.ast; own.an = B.analyze(r.ast);
      var probe = B.evaluate(r.ast, 10);
      if (!isFinite(probe) && !(own.an && own.an.terms && own.an.terms.length)) { own.ok = false; own.error = 'That formula has no value at n = 10.'; }
    }
  }
  function userFn(x) { var v = B.evaluate(own.ast, x); return isFinite(v) ? Math.min(v, B.CAP) : (v > 0 ? B.CAP : NaN); }
  /* log10 of the user's cost at n without overflowing (uses the symbolic terms when there are any) */
  function userLog10(n) {
    var an = own.an;
    if (an && an.terms && an.terms.length) {
      var ls = an.terms.map(function (t) { return B.termLog10(t, n); }), mx = Math.max.apply(null, ls), sum = 0;
      an.terms.forEach(function (t, i) { sum += (t.c < 0 ? -1 : 1) * Math.pow(10, ls[i] - mx); });
      return sum > 0 ? mx + Math.log10(sum) : -Infinity;
    }
    var v = B.evaluate(own.ast, n);
    return v > 0 && isFinite(v) ? Math.log10(v) : (v > 0 ? 300 : -Infinity);
  }
  var userOn = function () { return S.user && own.ok; };

  /* ------------------------------------------------------------------ hero teaser */
  function drawTeaser() {
    var host = $('#teaser'), W = 400, H = 290, pad = 26, ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'bx-tz');
    var g = function (tag, attrs, parent) { var e = document.createElementNS(ns, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
    g('path', { d: 'M' + pad + ' ' + pad + 'V' + (H - pad) + 'H' + (W - pad), class: 'bx-tz__axis', fill: 'none' });
    var X0 = 1, X1 = 10, CAPY = 100;
    CLASSES.forEach(function (c, ci) {
      if (c.id === 'sqrtn') return;
      var d = '', started = false;
      for (var x = X0; x <= X1 + 1e-9; x += 0.1) {
        var y = c.f(x), over = y > CAPY;
        var px = pad + (x - X0) / (X1 - X0) * (W - 2 * pad), py = H - pad - Math.min(y, CAPY) / CAPY * (H - 2 * pad);
        d += (started ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); started = true;
        if (over) break;
      }
      var p = g('path', { d: d, pathLength: '1', class: 'bx-tz__line', fill: 'none', 'data-c': c.id });
      p.style.setProperty('--i', ci);
    });
    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------ chart */
  var chart, chartHost;
  function visibleClasses() { return CLASSES.filter(function (c) { return S.on.indexOf(c.id) >= 0; }); }
  function valuesAtN() {
    var out = visibleClasses().map(function (c) { return { id: c.id, v: c.f(S.n) }; });
    if (userOn()) out.push({ id: 'user', v: userFn(S.n) });
    return out.filter(function (o) { return isFinite(o.v) && o.v > 0; });
  }
  function linearMax(vals) {
    var v = vals.map(function (o) { return o.v; }).sort(function (a, b) { return a - b; });
    if (!v.length) return 10;
    var m = v[0];
    for (var i = 1; i < v.length; i++) { if (v[i] <= m * 150) m = v[i]; else break; }
    return Math.max(m * 1.15, 1.5);
  }
  function chartState() {
    var vals = valuesAtN(), series = [];
    visibleClasses().forEach(function (c) { series.push({ id: c.id, label: SHORT[c.id], fn: c.f, state: STATE_OF[c.id] }); });
    if (userOn()) series.push({ id: 'user', label: 'your cost', fn: userFn, state: 'default', dashed: true });
    var xmax = Math.max(S.n, 2), y;
    if (S.y === 'log') {
      var mx = 0;
      vals.forEach(function (o) { mx = Math.max(mx, Math.log10(o.v)); });
      visibleClasses().forEach(function (c) { mx = Math.max(mx, Math.min(c.log10(S.n), 60)); });
      var top = clamp(Math.ceil(mx + 0.01), 1, 30);
      y = { label: 'steps (log scale)', scale: 'log', min: 1, max: Math.pow(10, top) };
    } else y = { label: 'steps', min: 0, max: linearMax(vals) };
    return { x: { label: 'input size n', min: 1, max: xmax, scale: S.x === 'log' ? 'log' : 'linear' }, y: y, series: series, _ymax: y.max };
  }
  function renderChart(dur) {
    var st = chartState();
    var ymax = st._ymax; delete st._ymax;
    chart.render(st, { duration: dur === undefined ? 450 : dur });
    var clipped = [];
    visibleClasses().forEach(function (c) { if (c.f(S.n) > ymax * 1.0001 || (S.y === 'log' && c.log10(S.n) > Math.log10(ymax))) clipped.push(SHORT[c.id]); });
    if (userOn() && userLog10(S.n) > Math.log10(ymax)) clipped.push('your cost');
    var note = $('[data-clip]');
    note.textContent = clipped.length
      ? (S.y === 'log' ? 'Off the top of the chart at n = ' + fmtN(S.n) + ': ' : 'Too steep to fit: ') + clipped.join(', ') + (S.y === 'lin' ? '. They leave the top of the chart. Switch the steps axis to log to see where they go.' : ' (above 10' + B.sup(clamp(Math.round(Math.log10(ymax)), 1, 30)) + ' steps).')
      : '';
    note.hidden = !clipped.length;
  }

  /* value cells under the chart (follow the slider, or the crosshair while hovering) */
  var valuesEl, hoverN = null;
  function buildValues() {
    valuesEl = $('[data-values]');
    var head = h('div', { class: 'bx-values__head' }, h('span', { class: 'bx-values__n', 'data-vn': '' }), h('span', { class: 'bx-values__hint', 'data-vhint': '' }));
    valuesEl.appendChild(head);
    var grid = h('div', { class: 'bx-values__grid' });
    CLASSES.forEach(function (c) {
      grid.appendChild(h('div', { class: 'bx-val', 'data-c': c.id },
        h('span', { class: 'bx-val__name' }, h('i', { class: 'bx-dot', 'aria-hidden': 'true' }), SHORT[c.id]),
        h('span', { class: 'bx-val__num', 'data-vnum': c.id })));
    });
    grid.appendChild(h('div', { class: 'bx-val', 'data-c': 'user' }, h('span', { class: 'bx-val__name' }, h('i', { class: 'bx-dot', 'aria-hidden': 'true' }), 'your cost'), h('span', { class: 'bx-val__num', 'data-vnum': 'user' })));
    valuesEl.appendChild(grid);
  }
  function paintValues() {
    var n = hoverN !== null ? hoverN : S.n;
    $('[data-vn]', valuesEl).textContent = 'At n = ' + fmtN(n);
    $('[data-vhint]', valuesEl).textContent = hoverN !== null ? 'from the crosshair' : 'from the slider';
    CLASSES.forEach(function (c) {
      var cell = $('[data-c="' + c.id + '"]', valuesEl), on = S.on.indexOf(c.id) >= 0;
      cell.classList.toggle('is-off', !on);
      setRich($('[data-vnum]', cell), B.formatCount(c.log10(n)));
    });
    var u = $('[data-c="user"]', valuesEl);
    u.hidden = !userOn();
    if (userOn()) setRich($('[data-vnum]', u), B.formatCount(userLog10(n)));
  }

  /* ------------------------------------------------------------------ controls above the chart */
  var nSlider, yseg, xseg, toggleEls = {};
  function buildToggles() {
    var host = $('[data-toggles]');
    CLASSES.concat([{ id: 'user' }]).forEach(function (c) {
      var isUser = c.id === 'user';
      var b = h('button', { type: 'button', class: 'bx-tg', 'data-c': c.id, 'aria-pressed': 'false', title: isUser ? 'Plot the formula from “Write your own cost”' : c.name },
        h('i', { class: 'bx-dot', 'aria-hidden': 'true' }), isUser ? 'your cost' : SHORT[c.id]);
      b.addEventListener('click', function () {
        if (isUser) { S.user = !S.user; if (S.user && !own.ok) { location.hash = '#own'; } }
        else { var i = S.on.indexOf(c.id); if (i >= 0) S.on.splice(i, 1); else S.on.push(c.id); }
        refreshAll(450);
      });
      toggleEls[c.id] = b; host.appendChild(b);
    });
    var shows = $('[data-shows]');
    [['All', CLASSES.map(function (c) { return c.id; })], ['Tame', ['1', 'logn', 'n', 'nlogn', 'n2']], ['Explosive', ['n2', 'n3', '2n', 'nfact']]].forEach(function (p) {
      shows.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { S.on = p[1].slice(); refreshAll(450); } }, p[0]));
    });
  }
  function paintToggles() {
    CLASSES.forEach(function (c) { toggleEls[c.id].setAttribute('aria-pressed', String(S.on.indexOf(c.id) >= 0)); });
    toggleEls.user.setAttribute('aria-pressed', String(userOn()));
    toggleEls.user.classList.toggle('is-invalid', S.user && !own.ok);
  }
  function setN(n, dur) {
    S.n = clamp(Math.round(n), N_MIN, N_MAX);
    nSlider.set(Math.log10(S.n));
    refreshAll(dur === undefined ? 450 : dur);
  }
  function buildControls() {
    yseg = VDSA.segmented($('[data-yseg]'), { label: 'Steps axis', value: S.y, options: [{ value: 'lin', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { S.y = v; refreshAll(800); } });
    xseg = VDSA.segmented($('[data-xseg]'), { label: 'n axis', value: S.x, options: [{ value: 'lin', label: 'Linear' }, { value: 'log', label: 'Log' }], onChange: function (v) { S.x = v; refreshAll(800); } });
    nSlider = VDSA.slider($('[data-nslider]'), {
      label: 'n', min: 0.3, max: 6, step: 0.005, value: Math.log10(S.n),
      format: function (v) { return fmtN(clamp(Math.round(Math.pow(10, v)), N_MIN, N_MAX)); },
      onInput: function (v) { S.n = clamp(Math.round(Math.pow(10, v)), N_MIN, N_MAX); scheduleFrame(); }
    });
    nSlider.input.setAttribute('aria-label', 'n, the input size');
    var chips = $('[data-nchips]');
    [10, 30, 100, 1000, 100000, 1000000].forEach(function (n) {
      chips.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { setN(n); } }, n >= 1e5 ? (n === 1e6 ? '10⁶' : '10⁵') : fmtN(n)));
    });
  }

  /* one rAF-batched refresh for slider dragging (no tween while dragging: the curves follow the thumb) */
  var frame = 0;
  function scheduleFrame() { if (frame) return; frame = requestAnimationFrame(function () { frame = 0; refreshAll(0, true); }); }
  function refreshAll(dur, dragging) {
    paintToggles(); renderChart(dur); paintValues(); paintTime(); paintOwnDetail(); writeUrl();
    $('[data-n-label]').textContent = 'n = ' + fmtN(S.n);
    $('[data-rate-label]').textContent = rateLabel();
    if (dragging !== true) { /* nothing extra */ }
  }

  /* ------------------------------------------------------------------ time table */
  var TICKS = [[-9, '1 ns'], [-6, '1 µs'], [-3, '1 ms'], [0, '1 s'], [Math.log10(3600), '1 hour'], [Math.log10(86400 * 365.25), '1 year'], [B.LOG_UNIVERSE, 'universe']];
  var T_LO = -9.5, T_HI = 19;
  function tpos(ls) { return clamp((ls - T_LO) / (T_HI - T_LO), 0, 1) * 100; }
  var timeEl, timeRows = {};
  function buildTime() {
    timeEl = $('[data-time]');
    var axis = h('div', { class: 'bx-trow bx-trow--axis', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('div', { class: 'bx-taxis' }));
    TICKS.forEach(function (t, i) {
      var tk = h('span', { class: 'bx-taxis__tick' + (i === TICKS.length - 1 ? ' is-end' : ''), style: { left: tpos(t[0]) + '%' } }, t[1]);
      $('.bx-taxis', axis).appendChild(tk);
    });
    timeEl.appendChild(axis);
    CLASSES.concat([{ id: 'user' }]).forEach(function (c) {
      var track = h('div', { class: 'bx-bar' });
      TICKS.forEach(function (t) { track.appendChild(h('i', { class: 'bx-bar__tick', style: { left: tpos(t[0]) + '%' } })); });
      var fill = h('i', { class: 'bx-bar__fill' });
      track.appendChild(fill);
      var name = c.id === 'user' ? h('span', { class: 'bx-tname' }, h('i', { class: 'bx-dot', 'aria-hidden': 'true' }), 'your cost', h('span', { class: 'bx-tname__o', 'data-user-o': '' })) : h('span', { class: 'bx-tname' }, h('i', { class: 'bx-dot', 'aria-hidden': 'true' }), badge(c.id));
      var ops = h('span', { class: 'bx-tops' }), time = h('span', { class: 'bx-ttime' });
      var row = h('div', { class: 'bx-trow', 'data-c': c.id }, name, ops, time, track);
      timeRows[c.id] = { row: row, ops: ops, time: time, fill: fill };
      timeEl.appendChild(row);
    });
  }
  function paintTime() {
    CLASSES.forEach(function (c) { paintRow(c.id, c.log10(S.n)); });
    var r = timeRows.user;
    r.row.hidden = !userOn();
    if (userOn()) { paintRow('user', userLog10(S.n)); var o = $('[data-user-o]', r.row); o.textContent = own.an ? own.an.label : ''; }
  }
  function paintRow(id, log10ops) {
    var r = timeRows[id], d = B.formatDuration(log10ops - S.rate);
    setRich(r.ops, B.formatCount(log10ops) + (log10ops < 0.3 && log10ops > -1 ? ' step' : ' steps'));
    r.time.innerHTML = '';
    r.time.appendChild(h('b', null, d.text));
    if (d.sub) { var sm = h('small', null); setRich(sm, d.sub); r.time.appendChild(sm); }
    r.fill.style.width = tpos(log10ops - S.rate) + '%';
    r.row.classList.toggle('is-long', d.long);
    r.row.setAttribute('data-tier', d.tier);
  }

  /* ------------------------------------------------------------------ doubling game */
  var D = { n: 4, prev: null, hist: {}, right: 0, total: 0, streak: 0, q: null, feedback: '' };
  var DBL_MAX = 1 << 20, DBL_MIN = 2;
  var PRED_OPTS = ['×1', '×1.4', '×2', '×4', '×8', 'squared'];
  var PRED_ANS = { '1': '×1', sqrtn: '×1.4', n: '×2', n2: '×4', n3: '×8', '2n': 'squared' };
  var PRED_IDS = Object.keys(PRED_ANS);
  var cardEls = {}, dblBusy = false;
  function buildCards() {
    var host = $('[data-cards]');
    CLASSES.forEach(function (c) {
      var bars = h('div', { class: 'bx-hist', 'aria-hidden': 'true' });
      for (var i = 0; i < 8; i++) bars.appendChild(h('i'));
      var el = h('div', { class: 'bx-card', 'data-c': c.id },
        h('div', { class: 'bx-card__top' }, badge(c.id), h('span', { class: 'bx-card__ratio', 'data-ratio': '' })),
        h('div', { class: 'bx-card__num', 'data-num': '' }),
        bars);
      cardEls[c.id] = { el: el, num: $('[data-num]', el), ratio: $('[data-ratio]', el), bars: bars.children };
      D.hist[c.id] = [];
      host.appendChild(el);
    });
  }
  function dblPaint(bump) {
    $('[data-dbl-n]').textContent = 'n = ' + fmtN(D.n);
    CLASSES.forEach(function (c) {
      var ce = cardEls[c.id], ls = c.log10(D.n), h0 = D.hist[c.id];
      setRich(ce.num, B.formatCount(ls));
      if (D.prev !== null) {
        var r = ls - c.log10(D.prev);
        setRich(ce.ratio, B.formatRatio(r));
        ce.ratio.classList.remove('is-pop'); void ce.ratio.offsetWidth; if (bump) ce.ratio.classList.add('is-pop');
      } else ce.ratio.textContent = 'start';
      var mn = Math.min.apply(null, h0.concat([ls])), mx = Math.max.apply(null, h0.concat([ls]));
      for (var i = 0; i < 8; i++) {
        var v = h0[h0.length - 8 + i];
        if (i === 7) v = ls; else if (h0.length - 8 + i < 0) v = undefined; else v = h0[h0.length - 8 + i];
        var bar = ce.bars[i];
        if (v === undefined) { bar.style.height = '0%'; continue; }
        bar.style.height = (mx === mn ? 50 : 14 + 86 * (v - mn) / (mx - mn)) + '%';
      }
    });
    $('[data-double]').disabled = D.n * 2 > DBL_MAX;
    $('[data-halve]').disabled = D.n / 2 < DBL_MIN;
  }
  function dblStep(dir) {
    var next = dir > 0 ? D.n * 2 : D.n / 2;
    if (next > DBL_MAX || next < DBL_MIN) return false;
    CLASSES.forEach(function (c) { D.hist[c.id].push(c.log10(D.n)); if (D.hist[c.id].length > 8) D.hist[c.id].shift(); });
    D.prev = D.n; D.n = next;
    dblPaint(true);
    return true;
  }
  function newQuestion() { D.q = PRED_IDS[Math.floor(Math.random() * PRED_IDS.length)]; paintPredict(); }
  function paintPredict() {
    var host = $('[data-predict]');
    VDSA.clear(host);
    var c = B.byId(D.q);
    host.appendChild(h('p', { class: 'bx-predict__q', id: 'pq' }, 'Predict: when n doubles, how much more work does ', badge(D.q), ' do?'));
    var row = h('div', { class: 'bx-predict__opts', role: 'group', 'aria-labelledby': 'pq' });
    PRED_OPTS.forEach(function (o) {
      row.appendChild(h('button', { type: 'button', class: 'btn', 'data-opt': o, onclick: function () { answerPredict(o); } }, o));
    });
    host.appendChild(row);
    host.appendChild(h('p', { class: 'bx-predict__fb', 'data-fb': '', role: 'status' }, D.feedback));
  }
  function answerPredict(opt) {
    if (D.n * 2 > DBL_MAX) { D.n = 4; D.prev = null; CLASSES.forEach(function (c) { D.hist[c.id] = []; }); }
    var ok = opt === PRED_ANS[D.q], c = B.byId(D.q), before = D.n;
    D.total++; if (ok) { D.right++; D.streak++; } else D.streak = 0;
    dblStep(1);
    var ratio = B.formatRatio(c.log10(D.n) - c.log10(before));
    D.feedback = (ok ? 'Right. ' : 'Not quite. ') + SHORT[D.q] + ' went from ' + B.formatCount(c.log10(before)) + ' to ' + B.formatCount(c.log10(D.n)) + ' steps as n doubled from ' + fmtN(before) + ' to ' + fmtN(D.n) + (D.q === '2n' ? ': the work squared (2ⁿ × 2ⁿ = 2²ⁿ).' : ' (' + ratio + ').');
    var card = cardEls[D.q].el; card.classList.remove('is-flash', 'is-wrong'); void card.offsetWidth; card.classList.add(ok ? 'is-flash' : 'is-wrong');
    paintScore(); newQuestion();
  }
  function paintScore() {
    $('[data-score]').textContent = D.total ? 'Predicted ' + D.right + ' of ' + D.total + (D.streak > 1 ? ' · streak ' + D.streak : '') : 'No predictions yet';
  }
  function buildDoubling() {
    buildCards();
    $('[data-double]').addEventListener('click', function () { dblStep(1); });
    $('[data-halve]').addEventListener('click', function () { dblStep(-1); });
    $('[data-dbl-reset]').addEventListener('click', function () { D.n = 4; D.prev = null; CLASSES.forEach(function (c) { D.hist[c.id] = []; }); dblPaint(false); });
    dblPaint(false); newQuestion(); paintScore();
  }

  /* ------------------------------------------------------------------ write your own cost */
  var ownChart, ownSeg, ownX, ownDrawn = false;
  var EXAMPLES = ['3n^2 + 5n + 100', 'n log n + 50n', '2^n + n^3', 'n!/1000', '1000n', 'n(n+1)/2', 'sqrt(n) + log n', '5n^3 + n^2 log n'];
  function buildOwn() {
    var input = $('[data-expr]');
    input.value = S.expr;
    var t = 0;
    input.addEventListener('input', function () {
      S.expr = input.value; clearTimeout(t);
      t = setTimeout(function () { S.user = true; parseOwn(); refreshAll(300); }, 140);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(t); S.user = true; S.expr = input.value; parseOwn(); refreshAll(300); } });
    var ex = $('[data-examples]');
    EXAMPLES.forEach(function (e) {
      ex.appendChild(h('button', { type: 'button', class: 'btn btn--sm bx-ex', onclick: function () { input.value = e; S.expr = e; S.user = true; parseOwn(); refreshAll(500); } }, e));
    });
    ownSeg = VDSA.segmented($('[data-ownseg]'), { label: 'Own chart axes', value: S.ownMode, options: [{ value: 'log', label: 'Log-log' }, { value: 'lin', label: 'Linear' }], onChange: function (v) { S.ownMode = v; paintOwnChart(700); } });
    ownX = VDSA.segmented($('[data-ownx]'), { label: 'Chart range', value: String(S.ownX), options: [{ value: '10', label: '10' }, { value: '100', label: '100' }, { value: '1000', label: '1,000' }, { value: '10000', label: '10⁴' }, { value: '1000000', label: '10⁶' }], onChange: function (v) { S.ownX = +v; paintOwnChart(700); } });
    ownChart = VDSA.views.chart($('[data-own-chart]'), { type: 'line', height: 320, label: 'Your cost formula against its dominant term', samples: 96 });
  }
  function paintOwnChart(dur) {
    if (!own.ok) return;
    var an = own.an, d = an.dominant, series = [], cls = B.byId(an.id);
    series.push({ id: 'user', label: 'your cost', fn: userFn, state: 'default' });
    if (d) series.push({ id: 'dom', label: 'just ' + an.dominantText, fn: function (x) { var v = B.termValue(d, x); return isFinite(v) ? Math.min(Math.abs(v), B.CAP) : B.CAP; }, state: STATE_OF[an.id] || 'path', dashed: true });
    if (cls && d && !(d.c === 1 && an.id !== 'nk')) series.push({ id: 'cls', label: SHORT[an.id], fn: cls.f, state: 'muted', dashed: true });
    var xmax = S.ownX, ymax, log = S.ownMode === 'log';
    var top = userFn(xmax);
    if (log) {
      var lg = Math.min(Math.max(Math.ceil(userLog10(xmax) + 0.01), 1), 30);
      ownChart.render({ x: { label: 'input size n', min: 1, max: xmax, scale: 'log' }, y: { label: 'steps (log scale)', scale: 'log', min: 1, max: Math.pow(10, lg) }, series: series }, { duration: dur });
    } else {
      ymax = isFinite(top) && top > 0 ? Math.min(top * 1.1, 1e15) : 100;
      ownChart.render({ x: { label: 'input size n', min: 1, max: xmax }, y: { label: 'steps', min: 0, max: ymax }, series: series }, { duration: dur });
    }
  }
  function sharePct(v) { return v >= 0.9995 ? '100%' : v < 0.0005 ? '< 0.1%' : (v * 100 < 10 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%'; }
  function paintOwnDetail() {
    var msg = $('[data-expr-msg]'), badgeHost = $('[data-own-badge]'), detail = $('[data-own-detail]'), input = $('[data-expr]');
    VDSA.clear(badgeHost); VDSA.clear(detail);
    input.classList.toggle('is-bad', !own.ok);
    if (own.ok) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
    if (!own.ok) {
      msg.className = 'bx-expr__msg is-error';
      msg.textContent = own.error;
      $('[data-own-chart]').classList.add('is-stale');
      if (!ownDrawn) $('[data-own-chart]').setAttribute('data-empty', '');
      return;
    }
    $('[data-own-chart]').classList.remove('is-stale'); $('[data-own-chart]').removeAttribute('data-empty'); ownDrawn = true;
    msg.className = 'bx-expr__msg';
    var an = own.an;
    msg.textContent = an.terms.length ? 'Read as: ' + B.termsText(an.terms) : (an.estimated ? 'Read as a general formula (growth estimated numerically).' : '');
    badgeHost.appendChild(h('span', { class: 'bx-own-out__lab' }, 'Growth class'));
    badgeHost.appendChild(h('span', { class: 'big-o big-o--lg', 'data-o': an.id }, an.label));
    paintOwnChart(0);
    var wrap = h('div', { class: 'bx-own-grid' });
    if (an.terms && an.terms.length) {
      var sh = B.shares(an.terms, S.n);
      var main = h('p', { class: 'bx-own-sentence' });
      if (an.negative) {
        main.appendChild(document.createTextNode('The dominant term is '));
        main.appendChild(h('b', null, an.dominantText));
        main.appendChild(document.createTextNode(', which is negative, so this is not a valid cost function: the cost would eventually drop below zero. Ignoring the sign, its growth is '));
        main.appendChild(h('span', { class: 'big-o', 'data-o': an.magnitudeId }, an.magnitudeLabel));
        main.appendChild(document.createTextNode('. '));
      } else {
        main.appendChild(document.createTextNode('The dominant term is '));
        main.appendChild(h('b', null, an.dominantText));
        main.appendChild(document.createTextNode(', so the cost is '));
        main.appendChild(h('span', { class: 'big-o', 'data-o': an.id }, an.label));
        main.appendChild(document.createTextNode('. '));
      }
      if (an.terms.length > 1 && sh) {
        var dom = sh.filter(function (s) { return s.term === an.dominant; })[0];
        main.appendChild(document.createTextNode('At n = ' + fmtN(S.n) + ' it makes up ' + sharePct(dom.share) + ' of the cost.'));
        var cross = null;
        for (var k = 0; k <= 60; k++) {
          var nn = Math.pow(2, k), s2 = B.shares(an.terms, nn);
          if (s2) { var dd = s2.filter(function (s) { return s.term === an.dominant; })[0]; if (dd && dd.share >= 0.95) { cross = nn; break; } }
        }
        if (cross !== null) main.appendChild(document.createTextNode(cross <= 1 ? ' It is within 5% of the total from the start.' : ' From about n = ' + fmtN(cross) + ' the other terms add less than 5%.'));
      }
      wrap.appendChild(main);
      if (sh && sh.length > 1) {
        var bar = h('div', { class: 'bx-stack', role: 'img', 'aria-label': 'Share of each term at n = ' + fmtN(S.n) });
        var list = h('ul', { class: 'bx-terms' });
        sh.forEach(function (s, i) {
          var seg = h('i', { class: 'bx-stack__seg', style: { width: Math.max(s.share * 100, s.share > 0 ? 0.6 : 0) + '%' }, 'data-i': String(Math.min(i, 5)) });
          bar.appendChild(seg);
          list.appendChild(h('li', null, h('i', { class: 'bx-terms__sw', 'data-i': String(Math.min(i, 5)), 'aria-hidden': 'true' }), h('span', { class: 'bx-terms__t' }, B.termText(s.term)), h('span', { class: 'bx-terms__p' }, sharePct(s.share))));
        });
        wrap.appendChild(bar); wrap.appendChild(list);
      }
    } else {
      wrap.appendChild(h('p', { class: 'bx-own-sentence' }, 'This formula is not a plain sum of terms, so its growth class is estimated numerically: ', h('b', null, an.label), '.'));
    }
    detail.appendChild(wrap);
  }

  /* ------------------------------------------------------------------ guess the class */
  var Gq = { order: [], i: -1, right: 0, total: 0, streak: 0, answered: false };
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function nextSnippet() {
    if (Gq.i + 1 >= Gq.order.length) { Gq.order = shuffle(SN.SNIPPETS.map(function (s, i) { return i; })); Gq.i = -1; }
    Gq.i++; Gq.answered = false;
    var sn = SN.SNIPPETS[Gq.order[Gq.i]];
    $('[data-code]').textContent = sn.code;
    $('[data-q]').textContent = 'How does the number of steps grow with n?';
    var opts = [sn.answer], pool = shuffle(CLASSES.map(function (c) { return c.id; }).filter(function (id) { return id !== sn.answer; }));
    while (opts.length < 4) opts.push(pool.shift());
    shuffle(opts);
    opts.sort(function (a, b) { return CLASSES.indexOf(B.byId(a)) - CLASSES.indexOf(B.byId(b)); });
    var host = $('[data-options]'); VDSA.clear(host);
    opts.forEach(function (id) {
      host.appendChild(h('button', { type: 'button', class: 'bx-opt', 'data-id': id, onclick: function () { guess(id, sn); } }, badge(id)));
    });
    VDSA.clear($('[data-reveal]'));
    $('[data-next]').hidden = true; $('[data-skip]').hidden = false;
  }
  function guess(id, sn) {
    if (Gq.answered) return; Gq.answered = true;
    var ok = id === sn.answer;
    Gq.total++; if (ok) { Gq.right++; Gq.streak++; } else Gq.streak = 0;
    VDSA.$$('[data-options] .bx-opt').forEach(function (b) {
      b.disabled = true;
      if (b.getAttribute('data-id') === sn.answer) b.classList.add('is-right');
      else if (b.getAttribute('data-id') === id) b.classList.add('is-wrong');
    });
    var rev = $('[data-reveal]'); VDSA.clear(rev);
    rev.appendChild(h('p', { class: 'bx-reveal__head ' + (ok ? 'is-ok' : 'is-no') }, ok ? 'Correct.' : 'Not this time.', ' It is ', badge(sn.answer), '.'));
    rev.appendChild(h('p', null, sn.why));
    var rows = [h('tr', null, h('th', { scope: 'col' }, 'n'), h('th', { scope: 'col', class: 'num' }, 'steps counted'), h('th', { scope: 'col', class: 'num' }, sn.unit === 'doubling' ? 'vs. previous (n doubles)' : sn.unit === 'quadruple' ? 'vs. previous (n × 4)' : 'vs. previous (n + 1)'))];
    var prev = null;
    sn.ns.forEach(function (n) {
      var c = sn.run(n);
      rows.push(h('tr', null, h('td', { class: 'num' }, fmtN(n)), h('td', { class: 'num' }, fmtN(c)), h('td', { class: 'num' }, prev === null ? '' : (prev === 0 ? '' : c === prev ? '×1' : c / prev >= 100 ? '×' + fmtN(c / prev) : '×' + (+(c / prev).toPrecision(3))))));
      prev = c;
    });
    rev.appendChild(h('div', { class: 'table-wrap bx-counts' }, h('table', { class: 'table table--compact' }, h('caption', { class: 'sr-only' }, 'Measured step counts'), h('tbody', null, rows))));
    $('[data-next]').hidden = false; $('[data-skip]').hidden = true;
    $('[data-next]').focus({ preventScroll: true });
    paintGScore();
  }
  function paintGScore() { $('[data-gscore]').textContent = Gq.total ? Gq.right + ' of ' + Gq.total + ' correct' + (Gq.streak > 1 ? ' · streak ' + Gq.streak : '') : 'No guesses yet'; }
  function buildGuess() {
    $('[data-next]').addEventListener('click', nextSnippet);
    $('[data-skip]').addEventListener('click', nextSnippet);
    nextSnippet(); paintGScore();
  }

  /* ------------------------------------------------------------------ boot */
  function keys() {
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' && t.type !== 'range' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.key === 'l' || e.key === 'L') { S.y = S.y === 'log' ? 'lin' : 'log'; yseg.set(S.y); refreshAll(800); }
      else if (e.key === 'd' || e.key === 'D') { dblStep(1); }
    });
  }
  VDSA.ready(function () {
    readUrl(); parseOwn();
    drawTeaser();
    buildToggles(); buildControls();
    chart = VDSA.views.chart($('[data-chart]'), { type: 'line', height: 400, label: 'Growth of running time for each complexity class', samples: 96 });
    chart.on('hover', function (e) { hoverN = Math.max(1, Math.round(e.x)); paintValues(); });
    var host = $('[data-chart]');
    spreadLabels(host);
    function leave() { if (hoverN !== null) { hoverN = null; paintValues(); } }
    host.addEventListener('pointerleave', leave);
    host.addEventListener('focusout', leave);
    buildValues(); buildTime(); buildDoubling(); buildOwn(); buildGuess();
    if (typeof window.VDSA_CURRICULUM !== 'undefined') {
      var l = VDSA_CURRICULUM.byId('05-big-o'), a = document.querySelector('[data-lesson]');
      if (l && l.status !== 'live' && a) { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.textContent += ' (soon)'; }
    }
    keys();
    var ownRate = VDSA.segmented($('[data-rateseg]'), { label: 'Machine speed', value: String(S.rate), options: [{ value: '6', label: '10⁶ / s · slow' }, { value: '8', label: '10⁸ / s · typical' }, { value: '9', label: '10⁹ / s · fast' }], onChange: function (v) { S.rate = +v; refreshAll(0); } });
    refreshAll(0);
  });
}());
