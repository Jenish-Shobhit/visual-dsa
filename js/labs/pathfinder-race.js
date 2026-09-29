/* Pathfinder lab: the race. Five small canvases (one per search) run the same map at the same rate, one step per
   tick per lane, so the lane that finishes first expanded the fewest cells. Colours come from the --st-* tokens.

     var race = Pathfinder.race(host, {getMap: function () { return {R, C, grid, start, goal, mudCost, heuristic, hWeight}; }});
     race.prepare()   generate every trace for the current map and draw the empty lanes
     race.start()     run (prepares first if needed);  race.pause();  race.reset();  race.invalidate()  the map changed */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, P = window.Pathfinder;

  function tokens() {
    var cs = getComputedStyle(document.documentElement), o = {};
    ['--bg-sunken', '--bg-elev', '--ink-2', '--ink', '--el-stroke', '--st-active', '--st-frontier', '--st-visited', '--st-path', '--st-found', '--st-done', '--line'].forEach(function (k) { o[k] = cs.getPropertyValue(k).trim() || '#888'; });
    return o;
  }

  P.race = function (host, opts) {
    var lanes = [], prepared = false, running = false, raf = 0, last = 0, acc = 0, finished = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var SPS = 90;                      // steps per second, same for every lane

    P.ALGOS.forEach(function (a) {
      var tally = h('span', { class: 'pf-lane__tally' }, 'ready');
      var canvas = h('canvas', { class: 'pf-lane__canvas', role: 'img', 'aria-label': a.name + ' racing on the current map' });
      var el = h('div', { class: 'pf-lane', 'data-algo': a.id }, h('div', { class: 'pf-lane__head' }, h('b', null, a.name), tally), canvas);
      host.appendChild(el);
      lanes.push({ algo: a, el: el, tally: tally, canvas: canvas, ctx: canvas.getContext('2d'), steps: null, idx: 0, ord: null, res: null, place: 0 });
    });

    function size(lane, R, C) {
      var w = Math.max(60, lane.el.clientWidth - 2), cell = w / C, hpx = Math.round(cell * R);
      lane.canvas.style.width = w + 'px'; lane.canvas.style.height = hpx + 'px';
      lane.canvas.width = Math.round(w * dpr); lane.canvas.height = Math.round(hpx * dpr);
      lane.cell = cell;
    }

    function draw(lane, tk) {
      var m = lane.map, R = m.R, C = m.C, cx = lane.ctx, cell = lane.cell * dpr, step = lane.steps ? lane.steps[lane.idx] : null;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, lane.canvas.width, lane.canvas.height);
      cx.fillStyle = tk['--bg-sunken']; cx.fillRect(0, 0, lane.canvas.width, lane.canvas.height);
      var codes = step ? step.codes : lane.blankCodes, mud = lane.mudStr, pad = cell > 5 ? 0.5 * dpr : 0, k, r, c, ch;
      for (k = 0; k < codes.length; k++) {
        ch = codes[k]; r = Math.floor(k / C); c = k % C;
        var x = c * cell + pad, y = r * cell + pad, w = cell - 2 * pad;
        if (ch === '#') { cx.globalAlpha = 0.85; cx.fillStyle = tk['--el-stroke']; cx.fillRect(x, y, w, w); cx.globalAlpha = 1; continue; }
        if (mud[k] === '1') { cx.globalAlpha = 0.28; cx.fillStyle = tk['--st-path']; cx.fillRect(x, y, w, w); cx.globalAlpha = 1; }
        if (ch === '.') continue;
        if (ch === 'v') { var t = lane.ord ? lane.ord[k] / lane.total : 0.5; cx.globalAlpha = 0.2 + 0.7 * t; cx.fillStyle = tk['--st-visited']; }
        else if (ch === 'f') { cx.globalAlpha = 0.9; cx.fillStyle = tk['--st-frontier']; }
        else if (ch === 'a') { cx.globalAlpha = 1; cx.fillStyle = tk['--st-active']; }
        else { cx.globalAlpha = 1; cx.fillStyle = tk['--st-path']; }
        cx.fillRect(x, y, w, w); cx.globalAlpha = 1;
      }
      if (step && lane.idx === lane.steps.length - 1 && lane.res && lane.res.found) {
        cx.strokeStyle = tk['--st-path']; cx.lineWidth = Math.max(1.5 * dpr, cell * 0.3); cx.lineJoin = 'round'; cx.lineCap = 'round';
        cx.beginPath();
        lane.res.path.forEach(function (rc, i) { var px = (rc[1] + 0.5) * cell, py = (rc[0] + 0.5) * cell; if (i) cx.lineTo(px, py); else cx.moveTo(px, py); });
        cx.stroke();
      }
      var s = m.start, g = m.goal, rad = Math.max(2 * dpr, cell * 0.42);
      cx.fillStyle = tk['--st-active']; cx.beginPath(); cx.arc((s[1] + 0.5) * cell, (s[0] + 0.5) * cell, rad, 0, 6.2832); cx.fill();
      cx.strokeStyle = tk['--st-found']; cx.lineWidth = Math.max(1.5 * dpr, cell * 0.18); cx.beginPath(); cx.arc((g[1] + 0.5) * cell, (g[0] + 0.5) * cell, rad, 0, 6.2832); cx.stroke();
    }
    function drawAll() { var tk = tokens(); lanes.forEach(function (l) { if (l.map) draw(l, tk); }); }

    function tallyText(l) {
      var st = l.steps[l.idx], cn = st.counters, exp = cn.expanded !== undefined ? cn.expanded : cn.visited;
      if (l.idx < l.steps.length - 1) return exp + ' expanded';
      if (!l.res.found) return exp + ' expanded · no path';
      return (l.place ? '#' + l.place + ' · ' : '') + exp + ' expanded · cost ' + l.res.cost;
    }

    function prepare() {
      var m = opts.getMap();
      finished = 0; acc = 0;
      var mm = {}, mudStr = ''; m.grid.mud.forEach(function (k) { mm[k] = 1; });
      for (var i = 0; i < m.R * m.C; i++) mudStr += mm[Math.floor(i / m.C) + ',' + (i % m.C)] ? '1' : '0';
      lanes.forEach(function (l) {
        l.map = m; size(l, m.R, m.C);
        l.steps = P.runSteps(l.algo.id, m.grid, m.start, m.goal, m);
        var ex = P.expandOrder(l.steps, m.R, m.C);
        l.ord = ex.ord; l.total = ex.total;
        l.res = P.analyze(l.steps, m.grid, m.start, m.goal, m.mudCost);
        l.idx = 0; l.place = 0;
        l.blankCodes = l.steps[0].codes.replace(/[^#]/g, '.');
        l.mudStr = mudStr;
        l.tally.textContent = 'ready'; l.el.classList.remove('is-done', 'is-first');
      });
      prepared = true;
      drawAll();
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.max(0, Math.min(80, now - last)); last = now;
      acc += dt * SPS / 1000;
      var n = Math.floor(acc); acc -= n;
      if (V.reducedMotion()) n = Math.max(n, 6);
      var any = false;
      lanes.forEach(function (l) {
        if (l.idx >= l.steps.length - 1) return;
        l.idx = Math.min(l.steps.length - 1, l.idx + n);
        if (l.idx === l.steps.length - 1) {
          l.place = ++finished; l.el.classList.add('is-done'); if (l.place === 1) l.el.classList.add('is-first');
        } else any = true;
        l.tally.textContent = tallyText(l);
      });
      drawAll();
      if (any) raf = requestAnimationFrame(frame); else { running = false; setRunning(false); }
    }
    function setRunning(on) { if (opts.onState) opts.onState(on); }

    var themeObs = new MutationObserver(drawAll);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll); } catch (e) { /* older browsers */ } }
    V.onResize(host, function () { if (prepared) { lanes.forEach(function (l) { size(l, l.map.R, l.map.C); }); drawAll(); } });

    return {
      prepare: prepare,
      start: function () {
        if (!prepared) prepare();
        if (lanes.every(function (l) { return l.idx >= l.steps.length - 1; })) prepare();
        running = true; last = performance.now(); setRunning(true); raf = requestAnimationFrame(frame);
      },
      pause: function () { running = false; cancelAnimationFrame(raf); setRunning(false); },
      reset: function () { running = false; cancelAnimationFrame(raf); setRunning(false); if (prepared) prepare(); },
      invalidate: function () {
        running = false; cancelAnimationFrame(raf); setRunning(false); prepared = false;
        lanes.forEach(function (l) { l.steps = null; l.ord = null; l.tally.textContent = 'map changed'; l.el.classList.remove('is-done', 'is-first'); });
      },
      get prepared() { return prepared; }
    };
  };
}());
