/* A history of algorithms — the timeline lab (labs/history.html).
   Reads window.VDSA_HISTORY (js/data/history.js) and window.VDSA_CURRICULUM (js/curriculum.js).

   Parts, in order:
     1. Data preparation (events, people, tags, lessons, sources)
     2. The time scale: piecewise-linear per era, so c. 300 BCE and 1956–62 are both readable
     3. Filters (tag chips, lesson, person, search)
     4. The timeline: SVG, lanes, labels, zoom/pan (wheel, pinch, drag, buttons, keys), tooltip, minimap
     5. Detail panel and the vertical list (phones, or the List view)
     6. Play history
     7. People gallery with generated monogram avatars
     8. Did-you-know cards
     9. Hero teaser
    10. Boot, deep links (#event=<id>, #person=<id>, #lesson=<id>, or the same as ?query) */
(function () {
  'use strict';
  var VDSA = window.VDSA, HIST = window.VDSA_HISTORY, CUR = window.VDSA_CURRICULUM;
  if (!VDSA || !HIST) return;
  var h = VDSA.h, s = VDSA.s, $ = VDSA.$, $$ = VDSA.$$;
  var doc = document, win = window;

  /* ================================================================ 1. Data */
  var TAG_LABELS = {
    foundations: 'Foundations', hardware: 'Hardware', languages: 'Languages', complexity: 'Complexity',
    sorting: 'Sorting', hashing: 'Hashing', strings: 'Strings', trees: 'Trees', graphs: 'Graphs', paradigms: 'Design paradigms'
  };
  var TAG_ORDER = ['foundations', 'hardware', 'languages', 'complexity', 'sorting', 'hashing', 'strings', 'trees', 'graphs', 'paradigms']
    .filter(function (t) { return HIST.tags.indexOf(t) !== -1; });
  HIST.tags.forEach(function (t) { if (TAG_ORDER.indexOf(t) === -1) TAG_ORDER.push(t); });

  var ERA_RANGE = { ancient: 'to 1699', mechanical: '1700–1936', 'early-electronic': '1937–1959', 'golden-age': '1960–1989', modern: '1990 on' };
  var ERA_BLURB = {
    ancient: 'Procedures written for people with pen and paper.',
    mechanical: 'Logic, graphs, puzzles and machines you crank.',
    'early-electronic': 'Stored programs, and the first sorts, searches and hash tables.',
    'golden-age': 'The textbook algorithms, and a theory of what is hard.',
    modern: 'Old problems, new records.'
  };
  var eraById = {};
  HIST.eras.forEach(function (e) { eraById[e.id] = e; });

  var STUDIES = {
    '00': 'dsa-00-cost-of-a-computation', '01': 'dsa-01-linear-layouts-and-access-disciplines',
    '02': 'dsa-02-amortized-cost-aggregate-accounting-potential', '03': 'dsa-03-divide-solve-combine',
    '06': 'dsa-06-sorting-and-the-comparison-barrier', '07': 'dsa-07-balanced-search-trees',
    '08': 'dsa-08-hashing-and-expected-constant-access', '11': 'dsa-11-graphs-and-their-traversals',
    '12': 'dsa-12-minimum-spanning-trees-and-union-find', '13': 'dsa-13-single-source-shortest-paths',
    '15': 'dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag',
    '16': 'dsa-16-when-is-greedy-optimal-exchange-arguments-and-matroids', '17': 'dsa-17-max-flow-min-cut-and-the-power-of-duality',
    '18': 'dsa-18-linear-time-exact-matching', '19': 'dsa-19-tries-and-suffix-structures',
    '20': 'dsa-20-p-np-reductions-and-np-completeness', '22': 'dsa-22-randomness-as-a-design-tool',
    '23': 'dsa-23-the-frontier-fine-grained-sublinear-predictions-p-vs-np'
  };

  function norm(str) { return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function siteUrl(path) { return VDSA.url ? VDSA.url(path) : '../' + path; }
  function lessonById(id) { return CUR && CUR.byId ? CUR.byId(id) : null; }
  function reduced() { return VDSA.reducedMotion(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  var peopleById = {};
  HIST.people.forEach(function (p) { peopleById[p.id] = p; });

  function shortYear(e) { // compact year for labels: keep ranges and "c.", drop day and month names
    if (e.year < 0) return (-e.year) + ' BCE';
    if (/^(c\. )?\d{3,4}(s?–\d{2,4}s?)?$/.test(e.yearLabel)) return e.yearLabel;
    return String(e.year);
  }

  var EVENTS = HIST.events.map(function (e, i) {
    var names = e.people.map(function (id) { return peopleById[id] ? peopleById[id].name : ''; });
    var lessonTitles = e.lessons.map(function (id) { var l = lessonById(id); return l ? l.title : ''; });
    return {
      id: e.id, i: i, data: e, tag: e.tags[0] || 'foundations', yShort: shortYear(e), match: true, lit: false,
      hay: norm([e.title, e.summary, e.detail, e.yearLabel, e.year < 0 ? (-e.year) + ' bce' : String(e.year)]
        .concat(names, e.tags.map(function (t) { return TAG_LABELS[t] || t; }), lessonTitles).join(' '))
    };
  }).sort(function (a, b) { return a.data.year - b.data.year || a.i - b.i; });
  EVENTS.forEach(function (ev, i) { ev.i = i; });
  var eventById = {};
  EVENTS.forEach(function (ev) { eventById[ev.id] = ev; });

  function dominantTag(evs) {
    var c = {}, best = null;
    evs.forEach(function (ev) { ev.data.tags.forEach(function (t, j) { c[t] = (c[t] || 0) + (j === 0 ? 1.01 : 1); }); });
    Object.keys(c).forEach(function (t) { if (!best || c[t] > c[best]) best = t; });
    return best || 'foundations';
  }
  function surname(name) {
    var paren = name.match(/\(([^)]+)\)/);
    if (paren) return paren[1];
    var parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(function (w) { return !/^(Jr\.?|Sr\.?)$/.test(w); });
    return parts[parts.length - 1].replace(/^al-/, '');
  }
  function initials(name) {
    var parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(function (w) { return !/^(Jr\.?|Sr\.?)$/.test(w); });
    var first = parts[0].replace(/^al-/, ''), last = parts[parts.length - 1].replace(/^al-/, '');
    if (parts.length === 1) return first.charAt(0).toUpperCase();
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  var PEOPLE = HIST.people.map(function (p, i) {
    var evs = EVENTS.filter(function (ev) { return ev.data.people.indexOf(p.id) !== -1; });
    return { id: p.id, i: i, data: p, events: evs, tag: dominantTag(evs), ini: initials(p.name), sur: surname(p.name),
      sortYear: p.born != null ? p.born : (evs[0] ? evs[0].data.year - 35 : 0) };
  });
  var personById = {};
  PEOPLE.forEach(function (p) { personById[p.id] = p; });

  /* Source strings → readable text and links. */
  function prettyUrl(u) {
    try {
      var url = new URL(u);
      var host = url.hostname.replace(/^www\./, '');
      var seg = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      if (/wikipedia\.org$/.test(host)) return 'Wikipedia: ' + seg.replace(/_/g, ' ');
      seg = seg.replace(/\.(html?|php|pdf)$/i, '').replace(/[_-]+/g, ' ');
      return seg && seg.length > 3 && seg.length < 48 && /[a-z]{3}/i.test(seg) && !/^(detail|index|view|article)$/i.test(seg) ? host + ', ' + seg : host;
    } catch (e) { return u; }
  }
  function extLink(href, text) { return h('a', { href: href, target: '_blank', rel: 'noopener' }, text); }
  function sourceNode(src) {
    if (/^https?:\/\//.test(src)) return extLink(src, prettyUrl(src));
    var m = src.match(/^(.*?),?\s+(https?:\/\/\S+)$/);
    if (m) return [m[1] + ', ', extLink(m[2], prettyUrl(m[2]))];
    var st = src.match(/^Study dsa-(\d\d)/);
    if (st && STUDIES[st[1]]) return h('a', { href: siteUrl('studies/' + STUDIES[st[1]] + '.html') }, 'Visual DSA deep study ' + st[1]);
    if (src === 'GK') return 'General knowledge: widely documented, not re-checked against a primary source';
    if (/^WP\b/.test(src)) return h('span', null, 'Robert C. Martin, ', h('em', null, 'We, Programmers'), ' (2025), ' + src.replace(/^WP\s*/, ''));
    if (/^Code\b/.test(src)) return h('span', null, 'Charles Petzold, ', h('em', null, 'Code'), ', 2nd ed. (2022), ' + src.replace(/^Code\s*/, ''));
    if (/^TAOCP\b/.test(src)) return h('span', null, 'Donald E. Knuth, ', h('em', null, 'The Art of Computer Programming'), ', ' + src.replace(/^TAOCP\s*/, ''));
    return src;
  }

  /* ================================================================ 2. Time scale
     Each era gets a fixed share of the width. Inside an era the scale is linear. */
  var SEGS = [
    { era: 'ancient', from: -400, to: 1700, w: 0.10 },
    { era: 'mechanical', from: 1700, to: 1937, w: 0.19 },
    { era: 'early-electronic', from: 1937, to: 1960, w: 0.25 },
    { era: 'golden-age', from: 1960, to: 1990, w: 0.30 },
    { era: 'modern', from: 1990, to: 2030, w: 0.16 }
  ];
  (function () { var acc = 0; SEGS.forEach(function (sg) { sg.u0 = acc; acc += sg.w; sg.u1 = acc; }); }());
  function uOf(y) {
    for (var i = 0; i < SEGS.length; i++) {
      var sg = SEGS[i];
      if (y < sg.to || i === SEGS.length - 1) return sg.u0 + VDSA.clamp((y - sg.from) / (sg.to - sg.from), 0, 1) * sg.w;
    }
    return 1;
  }
  EVENTS.forEach(function (ev) { ev.u = uOf(ev.data.year + 0.5); });
  function yearText(v) { return v < 0 ? (-v) + ' BCE' : String(v); }

  /* ================================================================ 3. State and filters */
  var state = { tags: {}, lesson: '', person: '', q: '', selected: null, view: 'timeline', userView: 'timeline', filterVersion: 0 };
  var fig, detailEl, countEl, clearBtn, searchEl, lessonSel, personSel, tagWrap;

  function anyFilter() { return Object.keys(state.tags).length > 0 || !!state.lesson || !!state.person || !!state.q; }
  function matches(ev) {
    var e = ev.data;
    var tags = Object.keys(state.tags);
    if (tags.length && !e.tags.some(function (t) { return state.tags[t]; })) return false;
    if (state.lesson && e.lessons.indexOf(state.lesson) === -1) return false;
    if (state.person && e.people.indexOf(state.person) === -1) return false;
    if (state.q) {
      var words = norm(state.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (ev.hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }
  function matchingEvents() { return EVENTS.filter(function (ev) { return ev.match; }); }

  function applyFilters(opts) {
    opts = opts || {};
    var n = 0;
    EVENTS.forEach(function (ev) { ev.match = matches(ev); if (ev.match) n++; });
    state.filterVersion++;
    if (PLAY.on || PLAY.paused) playStop(true);
    countEl.textContent = anyFilter() ? 'Showing ' + n + ' of ' + plural(EVENTS.length, 'event') : plural(EVENTS.length, 'event');
    clearBtn.hidden = !anyFilter();
    $$('.hx-chip', tagWrap).forEach(function (c) { c.setAttribute('aria-pressed', state.tags[c.dataset.tag] ? 'true' : 'false'); });
    if (searchEl.value !== state.q) searchEl.value = state.q;
    lessonSel.value = state.lesson;
    personSel.value = state.person;
    TL.onFilter(opts);
    LIST.onFilter();
    GALLERY.markActive();
    DETAIL.refreshNav();
  }
  function setFilter(patch, opts) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    applyFilters(opts);
  }
  function clearFilters() { setFilter({ tags: {}, lesson: '', person: '', q: '' }); }

  function buildFilters() {
    tagWrap = $('[data-tags]', fig);
    TAG_ORDER.forEach(function (t) {
      var n = EVENTS.filter(function (ev) { return ev.data.tags.indexOf(t) !== -1; }).length;
      tagWrap.appendChild(h('button', {
        class: 'hx-chip', type: 'button', 'data-tag': t, 'aria-pressed': 'false',
        'aria-label': TAG_LABELS[t] + ', ' + plural(n, 'event'),
        onclick: function () {
          var tags = Object.assign({}, state.tags);
          if (tags[t]) delete tags[t]; else tags[t] = true;
          setFilter({ tags: tags });
        }
      }, h('span', { class: 'hx-chip__dot', 'aria-hidden': 'true' }), TAG_LABELS[t], h('span', { class: 'hx-chip__n', 'aria-hidden': 'true' }, n)));
    });

    searchEl = $('[data-search]', fig);
    var timer = 0;
    searchEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { setFilter({ q: searchEl.value.trim() }); }, 140);
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { clearTimeout(timer); setFilter({ q: searchEl.value.trim() }, { fit: true }); }
    });

    lessonSel = $('[data-lesson-filter]', fig);
    if (CUR) {
      CUR.units.forEach(function (u) {
        var group = h('optgroup', { label: 'Unit ' + u.number + ': ' + u.title });
        CUR.lessonsIn(u.id).forEach(function (l) {
          var n = HIST.eventsForLesson(l.id).length;
          if (n) group.appendChild(h('option', { value: l.id }, pad2(l.number) + ' ' + l.title + ' (' + n + ')'));
        });
        if (group.children.length) lessonSel.appendChild(group);
      });
    }
    lessonSel.addEventListener('change', function () { setFilter({ lesson: lessonSel.value }, { fit: !!lessonSel.value }); });

    personSel = $('[data-person-filter]', fig);
    PEOPLE.slice().sort(function (a, b) { return a.sur.localeCompare(b.sur); }).forEach(function (p) {
      personSel.appendChild(h('option', { value: p.id }, p.data.name + ' (' + p.events.length + ')'));
    });
    personSel.addEventListener('change', function () { setFilter({ person: personSel.value }, { fit: !!personSel.value, flash: true }); });

    clearBtn = $('[data-clear]', fig);
    clearBtn.addEventListener('click', clearFilters);
    countEl = $('[data-count]', fig);
  }

  /* ================================================================ Selection */
  function select(ev, opts) {
    opts = opts || {};
    if (!ev) return;
    state.selected = ev;
    TL.markSelected(ev, opts);
    if (state.view === 'list') LIST.open(ev, { scroll: opts.scroll !== false && opts.source !== 'init', focus: opts.focus });
    DETAIL.render(ev, opts);
    writeHash('event=' + ev.id);
  }
  function stepSelection(dir, opts) {
    var list = matchingEvents();
    if (!list.length) return;
    var idx = state.selected ? list.indexOf(state.selected) : -1;
    var next;
    if (idx === -1) {
      if (state.selected) { // selected but filtered out: go to the nearest match in that direction
        next = dir > 0 ? list.filter(function (ev) { return ev.i > state.selected.i; })[0] : list.filter(function (ev) { return ev.i < state.selected.i; }).pop();
      }
      next = next || (dir > 0 ? list[0] : list[list.length - 1]);
    } else next = list[VDSA.clamp(idx + dir, 0, list.length - 1)];
    select(next, Object.assign({ ensure: true }, opts));
  }
  function writeHash(value) {
    try { history.replaceState(null, '', '#' + value); } catch (e) { /* some file:// contexts refuse */ }
  }

  /* ================================================================ 4. The timeline */
  var TL = (function () {
    var stage, svg, gEras, gTicks, gBreaks, gStems, gMarks, axisLine, playhead, tip, hint, mini, miniSvg, miniView, miniMarks;
    var W = 900, plotW = 868, SVG_H = 0, axisY = 0;
    var PAD = 16, ERA_H = 40, LANES = 10, LABEL_LANES = 9, LANE_H = 27, R = 5.5, AXIS_H = 40, LABEL_MAX = 224, KMAX = 48;
    var k = 1, x0 = 0, layoutKey = '', viewAnim = null, raf = 0, lastT = 0, tickKey = '';
    var measureCtx = null, fontTitle = '', fontYear = '';
    var hoverEv = null, tipEv = null, hintTimer = 0, flashTimer = 0;
    var eraEls = [];

    function laneY(l) { return axisY - 20 - l * LANE_H; }
    function sx(u) { return PAD + u * plotW * k - x0; }
    function clampX(kk, xx) { return VDSA.clamp(xx, 0, Math.max(0, plotW * kk - plotW)); }
    function request() { if (!raf) raf = win.requestAnimationFrame(frame); }

    /* ---- text measurement for labels */
    function measure(text, font) {
      if (!measureCtx) measureCtx = doc.createElement('canvas').getContext('2d');
      measureCtx.font = font;
      return measureCtx.measureText(text).width;
    }
    function prepareLabels() {
      var sans = VDSA.cssVar('--font-sans') || 'system-ui, sans-serif';
      var mono = VDSA.cssVar('--font-mono') || 'monospace';
      fontTitle = '600 12.5px ' + sans;
      fontYear = '600 11px ' + mono;
      EVENTS.forEach(function (ev) {
        var yw = measure(ev.yShort, fontYear) + 6;
        var room = LABEL_MAX - yw, title = ev.data.title.replace(/[“”]/g, '');
        var text = title;
        if (measure(text, fontTitle) > room) {
          var colon = title.indexOf(': ');
          if (colon > 3 && measure(title.slice(0, colon), fontTitle) <= room) text = title.slice(0, colon);
          else {
            var words = title.split(/(?<=[ -])/); // keep the separator, so "greatest-common-" can break
            while (words.length > 1 && measure(words.join('') + '…', fontTitle) > room) words.pop();
            text = words.join('').replace(/[\s,:;–—-]+$/, '') + '…';
          }
          while (text.length > 2 && measure(text, fontTitle) > room) text = text.slice(0, -2) + '…';
        }
        ev.short = text;
        ev.lw = yw + measure(text, fontTitle);
        if (ev.titleEl) { ev.titleEl.textContent = text; ev.bg.setAttribute('width', (ev.lw + 9).toFixed(1)); ev.shown = null; }
      });
    }

    /* ---- build the SVG once */
    function build(el) {
      stage = el;
      hint = $('[data-hint]', stage);
      axisY = ERA_H + 16 + LANES * LANE_H + 12;
      SVG_H = axisY + AXIS_H;
      svg = s('svg', { class: 'hx-svg', height: SVG_H, role: 'group', tabindex: '-1', focusable: 'false', 'aria-label': 'Timeline of ' + EVENTS.length + ' events, from c. 300 BCE to 2025', 'aria-describedby': 'hx-tl-help' });
      var help = h('p', { id: 'hx-tl-help', class: 'sr-only' }, 'Each event is a button. Use the left and right arrow keys to move between events, plus and minus to zoom, and 0 to show everything. The List view shows the same events as a list.');
      gEras = s('g', { class: 'hx-eras' });
      SEGS.forEach(function (sg, i) {
        var era = eraById[sg.era];
        var band = s('rect', { class: 'hx-era__band' + (i % 2 ? ' is-alt' : ''), y: 0, height: SVG_H - AXIS_H + 6 });
        var line = s('line', { class: 'hx-era__edge', y1: 0, y2: axisY });
        var label = s('text', { class: 'hx-era__label', y: 24 }, s('tspan', { class: 'hx-era__name' }, era.label), s('tspan', { class: 'hx-era__range', dx: 8 }, ERA_RANGE[sg.era] || ''));
        var g = s('g', { class: 'hx-era' }, band, line, label);
        eraEls.push({ seg: sg, g: g, band: band, line: line, label: label, lw: 0 });
        gEras.appendChild(g);
      });
      axisLine = s('line', { class: 'hx-axis__line', y1: axisY, y2: axisY });
      gTicks = s('g', { class: 'hx-ticks' });
      gBreaks = s('g', { class: 'hx-breaks' });
      playhead = s('line', { class: 'hx-playhead', y1: ERA_H + 4, y2: axisY });
      gStems = s('g', { class: 'hx-stems' });
      gMarks = s('g', { class: 'hx-marks' });
      EVENTS.forEach(function (ev) {
        var e = ev.data;
        var names = e.people.map(function (id) { return peopleById[id] ? peopleById[id].name : ''; }).filter(Boolean);
        ev.hit = s('rect', { class: 'hx-mk__hit', x: -12, y: -13, width: 24, height: 26, rx: 6 });
        ev.titleEl = s('tspan', { class: 'hx-mk__title' }, '');
        ev.bg = s('rect', { class: 'hx-mk__bg', x: R + 3, y: -9.5, height: 19, rx: 5, width: 10 });
        ev.label = false;
        ev.el = s('g', {
          class: 'hx-mk', 'data-id': ev.id, 'data-tag': ev.tag, tabindex: '-1', role: 'button', 'aria-pressed': 'false',
          'aria-label': e.yearLabel + ': ' + e.title + '. ' + e.tags.map(function (t) { return TAG_LABELS[t]; }).join(', ') + (names.length ? '. ' + names.join(', ') : '')
        },
          ev.hit,
          s('circle', { class: 'hx-mk__halo', r: 14 }),
          s('circle', { class: 'hx-mk__focus', r: 11 }),
          s('circle', { class: 'hx-mk__ring', r: 9 }),
          s('circle', { class: 'hx-mk__dot', r: R }),
          ev.bg,
          s('text', { class: 'hx-mk__label', x: R + 7, y: 0, dy: '0.34em' }, s('tspan', { class: 'hx-mk__year' }, ev.yShort + ' '), ev.titleEl));
        ev.stem = s('line', { class: 'hx-stem', 'data-tag': ev.tag });
        ev.y = axisY; ev.ty = axisY; ev.vis = true; ev.shown = null;
        gStems.appendChild(ev.stem);
        gMarks.appendChild(ev.el);
      });
      svg.appendChild(s('title', null, 'Timeline of algorithm discoveries'));
      svg.append(gEras, gStems, axisLine, gBreaks, gTicks, playhead, gMarks);
      tip = h('div', { class: 'hx-tip', role: 'tooltip', hidden: true });
      stage.insertBefore(help, stage.firstChild);
      stage.appendChild(svg);
      stage.appendChild(tip);
      prepareLabels();
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { prepareLabels(); layoutKey = ''; request(); });

      buildMini($('[data-mini]'));
      bindPointer();
      bindKeys();
      $$('[data-zoom]').forEach(function (b) {
        b.addEventListener('click', function () {
          var z = b.dataset.zoom;
          if (z === 'in') zoomBy(1.6);
          else if (z === 'out') zoomBy(1 / 1.6);
          else if (z === 'all') fitAll();
          else if (z === 'matches') fitMatches();
        });
      });
      VDSA.onResize(stage, resize);
      resize();
    }

    function resize() {
      var rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      var c = (x0 + plotW / 2) / (plotW * k);
      W = Math.round(rect.width);
      plotW = Math.max(200, W - PAD * 2 - 12);
      svg.setAttribute('width', W);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + SVG_H);
      axisLine.setAttribute('x1', 0); axisLine.setAttribute('x2', W);
      x0 = clampX(k, c * plotW * k - plotW / 2);
      layoutKey = ''; tickKey = '';
      EVENTS.forEach(function (ev) { ev.mlk = null; });
      resizeMini();
      request();
    }

    /* ---- lane layout. Depends only on the zoom k and the filter, never on the pan offset. */
    function computeLayout(kk) {
      var scale = plotW * kk, lanes = [], l, i, j;
      for (l = 0; l < LANES; l++) lanes.push([]);
      var m = [];
      EVENTS.forEach(function (ev) { ev.cx = ev.u * scale; ev.label = false; ev.lane = -1; if (ev.match) m.push(ev); });
      var n = m.length;
      for (i = 0; i < n; i++) { m[i].a = m[i].cx - R - 4; m[i].b = m[i].cx + R + 7 + m[i].lw + 14; }
      // How many label boxes cover each left edge? A label is safe where that stays under LABEL_LANES:
      // first-fit on intervals in left-edge order then never needs more lanes than that.
      var cover = new Array(n);
      for (i = 0; i < n; i++) {
        var c = 0;
        for (j = 0; j < n; j++) if (m[j].a <= m[i].a && m[i].a < m[j].b) c++;
        cover[i] = c;
      }
      var eligible = new Array(n);
      for (i = 0; i < n; i++) {
        var mx = cover[i];
        for (j = i + 1; j < n && m[j].a < m[i].b; j++) if (cover[j] > mx) mx = cover[j];
        for (j = i - 1; j >= 0 && m[j].a >= m[i].a; j--) if (cover[j] > mx) mx = cover[j];
        eligible[i] = mx <= LABEL_LANES;
      }
      function fits(lane, a, b) {
        var L = lanes[lane];
        for (var q = 0; q < L.length; q++) if (a < L[q][1] && b > L[q][0]) return false;
        return true;
      }
      var rest = [];
      for (i = 0; i < n; i++) {
        var ev = m[i];
        if (!eligible[i]) { rest.push(ev); continue; }
        for (l = 0; l < LABEL_LANES; l++) if (fits(l, ev.a, ev.b)) { lanes[l].push([ev.a, ev.b]); ev.lane = l; ev.label = true; break; }
        if (ev.lane < 0) rest.push(ev);
      }
      rest.forEach(function (ev) {
        var a = ev.cx - R - 2.5, b = ev.cx + R + 2.5;
        for (var q = 0; q < LANES; q++) if (fits(q, a, b)) { lanes[q].push([a, b]); ev.lane = q; return; }
        ev.lane = LANES - 1;
      });
      EVENTS.forEach(function (ev) { ev.ty = ev.match ? laneY(ev.lane) : axisY; });
    }

    /* The smallest zoom at which an event gets a text label (used by Play and by the hero). */
    function minLabelK(ev) {
      if (!ev.match) return k;
      if (ev.mlk && ev.mlkV === state.filterVersion) return ev.mlk;
      var found = KMAX;
      for (var kk = 1; kk <= KMAX; kk *= 1.2) { computeLayout(kk); if (ev.label) { found = kk; break; } }
      ev.mlk = found; ev.mlkV = state.filterVersion;
      layoutKey = '';
      return found;
    }

    /* ---- per-frame draw */
    function frame(t) {
      raf = 0;
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      var moving = false;
      if (viewAnim) { stepViewAnim(t); moving = true; }
      var key = k.toFixed(5) + '|' + state.filterVersion + '|' + plotW;
      if (key !== layoutKey) { computeLayout(k); layoutKey = key; }
      var alpha = reduced() ? 1 : 1 - Math.pow(0.002, dt / 420);
      for (var i = 0; i < EVENTS.length; i++) {
        var ev = EVENTS[i];
        var x = PAD + ev.cx - x0;
        var dy = ev.ty - ev.y;
        if (Math.abs(dy) > 0.25) { ev.y += dy * alpha; moving = true; } else ev.y = ev.ty;
        var vis = (x > -LABEL_MAX - 60 && x < W + 30) || ev === state.selected || ev.el === doc.activeElement; // never hide what has focus
        if (vis !== ev.vis) { ev.el.style.display = vis ? '' : 'none'; ev.stem.style.display = vis ? '' : 'none'; ev.vis = vis; }
        if (!vis) continue;
        ev.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + ev.y.toFixed(1) + ')');
        ev.stem.setAttribute('x1', x.toFixed(1)); ev.stem.setAttribute('x2', x.toFixed(1));
        ev.stem.setAttribute('y1', (ev.y + R).toFixed(1)); ev.stem.setAttribute('y2', axisY);
        var shown = ev.label && ev.match;
        if (shown !== ev.shown) {
          ev.shown = shown;
          ev.el.classList.toggle('has-label', shown);
          ev.hit.setAttribute('width', shown ? R + 7 + ev.lw + 16 : 24);
        }
      }
      drawEras();
      drawTicks();
      drawMiniView();
      if (state.selected && PLAY.on) {
        var px = PAD + state.selected.u * plotW * k - x0;
        playhead.setAttribute('x1', px.toFixed(1)); playhead.setAttribute('x2', px.toFixed(1));
      }
      if (tipEv) placeTip(tipEv);
      if (moving) request();
    }

    function drawEras() {
      eraEls.forEach(function (er) {
        var a = sx(er.seg.u0), b = sx(er.seg.u1);
        var va = Math.max(a, 0), vb = Math.min(b, W);
        var visible = vb > va;
        er.g.style.display = visible ? '' : 'none';
        if (!visible) return;
        er.band.setAttribute('x', va.toFixed(1)); er.band.setAttribute('width', (vb - va).toFixed(1));
        er.line.setAttribute('x1', a.toFixed(1)); er.line.setAttribute('x2', a.toFixed(1));
        er.line.style.display = a > 1 && a < W ? '' : 'none';
        if (!er.lw) {
          er.lw = er.label.getComputedTextLength() + 8;
          er.nw = er.label.firstChild.getComputedTextLength();
        }
        var room = vb - va, full = room >= er.lw + 24, nameOnly = !full && room >= er.nw + 20;
        var w = full ? er.lw : er.nw;
        var lx = Math.max(a, 0) + 12;
        if (lx + w > b - 10) lx = b - 10 - w;
        er.label.setAttribute('x', Math.max(lx, va + 8).toFixed(1));
        er.label.style.opacity = full || nameOnly ? '' : '0';
        er.label.classList.toggle('is-tight', !full);
      });
    }

    var STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    function drawTicks() {
      var key = k.toFixed(5) + '|' + x0.toFixed(1) + '|' + W;
      if (key === tickKey) return;
      tickKey = key;
      VDSA.clear(gTicks); VDSA.clear(gBreaks);
      var frag = doc.createDocumentFragment(), bfrag = doc.createDocumentFragment();
      var placed = [];
      function addTick(v, major) {
        var x = sx(uOf(v));
        if (x < -30 || x > W + 30) return;
        var text = yearText(v);
        var wdt = text.length * 7 + 8;
        for (var i = 0; i < placed.length; i++) if (Math.abs(placed[i] - x) < wdt) return;
        placed.push(x);
        frag.appendChild(s('line', { class: 'hx-tick' + (major ? ' is-major' : ''), x1: x, x2: x, y1: axisY, y2: axisY + (major ? 8 : 5) }));
        var tx = VDSA.clamp(x, wdt / 2 - 2, W - wdt / 2 + 2); // keep edge labels inside the stage
        frag.appendChild(s('text', { class: 'hx-tick__label' + (major ? ' is-major' : ''), x: tx, y: axisY + 22 }, text));
      }
      // Era boundaries first: they carry the scale breaks and win label collisions.
      SEGS.forEach(function (sg, i) {
        if (i === 0) return;
        addTick(sg.from, true);
        var x = sx(sg.u0);
        if (x > 4 && x < W - 4) bfrag.appendChild(s('path', { class: 'hx-break', d: 'M' + (x - 5) + ' ' + (axisY + 5) + 'l3 -10M' + (x + 1) + ' ' + (axisY + 5) + 'l3 -10' }));
      });
      addTick(-300, false);
      SEGS.forEach(function (sg) {
        var ppy = sg.w * plotW * k / (sg.to - sg.from);
        var step = STEPS[STEPS.length - 1] * 10;
        for (var i = 0; i < STEPS.length; i++) if (STEPS[i] * ppy >= 64) { step = STEPS[i]; break; }
        var v = Math.ceil(sg.from / step) * step;
        for (; v < sg.to; v += step) if (v !== 0 && v !== sg.from) addTick(v, false);
      });
      gTicks.appendChild(frag);
      gBreaks.appendChild(bfrag);
    }

    /* ---- view changes */
    function animateView(k1, x1, ms) {
      k1 = VDSA.clamp(k1, 1, KMAX);
      x1 = clampX(k1, x1);
      var d = VDSA.dur(ms == null ? 420 : ms);
      if (!d) { viewAnim = null; k = k1; x0 = x1; request(); return; }
      viewAnim = {
        t0: performance.now(), d: d, lk0: Math.log(k), lk1: Math.log(k1),
        c0: (x0 + plotW / 2) / (plotW * k), c1: (x1 + plotW / 2) / (plotW * k1)
      };
      request();
    }
    function stepViewAnim(t) {
      var a = viewAnim, p = Math.min(1, (t - a.t0) / a.d), e = VDSA.ease.inOut(p);
      k = Math.exp(VDSA.lerp(a.lk0, a.lk1, e));
      x0 = clampX(k, VDSA.lerp(a.c0, a.c1, e) * plotW * k - plotW / 2);
      if (p >= 1) viewAnim = null;
    }
    function zoomAt(factor, px, ms) {
      var k1 = VDSA.clamp(k * factor, 1, KMAX);
      var u = (px - PAD + x0) / (plotW * k);
      animateView(k1, u * plotW * k1 - (px - PAD), ms);
    }
    function focusPx() {
      var ev = state.selected;
      if (ev) { var x = PAD + ev.u * plotW * k - x0; if (x > 0 && x < W) return x; }
      return PAD + plotW / 2;
    }
    function zoomBy(f) { hideTip(); zoomAt(f, focusPx(), 320); }
    function fitAll() { hideTip(); animateView(1, 0, 520); }
    function fitRange(list, ms) {
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      var span = (last.u - first.u) * plotW;
      var tail = R + 7 + last.lw + 24, lead = 40;   // room for the last label, and a margin on the left
      var k1 = list.length === 1 ? Math.max(k, minLabelK(first) * 1.1) : VDSA.clamp((plotW - tail - lead) / Math.max(span, 1), 1, KMAX);
      var x1 = first.u * plotW * k1 - lead;
      var used = span * k1 + tail + lead;
      if (used < plotW) x1 -= (plotW - used) / 2;  // centre a short range
      animateView(k1, x1, ms == null ? 620 : ms);
    }
    function fitMatches() { hideTip(); fitRange(matchingEvents()); }
    function ensureVisible(ev, ms) {
      var x = PAD + ev.u * plotW * k - x0;
      var room = (ev.label && ev.match ? ev.lw + 34 : 34);
      if (x < 36 || x + room > W - 12) animateView(k, ev.u * plotW * k - plotW * 0.36, ms == null ? 360 : ms);
    }
    function flyTo(ev, ms) {
      var need = minLabelK(ev);
      var k1 = (k >= need && k <= need * 2.4) ? k : need * 1.08;
      animateView(k1, ev.u * plotW * k1 - plotW * 0.38, ms == null ? 900 : ms);
    }

    /* ---- selection, filter and play hooks */
    function setTabStop() {
      var target = state.selected && state.selected.match ? state.selected : matchingEvents()[0] || EVENTS[0];
      EVENTS.forEach(function (ev) { ev.el.setAttribute('tabindex', ev === target ? '0' : '-1'); });
    }
    function markSelected(ev, opts) {
      EVENTS.forEach(function (other) {
        var on = other === ev;
        other.el.classList.toggle('is-sel', on);
        other.el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (gMarks.lastChild !== ev.el) { // raise above its neighbours, keeping keyboard focus
        var hadFocus = doc.activeElement === ev.el;
        gMarks.appendChild(ev.el);
        if (hadFocus) ev.el.focus({ preventScroll: true });
      }
      setTabStop();
      if (opts && opts.focus && state.view === 'timeline') ev.el.focus({ preventScroll: true });
      if (opts && opts.ensure && state.view === 'timeline') {
        request();
        win.requestAnimationFrame(function () { ensureVisible(ev); });
      }
      request();
    }
    function onFilter(opts) {
      EVENTS.forEach(function (ev) { ev.el.classList.toggle('is-dim', !ev.match); ev.stem.classList.toggle('is-dim', !ev.match); ev.mlk = null; });
      svg.classList.toggle('is-filtered', anyFilter());
      setTabStop();
      drawMiniMarks();
      if (opts && opts.fit && state.view === 'timeline') {
        var list = matchingEvents();
        if (list.length) win.requestAnimationFrame(function () { fitRange(list); });
      }
      if (opts && opts.flash) {
        clearTimeout(flashTimer);
        EVENTS.forEach(function (ev) { ev.el.classList.toggle('is-flash', ev.match && anyFilter()); });
        flashTimer = setTimeout(function () { EVENTS.forEach(function (ev) { ev.el.classList.remove('is-flash'); }); }, 1900);
      }
      request();
    }
    function setPlaying(on) {
      svg.classList.toggle('is-playing', on);
      if (!on) EVENTS.forEach(function (ev) { ev.el.classList.remove('is-lit', 'is-pop'); });
      request();
    }
    function light(ev) {
      ev.el.classList.add('is-lit');
      ev.el.classList.remove('is-pop');
      ev.el.getBoundingClientRect(); // restart the pop animation
      ev.el.classList.add('is-pop');
    }
    function lightUpTo(list, idx) { list.forEach(function (ev, i) { ev.el.classList.toggle('is-lit', i < idx); ev.el.classList.remove('is-pop'); }); }

    /* ---- tooltip */
    function showTip(ev) {
      var e = ev.data;
      var names = e.people.map(function (id) { return peopleById[id] ? peopleById[id].name : ''; }).filter(Boolean);
      VDSA.clear(tip);
      tip.appendChild(h('p', { class: 'hx-tip__year' }, e.yearLabel));
      tip.appendChild(h('p', { class: 'hx-tip__title' }, e.title));
      tip.appendChild(h('p', { class: 'hx-tip__meta' },
        e.tags.map(function (t) { return h('span', { class: 'hx-tip__tag', 'data-tag': t }, TAG_LABELS[t]); }),
        names.length ? h('span', { class: 'hx-tip__people' }, names.join(', ')) : null));
      if (!ev.match) tip.appendChild(h('p', { class: 'hx-tip__note' }, 'Hidden by your filters'));
      tip.hidden = false;
      tipEv = ev;
      placeTip(ev);
    }
    function placeTip(ev) {
      if (!ev.vis) { hideTip(); return; }
      var x = PAD + ev.cx - x0, y = ev.y;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = VDSA.clamp(x - 28, 8, W - tw - 8);
      var top = y - th - 16;
      if (top < 4) top = y + 18;
      tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    }
    function hideTip() { tip.hidden = true; tipEv = null; }

    /* ---- pointer: drag to pan, pinch to zoom, wheel */
    function markerFrom(target) {
      var g = target && target.closest ? target.closest('.hx-mk') : null;
      return g ? eventById[g.getAttribute('data-id')] : null;
    }
    function showHint(text) {
      hint.textContent = text;
      hint.classList.add('is-on');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { hint.classList.remove('is-on'); }, 1500);
    }
    function bindPointer() {
      var pointers = {}, drag = null, pinch = null;
      function count() { return Object.keys(pointers).length; }
      function stagePx(clientX) { return clientX - stage.getBoundingClientRect().left; }

      stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging; clicks focus the marker themselves
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (count() === 1) {
          drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x0, moved: false, target: markerFrom(e.target) };
        } else if (count() === 2) {
          var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]];
          pinch = { d: Math.max(20, Math.abs(a.x - b.x)), k: k, mid: stagePx((a.x + b.x) / 2), x0: x0 };
          drag = null;
          ids.forEach(function (id) { try { stage.setPointerCapture(+id); } catch (err) { /* ignore */ } });
        }
      });
      stage.addEventListener('pointermove', function (e) {
        if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (pinch && count() >= 2) {
          var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]];
          var d = Math.max(20, Math.abs(a.x - b.x));
          var k1 = VDSA.clamp(pinch.k * d / pinch.d, 1, KMAX);
          var u = (pinch.mid - PAD + pinch.x0) / (plotW * pinch.k);
          viewAnim = null;
          k = k1; x0 = clampX(k, u * plotW * k - (stagePx((a.x + b.x) / 2) - PAD));
          hideTip(); request();
          return;
        }
        if (drag && e.pointerId === drag.id) {
          var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
          if (!drag.moved && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
            drag.moved = true;
            try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            stage.classList.add('is-dragging');
            viewAnim = null;
            hideTip();
            if (PLAY.on) playPause();
          }
          if (drag.moved) { x0 = clampX(k, drag.x0 - dx); request(); }
        }
      });
      function end(e) {
        if (drag && e.pointerId === drag.id && !drag.moved && e.type === 'pointerup' && drag.target) {
          if (PLAY.on) playPause();
          select(drag.target, { source: 'pointer', focus: e.pointerType === 'mouse' });
        }
        delete pointers[e.pointerId];
        if (count() < 2) pinch = null;
        if (!count()) drag = null;
        stage.classList.remove('is-dragging');
      }
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);

      stage.addEventListener('pointerover', function (e) {
        if (e.pointerType !== 'mouse' || stage.classList.contains('is-dragging')) return;
        var ev = markerFrom(e.target);
        if (ev && ev !== hoverEv) {
          if (hoverEv) hoverEv.el.classList.remove('is-hover');
          hoverEv = ev; ev.el.classList.add('is-hover'); showTip(ev);
        }
      });
      stage.addEventListener('pointerout', function (e) {
        var ev = markerFrom(e.target);
        if (ev && (!e.relatedTarget || markerFrom(e.relatedTarget) !== ev)) {
          ev.el.classList.remove('is-hover');
          if (hoverEv === ev) hoverEv = null;
          if (tipEv === ev && doc.activeElement !== ev.el) hideTip();
        }
      });

      stage.addEventListener('wheel', function (e) {
        var scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        var dx = e.deltaX * scale, dy = e.deltaY * scale;
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          viewAnim = null;
          var f = Math.exp(-VDSA.clamp(dy, -60, 60) * (e.ctrlKey && Math.abs(dy) < 12 ? 0.02 : 0.006));
          var px = stagePx(e.clientX);
          var u = (px - PAD + x0) / (plotW * k);
          k = VDSA.clamp(k * f, 1, KMAX);
          x0 = clampX(k, u * plotW * k - (px - PAD));
          hideTip(); request();
        } else if (Math.abs(dx) > Math.abs(dy) || e.shiftKey) {
          e.preventDefault();
          viewAnim = null;
          x0 = clampX(k, x0 + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
          hideTip(); request();
        } else if (Math.abs(dy) > 4) {
          showHint(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Pinch, or hold ⌘ and scroll, to zoom' : 'Hold Ctrl and scroll to zoom');
        }
      }, { passive: false });
    }

    /* ---- keyboard */
    function bindKeys() {
      svg.addEventListener('focusin', function (e) {
        var ev = markerFrom(e.target);
        if (ev) { ev.el.classList.add('is-hover'); showTip(ev); ensureVisible(ev, 240); }
      });
      svg.addEventListener('focusout', function (e) {
        var ev = markerFrom(e.target);
        if (ev) { ev.el.classList.remove('is-hover'); if (tipEv === ev) hideTip(); }
      });
      svg.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var ev = markerFrom(e.target);
        var handled = true;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowLeft':
            if (e.shiftKey) animateView(k, x0 + (e.key === 'ArrowRight' ? 1 : -1) * plotW * 0.3, 260);
            else { if (PLAY.on) playPause(); stepSelection(e.key === 'ArrowRight' ? 1 : -1, { focus: true, source: 'key' }); }
            break;
          case 'Home': case 'End': {
            var list = matchingEvents();
            if (list.length) { if (PLAY.on) playPause(); select(e.key === 'Home' ? list[0] : list[list.length - 1], { focus: true, ensure: true, source: 'key' }); }
            break;
          }
          case '+': case '=': zoomBy(1.6); break;
          case '-': case '_': zoomBy(1 / 1.6); break;
          case '0': fitAll(); break;
          case 'Enter': case ' ':
            if (ev) { if (PLAY.on) playPause(); select(ev, { source: 'key' }); } else handled = false;
            break;
          case 'Escape': hideTip(); break;
          case 'p': case 'P': togglePlay(); break;
          default: handled = false;
        }
        if (handled) e.preventDefault();
      });
    }

    /* ---- minimap: the whole range, with the visible window */
    var MPAD = 10, mW = 600, M_H = 42, miniDrag = null;
    function buildMini(el) {
      mini = el;
      miniSvg = s('svg', { class: 'hx-mini__svg', height: M_H });
      var gSegs = s('g', { class: 'hx-mini__segs' });
      miniMarks = s('g', { class: 'hx-mini__marks' });
      miniView = s('rect', { class: 'hx-mini__view', y: 2, height: M_H - 4, rx: 6 });
      miniSvg.append(gSegs, miniMarks, miniView);
      mini.appendChild(miniSvg);
      mini._segs = gSegs;
      mini.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var px = e.clientX - mini.getBoundingClientRect().left;
        var vx = MPAD + (x0 / (plotW * k)) * (mW - 2 * MPAD), vw = (mW - 2 * MPAD) / k;
        if (px < vx || px > vx + vw) { // jump: centre the window on the click
          var u = (px - MPAD) / (mW - 2 * MPAD);
          viewAnim = null;
          x0 = clampX(k, u * plotW * k - plotW / 2);
          request();
        }
        miniDrag = { sx: e.clientX, x0: x0 };
        try { mini.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        mini.classList.add('is-dragging');
        hideTip();
        e.preventDefault();
      });
      mini.addEventListener('pointermove', function (e) {
        if (!miniDrag) return;
        var du = (e.clientX - miniDrag.sx) / (mW - 2 * MPAD);
        x0 = clampX(k, miniDrag.x0 + du * plotW * k);
        request();
      });
      function up() { miniDrag = null; mini.classList.remove('is-dragging'); }
      mini.addEventListener('pointerup', up);
      mini.addEventListener('pointercancel', up);
    }
    function resizeMini() {
      mW = Math.max(120, Math.round(mini.getBoundingClientRect().width || 600));
      miniSvg.setAttribute('width', mW);
      miniSvg.setAttribute('viewBox', '0 0 ' + mW + ' ' + M_H);
      VDSA.clear(mini._segs);
      SEGS.forEach(function (sg, i) {
        var a = MPAD + sg.u0 * (mW - 2 * MPAD), b = MPAD + sg.u1 * (mW - 2 * MPAD);
        mini._segs.appendChild(s('rect', { class: 'hx-mini__seg' + (i % 2 ? ' is-alt' : ''), x: a, width: b - a, y: 6, height: M_H - 12, rx: 3 }));
      });
      drawMiniMarks();
    }
    function drawMiniMarks() {
      if (!miniMarks) return;
      VDSA.clear(miniMarks);
      var frag = doc.createDocumentFragment();
      EVENTS.forEach(function (ev) {
        var x = MPAD + ev.u * (mW - 2 * MPAD);
        frag.appendChild(s('rect', { class: 'hx-mini__mk' + (ev.match ? '' : ' is-dim'), 'data-tag': ev.tag, x: (x - 1).toFixed(1), y: ev.match ? 12 : 17, width: 2, height: ev.match ? M_H - 24 : M_H - 34, rx: 1 }));
      });
      miniMarks.appendChild(frag);
    }
    function drawMiniView() {
      if (!miniView) return;
      var inner = mW - 2 * MPAD;
      miniView.setAttribute('x', (MPAD + (x0 / (plotW * k)) * inner).toFixed(1));
      miniView.setAttribute('width', Math.max(6, inner / k).toFixed(1));
    }

    return {
      build: build, request: request, resize: resize, markSelected: markSelected, onFilter: onFilter,
      setPlaying: setPlaying, light: light, lightUpTo: lightUpTo, flyTo: flyTo, ensureVisible: ensureVisible,
      fitAll: fitAll, fitMatches: fitMatches, hideTip: hideTip,
      get k() { return k; }
    };
  }());

  /* ================================================================ 5a. Detail content (shared by panel and list) */
  function avatar(p, size) {
    var c = size / 2, rr = c - 2.5, sw = size >= 56 ? 3.4 : 2.6;
    var svg = s('svg', { class: 'hx-av', width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true', 'data-tag': p.tag });
    svg.appendChild(s('circle', { class: 'hx-av__bg', cx: c, cy: c, r: rr - sw - 2 }));
    var n = p.events.length;
    if (n <= 1) {
      svg.appendChild(s('circle', { class: 'hx-av__arc', 'data-tag': n ? p.events[0].tag : p.tag, cx: c, cy: c, r: rr, 'stroke-width': sw }));
    } else {
      var gap = Math.min(18, 70 / n), per = 360 / n;
      p.events.forEach(function (ev, i) {
        var a0 = (-90 + i * per + gap / 2) * Math.PI / 180, a1 = (-90 + (i + 1) * per - gap / 2) * Math.PI / 180;
        var large = (a1 - a0) > Math.PI ? 1 : 0;
        svg.appendChild(s('path', { class: 'hx-av__arc', 'data-tag': ev.tag, 'stroke-width': sw,
          d: 'M' + (c + rr * Math.cos(a0)).toFixed(2) + ' ' + (c + rr * Math.sin(a0)).toFixed(2) + 'A' + rr + ' ' + rr + ' 0 ' + large + ' 1 ' + (c + rr * Math.cos(a1)).toFixed(2) + ' ' + (c + rr * Math.sin(a1)).toFixed(2) }));
      });
    }
    svg.appendChild(s('text', { class: 'hx-av__ini', x: c, y: c, dy: '0.36em', 'font-size': (p.ini.length > 1 ? size * 0.34 : size * 0.42).toFixed(1) }, p.ini));
    return svg;
  }

  function lessonChip(id) {
    var l = lessonById(id);
    if (!l) return null;
    var num = h('span', { class: 'hx-lesson__n' }, pad2(l.number));
    if (l.status === 'live') return h('a', { class: 'hx-lesson', 'data-unit': l.unit, href: siteUrl(l.href) }, num, h('span', null, l.title));
    return h('span', { class: 'hx-lesson is-soon', 'data-unit': l.unit, title: 'This lesson is not published yet' }, num, h('span', null, l.title), h('span', { class: 'soon' }, 'Coming soon'));
  }

  function personMini(pid, compact) {
    var p = personById[pid];
    if (!p) return null;
    var n = p.events.length;
    return h('div', { class: 'hx-pm', 'data-tag': p.tag },
      avatar(p, compact ? 38 : 44),
      h('div', { class: 'hx-pm__text' },
        h('p', { class: 'hx-pm__name' }, p.data.name, h('span', { class: 'hx-pm__life' }, p.data.lifeLabel)),
        h('p', { class: 'hx-pm__bio' }, p.data.bio),
        n > 1 ? h('button', { class: 'hx-pm__btn', type: 'button', onclick: function () { choosePerson(p.id, { scroll: false }); } }, 'Show all ' + n + ' of their events') : null));
  }

  function detailContent(ev, compact) {
    var e = ev.data, era = eraById[e.era];
    var lessons = e.lessons.map(lessonChip).filter(Boolean);
    var when = h('div', { class: 'hx-det__when', 'data-tag': ev.tag },
      h('p', { class: 'hx-det__year' }, e.yearLabel),
      h('p', { class: 'hx-det__era' }, era ? era.label : ''),
      h('ul', { class: 'hx-det__tags', 'aria-label': 'Topics' }, e.tags.map(function (t) { return h('li', { class: 'hx-tagpill', 'data-tag': t }, TAG_LABELS[t]); })));
    var body = h('div', { class: 'hx-det__body' },
      compact ? null : h('h3', { class: 'hx-det__title' }, e.title),
      h('p', { class: 'hx-det__summary' }, e.summary),
      h('p', { class: 'hx-det__detail' }, e.detail),
      lessons.length ? h('div', { class: 'hx-det__block' }, h('p', { class: 'hx-det__label' }, lessons.length > 1 ? 'Related lessons' : 'Related lesson'), h('div', { class: 'hx-det__lessons' }, lessons)) : null,
      h('div', { class: 'hx-det__block' }, h('p', { class: 'hx-det__label' }, 'Sources'),
        h('ul', { class: 'hx-det__sources' }, e.sources.map(function (src) { return h('li', null, sourceNode(src)); }))));
    var people = h('div', { class: 'hx-det__people' },
      h('p', { class: 'hx-det__label' }, e.people.length > 1 ? 'People' : 'Person'),
      e.people.length ? e.people.map(function (pid) { return personMini(pid, compact); })
        : h('p', { class: 'hx-det__none' }, 'No profile for this one: the people involved are named in the story.'));
    if (!e.people.length) people.firstChild.textContent = 'People';
    return h('article', { class: 'hx-det' + (compact ? ' hx-det--compact' : ''), 'data-tag': ev.tag }, when, body, people);
  }

  /* ================================================================ 5b. Detail panel */
  var DETAIL = (function () {
    var bar, pos, prevBtn, nextBtn, content, live, startBtn;
    function build(el) {
      detailEl = el;
      pos = h('span', { class: 'hx-detail__pos' });
      prevBtn = h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Previous event', onclick: function () { if (PLAY.on) playPause(); stepSelection(-1, { ensure: true }); } },
        svgIcon('M15 6l-6 6 6 6'));
      nextBtn = h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': 'Next event', onclick: function () { if (PLAY.on) playPause(); stepSelection(1, { ensure: true }); } },
        svgIcon('M9 6l6 6-6 6'));
      bar = h('div', { class: 'hx-detail__bar' }, pos, h('div', { class: 'hx-detail__nav' }, prevBtn, nextBtn));
      content = h('div', { class: 'hx-detail__content' });
      live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
      el.append(bar, content, live);
      renderEmpty();
    }
    function renderEmpty() {
      VDSA.clear(content);
      content.appendChild(h('div', { class: 'hx-empty' },
        h('p', { class: 'hx-empty__title' }, 'Pick a dot to read its story.'),
        h('p', { class: 'hx-empty__text' }, 'Each story names the people, the year, what they found and where you meet it in the course. Or let the timeline tell it in order.'),
        h('div', { class: 'btn-row' },
          startBtn = h('button', { class: 'btn btn--secondary', type: 'button', onclick: function () { var m = matchingEvents()[0]; if (m) select(m, { ensure: true }); } }, 'Start with Euclid'),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: function () { playStart(true); } }, 'Play history'))));
      refreshNav();
    }
    function render(ev, opts) {
      VDSA.clear(content);
      var art = detailContent(ev, false);
      content.appendChild(art);
      if (!reduced()) { art.classList.add('is-entering'); win.requestAnimationFrame(function () { art.classList.remove('is-entering'); }); }
      if (!PLAY.on) live.textContent = ev.data.yearLabel + ': ' + ev.data.title;
      refreshNav();
    }
    function refreshNav() {
      if (!pos) return;
      var list = matchingEvents(), ev = state.selected;
      var idx = ev ? list.indexOf(ev) : -1;
      if (startBtn) { startBtn.textContent = anyFilter() ? 'Start with the first match' : 'Start with Euclid'; startBtn.disabled = !list.length; }
      if (!ev) pos.textContent = list.length + ' events to explore';
      else if (idx === -1) pos.textContent = 'Hidden by your filters';
      else pos.textContent = 'Event ' + (idx + 1) + ' of ' + list.length;
      prevBtn.disabled = !list.length || idx === 0;
      nextBtn.disabled = !list.length || (idx !== -1 && idx === list.length - 1);
    }
    return { build: build, render: render, refreshNav: refreshNav };
  }());

  function svgIcon(d) {
    return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }

  /* ================================================================ 5c. The list (phones, or List view) */
  var LIST = (function () {
    var root, empty, groups = [];
    function build(el) {
      root = el;
      SEGS.forEach(function (sg) {
        var era = eraById[sg.era];
        var ol = h('ol', { class: 'hx-litems' });
        var sec = h('section', { class: 'hx-lera', 'aria-label': era.label },
          h('header', { class: 'hx-lera__head' },
            h('h4', { class: 'hx-lera__name' }, era.label, h('span', { class: 'hx-lera__range' }, ERA_RANGE[sg.era])),
            h('p', { class: 'hx-lera__blurb' }, ERA_BLURB[sg.era] || '')),
          ol);
        var items = EVENTS.filter(function (ev) { return ev.data.era === sg.era; });
        items.forEach(function (ev) {
          var e = ev.data;
          var names = e.people.map(function (id) { return peopleById[id] ? peopleById[id].name : ''; }).filter(Boolean);
          var bodyId = 'hx-li-' + ev.id;
          var btn = h('button', { class: 'hx-li__row', type: 'button', 'aria-expanded': 'false', 'aria-controls': bodyId },
            h('span', { class: 'hx-li__year' }, ev.yShort),
            h('span', { class: 'hx-li__dot', 'aria-hidden': 'true' }),
            h('span', { class: 'hx-li__main' },
              h('span', { class: 'hx-li__title' }, e.title),
              h('span', { class: 'hx-li__meta' }, names.length ? names.join(', ') : e.tags.map(function (t) { return TAG_LABELS[t]; }).join(', '))),
            h('span', { class: 'hx-li__chev', 'aria-hidden': 'true' }));
          var body = h('div', { class: 'hx-li__body', id: bodyId, hidden: true });
          var li = h('li', { class: 'hx-li', 'data-id': ev.id, 'data-tag': ev.tag }, btn, body);
          btn.addEventListener('click', function () {
            if (PLAY.on) playPause();
            if (state.selected === ev && btn.getAttribute('aria-expanded') === 'true') { close(ev); return; }
            select(ev, { source: 'list', scroll: false });
          });
          ev.li = li; ev.liBtn = btn; ev.liBody = body;
          ol.appendChild(li);
        });
        groups.push({ sec: sec, items: items });
        root.appendChild(sec);
      });
      empty = h('div', { class: 'hx-list__empty', hidden: true },
        h('p', null, 'No events match these filters.'),
        h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: clearFilters }, 'Clear filters'));
      root.appendChild(empty);
    }
    function close(ev) {
      ev.liBtn.setAttribute('aria-expanded', 'false');
      ev.li.classList.remove('is-open');
      ev.liBody.hidden = true;
    }
    function open(ev, opts) {
      opts = opts || {};
      var before = ev.liBtn.getBoundingClientRect().top;
      EVENTS.forEach(function (other) { if (other !== ev && other.li.classList.contains('is-open')) close(other); });
      var shift = ev.liBtn.getBoundingClientRect().top - before;
      if (!opts.scroll && Math.abs(shift) > 1 && ev.liBtn.offsetParent) win.scrollBy(0, shift); // keep the row under the pointer
      if (!ev.liBody.firstChild) ev.liBody.appendChild(detailContent(ev, true));
      ev.liBody.hidden = false;
      ev.li.hidden = false;
      ev.li.classList.add('is-open');
      ev.liBtn.setAttribute('aria-expanded', 'true');
      if (opts.focus) ev.liBtn.focus({ preventScroll: true });
      if (opts.scroll) {
        var r = ev.li.getBoundingClientRect(), top = 72;
        if (r.top < top || r.top > win.innerHeight * 0.55) {
          win.scrollTo({ top: win.scrollY + r.top - top - 12, behavior: reduced() ? 'auto' : 'smooth' });
        }
      }
    }
    function onFilter() {
      var total = 0;
      groups.forEach(function (g) {
        var n = 0;
        g.items.forEach(function (ev) { ev.li.hidden = !ev.match; if (ev.match) n++; });
        g.sec.hidden = !n;
        total += n;
      });
      empty.hidden = total > 0;
    }
    function lit(ev, on) { ev.li.classList.toggle('is-lit', on); }
    return { build: build, open: open, onFilter: onFilter, lit: lit };
  }());

  /* ================================================================ 6. Play history */
  var PLAY = { on: false, paused: false, seq: [], i: 0, timer: 0, endTimer: 0, autoPaused: false };
  var STEP_MS = 3600;
  var playBtn, playLabel, playPos;

  function updatePlayBtn() {
    if (!playBtn) return;
    playBtn.setAttribute('aria-pressed', PLAY.on ? 'true' : 'false');
    playBtn.classList.toggle('is-playing', PLAY.on);
    playLabel.textContent = PLAY.on ? 'Pause' : PLAY.paused ? 'Resume' : 'Play history';
    playPos.textContent = (PLAY.on || PLAY.paused) && PLAY.seq.length ? (PLAY.i + 1) + ' / ' + PLAY.seq.length : '';
  }
  function playStart(fromStart) {
    clearTimeout(PLAY.endTimer);
    if (PLAY.paused && !fromStart) { playResume(); return; }
    if (PLAY.paused) playStop(true);
    var seq = matchingEvents();
    if (!seq.length) return;
    var start = 0;
    if (state.selected && fromStart !== true) { var idx = seq.indexOf(state.selected); if (idx > 0 && idx < seq.length - 1) start = idx; }
    PLAY.seq = seq; PLAY.i = start; PLAY.on = true; PLAY.paused = false;
    fig.classList.add('is-playing');
    TL.setPlaying(true);
    TL.lightUpTo(seq, start);
    EVENTS.forEach(function (ev) { LIST.lit(ev, false); });
    seq.slice(0, start).forEach(function (ev) { LIST.lit(ev, true); });
    bringFigureIntoView();
    playStep();
  }
  function playStep() {
    var ev = PLAY.seq[PLAY.i];
    if (!ev) { playEnd(); return; }
    TL.light(ev);
    LIST.lit(ev, true);
    select(ev, { source: 'play', scroll: true });
    if (state.view === 'timeline') TL.flyTo(ev);
    updatePlayBtn();
    clearTimeout(PLAY.timer);
    PLAY.timer = setTimeout(function () {
      if (!PLAY.on) return;
      PLAY.i++;
      if (PLAY.i >= PLAY.seq.length) playEnd(); else playStep();
    }, STEP_MS);
  }
  function playPause() {
    if (!PLAY.on) return;
    clearTimeout(PLAY.timer);
    PLAY.on = false; PLAY.paused = true;
    fig.classList.add('is-paused');
    updatePlayBtn();
  }
  function playResume() {
    var seq = PLAY.seq;
    var idx = state.selected ? seq.indexOf(state.selected) : -1;
    PLAY.i = idx !== -1 ? idx + 1 : PLAY.i + 1;
    if (PLAY.i >= seq.length) { playStop(true); playStart(); return; }
    PLAY.on = true; PLAY.paused = false;
    fig.classList.remove('is-paused');
    TL.lightUpTo(seq, PLAY.i);
    playStep();
  }
  function playEnd() {
    clearTimeout(PLAY.timer);
    PLAY.on = false; PLAY.paused = false;
    PLAY.i = PLAY.seq.length - 1;
    updatePlayBtn();
    playLabel.textContent = 'Play again';
    PLAY.endTimer = setTimeout(function () { playStop(false); }, 2200);
  }
  function playStop(silent) {
    clearTimeout(PLAY.timer); clearTimeout(PLAY.endTimer);
    PLAY.on = false; PLAY.paused = false;
    fig.classList.remove('is-playing', 'is-paused');
    TL.setPlaying(false);
    EVENTS.forEach(function (ev) { LIST.lit(ev, false); });
    updatePlayBtn();
  }
  function togglePlay() { if (PLAY.on) playPause(); else playStart(); }
  function bringFigureIntoView() {
    var target = state.view === 'timeline' ? $('[data-stage]', fig) : fig;
    var r = target.getBoundingClientRect();
    if (r.top < 56 || r.top > win.innerHeight * 0.45) {
      var top = win.scrollY + fig.getBoundingClientRect().top - 64;
      win.scrollTo({ top: top, behavior: reduced() ? 'auto' : 'smooth' });
    }
  }
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden && PLAY.on) { playPause(); PLAY.autoPaused = true; }
    else if (!doc.hidden && PLAY.autoPaused) { PLAY.autoPaused = false; if (PLAY.paused) playResumeSame(); }
  });
  function playResumeSame() { // resume on the same event after the tab comes back
    PLAY.on = true; PLAY.paused = false;
    fig.classList.remove('is-paused');
    updatePlayBtn();
    clearTimeout(PLAY.timer);
    PLAY.timer = setTimeout(function () { if (!PLAY.on) return; PLAY.i++; if (PLAY.i >= PLAY.seq.length) playEnd(); else playStep(); }, STEP_MS);
  }

  /* ================================================================ 7. People gallery */
  var GALLERY = (function () {
    var grid, more, countEl2, mode = 'events', expanded = false, cards = {};
    var SHOW = win.matchMedia && win.matchMedia('(max-width: 700px)').matches ? 8 : 16;
    function build() {
      grid = $('[data-people]');
      more = $('[data-pmore]');
      countEl2 = $('[data-pcount]');
      PEOPLE.forEach(function (p) {
        var n = p.events.length;
        var card = h('button', { class: 'hx-pc', type: 'button', 'aria-pressed': 'false', 'data-tag': p.tag,
          'aria-label': p.data.name + ', ' + p.data.lifeLabel + '. Known for ' + p.data.knownFor.join(', ') + '. Show ' + plural(n, 'event') + ' on the timeline.' },
          avatar(p, 58),
          h('span', { class: 'hx-pc__text' },
            h('span', { class: 'hx-pc__name' }, p.data.name),
            h('span', { class: 'hx-pc__life' }, p.data.lifeLabel),
            h('span', { class: 'hx-pc__known' }, p.data.knownFor.slice(0, 2).join(', '))),
          h('span', { class: 'hx-pc__count' }, plural(n, 'event')));
        card.addEventListener('click', function () {
          if (state.person === p.id) { setFilter({ person: '' }); return; }
          choosePerson(p.id, { scroll: true });
        });
        cards[p.id] = card;
      });
      $$('[data-psort] .seg__btn').forEach(function (b) {
        b.addEventListener('click', function () {
          mode = b.dataset.sort;
          $$('[data-psort] .seg__btn').forEach(function (o) { o.setAttribute('aria-checked', o === b ? 'true' : 'false'); });
          render();
        });
      });
      segKeys($('[data-psort]'));
      more.addEventListener('click', function () {
        expanded = !expanded;
        render();
        if (!expanded) grid.scrollIntoView({ block: 'nearest' });
      });
      render();
    }
    function sorted() {
      var list = PEOPLE.slice();
      if (mode === 'events') list.sort(function (a, b) { return b.events.length - a.events.length || a.sortYear - b.sortYear; });
      else if (mode === 'born') list.sort(function (a, b) { return a.sortYear - b.sortYear || a.i - b.i; });
      else list.sort(function (a, b) { return a.sur.localeCompare(b.sur); });
      return list;
    }
    function render() {
      var list = sorted();
      VDSA.clear(grid);
      list.forEach(function (p, i) {
        var show = expanded || i < SHOW || state.person === p.id;
        if (show) grid.appendChild(cards[p.id]);
      });
      more.textContent = expanded ? 'Show fewer people' : 'Show all ' + PEOPLE.length + ' people';
      more.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      countEl2.textContent = expanded ? 'All ' + PEOPLE.length + ' people' : grid.children.length + ' of ' + PEOPLE.length + ' people';
      markActive();
    }
    function markActive() {
      Object.keys(cards).forEach(function (id) { cards[id].setAttribute('aria-pressed', state.person === id ? 'true' : 'false'); });
      if (state.person && cards[state.person] && !cards[state.person].isConnected && grid) render();
    }
    return { build: build, markActive: markActive };
  }());

  function choosePerson(pid, opts) {
    var p = personById[pid];
    if (!p) return;
    setFilter({ person: pid }, { fit: true, flash: true });
    if (p.events[0]) select(p.events[0], { source: 'person', scroll: false });
    if (opts && opts.scroll) {
      var top = win.scrollY + fig.getBoundingClientRect().top - 64;
      win.scrollTo({ top: top, behavior: reduced() ? 'auto' : 'smooth' });
    }
  }

  /* Arrow keys inside a segmented radio group. */
  function segKeys(group) {
    if (!group) return;
    group.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var btns = $$('.seg__btn', group), i = btns.indexOf(doc.activeElement);
      if (i === -1) return;
      var next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
      next.focus(); next.click(); e.preventDefault();
    });
    var btns = $$('.seg__btn', group);
    function roving() { btns.forEach(function (b) { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; }); }
    btns.forEach(function (b) { b.addEventListener('click', roving); });
    roving();
  }

  /* ================================================================ 8. Did you know? */
  var ANECDOTES = [
    { id: 'lovelace-note-g', head: 'The first bug is older than computers', text: 'Ada Lovelace’s table for computing Bernoulli numbers was written for a machine that was never built. In operation 4, two numbers are divided the wrong way round.' },
    { id: 'mark-i-loops', head: 'Loops made of paper tape', text: 'The Harvard Mark I had no jump instruction. To repeat a calculation, operators wound the tape back, or glued it into a loop. John Backus remembered one loop, on a later IBM machine, that picked up a half twist and became a Möbius strip.' },
    { id: 'bellman-dynamic-programming', head: 'A name picked to hide the research', text: 'Richard Bellman said he chose “dynamic programming” because the Secretary of Defense could not stand the word research. Nobody could use “dynamic” as an insult. The dates do not quite fit, so enjoy it as Bellman told it.' },
    { id: 'harris-ross-rail', head: 'The bottleneck was a target', text: 'Max flow began as a secret RAND study of the railways from the Soviet Union into Eastern Europe. Its minimum cut, labelled “the bottleneck”, was the set of links an air force would target.' },
    { id: 'dijkstra-cafe', head: 'Twenty minutes, no pencil', text: 'Edsger Dijkstra designed his shortest-path algorithm in about twenty minutes, on a café terrace in Amsterdam with his fiancée, without paper. He wanted a demo anyone could follow: the shortest route between Dutch cities.' },
    { id: 'hoare-quicksort', head: 'A sixpence on quicksort', text: 'Asked by his boss to code Shellsort, Tony Hoare said he knew something faster. They bet sixpence. Hoare had invented quicksort as a student in Moscow, sorting the words of Russian sentences, and he won.' },
    { id: 'hashing-in-print', head: 'Too undignified to print', text: 'Programmers said “hash” from the 1950s on, but Donald Knuth found that nobody dared print such an undignified word until 1967.' },
    { id: 'red-black-trees', head: 'Why red and black?', text: 'Leonidas Guibas and Robert Sedgewick reportedly chose red because it looked best on their Xerox PARC laser printer. Guibas also remembered it as the colour of the pens they had.' },
    { id: 'programming-pearls', head: 'Nine in ten get it wrong', text: 'When Jon Bentley asked professional programmers to write binary search, about nine in ten versions had bugs. In 2006 Joshua Bloch found one in the proved version too: (low + high) / 2 overflows on huge arrays.' }
  ].filter(function (a) { return eventById[a.id]; });

  function buildDyk() {
    var wrap = $('[data-dyk]');
    if (!wrap) return;
    ANECDOTES.forEach(function (a) {
      var ev = eventById[a.id];
      wrap.appendChild(h('article', { class: 'hx-dc', 'data-tag': ev.tag },
        h('div', { class: 'hx-dc__top' },
          h('p', { class: 'hx-dc__year' }, ev.yShort),
          h('p', { class: 'hx-dc__no' }, 'No. ' + (ev.i + 1) + ' of ' + EVENTS.length)),
        h('h3', { class: 'hx-dc__head' }, a.head),
        h('p', { class: 'hx-dc__text' }, a.text),
        h('button', { class: 'hx-dc__go', type: 'button', onclick: function () { showOnTimeline(ev); } },
          'Show on the timeline', svgIcon('M5 12h14M13 6l6 6-6 6'))));
    });
  }
  function showOnTimeline(ev) {
    if (!ev.match) clearFilters();
    if (PLAY.on || PLAY.paused) playStop(true);
    var top = win.scrollY + fig.getBoundingClientRect().top - 64;
    win.scrollTo({ top: top, behavior: reduced() ? 'auto' : 'smooth' });
    select(ev, { source: 'dyk', scroll: false });
    if (state.view === 'timeline') TL.flyTo(ev, 700);
    else LIST.open(ev, { scroll: false });
  }

  /* ================================================================ 9. Hero teaser */
  function buildTeaser(stage) {
    if (!stage) return;
    var VW = 520, VH = 330, AX = 34, AW = 452, AY = 292, D = 6.2, RD = 2.5;
    var Y0 = -320, Y1 = 2030;
    var svg = s('svg', { class: 'hx-tz', viewBox: '0 0 ' + VW + ' ' + VH, 'aria-hidden': 'true' });
    var yearEl = s('text', { class: 'hx-tz__year', x: AX, y: 58 }, '300 BCE');
    var subEl = s('text', { class: 'hx-tz__sub', x: AX, y: 84 }, '');
    var play = s('line', { class: 'hx-tz__head', y1: 100, y2: AY });
    var axis = s('line', { class: 'hx-tz__axis', x1: AX, x2: AX + AW, y1: AY, y2: AY });
    var gA = s('g', { class: 'hx-tz__labels' }), gB = s('g', { class: 'hx-tz__labels' });
    gA.appendChild(s('text', { class: 'hx-tz__lbl', x: AX, y: AY + 20 }, '300 BCE'));
    gA.appendChild(s('text', { class: 'hx-tz__lbl', x: AX + AW, y: AY + 20, 'text-anchor': 'end' }, '2025'));
    var x1940 = AX + (1940 - Y0) / (Y1 - Y0) * AW;
    var bracket = s('g', { class: 'hx-tz__bracket' },
      s('path', { d: 'M' + x1940 + ' ' + (AY + 27) + 'v5H' + (AX + AW) + 'v-5' }),
      s('text', { x: x1940 - 8, y: AY + 34, 'text-anchor': 'end' }, 'since 1940'));
    gA.appendChild(bracket);
    [[-300, 'start'], [1700, ''], [1937, 'middle'], [1960, 'middle'], [1990, 'middle'], [2025, 'end']].forEach(function (t) {
      var x = AX + uOf(t[0]) * AW;
      gB.appendChild(s('line', { class: 'hx-tz__tick', x1: x, x2: x, y1: AY, y2: AY + 5 }));
      if (t[1]) gB.appendChild(s('text', { class: 'hx-tz__lbl', x: t[0] < 0 ? AX : x, y: AY + 20, 'text-anchor': t[1] }, yearText(t[0])));
    });
    var gDots = s('g', { class: 'hx-tz__dots' });
    svg.append(play, axis, gA, gB, gDots, yearEl, subEl);
    var cap = h('p', { class: 'hx-tz__cap' }, '');
    VDSA.clear(stage);
    stage.append(svg, cap);

    // Two layouts: true time (linear) and the stretched scale the timeline uses. Dots stack into columns.
    // A full column spills into its nearest neighbour with room, so the pile grows wider, never off the top.
    var MAX_ROWS = Math.floor((AY - 6 - 104) / D) + 1, LAST_COL = Math.floor(AW / D);
    function stack(xOf) {
      var cols = {};
      return EVENTS.map(function (ev) {
        var want = VDSA.clamp(Math.round((xOf(ev) - AX) / D), 0, LAST_COL), col = want;
        for (var step = 0; step < 80; step++) {
          var c = want + (step % 2 ? -1 : 1) * Math.ceil(step / 2);
          if (c < 0 || c > LAST_COL) continue;
          if ((cols[c] || 0) < MAX_ROWS) { col = c; break; }
        }
        var n = cols[col] = (cols[col] || 0) + 1;
        return { x: AX + col * D, y: AY - 6 - (n - 1) * D };
      });
    }
    var lin = stack(function (ev) { return AX + (ev.data.year + 0.5 - Y0) / (Y1 - Y0) * AW; });
    var pw = stack(function (ev) { return AX + ev.u * AW; });
    var dots = EVENTS.map(function (ev, i) {
      var c = s('circle', { class: 'hx-tz__dot', 'data-tag': ev.tag, r: RD, cx: lin[i].x, cy: lin[i].y });
      gDots.appendChild(c);
      return c;
    });
    var late = EVENTS.filter(function (ev) { return ev.data.year >= 1940; }).length;
    var inTen = Math.round(late / EVENTS.length * 10);
    var lastPct = Math.round((2025 - 1940) / (2025 + 300) * 100);
    var CAP0 = 'Every algorithm on this page, placed on a true time scale.';
    var CAP1 = inTen + ' in 10 of them crowd into the last ' + lastPct + '% of the line, after 1940.';
    var CAP2 = 'Stretch the crowded decades and each one has room. That is the timeline below.';

    var T_RESET = 700, T_SWEEP = 5200, T_HOLD = 2600, T_MORPH = 1500, T_REST = 3400, T_FADE = 700;
    var T_END = T_RESET + T_SWEEP + T_HOLD + T_MORPH + T_REST + T_FADE;
    var start = 0, raf = 0, running = false, visible = false, lastCap = '';

    function setCap(t) { if (t !== lastCap) { cap.textContent = t; lastCap = t; } }
    function yearAt(p) { return Y0 + 20 + p * (2025 - (Y0 + 20)); }
    function draw(t) {
      var sweepP = VDSA.clamp((t - T_RESET) / T_SWEEP, 0, 1);
      var tMorph = t - (T_RESET + T_SWEEP + T_HOLD);
      var morphP = VDSA.clamp(tMorph / T_MORPH, 0, 1);
      var fading = t > T_END - T_FADE;
      var yNow = yearAt(sweepP);
      var litCount = 0;
      EVENTS.forEach(function (ev, i) {
        var c = dots[i];
        var local = VDSA.clamp((tMorph - i * 3) / (T_MORPH - 360), 0, 1);
        var e = VDSA.ease.inOut(local);
        c.setAttribute('cx', VDSA.lerp(lin[i].x, pw[i].x, e).toFixed(1));
        c.setAttribute('cy', VDSA.lerp(lin[i].y, pw[i].y, e).toFixed(1));
        var lit = !fading && sweepP > 0 && ev.data.year <= yNow;
        if (lit) litCount++;
        c.classList.toggle('is-lit', lit);
      });
      var shown = sweepP < 1 ? Math.round(yNow) : 2025;
      yearEl.textContent = yearText(shown === 0 ? 1 : shown);
      subEl.textContent = litCount + ' of ' + EVENTS.length + ' discoveries';
      var hx = AX + (yNow - Y0) / (Y1 - Y0) * AW;
      play.setAttribute('x1', hx.toFixed(1)); play.setAttribute('x2', hx.toFixed(1));
      play.style.opacity = sweepP > 0 && sweepP < 1 ? '1' : '0';
      gA.style.opacity = String(1 - morphP);
      gB.style.opacity = String(morphP);
      bracket.style.opacity = sweepP >= 1 ? String(Math.max(0, 1 - morphP * 2)) : '0';
      setCap(morphP > 0.25 ? CAP2 : sweepP >= 1 ? CAP1 : CAP0);
    }
    function loop(now) {
      raf = 0;
      if (!running) return;
      if (!start) start = now;
      var t = (now - start) % T_END;
      draw(t);
      raf = win.requestAnimationFrame(loop);
    }
    function staticFrame() { draw(T_RESET + T_SWEEP + T_HOLD + T_MORPH + 10); }
    function update() {
      var should = visible && !doc.hidden && !reduced();
      if (should && !running) { running = true; start = 0; raf = win.requestAnimationFrame(loop); }
      else if (!should && running) { running = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; if (reduced()) staticFrame(); }
    }
    staticFrame();
    VDSA.onVisible(stage, function (v) { visible = v; update(); }, { threshold: 0.25 });
    doc.addEventListener('visibilitychange', update);
  }

  /* ================================================================ 10. Views and boot */
  var mq = win.matchMedia ? win.matchMedia('(max-width: 700px)') : { matches: false, addEventListener: function () {} };
  function setView(v, fromUser) {
    if (fromUser) state.userView = v;
    if (mq.matches) v = 'list';
    var changed = v !== state.view;
    state.view = v;
    fig.classList.toggle('is-list', v === 'list');
    $('[data-stage]', fig).hidden = v === 'list';
    $('[data-nav]', fig).hidden = v === 'list';
    detailEl.hidden = v === 'list';
    $('[data-list]', fig).hidden = v !== 'list';
    $$('[data-viewseg] .seg__btn', fig).forEach(function (b) {
      b.setAttribute('aria-checked', b.dataset.view === v ? 'true' : 'false');
      b.tabIndex = b.dataset.view === v ? 0 : -1;
    });
    if (v === 'timeline') {
      TL.resize();
      if (state.selected) { TL.markSelected(state.selected, {}); DETAIL.render(state.selected); win.requestAnimationFrame(function () { TL.ensureVisible(state.selected, 0); }); }
    } else if (state.selected && changed) LIST.open(state.selected, { scroll: false });
  }

  function readDeepLink() {
    var raw = (location.search || '').replace(/^\?/, '') + '&' + (location.hash || '').replace(/^#/, ''); // the hash wins
    var params = {};
    raw.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    return params;
  }

  function boot() {
    fig = $('#tl-fig');
    if (!fig) return;
    $$('[data-hero-stat="events"]').forEach(function (el) { el.textContent = plural(EVENTS.length, 'event'); });
    $$('[data-hero-stat="people"]').forEach(function (el) { el.textContent = plural(PEOPLE.length, 'person', 'people'); });
    buildFilters();
    DETAIL.build($('[data-detail]', fig));
    TL.build($('[data-stage]', fig));
    LIST.build($('[data-list]', fig));
    GALLERY.build();
    buildDyk();
    buildTeaser($('#teaser'));

    playBtn = $('[data-play]', fig);
    playLabel = $('[data-play-label]', playBtn);
    playPos = $('[data-play-pos]', playBtn);
    playBtn.addEventListener('click', togglePlay);
    $$('[data-hero-play]').forEach(function (b) { b.addEventListener('click', function () { if (!PLAY.on) playStart(true); }); });
    fig.addEventListener('keydown', function (e) {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && !e.target.closest('.hx-svg')) { togglePlay(); e.preventDefault(); }
    });

    $$('[data-viewseg] .seg__btn', fig).forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view, true); }); });
    segKeys($('[data-viewseg]', fig));
    if (mq.addEventListener) mq.addEventListener('change', function () { setView(state.userView); });
    else if (mq.addListener) mq.addListener(function () { setView(state.userView); });

    applyFilters();
    setView(mq.matches ? 'list' : 'timeline');

    var link = readDeepLink();
    if (link.person && personById[link.person]) { choosePerson(link.person, { scroll: false }); scrollToFig(); }
    else if (link.lesson && lessonById(link.lesson)) { setFilter({ lesson: link.lesson }, { fit: true }); var first = matchingEvents()[0]; if (first) select(first, { source: 'init' }); scrollToFig(); }
    if (link.event && eventById[link.event]) {
      var ev = eventById[link.event];
      if (!ev.match) clearFilters();
      select(ev, { source: 'init' });
      if (state.view === 'timeline') win.requestAnimationFrame(function () { TL.flyTo(ev, 0); });
      else LIST.open(ev, { scroll: false });
      scrollToFig();
    }
  }
  win.addEventListener('hashchange', function () { // links inside the page, or edits to the address bar
    var link = readDeepLink();
    if (link.person && personById[link.person]) choosePerson(link.person, { scroll: true });
    else if (link.lesson && lessonById(link.lesson)) { setFilter({ lesson: link.lesson }, { fit: true }); scrollToFig(); }
    else if (link.event && eventById[link.event] && eventById[link.event] !== state.selected) showOnTimeline(eventById[link.event]);
  });
  function scrollToFig() {
    win.requestAnimationFrame(function () { win.scrollTo({ top: win.scrollY + fig.getBoundingClientRect().top - 64, behavior: 'auto' }); });
  }

  VDSA.ready(boot);
}());
