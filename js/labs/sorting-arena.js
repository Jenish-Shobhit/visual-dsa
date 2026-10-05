/* Sorting arena: the page. Race lanes are drawn on canvas from the adapter's frames (sorting-arena-model.js),
   the detail mode drives the lessons' own step generators through VDSA.player + views.array + the code panel. */
(function () {
  'use strict';
  var A = window.SortingArena;
  if (!A || !window.VDSA) return;
  var V = window.VDSA, h = V.h, $ = function (s, r) { return (r || document).querySelector(s); };

  var DETAIL_MAX = 40, MERGE_DETAIL_MAX = 16, MAX_LANES = 6, MIN_LANES = 2;
  var LANE_STATES = ['active', 'compare', 'done', 'pivot', 'frontier', 'visited', 'path', 'error'];   // the chart's colour slots
  var LANE_SLOT = [0, 3, 4, 2, 5, 1];                     // blue, magenta, cyan, green, purple, amber: none is red, none is orange
  var SPEEDS = { slow: 25, normal: 90, fast: 420 };
  var GROUPS = [
    { label: 'Simple, O(n²)', ids: ['bubble', 'selection', 'insertion', 'cocktail'] },
    { label: 'Divide and conquer, O(n log n)', ids: ['merge', 'quick', 'hoare', 'three', 'heap'] },
    { label: 'No comparisons', ids: ['counting', 'radix', 'bucket'] }
  ];
  var METRICS = [{ value: 'work', label: 'Ticks (both)' }, { value: 'cmp', label: 'Comparisons' }, { value: 'wr', label: 'Writes' }];

  /* ------------------------------------------------------------------ state + URL */
  var st = {
    mode: 'race', algos: ['insertion', 'merge', 'quick', 'heap'], algo: 'merge',
    preset: 'random', n: 48, seed: 7, custom: null, pivot: 'last',
    speed: 'normal', speedSet: false, view: 'auto', metric: 'work', log: false
  };
  function readUrl() {
    var q = new URLSearchParams(location.search), g = function (k) { return q.get(k); };
    if (g('mode') === 'detail') st.mode = 'detail';
    var ids = (g('algos') || '').split(',').filter(function (x) { return A.get(x); });
    ids = ids.filter(function (x, i) { return ids.indexOf(x) === i; }).slice(0, MAX_LANES);
    if (ids.length >= MIN_LANES) st.algos = ids;
    if (A.get(g('algo'))) st.algo = g('algo');
    if (A.PRESETS.some(function (p) { return p.id === g('input'); })) st.preset = g('input');
    if (g('n')) st.n = A.clampN(g('n'));
    if (g('seed') && isFinite(+g('seed'))) st.seed = Math.max(0, Math.floor(+g('seed')));
    if (g('input') === 'custom' && g('vals')) { var p = A.parseInput(g('vals')); if (p.values) { st.custom = p.values; st.preset = 'custom'; } }
    if (A.QUICK_PIVOTS.some(function (p) { return p.id === g('pivot'); })) st.pivot = g('pivot');
    if (SPEEDS[g('speed')] || g('speed') === 'turbo') { st.speed = g('speed'); st.speedSet = true; }
    if (g('view') === 'bars' || g('view') === 'boxes') st.view = g('view');
    if (METRICS.some(function (m) { return m.value === g('metric'); })) st.metric = g('metric');
    if (g('log') === '1') st.log = true;
    if (!g('speed')) st.speed = 'normal';
  }
  var urlTimer = 0;
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var q = new URLSearchParams();
      q.set('mode', st.mode);
      q.set(st.mode === 'race' ? 'algos' : 'algo', st.mode === 'race' ? st.algos.join(',') : st.algo);
      q.set('input', st.custom ? 'custom' : st.preset);
      if (st.custom) q.set('vals', st.custom.join(','));
      else { q.set('n', st.n); q.set('seed', st.seed); }
      if (st.pivot !== 'last') q.set('pivot', st.pivot);
      if (st.mode === 'race') q.set('speed', st.speed);
      if (st.mode === 'detail' && st.view !== 'auto') q.set('view', st.view);
      if (st.metric !== 'work') q.set('metric', st.metric);
      if (st.log) q.set('log', '1');
      try { history.replaceState(null, '', location.pathname + '?' + q.toString()); } catch (e) { /* file:// in some browsers */ }
    }, 120);
  }

  /* ------------------------------------------------------------------ values */
  function cap() { return st.mode === 'detail' ? (st.algo === 'merge' ? MERGE_DETAIL_MAX : DETAIL_MAX) : A.MAX_N; }
  function values() {
    if (st.custom) return st.custom.slice(0, cap());
    return A.makeInput(st.preset, Math.min(st.n, cap()), st.seed);
  }
  function lessonLive(id) { var c = window.VDSA_CURRICULUM, l = c && c.byId(id); return l && l.status === 'live' ? l : null; }
  function lessonHref(id) { var l = lessonLive(id); return l ? V.url(l.href) : null; }
  function pivotOpts() { return { pivot: st.pivot }; }
  function ord(n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]); }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function el(sel) { return $(sel); }

  /* ------------------------------------------------------------------ colours */
  var C = {};
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    A.STATE_NAMES.forEach(function (s, i) { C[i] = cs.getPropertyValue('--st-' + s).trim() || '#888'; });
    C[0] = cs.getPropertyValue('--ink-3').trim() || '#888';
    C.line = cs.getPropertyValue('--line-strong').trim() || '#ccc';
    C.paper = cs.getPropertyValue('--bg-sunken').trim() || '#eee';
  }

  /* ------------------------------------------------------------------ setup controls */
  var ui = {};
  function setupControls() {
    ui.mode = V.segmented(el('[data-sa-mode]'), {
      label: 'Mode', value: st.mode,
      options: [{ value: 'race', label: 'Race' }, { value: 'detail', label: 'One in detail' }],
      onChange: function (v) { setMode(v); }
    });
    ui.speed = V.segmented(el('[data-speed]'), {
      label: 'Speed', value: st.speed,
      options: [{ value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' }, { value: 'turbo', label: 'Turbo', title: 'Finish the longest lane in about six seconds' }],
      onChange: function (v) { st.speed = v; st.speedSet = true; syncUrl(); }
    });
    ui.metric = V.segmented(el('[data-metric]'), { label: 'What to count', value: st.metric, options: METRICS, onChange: function (v) { st.metric = v; renderGrowth(); syncUrl(); } });
    ui.view = V.segmented(el('[data-view]'), {
      label: 'Drawing', value: st.view === 'auto' ? 'auto' : st.view,
      options: [{ value: 'auto', label: 'Automatic' }, { value: 'boxes', label: 'Boxes' }, { value: 'bars', label: 'Bars' }],
      onChange: function (v) { st.view = v; buildDetail(true); syncUrl(); }
    });
    ui.log = V.toggle(el('[data-log]'), { label: 'Log scale', checked: st.log, onChange: function (c) { st.log = c; renderGrowth(); syncUrl(); } });
    ui.n = V.slider(el('[data-n]'), {
      label: 'Numbers', min: A.MIN_N, max: A.MAX_N, value: st.n, format: function (v) { return 'n = ' + v; },
      onInput: function (v) { st.n = v; st.custom = null; st.preset = st.preset === 'custom' ? 'random' : st.preset; paintPresets(); debounceRebuild(); },
      onChange: function (v) { st.n = v; rebuildNow(); }
    });
    ui.pivot = el('[data-pivot]');
    A.QUICK_PIVOTS.forEach(function (p) { ui.pivot.appendChild(h('option', { value: p.id }, p.label)); });
    ui.pivot.value = st.pivot;
    ui.pivot.addEventListener('change', function () { st.pivot = ui.pivot.value; rebuildNow(); });
    el('[data-shuffle]').addEventListener('click', newNumbers);
    var form = el('[data-custom]'), input = $('input', form), err = el('[data-custom-error]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = A.parseInput(input.value);
      if (p.error) { err.textContent = p.error; input.setAttribute('aria-invalid', 'true'); return; }
      err.textContent = ''; input.removeAttribute('aria-invalid');
      st.custom = p.values; st.preset = 'custom';
      if (st.mode === 'detail' && p.values.length > cap()) err.textContent = 'Detail mode uses the first ' + cap() + ' numbers.';
      paintPresets(); rebuildNow();
    });
    input.addEventListener('input', function () { err.textContent = ''; input.removeAttribute('aria-invalid'); });
    ui.customInput = input;
    paintPresets();
  }
  function paintPresets() {
    var box = el('[data-presets]');
    V.clear(box);
    A.PRESETS.forEach(function (p) {
      var on = !st.custom && st.preset === p.id;
      box.appendChild(h('button', {
        class: 'sa-chip', type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', tabindex: on || (!st.custom && !box.querySelector('[tabindex="0"]') && false) ? '0' : '-1',
        onclick: function () { st.preset = p.id; st.custom = null; ui.customInput.value = ''; paintPresets(); rebuildNow(); }
      }, p.label));
    });
    if (st.custom) box.appendChild(h('span', { class: 'sa-chip sa-chip--static', 'aria-current': 'true' }, 'Yours, n = ' + Math.min(st.custom.length, cap())));
    // roving tabindex: the selected chip, or the first one
    var sel = box.querySelector('[aria-checked="true"]') || box.querySelector('button');
    if (sel) sel.tabIndex = 0;
    box.onkeydown = function (e) {
      var b = Array.prototype.slice.call(box.querySelectorAll('button')), i = b.indexOf(document.activeElement), j = -1;
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % b.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + b.length) % b.length;
      if (j >= 0) { e.preventDefault(); b[j].click(); var nb = box.querySelectorAll('button')[j]; if (nb) nb.focus(); }
    };
    var slider = ui.n;
    slider.input.disabled = !!st.custom;
    slider.input.max = cap();
    slider.set(st.custom ? Math.min(st.custom.length, cap()) : Math.min(st.n, cap()));
  }
  function newNumbers() {
    st.seed = (st.seed % 9999) + 1;
    if (st.custom) { st.custom = null; st.preset = 'random'; paintPresets(); }
    rebuildNow();
  }

  function paintAlgos() {
    var box = el('[data-algos]'), race = st.mode === 'race';
    V.clear(box);
    el('[data-algos-legend]').textContent = race ? 'Racers (pick 2 to 6)' : 'Algorithm';
    GROUPS.forEach(function (g) {
      var row = h('div', { class: 'sa-group-row', role: race ? 'group' : 'radiogroup', 'aria-label': g.label }, h('span', { class: 'sa-group-row__name' }, g.label));
      var chips = h('div', { class: 'sa-chips' });
      g.ids.forEach(function (id) {
        var a = A.get(id), i = st.algos.indexOf(id), on = race ? i >= 0 : st.algo === id;
        var slot = race && i >= 0 ? LANE_SLOT[i] : null;
        chips.appendChild(h('button', Object.assign({
          class: 'sa-chip sa-chip--algo', type: 'button', 'data-id': id,
          style: slot === null ? null : { '--lane': 'var(--st-' + LANE_STATES[slot] + ')' },
          onclick: function () { pickAlgo(id); }
        }, race ? { 'aria-pressed': on ? 'true' : 'false' } : { role: 'radio', 'aria-checked': on ? 'true' : 'false' }),
          h('span', { class: 'sa-chip__dot', 'aria-hidden': 'true' }), a.short));
      });
      row.appendChild(chips); box.appendChild(row);
    });
    ui.pivot.closest('label').hidden = !(race ? st.algos.indexOf('quick') >= 0 || st.algos.indexOf('hoare') >= 0 || st.algos.indexOf('three') >= 0 : ['quick', 'hoare', 'three'].indexOf(st.algo) >= 0);
  }
  function hint(msg) { el('[data-hint]').textContent = msg || ''; }
  function pickAlgo(id) {
    if (st.mode === 'detail') { st.algo = id; paintAlgos(); paintPresets(); buildDetail(); syncUrl(); return; }
    var i = st.algos.indexOf(id);
    if (i >= 0) {
      if (st.algos.length <= MIN_LANES) { hint('A race needs at least two racers.'); return; }
      st.algos.splice(i, 1);
    } else {
      if (st.algos.length >= MAX_LANES) { hint('Six lanes is the limit. Switch one off first.'); return; }
      st.algos.push(id);
    }
    hint(''); paintAlgos(); rebuildNow();
  }

  function setMode(m) {
    if (m === st.mode) return;
    st.mode = m;
    ui.mode.set(m);
    el('[data-group="race"]').hidden = m !== 'race';
    el('[data-group="detail"]').hidden = m !== 'detail';
    if (m === 'detail') { pause(); if (st.algos.indexOf(st.algo) < 0 && A.get(st.algo) === null) st.algo = st.algos[0]; }
    paintAlgos(); paintPresets();
    rebuildNow(); syncUrl();
  }

  /* ------------------------------------------------------------------ the race */
  var race = { lanes: [], t: 0, max: 0, playing: false, last: 0, raf: 0, dirty: true, podium: [], vals: [] };
  var rebuildTimer = 0;
  function debounceRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuildNow, 140); }
  function rebuildNow() {
    clearTimeout(rebuildTimer);
    syncUrl();
    if (st.mode === 'race') buildRace(); else buildDetail();
    renderGrowth();
  }

  function pause() { race.playing = false; paintPlay(); }
  function paintPlay() {
    var b = $('[data-act="play"]'), atEnd = race.t >= race.max && race.max > 0;
    b.classList.toggle('is-playing', race.playing);
    b.setAttribute('aria-label', race.playing ? 'Pause (Space)' : (atEnd ? 'Run the race again (Space)' : (race.t > 0 ? 'Continue (Space)' : 'Start the race (Space)')));
    b.setAttribute('aria-pressed', race.playing ? 'true' : 'false');
  }

  /* Range inputs paint their fill from --p (percent), like the other labs. */
  function setRange(r, v) { r.value = v; r.style.setProperty('--p', (+r.max > 0 ? 100 * (+r.value) / (+r.max) : 0) + '%'); }
  function paintRange(r) { r.style.setProperty('--p', (+r.max > 0 ? 100 * (+r.value) / (+r.max) : 0) + '%'); }

  function buildRace() {
    var box = el('[data-lanes]'), vals = values(), t0 = performance.now();
    race.vals = vals;
    V.clear(box);
    race.lanes = st.algos.map(function (id, i) {
      var info = A.get(id), lane = A.buildLane(id, vals, pivotOpts());
      var href = lessonHref(info.lesson);
      var canvas = h('canvas', { class: 'sa-lane__cv', role: 'img', 'aria-label': info.name + ': bars showing the array as it is sorted' });
      lane.info = info; lane.slot = LANE_SLOT[i]; lane.lock = null; lane.canvas = canvas; lane.cw = 0; lane.ch = 0;
      lane.rankEl = h('span', { class: 'sa-lane__rank', hidden: true });
      lane.cmpEl = h('b', null, '0'); lane.wrEl = h('b', null, '0');
      lane.range = h('input', { class: 'range sa-lane__range', type: 'range', min: 0, max: lane.total, step: 1, value: 0, 'aria-label': info.name + ' clock, in ticks' });
      lane.followBtn = h('button', { class: 'sa-mini', type: 'button', hidden: true, title: 'Follow the shared clock again', 'aria-label': info.name + ': follow the shared clock again' }, '↺');
      lane.prevBtn = h('button', { class: 'sa-mini', type: 'button', title: 'Previous step in this lane', 'aria-label': info.name + ': previous step' }, '‹');
      lane.nextBtn = h('button', { class: 'sa-mini', type: 'button', title: 'Next step in this lane', 'aria-label': info.name + ': next step' }, '›');
      lane.el = h('article', { class: 'sa-lane', style: { '--lane': 'var(--st-' + LANE_STATES[lane.slot] + ')' }, 'data-id': id },
        h('header', { class: 'sa-lane__head' },
          h('span', { class: 'sa-lane__dot', 'aria-hidden': 'true' }),
          h('h3', { class: 'sa-lane__name' }, info.name),
          lane.rankEl,
          href ? h('a', { class: 'sa-lane__learn', href: href }, 'Learn how it works →') : null),
        canvas,
        h('div', { class: 'sa-lane__foot' },
          h('span', { class: 'sa-lane__ct' }, 'Comparisons ', lane.cmpEl),
          h('span', { class: 'sa-lane__ct' }, 'Writes ', lane.wrEl),
          h('span', { class: 'sa-lane__cost', title: info.note }, info.cost)),
        h('div', { class: 'sa-lane__mini' }, lane.prevBtn, lane.range, lane.nextBtn, lane.followBtn));
      paintRange(lane.range);
      lane.range.addEventListener('input', function () { paintRange(lane.range); pause(); lane.lock = +lane.range.value; race.dirty = true; });
      lane.prevBtn.addEventListener('click', function () { pause(); stepLane(lane, -1); });
      lane.nextBtn.addEventListener('click', function () { pause(); stepLane(lane, 1); });
      lane.followBtn.addEventListener('click', function () { lane.lock = null; race.dirty = true; });
      box.appendChild(lane.el);
      V.onResize(canvas, function () { race.dirty = true; });
      return lane;
    });
    box.setAttribute('data-count', race.lanes.length);
    race.max = Math.max.apply(null, race.lanes.map(function (l) { return l.total; }));
    race.podium = A.podium(race.lanes);
    race.t = 0; race.playing = false; race.dirty = true;
    var scrub = el('[data-scrub]'); scrub.max = race.max; setRange(scrub, 0);
    el('[data-race-title]').textContent = 'Same ' + vals.length + ' numbers, one clock';
    paintPlay(); paintAlgos();
    renderResults();
    el('[data-status]').textContent = race.lanes.length + ' lanes ready. The longest one needs ' + num(race.max) + ' ticks.';
    if (performance.now() - t0 > 400) el('[data-status]').textContent += ' (Big inputs take a moment to prepare.)';
    kick();
  }

  function stepLane(lane, d) {
    var i = A.laneIndexAt(lane, lane.lock === null ? race.t : lane.lock);
    var j = Math.max(0, Math.min(lane.F - 1, i + d));
    lane.lock = lane.w[j]; race.dirty = true;
  }

  function laneTime(lane) { return lane.lock === null ? race.t : lane.lock; }

  function drawLane(lane) {
    var cv = lane.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, hgt = cv.clientHeight;
    if (!w || !hgt) return;
    if (lane.cw !== w || lane.ch !== hgt) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); lane.cw = w; lane.ch = hgt; }
    var g = cv.getContext('2d'), n = lane.n, tl = laneTime(lane), idx = A.laneIndexAt(lane, tl), base = idx * n;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    var pad = 6, top = 6, bottom = 4, bw = (w - 2 * pad) / n, gap = bw >= 5 ? Math.min(2, bw * 0.18) : 0, bh = hgt - top - bottom;
    for (var i = 0; i < n; i++) {
      var v = lane.vals[base + i], s = lane.st[base + i], bar = Math.max(2, (v / (A.MAXV + 1)) * bh);
      g.fillStyle = C[s] || C[0];
      g.globalAlpha = s === 0 ? 0.62 : (s === 6 || s === 12 ? 0.5 : 1);
      g.fillRect(pad + i * bw + gap / 2, top + bh - bar, Math.max(1, bw - gap), bar);
    }
    g.globalAlpha = 1;
    g.fillStyle = C.line; g.fillRect(pad, top + bh, w - 2 * pad, 1);
    lane.cmpEl.textContent = num(lane.c[idx]); lane.wrEl.textContent = num(lane.r[idx]);
    var fin = tl >= lane.total;
    lane.el.classList.toggle('is-done', fin);
    lane.el.classList.toggle('is-locked', lane.lock !== null);
    lane.followBtn.hidden = lane.lock === null;
    if (+lane.range.value !== Math.round(tl) && document.activeElement !== lane.range) setRange(lane.range, Math.round(tl));
    lane.prevBtn.disabled = idx <= 0; lane.nextBtn.disabled = idx >= lane.F - 1;
    var rk = race.podium.filter(function (p) { return p.id === lane.id; })[0];
    lane.rankEl.hidden = !fin;
    if (fin && rk) lane.rankEl.textContent = ord(rk.rank), lane.rankEl.setAttribute('data-rank', Math.min(rk.rank, 4));
  }

  function paintRace() {
    race.lanes.forEach(drawLane);
    var scrub = el('[data-scrub]');
    if (document.activeElement !== scrub) setRange(scrub, Math.round(race.t));
    el('[data-clock]').textContent = num(Math.round(race.t)) + ' / ' + num(race.max);
    paintPodium();
  }

  function rate() {
    if (st.speed === 'turbo') return Math.max(SPEEDS.fast, race.max / 6);
    return SPEEDS[st.speed] || SPEEDS.normal;
  }
  function frame(now) {
    race.raf = 0;
    var dt = Math.min(0.1, (now - race.last) / 1000); race.last = now;
    if (race.playing) {
      race.t = Math.min(race.max, race.t + rate() * dt);
      race.dirty = true;
      if (race.t >= race.max) { race.playing = false; paintPlay(); announceFinish(); }
    }
    if (race.dirty) { race.dirty = false; paintRace(); }
    if (race.playing) race.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!race.raf) { race.last = performance.now(); race.raf = requestAnimationFrame(frame); } }

  function play() {
    if (!race.lanes.length) return;
    if (race.t >= race.max) { race.t = 0; race.lanes.forEach(function (l) { l.lock = null; }); }
    race.playing = true; paintPlay(); el('[data-status]').textContent = ''; kick();
  }
  function toggle() { if (race.playing) pause(); else play(); }
  function restart() { pause(); race.t = 0; race.lanes.forEach(function (l) { l.lock = null; }); race.dirty = true; paintPlay(); el('[data-status]').textContent = ''; kick(); }
  function clockTo(t) { race.t = Math.max(0, Math.min(race.max, t)); race.lanes.forEach(function (l) { l.lock = null; }); race.dirty = true; kick(); }
  function stepClock(d) {
    pause();
    var t = race.t, best = null;
    race.lanes.forEach(function (l) {
      var i = A.laneIndexAt(l, t), c;
      if (d > 0) { if (i + 1 < l.F) { c = l.w[i + 1]; if (c > t && (best === null || c < best)) best = c; } }
      else { c = l.w[i] < t ? l.w[i] : (i > 0 ? l.w[i - 1] : null); if (c !== null && c < t && (best === null || c > best)) best = c; }
    });
    clockTo(best === null ? (d > 0 ? race.max : 0) : best);
  }
  function announceFinish() {
    var p = race.podium, first = p[0], last = p[p.length - 1];
    var f = A.get(first.id), l = A.get(last.id);
    var msg = f.name + ' finished first with ' + num(first.total) + ' ticks';
    if (p.length > 1) msg += '; ' + l.name + ' needed ' + num(last.total) + (first.total > 0 && last.total > first.total ? ' (' + (last.total / first.total).toFixed(1).replace(/\.0$/, '') + '× as many)' : '') + '.';
    el('[data-status]').textContent = msg;
  }

  /* ------------------------------------------------------------------ podium, chart, table */
  var podiumKey = '';
  function paintPodium() {
    var box = el('[data-podium]'), done = race.podium.filter(function (p) { return race.t >= p.total; });
    var key = race.podium.length + ':' + done.map(function (d) { return d.id; }).join();
    if (key === podiumKey) return;
    podiumKey = key;
    V.clear(box);
    var slots = Math.min(3, race.podium.length), order = [1, 0, 2].filter(function (i) { return i < slots; });
    var wrap = h('ol', { class: 'sa-pod', 'data-slots': slots });
    order.forEach(function (i) {
      var d = done[i], info = d && A.get(d.id), lane = d && race.lanes.filter(function (l) { return l.id === d.id; })[0];
      wrap.appendChild(h('li', { class: 'sa-pod__col' + (d ? ' is-filled' : ''), 'data-place': i + 1, style: lane ? { '--lane': 'var(--st-' + LANE_STATES[lane.slot] + ')' } : null },
        h('span', { class: 'sa-pod__who' }, d ? info.short : '…'),
        h('span', { class: 'sa-pod__work' }, d ? num(d.total) + ' ticks' : ''),
        h('span', { class: 'sa-pod__step' }, h('b', null, d ? ord(d.rank) : ord(i + 1)))));
    });
    box.appendChild(wrap);
    if (race.podium.length > 3) {
      var rest = h('ol', { class: 'sa-rest', start: 4 });
      race.podium.slice(3).forEach(function (p, k) {
        var d = done.filter(function (x) { return x.id === p.id; })[0];
        rest.appendChild(h('li', null, h('span', null, d ? ord(p.rank) : '…'), ' ', d ? A.get(p.id).short : '', d ? h('small', null, ' ' + num(p.total) + ' ticks') : null));
      });
      box.appendChild(rest);
    }
  }

  var chartRes = null, chartGrowth = null;
  function renderResults() {
    podiumKey = ''; paintPodium();
    var lanes = race.lanes;
    if (!chartRes) chartRes = V.views.chart(el('[data-results-chart]'), { type: 'bar', label: 'Comparisons and writes for each algorithm', height: 240 });
    chartRes.render({
      categories: lanes.map(function (l) { return l.info.short; }),
      series: [
        { id: 'cmp', label: 'Comparisons', values: lanes.map(function (l) { return l.cmp; }), state: 'compare' },
        { id: 'wr', label: 'Writes', values: lanes.map(function (l) { return l.wr; }), state: 'swap' }
      ],
      y: { label: 'count', min: 0 }
    }, { duration: 500 });
    var tb = $('tbody', el('[data-table]'));
    V.clear(tb);
    race.podium.forEach(function (p) {
      var l = race.lanes.filter(function (x) { return x.id === p.id; })[0], i = l.info;
      tb.appendChild(h('tr', null,
        h('th', { scope: 'row' }, h('span', { class: 'sa-dot', style: { '--lane': 'var(--st-' + LANE_STATES[l.slot] + ')' }, 'aria-hidden': 'true' }), i.name),
        h('td', { class: 'num' }, num(l.cmp)), h('td', { class: 'num' }, num(l.wr)), h('td', { class: 'num' }, num(l.total)),
        h('td', null, i.stable ? 'Yes' : 'No'), h('td', null, i.inPlace ? 'Yes' : 'No'), h('td', null, i.cost)));
    });
  }

  /* ------------------------------------------------------------------ growth chart (counts only) */
  var growthCache = {}, growthToken = 0;
  function growthIds() { return st.mode === 'race' ? st.algos : [st.algo].concat(st.algos.filter(function (a) { return a !== st.algo; })).slice(0, MAX_LANES); }
  function renderGrowth() {
    var ids = growthIds(), preset = st.custom ? 'random' : st.preset, token = ++growthToken;
    el('[data-growth-input]').textContent = st.custom ? '(your numbers cannot scale, so random input is used)' : '(' + A.PRESETS.filter(function (p) { return p.id === preset; })[0].label.toLowerCase() + ' input)';
    var todo = ids.filter(function (id) { return !growthCache[key(id, preset)]; });
    function key(id, p) { return id + '|' + p + '|' + st.pivot; }
    function next() {
      if (token !== growthToken) return;
      if (!todo.length) { drawGrowth(ids, preset); return; }
      var id = todo.shift();
      growthCache[key(id, preset)] = A.growth([id], preset, pivotOpts()).series[id];
      setTimeout(next, 0);
    }
    if (todo.length) el('[data-growth-note]').textContent = 'Counting…';
    setTimeout(next, 0);
  }
  var growthDrawn = false;
  function drawGrowth(ids, preset) {
    if (!chartGrowth) chartGrowth = V.views.chart(el('[data-growth-chart]'), { type: 'line', label: 'Operations against input size for each algorithm', height: 340, labels: 'auto' });
    var ns = A.GROWTH_NS, log = st.log;
    var series = ids.map(function (id, i) {
      var g = growthCache[id + '|' + preset + '|' + st.pivot];
      var ys = ns.map(function (n, k) { var v = st.metric === 'cmp' ? g.cmp[k] : st.metric === 'wr' ? g.wr[k] : g.cmp[k] + g.wr[k]; return log ? Math.max(1, v) : v; });
      return { id: id, label: A.get(id).short, points: ns.map(function (n, k) { return [n, ys[k]]; }), color: LANE_SLOT[st.algos.indexOf(id) >= 0 ? st.algos.indexOf(id) : i % LANE_SLOT.length] };
    });
    var top = Math.max.apply(null, series.map(function (s) { return Math.max.apply(null, s.points.map(function (p) { return p[1]; })); }));
    chartGrowth.render({
      x: { label: 'input size n', min: 8, max: 256, ticks: [8, 32, 64, 128, 192, 256] },
      y: log ? { label: (st.metric === 'work' ? 'ticks' : st.metric === 'cmp' ? 'comparisons' : 'writes') + ' (log scale)', scale: 'log', min: 1, max: Math.pow(10, Math.ceil(Math.log10(Math.max(10, top)))) }
        : { label: st.metric === 'work' ? 'ticks' : st.metric === 'cmp' ? 'comparisons' : 'writes', min: 0 },
      series: series
    }, { duration: growthDrawn ? 500 : 0 });
    growthDrawn = true;
    var at256 = series.map(function (s) { return { id: s.id, v: s.points[s.points.length - 1][1] }; }).sort(function (a, b) { return a.v - b.v; });
    el('[data-growth-note]').textContent = 'At n = 256: ' + at256.map(function (s) { return A.get(s.id).short + ' ' + num(s.v); }).join(', ') + '.';
  }

  /* ------------------------------------------------------------------ detail mode */
  var det = { player: null, view: null, code: null, vars: null, mode: '', legend: false };
  function detailItems(id, step, n) {
    // radix and bucket sort draw as buckets in their lesson; here: list items keep their slots, bucketed items fill the gaps in bucket order
    var scale = id === 'bucket' ? A.MAXV + 1 : 1, free = [], taken = {}, out = [], bucketed = [];
    step.items.forEach(function (x) {
      if (x.where === 'list') { taken[x.index] = true; out.push({ id: x.id, value: Math.round(x.value * scale), state: x.state, index: x.index }); } else bucketed.push(x);
    });
    for (var i = 0; i < n; i++) if (!taken[i]) free.push(i);
    bucketed.sort(function (a, b) { return (a.bucket - b.bucket) || (a.depth - b.depth); });
    bucketed.forEach(function (x, j) { out.push({ id: x.id, value: Math.round(x.value * scale), state: x.state === 'default' ? 'visited' : x.state, index: free[j], badge: 'b' + x.bucket }); });
    return { items: out, regions: [], pointers: [] };
  }
  function viewState(step, n) {
    if (step.items && step.items.length && step.items[0].where) return detailItems(st.algo, step, n);
    return step;
  }
  function detailMode(n) {
    if (st.view === 'boxes') return 'boxes';
    if (st.view === 'bars') return 'bars';
    if (st.algo === 'counting') return 'cells';
    return n <= 16 ? 'boxes' : 'bars';
  }
  function buildDetail(remode) {
    var vals = values(), info = A.get(st.algo), steps = A.steps(st.algo, vals, pivotOpts()), n = vals.length;
    var mode = detailMode(n), stage = $('[data-stage]', el('#detail-fig'));
    el('[data-detail-title]').textContent = info.name + ' on ' + n + ' numbers';
    var learn = el('[data-detail-learn]'), href = lessonHref(info.lesson);
    learn.hidden = !href; if (href) learn.href = href;
    if (!det.legend) {
      det.legend = true;
      V.legend(el('[data-detail-legend]'), ['compare', 'swap', 'pivot', 'key', 'visited', 'done', { state: 'default', label: 'Untouched', color: 'var(--st-default)' }]);
    }
    if (!det.view || det.mode !== mode) {
      if (det.view) det.view.destroy();
      V.clear(stage);
      det.view = V.views.array(stage, { mode: mode, maxValue: A.MAXV + 1, minValue: 0, label: info.name + ' on ' + n + ' numbers', showIndices: mode !== 'bars' || n <= 40 });
      det.mode = mode;
    } else det.view.reset();
    var langs = A.codeOf(st.algo);
    if (!det.code) det.code = V.codePanel(el('#detail-fig [data-code]'), { languages: langs, default: 'pseudo', maxHeight: 420 });
    else { det.code.setSource(langs); }
    if (!det.vars) det.vars = V.varsPanel(el('#detail-fig [data-vars]'), { title: 'Variables' });
    det.view.prepare(steps.map(function (s) { return viewState(s, n); }));
    if (!det.player) {
      det.player = V.player({
        root: '#detail-fig', steps: steps, code: det.code, vars: det.vars,
        caption: '[data-caption]', counters: '[data-counters]',
        counterLabels: { comparisons: 'Comparisons', swaps: 'Swaps', shifts: 'Shifts', writes: 'Writes', tallies: 'Tallies', additions: 'Additions', placements: 'Placements', passes: 'Passes', drops: 'Drops', collected: 'Collected', scattered: 'Scattered', sortedBuckets: 'Buckets sorted' },
        counterStates: { comparisons: 'compare', swaps: 'swap', shifts: 'swap', writes: 'swap' },
        baseStepMs: n > 16 ? 260 : 700, animMs: n > 16 ? 200 : 500, speeds: [0.5, 1, 2, 4, 8, 16], speed: n > 16 ? 2 : 1,
        label: info.name + ' controls',
        render: function (step, ctx) { det.view.render(viewState(step, det.n), { duration: ctx.duration }); }
      });
      det.n = n;
    } else {
      det.n = n;
      det.player.setSteps(steps);
    }
    if (remode) det.player.refresh();
  }

  /* ------------------------------------------------------------------ keys */
  function keys() {
    document.addEventListener('keydown', function (e) {
      if (st.mode !== 'race' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' && t.type !== 'range' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      var k = e.key;
      if (k === ' ' || k === 'k' || k === 'K') { if (tag === 'BUTTON' || tag === 'A') return; e.preventDefault(); toggle(); }
      else if (k === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); stepClock(1); }
      else if (k === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); stepClock(-1); }
      else if (k === 'Home' && tag !== 'INPUT') { e.preventDefault(); restart(); }
      else if (k === 'n' || k === 'N') newNumbers();
      else if (k === '+' || k === '=' || k === '-' || k === '_') {
        var order = ['slow', 'normal', 'fast', 'turbo'], i = order.indexOf(st.speed), j = Math.max(0, Math.min(3, i + (k === '-' || k === '_' ? -1 : 1)));
        st.speed = order[j]; st.speedSet = true; ui.speed.set(st.speed); syncUrl();
      }
    });
  }

  /* ------------------------------------------------------------------ lesson links */
  function lessonLinks() {
    var box = el('[data-lessons]'), ids = ['14-elementary-sorts', '15-merge-sort', '16-quick-sort', '17-linear-time-sorts', '21-heaps'], any = false;
    box.appendChild(h('span', { class: 'sa-lessons__lead' }, 'Learn how they work:'));
    ids.forEach(function (id) {
      var l = lessonLive(id);
      if (!l) return;
      any = true;
      box.appendChild(h('a', { class: 'chip chip--link', href: V.url(l.href) }, l.title));
    });
    if (!any) box.hidden = true;
  }

  /* ------------------------------------------------------------------ boot */
  V.ready(function () {
    readUrl();
    readColors();
    V.theme.onChange(function () { readColors(); race.dirty = true; kick(); });
    if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { setTimeout(function () { readColors(); race.dirty = true; kick(); }, 0); }); } catch (e) { /* old Safari */ } }
    V.legend(el('#arena [data-legend]'), ['compare', 'swap', 'pivot', 'key', 'visited', 'done', { state: 'default', label: 'Waiting', color: 'var(--ink-3)' }]);
    setupControls();
    $('[data-act="restart"]').addEventListener('click', restart);
    $('[data-act="play"]').addEventListener('click', toggle);
    $('[data-act="back"]').addEventListener('click', function () { stepClock(-1); });
    $('[data-act="fwd"]').addEventListener('click', function () { stepClock(1); });
    el('[data-scrub]').addEventListener('input', function () { paintRange(el('[data-scrub]')); pause(); clockTo(+el('[data-scrub]').value); });
    keys(); lessonLinks();
    el('[data-group="race"]').hidden = st.mode !== 'race';
    el('[data-group="detail"]').hidden = st.mode !== 'detail';
    ui.mode.set(st.mode); ui.speed.set(st.speed);
    paintAlgos(); paintPresets();
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { if (!es[0].isIntersecting) pause(); }, { threshold: 0 }).observe(el('#arena'));
    rebuildNow();
  });
}());
