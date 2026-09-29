/* Lesson 15 — shared helpers for the merge sort figures. Loaded before the figure files.

     L15.whenNear(el, fn)            run fn once when el comes within ~700px of the viewport (lazy figures)
     L15.labelDuplicates(values)     [{value, label}] with a/b/c tags on repeated values
     L15.fmt(v)                      numbers with a real minus sign
     L15.commas(n)                   1234567 -> "1,234,567"
     L15.arrayFigure(fig, steps, o)  array view + player for a figure that follows the standard fig markup
     L15.staticRuns(stage, spec)     one static multi-row array picture (minis, summary tiles)
     L15.stripLabels(step)           copy of a step with row labels and region labels removed (small stages)
     L15.LEGEND                      legend item presets */
(function () {
  'use strict';
  var V = window.VDSA;
  var L15 = V.lessons = V.lessons || {};
  L15 = V.lessons.l15 = V.lessons.l15 || {};

  L15.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };
  L15.commas = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* ------------------------------------------------------------------ lazy init */
  L15.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 15] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  var TAGS = 'abcdefghijklmnop';
  L15.labelDuplicates = function (values) {
    var counts = {}, seen = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    return values.map(function (v) {
      if (counts[v] < 2) return { value: v };
      var k = seen[v] = (seen[v] || 0) + 1;
      return { value: v, label: TAGS[k - 1] || String(k) };
    });
  };

  /* Remove row labels and region labels (small stages have no room for them). */
  L15.stripLabels = function (step, keepRowLabels) {
    var copy = Object.assign({}, step);
    if (step.rows) copy.rows = step.rows.map(function (r) { return Object.assign({}, r, { label: keepRowLabels ? r.label : undefined }); });
    if (step.regions) copy.regions = step.regions.map(function (r) { return Object.assign({}, r, { label: undefined }); });
    return copy;
  };

  /* ------------------------------------------------------------------ array + player in the standard figure markup */
  L15.arrayFigure = function (fig, steps, o) {
    o = o || {};
    var view = V.views.array(fig.querySelector('[data-stage]'), Object.assign({ mode: 'boxes', cellSize: 46, label: fig.querySelector('.fig__title').textContent }, o.view || {}));
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: o.counterLabels || { comparisons: 'Comparisons', writes: 'Values written' },
      counterStates: o.counterStates || { comparisons: 'compare', writes: 'swap' },
      baseStepMs: o.baseStepMs || 1300,
      label: o.label || 'Figure controls'
    });
    return { view: view, player: player, reload: function (st) { view.reset(); view.prepare(st); player.setSteps(st); } };
  };

  /* A static picture: spec = {rows: [{label?, values: [..] | items: [{value, state, label}], offset?, breaks?, length?}],
     cellSize, pointers?, regions?}. Values may be numbers or {value, state, label}. Returns the view. */
  L15.staticRuns = function (stage, spec) {
    var view = V.views.array(stage, { mode: spec.mode || 'boxes', cellSize: spec.cellSize || 30, showIndices: false, label: spec.label || 'Array figure', outerPointers: false, rowLabels: spec.rowLabels === undefined ? 'auto' : spec.rowLabels });
    var n = 0;
    var rows = spec.rows.map(function (r, ri) {
      var items = (r.items || r.values.map(function (v) { return typeof v === 'object' ? v : { value: v }; })).map(function (it, k) {
        var o = { id: 'r' + ri + 'c' + k, value: it.value, state: it.state || 'default', index: (it.index !== undefined ? it.index : k) };
        if (it.label) o.label = it.label;
        if (it.badge) o.badge = it.badge;
        return o;
      });
      n = Math.max(n, items.length);
      return { id: 'row' + ri, label: r.label, items: items, breaks: r.breaks || [], length: r.length, showIndices: false };
    });
    var state = { rows: rows, pointers: (spec.pointers || []).map(function (p) { return Object.assign({ side: 'above' }, p); }), regions: spec.regions || [] };
    view.prepare([state]);
    view.render(state, { duration: 0 });
    return view;
  };

  L15.LEGEND = {
    run: { state: 'visited', label: 'Sorted run' },
    fresh: { state: 'default', label: 'Not merged yet' },
    compare: { state: 'compare', label: 'Fronts being compared' },
    moved: { state: 'swap', label: 'Just written' },
    done: { state: 'done', label: 'Final' }
  };
}());
