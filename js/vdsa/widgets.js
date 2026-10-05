/* Visual DSA widgets: small UI helpers every lesson uses.

   VDSA.tabs(el, {onChange})                         enhance .tabs markup (buttons[data-tab] + [data-tab-panel])
   VDSA.segmented(el, {options, value, onChange, label})
   VDSA.inputRow(el, {label, value, parse, presets, onApply, applyLabel, hint})
   VDSA.presets.random/sorted/reversed/nearlySorted/fewUnique/allEqual(n, opts)   (pure; also in Node)
   VDSA.slider(el, {label, min, max, step, value, format, onInput, onChange})
   VDSA.legend(el, ['compare', {state: 'key', label: 'Best so far', shape: 'ring'}])
   VDSA.stats(el, {labels, states})  -> {update(obj)}
   VDSA.toggle(el, {label, checked, onChange})
   VDSA.teaser(el, {steps, render, stepMs, loop, holdMs, staticIndex})
*/
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  /* ---------------------------------------------------------------- presets (pure) */
  function makeRng(opts) {
    if (opts && typeof opts.rng === 'function') return opts.rng;
    if (opts && opts.seed !== undefined) {
      var a = opts.seed >>> 0;
      return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    return Math.random;
  }
  function rint(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  var presets = {
    /* random(n, {min=1, max=99, unique=false, seed|rng}) */
    random: function (n, opts) {
      opts = opts || {}; var r = makeRng(opts), lo = opts.min === undefined ? 1 : opts.min, hi = opts.max === undefined ? 99 : opts.max;
      var out = [];
      if (opts.unique && hi - lo + 1 >= n) { var pool = []; for (var v = lo; v <= hi; v++) pool.push(v); for (var i = 0; i < n; i++) { var j = i + Math.floor(r() * (pool.length - i)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; out.push(pool[i]); } return out; }
      for (var k = 0; k < n; k++) out.push(rint(r, lo, hi));
      return out;
    },
    sorted: function (n, opts) { return presets.random(n, Object.assign({ unique: true }, opts)).sort(function (a, b) { return a - b; }); },
    reversed: function (n, opts) { return presets.sorted(n, opts).reverse(); },
    /* nearlySorted: sorted, then `swaps` random adjacent swaps (default max(1, n/5)); never fully sorted */
    nearlySorted: function (n, opts) {
      opts = opts || {}; var r = makeRng(opts), arr = presets.sorted(n, opts);
      var swaps = opts.swaps === undefined ? Math.max(1, Math.round(n / 5)) : opts.swaps;
      for (var s = 0; s < swaps && n > 1; s++) { var i = rint(r, 0, n - 2); var t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t; }
      /* swaps can cancel out; when swaps were asked for, never hand back a fully sorted array */
      if (swaps > 0 && n > 1 && arr.every(function (v, k) { return k === 0 || arr[k - 1] <= v; })) {
        var m = Math.floor(n / 2) - 1, u = arr[m]; arr[m] = arr[m + 1]; arr[m + 1] = u;
      }
      return arr;
    },
    /* fewUnique: values drawn from only k distinct numbers (default 3) */
    fewUnique: function (n, opts) {
      opts = opts || {}; var r = makeRng(opts), k = opts.k || 3;
      var vals = presets.random(k, Object.assign({}, opts, { unique: true }));
      var out = []; for (var i = 0; i < n; i++) out.push(vals[rint(r, 0, vals.length - 1)]);
      return out;
    },
    allEqual: function (n, opts) { var v = (opts && opts.value) || 5; var out = []; for (var i = 0; i < n; i++) out.push(v); return out; }
  };

  var api = { presets: presets };
  if (!win) return api;

  var VDSA = win.VDSA = win.VDSA || {};
  var doc = win.document;
  var h = VDSA.h;
  VDSA.presets = presets;

  function fire(list, arg) { list.forEach(function (fn) { try { fn(arg); } catch (e) { console.error(e); } }); }

  /* ---------------------------------------------------------------- tabs */
  /* Markup:
       <div class="tabs">
         <div class="tabs__list"><button class="tabs__tab" data-tab="a">A</button>…</div>
         <div class="tabs__panel" data-tab-panel="a">…</div>…
       </div> */
  VDSA.tabs = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var list = el.querySelector('.tabs__list, [role="tablist"]');
    var buttons = VDSA.$$('[data-tab]', list);
    var panels = VDSA.$$('[data-tab-panel]', el).filter(function (p) { return p.closest('.tabs') === el; });
    var listeners = opts.onChange ? [opts.onChange] : [];
    var uid = VDSA.uid('tabs');
    list.setAttribute('role', 'tablist');
    buttons.forEach(function (b) {
      var name = b.getAttribute('data-tab');
      b.classList.add('tabs__tab');
      b.setAttribute('role', 'tab'); b.setAttribute('type', 'button');
      b.id = b.id || uid + '-t-' + name;
      var panel = panels.filter(function (p) { return p.getAttribute('data-tab-panel') === name; })[0];
      if (panel) { panel.id = panel.id || uid + '-p-' + name; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', b.id); panel.classList.add('tabs__panel'); b.setAttribute('aria-controls', panel.id); }
      b.addEventListener('click', function () { select(name, true); });
    });
    list.addEventListener('keydown', function (e) {
      var i = buttons.indexOf(doc.activeElement); if (i < 0) return;
      var j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % buttons.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = buttons.length - 1;
      if (j !== null) { e.preventDefault(); e.stopPropagation(); buttons[j].focus(); select(buttons[j].getAttribute('data-tab'), true); }
    });
    var value = null;
    function select(name, user) {
      value = name;
      buttons.forEach(function (b) { var on = b.getAttribute('data-tab') === name; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-tab-panel') !== name; });
      if (user) fire(listeners, name);
    }
    var initial = opts.value || (buttons.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0] || buttons[0] || { getAttribute: function () { return null; } }).getAttribute('data-tab');
    if (initial) select(initial, false);
    return { el: el, select: function (n) { select(n, true); }, get value() { return value; }, onChange: function (fn) { listeners.push(fn); } };
  };

  /* ---------------------------------------------------------------- segmented control */
  /* options: ['a', 'b'] or [{value, label}] */
  VDSA.segmented = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var items = (opts.options || []).map(function (o) { return typeof o === 'object' ? o : { value: o, label: String(o) }; });
    var listeners = opts.onChange ? [opts.onChange] : [];
    el.classList.add('seg');
    el.setAttribute('role', 'radiogroup');
    if (opts.label) el.setAttribute('aria-label', opts.label);
    VDSA.clear(el);
    var value = opts.value !== undefined ? opts.value : (items[0] && items[0].value);
    var buttons = items.map(function (it) {
      var b = h('button', { type: 'button', class: 'seg__btn', role: 'radio', 'data-value': String(it.value), title: it.title || null }, it.label);
      b.addEventListener('click', function () { set(it.value, true); });
      el.appendChild(b);
      return b;
    });
    el.addEventListener('keydown', function (e) {
      var i = items.map(function (it) { return it.value; }).indexOf(value), j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % items.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
      if (j !== null) { e.preventDefault(); e.stopPropagation(); set(items[j].value, true); buttons[j].focus(); }
    });
    function set(v, user) {
      value = v;
      buttons.forEach(function (b, k) { var on = items[k].value === v; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      if (user) fire(listeners, v);
    }
    set(value, false);
    return { el: el, get value() { return value; }, set: function (v) { set(v, false); }, onChange: function (fn) { listeners.push(fn); } };
  };

  /* ---------------------------------------------------------------- input row */
  /* opts: {label, value (string|array), placeholder, parse ({min,max,maxCount,…} for VDSA.parseNumbers, or fn(text)->{values,error}),
            presets: [{label, value: array|string|fn()}], onApply(values, text), applyLabel, hint} */
  VDSA.inputRow = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var uid = VDSA.uid('in');
    el.classList.add('input-row');
    VDSA.clear(el);
    function toText(v) { return Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v); }
    var field = h('input', { class: 'field', id: uid, type: 'text', inputmode: opts.inputmode || 'text', autocomplete: 'off', spellcheck: 'false', value: toText(opts.value), placeholder: opts.placeholder || 'e.g. 5, 3, 8, 1', 'aria-describedby': uid + '-err' });
    var apply = h('button', { type: 'button', class: 'btn btn--primary' }, opts.applyLabel || 'Apply');
    var err = h('p', { class: 'input-row__error', id: uid + '-err', role: 'alert' });
    el.appendChild(h('div', { class: 'input-row__field' },
      h('label', { class: 'field-label', for: uid }, opts.label || 'Your input'),
      h('div', { class: 'input-row__control' }, field, apply)));
    if (opts.presets && opts.presets.length) {
      var row = h('div', { class: 'input-row__presets', role: 'group', 'aria-label': 'Presets' });
      opts.presets.forEach(function (p) {
        row.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title || null, onclick: function () {
          var v = typeof p.value === 'function' ? p.value() : p.value;
          field.value = toText(v);
          run();
        } }, p.label));
      });
      el.appendChild(row);
    }
    if (opts.hint) el.appendChild(h('p', { class: 'input-row__hint' }, opts.hint));
    el.appendChild(err);
    function parse(text) {
      if (typeof opts.parse === 'function') return opts.parse(text);
      return VDSA.parseNumbers(text, opts.parse || {});
    }
    var last = null;
    function setError(msg) {
      err.textContent = msg || '';
      if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    }
    function run() {
      var r = parse(field.value);
      if (r.error) { setError(r.error); return false; }
      setError('');
      last = r.values;
      if (opts.onApply) opts.onApply(r.values, field.value);
      return true;
    }
    apply.addEventListener('click', run);
    field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    field.addEventListener('input', function () { if (err.textContent) setError(''); });
    return {
      el: el, field: field,
      get: function () { return last; },
      set: function (v, doApply) { field.value = toText(v); if (doApply !== false) run(); },
      apply: run,
      setError: setError
    };
  };

  /* ---------------------------------------------------------------- slider */
  VDSA.slider = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var uid = VDSA.uid('sl');
    var min = opts.min === undefined ? 0 : opts.min, max = opts.max === undefined ? 100 : opts.max;
    var fmt = opts.format || function (v) { return String(v); };
    el.classList.add('slider');
    VDSA.clear(el);
    var input = h('input', { type: 'range', class: 'range', id: uid, min: min, max: max, step: opts.step || 1, value: opts.value === undefined ? min : opts.value });
    var out = h('output', { class: 'slider__value', for: uid });
    el.appendChild(h('label', { class: 'slider__label', for: uid }, opts.label || 'Value'));
    el.appendChild(input); el.appendChild(out);
    function paint() {
      var v = Number(input.value);
      out.textContent = fmt(v);
      input.style.setProperty('--p', ((v - min) / ((max - min) || 1) * 100) + '%');
      input.setAttribute('aria-valuetext', fmt(v));
    }
    input.addEventListener('input', function () { paint(); if (opts.onInput) opts.onInput(Number(input.value)); });
    input.addEventListener('change', function () { if (opts.onChange) opts.onChange(Number(input.value)); });
    paint();
    return { el: el, input: input, get value() { return Number(input.value); }, set: function (v) { input.value = v; paint(); } };
  };

  /* ---------------------------------------------------------------- legend */
  var DEFAULT_LABELS = { default: 'Untouched', active: 'Current', compare: 'Comparing', swap: 'Moving', done: 'Done', found: 'Found', visited: 'Visited', frontier: 'Waiting', path: 'Path', pivot: 'Pivot', key: 'Held value', error: 'Conflict', muted: 'Out of play' };
  VDSA.legend = function (el, items) {
    el = VDSA.$(el);
    el.classList.add('legend');
    el.setAttribute('role', 'list');
    el.setAttribute('aria-label', 'Legend');
    VDSA.clear(el);
    (items || []).forEach(function (it) {
      if (typeof it === 'string') it = { state: it };
      el.appendChild(h('span', { class: 'legend__item', role: 'listitem' },
        h('span', { class: 'legend__swatch', 'data-state': it.state || 'default', 'data-shape': it.shape || null, style: it.color ? { '--sw': it.color } : null, 'aria-hidden': 'true' }),
        it.label || DEFAULT_LABELS[it.state] || it.state));
    });
    return el;
  };
  VDSA.legend.labels = DEFAULT_LABELS;

  /* ---------------------------------------------------------------- stat chips */
  function humanize(key) { var s = String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* VDSA.stats(el, {labels: {comparisons: 'Comparisons'}, states: {swaps: 'swap'}, format(v, key)}) -> {update(obj)} */
  VDSA.stats = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    el.classList.add('stats');
    var chips = {};
    function update(obj) {
      obj = obj || {};
      var keys = Object.keys(obj);
      Object.keys(chips).forEach(function (k) { if (keys.indexOf(k) === -1) { chips[k].el.remove(); delete chips[k]; } });
      keys.forEach(function (k, i) {
        var c = chips[k];
        if (!c) {
          var val = h('span', { class: 'stat__value' });
          var st = opts.states && opts.states[k];
          c = chips[k] = { el: h('div', { class: 'stat', 'data-state': st || null }, h('span', { class: 'stat__label' }, (opts.labels && opts.labels[k]) || humanize(k)), val), val: val, text: null };
        }
        var text = opts.format ? opts.format(obj[k], k) : String(obj[k]);
        if (c.text !== null && c.text !== text) { c.el.classList.remove('is-bump'); void c.el.offsetWidth; c.el.classList.add('is-bump'); }
        c.val.textContent = text; c.text = text;
        if (el.children[i] !== c.el) el.insertBefore(c.el, el.children[i] || null);
      });
    }
    if (opts.value) update(opts.value);
    return { el: el, update: update };
  };

  /* ---------------------------------------------------------------- toggle switch */
  VDSA.toggle = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var input = h('input', { type: 'checkbox', role: 'switch', checked: !!opts.checked });
    var label = h('label', { class: 'toggle' }, input, h('span', null, opts.label || ''));
    VDSA.clear(el); el.appendChild(label);
    input.addEventListener('change', function () { if (opts.onChange) opts.onChange(input.checked); });
    return { el: label, input: input, get checked() { return input.checked; }, set: function (v) { input.checked = !!v; } };
  };

  /* ---------------------------------------------------------------- teaser */
  /* A controller-less looping animation for the hero. Plays only while visible, in a visible tab,
     and without reduced motion; otherwise it shows one static frame (staticIndex, default the last step).
     render(step, ctx) gets the same ctx as a player render: {index, prev, direction, instant, duration, teaser: true}. */
  VDSA.teaser = function (el, opts) {
    el = VDSA.$(el); opts = opts || {};
    var steps = opts.steps || [];
    var stepMs = opts.stepMs || 1100, holdMs = opts.holdMs === undefined ? stepMs * 2 : opts.holdMs;
    var loop = opts.loop !== false;
    var index = -1, timer = 0, visible = false, running = false, destroyed = false;
    function show(i, instant) {
      var prev = index >= 0 ? steps[index] : null;
      var dir = index < 0 ? 0 : (i > index ? 1 : i < index ? -1 : 0);
      index = i;
      try { opts.render(steps[i], { index: i, prev: prev, direction: dir, instant: !!instant, duration: instant ? 0 : Math.round(stepMs * 0.72), teaser: true, wrap: dir < 0 }); }
      catch (e) { console.error('[VDSA.teaser] render failed', e); stop(); }
    }
    function tick() {
      timer = 0;
      if (!running || destroyed) return;
      var next = index + 1;
      if (next >= steps.length) {
        if (!loop) { stop(); return; }
        if (typeof opts.regenerate === 'function') { steps = opts.regenerate() || steps; show(0, !!opts.instantWrap); }
        else show(0, !!opts.instantWrap);
      } else show(next, false);
      timer = setTimeout(tick, index === steps.length - 1 ? holdMs : stepMs);
    }
    function canPlay() { return visible && !doc.hidden && !VDSA.reducedMotion() && steps.length > 1 && !destroyed; }
    function start() { if (running || !canPlay()) return; running = true; timer = setTimeout(tick, index === steps.length - 1 ? holdMs : stepMs); }
    function stop() { running = false; if (timer) { clearTimeout(timer); timer = 0; } }
    function sync() {
      if (VDSA.reducedMotion()) { stop(); var si = opts.staticIndex === undefined ? steps.length - 1 : opts.staticIndex; if (index !== si && steps.length) show(Math.max(0, Math.min(steps.length - 1, si)), true); return; }
      if (canPlay()) start(); else stop();
    }
    if (!steps.length) return { play: function () {}, pause: function () {}, destroy: function () {} };
    if (VDSA.reducedMotion()) show(Math.max(0, Math.min(steps.length - 1, opts.staticIndex === undefined ? steps.length - 1 : opts.staticIndex)), true);
    else show(0, true);
    var unVis = VDSA.onVisible(el, function (v) { visible = v; sync(); }, { threshold: 0.25 });
    function onVisChange() { sync(); }
    doc.addEventListener('visibilitychange', onVisChange);
    var mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq && mq.addEventListener) mq.addEventListener('change', sync);
    return {
      el: el,
      play: function () { visible = true; sync(); },
      pause: stop,
      setSteps: function (s) { steps = s || []; stop(); index = -1; show(0, true); sync(); },
      destroy: function () { destroyed = true; stop(); unVis(); doc.removeEventListener('visibilitychange', onVisChange); if (mq && mq.removeEventListener) mq.removeEventListener('change', sync); }
    };
  };

  return api;
}));
