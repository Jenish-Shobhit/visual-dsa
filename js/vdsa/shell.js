/* Visual DSA shell: the page chrome shared by every page.
   Load after core.js (and js/curriculum.js). Opt in with attributes on <body>:

     <body data-page="lesson" data-lesson="06-arrays">     lesson page (TOC, pager, complete button)
     <body data-page="home|lab|study">                     other pages (header, drawer, footer)

   Optional body attributes
     data-root="../"          override the site root (normally derived from this script's own src)
     data-preview-as="06-…"   use another lesson's chrome without recording progress (the template uses it)
     data-footer="false"      skip the site footer

   Exposes
     VDSA.root, VDSA.url(path)                    absolute URL of the site root / of a root-relative path
     VDSA.progress.get/markVisited/markComplete/isComplete/isVisited/onChange/reset
     VDSA.shell.openContents/closeContents/showShortcuts/lesson/unit
*/
(function (win) {
  'use strict';
  if (!win || !win.document) return;
  var VDSA = win.VDSA = win.VDSA || {};
  var doc = win.document;
  var script = doc.currentScript;

  /* ---------------------------------------------------------------- root + urls */
  function computeRoot() {
    var body = doc.body;
    var override = body && body.getAttribute('data-root');
    if (override !== null && override !== undefined && override !== '') return new URL(override, doc.baseURI).href;
    var src = script && script.src;
    if (!src) {
      var tag = doc.querySelector('script[src*="js/vdsa/shell.js"]') || doc.querySelector('script[src*="js/vdsa/core.js"]');
      src = tag && tag.src;
    }
    if (src) return new URL('../../', src).href;
    return new URL('./', doc.baseURI).href;
  }
  VDSA.root = computeRoot();
  VDSA.url = function (path) { return new URL(path || '', VDSA.root).href; };

  /* ---------------------------------------------------------------- progress */
  var PKEY = 'vdsa-progress';
  var memory = null; // in-memory fallback when storage is unavailable
  var progressListeners = [];
  function blank() { return { visited: [], completed: [], last: null }; }
  function sanitize(p) {
    if (!p || typeof p !== 'object') return blank();
    return {
      visited: Array.isArray(p.visited) ? p.visited.filter(function (x) { return typeof x === 'string'; }) : [],
      completed: Array.isArray(p.completed) ? p.completed.filter(function (x) { return typeof x === 'string'; }) : [],
      last: typeof p.last === 'string' ? p.last : null
    };
  }
  function readProgress() {
    try { var raw = win.localStorage.getItem(PKEY); if (raw) { memory = sanitize(JSON.parse(raw)); return memory; } } catch (_) {}
    return memory ? sanitize(memory) : blank();
  }
  function writeProgress(p) {
    memory = p;
    try { win.localStorage.setItem(PKEY, JSON.stringify(p)); } catch (_) {}
    progressListeners.forEach(function (fn) { try { fn(sanitize(p)); } catch (e) { console.error(e); } });
  }
  VDSA.progress = {
    get: function () { return readProgress(); },
    markVisited: function (id) {
      if (!id) return;
      var p = readProgress();
      if (p.visited.indexOf(id) === -1) p.visited.push(id);
      p.last = id;
      writeProgress(p);
    },
    markComplete: function (id, done) {
      if (!id) return;
      var p = readProgress();
      var i = p.completed.indexOf(id);
      if (done === false) { if (i !== -1) p.completed.splice(i, 1); }
      else if (i === -1) p.completed.push(id);
      if (p.visited.indexOf(id) === -1) p.visited.push(id);
      writeProgress(p);
    },
    isComplete: function (id) { return readProgress().completed.indexOf(id) !== -1; },
    isVisited: function (id) { return readProgress().visited.indexOf(id) !== -1; },
    onChange: function (fn) { progressListeners.push(fn); return function () { progressListeners = progressListeners.filter(function (f) { return f !== fn; }); }; },
    reset: function () { writeProgress(blank()); }
  };
  win.addEventListener('storage', function (e) {
    if (e.key !== PKEY) return;
    var p = readProgress();
    progressListeners.forEach(function (fn) { try { fn(p); } catch (err) { console.error(err); } });
  });

  /* ---------------------------------------------------------------- helpers */
  var h = VDSA.h, s = VDSA.s;
  function svgIcon(paths, cls) {
    var el = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: cls || null });
    el.innerHTML = paths;
    return el;
  }
  var ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    toc: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    collapse: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15.5 10 13.5 12l2 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
  };
  function ico(name) { return h('i', { class: 'ico', 'data-ico': name, 'aria-hidden': 'true' }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function slugify(text) {
    return String(text).toLowerCase().replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
  }
  function isTyping(el) {
    if (!el || el === doc.body) return false;
    var tag = el.tagName;
    if (el.isContentEditable) return true;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') { var t = (el.type || 'text').toLowerCase(); return ['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].indexOf(t) === -1; }
    return false;
  }
  VDSA.isTyping = isTyping;

  /* ---------------------------------------------------------------- page context */
  var C = win.VDSA_CURRICULUM || null;
  var body = doc.body;
  var page = body.getAttribute('data-page') || 'page';
  var lessonId = body.getAttribute('data-lesson') || null;
  var lesson = C && lessonId ? C.byId(lessonId) : null;
  var previewing = false;
  if (!lesson && C && body.getAttribute('data-preview-as')) { lesson = C.byId(body.getAttribute('data-preview-as')); previewing = !!lesson; }
  var unit = lesson && C ? C.unitOf(lesson) : null;
  if (unit && !body.hasAttribute('data-unit')) body.setAttribute('data-unit', unit.id);
  function isLive(l) { return !!l && (l.status === 'live' || l === lesson); }

  /* ---------------------------------------------------------------- header */
  function brandMark() {
    var svg = s('svg', { class: 'brand__mark', viewBox: '0 0 28 28', 'aria-hidden': 'true', focusable: 'false' },
      s('rect', { class: 'bm-bg', x: 0, y: 0, width: 28, height: 28, rx: 8 }),
      s('rect', { class: 'bm-bar', x: 6.5, y: 15, width: 4, height: 7, rx: 1.5 }),
      s('rect', { class: 'bm-bar', x: 12, y: 11, width: 4, height: 11, rx: 1.5 }),
      s('rect', { class: 'bm-hi', x: 17.5, y: 6, width: 4, height: 16, rx: 1.5 })
    );
    return svg;
  }

  var header, progressBar, themeBtn, contentsBtn, drawer, modal;
  function buildHeader() {
    var crumbs = null;
    if (lesson && unit) {
      crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
        h('a', { class: 'crumbs__unit', href: VDSA.url('index.html#' + unit.id) }, unit.title),
        h('span', { class: 'crumbs__sep', 'aria-hidden': 'true' }, '/'),
        h('span', { class: 'crumbs__here', 'aria-current': 'page' }, 'Lesson ' + lesson.number)
      );
    } else if (page !== 'home') {
      var label = body.getAttribute('data-crumb') || { lab: 'Labs', study: 'Deep studies' }[page] || '';
      if (label) crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('span', { class: 'crumbs__here' }, label));
    }
    themeBtn = h('button', { type: 'button', class: 'hbtn hbtn--icon theme-btn', onclick: function () { VDSA.theme.toggle(); } },
      svgIcon(ICONS.moon, 'i-moon'), svgIcon(ICONS.sun, 'i-sun'));
    contentsBtn = h('button', { type: 'button', class: 'hbtn hbtn--outline contents-btn', 'aria-haspopup': 'dialog', 'aria-controls': 'vdsa-contents', onclick: openContents },
      svgIcon(ICONS.menu), h('span', { class: 'hbtn__label' }, 'Contents'));
    progressBar = h('div', { class: 'read-progress', 'aria-hidden': 'true' });
    header = h('header', { class: 'site-header', role: 'banner' },
      h('div', { class: 'site-header__inner' },
        h('a', { class: 'brand', href: VDSA.url('index.html'), 'aria-label': 'Visual DSA home' }, brandMark(), h('span', { class: 'brand__name' }, 'Visual DSA')),
        crumbs,
        h('div', { class: 'site-header__actions' },
          h('a', { class: 'hbtn hbtn--labs', href: VDSA.url('index.html#labs') }, svgIcon(ICONS.flask), h('span', { class: 'hbtn__label' }, 'Labs')),
          themeBtn,
          contentsBtn
        )
      ),
      progressBar
    );
    syncTheme();
    VDSA.theme.onChange(syncTheme);
    var main = doc.querySelector('main');
    if (main && !main.id) main.id = 'main';
    var skip = h('a', { class: 'skip-link', href: '#' + (main ? main.id : 'main') }, 'Skip to content');
    body.insertBefore(header, body.firstChild);
    body.insertBefore(skip, header);
  }
  function syncTheme() {
    if (!themeBtn) return;
    var mode = VDSA.theme.get();
    themeBtn.setAttribute('data-mode', mode);
    themeBtn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeBtn.title = themeBtn.getAttribute('aria-label');
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', VDSA.cssVar('--bg') || (mode === 'dark' ? '#0e1016' : '#fbfaf7'));
  }

  /* ---------------------------------------------------------------- dialogs */
  function openDialog(d) {
    if (!d) return;
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); }
    else d.setAttribute('open', '');
  }
  function closeDialog(d) {
    if (!d || !d.open) return;
    if (VDSA.reducedMotion() || !d.classList.contains('drawer')) { d.close ? d.close() : d.removeAttribute('open'); return; }
    d.classList.add('is-closing');
    var done = false;
    function finish() { if (done) return; done = true; d.classList.remove('is-closing'); if (d.close) d.close(); else d.removeAttribute('open'); }
    d.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 260);
  }
  function wireDialog(d) {
    d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });
    d.addEventListener('cancel', function (e) { if (d.classList.contains('drawer') && !VDSA.reducedMotion()) { e.preventDefault(); closeDialog(d); } });
  }

  /* ---------------------------------------------------------------- contents drawer */
  function buildDrawer() {
    drawer = h('dialog', { class: 'drawer', id: 'vdsa-contents', 'aria-labelledby': 'vdsa-contents-title' });
    wireDialog(drawer);
    drawer.addEventListener('close', function () { if (contentsBtn) contentsBtn.focus({ preventScroll: true }); });
    body.appendChild(drawer);
  }
  function renderDrawer() {
    VDSA.clear(drawer);
    var p = VDSA.progress.get();
    var bodyEl = h('div', { class: 'drawer__body' });
    drawer.appendChild(h('div', { class: 'drawer__head' },
      h('h2', { class: 'drawer__title', id: 'vdsa-contents-title' }, 'Contents'),
      h('button', { type: 'button', class: 'hbtn hbtn--icon', 'aria-label': 'Close contents', onclick: closeContents }, svgIcon(ICONS.close))
    ));
    drawer.appendChild(bodyEl);

    if (C) {
      var total = C.lessons.length;
      var done = C.lessons.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
      bodyEl.appendChild(h('div', { class: 'drawer__progress' },
        h('div', { class: 'drawer__progress-top' }, h('span', null, 'Your progress'), h('span', null, h('strong', null, String(done)), ' / ' + total + ' lessons')),
        h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done, 'aria-label': done + ' of ' + total + ' lessons complete' },
          h('i', { style: { '--p': (total ? (100 * done / total) : 0) + '%' } }))
      ));
    }

    // On this page (lesson TOC) — the only TOC on narrow screens
    if (tocItems.length) {
      var list = h('ul', { class: 'drawer-toc' });
      tocItems.forEach(function (it) {
        list.appendChild(h('li', null, h('a', { href: '#' + it.id, class: it.id === activeTocId ? 'is-active' : null, onclick: function () { closeContents(); } }, it.label)));
      });
      bodyEl.appendChild(h('section', { class: 'drawer__section drawer__section--toc' },
        h('h3', { class: 'drawer__label' }, 'On this page ', h('span', { class: 'score-chip', 'data-quiz-score': '', hidden: true, style: { marginLeft: '6px', height: '22px', fontSize: '12px' } })), list));
    }

    if (C) {
      var course = h('section', { class: 'drawer__section' }, h('h3', { class: 'drawer__label' }, 'The course'));
      C.units.forEach(function (u) {
        var ls = C.lessonsIn(u.id);
        var doneIn = ls.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
        var ul = h('ul', { class: 'course-list' });
        ls.forEach(function (l) {
          var complete = p.completed.indexOf(l.id) !== -1;
          var visited = p.visited.indexOf(l.id) !== -1;
          var current = lesson && l.id === lesson.id;
          var live = isLive(l);
          var status = h('span', { class: 'course-link__status' });
          if (complete) { status.appendChild(h('span', { class: 'sr-only' }, 'Completed')); status.appendChild(ico('check')); }
          else if (!live) status.appendChild(h('span', { class: 'soon' }, 'Soon'));
          else if (visited) status.appendChild(h('span', { class: 'sr-only' }, 'Visited'));
          var cls = 'course-link' + (complete ? ' is-complete' : visited && !complete ? ' is-visited' : '') + (live ? '' : ' is-planned');
          var inner = [h('span', { class: 'course-link__num' }, pad2(l.number)), h('span', { class: 'course-link__title' }, l.title), status];
          var row = live
            ? h('a', { class: cls, href: VDSA.url(l.href), 'aria-current': current ? 'page' : null, title: l.subtitle }, inner)
            : h('span', { class: cls, 'aria-disabled': 'true', title: 'Coming soon: ' + l.subtitle }, inner);
          ul.appendChild(h('li', null, row));
        });
        course.appendChild(h('div', { class: 'course-unit', 'data-unit': u.id },
          h('div', { class: 'course-unit__head' },
            h('span', { class: 'course-unit__num', 'aria-hidden': 'true' }, String(u.number)),
            h('span', { class: 'course-unit__title' }, u.title),
            h('span', { class: 'course-unit__count', 'aria-label': doneIn + ' of ' + ls.length + ' complete' }, doneIn + '/' + ls.length)
          ), ul));
      });
      bodyEl.appendChild(course);

      if (C.labs && C.labs.length) {
        var labs = h('ul', { class: 'drawer-labs' });
        C.labs.forEach(function (lab) { labs.appendChild(h('li', null, h('a', { href: VDSA.url(lab.href) }, lab.title, h('small', null, lab.blurb)))); });
        bodyEl.appendChild(h('section', { class: 'drawer__section' }, h('h3', { class: 'drawer__label' }, 'Labs'), labs));
      }
    } else {
      bodyEl.appendChild(h('p', { class: 'muted', style: { padding: '16px 10px' } }, 'The course list could not be loaded on this page.'));
    }

    /* Always present, even without curriculum data: the places that are not lessons. Paths come from VDSA.url, so they resolve from any depth. */
    var more = h('ul', { class: 'drawer-labs drawer-more' });
    [['labs', 'All labs', 'index.html#labs', 'Open playgrounds for your own input.'],
     ['studies', 'Deep studies', 'studies/index.html', 'Long-form lecture notes with proofs and problem sets.'],
     ['history', 'History', 'labs/history.html', 'An interactive timeline of algorithms and their people.']
    ].forEach(function (m) { more.appendChild(h('li', null, h('a', { href: VDSA.url(m[2]) }, m[1], h('small', null, m[3])))); });
    bodyEl.appendChild(h('section', { class: 'drawer__section drawer__section--more' }, h('h3', { class: 'drawer__label' }, 'Explore more'), more));

    drawer.appendChild(h('div', { class: 'drawer__foot' },
      h('button', { type: 'button', onclick: function () { closeContents(); setTimeout(showShortcuts, 50); } }, svgIcon(ICONS.keyboard), 'Keyboard shortcuts ', h('kbd', null, '?')),
      h('a', { href: VDSA.url('about.html'), style: { color: 'inherit' } }, 'About')
    ));
    return bodyEl;
  }
  function openContents() {
    if (!drawer) return;
    var bodyEl = renderDrawer();
    openDialog(drawer);
    // Show the current lesson in view, unless the "On this page" list is visible at the top (phones, tablets).
    var toc = drawer.querySelector('.drawer__section--toc');
    var cur = drawer.querySelector('[aria-current="page"]');
    if (cur && !(toc && toc.offsetParent)) bodyEl.scrollTop = Math.max(0, cur.offsetTop - bodyEl.clientHeight / 2);
    if (VDSA.quizScore) VDSA.quizScore.refresh();
    var focusEl = drawer.querySelector('.drawer__head button');
    if (focusEl) focusEl.focus({ preventScroll: true });
  }
  function closeContents() { closeDialog(drawer); }

  /* ---------------------------------------------------------------- shortcuts modal */
  function showShortcuts() {
    if (!modal) {
      modal = h('dialog', { class: 'modal', 'aria-labelledby': 'vdsa-keys-title' });
      wireDialog(modal);
      body.appendChild(modal);
    }
    VDSA.clear(modal);
    function rows(list) {
      var dl = h('dl', { class: 'shortcut-list' });
      list.forEach(function (r) {
        dl.appendChild(h('dt', null, r[0].map(function (k, i) { return [i ? ' ' : null, h('kbd', null, k)]; })));
        dl.appendChild(h('dd', null, r[1]));
      });
      return dl;
    }
    modal.appendChild(h('div', { class: 'modal__head' },
      h('h2', { id: 'vdsa-keys-title' }, 'Keyboard shortcuts'),
      h('button', { type: 'button', class: 'hbtn hbtn--icon', 'aria-label': 'Close', onclick: function () { closeDialog(modal); } }, svgIcon(ICONS.close))));
    modal.appendChild(h('div', { class: 'modal__body' },
      h('div', { class: 'shortcut-group' }, h('h3', null, 'Figures with a player'),
        h('p', { class: 'muted', style: { fontSize: '13.5px', margin: '0 0 8px' } }, 'Work on the figure you last clicked or focused.'),
        rows([
          [['←', '→'], 'Step back / step forward'],
          [['Space'], 'Play or pause (also K)'],
          [['Home', 'End'], 'Jump to the first / last step'],
          [['+', '−'], 'Faster / slower'],
          [['R'], 'Restart from the first step']
        ])),
      h('div', { class: 'shortcut-group' }, h('h3', null, 'Anywhere'),
        rows([
          [['?'], 'Show this list'],
          [['Esc'], 'Close a panel'],
          [['T'], 'Switch light / dark theme'],
          [['['], 'Show or hide the “On this page” sidebar (lessons)']
        ]))
    ));
    openDialog(modal);
  }

  /* ---------------------------------------------------------------- lesson: fills, TOC, anchors */
  var tocItems = [], activeTocId = null, tocLinks = {};
  function fillFromCurriculum() {
    if (!lesson) return;
    var map = {
      number: pad2(lesson.number),
      'lesson-number': 'Lesson ' + pad2(lesson.number),
      unit: unit ? unit.title : '',
      'unit-number': unit ? 'Unit ' + unit.number : '',
      title: lesson.title,
      subtitle: lesson.subtitle,
      minutes: lesson.minutes + ' min'
    };
    VDSA.$$('[data-fill]').forEach(function (el) {
      var key = el.getAttribute('data-fill');
      if (el.textContent.trim() === '' && map[key] !== undefined) el.textContent = map[key];
    });
    if (!doc.title || doc.title === 'Lesson') doc.title = lesson.title + ' · Visual DSA';
  }
  function buildToc(main) {
    var bodyEl = main.querySelector('.lesson-body') || main;
    var used = {};
    VDSA.$$('[id]').forEach(function (el) { used[el.id] = true; });
    VDSA.$$('h2', bodyEl).forEach(function (hd) {
      if (hd.closest('.fig, .quiz, .summary, .callout, .history, .complete-card, [data-toc="false"]') || hd.getAttribute('data-toc') === 'false') return;
      if (!hd.id) {
        var base = slugify(hd.textContent), id = base, k = 2;
        while (used[id]) id = base + '-' + (k++);
        hd.id = id; used[id] = true;
      }
      tocItems.push({ id: hd.id, el: hd, label: hd.getAttribute('data-toc') || hd.textContent.trim() });
    });
    // Anchors on h2/h3 with ids
    VDSA.$$('h2[id], h3[id]', bodyEl).forEach(function (hd) {
      if (hd.querySelector('.anchor') || hd.closest('.fig, .quiz, .summary, .callout')) return;
      hd.appendChild(h('a', { class: 'anchor', href: '#' + hd.id, 'aria-label': 'Link to “' + hd.textContent.trim() + '”' }, '#'));
    });
    if (!tocItems.length) return;
    var list = h('ol', { class: 'toc__list' });
    tocItems.forEach(function (it) {
      var a = h('a', { class: 'toc__link', href: '#' + it.id }, it.label);
      tocLinks[it.id] = a;
      list.appendChild(h('li', null, a));
    });
    buildTocSidebar(main, list);
  }

  /* The "On this page" sidebar. Wide screens (>= 1280px): docked beside the lesson and
     collapsible to a slim strip; the choice is remembered in localStorage (vdsa-toc).
     Narrower screens: a panel that slides in from the left, opened by a floating button.
     `[` toggles it anywhere; Esc, the backdrop or following a link closes the panel. */
  var tocUI = null;
  function buildTocSidebar(main, list) {
    var wideQuery = win.matchMedia ? win.matchMedia('(min-width: 1280px)') : { matches: true };
    var closeBtn = h('button', { type: 'button', class: 'hbtn hbtn--icon toc__close', 'aria-controls': 'vdsa-toc' }, svgIcon(ICONS.collapse));
    var openBtn = h('button', { type: 'button', class: 'toc__open', 'aria-controls': 'vdsa-toc', 'aria-label': 'Show “On this page”', title: 'Show “On this page”  [' }, svgIcon(ICONS.toc));
    var aside = h('aside', { class: 'toc', id: 'vdsa-toc', 'aria-label': 'On this page' },
      openBtn,
      h('div', { class: 'toc__head' }, h('p', { class: 'toc__title' }, 'On this page'), closeBtn),
      h('div', { class: 'toc__panel' }, list,
        h('div', { class: 'toc__mini' }, h('span', { class: 'score-chip', 'data-quiz-score': '', hidden: true }))));
    var fab = h('button', { type: 'button', class: 'toc-fab', 'aria-controls': 'vdsa-toc', 'aria-expanded': 'false', title: 'On this page  [' },
      svgIcon(ICONS.toc), h('span', { class: 'toc-fab__label' }, 'On this page'));
    var backdrop = h('div', { class: 'toc-backdrop', 'aria-hidden': 'true' });
    main.insertBefore(aside, main.firstChild);
    main.classList.add('has-toc');
    body.appendChild(backdrop);
    body.appendChild(fab);

    function wide() { return !!wideQuery.matches; }
    function collapsed() { return main.classList.contains('toc-collapsed'); }
    function panelOpen() { return body.classList.contains('toc-open'); }
    function sync() {
      var visible = wide() ? !collapsed() : panelOpen();
      [openBtn, fab].forEach(function (b) { b.setAttribute('aria-expanded', String(visible)); });
      closeBtn.setAttribute('aria-expanded', String(visible));
      closeBtn.setAttribute('aria-label', wide() ? 'Hide the “On this page” sidebar' : 'Close “On this page”');
      closeBtn.title = wide() ? 'Hide sidebar  [' : 'Close  Esc';
      var mode = wide() ? 'collapse' : 'close';
      if (closeBtn.getAttribute('data-icon') !== mode) { VDSA.clear(closeBtn).appendChild(svgIcon(ICONS[mode])); closeBtn.setAttribute('data-icon', mode); }
    }
    function setCollapsed(c) {
      main.classList.toggle('toc-collapsed', c);
      try { localStorage.setItem('vdsa-toc', c ? 'closed' : 'open'); } catch (_) {}
      sync();
      // Figures re-measure on resize; nudge them once the column has finished moving.
      win.setTimeout(function () { win.dispatchEvent(new Event('resize')); }, 650);
      (c ? openBtn : closeBtn).focus({ preventScroll: true });
    }
    function openPanel() {
      body.classList.add('toc-open');
      sync();
      var cur = aside.querySelector('.toc__link.is-active');
      if (cur) aside.scrollTop = Math.max(0, cur.offsetTop - aside.clientHeight / 2);
      closeBtn.focus({ preventScroll: true });
    }
    function closePanel(returnFocus) {
      if (!panelOpen()) return;
      body.classList.remove('toc-open');
      sync();
      if (returnFocus) fab.focus({ preventScroll: true });
    }
    function toggle() {
      if (wide()) setCollapsed(!collapsed());
      else if (panelOpen()) closePanel(true);
      else openPanel();
    }
    closeBtn.addEventListener('click', function () { if (wide()) setCollapsed(true); else closePanel(true); });
    openBtn.addEventListener('click', function () { setCollapsed(false); });
    fab.addEventListener('click', openPanel);
    backdrop.addEventListener('click', function () { closePanel(false); });
    list.addEventListener('click', function (e) { if (e.target.closest('a') && !wide()) closePanel(false); });
    aside.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen()) { e.stopPropagation(); closePanel(true); } });
    var onChange = function () { body.classList.remove('toc-open'); sync(); };
    if (wideQuery.addEventListener) wideQuery.addEventListener('change', onChange); else if (wideQuery.addListener) wideQuery.addListener(onChange);

    // Restore the remembered wide-screen state without animating on first paint.
    var saved = null;
    try { saved = localStorage.getItem('vdsa-toc'); } catch (_) {}
    if (saved === 'closed') {
      main.classList.add('toc-instant', 'toc-collapsed');
      win.requestAnimationFrame(function () { win.requestAnimationFrame(function () { main.classList.remove('toc-instant'); }); });
    }
    sync();
    tocUI = { toggle: toggle, open: function () { if (wide()) setCollapsed(false); else openPanel(); }, close: function () { if (wide()) setCollapsed(true); else closePanel(false); } };
    VDSA.shell.toc = tocUI;
  }
  function setActiveToc(id) {
    if (id === activeTocId) return;
    if (activeTocId && tocLinks[activeTocId]) { tocLinks[activeTocId].classList.remove('is-active'); tocLinks[activeTocId].removeAttribute('aria-current'); }
    activeTocId = id;
    if (id && tocLinks[id]) { tocLinks[id].classList.add('is-active'); tocLinks[id].setAttribute('aria-current', 'true'); }
  }

  /* ---------------------------------------------------------------- lesson end: complete + pager */
  function buildLessonEnd(main) {
    if (!lesson || !C) return;
    var idx = C.lessons.indexOf(lesson);
    var prev = C.lessons[idx - 1] || null, next = C.lessons[idx + 1] || null;
    var btn = h('button', { type: 'button', class: 'complete-btn', 'aria-pressed': 'false' },
      h('span', { class: 'complete-btn__box', 'aria-hidden': 'true' }, ico('check')),
      h('span', { class: 'complete-btn__label' }, 'Mark lesson complete'));
    function syncBtn() {
      var done = !previewing && VDSA.progress.isComplete(lesson.id);
      btn.setAttribute('aria-pressed', done ? 'true' : 'false');
      btn.querySelector('.complete-btn__label').textContent = done ? 'Lesson complete' : 'Mark lesson complete';
    }
    btn.addEventListener('click', function () {
      if (previewing) { btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); btn.querySelector('.complete-btn__label').textContent = btn.getAttribute('aria-pressed') === 'true' ? 'Lesson complete' : 'Mark lesson complete'; return; }
      VDSA.progress.markComplete(lesson.id, !VDSA.progress.isComplete(lesson.id));
    });
    VDSA.progress.onChange(syncBtn);
    syncBtn();

    function card(l, dir) {
      if (!l) return h('div', { class: 'pager__card is-empty', 'aria-hidden': 'true' });
      var live = isLive(l);
      var inner = [
        h('span', { class: 'pager__dir' }, dir === 'prev' ? [ico('arrow-left'), 'Previous'] : ['Next', ico('arrow')]),
        h('span', { class: 'pager__title' }, h('span', null, pad2(l.number)), l.title),
        live ? null : h('span', { class: 'soon' }, 'Coming soon')
      ];
      var cls = 'pager__card pager__card--' + dir + (live ? '' : ' is-planned');
      return live ? h('a', { class: cls, href: VDSA.url(l.href), rel: dir }, inner) : h('div', { class: cls, 'aria-disabled': 'true' }, inner);
    }
    var nextText = next ? 'Next up: ' + next.title + '.' : 'That was the last lesson of the course.';
    var end = h('footer', { class: 'lesson-end', 'aria-label': 'Lesson navigation' },
      h('div', { class: 'complete-card' },
        h('div', { class: 'complete-card__text' }, h('h2', { 'data-toc': 'false' }, 'Finished ' + lesson.title.replace(/[?.!]$/, '') + '?'), h('p', null, 'Mark it complete to track your progress. ' + nextText)),
        btn),
      h('nav', { class: 'pager', 'aria-label': 'Previous and next lesson' }, card(prev, 'prev'), card(next, 'next')));
    main.appendChild(end);
  }

  /* ---------------------------------------------------------------- misc auto-enhancements */
  var BIG_O = { '1': 'O(1)', logn: 'O(log n)', sqrtn: 'O(√n)', n: 'O(n)', nk: 'O(n + k)', nlogn: 'O(n log n)', n2: 'O(n<sup>2</sup>)', n3: 'O(n<sup>3</sup>)', '2n': 'O(2<sup>n</sup>)', nfact: 'O(n!)' };
  VDSA.bigO = BIG_O;
  function fillBigO(scope) {
    VDSA.$$('.big-o[data-o]', scope).forEach(function (el) {
      if (el.innerHTML.trim() === '' && BIG_O[el.getAttribute('data-o')]) el.innerHTML = BIG_O[el.getAttribute('data-o')];
    });
  }
  function buildFooter() {
    if (body.getAttribute('data-footer') === 'false') return;
    body.appendChild(h('footer', { class: 'site-footer' },
      h('div', { class: 'site-footer__inner' },
        h('span', null, 'Visual DSA: data structures and algorithms you can watch, step and change.'),
        h('nav', { 'aria-label': 'Site' },
          h('a', { href: VDSA.url('index.html') }, 'Home'),
          h('a', { href: VDSA.url('index.html#labs') }, 'Labs'),
          h('a', { href: VDSA.url('studies/index.html') }, 'Deep studies'),
          h('a', { href: VDSA.url('labs/history.html') }, 'History'),
          h('a', { href: VDSA.url('about.html') }, 'About'),
          h('button', { type: 'button', onclick: showShortcuts }, 'Keyboard shortcuts')))));
  }

  /* ---------------------------------------------------------------- scroll: progress bar + scroll spy */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    win.requestAnimationFrame(function () {
      ticking = false;
      var se = doc.scrollingElement || doc.documentElement;
      var max = se.scrollHeight - win.innerHeight;
      var p = max > 0 ? VDSA.clamp(se.scrollTop / max, 0, 1) : 0;
      if (progressBar) progressBar.style.setProperty('--p', p.toFixed(4));
      if (tocItems.length) {
        var line = (header ? header.offsetHeight : 56) + win.innerHeight * 0.25;
        var current = null;
        for (var i = 0; i < tocItems.length; i++) {
          if (tocItems[i].el.getBoundingClientRect().top <= line) current = tocItems[i].id; else break;
        }
        if (p > 0.995) current = tocItems[tocItems.length - 1].id;
        setActiveToc(current);
      }
    });
  }

  /* ---------------------------------------------------------------- global keys */
  doc.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.target)) return;
    if (doc.querySelector('dialog[open]')) return;
    if (e.key === '?') { e.preventDefault(); showShortcuts(); }
    else if ((e.key === 't' || e.key === 'T') && !e.shiftKey) { VDSA.theme.toggle(); }
    else if (e.key === '[' && tocUI) { e.preventDefault(); tocUI.toggle(); }
    else if (e.key === 'Escape' && tocUI && body.classList.contains('toc-open')) { tocUI.close(); }
  });

  /* ---------------------------------------------------------------- boot */
  function boot() {
    var main = doc.querySelector('main');
    buildHeader();
    buildDrawer();
    if (page === 'lesson' && main) {
      fillFromCurriculum();
      buildToc(main);
      buildLessonEnd(main);
      if (lesson && !previewing) VDSA.progress.markVisited(lesson.id);
    }
    fillBigO(doc);
    buildFooter();
    initScrollCues();
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    if (location.hash === '#contents') openContents();
  }

  /* Edge fades on horizontally scrolling wrappers (classes styled in vdsa.css next to .fig__stage--scroll). */
  var CUE_SEL = '.fig__stage--scroll, [class*="fig__stage--sc"], .table-wrap, .code-panel__body, pre.code-block, .lesson-body pre, [data-scroll-fade]';
  function initScrollCues() {
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var raf = 0;
    function update(el) {
      var max = el.scrollWidth - el.clientWidth, x = Math.abs(el.scrollLeft);
      var on = max > 2;
      el.classList.toggle('has-more-start', on && x > 2);
      el.classList.toggle('has-more-end', on && x < max - 2);
    }
    function refresh() {
      raf = 0;
      var list = doc.querySelectorAll(CUE_SEL);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.hasAttribute('data-no-scroll-fade')) continue;
        if (seen && !seen.has(el)) {
          seen.add(el);
          el.addEventListener('scroll', function () { update(this); }, { passive: true });
          if (win.ResizeObserver) new win.ResizeObserver(schedule).observe(el);
        }
        update(el);
      }
    }
    function schedule() { if (!raf) raf = win.requestAnimationFrame(refresh); }
    win.addEventListener('resize', schedule, { passive: true });
    win.addEventListener('load', schedule);
    if (win.MutationObserver && doc.body) new win.MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true });
    schedule();
  }

  VDSA.shell = {
    get lesson() { return lesson; },
    get unit() { return unit; },
    previewing: function () { return previewing; },
    openContents: openContents,
    closeContents: closeContents,
    showShortcuts: showShortcuts,
    fillBigO: fillBigO,
    icon: function (name) { return svgIcon(ICONS[name] || ''); }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
}(typeof window !== 'undefined' ? window : null));
