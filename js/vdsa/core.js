/* Visual DSA core: the small contract every visualisation, player and lesson builds on.
   No dependencies. Loads as a classic script and defines window.VDSA.
   In Node (tests) it exports the pure helpers only.

   Contents
   - DOM:      VDSA.h(tag, attrs, ...children), VDSA.s(tag, attrs, ...children), VDSA.$, VDSA.$$, VDSA.clear
   - Motion:   VDSA.ease, VDSA.tween, VDSA.animate, VDSA.dur, VDSA.timeScale, VDSA.reducedMotion
   - Theme:    VDSA.theme.get/set/toggle/onChange, VDSA.cssVar, VDSA.stateColor
   - States:   VDSA.STATES (the shared semantic vocabulary)
   - Lifecycle VDSA.onVisible, VDSA.onResize, VDSA.ready
   - Data:     VDSA.rng(seed), VDSA.shuffle, VDSA.range, VDSA.parseNumbers, VDSA.clamp, VDSA.lerp, VDSA.uid
   - Registry: VDSA.algos (pure step generators register here), VDSA.views (renderers register here)
*/
(function (root, factory) {
  'use strict';
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA = Object.assign(root.VDSA || {}, api);
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  var VDSA = { version: '2.0.0', algos: {}, views: {} };
  var doc = win ? win.document : null;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- Semantic states ----------
     Every renderer maps these names to the CSS class `is-<state>` and the colour var `--st-<state>`.
     Use the same state for the same meaning in every lesson. */
  VDSA.STATES = {
    default: 'untouched element',
    active: 'current element or pointer focus',
    compare: 'being compared or examined',
    swap: 'being moved, written or swapped',
    done: 'finalised: sorted, settled, confirmed',
    found: 'successful search result',
    visited: 'already processed',
    frontier: 'discovered and waiting (queue, stack, heap)',
    path: 'part of the answer path',
    pivot: 'pivot or special marker',
    key: 'value currently held in hand',
    error: 'conflict, invalid or overflow',
    muted: 'out of consideration'
  };

  /* ---------- Pure helpers (usable in Node) ---------- */
  VDSA.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  VDSA.lerp = function (a, b, t) { return a + (b - a) * t; };
  VDSA.range = function (n, start) { var out = []; for (var i = 0; i < n; i++) out.push((start || 0) + i); return out; };
  var uidCounter = 0;
  VDSA.uid = function (prefix) { uidCounter += 1; return (prefix || 'v') + uidCounter.toString(36); };

  /* Deterministic PRNG (mulberry32). rng() -> [0,1); rng.int(lo, hi) inclusive; rng.pick(arr). */
  VDSA.rng = function (seed) {
    var a = (seed === undefined ? Date.now() : seed) >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
    next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
    return next;
  };
  VDSA.shuffle = function (arr, rand) {
    var r = rand || Math.random, out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  };

  /* Parse "5, 3, 8" / "5 3 8" into integers with friendly validation.
     opts: {min, max, minCount, maxCount, integers(default true), unique}
     Returns {values: number[], error: string|null}. */
  VDSA.parseNumbers = function (text, opts) {
    opts = opts || {};
    var min = opts.min === undefined ? -999 : opts.min;
    var max = opts.max === undefined ? 999 : opts.max;
    var maxCount = opts.maxCount || 16;
    var minCount = opts.minCount === undefined ? 1 : opts.minCount;
    var tokens = String(text || '').split(/[\s,;]+/).filter(Boolean);
    if (tokens.length < minCount) return { values: [], error: 'Enter at least ' + minCount + ' number' + (minCount === 1 ? '' : 's') + '.' };
    if (tokens.length > maxCount) return { values: [], error: 'Use at most ' + maxCount + ' numbers so every step stays readable.' };
    var values = [];
    for (var i = 0; i < tokens.length; i++) {
      var n = Number(tokens[i]);
      if (!isFinite(n) || (opts.integers !== false && !Number.isInteger(n))) return { values: [], error: '“' + tokens[i] + '” is not a whole number.' };
      if (n < min || n > max) return { values: [], error: 'Keep numbers between ' + min + ' and ' + max + '.' };
      if (opts.unique && values.indexOf(n) !== -1) return { values: [], error: 'Use distinct numbers (' + n + ' appears twice).' };
      values.push(n);
    }
    return { values: values, error: null };
  };

  /* Easing functions: t in [0,1] -> [0,1] */
  VDSA.ease = {
    linear: function (t) { return t; },
    in: function (t) { return t * t * t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    spring: function (t) { return 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-5 * t); }
  };

  if (!win) return VDSA; // Node: stop here, DOM helpers below need a browser.

  /* ---------- DOM ---------- */
  function applyAttrs(el, attrs, isSvg) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class' || k === 'className') { el.setAttribute('class', v); }
      else if (k === 'style' && typeof v === 'object') { Object.keys(v).forEach(function (sk) { if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }); }
      else if (k === 'dataset' && typeof v === 'object') { Object.assign(el.dataset, v); }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2).toLowerCase(), v); }
      else if (k === 'text') { el.textContent = v; }
      else if (k === 'html') { el.innerHTML = v; }
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected')) { el[k] = v; }
      else { el.setAttribute(k, v === true ? '' : v); }
    });
  }
  function append(el, children) {
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { append(el, c); return; }
      el.appendChild(typeof c === 'object' ? c : doc.createTextNode(String(c)));
    });
  }
  /* VDSA.h('button', {class:'btn', onclick: fn}, 'Label') -> HTMLElement */
  VDSA.h = function (tag, attrs) {
    var el = doc.createElement(tag);
    applyAttrs(el, attrs, false);
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  };
  /* VDSA.s('circle', {cx: 10, cy: 10, r: 5}) -> SVGElement */
  VDSA.s = function (tag, attrs) {
    var el = doc.createElementNS(SVG_NS, tag);
    applyAttrs(el, attrs, true);
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  };
  VDSA.$ = function (sel, scope) { return typeof sel === 'string' ? (scope || doc).querySelector(sel) : sel; };
  VDSA.$$ = function (sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); };
  VDSA.clear = function (el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; };
  VDSA.escape = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  VDSA.ready = function (fn) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn); else fn(); };

  /* ---------- Motion ----------
     VDSA.timeScale: page-wide speed multiplier, normally 1. Players do NOT change it: each player
       passes its own already-scaled `duration` to renderers, so two figures can run at different speeds.
     VDSA.dur(ms): ms / timeScale, or 0 under reduced motion. VDSA.animate/tween callers pass raw ms. */
  var motionQuery = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  VDSA.timeScale = 1;
  VDSA.reducedMotion = function () { return !!motionQuery.matches || doc.documentElement.getAttribute('data-motion') === 'reduce'; };
  VDSA.dur = function (ms) { return VDSA.reducedMotion() ? 0 : Math.max(0, ms / (VDSA.timeScale || 1)); };

  /* VDSA.tween(duration, onFrame(t, eased), {ease, delay}) -> {promise, cancel()}
     onFrame receives raw progress t and eased value e, both 0..1. Duration 0 calls onFrame(1,1) at once. */
  VDSA.tween = function (duration, onFrame, opts) {
    opts = opts || {};
    var ease = typeof opts.ease === 'function' ? opts.ease : (VDSA.ease[opts.ease] || VDSA.ease.inOut);
    var cancelled = false, raf = 0, start = 0, resolveFn;
    var promise = new Promise(function (res) { resolveFn = res; });
    function finish() { if (!cancelled) onFrame(1, 1); resolveFn(!cancelled); }
    if (!duration || duration <= 0) { onFrame(1, 1); resolveFn(true); return { promise: promise, cancel: function () {} }; }
    function frame(now) {
      if (cancelled) return;
      if (!start) start = now + (opts.delay || 0);
      var t = VDSA.clamp((now - start) / duration, 0, 1);
      if (now >= start) onFrame(t, ease(t));
      if (t < 1) raf = win.requestAnimationFrame(frame); else finish();
    }
    raf = win.requestAnimationFrame(frame);
    return { promise: promise, cancel: function () { cancelled = true; win.cancelAnimationFrame(raf); resolveFn(false); } };
  };

  /* VDSA.animate(el, props, opts) -> Promise
     Animates an SVG or HTML element from its current values to props, cancelling any running animation on it.
     props: {x, y, scale, rotate, opacity, attr: {cx: 10, width: 40, ...}}
       x/y/scale/rotate are composed into the element's transform (SVG attribute or CSS transform for HTML).
       attr values must be numeric SVG/HTML attributes.
     opts: {duration (ms, raw — scaled by VDSA.dur), ease, delay}
     The last applied values are stored on el.__vdsa so the next call starts where this one stopped. */
  VDSA.animate = function (el, props, opts) {
    opts = opts || {};
    var st = el.__vdsa || (el.__vdsa = { x: 0, y: 0, scale: 1, rotate: 0, opacity: null, attr: {} });
    if (st.anim) st.anim.cancel();
    var from = { x: st.x, y: st.y, scale: st.scale, rotate: st.rotate, opacity: st.opacity === null ? 1 : st.opacity, attr: {} };
    var to = { x: props.x === undefined ? st.x : props.x, y: props.y === undefined ? st.y : props.y,
      scale: props.scale === undefined ? st.scale : props.scale, rotate: props.rotate === undefined ? st.rotate : props.rotate,
      opacity: props.opacity === undefined ? from.opacity : props.opacity, attr: {} };
    var attrKeys = props.attr ? Object.keys(props.attr) : [];
    attrKeys.forEach(function (k) {
      var cur = st.attr[k];
      if (cur === undefined) { cur = parseFloat(el.getAttribute(k)); if (isNaN(cur)) cur = props.attr[k]; }
      from.attr[k] = cur; to.attr[k] = props.attr[k];
    });
    var hasTransform = props.x !== undefined || props.y !== undefined || props.scale !== undefined || props.rotate !== undefined;
    var isSvg = el instanceof win.SVGElement;
    function apply(e) {
      var x = VDSA.lerp(from.x, to.x, e), y = VDSA.lerp(from.y, to.y, e), sc = VDSA.lerp(from.scale, to.scale, e), rot = VDSA.lerp(from.rotate, to.rotate, e);
      if (hasTransform) {
        st.x = x; st.y = y; st.scale = sc; st.rotate = rot;
        if (isSvg) el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' + (rot ? ' rotate(' + rot.toFixed(2) + ')' : '') + (sc !== 1 ? ' scale(' + sc.toFixed(4) + ')' : ''));
        else el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)' + (rot ? ' rotate(' + rot.toFixed(2) + 'deg)' : '') + (sc !== 1 ? ' scale(' + sc.toFixed(4) + ')' : '');
      }
      if (props.opacity !== undefined) { st.opacity = VDSA.lerp(from.opacity, to.opacity, e); el.style.opacity = st.opacity.toFixed(3); }
      attrKeys.forEach(function (k) { var v = VDSA.lerp(from.attr[k], to.attr[k], e); st.attr[k] = v; el.setAttribute(k, +v.toFixed(2)); });
    }
    var anim = VDSA.tween(VDSA.dur(opts.duration === undefined ? 400 : opts.duration), function (t, e) { apply(e); }, { ease: opts.ease, delay: opts.delay });
    st.anim = anim;
    return anim.promise;
  };
  /* Set position instantly (no animation) and record it for later animate() calls. */
  VDSA.place = function (el, props) { return VDSA.animate(el, props, { duration: 0 }); };

  /* ---------- Theme ---------- */
  var themeListeners = [];
  VDSA.theme = {
    /* 'light' | 'dark' — the theme actually showing */
    get: function () {
      var set = doc.documentElement.getAttribute('data-theme');
      if (set === 'light' || set === 'dark') return set;
      return win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    set: function (mode) {
      if (mode === 'light' || mode === 'dark') doc.documentElement.setAttribute('data-theme', mode);
      else doc.documentElement.removeAttribute('data-theme');
      try { if (mode === 'light' || mode === 'dark') localStorage.setItem('vdsa-theme', mode); else localStorage.removeItem('vdsa-theme'); } catch (_) {}
      themeListeners.forEach(function (fn) { try { fn(VDSA.theme.get()); } catch (e) { console.error(e); } });
    },
    toggle: function () { VDSA.theme.set(VDSA.theme.get() === 'dark' ? 'light' : 'dark'); },
    onChange: function (fn) { themeListeners.push(fn); return function () { themeListeners = themeListeners.filter(function (f) { return f !== fn; }); }; }
  };
  // Restore saved theme as early as possible (core.js should load in <head>).
  try { var savedTheme = localStorage.getItem('vdsa-theme'); if (savedTheme === 'light' || savedTheme === 'dark') doc.documentElement.setAttribute('data-theme', savedTheme); } catch (_) {}
  if (win.matchMedia) {
    var schemeQuery = win.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (!doc.documentElement.getAttribute('data-theme')) themeListeners.forEach(function (fn) { try { fn(VDSA.theme.get()); } catch (e) { console.error(e); } }); };
    if (schemeQuery.addEventListener) schemeQuery.addEventListener('change', onScheme);
  }
  /* Read a CSS custom property (for canvas renderers that cannot use classes). */
  VDSA.cssVar = function (name, el) { return getComputedStyle(el || doc.documentElement).getPropertyValue(name).trim(); };
  VDSA.stateColor = function (state, el) { return VDSA.cssVar('--st-' + (state || 'default'), el); };

  /* ---------- Lifecycle ---------- */
  /* VDSA.onVisible(el, fn(isVisible)) — e.g. pause looping teasers when scrolled away. Returns unsubscribe. */
  VDSA.onVisible = function (el, fn, opts) {
    if (!('IntersectionObserver' in win)) { fn(true); return function () {}; }
    // Observe both 0 and the threshold: `isIntersecting` alone stays true while an element slides
    // below the threshold, so "hidden" would never be reported. Visible = at least `threshold` of the
    // element (or half the viewport, for elements taller than the screen) is on screen.
    var th = (opts && opts.threshold) || 0.15;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var tall = en.rootBounds && en.intersectionRect.height >= en.rootBounds.height * 0.5;
        fn(en.isIntersecting && (en.intersectionRatio >= th - 0.001 || tall), en);
      });
    }, { threshold: [0, th, Math.min(1, th * 3)] });
    io.observe(el);
    return function () { io.disconnect(); };
  };
  /* VDSA.onResize(el, fn({width, height})) — debounced to one call per animation frame. */
  VDSA.onResize = function (el, fn) {
    if (!('ResizeObserver' in win)) {
      var onWin = function () { fn(el.getBoundingClientRect()); };
      win.addEventListener('resize', onWin);
      return function () { win.removeEventListener('resize', onWin); };
    }
    // Keep the latest rect: observations that arrive while a frame is pending must not be lost,
    // otherwise the final size of a fast resize is never reported.
    var pending = false, latest = null;
    var ro = new ResizeObserver(function (entries) {
      latest = entries[entries.length - 1].contentRect;
      if (pending) return; pending = true;
      win.requestAnimationFrame(function () { pending = false; fn({ width: latest.width, height: latest.height }); });
    });
    ro.observe(el);
    return function () { ro.disconnect(); };
  };
  /* Wait helper for scripted sequences: await VDSA.wait(300) — respects timeScale and reduced motion. */
  VDSA.wait = function (ms) { return new Promise(function (res) { setTimeout(res, VDSA.dur(ms)); }); };

  return VDSA;
}));
