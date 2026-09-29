/* Developer gallery: a tiny local stepper so every renderer can be exercised without the real player.
   Demo files call Gallery.demo(sectionId, {title, note, wide, build(host, card) -> {steps, render(step, ctx), caption?(step)}}).
   ctx passed to render mirrors the player contract: {index, prev, direction, instant, duration}. */
var Gallery = (function () {
  'use strict';
  var ORDER = [
    ['array', 'Array', 'VDSA.views.array', 'Bars, boxes, dots and cells; swaps arc, pointers slide, regions resize, a held key lifts, rows exchange items.'],
    ['tree', 'Tree', 'VDSA.views.tree', 'Tidy layout for binary and n-ary trees; rotations swing, inserts grow, recursion trees show returns.'],
    ['graph', 'Graph', 'VDSA.views.graph', 'Logical coordinates, curved bidirectional edges, arrowheads, weight pills, badges, drag and editor mode.'],
    ['grid', 'Grid', 'VDSA.views.grid', 'Matrices, DP tables with dependency arrows, pathfinding grids with paint mode.'],
    ['list', 'Linked list', 'VDSA.views.list', 'Two-part nodes, arrows that re-route, pointers that slide, detached nodes.'],
    ['stack', 'Stack, queue, ring', 'VDSA.views.stack / queue / ring', 'Push drops in, pop lifts out; enqueue at rear, dequeue at front; ring buffer wrap-around.'],
    ['hash', 'Hash table', 'VDSA.views.hashtable', 'Separate chaining, open addressing with probes and tombstones, load factor, rehash.'],
    ['memory', 'Memory', 'VDSA.views.memory', 'RAM cells with addresses; stack frames and heap objects with pointer arrows.'],
    ['callstack', 'Call stack', 'VDSA.views.callstack', 'Frames push and pop for recursion, with return values.'],
    ['chart', 'Chart', 'VDSA.views.chart', 'Line (linear/log), bar and scatter charts with direct labels and a hover crosshair.'],
    ['flowchart', 'Flowchart', 'VDSA.views.flowchart', 'Grid-placed nodes, orthogonal rounded routing, a token travelling along the taken edge.']
  ];
  var demos = {};
  var players = [];
  var byId = {};
  var speed = 1;
  var pausedAll = false;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(typeof arguments[i] === 'string' ? document.createTextNode(arguments[i]) : arguments[i]);
    return el;
  }

  function demo(section, cfg) { (demos[section] = demos[section] || []).push(cfg); }

  function Player(card, cfg) {
    var host = card.querySelector('.g-fig');
    var built;
    try { built = cfg.build(host, card) || {}; }
    catch (e) { console.error('[gallery] ' + cfg.title, e); host.textContent = 'Error: ' + e.message; return; }
    var steps = built.steps || [];
    var index = 0, timer = 0, playing = cfg.autoplay !== false && steps.length > 1, visible = true, prev = null;
    var base = cfg.duration || 650, hold = cfg.hold === undefined ? 500 : cfg.hold;
    var captionEl = card.querySelector('.g-caption'), countEl = card.querySelector('.g-count'), playBtn = card.querySelector('[data-play]');

    function go(i, instant) {
      if (!steps.length) return;
      var n = steps.length;
      i = ((i % n) + n) % n;
      var direction = i >= index ? 1 : -1;
      var ctx = { index: i, prev: prev, direction: direction, instant: !!instant, duration: instant ? 0 : Math.round(base / speed) };
      index = i;
      try { built.render(steps[i], ctx); } catch (e) { console.error('[gallery] ' + cfg.title, e); }
      prev = steps[i];
      if (countEl) countEl.textContent = (i + 1) + ' / ' + n;
      if (captionEl) captionEl.textContent = (built.caption ? built.caption(steps[i], i) : steps[i] && steps[i].caption) || '';
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing || !visible || pausedAll) return;
      timer = setTimeout(function () {
        if (index === steps.length - 1) { timer = setTimeout(function () { go(0); schedule(); }, (cfg.endHold || 1400) / speed); return; }
        go(index + 1); schedule();
      }, (base + hold) / speed);
    }
    function setPlaying(p) { playing = p; if (playBtn) { playBtn.textContent = p ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(p)); } schedule(); }

    card.querySelector('[data-first]').addEventListener('click', function () { setPlaying(false); go(0); });
    card.querySelector('[data-prev]').addEventListener('click', function () { setPlaying(false); go(Math.max(0, index - 1)); });
    card.querySelector('[data-next]').addEventListener('click', function () { setPlaying(false); go(Math.min(steps.length - 1, index + 1)); });
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    if (steps.length <= 1) card.querySelector('.g-controls').style.display = built.controls === true ? '' : 'none';
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { visible = e.isIntersecting; schedule(); }); }, { threshold: 0.1 }).observe(card);
    }
    go(0, cfg.introAnimate === false);
    setPlaying(playing);
    var api = { go: go, setPlaying: setPlaying, reschedule: schedule, get index() { return index; }, built: built, steps: steps };
    if (built.ready) built.ready(api);
    return api;
  }

  function start() {
    var main = document.getElementById('gallery'), nav = document.getElementById('g-nav');
    ORDER.forEach(function (sec) {
      var list = demos[sec[0]];
      nav.appendChild(h('a', { href: '#sec-' + sec[0] }, sec[1]));
      var s = h('section', { class: 'g-section', id: 'sec-' + sec[0] },
        h('h2', null, sec[1] + ' ', h('code', null, sec[2])),
        h('p', null, sec[3]));
      var grid = h('div', { class: 'g-grid' });
      s.appendChild(grid);
      main.appendChild(s);
      if (!list || !list.length) { grid.appendChild(h('p', { class: 'g-note' }, 'No demos yet.')); return; }
      list.forEach(function (cfg) {
        var card = h('article', { class: 'g-card' + (cfg.wide ? ' is-wide' : ''), 'data-demo': cfg.id || '' },
          h('h3', null, cfg.title),
          cfg.note ? h('p', { class: 'g-note' }, cfg.note) : null,
          h('div', { class: 'g-fig' }),
          h('div', { class: 'g-controls' },
            h('button', { type: 'button', 'data-first': '', 'aria-label': 'First step' }, '⏮'),
            h('button', { type: 'button', 'data-prev': '', 'aria-label': 'Previous step' }, '◀'),
            h('button', { type: 'button', 'data-play': '', 'aria-pressed': 'true' }, 'Pause'),
            h('button', { type: 'button', 'data-next': '', 'aria-label': 'Next step' }, '▶'),
            h('span', { class: 'g-count' }),
            h('span', { class: 'g-caption', 'aria-live': 'polite' })),
          h('div', { class: 'g-extra' }),
          h('div', { class: 'g-log' }));
        if (cfg.id) card.classList.add('demo-' + cfg.id);
        grid.appendChild(card);
        var p = Player(card, cfg);
        if (p) { players.push(p); if (cfg.id) byId[cfg.id] = p; }
      });
    });
    document.getElementById('g-theme').addEventListener('click', function () { VDSA.theme.toggle(); });
    document.getElementById('g-speed').addEventListener('change', function (e) { speed = +e.target.value; players.forEach(function (p) { p.reschedule(); }); });
    var pa = document.getElementById('g-pause-all');
    pa.addEventListener('click', function () {
      pausedAll = !pausedAll; pa.textContent = pausedAll ? 'Resume all' : 'Pause all';
      pa.setAttribute('aria-pressed', String(pausedAll));
      players.forEach(function (p) { p.reschedule(); });
    });
    var q = new URLSearchParams(location.search);
    if (q.get('paused')) { pausedAll = true; pa.textContent = 'Resume all'; players.forEach(function (p) { p.reschedule(); }); }
    if (q.get('only')) {
      var only = q.get('only').split(',');
      Array.prototype.forEach.call(document.querySelectorAll('.g-section'), function (s) { if (only.indexOf(s.id.replace('sec-', '')) === -1) s.style.display = 'none'; });
    }
  }

  /* helpers shared by demo files */
  function button(card, label, onClick, pressed) {
    var b = h('button', { type: 'button' }, label);
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(!!pressed));
    b.addEventListener('click', function () { onClick(b); });
    card.querySelector('.g-extra').appendChild(b);
    return b;
  }
  function log(card, text) { card.querySelector('.g-log').textContent = text; }

  /* Gallery.player('bubble-boxes') -> {go(i, instant), setPlaying(bool), index, built, steps}
     Handy for deterministic mid-animation screenshots:
       p = Gallery.player(id); p.setPlaying(false); p.go(1, true); setTimeout(() => p.go(2), 50); */
  function player(id) { return byId[id]; }

  return { demo: demo, start: start, button: button, log: log, h: h, players: players, player: player, get speed() { return speed; } };
}());
