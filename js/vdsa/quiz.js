/* Visual DSA checks for understanding.

   VDSA.quiz(el, {question, options, answer, explain, multi, id, kicker, hint})   multiple choice card
   VDSA.predict(host, {question, options, answer, explain, id, revealLabel})      "what happens next?" panel (player checkpoints)
   VDSA.clickQuiz(container, {question, answer | check, explain, el, id})         click the element that…
   VDSA.quizScore.get() -> {correct, answered, total}; .onChange(fn); .reset()

   Question, option and explanation strings may contain simple inline HTML (<code>, <b>, <em>).
   Score: a check counts as correct when the FIRST attempt ever made on it was right.
   Stored per lesson in localStorage 'vdsa-quiz-<lesson id>' as {id: {first: bool, solved: bool}}. */
(function (win) {
  'use strict';
  if (!win || !win.document) return;
  var VDSA = win.VDSA = win.VDSA || {};
  var doc = win.document;
  var h = VDSA.h;
  var LETTERS = 'ABCDEFGHIJ';

  function hash(str) { var x = 5381; for (var i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) >>> 0; return x.toString(36); }
  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ''); }
  function ico(name) { return h('i', { class: 'ico', 'data-ico': name, 'aria-hidden': 'true' }); }

  /* ---------------------------------------------------------------- score registry */
  var lessonKey = 'vdsa-quiz-' + (doc.body && (doc.body.getAttribute('data-lesson') || '') || location.pathname.split('/').pop().replace(/\.html?$/, '') || 'page');
  var stored = {};
  try { stored = JSON.parse(win.localStorage.getItem(lessonKey) || '{}') || {}; } catch (_) { stored = {}; }
  var registered = [];
  var scoreListeners = [];
  function save() { try { win.localStorage.setItem(lessonKey, JSON.stringify(stored)); } catch (_) {} }
  function tally() {
    var correct = 0, answered = 0;
    registered.forEach(function (id) {
      var e = stored[id];
      if (e && e.first !== undefined) { answered++; if (e.first) correct++; }
    });
    return { correct: correct, answered: answered, total: registered.length };
  }
  function renderChips(bump) {
    var t = tally();
    VDSA.$$('[data-quiz-score]').forEach(function (chip) {
      if (!t.total) { chip.hidden = true; return; }
      chip.hidden = false;
      chip.classList.add('score-chip');
      VDSA.clear(chip);
      chip.appendChild(ico('check'));
      chip.appendChild(doc.createTextNode(t.correct + ' / ' + t.total + ' correct'));
      chip.title = 'Checks answered correctly on the first try: ' + t.correct + ' of ' + t.total + ' (' + t.answered + ' attempted)';
      if (bump) { chip.classList.remove('is-bump'); void chip.offsetWidth; chip.classList.add('is-bump'); }
    });
  }
  function register(id) {
    if (registered.indexOf(id) === -1) registered.push(id);
    scheduleRender();
  }
  var renderPending = false;
  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    Promise.resolve().then(function () { renderPending = false; renderChips(false); });
  }
  function record(id, correct) {
    var e = stored[id] || (stored[id] = {});
    var firstTime = e.first === undefined;
    if (firstTime) e.first = !!correct;
    if (correct) e.solved = true;
    save();
    renderChips(firstTime);
    var t = tally();
    scoreListeners.forEach(function (fn) { try { fn(t); } catch (err) { console.error(err); } });
    return firstTime;
  }
  VDSA.quizScore = {
    register: register,
    record: record,
    get: tally,
    wasSolved: function (id) { return !!(stored[id] && stored[id].solved); },
    onChange: function (fn) { scoreListeners.push(fn); return function () { scoreListeners = scoreListeners.filter(function (f) { return f !== fn; }); }; },
    reset: function () { stored = {}; save(); renderChips(false); },
    refresh: function () { renderChips(false); }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { renderChips(false); });

  /* ---------------------------------------------------------------- helpers */
  function explainFor(spec, i) {
    if (Array.isArray(spec.explain)) return spec.explain[i] || '';
    return '';
  }
  function generalExplain(spec, answers) {
    if (typeof spec.explain === 'string') return spec.explain;
    if (Array.isArray(spec.explain)) return spec.explain[answers[0]] || '';
    return '';
  }
  function optionButton(text, i, extra) {
    return h('button', Object.assign({ type: 'button', class: 'quiz__opt', 'data-index': i },
      extra || {}), h('span', { class: 'quiz__letter', 'aria-hidden': 'true' }, LETTERS[i] || String(i + 1)), h('span', { class: 'quiz__text', html: String(text) }));
  }
  function setFeedback(fb, good, title, body) {
    fb.className = 'quiz__feedback ' + (good ? 'is-good' : 'is-bad');
    fb.innerHTML = '';
    fb.appendChild(h('b', null, title));
    if (body) fb.appendChild(h('span', { html: body }));
  }

  /* ---------------------------------------------------------------- multiple choice */
  VDSA.quiz = function (el, spec) {
    el = VDSA.$(el);
    if (!el) throw new Error('VDSA.quiz: element not found');
    spec = spec || {};
    var answers = [].concat(spec.answer === undefined ? [] : spec.answer);
    var multi = spec.multi !== undefined ? !!spec.multi : answers.length > 1;
    var id = spec.id || el.id || ('q-' + hash(stripTags(spec.question) + '|' + (spec.options || []).join('|')));
    var listeners = [];
    var attempts = 0, locked = false, picked = [];
    register(id);

    el.classList.add('quiz');
    VDSA.clear(el);
    var status = h('span', { class: 'quiz__status' });
    var head = h('div', { class: 'quiz__head' }, h('span', { class: 'quiz__kicker' }, ico('target'), spec.kicker || (multi ? 'Quick check: pick all that apply' : 'Quick check')), status);
    var qid = VDSA.uid('qq');
    var q = h('p', { class: 'quiz__q', id: qid, html: spec.question || '' });
    var opts = h('div', { class: 'quiz__opts', role: 'group', 'aria-labelledby': qid });
    var fb = h('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    var actions = h('div', { class: 'quiz__actions' });
    el.appendChild(head); el.appendChild(q);
    if (spec.hint) el.appendChild(h('p', { class: 'quiz__hint', html: spec.hint }));
    el.appendChild(opts); el.appendChild(fb); el.appendChild(actions);

    var buttons = (spec.options || []).map(function (text, i) {
      var b = optionButton(text, i, multi ? { 'aria-pressed': 'false' } : null);
      b.addEventListener('click', function () { choose(i); });
      opts.appendChild(b);
      return b;
    });
    var checkBtn = null, resetBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: reset }, 'Try again');
    var revealBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: reveal }, 'Show the answer');
    if (multi) {
      checkBtn = h('button', { type: 'button', class: 'btn btn--primary btn--sm', disabled: true, onclick: check }, 'Check answer');
      actions.appendChild(checkBtn);
    }
    if (VDSA.quizScore.wasSolved(id)) { status.textContent = 'Solved before'; status.className = 'quiz__status is-good'; }

    function emit(result) { listeners.forEach(function (fn) { try { fn(result); } catch (e) { console.error(e); } }); }

    function choose(i) {
      if (locked) return;
      if (multi) {
        var at = picked.indexOf(i);
        if (at === -1) picked.push(i); else picked.splice(at, 1);
        buttons[i].setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
        checkBtn.disabled = picked.length === 0;
        fb.className = 'quiz__feedback'; fb.innerHTML = '';
        return;
      }
      attempts++;
      var correct = answers.indexOf(i) !== -1;
      record(id, correct);
      if (correct) {
        locked = true;
        buttons.forEach(function (b, k) { b.disabled = true; if (k !== i && !b.classList.contains('is-wrong')) b.classList.add('is-dim'); });
        buttons[i].classList.add('is-correct');
        var body = explainFor(spec, i) || generalExplain(spec, answers);
        setFeedback(fb, true, attempts === 1 ? 'Correct.' : 'Correct, on attempt ' + attempts + '.', body);
        status.textContent = attempts === 1 ? 'Correct first try' : 'Solved'; status.className = 'quiz__status is-good';
        VDSA.clear(actions); actions.appendChild(resetBtn);
      } else {
        var b = buttons[i];
        b.classList.add('is-wrong', 'is-fresh'); b.disabled = true;
        setTimeout(function () { b.classList.remove('is-fresh'); }, 400);
        setFeedback(fb, false, 'Not quite.', explainFor(spec, i) || 'Look at the figure again and try another option.');
        VDSA.clear(actions); actions.appendChild(revealBtn);
      }
      emit({ correct: correct, choice: i, attempts: attempts });
    }
    function check() {
      if (locked || !picked.length) return;
      attempts++;
      var correct = picked.length === answers.length && picked.every(function (p) { return answers.indexOf(p) !== -1; });
      record(id, correct);
      locked = true;
      buttons.forEach(function (b, k) {
        b.disabled = true;
        var isAns = answers.indexOf(k) !== -1, isPicked = picked.indexOf(k) !== -1;
        b.removeAttribute('aria-pressed');
        if (isAns && isPicked) b.classList.add('is-correct');
        else if (!isAns && isPicked) b.classList.add('is-wrong');
        else if (isAns && !isPicked) b.classList.add('is-missed');
        else b.classList.add('is-dim');
      });
      var missed = answers.filter(function (a) { return picked.indexOf(a) === -1; }).length;
      var extra = picked.filter(function (p) { return answers.indexOf(p) === -1; }).length;
      var detail = correct ? '' : (missed ? missed + ' correct option' + (missed > 1 ? 's' : '') + ' missed (dashed). ' : '') + (extra ? extra + ' wrong pick' + (extra > 1 ? 's' : '') + '. ' : '');
      setFeedback(fb, correct, correct ? 'Correct.' : 'Not quite.', detail + generalExplain(spec, answers));
      status.textContent = correct ? 'Correct' : ''; status.className = 'quiz__status' + (correct ? ' is-good' : '');
      VDSA.clear(actions); actions.appendChild(resetBtn);
      emit({ correct: correct, choice: picked.slice(), attempts: attempts });
    }
    function reveal() {
      locked = true;
      buttons.forEach(function (b, k) { b.disabled = true; if (answers.indexOf(k) !== -1) b.classList.add('is-correct'); else if (!b.classList.contains('is-wrong')) b.classList.add('is-dim'); });
      setFeedback(fb, true, 'The answer is ' + answers.map(function (a) { return LETTERS[a]; }).join(', ') + '.', generalExplain(spec, answers));
      VDSA.clear(actions); actions.appendChild(resetBtn);
    }
    function reset() {
      locked = false; picked = []; attempts = 0;
      buttons.forEach(function (b) { b.disabled = false; b.className = 'quiz__opt'; if (multi) b.setAttribute('aria-pressed', 'false'); });
      fb.className = 'quiz__feedback'; fb.innerHTML = '';
      VDSA.clear(actions);
      if (multi) { checkBtn.disabled = true; actions.appendChild(checkBtn); }
      if (buttons[0]) buttons[0].focus();
    }
    return { el: el, id: id, onAnswer: function (fn) { listeners.push(fn); return this; }, reset: reset, reveal: reveal };
  };

  /* ---------------------------------------------------------------- predict (inline panel) */
  /* VDSA.predict(host, spec) appends a panel to host and returns {el, promise, close}.
     promise resolves {correct, choice, skipped} when the reader asks to see the answer. */
  VDSA.predict = function (host, spec) {
    host = VDSA.$(host);
    spec = spec || {};
    var answers = [].concat(spec.answer === undefined ? [] : spec.answer);
    var id = spec.id || ('p-' + hash(stripTags(spec.question)));
    register(id);
    var resolveFn, settled = false, result = { correct: false, choice: null, skipped: true };
    var promise = new Promise(function (res) { resolveFn = res; });
    var qid = VDSA.uid('pq');
    var fb = h('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    var opts = h('div', { class: 'quiz__opts', role: 'group', 'aria-labelledby': qid });
    var reveal = h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: function () { finish(); } }, spec.revealLabel || 'Show me');
    var skip = h('button', { type: 'button', class: 'btn btn--ghost btn--sm predict__skip', onclick: function () { finish(); } }, 'Skip');
    var actions = h('div', { class: 'predict__actions' }, skip);
    var panel = h('div', { class: 'predict', role: 'group', 'aria-label': 'Prediction' },
      h('div', { class: 'predict__kicker' }, ico('spark'), spec.kicker || 'Predict the next step'),
      h('p', { class: 'predict__q', id: qid, html: spec.question || 'What happens next?' }),
      opts, fb, actions);
    var buttons = (spec.options || []).map(function (text, i) {
      var b = optionButton(text, i);
      b.addEventListener('click', function () { choose(i); });
      opts.appendChild(b);
      return b;
    });
    function choose(i) {
      var correct = answers.indexOf(i) !== -1;
      record(id, correct);
      result = { correct: correct, choice: i, skipped: false };
      buttons.forEach(function (b, k) {
        b.disabled = true;
        if (answers.indexOf(k) !== -1) b.classList.add('is-correct');
        else if (k === i) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
      var body = explainFor(spec, i) || generalExplain(spec, answers);
      setFeedback(fb, correct, correct ? 'Good prediction.' : 'Not this time.', body);
      skip.remove();
      actions.appendChild(reveal);
      reveal.focus({ preventScroll: true });
    }
    function finish() {
      if (settled) return;
      settled = true;
      close();
      resolveFn(result);
    }
    function close() { if (panel.parentNode) panel.parentNode.removeChild(panel); }
    host.appendChild(panel);
    return { el: panel, promise: promise, close: function () { settled = true; close(); resolveFn({ correct: false, choice: null, skipped: true, cancelled: true }); }, reveal: finish };
  };

  /* ---------------------------------------------------------------- click the element */
  /* VDSA.clickQuiz(container, {question, answer: id | [ids], check(id, el) -> bool | {correct, message},
       explain, right, wrong, el: card host (optional), id})
     Targets are descendants of container carrying data-id (HTML or SVG). They become focusable buttons. */
  VDSA.clickQuiz = function (container, spec) {
    container = VDSA.$(container);
    if (!container) throw new Error('VDSA.clickQuiz: container not found');
    spec = spec || {};
    var answers = [].concat(spec.answer === undefined ? [] : spec.answer).map(String);
    var id = spec.id || ('c-' + hash(stripTags(spec.question || '') + answers.join(',')));
    var listeners = [], solved = false, attempts = 0, marked = [];
    register(id);

    var card = spec.el ? VDSA.$(spec.el) : null;
    if (!card) { card = h('div'); container.parentNode.insertBefore(card, container.nextSibling); }
    card.classList.add('quiz', 'quiz--click');
    VDSA.clear(card);
    var fb = h('div', { class: 'quiz__feedback', 'aria-live': 'polite' });
    var status = h('span', { class: 'quiz__status' });
    var resetBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: reset }, 'Try again');
    var actions = h('div', { class: 'quiz__actions' });
    card.appendChild(h('div', { class: 'quiz__head' }, h('span', { class: 'quiz__kicker' }, ico('target'), spec.kicker || 'Click to answer'), status));
    card.appendChild(h('p', { class: 'quiz__q', html: spec.question || 'Click the right element in the figure.' }));
    card.appendChild(h('p', { class: 'quiz__hint' }, 'Click or tap it in the figure above. With a keyboard, Tab to it and press Enter.'));
    card.appendChild(fb); card.appendChild(actions);
    container.classList.add('is-clickable');

    function enhance() {
      VDSA.$$('[data-id]', container).forEach(function (t) {
        if (t.__vdsaClick) return;
        t.__vdsaClick = true;
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '0');
        if (!t.hasAttribute('role')) t.setAttribute('role', 'button');
        if (!t.hasAttribute('aria-label')) t.setAttribute('aria-label', t.getAttribute('data-label') || (t.textContent || '').trim() || t.getAttribute('data-id'));
      });
    }
    enhance();
    var mo = 'MutationObserver' in win ? new MutationObserver(enhance) : null;
    if (mo) mo.observe(container, { childList: true, subtree: true });

    function evaluate(t) {
      var tid = t.getAttribute('data-id');
      var res = spec.check ? spec.check(tid, t) : answers.indexOf(String(tid)) !== -1;
      if (res && typeof res === 'object') return { correct: !!res.correct, message: res.message || '' };
      return { correct: !!res, message: '' };
    }
    function pick(t) {
      if (solved) return;
      attempts++;
      var r = evaluate(t);
      record(id, r.correct);
      marked.forEach(function (m) { m.classList.remove('is-pick-wrong'); });
      t.classList.add(r.correct ? 'is-pick-right' : 'is-pick-wrong');
      marked.push(t);
      if (r.correct) {
        solved = true;
        setFeedback(fb, true, attempts === 1 ? 'Correct.' : 'Correct, on attempt ' + attempts + '.', r.message || spec.right || spec.explain || '');
        status.textContent = attempts === 1 ? 'Correct first try' : 'Solved'; status.className = 'quiz__status is-good';
        VDSA.clear(actions); actions.appendChild(resetBtn);
      } else {
        setFeedback(fb, false, 'Not that one.', r.message || spec.wrong || 'Try another element.');
      }
      listeners.forEach(function (fn) { try { fn({ correct: r.correct, id: t.getAttribute('data-id'), attempts: attempts }); } catch (e) { console.error(e); } });
    }
    function onClick(e) {
      var t = e.target.closest && e.target.closest('[data-id]');
      if (!t || !container.contains(t)) return;
      pick(t);
    }
    function onKey(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var t = e.target.closest && e.target.closest('[data-id]');
      if (!t || !container.contains(t)) return;
      e.preventDefault(); e.stopPropagation();
      pick(t);
    }
    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKey);
    function reset() {
      solved = false; attempts = 0;
      marked.forEach(function (m) { m.classList.remove('is-pick-right', 'is-pick-wrong'); });
      marked = [];
      fb.className = 'quiz__feedback'; fb.innerHTML = '';
      status.textContent = ''; VDSA.clear(actions);
    }
    return {
      el: card, id: id, reset: reset,
      onAnswer: function (fn) { listeners.push(fn); return this; },
      destroy: function () { container.removeEventListener('click', onClick); container.removeEventListener('keydown', onKey); if (mo) mo.disconnect(); container.classList.remove('is-clickable'); }
    };
  };
}(typeof window !== 'undefined' ? window : null));
